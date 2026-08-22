// Snapchat Pixel Parsing Utilities
// Extracts event data from Snap Pixel requests (tr.snapchat.com, tr6.snapchat.com)
// Docs: https://developers.snap.com/api/marketing-api/Ads-API/snap-pixel

/**
 * Documented event parameter keys (from snaptr('track', EVENT, { ... }))
 * These are user-set business data → go into Custom Data section
 */
const EVENT_PARAM_KEYS = new Set([
  'currency', 'price', 'transaction_id', 'item_ids', 'item_category',
  'number_items', 'description', 'search_string', 'sign_up_method',
  'success', 'payment_info_available'
]);

/**
 * Documented ctx fields where meaning is verified
 */
const KNOWN_CTX_FIELDS = {
  url: 'Page URL',
  ua: 'User Agent',
  sw: 'Screen Width',
  sh: 'Screen Height',
  v: 'SDK Version',
  ts: 'Timestamp',
  pv: 'Page Views',
  d_ot: 'OS Type',
  d_os: 'OS Version',
  d_a: 'Architecture',
  d_bvs: 'Browser Versions',
};

/**
 * ctx fields used in named groups (so we don't duplicate them in "Other")
 */
const GROUPED_CTX_FIELDS = new Set([
  'url', 'ua', 'sw', 'sh', 'v', 'ts', 'pv',
  'd_ot', 'd_os', 'd_a', 'd_bvs',
  'ss',
]);

/**
 * Parse a Snapchat Pixel request and return structured event data
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body (JSON)
 * @returns {Object} Parsed Snapchat data
 */
export function parseSnapchatPixelData(url, postData = null) {
  const urlObj = new URL(url);
  const urlParams = Object.fromEntries(urlObj.searchParams);

  // Parse JSON body
  let body = null;
  if (postData) {
    try {
      body = JSON.parse(postData);
    } catch (e) {
      // Not valid JSON
    }
  }

  const ctx = body?.ctx || {};
  const req = body?.req || [];

  // Extract pixel ID from req entries or URL params
  let pixelId = urlParams.pid || urlParams.id;
  if (!pixelId && req.length > 0 && req[0]?.i?.pids?.length > 0) {
    pixelId = req[0].i.pids[0];
  }

  // Extract event name
  const eventName = urlParams.ev || body?.ev || body?.event_type || ctx.ev || 'PAGE_VIEW';

  // Build overview
  const overview = {};
  if (pixelId) overview['Pixel ID'] = pixelId;
  if (ctx.v) overview['SDK Version'] = ctx.v;

  // --- Custom Data: documented event parameters ---
  const customData = {};
  const eventParams = {};

  // Check URL params for event data
  for (const key of EVENT_PARAM_KEYS) {
    if (urlParams[key] !== undefined) {
      eventParams[key] = urlParams[key];
    }
  }
  // Check body for event data
  if (body) {
    for (const key of EVENT_PARAM_KEYS) {
      if (body[key] !== undefined) {
        eventParams[key] = body[key];
      }
    }
  }
  if (Object.keys(eventParams).length > 0) {
    customData['Event Parameters'] = eventParams;
  }

  // --- Grouped Parsed Data ---
  const groupedParams = {};

  // Page Context (documented fields only)
  const pageContext = {};
  if (ctx.url) pageContext['Page URL (ctx.url)'] = ctx.url;
  if (ctx.ua) pageContext['User Agent (ctx.ua)'] = ctx.ua;
  if (ctx.sw) pageContext['Screen Width (ctx.sw)'] = ctx.sw;
  if (ctx.sh) pageContext['Screen Height (ctx.sh)'] = ctx.sh;
  if (ctx.pv != null) pageContext['Page Views (ctx.pv)'] = ctx.pv;
  if (Object.keys(pageContext).length > 0) {
    groupedParams['Page Context'] = pageContext;
  }

  // Identity
  const identity = {};
  if (pixelId) identity['Pixel ID'] = pixelId;
  // Show all pixel IDs if multiple
  if (req.length > 0) {
    const allPids = req.flatMap(r => r?.i?.pids || []);
    if (allPids.length > 1) {
      identity['All Pixel IDs'] = allPids.join(', ');
    }
  }
  const sessionId = body?.u_scsid || ctx.ss;
  if (sessionId) identity['Session ID (u_scsid)'] = sessionId;
  if (Object.keys(identity).length > 0) {
    groupedParams['Identity'] = identity;
  }

  // Device (documented fields)
  const deviceData = {};
  if (ctx.d_ot) deviceData['OS Type (ctx.d_ot)'] = ctx.d_ot;
  if (ctx.d_os) deviceData['OS Version (ctx.d_os)'] = ctx.d_os;
  if (ctx.d_a) deviceData['Architecture (ctx.d_a)'] = ctx.d_a;
  if (ctx.d_bvs) deviceData['Browser Versions (ctx.d_bvs)'] = ctx.d_bvs;
  if (Object.keys(deviceData).length > 0) {
    groupedParams['Device'] = deviceData;
  }

  // Request
  const requestData = {};
  if (ctx.v) requestData['SDK Version (ctx.v)'] = ctx.v;
  if (ctx.ts) requestData['Timestamp (ctx.ts)'] = ctx.ts;
  if (Object.keys(requestData).length > 0) {
    groupedParams['Request'] = requestData;
  }

  // Other ctx fields — undocumented, show with raw keys (no translation)
  const otherCtx = {};
  for (const [key, value] of Object.entries(ctx)) {
    if (!GROUPED_CTX_FIELDS.has(key) && value !== undefined && value !== null) {
      otherCtx[`ctx.${key}`] = value;
    }
  }
  if (Object.keys(otherCtx).length > 0) {
    groupedParams['Other Context'] = otherCtx;
  }

  // Determine detection reason
  let detectedBy = 'URL matches Snapchat Pixel pattern';
  if (urlObj.hostname.includes('tr.snapchat.com')) {
    detectedBy = 'URL contains tr.snapchat.com';
  } else if (urlObj.hostname.includes('tr6.snapchat.com')) {
    detectedBy = 'URL contains tr6.snapchat.com';
  } else if (url.includes('sc-static.net/scevent')) {
    detectedBy = 'URL contains sc-static.net/scevent';
  }

  return {
    eventName,
    pixelId,
    overview,
    customData,
    groupedParams,
    rawParams: urlParams,
    postData: body,
    detectedBy
  };
}
