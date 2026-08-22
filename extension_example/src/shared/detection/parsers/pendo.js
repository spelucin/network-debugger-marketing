// Pendo Parsing Utilities
// Extracts event data from Pendo API requests (data.pendo.io, app.pendo.io)
// Pendo sends track, page, identify, and guide events via POST JSON

/**
 * Parse a Pendo request and return structured event data
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text
 * @returns {Object} Parsed Pendo data
 */
export function parsePendoData(url, postData) {
  const urlObj = new URL(url);
  const urlParams = Object.fromEntries(urlObj.searchParams);

  let body = null;
  if (postData) {
    try {
      body = JSON.parse(postData);
    } catch (e) { /* not JSON */ }
  }

  // Determine endpoint type from URL path.
  // F7: match whole path segments, not bare substrings — bare `includes('/track')`
  // over-matched `/track-changes`, `includes('/page')` over-matched `/homepage`,
  // etc. `pathname` carries no query string, so a `(/|$)` boundary suffices.
  const path = urlObj.pathname.toLowerCase();
  const hasSegment = (name) => new RegExp(`/${name}(/|$)`).test(path);
  let endpointType = 'Request';
  if (hasSegment('track')) endpointType = 'Track';
  else if (hasSegment('page')) endpointType = 'Page';
  else if (hasSegment('identify')) endpointType = 'Identify';
  else if (hasSegment('guide')) endpointType = 'Guide';
  else if (hasSegment('event')) endpointType = 'Event';
  else if (hasSegment('click')) endpointType = 'Click';
  else if (hasSegment('ajax')) endpointType = 'Ajax';
  else if (hasSegment('ptm')) endpointType = 'Tag Manager';
  else if (hasSegment('log')) endpointType = 'Log';
  else if (hasSegment('account')) endpointType = 'Account';

  // Extract events from body — Pendo batches events
  const events = [];
  if (body?.events && Array.isArray(body.events)) {
    for (const ev of body.events) {
      events.push({
        type: ev.type || endpointType,
        props: ev.props || ev.properties || {},
        timestamp: ev.timestamp || ev.ts
      });
    }
  } else if (Array.isArray(body)) {
    // Root-level array of events
    for (const ev of body) {
      events.push({
        type: ev.type || ev.action || endpointType,
        props: ev.props || ev.properties || ev.params || {},
        timestamp: ev.timestamp || ev.ts
      });
    }
  }

  // Primary event for display
  const primary = events[0];
  const eventName = primary?.type || endpointType;

  // Extract visitor/account IDs from various locations
  const visitorId = body?.visitorId || body?.visitor_id || body?.v ||
    urlParams.visitor_id || urlParams.v;
  const accountId = body?.accountId || body?.account_id ||
    urlParams.account_id;
  const apiKey = urlParams.apiKey || body?.apiKey;

  // Build overview
  const overview = {};
  if (apiKey) overview['API Key'] = apiKey;
  if (visitorId) overview['Visitor ID'] = visitorId;
  if (accountId) overview['Account ID'] = accountId;
  if (events.length > 1) overview['Events in Batch'] = String(events.length);

  // --- Custom Data: event properties (user-defined business data) ---
  const customData = {};
  if (primary?.props && typeof primary.props === 'object' && Object.keys(primary.props).length > 0) {
    customData['Event Properties'] = primary.props;
  }

  // Visitor metadata
  const visitorMeta = body?.visitorData || body?.visitor;
  if (visitorMeta && typeof visitorMeta === 'object' && Object.keys(visitorMeta).length > 0) {
    customData['Visitor Data'] = visitorMeta;
  }

  // Account metadata
  const accountMeta = body?.accountData || body?.account;
  if (accountMeta && typeof accountMeta === 'object' && Object.keys(accountMeta).length > 0) {
    customData['Account Data'] = accountMeta;
  }

  // Additional events' properties (if batched)
  if (events.length > 1) {
    for (let i = 1; i < Math.min(events.length, 6); i++) {
      const ev = events[i];
      if (ev.props && Object.keys(ev.props).length > 0) {
        customData[`Event ${i + 1} (${ev.type})`] = ev.props;
      }
    }
    if (events.length > 6) {
      customData[`... and ${events.length - 6} more events`] = {};
    }
  }

  // --- Grouped Parsed Data (system/protocol params) ---
  const groupedParams = {};

  // Identity
  const identity = {};
  if (visitorId) identity['Visitor ID'] = visitorId;
  if (accountId) identity['Account ID'] = accountId;
  if (apiKey) identity['API Key (apiKey)'] = apiKey;
  if (body?.anonId) identity['Anonymous ID (anonId)'] = body.anonId;
  if (Object.keys(identity).length > 0) {
    groupedParams['Identity'] = identity;
  }

  // Events (summary)
  if (events.length > 0) {
    const eventInfo = {};
    events.forEach((ev, i) => {
      const prefix = events.length > 1 ? `[${i + 1}] ` : '';
      eventInfo[`${prefix}Type`] = ev.type;
      if (ev.timestamp) eventInfo[`${prefix}Timestamp`] = String(ev.timestamp);
    });
    if (Object.keys(eventInfo).length > 0) {
      groupedParams['Events'] = eventInfo;
    }
  }

  // Page Context
  const pageContext = {};
  if (body?.url) pageContext['URL'] = body.url;
  if (body?.title) pageContext['Title'] = body.title;
  if (body?.referrer) pageContext['Referrer'] = body.referrer;
  if (body?.href) pageContext['Href'] = body.href;
  if (Object.keys(pageContext).length > 0) {
    groupedParams['Page Context'] = pageContext;
  }

  // Request
  const requestData = {};
  if (body?.ct) requestData['Client Time (ct)'] = String(body.ct);
  if (body?.jzb) requestData['Compressed (jzb)'] = 'true';
  if (body?.v) requestData['Version (v)'] = body.v;
  if (Object.keys(requestData).length > 0) {
    groupedParams['Request'] = requestData;
  }

  const detectedBy = url.includes('data.pendo.io')
    ? 'URL contains data.pendo.io'
    : url.includes('app.pendo.io')
      ? 'URL contains app.pendo.io'
      : 'URL matches Pendo pattern';

  return {
    eventName,
    events,
    overview,
    customData,
    groupedParams,
    params: urlParams,
    postData: body,
    detectedBy
  };
}
