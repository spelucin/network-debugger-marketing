// Stack View — attribution engine.
// Builds the tool-level martech-stack graph: aggregates captured events into
// platform nodes, resolves each platform's loader (page-source / tag-manager /
// daisy-chain / unknown), and produces the tree shape the renderer consumes.
//
// Pure derivation — no DOM, no Chrome APIs, no panel-state mutation. Imported
// from `stack-view.js` (renderer) and exercised directly by
// `tests/panel/stack-view.test.mjs`. Split out of stack-view.js to keep that
// file under the file-organization rule's ~1,000-line guideline now that
// Strategies A (authoritative TMS loader index), A2 (parent vote), and E
// (scriptChildrenMap reverse) have grown the attribution machinery.

import { normalizeToRegistrableDomain } from '../../shared/detection/url-patterns.js';
import { tmsVendorFromUrl } from '../../shared/detection/tag-manager-patterns.js';
import { getInitiatorCallStack } from '../../shared/detection/script-initiator.js';

// Map from `tmsVendorFromUrl` vendor keys to platform-registry IDs.
// When the chain walk encounters a known TMS URL in any call-stack
// frame, this gives us the specific platform ID to set as the parent.
//
// Vendor keys come from tag-manager-patterns.js; platform IDs from
// platform-registry.js. They are NOT identical strings — `commanders-act`
// is the vendor key but `commandersact-tms` is the registry id (the
// CMP variant is `commandersact-cmp`). Mismatches here silently fail
// attribution because chain-walk Pass 2 returns a platformId that no
// captured node has, so the synthesised stub TMS node also takes the
// wrong id and the parent edge can't be drawn.
const TMS_VENDOR_TO_PLATFORM_ID = {
  gtm: 'gtm',
  tealium: 'tealium',
  launch: 'adobe-launch',
  ensighten: 'ensighten',
  'commanders-act': 'commandersact-tms',
  'piwik-pro': 'piwik-pro-tm',
  zaraz: 'cloudflare-zaraz',
  segment: 'segment',
};

// GTM internal tag-type codes → set of plausible platform-ids.
// Comes from `gtm-analytics` telemetry's `formatted.tagExecutions[*].tagType`.
// When GTM's own telemetry says it ran a tag of one of these types AND we
// captured the corresponding platform in the same session, that's
// authoritative evidence GTM is the parent — strictly stronger than the
// chain-walk's first-party glue-script recovery, which is only a heuristic.
//
// Some types map to multiple plausible platforms ('googtag' is the unified
// Google tag — can route to GA4 OR Google Ads in a single tag config). We
// only attribute to a captured platform whose id is in this set; ambiguity
// in the GTM payload doesn't translate to over-attribution.
//
// Codes that DON'T identify a vendor (custom HTML, custom pixels, listeners)
// are intentionally absent — they tell us GTM ran *something* but not what
// that something was, so they're useless for attribution.
const GTM_TAG_TYPE_TO_PLATFORMS = {
  // Modern unified Google tag — GA4 + Google Ads umbrella
  googtag: new Set(['ga4', 'google-ads-conversion', 'google-ads-remarketing']),
  // GA4-specific (older GTM template names)
  gaawe: new Set(['ga4']),
  gaawc: new Set(['ga4']),
  // Universal Analytics (legacy — no longer in registry but harmless to list)
  ua: new Set(['google-analytics']),
  // Google Ads conversion
  awct: new Set(['google-ads-conversion']),
  // Google Ads remarketing / Audience Manager
  awem: new Set(['google-ads-remarketing']),
  // Conversion linker (Sphinx)
  sp: new Set(['google-ads-conversion', 'google-ads-remarketing']),
  gclidw: new Set(['google-ads-conversion', 'google-ads-remarketing']),
  // Floodlight (DCM)
  flc: new Set(['google-floodlight']),
  fls: new Set(['google-floodlight']),
  // LinkedIn Insight
  bzi: new Set(['linkedin']),
  // Twitter / X website tag
  twitter_website_tag: new Set(['twitter']),
  // Pinterest
  paid: new Set(['pinterest']),
};

// GTM container `tagsByEvent` event-name patterns → plausible platform-ids.
// `parseGTMContainerResponse` produces `tagsByEvent` from the container
// body's tag list; the event-name strings are vendor-shaped (e.g.
// `gtag.event.config`, `gtag.js`, `_event.facebook`). Substring matching
// keeps this resilient to GTM's evolving tag-template names.
//
// Same authority as GTM_TAG_TYPE_TO_PLATFORMS but sourced from the
// container body parser instead of telemetry — both signals point at the
// same fact ("GTM container is configured to load these vendors") and both
// outrank chain-walk heuristics.
const GTM_TAGS_EVENT_NAME_PATTERNS = [
  { pattern: /gtag\.event/i, platforms: new Set(['ga4', 'google-ads-conversion', 'google-ads-remarketing']) },
  { pattern: /\bga4\b|\bgaaw/i, platforms: new Set(['ga4']) },
  { pattern: /facebook|fbevents|fbq\b/i, platforms: new Set(['facebook']) },
  { pattern: /linkedin|lintrk/i, platforms: new Set(['linkedin']) },
  { pattern: /twitter|twq\b/i, platforms: new Set(['twitter']) },
  { pattern: /pinterest|pintrk/i, platforms: new Set(['pinterest']) },
  { pattern: /tiktok|ttq\b/i, platforms: new Set(['tiktok']) },
  { pattern: /snapchat|snaptr/i, platforms: new Set(['snapchat']) },
  { pattern: /hotjar|\bhjid\b/i, platforms: new Set(['hotjar']) },
  { pattern: /criteo/i, platforms: new Set(['criteo']) },
  { pattern: /floodlight|doubleclick/i, platforms: new Set(['google-floodlight']) },
];

// RUM (Real User Monitoring) libraries hook fetch / XHR and surface as
// the `initiatorUrl` of every subsequent network request. That makes
// them useless as a parent attribution signal — every tool would look
// like it was "loaded by adrum.js". When the chain walk hits one of
// these as a candidate parent, we skip it and try the next event's
// chain instead. Add to this set when a similar wrapper is detected.
const RUM_WRAPPER_PLATFORMS = new Set([
  'appdynamics',
  'newrelic',
  'datadog-rum',
  'sentry',
  'dynatrace',
]);

// Confidence tier per attribution source. Lower = less direct. The
// renderer / Tool detail panel pull copy from ATTRIBUTION_SOURCE_INFO;
// this map only encodes the High/Medium/Low ranking.
//
// Tier definitions:
//   high   = directly told to us by the loader itself, OR the browser's own
//            initiator chain unambiguously identified the parent. Trust this.
//   medium = inferred from secondary evidence (deeper call-stack frame, URL
//            pattern not session-captured). Probably right, worth checking.
//   low    = heuristic or fallback. The chain walker found a first-party
//            glue script and assumed page-source; or scriptChildrenMap was
//            the only signal; or we couldn't resolve at all.
export const CONFIDENCE_BY_SOURCE = {
  // Strategy A — Authoritative loader index (split by sub-source so
  // the Tool detail panel can name which loader payload confirmed this).
  // TMS sources:
  'tealium-loader-cfg': 'high',
  'gtm-tag-execution': 'high',
  'gtm-container-body': 'high',
  // CDP sources — same confidence tier; the CDP itself told us:
  'segment-destinations': 'high',
  'rudderstack-sourceconfig': 'high',
  'hightouch-sourceconfig': 'high',
  'mparticle-config': 'high',
  'aep-edge-destinations': 'high',
  // Adobe Launch — two sub-sources, both high but conceptually distinct
  // (will-fire vs. installed). Both bucket as 'high' because the
  // payload comes from the loader's own published library, same tier
  // as Tealium loader.cfg.
  'adobe-launch-rule-modules': 'high',
  'adobe-launch-extensions': 'high',
  // Explicit page-source signal from the page-script's stack-trace
  // classifier (`_pushSource: 'website'` / `'historical'`) or
  // chrome.devtools.network's `initiatorType: 'parser'`.
  'website-classification': 'high',
  // Strategy A2 — multi-event vote (≥2 events agreeing on the same parent).
  'parent-vote': 'high',
  // Strategy B — chain walk through scriptInitiatorMap / per-event
  // initiator data, terminating on a captured non-self platform.
  'chain-walk': 'high',
  // Same chain walk, but the URL was identified by hostname/endpoint
  // pattern instead of via a captured event. Covers cookie-sync iframes,
  // user-match relays, and any platform whose request shape we never
  // captured as its own event but whose URL still names the tool. One
  // tier below 'chain-walk' because matching by pattern is less direct
  // than seeing the captured event payload itself.
  'chain-walk-endpoint': 'medium',
  // Strategy C — call-stack scan (deeper frames). Three flavours:
  //   'call-stack-captured-platform' — the deeper frame is a captured platform
  //   'call-stack-tms-pattern'       — the frame URL matches a known TMS regex
  //   'call-stack-endpoint'          — the frame URL matches a known endpoint
  // Medium because the evidence is real but not as direct as a
  // first-frame initiator.
  'call-stack-captured-platform': 'medium',
  'call-stack-tms-pattern': 'medium',
  'call-stack-endpoint': 'medium',
  // First-party glue-script recovery — the chain ends on a same-eTLD+1
  // URL we don't track as a platform, so we infer page-source. Heuristic.
  'first-party-recovery': 'low',
  'call-stack-page-source': 'low',
  // Strategy E — scriptChildrenMap reverse signal. Final fallback when
  // chain walks gave up; loader is implied by parent → children indexing.
  'script-children-map': 'low',
  // Cycle-break post-pass demoted this node's parent because the cycle
  // was impossible. The recovered loader-type may itself be 'unknown'.
  'cycle-break-recovery': 'low',
  // No strategy resolved an attribution. UI surfaces this with the
  // existing yellow "Loader not detected — verify manually" warning.
  'unresolved': 'low',
};

// Human-readable explanation per attribution source. Used by the
// "Why this attribution" section in the Tool detail panel. Keep these
// short — the user wants the why, not a paragraph.
export const ATTRIBUTION_SOURCE_INFO = {
  'tealium-loader-cfg': "Tealium's own loader.cfg payload listed this vendor — the TMS confirmed it.",
  'gtm-tag-execution': 'GTM telemetry reported running a tag of this vendor type during the page load.',
  'gtm-container-body': 'The GTM container is configured with a tag for this vendor.',
  'segment-destinations': "Segment's CDN settings list this vendor as a configured destination.",
  'rudderstack-sourceconfig': "RudderStack's sourceConfig lists this vendor as an enabled destination.",
  'hightouch-sourceconfig': "Hightouch's sourceConfig lists this vendor as an enabled destination.",
  'mparticle-config': "mParticle's config lists this vendor as a configured kit or pixel.",
  'aep-edge-destinations': "Adobe's Edge Network dispatched a pixel or cookie sync to this vendor as part of an audience activation.",
  'adobe-launch-rule-modules': "An Adobe Launch rule's action calls into this extension — it will run when the rule fires.",
  'adobe-launch-extensions': 'This extension is installed in the Adobe Launch property.',
  'website-classification': 'The browser reported the page itself as the loader.',
  'parent-vote': 'Multiple events for this tool point at the same parent loader.',
  'chain-walk': "The browser's initiator chain leads directly to this parent.",
  'chain-walk-endpoint': "The initiator chain ends on a URL whose hostname matches this platform.",
  'call-stack-captured-platform': 'A captured platform appears deeper in the request call stack.',
  'call-stack-tms-pattern': 'A known tag-manager URL appears in the request call stack.',
  'call-stack-endpoint': "A URL matching this platform's hostname pattern appears in the request call stack.",
  'first-party-recovery': "The chain ended on the page's own domain — assumed page-source.",
  'call-stack-page-source': 'A first-party URL appears deep in the call stack — likely page-source.',
  'script-children-map': "Another captured script's outgoing children list includes this tool.",
  'cycle-break-recovery': 'Cycle-break post-pass — the original parent attribution was inconsistent.',
  'unresolved': "We couldn't attribute a loader from any of the strategies we tried.",
};

// Category-priority order — used to sort siblings at every level of the
// stack tree so the reader sees the *logical* tracking-stack layout:
//   1. dataLayer        — what the site sends in
//   2. Consent          — what governs whether tags fire
//   3. Tag Managers     — the orchestration layer
//   4. (everything else — outgoing tracking, sorted by category)
//
// Lower number = higher in the tree. Categories not in this map fall
// back to a high number (sorted last, then chronological).
const CATEGORY_PRIORITY = {
  'data-layer': 1,
  'consent': 2,
  'tag-manager': 3,
  'first-party-collection': 4,
  'cdp': 5,
  'analytics': 6,
  'session-replay': 7,
  'ab-testing': 8,
  'advertising': 9,
  'ad-tech': 10,
  'marketing-automation': 11,
  'video': 12,
  'widgets': 13,
  'monitoring': 14,
};

let _deps;

/**
 * Decide the loaderType string for a child given its resolved parent's
 * registry category. Centralised so every strategy applies the same rule
 * — the loaderType describes *what kind of loader* the parent is, which
 * is purely a property of the parent's category, independent of which
 * strategy resolved the attribution.
 *
 *   tag-manager category → 'tag-manager'
 *   cdp         category → 'cdp'
 *   anything else        → 'daisy-chain'
 *
 * The 'cdp' value was added when Segment + RudderStack joined Strategy A
 * — flattening Segment-loaded vendors into 'daisy-chain' lost the
 * meaningful distinction between "a CDP wired this" and "another tool
 * happened to load this".
 *
 * Callers must have `_deps` initialised. Returns 'daisy-chain' as a
 * defensive default if the lookup fails.
 */
function loaderTypeForParent(parentPlatformId) {
  if (!parentPlatformId) return 'daisy-chain';
  const cat = _deps?.getPlatformCategory(parentPlatformId);
  if (cat === 'tag-manager') return 'tag-manager';
  if (cat === 'cdp') return 'cdp';
  return 'daisy-chain';
}

/**
 * Apply an attribution result to a node. Centralised so every strategy
 * sets the same four fields together — parentPlatformId, loaderType,
 * attributionSource, attributionConfidence — and confidence is always
 * derived from source via CONFIDENCE_BY_SOURCE rather than passed in
 * separately (which would let the two drift).
 *
 * @param {Object} node
 * @param {string|null} parentPlatformId  - null for page-source / unresolved
 * @param {string} loaderType             - 'page-source' | 'tag-manager' | 'daisy-chain' | 'unknown'
 * @param {string} source                 - one of CONFIDENCE_BY_SOURCE keys
 */
function setAttribution(node, parentPlatformId, loaderType, source) {
  node.parentPlatformId = parentPlatformId;
  node.loaderType = loaderType;
  node.attributionSource = source;
  node.attributionConfidence = CONFIDENCE_BY_SOURCE[source] || 'low';
}

/**
 * Initialise the attribution engine. Mirrors the deps shape passed to
 * `initStackView` — categorised intentionally so the renderer and the
 * derivation can be initialised independently if a future caller wants
 * derivation-only (e.g. a CLI export tool).
 */
export function initStackAttribution(deps) {
  _deps = deps;
}

/**
 * Build the stack graph from captured events + script-initiator maps.
 * Returns a tree keyed on the current top-level domain (eTLD+1). Events from
 * other domains are excluded — Stack is per-site by contract.
 *
 * @param {Array}  events             - state.events
 * @param {Map}    scriptInitiatorMap - child URL → { type, initiatorUrl }
 * @param {string} currentHostname    - current page hostname (eTLD+1 derived)
 * @param {Map}   [scriptChildrenMap] - parent URL → [child URLs]; symmetric
 *   inverse of scriptInitiatorMap. Used as a last-resort fallback when the
 *   chain walk + call-stack scan can't attribute a node — given the parent's
 *   URL, look up its captured children and see if any belong to the unknown
 *   platform. Omitting it (e.g. legacy unit tests) skips the fallback.
 */
export function buildStackGraph(events, scriptInitiatorMap, currentHostname, scriptChildrenMap) {
  const rootDomain = currentHostname ? normalizeToRegistrableDomain(currentHostname) : '';

  // Walk chronologically so we can attach a page hostname to each event from the
  // most recent navigation that preceded it (mirrors panel.js buildGroupingCtx).
  const chronological = [...events].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  let walkPageHost = currentHostname || '';
  const eventToPageHost = new Map();
  for (const ev of chronological) {
    if (ev.isNavigation || ev.platform === 'pages') {
      try {
        const navUrl = ev.raw?.url || ev.eventName || '';
        const h = new URL(navUrl).hostname;
        if (h) walkPageHost = h;
      } catch { /* keep prior */ }
    }
    eventToPageHost.set(ev.id, walkPageHost);
  }

  // Same-registrable-domain check — used to recover page-source
  // attribution when a chain walks into a first-party glue script we
  // don't track as a platform (e.g. dr.dk's drtag.min.js loading GTM /
  // Cookiebot, telenor.dk's adrum.js wrapper). These scripts are by
  // definition loaded by the page itself, so the chain's terminus on
  // the page's own registrable domain is strong evidence of page-source
  // even when we can't see the <script> tag directly. Hoisted above
  // the aggregation loop so resolvePushSenderLabel can use it.
  const isFirstParty = (url) => {
    if (!url || !rootDomain) return false;
    try {
      const host = new URL(url).hostname;
      return host && normalizeToRegistrableDomain(host) === rootDomain;
    } catch {
      return false;
    }
  };

  const onCurrentSite = (ev) => {
    const host = eventToPageHost.get(ev.id) || currentHostname || '';
    return host && normalizeToRegistrableDomain(host) === rootDomain;
  };

  // Map scriptUrl → event (so we can resolve an initiator URL to a
  // captured platform). Skip meta-platforms (`pages` page-navigation
  // events, `interactions` clicks/etc.) — they're not loaders of other
  // tools, and exposing them as parents would cause chain walks that
  // reach the page URL to falsely attribute downstream platforms to
  // "pages" instead of resolving to page-source.
  const urlToEvent = new Map();
  for (const ev of events) {
    if (!onCurrentSite(ev)) continue;
    if (ev.platform === 'pages' || ev.platform === 'interactions') continue;
    const url = ev.formatted?.scriptUrl || ev.raw?.url;
    if (url) urlToEvent.set(url, ev);
  }

  const nodes = new Map();
  const ensureNode = (platformId) => {
    if (!nodes.has(platformId)) {
      nodes.set(platformId, {
        platformId,
        firstSeenAt: Infinity,
        firstEventId: null,
        firstScriptUrl: null,
        firstPageHost: '',
        parentPlatformId: null,
        loaderType: 'unknown',
        // Which strategy (and which sub-source for Strategy A) resolved this
        // node's attribution. Surfaces in the Tool detail panel's
        // "Why this attribution" section + the inline confidence dot on
        // stack cards. See ATTRIBUTION_SOURCE_INFO below for the human
        // copy that goes with each value.
        attributionSource: 'unresolved',
        // Confidence label derived from attributionSource via
        // CONFIDENCE_BY_SOURCE. Carried as its own field rather than
        // re-derived on every read so the renderer / tests / tracking
        // share one definition.
        attributionConfidence: 'low',
        children: [],
        alsoLoadedBy: [],
        requestCount: 0,
        scriptLoadCount: 0,
        eventIds: [],
        eventNameCounts: {},
        // Per-source push counts for nodes whose events come from
        // multiple senders (most often the dataLayer platform: a real
        // site's dataLayer is pushed to by website code AND GTM AND
        // the consent platform AND vendor SDKs). Keyed by the
        // resolved sender label: 'page-source', the platformId of the
        // sender if the sender's URL maps to a captured tool, or the
        // raw _pushSource value as a last resort.
        pushSources: {},
        // Per-source eventId buckets — keyed identically to
        // pushSources. Used by the Tool detail pane to filter the
        // displayed events / counts when the user clicks a shadow
        // row representing one specific sender of a multi-source
        // platform (e.g. the OneTrust-pushed dataLayer copy as
        // distinct from the page-source copy).
        eventIdsBySource: {},
      });
    }
    return nodes.get(platformId);
  };

  for (const ev of chronological) {
    if (!onCurrentSite(ev)) continue;
    const platformId = ev.platform;
    if (!platformId) continue;
    if (platformId === 'pages' || platformId === 'interactions') continue;

    const node = ensureNode(platformId);
    node.eventIds.push(ev.id);
    node.requestCount += 1;
    if (ev.isScriptLoad) node.scriptLoadCount += 1;

    const evName = ev.eventName;
    if (evName) {
      node.eventNameCounts[evName] = (node.eventNameCounts[evName] || 0) + 1;
    }

    const ts = ev.timestamp || 0;
    if (ts < node.firstSeenAt) {
      node.firstSeenAt = ts;
      node.firstEventId = ev.id;
      node.firstScriptUrl = ev.formatted?.scriptUrl || ev.raw?.url || null;
      node.firstPageHost = eventToPageHost.get(ev.id) || '';
    }

    // Track per-event push source so a single node (most importantly
    // `datalayer`) can surface that it has multiple senders. Resolution
    // priority: a recognised TMS via the URL pattern → that TMS's
    // platform-id; an `initiatorUrl` whose host is a captured platform
    // → that platform's id; `_pushSource` of `'website'`/`'historical'`
    // or `initiatorType: 'website'` → 'page-source'; otherwise
    // 'unknown'.
    //
    // Self-pushes are filtered: a platform pushing dataLayer events
    // about itself (gtm.js's SDK pushing gtm.dom/gtm.load) is
    // tautological and would falsely flag the platform as multi-source.
    const senderLabel = resolvePushSenderLabel(ev);
    if (senderLabel && senderLabel !== ev.platform) {
      node.pushSources[senderLabel] = (node.pushSources[senderLabel] || 0) + 1;
      if (!node.eventIdsBySource[senderLabel]) node.eventIdsBySource[senderLabel] = [];
      node.eventIdsBySource[senderLabel].push(ev.id);
    }
  }

  // Resolve the human-meaningful sender of a single event (for
  // pushSources aggregation). Returns null if there's nothing useful
  // to say.
  function resolvePushSenderLabel(ev) {
    if (!ev) return null;
    const pushSource = ev.raw?._pushSource;
    const pushSourceUrl = ev.raw?._pushSourceUrl;
    const initType = ev.formatted?.initiatorType || ev.raw?.initiatorType;
    const initUrl = ev.formatted?.initiatorUrl || ev.raw?.initiatorUrl;

    // Direct page-source signals.
    if (pushSource === 'website' || pushSource === 'historical') return 'page-source';
    if (initType === 'website') return 'page-source';

    // Try to map the sender URL to a known TMS or captured platform.
    const senderUrl = pushSourceUrl || initUrl;
    if (senderUrl) {
      const tmsVendor = tmsVendorFromUrl(senderUrl);
      if (tmsVendor) {
        const platformId = TMS_VENDOR_TO_PLATFORM_ID[tmsVendor];
        if (platformId) return platformId;
      }
      const senderEvent = urlToEvent.get(senderUrl);
      if (
        senderEvent?.platform
        && senderEvent.platform !== ev.platform
        && !RUM_WRAPPER_PLATFORMS.has(senderEvent.platform)
      ) {
        // RUM wrappers (adrum.js, NewRelic, etc.) hook fetch/XHR and falsely
        // surface as the initiator of every later request. Skip them as a
        // sender label — same discipline the chain walk uses (line ~977,
        // line ~1208). Falls through to isFirstParty / null.
        return senderEvent.platform;
      }
      if (isFirstParty(senderUrl)) return 'page-source';
    }

    // Fallback to the raw push-source classification.
    if (pushSource === 'tag-manager') return 'tag-manager';
    if (pushSource === 'script') return 'script';
    return null;
  }

  // Per-platform parent attribution.
  // Walks each platform's events in chronological order; the first event
  // that yields a determinate attribution wins. Two reasons for walking
  // multiple events instead of just the first:
  //
  //  1. Beacon-only platforms (Snapchat fires PAGE_VIEW before its SDK
  //     script load is observed). The first event's URL is a beacon, not
  //     a script, so scriptInitiatorMap doesn't have it — we have to
  //     read the event's own initiator data.
  //  2. RUM wrappers (AppDynamics adrum.js, NewRelic, DataDog RUM, Sentry)
  //     hook fetch and falsely surface as the initiator of every later
  //     network call. When the first event's chain runs through a known
  //     wrapper, we mark it tainted and try the next event — which
  //     usually has a clean initiator (the actual loader).
  //
  // Initiator data sources, checked in this order per URL:
  //  a. The event's own formatted/raw initiatorType + initiatorUrl
  //     (per-event chrome.devtools.network data).
  //  b. scriptInitiatorMap (panel-level script load tracking — covers
  //     scripts that loaded too early to have a captured event, and the
  //     legacy unit-test scenarios that only set this).
  const eventById = new Map();
  for (const ev of events) eventById.set(ev.id, ev);

  const getEventInitiator = (ev) => {
    if (!ev) return null;
    const type = ev.formatted?.initiatorType || ev.raw?.initiatorType || null;
    const initiatorUrl = ev.formatted?.initiatorUrl || ev.raw?.initiatorUrl || null;
    if (type || initiatorUrl) return { type, initiatorUrl };

    // dataLayer events don't have chrome.devtools.network initiator data
    // (they're synthetic, not network requests). The page-script's stack-
    // trace classification lives in `raw._pushSource` /
    // `raw._pushSourceUrl` instead — `'website'` / `'historical'` mean the
    // page itself pushed (page-source); `'tag-manager'` / `'script'` carry
    // the TMS or third-party URL in `_pushSourceUrl`. Map both into the
    // shape the chain walker expects so a dataLayer event resolves the
    // same way a script-load event with explicit initiator data does.
    const pushSource = ev.raw?._pushSource;
    if (pushSource) {
      const pushSourceUrl = ev.raw?._pushSourceUrl || null;
      if (pushSource === 'website' || pushSource === 'historical') {
        return { type: 'website', initiatorUrl: pushSourceUrl };
      }
      if (pushSource === 'tag-manager') {
        return { type: 'tagmanager', initiatorUrl: pushSourceUrl };
      }
      if (pushSource === 'script') {
        return { type: 'script', initiatorUrl: pushSourceUrl };
      }
    }

    // Final fallback: scriptInitiatorMap keyed on the event's own URL —
    // covers test scenarios and pre-hook script loads.
    const eventUrl = ev.formatted?.scriptUrl || ev.raw?.url;
    if (eventUrl) return scriptInitiatorMap.get(eventUrl) || null;
    return null;
  };

  // Step from one URL up to its loader's URL+type. Used while walking
  // the chain past intermediate scripts.
  const stepUp = (url) => {
    const fromMap = scriptInitiatorMap.get(url);
    if (fromMap) return fromMap;
    const fromEvent = getEventInitiator(urlToEvent.get(url));
    return fromEvent;
  };

  // (isFirstParty is declared earlier — hoisted so the aggregation
  // pass can use it.)

  // Resolve a URL to a platform-id by checking, in order:
  //   1. Captured events  — urlToEvent has this URL as a script/beacon URL
  //      we already aggregated into a platform node.
  //   2. Endpoint pattern — _deps.matchKnownEndpoint matches the URL to a
  //      tracked platform we never captured as its own event (cookie-sync
  //      iframes like u.openx.net/w/1.0/cm, user-match relays like
  //      ssp-sync.criteo.com/user-sync/iframe — these are real platforms
  //      doing real work, but their request shape doesn't match a parser).
  //
  // Returns:
  //   { platformId, viaEndpoint: false }  — captured event matched
  //   { platformId, viaEndpoint: true  }  — endpoint pattern matched
  //   { rum: true }                       — URL is a RUM wrapper (caller
  //                                         should mark its chain tainted)
  //   null                                — URL doesn't identify a platform,
  //                                         is the same platform as caller,
  //                                         or matchKnownEndpoint isn't wired
  //
  // Self-platform filter: a platform's chain walking back to its own URL
  // (Adform's beacon initiated by adform.net's bootstrap.js) is a
  // self-loop, not a parent edge. RUM filter: AppDynamics/NewRelic/etc
  // wrap fetch and falsely surface as initiator of every later request
  // — caller marks the chain tainted instead of treating as parent.
  const resolveUrlToPlatform = (url, selfPlatformId) => {
    if (!url) return null;
    // Pass 1: captured event with this exact URL as its script/beacon URL.
    const captured = urlToEvent.get(url)?.platform;
    if (captured && captured !== selfPlatformId) {
      if (RUM_WRAPPER_PLATFORMS.has(captured)) return { rum: true };
      return { platformId: captured, viaEndpoint: false };
    }
    // Pass 2: endpoint pattern match. Defensive try/catch — the matcher
    // shouldn't throw, but if it ever does (custom-endpoint regex
    // misconfig, etc.) we want attribution to keep working rather than
    // crash the whole graph build. typeof guard keeps legacy test
    // setups (which don't pass matchKnownEndpoint) working unchanged.
    if (typeof _deps?.matchKnownEndpoint === 'function') {
      let match = null;
      try { match = _deps.matchKnownEndpoint(url); } catch { /* swallow */ }
      const id = match?.endpoint?.id;
      if (id && id !== selfPlatformId) {
        if (RUM_WRAPPER_PLATFORMS.has(id)) return { rum: true };
        return { platformId: id, viaEndpoint: true };
      }
    }
    return null;
  };

  // ============================================================
  // Strategy helpers — ordered by attribution confidence
  // ============================================================

  // Strategy A — Authoritative loader index (TMS + CDP).
  //
  // Every loader that surfaces "I configured this vendor" payloads
  // contributes mappings to
  // `tmsLoaderIndex: Map<vendorPlatformId, { parent, source }>`.
  // When a vendor appears in this index AND the vendor's platform is
  // captured, attribution is definitive — strictly stronger than chain
  // walks, which are heuristic. Especially crucial for the
  // "wrongly-attributed-to-page-source" case the maintainer flagged: the
  // chain walker hits a first-party glue script and falls through to
  // page-source, but the loader's own configuration says otherwise. The
  // authoritative signal wins.
  //
  // Sources today (TMSes and CDPs both treated uniformly here — the
  // semantic distinction is the parent's category, not the source kind):
  //  - Tealium loader.cfg (utag.N.js → vendor platformId), via
  //    `getTealiumTagConfig`. Confirmed mappings only.
  //  - GTM tag-execution telemetry (`gtm-analytics` events with
  //    `formatted.tagExecutions[*].tagType`) — what GTM actually ran
  //    during this page load. Mapped via `GTM_TAG_TYPE_TO_PLATFORMS`.
  //  - GTM container body (`gtm` script-load events with
  //    `formatted.containerData.tagsByEvent`) — what the container is
  //    *configured* to run. Mapped via `GTM_TAGS_EVENT_NAME_PATTERNS`.
  //  - Segment settings (`segment` events with
  //    `formatted.segmentDestinations[*].platformId`) — destinations
  //    Segment is configured to load, parsed from the
  //    cdn.segment.com/v1/projects/{wk}/settings response body.
  //  - RudderStack sourceConfig (`rudderstack` events with
  //    `formatted.rudderstackDestinations[*].platformId`) — destinations
  //    RudderStack is configured to load, parsed from the
  //    {dataplane}/sourceConfig response body.
  //  - mParticle config (`mparticle` events with
  //    `formatted.mparticleDestinations[*].platformId`) — JS kits + pixel
  //    configs the SDK is set up to load, parsed from the
  //    jssdkcdns.mparticle.com/JS/v2/{apiKey}/config response body.
  //  - Adobe Launch published library (`adobe-launch` events with
  //    `formatted.containerData.{extensions,actionExtensions}`) — the
  //    Launch container's installed extensions + the subset referenced
  //    by rule actions. Two attribution sources:
  //    `adobe-launch-rule-modules` (will-fire) and
  //    `adobe-launch-extensions` (installed).
  //
  // Adding a new authoritative source = add another contributor to this
  // index. Same shape, no per-platform special-casing in the loop.
  // tmsLoaderIndex: Map<vendorPlatformId, { parent, source }>.
  // `source` records WHICH authoritative payload contributed the mapping
  // (Tealium loader.cfg / GTM tag execution / GTM container body) so the
  // Tool detail panel can name the exact signal in its "Why this
  // attribution" section.
  const tmsLoaderIndex = new Map();
  const setLoader = (vendorPlatformId, parentTmsPlatformId, source) => {
    if (!vendorPlatformId || !parentTmsPlatformId) return;
    if (vendorPlatformId === parentTmsPlatformId) return;
    // First writer wins — the iteration order below puts the most
    // confident sources (telemetry-confirmed) before the configured-but-
    // not-confirmed ones (container body), so a confirmed mapping isn't
    // overwritten by a less-certain one.
    if (!tmsLoaderIndex.has(vendorPlatformId)) {
      tmsLoaderIndex.set(vendorPlatformId, { parent: parentTmsPlatformId, source });
    }
  };

  // Source 1: Tealium loader.cfg (highest confidence — Tealium said so).
  const tealiumTagConfig = typeof _deps?.getTealiumTagConfig === 'function'
    ? _deps.getTealiumTagConfig()
    : null;
  if (tealiumTagConfig && nodes.has('tealium')) {
    for (const ev of events) {
      if (ev.platform !== 'tealium') continue;
      const tagUid = ev.formatted?.tealiumTagUid;
      if (!tagUid) continue;
      const vendor = tealiumTagConfig.get?.(tagUid);
      if (vendor?.platformId) setLoader(vendor.platformId, 'tealium', 'tealium-loader-cfg');
    }
  }

  // Source 2: GTM tag-execution telemetry (high confidence — GTM ran it
  // and reported back to Google). Each `gtm-analytics` event carries
  // `formatted.containerId` plus a `formatted.tagExecutions` array. Map
  // each tagType through GTM_TAG_TYPE_TO_PLATFORMS; for ambiguous types
  // (`googtag` → {ga4, google-ads-conversion, google-ads-remarketing}),
  // attribute every CAPTURED candidate to GTM. Uncaptured candidates
  // are ignored — we don't synthesize platforms from tag types alone.
  if (nodes.has('gtm')) {
    for (const ev of events) {
      if (ev.platform !== 'gtm-analytics') continue;
      const execs = ev.formatted?.tagExecutions;
      if (!Array.isArray(execs)) continue;
      for (const exec of execs) {
        const candidates = GTM_TAG_TYPE_TO_PLATFORMS[exec?.tagType];
        if (!candidates) continue;
        for (const candidate of candidates) {
          if (nodes.has(candidate)) setLoader(candidate, 'gtm', 'gtm-tag-execution');
        }
      }
    }
  }

  // Source 3: GTM container body — configured tag list (medium-high
  // confidence — the tag is in the container, but we don't know it
  // actually fired in this session). Substring-matched against
  // GTM_TAGS_EVENT_NAME_PATTERNS to handle GTM's evolving template
  // event-name shapes. Same captured-only constraint as Source 2.
  if (nodes.has('gtm')) {
    for (const ev of events) {
      if (ev.platform !== 'gtm') continue;
      const tagsByEvent = ev.formatted?.containerData?.tagsByEvent;
      if (!Array.isArray(tagsByEvent)) continue;
      for (const tag of tagsByEvent) {
        const name = tag?.name;
        if (!name) continue;
        for (const { pattern, platforms } of GTM_TAGS_EVENT_NAME_PATTERNS) {
          if (!pattern.test(name)) continue;
          for (const candidate of platforms) {
            if (nodes.has(candidate)) setLoader(candidate, 'gtm', 'gtm-container-body');
          }
        }
      }
    }
  }

  // Source 4: Segment destinations config — `cdn.segment.com/v1/projects/
  // {writeKey}/settings` response body. The settings event is emitted
  // by parseSegmentSettingsRequest with `formatted.segmentDestinations`
  // already mapped to platform-ids by parseSegmentSettings. The CDP
  // itself told us what it loads, so this is high-confidence — same
  // tier as Tealium loader.cfg.
  if (nodes.has('segment')) {
    for (const ev of events) {
      if (ev.platform !== 'segment') continue;
      const dests = ev.formatted?.segmentDestinations;
      if (!Array.isArray(dests)) continue;
      for (const dest of dests) {
        if (!dest?.platformId) continue;
        if (!nodes.has(dest.platformId)) continue;
        setLoader(dest.platformId, 'segment', 'segment-destinations');
      }
    }
  }

  // Source 5: RudderStack sourceConfig — `{dataplane}/sourceConfig`
  // response body. Same shape as Segment: emitted by
  // parseRudderStackSourceConfigRequest with platform-ids already
  // mapped, attribution is high-confidence.
  if (nodes.has('rudderstack')) {
    for (const ev of events) {
      if (ev.platform !== 'rudderstack') continue;
      const dests = ev.formatted?.rudderstackDestinations;
      if (!Array.isArray(dests)) continue;
      for (const dest of dests) {
        if (!dest?.platformId) continue;
        if (!nodes.has(dest.platformId)) continue;
        // Disabled destinations exist in the config but won't fire in
        // practice — skip them so they don't pollute the loader graph.
        if (dest.enabled === false) continue;
        setLoader(dest.platformId, 'rudderstack', 'rudderstack-sourceconfig');
      }
    }
  }

  // Source 5b: Hightouch sourceConfig — same shape as RudderStack
  // (Hightouch's browser SDK is a RudderStack fork). Disabled
  // destinations are skipped here too.
  if (nodes.has('hightouch')) {
    for (const ev of events) {
      if (ev.platform !== 'hightouch') continue;
      const dests = ev.formatted?.hightouchDestinations;
      if (!Array.isArray(dests)) continue;
      for (const dest of dests) {
        if (!dest?.platformId) continue;
        if (!nodes.has(dest.platformId)) continue;
        if (dest.enabled === false) continue;
        setLoader(dest.platformId, 'hightouch', 'hightouch-sourceconfig');
      }
    }
  }

  // Source 6: mParticle config — `{configUrl}/JS/v2/{apiKey}/config`
  // response body. Carries `kitConfigs` (JS kits — the destinations
  // mParticle's web SDK loads in-browser) and `pixelConfigs` (server-
  // routed pixels — fired by mParticle on behalf of the page). Both
  // count as "destinations mParticle is configured to fire", so both
  // contribute to the loader index. Emitted by
  // parseMparticleConfigRequest with platform-ids already mapped.
  if (nodes.has('mparticle')) {
    for (const ev of events) {
      if (ev.platform !== 'mparticle') continue;
      const dests = ev.formatted?.mparticleDestinations;
      if (!Array.isArray(dests)) continue;
      for (const dest of dests) {
        if (!dest?.platformId) continue;
        if (!nodes.has(dest.platformId)) continue;
        setLoader(dest.platformId, 'mparticle', 'mparticle-config');
      }
    }
  }

  // Source 6b: Adobe Web SDK / alloy.js — Edge Network audience-
  // activation destinations. Each `/interact` response can carry URL
  // pixel notifications and cookie syncs in `handle[*]` entries of
  // type `activation:push` (or legacy `destinations`). The URL is
  // already resolved to a platform-id by the request-handler layer
  // (which has access to `matchKnownEndpoint`), so we just thread it
  // into the loader index. Aggregates across the session — the same
  // audience destination can be dispatched in many interact requests.
  if (nodes.has('adobe-experience-platform')) {
    for (const ev of events) {
      if (ev.platform !== 'adobe-experience-platform') continue;
      const dests = ev.formatted?.aepDestinations;
      if (!Array.isArray(dests)) continue;
      for (const dest of dests) {
        if (!dest?.platformId) continue;
        if (!nodes.has(dest.platformId)) continue;
        setLoader(dest.platformId, 'adobe-experience-platform', 'aep-edge-destinations');
      }
    }
  }

  // Source 7: Adobe Launch container body — the published library's
  // embedded `_satellite.container = {...}` literal. Two sub-signals:
  //   - actionExtensions: extensions referenced by rule actions —
  //     these will fire when their rule triggers. Strongest signal
  //     ("Launch will execute this extension's action").
  //   - extensions: every installed extension, regardless of whether
  //     a rule references it. Configured-only — the extension is
  //     present in the property but might not run on the page.
  // Both feed the same loader index. Iteration order puts
  // actionExtensions first so the more-direct source wins (first-writer-
  // wins in setLoader). When the same vendor is in both, the source
  // recorded is `adobe-launch-rule-modules` rather than the
  // configured-only `adobe-launch-extensions`.
  if (nodes.has('adobe-launch')) {
    for (const ev of events) {
      if (ev.platform !== 'adobe-launch') continue;
      const cd = ev.formatted?.containerData;
      if (!cd) continue;
      // Pass 1: rule-referenced extensions (will execute).
      if (Array.isArray(cd.actionExtensions)) {
        for (const ext of cd.actionExtensions) {
          if (!ext?.platformId) continue;
          if (!nodes.has(ext.platformId)) continue;
          setLoader(ext.platformId, 'adobe-launch', 'adobe-launch-rule-modules');
        }
      }
      // Pass 2: installed extensions (configured, may or may not fire).
      if (Array.isArray(cd.extensions)) {
        for (const ext of cd.extensions) {
          if (!ext?.platformId) continue;
          if (!nodes.has(ext.platformId)) continue;
          setLoader(ext.platformId, 'adobe-launch', 'adobe-launch-extensions');
        }
      }
    }
  }

  // Strategy B — call-stack loader scan. When the event-level chain
  // walk stalls (frame-0 chain runs out, or the platform's own URL is
  // its own initiator), the FULL call stack (frames 1+) usually still
  // names the real loader. We scan every frame in three passes:
  //
  //   1. Captured non-self, non-RUM platform — strongest match.
  //   2. Known TMS URL via `tmsVendorFromUrl` — TMS that wasn't
  //      captured as its own event.
  //   3. First-party URL (same eTLD+1) — implies page-source via
  //      a glue script we don't track.
  //
  // RUM-tainted stacks (any frame is a known RUM wrapper) skip pass 3
  // — RUM hooks fetch and rewrites the call chain, so the chain's
  // terminus on a first-party URL there is not trustworthy evidence.
  // Returns `{ kind: 'parent'|'page-source', platformId?, loaderType? }`
  // or null.
  const findLoaderInStack = (ev, selfPlatformId) => {
    const initiator = ev?.raw?.initiator;
    if (!initiator) return null;
    const frames = getInitiatorCallStack(initiator);
    if (!Array.isArray(frames) || frames.length === 0) return null;

    // Pre-pass: is the stack RUM-tainted anywhere? If a known RUM
    // wrapper appears at any frame, treat the entire stack as
    // potentially rewritten by the wrapper — don't trust same-eTLD+1
    // termini in pass 3.
    let tainted = false;
    for (const url of frames) {
      if (!url) continue;
      const platform = urlToEvent.get(url)?.platform;
      if (platform && RUM_WRAPPER_PLATFORMS.has(platform)) {
        tainted = true;
        break;
      }
    }

    // Pass 1: captured non-self platform — the highest-confidence
    // signal because it's a tool we already attributed in this session.
    // Temporal sanity is NOT enforced here: chrome.devtools.network
    // reports `timestamp` at request-finish time, so a beacon fired
    // mid-script-load can have an earlier timestamp than the script's
    // load event even though the script genuinely loaded the beacon.
    // Real impossible attributions (cycles) are caught by the post-pass
    // cycle break, which uses temporal evidence to choose which edge
    // to drop.
    for (const url of frames) {
      if (!url) continue;
      const platform = urlToEvent.get(url)?.platform;
      if (platform && platform !== selfPlatformId && !RUM_WRAPPER_PLATFORMS.has(platform)) {
        return {
          kind: 'parent',
          platformId: platform,
          loaderType: loaderTypeForParent(platform),
          source: 'call-stack-captured-platform',
        };
      }
    }

    // Pass 2: known TMS URL pattern — covers TMS scripts that ran
    // before our hook attached and weren't captured.
    for (const url of frames) {
      if (!url) continue;
      const vendor = tmsVendorFromUrl(url);
      if (!vendor) continue;
      const tmsPlatformId = TMS_VENDOR_TO_PLATFORM_ID[vendor];
      if (!tmsPlatformId || tmsPlatformId === selfPlatformId) continue;
      return {
        kind: 'parent',
        platformId: tmsPlatformId,
        loaderType: 'tag-manager',
        source: 'call-stack-tms-pattern',
      };
    }

    // Pass 2.5: known endpoint URL pattern — covers non-TMS platforms
    // whose URL appears in a deeper frame but wasn't captured as its
    // own event (cookie-sync iframes, user-match relays, vendor
    // bootstraps that ran before our hook attached). Same authority
    // tier as Pass 2 but for non-TMS endpoints. typeof guard preserves
    // legacy test setups that don't pass matchKnownEndpoint.
    if (typeof _deps?.matchKnownEndpoint === 'function') {
      for (const url of frames) {
        if (!url) continue;
        let match = null;
        try { match = _deps.matchKnownEndpoint(url); } catch { /* swallow */ }
        const epId = match?.endpoint?.id;
        if (!epId || epId === selfPlatformId || RUM_WRAPPER_PLATFORMS.has(epId)) continue;
        return {
          kind: 'parent',
          platformId: epId,
          loaderType: loaderTypeForParent(epId),
          source: 'call-stack-endpoint',
        };
      }
    }

    // Pass 3: first-party frame → page-source. Skipped when RUM-tainted.
    if (!tainted) {
      for (const url of frames) {
        if (!url) continue;
        if (isFirstParty(url)) {
          return { kind: 'page-source', source: 'call-stack-page-source' };
        }
      }
    }

    return null;
  };

  // ============================================================
  // Per-platform attribution — strategies tried in confidence order
  // ============================================================

  for (const node of nodes.values()) {
    let resolved = false;

    // ----- Strategy A: Authoritative loader index -----
    // Beats every chain-walk heuristic — the loader itself told us it
    // loaded this vendor (Tealium loader.cfg, GTM tag-execution telemetry,
    // GTM container body, Segment settings, RudderStack sourceConfig).
    // Override even an existing page-source attribution: the chain walker's
    // first-party-glue recovery is heuristic, the loader's signal is direct.
    //
    // Loader-type comes from `loaderTypeForParent` — keyed on the
    // parent's registry category so TMS / CDP / other distinctions are
    // applied uniformly across every strategy.
    const authoritative = tmsLoaderIndex.get(node.platformId);
    if (authoritative && authoritative.parent !== node.platformId) {
      setAttribution(node, authoritative.parent, loaderTypeForParent(authoritative.parent), authoritative.source);
      continue;
    }

    const sortedEvents = node.eventIds
      .map((id) => eventById.get(id))
      .filter(Boolean)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    // ----- Strategy A2: parent-vote across all events -----
    // Why this exists: the maintainer's main complaint is "tools shown as
    // page-source when I know GTM loaded them". Root cause is first-event-
    // wins semantics — the first beacon for a vendor chains through a
    // first-party glue script and yields page-source, even when later
    // events for the same vendor name a real TMS as their loader. A simple
    // confidence-ranked vote across events fixes the common case without
    // touching the chain-walk semantics each individual event uses.
    //
    // Confidence order (highest to lowest):
    //   1. captured-parent that's a tag-manager   (loaderType: 'tag-manager')
    //   2. captured-parent that's another tool    (loaderType: 'daisy-chain')
    //   3. page-source                            (heuristic)
    //
    // Among same-confidence candidates, the most-frequently-observed parent
    // wins; ties break on chronological order (first event observed).
    //
    // Single-event nodes skip this pass (no real vote possible) and fall
    // through to Strategy B's existing first-wins flow — preserves all
    // current single-event behaviour.
    if (sortedEvents.length > 1) {
      const parentVotes = new Map(); // parentPlatformId → { count, firstSeenIdx, loaderType }
      let pageSourceVotes = 0;
      sortedEvents.forEach((ev, idx) => {
        const evInit = getEventInitiator(ev);
        if (!evInit) return;

        let voteParent = null;

        // Branch 1: explicit website classification. The browser says
        // "the page is the immediate caller" — but the page's caller
        // is often itself a known loader (page invoking gtag('config')
        // triggers a request to gtag/js; page injecting a vendor
        // iframe triggers requests from inside that iframe). Try
        // resolving the URL to a platform first; only fall through to
        // a page-source vote when the URL is genuinely unidentifiable.
        if (evInit.type === 'website') {
          const r = resolveUrlToPlatform(evInit.initiatorUrl, node.platformId);
          if (r?.rum) return; // RUM wrapper — abandon this event's vote
          if (r?.platformId) {
            voteParent = r.platformId;
            // fall through to vote-recording at the bottom
          } else {
            pageSourceVotes += 1;
            return;
          }
        } else {
          // Branch 2: walk this event's chain looking for the first
          // captured-or-known-endpoint non-self parent. Same chain-walk
          // skeleton as Strategy B, but only collecting a vote — doesn't
          // mutate node state.
          let walkUrl = evInit.initiatorUrl;
          const visited = new Set();
          let safety = 32;
          while (walkUrl && !visited.has(walkUrl) && safety-- > 0) {
            visited.add(walkUrl);
            const r = resolveUrlToPlatform(walkUrl, node.platformId);
            if (r?.rum) {
              // RUM-tainted chain — abandon this event's vote rather
              // than count a known-bad attribution.
              voteParent = null;
              break;
            }
            if (r?.platformId) {
              voteParent = r.platformId;
              break;
            }
            const upInfo = stepUp(walkUrl);
            if (!upInfo) break;
            if (upInfo.type === 'website') {
              // Mid-chain website terminus — same URL→platform check
              // as Branch 1 before falling to page-source.
              const upR = resolveUrlToPlatform(upInfo.initiatorUrl, node.platformId);
              if (upR?.rum) {
                voteParent = null;
                break;
              }
              if (upR?.platformId) {
                voteParent = upR.platformId;
              } else {
                pageSourceVotes += 1;
                return;
              }
              break;
            }
            walkUrl = upInfo.initiatorUrl;
          }
        }

        if (voteParent) {
          const existing = parentVotes.get(voteParent);
          if (existing) {
            existing.count += 1;
          } else {
            parentVotes.set(voteParent, {
              count: 1,
              firstSeenIdx: idx,
              loaderType: loaderTypeForParent(voteParent),
            });
          }
        }
      });

      if (parentVotes.size > 0) {
        // Pick the best-supported parent. Confidence tiers:
        //   1. structured-loader category (tag-manager OR cdp) — these
        //      are platforms whose explicit job is to load other tools,
        //      so a vote naming one of them as parent is more credible
        //      than one naming a generic non-orchestrator tool.
        //   2. daisy-chain (any other category) — incidental loading.
        // Within a tier, highest count wins; ties break on earliest-
        // observed event. We don't sub-rank tag-manager over cdp because
        // both are structured loaders — picking by observation count
        // captures the actual chain better than category preference.
        const isStructured = (lt) => lt === 'tag-manager' || lt === 'cdp';
        let best = null;
        for (const [platformId, info] of parentVotes.entries()) {
          if (!best) {
            best = { platformId, ...info };
            continue;
          }
          const bestStructured = isStructured(best.loaderType);
          const candStructured = isStructured(info.loaderType);
          if (candStructured && !bestStructured) {
            best = { platformId, ...info };
          } else if (candStructured === bestStructured) {
            if (info.count > best.count) {
              best = { platformId, ...info };
            } else if (info.count === best.count && info.firstSeenIdx < best.firstSeenIdx) {
              best = { platformId, ...info };
            }
          }
        }
        setAttribution(node, best.platformId, best.loaderType, 'parent-vote');
        resolved = true;
        // Skip the rest of the strategies — vote outranks them by design.
      }
    }

    // ----- Strategy B: per-event chain walk (frame-0 + scriptInitiatorMap) -----
    // Walks each event in chronological order; first event that yields
    // a determinate parent wins. Beacon-only platforms (Snapchat fires
    // PAGE_VIEW before its SDK script load) need this multi-event walk
    // because their first event is a beacon, not a script load.
    // RUM-tainted chains (AppDynamics adrum.js wraps fetch) abandon the
    // current event and try the next one rather than trusting the
    // chain's terminus.
    // Skipped when Strategy A2 (vote) already resolved.
    for (const ev of sortedEvents) {
      if (resolved) break;
      const evInit = getEventInitiator(ev);
      if (!evInit) continue;

      // Page-source from explicit 'website' classification — but the
      // URL the page is "directly loading" might itself be a known
      // platform (page invoking gtag('config'), page injecting an
      // iframe relay). Try URL→platform first; only fall to
      // page-source when the URL is genuinely unidentifiable.
      if (evInit.type === 'website') {
        const r = resolveUrlToPlatform(evInit.initiatorUrl, node.platformId);
        if (r?.platformId) {
          setAttribution(
            node,
            r.platformId,
            loaderTypeForParent(r.platformId),
            r.viaEndpoint ? 'chain-walk-endpoint' : 'chain-walk',
          );
          resolved = true;
          break;
        }
        // RUM-tainted website-typed URL is rare (RUM doesn't typically
        // wrap the page's own loader script), but if it happens we
        // skip this event rather than mis-attribute.
        if (!r?.rum) {
          setAttribution(node, null, 'page-source', 'website-classification');
          resolved = true;
        }
        break;
      }

      let walkUrl = evInit.initiatorUrl;
      const visited = new Set();
      let safety = 32;
      let tainted = false;

      while (walkUrl && !visited.has(walkUrl) && safety-- > 0) {
        visited.add(walkUrl);

        // Resolve walkUrl against captured events first, then against
        // known endpoint patterns. The endpoint pass is what catches
        // cookie-sync iframes (u.openx.net/w/1.0/cm,
        // ssp-sync.criteo.com/user-sync/iframe) that aren't captured
        // as their own events but whose hostname unambiguously names
        // the loading platform.
        const r = resolveUrlToPlatform(walkUrl, node.platformId);
        if (r?.rum) {
          tainted = true;
          break;
        }
        if (r?.platformId) {
          // No in-walker temporal check — sub-second overlaps between a
          // loader's script-finish time and a child's beacon are normal
          // (the script started loading, the child's beacon fired, the
          // script's load event finalised). The post-pass cycle break
          // catches real impossible attributions using temporal
          // evidence only when an actual cycle is detected.
          setAttribution(
            node,
            r.platformId,
            loaderTypeForParent(r.platformId),
            r.viaEndpoint ? 'chain-walk-endpoint' : 'chain-walk',
          );
          resolved = true;
          break;
        }

        const upInfo = stepUp(walkUrl);
        if (!upInfo) {
          // Chain stalled. Run the richer call-stack scan — finds
          // captured platforms, known TMS URLs, or first-party frames
          // anywhere in the stack, not just at frame 0.
          if (!tainted) {
            const result = findLoaderInStack(ev, node.platformId);
            if (result?.kind === 'parent') {
              setAttribution(node, result.platformId, result.loaderType, result.source);
              resolved = true;
              break;
            }
            if (result?.kind === 'page-source') {
              setAttribution(node, null, 'page-source', result.source);
              resolved = true;
              break;
            }
            // Final inline fallback — the URL the chain stalled on.
            if (isFirstParty(walkUrl)) {
              setAttribution(node, null, 'page-source', 'first-party-recovery');
              resolved = true;
            }
          }
          break;
        }

        if (upInfo.type === 'website') {
          if (!tainted) {
            // Same URL→platform-first treatment as the outer
            // website-bail above: a mid-chain website terminus is only
            // page-source if its URL doesn't itself name a tracked
            // platform.
            const upR = resolveUrlToPlatform(upInfo.initiatorUrl, node.platformId);
            if (upR?.platformId) {
              setAttribution(
                node,
                upR.platformId,
                loaderTypeForParent(upR.platformId),
                upR.viaEndpoint ? 'chain-walk-endpoint' : 'chain-walk',
              );
              resolved = true;
            } else if (!upR?.rum) {
              setAttribution(node, null, 'page-source', 'website-classification');
              resolved = true;
            }
          }
          break;
        }

        walkUrl = upInfo.initiatorUrl;
      }

      if (resolved) break;

      // If this event's chain walk didn't resolve (e.g. RUM-tainted, or
      // initiator chain too shallow to terminate), still try the
      // call-stack scan before moving to the next event. Frame-0's
      // chain may have failed but a deeper frame may carry the answer.
      if (!resolved && !tainted) {
        const result = findLoaderInStack(ev, node.platformId);
        if (result?.kind === 'parent') {
          setAttribution(node, result.platformId, result.loaderType, result.source);
          resolved = true;
          break;
        }
        if (result?.kind === 'page-source') {
          setAttribution(node, null, 'page-source', result.source);
          resolved = true;
          break;
        }
      }
    }

    // ----- Strategy C: Last-resort full-stack scan across all events -----
    // Some events have no useful initiator chain at all (initiatorUrl=null,
    // _pushSource missing) but their callFrames still name a TMS, a
    // captured platform, or a first-party frame. Sweep every event's
    // stack in chronological order.
    if (!resolved) {
      for (const ev of sortedEvents) {
        const result = findLoaderInStack(ev, node.platformId);
        if (result?.kind === 'parent') {
          setAttribution(node, result.platformId, result.loaderType, result.source);
          resolved = true;
          break;
        }
        if (result?.kind === 'page-source') {
          setAttribution(node, null, 'page-source', result.source);
          resolved = true;
          break;
        }
      }
    }

    if (!resolved) {
      setAttribution(node, null, 'unknown', 'unresolved');
    }
  }

  // ----- Strategy E: scriptChildrenMap reverse signal -----
  // Final fallback for nodes that are still unknown. Uses the inverse of
  // scriptInitiatorMap — for every captured (parent script URL, child
  // script URLs) pair, check if any child URL maps to an unknown-loader
  // node. If yes, attribute that node to the parent's platform.
  //
  // Why this catches things the chain walk misses: chrome.devtools.network
  // doesn't always report initiator on every request shape (e.g. some
  // beacon endpoints, prefetched scripts, CORS-failed fetches). When the
  // child's own initiator data is empty but the parent's request DID name
  // the child as one of its outgoing loads, we still have a valid edge.
  if (scriptChildrenMap && scriptChildrenMap.size > 0) {
    for (const node of nodes.values()) {
      if (node.loaderType !== 'unknown') continue;
      // The set of URLs we'd recognise as belonging to this node.
      const nodeUrls = new Set();
      for (const id of node.eventIds) {
        const ev = eventById.get(id);
        const url = ev?.formatted?.scriptUrl || ev?.raw?.url;
        if (url) nodeUrls.add(url);
      }
      if (nodeUrls.size === 0) continue;

      // Walk the parent→children index. The first parent whose children
      // include any of this node's URLs wins (children typically share
      // exactly one parent script).
      for (const [parentUrl, children] of scriptChildrenMap.entries()) {
        if (!Array.isArray(children)) continue;
        const hit = children.some((c) => nodeUrls.has(c));
        if (!hit) continue;
        const parentEvent = urlToEvent.get(parentUrl);
        const parentPlatform = parentEvent?.platform;
        if (!parentPlatform || parentPlatform === node.platformId) continue;
        if (RUM_WRAPPER_PLATFORMS.has(parentPlatform)) continue;
        setAttribution(node, parentPlatform, loaderTypeForParent(parentPlatform), 'script-children-map');
        break;
      }
    }
  }

  // After per-platform attribution, ensure any TMS we attributed to but
  // didn't have a node for gets one added — so the rendered tree can
  // draw the parent edge. This happens when, e.g., findTmsInStack
  // returned 'gtm' for a frame URL but no GTM script-load event was
  // captured (a rare but real case for sites that load GTM before our
  // hook attaches).
  for (const node of nodes.values()) {
    if (node.parentPlatformId && !nodes.has(node.parentPlatformId)) {
      // Synthesize a stub TMS node so the parent edge is drawable.
      const stub = ensureNode(node.parentPlatformId);
      stub.firstSeenAt = node.firstSeenAt;
      stub.firstPageHost = node.firstPageHost;
      // The synthesized stub has no captured events to attribute from;
      // mark it page-source via the same source the outer code uses
      // for the explicit-website signal so the Tool detail panel reads
      // sensibly when a user clicks the synthesized node.
      setAttribution(stub, null, 'page-source', 'website-classification');
      stub.requestCount = 0;
      stub.scriptLoadCount = 0;
      stub._synthesized = true;
    }
  }

  // ============================================================
  // Cycle-break post-pass — the only sanity check we run. Catches
  // A→B→A loops formed when call-stack scans pick up cross-platform
  // frames in both directions. Uses temporal evidence within a cycle
  // to pick which edge to drop: the edge where the parent's
  // firstSeenAt is most clearly *after* the child's is the impossible
  // one. After dropping the edge, the node tries to recover a real
  // loaderType by re-scanning its events for a more authoritative
  // signal (initiatorType='website' → page-source; first-party glue
  // chain end → page-source).
  // ============================================================

  // Helper: attempt to recover a loaderType for a newly-orphaned node
  // by scanning all its events for a website-typed initiator or a
  // first-party chain terminus. Falls back to 'unknown' if nothing
  // clearer can be asserted.
  const recoverLoaderType = (node) => {
    for (const evId of node.eventIds) {
      const ev = eventById.get(evId);
      if (!ev) continue;
      const init = getEventInitiator(ev);
      if (init?.type === 'website') return 'page-source';
    }
    // Try a first-party-frame check across all events' call stacks.
    for (const evId of node.eventIds) {
      const ev = eventById.get(evId);
      if (!ev) continue;
      const initiator = ev.raw?.initiator;
      if (!initiator) continue;
      const frames = getInitiatorCallStack(initiator);
      if (!Array.isArray(frames)) continue;
      // Mirror findLoaderInStack's RUM-taint pre-pass (N10, #139): a RUM wrapper
      // (adrum.js etc.) rewrites the call chain, so a first-party frame in a
      // tainted stack is exactly the evidence the engine refuses to trust
      // elsewhere — skip this event rather than return a wrong 'page-source'.
      const tainted = frames.some((url) => {
        if (!url) return false;
        const platform = urlToEvent.get(url)?.platform;
        return platform && RUM_WRAPPER_PLATFORMS.has(platform);
      });
      if (tainted) continue;
      for (const url of frames) {
        if (url && isFirstParty(url)) return 'page-source';
      }
    }
    return 'unknown';
  };

  const cycleBroken = new Set();
  for (const startId of nodes.keys()) {
    if (cycleBroken.has(startId)) continue;
    const path = [];
    const pathSet = new Set();
    let id = startId;
    let safety = 64;
    while (id && nodes.has(id) && safety-- > 0) {
      if (pathSet.has(id)) {
        // Cycle: examine all edges in the cycle, find the one whose
        // parent most clearly postdates the child (largest positive
        // gap between parent.firstSeenAt and child.firstSeenAt).
        // That edge is the most-likely impossible attribution. If no
        // edge has a positive gap (all parents predate their children),
        // fall back to demoting the cycle-closing node's edge.
        const cycleStart = path.indexOf(id);
        const cycle = path.slice(cycleStart);
        let breakNode = null;
        let largestGap = 0;
        for (const cId of cycle) {
          const cNode = nodes.get(cId);
          const pNode = cNode?.parentPlatformId ? nodes.get(cNode.parentPlatformId) : null;
          if (!cNode || !pNode || pNode._synthesized) continue;
          if (!Number.isFinite(pNode.firstSeenAt) || !Number.isFinite(cNode.firstSeenAt)) continue;
          const gap = pNode.firstSeenAt - cNode.firstSeenAt;
          if (gap > largestGap) {
            largestGap = gap;
            breakNode = cNode;
          }
        }
        // Fallback: no clear temporal violation (timestamps tied or
        // missing) — break at the cycle-closing node arbitrarily.
        if (!breakNode) breakNode = nodes.get(id);
        if (breakNode?.parentPlatformId) {
          // Any loader-type that came from a captured-parent attribution
          // (tag-manager / cdp / daisy-chain) is a candidate for
          // recovery — the cycle has falsified one of those edges, so
          // we re-derive a heuristic loader-type from the events.
          if (
            breakNode.loaderType === 'tag-manager'
            || breakNode.loaderType === 'cdp'
            || breakNode.loaderType === 'daisy-chain'
          ) {
            const recovered = recoverLoaderType(breakNode);
            // recoverLoaderType returns 'page-source' or 'unknown'; mark
            // the source as cycle-break-recovery so the user can see
            // *why* their attribution looks demoted ("we found a cycle
            // that couldn't be true and dropped the weakest edge").
            setAttribution(breakNode, null, recovered, 'cycle-break-recovery');
          } else {
            // Already page-source / unknown loaderType — just unparent
            // and downgrade source. Loader stays the same.
            setAttribution(breakNode, null, breakNode.loaderType, 'cycle-break-recovery');
          }
          cycleBroken.add(breakNode.platformId);
        }
        break;
      }
      pathSet.add(id);
      path.push(id);
      id = nodes.get(id).parentPlatformId;
    }
  }

  const root = {
    platformId: '__root__',
    label: rootDomain || '(unknown site)',
    children: [],
    isRoot: true,
  };

  // Detect multi-source platforms — those whose events came from 2+
  // distinct senders (after filtering self-pushes). The dataLayer is
  // the prototypical case: pushed to by OneTrust's SDK (5 events),
  // by the page (1 page_view), by GTM, by vendor SDKs etc. There's no
  // single parent loader for such a platform — it lives on the page
  // and has many writers. We render it once under EACH renderable
  // source (captured platform or page-source) with that source's
  // event count, instead of forcing a single misleading parent edge.
  // The shadow treatment below renders a multi-source node once per
  // source as a LEAF. That's only safe for nodes that are themselves
  // leaves (pure sinks like the dataLayer). A node that *loads* other
  // tools — i.e. is some other node's parentPlatformId — must keep its
  // regular single-parent placement: the placement loop skips
  // _multiSource nodes, so a multi-source loader would never be linked
  // into the tree and its entire subtree (the children pushed into it by
  // the loop below) would be orphaned/unreachable from root. Precompute
  // which platforms are a parent so loaders are excluded from shadowing.
  const isParentOf = new Set();
  for (const node of nodes.values()) {
    if (node.parentPlatformId && nodes.has(node.parentPlatformId)) {
      isParentOf.add(node.parentPlatformId);
    }
  }

  const multiSourceShadows = []; // { node, source, count }
  for (const node of nodes.values()) {
    // Loaders keep single-parent placement so their subtree stays
    // reachable (see isParentOf note above).
    if (isParentOf.has(node.platformId)) continue;
    const sources = Object.keys(node.pushSources || {});
    // Only sources that resolve to a placement: page-source or a
    // captured platform we can attach under. Sources like 'tag-manager'
    // (the bare classification fallback) or platform-ids we don't
    // have nodes for are dropped.
    const renderable = sources.filter((s) => s === 'page-source' || nodes.has(s));
    if (renderable.length < 2) continue;
    for (const source of renderable) {
      multiSourceShadows.push({ node, source, count: node.pushSources[source] });
    }
    node._multiSource = true; // skip the regular single-parent placement below
  }

  // Regular single-parent children-push for non-multi-source nodes.
  for (const node of nodes.values()) {
    if (node._multiSource) continue;
    if (node.parentPlatformId && nodes.has(node.parentPlatformId)) {
      nodes.get(node.parentPlatformId).children.push(node);
    } else {
      root.children.push(node);
    }
  }

  // Place shadow copies of multi-source nodes under each renderable
  // source. Shadows render as leaves and carry the per-source event
  // count, so the user sees "DataLayer ×5" under OneTrust and
  // "DataLayer ×1" at root (page-source).
  for (const { node, source, count } of multiSourceShadows) {
    const shadow = {
      ...node,
      requestCount: count,
      children: [], // shadows are leaves
      _shadowOf: node.platformId,
      _shadowSource: source,
    };
    if (source === 'page-source') {
      root.children.push(shadow);
    } else if (nodes.has(source)) {
      nodes.get(source).children.push(shadow);
    }
  }

  // Sibling order at every level: category priority first (data-layer →
  // consent → tag-manager → outgoing tracking), then chronological for
  // tools sharing the same category. The synthetic root has no category
  // and isn't itself sorted; only its descendants are.
  // `seen` is defense-in-depth (N9, #139): the children tree is acyclic by
  // construction (the cycle-break post-pass above guarantees it), but that
  // invariant is load-bearing across files, so guard the recursion anyway —
  // a future strategy that re-parented a node after the post-pass would
  // otherwise stack-overflow and crash the panel.
  const sortChildren = (n, seen = new Set()) => {
    if (seen.has(n.platformId)) {
      console.warn('[stack-attribution] cycle detected in sortChildren, skipping', n.platformId);
      return;
    }
    seen.add(n.platformId);
    const list = n.children || [];
    list.sort((a, b) => {
      const aCat = _deps?.getPlatformCategory(a.platformId) || '';
      const bCat = _deps?.getPlatformCategory(b.platformId) || '';
      const aPri = CATEGORY_PRIORITY[aCat] ?? 99;
      const bPri = CATEGORY_PRIORITY[bCat] ?? 99;
      if (aPri !== bPri) return aPri - bPri;
      return (a.firstSeenAt || 0) - (b.firstSeenAt || 0);
    });
    list.forEach((c) => sortChildren(c, seen));
  };
  sortChildren(root);

  return { rootDomain, root, nodes };
}
