// LinkedIn Insight Tag Parsing Utilities
// Extracts event data from LinkedIn px.ads.linkedin.com requests

/**
 * Parse a LinkedIn Insight Tag request and return structured event data
 * @param {string} url - Request URL
 * @returns {Object} Parsed LinkedIn data
 */
export function parseLinkedInPixelData(url) {
  const urlObj = new URL(url);
  const params = Object.fromEntries(urlObj.searchParams);

  const partnerId = params.pid;
  const conversionId = params.conversionId || params.conversion_id;
  const eventName = conversionId ? `Conversion ${conversionId}` : 'PageView';

  // Build overview with human-readable labels
  const overview = {};
  if (partnerId) overview['Partner ID'] = partnerId;
  if (conversionId) overview['Conversion ID'] = conversionId;
  if (params.li_fat_id) overview['First-Party Ad Tracking'] = params.li_fat_id;

  // --- Grouped Parsed Data (system/protocol params) ---
  const groupedParams = {};

  // Conversion
  const conversionData = {};
  if (conversionId) conversionData['Conversion ID (conversionId)'] = conversionId;
  if (params.fmt) conversionData['Format (fmt)'] = params.fmt;
  if (Object.keys(conversionData).length > 0) {
    groupedParams['Conversion'] = conversionData;
  }

  // Identity
  const identity = {};
  if (partnerId) identity['Partner ID (pid)'] = partnerId;
  if (params.li_fat_id) identity['First-Party Ad Tracking (li_fat_id)'] = params.li_fat_id;
  if (params.li_sugr) identity['Suggested User (li_sugr)'] = params.li_sugr;
  if (params.cpuid) identity['CPUID (cpuid)'] = params.cpuid;
  if (Object.keys(identity).length > 0) {
    groupedParams['Identity'] = identity;
  }

  // Request
  const requestData = {};
  if (params.v) requestData['Version (v)'] = params.v;
  if (params.time) requestData['Timestamp (time)'] = params.time;
  if (params.url) requestData['Page URL (url)'] = params.url;
  if (params.bs) requestData['Browser Signal (bs)'] = params.bs;
  if (params.aero) requestData['Aero (aero)'] = params.aero;
  if (params.csid) requestData['Client Session ID (csid)'] = params.csid;
  if (params.callback) requestData['Callback (callback)'] = params.callback;
  if (Object.keys(requestData).length > 0) {
    groupedParams['Request'] = requestData;
  }

  const detectedBy = urlObj.hostname.includes('px.ads.linkedin.com')
    ? 'URL contains px.ads.linkedin.com'
    : 'URL contains linkedin.com/px';

  return {
    eventName,
    partnerId,
    conversionId,
    overview,
    groupedParams,
    params,
    detectedBy
  };
}
