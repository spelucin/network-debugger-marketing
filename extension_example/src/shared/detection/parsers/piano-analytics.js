// Piano Analytics (formerly AT Internet) Parsing Utilities
// Extracts event data from pa.piano.io, xiti.com, and at-o.net requests
// Piano uses GET requests with query parameters for event tracking

// Piano event parameter names → human-readable labels
const PIANO_PARAMS = {
  // Event identification
  s: 'Site ID',
  s2: 'Site Level 2',
  p: 'Page Name',
  events: 'Events',
  type: 'Event Type',
  // Page context
  pchap: 'Page Chapter 1',
  pchap2: 'Page Chapter 2',
  pchap3: 'Page Chapter 3',
  ptype: 'Page Type',
  plng: 'Page Language',
  // Visitor / Identity
  idclient: 'Client ID',
  an: 'Visitor ID (anonymous)',
  at: 'Visitor ID (authenticated)',
  // Technical
  stc: 'Custom Variables (JSON)',
  olt: 'Offline Mode',
  vtag: 'SDK Version',
  ptag: 'SDK Type',
  dp: 'Page Duration',
  ref: 'Referrer',
  // Campaign
  xto: 'Campaign Tag (xto)',
  xts: 'Campaign Tracking Site',
  // E-commerce
  tp: 'Product Type',
  pdtl: 'Product Detail',
  // Rich media
  a: 'Action',
  rp: 'Rich Media Player',
  rm: 'Rich Media Content',
  // Custom
  x1: 'Custom Var 1',
  x2: 'Custom Var 2',
  x3: 'Custom Var 3',
  x4: 'Custom Var 4',
  x5: 'Custom Var 5',
  x6: 'Custom Var 6',
  x7: 'Custom Var 7',
  x8: 'Custom Var 8',
  x9: 'Custom Var 9',
  x10: 'Custom Var 10'
};

/**
 * Parse a Piano Analytics request and return structured event data
 * @param {string} url - Request URL
 * @returns {Object} Parsed Piano Analytics data
 */
export function parsePianoAnalyticsData(url) {
  const urlObj = new URL(url);
  const params = Object.fromEntries(urlObj.searchParams);

  // Event name from 'events' array or 'p' (page name) or path-based detection
  let eventName = 'Page View';
  if (params.events) {
    // Piano v3 sends events as JSON array: [{"name":"page.display","data":{...}}]
    try {
      const eventsArray = JSON.parse(params.events);
      if (Array.isArray(eventsArray) && eventsArray[0]?.name) {
        eventName = eventsArray[0].name;
      }
    } catch (e) {
      // May be a simple event name string
      eventName = params.events;
    }
  } else if (params.type) {
    eventName = params.type;
  } else if (params.a) {
    // Rich media action
    eventName = `Rich Media: ${params.a}`;
  }

  const siteId = params.s;

  // Build overview
  const overview = {};
  if (siteId) overview['Site ID'] = siteId;
  if (params.p) overview['Page'] = params.p;
  if (params.s2) overview['Level 2'] = params.s2;

  // --- Custom Data: event properties (from events JSON or stc JSON) ---
  const customData = {};

  // Parse events array for custom event data (Piano v3 format)
  if (params.events) {
    try {
      const eventsArray = JSON.parse(params.events);
      if (Array.isArray(eventsArray)) {
        eventsArray.forEach((ev, i) => {
          if (ev.data && typeof ev.data === 'object' && Object.keys(ev.data).length > 0) {
            const sectionName = eventsArray.length > 1
              ? `Event Data (${ev.name || i + 1})`
              : 'Event Data';
            customData[sectionName] = ev.data;
          }
        });
      }
    } catch (e) { /* not JSON array */ }
  }

  // Parse stc (custom variables as JSON)
  if (params.stc) {
    try {
      const stcData = JSON.parse(params.stc);
      if (typeof stcData === 'object' && Object.keys(stcData).length > 0) {
        customData['Custom Variables'] = stcData;
      }
    } catch (e) { /* not JSON */ }
  }

  // Custom variables (x1-x10)
  const customVars = {};
  for (let i = 1; i <= 20; i++) {
    const key = `x${i}`;
    if (params[key]) customVars[`Custom Var ${i} (${key})`] = params[key];
  }
  if (Object.keys(customVars).length > 0) {
    customData['Custom Variables (Legacy)'] = customVars;
  }

  // --- Grouped Parsed Data (system/protocol params) ---
  const groupedParams = {};

  // Page Context
  const pageContext = {};
  if (params.p) pageContext['Page Name (p)'] = params.p;
  if (params.pchap) pageContext['Chapter 1 (pchap)'] = params.pchap;
  if (params.pchap2) pageContext['Chapter 2 (pchap2)'] = params.pchap2;
  if (params.pchap3) pageContext['Chapter 3 (pchap3)'] = params.pchap3;
  if (params.ptype) pageContext['Page Type (ptype)'] = params.ptype;
  if (params.plng) pageContext['Page Language (plng)'] = params.plng;
  if (params.ref) pageContext['Referrer (ref)'] = params.ref;
  if (params.dp) pageContext['Page Duration (dp)'] = params.dp;
  if (Object.keys(pageContext).length > 0) {
    groupedParams['Page Context'] = pageContext;
  }

  // Identity
  const identity = {};
  if (siteId) identity['Site ID (s)'] = siteId;
  if (params.s2) identity['Level 2 (s2)'] = params.s2;
  if (params.idclient) identity['Client ID (idclient)'] = params.idclient;
  if (params.an) identity['Anonymous ID (an)'] = params.an;
  if (params.at) identity['Authenticated ID (at)'] = params.at;
  if (Object.keys(identity).length > 0) {
    groupedParams['Identity'] = identity;
  }

  // Campaign
  const campaign = {};
  if (params.xto) campaign['Campaign Tag (xto)'] = params.xto;
  if (params.xts) campaign['Campaign Site (xts)'] = params.xts;
  if (params.xtdt) campaign['Campaign Date (xtdt)'] = params.xtdt;
  if (Object.keys(campaign).length > 0) {
    groupedParams['Campaign'] = campaign;
  }

  // E-Commerce
  const ecommerce = {};
  if (params.tp) ecommerce['Product Type (tp)'] = params.tp;
  if (params.pdtl) ecommerce['Product Detail (pdtl)'] = params.pdtl;
  if (params.mc) ecommerce['Cart ID (mc)'] = params.mc;
  if (Object.keys(ecommerce).length > 0) {
    groupedParams['E-Commerce'] = ecommerce;
  }

  // Rich Media
  const richMedia = {};
  if (params.a) richMedia['Action (a)'] = params.a;
  if (params.rp) richMedia['Player (rp)'] = params.rp;
  if (params.rm) richMedia['Content (rm)'] = params.rm;
  if (params.m1) richMedia['Duration (m1)'] = params.m1;
  if (params.m5) richMedia['Position (m5)'] = params.m5;
  if (params.m6) richMedia['Broadcast Type (m6)'] = params.m6;
  if (Object.keys(richMedia).length > 0) {
    groupedParams['Rich Media'] = richMedia;
  }

  // Request / Technical
  const requestData = {};
  if (params.vtag) requestData['SDK Version (vtag)'] = params.vtag;
  if (params.ptag) requestData['SDK Type (ptag)'] = params.ptag;
  if (params.olt) requestData['Offline Mode (olt)'] = params.olt;
  if (params.r) requestData['Screen Resolution (r)'] = params.r;
  if (params.re) requestData['Viewport (re)'] = params.re;
  if (params.hl) requestData['Timestamp (hl)'] = params.hl;
  if (params.lng) requestData['Browser Language (lng)'] = params.lng;
  if (params.cn) requestData['Connection Type (cn)'] = params.cn;
  if (Object.keys(requestData).length > 0) {
    groupedParams['Request'] = requestData;
  }

  let detectedBy;
  if (url.includes('pa.piano.io')) detectedBy = 'URL contains pa.piano.io';
  else if (url.includes('xiti.com')) detectedBy = 'URL contains xiti.com';
  else if (url.includes('at-o.net')) detectedBy = 'URL contains at-o.net';
  else if (url.includes('aticdn.net')) detectedBy = 'URL contains aticdn.net';
  else detectedBy = 'URL matches Piano Analytics pattern';

  return {
    eventName,
    siteId,
    overview,
    customData,
    groupedParams,
    params,
    detectedBy
  };
}
