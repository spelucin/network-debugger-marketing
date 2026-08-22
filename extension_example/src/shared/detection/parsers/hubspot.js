// HubSpot Tracking Code Parsing Utilities
// Extracts event data from track.hubspot.com/__ptq.gif and __ptbe.gif requests

/**
 * Parse a HubSpot tracking request and return structured event data
 * @param {string} url - Request URL
 * @returns {Object} Parsed HubSpot data
 */
export function parseHubSpotData(url) {
  const urlObj = new URL(url);
  const params = Object.fromEntries(urlObj.searchParams);

  // Determine event type from the endpoint path
  const isBehavioral = urlObj.pathname.includes('__ptbe');
  const eventName = isBehavioral ? 'Behavioral Event' : 'PageView';

  const hubId = params.a;

  // Build overview
  const overview = {};
  if (hubId) overview['Hub ID'] = hubId;
  if (params.t) overview['Page Title'] = params.t;
  if (params.nc === 'true' || params.nc === '1') overview['New Contact'] = 'Yes';

  // --- Grouped Parsed Data (system/protocol params) ---
  const groupedParams = {};

  // Identity
  const identity = {};
  if (hubId) identity['Hub ID (a)'] = hubId;
  if (params.vi) identity['Visitor ID (vi)'] = params.vi;
  if (params.u) identity['User Token / hubspotutk (u)'] = params.u;
  if (params.k) identity['Tracking Key (k)'] = params.k;
  if (params.nc) identity['New Contact (nc)'] = params.nc;
  if (params.b) identity['Identity Data (b)'] = params.b;
  if (params.i) identity['Identity Info (i)'] = params.i;
  if (params.bfp) identity['Browser Fingerprint (bfp)'] = params.bfp;
  if (Object.keys(identity).length > 0) {
    groupedParams['Identity'] = identity;
  }

  // Page Context
  const pageContext = {};
  if (params.pu) pageContext['Page URL (pu)'] = params.pu;
  if (params.t) pageContext['Page Title (t)'] = params.t;
  if (params.r) pageContext['Referrer (r)'] = params.r;
  if (params.ln) pageContext['Language (ln)'] = params.ln;
  if (params.cs) pageContext['Charset (cs)'] = params.cs;
  if (Object.keys(pageContext).length > 0) {
    groupedParams['Page Context'] = pageContext;
  }

  // Device
  const device = {};
  if (params.sd) device['Screen Dimensions (sd)'] = params.sd;
  if (params.cd) device['Color Depth (cd)'] = params.cd;
  if (Object.keys(device).length > 0) {
    groupedParams['Device'] = device;
  }

  // Timing
  const timing = {};
  if (params.cts) timing['Client Timestamp (cts)'] = params.cts;
  if (Object.keys(timing).length > 0) {
    groupedParams['Timing'] = timing;
  }

  // Request
  const requestData = {};
  if (params.v) requestData['Version (v)'] = params.v;
  if (params.ce) requestData['Campaign Enabled (ce)'] = params.ce;
  if (Object.keys(requestData).length > 0) {
    groupedParams['Request'] = requestData;
  }

  // Collect any remaining params not already categorized
  const knownParams = new Set(['a', 'vi', 'u', 'k', 'nc', 'b', 'i', 'bfp', 'pu', 't', 'r', 'ln', 'cs', 'sd', 'cd', 'cts', 'v', 'ce']);
  const otherParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (!knownParams.has(key)) {
      otherParams[key] = value;
    }
  }
  if (Object.keys(otherParams).length > 0) {
    groupedParams['Other'] = otherParams;
  }

  const detectedBy = urlObj.pathname.includes('__ptbe')
    ? 'URL contains track.hubspot.com/__ptbe.gif'
    : 'URL contains track.hubspot.com/__ptq.gif';

  return {
    eventName,
    hubId,
    overview,
    groupedParams,
    params,
    detectedBy
  };
}
