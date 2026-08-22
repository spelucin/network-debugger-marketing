// Piwik PRO Analytics Parsing Utilities
// Extracts event data from Piwik PRO Tracking API requests (ppms.php)
// Piwik PRO extends the Matomo HTTP Tracking API with consent events, e-commerce v2,
// tracking source identification, and anonymous tracking.
// Reference: https://developers.piwik.pro/reference/post_ppms-php

// Consent event category values used by Piwik PRO Consent Manager
const CONSENT_EVENT_CATEGORIES = new Set([
  'consent_form_impression',
  'consent_form_click',
  'consent_decision'
]);

/**
 * Parse a Piwik PRO tracking request
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text (form-encoded or query string)
 * @returns {Object} Parsed Piwik PRO data
 */
export function parsePiwikProRequestData(url, postData) {
  let params;
  try {
    const urlObj = new URL(url);
    params = Object.fromEntries(urlObj.searchParams.entries());
  } catch (e) {
    return {
      eventName: 'Piwik PRO Request',
      isConsentEvent: false,
      overview: {},
      customData: {},
      consent: null,
      ecommerce: null,
      groupedParams: {},
      params: {},
      detectedBy: 'URL matches Piwik PRO endpoint'
    };
  }

  // Merge form-encoded POST body params
  if (postData) {
    try {
      const postParams = new URLSearchParams(postData);
      for (const [key, value] of postParams.entries()) {
        if (!params[key]) {
          params[key] = value;
        }
      }
    } catch (e) {
      // Not form-encoded, ignore
    }
  }

  // Determine if this is a consent event (routes to piwik-pro-consent platform)
  const isConsentEvent = CONSENT_EVENT_CATEGORIES.has(params.e_c);

  // Determine event type and name
  const eventName = determineEventName(params);

  // Build overview
  const overview = {};
  if (params.idsite) overview['Site ID'] = params.idsite;
  if (params.uid) overview['User ID'] = params.uid;
  if (params._id) overview['Visitor ID'] = params._id;
  if (params.url) overview['Page URL'] = params.url;

  // Extract consent data (for consent events)
  const consent = isConsentEvent ? extractConsentData(params) : null;

  // Extract custom dimensions (dimension1, dimension2, ...)
  const customDimensions = {};
  for (const [key, value] of Object.entries(params)) {
    const dimMatch = key.match(/^dimension(\d+)$/);
    if (dimMatch) {
      customDimensions[`Dimension ${dimMatch[1]}`] = value;
    }
  }

  // Extract custom variables (JSON-encoded _cvar)
  const customVariables = {};
  if (params._cvar) {
    try {
      const cvarObj = JSON.parse(params._cvar);
      for (const [slot, [name, value]] of Object.entries(cvarObj)) {
        customVariables[`${name} (slot ${slot})`] = value;
      }
    } catch (e) {
      // Invalid JSON
    }
  }

  // Extract event-scope custom variables (cvar)
  const eventCustomVariables = {};
  if (params.cvar) {
    try {
      const cvarObj = JSON.parse(params.cvar);
      for (const [slot, [name, value]] of Object.entries(cvarObj)) {
        eventCustomVariables[`${name} (slot ${slot})`] = value;
      }
    } catch (e) {
      // Invalid JSON
    }
  }

  // Extract e-commerce data (supports both v2 ec_products and legacy ec_items)
  const ecommerce = extractEcommerce(params);

  // Extract event tracking params (for non-consent custom events)
  const eventTracking = {};
  if (params.e_c && !isConsentEvent) {
    eventTracking['Category'] = params.e_c;
    if (params.e_a) eventTracking['Action'] = params.e_a;
    if (params.e_n) eventTracking['Name'] = params.e_n;
    if (params.e_v) eventTracking['Value'] = params.e_v;
  }

  // Extract content tracking params
  const contentTracking = {};
  if (params.c_n) contentTracking['Content Name'] = params.c_n;
  if (params.c_p) contentTracking['Content Piece'] = params.c_p;
  if (params.c_t) contentTracking['Content Target'] = params.c_t;
  if (params.c_i) contentTracking['Interaction'] = params.c_i;

  // Build Custom Data section
  const customData = {};
  if (Object.keys(eventTracking).length > 0) {
    customData['Event Tracking'] = eventTracking;
  }
  if (Object.keys(contentTracking).length > 0) {
    customData['Content Tracking'] = contentTracking;
  }
  if (Object.keys(customDimensions).length > 0) {
    customData['Custom Dimensions'] = customDimensions;
  }
  if (Object.keys(customVariables).length > 0) {
    customData['Session Variables'] = customVariables;
  }
  if (Object.keys(eventCustomVariables).length > 0) {
    customData['Event Variables'] = eventCustomVariables;
  }

  // Build grouped Parsed Data (system/protocol params)
  const groupedParams = buildGroupedParams(params);

  return {
    eventName,
    isConsentEvent,
    overview,
    consent,
    customData,
    ecommerce,
    groupedParams,
    params,
    detectedBy: 'URL matches Piwik PRO endpoint'
  };
}

/**
 * Determine the event name following Piwik PRO's 18-step detection priority
 */
function determineEventName(params) {
  // 1. Goal conversion (non-zero idgoal)
  if (params.idgoal && params.idgoal !== '0') {
    return `Goal ${params.idgoal}`;
  }

  // 2-5. Ping types (Piwik PRO extended: 1-3 heartbeat, 4 deanon, 5 perf, 6 custom)
  if (params.ping) {
    const pingVal = parseInt(params.ping, 10);
    if (pingVal >= 1 && pingVal <= 3) return 'Heartbeat Ping';
    if (pingVal === 4) return 'Deanonymization Ping';
    if (pingVal === 5) return 'Performance Ping';
    if (pingVal === 6) return 'Custom Ping';
    return 'Ping';
  }

  // 6. Download
  if (params.download) return 'Download';

  // 7. Outlink
  if (params.link) return 'Outlink';

  // 8-10. Consent events
  if (params.e_c === 'consent_form_impression') return 'Consent: Form Impression';
  if (params.e_c === 'consent_form_click') {
    const action = params.e_a || 'click';
    const actionLabels = {
      'agree_to_all': 'Accept All',
      'full_consent': 'Accept All',
      'reject_all': 'Reject All',
      'no_consent': 'Reject All',
      'save_choices': 'Save Choices',
      'close': 'Close'
    };
    return `Consent: ${actionLabels[action] || action}`;
  }
  if (params.e_c === 'consent_decision') return 'Consent: Decision';

  // 11. Custom event (e_c + e_a present, not consent)
  if (params.e_c && params.e_a) {
    const parts = [params.e_c, params.e_a, params.e_n].filter(Boolean);
    return `Event: ${parts.join(' / ')}`;
  }

  // 12-13. Content tracking
  if (params.c_i && params.c_n) return `Content Interaction: ${params.c_n}`;
  if (params.c_n) return `Content: ${params.c_n}`;

  // 14-19. E-commerce v2 (e_t parameter)
  if (params.e_t) {
    const ecomLabels = {
      'cart-update': 'Cart Update',
      'product-detail-view': 'Product Detail View',
      'add-to-cart': 'Add to Cart',
      'remove-from-cart': 'Remove from Cart',
      'order': params.ec_id ? `Order: ${params.ec_id}` : 'Order'
    };
    if (ecomLabels[params.e_t]) return ecomLabels[params.e_t];
  }

  // Legacy e-commerce (idgoal=0)
  if (params.idgoal === '0') {
    if (params.ec_id) return `Order: ${params.ec_id}`;
    if (params.revenue) return 'Cart Update';
  }

  // 20. Site search
  if (params.search) return `Search: ${params.search}`;

  // 21. Page view (default)
  if (params.action_name) return params.action_name;

  return 'Page View';
}

/**
 * Extract consent event data for the Consent section
 */
function extractConsentData(params) {
  const data = {};
  if (params.e_c) data['Event Type'] = formatConsentCategory(params.e_c);
  if (params.e_a) data['Action'] = formatConsentAction(params.e_a);
  if (params.e_n) data['Name'] = params.e_n;
  if (params.e_v) data['Value'] = params.e_v;
  return data;
}

/**
 * Format consent event category for display
 */
function formatConsentCategory(category) {
  const labels = {
    'consent_form_impression': 'Form Impression',
    'consent_form_click': 'Form Click',
    'consent_decision': 'Consent Decision'
  };
  return labels[category] || category;
}

/**
 * Format consent action for display
 */
function formatConsentAction(action) {
  const labels = {
    'agree_to_all': 'Accept All',
    'full_consent': 'Accept All',
    'reject_all': 'Reject All',
    'no_consent': 'Reject All',
    'save_choices': 'Save Choices',
    'close': 'Close Form'
  };
  return labels[action] || action;
}

/**
 * Extract e-commerce data from both Piwik PRO v2 (ec_products) and legacy (ec_items)
 */
function extractEcommerce(params) {
  // Try Piwik PRO v2 format first (ec_products)
  if (params.ec_products) {
    try {
      const products = JSON.parse(params.ec_products);
      if (!Array.isArray(products) || products.length === 0) return null;

      const result = { summary: {}, items: [] };

      if (params.e_t) result.summary['Event Type (e_t)'] = params.e_t;
      if (params.ec_id) result.summary['Order ID (ec_id)'] = params.ec_id;
      if (params.revenue) result.summary['Revenue (revenue)'] = params.revenue;
      if (params.ec_st) result.summary['Subtotal (ec_st)'] = params.ec_st;
      if (params.ec_tx) result.summary['Tax (ec_tx)'] = params.ec_tx;
      if (params.ec_sh) result.summary['Shipping (ec_sh)'] = params.ec_sh;
      if (params.ec_dt) result.summary['Discount (ec_dt)'] = params.ec_dt;

      // v2 format: [sku, name, [categories], price, quantity, brand, variant, {customDims}]
      result.items = products.map(item => {
        const obj = {};
        if (item[0]) obj['SKU'] = item[0];
        if (item[1]) obj['Name'] = item[1];
        if (item[2]) {
          obj['Category'] = Array.isArray(item[2]) ? item[2].join(' > ') : item[2];
        }
        if (item[3] !== undefined && item[3] !== null) obj['Price'] = item[3];
        if (item[4] !== undefined && item[4] !== null) obj['Quantity'] = item[4];
        if (item[5]) obj['Brand'] = item[5];
        if (item[6]) obj['Variant'] = item[6];
        if (item[7] && typeof item[7] === 'object' && Object.keys(item[7]).length > 0) {
          const dims = Object.entries(item[7]).map(([k, v]) => `dim${k}=${v}`).join(', ');
          obj['Product Dimensions'] = dims;
        }
        return obj;
      });

      return result;
    } catch (e) {
      // Invalid JSON
    }
  }

  // Fallback to legacy Matomo format (ec_items)
  if (params.ec_items) {
    try {
      const items = JSON.parse(params.ec_items);
      if (!Array.isArray(items) || items.length === 0) return null;

      const result = { summary: {}, items: [] };

      if (params.ec_id) result.summary['Order ID (ec_id)'] = params.ec_id;
      if (params.revenue) result.summary['Revenue (revenue)'] = params.revenue;
      if (params.ec_st) result.summary['Subtotal (ec_st)'] = params.ec_st;
      if (params.ec_tx) result.summary['Tax (ec_tx)'] = params.ec_tx;
      if (params.ec_sh) result.summary['Shipping (ec_sh)'] = params.ec_sh;
      if (params.ec_dt) result.summary['Discount (ec_dt)'] = params.ec_dt;

      // Legacy format: [sku, name, category, price, quantity]
      result.items = items.map(item => {
        const obj = {};
        if (item[0]) obj['SKU'] = item[0];
        if (item[1]) obj['Name'] = item[1];
        if (item[2]) obj['Category'] = item[2];
        if (item[3]) obj['Price'] = item[3];
        if (item[4]) obj['Quantity'] = item[4];
        return obj;
      });

      return result;
    } catch (e) {
      // Invalid JSON
    }
  }

  return null;
}

/**
 * Build grouped system/protocol parameters for Parsed Data section.
 * Keys use "Human Label (param)" format for mapping back to raw request.
 */
function buildGroupedParams(params) {
  const groups = {};

  // Page Context
  const pageContext = {};
  if (params.action_name) pageContext['Page Title (action_name)'] = params.action_name;
  if (params.url) pageContext['URL (url)'] = params.url;
  if (params.urlref) pageContext['Referrer (urlref)'] = params.urlref;
  if (params.link) pageContext['Outlink URL (link)'] = params.link;
  if (params.download) pageContext['Download URL (download)'] = params.download;
  if (params.search) pageContext['Search Keyword (search)'] = params.search;
  if (params.search_cat) pageContext['Search Category (search_cat)'] = params.search_cat;
  if (params.search_cats) pageContext['Search Categories (search_cats)'] = params.search_cats;
  if (params.search_count) pageContext['Search Results (search_count)'] = params.search_count;
  if (params.cs) pageContext['Charset (cs)'] = params.cs;
  if (params.redirecturl) pageContext['Redirect URL (redirecturl)'] = params.redirecturl;
  if (Object.keys(pageContext).length > 0) groups['Page Context'] = pageContext;

  // Identifiers
  const identifiers = {};
  if (params.idsite) identifiers['Site ID (idsite)'] = params.idsite;
  if (params._id) identifiers['Visitor ID (_id)'] = params._id;
  if (params.uid) identifiers['User ID (uid)'] = params.uid;
  if (params.cid) identifiers['CID Override (cid)'] = params.cid;
  if (params.pv_id) identifiers['Pageview ID (pv_id)'] = params.pv_id;
  if (params._idn) identifiers['New Visitor (_idn)'] = params._idn === '1' ? 'Yes' : 'No';
  if (params.new_visit) identifiers['Force New Visit (new_visit)'] = params.new_visit === '1' ? 'Yes' : 'No';
  if (Object.keys(identifiers).length > 0) groups['Identifiers'] = identifiers;

  // Session & Visit
  const session = {};
  if (params._idvc) session['Visit Count (_idvc)'] = params._idvc;
  if (params._viewts) session['Last Visit (_viewts)'] = params._viewts;
  if (params._idts) session['First Visit (_idts)'] = params._idts;
  if (params._refts) session['Referrer Visit (_refts)'] = params._refts;
  if (params._ects) session['Last Order (_ects)'] = params._ects;
  if (params._rcn) session['Campaign Name (_rcn)'] = params._rcn;
  if (params._rck) session['Campaign Keyword (_rck)'] = params._rck;
  if (Object.keys(session).length > 0) groups['Session'] = session;

  // Privacy / Anonymization (Piwik PRO-specific)
  const privacy = {};
  if (params.uia) privacy['Anonymous Tracking (uia)'] = params.uia === '1' ? 'Enabled' : 'Disabled';
  if (Object.keys(privacy).length > 0) groups['Privacy'] = privacy;

  // Tracking Source (Piwik PRO-specific)
  const trackingSource = {};
  if (params.ts_n) {
    const sourceLabels = {
      'jstc': 'JS Tracking Client',
      'jstc_tm': 'JS Tracking Client (via Tag Manager)'
    };
    trackingSource['Source Name (ts_n)'] = sourceLabels[params.ts_n] || params.ts_n;
  }
  if (params.ts_v) trackingSource['Source Version (ts_v)'] = params.ts_v;
  if (Object.keys(trackingSource).length > 0) groups['Tracking Source'] = trackingSource;

  // Performance Timing (ms)
  const performance = {};
  if (params.pf_net) performance['Network (pf_net)'] = `${params.pf_net} ms`;
  if (params.pf_srv) performance['Server (pf_srv)'] = `${params.pf_srv} ms`;
  if (params.pf_tfr) performance['Transfer (pf_tfr)'] = `${params.pf_tfr} ms`;
  if (params.pf_dm1) performance['DOM Processing (pf_dm1)'] = `${params.pf_dm1} ms`;
  if (params.pf_dm2) performance['DOM Complete (pf_dm2)'] = `${params.pf_dm2} ms`;
  if (params.pf_onl) performance['Window Load (pf_onl)'] = `${params.pf_onl} ms`;
  if (Object.keys(performance).length > 0) groups['Performance'] = performance;

  // Browser & Device
  const browser = {};
  if (params.res) browser['Resolution (res)'] = params.res;
  if (params.cookie) browser['Cookies (cookie)'] = params.cookie === '1' ? 'Enabled' : 'Disabled';
  if (params.lang) browser['Language (lang)'] = params.lang;
  // Plugin support flags
  const plugins = [];
  if (params.pdf === '1') plugins.push('PDF');
  if (params.fla === '1') plugins.push('Flash');
  if (params.java === '1') plugins.push('Java');
  if (params.ag === '1') plugins.push('Silverlight');
  if (params.wma === '1') plugins.push('WMA');
  if (params.realp === '1') plugins.push('RealPlayer');
  if (params.qt === '1') plugins.push('QuickTime');
  if (plugins.length > 0) browser['Plugins (pdf/fla/java/ag/wma/realp/qt)'] = plugins.join(', ');
  if (params.uadata) {
    try {
      const ua = JSON.parse(params.uadata);
      if (ua.platform) browser['Platform (uadata.platform)'] = ua.platform;
      if (ua.platformVersion) browser['Platform Version (uadata.platformVersion)'] = ua.platformVersion;
      if (ua.mobile !== undefined) browser['Mobile (uadata.mobile)'] = ua.mobile ? 'Yes' : 'No';
      if (ua.model) browser['Model (uadata.model)'] = ua.model;
      if (ua.fullVersionList) {
        const brands = ua.fullVersionList
          .filter(b => !b.brand.includes('Not'))
          .map(b => `${b.brand} ${b.version}`)
          .join(', ');
        if (brands) browser['Browser (uadata.fullVersionList)'] = brands;
      }
    } catch (e) {
      // Invalid JSON
    }
  }
  if (Object.keys(browser).length > 0) groups['Browser & Device'] = browser;

  // Content Groups
  const contentGroups = {};
  for (let i = 1; i <= 5; i++) {
    if (params[`cg${i}`]) contentGroups[`Group ${i} (cg${i})`] = params[`cg${i}`];
  }
  if (Object.keys(contentGroups).length > 0) groups['Content Groups'] = contentGroups;

  // Goal
  const goal = {};
  if (params.idgoal && params.idgoal !== '0') goal['Goal ID (idgoal)'] = params.idgoal;
  if (params.revenue && params.idgoal !== '0') goal['Revenue (revenue)'] = params.revenue;
  if (Object.keys(goal).length > 0) groups['Goal'] = goal;

  // Request
  const request = {};
  if (params.rec) request['Recording (rec)'] = params.rec === '1' ? 'Yes' : 'No';
  if (params.r) request['Cache Buster (r)'] = params.r;
  if (params.send_image) request['Response Type (send_image)'] = params.send_image === '0' ? 'HTTP 204' : 'Image';
  if (params.apiv) request['API Version (apiv)'] = params.apiv;
  if (params.ca) request['Custom Action (ca)'] = params.ca === '1' ? 'Yes' : 'No';
  if (params.h && params.m && params.s) request['Local Time (h/m/s)'] = `${params.h}:${params.m.padStart(2, '0')}:${params.s.padStart(2, '0')}`;
  if (params.cdt) request['Custom Datetime (cdt)'] = params.cdt;
  if (params.ping) {
    const pingLabels = { '1': 'Heartbeat', '2': 'Heartbeat', '3': 'Heartbeat', '4': 'Deanonymization', '5': 'Performance', '6': 'Custom' };
    request['Ping Type (ping)'] = pingLabels[params.ping] || params.ping;
  }
  if (Object.keys(request).length > 0) groups['Request'] = request;

  return groups;
}
