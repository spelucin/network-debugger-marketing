// @ts-check
// CNAME/Custom Tracking Domain Detection
// Detects first-party subdomains that proxy to third-party tracking services
// Used by panel for identifying server-side tracking and first-party collection

import { TWO_PART_TLDS } from './url-patterns.js';

/**
 * Common CNAME tracking subdomain patterns.
 *
 * Each regex matches `<token>.<label>.<rest>` — the trailing `[^.]+\.` enforces
 * that the matched token is actually a *subdomain* of something, not the apex.
 * Without it, the alternation matches apex domains like `stape.io` whose first
 * label happens to be in the token list (the BUG21 cause-B failure mode).
 *
 * Subdomain shape examples that *should* match:
 *   - `analytics.brand.com`      → first pattern via `analytics.`
 *   - `sst.example.com`          → second pattern via `sst.`
 *   - `firstparty.foo.bar.baz`   → third pattern via `firstparty.`
 *
 * Apex shapes that *must not* match (BUG21):
 *   - `stape.io`                 — vendor apex, marketing site
 *   - `sst.com`, `track.com`     — hypothetical apex
 *   - `gtm-server.com`           — hypothetical apex
 */
export const CNAME_SUBDOMAIN_PATTERNS = [
  // Common CNAME tracking prefixes
  /^(fpt|sst|track|tracking|collect|data|analytics|stats|pixel|beacon|events?|t|tr|px|m|metrics|log|logs)\.[^.]+\./i,
  // Server-side tracking patterns
  /^(server|sst|stape|gtmss|gtm-server|gtm-ss)\.[^.]+\./i,
  // CDN/proxy patterns that might be first-party tracking
  /^(cdn-track|track-cdn|1st|firstparty|fp)\.[^.]+\./i
];

/**
 * URL path patterns that suggest tracking even on custom domains
 */
export const CNAME_PATH_PATTERNS = [
  // GA4-style collect endpoint
  /\/g\/collect/i,
  /\/j\/collect/i,
  /\/r\/collect/i,
  // Generic collect/track paths (track, tracking, event, events, etc.)
  /\/(collect|tracking?|events?|pixel|beacon|log|hit|ping|v\d+\/events?)(\/|$|\?)/i,
  // API-style tracking endpoints (e.g., /api/tracking, /api/analytics, /api/events)
  /\/api\/(tracking|analytics|events?|collect|pixels?|metrics|telemetry)(\/|$|\?)/i,
  // Server-side GTM patterns
  /\/gtm\.(js|php)/i,
  /\/gtag\//i,
  // Measurement protocol patterns
  /\/mp\/collect/i,
  // Snowplow-style
  /\/i\?/i,
  /\/com\.snowplowanalytics/i,
  // Bloomreach/Exponea CTD (Custom Tracking Domain)
  /\/bulk($|\?)/i,
  /\/campaigns\/(experiments|banners)\/show/i,
  /\/managed-tags\/show/i,
  /\/webxp\/projects\//i
];

/**
 * Query parameter patterns that strongly suggest tracking
 */
export const CNAME_QUERY_PATTERNS = [
  // GA4/UA measurement IDs and protocol params.
  // `v=` is restricted to a small integer (GA4 uses `v=2`, Measurement Protocol `v=1`)
  // so semver cache-busters like `?v=3.124.6` on first-party static assets don't
  // false-positive (BUG18).
  /[?&](tid|cid|uid|gtm|_p)=/i,
  /[?&]v=\d{1,3}(&|$)/i,
  // Common tracking params
  /[?&](event|en|ep\.|up\.|pr\d+)=/i,
  // Timestamp/session params
  /[?&](_s|_ss|_fv|sid|_gid)=/i
];

/**
 * mParticle CNAME / self-hosted events-endpoint path signature (F6).
 * Shape: `/JS/<region-prefix><digits>-<32+ hex>/events` — e.g.
 * `/JS/eu1-0123456789abcdef0123456789abcdef/events`.
 *
 * Single source of truth: both `detectCNAMETracking()` here and the mParticle
 * dispatch in `panel/request-handlers.js` import this constant — do not inline
 * a second copy (detection-patterns rule: no duplicated patterns). Anchored at
 * the path start and intended to be tested against a parsed `pathname` (never a
 * full URL), so a hex run elsewhere in a URL can't false-positive
 * (precision-over-recall mandate).
 */
export const MPARTICLE_CNAME_EVENTS_PATH_RE = /^\/JS\/[a-z]{2}\d+-[0-9a-f]{16,}\/events/i;

/**
 * Extract root domain from hostname
 * e.g., "sub.example.com" -> "example.com"
 * @param {string} host - Hostname to process
 * @returns {string} Root domain
 */
export function getRootDomain(host) {
  const parts = host.toLowerCase().split('.');
  if (parts.length >= 2) {
    const lastTwo = parts.slice(-2).join('.');
    if (TWO_PART_TLDS.includes(lastTwo) && parts.length >= 3) {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  }
  return host;
}

/**
 * Check if two hostnames share the same root domain
 * @param {string} host1 - First hostname
 * @param {string} host2 - Second hostname
 * @returns {boolean} True if same root domain
 */
export function isSameRootDomain(host1, host2) {
  if (!host1 || !host2) return false;
  return getRootDomain(host1) === getRootDomain(host2);
}

/**
 * Detect if a URL is likely a CNAME/custom tracking domain
 * CNAME tracking is specifically about first-party subdomains that proxy to third-party tracking services.
 * This detection ONLY applies when the URL is on the same root domain as the current page.
 *
 * @param {string} url - The URL to check
 * @param {string} pageHostname - The hostname of the current page (REQUIRED for first-party check)
 * @returns {{ isCNAME: boolean, confidence: 'high'|'medium'|'low', reason: string, suggestedPlatform: string|null, isFirstParty: boolean }}
 */
export function detectCNAMETracking(url, pageHostname = '') {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    const search = parsed.search.toLowerCase();

    // Check if this is a first-party domain (same root domain as current page)
    const urlRootDomain = getRootDomain(hostname);
    const pageRootDomain = pageHostname ? getRootDomain(pageHostname) : '';
    const isFirstParty = pageHostname && urlRootDomain === pageRootDomain;

    // CNAME tracking detection ONLY applies to first-party requests
    // Third-party tracking domains are handled by KNOWN_TRACKING_ENDPOINTS
    if (!isFirstParty) {
      return {
        isCNAME: false,
        confidence: 'low',
        reason: 'third-party domain',
        suggestedPlatform: null,
        isFirstParty: false
      };
    }

    /** @type {'high'|'medium'|'low'} */
    let confidence = 'low';
    let reasons = [];
    /** @type {string|null} */
    let suggestedPlatform = null;

    // Check subdomain patterns (only meaningful for first-party)
    for (const pattern of CNAME_SUBDOMAIN_PATTERNS) {
      if (pattern.test(hostname)) {
        reasons.push('tracking subdomain');
        confidence = 'medium';
        break;
      }
    }

    // Check path patterns
    for (const pattern of CNAME_PATH_PATTERNS) {
      if (pattern.test(pathname)) {
        reasons.push('tracking path');
        confidence = confidence === 'medium' ? 'high' : 'medium';

        // Try to identify the platform based on path
        // For first-party endpoints, GA4 paths indicate SS-GTM (server-side forwarding to Google)
        if (/\/g\/collect/i.test(pathname)) {
          suggestedPlatform = 'sgtm';  // First-party + GA4 path = Server-Side GTM
        } else if (/\/collect/i.test(pathname) && /[?&]v=\d/i.test(search)) {
          suggestedPlatform = 'sgtm';  // First-party + UA collect = Server-Side GTM
        } else if (/snowplow/i.test(pathname)) {
          suggestedPlatform = 'snowplow';
        } else if (MPARTICLE_CNAME_EVENTS_PATH_RE.test(pathname)) {
          // mParticle CNAME: /JS/<region-hex-key>/events path pattern
          suggestedPlatform = 'mparticle';
        } else if (/\/api\/(tracking|analytics|events?|collect|pixels?|metrics|telemetry)/i.test(pathname)) {
          // API-style tracking endpoint (e.g., /api/tracking) - unknown destination
          suggestedPlatform = '1st-party-proxy';
        } else if (/\/bulk($|\?)/i.test(pathname) ||
                   /\/campaigns\/(experiments|banners)\/show/i.test(pathname) ||
                   /\/managed-tags\/show/i.test(pathname) ||
                   /\/webxp\/projects\//i.test(pathname)) {
          // Bloomreach/Exponea CTD (Custom Tracking Domain)
          suggestedPlatform = 'bloomreach';
        }
        break;
      }
    }

    // Check query parameters
    for (const pattern of CNAME_QUERY_PATTERNS) {
      if (pattern.test(search)) {
        reasons.push('tracking params');
        confidence = confidence === 'low' ? 'medium' : 'high';

        // Try to identify platform from params
        // For first-party endpoints, GA4 params indicate SS-GTM (server-side forwarding to Google)
        if (/[?&]tid=G-/i.test(search) || /[?&]_p=/i.test(search)) {
          suggestedPlatform = 'sgtm';  // First-party + GA4 params = Server-Side GTM
        } else if (/[?&]tid=UA-/i.test(search)) {
          suggestedPlatform = 'sgtm';  // First-party + UA params = Server-Side GTM
        }
        break;
      }
    }

    // Only flag as CNAME if we found tracking indicators AND it's first-party
    const isCNAME = reasons.length > 0;

    if (isCNAME) {
      reasons.push('first-party');
      confidence = 'high'; // High confidence when first-party + tracking indicators
    }

    return {
      isCNAME,
      confidence: isCNAME ? confidence : 'low',
      reason: reasons.join(', '),
      suggestedPlatform,
      isFirstParty
    };
  } catch (e) {
    return {
      isCNAME: false,
      confidence: 'low',
      reason: 'invalid URL',
      suggestedPlatform: null,
      isFirstParty: false
    };
  }
}
