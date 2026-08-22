import {
  renderEventList,
  renderToolView,
  renderPageView,
  groupEventsByPage,
  groupEventsByPlatform,
  groupPlatformsByCategory,
  groupPagesByDomain,
  createEventItem,
  ensureEventRowDelegation,
  initEventList
} from './components/event-list.js';
import { renderFlatGroupedView } from './components/grouped-flat-view.js';
import { MSG } from '../shared/messages.js';
import { MAX_EVENTS, computeEvictCount, pruneScriptMaps } from './event-cap.js';
import { escapeHtml } from './escape-html.js';
import {
  GROUPINGS,
  getGrouping,
  getDefaultPinnedGroupings,
  getGroupedViewState,
  isValidGroupingId,
  PINNED_GROUPINGS_VERSION
} from './components/groupings.js';
import { renderEventDetail, initEventDetail } from './components/event-detail.js';
import { isDragging as isSectionDragInFlight } from './components/section-order.js';
import { getPlatformIcon, PLATFORM_ICONS } from './components/platform-icons.js';
import {
  KNOWN_TRACKING_ENDPOINTS,
  PLATFORM_COUNT,
  clearMatchCache,
  setDebugLogging,
  getDebugStats,
  resetDebugStats,
  setExtendedTracking,
  getPlatformColor,
  isPlatformIconVerified,
  PLATFORM_COLOR_CONFIG,
  loadCustomEndpoints,
  getCustomEndpoints,
  matchKnownEndpoint,
  isSameRootDomain
} from './tracking-endpoints.js';
import { hexToRgba, getBadgeTextColor, isLightColor } from './color-utils.js';
import { initAnalytics, trackEvent, setAnalyticsLocation, setDevToolsContext, setResolvedThemeGetter, setBucketGetter, setUserId, setSettingsUserProperties, setAnalyticsSuppressed } from './analytics.js';
import { normalizeToRegistrableDomain, extractHostname, bucketUnknownHosts, truncateHostLabel } from '../shared/detection/url-patterns.js';
import { initTheme, getResolvedTheme, toggleTheme, onThemeChange } from './theme.js';
import {
  loadPinnedState,
  isPinned as isEventPinned,
  togglePin as togglePinnedState,
  getPinnedSnapshotById,
  getPinnedSnapshotByIdAcrossDomains,
  getPinnedRecordsForDomain,
  getGroupsForDomain,
  getGroupById,
  getAllDomainsWithPins,
  createGroup as createPinnedGroup,
  pinEventIntoGroup,
  clearAllPinnedForDomain,
  subscribePinnedState,
  getPinnedCountForDomain,
} from './pinned-state.js';
import { hidePinnedContextMenu } from './components/pinned-context-menu.js';
import {
  initPinnedView,
  renderPinnedView,
  applyPinnedMultiSelectClasses,
  getVisiblePinIdsInDomain,
} from './components/pinned-view.js';
import { showPromptDialog } from './components/confirm-modal.js';

// Import event correlation utilities from shared module
import {
  EVENT_NAME_EQUIVALENTS,
  UNCORRELATABLE_EVENTS,
  GTM_TRIGGER_EVENTS,
  CORRELATION_WINDOW_MS,
  CORRELATION_WINDOW_MATCHING_NAME_MS,
  areEventNamesEquivalent,
  isUncorrelatableEvent,
  isGTMTriggerEvent
} from '../shared/detection/event-equivalents.js';

// Import consent check functions (timeline, classification, cookie reading)
import {
  normalizeGCMToCategories,
  parseOneTrustPushData,
  parseCookieInfoPushData,
  parseUsercentricsData,
  parseDidomiPushData,
  computeConsentCheck,
  assessConsentSeverity,
  isAdvancedConsentMode,
  getRequiredConsentCategory
} from '../shared/detection/parsers/index.js';

// Consent engine (#135 WP3) — pure timeline logic (marker rebuild, detection-path
// reconstruction, sorted insert + scoped cache invalidation) extracted from this
// file so the tests and components import the single implementation directly.
import {
  setConsentEngineDeps,
  insertConsentTimelineEntry,
  rebuildConsentStateMarkers
} from './consent-engine.js';

// Import request handler functions (platform-specific parsers + routing)
import {
  initRequestHandlers,
  routeRequest
} from './request-handlers.js';

// Crowdsourced Unknown Tool Registry (feature #47) — privacy filters and snapshot.
// collectAssumedPairs (feature #70) shares the same privacy floor.
import {
  shouldReportHost,
  applyHostHint,
  collectHostUnknown,
  collectAssumedPairs,
  MAX_UNKNOWN_HOSTS_PER_PAGE
} from './unknown-reporter.js';

// Import copy/export functions
import {
  initCopyExport,
  copyToClipboard,
  copyPageEventsAsTable,
  copyPageEventsAsJSON,
  copyPageEventsWithProperties,
  copyPageFullExport,
  copyDataLayerAsJSON,
  copyEventAsExtended,
  copyEventsAsTable,
  copyEventsAsJSON,
  copyEventsAsProperties,
  copyEventsAsFullExport,
  copyEventAsJSON,
  copyEventWithProperties,
  copyEventConsent,
  buildScriptNodeJSON,
  buildTreeJSON,
  copySelectedBranch,
  copyAllEventsAsTable,
  copyPinnedAsTable,
  copyAllEventsAsJSON,
  copyAllEventsWithProperties,
  copyAllScriptTreeAsJSON,
  copyAllScriptTreeAsMarkdown,
  copyAllFullExport,
  copyAllDataLayerAsJSON,
  copyDataLayerPushesAsJSON,
  showExportFormatsHelp,
  showMartechStackBuilderInfo,
  hasSeenMartechStackInfo,
  markMartechStackInfoSeen,
  // Feature #81 Phase 2 — dev-only AI-export auto-publish (no manual click)
  setAIExportAutoPublish,
  isAIExportAutoPublishEnabled,
  notifyEventListChanged,
} from './copy-export.js';

// Import structural fingerprinting (Smart Unknown Identification)
import { clearFingerprintCache, dismissFingerprint } from '../shared/detection/identify-unknown.js';

// Import script tree rendering
import { initScriptTree, renderScriptTreeView, buildScriptTree } from './components/script-tree.js';

// Import Stack View (#71)
import { initStackView, renderStackView, buildStackGraph, renderBuildingAnimation } from './components/stack-view.js';
import { initStackToolDetail, renderStackToolDetail } from './components/stack-tool-detail.js';
import { initStackExport, buildStackMarkdown, buildStackMermaid, buildStackSvg, buildStackNodeMarkdown, buildStackJSON, downloadString } from './components/stack-export.js';

// Import React Flow export (Labs feature)
import { initReactFlowExport, buildReactFlowJSON } from './reactflow-export.js';

// Import settings module
import {
  initSettings,
  initializeSettings,
  loadSettings,
  saveSettings,
  updateSetting,
  saveLastUsed,
  openSettingsModal,
  closeSettingsModal,
  isConsentModeMismatchWarningEnabled,
  FEATURE_FLAGS
} from './settings.js';
import { loadFeatureFlags } from './feature-flags.js';

// Import help modal
import { initHelpModal, openHelpModal, closeHelpModal } from './components/help-modal.js';
import { initAiModal, openAiModal, closeAiModal } from './components/ai-modal.js';
import { initAiConsentDialog, requestAiConsent } from './components/ai-consent-dialog.js';
import { initAiProviderPanel } from './components/ai-provider-panel.js';
import { initAiUsageTab, refreshAiUsageTab } from './components/ai-usage-tab.js';
import { initAiChatTab, applyChatScope } from './components/ai-chat-tab.js';

// Import responsive toolbar
import { initToolbarResponsive, initFilterBarResponsive } from './components/toolbar-responsive.js';

// Import report modal
import { initReportModal, openReportModal, closeReportModal } from './components/report-modal.js';

// Import filter bar
import {
  initFilterBar,
  CATEGORY_ICONS,
  CATEGORY_ICONS_PATHS,
  renderUnifiedFilterBar,
  renderCollapsedCategoryChips,
  updateFilterToolbarTotalCount,
  toggleFilterToolbarCollapsed,
  updateFilterToolbarCollapsedState,
  collapseAllCategories,
  expandAllCategories,
  showEventTypeContextMenu,
  handleContextMenuAction,
  hidePlatformContextMenu,
  showPlatformContextMenu,
  updateScriptsFilterUI,
  updateConsentFilterUI,
  updateInteractionsFilterUI,
  showOnlyPlatform,
  hideToolFromContextMenu,
  toggleHighlightPlatform,
  clearAllHighlights,
  showOnlyCategory,
  toggleHighlightCategory
} from './components/filter-bar.js';

// Import smart search
import {
  initSmartSearch,
  handleSmartSearchInput,
  clearSmartSearch,
  getCurrentParsedSearch,
  eventMatchesSmartSearch,
  syncToolChipsWithFilteredEvents
} from './components/smart-search.js';

// Import context menus
import {
  initContextMenus,
  getContextMenuScriptTree,
  getContextMenuScriptEventId,
  showPageContextMenu,
  hidePageContextMenu,
  showScriptTreeContextMenu,
  hideScriptTreeContextMenu,
  showGroupContextMenu,
  hideGroupContextMenu,
  showInteractionContextMenu,
  hideInteractionContextMenu,
  hideExportContextMenu
} from './components/context-menus.js';

// Import preset manager
import {
  initPresetManager,
  updateSavePresetButton,
  updatePresetDropdown,
  updatePresetDropdownLabel,
  closePresetDropdown
} from './components/preset-manager.js';

// Import tools modal
import {
  initToolsModal,
  openToolsModalForCustomEndpoint as _openToolsModalForCustomEndpoint,
  openSupportedToolsModalDefault,
  closeSupportedToolsModal
} from './components/tools-modal.js';

// Import GTM Hub Modal
import { initGTMModal, openGTMModal, closeGTMModal, updateGTMButtonState } from './components/gtm-modal.js';
import { matchesDomain } from './components/gtm-intercept.js';

// Platform display names - derived from KNOWN_TRACKING_ENDPOINTS shortName field
// (Previously loaded from platform-names.js, now uses shared registry)
// PLATFORM_NAMES = the compact, scan-optimised label (shortName). Used in the
// filter chips AND the event-stream rows (#149) — the single source both
// surfaces resolve from, so a tool reads the same everywhere.
// PLATFORM_FULL_NAMES = the full, formal label (name). Reserved for surfaces
// with room to breathe: the About <Tool> section, the tool-list modal, and the
// filter-chip hover tooltip (#149).
const PLATFORM_NAMES = {};
const PLATFORM_FULL_NAMES = {};
for (const endpoint of KNOWN_TRACKING_ENDPOINTS) {
  PLATFORM_NAMES[endpoint.id] = endpoint.shortName || endpoint.name;
  PLATFORM_FULL_NAMES[endpoint.id] = endpoint.name || endpoint.shortName || endpoint.id;
}

/**
 * Get push index for stable sorting of dataLayer events with same timestamp
 * @param {Object} event - Event object
 * @returns {number} Push index or 0 if not available
 */
function getPushIndex(event) {
  return event.formatted?.pushIndex || event.raw?._pushIndex || 0;
}

/**
 * Compare two events for sorting ascending, using pushIndex as secondary key for same timestamps
 * @param {Object} a - First event
 * @param {Object} b - Second event
 * @returns {number} Comparison result for sort
 */
function compareEventsAsc(a, b) {
  if (a.timestamp !== b.timestamp) {
    return a.timestamp - b.timestamp;
  }
  return getPushIndex(a) - getPushIndex(b);
}

/**
 * Compare two events for sorting descending, using pushIndex as secondary key
 * @param {Object} a - First event
 * @param {Object} b - Second event
 * @returns {number} Comparison result for sort
 */
function compareEventsDesc(a, b) {
  if (a.timestamp !== b.timestamp) {
    return b.timestamp - a.timestamp;
  }
  return getPushIndex(b) - getPushIndex(a);
}

/**
 * Inject dynamic CSS for platform colors
 * Generates CSS variables and platform-specific styles from PLATFORM_COLOR_CONFIG
 * This ensures filter-chips and event badges use consistent colors from a single source
 */
function injectPlatformStyles() {
  // Remove existing styles if present (allows re-injection after custom endpoint changes)
  const existing = document.getElementById('platform-colors');
  if (existing) existing.remove();

  const styleEl = document.createElement('style');
  styleEl.id = 'platform-colors';

  let css = ':root {\n';

  // Generate CSS variables for each platform
  Object.entries(PLATFORM_COLOR_CONFIG).forEach(([id, config]) => {
    css += `  --platform-${id}: ${config.brand};\n`;
    css += `  --platform-${id}-text: ${config.text};\n`;
    css += `  --platform-${id}-text-dark: ${config.textDark || config.text};\n`;
    css += `  --platform-${id}-bg: ${hexToRgba(config.brand, config.bgOpacity)};\n`;
    css += `  --platform-${id}-badge-text: ${getBadgeTextColor(config.brand)};\n`;
  });

  // Aliases used by static CSS
  css += `  --datalayer-color: var(--platform-datalayer);\n`;
  css += `  --gtm-color: var(--platform-gtm);\n`;
  css += `  --gtag-color: var(--platform-gtag);\n`;
  css += `  --ga4-color: var(--platform-ga4);\n`;
  css += `  --amplitude-color: var(--platform-amplitude);\n`;

  css += '}\n\n';

  // Generate filter-chip active styles - brand color for border, icon, and counter only
  // Background stays white, text stays black to keep filter area clean
  Object.keys(PLATFORM_COLOR_CONFIG).forEach(id => {
    css += `.filter-chip.active[data-platform="${id}"] {\n`;
    css += `  border-color: var(--platform-${id});\n`;
    css += `}\n`;
    css += `.filter-chip.active[data-platform="${id}"] .filter-chip-icon { color: var(--platform-${id}) !important; }\n`;
    css += `.filter-chip.active[data-platform="${id}"] .filter-chip-count {\n`;
    css += `  background-color: var(--platform-${id});\n`;
    css += `  color: var(--platform-${id}-badge-text);\n`;
    css += `}\n\n`;
  });

  // Generate event-platform badge styles for all platforms (consistent light-background pattern)
  // Uses attribute selector [data-platform] instead of class selector to handle IDs starting with digits (e.g. "1st-party-proxy")
  // Dark-mode override uses --platform-{id}-text-dark so registry textColor overrides
  // (e.g. black-on-yellow for Snapchat) don't paint unreadable text on the dark badge bg.
  Object.keys(PLATFORM_COLOR_CONFIG).forEach(id => {
    css += `.event-platform[data-platform="${id}"] {\n`;
    css += `  background-color: var(--platform-${id}-bg);\n`;
    css += `  color: var(--platform-${id}-text);\n`;
    css += `  border: 1px solid var(--platform-${id});\n`;
    css += `}\n`;
    css += `[data-theme="dark"] .event-platform[data-platform="${id}"] {\n`;
    css += `  color: var(--platform-${id}-text-dark);\n`;
    css += `}\n`;
  });

  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}

// Inject platform styles immediately
injectPlatformStyles();

// Platform categories for grouping in filter UI
const PLATFORM_CATEGORIES = {
  'data-layer': {
    name: 'Data Layer',
    shortName: 'dL',
    icon: 'layers',
    itemLabel: 'methods',  // Show "X methods" instead of "X tools"
    description: 'Client-side data structures set by the website. These exist independently of any tag manager and are detected via JavaScript interception.'
  },
  'tag-manager': {
    name: 'Tag Managers',
    shortName: 'TMS',
    icon: 'tag',
    description: 'Platforms that manage and deploy tracking scripts, pixels, and tags from a single interface without code changes.'
  },
  'first-party-collection': {
    name: '1st Party Collection',
    shortName: '1P',
    icon: 'server',
    description: 'Server-side data collection where tracking is routed through your own domain, improving data accuracy and bypassing ad blockers.'
  },
  'analytics': {
    name: 'Analytics',
    shortName: 'Analytics',
    icon: 'chart',
    description: 'Tools that measure website traffic, user behavior, and engagement to provide insights into site performance.'
  },
  'cdp': {
    name: 'Customer Data Platforms',
    shortName: 'CDP',
    icon: 'database',
    description: 'Platforms that unify customer data from multiple sources to create comprehensive user profiles for personalization and activation.'
  },
  'ab-testing': {
    name: 'A/B Testing',
    shortName: 'A/B',
    icon: 'split',
    description: 'Experimentation platforms that test variations of pages, features, or content to optimize conversion rates and user experience.'
  },
  'advertising': {
    name: 'Advertising',
    shortName: 'Ads',
    icon: 'megaphone',
    description: 'Ad platforms and networks that serve, target, and measure digital advertising campaigns across channels.'
  },
  'marketing-automation': {
    name: 'Marketing Automation',
    shortName: 'MA',
    icon: 'mail',
    description: 'Email, push notifications, and customer engagement platforms that automate marketing workflows and communications.'
  },
  'ad-tech': {
    name: 'Ad Tech',
    shortName: 'AdTech',
    icon: 'zap',
    description: 'Infrastructure for programmatic advertising including DSPs, SSPs, DMPs, header bidding, and ad verification services.'
  },
  'session-replay': {
    name: 'Session Replay',
    shortName: 'Session',
    icon: 'video',
    description: 'Tools that record and replay user sessions, capturing mouse movements, clicks, and scrolling to understand user behavior.'
  },
  'video': {
    name: 'Video Analytics',
    shortName: 'Video',
    icon: 'play',
    description: 'Platforms that track video engagement, player performance, and viewer behavior across streaming and embedded content.'
  },
  'consent': {
    name: 'Consent Platforms',
    shortName: 'Consent',
    icon: 'shield',
    description: 'Cookie consent and privacy management tools that handle GDPR, CCPA, and other privacy regulation compliance.'
  },
  'widgets': {
    name: 'Widgets',
    shortName: 'Widgets',
    icon: 'puzzle',
    description: 'Embedded third-party components like chat widgets, social sharing buttons, surveys, and interactive elements.'
  },
  'monitoring': {
    name: 'Monitoring',
    shortName: 'Monitor',
    icon: 'alert',
    description: 'Application performance monitoring, error tracking, and real user monitoring tools that ensure site reliability.'
  },
  'unknown': {
    name: 'Unknown',
    shortName: '?',
    icon: 'more',
    description: 'Tracking requests that could not be matched to a known platform or category.'
  }
};

// Platform-to-category lookup, consent category overrides, and consent exclusion patterns
const platformToCategory = {};
const platformConsentCategory = {};  // Per-platform consent category override (e.g., marketing CDPs)
const platformConsumesGCM = {};      // Platforms that read Google Consent Mode signals (Google products)
const platformExcludePatterns = {};
for (const endpoint of KNOWN_TRACKING_ENDPOINTS) {
  platformToCategory[endpoint.id] = endpoint.category || 'unknown';
  if (endpoint.consentCategory) {
    platformConsentCategory[endpoint.id] = endpoint.consentCategory;
  }
  if (endpoint.consumesGCM) {
    platformConsumesGCM[endpoint.id] = true;
  }
  if (endpoint.excludeConsentCheck) {
    platformExcludePatterns[endpoint.id] = endpoint.excludeConsentCheck;
  }
}
// 'other' = unrecognized tracking requests
platformToCategory['other'] = 'unknown';

// All available platforms (derived from tracking-endpoints.js)
const ALL_PLATFORMS = Object.keys(platformToCategory);

// All category IDs
const ALL_CATEGORIES = Object.keys(PLATFORM_CATEGORIES);

// Short param suffixes for per-category tracking in devtool_page event
const CATEGORY_PARAM_NAMES = {
  'data-layer': 'dl',
  'tag-manager': 'tms',
  'first-party-collection': '1p',
  'analytics': 'analytics',
  'cdp': 'cdp',
  'ab-testing': 'ab',
  'advertising': 'ads',
  'marketing-automation': 'ma',
  'ad-tech': 'adtech',
  'session-replay': 'session',
  'video': 'video',
  'consent': 'consent',
  'widgets': 'widgets',
  'monitoring': 'monitor'
};

// Get all platforms for a category (derived from platformToCategory map)
// Uses Object.keys(platformToCategory) instead of ALL_PLATFORMS so that
// dynamically registered custom tool IDs are included.
function getPlatformsForCategory(categoryId) {
  return Object.keys(platformToCategory).filter(p => platformToCategory[p] === categoryId);
}

/**
 * Register custom "new tool" endpoints in panel-level lookup maps.
 * Called after loadCustomEndpoints() so that category, color/CSS, icon, and name
 * all work for user-created tools (e.g. "custom-1234567890").
 */
function refreshCustomEndpointRegistrations() {
  const customs = getCustomEndpoints();
  for (const ep of customs) {
    if (ep.mode === 'new' && ep.id) {
      // Category lookup
      platformToCategory[ep.id] = ep.category || 'unknown';
      // Display name. Custom endpoints have no shortName, so the short and full
      // maps both fall back to ep.name (#149) — keeps the filter-chip tooltip in
      // parity with built-in tools instead of showing an empty hover.
      PLATFORM_NAMES[ep.id] = ep.name || ep.id;
      PLATFORM_FULL_NAMES[ep.id] = ep.name || ep.id;
      // Letter-avatar icon
      const letter = (ep.name || '?').charAt(0).toUpperCase();
      const color = ep.color || '#607d8b';
      PLATFORM_ICONS[ep.id] = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${color}"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${letter}</text></svg>`;
      // Enable in filters by default (so custom tools appear in the filter bar)
      if (state && state.filters && !state.filters.platforms.includes(ep.id)) {
        state.filters.platforms.push(ep.id);
      }
    }
  }
  // Re-inject dynamic CSS so new custom tool colors are applied to badges/chips
  injectPlatformStyles();
}

// Data Layer platforms - these are the "trigger" events that cause tracking tags to fire
// These are client-side data structures set by the website (not Tag Manager internal events)
const DATA_LAYER_PLATFORMS = getPlatformsForCategory('data-layer');

// Consent platforms - tools in the "consent" category (Cookiebot, OneTrust, etc.)
const CONSENT_PLATFORMS = getPlatformsForCategory('consent');

// Performance measurement stats (lightweight counters only, no arrays)
let perfStats = {
  totalMatchTimeMs: 0,
  requestCount: 0,
  matchCount: 0,
  matchedTools: new Set(), // Track unique tools that matched
  totalToolCount: PLATFORM_COUNT
};
let pageLoadStats = null; // Frozen snapshot at page load complete
let pageLoadComplete = false;
let loadCompleteTimer = null;

// Extended performance logging - ephemeral, not persisted (resets on panel close/reload)
let extendedPerfLogging = false;

// State management
const state = {
  events: [],
  selectedEventId: null,
  filters: {
    search: '',
    platforms: [...ALL_PLATFORMS], // Array of enabled platforms
    categories: [...ALL_CATEGORIES], // Array of enabled categories (all enabled by default)
    // Event type toggles (how events are captured, not what tool)
    // Scripts: 3-state 'auto' | 'only' | 'hide'
    //   auto: follow tool visibility, only: show only scripts, hide: hide all scripts
    // Consent: 4-state 'auto' | 'only' | 'hide' | 'off'
    //   auto: follow tool visibility + show violation badges, only: show consent-annotated events, hide: hide consent events (violations still tracked), off: all consent features disabled
    eventTypes: {
      tracking: true,    // Network tracking requests (beacons, pixels, API calls)
      scripts: 'auto',   // Script/library load events (.js files) - 3-state
      consent: 'auto',   // Consent-related events - 4-state
      interactions: true  // Interaction events (user clicks, changes, submits) - boolean show/hide
    }
  },
  // Track recent Data Layer events for correlation (triggers that cause tags to fire)
  recentDataLayerEvents: [],
  // Track event counts per platform
  platformCounts: {},
  // Track event counts per category
  categoryCounts: {},
  // Per-platform consent severity counts — feeds the warning pill on each
  // tool chip (feature #73). Shape: { [platformId]: { denied, warning } }.
  // Built by updateConsentCounter() (which already iterates state.events
  // for the session counter) and consumed by filter-bar.js when rendering
  // .tool-chip-warning-count. Reset by clearEvents.
  platformConsentCounts: {},
  // Track all platforms that have been detected (persists even after hiding)
  detectedPlatforms: new Set(),
  // Hostnames of unknown trackers seen during the current page load (feature #47).
  // Snapshotted into the tools_unknown property on devtool_page; reset by clearEvents.
  unknownHosts: new Set(),
  // Per-host bucketing of unrecognised ('other') events for the self-describing
  // Unknown filter chips (feature #151). Recomputed each render by
  // updateUnknownHostBuckets() from the current event set. Shape:
  // { chips: [{ host, count }], othersCount }. Reset by clearEvents.
  unknownHostBuckets: { chips: [], othersCount: 0 },
  // The set of unknown hostnames currently surfaced as their own filter chip
  // (the top-N from unknownHostBuckets). getFilteredEvents() consults it to
  // decide whether an unknown event filters under its own `other:<host>` id or
  // the `other:__others__` overflow id. Reset by clearEvents.
  unknownTopHosts: new Set(),
  // Hostnames where Stape Data Tag traffic has been detected this session — used by
  // the cross-event "via Stape" annotation (feature #65). Set when a request matches
  // the stape-data-tag structural fingerprint; consulted when classifying sgtm
  // events on the same first-party host. Reset by clearEvents.
  stapeHosts: new Set(),
  // Track hidden tools (tools the user has clicked to hide)
  hiddenTools: [],
  // Current page hostname (for first-party/CNAME detection)
  currentPageHostname: '',
  cookieStoreId: null, // Tab's cookie store ID (for incognito-aware cookie reading)
  // Data Layer trigger correlation toggle (enabled by default)
  showTriggerCorrelation: true,
  // Capture state: 'play' (recording), 'pause' (paused, resumes on nav), 'stop' (stopped, stays stopped)
  captureState: 'play',
  // Sort mode: 'start' (when request began) or 'finish' (when request completed)
  sortMode: 'start',
  // Collapsed page groups (by navigation event ID) - pages are expanded by default
  collapsedPageGroups: new Set(),
  // Stream direction: 'newest-top' (newest events at top) or 'newest-bottom' (newest at bottom, chronological)
  streamDirection: 'newest-top',
  // Highlighted platforms (for visual emphasis in event stream) - Set of platform IDs
  highlightedPlatforms: new Set(),
  // Active preset ID (null if no preset active)
  activePresetId: null,
  // Whitelist of visible tools when a preset is active (null if no preset)
  // When set, ONLY these tools are shown - all others are hidden
  activePresetVisibleTools: null,
  // Original tools from the saved preset (for detecting changes)
  activePresetOriginalTools: null,
  // Original filter states from the saved preset (for detecting changes)
  activePresetOriginalFilters: null,
  // Original nesting state from the saved preset (for detecting changes)
  activePresetOriginalNesting: null,
  // Current view mode: 'stream' | 'grouped' | 'tree' | 'stack' | 'pinned'
  // The legacy 'tools' / 'pages' values are migrated to viewMode='grouped'
  // with activeGrouping='tool'/'page' in loadSettings().
  viewMode: 'stream',
  // ----- Stream-view multi-select (Feature #45 follow-up) -----
  // Set of event ids the user has multi-selected via Shift / Ctrl-click.
  // Used by the Pin filtered toolbar button — when this set is non-empty,
  // the bulk-pin action targets the selection instead of the full filtered
  // event set. Plain click on a row resets the set to that single id.
  streamSelectedEventIds: new Set(),
  // Anchor row for Shift-click range selection — the most recently
  // single-clicked event id. Updated on every plain or Ctrl-click; left
  // alone on Shift-click so a chain of Shift-clicks all extend from the
  // same anchor.
  streamSelectionAnchor: null,
  // Running total of events evicted by the MAX_EVENTS cap (#131 F5).
  // Drives the "stream trimmed" banner; reset by clearEvents().
  trimmedEventCount: 0,
  // ----- Pinned-view multi-select -----
  // Mirrors the Stream-view pattern but scoped to a single domain at a
  // time (drag-and-drop already enforces same-domain moves; selecting
  // across domains has no useful action). Switching the clicked row to
  // a different domain resets the selection to that domain.
  pinnedSelectedEventIds: new Set(),
  pinnedSelectionAnchor: null,
  pinnedSelectionDomain: null,
  // ----- Pinned view state (Feature #45) -----
  // Sort mode for the Pinned view. Cycles via the pinned-sort-toggle button.
  // Mirrors the Stream view's Start/Finish/Index modes plus an extra "pinned"
  // (recently-pinned) mode. Default is 'index' so the natural reading order
  // (#1 = first captured) matches the Stream view (BUG52).
  pinnedSortMode: 'index', // 'start' | 'finish' | 'index' | 'pinned'
  // Direction for the Pinned view sort, orthogonal to the mode (mirrors the
  // Stream view's stream-direction-btn). 'newest-bottom' = ascending (oldest /
  // first at top, #1 = earliest); 'newest-top' = descending. Default ascending.
  pinnedSortDirection: 'newest-bottom', // 'newest-top' | 'newest-bottom'
  // Per-domain collapse state for the Stack-style multi-domain layout.
  // The currently-inspected domain is auto-expanded on first render; the
  // user can collapse/expand any domain after that.
  pinnedDomainsCollapsed: new Set(),
  // Per-group collapse state. Keyed as `<domain>::<groupId>` (where
  // groupId is 'inbox' for the implicit Inbox group).
  pinnedGroupsCollapsed: new Set(),
  // Selected tool node in Stack view — mutually exclusive with selectedEventId.
  // Carries a (domain, platformId) tuple so we know which domain's
  // graph the selected tool belongs to (multi-domain Stack support).
  // Cleared by clearEvents.
  selectedTool: null, // { domain: eTLD+1, platformId } | null
  // Per-domain graph cache, keyed on eTLD+1. Built on demand when the
  // user clicks Generate / Refresh for that domain. Stacks for
  // previously-visited domains stay cached so users can revisit them
  // by expanding a collapsed domain header — cross-domain navigation
  // never wipes existing stacks. Cleared by clearEvents.
  stackGraphs: new Map(),
  // UI collapse state for stack domain headers, keyed on eTLD+1.
  // When the user navigates cross-domain, the previous domain is
  // auto-collapsed so the new domain takes focus.
  collapsedStackDomains: new Set(),
  // UI collapse state for individual stack groups (TMS / parent platforms),
  // keyed on "<domain>|<platformId>". Lets users collapse a noisy branch
  // without losing the rest of the tree. Cleared by clearEvents.
  collapsedStackGroups: new Set(),
  // Active grouping pivot inside Grouped view (one of GROUPINGS ids).
  // Only meaningful when viewMode === 'grouped'.
  activeGrouping: 'tool',
  // Pinned grouping pivots shown as chips in the Grouped zone of the
  // view-mode toolbar. Persisted in settings.pinnedGroupings.
  pinnedGroupings: getDefaultPinnedGroupings(),
  // Append-only list of grouping ids the user has ever activated by
  // clicking. Backs `grouped_view_<id>` Amplitude user properties so we
  // can segment by lifecycle ('never_used' | 'pinned' | 'unpinned').
  // Hydrated from settings.lastUsed.activatedGroupings on init.
  activatedGroupings: [],
  // Collapsed groups in the flat grouped renderer (event_name, consent_category).
  // Keyed by `${grouping.id}:${groupKey}` so different pivots don't collide.
  collapsedGroupedGroups: new Set(),
  // Collapsed domains (by hostname) for Page View
  collapsedDomains: new Set(),
  // Collapsed category groups (by category ID) for Tool View
  collapsedCategoryGroups: new Set(),
  // Collapsed tool groups (by platform ID) for Tool View
  collapsedToolGroups: new Set(),
  // Collapsed script groups (by event ID) for Script Tree View
  collapsedScriptGroups: new Set(),
  // Script view "cleared" flag — toolbar Clear sets it true so the renderer
  // shows the empty state until Refresh rebuilds. Mirrors Stack View's
  // generate/clear semantics where the cached graph is dropped on Clear and
  // rebuilt on Refresh. Does NOT purge captured events.
  scriptTreeCleared: false,
  // Collapsed category frames (categories with many tools that user collapsed to one row)
  collapsedCategoryFrames: new Set(),
  // Whether the entire filter toolbar is collapsed to a single row
  filterToolbarCollapsed: false,
  // Tool search query (filters visible tools in filter section, does NOT filter events)
  toolSearchQuery: '',
  // Hide developer_id events (set commands from CMPs/vendors) - loaded from settings
  hideDeveloperIdEvents: true,
  // Pinned-view onboarding hint bar dismissed (drag/multi-select teaser).
  // Loaded from settings; flipped true when user clicks the X on the bar.
  pinnedHintsDismissed: false,
  // Crowdsource unknown tracker hostnames via tools_unknown property (feature #47) - loaded from settings
  shareUnknownEndpointHostnames: true,
  // Consent timeline — append-only, sorted by timestamp, tracks consent state over time
  consentTimeline: [],
  // Earliest consent signal timestamp (for pre-consent detection)
  firstConsentTimestamp: null,
  // Detected CMP info (for display in consent section)
  detectedCMP: null,
  // Consent cookie state (parsed from chrome.cookies)
  consentCookieState: null,
  // Consent state markers — derived from consentTimeline, interleaved in event stream
  consentStateMarkers: [],
  // Session-level consent severity behind the toolbar counter pill:
  // 'denied' | 'warning' | null, plus the combined count. Written by
  // updateConsentCounter(); read by filter-bar's collapsed consent chip.
  // (Declared here since #135 WP1 - previously assigned without declaration.)
  consentSeverity: null,
  consentSeverityCount: 0,
  // GTM containers detected on current page (Set of container IDs like 'GTM-XXXXX')
  detectedGTMContainers: new Set(),
  // Correlation time windows (loaded from settings, used by findTriggeringDataLayerEvent)
  correlationWindows: null,
};

// Script initiator relationship tracking (always-on, built passively)
// Maps script URL -> initiator info for building script tree
const scriptInitiatorMap = new Map(); // scriptUrl -> { type, initiatorUrl, initiatorEventId }
// Maps script URL -> array of child script URLs
const scriptChildrenMap = new Map();  // scriptUrl -> [childUrl1, childUrl2, ...]
// Maps script URL -> event ID for jump-to-event links
const scriptUrlToEventId = new Map(); // scriptUrl -> eventId

// Tealium tag UID → vendor info mapping (populated from Tealium Collect loader.cfg)
// Used to enrich utag.XXX.js script load events with vendor names at render time
const tealiumTagConfig = new Map(); // tagUid -> { tid, vendorCompact, confidence, evidence, platformId }

// Ignored endpoints — persisted in chrome.storage.local, used to hide unknown events the user doesn't care about
const ignoredEndpoints = new Set(); // Set of "hostname/path" strings

// Initialize extracted modules with dependencies (function declarations are hoisted)
initRequestHandlers({
  addEvent,
  scriptInitiatorMap,
  scriptChildrenMap,
  scriptUrlToEventId,
  tealiumTagConfig,
  scheduleRender,
  getCurrentPageHostname: () => state.currentPageHostname,
  PLATFORM_NAMES,
  getPlatformCategory: (platformId) => {
    const ep = KNOWN_TRACKING_ENDPOINTS.find(e => e.id === platformId);
    return ep?.category || 'analytics';
  },
  // URL → platform-id resolver — used by parseAdobeAEPRequest to map
  // audience-activation destination URLs returned by the Edge Network
  // to platform-ids (so e.g. a Floodlight notification URL resolves to
  // `google-floodlight`). Same matcher the panel uses for incoming
  // request routing; passing it through deps keeps the parser shared-
  // layer-clean.
  matchKnownEndpoint,
  // Feature #47: collect unknown tracker hostnames for the tools_unknown property.
  // Hard-capped per page load to keep payload size bounded. Privacy filtering
  // (shouldReportHost) runs on the bare host; once accepted, applyHostHint()
  // (Feature #69) optionally enriches the value with the first path segment for
  // allow-listed multi-purpose hosts (e.g. www.googletagmanager.com/td) so
  // /platform-discover can tell which path is unmatched.
  addUnknownHostname: (host, pathname) => {
    if (state.unknownHosts.size >= MAX_UNKNOWN_HOSTS_PER_PAGE) return;
    if (shouldReportHost(host, state.currentPageHostname, getCustomEndpoints(), ignoredEndpoints)) {
      state.unknownHosts.add(applyHostHint(host, pathname));
    }
  },
  // Feature #65: cross-event "via Stape" annotation. We record both:
  //  - Request hosts that match a Stape signal (fingerprint hit OR a known *.stape.{io,be,dog}
  //    proxy domain), via recordStapeHost()
  //  - The page hostname when ANY Stape signal appears on that page, via recordStapePage().
  // isStapeHost() then resolves a request host to "Stape" if it matches a known proxy TLD,
  // is in the recorded set, or shares a root domain with any recorded host (so an sgtm
  // event on `analytics.brand.com` gets annotated when `brand.com` was flagged via a
  // *.stape.dog / *.stape.be call earlier in the same session).
  recordStapeHost: (host) => {
    if (host) state.stapeHosts.add(host.toLowerCase());
  },
  recordStapePage: (pageHostname) => {
    if (pageHostname) state.stapeHosts.add(pageHostname.toLowerCase());
  },
  isStapeHost: (host) => {
    if (!host) return false;
    const lower = host.toLowerCase();
    // Known Stape proxy TLDs (broaden cautiously when a new TLD is observed)
    if (/(^|\.)stape\.(io|be|dog)$/.test(lower)) return true;
    // Direct match in the session-scoped recorded set
    if (state.stapeHosts.has(lower)) return true;
    // Same-root-domain match — annotates sgtm events on subdomains of a Stape-flagged page
    for (const recorded of state.stapeHosts) {
      if (isSameRootDomain(lower, recorded)) return true;
    }
    return false;
  }
});

initCopyExport({
  getState: () => state,
  getFilteredEvents,
  getEventsForExport,
  getPinnedSnapshotById,
  getPinnedSnapshotByIdAcrossDomains,
  getCurrentPinDomain,
  getPinnedRecordsForDomain,
  getGroupsForDomain,
  getPageEvents,
  getCategoryInfo,
  getCategoryForPlatform,
  PLATFORM_CATEGORIES,
  PLATFORM_NAMES,
  compareEventsAsc,
  getContextMenuScriptTree,
  getContextMenuScriptEventId,
  getConsentCheckForEvent,
  isConsentCheckEnabled,
  getGCMCategoriesAtTime,
  getConsentTimeline: () => state.consentTimeline,
  getConsentStateMarkers: () => state.consentStateMarkers,
  // Feature #87 — snapshot of unknown tracker hostnames for the AI export's
  // `tools_unknown_hostnames` field. Same privacy gate as the Amplitude
  // `tools_unknown` telemetry: omits when the user turned off
  // `shareUnknownEndpointHostnames`.
  getUnknownHostnames: () => state.shareUnknownEndpointHostnames !== false
    ? collectHostUnknown(state.unknownHosts)
    : [],
  // Feature #94 — snapshot of structural-fingerprint `"<platformId> | <hostname>"`
  // pairs for the AI export's `tools_assumed` field. Mirrors the args used for
  // the Amplitude `devtool_page.tools_assumed` property so the bridge payload
  // and the telemetry property carry the same set per page load.
  getAssumedPairs: () => collectAssumedPairs(
    state.events,
    state.currentPageHostname,
    getCustomEndpoints(),
    ignoredEndpoints,
    { includeHosts: state.shareUnknownEndpointHostnames !== false }
  ),
});

initReactFlowExport({
  getFilteredEvents,
  getCategoryForPlatform,
  PLATFORM_CATEGORIES,
});

// Consent engine (#135 WP3): live-state accessors so components can call
// reconstructConsentPath(event) without importing panel.js.
setConsentEngineDeps({
  getConsentTimeline: () => state.consentTimeline,
  getFirstConsentTimestamp: () => state.firstConsentTimestamp,
  getEvents: () => state.events,
  getCategoryForPlatform: (pid) => platformToCategory[pid] || 'unknown',
});

initScriptTree({
  getCollapsedScriptGroups: () => state.collapsedScriptGroups,
  tealiumTagConfig,
  updateExpandCollapseButtonState,
  render,
  escapeHtml
});

// Event detail view (#143): inject the coordinator concerns the detail view
// needs (state reads, modal actions, state mutations) as one explicit deps
// object instead of the prior 15-symbol back-import from panel.js (one of the
// 15, isConsentCheckEnabled, was a dead import and was dropped — 14 wired here).
// Init-time wiring — not per-render — because event-detail.js also exports
// createAboutToolSection, consumed by stack-tool-detail.js outside the
// renderEventDetail path. All callees are hoisted function declarations, so
// forward references resolve.
initEventDetail({
  getCategoryInfo,
  getInitiatorPlatformInfo,
  getScriptsLoadedBy,
  getPageHostname,
  openReportModalForEvent,
  openReportModalForConsent,
  ignoreEndpoint,
  getTealiumVendorInfo,
  openToolsModalForCustomEndpoint,
  getConsentCheckForEvent,
  getConsentFilterMode,
  getGCMCategoriesAtTime,
  dismissFingerprintSuggestion,
  setEventComment
});

// Event list view (#143): same deps-injection seam as the detail view. Seven
// coordinator concerns (Tealium vendor lookup, consent reads, pin state, multi-
// selection) replace the back-import from panel.js — the eighth imported symbol,
// isConsentCheckEnabled, was a dead import in both components and was dropped.
initEventList({
  // #149: stream rows resolve their badge label from the same shortName map the
  // filter chips use, so a tool reads identically in both surfaces.
  PLATFORM_NAMES,
  getTealiumVendorInfo,
  getConsentCheckForEvent,
  getConsentFilterMode,
  isEventPinnedForCurrentDomain,
  togglePinForEvent,
  isPartOfStreamMultiSelection,
  togglePinForMultiSelection
});

// Stack View (#71) — toolbox modules wired together. Module deps are
// resolved as forward-references via getter functions where the source
// (handleViewModeChange, getConsentCheckForEvent, etc.) is hoisted later
// in this file. The init pattern matches initScriptTree above.
initStackExport({
  getPlatformName: (id) => PLATFORM_NAMES[id] || id,
  getPlatformCategory: (id) => platformToCategory[id] || 'unknown',
  PLATFORM_CATEGORIES,
});
initStackView({
  getPlatformName: (id) => PLATFORM_NAMES[id] || id,
  getPlatformCategory: (id) => platformToCategory[id] || 'unknown',
  PLATFORM_CATEGORIES,
  getCurrentPageHostname: () => state.currentPageHostname,
  // Tealium Collect's loader.cfg payload maps utag.N.js tag UIDs to
  // specific vendor platforms. When present, this is a definitive
  // attribution source — every utag.N.js script-load is the Tealium
  // wrapper that loaded that exact vendor on this site.
  getTealiumTagConfig: () => tealiumTagConfig,
  // Reverse-direction signal: parent script URL → child script URLs.
  // Used as a confirmation/fill-in when a child's own initiator data
  // doesn't resolve a parent.
  getScriptChildrenMap: () => scriptChildrenMap,
  // URL → platform-id resolver. Used by Stack View attribution to
  // identify cookie-sync iframes / user-match relays / pre-hook script
  // loads whose URL hostname names a tracked platform but whose
  // request shape we never captured as its own event. Without this,
  // chain walks dead-end on iframe URLs and fall through to
  // page-source even when the URL unambiguously identifies the loader.
  matchKnownEndpoint,
  escapeHtml,
  trackEvent,
});
initStackToolDetail({
  getPlatformName: (id) => PLATFORM_NAMES[id] || id,
  getPlatformCategory: (id) => platformToCategory[id] || 'unknown',
  PLATFORM_CATEGORIES,
  getConsentTimeline: () => state.consentTimeline,
  getConsentCheckForEvent: (ev) => getConsentCheckForEvent(ev),
  getEventById: (id) => state.events.find(e => e.id === id) || null,
  onJumpToStream: (platformId) => handleStackJumpToStream(platformId),
  onJumpToStreamForEventName: (platformId, eventName) => {
    // Quick-filter: jump to Stream filtered to this tool, with the
    // event name pre-populated in the global search box. Mirrors the
    // gesture used by the Top event-name rows in the Stack View tool
    // detail pane.
    if (eventName) {
      state.filters.search = eventName;
      if (elements.searchInput) elements.searchInput.value = eventName;
    }
    handleStackJumpToStream(platformId);
  },
  onJumpToToolView: (platformId) => handleStackJumpToToolView(platformId),
  onSelectTool: (platformId) => {
    // The detail-pane callback only knows the platform; the domain is
    // implicit (the user is already viewing a tool inside one). Pull
    // the current domain off `state.selectedTool` so the Stack-position
    // tree links navigate within the same domain graph. `source: null`
    // resets any per-source shadow scoping when switching tools.
    const domain = state.selectedTool && state.selectedTool.domain;
    if (!domain || !platformId) return;
    handleStackSelectTool(domain, platformId, null);
  },
  onCopyNode: (graph, platformId) => handleStackCopyNode(graph, platformId),
  trackEvent,
});

// Load persisted UI preferences from chrome.storage.local
chrome.storage.local.get(['streamDirection', 'collapsedCategoryFrames', 'filterToolbarCollapsed', 'ignoredEndpoints']).then(result => {
  if (result.ignoredEndpoints && Array.isArray(result.ignoredEndpoints)) {
    result.ignoredEndpoints.forEach(ep => ignoredEndpoints.add(ep));
  }
  if (result.streamDirection) {
    state.streamDirection = result.streamDirection;
    updateStreamDirectionButton();
  }
  if (result.collapsedCategoryFrames && Array.isArray(result.collapsedCategoryFrames)) {
    state.collapsedCategoryFrames = new Set(result.collapsedCategoryFrames);
  }
  if (result.filterToolbarCollapsed !== undefined) {
    state.filterToolbarCollapsed = result.filterToolbarCollapsed;
    updateFilterToolbarCollapsedState();
  }
});

// Get current page hostname for CNAME detection
function updateCurrentPageHostname() {
  // Use service worker to get tab URL — avoids inspectedWindow.eval which can fail
  // with "has no execution context" if the page hasn't fully loaded yet
  chrome.runtime.sendMessage(
    { type: MSG.GET_TAB_URL, tabId: chrome.devtools.inspectedWindow.tabId },
    (response) => {
      if (response?.url) {
        try {
          state.currentPageHostname = new URL(response.url).hostname;
        } catch { /* invalid URL */ }
        recordSeen(response.url);
        updatePinnedBtnCount();
      }
    }
  );
}

// Refreshes the per-site `bucket` event property from the inspected page's URL.
// Gated on the analytics opt-out so opted-out users don't trigger lazy seed
// generation in ensureSeed(). No domain or hostname is ever persisted to
// storage — only the salted hash leaves the device, via the `bucket` property
// on Amplitude events (see analytics.js setBucketGetter).
async function recordSeen(url) {
  if (!url) return;
  let domain;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
    domain = normalizeToRegistrableDomain(parsed.hostname);
  } catch { return; }
  if (!domain) return;
  try {
    const stored = await chrome.storage.local.get('analytics_enabled');
    if (stored.analytics_enabled === false) return;
  } catch { return; }
  updateCurrentBucket(domain);
}

// One-shot migration: drop the legacy `local_seen` dedup list shipped between
// v1.2.0 dev and the breadth-removal change. The list of visited domains is
// no longer needed (the count was the only thing transmitted, and that was
// removed along with the `breadth` user property). Safe to remove
// unconditionally — nothing else reads this key.
chrome.storage.local.remove('local_seen').catch(() => { /* non-critical */ });

// Per-site identifier: salted SHA-256 of the current page's eTLD+1, sent on
// every Amplitude event as the opaque `bucket` event property. The 128-bit
// seed is generated once per install and stored in
// `chrome.storage.local.local_seed` — it never leaves the device, so the
// digest is non-reversible even with an exhaustive domain wordlist. The
// `local_` prefix signals the on-device-only contract in the storage viewer.
// Trade-off: every install uses a different seed, so cross-user "same site"
// grouping is intentionally not possible. Within a single install the value
// is stable across navigations to the same eTLD+1, so "events per distinct
// site this user has visited" becomes computable in Amplitude without ever
// transmitting a hostname.
let currentBucket = null;
let seed = null;
const bucketCache = new Map(); // domain -> bucket value, scoped to this panel session

// Read the existing seed (if any). We never WRITE here — generation is gated
// on analytics_enabled and happens lazily via ensureSeed() below, which is
// only reached after recordSeen() has cleared the opt-out check.
const seedLoadPromise = (async () => {
  try {
    const stored = await chrome.storage.local.get(['local_seed']);
    if (typeof stored.local_seed === 'string' && stored.local_seed.length >= 32) {
      seed = stored.local_seed;
    }
  } catch { /* non-critical — seed stays null until lazy generation */ }
})();

async function ensureSeed() {
  await seedLoadPromise;
  if (seed) return seed;
  try {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    seed = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    await chrome.storage.local.set({ local_seed: seed });
    return seed;
  } catch {
    return null;
  }
}

async function computeBucket(domain) {
  if (!domain) return null;
  const s = await ensureSeed();
  if (!s) return null;
  const cached = bucketCache.get(domain);
  if (cached) return cached;
  try {
    const buf = new TextEncoder().encode(`${s}|${domain}`);
    const digest = await crypto.subtle.digest('SHA-256', buf);
    // 16 hex chars = 64 bits — collision-safe for any realistic per-install
    // site count and keeps the property compact in Amplitude.
    const value = [...new Uint8Array(digest)]
      .slice(0, 8)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    bucketCache.set(domain, value);
    return value;
  } catch {
    return null;
  }
}

async function updateCurrentBucket(domain) {
  const value = await computeBucket(domain);
  if (value) currentBucket = value;
}

setBucketGetter(() => currentBucket);

// Update hostname on load and navigation
updateCurrentPageHostname();
// Resolve cookie store ID for incognito-aware cookie reading.
// In spanning mode, one service worker handles both normal and incognito tabs.
// Without the correct storeId, chrome.cookies reads from the normal profile.
chrome.runtime.sendMessage(
  { type: MSG.GET_TAB_COOKIE_STORE, tabId: chrome.devtools.inspectedWindow.tabId },
  (response) => {
    if (response?.cookieStoreId) state.cookieStoreId = response.cookieStoreId;
  }
);
// Read consent cookies on panel open (async, non-blocking)
readAndProcessConsentCookies();
chrome.devtools.network.onNavigated.addListener((url) => {
  // Stack View: when the registrable domain (eTLD+1) changes, clear the
  // selected tool so the right-hand pane doesn't keep pointing at a node
  // from the previous site's stack. The events array itself is not
  // cleared — Stack filters per-domain at render time, mirroring how
  // Pages auto-collapses previous domains.
  const previousHost = state.currentPageHostname;
  try {
    state.currentPageHostname = new URL(url).hostname;
  } catch {
    updateCurrentPageHostname();
  }
  if (previousHost && state.currentPageHostname) {
    try {
      const prevETLD = normalizeToRegistrableDomain(previousHost);
      const nextETLD = normalizeToRegistrableDomain(state.currentPageHostname);
      if (prevETLD && nextETLD && prevETLD !== nextETLD) {
        // Cross-domain navigation: keep all previously-built stacks
        // intact (don't wipe them — they're per-domain and the user
        // can revisit by expanding the collapsed header). Just take
        // focus off the previous domain and clear any tool selection
        // that pointed there so the right pane doesn't keep showing
        // a stale tool detail.
        state.collapsedStackDomains.add(prevETLD);
        if (state.selectedTool && state.selectedTool.domain === prevETLD) {
          state.selectedTool = null;
        }
        // Feature #81 Phase 2 — MCP regression mode auto-clear.
        // When auto-publish is enabled (= dev install + maintainer driving
        // chrome-devtools MCP through a sweep), wipe the event list on
        // cross-domain navigation so a 50-URL run doesn't accumulate
        // events from every previously-visited site in one panel. Regular
        // users on CWS installs aren't affected — auto-publish stays
        // false there and this branch never fires.
        if (isAIExportAutoPublishEnabled()) {
          clearEvents();
        }
      }
    } catch { /* non-critical */ }
  }
  recordSeen(url);
  updatePinnedBtnCount();
  // Resume capture if paused (but not if stopped)
  resumeCaptureIfPaused();
  // Reset page-load timestamp for consent cookie change detection
  lastPageLoadTime = Date.now();
  // Re-read consent cookies after navigation
  readAndProcessConsentCookies();
});

// Listen for consent cookie changes mid-session.
// CMPs update cookies when the user changes consent, but may not push dataLayer events.
// Debounced: CMPs often set multiple cookies within milliseconds of each other.
// Only triggers for known consent cookie names to avoid noise from analytics/session cookies.
const CONSENT_COOKIE_NAMES = new Set([
  'CookieConsent', 'OptanonConsent', 'didomi_token', 'osano_consentmanager',
  'cookieyes-consent', 'euconsent-v2', 'CookieScriptConsent', 'cookiefirst-consent',
  'cmapi_cookie_privacy', 'notice_gdpr_prefs', 'fides_consent', 'borlabs-cookie',
  'axeptio_cookies', 'CookieInformationConsent', '_pandectes_gdpr', 'tcm',
  '_evidon_consent_cookie', 'sp_dpr', 'tarteaucitron', 'CookieControl', 'klaro',
  'TC_PRIVACY', 'moove_gdpr_popup', 'cookie_notice_accepted', 'wpl_user_preference',
  'CookieLawInfoConsent'
]);
// Prefix-matched consent cookies (wildcard patterns from getConsentCookieNames)
const CONSENT_COOKIE_PREFIXES = ['_iub_cs-', 'ppms_privacy_', '_ketch_consent_v1_', 'cmplz_', 'T_DC_', 'wscrCookieConsent'];
// Tracks mid-session consent cookie writes detected via chrome.cookies.onChanged.
// readAndProcessConsentCookies() checks this to create a marker even when state is unchanged
// (user re-confirmed consent without changing categories).
let consentCookieWriteDetected = false;
let consentCookieWriteTimestamp = 0; // Captures the moment the cookie change was detected
let lastPageLoadTime = Date.now();
// Single shared debounce for every consent-cookie reprocess trigger. Two
// independent timers (chrome.cookies.onChanged here, and Cookie Information's
// per-category dataLayer burst via aggregateCookieInfoEvent) could both fire in
// the same window and run readAndProcessConsentCookies() overlapping. Because
// that function reads then resets consentCookieWriteDetected/Timestamp, an
// interleaved second run would observe the reset flags and mislabel a genuine
// mid-session write as a prior-consent (T=0) entry, or double-add. Sharing one
// timer guarantees a single reprocess per quiet window (N8, feature #139).
let consentCookieReprocessTimer = null;
function scheduleConsentCookieReprocess() {
  clearTimeout(consentCookieReprocessTimer);
  consentCookieReprocessTimer = setTimeout(() => readAndProcessConsentCookies(), 500);
}
chrome.cookies.onChanged.addListener((changeInfo) => {
  if (!state.currentPageHostname) return;
  if (changeInfo.removed && changeInfo.cause === 'expired') return;
  // Ignore cookie changes from other cookie stores (e.g., normal profile events
  // reaching an incognito panel, or vice versa).
  if (state.cookieStoreId && changeInfo.cookie.storeId !== state.cookieStoreId) return;
  const name = changeInfo.cookie.name;
  if (!CONSENT_COOKIE_NAMES.has(name) &&
      !CONSENT_COOKIE_PREFIXES.some(p => name.startsWith(p))) return;
  try {
    const cookieDomain = changeInfo.cookie.domain.replace(/^\./, '');
    if (!state.currentPageHostname.endsWith(cookieDomain)) return;
  } catch { return; }
  // Only flag as mid-session after the initial page-load window (5s from last navigation).
  // During page load, CMPs set/refresh cookies which would create spurious markers.
  if (Date.now() - lastPageLoadTime > 5000) {
    consentCookieWriteDetected = true;
    // Capture the timestamp of the first cookie change in this batch (not after debounce).
    // CMPs write multiple cookies within ms — keep the earliest timestamp as the consent moment.
    if (!consentCookieWriteTimestamp) {
      consentCookieWriteTimestamp = Date.now();
    }
  }
  scheduleConsentCookieReprocess();
});

// DOM Elements
const elements = {
  eventList: document.getElementById('event-list'),
  eventDetail: document.getElementById('event-detail'),
  emptyState: document.getElementById('empty-state'),
  clearBtn: document.getElementById('clear-btn'),
  reloadBtn: document.getElementById('reload-btn'),
  reloadContextMenu: document.getElementById('reload-context-menu'),
  clearContextMenu: document.getElementById('clear-context-menu'),
  searchInput: document.getElementById('search'),
  // Category toggle bar
  categoryToggles: document.getElementById('category-toggles'),
  // Trigger correlation toggle
  triggerCorrelationToggle: document.getElementById('trigger-correlation-toggle'),
  // Event type filter buttons (4-state: tool/hide/only/show)
  scriptsFilter: document.getElementById('scripts-filter'),
  consentFilter: document.getElementById('consent-filter'),
  scriptsMode: document.getElementById('scripts-mode'),
  consentMode: document.getElementById('consent-mode'),
  // Interactions filter (2-state: show/hide)
  interactionsFilter: document.getElementById('interactions-filter'),
  interactionsMode: document.getElementById('interactions-mode'),
  // Event type counts
  scriptCount: document.getElementById('script-count'),
  consentCount: document.getElementById('consent-count'),
  interactionCount: document.getElementById('interaction-count'),
  // Supported tools panel (Categories & Tools modal)
  supportedToolsBtn: document.getElementById('supported-tools-btn'),
  supportedToolsPanel: document.getElementById('supported-tools-panel'),
  supportedToolsBody: document.getElementById('supported-tools-body'),
  supportedToolsClose: document.getElementById('supported-tools-close'),
  supportedToolsSearch: document.getElementById('supported-tools-search'),
  viewToggle: document.getElementById('view-toggle'),
  expandCollapseBtns: document.getElementById('expand-collapse-btns'),
  expandAllBtn: document.getElementById('expand-all-btn'),
  collapseAllBtn: document.getElementById('collapse-all-btn'),
  // Capture control button
  captureBtn: document.getElementById('capture-btn'),
  // Sort toggle button
  sortToggleBtn: document.getElementById('sort-toggle-btn'),
  // Sort controls container (hidden when Script Tree is active)
  sortControls: document.getElementById('sort-controls'),
  // Expand/Collapse all button (for all event views)
  expandCollapseBtn: document.getElementById('expand-collapse-btn'),
  expandCollapseSubBtn: document.getElementById('expand-collapse-sub-btn'),
  // Stream direction button (stream view only)
  streamDirectionBtn: document.getElementById('stream-direction-btn'),
  // Capture status bar (warning indicator)
  captureStatusBar: document.getElementById('capture-status-bar'),
  captureStatusText: document.getElementById('capture-status-text'),
  // Show All / Hide All buttons
  showAllToolsBtn: document.getElementById('show-all-tools-btn'),
  hideAllToolsBtn: document.getElementById('hide-all-tools-btn'),
  // GTM Hub modal
  gtmBtn: document.getElementById('gtm-btn'),
  gtmPanel: document.getElementById('gtm-panel'),
  gtmPanelClose: document.getElementById('gtm-panel-close'),
  // Theme toggle
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  // Settings panel
  settingsBtn: document.getElementById('settings-btn'),
  settingsPanel: document.getElementById('settings-panel'),
  settingsClose: document.getElementById('settings-close'),
  // Data layer settings
  dataLayerEnableAll: document.getElementById('datalayer-enable-all'),
  dataLayerDisableAll: document.getElementById('datalayer-disable-all'),
  dataLayerEnableCommon: document.getElementById('datalayer-enable-common'),
  // Context menu for platform filters
  platformContextMenu: document.getElementById('platform-context-menu'),
  contextMenuToolHeader: document.getElementById('context-menu-tool-header'),
  contextMenuToolIcon: document.getElementById('context-menu-tool-icon'),
  contextMenuToolName: document.getElementById('context-menu-tool-name'),
  // Export button + context menu
  exportBtn: document.getElementById('export-btn'),
  exportContextMenu: document.getElementById('export-context-menu'),
  // Context menu for page events
  pageContextMenu: document.getElementById('page-context-menu'),
  // Context menu for interaction events
  interactionContextMenu: document.getElementById('interaction-context-menu'),
  // Context menu for script tree
  scriptTreeContextMenu: document.getElementById('script-tree-context-menu'),
  // Context menu for Grouped-view group headers — Tool category / Tool platform /
  // Page-pivot domain / Event Name / Consent Category. Page-pivot pages keep
  // pageContextMenu above (dataLayer / Full Export with per-page time window).
  groupContextMenu: document.getElementById('group-context-menu'),
  // Performance info button
  perfInfoBtn: document.getElementById('perf-info-btn'),
  // Preset dropdown
  presetDropdown: document.getElementById('preset-dropdown'),
  presetDropdownBtn: document.getElementById('preset-dropdown-btn'),
  presetDropdownLabel: document.getElementById('preset-dropdown-label'),
  presetDropdownMenu: document.getElementById('preset-dropdown-menu'),
  presetDropdownList: document.getElementById('preset-dropdown-list'),
  presetClearBtn: document.getElementById('preset-clear-btn'),
  savePresetBtn: document.getElementById('save-preset-btn'),
  // Help panel
  helpBtn: document.getElementById('help-btn'),
  helpPanel: document.getElementById('help-panel'),
  helpClose: document.getElementById('help-close'),
  helpTabs: document.getElementById('help-tabs'),
  helpBody: document.getElementById('help-body'),
  helpTitleVersion: document.getElementById('help-title-version'),
  // AI panel (v1.1.0)
  aiBtn: document.getElementById('ai-btn'),
  aiBtnDot: document.getElementById('ai-btn-dot'),
  aiPanel: document.getElementById('ai-panel'),
  aiClose: document.getElementById('ai-close'),
  aiTabs: document.getElementById('ai-tabs'),
  aiTabUsage: document.getElementById('ai-tab-usage'),
  aiBody: document.getElementById('ai-body'),
  aiTabProvider: document.getElementById('ai-tab-provider'),
  aiTabChat: document.getElementById('ai-tab-chat'),
  aiTabAbout: document.getElementById('ai-tab-about'),
  // AI consent dialog
  aiConsentDialog: document.getElementById('ai-consent-dialog'),
  aiConsentAccept: document.getElementById('ai-consent-accept'),
  aiConsentCancel: document.getElementById('ai-consent-cancel'),
  // Footer version link
  footerVersion: document.getElementById('footer-version'),
  // Report Modal (multi-purpose: feedback, feature, bug, tool)
  reportModalBtn: document.getElementById('report-tool-btn'),
  reportModalPanel: document.getElementById('report-modal-panel'),
  reportModalClose: document.getElementById('report-modal-close'),
  reportModalForm: document.getElementById('report-modal-form'),
  reportModalDesc: document.getElementById('report-modal-desc'),
  reportModalSuccess: document.getElementById('report-modal-success'),
  reportModalIcon: document.getElementById('report-modal-icon'),
  reportModalTitleText: document.getElementById('report-modal-title-text'),
  reportTypeCards: document.getElementById('report-type-cards'),
  reportFormContainer: document.getElementById('report-form-container'),
  reportTypeSelector: document.getElementById('report-type-selector'),
  // Report field groups
  reportFieldsFeedback: document.getElementById('report-fields-feedback'),
  reportFieldsFeature: document.getElementById('report-fields-feature'),
  reportFieldsBug: document.getElementById('report-fields-bug'),
  reportFieldsTool: document.getElementById('report-fields-tool'),
  // Feedback fields
  reportFeedbackSubject: document.getElementById('report-feedback-subject'),
  reportFeedbackComment: document.getElementById('report-feedback-comment'),
  // Feature fields
  reportFeatureSubject: document.getElementById('report-feature-subject'),
  reportFeatureComment: document.getElementById('report-feature-comment'),
  reportFeatureWhy: document.getElementById('report-feature-why'),
  // Bug fields
  reportBugSubject: document.getElementById('report-bug-subject'),
  reportBugWebsite: document.getElementById('report-bug-website'),
  reportBugComment: document.getElementById('report-bug-comment'),
  // Tool fields
  reportToolSubject: document.getElementById('report-tool-subject'),
  reportToolCategory: document.getElementById('report-tool-category'),
  reportToolWebsite: document.getElementById('report-tool-website'),
  reportToolEndpoint: document.getElementById('report-tool-endpoint'),
  reportToolComment: document.getElementById('report-tool-comment'),
  // Consent category fields
  reportFieldsConsent: document.getElementById('report-fields-consent'),
  reportConsentTool: document.getElementById('report-consent-tool'),
  reportConsentCurrent: document.getElementById('report-consent-current'),
  reportConsentSuggested: document.getElementById('report-consent-suggested'),
  reportConsentWebsite: document.getElementById('report-consent-website'),
  reportConsentComment: document.getElementById('report-consent-comment'),
  // Contact fields (shared)
  reportContactName: document.getElementById('report-contact-name'),
  reportContactEmail: document.getElementById('report-contact-email'),
  footerReportLink: document.getElementById('footer-report-link'),
  // View mode toggle (Stream / Grouped chips / Script Tree)
  viewModeToggle: document.getElementById('view-mode-toggle'),
  viewModeGroupedToggle: document.getElementById('view-mode-grouped-toggle'),
  viewModeTreeToggle: document.getElementById('view-mode-tree-toggle'),
  viewModeStackToggle: document.getElementById('view-mode-stack-toggle'),
  viewModePinnedToggle: document.getElementById('view-mode-pinned-toggle'),
  pinnedClearAllBtn: document.getElementById('pinned-clear-all-btn'),
  pinnedCreateGroupBtn: document.getElementById('pinned-create-group-btn'),
  stackClearBtn: document.getElementById('stack-clear-btn'),
  stackRefreshBtn: document.getElementById('stack-refresh-btn'),
  treeClearBtn: document.getElementById('tree-clear-btn'),
  treeRefreshBtn: document.getElementById('tree-refresh-btn'),
  pinnedSortToggleBtn: document.getElementById('pinned-sort-toggle-btn'),
  pinnedDirectionBtn: document.getElementById('pinned-direction-btn'),
  groupedPickerBtn: document.getElementById('grouped-picker-btn'),
  // Filter toolbar collapse
  categoryToolbar: document.getElementById('category-toolbar'),
  filterToolbarCollapseBtn: document.getElementById('filter-toolbar-collapse-btn'),
  collapseAllCategoriesBtn: document.getElementById('collapse-all-categories-btn'),
  expandAllCategoriesBtn: document.getElementById('expand-all-categories-btn'),
  collapsedFilterChips: document.getElementById('collapsed-filter-chips'),
  collapsedCategoryChips: document.getElementById('collapsed-category-chips'),
  // Smart search (filters tools + events from toolbar)
  smartSearchContainer: document.getElementById('smart-search-container'),
  smartSearchInput: document.getElementById('smart-search-input'),
  smartSearchClear: document.getElementById('smart-search-clear'),
  smartSearchExpandBtn: document.getElementById('smart-search-expand-btn'),
  smartSearchChips: document.getElementById('smart-search-chips'),
  // Responsive toolbar (overflow menu + tier watcher)
  toolbar: document.querySelector('.toolbar'),
  toolbarOverflowGroup: document.getElementById('toolbar-overflow-group'),
  toolbarOverflow: document.getElementById('toolbar-overflow'),
  toolbarOverflowBtn: document.getElementById('toolbar-overflow-btn'),
  toolbarOverflowMenu: document.getElementById('toolbar-overflow-menu'),
  filterRowCategories: document.getElementById('filter-row-categories'),
  collapseExpandAllBtns: document.getElementById('collapse-expand-all-btns'),
  noToolsMessage: document.getElementById('no-tools-message'),
  // Script Tree info banner (shown when Scripts filter is HIDE)
  scriptTreeInfoBanner: document.getElementById('script-tree-info-banner'),
  identityInfoBanner: document.getElementById('identity-info-banner'),
  streamTrimmedBanner: document.getElementById('stream-trimmed-banner')
};

// Pinned view (Feature #45) — rendering extracted into components/pinned-view.js
// (Feature #142). Wire the small panel-owned surface the module reads instead of
// reaching into coordinator globals. `state`/`elements` are passed by reference
// (both are defined above); render / getCurrentPinDomain / handleEventSelect are
// hoisted function declarations resolved later in this file.
initPinnedView({
  state,
  elements,
  render,
  getCurrentPinDomain,
  handleEventSelect,
  updateSetting,
  // Injected (not imported) to keep pinned-view.js out of the panel ↔
  // event-list.js import cycle, so the module stays independently testable.
  createEventItem,
  ensureEventRowDelegation,
});

/**
 * Cycle capture state: play -> pause -> stop -> play
 * - play: Recording events (default)
 * - pause: Paused, auto-resumes on navigation
 * - stop: Stopped, stays stopped even after navigation
 */
function cycleCaptureState() {
  const stateTransitions = {
    'play': 'pause',
    'pause': 'stop',
    'stop': 'play'
  };
  const titles = {
    'play': 'Capturing events (click to pause)',
    'pause': 'Paused (click to stop, or navigate to resume)',
    'stop': 'Stopped (click to resume)'
  };
  const statusMessages = {
    'play': '',
    'pause': 'Paused – will resume on navigation',
    'stop': 'Stopped – click to resume'
  };

  state.captureState = stateTransitions[state.captureState];
  elements.captureBtn.dataset.state = state.captureState;
  elements.captureBtn.title = titles[state.captureState];
  elements.captureBtn.setAttribute('aria-label', titles[state.captureState]);

  // Update status bar
  elements.captureStatusBar.dataset.state = state.captureState;
  elements.captureStatusText.textContent = statusMessages[state.captureState];

  trackEvent('capture_state', { action: state.captureState });
}

/**
 * Resume capture if currently paused (called on navigation)
 */
function resumeCaptureIfPaused() {
  if (state.captureState === 'pause') {
    state.captureState = 'play';
    elements.captureBtn.dataset.state = 'play';
    elements.captureBtn.title = 'Capturing events (click to pause)';
    elements.captureBtn.setAttribute('aria-label', 'Capturing events (click to pause)');
    // Hide status bar
    elements.captureStatusBar.dataset.state = 'play';
    elements.captureStatusText.textContent = '';
  }
}

// Get the category for a platform (O(1) lookup from platformToCategory map)
function getCategoryForPlatform(platform) {
  return platformToCategory[platform] || 'unknown';
}

/**
 * Check if an event is a script load event
 * @param {Object} event - The event object
 * @returns {boolean} True if this is a script load event
 */
function isScriptLoadEvent(event) {
  // Only trust the explicit isScriptLoad flag set by script-load detection code.
  // Do NOT use event.raw?.type === 'script' or event.type === 'script' -
  // the browser reports JSONP tracking requests (Adform, Google Ads callbacks, etc.)
  // as 'script' type even though they're tracking beacons, not actual script loads.
  return event.isScriptLoad === true;
}

/**
 * Check if an event is a consent-related event
 * This includes: dataLayer consent pushes (with consentEvent or googleConsentMode),
 * developer_id events, AND events from Consent Platform tools (Cookiebot, OneTrust, etc.)
 * @param {Object} event - The event object
 * @returns {boolean} True if this is a consent event
 */
function isConsentEvent(event) {
  // Check if it's a Consent Platform tool event
  if (CONSENT_PLATFORMS.includes(event.platform)) {
    return true;
  }
  // Check if it's a dataLayer push with consent badge (consentEvent or googleConsentMode)
  if (event.formatted?.consentEvent || event.formatted?.googleConsentMode) {
    return true;
  }
  // Check if it's a developer_id event (indicates CMP/vendor integration)
  if (event.formatted?.isDeveloperIdEvent) {
    return true;
  }
  return false;
}

/**
 * Determine which PRIMARY event type category an event belongs to
 * Note: Consent is NOT a primary type - it's an overlay checked separately
 * @param {Object} event - The event object
 * @returns {'pages'|'tracking'|'scripts'} Event type based on how event was captured
 */
function getEventType(event) {
  // Interaction events (user click markers)
  if (event.isInteraction || event.platform === 'interactions') {
    return 'interactions';
  }

  // Page events (URL changes)
  if (event.isNavigation || event.platform === 'pages') {
    return 'pages';
  }

  // Script load events (.js file loads)
  if (isScriptLoadEvent(event)) {
    return 'scripts';
  }

  // Everything else is a network tracking event (beacons, pixels, API calls)
  // This includes Data Layer events, analytics, marketing, Consent Platform tools, widgets, etc.
  return 'tracking';
}

// Get filtered events
function getFilteredEvents() {
  return state.events.filter(event => {
    // Get 3-state filter modes
    const scriptsMode = state.filters.eventTypes?.scripts || 'auto';
    const consentMode = state.filters.eventTypes?.consent || 'auto';

    // Get event characteristics
    const eventType = getEventType(event);
    const isConsent = isConsentEvent(event);
    const isScript = eventType === 'scripts';
    const isPage = eventType === 'pages';

    // Filter out ignored endpoints (unknown events the user chose to ignore)
    if (event.platform === 'other' && event.raw?.url) {
      try {
        const urlObj = new URL(event.raw.url);
        const endpointKey = urlObj.hostname + urlObj.pathname;
        if (ignoredEndpoints.has(endpointKey)) return false;
      } catch (e) { /* keep event if URL parsing fails */ }
    }

    // Filter out developer_id events if setting is enabled
    if (state.hideDeveloperIdEvents && event.formatted?.isDeveloperIdEvent) {
      return false;
    }

    // Page events always pass through (no filter toggle)
    // Interaction events pass through unless interactions filter is set to hide
    if (event.isInteraction) {
      if (!state.filters.eventTypes.interactions) return false;
      // Still apply search filter below, but skip tool/type filtering
    } else if (isPage) {
      // Still apply search filter below, but skip tool/type filtering
    } else {
      // Check tool visibility first
      let toolVisible = false;
      if (state.activePresetVisibleTools) {
        // Preset whitelists only know the generic 'other' id, so unknown events
        // follow the master switch in preset mode (per-host refinement is off).
        toolVisible = state.activePresetVisibleTools.includes(event.platform);
      } else if (event.platform === 'other') {
        // Feature #151: unknown events filter by their per-host chip id (or the
        // shared "Others" overflow id), with bare 'other' as the master switch.
        toolVisible = !isUnknownEventHidden(event);
      } else {
        toolVisible = !state.hiddenTools.includes(event.platform);
      }

      // Apply cross-tool filter logic
      // Each filter (scripts, consent, interactions) operates independently.
      // Consent takes priority over scripts for dual events (CMP script loads).
      let passesFilter = false;

      if (isConsent) {
        // Consent events — consent filter takes priority (even for CMP script loads)
        switch (consentMode) {
          case 'only': passesFilter = toolVisible; break;
          case 'hide': passesFilter = false; break;  // Hide consent events, but checking stays active
          case 'off': passesFilter = false; break;    // Entire consent function disabled
          case 'auto':
            // In auto mode, also respect scripts filter for script-type consent events
            if (isScript) {
              passesFilter = scriptsMode === 'hide' ? false : toolVisible;
            } else {
              passesFilter = toolVisible;
            }
            break;
        }
      } else if (isScript) {
        // Custom endpoint script loads bypass scripts filter — the user explicitly
        // configured a custom endpoint to match these requests, so always follow
        // tool visibility instead of the scripts filter mode
        if (event.isCustomEndpoint) {
          passesFilter = toolVisible;
        } else {
          // Pure script events (non-consent) — scripts filter layered on tool visibility
          switch (scriptsMode) {
            case 'only': passesFilter = toolVisible; break;
            case 'hide': passesFilter = false; break;
            case 'auto': passesFilter = toolVisible; break;
          }
        }
      } else {
        // Regular tracking events — follow tool visibility
        passesFilter = toolVisible;

        // "Only" mode filters out non-matching event types (still honors tool visibility)
        if (scriptsMode === 'only') passesFilter = false;
        if (consentMode === 'only') {
          // In consent ONLY mode: also show tracking events with consent check results (from visible tools)
          const check = getConsentCheckForEvent(event);
          passesFilter = toolVisible && check && check.status !== 'exempt';
        }
      }

      if (!passesFilter) {
        return false;
      }
    }

    // Smart search filter (toolbar search — platforms, categories, events, keywords)
    const parsedSearch = getCurrentParsedSearch();
    if (!eventMatchesSmartSearch(event, parsedSearch, platformToCategory)) {
      return false;
    }

    // Text search filter (green search in stream controls)
    if (state.filters.search) {
      const searchLower = state.filters.search.toLowerCase();
      const eventName = (event.eventName || '').toLowerCase();
      const platform = (event.platform || '').toLowerCase();

      // Use cached search string to avoid expensive JSON.stringify on every filter
      // Cache is stored on the event object to avoid memory overhead of a separate map
      if (!event._searchCache) {
        event._searchCache = JSON.stringify(event.raw || {}).toLowerCase();
      }

      if (!eventName.includes(searchLower) &&
          !platform.includes(searchLower) &&
          !event._searchCache.includes(searchLower)) {
        return false;
      }
    }

    return true;
  });
}

// Resolve the event set for export operations. In Pinned view, scopes to
// pinned events for the currently-inspected domain — preferring the live
// event from state.events (full fidelity: raw HTTP, latest enrichment) and
// falling back to the stored snapshot when the live event is gone (e.g.
// cleared, or pinned in a previous session). All other view modes fall
// through to getFilteredEvents() so exports keep their existing scope.
function getEventsForExport() {
  if (state.viewMode !== 'pinned') return getFilteredEvents();
  const domain = getCurrentPinDomain();
  if (!domain) return [];
  const records = getPinnedRecordsForDomain(domain);
  return records
    .map(rec => state.events.find(e => e.id === rec.pinId) || rec.snapshot)
    .filter(Boolean);
}

// Update platform and category counts from events
function updatePlatformCounts() {
  state.platformCounts = {};
  state.categoryCounts = {};

  state.events.forEach(event => {
    // Skip page events and interaction events
    if (event.isNavigation || event.platform === 'pages' || event.isInteraction) return;
    const platform = event.platform;
    state.platformCounts[platform] = (state.platformCounts[platform] || 0) + 1;

    // Track this platform as detected (persists even when hidden)
    state.detectedPlatforms.add(platform);

    // Update category count
    const category = getCategoryForPlatform(platform);
    state.categoryCounts[category] = (state.categoryCounts[category] || 0) + 1;
  });
}

// ── Feature #151: self-describing Unknown filter chips ──────────────────────
//
// Unrecognised requests keep `event.platform === 'other'` (10+ call sites depend
// on that id). The per-host bucketing here lives ONLY in the chip / filter layer:
// the bare `'other'` id is the Unknown-category master switch and the overflow
// chip uses OTHERS_OVERFLOW_ID, so the category toggle / presets / context menu
// machinery is untouched (they all still operate on `'other'`).

const MAX_UNKNOWN_HOST_CHIPS = 5;          // distinct host chips before overflow folds into "Others"
const UNKNOWN_HOST_ID_PREFIX = 'other:';   // synthetic per-host filter id, e.g. 'other:telemetry.ncp.nuuday.nu'
const OTHERS_OVERFLOW_ID = 'other:__others__'; // the "Others" overflow chip id

// Lowercase full hostname of an unrecognised event's endpoint, memoised on the
// event. Returns '' when no URL is available (underivable → folds into Others).
function getUnknownHostForEvent(event) {
  if (!event) return '';
  if (event._unknownHost !== undefined) return event._unknownHost;
  const host = event.raw?.url ? extractHostname(event.raw.url) : '';
  event._unknownHost = host || '';
  return event._unknownHost;
}

// Rebuild state.unknownHostBuckets + state.unknownTopHosts from the current event
// set. Called at the top of render() (before getFilteredEvents) so the filter
// application and the filter bar share one top-host / overflow split.
function updateUnknownHostBuckets() {
  const hosts = [];
  for (const event of state.events) {
    if (event.platform !== 'other') continue;
    if (event.isNavigation || event.isInteraction) continue;
    hosts.push(getUnknownHostForEvent(event));
  }
  state.unknownHostBuckets = bucketUnknownHosts(hosts, MAX_UNKNOWN_HOST_CHIPS);
  state.unknownTopHosts = new Set(state.unknownHostBuckets.chips.map(c => c.host));
}

// The synthetic filter id an unknown event resolves to: its own host chip when
// the host is in the top-N, else the shared overflow chip.
function unknownEffectiveFilterId(event) {
  const host = getUnknownHostForEvent(event);
  if (host && state.unknownTopHosts.has(host)) return UNKNOWN_HOST_ID_PREFIX + host;
  return OTHERS_OVERFLOW_ID;
}

// Is an unrecognised event hidden? The bare 'other' id is the category master
// switch (hides every unknown); the per-host / overflow id is the refinement.
function isUnknownEventHidden(event) {
  if (state.hiddenTools.includes('other')) return true; // master switch
  return state.hiddenTools.includes(unknownEffectiveFilterId(event));
}

// View-model for the Unknown category's filter chips (Feature #151): one chip
// descriptor per surfaced host (capped, label left-truncated to 25 chars) plus
// an optional "Others" overflow chip. Consumed by filter-bar.js. The synthetic
// id scheme lives here so it stays single-source.
function getUnknownChipDescriptors() {
  const buckets = state.unknownHostBuckets || { chips: [], othersCount: 0 };
  const descriptors = buckets.chips.map(c => ({
    id: UNKNOWN_HOST_ID_PREFIX + c.host,
    label: truncateHostLabel(c.host),
    title: c.host,              // full host on hover (mirrors #149's convention)
    count: c.count,
  }));
  if (buckets.othersCount > 0) {
    descriptors.push({
      id: OTHERS_OVERFLOW_ID,
      label: 'Others',
      title: `${buckets.othersCount} request${buckets.othersCount === 1 ? '' : 's'} to other unrecognised hosts`,
      count: buckets.othersCount,
    });
  }
  return descriptors;
}

// Update event type counts (Scripts, Interactions)
// Consent count is handled separately by updateConsentCounter() which is mode-aware
function updateEventTypeCounts() {
  let scriptCount = 0;
  let interactionCount = 0;

  state.events.forEach(event => {
    const eventType = getEventType(event);
    if (eventType === 'scripts') {
      scriptCount++;
    }
    if (eventType === 'interactions') {
      interactionCount++;
    }
  });

  // Update the DOM
  if (elements.scriptCount) elements.scriptCount.textContent = scriptCount;
  if (elements.interactionCount) elements.interactionCount.textContent = interactionCount;

  // Also update the filter UI states
  updateScriptsFilterUI();
  updateConsentFilterUI();
  updateInteractionsFilterUI();

  // Update consent counter (mode-aware: violations in AUTO, all in ONLY, hidden in OFF)
  updateConsentCounter();
}

// Get events for a specific page (between page events)
// Uses currently filtered events so hidden tools/filters are excluded
// Matches the grouping logic used in event-list.js groupEventsByPage
// Exported so ai-summary-section.js can lazy-import it when building
// the page-scoped AI prompt input.
export function getPageEvents(pageEventId) {
  // Find the page event
  const pageEvent = state.events.find(e => e.id === pageEventId);
  if (!pageEvent) return { page: null, events: [] };

  // Get current filtered events (respects active filters)
  const filteredEvents = getFilteredEvents();

  // Sort filtered events by timestamp ascending (with pushIndex as tiebreaker)
  const sortedEvents = [...filteredEvents].sort(compareEventsAsc);

  // Build page groups using same logic as event-list.js groupEventsByPage
  const pageGroups = [];
  const eventsBeforeFirstNav = [];
  let currentPage = null;
  let currentEvents = [];

  sortedEvents.forEach(event => {
    if (event.isNavigation || event.platform === 'pages') {
      // Save previous group if exists
      if (currentPage) {
        pageGroups.push({
          page: currentPage,
          events: currentEvents
        });
      } else if (currentEvents.length > 0) {
        // Events before first page
        eventsBeforeFirstNav.push(...currentEvents);
      }
      // Start new group
      currentPage = event;
      currentEvents = [];
    } else {
      currentEvents.push(event);
    }
  });

  // Don't forget the last group
  if (currentPage) {
    pageGroups.push({
      page: currentPage,
      events: currentEvents
    });
  }

  // Add events before first page to first page group
  if (eventsBeforeFirstNav.length > 0 && pageGroups.length > 0) {
    pageGroups[0].events = [...eventsBeforeFirstNav, ...pageGroups[0].events];
  }

  // Find the page group for the requested page
  const pageGroup = pageGroups.find(pg => pg.page.id === pageEventId);

  if (!pageGroup) {
    return { page: pageEvent, events: [] };
  }

  return {
    page: pageGroup.page,
    events: pageGroup.events
  };
}

// Legacy function - redirects to unified render
function renderCategoryToggles() {
  renderUnifiedFilterBar();
}

// Check if a category should be enabled based on its tools' visibility
// Category is enabled only if ALL detected tools in the category are visible
function updateCategoryStateFromTools() {
  Object.entries(PLATFORM_CATEGORIES).forEach(([categoryId, category]) => {
    // Get detected platforms in this category
    const detectedPlatforms = getPlatformsForCategory(categoryId).filter(
      platform => (state.platformCounts[platform] || 0) > 0
    );

    if (detectedPlatforms.length === 0) return;

    // Check if ALL detected tools are visible
    const allVisible = detectedPlatforms.every(platform => {
      if (state.activePresetVisibleTools) {
        return state.activePresetVisibleTools.includes(platform);
      }
      return !state.hiddenTools.includes(platform);
    });

    const categoryIdx = state.filters.categories.indexOf(categoryId);

    if (allVisible && categoryIdx < 0) {
      // All tools visible, enable category
      state.filters.categories.push(categoryId);
    } else if (!allVisible && categoryIdx >= 0) {
      // Some tools hidden, disable category
      state.filters.categories.splice(categoryIdx, 1);
    }
  });
}

// Toggle a category on/off - this toggles all detected tools in the category
function toggleCategory(categoryId) {
  // Get detected platforms in this category (only toggle tools that have events)
  const detectedPlatforms = getPlatformsForCategory(categoryId).filter(
    platform => (state.platformCounts[platform] || 0) > 0 || state.detectedPlatforms.has(platform)
  );

  if (detectedPlatforms.length === 0) return;

  // Check current state - category is "enabled" if AT LEAST ONE tool is visible
  const anyVisible = detectedPlatforms.some(platform => {
    if (state.activePresetVisibleTools) {
      return state.activePresetVisibleTools.includes(platform);
    }
    return !state.hiddenTools.includes(platform);
  });

  if (anyVisible) {
    // Hide all tools in this category
    detectedPlatforms.forEach(platform => {
      if (state.activePresetVisibleTools) {
        // Remove from whitelist
        const idx = state.activePresetVisibleTools.indexOf(platform);
        if (idx >= 0) {
          state.activePresetVisibleTools.splice(idx, 1);
        }
      }
      if (!state.hiddenTools.includes(platform)) {
        state.hiddenTools.push(platform);
      }
    });
    // Mark category as disabled
    const idx = state.filters.categories.indexOf(categoryId);
    if (idx >= 0) {
      state.filters.categories.splice(idx, 1);
    }
  } else {
    // Show all tools in this category
    detectedPlatforms.forEach(platform => {
      if (state.activePresetVisibleTools) {
        // Add to whitelist
        if (!state.activePresetVisibleTools.includes(platform)) {
          state.activePresetVisibleTools.push(platform);
        }
      }
      const idx = state.hiddenTools.indexOf(platform);
      if (idx >= 0) {
        state.hiddenTools.splice(idx, 1);
      }
    });
    // Mark category as enabled
    if (!state.filters.categories.includes(categoryId)) {
      state.filters.categories.push(categoryId);
    }
  }

  trackEvent('filter_category', { action: 'select', category: categoryId });

  render();
  updateSavePresetButton();
}

// Show all detected tools
function showAllTools() {
  state.hiddenTools = [];
  state.activePresetVisibleTools = null; // Clear preset whitelist
  state.activePresetOriginalTools = null;
  // Enable all categories that have detected tools
  Object.keys(PLATFORM_CATEGORIES).forEach(categoryId => {
    if (!state.filters.categories.includes(categoryId)) {
      state.filters.categories.push(categoryId);
    }
  });
  // Reset cross-tool filters to 'auto' mode (follow tool visibility)
  state.filters.eventTypes.scripts = 'auto';
  state.filters.eventTypes.consent = 'auto';
  // Update filter UI
  updateScriptsFilterUI();
  updateConsentFilterUI();
  render();
}

// Hide all detected tools
function hideAllTools() {
  // Empty whitelist — everything hidden, including platforms detected later. Subsequent
  // chip clicks compose naturally: toggleToolVisibility's whitelist branch pushes onto
  // this array, turning Hide All + click chip into a real "Show only" gesture.
  state.activePresetVisibleTools = [];
  state.activePresetOriginalTools = null;
  state.hiddenTools = [];
  // Disable all categories
  state.filters.categories = [];
  // Set cross-tool filters to hide/off mode
  state.filters.eventTypes.scripts = 'hide';
  state.filters.eventTypes.consent = 'off';
  // Update filter UI
  updateScriptsFilterUI();
  updateConsentFilterUI();
  render();
}

// Legacy function name for compatibility
// Legacy function - redirects to unified render
function renderFilterChips() {
  renderUnifiedFilterBar();
}

// Legacy function - no longer needed, tools now rendered in unified bar
function renderDetectedTools() {
  // No-op: detected tools are now shown within category frames in the unified filter bar
}

// Helper to escape HTML special characters
// Toggle page group collapse state
function togglePageCollapse(pageId) {
  if (state.collapsedPageGroups.has(pageId)) {
    state.collapsedPageGroups.delete(pageId);
  } else {
    state.collapsedPageGroups.add(pageId);
  }
  updateExpandCollapseButtonState();
  render();
}

// Expand/collapse semantics:
//   L1 = top-level groups (categories in Tool, domains in Page, parent
//        buckets in flat pivots, page groups in Stream, root scripts in Tree)
//   L2 = sub-groups (platforms inside a category, pages inside a domain,
//        sub-buckets inside a flat-pivot parent). Only meaningful in 2-level
//        Grouped views — Stream and Script Tree are single-level.
//
// The toolbar exposes two split buttons: the first toggles L1, the second
// toggles L2 (hidden in single-level surfaces). The two buttons operate
// independently so users can land on the "L1 expanded + L2 collapsed"
// overview state — structure visible without per-event noise.

// Expand all L1 groups (adaptive based on view mode)
function expandAllPages() {
  if (state.viewMode === 'grouped' && state.activeGrouping === 'tool') {
    // Tool grouping: clear category-level collapse only (L1)
    state.collapsedCategoryGroups.clear();
  } else if (state.viewMode === 'grouped' && state.activeGrouping === 'page') {
    // Page grouping: clear domain-level collapse only (L1)
    state.collapsedDomains.clear();
  } else if (state.viewMode === 'grouped') {
    // Flat grouping pivots: clear only L1 entries (`<grouping>:<key>` —
    // tail has zero colons). L2 entries (`<grouping>:<parent>:<sub>`)
    // are owned by the L2 button.
    const prefix = state.activeGrouping + ':';
    for (const key of Array.from(state.collapsedGroupedGroups)) {
      if (!key.startsWith(prefix)) continue;
      const tail = key.slice(prefix.length);
      if (!tail.includes(':')) state.collapsedGroupedGroups.delete(key);
    }
  } else if (state.viewMode === 'tree') {
    // Script Tree View: expand all script groups (single level)
    state.collapsedScriptGroups.clear();
  } else if (state.viewMode === 'stack') {
    // Stack View: L1 = domain sections.
    state.collapsedStackDomains.clear();
  } else if (state.viewMode === 'pinned') {
    // Pinned View: L1 = domain sections. Preserve `__seen::` bookkeeping
    // markers so we don't re-collapse non-current domains on next render.
    for (const key of Array.from(state.pinnedDomainsCollapsed)) {
      if (!key.startsWith('__seen::')) state.pinnedDomainsCollapsed.delete(key);
    }
  } else {
    // Stream View: expand all page groups (single level)
    state.collapsedPageGroups.clear();
  }
  render();
}

// Collapse all L1 groups (adaptive based on view mode)
function collapseAllPages() {
  const filteredEvents = getFilteredEvents();

  if (state.viewMode === 'grouped' && state.activeGrouping === 'tool') {
    // Tool grouping: collapse categories only (L1)
    const platformGroups = groupEventsByPlatform(filteredEvents, pid => platformToCategory[pid] || 'unknown');
    const categoryGroups = groupPlatformsByCategory(platformGroups, PLATFORM_CATEGORIES);
    categoryGroups.forEach(c => state.collapsedCategoryGroups.add(c.category));
  } else if (state.viewMode === 'grouped' && state.activeGrouping === 'page') {
    // Page grouping: collapse domains only (L1)
    const pageGroups = groupEventsByPage(filteredEvents);
    const domainGroups = groupPagesByDomain(pageGroups);
    domainGroups.forEach(d => state.collapsedDomains.add(d.hostname));
  } else if (state.viewMode === 'grouped') {
    // Flat grouping pivots: collapse every distinct L1 group key for the active pivot.
    // groupKey may return either a single key or an array of keys — the
    // Identity pivot fans one event out across multiple identifier-kind
    // buckets. Match the array-or-single contract used by the renderer in
    // grouped-flat-view.js so the keys we add line up with the keys it reads.
    const grouping = getGrouping(state.activeGrouping);
    if (grouping && grouping.groupKey) {
      const ctx = buildGroupingCtx(filteredEvents);
      const seen = new Set();
      for (const ev of filteredEvents) {
        const keyOrKeys = grouping.groupKey(ev, ctx);
        if (keyOrKeys == null) continue;
        const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
        for (const key of keys) {
          if (key == null || seen.has(key)) continue;
          seen.add(key);
          state.collapsedGroupedGroups.add(state.activeGrouping + ':' + key);
        }
      }
    }
  } else if (state.viewMode === 'tree') {
    // Script Tree View: collapse all script groups (single level)
    const scriptEvents = state.events.filter(e => e.isScriptLoad);
    const tree = buildScriptTree(scriptEvents);
    tree.rootNodes.forEach(node => state.collapsedScriptGroups.add(node.id));
  } else if (state.viewMode === 'stack') {
    // Stack View: L1 = domain sections. Walk every domain that currently
    // has a section rendered (current page domain + every cached graph).
    const currentDomain = state.currentPageHostname
      ? normalizeToRegistrableDomain(state.currentPageHostname)
      : '';
    if (currentDomain) state.collapsedStackDomains.add(currentDomain);
    for (const d of state.stackGraphs.keys()) state.collapsedStackDomains.add(d);
  } else if (state.viewMode === 'pinned') {
    // Pinned View: L1 = domain sections. Mark every domain with pins as
    // collapsed; also mark its `__seen::` flag so the auto-collapse
    // logic doesn't re-fire on next render.
    for (const d of getAllDomainsWithPins()) {
      state.pinnedDomainsCollapsed.add(d);
      state.pinnedDomainsCollapsed.add(`__seen::${d}`);
    }
  } else {
    // Stream View: collapse all page groups (single level)
    state.events
      .filter(e => e.isNavigation || e.platform === 'pages')
      .forEach(e => state.collapsedPageGroups.add(e.id));
  }
  render();
}

// Expand all L2 sub-groups (adaptive based on view mode). No-op for
// single-level surfaces — the L2 button is hidden there anyway.
function expandAllSubGroups() {
  if (state.viewMode === 'stack') {
    // Stack View: L2 = platform groups inside each domain.
    state.collapsedStackGroups.clear();
    render();
    return;
  }
  if (state.viewMode === 'pinned') {
    // Pinned View: L2 = group sections inside each domain.
    state.pinnedGroupsCollapsed.clear();
    render();
    return;
  }
  if (state.viewMode !== 'grouped') return;

  if (state.activeGrouping === 'tool') {
    state.collapsedToolGroups.clear();
  } else if (state.activeGrouping === 'page') {
    state.collapsedPageGroups.clear();
  } else {
    // Flat pivots: clear only L2 entries (tail has 1+ colons).
    const prefix = state.activeGrouping + ':';
    for (const key of Array.from(state.collapsedGroupedGroups)) {
      if (!key.startsWith(prefix)) continue;
      const tail = key.slice(prefix.length);
      if (tail.includes(':')) state.collapsedGroupedGroups.delete(key);
    }
  }
  render();
}

// Collapse all L2 sub-groups (adaptive based on view mode).
function collapseAllSubGroups() {
  if (state.viewMode === 'stack') {
    // Stack View: L2 = platform groups (TMS / parent platforms with
    // children) inside each domain. Walk every cached graph and add a
    // composite `<domain>|<platformId>` key for each node that has children.
    for (const [domain, graph] of state.stackGraphs.entries()) {
      if (!graph || !graph.nodes) continue;
      for (const node of graph.nodes.values()) {
        if (node.platformId && node.children && node.children.length > 0) {
          state.collapsedStackGroups.add(`${domain}|${node.platformId}`);
        }
      }
    }
    render();
    return;
  }
  if (state.viewMode === 'pinned') {
    // Pinned View: L2 = group sections inside each domain. Walk every
    // (domain, group) pair currently rendered.
    for (const domain of getAllDomainsWithPins()) {
      for (const group of getGroupsForDomain(domain)) {
        state.pinnedGroupsCollapsed.add(`${domain}::${group.id}`);
      }
    }
    render();
    return;
  }
  if (state.viewMode !== 'grouped') return;
  const filteredEvents = getFilteredEvents();

  if (state.activeGrouping === 'tool') {
    const platformGroups = groupEventsByPlatform(filteredEvents, pid => platformToCategory[pid] || 'unknown');
    platformGroups.forEach(g => state.collapsedToolGroups.add(g.platformId));
  } else if (state.activeGrouping === 'page') {
    const pageGroups = groupEventsByPage(filteredEvents);
    pageGroups.forEach(g => state.collapsedPageGroups.add(g.page.id));
  } else {
    // Flat pivots: walk filtered events, build (parent, sub) pairs from the
    // descriptor, store as compound `<grouping>:<parent>:<sub>` keys.
    // Both groupKey and subGroupKey may return either a single key or an
    // array — the Identity pivot fans one event out across multiple
    // identifier-kind parents AND multiple values within a kind. Match the
    // array-or-single contract used by the renderer in grouped-flat-view.js
    // so the compound keys we add line up with the ones it reads.
    const grouping = getGrouping(state.activeGrouping);
    if (!grouping || typeof grouping.subGroupKey !== 'function') return;
    const ctx = buildGroupingCtx(filteredEvents);
    const events = typeof grouping.eventFilter === 'function'
      ? filteredEvents.filter(grouping.eventFilter)
      : filteredEvents;
    const seen = new Set();
    for (const ev of events) {
      const parentKeyOrKeys = grouping.groupKey(ev, ctx);
      if (parentKeyOrKeys == null) continue;
      const parentKeys = Array.isArray(parentKeyOrKeys) ? parentKeyOrKeys : [parentKeyOrKeys];
      for (const parentKey of parentKeys) {
        if (parentKey == null) continue;
        const subKeyOrKeys = grouping.subGroupKey(ev, parentKey, ctx);
        if (subKeyOrKeys == null) continue;
        const subKeys = Array.isArray(subKeyOrKeys) ? subKeyOrKeys : [subKeyOrKeys];
        for (const subKey of subKeys) {
          if (subKey == null) continue;
          const compound = parentKey + ':' + subKey;
          if (seen.has(compound)) continue;
          seen.add(compound);
          state.collapsedGroupedGroups.add(state.activeGrouping + ':' + compound);
        }
      }
    }
  }
  render();
}

// Build the descriptor `ctx` used by groupKey / subGroupKey / eventFilter.
// Mirrors the per-render ctx in the Grouped render path so collapse-all
// operations resolve buckets identically to what's actually shown.
function buildGroupingCtx(filteredEvents) {
  // Per-render eventId → page hostname map (endpoint_host pivot needs it).
  const eventToPageHost = new Map();
  const chronological = [...filteredEvents].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  let walkPageHost = state.currentPageHostname || '';
  for (const ev of chronological) {
    if (ev.isNavigation || ev.platform === 'pages') {
      try {
        const navUrl = ev.raw?.url || ev.eventName || '';
        walkPageHost = new URL(navUrl).hostname || walkPageHost;
      } catch { /* keep prior host */ }
    }
    eventToPageHost.set(ev.id, walkPageHost);
  }
  return {
    getCategoryForPlatform: (pid) => platformToCategory[pid] || 'unknown',
    getConsentCheckForEvent,
    getPageHostnameForEvent: (ev) => eventToPageHost.get(ev.id) || state.currentPageHostname || '',
  };
}

// ============================================================================
// TOOL VIEW - Collapse toggle functions
// ============================================================================

// Toggle category group collapse state (Tool View)
function toggleCategoryGroupCollapse(category) {
  if (state.collapsedCategoryGroups.has(category)) {
    state.collapsedCategoryGroups.delete(category);
  } else {
    state.collapsedCategoryGroups.add(category);
  }
  updateExpandCollapseButtonState();
  render();
}

// Toggle a group in the flat grouped renderer (event_name, consent_category, …).
// Keys are namespaced by grouping id so different pivots can share collapse
// state in one Set without colliding.
function toggleGroupedFlatCollapse(groupKey) {
  const namespaced = state.activeGrouping + ':' + groupKey;
  if (state.collapsedGroupedGroups.has(namespaced)) {
    state.collapsedGroupedGroups.delete(namespaced);
  } else {
    state.collapsedGroupedGroups.add(namespaced);
  }
  updateExpandCollapseButtonState();
  render();
}

// Toggle tool/platform group collapse state (Tool View)
function toggleToolGroupCollapse(platformId) {
  if (state.collapsedToolGroups.has(platformId)) {
    state.collapsedToolGroups.delete(platformId);
  } else {
    state.collapsedToolGroups.add(platformId);
  }
  updateExpandCollapseButtonState();
  render();
}

// ============================================================================
// PAGE VIEW - Collapse toggle and clear functions
// ============================================================================

// Auto-collapse previous pages/domains when a new page navigation arrives
// This keeps the view clean by collapsing old content when new pages load
function autoCollapsePreviousPages(newPageEvent) {
  // Get hostname from the new page event
  const newUrl = newPageEvent.raw?.url || newPageEvent.eventName || '';
  let newHostname = '';
  try {
    newHostname = new URL(newUrl).hostname;
  } catch {
    // If URL parsing fails, extract hostname from path-like eventName
    newHostname = newUrl.split('/')[0] || '';
  }

  // Find all existing page events (excluding the new one)
  const existingPageEvents = state.events.filter(e =>
    (e.isNavigation || e.platform === 'pages') && e.id !== newPageEvent.id
  );

  if (existingPageEvents.length === 0) return;

  // Collapse all previous pages on the same domain
  // Also track if we're navigating to a new domain
  let previousDomains = new Set();

  for (const pageEvent of existingPageEvents) {
    const pageUrl = pageEvent.raw?.url || pageEvent.eventName || '';
    let pageHostname = '';
    try {
      pageHostname = new URL(pageUrl).hostname;
    } catch {
      pageHostname = pageUrl.split('/')[0] || '';
    }

    // Collapse this page
    state.collapsedPageGroups.add(pageEvent.id);

    // Track domains we've seen
    if (pageHostname) {
      previousDomains.add(pageHostname);
    }
  }

  // If navigating to a different domain, collapse previous domains
  if (newHostname && !previousDomains.has(newHostname)) {
    // Collapse all previous domains
    for (const hostname of previousDomains) {
      state.collapsedDomains.add(hostname);
    }
  }

  // Update expand/collapse button state after auto-collapse
  updateExpandCollapseButtonState();
}

// Toggle domain collapse state (Page View)
function toggleDomainCollapse(hostname) {
  if (state.collapsedDomains.has(hostname)) {
    state.collapsedDomains.delete(hostname);
  } else {
    state.collapsedDomains.add(hostname);
  }
  updateExpandCollapseButtonState();
  render();
}

// Clear a single page and its events (Page View)
function clearPage(pageId) {
  const pageGroups = groupEventsByPage(state.events);
  const targetGroup = pageGroups.find(g => g.page.id === pageId);
  if (!targetGroup) return;

  // Collect all event IDs to remove (page event + its tracking events)
  const idsToRemove = new Set([
    targetGroup.page.id,
    ...targetGroup.events.map(e => e.id)
  ]);

  // Remove from state.events
  state.events = state.events.filter(e => !idsToRemove.has(e.id));

  // Clean up collapse state
  state.collapsedPageGroups.delete(pageId);

  // If selected event was in this page, deselect
  if (idsToRemove.has(state.selectedEventId)) {
    state.selectedEventId = null;
  }

  // Recalculate detected platforms from remaining events
  rebuildDetectedPlatforms();
  render();
}

// Clear a domain and all its pages/events (Page View)
function clearDomain(hostname) {
  const pageGroups = groupEventsByPage(state.events);
  const idsToRemove = new Set();

  for (const group of pageGroups) {
    let groupHostname = 'unknown';
    try {
      groupHostname = new URL(group.page.raw?.url || '').hostname;
    } catch {
      const match = (group.page.raw?.url || '').match(/^https?:\/\/([^\/]+)/);
      groupHostname = match ? match[1] : 'unknown';
    }

    if (groupHostname === hostname) {
      idsToRemove.add(group.page.id);
      group.events.forEach(e => idsToRemove.add(e.id));
      state.collapsedPageGroups.delete(group.page.id);
    }
  }

  // Remove from state.events
  state.events = state.events.filter(e => !idsToRemove.has(e.id));
  state.collapsedDomains.delete(hostname);

  // If selected event was in this domain, deselect
  if (idsToRemove.has(state.selectedEventId)) {
    state.selectedEventId = null;
  }

  // Recalculate detected platforms from remaining events
  rebuildDetectedPlatforms();
  render();
}

// Rebuild detected platforms from remaining events (after clearing)
function rebuildDetectedPlatforms() {
  state.detectedPlatforms.clear();
  state.platformCounts = {};
  state.categoryCounts = {};

  state.events.forEach(event => {
    if (event.isNavigation || event.platform === 'pages' || event.isInteraction) return;
    const platform = event.platform;
    if (platform) {
      state.detectedPlatforms.add(platform);
      state.platformCounts[platform] = (state.platformCounts[platform] || 0) + 1;
      const category = platformToCategory[platform] || 'unknown';
      state.categoryCounts[category] = (state.categoryCounts[category] || 0) + 1;
    }
  });
}

// Toggle stream direction (newest on top vs bottom)
function toggleStreamDirection() {
  state.streamDirection = state.streamDirection === 'newest-top' ? 'newest-bottom' : 'newest-top';
  chrome.storage.local.set({ streamDirection: state.streamDirection });
  // Save as "last used" for next session
  saveLastUsed('streamDirection', state.streamDirection);
  updateStreamDirectionButton();
  render();
}

// Update stream direction button UI
function updateStreamDirectionButton() {
  if (elements.streamDirectionBtn) {
    const isNewestTop = state.streamDirection === 'newest-top';
    elements.streamDirectionBtn.dataset.direction = state.streamDirection;
    elements.streamDirectionBtn.title = isNewestTop
      ? 'Newest events on top (click to show oldest on top)'
      : 'Oldest events on top (click to show newest on top)';
  }
}

// Update L1 expand/collapse button to reflect actual state of current view.
// Reads only L1 state; the L2 button is updated separately below.
function updateExpandCollapseButtonState() {
  if (elements.expandCollapseBtn) {
    let isExpanded = true;

    if (state.viewMode === 'grouped' && state.activeGrouping === 'tool') {
      isExpanded = state.collapsedCategoryGroups.size === 0;
    } else if (state.viewMode === 'grouped' && state.activeGrouping === 'page') {
      isExpanded = state.collapsedDomains.size === 0;
    } else if (state.viewMode === 'grouped') {
      // Flat pivots: any L1 collapsed entry has a tail with no colons.
      const prefix = state.activeGrouping + ':';
      isExpanded = ![...state.collapsedGroupedGroups].some(k => {
        if (!k.startsWith(prefix)) return false;
        return !k.slice(prefix.length).includes(':');
      });
    } else if (state.viewMode === 'tree') {
      isExpanded = state.collapsedScriptGroups.size === 0;
    } else if (state.viewMode === 'stack') {
      // Stack: L1 = domain sections.
      isExpanded = state.collapsedStackDomains.size === 0;
    } else if (state.viewMode === 'pinned') {
      // Pinned: L1 = domain sections. The `__seen::` markers are
      // bookkeeping (not actual collapse state) — ignore them.
      isExpanded = ![...state.pinnedDomainsCollapsed].some(k => !k.startsWith('__seen::'));
    } else {
      // Stream View
      isExpanded = state.collapsedPageGroups.size === 0;
    }

    elements.expandCollapseBtn.dataset.state = isExpanded ? 'expanded' : 'collapsed';
    elements.expandCollapseBtn.title = isExpanded ? 'Collapse all groups' : 'Expand all groups';
    elements.expandCollapseBtn.setAttribute('aria-label', isExpanded ? 'Collapse all groups' : 'Expand all groups');
  }

  updateExpandCollapseSubBtnState();
}

// Update the L2 sub-group expand/collapse button. Hidden in single-level
// surfaces (Stream, Script Tree, and any future flat pivot without
// `subGroupKey`). State reflects whether any L2 sub-group is currently
// collapsed.
function updateExpandCollapseSubBtnState() {
  if (!elements.expandCollapseSubBtn) return;

  // Visibility — meaningful in 2-level Grouped views, plus Stack / Pinned
  // (which both render domain → group/platform hierarchies).
  let shouldShow = false;
  if (state.viewMode === 'grouped') {
    if (state.activeGrouping === 'tool' || state.activeGrouping === 'page') {
      shouldShow = true;
    } else {
      const grouping = getGrouping(state.activeGrouping);
      shouldShow = !!(grouping && typeof grouping.subGroupKey === 'function');
    }
  } else if (state.viewMode === 'stack' || state.viewMode === 'pinned') {
    shouldShow = true;
  }
  elements.expandCollapseSubBtn.classList.toggle('hidden', !shouldShow);
  if (!shouldShow) return;

  // State — any L2 sub-group collapsed?
  let isExpanded = true;
  if (state.viewMode === 'stack') {
    isExpanded = state.collapsedStackGroups.size === 0;
  } else if (state.viewMode === 'pinned') {
    isExpanded = state.pinnedGroupsCollapsed.size === 0;
  } else if (state.activeGrouping === 'tool') {
    isExpanded = state.collapsedToolGroups.size === 0;
  } else if (state.activeGrouping === 'page') {
    isExpanded = state.collapsedPageGroups.size === 0;
  } else {
    // Flat pivots: an L2 collapsed entry has 1+ colons in its tail.
    const prefix = state.activeGrouping + ':';
    isExpanded = ![...state.collapsedGroupedGroups].some(k => {
      if (!k.startsWith(prefix)) return false;
      return k.slice(prefix.length).includes(':');
    });
  }

  elements.expandCollapseSubBtn.dataset.state = isExpanded ? 'expanded' : 'collapsed';
  elements.expandCollapseSubBtn.title = isExpanded ? 'Collapse all sub-groups' : 'Expand all sub-groups';
  elements.expandCollapseSubBtn.setAttribute('aria-label', isExpanded ? 'Collapse all sub-groups' : 'Expand all sub-groups');
}

// Debounced render for batch event processing
// This prevents UI freezes when many events arrive rapidly (e.g., large dataLayer bursts)
let renderPending = false;
let renderTimeout = null;
const RENDER_DEBOUNCE_MS = 16; // ~60fps max render rate

function scheduleRender() {
  if (renderPending) return;
  renderPending = true;

  if (renderTimeout) {
    clearTimeout(renderTimeout);
  }

  renderTimeout = setTimeout(() => {
    renderPending = false;
    renderTimeout = null;
    render();
  }, RENDER_DEBOUNCE_MS);
}

// Check if the event list is scrolled near the bottom (within 50px)
function isScrolledNearBottom() {
  const el = elements.eventList;
  if (!el) return false;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 50;
}

// Render the UI
function render() {
  // Keep body's view-mode attribute in lockstep with state.viewMode so
  // the Pinned-view toolbar swap (and any future per-view CSS) works
  // even on the first paint, before any handleViewModeChange call.
  if (document.body.getAttribute('data-view-mode') !== state.viewMode) {
    document.body.setAttribute('data-view-mode', state.viewMode);
  }
  updatePinnedBtnCount();
  updateStackRefreshStale();
  // Before render: check if we should auto-scroll after (newest-bottom stream view only)
  const shouldAutoScroll = state.viewMode === 'stream' &&
    state.streamDirection === 'newest-bottom' && isScrolledNearBottom();

  // Feature #151: rebuild the Unknown per-host chip buckets before filtering,
  // so getFilteredEvents() and renderUnifiedFilterBar() share one host split.
  updateUnknownHostBuckets();

  const filteredEvents = getFilteredEvents();

  // Update event type counts
  updateEventTypeCounts();

  // Update unified filter bar (categories with tool chips)
  renderUnifiedFilterBar();

  // Sync tool chip visibility with smart search results
  syncToolChipsWithFilteredEvents(filteredEvents);

  // Update collapsed category chips if toolbar is collapsed
  if (state.filterToolbarCollapsed) {
    renderCollapsedCategoryChips();
  }

  // Update Save Preset button visibility
  updateSavePresetButton();

  // Show/hide empty state
  if (filteredEvents.length === 0) {
    elements.emptyState.classList.remove('hidden');
  } else {
    elements.emptyState.classList.add('hidden');
  }

  // Identity-View info banner — flagged once per render, here rather than
  // per-branch, since the visibility condition is a single boolean check.
  // Identity is the only pivot today that fans events into multiple
  // buckets, so the banner explains the inflated bucket counts.
  if (elements.identityInfoBanner) {
    elements.identityInfoBanner.classList.toggle(
      'visible',
      state.viewMode === 'grouped' && state.activeGrouping === 'identity'
    );
  }

  // Render based on view mode
  if (state.viewMode === 'stack') {
    if (elements.scriptTreeInfoBanner) {
      elements.scriptTreeInfoBanner.classList.remove('visible');
    }
    const currentDomain = state.currentPageHostname
      ? normalizeToRegistrableDomain(state.currentPageHostname)
      : '';
    renderStackView(elements.eventList, {
      stackGraphs: state.stackGraphs,
      currentDomain,
      collapsedDomains: state.collapsedStackDomains,
      selectedTool: state.selectedTool,
      onSelectTool: handleStackSelectTool,
      onGenerate: handleStackGenerate,
      onToggleDomain: handleStackToggleDomain,
      collapsedGroups: state.collapsedStackGroups,
      onToggleGroup: handleStackToggleGroup,
    });
  } else if (state.viewMode === 'tree') {
    // Script Tree view - render hierarchical script dependencies
    // When Scripts filter is HIDE, still show all scripts in the tree
    // (they're only hidden from Event Stream, not Script Tree)
    const scriptsFilterIsHide = state.filters.eventTypes.scripts === 'hide';
    // When Clear has been pressed in the Script-view toolbar, render an
    // empty list until Refresh is clicked. Mirrors Stack's generate/clear UX.
    const eventsForTree = state.scriptTreeCleared
      ? []
      : (scriptsFilterIsHide ? state.events : filteredEvents);

    // Show/hide the info banner when scripts are hidden from stream but shown in tree
    if (elements.scriptTreeInfoBanner) {
      const hasScripts = state.events.some(e => e.isScriptLoad);
      elements.scriptTreeInfoBanner.classList.toggle('visible', scriptsFilterIsHide && hasScripts);
    }

    renderScriptTreeView(
      elements.eventList,
      eventsForTree,
      state.selectedEventId,
      handleEventSelect,
      {
        highlightedPlatforms: state.highlightedPlatforms,
        onScriptTreeContextMenu: showScriptTreeContextMenu
      }
    );
  } else if (state.viewMode === 'grouped' && state.activeGrouping === 'tool') {
    // Tool grouping (legacy Tool View) - events grouped by category then platform
    if (elements.scriptTreeInfoBanner) {
      elements.scriptTreeInfoBanner.classList.remove('visible');
    }

    renderToolView(
      elements.eventList,
      filteredEvents,
      state.selectedEventId,
      handleEventSelect,
      {
        collapsedCategoryGroups: state.collapsedCategoryGroups,
        collapsedToolGroups: state.collapsedToolGroups,
        onToggleCategoryCollapse: toggleCategoryGroupCollapse,
        onToggleToolCollapse: toggleToolGroupCollapse,
        highlightedPlatforms: state.highlightedPlatforms,
        onEventContextMenu: showPlatformContextMenu,
        onInteractionContextMenu: showInteractionContextMenu,
        // Bridge legacy event-list.js callsite to the unified group menu (#61).
        onCategoryContextMenu: (e, platformIds, { category, categoryPlatforms } = {}) => {
          const ids = new Set(categoryPlatforms || platformIds || []);
          const eventIds = filteredEvents.filter(ev => ids.has(ev.platform)).map(ev => ev.id);
          const displayName = PLATFORM_CATEGORIES[category]?.name || category || 'Category';
          showGroupContextMenu(e, { groupingId: 'tool', displayName, eventIds });
        },
        onToolContextMenu: (e, platformIds, { platform } = {}) => {
          const pid = platform || (platformIds && platformIds[0]);
          const eventIds = filteredEvents.filter(ev => ev.platform === pid).map(ev => ev.id);
          const displayName = PLATFORM_NAMES[pid] || pid || 'Tool';
          showGroupContextMenu(e, { groupingId: 'tool', displayName, eventIds });
        },
        getCategoryForPlatform: (pid) => platformToCategory[pid] || 'unknown',
        categoryMeta: PLATFORM_CATEGORIES,
        categoryIcons: CATEGORY_ICONS_PATHS,
        sortMode: state.sortMode
      }
    );
  } else if (state.viewMode === 'grouped' && state.activeGrouping === 'page') {
    // Page grouping (legacy Page View) - events grouped by domain then page
    if (elements.scriptTreeInfoBanner) {
      elements.scriptTreeInfoBanner.classList.remove('visible');
    }

    renderPageView(
      elements.eventList,
      filteredEvents,
      state.selectedEventId,
      handleEventSelect,
      {
        collapsedDomains: state.collapsedDomains,
        collapsedPageGroups: state.collapsedPageGroups,
        onToggleDomainCollapse: toggleDomainCollapse,
        onTogglePageCollapse: togglePageCollapse,
        highlightedPlatforms: state.highlightedPlatforms,
        onEventContextMenu: showPlatformContextMenu,
        onInteractionContextMenu: showInteractionContextMenu,
        onPageContextMenu: showPageContextMenu,
        // Bridge domain header to the unified group menu (#61).
        // Match the same hostname-extraction logic used by the page renderer
        // so the eventIds set lines up with what the user sees in the group.
        onDomainContextMenu: (e, hostname) => {
          const pageGroups = groupEventsByPage(filteredEvents);
          const domainEventIds = [];
          for (const group of pageGroups) {
            let pageHostname = 'unknown';
            try {
              pageHostname = new URL(group.page.raw?.url || '').hostname;
            } catch {
              const match = (group.page.raw?.url || '').match(/^https?:\/\/([^\/]+)/);
              pageHostname = match ? match[1] : 'unknown';
            }
            if (pageHostname === hostname) {
              for (const ev of group.events) domainEventIds.push(ev.id);
            }
          }
          showGroupContextMenu(e, { groupingId: 'page', displayName: hostname, eventIds: domainEventIds });
        },
        onClearDomain: clearDomain,
        onClearPage: clearPage,
        sortMode: state.sortMode,
        showTriggerCorrelation: state.showTriggerCorrelation,
        consentStateMarkers: state.consentStateMarkers
      }
    );
  } else if (state.viewMode === 'grouped') {
    // Flat grouping pivot (event_name, consent_category, datalayer, endpoint_host, …)
    if (elements.scriptTreeInfoBanner) {
      elements.scriptTreeInfoBanner.classList.remove('visible');
    }
    const grouping = getGrouping(state.activeGrouping);
    if (grouping) {
      renderFlatGroupedView(
        elements.eventList,
        filteredEvents,
        state.selectedEventId,
        handleEventSelect,
        grouping,
        {
          collapsedGroups: state.collapsedGroupedGroups,
          onToggleGroupCollapse: toggleGroupedFlatCollapse,
          onEventContextMenu: showPlatformContextMenu,
          // #61 — wire the unified group menu for flat pivots (event_name, consent_category).
          onGroupContextMenu: (e, key, eventsInGroup) => {
            showGroupContextMenu(e, {
              groupingId: state.activeGrouping,
              displayName: grouping.groupLabel(key, eventsInGroup),
              eventIds: eventsInGroup.map(ev => ev.id),
            });
          },
          highlightedPlatforms: state.highlightedPlatforms,
          sortMode: state.sortMode,
          ctx: buildGroupingCtx(filteredEvents),
        }
      );
    }
  } else if (state.viewMode === 'pinned') {
    // Pinned view (Feature #45) — multi-domain Stack-style layout with
    // groups, inline notes, and right-click affordances. Pins persist in
    // chrome.storage.local under `pinned_state` and survive
    // `clearEvents()` and page reloads.
    if (elements.scriptTreeInfoBanner) {
      elements.scriptTreeInfoBanner.classList.remove('visible');
    }
    renderPinnedView(elements.eventList);
    applyPinnedMultiSelectClasses();
  } else {
    // Event Stream view (default) - chronological event list
    // Hide the script tree info banner when in Event Stream view
    if (elements.scriptTreeInfoBanner) {
      elements.scriptTreeInfoBanner.classList.remove('visible');
    }
    renderEventList(
      elements.eventList,
      filteredEvents,
      state.selectedEventId,
      handleEventSelect,
      {
        showTriggerCorrelation: state.showTriggerCorrelation,
        sortMode: state.sortMode,
        collapsedPageGroups: state.collapsedPageGroups,
        onTogglePageCollapse: togglePageCollapse,
        streamDirection: state.streamDirection,
        highlightedPlatforms: state.highlightedPlatforms,
        onEventContextMenu: streamRowContextMenu,
        onInteractionContextMenu: showInteractionContextMenu,
        onPageContextMenu: showPageContextMenu,
        consentStateMarkers: state.consentStateMarkers
      }
    );
    // Apply the multi-select highlight class. Done as a post-render pass
    // so we don't have to plumb the selection through the event-list
    // component's render API.
    applyStreamMultiSelectClasses(filteredEvents);
  }

  // Render right-hand detail pane.
  // Stack view: tool-aggregate detail when a tool node is selected.
  // Other views: event detail (or consent-marker detail for consent rows).
  //
  // Feature #113: skip the detail re-render entirely if a section-card
  // drag is in flight (user is reordering sections via the four-dot
  // handle). Rebuilding the detail DOM mid-drag would destroy the active
  // drag target and break the gesture. Stream list + the rest of the
  // panel keep updating normally.
  if (isSectionDragInFlight()) {
    // Skip detail re-render; everything else above this point ran fine.
  } else if (state.viewMode === 'stack' && state.selectedTool) {
    const targetGraph = state.stackGraphs.get(state.selectedTool.domain);
    if (targetGraph) {
      renderStackToolDetail(
        elements.eventDetail,
        targetGraph,
        state.selectedTool.platformId,
        { source: state.selectedTool.source || null }
      );
    } else {
      // Selected tool's domain has no graph (cleared, or never generated
      // on this domain) — fall through to the empty event-detail state.
      renderEventDetail(elements.eventDetail, null, { showTriggerCorrelation: state.showTriggerCorrelation });
    }
  } else {
    // Fallback to a pinned snapshot when the live event is gone — this
    // keeps the detail pane populated after Clear empties state.events
    // while the user is on a pinned row.
    const pinDomain = getCurrentPinDomain();
    const selectedEvent = state.events.find(e => e.id === state.selectedEventId)
      || state.consentStateMarkers.find(m => m.id === state.selectedEventId)
      || (pinDomain ? getPinnedSnapshotById(state.selectedEventId, pinDomain) : null);
    renderEventDetail(elements.eventDetail, selectedEvent, { showTriggerCorrelation: state.showTriggerCorrelation });
  }

  // Auto-scroll to bottom in newest-bottom stream view when user was already at the bottom
  if (shouldAutoScroll) {
    elements.eventList.scrollTop = elements.eventList.scrollHeight;
  }
}

// Handle event selection. `clickEvent` is optional (callers without a
// native event can omit it — programmatic selection bypasses the
// multi-select machinery and just sets the detail-pane row).
function handleEventSelect(eventId, clickEvent, pinnedDomain) {
  // Pinned-view multi-select. Mirrors Stream's Shift/Ctrl semantics but
  // is scoped to a single domain — clicking a pin in a different domain
  // resets the selection. `pinnedDomain` is threaded through the row
  // onSelect closure in renderPinnedGroupSection; on a click outside of
  // Pinned view it's omitted and this branch is skipped.
  if (state.viewMode === 'pinned' && clickEvent && pinnedDomain) {
    if (state.pinnedSelectionDomain && state.pinnedSelectionDomain !== pinnedDomain) {
      state.pinnedSelectedEventIds.clear();
      state.pinnedSelectionAnchor = null;
      state.pinnedSelectionDomain = null;
    }
    if (clickEvent.shiftKey && state.pinnedSelectionAnchor && state.pinnedSelectionDomain === pinnedDomain) {
      const order = getVisiblePinIdsInDomain(pinnedDomain);
      const idxA = order.indexOf(state.pinnedSelectionAnchor);
      const idxB = order.indexOf(eventId);
      if (idxA >= 0 && idxB >= 0) {
        const lo = Math.min(idxA, idxB);
        const hi = Math.max(idxA, idxB);
        state.pinnedSelectedEventIds = new Set();
        for (let i = lo; i <= hi; i++) state.pinnedSelectedEventIds.add(order[i]);
      } else {
        state.pinnedSelectedEventIds = new Set([eventId]);
        state.pinnedSelectionAnchor = eventId;
      }
    } else if (clickEvent.ctrlKey || clickEvent.metaKey) {
      if (state.pinnedSelectedEventIds.has(eventId)) {
        state.pinnedSelectedEventIds.delete(eventId);
      } else {
        state.pinnedSelectedEventIds.add(eventId);
      }
      state.pinnedSelectionAnchor = eventId;
    } else {
      state.pinnedSelectedEventIds = new Set([eventId]);
      state.pinnedSelectionAnchor = eventId;
    }
    state.pinnedSelectionDomain = pinnedDomain;
  } else if (state.viewMode !== 'pinned' && state.pinnedSelectedEventIds.size > 0) {
    state.pinnedSelectedEventIds.clear();
    state.pinnedSelectionAnchor = null;
    state.pinnedSelectionDomain = null;
  }

  // Multi-select gestures only apply in Stream view — Pinned / Grouped /
  // Tree / Stack don't have a useful range selection model.
  if (state.viewMode === 'stream' && clickEvent) {
    if (clickEvent.shiftKey && state.streamSelectionAnchor) {
      // Shift-click: range select between anchor and the clicked row.
      // Range covers events in current filter+sort order so the visual
      // band matches what the user sees on screen.
      const anchorId = state.streamSelectionAnchor;
      const visible = getFilteredEvents();
      const idxA = visible.findIndex(ev => ev.id === anchorId);
      const idxB = visible.findIndex(ev => ev.id === eventId);
      if (idxA >= 0 && idxB >= 0) {
        const lo = Math.min(idxA, idxB);
        const hi = Math.max(idxA, idxB);
        // Replace the set with the range (matches OS file-manager Shift-click
        // semantics — it's a range, not an additive operation).
        state.streamSelectedEventIds = new Set();
        for (let i = lo; i <= hi; i++) {
          state.streamSelectedEventIds.add(visible[i].id);
        }
      } else {
        // Anchor or clicked row is no longer visible (filters changed) —
        // fall back to single-select.
        state.streamSelectedEventIds = new Set([eventId]);
        state.streamSelectionAnchor = eventId;
      }
    } else if (clickEvent.ctrlKey || clickEvent.metaKey) {
      // Ctrl/Cmd-click: toggle this row's membership without affecting
      // the rest of the selection. Updates the anchor so a subsequent
      // Shift-click ranges from the toggled row.
      if (state.streamSelectedEventIds.has(eventId)) {
        state.streamSelectedEventIds.delete(eventId);
      } else {
        state.streamSelectedEventIds.add(eventId);
      }
      state.streamSelectionAnchor = eventId;
    } else {
      // Plain click: clear multi-select and set just this row as the
      // (single-element) selection plus the new anchor.
      state.streamSelectedEventIds = new Set([eventId]);
      state.streamSelectionAnchor = eventId;
    }
  } else if (state.viewMode !== 'stream') {
    // Leaving Stream — drop any lingering multi-selection so re-entering
    // the view starts fresh.
    if (state.streamSelectedEventIds.size > 0) {
      state.streamSelectedEventIds.clear();
      state.streamSelectionAnchor = null;
    }
  }

  state.selectedEventId = eventId;
  // Mutual exclusion with Stack tool selection — clicking an event always
  // wins, so the right pane shows the event detail, not a stale tool panel.
  state.selectedTool = null;

  // Track event selection — unified across tool / page / consent-marker rows;
  // `type` segments them in Amplitude, `tool` and `category` carry context
  // when the selected row is a tracked tool event. Falls back to the
  // pinned snapshot when the live event has been cleared.
  const pinDomain = getCurrentPinDomain();
  const selectedEvent = state.events.find(e => e.id === eventId)
    || (pinDomain ? getPinnedSnapshotById(eventId, pinDomain) : null);
  if (selectedEvent) {
    if (selectedEvent.platform === 'pages') {
      trackEvent('event_select', { type: 'page' });
    } else {
      trackEvent('event_select', {
        type: 'tool',
        tool: selectedEvent.platform,
        category: getCategoryForPlatform(selectedEvent.platform)
      });
      // Engagement signal for the Review Prompt — tool selects are the
      // strongest "they're actually inspecting" signal we have.
      bumpEngagementAndMaybeAskForReview('toolSelectCount');
    }
  } else if (state.consentStateMarkers.find(m => m.id === eventId)) {
    trackEvent('event_select', { type: 'consent_marker' });
  }

  render();
}

// Stack View — explicit graph generation, per-domain. Builds the
// platform-tree for the given domain (or the current page's domain
// when none is passed) and caches it on state.stackGraphs. Stacks for
// other domains stay intact, so the user can switch back by expanding
// a collapsed domain header. Cleared by clearEvents only.
function handleStackGenerate(targetDomain) {
  const domain = targetDomain
    || (state.currentPageHostname ? normalizeToRegistrableDomain(state.currentPageHostname) : '');
  if (!domain) return;
  // First-build vs Refresh: trigger='first' on the very first generation
  // for a domain, 'refresh' on every rebuild after that. Lets us answer
  // "how often do users need to rebuild before they trust the result?"
  const isFirstBuild = !state.stackGraphs.has(domain);
  // buildStackGraph expects a hostname-like input (it normalises to
  // eTLD+1 internally); passing the eTLD+1 directly works because
  // normalizing it returns the same string.
  const graph = buildStackGraph(state.events, scriptInitiatorMap, domain, scriptChildrenMap);
  // Snapshot the detected-tool count at build time so render() can detect
  // when new tools have been captured since — used to highlight the
  // Refresh Stack button as "stale".
  graph.builtAtToolCount = state.detectedPlatforms.size;
  state.stackGraphs.set(domain, graph);
  // Generating a domain implicitly expands its header.
  state.collapsedStackDomains.delete(domain);
  // Loader-type breakdown — the headline accuracy indicator. A graph
  // dominated by 'unknown' means our attribution failed; one dominated
  // by 'page-source' / 'tag-manager' / 'cdp' / 'daisy-chain' means it
  // landed. Confidence breakdown adds a secondary lens: a graph that's
  // all page-source via 'first-party-recovery' (low confidence) is very
  // different from one that's all page-source via
  // 'website-classification' (high confidence) — both bucket as
  // page-source, only the latter is genuinely trusted.
  let pageSource = 0, tagManager = 0, cdp = 0, daisyChain = 0, unknown = 0;
  let highConf = 0, mediumConf = 0, lowConf = 0;
  for (const node of graph.nodes.values()) {
    if (node.loaderType === 'page-source') pageSource += 1;
    else if (node.loaderType === 'tag-manager') tagManager += 1;
    else if (node.loaderType === 'cdp') cdp += 1;
    else if (node.loaderType === 'daisy-chain') daisyChain += 1;
    else unknown += 1;
    if (node.attributionConfidence === 'high') highConf += 1;
    else if (node.attributionConfidence === 'medium') mediumConf += 1;
    else lowConf += 1;
  }
  trackEvent('stack_generate', {
    trigger: isFirstBuild ? 'first' : 'refresh',
    tool_count: graph.nodes.size,
    event_count: state.events.length,
    page_source_count: pageSource,
    tag_manager_count: tagManager,
    cdp_count: cdp,
    daisy_chain_count: daisyChain,
    unknown_count: unknown,
    high_confidence_count: highConf,
    medium_confidence_count: mediumConf,
    low_confidence_count: lowConf,
  });
  // Render the tree first (so the rest of the panel updates), then play
  // the staged "Building your Stack" animation in this domain's body if
  // there's actually something to show. The animation is purely visual —
  // the tree is already in state, the animation just narrates the
  // strategies that ran. Playing AFTER render keeps the rest of the UI
  // (event list, badges, counters) responsive to other captures during
  // the ~1s the animation takes. When complete, re-render to swap in
  // the actual tree under this domain.
  render();
  if (graph.nodes.size > 0) {
    const sectionEl = elements.eventList?.querySelector(
      `.stack-domain-section[data-domain="${cssEscape(domain)}"] .stack-domain-body`
    );
    if (sectionEl) {
      renderBuildingAnimation(sectionEl, graph, state.events.length, { domainLabel: domain })
        .then(() => {
          // Only re-render if the user is still looking at this domain's
          // graph — guards against the user navigating away mid-animation.
          if (state.stackGraphs.get(domain) !== graph) return;
          render();
          // One-shot reveal animation — scoped via a class so subsequent
          // unrelated re-renders (event stream updates, filter changes)
          // don't replay it.
          const newTree = elements.eventList?.querySelector(
            `.stack-domain-section[data-domain="${cssEscape(domain)}"] .stack-tree-container`
          );
          if (newTree) newTree.classList.add('stack-tree-reveal-animate');
        });
    }
  }
}

// Minimal CSS.escape polyfill — guards against domains with characters
// that break attribute selectors (rare but possible for IDN hosts).
function cssEscape(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
}

// Stack View — tool-node selection. Mutually exclusive with selectedEventId
// so the right-hand detail pane never shows stale event detail underneath
// a Stack click. Tracked separately as `stack_node_click` for analytics.
// `domain` qualifies the selection so the right pane reads from the
// correct domain's graph (multi-domain Stack support). `source` is set
// when the user clicks a multi-source shadow row (e.g. the OneTrust-pushed
// dataLayer copy as distinct from the page-source one) so the right pane
// can scope its content to that specific sender.
function handleStackSelectTool(domain, platformId, source) {
  state.selectedTool = (domain && platformId)
    ? { domain, platformId, source: source || null }
    : null;
  state.selectedEventId = null;
  if (domain && platformId) {
    const graph = state.stackGraphs.get(domain);
    const node = graph?.nodes.get(platformId);
    trackEvent('stack_node_click', {
      tool: platformId,
      category: getCategoryForPlatform(platformId),
      loader_type: node?.loaderType || 'unknown',
      attribution_source: node?.attributionSource || 'unresolved',
      attribution_confidence: node?.attributionConfidence || 'low',
      source: source || null,
    });
  }
  render();
}

// Stack View — collapse / expand a domain's header.
function handleStackToggleDomain(domain) {
  if (!domain) return;
  const wasCollapsed = state.collapsedStackDomains.has(domain);
  if (wasCollapsed) {
    state.collapsedStackDomains.delete(domain);
  } else {
    state.collapsedStackDomains.add(domain);
  }
  trackEvent('stack_domain_toggle', {
    state: wasCollapsed ? 'expand' : 'collapse',
  });
  render();
}

// Stack View — collapse/expand a single platform group inside a domain's
// tree. Key combines domain + platformId so the same TMS appearing under
// two domains can be collapsed independently.
function handleStackToggleGroup(domain, platformId) {
  if (!domain || !platformId) return;
  const key = `${domain}|${platformId}`;
  const wasCollapsed = state.collapsedStackGroups.has(key);
  if (wasCollapsed) {
    state.collapsedStackGroups.delete(key);
  } else {
    state.collapsedStackGroups.add(key);
  }
  trackEvent('stack_group_toggle', {
    state: wasCollapsed ? 'expand' : 'collapse',
  });
  render();
}

// Stack View — toolbar Clear: drop the cached graph for the current
// domain (if any) and any per-group collapse state. Live captured events
// are untouched, so the user can immediately Refresh to rebuild.
function handleStackClear() {
  const domain = state.currentPageHostname
    ? normalizeToRegistrableDomain(state.currentPageHostname)
    : '';
  if (domain && state.stackGraphs.has(domain)) {
    state.stackGraphs.delete(domain);
  }
  // Drop collapse state for this domain's groups so a future build starts clean.
  if (domain) {
    const prefix = `${domain}|`;
    for (const key of [...state.collapsedStackGroups]) {
      if (key.startsWith(prefix)) state.collapsedStackGroups.delete(key);
    }
  }
  state.selectedTool = null;
  trackEvent('stack_clear', { scope: domain ? 'domain' : 'all' });
  render();
}

// Stack View — toolbar Refresh: rebuild the current domain's stack from
// the latest captured events. Thin wrapper around handleStackGenerate
// that picks up the current domain implicitly.
function handleStackRefresh() {
  handleStackGenerate();
}

// Script Tree View — toolbar Clear: blank the tree (renderer shows the
// empty state until Refresh is clicked), drop collapse state, and clear
// any selected script-load event. Live captured events are untouched
// (Stream's Clear handles that) — symmetry with Stack's Clear semantics.
function handleTreeClear() {
  state.scriptTreeCleared = true;
  state.collapsedScriptGroups.clear();
  const selected = state.selectedEventId
    ? state.events.find(e => e.id === state.selectedEventId)
    : null;
  if (selected && selected.isScriptLoad) {
    state.selectedEventId = null;
  }
  trackEvent('tree_clear');
  render();
}

// Script Tree View — toolbar Refresh: rebuild the tree from the latest
// captured events. Lifts the cleared flag so the renderer pulls the live
// event set again. Parallel to Stack's Refresh.
function handleTreeRefresh() {
  state.scriptTreeCleared = false;
  trackEvent('tree_refresh');
  render();
}

// Stack View — toggle the "stale" highlight on the Refresh Stack button
// when more tools have been detected on the current domain since the
// cached stack was built. Compares `state.detectedPlatforms.size` to the
// snapshot stored on the graph at build time. Called from render().
function updateStackRefreshStale() {
  const btn = elements.stackRefreshBtn;
  if (!btn) return;
  const domain = state.currentPageHostname
    ? normalizeToRegistrableDomain(state.currentPageHostname)
    : '';
  const graph = domain ? state.stackGraphs.get(domain) : null;
  let stale = false;
  if (graph && typeof graph.builtAtToolCount === 'number') {
    stale = state.detectedPlatforms.size > graph.builtAtToolCount;
  }
  btn.classList.toggle('stack-refresh-stale', stale);
  btn.title = stale
    ? 'New tools detected since the stack was generated — click to rebuild'
    : 'Rebuild the stack from the latest captured events';
}

// Stack View — quick action: switch to Stream filtered to this platform.
// Reuses the existing platform-filter chip mechanism (hiddenTools cleared
// of this platform; everything else hidden).
function handleStackJumpToStream(platformId) {
  if (!platformId) return;
  // Show only this platform: clear hiddenTools, then hide everything except platformId.
  state.hiddenTools = ALL_PLATFORMS.filter(id => id !== platformId);
  state.activePresetId = null;
  state.activePresetVisibleTools = null;
  state.activePresetOriginalTools = null;
  state.selectedTool = null;
  trackEvent('view_switch', { from: 'stack', to: 'stream', via: 'stack_quick_action' });
  handleViewModeChange('stream');
}

// Stack View — quick action: switch to Grouped/Tool view at this platform.
function handleStackJumpToToolView(platformId) {
  if (!platformId) return;
  state.selectedTool = null;
  trackEvent('view_switch', { from: 'stack', to: 'grouped', via: 'stack_quick_action' });
  handleViewModeChange('grouped', 'tool');
  // After view switch, scroll to the tool group if rendered.
  setTimeout(() => {
    const toolEl = elements.eventList?.querySelector(`[data-platform="${platformId}"]`);
    if (toolEl && typeof toolEl.scrollIntoView === 'function') {
      toolEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 50);
}

// Stack View — copy a node + its parent + children as Markdown.
async function handleStackCopyNode(graph, platformId) {
  const md = buildStackNodeMarkdown(graph, platformId);
  if (!md) return;
  try {
    await navigator.clipboard.writeText(md);
    trackEvent('stack_export', { format: 'markdown_node', tool: platformId });
  } catch (e) {
    // Clipboard may be unavailable — non-critical
  }
}

// Stack View — export dispatch. Text formats (Markdown / Mermaid / JSON)
// copy to clipboard for parity with the rest of the extension's exports
// (Copy JSON, Copy Full Export, etc.) — they're typically pasted into
// docs, AI chats, or issue trackers. SVG and React Flow JSON stay as file
// downloads — SVG is a binary-ish visual artefact, and the MartechStack
// Builder import dialog requires a .json file. Builders live in
// stack-export.js (Markdown / Mermaid / SVG / Stack JSON) and
// reactflow-export.js (MartechStack Builder JSON).
function handleStackExport(format, graph) {
  if (!graph) return;
  const safeDomain = (graph.rootDomain || 'site').replace(/[^a-z0-9.-]/gi, '_');
  if (format === 'markdown') {
    copyToClipboard(buildStackMarkdown(graph));
  } else if (format === 'mermaid') {
    copyToClipboard(buildStackMermaid(graph));
  } else if (format === 'svg') {
    const content = buildStackSvg(graph);
    downloadString(`stack-${safeDomain}.svg`, 'image/svg+xml', content);
  } else if (format === 'json') {
    copyToClipboard(buildStackJSON(graph, state.events, scriptInitiatorMap));
  } else if (format === 'reactflow') {
    // First-encounter gate — same modal as the Copy-All path. If the user
    // hasn't acknowledged before, show the About modal; otherwise save
    // straight away.
    hasSeenMartechStackInfo().then((seen) => {
      const proceed = () => {
        // Pass the real attribution graph so the export uses captured
        // parent-child relationships (e.g. Tealium → GTM when Tealium is
        // the loader) instead of falling back to the hardcoded TM priority.
        const payload = buildReactFlowJSON({ rootDomain: graph.rootDomain, graph });
        if (!payload) return;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        downloadString(
          `martechstack-builder-import-${safeDomain}-${timestamp}.json`,
          'application/json',
          JSON.stringify(payload, null, 2)
        );
      };
      if (seen) {
        proceed();
      } else {
        showMartechStackBuilderInfo({
          onProceed: ({ dontShowAgain }) => {
            if (dontShowAgain) markMartechStackInfoSeen();
            proceed();
          },
        });
      }
    });
  }
  trackEvent('stack_export', { format });
}

// Find the most recent Data Layer or GTM trigger event that could have triggered this tracking event
function findTriggeringDataLayerEvent(timestamp, eventName) {
  // Look for trigger events within the correlation window BEFORE this event
  let bestMatch = null;
  let bestMatchTimeDiff = Infinity;

  for (let i = state.recentDataLayerEvents.length - 1; i >= 0; i--) {
    const dlEvent = state.recentDataLayerEvents[i];
    const timeDiff = timestamp - dlEvent.timestamp;

    // Trigger event must be BEFORE the tracking event
    if (timeDiff < 0) continue;

    // Check if event names are equivalent (e.g., dataLayer 'page_view' -> Facebook 'PageView')
    // Also handles GTM triggers like 'gtm.scrollDepth' -> GA4 'scroll'
    const namesMatch = areEventNamesEquivalent(eventName, dlEvent.eventName);

    // Use extended window for matching/equivalent names, standard window otherwise
    const standardWindow = state.correlationWindows?.standardWindowMs ?? CORRELATION_WINDOW_MS;
    const nameMatchWindow = state.correlationWindows?.matchingNameWindowMs ?? CORRELATION_WINDOW_MATCHING_NAME_MS;
    const maxWindow = namesMatch ? nameMatchWindow : standardWindow;

    if (timeDiff <= maxWindow) {
      // Prefer name matches over time-based matches
      if (namesMatch) {
        return dlEvent; // Name match - return immediately
      }
      // Otherwise track the closest time match
      if (timeDiff < bestMatchTimeDiff) {
        bestMatch = dlEvent;
        bestMatchTimeDiff = timeDiff;
      }
    }
  }

  return bestMatch;
}

// =============================================================================
// CONSENT TIMELINE — builds consent state from cookies, GCM, and CMP events
// =============================================================================

/**
 * Add an entry to the consent timeline (sorted by timestamp, append-only).
 * Invalidates cached consent checks on events the new entry can affect.
 * @param {import('../shared/event-shape.js').ConsentTimelineEntry} entry
 */
function addConsentTimelineEntry(entry) {
  // Sorted insert + firstConsentTimestamp update + scoped _consentCheck cache
  // invalidation (#131 F3) live in consent-engine.js — the policy rationale is
  // documented there, next to the single implementation the tests import.
  insertConsentTimelineEntry(state, entry);
  // Update consent check count
  updateConsentCounter();
  // Rebuild consent state markers from updated timeline
  state.consentStateMarkers = rebuildConsentStateMarkers(state.consentTimeline);
}

/**
 * Read consent cookies for the current page and add to timeline.
 * Called on panel open and after consent events.
 */
async function readAndProcessConsentCookies() {
  try {
    // Route cookie reading through service worker where chrome.cookies is guaranteed
    const cookieStates = await new Promise(resolve => {
      chrome.runtime.sendMessage(
        { type: MSG.READ_CONSENT_COOKIES, tabId: chrome.devtools.inspectedWindow.tabId },
        resolve
      );
    });
    if (!cookieStates || Object.keys(cookieStates).length === 0) return;

    state.consentCookieState = cookieStates;

    // Add timeline entries for each CMP cookie found
    let timelineChanged = false;
    for (const [cmp, rawCategories] of Object.entries(cookieStates)) {
      // Strip parser signal flag before storing categories
      const hasUnmapped = rawCategories._hasUnmappedCategories;
      const categories = { ...rawCategories };
      delete categories._hasUnmappedCategories;
      const completeness = hasUnmapped ? 'partial' : 'full';

      // Check if we already have a cookie entry for this CMP
      const existing = state.consentTimeline.find(e => e.source === 'cookie' && e.cmp === cmp);
      if (existing) {
        const categoriesChanged = JSON.stringify(existing.categories) !== JSON.stringify(categories);
        // If cookie was written mid-session (detected via chrome.cookies.onChanged),
        // add a timestamped entry. This handles both actual state changes and re-confirmations
        // where the user interacted with the CMP but ended with the same categories.
        if (consentCookieWriteDetected) {
          addConsentTimelineEntry({
            timestamp: consentCookieWriteTimestamp || Date.now(),
            source: 'cookie',
            sourceLabel: `${cmp} cookie`,
            completeness,
            cmp,
            action: categoriesChanged ? 'update' : 'confirmed',
            categories: { ...categories },
          });
        }
        // Invalidate cached consent checks
        for (const ev of state.events) {
          delete ev._consentCheck;
        }
        updateConsentCounter();
        timelineChanged = true;
      } else {
        if (consentCookieWriteDetected) {
          // Cookie was just written mid-session (first-time visitor accepted consent).
          // NOT a pre-existing cookie — use actual timestamp, not T=0.
          addConsentTimelineEntry({
            timestamp: consentCookieWriteTimestamp || Date.now(),
            source: 'cookie',
            sourceLabel: `${cmp} cookie`,
            completeness,
            cmp,
            action: 'update',
            categories: { ...categories },
          });
        } else {
          // Cookie existed before session started — returning visitor
          addConsentTimelineEntry({
            timestamp: 0, // Cookie = prior consent, T=0
            source: 'cookie',
            sourceLabel: `${cmp} cookie`,
            completeness,
            cmp,
            action: 'prior-consent',
            categories,
          });
        }
        // Invalidate cached consent checks — events that arrived before this
        // cookie read still have stale checks (e.g., binary lifecycle instead of full)
        for (const ev of state.events) {
          delete ev._consentCheck;
        }
        updateConsentCounter();
        timelineChanged = true;
      }
    }

    // Retroactively fix OneTrust push data entries that arrived before cookie state.
    // Push data can't distinguish "denied" from "not configured", but the cookie can.
    for (const [cmp, categories] of Object.entries(cookieStates)) {
      if (cmp === 'OneTrust') {
        const knownCats = new Set(Object.keys(categories));
        for (const entry of state.consentTimeline) {
          if (entry.cmp === 'OneTrust' && entry.source === 'cmp-push' && entry.categories) {
            for (const cat of ['analytics', 'marketing', 'functional']) {
              if (!knownCats.has(cat)) delete entry.categories[cat];
            }
          }
        }
      }
    }

    // Reset the cookie-write flag and timestamp after processing
    consentCookieWriteDetected = false;
    consentCookieWriteTimestamp = 0;

    // Re-render event list to update consent badges after async cookie data arrives
    if (timelineChanged) {
      scheduleRender();
    }
  } catch {
    // Cookie reading failed — silently ignore
  }
}

/**
 * Filter OneTrust push data categories to remove categories that don't exist on the site.
 * Push data only lists active groups, so we can't distinguish "denied" from "not configured".
 * Uses cookie state or window-api timeline entries (which know ALL configured groups) to filter.
 * Mutates the categories object in place.
 */
function filterOneTrustCategories(categories) {
  // Check cookie state first — the cookie lists ALL configured groups (even denied ones as :0)
  const cookieState = state.consentCookieState?.['OneTrust'];
  if (cookieState) {
    for (const cat of ['analytics', 'marketing', 'functional']) {
      if (!(cat in cookieState)) delete categories[cat];
    }
    return;
  }
  // Fallback: check window-api timeline entry (uses GetDomainData to know configured groups)
  const windowEntry = state.consentTimeline.find(e => e.cmp === 'OneTrust' && e.source === 'window-api');
  if (windowEntry?.categories) {
    for (const cat of ['analytics', 'marketing', 'functional']) {
      if (!(cat in windowEntry.categories)) delete categories[cat];
    }
  }
}

/**
 * Debounce Cookie Information's individual cookie_cat_* events and re-read cookies.
 * Cookie Information fires separate dataLayer events per category within milliseconds.
 * We debounce to avoid reading cookies multiple times and to let the CMP settle.
 */
function aggregateCookieInfoEvent() {
  // Routes through the shared debounce (see scheduleConsentCookieReprocess) so a
  // Cookie Information per-category burst can't run readAndProcessConsentCookies()
  // concurrently with a chrome.cookies.onChanged-triggered reprocess (N8).
  // The cookie is the authoritative source for category state — re-reading
  // handles both actual consent changes and re-confirmations.
  scheduleConsentCookieReprocess();
}

/**
 * Process an event for consent timeline entries.
 * Called from addEvent() for each new event.
 */
function processEventForConsentTimeline(event) {
  const gcm = event.formatted?.googleConsentMode;
  const consentEvent = event.formatted?.consentEvent;
  const pushData = event.formatted?.pushData;
  const isHistorical = event.formatted?.isHistorical;

  // Google Consent Mode (consent:default / consent:update)
  if (gcm && gcm.params) {
    const categories = normalizeGCMToCategories(gcm.params);
    if (categories) {
      addConsentTimelineEntry({
        timestamp: isHistorical ? 0 : event.timestamp,
        source: 'google-cm',
        sourceLabel: `Google Consent Mode (${gcm.action})`,
        completeness: 'full',
        cmp: 'Google Consent Mode',
        action: gcm.action === 'update' ? 'update' : 'default',
        categories,
      });

      // Promote GCM consent:update to a CMP-priority entry when a CMP is detected.
      // When a user accepts consent, the CMP calls gtag('consent', 'update', {...}) which
      // creates a google-cm entry (Priority 4). But tags fire immediately after this update,
      // often before the CMP's window API reflects the new state (window-api is Priority 1).
      // This creates false violations: the stale window-api "denied" overrides the correct
      // GCM "granted". Since the consent:update originates FROM the CMP, it IS a CMP signal
      // routed through Google's API — so promoting it to cmp-push (Priority 1) is correct.
      // Only promote when: it's an update (not default), a CMP is detected, and at least one
      // category changed to granted.
      if (gcm.action === 'update' && !isHistorical && state.detectedCMP) {
        const hasGranted = Object.entries(categories).some(([k, v]) =>
          v === 'granted' && ['analytics', 'marketing', 'functional'].includes(k));
        if (hasGranted) {
          // Only include the 3 consent categories (strip ad_user_data, ad_personalization)
          const cmpCategories = {};
          if (categories.analytics) cmpCategories.analytics = categories.analytics;
          if (categories.marketing) cmpCategories.marketing = categories.marketing;
          if (categories.functional) cmpCategories.functional = categories.functional;
          addConsentTimelineEntry({
            timestamp: event.timestamp,
            source: 'cmp-push',
            sourceLabel: `${state.detectedCMP.tool} (via Consent Mode)`,
            completeness: Object.keys(cmpCategories).length >= 2 ? 'full' : 'partial',
            cmp: state.detectedCMP.tool,
            action: 'update',
            categories: cmpCategories,
          });
        }
      }
    }
  }

  // CMP push data with parseable consent state
  if (consentEvent && pushData) {
    // OneTrust: OnetrustActiveGroups
    const oneTrustState = parseOneTrustPushData(pushData);
    if (oneTrustState) {
      // Filter out categories that don't exist on this site (e.g., site has no C0003/Functional).
      // Push data only lists active groups, so we can't distinguish "denied" from "not configured".
      // Cross-reference with cookie or window-api data which knows the configured groups.
      filterOneTrustCategories(oneTrustState);
      if (Object.keys(oneTrustState).length > 0) {
        addConsentTimelineEntry({
          timestamp: isHistorical ? 0 : event.timestamp,
          source: 'cmp-push',
          sourceLabel: 'OneTrust (dataLayer)',
          completeness: 'full',
          cmp: 'OneTrust',
          action: 'update',
          categories: oneTrustState,
        });
      }
    }

    // Cookie Information: handled by aggregateCookieInfoEvent() below — individual cookie_cat_*
    // events each contain only one category, so parseCookieInfoPushData would produce wrong results.
    // The aggregator collects all cookie_cat_* events within a time window and flushes once.
    const cookieInfoState = null;

    // Usercentrics: ucCategory in consent_status push
    const ucState = parseUsercentricsData(pushData);
    if (ucState) {
      const hasUnmapped = ucState._hasUnmappedCategories;
      delete ucState._hasUnmappedCategories;
      addConsentTimelineEntry({
        timestamp: isHistorical ? 0 : event.timestamp,
        source: 'cmp-push',
        sourceLabel: 'Usercentrics (dataLayer)',
        // Mark partial when custom UUID categories couldn't be resolved from push data —
        // the window-api probe will provide the full picture via getCategoriesBaseInfo()
        completeness: hasUnmapped ? 'partial' : 'full',
        cmp: 'Usercentrics',
        action: 'update',
        categories: ucState,
      });
    }

    // Didomi: didomi-consent / didomi-ready push carries comma-separated purpose lists
    // (didomiPurposesEnabled / didomiPurposesDisabled). Parse them into full category
    // state so Didomi gets a 'full' cmp-push entry instead of falling through to the
    // binary lifecycle branch (which loses category detail and causes false 'denied'
    // violations on accept). See BUG55.
    const didomiState = parseDidomiPushData(pushData);
    if (didomiState) {
      const hasUnmapped = didomiState._hasUnmappedCategories;
      delete didomiState._hasUnmappedCategories;
      addConsentTimelineEntry({
        timestamp: isHistorical ? 0 : event.timestamp,
        source: 'cmp-push',
        sourceLabel: 'Didomi (dataLayer)',
        completeness: hasUnmapped ? 'partial' : 'full',
        cmp: 'Didomi',
        action: 'update',
        categories: didomiState,
      });
    }

    // Cookie Information fires individual cookie_cat_* events per ACCEPTED category.
    // Aggregate them within a time window to build full consent state.
    const eventName = (event.formatted?.event || '').toLowerCase();
    const isCookieInfoCatEvent = consentEvent.tool === 'Cookie Information' &&
      (eventName.startsWith('cookie_cat_') || eventName.startsWith('cookie_consent_'));
    if (isCookieInfoCatEvent) {
      aggregateCookieInfoEvent();
    } else if (!oneTrustState && !cookieInfoState && !ucState && !didomiState && consentEvent.tool !== 'Google Consent Mode') {
      // Binary consent events (Cookiebot accept/decline, Didomi, iubenda)
      // Skip Google Consent Mode — it creates its own google-cm entries (Priority 4),
      // not CMP lifecycle events. Without this guard, GCM set commands (ads_data_redaction etc.)
      // create spurious cmp-lifecycle 'decline' entries that override correct lower-priority sources.
      const tool = consentEvent.tool || '';
      const category = consentEvent.category || '';
      const isAccept = category.toLowerCase().includes('accept') ||
                       category.toLowerCase().includes('consent_given') ||
                       category.toLowerCase().includes('consent-changed');
      addConsentTimelineEntry({
        timestamp: isHistorical ? 0 : event.timestamp,
        source: 'cmp-lifecycle',
        sourceLabel: `${tool} (${category})`,
        completeness: 'binary',
        cmp: tool,
        action: isAccept ? 'accept' : 'decline',
      });

      // After a consent event, re-read cookies to get category-level detail
      readAndProcessConsentCookies();
    }
  }
}

/**
 * Process CMP consent state from window API probing (page script).
 * Called when GET_EVENTS response includes a cmpConsentState payload.
 * Adds or updates a 'window-api' entry in the consent timeline.
 * @param {Object} data - { cmp, id, categories, hasInteracted, timestamp }
 */
let lastProcessedCMPStateJSON = null;
function processCMPConsentState(data) {
  if (!data) return;
  // Deduplicate: only process if state has changed (exclude timestamp from comparison)
  const { timestamp: _ts, ...stateForCompare } = data;
  const stateJSON = JSON.stringify(stateForCompare);
  if (stateJSON === lastProcessedCMPStateJSON) return;
  lastProcessedCMPStateJSON = stateJSON;

  const entry = {
    timestamp: data.timestamp || Date.now(),
    source: 'window-api',
    sourceLabel: `${data.cmp} (window API)`,
    cmp: data.cmp,
    action: data.hasInteracted ? 'update' : 'default',
  };

  if (data.categories) {
    entry.completeness = 'full';
    entry.categories = data.categories;
  } else {
    // CMP detected but consent state not available (banner showing, no choice yet)
    entry.completeness = 'binary';
    // Keep action from hasInteracted check above — 'default' means pre-consent (yellow),
    // not 'decline' which would be a red violation. User hasn't made a choice yet.
  }

  // Update detected CMP
  if (data.cmp && !state.detectedCMP) {
    state.detectedCMP = { tool: data.cmp, source: 'window-api' };
  }

  addConsentTimelineEntry(entry);

  // Retroactively fix OneTrust push data entries that arrived before window-api state.
  // When the window API reveals which groups are configured, remove non-existent categories
  // from earlier cmp-push entries (same logic as the cookie arrival path).
  if (data.cmp === 'OneTrust' && entry.completeness === 'full' && entry.categories) {
    const knownCats = new Set(Object.keys(entry.categories));
    for (const existing of state.consentTimeline) {
      if (existing !== entry && existing.cmp === 'OneTrust' && existing.source === 'cmp-push' && existing.categories) {
        for (const cat of ['analytics', 'marketing', 'functional']) {
          if (!knownCats.has(cat)) delete existing.categories[cat];
        }
      }
    }
    // Invalidate cached consent checks so they're recomputed with corrected data
    for (const ev of state.events) { delete ev._consentCheck; }
  }
}

/**
 * Update the unified consent counter based on current filter mode.
 * AUTO: count violations (denied + pre-consent)
 * ONLY: count all consent-annotated events (signals + checked tracking)
 * OFF: hide counter
 *
 * Single pass over state.events (#131 F3): builds state.platformConsentCounts
 * (the per-platform { denied, warning } tallies feeding the feature #73
 * warning pill on each tool chip) and the session-counter tallies in one
 * walk — one getConsentCheckForEvent() call per event instead of two.
 * Both use the same severity vocabulary:
 *  - denied  = check.status === 'denied' && !check.cookielessPing
 *  - warning = pre-consent | unknown | (denied + cookielessPing) | (granted + gcmMismatch)
 *
 * Platform counts rebuild unconditionally on every refresh — the consent
 * filter mode (`auto`/`only`/`hide`/`off`) only gates the *render*, not the
 * aggregation, so switching the filter to OFF and back doesn't lose state.
 */
function updateConsentCounter() {
  const mode = state.filters.eventTypes.consent || 'auto';

  // Per-platform severity counts are always rebuilt — the rendering layer in
  // filter-bar.js gates on consent mode independently, so the map stays
  // accurate even when the session counter is hidden.
  const platformCounts = {};
  // Session counter tallies are only meaningful for auto/hide/only.
  const tallyMode = (mode === 'auto' || mode === 'hide') ? 'violations'
    : mode === 'only' ? 'annotated' : null;
  let count = 0;
  let deniedCount = 0;
  let warningCount = 0;

  for (const event of state.events) {
    // 'only' mode counts consent signal events without needing a check
    if (tallyMode === 'annotated' && isConsentEvent(event)) {
      count++;
      if (!event.platform) continue;
    }

    const check = getConsentCheckForEvent(event);
    if (!check) continue;

    if (event.platform) {
      let bucket = null;
      if (check.status === 'denied') {
        bucket = check.cookielessPing ? 'warning' : 'denied';
      } else if (check.status === 'pre-consent' || check.status === 'unknown') {
        bucket = 'warning';
      } else if (check.status === 'granted' && check.gcmMismatch) {
        bucket = 'warning';
      }
      if (bucket) {
        if (!platformCounts[event.platform]) platformCounts[event.platform] = { denied: 0, warning: 0 };
        platformCounts[event.platform][bucket]++;
      }
    }

    if (tallyMode === 'violations') {
      // Auto: show violation count. Hide: same — consent events hidden but violations still counted.
      if (check.status === 'denied') {
        count++;
        if (check.cookielessPing) warningCount++;
        else deniedCount++;
      } else if (check.status === 'pre-consent' || check.status === 'unknown') {
        count++;
        warningCount++;
      } else if (check.status === 'granted' && check.gcmMismatch) {
        count++;
        warningCount++;
      }
    } else if (tallyMode === 'annotated' && !isConsentEvent(event)) {
      if (check.status !== 'exempt') {
        count++;
        if (check.status === 'denied') {
          if (check.cookielessPing) warningCount++;
          else deniedCount++;
        }
        else if (check.status === 'pre-consent' || check.status === 'unknown') warningCount++;
        else if (check.status === 'granted' && check.gcmMismatch) warningCount++;
      }
    }
  }
  state.platformConsentCounts = platformCounts;

  if (!elements.consentCount) return;

  if (mode === 'off') {
    elements.consentCount.style.display = 'none';
    state.consentSeverity = null;
    state.consentSeverityCount = 0;
    return;
  }

  elements.consentCount.style.display = '';

  elements.consentCount.textContent = count;

  // Severity-based counter color: red > yellow > default (teal)
  elements.consentCount.classList.remove('consent-severity-denied', 'consent-severity-warning');
  let severity = null;
  let severityCount = 0;
  if (deniedCount > 0) {
    severity = 'denied';
    severityCount = deniedCount + warningCount;
    elements.consentCount.textContent = severityCount;
    elements.consentCount.classList.add('consent-severity-denied');
  } else if (warningCount > 0) {
    severity = 'warning';
    severityCount = warningCount;
    elements.consentCount.textContent = severityCount;
    elements.consentCount.classList.add('consent-severity-warning');
  }

  // Store for collapsed chip access
  state.consentSeverity = severity;
  state.consentSeverityCount = severityCount;
}


/**
 * Refresh the "stream trimmed" banner (#131 F5). Visible whenever the cap
 * has evicted anything this session; cleared by clearEvents().
 */
function updateTrimmedBanner() {
  if (!elements.streamTrimmedBanner) return;
  const n = state.trimmedEventCount;
  elements.streamTrimmedBanner.classList.toggle('visible', n > 0);
  if (n > 0) {
    const span = elements.streamTrimmedBanner.querySelector('span');
    if (span) {
      span.textContent = `Stream trimmed — the oldest ${n.toLocaleString()} events were removed to keep the panel responsive (cap: ${MAX_EVENTS.toLocaleString()}). Pinned events are never trimmed.`;
    }
  }
}

/**
 * Enforce the MAX_EVENTS cap (#131 F5) — evict the oldest chunk when the
 * stream exceeds the cap. Head eviction preserves the timestamp-ordering
 * invariant the scoped consent invalidation (F3) relies on. Derived counts
 * are reconciled via rebuildDetectedPlatforms() — the same canonical recount
 * partial clears use — so counter drift cannot happen. knownEventIds is
 * deliberately NOT pruned (evicted ids must stay known or service-worker
 * polling would re-add the events); pins are independent snapshots and
 * survive by construction.
 */
function enforceEventCap() {
  const evictCount = computeEvictCount(state.events.length);
  if (evictCount === 0) return;
  const evicted = state.events.splice(0, evictCount);
  state.trimmedEventCount += evicted.length;

  // Prune per-event references in surviving UI state
  const pinDomain = getCurrentPinDomain();
  const evictedIds = new Set();
  for (const ev of evicted) {
    evictedIds.add(ev.id);
    state.streamSelectedEventIds.delete(ev.id);
    if (state.streamSelectionAnchor === ev.id) state.streamSelectionAnchor = null;
    if (state.selectedEventId === ev.id) {
      // Mirror clearEvents(): keep the selection when it points at a pinned
      // snapshot (the snapshot outlives the live event), otherwise drop it.
      const selectionIsPinned = pinDomain && getPinnedSnapshotById(ev.id, pinDomain);
      if (!selectionIsPinned) state.selectedEventId = null;
    }
  }

  // Prune script-relationship maps for evicted events (#138 F14). The maps are
  // keyed by scriptUrl and grow with unique script loads in a long SPA session;
  // entries whose owning event has been evicted are orphans no surviving event
  // will look up. tealiumTagConfig is left untouched — see pruneScriptMaps().
  pruneScriptMaps(evictedIds, { scriptInitiatorMap, scriptChildrenMap, scriptUrlToEventId });

  // Canonical recount of platform/category counts + detected-platform roster
  rebuildDetectedPlatforms();
  // Consent tallies (state.platformConsentCounts, the session violation count,
  // state.consentSeverityCount) are rebuilt only by a full pass over
  // state.events. Without this, evicted events keep over-counting the consent
  // counter + #73 warning pills until the next consent/filter trigger fires —
  // which may never come in a chatty session (N4, feature #139).
  updateConsentCounter();
  updateTrimmedBanner();
}

/**
 * Single funnel for every captured event - all ~49 parsers route through
 * here via _deps.addEvent. Assigns id/timestamps when absent, then applies
 * trigger correlation. The event shape contract lives in
 * shared/event-shape.js (#135 WP2) - document new load-bearing fields there.
 * @param {import('../shared/event-shape.js').CapturedEvent} event
 */
function addEvent(event) {
  // Skip events if capture is paused or stopped
  if (state.captureState !== 'play') {
    return;
  }

  // Track matched events and tools for performance stats (before page load freezes)
  if (!pageLoadComplete && event.platform) {
    perfStats.matchCount++;
    perfStats.matchedTools.add(event.platform);
  }

  // Get timestamps - priority: direct > raw (from HAR) > now
  // This ensures correct chronological ordering based on when the event actually occurred
  const timestamp = event.timestamp || event.raw?.timestamp || Date.now();
  // For network requests, finishTimestamp = start + duration; for dataLayer events, finish = start
  const finishTimestamp = event.finishTimestamp || event.raw?.finishTimestamp || timestamp;
  const duration = event.duration || event.raw?.duration || 0;

  const enrichedEvent = {
    ...event,
    id: event.id || crypto.randomUUID(),
    timestamp: timestamp,           // When event started
    finishTimestamp: finishTimestamp, // When event finished (for network requests)
    duration: duration              // Duration in ms (for network requests)
  };

  // Track trigger events for correlation:
  // 1. Data Layer events (website-set data structures that cause tracking tags to fire)
  // 2. GTM trigger events (built-in triggers like scrollDepth, click, formSubmit)
  const isDataLayerTrigger = DATA_LAYER_PLATFORMS.includes(enrichedEvent.platform);
  const isGTMTrigger = GTM_TRIGGER_EVENTS.includes(enrichedEvent.eventName);

  if (isDataLayerTrigger || isGTMTrigger) {
    state.recentDataLayerEvents.push({
      id: enrichedEvent.id,
      timestamp: enrichedEvent.timestamp,
      eventName: enrichedEvent.eventName,
      pushIndex: enrichedEvent.formatted?.pushIndex || enrichedEvent.formatted?.eventIndex,
      platform: enrichedEvent.platform,
      isGTMTrigger: isGTMTrigger
    });
    // Keep only last 50 events
    if (state.recentDataLayerEvents.length > 50) {
      state.recentDataLayerEvents.shift();
    }
  }

  // Try to link non-trigger events to their triggering Data Layer or GTM event
  // Skip: dataLayer events, GTM triggers, and GTM load/init events
  const shouldCorrelate = !enrichedEvent.isInteraction && !isDataLayerTrigger && !isGTMTrigger &&
    !UNCORRELATABLE_EVENTS.includes(enrichedEvent.eventName);

  if (shouldCorrelate) {
    const triggeringDL = findTriggeringDataLayerEvent(enrichedEvent.timestamp, enrichedEvent.eventName);
    if (triggeringDL) {
      enrichedEvent.triggeredBy = {
        dataLayerEventId: triggeringDL.id,
        dataLayerEventName: triggeringDL.eventName,
        dataLayerPushIndex: triggeringDL.pushIndex,
        dataLayerPlatform: triggeringDL.platform,
        timeDelta: enrichedEvent.timestamp - triggeringDL.timestamp
      };
    }
  }

  state.events.push(enrichedEvent);
  // Feature #81 Phase 2 — dev-only auto-publish to the MCP bridge. No-op in
  // CWS installs (setter is only flipped on when installType === 'development').
  notifyEventListChanged();

  // Incrementally update platform/category counts (avoids O(n) full-scan per render)
  if (!enrichedEvent.isNavigation && enrichedEvent.platform !== 'pages' && !enrichedEvent.isInteraction) {
    const platform = enrichedEvent.platform;
    state.platformCounts[platform] = (state.platformCounts[platform] || 0) + 1;
    state.detectedPlatforms.add(platform);
    const category = getCategoryForPlatform(platform);
    state.categoryCounts[category] = (state.categoryCounts[category] || 0) + 1;
  }

  // Enforce the stream cap (#131 F5) AFTER the incremental count update —
  // the eviction recount includes the just-added event, so running it before
  // the increment would double-count the new arrival.
  enforceEventCap();

  // Track detected GTM containers for the Intercept feature
  if (enrichedEvent.platform === 'gtm' && enrichedEvent.formatted?.containerId) {
    const containerId = enrichedEvent.formatted.containerId;
    if (!state.detectedGTMContainers.has(containerId)) {
      state.detectedGTMContainers.add(containerId);
      // Update GTM button state when a new container is first detected
      updateGTMButtonState();
      // Notify GTM Hub modal so it can refresh if open
      document.dispatchEvent(new CustomEvent('gtmContainerDetected'));
    }
    // Annotate events from intercepted containers
    annotateInterceptedEvent(enrichedEvent);
  }

  // Process event for consent timeline (GCM, CMP push data, lifecycle events)
  processEventForConsentTimeline(enrichedEvent);

  // Auto-collapse previous pages/domains when a new page event arrives (only in Page grouping)
  if ((enrichedEvent.isNavigation || enrichedEvent.platform === 'pages')
      && state.viewMode === 'grouped' && state.activeGrouping === 'page') {
    autoCollapsePreviousPages(enrichedEvent);
  }

  // Update total count in collapsed filter toolbar
  updateFilterToolbarTotalCount();

  // Auto-select if it's the first event
  if (state.events.length === 1) {
    state.selectedEventId = enrichedEvent.id;
  }

  // Show the What's New bubble (for upgraders) on the first captured
  // event so the tour steps that anchor on event-detail surfaces have
  // real events to point at. Fresh installs never have the flag set,
  // so this is a no-op for them — the onboarding tour runs instead.
  scheduleWhatsNew();

  // Debounce the onboarding tour trigger so the initial event burst can settle
  // before the bubble appears. Each new event resets the timer; the tour starts
  // 1.5s after the last new event.
  scheduleOnboardingTour();

  // Use debounced render to prevent UI freezes during rapid event bursts
  scheduleRender();
}

// Module-level onboarding scheduling state — the debounce timer is reset by
// each new event, and `_onboardingAttempted` stops further scheduling once
// we've started the tour or determined it's not needed.
let _onboardingDebounceTimer = null;
let _onboardingAttempted = false;
const ONBOARDING_EVENT_BURST_MS = 1500;

// Once-per-session flag so the What's New bubble (if one is pending in
// storage) is shown exactly once on first captured event. Deferring to
// first event means the user sees events in the stream behind the
// bubble, which lets the tour steps anchor on event-detail surfaces.
let _whatsNewAttempted = false;
let _whatsNewDebounceTimer = null;
const WHATS_NEW_EVENT_BURST_MS = 1500;

// Snapshot of state.activePresetVisibleTools + state.hiddenTools captured
// when the onboarding tour's filter step demos a "Show only" on the last
// category. Read by demoFilterRestore() on tour exit so the user's prior
// filter setup is put back exactly. Module-local because the tour itself
// loads as a classic script and can't see panel.js's `state`.
let _filterDemoBackup = null;

/**
 * Schedule the What's New bubble check after the initial event burst
 * settles. Each new event resets the timer; the bubble appears ~1.5s
 * after the last new event. No-op after the first successful attempt
 * in a session, and no-op if `window.WhatsNew` isn't loaded or the
 * `_whatsNew` storage flag isn't set.
 */
function scheduleWhatsNew() {
  if (_whatsNewAttempted) return;
  if (!window.WhatsNew) return;

  if (_whatsNewDebounceTimer) {
    clearTimeout(_whatsNewDebounceTimer);
  }
  _whatsNewDebounceTimer = setTimeout(() => {
    _whatsNewDebounceTimer = null;
    _whatsNewAttempted = true;
    window.WhatsNew.checkAndShow({
      trackEventFn: trackEvent,
      hooks: {
        openReport: () => openReportModal()
      }
    }).catch(() => { /* non-critical */ });
  }, WHATS_NEW_EVENT_BURST_MS);
}

/**
 * Schedule the onboarding tour to start after the event burst settles.
 * Called from addEvent() for every new event until the tour has been
 * attempted. The debounce window means the bubble won't cover up events
 * that are still arriving during initial page load.
 */
function scheduleOnboardingTour() {
  if (_onboardingAttempted) return;
  if (!window.OnboardingTour || window.OnboardingTour.isActive()) return;

  if (_onboardingDebounceTimer) {
    clearTimeout(_onboardingDebounceTimer);
  }
  _onboardingDebounceTimer = setTimeout(async () => {
    _onboardingDebounceTimer = null;
    // Defer if the What's New bubble is still visible — the next event will
    // re-schedule. This keeps the two overlays from stacking.
    if (window.WhatsNew && window.WhatsNew.isActive()) return;
    // Defer if a tour is already running (e.g. the user clicked "Take the
    // tour" on the What's New bubble). OnboardingTour serves both the base
    // onboarding tour and the What's New tour — calling start() while active
    // is a no-op anyway, but this keeps the reason hint unconsumed so it
    // gets handled on a later scheduler pass.
    if (window.OnboardingTour && window.OnboardingTour.isActive()) return;
    try {
      const settings = await loadSettings();
      const completedVersion = settings.onboardingCompletedVersion || 0;
      const extendedCompletedVersion = settings.onboardingExtendedCompletedVersion || 0;
      const panelOpens = settings.onboardingPanelOpenCount || 0;
      _onboardingAttempted = true; // Only attempt once per session regardless of outcome

      // One-shot reason hint from the What's New bubble — set on dismiss (or
      // when the user took the What's New tour). Consumed here even if nothing
      // runs, so it doesn't linger for future sessions.
      const { _tourReasonHint } = await chrome.storage.local.get('_tourReasonHint');
      if (_tourReasonHint) {
        chrome.storage.local.remove('_tourReasonHint');
      }

      // Upgraders skip the base onboarding tour entirely — the What's New
      // tour (triggered from the upgrade bubble or replayable from Settings)
      // handles their education. Persist completion so the guard stays
      // satisfied across sessions even if they skipped the What's New tour.
      if (_tourReasonHint === 'upgrade') {
        if (completedVersion < window.OnboardingTour.TOUR_VERSION) {
          updateSetting('onboardingCompletedVersion', window.OnboardingTour.TOUR_VERSION);
        }
        return;
      }

      if (completedVersion < window.OnboardingTour.TOUR_VERSION) {
        // Fresh install path — base tour not done yet, show it first.
        window.OnboardingTour.start({
          trackEventFn: trackEvent,
          onComplete: (version) => updateSetting('onboardingCompletedVersion', version),
          reason: _tourReasonHint || 'auto'
        });
      } else if (
        extendedCompletedVersion < window.OnboardingTour.TOUR_VERSION_EXTENDED
        && panelOpens >= 10
      ) {
        // Base tour done + user has enough time in-app → auto-trigger the extended tour.
        window.OnboardingTour.startExtended({
          trackEventFn: trackEvent,
          onComplete: (version) => updateSetting('onboardingExtendedCompletedVersion', version),
          reason: 'auto_extended'
        });
      }
    } catch (e) {
      // Non-critical — onboarding failure must not block the panel
    }
  }, ONBOARDING_EVENT_BURST_MS);
}

// ===== Pinned view (Feature #45 Phase 1) =====

// Returns the registrable domain used as the per-domain key for pinned
// state, or null when we don't yet know the inspected page's host.
function getCurrentPinDomain() {
  const host = state.currentPageHostname;
  if (!host) return null;
  return normalizeToRegistrableDomain(host) || host;
}

// Update the small counter inside the Pinned view-mode button. Reflects
// how many events are pinned for the currently active domain. Called on
// render(), navigation, and after every pin/unpin (via subscribePinnedState).
function updatePinnedBtnCount() {
  const el = document.getElementById('pinned-btn-count');
  if (!el) return;
  const domain = getCurrentPinDomain();
  const count = domain ? getPinnedCountForDomain(domain) : 0;
  el.textContent = String(count);
  el.dataset.empty = count === 0 ? 'true' : 'false';
}

// Click handler for the in-row pushpin. Toggles persistence; the
// subscribePinnedState listener re-renders the affected view.
async function handleTogglePin(event) {
  const domain = getCurrentPinDomain();
  if (!domain || !event) return;
  const wasPinned = isEventPinned(event, domain);
  await togglePinnedState(event, domain);
  trackEvent(wasPinned ? 'unpin_event' : 'pin_event', {
    platform: event.platform,
    event_type: event.platform === 'interaction' ? 'interaction' : 'tracking',
  });
}

// Re-render whenever pin state changes so Stream view's in-row indicator
// and the Pinned view stay in sync without callers having to remember to
// trigger render() themselves.
//
// Coalesce bursts of `persist()` calls (bulk-pin, drag-and-drop a row that
// touches multiple records, bulk-delete that touches many pins at once) into
// a single render via a microtask. We use
// `queueMicrotask` rather than `setTimeout(0)` so a single user gesture
// still re-renders before the next paint — no visual lag, no thrash.
let _pinRenderScheduled = false;
subscribePinnedState(() => {
  if (_pinRenderScheduled) return;
  _pinRenderScheduled = true;
  queueMicrotask(() => {
    _pinRenderScheduled = false;
    try { render(); } catch (_) { /* defensive: subscribe fires after every persist */ }
  });
});

// ===== Stream-view multi-select + bulk pin =====

// Drop stale ids from the selection set when the underlying filter changed
// (e.g., the user adjusted a filter and some selected rows are no longer
// visible). Keeps the visible-row indicators honest.
function pruneStreamSelectionToVisible(visibleEvents) {
  if (state.streamSelectedEventIds.size === 0) return;
  const visibleIds = new Set(visibleEvents.map(ev => ev.id));
  const next = new Set();
  for (const id of state.streamSelectedEventIds) {
    if (visibleIds.has(id)) next.add(id);
  }
  state.streamSelectedEventIds = next;
  if (state.streamSelectionAnchor && !visibleIds.has(state.streamSelectionAnchor)) {
    state.streamSelectionAnchor = null;
  }
}

function applyStreamMultiSelectClasses(visibleEvents) {
  pruneStreamSelectionToVisible(visibleEvents);
  if (state.streamSelectedEventIds.size === 0) return;
  for (const id of state.streamSelectedEventIds) {
    const row = elements.eventList.querySelector(`.event-item[data-event-id="${CSS.escape(id)}"]`);
    if (row) row.classList.add('multi-selected');
  }
}

// Bulk-pin trigger. Used by the in-row pin button when the clicked row is
// part of a multi-selection: pins every unpinned event in the selection
// in one gesture. Already-pinned events stay pinned (no toggle to avoid
// accidental data loss). Returns the number of new pins created.
async function pinAllSelectedEvents() {
  const domain = getCurrentPinDomain();
  if (!domain || state.streamSelectedEventIds.size < 2) return 0;
  const targets = state.events.filter(ev => state.streamSelectedEventIds.has(ev.id));
  if (targets.length === 0) return 0;
  let pinnedCount = 0;
  for (const ev of targets) {
    if (isEventPinned(ev, domain)) continue;
    await pinEventIntoGroup(ev, domain, 'inbox');
    pinnedCount++;
  }
  if (pinnedCount > 0) {
    trackEvent('pin_batch', {
      target_count: targets.length,
      pinned_count: pinnedCount,
      skipped_count: targets.length - pinnedCount,
      source: 'selection',
    });
  }
  // Clear the selection on bulk-pin so the user gets a fresh starting
  // state — matches the "click a button, the gesture is consumed" idiom.
  state.streamSelectedEventIds.clear();
  state.streamSelectionAnchor = null;
  return pinnedCount;
}

// Returns true when `eventId` is part of an active multi-selection in
// Stream view (size >= 2). Used by the in-row pin button to decide
// whether a click should pin one or all.
export function isPartOfStreamMultiSelection(eventId) {
  return state.viewMode === 'stream'
    && state.streamSelectedEventIds.size >= 2
    && state.streamSelectedEventIds.has(eventId);
}

// Wrapper used as the Stream-view event-row right-click handler. Threads
// the active multi-selection (when 2+ rows are selected and the
// right-clicked row is one of them) through to showPlatformContextMenu
// so per-event copy actions can target the bulk.
function streamRowContextMenu(e, platform, eventId) {
  let bulkIds = null;
  if (state.streamSelectedEventIds.size >= 2 && state.streamSelectedEventIds.has(eventId)) {
    bulkIds = Array.from(state.streamSelectedEventIds);
  }
  showPlatformContextMenu(e, platform, eventId, false, bulkIds);
}

// Bulk variant of togglePinForEvent. Called by event-list.js when the
// pin button is clicked on a row that's part of a multi-selection.
export function togglePinForMultiSelection() {
  return pinAllSelectedEvents();
}

// Escape clears Stream's or Pinned's multi-selection. Listening at
// document level so the shortcut works whether or not the event list is
// focused. Skip when a typing target is focused so we don't steal Esc
// from inputs/modals.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
  if (state.viewMode === 'stream' && state.streamSelectedEventIds.size > 0) {
    state.streamSelectedEventIds.clear();
    state.streamSelectionAnchor = null;
    render();
  } else if (state.viewMode === 'pinned' && state.pinnedSelectedEventIds.size > 0) {
    state.pinnedSelectedEventIds.clear();
    state.pinnedSelectionAnchor = null;
    state.pinnedSelectionDomain = null;
    render();
  }
});

// ----- Pinned-view toolbar handlers -----

// Create Group — prompts for a name and persists. Uses the styled prompt
// modal so the input style matches the rest of the panel's modals.
async function handleCreateGroup() {
  const domain = getCurrentPinDomain();
  if (!domain) {
    alert('Open a page first — pinned groups live per domain.');
    return;
  }
  const name = await showPromptDialog({
    title: 'New group',
    message: `Groups live under ${domain}. Drag pinned events onto a group to organise them.`,
    placeholder: 'Group name',
    confirmLabel: 'Create',
  });
  if (!name) return;
  await createPinnedGroup(domain, name);
  trackEvent('pinned_view', { action: 'group_create' });
  // subscribePinnedState fires render
  // Make sure the user is on Pinned view to see the result
  if (state.viewMode !== 'pinned') {
    handleViewModeChange('pinned');
  }
}

async function handlePinnedClearAll() {
  const domain = getCurrentPinDomain();
  if (!domain) return;
  // eslint-disable-next-line no-alert
  const ok = window.confirm(
    `Clear all pinned events and groups for ${domain}?\n\nThis cannot be undone. Pinned events on other domains are not affected.`
  );
  if (!ok) return;
  await clearAllPinnedForDomain(domain);
  trackEvent('pinned_view', { action: 'clear_all' });
  // subscribePinnedState fires render
}

// Pinned-view sort modes (BUG52). Mirrors the Stream view's Start/Finish/Index
// modes plus the extra "pinned" (recently-pinned) mode. The label shows the
// CURRENT mode (not the next one) so the button never disagrees with the order
// on screen — the pre-BUG52 config showed the next mode's name, which is what
// made the button read "Event time" while actually sorting by recently-pinned.
const PINNED_SORT_MODES = {
  start:  { label: 'Start',  title: 'Sort by: Request Start Time\nWhen the event/request started' },
  finish: { label: 'Finish', title: 'Sort by: Request Finish Time\nWhen the response was received' },
  index:  { label: 'Index',  title: 'Sort by: Capture Order\nThe order events were captured' },
  pinned: { label: 'Pinned', title: 'Sort by: Recently Pinned\nWhen you pinned each event' },
};
const PINNED_SORT_CYCLE_ORDER = ['start', 'finish', 'index', 'pinned'];

function updatePinnedSortButtonUI() {
  const btn = elements.pinnedSortToggleBtn;
  if (!btn) return;
  const mode = PINNED_SORT_MODES[state.pinnedSortMode] ? state.pinnedSortMode : 'index';
  const cfg = PINNED_SORT_MODES[mode];
  btn.dataset.mode = mode;
  btn.title = cfg.title;
  const labelEl = btn.querySelector('.sort-label');
  if (labelEl) labelEl.textContent = cfg.label;
}

function handlePinnedSortCycle() {
  const i = PINNED_SORT_CYCLE_ORDER.indexOf(state.pinnedSortMode);
  state.pinnedSortMode = PINNED_SORT_CYCLE_ORDER[(i + 1) % PINNED_SORT_CYCLE_ORDER.length];
  updatePinnedSortButtonUI();
  trackEvent('pinned_view', { action: 'sort', mode: state.pinnedSortMode });
  if (state.viewMode === 'pinned') render();
}

// Direction toggle ("Sort order") — ascending vs descending, orthogonal to the
// sort mode. Mirrors the Stream view's stream-direction-btn.
function updatePinnedDirectionButtonUI() {
  const btn = elements.pinnedDirectionBtn;
  if (!btn) return;
  btn.dataset.direction = state.pinnedSortDirection;
  btn.title = state.pinnedSortDirection === 'newest-top'
    ? 'Newest / last on top (click to reverse)'
    : 'Oldest / first on top (click to reverse)';
}

function handlePinnedDirectionToggle() {
  state.pinnedSortDirection = state.pinnedSortDirection === 'newest-top' ? 'newest-bottom' : 'newest-top';
  updatePinnedDirectionButtonUI();
  trackEvent('pinned_view', { action: 'sort_direction', direction: state.pinnedSortDirection });
  if (state.viewMode === 'pinned') render();
}

if (elements.pinnedClearAllBtn) {
  elements.pinnedClearAllBtn.addEventListener('click', handlePinnedClearAll);
}
if (elements.pinnedCreateGroupBtn) {
  elements.pinnedCreateGroupBtn.addEventListener('click', handleCreateGroup);
}
if (elements.pinnedSortToggleBtn) {
  elements.pinnedSortToggleBtn.addEventListener('click', handlePinnedSortCycle);
  // Sync initial label/title with state.pinnedSortMode default
  updatePinnedSortButtonUI();
}
if (elements.pinnedDirectionBtn) {
  elements.pinnedDirectionBtn.addEventListener('click', handlePinnedDirectionToggle);
  // Sync initial icon/title with state.pinnedSortDirection default
  updatePinnedDirectionButtonUI();
}

if (elements.stackClearBtn) {
  elements.stackClearBtn.addEventListener('click', handleStackClear);
}
if (elements.stackRefreshBtn) {
  elements.stackRefreshBtn.addEventListener('click', handleStackRefresh);
}
if (elements.treeClearBtn) {
  elements.treeClearBtn.addEventListener('click', handleTreeClear);
}
if (elements.treeRefreshBtn) {
  elements.treeRefreshBtn.addEventListener('click', handleTreeRefresh);
}

// Clear all events
function clearEvents() {
  const eventCount = state.events.length;
  state.events = [];
  // Preserve selectedEventId when it points at a pinned snapshot — pinned
  // events survive Clear by definition, and the detail pane should keep
  // showing the snapshot. Otherwise null it out so the now-stale id from
  // a since-cleared live event doesn't render a phantom detail.
  const pinDomain = getCurrentPinDomain();
  const selectionIsPinned = pinDomain
    && state.selectedEventId
    && getPinnedSnapshotById(state.selectedEventId, pinDomain);
  if (!selectionIsPinned) {
    state.selectedEventId = null;
  }
  state.selectedTool = null;
  state.stackGraphs.clear();
  state.collapsedStackDomains.clear();
  state.collapsedStackGroups.clear();
  state.recentDataLayerEvents = [];
  state.hiddenTools = [];
  state.detectedPlatforms.clear();
  state.platformCounts = {};
  state.categoryCounts = {};
  state.platformConsentCounts = {};
  state.collapsedPageGroups.clear();
  state.collapsedCategoryGroups.clear();
  state.collapsedToolGroups.clear();
  state.collapsedDomains.clear();
  state.collapsedGroupedGroups.clear();
  state.scriptTreeCleared = false;
  state.unknownHosts.clear();
  state.unknownHostBuckets = { chips: [], othersCount: 0 };
  state.unknownTopHosts.clear();
  state.stapeHosts.clear();
  state.trimmedEventCount = 0;
  updateTrimmedBanner();

  // Feature #81 Phase 2 — push the now-empty event list to the bridge (dev only).
  notifyEventListChanged();

  // Clear known event IDs for polling
  knownEventIds.clear();

  // Clear consent timeline state
  state.consentTimeline = [];
  state.firstConsentTimestamp = null;
  state.detectedCMP = null;
  state.consentCookieState = null;
  state.consentStateMarkers = [];
  clearTimeout(consentCookieReprocessTimer);
  consentCookieReprocessTimer = null;
  consentCookieWriteDetected = false;
  consentCookieWriteTimestamp = 0;
  lastProcessedCMPStateJSON = null;
  if (elements.consentCount) {
    elements.consentCount.textContent = '0';
    elements.consentCount.style.display = '';
    elements.consentCount.classList.remove('consent-severity-denied', 'consent-severity-warning');
  }
  state.consentSeverity = null;
  state.consentSeverityCount = 0;

  // Clear GTM intercept state
  state.detectedGTMContainers.clear();
  updateGTMInterceptBanner();

  // Clear script initiator relationship maps
  scriptInitiatorMap.clear();
  scriptChildrenMap.clear();
  scriptUrlToEventId.clear();

  // Clear structural fingerprint cache
  clearFingerprintCache();

  // Clear Tealium tag UID → vendor mapping
  tealiumTagConfig.clear();

  // Reset AI in-session usage totals — service worker is the single
  // source of truth, so ask it to clear and then refresh the panel UI.
  try {
    chrome.runtime.sendMessage({ type: MSG.RESET_AI_SESSION_USAGE }, () => {
      try { refreshAiUsageTab(); } catch (_) { /* module may not be initialized yet */ }
    });
  } catch (_) {
    // chrome.runtime may be unavailable in test contexts — non-critical
  }

  // Tell background to clear events too
  try {
    chrome.runtime.sendMessage({
      type: MSG.CLEAR_EVENTS,
      tabId: chrome.devtools.inspectedWindow.tabId
    });
  } catch (e) {
    // Extension context may be invalidated after reload — clear locally anyway
  }

  // Update total count in collapsed filter toolbar
  updateFilterToolbarTotalCount();

  trackEvent('clear_events', { event_count: eventCount });

  render();
}

// ===== GTM Container Intercept helpers =====

/**
 * Annotate events from intercepted (blocked/replaced/preview) GTM containers.
 * Reads rules from storage synchronously via cached state.
 */
let _cachedInterceptRules = null;
// True when rules changed since last page load — banner shows reload prompt until next navigation
let _gtmInterceptPendingReload = false;
chrome.storage.local.get(['gtmInterceptRules'], (result) => {
  _cachedInterceptRules = result.gtmInterceptRules || [];
  // Initial load from storage: rules are already active from a previous session, no pending reload
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.gtmInterceptRules) {
    _cachedInterceptRules = changes.gtmInterceptRules.newValue || [];
    // Rules changed by the user — page must reload for the new state to take effect
    _gtmInterceptPendingReload = true;
    updateGTMInterceptBanner();
    updateGTMButtonState();
  }
});

function annotateInterceptedEvent(event) {
  if (!_cachedInterceptRules || !event.formatted?.containerId) return;
  const domain = state.currentPageHostname;
  const containerId = event.formatted.containerId;
  const active = _cachedInterceptRules.filter(r => r.active && matchesDomain(r, domain));

  // Priority: replace > block > preview — checked independently of array order

  // Check if this container is the REPLACEMENT in a swap rule
  const replaceRule = active.find(r => r.action === 'replace' && r.replacementId === containerId);
  if (replaceRule) {
    event.formatted.interceptAction = 'replaced';
    event.formatted.interceptOriginalId = replaceRule.containerId;
    event.formatted.interceptReplacementId = replaceRule.replacementId;
    return;
  }
  // Check if this container is the ORIGINAL being swapped away
  const swappedAwayRule = active.find(r => r.action === 'replace' && r.containerId === containerId);
  if (swappedAwayRule) {
    // Original container in a swap — mark as swapped-away so stream can hide it
    event.formatted.interceptAction = 'swapped_away';
    event.formatted.interceptReplacementId = swappedAwayRule.replacementId;
    return;
  }
  const blockRule = active.find(r => r.action === 'block' && r.containerId === containerId);
  if (blockRule) {
    event.formatted.interceptAction = 'blocked';
    return;
  }
  const previewRule = active.find(r => r.action === 'preview' && r.containerId === containerId);
  if (previewRule) {
    event.formatted.interceptAction = 'preview';
  }
}

/**
 * Update the GTM intercept banner visibility based on active rules.
 */
function updateGTMInterceptBanner() {
  const banner = document.getElementById('gtm-intercept-banner');
  if (!banner) return;

  const rules = _cachedInterceptRules || [];
  const domain = state.currentPageHostname;
  const activeRules = rules.filter(r => r.active && matchesDomain(r, domain));

  if (activeRules.length === 0) {
    banner.style.display = 'none';
    return;
  }

  banner.style.display = 'flex';
  const textEl = banner.querySelector('.gtm-intercept-banner-text');
  const reloadBtn = document.getElementById('gtm-intercept-banner-reload');
  const disableBtn = document.getElementById('gtm-intercept-banner-disable');
  const removeBtn = document.getElementById('gtm-intercept-banner-remove');

  if (_gtmInterceptPendingReload) {
    // Rules changed but page not yet reloaded — prompt user to reload
    if (textEl) {
      textEl.textContent = '';
      const warnIcon = document.createElement('span');
      warnIcon.textContent = '\u26a0 ';
      textEl.appendChild(warnIcon);
      textEl.appendChild(document.createTextNode('Reload page for intercept rules to take effect'));
    }
    if (reloadBtn) reloadBtn.style.display = '';
    if (disableBtn) disableBtn.style.display = 'none';
    if (removeBtn) removeBtn.style.display = 'none';
  } else {
    // Rules are active and in effect — show badges + container IDs
    if (textEl) {
      textEl.textContent = '';
      activeRules.forEach((r, i) => {
        if (i > 0) textEl.appendChild(document.createTextNode(' | '));
        const badge = document.createElement('span');
        badge.className = 'gtm-rule-action-badge';
        if (r.action === 'block') {
          badge.textContent = 'Blocked';
          badge.classList.add('gtm-rule-badge-blocked');
        } else if (r.action === 'replace') {
          badge.textContent = 'Swapped';
          badge.classList.add('gtm-rule-badge-swapped');
        } else if (r.action === 'preview') {
          badge.textContent = 'Preview';
          badge.classList.add('gtm-rule-badge-preview');
        }
        textEl.appendChild(badge);
        const label = r.action === 'replace'
          ? ` ${r.containerId} \u2192 ${r.replacementId}`
          : ` ${r.containerId}`;
        textEl.appendChild(document.createTextNode(label));
      });
    }
    // Show reload button for preview rules (cache-busting reload after GTM updates)
    const hasPreviewRule = activeRules.some(r => r.action === 'preview');
    if (reloadBtn) reloadBtn.style.display = hasPreviewRule ? '' : 'none';
    if (disableBtn) disableBtn.style.display = '';
    if (removeBtn) removeBtn.style.display = '';
  }
}

/**
 * Returns detected GTM container IDs from the current page.
 */
function getDetectedGTMContainers() {
  return [...state.detectedGTMContainers];
}

/**
 * Returns current page hostname.
 */
function getCurrentDomain() {
  return state.currentPageHostname;
}

// Event listeners
elements.clearBtn.addEventListener('click', clearEvents);

// Clear button right-click — Clear + Reload
elements.clearBtn.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  e.stopPropagation();
  hideReloadContextMenu();
  const menu = elements.clearContextMenu;
  const rect = elements.clearBtn.getBoundingClientRect();
  menu.style.left = `${rect.left}px`;
  menu.style.top = `${rect.bottom + 4}px`;
  menu.classList.add('open');
});

elements.clearContextMenu.querySelectorAll('.context-menu-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    if (item.dataset.action === 'clear-and-reload') {
      clearEvents();
      chrome.devtools.inspectedWindow.reload();
      trackEvent('toolbar_action', { action: 'clear_and_reload' });
    } else if (item.dataset.action === 'clear-and-hard-refresh') {
      clearEvents();
      chrome.devtools.inspectedWindow.reload({ ignoreCache: true });
      trackEvent('toolbar_action', { action: 'clear_and_hard_refresh' });
    }
    elements.clearContextMenu.classList.remove('open');
  });
});

// Reload button — normal reload on click
elements.reloadBtn.addEventListener('click', () => {
  chrome.devtools.inspectedWindow.reload();
  trackEvent('toolbar_action', { action: 'reload' });
});

// Reload button right-click — Hard Refresh option
elements.reloadBtn.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  e.stopPropagation();
  hideClearContextMenu();
  const menu = elements.reloadContextMenu;
  const rect = elements.reloadBtn.getBoundingClientRect();
  menu.style.left = `${rect.left}px`;
  menu.style.top = `${rect.bottom + 4}px`;
  menu.classList.add('open');
});

elements.reloadContextMenu.querySelectorAll('.context-menu-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    if (item.dataset.action === 'hard-refresh') {
      chrome.devtools.inspectedWindow.reload({ ignoreCache: true });
      trackEvent('toolbar_action', { action: 'hard_refresh' });
    } else if (item.dataset.action === 'clear-and-hard-refresh') {
      clearEvents();
      chrome.devtools.inspectedWindow.reload({ ignoreCache: true });
      trackEvent('toolbar_action', { action: 'clear_and_hard_refresh' });
    }
    elements.reloadContextMenu.classList.remove('open');
  });
});

function hideReloadContextMenu() {
  elements.reloadContextMenu.classList.remove('open');
}

function hideClearContextMenu() {
  elements.clearContextMenu.classList.remove('open');
}

// GTM Intercept banner reload button
const gtmBannerReloadBtn = document.getElementById('gtm-intercept-banner-reload');
if (gtmBannerReloadBtn) {
  gtmBannerReloadBtn.addEventListener('click', () => {
    chrome.devtools.inspectedWindow.reload({ ignoreCache: true });
  });
}

// GTM Intercept banner disable button — disables all active rules for this domain
const gtmBannerDisableBtn = document.getElementById('gtm-intercept-banner-disable');
if (gtmBannerDisableBtn) {
  gtmBannerDisableBtn.addEventListener('click', () => {
    const domain = state.currentPageHostname;
    chrome.storage.local.get(['gtmInterceptRules'], (result) => {
      const rules = result.gtmInterceptRules || [];
      let changed = false;
      for (const rule of rules) {
        if (rule.active && matchesDomain(rule, domain)) {
          rule.active = false;
          changed = true;
        }
      }
      if (changed) {
        chrome.storage.local.set({ gtmInterceptRules: rules }, () => {
          chrome.runtime.sendMessage({ type: MSG.GTM_INTERCEPT_UPDATED });
          updateGTMInterceptBanner();
          trackEvent('gtm_intercept', { action: 'disable_all_banner' });
        });
      }
    });
  });
}

// GTM Intercept banner remove button — permanently removes all active rules for this domain
const gtmBannerRemoveBtn = document.getElementById('gtm-intercept-banner-remove');
if (gtmBannerRemoveBtn) {
  gtmBannerRemoveBtn.addEventListener('click', () => {
    const domain = state.currentPageHostname;
    chrome.storage.local.get(['gtmInterceptRules'], (result) => {
      const rules = (result.gtmInterceptRules || []).filter(r => !r.active || !matchesDomain(r, domain));
      chrome.storage.local.set({ gtmInterceptRules: rules }, () => {
        chrome.runtime.sendMessage({ type: MSG.GTM_INTERCEPT_UPDATED });
        updateGTMInterceptBanner();
        trackEvent('gtm_intercept', { action: 'remove_all_banner' });
      });
    });
  });
}

// Refresh event-detail when a GTM intercept rule changes, so the action bar
// (Block/Swap/Restore buttons) reflects the new rule state without requiring
// the user to click a different event and back.
document.addEventListener('gtmRuleChanged', () => {
  const selectedEvent = state.events.find(e => e.id === state.selectedEventId);
  if (selectedEvent?.platform === 'gtm' && selectedEvent.formatted?.containerId) {
    scheduleRender();
  }
});

// View mode toggle handler — accepts 'stream' | 'grouped' | 'tree'.
// When `groupingId` is provided, the active Grouped pivot is also updated.
// Callers passing the legacy 'tools'/'pages' values are migrated transparently
// (handleViewModeChange('tools') becomes ('grouped', 'tool')) so settings code,
// onboarding step hooks, and any preserved deep-links keep working.
function handleViewModeChange(newMode, groupingId = null) {
  // Legacy-value compatibility shim — keeps any external caller (settings
  // initializer, onboarding tour) working while storage migrations roll out.
  if (newMode === 'tools') { newMode = 'grouped'; groupingId = groupingId || 'tool'; }
  else if (newMode === 'pages') { newMode = 'grouped'; groupingId = groupingId || 'page'; }

  const targetGrouping = newMode === 'grouped'
    ? (groupingId && isValidGroupingId(groupingId) ? groupingId : state.activeGrouping)
    : state.activeGrouping;

  // No-op if mode and grouping are unchanged.
  if (state.viewMode === newMode &&
      (newMode !== 'grouped' || state.activeGrouping === targetGrouping)) {
    return;
  }

  state.viewMode = newMode;
  if (newMode === 'grouped') {
    state.activeGrouping = targetGrouping;
  }
  // Stack view uses selectedTool for the right pane; clear the event
  // selection on entry so the panes don't fight. Conversely, leaving
  // Stack clears selectedTool so it doesn't bleed into other views.
  if (newMode === 'stack') {
    state.selectedEventId = null;
  } else {
    state.selectedTool = null;
  }
  // Drive the toolbar swap (Stream-only buttons hidden, Pinned-only
  // buttons shown) from a single body attribute so CSS handles the rest.
  document.body.setAttribute('data-view-mode', newMode);

  // Persist for "Last used" default
  saveLastUsed('viewMode', newMode);
  if (newMode === 'grouped') {
    saveLastUsed('activeGrouping', targetGrouping);
    // Activate the grouping (append-only). First click on a grouping flips
    // its `grouped_view_<id>` user property out of 'never_used' for the
    // upcoming view_switch event — the user-property write must happen
    // BEFORE trackEvent so the event carries the new state.
    if (!state.activatedGroupings.includes(targetGrouping)) {
      state.activatedGroupings = [...state.activatedGroupings, targetGrouping];
      saveLastUsed('activatedGroupings', state.activatedGroupings);
    }
    setSettingsUserProperties({
      [`grouped_view_${targetGrouping}`]: getGroupedViewState(
        targetGrouping,
        state.pinnedGroupings,
        state.activatedGroupings
      ),
    });
  }

  // `view` and `view_index` are auto-added by the DevTools context — do
  // not pass them explicitly here.
  trackEvent('view_switch');

  updateViewModeButtonStates();

  // Show/hide controls based on view mode. Grouped, Stream, and the legacy
  // Tool/Page (pre-migration) all count as event views; Tree and Stack do not.
  const isEventView = ['stream', 'grouped'].includes(newMode);
  const isStreamView = newMode === 'stream';
  const hasCollapseGroups = ['stream', 'grouped', 'tree', 'stack', 'pinned'].includes(newMode);

  if (elements.sortControls) {
    elements.sortControls.classList.toggle('hidden', !isEventView);
  }
  if (elements.expandCollapseBtn) {
    elements.expandCollapseBtn.classList.toggle('hidden', !hasCollapseGroups);
  }
  // L2 button visibility is finer-grained (depends on activeGrouping too)
  // — `updateExpandCollapseButtonState()` below handles its show/hide.
  if (elements.streamDirectionBtn) {
    elements.streamDirectionBtn.classList.toggle('hidden', !isStreamView);
  }

  updateExpandCollapseButtonState();
  render();
}

// Rebuild the Grouped chip row from `state.pinnedGroupings`. Called once
// after settings load to reflect customised pin sets — the HTML hard-codes
// the default `[tool, page, event_name]`, so users with a different array
// would otherwise see stale chips. Idempotent.
function syncGroupedToolbarChips() {
  const wrapper = elements.viewModeGroupedToggle;
  const pickerBtn = elements.groupedPickerBtn;
  if (!wrapper || !pickerBtn) return;

  const desiredIds = state.pinnedGroupings.filter(isValidGroupingId);
  const existingChips = Array.from(wrapper.querySelectorAll('.view-mode-btn'))
    .filter(b => b.id !== 'grouped-picker-btn');
  const existingIds = existingChips.map(b => b.dataset.grouping);

  const sameOrder = desiredIds.length === existingIds.length
    && desiredIds.every((id, i) => id === existingIds[i]);
  if (sameOrder) return;

  for (const chip of existingChips) chip.remove();
  for (const id of desiredIds) {
    const grouping = getGrouping(id);
    if (!grouping) continue;
    const chip = buildGroupedChip(grouping);
    wrapper.insertBefore(chip, pickerBtn);
  }
  updateViewModeButtonStates();
}

// Render a chip for a pivot inside the Grouped zone. Used when pinning a
// previously-unpinned pivot from the picker so it appears immediately
// without a full toolbar rebuild.
function buildGroupedChip(grouping) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'view-mode-btn';
  btn.dataset.view = 'grouped';
  btn.dataset.grouping = grouping.id;
  btn.title = `${grouping.label} - ${grouping.description}`;
  btn.textContent = grouping.label;
  return btn;
}

// Insert a freshly-pinned chip into the Grouped zone, right before the `+`
// chip, and update state + persistence. The `source` argument is unused
// since `grouping_pinned` was retired in v1.2.0 (replaced by the
// `grouped_view_<id>` user property derived from activatedGroupings ∩
// pinnedGroupings); kept for call-site compatibility.
function pinGrouping(groupingId, source) {
  if (!isValidGroupingId(groupingId)) return;
  if (state.pinnedGroupings.includes(groupingId)) return;
  state.pinnedGroupings = [...state.pinnedGroupings, groupingId];
  saveLastUsed('pinnedGroupings', state.pinnedGroupings);
  // Resolve the user-property state — pinning alone (explicit Pin button)
  // doesn't activate, so a never-clicked default stays 'never_used'; an
  // already-activated id flips back to 'pinned'.
  setSettingsUserProperties({
    [`grouped_view_${groupingId}`]: getGroupedViewState(
      groupingId,
      state.pinnedGroupings,
      state.activatedGroupings
    ),
  });

  const grouping = getGrouping(groupingId);
  if (grouping && elements.viewModeGroupedToggle && elements.groupedPickerBtn) {
    const chip = buildGroupedChip(grouping);
    elements.viewModeGroupedToggle.insertBefore(chip, elements.groupedPickerBtn);
    updateViewModeButtonStates();
  }
}

function unpinGrouping(groupingId) {
  const idx = state.pinnedGroupings.indexOf(groupingId);
  if (idx === -1) return;
  state.pinnedGroupings = state.pinnedGroupings.filter(id => id !== groupingId);
  saveLastUsed('pinnedGroupings', state.pinnedGroupings);
  // Activated → 'unpinned'; never-activated (user unpinned a default
  // before clicking) stays 'never_used'.
  setSettingsUserProperties({
    [`grouped_view_${groupingId}`]: getGroupedViewState(
      groupingId,
      state.pinnedGroupings,
      state.activatedGroupings
    ),
  });

  if (elements.viewModeGroupedToggle) {
    const chip = elements.viewModeGroupedToggle.querySelector(`.view-mode-btn[data-grouping="${groupingId}"]`);
    if (chip) chip.remove();
  }

  // If the user unpinned the currently-active grouping, switch the view to
  // the first remaining pinned grouping. If none remain, fall back to
  // Stream so the toolbar can never end up with no active chip while the
  // event list still renders a hidden grouping.
  if (state.viewMode === 'grouped' && state.activeGrouping === groupingId) {
    const fallback = state.pinnedGroupings[0];
    if (fallback) {
      handleViewModeChange('grouped', fallback);
    } else {
      handleViewModeChange('stream');
    }
  }
}

// Grouping picker popover. Opens on `+` chip click, lists all pivots
// split into a Pinned section (drag-reorderable) and an Available section.
// Clicking a pivot switches Grouped view to it and (if not already pinned)
// pins it — the spec's "auto-pin on pick" interaction model.
let groupingPickerEl = null;
let pickerDragId = null;
function toggleGroupingPicker() {
  if (groupingPickerEl) {
    closeGroupingPicker();
    return;
  }
  openGroupingPicker();
}

function openGroupingPicker() {
  if (!elements.groupedPickerBtn) return;

  // Intent signal — user wants to discover other groupings. Fires every
  // time the picker opens, regardless of what they do next.
  trackEvent('view_plus');

  const popover = document.createElement('div');
  popover.className = 'grouped-picker-popover';

  // Header bar — replaces the old "AUDIT" category label. Title sets the
  // surface, hint signals that pinned rows are draggable. Hidden when there
  // are no pinned rows to reorder.
  const header = document.createElement('div');
  header.className = 'grouped-picker-header';
  const title = document.createElement('div');
  title.className = 'grouped-picker-title';
  title.textContent = 'Grouped Views';
  header.appendChild(title);
  const pinnedIds = state.pinnedGroupings.filter(isValidGroupingId);
  if (pinnedIds.length > 1) {
    const hint = document.createElement('div');
    hint.className = 'grouped-picker-hint';
    hint.textContent = 'Drag to reorder';
    header.appendChild(hint);
  }
  popover.appendChild(header);

  const pinnedSet = new Set(pinnedIds);
  const availableGroupings = GROUPINGS.filter(g => !pinnedSet.has(g.id));

  if (pinnedIds.length > 0) {
    const pinnedSection = document.createElement('div');
    pinnedSection.className = 'grouped-picker-section grouped-picker-section-pinned';
    for (const id of pinnedIds) {
      const grouping = getGrouping(id);
      if (!grouping) continue;
      pinnedSection.appendChild(buildPickerRow(grouping, true));
    }
    popover.appendChild(pinnedSection);
  }

  if (availableGroupings.length > 0) {
    if (pinnedIds.length > 0) {
      const divider = document.createElement('div');
      divider.className = 'grouped-picker-divider';
      popover.appendChild(divider);
    }
    const availableSection = document.createElement('div');
    availableSection.className = 'grouped-picker-section grouped-picker-section-available';
    for (const grouping of availableGroupings) {
      availableSection.appendChild(buildPickerRow(grouping, false));
    }
    popover.appendChild(availableSection);
  }

  // Position relative to the picker button. The grouped-toggle is
  // position:static, so we anchor against the button's offset parent.
  const btnRect = elements.groupedPickerBtn.getBoundingClientRect();
  popover.style.position = 'fixed';
  popover.style.top = `${btnRect.bottom + 4}px`;
  popover.style.left = `${btnRect.left}px`;

  document.body.appendChild(popover);
  groupingPickerEl = popover;

  // Close on outside-click. Defer so the click that opened us doesn't close us.
  setTimeout(() => {
    document.addEventListener('click', onOutsidePickerClick, { once: false });
  }, 0);
}

// Build one row in the picker. Pinned rows get a drag handle and
// HTML5 drag-and-drop wiring; available rows just have a Pin button.
function buildPickerRow(grouping, isPinned) {
  const item = document.createElement('div');
  item.className = `grouped-picker-item${isPinned ? ' pinned' : ''}`;
  item.dataset.groupingId = grouping.id;

  if (isPinned) {
    item.draggable = true;
    item.addEventListener('dragstart', (e) => onPickerDragStart(e, grouping.id, item));
    item.addEventListener('dragover', (e) => onPickerDragOver(e, item));
    item.addEventListener('dragleave', () => onPickerDragLeave(item));
    item.addEventListener('drop', (e) => onPickerDrop(e, grouping.id, item));
    item.addEventListener('dragend', () => onPickerDragEnd(item));

    // Drag handle — visual cue that the row is reorderable. Six-dot
    // pattern matches conventional drag-handle iconography.
    const handle = document.createElement('span');
    handle.className = 'grouped-picker-item-handle';
    handle.setAttribute('aria-hidden', 'true');
    handle.title = 'Drag to reorder';
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '10');
    svg.setAttribute('height', '14');
    svg.setAttribute('viewBox', '0 0 10 14');
    svg.setAttribute('fill', 'currentColor');
    [[2,2],[8,2],[2,7],[8,7],[2,12],[8,12]].forEach(([cx, cy]) => {
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', String(cx));
      c.setAttribute('cy', String(cy));
      c.setAttribute('r', '1.2');
      svg.appendChild(c);
    });
    handle.appendChild(svg);
    item.appendChild(handle);
  }

  // Main clickable zone — activates the grouping (auto-pinning if unpinned).
  const main = document.createElement('button');
  main.type = 'button';
  main.className = 'grouped-picker-item-main';

  const labelRow = document.createElement('div');
  labelRow.className = 'grouped-picker-item-label';
  labelRow.textContent = grouping.label;
  main.appendChild(labelRow);

  const desc = document.createElement('div');
  desc.className = 'grouped-picker-item-desc';
  desc.textContent = grouping.description;
  main.appendChild(desc);

  main.addEventListener('click', () => {
    if (!state.pinnedGroupings.includes(grouping.id)) {
      pinGrouping(grouping.id, 'picker');
    }
    handleViewModeChange('grouped', grouping.id);
    closeGroupingPicker();
  });
  item.appendChild(main);

  // Pin/unpin toggle — separate button so the user can manage the chip
  // row without activating the view. Aria label updates based on state
  // so screen readers announce the action.
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'grouped-picker-item-toggle';
  toggle.dataset.action = isPinned ? 'unpin' : 'pin';
  toggle.title = isPinned ? 'Unpin from toolbar' : 'Pin to toolbar';
  toggle.setAttribute('aria-label', toggle.title);
  toggle.textContent = isPinned ? 'Unpin' : 'Pin';
  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.pinnedGroupings.includes(grouping.id)) {
      unpinGrouping(grouping.id);
    } else {
      pinGrouping(grouping.id, 'explicit');
    }
    rerenderGroupingPicker();
  });
  item.appendChild(toggle);

  return item;
}

function onPickerDragStart(e, groupingId, row) {
  pickerDragId = groupingId;
  row.classList.add('grouped-picker-item-dragging');
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    // Required for Firefox to actually start a drag.
    e.dataTransfer.setData('text/plain', groupingId);
  }
}

function onPickerDragOver(e, row) {
  if (!pickerDragId || pickerDragId === row.dataset.groupingId) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  const rect = row.getBoundingClientRect();
  const isAfter = (e.clientY - rect.top) > rect.height / 2;
  clearPickerDropIndicators();
  row.classList.add(isAfter ? 'drop-after' : 'drop-before');
}

function onPickerDragLeave(row) {
  row.classList.remove('drop-before', 'drop-after');
}

function onPickerDrop(e, targetGroupingId, row) {
  e.preventDefault();
  if (!pickerDragId || pickerDragId === targetGroupingId) {
    onPickerDragEnd(row);
    return;
  }
  const rect = row.getBoundingClientRect();
  const isAfter = (e.clientY - rect.top) > rect.height / 2;
  reorderGrouping(pickerDragId, targetGroupingId, isAfter);
}

function onPickerDragEnd(row) {
  row.classList.remove('grouped-picker-item-dragging');
  clearPickerDropIndicators();
  pickerDragId = null;
}

function clearPickerDropIndicators() {
  if (!groupingPickerEl) return;
  groupingPickerEl.querySelectorAll('.drop-before, .drop-after').forEach(el => {
    el.classList.remove('drop-before', 'drop-after');
  });
}

// Move `fromId` next to `toId`, then sync the toolbar chips and rerender
// the picker so the visual state reflects the new order.
function reorderGrouping(fromId, toId, insertAfter) {
  const fromIdx = state.pinnedGroupings.indexOf(fromId);
  if (fromIdx === -1 || !state.pinnedGroupings.includes(toId)) return;

  const next = state.pinnedGroupings.filter(id => id !== fromId);
  const targetIdx = next.indexOf(toId);
  if (targetIdx === -1) return;
  const insertIdx = insertAfter ? targetIdx + 1 : targetIdx;
  next.splice(insertIdx, 0, fromId);

  if (next.every((id, i) => id === state.pinnedGroupings[i])) return;

  state.pinnedGroupings = next;
  saveLastUsed('pinnedGroupings', state.pinnedGroupings);
  // Reorders are implicit in the next view_switch's view_index — no
  // dedicated event needed.

  syncGroupedToolbarChips();
  rerenderGroupingPicker();
}

function onOutsidePickerClick(e) {
  if (!groupingPickerEl) return;
  if (groupingPickerEl.contains(e.target)) return;
  if (elements.groupedPickerBtn && elements.groupedPickerBtn.contains(e.target)) return;
  closeGroupingPicker();
}

function closeGroupingPicker() {
  if (!groupingPickerEl) return;
  groupingPickerEl.remove();
  groupingPickerEl = null;
  document.removeEventListener('click', onOutsidePickerClick);
}

// Rebuild the popover in place. Used when a row's pin/unpin toggle is
// clicked so the user sees their change without losing their position in
// the picker (closing + reopening would drop them back at the top).
function rerenderGroupingPicker() {
  if (!groupingPickerEl) return;
  closeGroupingPicker();
  openGroupingPicker();
}

// Synchronise `.active` state across all view-mode toggle groups. The active
// chip in the Grouped zone is the one matching state.activeGrouping.
function updateViewModeButtonStates() {
  const setActive = (container, predicate) => {
    if (!container) return;
    container.querySelectorAll('.view-mode-btn').forEach(b => {
      b.classList.toggle('active', !!predicate(b));
    });
  };
  setActive(elements.viewModeToggle, (b) => b.dataset.view === state.viewMode);
  setActive(elements.viewModeGroupedToggle, (b) => {
    if (b.id === 'grouped-picker-btn') return false;
    return state.viewMode === 'grouped' && b.dataset.grouping === state.activeGrouping;
  });
  setActive(elements.viewModeTreeToggle, (b) => b.dataset.view === state.viewMode);
  setActive(elements.viewModeStackToggle, (b) => b.dataset.view === state.viewMode);
  setActive(elements.viewModePinnedToggle, (b) => b.dataset.view === state.viewMode);
}

// View mode toggle (Stream singleton)
if (elements.viewModeToggle) {
  elements.viewModeToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-mode-btn');
    if (!btn) return;
    handleViewModeChange(btn.dataset.view);
  });
}

// Grouped zone — clicking a chip switches active grouping inside Grouped view.
// The `+` overflow chip opens the picker popover instead of switching view.
if (elements.viewModeGroupedToggle) {
  elements.viewModeGroupedToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-mode-btn');
    if (!btn) return;
    if (btn.id === 'grouped-picker-btn') {
      toggleGroupingPicker();
      return;
    }
    const groupingId = btn.dataset.grouping;
    if (!groupingId) return;
    handleViewModeChange('grouped', groupingId);
  });
}

// Script Tree toggle (standalone)
if (elements.viewModeTreeToggle) {
  elements.viewModeTreeToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-mode-btn');
    if (!btn) return;
    handleViewModeChange(btn.dataset.view);
  });
}

// Stack View toggle (standalone) — feature #71
if (elements.viewModeStackToggle) {
  elements.viewModeStackToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-mode-btn');
    if (!btn) return;
    handleViewModeChange(btn.dataset.view);
  });
}

// Pinned View toggle (standalone) — feature #45 Phase 1
if (elements.viewModePinnedToggle) {
  elements.viewModePinnedToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.view-mode-btn');
    if (!btn) return;
    handleViewModeChange(btn.dataset.view);
  });
}

// Capture control button - cycles through play/pause/stop states
elements.captureBtn.addEventListener('click', cycleCaptureState);

// Sort toggle button - cycles through start, finish, and index sorting
if (elements.sortToggleBtn) {
  elements.sortToggleBtn.addEventListener('click', async () => {
    // Cycle through 'start' -> 'finish' -> 'index' -> 'start'
    const sortCycle = { 'start': 'finish', 'finish': 'index', 'index': 'start' };
    state.sortMode = sortCycle[state.sortMode] || 'start';

    // Update button UI
    updateSortButtonUI();

    // Save as "last used" for next session
    await saveLastUsed('sortMode', state.sortMode);

    // Re-render the event list with new sort order
    render();
  });
}

// Helper to update sort button UI
function updateSortButtonUI() {
  if (!elements.sortToggleBtn) return;

  const labels = {
    'start': 'Start',
    'finish': 'Finish',
    'index': 'Index'
  };
  const tooltips = {
    'start': 'Sort by: Request Start Time\nWhen the request was initiated',
    'finish': 'Sort by: Request Finish Time\nWhen the response was received',
    'index': 'Sort by: Capture Order\nThe order events were received by the extension'
  };

  elements.sortToggleBtn.dataset.mode = state.sortMode;
  elements.sortToggleBtn.querySelector('.sort-label').textContent = labels[state.sortMode];
  elements.sortToggleBtn.title = tooltips[state.sortMode];
}

// Filter toolbar collapse button
if (elements.filterToolbarCollapseBtn) {
  elements.filterToolbarCollapseBtn.addEventListener('click', toggleFilterToolbarCollapsed);
}

// Smart search input (filters tools in filter bar + events in stream)
if (elements.smartSearchInput) {
  elements.smartSearchInput.addEventListener('input', (e) => {
    handleSmartSearchInput(e.target.value);
  });
  elements.smartSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
    if (e.key === 'Escape') {
      clearSmartSearch();
      elements.smartSearchInput.blur();
    }
  });
  elements.smartSearchInput.addEventListener('blur', () => {
    if (state.toolSearchQuery) {
      trackEvent('smart_search', {
        action: 'search',
        context: 'toolbar',
        has_platform_match: getCurrentParsedSearch().platforms.length > 0,
        has_category_match: getCurrentParsedSearch().categories.length > 0,
        has_event_match: getCurrentParsedSearch().eventNames.length > 0,
        has_status_match: !!getCurrentParsedSearch().statusFilter,
        has_text_fallback: !!getCurrentParsedSearch().textSearch,
        chip_count: getCurrentParsedSearch().chips?.length || 0
      });
    }
  });
}
if (elements.smartSearchClear) {
  elements.smartSearchClear.addEventListener('click', () => {
    clearSmartSearch();
    elements.smartSearchInput?.focus();
  });
}

// Collapse/Expand all categories buttons
if (elements.collapseAllCategoriesBtn) {
  elements.collapseAllCategoriesBtn.addEventListener('click', collapseAllCategories);
}
if (elements.expandAllCategoriesBtn) {
  elements.expandAllCategoriesBtn.addEventListener('click', expandAllCategories);
}

// Show All / Hide All buttons
if (elements.showAllToolsBtn) {
  elements.showAllToolsBtn.addEventListener('click', () => {
    const toolsCount = Object.values(state.platformCounts).filter(n => n > 0).length;
    showAllTools();
    state.activePresetId = null;
    state.activePresetVisibleTools = null;
    state.activePresetOriginalTools = null;
    updatePresetDropdownLabel();
    updateSavePresetButton();
    trackEvent('filter_all_show', { tools_count: toolsCount });
  });
}
if (elements.hideAllToolsBtn) {
  elements.hideAllToolsBtn.addEventListener('click', () => {
    const toolsCount = Object.values(state.platformCounts).filter(n => n > 0).length;
    hideAllTools();
    // Hide All puts the user in an empty-whitelist mode (set by hideAllTools).
    // Don't clobber activePresetVisibleTools here — but do clear activePresetId
    // since we no longer match a saved preset.
    state.activePresetId = null;
    updatePresetDropdownLabel();
    updateSavePresetButton();
    trackEvent('filter_all_hide', { tools_count: toolsCount });
  });
}

// L1 Expand/Collapse All button — toggles top-level groups in any view.
if (elements.expandCollapseBtn) {
  elements.expandCollapseBtn.addEventListener('click', () => {
    const currentState = elements.expandCollapseBtn.dataset.state;
    if (currentState === 'expanded') {
      collapseAllPages(); // L1 collapse — adaptive by viewMode
    } else {
      expandAllPages(); // L1 expand — adaptive by viewMode
    }
    updateExpandCollapseButtonState();
  });
}

// L2 Expand/Collapse All sub-groups button — only shown in two-level
// Grouped views (Tool, Page, and any flat pivot with `subGroupKey`).
if (elements.expandCollapseSubBtn) {
  elements.expandCollapseSubBtn.addEventListener('click', () => {
    const currentState = elements.expandCollapseSubBtn.dataset.state;
    if (currentState === 'expanded') {
      collapseAllSubGroups();
    } else {
      expandAllSubGroups();
    }
    updateExpandCollapseButtonState();
  });
}

// Stream direction toggle button - toggles newest on top vs bottom (Stream view only)
if (elements.streamDirectionBtn) {
  elements.streamDirectionBtn.addEventListener('click', toggleStreamDirection);
  // Initialize button state
  updateStreamDirectionButton();
}

// Performance info button - shows explanation of the metrics
if (elements.perfInfoBtn) {
  elements.perfInfoBtn.addEventListener('click', () => {
    alert(
      'Performance Metrics (page load)\n\n' +
      'Format: 46ms · 59/114 requests · 12/240 tools\n\n' +
      '• 46ms: CPU time spent matching requests\n' +
      '  Green <50ms · Yellow 50-200ms · Red >200ms\n\n' +
      '• 59/114 requests: 59 matched / 114 processed\n\n' +
      '• 12/240 tools: 12 found / 240 patterns checked\n\n' +
      'Click the stats text to copy it.'
    );
  });
}

// Click on perf stats to copy
// - Normal mode: copies footer text
// - Extended mode: copies full performance report
const perfStatsEl = document.getElementById('perf-stats');
if (perfStatsEl) {
  perfStatsEl.style.cursor = 'pointer';
  perfStatsEl.title = 'Click to copy · Right-click for options';
  perfStatsEl.addEventListener('click', () => {
    // In extended mode, copy full report; otherwise copy footer text
    const text = extendedPerfLogging ? generatePerformanceExport() : perfStatsEl.textContent;
    const feedbackText = extendedPerfLogging ? 'Full report copied!' : 'Copied!';

    if (copyToClipboard(text)) {
      // Brief visual feedback
      const original = perfStatsEl.textContent;
      perfStatsEl.textContent = feedbackText;
      setTimeout(() => {
        perfStatsEl.textContent = original;
      }, 800);
    }
  });
}

/**
 * Generate AI-friendly performance export data
 * Structured format optimized for debugging with AI tools like Claude
 * When extended tracking is enabled, includes detailed match/skip data
 */
function generatePerformanceExport() {
  const stats = pageLoadStats || perfStats;
  const endpointStats = getDebugStats();
  const matchedToolsCount = stats.matchedToolsCount ?? stats.matchedTools?.size ?? 0;

  // Identify JS-based tools (no network requests, detected via dataLayer/JS injection)
  const jsBasedTools = ['datalayer', 'tealium-datalayer', 'adobe-datalayer'];

  // Get detected tools with counts and matched patterns (if available)
  const detectedTools = Object.entries(state.platformCounts)
    .filter(([, count]) => count > 0)
    .map(([toolId, count]) => {
      const tool = {
        id: toolId,
        count,
        category: platformToCategory[toolId] || 'unknown'
      };

      // Note JS-based tools that don't have network requests
      if (jsBasedTools.includes(toolId)) {
        tool._note = 'JS-based detection (dataLayer/injection), not network requests';
      }

      // Include matched patterns if extended tracking data is available
      if (endpointStats.matchedPatterns && endpointStats.matchedPatterns[toolId]) {
        tool.matchedUrls = endpointStats.matchedPatterns[toolId];
      } else if (extendedPerfLogging && !jsBasedTools.includes(toolId) && count > 0) {
        // Tool detected but no matchedUrls = likely all cache hits
        tool._note = 'All matches were cache hits (URLs seen before in this session)';
      }

      return tool;
    })
    .sort((a, b) => b.count - a.count);

  // Get unique categories
  const categories = [...new Set(detectedTools.map(t => t.category))];

  // Calculate percentages for matching pipeline
  const totalCalls = endpointStats.totalCalls || 1;
  const skipped = endpointStats.skippedByExtension || 0;
  const totalRequests = stats.requestCount + skipped;
  const skippedPct = totalRequests > 0 ? Math.round((skipped / totalRequests) * 100) : 0;
  const cacheHitPct = Math.round((endpointStats.cacheHits / totalCalls) * 100);
  const knownPct = Math.round((endpointStats.knownDomains / totalCalls) * 100);
  const unknownPct = Math.round((endpointStats.unknownDomains / totalCalls) * 100);

  const exportData = {
    _format: 'Event Watcher DevTools Export',
    _version: '1.4',
    _timestamp: new Date().toISOString(),
    _purpose: 'Debugging data for AI analysis',
    _extendedMode: extendedPerfLogging,

    summary: {
      totalMatchTimeMs: Math.round(stats.totalMatchTimeMs),
      requestsTotal: stats.requestCount,
      requestsMatched: stats.matchCount,
      requestsSkippedByExtension: skipped,
      skippedPct,
      toolsDetected: matchedToolsCount,
      toolsAvailable: stats.totalToolCount,
      categoriesDetected: categories.length
    },

    matchingPipeline: {
      totalCalls,
      cacheHits: endpointStats.cacheHits || 0,
      cacheHitPct,
      knownDomains: endpointStats.knownDomains || 0,
      knownPct,
      unknownDomains: endpointStats.unknownDomains || 0,
      unknownPct,
      fullScanFallbacks: endpointStats.fullScanFallbacks || 0,
      totalEndpointsChecked: endpointStats.totalEndpointsChecked || 0,
      skippedByExtension: skipped
    },

    detectedTools,
    categories,

    viewState: {
      viewMode: state.viewMode,
      activePreset: state.activePresetVisibleTools !== null,
      triggerCorrelation: state.showTriggerCorrelation,
      totalEvents: state.events.length
    }
  };

  // Include skipped URLs details if extended tracking is enabled
  if (extendedPerfLogging && endpointStats.skippedUrls && endpointStats.skippedUrls.length > 0) {
    exportData.skippedUrls = {
      _description: 'URLs skipped by SKIP_EXTENSIONS check (static assets that are never tracking endpoints)',
      count: endpointStats.skippedUrls.length,
      byExtension: groupSkippedByExtension(endpointStats.skippedUrls),
      samples: endpointStats.skippedUrls.slice(0, 50) // Limit to 50 samples
    };
  }

  // Include unmatched URLs if extended tracking is enabled (for validation)
  if (extendedPerfLogging && endpointStats.unmatchedUrls && endpointStats.unmatchedUrls.length > 0) {
    exportData.unmatchedUrls = {
      _description: 'URLs that passed all checks but did not match any tracking endpoint pattern',
      count: endpointStats.unmatchedUrls.length,
      byHostname: groupUnmatchedByHostname(endpointStats.unmatchedUrls),
      samples: endpointStats.unmatchedUrls.slice(0, 50) // Limit to 50 samples
    };
  }

  return JSON.stringify(exportData, null, 2);
}

/**
 * Group skipped URLs by extension for summary
 */
function groupSkippedByExtension(skippedUrls) {
  const byExt = {};
  for (const item of skippedUrls) {
    const ext = item.extension || 'unknown';
    byExt[ext] = (byExt[ext] || 0) + 1;
  }
  return byExt;
}

/**
 * Group unmatched URLs by hostname for summary
 */
function groupUnmatchedByHostname(unmatchedUrls) {
  const byHost = {};
  for (const item of unmatchedUrls) {
    const host = item.hostname || 'unknown';
    byHost[host] = (byHost[host] || 0) + 1;
  }
  return byHost;
}

/**
 * Show context menu for performance stats area
 */
function showPerfContextMenu(e) {
  e.preventDefault();
  e.stopPropagation();

  // Hide any other open context menus first
  hidePlatformContextMenu();
  hideGroupContextMenu();

  const menu = document.getElementById('perf-context-menu');
  if (!menu) return;

  // Position menu within viewport (position above the footer since it's at the bottom)
  const menuWidth = 320;
  const menuHeight = 80;
  let x = e.clientX;
  let y = e.clientY - menuHeight - 10; // Position above the click point

  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 5;
  }
  if (y < 0) {
    y = e.clientY + 10; // If not enough room above, show below
  }

  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.add('open');
}

/**
 * Hide the perf context menu
 */
function hidePerfContextMenu() {
  const menu = document.getElementById('perf-context-menu');
  if (menu) {
    menu.classList.remove('open');
  }
}

// Right-click on perf stats for extended options
if (perfStatsEl) {
  perfStatsEl.addEventListener('contextmenu', showPerfContextMenu);
}

// Perf context menu item click handlers
const perfContextMenu = document.getElementById('perf-context-menu');
if (perfContextMenu) {
  // Copy all events (JSON)
  perfContextMenu.querySelector('[data-action="copy-all-events"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    copyEventsFromPerfMenu();
    hidePerfContextMenu();
  });
}


/**
 * Copy all captured events as JSON to clipboard — reached from the perf-stats
 * right-click context menu. (Renamed from copyAllEventsAsJson in Feature #144 to
 * remove the casing collision with the imported user-facing copyAllEventsAsJSON.)
 */
function copyEventsFromPerfMenu() {
  const exportData = {
    page: window.location?.pathname || '/',
    captured: new Date().toISOString(),
    eventCount: state.events.length,
    events: state.events.map((event, index) => {
      const result = {
        order: index + 1,
        category: getCategoryInfo(event.platform)?.name || 'Unknown',
        categoryId: getCategoryInfo(event.platform)?.id || 'unknown',
        tool: PLATFORM_NAMES[event.platform] || event.platform?.toUpperCase() || 'UNKNOWN',
        toolId: event.platform || 'other',
        event: event.eventName || event.method || 'Request',
        time: new Date(event.timestamp).toLocaleTimeString('en-GB'),
        deltaMs: index === 0 ? 0 : event.timestamp - state.events[0].timestamp
      };
      if (event.detectedBy) {
        result.detectedBy = event.detectedBy;
      }
      return result;
    })
  };

  navigator.clipboard.writeText(JSON.stringify(exportData, null, 2))
    .then(() => {
      // Show brief confirmation
      const statsEl = document.getElementById('perf-stats');
      const originalText = statsEl.textContent;
      statsEl.textContent = `Copied ${state.events.length} events!`;
      setTimeout(() => {
        updatePerfIndicator();
      }, 1500);
    })
    .catch(err => {
      console.error('Failed to copy events:', err);
    });

  trackEvent('copy_output', { scope: 'all_events', format: 'json' });
}

// Close perf context menu when clicking outside
document.addEventListener('click', (e) => {
  const perfMenu = document.getElementById('perf-context-menu');
  if (perfMenu && perfMenu.classList.contains('open') && !perfMenu.contains(e.target)) {
    hidePerfContextMenu();
  }
});

elements.searchInput.addEventListener('input', (e) => {
  state.filters.search = e.target.value;
  render();
});

// Track search usage on blur (when user leaves search field)
elements.searchInput.addEventListener('blur', () => {
  if (state.filters.search) {
    trackEvent('search', { context: 'event_stream' });
  }
});

// Trigger correlation toggle (nested events)
elements.triggerCorrelationToggle.addEventListener('change', async (e) => {
  state.showTriggerCorrelation = e.target.checked;
  await updateSetting('nested', e.target.checked);
  // Save as "last used" for next session
  await saveLastUsed('nesting', e.target.checked);
  updateSavePresetButton();
  render();
});

// Event type filters — layer on top of tool/category visibility, never mutate hiddenTools
if (elements.scriptsFilter) {
  elements.scriptsFilter.addEventListener('click', async (e) => {
    e.preventDefault();
    const current = state.filters.eventTypes.scripts;
    // Cycle: auto → only → hide → auto
    const next = current === 'auto' ? 'only' : current === 'only' ? 'hide' : 'auto';
    state.filters.eventTypes.scripts = next;
    updateScriptsFilterUI();
    trackEvent('filter_script', { action: 'select', mode: next });
    updateSavePresetButton();
    await saveLastUsed('scripts', next);
    render();
  });
  // Context menu for Scripts filter
  elements.scriptsFilter.addEventListener('contextmenu', (e) => showEventTypeContextMenu(e, 'scripts'));
}

if (elements.consentFilter) {
  elements.consentFilter.addEventListener('click', async (e) => {
    e.preventDefault();
    const current = state.filters.eventTypes.consent;
    // Cycle: auto → only → hide → off → auto
    const next = current === 'auto' ? 'only' : current === 'only' ? 'hide' : current === 'hide' ? 'off' : 'auto';
    state.filters.eventTypes.consent = next;
    updateConsentFilterUI();
    trackEvent('filter_consent', { action: 'select', mode: next });
    updateSavePresetButton();
    await saveLastUsed('consent', next);
    render();
  });
}

// Interactions filter (2-state toggle: show ↔ hide)
if (elements.interactionsFilter) {
  elements.interactionsFilter.addEventListener('click', async (e) => {
    e.preventDefault();
    const current = state.filters.eventTypes.interactions;
    const next = !current;
    state.filters.eventTypes.interactions = next;
    updateInteractionsFilterUI();
    trackEvent('filter_interaction', { action: 'select', mode: next ? 'show' : 'hide' });
    updateSavePresetButton();
    await saveLastUsed('interactions', next);
    render();
  });
}

// Platform context menu event listeners
if (elements.platformContextMenu) {
  // Handle context menu item clicks
  elements.platformContextMenu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = item.dataset.action;
      handleContextMenuAction(action);
    });
  });
}

// Close context menus when clicking outside
document.addEventListener('click', () => {
  hidePlatformContextMenu();
  hidePageContextMenu();
  hideScriptTreeContextMenu();
  hideGroupContextMenu();
  hideInteractionContextMenu();
  hideExportContextMenu();
  hideReloadContextMenu();
  hideClearContextMenu();
});

// Close context menus on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    hidePlatformContextMenu();
    hidePageContextMenu();
    hideScriptTreeContextMenu();
    hideGroupContextMenu();
    hideInteractionContextMenu();
    hideExportContextMenu();
    hideReloadContextMenu();
    hideClearContextMenu();
  }
});

// Initialize filter bar module
initFilterBar({
  getState: () => state,
  elements,
  render,
  trackEvent,
  PLATFORM_CATEGORIES,
  PLATFORM_NAMES,
  // #149: full formal names for the chip hover tooltip — the chip label stays
  // shortName (PLATFORM_NAMES); only the tooltip switches to the full name.
  PLATFORM_FULL_NAMES,
  platformToCategory,
  getPlatformsForCategory,
  getCategoryForPlatform,
  getUnknownChipDescriptors,
  updateCategoryStateFromTools,
  toggleCategory,
  updatePlatformCounts,
  getEventType,
  updateSavePresetButton,
  updateSetting,
  saveLastUsed,
  copyEventAsJSON,
  copyEventWithProperties,
  copyEventAsExtended,
  copyEventConsent,
  copyEventsAsTable,
  copyEventsAsJSON,
  copyEventsAsProperties,
  copyEventsAsFullExport,
  showExportFormatsHelp,
  isConsentCheckEnabled,
  hidePageContextMenu,
  hideGroupContextMenu,
  hideScriptTreeContextMenu,
  hideInteractionContextMenu,
  hideExportContextMenu,
});

// Initialize smart search module
initSmartSearch({
  getState: () => state,
  elements,
  render,
  trackEvent,
  PLATFORM_NAMES,
  PLATFORM_CATEGORIES,
  KNOWN_TRACKING_ENDPOINTS,
  platformToCategory,
});

// Initialize context menus module (Page, Script Tree, Tool View, Domain)
initContextMenus({
  getState: () => state,
  elements,
  trackEvent,
  getCategoryForPlatform,
  hidePlatformContextMenu,
  showOnlyPlatform,
  hideToolFromContextMenu,
  toggleHighlightPlatform,
  clearAllHighlights,
  showOnlyCategory,
  toggleHighlightCategory,
  copyPageEventsAsTable,
  copyPageEventsAsJSON,
  copyPageEventsWithProperties,
  copyPageFullExport,
  copyDataLayerAsJSON,
  copySelectedBranch,
  copyEventsAsTable,
  copyEventsAsJSON,
  copyEventsAsProperties,
  copyEventsAsFullExport,
  hideInteractions: async () => {
    state.filters.eventTypes.interactions = false;
    updateInteractionsFilterUI();
    updateSavePresetButton();
    await saveLastUsed('interactions', false);
    render();
  },
  copyAllEventsAsTable,
  copyPinnedAsTable,
  copyAllEventsAsJSON,
  copyAllEventsWithProperties,
  copyAllScriptTreeAsJSON,
  copyAllScriptTreeAsMarkdown,
  copyAllFullExport,
  copyAllDataLayerAsJSON,
  copyDataLayerPushesAsJSON,
  // "Compare formats" help modal — opened from the (?) link at the top
  // of every export context menu.
  showExportFormatsHelp,
  // "About MartechStack Builder" modal — opened from the inline ℹ️ next
  // to the *Save as MartechStack Builder JSON* menu item in Stack view.
  showMartechStackBuilderInfo,
  // AI modal opener — used by the "Start AI Chat for Page" / "Start AI
  // Session Chat" entries on the page / export context menus.
  openAiModal,
  // Stack export — invoked from the Export context menu when in Stack
  // view. Exports the current page's domain graph (cached on Generate);
  // rebuilds on the fly only as a fallback when the user opens Export
  // before generating. Other domains' graphs are exported via their own
  // domain-section actions in the Stack view.
  exportStack: (format) => {
    const currentETLD = state.currentPageHostname
      ? normalizeToRegistrableDomain(state.currentPageHostname)
      : null;
    const graph = (currentETLD && state.stackGraphs.get(currentETLD))
      || buildStackGraph(state.events, scriptInitiatorMap, state.currentPageHostname);
    handleStackExport(format, graph);
  },
});

// Initialize preset manager module
initPresetManager({
  getState: () => state,
  elements,
  loadSettings,
  saveSettings,
  PLATFORM_CATEGORIES,
  PLATFORM_NAMES,
  getPlatformsForCategory,
  updateCategoryStateFromTools,
  showAllTools,
  updateScriptsFilterUI,
  updateConsentFilterUI,
  updateInteractionsFilterUI,
  render,
  escapeHtml,
  trackEvent,
});

// Initialize settings, help, and report modules (listeners + async settings load)
initSettings({
  getState: () => state,
  elements,
  render,
  trackEvent,
  setDebugLogging,
  setExtendedTracking,
  updateStreamDirectionButton,
  updateSortButtonUI,
  updateScriptsFilterUI,
  updateConsentFilterUI,
  updateInteractionsFilterUI,
  updatePresetDropdown,
  updateSavePresetButton,
  initAnalytics,
  setAnalyticsLocation,
  setDevToolsContext,
  setResolvedThemeGetter,
  setSettingsUserProperties,
  setExtendedPerfLogging: (val) => { extendedPerfLogging = val; },
  handleViewModeChange,
  invalidateConsentChecks: () => {
    for (const ev of state.events) { delete ev._consentCheck; }
    updateConsentCounter();
  },
});
initHelpModal({
  getState: () => state,
  elements,
  trackEvent,
  openReportModal,
});

// AI modal (v1.1.0) — toolbar button + Provider / Chat / About tabs.
initAiConsentDialog({ elements, trackEvent });
initAiModal({
  elements,
  trackEvent,
  // Provider panel is lazy-initialized on first activation of the Provider tab.
  initProviderPanel: () => initAiProviderPanel({
    elements,
    trackEvent,
    setSettingsUserProperties,
    requestAiConsent,
  }),
  // Usage tab — lazy-initialized on first activation. Pulls usage on
  // demand from the service worker (single source of truth).
  initUsageTab: () => initAiUsageTab({
    elements,
    trackEvent,
    getAiUsage: () => new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: MSG.GET_AI_USAGE }, (snapshot) => {
          if (snapshot && snapshot.success) {
            resolve({
              sessionTotals: snapshot.sessionTotals || { requests: 0, tokensIn: 0, tokensOut: 0, costEstimate: 0 },
              perProvider: snapshot.perProvider || {},
              dailyCounts: snapshot.dailyCounts || { date: null, counts: {} },
              last30Days: snapshot.last30Days || { totals: null, perProvider: {} },
            });
          } else {
            resolve(null);
          }
        });
      } catch {
        resolve(null);
      }
    }),
  }),
  // Refresh the Usage tab on re-activation — only a no-op until the
  // tab has been initialized once.
  refreshUsageTab: () => refreshAiUsageTab(),
  // Chat tab — lazy-initialized on first activation. Passes the
  // getHelpers() + state shape that the context-serializer expects.
  initChatTab: () => initAiChatTab({
    elements,
    trackEvent,
    getState: () => state,
    getHelpers: () => ({
      getPlatformName: (id) => PLATFORM_NAMES[id] || id,
      getCategoryInfo,
      getConsentCheckForEvent,
    }),
    getFilteredEvents,
    // Resolves a scope object ({ kind, pageEventId } or { kind, eventIds })
    // to the events that should seed the chat snapshot. `'page'` keeps its
    // dedicated path; every other kind from feature #61 (tool / domain /
    // event_name / consent_category) ships an `eventIds` array — filter
    // `state.events` by ID and return the match. Returns [] on miss so the
    // Chat tab falls back to its regular session/filtered event source.
    getScopedEvents: (scope) => {
      if (!scope) return [];
      if (scope.kind === 'page' && scope.pageEventId) {
        const { events } = getPageEvents(scope.pageEventId);
        return events || [];
      }
      if (Array.isArray(scope.eventIds) && scope.eventIds.length > 0) {
        const ids = new Set(scope.eventIds);
        return state.events.filter(e => ids.has(e.id));
      }
      return [];
    },
    getGenerator: () => ({
      name: 'Event Watcher',
      version: chrome.runtime?.getManifest?.()?.version || 'unknown',
    }),
  }),
  // Forwarded to openAiModal so external callers (context menus) can
  // re-scope the Chat tab without touching its internals directly.
  applyChatScope,
});

// Reconcile FEATURE_FLAGS with `chrome.storage.local.feature_flags`. On
// first boot this also seeds the storage key with defaults so it's
// visible in the DevTools Application storage viewer — the discovery
// surface for a curious user who wants to flip a flag true. Top-level
// await is allowed in ES modules; panel.html loads this file as
// type="module".
await loadFeatureFlags();

// Stack View kill-switch (Feature #71). Default ON — we explicitly hide
// the surface only when the user has flipped `feature_flags.stackView`
// to false in chrome.storage.local. Keeps the cached graphs intact, so
// re-enabling without rebuilding restores the previous state. If the
// view is the active one when disabled, fall back to Stream so the
// user doesn't see a blank panel.
if (!FEATURE_FLAGS.stackView) {
  if (elements.viewModeStackToggle) {
    elements.viewModeStackToggle.style.display = 'none';
  }
  if (state.viewMode === 'stack') {
    state.viewMode = 'stream';
    state.selectedTool = null;
  }
}

// Populate the current extension version in the help modal title and the footer link,
// and wire the footer link to open the Versions tab directly.
(() => {
  const version = chrome.runtime?.getManifest?.().version;
  if (!version) return;
  if (elements.helpTitleVersion) {
    elements.helpTitleVersion.textContent = 'v' + version;
  }
  if (elements.footerVersion) {
    elements.footerVersion.textContent = 'v' + version;
    elements.footerVersion.addEventListener('click', (e) => {
      e.preventDefault();
      openHelpModal('versions');
    });
  }
})();
initToolsModal({
  elements,
  getState: () => state,
  trackEvent,
  escapeHtml,
  getCategoryForPlatform,
  getPlatformIcon,
  getRequiredConsentCategory,
  KNOWN_TRACKING_ENDPOINTS,
  PLATFORM_COUNT,
  PLATFORM_CATEGORIES,
  CATEGORY_ICONS,
  getCustomEndpoints,
  loadCustomEndpoints,
  matchKnownEndpoint,
  getDetectedGTMContainers,
  getCurrentDomain,
});
initGTMModal({
  getState: () => state,
  getDetectedGTMContainers,
  getCurrentDomain,
  getScriptsLoadedBy,
  escapeHtml,
});
initReportModal({
  getState: () => state,
  elements,
  trackEvent,
  setUserId,
});
// Initialize theme as early as possible so the panel renders with the right colors
initTheme();

// When the theme is changed from another surface (e.g. the sidepanel),
// chrome.storage.onChanged in theme.js applies the new value here too.
// Keep the Settings modal's 3-state button group and the Amplitude
// `setting_theme` user property aligned with that change.
onThemeChange(({ preference }) => {
  document.querySelectorAll('#theme-default-settings .settings-button-option').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.value === preference);
  });
  setSettingsUserProperties({ setting_theme: preference });
});

// Initialize responsive toolbar — watches panel width and collapses the toolbar across 5 tiers.
initToolbarResponsive({
  toolbar: elements.toolbar,
  overflowBtn: elements.toolbarOverflowBtn,
  overflowMenu: elements.toolbarOverflowMenu,
  overflowGroup: elements.toolbarOverflowGroup,
  searchContainer: elements.smartSearchContainer,
  searchInput: elements.smartSearchInput,
  searchExpandBtn: elements.smartSearchExpandBtn,
  gtmBtn: elements.gtmBtn,
  trackEvent,
});

// Initialize progressive collapse for the filter bar (Show All / Hide All / event-type filters).
initFilterBarResponsive({
  filterBar: elements.categoryToolbar,
});

// Header theme toggle (sun/moon) — flips between light and dark.
// When the user clicks, we explicitly switch preference away from 'system';
// the 3-state setting in Settings reflects the new explicit choice.
if (elements.themeToggleBtn) {
  elements.themeToggleBtn.addEventListener('click', async () => {
    const next = getResolvedTheme() === 'dark' ? 'light' : 'dark';
    await toggleTheme();
    trackEvent('setting_change', { setting: 'theme', value: next, source: 'header' });
    setSettingsUserProperties({ setting_theme: next });
    // Sync the settings 3-state button group if the settings modal is rendered
    document.querySelectorAll('#theme-default-settings .settings-button-option').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.value === next);
    });
  });
}

initializeSettings().then(async () => {
  try {
    // Sync the Grouped chip row to whatever pinned set the user persisted —
    // the HTML defaults match the install defaults, so this is a no-op for
    // most users but matters for anyone who customised their pins.
    syncGroupedToolbarChips();
    updateViewModeButtonStates();

    const settings = await loadSettings();

    // Phase 0 — one-shot owl wiggle on first panel open.
    // Draws attention to the owl without a tooltip (tooltip on first load is too noisy).
    if (!settings.onboardingOwlShown && window.OwlTips) {
      setTimeout(() => window.OwlTips.animate('owl-wiggle'), 1500);
      await updateSetting('onboardingOwlShown', true);
      trackEvent('onboarding_step', {
        action: 'owl_highlight',
        step: 0,
        step_name: 'owl_highlight',
        total_steps: 1,
        tour_version: (window.OnboardingTour && window.OnboardingTour.TOUR_VERSION) || 1,
        tour: 'base'
      });
    }

    // Bump the panel-open counter so the extended tour can trigger once the
    // user has lived with the basics for a while (see scheduleOnboardingTour).
    await updateSetting(
      'onboardingPanelOpenCount',
      (settings.onboardingPanelOpenCount || 0) + 1
    );

    // Bump the Review Prompt's panel-open counter (a separate top-level key,
    // independent of the onboarding count above so semantics stay clean if
    // either is reset). Triggers a review-prompt eligibility check.
    bumpEngagementAndMaybeAskForReview('panelOpenCount');

    // What's New — show upgrade announcement for returning users.
    // The service worker sets `_whatsNew` in storage on extension update;
    // fresh installs never have this flag and get the onboarding tour instead.
    // Actual display is deferred to first-event arrival via
    // `scheduleWhatsNew()` so tour steps that anchor on event-detail
    // surfaces (AI Summary section, etc.) have real events to point at.
    // See scheduleWhatsNew + scheduleOnboardingTour in addEvent.
  } catch (e) {
    // Non-critical — onboarding/whats-new failure must not break the panel
  }
});

// Load custom endpoints on startup
loadCustomEndpoints().then(() => refreshCustomEndpointRegistrations());

// Load persisted pinned state on startup so Stream view's in-row pushpin
// indicator and the Pinned view show the right state from the first paint.
loadPinnedState().then(() => {
  if (state.viewMode === 'pinned') render();
});

// Initialize GTM intercept banner on startup
updateGTMInterceptBanner();

// Listen for custom endpoint changes (from this or other DevTools panels)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.customEndpoints) {
    loadCustomEndpoints().then(() => refreshCustomEndpointRegistrations());
  }
});

// Keyboard navigation for event list (Arrow Up/Down)
document.addEventListener('keydown', (e) => {
  // Only handle arrow keys when not focused on an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
    return;
  }

  e.preventDefault();

  const filteredEvents = getFilteredEvents();
  if (filteredEvents.length === 0) {
    return;
  }

  // Sort events the same way as the visual list (newest first, with pushIndex tiebreaker)
  const sortedEvents = [...filteredEvents].sort(compareEventsDesc);

  // Find current selection index in the sorted list
  const currentIndex = state.selectedEventId
    ? sortedEvents.findIndex(event => event.id === state.selectedEventId)
    : -1;

  let newIndex;
  if (e.key === 'ArrowDown') {
    // Move down visually (higher index = older events)
    newIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, sortedEvents.length - 1);
  } else {
    // Move up visually (lower index = newer events)
    newIndex = currentIndex === -1 ? 0 : Math.max(currentIndex - 1, 0);
  }

  const newEvent = sortedEvents[newIndex];
  if (newEvent && newEvent.id !== state.selectedEventId) {
    handleEventSelect(newEvent.id);

    // Scroll the selected event into view
    const selectedElement = document.querySelector(`.event-item[data-event-id="${newEvent.id}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
});

// Resizable panel divider
const resizer = document.getElementById('resizer');
const eventListPanel = document.getElementById('event-list-panel');

if (resizer && eventListPanel) {
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = eventListPanel.offsetWidth;

    document.body.classList.add('resizing');
    resizer.classList.add('resizing');

    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const deltaX = e.clientX - startX;
    const newWidth = Math.min(Math.max(startWidth + deltaX, 200), 600);
    eventListPanel.style.width = `${newWidth}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isResizing) {
      isResizing = false;
      document.body.classList.remove('resizing');
      resizer.classList.remove('resizing');

      // Save width preference
      try {
        chrome.storage.local.set({ eventListPanelWidth: eventListPanel.offsetWidth });
      } catch (e) {
        // Extension context may be invalidated after reload
      }
    }
  });

  // Restore saved width on load
  chrome.storage.local.get(['eventListPanelWidth']).then(result => {
    if (result.eventListPanelWidth) {
      const width = parseInt(result.eventListPanelWidth, 10);
      if (width >= 200 && width <= 600) {
        eventListPanel.style.width = `${width}px`;
      }
    }
  });

  // Detail panel collapse/expand functionality
  const resizerToggle = document.getElementById('resizer-toggle');
  let isDetailCollapsed = false;
  let savedWidthBeforeCollapse = null;

  function toggleDetailPanel() {
    isDetailCollapsed = !isDetailCollapsed;

    if (isDetailCollapsed) {
      // Save current width before collapsing
      savedWidthBeforeCollapse = eventListPanel.offsetWidth;
      eventListPanel.style.width = '';
    } else {
      // Restore previous width
      if (savedWidthBeforeCollapse) {
        eventListPanel.style.width = `${savedWidthBeforeCollapse}px`;
      }
    }

    document.body.classList.toggle('detail-collapsed', isDetailCollapsed);

    // Persist state
    const collapseState = { detailPanelCollapsed: isDetailCollapsed ? 'true' : 'false' };
    if (savedWidthBeforeCollapse) {
      collapseState.eventListPanelWidthBeforeCollapse = savedWidthBeforeCollapse;
    }
    chrome.storage.local.set(collapseState);
  }

  // Double-click on resizer to toggle
  resizer.addEventListener('dblclick', (e) => {
    e.preventDefault();
    toggleDetailPanel();
  });

  // Click on toggle button
  if (resizerToggle) {
    resizerToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDetailPanel();
    });
  }

  // Restore collapsed state on load
  chrome.storage.local.get(['detailPanelCollapsed', 'eventListPanelWidthBeforeCollapse']).then(result => {
    if (result.eventListPanelWidthBeforeCollapse) {
      savedWidthBeforeCollapse = parseInt(result.eventListPanelWidthBeforeCollapse, 10);
    }

    if (result.detailPanelCollapsed === 'true') {
      isDetailCollapsed = true;
      document.body.classList.add('detail-collapsed');
      eventListPanel.style.width = '';
    }
  });
}

// Events arrive via GET_EVENTS polling; the MCP-driven clear (Feature #81
// Phase 2) arrives via the persistent port — see `connectToServiceWorker()`
// for the port.onMessage listener. The former runtime.onMessage listener
// here handled only the dead ANALYTICS_EVENT push path (removed 2026-06-11,
// #135 WP2 zombie cleanup — nothing ever constructed it).

// Track known event IDs to avoid duplicates when polling
const knownEventIds = new Set();

// Request existing events from background when panel opens
chrome.runtime.sendMessage({
  type: MSG.GET_EVENTS,
  tabId: chrome.devtools.inspectedWindow.tabId
}, (response) => {
  // Check for extension context invalidation
  if (chrome.runtime.lastError) {
    // Extension was reloaded, ignore silently
    return;
  }
  if (response && response.events) {
    response.events.forEach(event => {
      knownEventIds.add(event.id);
      addEvent(event);
    });
  }
  // Process CMP consent state from window API probing
  if (response?.cmpConsentState) {
    processCMPConsentState(response.cmpConsentState);
  }
});

// Poll for new events periodically
// This is needed because chrome.runtime.sendMessage from background to DevTools panels is unreliable
const pollIntervalId = setInterval(() => {
  try {
    chrome.runtime.sendMessage({
      type: MSG.GET_EVENTS,
      tabId: chrome.devtools.inspectedWindow.tabId
    }, (response) => {
      if (chrome.runtime.lastError) {
        // Extension context invalidated, stop polling
        clearInterval(pollIntervalId);
        return;
      }
      if (response && response.events) {
        // Add only events we haven't seen before
        response.events.forEach(event => {
          if (!knownEventIds.has(event.id)) {
            knownEventIds.add(event.id);
            addEvent(event);
          }
        });
      }
      // Process CMP consent state from window API probing
      if (response?.cmpConsentState) {
        processCMPConsentState(response.cmpConsentState);
      }
    });
  } catch (e) {
    // Extension context invalidated, stop polling silently
    clearInterval(pollIntervalId);
  }
}, 500); // Poll every 500ms

// Persistent port connection to the service worker.
// Keeps the SW alive while DevTools is open and ensures devtools-scoped GTM intercept
// rules survive SW hibernation. If the SW restarts, the port disconnects and we
// automatically reconnect, re-sending PANEL_CONNECTED so DNR rules are re-synced.
let panelPort = null;

function connectToServiceWorker() {
  try {
    panelPort = chrome.runtime.connect({ name: `devtools-panel-${chrome.devtools.inspectedWindow.tabId}` });
    panelPort.postMessage({ type: MSG.PANEL_CONNECTED, tabId: chrome.devtools.inspectedWindow.tabId });
    // Feature #81 Phase 2 — SW pushes through the persistent port (not the
    // runtime broadcast bus). Listen here so MCP-driven clear events arrive
    // even on dev installs without DevTools focus.
    panelPort.onMessage.addListener((message) => {
      if (message?.type === MSG.MCP_CLEAR_PANEL_EVENTS) {
        try { clearEvents(); } catch { /* defensive */ }
      }
    });
    panelPort.onDisconnect.addListener(() => {
      panelPort = null;
      // SW restarted — reconnect after a brief delay to let it initialize
      setTimeout(connectToServiceWorker, 200);
    });
  } catch {
    // Extension context invalidated (e.g., extension updated/reloaded)
  }
}

// Feature #81 Phase 2 — flip on AI-export auto-publish for unpacked installs
// (`installType === 'development'`). The MCP-driven regression harness can then
// poll `window.__eventWatcher.lastAIExport` without a human "Copy for AI" click.
// CWS installs return `installType: 'normal'` and this stays disabled.
try {
  chrome.runtime.sendMessage({ type: MSG.GET_INSTALL_TYPE }, (response) => {
    if (chrome.runtime.lastError) return;  // SW unavailable; auto-publish stays off
    if (response?.installType === 'development') {
      setAIExportAutoPublish(true);
    }
  });
} catch { /* extension context invalidated — ignore */ }
connectToServiceWorker();

// Clean up interval and notify service worker when panel is unloaded
window.addEventListener('unload', () => {
  clearInterval(pollIntervalId);
  if (panelPort) {
    try { panelPort.postMessage({ type: MSG.PANEL_DISCONNECTED, tabId: chrome.devtools.inspectedWindow.tabId }); } catch {}
    panelPort = null;
  }
});

// Fire a surface-lifecycle end event when the DevTools panel document unloads —
// DevTools close, tab close, or panel teardown. Uses beacon delivery so the
// event survives document teardown.
let devtoolEndFired = false;
function fireDevtoolEnd() {
  if (devtoolEndFired) return;
  devtoolEndFired = true;
  trackEvent('devtool_end', {}, { beacon: true });
}
window.addEventListener('pagehide', fireDevtoolEnd);

// ========================================
// Performance Measurement
// ========================================

/**
 * Update the performance indicator in the status footer
 * Compact format: "46ms · 114/59 requests · 240/12 tools"
 * Extended format adds: "· 42% skipped"
 * Meaning: time · matched/total requests · matched/total tools
 */
function updatePerfIndicator() {
  const indicator = document.getElementById('perf-indicator');
  const statsEl = document.getElementById('perf-stats');
  if (!indicator || !statsEl) return;

  const stats = pageLoadStats || perfStats;
  const ms = Math.round(stats.totalMatchTimeMs);
  const matchedToolsCount = stats.matchedToolsCount ?? stats.matchedTools?.size ?? 0;

  // Update text - format: "23ms · 26/166 requests · 7/240 tools" (matched/total)
  let text;
  if (pageLoadComplete && pageLoadStats) {
    text = `${ms}ms · ${stats.matchCount}/${stats.requestCount} requests · ${matchedToolsCount}/${stats.totalToolCount} tools`;
  } else {
    text = `${ms}ms · ${stats.requestCount} requests...`;
  }

  // Add extended stats when enabled
  if (extendedPerfLogging && pageLoadComplete) {
    const endpointStats = getDebugStats();
    const skipped = endpointStats.skippedByExtension || 0;
    const totalRequests = stats.requestCount + skipped;
    const skippedPct = totalRequests > 0 ? Math.round((skipped / totalRequests) * 100) : 0;
    // Use totalCalls as denominator - this is how many times matchKnownEndpoint was called
    // A call is either a cache hit OR requires known/unknown domain lookup or full scan
    const totalCalls = endpointStats.totalCalls || 1;
    const cacheHitPct = Math.round((endpointStats.cacheHits / totalCalls) * 100);
    const knownPct = Math.round((endpointStats.knownDomains / totalCalls) * 100);
    const unknownPct = Math.round((endpointStats.unknownDomains / totalCalls) * 100);
    text += ` · ${skippedPct}% skipped · ${cacheHitPct}% cached · ${knownPct}% known · ${unknownPct}% unknown`;
  }

  statsEl.textContent = text;

  // Update color class based on total matching time
  indicator.classList.remove('perf-green', 'perf-yellow', 'perf-red');
  if (ms < 50) {
    indicator.classList.add('perf-green');
  } else if (ms < 200) {
    indicator.classList.add('perf-yellow');
  } else {
    indicator.classList.add('perf-red');
  }
}

/**
 * Schedule page load complete detection
 * After 2 seconds of no new requests, freeze the stats
 */
function scheduleLoadComplete() {
  if (pageLoadComplete) return;
  clearTimeout(loadCompleteTimer);
  loadCompleteTimer = setTimeout(() => {
    pageLoadComplete = true;
    // Snapshot stats, converting Set to count for the frozen snapshot
    pageLoadStats = {
      ...perfStats,
      matchedToolsCount: perfStats.matchedTools.size
    };
    updatePerfIndicator();

    // Track devtool_page event
    // Get list of detected tool IDs as simple string array. The internal
    // 'other' platform ID is remapped to 'unknown' on the wire — clearer in
    // Amplitude property values, while keeping the codebase's single internal
    // identifier for the unknown bucket. The actual hostnames live in the
    // separate `tools_unknown` array (feature #47).
    const tools = Object.entries(state.platformCounts)
      .filter(([, count]) => count > 0)
      .map(([toolId]) => toolId === 'other' ? 'unknown' : toolId);

    // Get unique categories represented by detected tools
    const categories = [...new Set(tools.map(toolId => platformToCategory[toolId] || 'unknown'))];

    // Build per-category tool arrays (e.g., tools_analytics: ['ga4', 'amplitude'])
    const categoryParams = {};
    for (const [catId, paramSuffix] of Object.entries(CATEGORY_PARAM_NAMES)) {
      const catTools = tools.filter(toolId => (platformToCategory[toolId] || 'unknown') === catId);
      if (catTools.length > 0) {
        categoryParams[`tools_${paramSuffix}`] = catTools;
      }
    }

    // Collect "<platformId> | <hostname>" pairs identified by structural fingerprinting
    // (ASSUMED badge). Feature #70 — restores the host signal that the fingerprint
    // overwrite at request-handlers.js:2696 strips from the tools_unknown pipeline.
    // Falls back to platform-ID-only entries when the user has opted out of host
    // sharing via Settings → Privacy → Share unknown tracker hostnames, preserving
    // the v1.2.0-and-earlier shape of the assumed-tool signal.
    const toolsAssumed = collectAssumedPairs(
      state.events,
      state.currentPageHostname,
      getCustomEndpoints(),
      ignoredEndpoints,
      { includeHosts: state.shareUnknownEndpointHostnames !== false }
    );

    // Crowdsourced Unknown Tool Registry (feature #47) — snapshot the per-page-load
    // Set of unknown tracker hostnames into a sorted array. The wire property is
    // named `tools_unknown` so it groups with the existing `tools_*` per-category
    // arrays in Amplitude's property autocomplete; the values are hostnames rather
    // than tool IDs because, by definition, no tool ID exists for these. Omitted
    // when the user has turned the Privacy toggle off, when no unknowns were seen,
    // or when the global analytics opt-out is engaged (trackEvent short-circuits then).
    const toolsUnknown = state.shareUnknownEndpointHostnames !== false
      ? collectHostUnknown(state.unknownHosts)
      : [];

    trackEvent('devtool_page', {
      view: state.viewMode,
      grouping: state.viewMode === 'grouped' ? state.activeGrouping : 'flat',
      sort_mode: state.sortMode,
      stream_direction: state.streamDirection,
      stat_match_ms: pageLoadStats.totalMatchTimeMs,
      stat_request_match: pageLoadStats.matchCount,
      stat_request_total: pageLoadStats.requestCount,
      stat_tools_match: pageLoadStats.matchedToolsCount,
      stat_tools_count: pageLoadStats.totalToolCount,
      tool: tools,
      category: categories,
      ...categoryParams,
      ...(toolsAssumed.length > 0 && { tools_assumed: toolsAssumed }),
      ...(toolsUnknown.length > 0 && { tools_unknown: toolsUnknown })
    }, {
      userPropertyIncrements: {
        devtool_page_count: 1,
        devtool_page_request_match: pageLoadStats.matchCount,
        devtool_page_request_total: pageLoadStats.requestCount,
      }
    });

    // Bump the local lifetime page-load counter (top-level chrome.storage.local
    // key) and ask the Review Prompt scheduler whether it's time. Amplitude's
    // devtool_page_count user property is backend-only, so the panel needs its
    // own readable counter.
    bumpEngagementAndMaybeAskForReview('pageLoadCount');
  }, 2000);
}

const REVIEW_ENGAGEMENT_KEYS = ['panelOpenCount', 'toolSelectCount', 'pageLoadCount'];

/**
 * Increment one of the local engagement counters (panelOpenCount,
 * toolSelectCount, pageLoadCount) and ask the Review Prompt scheduler
 * whether it's time to show the bubble. Deferred ~1.5s so it doesn't
 * compete with whatever just happened (devtool_page render, event select,
 * panel boot). No-op if the bubble script isn't loaded.
 *
 * @param {'panelOpenCount'|'toolSelectCount'|'pageLoadCount'} key
 */
async function bumpEngagementAndMaybeAskForReview(key) {
  if (!REVIEW_ENGAGEMENT_KEYS.includes(key)) return;
  try {
    const stored = await chrome.storage.local.get(REVIEW_ENGAGEMENT_KEYS);
    const next = (Number(stored[key]) || 0) + 1;
    await chrome.storage.local.set({ [key]: next });

    if (!window.ReviewPrompt) return;
    const engagement = {
      panelOpenCount:  Number(stored.panelOpenCount)  || 0,
      toolSelectCount: Number(stored.toolSelectCount) || 0,
      pageLoadCount:   Number(stored.pageLoadCount)   || 0,
      [key]: next
    };
    const settings = await loadSettings();
    setTimeout(() => {
      try {
        window.ReviewPrompt.checkAndShow({
          engagement,
          settings,
          trackEventFn: trackEvent,
          hooks: { openReport: () => openReportModal() }
        });
      } catch (_) { /* non-critical */ }
    }, 1500);
  } catch (_) { /* non-critical */ }
}

/**
 * Reset performance stats on new page navigation
 */
function resetPerfStats() {
  perfStats = {
    totalMatchTimeMs: 0,
    requestCount: 0,
    matchCount: 0,
    matchedTools: new Set(),
    totalToolCount: PLATFORM_COUNT
  };
  pageLoadStats = null;
  pageLoadComplete = false;
  clearTimeout(loadCompleteTimer);
  resetDebugStats(); // Reset endpoint matching stats
  updatePerfIndicator();
}

// Reset perf stats when navigating to a new page
chrome.devtools.network.onNavigated.addListener(() => {
  resetPerfStats();
  clearMatchCache(); // Clear URL→result cache for fresh page
  _gtmInterceptPendingReload = false; // Page reloaded — rules are now in effect
  updateGTMInterceptBanner(); // Refresh banner for new domain
  updateGTMButtonState(); // Reset button state for new domain
});

// Listen for network requests via DevTools API
chrome.devtools.network.onRequestFinished.addListener((request) => {
  // Skip CORS preflight requests - these are browser security checks, not tracking
  // They use OPTIONS method and contain no tracking data
  if (request.request.method === 'OPTIONS') {
    return;
  }

  // Start performance measurement for this request
  const perfStart = performance.now();

  try {
    routeRequest(request);
  } finally {
    // Record performance timing for this request
    const elapsed = performance.now() - perfStart;
    perfStats.totalMatchTimeMs += elapsed;
    perfStats.requestCount++;
    scheduleLoadComplete();
    updatePerfIndicator();
  }
});


// Initial setup
render();

// Export category info for use in event-detail.js
export function getCategoryInfo(platform) {
  const categoryId = getCategoryForPlatform(platform);
  const category = PLATFORM_CATEGORIES[categoryId];
  const iconKey = category?.icon || 'more';
  return {
    id: categoryId,
    name: category?.name || 'Unknown',
    icon: CATEGORY_ICONS[iconKey] || CATEGORY_ICONS.more
  };
}

// ========================================
// Owl Easter Egg (loaded from components/owl-tips.js)
// ========================================
if (window.OwlTips) {
  window.OwlTips.init(trackEvent);
  // Let settings-specific tips open the Settings modal when they reference
  // an item inside it (e.g. Correlation windows, Replay tour).
  if (typeof window.OwlTips.configureHooks === 'function') {
    window.OwlTips.configureHooks({
      openSettings: openSettingsModal,
      closeSettings: closeSettingsModal
    });
  }
}

// ========================================
// Onboarding Tour hooks (loaded from components/onboarding-tour.js)
// ========================================
// Give the tour the handful of DevTools-internal callbacks it needs so steps
// can open/close the Settings and Help modals and switch view modes. The tour
// module itself loads as a classic script and can't import ES modules.
if (window.OnboardingTour && typeof window.OnboardingTour.configureHooks === 'function') {
  // Wrap every hook that the tour fires automatically (open/close modal, switch
  // view) so the side-effect analytics events (setting_modal, help_modal,
  // gtm_hub_modal, report_modal, view_switch, …) don't show up in product data
  // as if the user had done them. `onboarding_step` itself is exempt inside
  // trackEvent so tour progress is still measurable.
  const silent = (fn) => (...args) => {
    setAnalyticsSuppressed(true);
    try { return fn(...args); } finally { setAnalyticsSuppressed(false); }
  };
  window.OnboardingTour.configureHooks({
    openSettings: silent(openSettingsModal),
    closeSettings: silent(closeSettingsModal),
    openHelp: silent(() => openHelpModal('getting-started')),
    closeHelp: silent(closeHelpModal),
    setViewMode: silent((mode, grouping) => handleViewModeChange(mode, grouping || null)),
    getViewMode: () => state.viewMode,
    getActiveGrouping: () => state.activeGrouping,
    hasScriptEvents: () => state.events.some(e => e.isScriptLoad),
    reloadPage: silent(() => chrome.devtools.inspectedWindow.reload()),
    openGTM: silent(openGTMModal),
    closeGTM: silent(closeGTMModal),
    // Accepts an optional tab id ('provider' | 'chat' | 'usage' | 'about')
    // so tour steps can land on the right surface; calling with no arg
    // preserves the previous default-tab behaviour.
    openAI: silent((tabName) => openAiModal(tabName)),
    closeAI: silent(closeAiModal),
    openToolsList: silent(openSupportedToolsModalDefault),
    closeToolsList: silent(closeSupportedToolsModal),
    openCustomEndpoints: silent(() => _openToolsModalForCustomEndpoint({})),
    openReport: silent(() => openReportModal()),
    closeReport: silent(closeReportModal),
    // Grouped-view + picker — used by the v1.2.0 What's New tour. Wrapping
    // openGroupingPicker in silent() drops the `view_plus` event so the
    // tour-driven open doesn't pollute the picker-discovery signal.
    openGroupedPicker: silent(openGroupingPicker),
    closeGroupedPicker: silent(closeGroupingPicker),
    // Filter-step demo for the onboarding tour — runs `Show only` on the
    // LAST category-frame in the toolbar so the user actually sees the
    // event stream shrink during the bubble. The last category is
    // typically a small one (Widgets, Session Replay, etc.) which makes
    // the visual change obvious. demoFilterRestore() puts the previous
    // tool/preset state back exactly on tour exit. Both are silent()-
    // wrapped so the tour-driven filter changes don't fire
    // `filter_category` events into product analytics.
    demoFilterShowOnlyLast: silent(() => {
      const frames = document.querySelectorAll('#category-toolbar .category-frame[data-category]');
      if (!frames.length) return;
      // Walk backwards to find a category that has at least one detected
      // platform — categories with no detections won't produce a visible
      // change in the stream.
      for (let i = frames.length - 1; i >= 0; i--) {
        const frame = frames[i];
        const categoryId = frame.dataset.category;
        if (!categoryId) continue;
        const platforms = [...state.detectedPlatforms].filter(
          (p) => getCategoryForPlatform(p) === categoryId
        );
        if (platforms.length === 0) continue;
        // Backup the tool/preset state so demoFilterRestore() can put it
        // back exactly — clicking "Show All" would clobber a user who had
        // filters set up before starting the tour.
        _filterDemoBackup = {
          activePresetVisibleTools: state.activePresetVisibleTools
            ? [...state.activePresetVisibleTools]
            : null,
          hiddenTools: [...state.hiddenTools]
        };
        showOnlyCategory(platforms, categoryId);
        return;
      }
    }),
    demoFilterRestore: silent(() => {
      if (!_filterDemoBackup) return;
      state.activePresetVisibleTools = _filterDemoBackup.activePresetVisibleTools;
      state.hiddenTools = _filterDemoBackup.hiddenTools;
      _filterDemoBackup = null;
      updateCategoryStateFromTools();
      render();
    }),
    // Called from the owl step's "Continue on extended tour" button. Kept here
    // (rather than inside onboarding-tour.js) so panel.js owns the settings key.
    startExtendedTour: () => {
      window.OnboardingTour.startExtended({
        trackEventFn: trackEvent,
        onComplete: (version) => updateSetting('onboardingExtendedCompletedVersion', version),
        reason: 'basic_tour_continuation'
      });
    }
  });
}

// Export analytics state for use in event-detail.js
export function getAnalyticsState() {
  return {
    preset: state.activePresetVisibleTools !== null,
    nested: state.showTriggerCorrelation
  };
}

/**
 * Read-only accessor for the captured events array. Used by components
 * that need to look across the whole session (e.g. the dataLayer AI
 * Summary when asked to audit quality/consistency across pushes) without
 * importing the full state object.
 * @returns {Array<Object>} the live events array
 */
export function getCapturedEvents() {
  return state.events;
}

/**
 * Get platform info for an initiator URL (for displaying in event detail)
 * Looks up what platform/tool the initiator script belongs to
 * @param {string} initiatorUrl - URL of the script that loaded this one
 * @returns {Object|null} Platform info { platform, name, icon } or null
 */
export function getInitiatorPlatformInfo(initiatorUrl) {
  if (!initiatorUrl) return null;

  // Find the event for this URL in our captured events
  const matchingEvent = state.events.find(e =>
    e.isScriptLoad && (e.formatted?.scriptUrl === initiatorUrl || e.raw?.url === initiatorUrl)
  );

  if (matchingEvent) {
    return {
      platform: matchingEvent.platform,
      name: matchingEvent.platformName || matchingEvent.platform?.toUpperCase() || 'Script',
      eventId: matchingEvent.id
    };
  }

  return null;
}

/**
 * Get the current page hostname (for CNAME detection at render time)
 * @returns {string} The hostname of the inspected page, or empty string
 */
export function getPageHostname() {
  return state.currentPageHostname || '';
}

/**
 * Get scripts loaded by a given script URL (direct children only)
 * @param {string} scriptUrl - URL of the script to get children for
 * @returns {Array} Array of child events loaded by this script
 */
export function getScriptsLoadedBy(scriptUrl) {
  if (!scriptUrl) return [];

  // Get all script events
  const scriptEvents = state.events.filter(e => e.isScriptLoad);

  // Find events where this script is the initiator
  return scriptEvents.filter(e => {
    const initiatorUrl = e.formatted?.initiatorUrl || e.raw?.initiatorUrl;
    return initiatorUrl === scriptUrl;
  });
}

/**
 * Open the report modal pre-filled with data from an unknown event.
 * Called from event-detail.js when user clicks "Report Missing Tool".
 * @param {Object} event - The unknown event object
 */
export function openReportModalForEvent(event) {
  openReportModal('tool');

  // Pre-fill fields from event data after a tick (modal needs to render first)
  setTimeout(() => {
    try {
      const url = new URL(event.raw?.url || '');
      // Guess a platform name from hostname: "api.example.com" → "Example"
      const hostParts = url.hostname.split('.');
      const namePart = hostParts.length > 2 ? hostParts[hostParts.length - 2] : hostParts[0];
      const guessedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

      if (elements.reportToolSubject) elements.reportToolSubject.value = guessedName;
      if (elements.reportToolWebsite) elements.reportToolWebsite.value = url.origin;
      if (elements.reportToolEndpoint) elements.reportToolEndpoint.value = url.hostname + url.pathname;
      if (elements.reportToolComment) {
        elements.reportToolComment.value = [
          `Method: ${event.raw?.method || 'unknown'}`,
          `Event name: ${event.eventName || 'none'}`,
          `Page: ${state.currentPageHostname || 'unknown'}`
        ].join('\n');
      }
    } catch (e) {
      // URL parsing failed, leave fields empty — user can fill manually
    }
  }, 0);

  trackEvent('report_tool_prefill', {
    tool: 'unknown',
    source: 'event_detail'
  });
}

/**
 * Open the Missing Tool report modal with caller-supplied pre-filled
 * values. Used by the AI Summary section after an `identify_platform`
 * task — the AI's answer gives us a much better platform name +
 * category guess than hostname-derived text, so we route through this
 * instead of `openReportModalForEvent`.
 *
 * Focuses and places the caret inside the Comments textarea on the
 * empty line following `--- User comment ---` when that header is
 * present, so the user sees "there's room for your note here" at a
 * glance and can start typing without clicking. If the header isn't
 * there, the textarea is left un-focused to stay out of the user's way.
 *
 * @param {Object} prefill
 * @param {string} [prefill.tool]     - Tool / Platform name
 * @param {string} [prefill.category] - Category dropdown value (e.g. 'analytics')
 * @param {string} [prefill.website]  - Website origin (e.g. 'https://shop.example.com')
 * @param {string} [prefill.endpoint] - Endpoint pattern or URL
 * @param {string} [prefill.comment]  - Multi-line comment body
 * @param {number} [prefill.commentRows] - Override the textarea `rows`
 *   attribute for this open (e.g. 14 to show a tall prefilled block).
 *   Reset to the HTML default on close by the caller of `openReportModal`.
 * @param {string} [prefill.source='ai_summary'] - Where the open was triggered from (analytics only)
 */
export function openReportMissingToolModal(prefill = {}) {
  openReportModal('tool');

  setTimeout(() => {
    try {
      if (prefill.tool && elements.reportToolSubject) {
        elements.reportToolSubject.value = prefill.tool;
      }
      if (prefill.category && elements.reportToolCategory) {
        // Only set if the option actually exists — otherwise leave
        // the dropdown on its placeholder so the user picks.
        const opt = elements.reportToolCategory.querySelector(`option[value="${CSS.escape(prefill.category)}"]`);
        if (opt) elements.reportToolCategory.value = prefill.category;
      }
      if (prefill.website && elements.reportToolWebsite) {
        elements.reportToolWebsite.value = prefill.website;
      }
      if (prefill.endpoint && elements.reportToolEndpoint) {
        elements.reportToolEndpoint.value = prefill.endpoint;
      }
      if (elements.reportToolComment) {
        if (prefill.commentRows && Number.isFinite(prefill.commentRows)) {
          elements.reportToolComment.rows = prefill.commentRows;
        }
        if (prefill.comment) {
          elements.reportToolComment.value = prefill.comment;
          // Drop the caret on the empty line that follows the
          // "--- User comment ---" header (if present) so the user's
          // first keystroke lands in the right place.
          const marker = '--- User comment ---';
          const idx = prefill.comment.indexOf(marker);
          if (idx !== -1) {
            const caret = idx + marker.length + 1; // +1 for the newline after the header
            elements.reportToolComment.focus();
            elements.reportToolComment.setSelectionRange(caret, caret);
          }
        }
      }
    } catch {
      // Best-effort prefill — user can fill manually if anything fails.
    }
  }, 0);

  trackEvent('report_tool_prefill', {
    tool: prefill.tool || 'unknown',
    source: prefill.source || 'ai_summary',
  });
}

/**
 * Open report modal pre-filled for a wrong consent category report.
 * @param {Object} event - The event with a consent check
 * @param {string} source - Where the button was clicked ('violation' or 'granted')
 */
export function openReportModalForConsent(event, source = 'violation') {
  const check = getConsentCheckForEvent(event);
  openReportModal('consent');

  // Pre-fill fields after a tick (modal needs to render first)
  setTimeout(() => {
    const platformName = PLATFORM_NAMES[event.platform] || event.platform || '';
    const categoryLabel = check?.categoryLabel || '';

    if (elements.reportConsentTool) elements.reportConsentTool.value = platformName;
    if (elements.reportConsentCurrent) elements.reportConsentCurrent.value = categoryLabel;
  }, 0);

  trackEvent('report_consent_prefill', {
    tool: event.platform || 'unknown',
    current_category: check?.category || 'unknown',
    consent_status: check?.status || 'unknown',
    source
  });
}

/**
 * Get the consent check result for an event (cached on event._consentCheck).
 * Returns null if no consent data, or { status, source, category, ... }
 * @param {Object} event - The event object
 * @returns {Object|null} Consent check result
 */
export function getConsentCheckForEvent(event) {
  // Return cached result if available
  if (event._consentCheck !== undefined) return event._consentCheck;

  // Skip page navigation events
  if (event.platform === 'pages') {
    event._consentCheck = null;
    return null;
  }

  // Skip script load events — loading a script is not data collection;
  // consent applies to outgoing tracking requests, not script downloads
  if (event.isScriptLoad === true) {
    event._consentCheck = null;
    return null;
  }

  // Path-based consent exclusions (e.g., Klaviyo font requests)
  const excludePatterns = platformExcludePatterns[event.platform];
  if (excludePatterns && event.raw?.url) {
    const urlLower = event.raw.url.toLowerCase();
    if (excludePatterns.some(p => urlLower.includes(p.toLowerCase()))) {
      event._consentCheck = { status: 'exempt' };
      return event._consentCheck;
    }
  }

  // Skip if no consent timeline data and no GCS on the event
  if (state.consentTimeline.length === 0 && !event.raw?.gcs && !event.formatted?.params?.gcs) {
    event._consentCheck = null;
    return null;
  }

  const platformCategory = getCategoryForPlatform(event.platform);
  const consentOverride = platformConsentCategory[event.platform] || null;
  const consumesGCM = platformConsumesGCM[event.platform] === true;
  const result = computeConsentCheck(event, platformCategory, state.consentTimeline, state.firstConsentTimestamp, consentOverride, consumesGCM);

  // Attach severity for violations — distinguishes definite tracking from ambiguous requests
  if (result && (result.status === 'denied' || result.status === 'pre-consent')) {
    result.severity = assessConsentSeverity(event);
  }

  // Detect Google Advanced Consent Mode — cookieless pings that fire intentionally
  // despite denied consent. These get advisory (yellow) treatment instead of violation (red).
  if (result && result.status === 'denied') {
    result.cookielessPing = isAdvancedConsentMode(result, event);
  }

  // User opt-out: hide the CMP/GCM mismatch advisory. The detail-view comparison
  // table still surfaces the disagreement, but the row shield, counter, and
  // section-header chip stay green.
  if (result?.gcmMismatch && !isConsentModeMismatchWarningEnabled()) {
    delete result.gcmMismatch;
  }

  event._consentCheck = result;
  return result;
}

// reconstructConsentPath() moved to consent-engine.js (#135 WP3) — components
// import it from there; panel state reaches it via setConsentEngineDeps above.

/**
 * Check if consent check badges are enabled (derived from consent filter state).
 * @returns {boolean}
 */
export function isConsentCheckEnabled() {
  return state.filters.eventTypes.consent !== 'off';
}

/**
 * Get the current consent filter mode.
 * @returns {'auto'|'only'|'hide'|'off'}
 */
export function getConsentFilterMode() {
  return state.filters.eventTypes.consent || 'auto';
}

/**
 * Get the consent timeline for display in event detail.
 * @returns {Array}
 */
export function getConsentTimeline() {
  return state.consentTimeline;
}

/**
 * Get consent state markers for rendering in event stream.
 * @returns {Array} Consent state markers array
 */
export function getConsentStateMarkers() {
  return state.consentStateMarkers;
}

/**
 * Look up the most recent Google Consent Mode timeline entry at or before a
 * given timestamp. Used by the consent insight table to show GCM state
 * alongside CMP state for HTTP request events (which lack googleConsentMode).
 * @param {number} timestamp - Event timestamp
 * @returns {Object|null} { analytics, marketing, functional } or null
 */
export function getGCMCategoriesAtTime(timestamp) {
  for (let i = state.consentTimeline.length - 1; i >= 0; i--) {
    const entry = state.consentTimeline[i];
    if (entry.timestamp <= timestamp && entry.source === 'google-cm' && entry.categories) {
      return entry.categories;
    }
  }
  return null;
}

/**
 * Look up Tealium vendor info for a tag UID (from utag.XXX.js)
 * Returns null if no mapping available yet (Collect hasn't fired)
 * @param {string} tagUid - Tag UID from the utag filename
 * @returns {{ tid: string, vendorCompact: string|null, confidence: string|null, evidence: string|null, platformId: string|null }|null}
 */
// Expose pin helpers to event-list.js so it can render the in-row pushpin.
// `isEventPinnedForCurrentDomain` binds the current domain so call sites
// don't have to thread it through; `togglePinForEvent` hides the same
// detail.
export function isEventPinnedForCurrentDomain(event) {
  const domain = getCurrentPinDomain();
  if (!domain) return false;
  return isEventPinned(event, domain);
}
export function togglePinForEvent(event) {
  return handleTogglePin(event);
}

export function getTealiumVendorInfo(tagUid) {
  return tealiumTagConfig.get(tagUid) || null;
}

/**
 * Ignore an unknown endpoint — hides matching events and silently reports the endpoint.
 * Called from event-detail.js when user clicks "Ignore".
 * @param {Object} event - The unknown event to ignore
 */
export function ignoreEndpoint(event) {
  if (!event.raw?.url) return;

  try {
    const url = new URL(event.raw.url);
    const endpointKey = url.hostname + url.pathname;
    ignoredEndpoints.add(endpointKey);

    // Persist to chrome.storage.local
    chrome.storage.local.set({ ignoredEndpoints: [...ignoredEndpoints] });

    // Silent tracking report so we know which endpoints users are seeing.
    // Intentionally does NOT include the page hostname — the privacy policy
    // promises "No browsing history or URLs", and the endpoint pattern alone
    // is the useful signal. See docs/features/implemented/48-report-tool-ignore-privacy-fix.md
    trackEvent('report_tool_ignore', {
      endpoint: endpointKey,
      method: event.raw?.method || 'unknown',
      event_name: event.eventName || 'none'
    });

    // Re-render to hide the ignored events
    render();
  } catch (e) {
    // URL parsing failed — ignore silently
  }
}

/**
 * Open the tools modal with the add-endpoint form pre-filled.
 * Called from event-detail.js when user clicks "Add endpoint" on an unknown event.
 * @param {{ domain?: string, path?: string }} prefill - Pre-fill data from the event URL
 */
export function openToolsModalForCustomEndpoint(prefill) {
  _openToolsModalForCustomEndpoint(prefill);
}

/**
 * Set or clear a user comment on an event (Feature #50).
 * Session-scoped: lives on the in-memory event object; cleared by clearEvents().
 * Pass an empty string or null/undefined to remove. Returns the previous value
 * so callers can distinguish add vs edit for analytics.
 * @param {string} eventId
 * @param {string|null|undefined} value
 * @returns {string|undefined} previous comment (or undefined if none)
 */
export function setEventComment(eventId, value) {
  const event = state.events.find(e => e.id === eventId)
    || state.consentStateMarkers.find(m => m.id === eventId);
  if (!event) return undefined;

  const previous = event.userComment;
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (trimmed) {
    event.userComment = trimmed;
  } else {
    delete event.userComment;
  }
  render();
  return previous;
}

/**
 * Dismiss a structural fingerprint suggestion for a hostname.
 * Called from event-detail.js when user clicks "Not [platform]".
 * Re-renders to update the event display.
 * @param {string} hostname - The hostname to dismiss
 * @param {string} eventId - The event ID to update
 */
export function dismissFingerprintSuggestion(hostname, eventId) {
  dismissFingerprint(hostname);
  // Find and revert the event to 'other' platform
  const event = state.events.find(e => e.id === eventId);
  if (event && event.formatted?.fingerprint) {
    event.platform = 'other';
    event.platformName = 'Unknown';
    event.formatted._meta = event.formatted._meta || {};
    event.formatted._meta.category = 'unknown';
    event.formatted._meta.isKnownPlatform = false;
    delete event.formatted.fingerprint;
  }
  render();
}
