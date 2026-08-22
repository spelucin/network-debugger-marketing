// Heap Analytics Parsing Utilities
// Extracts event data from Heap API requests (c.us.heap-api.com, heapanalytics.com)

/**
 * Parse a Heap Analytics request and return structured event data
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text
 * @returns {Object} Parsed Heap data
 */
export function parseHeapData(url, postData) {
  const urlObj = new URL(url);
  const urlParams = Object.fromEntries(urlObj.searchParams);

  let body = null;
  if (postData) {
    try {
      body = JSON.parse(postData);
    } catch (e) { /* not JSON */ }
  }

  // App ID can be in URL path, query param, or body
  const appId = urlParams.app_id || body?.app_id || body?.appid ||
    urlObj.pathname.match(/\/(\d{5,})\//)?.[1];

  // Determine the endpoint type from the URL path. Boundary-aware segment
  // matching (not bare substring) so e.g. `/track-changes` does not classify
  // as Track — the F7 precision class fixed for pendo.js in #138, applied to
  // this sibling parser (#140).
  const path = urlObj.pathname.toLowerCase();
  const hasSegment = (seg) => new RegExp(`/${seg}(/|$)`).test(path);
  let endpointType = 'Request';
  if (hasSegment('track')) endpointType = 'Track';
  else if (hasSegment('identify')) endpointType = 'Identify';
  else if (hasSegment('add_user_properties')) endpointType = 'User Properties';
  else if (hasSegment('api/event')) endpointType = 'Event';
  else if (hasSegment('bulk')) endpointType = 'Bulk Track';

  // Extract events from the body
  const events = [];
  if (body?.events && Array.isArray(body.events)) {
    for (const ev of body.events) {
      events.push({
        eventName: ev.event || ev.t || endpointType,
        properties: ev.properties || {},
        identity: ev.identity || ev.user_id,
        timestamp: ev.timestamp
      });
    }
  } else if (body?.event || body?.t) {
    events.push({
      eventName: body.event || body.t || endpointType,
      properties: body.properties || body.k || {},
      identity: body.identity || body.user_id,
      timestamp: body.timestamp
    });
  }

  // Primary event for display
  const primary = events[0];
  const eventName = primary?.eventName || endpointType;

  // Build overview
  const overview = {};
  if (appId) overview['App ID'] = appId;
  if (primary?.identity) overview['Identity'] = primary.identity;
  if (events.length > 1) overview['Events in Batch'] = String(events.length);

  // --- Custom Data: event properties + user properties ---
  const customData = {};
  if (primary?.properties && typeof primary.properties === 'object' && Object.keys(primary.properties).length > 0) {
    customData['Event Properties'] = primary.properties;
  }
  // User properties (from addUserProperties or identify calls)
  const userProps = body?.properties || body?.user_properties;
  if (endpointType === 'User Properties' && userProps && typeof userProps === 'object') {
    customData['User Properties'] = userProps;
  }
  if (endpointType === 'Identify' && body?.properties && typeof body.properties === 'object') {
    customData['User Properties'] = body.properties;
  }

  // Additional events' properties (if batched)
  if (events.length > 1) {
    for (let i = 1; i < events.length; i++) {
      const ev = events[i];
      if (ev.properties && Object.keys(ev.properties).length > 0) {
        customData[`Event ${i + 1} Properties (${ev.eventName})`] = ev.properties;
      }
    }
  }

  // --- Grouped Parsed Data (system/protocol params) ---
  const groupedParams = {};

  // Identity
  const identity = {};
  if (appId) identity['App ID (app_id)'] = appId;
  if (body?.user_id || body?.identity) identity['User ID'] = body.user_id || body.identity;
  if (body?.session_id) identity['Session ID (session_id)'] = body.session_id;
  if (body?.idempotency_key) identity['Idempotency Key'] = body.idempotency_key;
  if (Object.keys(identity).length > 0) {
    groupedParams['Identity'] = identity;
  }

  // Event Info
  if (events.length > 0) {
    const eventInfo = {};
    events.forEach((ev, i) => {
      const prefix = events.length > 1 ? `[${i + 1}] ` : '';
      eventInfo[`${prefix}Event Name`] = ev.eventName;
      if (ev.timestamp) eventInfo[`${prefix}Timestamp`] = ev.timestamp;
      if (ev.identity) eventInfo[`${prefix}Identity`] = ev.identity;
    });
    if (Object.keys(eventInfo).length > 0) {
      groupedParams['Events'] = eventInfo;
    }
  }

  // Request
  const requestData = {};
  if (body?.sentAt) requestData['Sent At (sentAt)'] = body.sentAt;
  if (body?.library) {
    if (typeof body.library === 'object') {
      if (body.library.name) requestData['Library (library.name)'] = body.library.name;
      if (body.library.version) requestData['Library Version (library.version)'] = body.library.version;
    } else {
      requestData['Library'] = body.library;
    }
  }
  if (body?.sdk_version) requestData['SDK Version (sdk_version)'] = body.sdk_version;
  if (Object.keys(requestData).length > 0) {
    groupedParams['Request'] = requestData;
  }

  const detectedBy = url.includes('heap-api.com')
    ? 'URL contains heap-api.com'
    : url.includes('heapanalytics.com')
      ? 'URL contains heapanalytics.com'
      : url.includes('heap.io')
        ? 'URL contains heap.io'
        : 'URL matches Heap pattern';

  return {
    eventName,
    events,
    appId,
    overview,
    customData,
    groupedParams,
    params: urlParams,
    postData: body,
    detectedBy
  };
}
