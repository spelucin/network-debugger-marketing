// Grouped view registry — Feature #60.
//
// One source of truth for the grouping pivots available inside the Grouped
// view. The view-mode toolbar's chip-row, the `+` overflow picker, the
// renderer dispatch, and the analytics enum all read from this registry.
//
// Adding a new pivot is a registry entry plus (for flat groupings) a
// `groupKey` extractor and a `groupLabel` formatter. Tool and Page keep
// their bespoke renderers and delegate via `customRender`.

import { getRequiredConsentCategory } from '../../shared/detection/parsers/index.js';
import { getNormalizedEventName, EVENT_NAME_EQUIVALENTS } from '../../shared/detection/event-equivalents.js';
import { tmsVendorFromUrl, tmsVendorLabel } from '../../shared/detection/tag-manager-patterns.js';
import { extractHostname } from '../../shared/detection/url-patterns.js';
import { isSameRootDomain } from '../../shared/detection/cname-detection.js';
import { extractSetCookies } from './cookie-detector.js';

// The set of canonical (unified) event names — keys of EVENT_NAME_EQUIVALENTS.
// Used by the event_name pivot to decide whether a level-1 bucket is a real
// canonical group (Page View, Purchase, Add to Cart, …) that warrants a
// level-2 sub-grouping by raw tracked name, or just a raw event name with
// no canonical mapping (in which case events render flat under it).
const CANONICAL_EVENT_KEYS = new Set(Object.keys(EVENT_NAME_EQUIVALENTS));

// `'page_view'` -> `'Page View'`; raw names pass through unchanged so things
// like `user_engagement` or `[Amplitude] Web Vitals` are shown as the
// developer wrote them.
function canonicalEventLabel(key) {
  if (!CANONICAL_EVENT_KEYS.has(key)) return key;
  return key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Catalogue categories used by the `+` picker to organise pivots.
export const GROUPING_CATEGORIES = {
  audit:       { label: 'Audit',       order: 1 },
  debug:       { label: 'Debug',       order: 2 },
  operational: { label: 'Operational', order: 3 },
  marketing:   { label: 'Marketing',   order: 4 },
  temporal:    { label: 'Temporal',    order: 5 },
};

// Stable display order for the consent_category level-1 buckets.
// Infrastructure events (page navigations, dataLayer pushes, tag-manager
// internals, consent platforms themselves) don't bucket — `consentBucketForEvent`
// returns null for them and the flat-view renderer skips events whose
// groupKey is null. This view is purposefully scoped to events that
// actually gate on consent.
const CONSENT_CATEGORY_ORDER = ['marketing', 'analytics', 'functional'];
const CONSENT_CATEGORY_LABELS = {
  marketing:  'Marketing',
  analytics:  'Analytics',
  functional: 'Functional',
};

// Stable display order for the consent_category level-2 buckets (state on event).
// Severity-descending: pre-consent and denied at the top so violations surface
// first, advisory (cookieless ping / potential) sits between violations and
// granted, not-set at the bottom for events with no consent data.
const CONSENT_STATE_ORDER = ['pre-consent', 'denied', 'advisory', 'granted', 'not-set'];
const CONSENT_STATE_LABELS = {
  'pre-consent': 'Pre-consent',
  'denied':      'Denied',
  'advisory':    'Advisory',
  'granted':     'Granted',
  'not-set':     'Not Set',
};

// Shield SVG glyph — re-uses the same path as `event-list.js`, the report
// modal, the help icons, and the filter-bar consent-shield so the visual
// language stays consistent across the panel. Renderer builds the actual
// SVG nodes via createElementNS to avoid innerHTML in dynamic paths.
const CONSENT_SHIELD_PATH = 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z';
function consentStateIconSpec(stateKey) {
  return {
    className: `grouped-consent-shield grouped-consent-shield-${stateKey}`,
    svgPath: CONSENT_SHIELD_PATH,
  };
}

// Resolve a platform's required consent bucket for the consent_category
// pivot. Returns null when the event has no consent gating — pages,
// dataLayer pushes, tag-manager internals, consent platforms themselves,
// scripts, interactions, and any unrecognised platform. The flat-view
// renderer treats a null groupKey as "skip this event" so those
// infrastructure events drop out of the Consent view entirely.
function consentBucketForEvent(event, getCategoryForPlatform) {
  const platformCategory = getCategoryForPlatform
    ? (getCategoryForPlatform(event.platform) || 'unknown')
    : 'unknown';
  return getRequiredConsentCategory(platformCategory) || null;
}

// Resolve the level-2 state bucket for an event inside the consent_category
// pivot. Reads `event._consentCheck` via ctx.getConsentCheckForEvent (cached
// on first lookup in panel.js). Cookieless-ping / potential-severity denied
// events split off into their own `advisory` bucket so they don't inflate
// the strict denied count.
function consentStateBucket(event, ctx) {
  const check = ctx.getConsentCheckForEvent?.(event);
  if (!check || check.status === 'exempt') return 'not-set';
  if (check.status === 'pre-consent') return 'pre-consent';
  if (check.status === 'denied') {
    if (check.cookielessPing || check.severity === 'potential') return 'advisory';
    return 'denied';
  }
  if (check.status === 'granted') return 'granted';
  return 'not-set';
}

// Event-name extractor. Returns the canonical (unified) name when one
// exists in EVENT_NAME_EQUIVALENTS, falling back to the raw event name.
// This is the level-1 key for the event_name pivot — the level-2 raw
// tracked name is read directly off `event.eventName` in subGroupKey.
function eventNameKey(event) {
  return getNormalizedEventName(event.eventName) || event.eventName;
}

// Event Name pivot is meaningful only for tracking events with a real event
// name. Filter out navigations, interactions, script loads, and any event
// without a parsed `eventName` so the buckets stay focused on what users
// actually came to inspect (purchase, page_view, identify, …).
function eventNameFilter(event) {
  if (event.isInteraction) return false;
  if (event.isScriptLoad) return false;
  if (event.isNavigation) return false;
  if (event.platform === 'pages') return false;
  return typeof event.eventName === 'string' && event.eventName.length > 0;
}

// ─── Datalayer View ────────────────────────────────────────────────────────
//
// Three-level lens scoped to dataLayer events:
//   L1 = push origin class (Website / Tag Manager / Script / Historical / Unknown)
//   L2 = source attribution within the class (TMS vendor, script URL) — flat
//        fallback for L1 buckets where a sub-tier adds no information
//   L3 = events
//
// Push-source fields are populated by event-watcher-page.js as `_pushSource` /
// `_pushSourceUrl` on the raw payload, then surfaced on the panel-side event
// at `event.formatted.pushSource` / `event.formatted.pushSourceUrl` by the
// service worker (the underscore prefix is stripped at the boundary). Only
// dataLayer-platform events ever carry these fields — outbound SDK requests
// have no formatted.pushSource, which is exactly the scope this View wants.

// Stable display order for the L1 push-source buckets. Reads top-to-bottom
// as a narrative: your code → your tags → third-party → pre-hook → uncertain.
const DATALAYER_SOURCE_ORDER = ['website', 'tag-manager', 'script', 'historical', 'unknown'];
const DATALAYER_SOURCE_LABELS = {
  'website':     'Website',
  'tag-manager': 'Tag Manager',
  'script':      'Script',
  'historical':  'Historical',
  'unknown':     'Unknown',
};

// Normalise a script URL into a stable, readable key for L2 bucketing under
// the Script parent. Strip query strings (cache-busters, version hashes
// scatter near-identical scripts into many buckets) and trailing slashes.
// Falls back to the raw URL if parsing fails.
function normaliseScriptUrl(url) {
  if (!url || typeof url !== 'string') return '(unknown source)';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const path = parsed.pathname.replace(/\/+$/, '');
    return path ? `${host}${path}` : host;
  } catch {
    return url;
  }
}

// Datalayer eventFilter: only events that carry a `formatted.pushSource`.
// Outbound SDK network calls have no push source and drop out — Script Tree
// already covers their attribution.
function datalayerEventFilter(event) {
  return event && event.formatted && event.formatted.pushSource != null;
}

function datalayerSubGroupKey(event, parentKey) {
  const sourceUrl = event.formatted?.pushSourceUrl;
  if (parentKey === 'tag-manager') {
    return tmsVendorFromUrl(sourceUrl) || 'tag-manager-other';
  }
  if (parentKey === 'script') {
    return normaliseScriptUrl(sourceUrl);
  }
  // Website / Historical / Unknown: collapse flat (no L2 tier).
  return null;
}

function datalayerSubGroupLabel(key, eventsInSub) {
  // Tag Manager keys are vendor IDs ('gtm', 'tealium', …) — resolve to label
  // unless the key is the catch-all bucket for unknown TMS scripts.
  if (key === 'tag-manager-other') {
    const url = eventsInSub[0]?.formatted?.pushSourceUrl;
    return url ? `Other (${normaliseScriptUrl(url)})` : 'Other';
  }
  // Vendor key has a registered label → use it; otherwise the key is already
  // a normalised script URL string (Script L2) and reads as-is.
  const vendorLabel = tmsVendorLabel(key);
  return vendorLabel === key ? key : vendorLabel;
}

// ─── Endpoint Host View ────────────────────────────────────────────────────
//
// Three-level lens scoped to outbound tracking requests:
//   L1 = first-party / third-party (CNAME helper compares event host to the
//        page hostname active when the event fired)
//   L2 = hostname (count-desc — busiest endpoints surface first)
//   L3 = events
//
// Reads event URL from `event.raw?.url` (the canonical source already used by
// copy-export, ai-summary, and gtm-modal). Per-event page hostname is
// resolved via `ctx.getPageHostnameForEvent` — panel.js builds a per-render
// Map<eventId, pageHostname> by walking the chronologically-sorted event
// list and tagging each event with the most recent navigation's host. No new
// capture path; reuses existing url-patterns + cname-detection helpers.

const ENDPOINT_PARTY_ORDER = ['first-party', 'third-party'];
const ENDPOINT_PARTY_LABELS = {
  'first-party': 'First-party',
  'third-party': 'Third-party',
};

// Globe glyph for third-party, shield-with-house glyph for first-party.
// `subGroupIcon` actually fires per L1 here because we use the icon as the
// L1 visual — wait, the renderer uses subGroupIcon for L2 buckets. We use
// it instead on L1 via a small adapter below.
//
// The flat-view renderer puts subGroupIcon on the level-2 sub-header; for
// endpoint_host the meaningful visual lives at L1 (party class) so we don't
// supply subGroupIcon and let the L2 hostname header read as plain text.

function endpointHostKey(event) {
  const url = event.raw?.url;
  if (!url) return null;
  const host = extractHostname(url);
  return host || null;
}

function endpointHostFilter(event) {
  if (!event) return false;
  // Navigation sentinels and pure interactions have no outbound URL of
  // interest — drop them. Script loads stay in (CDN host is exactly the
  // L2 bucket the user wants to inspect).
  if (event.platform === 'pages' || event.isNavigation) return false;
  if (event.isInteraction) return false;
  return endpointHostKey(event) !== null;
}

function endpointPartyOf(event, ctx) {
  const host = endpointHostKey(event);
  if (!host) return null;
  const pageHost = ctx.getPageHostnameForEvent ? ctx.getPageHostnameForEvent(event) : '';
  // Without a known page host we can't make a confident first-vs-third
  // call — surface as third-party rather than guess. Most production
  // sessions have at least one navigation captured before any tracking.
  if (!pageHost) return 'third-party';
  return isSameRootDomain(host, pageHost) ? 'first-party' : 'third-party';
}

// ─── Cookies View ──────────────────────────────────────────────────────────
//
// Three-level lens scoped to events that wrote at least one cookie:
//   L1 = first-party-cookies / third-party-cookies (party of the request that
//        wrote the cookie — browsers reject cross-domain cookie writes, so
//        the request's party class matches the cookie's domain in practice)
//   L2 = cookie name (the first cookie set by the event — most analytics
//        events set just one; multi-cookie events surface their primary
//        cookie here, secondary cookies stay visible in the event detail)
//   L3 = events
//
// Reads via the existing `extractSetCookies` parser in cookie-detector.js
// — already cached on `event._parsedCookies` after the first call by the
// event detail / event row, so the descriptor pays no extra parse cost.
// No new capture path; reuses the same getPageHostnameForEvent helper as
// the Endpoint Host pivot for the party split.

const COOKIE_PARTY_ORDER = ['first-party', 'third-party'];
const COOKIE_PARTY_LABELS = {
  'first-party': 'First-party cookies',
  'third-party': 'Third-party cookies',
};

function cookieGroupKey(event, ctx) {
  // groupKey returning null = event dropped from the View. We push the
  // cookie-existence check in here (rather than into eventFilter) because
  // eventFilter doesn't receive ctx, and extractSetCookies — though
  // imported directly — is conceptually a per-event lookup that fits the
  // groupKey signature.
  const cookies = extractSetCookies(event);
  if (!Array.isArray(cookies) || cookies.length === 0) return null;

  const url = event.raw?.url;
  if (!url) return null;
  const host = extractHostname(url);
  if (!host) return null;
  const pageHost = ctx.getPageHostnameForEvent ? ctx.getPageHostnameForEvent(event) : '';
  if (!pageHost) return 'third-party';
  return isSameRootDomain(host, pageHost) ? 'first-party' : 'third-party';
}

function cookieSubGroupKey(event) {
  const cookies = extractSetCookies(event);
  if (!Array.isArray(cookies) || cookies.length === 0) return null;
  return cookies[0].name;
}

// ─── Identity View ─────────────────────────────────────────────────────────
//
// Three-level lens scoped to events that carry an identifier:
//   L1 = canonical identifier kind (User ID / Device ID / Session ID /
//        Pixel ID / Click ID / Other)
//   L2 = identifier value, with the original parser label as a prefix
//        when it differs from the canonical kind (e.g. under "Device
//        ID" you'll see "12345" plain for events with literal "Device
//        ID", and "Marketing Cloud ID · a3f8…" for events labelled
//        "Marketing Cloud ID (mid)" by the Adobe parser). Same value
//        across multiple parsers naturally collapses into one L2 bucket.
//   L3 = events
//
// The signature pattern this View exists for: an L1 bucket with 2+ L2
// sub-buckets means the identifier *changed* mid-session (regeneration,
// rotation, or identity-stitching gap). Currently invisible in Stream
// view. Collapsing to canonical kinds at L1 makes that visible across
// the parser ecosystem — without it, "Session ID" and "Session ID
// (u_scsid)" sit as separate L1 rows even though both are just session
// identifiers from different parsers.
//
// Identifiers live in THREE places across the parser ecosystem:
//   (1) `formatted.params['Identity']` — ~16 parsers (Adobe Experience
//       Platform, Bing Ads, Criteo, Facebook, Google Ads, Heap, Hubspot,
//       LinkedIn, Optimizely, Pendo, Piano, Pinterest, Snapchat,
//       Snowplow, TikTok, Twitter)
//   (2) `formatted.params['Identifiers']` — Adobe Analytics / Adobe
//       Audience Manager / Adobe Target (curated identifier group with
//       a different label by historical naming choice)
//   (3) `formatted.overview` — GA4, SS-GA4, Amplitude, Mixpanel, PostHog,
//       Segment / RudderStack / Hightouch, mParticle. These parsers put
//       the primary identifier(s) directly in overview rather than in a
//       separate group. We allowlist user/session-scoped labels here so
//       site-config labels (Measurement ID, API Key, Region, …) don't
//       become noise L1 buckets with one always-stable L2 value.
//
// Multi-identifier handling: events typically carry several identifiers
// (e.g. GA4 sets both Client ID and User ID for logged-in users; Adobe
// Analytics sets Marketing Cloud ID, Analytics ID, Org ID, Supplemental
// Data ID). Same pragmatic approach as View C (Cookies) — bucket by the
// *first* identifier collected; secondary identifiers stay visible in
// the event detail. Parser-author ordering already puts the most
// load-bearing ID (usually Client ID / User ID) first within their group.

// Curated allowlist of user/session-scoped identifier labels found in
// `formatted.overview`. Excludes site/config-level labels (e.g.
// "Measurement ID" — same value across every GA4 event from a property,
// "API Key" / "Write Key" / "Token" — credentials, "Region" /
// "Server Host" / "Library" / "SDK Version" — infrastructure, "App ID"
// / "Pixel ID" — site config). Including those would each form a single
// L2 bucket with no signal value for the "did the identifier change?"
// use case the View exists for.
const OVERVIEW_IDENTIFIER_LABELS = new Set([
  'Client ID',
  'User ID',
  'Device ID',
  'Session ID',
  'Distinct ID',
  'Anonymous ID',
  'Group ID',
  'Customer ID',
  'Visitor ID',
  'Firebase ID',
  'Developer ID',
  'External ID',
  'MPID',
  'ECID',
  'Identity', // Heap puts the user's identity string under this overview key
]);

const IDENTITY_PARAM_GROUPS = ['Identity', 'Identifiers'];

// Walk the three identifier sources for an event and return a flat
// ordered list of [label, value] pairs. First entry is the bucket the
// View groups the event under. Returns [] when the event has no
// recognised identifiers (script loads, navigations, unparsed requests).
function collectEventIdentifiers(event) {
  const out = [];
  const formatted = event && event.formatted;
  if (!formatted) return out;
  const seen = new Set();

  // 1. Overview — allowlist filter so config labels don't pollute.
  const overview = formatted.overview;
  if (overview && typeof overview === 'object') {
    for (const [label, value] of Object.entries(overview)) {
      if (value == null || value === '') continue;
      if (!OVERVIEW_IDENTIFIER_LABELS.has(label)) continue;
      if (seen.has(label)) continue;
      seen.add(label);
      out.push([label, String(value)]);
    }
  }

  // 2 & 3. Parser-curated Identity / Identifiers groups in formatted.params.
  const params = formatted.params;
  if (params && typeof params === 'object') {
    for (const groupName of IDENTITY_PARAM_GROUPS) {
      const group = params[groupName];
      if (!group || typeof group !== 'object') continue;
      for (const [label, value] of Object.entries(group)) {
        if (value == null || value === '') continue;
        if (seen.has(label)) continue;
        seen.add(label);
        out.push([label, String(value)]);
      }
    }
  }

  return out;
}

// Canonical identifier kinds that the View groups at L1. The mapping
// collapses parser-specific labels (Client ID, ECID, Distinct ID, …)
// into the load-bearing kind they actually represent. Unmapped labels
// fall through to "Other" so a new label introduced by a future parser
// stays visible in the View even before it gets formally categorised
// here.
//
// Kind definitions (helps decide where new labels go):
//   - User ID    — identified user, persists across sessions/devices
//                  (Customer ID, login user_id, Heap "Identity" string)
//   - Device ID  — anonymous device/browser/cookie-level, regenerates
//                  when cookies cleared (Client ID, Device ID, ECID,
//                  Distinct ID, Anonymous ID, Visitor ID, Firebase ID,
//                  MPID, GUID/UUID, Cookie ID, Analytics UID/aid)
//   - Session ID — session-scoped, regenerates per session
//   - Pixel ID   — site/account-level config (Pixel ID, Partner ID,
//                  Account ID, Property ID, App ID, Org ID, Tracking ID,
//                  Tag ID). Always one value per session, but useful for
//                  orientation ("which pixel was this site running?")
//   - Click ID   — campaign attribution from URL params (GCLID, fbclid,
//                  Facebook click cookies fbc/fbp)
//   - Other      — fallback for unmapped labels
const IDENTIFIER_KIND_MAP = new Map([
  // User ID
  ['User ID', 'User ID'],
  ['Customer ID', 'User ID'],
  ['Identity', 'User ID'],

  // Device ID
  ['Client ID', 'Device ID'],
  ['Device ID', 'Device ID'],
  ['Anonymous ID', 'Device ID'],
  ['Distinct ID', 'Device ID'],
  ['Visitor ID', 'Device ID'],
  ['ECID', 'Device ID'],
  ['Marketing Cloud ID', 'Device ID'],
  ['Firebase ID', 'Device ID'],
  ['MPID', 'Device ID'],
  ['Cookie ID', 'Device ID'],
  ['Cookie Present', 'Device ID'],
  ['GUID', 'Device ID'],
  ['UUID', 'Device ID'],
  ['Analytics UID', 'Device ID'],
  ['Analytics ID', 'Device ID'],
  ['LT Match ID', 'Device ID'],

  // Session ID
  ['Session ID', 'Session ID'],
  ['Idempotency Key', 'Session ID'],
  ['Supplemental Data ID', 'Session ID'],

  // Pixel ID — site/account config
  ['Pixel ID', 'Pixel ID'],
  ['Partner ID', 'Pixel ID'],
  ['Account ID', 'Pixel ID'],
  ['Property ID', 'Pixel ID'],
  ['App ID', 'Pixel ID'],
  ['Org ID', 'Pixel ID'],
  ['Tracking ID', 'Pixel ID'],
  ['Tag ID', 'Pixel ID'],
  ['Developer ID', 'Pixel ID'],
  ['DPID', 'Pixel ID'],

  // Click ID — campaign attribution
  ['GCLID', 'Click ID'],
  ['Click ID', 'Click ID'],
  ['fbclid', 'Click ID'],
  ['fbc', 'Click ID'],
  ['fbp', 'Click ID'],
  ['External ID', 'Click ID'],
]);

const CANONICAL_IDENTITY_KIND_ORDER = [
  'User ID', 'Device ID', 'Session ID', 'Pixel ID', 'Click ID', 'Other',
];

// Strip a trailing technical-key hint like " (mid)", " (u_scsid)",
// " (gclaw)" — many parsers append the raw URL key in parens after the
// friendly label. The base label is what we map to a canonical kind.
function stripIdentifierTechHint(label) {
  return label.replace(/\s*\([^)]+\)\s*$/, '').trim();
}

function canonicalIdentifierKind(rawLabel) {
  const base = stripIdentifierTechHint(rawLabel);
  return IDENTIFIER_KIND_MAP.get(base) || 'Other';
}

// Multi-bucket fan-out: an event with several identifiers of different
// canonical kinds (e.g. Amplitude with Device ID + Session ID; logged-in
// GA4 hit with User ID + Client ID) appears under EACH matching L1 kind
// — not just the first one. The renderer accepts arrays from groupKey
// so the descriptor can express this directly. Same fan-out at L2:
// Adobe Analytics events surface all their device-class identifiers
// (Marketing Cloud ID, Analytics ID) as separate L2 buckets under the
// Device ID parent.
function identityGroupKey(event) {
  const ids = collectEventIdentifiers(event);
  if (ids.length === 0) return null;
  const kinds = new Set();
  for (const [label] of ids) kinds.add(canonicalIdentifierKind(label));
  return Array.from(kinds);
}

function identitySubGroupKey(event, parentKind) {
  const ids = collectEventIdentifiers(event);
  const subKeys = [];
  const seen = new Set();
  for (const [label, value] of ids) {
    if (canonicalIdentifierKind(label) !== parentKind) continue;
    // Bucket key encodes the parser label only when it differs from the
    // canonical kind: a literal "Device ID" value renders as just
    // "<value>", a "Marketing Cloud ID" value renders as
    // "Marketing Cloud ID · <value>". Same value across parsers with
    // matching labels collapses naturally; same value across parsers
    // with different labels stays distinct.
    const base = stripIdentifierTechHint(label);
    const subKey = base === parentKind ? value : `${base} · ${value}`;
    if (seen.has(subKey)) continue;
    seen.add(subKey);
    subKeys.push(subKey);
  }
  return subKeys.length > 0 ? subKeys : null;
}

// Registry. Order here is the order the picker uses within each category.
export const GROUPINGS = [
  {
    id: 'tool',
    label: 'Tool',
    description: 'Events grouped by category and platform.',
    category: 'audit',
    defaultPinned: true,
    twoLevel: true,
    customRender: true,
  },
  {
    id: 'page',
    label: 'Page',
    description: 'Events grouped by domain and page.',
    category: 'audit',
    defaultPinned: true,
    twoLevel: true,
    customRender: true,
  },
  {
    id: 'event_name',
    label: 'Event Name',
    description: 'Group by unified event name (Page View, Purchase, …), then by the raw name as tracked.',
    category: 'audit',
    defaultPinned: false,
    groupKey: eventNameKey,
    groupLabel: canonicalEventLabel,
    eventFilter: eventNameFilter,
    sortGroups: 'count-desc',
    // Two-level: when the level-1 bucket is a canonical name (multiple raw
    // variants are known to alias to it), split by the raw tracked name so
    // users can see e.g. PAGE_VIEW / PageView / page_view rolled up under
    // Page View. Returns null when level-1 is itself a raw name (custom or
    // unmapped event), in which case events render flat under the parent.
    subGroupKey: (event, parentKey) => {
      if (!CANONICAL_EVENT_KEYS.has(parentKey)) return null;
      return event.eventName;
    },
    subGroupLabel: (key) => key,
    subGroupSort: 'count-desc',
  },
  {
    id: 'consent_category',
    label: 'Consent',
    description: 'Group consent-gated events by required category, then by consent state.',
    category: 'audit',
    defaultPinned: false,
    groupKey: (event, ctx) => consentBucketForEvent(event, ctx.getCategoryForPlatform),
    groupLabel: (key) => CONSENT_CATEGORY_LABELS[key] || key,
    sortGroups: (a, b) => {
      const ai = CONSENT_CATEGORY_ORDER.indexOf(a);
      const bi = CONSENT_CATEGORY_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    },
    // Two-level: split each category by consent state at event time.
    // Infrastructure events are already filtered out at level-1 (groupKey
    // returns null for them) so every level-1 bucket here gates on consent
    // and gets the state split.
    subGroupKey: (event, parentKey, ctx) => consentStateBucket(event, ctx),
    subGroupLabel: (key) => CONSENT_STATE_LABELS[key] || key,
    subGroupSort: (a, b) => {
      const ai = CONSENT_STATE_ORDER.indexOf(a);
      const bi = CONSENT_STATE_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    },
    subGroupIcon: consentStateIconSpec,
  },
  {
    id: 'datalayer',
    label: 'Datalayer',
    description: 'Group dataLayer pushes by where they came from — your site, a tag manager, or a third-party script.',
    category: 'debug',
    defaultPinned: false,
    eventFilter: datalayerEventFilter,
    groupKey: (event) => event.formatted?.pushSource || 'unknown',
    groupLabel: (key) => DATALAYER_SOURCE_LABELS[key] || key,
    sortGroups: (a, b) => {
      const ai = DATALAYER_SOURCE_ORDER.indexOf(a);
      const bi = DATALAYER_SOURCE_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    },
    // Two-level: Tag Manager splits by TMS vendor; Script splits by source
    // URL; Website / Historical / Unknown collapse flat (return null).
    subGroupKey: datalayerSubGroupKey,
    subGroupLabel: datalayerSubGroupLabel,
    subGroupSort: 'count-desc',
  },
  {
    id: 'endpoint_host',
    label: 'Endpoint',
    description: 'Group requests by destination host, split into first-party (your domains, including server-side / CNAME collectors) vs third-party.',
    category: 'debug',
    defaultPinned: false,
    eventFilter: endpointHostFilter,
    groupKey: endpointPartyOf,
    groupLabel: (key) => ENDPOINT_PARTY_LABELS[key] || key,
    sortGroups: (a, b) => {
      const ai = ENDPOINT_PARTY_ORDER.indexOf(a);
      const bi = ENDPOINT_PARTY_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    },
    // Two-level: party class → hostname. Flat-view renderer treats a null
    // sub-key as "skip", so this always returns the host (eventFilter
    // already guarantees non-null).
    subGroupKey: (event) => endpointHostKey(event),
    subGroupLabel: (key) => key,
    subGroupSort: 'count-desc',
  },
  {
    id: 'cookie_activity',
    label: 'Cookie',
    description: 'Group events that set cookies — first-party (your domain) vs third-party — and break down by cookie name.',
    category: 'audit',
    defaultPinned: false,
    groupKey: cookieGroupKey,
    groupLabel: (key) => COOKIE_PARTY_LABELS[key] || key,
    sortGroups: (a, b) => {
      const ai = COOKIE_PARTY_ORDER.indexOf(a);
      const bi = COOKIE_PARTY_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    },
    // Two-level: party class → cookie name. Multi-cookie events surface
    // their primary (first) cookie here; secondary cookies stay visible in
    // the event detail's Cookie Set section.
    subGroupKey: cookieSubGroupKey,
    subGroupLabel: (key) => key,
    subGroupSort: 'count-desc',
  },
  {
    id: 'identity',
    label: 'Identity',
    description: 'Group events by canonical identifier kind (User ID, Device ID, Session ID, Pixel ID, Click ID) and value — useful for spotting mid-session ID changes or identity-stitching gaps.',
    category: 'audit',
    defaultPinned: false,
    groupKey: identityGroupKey,
    groupLabel: (key) => key,
    // Stable narrative order: identified user first, then anonymous
    // device/session, then site/campaign config, then unclassified.
    sortGroups: (a, b) => {
      const ai = CANONICAL_IDENTITY_KIND_ORDER.indexOf(a);
      const bi = CANONICAL_IDENTITY_KIND_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    },
    // Two-level: canonical kind → identifier value. L1 with 2+ L2
    // sub-buckets means the identifier changed mid-session — the
    // signature pattern this View exists to surface.
    subGroupKey: identitySubGroupKey,
    subGroupLabel: (key) => key,
    subGroupSort: 'count-desc',
  },
];

const GROUPINGS_BY_ID = new Map(GROUPINGS.map(g => [g.id, g]));

export function getGrouping(id) {
  return GROUPINGS_BY_ID.get(id) || null;
}

export function getDefaultPinnedGroupings() {
  return GROUPINGS.filter(g => g.defaultPinned).map(g => g.id);
}

// Pinned-set version. Bump this whenever the default-pinned set in
// `GROUPINGS` changes; `loadSettings()` resets stored pin arrays to the new
// default when it sees a lower stored version.
//
// History
//   v1 — initial: ['tool', 'page', 'event_name']
//   v2 — Event Name demoted to the picker so the toolbar fits Stream + 2
//        Grouped chips + + + Script Tree without overflowing.
export const PINNED_GROUPINGS_VERSION = 2;

export function isValidGroupingId(id) {
  return GROUPINGS_BY_ID.has(id);
}

// Derives the `grouped_view_<id>` user-property value from the two persisted
// arrays. `activatedGroupings` is append-only — once a grouping has been
// activated by clicking, it never returns to 'never_used'.
export function getGroupedViewState(id, pinnedGroupings, activatedGroupings) {
  if (!activatedGroupings || !activatedGroupings.includes(id)) return 'never_used';
  return pinnedGroupings && pinnedGroupings.includes(id) ? 'pinned' : 'unpinned';
}
