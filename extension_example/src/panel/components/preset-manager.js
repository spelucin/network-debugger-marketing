/**
 * Preset Manager Module
 *
 * Extracted from panel.js (Phase 7) — handles preset CRUD, dropdown UI,
 * save button state, and visibility helpers.
 *
 * Dependencies are injected via initPresetManager() to avoid circular imports.
 *
 * @param {Function} deps.getState - Returns the panel state object
 * @param {Object} deps.elements - DOM element references
 * @param {Function} deps.loadSettings - Load settings from chrome.storage.local
 * @param {Function} deps.saveSettings - Save settings to chrome.storage.local
 * @param {Object} deps.PLATFORM_CATEGORIES - Category definitions
 * @param {Object} deps.PLATFORM_NAMES - Tool display names
 * @param {Function} deps.getPlatformsForCategory - Get platforms in a category
 * @param {Function} deps.updateCategoryStateFromTools - Sync category state after tool changes
 * @param {Function} deps.showAllTools - Show all tools (called by clearActivePreset)
 * @param {Function} deps.updateScriptsFilterUI - Update Scripts filter chip UI
 * @param {Function} deps.updateConsentFilterUI - Update Consent filter chip UI
 * @param {Function} deps.render - Re-render after preset load
 * @param {Function} deps.escapeHtml - HTML escaping utility
 * @param {Function} deps.trackEvent - Analytics tracking
 */

let _deps;

// ========================================
// Init
// ========================================

export function initPresetManager(deps) {
  _deps = deps;

  const { elements } = _deps;

  // Preset dropdown button
  if (elements.presetDropdownBtn) {
    elements.presetDropdownBtn.addEventListener('click', togglePresetDropdown);
  }

  // Preset clear button
  if (elements.presetClearBtn) {
    elements.presetClearBtn.addEventListener('click', clearActivePreset);
  }

  // Save preset button
  if (elements.savePresetBtn) {
    elements.savePresetBtn.addEventListener('click', promptSavePreset);
  }

  // Close preset dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (elements.presetDropdown && !elements.presetDropdown.contains(e.target)) {
      closePresetDropdown();
    }
  });
}

// ========================================
// Visibility Helpers
// ========================================

// Get currently visible tools (detected tools that are not hidden)
export function getVisibleTools() {
  const state = _deps.getState();
  const visible = [];
  Object.keys(_deps.PLATFORM_CATEGORIES).forEach(categoryId => {
    _deps.getPlatformsForCategory(categoryId).forEach(platform => {
      if ((state.platformCounts[platform] || 0) > 0) {
        // When a preset is active, use the whitelist
        const isVisible = state.activePresetVisibleTools
          ? state.activePresetVisibleTools.includes(platform)
          : !state.hiddenTools.includes(platform);
        if (isVisible) {
          visible.push(platform);
        }
      }
    });
  });
  return visible;
}

// Check if any tools are hidden (to show/hide Save Preset button)
export function hasHiddenTools() {
  const state = _deps.getState();
  if (state.activePresetVisibleTools) {
    // With preset active, check if there are any detected tools not in the whitelist
    return Object.keys(_deps.PLATFORM_CATEGORIES).some(categoryId =>
      _deps.getPlatformsForCategory(categoryId).some(platform =>
        (state.platformCounts[platform] || 0) > 0 &&
        !state.activePresetVisibleTools.includes(platform)
      )
    );
  }
  return state.hiddenTools.length > 0;
}

// ========================================
// Save Preset Button
// ========================================

// Update Save Preset button - always visible with three states:
// 1. No preset active → "Save Preset" (enabled when some tools visible & hidden)
// 2. Preset active, no changes → "Update Preset" (disabled/greyed)
// 3. Preset active, changes made → "Update Preset" (enabled)
export function updateSavePresetButton() {
  const { elements } = _deps;
  const state = _deps.getState();

  if (!elements.savePresetBtn) return;

  // Always show the button
  elements.savePresetBtn.classList.add('visible');

  const visibleTools = getVisibleTools();
  const hasVisibleTools = visibleTools.length > 0;
  const hasHidden = hasHiddenTools();

  // Check if any main filter or nesting state differs from defaults
  const hasFilterChanges =
    !state.filters.eventTypes.scripts ||
    !state.filters.eventTypes.consent ||
    !state.showTriggerCorrelation;

  if (state.activePresetId && state.activePresetOriginalTools) {
    // Preset is active - show "Update Preset"
    const currentSorted = [...(state.activePresetVisibleTools || [])].sort();
    const originalSorted = [...state.activePresetOriginalTools].sort();
    const hasToolChanges = currentSorted.length !== originalSorted.length ||
      currentSorted.some((tool, i) => tool !== originalSorted[i]);

    // Check if filter states changed from preset's original values
    let hasPresetFilterChanges = false;
    if (state.activePresetOriginalFilters) {
      hasPresetFilterChanges =
        state.filters.eventTypes.scripts !== state.activePresetOriginalFilters.scripts ||
        state.filters.eventTypes.consent !== state.activePresetOriginalFilters.consent ||
        state.filters.eventTypes.interactions !== state.activePresetOriginalFilters.interactions;
    }

    // Check if nesting state changed from preset's original value
    let hasPresetNestingChanges = false;
    if (state.activePresetOriginalNesting !== null) {
      hasPresetNestingChanges = state.showTriggerCorrelation !== state.activePresetOriginalNesting;
    }

    const hasChanges = hasToolChanges || hasPresetFilterChanges || hasPresetNestingChanges;

    elements.savePresetBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      Update Preset`;

    if (hasChanges && hasVisibleTools) {
      // Changes made - enable button
      elements.savePresetBtn.disabled = false;
      elements.savePresetBtn.classList.remove('disabled');
      elements.savePresetBtn.title = 'Update the current preset with new settings';
    } else {
      // No changes - disable button
      elements.savePresetBtn.disabled = true;
      elements.savePresetBtn.classList.add('disabled');
      elements.savePresetBtn.title = 'No changes to update';
    }
  } else {
    // No preset active - show "Save Preset"
    elements.savePresetBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      Save Preset`;

    // Enable if tools are filtered OR if any main filter/nesting is changed from default
    if ((hasVisibleTools && hasHidden) || hasFilterChanges) {
      // Some visible, some hidden, or filter changes - enable button
      elements.savePresetBtn.disabled = false;
      elements.savePresetBtn.classList.remove('disabled');
      elements.savePresetBtn.title = 'Save current settings as a preset';
    } else {
      // All visible and all filters at default - disable button
      elements.savePresetBtn.disabled = true;
      elements.savePresetBtn.classList.add('disabled');
      elements.savePresetBtn.title = 'Change filters or hide some tools to create a preset';
    }
  }
}

// ========================================
// Preset CRUD
// ========================================

// Save current visible tools as a preset
export async function savePreset(name) {
  const state = _deps.getState();
  const visibleTools = getVisibleTools();
  if (visibleTools.length === 0) {
    alert('No tools are currently visible. Select some tools first.');
    return;
  }

  const settings = await _deps.loadSettings();
  const preset = {
    id: Date.now().toString(),
    name: name,
    visibleTools: visibleTools,
    // Save main filter states
    mainFilters: {
      scripts: state.filters.eventTypes.scripts,
      consent: state.filters.eventTypes.consent,
      interactions: state.filters.eventTypes.interactions
    },
    // Save dataLayer nesting toggle state
    showNesting: state.showTriggerCorrelation
  };

  settings.presets = settings.presets || [];
  settings.presets.push(preset);
  await _deps.saveSettings(settings);

  // Set as active preset with whitelist
  state.activePresetId = preset.id;
  state.activePresetVisibleTools = [...visibleTools];
  state.activePresetOriginalTools = [...visibleTools];
  updatePresetDropdown();
  updatePresetDropdownLabel();
  updateSavePresetButton();
}

// Load a preset (show only the tools in the preset)
export async function loadPreset(presetId) {
  const state = _deps.getState();
  const settings = await _deps.loadSettings();
  const preset = (settings.presets || []).find(p => p.id === presetId);
  if (!preset) return;

  // Get all detected platforms
  const allDetectedPlatforms = [];
  Object.keys(_deps.PLATFORM_CATEGORIES).forEach(categoryId => {
    _deps.getPlatformsForCategory(categoryId).forEach(platform => {
      if ((state.platformCounts[platform] || 0) > 0) {
        allDetectedPlatforms.push(platform);
      }
    });
  });

  // Store the whitelist - only these tools will be shown
  state.activePresetVisibleTools = [...preset.visibleTools];
  state.activePresetOriginalTools = [...preset.visibleTools]; // Keep original for change detection
  state.activePresetId = presetId;

  // Also update hiddenTools for consistency with category panel UI
  state.hiddenTools = allDetectedPlatforms.filter(p => !preset.visibleTools.includes(p));

  // Restore main filter states if saved in preset
  if (preset.mainFilters) {
    // Handle both old boolean format and new 4-state format
    const scriptsValue = preset.mainFilters.scripts;
    const consentValue = preset.mainFilters.consent;

    // Convert legacy values to 3-state
    const SCRIPTS_MAP = { 'tool': 'auto', 'show': 'auto', 'hide': 'hide', 'only': 'only' };
    const CONSENT_MAP = { 'tool': 'auto', 'show': 'auto', 'hide': 'off', 'only': 'only' };
    if (typeof scriptsValue === 'boolean') {
      state.filters.eventTypes.scripts = scriptsValue ? 'auto' : 'hide';
    } else {
      state.filters.eventTypes.scripts = SCRIPTS_MAP[scriptsValue] || scriptsValue || 'auto';
    }
    if (typeof consentValue === 'boolean') {
      state.filters.eventTypes.consent = consentValue ? 'auto' : 'off';
    } else {
      state.filters.eventTypes.consent = CONSENT_MAP[consentValue] || consentValue || 'auto';
    }

    // Restore interactions filter if saved in preset
    if (preset.mainFilters.interactions !== undefined) {
      state.filters.eventTypes.interactions = preset.mainFilters.interactions;
      _deps.updateInteractionsFilterUI();
    }

    // Store original filter states for change detection
    state.activePresetOriginalFilters = { ...preset.mainFilters };

    // Update filter UI
    _deps.updateScriptsFilterUI();
    _deps.updateConsentFilterUI();
  } else {
    state.activePresetOriginalFilters = null;
  }

  // Restore dataLayer nesting toggle if saved in preset
  if (preset.showNesting !== undefined) {
    state.showTriggerCorrelation = preset.showNesting;
    state.activePresetOriginalNesting = preset.showNesting;
    if (_deps.elements.triggerCorrelationToggle) {
      _deps.elements.triggerCorrelationToggle.checked = preset.showNesting;
    }
  } else {
    state.activePresetOriginalNesting = null;
  }

  // Update category states
  _deps.updateCategoryStateFromTools();
  _deps.render();
  updatePresetDropdownLabel();
  updateSavePresetButton();
  closePresetDropdown();
}

// Delete a preset
export async function deletePreset(presetId) {
  const state = _deps.getState();
  const settings = await _deps.loadSettings();
  settings.presets = (settings.presets || []).filter(p => p.id !== presetId);
  await _deps.saveSettings(settings);

  // If deleted preset was active, clear active state
  if (state.activePresetId === presetId) {
    state.activePresetId = null;
    state.activePresetVisibleTools = null;
    state.activePresetOriginalTools = null;
    state.activePresetOriginalFilters = null;
    state.activePresetOriginalNesting = null;
    updatePresetDropdownLabel();
  }
  updatePresetDropdown();
}

// Clear active preset (show all tools)
export function clearActivePreset() {
  const state = _deps.getState();
  state.activePresetId = null;
  state.activePresetVisibleTools = null;
  state.activePresetOriginalTools = null;
  state.activePresetOriginalFilters = null;
  state.activePresetOriginalNesting = null;
  _deps.showAllTools();
  updatePresetDropdownLabel();
  updateSavePresetButton();
  closePresetDropdown();
}

// ========================================
// Preset Dropdown UI
// ========================================

// Update preset dropdown list
export async function updatePresetDropdown() {
  const { elements } = _deps;
  if (!elements.presetDropdownList) return;

  const settings = await _deps.loadSettings();
  const presets = settings.presets || [];

  if (presets.length === 0) {
    elements.presetDropdownList.innerHTML = '<div class="preset-dropdown-empty">No presets saved yet</div>';
    return;
  }

  elements.presetDropdownList.innerHTML = presets.map(preset => {
    // Build tooltip with tool names and settings
    const toolNames = preset.visibleTools
      .map(id => _deps.PLATFORM_NAMES[id] || id)
      .sort()
      .join('\n');

    // Add filter settings to tooltip
    let tooltipParts = [`Tools (${preset.visibleTools.length}):\n${toolNames}`];

    // Add main filter settings if present
    if (preset.mainFilters) {
      const modeLabels = { auto: 'Auto', only: 'Only', hide: 'Hide', off: 'Off', tool: 'Auto', show: 'Auto' };
      const filterStatus = [];
      if (preset.mainFilters.scripts && preset.mainFilters.scripts !== 'tool' && preset.mainFilters.scripts !== 'auto') {
        filterStatus.push(`Scripts: ${modeLabels[preset.mainFilters.scripts] || preset.mainFilters.scripts}`);
      }
      if (preset.mainFilters.consent && preset.mainFilters.consent !== 'tool' && preset.mainFilters.consent !== 'auto') {
        filterStatus.push(`Consent: ${modeLabels[preset.mainFilters.consent] || preset.mainFilters.consent}`);
      }
      if (preset.mainFilters.interactions === false) {
        filterStatus.push('Interactions: Hide');
      }
      if (filterStatus.length > 0) {
        tooltipParts.push('\nFilters:\n' + filterStatus.join('\n'));
      }
    }

    // Add nesting setting if present and disabled
    if (preset.showNesting === false) {
      tooltipParts.push('\nDataLayer Nesting: OFF');
    }

    const tooltip = tooltipParts.join('');

    return `
    <button type="button" class="preset-dropdown-item" data-preset-id="${preset.id}">
      <span class="preset-name">${_deps.escapeHtml(preset.name)}</span>
      <span class="preset-count" title="${_deps.escapeHtml(tooltip)}">${preset.visibleTools.length} tools</span>
      <span class="preset-delete" data-delete-preset="${preset.id}" title="Delete preset">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </span>
    </button>
  `;
  }).join('');

  // Add click handlers
  elements.presetDropdownList.querySelectorAll('.preset-dropdown-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // Check if delete button was clicked
      const deleteBtn = e.target.closest('[data-delete-preset]');
      if (deleteBtn) {
        e.stopPropagation();
        const presetId = deleteBtn.dataset.deletePreset;
        if (confirm('Delete this preset?')) {
          deletePreset(presetId);
        }
        return;
      }
      // Load preset
      const presetId = item.dataset.presetId;
      loadPreset(presetId);
    });
  });
}

// Update preset dropdown label
export function updatePresetDropdownLabel() {
  const { elements } = _deps;
  const state = _deps.getState();
  if (!elements.presetDropdownLabel) return;

  if (state.activePresetId) {
    _deps.loadSettings().then(settings => {
      const preset = (settings.presets || []).find(p => p.id === state.activePresetId);
      if (preset) {
        elements.presetDropdownLabel.textContent = preset.name;
        elements.presetDropdownBtn.classList.add('active');
      }
    });
  } else {
    elements.presetDropdownLabel.textContent = 'Presets';
    elements.presetDropdownBtn.classList.remove('active');
  }
}

// Toggle preset dropdown
export function togglePresetDropdown() {
  const { elements } = _deps;
  if (elements.presetDropdown) {
    elements.presetDropdown.classList.toggle('open');
    if (elements.presetDropdown.classList.contains('open')) {
      updatePresetDropdown();
    }
  }
}

// Close preset dropdown
export function closePresetDropdown() {
  if (_deps.elements.presetDropdown) {
    _deps.elements.presetDropdown.classList.remove('open');
  }
}

// Prompt user to save a preset
export async function promptSavePreset() {
  const state = _deps.getState();
  const visibleTools = getVisibleTools();
  if (visibleTools.length === 0) {
    alert('No tools are currently visible. Select some tools first.');
    return;
  }

  // Check if we're updating an existing preset
  if (state.activePresetId) {
    const settings = await _deps.loadSettings();
    const preset = (settings.presets || []).find(p => p.id === state.activePresetId);
    if (preset) {
      // Update the existing preset
      preset.visibleTools = visibleTools;
      // Also update main filters and nesting toggle
      preset.mainFilters = {
        scripts: state.filters.eventTypes.scripts,
        consent: state.filters.eventTypes.consent,
        interactions: state.filters.eventTypes.interactions
      };
      preset.showNesting = state.showTriggerCorrelation;
      await _deps.saveSettings(settings);

      // Update local state to match saved preset (original = current now)
      state.activePresetVisibleTools = [...visibleTools];
      state.activePresetOriginalTools = [...visibleTools];
      updateSavePresetButton();
      updatePresetDropdown();
      return;
    }
  }

  // Create new preset
  const name = prompt(`Save current selection as preset?\n(${visibleTools.length} tools visible)`, '');
  if (name && name.trim()) {
    savePreset(name.trim());
  }
}
