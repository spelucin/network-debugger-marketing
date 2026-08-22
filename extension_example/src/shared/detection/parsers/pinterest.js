// Pinterest Tag Parsing Utilities
// Extracts event data from ct.pinterest.com requests

/**
 * Parse bracket-notation query params (PHP-style arrays) into nested objects
 * e.g., "ed[value]=100&ed[line_items][0][product_name]=Widget" →
 * { ed: { value: '100', line_items: [{ product_name: 'Widget' }] } }
 * @param {URLSearchParams} searchParams - URL search params
 * @returns {Object} Nested object
 */
function parseBracketParams(searchParams) {
  const result = {};

  for (const [rawKey, value] of searchParams) {
    // Match bracket notation: key[sub1][sub2]...
    const match = rawKey.match(/^([^[]+)((?:\[[^\]]*\])*)$/);
    if (!match) {
      result[rawKey] = value;
      continue;
    }

    const baseKey = match[1];
    const bracketPart = match[2];

    if (!bracketPart) {
      result[baseKey] = value;
      continue;
    }

    // Extract bracket keys: [foo][0][bar] → ['foo', '0', 'bar']
    const subKeys = [];
    const bracketRegex = /\[([^\]]*)\]/g;
    let bracketMatch;
    while ((bracketMatch = bracketRegex.exec(bracketPart)) !== null) {
      subKeys.push(bracketMatch[1]);
    }

    // Build nested structure
    if (!result[baseKey]) result[baseKey] = {};
    let current = result[baseKey];

    for (let i = 0; i < subKeys.length; i++) {
      const key = subKeys[i];
      const isLast = i === subKeys.length - 1;
      const nextKey = subKeys[i + 1];

      if (isLast) {
        current[key] = value;
      } else {
        // Determine if next level should be array or object
        const isNextNumeric = /^\d+$/.test(nextKey);
        if (!current[key]) {
          current[key] = isNextNumeric ? [] : {};
        }
        current = current[key];
      }
    }
  }

  return result;
}

/**
 * Parse a Pinterest Tag request and return structured event data
 * @param {string} url - Request URL
 * @returns {Object} Parsed Pinterest data
 */
export function parsePinterestTagData(url) {
  const urlObj = new URL(url);

  // Parse with bracket notation support
  const nested = parseBracketParams(urlObj.searchParams);
  const flatParams = Object.fromEntries(urlObj.searchParams);

  const eventName = nested.event || flatParams.event || 'PageVisit';
  const tagId = nested.tid || flatParams.tid;

  // Build overview
  const overview = {};
  if (tagId) overview['Tag ID'] = tagId;
  if (nested.ed?.value) overview['Value'] = nested.ed.value;
  if (nested.ed?.currency) overview['Currency'] = nested.ed.currency;
  if (nested.ed?.order_quantity) overview['Quantity'] = nested.ed.order_quantity;

  // --- Custom Data: event data (user-defined business data) ---
  const customData = {};
  if (nested.ed && typeof nested.ed === 'object') {
    const eventDataFields = {};
    // Flatten simple ed fields (not line_items)
    for (const [key, value] of Object.entries(nested.ed)) {
      if (key === 'line_items') continue; // Handled separately as e-commerce
      if (typeof value !== 'object') {
        eventDataFields[`${key} (ed[${key}])`] = value;
      } else {
        eventDataFields[`${key} (ed[${key}])`] = JSON.stringify(value);
      }
    }
    if (Object.keys(eventDataFields).length > 0) {
      customData['Event Data'] = eventDataFields;
    }
  }

  // Parse line items (e-commerce products)
  let ecommerceItems = null;
  if (nested.ed?.line_items) {
    const items = nested.ed.line_items;
    // Convert object-keyed items to array
    const itemArray = Array.isArray(items) ? items : Object.values(items);
    if (itemArray.length > 0) {
      ecommerceItems = itemArray.map(item => {
        const mapped = {};
        if (item.product_name) mapped['Product Name'] = item.product_name;
        if (item.product_id) mapped['Product ID'] = item.product_id;
        if (item.product_price) mapped['Price'] = item.product_price;
        if (item.product_quantity) mapped['Quantity'] = item.product_quantity;
        if (item.product_category) mapped['Category'] = item.product_category;
        if (item.product_brand) mapped['Brand'] = item.product_brand;
        if (item.product_variant) mapped['Variant'] = item.product_variant;
        // Include any unmapped fields
        for (const [k, v] of Object.entries(item)) {
          const mapped_key = `${k}`;
          if (!mapped[mapped_key] && !['product_name', 'product_id', 'product_price', 'product_quantity', 'product_category', 'product_brand', 'product_variant'].includes(k)) {
            mapped[k] = v;
          }
        }
        return mapped;
      });
    }
  }

  // --- Grouped Parsed Data (system/protocol params) ---
  const groupedParams = {};

  // Identity
  const identity = {};
  if (tagId) identity['Tag ID (tid)'] = tagId;
  if (nested.pd?.em) identity['Email Hash (pd[em])'] = nested.pd.em;
  if (nested.pd?.fn) identity['First Name Hash (pd[fn])'] = nested.pd.fn;
  if (nested.pd?.ln) identity['Last Name Hash (pd[ln])'] = nested.pd.ln;
  if (nested.pd?.ge) identity['Gender Hash (pd[ge])'] = nested.pd.ge;
  if (nested.pd?.db) identity['DOB Hash (pd[db])'] = nested.pd.db;
  if (nested.pd?.ph) identity['Phone Hash (pd[ph])'] = nested.pd.ph;
  if (nested.pd?.ct) identity['City Hash (pd[ct])'] = nested.pd.ct;
  if (nested.pd?.st) identity['State Hash (pd[st])'] = nested.pd.st;
  if (nested.pd?.zp) identity['Zip Hash (pd[zp])'] = nested.pd.zp;
  if (nested.pd?.country) identity['Country Hash (pd[country])'] = nested.pd.country;
  if (nested.pd?.external_id) identity['External ID Hash (pd[external_id])'] = nested.pd.external_id;
  if (Object.keys(identity).length > 0) {
    groupedParams['Identity'] = identity;
  }

  // Page Context
  const pageContext = {};
  if (nested.cb) pageContext['Cache Buster (cb)'] = nested.cb;
  if (nested.if) pageContext['In Iframe (if)'] = nested.if;
  if (nested.noscript) pageContext['No-Script (noscript)'] = nested.noscript;
  if (Object.keys(pageContext).length > 0) {
    groupedParams['Page Context'] = pageContext;
  }

  // Request
  const requestData = {};
  if (nested.v) requestData['API Version (v)'] = nested.v;
  if (nested.rnd) requestData['Random (rnd)'] = nested.rnd;
  if (Object.keys(requestData).length > 0) {
    groupedParams['Request'] = requestData;
  }

  const detectedBy = url.includes('ct.pinterest.com')
    ? 'URL contains ct.pinterest.com'
    : 'URL matches Pinterest tag pattern';

  return {
    eventName,
    tagId,
    overview,
    customData,
    ecommerceItems,
    groupedParams,
    params: flatParams,
    detectedBy
  };
}
