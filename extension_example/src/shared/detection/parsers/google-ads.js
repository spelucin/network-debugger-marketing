// Google Ads Parsing Utilities
// Extracts event data from Google Ads Conversion and Remarketing requests

/**
 * Consent params handled by the consent section — exclude from Parsed Data
 */
const CONSENT_PARAMS = new Set(['gcs', 'gcd', 'npa', 'dma', 'dma_cps']);

/**
 * Build grouped params for Google Ads requests (shared between conversion & remarketing)
 * @param {Object} params - Raw URL query params
 * @returns {Object} Grouped params object for parsedDisplayMode: 'table'
 */
function buildGoogleAdsGroupedParams(params) {
  const groupedParams = {};

  // Conversion Data
  const conversionData = {};
  if (params.label) conversionData['Label (label)'] = params.label;
  if (params.l && !params.label) conversionData['Label (l)'] = params.l;
  if (params.value) conversionData['Value (value)'] = params.value;
  if (params.currency) conversionData['Currency (currency)'] = params.currency;
  if (params.oid) conversionData['Order ID (oid)'] = params.oid;
  if (params.tiba) conversionData['Page Title (tiba)'] = params.tiba;
  if (params.ec_mode) conversionData['Enhanced Conversions (ec_mode)'] = params.ec_mode;
  if (Object.keys(conversionData).length > 0) {
    groupedParams['Conversion'] = conversionData;
  }

  // Identity
  const identity = {};
  if (params.auid) identity['Analytics UID (auid)'] = params.auid;
  if (params.ct_cookie_present) identity['Cookie Present (ct_cookie_present)'] = params.ct_cookie_present;
  if (params.ltmid) identity['LT Match ID (ltmid)'] = params.ltmid;
  if (params.guid) identity['GUID (guid)'] = params.guid;
  if (params.gclaw) identity['Click ID (gclaw)'] = params.gclaw;
  if (params.gcldc) identity['Display Click (gcldc)'] = params.gcldc;
  if (params.gac) identity['Analytics Cookie (gac)'] = params.gac;
  if (Object.keys(identity).length > 0) {
    groupedParams['Identity'] = identity;
  }

  // User Agent Hints (Chrome UA-CH)
  const uaHints = {};
  if (params.uaa) uaHints['Architecture (uaa)'] = params.uaa;
  if (params.uab) uaHints['Bitness (uab)'] = params.uab;
  if (params.uafvl) uaHints['Full Version List (uafvl)'] = params.uafvl;
  if (params.uamb) uaHints['Mobile (uamb)'] = params.uamb;
  if (params.uam) uaHints['Model (uam)'] = params.uam;
  if (params.uap) uaHints['Platform (uap)'] = params.uap;
  if (params.uapv) uaHints['Platform Version (uapv)'] = params.uapv;
  if (params.uaw) uaHints['WoW64 (uaw)'] = params.uaw;
  if (Object.keys(uaHints).length > 0) {
    groupedParams['User Agent'] = uaHints;
  }

  // Request
  const requestData = {};
  if (params.fst) requestData['First Send Time (fst)'] = params.fst;
  if (params.frm) requestData['Frame (frm)'] = params.frm;
  if (params.gtm) requestData['GTM Hash (gtm)'] = params.gtm;
  if (params.sendb) requestData['Send Beacon (sendb)'] = params.sendb;
  if (params.bg) requestData['Background (bg)'] = params.bg;
  if (params.ptt) requestData['Page Tag Type (ptt)'] = params.ptt;
  if (params.fmt) requestData['Format (fmt)'] = params.fmt;
  if (params.crd) requestData['Credentials (crd)'] = params.crd;
  if (params.cidt) requestData['ID Type (cidt)'] = params.cidt;
  if (params.d) requestData['Domain (d)'] = params.d;
  if (params.uo) requestData['URL Obfuscation (uo)'] = params.uo;
  if (params.sscte) requestData['Server-Side (sscte)'] = params.sscte;
  if (params.url) requestData['Page URL (url)'] = params.url;
  if (params.ref) requestData['Referrer (ref)'] = params.ref;
  if (params.turl) requestData['Target URL (turl)'] = params.turl;
  if (params.random) requestData['Cache Buster (random)'] = params.random;
  if (Object.keys(requestData).length > 0) {
    groupedParams['Request'] = requestData;
  }

  return groupedParams;
}

/**
 * Parse a Google Ads Conversion request and return structured event data
 * Handles /pagead/conversion/, /pagead/viewthroughconversion/, /1p-conversion/, etc.
 * @param {string} url - Request URL
 * @returns {Object} Parsed Google Ads Conversion data
 */
export function parseGoogleAdsConversionData(url) {
  const urlObj = new URL(url);
  const params = Object.fromEntries(urlObj.searchParams);

  // Try to extract conversion ID from URL path or query params
  let conversionId = null;
  const pathMatch = urlObj.pathname.match(/\/pagead\/(?:conversion|viewthroughconversion|1p-conversion|conversion_async)\/(\d+)\//);
  if (pathMatch) {
    conversionId = pathMatch[1];
  } else if (params.id) {
    conversionId = params.id;
  }

  const conversionLabel = params.label || params.l;

  // Determine conversion type from URL path (shorter names since platform already says "Conversion")
  let conversionType = 'Click';
  if (urlObj.pathname.includes('/viewthroughconversion/')) {
    conversionType = 'View-Through';
  } else if (urlObj.pathname.includes('/1p-conversion/')) {
    conversionType = '1P';
  } else if (urlObj.pathname.includes('/conversion_async/')) {
    conversionType = 'Async';
  }
  const eventName = conversionId ? `${conversionType} ${conversionId}` : conversionType;

  // Build overview with human-readable labels
  const overview = {};
  overview['Type'] = conversionType;
  if (conversionId) overview['Conversion ID'] = conversionId;
  if (conversionLabel) overview['Conversion Label'] = conversionLabel;
  if (params.value) overview['Value'] = params.value;
  if (params.currency) overview['Currency'] = params.currency;

  // Build grouped params for Parsed Data table
  const groupedParams = buildGoogleAdsGroupedParams(params);

  // Determine detection reason
  let detectedBy = 'URL matches Google Ads Conversion pattern';
  if (urlObj.hostname.includes('doubleclick.net')) {
    detectedBy = 'URL contains googleads.g.doubleclick.net/pagead/conversion';
  } else if (urlObj.hostname.includes('googleadservices.com')) {
    detectedBy = 'URL contains googleadservices.com/pagead/conversion';
  } else if (urlObj.pathname.includes('/pagead')) {
    detectedBy = 'URL contains google.com/pagead/conversion';
  }

  return {
    eventName,
    conversionId,
    conversionLabel,
    conversionType,
    overview,
    groupedParams,
    params,
    detectedBy
  };
}

/**
 * Parse a Google Ads Remarketing request and return structured event data
 * Handles /pagead/landing/, /1p-user-list/, etc.
 * @param {string} url - Request URL
 * @returns {Object} Parsed Google Ads Remarketing data
 */
export function parseGoogleAdsRemarketingData(url) {
  const urlObj = new URL(url);
  const params = Object.fromEntries(urlObj.searchParams);

  // Determine remarketing type from URL path
  let remarketingType = 'Remarketing Tag';
  if (urlObj.pathname.includes('/1p-user-list/')) {
    remarketingType = 'First-Party User List';
  }

  // Try to extract list ID from URL path
  let listId = null;
  const pathMatch = urlObj.pathname.match(/\/pagead\/(?:landing|1p-user-list)\/(\d+)/);
  if (pathMatch) {
    listId = pathMatch[1];
  }

  const eventName = listId ? `${remarketingType} ${listId}` : remarketingType;

  // Build overview
  const overview = {};
  overview['Type'] = remarketingType;
  if (listId) overview['List ID'] = listId;

  // Build grouped params for Parsed Data table
  const groupedParams = buildGoogleAdsGroupedParams(params);

  // Determine detection reason
  let detectedBy = 'URL matches Google Ads Remarketing pattern';
  if (urlObj.hostname.includes('doubleclick.net')) {
    detectedBy = 'URL contains googleads.g.doubleclick.net/pagead/landing';
  } else if (urlObj.hostname.includes('googleadservices.com')) {
    detectedBy = 'URL contains googleadservices.com/pagead/landing';
  } else if (urlObj.pathname.includes('/pagead')) {
    detectedBy = 'URL contains google.com/pagead/landing';
  }

  return {
    eventName,
    listId,
    remarketingType,
    overview,
    groupedParams,
    params,
    detectedBy
  };
}
