// Facebook Pixel Parsing Utilities
// Extracts event data from Facebook Pixel /tr requests

/**
 * System params that belong in Parsed Data groups (not Custom Data).
 * Any param NOT in this set and NOT extracted into a named section
 * is left in the flat remainingParams for the Raw Request view.
 */
const SYSTEM_PARAMS = new Set([
  'id', 'ev', 'dl', 'rl', 'if', 'sw', 'sh',
  'fbp', 'fbc', 'uid', 'external_id',
  'v', 'a', 'eid', 'ts', 'it', 'cbt', 'rqm', 'noscript', 'coo',
  'ec', 'ea', 'el', 'ev',
  'ud',
]);

/**
 * Parse a Facebook Pixel request and return structured event data
 * @param {string} url - Request URL
 * @returns {Object} Parsed Facebook Pixel data
 */
export function parseFacebookPixelData(url) {
  const urlObj = new URL(url);
  const params = Object.fromEntries(urlObj.searchParams);

  const pixelId = params.id;
  const eventName = params.ev || 'PageView';

  // Build params: start flat, then reconstruct nested objects from two formats:
  // 1. JSON-encoded string:    cd={"currency":"DKK"}  → params.cd = { currency: "DKK" }
  // 2. Bracket notation:       cd[currency]=DKK       → params.cd = { currency: "DKK" }
  const parsedParams = {};
  const nested = {};  // accumulated bracket-notation groups

  for (const [key, value] of Object.entries(params)) {
    const bracketMatch = key.match(/^([^\[]+)\[([^\]]+)\]$/);
    if (bracketMatch) {
      const parentKey = bracketMatch[1];
      const childKey = bracketMatch[2];
      if (!nested[parentKey]) nested[parentKey] = {};
      nested[parentKey][childKey] = value;
    } else {
      parsedParams[key] = value;
    }
  }

  // Merge bracket groups into parsedParams
  for (const [key, obj] of Object.entries(nested)) {
    parsedParams[key] = obj;
  }

  // Also handle JSON-encoded cd string (overrides bracket notation if present)
  if (typeof parsedParams.cd === 'string') {
    try {
      parsedParams.cd = JSON.parse(parsedParams.cd);
    } catch (e) {
      // Keep as string
    }
  }

  // Build overview with human-readable labels
  const overview = {};
  if (pixelId) overview['Pixel ID'] = pixelId;
  if (params.fbp) overview['Browser ID'] = params.fbp;
  if (params.fbc) overview['Click ID'] = params.fbc;

  // --- Custom Data sections ---
  const customData = {};
  if (parsedParams.cd && typeof parsedParams.cd === 'object') {
    customData['Custom Data'] = parsedParams.cd;
  }
  if (parsedParams.pmd && typeof parsedParams.pmd === 'object') {
    customData['Page Metadata'] = parsedParams.pmd;
  }

  // --- Grouped Parsed Data (system/protocol params) ---
  const groupedParams = {};

  // Page Context
  const pageContext = {};
  if (parsedParams.dl) pageContext['Document Location (dl)'] = parsedParams.dl;
  if (parsedParams.rl) pageContext['Referrer (rl)'] = parsedParams.rl;
  if (parsedParams.if) pageContext['In iFrame (if)'] = parsedParams.if;
  if (parsedParams.sw) pageContext['Screen Width (sw)'] = parsedParams.sw;
  if (parsedParams.sh) pageContext['Screen Height (sh)'] = parsedParams.sh;
  if (Object.keys(pageContext).length > 0) {
    groupedParams['Page Context'] = pageContext;
  }

  // Identity
  const identity = {};
  if (pixelId) identity['Pixel ID (id)'] = pixelId;
  if (parsedParams.fbp) identity['Browser ID (fbp)'] = parsedParams.fbp;
  if (parsedParams.fbc) identity['Click ID (fbc)'] = parsedParams.fbc;
  if (parsedParams.uid) identity['User ID (uid)'] = parsedParams.uid;
  if (parsedParams.external_id) identity['External ID (external_id)'] = parsedParams.external_id;
  // User data hashes (ud[...] bracket-notation fields)
  if (parsedParams.ud && typeof parsedParams.ud === 'object') {
    for (const [key, value] of Object.entries(parsedParams.ud)) {
      identity[`User Data (ud.${key})`] = value;
    }
  }
  if (Object.keys(identity).length > 0) {
    groupedParams['Identity'] = identity;
  }

  // Request
  const requestData = {};
  if (parsedParams.v) requestData['SDK Version (v)'] = parsedParams.v;
  if (parsedParams.a) requestData['Agent (a)'] = parsedParams.a;
  if (parsedParams.eid) requestData['Event ID (eid)'] = parsedParams.eid;
  if (parsedParams.ts) requestData['Timestamp (ts)'] = parsedParams.ts;
  if (parsedParams.it) requestData['Init Time (it)'] = parsedParams.it;
  if (parsedParams.cbt) requestData['Content Block Time (cbt)'] = parsedParams.cbt;
  if (parsedParams.rqm) requestData['Request Method (rqm)'] = parsedParams.rqm;
  if (parsedParams.noscript) requestData['No Script (noscript)'] = parsedParams.noscript;
  if (parsedParams.coo) requestData['Cookie Opt-Out (coo)'] = parsedParams.coo;
  if (Object.keys(requestData).length > 0) {
    groupedParams['Request'] = requestData;
  }

  // Determine detection reason
  const detectedBy = urlObj.hostname.includes('facebook.com')
    ? 'URL contains facebook.com/tr'
    : 'URL contains facebook.net/tr';

  return {
    eventName,
    pixelId,
    overview,
    customData,
    groupedParams,
    params: parsedParams,
    rawParams: Object.fromEntries(urlObj.searchParams),
    detectedBy
  };
}
