// CDP destinations-config parsers — Segment + RudderStack + mParticle + (future) Hightouch.
//
// These platforms publish a per-source config endpoint that lists every
// destination the source is set up to load. Parsing it gives us:
//   1. a Stream event-detail "Destinations configured" / "Kits configured"
//      section showing what the CDP is wired to load on this site,
//      distinct from what's actually fired
//   2. an authoritative loader edge for Stack View's Strategy A — the
//      CDP itself told us, same confidence tier as Tealium's loader.cfg
//      and GTM's tag-execution telemetry
//
// Vocabularies differ by vendor:
//   Segment    : `integrations` keyed by display name ("Google Analytics 4 Web")
//   RudderStack: `source.destinations[*].destinationDefinition.name` (uppercase enum, "GA4")
//   mParticle  : `kitConfigs[*].name` (CamelCase, "GoogleAnalytics" / "GA4")
//   Hightouch  : Segment-spec compatible, follows Segment's vocabulary
//
// Each vendor needs its own name → platformId mapping because the
// vocabularies don't overlap. We keep all maps here so a single place
// owns the "CDP destination name → registry platformId" mappings.

// Substring/regex patterns for Segment integration display names.
// Iteration order matters: more specific patterns must precede more
// generic ones (e.g. "Google Analytics 4" before plain "Google
// Analytics" — though we don't currently support UA, the principle is
// the same as `GTM_TAGS_EVENT_NAME_PATTERNS` in stack-attribution.js).
//
// `Segment.io` is the always-bundled Segment.io destination — it's
// metadata about Segment itself, not a loaded vendor, so it's filtered
// before pattern matching rather than appearing here.
const SEGMENT_INTEGRATION_PATTERNS = [
  // Google
  { pattern: /google\s*analytics\s*4|\bga4\b|gaaw/i, platformId: 'ga4' },
  { pattern: /google\s*ads.*conversion|\bawct\b/i, platformId: 'google-ads-conversion' },
  { pattern: /google\s*ads.*remarketing|google\s*ads\s*audiences/i, platformId: 'google-ads-remarketing' },
  { pattern: /(double\s*click|floodlight)/i, platformId: 'google-floodlight' },
  // Meta / social
  { pattern: /facebook\s*pixel|facebook\s*conversions/i, platformId: 'facebook' },
  { pattern: /linkedin\s*insight|linkedin\s*ads/i, platformId: 'linkedin' },
  { pattern: /twitter|\bx\s*ads\b/i, platformId: 'twitter' },
  { pattern: /pinterest/i, platformId: 'pinterest' },
  { pattern: /tiktok/i, platformId: 'tiktok' },
  { pattern: /snapchat|snap\s*pixel/i, platformId: 'snapchat' },
  // Product analytics
  { pattern: /mixpanel/i, platformId: 'mixpanel' },
  { pattern: /amplitude/i, platformId: 'amplitude' },
  { pattern: /heap/i, platformId: 'heap' },
  { pattern: /posthog/i, platformId: 'posthog' },
  { pattern: /pendo/i, platformId: 'pendo' },
  // Session replay / heatmap
  { pattern: /hotjar/i, platformId: 'hotjar' },
  { pattern: /\bclarity\b/i, platformId: 'microsoft-clarity' },
  { pattern: /fullstory|full\s*story/i, platformId: 'fullstory' },
  { pattern: /mouseflow/i, platformId: 'mouseflow' },
  // Adobe
  { pattern: /adobe\s*analytics|omniture/i, platformId: 'adobe-analytics' },
  { pattern: /adobe\s*target/i, platformId: 'adobe-target' },
  // Ad tech
  { pattern: /criteo/i, platformId: 'criteo' },
  // Marketing automation
  { pattern: /hubspot/i, platformId: 'hubspot' },
  // CDP / customer engagement
  { pattern: /salesforce\s*marketing/i, platformId: 'salesforce-marketing' },
];

// mParticle kit-name patterns. mParticle's kit catalog uses CamelCase
// names like 'GoogleAnalytics4', 'Facebook', 'Mixpanel' — typically one
// per third-party SDK. Substring/regex matching is the right shape
// because mParticle ships variants ('GoogleAnalytics' for legacy UA,
// 'GoogleAnalytics4' / 'GA4' for current GA4) and new kits land
// regularly in the catalog. Iteration order matters: GA4 before plain
// `GoogleAnalytics` so the more-specific match wins.
const MPARTICLE_KIT_PATTERNS = [
  // Google
  { pattern: /google\s*analytics\s*4|\bga4\b/i, platformId: 'ga4' },
  { pattern: /google\s*ad(?:words)?(?:\s*conversion)?|google\s*ads/i, platformId: 'google-ads-conversion' },
  // Meta / social
  { pattern: /\bfacebook\b/i, platformId: 'facebook' },
  { pattern: /\blinkedin\b/i, platformId: 'linkedin' },
  { pattern: /\btwitter\b/i, platformId: 'twitter' },
  { pattern: /\bpinterest\b/i, platformId: 'pinterest' },
  { pattern: /\btiktok\b/i, platformId: 'tiktok' },
  { pattern: /\bsnap(?:chat)?\b/i, platformId: 'snapchat' },
  // Product analytics
  { pattern: /\bmixpanel\b/i, platformId: 'mixpanel' },
  { pattern: /\bamplitude\b/i, platformId: 'amplitude' },
  { pattern: /\bheap\b/i, platformId: 'heap' },
  { pattern: /\bposthog\b/i, platformId: 'posthog' },
  { pattern: /\bpendo\b/i, platformId: 'pendo' },
  // Session replay / heatmap
  { pattern: /\bhotjar\b/i, platformId: 'hotjar' },
  { pattern: /\bclarity\b/i, platformId: 'microsoft-clarity' },
  { pattern: /full\s*story|fullstory/i, platformId: 'fullstory' },
  { pattern: /\bmouseflow\b/i, platformId: 'mouseflow' },
  // Adobe
  { pattern: /adobe(?:\s*analytics)?\b/i, platformId: 'adobe-analytics' },
  // Microsoft
  { pattern: /\bbing\b|microsoft\s*ads|\buet\b/i, platformId: 'bing-ads' },
];

// RudderStack uses uppercase-snake-case enum names like 'GA4',
// 'FACEBOOK_PIXEL', 'AMPLITUDE'. They're stable identifiers from the
// destination-definitions catalog, so exact-match works here — no need
// for substring patterns. Keep it sorted alphabetically for diffability.
const RUDDERSTACK_DEFINITION_TO_PLATFORM = {
  // Adobe
  'ADOBE_ANALYTICS': 'adobe-analytics',
  // Product analytics
  'AMPLITUDE': 'amplitude',
  // Ad tech
  'CRITEO': 'criteo',
  // Meta
  'FACEBOOK_PIXEL': 'facebook',
  'FACEBOOK_CONVERSIONS_API': 'facebook',
  // Google
  'GA4': 'ga4',
  'GOOGLE_ADS': 'google-ads-conversion',
  'GOOGLE_ADS_OFFLINE_CONVERSIONS': 'google-ads-conversion',
  'GOOGLE_ADS_REMARKETING_LISTS_RLSA': 'google-ads-remarketing',
  'DCM_FLOODLIGHT': 'google-floodlight',
  // Session replay / heatmap
  'HEAP': 'heap',
  'HOTJAR': 'hotjar',
  'FULLSTORY': 'fullstory',
  'MICROSOFT_CLARITY': 'microsoft-clarity',
  'MOUSEFLOW': 'mouseflow',
  // Marketing automation
  'HUBSPOT': 'hubspot',
  // Social
  'LINKEDIN_INSIGHT_TAG': 'linkedin',
  'LINKEDIN_ADS': 'linkedin',
  'PINTEREST_TAG': 'pinterest',
  'TIKTOK_ADS': 'tiktok',
  'SNAPCHAT_CONVERSION_API': 'snapchat',
  'SNAP_PIXEL': 'snapchat',
  'TWITTER_ADS': 'twitter',
  // Product analytics (continued)
  'MIXPANEL': 'mixpanel',
  'PENDO': 'pendo',
  'POSTHOG': 'posthog',
};

/**
 * Parse a Segment CDN settings response body into a normalised destinations array.
 *
 * Endpoint: cdn.segment.com/v1/projects/{writeKey}/settings (also cdn.segment.io)
 *
 * Returns null on parse failure so callers can keep emitting the
 * captured event without the rich section. Never throws.
 *
 * @param {string} content - Raw response body (JSON text)
 * @returns {{
 *   writeKey: string|null,
 *   destinations: Array<{ name: string, platformId: string|null, raw: Object }>,
 *   integrationCount: number,
 *   consentCategories: string[]|null,
 * }|null}
 */
export function parseSegmentSettings(content) {
  if (!content) return null;
  let body;
  try {
    body = JSON.parse(content);
  } catch {
    return null;
  }
  if (!body || typeof body !== 'object' || !body.integrations) return null;

  const destinations = [];
  for (const [name, raw] of Object.entries(body.integrations)) {
    // Segment.io is always present — it's the bundled Segment.io
    // pipeline endpoint, not a vendor destination. Skip so the count
    // and the surfaced list reflect actual third-party destinations.
    if (name === 'Segment.io') continue;
    destinations.push({
      name,
      platformId: matchSegmentDestination(name),
      raw: typeof raw === 'object' ? raw : null,
    });
  }

  // Segment write keys aren't included in the settings response itself
  // (the URL embeds the write key, not the body). Caller can pass it
  // through alongside if needed via the URL parser.
  return {
    writeKey: null,
    destinations,
    integrationCount: destinations.length,
    consentCategories: body.consentSettings?.allCategories || null,
  };
}

/**
 * Parse a RudderStack sourceConfig response body into a normalised destinations array.
 *
 * Endpoint: {dataplane}/sourceConfig?p={writeKey}&v={version}
 *
 * @param {string} content - Raw response body (JSON text)
 * @returns {{
 *   writeKey: string|null,
 *   sourceName: string|null,
 *   destinations: Array<{ name: string, displayName: string|null, enabled: boolean, platformId: string|null, raw: Object }>,
 *   destinationCount: number,
 * }|null}
 */
export function parseRudderStackSourceConfig(content) {
  if (!content) return null;
  let body;
  try {
    body = JSON.parse(content);
  } catch {
    return null;
  }
  const source = body?.source;
  if (!source || !Array.isArray(source.destinations)) return null;

  const destinations = source.destinations.map((dest) => {
    const def = dest?.destinationDefinition || {};
    return {
      name: def.name || dest?.name || 'Unknown',
      displayName: def.displayName || null,
      enabled: dest?.enabled !== false,
      platformId: matchRudderStackDestination(def.name),
      raw: dest,
    };
  });

  return {
    writeKey: source.writeKey || null,
    sourceName: source.name || null,
    destinations,
    destinationCount: destinations.length,
  };
}

// Map a Segment integration display name to a platform-registry id, or
// null if no match. Iterates patterns in registration order so callers
// can rely on first-match-wins.
export function matchSegmentDestination(name) {
  if (!name || typeof name !== 'string') return null;
  for (const { pattern, platformId } of SEGMENT_INTEGRATION_PATTERNS) {
    if (pattern.test(name)) return platformId;
  }
  return null;
}

// Map a RudderStack destinationDefinition.name (uppercase enum) to a
// platform-registry id via exact-match table. Returns null if unknown.
export function matchRudderStackDestination(definitionName) {
  if (!definitionName || typeof definitionName !== 'string') return null;
  return RUDDERSTACK_DEFINITION_TO_PLATFORM[definitionName] || null;
}

/**
 * Detect whether a URL is the Segment settings endpoint. Used by the
 * panel's request dispatch so the body can be fetched and parsed.
 */
export function isSegmentSettingsUrl(url) {
  if (!url) return false;
  return /\bcdn\.segment\.(?:com|io)\/v1\/projects\/[^/]+\/settings\b/i.test(url);
}

/**
 * Detect whether a URL is the RudderStack sourceConfig endpoint.
 */
export function isRudderStackSourceConfigUrl(url) {
  if (!url) return false;
  return /\/sourceConfig(?:\?|$)/i.test(url) && /rudderstack\.com|rudderlabs\.com/i.test(url);
}

/**
 * Detect whether a URL is the Hightouch Events sourceConfig endpoint.
 * Hightouch's browser SDK is a RudderStack fork — same `/sourceConfig`
 * path shape, default host `us-east-1.hightouch-events.com` (region-
 * suffixed), customers can self-host via `apiHost` so we accept any
 * `*.hightouch-events.com` subdomain.
 */
export function isHightouchSourceConfigUrl(url) {
  if (!url) return false;
  return /\/sourceConfig(?:\?|$)/i.test(url) && /hightouch-events\.com|hightouch\.io/i.test(url);
}

/**
 * Extract the Segment write key from a settings URL.
 * Example: https://cdn.segment.com/v1/projects/abc123/settings → 'abc123'
 */
export function extractSegmentWriteKey(url) {
  if (!url) return null;
  const m = url.match(/\/v1\/projects\/([^/]+)\/settings/i);
  return m ? m[1] : null;
}

/**
 * Parse an mParticle config response body into a normalised kits array.
 *
 * Endpoint: jssdkcdns.mparticle.com/JS/v2/{apiKey}/config (the canonical
 * default; customers self-hosting can override `configUrl` but the
 * response shape is the same).
 *
 * Response carries `kitConfigs[*]`, each with a CamelCase `name` like
 * `'GoogleAnalytics4'` or `'Facebook'`. Pixel destinations live in a
 * separate `pixelConfigs` array — we surface those too because they're
 * conceptually "destinations mParticle is configured to fire" even
 * though they don't run via the JavaScript-kit machinery.
 *
 * @param {string} content - Raw response body (JSON text)
 * @returns {{
 *   apiKey: string|null,
 *   appName: string|null,
 *   destinations: Array<{ name: string, platformId: string|null, kind: 'kit'|'pixel', moduleId: number|null, raw: Object }>,
 *   destinationCount: number,
 * }|null}
 */
export function parseMparticleConfig(content) {
  if (!content) return null;
  let body;
  try {
    body = JSON.parse(content);
  } catch {
    return null;
  }
  if (!body || typeof body !== 'object') return null;

  const destinations = [];
  const kits = Array.isArray(body.kitConfigs) ? body.kitConfigs : [];
  for (const kit of kits) {
    const name = kit?.name;
    if (!name) continue;
    destinations.push({
      name,
      platformId: matchMparticleKit(name),
      kind: 'kit',
      moduleId: typeof kit.moduleId === 'number' ? kit.moduleId : null,
      raw: kit,
    });
  }
  // Pixel configurations (server-side firing on behalf of the client) —
  // surfaced alongside kits because they're real destinations.
  const pixels = Array.isArray(body.pixelConfigs) ? body.pixelConfigs : [];
  for (const pixel of pixels) {
    const name = pixel?.name || pixel?.kitName;
    if (!name) continue;
    destinations.push({
      name,
      platformId: matchMparticleKit(name),
      kind: 'pixel',
      moduleId: typeof pixel.moduleId === 'number' ? pixel.moduleId : null,
      raw: pixel,
    });
  }

  return {
    apiKey: null, // url-derived; caller fills via extractMparticleApiKey if needed
    appName: typeof body.appName === 'string' ? body.appName : null,
    destinations,
    destinationCount: destinations.length,
  };
}

// Map an mParticle kit name to a platform-registry id, or null if no
// match. First-match-wins iteration over MPARTICLE_KIT_PATTERNS.
export function matchMparticleKit(name) {
  if (!name || typeof name !== 'string') return null;
  for (const { pattern, platformId } of MPARTICLE_KIT_PATTERNS) {
    if (pattern.test(name)) return platformId;
  }
  return null;
}

/**
 * Detect whether a URL is the mParticle config endpoint. The default
 * configUrl is jssdkcdns.mparticle.com/JS/v2/{apiKey}/config, but
 * customers can self-host on their own subdomain (Constants.DefaultBaseUrls
 * is overridable in window.mParticle.config). The path shape `/JS/v2/<key>/config`
 * is the stable signature regardless of host.
 */
export function isMparticleConfigUrl(url) {
  if (!url) return false;
  // jssdkcdns.mparticle.com is the canonical CDN; also catch the
  // path-only signature for self-hosted setups.
  return /\/JS\/v\d+\/[^/]+\/config(?:\?|$)/i.test(url) && (
    /jssdkcdns\.mparticle\.com/i.test(url) || /mparticle/i.test(url)
  );
}

/**
 * Extract the mParticle API key from a config URL.
 * Example: https://jssdkcdns.mparticle.com/JS/v2/abc123/config → 'abc123'
 */
export function extractMparticleApiKey(url) {
  if (!url) return null;
  const m = url.match(/\/JS\/v\d+\/([^/]+)\/config/i);
  return m ? m[1] : null;
}
