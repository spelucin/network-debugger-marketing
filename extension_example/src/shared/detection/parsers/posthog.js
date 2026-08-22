// PostHog Parsing Utilities
// Extracts event data from PostHog API requests

/**
 * Classify the PostHog endpoint type from a URL
 * @param {URL} urlObj - Parsed URL object
 * @returns {string} Endpoint type: 'capture', 'flags', 'decide', 'script', 'unknown'
 */
function classifyEndpoint(urlObj) {
  const pathname = urlObj.pathname;
  const lowPath = pathname.toLowerCase();

  // Script / asset loads
  if (lowPath.endsWith('.js')) {
    return 'script';
  }

  // Event capture endpoints
  if (lowPath === '/e' || lowPath === '/e/' ||
      lowPath.startsWith('/capture') ||
      lowPath.startsWith('/batch') ||
      lowPath.startsWith('/i/v0/e')) {
    return 'capture';
  }

  // Feature flags
  if (lowPath.startsWith('/flags')) {
    return 'flags';
  }

  // Decide (config + flags)
  if (lowPath.startsWith('/decide')) {
    return 'decide';
  }

  return 'unknown';
}

/**
 * Decode the form-data 'data' parameter from PostHog POST body
 * PostHog SDK sends: Content-Type: application/x-www-form-urlencoded
 * Body: data=<base64-encoded-JSON>
 * @param {string} postData - Raw POST body text
 * @returns {{ data: Object|null, rawBase64: string|null }}
 */
function decodeFormData(postData) {
  try {
    const params = new URLSearchParams(postData);
    const dataStr = params.get('data');
    if (!dataStr) return { data: null, rawBase64: null };

    // Decode base64 → JSON
    try {
      const decoded = atob(dataStr);
      const parsed = JSON.parse(decoded);
      return { data: parsed, rawBase64: dataStr };
    } catch (e) {
      // Could be gzip-js compressed — return raw for async decode
      return { data: null, rawBase64: dataStr };
    }
  } catch (e) {
    return { data: null, rawBase64: null };
  }
}

/**
 * Extract events from a decoded PostHog capture payload
 * Handles single event, batch array, and {batch:[...]} formats
 * @param {Object} body - Decoded JSON body
 * @returns {Array} Array of raw event objects
 */
function extractEventsFromBody(body) {
  if (!body) return [];

  // Single event: { event: '...', properties: {...} }
  if (body.event) {
    return [{
      event: body.event,
      properties: body.properties || {},
      distinct_id: body.distinct_id || body.properties?.$distinct_id,
      timestamp: body.timestamp
    }];
  }

  // Batch format: { batch: [...] }
  if (body.batch && Array.isArray(body.batch)) {
    return body.batch.map(e => ({
      event: e.event,
      properties: e.properties || {},
      distinct_id: e.distinct_id || e.properties?.$distinct_id,
      timestamp: e.timestamp
    }));
  }

  // Plain array of events
  if (Array.isArray(body)) {
    return body.map(e => ({
      event: e.event,
      properties: e.properties || {},
      distinct_id: e.distinct_id || e.properties?.$distinct_id,
      timestamp: e.timestamp
    }));
  }

  return [];
}

/**
 * Parse PostHog events from request data
 * Handles capture, flags, decide, and script endpoints
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text
 * @returns {Object} Parsed PostHog data with endpoint classification
 */
export function parsePostHogRequestData(url, postData) {
  const urlObj = new URL(url);
  const endpointType = classifyEndpoint(urlObj);
  const compression = urlObj.searchParams.get('compression') || null;

  // Determine region from URL
  let region = 'US';
  if (urlObj.hostname.includes('eu.') || urlObj.hostname.includes('eu-')) {
    region = 'EU';
  }

  // Base result
  const result = {
    endpointType,
    events: [],
    token: null,
    region,
    distinctId: null,
    personProperties: null,
    groups: null,
    sdkVersion: urlObj.searchParams.get('ver') || null,
    compression,
    needsAsyncDecode: false,
    rawBase64Data: null,
    rawGzipBinary: null,
    postData,
    detectedBy: `URL matches PostHog ${endpointType} endpoint`
  };

  // Script loads are handled by KNOWN_SCRIPT_LOADS in panel.js — no parsing needed here
  if (endpointType === 'script' || !postData) return result;

  // Decode the POST body
  let body = null;

  // Strategy 1: Form-data with base64 'data' parameter (PostHog SDK default)
  if (compression === 'base64' || compression === null) {
    const formResult = decodeFormData(postData);
    if (formResult.data) {
      body = formResult.data;
    } else if (formResult.rawBase64) {
      // Form data found but couldn't decode base64 — might be plain text
      // Fall through to JSON parse
    }
  }

  // Strategy 2: gzip-compressed body — can't decode synchronously (the async panel-side
  // handler does the gunzip). Two transports under `?compression=gzip-js`/`gzip`:
  //   • modern posthog-js (>= ~1.30) gzips the payload and sends it as a RAW BINARY body
  //   • older builds / proxies send the gzip as base64 text (or form-encoded `data=`)
  // Cover all three shapes; the panel handler picks the matching decode path.
  if (!body && (compression === 'gzip-js' || compression === 'gzip')) {
    // (a) Raw base64-encoded gzip as the whole body (gzip base64 starts with 'H4sI').
    if (postData && /^[A-Za-z0-9+/=]+$/.test(postData.trim())) {
      result.needsAsyncDecode = true;
      result.rawBase64Data = postData.trim();
      return result;
    }
    // (b) Form-encoded `data=` base64 parameter.
    const formResult = decodeFormData(postData);
    if (formResult.rawBase64) {
      result.needsAsyncDecode = true;
      result.rawBase64Data = formResult.rawBase64;
      return result;
    }
    // (c) Raw gzip BINARY body (modern default). Not base64, not form-encoded, and not plain
    // JSON — the body string carries the gzip bytes directly. The panel handler reconstructs
    // the bytes and verifies the gzip magic header before trusting them, so a body the browser
    // delivered lossily falls through cleanly to the (request) row rather than emitting garbage.
    if (postData) {
      let isJson = false;
      try { JSON.parse(postData); isJson = true; } catch { /* not JSON → raw gzip binary */ }
      if (!isJson) {
        result.needsAsyncDecode = true;
        result.rawGzipBinary = postData;
        return result;
      }
    }
  }

  // Strategy 3: Direct JSON body (proxied/modified requests)
  if (!body) {
    try {
      body = JSON.parse(postData);
    } catch (e) {
      // Strategy 4: Form-data fallback (no compression param)
      if (compression === null) {
        const formResult = decodeFormData(postData);
        if (formResult.data) {
          body = formResult.data;
        }
      }
    }
  }

  if (!body) return result;

  // Extract token/API key
  result.token = body.api_key || body.token || null;

  // Extract data based on endpoint type
  if (endpointType === 'capture' || endpointType === 'unknown') {
    const rawEvents = extractEventsFromBody(body);
    result.events = rawEvents.map(event => ({
      eventName: event.event || 'Unknown Event',
      distinctId: event.distinct_id,
      properties: event.properties || {},
      timestamp: event.timestamp,
      rawEvent: event
    }));

    // For unknown endpoints with events, upgrade to capture
    if (endpointType === 'unknown' && result.events.length > 0) {
      result.endpointType = 'capture';
      result.detectedBy = 'URL matches PostHog endpoint (events found)';
    }

    // Also check for flags/decide-style data in capture payloads (fallback)
    if (result.events.length === 0 && body.distinct_id) {
      result.distinctId = body.distinct_id;
      result.personProperties = body.person_properties || null;
      result.groups = body.groups || null;
    }
  }

  if (endpointType === 'flags' || endpointType === 'decide') {
    result.distinctId = body.distinct_id || null;
    result.personProperties = body.person_properties || null;
    result.groups = (body.groups && Object.keys(body.groups).length > 0) ? body.groups : null;

    // Flags/decide can also contain events in some cases
    const rawEvents = extractEventsFromBody(body);
    if (rawEvents.length > 0) {
      result.events = rawEvents.map(event => ({
        eventName: event.event || 'Unknown Event',
        distinctId: event.distinct_id,
        properties: event.properties || {},
        timestamp: event.timestamp,
        rawEvent: event
      }));
    }
  }

  return result;
}
