// Unknown Tracker Hostname Reporter
// Pure helpers for the Crowdsourced Unknown Tool Registry (feature #47).
//
// Decides whether a hostname is safe to include in the `tools_unknown` array
// property on the `devtool_page` analytics event, and snapshots the per-page-load
// Set into a sorted array for emission.
//
// Privacy floor: hostname only — no path, params, body, method, or event name.
// Hostnames that share a root domain with the visited page are dropped before
// emission so the report cannot reveal the visited site.
//
// Feature #69 narrows that floor for a tiny allow-list of multi-purpose hosts
// (Google's GTM CDN today; gstatic / GA / DoubleClick are candidates) where the
// first path segment is part of the platform protocol — `/td`, `/sw`, `/static`,
// `/gtag` — and never user data. On those hosts only, `applyHostHint()`
// reports `host + '/' + firstSegment` so `/platform-discover` can tell which
// path is unmatched. The hint applies to `tools_unknown` only — `tools_assumed`
// (Feature #70) keeps bare hostnames because fingerprinted events already carry
// a platform ID that anchors discovery on the platform dimension.
//
// See docs/features/implemented/47-crowdsourced-unknown-tools.md,
// docs/features/implemented/69-tools-unknown-first-path-hint.md, and
// docs/PRIVACY_POLICY.md → "Unknown Tool Detection".

import { isSameRootDomain } from '../shared/detection/cname-detection.js';

const SPECIAL_TLDS = ['.local', '.internal', '.test', '.lan'];

function isPrivateIPv4(host) {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
  const [a, b] = host.split('.').map(Number);
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 127) return true;
  return false;
}

function hostnameFromIgnoredEntry(entry) {
  if (typeof entry !== 'string' || !entry) return '';
  const slash = entry.indexOf('/');
  return (slash === -1 ? entry : entry.slice(0, slash)).toLowerCase();
}

function matchesCustomEndpoint(host, customEndpoints) {
  if (!Array.isArray(customEndpoints) || customEndpoints.length === 0) return false;
  for (const ep of customEndpoints) {
    if (!ep || !ep.domain) continue;
    const domainLower = ep.domain.toLowerCase();
    if (host === domainLower || host.endsWith('.' + domainLower)) return true;
  }
  return false;
}

/**
 * Decide whether a hostname is safe to include in the crowdsourcing payload.
 * @param {string} host - Hostname of the unknown tracker request (lowercased).
 * @param {string} pageHostname - Hostname of the page the user is currently on.
 * @param {Array} customEndpoints - User-defined private endpoints (objects with .domain).
 * @param {Array<string>|Set<string>} ignoredEndpoints - User-ignored endpoints ("hostname/path" strings).
 * @returns {boolean} True if the hostname should be reported, false to drop.
 */
export function shouldReportHost(host, pageHostname, customEndpoints = [], ignoredEndpoints = []) {
  if (typeof host !== 'string' || !host) return false;
  const lower = host.toLowerCase();

  // No dots → localhost, extension IDs, single-label hosts. Never reportable.
  if (!lower.includes('.')) return false;

  if (lower === 'localhost') return false;
  if (isPrivateIPv4(lower)) return false;
  if (SPECIAL_TLDS.some(tld => lower.endsWith(tld))) return false;

  // Drop if the hostname shares a root domain with the visited page —
  // shipping it would leak the site identity.
  if (pageHostname && isSameRootDomain(lower, pageHostname)) return false;

  if (matchesCustomEndpoint(lower, customEndpoints)) return false;

  const ignoredList = ignoredEndpoints instanceof Set
    ? [...ignoredEndpoints]
    : (Array.isArray(ignoredEndpoints) ? ignoredEndpoints : []);
  for (const entry of ignoredList) {
    if (hostnameFromIgnoredEntry(entry) === lower) return false;
  }

  return true;
}

/**
 * Allow-list of multi-purpose hosts where the first path segment is safe to
 * include alongside the hostname in `tools_unknown` (Feature #69).
 *
 * A host qualifies for this list only when (a) tracking and non-tracking paths
 * coexist on the same apex, and (b) every observed first segment is
 * protocol-defined and never user data (no tenant slug, user ID, opaque token).
 * `applyHostHint()` runs the segment through `SAFE_SEGMENT_RE` before
 * appending — a future endpoint that took an opaque first segment would still
 * fall back to the bare hostname.
 *
 * Initial scope is `googletagmanager.com` (with and without `www.`) — driven
 * by 45 unmatched hits in `tools_unknown` over 30 days that the bare host
 * couldn't characterise. `gstatic.com`, `google-analytics.com`, and the
 * DoubleClick / Google Ads hosts are candidates to add as discovery surfaces
 * them.
 */
export const HOST_HINT_ALLOW_LIST = new Set([
  'www.googletagmanager.com',
  'googletagmanager.com',
]);

// Defensive segment shape — only [a-z0-9._-]. A future allow-listed endpoint
// that took an opaque token (hex, base64) would fail this check and the report
// value would silently fall back to the bare hostname, preserving the
// hostname-only privacy floor.
const SAFE_SEGMENT_RE = /^[a-z0-9._-]+$/;

/**
 * For allow-listed hosts, return `host + '/' + firstPathSegment` instead of the
 * bare host. For every other host, return the bare host unchanged.
 *
 * Pure: privacy filtering remains the responsibility of `shouldReportHost()`,
 * which runs first. This helper only reshapes the value that gets pushed into
 * the unknowns Set after the privacy check has already accepted the host.
 *
 * Behaviour for allow-listed hosts:
 *   - Empty / missing pathname → bare host (no `/` suffix)
 *   - First segment fails `SAFE_SEGMENT_RE` (e.g. URL-encoded `%2F`, opaque
 *     token, accidental whitespace) → bare host
 *   - Otherwise → `host + '/' + segment`, both lowercased
 *
 * Note: this hint is intentionally scoped to `tools_unknown`. `tools_assumed`
 * (Feature #70) keeps bare hostnames because fingerprinted events already
 * carry a platform ID — the discovery query "fingerprinted-as-X but on a host
 * we haven't seen" is platform-anchored, so the path segment adds noise rather
 * than signal there.
 *
 * @param {string} host - Hostname (already lowercased / validated upstream).
 * @param {string} [pathname] - URL pathname (e.g. `/td/abc`, `/sw.js`, `''`).
 * @returns {string} Host, or `host/segment` for allow-listed hosts with a safe
 *   first path segment.
 */
export function applyHostHint(host, pathname) {
  if (typeof host !== 'string' || !host) return host;
  const lowerHost = host.toLowerCase();
  if (!HOST_HINT_ALLOW_LIST.has(lowerHost)) return lowerHost;

  if (typeof pathname !== 'string' || !pathname) return lowerHost;

  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return lowerHost;

  const segment = parts[0].toLowerCase();
  if (!SAFE_SEGMENT_RE.test(segment)) return lowerHost;

  return `${lowerHost}/${segment}`;
}

/**
 * Snapshot a Set of unknown hostnames into a sorted array for emission.
 * Lowercased and alphabetically sorted; the Set already deduplicates.
 * @param {Set<string>} set
 * @returns {string[]}
 */
export function collectHostUnknown(set) {
  if (!set || typeof set.size !== 'number' || set.size === 0) return [];
  const out = [];
  for (const host of set) {
    if (typeof host === 'string' && host) out.push(host.toLowerCase());
  }
  return out.sort();
}

/**
 * Hard cap on the number of distinct unknown hostnames captured per page load.
 * A pathological page that loads many unique unknown trackers would otherwise
 * bloat the Amplitude event payload. Well above the realistic distinct-tracker
 * count for any normal page.
 */
export const MAX_UNKNOWN_HOSTS_PER_PAGE = 50;

/**
 * Hard cap on the number of distinct "<platformId> | <hostname>" pairs
 * captured per page-load (Feature #70). state.events accumulates across
 * page-loads in long-lived tabs, so an unbounded set could otherwise grow
 * unboundedly; the cap mirrors MAX_UNKNOWN_HOSTS_PER_PAGE for the same reason.
 */
export const MAX_ASSUMED_PAIRS_PER_PAGE = 50;

const ASSUMED_PAIR_SEPARATOR = ' | ';

/**
 * Collect "<platformId> | <hostname>" pairs from events identified by
 * structural fingerprinting (Feature #70). The platform-ID-first ordering
 * makes sorted output and Amplitude property-autocomplete cluster by the
 * bounded, curated platform dimension rather than scattering by host. The
 * "<spaces>|<spaces>" separator is unambiguous: hostnames are RFC-restricted
 * to alphanumerics, hyphens, and dots; platform IDs are lowercase + hyphens.
 *
 * Privacy posture matches tools_unknown — same shouldReportHost() filter,
 * same drops (same-root-domain, custom endpoints, ignored endpoints, private
 * IPv4, special TLDs, single-label hosts).
 *
 * When includeHosts is false (user opted out of host sharing via
 * shareUnknownEndpointHostnames), falls back to platform-ID-only entries
 * preserving the v1.2.0-and-earlier shape for the assumed-tool signal.
 *
 * @param {Array} events - state.events array.
 * @param {string} pageHostname - hostname of the current page (for same-root drop).
 * @param {Array} customEndpoints - user-defined private endpoints.
 * @param {Array<string>|Set<string>} ignoredEndpoints - user-ignored endpoints.
 * @param {Object} [options]
 * @param {boolean} [options.includeHosts=true] - when false, returns platform-ID-only entries.
 * @returns {string[]} sorted, deduplicated, capped at MAX_ASSUMED_PAIRS_PER_PAGE.
 */
export function collectAssumedPairs(events, pageHostname, customEndpoints, ignoredEndpoints, options = {}) {
  const { includeHosts = true } = options;
  if (!Array.isArray(events) || events.length === 0) return [];

  const out = new Set();
  for (const e of events) {
    const platformId = e?.formatted?.fingerprint?.platformId;
    if (!platformId) continue;

    if (!includeHosts) {
      out.add(platformId);
      if (out.size >= MAX_ASSUMED_PAIRS_PER_PAGE) break;
      continue;
    }

    const host = e?.formatted?._meta?.hostname;
    if (typeof host !== 'string' || !host) continue;
    const lowerHost = host.toLowerCase();
    if (!shouldReportHost(lowerHost, pageHostname, customEndpoints, ignoredEndpoints)) continue;

    out.add(`${platformId}${ASSUMED_PAIR_SEPARATOR}${lowerHost}`);
    if (out.size >= MAX_ASSUMED_PAIRS_PER_PAGE) break;
  }

  return [...out].sort();
}
