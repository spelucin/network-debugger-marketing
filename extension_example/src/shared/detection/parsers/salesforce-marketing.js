// Salesforce Marketing Cloud (igodigital/Collect) Parsing Utilities
// Extracts event data from Salesforce MC collect requests (collect.igodigital.com)
// Docs: https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/pb-collect-tracking.html

/**
 * Documented action names → human-readable event names
 */
const ACTION_NAMES = {
  'track_page_view': 'Page View',
  'trackPageView': 'Page View',
  'track_cart': 'Cart Update',
  'trackCart': 'Cart Update',
  'track_conversion': 'Conversion',
  'trackConversion': 'Conversion',
  'set_user_info': 'Set User Info',
  'setUserInfo': 'Set User Info',
  'do_not_track': 'Do Not Track',
  'doNotTrack': 'Do Not Track',
  'track_wishlist': 'Wishlist',
  'trackWishlist': 'Wishlist',
  'track_event': 'Custom Event',
  'trackEvent': 'Custom Event',
};

/**
 * Parse a Salesforce Marketing Cloud collect request and return structured event data
 * URL structure: https://{host}.collect.igodigital.com/c2/{MID}/{action}?payload={JSON}
 * Also handles evergage.com endpoints
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text
 * @returns {Object} Parsed Salesforce MC data
 */
export function parseSalesforceMarketingData(url, postData = null) {
  const urlObj = new URL(url);
  const urlParams = Object.fromEntries(urlObj.searchParams);

  // Extract MID and action from URL path: /c2/{MID}/{action}
  let mid = null;
  let action = null;
  const pathMatch = urlObj.pathname.match(/\/c2\/([^/]+)\/([^/?]+)/);
  if (pathMatch) {
    mid = pathMatch[1];
    action = pathMatch[2];
  }

  // Parse payload from query param or POST body
  let payload = null;
  if (urlParams.payload) {
    try {
      payload = JSON.parse(urlParams.payload);
    } catch (e) {
      // Not valid JSON
    }
  }
  if (!payload && postData) {
    try {
      payload = JSON.parse(postData);
    } catch (e) {
      // Not valid JSON
    }
  }

  // Determine event name from action
  let eventName = 'Request';
  if (action) {
    eventName = ACTION_NAMES[action] || humanizeAction(action);
  }

  // Build overview
  const overview = {};
  if (mid) overview['Member ID'] = mid;
  if (action) overview['Action'] = action;
  if (payload?.title && (action === 'track_page_view' || action === 'trackPageView')) {
    overview['Page Title'] = payload.title;
  }

  // --- Custom Data: business data from payload ---
  const customData = {};

  if (payload) {
    const isPageView = action === 'track_page_view' || action === 'trackPageView';
    const isConversion = action === 'track_conversion' || action === 'trackConversion';
    const isUserInfo = action === 'set_user_info' || action === 'setUserInfo';

    // Page view: item, search, category
    if (isPageView) {
      const pageViewData = {};
      if (payload.item) pageViewData['Product Code (item)'] = payload.item;
      if (payload.search) pageViewData['Search Term (search)'] = payload.search;
      if (payload.category) pageViewData['Category (category)'] = payload.category;
      if (Object.keys(pageViewData).length > 0) {
        customData['Page View Data'] = pageViewData;
      }
    }

    // Conversion: order details
    if (isConversion) {
      const orderData = {};
      if (payload.order_number) orderData['Order Number (order_number)'] = payload.order_number;
      if (payload.shipping_charge != null) orderData['Shipping (shipping_charge)'] = payload.shipping_charge;
      if (payload.discount_amount != null) orderData['Discount (discount_amount)'] = payload.discount_amount;
      if (Object.keys(orderData).length > 0) {
        customData['Order Details'] = orderData;
      }
    }

    // User info: email + details
    if (isUserInfo) {
      const userData = {};
      if (payload.email) userData['Email (email)'] = payload.email;
      if (payload.details && typeof payload.details === 'object') {
        for (const [key, value] of Object.entries(payload.details)) {
          if (value !== undefined && value !== null) {
            userData[`${key} (details.${key})`] = value;
          }
        }
      }
      if (Object.keys(userData).length > 0) {
        customData['User Info'] = userData;
      }
    }

    // Custom event or track_event: include all payload properties as custom data
    if (action === 'track_event' || action === 'trackEvent') {
      const eventData = {};
      for (const [key, value] of Object.entries(payload)) {
        if (!['url', 'title', 'referrer'].includes(key) && value !== undefined && value !== null) {
          eventData[key] = value;
        }
      }
      if (Object.keys(eventData).length > 0) {
        customData['Event Data'] = eventData;
      }
    }
  }

  // --- E-Commerce Items: cart array from track_cart / track_conversion ---
  const ecommerceItems = [];
  if (payload?.cart && Array.isArray(payload.cart)) {
    for (const item of payload.cart) {
      if (item && typeof item === 'object') {
        ecommerceItems.push(item);
      }
    }
  }

  // --- Grouped Parsed Data ---
  const groupedParams = {};

  // Page Context
  const pageContext = {};
  if (payload?.url) pageContext['Page URL (payload.url)'] = payload.url;
  if (payload?.title) pageContext['Page Title (payload.title)'] = payload.title;
  if (payload?.referrer) pageContext['Referrer (payload.referrer)'] = payload.referrer;
  if (Object.keys(pageContext).length > 0) {
    groupedParams['Page Context'] = pageContext;
  }

  // Configuration
  const configData = {};
  if (mid) configData['Member ID (path)'] = mid;
  // Extract host prefix (e.g., "tau" from "tau.collect.igodigital.com")
  const hostParts = urlObj.hostname.split('.');
  if (hostParts.length > 3) {
    configData['Host Prefix'] = hostParts.slice(0, hostParts.length - 3).join('.');
  }
  if (Object.keys(configData).length > 0) {
    groupedParams['Configuration'] = configData;
  }

  // Other payload fields not already grouped
  const otherPayload = {};
  if (payload) {
    const groupedKeys = new Set([
      'url', 'title', 'referrer', 'cart', 'item', 'search', 'category',
      'order_number', 'shipping_charge', 'discount_amount',
      'email', 'details', 'clear_cart'
    ]);
    for (const [key, value] of Object.entries(payload)) {
      if (!groupedKeys.has(key) && value !== undefined && value !== null &&
          typeof value !== 'object') {
        otherPayload[`payload.${key}`] = value;
      }
    }
  }
  if (Object.keys(otherPayload).length > 0) {
    groupedParams['Other'] = otherPayload;
  }

  // Determine detection reason
  let detectedBy = 'URL matches Salesforce Marketing Cloud pattern';
  if (urlObj.hostname.includes('igodigital.com')) {
    detectedBy = 'URL contains collect.igodigital.com';
  } else if (urlObj.hostname.includes('evergage.com')) {
    detectedBy = 'URL contains evergage.com';
  }

  return {
    eventName,
    mid,
    action,
    overview,
    customData,
    ecommerceItems,
    groupedParams,
    rawParams: urlParams,
    postData: payload,
    detectedBy
  };
}

/**
 * Humanize a snake_case or camelCase action name
 * @param {string} action - Raw action name
 * @returns {string} Human-readable name
 */
function humanizeAction(action) {
  return action
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}
