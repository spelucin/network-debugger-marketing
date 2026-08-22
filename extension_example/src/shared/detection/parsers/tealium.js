// Tealium Parsing Utilities
// Formats Tealium utag_data, utag.view(), utag.link() events (JS interception)
// and Tealium Collect HTTP requests (network detection)
// for the property table display pattern (formatted.overview + formatted.sections)

// =============================================================================
// TEALIUM TID (Template ID) TO VENDOR MAPPING
// =============================================================================
// TIDs are consistent across all Tealium accounts — they identify the vendor template type.
// Source: Reverse-engineered from live loader.cfg payloads across 13+ Tealium implementations.
// Reference: docs/inspiration/tealium_tid_mapping.json

/**
 * Static mapping of Tealium Template IDs (TID) to vendor information
 * Used to enrich utag.XXX.js script load events with vendor names
 *
 * Fields:
 * - compact: Short display name for event stream
 * - confidence: 'confirmed' | 'high' | 'medium'
 * - evidence: Research evidence string (shown in detail view)
 * - platformId (optional): Our platform registry ID, enables badge display
 */
export const TEALIUM_TID_VENDORS = {
  // Adobe
  '1191': { compact: 'Adobe AEP SDK', confidence: 'confirmed', evidence: 'Sender data: adobe_org_id, config, customer_ids, events. Seen on nordea.dk, cathaypacific.com.', platformId: 'adobe-experience-platform' },
  '1220': { compact: 'Adobe AEP SDK (Alloy)', confidence: 'confirmed', evidence: 'Sender data: library_version, edgeConfigId, orgId, context, debugEnabled, edgeDomain, instanceName. Seen on tui.co.uk.', platformId: 'adobe-experience-platform' },
  '19063': { compact: 'Adobe Analytics', confidence: 'confirmed', evidence: 'Sender data: adobe_org_id, cookieDomain, serial, linkName, linkType, clearVars, sendBeacon. Seen on nordea.dk, vodafone.co.uk, cathaypacific.com.', platformId: 'adobe-analytics' },
  '20108': { compact: 'Adobe Target', confidence: 'confirmed', evidence: 'Sender data: config with clientCode, imsOrgId, serverDomain, globalMboxName, targetPageParams. Seen on nordea.dk, ana.co.jp.', platformId: 'adobe-target' },

  // Google
  '2045': { compact: 'Google Analytics (UA)', confidence: 'high', evidence: 'Sender data: tagid, ec, ea, el, ev, gv, order_subtotal. Classic UA event parameters. Seen on hsbc.co.uk.', platformId: 'ga-universal' },
  '2063': { compact: 'GA4 (Custom Template)', confidence: 'confirmed', evidence: 'Sender data: tagid, product_id, product_name, product_brand, product_category. Enhanced ecommerce GA4. Seen on vodafone.co.uk.', platformId: 'ga4' },
  '7127': { compact: 'Google (Unknown)', confidence: 'medium', evidence: 'No sender data or base_url. Inline Google tag (7xxx range). Minimal: only id, ev, map, extend.' },
  '7132': { compact: 'Google Ads', confidence: 'confirmed', evidence: 'base_url loads with AW-xxx (Google Ads conversion ID). NOT GA4.', platformId: 'google-ads-conversion' },
  '7133': { compact: 'Google Analytics (UA)', confidence: 'confirmed', evidence: 'Sender data: tracking_id, cross_track, transport_type, allow_display_features, anonymize_ip, optimize_id. Classic UA via gtag.js. Seen on tui.co.uk.', platformId: 'ga-universal' },
  '7134': { compact: 'Google Consent Mode v1', confidence: 'high', evidence: 'No base_url (fires inline). Sets consent signals for other Google tags.', platformId: 'google-ccm' },
  '7142': { compact: 'GA4', confidence: 'confirmed', evidence: 'base_url loads with measurement_id template variable.', platformId: 'ga4' },
  '7143': { compact: 'Google Consent Mode v2', confidence: 'confirmed', evidence: 'Sender data: tealium_consent, ad_storage_consent, analytics_storage_consent, ads_data_redaction, url_passthrough, ad_user_data, ad_personalization.', platformId: 'google-ccm' },
  '7145': { compact: 'Google Tag (Generic)', confidence: 'high', evidence: '7xxx Google range. Seen on cathaypacific.com. Likely a newer or specialized Google tag variant.', platformId: 'gtag' },
  '4001': { compact: 'Floodlight (Legacy)', confidence: 'confirmed', evidence: 'Sender data: src, type, cat, multicat, ord, cost, qty, countertype, order_id. Legacy DoubleClick Floodlight (iframe/image pixel).', platformId: 'google-floodlight' },
  '4049': { compact: 'Floodlight (DCM/DV360)', confidence: 'confirmed', evidence: 'Sender data: advertiser_id, activity_group, activity, counting_method, fire_purchase, cross_track_domains. Seen on vodafone.co.uk, cathaypacific.com.', platformId: 'google-floodlight' },

  // Social & Advertising Pixels
  '6026': { compact: 'Facebook Pixel (Legacy)', confidence: 'confirmed', evidence: 'Sender data: cust_pixel, conv_pixel, page_view, calc_items, default_event, adv_match, track_single. Older template variant.', platformId: 'facebook' },
  '6037': { compact: 'Facebook Pixel', confidence: 'confirmed', evidence: 'base_url: connect.facebook.net/en_US/fbevents.js. Most widely deployed vendor tag.', platformId: 'facebook' },
  '1228': { compact: 'Snapchat Pixel', confidence: 'confirmed', evidence: 'Sender data: region, ids, auto_page_tracking, generate_event_id, email, phonenumber, gdpr. Snap CAPI parameters.', platformId: 'snapchat' },
  '18048': { compact: 'TikTok Pixel', confidence: 'confirmed', evidence: 'Sender data: account_id, send_page_visit, generate_event_id, itemCount, value, currency, email, externalId.', platformId: 'tiktok' },
  '20119': { compact: 'TikTok Pixel (v2)', confidence: 'confirmed', evidence: 'Sender data: pixel_code, event_id, auto_page_tracking, auto_purchase_tracking, email, sha256_email, phone_number. Updated template.', platformId: 'tiktok' },
  '2013': { compact: 'LinkedIn Insight Tag', confidence: 'confirmed', evidence: 'base_url: sjs.bizographics.com/insight.min.js', platformId: 'linkedin' },
  '12047': { compact: 'LinkedIn CAPI', confidence: 'confirmed', evidence: 'Sender data: partner_id, generate_event_id, conversionId, linkedin. Server-side conversion tracking.', platformId: 'linkedin' },
  '19129': { compact: 'Pinterest Tag', confidence: 'confirmed', evidence: 'Sender data: pixel_id, generate_event_id, auto_page_tracking, auto_purchase_tracking, item_category, item_ids.', platformId: 'pinterest' },
  '20103': { compact: 'X Pixel (Twitter)', confidence: 'confirmed', evidence: 'Sender data: twitter_pixel_id, event_name, event_value, content_type, num_items.', platformId: 'twitter' },
  '20200': { compact: 'X Conversion API', confidence: 'confirmed', evidence: 'Sender data: pixelId, generate_event_id, email_address, phone_number, external_id, twclid, conversion_id. Server-side X tracking.', platformId: 'twitter' },
  '16044': { compact: 'Reddit Pixel', confidence: 'confirmed', evidence: 'Sender data: tag_id, auto_page_view, generate_event_id, page_name, page_category, product_variant, search_query.', platformId: 'reddit' },
  '3170': { compact: 'Criteo', confidence: 'confirmed', evidence: 'Sender data: proxyPath, tagId, actionTrackerId, enterpriseId, enablePageVisit, order_id, order_subtotal, customer_id.', platformId: 'criteo' },
  '25028': { compact: 'Yahoo! JAPAN Ads', confidence: 'confirmed', evidence: 'Sender data: yahoo_ydn_conv_io, yahoo_ydn_conv_label, yahoo_retargeting_id, yahoo_retargeting_page_type.' },

  // Analytics & Session Replay
  '1236': { compact: 'Amplitude', confidence: 'confirmed', evidence: 'Sender data: api_key, sdk_version, autocapture, elementInteractions, deviceId, flushIntervalMillis, serverUrl, serverZone.', platformId: 'amplitude' },
  '8009': { compact: 'Hotjar', confidence: 'confirmed', evidence: 'base_url: static.hotjar.com/c/hotjar-XXXXXX.js', platformId: 'hotjar' },
  '3131': { compact: 'Contentsquare', confidence: 'confirmed', evidence: 'Sender data: id_project, custom, path, product_id, product_name, product_sku. Digital experience analytics.', platformId: 'contentsquare' },
  '13068': { compact: 'Mouseflow', confidence: 'confirmed', evidence: 'Sender data: account, mouseflow_disable_key_log, page_url, mouseflowPath, user_email.', platformId: 'mouseflow' },
  '17013': { compact: 'Quantum Metric', confidence: 'confirmed', evidence: 'Sender data: subscription_name, send_replay_url, replay_url, autoreplay, qmUserCookie, qmSessionCookie.', platformId: 'quantum-metric' },
  '19050': { compact: 'SessionCam / Glassbox', confidence: 'confirmed', evidence: 'base_url: d16fk4ms6rqz1v.cloudfront.net/capture/vodafoneuk.js. Session recording.', platformId: 'glassbox' },
  '15022': { compact: 'Piano Analytics', confidence: 'confirmed', evidence: 'Sender data: projectId, eventName, orderId, revenue. Piano Analytics (formerly AT Internet).', platformId: 'piano-analytics' },
  '3125': { compact: 'Gemius', confidence: 'confirmed', evidence: 'Sender data: identifier, lan, key, subs, free, section, pp_gemius_dnt. Gemius audience measurement.', platformId: 'gemius' },

  // Consent
  '3121': { compact: 'OneTrust', confidence: 'confirmed', evidence: 'Sender data: containerId, silentMode, consentStatus, events. Seen on cathaypacific.com.', platformId: 'onetrust' },

  // Marketing Automation & CRM
  '2043': { compact: 'Bizible (Marketo)', confidence: 'confirmed', evidence: 'base_url: cdn.bizible.com/scripts/bizible.js', platformId: 'marketo' },
  '13060': { compact: 'Marketo Munchkin', confidence: 'confirmed', evidence: 'base_url: munchkin.marketo.net/munchkin.js', platformId: 'marketo' },
  '1202': { compact: 'Braze', confidence: 'confirmed', evidence: 'Sender data: api_key, cst_url, enable_logging, initOpt, product_id, event, custom. Braze SDK web integration.', platformId: 'braze' },
  '12034': { compact: 'LivePerson', confidence: 'confirmed', evidence: 'Sender data: startLpTagFunc, ctmrinfo, mrktInfo. LivePerson Monitoring SDK.' },

  // Affiliate & Commerce
  '9043': { compact: 'Awin', confidence: 'confirmed', evidence: 'Sender data: acid, actionTrackerId, orderId, orderPromo. Awin affiliate tracking.', platformId: 'awin' },
  '18044': { compact: 'Awin / Zanox', confidence: 'high', evidence: 'Sender data: tagging_hash, region, eventType, categoryId, offerId, conversionClass, conversionSubClass.', platformId: 'awin' },
  '21012': { compact: 'Impact.com', confidence: 'confirmed', evidence: 'Sender data: trigger_code, account_id, order_id, order_total, order_currency, customer_id.', platformId: 'impact' },
  '20097': { compact: 'Partnerize', confidence: 'confirmed', evidence: 'Sender data: client_id, brand_id, tracker_type, action_name, site_id, action_id, revenue, promocode.' },
  '5002': { compact: 'Commission Factory', confidence: 'high', evidence: 'Sender data: account, convid, alias, displayorder, s4, system_name, action, product_id, order_id.' },
  '5042': { compact: 'Rakuten Advertising', confidence: 'confirmed', evidence: 'Sender data: src, acct, search_term, custom_event_name, streaming_updates, order_id, product_id, product_name.' },
  '20113': { compact: 'Rokt', confidence: 'confirmed', evidence: 'Sender data: client_name, event_name, notify, item-url, eventData, orderid, revenue, currency.' },
  '20105': { compact: 'TripAdvisor Pixel', confidence: 'confirmed', evidence: 'Sender data: pixel_id, data_share_tripadvisor, event_name, booking, partner_id, order_total, order_id.' },

  // Ad Tech & DSP
  '1203': { compact: 'Adform', confidence: 'confirmed', evidence: 'Sender data: campaignid, page_name, divider, adform_tracking_object, step, customer_agegroup, order_id, product_id.', platformId: 'adform' },
  '20117': { compact: 'StackAdapt', confidence: 'confirmed', evidence: 'Sender data: advertiserId, conversionType, base_url. StackAdapt programmatic advertising pixel.', platformId: 'stackadapt' },
  '25016': { compact: 'Teads', confidence: 'confirmed', evidence: 'Sender data: projectId, pixelId, coloId, qstrings, tagid, et, ec, ea, el, ev, advertiser_id.', platformId: 'teads' },
  '13120': { compact: 'Permutive', confidence: 'confirmed', evidence: 'Sender data: project_id, ad_storage, tealium_consent, events. Permutive publisher DMP/audience platform.', platformId: 'permutive' },
  '20099': { compact: 'Tealium + Trade Desk', confidence: 'confirmed', evidence: 'Sender data: base_url_req_ttdid, base_url_get_ttdid, ttd_pid, ttd_tpi, gdpr, gdpr_consent. Tealium native TTD ID sync.', platformId: 'thetradedesk' },
  '1199': { compact: 'Tealium + Xandr ID Sync', confidence: 'confirmed', evidence: 'Sender data: dc_base_url, tealium_account, tealium_profile, adnxs_uid, tealium_vid, iab_v20_compliance.', platformId: 'xandr' },

  // Audience Measurement
  '17001': { compact: 'Quantcast', confidence: 'confirmed', evidence: 'Sender data: qacct, source, orderid, revenue, event, labels. Quantcast audience measurement.', platformId: 'quantcast' },
  '13116': { compact: 'Monetate', confidence: 'confirmed', evidence: 'base_url: se.monetate.net/js/2/a-xxx/entry.js', platformId: 'monetate' },
  '13115': { compact: 'Ensighten', confidence: 'high', evidence: 'Sender data: sitecode, path. Tag analytics/tracking pixel.', platformId: 'ensighten' },
  '3147': { compact: 'Celebrus', confidence: 'confirmed', evidence: 'Sender data: csa_name, celebrus_collection_url, celebrus_page_url, celebrus_compact_version, celebrus_packet_version.' },
  '17003': { compact: 'Medallia / ForeSee', confidence: 'confirmed', evidence: 'Sender data: brandId, zoneId, interceptId, sampleRate, siteinterceptid. Medallia Digital VoC surveys.' },

  // Tealium Internal
  '20010': { compact: 'Tealium Collect', confidence: 'confirmed', evidence: 'Most common tid. Sends data to EventStream/AudienceStream.', platformId: 'tealium-collect' },
  '20011': { compact: 'Tealium Collect (Bulk)', confidence: 'medium', evidence: 'No sender data. 20xxx Tealium range, close to 20010.', platformId: 'tealium-collect' },
  '20052': { compact: 'Tealium (Unknown)', confidence: 'medium', evidence: 'No sender data extracted. 20xxx Tealium range.' },
  '20064': { compact: 'Tealium Generic Tag', confidence: 'confirmed', evidence: 'Flexible pixel/script loader for simple vendor integrations.' },
  '20067': { compact: 'Tealium Custom Container', confidence: 'confirmed', evidence: 'Template for custom JavaScript implementations.' },
  '20095': { compact: 'Tealium JSON-LD', confidence: 'high', evidence: 'Sender data: homepage_url, sitename, json_ld, product_id, product_sku.' },
  '17015': { compact: 'Tealium Moments API', confidence: 'confirmed', evidence: 'Sender data: account_code, tealium_account, tealium_profile. Tealium Moments real-time decisioning.' },
};

/**
 * Look up a Tealium Template ID (TID) to get vendor information
 * @param {string|number} tid - Template ID
 * @returns {{ compact: string, confidence: string, evidence: string, platformId?: string }|null}
 */
export function lookupTealiumTID(tid) {
  return TEALIUM_TID_VENDORS[String(tid)] || null;
}

// =============================================================================
// SYSTEM KEY PREFIXES — keys matching these are infrastructure, not business data
// =============================================================================

const TEALIUM_SYSTEM_PREFIXES = ['tealium_', 'ut.'];
const ANALYTICS_CONFIG_PREFIXES = ['adobe_', 'config_', 'wa_', 'cookie_', 'aep_'];
const DATA_SOURCE_PREFIXES = ['dom.', 'cp.', 'meta.', 'ls.'];
const ALL_SYSTEM_PREFIXES = [
  ...TEALIUM_SYSTEM_PREFIXES,
  ...ANALYTICS_CONFIG_PREFIXES,
  ...DATA_SOURCE_PREFIXES
];

// =============================================================================
// DATA CATEGORIZATION
// =============================================================================

/**
 * Categorize Tealium utag_data variables by type/prefix
 * Groups keys into logical categories for the utag_data State section
 * @param {Object} data - Full utag_data object
 * @returns {Object} Categorized data: { tealium, analytics, dom, cookies, meta, localStorage, custom }
 */
function categorizeTealiumData(data) {
  const categories = {
    tealium: {},
    analytics: {},
    dom: {},
    cookies: {},
    meta: {},
    localStorage: {},
    custom: {}
  };

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('tealium_') || key.startsWith('ut.')) {
      categories.tealium[key] = value;
    } else if (key.startsWith('dom.')) {
      categories.dom[key] = value;
    } else if (key.startsWith('cp.')) {
      categories.cookies[key] = value;
    } else if (key.startsWith('meta.')) {
      categories.meta[key] = value;
    } else if (key.startsWith('ls.')) {
      categories.localStorage[key] = value;
    } else if (key.startsWith('adobe_') || key.startsWith('config_') || key.startsWith('wa_') || key.startsWith('cookie_') || key.startsWith('aep_')) {
      categories.analytics[key] = value;
    } else {
      categories.custom[key] = value;
    }
  }

  return categories;
}

// Category key → display label, in the fixed order the State section renders them.
const TEALIUM_STATE_CATEGORY_LABELS = [
  ['tealium', 'Tealium System'],
  ['analytics', 'Analytics Config'],
  ['dom', 'DOM Variables'],
  ['cookies', 'Cookies'],
  ['meta', 'Meta Tags'],
  ['localStorage', 'Local Storage'],
  ['custom', 'Custom Variables']
];

/**
 * Build the labeled, categorized "utag_data State" structure from a UDO object.
 * Returns { data: { 'Tealium System': {...}, ... }, count } with empty-category groups
 * omitted; `count` reflects only the keys actually included. Single source for the
 * utag.view/link State section (full categorization) and the dedicated utag_data
 * data-layer renderer (#152, `systemOnly` — business data is already in the flat section).
 * @param {Object} data - utag_data / UDO object
 * @param {{ systemOnly?: boolean }} [opts] - when systemOnly, omit the business "Custom Variables" group
 * @returns {{ data: Object, count: number }}
 */
function buildCategorizedState(data, { systemOnly = false } = {}) {
  const categorized = categorizeTealiumData(data);
  const stateData = {};
  let count = 0;
  for (const [key, label] of TEALIUM_STATE_CATEGORY_LABELS) {
    if (systemOnly && key === 'custom') continue;
    const groupKeys = Object.keys(categorized[key]);
    if (groupKeys.length > 0) {
      stateData[label] = categorized[key];
      count += groupKeys.length;
    }
  }
  return { data: stateData, count };
}

/**
 * Check if a key is a system/infrastructure key (not business data)
 * @param {string} key - Parameter key
 * @returns {boolean}
 */
function isSystemKey(key) {
  if (key.startsWith('_')) return true;
  return ALL_SYSTEM_PREFIXES.some(prefix => key.startsWith(prefix));
}

// =============================================================================
// DATA SEPARATION
// =============================================================================

/**
 * Separate event data into custom (business) properties and system keys
 * Also extracts products array separately
 * @param {Object} eventData - The _eventData from the Tealium payload
 * @returns {{ custom: Object, products: Array }}
 */
function separateEventData(eventData) {
  const custom = {};
  let products = [];

  for (const [key, value] of Object.entries(eventData)) {
    if (key === 'products' && Array.isArray(value)) {
      products = value;
    } else if (!isSystemKey(key)) {
      custom[key] = formatValue(value);
    }
  }

  return { custom, products };
}

/**
 * Format a value for display in the property table
 * Converts arrays and objects to readable strings; passes primitives through
 * @param {*} value
 * @returns {string|number|boolean|null}
 */
function formatValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// =============================================================================
// PRODUCT EXTRACTION
// =============================================================================

/**
 * Format a single product object for table display
 * Flattens nested fields (variant) and formats arrays for readability
 * @param {Object} product - Raw product object from utag_data
 * @returns {Object} Flat key-value object for property table
 */
function formatProduct(product) {
  const formatted = {};

  for (const [key, value] of Object.entries(product)) {
    if (value === null || value === undefined) continue;

    if (key === 'variant' && typeof value === 'object' && !Array.isArray(value)) {
      // Flatten variant: { size: "256", color: "Sort" } → "256 / Sort"
      const parts = Object.values(value).filter(v => v !== null && v !== undefined);
      if (parts.length > 0) {
        formatted[key] = parts.join(' / ');
      }
    } else if (key === 'togetherWith' && Array.isArray(value)) {
      if (value.length > 0) {
        formatted[key] = value.join(', ');
      }
    } else if (key === 'attributes' && (value === null || (typeof value === 'object' && Object.keys(value).length === 0))) {
      // Skip empty attributes
    } else if (Array.isArray(value)) {
      formatted[key] = value.join(', ');
    } else if (typeof value === 'object') {
      formatted[key] = JSON.stringify(value);
    } else {
      formatted[key] = value;
    }
  }

  return formatted;
}

/**
 * Build products section data from a products array
 * Groups products by name/sku for the property table grouped layout
 * @param {Array} products - Array of product objects
 * @returns {Object} Nested object: { "Product Label": { key: value, ... }, ... }
 */
function buildProductsSection(products) {
  const data = {};

  products.forEach((product, i) => {
    const label = product.name || product.sku || `Product ${i + 1}`;
    data[label] = formatProduct(product);
  });

  return data;
}

// =============================================================================
// MAIN FORMATTER
// =============================================================================

/**
 * Format Tealium event data into structured display format
 * Produces the formatted.overview + formatted.sections structure used by
 * renderConfiguredDetail() in event-detail.js
 *
 * @param {Object} rawPayload - The raw Tealium payload from page script
 * @param {string} rawPayload._eventType - 'utag_data', 'view', or 'link'
 * @param {Object} rawPayload._eventData - Data passed to utag.view/link or the utag_data object
 * @param {Object|null} rawPayload._utag_data - Full utag_data snapshot
 * @param {boolean} rawPayload._isHistorical - Whether event was captured before debugger loaded
 * @param {number} rawPayload._tealiumEventIndex - Sequential event index
 * @param {string} rawPayload.tealium_event - Event name (if set)
 * @returns {Object} { eventName, eventType, isDataLayerEvent, overview, sections, dataLayerState }
 */
export function formatTealiumEventData(rawPayload) {
  const eventType = rawPayload._eventType || 'track';
  const eventData = rawPayload._eventData || {};
  const utagData = rawPayload._utag_data || null;
  const isHistorical = rawPayload._isHistorical || false;
  const eventIndex = rawPayload._tealiumEventIndex;

  // Determine event name
  let eventName = eventType === 'utag_data' ? 'utag_data' : `utag.${eventType}`;
  if (typeof eventData.tealium_event === 'string' && eventData.tealium_event) {
    eventName = eventData.tealium_event;
  } else if (typeof rawPayload.tealium_event === 'string' && rawPayload.tealium_event) {
    eventName = rawPayload.tealium_event;
  }

  // Build overview card
  const overview = {};
  if (eventType !== 'utag_data') {
    overview['Type'] = `utag.${eventType}()`;
  }
  overview['Event #'] = eventIndex;
  if (isHistorical) {
    overview['Note'] = 'Historical (before debugger loaded)';
  }

  // Separate business data from system keys, extract products
  const { custom, products } = separateEventData(eventData);

  // Build sections array
  const sections = [];

  // Business properties — title reflects the data source so users know the variable path
  // utag_data events: "utag_data" → path is utag_data.{key}
  // utag.view/link events: "Event Data" → data passed to the function call
  const customTitle = eventType === 'utag_data' ? 'utag_data' : 'Event Data';
  if (Object.keys(custom).length > 0) {
    sections.push({ title: customTitle, data: custom, type: 'table' });
  }

  // Products — if present, grouped by product name
  if (products.length > 0) {
    sections.push({
      title: `Products (${products.length})`,
      data: buildProductsSection(products),
      type: 'table',
      sortRows: false
    });
  }

  // utag_data State — categorized view (collapsed by default).
  // For utag.view/link the State section shows the full UDO snapshot (_utag_data),
  // which is genuinely different from the function-call args in "Event Data" above.
  // utag_data events skip this *section* — _eventData IS the UDO, so a flat State
  // section would duplicate the "utag_data" section above; the dedicated renderer
  // (#152) renders dataLayerState (built below) as the categorized State instead.
  if (eventType !== 'utag_data' && utagData && Object.keys(utagData).length > 0) {
    const state = buildCategorizedState(utagData);
    sections.push({
      title: `utag_data State (${state.count})`,
      data: state.data,
      type: 'table',
      expanded: false,
      diagnostic: true,
    });
  }

  // Categorized state for the dedicated utag_data data-layer renderer (#152).
  // System-only: the flat "utag_data" section above already shows the business data, so
  // the State section carries just Tealium's infrastructure keys (tealium_*, dom.*, cp.*,
  // meta.*, ls.*, analytics config). A real utag_data push is usually business-only — the
  // cp.*/dom.*/… keys are added by utag.js at send-time and ride the Collect beacon, NOT
  // the page's data-layer push — so this is null in the common case and the renderer omits
  // the State section entirely (no redundant duplicate of the flat section). utag.view/link
  // keep dataLayerState null; their full-categorization State section is built above.
  let dataLayerState = null;
  if (eventType === 'utag_data' && Object.keys(eventData).length > 0) {
    const state = buildCategorizedState(eventData, { systemOnly: true });
    if (state.count > 0) dataLayerState = state;
  }

  return {
    eventName,
    eventType,
    isDataLayerEvent: eventType === 'utag_data',
    overview,
    sections,
    dataLayerState
  };
}

// =============================================================================
// TEALIUM COLLECT PARSER (network requests to collect.tealiumiq.com)
// =============================================================================

/**
 * Extract JSON payload from multipart form-data body
 * Tealium Collect sends POST with Content-Type: multipart/form-data
 * containing a single "data" field with a JSON string
 * @param {string} body - Raw POST body
 * @returns {Object|null} Parsed JSON or null
 */
function extractMultipartJSON(body) {
  if (!body) return null;

  // Try direct JSON parse first (some requests use application/json)
  try {
    return JSON.parse(body);
  } catch (e) {
    // Not plain JSON, try multipart
  }

  // Extract JSON from multipart form-data
  // Pattern: boundary\r\nContent-Disposition: form-data; name="data"\r\n\r\n{...JSON...}\r\nboundary
  const jsonMatch = body.match(/name="data"\r?\n\r?\n([\s\S]*?)(?:\r?\n------|\r?\n$)/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (e) {
      // Malformed JSON
    }
  }

  // Fallback: find the largest JSON-like block in the body
  const braceMatch = body.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch (e) {
      // Not valid JSON
    }
  }

  return null;
}

/**
 * Additional system prefixes specific to Collect payloads
 * These appear in the data object but are infrastructure, not business data
 */
const COLLECT_SYSTEM_PREFIXES = [
  ...ALL_SYSTEM_PREFIXES,
  'js_page.',      // JavaScript page properties (screen size, utag.id, etc.)
  'timing.',       // Performance timing data
  'fb_event_id_',  // Facebook event dedup IDs
  'tci.',          // Tealium Consent Integration
  '__'             // Internal flags (__eventDebuggerReported, etc.)
];

/**
 * Tealium session-storage (`ss.*`) and other session-context keys that
 * utag.js auto-injects into every Collect payload regardless of what was
 * actually tracked. These include:
 *   - `ss.s_pec`            — Adobe Performance Event Capture log (multi-KB)
 *   - `ss.bmnet`            — BellMetric widget interaction blob
 *   - `ss.maze:widgets`     — Maze user-research widget state
 *   - `ss.u_scsid`/`u_scsid_r` — Snapchat session tokens (opaque)
 *   - `ss.AddressBarServiceCalled`, `ss.pixelRatio` — runtime flags
 *   - `browser_*`, `screen_*` — viewport / device fingerprint
 *   - `page_load_time`      — perf
 *   - `consent_cookie_*` / `statisticCookieConsent` / `marketingCookieConsent`
 *                           — cookie-name-form duplicates of the consent state
 *                             already shown in the Consent section
 * They're useful when troubleshooting Tealium itself but they aren't the
 * tracked event payload, so they're routed to a separate "Session State"
 * section flagged `diagnostic: true` — Basic skips them; detail view, AI
 * Ready, and Complete still render them.
 */
const COLLECT_SESSION_STATE_PREFIXES = [
  'ss.',
  'browser_',
  'screen_',
];
const COLLECT_SESSION_STATE_EXACT = new Set([
  'page_load_time',
  'statisticCookieConsent',
  'marketingCookieConsent',
  'consent_cookie_functional',
  'consent_cookie_statistic',
  'consent_cookie_marketing',
]);

/**
 * Check if a key is a system/infrastructure key in Collect context
 * More aggressive filtering than JS interception since Collect sends everything
 */
function isCollectSystemKey(key) {
  if (key.startsWith('_')) return true;
  return COLLECT_SYSTEM_PREFIXES.some(prefix => key.startsWith(prefix));
}

/**
 * Check if a key is a Tealium session-state passthrough — kept in the export
 * but routed to a diagnostic-flagged section instead of the main Event Data.
 */
function isCollectSessionStateKey(key) {
  if (COLLECT_SESSION_STATE_EXACT.has(key)) return true;
  return COLLECT_SESSION_STATE_PREFIXES.some(prefix => key.startsWith(prefix));
}

/**
 * Extract consent information from Collect data
 * @param {Object} data - The data object from Collect payload
 * @returns {Object|null} Consent data or null if no consent info found
 */
function extractConsentData(data) {
  const consent = {};

  // tci.consent_type (explicit, implicit)
  if (data['tci.consent_type']) {
    consent['Consent Type'] = data['tci.consent_type'];
  }

  // Consent categories translated (clean list)
  if (Array.isArray(data['consent_categories_translated'])) {
    consent['Categories'] = data['consent_categories_translated'].join(', ');
  }

  // Current consent decision (detailed with service names)
  if (Array.isArray(data['current_consent_decision'])) {
    consent['Active Consent'] = data['current_consent_decision'].join(', ');
  }

  return Object.keys(consent).length > 0 ? consent : null;
}

/**
 * Build a summary of loaded tags from loader.cfg
 * @param {Object} loaderCfg - The loader.cfg object from Collect payload
 * @returns {Object} Tag data for property table: { "Tag Label": { key: value } }
 */
function buildTagsSummary(loaderCfg) {
  const tags = {};
  for (const [tagId, cfg] of Object.entries(loaderCfg)) {
    const label = `Tag ${tagId}` + (cfg.tid ? ` (tid: ${cfg.tid})` : '');
    const tagData = {};
    if (cfg.src) {
      // Extract just the filename from the full URL
      const srcMatch = cfg.src.match(/\/([^/?]+)(?:\?|$)/);
      tagData['Source'] = srcMatch ? srcMatch[1] : cfg.src;
    }
    tagData['Loaded'] = cfg.load === 1 || cfg.load === true ? 'Yes' : 'No';
    tagData['Executed'] = cfg.executed === 1 ? 'Yes' : 'No';
    tagData['Send'] = cfg.send === 1 ? 'Yes' : 'No';
    if (cfg.consent !== undefined) {
      tagData['Consent'] = cfg.consent === 1 ? 'Granted' : 'Pending';
    }
    tags[label] = tagData;
  }
  return tags;
}

/**
 * Parse a Tealium Collect HTTP request into structured display format
 * Called from panel.js when a collect.tealiumiq.com request is detected
 *
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text (multipart form-data or JSON)
 * @returns {Object} { eventName, overview, sections, account, profile }
 */
export function parseTealiumCollectData(url, postData) {
  const payload = extractMultipartJSON(postData);

  // Extract account/profile from URL path: /account/profile/2/i.gif
  let account = null;
  let profile = null;
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    // Pattern: /{account}/{profile}/{number}/i.gif
    if (pathParts.length >= 3) {
      account = pathParts[0];
      profile = pathParts[1];
    }
  } catch (e) {
    // URL parsing failed
  }

  if (!payload) {
    return {
      eventName: 'Collect',
      overview: account ? { 'Account': account, 'Profile': profile } : {},
      sections: []
    };
  }

  const data = payload.data || {};
  const loaderCfg = payload['loader.cfg'] || {};
  const browser = payload.browser || {};
  const eventType = payload.event || data['ut.event'] || 'unknown';

  // Determine event name
  let eventName = data.tealium_event || eventType;
  if (eventName === 'view') eventName = 'Collect: view';
  else if (eventName === 'link') eventName = 'Collect: link';
  else eventName = `Collect: ${eventName}`;

  // Build overview
  const overview = {};
  overview['Event'] = data.tealium_event || eventType;
  if (account) overview['Account'] = `${account} / ${profile}`;
  if (data.tealium_datasource) overview['Datasource'] = data.tealium_datasource;
  if (data.tealium_visitor_id || data['ut.visitor_id']) {
    overview['Visitor ID'] = data.tealium_visitor_id || data['ut.visitor_id'];
  }
  if (data.tealium_session_id || data['ut.session_id']) {
    overview['Session ID'] = data.tealium_session_id || data['ut.session_id'];
  }
  if (data.tealium_session_number) overview['Session #'] = data.tealium_session_number;
  if (data.tealium_session_event_number) overview['Event #'] = data.tealium_session_event_number;

  // Build sections
  const sections = [];

  // 1. Event Data + Session State — split the non-system keys into the actual
  // event payload (kept in Basic) and Tealium's session-storage passthroughs
  // (`ss.*` perf logs, widget blobs, browser context — diagnostic; skipped
  // by Basic, kept by detail view / AI Ready / Complete).
  const customData = {};
  const sessionStateData = {};
  for (const [key, value] of Object.entries(data)) {
    if (isCollectSystemKey(key)) continue;
    const formatted = formatValue(value);
    if (isCollectSessionStateKey(key)) {
      sessionStateData[key] = formatted;
    } else {
      customData[key] = formatted;
    }
  }
  if (Object.keys(customData).length > 0) {
    sections.push({ title: 'Event Data', data: customData, type: 'table' });
  }
  if (Object.keys(sessionStateData).length > 0) {
    const ssCount = Object.keys(sessionStateData).length;
    sections.push({
      title: `Session State (${ssCount})`,
      data: sessionStateData,
      type: 'table',
      expanded: false,
      diagnostic: true,
    });
  }

  // 2. Consent — if present
  const consentData = extractConsentData(data);
  if (consentData) {
    sections.push({ title: 'Consent', data: consentData, type: 'table' });
  }

  // 3. Browser — if present
  if (Object.keys(browser).length > 0) {
    const browserData = {};
    if (browser.width && browser.height) browserData['Viewport'] = `${browser.width} × ${browser.height}`;
    if (browser.screen_width && browser.screen_height) browserData['Screen'] = `${browser.screen_width} × ${browser.screen_height}`;
    if (browser.timezone_offset !== undefined) browserData['Timezone Offset'] = `${browser.timezone_offset} min`;
    sections.push({ title: 'Browser', data: browserData, type: 'table', diagnostic: true });
  }

  // 4. Tags Loaded — from loader.cfg (collapsed by default)
  if (Object.keys(loaderCfg).length > 0) {
    const tagCount = Object.keys(loaderCfg).length;
    const executedCount = Object.values(loaderCfg).filter(c => c.executed === 1).length;
    sections.push({
      title: `Tags (${executedCount}/${tagCount} executed)`,
      data: buildTagsSummary(loaderCfg),
      type: 'table',
      expanded: false,
      sortRows: false,
      diagnostic: true,
    });
  }

  // 5. Performance Timing — if present (collapsed)
  const timingData = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('timing.') && key !== 'timing.domain' && key !== 'timing.pathname' && key !== 'timing.query_string') {
      const label = key.replace('timing.', '');
      timingData[label] = typeof value === 'number' ? `${value} ms` : value;
    }
  }
  if (Object.keys(timingData).length > 0) {
    sections.push({ title: 'Performance Timing', data: timingData, type: 'table', expanded: false, diagnostic: true });
  }

  // 6. Full Data State — categorized (collapsed)
  if (Object.keys(data).length > 0) {
    const categorized = categorizeTealiumData(data);
    const stateData = {};
    const categoryLabels = [
      ['custom', 'Custom Variables'],
      ['tealium', 'Tealium System'],
      ['analytics', 'Analytics Config'],
      ['dom', 'DOM Variables'],
      ['cookies', 'Cookies'],
      ['meta', 'Meta Tags'],
      ['localStorage', 'Local Storage']
    ];
    for (const [key, label] of categoryLabels) {
      if (Object.keys(categorized[key]).length > 0) {
        stateData[label] = categorized[key];
      }
    }
    const count = Object.keys(data).length;
    sections.push({
      title: `Full Data Layer (${count})`,
      data: stateData,
      type: 'table',
      expanded: false,
      diagnostic: true,
    });
  }

  // Build tag UID → TID mapping from loader.cfg for vendor name enrichment
  const tagMapping = {};
  for (const [tagUid, cfg] of Object.entries(loaderCfg)) {
    if (cfg && cfg.tid) {
      tagMapping[tagUid] = String(cfg.tid);
    }
  }

  return {
    eventName,
    overview,
    sections,
    account,
    profile,
    tagMapping
  };
}
