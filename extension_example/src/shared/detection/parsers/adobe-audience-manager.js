// Adobe Audience Manager (AAM / Demdex) Parsing Utilities
// Extracts event data from AAM DCS and DPM requests (demdex.net)

/**
 * Determine the request type from the URL path
 * @param {URL} urlObj - Parsed URL object
 * @returns {string} Human-readable request type
 */
function getAAMRequestType(urlObj) {
  const path = urlObj.pathname;

  if (path.startsWith('/id')) return 'ID Sync';
  if (path.startsWith('/event')) return 'Event';
  if (path.startsWith('/ibs:') || path.includes('/ibs')) return 'Inbound ID Sync';
  if (path.endsWith('/demconf.jpg')) return 'Configuration';
  if (path.startsWith('/dest')) return 'Destination';

  return 'Request';
}

/**
 * Parse Adobe Audience Manager request and return structured event data
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body data (usually null for AAM)
 * @returns {Object} Parsed AAM data
 */
export function parseAdobeAAMRequestData(url, postData = null) {
  const urlObj = new URL(url);
  const params = Object.fromEntries(urlObj.searchParams);

  // /ibs: requests encode their data in the path (after the colon), not the query string.
  // Shape: /ibs:dpid=123&dpuuid=abc&d_uuid=xyz — parse the colon-suffix as URLSearchParams,
  // then normalize the short-form keys (dpid/dpuuid) to their d_* equivalents so the
  // standard Identifiers grouping picks them up.
  const ibsMatch = urlObj.pathname.match(/^\/ibs[:/](.+)$/);
  if (ibsMatch) {
    try {
      const ibsParams = new URLSearchParams(ibsMatch[1]);
      for (const [key, value] of ibsParams) {
        if (key === 'dpid' && !params.d_dpid) params.d_dpid = value;
        else if (key === 'dpuuid' && !params.d_dpuuid) params.d_dpuuid = value;
        else if (!(key in params)) params[key] = value;
      }
    } catch (e) {
      // If parsing fails, fall through to standard query-only behaviour
    }
  }

  // Merge POST body params if present
  if (postData && typeof postData === 'string') {
    try {
      const postParams = new URLSearchParams(postData);
      for (const [key, value] of postParams) {
        params[key] = value;
      }
    } catch (e) {
      // If parsing fails, skip POST data
    }
  }

  // Determine request type from path
  const requestType = getAAMRequestType(urlObj);

  // Build event name
  const fieldGroup = params.d_fieldgroup;
  let eventName = requestType;
  if (fieldGroup) {
    eventName = `${requestType} (${fieldGroup})`;
  }

  // Build overview
  const overview = {};
  if (params.d_orgid) overview['Org ID'] = params.d_orgid;
  if (params.d_mid) overview['Marketing Cloud ID'] = params.d_mid;
  overview['Request Type'] = requestType;
  if (params.d_dpid) overview['Data Provider ID'] = params.d_dpid;

  // Build sections (standard layout)
  const sections = [];

  // 2. Custom Data — key-value pairs for trait qualification (c_key=value)
  const traitData = {};
  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith('c_')) {
      traitData[key.substring(2)] = value;
    }
  }
  if (Object.keys(traitData).length > 0) {
    sections.push({ title: 'Custom Data', data: { 'Trait Key-Values (c_)': traitData }, type: 'table' });
  }

  // 4. Parsed Data — system/protocol data as grouped params
  const groupedParams = {};

  // Identifiers group
  const identifiers = {};
  if (params.d_mid) identifiers['Marketing Cloud ID (d_mid)'] = params.d_mid;
  if (params.d_uuid) identifiers['Demdex UUID (d_uuid)'] = params.d_uuid;
  if (params.d_orgid) identifiers['Org ID (d_orgid)'] = params.d_orgid;
  if (params.d_dpid) identifiers['Data Provider ID (d_dpid)'] = params.d_dpid;
  if (params.d_dpuuid) identifiers['Data Provider UUID (d_dpuuid)'] = params.d_dpuuid;
  if (params.d_cid) identifiers['Customer ID (d_cid)'] = params.d_cid;
  if (params.d_cid_ic) identifiers['CID Integration Code (d_cid_ic)'] = params.d_cid_ic;
  if (params.d_sid) identifiers['Segment ID (d_sid)'] = params.d_sid;
  if (Object.keys(identifiers).length > 0) {
    groupedParams['Identifiers'] = identifiers;
  }

  // Request group
  const requestData = {};
  if (params.d_ver) requestData['API Version (d_ver)'] = params.d_ver;
  if (params.d_rtbd) requestData['Return Type (d_rtbd)'] = params.d_rtbd;
  if (params.d_nsid) requestData['Namespace ID (d_nsid)'] = params.d_nsid;
  if (params.d_fieldgroup) requestData['Field Group (d_fieldgroup)'] = params.d_fieldgroup;
  if (params.d_visid_ver) requestData['Visitor ID Version (d_visid_ver)'] = params.d_visid_ver;
  if (params.d_ptfm) requestData['Platform (d_ptfm)'] = params.d_ptfm;
  if (params.d_dst) requestData['Destination Flag (d_dst)'] = params.d_dst;
  if (params.d_cb) requestData['Callback (d_cb)'] = params.d_cb;
  if (params.d_region) requestData['DCS Region (d_region)'] = params.d_region;
  if (params.dcs_region) requestData['DCS Region Hint (dcs_region)'] = params.dcs_region;
  if (params.d_blob) requestData['Blob (d_blob)'] = params.d_blob;
  if (Object.keys(requestData).length > 0) {
    groupedParams['Request'] = requestData;
  }

  // Timing group
  const timing = {};
  if (params.ts) timing['Timestamp (ts)'] = params.ts;
  if (params.d_cts) timing['Client Timestamp (d_cts)'] = params.d_cts;
  if (params.d_ld) timing['Last Date (d_ld)'] = params.d_ld;
  if (Object.keys(timing).length > 0) {
    groupedParams['Timing'] = timing;
  }

  return {
    eventName,
    overview,
    params: groupedParams,
    parsedDisplayMode: 'table',
    sections,
    rawParams: params
  };
}
