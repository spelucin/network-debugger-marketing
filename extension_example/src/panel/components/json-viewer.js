// JSON Viewer Component
// Renders JSON data as a collapsible tree

import { safeStringify } from '../../shared/json-safe.js';

// Store labels state per section to persist across re-renders
// Key: sectionId (string), Value: boolean (labels active)
const labelsStateMap = new Map();

// Cache for loaded descriptions (lazy-loaded)
let descriptionsCache = null;
let descriptionsLoading = false;

/**
 * Lazy-load parameter descriptions
 * Only loads when user clicks Labels button for the first time
 * @returns {Promise<Object>} Module with getParamDescriptions function
 */
async function loadDescriptions() {
  if (descriptionsCache) {
    return descriptionsCache;
  }

  if (descriptionsLoading) {
    // Wait for existing load to complete
    return new Promise((resolve) => {
      const checkCache = setInterval(() => {
        if (descriptionsCache) {
          clearInterval(checkCache);
          resolve(descriptionsCache);
        }
      }, 50);
    });
  }

  descriptionsLoading = true;
  try {
    descriptionsCache = await import('./param-descriptions.js');
    return descriptionsCache;
  } finally {
    descriptionsLoading = false;
  }
}

/**
 * Get the type of a value for styling
 * @param {*} value - The value to check
 * @returns {string} The type name
 */
function getType(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Format a primitive value for display
 * @param {*} value - The value to format
 * @returns {string} Formatted string
 */
function formatPrimitive(value) {
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  return String(value);
}

/**
 * Create a JSON row element
 * @param {string} key - The key name (or null for array items)
 * @param {*} value - The value
 * @param {number} depth - Current depth for indentation
 * @param {boolean} isLast - Whether this is the last item
 * @param {Object} keyDescriptions - Optional map of key names to descriptions
 * @param {boolean} showAnnotations - Whether to show inline annotations
 * @param {Set<string>} collapsedByDefault - Set of key names to collapse by default
 * @returns {HTMLElement} The row element
 */
function createJSONRow(key, value, depth, isLast, keyDescriptions = {}, showAnnotations = false, collapsedByDefault = null) {
  const row = document.createElement('div');
  row.className = 'json-row';
  // Indentation is produced by the nested `.json-children` container padding
  // (which also draws the vertical indent guide) rather than a per-row
  // paddingLeft, so each level stays visually aligned with its parent.

  const type = getType(value);

  // Key with optional annotation
  if (key !== null) {
    let description = keyDescriptions[key];

    // For keys without explicit description, check for prefix patterns
    if (!description && typeof key === 'string') {
      if (key.startsWith('ep.') || key.startsWith('epn.')) {
        description = 'Custom Event Param';
      } else if (key.startsWith('up.') || key.startsWith('upn.')) {
        description = 'Custom User Property';
      }
    }

    // Add annotation label before the key if in annotated mode
    // Always add a placeholder to maintain alignment, even if empty
    if (showAnnotations) {
      const annotationSpan = document.createElement('span');
      annotationSpan.className = 'json-annotation';
      annotationSpan.textContent = description || '';
      row.appendChild(annotationSpan);
    }

    const keySpan = document.createElement('span');
    keySpan.className = 'json-key';

    // Always add tooltip if we have a description
    if (description) {
      keySpan.classList.add('json-key-with-hint');
      keySpan.title = description;
    }
    keySpan.textContent = `"${key}": `;
    row.appendChild(keySpan);
  }

  // Value
  if (type === 'object' || type === 'array') {
    // Complex type - create collapsible section
    const toggle = document.createElement('span');
    toggle.className = 'json-toggle';

    const bracket = document.createElement('span');
    bracket.className = 'json-bracket';

    const entries = type === 'array' ? value : Object.entries(value);
    const isEmpty = type === 'array' ? value.length === 0 : Object.keys(value).length === 0;

    if (isEmpty) {
      bracket.textContent = type === 'array' ? '[]' : '{}';
      row.appendChild(bracket);
    } else {
      // Check if this key should start collapsed
      const startCollapsed = collapsedByDefault && key !== null && collapsedByDefault.has(key);

      toggle.textContent = startCollapsed ? '▶ ' : '▼ ';
      row.appendChild(toggle);

      bracket.textContent = type === 'array' ? '[' : '{';
      row.appendChild(bracket);

      // Preview
      const preview = document.createElement('span');
      preview.className = 'json-preview';
      preview.style.color = 'var(--text-muted)';
      preview.style.display = startCollapsed ? '' : 'none';
      if (type === 'array') {
        preview.textContent = ` Array(${value.length})`;
      } else {
        const keys = Object.keys(value);
        preview.textContent = ` {${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''}}`;
      }
      row.appendChild(preview);

      // Children container
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'json-children';
      if (startCollapsed) {
        childrenContainer.style.display = 'none';
      }

      // Batch child rows through a fragment per level (#131 F11) — one
      // append into the container instead of one per row.
      const childFragment = document.createDocumentFragment();
      if (type === 'array') {
        value.forEach((item, index) => {
          const childRow = createJSONRow(null, item, depth + 1, index === value.length - 1, keyDescriptions, showAnnotations, collapsedByDefault);
          // Add index prefix for arrays
          const indexSpan = document.createElement('span');
          indexSpan.className = 'json-key';
          indexSpan.textContent = `${index}: `;
          childRow.insertBefore(indexSpan, childRow.firstChild.nextSibling || childRow.firstChild);
          childFragment.appendChild(childRow);
        });
      } else {
        const entries = Object.entries(value);
        entries.forEach(([k, v], index) => {
          // Check if there are nested descriptions for this key
          const nestedDescriptions = keyDescriptions[k] && typeof keyDescriptions[k] === 'object'
            ? keyDescriptions[k]
            : keyDescriptions;
          childFragment.appendChild(createJSONRow(k, v, depth + 1, index === entries.length - 1, nestedDescriptions, showAnnotations, collapsedByDefault));
        });
      }
      childrenContainer.appendChild(childFragment);

      // Closing bracket
      const closingRow = document.createElement('div');
      closingRow.className = 'json-row';
      const closingBracket = document.createElement('span');
      closingBracket.className = 'json-bracket';
      closingBracket.textContent = type === 'array' ? ']' : '}';
      if (!isLast) {
        closingBracket.textContent += ',';
      }
      closingRow.appendChild(closingBracket);
      if (startCollapsed) {
        closingRow.style.display = 'none';
      }

      // Toggle handler — the whole opener row is clickable, not just the small
      // ▼/▶ triangle, so collapsing a nested object has a forgiving hit target.
      // A click on the triangle bubbles up to this same row listener, so the
      // toggle needs no separate handler.
      const toggleCollapse = () => {
        const isCollapsed = childrenContainer.style.display === 'none';
        if (isCollapsed) {
          toggle.textContent = '▼ ';
          childrenContainer.style.display = '';
          closingRow.style.display = '';
          preview.style.display = 'none';
        } else {
          toggle.textContent = '▶ ';
          childrenContainer.style.display = 'none';
          closingRow.style.display = 'none';
          preview.style.display = '';
        }
      };
      row.classList.add('json-row-collapsible');
      row.addEventListener('click', () => {
        // Don't toggle when the user is mid text-selection inside the row.
        const sel = typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null;
        if (sel && !sel.isCollapsed) return;
        toggleCollapse();
      });

      // Create wrapper for row and children
      const wrapper = document.createElement('div');
      wrapper.appendChild(row);
      wrapper.appendChild(childrenContainer);
      wrapper.appendChild(closingRow);

      return wrapper;
    }
  } else {
    // Primitive value
    const valueSpan = document.createElement('span');
    valueSpan.className = `json-${type}`;
    valueSpan.textContent = formatPrimitive(value);
    if (!isLast) {
      valueSpan.textContent += ',';
    }
    row.appendChild(valueSpan);
  }

  return row;
}

/**
 * Collapse or expand all nodes in a container
 * @param {HTMLElement} container - The container element
 * @param {boolean} collapse - Whether to collapse (true) or expand (false)
 * @param {boolean} skipRoot - Whether to skip the root level (default: true)
 */
function setAllCollapsed(container, collapse, skipRoot = true) {
  const allToggles = container.querySelectorAll('.json-toggle');

  allToggles.forEach((toggle, index) => {
    // Skip the first toggle (root level) if skipRoot is true
    if (skipRoot && index === 0) return;

    // The toggle is inside a .json-row which is inside a wrapper div
    // Wrapper structure: div > .json-row (with toggle) + .json-children + .json-row (closing)
    const row = toggle.closest('.json-row');
    if (!row) return;

    const wrapper = row.parentElement;
    if (!wrapper) return;

    // Find children container and closing row as siblings
    const children = wrapper.querySelector(':scope > .json-children');
    const preview = row.querySelector('.json-preview');

    // Find the closing row (it's a direct child of wrapper, after children)
    let closingRow = null;
    const wrapperChildren = wrapper.children;
    for (let i = 0; i < wrapperChildren.length; i++) {
      const child = wrapperChildren[i];
      if (child.classList.contains('json-row') && child !== row) {
        closingRow = child;
        break;
      }
    }

    if (children) {
      if (collapse) {
        toggle.textContent = '▶ ';
        children.style.display = 'none';
        if (closingRow) closingRow.style.display = 'none';
        if (preview) preview.style.display = '';
      } else {
        toggle.textContent = '▼ ';
        children.style.display = '';
        if (closingRow) closingRow.style.display = '';
        if (preview) preview.style.display = 'none';
      }
    }
  });
}

/**
 * Copy text to clipboard and show feedback
 * Uses execCommand fallback directly since Clipboard API is blocked in extension panels
 * @param {string} text - Text to copy
 * @param {HTMLElement} button - Button element to show feedback on
 */
function copyToClipboard(text, button) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    button.classList.add('copied');
    button.title = 'Copied!';
    setTimeout(() => {
      button.classList.remove('copied');
      button.title = 'Copy to clipboard';
    }, 1500);
  } catch (e) {
    // copy failed silently
  }
  document.body.removeChild(textarea);
}

/**
 * Create a toolbar with expand/collapse all buttons, annotate toggle, and copy button
 * @param {HTMLElement} jsonContainer - The json-viewer container to control
 * @param {Object} copyableData - Optional data object for copy functionality
 * @param {Object} options - Toolbar options
 * @param {string} options.platformId - Platform ID for lazy-loading descriptions
 * @param {Function} options.onAnnotateToggle - Callback when annotate mode is toggled (receives descriptions)
 * @param {boolean} options.hasDescriptions - Whether there are descriptions available for this platform
 * @returns {HTMLElement} The toolbar element
 */
function createJSONToolbar(jsonContainer, copyableData = null, options = {}) {
  const { platformId, onAnnotateToggle, hasDescriptions = false, onExpand = null } = options;

  const toolbar = document.createElement('div');
  toolbar.className = 'json-toolbar';

  const expandAllBtn = document.createElement('button');
  expandAllBtn.className = 'json-toolbar-btn';
  expandAllBtn.innerHTML = '<span class="json-toolbar-icon">+</span> Expand';
  expandAllBtn.title = 'Expand all';
  expandAllBtn.addEventListener('click', () => setAllCollapsed(jsonContainer, false));

  const collapseAllBtn = document.createElement('button');
  collapseAllBtn.className = 'json-toolbar-btn';
  collapseAllBtn.innerHTML = '<span class="json-toolbar-icon">−</span> Collapse';
  collapseAllBtn.title = 'Collapse all';
  collapseAllBtn.addEventListener('click', () => setAllCollapsed(jsonContainer, true));

  // Add labels toggle button FIRST if there are descriptions available
  if (hasDescriptions && onAnnotateToggle && platformId) {
    const labelsBtn = document.createElement('button');
    labelsBtn.className = 'json-toolbar-btn labels-btn';
    labelsBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg> Labels`;
    labelsBtn.title = 'Show parameter names';

    labelsBtn.addEventListener('click', async () => {
      const isActive = !labelsBtn.classList.contains('active');

      if (isActive) {
        // Lazy-load descriptions only when turning on labels
        labelsBtn.disabled = true;
        labelsBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
          <circle cx="12" cy="12" r="10"/>
        </svg> Loading...`;

        try {
          const descModule = await loadDescriptions();
          const descriptions = descModule.getParamDescriptions(platformId);
          labelsBtn.classList.add('active');
          labelsBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg> Labels`;
          onAnnotateToggle(true, descriptions);
        } catch (err) {
          // Failed to load descriptions, labels unavailable
          labelsBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg> Labels`;
        } finally {
          labelsBtn.disabled = false;
        }
      } else {
        // Turning off labels - no need to load anything
        labelsBtn.classList.remove('active');
        onAnnotateToggle(false, {});
      }
    });
    toolbar.appendChild(labelsBtn);
  }

  toolbar.appendChild(expandAllBtn);
  toolbar.appendChild(collapseAllBtn);

  // "Expand" — open this JSON in a tall modal. Icon-only to avoid clashing with
  // the "+ Expand" (expand-all) button above; carries margin-left:auto so it +
  // Copy cluster on the right (see .expand-modal-btn in panel.css).
  if (typeof onExpand === 'function') {
    const expandModalBtn = document.createElement('button');
    expandModalBtn.className = 'json-toolbar-btn expand-modal-btn';
    expandModalBtn.title = 'Expand — open in a larger window';
    expandModalBtn.setAttribute('aria-label', 'Expand JSON in a larger window');
    expandModalBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
      <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
    </svg>`;
    expandModalBtn.addEventListener('click', () => onExpand());
    toolbar.appendChild(expandModalBtn);
  }

  // Add copy button if data is provided
  if (copyableData !== null) {
    const copyBtn = document.createElement('button');
    copyBtn.className = 'json-toolbar-btn copy-btn';
    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>`;
    copyBtn.title = 'Copy to clipboard';
    copyBtn.addEventListener('click', () => {
      const jsonText = safeStringify(copyableData, { space: 2 });
      copyToClipboard(jsonText, copyBtn);
    });
    toolbar.appendChild(copyBtn);
  }

  return toolbar;
}

/**
 * Render JSON content (internal helper)
 * @param {*} data - The data to render
 * @param {Object} keyDescriptions - Key descriptions for tooltips/annotations
 * @param {boolean} showAnnotations - Whether to show inline annotations
 * @param {Set<string>} collapsedByDefault - Set of key names to collapse by default
 * @returns {HTMLElement} The json-content element
 */
function renderJSONContent(data, keyDescriptions, showAnnotations, collapsedByDefault = null) {
  const jsonContent = document.createElement('div');
  jsonContent.className = 'json-content';
  if (showAnnotations) {
    jsonContent.classList.add('annotated');
  }

  const rootRow = createJSONRow(null, data, 0, true, keyDescriptions, showAnnotations, collapsedByDefault);
  // Remove the null key prefix for root
  const firstKey = rootRow.querySelector('.json-key');
  if (firstKey && firstKey.textContent === 'null: ') {
    firstKey.remove();
  }
  jsonContent.appendChild(rootRow);

  return jsonContent;
}

/**
 * Render JSON data into a container
 * @param {HTMLElement} container - The container element
 * @param {*} data - The data to render
 * @param {Object} options - Rendering options
 * @param {boolean} options.showToolbar - Whether to show expand/collapse toolbar (default: true for objects with nested content)
 * @param {string} options.platformId - Platform ID for lazy-loading descriptions (e.g., 'ga4', 'facebook')
 * @param {Object} options.copyableData - Data object for copy functionality (defaults to data if not specified)
 * @param {string} options.sectionId - Unique ID to persist labels state across re-renders
 * @param {Set<string>} options.collapsedByDefault - Set of key names to collapse by default
 */
export function renderJSON(container, data, options = {}) {
  const sectionId = options.sectionId || null;
  const platformId = options.platformId || null;
  const collapsedByDefault = options.collapsedByDefault || null;

  // Preserve labels state from previous render (if sectionId provided)
  const previousLabelsState = sectionId ? labelsStateMap.get(sectionId) : null;

  container.innerHTML = '';
  container.className = 'json-viewer';

  // Use copyableData if provided, otherwise use data itself
  const copyableData = options.copyableData !== undefined ? options.copyableData : data;

  if (data === undefined || data === null) {
    const span = document.createElement('span');
    span.className = 'json-null';
    span.textContent = String(data);
    container.appendChild(span);
    return;
  }

  const type = getType(data);

  if (type === 'object' || type === 'array') {
    // Platforms that have descriptions available
    const SUPPORTED_PLATFORMS = ['ga4', 'sgtm', 'facebook', 'google-ads-conversion', 'tiktok', 'linkedin', 'amplitude', 'snapchat', 'adform'];
    const hasDescriptions = platformId && SUPPORTED_PLATFORMS.includes(platformId);

    // Restore previous labels state or default to false
    // previousLabelsState is { active: boolean, descriptions: Object } or null
    let showAnnotations = previousLabelsState?.active || false;
    let currentDescriptions = previousLabelsState?.descriptions || {};

    // Create initial JSON content with restored state
    let jsonContent = renderJSONContent(data, currentDescriptions, showAnnotations, collapsedByDefault);

    // Check if we should show toolbar (has nested objects/arrays)
    const hasNestedContent = jsonContent.querySelectorAll('.json-toggle').length > 0;
    const showToolbar = options.showToolbar !== undefined ? options.showToolbar : hasNestedContent;

    if (showToolbar && hasNestedContent) {
      // Create toolbar with labels toggle callback
      const toolbar = createJSONToolbar(jsonContent, copyableData, {
        platformId,
        hasDescriptions,
        onExpand: options.onExpand || null,
        onAnnotateToggle: (annotate, descriptions) => {
          showAnnotations = annotate;
          currentDescriptions = descriptions;
          // Save state for this section (if sectionId provided)
          if (sectionId) {
            labelsStateMap.set(sectionId, { active: showAnnotations, descriptions: currentDescriptions });
          }
          // Re-render the JSON content with new annotation state
          const newContent = renderJSONContent(data, currentDescriptions, showAnnotations, collapsedByDefault);
          jsonContent.replaceWith(newContent);
          jsonContent = newContent;
        }
      });

      // If labels were active, set the button to active state and trigger load
      if (showAnnotations && previousLabelsState?.descriptions) {
        const labelsBtn = toolbar.querySelector('.labels-btn');
        if (labelsBtn) {
          labelsBtn.classList.add('active');
        }
      }

      container.appendChild(toolbar);
    }

    container.appendChild(jsonContent);
  } else {
    const span = document.createElement('span');
    span.className = `json-${type}`;
    span.textContent = formatPrimitive(data);
    container.appendChild(span);
  }
}

/**
 * Clear labels state (call when switching to a different event)
 */
export function clearLabelsState() {
  labelsStateMap.clear();
}

// =============================================================================
// PROPERTY TABLE RENDERER
// A clean key/value table layout for human-readable parsed analytics data.
// Used instead of the JSON tree when data already has readable labels.
// =============================================================================

/**
 * Build a rows container from a flat key/value object
 * @param {Object} obj - Flat object of key/value pairs
 * @returns {HTMLElement} .prop-table-rows element
 */
function buildPropRows(obj, sorted = true) {
  const rows = document.createElement('div');
  rows.className = 'prop-table-rows';

  const entries = sorted ? Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)) : Object.entries(obj);
  for (const [key, value] of entries) {
    const row = document.createElement('div');
    row.className = 'prop-table-row';

    const keyEl = document.createElement('span');
    keyEl.className = 'prop-table-key';
    // Detect "Human Label (param_name)" pattern — render param hint in lighter grey
    const paramHintMatch = key.match(/^(.+?)\s+\(([^)]+)\)$/);
    if (paramHintMatch) {
      keyEl.textContent = paramHintMatch[1] + ' ';
      const hint = document.createElement('span');
      hint.className = 'prop-table-key-hint';
      hint.textContent = paramHintMatch[2];
      keyEl.appendChild(hint);
    } else {
      keyEl.textContent = key;
    }

    const valueEl = document.createElement('span');
    if (value === null || value === undefined) {
      valueEl.className = 'prop-table-value prop-table-null';
      valueEl.textContent = '—';
    } else if (Array.isArray(value)) {
      valueEl.className = 'prop-table-value prop-table-array';
      valueEl.textContent = safeStringify(value);
    } else {
      valueEl.className = 'prop-table-value';
      valueEl.textContent = String(value);
    }

    row.appendChild(keyEl);
    row.appendChild(valueEl);
    rows.appendChild(row);
  }

  return rows;
}

/**
 * Render data as a clean property table instead of a JSON tree.
 * Handles two shapes:
 *   - Nested: { "Group Name": { key: value, ... }, ... } → group headers + rows
 *   - Flat:   { key: value, ... }                        → rows only
 * @param {HTMLElement} container - Container element to render into
 * @param {Object} data - The data to render
 */
export function renderPropertyTable(container, data, { sorted = true } = {}) {
  container.innerHTML = '';
  container.className = 'prop-table-viewer';

  // Toolbar with copy button only (no expand/collapse — data is already flat)
  const toolbar = document.createElement('div');
  toolbar.className = 'prop-table-toolbar';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'json-toolbar-btn copy-btn';
  copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
  </svg>`;
  copyBtn.title = 'Copy to clipboard';
  copyBtn.addEventListener('click', () => {
    copyToClipboard(safeStringify(data, { space: 2 }), copyBtn);
  });
  toolbar.appendChild(copyBtn);
  container.appendChild(toolbar);

  // Detect nested (grouped) vs flat structure
  const isNested = data && typeof data === 'object' &&
    Object.values(data).some(v => v !== null && typeof v === 'object' && !Array.isArray(v));

  if (isNested) {
    for (const [groupName, groupData] of Object.entries(data)) {
      if (!groupData || typeof groupData !== 'object' || Object.keys(groupData).length === 0) continue;

      const group = document.createElement('div');
      group.className = 'prop-table-group';

      const header = document.createElement('div');
      header.className = 'prop-table-group-header';
      header.textContent = groupName;
      group.appendChild(header);
      group.appendChild(buildPropRows(groupData, sorted));
      container.appendChild(group);
    }
  } else {
    container.appendChild(buildPropRows(data, sorted));
  }
}
