// @ts-check
// Tracking topology classifier (Feature #79, v1.3.0).
//
// Single source of truth for *where a tracking request lives in the network
// topology* — direct third-party / first-party / wrapped / unknown. Consolidates
// three previously-drifting prefix lists and four inline detection mechanisms:
//
//   1. CNAME_SUBDOMAIN_PATTERNS (regex array) in cname-detection.js
//   2. knownTrackingPrefixes (string array) in request-handlers.js
//   3. ssgtmPrefixes (string array) in request-handlers.js
//   4. isCustomDomainGTMLoad / isCustomDomainGTAGLoad (inline) in request-handlers.js
//
// This module replaces them with `TRACKING_SUBDOMAIN_PREFIXES` (canonical union)
// and `classifyTopology(url, pageHostname, requestType?)` which returns the
// topology fact every caller needs. Stape Custom Loader wrapper decoding
// (Feature #76, absorbed into this spec) lives here in the `topology: 'wrapper'`
// branch.
//
// Match semantics — picked once, used everywhere:
//
//   `host.startsWith(prefix) && host.slice(prefix.length).includes('.')`
//
// i.e. the host must start with the prefix AND have at least one more dot
// after it. Combines literal-startsWith (cheap, predictable) with BUG21's
// apex-rejection (no false-positives on apex hosts like `stape.io`) in a
// single step. Regex tokens that used `events?\.` are explicitly enumerated
// here as both `event.` and `events.` — the cost of unifying on a single
// canonical mechanism.

import { TWO_PART_TLDS } from './url-patterns.js';
import { getRootDomain, isSameRootDomain } from './cname-detection.js';

// ─── Canonical prefix union ─────────────────────────────────────────────────
//
// Union of the three pre-consolidation lists (see module header). Each entry
// is a literal lowercase string ending in `.`. Used by `hasTrackingSubdomainPrefix`
// below; downstream code should call that helper rather than iterating the array
// directly. Order is irrelevant to correctness — sorted alphabetically for review.
export const TRACKING_SUBDOMAIN_PREFIXES = Object.freeze([
  '1st.',
  'analytics.',
  'beacon.',
  'cdn-track.',
  'collect.',
  'data.',
  'event.',
  'events.',
  'firstparty.',
  'fp.',
  'fpt.',
  'gtm.',
  'gtm-server.',
  'gtm-ss.',
  'gtmss.',
  'log.',
  'logs.',
  'm.',
  'metrics.',
  'pixel.',
  'px.',
  'server.',
  'sgtm.',
  'sst.',
  'stape.',
  'stats.',
  't.',
  'tr.',
  'track.',
  'track-cdn.',
  'tracking.',
]);

/**
 * Check whether a hostname starts with a known tracking subdomain prefix
 * AND has at least one further dot after the prefix (i.e. is a *subdomain*
 * of something, not the apex). Returns the matched prefix string (e.g.
 * `'analytics.'`) or null.
 *
 * Apex rejection (e.g. `stape.io`) is intentional — see BUG21 cause B.
 *
 * @param {string} host - Lowercase hostname
 * @returns {string | null}
 */
export function hasTrackingSubdomainPrefix(host) {
  if (!host) return null;
  for (const prefix of TRACKING_SUBDOMAIN_PREFIXES) {
    if (!host.startsWith(prefix)) continue;
    // Require something after the prefix and at least one more dot in it.
    const rest = host.slice(prefix.length);
    if (rest.length > 0 && rest.includes('.')) return prefix;
  }
  return null;
}

// ─── Stape Custom Loader wrapper decoder (Feature #76 absorbed) ─────────────
//
// Stape's Custom Loader Power-up wraps tracking requests through the customer's
// first-party domain. With *enhanced ad blocker protection* enabled, the request
// URL is opaque: `https://customer.example/<random>?<8-hex>=<base64>`. The
// base64 decodes to the original tracking path (`/g/collect?…`, `/gtag/js?…`,
// `/gtm.js?…`). Once decoded, the existing path → platform mapping does the
// rest.

/** Decoded path prefixes that count as a positive wrapper match. */
const WRAPPER_DECODED_PATH_MAPPINGS = [
  { prefix: '/g/collect',  platform: 'sgtm' },
  { prefix: '/j/collect',  platform: 'sgtm' },   // UA legacy
  { prefix: '/r/collect',  platform: 'sgtm' },   // GA4 debug
  { prefix: '/mp/collect', platform: 'sgtm' },   // Measurement Protocol
  { prefix: '/gtag/js',    platform: 'gtag' },
  { prefix: '/gtm.js',     platform: 'gtm' },
];

/** Cap the number of query values inspected; Stape wrappers use exactly one. */
const WRAPPER_DECODE_BUDGET = 4;

/** Minimum decoded length to bother allow-list-matching. */
const WRAPPER_MIN_DECODED_LENGTH = 12;

/**
 * Try to base64-decode a query value and return its decoded form if it parses
 * to a string starting with `/` and at least `WRAPPER_MIN_DECODED_LENGTH` long.
 * Tries standard base64 first, then URL-safe base64 (-_  → +/). Returns null
 * on any failure.
 *
 * @param {string} value - Raw query value (URL-decoded by URLSearchParams).
 * @returns {string | null}
 */
function tryDecodeWrapperValue(value) {
  if (!value || value.length < WRAPPER_MIN_DECODED_LENGTH) return null;
  // Standard base64 first
  try {
    const decoded = atob(value);
    if (decoded && decoded[0] === '/' && decoded.length >= WRAPPER_MIN_DECODED_LENGTH) {
      return decoded;
    }
  } catch { /* fall through */ }
  // URL-safe base64 fallback (-_ → +/, pad if needed)
  try {
    let normalised = value.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (normalised.length % 4)) % 4;
    if (padLen) normalised += '='.repeat(padLen);
    const decoded = atob(normalised);
    if (decoded && decoded[0] === '/' && decoded.length >= WRAPPER_MIN_DECODED_LENGTH) {
      return decoded;
    }
  } catch { /* not base64 */ }
  return null;
}

/**
 * Scan the URL's query values for a Stape Custom Loader-shaped wrapper. Returns
 * the decoded payload + suggested platform when a positive match fires, else
 * null. The scan is capped at `WRAPPER_DECODE_BUDGET` values and uses an
 * explicit allow-list of decoded path prefixes (not just `startsWith('/')`).
 *
 * @param {URL} parsedUrl - Already-parsed URL (avoid re-parsing).
 * @returns {{ pathname: string, search: string, searchParams: Object, platform: string, queryParam: string } | null}
 */
function decodeStapeWrapper(parsedUrl) {
  const params = parsedUrl.searchParams;
  let inspected = 0;
  for (const [name, value] of params) {
    if (inspected++ >= WRAPPER_DECODE_BUDGET) break;
    const decoded = tryDecodeWrapperValue(value);
    if (!decoded) continue;
    for (const mapping of WRAPPER_DECODED_PATH_MAPPINGS) {
      if (!decoded.startsWith(mapping.prefix)) continue;
      // Parse the decoded path + search safely. `decoded` already starts with `/`
      // so we can treat it as the pathname + optional querystring.
      const qIdx = decoded.indexOf('?');
      const pathname = qIdx === -1 ? decoded : decoded.slice(0, qIdx);
      const search = qIdx === -1 ? '' : decoded.slice(qIdx);
      /** @type {Object<string, string>} */
      const searchParams = {};
      if (search) {
        try {
          for (const [k, v] of new URLSearchParams(search)) {
            searchParams[k] = v;
          }
        } catch { /* keep empty searchParams */ }
      }
      return { pathname, search, searchParams, platform: mapping.platform, queryParam: name };
    }
  }
  return null;
}

// ─── Loader hints (replaces isCustomDomainGTMLoad / isCustomDomainGTAGLoad) ──
//
// Detect GTM / gtag container loads on custom (non-googletagmanager.com)
// domains. The original inline checks lived at request-handlers.js:774-781.

const GTM_LOAD_QUERY = /[?&]id=GTM-/i;
const GTAG_LOAD_QUERY = /[?&]id=(G|AW|DC)-/i;

/**
 * @param {string} url
 * @param {string} hostname
 * @param {string} pathname
 * @returns {'gtm' | 'gtag' | null}
 */
function detectLoaderHint(url, hostname, pathname) {
  // Same-domain GTM containers are handled by the explicit
  // `googletagmanager.com/gtm.js` check upstream. Only custom hosts get a hint.
  if (hostname.endsWith('googletagmanager.com')) return null;
  // Accept a `.js` script file (anchored to an extension boundary — end, query,
  // or fragment) OR a literal `/js?` / `/js&` (gtag style `/gtag/js?id=…` has no
  // dot before `js`). Anchoring avoids matching `.js` mid-token in `/foo.json`,
  // `/x.jsp`, or `?ref=site.js.example`, which combined with the gtm-shaped id
  // test below produced spurious loader hints (N19, #139).
  if (!/\.js(\?|#|$)/.test(url) && !url.includes('/js?') && !url.includes('/js&')) return null;
  if (GTM_LOAD_QUERY.test(url)) return 'gtm';
  if (GTAG_LOAD_QUERY.test(url)) return 'gtag';
  return null;
}

// ─── Main classifier ────────────────────────────────────────────────────────

/**
 * Classify a request's network topology — *where* it lives, independent of
 * *who* (supplier) or *what* (platform protocol) it speaks.
 *
 * Returned topology values:
 *   - `direct`                       — third-party host, not on a tracking shape
 *   - `cname-first-party`            — first-party host (same root as the page),
 *                                      typically tracking-shaped
 *   - `cname-prefixed-third-party`   — non-first-party host whose subdomain
 *                                      starts with a tracking prefix (rare;
 *                                      preserved for parity with the legacy
 *                                      knownTrackingPrefixes check)
 *   - `wrapper`                      — first-party request whose query carries a
 *                                      base64-encoded tracking path (Stape
 *                                      Custom Loader)
 *   - `unknown`                      — invalid URL or no signal
 *
 * @param {string} url - The request URL
 * @param {string} pageHostname - The hostname of the inspected page (REQUIRED for first-party check)
 * @param {string} [_requestType] - Reserved for callers that want to gate
 *                                  topology on resource type. Currently unused
 *                                  by this function — the gate lives in
 *                                  `isUnknownTrackingRequest`. Kept in the
 *                                  signature so future expansion doesn't break
 *                                  the contract.
 * @returns {{
 *   topology: 'direct' | 'cname-first-party' | 'cname-prefixed-third-party' | 'wrapper' | 'unknown',
 *   firstParty: boolean,
 *   sameRoot: boolean,
 *   subdomainPrefix: string | null,
 *   loaderHint: 'gtm' | 'gtag' | null,
 *   wrapper: { pathname: string, search: string, searchParams: Object, platform: string, queryParam: string } | null
 * }}
 */
export function classifyTopology(url, pageHostname = '', _requestType = '') {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return {
      topology: 'unknown',
      firstParty: false,
      sameRoot: false,
      subdomainPrefix: null,
      loaderHint: null,
      wrapper: null,
    };
  }
  const hostname = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname.toLowerCase();
  const sameRoot = pageHostname ? isSameRootDomain(hostname, pageHostname) : false;
  const subdomainPrefix = hasTrackingSubdomainPrefix(hostname);
  const loaderHint = detectLoaderHint(url, hostname, pathname);

  // Wrapper decode only runs on first-party requests — the wrapper pattern
  // (?<8-hex>=<base64>) is generic enough that a permissive same-host check
  // would risk false positives on unrelated third-party shapes.
  let wrapper = null;
  if (sameRoot) {
    wrapper = decodeStapeWrapper(parsedUrl);
  }

  /** @type {'direct' | 'cname-first-party' | 'cname-prefixed-third-party' | 'wrapper' | 'unknown'} */
  let topology;
  if (wrapper) {
    topology = 'wrapper';
  } else if (sameRoot) {
    topology = 'cname-first-party';
  } else if (subdomainPrefix) {
    topology = 'cname-prefixed-third-party';
  } else {
    topology = 'direct';
  }

  return {
    topology,
    firstParty: sameRoot,
    sameRoot,
    subdomainPrefix,
    loaderHint,
    wrapper,
  };
}

// Re-export the primitives so panel-side callers can import everything from
// one place if convenient. The originals stay in cname-detection.js so the
// existing import graph isn't disturbed.
export { getRootDomain, isSameRootDomain, TWO_PART_TLDS };
