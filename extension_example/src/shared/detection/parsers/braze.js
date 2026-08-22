// Braze Parsing Utilities
// Decodes Braze Web SDK data-collection requests.
//
// The SDK POSTs a JSON body to rest.<cluster>.braze.com/api/v3/data/ shaped:
//   {
//     events: [ { name, time, session_id, data }, ... ],
//     device: { browser, browser_version, os_version, resolution, locale, time_zone, user_agent },
//     api_key, time, sdk_version, device_id
//   }
// Each event's `name` is a short Braze type code. For custom events (`ce`),
// `data.n` is the human event name and `data.p` is the property bag the site team
// set. Purchases (`p`) carry product fields directly on `data`.

// Known Braze internal event-type codes → human labels.
const BRAZE_EVENT_TYPES = {
  ce: 'Custom Event',
  p: 'Purchase',
  ss: 'Session Start',
  se: 'Session End'
};

/**
 * Parse a Braze data-collection request into a normalized shape.
 * Never throws — returns an empty events array on malformed input.
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text (JSON)
 * @returns {{ events: Array, apiKey: ?string, deviceId: ?string, sdkVersion: ?string, device: ?Object, postData: ?string, detectedBy: string }}
 */
export function parseBrazeRequestData(url, postData) {
  const result = {
    events: [],
    apiKey: null,
    deviceId: null,
    sdkVersion: null,
    device: null,
    postData,
    detectedBy: 'URL matches Braze data endpoint'
  };

  if (!postData) return result;

  let body;
  try {
    body = JSON.parse(postData);
  } catch (e) {
    return result; // not JSON — nothing to decode
  }
  if (!body || typeof body !== 'object') return result;

  result.apiKey = body.api_key || null;
  result.deviceId = body.device_id || null;
  result.sdkVersion = body.sdk_version || null;
  result.device = (body.device && typeof body.device === 'object') ? body.device : null;

  const rawEvents = Array.isArray(body.events) ? body.events : [];

  result.events = rawEvents.map(ev => {
    const type = typeof ev.name === 'string' ? ev.name : '';
    const data = (ev.data && typeof ev.data === 'object') ? ev.data : {};

    let eventName;
    let properties = {};

    if (type === 'ce') {
      // Custom event: data.n = name, data.p = properties.
      eventName = (typeof data.n === 'string' && data.n) ? data.n : 'Custom Event';
      properties = (data.p && typeof data.p === 'object') ? data.p : {};
    } else if (type === 'p') {
      eventName = 'Purchase';
      properties = data;
    } else if (BRAZE_EVENT_TYPES[type]) {
      eventName = BRAZE_EVENT_TYPES[type];
      properties = data;
    } else {
      // Unknown internal type — surface the raw code rather than guess.
      eventName = type ? `Braze Event (${type})` : 'Braze Event';
      properties = data;
    }

    return {
      eventType: type,
      eventName,
      properties,
      sessionId: ev.session_id || null,
      time: ev.time || null,
      rawEvent: ev
    };
  });

  return result;
}

/**
 * Build the grouped "Parsed Data" object (system/protocol fields) for a Braze
 * event. Returns a `{ 'Group': { 'Label (param)': value } }` object suitable for
 * `formatted.params` with `parsedDisplayMode: 'table'`.
 * @param {Object} event - a normalized event from parseBrazeRequestData().events
 * @param {Object} ctx - request-level context { apiKey, deviceId, sdkVersion, device }
 * @returns {Object}
 */
export function buildBrazeGroupedParams(event, ctx) {
  const params = {};

  const session = {};
  if (event.sessionId) session['Session ID (session_id)'] = event.sessionId;
  if (event.time) session['Event Time (time)'] = event.time;
  if (event.eventType) session['Event Type (name)'] = event.eventType;
  if (Object.keys(session).length > 0) params['Session'] = session;

  const dev = ctx.device || {};
  const device = {};
  if (dev.browser) device['Browser (browser)'] = dev.browser;
  if (dev.browser_version) device['Browser Version (browser_version)'] = dev.browser_version;
  if (dev.os_version) device['OS (os_version)'] = dev.os_version;
  if (dev.resolution) device['Resolution (resolution)'] = dev.resolution;
  if (dev.locale) device['Locale (locale)'] = dev.locale;
  if (dev.time_zone) device['Time Zone (time_zone)'] = dev.time_zone;
  if (Object.keys(device).length > 0) params['Device'] = device;

  const sdk = {};
  if (ctx.apiKey) sdk['API Key (api_key)'] = ctx.apiKey;
  if (ctx.deviceId) sdk['Device ID (device_id)'] = ctx.deviceId;
  if (ctx.sdkVersion) sdk['SDK Version (sdk_version)'] = ctx.sdkVersion;
  if (Object.keys(sdk).length > 0) params['SDK'] = sdk;

  return params;
}
