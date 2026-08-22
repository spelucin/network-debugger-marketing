// @ts-check
// URL Pattern Utilities - Shared utilities for URL matching and domain extraction
// Used by both badge-endpoints.js (service worker) and tracking-endpoints.js (panel)

/**
 * Performance optimization: Skip common static asset requests before any processing
 * Note: .gif intentionally excluded - many tracking pixels use .gif (HubSpot, Adobe, etc.)
 */
export const SKIP_EXTENSIONS = /\.(woff2?|ttf|eot|otf|css|png|jpe?g|webp|svg|ico|avif)(\?|$)/i;

/**
 * Two-part public suffixes that need special handling for domain normalization.
 * A registrable domain hosted under one of these takes THREE parts rather than
 * the default two. The list mixes two categories — both are entries on the
 * Public Suffix List (https://publicsuffix.org/), and from the matcher's
 * perspective they're identical:
 *
 *   1. Country-code TLDs that use a two-part structure (`co.uk`, `com.au`, …).
 *      Subdomains under these are owned by different organisations.
 *   2. Modern PaaS / hosting providers that allocate per-customer subdomains
 *      (`vercel.app`, `netlify.app`, `github.io`, …). Without these entries,
 *      `myapp.vercel.app` and `othersite.vercel.app` would collapse to a
 *      shared `vercel.app` — wrecking per-site grouping in the `bucket`
 *      engagement metric and falsely identifying unrelated PaaS tenants as
 *      same-origin in CNAME detection.
 *
 * This is the canonical list — imported by cname-detection.js, tracking-
 * endpoints.js, badge-endpoints.js, and the `bucket` engagement machinery in
 * panel.js. Add an entry here when a hosting platform a user is likely to
 * debug appears in the PSL with a `*.<suffix>` rule.
 */
export const TWO_PART_TLDS = [
  // Country-code two-part TLDs
  'co.uk', 'com.au', 'co.nz', 'com.br', 'co.jp', 'co.kr',
  'co.za', 'com.mx', 'co.in', 'com.sg', 'com.hk', 'com.tw',
  'co.il', 'com.ar', 'com.tr', 'com.pl', 'com.cn', 'com.ua',
  // PaaS / hosting providers (per-customer subdomains)
  'vercel.app', 'netlify.app', 'pages.dev', 'workers.dev',
  'github.io', 'gitlab.io', 'herokuapp.com', 'firebaseapp.com',
  'web.app', 'appspot.com', 'azurewebsites.net', 'azurestaticapps.net',
  'replit.app', 'glitch.me', 'vusercontent.net', 'surge.sh',
  // SaaS multi-tenant subdomains
  'myshopify.com'
];

/**
 * Extract domain from a string pattern
 * e.g., 'api.amplitude.com/batch' -> 'amplitude.com'
 * @param {string} pattern - URL pattern string
 * @returns {string|null} Normalized domain or null
 */
export function extractDomainFromPattern(pattern) {
  if (typeof pattern !== 'string') return null;
  // Remove protocol if present
  let domain = pattern.replace(/^https?:\/\//, '');
  // Get the hostname part (before first /)
  domain = domain.split('/')[0];
  // Remove port if present
  domain = domain.split(':')[0];
  // Normalize: get last two parts for most domains
  const parts = domain.toLowerCase().split('.');
  if (parts.length >= 2) {
    const lastTwo = parts.slice(-2).join('.');
    if (TWO_PART_TLDS.includes(lastTwo) && parts.length >= 3) {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  }
  return domain.toLowerCase();
}

// File/path extensions that look like `word.word` but are NOT domains — a
// registry pattern referencing `utag.js` or `i.gif` would otherwise be filed
// under a bogus "domain", and since a non-null (wrong) result skips the
// genericEndpoints fallback in buildDomainIndex, the endpoint becomes a missed
// match for its real host (N17, #139). None of these collide with a ccTLD.
const PATH_LIKE_EXTENSIONS = new Set([
  'js', 'mjs', 'cjs', 'jsx', 'ts', 'json', 'css', 'html', 'htm',
  'php', 'asp', 'aspx', 'jsp', 'gif', 'png', 'jpg', 'jpeg', 'svg',
  'webp', 'ico', 'woff', 'woff2', 'ttf', 'map', 'xml', 'txt', 'wasm',
]);

/**
 * Extract domain from a regex pattern (heuristic)
 * e.g., /facebook\.com\/tr/ -> 'facebook.com'
 * @param {RegExp} pattern - Regex pattern
 * @returns {string|null} Extracted domain or null
 */
export function extractDomainFromRegex(pattern) {
  const source = pattern.source;
  // Look for domain-like patterns: word.word (escaped dots). Scan all matches
  // and return the first whose extension-part isn't a path/file token, so a
  // leading `utag.js` / `i.gif` doesn't shadow the real host that follows.
  const re = /([a-z0-9-]+)\\?\.([a-z]{2,})/gi;
  let match;
  while ((match = re.exec(source)) !== null) {
    const tld = match[2].toLowerCase();
    if (PATH_LIKE_EXTENSIONS.has(tld)) continue;
    return `${match[1].toLowerCase()}.${tld}`;
  }
  return null;
}

/**
 * Extract hostname from URL (fast version, no URL parsing)
 * @param {string} url - Full URL
 * @returns {string} Lowercase hostname
 */
export function extractHostname(url) {
  if (!url || typeof url !== 'string') return '';

  const protocolEnd = url.indexOf('://');
  if (protocolEnd === -1) return '';

  let hostStart = protocolEnd + 3;
  let hostEnd = url.indexOf('/', hostStart);
  if (hostEnd === -1) hostEnd = url.indexOf('?', hostStart);
  if (hostEnd === -1) hostEnd = url.length;

  let hostname = url.substring(hostStart, hostEnd).toLowerCase();

  if (hostname.startsWith('[')) {
    // IPv6 literal, e.g. `[::1]:8080` — keep everything up to and including the
    // closing bracket (matches `new URL().hostname`), drop the port. F8: the old
    // `indexOf(':')` port split collapsed `[::1]` to `[`.
    const close = hostname.indexOf(']');
    if (close !== -1) hostname = hostname.substring(0, close + 1);
  } else {
    // Remove port
    const portIndex = hostname.indexOf(':');
    if (portIndex !== -1) hostname = hostname.substring(0, portIndex);
    // Strip a single trailing dot (FQDN form `example.com.`) so it normalises to
    // the same eTLD+1 as `example.com`. F8: previously retained.
    if (hostname.endsWith('.')) hostname = hostname.slice(0, -1);
  }

  return hostname;
}

/**
 * Normalize hostname to registrable domain (eTLD+1)
 * e.g., 'sub.example.co.uk' -> 'example.co.uk'
 * @param {string} hostname - Full hostname
 * @returns {string} Normalized domain
 */
export function normalizeToRegistrableDomain(hostname) {
  const parts = hostname.split('.');
  if (parts.length < 2) return hostname;

  const lastTwo = parts.slice(-2).join('.');
  if (TWO_PART_TLDS.includes(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return lastTwo;
}

/**
 * Build a domain index for fast lookups
 * Maps domain -> array of endpoints that might match requests to that domain
 * @param {Array<{ id: string, patterns: Array<string|RegExp> }>} endpoints - Array of endpoint objects with { id, patterns }
 * @returns {{ domainIndex: Map<string, Array<Object>>, genericEndpoints: Array<Object> }}
 */
export function buildDomainIndex(endpoints) {
  /** @type {Map<string, Array<Object>>} */
  const index = new Map();
  /** @type {Array<Object>} */
  const genericEndpoints = []; // Endpoints with domain-less regex patterns

  for (const endpoint of endpoints) {
    if (!endpoint.patterns || endpoint.patterns.length === 0) continue;

    const domainsForEndpoint = new Set();
    let hasDomainlessPattern = false;

    for (const pattern of endpoint.patterns) {
      let domain = null;
      if (typeof pattern === 'string') {
        domain = extractDomainFromPattern(pattern);
        // If string pattern has no extractable domain (e.g., '/b/ss/'), it's a generic pattern
        if (!domain) {
          hasDomainlessPattern = true;
        }
      } else if (pattern instanceof RegExp) {
        domain = extractDomainFromRegex(pattern);
        // If regex has no extractable domain, it's a generic pattern (e.g., /\/utag\.\d+\.js/)
        if (!domain) {
          hasDomainlessPattern = true;
        }
      }
      if (domain) {
        domainsForEndpoint.add(domain);
      }
    }

    // Add to domain index if it has domain patterns
    if (domainsForEndpoint.size > 0) {
      for (const domain of domainsForEndpoint) {
        let bucket = index.get(domain);
        if (!bucket) {
          bucket = [];
          index.set(domain, bucket);
        }
        bucket.push(endpoint);
      }
    }

    // Also add to generic list if it has domain-less patterns (string or regex)
    // This handles cases like:
    // - Tealium: /\/utag\.\d+\.js/ can match on ANY domain
    // - Adobe Analytics: '/b/ss/' path pattern on CNAME'd first-party domains
    if (hasDomainlessPattern || domainsForEndpoint.size === 0) {
      genericEndpoints.push(endpoint);
    }
  }

  return { domainIndex: index, genericEndpoints };
}

/**
 * Match a single URL against a single registry pattern.
 *
 * CANONICAL MATCHING CONTRACT — every registry matcher (panel
 * matchKnownEndpoint, badge matchUrlToEndpoint, and the tests) routes through
 * this one function so production and tests can never diverge again:
 *
 *   - string pattern: case-INSENSITIVE substring. Hostnames are already
 *     lowercased by the browser; this also tolerates non-canonical path casing
 *     (e.g. a site serving `appmeasurement.js` instead of `AppMeasurement.js`).
 *   - RegExp pattern: tested against the RAW url. The regex owns its own
 *     case-sensitivity via its flags. We do NOT pre-lowercase the URL for
 *     regexes — doing so destroys case-significant query/path tokens (GA4
 *     `tid=G-`, Google Ads `AW-`, Floodlight `DC-`) and silently kills
 *     prefix-disambiguation patterns. See BUG22 and the v1.3.0 pre-submission
 *     registry review for the concrete failure this prevents.
 *
 * @param {string} url - raw URL to match
 * @param {string|RegExp} pattern - a single registry pattern
 * @param {string} [urlLower] - optional precomputed url.toLowerCase() so hot
 *   callers (service worker badge scan) don't lowercase per pattern
 * @returns {boolean}
 */
export function matchSinglePattern(url, pattern, urlLower) {
  if (typeof pattern === 'string') {
    const haystack = urlLower !== undefined ? urlLower : url.toLowerCase();
    return haystack.includes(pattern.toLowerCase());
  }
  if (pattern instanceof RegExp) {
    return pattern.test(url); // RAW url — regex controls its own case via flags
  }
  return false;
}

/**
 * Match a URL against a list of patterns. Thin wrapper over matchSinglePattern
 * so callers that only need a boolean share the canonical contract.
 * @param {string} url - URL to match
 * @param {Array<string|RegExp>} patterns - Array of string or regex patterns
 * @returns {boolean} True if any pattern matches
 */
export function matchUrlAgainstPatterns(url, patterns) {
  const urlLower = url.toLowerCase();
  for (const pattern of patterns) {
    if (matchSinglePattern(url, pattern, urlLower)) return true;
  }
  return false;
}

/**
 * Left-truncate a hostname for use as a compact display label (Feature #151).
 * Hostnames are most recognisable at the right (apex + the labels closest to it),
 * so when a host is longer than `maxLen` we keep the rightmost characters and
 * prefix a single leading ellipsis. The ellipsis glyph counts toward `maxLen`,
 * so the returned string is never longer than `maxLen` characters.
 *
 * e.g. `truncateHostLabel('abc123aweskfjls.telemetry.ncp.nuuday.nu', 20)`
 *      -> `…metry.ncp.nuuday.nu` (leading ellipsis + the last 19 chars = 20 total).
 *
 * @param {string} host - The full hostname (already lowercased by extractHostname)
 * @param {number} [maxLen=20] - Hard cap on the displayed length, inclusive of the ellipsis
 * @returns {string} The host verbatim when short enough, else a left-truncated label
 */
export function truncateHostLabel(host, maxLen = 20) {
  if (!host || typeof host !== 'string') return '';
  if (host.length <= maxLen) return host;
  // Keep the rightmost (maxLen - 1) chars; the leading ellipsis fills the last slot.
  return '…' + host.slice(host.length - (maxLen - 1));
}

/**
 * Bucket a flat list of unknown-request hostnames into the top-N most frequent
 * chips plus an "Others" overflow tally (Feature #151). One entry per unknown
 * event is expected; underivable hosts (null / empty) fold into the overflow.
 *
 * Ordering is event-count descending, then hostname ascending as a stable
 * tiebreaker, so the loudest unknown services stay visible under the cap.
 *
 * @param {Array<string|null|undefined>} hosts - One hostname per unknown event
 * @param {number} [maxChips=5] - Maximum number of distinct host chips to surface
 * @returns {{ chips: Array<{ host: string, count: number }>, othersCount: number }}
 *   `chips` is the capped, sorted top list; `othersCount` is the summed event
 *   count of every host beyond the cap plus any underivable hosts (0 when none).
 */
export function bucketUnknownHosts(hosts, maxChips = 5) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  let underivableCount = 0;
  for (const host of hosts || []) {
    if (!host || typeof host !== 'string') {
      underivableCount++;
      continue;
    }
    counts.set(host, (counts.get(host) || 0) + 1);
  }

  const sorted = [...counts.entries()]
    .map(([host, count]) => ({ host, count }))
    .sort((a, b) => (b.count - a.count) || a.host.localeCompare(b.host));

  const chips = sorted.slice(0, maxChips);
  const overflow = sorted.slice(maxChips);
  const othersCount = overflow.reduce((sum, e) => sum + e.count, 0) + underivableCount;

  return { chips, othersCount };
}
