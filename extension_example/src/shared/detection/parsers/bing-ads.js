// Bing/Microsoft UET (Universal Event Tracking) Parsing Utilities
// Extracts event data from bat.bing.com requests

/**
 * Parse a Bing UET request and return structured event data
 * @param {string} url - Request URL
 * @returns {Object} Parsed Bing UET data
 */
export function parseBingAdsData(url) {
  const urlObj = new URL(url);
  const params = Object.fromEntries(urlObj.searchParams);

  // Event name: 'evt' for custom events, or fall back to 'ea' (event action)
  const eventName = params.evt || params.ea || 'PageLoad';

  const tagId = params.ti;

  // Build overview
  const overview = {};
  if (tagId) overview['Tag ID'] = tagId;
  if (params.evt && params.evt !== 'pageLoad') overview['Event'] = params.evt;
  if (params.gv) overview['Goal Value'] = params.gv;
  if (params.ev) overview['Event Value'] = params.ev;
  if (params.msclkid) overview['Microsoft Click ID'] = params.msclkid;

  // --- Custom Data: e-commerce params (user-defined business data) ---
  const customData = {};
  const ecommFields = {};
  if (params.pagetype || params.ecomm_pagetype) ecommFields['Page Type (ecomm_pagetype)'] = params.pagetype || params.ecomm_pagetype;
  if (params.ecomm_prodid) ecommFields['Product ID (ecomm_prodid)'] = params.ecomm_prodid;
  if (params.ecomm_query) ecommFields['Search Query (ecomm_query)'] = params.ecomm_query;
  if (params.ecomm_category) ecommFields['Category (ecomm_category)'] = params.ecomm_category;
  if (params.ecomm_totalvalue) ecommFields['Total Value (ecomm_totalvalue)'] = params.ecomm_totalvalue;
  if (params.currency) ecommFields['Currency (currency)'] = params.currency;
  if (params.transaction_id) ecommFields['Transaction ID (transaction_id)'] = params.transaction_id;
  if (params.items) ecommFields['Items (items)'] = params.items;
  if (Object.keys(ecommFields).length > 0) {
    customData['E-Commerce'] = ecommFields;
  }

  // --- Grouped Parsed Data (system/protocol params) ---
  const groupedParams = {};

  // Conversion
  const conversion = {};
  if (params.ec) conversion['Event Category (ec)'] = params.ec;
  if (params.ea) conversion['Event Action (ea)'] = params.ea;
  if (params.el) conversion['Event Label (el)'] = params.el;
  if (params.ev) conversion['Event Value (ev)'] = params.ev;
  if (params.gv) conversion['Goal Value (gv)'] = params.gv;
  if (params.gc) conversion['Goal Currency (gc)'] = params.gc;
  if (Object.keys(conversion).length > 0) {
    groupedParams['Conversion'] = conversion;
  }

  // Identity
  const identity = {};
  if (tagId) identity['Tag ID (ti)'] = tagId;
  if (params.msclkid) identity['Microsoft Click ID (msclkid)'] = params.msclkid;
  if (params.mid) identity['Microsoft ID (mid)'] = params.mid;
  if (Object.keys(identity).length > 0) {
    groupedParams['Identity'] = identity;
  }

  // Page Context
  const pageContext = {};
  if (params.p) pageContext['Page URL (p)'] = params.p;
  if (params.r) pageContext['Referrer (r)'] = params.r;
  if (params.tl) pageContext['Page Title (tl)'] = params.tl;
  if (Object.keys(pageContext).length > 0) {
    groupedParams['Page Context'] = pageContext;
  }

  // Device
  const device = {};
  if (params.res) device['Screen Resolution (res)'] = params.res;
  if (params.lt) device['Load Time (lt)'] = params.lt;
  if (params.kn) device['Cookies Enabled (kn)'] = params.kn;
  if (params.je) device['Java Enabled (je)'] = params.je;
  if (Object.keys(device).length > 0) {
    groupedParams['Device'] = device;
  }

  // Request
  const requestData = {};
  if (params.Ver) requestData['Version (Ver)'] = params.Ver;
  if (params.rn) requestData['Random Number (rn)'] = params.rn;
  if (params.spa) requestData['SPA Navigation (spa)'] = params.spa;
  if (params.stg) requestData['Staging (stg)'] = params.stg;
  if (Object.keys(requestData).length > 0) {
    groupedParams['Request'] = requestData;
  }

  const detectedBy = url.includes('bat.bing.com')
    ? 'URL contains bat.bing.com'
    : url.includes('bat.r.msn.com')
      ? 'URL contains bat.r.msn.com'
      : 'URL matches Bing Ads pattern';

  return {
    eventName,
    tagId,
    overview,
    customData,
    groupedParams,
    params,
    detectedBy
  };
}
