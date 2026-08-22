// Snowplow Tracker Protocol Parsing Utilities
// Extracts event data from Snowplow collector endpoints
// Protocol docs: https://docs.snowplow.io/docs/sources/trackers/snowplow-tracker-protocol/

/**
 * Decode Base64 (standard or URL-safe) and parse as JSON if possible
 * @param {string} value - Base64-encoded string
 * @returns {any} Decoded value (parsed JSON object, or decoded string, or original)
 */
function decodeSnowplowBase64(value) {
  if (typeof value !== 'string' || value.length < 4) return value;
  try {
    // Convert URL-safe Base64 to standard
    let b64 = value.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (b64.length % 4 !== 0) b64 += '=';
    const decoded = atob(b64);
    try {
      return JSON.parse(decoded);
    } catch (e) {
      return decoded;
    }
  } catch (e) {
    return value;
  }
}

/** Snowplow event type codes → human-readable names */
const EVENT_TYPES = {
  pv: 'Page View',
  pp: 'Page Ping',
  ue: 'Self-Describing Event',
  se: 'Structured Event',
  tr: 'Transaction',
  ti: 'Transaction Item'
};

/**
 * Parse a single Snowplow event object (from GET params or POST data[] element)
 * @param {Object} ev - Event key-value pairs
 * @returns {Object} Parsed event data
 */
function parseSnowplowEvent(ev) {
  const eventType = ev.e;
  let eventName = EVENT_TYPES[eventType] || eventType || 'Unknown';

  // For structured events, use category:action as the event name
  if (eventType === 'se' && ev.se_ca) {
    eventName = ev.se_ac ? `${ev.se_ca}: ${ev.se_ac}` : ev.se_ca;
  }

  // For self-describing events, try to extract the schema name
  let selfDescribingData = null;
  let contextEntities = null;

  // Self-describing event: ue_px (Base64) or ue_pr (plain JSON)
  if (ev.ue_px) {
    selfDescribingData = decodeSnowplowBase64(ev.ue_px);
  } else if (ev.ue_pr) {
    try { selfDescribingData = JSON.parse(ev.ue_pr); } catch (e) { selfDescribingData = ev.ue_pr; }
  }

  // Extract schema-based event name for self-describing events
  if (selfDescribingData?.data?.schema) {
    const schemaMatch = selfDescribingData.data.schema.match(/\/([^/]+)\/jsonschema\//);
    if (schemaMatch) {
      eventName = schemaMatch[1].replace(/_/g, ' ');
    }
  }

  // Context entities: cx (Base64) or co (plain JSON)
  if (ev.cx) {
    contextEntities = decodeSnowplowBase64(ev.cx);
  } else if (ev.co) {
    try { contextEntities = JSON.parse(ev.co); } catch (e) { contextEntities = ev.co; }
  }

  return { eventName, eventType, selfDescribingData, contextEntities, raw: ev };
}

/**
 * Parse a Snowplow request and return structured event data
 * Supports both GET (single event) and POST (batched events) formats
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text
 * @returns {Object} Parsed Snowplow data with events array
 */
export function parseSnowplowData(url, postData) {
  const urlObj = new URL(url);
  const events = [];
  let isPost = false;

  // POST format: { schema: "...", data: [{ e: "pv", ... }, ...] }
  if (postData) {
    try {
      const body = JSON.parse(postData);
      if (body.data && Array.isArray(body.data)) {
        isPost = true;
        for (const ev of body.data) {
          events.push(parseSnowplowEvent(ev));
        }
      } else if (typeof body === 'object' && body.e) {
        // Single event in POST body
        events.push(parseSnowplowEvent(body));
      }
    } catch (e) { /* not JSON */ }
  }

  // GET format: all params on the URL (single event)
  if (events.length === 0) {
    const params = Object.fromEntries(urlObj.searchParams);
    if (params.e || params.aid || params.p) {
      events.push(parseSnowplowEvent(params));
    }
  }

  // Use first event for the primary display
  const primary = events[0] || { eventName: 'Request', raw: {} };
  const ev = primary.raw;

  // Build overview
  const overview = {};
  if (ev.aid) overview['App ID'] = ev.aid;
  overview['Event Type'] = EVENT_TYPES[ev.e] || ev.e || 'Unknown';
  if (ev.tna) overview['Tracker'] = ev.tna;
  if (events.length > 1) overview['Batch Size'] = String(events.length);

  // --- Custom Data: self-describing event data + context entities ---
  const customData = {};

  if (primary.selfDescribingData?.data?.data && typeof primary.selfDescribingData.data.data === 'object') {
    const sdData = primary.selfDescribingData.data.data;
    const sdFields = {};
    for (const [k, v] of Object.entries(sdData)) {
      sdFields[k] = typeof v === 'object' ? JSON.stringify(v) : v;
    }
    if (Object.keys(sdFields).length > 0) {
      // Use schema name as section title
      const schemaMatch = primary.selfDescribingData.data.schema?.match(/\/([^/]+)\/jsonschema\//);
      const sectionName = schemaMatch ? schemaMatch[1].replace(/_/g, ' ') : 'Self-Describing Data';
      customData[sectionName] = sdFields;
    }
  }

  // Context entities
  if (primary.contextEntities?.data && Array.isArray(primary.contextEntities.data)) {
    for (const ctx of primary.contextEntities.data) {
      if (ctx.schema && ctx.data && typeof ctx.data === 'object') {
        const ctxMatch = ctx.schema.match(/\/([^/]+)\/jsonschema\//);
        const ctxName = ctxMatch ? ctxMatch[1].replace(/_/g, ' ') : 'Context';
        const ctxFields = {};
        for (const [k, v] of Object.entries(ctx.data)) {
          ctxFields[k] = typeof v === 'object' ? JSON.stringify(v) : v;
        }
        if (Object.keys(ctxFields).length > 0) {
          customData[ctxName] = ctxFields;
        }
      }
    }
  }

  // --- Grouped Parsed Data (system/protocol params) ---
  const groupedParams = {};

  // Event Info
  const eventInfo = {};
  if (ev.e) eventInfo['Event Type (e)'] = EVENT_TYPES[ev.e] || ev.e;
  if (ev.eid) eventInfo['Event ID (eid)'] = ev.eid;
  // Structured event fields
  if (ev.se_ca) eventInfo['Category (se_ca)'] = ev.se_ca;
  if (ev.se_ac) eventInfo['Action (se_ac)'] = ev.se_ac;
  if (ev.se_la) eventInfo['Label (se_la)'] = ev.se_la;
  if (ev.se_pr) eventInfo['Property (se_pr)'] = ev.se_pr;
  if (ev.se_va) eventInfo['Value (se_va)'] = ev.se_va;
  // Self-describing event schema
  if (primary.selfDescribingData?.data?.schema) {
    eventInfo['Schema'] = primary.selfDescribingData.data.schema;
  }
  if (Object.keys(eventInfo).length > 0) {
    groupedParams['Event'] = eventInfo;
  }

  // Identity
  const identity = {};
  if (ev.duid) identity['Domain User ID (duid)'] = ev.duid;
  if (ev.nuid) identity['Network User ID (nuid)'] = ev.nuid;
  if (ev.sid) identity['Session ID (sid)'] = ev.sid;
  if (ev.vid) identity['Session Index (vid)'] = ev.vid;
  if (ev.uid) identity['User ID (uid)'] = ev.uid;
  if (ev.ip) identity['IP Address (ip)'] = ev.ip;
  if (Object.keys(identity).length > 0) {
    groupedParams['Identity'] = identity;
  }

  // Page Context
  const pageContext = {};
  if (ev.url) pageContext['Page URL (url)'] = ev.url;
  if (ev.page) pageContext['Page Title (page)'] = ev.page;
  if (ev.refr) pageContext['Referrer (refr)'] = ev.refr;
  // Page ping fields
  if (ev.pp_mix) pageContext['Min X Offset (pp_mix)'] = ev.pp_mix;
  if (ev.pp_max) pageContext['Max X Offset (pp_max)'] = ev.pp_max;
  if (ev.pp_miy) pageContext['Min Y Offset (pp_miy)'] = ev.pp_miy;
  if (ev.pp_may) pageContext['Max Y Offset (pp_may)'] = ev.pp_may;
  if (Object.keys(pageContext).length > 0) {
    groupedParams['Page Context'] = pageContext;
  }

  // Device
  const device = {};
  if (ev.res) device['Screen Resolution (res)'] = ev.res;
  if (ev.vp) device['Viewport (vp)'] = ev.vp;
  if (ev.ds) device['Document Size (ds)'] = ev.ds;
  if (ev.lang) device['Language (lang)'] = ev.lang;
  if (ev.tz) device['Timezone (tz)'] = ev.tz;
  if (ev.cookie) device['Cookies Enabled (cookie)'] = ev.cookie;
  if (ev.cs) device['Charset (cs)'] = ev.cs;
  if (ev.cd) device['Color Depth (cd)'] = ev.cd;
  if (Object.keys(device).length > 0) {
    groupedParams['Device'] = device;
  }

  // Tracker
  const tracker = {};
  if (ev.tv) tracker['Tracker Version (tv)'] = ev.tv;
  if (ev.tna) tracker['Tracker Namespace (tna)'] = ev.tna;
  if (ev.aid) tracker['App ID (aid)'] = ev.aid;
  if (ev.p) {
    const platforms = { web: 'Web', mob: 'Mobile', pc: 'PC', srv: 'Server', app: 'App', tv: 'TV', cnsl: 'Console', iot: 'IoT' };
    tracker['Platform (p)'] = platforms[ev.p] || ev.p;
  }
  if (Object.keys(tracker).length > 0) {
    groupedParams['Tracker'] = tracker;
  }

  // Timing
  const timing = {};
  if (ev.dtm) timing['Device Timestamp (dtm)'] = ev.dtm;
  if (ev.stm) timing['Sent Timestamp (stm)'] = ev.stm;
  if (ev.ttm) timing['True Timestamp (ttm)'] = ev.ttm;
  if (Object.keys(timing).length > 0) {
    groupedParams['Timing'] = timing;
  }

  // Transaction (for tr/ti events)
  if (ev.e === 'tr' || ev.e === 'ti') {
    const transaction = {};
    if (ev.tr_id) transaction['Transaction ID (tr_id)'] = ev.tr_id;
    if (ev.tr_af) transaction['Affiliation (tr_af)'] = ev.tr_af;
    if (ev.tr_tt) transaction['Total (tr_tt)'] = ev.tr_tt;
    if (ev.tr_tx) transaction['Tax (tr_tx)'] = ev.tr_tx;
    if (ev.tr_sh) transaction['Shipping (tr_sh)'] = ev.tr_sh;
    if (ev.tr_ci) transaction['City (tr_ci)'] = ev.tr_ci;
    if (ev.tr_st) transaction['State (tr_st)'] = ev.tr_st;
    if (ev.tr_co) transaction['Country (tr_co)'] = ev.tr_co;
    if (ev.tr_cu) transaction['Currency (tr_cu)'] = ev.tr_cu;
    // Transaction item fields
    if (ev.ti_id) transaction['Item Transaction ID (ti_id)'] = ev.ti_id;
    if (ev.ti_sk) transaction['Item SKU (ti_sk)'] = ev.ti_sk;
    if (ev.ti_nm) transaction['Item Name (ti_nm)'] = ev.ti_nm;
    if (ev.ti_ca) transaction['Item Category (ti_ca)'] = ev.ti_ca;
    if (ev.ti_pr) transaction['Item Price (ti_pr)'] = ev.ti_pr;
    if (ev.ti_qu) transaction['Item Quantity (ti_qu)'] = ev.ti_qu;
    if (ev.ti_cu) transaction['Item Currency (ti_cu)'] = ev.ti_cu;
    if (Object.keys(transaction).length > 0) {
      groupedParams['Transaction'] = transaction;
    }
  }

  // Detection
  let detectedBy;
  if (urlObj.pathname.includes('/com.snowplowanalytics.snowplow/')) {
    detectedBy = 'URL contains /com.snowplowanalytics.snowplow/ (Snowplow collector path)';
  } else if (urlObj.pathname === '/i' && urlObj.searchParams.has('aid')) {
    detectedBy = 'URL matches /i?aid= (Snowplow GET endpoint)';
  } else {
    detectedBy = 'URL matches Snowplow pattern';
  }

  return {
    eventName: primary.eventName,
    events,
    overview,
    customData,
    groupedParams,
    params: primary.raw,
    postData: postData ? (() => { try { return JSON.parse(postData); } catch (e) { return null; } })() : null,
    detectedBy
  };
}
