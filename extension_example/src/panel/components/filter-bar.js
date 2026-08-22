// ============================================================
// Filter Bar Module — extracted from panel.js (Phase 5)
// Handles the unified filter bar UI: category frames, tool chips,
// context menus (platform/category/event type), toolbar collapse,
// tool search, and collapsed category chips.
// ============================================================

import { getPlatformIcon } from './platform-icons.js';
import { getPlatformColor, isPlatformIconVerified, KNOWN_TRACKING_ENDPOINTS } from '../tracking-endpoints.js';
import { isLightColor } from '../color-utils.js';
import { positionContextMenu } from './context-menu-position.js';

let _deps;

/**
 * Initialize the filter bar module with dependencies from panel.js.
 * Must be called after state and elements are defined but before
 * any user interaction or render.
 */
export function initFilterBar(deps) {
  _deps = deps;
}

// ----------------------------------------
// Context menu state
// ----------------------------------------

let contextMenuPlatform = null;
let contextMenuEventId = null;
// When the right-clicked row is part of an active Stream multi-selection
// (>=2 events), this holds the full set of selected ids. Per-event actions
// (Copy JSON) target the bulk in that case. `null` otherwise.
let contextMenuMultiEventIds = null;
let contextMenuCategory = null;
let contextMenuCategoryPlatforms = null;
let contextMenuEventType = null;

// ----------------------------------------
// SVG icons for category toggles
// ----------------------------------------

export const CATEGORY_ICONS = {
  layers: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  tag: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
  server: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
  chart: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>`,
  database: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  play: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  megaphone: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 11-5.8-1.6"/></svg>`,
  zap: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  video: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="14" height="14" rx="2"/><path d="M16 10l6-3v10l-6-3z"/></svg>`,
  mail: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/></svg>`,
  link: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`,
  alert: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  shield: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  split: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>`,
  puzzle: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 01-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 10-3.214 3.214c.446.166.855.497.925.968a.979.979 0 01-.276.837l-1.61 1.61a2.404 2.404 0 01-1.705.707 2.402 2.402 0 01-1.704-.706l-1.568-1.568a1.026 1.026 0 00-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 11-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 00-.289-.877l-1.568-1.568A2.402 2.402 0 011.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 103.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0112 2c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 113.237 3.237c-.464.18-.894.527-.967 1.02z"/></svg>`,
  more: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="12" r="2"/></svg>`
};

// SVG paths only (for Tool View category icons - constructed by event-list.js)
export const CATEGORY_ICONS_PATHS = {
  layers: `<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>`,
  tag: `<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>`,
  server: `<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>`,
  chart: `<path d="M18 20V10M12 20V4M6 20v-6"/>`,
  database: `<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>`,
  play: `<polygon points="5 3 19 12 5 21 5 3"/>`,
  megaphone: `<path d="M3 11l18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 11-5.8-1.6"/>`,
  zap: `<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>`,
  video: `<rect x="2" y="5" width="14" height="14" rx="2"/><path d="M16 10l6-3v10l-6-3z"/>`,
  mail: `<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>`,
  link: `<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>`,
  alert: `<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
  shield: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>`,
  split: `<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>`,
  puzzle: `<path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 01-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 10-3.214 3.214c.446.166.855.497.925.968a.979.979 0 01-.276.837l-1.61 1.61a2.404 2.404 0 01-1.705.707 2.402 2.402 0 01-1.704-.706l-1.568-1.568a1.026 1.026 0 00-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 11-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 00-.289-.877l-1.568-1.568A2.402 2.402 0 011.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.077.877.528 1.073 1.01a2.5 2.5 0 103.259-3.259c-.482-.196-.933-.558-1.01-1.073-.05-.336.062-.676.303-.917l1.525-1.525A2.402 2.402 0 0112 2c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 113.237 3.237c-.464.18-.894.527-.967 1.02z"/>`,
  more: `<circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="12" r="2"/>`
};

// ----------------------------------------
// Filter UI state updates
// ----------------------------------------

// Update Scripts filter UI to reflect current mode
export function updateScriptsFilterUI() {
  const state = _deps.getState();
  const chip = _deps.elements.scriptsFilter;
  if (!chip) return;

  const mode = state.filters.eventTypes.scripts || 'auto';
  chip.classList.remove('mode-auto', 'mode-hide', 'mode-only');
  chip.classList.add(`mode-${mode}`);

  // Update mode label
  if (_deps.elements.scriptsMode) {
    const labels = { auto: 'Auto', only: 'Only', hide: 'Hide' };
    _deps.elements.scriptsMode.textContent = labels[mode];
  }

  // Update tooltip (each describes current state + what next click does)
  const tooltips = {
    auto: 'Scripts: Auto mode (follows tool visibility). Click to show only scripts.',
    only: 'Scripts: Showing only scripts. Click to hide all.',
    hide: 'Scripts: All hidden. Click to auto mode.'
  };
  chip.title = tooltips[mode];
}

// Update Consent filter UI to reflect current mode
export function updateConsentFilterUI() {
  const state = _deps.getState();
  const chip = _deps.elements.consentFilter;
  if (!chip) return;

  const mode = state.filters.eventTypes.consent || 'auto';
  chip.classList.remove('mode-auto', 'mode-off', 'mode-only', 'mode-hide');
  chip.classList.add(`mode-${mode}`);

  // Update mode label
  if (_deps.elements.consentMode) {
    const labels = { auto: 'Auto', only: 'Only', hide: 'Hide', off: 'Off' };
    _deps.elements.consentMode.textContent = labels[mode];
  }

  // Update tooltip (each describes current state + what next click does)
  const tooltips = {
    auto: 'Consent: Auto mode (violations shown). Click to show only consent.',
    only: 'Consent: Showing only consent. Click to hide consent events.',
    hide: 'Consent: Events hidden (violations still tracked). Click to turn off.',
    off: 'Consent: Off (no badges/signals). Click to auto mode.'
  };
  chip.title = tooltips[mode];
}

// Update Interactions filter UI to reflect current mode (2-state: show/hide)
export function updateInteractionsFilterUI() {
  const state = _deps.getState();
  const chip = _deps.elements.interactionsFilter;
  if (!chip) return;

  const showing = state.filters.eventTypes.interactions !== false;
  chip.classList.remove('mode-show', 'mode-hide');
  chip.classList.add(showing ? 'mode-show' : 'mode-hide');

  // Update mode label
  if (_deps.elements.interactionsMode) {
    _deps.elements.interactionsMode.textContent = showing ? 'Show' : 'Hide';
  }

  // Update tooltip
  chip.title = showing
    ? 'Interactions: Showing. Click to hide.'
    : 'Interactions: Hidden. Click to show.';
}

// ----------------------------------------
// Chip and group builders (legacy)
// ----------------------------------------

// Create a filter chip element
function createFilterChip(platform, count, isActive) {
  const state = _deps.getState();
  const chip = document.createElement('div');
  chip.className = `filter-chip${isActive ? ' active' : ''}`;
  chip.dataset.platform = platform;

  // Icon
  const iconEl = document.createElement('span');
  iconEl.className = 'filter-chip-icon';
  iconEl.innerHTML = getPlatformIcon(platform);
  chip.appendChild(iconEl);

  // Label
  const labelEl = document.createElement('span');
  labelEl.className = 'filter-chip-label';
  labelEl.textContent = _deps.PLATFORM_NAMES[platform] || platform;
  chip.appendChild(labelEl);

  // Count (only show if > 0)
  if (count > 0) {
    const countEl = document.createElement('span');
    countEl.className = 'filter-chip-count';
    countEl.textContent = count;
    chip.appendChild(countEl);
  }

  // Click handler to toggle filter
  chip.addEventListener('click', () => {
    const idx = state.filters.platforms.indexOf(platform);
    if (idx >= 0) {
      state.filters.platforms.splice(idx, 1);
      chip.classList.remove('active');
    } else {
      state.filters.platforms.push(platform);
      chip.classList.add('active');
    }
    _deps.render();
  });

  return chip;
}

// Create a category group element with header and chips
function createCategoryGroup(categoryId, categoryName, platforms, showHeader = true) {
  const state = _deps.getState();
  const group = document.createElement('div');
  group.className = 'filter-category-group';
  group.dataset.category = categoryId;

  if (showHeader && platforms.length > 0) {
    const header = document.createElement('div');
    header.className = 'filter-category-header';
    header.textContent = categoryName;
    group.appendChild(header);
  }

  const chipsContainer = document.createElement('div');
  chipsContainer.className = 'filter-chips';

  platforms.forEach(({ platform, count }) => {
    const isFilterActive = state.filters.platforms.includes(platform);
    const chip = createFilterChip(platform, count, isFilterActive);
    chipsContainer.appendChild(chip);
  });

  group.appendChild(chipsContainer);
  return group;
}

// ----------------------------------------
// Main filter bar renderer
// ----------------------------------------

// Render unified filter bar (categories with their detected tools as chips)
export function renderUnifiedFilterBar() {
  const state = _deps.getState();
  // Note: updatePlatformCounts() is called from addEvent() and rebuildDetectedPlatforms(),
  // not here — avoids O(n) full-scan on every render

  // Get the container for category frames (the categories row)
  const categoriesContainer = _deps.elements.filterRowCategories || _deps.elements.categoryToggles;

  // Remove only the category frames, preserve the collapse/expand buttons
  const existingFrames = categoriesContainer.querySelectorAll('.category-frame');
  existingFrames.forEach(frame => frame.remove());

  // Check if any tools have been detected
  const hasDetectedTools = state.detectedPlatforms.size > 0 ||
    Object.values(state.platformCounts).some(count => count > 0);

  // Toggle no-tools state on the categories row
  if (categoriesContainer) {
    categoriesContainer.classList.toggle('no-tools', !hasDetectedTools);
  }

  // For each category that has detected tools, create a frame with tool chips
  Object.entries(_deps.PLATFORM_CATEGORIES).forEach(([categoryId, category]) => {
    // Get platforms in this category that have been detected (have events)
    // Use both platformCounts and detectedPlatforms set for robustness
    const detectedPlatforms = _deps.getPlatformsForCategory(categoryId).filter(
      platform => (state.platformCounts[platform] || 0) > 0 || state.detectedPlatforms.has(platform)
    );

    // Skip categories with no detected tools
    if (detectedPlatforms.length === 0) return;

    // Calculate total events in category
    const categoryEventCount = detectedPlatforms.reduce(
      (sum, p) => sum + (state.platformCounts[p] || 0), 0
    );

    // Check if category is enabled (at least one tool is visible)
    const anyToolVisible = detectedPlatforms.some(platform => {
      if (state.activePresetVisibleTools) {
        return state.activePresetVisibleTools.includes(platform);
      }
      return !state.hiddenTools.includes(platform);
    });
    const isCategoryEnabled = anyToolVisible;

    // Create category frame
    const frame = document.createElement('div');
    frame.className = `category-frame${isCategoryEnabled ? '' : ' disabled'}`;
    frame.dataset.category = categoryId;

    // Category header (icon + name + count) - clickable to toggle entire category
    const header = document.createElement('div');
    header.className = 'category-frame-header';
    header.innerHTML = `
      <span class="category-frame-icon">${CATEGORY_ICONS[category.icon] || CATEGORY_ICONS.more}</span>
      <span class="category-frame-label" data-short="${category.shortName}">${category.name}</span>
      <span class="category-frame-count">${categoryEventCount}</span>
    `;
    header.title = `Click to ${isCategoryEnabled ? 'hide' : 'show'} all ${category.name} events`;
    header.addEventListener('click', (e) => {
      e.stopPropagation();
      _deps.toggleCategory(categoryId);
    });
    // Right-click handler for category context menu
    header.addEventListener('contextmenu', (e) => {
      showCategoryContextMenu(e, categoryId, detectedPlatforms);
    });
    frame.appendChild(header);

    // Tools container
    const toolsContainer = document.createElement('div');
    toolsContainer.className = 'category-frame-tools';

    // Feature #151: the Unknown category renders one chip per distinct endpoint
    // host (capped at 5, with an "Others" overflow) instead of the single generic
    // "other" chip — so each unrecognised service is self-describing.
    const unknownDescriptors = (categoryId === 'unknown' && _deps.getUnknownChipDescriptors)
      ? _deps.getUnknownChipDescriptors()
      : null;

    if (unknownDescriptors && unknownDescriptors.length > 0) {
      const unknownColor = getPlatformColor('other');
      const unknownIcon = getPlatformIcon('other'); // the "?"-in-circle glyph
      // In preset mode (e.g. after "Show only Unknown") the whitelist only knows
      // the generic 'other' master id, so host chips reflect and toggle that
      // master; per-host refinement is a normal-mode feature. In normal mode each
      // chip toggles its own id (the 'other' master can still hide all at once).
      const inPreset = !!state.activePresetVisibleTools;
      const masterVisibleInPreset = inPreset && state.activePresetVisibleTools.includes('other');
      unknownDescriptors.forEach(desc => {
        const isHidden = inPreset
          ? !masterVisibleInPreset
          : (state.hiddenTools.includes('other') || state.hiddenTools.includes(desc.id));

        const chip = document.createElement('div');
        chip.className = `tool-chip unknown-host-chip${isHidden ? ' hidden' : ''}`;
        chip.dataset.platform = desc.id;
        chip.title = `${desc.title} - ${desc.count} event${desc.count !== 1 ? 's' : ''} - Click to ${isHidden ? 'show' : 'hide'}`;

        if (!isHidden) {
          chip.style.setProperty('--tool-color', unknownColor);
          chip.style.borderColor = unknownColor;
        }

        const iconEl = document.createElement('span');
        iconEl.className = 'tool-chip-icon';
        iconEl.innerHTML = unknownIcon;
        chip.appendChild(iconEl);

        const labelEl = document.createElement('span');
        labelEl.className = 'tool-chip-label';
        labelEl.textContent = desc.label;
        chip.appendChild(labelEl);

        const countEl = document.createElement('span');
        countEl.className = 'tool-chip-count';
        countEl.textContent = desc.count;
        chip.appendChild(countEl);

        // In preset mode, clicking toggles the 'other' master (show/hide all
        // unknown); in normal mode it toggles this host's own id.
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleToolVisibility(inPreset ? 'other' : desc.id);
        });
        // Right-click routes to the generic 'other' (the Unknown master) so the
        // context menu's tool lookups + tracking never see a per-host id.
        chip.addEventListener('contextmenu', (e) => {
          showPlatformContextMenu(e, 'other');
        });

        toolsContainer.appendChild(chip);
      });
    } else {

    // Add tool chips (sorted alphabetically by name)
    detectedPlatforms
      .sort((a, b) => (_deps.PLATFORM_NAMES[a] || a).localeCompare(_deps.PLATFORM_NAMES[b] || b))
      .forEach(platform => {
        const count = state.platformCounts[platform];
        // When a preset is active, tool is hidden if NOT in the whitelist
        const isHidden = state.activePresetVisibleTools
          ? !state.activePresetVisibleTools.includes(platform)
          : state.hiddenTools.includes(platform);
        const name = _deps.PLATFORM_NAMES[platform] || platform;
        const color = getPlatformColor(platform);
        const isIconVerified = isPlatformIconVerified(platform);
        const isHighlighted = state.highlightedPlatforms.has(platform);

        // Per-platform consent severity (feature #73) — feeds the optional
        // warning-counter pill rendered after the count badge. Suppressed in
        // two cases: (a) Consent filter mode is 'off' (parity with the session
        // counter, which hides itself in 'off' too); (b) the entire Consent
        // Check feature is off in Settings → Features (`body.consent-check-
        // disabled`), in which case every other consent surface is also gone
        // and the per-tool pill would be the lone holdout.
        const consentMode = state.filters.eventTypes?.consent || 'auto';
        const consentCounts = state.platformConsentCounts?.[platform];
        const consentFeatureEnabled = !document.body.classList.contains('consent-check-disabled');
        const showConsentSeverity = consentFeatureEnabled && consentMode !== 'off' && consentCounts &&
          (consentCounts.denied > 0 || consentCounts.warning > 0);

        // Legacy mode (#72 opt-out): user prefers the v1.2.0 brand-coloured
        // count badge over the v1.3.0 neutral default. When this body class
        // is set, the count badge gets the platform brand colour applied
        // inline and the warning pill is suppressed.
        const isLegacyCountStyle = document.body.classList.contains('tool-count-style-brand');

        const chip = document.createElement('div');
        chip.className = `tool-chip${isHidden ? ' hidden' : ''}${!isIconVerified ? ' unverified-icon' : ''}${isHighlighted ? ' highlighted' : ''}`;
        chip.dataset.platform = platform;

        // Tooltip: base "full name - N events", plus per-platform consent severity
        // counts when the warning pill will render, plus the click hint. The chip
        // label stays shortName (`name`); only the hover tooltip uses the full,
        // formal name (#149) — so hovering "AEP" reveals "Adobe Experience Platform".
        const fullName = _deps.PLATFORM_FULL_NAMES?.[platform] || name;
        let chipTooltip = `${fullName} - ${count} event${count !== 1 ? 's' : ''}`;
        if (showConsentSeverity && !isLegacyCountStyle) {
          const parts = [];
          if (consentCounts.denied > 0) parts.push(`${consentCounts.denied} consent violation${consentCounts.denied === 1 ? '' : 's'}`);
          if (consentCounts.warning > 0) parts.push(`${consentCounts.warning} warning${consentCounts.warning === 1 ? '' : 's'}`);
          if (parts.length) chipTooltip += ` (${parts.join(', ')})`;
        }
        chip.title = `${chipTooltip} - Click to ${isHidden ? 'show' : 'hide'}`;

        // Apply dynamic color via CSS custom property
        if (!isHidden) {
          chip.style.setProperty('--tool-color', color);
          chip.style.borderColor = color;
        }

        // Icon
        const iconEl = document.createElement('span');
        iconEl.className = 'tool-chip-icon';
        iconEl.innerHTML = getPlatformIcon(platform);
        chip.appendChild(iconEl);

        // Label
        const labelEl = document.createElement('span');
        labelEl.className = 'tool-chip-label';
        labelEl.textContent = name;
        chip.appendChild(labelEl);

        // Count badge — neutral grey by default (feature #73). Carries the
        // event total only; severity goes on the separate warning pill below.
        // Legacy mode still paints it in the platform brand colour.
        const countEl = document.createElement('span');
        countEl.className = 'tool-chip-count';
        countEl.textContent = count;
        if (!isHidden && isLegacyCountStyle) {
          countEl.style.backgroundColor = color;
          countEl.style.color = isLightColor(color) ? '#1e293b' : '#ffffff';
        }
        chip.appendChild(countEl);

        // Warning-counter pill (feature #73) — appended only when this
        // platform has at least one denied or warning event AND the consent
        // filter is not OFF. Skipped in legacy mode (#72 opt-out). The digit
        // equals the actual violation count, so number and colour correlate.
        if (showConsentSeverity && !isLegacyCountStyle) {
          const pill = document.createElement('span');
          pill.className = 'tool-chip-warning-count';
          if (consentCounts.denied > 0) {
            pill.classList.add('tool-chip-warning-count--denied');
            pill.textContent = String(consentCounts.denied);
            pill.title = `${consentCounts.denied} consent violation${consentCounts.denied === 1 ? '' : 's'}`;
          } else {
            pill.classList.add('tool-chip-warning-count--warning');
            pill.textContent = String(consentCounts.warning);
            pill.title = `${consentCounts.warning} consent warning${consentCounts.warning === 1 ? '' : 's'}`;
          }
          chip.appendChild(pill);
        }

        // Click handler to toggle tool visibility
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleToolVisibility(platform);
        });

        // Right-click handler for context menu
        chip.addEventListener('contextmenu', (e) => {
          showPlatformContextMenu(e, platform);
        });

        toolsContainer.appendChild(chip);
      });
    } // end generic (non-Unknown / preset-mode) chip rendering

    frame.appendChild(toolsContainer);

    // Create collapsed icons preview (shown only when collapsed)
    const collapsedIconsContainer = document.createElement('div');
    collapsedIconsContainer.className = 'category-collapsed-icons';

    // Sort platforms by event count (descending) - hidden state doesn't affect position
    const sortedByCount = [...detectedPlatforms].sort(
      (a, b) => (state.platformCounts[b] || 0) - (state.platformCounts[a] || 0)
    );
    const top5 = sortedByCount.slice(0, 5);
    const remaining = sortedByCount.length - 5;

    // Helper to create a collapsed icon chip with color and click handler
    const createCollapsedIconChip = (platform) => {
      const isHidden = state.activePresetVisibleTools
        ? !state.activePresetVisibleTools.includes(platform)
        : state.hiddenTools.includes(platform);
      const color = getPlatformColor(platform);
      // #149: the collapsed chip shows only the icon, so its tooltip is the sole
      // way to read the tool — use the full formal name on hover.
      const fullName = _deps.PLATFORM_FULL_NAMES?.[platform] || _deps.PLATFORM_NAMES[platform] || platform;

      const iconChip = document.createElement('span');
      iconChip.className = `collapsed-icon-chip${isHidden ? ' hidden' : ''}`;
      iconChip.innerHTML = getPlatformIcon(platform);
      iconChip.dataset.platform = platform;
      iconChip.title = `${fullName} - Click to ${isHidden ? 'show' : 'hide'}`;

      // Apply color when visible
      if (!isHidden) {
        iconChip.style.color = color;
      }

      // Click handler to toggle visibility
      iconChip.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleToolVisibility(platform);
      });

      // Context menu handler - show same options as full chip, with tool name header
      iconChip.addEventListener('contextmenu', (e) => {
        e.stopPropagation();
        showPlatformContextMenu(e, platform, null, true); // true = show header
      });

      return iconChip;
    };

    // Add icon-only chips for top 5
    top5.forEach(platform => {
      collapsedIconsContainer.appendChild(createCollapsedIconChip(platform));
    });

    // Add "+X" indicator if more than 5 platforms
    if (remaining > 0) {
      const moreIndicator = document.createElement('span');
      moreIndicator.className = 'collapsed-more-indicator';
      moreIndicator.textContent = `+${remaining}`;
      collapsedIconsContainer.appendChild(moreIndicator);

      // Add overflow container for hover expansion
      const overflowContainer = document.createElement('div');
      overflowContainer.className = 'collapsed-overflow-icons';
      sortedByCount.slice(5).forEach(platform => {
        overflowContainer.appendChild(createCollapsedIconChip(platform));
      });
      collapsedIconsContainer.appendChild(overflowContainer);
    }

    frame.appendChild(collapsedIconsContainer);
    categoriesContainer.appendChild(frame);

    // Add collapse button to category frame
    setupCategoryFrameCollapse(frame, categoryId, toolsContainer);
  });

  // Apply tool search filter if active
  applyToolSearchFilter();
}

// ----------------------------------------
// Category frame collapse
// ----------------------------------------

// Add collapse/expand button to category frame
function setupCategoryFrameCollapse(frame, categoryId, toolsContainer) {
  const state = _deps.getState();

  // Remove any existing collapse button first
  const existingBtn = frame.querySelector('.category-frame-collapse-btn');
  if (existingBtn) existingBtn.remove();

  const isCollapsed = state.collapsedCategoryFrames.has(categoryId);

  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'category-frame-collapse-btn';
  collapseBtn.innerHTML = isCollapsed
    ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`
    : `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>`;
  collapseBtn.title = isCollapsed ? 'Expand to show all tools' : 'Collapse category';

  collapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (state.collapsedCategoryFrames.has(categoryId)) {
      state.collapsedCategoryFrames.delete(categoryId);
    } else {
      state.collapsedCategoryFrames.add(categoryId);
    }
    // Persist collapsed category frames to storage
    chrome.storage.local.set({ collapsedCategoryFrames: [...state.collapsedCategoryFrames] });
    // Re-render to update state
    renderUnifiedFilterBar();
  });

  // Insert after header (before tools container)
  const header = frame.querySelector('.category-frame-header');
  if (header && header.nextSibling) {
    frame.insertBefore(collapseBtn, header.nextSibling);
  } else {
    frame.appendChild(collapseBtn);
  }

  // Apply collapsed state
  if (isCollapsed) {
    frame.classList.add('collapsed');
    toolsContainer.classList.add('collapsed');
  } else {
    frame.classList.remove('collapsed');
    toolsContainer.classList.remove('collapsed');
  }
}

// Collapse all categories
export function collapseAllCategories() {
  const state = _deps.getState();
  // Get all category IDs that currently have events
  Object.entries(_deps.PLATFORM_CATEGORIES).forEach(([categoryId]) => {
    const detectedPlatforms = _deps.getPlatformsForCategory(categoryId).filter(
      platform => (state.platformCounts[platform] || 0) > 0
    );
    if (detectedPlatforms.length > 0) {
      state.collapsedCategoryFrames.add(categoryId);
    }
  });

  // Persist and re-render
  chrome.storage.local.set({ collapsedCategoryFrames: [...state.collapsedCategoryFrames] });
  // Save as "last used" for next session
  _deps.saveLastUsed('categoriesCollapsed', true);
  renderUnifiedFilterBar();
}

// Expand all categories
export function expandAllCategories() {
  const state = _deps.getState();
  state.collapsedCategoryFrames.clear();

  // Persist and re-render
  chrome.storage.local.set({ collapsedCategoryFrames: [...state.collapsedCategoryFrames] });
  // Save as "last used" for next session
  _deps.saveLastUsed('categoriesCollapsed', false);
  renderUnifiedFilterBar();
}

// ----------------------------------------
// Tool visibility
// ----------------------------------------

// Toggle individual tool visibility
function toggleToolVisibility(platform) {
  const state = _deps.getState();

  // When a preset is active, modify the whitelist instead of hiddenTools
  if (state.activePresetVisibleTools) {
    const idx = state.activePresetVisibleTools.indexOf(platform);
    if (idx >= 0) {
      // Remove from whitelist (hide tool)
      state.activePresetVisibleTools.splice(idx, 1);
      // Also add to hiddenTools for consistency
      if (!state.hiddenTools.includes(platform)) {
        state.hiddenTools.push(platform);
      }
    } else {
      // Add to whitelist (show tool)
      state.activePresetVisibleTools.push(platform);
      // Also remove from hiddenTools for consistency
      const hiddenIdx = state.hiddenTools.indexOf(platform);
      if (hiddenIdx >= 0) {
        state.hiddenTools.splice(hiddenIdx, 1);
      }
    }
  } else {
    // No preset active - use normal hiddenTools logic
    const idx = state.hiddenTools.indexOf(platform);
    if (idx >= 0) {
      // Remove from hidden list (show events)
      state.hiddenTools.splice(idx, 1);
    } else {
      // Add to hidden list (hide events)
      state.hiddenTools.push(platform);
    }
  }

  // Check if we need to auto-enable the category
  // (when all detected tools in a category are now visible)
  _deps.updateCategoryStateFromTools();

  // Feature #151: Unknown per-host chips carry a synthetic `other:<host>` id.
  // Collapse it to the generic `other` for analytics so we never ship a
  // high-cardinality hostname as a tracked property (analytics-tracking rule).
  const trackedTool = (typeof platform === 'string' && platform.startsWith('other:')) ? 'other' : platform;
  _deps.trackEvent('filter_tool', { action: 'select', tool: trackedTool, category: _deps.getCategoryForPlatform(trackedTool) });

  _deps.render();
  _deps.updateSavePresetButton();
}

// ----------------------------------------
// Platform context menu
// ----------------------------------------

// Show context menu for a platform filter chip or event item
// When called from event items, eventId will be provided; from filter chips, it will be null
// showToolHeader: when true, shows the tool icon and name at the top (for collapsed icons)
export function showPlatformContextMenu(e, platform, eventId = null, showToolHeader = false, multiEventIds = null) {
  const state = _deps.getState();
  e.preventDefault();
  e.stopPropagation();

  // Hide other context menus
  _deps.hidePageContextMenu();
  _deps.hideGroupContextMenu();
  _deps.hideScriptTreeContextMenu();
  if (_deps.hideInteractionContextMenu) _deps.hideInteractionContextMenu();
  if (_deps.hideExportContextMenu) _deps.hideExportContextMenu();

  contextMenuPlatform = platform;
  contextMenuEventId = eventId;
  // Treat as "bulk" only when 2+ ids are passed AND the right-clicked
  // event is one of them (defensive — prevents stale selection state
  // from leaking into a fresh right-click).
  contextMenuMultiEventIds = (Array.isArray(multiEventIds) && multiEventIds.length >= 2 && multiEventIds.includes(eventId))
    ? multiEventIds.slice()
    : null;
  contextMenuCategory = null; // Clear category context
  contextMenuCategoryPlatforms = null;
  const menu = _deps.elements.platformContextMenu;

  // Show/hide tool header (for collapsed icon context menus)
  if (_deps.elements.contextMenuToolHeader) {
    if (showToolHeader) {
      const name = _deps.PLATFORM_NAMES[platform] || platform;
      const color = getPlatformColor(platform);
      _deps.elements.contextMenuToolIcon.innerHTML = getPlatformIcon(platform);
      _deps.elements.contextMenuToolIcon.style.color = color;
      _deps.elements.contextMenuToolName.textContent = name;
      _deps.elements.contextMenuToolHeader.classList.remove('hidden');
    } else {
      _deps.elements.contextMenuToolHeader.classList.add('hidden');
    }
  }

  // Update highlight button state (active if this platform is highlighted)
  const highlightBtn = menu.querySelector('[data-action="highlight"]');
  if (highlightBtn) {
    highlightBtn.classList.toggle('active', state.highlightedPlatforms.has(platform));
  }

  // Show/hide "Clear all highlights" based on whether any highlights exist
  const clearHighlightsBtn = menu.querySelector('[data-action="clear-highlights"]');
  if (clearHighlightsBtn) {
    clearHighlightsBtn.classList.toggle('hidden', state.highlightedPlatforms.size === 0);
  }

  // Show/hide "Hide tool" - show when right-clicking an event OR a collapsed icon (showToolHeader)
  // On regular filter chips, left-click already toggles visibility, so "Hide tool" is redundant
  const hideToolBtn = menu.querySelector('[data-action="hide-tool"]');
  if (hideToolBtn) {
    const isHidden = state.activePresetVisibleTools
      ? !state.activePresetVisibleTools.includes(platform)
      : state.hiddenTools.includes(platform);
    // Show if: from an event (has eventId) OR from collapsed icon (showToolHeader), AND tool is not already hidden
    hideToolBtn.classList.toggle('hidden', isHidden || (!eventId && !showToolHeader));
  }

  // Visibility rules for the copy items:
  //   - Single event (eventId, !isBulk):  show all 5 (Table / Plain / AI Ready / Complete / Consent)
  //   - Multi-select (isBulk):            show 4 (Table / Plain / AI Ready / Complete) — drop Consent (no bulk variant)
  //   - No event row (chip click):        hide all 5
  //   - Compare formats: always visible when at least one copy item is shown
  const isBulk = !!contextMenuMultiEventIds;
  const showAnyCopy = !!eventId || isBulk;
  const copyEventTableBtn = menu.querySelector('[data-action="copy-event-table"]');
  if (copyEventTableBtn) copyEventTableBtn.classList.toggle('hidden', !showAnyCopy);
  const copyEventBtn = menu.querySelector('[data-action="copy-event-json"]');
  if (copyEventBtn) copyEventBtn.classList.toggle('hidden', !showAnyCopy);
  const copyEventPropsBtn = menu.querySelector('[data-action="copy-event-properties"]');
  if (copyEventPropsBtn) copyEventPropsBtn.classList.toggle('hidden', !showAnyCopy);
  const copyEventExtBtn = menu.querySelector('[data-action="copy-event-extended"]');
  if (copyEventExtBtn) copyEventExtBtn.classList.toggle('hidden', !showAnyCopy);
  const copyConsentBtn = menu.querySelector('[data-action="copy-event-consent"]');
  if (copyConsentBtn) copyConsentBtn.classList.toggle('hidden', !eventId || isBulk || !_deps.isConsentCheckEnabled());
  const compareFormatsBtn = menu.querySelector('[data-action="export-formats-help"]');
  if (compareFormatsBtn) compareFormatsBtn.classList.toggle('hidden', !showAnyCopy);

  // Scope header — subtle text at the top of the menu indicating what
  // the actions apply to. Hidden when the tool header is already shown
  // (right-click on a collapsed tool icon already says "Tool: GA4").
  const scopeHeader = document.getElementById('context-menu-scope-header');
  if (scopeHeader) {
    let scopeText = '';
    if (!showToolHeader) {
      if (isBulk) {
        scopeText = `${contextMenuMultiEventIds.length} selected events`;
      } else if (eventId) {
        scopeText = 'Selected event';
      } else if (platform) {
        scopeText = `Tool: ${_deps.PLATFORM_NAMES[platform] || platform}`;
      }
    }
    if (scopeText) {
      scopeHeader.textContent = scopeText;
      scopeHeader.classList.remove('hidden');
    } else {
      scopeHeader.classList.add('hidden');
    }
  }

  // Position the menu using its real rendered height so the full menu is
  // always visible (BUG54). Item show/hide above must happen before this
  // call so the measured height reflects the final menu shape.
  positionContextMenu(menu, e.clientX, e.clientY);
}

// Hide context menu
export function hidePlatformContextMenu() {
  _deps.elements.platformContextMenu.classList.remove('open');
  contextMenuPlatform = null;
  contextMenuEventId = null;
  contextMenuMultiEventIds = null;
  contextMenuCategory = null;
  contextMenuCategoryPlatforms = null;
  contextMenuEventType = null;
}

// Handle context menu actions
export function handleContextMenuAction(action) {
  const state = _deps.getState();

  // Check if this is a category context menu or platform context menu
  const isCategory = contextMenuCategory && contextMenuCategoryPlatforms;

  // Check context type
  const isEventType = contextMenuEventType !== null;
  // Note: no generic "tool_event" wrapper here — the action-specific events
  // fired below (filter_tool, copy_output) already cover every branch.

  switch (action) {
    case 'show-only':
      if (isEventType) {
        showOnlyEventType(contextMenuEventType);
      } else if (isCategory) {
        showOnlyCategory(contextMenuCategoryPlatforms, contextMenuCategory);
      } else if (contextMenuPlatform) {
        showOnlyPlatform(contextMenuPlatform);
      }
      break;
    case 'hide-tool':
      if (contextMenuPlatform) hideToolFromContextMenu(contextMenuPlatform);
      break;
    case 'highlight':
      if (isEventType) {
        toggleHighlightEventType(contextMenuEventType);
      } else if (isCategory) {
        toggleHighlightCategory(contextMenuCategoryPlatforms, contextMenuCategory);
      } else if (contextMenuPlatform) {
        toggleHighlightPlatform(contextMenuPlatform);
      }
      break;
    case 'clear-highlights':
      clearAllHighlights();
      break;
    case 'copy-event-table':
      if (contextMenuMultiEventIds && contextMenuMultiEventIds.length >= 2) {
        _deps.copyEventsAsTable(contextMenuMultiEventIds);
        _deps.trackEvent('copy_output', { scope: 'events_selected', format: 'table', count: contextMenuMultiEventIds.length });
      } else if (contextMenuEventId) {
        _deps.copyEventsAsTable([contextMenuEventId]);
        _deps.trackEvent('copy_output', { scope: 'event', format: 'table' });
      }
      break;
    case 'copy-event-json':
      if (contextMenuMultiEventIds && contextMenuMultiEventIds.length >= 2) {
        _deps.copyEventsAsJSON(contextMenuMultiEventIds);
        _deps.trackEvent('copy_output', { scope: 'events_selected', format: 'basic', count: contextMenuMultiEventIds.length });
      } else if (contextMenuEventId) {
        _deps.copyEventAsJSON(contextMenuEventId);
        _deps.trackEvent('copy_output', { scope: 'event', format: 'basic' });
      }
      break;
    case 'copy-event-properties':
      if (contextMenuMultiEventIds && contextMenuMultiEventIds.length >= 2) {
        _deps.copyEventsAsProperties(contextMenuMultiEventIds);
        _deps.trackEvent('copy_output', { scope: 'events_selected', format: 'ai_ready', count: contextMenuMultiEventIds.length });
      } else if (contextMenuEventId) {
        _deps.copyEventWithProperties(contextMenuEventId);
        _deps.trackEvent('copy_output', { scope: 'event', format: 'ai_ready' });
      }
      break;
    case 'copy-event-extended':
      if (contextMenuMultiEventIds && contextMenuMultiEventIds.length >= 2) {
        _deps.copyEventsAsFullExport(contextMenuMultiEventIds);
        _deps.trackEvent('copy_output', { scope: 'events_selected', format: 'complete', count: contextMenuMultiEventIds.length });
      } else if (contextMenuEventId) {
        _deps.copyEventAsExtended(contextMenuEventId);
        _deps.trackEvent('copy_output', { scope: 'event', format: 'complete' });
      }
      break;
    case 'copy-event-consent':
      if (contextMenuEventId) {
        _deps.copyEventConsent(contextMenuEventId);
        _deps.trackEvent('copy_output', { scope: 'event', format: 'consent' });
      }
      break;
    case 'export-formats-help':
      if (typeof _deps.showExportFormatsHelp === 'function') _deps.showExportFormatsHelp();
      break;
  }

  hidePlatformContextMenu();
}

// ----------------------------------------
// Platform filter actions
// ----------------------------------------

// Show only the specified platform (hide all others, including future detections)
export function showOnlyPlatform(platform) {
  const state = _deps.getState();

  // Whitelist semantics: only `platform` is visible; anything not in the whitelist
  // (including platforms detected later in the session) stays hidden until the user
  // clicks Show All or toggles another chip on. The whitelist branch in
  // getFilteredEvents and toggleToolVisibility already handles late detections.
  state.activePresetVisibleTools = [platform];
  state.hiddenTools = [];

  _deps.trackEvent('filter_tool', { action: 'show_only', tool: platform, category: _deps.getCategoryForPlatform(platform) });

  _deps.updateCategoryStateFromTools();
  _deps.render();
}

// Hide a tool (same as left-clicking a filter chip when visible)
export function hideToolFromContextMenu(platform) {
  const state = _deps.getState();

  if (state.activePresetVisibleTools) {
    // Remove from whitelist
    const idx = state.activePresetVisibleTools.indexOf(platform);
    if (idx >= 0) {
      state.activePresetVisibleTools.splice(idx, 1);
    }
    // Also add to hiddenTools for consistency
    if (!state.hiddenTools.includes(platform)) {
      state.hiddenTools.push(platform);
    }
  } else {
    if (!state.hiddenTools.includes(platform)) {
      state.hiddenTools.push(platform);
    }
  }
  _deps.trackEvent('filter_tool', { action: 'hide', tool: platform, category: _deps.getCategoryForPlatform(platform) });
  _deps.updateCategoryStateFromTools();
  _deps.render();
  _deps.updateSavePresetButton();
}

// Toggle highlight for a platform (supports multiple highlights)
export async function toggleHighlightPlatform(platform) {
  const state = _deps.getState();

  if (state.highlightedPlatforms.has(platform)) {
    // Remove highlight
    state.highlightedPlatforms.delete(platform);
  } else {
    // Add highlight
    state.highlightedPlatforms.add(platform);
  }

  _deps.trackEvent('filter_tool', { action: 'highlight', tool: platform, category: _deps.getCategoryForPlatform(platform) });

  // Save to persistent storage
  await _deps.updateSetting('highlightedPlatforms', [...state.highlightedPlatforms]);
  _deps.render();
}

// Clear all highlighted platforms
export async function clearAllHighlights() {
  const state = _deps.getState();
  state.highlightedPlatforms.clear();
  _deps.trackEvent('filter_tool', { action: 'clear_highlights' });
  // Save to persistent storage
  await _deps.updateSetting('highlightedPlatforms', []);
  _deps.render();
}

// ----------------------------------------
// Category context menu
// ----------------------------------------

// Show context menu for a category header
function showCategoryContextMenu(e, categoryId, detectedPlatforms) {
  const state = _deps.getState();
  e.preventDefault();
  e.stopPropagation();

  contextMenuCategory = categoryId;
  contextMenuCategoryPlatforms = detectedPlatforms;
  contextMenuPlatform = null; // Clear platform context

  const menu = _deps.elements.platformContextMenu;
  const category = _deps.PLATFORM_CATEGORIES[categoryId];

  // Check if all platforms in category are highlighted
  const allHighlighted = detectedPlatforms.length > 0 &&
    detectedPlatforms.every(p => state.highlightedPlatforms.has(p));

  // Update highlight button state and text
  const highlightBtn = menu.querySelector('[data-action="highlight"]');
  if (highlightBtn) {
    highlightBtn.classList.toggle('active', allHighlighted);
  }

  // Show/hide "Clear all highlights" based on whether any highlights exist
  const clearHighlightsBtn = menu.querySelector('[data-action="clear-highlights"]');
  if (clearHighlightsBtn) {
    clearHighlightsBtn.classList.toggle('hidden', state.highlightedPlatforms.size === 0);
  }

  // Hide "Hide tool" for categories (we use Show only instead)
  const hideToolBtn = menu.querySelector('[data-action="hide-tool"]');
  if (hideToolBtn) {
    hideToolBtn.classList.add('hidden');
  }

  // Scope header — "Category: <Name>"
  const scopeHeader = document.getElementById('context-menu-scope-header');
  if (scopeHeader) {
    scopeHeader.textContent = `Category: ${category?.name || categoryId}`;
    scopeHeader.classList.remove('hidden');
  }

  // Hide the tool header (may be left over from a previous platform right-click)
  const toolHeader = document.getElementById('context-menu-tool-header');
  if (toolHeader) {
    toolHeader.classList.add('hidden');
  }

  // Position the menu using its real rendered height (BUG54).
  positionContextMenu(menu, e.clientX, e.clientY);
}

// Show only platforms from the specified category (hide all others, including future detections)
export function showOnlyCategory(categoryPlatforms, categoryId) {
  const state = _deps.getState();

  // Whitelist semantics — see showOnlyPlatform for rationale.
  state.activePresetVisibleTools = [...categoryPlatforms];
  state.hiddenTools = [];

  _deps.trackEvent('filter_category', { action: 'show_only', category: categoryId });

  _deps.updateCategoryStateFromTools();
  _deps.render();
}

// Toggle highlight for all platforms in a category
export async function toggleHighlightCategory(categoryPlatforms, categoryId) {
  const state = _deps.getState();

  // Check if all are currently highlighted
  const allHighlighted = categoryPlatforms.every(p => state.highlightedPlatforms.has(p));

  if (allHighlighted) {
    // Remove highlight from all
    categoryPlatforms.forEach(p => state.highlightedPlatforms.delete(p));
  } else {
    // Add highlight to all
    categoryPlatforms.forEach(p => state.highlightedPlatforms.add(p));
  }

  _deps.trackEvent('filter_category', { action: 'highlight', category: categoryId });

  // Save to persistent storage
  await _deps.updateSetting('highlightedPlatforms', [...state.highlightedPlatforms]);
  _deps.render();
}

// ----------------------------------------
// Event type context menu
// ----------------------------------------

// Get platforms that belong to a specific event type
function getPlatformsForEventType(eventType) {
  const state = _deps.getState();
  // Get all events and filter by event type, then extract unique platforms
  const platforms = new Set();
  state.events.forEach(event => {
    if (_deps.getEventType(event) === eventType) {
      platforms.add(event.platform);
    }
  });
  return Array.from(platforms);
}

// Show context menu for an event type filter (Pages, Tracking, Scripts)
export function showEventTypeContextMenu(e, eventType) {
  const state = _deps.getState();
  e.preventDefault();
  e.stopPropagation();

  contextMenuEventType = eventType;
  contextMenuPlatform = null; // Clear platform context
  contextMenuCategory = null;
  contextMenuCategoryPlatforms = null;

  const menu = _deps.elements.platformContextMenu;
  const eventTypePlatforms = getPlatformsForEventType(eventType);

  // Check if all platforms of this event type are highlighted
  const allHighlighted = eventTypePlatforms.length > 0 &&
    eventTypePlatforms.every(p => state.highlightedPlatforms.has(p));

  // Update highlight button state
  const highlightBtn = menu.querySelector('[data-action="highlight"]');
  if (highlightBtn) {
    highlightBtn.classList.toggle('active', allHighlighted);
  }

  // Show/hide "Clear all highlights" based on whether any highlights exist
  const clearHighlightsBtn = menu.querySelector('[data-action="clear-highlights"]');
  if (clearHighlightsBtn) {
    clearHighlightsBtn.classList.toggle('hidden', state.highlightedPlatforms.size === 0);
  }

  // Hide "Hide tool" for event types (not applicable)
  const hideToolBtn = menu.querySelector('[data-action="hide-tool"]');
  if (hideToolBtn) {
    hideToolBtn.classList.add('hidden');
  }

  // Position the menu using its real rendered height (BUG54).
  positionContextMenu(menu, e.clientX, e.clientY);
}

// Set the chip's own mode to 'only' without touching tool visibility or the other event-type filter
function showOnlyEventType(eventType) {
  const state = _deps.getState();
  if (eventType === 'scripts') {
    state.filters.eventTypes.scripts = 'only';
    updateScriptsFilterUI();
  } else if (eventType === 'consent') {
    state.filters.eventTypes.consent = 'only';
    updateConsentFilterUI();
  }
  _deps.render();
}

// Toggle highlight for all platforms of an event type
async function toggleHighlightEventType(eventType) {
  const state = _deps.getState();
  const eventTypePlatforms = getPlatformsForEventType(eventType);

  // Check if all are currently highlighted
  const allHighlighted = eventTypePlatforms.every(p => state.highlightedPlatforms.has(p));

  if (allHighlighted) {
    // Remove highlight from all
    eventTypePlatforms.forEach(p => state.highlightedPlatforms.delete(p));
  } else {
    // Add highlight to all
    eventTypePlatforms.forEach(p => state.highlightedPlatforms.add(p));
  }

  // Save to persistent storage
  await _deps.updateSetting('highlightedPlatforms', [...state.highlightedPlatforms]);
  _deps.render();
}

// ----------------------------------------
// Toolbar collapse
// ----------------------------------------

export function toggleFilterToolbarCollapsed() {
  const state = _deps.getState();
  state.filterToolbarCollapsed = !state.filterToolbarCollapsed;
  chrome.storage.local.set({ filterToolbarCollapsed: state.filterToolbarCollapsed });
  // Save as "last used" for next session
  _deps.saveLastUsed('filterToolbarCollapsed', state.filterToolbarCollapsed);
  updateFilterToolbarCollapsedState();
  _deps.trackEvent('toolbar_toggle', { action: state.filterToolbarCollapsed ? 'collapse' : 'expand' });
}

// Update filter toolbar collapsed state UI
export function updateFilterToolbarCollapsedState() {
  const state = _deps.getState();
  if (_deps.elements.categoryToolbar) {
    _deps.elements.categoryToolbar.classList.toggle('collapsed', state.filterToolbarCollapsed);
  }
  if (_deps.elements.filterToolbarCollapseBtn) {
    _deps.elements.filterToolbarCollapseBtn.title = state.filterToolbarCollapsed
      ? 'Expand filter toolbar'
      : 'Collapse filter toolbar';
  }
  // Render collapsed chips when collapsing
  if (state.filterToolbarCollapsed) {
    renderCollapsedCategoryChips();
  }
}

// ----------------------------------------
// Tool search
// ----------------------------------------

// Tool Search: Filter detected tools in filter section (does NOT filter events)
// Matches tool name and shortName, case-insensitive
export function applyToolSearchFilter() {
  const state = _deps.getState();
  const query = state.toolSearchQuery.toLowerCase().trim();

  // Get the container for category frames
  const categoriesContainer = _deps.elements.filterRowCategories || _deps.elements.categoryToggles;
  if (!categoriesContainer) return;

  // Get all category frames and tool chips
  const categoryFrames = categoriesContainer.querySelectorAll('.category-frame');

  categoryFrames.forEach(frame => {
    const toolChips = frame.querySelectorAll('.tool-chip');
    let visibleCount = 0;

    toolChips.forEach(chip => {
      const platform = chip.dataset.platform;
      if (!platform) return;

      // Get tool name and shortName for matching (from endpoint data)
      const endpoint = KNOWN_TRACKING_ENDPOINTS.find(e => e.id === platform);
      const name = (endpoint?.name || platform).toLowerCase();
      const shortName = (endpoint?.shortName || _deps.PLATFORM_NAMES[platform] || '').toLowerCase();

      // Check if tool matches search query (name or shortName)
      const matches = !query || name.includes(query) || shortName.includes(query);

      if (matches) {
        chip.classList.remove('search-hidden');
        visibleCount++;
      } else {
        chip.classList.add('search-hidden');
      }
    });

    // Hide category frame if all tools are filtered out
    if (query && visibleCount === 0) {
      frame.classList.add('search-empty');
    } else {
      frame.classList.remove('search-empty');
    }
  });

  // Update clear button visibility
  if (_deps.elements.toolSearchClear) {
    _deps.elements.toolSearchClear.style.opacity = query ? '1' : '0';
  }
}

// Clear tool search and show all tools
export function clearToolSearch() {
  const state = _deps.getState();
  state.toolSearchQuery = '';
  if (_deps.elements.toolSearchInput) {
    _deps.elements.toolSearchInput.value = '';
  }
  applyToolSearchFilter();
}

// Handle tool search input
export function handleToolSearchInput(event) {
  const state = _deps.getState();
  state.toolSearchQuery = event.target.value;
  applyToolSearchFilter();
}

// ----------------------------------------
// Collapsed mode chips
// ----------------------------------------

// Hardcoded SVG icons for collapsed filter chips (no user data)
const COLLAPSED_FILTER_ICONS = {
  scripts: '<svg class="collapsed-filter-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/></svg>',
  consent: '<svg class="collapsed-filter-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  interactions: '<svg class="collapsed-filter-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2l-1 14 4-3 3 7 3-1-3-7 5-1z"/></svg>'
};
const COLLAPSED_FILTER_LABELS = {
  scripts: { auto: 'Auto', only: 'Only', hide: 'Hide' },
  consent: { auto: 'Auto', only: 'Only', off: 'Off' },
  interactions: { show: 'Show', hide: 'Hide' }
};
const COLLAPSED_FILTER_TITLES = {
  scripts: 'Scripts',
  consent: 'Consent',
  interactions: 'Interactions'
};

function createCollapsedFilterChip(type, mode, targetElement, severity) {
  const labels = COLLAPSED_FILTER_LABELS[type];
  const defaultMode = type === 'interactions' ? 'show' : 'auto';
  const currentMode = mode || defaultMode;
  const label = labels[currentMode] || labels[defaultMode];

  const chip = document.createElement('button');
  chip.className = 'collapsed-filter-chip collapsed-filter-' + type + ' mode-' + currentMode;

  // Build chip content: icon + label + optional severity badge
  // innerHTML uses hardcoded SVG literal + escaped label — safe, no user data
  let html = COLLAPSED_FILTER_ICONS[type] + '<span class="collapsed-filter-label">' + label + '</span>';
  if (severity && severity.count > 0) {
    const cls = severity.level === 'denied' ? 'collapsed-severity-denied' : 'collapsed-severity-warning';
    html += '<span class="collapsed-filter-badge ' + cls + '">' + severity.count + '</span>';
  }
  chip.innerHTML = html;

  chip.title = (COLLAPSED_FILTER_TITLES[type] || type) + ': ' + label + '. Click to cycle.';
  chip.addEventListener('click', () => {
    if (targetElement) targetElement.click();
  });
  return chip;
}

// Render collapsed category chips (shown when filter toolbar is collapsed)
// Shows category chips with counts that can be toggled to show/hide entire categories
export function renderCollapsedCategoryChips() {
  const state = _deps.getState();
  if (!_deps.elements.collapsedCategoryChips) return;

  // Ensure counts are up to date (in case called independently)
  if (Object.keys(state.categoryCounts).length === 0 && state.events.length > 0) {
    _deps.updatePlatformCounts();
  }

  // Clear existing chips
  _deps.elements.collapsedCategoryChips.innerHTML = '';

  // Calculate total tracking event count
  const totalTrackingEventCount = state.events.filter(e =>
    !e.isNavigation && e.platform !== 'pages' && !e.isInteraction
  ).length;

  // Add total count badge first (round badge, just the number)
  const totalChip = document.createElement('span');
  totalChip.className = 'collapsed-total-chip';
  totalChip.textContent = totalTrackingEventCount;
  totalChip.title = `${totalTrackingEventCount} total tracking events`;
  _deps.elements.collapsedCategoryChips.appendChild(totalChip);

  // Scripts & Consent mini-chips in their own container (separate from category chips)
  if (_deps.elements.collapsedFilterChips) {
    _deps.elements.collapsedFilterChips.innerHTML = '';
    _deps.elements.collapsedFilterChips.appendChild(
      createCollapsedFilterChip('scripts', state.filters.eventTypes.scripts, _deps.elements.scriptsFilter, null)
    );
    // Pass consent severity so collapsed chip shows warning/denied badge
    const consentSeverity = state.consentSeverity
      ? { level: state.consentSeverity, count: state.consentSeverityCount }
      : null;
    _deps.elements.collapsedFilterChips.appendChild(
      createCollapsedFilterChip('consent', state.filters.eventTypes.consent, _deps.elements.consentFilter, consentSeverity)
    );
    // Interactions is a 2-state boolean (true = show, false = hide) — normalize to a mode string
    const interactionsMode = state.filters.eventTypes.interactions === false ? 'hide' : 'show';
    _deps.elements.collapsedFilterChips.appendChild(
      createCollapsedFilterChip('interactions', interactionsMode, _deps.elements.interactionsFilter, null)
    );
  }

  // Get categories that have detected events, sorted by count (highest first)
  // Use platformCounts AND detectedPlatforms to find categories with events
  const categoriesWithCounts = Object.entries(_deps.PLATFORM_CATEGORIES)
    .map(([categoryId, category]) => {
      // Calculate count from platformCounts for platforms in this category
      const platformsInCategory = _deps.getPlatformsForCategory(categoryId);
      const count = platformsInCategory.reduce((sum, platform) =>
        sum + (state.platformCounts[platform] || 0), 0
      );
      // Also check if any platform in this category has been detected (even if count is 0)
      const hasDetected = platformsInCategory.some(platform => state.detectedPlatforms.has(platform));
      return { categoryId, category, count, hasDetected };
    })
    .filter(c => c.count > 0 || c.hasDetected)
    .sort((a, b) => b.count - a.count);

  // Create a chip for each detected category
  categoriesWithCounts.forEach(({ categoryId, category, count }) => {
    // Check if category is hidden (all tools in category are hidden)
    const platformsInCategory = _deps.getPlatformsForCategory(categoryId).filter(
      platform => (state.platformCounts[platform] || 0) > 0 || state.detectedPlatforms.has(platform)
    );
    const allHidden = platformsInCategory.length > 0 && platformsInCategory.every(platform => {
      if (state.activePresetVisibleTools) {
        return !state.activePresetVisibleTools.includes(platform);
      }
      return state.hiddenTools.includes(platform);
    });

    // Get category icon and abbreviation
    const categoryIcon = CATEGORY_ICONS[category.icon] || CATEGORY_ICONS.more;
    const abbreviation = category.shortName || category.name;

    const chip = document.createElement('button');
    chip.className = `collapsed-category-chip${allHidden ? ' hidden' : ''}`;
    chip.innerHTML = `<span class="category-chip-icon">${categoryIcon}</span><span class="category-chip-name">${abbreviation}</span><span class="category-chip-count">${count}</span>`;
    chip.title = allHidden
      ? `${category.name}: ${count} events (hidden) - click to show`
      : `${category.name}: ${count} events - click to hide`;

    chip.addEventListener('click', () => {
      _deps.toggleCategory(categoryId);
      // Note: render() called by toggleCategory will update collapsed chips
    });

    _deps.elements.collapsedCategoryChips.appendChild(chip);
  });
}

// Update collapsed category chips (called when events change)
export function updateFilterToolbarTotalCount() {
  renderCollapsedCategoryChips();
}
