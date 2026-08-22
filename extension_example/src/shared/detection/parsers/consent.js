// Consent Mode Parsing Utilities
// Decodes Google Consent Mode parameters (gcd, gcs, npa) into human-readable states.
// Used by GA4 and any future platform that sends these parameters.
// Sources:
//   https://www.simoahava.com/analytics/consent-mode-v2-google-tags/
//   https://pietromingotti.com/consent-mode-parameters/

// =============================================================================
// GCD — Google Consent Default
// Compact string like "13l3l3l2l1l1" where letters encode per-signal states.
// Letters are extracted in order and mapped to the four core consent signals.
// =============================================================================

// The four core consent signals, in the order they appear in the gcd value
const GCD_SIGNALS = [
  'ad_storage',
  'analytics_storage',
  'ad_user_data',
  'ad_personalization',
];

// Letter → human-readable state
// Each letter encodes both the configured default and whether an update was applied
const GCD_STATE_LABELS = {
  l: 'Not set',            // Consent Mode not implemented / signal not in use
  p: 'Denied',             // Denied by default, no consent update received
  q: 'Denied',             // Denied by default, denied again after update
  t: 'Granted',            // Granted by default, no consent update received
  r: 'Granted (updated)',  // Denied by default, granted after user interaction
  m: 'Denied',             // No default set, denied after user interaction
  n: 'Granted',            // No default set, granted after user interaction
  u: 'Denied (updated)',   // Granted by default, denied after user interaction
  v: 'Granted',            // Granted by default, granted again after update
};

/**
 * Parse the gcd (Google Consent Default) parameter into per-signal states
 * @param {string} gcd - e.g. "13l3l3l2l1l1"
 * @returns {Object|null} { signal: 'Granted'|'Denied'|'Not set', ... } or null
 */
export function parseGCDConsent(gcd) {
  if (!gcd || typeof gcd !== 'string') return null;

  // All lowercase letters in order are the consent signal states
  const letters = gcd.match(/[a-z]/g);
  if (!letters || letters.length === 0) return null;

  const result = {};
  GCD_SIGNALS.forEach((signal, i) => {
    const letter = letters[i];
    if (letter !== undefined) {
      result[signal] = GCD_STATE_LABELS[letter] ?? letter;
    }
  });

  return result;
}

// =============================================================================
// GCS — Google Consent Status
// Format: G1XY where X = ad_storage (1=granted, 0=denied),
//                      Y = analytics_storage (1=granted, 0=denied)
// Examples: G111 = both granted, G100 = both denied
// =============================================================================

/**
 * Parse the gcs (Google Consent Status) parameter
 * @param {string} gcs - e.g. "G111"
 * @returns {Object|null} { ad_storage: 'Granted'|'Denied', analytics_storage: ... } or null
 */
export function parseGCSConsent(gcs) {
  if (!gcs || typeof gcs !== 'string') return null;
  // Format: G1XY — skip 'G' and '1', read two binary digits
  const match = gcs.match(/^G1(\d)(\d)/);
  if (!match) return null;
  return {
    ad_storage:        match[1] === '1' ? 'Granted' : 'Denied',
    analytics_storage: match[2] === '1' ? 'Granted' : 'Denied',
  };
}

// =============================================================================
// CONSENT SIGNALS — for overview chip display
// Normalizes gcs + gcd into a unified list of { name, label, state } objects.
// state is one of: 'granted' | 'denied' | 'not_set'
// =============================================================================

// Short display labels for each signal (used in the overview chips row)
const SIGNAL_LABELS = {
  ad_storage:            'ads',
  analytics_storage:     'analytics',
  ad_user_data:          'user data',
  ad_personalization:    'personalization',
  functionality_storage: 'functional.',
  personalization_storage: 'personal.',
  security_storage:      'security',
};

// Canonical display order
const SIGNAL_ORDER = [
  'ad_storage',
  'analytics_storage',
  'ad_user_data',
  'ad_personalization',
  'functionality_storage',
  'personalization_storage',
  'security_storage',
];

function normalizeState(label) {
  if (!label) return 'not_set';
  const l = label.toLowerCase();
  if (l.startsWith('granted')) return 'granted';
  if (l.startsWith('denied'))  return 'denied';
  return 'not_set';
}

/**
 * Build a unified consent signals array for overview chip display.
 * gcs (active state) takes priority over gcd (defaults) for the signals it covers.
 * @param {Object} params - Raw request parameters
 * @returns {Array|null} [{ name, label, state }, ...] or null if no consent data
 */
export function buildConsentSignals(params) {
  const gcdStates = parseGCDConsent(params.gcd) || {};
  const gcsStates = parseGCSConsent(params.gcs) || {};

  // gcs overrides gcd for ad_storage and analytics_storage (it's the effective state)
  const merged = { ...gcdStates, ...gcsStates };
  if (Object.keys(merged).length === 0) return null;

  return SIGNAL_ORDER
    .filter(name => name in merged)
    .map(name => ({
      name,
      label: SIGNAL_LABELS[name] || name,
      state: normalizeState(merged[name]),
    }));
}

// =============================================================================
// CONSENT SECTION BUILDER
// Combines gcs, gcd, and npa into a single grouped property-table section.
// Designed for the GA4 detail view but usable by any platform with these params.
// =============================================================================

/**
 * Build the grouped Consent Mode section data from raw request params.
 * Returns a nested object suitable for renderPropertyTable, or null if no data.
 * @param {Object} params - Raw request parameters (must include at least one of: gcs, gcd, npa)
 * @returns {Object|null}
 */
export function buildConsentSection(params) {
  const section = {};

  // Active State — what consent is effectively in force right now (from gcs)
  const gcsStates = parseGCSConsent(params.gcs);
  if (gcsStates) {
    section['Active State'] = gcsStates;
  }

  // Default Config — per-signal configured defaults (from gcd)
  const gcdStates = parseGCDConsent(params.gcd);
  if (gcdStates) {
    section['Default Config'] = gcdStates;
  }

  // Non-Personalized Ads — npa=1 means non-personalized ads are served
  if (params.npa !== undefined && params.npa !== null) {
    section['Ads'] = {
      'Non-Personalized Ads': params.npa === '1' || params.npa === 1 ? 'Yes' : 'No',
    };
  }

  return Object.keys(section).length > 0 ? section : null;
}

// =============================================================================
// CONSENT CHECK — Per-event consent classification
// Maps platform categories to required consent categories, normalizes GCM signals
// to unified categories, parses CMP push data, and classifies each event.
// =============================================================================

/**
 * Platform registry category → required unified consent category mapping.
 * Infrastructure categories (data-layer, tag-manager, consent, first-party-collection)
 * are exempt from consent requirements.
 *
 * This provides the default mapping. Individual platforms can override this via the
 * `consentCategory` field in platform-registry.js (passed as `consentCategoryOverride`
 * to computeConsentCheck).
 *
 * @param {string} platformCategory - Platform registry category (e.g., 'analytics', 'advertising')
 * @returns {string|null} Required consent category or null if exempt
 */
export function getRequiredConsentCategory(platformCategory) {
  switch (platformCategory) {
    case 'analytics':
    case 'session-replay':
    case 'video':
      return 'analytics';
    case 'advertising':
    case 'ad-tech':
    case 'marketing-automation':
      return 'marketing';
    case 'ab-testing':
      return 'functional';
    case 'cdp':
      return 'analytics'; // CDPs touch both analytics + marketing; use analytics as primary
    case 'widgets':
    case 'monitoring':
      return 'functional';
    // First-party collection proxies forward data to analytics backends;
    // the underlying data still requires consent
    case 'first-party-collection':
      return 'analytics';
    // Infrastructure — exempt from consent
    case 'data-layer':
    case 'tag-manager':
    case 'consent':
      return null;
    default:
      return null;
  }
}

/**
 * Normalize Google Consent Mode signals (from consent:default/update dataLayer pushes)
 * to unified consent categories.
 * @param {Object} params - Consent params from dataLayer push (e.g., { analytics_storage: 'denied', ad_storage: 'granted' })
 * @returns {Object} { analytics, marketing, functional } with 'granted'|'denied' values
 */
export function normalizeGCMToCategories(params) {
  if (!params) return null;
  const categories = {};

  // analytics_storage → analytics
  if (params.analytics_storage) {
    categories.analytics = params.analytics_storage;
  }
  // ad_storage → marketing (primary signal for consent checks)
  if (params.ad_storage) {
    categories.marketing = params.ad_storage;
  }
  // functionality_storage → functional
  if (params.functionality_storage) {
    categories.functional = params.functionality_storage;
  }

  // ad_user_data and ad_personalization are secondary marketing signals.
  // They don't drive consent violation checks (ad_storage does), but they're
  // included so the insight table can flag mismatches against CMP state.
  if (params.ad_user_data) {
    categories.ad_user_data = params.ad_user_data;
  }
  if (params.ad_personalization) {
    categories.ad_personalization = params.ad_personalization;
  }

  return Object.keys(categories).length > 0 ? categories : null;
}

/**
 * Extract GCS consent state from an event's raw request parameters.
 * Returns unified consent categories derived from the gcs parameter (per-request ground truth).
 * @param {Object} event - Event object with raw params
 * @returns {Object<string, string>|null} { analytics, marketing } or null if no gcs
 */
export function getGCSConsentState(event) {
  // Try direct properties first
  let gcs = event.raw?.gcs || event.formatted?.params?.gcs;
  // Fall back to parsing from URL query string (formatted.params may be grouped/labelled)
  if (!gcs && event.raw?.url) {
    try {
      const url = new URL(event.raw.url);
      gcs = url.searchParams.get('gcs');
    } catch { /* invalid URL */ }
  }
  if (!gcs) return null;
  const parsed = parseGCSConsent(gcs);
  if (!parsed) return null;
  return {
    analytics: normalizeState(parsed.analytics_storage),
    marketing: normalizeState(parsed.ad_storage),
  };
}

/**
 * Decide which Google Consent Mode (GCM) state to display for an event in the
 * consent insight table, and whether that GCM data is contextual-only.
 *
 * Two display contracts:
 *  - **Google tags** (`ga4`, `sgtm`, `google-ccm`, Google Ads) consume GCM, so the
 *    GCM columns are ALWAYS shown — using the resolved at-event state, else the
 *    per-request GCS-derived state, else an empty object (which renders all "—" to
 *    highlight that the expected GCM signal is missing). For these tags a CMP↔GCM
 *    disagreement is a real implementation mismatch and IS flagged.
 *  - **Non-Google tags** don't read GCM, so a CMP↔GCM disagreement is never a
 *    violation. But when the site uses GCM we still surface its ambient state for
 *    context (so the table reads consistently regardless of vendor). This is marked
 *    `gcmInformational: true` so the caller suppresses mismatch highlighting and can
 *    label the columns as context rather than enforcement.
 *
 * Pure function — all lookups are passed in so it can be unit-tested without the panel.
 *
 * @param {Object}  opts
 * @param {boolean} opts.isGoogleTag       - Whether the event's platform consumes GCM.
 * @param {Object|null} opts.gcmAtEvent    - GCM categories resolved at/before the event (timeline or per-event), or null.
 * @param {Object|null} [opts.gcsState]    - Per-request GCS-derived state (Google tags only), or null.
 * @param {Object|null} [opts.latestSiteGcm] - Most recent GCM state seen this session, any time (non-Google fallback), or null.
 * @returns {{ effectiveGCM: Object|null, gcmInformational: boolean }}
 */
export function resolveGcmForDisplay({ isGoogleTag, gcmAtEvent, gcsState = null, latestSiteGcm = null } = {}) {
  let effectiveGCM = gcmAtEvent || null;

  if (isGoogleTag) {
    // Google tags carry GCM per-request — force the columns even when nothing resolved.
    if (!effectiveGCM) effectiveGCM = gcsState || {};
    return { effectiveGCM, gcmInformational: false };
  }

  // Non-Google: surface ambient site GCM for context when nothing resolved at-event time.
  if (!effectiveGCM && latestSiteGcm) effectiveGCM = latestSiteGcm;
  // Any GCM shown next to a non-Google tag is contextual only.
  return { effectiveGCM, gcmInformational: !!effectiveGCM };
}

/**
 * Parse OneTrust push data (OnetrustActiveGroups) into unified categories.
 * Format: "C0001,C0002" (comma-separated group IDs that are consented)
 * @param {Object} pushData - Event's formatted.pushData
 * @returns {Object|null} Unified categories or null
 */
export function parseOneTrustPushData(pushData) {
  const groups = pushData?.OnetrustActiveGroups;
  if (!groups || typeof groups !== 'string') return null;
  // Only parse standard C-series group IDs — return null for custom IDs (e.g. CNN's dsh/dsl/req)
  if (!groups.includes('C000')) return null;
  const active = groups.split(',').map(g => g.trim()).filter(Boolean);
  const has = id => active.includes(id);
  return {
    analytics: has('C0002') ? 'granted' : 'denied',
    marketing: has('C0004') ? 'granted' : 'denied',
    functional: has('C0003') ? 'granted' : 'denied',
  };
}

/**
 * Parse Cookie Information push data (cookie_cat_* keys) into unified categories.
 * Format: { cookie_cat_marketing: 'accepted', cookie_cat_statistic: 'declined', ... }
 * @param {Object} pushData - Event's formatted.pushData
 * @returns {Object|null} Unified categories or null
 */
export function parseCookieInfoPushData(pushData) {
  if (!pushData) return null;
  const keys = Object.keys(pushData).filter(k => k.startsWith('cookie_cat_'));
  if (keys.length === 0) return null;

  function catState(suffix) {
    const val = pushData[`cookie_cat_${suffix}`];
    return val === 'accepted' ? 'granted' : 'denied';
  }

  return {
    analytics: catState('statistic'),
    marketing: catState('marketing'),
    functional: catState('functional'),
  };
}

/**
 * Parse Usercentrics ucCategory from consent_status dataLayer push.
 * ucCategory keys are category slugs: standard names (marketing, functional)
 * or custom UUIDs (customCategory-xxx). Values are booleans.
 * @param {Object} pushData - The full dataLayer push object
 * @returns {Object|null} Unified categories or null
 */
export function parseUsercentricsData(pushData) {
  const ucCat = pushData?.ucCategory;
  if (!ucCat || typeof ucCat !== 'object') return null;

  // Only include categories we can confidently map — don't default unmapped ones to 'denied'.
  // Custom UUID categories (customCategory-xxx) can't be resolved from push data alone;
  // the window API reader handles those by inferring from service names via getCategoriesBaseInfo().
  // Omitting unmapped categories lets computeConsentCheck() fall through to the window-api
  // source once it's available, avoiding false 'denied' violations.
  const result = {};
  let hasUnmapped = false;

  for (const [key, value] of Object.entries(ucCat)) {
    if (key === 'essential') continue;
    const lower = key.toLowerCase();
    let unified = null;
    // Match standard slug names and common localized labels
    if (lower.includes('marketing') || lower.includes('advertis') || lower.includes('targeting')) unified = 'marketing';
    else if (lower.includes('analytics') || lower.includes('statistic') || lower.includes('measure') || lower.includes('performance')) unified = 'analytics';
    else if (lower.includes('personaliz') || lower.includes('preference') || lower.includes('function') || lower === 'necessary') unified = 'functional';

    if (unified) {
      result[unified] = value === true ? 'granted' : 'denied';
    } else {
      hasUnmapped = true;
    }
  }

  if (Object.keys(result).length === 0) return null;
  if (hasUnmapped) result._hasUnmappedCategories = true;
  return result;
}

/**
 * Parse Didomi purpose consent from the didomi-consent / didomi-ready dataLayer push.
 * Didomi pushes comma-separated purpose-name lists:
 *   didomiPurposesEnabled:  "performance,marketing,necessary,functional,"
 *   didomiPurposesDisabled: "..."
 *   didomiPurposesConsent / didomiPurposesConsentDenied: same shape (fallback)
 * Purpose names are first-party Didomi standard slugs (not site-specific UUIDs),
 * so they map cleanly to the three unified categories by keyword.
 * @param {Object} pushData - The full dataLayer push object
 * @returns {Object|null} Unified categories or null
 */
export function parseDidomiPushData(pushData) {
  if (!pushData || typeof pushData !== 'object') return null;

  // Prefer the Enabled/Disabled pair; fall back to Consent/ConsentDenied.
  const enabledRaw = pushData.didomiPurposesEnabled ?? pushData.didomiPurposesConsent;
  const disabledRaw = pushData.didomiPurposesDisabled ?? pushData.didomiPurposesConsentDenied;
  // Require at least one of the Didomi purpose fields to be a string to claim this push.
  if (typeof enabledRaw !== 'string' && typeof disabledRaw !== 'string') return null;

  const toList = (v) =>
    typeof v === 'string'
      ? v.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
      : [];
  const enabled = new Set(toList(enabledRaw));
  const disabled = new Set(toList(disabledRaw));
  if (enabled.size === 0 && disabled.size === 0) return null;

  // Map a unified category to granted/denied by keyword-matching purpose names.
  // 'necessary' is intentionally ignored — it's the always-on essential bucket.
  function state(keywords) {
    for (const id of enabled) {
      if (keywords.some(k => id.includes(k))) return 'granted';
    }
    for (const id of disabled) {
      if (keywords.some(k => id.includes(k))) return 'denied';
    }
    return undefined;
  }

  const result = {};
  let hasUnmapped = false;
  const a = state(['analytics', 'measure', 'statistic', 'performance']);
  const m = state(['advertis', 'marketing', 'targeting', 'ad_']);
  const f = state(['functional', 'preference', 'personaliz']);
  if (a !== undefined) result.analytics = a; else hasUnmapped = true;
  if (m !== undefined) result.marketing = m; else hasUnmapped = true;
  if (f !== undefined) result.functional = f; else hasUnmapped = true;

  if (Object.keys(result).length === 0) return null;
  if (hasUnmapped) result._hasUnmappedCategories = true;
  return result;
}

/**
 * Look up the consent timeline to find the most recent entry at or before a given timestamp.
 * Uses binary search since the timeline is sorted by timestamp.
 * @param {number} timestamp - Event timestamp
 * @param {Array<import('../../event-shape.js').ConsentTimelineEntry>} timeline - Sorted consent timeline entries
 * @param {Array<string>|null} sources - Optional source filter (e.g., ['cookie', 'window-api'])
 * @returns {import('../../event-shape.js').ConsentTimelineEntry|null} Most recent timeline entry at or before timestamp, or null
 */
export function lookupTimeline(timestamp, timeline, sources = null) {
  if (!timeline || timeline.length === 0) return null;

  if (!sources) {
    // No filter — binary search for the latest entry <= timestamp
    let lo = 0;
    let hi = timeline.length - 1;
    let result = null;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (timeline[mid].timestamp <= timestamp) {
        result = timeline[mid];
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    return result;
  }

  // Filtered — linear scan for latest matching entry <= timestamp
  let result = null;
  for (const entry of timeline) {
    if (entry.timestamp > timestamp) break; // sorted, can stop early
    if (sources.includes(entry.source)) {
      result = entry;
    }
  }
  return result;
}

/**
 * Classify an event's consent status based on timeline and per-request data.
 * Returns a consent check result with status, source, and display info.
 *
 * @param {Object} event - The event object
 * @param {string} platformCategory - The event's platform category (e.g., 'analytics')
 * @param {Array} consentTimeline - The consent timeline
 * @param {number|null} firstConsentTimestamp - Earliest consent signal timestamp
 * @param {string|null} [consentCategoryOverride=null] - Per-platform consent category override
 *   from platform-registry.js `consentCategory` field. When set, takes precedence over the
 *   category-level mapping in getRequiredConsentCategory(). Used for platforms whose consent
 *   requirement differs from their category default (e.g., marketing CDPs need 'marketing'
 *   consent, not the CDP default of 'analytics').
 * @param {boolean} [consumesGCM=false] - Whether the event's platform reads Google Consent
 *   Mode signals (gtag.js / GTM relays them to GA4, Google Ads, Floodlight, etc.). Only
 *   GCM-consuming platforms get the `gcmMismatch` advisory — other vendors (Meta, Snap,
 *   TikTok, LinkedIn, …) have their own pixel-level consent APIs and ignore GCM, so a CMP↔GCM
 *   disagreement is not actionable for their requests.
 * @returns {Object|null} { status, source, category, categoryLabel, cmp, details } or null (no data / exempt)
 *   status: 'granted' | 'denied' | 'pre-consent'
 */
// Source groups for priority-based timeline lookup.
// CMP sources are the real consent authority (what the user consented to).
// Google signals (GCS/GCM) are implementation signals (what Google tags think).
const CMP_FULL_SOURCES = ['cookie', 'window-api', 'cmp-push'];
const CMP_BINARY_SOURCES = ['cmp-lifecycle'];
const GCM_SOURCES = ['google-cm'];

export function computeConsentCheck(event, platformCategory, consentTimeline, firstConsentTimestamp, consentCategoryOverride = null, consumesGCM = false) {
  const requiredCategory = consentCategoryOverride || getRequiredConsentCategory(platformCategory);
  if (!requiredCategory) return { status: 'exempt' };

  const categoryLabels = {
    analytics: 'Analytics',
    marketing: 'Marketing',
    functional: 'Functional',
  };

  // Priority 1: CMP full sources (cookie, window-api, cmp-push) — real consent authority
  const cmpEntry = lookupTimeline(event.timestamp, consentTimeline, CMP_FULL_SOURCES);
  let partialCmpMiss = null; // Track if a partial CMP entry couldn't provide this category
  if (cmpEntry && (cmpEntry.completeness === 'full' || cmpEntry.completeness === 'partial') && cmpEntry.categories) {
    const catState = cmpEntry.categories[requiredCategory];
    if (catState) {
      const result = {
        status: catState,
        source: cmpEntry.source,
        category: requiredCategory,
        categoryLabel: categoryLabels[requiredCategory],
        cmp: cmpEntry.cmp,
        sourceLabel: cmpEntry.sourceLabel,
        categories: cmpEntry.categories,
      };
      // Implementation flag: CMP says granted, but Google Consent Mode at event time
      // disagrees on the same category. Real-world bug pattern when GCM consent:default
      // fires denied before consent:update propagates the CMP's granted state. CMP is
      // still the consent authority — but Google-tag-aware platforms run degraded
      // (cookieless pings) for the duration. Surfaced as a yellow advisory.
      //
      // Scoped to platforms that actually read GCM signals (Google products + SS-GTM):
      // Meta, Snap, TikTok, LinkedIn, etc. each have their own pixel-level consent APIs
      // (`fbq('consent', …)`, `ttq.consent(…)`, etc.) and do not consume GCM, so a
      // CMP↔GCM disagreement is not actionable for their hits.
      if (catState === 'granted' && consumesGCM) {
        const gcmEntryForCompare = lookupTimeline(event.timestamp, consentTimeline, GCM_SOURCES);
        const gcmCatState = gcmEntryForCompare?.categories?.[requiredCategory];
        if (gcmCatState && gcmCatState !== catState) {
          result.gcmMismatch = {
            gcmState: gcmCatState,
            gcmAction: gcmEntryForCompare.action,
          };
        }
      }
      return result;
    }
    // Category is null (CMP doesn't configure this category) or partial entry —
    // fall through to lower-priority sources, but remember the CMP so we can show 'unknown'
    if (cmpEntry.completeness === 'partial' || (requiredCategory in cmpEntry.categories && cmpEntry.categories[requiredCategory] === null)) {
      partialCmpMiss = cmpEntry;
    }
  }

  // Priority 2: CMP binary — fallback CMP signal without category-level data
  // Check cmp-lifecycle sources AND any CMP_FULL source that arrived as binary
  // (e.g., window-api when CMP is detected but user hasn't interacted yet)
  const binaryEntry = lookupTimeline(event.timestamp, consentTimeline, CMP_BINARY_SOURCES)
    || (cmpEntry && cmpEntry.completeness === 'binary' ? cmpEntry : null);
  if (binaryEntry && binaryEntry.completeness === 'binary') {
    const binaryStatus = binaryEntry.action === 'accept' ? 'granted'
      : binaryEntry.action === 'decline' ? 'denied'
      : 'pre-consent';
    return {
      status: binaryStatus,
      source: binaryEntry.source,
      category: requiredCategory,
      categoryLabel: categoryLabels[requiredCategory],
      cmp: binaryEntry.cmp,
    };
  }

  // Priority 3: Per-request GCS (Google tag signal only — not a CMP)
  const gcsState = getGCSConsentState(event);
  if (gcsState && gcsState[requiredCategory]) {
    return {
      status: gcsState[requiredCategory],
      source: 'gcs',
      category: requiredCategory,
      categoryLabel: categoryLabels[requiredCategory],
    };
  }

  // Priority 4: Google CM from dataLayer (consent:default/update — not a CMP).
  //
  // Only authoritative for platforms that actually read Google Consent Mode signals
  // (Google products + SS-GTM, flagged `consumesGCM: true` in platform-registry.js).
  // GCM is defined by and enforced through Google tags — it has no bearing on Matomo,
  // Amplitude, Mixpanel, Adobe Analytics, etc. Treating a site's GCM `analytics_storage:
  // denied` as authoritative for a non-Google analytics tool produced a false-positive
  // consent violation (BUG1: matomo.org leaves analytics_storage denied by design because
  // it runs no GA, yet still fires Matomo after Accept All). For non-GCM platforms we skip
  // this priority and fall through to the pre-consent / unknown handling below.
  const gcmEntry = consumesGCM ? lookupTimeline(event.timestamp, consentTimeline, GCM_SOURCES) : null;
  if (gcmEntry && gcmEntry.completeness === 'full' && gcmEntry.categories) {
    const catState = gcmEntry.categories[requiredCategory];
    if (catState) {
      // consent:default with denied = CMP loaded, user hasn't decided yet = Yellow
      // consent:update with denied = user explicitly denied = Red
      let effectiveStatus = catState;
      if (catState === 'denied' && gcmEntry.action === 'default') {
        effectiveStatus = 'pre-consent';
      }
      return {
        status: effectiveStatus,
        source: gcmEntry.source,
        category: requiredCategory,
        categoryLabel: categoryLabels[requiredCategory],
        cmp: gcmEntry.cmp,
        sourceLabel: gcmEntry.sourceLabel,
        categories: gcmEntry.categories,
      };
    }
  }

  // Priority 5: Pre-consent check — event fired before first consent signal
  if (firstConsentTimestamp !== null && event.timestamp < firstConsentTimestamp) {
    return {
      status: 'pre-consent',
      source: 'timeline',
      category: requiredCategory,
      categoryLabel: categoryLabels[requiredCategory],
    };
  }

  // CMP detected but couldn't map this consent category — show as unknown
  if (partialCmpMiss) {
    return {
      status: 'unknown',
      source: partialCmpMiss.source,
      category: requiredCategory,
      categoryLabel: categoryLabels[requiredCategory],
      cmp: partialCmpMiss.cmp,
      sourceLabel: partialCmpMiss.sourceLabel,
    };
  }

  // No data — suppress (don't show false warnings)
  return null;
}

// =============================================================================
// Consent Violation Severity — heuristic assessment of tracking likelihood
// Distinguishes "definite" violations (clear tracking) from "potential" issues
// (ambiguous requests like static assets or simple GET fetches).
// =============================================================================

const STATIC_ASSET_RE = /\.(js|css|woff2?|ttf|eot|svg|png|jpe?g|gif|webp|ico|map)(\?|$)/i;

export function assessConsentSeverity(event) {
  const raw = event.raw || {};
  const method = (raw.method || 'GET').toUpperCase();
  const type = raw.type || 'unknown';
  const url = raw.url || '';

  // POST/beacon = definite tracking
  if (method !== 'GET' && method !== 'HEAD') return 'definite';
  if (type === 'ping' || type === 'beacon') return 'definite';

  // Tracking pixel
  if (type === 'image') return 'definite';

  // Cookie header = tracking
  const headers = raw._har?.requestHeaders || [];
  if (headers.some(h => h.name.toLowerCase() === 'cookie' && h.value?.length > 0)) {
    return 'definite';
  }

  // Rich parsed data = tracking
  if (event.formatted?.params && Object.keys(event.formatted.params).length > 3) {
    return 'definite';
  }

  // Static asset URL = potential
  if (STATIC_ASSET_RE.test(url)) return 'potential';

  // GET XHR/fetch with few params = potential
  if (method === 'GET' && (type === 'xhr' || type === 'fetch')) {
    try {
      if (new URL(url).searchParams.size <= 2) return 'potential';
    } catch { /* ignore */ }
  }

  return 'definite';
}

/**
 * Detect whether a denied consent check represents Google Advanced Consent Mode.
 * ACM fires cookieless pings when consent is denied — the tag acknowledges the
 * denial via GCS but sends a limited measurement ping anyway (no cookies, no
 * persistent identifiers).
 *
 * Detection: consent status is 'denied', the event carries a GCS parameter, and
 * GCS confirms the SAME category is denied. If GCS says 'granted' but CMP says
 * 'denied', that's a genuine mismatch — not ACM.
 *
 * @param {Object} check - Consent check result from computeConsentCheck()
 * @param {Object} event - The event object (needs raw params with gcs)
 * @returns {boolean} true if this is an Advanced Consent Mode cookieless ping
 */
export function isAdvancedConsentMode(check, event) {
  if (!check || check.status !== 'denied' || !check.category) return false;
  const gcsState = getGCSConsentState(event);
  if (!gcsState) return false;
  // ACM: GCS confirms the denial for the same category the CMP flagged.
  // If GCS says 'granted' but CMP says 'denied', that's a real mismatch — not ACM.
  return gcsState[check.category] === 'denied';
}

// =============================================================================
// CMP Category Name Mapping — static lookup for consent insight table
// Maps CMP name → { unifiedCategory: 'cmp-specific name' }.
// Keyword-match CMPs (Didomi, Axeptio) are omitted because their category
// names are site-configurable. (Ethyca Fides and Ketch were added later —
// their default purpose keys are stable enough to map.)
// =============================================================================

const CMP_CATEGORY_NAMES = {
  'Cookiebot':            { analytics: 'statistics', marketing: 'marketing', functional: 'preferences' },
  'OneTrust':             { analytics: 'C0002 (Performance)', marketing: 'C0004 (Targeting)', functional: 'C0003 (Functional)' },
  'Cookie Information':   { analytics: 'cookie_cat_statistic', marketing: 'cookie_cat_marketing', functional: 'cookie_cat_functional' },
  'CookieYes':            { analytics: 'analytics', marketing: 'advertisement', functional: 'functional' },
  'CookieHub':            { analytics: 'analytics', marketing: 'marketing', functional: 'preferences' },
  'Complianz':            { analytics: 'statistics', marketing: 'marketing', functional: 'preferences' },
  'Consentmo':            { analytics: 'analytics', marketing: 'marketing', functional: 'functionality' },
  'CookieScript':         { analytics: 'performance', marketing: 'targeting', functional: 'functionality' },
  'CookieFirst':          { analytics: 'performance', marketing: 'advertising', functional: 'functional' },
  'Osano':                { analytics: 'ANALYTICS', marketing: 'MARKETING', functional: 'PERSONALIZATION' },
  'iubenda':              { analytics: 'Purpose 4', marketing: 'Purpose 5', functional: 'Purpose 2' },
  'Borlabs Cookie':       { analytics: 'statistics', marketing: 'marketing', functional: 'external-media' },
  'Piwik Pro Consent':    { analytics: 'analytics', marketing: 'remarketing', functional: 'analytics' },
  'TrustArc':             { analytics: 'Category 2', marketing: 'Category 3', functional: 'Category 2' },
  'IAB TCF':              { analytics: 'Purposes 7,8', marketing: 'Purposes 2-6', functional: 'Purpose 1' },
  'Google Consent Mode':  { analytics: 'analytics_storage', marketing: 'ad_storage', functional: 'functionality_storage' },
  'Pandectes':            { analytics: 'C0002 (Performance)', marketing: 'C0003 (Targeting)', functional: 'C0001 (Functionality)' },
  'Ethyca Fides':         { analytics: 'analytics', marketing: 'advertising', functional: 'functional' },
  'Ketch':                { analytics: 'analytics', marketing: 'behavioral_advertising', functional: 'personalization' },
  'Termly':               { analytics: 'analytics', marketing: 'advertising', functional: 'essential' },
  'Transcend':            { analytics: 'Analytics', marketing: 'Advertising', functional: 'Functional' },
  'Moove GDPR':           { analytics: 'thirdparty', marketing: 'advanced', functional: 'preference' },
  'WPLP Cookie Consent':  { analytics: 'analytics', marketing: 'marketing', functional: 'preferences' },
  'WebToffee GDPR':       { analytics: 'analytics', marketing: 'advertisement', functional: 'functional' },
  'Digital Control Room': { analytics: 'Level 3 (Analytics)', marketing: 'Level 4 (Advertising)', functional: 'Level 2 (Functionality)' },
};

/**
 * Look up the CMP-specific category name for a unified consent category.
 * @param {string} cmpName - CMP name (e.g., 'OneTrust', 'Cookiebot')
 * @param {string} unifiedCategory - One of: 'analytics', 'marketing', 'functional'
 * @returns {string|null} CMP-specific name or null if unknown CMP
 */
export function getCMPCategoryName(cmpName, unifiedCategory) {
  const mapping = CMP_CATEGORY_NAMES[cmpName];
  if (!mapping) return null;
  return mapping[unifiedCategory] || null;
}

/**
 * Mapping from unified consent category to the Google Consent Mode signal name.
 */
export const GCM_SIGNAL_NAMES = {
  analytics: 'analytics_storage',
  marketing: 'ad_storage',
  functional: 'functionality_storage',
};

/**
 * Consent detection coverage per CMP.
 * Documents which detection methods Event Watcher supports for each CMP.
 * - cookie: Consent cookie parser (consent-cookies.js)
 * - windowApi: Window API reader (event-watcher-page.js CMP_READERS)
 * - pushDetection: DataLayer push event detection (service-worker.js detectConsentEvent)
 * - categoryMapping: CMP category name mapping (CMP_CATEGORY_NAMES above)
 */
export const CMP_DETECTION_COVERAGE = {
  'Cookiebot':            { cookie: true, windowApi: true, pushDetection: true, categoryMapping: true },
  'OneTrust':             { cookie: true, windowApi: true, pushDetection: true, categoryMapping: true },
  'Cookie Information':   { cookie: true, windowApi: true, pushDetection: true, categoryMapping: true },
  'CookieYes':            { cookie: true, windowApi: true, pushDetection: true, categoryMapping: true },
  'CookieHub':            { cookie: true, windowApi: false, pushDetection: true, categoryMapping: true },
  'Digital Control Room':  { cookie: true, windowApi: false, pushDetection: true, categoryMapping: true },
  'Didomi':               { cookie: true, windowApi: true, pushDetection: true, categoryMapping: false },
  'Osano':                { cookie: true, windowApi: true, pushDetection: true, categoryMapping: true },
  'Termly':               { cookie: true, windowApi: true, pushDetection: true, categoryMapping: true },
  'Transcend':            { cookie: true, windowApi: true, pushDetection: true, categoryMapping: true },
  'iubenda':              { cookie: true, windowApi: true, pushDetection: true, categoryMapping: true },
  'CookieScript':         { cookie: true, windowApi: true, pushDetection: true, categoryMapping: true },
  'CookieFirst':          { cookie: true, windowApi: true, pushDetection: true, categoryMapping: true },
  'Complianz':            { cookie: true, windowApi: true, pushDetection: true, categoryMapping: true },
  'Consentmo':            { cookie: true, windowApi: false, pushDetection: true, categoryMapping: true },
  'TrustArc':             { cookie: true, windowApi: true, pushDetection: true, categoryMapping: true },
  'Borlabs Cookie':       { cookie: true, windowApi: true, pushDetection: true, categoryMapping: true },
  'Usercentrics':         { cookie: false, windowApi: true, pushDetection: true, categoryMapping: false },
  'Ethyca Fides':         { cookie: true, windowApi: true, pushDetection: true, categoryMapping: true },
  'Ketch':                { cookie: true, windowApi: true, pushDetection: true, categoryMapping: true },
  'Axeptio':              { cookie: true, windowApi: true, pushDetection: true, categoryMapping: false },
  'Piwik Pro Consent':    { cookie: true, windowApi: true, pushDetection: true, categoryMapping: true },
  'Secure Privacy':       { cookie: true, windowApi: true, pushDetection: true, categoryMapping: false },
  'Evidon':               { cookie: true, windowApi: true, pushDetection: true, categoryMapping: false },
  'Tarteaucitron':        { cookie: true, windowApi: true, pushDetection: true, categoryMapping: false },
  'Klaro':                { cookie: true, windowApi: true, pushDetection: false, categoryMapping: false },
  'Real Cookie Banner':   { cookie: false, windowApi: true, pushDetection: false, categoryMapping: false },
  'IAB TCF':              { cookie: true, windowApi: true, pushDetection: false, categoryMapping: true },
  'Pandectes':            { cookie: true, windowApi: false, pushDetection: true, categoryMapping: true },
  'Commanders Act CMP':   { cookie: true, windowApi: false, pushDetection: true, categoryMapping: false },
  'Civic Cookie Control': { cookie: true, windowApi: false, pushDetection: false, categoryMapping: false },
  'Moove GDPR':           { cookie: true, windowApi: false, pushDetection: false, categoryMapping: true },
  'Cookie Notice':        { cookie: true, windowApi: false, pushDetection: false, categoryMapping: false },
  'WPLP Cookie Consent':  { cookie: true, windowApi: false, pushDetection: false, categoryMapping: true },
  'WebToffee GDPR':       { cookie: true, windowApi: false, pushDetection: false, categoryMapping: true },
  'CCM19':                { cookie: true, windowApi: false, pushDetection: true, categoryMapping: false },
  'consentmanager':       { cookie: false, windowApi: false, pushDetection: true, categoryMapping: false },
  'Sourcepoint':          { cookie: false, windowApi: false, pushDetection: true, categoryMapping: false },
  'InMobi CMP':           { cookie: false, windowApi: false, pushDetection: true, categoryMapping: false },
  'Securiti':             { cookie: false, windowApi: false, pushDetection: true, categoryMapping: false },
  'Enzuzo':               { cookie: false, windowApi: false, pushDetection: true, categoryMapping: false },
  'Google Consent Mode':  { cookie: false, windowApi: false, pushDetection: true, categoryMapping: true },
  'Admiral CMP':          { cookie: false, windowApi: false, pushDetection: false, categoryMapping: false },
  'Quantcast Choice':     { cookie: false, windowApi: false, pushDetection: false, categoryMapping: false },
  'Sirdata CMP':          { cookie: false, windowApi: false, pushDetection: false, categoryMapping: false },
  'UniConsent':           { cookie: false, windowApi: false, pushDetection: false, categoryMapping: false },
};
