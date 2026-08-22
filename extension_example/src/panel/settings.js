// ============================================================
// Settings Module — extracted from panel.js (Phase 4a)
// Handles settings persistence, defaults, preferences, and
// all settings modal UI (button groups, checkboxes, dataLayer).
// ============================================================

import { setExportToFile, setExportWarningTarget } from './copy-export.js';
import { getThemePreference, setThemePreference, getResolvedTheme } from './theme.js';
import { registerModalCloser, closeOtherModals } from './components/modal-utils.js';
import { FEATURE_FLAGS } from './feature-flags.js';
import { loadNudgeState, patchNudgeState } from '../shared/nudge-state.js';
import { GROUPINGS, getDefaultPinnedGroupings, getGroupedViewState, PINNED_GROUPINGS_VERSION } from './components/groupings.js';

/**
 * Derive Amplitude user_properties from the stored `ai_config` object.
 * Single source of truth so the init seed and on-change paths
 * (ai-provider-panel.js) always set the same shape. Pass `null` /
 * `undefined` to represent "no config stored" — yields a configured=false
 * baseline that shows up in Amplitude for users who never set up BYOK.
 */
export function buildAiUserProperties(aiConfig) {
  const providers = aiConfig?.providers || {};
  const providerIds = Object.keys(providers).filter((id) => !!providers[id]?.apiKey);
  const active = aiConfig?.activeProvider || null;
  const activeHasKey = !!(active && providers[active]?.apiKey);
  const autoActions = aiConfig?.autoActions || {};
  return {
    setting_ai_provider_configured: activeHasKey,
    setting_ai_active_provider: activeHasKey ? active : null,
    setting_ai_providers_count: providerIds.length,
    setting_ai_auto_identify_unknown: !!autoActions.identifyUnknown,
  };
}

// Re-exported for modules that already import FEATURE_FLAGS from settings.js.
// New consumers should import directly from './feature-flags.js' to avoid the
// DOM-dependent import chain (panel.js side effects).
export { FEATURE_FLAGS };

let _deps;

// ----------------------------------------------------------------------
// Module-local cached settings snapshot — for synchronous read access
// from render paths that can't `await loadSettings()` mid-render.
//
// Updated by:
//   - loadSettings() — on every load
//   - saveSettings() — on every save
//   - updateSetting() — on individual setting updates
//
// Read by:
//   - getCachedSettings() — synchronous getter exported below
//
// Until the first loadSettings() resolves, the cache holds
// DEFAULT_SETTINGS so synchronous readers get the shipped defaults
// rather than `undefined`. Feature #113 introduced this pattern to
// let renderEventDetail() read eventDetailSectionOrder /
// eventDetailSectionDefaults without plumbing them through every
// caller's options object.
// ----------------------------------------------------------------------
let _cachedSettings = null;

/**
 * Synchronous getter for the latest known settings snapshot. Returns
 * DEFAULT_SETTINGS until the first loadSettings() resolves. Always
 * returns a non-null object so callers can `.lookAndFeel?.x` without
 * a null check.
 *
 * Do NOT mutate the returned object — it's the live cache. Use
 * updateSetting() / saveSettings() to change settings.
 *
 * @returns {Object}
 */
export function getCachedSettings() {
  return _cachedSettings || DEFAULT_SETTINGS;
}

/**
 * Persist the user's event-detail section order (feature #113). Writes
 * to settings.lookAndFeel.eventDetailSectionOrder and keeps the cache
 * in lockstep. Pass an empty array to clear the user's customization.
 *
 * @param {Array<string>} order — array of stable section ids in the
 *   user's preferred order, OR `[]` to reset to shipped defaults.
 * @returns {Promise<void>}
 */
export async function persistEventDetailSectionOrder(order) {
  const settings = await loadSettings();
  if (!settings.lookAndFeel) settings.lookAndFeel = {};
  settings.lookAndFeel.eventDetailSectionOrder = Array.isArray(order) ? order : [];
  await saveSettings(settings);
}

/**
 * Reset the section order back to shipped default (feature #113).
 *
 * @returns {Promise<void>}
 */
export async function resetEventDetailSectionLayout() {
  const settings = await loadSettings();
  if (!settings.lookAndFeel) settings.lookAndFeel = {};
  settings.lookAndFeel.eventDetailSectionOrder = [];
  await saveSettings(settings);
}

/**
 * Initialize the settings module with dependencies from panel.js.
 * Must be called after state and elements are defined but before
 * any user interaction or settings load.
 */
export function initSettings(deps) {
  _deps = deps;
  setupSettingsListeners();
  initSettingsButtonGroups();
  registerModalCloser('settings-panel', closeSettingsModal);
}

// ----------------------------------------
// Constants
// ----------------------------------------

// Install defaults - the values used when extension is first installed
// These are the "fixed" defaults shown in settings when user picks a specific option
export const INSTALL_DEFAULTS = {
  viewMode: 'stream',
  // Active grouping pivot inside Grouped view (Feature #60).
  activeGrouping: 'tool',
  // Pinned grouping pivots shown as chips in the Grouped zone of the toolbar.
  // Sourced from the registry (`defaultPinned: true`) so the chip-row, the
  // picker, and the persisted defaults can never drift out of sync.
  pinnedGroupings: getDefaultPinnedGroupings(),
  // Bumped when the default-pinned set changes; loadSettings() merges new
  // defaults into existing users' arrays without overwriting customisation.
  pinnedGroupingsVersion: PINNED_GROUPINGS_VERSION,
  // Append-only set of grouping ids the user has ever activated by clicking
  // a chip or picking from the `+` picker. Backs the `grouped_view_<id>`
  // Amplitude user properties — empty at install means every grouping starts
  // as 'never_used', including the default-pinned tool/page until clicked.
  activatedGroupings: [],
  streamDirection: 'newest-top',
  sortMode: 'start',
  scripts: 'auto',
  consent: 'auto',
  interactions: true,
  nesting: false,
  filterToolbarCollapsed: false,
  categoriesCollapsed: false
};

export const DEFAULT_SETTINGS = {
  // Nested events toggle (show events grouped under their trigger)
  nested: true,

  // Default preferences - what to use when panel opens
  // Value can be 'lastused' (remember last session) or a specific value
  // If 'lastused', we look up the value from lastUsed storage
  defaultPreferences: {
    viewMode: 'lastused',            // 'lastused' | 'stream' | 'grouped' | 'tree'
    streamDirection: 'lastused',    // 'lastused' | 'newest-top' | 'newest-bottom'
    sortMode: 'lastused',           // 'lastused' | 'start' | 'finish' | 'index'
    scripts: 'lastused',            // 'lastused' | 'auto' | 'only' | 'hide'
    consent: 'lastused',            // 'lastused' | 'auto' | 'only' | 'hide' | 'off'
    interactions: 'lastused',       // 'lastused' | 'show' | 'hide'
    nesting: 'lastused',            // 'lastused' | 'on' | 'off'
    filterToolbarCollapsed: 'lastused',  // 'lastused' | 'full' | 'collapsed'
    categoriesCollapsed: 'lastused'      // 'lastused' | 'expanded' | 'collapsed'
  },

  // Last used values - stored when user changes settings during a session
  // Used when defaultPreferences[key] === 'lastused'
  lastUsed: {
    viewMode: 'stream',
    activeGrouping: 'tool',
    pinnedGroupings: getDefaultPinnedGroupings(),
    activatedGroupings: [],
    streamDirection: 'newest-top',
    sortMode: 'start',
    scripts: 'auto',
    consent: 'auto',
    interactions: true,
    nesting: false,
    filterToolbarCollapsed: false,
    categoriesCollapsed: false
  },

  // Active grouping pivot inside Grouped view (Feature #60).
  activeGrouping: 'tool',
  // Pinned grouping pivots shown as chips in the Grouped zone of the toolbar.
  // Order matters — chips render in this order. New auto-pins go to the end.
  // Sourced from the registry so the chip-row, the picker, and the persisted
  // defaults stay in lockstep.
  pinnedGroupings: getDefaultPinnedGroupings(),
  // Counter that bumps each release the default-pinned set changes. Lets
  // loadSettings() merge new defaults into existing users' arrays without
  // overwriting their customisation.
  pinnedGroupingsVersion: PINNED_GROUPINGS_VERSION,

  // Legacy: Default filter states (kept for backwards compatibility migration)
  defaultFilters: {
    scripts: 'auto',
    consent: 'auto',
    nesting: true
  },

  // Legacy: UI layout defaults (kept for backwards compatibility migration)
  filterToolbarCollapsed: false,
  categoriesCollapsed: false,

  sortMode: 'start',

  // Highlighted platforms (for visual emphasis in event stream)
  highlightedPlatforms: [],

  // Export: Save as file instead of clipboard
  exportToFile: false,

  // Export: AI tool target — controls the large-export warning threshold.
  // Values: 'strict' (25K) | 'standard' (50K, default) | 'relaxed' (80K)
  //       | 'generous' (150K) | 'off' (no warning).
  // Subsumes the legacy `exportWarning` boolean (false → 'off', true → 'standard').
  exportWarningTarget: 'standard',

  // Performance logging
  perfLogging: false,

  // Data layer detection settings (which data layers to intercept)
  dataLayer: {
    'datalayer': true,           // dataLayer
    'adobe-datalayer': true,     // Adobe Data Layer
    'tealium-datalayer': true,   // Tealium utag_data
    'w3c-datalayer': false,      // W3C digitalData
    'commandersact-datalayer': false, // Commanders Act tc_vars
    'relay42-datalayer': false,  // Relay42 defined42
    'piwik-datalayer': false,    // Piwik PRO Data Layer
    'ensighten-datalayer': false // Ensighten Data Layer
  },

  // Hide developer_id events by default (low-value set commands from CMPs/vendors)
  hideDeveloperIdEvents: true,

  // Pinned-view onboarding hint bar — shown above the current domain to
  // teach drag-and-drop and Shift/Ctrl multi-select. Flipped to true when
  // the user dismisses the bar via its X button; stays true thereafter.
  pinnedHintsDismissed: false,

  // Crowdsourced Unknown Tool Registry (feature #47). When ON, the extension
  // includes a `tools_unknown` array of unrecognised tracker hostnames on its
  // page-load analytics events so maintainers can grow the platform registry.
  // Hostnames sharing a root domain with the visited site are dropped before
  // sending. Default ON; users can disable from Settings → Privacy. The global
  // analytics opt-out (`analytics_enabled`) still wins.
  shareUnknownEndpointHostnames: true,

  // Show AI features (BYOK panel button + AI Summary section in event detail).
  // User-controlled visibility, distinct from FEATURE_FLAGS — for users who
  // don't want AI features at all, not for in-development gating.
  showAIFeatures: true,

  // PII redaction on AI prompts. Default ON (defense in depth — even though
  // the parsed payload doesn't usually contain emails/cards/tokens, regex
  // sweeps catch anything that slipped in via custom event params). Power
  // users debugging AI responses can flip this off to send raw values.
  aiRedactPii: true,

  // Show GTM Hub (toolbar button, modal, intercept banner, overview intercept
  // badges). When off, active DNR rules keep functioning so the panel stays
  // accurate — only the UI disappears.
  showGTMHub: true,

  // Show Script Tree view mode (4th standalone view toggle + info banner).
  // When off, and the current view is 'tree', the panel falls back to 'stream'.
  showScriptTree: true,

  // Show Cookie detection (event-row cookie badge + "Cookie Set" detail section).
  showCookieDetection: true,

  // Show Consent Check (toolbar filter chip, consent violation/status badges
  // on events, consent state markers in the stream, consent pill on overview
  // card, unified Consent section in event details).
  showConsentCheck: true,

  // Sub-feature of Show Consent Check: warn (yellow shield + counter +
  // section-header chip) when the CMP says a category is granted but Google
  // Consent Mode disagrees on the same category at event time. Off keeps the
  // event green and suppresses the counter bump; the detail-view CMP-vs-GCM
  // comparison table still shows the disagreement. Default ON.
  showConsentModeMismatchWarning: true,

  // Show review prompt — engagement-gated NPS-style ask. After 50 lifetime
  // page loads (and again at 250 if the user picked "Maybe later") show a
  // bubble asking whether they're enjoying the extension; happy users get a
  // CWS review CTA, unhappy users get the Report modal. Off hides the
  // prompt entirely. Default ON. Trigger logic lives in
  // components/review-prompt.js — this flag is read at trigger time, no
  // body class needed.
  showReviewPrompt: true,

  // Look & Feel — visual presentation toggles (feature #72 Phase 2+).
  // Lives nested under settings.lookAndFeel per the storage-keys rule.
  lookAndFeel: {
    // Tool count chip style on filter-toolbar tool chips (feature #73).
    //   'severity' (default, new in v1.3.0) — neutral grey count badge +
    //              red/yellow warning pill when the tool has consent
    //              violations or warnings.
    //   'brand'    (legacy v1.2.0)         — count badge in the platform's
    //              brand colour (Adobe red, Snapchat yellow, …); no
    //              warning pill.
    // Body-class driven (`body.tool-count-style-brand` when 'brand'),
    // applied without a re-render via panel.css overrides + JS guard in
    // filter-bar.js.
    toolCountStyle: 'severity',

    // Display density (feature #72 Phase 2, v1.3.0).
    //   'comfortable' (default) — current spacing.
    //   'compact'              — reduced padding/gap on the high-impact
    //                            surfaces (toolbar, event list rows,
    //                            detail cards and sections). Font-size
    //                            and line-height are never changed —
    //                            browser zoom (Ctrl/Cmd +/-) handles
    //                            type scaling. Body-class driven
    //                            (`body.density-compact` when 'compact'),
    //                            applied via CSS overrides only — no
    //                            re-render needed when toggled.
    density: 'comfortable',

    // Event detail section order (feature #113, v1.3.0).
    // SPARSE array of stable section ids in the user's preferred order.
    // Only ids the user has actually moved appear here; unmentioned
    // sections fall into the gaps in the shipped order (see
    // section-order.js → applyUserOrder). Empty array = use shipped
    // order as-is. Resetting clears this back to []. Stable section
    // ids: see SHIPPED_DEFAULT_ORDER in section-order.js.
    //
    // Note: per-section default-expanded state is NOT user-overridable
    // via this feature. Each section keeps its shipped default; the
    // user can still toggle individual sections by clicking the header
    // (persisted in-session by detail-section-state.js, as before #113).
    eventDetailSectionOrder: []
  },

  // Correlation time windows (ms) for dataLayer-to-tracking-event matching
  correlation: {
    standardWindowMs: 2000,
    matchingNameWindowMs: 10000
  },

  // Filter presets - saved tool visibility configurations
  // Each preset: { id: string, name: string, visibleTools: string[] }
  presets: [],

  // Onboarding: one-shot owl wiggle on first panel open (Phase 0)
  onboardingOwlShown: false,

  // Onboarding: completed tour version. 0 = never completed. Compared against TOUR_VERSION
  // in onboarding-tour.js so updated tours re-show once to returning users.
  onboardingCompletedVersion: 0,

  // Onboarding: completed version of the optional extended tour (shown after the
  // basic tour + ≥ 10 panel opens, or via the owl step's "Continue on extended tour").
  onboardingExtendedCompletedVersion: 0,

  // Onboarding: counts panel opens so we can auto-trigger the extended tour
  // once the user has lived with the basics for a while.
  onboardingPanelOpenCount: 0,

  // First-time acknowledgement flag for the *Save as MartechStack Builder JSON*
  // export — the modal explains what the format is for and links to the tool;
  // user can tick "Don't show this again" inside it to dismiss for future
  // saves. Inline ℹ️ icon on the menu row always opens the modal regardless.
  martechStackInfoSeen: false,
};

// ----------------------------------------
// Settings Persistence (no deps needed)
// ----------------------------------------

/**
 * Get the effective value for a setting based on user's preference
 * If preference is 'lastused', returns the lastUsed value
 * Otherwise returns the fixed preference value
 */
export function getEffectiveDefault(settings, key) {
  const pref = settings.defaultPreferences?.[key];

  if (pref === 'lastused' || pref === undefined) {
    // Use last used value, falling back to install default
    return settings.lastUsed?.[key] ?? INSTALL_DEFAULTS[key];
  }

  // User selected a specific default - convert button value to actual value
  if (key === 'interactions') {
    return pref === 'show';
  }
  if (key === 'nesting') {
    return pref === 'on';
  }
  if (key === 'filterToolbarCollapsed') {
    return pref === 'collapsed';
  }
  if (key === 'categoriesCollapsed') {
    return pref === 'collapsed';
  }

  return pref;
}

/**
 * Save a "last used" value when user changes a setting during session
 */
export async function saveLastUsed(key, value) {
  const settings = await loadSettings();
  if (!settings.lastUsed) {
    settings.lastUsed = { ...DEFAULT_SETTINGS.lastUsed };
  }
  settings.lastUsed[key] = value;
  await saveSettings(settings);
}

/**
 * Load all settings from chrome.storage.local
 * Returns merged settings with defaults for any missing keys
 * Also migrates old 'dataLayerSettings' format to new unified 'settings' format
 */
export async function loadSettings() {
  try {
    const result = await chrome.storage.local.get([
      'settings',
      'dataLayerSettings',
      '_storage_schema_version',
    ]);

    // Schema version fence — purely additive. v1.1.0 introduces a
    // snake_case naming scheme for net-new keys (ai_config,
    // ai_chat_history, feature_flags, nudge_devtools_state, …) and
    // stamps schema version 2 so a future storage cleanup PR can
    // gate its lazy migrations on this value. Older code that
    // doesn't know about the key is unaffected.
    if (result._storage_schema_version == null) {
      try { await chrome.storage.local.set({ _storage_schema_version: 2 }); } catch (_) { /* best-effort */ }
    }

    // Start with defaults
    let settings = { ...DEFAULT_SETTINGS };

    // If new unified settings exist, merge them
    if (result.settings) {
      settings = {
        ...DEFAULT_SETTINGS,
        ...result.settings,
        dataLayer: { ...DEFAULT_SETTINGS.dataLayer, ...result.settings.dataLayer },
        defaultFilters: { ...DEFAULT_SETTINGS.defaultFilters, ...result.settings.defaultFilters },
        correlation: { ...DEFAULT_SETTINGS.correlation, ...result.settings.correlation },
        // Deep-merge lookAndFeel so existing users hydrate net-new fields
        // (e.g. feature #113's eventDetailSectionOrder / SectionDefaults
        // added in v1.3.0) without losing their existing toolCountStyle /
        // density choices.
        lookAndFeel: { ...DEFAULT_SETTINGS.lookAndFeel, ...result.settings.lookAndFeel }
      };
    }
    // Migrate old dataLayerSettings format if it exists and no new settings
    else if (result.dataLayerSettings) {
      settings.dataLayer = { ...DEFAULT_SETTINGS.dataLayer, ...result.dataLayerSettings };
      // Save in new format and remove old key. Guard the write (#138 F4):
      // a rejected set() must NOT propagate out of loadSettings() and must NOT
      // reach the remove() — leaving the old key in place lets the migration
      // retry on the next load rather than losing the user's preference. The
      // two awaits are already sequential, so "set fails, remove succeeds" is
      // impossible; the try/catch only adds the logging + non-throwing guard.
      try {
        await chrome.storage.local.set({ settings });
        await chrome.storage.local.remove('dataLayerSettings');
      } catch (e) {
        console.warn('[EventWatcher] dataLayerSettings migration deferred (storage write failed):', e);
      }
    }

    // ----------------------------------------------------------------------
    // Feature #60 — Grouped view migration
    // ----------------------------------------------------------------------
    // v1.0.x / v1.1.x stored viewMode as 'tools' | 'pages'. v1.2.0 collapses
    // both into viewMode='grouped' with activeGrouping carrying the dimension.
    // Lazy-read pattern: rewrite on first load, persist, then continue with
    // the new shape. Existing users keep their last-used view as the active
    // chip in the new chip-row.
    let migrated = false;
    const migrateViewModeValue = (value) => {
      if (value === 'tools') return { viewMode: 'grouped', activeGrouping: 'tool' };
      if (value === 'pages') return { viewMode: 'grouped', activeGrouping: 'page' };
      return null;
    };

    if (settings.lastUsed) {
      const m = migrateViewModeValue(settings.lastUsed.viewMode);
      if (m) {
        settings.lastUsed.viewMode = m.viewMode;
        settings.lastUsed.activeGrouping = m.activeGrouping;
        if (settings.activeGrouping == null) settings.activeGrouping = m.activeGrouping;
        migrated = true;
      }
      if (!Array.isArray(settings.lastUsed.pinnedGroupings)) {
        settings.lastUsed.pinnedGroupings = getDefaultPinnedGroupings();
        migrated = true;
      }
    }
    if (settings.defaultPreferences) {
      const m = migrateViewModeValue(settings.defaultPreferences.viewMode);
      if (m) {
        settings.defaultPreferences.viewMode = m.viewMode;
        if (settings.activeGrouping == null) settings.activeGrouping = m.activeGrouping;
        migrated = true;
      }
    }

    // Default-pinned set evolution. When the version counter bumps, reset
    // both the top-level array and the lastUsed snapshot to the current
    // default set. v1.2.0 is dev-only (no CWS shipment yet) so we don't try
    // to preserve user customisation across the bump — when the registry
    // changes, users get the new default; they can re-pin from the picker.
    if (!Array.isArray(settings.pinnedGroupings)) {
      settings.pinnedGroupings = getDefaultPinnedGroupings();
      migrated = true;
    } else {
      const storedVersion = Number(settings.pinnedGroupingsVersion) || 0;
      const currentVersion = DEFAULT_SETTINGS.pinnedGroupingsVersion;
      if (storedVersion < currentVersion) {
        settings.pinnedGroupings = getDefaultPinnedGroupings();
        if (settings.lastUsed) {
          settings.lastUsed.pinnedGroupings = getDefaultPinnedGroupings();
        }
        settings.pinnedGroupingsVersion = currentVersion;
        migrated = true;
      }
    }

    if (migrated) {
      try { await chrome.storage.local.set({ settings }); } catch (_) { /* best-effort */ }
    }

    // Update the synchronous cache so renderEventDetail() and other
    // sync readers see the latest values (feature #113).
    _cachedSettings = settings;
    return settings;
  } catch (e) {
    // Failed to load settings, using defaults
    const fallback = { ...DEFAULT_SETTINGS };
    _cachedSettings = fallback;
    return fallback;
  }
}

/**
 * Save all settings to chrome.storage.local
 */
export async function saveSettings(settings) {
  try {
    await chrome.storage.local.set({ settings });
    // Keep the synchronous cache in lockstep with persisted state
    // (feature #113).
    _cachedSettings = settings;
  } catch (e) {
    // Failed to save settings, non-critical
  }
}

/**
 * Apply the "Tool count style" preference (feature #73 / #72 Phase 2).
 * Toggling `body.tool-count-style-brand` flips filter-toolbar tool chips
 * back to the v1.2.0 brand-coloured count badge (with no consent warning
 * pill). Default 'severity' = neutral count + warning pill.
 *
 * @param {'severity'|'brand'} style
 */
export function applyToolCountStyle(style) {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.toggle('tool-count-style-brand', style === 'brand');
}

/**
 * Synchronous read of the current tool count style from the body class.
 * Used by render-time code that can't await a storage round-trip.
 *
 * @returns {'severity'|'brand'}
 */
export function getToolCountStyle() {
  if (typeof document === 'undefined' || !document.body) return 'severity';
  return document.body.classList.contains('tool-count-style-brand') ? 'brand' : 'severity';
}

/**
 * Apply the "Display density" preference (feature #72 Phase 2).
 * Toggles `body.density-compact` so panel.css can reduce padding / gap
 * on the high-impact surfaces (toolbar, event rows, detail cards). Never
 * changes font-size or line-height — browser zoom handles type scaling.
 *
 * @param {'comfortable'|'compact'} mode
 */
export function applyDensityMode(mode) {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.toggle('density-compact', mode === 'compact');
}

/**
 * Synchronous read of the current density mode from the body class.
 *
 * @returns {'comfortable'|'compact'}
 */
export function getDensityMode() {
  if (typeof document === 'undefined' || !document.body) return 'comfortable';
  return document.body.classList.contains('density-compact') ? 'compact' : 'comfortable';
}

/**
 * Apply the "Show AI features" preference to the document. Toggling
 * `body.ai-features-disabled` lets panel.css hide the toolbar AI button
 * and any rendered .ai-summary-section instantly — no re-render needed.
 *
 * Exported so other modules (e.g. owl-tips) can read the same flag from
 * the body class without an async storage round-trip.
 *
 * @param {boolean} enabled
 */
export function applyShowAIFeatures(enabled) {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.toggle('ai-features-disabled', !enabled);
}

/**
 * Synchronous read of the current "Show AI features" state from the
 * body class. Use this from render-time code that can't await.
 */
export function isAIFeaturesEnabled() {
  if (typeof document === 'undefined' || !document.body) return true;
  return !document.body.classList.contains('ai-features-disabled');
}

/**
 * Apply "Show GTM Hub". Toggles `body.gtm-hub-disabled` so panel.css can
 * hide the toolbar GTM button, the GTM Hub modal, the intercept banner,
 * and overview intercept badges without a re-render. DNR rules remain
 * active — only the UI is hidden.
 */
export function applyShowGTMHub(enabled) {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.toggle('gtm-hub-disabled', !enabled);
}

export function isGTMHubEnabled() {
  if (typeof document === 'undefined' || !document.body) return true;
  return !document.body.classList.contains('gtm-hub-disabled');
}

/**
 * Apply "Show Script Tree". Toggles `body.script-tree-disabled` so panel.css
 * can hide the standalone Script Tree view-mode toggle and the info banner.
 * Callers should separately ensure the current view mode isn't 'tree' when
 * disabling.
 */
export function applyShowScriptTree(enabled) {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.toggle('script-tree-disabled', !enabled);
}

export function isScriptTreeEnabled() {
  if (typeof document === 'undefined' || !document.body) return true;
  return !document.body.classList.contains('script-tree-disabled');
}

/**
 * Apply "Show Cookie detection". Toggles `body.cookie-detection-disabled`
 * so panel.css can hide event-row cookie badges and the "Cookie Set"
 * detail section.
 */
export function applyShowCookieDetection(enabled) {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.toggle('cookie-detection-disabled', !enabled);
}

export function isCookieDetectionEnabled() {
  if (typeof document === 'undefined' || !document.body) return true;
  return !document.body.classList.contains('cookie-detection-disabled');
}

/**
 * Apply "Show Consent Check". Toggles `body.consent-check-disabled` so
 * panel.css can hide the consent filter chip, consent violation/status
 * badges on events, timeline consent state markers, the consent pill on
 * the overview card, and the unified Consent section in event details.
 */
export function applyShowConsentCheck(enabled) {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.toggle('consent-check-disabled', !enabled);
}

export function isConsentCheckEnabled() {
  if (typeof document === 'undefined' || !document.body) return true;
  return !document.body.classList.contains('consent-check-disabled');
}

/**
 * Apply "Show Consent Mode mismatch warning". Toggles
 * `body.consent-mismatch-warning-disabled`. The flag is read by
 * getConsentCheckForEvent in panel.js — when disabled, the gcmMismatch
 * field is stripped from the cached check so the row shield stays green,
 * the consent counter doesn't bump, and the section-header chip pair
 * collapses to the single green category chip. The CMP-vs-GCM
 * comparison table inside the Consent section is unaffected and still
 * shows which categories disagree.
 */
export function applyShowConsentModeMismatchWarning(enabled) {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.toggle('consent-mismatch-warning-disabled', !enabled);
}

export function isConsentModeMismatchWarningEnabled() {
  if (typeof document === 'undefined' || !document.body) return true;
  return !document.body.classList.contains('consent-mismatch-warning-disabled');
}

/**
 * Update a single setting and save
 */
export async function updateSetting(key, value) {
  const settings = await loadSettings();
  settings[key] = value;
  await saveSettings(settings);
  return settings;
}

/**
 * Update nested dataLayer setting and save
 */
export async function updateDataLayerSetting(key, value) {
  const settings = await loadSettings();
  settings.dataLayer[key] = value;
  await saveSettings(settings);
  // No live broadcast: the page script reads dataLayer settings from storage
  // at document_start, so changes take effect on the next navigation. (The
  // old DATALAYER_SETTINGS_UPDATED message had no listener anywhere -
  // removed 2026-06-11, #135 WP2 zombie cleanup.)
  return settings;
}

// ----------------------------------------
// Data Layer UI Helpers
// ----------------------------------------

// Update checkbox UI from settings
export function updateDataLayerCheckboxes(settings) {
  Object.entries(settings).forEach(([key, enabled]) => {
    const checkbox = document.getElementById(`setting-${key}`);
    if (checkbox) {
      checkbox.checked = enabled;
    }
  });
  updateDataLayerBadgeCount();
}

// Update the badge count showing enabled/total
export function updateDataLayerBadgeCount() {
  const badge = document.getElementById('datalayer-count');
  if (!badge) return;

  const total = Object.keys(DEFAULT_SETTINGS.dataLayer).length;
  let enabled = 0;
  Object.keys(DEFAULT_SETTINGS.dataLayer).forEach(key => {
    const checkbox = document.getElementById(`setting-${key}`);
    if (checkbox && checkbox.checked) enabled++;
  });

  badge.textContent = `${enabled}/${total}`;
}

// Get current settings from checkboxes
export function getDataLayerSettingsFromUI() {
  const settings = {};
  Object.keys(DEFAULT_SETTINGS.dataLayer).forEach(key => {
    const checkbox = document.getElementById(`setting-${key}`);
    settings[key] = checkbox ? checkbox.checked : DEFAULT_SETTINGS.dataLayer[key];
  });
  return settings;
}

// ----------------------------------------
// Settings Modal Open/Close
// ----------------------------------------

export function openSettingsModal() {
  closeOtherModals('settings-panel');
  _deps.elements.settingsPanel.classList.add('open');
  _deps.trackEvent('setting_modal', { action: 'open' });
}

export function closeSettingsModal() {
  _deps.elements.settingsPanel.classList.remove('open');
  // Clear any active search filter so the next open is a fresh state
  const searchInput = document.getElementById('settings-search-input');
  if (searchInput && searchInput.value !== '') {
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input'));
  }
}

// ----------------------------------------
// Settings Button Groups
// ----------------------------------------

// Update settings button groups to show current preference values
export function updateSettingsButtonGroups(settings) {
  const prefs = settings.defaultPreferences || {};

  // View mode - show the selected preference (lastused or specific value)
  const viewModeGroup = document.getElementById('view-mode-default-settings');
  if (viewModeGroup) {
    const pref = prefs.viewMode || 'lastused';
    viewModeGroup.querySelectorAll('.settings-button-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === pref);
    });
  }

  // Stream direction - show the selected preference (lastused or specific value)
  const streamGroup = document.getElementById('stream-direction-settings');
  if (streamGroup) {
    const pref = prefs.streamDirection || 'lastused';
    streamGroup.querySelectorAll('.settings-button-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === pref);
    });
  }

  // Sort order - show the selected preference (lastused or specific value)
  const sortGroup = document.getElementById('sort-order-settings');
  if (sortGroup) {
    const pref = prefs.sortMode || 'lastused';
    sortGroup.querySelectorAll('.settings-button-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === pref);
    });
  }

  // Scripts default
  const scriptsGroup = document.getElementById('scripts-default-settings');
  if (scriptsGroup) {
    const pref = prefs.scripts || 'lastused';
    scriptsGroup.querySelectorAll('.settings-button-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === pref);
    });
  }

  // Consent default
  const consentGroup = document.getElementById('consent-default-settings');
  if (consentGroup) {
    const pref = prefs.consent || 'lastused';
    consentGroup.querySelectorAll('.settings-button-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === pref);
    });
  }

  // Interactions default
  const interactionsGroup = document.getElementById('interactions-default-settings');
  if (interactionsGroup) {
    const pref = prefs.interactions || 'lastused';
    interactionsGroup.querySelectorAll('.settings-button-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === pref);
    });
  }

  // Nesting default
  const nestingGroup = document.getElementById('nesting-default-settings');
  if (nestingGroup) {
    const pref = prefs.nesting || 'lastused';
    nestingGroup.querySelectorAll('.settings-button-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === pref);
    });
  }

  // Filter toolbar layout
  const filterLayoutGroup = document.getElementById('filter-layout-settings');
  if (filterLayoutGroup) {
    const pref = prefs.filterToolbarCollapsed || 'lastused';
    filterLayoutGroup.querySelectorAll('.settings-button-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === pref);
    });
  }

  // Categories layout
  const categoryLayoutGroup = document.getElementById('category-layout-settings');
  if (categoryLayoutGroup) {
    const pref = prefs.categoriesCollapsed || 'lastused';
    categoryLayoutGroup.querySelectorAll('.settings-button-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === pref);
    });
  }

  // Theme preference — lives in its own storage key (managed by theme.js)
  const themeGroup = document.getElementById('theme-default-settings');
  if (themeGroup) {
    const themePref = getThemePreference();
    themeGroup.querySelectorAll('.settings-button-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === themePref);
    });
  }

  // Tool count style (feature #73)
  const toolCountStyleGroup = document.getElementById('tool-count-style-settings');
  if (toolCountStyleGroup) {
    const pref = settings.lookAndFeel?.toolCountStyle || 'severity';
    toolCountStyleGroup.querySelectorAll('.settings-button-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === pref);
    });
  }

  // Display density (feature #72 Phase 2)
  const densityGroup = document.getElementById('density-settings');
  if (densityGroup) {
    const pref = settings.lookAndFeel?.density || 'comfortable';
    densityGroup.querySelectorAll('.settings-button-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === pref);
    });
  }

  // Event detail layout (feature #113) — renders the status line +
  // Reset button + per-section default-expanded checkboxes.
  renderEventDetailLayoutSection(settings);
}

/**
 * Feature #113 — render the "Event detail layout" subsection inside
 * Settings → Look & Feel. Two render states:
 *   - Default order in use: show helper text only (no Reset button).
 *   - Custom order in use: show "Custom section order in use." +
 *     Reset to default button.
 *
 * Per-section default-expanded state is intentionally NOT exposed here.
 * Each section's shipped default-expanded state is unchanged from
 * pre-#113 behaviour; the user can still click a section header to
 * toggle it (persisted in-session by detail-section-state.js).
 */
function renderEventDetailLayoutSection(settings) {
  const container = document.getElementById('event-detail-layout-settings');
  if (!container) return;

  const userOrder = settings.lookAndFeel?.eventDetailSectionOrder || [];
  const isCustom = Array.isArray(userOrder) && userOrder.length > 0;

  container.replaceChildren();

  const status = document.createElement('div');
  status.className = 'event-detail-layout-status';
  if (isCustom) {
    const customLabel = document.createElement('span');
    customLabel.className = 'event-detail-layout-status-custom';
    customLabel.textContent = 'Custom section order in use.';
    status.appendChild(customLabel);

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'event-detail-layout-reset-btn';
    resetBtn.textContent = 'Reset to default';
    resetBtn.title = 'Restore the shipped section order.';
    resetBtn.addEventListener('click', async () => {
      await resetEventDetailSectionLayout();
      if (_deps && _deps.trackEvent) {
        _deps.trackEvent('event_detail_section_reset', { action: 'reset' });
      }
      const fresh = await loadSettings();
      renderEventDetailLayoutSection(fresh);
    });
    status.appendChild(resetBtn);
  } else {
    status.textContent = 'Drag the four-dot handle on any event detail section to reorder. Your layout is remembered across sessions.';
  }
  container.appendChild(status);
}

// Settings button group click handlers - these set the DEFAULT PREFERENCE, not the current value
function initSettingsButtonGroups() {
  // View mode preference
  const viewModeDefaultGroup = document.getElementById('view-mode-default-settings');
  if (viewModeDefaultGroup) {
    viewModeDefaultGroup.addEventListener('click', async (e) => {
      const btn = e.target.closest('.settings-button-option');
      if (!btn) return;
      viewModeDefaultGroup.querySelectorAll('.settings-button-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const settings = await loadSettings();
      if (!settings.defaultPreferences) settings.defaultPreferences = { ...DEFAULT_SETTINGS.defaultPreferences };
      settings.defaultPreferences.viewMode = btn.dataset.value;
      await saveSettings(settings);
      _deps.trackEvent('setting_change', { setting: 'view_mode', value: btn.dataset.value });
      _deps.setSettingsUserProperties({ setting_view_mode: btn.dataset.value });
    });
  }

  // Stream direction preference
  const streamGroup = document.getElementById('stream-direction-settings');
  if (streamGroup) {
    streamGroup.addEventListener('click', async (e) => {
      const btn = e.target.closest('.settings-button-option');
      if (!btn) return;
      streamGroup.querySelectorAll('.settings-button-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const settings = await loadSettings();
      if (!settings.defaultPreferences) settings.defaultPreferences = { ...DEFAULT_SETTINGS.defaultPreferences };
      settings.defaultPreferences.streamDirection = btn.dataset.value;
      await saveSettings(settings);
      _deps.trackEvent('setting_change', { setting: 'stream_direction', value: btn.dataset.value });
      _deps.setSettingsUserProperties({ setting_stream_direction: btn.dataset.value });
    });
  }

  // Sort order preference
  const sortGroup = document.getElementById('sort-order-settings');
  if (sortGroup) {
    sortGroup.addEventListener('click', async (e) => {
      const btn = e.target.closest('.settings-button-option');
      if (!btn) return;
      sortGroup.querySelectorAll('.settings-button-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const settings = await loadSettings();
      if (!settings.defaultPreferences) settings.defaultPreferences = { ...DEFAULT_SETTINGS.defaultPreferences };
      settings.defaultPreferences.sortMode = btn.dataset.value;
      await saveSettings(settings);
      _deps.trackEvent('setting_change', { setting: 'sort_mode', value: btn.dataset.value });
      _deps.setSettingsUserProperties({ setting_sort_mode: btn.dataset.value });
    });
  }

  // Scripts default preference
  const scriptsGroup = document.getElementById('scripts-default-settings');
  if (scriptsGroup) {
    scriptsGroup.addEventListener('click', async (e) => {
      const btn = e.target.closest('.settings-button-option');
      if (!btn) return;
      scriptsGroup.querySelectorAll('.settings-button-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const settings = await loadSettings();
      if (!settings.defaultPreferences) settings.defaultPreferences = { ...DEFAULT_SETTINGS.defaultPreferences };
      settings.defaultPreferences.scripts = btn.dataset.value;
      await saveSettings(settings);
      _deps.trackEvent('setting_change', { setting: 'scripts', value: btn.dataset.value });
      _deps.setSettingsUserProperties({ setting_scripts: btn.dataset.value });
    });
  }

  // Consent default preference
  const consentGroup = document.getElementById('consent-default-settings');
  if (consentGroup) {
    consentGroup.addEventListener('click', async (e) => {
      const btn = e.target.closest('.settings-button-option');
      if (!btn) return;
      consentGroup.querySelectorAll('.settings-button-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const settings = await loadSettings();
      if (!settings.defaultPreferences) settings.defaultPreferences = { ...DEFAULT_SETTINGS.defaultPreferences };
      settings.defaultPreferences.consent = btn.dataset.value;
      await saveSettings(settings);
      _deps.trackEvent('setting_change', { setting: 'consent', value: btn.dataset.value });
      _deps.setSettingsUserProperties({ setting_consent: btn.dataset.value });
    });
  }

  // Interactions default preference
  const interactionsGroup = document.getElementById('interactions-default-settings');
  if (interactionsGroup) {
    interactionsGroup.addEventListener('click', async (e) => {
      const btn = e.target.closest('.settings-button-option');
      if (!btn) return;
      interactionsGroup.querySelectorAll('.settings-button-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const settings = await loadSettings();
      if (!settings.defaultPreferences) settings.defaultPreferences = { ...DEFAULT_SETTINGS.defaultPreferences };
      settings.defaultPreferences.interactions = btn.dataset.value;
      await saveSettings(settings);
      _deps.trackEvent('setting_change', { setting: 'interactions', value: btn.dataset.value });
      _deps.setSettingsUserProperties({ setting_interactions: btn.dataset.value });
    });
  }

  // Nesting default preference
  const nestingGroup = document.getElementById('nesting-default-settings');
  if (nestingGroup) {
    nestingGroup.addEventListener('click', async (e) => {
      const btn = e.target.closest('.settings-button-option');
      if (!btn) return;
      nestingGroup.querySelectorAll('.settings-button-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const settings = await loadSettings();
      if (!settings.defaultPreferences) settings.defaultPreferences = { ...DEFAULT_SETTINGS.defaultPreferences };
      settings.defaultPreferences.nesting = btn.dataset.value;
      await saveSettings(settings);
      _deps.trackEvent('setting_change', { setting: 'nesting', value: btn.dataset.value });
      _deps.setSettingsUserProperties({ setting_nesting: btn.dataset.value });
    });
  }

  // Filter toolbar layout preference
  const filterLayoutGroup = document.getElementById('filter-layout-settings');
  if (filterLayoutGroup) {
    filterLayoutGroup.addEventListener('click', async (e) => {
      const btn = e.target.closest('.settings-button-option');
      if (!btn) return;
      filterLayoutGroup.querySelectorAll('.settings-button-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const settings = await loadSettings();
      if (!settings.defaultPreferences) settings.defaultPreferences = { ...DEFAULT_SETTINGS.defaultPreferences };
      settings.defaultPreferences.filterToolbarCollapsed = btn.dataset.value;
      await saveSettings(settings);
      _deps.trackEvent('setting_change', { setting: 'toolbar_layout', value: btn.dataset.value });
      _deps.setSettingsUserProperties({ setting_toolbar_layout: btn.dataset.value });
    });
  }

  // Categories layout preference
  const categoryLayoutGroup = document.getElementById('category-layout-settings');
  if (categoryLayoutGroup) {
    categoryLayoutGroup.addEventListener('click', async (e) => {
      const btn = e.target.closest('.settings-button-option');
      if (!btn) return;
      categoryLayoutGroup.querySelectorAll('.settings-button-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const settings = await loadSettings();
      if (!settings.defaultPreferences) settings.defaultPreferences = { ...DEFAULT_SETTINGS.defaultPreferences };
      settings.defaultPreferences.categoriesCollapsed = btn.dataset.value;
      await saveSettings(settings);
      _deps.trackEvent('setting_change', { setting: 'categories_layout', value: btn.dataset.value });
      _deps.setSettingsUserProperties({ setting_categories_layout: btn.dataset.value });
    });
  }

  // Theme preference (system / light / dark) — persisted via theme.js in its own storage key.
  // Kept separate from settings.defaultPreferences because the theme module resolves it
  // pre-paint in panel.html before any settings loader runs.
  const themeGroup = document.getElementById('theme-default-settings');
  if (themeGroup) {
    themeGroup.addEventListener('click', async (e) => {
      const btn = e.target.closest('.settings-button-option');
      if (!btn) return;
      themeGroup.querySelectorAll('.settings-button-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      await setThemePreference(btn.dataset.value);
      _deps.trackEvent('setting_change', { setting: 'theme', value: btn.dataset.value, source: 'settings' });
      _deps.setSettingsUserProperties({ setting_theme: btn.dataset.value });
    });
  }

  // Tool count style (feature #73). Body-class flip is instant; we still
  // ask the panel to re-render the filter toolbar so chips that already
  // had a warning pill get rebuilt without it (and vice versa) — the body
  // class hides the pill via CSS, but the count badge's brand-colour vs
  // neutral switch is JS-driven.
  const toolCountStyleGroup = document.getElementById('tool-count-style-settings');
  if (toolCountStyleGroup) {
    toolCountStyleGroup.addEventListener('click', async (e) => {
      const btn = e.target.closest('.settings-button-option');
      if (!btn) return;
      toolCountStyleGroup.querySelectorAll('.settings-button-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const settings = await loadSettings();
      if (!settings.lookAndFeel) settings.lookAndFeel = { ...DEFAULT_SETTINGS.lookAndFeel };
      settings.lookAndFeel.toolCountStyle = btn.dataset.value;
      await saveSettings(settings);
      applyToolCountStyle(btn.dataset.value);
      if (typeof _deps.render === 'function') _deps.render();
      _deps.trackEvent('setting_change', { setting: 'tool_count_style', value: btn.dataset.value });
      _deps.setSettingsUserProperties({ setting_tool_count_style: btn.dataset.value });
    });
  }

  // Display density (feature #72 Phase 2). Pure CSS toggle — flipping the
  // body class repaints all density-affected surfaces without a re-render.
  const densityGroup = document.getElementById('density-settings');
  if (densityGroup) {
    densityGroup.addEventListener('click', async (e) => {
      const btn = e.target.closest('.settings-button-option');
      if (!btn) return;
      densityGroup.querySelectorAll('.settings-button-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const settings = await loadSettings();
      if (!settings.lookAndFeel) settings.lookAndFeel = { ...DEFAULT_SETTINGS.lookAndFeel };
      settings.lookAndFeel.density = btn.dataset.value;
      await saveSettings(settings);
      applyDensityMode(btn.dataset.value);
      _deps.trackEvent('setting_change', { setting: 'density', value: btn.dataset.value });
      _deps.setSettingsUserProperties({ setting_density: btn.dataset.value });
    });
  }
}

// ----------------------------------------
// Settings Event Listeners
// ----------------------------------------

function setupSettingsListeners() {
  const { elements } = _deps;

  // Settings button and panel
  if (elements.settingsBtn) {
    elements.settingsBtn.addEventListener('click', () => {
      if (elements.settingsPanel.classList.contains('open')) {
        closeSettingsModal();
      } else {
        openSettingsModal();
      }
    });
  }

  if (elements.settingsClose) {
    elements.settingsClose.addEventListener('click', closeSettingsModal);
  }

  // Close settings modal when clicking outside
  elements.settingsPanel?.addEventListener('click', (e) => {
    if (e.target === elements.settingsPanel) {
      closeSettingsModal();
    }
  });

  // Settings search — filters rows + sections by label/description text
  attachSettingsSearch();

  // Data layer toggle checkboxes
  document.querySelectorAll('#datalayer-settings input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', async () => {
      const dataLayerSettings = getDataLayerSettingsFromUI();
      const settings = await loadSettings();
      settings.dataLayer = dataLayerSettings;
      await saveSettings(settings);
      updateDataLayerBadgeCount();
      const dlEnabled = Object.values(dataLayerSettings).filter(v => v).length;
      _deps.trackEvent('setting_change', { setting: 'datalayer', value: checkbox.id.replace('setting-', ''), enabled: checkbox.checked });
      _deps.setSettingsUserProperties({ setting_datalayer_count: dlEnabled });
    });
  });

  // Enable All button
  if (elements.dataLayerEnableAll) {
    elements.dataLayerEnableAll.addEventListener('click', async () => {
      const dataLayerSettings = {};
      Object.keys(DEFAULT_SETTINGS.dataLayer).forEach(key => {
        dataLayerSettings[key] = true;
      });
      updateDataLayerCheckboxes(dataLayerSettings);
      const settings = await loadSettings();
      settings.dataLayer = dataLayerSettings;
      await saveSettings(settings);
      const dlEnabled = Object.values(dataLayerSettings).filter(v => v).length;
      _deps.trackEvent('setting_change', { setting: 'datalayer', value: 'enable_all' });
      _deps.setSettingsUserProperties({ setting_datalayer_count: dlEnabled });
    });
  }

  // Disable All button
  if (elements.dataLayerDisableAll) {
    elements.dataLayerDisableAll.addEventListener('click', async () => {
      const dataLayerSettings = {};
      Object.keys(DEFAULT_SETTINGS.dataLayer).forEach(key => {
        dataLayerSettings[key] = false;
      });
      updateDataLayerCheckboxes(dataLayerSettings);
      const settings = await loadSettings();
      settings.dataLayer = dataLayerSettings;
      await saveSettings(settings);
      _deps.trackEvent('setting_change', { setting: 'datalayer', value: 'disable_all' });
      _deps.setSettingsUserProperties({ setting_datalayer_count: 0 });
    });
  }

  // Common Only button (Google, Adobe, Tealium)
  if (elements.dataLayerEnableCommon) {
    elements.dataLayerEnableCommon.addEventListener('click', async () => {
      const dataLayerSettings = { ...DEFAULT_SETTINGS.dataLayer };
      // Enable only common ones
      dataLayerSettings['datalayer'] = true;
      dataLayerSettings['adobe-datalayer'] = true;
      dataLayerSettings['tealium-datalayer'] = true;
      updateDataLayerCheckboxes(dataLayerSettings);
      const settings = await loadSettings();
      settings.dataLayer = dataLayerSettings;
      await saveSettings(settings);
      const dlEnabled = Object.values(dataLayerSettings).filter(v => v).length;
      _deps.trackEvent('setting_change', { setting: 'datalayer', value: 'common_only' });
      _deps.setSettingsUserProperties({ setting_datalayer_count: dlEnabled });
    });
  }

  // Export target button group handler
  const exportTargetGroup = document.getElementById('export-target-settings');
  if (exportTargetGroup) {
    exportTargetGroup.addEventListener('click', async (e) => {
      const btn = e.target.closest('.settings-button-option');
      if (!btn) return;
      exportTargetGroup.querySelectorAll('.settings-button-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const enabled = btn.dataset.value === 'file';
      setExportToFile(enabled);
      await updateSetting('exportToFile', enabled);
      _deps.trackEvent('setting_change', { setting: 'export_target', value: btn.dataset.value });
      _deps.setSettingsUserProperties({ setting_export_to_file: enabled });
    });
  }

  // AI tool target radio-group handler — sets the warning threshold.
  // 'off' subsumes the old "disable warning" toggle entirely.
  const exportWarningTargetGroup = document.getElementById('export-warning-target-settings');
  if (exportWarningTargetGroup) {
    exportWarningTargetGroup.addEventListener('change', async (e) => {
      const input = e.target;
      if (input.tagName !== 'INPUT' || input.name !== 'export-warning-target') return;
      const value = input.value;
      setExportWarningTarget(value);
      await updateSetting('exportWarningTarget', value);
      _deps.trackEvent('setting_change', { setting: 'export_warning_target', value });
      _deps.setSettingsUserProperties({ setting_export_warning_target: value });
    });
  }

  // Perf logging toggle handler
  const perfLoggingCheckbox = document.getElementById('setting-perf-logging');
  if (perfLoggingCheckbox) {
    perfLoggingCheckbox.addEventListener('change', async () => {
      const enabled = perfLoggingCheckbox.checked;
      _deps.setDebugLogging(enabled);
      await updateSetting('perfLogging', enabled);
      _deps.trackEvent('setting_change', { setting: 'perf_logging', enabled });
      _deps.setSettingsUserProperties({ setting_perf_logging: enabled });
    });
  }

  // Show AI features toggle handler — flips the body class so panel.css
  // hides the toolbar AI button and every .ai-summary-section instantly.
  const showAIFeaturesCheckbox = document.getElementById('setting-show-ai-features');
  if (showAIFeaturesCheckbox) {
    showAIFeaturesCheckbox.addEventListener('change', async () => {
      const enabled = showAIFeaturesCheckbox.checked;
      applyShowAIFeatures(enabled);
      await updateSetting('showAIFeatures', enabled);
      _deps.trackEvent('setting_change', { setting: 'show_ai_features', enabled });
      _deps.setSettingsUserProperties({ setting_show_ai_features: enabled });
    });
  }

  // PII redaction toggle — persisted to settings.aiRedactPii. Read by
  // the service-worker AI_REQUEST handler and forwarded to renderPrompt
  // as an override so it beats the per-template default. No body-class
  // / re-render needed — the next AI request picks up the new value.
  const aiRedactPiiCheckbox = document.getElementById('setting-ai-redact-pii');
  if (aiRedactPiiCheckbox) {
    aiRedactPiiCheckbox.addEventListener('change', async () => {
      const enabled = aiRedactPiiCheckbox.checked;
      await updateSetting('aiRedactPii', enabled);
      _deps.trackEvent('setting_change', { setting: 'ai_redact_pii', enabled });
      _deps.setSettingsUserProperties({ setting_ai_redact_pii: enabled });
    });
  }

  // Show GTM Hub toggle handler — hides the toolbar GTM button, Hub modal,
  // intercept banner, and overview intercept badges via CSS.
  const showGTMHubCheckbox = document.getElementById('setting-show-gtm-hub');
  if (showGTMHubCheckbox) {
    showGTMHubCheckbox.addEventListener('change', async () => {
      const enabled = showGTMHubCheckbox.checked;
      applyShowGTMHub(enabled);
      await updateSetting('showGTMHub', enabled);
      _deps.trackEvent('setting_change', { setting: 'show_gtm_hub', enabled });
      _deps.setSettingsUserProperties({ setting_show_gtm_hub: enabled });
    });
  }

  // Show Script Tree toggle handler — hides the standalone view toggle and
  // info banner. If the user is currently in 'tree' when disabling, fall
  // back to 'stream' so they're not stuck on an invisible view.
  const showScriptTreeCheckbox = document.getElementById('setting-show-script-tree');
  if (showScriptTreeCheckbox) {
    showScriptTreeCheckbox.addEventListener('change', async () => {
      const enabled = showScriptTreeCheckbox.checked;
      applyShowScriptTree(enabled);
      if (!enabled && _deps.getState().viewMode === 'tree') {
        _deps.handleViewModeChange('stream');
      }
      await updateSetting('showScriptTree', enabled);
      _deps.trackEvent('setting_change', { setting: 'show_script_tree', enabled });
      _deps.setSettingsUserProperties({ setting_show_script_tree: enabled });
    });
  }

  // Show Cookie detection toggle handler — hides cookie badges in the event
  // stream and the "Cookie Set" section in event details via CSS.
  const showCookieDetectionCheckbox = document.getElementById('setting-show-cookie-detection');
  if (showCookieDetectionCheckbox) {
    showCookieDetectionCheckbox.addEventListener('change', async () => {
      const enabled = showCookieDetectionCheckbox.checked;
      applyShowCookieDetection(enabled);
      await updateSetting('showCookieDetection', enabled);
      _deps.trackEvent('setting_change', { setting: 'show_cookie_detection', enabled });
      _deps.setSettingsUserProperties({ setting_show_cookie_detection: enabled });
    });
  }

  // Show review prompt toggle — gates whether the engagement-based CWS
  // review bubble is allowed to appear. No body class needed; the trigger
  // logic in review-prompt.js reads this on every devtool_page.
  const showReviewPromptCheckbox = document.getElementById('setting-show-review-prompt');
  if (showReviewPromptCheckbox) {
    showReviewPromptCheckbox.addEventListener('change', async () => {
      const enabled = showReviewPromptCheckbox.checked;
      await updateSetting('showReviewPrompt', enabled);
      _deps.trackEvent('setting_change', { setting: 'show_review_prompt', enabled });
      _deps.setSettingsUserProperties({ setting_show_review_prompt: enabled });
    });
  }

  // Show Consent Check toggle handler — hides the consent filter chip,
  // consent check/violation badges, timeline consent state markers, the
  // overview consent pill, and the unified Consent section in event details.
  const showConsentCheckCheckbox = document.getElementById('setting-show-consent-check');
  if (showConsentCheckCheckbox) {
    showConsentCheckCheckbox.addEventListener('change', async () => {
      const enabled = showConsentCheckCheckbox.checked;
      applyShowConsentCheck(enabled);
      await updateSetting('showConsentCheck', enabled);
      _deps.trackEvent('setting_change', { setting: 'show_consent_check', enabled });
      _deps.setSettingsUserProperties({ setting_show_consent_check: enabled });
    });
  }

  // Show Consent Mode mismatch warning toggle handler — sub-feature of Show
  // Consent Check. When toggled, drop the cached consent checks so events
  // re-evaluate against the new setting on next render.
  const showConsentMismatchCheckbox = document.getElementById('setting-show-consent-mismatch-warning');
  if (showConsentMismatchCheckbox) {
    showConsentMismatchCheckbox.addEventListener('change', async () => {
      const enabled = showConsentMismatchCheckbox.checked;
      applyShowConsentModeMismatchWarning(enabled);
      await updateSetting('showConsentModeMismatchWarning', enabled);
      _deps.invalidateConsentChecks?.();
      _deps.render?.();
      _deps.trackEvent('setting_change', { setting: 'show_consent_mode_mismatch_warning', enabled });
      _deps.setSettingsUserProperties({ setting_show_consent_mode_mismatch_warning: enabled });
    });
  }

  // Hide developer_id events toggle handler
  const hideDeveloperIdCheckbox = document.getElementById('setting-hide-developerid');
  if (hideDeveloperIdCheckbox) {
    hideDeveloperIdCheckbox.addEventListener('change', async () => {
      const hidden = hideDeveloperIdCheckbox.checked;
      _deps.getState().hideDeveloperIdEvents = hidden;
      await updateSetting('hideDeveloperIdEvents', hidden);
      _deps.render(); // Re-render to apply filter
      _deps.trackEvent('setting_change', { setting: 'hide_developer_id', enabled: hidden });
      _deps.setSettingsUserProperties({ setting_hide_developer_id: hidden });
    });
  }

  // Share unknown tracker hostnames toggle handler (feature #47)
  const shareUnknownCheckbox = document.getElementById('setting-share-unknown-endpoint-hostnames');
  if (shareUnknownCheckbox) {
    shareUnknownCheckbox.addEventListener('change', async () => {
      const enabled = shareUnknownCheckbox.checked;
      _deps.getState().shareUnknownEndpointHostnames = enabled;
      await updateSetting('shareUnknownEndpointHostnames', enabled);
      _deps.trackEvent('setting_change', { setting: 'share_unknown_endpoint_hostnames', enabled });
      _deps.setSettingsUserProperties({ setting_share_unknown_endpoint_hostnames: enabled });
    });
  }

  // Correlation window input handlers
  const correlationStandardInput = document.getElementById('setting-correlation-standard');
  const correlationNameMatchInput = document.getElementById('setting-correlation-namematch');
  if (correlationStandardInput) {
    correlationStandardInput.addEventListener('change', async () => {
      let value = parseInt(correlationStandardInput.value, 10);
      if (isNaN(value)) value = DEFAULT_SETTINGS.correlation.standardWindowMs;
      value = Math.max(500, Math.min(10000, value));
      correlationStandardInput.value = value;

      // Ensure name-match window stays >= standard window
      const nameMatchValue = parseInt(correlationNameMatchInput?.value, 10) || DEFAULT_SETTINGS.correlation.matchingNameWindowMs;
      if (nameMatchValue < value) {
        const clamped = Math.max(value, 2000);
        if (correlationNameMatchInput) correlationNameMatchInput.value = clamped;
        await _saveCorrelationSettings(value, clamped);
      } else {
        await _saveCorrelationSettings(value, nameMatchValue);
      }
      _deps.trackEvent('setting_change', { setting: 'correlation_standard_window', value });
      _deps.setSettingsUserProperties({ setting_correlation_standard_window_ms: value });
    });
  }

  if (correlationNameMatchInput) {
    correlationNameMatchInput.addEventListener('change', async () => {
      let value = parseInt(correlationNameMatchInput.value, 10);
      if (isNaN(value)) value = DEFAULT_SETTINGS.correlation.matchingNameWindowMs;
      value = Math.max(2000, Math.min(30000, value));

      // Ensure name-match window stays >= standard window
      const standardValue = parseInt(correlationStandardInput?.value, 10) || DEFAULT_SETTINGS.correlation.standardWindowMs;
      if (value < standardValue) value = standardValue;
      correlationNameMatchInput.value = value;

      await _saveCorrelationSettings(standardValue, value);
      _deps.trackEvent('setting_change', { setting: 'correlation_name_match_window', value });
      _deps.setSettingsUserProperties({ setting_correlation_name_match_window_ms: value });
    });
  }

  // Replay onboarding tour button (Feature #41)
  const replayOnboardingBtn = document.getElementById('setting-replay-onboarding');
  if (replayOnboardingBtn) {
    replayOnboardingBtn.addEventListener('click', async () => {
      // Reset the completion version so the auto-trigger guard doesn't fire on top of us
      await updateSetting('onboardingCompletedVersion', 0);
      closeSettingsModal();
      // Launch directly — tour anchors are live in the panel, no need to wait for an event
      if (window.OnboardingTour && !window.OnboardingTour.isActive()) {
        window.OnboardingTour.start({
          trackEventFn: _deps.trackEvent,
          onComplete: (version) => updateSetting('onboardingCompletedVersion', version),
          reason: 'replay'
        });
      }
    });
  }

  // Replay What's New tour button — companion to the onboarding replay row.
  // The row is shown only when WhatsNewTour has a tour registered for the
  // current/latest version. Clicking launches that version's tour directly.
  const replayWhatsNewRow = document.getElementById('setting-replay-whats-new-tour-row');
  const replayWhatsNewBtn = document.getElementById('setting-replay-whats-new-tour');
  const replayWhatsNewLabel = document.getElementById('setting-replay-whats-new-tour-label');
  if (replayWhatsNewRow && replayWhatsNewBtn && window.WhatsNewTour) {
    const latest = window.WhatsNewTour.getLatestVersion();
    if (latest) {
      if (replayWhatsNewLabel) replayWhatsNewLabel.textContent = `What’s new tour (${latest})`;
      replayWhatsNewRow.hidden = false;
      replayWhatsNewBtn.addEventListener('click', () => {
        closeSettingsModal();
        window.WhatsNewTour.launch(latest, {
          trackEventFn: _deps.trackEvent,
          reason: 'replay'
        });
      });
    }
  }

  // Analytics opt-out toggle handler
  const analyticsEnabledCheckbox = document.getElementById('setting-analytics-enabled');
  if (analyticsEnabledCheckbox) {
    analyticsEnabledCheckbox.addEventListener('change', async () => {
      const enabled = analyticsEnabledCheckbox.checked;
      // Track opt-out BEFORE disabling (event fires while analytics is still on)
      if (!enabled) {
        _deps.trackEvent('setting_change', { setting: 'analytics_enabled', enabled: false });
      }
      await chrome.storage.local.set({ analytics_enabled: enabled });
      // Track opt-in after enabling
      if (enabled) {
        _deps.trackEvent('setting_change', { setting: 'analytics_enabled', enabled: true });
      }
    });
  }
}

// ----------------------------------------
// Settings Search
// ----------------------------------------
// Substring filter that hides settings rows / sections / subsections whose
// text doesn't contain the query. Title matches expose the whole section so
// "export" surfaces every Export & Debug row even when the row text alone
// doesn't contain the word. Empty query collapses everything (consistent with
// the "all sections start collapsed" convention).
const SETTINGS_SEARCH_ROW_SELECTORS = [
  '.settings-row',
  '.settings-toggle-row',
  '.settings-radio-option',
  '.settings-compact-toggle',
].join(',');

function attachSettingsSearch() {
  const input = document.getElementById('settings-search-input');
  const clearBtn = document.getElementById('settings-search-clear');
  const empty = document.getElementById('settings-search-empty');
  if (!input || !clearBtn || !empty) return;

  function applyFilter() {
    const q = input.value.trim().toLowerCase();
    clearBtn.hidden = q === '';

    const sections = document.querySelectorAll('.settings-body .settings-section');

    if (q === '') {
      // Reset: clear visibility overrides on every previously-hidden element,
      // then collapse all sections so the user sees the full section list.
      sections.forEach(section => {
        section.style.display = '';
        section.open = false;
        section.querySelectorAll('[data-search-hidden]').forEach(el => {
          el.style.display = '';
          el.removeAttribute('data-search-hidden');
        });
      });
      empty.hidden = true;
      return;
    }

    let anySectionVisible = false;

    sections.forEach(section => {
      const titleEl = section.querySelector('.settings-section-title');
      const titleMatches = titleEl ? titleEl.textContent.toLowerCase().includes(q) : false;

      let visibleRows = 0;
      section.querySelectorAll(SETTINGS_SEARCH_ROW_SELECTORS).forEach(row => {
        const matches = titleMatches || row.textContent.toLowerCase().includes(q);
        if (matches) {
          row.style.display = '';
          row.removeAttribute('data-search-hidden');
          visibleRows++;
        } else {
          row.style.display = 'none';
          row.setAttribute('data-search-hidden', 'true');
        }
      });

      // Subsections — hide when none of their rows survived the filter
      section.querySelectorAll('.settings-subsection').forEach(sub => {
        const childRows = sub.querySelectorAll(SETTINGS_SEARCH_ROW_SELECTORS);
        const anyChildVisible = Array.from(childRows).some(r => !r.hasAttribute('data-search-hidden'));
        if (anyChildVisible) {
          sub.style.display = '';
          sub.removeAttribute('data-search-hidden');
        } else {
          sub.style.display = 'none';
          sub.setAttribute('data-search-hidden', 'true');
        }
      });

      if (visibleRows > 0 || titleMatches) {
        section.style.display = '';
        section.open = true;
        anySectionVisible = true;
      } else {
        section.style.display = 'none';
      }
    });

    empty.hidden = anySectionVisible;
  }

  input.addEventListener('input', applyFilter);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value !== '') {
      e.preventDefault();
      e.stopPropagation();  // don't close the modal
      input.value = '';
      applyFilter();
    }
  });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    applyFilter();
    input.focus();
  });
}

// ----------------------------------------
// Correlation Helpers
// ----------------------------------------

async function _saveCorrelationSettings(standardWindowMs, matchingNameWindowMs) {
  const settings = await loadSettings();
  settings.correlation = { standardWindowMs, matchingNameWindowMs };
  await saveSettings(settings);
  // Update state so new events use the new windows immediately
  const state = _deps.getState();
  state.correlationWindows = { standardWindowMs, matchingNameWindowMs };
}

// ----------------------------------------
// Settings Initialization on Load
// ----------------------------------------

/**
 * Load and apply all settings on panel startup.
 * Must be called after initSettings() and after state is ready.
 */
export async function initializeSettings() {
  const state = _deps.getState();
  const settings = await loadSettings();

  // Ensure defaults exist
  if (!settings.defaultPreferences) {
    settings.defaultPreferences = { ...DEFAULT_SETTINGS.defaultPreferences };
  }
  if (!settings.lastUsed) {
    settings.lastUsed = { ...DEFAULT_SETTINGS.lastUsed };
    await saveSettings(settings);
  }

  // Apply effective defaults
  // View mode (Feature #60: 'grouped' carries an additional activeGrouping value).
  const defaultViewMode = getEffectiveDefault(settings, 'viewMode');
  const defaultActiveGrouping = settings.lastUsed?.activeGrouping
    || settings.activeGrouping
    || 'tool';
  // Seed state.activeGrouping and state.pinnedGroupings from the settings
  // composite before any render, so the toolbar reflects the persisted state.
  state.activeGrouping = defaultActiveGrouping;
  if (Array.isArray(settings.lastUsed?.pinnedGroupings)) {
    state.pinnedGroupings = [...settings.lastUsed.pinnedGroupings];
  } else if (Array.isArray(settings.pinnedGroupings)) {
    state.pinnedGroupings = [...settings.pinnedGroupings];
  }

  // Activated-groupings rehydrate. Missing field on existing v1.2.0-dev
  // installs → seed from current pinnedGroupings (best-effort: assumes
  // anyone currently pinned was activated). Fresh installs hit
  // INSTALL_DEFAULTS ([]) and don't go through this branch.
  if (Array.isArray(settings.lastUsed?.activatedGroupings)) {
    state.activatedGroupings = [...settings.lastUsed.activatedGroupings];
  } else {
    state.activatedGroupings = [...state.pinnedGroupings];
    if (!settings.lastUsed) settings.lastUsed = { ...DEFAULT_SETTINGS.lastUsed };
    settings.lastUsed.activatedGroupings = [...state.activatedGroupings];
    await saveSettings(settings);
  }

  if (defaultViewMode && defaultViewMode !== 'stream') {
    // Defer view mode switch until after render setup — handleViewModeChange needs elements ready
    setTimeout(() => _deps.handleViewModeChange(defaultViewMode, defaultActiveGrouping), 0);
  }

  // Stream direction
  state.streamDirection = getEffectiveDefault(settings, 'streamDirection');
  _deps.updateStreamDirectionButton();

  // Sort mode
  state.sortMode = getEffectiveDefault(settings, 'sortMode');
  _deps.updateSortButtonUI();

  // Scripts filter
  state.filters.eventTypes.scripts = getEffectiveDefault(settings, 'scripts');
  _deps.updateScriptsFilterUI();

  // Consent filter
  state.filters.eventTypes.consent = getEffectiveDefault(settings, 'consent');
  _deps.updateConsentFilterUI();

  // Interactions filter
  state.filters.eventTypes.interactions = getEffectiveDefault(settings, 'interactions');
  _deps.updateInteractionsFilterUI();

  // DL Nesting
  state.showTriggerCorrelation = getEffectiveDefault(settings, 'nesting');
  if (_deps.elements.triggerCorrelationToggle) {
    _deps.elements.triggerCorrelationToggle.checked = state.showTriggerCorrelation;
  }

  // Filter toolbar layout
  const toolbarCollapsed = getEffectiveDefault(settings, 'filterToolbarCollapsed');
  if (toolbarCollapsed) {
    state.filterToolbarCollapsed = true;
    const toggleBtn = document.getElementById('filter-toolbar-collapse-btn');
    if (toggleBtn) {
      toggleBtn.closest('.category-toolbar')?.classList.add('collapsed');
    }
  }

  // Categories collapsed
  const categoriesCollapsed = getEffectiveDefault(settings, 'categoriesCollapsed');
  if (categoriesCollapsed) {
    state.allCategoriesCollapsed = true;
  }

  // Update settings panel button groups to reflect current preferences
  updateSettingsButtonGroups(settings);

  // Apply tool count style (feature #73). Body-class flip drives both
  // the count badge fallback in panel.css and filter-bar.js's render guard.
  applyToolCountStyle(settings.lookAndFeel?.toolCountStyle || 'severity');

  // Apply density (feature #72 Phase 2). Body-class flip on its own —
  // panel.css overrides under body.density-compact handle the spacing.
  applyDensityMode(settings.lookAndFeel?.density || 'comfortable');

  // Apply highlighted platforms
  if (settings.highlightedPlatforms && settings.highlightedPlatforms.length > 0) {
    state.highlightedPlatforms = new Set(settings.highlightedPlatforms);
    _deps.render(); // Re-render to show highlights
  }

  // Apply dataLayer settings
  updateDataLayerCheckboxes(settings.dataLayer);

  // Apply export settings
  const exportTargetGroup = document.getElementById('export-target-settings');
  if (exportTargetGroup) {
    const value = settings.exportToFile ? 'file' : 'clipboard';
    exportTargetGroup.querySelectorAll('.settings-button-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.value === value);
    });
    setExportToFile(settings.exportToFile || false);
  }
  const exportWarningTargetGroup = document.getElementById('export-warning-target-settings');
  if (exportWarningTargetGroup) {
    // Resolve target with migration from legacy `exportWarning` boolean:
    //   exportWarning === false  → 'off'  (was: don't warn)
    //   exportWarning === true   → 'standard' (was: warn at 50K)
    //   exportWarning unset      → 'standard' (default)
    let target = settings.exportWarningTarget;
    if (typeof target !== 'string' || !['strict','standard','relaxed','generous','off'].includes(target)) {
      target = settings.exportWarning === false ? 'off' : 'standard';
    }
    const radio = exportWarningTargetGroup.querySelector(`input[type="radio"][value="${target}"]`);
    if (radio) radio.checked = true;
    setExportWarningTarget(target);
  }

  // Apply perf logging setting
  const perfLoggingCheckbox = document.getElementById('setting-perf-logging');
  if (perfLoggingCheckbox) {
    perfLoggingCheckbox.checked = settings.perfLogging || false;
    _deps.setDebugLogging(settings.perfLogging || false);
  }

  // Apply show-AI-features setting (default: true = shown)
  const showAIFeaturesCheckbox = document.getElementById('setting-show-ai-features');
  const showAIFeatures = settings.showAIFeatures !== false;
  if (showAIFeaturesCheckbox) showAIFeaturesCheckbox.checked = showAIFeatures;
  applyShowAIFeatures(showAIFeatures);

  // Apply ai-redact-pii setting (default: true = redact). The service
  // worker reads settings.aiRedactPii directly per request, so no panel-
  // side application is needed beyond syncing the checkbox state.
  const aiRedactPiiCheckbox = document.getElementById('setting-ai-redact-pii');
  if (aiRedactPiiCheckbox) {
    aiRedactPiiCheckbox.checked = settings.aiRedactPii !== false;
  }

  // Apply show-GTM-Hub setting (default: true = shown)
  const showGTMHubCheckbox = document.getElementById('setting-show-gtm-hub');
  const showGTMHub = settings.showGTMHub !== false;
  if (showGTMHubCheckbox) showGTMHubCheckbox.checked = showGTMHub;
  applyShowGTMHub(showGTMHub);

  // Apply show-Script-Tree setting (default: true = shown)
  const showScriptTreeCheckbox = document.getElementById('setting-show-script-tree');
  const showScriptTree = settings.showScriptTree !== false;
  if (showScriptTreeCheckbox) showScriptTreeCheckbox.checked = showScriptTree;
  applyShowScriptTree(showScriptTree);

  // Apply show-Cookie-detection setting (default: true = shown)
  const showCookieDetectionCheckbox = document.getElementById('setting-show-cookie-detection');
  const showCookieDetection = settings.showCookieDetection !== false;
  if (showCookieDetectionCheckbox) showCookieDetectionCheckbox.checked = showCookieDetection;
  applyShowCookieDetection(showCookieDetection);

  // Apply show-Consent-Check setting (default: true = shown)
  const showConsentCheckCheckbox = document.getElementById('setting-show-consent-check');
  const showConsentCheck = settings.showConsentCheck !== false;
  if (showConsentCheckCheckbox) showConsentCheckCheckbox.checked = showConsentCheck;
  applyShowConsentCheck(showConsentCheck);

  // Apply show-Consent-Mode-Mismatch-Warning setting (default: true = warn).
  // Sub-feature of Show Consent Check.
  const showConsentMismatchCheckbox = document.getElementById('setting-show-consent-mismatch-warning');
  const showConsentMismatch = settings.showConsentModeMismatchWarning !== false;
  if (showConsentMismatchCheckbox) showConsentMismatchCheckbox.checked = showConsentMismatch;
  applyShowConsentModeMismatchWarning(showConsentMismatch);

  // Apply show-Review-Prompt setting (default: true = enabled). Read at
  // trigger time by review-prompt.js, no body class to apply.
  const showReviewPromptCheckbox = document.getElementById('setting-show-review-prompt');
  if (showReviewPromptCheckbox) {
    showReviewPromptCheckbox.checked = settings.showReviewPrompt !== false;
  }

  // Apply hide developer_id events setting (default: true = hidden)
  const hideDeveloperIdCheckbox = document.getElementById('setting-hide-developerid');
  if (hideDeveloperIdCheckbox) {
    // Default to true (hidden) if not explicitly set
    const hideDeveloperIdEvents = settings.hideDeveloperIdEvents !== false;
    hideDeveloperIdCheckbox.checked = hideDeveloperIdEvents;
    state.hideDeveloperIdEvents = hideDeveloperIdEvents;
  }

  // Apply share-unknown-tracker-hostnames setting (default: true = share, feature #47)
  const shareUnknownCheckbox = document.getElementById('setting-share-unknown-endpoint-hostnames');
  const shareUnknownEnabled = settings.shareUnknownEndpointHostnames !== false;
  state.shareUnknownEndpointHostnames = shareUnknownEnabled;
  if (shareUnknownCheckbox) {
    shareUnknownCheckbox.checked = shareUnknownEnabled;
  }

  // Pinned-view hint bar dismissal — sticky boolean, no UI control (toggled
  // only by the X on the bar itself). Render-time gate in renderPinnedView.
  state.pinnedHintsDismissed = settings.pinnedHintsDismissed === true;

  // Apply correlation window settings
  const correlationStdInput = document.getElementById('setting-correlation-standard');
  const correlationNmInput = document.getElementById('setting-correlation-namematch');
  const correlation = settings.correlation || DEFAULT_SETTINGS.correlation;
  if (correlationStdInput) correlationStdInput.value = correlation.standardWindowMs;
  if (correlationNmInput) correlationNmInput.value = correlation.matchingNameWindowMs;
  state.correlationWindows = {
    standardWindowMs: correlation.standardWindowMs,
    matchingNameWindowMs: correlation.matchingNameWindowMs
  };

  // Initialize analytics first: initAnalytics() migrates the legacy
  // analyticsEnabled opt-out flag, so the checkbox read below can rely on
  // the canonical key alone.
  await _deps.initAnalytics();

  // Apply analytics enabled setting (default: true)
  const analyticsCheckbox = document.getElementById('setting-analytics-enabled');
  if (analyticsCheckbox) {
    const stored = await chrome.storage.local.get('analytics_enabled');
    analyticsCheckbox.checked = stored.analytics_enabled !== false;
  }
  _deps.setAnalyticsLocation('devtool');
  _deps.setDevToolsContext(() => {
    const s = _deps.getState();
    // `view` is the user-facing label: 'stream' / 'tree' / 'stack' / a
    // grouping id (e.g. 'datalayer'). `view_index` is the toolbar position:
    // 0=stream, 1+=position in pinnedGroupings, 100=tree, 101=stack,
    // 99=defensive fallback for an active grouping not in the pinned set.
    let view, view_index;
    if (s.viewMode === 'stream') {
      view = 'stream';
      view_index = 0;
    } else if (s.viewMode === 'tree') {
      view = 'tree';
      view_index = 100;
    } else if (s.viewMode === 'stack') {
      view = 'stack';
      view_index = 101;
    } else {
      const id = s.activeGrouping || 'tool';
      view = id;
      const pinned = Array.isArray(s.pinnedGroupings) ? s.pinnedGroupings : [];
      const idx = pinned.indexOf(id);
      view_index = idx === -1 ? 99 : idx + 1;
    }
    return {
      preset: s.activePresetVisibleTools !== null,
      nested: s.showTriggerCorrelation,
      view,
      view_index,
    };
  });
  _deps.setResolvedThemeGetter(getResolvedTheme);

  // Set initial settings as Amplitude user properties (before devtool_start fires).
  // Every setting toggle we track on-change must also be seeded here so
  // default-state users (who never touch the toggle) are still segmentable
  // in Amplitude. Missing anything here means a cohort of users invisible
  // to any "users with X enabled/disabled" query.
  const prefs = settings.defaultPreferences || {};
  const dlEnabled = Object.values(settings.dataLayer || {}).filter(v => v).length;
  let aiConfigSeed = null;
  try {
    const storage = await chrome.storage.local.get('ai_config');
    aiConfigSeed = storage?.ai_config || null;
  } catch {
    // Fall through — buildAiUserProperties handles null as "not configured"
  }
  _deps.setSettingsUserProperties({
    // Defaults — Stream
    setting_view_mode: prefs.viewMode || 'lastused',
    setting_stream_direction: prefs.streamDirection || 'lastused',
    setting_sort_mode: prefs.sortMode || 'lastused',
    // Defaults — Filters
    setting_scripts: prefs.scripts || 'lastused',
    setting_consent: prefs.consent || 'lastused',
    setting_interactions: prefs.interactions || 'lastused',
    setting_nesting: prefs.nesting || 'lastused',
    setting_toolbar_layout: prefs.filterToolbarCollapsed || 'lastused',
    setting_categories_layout: prefs.categoriesCollapsed || 'lastused',
    // Theme
    setting_theme: getThemePreference(),
    // Data layer
    setting_datalayer_count: dlEnabled,
    // Features toggles (user on/off for whole feature areas — all default true)
    setting_show_ai_features: settings.showAIFeatures !== false,
    setting_ai_redact_pii: settings.aiRedactPii !== false,
    setting_show_gtm_hub: settings.showGTMHub !== false,
    setting_show_script_tree: settings.showScriptTree !== false,
    setting_show_cookie_detection: settings.showCookieDetection !== false,
    setting_show_consent_check: settings.showConsentCheck !== false,
    setting_show_review_prompt: settings.showReviewPrompt !== false,
    // Export & debug
    setting_export_to_file: settings.exportToFile === true,
    setting_export_warning_target: typeof settings.exportWarningTarget === 'string'
      ? settings.exportWarningTarget
      : (settings.exportWarning === false ? 'off' : 'standard'),
    setting_perf_logging: settings.perfLogging === true,
    // Stream behaviour
    setting_hide_developer_id: settings.hideDeveloperIdEvents !== false,
    // Privacy / crowdsourcing (feature #47)
    setting_share_unknown_endpoint_hostnames: settings.shareUnknownEndpointHostnames !== false,
    // Correlation windows
    setting_correlation_standard_window_ms: correlation.standardWindowMs,
    setting_correlation_name_match_window_ms: correlation.matchingNameWindowMs,
    // Derived counts — surface engagement depth without listing identifiers
    setting_presets_count: Array.isArray(settings.presets) ? settings.presets.length : 0,
    setting_highlighted_platforms_count: Array.isArray(settings.highlightedPlatforms)
      ? settings.highlightedPlatforms.length
      : 0,
    // Onboarding progress
    setting_onboarding_completed_version: settings.onboardingCompletedVersion || 0,
    setting_onboarding_extended_completed_version: settings.onboardingExtendedCompletedVersion || 0,
    setting_onboarding_panel_open_count: settings.onboardingPanelOpenCount || 0,
    // AI provider state — derived from chrome.storage.local.ai_config
    ...buildAiUserProperties(aiConfigSeed),
    // Grouped-view lifecycle — one prop per grouping id, derived from
    // (pinnedGroupings, activatedGroupings). Iterated over GROUPINGS so a
    // newly-added grouping automatically gets its user property.
    ...Object.fromEntries(
      GROUPINGS.map(g => [
        `grouped_view_${g.id}`,
        getGroupedViewState(g.id, state.pinnedGroupings, state.activatedGroupings),
      ])
    ),
  });

  // DevTools Discovery Nudge (Feature #49) — flip hasOpenedDevTools on first
  // devtool_start so the sidepanel knows this user no longer needs the nudge.
  // Also stamp lastDevToolsOpenVersion so the version-update banner can detect
  // "the user already reached DevTools on this version" and self-retire.
  try {
    const currentVersion = chrome.runtime.getManifest().version;
    const nudge = await loadNudgeState();
    if (!nudge.hasOpenedDevTools) {
      const firstOpenAt = Date.now();
      await patchNudgeState({
        hasOpenedDevTools: true,
        devToolsFirstOpenAt: firstOpenAt,
        lastDevToolsOpenVersion: currentVersion,
      });
      _deps.setSettingsUserProperties({
        has_used_devtools: true,
        devtools_first_open_at: new Date(firstOpenAt).toISOString(),
      });
    } else {
      if (nudge.lastDevToolsOpenVersion !== currentVersion) {
        await patchNudgeState({ lastDevToolsOpenVersion: currentVersion });
      }
      _deps.setSettingsUserProperties({ has_used_devtools: true });
    }
  } catch (_) { /* non-critical — nudge state is best-effort */ }

  // First event — confirms user opened the Event Watcher DevTools panel
  _deps.trackEvent('devtool_start', {});

  // Initialize preset dropdown and save button
  _deps.updatePresetDropdown();
  _deps.updateSavePresetButton();
}
