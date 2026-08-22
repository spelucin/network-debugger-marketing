/**
 * Supported Tools Modal Module
 *
 * Extracted from panel.js (Phase 8) — handles the Categories & Tools modal:
 * open/close, table/grouped views, search, expand/collapse, tool chip copy.
 * Also manages user-defined Custom Endpoints.
 *
 * Dependencies are injected via initToolsModal() to avoid circular imports.
 *
 * @param {Object} deps.elements - DOM element references
 * @param {Function} deps.getState - Returns the panel state object
 * @param {Function} deps.trackEvent - Analytics tracking
 * @param {Function} deps.escapeHtml - HTML escaping utility
 * @param {Function} deps.getCategoryForPlatform - Category lookup for a platform
 * @param {Function} deps.getPlatformIcon - Get SVG icon for a platform
 * @param {Function} deps.getRequiredConsentCategory - Returns consent category for a platform category
 * @param {Array} deps.KNOWN_TRACKING_ENDPOINTS - Platform endpoint data
 * @param {number} deps.PLATFORM_COUNT - Total number of supported platforms
 * @param {Object} deps.PLATFORM_CATEGORIES - Category definitions (without 'unknown')
 * @param {Object} deps.CATEGORY_ICONS - SVG icon strings for category headers
 * @param {Function} deps.getCustomEndpoints - Returns current custom endpoints array
 * @param {Function} deps.loadCustomEndpoints - Reload custom endpoints from storage into cache
 * @param {Function} deps.matchKnownEndpoint - Match URL against known endpoints
 * @param {Function} deps.getDetectedGTMContainers - (unused — forwarded to gtm-modal.js)
 * @param {Function} deps.getCurrentDomain - (unused — forwarded to gtm-modal.js)
 */

import { registerModalCloser, closeOtherModals } from './modal-utils.js';

let _deps;

// ========================================
// Module-level state
// ========================================

let toolsViewMode = 'list';
let toolsSearchQuery = '';
let collapsedCategories;

// ========================================
// Init
// ========================================

export function initToolsModal(deps) {
  _deps = deps;

  const { elements } = _deps;

  registerModalCloser('supported-tools-panel', closeSupportedToolsModal);

  // Initialize collapsedCategories with all categories collapsed
  collapsedCategories = new Set(Object.keys(_deps.PLATFORM_CATEGORIES));

  // Load view preference from chrome.storage.local
  chrome.storage.local.get(['toolsViewMode']).then(result => {
    if (result.toolsViewMode) {
      toolsViewMode = result.toolsViewMode;
    }
  });

  // Supported tools button (toggle open/close)
  if (elements.supportedToolsBtn) {
    elements.supportedToolsBtn.addEventListener('click', () => {
      if (elements.supportedToolsPanel.classList.contains('open')) {
        closeSupportedToolsModal();
      } else {
        openSupportedToolsModal();
      }
    });
  }

  // Close button
  if (elements.supportedToolsClose) {
    elements.supportedToolsClose.addEventListener('click', closeSupportedToolsModal);
  }

  // Close on backdrop click
  elements.supportedToolsPanel?.addEventListener('click', (e) => {
    if (e.target === elements.supportedToolsPanel) {
      closeSupportedToolsModal();
    }
  });

  // View toggle buttons (Tool List / By Category / Custom)
  if (elements.viewToggle) {
    elements.viewToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.view-toggle-btn');
      if (!btn) return;
      const newView = btn.dataset.view;
      if (newView && newView !== toolsViewMode) {
        toolsViewMode = newView;
        chrome.storage.local.set({ toolsViewMode: newView });
        updateViewToggleButtons();
        updateExpandCollapseVisibility();
        updateSearchVisibility();
        renderToolsView();
        const actionMap = { list: 'tool_list', grouped: 'by_category', custom: 'custom' };
        _deps.trackEvent('tool_list_modal', { action: actionMap[newView] || newView });
      }
    });
  }

  // Search input for tools modal
  if (elements.supportedToolsSearch) {
    elements.supportedToolsSearch.addEventListener('input', (e) => {
      toolsSearchQuery = e.target.value;
      renderToolsView();
    });
    // Track search term when user leaves search field
    elements.supportedToolsSearch.addEventListener('blur', () => {
      if (toolsSearchQuery) {
        const state = _deps.getState();
        _deps.trackEvent('tool_list_modal', { action: 'search', search_term: toolsSearchQuery });
      }
    });
  }

  // Expand all button
  if (elements.expandAllBtn) {
    elements.expandAllBtn.addEventListener('click', () => {
      collapsedCategories.clear();
      renderToolsView();
    });
  }

  // Collapse all button
  if (elements.collapseAllBtn) {
    elements.collapseAllBtn.addEventListener('click', () => {
      Object.keys(_deps.PLATFORM_CATEGORIES).forEach(id => collapsedCategories.add(id));
      renderToolsView();
    });
  }
}

// ========================================
// Open / Close
// ========================================

function openSupportedToolsModal(options) {
  const { elements } = _deps;

  closeOtherModals('supported-tools-panel');

  // Clear search input
  toolsSearchQuery = '';
  if (elements.supportedToolsSearch) {
    elements.supportedToolsSearch.value = '';
  }

  // If pre-filling for custom endpoint, switch to Custom tab (don't persist)
  if (options?.prefill) {
    toolsViewMode = 'custom';
  }

  // Update view toggle buttons to reflect current mode
  updateViewToggleButtons();
  // Show/hide expand/collapse buttons based on view mode
  updateExpandCollapseVisibility();
  // Show/hide search bar based on view mode
  updateSearchVisibility();
  // Render the appropriate view
  renderToolsView();
  elements.supportedToolsPanel.classList.add('open');

  // If opening with pre-fill, show the form
  if (options?.prefill) {
    showAddEndpointForm(options.prefill);
  } else if (toolsViewMode !== 'custom') {
    // Focus search input (only when search is visible)
    if (elements.supportedToolsSearch) {
      elements.supportedToolsSearch.focus();
    }
  }
  _deps.trackEvent('tool_list_modal', { action: 'open' });
}

/**
 * Open the tools modal with the add endpoint form pre-filled
 * Called from event-detail.js via panel.js
 * @param {{ domain: string, path: string }} prefill - Pre-fill data
 */
export function openToolsModalForCustomEndpoint(prefill) {
  openSupportedToolsModal({ prefill });
}

export function closeSupportedToolsModal() {
  _deps.elements.supportedToolsPanel.classList.remove('open');
}

/**
 * Open the tools modal to the default (tools list) tab. Used by the extended
 * onboarding tour as a one-shot open hook.
 */
export function openSupportedToolsModalDefault() {
  openSupportedToolsModal();
}

// ========================================
// View Mode Controls
// ========================================

function updateViewToggleButtons() {
  if (!_deps.elements.viewToggle) return;
  _deps.elements.viewToggle.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === toolsViewMode);
  });
}

function updateExpandCollapseVisibility() {
  if (!_deps.elements.expandCollapseBtns) return;
  if (toolsViewMode === 'grouped') {
    _deps.elements.expandCollapseBtns.classList.remove('hidden');
  } else {
    _deps.elements.expandCollapseBtns.classList.add('hidden');
  }
}

function updateSearchVisibility() {
  if (!_deps.elements.supportedToolsSearch) return;
  if (toolsViewMode === 'custom') {
    _deps.elements.supportedToolsSearch.classList.add('hidden');
  } else {
    _deps.elements.supportedToolsSearch.classList.remove('hidden');
  }
}

function renderToolsView() {
  if (toolsViewMode === 'custom') {
    renderCustomEndpointsView();
  } else if (toolsViewMode === 'grouped') {
    renderSupportedToolsGrouped();
  } else {
    renderSupportedToolsTable();
  }
}

// ========================================
// Search & Filtering
// ========================================

function filterEndpointsBySearch(endpoints, query) {
  if (!query) return endpoints;
  const lowerQuery = query.toLowerCase();
  return endpoints.filter(endpoint => {
    // Search in name
    if (endpoint.name.toLowerCase().includes(lowerQuery)) return true;
    // Search in ID
    if (endpoint.id.toLowerCase().includes(lowerQuery)) return true;
    // Search in category
    const categoryId = endpoint.category || 'other';
    const category = _deps.PLATFORM_CATEGORIES[categoryId];
    if (category && category.name.toLowerCase().includes(lowerQuery)) return true;
    if (categoryId.toLowerCase().includes(lowerQuery)) return true;
    // Search in patterns
    if (endpoint.patterns) {
      for (const pattern of endpoint.patterns) {
        const patternStr = typeof pattern === 'string' ? pattern : pattern.toString();
        if (patternStr.toLowerCase().includes(lowerQuery)) return true;
      }
    }
    return false;
  });
}

function updateToolsModalTitle(filteredCount) {
  const totalCount = _deps.PLATFORM_COUNT;
  const searchInput = _deps.elements.supportedToolsSearch;
  if (searchInput) {
    if (toolsSearchQuery && filteredCount !== totalCount) {
      searchInput.placeholder = `${filteredCount} of ${totalCount} tools...`;
    } else {
      searchInput.placeholder = `Search ${totalCount} tools...`;
    }
  }
}

// ========================================
// Tool Chip & Link Handlers
// ========================================

function copyToolName(chipElement, toolName) {
  navigator.clipboard.writeText(toolName).then(() => {
    // Show "Copied!" tooltip using fixed positioning
    const tooltip = document.createElement('span');
    tooltip.className = 'copied-tooltip';
    tooltip.textContent = 'Copied!';
    document.body.appendChild(tooltip);

    // Position above the chip
    const rect = chipElement.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
    tooltip.style.top = `${rect.top - tooltip.offsetHeight - 4}px`;

    // Remove tooltip after animation
    setTimeout(() => {
      tooltip.remove();
    }, 1200);
  }).catch(() => {
    // copy failed silently
  });
}

function addToolChipClickHandlers() {
  _deps.elements.supportedToolsBody.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const label = chip.querySelector('.filter-chip-label');
      if (label) {
        copyToolName(chip, label.textContent);
      }
    });
  });
}

function addVendorLinkClickHandlers() {
  const state = _deps.getState();
  _deps.elements.supportedToolsBody.querySelectorAll('a.vendor-link[data-tool]').forEach(link => {
    link.addEventListener('click', () => {
      _deps.trackEvent('link_click', { feature: 'tools_modal', link: link.href, tool: link.dataset.tool, category: _deps.getCategoryForPlatform(link.dataset.tool) });
    });
  });
}

// ========================================
// Table View (alphabetical list)
// ========================================

function renderSupportedToolsTable() {
  const { elements, escapeHtml, getPlatformIcon, KNOWN_TRACKING_ENDPOINTS, PLATFORM_CATEGORIES, CATEGORY_ICONS } = _deps;

  // Get all endpoints and sort alphabetically by name
  let endpoints = [...KNOWN_TRACKING_ENDPOINTS].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  // Filter by search query
  endpoints = filterEndpointsBySearch(endpoints, toolsSearchQuery);

  // Build table HTML
  let html = `
    <table class="supported-tools-table">
      <thead>
        <tr>
          <th>Tool</th>
          <th>Category</th>
          <th>Detection Patterns</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const endpoint of endpoints) {
    // Get category info
    const categoryId = endpoint.category || 'other';
    const category = PLATFORM_CATEGORIES[categoryId] || PLATFORM_CATEGORIES['unknown'];
    const categoryName = category?.name || categoryId;
    const categoryIcon = CATEGORY_ICONS[category?.icon] || CATEGORY_ICONS.more;

    // Get platform icon
    const platformIcon = getPlatformIcon(endpoint.id);
    const platformName = endpoint.name;

    // Build all detection patterns
    let patternsHtml = '';
    if (endpoint.patterns && endpoint.patterns.length > 0) {
      for (const pattern of endpoint.patterns) {
        let patternStr = '';
        if (typeof pattern === 'string') {
          patternStr = pattern;
        } else if (pattern instanceof RegExp) {
          patternStr = pattern.toString();
        }
        patternsHtml += `<span class="pattern">${escapeHtml(patternStr)}</span>`;
      }
    }

    // Description and vendor link
    const description = endpoint.description || '';
    const vendorUrl = endpoint.url || '';

    // Build description with optional link
    let descriptionHtml = escapeHtml(description);
    if (vendorUrl) {
      descriptionHtml += ` <a href="${escapeHtml(vendorUrl)}" target="_blank" rel="noopener noreferrer" class="vendor-link" data-tool="${endpoint.id}" title="Visit vendor website"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>`;
    }

    // Consent category badge — per-platform override takes precedence over category default
    const consentCategory = endpoint.consentCategory || _deps.getRequiredConsentCategory(categoryId);
    const consentBadgeHtml = consentCategory
      ? `<span class="consent-category-badge"><svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>${escapeHtml(consentCategory.charAt(0).toUpperCase() + consentCategory.slice(1))}</span>`
      : '';

    html += `
      <tr>
        <td class="tool-name-cell">
          <span class="filter-chip active" data-platform="${endpoint.id}">
            <span class="filter-chip-icon">${platformIcon}</span>
            <span class="filter-chip-label">${escapeHtml(platformName)}</span>
          </span>
        </td>
        <td class="tool-category">
          <span class="category-badge">${categoryIcon} ${escapeHtml(categoryName)}</span>
        </td>
        <td class="tool-detection">${patternsHtml}</td>
        <td class="tool-description">${descriptionHtml}${consentBadgeHtml}</td>
      </tr>
    `;
  }

  html += `
      </tbody>
    </table>
  `;

  elements.supportedToolsBody.innerHTML = html;
  addToolChipClickHandlers();
  addVendorLinkClickHandlers();
  updateToolsModalTitle(endpoints.length);
}

// ========================================
// Grouped View (by category)
// ========================================

function renderSupportedToolsGrouped() {
  const { elements, escapeHtml, getPlatformIcon, KNOWN_TRACKING_ENDPOINTS, PLATFORM_CATEGORIES, CATEGORY_ICONS } = _deps;

  // Filter endpoints by search query first
  const filteredEndpoints = filterEndpointsBySearch([...KNOWN_TRACKING_ENDPOINTS], toolsSearchQuery);

  // Group filtered endpoints by category
  const groupedEndpoints = {};
  for (const endpoint of filteredEndpoints) {
    const categoryId = endpoint.category || 'other';
    if (!groupedEndpoints[categoryId]) {
      groupedEndpoints[categoryId] = [];
    }
    groupedEndpoints[categoryId].push(endpoint);
  }

  // Sort endpoints within each category alphabetically
  for (const categoryId of Object.keys(groupedEndpoints)) {
    groupedEndpoints[categoryId].sort((a, b) => a.name.localeCompare(b.name));
  }

  // Build grouped HTML
  let html = '<div class="category-grouped-view">';

  // Iterate categories in defined order
  for (const [categoryId, category] of Object.entries(PLATFORM_CATEGORIES)) {
    const endpoints = groupedEndpoints[categoryId];
    if (!endpoints || endpoints.length === 0) continue;

    // When searching, expand categories that have results
    const isExpanded = toolsSearchQuery ? true : !collapsedCategories.has(categoryId);
    const categoryIcon = CATEGORY_ICONS[category.icon] || CATEGORY_ICONS.more;

    // Build category description if available
    const categoryDescHtml = category.description
      ? `<div class="category-group-description">${escapeHtml(category.description)}</div>`
      : '';

    // Consent category badges for this group — collect all distinct consent categories
    const groupDefaultConsent = _deps.getRequiredConsentCategory(categoryId);
    const consentSet = new Set();
    if (groupDefaultConsent) consentSet.add(groupDefaultConsent);
    for (const ep of endpoints) {
      if (ep.consentCategory) consentSet.add(ep.consentCategory);
    }
    const consentOrder = ['analytics', 'marketing', 'functional'];
    const sortedConsents = consentOrder.filter(c => consentSet.has(c));
    const groupConsentHtml = sortedConsents.length > 0
      ? sortedConsents.map(c =>
        `<span class="consent-category-badge"><svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>${escapeHtml(c.charAt(0).toUpperCase() + c.slice(1))}</span>`
      ).join('')
      : '';

    html += `
      <div class="category-group${isExpanded ? ' expanded' : ''}" data-category="${categoryId}">
        <div class="category-group-header">
          <svg class="category-group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
          <span class="category-group-icon">${categoryIcon}</span>
          <span class="category-group-name">${escapeHtml(category.name)}</span>
          ${groupConsentHtml}
          <span class="category-group-count">${endpoints.length} ${category.itemLabel || 'tools'}</span>
        </div>
        <div class="category-group-tools">
          ${categoryDescHtml}
    `;

    for (const endpoint of endpoints) {
      const platformIcon = getPlatformIcon(endpoint.id);
      const description = endpoint.description || '';
      const vendorUrl = endpoint.url || '';

      // Build description with optional link
      let descriptionHtml = escapeHtml(description);
      if (vendorUrl) {
        descriptionHtml += `<a href="${escapeHtml(vendorUrl)}" target="_blank" rel="noopener noreferrer" class="vendor-link" data-tool="${endpoint.id}" title="Visit vendor website"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>`;
      }

      // Build detection patterns or syntax
      let patternsHtml = '';
      // For data layer methods, show syntax; for network tools, show URL patterns
      const displayPatterns = endpoint.syntax && endpoint.syntax.length > 0
        ? endpoint.syntax
        : endpoint.patterns;

      if (displayPatterns && displayPatterns.length > 0) {
        patternsHtml = '<div class="category-tool-patterns">';
        for (const pattern of displayPatterns.slice(0, 3)) { // Show max 3 patterns
          let patternStr = '';
          if (typeof pattern === 'string') {
            patternStr = pattern;
          } else if (pattern instanceof RegExp) {
            patternStr = pattern.toString();
          }
          patternsHtml += `<span class="category-tool-pattern">${escapeHtml(patternStr)}</span>`;
        }
        if (displayPatterns.length > 3) {
          patternsHtml += `<span class="category-tool-pattern">+${displayPatterns.length - 3} more</span>`;
        }
        patternsHtml += '</div>';
      }

      const parsedChip = endpoint.parsing?.formattedParser
        ? '<span class="category-tool-badge category-tool-badge-parsed">Parsed</span>'
        : '';

      // Show per-platform consent badge when it differs from the category default
      const platformConsent = endpoint.consentCategory;
      const categoryConsent = _deps.getRequiredConsentCategory(categoryId);
      const consentOverrideHtml = platformConsent && platformConsent !== categoryConsent
        ? `<span class="consent-category-badge"><svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>${escapeHtml(platformConsent.charAt(0).toUpperCase() + platformConsent.slice(1))}</span>`
        : '';

      html += `
        <div class="category-tool-item">
          <span class="category-tool-chip filter-chip active" data-platform="${endpoint.id}">
            <span class="filter-chip-icon">${platformIcon}</span>
            <span class="filter-chip-label">${escapeHtml(endpoint.name)}</span>
          </span>
          <div class="category-tool-info">
            <div class="category-tool-description">${descriptionHtml}${consentOverrideHtml}</div>
            ${patternsHtml}
          </div>
          ${parsedChip}
        </div>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }

  html += '</div>';

  elements.supportedToolsBody.innerHTML = html;

  // Add click handlers for category headers
  elements.supportedToolsBody.querySelectorAll('.category-group-header').forEach(header => {
    header.addEventListener('click', () => {
      const group = header.closest('.category-group');
      const categoryId = group.dataset.category;
      if (collapsedCategories.has(categoryId)) {
        collapsedCategories.delete(categoryId);
        group.classList.add('expanded');
      } else {
        collapsedCategories.add(categoryId);
        group.classList.remove('expanded');
      }
    });
  });

  // Add click handlers for tool chips
  addToolChipClickHandlers();
  addVendorLinkClickHandlers();

  updateToolsModalTitle(filteredEndpoints.length);
}

// ========================================
// Custom Endpoints Section
// ========================================

const CUSTOM_TOOL_COLORS = [
  '#4285F4', // Blue
  '#34A853', // Green
  '#EA4335', // Red
  '#FBBC04', // Yellow
  '#9775C7', // Purple
  '#0891B2', // Teal
  '#F97316', // Orange
  '#EC4899', // Pink
  '#607D8B', // Blue Grey
  '#6D4C41', // Brown
];

let selectedPlatformId = null;
let editingEndpointId = null;

/**
 * Generate a letter-avatar SVG for a custom tool
 */
function getCustomToolIcon(name, color) {
  const letter = (name || '?').charAt(0).toUpperCase();
  const safeColor = _deps.escapeHtml(color || '#607d8b');
  return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${safeColor}"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${letter}</text></svg>`;
}

/**
 * Render the Custom Endpoints tab view
 */
function renderCustomEndpointsView() {
  const { elements, escapeHtml } = _deps;
  const container = elements.supportedToolsBody;
  if (!container) return;

  const customs = _deps.getCustomEndpoints ? _deps.getCustomEndpoints() : [];
  const count = customs.length;

  let html = '<div class="custom-endpoints-view">';

  // Info banner
  html += `
    <div class="custom-ep-info-banner">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      Saved in your browser only &mdash; won't sync across devices or browsers.
    </div>
  `;

  // Header with count and add button
  html += `
    <div class="custom-ep-view-header">
      <span class="custom-ep-view-count">${count} endpoint${count === 1 ? '' : 's'}</span>
      <button type="button" class="custom-endpoints-add-btn custom-ep-view-add-btn">+ Add endpoint</button>
    </div>
  `;

  // Endpoint list
  if (count === 0) {
    html += '<div class="custom-endpoints-empty">No custom endpoints yet. Add one to match internal tools or CNAME proxies to known platforms.</div>';
  } else {
    html += '<div class="custom-ep-list">';
    for (const ep of customs) {
      html += buildCustomEndpointItemHtml(ep);
    }
    html += '</div>';
  }

  // Form container (hidden by default)
  html += '<div class="custom-endpoint-form-container" style="display:none"></div>';

  html += '</div>';

  container.innerHTML = html;

  // Wire up event handlers
  wireCustomEndpointsHandlers(container);
}

/**
 * Build HTML string for a single custom endpoint card
 */
function buildCustomEndpointItemHtml(ep) {
  const { escapeHtml, getPlatformIcon, KNOWN_TRACKING_ENDPOINTS } = _deps;
  let iconHtml, nameText, modeLabel;

  if (ep.mode === 'existing') {
    const platform = KNOWN_TRACKING_ENDPOINTS.find(p => p.id === ep.platformId);
    nameText = platform ? escapeHtml(platform.name) : escapeHtml(ep.platformId);
    iconHtml = platform ? getPlatformIcon(platform.id) : getCustomToolIcon(ep.platformId, '#607d8b');
    modeLabel = '<span class="custom-endpoint-mode-label">Existing</span>';
  } else {
    iconHtml = getCustomToolIcon(ep.name, ep.color);
    nameText = escapeHtml(ep.name);
    modeLabel = '<span class="custom-endpoint-badge">Custom</span>';
  }

  // Combine domain + path into a single URL pattern
  const domain = ep.domain ? escapeHtml(ep.domain) : '';
  const path = ep.path ? escapeHtml(ep.path) : '';
  const pattern = domain + path;

  // Note line (only if present)
  const noteHtml = ep.note
    ? `<div class="custom-endpoint-note">${escapeHtml(ep.note)}</div>`
    : '';

  return `
    <div class="custom-endpoint-item" data-id="${escapeHtml(ep.id)}" data-mode="${ep.mode || 'unknown'}">
      <div class="custom-endpoint-item-header">
        <span class="custom-endpoint-icon">${iconHtml}</span>
        <span class="custom-endpoint-name">${nameText}</span>
        ${modeLabel}
        <span class="custom-endpoint-pattern">${pattern}</span>
        <div class="custom-endpoint-actions">
          <button type="button" class="custom-endpoint-action-btn edit" title="Edit this endpoint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" class="custom-endpoint-action-btn delete" title="Delete this endpoint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      ${noteHtml}
    </div>
  `;
}

/**
 * Wire up click handlers for the Custom Endpoints tab
 */
function wireCustomEndpointsHandlers(container) {
  // Add button
  const addBtn = container.querySelector('.custom-ep-view-add-btn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      showAddEndpointForm();
    });
  }

  // Edit buttons
  container.querySelectorAll('.custom-endpoint-action-btn.edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.custom-endpoint-item');
      if (item) {
        editCustomEndpoint(item.dataset.id);
      }
    });
  });

  // Delete buttons
  container.querySelectorAll('.custom-endpoint-action-btn.delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.custom-endpoint-item');
      if (item) {
        deleteCustomEndpoint(item.dataset.id, item.dataset.mode);
      }
    });
  });
}

/**
 * Show the add/edit endpoint form
 * @param {{ domain?: string, path?: string }} [prefill] - Optional pre-fill data
 * @param {Object} [editEndpoint] - Existing endpoint to edit (null for add mode)
 */
function showAddEndpointForm(prefill, editEndpoint) {
  const viewEl = _deps.elements.supportedToolsBody?.querySelector('.custom-endpoints-view');
  if (!viewEl) return;

  const formContainer = viewEl.querySelector('.custom-endpoint-form-container');
  if (!formContainer) return;

  const { escapeHtml, PLATFORM_CATEGORIES } = _deps;

  // Set editing state
  editingEndpointId = editEndpoint?.id || null;

  // Reset tool selection (will be set below if editing existing mode)
  selectedPlatformId = editEndpoint?.mode === 'existing' ? editEndpoint.platformId : null;

  // Build category options for the "new tool" dropdown
  // Exclude 'unknown' (placeholder) and 'data-layer' (JS-intercepted, not network requests)
  const categoryOptions = Object.entries(PLATFORM_CATEGORIES)
    .filter(([id]) => id !== 'unknown' && id !== 'data-layer')
    .map(([id, cat]) => `<option value="${escapeHtml(id)}">${escapeHtml(cat.name)}</option>`)
    .join('');

  // Build color swatches (pre-select editing color or default to first)
  const editColor = editEndpoint?.color || '';
  const swatchesHtml = CUSTOM_TOOL_COLORS.map((color, i) => {
    const isActive = editColor ? color.toLowerCase() === editColor.toLowerCase() : i === 0;
    return `<button type="button" class="custom-ep-color-swatch${isActive ? ' active' : ''}" data-color="${color}" style="background-color: ${color}" title="${color}"></button>`;
  }).join('');

  const isEditing = !!editEndpoint;
  const isExistingMode = editEndpoint ? editEndpoint.mode === 'existing' : true;
  const formTitle = isEditing ? 'Edit Custom Endpoint' : 'Add Custom Endpoint';
  const saveLabel = isEditing ? 'Save changes' : 'Add endpoint';
  const domainVal = editEndpoint?.domain || prefill?.domain || '';
  const pathVal = editEndpoint?.path || prefill?.path || '';
  const noteVal = editEndpoint?.note || '';
  const nameVal = editEndpoint?.name || '';
  const colorVal = editColor || CUSTOM_TOOL_COLORS[0];
  const categoryVal = editEndpoint?.category || '';

  formContainer.innerHTML = `
    <div class="custom-endpoint-form">
      <div class="custom-endpoint-form-title">${formTitle}</div>
      <div class="custom-ep-mode-cards">
        <button type="button" class="custom-ep-mode-card${isExistingMode ? ' active' : ''}" data-mode="existing">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          <div class="custom-ep-mode-card-text">
            <span class="custom-ep-mode-card-title">Add to existing tool</span>
            <span class="custom-ep-mode-card-desc">Map a domain or path to a tool already in the registry</span>
          </div>
        </button>
        <button type="button" class="custom-ep-mode-card${!isExistingMode ? ' active' : ''}" data-mode="new">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v8M8 12h8"/>
          </svg>
          <div class="custom-ep-mode-card-text">
            <span class="custom-ep-mode-card-title">Create new tool</span>
            <span class="custom-ep-mode-card-desc">Define a local-only tool with a custom name and color</span>
          </div>
        </button>
      </div>
      <div class="custom-endpoint-form-fields">
        <div class="custom-ep-existing-fields"${!isExistingMode ? ' style="display:none"' : ''}>
          <label class="custom-ep-label">Tool</label>
          <div class="custom-ep-tool-picker">
            <div class="custom-ep-tool-selected" style="display:none"></div>
            <input type="text" class="custom-ep-input custom-ep-tool-search" placeholder="Search tools...">
            <div class="custom-ep-tool-list"></div>
          </div>
          <div class="custom-ep-parser-hint">Parser may not work if the request format differs from the standard format.</div>
        </div>
        <div class="custom-ep-new-fields"${isExistingMode ? ' style="display:none"' : ''}>
          <label class="custom-ep-label">Name<input type="text" class="custom-ep-input custom-ep-name" placeholder="e.g. Internal Analytics" maxlength="40" value="${escapeHtml(nameVal)}"></label>
          <label class="custom-ep-label">Category<select class="custom-ep-input custom-ep-category">${categoryOptions}</select></label>
          <label class="custom-ep-label">Color
            <div class="custom-ep-color-swatches">${swatchesHtml}</div>
            <input type="text" class="custom-ep-input custom-ep-color-hex" value="${escapeHtml(colorVal)}" maxlength="7" placeholder="#4285F4">
          </label>
        </div>
        <div class="custom-ep-match-hint">Match by <strong>domain</strong>, <strong>path</strong>, or <strong>both</strong> &mdash; fill in whichever identifies the request. Domain-only matches every request to that host; path-only matches that path on any domain.</div>
        <label class="custom-ep-label">Domain <span class="custom-ep-optional">(optional if path provided)</span><input type="text" class="custom-ep-input custom-ep-domain" placeholder="e.g. analytics.mysite.com" value="${escapeHtml(domainVal)}"></label>
        <label class="custom-ep-label">Path <span class="custom-ep-optional">(optional if domain provided)</span><input type="text" class="custom-ep-input custom-ep-path" placeholder="e.g. /collect" value="${escapeHtml(pathVal)}"></label>
        <div class="custom-ep-path-warning" style="display:none">This will match on ALL domains.</div>
        <label class="custom-ep-label">Note <span class="custom-ep-optional">(optional)</span><input type="text" class="custom-ep-input custom-ep-note" placeholder="e.g. CNAME proxy for GA4" maxlength="80" value="${escapeHtml(noteVal)}"></label>
      </div>
      <div class="custom-ep-validation-msg"></div>
      <div class="custom-endpoint-form-actions">
        <button type="button" class="custom-ep-cancel-btn">Cancel</button>
        <button type="button" class="custom-ep-save-btn">${saveLabel}</button>
      </div>
    </div>
  `;

  formContainer.style.display = 'block';

  // Populate the searchable tool list
  populateToolPicker(formContainer);

  // Pre-select tool or set category when editing
  if (editEndpoint) {
    if (editEndpoint.mode === 'existing' && editEndpoint.platformId) {
      // Simulate selecting the tool in the picker
      const toolOpt = formContainer.querySelector(`.custom-ep-tool-option[data-platform-id="${editEndpoint.platformId}"]`);
      if (toolOpt) toolOpt.click();
    } else if (editEndpoint.mode === 'new' && editEndpoint.category) {
      formContainer.querySelector('.custom-ep-category').value = editEndpoint.category;
    }
    // Show path warning if applicable
    if (!editEndpoint.domain && editEndpoint.path) {
      formContainer.querySelector('.custom-ep-path-warning').style.display = '';
    }
  }

  // Wire up mode cards
  const modeCards = formContainer.querySelectorAll('.custom-ep-mode-card');
  const existingFields = formContainer.querySelector('.custom-ep-existing-fields');
  const newFields = formContainer.querySelector('.custom-ep-new-fields');
  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      modeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const isExisting = card.dataset.mode === 'existing';
      existingFields.style.display = isExisting ? '' : 'none';
      newFields.style.display = isExisting ? 'none' : '';
    });
  });

  // Wire up color swatches
  const swatchesEl = formContainer.querySelector('.custom-ep-color-swatches');
  const colorHex = formContainer.querySelector('.custom-ep-color-hex');
  swatchesEl.addEventListener('click', (e) => {
    const swatch = e.target.closest('.custom-ep-color-swatch');
    if (!swatch) return;
    swatchesEl.querySelectorAll('.custom-ep-color-swatch').forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    colorHex.value = swatch.dataset.color;
  });
  colorHex.addEventListener('input', () => {
    if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(colorHex.value)) {
      swatchesEl.querySelectorAll('.custom-ep-color-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.color.toLowerCase() === colorHex.value.toLowerCase());
      });
    }
  });

  // Wire up path-only warning
  const domainInput = formContainer.querySelector('.custom-ep-domain');
  const pathInput = formContainer.querySelector('.custom-ep-path');
  const pathWarning = formContainer.querySelector('.custom-ep-path-warning');
  const updatePathWarning = () => {
    pathWarning.style.display = (!domainInput.value.trim() && pathInput.value.trim()) ? '' : 'none';
  };
  domainInput.addEventListener('input', updatePathWarning);
  pathInput.addEventListener('input', updatePathWarning);

  // Cancel
  formContainer.querySelector('.custom-ep-cancel-btn').addEventListener('click', () => {
    editingEndpointId = null;
    formContainer.style.display = 'none';
  });

  // Save
  formContainer.querySelector('.custom-ep-save-btn').addEventListener('click', () => {
    saveCustomEndpoint(formContainer);
  });

  // Scroll form into view
  formContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Populate the searchable tool picker list
 */
function populateToolPicker(formContainer) {
  const { escapeHtml, getPlatformIcon, KNOWN_TRACKING_ENDPOINTS } = _deps;
  const listEl = formContainer.querySelector('.custom-ep-tool-list');
  if (!listEl) return;

  const sortedPlatforms = [...KNOWN_TRACKING_ENDPOINTS].sort((a, b) => a.name.localeCompare(b.name));
  let html = '';
  for (const p of sortedPlatforms) {
    const icon = getPlatformIcon(p.id);
    html += `<div class="custom-ep-tool-option" data-platform-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name.toLowerCase())}"><span class="custom-ep-tool-option-icon">${icon}</span><span class="custom-ep-tool-option-name">${escapeHtml(p.name)}</span></div>`;
  }
  listEl.innerHTML = html;

  // Wire up search filtering
  const toolSearch = formContainer.querySelector('.custom-ep-tool-search');
  toolSearch.addEventListener('input', () => {
    const query = toolSearch.value.toLowerCase();
    listEl.querySelectorAll('.custom-ep-tool-option').forEach(opt => {
      opt.style.display = (!query || opt.dataset.name.includes(query)) ? '' : 'none';
    });
  });

  // Wire up tool selection
  const selectedEl = formContainer.querySelector('.custom-ep-tool-selected');
  listEl.addEventListener('click', (e) => {
    const opt = e.target.closest('.custom-ep-tool-option');
    if (!opt) return;
    selectedPlatformId = opt.dataset.platformId;
    const name = opt.querySelector('.custom-ep-tool-option-name').textContent;
    const icon = opt.querySelector('.custom-ep-tool-option-icon').innerHTML;

    selectedEl.innerHTML = `
      <span class="custom-ep-tool-chip">
        <span class="custom-ep-tool-chip-icon">${icon}</span>
        <span class="custom-ep-tool-chip-name">${_deps.escapeHtml(name)}</span>
        <button type="button" class="custom-ep-tool-chip-clear" title="Clear selection">&times;</button>
      </span>
    `;
    selectedEl.style.display = '';
    toolSearch.style.display = 'none';
    listEl.style.display = 'none';

    selectedEl.querySelector('.custom-ep-tool-chip-clear').addEventListener('click', () => {
      selectedPlatformId = null;
      selectedEl.style.display = 'none';
      selectedEl.innerHTML = '';
      toolSearch.style.display = '';
      listEl.style.display = '';
      toolSearch.value = '';
      toolSearch.focus();
      listEl.querySelectorAll('.custom-ep-tool-option').forEach(opt => { opt.style.display = ''; });
    });
  });
}

/**
 * Validate and save a custom endpoint from the form
 */
async function saveCustomEndpoint(formContainer) {
  const mode = formContainer.querySelector('.custom-ep-mode-card.active')?.dataset.mode || 'existing';
  const domain = formContainer.querySelector('.custom-ep-domain').value.trim();
  const path = formContainer.querySelector('.custom-ep-path').value.trim();
  const note = formContainer.querySelector('.custom-ep-note').value.trim();
  const validationMsg = formContainer.querySelector('.custom-ep-validation-msg');

  const endpoint = { mode, domain, path, note };

  if (mode === 'existing') {
    endpoint.platformId = selectedPlatformId;
  } else {
    endpoint.name = formContainer.querySelector('.custom-ep-name').value.trim();
    endpoint.category = formContainer.querySelector('.custom-ep-category').value;
    endpoint.color = formContainer.querySelector('.custom-ep-color-hex').value.trim();
  }

  // Validate (exclude current endpoint from checks when editing)
  const customs = _deps.getCustomEndpoints ? _deps.getCustomEndpoints() : [];
  const customsForValidation = editingEndpointId
    ? customs.filter(ep => ep.id !== editingEndpointId)
    : customs;
  const { valid, errors, warning } = validateCustomEndpoint(endpoint, customsForValidation);

  if (!valid) {
    validationMsg.textContent = errors[0];
    validationMsg.className = 'custom-ep-validation-msg custom-ep-error';
    return;
  }

  if (warning) {
    validationMsg.textContent = warning;
    validationMsg.className = 'custom-ep-validation-msg custom-ep-warning';
  }

  let updated;
  let action;
  if (editingEndpointId) {
    // Edit: replace the existing endpoint, preserving its ID and date
    const existing = customs.find(ep => ep.id === editingEndpointId);
    endpoint.id = editingEndpointId;
    endpoint.addedDate = existing?.addedDate || new Date().toISOString().slice(0, 10);
    updated = customs.map(ep => ep.id === editingEndpointId ? endpoint : ep);
    action = 'edit';
  } else {
    // Add: generate new ID
    endpoint.id = 'custom-' + Date.now();
    endpoint.addedDate = new Date().toISOString().slice(0, 10);
    updated = [...customs, endpoint];
    action = 'add';
  }

  await chrome.storage.local.set({ customEndpoints: updated });

  // Refresh the in-memory cache so re-render shows updated data
  await _deps.loadCustomEndpoints();

  // Reset editing state
  editingEndpointId = null;

  // Re-render the Custom tab
  renderCustomEndpointsView();

  _deps.trackEvent('custom_endpoint', {
    action,
    mode,
    category: mode === 'new' ? endpoint.category : (_deps.KNOWN_TRACKING_ENDPOINTS.find(p => p.id === endpoint.platformId)?.category || 'unknown'),
    source: 'tools_modal',
    feature: 'tools_modal'
  });
}

/**
 * Delete a custom endpoint by ID
 */
async function deleteCustomEndpoint(id, mode) {
  const customs = _deps.getCustomEndpoints ? _deps.getCustomEndpoints() : [];
  const updated = customs.filter(ep => ep.id !== id);
  await chrome.storage.local.set({ customEndpoints: updated });
  await _deps.loadCustomEndpoints();
  renderCustomEndpointsView();

  _deps.trackEvent('custom_endpoint', { action: 'remove', mode: mode || 'unknown', feature: 'tools_modal' });
}

/**
 * Edit a custom endpoint — opens form pre-filled with its data
 */
function editCustomEndpoint(id) {
  const customs = _deps.getCustomEndpoints ? _deps.getCustomEndpoints() : [];
  const ep = customs.find(e => e.id === id);
  if (!ep) return;
  showAddEndpointForm(null, ep);
}

/**
 * Validate a custom endpoint before saving
 */
function validateCustomEndpoint(endpoint, existingCustomEndpoints) {
  const errors = [];

  // Mode-specific required fields
  if (endpoint.mode === 'existing' && !endpoint.platformId) {
    errors.push('Select a tool from the list');
  }
  if (endpoint.mode === 'new') {
    if (!endpoint.name) errors.push('Name is required');
    if (!endpoint.category) errors.push('Select a category');
    if (!endpoint.color || !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(endpoint.color)) errors.push('Enter a valid hex color (e.g. #4285F4 or #F00)');
    // Normalize 3-char hex to 6-char for consistent downstream usage
    if (endpoint.color && /^#[0-9a-fA-F]{3}$/.test(endpoint.color)) {
      endpoint.color = '#' + endpoint.color[1] + endpoint.color[1] + endpoint.color[2] + endpoint.color[2] + endpoint.color[3] + endpoint.color[3];
    }
  }

  // At least domain or path required
  if (!endpoint.domain && !endpoint.path) {
    errors.push('Enter a domain, path, or both');
  }

  // Domain validation
  if (endpoint.domain) {
    if (!endpoint.domain.includes('.')) {
      errors.push('Domain should include a dot (e.g. analytics.mysite.com)');
    }
  }

  // Path validation
  if (endpoint.path) {
    if (!endpoint.path.startsWith('/')) {
      errors.push('Path should start with / (e.g. /collect)');
    }
  }

  // Duplicate check
  const isDuplicate = existingCustomEndpoints.some(ep =>
    ep.domain === endpoint.domain && ep.path === endpoint.path
  );
  if (isDuplicate) {
    errors.push('An endpoint with this domain and path already exists');
  }

  // Warn if already matched by a built-in pattern
  let warning = null;
  if ((endpoint.domain || endpoint.path) && _deps.matchKnownEndpoint) {
    const testUrl = `https://${endpoint.domain || 'example.com'}${endpoint.path || '/'}`;
    const existingMatch = _deps.matchKnownEndpoint(testUrl);
    if (existingMatch?.matched && !existingMatch.isCustomMatch) {
      warning = `Already matched by "${existingMatch.endpoint.name}" — your custom endpoint will take priority`;
    }
  }

  return { valid: errors.length === 0, errors, warning };
}
