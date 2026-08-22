// @ts-check
// Tag Manager Patterns - Single source of truth for identifying tag manager scripts
// Used for script initiator detection (determining if a script was loaded by a TMS)

/**
 * Structured TMS catalogue. Each entry pairs a vendor key + display label with
 * the URL patterns that identify scripts shipped by that vendor.
 *
 * Read by:
 *   - `TAG_MANAGER_PATTERNS` (flat list, below) — used by script-initiator
 *     classification and by the page-script's inlined TM_PATTERNS copy
 *   - `tmsVendorFromUrl(url)` — used by the Datalayer Grouped View to label
 *     L2 sub-buckets under the Tag Manager parent (e.g. "GTM", "Tealium")
 *
 * IMPORTANT: when adding a vendor or pattern, mirror the addition into the
 * `TM_PATTERNS` array in `extension/src/content/event-watcher-page.js`
 * (page scripts cannot import extension modules — see content-script rule).
 */
export const TAG_MANAGER_VENDORS = [
  {
    vendor: 'gtm',
    label: 'Google Tag Manager',
    patterns: [
      /googletagmanager\.com\/gtm\.js/,
      /googletagmanager\.com\/gtag\/js/,
    ],
  },
  {
    vendor: 'tealium',
    label: 'Tealium',
    patterns: [
      /\/utag\.js(\?|$)/,       // Main container — matches on any domain (first-party hosting)
      /\/utag\.sync\.js(\?|$)/, // Sync container
      /\/utag\.\d+\.js(\?|$)/,  // Individual tag configs (utag.140.js = tag UID 140)
      /tealiumiq\.com/,
      /tags\.tiqcdn\.com/,
    ],
  },
  {
    vendor: 'launch',
    label: 'Adobe Tags',
    patterns: [
      /assets\.adobedtm\.com/,
      /launch\.adobe\.com/,
      /launch-cdn\.adobe\.com/,
      /\/launch-[A-Za-z0-9]+-\w+\.min\.js$/,  // launch-ENxxxxxx-staging.min.js
    ],
  },
  {
    vendor: 'ensighten',
    label: 'Ensighten',
    patterns: [
      /ensighten\.com\/tag/,
      /nexus\.ensighten\.com/,
    ],
  },
  {
    vendor: 'commanders-act',
    label: 'Commanders Act',
    patterns: [
      /tagcommander\.com/,
      /commander1\.com/,
      /\/tc_[^/]+\.js$/,  // tc_*.js container pattern
    ],
  },
  {
    vendor: 'piwik-pro',
    label: 'Piwik PRO',
    patterns: [
      /containers\.piwik\.pro/,
    ],
  },
  {
    vendor: 'zaraz',
    label: 'Cloudflare Zaraz',
    patterns: [
      /\/cdn-cgi\/zaraz\//,
    ],
  },
  {
    vendor: 'segment',
    label: 'Segment',
    patterns: [
      /cdn\.segment\.com/,
    ],
  },
];

/**
 * Flat list of all known tag manager URL patterns. Built from the structured
 * catalogue above so the two stay in sync automatically.
 *
 * Consumed by:
 *   - script-initiator.js (call-stack matching)
 *   - badge-endpoints.js (initiator badge)
 *   - the page-script's inlined TM_PATTERNS copy (manual mirror)
 */
export const TAG_MANAGER_PATTERNS = TAG_MANAGER_VENDORS.flatMap(v => v.patterns);

/**
 * Check if a URL is a known tag manager script
 * @param {string} url - The URL to check
 * @returns {boolean} True if the URL matches a known tag manager pattern
 */
export function isTagManagerUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return TAG_MANAGER_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Check if any URL in an array matches a tag manager pattern
 * Useful for checking call stack frames
 * @param {string[]} urls - Array of URLs to check
 * @returns {boolean} True if any URL matches a tag manager pattern
 */
export function hasTagManagerInStack(urls) {
  if (!Array.isArray(urls)) return false;
  return urls.some(url => isTagManagerUrl(url));
}

/**
 * Match a GTM web-container ID carried in an `id=` query parameter.
 *
 * GTM container IDs have the Google-assigned form `GTM-XXXXXXX` (uppercase
 * alphanumerics). This is a host-agnostic signal: the standard container loader
 * is `googletagmanager.com/gtm.js?id=GTM-XXXX`, but sites increasingly
 * reverse-proxy the web container through a first-party path
 * (e.g. `wwws.airfrance.dk/fpsb/?id=GTM-KM9RKSJG`), where the host- and
 * path-bound patterns no longer match. The `id=GTM-` query param is the only
 * signal that survives the proxy. See BUG53.
 *
 * Used only for *classification of otherwise-unknown* requests — standard
 * `gtm.js` loads and GTM Telemetry (`/a?id=GTM-`) are resolved by the registry
 * before this is ever consulted, so this never re-attributes known GTM traffic.
 */
export const GTM_CONTAINER_ID_QUERY = /[?&]id=(GTM-[A-Z0-9]{4,})/i;

/**
 * Extract the GTM web-container ID from a URL's `id=` query parameter.
 * @param {string} url - The URL to inspect
 * @returns {string|null} The container ID (uppercased, e.g. 'GTM-KM9RKSJG') or null
 */
export function extractGtmContainerId(url) {
  if (!url || typeof url !== 'string') return null;
  const match = GTM_CONTAINER_ID_QUERY.exec(url);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Identify which TMS vendor a URL belongs to.
 * @param {string} url - The URL to classify
 * @returns {string|null} The vendor key (e.g. 'gtm', 'tealium') or null if unknown
 */
export function tmsVendorFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  for (const { vendor, patterns } of TAG_MANAGER_VENDORS) {
    if (patterns.some(pattern => pattern.test(url))) return vendor;
  }
  return null;
}

/**
 * Resolve the display label for a TMS vendor key.
 * @param {string} vendor - Vendor key from `tmsVendorFromUrl`
 * @returns {string} Display label, or the input if the key is unknown
 */
export function tmsVendorLabel(vendor) {
  const entry = TAG_MANAGER_VENDORS.find(v => v.vendor === vendor);
  return entry ? entry.label : vendor;
}
