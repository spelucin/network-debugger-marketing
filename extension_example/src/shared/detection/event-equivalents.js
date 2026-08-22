// @ts-check
// Event Name Equivalents - Cross-platform event correlation
// Maps equivalent event names across different tracking platforms
// Used for trigger correlation in the DevTools panel

/**
 * Correlation time window (ms) - tracking events within this window of a dataLayer push are linked
 */
export const CORRELATION_WINDOW_MS = 2000;

/**
 * Extended window for events with matching names (e.g., dataLayer page_view -> GA4 page_view)
 */
export const CORRELATION_WINDOW_MATCHING_NAME_MS = 10000;

/**
 * Events that should NOT be correlated to dataLayer pushes
 * These are Tag Manager internal/load events caused by script loading, not dataLayer.push()
 */
export const UNCORRELATABLE_EVENTS = [
  'gtm.js',           // GTM container script loaded
  'gtm.dom',          // DOM ready event
  'gtm.load',         // Window load event
  'gtm.init',         // GTM initialization
  'gtm.init_consent', // Consent initialization
  'gtm.start'         // GTM start
];

/**
 * GTM built-in trigger events that can trigger tracking tags (treated like dataLayer.push)
 * These are GTM internal events that fire based on user interactions or page state
 */
export const GTM_TRIGGER_EVENTS = [
  'gtm.scrollDepth',       // Scroll depth trigger -> often triggers GA4 'scroll'
  'gtm.click',             // Click trigger -> triggers click tracking
  'gtm.linkClick',         // Link click trigger
  'gtm.formSubmit',        // Form submission trigger
  'gtm.historyChange',     // History change (SPA navigation)
  'gtm.video',             // YouTube video events
  'gtm.timer',             // Timer trigger
  'gtm.elementVisibility'  // Element visibility trigger
];

/**
 * Map of equivalent event names across platforms for correlation matching
 * This allows dataLayer 'page_view' to correlate with Facebook 'PageView', Google Ads 'conversion', etc.
 * Platforms: GA4, Facebook, Snapchat, TikTok, Pinterest, LinkedIn, Google Ads, Twitter/X, Microsoft Ads
 */
export const EVENT_NAME_EQUIVALENTS = {
  'page_view': [
    'page_view',           // GA4, dataLayer standard
    'pageview',            // GA Universal, common variant
    'PageView',            // Facebook Pixel
    'PAGE_VIEW',           // Snapchat, TikTok
    'page_visit',          // Pinterest
    'virtual_page_view',   // SPA virtual pageviews
    'vpv'                  // Virtual page view abbreviation
  ],
  'purchase': [
    'purchase',            // GA4
    'Purchase',            // Facebook Pixel
    'PURCHASE',            // Snapchat, TikTok
    'transaction',         // GA Universal
    'order',               // Common variant
    'conversion',          // Google Ads conversion event
    'checkout'             // Pinterest checkout
  ],
  'add_to_cart': [
    'add_to_cart',         // GA4
    'AddToCart',           // Facebook Pixel, TikTok
    'ADD_CART',            // Snapchat
    'add_to_basket',       // Common variant
    'addToCart'            // camelCase variant
  ],
  'begin_checkout': [
    'begin_checkout',      // GA4
    'InitiateCheckout',    // Facebook Pixel, TikTok
    'START_CHECKOUT',      // Snapchat
    'checkout_start',      // Common variant
    'start_checkout'       // Common variant
  ],
  'view_item': [
    'view_item',           // GA4
    'ViewContent',         // Facebook Pixel, TikTok
    'VIEW_CONTENT',        // Snapchat
    'view_category',       // Pinterest
    'product_view',        // Common variant
    'view_product'         // Common variant
  ],
  'sign_up': [
    'sign_up',             // GA4
    'CompleteRegistration', // Facebook Pixel, TikTok
    'SIGN_UP',             // Snapchat, TikTok
    'registration',        // Common variant
    'register',            // Common variant
    'signup'               // No underscore variant
  ],
  'login': [
    'login',               // GA4
    'Login',               // Common variant
    'LOGIN',               // Snapchat
    'sign_in',             // Common variant
    'signin'               // No underscore variant
  ],
  'search': [
    'search',              // GA4
    'Search',              // Facebook Pixel, TikTok
    'SEARCH',              // Snapchat
    'site_search'          // Common variant
  ],
  'lead': [
    'generate_lead',       // GA4
    'Lead',                // Facebook Pixel
    'LEAD',                // Common variant
    'lead',                // Pinterest
    'form_submit',         // Common variant
    'submit_form',         // Common variant
    'gtm.formSubmit'       // GTM form trigger
  ],
  'add_to_wishlist': [
    'add_to_wishlist',     // GA4
    'AddToWishlist',       // Facebook Pixel, TikTok
    'ADD_TO_WISHLIST',     // Snapchat
    'save',                // Pinterest (save to board)
    'SAVE'                 // Snapchat save
  ],
  'view_item_list': [
    'view_item_list',      // GA4
    'view_category',       // Pinterest
    'LIST_VIEW',           // Snapchat
    'ViewCategory'         // Common variant
  ],
  'add_payment_info': [
    'add_payment_info',    // GA4
    'AddPaymentInfo',      // Facebook Pixel
    'ADD_BILLING',         // Snapchat
    'add_billing'          // Common variant
  ],
  'subscribe': [
    'subscribe',           // Common variant
    'Subscribe',           // Facebook Pixel
    'SUBSCRIBE',           // Snapchat
    'start_trial',         // Common variant
    'START_TRIAL'          // Snapchat
  ],
  'scroll': [
    'scroll',              // GA4
    'gtm.scrollDepth'      // GTM scroll trigger
  ],
  'click': [
    'click',               // Common
    'gtm.click',           // GTM click trigger
    'gtm.linkClick',       // GTM link click trigger
    'AD_CLICK'             // Snapchat
  ],
  'video_start': [
    'video_start',         // GA4
    'video_play',          // Common variant
    'gtm.video',           // GTM video trigger
    'watch_video'          // Pinterest
  ],
  'share': [
    'share',               // GA4
    'SHARE'                // Snapchat
  ]
};

// Normalized names where a trailing "ed" is part of the root, not a past-tense
// suffix — stripping it would mangle the word and risk a false correlation link
// (N22, #139). Only entries >5 chars matter (the stripper's length gate already
// protects "lead"/"need"/"feed"/"speed"/"embed"). Extend this set if a real
// correlation collision is observed.
const ED_FINAL_ROOTS = new Set([
  'proceed', 'exceed', 'succeed', 'indeed', 'decreed', 'agreed', 'seaweed',
]);

/**
 * Normalize an event name to a canonical form for comparison
 * Handles variations like:
 * - Case: "Page View", "PAGE VIEW", "page view" → "pageview"
 * - Separators: "page_view", "page-view", "page view", "page.view" → "pageview"
 * - Past tense: "pageviewed", "purchased" → "pageview", "purchase"
 * - Common suffixes: "page_view_event" → "pageview"
 *
 * @param {string} name - Event name to normalize
 * @returns {string} Normalized event name
 */
function normalizeToCanonical(name) {
  if (!name) return '';

  let normalized = name
    .toLowerCase()
    // Remove common suffixes
    .replace(/_event$/, '')
    .replace(/event$/, '')
    // Replace all separators with nothing (merge words)
    .replace(/[\s_\-\.]+/g, '');

  // Remove trailing "ed" for past tense (but not for short words like "added")
  // pageviewed → pageview, purchased → purchase, clicked → click
  if (normalized.length > 5 && normalized.endsWith('ed') && !ED_FINAL_ROOTS.has(normalized)) {
    // Don't strip "ed" from words where it's part of the root (e.g., "lead", "need")
    const withoutEd = normalized.slice(0, -2);
    // Only strip if the result is still meaningful (at least 4 chars)
    if (withoutEd.length >= 4) {
      normalized = withoutEd;
    }
  }

  return normalized;
}

// Build reverse lookup: eventName -> normalized name
// Uses canonical form for lookup
/** @type {Object<string, string>} */
const EVENT_NAME_TO_NORMALIZED = {};
for (const [normalized, variants] of Object.entries(EVENT_NAME_EQUIVALENTS)) {
  for (const variant of variants) {
    // Store both the original lowercase and the canonical form
    EVENT_NAME_TO_NORMALIZED[variant.toLowerCase()] = normalized;
    EVENT_NAME_TO_NORMALIZED[normalizeToCanonical(variant)] = normalized;
  }
}

/**
 * Look up an event name in the normalization map. Tries exact lowercase
 * match first, then the canonical (separator/case/past-tense-stripped) form.
 * Internal helper — callers should use getNormalizedEventName, which also
 * tries common stripping variants (vendor brackets, colon suffixes).
 * @param {string} name
 * @returns {string|null}
 */
function lookupNormalized(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (EVENT_NAME_TO_NORMALIZED[lower]) {
    return EVENT_NAME_TO_NORMALIZED[lower];
  }
  const canonical = normalizeToCanonical(name);
  return EVENT_NAME_TO_NORMALIZED[canonical] || null;
}

/**
 * Generate stripping variants of an event name to try when the direct
 * lookup fails. Handles two common decoration patterns observed in the
 * wild:
 *   1. Vendor-tag prefix in brackets   — "[Amplitude] Page Viewed"
 *   2. Colon-suffixed detail or path   — "Page View: Privat>Forside"
 * Combinations work too: "[X] Page View: Y" -> "Page View".
 * Returns the variants that actually changed (excludes the original).
 * @param {string} name
 * @returns {Array<string>}
 */
function generateNameVariants(name) {
  const variants = new Set();

  // Strip a leading bracketed vendor/source tag.
  const noBracket = name.replace(/^\s*\[[^\]]*\]\s*/, '');
  if (noBracket && noBracket !== name) variants.add(noBracket);

  // Strip ": <detail>" suffix on the original AND the bracket-stripped form
  // so combos like "[Vendor] Page View: Detail" reach "Page View" in one pass.
  const seeds = [name];
  if (noBracket && noBracket !== name) seeds.push(noBracket);
  for (const seed of seeds) {
    const colonIdx = seed.indexOf(':');
    if (colonIdx > 0) {
      const beforeColon = seed.slice(0, colonIdx).trim();
      if (beforeColon && beforeColon !== name) variants.add(beforeColon);
    }
  }

  return Array.from(variants);
}

/**
 * Get the normalized event name for a given event name. Tries the direct
 * lookup first; if no match, tries common stripping variants that surface
 * a canonical name buried inside vendor decoration ("[Amplitude] Page
 * Viewed", "Page View: Privat>Forside" — both resolve to `page_view`).
 * @param {string} eventName - The event name to normalize
 * @returns {string|null} The normalized event name, or null if not found
 */
export function getNormalizedEventName(eventName) {
  if (!eventName) return null;

  const direct = lookupNormalized(eventName);
  if (direct) return direct;

  for (const variant of generateNameVariants(eventName)) {
    const m = lookupNormalized(variant);
    if (m) return m;
  }
  return null;
}

/**
 * Check if two event names are equivalent (e.g., 'page_view' and 'Page View')
 * Handles all common variations:
 * - Case: PAGE_VIEW, Page_View, page_view
 * - Separators: page_view, page-view, page view, page.view, pageview
 * - Past tense: page_viewed, pageviewed
 * - Suffixes: page_view_event
 *
 * @param {string} name1 - First event name
 * @param {string} name2 - Second event name
 * @returns {boolean} True if the event names are equivalent
 */
export function areEventNamesEquivalent(name1, name2) {
  // Ensure both arguments are strings (eventName could be an object from JSON parsing)
  if (!name1 || !name2 || typeof name1 !== 'string' || typeof name2 !== 'string') return false;

  // Step 1: Direct case-insensitive match
  const lower1 = name1.toLowerCase();
  const lower2 = name2.toLowerCase();
  if (lower1 === lower2) return true;

  // Step 2: Canonical form match (handles spaces, underscores, case, past tense)
  const canonical1 = normalizeToCanonical(name1);
  const canonical2 = normalizeToCanonical(name2);
  if (canonical1 === canonical2) return true;

  // Step 3: Check if they map to the same semantic group via EVENT_NAME_EQUIVALENTS
  // Try both original lowercase and canonical forms
  const norm1 = EVENT_NAME_TO_NORMALIZED[lower1] || EVENT_NAME_TO_NORMALIZED[canonical1];
  const norm2 = EVENT_NAME_TO_NORMALIZED[lower2] || EVENT_NAME_TO_NORMALIZED[canonical2];
  if (norm1 && norm2 && norm1 === norm2) return true;

  // Step 4: One mapped, one canonical - check if canonical matches the mapped group
  if (norm1 && normalizeToCanonical(norm1) === canonical2) return true;
  if (norm2 && normalizeToCanonical(norm2) === canonical1) return true;

  return false;
}

/**
 * Check if an event is uncorrelatable (GTM internal event)
 * @param {string} eventName - The event name to check
 * @returns {boolean} True if the event should not be correlated
 */
export function isUncorrelatableEvent(eventName) {
  return UNCORRELATABLE_EVENTS.includes(eventName);
}

/**
 * Check if an event is a GTM trigger event
 * @param {string} eventName - The event name to check
 * @returns {boolean} True if the event is a GTM trigger
 */
export function isGTMTriggerEvent(eventName) {
  return GTM_TRIGGER_EVENTS.includes(eventName);
}
