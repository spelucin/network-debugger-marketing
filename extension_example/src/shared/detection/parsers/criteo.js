// Criteo OneTag Parsing Utilities
// Extracts event data from Criteo tracking requests

/**
 * Try to parse a JSON-encoded string value, return as-is if not JSON
 * @param {string} value
 * @returns {any}
 */
function tryParseJSON(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
}

/**
 * Parse a Criteo OneTag request and return structured event data
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text
 * @returns {Object} Parsed Criteo data
 */
export function parseCriteoData(url, postData) {
  const urlObj = new URL(url);
  const params = Object.fromEntries(urlObj.searchParams);

  // Merge POST body if present
  let body = null;
  if (postData) {
    try {
      body = JSON.parse(postData);
      if (typeof body === 'object' && !Array.isArray(body)) {
        // Merge body params, URL params take priority
        for (const [k, v] of Object.entries(body)) {
          if (!params[k]) params[k] = v;
        }
      }
    } catch (e) {
      try {
        const formParams = new URLSearchParams(postData);
        for (const [k, v] of formParams) {
          if (!params[k]) params[k] = v;
        }
      } catch (e2) { /* ignore */ }
    }
  }

  // Extract event name from various possible locations
  const eventName = params.e || params.event || 'Request';
  const accountId = params.a || params.account || params.networkid;

  // Build overview
  const overview = {};
  if (accountId) overview['Account ID'] = accountId;
  if (eventName && eventName !== 'Request') overview['Event'] = eventName;

  // --- Custom Data: user-defined business data ---
  const customData = {};

  // Site type and user identity
  const userFields = {};
  // Parse sc (JSON-encoded identity data)
  if (params.sc) {
    const sc = tryParseJSON(params.sc);
    if (typeof sc === 'object' && sc !== null) {
      for (const [k, v] of Object.entries(sc)) {
        userFields[`${k} (sc.${k})`] = typeof v === 'object' ? JSON.stringify(v) : v;
      }
    }
  }
  if (params.retailerVisitorId) userFields['Retailer Visitor ID (retailerVisitorId)'] = params.retailerVisitorId;
  if (params.customerId) userFields['Customer ID (customerId)'] = params.customerId;
  if (params.siteType) userFields['Site Type (siteType)'] = params.siteType;
  if (params.type) {
    const siteTypes = { d: 'Desktop', m: 'Mobile', t: 'Tablet' };
    userFields['Site Type (type)'] = siteTypes[params.type] || params.type;
  }
  if (Object.keys(userFields).length > 0) {
    customData['User & Site'] = userFields;
  }

  // E-commerce product data
  let ecommerceItems = null;

  // Parse item/product data from various Criteo event formats
  const itemData = params.item || params.productid;
  if (itemData) {
    const items = tryParseJSON(itemData);
    if (Array.isArray(items)) {
      ecommerceItems = items.map(item => {
        if (typeof item === 'object') {
          const mapped = {};
          if (item.id) mapped['Product ID'] = item.id;
          if (item.price) mapped['Price'] = item.price;
          if (item.quantity) mapped['Quantity'] = item.quantity;
          if (item.availability) mapped['Availability'] = item.availability;
          // Include any extra fields
          for (const [k, v] of Object.entries(item)) {
            if (!['id', 'price', 'quantity', 'availability'].includes(k)) {
              mapped[k] = typeof v === 'object' ? JSON.stringify(v) : v;
            }
          }
          return mapped;
        }
        return { 'Product ID': String(item) };
      });
    } else if (typeof items === 'string') {
      // Single product ID or comma-separated list
      ecommerceItems = items.split(',').map(id => ({ 'Product ID': id.trim() }));
    }
  }

  // Transaction data as custom data
  const transactionFields = {};
  if (params.transactionid || params.id) transactionFields['Transaction ID'] = params.transactionid || params.id;
  if (params.deduplication) transactionFields['Deduplication'] = params.deduplication;
  if (params.new_customer) transactionFields['New Customer'] = params.new_customer;
  if (Object.keys(transactionFields).length > 0) {
    customData['Transaction'] = transactionFields;
  }

  // --- Grouped Parsed Data (system/protocol params) ---
  const groupedParams = {};

  // Identity
  const identity = {};
  if (accountId) identity['Account ID (a)'] = accountId;
  // External ad IDs
  if (params.external_advids) {
    const advIds = tryParseJSON(params.external_advids);
    if (Array.isArray(advIds)) {
      advIds.forEach((adv, i) => {
        if (typeof adv === 'object') {
          identity[`External ID ${i + 1} (${adv.provider || 'unknown'})`] = adv.id || JSON.stringify(adv);
        }
      });
    }
  }
  if (Object.keys(identity).length > 0) {
    groupedParams['Identity'] = identity;
  }

  // Page Context
  const pageContext = {};
  if (params.fu) pageContext['Page URL (fu)'] = params.fu;
  if (params.tld) pageContext['Top Level Domain (tld)'] = params.tld;
  if (Object.keys(pageContext).length > 0) {
    groupedParams['Page Context'] = pageContext;
  }

  // Request
  const requestData = {};
  if (params.v) requestData['Version (v)'] = params.v;
  if (params.p0) requestData['Protocol (p0)'] = params.p0;
  if (params.ci) requestData['Client ID (ci)'] = params.ci;
  if (params.glb) requestData['Global (glb)'] = params.glb;
  if (Object.keys(requestData).length > 0) {
    groupedParams['Request'] = requestData;
  }

  const detectedBy = url.includes('criteo.com')
    ? 'URL contains criteo.com'
    : 'URL matches Criteo pattern';

  return {
    eventName,
    accountId,
    overview,
    customData,
    ecommerceItems,
    groupedParams,
    params,
    postData: body,
    detectedBy
  };
}
