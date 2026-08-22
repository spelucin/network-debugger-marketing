// @ts-check
// Structural Fingerprints — deterministic payload-level signatures for known platforms
// Used to identify tracking requests that don't match URL patterns (CNAME, proxy, custom domains)
// Each fingerprint defines checks against URL structure, query params, and POST body

/**
 * A single structural check. `body` is the parsed POST body — arbitrary
 * JSON, typed `any` because checks probe vendor-specific keys; a check
 * that dereferences body without a null/type guard earlier in its entry's
 * AND chain relies on runFingerprints()' per-check try/catch.
 * @typedef {(url: URL, params: URLSearchParams, body: any) => boolean} FingerprintCheck
 */

/**
 * @typedef {Object} Fingerprint
 * @property {string} platform - Platform ID from platform-registry.js
 * @property {Array<FingerprintCheck>} checks - Array of check functions (all must pass)
 * @property {string} reason - Human-readable explanation of the match
 */

/**
 * Anchor string for the Adobe Web SDK (Alloy) Edge Network payload. Alloy stamps
 * every collect/interact event's XDM with implementationDetails.name:
 *   - standalone library:     "https://ns.adobe.com/experience/alloy"
 *   - Tags/Launch extension:  "https://ns.adobe.com/experience/alloy+reactor"
 * A PREFIX match covers both deployment variants and is host-, base-path-, and
 * API-version-independent — so it generalises to any first-party-proxied edge
 * (custom host, custom base path like /experienceedge, v1 or v2). Confirmed
 * against Adobe's official Web SDK docs (2026-06-17, Feature #147).
 * @type {string}
 */
export const ALLOY_IMPL_DETAILS_PREFIX = 'https://ns.adobe.com/experience/alloy';

/**
 * Shared predicate: does this parsed POST body have the Adobe Web SDK (Alloy)
 * Edge Network shape? Single source of truth (detection-patterns rule) — reused
 * by the structural fingerprint below AND by the routeRequest parser-dispatch
 * guard in request-handlers.js, so the detection logic isn't duplicated.
 *
 * The implementationDetails namespace is the load-bearing anchor; it appears
 * under events[].xdm (canonical) and is mirrored under events[].data on some
 * payloads, so both are checked.
 * @param {any} body - Parsed JSON POST body
 * @returns {boolean}
 */
export function isAlloyEdgePayload(body) {
  if (!body || typeof body !== 'object') return false;
  const events = body.events;
  if (!Array.isArray(events) || events.length === 0) return false;
  return events.some((ev) => {
    if (!ev || typeof ev !== 'object') return false;
    const fromXdm = ev.xdm && ev.xdm.implementationDetails && ev.xdm.implementationDetails.name;
    const fromData = ev.data && ev.data.implementationDetails && ev.data.implementationDetails.name;
    return (typeof fromXdm === 'string' && fromXdm.startsWith(ALLOY_IMPL_DETAILS_PREFIX))
      || (typeof fromData === 'string' && fromData.startsWith(ALLOY_IMPL_DETAILS_PREFIX));
  });
}

/**
 * Structural fingerprint definitions for platforms with distinctive payload signatures.
 * Each entry requires ALL checks to pass (AND logic) to reduce false positives.
 * Order: most common/distinctive first for early exit.
 * @type {Array<Fingerprint>}
 */
export const STRUCTURAL_FINGERPRINTS = [
  // GA4 — Measurement Protocol v2
  {
    platform: 'ga4',
    checks: [
      (url, params) => params.has('tid') && /^G-/.test(params.get('tid') || ''),
      (url, params) => params.has('v') && params.get('v') === '2'
    ],
    reason: 'GA4 measurement ID (tid=G-*) and protocol version (v=2) detected'
  },
  // GA4 via path structure (no tid param but /g/collect path + v=2)
  //
  // Intentional divergence (N18, #139): this rule has NO host guard, so a
  // first-party sGTM proxy that preserves the /g/collect?v=2&en= shape is
  // labelled `ga4`, not `sgtm` — whereas cname-detection.js maps first-party
  // /g/collect to `sgtm`. The two disagree by design:
  //   • structural fingerprints receive only (url, params, body) — they have no
  //     access to the page's registrable domain, so they CANNOT reliably tell a
  //     custom-domain sGTM host from a Google host beyond a hardcoded allowlist;
  //   • the request speaks the GA4 Measurement Protocol either way, so `ga4` is
  //     a correct protocol-level label even when sGTM is the transport.
  // cname-detection.js, which DOES have first-party context, is the place that
  // upgrades the label to `sgtm`. Keep this rule host-agnostic. (See also the
  // GA4 MP Gateway rule below, whose comment notes direct sGTM /g/collect
  // deployments are caught here.)
  {
    platform: 'ga4',
    checks: [
      (url) => /\/g\/collect/.test(url.pathname),
      (url, params) => params.has('v') && params.get('v') === '2',
      (url, params) => params.has('en')
    ],
    reason: 'GA4 collect path (/g/collect) with protocol v2 and event name parameter'
  },

  // Stape Data Tag — primary fingerprint: distinctive _dcid_temp client-id format
  {
    platform: 'stape-data-tag',
    checks: [
      (url, params, body) => body != null && typeof body === 'object',
      (url, params, body) => typeof body._dcid_temp === 'string'
        && /^dcid\.1\.\d+\.\d+$/.test(body._dcid_temp),
      (url, params, body) => typeof body.event_name === 'string',
      (url, params) => !(params.has('tid') && /^G-/.test(params.get('tid') || '')),
      (url) => !/(^|\.)(googletagmanager|google-analytics)\.com$/.test(url.hostname)
    ],
    reason: 'Stape Data Tag protocol marker (_dcid_temp) detected'
  },
  // Stape Data Tag — fallback for operator-customised payloads that strip _dcid_temp
  {
    platform: 'stape-data-tag',
    checks: [
      (url, params, body) => body != null && typeof body === 'object',
      (url, params, body) => typeof body.event_name === 'string',
      (url, params, body) => body.event_data != null
        || body.user_data != null
        || body.consent != null
        || body.common_cookie != null,
      (url, params) => !(params.has('tid') && /^G-/.test(params.get('tid') || '')),
      (url, params) => !(params.has('v') && params.get('v') === '2'),
      (url) => !/(^|\.)(googletagmanager|google-analytics)\.com$/.test(url.hostname)
    ],
    reason: 'Stape Data Tag payload shape (event_name + event_data/user_data/consent) detected'
  },

  // Adobe Analytics — /b/ss/ beacon path + AQB/AQE markers
  {
    platform: 'adobe-analytics',
    checks: [
      (url) => /\/b\/ss\//.test(url.pathname),
      (url, params) => params.has('AQB') && params.has('AQE')
    ],
    reason: 'Adobe Analytics beacon path (/b/ss/) and AQB/AQE markers detected'
  },
  // Adobe Analytics — /b/ss/ path + pe/pev parameters (link tracking)
  {
    platform: 'adobe-analytics',
    checks: [
      (url) => /\/b\/ss\//.test(url.pathname),
      (url, params) => params.has('pe') || params.has('pev1') || params.has('pev2')
    ],
    reason: 'Adobe Analytics beacon path (/b/ss/) with link tracking parameters'
  },

  // Adobe Experience Platform (Web SDK / Alloy) — first-party-proxied Edge Network (Feature #147)
  // Host-, base-path-, and API-version-independent: keys off the Alloy
  // implementationDetails namespace in the XDM body, so it identifies a proxied
  // edge that misses the registry's host (*.adobedc.net) and path (/ee/v{N}/...)
  // patterns simultaneously (e.g. business.adobe.com/experienceedge/irl1/v1/collect).
  // The isAlloyEdgePayload anchor is load-bearing; the events-array check is a
  // structural corroborator that raises confidence to medium. Shared predicate so
  // the routeRequest parser-dispatch guard reuses the same logic (detection-patterns rule).
  {
    platform: 'adobe-experience-platform',
    checks: [
      (url, params, body) => Array.isArray(body?.events) && body.events.length > 0,
      (url, params, body) => isAlloyEdgePayload(body)
    ],
    reason: 'Adobe Web SDK (Alloy) implementationDetails namespace in XDM events[] — first-party-proxied Edge Network'
  },

  // Facebook Pixel — numeric pixel ID + standard pixel params
  {
    platform: 'facebook',
    checks: [
      (url, params) => params.has('id') && /^\d{15,16}$/.test(params.get('id') || ''),
      (url, params) => params.has('ev'),
      (url, params) => params.has('dl') && params.has('rl')
    ],
    reason: 'Facebook Pixel ID format and standard pixel parameters (ev, dl, rl) detected'
  },

  // Segment — JSON body with type field + writeKey or anonymousId
  {
    platform: 'segment',
    checks: [
      (url, params, body) => body != null && typeof body === 'object',
      (url, params, body) => ['track', 'identify', 'page', 'group', 'alias', 'screen'].includes(body?.type),
      (url, params, body) => !!(body?.writeKey || body?.anonymousId || body?.userId)
    ],
    reason: 'Segment API structure (type + writeKey/anonymousId) detected'
  },

  // Amplitude — api_key + events array in JSON body
  {
    platform: 'amplitude',
    checks: [
      (url, params, body) => body != null && typeof body === 'object',
      (url, params, body) => !!(body?.api_key || params.has('api_key')),
      (url, params, body) => Array.isArray(body?.events) || params.has('e')
    ],
    reason: 'Amplitude API key and events array detected'
  },
  // Amplitude — HTTP API v2 with client_upload_time
  {
    platform: 'amplitude',
    checks: [
      (url, params) => params.has('api_key') || params.has('client'),
      (url, params, body) => {
        const e = body?.events || (params.has('e') ? tryParseJSON(params.get('e') || '') : null);
        return Array.isArray(e) && e.length > 0 && e[0].event_type != null;
      }
    ],
    reason: 'Amplitude event payload with event_type detected'
  },

  // Mixpanel — token + distinct_id or $browser/$os properties
  {
    platform: 'mixpanel',
    checks: [
      (url, params, body) => {
        const data = tryDecodeBase64Data(params.get('data')) || body;
        return data != null && typeof data === 'object';
      },
      (url, params, body) => {
        const data = tryDecodeBase64Data(params.get('data')) || body;
        return !!(data?.properties?.token || data?.properties?.distinct_id ||
                  data?.$token || params.has('token'));
      }
    ],
    reason: 'Mixpanel token/distinct_id in properties detected'
  },

  // PostHog — api_key/token + $lib property or /e/ endpoint
  {
    platform: 'posthog',
    checks: [
      (url, params, body) => !!(body?.api_key || params.has('api_key') || body?.token),
      (url, params, body) => {
        if (body?.properties?.$lib) return true;
        if (/\/(e|capture|batch|decide)\/?$/.test(url.pathname)) return true;
        return false;
      }
    ],
    reason: 'PostHog API key with $lib property or capture endpoint detected'
  },

  // Google Ads Conversion — conversion_id + conversion_label
  {
    platform: 'google-ads',
    checks: [
      (url, params) => params.has('cv') || /\/pagead\//.test(url.pathname),
      (url, params) => {
        const label = params.get('label') || params.get('conversion_label');
        const id = params.get('conversion_id') || params.get('awid');
        return !!(label || id) || /\/conversion\//.test(url.pathname);
      }
    ],
    reason: 'Google Ads conversion parameters (conversion_id/label) detected'
  },

  // TikTok Pixel — pixel_code + event parameter
  {
    platform: 'tiktok',
    checks: [
      (url, params) => params.has('pixel_code') || params.has('sdkid'),
      (url, params) => params.has('event') || params.has('ev')
    ],
    reason: 'TikTok Pixel code and event parameter detected'
  },

  // Snowplow — Snowplow tracker protocol (tv, e, p, aid params)
  {
    platform: 'snowplow',
    checks: [
      (url, params) => params.has('tv') && /^(js|py|lua|java|dotnet|go)/.test(params.get('tv') || ''),
      (url, params) => params.has('e') && params.has('p')
    ],
    reason: 'Snowplow tracker protocol version (tv) and event type (e) detected'
  },
  // Snowplow via POST body (newer SDKs)
  {
    platform: 'snowplow',
    checks: [
      (url, params, body) => body != null && typeof body === 'object',
      (url, params, body) => {
        // Guard non-string schema (number/array/object): .includes would throw
        // or array-match, and the runner's try/catch would swallow the throw —
        // misclassifying a malformed-but-real Snowplow payload (N20, #139).
        const schema = body?.schema;
        if (typeof schema !== 'string') return false;
        return schema.includes('iglu:com.snowplowanalytics') || schema.includes('snowplow');
      }
    ],
    reason: 'Snowplow self-describing JSON schema detected'
  },

  // LinkedIn Insight Tag — partner + event parameters
  {
    platform: 'linkedin',
    checks: [
      (url, params) => params.has('pid') && /^\d{5,10}$/.test(params.get('pid') || ''),
      (url, params) => params.has('fmt') || params.has('conversionId') || params.has('url')
    ],
    reason: 'LinkedIn partner ID (pid) and conversion tracking parameters detected'
  },

  // Pinterest Tag — tid + event
  {
    platform: 'pinterest',
    checks: [
      (url, params) => params.has('tid') && /^\d{13}$/.test(params.get('tid') || ''),
      (url, params) => params.has('event') || params.has('ed')
    ],
    reason: 'Pinterest tag ID format and event parameters detected'
  },

  // Matomo/Piwik — idsite + rec=1 params
  {
    platform: 'matomo',
    checks: [
      (url, params) => params.has('idsite') && params.has('rec') && params.get('rec') === '1',
      (url, params) => params.has('action_name') || params.has('url') || params.has('e_c')
    ],
    reason: 'Matomo/Piwik tracking parameters (idsite, rec=1) detected'
  },

  // ── Server-Side CAPI Gateway fingerprints (Feature #64) ───────────────────
  // Match upstream-platform payload shapes routed through bespoke gateway hosts
  // (Stape, sGTM, Pipedream, agency-managed proxies). Each gateway customer
  // uses a different host, so URL patterns can't generalise — but the payload
  // shape is platform-specific, so one rule covers an unbounded host long-tail.
  // Run after the URL-based fingerprints above so direct calls keep their
  // existing classification; only fingerprint-novel hosts route through here.

  // Meta Conversions API Gateway — fb.pixel_id + corroborating fb.* / website_context on non-Meta host
  {
    platform: 'facebook',
    checks: [
      (url, params, body) => body != null && typeof body === 'object',
      (url, params, body) => typeof body['fb.pixel_id'] === 'string' && body['fb.pixel_id'].length > 0,
      (url, params, body) =>
        body['fb.fbp'] != null
        || body['fb.advanced_matching'] != null
        || body['fb.dynamic_product_ads'] != null
        || body.website_context != null,
      (url) => !/(?:^|\.)(?:facebook\.com|fbcdn\.net)$/.test(url.hostname)
        && !/(?:^|\.)connect\.facebook\.net$/.test(url.hostname)
    ],
    reason: 'Meta CAPI Gateway payload (fb.pixel_id + corroborator) on non-Meta host — server-side proxy'
  },

  // GA4 Measurement Protocol Gateway — JSON {client_id, events:[{name,...}]} on non-Google host
  // (Direct sGTM /g/collect deployments are caught by the GA4 path-based fingerprint above.)
  {
    platform: 'ga4',
    checks: [
      (url, params, body) => body != null && typeof body === 'object',
      (url, params, body) => typeof body.client_id === 'string' && body.client_id.length > 0,
      (url, params, body) => Array.isArray(body.events)
        && body.events.length > 0
        && typeof body.events[0]?.name === 'string',
      (url) => !/(?:^|\.)(?:google-analytics\.com|analytics\.google\.com|googletagmanager\.com)$/.test(url.hostname)
    ],
    reason: 'GA4 Measurement Protocol payload (client_id + events[].name) on non-Google host — server-side proxy'
  },

  // TikTok Events API Gateway — top-level event + pixel.code (top-level OR nested in context) on non-TikTok host
  // Refined from the Stape tt.stape.dog capture: real-world payloads nest pixel.code under context.
  {
    platform: 'tiktok',
    checks: [
      (url, params, body) => body != null && typeof body === 'object',
      (url, params, body) => typeof body.event === 'string' && body.event.length > 0,
      (url, params, body) => typeof body?.context?.pixel?.code === 'string'
        || typeof body.pixel_code === 'string',
      (url) => !/(?:^|\.)tiktok\.com$/.test(url.hostname)
    ],
    reason: 'TikTok Events API payload (event + pixel.code) on non-TikTok host — server-side proxy'
  },

  // LinkedIn Conversions API Gateway — LinkedIn URN-style conversion identifier in body on non-LinkedIn host
  // The `urn:lla:llaPartnerConversion:<id>` shape is highly distinctive and unlikely to collide with non-tracking payloads.
  {
    platform: 'linkedin',
    checks: [
      (url, params, body) => body != null && typeof body === 'object',
      (url, params, body) => {
        const candidates = [body.conversion, body.conversionId, body.conversionUrn];
        if (Array.isArray(body.conversions)) {
          for (const c of body.conversions) {
            if (typeof c === 'string') candidates.push(c);
            else if (c && typeof c === 'object') candidates.push(c.conversion, c.conversionId);
          }
        }
        return candidates.some(v => typeof v === 'string' && /urn:(?:lla|li):/i.test(v));
      },
      (url, params, body) => body.conversionHappenedAt != null
        || body.conversionValue != null
        || body.user != null
        || Array.isArray(body.conversions),
      (url) => !/(?:^|\.)linkedin\.com$/.test(url.hostname)
    ],
    reason: 'LinkedIn Conversions API payload (urn:lla conversion + corroborator) on non-LinkedIn host — server-side proxy'
  }
];

/**
 * Try to parse a JSON string, returning null on failure
 * @param {string} str
 * @returns {*|null}
 */
function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

/**
 * Try to decode base64-encoded data parameter (used by Mixpanel, etc.)
 * @param {string|null} str
 * @returns {Object|null}
 */
function tryDecodeBase64Data(str) {
  if (!str) return null;
  try {
    return JSON.parse(atob(str));
  } catch {
    return null;
  }
}

// Export helpers for testing
export { tryParseJSON, tryDecodeBase64Data };
