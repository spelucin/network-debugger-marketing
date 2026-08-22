// Parameter Descriptions for Labels Feature (lazy-loaded on demand)

// GA4 / Google Analytics 4 (also used by SS-GTM)
export const GA4_PARAMS = {
  // Core identifiers
  'v': 'Protocol Version',
  'tid': 'Measurement ID',
  'gtm': 'GTM Container ID',
  'cid': 'Client ID',
  'uid': 'User ID',
  'sid': 'Session ID',
  'sct': 'Session Count',
  'seg': 'Session Engaged',
  '_s': 'Hit Number',
  '_p': 'Page ID',
  '_gid': 'Google ID',

  // Page/Document
  'dl': 'Document Location (URL)',
  'dr': 'Document Referrer',
  'dt': 'Document Title',
  'de': 'Document Encoding',
  'ul': 'User Language',
  'sd': 'Screen Colors',
  'sr': 'Screen Resolution',
  'vp': 'Viewport Size',

  // Event
  'en': 'Event Name',
  '_et': 'Engagement Time (ms)',
  '_ee': 'Enhanced Events',
  'tfd': 'Time to First Data (ms)',

  // User Agent
  'uaa': 'User Agent Architecture',
  'uab': 'User Agent Bitness',
  'uafvl': 'User Agent Full Version List',
  'uamb': 'User Agent Mobile',
  'uam': 'User Agent Model',
  'uap': 'User Agent Platform',
  'uapv': 'User Agent Platform Version',
  'uaw': 'User Agent WoW64',

  // Consent & Privacy
  'gcs': 'Google Consent State',
  'gcd': 'Google Consent Default',
  'npa': 'Non-Personalized Ads',
  'dma': 'DMA Region',
  'dma_cps': 'DMA Consent Purposes',
  'pscdl': 'Privacy Sandbox CDL',

  // Traffic Source
  'cs': 'Campaign Source',
  'cm': 'Campaign Medium',
  'cn': 'Campaign Name',
  'ck': 'Campaign Keyword',
  'cc': 'Campaign Content',
  'ci': 'Campaign ID',
  'gclid': 'Google Click ID',
  'dclid': 'DoubleClick ID',

  // Enhanced Measurement
  '_fv': 'First Visit',
  '_nsi': 'New Session ID',
  '_ss': 'Session Start',
  '_dbg': 'Debug Mode',
  'frm': 'iFrame',
  'are': 'Auto Refresh',

  // Ecommerce
  'cu': 'Currency',
  'pr': 'Product',
  'pa': 'Product Action',
  'tcc': 'Coupon Code',
  'tr': 'Transaction Revenue',
  'ts': 'Transaction Shipping',
  'tt': 'Transaction Tax',
  'ti': 'Transaction ID',

  // Other
  '_eu': 'Event Usage',
  '_tu': 'Track Usage',
  'gdid': 'Google Debug ID',
  'tag_exp': 'Tag Experiments',
  '_z': 'Cache Buster'
};

// Facebook Pixel
export const FACEBOOK_PARAMS = {
  'id': 'Pixel ID',
  'ev': 'Event Name',
  'dl': 'Document Location',
  'rl': 'Referrer',
  'if': 'In iFrame',
  'ts': 'Timestamp',
  'sw': 'Screen Width',
  'sh': 'Screen Height',
  'v': 'Pixel Version',
  'r': 'Release Channel',
  'a': 'Agent',
  'ec': 'Event Count',
  'o': 'Opt-out',
  'fbp': 'Browser ID (_fbp)',
  'fbc': 'Click ID (_fbc)',
  'ud': 'User Data (hashed)',
  'cd': 'Custom Data',
  'it': 'Init Time',
  'coo': 'Cookies Enabled',
  'rqm': 'Request Method',
  'ler': 'Last Event Response',
  'cs_est': 'Cookie Status Estimated',
  'hmd': 'Hashed User Data',
  'plt': 'Page Load Time'
};

// Google Ads
export const GOOGLE_ADS_PARAMS = {
  'label': 'Conversion Label',
  'l': 'Conversion Label',
  'value': 'Conversion Value',
  'currency': 'Currency',
  'transaction_id': 'Transaction ID',
  'oid': 'Order ID',
  'remarketing_only': 'Remarketing Only',
  'gtm': 'GTM Container ID',
  'gtm_debug': 'GTM Debug Mode',
  'random': 'Cache Buster',
  'url': 'Page URL',
  'ref': 'Referrer',
  'tiba': 'Page Title',
  'capi': 'Conversion API',
  'em': 'Email (hashed)',
  'pn': 'Phone (hashed)',
  'guid': 'GUID',
  'u_w': 'Screen Width',
  'u_h': 'Screen Height',
  'u_tz': 'Timezone Offset',
  'frm': 'In iFrame',
  'fmt': 'Format'
};

// TikTok Pixel
export const TIKTOK_PARAMS = {
  'sdkid': 'Pixel Code',
  'pixel_code': 'Pixel Code',
  'event': 'Event Name',
  'event_id': 'Event ID',
  'ttclid': 'TikTok Click ID',
  'ttp': 'TikTok Cookie (_ttp)',
  'timestamp': 'Timestamp',
  'context': 'Context Data',
  'properties': 'Event Properties',
  'url': 'Page URL',
  'referrer': 'Referrer',
  'user_agent': 'User Agent',
  'ip': 'IP Address',
  'external_id': 'External ID',
  'email': 'Email (hashed)',
  'phone_number': 'Phone (hashed)'
};

// LinkedIn Insight Tag
export const LINKEDIN_PARAMS = {
  'pid': 'Partner ID',
  'conversionId': 'Conversion ID',
  'conversion_id': 'Conversion ID',
  'li_fat_id': 'First-Party Ad Tracking ID',
  'fmt': 'Format',
  'url': 'Page URL',
  'time': 'Timestamp',
  'oid': 'Order ID',
  'data': 'Conversion Data',
  'v': 'Version',
  'isTrk': 'Is Tracking',
  'isDedup': 'Is Deduplication'
};

// Amplitude
export const AMPLITUDE_PARAMS = {
  // Event level
  'event_type': 'Event Name',
  'event_id': 'Event ID',
  'session_id': 'Session ID',
  'insert_id': 'Insert ID (Deduplication)',
  'time': 'Event Timestamp',
  'event_properties': 'Event Properties',
  'user_properties': 'User Properties',
  'groups': 'Group Properties',
  'group_properties': 'Group Properties',

  // User identifiers
  'user_id': 'User ID',
  'device_id': 'Device ID',
  'amplitude_id': 'Amplitude ID',

  // Device info
  'platform': 'Platform',
  'os_name': 'OS Name',
  'os_version': 'OS Version',
  'device_brand': 'Device Brand',
  'device_manufacturer': 'Device Manufacturer',
  'device_model': 'Device Model',
  'device_type': 'Device Type',
  'carrier': 'Carrier',

  // Location
  'country': 'Country',
  'region': 'Region',
  'city': 'City',
  'dma': 'DMA',
  'location_lat': 'Latitude',
  'location_lng': 'Longitude',
  'ip': 'IP Address',

  // Attribution
  'idfa': 'IDFA (iOS)',
  'idfv': 'IDFV (iOS)',
  'adid': 'Google Advertising ID',
  'android_id': 'Android ID',

  // App info
  'app_version': 'App Version',
  'version_name': 'Version Name',
  'library': 'SDK Library',
  'language': 'Language',

  // Other
  'api_key': 'API Key',
  'revenue': 'Revenue',
  'productId': 'Product ID',
  'quantity': 'Quantity',
  'price': 'Price',
  'revenueType': 'Revenue Type'
};

// Snapchat Pixel
export const SNAPCHAT_PARAMS = {
  // Core
  'pid': 'Snap Pixel ID',
  'id': 'Snap Pixel ID',
  'pixel_id': 'Snap Pixel ID',
  'ev': 'Event Name',
  'event_type': 'Event Type',
  'event_name': 'Event Name',
  'event_conversion_type': 'Conversion Type',
  'e_uuid': 'Event UUID',
  'u': 'Page URL',
  'v': 'Pixel Version',
  'sc_click_id': 'Snap Click ID',
  'uuid_c1': 'User Cookie ID (_scid)',

  // User identifiers
  'u_c1': 'Client UUID',
  'u_sclid': 'Snap Click ID',
  'u_scsid': 'Snap Session ID',
  'ts': 'Timestamp',

  // Page info
  'url': 'Page URL',
  'rf': 'Referrer',
  'ua': 'User Agent',

  // Device
  'sw': 'Screen Width',
  'sh': 'Screen Height',

  // Ecommerce
  'currency': 'Currency',
  'price': 'Price',
  'transaction_id': 'Transaction ID',
  'item_ids': 'Item IDs',
  'item_category': 'Item Category',

  // User data
  'hashed_email': 'Email (hashed)',
  'hashed_phone': 'Phone (hashed)',

  // Context
  'pv': 'Page Views',
  'si': 'Snap Session Info',
  'ss': 'Session Storage ID',
  'bt': 'Browser Token',
  'lc': 'Local Context',
  'ls': 'Local Storage ID',
  'r': 'Request ID',
  'bg': 'Background',
  'df': 'Defer',
  'mtp': 'Match Type',
  'rd': 'Redirect',
  'sa': 'Session Anchor',
  'sps': 'Session Page Sequence',

  // Device details
  'd_a': 'Device Architecture',
  'd_bvs': 'Browser Version String',
  'd_ot': 'Operating System Type',
  'd_os': 'OS Version',
  'huah': 'Has User Agent Hints'
};

// Adform
export const ADFORM_PARAMS = {
  // Core
  'pm': 'Tracking Setup ID',
  'ADFPageName': 'Tracking Point Name',
  'ADFdivider': 'Page Name Divider',
  'ADFtpmode': 'Tracking Point Mode',
  'pagename': 'Tracking Point Name',
  'divider': 'Page Name Divider',
  'bn': 'Banner ID',
  'cpdir': 'Creative Path',
  'ord': 'Order/Cache Buster',

  // Conversion
  'itm': 'Item',
  'sales': 'Sales Amount',
  'orderid': 'Order ID',
  'basketsize': 'Basket Size',
  'currency': 'Currency',

  // Attribution
  'sv': 'Server Variable',
  'var': 'Variables',
  'ckattempt': 'Cookie Attempt',
  'ckid': 'Cookie ID',
  'rdir': 'Redirect',
  'aession': 'Adform Session',

  // Privacy
  'gdpr': 'GDPR Consent Flag',
  'gdpr_consent': 'IAB Consent String',
  'gdpr_pd': 'GDPR Personal Data'
};

// Platform ID to descriptions mapping
const PLATFORM_DESCRIPTIONS = {
  'ga4': GA4_PARAMS,
  'sgtm': GA4_PARAMS,
  'facebook': FACEBOOK_PARAMS,
  'google-ads-conversion': GOOGLE_ADS_PARAMS,
  'tiktok': TIKTOK_PARAMS,
  'linkedin': LINKEDIN_PARAMS,
  'amplitude': AMPLITUDE_PARAMS,
  'snapchat': SNAPCHAT_PARAMS,
  'adform': ADFORM_PARAMS
};

/**
 * Get parameter descriptions for a platform
 * @param {string} platformId - The platform identifier
 * @returns {Object} Map of param names to descriptions
 */
export function getParamDescriptions(platformId) {
  return PLATFORM_DESCRIPTIONS[platformId] || {};
}

/**
 * Get all available platform IDs with descriptions
 * @returns {string[]} Array of platform IDs
 */
export function getSupportedPlatforms() {
  return Object.keys(PLATFORM_DESCRIPTIONS);
}
