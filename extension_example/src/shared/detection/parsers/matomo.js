// Matomo (Piwik) Parsing Utilities
// Extracts event data from Matomo Tracking API requests
// Reference: https://developer.matomo.org/api-reference/tracking-api

/**
 * Parse a Matomo tracking request
 * Matomo sends data via query parameters on matomo.php/piwik.php
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text (form-encoded bulk requests)
 * @returns {Object} Parsed Matomo data
 */
export function parseMatomoRequestData(url, postData) {
  let params;
  try {
    const urlObj = new URL(url);
    params = Object.fromEntries(urlObj.searchParams.entries());
  } catch (e) {
    return {
      eventName: 'Matomo Request',
      overview: {},
      params: {},
      detectedBy: 'URL matches Matomo endpoint'
    };
  }

  // Also merge form-encoded POST body params (Matomo can send via POST)
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

  // Determine event type and name
  const eventName = determineEventName(params);

  // Build overview
  const overview = {};
  if (params.idsite) overview['Site ID'] = params.idsite;
  if (params.uid) overview['User ID'] = params.uid;
  if (params._id) overview['Visitor ID'] = params._id;
  if (params.url) overview['Page URL'] = params.url;

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

  // Extract e-commerce data
  const ecommerce = extractEcommerce(params);

  // Extract event tracking params
  const eventTracking = {};
  if (params.e_c) eventTracking['Category'] = params.e_c;
  if (params.e_a) eventTracking['Action'] = params.e_a;
  if (params.e_n) eventTracking['Name'] = params.e_n;
  if (params.e_v) eventTracking['Value'] = params.e_v;

  // Extract content tracking params
  const contentTracking = {};
  if (params.c_n) contentTracking['Content Name'] = params.c_n;
  if (params.c_p) contentTracking['Content Piece'] = params.c_p;
  if (params.c_t) contentTracking['Content Target'] = params.c_t;
  if (params.c_i) contentTracking['Interaction'] = params.c_i;

  // Build Custom Data section — groups of business data
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
    customData['Custom Variables'] = customVariables;
  }

  // Build grouped Parsed Data (system/protocol params)
  const groupedParams = buildGroupedParams(params);

  return {
    eventName,
    overview,
    customData,
    ecommerce,
    groupedParams,
    params,
    detectedBy: 'URL matches Matomo endpoint'
  };
}

/**
 * Determine the event name from Matomo parameters
 */
function determineEventName(params) {
  // Heartbeat ping
  if (params.ping === '1') {
    return 'Heartbeat Ping';
  }

  // E-commerce order
  if (params.ec_id) {
    return `Order: ${params.ec_id}`;
  }

  // E-commerce cart update (revenue without ec_id and idgoal=0)
  if (params.idgoal === '0' && params.revenue) {
    return 'Cart Update';
  }

  // Goal conversion
  if (params.idgoal && params.idgoal !== '0') {
    return `Goal ${params.idgoal}`;
  }

  // Event tracking
  if (params.e_c) {
    const parts = [params.e_c, params.e_a, params.e_n].filter(Boolean);
    return `Event: ${parts.join(' / ')}`;
  }

  // Content tracking
  if (params.c_n) {
    return `Content: ${params.c_n}`;
  }

  // Site search
  if (params.search) {
    return `Search: ${params.search}`;
  }

  // Outlink
  if (params.link) {
    return 'Outlink';
  }

  // Download
  if (params.download) {
    return 'Download';
  }

  // Crash/error tracking
  if (params.ca === '1' && params.cra) {
    return 'Crash Report';
  }

  // Media tracking
  if (params.ma_id) {
    return `Media: ${params.ma_ti || params.ma_id}`;
  }

  // Page view (default)
  if (params.action_name) {
    return params.action_name;
  }

  return 'Page View';
}

/**
 * Extract e-commerce items from ec_items parameter
 */
function extractEcommerce(params) {
  if (!params.ec_items) return null;

  try {
    const items = JSON.parse(params.ec_items);
    if (!Array.isArray(items) || items.length === 0) return null;

    const result = {
      summary: {},
      items: []
    };

    if (params.ec_id) result.summary['Order ID (ec_id)'] = params.ec_id;
    if (params.revenue) result.summary['Revenue (revenue)'] = params.revenue;
    if (params.ec_st) result.summary['Subtotal (ec_st)'] = params.ec_st;
    if (params.ec_tx) result.summary['Tax (ec_tx)'] = params.ec_tx;
    if (params.ec_sh) result.summary['Shipping (ec_sh)'] = params.ec_sh;
    if (params.ec_dt) result.summary['Discount (ec_dt)'] = params.ec_dt;

    // Items format: [[sku, name, category, price, quantity], ...]
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
    return null;
  }
}

/**
 * Build grouped system/protocol parameters for Parsed Data section.
 * Keys use "Human Label (param)" format so users can map back to the raw request.
 */
function buildGroupedParams(params) {
  const groups = {};

  // Page Context
  const pageContext = {};
  if (params.action_name) pageContext['Page Title (action_name)'] = params.action_name;
  if (params.url) pageContext['URL (url)'] = params.url;
  if (params.urlref) pageContext['Referrer (urlref)'] = params.urlref;
  if (params._ref) pageContext['Referrer URL (_ref)'] = params._ref;
  if (params.link) pageContext['Outlink URL (link)'] = params.link;
  if (params.download) pageContext['Download URL (download)'] = params.download;
  if (params.search) pageContext['Search Keyword (search)'] = params.search;
  if (params.search_cat) pageContext['Search Category (search_cat)'] = params.search_cat;
  if (params.search_count) pageContext['Search Results (search_count)'] = params.search_count;
  if (params.cs) pageContext['Charset (cs)'] = params.cs;
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
  if (params._rcn) session['Campaign Name (_rcn)'] = params._rcn;
  if (params._rck) session['Campaign Keyword (_rck)'] = params._rck;
  if (Object.keys(session).length > 0) groups['Session'] = session;

  // Performance Timing (ms)
  const performance = {};
  if (params.pf_net) performance['Network (pf_net)'] = `${params.pf_net} ms`;
  if (params.pf_srv) performance['Server (pf_srv)'] = `${params.pf_srv} ms`;
  if (params.pf_tfr) performance['Transfer (pf_tfr)'] = `${params.pf_tfr} ms`;
  if (params.pf_dm1) performance['DOM Processing (pf_dm1)'] = `${params.pf_dm1} ms`;
  if (params.pf_dm2) performance['DOM Complete (pf_dm2)'] = `${params.pf_dm2} ms`;
  if (params.pf_onl) performance['Window Load (pf_onl)'] = `${params.pf_onl} ms`;
  if (params.gt_ms) performance['Generation Time (gt_ms)'] = `${params.gt_ms} ms`;
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
      if (ua.formFactors) browser['Form Factor (uadata.formFactors)'] = ua.formFactors.join(', ');
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

  // Form Analytics
  const formAnalytics = {};
  if (params.fa_pv) formAnalytics['Page Has Forms (fa_pv)'] = params.fa_pv === '1' ? 'Yes' : 'No';
  // Extract fa_fp array entries
  const forms = {};
  for (const [key, value] of Object.entries(params)) {
    const faMatch = key.match(/^fa_fp\[(\d+)]\[(\w+)]$/);
    if (faMatch) {
      const idx = faMatch[1];
      const field = faMatch[2];
      if (!forms[idx]) forms[idx] = {};
      const fieldNames = { fa_vid: 'View ID', fa_id: 'Form ID', fa_fv: 'Form Version', fa_ts: 'Time Spent', fa_ht: 'Hesitation', fa_su: 'Submitted', fa_co: 'Converted', fa_st: 'Started', fa_fi: 'Field Interactions' };
      forms[idx][fieldNames[field] || field] = value;
    }
  }
  const formEntries = Object.values(forms);
  if (formEntries.length > 0) {
    formEntries.forEach((form, i) => {
      const label = form['Form ID'] || `Form ${i + 1}`;
      formAnalytics[label] = Object.entries(form)
        .filter(([k]) => k !== 'Form ID')
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
    });
  }
  if (Object.keys(formAnalytics).length > 0) groups['Form Analytics'] = formAnalytics;

  // Request
  const request = {};
  if (params.rec) request['Recording (rec)'] = params.rec === '1' ? 'Yes' : 'No';
  if (params.r) request['Cache Buster (r)'] = params.r;
  if (params.send_image) request['Response Type (send_image)'] = params.send_image === '0' ? 'HTTP 204' : 'Image';
  if (params.apiv) request['API Version (apiv)'] = params.apiv;
  if (params.h && params.m && params.s) request['Local Time (h/m/s)'] = `${params.h}:${params.m.padStart(2, '0')}:${params.s.padStart(2, '0')}`;
  if (params.cdt) request['Custom Datetime (cdt)'] = params.cdt;
  if (params.queuedtracking) request['Queued Tracking (queuedtracking)'] = params.queuedtracking === '0' ? 'Bypassed' : 'Enabled';
  if (params.ping) request['Heartbeat Ping (ping)'] = 'Yes';
  if (Object.keys(request).length > 0) groups['Request'] = request;

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

  // Crash tracking
  const crash = {};
  if (params.cra) crash['Message (cra)'] = params.cra;
  if (params.cra_st) crash['Stack Trace (cra_st)'] = params.cra_st;
  if (params.cra_ct) crash['Category (cra_ct)'] = params.cra_ct;
  if (params.cra_tp) crash['Type (cra_tp)'] = params.cra_tp;
  if (params.cra_ru) crash['Source File (cra_ru)'] = params.cra_ru;
  if (params.cra_rl) crash['Source Line (cra_rl)'] = params.cra_rl;
  if (params.cra_rc) crash['Source Column (cra_rc)'] = params.cra_rc;
  if (Object.keys(crash).length > 0) groups['Crash'] = crash;

  // Media Analytics
  const media = {};
  if (params.ma_id) media['Resource ID (ma_id)'] = params.ma_id;
  if (params.ma_ti) media['Title (ma_ti)'] = params.ma_ti;
  if (params.ma_re) media['Resource URL (ma_re)'] = params.ma_re;
  if (params.ma_mt) media['Type (ma_mt)'] = params.ma_mt;
  if (params.ma_pn) media['Player (ma_pn)'] = params.ma_pn;
  if (params.ma_st) media['Time To Play (ma_st)'] = `${params.ma_st} s`;
  if (params.ma_le) media['Duration (ma_le)'] = `${params.ma_le} s`;
  if (params.ma_ps) media['Progress (ma_ps)'] = `${params.ma_ps} s`;
  if (params.ma_w) media['Width (ma_w)'] = params.ma_w;
  if (params.ma_h) media['Height (ma_h)'] = params.ma_h;
  if (params.ma_fs) media['Fullscreen (ma_fs)'] = params.ma_fs === '1' ? 'Yes' : 'No';
  if (Object.keys(media).length > 0) groups['Media'] = media;

  return groups;
}
