// GA4 (Google Analytics 4) Parsing Utilities
// Extracts event data from GA4 /g/collect and /g/s/collect requests

// =============================================================================
// PARAMETER LABELS — human-readable names for GA4 query parameters
// Based on community-documented GA4 Measurement Protocol (not officially documented by Google)
// =============================================================================

const GA4_PARAM_LABELS = {
  // Core / Protocol
  v: 'Protocol Version',
  tid: 'Measurement ID',
  gtm: 'GTM Hash',
  _p: 'Page ID',
  _s: 'Hit Counter',
  _z: 'Cache Buster',
  _rnd: 'Random',
  _dbg: 'Debug Mode',

  // Page / Document
  dl: 'Document URL',
  dr: 'Document Referrer',
  dt: 'Document Title',
  dh: 'Document Hostname',

  // User / Client Identity
  cid: 'Client ID',
  uid: 'User ID',
  _fid: 'Firebase ID',
  gdid: 'Developer ID',

  // Session
  sid: 'Session ID',
  sct: 'Session Count',
  seg: 'Session Engaged',
  _ss: 'Session Start',
  _fv: 'First Visit',
  _nsi: 'New Session ID',

  // Event
  en: 'Event Name',
  _et: 'Engagement Time',
  _ee: 'Enhanced Measurement',
  _c: 'Is Conversion',
  _eu: 'Event Usage',
  _edid: 'Event Debug ID',

  // Campaign / Attribution
  cs: 'Campaign Source',
  cm: 'Campaign Medium',
  cn: 'Campaign Name',
  cc: 'Campaign Content',
  ct: 'Campaign Term',
  ccf: 'Creative Format',
  cmt: 'Marketing Tactic',

  // Consent
  gcs: 'Consent Status',
  gcd: 'Consent Default',
  gcu: 'Consent Update',
  gcut: 'Consent Update Type',
  npa: 'Non-Personalized Ads',
  dma: 'Digital Markets Act',
  dma_cps: 'DMA Consent Signals',
  pscdl: 'Privacy Sandbox Label',

  // Client Hints / User Agent
  ul: 'User Language',
  sr: 'Screen Resolution',
  uaa: 'CPU Architecture',
  uab: 'Platform Bitness',
  uafvl: 'Browser Versions',
  uamb: 'Is Mobile',
  uam: 'Device Model',
  uap: 'Platform',
  uapv: 'Platform Version',
  uaw: 'WoW64',

  // E-Commerce (event-level)
  cu: 'Currency',

  // Timing
  tfd: 'Time From Document',

  // Cross-Domain / Server-Side
  _fplc: 'First Party Linker Cookie',
  _glv: 'Google Linker Valid',
  _uc: 'User Country',

  // Advertising
  are: 'Ads Remarketing',
  frm: 'Frame Context',
  _gaz: 'Google Ads Join',
  ir: 'Ignore Referrer',
  tt: 'Traffic Type',
  tag_exp: 'Tag Experiment',
};

// =============================================================================
// PARAMETER GROUPING — logical groups for the Request Parameters section
// Params are placed in the first matching group; unmatched go to "Other"
// =============================================================================

const GA4_PARAM_GROUPS = [
  { label: 'Page / Document', keys: new Set(['dl', 'dr', 'dt', 'dh']) },
  { label: 'User Identity', keys: new Set(['cid', 'uid', '_fid', 'gdid']) },
  { label: 'Session', keys: new Set(['sid', 'sct', 'seg', '_ss', '_fv', '_nsi']) },
  { label: 'Event', keys: new Set(['en', '_et', '_ee', '_c', '_eu', '_edid']) },
  { label: 'Campaign / Attribution', keys: new Set(['cs', 'cm', 'cn', 'cc', 'ct', 'ccf', 'cmt']) },
  { label: 'E-Commerce', keys: new Set(['cu']) },
  { label: 'Consent', keys: new Set(['gcs', 'gcd', 'gcu', 'gcut', 'npa', 'dma', 'dma_cps', 'pscdl']) },
  { label: 'Client Hints', keys: new Set(['ul', 'sr', 'uaa', 'uab', 'uafvl', 'uamb', 'uam', 'uap', 'uapv', 'uaw']) },
  { label: 'Advertising', keys: new Set(['are', 'frm', '_gaz', 'ir', 'tt']) },
  { label: 'Protocol / Internal', keys: new Set(['v', 'tid', 'gtm', '_p', '_s', '_z', '_dbg', '_rnd', 'tfd', '_fplc', '_glv', 'tag_exp', '_uc', '_ecid', '_eri', '_let']) },
];

// =============================================================================
// E-COMMERCE ITEM SUB-KEYS — tilde-delimited keys within prN values
// e.g. pr1=idSKU123~nmShirt~pr29.99~caApparel
// =============================================================================

const GA4_ITEM_KEYS = {
  id: 'Item ID',
  nm: 'Item Name',
  br: 'Brand',
  ca: 'Category',
  ca2: 'Category 2',
  ca3: 'Category 3',
  ca4: 'Category 4',
  ca5: 'Category 5',
  va: 'Variant',
  pr: 'Price',
  qt: 'Quantity',
  cp: 'Coupon',
  ds: 'Discount',
  af: 'Affiliation',
  ln: 'List Name',
  li: 'List ID',
  lp: 'List Position',
};

// Sort item sub-keys longest-first so ca5 matches before ca, etc.
const SORTED_ITEM_KEYS = Object.entries(GA4_ITEM_KEYS)
  .sort((a, b) => b[0].length - a[0].length);

// Numeric item sub-keys (values should be parsed as numbers)
const NUMERIC_ITEM_KEYS = new Set(['pr', 'qt', 'ds', 'lp']);

// =============================================================================
// CORE PARSING FUNCTIONS
// =============================================================================

/**
 * Parse GA4 events from URL params and POST body
 * GA4 batches events: URL params contain the first event (or shared params),
 * POST body contains additional events as URL-encoded lines
 * @param {Object} urlParams - URL query parameters
 * @param {string|null} postData - POST body text
 * @returns {Array} Array of event objects
 */
export function parseGA4Events(urlParams, postData) {
  const events = [];

  // Shared params that apply to all events (from URL)
  const sharedParams = {
    tid: urlParams.tid,  // Measurement ID
    cid: urlParams.cid,  // Client ID
    sid: urlParams.sid,  // Session ID
    v: urlParams.v,      // Protocol version
  };

  // Check if POST body contains batched events
  if (postData && postData.trim()) {
    // GA4 POST body can contain multiple events, separated by newlines or as single string
    // Each event is URL-encoded with its own en= (event name) and ep.*/epn.* params
    const lines = postData.split(/\r?\n/).filter(line => line.trim());

    if (lines.length > 0) {
      // Parse each line as a separate event
      lines.forEach(line => {
        try {
          const lineParams = Object.fromEntries(new URLSearchParams(line));
          // Merge with shared params (line params take precedence)
          const mergedParams = { ...urlParams, ...lineParams };

          events.push(buildGA4Event(mergedParams, sharedParams));
        } catch (e) {
          // Failed to parse GA4 POST line, skip it
        }
      });
    }
  }

  // If no events found in POST body, use URL params as single event
  if (events.length === 0) {
    events.push(buildGA4Event(urlParams, sharedParams));
  }

  return events;
}

/**
 * Build a structured GA4 event object from merged parameters
 * @param {Object} params - Merged URL + POST line parameters
 * @param {Object} sharedParams - Shared params from URL (tid, cid, sid, v)
 * @returns {Object} Structured event object
 */
function buildGA4Event(params, sharedParams) {
  return {
    eventName: params.en || 'page_view',
    measurementId: params.tid || sharedParams.tid,
    clientId: params.cid || sharedParams.cid,
    eventParams: extractGA4EventParams(params),
    userProperties: extractGA4UserProperties(params),
    ecommerceItems: parseGA4EcommerceItems(params),
    groupedParams: buildGA4GroupedParams(params),
    params: params
  };
}

// =============================================================================
// EXTRACTION FUNCTIONS
// =============================================================================

/**
 * Extract GA4 custom event parameters (ep.* and epn.*)
 * Keeps the full parameter name including prefix
 * @param {Object} params - All GA4 parameters
 * @returns {Object} Extracted event parameters with full key names
 */
export function extractGA4EventParams(params) {
  const eventParams = {};

  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith('ep.')) {
      eventParams[key] = value;
    } else if (key.startsWith('epn.')) {
      eventParams[key] = parseFloat(value);
    }
  }

  return eventParams;
}

/**
 * Extract GA4 user properties (up.* and upn.*)
 * Keeps the full parameter name including prefix
 * @param {Object} params - All GA4 parameters
 * @returns {Object} Extracted user properties with full key names
 */
export function extractGA4UserProperties(params) {
  const userProps = {};
  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith('up.')) {
      userProps[key] = value;
    } else if (key.startsWith('upn.')) {
      userProps[key] = parseFloat(value);
    }
  }
  return userProps;
}

/**
 * Parse GA4 e-commerce items from prN parameters
 * GA4 encodes items as pr1=idSKU~nmName~pr29.99, pr2=..., etc.
 * @param {Object} params - All GA4 parameters
 * @returns {Array} Array of parsed item objects with human-readable keys
 */
export function parseGA4EcommerceItems(params) {
  const items = [];

  // Collect prN keys and sort by index
  const prKeys = [];
  for (const key of Object.keys(params)) {
    const match = key.match(/^pr(\d+)$/);
    if (match && params[key]) {
      prKeys.push({ index: parseInt(match[1], 10), key, value: params[key] });
    }
  }
  prKeys.sort((a, b) => a.index - b.index);

  for (const { value } of prKeys) {
    const item = parseGA4ItemValue(value);
    if (Object.keys(item).length > 0) {
      items.push(item);
    }
  }

  return items;
}

/**
 * Parse a single GA4 e-commerce item value (tilde-delimited)
 * e.g. "idSKU123~nmBlue Shirt~pr29.99~caApparel~qt2~k0currency~v0DKK"
 *
 * Standard sub-keys use known short codes (id, nm, pr, ca, va, ...).
 * Custom parameters are encoded as kN<name> / vN<value> pairs where N is the
 * index — e.g. k0currency + v0DKK → { currency: "DKK" }.
 *
 * @param {string} value - The tilde-delimited item string
 * @returns {Object} Parsed item with "Label (key): value" or "name: value" keys
 */
function parseGA4ItemValue(value) {
  const item = {};
  const parts = value.split('~');

  // Accumulate custom kN/vN pairs before building the item
  const customKeys = {};  // index → param name
  const customVals = {};  // index → param value

  for (const part of parts) {
    if (!part) continue;

    // Custom param key: kN<name> where N is one or more digits
    // Must check before standard keys since 'k' doesn't overlap with any standard prefix
    const kMatch = part.match(/^k(\d+)(.+)$/);
    if (kMatch) {
      customKeys[kMatch[1]] = kMatch[2];
      continue;
    }

    // Custom param value: vN<value> where N is one or more digits
    // 'va' (variant) starts with 'v' but is followed by 'a' not a digit, so no conflict
    const vMatch = part.match(/^v(\d+)(.*)$/);
    if (vMatch) {
      customVals[vMatch[1]] = vMatch[2];
      continue;
    }

    // Standard known sub-keys (longest-first so ca5 matches before ca)
    let matched = false;
    for (const [subKey, label] of SORTED_ITEM_KEYS) {
      if (part.startsWith(subKey) && part.length > subKey.length) {
        const val = part.substring(subKey.length);
        const displayKey = `${label} (${subKey})`;
        if (NUMERIC_ITEM_KEYS.has(subKey)) {
          const num = parseFloat(val);
          item[displayKey] = isNaN(num) ? val : num;
        } else {
          item[displayKey] = val;
        }
        matched = true;
        break;
      }
    }
    if (!matched) {
      // Truly unknown sub-key — include raw
      item[part] = '';
    }
  }

  // Merge kN/vN pairs: use the name from kN as the key, value from vN
  for (const index of Object.keys(customKeys)) {
    const paramName = customKeys[index];
    const paramValue = customVals[index] !== undefined ? customVals[index] : '';
    item[paramName] = paramValue;
  }

  return item;
}

/**
 * Build grouped request parameters with human-readable labels
 * Excludes ep.*, epn.*, up.*, upn.*, prN (those go in their own sections)
 * Groups remaining params by logical category with "Label (key): value" format
 * @param {Object} params - All GA4 parameters
 * @returns {Object} Nested object: { "Group Name": { "Label (key)": value, ... }, ... }
 */
export function buildGA4GroupedParams(params) {
  const grouped = {};
  const assigned = new Set();

  // Filter out params that belong to other dedicated sections
  const remaining = {};
  for (const [key, value] of Object.entries(params)) {
    if (key.startsWith('ep.') || key.startsWith('epn.')) continue;
    if (key.startsWith('up.') || key.startsWith('upn.')) continue;
    if (/^pr\d+$/.test(key)) continue;
    remaining[key] = value;
  }

  // Assign params to groups in order
  for (const group of GA4_PARAM_GROUPS) {
    const groupData = {};
    for (const [key, value] of Object.entries(remaining)) {
      if (group.keys.has(key)) {
        const label = GA4_PARAM_LABELS[key];
        const displayKey = label ? `${label} (${key})` : key;
        groupData[displayKey] = value;
        assigned.add(key);
      }
    }
    if (Object.keys(groupData).length > 0) {
      grouped[group.label] = groupData;
    }
  }

  // Collect unassigned params into "Other" group
  const other = {};
  for (const [key, value] of Object.entries(remaining)) {
    if (!assigned.has(key)) {
      const label = GA4_PARAM_LABELS[key];
      const displayKey = label ? `${label} (${key})` : key;
      other[displayKey] = value;
    }
  }
  if (Object.keys(other).length > 0) {
    grouped['Other'] = other;
  }

  return grouped;
}

// =============================================================================
// PUBLIC API — top-level parsing functions called from panel.js
// =============================================================================

/**
 * Parse a GA4 request and return structured event data
 * Does NOT call addEvent() - returns data for the caller to handle
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text
 * @returns {Object} Parsed GA4 data including events array and metadata
 */
export function parseGA4RequestData(url, postData) {
  const urlObj = new URL(url);
  const urlParams = Object.fromEntries(urlObj.searchParams);
  const events = parseGA4Events(urlParams, postData);
  const hostname = urlObj.hostname;

  return {
    events,
    hostname,
    postData,
    detectedBy: `URL contains /g/collect on ${hostname}`
  };
}

/**
 * Parse a Server-Side GA4 request (via CNAME/first-party domain)
 * Uses the same batched event parsing as regular GA4.
 *
 * Wrapper support (Feature #76, absorbed into #79's topology classifier):
 * when `cnameInfo.decoded` is present, the request URL is opaque (Stape
 * Custom Loader base64-wraps the original `/g/collect?…` query inside a
 * `?<8-hex>=<base64>` value). In that case prefer the decoded searchParams
 * over the URL's own. Hostname is always taken from the real URL — the
 * customer's first-party host stays truthful in the Overview.
 *
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text
 * @param {Object} cnameInfo - CNAME detection info with reason; may carry
 *   `decoded: { pathname, search, searchParams, platform, queryParam }`
 *   when the topology classifier decoded a Stape Custom Loader wrapper.
 * @returns {Object} Parsed server-side GA4 data
 */
export function parseServerSideGA4RequestData(url, postData, cnameInfo) {
  const urlObj = new URL(url);
  const decoded = cnameInfo?.decoded;
  const urlParams = decoded?.searchParams
    ? { ...Object.fromEntries(urlObj.searchParams), ...decoded.searchParams }
    : Object.fromEntries(urlObj.searchParams);
  const events = parseGA4Events(urlParams, postData);

  return {
    events,
    hostname: urlObj.hostname,
    postData,
    detectedBy: cnameInfo?.reason || (decoded
      ? `Decoded from Stape Custom Loader wrapper (${decoded.queryParam}) → ${decoded.pathname}`
      : 'First-party GA4 detected')
  };
}
