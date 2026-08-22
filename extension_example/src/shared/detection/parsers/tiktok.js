// TikTok Pixel Parsing Utilities
// Extracts event data from TikTok analytics requests

/**
 * Parse a TikTok Pixel request and return structured event data
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text
 * @returns {Object} Parsed TikTok data
 */
export function parseTikTokPixelData(url, postData) {
  const urlObj = new URL(url);
  const params = Object.fromEntries(urlObj.searchParams);

  // TikTok sends data via POST body (JSON)
  let body = null;
  if (postData) {
    try {
      body = JSON.parse(postData);
    } catch (e) {
      // Not JSON, try to parse as URL-encoded
      try {
        body = Object.fromEntries(new URLSearchParams(postData));
      } catch (e2) {
        // Keep as null
      }
    }
  }

  // Extract pixel code from params or POST body context
  const pixelCode = params.sdkid || params.pixel_code || body?.context?.pixel?.code;

  // Extract event name - TikTok uses 'action' field in POST body
  const eventName = params.event || body?.action || body?.event || 'PageView';

  const eventId = body?.event_id || body?.message_id || params.event_id;

  // Build overview with human-readable labels
  const overview = {};
  if (pixelCode) overview['Pixel Code'] = pixelCode;
  if (eventId) overview['Event ID'] = eventId;

  // --- Custom Data: event properties (user-defined business data) ---
  const customData = {};
  const properties = body?.properties;
  if (properties && typeof properties === 'object' && Object.keys(properties).length > 0) {
    customData['Event Properties'] = properties;
  }

  // --- Grouped Parsed Data (system/protocol params) ---
  const groupedParams = {};

  // Page Context
  const pageContext = {};
  const page = body?.context?.page;
  if (page) {
    if (page.url) pageContext['Page URL (context.page.url)'] = page.url;
    if (page.referrer) pageContext['Referrer (context.page.referrer)'] = page.referrer;
    if (page.title) pageContext['Page Title (context.page.title)'] = page.title;
  }
  if (Object.keys(pageContext).length > 0) {
    groupedParams['Page Context'] = pageContext;
  }

  // Identity
  const identity = {};
  if (pixelCode) identity['Pixel Code (sdkid)'] = pixelCode;
  const user = body?.context?.user;
  if (user && typeof user === 'object') {
    if (user.external_id) identity['External ID (context.user.external_id)'] = user.external_id;
    if (user.email) identity['Email Hash (context.user.email)'] = user.email;
    if (user.phone_number) identity['Phone Hash (context.user.phone_number)'] = user.phone_number;
    // Include any other user fields
    for (const [key, value] of Object.entries(user)) {
      if (!['external_id', 'email', 'phone_number'].includes(key) && value) {
        identity[`User ${key} (context.user.${key})`] = value;
      }
    }
  }
  if (Object.keys(identity).length > 0) {
    groupedParams['Identity'] = identity;
  }

  // Device
  const deviceData = {};
  const ad = body?.context?.ad;
  if (ad && typeof ad === 'object') {
    if (ad.callback) deviceData['Click ID (context.ad.callback)'] = ad.callback;
  }
  const pixel = body?.context?.pixel;
  if (pixel && typeof pixel === 'object') {
    if (pixel.code) deviceData['Pixel Code (context.pixel.code)'] = pixel.code;
  }
  const library = body?.context?.library;
  if (library && typeof library === 'object') {
    if (library.name) deviceData['Library (context.library.name)'] = library.name;
    if (library.version) deviceData['Library Version (context.library.version)'] = library.version;
  }
  if (params.uach) deviceData['UA-CH (uach)'] = params.uach;
  if (Object.keys(deviceData).length > 0) {
    groupedParams['Device'] = deviceData;
  }

  // Request
  const requestData = {};
  if (params.sdkid) requestData['SDK ID (sdkid)'] = params.sdkid;
  if (params.lib) requestData['Library (lib)'] = params.lib;
  if (params.v) requestData['SDK Version (v)'] = params.v;
  if (body?.type) requestData['Type (type)'] = body.type;
  if (eventId) requestData['Event ID (event_id)'] = eventId;
  if (body?.message_id) requestData['Message ID (message_id)'] = body.message_id;
  if (body?.timestamp) requestData['Timestamp (timestamp)'] = body.timestamp;
  if (body?.batch) requestData['Batch (batch)'] = body.batch;
  if (Object.keys(requestData).length > 0) {
    groupedParams['Request'] = requestData;
  }

  // Determine detection reason
  const detectedBy = urlObj.hostname.includes('analytics.tiktok.com')
    ? 'URL contains analytics.tiktok.com'
    : 'URL contains tiktok.com/i18n/pixel';

  return {
    eventName,
    pixelCode,
    eventId,
    overview,
    customData,
    groupedParams,
    rawParams: params,
    postData: body,
    detectedBy
  };
}
