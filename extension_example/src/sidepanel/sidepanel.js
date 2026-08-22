// Side Panel - Shows detected tracking tools grouped by category

import { KNOWN_TRACKING_ENDPOINTS, PLATFORM_COUNT, PLATFORM_COLORS } from '../panel/tracking-endpoints.js';
import { getPlatformIcon } from '../panel/components/platform-icons.js';
import { MSG } from '../shared/messages.js';
import { initAnalytics, trackEvent, setAnalyticsLocation, setResolvedThemeGetter, setUserId, setSettingsUserProperties, getBrowserName } from '../panel/analytics.js';
import { loadFeatureFlags } from '../panel/feature-flags.js';
import { initTheme, setThemePreference, getThemePreference, getResolvedTheme, onThemeChange } from '../panel/theme.js';
import { loadNudgeState, patchNudgeState, shouldShowNudge, shouldShowVersionBanner, SEVEN_DAYS_MS } from '../shared/nudge-state.js';
import { safeStringify } from '../shared/json-safe.js';

// Detect if running as action popup (vs side panel)
const IS_POPUP = new URLSearchParams(window.location.search).has('popup');

// Detect OS for keyboard shortcuts
const IS_MAC = navigator.platform.toUpperCase().includes('MAC');
const DEVTOOLS_SHORTCUT = IS_MAC ? '⌥⌘I' : 'Ctrl+Shift+I';

// ===== Category definitions with display order =====
const CATEGORY_ORDER = [
  'data-layer',
  'tag-manager',
  'consent',
  'analytics',
  'advertising',
  'ad-tech',
  'cdp',
  'first-party-collection',
  'ab-testing',
  'marketing-automation',
  'session-replay',
  'video',
  'widgets',
  'monitoring',
];

const CATEGORY_META = {
  'data-layer':            { name: 'Data Layer',              icon: 'layers' },
  'tag-manager':           { name: 'Tag Managers',            icon: 'tag' },
  'consent':               { name: 'Consent',                 icon: 'shield' },
  'analytics':             { name: 'Analytics',               icon: 'chart' },
  'advertising':           { name: 'Advertising',             icon: 'megaphone' },
  'ad-tech':               { name: 'Ad Tech',                 icon: 'zap' },
  'cdp':                   { name: 'Customer Data Platforms',  icon: 'database' },
  'first-party-collection':{ name: '1st Party Collection',    icon: 'server' },
  'ab-testing':            { name: 'A/B Testing',             icon: 'split' },
  'marketing-automation':  { name: 'Marketing Automation',    icon: 'mail' },
  'session-replay':        { name: 'Session Replay',          icon: 'video' },
  'video':                 { name: 'Video Analytics',          icon: 'play' },
  'widgets':               { name: 'Widgets',                 icon: 'puzzle' },
  'monitoring':            { name: 'Monitoring',              icon: 'alert' },
};

// Short param suffixes for per-category tracking in sidepanel_page event
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

// Category header icons (simple SVG paths)
const CATEGORY_ICONS = {
  layers:   '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
  tag:      '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
  shield:   '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  chart:    '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  megaphone:'<path d="M3 11l18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  zap:      '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  server:   '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
  split:    '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  mail:     '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  video:    '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
  play:     '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>',
  users:    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  puzzle:   '<path d="M19.439 7.85c-.049 0-.097.01-.145.023A3.5 3.5 0 0 0 16 4.5a3.5 3.5 0 0 0-3.294 3.373c-.048-.013-.096-.023-.145-.023H9v3.561c0 .049.01.097.023.145A3.5 3.5 0 0 0 5.65 15a3.5 3.5 0 0 0 3.373 3.294c-.013.048-.023.096-.023.145V22h3.561c.049 0 .097-.01.145-.023A3.5 3.5 0 0 0 16 25.35"/>',
  alert:    '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
};

// ===== Build platform lookup from KNOWN_TRACKING_ENDPOINTS =====
const endpointMap = new Map();
for (const ep of KNOWN_TRACKING_ENDPOINTS) {
  endpointMap.set(ep.id, ep);
}

// ===== Settings =====
// Theme is intentionally not in DEFAULT_SETTINGS — it lives in the shared
// `themePreference` storage key managed by ../panel/theme.js so DevTools
// and the sidepanel stay in sync.
const DEFAULT_SETTINGS = {
  cardSize: 'default',
  sort: 'category',
  bannerDismissed: false,
  bannerDismissedAt: null,
  debugMode: false,
};

let settings = { ...DEFAULT_SETTINGS };

// Mirrors nudge_devtools_state.hasOpenedDevTools — captured at sidepanel mount
// so the per-tool "Open DevTools…" hint disappears for users who already know
// DevTools exists. Stale by at most one sidepanel open.
let hasOpenedDevTools = false;

async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get('sidepanelSettings');
    if (stored.sidepanelSettings) {
      settings = { ...DEFAULT_SETTINGS, ...stored.sidepanelSettings };
    }
  } catch (e) {
    // Use defaults
  }
}

async function saveSetting(key, value) {
  settings[key] = value;
  try {
    await chrome.storage.local.set({ sidepanelSettings: settings });
  } catch (e) {
    // Silent fail
  }
}

// ===== Capture state (sidepanel only, not popup) =====
// play: recording (default), pause: paused until navigation, stop: fully stopped
let captureState = 'play';

// ===== State =====
let currentPlatforms = []; // Array of { id, count, urls }
let currentTabId = null;
let pollTimer = null;
const collapsedCategories = new Set(); // Track which categories are collapsed
const expandedPlatforms = new Set(); // Track which platform cards are expanded

// ===== DOM refs =====
const toolList = document.getElementById('toolList');
const emptyState = document.getElementById('emptyState');
const summary = document.getElementById('summary');
const searchInput = document.getElementById('searchInput');
const siteDomain = document.getElementById('siteDomain');
const devtoolsBanner = document.getElementById('devtoolsBanner');
const settingsOverlay = document.getElementById('settingsOverlay');
const helpOverlay = document.getElementById('helpOverlay');
const toolsOverlay = document.getElementById('toolsOverlay');
const toolsListBody = document.getElementById('toolsListBody');
const toolsSearch = document.getElementById('toolsSearch');
const toolsViewToggle = document.getElementById('toolsViewToggle');
const reportModalOverlay = document.getElementById('reportModalOverlay');
const reloadHint = document.getElementById('reloadHint');

// ===== Safe parsing helpers =====
// Both wrap throwing browser primitives that run on fully page-influenceable
// input (captured request URLs / arbitrary tab URLs). Without them, one
// malformed value blanks the whole side panel until reload (N2/N7, feature #139).

// decodeURIComponent throws URIError on a malformed percent sequence
// (e.g. "%E0%A4%A" or a lone "%"). These come straight from captured query
// params, so fall back to the raw string rather than letting render() abort.
function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

// new URL(...).hostname throws on an unparseable / missing URL (internal pages,
// undefined tab.url). Returns '' so listeners and renderers degrade gracefully.
function safeHostname(url) {
  if (!url) return '';
  try { return new URL(url).hostname || ''; } catch { return ''; }
}

// ===== Data fetching =====

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    siteDomain.textContent = safeHostname(tab.url);
    return tab.id;
  }
  return null;
}

async function fetchPlatforms() {
  if (!currentTabId) return;
  // Don't fetch when capture is paused or stopped (sidepanel only)
  if (!IS_POPUP && captureState !== 'play') return;

  try {
    const response = await chrome.runtime.sendMessage({
      type: MSG.GET_BADGE_PLATFORMS,
      tabId: currentTabId
    });

    if (response && response.platforms) {
      // Only re-render if data has changed
      if (hasDataChanged(currentPlatforms, response.platforms)) {
        currentPlatforms = response.platforms;
        render();
      } else {
        // Just update the reference without re-rendering
        currentPlatforms = response.platforms;
      }
    }
    if (response && response.stats) {
      lastStats = response.stats;
      updatePerfIndicator(response.stats);
    }
  } catch (e) {
    // Extension context may have been invalidated
  }
}

/**
 * Check if platform data has meaningfully changed (new platforms or count changes).
 * This prevents unnecessary re-renders that cause flickering.
 */
function hasDataChanged(oldPlatforms, newPlatforms) {
  if (oldPlatforms.length !== newPlatforms.length) return true;

  // Create a map for quick lookup
  const oldMap = new Map(oldPlatforms.map(p => [p.id, p.count]));

  for (const newP of newPlatforms) {
    const oldCount = oldMap.get(newP.id);
    if (oldCount === undefined || oldCount !== newP.count) {
      return true;
    }
  }

  return false;
}

// ===== Rendering =====

function getPlatformDisplayName(id) {
  const ep = endpointMap.get(id);
  return ep ? ep.name : id;
}

function getPlatformCategory(id) {
  const ep = endpointMap.get(id);
  return ep ? ep.category : 'unknown';
}

function getPlatformUrl(id) {
  const ep = endpointMap.get(id);
  return ep && ep.url ? ep.url : null;
}

function getPlatformColorHex(id) {
  return PLATFORM_COLORS[id] || '#6c757d';
}

function renderCategoryIcon(iconKey) {
  const path = CATEGORY_ICONS[iconKey] || CATEGORY_ICONS.alert;
  return `<svg class="category-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

function renderPlatformIcon(id) {
  const svg = getPlatformIcon(id);
  if (svg) return svg;
  // Fallback: colored circle
  const color = getPlatformColorHex(id);
  return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="${color}"/></svg>`;
}

function render() {
  const query = searchInput.value.toLowerCase().trim();

  // Filter by search
  let filtered = currentPlatforms;
  if (query) {
    filtered = currentPlatforms.filter(p => {
      const name = getPlatformDisplayName(p.id).toLowerCase();
      return name.includes(query) || p.id.includes(query);
    });
  }

  if (filtered.length === 0 && currentPlatforms.length === 0) {
    toolList.innerHTML = '';
    toolList.style.display = 'none';
    summary.textContent = '';
    emptyState.style.display = '';
    reloadHint.style.display = 'none';
    return;
  }

  emptyState.style.display = 'none';
  toolList.style.display = '';

  // Show reload hint if only dataLayer-type tools detected (no network-based tools)
  // This suggests the sidepanel was opened mid-session and missed network requests
  const dataLayerOnlyIds = new Set([
    'datalayer', 'tealium-datalayer', 'adobe-datalayer',
    'w3c-datalayer', 'commandersact-datalayer', 'relay42-datalayer'
  ]);
  const hasOnlyDataLayer = currentPlatforms.length > 0 &&
    currentPlatforms.every(p => dataLayerOnlyIds.has(p.id));
  reloadHint.style.display = hasOnlyDataLayer ? '' : 'none';

  const totalTools = filtered.length;
  const totalRequests = filtered.reduce((sum, p) => sum + p.count, 0);
  summary.textContent = `${totalTools} tool${totalTools !== 1 ? 's' : ''} detected`;

  if (settings.sort === 'alpha') {
    renderAlphabetical(filtered);
  } else if (settings.sort === 'count') {
    renderByCount(filtered);
  } else {
    renderByCategory(filtered);
  }
}

function renderByCategory(platforms) {
  // Group by category
  const groups = new Map();
  for (const p of platforms) {
    const cat = getPlatformCategory(p.id);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(p);
  }

  // Sort platforms within each group alphabetically
  for (const [, items] of groups) {
    items.sort((a, b) => getPlatformDisplayName(a.id).localeCompare(getPlatformDisplayName(b.id)));
  }

  // Render in category order
  let html = '';
  for (const catId of CATEGORY_ORDER) {
    const items = groups.get(catId);
    if (!items || items.length === 0) continue;

    const meta = CATEGORY_META[catId] || { name: catId, icon: 'alert' };
    html += renderCategorySection(catId, meta, items);
  }

  // Any categories not in CATEGORY_ORDER
  for (const [catId, items] of groups) {
    if (CATEGORY_ORDER.includes(catId)) continue;
    const meta = CATEGORY_META[catId] || { name: catId, icon: 'alert' };
    html += renderCategorySection(catId, meta, items);
  }

  toolList.innerHTML = html;
  attachCategoryListeners();
}

function renderAlphabetical(platforms) {
  const sorted = [...platforms].sort((a, b) =>
    getPlatformDisplayName(a.id).localeCompare(getPlatformDisplayName(b.id))
  );
  toolList.innerHTML = sorted.map(p => renderCard(p)).join('');
  attachPlatformCardListeners();
}

function renderByCount(platforms) {
  const sorted = [...platforms].sort((a, b) => b.count - a.count);
  toolList.innerHTML = sorted.map(p => renderCard(p)).join('');
  attachPlatformCardListeners();
}

function renderCategorySection(catId, meta, items) {
  const isCollapsed = collapsedCategories.has(catId);
  return `
    <div class="category-section${isCollapsed ? ' collapsed' : ''}" data-category="${catId}">
      <div class="category-header" data-category="${catId}">
        ${renderCategoryIcon(meta.icon)}
        <span>${meta.name}</span>
        <span class="category-count">${items.length}</span>
        <svg class="category-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
      <div class="category-items">
        ${items.map(p => renderCard(p)).join('')}
      </div>
    </div>
  `;
}

function renderCard(platform) {
  const name = getPlatformDisplayName(platform.id);
  const color = getPlatformColorHex(platform.id);
  const icon = renderPlatformIcon(platform.id);
  const countText = platform.count > 99 ? '99+' : String(platform.count);
  const isExpanded = expandedPlatforms.has(platform.id);
  const urls = platform.urls || [];
  const eventNames = platform.eventNames || [];
  const networkEvents = platform.networkEvents || [];
  // Card is expandable if it has URLs, event names, or parsed network events
  const hasDetails = urls.length > 0 || eventNames.length > 0 || networkEvents.length > 0;

  // Render details if already expanded (for initial render after data refresh)
  let detailsHtml = '';
  if (isExpanded && hasDetails) {
    detailsHtml = renderPlatformDetails(platform);
  }

  return `
    <div class="platform-card${isExpanded ? ' expanded' : ''}${hasDetails ? ' clickable' : ''}"
         style="border-left-color: ${color};"
         data-platform-id="${platform.id}">
      <div class="platform-card-header">
        <div class="platform-icon" style="color: ${color};">
          ${icon}
        </div>
        <div class="platform-info">
          <div class="platform-name">${escapeHtml(name)}</div>
        </div>
        <span class="platform-count">${countText}</span>
        ${hasDetails ? `<svg class="platform-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>` : ''}
      </div>
      ${detailsHtml}
    </div>
  `;
}

/**
 * Render the expanded details section for a platform.
 * Shows extracted identifiers (Container IDs, Pixel IDs, etc.) grouped by value.
 */
function renderPlatformDetails(platform) {
  const urls = platform.urls || [];
  const eventNames = platform.eventNames || [];
  const networkEvents = platform.networkEvents || [];
  const moreCount = platform.count - Math.max(urls.length, eventNames.length, networkEvents.length);

  // Extract identifiers from URLs (and event names for dataLayer / POST-body platforms)
  const identifiers = extractIdentifiers(platform.id, urls, eventNames, networkEvents);

  const websiteUrl = getPlatformUrl(platform.id);
  const websiteLinkHtml = websiteUrl
    ? `<a href="${escapeHtml(websiteUrl)}" target="_blank" rel="noopener noreferrer" class="platform-website-link" data-tool="${platform.id}" title="Visit ${escapeHtml(getPlatformDisplayName(platform.id))} website"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg><span>Website</span></a>`
    : '';

  // Hide the DevTools hint once the user has discovered DevTools at least
  // once — the reminder is only useful for users who haven't been there yet.
  const renderFooter = (hintText) => {
    const hintHtml = hasOpenedDevTools
      ? ''
      : `<span class="platform-details-hint">${escapeHtml(hintText)}</span>`;
    if (!hintHtml && !websiteLinkHtml) return '';
    return `<div class="platform-details-footer">${hintHtml}${websiteLinkHtml}</div>`;
  };

  if (identifiers.length > 0) {
    // Show identifiers
    const idHtml = identifiers.map(id => {
      // ID + event combo (e.g., GA4 with measurement ID and event)
      if (id.isIdEventCombo) {
        const displayId = truncateIdentifier(id.identifier);
        const titleAttr = displayId !== id.identifier ? ` title="${escapeHtml(id.identifier)}"` : '';
        return `
          <div class="platform-identifier platform-id-event-combo">
            <span class="platform-id-value"${titleAttr}>${escapeHtml(displayId)}</span>
            <span class="platform-event-sep">–</span>
            <span class="platform-event-name">${escapeHtml(id.eventName)}</span>
            ${id.count > 1 ? `<span class="platform-id-count">(${id.count})</span>` : ''}
          </div>
        `;
      }
      // Single event row (for dataLayer platforms)
      if (id.isEvent) {
        return `
          <div class="platform-identifier platform-event-row">
            <span class="platform-event-name">${escapeHtml(id.value)}</span>
            ${id.count > 1 ? `<span class="platform-id-count">(${id.count})</span>` : ''}
          </div>
        `;
      }
      // More indicator
      if (id.isMoreIndicator) {
        return `<div class="platform-details-more">${escapeHtml(id.value)}</div>`;
      }
      // Standard identifier (ID without event)
      return `
        <div class="platform-identifier">
          <span class="platform-id-label">${escapeHtml(id.label)}:</span>
          <span class="platform-id-value">${escapeHtml(id.value)}</span>
          ${id.count > 1 ? `<span class="platform-id-count">(${id.count})</span>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="platform-details">
        ${idHtml}
        ${moreCount > 0 ? `<div class="platform-details-more">+${moreCount} more requests</div>` : ''}
        ${renderFooter(`Open DevTools (${DEVTOOLS_SHORTCUT}) for full event details`)}
      </div>
    `;
  }

  // Fallback: show truncated URLs if no identifiers found
  return `
    <div class="platform-details">
      ${urls.slice(0, 5).map(url => `<div class="platform-url" title="${escapeHtml(url)}">${formatUrl(url)}</div>`).join('')}
      ${urls.length > 5 || moreCount > 0 ? `<div class="platform-details-more">+${Math.max(0, urls.length - 5) + moreCount} more requests</div>` : ''}
      ${renderFooter(`Open DevTools (${DEVTOOLS_SHORTCUT}) for full details`)}
    </div>
  `;
}

// Shorten long opaque identifiers (e.g. Amplitude's 32-char API Key, Mixpanel
// tokens, Segment write keys, Snapchat UUIDs) for display. Amplitude itself
// truncates the key to 10 chars in its own cookie naming, so we match that
// convention. Short/structured IDs (GA4 G-XXXXX, AW-XXXXX, FB pixel IDs at
// 15–16 digits) fall below the threshold and render unchanged. The full value
// stays available via the title attribute for hover lookup.
function truncateIdentifier(value) {
  if (typeof value !== 'string' || value.length <= 16) return value;
  return value.slice(0, 10) + '…';
}

/**
 * Extract meaningful identifiers from URLs for a given platform.
 * For dataLayer platforms, also uses eventNames if provided.
 * For POST-body platforms (e.g., Amplitude), uses networkEvents parsed by the
 * service worker — each entry is { identifier, name, count }.
 * Groups events by their identifier (e.g., Measurement ID for GA4).
 * Returns array of { label, value, count, events } objects.
 */
function extractIdentifiers(platformId, urls, eventNames = null, networkEvents = null) {
  // If the service worker parsed POST-body events, render them as id+event combo rows.
  if (networkEvents && networkEvents.length > 0) {
    const sorted = [...networkEvents].sort((a, b) => b.count - a.count);
    const results = sorted.slice(0, 10).map(ev => (
      ev.identifier
        ? { identifier: ev.identifier, eventName: ev.name, count: ev.count, isIdEventCombo: true }
        : { label: 'Event', value: ev.name, count: ev.count, isEvent: true }
    ));
    if (sorted.length > 10) {
      results.push({ label: '', value: `+${sorted.length - 10} more events`, count: 0, isMoreIndicator: true });
    }
    return results;
  }

  // DataLayer platforms that show event names (not IDs from URLs)
  const dataLayerPlatforms = new Set([
    'datalayer', 'tealium-datalayer',
    'adobe-datalayer', 'w3c-datalayer', 'commandersact-datalayer', 'relay42-datalayer'
  ]);

  // If this is a dataLayer platform with event names, show them as individual event rows
  if (dataLayerPlatforms.has(platformId) && eventNames && eventNames.length > 0) {
    // Sort by count descending and show each event on its own line
    const sorted = [...eventNames].sort((a, b) => b.count - a.count);
    // Limit to top 10 events
    const results = sorted.slice(0, 10).map(e => ({
      label: 'Event',
      value: e.name,
      count: e.count,
      isEvent: true
    }));
    if (sorted.length > 10) {
      results.push({ label: '', value: `+${sorted.length - 10} more events`, count: 0, isMoreIndicator: true });
    }
    return results;
  }

  // Define extractors for identifiers (IDs, keys, etc.)
  const idExtractors = {
    'gtm': { label: 'Container ID', pattern: /[?&]id=(GTM-[A-Z0-9]+)/i },
    'ga4': { label: 'Measurement ID', pattern: /[?&]tid=(G-[A-Z0-9]+)/i },
    'gtag': { label: 'Measurement ID', pattern: /[?&]id=(G-[A-Z0-9]+|AW-[A-Z0-9]+|DC-[A-Z0-9]+)/i },
    'google-ads': { label: 'Conversion ID', pattern: /[?&](?:id|awid)=(AW-[A-Z0-9]+)/i },
    'google-ads-remarketing': { label: 'Conversion ID', pattern: /[?&](?:id|awid)=(AW-[A-Z0-9]+)/i },
    'google-ads-conversion': { label: 'Conversion ID', pattern: /\/pagead\/(?:viewthroughconversion|conversion|1p-conversion)\/(\d+)\// },
    'facebook': { label: 'Pixel ID', pattern: /[?&]id=(\d{10,20})/ },
    'meta-pixel': { label: 'Pixel ID', pattern: /[?&]id=(\d{10,20})/ },
    'linkedin': { label: 'Partner ID', pattern: /[?&]pid=(\d+)/ },
    'linkedin-insight': { label: 'Partner ID', pattern: /[?&]pid=(\d+)/ },
    'tiktok': { label: 'Pixel ID', pattern: /[?&](?:sdkid|pixel_code)=([A-Z0-9]+)/i },
    'snapchat': { label: 'Pixel ID', pattern: /[?&](?:pid|pixel_id)=([a-f0-9-]+)/i },
    'pinterest': { label: 'Tag ID', pattern: /[?&]tid=(\d+)/ },
    'twitter': { label: 'Pixel ID', pattern: /[?&](?:txn_id|pid)=([a-z0-9]+)/i },
    'bing-ads': { label: 'Tag ID', pattern: /[?&]ti=(\d+)/ },
    'microsoft-ads': { label: 'Tag ID', pattern: /[?&]ti=(\d+)/ },
    'adobe-analytics': { label: 'Report Suite', pattern: /\/b\/ss\/([^/]+)\// },
    'adobe-target': { label: 'Client Code', pattern: /[?&]client=([^&]+)/ },
    'adobe-audience-manager': { label: 'Partner ID', pattern: /\/event\?.*d_orgid=([^&]+)/ },
    'adobe-experience-platform': { label: 'Datastream ID', pattern: /[?&]datastreamId=([^&]+)/ },
    'hotjar': { label: 'Site ID', pattern: /[?&](?:sv|id)=(\d+)/ },
    'clarity': { label: 'Project ID', pattern: /[?&](?:i|p)=([a-z0-9]+)/i },
    'amplitude': { label: 'API Key', pattern: /[?&](?:api_key|apiKey)=([a-f0-9]+)/i },
    'mixpanel': { label: 'Project Token', pattern: /[?&](?:token|distinct_id)=([a-f0-9]+)/i },
    'segment': { label: 'Write Key', pattern: /[?&]writeKey=([a-zA-Z0-9]+)/ },
    'heap': { label: 'App ID', pattern: /[?&](?:a|app_id)=(\d+)/ },
    'fullstory': { label: 'Org ID', pattern: /[?&](?:_fs_org|o)=([A-Z0-9]+)/i },
    'tealium': { label: 'Account', pattern: /\/utag\/([^/]+)\/([^/]+)\//, extractor: (m) => `${m[1]}/${m[2]}` },
    'optimizely': { label: 'Project ID', pattern: /[?&](?:projectId|x)=(\d+)/ },
    'vwo': { label: 'Account ID', pattern: /[?&](?:a|account_id)=(\d+)/ },
    'hubspot': { label: 'Portal ID', pattern: /[?&](?:portalId|hutk)=(\d+)/ },
    'intercom': { label: 'App ID', pattern: /[?&]app_id=([a-z0-9]+)/i },
    'drift': { label: 'Embed ID', pattern: /[?&](?:embedId|t)=([a-z0-9]+)/i },
    'adform': { label: 'Tracking ID', pattern: /[?&](?:pm|tid)=(\d+)/ },
    'criteo': { label: 'Account ID', pattern: /[?&](?:a|account)=(\d+)/ },
    'taboola': { label: 'Account ID', pattern: /[?&](?:id|account)=(\d+)/ },
    'outbrain': { label: 'Marketer ID', pattern: /[?&](?:marketerId|ob_click_id)=([a-zA-Z0-9]+)/ },
    'quora': { label: 'Pixel ID', pattern: /[?&](?:id|uid)=([a-f0-9]+)/i },
    'reddit': { label: 'Pixel ID', pattern: /[?&](?:id|aaid)=([a-z0-9]+)/i },
    'appnexus': { label: 'Member ID', pattern: /[?&](?:member|m)=(\d+)/ },
    'tradedoubler': { label: 'Organization ID', pattern: /[?&](?:organization|o)=(\d+)/ },
    'pardot': { label: 'Account ID', pattern: /\/pd\.js\/(\d+)/ },
    'marketo': { label: 'Munchkin ID', pattern: /\/munchkin\.js\?([a-z0-9-]+)/i },
    'eloqua': { label: 'Site ID', pattern: /[?&](?:elqSiteId|site)=(\d+)/ },
    'trustpilot': { label: 'Business Unit', pattern: /[?&](?:businessUnitId|bu)=([a-f0-9]+)/i },
    'cookiebot': { label: 'Domain Group ID', pattern: /[?&](?:cbid)=([a-f0-9-]+)/i },
    'onetrust': { label: 'Domain ID', pattern: /[?&](?:dataDomainScript)=([a-f0-9-]+)/i },
  };

  // Define extractors for event names (where available in URL)
  const eventExtractors = {
    'ga4': { pattern: /[?&]en=([^&]+)/g },
    'gtag': { pattern: /[?&]en=([^&]+)/g },
    'facebook': { pattern: /[?&]ev=([^&]+)/g },
    'meta-pixel': { pattern: /[?&]ev=([^&]+)/g },
    'pinterest': { pattern: /[?&]ed=\{[^}]*"event_name":"([^"]+)"/g },
    'tiktok': { pattern: /[?&]event=([^&]+)/g },
    'snapchat': { pattern: /[?&]ev=([^&]+)/g },
    'bing-ads': { pattern: /[?&]evt=([^&]+)/g },
    'microsoft-ads': { pattern: /[?&]evt=([^&]+)/g },
  };

  const results = [];
  const idExtractor = idExtractors[platformId];
  const eventExtractor = eventExtractors[platformId];

  // For platforms with both ID and event extractors, show each ID+event combo as one row
  if (idExtractor && eventExtractor) {
    // Map: "identifier|eventName" -> count
    const comboCounts = new Map();
    // Map: identifier -> total count (for IDs without events)
    const idOnlyCounts = new Map();

    for (const url of urls) {
      // Extract the identifier from this URL
      const idMatch = url.match(idExtractor.pattern);
      const identifier = idMatch ? (idExtractor.extractor ? idExtractor.extractor(idMatch) : idMatch[1]) : null;
      if (!identifier) continue;

      // Extract events from this URL
      const regex = new RegExp(eventExtractor.pattern.source, 'gi');
      let match;
      let foundEvent = false;
      while ((match = regex.exec(url)) !== null) {
        foundEvent = true;
        const eventName = safeDecode(match[1]);
        const comboKey = `${identifier}|${eventName}`;
        comboCounts.set(comboKey, (comboCounts.get(comboKey) || 0) + 1);
      }
      // Track IDs that had no events (e.g., library loads)
      if (!foundEvent) {
        idOnlyCounts.set(identifier, (idOnlyCounts.get(identifier) || 0) + 1);
      }
    }

    // Build results: each combo as a single row (ID - eventName)
    const sortedCombos = [...comboCounts.entries()].sort((a, b) => b[1] - a[1]);
    sortedCombos.slice(0, 10).forEach(([comboKey, count]) => {
      const [identifier, eventName] = comboKey.split('|');
      results.push({
        identifier: identifier,
        eventName: eventName,
        count: count,
        isIdEventCombo: true
      });
    });
    if (sortedCombos.length > 10) {
      results.push({ label: '', value: `+${sortedCombos.length - 10} more`, count: 0, isMoreIndicator: true });
    }

    // Add identifiers that had no event names extracted (e.g., library loads)
    for (const [identifier, count] of idOnlyCounts) {
      results.push({
        label: idExtractor.label,
        value: identifier,
        count: count
      });
    }

    return results;
  }

  // Extract IDs only (no event extraction for this platform)
  if (idExtractor) {
    const found = new Map();
    for (const url of urls) {
      const match = url.match(idExtractor.pattern);
      if (match) {
        const value = idExtractor.extractor ? idExtractor.extractor(match) : match[1];
        found.set(value, (found.get(value) || 0) + 1);
      }
    }
    for (const [value, count] of found) {
      results.push({ label: idExtractor.label, value, count });
    }
  }

  // Extract event names only (no identifier for this platform)
  if (!idExtractor && eventExtractor) {
    const events = new Map();
    for (const url of urls) {
      const regex = new RegExp(eventExtractor.pattern.source, 'gi');
      let match;
      while ((match = regex.exec(url)) !== null) {
        const eventName = safeDecode(match[1]);
        events.set(eventName, (events.get(eventName) || 0) + 1);
      }
    }
    // Show each event on its own line
    if (events.size > 0) {
      const sortedEvents = [...events.entries()].sort((a, b) => b[1] - a[1]);
      sortedEvents.slice(0, 8).forEach(([name, count]) => {
        results.push({ label: 'Event', value: name, count, isEvent: true });
      });
      if (sortedEvents.length > 8) {
        results.push({ label: '', value: `+${sortedEvents.length - 8} more events`, count: 0, isMoreIndicator: true });
      }
    }
  }

  return results;
}

function formatUrl(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const pathname = urlObj.pathname;

    // Just show hostname + truncated path
    let display = hostname + pathname;
    if (display.length > 60) {
      display = display.slice(0, 57) + '...';
    }
    return escapeHtml(display);
  } catch (e) {
    // If URL parsing fails, just truncate and escape
    const truncated = url.length > 60 ? url.slice(0, 57) + '...' : url;
    return escapeHtml(truncated);
  }
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function attachCategoryListeners() {
  for (const header of toolList.querySelectorAll('.category-header')) {
    header.addEventListener('click', () => {
      const section = header.closest('.category-section');
      const catId = section.dataset.category;
      section.classList.toggle('collapsed');
      // Persist collapsed state so re-renders don't reset it
      if (section.classList.contains('collapsed')) {
        collapsedCategories.add(catId);
      } else {
        collapsedCategories.delete(catId);
      }
    });
  }
  attachPlatformCardListeners();
}

function attachPlatformCardListeners() {
  for (const card of toolList.querySelectorAll('.platform-card.clickable')) {
    card.addEventListener('click', (e) => {
      // Don't trigger if clicking a link (or anything inside a link) inside
      if (e.target.closest('a')) return;

      const platformId = card.dataset.platformId;
      const isExpanding = !expandedPlatforms.has(platformId);

      if (isExpanding) {
        expandedPlatforms.add(platformId);
        card.classList.add('expanded');
        // Find the platform data and render URLs inline
        const platform = currentPlatforms.find(p => p.id === platformId);
        if (platform) {
          const urlsHtml = renderPlatformDetails(platform);
          // Insert after header
          const header = card.querySelector('.platform-card-header');
          if (header && !card.querySelector('.platform-details')) {
            header.insertAdjacentHTML('afterend', urlsHtml);
          }
        }
      } else {
        expandedPlatforms.delete(platformId);
        card.classList.remove('expanded');
        // Remove the details section
        const details = card.querySelector('.platform-details');
        if (details) details.remove();
      }

      if (isExpanding) {
        trackEvent('tool_expand', { action: 'expand', tool: platformId });
      }
    });
  }
}

// ===== Categories & Tools overlay =====

let toolsViewMode = 'grouped'; // 'grouped' or 'list'
const toolsCollapsed = new Set();

function renderToolsOverlay() {
  const query = toolsSearch.value.toLowerCase().trim();

  // Filter endpoints by search
  let filtered = KNOWN_TRACKING_ENDPOINTS;
  if (query) {
    filtered = KNOWN_TRACKING_ENDPOINTS.filter(ep =>
      ep.name.toLowerCase().includes(query) ||
      ep.id.toLowerCase().includes(query) ||
      (ep.category && ep.category.toLowerCase().includes(query))
    );
  }

  // Update count
  document.getElementById('toolsCount').textContent = `${filtered.length} of ${PLATFORM_COUNT} tools`;

  if (filtered.length === 0) {
    toolsListBody.innerHTML = '<div class="tools-empty">No tools found</div>';
    return;
  }

  if (toolsViewMode === 'list') {
    renderToolsAlphabetical(filtered);
  } else {
    renderToolsGrouped(filtered);
  }
}

function renderToolsGrouped(endpoints) {
  // Group by category
  const groups = new Map();
  for (const ep of endpoints) {
    const cat = ep.category || 'other';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(ep);
  }

  // Sort within each group
  for (const [, items] of groups) {
    items.sort((a, b) => a.name.localeCompare(b.name));
  }

  let html = '';
  for (const catId of CATEGORY_ORDER) {
    const items = groups.get(catId);
    if (!items || items.length === 0) continue;
    const meta = CATEGORY_META[catId] || { name: catId, icon: 'alert' };
    html += renderToolsCategorySection(catId, meta.name, items);
  }

  // Categories not in order
  for (const [catId, items] of groups) {
    if (CATEGORY_ORDER.includes(catId)) continue;
    const meta = CATEGORY_META[catId] || { name: catId, icon: 'alert' };
    html += renderToolsCategorySection(catId, meta.name, items);
  }

  toolsListBody.innerHTML = html;
  attachToolsCategoryListeners();
}

function renderToolsAlphabetical(endpoints) {
  const sorted = [...endpoints].sort((a, b) => a.name.localeCompare(b.name));
  toolsListBody.innerHTML = sorted.map(ep => renderToolsItem(ep)).join('');
}

function renderToolsCategorySection(catId, catName, items) {
  const isCollapsed = toolsCollapsed.has(catId);
  return `
    <div class="tools-category-section${isCollapsed ? ' collapsed' : ''}" data-category="${catId}">
      <div class="tools-category-header" data-category="${catId}">
        <svg class="tools-category-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
        <span>${catName}</span>
        <span class="tools-category-count">${items.length}</span>
      </div>
      <div class="tools-category-items">
        ${items.map(ep => renderToolsItem(ep)).join('')}
      </div>
    </div>
  `;
}

function renderToolsItem(ep) {
  const icon = getPlatformIcon(ep.id);
  const color = PLATFORM_COLORS[ep.id] || '#6c757d';
  const iconHtml = icon || `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="${color}"/></svg>`;
  return `
    <div class="tools-item" title="${escapeHtml(ep.name)}">
      <div class="tools-item-icon" style="color: ${color};">${iconHtml}</div>
      <span class="tools-item-name">${escapeHtml(ep.name)}</span>
    </div>
  `;
}

function attachToolsCategoryListeners() {
  for (const header of toolsListBody.querySelectorAll('.tools-category-header')) {
    header.addEventListener('click', () => {
      const section = header.closest('.tools-category-section');
      const catId = section.dataset.category;
      section.classList.toggle('collapsed');
      if (section.classList.contains('collapsed')) {
        toolsCollapsed.add(catId);
      } else {
        toolsCollapsed.delete(catId);
      }
    });
  }
}

// ===== Performance status footer =====

function updatePerfIndicator(stats) {
  const indicator = document.getElementById('perf-indicator');
  const statsEl = document.getElementById('perf-stats');
  if (!indicator || !statsEl) return;

  const ms = Math.round(stats.totalMatchTimeMs);
  const matchedToolsCount = currentPlatforms.length;

  // Format: "23ms · 26/166 requests · 7/240 tools"
  statsEl.textContent = `${ms}ms · ${stats.matchCount}/${stats.requestCount} requests · ${matchedToolsCount}/${stats.totalToolCount} tools`;

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

// ===== Page load tracking (same event as DevTools panel) =====
// Gated so one `sidepanel_page` fires per actual page — not per
// `chrome.tabs.onUpdated { status: 'complete' }` burst, which Chrome can fire
// repeatedly during a single visit (SPA route changes, history.pushState, etc.).
// The flag resets on real navigation (changeInfo.url) and tab activation — see
// the tab-change handlers near the bottom of this file.
let pageLoadTimer = null;
let lastStats = null;
let pageLoadComplete = false;

function resetPageLoadComplete() {
  pageLoadComplete = false;
  clearTimeout(pageLoadTimer);
}

function schedulePageLoadEvent() {
  if (pageLoadComplete) return;
  clearTimeout(pageLoadTimer);
  pageLoadTimer = setTimeout(() => {
    if (!currentPlatforms.length && !lastStats) return;
    pageLoadComplete = true;

    const tools = currentPlatforms.map(p => p.id);
    const categories = [...new Set(tools.map(id => getPlatformCategory(id)))];

    // Build per-category tool arrays (e.g., tools_analytics: ['ga4', 'amplitude'])
    const categoryParams = {};
    for (const [catId, paramSuffix] of Object.entries(CATEGORY_PARAM_NAMES)) {
      const catTools = tools.filter(id => getPlatformCategory(id) === catId);
      if (catTools.length > 0) {
        categoryParams[`tools_${paramSuffix}`] = catTools;
      }
    }

    const matchCount = lastStats?.matchCount || 0;
    const requestCount = lastStats?.requestCount || 0;
    trackEvent('sidepanel_page', {
      sorting: settings.sort === 'alpha' ? 'alphabetic' : settings.sort,
      stat_match_ms: lastStats?.totalMatchTimeMs || 0,
      stat_request_match: matchCount,
      stat_request_total: requestCount,
      stat_tools_match: currentPlatforms.length,
      stat_tools_count: lastStats?.totalToolCount || 0,
      tool: tools,
      category: categories,
      ...categoryParams
    }, {
      userPropertyIncrements: {
        sidepanel_page_count: 1,
        sidepanel_page_request_match: matchCount,
        sidepanel_page_request_total: requestCount,
      }
    });
  }, 2000);
}

// Detect page load completion on the active tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === currentTabId && changeInfo.status === 'complete') {
    schedulePageLoadEvent();
  }
});

// Fire a surface-lifecycle end event when the sidepanel document unloads —
// cross-button close, badge toggle close, browser/tab close, or navigation.
// Uses beacon delivery so the event survives document teardown.
let sidepanelEndFired = false;
function fireSidepanelEnd() {
  if (sidepanelEndFired) return;
  sidepanelEndFired = true;
  trackEvent('sidepanel_end', {}, { beacon: true });
}
window.addEventListener('pagehide', fireSidepanelEnd);

// ===== Event listeners =====

searchInput.addEventListener('input', () => render());
searchInput.addEventListener('blur', () => {
  if (searchInput.value.trim()) {
    trackEvent('search', { context: 'sidepanel' });
  }
});

// Reload hint link
document.getElementById('reloadLink').addEventListener('click', async (e) => {
  e.preventDefault();
  if (currentTabId) {
    await chrome.tabs.reload(currentTabId);
    reloadHint.style.display = 'none';
  }
});

document.getElementById('settingsBtn').addEventListener('click', () => {
  settingsOverlay.style.display = '';
  trackEvent('setting_modal', { action: 'open' });
});

document.getElementById('closeSettings').addEventListener('click', () => {
  settingsOverlay.style.display = 'none';
});

settingsOverlay.addEventListener('click', (e) => {
  if (e.target === settingsOverlay) {
    settingsOverlay.style.display = 'none';
  }
});

document.getElementById('closeBanner').addEventListener('click', () => {
  const variant = devtoolsBanner.getAttribute('data-variant') || 'default';
  devtoolsBanner.style.display = 'none';
  if (variant === 'version') {
    // Dismissing the version banner is per-version — leaves bannerDismissed
    // alone so the underlying DevTools discovery banner can take over again.
    const currentVersion = chrome.runtime.getManifest().version;
    patchNudgeState({ versionBannerDismissedFor: currentVersion }).catch(() => {});
  } else {
    saveSetting('bannerDismissed', true);
    saveSetting('bannerDismissedAt', Date.now());
  }
  trackEvent('devtool_banner', { variant, action: 'dismissed' });
});

document.getElementById('devtoolsBannerAction').addEventListener('click', () => {
  const expanded = devtoolsBanner.classList.toggle('expanded');
  const variant = devtoolsBanner.getAttribute('data-variant') || 'default';
  const action = document.getElementById('devtoolsBannerAction');
  const openLabel = variant === 'nudge' ? 'Show me how' : 'See how';
  action.textContent = expanded ? 'Hide' : openLabel;
  const expansion = document.getElementById('devtoolsBannerExpansion');
  if (expansion) expansion.setAttribute('aria-hidden', expanded ? 'false' : 'true');
  trackEvent('devtool_banner', {
    variant,
    action: expanded ? 'expanded' : 'collapsed',
    ...(expanded ? {
      time_to_expand_seconds: Math.round((Date.now() - (devtoolsBanner._nudgeShownAt || Date.now())) / 1000),
    } : {}),
  });
});

// Help overlay
document.getElementById('helpBtn').addEventListener('click', () => {
  helpOverlay.style.display = '';
  trackEvent('help_modal', { action: 'open' });
});

document.getElementById('closeHelp').addEventListener('click', () => {
  helpOverlay.style.display = 'none';
});

helpOverlay.addEventListener('click', (e) => {
  if (e.target === helpOverlay) {
    helpOverlay.style.display = 'none';
  }
});

// Categories & Tools overlay
document.getElementById('toolsBtn').addEventListener('click', () => {
  toolsOverlay.style.display = '';
  renderToolsOverlay();
  trackEvent('tool_list_modal', { action: 'open' });
});

document.getElementById('closeTools').addEventListener('click', () => {
  toolsOverlay.style.display = 'none';
});

toolsOverlay.addEventListener('click', (e) => {
  if (e.target === toolsOverlay) {
    toolsOverlay.style.display = 'none';
  }
});

toolsSearch.addEventListener('input', () => {
  renderToolsOverlay();
  if (toolsSearch.value.trim()) {
    trackEvent('tool_list_modal', { action: 'search', search_term: toolsSearch.value.trim() });
  }
});

toolsViewToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.view-toggle-btn');
  if (!btn) return;
  const view = btn.dataset.view;
  if (view === toolsViewMode) return;

  toolsViewMode = view;
  for (const b of toolsViewToggle.querySelectorAll('.view-toggle-btn')) {
    b.classList.toggle('active', b.dataset.view === view);
  }
  renderToolsOverlay();
  trackEvent('tool_list_modal', { action: view === 'list' ? 'tool_list' : 'by_category' });
});

// ===== Report/Feedback Modal (multi-purpose) =====

let currentReportType = null;

const REPORT_TITLES = {
  feedback: 'General Feedback',
  feature: 'Feature Request',
  bug: 'Report a Bug',
  tool: 'Missing Tool'
};

const REPORT_ICONS = {
  feedback: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  feature: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/></svg>',
  bug: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3 3 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a6 6 0 0 1 12 0v3c0 3.3-2.7 6-6 6z"/><path d="M12 20v2M6 13H2M6 17H2M22 13h-4M22 17h-4"/></svg>',
  tool: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>'
};

const REPORT_DESCRIPTIONS = {
  feedback: 'Share your thoughts about Event Watcher. We read every piece of feedback.',
  feature: 'Suggest a new feature or improvement. Tell us what would make Event Watcher better for you.',
  bug: 'Found something broken? Describe the issue and we\'ll look into it.',
  tool: 'Can\'t find a tracking tool or endpoint? Let us know and we\'ll look into adding it.'
};

function updateReportModalHeader(type) {
  const iconEl = document.getElementById('sp-report-modal-icon');
  const titleEl = document.getElementById('sp-report-modal-title-text');
  iconEl.innerHTML = REPORT_ICONS[type] || REPORT_ICONS.feedback;
  titleEl.textContent = REPORT_TITLES[type] || 'Send Feedback';
}

function showReportFields(type) {
  // Hide all field groups
  document.querySelectorAll('.sp-report-fields').forEach(el => el.style.display = 'none');
  // Show the selected one
  const fieldsEl = document.getElementById(`sp-report-fields-${type}`);
  if (fieldsEl) fieldsEl.style.display = '';
  // Update description
  const descEl = document.getElementById('sp-report-modal-desc');
  descEl.textContent = REPORT_DESCRIPTIONS[type] || REPORT_DESCRIPTIONS.feedback;
  // Update selector buttons
  document.querySelectorAll('.sp-report-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
}

function selectReportType(type, trackStart = false) {
  currentReportType = type;
  // Hide type cards, show form
  document.getElementById('sp-report-type-cards').style.display = 'none';
  document.getElementById('sp-report-form-container').classList.add('show');
  // Update header
  updateReportModalHeader(type);
  // Show fields for selected type
  showReportFields(type);
  // Pre-fill website for bug/tool
  if (type === 'bug' || type === 'tool') {
    const websiteField = document.getElementById(`sp-report-${type}-website`);
    if (websiteField && siteDomain.textContent) {
      websiteField.value = siteDomain.textContent;
    }
  }
  // Track start event
  if (trackStart) {
    trackEvent('report_start', { report_type: type });
  }
}

function resetReportModal() {
  currentReportType = null;
  // Reset header to default
  updateReportModalHeader('feedback');
  // Show type cards, hide form
  document.getElementById('sp-report-type-cards').style.display = '';
  document.getElementById('sp-report-form-container').classList.remove('show');
  // Reset form
  document.getElementById('sp-report-modal-form').reset();
  // Hide success
  document.getElementById('sp-report-modal-success').classList.remove('show');
}

// Open modal
document.getElementById('reportToolBtn').addEventListener('click', () => {
  resetReportModal();
  reportModalOverlay.style.display = '';
  trackEvent('report_modal', { action: 'open', report_type: null });
});

// Close modal
document.getElementById('closeReportModal').addEventListener('click', () => {
  reportModalOverlay.style.display = 'none';
  trackEvent('report_modal', { action: 'close', report_type: currentReportType });
});

reportModalOverlay.addEventListener('click', (e) => {
  if (e.target === reportModalOverlay) {
    reportModalOverlay.style.display = 'none';
    trackEvent('report_modal', { action: 'close', report_type: currentReportType });
  }
});

// Type card clicks (step 1)
document.querySelectorAll('.sp-report-type-card').forEach(card => {
  card.addEventListener('click', () => {
    selectReportType(card.dataset.type, true);
  });
});

// Type selector bar clicks (step 2)
document.querySelectorAll('.sp-report-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectReportType(btn.dataset.type, true);
  });
});

// Form submit
document.getElementById('sp-report-modal-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentReportType) return;

  const contactName = (document.getElementById('sp-report-contact-name').value || '').trim();
  const contactEmail = (document.getElementById('sp-report-contact-email').value || '').trim();

  let eventName, properties;

  switch (currentReportType) {
    case 'feedback': {
      const subject = (document.getElementById('sp-report-feedback-subject').value || '').trim();
      const comment = (document.getElementById('sp-report-feedback-comment').value || '').trim();
      if (!subject || !comment) return;
      eventName = 'report_submit';
      properties = { report_type: 'feedback', subject, comment };
      break;
    }
    case 'feature': {
      const subject = (document.getElementById('sp-report-feature-subject').value || '').trim();
      const comment = (document.getElementById('sp-report-feature-comment').value || '').trim();
      const whyNeeded = (document.getElementById('sp-report-feature-why').value || '').trim();
      if (!subject || !comment) return;
      eventName = 'report_submit';
      properties = { report_type: 'feature', subject, comment, why_needed: whyNeeded };
      break;
    }
    case 'bug': {
      const subject = (document.getElementById('sp-report-bug-subject').value || '').trim();
      const website = (document.getElementById('sp-report-bug-website').value || '').trim();
      const comment = (document.getElementById('sp-report-bug-comment').value || '').trim();
      if (!subject || !comment) return;
      eventName = 'report_submit';
      properties = { report_type: 'bug', subject, comment, website };
      break;
    }
    case 'tool': {
      const subject = (document.getElementById('sp-report-tool-subject').value || '').trim();
      const category = (document.getElementById('sp-report-tool-category').value || '').trim();
      const website = (document.getElementById('sp-report-tool-website').value || '').trim();
      const endpoint = (document.getElementById('sp-report-tool-endpoint').value || '').trim();
      const comment = (document.getElementById('sp-report-tool-comment').value || '').trim();
      if (!subject) return;
      eventName = 'report_submit';
      properties = { report_type: 'tool', subject, comment, website, endpoint_pattern: endpoint };
      if (category) properties.category = category;
      break;
    }
    default:
      return;
  }

  // Add contact info
  if (contactName) properties.name = contactName;
  if (contactEmail) properties.email = contactEmail;

  // Set Amplitude user ID when email is provided
  if (contactEmail) {
    setUserId(contactEmail);
  }

  trackEvent(eventName, properties);

  // Show success
  document.getElementById('sp-report-modal-form').style.display = 'none';
  document.getElementById('sp-report-modal-success').classList.add('show');

  setTimeout(() => {
    reportModalOverlay.style.display = 'none';
    resetReportModal();
    document.getElementById('sp-report-modal-form').style.display = '';
  }, 2000);
});

document.getElementById('themeSetting').addEventListener('change', async (e) => {
  await setThemePreference(e.target.value);
  trackEvent('setting_change', { setting: 'theme', value: e.target.value });
  setSettingsUserProperties({ setting_theme: e.target.value });
});

document.getElementById('cardSizeSetting').addEventListener('change', (e) => {
  saveSetting('cardSize', e.target.value);
  applyCardSize();
  trackEvent('setting_change', { setting: 'card_size', value: e.target.value });
  setSettingsUserProperties({ setting_card_size: e.target.value });
});

// Sort: settings dropdown (syncs with inline tabs)
document.getElementById('sortSetting').addEventListener('change', (e) => {
  saveSetting('sort', e.target.value);
  updateSortTabs();
  render();
  trackEvent('setting_change', { setting: 'sort', value: e.target.value });
  setSettingsUserProperties({ setting_sort: e.target.value });
});

// Sort: inline tabs (syncs with settings dropdown)
document.getElementById('sortTabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.sort-tab');
  if (!tab) return;
  const sortValue = tab.dataset.sort;
  saveSetting('sort', sortValue);
  document.getElementById('sortSetting').value = sortValue;
  updateSortTabs();
  render();
  trackEvent('setting_change', { setting: 'sort', value: sortValue });
  setSettingsUserProperties({ setting_sort: sortValue });
});

function updateSortTabs() {
  for (const tab of document.querySelectorAll('.sort-tab')) {
    tab.classList.toggle('active', tab.dataset.sort === settings.sort);
  }
}

// View mode: settings dropdown
document.getElementById('viewModeSetting').addEventListener('change', async (e) => {
  const newMode = e.target.value;
  trackEvent('view_switch', { view: newMode });
  await chrome.runtime.sendMessage({ type: MSG.SET_VIEW_MODE, mode: newMode });

  if (IS_POPUP && newMode === 'sidepanel') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
    } catch (e) { /* sidePanel.open may fail if not supported */ }
    window.close();
  } else if (!IS_POPUP && newMode === 'popup') {
    settingsOverlay.style.display = 'none';
  }
});

function applyCardSize() {
  document.getElementById('app').classList.toggle('compact', settings.cardSize === 'compact');
}

function applyDebugMode() {
  const copyBtn = document.getElementById('sp-footer-copy-btn');
  if (copyBtn) {
    copyBtn.style.display = settings.debugMode ? '' : 'none';
  }
}

// Debug mode toggle
document.getElementById('debugModeSetting').addEventListener('change', (e) => {
  saveSetting('debugMode', e.target.checked);
  applyDebugMode();
  trackEvent('setting_change', { setting: 'debug_mode', value: e.target.checked });
  setSettingsUserProperties({ setting_debug_mode: e.target.checked });
});

function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('visible'), duration);
}

// ===== Capture controls (sidepanel only) =====

const captureControls = document.getElementById('captureControls');
const captureBtn = document.getElementById('sp-capture-btn');
const clearBtn = document.getElementById('sp-clear-btn');
const footerCopyBtn = document.getElementById('sp-footer-copy-btn');
const captureStatusBar = document.getElementById('sp-capture-status-bar');
const captureStatusText = document.getElementById('sp-capture-status-text');

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
    'pause': 'Paused \u2013 will resume on navigation',
    'stop': 'Stopped \u2013 click to resume'
  };

  captureState = stateTransitions[captureState];
  captureBtn.dataset.state = captureState;
  captureBtn.title = titles[captureState];
  captureBtn.setAttribute('aria-label', titles[captureState]);
  trackEvent('capture_state', { action: captureState });

  // Update status bar
  captureStatusBar.dataset.state = captureState;
  captureStatusText.textContent = statusMessages[captureState];

  // Resume or pause polling based on state
  if (captureState === 'play') {
    fetchPlatforms();
    startPolling();
  } else {
    stopPolling();
  }
}

/**
 * Resume capture if currently paused (called on navigation)
 */
function resumeCaptureIfPaused() {
  if (captureState === 'pause') {
    captureState = 'play';
    captureBtn.dataset.state = 'play';
    captureBtn.title = 'Capturing events (click to pause)';
    captureBtn.setAttribute('aria-label', 'Capturing events (click to pause)');
    captureStatusBar.dataset.state = 'play';
    captureStatusText.textContent = '';
    fetchPlatforms();
    startPolling();
  }
}

/**
 * Clear all detected tools and badge data for current tab
 */
async function clearDetectedTools() {
  if (!currentTabId) return;
  const toolCount = currentPlatforms.length;
  trackEvent('clear_events', { event_count: toolCount });

  // Clear badge platforms and events in background
  try {
    await chrome.runtime.sendMessage({
      type: MSG.CLEAR_BADGE_PLATFORMS,
      tabId: currentTabId
    });
    await chrome.runtime.sendMessage({
      type: MSG.CLEAR_EVENTS,
      tabId: currentTabId
    });
  } catch (e) {
    // Extension context may have been invalidated
  }

  // Clear local state and re-render
  currentPlatforms = [];
  render();
}

/**
 * Copy detected tools and stats as JSON to clipboard (semi-hidden debug feature)
 * Format aligned with DevTools extended export for easy comparison
 */
async function copyDebugDataToClipboard() {
  // Get category display name from CATEGORY_META
  function getCategoryDisplayName(categoryId) {
    const meta = CATEGORY_META[categoryId];
    return meta ? meta.name : categoryId;
  }

  // Group tools by category for category summary
  const categoryCounts = new Map();
  for (const p of currentPlatforms) {
    const catId = getPlatformCategory(p.id);
    categoryCounts.set(catId, (categoryCounts.get(catId) || 0) + 1);
  }

  // Format aligned with DevTools extended export
  const exportData = {
    // Metadata matching DevTools format
    _format: 'Event Watcher Sidepanel Export',
    _version: '1.2',
    _timestamp: new Date().toISOString(),

    // Summary - sidepanel has limited stats compared to DevTools
    summary: {
      totalMatchTimeMs: Math.round(lastStats?.totalMatchTimeMs || 0),
      requestsTotal: lastStats?.requestCount || 0,
      requestsMatched: lastStats?.matchCount || 0,
      toolsDetected: currentPlatforms.length,
      toolsAvailable: lastStats?.totalToolCount || PLATFORM_COUNT,
      categoriesDetected: categoryCounts.size
    },

    // Tools array with field names matching DevTools detectedTools
    detectedTools: currentPlatforms.map(p => ({
      id: p.id,
      count: p.count,
      category: getPlatformCategory(p.id),
      // Include sample URLs (limited to first 20 for size)
      matchedUrls: (p.urls || []).slice(0, 20).map(url => ({
        url: url.length > 200 ? url.substring(0, 200) + '...' : url
      })),
      // Include event names for dataLayer platforms
      ...(p.eventNames && p.eventNames.length > 0 ? {
        eventNames: p.eventNames
      } : {}),
      // Include parsed POST-body events (e.g., Amplitude)
      ...(p.networkEvents && p.networkEvents.length > 0 ? {
        networkEvents: p.networkEvents
      } : {})
    })).sort((a, b) => b.count - a.count),

    // Categories detected (matching DevTools format)
    categories: [...categoryCounts.keys()].sort(),

    // Note about what's only in DevTools extended export
    _devToolsOnly: [
      'matchingPipeline (totalCalls, cacheHits, cacheHitPct, domainIndexHits, indexHitPct, fullScanFallbacks)',
      'summary.skippedPct (percentage of requests skipped as static assets)',
      'skippedUrls (static assets filtered by extension)',
      'unmatchedUrls (URLs that passed checks but matched no pattern)',
      'viewState (current filter/preset state)'
    ]
  };

  try {
    await navigator.clipboard.writeText(safeStringify(exportData, { space: 2 }));
    // Visual feedback - briefly highlight the button
    footerCopyBtn.classList.add('copied');
    setTimeout(() => footerCopyBtn.classList.remove('copied'), 1500);
    trackEvent('copy_debug', { tools_count: currentPlatforms.length });
  } catch (err) {
    showToast('Failed to copy to clipboard');
  }
}

if (!IS_POPUP) {
  clearBtn.addEventListener('click', clearDetectedTools);
  captureBtn.addEventListener('click', cycleCaptureState);
} else {
  // Hide capture controls in popup mode
  captureControls.style.display = 'none';
  captureStatusBar.style.display = 'none';
}

// Footer copy button - available in both sidepanel and popup
if (footerCopyBtn) {
  footerCopyBtn.addEventListener('click', copyDebugDataToClipboard);
}

// ===== View mode toggle (side panel vs popup) =====

const VIEW_MODE_ICONS = {
  // Shown in sidepanel: click to switch to popup (floating window icon)
  popup: '<rect x="5" y="5" width="14" height="14" rx="1.5"></rect><path d="M5 9h14"></path>',
  // Shown in popup: click to switch to sidepanel (docked sidebar icon)
  sidepanel: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M15 3v18"></path>',
};

const viewModeBtn = document.getElementById('viewModeBtn');

function setupViewModeButton() {
  if (IS_POPUP) {
    viewModeBtn.title = 'Switch to side panel';
    viewModeBtn.querySelector('svg').innerHTML = VIEW_MODE_ICONS.sidepanel;
  } else {
    viewModeBtn.title = 'Switch to popup view';
    viewModeBtn.querySelector('svg').innerHTML = VIEW_MODE_ICONS.popup;
  }
}

viewModeBtn.addEventListener('click', async () => {
  const newMode = IS_POPUP ? 'sidepanel' : 'popup';
  trackEvent('view_switch', { view: newMode });
  await chrome.runtime.sendMessage({ type: MSG.SET_VIEW_MODE, mode: newMode });

  if (IS_POPUP) {
    // Popup has user gesture context — open side panel directly
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
    } catch (e) { /* sidePanel.open may fail if not supported */ }
    window.close();
  }
});

// ===== Tab change handling =====

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  currentTabId = activeInfo.tabId;
  resetPageLoadComplete();
  const tab = await chrome.tabs.get(currentTabId);
  siteDomain.textContent = safeHostname(tab.url);
  fetchPlatforms();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === currentTabId && changeInfo.url) {
    siteDomain.textContent = safeHostname(changeInfo.url);
    resetPageLoadComplete();
    // Resume capture if paused (navigation resumes recording)
    if (!IS_POPUP) {
      resumeCaptureIfPaused();
    }
  }
});

// ===== Polling for updates =====
// The side panel polls the service worker periodically since
// there's no push mechanism from background to side panel.

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(fetchPlatforms, 2000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// Pause polling when panel is not visible
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopPolling();
  } else if (IS_POPUP || captureState === 'play') {
    fetchPlatforms();
    startPolling();
  }
});

// ===== Owl Easter Egg =====

const OWL_ANIMATIONS = [
  'owl-wink',
  'owl-spin',
  'owl-bow',
  'owl-wiggle',
  'owl-bounce',
  'owl-shake',
  'owl-nod',
  'owl-peek',
  'owl-zoom',
  'owl-float',
  'owl-tilt',
  'owl-blink',
  'owl-swing',
  'owl-hop'
];

// Inline SVG icons for tips (matching the icons used in the tool)
const TIP_ICONS = {
  settings: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></span>',
  grid: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg></span>',
  plus: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg></span>',
  pause: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg></span>',
  stop: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></span>',
  search: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></span>',
  devtools: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg></span>',
  help: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg></span>',
  eye: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>',
  layers: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></span>',
  copy: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></span>',
  save: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></span>',
  nesting: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h4M3 12h8M3 18h4M9 6h12M13 12h8M9 18h12"/></svg></span>',
  sort: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5h10M11 9h7M11 13h4"/><path d="M3 17l3 3 3-3M6 18V4"/></svg></span>',
  clear: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></span>',
  feedback: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>'
};

// Tips for Sidepanel/Popup (context-aware)
const OWL_TIPS_SIDEPANEL = [
  `<strong>DevTools</strong> ${TIP_ICONS.devtools} shows full event-by-event details with parsed payloads`,
  `<strong>Search</strong> ${TIP_ICONS.search} to filter tools by name or category`,
  `<strong>Click a card</strong> to see extracted IDs (Measurement ID, Pixel ID, etc.)`,
  `<strong>Sort tabs</strong> let you organize by Category, A-Z, or request count`,
  `<strong>Pause</strong> ${TIP_ICONS.pause} capture to freeze the current state`,
  `<strong>Stop</strong> ${TIP_ICONS.stop} capture to fully halt event collection`,
  `<strong>Clear</strong> ${TIP_ICONS.clear} removes all detected tools for this tab`,
  `<strong>Settings</strong> ${TIP_ICONS.settings} lets you switch themes and card sizes`,
  `<strong>Categories</strong> ${TIP_ICONS.grid} shows all 500+ supported platforms`,
  `<strong>Feedback</strong> ${TIP_ICONS.feedback} lets you report bugs, request features, flag missing tools, or share general thoughts`,
  `<strong>Help</strong> ${TIP_ICONS.help} has guides on getting started and features`,
  `<strong>Data layers</strong> ${TIP_ICONS.settings} can be toggled in Settings (GTM, Adobe, Tealium...)`,
  `<strong>Open DevTools</strong> ${TIP_ICONS.devtools} for the full experience — parsed payloads, consent checks, GTM intercept, script trees, smart search, and much more`
];

// Tips shown when sidepanel is opened from DevTools — highlight key DevTools features
const OWL_TIPS_DEVTOOLS = [
  `<strong>Right-click</strong> a filter → 'Show only' or 'Highlight' for instant focus ${TIP_ICONS.layers}`,
  `<strong>Presets</strong> ${TIP_ICONS.save} save your filter setup for quick switching`,
  `<strong>Smart Search</strong> ${TIP_ICONS.search} understands keywords — try "ga4 purchase", "failed", or "consent"`,
  `<strong>Script view</strong> shows the full load hierarchy — see what loaded each script and what it triggered`,
  `<strong>GTM Hub</strong> gives you container intelligence, intercept controls, and environment preview in one place`,
  `<strong>Consent Check</strong> ${TIP_ICONS.shield} shows consent state for every event — granted, denied, or pre-consent`,
  `<strong>Click the owl</strong> anytime for more tips — there are 40 in the DevTools panel`
];

let lastTipIndex = -1;
let lastAnimationIndex = -1;
let owlTooltip = null;
let owlTooltipHideTimeout = null;
let isHoveringOwl = false;
let isHoveringTooltip = false;

function getRandomTip() {
  // Use sidepanel tips (IS_POPUP is same view mode)
  const tips = OWL_TIPS_SIDEPANEL;

  // Avoid repeating the same tip twice in a row
  let index;
  do {
    index = Math.floor(Math.random() * tips.length);
  } while (index === lastTipIndex && tips.length > 1);
  lastTipIndex = index;
  return tips[index];
}

function getRandomAnimation() {
  // Avoid repeating the same animation twice in a row
  let index;
  do {
    index = Math.floor(Math.random() * OWL_ANIMATIONS.length);
  } while (index === lastAnimationIndex && OWL_ANIMATIONS.length > 1);
  lastAnimationIndex = index;
  return OWL_ANIMATIONS[index];
}

function hideOwlTip() {
  // Only hide if not hovering on owl or tooltip
  if (!isHoveringOwl && !isHoveringTooltip && owlTooltip) {
    owlTooltip.classList.remove('visible');
  }
}

function scheduleHideOwlTip() {
  // Clear any existing timeout
  if (owlTooltipHideTimeout) {
    clearTimeout(owlTooltipHideTimeout);
  }
  // Schedule hide after delay
  owlTooltipHideTimeout = setTimeout(hideOwlTip, 300);
}

function showOwlTip(owlElement, tipHtml) {
  // Clear any pending hide
  if (owlTooltipHideTimeout) {
    clearTimeout(owlTooltipHideTimeout);
    owlTooltipHideTimeout = null;
  }

  // Create tooltip if it doesn't exist
  if (!owlTooltip) {
    owlTooltip = document.createElement('div');
    owlTooltip.className = 'owl-tip-tooltip';
    document.body.appendChild(owlTooltip);

    // Keep tooltip visible while hovering on it
    owlTooltip.addEventListener('mouseenter', () => {
      isHoveringTooltip = true;
      if (owlTooltipHideTimeout) {
        clearTimeout(owlTooltipHideTimeout);
        owlTooltipHideTimeout = null;
      }
    });

    owlTooltip.addEventListener('mouseleave', () => {
      isHoveringTooltip = false;
      scheduleHideOwlTip();
    });
  }

  // Set tip HTML (supports inline icons)
  owlTooltip.innerHTML = tipHtml;

  // Position tooltip below the owl
  const rect = owlElement.getBoundingClientRect();
  owlTooltip.style.left = `${rect.left}px`;
  owlTooltip.style.top = `${rect.bottom + 8}px`;

  // Show tooltip
  owlTooltip.classList.add('visible');
}

// Extract plain text from tip HTML for analytics
function getTipPlainText(tipHtml) {
  const temp = document.createElement('div');
  temp.innerHTML = tipHtml;
  return temp.textContent || temp.innerText || '';
}

function triggerOwlEasterEgg() {
  const owl = document.getElementById('owlLogo');
  if (!owl) return;

  // Remove any existing animation class
  OWL_ANIMATIONS.forEach(anim => owl.classList.remove(anim));

  // Force reflow to restart animation
  void owl.offsetWidth;

  // Get random animation and tip
  const animation = getRandomAnimation();
  const tip = getRandomTip();

  // Apply animation
  owl.classList.add(animation);

  // Show tip
  showOwlTip(owl, tip);

  // Track the easter egg interaction
  trackEvent('owl_click', {
    animation: animation.replace('owl-', ''),
    tip_index: lastTipIndex
  });

  // Remove animation class after it completes
  setTimeout(() => {
    owl.classList.remove(animation);
  }, 700);
}

function setupOwlEasterEgg() {
  const owl = document.getElementById('owlLogo');
  if (owl) {
    owl.addEventListener('click', triggerOwlEasterEgg);

    // Track hover state on owl to keep tooltip visible
    owl.addEventListener('mouseenter', () => {
      isHoveringOwl = true;
      if (owlTooltipHideTimeout) {
        clearTimeout(owlTooltipHideTimeout);
        owlTooltipHideTimeout = null;
      }
    });

    owl.addEventListener('mouseleave', () => {
      isHoveringOwl = false;
      scheduleHideOwlTip();
    });
  }
}

// ===== Init =====

async function init() {
  await loadSettings();
  // Theme is managed by the shared ../panel/theme.js module — same storage
  // key and same code path as the DevTools panel, so the two surfaces stay
  // unified. initTheme() also subscribes to chrome.storage.onChanged so
  // flipping the theme in DevTools updates an open sidepanel live.
  await initTheme();
  applyCardSize();

  // Keep the sidepanel's Theme <select> and the Amplitude `setting_theme`
  // user property in sync when the preference is changed from another
  // surface (e.g. the DevTools header sun/moon) via chrome.storage.
  onThemeChange(({ preference }) => {
    const sel = document.getElementById('themeSetting');
    if (sel && sel.value !== preference) sel.value = preference;
    setSettingsUserProperties({ setting_theme: preference });
  });

  // Reconcile feature flags with chrome.storage.local before analytics
  // starts so the `feature_flags` common property reflects the effective
  // state on the very first event (and the `feature_flags` storage key
  // is seeded with defaults for any user browsing storage). Storage key
  // is `feature_flags` (snake_case).
  await loadFeatureFlags();

  // Initialize analytics
  await initAnalytics();
  setAnalyticsLocation(IS_POPUP ? 'popup' : 'sidepanel');
  setResolvedThemeGetter(getResolvedTheme);

  // Set initial user properties from sidepanel settings
  setSettingsUserProperties({
    setting_theme: getThemePreference(),
    setting_card_size: settings.cardSize,
    setting_sort: settings.sort,
    setting_debug_mode: settings.debugMode,
  });

  // Set up popup mode if loaded as action popup
  if (IS_POPUP) {
    document.documentElement.classList.add('popup-mode');
  }
  setupViewModeButton();
  setupOwlEasterEgg();

  // The banner hint is now a static value-prop teaser (Feature #49). OS-specific
  // DevTools shortcuts live inside the expansion (step 1) via DEVTOOLS_SHORTCUT.
  const stepShortcut = document.getElementById('devtoolsStepShortcut');
  if (stepShortcut) stepShortcut.textContent = DEVTOOLS_SHORTCUT;
  const helpHint = document.getElementById('helpDevtoolsHint');
  if (helpHint) {
    helpHint.innerHTML = `This Side Panel shows a quick overview of detected tracking tools grouped by category. For detailed event-by-event analysis, open DevTools (<kbd>${DEVTOOLS_SHORTCUT}</kbd>) and click the Event Watcher tab.`;
  }

  // Track sidepanel start (fires when sidepanel or popup opens)
  trackEvent('sidepanel_start', {});

  // Apply saved settings to UI controls
  document.getElementById('themeSetting').value = getThemePreference();
  document.getElementById('cardSizeSetting').value = settings.cardSize;
  document.getElementById('sortSetting').value = settings.sort;
  document.getElementById('viewModeSetting').value = IS_POPUP ? 'popup' : 'sidepanel';
  document.getElementById('debugModeSetting').checked = settings.debugMode;
  updateSortTabs();
  applyDebugMode();

  // Banner visibility — three-way decision tree:
  //   1. Version-update banner (soft purple) takes precedence for 7 days
  //      after each update, until the user reaches the Event Watcher
  //      DevTools tab on the new version, or dismisses it.
  //   2. Otherwise, the DevTools discovery banner runs its own logic
  //      (default vs nudge variant; bannerDismissed 7-day cooldown).
  try {
    const nudgeStateBefore = await loadNudgeState();
    const sidepanelOpens = nudgeStateBefore.sidepanelOpens + 1;
    await patchNudgeState({ sidepanelOpens });
    hasOpenedDevTools = nudgeStateBefore.hasOpenedDevTools === true;

    // Seed has_used_devtools for all users (including those who never open
    // DevTools) so the Sidepanel-only cohort is segmentable in Amplitude
    // from day one — critical for the nudge funnel.
    if (!hasOpenedDevTools) {
      setSettingsUserProperties({ has_used_devtools: false });
    }

    // Helper: prepare the screenshot + note for the inline how-to expansion.
    // Used by both the version banner and the DevTools discovery nudge.
    const setExpansionAssets = () => {
      const screenshot = document.getElementById('devtoolsStepScreenshot');
      const stepNote = document.getElementById('devtoolsStepNote');
      if (getBrowserName() === 'Edge') {
        if (screenshot) screenshot.src = '../../assets/devtools-tab-edge.png';
      } else if (stepNote) {
        stepNote.textContent = 'In Chrome, the DevTools tab doesn’t show an icon at all - look for the text “Event Watcher”.';
        stepNote.hidden = false;
      }
    };

    const currentVersion = chrome.runtime.getManifest().version;
    const showVersionBanner = shouldShowVersionBanner(nudgeStateBefore, currentVersion);

    if (showVersionBanner) {
      // First sidepanel open for this version — record the start of the 7-day window.
      const versionPatch = {};
      if (nudgeStateBefore.versionBannerShownFor !== currentVersion) {
        versionPatch.versionBannerShownFor = currentVersion;
        versionPatch.versionBannerFirstShownAt = Date.now();
      }
      if (Object.keys(versionPatch).length) await patchNudgeState(versionPatch);

      devtoolsBanner.setAttribute('data-variant', 'version');
      document.getElementById('devtoolsBannerText').textContent =
        `Event Watcher updated to v${currentVersion}`;
      const hint = document.getElementById('devtoolsBannerHint');
      if (hint) hint.textContent = 'New features are in DevTools';
      const action = document.getElementById('devtoolsBannerAction');
      if (action) action.textContent = 'Show me how';
      setExpansionAssets();

      trackEvent('devtool_banner', {
        variant: 'version',
        action: 'shown',
        version: currentVersion,
      });
    } else {
      // Fall through to the existing DevTools discovery banner.
      const dismissedAt = settings.bannerDismissedAt;
      const cooldownActive = settings.bannerDismissed === true
        && typeof dismissedAt === 'number'
        && (Date.now() - dismissedAt) < SEVEN_DAYS_MS;
      // Users with hasOpenedDevTools never see the banner again once dismissed.
      const permanentlyHidden = settings.bannerDismissed === true && hasOpenedDevTools;

      if (permanentlyHidden || cooldownActive) {
        devtoolsBanner.style.display = 'none';
      } else {
        setExpansionAssets();

        if (shouldShowNudge({ ...nudgeStateBefore, sidepanelOpens })) {
          devtoolsBanner.setAttribute('data-variant', 'nudge');
          document.getElementById('devtoolsBannerText').textContent =
            "Looks like you haven't opened DevTools yet - do you need help getting there?";
          const hint = document.getElementById('devtoolsBannerHint');
          if (hint) hint.textContent = 'DevTools has all the features - live event stream with full details, exports, and much more.';
          const action = document.getElementById('devtoolsBannerAction');
          if (action) action.textContent = 'Show me how';

          const shownAt = Date.now();
          devtoolsBanner._nudgeShownAt = shownAt;
          const shownCount = nudgeStateBefore.nudgeShownCount + 1;
          await patchNudgeState({
            nudgeLastShownAt: shownAt,
            nudgeShownCount: shownCount,
          });
          setSettingsUserProperties({ nudge_shown_count: shownCount });

          trackEvent('devtool_banner', {
            variant: 'nudge',
            action: 'shown',
            show_count: shownCount,
            sidepanel_opens_at_show: sidepanelOpens,
            browser: getBrowserName(),
          });
        }
        // Default variant doesn't fire a `shown` event — the banner renders on
        // every sidepanel mount for non-dismissed users, and `sidepanel_start`
        // already marks sidepanel opens. We only track interactions on default
        // (expanded / collapsed / dismissed) via the click handlers above.
      }
    }
  } catch (_) { /* non-critical — nudge state is best-effort */ }

  // Delegated tracking for vendor website links rendered lazily in expanded cards.
  toolList.addEventListener('click', (e) => {
    const link = e.target.closest('a.platform-website-link[data-tool]');
    if (!link) return;
    trackEvent('link_click', {
      feature: 'sidepanel_tool_card',
      link: link.href,
      tool: link.dataset.tool,
      category: getPlatformCategory(link.dataset.tool)
    });
  });

  currentTabId = await getActiveTabId();
  await fetchPlatforms();
  startPolling();
}

init();
