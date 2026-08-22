// Event Detail Component
// Renders the detail view for a selected event with single-column collapsible layout

import { renderJSON, renderPropertyTable, clearLabelsState } from './json-viewer.js';
import { showJsonModal } from './json-modal.js';
import { getPlatformIcon } from './platform-icons.js';
import { MSG } from '../../shared/messages.js';
import { safeStringify } from '../../shared/json-safe.js';
import { SCRIPT_INITIATOR_ICONS } from './script-initiator-icons.js';
// Coordinator concerns injected by panel.js via initEventDetail() (#143).
// Replaces a 15-symbol back-import from ../panel.js with one explicit,
// mockable contract — the same deps-injection seam script-tree.js uses.
// Every callee reads state.* / coordinator-owned maps, opens a modal, or
// mutates state, so none can relocate out of the coordinator (see the
// feature spec's audit). Call sites read through `_deps.fn(...)`.
let _deps;

/**
 * Initialize the event-detail module with coordinator dependencies.
 * Must be called once at module-wiring time (panel.js init), before any
 * render or createAboutToolSection() call (the latter is reached from
 * stack-tool-detail.js outside the renderEventDetail path — hence init-time
 * wiring, not a per-render argument).
 * @param {Object} deps
 * @param {Function} deps.getCategoryInfo - Category icon/metadata for a platform id
 * @param {Function} deps.getInitiatorPlatformInfo - Platform info for an initiator URL
 * @param {Function} deps.getScriptsLoadedBy - Child scripts loaded by a script URL
 * @param {Function} deps.getPageHostname - Current page hostname
 * @param {Function} deps.openReportModalForEvent - Open the Report modal for an event
 * @param {Function} deps.openReportModalForConsent - Open the Report modal for a consent issue
 * @param {Function} deps.ignoreEndpoint - Add an endpoint to the ignore list
 * @param {Function} deps.getTealiumVendorInfo - Vendor info for a Tealium tag UID
 * @param {Function} deps.openToolsModalForCustomEndpoint - Open the Tools modal prefilled for a custom endpoint
 * @param {Function} deps.getConsentCheckForEvent - Consent verdict for an event
 * @param {Function} deps.getConsentFilterMode - Current consent filter mode
 * @param {Function} deps.getGCMCategoriesAtTime - GCM categories at a timestamp
 * @param {Function} deps.dismissFingerprintSuggestion - Dismiss a fingerprint suggestion
 * @param {Function} deps.setEventComment - Set/clear an event's user comment
 */
export function initEventDetail(deps) {
  _deps = deps;
}
import { reconstructConsentPath } from '../consent-engine.js';
import { escapeHtml } from '../escape-html.js';
import { getCMPCategoryName, GCM_SIGNAL_NAMES, normalizeGCMToCategories, getGCSConsentState, resolveGcmForDisplay, CMP_DETECTION_COVERAGE, isJavaScriptFileUrl, isSegmentSettingsUrl, isRudderStackSourceConfigUrl, isHightouchSourceConfigUrl, isMparticleConfigUrl, isGTMHealthPing } from '../../shared/detection/parsers/index.js';
import { KNOWN_TRACKING_ENDPOINTS, ENDPOINT_BY_ID, ENDPOINT_BY_NAME, detectCNAMETracking, matchKnownEndpoint, isGenericTrackingRequest, isSameRootDomain } from '../tracking-endpoints.js';
import { matchScriptLoad } from '../../shared/detection/script-patterns.js';
import { trackEvent, AMPLITUDE_API_HOSTNAMES } from '../analytics.js';
import { buildConsentDebugJSON } from '../copy-export.js';
import { extractSetCookies, extractSentCookies, buildUnifiedCookieList, buildUnifiedCookiesCopyData } from './cookie-detector.js';
import { createGTMInterceptButtons } from './gtm-intercept.js';
import { renderAISummarySection } from './ai-summary-section.js';
import { PATH_STAGES, groupDecisionPathByStage } from './detection-path-stages.js';
import {
  applyUserOrder,
  formattedSectionIdFromTitle,
  PINNED_SECTIONS,
  setDragging
} from './section-order.js';
import { getCachedSettings, persistEventDetailSectionOrder } from '../settings.js';

// Feature #113 helpers — used by each render path's descriptor list.
//
// _formattedIdFor: alias for formattedSectionIdFromTitle, kept local so
//   the inline call sites in render paths stay short.
//
// _appendOrderedSections: applies the user's stored section order
//   (from settings.lookAndFeel.eventDetailSectionOrder) to a list of
//   `{ id, present, render }` descriptors, then appends each present
//   descriptor's rendered element to the container in the final order.
//   Also wires the drag-and-drop handle on each non-pinned card so the
//   user can re-order via the four-dot grip on the right of any header.
function _formattedIdFor(title) {
  return formattedSectionIdFromTitle(title);
}

// ─── Section drag-and-drop state ───────────────────────────────────────────
// Mirrors the pinned-view DnD pattern from panel.js — a single module-level
// active-drag id, plus dragstart/dragover/drop/dragend on each card.
// `setDragging(true)` from section-order.js is also flipped on dragstart so
// any re-render triggered by an incoming event (panel.js → updateEventDetail)
// can short-circuit while the gesture is in flight.
let _draggingSectionId = null;

function _computeDropPosition(e, card) {
  const r = card.getBoundingClientRect();
  return e.clientY < r.top + r.height / 2 ? 'above' : 'below';
}

function _clearDropIndicators(container) {
  container.querySelectorAll('.detail-section-card.section-reorder-target').forEach((el) => {
    el.classList.remove('section-reorder-target');
    delete el.dataset.dropPosition;
  });
}

function _persistOrderFromDOM(container, action, movedSectionId, fromIdx, toIdx) {
  const cards = Array.from(container.querySelectorAll(':scope > .detail-section-card[data-section-id]'));
  const ids = cards
    .map((el) => el.getAttribute('data-section-id'))
    .filter((id) => id && !PINNED_SECTIONS.has(id));
  persistEventDetailSectionOrder(ids).catch(() => { /* best-effort */ });
  try {
    trackEvent('event_detail_section_reorder', {
      action,
      section_id: movedSectionId,
      from_index: fromIdx,
      to_index: toIdx,
      total_sections: cards.length
    });
  } catch (_) { /* analytics is best-effort */ }
}

// Build the four-dot vertical-grip SVG via DOM methods (no innerHTML so we
// satisfy the security-reminder hook — content is static so the risk is
// nil, but DOM construction is cheap here).
function _buildDragHandleSvg() {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 8 16');
  svg.setAttribute('width', '8');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  const dots = [
    [2, 3], [6, 3],
    [2, 7], [6, 7],
    [2, 11], [6, 11],
    [2, 15], [6, 15]
  ];
  for (const [cx, cy] of dots) {
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', String(cx));
    c.setAttribute('cy', String(cy));
    c.setAttribute('r', '1');
    svg.appendChild(c);
  }
  return svg;
}

function _attachDragHandle(card, sectionId, container) {
  // Pinned cards (Overview) get no handle and stay non-draggable.
  if (PINNED_SECTIONS.has(sectionId)) return;

  const header = card.querySelector(':scope > .detail-section-card-header');
  if (!header) return;

  const handle = document.createElement('span');
  handle.className = 'detail-section-drag-handle';
  handle.setAttribute('draggable', 'true');
  handle.setAttribute('role', 'button');
  handle.setAttribute('tabindex', '0');
  handle.setAttribute('aria-label', `Reorder ${sectionId} section`);
  handle.title = 'Drag to reorder · or focus + Space then ↑/↓';
  handle.appendChild(_buildDragHandleSvg());
  // Clicking the handle must not toggle the section's collapse state.
  handle.addEventListener('click', (e) => e.stopPropagation());
  header.appendChild(handle);

  // Drag source.
  handle.addEventListener('dragstart', (e) => {
    _draggingSectionId = sectionId;
    setDragging(true);
    card.classList.add('dragging');
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('application/x-section-id', sectionId); } catch (_) { /* defensive */ }
    }
  });

  handle.addEventListener('dragend', () => {
    _draggingSectionId = null;
    setDragging(false);
    card.classList.remove('dragging');
    _clearDropIndicators(container);
  });

  // Drop target — every non-Overview card. The dragover handler also lives
  // on the card so the visual indicator lights up wherever the cursor is.
  card.addEventListener('dragover', (e) => {
    if (!_draggingSectionId || _draggingSectionId === sectionId) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const pos = _computeDropPosition(e, card);
    card.classList.add('section-reorder-target');
    card.dataset.dropPosition = pos;
  });

  card.addEventListener('dragleave', (e) => {
    if (e.relatedTarget && card.contains(e.relatedTarget)) return;
    card.classList.remove('section-reorder-target');
    delete card.dataset.dropPosition;
  });

  card.addEventListener('drop', (e) => {
    if (!_draggingSectionId || _draggingSectionId === sectionId) return;
    e.preventDefault();
    const pos = card.dataset.dropPosition || _computeDropPosition(e, card);
    card.classList.remove('section-reorder-target');
    delete card.dataset.dropPosition;

    const draggedId = _draggingSectionId;
    const draggedCard = container.querySelector(`:scope > .detail-section-card[data-section-id="${CSS.escape(draggedId)}"]`);
    if (!draggedCard) return;

    const beforeCards = Array.from(container.querySelectorAll(':scope > .detail-section-card[data-section-id]'));
    const fromIdx = beforeCards.indexOf(draggedCard);

    if (pos === 'above') {
      container.insertBefore(draggedCard, card);
    } else {
      container.insertBefore(draggedCard, card.nextSibling);
    }

    const afterCards = Array.from(container.querySelectorAll(':scope > .detail-section-card[data-section-id]'));
    const toIdx = afterCards.indexOf(draggedCard);

    _persistOrderFromDOM(container, 'drag', draggedId, fromIdx, toIdx);
  });

  // Keyboard reorder — focus the handle, Space to enter grab mode, ↑/↓ to
  // move, Space again to commit, Esc to cancel.
  let _kbGrabbed = false;
  let _kbOriginalNextSibling = null;
  let _kbOriginalIndex = null;
  handle.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      e.stopPropagation();
      if (!_kbGrabbed) {
        _kbGrabbed = true;
        _kbOriginalNextSibling = card.nextSibling;
        const before = Array.from(container.querySelectorAll(':scope > .detail-section-card[data-section-id]'));
        _kbOriginalIndex = before.indexOf(card);
        card.classList.add('dragging');
        setDragging(true);
      } else {
        _kbGrabbed = false;
        card.classList.remove('dragging');
        setDragging(false);
        const after = Array.from(container.querySelectorAll(':scope > .detail-section-card[data-section-id]'));
        const toIdx = after.indexOf(card);
        if (toIdx !== _kbOriginalIndex) {
          _persistOrderFromDOM(container, 'keyboard', sectionId, _kbOriginalIndex, toIdx);
        }
        _kbOriginalNextSibling = null;
        _kbOriginalIndex = null;
      }
      return;
    }
    if (!_kbGrabbed) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (_kbOriginalNextSibling) {
        container.insertBefore(card, _kbOriginalNextSibling);
      } else {
        container.appendChild(card);
      }
      _kbGrabbed = false;
      card.classList.remove('dragging');
      setDragging(false);
      _kbOriginalNextSibling = null;
      _kbOriginalIndex = null;
      handle.focus();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = card.previousElementSibling;
      if (prev && prev.classList.contains('detail-section-card') && !PINNED_SECTIONS.has(prev.getAttribute('data-section-id'))) {
        container.insertBefore(card, prev);
        handle.focus();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = card.nextElementSibling;
      if (next && next.classList.contains('detail-section-card')) {
        container.insertBefore(card, next.nextSibling);
        handle.focus();
      }
      return;
    }
  });
}

function _appendOrderedSections(container, descriptors) {
  const settings = getCachedSettings();
  const userOrder = settings?.lookAndFeel?.eventDetailSectionOrder || [];
  const ordered = applyUserOrder(descriptors, userOrder);
  for (const desc of ordered) {
    if (!desc || desc.present === false) continue;
    const el = typeof desc.render === 'function' ? desc.render() : null;
    if (!el) continue;
    container.appendChild(el);
    if (!el.classList || !el.classList.contains('detail-section-card')) continue;

    // Feature #113: stamp data-section-id from the descriptor onto the
    // card if the inner builder didn't set it. This covers the helpers
    // that bypass createDataSection() and build the card directly
    // (AI Summary, About Tool, Script Dependencies, About CMP, etc.).
    // Without this, the drag handle wouldn't attach because the el
    // arrives without the attribute the drag wiring keys off.
    if (!el.getAttribute('data-section-id') && desc.id) {
      el.setAttribute('data-section-id', desc.id);
    }

    const sid = el.getAttribute('data-section-id');
    if (sid && !PINNED_SECTIONS.has(sid)) {
      _attachDragHandle(el, sid, container);
    }
  }
}
import { parseDataLayerInput } from './datalayer-input-parser.js';
import { createExpandableText, clearExpandedTextState } from './expandable-text.js';
import {
  getSectionExpandedState,
  saveSectionState,
  resetIfNewEvent,
} from './detail-section-state.js';

// Keys in raw request objects that are internal-only and hidden from the Raw Request display
// These contain data used by extension features (script initiator analysis, HAR export) but are noise for users
const RAW_REQUEST_HIDDEN_KEYS = new Set(['initiator', '_har']);

/**
 * Copy text to clipboard using fallback method (works in extension panels)
 * @param {string} text - Text to copy
 * @param {HTMLElement} element - Element to show feedback on
 */
function copyTextFallback(text, element) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    element.classList.add('copied');
    setTimeout(() => element.classList.remove('copied'), 1500);
  } catch (err) {
    // copy failed silently
  }
  document.body.removeChild(textarea);
}

// Collapsed/expanded state for sections in the detail view is shared
// across modules via `./detail-section-state.js` so the AI Summary
// section (which lives in its own file) can also persist its state
// across re-renders without a circular import.

/**
 * Check if data object is empty (no keys or all values are null/undefined)
 */
function isDataEmpty(data) {
  if (!data || typeof data !== 'object') return true;
  return Object.keys(data).length === 0;
}

/**
 * Check if raw request has meaningful data
 */
function hasRawData(raw) {
  if (!raw || typeof raw !== 'object') return false;
  return Object.keys(raw).length > 0;
}

/**
 * Filter raw request data for display, removing internal-only keys
 */
function filterRawForDisplay(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const filtered = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!RAW_REQUEST_HIDDEN_KEYS.has(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

/**
 * Create a collapsible data section (single-column layout)
 * @param {string} title - Section title
 * @param {Object|HTMLElement} data - Data object to render as JSON, or pre-rendered HTMLElement
 * @param {Object} options - Optional settings
 * @param {boolean} options.expanded - Whether section is expanded by default (default: true)
 * @param {string} options.platformId - Platform ID for lazy-loading param descriptions (e.g., 'ga4', 'facebook')
 * @param {Array<string>} options.tags - Optional tags to display after title (e.g., ['Decoded'])
 * @returns {HTMLElement} Collapsible section element
 */
function createDataSection(title, data, options = {}) {
  const { expanded: defaultExpanded = true, platformId = null, tags = [], tagClass = 'section-tag', tall = false, collapsedByDefault = null, displayMode = null, sortRows = true, headerActions = null, sectionId = null } = options;

  // Feature #113: prefer the stable sectionId as the state key when
  // the caller passed one (descriptor-based render paths do). Legacy
  // callers without sectionId keep title-keyed state, which is still
  // unique within a single event's detail view.
  const stateKey = sectionId || title;

  // Use saved state if available, otherwise use default
  const expanded = getSectionExpandedState(stateKey, defaultExpanded);

  const section = document.createElement('div');
  section.className = 'detail-section-card';
  if (sectionId) {
    // Stable id used by feature #113's drag-and-drop to identify the
    // card being moved. Inline collapsibles (e.g. _inline:*) and
    // pre-#113 callers omit this and aren't draggable.
    section.setAttribute('data-section-id', sectionId);
  }

  // Build tags HTML if any. Accept plain strings (use section-level tagClass) or
  // { label, className } objects (per-tag class — used to mix colours in one header,
  // e.g. green CMP-granted + yellow GCM-mismatch on the Consent section).
  const tagsHtml = tags.length > 0
    ? tags.map(tag => typeof tag === 'string'
        ? `<span class="${tagClass}">${escapeHtml(tag)}</span>`
        : `<span class="${escapeHtml(tag.className || tagClass)}">${escapeHtml(tag.label)}</span>`
      ).join('')
    : '';

  // Header with collapse toggle
  const header = document.createElement('div');
  header.className = `detail-section-card-header${expanded ? '' : ' collapsed'}`;
  header.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M6 9l6 6 6-6"/>
    </svg>
    <span>${escapeHtml(title)}</span>${tagsHtml}
  `;

  // Expand affordance: JSON-tree sections (object/array rendered as a tree, not
  // a property table or a pre-built element) get an "Expand" button in the JSON
  // toolbar — next to Copy — that opens the same tree in a tall modal, so large
  // payloads read without scrolling inside a cramped section. Opt out via
  // expandable: false. Wired into the renderJSON toolbar below.
  const isJsonTreeData = !(data instanceof HTMLElement)
    && data && typeof data === 'object'
    && Object.keys(data).length > 0
    && displayMode !== 'table';
  const showExpand = options.expandable !== false && isJsonTreeData;

  // Optional action buttons in the header (pushed to the right)
  if (headerActions) {
    const actionsWrapper = document.createElement('div');
    actionsWrapper.className = 'section-header-actions';
    // Stop clicks on action buttons from toggling section collapse
    actionsWrapper.addEventListener('click', (e) => e.stopPropagation());
    if (Array.isArray(headerActions)) {
      headerActions.forEach(btn => actionsWrapper.appendChild(btn));
    } else {
      actionsWrapper.appendChild(headerActions);
    }
    header.appendChild(actionsWrapper);
  }

  // Content area - use tall class for state/computed sections that need more height
  const contentWrapper = document.createElement('div');
  contentWrapper.className = `detail-section-card-content${expanded ? '' : ' collapsed'}${tall ? ' tall' : ''}`;

  // If data is already an HTMLElement, use it directly
  if (data instanceof HTMLElement) {
    contentWrapper.appendChild(data);
  } else if (data && typeof data === 'object' && Object.keys(data).length > 0) {
    if (displayMode === 'table') {
      // Render as clean property table (human-readable key/value layout)
      const tableContainer = document.createElement('div');
      renderPropertyTable(tableContainer, data, { sorted: sortRows });
      contentWrapper.appendChild(tableContainer);
    } else {
      // Render JSON data with copy support
      // Use title as sectionId to persist labels state across re-renders
      const jsonContainer = document.createElement('div');
      jsonContainer.className = 'json-viewer';
      renderJSON(jsonContainer, data, {
        platformId,
        copyableData: data,
        sectionId: title,
        collapsedByDefault,
        // Expand button in the JSON toolbar (next to Copy) — opens the same
        // tree in a tall modal. Only wired for expandable JSON-tree sections.
        onExpand: showExpand ? () => {
          showJsonModal(title, data, { platformId });
          trackEvent('event_detail_section_expand', { action: 'open', section: sectionId || null });
        } : null,
      });
      contentWrapper.appendChild(jsonContainer);
    }
  } else {
    // Empty state
    const emptyEl = document.createElement('span');
    emptyEl.className = 'empty-section';
    emptyEl.textContent = 'No data';
    contentWrapper.appendChild(emptyEl);
  }

  // Toggle collapse on header click
  header.addEventListener('click', () => {
    header.classList.toggle('collapsed');
    contentWrapper.classList.toggle('collapsed');
    // Save the new collapsed state (id-keyed for descriptor callers,
    // title-keyed for legacy callers — see stateKey above).
    saveSectionState(stateKey, header.classList.contains('collapsed'));
  });

  section.appendChild(header);
  section.appendChild(contentWrapper);

  return section;
}

/**
 * Format timestamp to readable time
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted time string (HH:MM:SS.mmm)
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Create an overview card (full width, card style)
 * @param {Object} data - Key-value data to display
 * @param {Object} options - Optional settings
 * @param {Object} options.event - Full event object for header display and matching viz
 * @param {Object} options.triggeredBy - GTM trigger info
 * @param {Object} options.rawData - Raw request data containing url, method, type
 * @param {Object} options.categoryInfo - Category info object with name and icon
 */
function createOverviewCard(data, options = {}) {
  const { event = null, triggeredBy = null, rawData = null, categoryInfo = null, consentSignals = null, tealiumVendor = null } = options;

  const card = document.createElement('div');
  card.className = 'detail-card detail-card-overview';

  // Build platform tag HTML if event has platform info (matches event-stream badges)
  let platformTagHtml = '';
  if (event?.platform) {
    const icon = getPlatformIcon(event.platform);
    const platformText = event.platformName || event.platform.toUpperCase();
    platformTagHtml = `<span class="event-platform ${event.platform}" data-platform="${event.platform}">${icon}<span class="platform-text">${escapeHtml(platformText)}</span></span>`;
  }

  // Build category tag HTML if available
  const categoryTagHtml = categoryInfo
    ? `<span class="overview-header-tag">${categoryInfo.icon}<span class="tag-label">${escapeHtml(categoryInfo.name)}</span></span>`
    : '';

  // Build custom endpoint badge if matched via user-defined custom endpoint
  let customBadgeHtml = '';
  if (event?.raw?.url) {
    const customMatchResult = matchKnownEndpoint(event.raw.url);
    if (customMatchResult?.isCustomMatch) {
      customBadgeHtml = '<span class="event-custom-badge">CUSTOM</span>';
    }
  }

  // Build intercept badge for GTM containers (BLOCKED / SWAPPED / PREVIEW)
  let interceptBadgeHtml = '';
  if (event?.formatted?.interceptAction) {
    const action = event.formatted.interceptAction;
    if (action === 'blocked') {
      interceptBadgeHtml = '<span class="event-intercept-badge blocked">BLOCKED</span>';
    } else if (action === 'replaced') {
      interceptBadgeHtml = '<span class="event-intercept-badge">SWAPPED</span>';
    } else if (action === 'swap_failed') {
      interceptBadgeHtml = '<span class="event-intercept-badge swap-failed">SWAP FAILED</span>';
    } else if (action === 'preview') {
      interceptBadgeHtml = '<span class="event-intercept-badge preview">PREVIEW</span>';
    }
  }

  // Build "via <proxy>" tag for events routed through a managed supplier
  // (Features #65, #77, #80). Resolution order:
  //   1. Generic `formatted.supplier` (Feature #80) — registry-driven, covers
  //      Stape + Addingwell + TAGGRS + any future entry
  //   2. Legacy `formatted.proxyHost === 'stape'` — pre-#80 Stape-only path
  //      preserved for events captured by older code paths still rolling out
  // Mirrors `.overview-header-tag` structure: optional SVG mark + uppercase label.
  let proxyTagHtml = '';
  const supplier = event?.formatted?.supplier;
  if (supplier && typeof supplier === 'object' && supplier.id) {
    if (supplier.id === 'stape') {
      // Stape's stylised "S" wordmark glyph — bold curved S in brand orange (#FF6D34)
      const stapeMark = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.4 7.2c-.5-1-1.5-1.8-2.8-2.3-1.3-.5-2.7-.6-4-.4-1.4.2-2.6.7-3.5 1.5-.9.8-1.4 1.8-1.4 2.9 0 1.1.5 2 1.4 2.7.9.7 2.1 1.2 3.5 1.5l2.4.5c1 .2 1.7.5 2.2.9.5.4.7.9.7 1.5 0 .8-.4 1.4-1.2 1.9-.8.4-1.8.7-3 .7-1.3 0-2.4-.2-3.3-.7-.9-.5-1.5-1.1-1.8-2L6 16.2c.5 1.1 1.4 2 2.7 2.6 1.3.6 2.8.9 4.5.9 1.7 0 3.2-.3 4.4-.9 1.2-.6 1.9-1.5 1.9-2.7 0-1.1-.5-2-1.4-2.7-.9-.7-2.1-1.2-3.5-1.5l-2.4-.5c-1-.2-1.8-.5-2.3-.9-.5-.4-.8-.9-.8-1.5 0-.7.4-1.3 1.1-1.7.7-.4 1.7-.6 2.8-.6 1.1 0 2 .2 2.7.6.7.4 1.2.9 1.5 1.6l1.7-.7z"/></svg>';
      proxyTagHtml = `<span class="event-proxy-tag stape" title="${supplier.tooltip || ''}">${stapeMark}<span class="tag-label">${supplier.label}</span></span>`;
    } else {
      // Generic supplier pill — brand colour inlined since each supplier has its own.
      // Icon is currently text-only for non-Stape suppliers (registry's `iconRef`
      // pointers to platform-icons.js will be wired in a follow-up CSS pass).
      const styleAttr = supplier.color ? ` style="color: ${supplier.color}; border-color: ${supplier.color}"` : '';
      proxyTagHtml = `<span class="event-proxy-tag supplier-${supplier.id}" title="${supplier.tooltip || ''}"${styleAttr}><span class="tag-label">${supplier.label}</span></span>`;
    }
  } else if (event?.formatted?.proxyHost === 'stape') {
    // Legacy fallback — pre-#80 events captured before the supplier registry
    // was wired in. New code paths always set `formatted.supplier`.
    const stapeMark = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.4 7.2c-.5-1-1.5-1.8-2.8-2.3-1.3-.5-2.7-.6-4-.4-1.4.2-2.6.7-3.5 1.5-.9.8-1.4 1.8-1.4 2.9 0 1.1.5 2 1.4 2.7.9.7 2.1 1.2 3.5 1.5l2.4.5c1 .2 1.7.5 2.2.9.5.4.7.9.7 1.5 0 .8-.4 1.4-1.2 1.9-.8.4-1.8.7-3 .7-1.3 0-2.4-.2-3.3-.7-.9-.5-1.5-1.1-1.8-2L6 16.2c.5 1.1 1.4 2 2.7 2.6 1.3.6 2.8.9 4.5.9 1.7 0 3.2-.3 4.4-.9 1.2-.6 1.9-1.5 1.9-2.7 0-1.1-.5-2-1.4-2.7-.9-.7-2.1-1.2-3.5-1.5l-2.4-.5c-1-.2-1.8-.5-2.3-.9-.5-.4-.8-.9-.8-1.5 0-.7.4-1.3 1.1-1.7.7-.4 1.7-.6 2.8-.6 1.1 0 2 .2 2.7.6.7.4 1.2.9 1.5 1.6l1.7-.7z"/></svg>';
    proxyTagHtml = `<span class="event-proxy-tag stape" title="Routed through Stape-hosted server-side GTM">${stapeMark}<span class="tag-label">via Stape</span></span>`;
  }

  // Build timestamp HTML
  const timestampHtml = event?.timestamp
    ? `<span class="overview-timestamp">${formatTimestamp(event.timestamp)}</span>`
    : '';

  // Get event name from event object
  const eventName = event?.eventName || 'Event';

  // Collapsibility (Feature #50): reuse the shared section-state module used
  // by every other collapsible card in the detail view. Keyed by title
  // 'Overview'. Default expanded. Uses the `persistent` scope so the user's
  // collapse choice follows them across event selections — Overview's shape
  // is identical for every event (BUG13).
  const overviewExpanded = getSectionExpandedState('Overview', true, { persistent: true });

  const header = document.createElement('div');
  header.className = `detail-card-header${overviewExpanded ? '' : ' collapsed'}`;
  header.innerHTML = `
    <div class="overview-header-left">
      <span class="overview-event-name">${escapeHtml(eventName)}</span>
      ${platformTagHtml}
      ${proxyTagHtml}
      ${categoryTagHtml}
      ${interceptBadgeHtml}
      ${customBadgeHtml}
    </div>
    <div class="overview-header-right">
      ${timestampHtml}
    </div>
  `;
  // Prepend collapse chevron as a DOM node (safer than injecting into innerHTML)
  const overviewChevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  overviewChevron.setAttribute('class', 'overview-chevron');
  overviewChevron.setAttribute('viewBox', '0 0 24 24');
  overviewChevron.setAttribute('fill', 'none');
  overviewChevron.setAttribute('stroke', 'currentColor');
  overviewChevron.setAttribute('stroke-width', '2');
  const chevronPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  chevronPath.setAttribute('d', 'M6 9l6 6 6-6');
  overviewChevron.appendChild(chevronPath);
  const headerLeft = header.querySelector('.overview-header-left');
  if (headerLeft) headerLeft.insertBefore(overviewChevron, headerLeft.firstChild);
  card.appendChild(header);

  const content = document.createElement('div');
  content.className = `detail-card-content${overviewExpanded ? '' : ' collapsed'}`;

  // Create inline key-value display
  const kvContainer = document.createElement('div');
  kvContainer.className = 'overview-kv';

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;

    const item = document.createElement('div');
    item.className = 'overview-kv-item';

    const keySpan = document.createElement('span');
    keySpan.className = 'overview-key';
    keySpan.textContent = `${key}: `;

    // Support DOM element values (e.g. platform badge + text for Source field)
    if (value instanceof Node) {
      item.appendChild(keySpan);
      item.appendChild(value);
    } else {
      const valueSpan = document.createElement('span');
      valueSpan.className = 'overview-value copyable';
      valueSpan.textContent = typeof value === 'object' ? safeStringify(value) : value;
      valueSpan.title = 'Click to copy';
      valueSpan.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        // Clear any text selection
        window.getSelection()?.removeAllRanges();
        const textToCopy = typeof value === 'object' ? safeStringify(value) : String(value);
        copyTextFallback(textToCopy, this);
      });

      item.appendChild(keySpan);
      item.appendChild(valueSpan);
    }
    kvContainer.appendChild(item);
  }

  content.appendChild(kvContainer);

  // Add request info if available (URL, Method, Type)
  if (rawData?.url) {
    const requestInfo = document.createElement('div');
    requestInfo.className = 'overview-request-info';

    // Request URL (full URL in title, truncated display)
    let displayUrl = rawData.url;
    try {
      const urlObj = new URL(rawData.url);
      displayUrl = urlObj.hostname + urlObj.pathname + (urlObj.search ? '...' : '');
    } catch (e) {
      // Keep original if parsing fails
    }

    // Build the request info line with Method, Type, and URL
    const method = rawData.method || 'GET';
    const type = rawData.type && rawData.type !== 'unknown' ? rawData.type : null;

    const methodEl = document.createElement('span');
    methodEl.className = `request-method ${method.toLowerCase()}`;
    methodEl.textContent = method;
    requestInfo.appendChild(methodEl);

    if (type) {
      requestInfo.appendChild(document.createTextNode(' '));
      const typeEl = document.createElement('span');
      typeEl.className = 'request-type';
      typeEl.textContent = type;
      requestInfo.appendChild(typeEl);
    }

    requestInfo.appendChild(document.createTextNode(' '));
    const urlEl = createExpandableText(rawData.url, displayUrl, {
      key: event?.id ? `${event.id}:request-url` : undefined,
    });
    urlEl.classList.add('request-url');
    requestInfo.appendChild(urlEl);
    content.appendChild(requestInfo);
  }

  // Add triggered by info if available
  if (triggeredBy) {
    const triggerInfo = document.createElement('div');
    triggerInfo.className = 'overview-trigger';
    // Support both old property names (gtmEventName) and new ones (dataLayerEventName) for backwards compatibility
    const eventName = triggeredBy.dataLayerEventName || triggeredBy.gtmEventName;
    const pushIndex = triggeredBy.dataLayerPushIndex || triggeredBy.gtmPushIndex;
    triggerInfo.innerHTML = `<span class="trigger-label">Triggered by Data Layer:</span> <span class="trigger-value">${escapeHtml(eventName)} (Push #${escapeHtml(String(pushIndex))}, +${escapeHtml(String(triggeredBy.timeDelta))}ms)</span>`;
    content.appendChild(triggerInfo);
  }

  // Add matching visualization (reconstructed at render time from event data)
  if (event?.raw?.url && event.platform) {
    const matchingViz = createMatchingViz(event);
    if (matchingViz) {
      content.appendChild(matchingViz);
    }
  }

  // Tealium vendor info — two-line block after matching viz, with separator
  if (tealiumVendor) {
    const vendorBlock = document.createElement('div');
    vendorBlock.className = 'overview-tealium-vendor';

    // Line 1: Vendor | Template ID (TID) | Confidence
    const line1 = document.createElement('div');
    line1.className = 'tealium-vendor-line';

    // Vendor (badge or text)
    if (tealiumVendor.platformId) {
      const vendorIcon = getPlatformIcon(tealiumVendor.platformId);
      const badge = document.createElement('span');
      badge.className = `event-platform ${tealiumVendor.platformId}`;
      badge.dataset.platform = tealiumVendor.platformId;
      badge.innerHTML = `${vendorIcon}<span class="platform-text">${escapeHtml(tealiumVendor.vendorCompact)}</span>`;
      line1.appendChild(badge);
    } else {
      const vendorText = document.createElement('span');
      vendorText.className = 'tealium-vendor-name';
      vendorText.textContent = tealiumVendor.vendorCompact || 'Unknown';
      line1.appendChild(vendorText);
    }

    if (tealiumVendor.tid) {
      const tidSpan = document.createElement('span');
      tidSpan.className = 'tealium-vendor-meta';
      tidSpan.textContent = `TID: ${tealiumVendor.tid}`;
      line1.appendChild(tidSpan);
    }
    if (tealiumVendor.confidence) {
      const confSpan = document.createElement('span');
      confSpan.className = 'tealium-vendor-meta';
      confSpan.textContent = tealiumVendor.confidence;
      line1.appendChild(confSpan);
    }
    vendorBlock.appendChild(line1);

    // Line 2: Evidence (smaller text)
    if (tealiumVendor.evidence) {
      const line2 = document.createElement('div');
      line2.className = 'tealium-vendor-evidence';
      line2.textContent = tealiumVendor.evidence;
      vendorBlock.appendChild(line2);
    }

    content.appendChild(vendorBlock);
  }

  // Consent chips — show unified consent categories for all events when available,
  // fall back to raw Google CM signals for Google-tagged events
  // Hidden entirely when consent filter is OFF
  if (_deps.getConsentFilterMode() !== 'off') {
    const check = _deps.getConsentCheckForEvent(event);
    const hasConsentSignals = consentSignals && consentSignals.length > 0;
    const hasUnifiedCategories = check && check.categories
      && check.status !== 'pre-consent' && check.status !== 'exempt';

    if (hasUnifiedCategories || hasConsentSignals) {
      const consentRow = document.createElement('div');
      consentRow.className = 'overview-consent';

      const label = document.createElement('span');
      label.className = 'consent-chips-label';
      label.textContent = 'Consent:';
      consentRow.appendChild(label);

      const chipsWrap = document.createElement('div');
      chipsWrap.className = 'consent-chips';

      if (hasUnifiedCategories) {
        // Unified categories from consent check system (works for ALL events)
        const categoryOrder = ['analytics', 'marketing', 'functional'];
        const categoryLabels = { analytics: 'analytics', marketing: 'marketing', functional: 'functional' };
        for (const cat of categoryOrder) {
          const catValue = check.categories[cat];
          const chip = document.createElement('span');
          const isRequired = check.category && cat === check.category;
          chip.className = `consent-chip ${catValue || 'not_set'}${isRequired ? ' required' : ''}`;
          chip.textContent = categoryLabels[cat];
          chip.title = catValue
            ? (isRequired ? `${cat}: ${catValue} (required for this tool)` : `${cat}: ${catValue}`)
            : `${cat}: not configured`;
          chipsWrap.appendChild(chip);
        }
      } else {
        // Fallback: raw Google CM signals (only for Google-tagged events)
        for (const signal of consentSignals) {
          const chip = document.createElement('span');
          const isRequired = check && check.category && GCM_SIGNAL_NAMES[check.category] === signal.name;
          chip.className = `consent-chip ${signal.state}${isRequired ? ' required' : ''}`;
          chip.textContent = signal.label;
          chip.title = isRequired
            ? `${signal.name} (required for this tool)`
            : signal.name;
          chipsWrap.appendChild(chip);
        }
      }

      consentRow.appendChild(chipsWrap);
      content.appendChild(consentRow);
    }
  }

  // Comment sub-section (Feature #50) — sits at the bottom of the overview card.
  // `event` may be null for a few fallback callers (pseudo-events in renderPageDetail,
  // interaction synth, etc.); only render the comment UI when we have a real event with an id.
  if (event && event.id) {
    content.appendChild(createOverviewCommentBlock(event));
  }

  card.appendChild(content);

  // Wire collapse toggle on header click. Stop-propagation on the copyable
  // value spans (already set at the span level) prevents accidental collapses
  // while click-to-copying; platform/category/intercept badges are display-only.
  header.addEventListener('click', (e) => {
    // Don't toggle if the user is inside the comment editor, textarea, or
    // clicking an action button — those live in `content`, not `header`, so
    // this guard is belt-and-braces.
    if (e.target.closest('.overview-comment')) return;
    const nowCollapsed = !header.classList.contains('collapsed');
    header.classList.toggle('collapsed', nowCollapsed);
    content.classList.toggle('collapsed', nowCollapsed);
    saveSectionState('Overview', nowCollapsed, { persistent: true });
  });

  return card;
}

/**
 * Create the Comment sub-section for the Overview card (Feature #50).
 * Three states:
 *   - empty  → pencil button that expands to the editor on click
 *   - filled → rendered comment text + Edit / Remove actions
 *   - edit   → textarea with Save / Cancel (and Remove when editing an existing comment)
 *
 * Data lives on event.userComment (in-memory only; cleared by clearEvents()).
 * Character cap: 2000. Paste that overflows is truncated with an inline warning.
 *
 * @param {Object} event - The event object (must have an id)
 * @returns {HTMLElement}
 */
function createOverviewCommentBlock(event) {
  const MAX_LEN = 2000;
  const COUNTER_WARN_THRESHOLD = Math.floor(MAX_LEN * 0.9); // 1800

  const wrap = document.createElement('div');
  wrap.className = 'overview-comment';

  /** @type {() => void} */
  let renderState;

  const pencilSvg = () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const p1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p1.setAttribute('d', 'M12 20h9');
    const p2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p2.setAttribute('d', 'M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z');
    svg.appendChild(p1);
    svg.appendChild(p2);
    return svg;
  };

  const renderEmpty = () => {
    wrap.replaceChildren();
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'overview-comment-add';
    btn.title = 'Add a comment (attached to JSON exports)';
    btn.appendChild(pencilSvg());
    const label = document.createElement('span');
    label.textContent = 'Add comment';
    btn.appendChild(label);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      renderEditor('');
    });
    wrap.appendChild(btn);
  };

  const renderFilled = () => {
    wrap.replaceChildren();

    // Filled state is a single inline row: text on the left (click to
    // edit), small × on the right (click to remove). No separate
    // actions row — comments are usually short, so an extra row of
    // buttons just adds visual noise.
    const row = document.createElement('div');
    row.className = 'overview-comment-text';
    row.title = 'Click to edit';

    const textSpan = document.createElement('span');
    textSpan.className = 'overview-comment-text-content';
    textSpan.textContent = event.userComment || '';
    row.appendChild(textSpan);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'overview-comment-remove-icon';
    removeBtn.title = 'Remove comment';
    removeBtn.setAttribute('aria-label', 'Remove comment');
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const previous = _deps.setEventComment(event.id, '');
      if (previous) {
        trackEvent('event_comment', { action: 'remove' });
      }
    });
    row.appendChild(removeBtn);

    row.addEventListener('click', (e) => {
      e.stopPropagation();
      renderEditor(event.userComment || '');
    });

    wrap.appendChild(row);
  };

  const renderEditor = (initialValue) => {
    wrap.replaceChildren();

    const editor = document.createElement('div');
    editor.className = 'overview-comment-editor';

    const ta = document.createElement('textarea');
    ta.className = 'overview-comment-textarea';
    ta.maxLength = MAX_LEN;
    ta.rows = 3;
    ta.placeholder = 'Add a note about this event — it\'ll be included in JSON exports. Click outside to save, Esc to discard.';
    ta.value = initialValue || '';
    // Stop propagation on textarea interactions so the header-collapse
    // listener never sees them (the comment block is inside `content`, not
    // `header`, but belt-and-braces).
    ta.addEventListener('click', (e) => e.stopPropagation());

    const counter = document.createElement('div');
    counter.className = 'overview-comment-counter';

    const warning = document.createElement('div');
    warning.className = 'overview-comment-warning';

    const updateCounter = () => {
      const len = ta.value.length;
      if (len >= COUNTER_WARN_THRESHOLD) {
        counter.textContent = `${len} / ${MAX_LEN}`;
        counter.classList.add('visible');
      } else {
        counter.textContent = '';
        counter.classList.remove('visible');
      }
    };

    ta.addEventListener('input', updateCounter);
    ta.addEventListener('paste', (e) => {
      // Compute what the final length would be after the paste, and if it
      // would overflow the cap, truncate rather than letting maxLength
      // silently drop characters without notice.
      const clipboard = e.clipboardData?.getData('text') ?? '';
      if (!clipboard) return;
      const start = ta.selectionStart ?? ta.value.length;
      const end = ta.selectionEnd ?? ta.value.length;
      const projected = ta.value.slice(0, start) + clipboard + ta.value.slice(end);
      if (projected.length > MAX_LEN) {
        e.preventDefault();
        ta.value = projected.slice(0, MAX_LEN);
        warning.textContent = `Pasted content was truncated to ${MAX_LEN} characters.`;
        warning.classList.add('visible');
        setTimeout(() => warning.classList.remove('visible'), 3000);
        updateCounter();
      }
    });

    // Auto-save on blur. Esc discards pending changes. No Save / Cancel
    // buttons — the textarea itself is the working draft, and clicking
    // anywhere outside (or pressing Tab) commits whatever is in it.
    let cancelled = false;
    let committed = false;

    const commit = () => {
      if (committed) return;
      committed = true;
      const value = ta.value.trim();
      const previous = event.userComment;
      if (value === (previous || '')) {
        // No change — just revert UI to its current persisted state.
        renderState();
        return;
      }
      if (!value) {
        // Cleared the field — treat as remove if there was a comment.
        if (previous) {
          _deps.setEventComment(event.id, '');
          trackEvent('event_comment', { action: 'remove' });
        } else {
          renderState();
        }
        return;
      }
      _deps.setEventComment(event.id, value);
      trackEvent('event_comment', { action: previous ? 'edit' : 'add' });
    };

    ta.addEventListener('blur', () => {
      if (cancelled) {
        cancelled = false;
        renderState();
        return;
      }
      commit();
    });

    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelled = true;
        ta.blur();
      }
    });

    const actions = document.createElement('div');
    actions.className = 'overview-comment-actions';

    if (event.userComment) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'overview-comment-btn remove';
      removeBtn.textContent = 'Remove';
      // mousedown.preventDefault keeps focus on the textarea so the blur
      // handler doesn't fire and race the remove. We then perform the
      // remove explicitly and re-render takes care of the UI.
      removeBtn.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
      });
      removeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        committed = true; // suppress any later blur-commit
        _deps.setEventComment(event.id, '');
        trackEvent('event_comment', { action: 'remove' });
      });
      actions.appendChild(removeBtn);
    }

    editor.appendChild(ta);
    editor.appendChild(counter);
    editor.appendChild(warning);
    if (actions.childNodes.length > 0) editor.appendChild(actions);
    wrap.appendChild(editor);

    updateCounter();
    // Auto-focus the textarea and move caret to end.
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }, 0);
  };

  renderState = () => {
    if (event.userComment) {
      renderFilled();
    } else {
      renderEmpty();
    }
  };

  renderState();
  return wrap;
}

/**
 * Escape HTML special characters
 */
/**
 * Get tool info from KNOWN_TRACKING_ENDPOINTS by platform ID
 * @param {string} platformId - The platform identifier (e.g., 'ga4', 'facebook')
 * @returns {Object|null} Tool info object or null if not found
 */
function getToolInfo(platformId) {
  if (!platformId) return null;
  return ENDPOINT_BY_ID.get(platformId) || null;
}

/**
 * Format detection pattern for display
 * @param {string|RegExp} pattern - Detection pattern
 * @returns {string} Formatted pattern string
 */
function formatPattern(pattern) {
  if (pattern instanceof RegExp) {
    return pattern.toString();
  }
  return pattern;
}

/**
 * Create an "About Tool" section with tool information
 * Shows detection patterns, description, and website link
 * @param {string} platformId - The platform identifier
 * @returns {HTMLElement|null} About tool section element or null if no tool info
 */
export function createAboutToolSection(platformId) {
  const toolInfo = getToolInfo(platformId);
  if (!toolInfo) return null;

  const sectionTitle = `About ${toolInfo.name}`;
  // Use saved state if available, otherwise default to collapsed (expanded = false)
  const expanded = getSectionExpandedState(sectionTitle, false);

  const section = document.createElement('div');
  section.className = 'detail-section-card';

  // Header with collapse toggle (collapsed by default)
  const header = document.createElement('div');
  header.className = `detail-section-card-header${expanded ? '' : ' collapsed'}`;
  header.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M6 9l6 6 6-6"/>
    </svg>
    <span>${escapeHtml(sectionTitle)}</span>
  `;

  // Content area
  const contentWrapper = document.createElement('div');
  contentWrapper.className = `detail-section-card-content${expanded ? '' : ' collapsed'}`;

  const content = document.createElement('div');
  content.className = 'about-tool-content';

  // Description
  if (toolInfo.description) {
    const descEl = document.createElement('div');
    descEl.className = 'about-tool-description';
    descEl.textContent = toolInfo.description;
    content.appendChild(descEl);
  }

  // Website link
  if (toolInfo.url) {
    const linkEl = document.createElement('div');
    linkEl.className = 'about-tool-link';
    const linkAnchor = document.createElement('a');
    linkAnchor.href = toolInfo.url;
    linkAnchor.target = '_blank';
    linkAnchor.rel = 'noopener noreferrer';
    linkAnchor.textContent = toolInfo.url;
    linkAnchor.addEventListener('click', () => {
      trackEvent('link_click', { feature: 'event_detail', link: toolInfo.url, tool: platformId, category: _deps.getCategoryInfo(platformId).id });
    });
    linkEl.appendChild(linkAnchor);
    content.appendChild(linkEl);
  }

  // Detection patterns
  if (toolInfo.patterns && toolInfo.patterns.length > 0) {
    const patternsEl = document.createElement('div');
    patternsEl.className = 'about-tool-patterns';

    const patternsLabel = document.createElement('div');
    patternsLabel.className = 'about-tool-patterns-label';
    patternsLabel.textContent = 'Detection Patterns:';
    patternsEl.appendChild(patternsLabel);

    const patternsList = document.createElement('ul');
    patternsList.className = 'about-tool-patterns-list';
    toolInfo.patterns.forEach(pattern => {
      const li = document.createElement('li');
      li.className = 'about-tool-pattern';
      li.textContent = formatPattern(pattern);
      patternsList.appendChild(li);
    });
    patternsEl.appendChild(patternsList);
    content.appendChild(patternsEl);
  }

  contentWrapper.appendChild(content);

  // Toggle collapse on header click and save state
  header.addEventListener('click', () => {
    const wasCollapsed = header.classList.contains('collapsed');
    header.classList.toggle('collapsed');
    contentWrapper.classList.toggle('collapsed');
    saveSectionState(sectionTitle, header.classList.contains('collapsed'));
    if (wasCollapsed) {
      trackEvent('about_tool', { action: 'open', tool: platformId, category: _deps.getCategoryInfo(platformId).id });
    }
  });

  section.appendChild(header);
  section.appendChild(contentWrapper);

  return section;
}

/**
 * Create a matching visualization showing how this event was detected.
 * Reconstructs the matching decision from URL + platform data at render time.
 * No changes to matching logic — purely a read-only reconstruction.
 * @param {Object} event - The event object
 * @returns {HTMLElement|null} Matching viz element or null
 */
function createMatchingViz(event) {
  const url = event?.raw?.url;
  const platformId = event?.platform;
  if (!url || !platformId) return null;

  // Parse URL for display
  let hostname = '';
  try {
    const urlObj = new URL(url);
    hostname = urlObj.hostname;
  } catch (e) {
    return null;
  }

  // Look up the platform in the registry
  const endpoint = ENDPOINT_BY_ID.get(platformId);

  // Check CNAME detection
  const pageHostname = _deps.getPageHostname();
  const cnameResult = pageHostname ? detectCNAMETracking(url, pageHostname) : null;
  const isCNAME = cnameResult?.isCNAME;

  // Determine detection type and build step rows
  const steps = [];
  let vizType = '';

  if (isCNAME) {
    // CNAME / first-party detection
    vizType = 'First-party';

    steps.push({
      label: 'Domain',
      value: `${hostname} (same root as page)`,
      className: 'step-cname'
    });
    steps.push({
      label: 'Signals',
      value: cnameResult.reason,
      detail: cnameResult.confidence,
      className: 'step-cname'
    });

    // If also matched a known endpoint pattern, show it
    if (endpoint) {
      const { pattern, type, index } = findMatchedPattern(endpoint, url);
      if (pattern) {
        steps.push({
          label: 'Pattern',
          value: pattern,
          detail: `${type} · ${index + 1} of ${endpoint.patterns.length}`,
          className: 'step-pattern',
          mono: true
        });
      }
    }
  } else if (endpoint) {
    // Known endpoint via URL pattern match
    vizType = 'URL Pattern';

    const { pattern, type, index } = findMatchedPattern(endpoint, url);
    if (pattern) {
      steps.push({
        label: 'Pattern',
        value: pattern,
        detail: `${type} · ${index + 1} of ${endpoint.patterns.length}`,
        className: 'step-pattern',
        mono: true
      });
    } else {
      // Couldn't reconstruct — fall back to detectedBy string
      steps.push({
        label: 'Match',
        value: event.formatted?.detectedBy || 'Known platform',
        className: 'step-generic'
      });
    }
  } else {
    // Generic / unknown tracking — use the original detectedBy string
    vizType = 'Generic';
    const detectedBy = event.formatted?.detectedBy;
    if (detectedBy) {
      steps.push({
        label: 'Match',
        value: detectedBy,
        className: 'step-generic'
      });
    }
  }

  if (steps.length === 0) return null;

  // Build DOM
  const container = document.createElement('div');
  container.className = 'matching-viz';

  // Header: "Detected by:" + type badge
  const header = document.createElement('div');
  header.className = 'matching-viz-header';
  header.innerHTML = `<span class="matching-viz-label">Detected by:</span> <span class="matching-viz-type ${isCNAME ? 'cname' : endpoint ? 'pattern' : 'generic'}">${escapeHtml(vizType)}</span>`;
  container.appendChild(header);

  // Step rows
  const stepsEl = document.createElement('div');
  stepsEl.className = 'matching-viz-steps';

  for (const step of steps) {
    const row = document.createElement('div');
    row.className = `matching-viz-step ${step.className || ''}`;

    const labelEl = document.createElement('span');
    labelEl.className = 'matching-viz-step-label';
    labelEl.textContent = step.label;

    const valueEl = document.createElement('span');
    valueEl.className = `matching-viz-step-value${step.mono ? ' mono' : ''}`;
    valueEl.textContent = step.value;

    row.appendChild(labelEl);
    row.appendChild(valueEl);

    if (step.detail) {
      const detailEl = document.createElement('span');
      detailEl.className = 'matching-viz-step-detail';
      detailEl.textContent = step.detail;
      row.appendChild(detailEl);
    }

    stepsEl.appendChild(row);
  }

  container.appendChild(stepsEl);

  // Add expandable detection path (subtle chevron after pattern info)
  const decisionPath = reconstructDecisionPath(event);
  if (decisionPath.length > 0) {
    // Expand toggle - small chevron at the end of the steps
    const expandToggle = document.createElement('span');
    expandToggle.className = 'matching-viz-expand';
    expandToggle.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;
    expandToggle.title = 'Show detection path';

    // Detection path content (collapsed by default, persists across re-renders)
    const detPathExpanded = getSectionExpandedState('_inline:detection-path', false);
    const pathContent = document.createElement('div');
    pathContent.className = `matching-viz-path${detPathExpanded ? '' : ' collapsed'}`;
    if (detPathExpanded) expandToggle.classList.add('expanded');

    // Stage-grouped rendering (#25 Phase A3): one summary row per stage,
    // failed multi-check stages expand to the full per-check list
    const stageGroups = groupDecisionPathByStage(decisionPath);
    const notReached = [];
    for (const group of stageGroups) {
      if (!group.stage) {
        // Synthetic fallback row ("Matched as <platform>") — render flat
        for (const s of group.steps) pathContent.appendChild(createDetectionPathStep(s));
        continue;
      }
      if (group.status === 'skipped') {
        notReached.push(group.label);
        continue;
      }
      pathContent.appendChild(createDetectionPathStageRow(group));
    }
    if (notReached.length > 0) {
      const row = document.createElement('div');
      row.className = 'detection-path-stage skipped';
      const icon = document.createElement('span');
      icon.className = 'detection-path-icon skipped';
      icon.textContent = '─';
      icon.title = 'Not reached';
      row.appendChild(icon);
      const labelEl = document.createElement('span');
      labelEl.className = 'detection-path-label';
      labelEl.textContent = `Not reached: ${notReached.join(' · ')}`;
      row.appendChild(labelEl);
      pathContent.appendChild(row);
    }

    // Toggle expand/collapse
    expandToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      pathContent.classList.toggle('collapsed');
      expandToggle.classList.toggle('expanded');
      saveSectionState('_inline:detection-path', pathContent.classList.contains('collapsed'));
    });

    // Add toggle to the last step row
    const lastStepRow = stepsEl.lastElementChild;
    if (lastStepRow) {
      lastStepRow.appendChild(expandToggle);
    }

    container.appendChild(pathContent);
  }

  return container;
}

/**
 * Find which pattern in an endpoint matched a URL.
 * Pure read-only re-test of patterns against the URL.
 * @param {Object} endpoint - Platform endpoint with .patterns array
 * @param {string} url - The request URL
 * @returns {{ pattern: string|null, type: string|null, index: number }}
 */
function findMatchedPattern(endpoint, url) {
  const urlLower = url.toLowerCase();
  for (let i = 0; i < endpoint.patterns.length; i++) {
    const p = endpoint.patterns[i];
    if (typeof p === 'string') {
      if (urlLower.includes(p.toLowerCase())) {
        return { pattern: p, type: 'string', index: i };
      }
    } else if (p instanceof RegExp) {
      if (p.test(url)) {
        return { pattern: p.toString(), type: 'regex', index: i };
      }
    }
  }
  return { pattern: null, type: null, index: -1 };
}

// =============================================================================
// DETECTION PATH VISUALIZATION
// Shows the full routing decision tree with ✓/✗ markers
// =============================================================================

/**
 * SS-GTM subdomain patterns for first-party GA4 detection
 */
const SST_SUBDOMAIN_PATTERNS = [
  /^(sst|gtm|tm|tag|tags|tracking|track|analytics|data|collect|metrics|measurement|m|t|s|pixel|px|trk|tr|ev|events?)$/i
];

/**
 * Check if hostname looks like an SS-GTM first-party subdomain
 */
function isSSTSubdomain(hostname, pageHostname) {
  if (!hostname || !pageHostname) return false;
  if (!isSameRootDomain(hostname, pageHostname)) return false;
  const subdomain = hostname.split('.')[0];
  return SST_SUBDOMAIN_PATTERNS.some(p => p.test(subdomain));
}

/**
 * Routing steps that mirror the routeRequest() if/else chain in request-handlers.js
 * Each step has: id, label, test function, optional detail function, optional children
 *
 * IMPORTANT: This array must match the exact order and logic of routeRequest() checks.
 * When adding a new hardcoded check to routeRequest(), add a corresponding step here.
 */
const ROUTING_STEPS = [
  // 1. GA4 /g/collect endpoint (path-based, works on any domain)
  {
    id: 'g-collect',
    label: '/g/collect endpoint',
    test: (url, hostname, pathname) => pathname.includes('/g/collect'),
    children: [
      {
        id: 'g-collect-google',
        label: 'Google domain → GA4',
        test: (url, hostname) => hostname.includes('google-analytics.com') || hostname.includes('analytics.google.com') || hostname.includes('googletagmanager.com'),
        platform: 'ga4'
      },
      {
        id: 'g-collect-sst',
        label: 'Same-domain + tracking subdomain → sGTM',
        test: (url, hostname, pathname, pageHostname) => isSSTSubdomain(hostname, pageHostname),
        platform: 'sgtm'
      },
      {
        id: 'g-collect-proxy',
        label: 'Other domain → GA4 (proxy)',
        test: () => true,
        platform: 'ga4'
      }
    ]
  },
  // 2. CNAME detection (non-GA4 first-party tracking)
  {
    id: 'cname-sst',
    label: 'CNAME detection → sGTM',
    test: (url, hostname, pathname, pageHostname) => {
      if (!pageHostname) return false;
      const result = detectCNAMETracking(url, pageHostname);
      return result?.isCNAME && result?.suggestedPlatform === 'sgtm';
    },
    platform: 'sgtm'
  },
  // 3. Google Consent Mode
  {
    id: 'google-ccm',
    label: 'Google Consent Mode',
    test: (url, hostname, pathname) =>
      url.includes('google.com/ccm/collect') || url.includes('google.com/ccm/form-data'),
    platform: 'google-ccm'
  },
  // 4. Amplitude
  {
    id: 'amplitude',
    label: 'Amplitude',
    test: (url, hostname) =>
      AMPLITUDE_API_HOSTNAMES.some(h => url.includes(h)) ||
      url.includes('amplitude.com/2/httpapi') ||
      url.includes('amplitude.com/batch'),
    platform: 'amplitude'
  },
  // 4b. Braze (rest.<cluster>.braze.com/api/ data-collection endpoint)
  {
    id: 'braze',
    label: 'Braze',
    test: (url) =>
      url.includes('.braze.com/api/') || url.includes('.braze.eu/api/'),
    platform: 'braze'
  },
  // 4c. Grafana Faro (frontend-observability collector)
  {
    id: 'grafana-faro',
    label: 'Grafana Faro',
    test: (url) => /faro-collector-[a-z0-9-]+\.grafana\.net/i.test(url),
    platform: 'grafana-faro'
  },
  // 5. Facebook Pixel
  {
    id: 'facebook',
    label: 'Facebook Pixel',
    test: (url) =>
      url.includes('facebook.com/tr') || url.includes('facebook.net/tr') || url.includes('facebook.com/fr/'),
    platform: 'facebook'
  },
  // 6. Google Ads Conversion
  {
    id: 'google-ads-conversion',
    label: 'Google Ads Conversion',
    test: (url) =>
      /\/pagead\/(?:conversion|viewthroughconversion|1p-conversion|conversion_async)\//.test(url),
    platform: 'google-ads-conversion'
  },
  // 7. Google Ads Remarketing
  {
    id: 'google-ads-remarketing',
    label: 'Google Ads Remarketing',
    test: (url) =>
      /\/pagead\/(?:landing|1p-user-list)(?:\/|$)/.test(url),
    platform: 'google-ads-remarketing'
  },
  // 8. TikTok Pixel
  {
    id: 'tiktok',
    label: 'TikTok Pixel',
    test: (url) =>
      url.includes('analytics.tiktok.com') || url.includes('tiktok.com/i18n/pixel'),
    platform: 'tiktok'
  },
  // 9. LinkedIn Insight Tag
  {
    id: 'linkedin',
    label: 'LinkedIn Insight',
    test: (url) =>
      url.includes('px.ads.linkedin.com') || url.includes('linkedin.com/px'),
    platform: 'linkedin'
  },
  // 10. Snapchat Pixel (skip JS files)
  {
    id: 'snapchat',
    label: 'Snapchat Pixel',
    test: (url) =>
      (url.includes('tr.snapchat.com') || url.includes('tr6.snapchat.com') ||
       url.includes('gcp.api.snapchat.com')) && !isJavaScriptFileUrl(url),
    platform: 'snapchat'
  },
  // 11. Salesforce Marketing Cloud
  {
    id: 'salesforce-marketing',
    label: 'Salesforce Marketing Cloud',
    test: (url) =>
      url.includes('collect.igodigital.com') || url.includes('.igodigital.com/collect') ||
      url.includes('evergage.com'),
    platform: 'salesforce-marketing'
  },
  // 12. PostHog API endpoints
  {
    id: 'posthog',
    label: 'PostHog',
    test: (url, hostname, pathname) => {
      if (!url.includes('.posthog.com/') && !url.includes('posthog.com/')) return false;
      try {
        const p = new URL(url).pathname.toLowerCase();
        return p === '/e' || p === '/e/' ||
               p.startsWith('/capture') || p.startsWith('/batch') ||
               p.startsWith('/flags') || p.startsWith('/decide') ||
               p.startsWith('/i/v0/e');
      } catch { return false; }
    },
    platform: 'posthog'
  },
  // 13. Mixpanel
  {
    id: 'mixpanel',
    label: 'Mixpanel',
    test: (url) =>
      url.includes('mixpanel.com/track') || url.includes('mixpanel.com/engage') || url.includes('mixpanel.com/import'),
    platform: 'mixpanel'
  },
  // 14. Piwik PRO (must come BEFORE Matomo)
  {
    id: 'piwik-pro',
    label: 'Piwik PRO',
    test: (url) =>
      url.includes('piwik.pro/ppms.php') || url.includes('piwik.pro/piwik.php'),
    platform: 'piwik-pro'
  },
  // 15. Matomo / Piwik
  {
    id: 'matomo',
    label: 'Matomo',
    test: (url) =>
      url.includes('/matomo.php') || url.includes('/piwik.php'),
    platform: 'matomo'
  },
  // 16. Segment CDN settings (destinations config — must come BEFORE Segment events check)
  {
    id: 'segment-settings',
    label: 'Segment CDN Settings',
    test: (url) => isSegmentSettingsUrl(url),
    platform: 'segment'
  },
  // 17. Segment
  {
    id: 'segment',
    label: 'Segment',
    test: (url) =>
      (url.includes('api.segment.io/') || url.includes('api.segment.com/') ||
       url.includes('events.segment.io/') || url.includes('events.segment.com/')) &&
      !url.includes('/analytics.js'),
    platform: 'segment'
  },
  // 18. RudderStack sourceConfig (destinations config — must come BEFORE RudderStack events check)
  {
    id: 'rudderstack-sourceconfig',
    label: 'RudderStack sourceConfig',
    test: (url) => isRudderStackSourceConfigUrl(url),
    platform: 'rudderstack'
  },
  // 19. RudderStack
  {
    id: 'rudderstack',
    label: 'RudderStack',
    test: (url) =>
      (url.includes('rudderstack.com/v1/') || url.includes('rudderlabs.com/v1/')) &&
      !url.includes('/rsa.min.js'),
    platform: 'rudderstack'
  },
  // 20. Hightouch sourceConfig (destinations config — must come BEFORE Hightouch events check)
  {
    id: 'hightouch-sourceconfig',
    label: 'Hightouch sourceConfig',
    test: (url) => isHightouchSourceConfigUrl(url),
    platform: 'hightouch'
  },
  // 21. Hightouch Events
  {
    id: 'hightouch',
    label: 'Hightouch',
    test: (url) =>
      url.includes('hightouch-events.com/v1/') || url.includes('events.hightouch.io/v1/'),
    platform: 'hightouch'
  },
  // 22. mParticle config (kits/pixels config — must come BEFORE mParticle events check)
  {
    id: 'mparticle-config',
    label: 'mParticle config',
    test: (url) => isMparticleConfigUrl(url),
    platform: 'mparticle'
  },
  // 23. mParticle
  {
    id: 'mparticle',
    label: 'mParticle',
    test: (url) =>
      (url.includes('mparticle.com') && !url.endsWith('.js')) ||
      /\/JS\/[a-z]{2}\d+-[0-9a-f]{16,}\/events/i.test(url),
    platform: 'mparticle'
  },
  // 24. Adobe Experience Platform (must come BEFORE Adobe Analytics — both on adobedc.net)
  {
    id: 'adobe-aep',
    label: 'Adobe Experience Platform',
    test: (url) =>
      url.includes('/ee/') && url.includes('adobedc.net'),
    platform: 'adobe-experience-platform'
  },
  // 25. Adobe Analytics
  {
    id: 'adobe-analytics',
    label: 'Adobe Analytics',
    test: (url, hostname, pathname) =>
      url.includes('/b/ss/') ||
      (url.includes('/i.gif') && (url.includes('2o7.net') || url.includes('omtrdc.net') || url.includes('adobedc.net'))),
    platform: 'adobe-analytics'
  },
  // 26. Adobe Analytics first-party (collect.* subdomain, excludes Tealium pattern)
  {
    id: 'adobe-analytics-firstparty',
    label: 'Adobe Analytics (first-party)',
    test: (url, hostname, pathname) => {
      try {
        const parsedUrl = new URL(url);
        if (!parsedUrl.hostname.startsWith('collect.') || !parsedUrl.pathname.endsWith('/i.gif')) return false;
        const isTealiumCollect = /^\/[^/]+\/[^/]+\/\d+\/i\.gif$/.test(parsedUrl.pathname);
        return !isTealiumCollect;
      } catch { return false; }
    },
    platform: 'adobe-analytics'
  },
  // 27. Tealium Collect (standard domains)
  {
    id: 'tealium-collect',
    label: 'Tealium Collect',
    test: (url) =>
      url.includes('collect.tealiumiq.com') ||
      url.includes('/vdata/i.gif') ||
      /collect-[a-z]+-\d+\.tealiumiq\.com/.test(url),
    platform: 'tealium-collect'
  },
  // 28. Tealium Collect first-party (CNAME: collect.domain.com/{account}/{profile}/{number}/i.gif)
  {
    id: 'tealium-collect-firstparty',
    label: 'Tealium Collect (first-party)',
    test: (url) => {
      try {
        const parsedUrl = new URL(url);
        return parsedUrl.hostname.startsWith('collect.') &&
               /^\/[^/]+\/[^/]+\/\d+\/i\.gif$/.test(parsedUrl.pathname);
      } catch { return false; }
    },
    platform: 'tealium-collect'
  },
  // 29. Adobe Target (Delivery API)
  {
    id: 'adobe-target',
    label: 'Adobe Target',
    test: (url) =>
      url.includes('.tt.omtrdc.net') ||
      url.includes('/rest/v1/delivery') ||
      url.includes('/rest/v2/batchmbox') ||
      url.includes('/mbox/json') ||
      url.includes('mboxedge'),
    platform: 'adobe-target'
  },
  // 30. Adobe Audience Manager (Demdex)
  {
    id: 'adobe-aam',
    label: 'Adobe Audience Manager',
    test: (url) => url.includes('demdex.net'),
    platform: 'adobe-audience-manager'
  },
  // 31. GTM Health Ping (gtm.js?gtg_health=1 — must come BEFORE plain gtm.js check)
  {
    id: 'gtm-health',
    label: 'GTM Health Ping',
    test: (url) => url.includes('googletagmanager.com/gtm.js') && isGTMHealthPing(url),
    platform: 'gtm-health'
  },
  // 32. GTM Script Load (standard + custom domain)
  {
    id: 'gtm-script',
    label: 'GTM Script Load',
    test: (url, hostname, pathname) =>
      (hostname.includes('googletagmanager.com') && pathname.includes('/gtm.js')) ||
      (!url.includes('googletagmanager.com') && /\.js/.test(url) && /[?&]id=GTM-/i.test(url)),
    platform: 'gtm'
  },
  // 33. GTAG Script Load (standard + custom domain)
  {
    id: 'gtag-script',
    label: 'GTAG Script Load',
    test: (url, hostname, pathname) =>
      (hostname.includes('googletagmanager.com') && pathname.includes('/gtag/js')) ||
      (!url.includes('googletagmanager.com') && (/\.js/.test(url) || /\/js[?&]/.test(url)) && /[?&]id=(G|AW|DC)-/i.test(url)),
    platform: 'gtag'
  },
  // 34. Known marketing/analytics script loads
  {
    id: 'known-script-load',
    label: 'Known Script Load',
    test: (url) => {
      const match = matchScriptLoad(url);
      return !!match;
    },
    detail: (url) => {
      const match = matchScriptLoad(url);
      return match?.name || null;
    },
    platform: null
  },
  // 35. GTM Analytics/Telemetry
  {
    id: 'gtm-analytics',
    label: 'GTM Telemetry',
    test: (url, hostname, pathname) =>
      hostname.includes('googletagmanager.com') &&
      (pathname.includes('/a?') || pathname.includes('/a/')),
    platform: 'gtm-analytics'
  },
  // 36. Bing / Microsoft UET
  {
    id: 'bing-ads',
    label: 'Bing / Microsoft UET',
    test: (url) =>
      url.includes('bat.bing.com') || url.includes('bat.r.msn.com') || url.includes('bing.com/action/0'),
    platform: 'bing-ads'
  },
  // 37. Twitter/X Pixel (skip JS files)
  {
    id: 'twitter-pixel',
    label: 'Twitter/X Pixel',
    test: (url) =>
      (url.includes('analytics.twitter.com') || url.includes('t.co/i/adsct')) && !isJavaScriptFileUrl(url),
    platform: 'twitter-pixel'
  },
  // 38. Pinterest Tag
  {
    id: 'pinterest',
    label: 'Pinterest Tag',
    test: (url) => url.includes('ct.pinterest.com'),
    platform: 'pinterest'
  },
  // 39. HubSpot tracking pixel
  {
    id: 'hubspot',
    label: 'HubSpot',
    test: (url) => url.includes('track.hubspot.com/__pt'),
    platform: 'hubspot'
  },
  // 40. Criteo OneTag (skip JS files)
  {
    id: 'criteo',
    label: 'Criteo OneTag',
    test: (url) =>
      (url.includes('dis.criteo.com') || url.includes('sslwidget.criteo.com') ||
       url.includes('.criteo.com/rm') || url.includes('cat.criteo.com')) && !isJavaScriptFileUrl(url),
    platform: 'criteo'
  },
  // 41. Snowplow
  {
    id: 'snowplow',
    label: 'Snowplow',
    test: (url) => {
      try {
        const parsedUrl = new URL(url);
        return parsedUrl.pathname.includes('/com.snowplowanalytics.snowplow/') ||
               (parsedUrl.pathname === '/i' && parsedUrl.searchParams.has('aid'));
      } catch { return false; }
    },
    platform: 'snowplow'
  },
  // 42. Optimizely
  {
    id: 'optimizely',
    label: 'Optimizely',
    test: (url) => url.includes('logx.optimizely.com/v1/events'),
    platform: 'optimizely'
  },
  // 43. Heap Analytics (skip JS files)
  {
    id: 'heap',
    label: 'Heap Analytics',
    test: (url) =>
      (url.includes('heap-api.com') || url.includes('heapanalytics.com/api') || url.includes('heap.io/api')) &&
      !isJavaScriptFileUrl(url),
    platform: 'heap'
  },
  // 44. Pendo (skip JS files)
  {
    id: 'pendo',
    label: 'Pendo',
    test: (url) =>
      (url.includes('data.pendo.io') || url.includes('app.pendo.io/data')) && !isJavaScriptFileUrl(url),
    platform: 'pendo'
  },
  // 45. Piano Analytics (skip JS files)
  {
    id: 'piano-analytics',
    label: 'Piano Analytics',
    test: (url) =>
      (url.includes('pa.piano.io') || url.includes('xiti.com') || url.includes('at-o.net')) && !isJavaScriptFileUrl(url),
    platform: 'piano-analytics'
  },
  // 46. Config-driven routing (known endpoint with parsing config, no custom parser)
  {
    id: 'known-endpoint',
    label: 'Known Platform (config-driven)',
    test: (url) => {
      const result = matchKnownEndpoint(url);
      return result?.matched && result?.endpoint?.parsing && !result?.endpoint?.parsing?.customParser;
    },
    detail: (url) => {
      const result = matchKnownEndpoint(url);
      return result?.endpoint?.name || null;
    },
    platform: null
  },
  // 47. Custom endpoint (user-defined)
  {
    id: 'custom-endpoint',
    label: 'Custom Endpoint',
    test: (url) => {
      const result = matchKnownEndpoint(url);
      return result?.matched && result?.endpoint?.isCustom;
    },
    detail: (url) => {
      const result = matchKnownEndpoint(url);
      return result?.endpoint?.name || null;
    },
    platform: null
  },
  // 48. Generic tracking detection (fallback)
  {
    id: 'generic-tracking',
    label: 'Generic Tracking Pattern',
    test: (url) => isGenericTrackingRequest(url),
    detail: (url, hostname, pathname) => pathname || null,
    platform: 'other'
  }
];

/**
 * Reconstruct the detection decision path for an event
 * Walks the ROUTING_STEPS in order, marking each as matched/failed/skipped
 * @param {Object} event - The event object
 * @returns {Array} Array of evaluated steps with status
 */
function reconstructDecisionPath(event) {
  const url = event?.raw?.url;
  if (!url) return [];

  let hostname = '';
  let pathname = '';
  try {
    const urlObj = new URL(url);
    hostname = urlObj.hostname;
    pathname = urlObj.pathname;
  } catch {
    return [];
  }

  const pageHostname = _deps.getPageHostname();
  const eventPlatform = event?.platform;
  const results = [];
  let foundMatch = false;

  for (const step of ROUTING_STEPS) {
    if (foundMatch) {
      // Steps after match are "skipped" (not reached)
      results.push({
        ...step,
        status: 'skipped',
        children: step.children?.map(child => ({ ...child, status: 'skipped' }))
      });
      continue;
    }

    const matched = step.test(url, hostname, pathname, pageHostname);

    if (matched) {
      foundMatch = true;
      const detail = step.detail ? step.detail(url, hostname, pathname, pageHostname) : null;

      // If step has children, evaluate which child matched
      if (step.children) {
        const evaluatedChildren = [];
        let childMatched = false;

        for (const child of step.children) {
          if (childMatched) {
            evaluatedChildren.push({ ...child, status: 'skipped' });
          } else {
            const childMatch = child.test(url, hostname, pathname, pageHostname);
            if (childMatch) {
              childMatched = true;
              const childDetail = child.detail ? child.detail(url, hostname, pathname, pageHostname) : null;
              evaluatedChildren.push({ ...child, status: 'matched', detail: childDetail });
            } else {
              evaluatedChildren.push({ ...child, status: 'failed' });
            }
          }
        }

        results.push({ ...step, status: 'matched', detail, children: evaluatedChildren });
      } else {
        results.push({ ...step, status: 'matched', detail });
      }
    } else {
      results.push({ ...step, status: 'failed' });
    }
  }

  // If no step matched but we have a platform, mark it as "matched by platform"
  if (!foundMatch && eventPlatform) {
    results.push({
      id: 'fallback',
      label: `Matched as ${eventPlatform}`,
      status: 'matched',
      platform: eventPlatform
    });
  }

  return results;
}

/**
 * Create a single step row in the detection path
 * @param {Object} step - Step object with status
 * @param {boolean} isChild - Whether this is a child step (indented)
 * @returns {HTMLElement} Step row element
 */
function createDetectionPathStep(step, isChild = false) {
  const row = document.createElement('div');
  row.className = `detection-path-step ${step.status}${isChild ? ' child' : ''}`;

  // Status icon
  const iconEl = document.createElement('span');
  iconEl.className = `detection-path-icon ${step.status}`;
  if (step.status === 'matched') {
    iconEl.textContent = '✓';
    iconEl.title = 'Matched';
  } else if (step.status === 'available') {
    iconEl.textContent = '✓';
    iconEl.title = 'Data available but higher-priority source won';
  } else if (step.status === 'failed') {
    iconEl.textContent = '✗';
    iconEl.title = 'Checked but not matched';
  } else {
    iconEl.textContent = '─';
    iconEl.title = 'Not reached';
  }
  row.appendChild(iconEl);

  // Indent for child steps
  if (isChild) {
    const indent = document.createElement('span');
    indent.className = 'detection-path-indent';
    indent.textContent = '└─';
    row.appendChild(indent);
  }

  // Label
  const labelEl = document.createElement('span');
  labelEl.className = 'detection-path-label';
  labelEl.textContent = step.label;
  row.appendChild(labelEl);

  // Detail (for matched, available, and failed steps with detail text).
  // Guard on typeof: failed ROUTING_STEPS entries still carry their raw
  // detail *function* (only matched steps get it invoked into a string) —
  // without the guard the function source leaks into the UI as text.
  if (typeof step.detail === 'string' && (step.status === 'matched' || step.status === 'available' || step.status === 'failed')) {
    const detailEl = document.createElement('span');
    detailEl.className = 'detection-path-detail';
    detailEl.textContent = step.status === 'failed' ? step.detail : `→ ${step.detail}`;
    row.appendChild(detailEl);
  }

  return row;
}

/**
 * Create a stage summary row for the Detection Path (#25 Phase A3).
 * Multi-check stages render one row ("✗ Platform-specific checks · 47 checks · none matched")
 * and expand on click to the full per-check list; the matched stage shows
 * the winning check inline. Single-check stages render as plain rows.
 * @param {Object} group - Stage group from groupDecisionPathByStage()
 * @returns {HTMLElement} Wrapper containing the stage row (+ hidden step list)
 */
function createDetectionPathStageRow(group) {
  const wrap = document.createElement('div');
  wrap.className = 'detection-path-stage-wrap';

  const isMulti = group.steps.length > 1;

  const row = document.createElement('div');
  row.className = `detection-path-stage ${group.status}${isMulti ? ' expandable' : ''}`;

  const icon = document.createElement('span');
  icon.className = `detection-path-icon ${group.status}`;
  icon.textContent = group.status === 'matched' ? '✓' : '✗';
  icon.title = group.status === 'matched' ? 'Matched in this stage' : 'Checked but not matched';
  row.appendChild(icon);

  const labelEl = document.createElement('span');
  labelEl.className = 'detection-path-label';
  labelEl.textContent = group.label;
  row.appendChild(labelEl);

  const summary = document.createElement('span');
  summary.className = 'detection-path-detail';
  if (group.status === 'matched') {
    const m = group.matchedStep;
    const detailStr = typeof m.detail === 'string' ? m.detail : null;
    const matchedChild = m.children?.find(c => c.status === 'matched');
    let text;
    if (isMulti) {
      // Winning check by name; /g/collect-style parents append the child verdict
      text = m.label;
      if (matchedChild) text += ` · ${matchedChild.label}`;
      else if (detailStr) text += ` — ${detailStr}`;
    } else {
      // Single-check stage: the label would duplicate the stage name, show the detail
      text = detailStr || 'matched';
    }
    summary.textContent = `→ ${text}`;
  } else {
    summary.textContent = isMulti
      ? `${group.steps.length} checks · none matched`
      : (PATH_STAGES[group.stage].failedHint || 'no match');
  }
  row.appendChild(summary);

  if (isMulti) {
    row.title = `Show the ${group.steps.length} individual checks`;
    const chevron = document.createElement('span');
    chevron.className = 'detection-path-stage-chevron';
    chevron.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 6l6 6-6 6"/></svg>`;
    row.appendChild(chevron);

    const stepsEl = document.createElement('div');
    stepsEl.className = 'detection-path-stage-steps collapsed';
    for (const s of group.steps) {
      stepsEl.appendChild(createDetectionPathStep(s));
      if (s.children) {
        for (const child of s.children) {
          stepsEl.appendChild(createDetectionPathStep(child, true));
        }
      }
    }

    row.addEventListener('click', (e) => {
      e.stopPropagation();
      stepsEl.classList.toggle('collapsed');
      row.classList.toggle('expanded');
    });

    wrap.appendChild(row);
    wrap.appendChild(stepsEl);
  } else {
    wrap.appendChild(row);
  }

  return wrap;
}

/**
 * Create a tree node element for the dependency tree
 * @param {Object} options - Node options
 * @param {string} options.platform - Platform ID
 * @param {string} options.platformName - Platform display name
 * @param {string} options.filename - Script filename
 * @param {string} options.fullUrl - Full URL for tooltip
 * @param {string} options.initiatorType - Type of initiator (website, tagmanager, script)
 * @param {boolean} options.isSelf - Whether this is the current script
 * @param {number} options.depth - Nesting depth (0, 1, 2)
 * @returns {HTMLElement} Tree node element
 */
function createTreeNode({ platform, platformName, filename, fullUrl, initiatorType, isSelf = false, depth = 0 }) {
  const node = document.createElement('div');
  node.className = `script-dep-tree-node depth-${depth}${isSelf ? ' self' : ''}`;

  // Indent based on depth
  if (depth > 0) {
    const indent = document.createElement('span');
    indent.className = 'script-dep-tree-indent';
    // Use tree branch character
    indent.innerHTML = depth === 1 ? '└─' : '└─';
    node.appendChild(indent);
  }

  // Initiator icon (for parent node showing how it loaded things)
  if (initiatorType && depth === 0) {
    const initiatorIcon = SCRIPT_INITIATOR_ICONS[initiatorType] || SCRIPT_INITIATOR_ICONS.unknown;
    const iconBadge = document.createElement('span');
    iconBadge.className = 'script-dep-tree-icon';
    iconBadge.innerHTML = initiatorIcon;
    iconBadge.title = initiatorType === 'website' ? 'HTML Parser' :
                      initiatorType === 'tagmanager' ? 'Tag Manager' :
                      initiatorType === 'script' ? 'Another Script' : 'Unknown';
    node.appendChild(iconBadge);
  }

  // Platform chip
  if (platform) {
    const platformChip = document.createElement('span');
    platformChip.className = `event-platform ${platform}`;
    platformChip.dataset.platform = platform;
    platformChip.innerHTML = `${getPlatformIcon(platform)}<span class="platform-text">${escapeHtml(platformName || platform.toUpperCase())}</span>`;
    node.appendChild(platformChip);
  }

  // Filename
  const filenameSpan = document.createElement('span');
  filenameSpan.className = 'script-dep-tree-filename';
  filenameSpan.textContent = filename;
  if (fullUrl) filenameSpan.title = fullUrl;
  node.appendChild(filenameSpan);

  // "This script" indicator for self
  if (isSelf) {
    const selfBadge = document.createElement('span');
    selfBadge.className = 'script-dep-tree-self-badge';
    selfBadge.textContent = '← this script';
    node.appendChild(selfBadge);
  }

  return node;
}

/**
 * Create visual Script Dependency section showing parent/children relationships as a tree
 * @param {Object} event - The script event
 * @returns {HTMLElement|null} Section element or null if no initiator data
 */
function createScriptDependencySection(event) {
  const formatted = event.formatted || {};
  const raw = event.raw || {};

  const initiatorType = formatted.initiatorType || raw.initiatorType;
  const initiatorUrl = formatted.initiatorUrl || raw.initiatorUrl;
  const scriptUrl = formatted.scriptUrl || raw.url;

  // Only show if we have initiator data
  if (!initiatorType) return null;

  const section = document.createElement('div');
  section.className = 'detail-section-card script-dependency-section';

  // Header
  const header = document.createElement('div');
  header.className = 'detail-section-card-header';
  header.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M6 9l6 6 6-6"/>
    </svg>
    <span>Script Dependencies</span>
  `;

  const content = document.createElement('div');
  content.className = 'detail-section-card-content script-dependency-content';

  // Create tree container
  const tree = document.createElement('div');
  tree.className = 'script-dep-tree';

  // Get current script info
  let currentFilename = 'script';
  try {
    const urlObj = new URL(scriptUrl);
    currentFilename = urlObj.pathname.split('/').pop() || urlObj.hostname;
  } catch (e) {
    currentFilename = scriptUrl || 'script';
  }

  // Get child scripts
  const childScripts = _deps.getScriptsLoadedBy(scriptUrl);

  // === Build the tree ===

  // Level 0: Parent/Initiator node
  if (initiatorType === 'website') {
    // Website/HTML parser as parent
    const parentNode = createTreeNode({
      platform: null,
      platformName: null,
      filename: 'HTML (page source)',
      fullUrl: null,
      initiatorType: 'website',
      isSelf: false,
      depth: 0
    });
    tree.appendChild(parentNode);
  } else if (initiatorUrl) {
    // Script as parent - try to get platform info
    const initiatorInfo = _deps.getInitiatorPlatformInfo(initiatorUrl);
    let parentFilename = initiatorUrl;
    try {
      const urlObj = new URL(initiatorUrl);
      parentFilename = urlObj.pathname.split('/').pop() || urlObj.hostname;
    } catch (e) {}

    const parentNode = createTreeNode({
      platform: initiatorInfo?.platform || null,
      platformName: initiatorInfo?.name || null,
      filename: parentFilename,
      fullUrl: initiatorUrl,
      initiatorType: initiatorType,
      isSelf: false,
      depth: 0
    });
    tree.appendChild(parentNode);
  }

  // Level 1: Current script (SELF) - always shown
  const selfNode = createTreeNode({
    platform: event.platform,
    platformName: event.platformName,
    filename: currentFilename,
    fullUrl: scriptUrl,
    initiatorType: null,
    isSelf: true,
    depth: 1
  });
  tree.appendChild(selfNode);

  // Level 2: Child scripts that THIS script loads
  if (childScripts.length > 0) {
    const maxShow = 5;
    const allExpanded = getSectionExpandedState('_inline:script-deps-show-all', false);
    const toShow = (childScripts.length > maxShow && !allExpanded) ? childScripts.slice(0, maxShow) : childScripts;

    const renderChildNode = (child) => {
      const childUrl = child.formatted?.scriptUrl || child.raw?.url;
      let childFilename = 'script';
      try {
        const urlObj = new URL(childUrl);
        childFilename = urlObj.pathname.split('/').pop() || urlObj.hostname;
      } catch (e) {
        childFilename = childUrl || 'script';
      }
      return createTreeNode({
        platform: child.platform,
        platformName: child.platformName,
        filename: childFilename,
        fullUrl: childUrl,
        initiatorType: null,
        isSelf: false,
        depth: 2
      });
    };

    toShow.forEach(child => tree.appendChild(renderChildNode(child)));

    if (childScripts.length > maxShow && !allExpanded) {
      const moreNode = document.createElement('div');
      moreNode.className = 'script-dep-tree-node depth-2 more';
      const indent = document.createElement('span');
      indent.className = 'script-dep-tree-indent';
      indent.textContent = '\u2514\u2500';
      moreNode.appendChild(indent);
      const moreText = document.createElement('span');
      moreText.className = 'script-dep-tree-more script-dep-tree-show-all';
      moreText.textContent = `and ${childScripts.length - maxShow} more...`;
      moreText.title = 'Show all scripts';
      moreNode.appendChild(moreText);
      tree.appendChild(moreNode);

      moreText.addEventListener('click', () => {
        saveSectionState('_inline:script-deps-show-all', false); // false = not collapsed = expanded
        tree.removeChild(moreNode);
        childScripts.slice(maxShow).forEach(child => tree.appendChild(renderChildNode(child)));
      });
    }
  }

  content.appendChild(tree);

  // Restore collapsed state across re-renders
  const depExpanded = getSectionExpandedState('Script Dependencies', true);
  if (!depExpanded) {
    header.classList.add('collapsed');
    content.classList.add('collapsed');
  }

  // Toggle collapse
  header.addEventListener('click', () => {
    header.classList.toggle('collapsed');
    content.classList.toggle('collapsed');
    saveSectionState('Script Dependencies', header.classList.contains('collapsed'));
  });

  section.appendChild(header);
  section.appendChild(content);

  return section;
}

/**
 * Render Script Load event detail
 * Shows information about a loaded script (GTM, GTAG, Trustpilot, etc.)
 * Includes initiator data showing how/what loaded this script
 */
function renderScriptLoadDetail(event) {
  const container = document.createElement('div');
  container.className = 'detail-layout';

  const formatted = event.formatted || {};
  const raw = event.raw || {};

  // Feature #113: build descriptor list, then apply user order.
  const descriptors = [];

  // Build overview data based on platform
  const overviewData = {
    'Type': 'Script Load'
  };

  // Platform-specific overview fields
  if (event.platform === 'gtm') {
    overviewData['Container ID'] = formatted.containerId || 'Unknown';
    if (formatted.containerData?.version != null && !/^QUICK_PREVIEW/i.test(formatted.containerData.version)) {
      overviewData['Version'] = `v${formatted.containerData.version}`;
    }
    if (formatted.dataLayerName && formatted.dataLayerName !== 'dataLayer') {
      overviewData['dataLayer Name'] = formatted.dataLayerName;
    }
    if (formatted.gtmAuth) {
      overviewData['Environment'] = 'Preview/Debug';
    }
  } else if (event.platform === 'gtag') {
    overviewData['Measurement ID'] = formatted.measurementId || 'Unknown';
    if (formatted.dataLayerName && formatted.dataLayerName !== 'dataLayer') {
      overviewData['dataLayer Name'] = formatted.dataLayerName;
    }
  } else if (event.platform === 'tealium' && formatted.tealiumTagUid) {
    overviewData['Tag UID'] = formatted.tealiumTagUid;
  } else {
    if (raw.params) {
      const idFields = ['id', 'account', 'account_id', 'site_id', 'pixel_id', 'container_id'];
      for (const field of idFields) {
        if (raw.params[field]) {
          overviewData['ID'] = raw.params[field];
          break;
        }
      }
    }
  }

  if (raw.statusCode) overviewData['Status'] = raw.statusCode;
  if (raw.responseSize) overviewData['Size'] = formatBytes(raw.responseSize);
  if (raw.duration) overviewData['Load Time'] = `${Math.round(raw.duration)}ms`;

  let tealiumVendor = null;
  if (event.platform === 'tealium' && formatted.tealiumTagUid) {
    const vendorInfo = _deps.getTealiumVendorInfo(formatted.tealiumTagUid);
    tealiumVendor = vendorInfo || { vendorCompact: 'Unknown', tid: null, confidence: null, evidence: null, platformId: null };
  }

  const categoryInfo = _deps.getCategoryInfo(event.platform);
  const overviewEl = createOverviewCard(overviewData, {
    event,
    rawData: raw,
    categoryInfo,
    tealiumVendor
  });
  descriptors.push({ id: 'overview', present: true, render: () => overviewEl });

  // AI Summary section (collapsed by default)
  const aiSummary = renderAISummarySection(event);
  if (aiSummary) {
    descriptors.push({ id: 'ai-summary', present: true, render: () => aiSummary });
  }

  // About Tool section (collapsed by default)
  const aboutSection = createAboutToolSection(event.platform);
  if (aboutSection) {
    descriptors.push({ id: 'about-tool', present: true, render: () => aboutSection });
  }

  // Script Dependencies section
  const dependencySection = createScriptDependencySection(event);
  if (dependencySection) {
    descriptors.push({ id: 'script-dependencies', present: true, render: () => dependencySection });
  }

  // Container Contents section (GTM only)
  if (event.platform === 'gtm' && formatted.containerData) {
    const ccEl = createContainerContentsSection(formatted.containerData, formatted.containerId);
    descriptors.push({ id: 'container-info', present: true, render: () => ccEl });
  }

  // CDP destinations — Segment / RudderStack / Hightouch / mParticle
  if (event.platform === 'segment' && Array.isArray(formatted.segmentDestinations)) {
    const cdpSection = createCdpDestinationsSection(formatted.segmentDestinations, 'Segment');
    if (cdpSection) descriptors.push({ id: 'cdp-destinations', present: true, render: () => cdpSection });
  }
  if (event.platform === 'rudderstack' && Array.isArray(formatted.rudderstackDestinations)) {
    const cdpSection = createCdpDestinationsSection(formatted.rudderstackDestinations, 'RudderStack');
    if (cdpSection) descriptors.push({ id: 'cdp-destinations', present: true, render: () => cdpSection });
  }
  if (event.platform === 'hightouch' && Array.isArray(formatted.hightouchDestinations)) {
    const cdpSection = createCdpDestinationsSection(formatted.hightouchDestinations, 'Hightouch');
    if (cdpSection) descriptors.push({ id: 'cdp-destinations', present: true, render: () => cdpSection });
  }
  if (event.platform === 'mparticle' && Array.isArray(formatted.mparticleDestinations)) {
    const cdpSection = createCdpDestinationsSection(formatted.mparticleDestinations, 'mParticle');
    if (cdpSection) descriptors.push({ id: 'cdp-destinations', present: true, render: () => cdpSection });
  }
  // Adobe Launch published library
  if (event.platform === 'adobe-launch' && formatted.containerData?.extensions) {
    const launchSection = createAdobeLaunchExtensionsSection(formatted.containerData);
    if (launchSection) descriptors.push({ id: 'adobe-launch-extensions', present: true, render: () => launchSection });
  }
  // Adobe Web SDK / alloy.js destinations
  if (event.platform === 'adobe-experience-platform' && Array.isArray(formatted.aepDestinations)) {
    const aepSection = createAepDestinationsSection(formatted.aepDestinations);
    if (aepSection) descriptors.push({ id: 'aep-destinations', present: true, render: () => aepSection });
  }

  // Configuration section - show all URL parameters
  const hasParams = raw.params && Object.keys(raw.params).length > 0;
  if (hasParams) {
    const paramsEl = createDataSection('Script Parameters', raw.params, { sectionId: 'script-parameters' });
    descriptors.push({ id: 'script-parameters', present: true, render: () => paramsEl });
  }

  // GTM-specific: Environment details
  if (event.platform === 'gtm' && (formatted.gtmAuth || formatted.gtmPreview)) {
    const envData = {};
    if (formatted.gtmAuth) envData['gtm_auth'] = formatted.gtmAuth;
    if (formatted.gtmPreview) envData['gtm_preview'] = formatted.gtmPreview;
    if (formatted.gtmCookiesWin) envData['gtm_cookies_win'] = formatted.gtmCookiesWin;
    const gtmEnvEl = createDataSection('GTM Environment', envData, { sectionId: 'gtm-environment' });
    descriptors.push({ id: 'gtm-environment', present: true, render: () => gtmEnvEl });
  }

  // Cookies section
  const unifiedCookiesScript = buildUnifiedCookieList(extractSetCookies(event), extractSentCookies(event));
  if (unifiedCookiesScript.length > 0) {
    const cookieContentScript = buildEditableCookieContent(unifiedCookiesScript, event);
    const cookieButtonsScript = createCookieHeaderButtons(unifiedCookiesScript, event, cookieContentScript);
    const cookieSectionScript = createDataSection(
      buildCookieSectionTitle(unifiedCookiesScript),
      cookieContentScript,
      { expanded: false, headerActions: cookieButtonsScript, tags: buildCookieNameTags(unifiedCookiesScript), tagClass: 'cookie-name-chip', sectionId: 'cookies' }
    );
    cookieSectionScript.classList.add('cookie-detection-ui');
    descriptors.push({ id: 'cookies', present: true, render: () => cookieSectionScript });
  }

  // Request Details section — expand if no Script Parameters
  const expandRaw = !hasParams && hasRawData(raw);
  const requestDetailsEl = createDataSection('Request Details', raw, { expanded: expandRaw, sectionId: 'raw-request' });
  descriptors.push({ id: 'raw-request', present: true, render: () => requestDetailsEl });

  _appendOrderedSections(container, descriptors);
  return container;
}

/**
 * Build the Container Contents section for GTM script load detail views.
 * Layout matches GTM Hub: Quick Actions → Container Info (stats grid) → Event Names (collapsible).
 */
function createContainerContentsSection(cd, containerId) {
  const activeTags = cd.tagCount - cd.pausedCount;
  const wrapper = document.createElement('div');

  // Quick Actions — Block / Swap (same layout as GTM Hub)
  if (containerId) {
    const actionsHeading = document.createElement('div');
    actionsHeading.className = 'gtm-hub-sub-heading';
    actionsHeading.textContent = 'Quick Actions';
    wrapper.appendChild(actionsHeading);

    const actionBar = document.createElement('div');
    actionBar.className = 'gtm-hub-action-bar gtm-hub-action-bar--prominent';
    const pageHostname = _deps.getPageHostname();
    // Pass wrapper as formTarget so inline forms appear below the action bar (like GTM Hub)
    const interceptButtons = createGTMInterceptButtons(containerId, pageHostname, wrapper);
    interceptButtons.forEach(btn => actionBar.appendChild(btn));
    wrapper.appendChild(actionBar);
  }

  // Container Info heading
  const infoHeading = document.createElement('div');
  infoHeading.className = 'gtm-hub-sub-heading';
  infoHeading.style.marginTop = containerId ? '14px' : '0';
  infoHeading.textContent = 'Container Info';
  wrapper.appendChild(infoHeading);

  // Stats grid — big numbers like GTM Hub
  const statsGrid = document.createElement('div');
  statsGrid.className = 'gtm-hub-stats-grid';
  const stats = [
    { label: 'Tags', value: activeTags },
    { label: 'Variables', value: cd.macroCount },
    { label: 'Triggers', value: cd.predicateCount }
  ];
  if (cd.pausedCount > 0) stats.push({ label: 'Paused', value: cd.pausedCount });
  for (const { label, value } of stats) {
    const stat = document.createElement('div');
    stat.className = 'gtm-hub-stat';
    const num = document.createElement('span');
    num.className = 'gtm-hub-stat-value';
    num.textContent = String(value);
    const lbl = document.createElement('span');
    lbl.className = 'gtm-hub-stat-label';
    lbl.textContent = label;
    stat.appendChild(num);
    stat.appendChild(lbl);
    statsGrid.appendChild(stat);
  }
  wrapper.appendChild(statsGrid);

  // Event names — collapsible, collapsed by default (matches GTM Hub)
  if (cd.tagsByEvent?.length > 0) {
    const eventDetails = document.createElement('details');
    eventDetails.className = 'gtm-hub-event-names-details';

    const eventSummary = document.createElement('summary');
    eventSummary.className = 'gtm-hub-event-names-summary';

    const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('class', 'gtm-hub-event-names-chevron');
    chevron.setAttribute('width', '12');
    chevron.setAttribute('height', '12');
    chevron.setAttribute('viewBox', '0 0 24 24');
    chevron.setAttribute('fill', 'none');
    chevron.setAttribute('stroke', 'currentColor');
    chevron.setAttribute('stroke-width', '2');
    const chevronPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    chevronPath.setAttribute('d', 'M9 18l6-6-6-6');
    chevron.appendChild(chevronPath);
    eventSummary.appendChild(chevron);

    const summaryText = document.createElement('span');
    summaryText.textContent = `Event Names (${cd.tagsByEvent.length})`;
    eventSummary.appendChild(summaryText);
    eventDetails.appendChild(eventSummary);

    const eventContent = document.createElement('div');
    eventContent.className = 'gtm-hub-event-names-content';

    // Info box — same wording as GTM Hub
    const infoBox = document.createElement('div');
    infoBox.className = 'gtm-hub-info-box';
    infoBox.textContent = 'Only events from tags that use the standard Event Name field are listed here (e.g. GA4, Amplitude, Mixpanel). Tags with dynamic values, custom templates, or non-standard event fields may not appear.';
    eventContent.appendChild(infoBox);

    const list = document.createElement('div');
    list.className = 'gtm-hub-event-list';
    for (const ev of cd.tagsByEvent) {
      const item = document.createElement('div');
      item.className = 'gtm-hub-event-item';
      const nameEl = document.createElement('span');
      nameEl.className = 'gtm-hub-event-name';
      nameEl.textContent = ev.name;
      item.appendChild(nameEl);
      if (ev.paused > 0) {
        const pausedEl = document.createElement('span');
        pausedEl.className = 'gtm-hub-event-paused';
        pausedEl.textContent = ev.paused === ev.total ? '\u23f8 Paused' : `\u23f8 ${ev.paused} paused`;
        item.appendChild(pausedEl);
      }
      list.appendChild(item);
    }
    eventContent.appendChild(list);
    eventDetails.appendChild(eventContent);
    wrapper.appendChild(eventDetails);
  }

  // Copy button inside the section — top-right, includes stats and event names
  const copyData = { 'Active Tags': String(activeTags), 'Variables': String(cd.macroCount), 'Triggers': String(cd.predicateCount) };
  if (cd.pausedCount > 0) copyData['Paused Tags'] = String(cd.pausedCount);
  if (cd.tagsByEvent?.length > 0) {
    copyData['Event Names'] = cd.tagsByEvent.map(ev => {
      if (ev.paused > 0) return ev.paused === ev.total ? `${ev.name} (paused)` : `${ev.name} (${ev.paused} paused)`;
      return ev.name;
    });
  }
  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.title = 'Copy to clipboard';
  copyBtn.setAttribute('aria-label', 'Copy to clipboard');
  copyBtn.style.cssText = 'position:absolute;top:0;right:0';
  const copySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  copySvg.setAttribute('viewBox', '0 0 24 24');
  copySvg.setAttribute('fill', 'none');
  copySvg.setAttribute('stroke', 'currentColor');
  copySvg.setAttribute('stroke-width', '2');
  const copyRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  copyRect.setAttribute('x', '9'); copyRect.setAttribute('y', '9');
  copyRect.setAttribute('width', '13'); copyRect.setAttribute('height', '13');
  copyRect.setAttribute('rx', '2');
  const copyPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  copyPath.setAttribute('d', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1');
  copySvg.appendChild(copyRect);
  copySvg.appendChild(copyPath);
  copyBtn.appendChild(copySvg);
  copyBtn.addEventListener('click', () => {
    const ta = document.createElement('textarea');
    ta.value = safeStringify(copyData, { space: 2 });
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      copyBtn.classList.add('copied');
      copyBtn.title = 'Copied!';
      setTimeout(() => { copyBtn.classList.remove('copied'); copyBtn.title = 'Copy to clipboard'; }, 1500);
    } catch { /* ignore */ }
    document.body.removeChild(ta);
  });
  wrapper.style.position = 'relative';
  wrapper.appendChild(copyBtn);

  return createDataSection('Container Info', wrapper, { expanded: true });
}

/**
 * Build the "Destinations configured" section for a CDP config event
 * (Segment settings, RudderStack sourceConfig). Each destination becomes
 * a clickable row that filters Stream to that platform's events — same
 * affordance the Stack View Tool detail panel's children use.
 *
 * Recognised destinations get the brand pill; unrecognised ones get a
 * muted grey row so the user still sees what the CDP is set up to load
 * even if our registry doesn't cover the destination yet.
 *
 * @param {Array<{name, platformId, displayName?, enabled?}>} destinations
 * @param {string} cdpLabel - "Segment" or "RudderStack" — used in the section title
 */
function createCdpDestinationsSection(destinations, cdpLabel) {
  if (!Array.isArray(destinations) || destinations.length === 0) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'cdp-destinations-list';

  // Friendly intro — a single line that distinguishes "configured" from
  // "observed". Critical because the user might wonder why a destination
  // appears here but hasn't fired any events yet (consent denied, no
  // matching trigger event in this session, etc.).
  const intro = document.createElement('p');
  intro.className = 'cdp-destinations-intro';
  intro.textContent = `These destinations are configured in ${cdpLabel}. Whether they've actually fired during this session depends on consent, triggers, and routing rules.`;
  wrapper.appendChild(intro);

  for (const dest of destinations) {
    const row = document.createElement('div');
    row.className = 'cdp-destination-row';
    if (dest.enabled === false) row.classList.add('cdp-destination-row-disabled');

    // Brand pill if recognised, otherwise a muted unknown badge. The
    // platform-icon SVG is parsed via DOMParser before being attached so
    // the renderer never assigns `innerHTML` from a string — the SVG is a
    // trusted literal from platform-icons.js, but going through the
    // parser keeps the path explicit for the security-review hook.
    if (dest.platformId) {
      const pill = document.createElement('span');
      pill.className = `event-platform ${dest.platformId} cdp-destination-pill`;
      pill.dataset.platform = dest.platformId;
      const iconSvg = getPlatformIcon(dest.platformId);
      if (iconSvg) {
        const parsed = new DOMParser().parseFromString(iconSvg, 'image/svg+xml');
        const svgNode = parsed.documentElement;
        if (svgNode && svgNode.tagName.toLowerCase() === 'svg') {
          pill.appendChild(svgNode);
        }
      }
      const text = document.createElement('span');
      text.className = 'platform-text';
      text.textContent = dest.displayName || dest.name;
      pill.appendChild(text);
      row.appendChild(pill);
    } else {
      const unknownBadge = document.createElement('span');
      unknownBadge.className = 'cdp-destination-unknown';
      unknownBadge.textContent = dest.displayName || dest.name;
      unknownBadge.title = "Configured in the CDP but Event Watcher doesn't yet recognise this destination — it'll appear in Stream as an unknown event if it fires.";
      row.appendChild(unknownBadge);
    }

    // Status hint — 'disabled' for entries the CDP marks as off (RudderStack only;
    // Segment's settings response doesn't carry a per-destination enabled flag).
    if (dest.enabled === false) {
      const status = document.createElement('span');
      status.className = 'cdp-destination-status';
      status.textContent = 'disabled';
      row.appendChild(status);
    }

    wrapper.appendChild(row);
  }

  const title = `Destinations configured (${destinations.length})`;
  return createDataSection(title, wrapper, { expanded: true });
}

/**
 * Build the "Extensions installed" section for an Adobe Launch
 * published library. Two pieces of info coexist here:
 *   - `extensions[]`: every extension installed in the Launch property
 *     (configured to load — but a rule must reference it to actually
 *     execute on the page)
 *   - `actionExtensions[]`: the deduplicated extension names referenced
 *     by `rules[*].actions[*].modulePath` — extensions that will run
 *     when their rule fires
 *
 * We render them as ONE list with each row marked "(in use)" if the
 * extension shows up in actionExtensions. Avoids forcing the user to
 * cross-reference two lists.
 *
 * @param {Object} containerData — the parsed container, expected to
 *   carry `extensions` and `actionExtensions` arrays. Both come from
 *   parseAdobeLaunchContainer; either may be empty.
 */
function createAdobeLaunchExtensionsSection(containerData) {
  const extensions = Array.isArray(containerData?.extensions) ? containerData.extensions : [];
  if (extensions.length === 0) return null;

  // Build the "in use" set keyed on extension name so we can mark rows.
  const usedNames = new Set();
  if (Array.isArray(containerData.actionExtensions)) {
    for (const ext of containerData.actionExtensions) {
      if (ext?.name) usedNames.add(ext.name);
    }
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'cdp-destinations-list adobe-launch-extensions-list';

  const intro = document.createElement('p');
  intro.className = 'cdp-destinations-intro';
  intro.textContent = 'Extensions installed in this Launch property. Rows marked (in use) are referenced by at least one rule action — they\'ll execute when their rule fires. Extensions without that mark are installed but unreferenced.';
  wrapper.appendChild(intro);

  for (const ext of extensions) {
    const row = document.createElement('div');
    row.className = 'cdp-destination-row';
    if (!usedNames.has(ext.name)) row.classList.add('cdp-destination-row-disabled');

    if (ext.platformId) {
      const pill = document.createElement('span');
      pill.className = `event-platform ${ext.platformId} cdp-destination-pill`;
      pill.dataset.platform = ext.platformId;
      const iconSvg = getPlatformIcon(ext.platformId);
      if (iconSvg) {
        const parsed = new DOMParser().parseFromString(iconSvg, 'image/svg+xml');
        const svgNode = parsed.documentElement;
        if (svgNode && svgNode.tagName.toLowerCase() === 'svg') {
          pill.appendChild(svgNode);
        }
      }
      const text = document.createElement('span');
      text.className = 'platform-text';
      text.textContent = ext.name;
      pill.appendChild(text);
      row.appendChild(pill);
    } else {
      const unknownBadge = document.createElement('span');
      unknownBadge.className = 'cdp-destination-unknown';
      unknownBadge.textContent = ext.name;
      unknownBadge.title = "Extension installed but Event Watcher doesn't yet recognise it.";
      row.appendChild(unknownBadge);
    }

    if (usedNames.has(ext.name)) {
      const status = document.createElement('span');
      status.className = 'cdp-destination-status adobe-launch-in-use';
      status.textContent = 'in use';
      row.appendChild(status);
    }

    wrapper.appendChild(row);
  }

  const title = `Extensions installed (${extensions.length})`;
  return createDataSection(title, wrapper, { expanded: true });
}

/**
 * Build the "Audience destinations dispatched" section for an Adobe
 * Experience Platform Web SDK (alloy.js) interact-endpoint event. The
 * Edge Network can dispatch URL pixel notifications + cookie syncs
 * server-side as part of the response; each one fires from the page
 * via the SDK.
 *
 * Data shape differs from CDP destinations: items have `{ url, type,
 * platformId }` rather than vendor-keyed kits. Recognised platforms
 * still get the brand pill; everything else falls back to a host-only
 * label so the user sees what was dispatched even if it's a vendor
 * we don't yet have in the registry.
 *
 * @param {Array<{ url, type, platformId }>} destinations
 */
function createAepDestinationsSection(destinations) {
  if (!Array.isArray(destinations) || destinations.length === 0) return null;

  const wrapper = document.createElement('div');
  wrapper.className = 'cdp-destinations-list aep-destinations-list';

  const intro = document.createElement('p');
  intro.className = 'cdp-destinations-intro';
  intro.textContent = 'These destinations were dispatched by the Adobe Edge Network on this request — typically Real-Time CDP audience-activation pixels and cookie syncs. The SDK fires them on behalf of the page.';
  wrapper.appendChild(intro);

  for (const dest of destinations) {
    const row = document.createElement('div');
    row.className = 'cdp-destination-row';

    if (dest.platformId) {
      const pill = document.createElement('span');
      pill.className = `event-platform ${dest.platformId} cdp-destination-pill`;
      pill.dataset.platform = dest.platformId;
      const iconSvg = getPlatformIcon(dest.platformId);
      if (iconSvg) {
        const parsed = new DOMParser().parseFromString(iconSvg, 'image/svg+xml');
        const svgNode = parsed.documentElement;
        if (svgNode && svgNode.tagName.toLowerCase() === 'svg') {
          pill.appendChild(svgNode);
        }
      }
      const text = document.createElement('span');
      text.className = 'platform-text';
      // Display name comes from KNOWN_TRACKING_ENDPOINTS (already imported);
      // fall back to the platform-id when not in the registry index.
      const ep = ENDPOINT_BY_ID.get(dest.platformId);
      text.textContent = (ep?.name) || dest.platformId;
      pill.appendChild(text);
      row.appendChild(pill);
    } else {
      // Unknown vendor — show the host so the user can identify it.
      const unknownBadge = document.createElement('span');
      unknownBadge.className = 'cdp-destination-unknown';
      let host = '';
      try { host = new URL(dest.url).host; } catch { host = dest.url || 'unknown'; }
      unknownBadge.textContent = host;
      unknownBadge.title = `${dest.type} dispatch to ${dest.url}`;
      row.appendChild(unknownBadge);
    }

    // Dispatch type — 'url' or 'cookie' — small status tag for clarity.
    const status = document.createElement('span');
    status.className = 'cdp-destination-status';
    status.textContent = dest.type === 'cookie' ? 'cookie sync' : 'pixel';
    row.appendChild(status);

    wrapper.appendChild(row);
  }

  const title = `Audience destinations dispatched (${destinations.length})`;
  return createDataSection(title, wrapper, { expanded: true });
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Render GTM dataLayer event detail
 * Single-column layout: Overview, dataLayer.push (full push including event), Computed dataLayer
 */
function renderGTMDetail(event) {
  const container = document.createElement('div');
  container.className = 'detail-layout';

  const consentMode = event.formatted?.googleConsentMode;
  const setCommand = event.formatted?.gtagSetCommand;
  const isConsentSetting = setCommand?.type === 'consent-setting';
  const isDeveloperId = setCommand?.type === 'developer-id';
  const isConsentRelated = consentMode || isConsentSetting;

  // Overview card
  const overviewData = {
    'Event': event.formatted?.event || event.eventName,
    'Push #': event.formatted?.pushIndex
  };
  if (consentMode) {
    overviewData['Consent Action'] = consentMode.action;
  }
  if (isConsentSetting) {
    overviewData['Setting'] = setCommand.setting;
    overviewData['Value'] = String(setCommand.value);
  }
  if (isDeveloperId) {
    overviewData['Developer ID'] = setCommand.id;
    if (setCommand.platform) {
      overviewData['Platform'] = setCommand.platform;
    }
  }
  if (event.formatted?.isHistorical) {
    overviewData['Note'] = 'Historical (before debugger loaded)';
  }
  // Push source — who called dataLayer.push()
  const pushSource = event.formatted?.pushSource;
  if (pushSource && pushSource !== 'unknown') {
    const sourceUrl = event.formatted?.pushSourceUrl;

    // Try to resolve source URL to a known platform name and ID
    let platformName = '';
    let platformId = '';
    if (sourceUrl) {
      const scriptMatch = matchScriptLoad(sourceUrl);
      if (scriptMatch) {
        platformName = scriptMatch.name;
        platformId = scriptMatch.platformId;
      } else {
        const endpointMatch = matchKnownEndpoint(sourceUrl);
        if (endpointMatch.matched) {
          platformName = endpointMatch.endpoint.shortName || endpointMatch.endpoint.name;
          platformId = endpointMatch.endpoint.id;
        }
      }
    }

    // Build display URL — show full URL unless it's very long with query params
    let displayUrl = '';
    if (sourceUrl) {
      try {
        const parsed = new URL(sourceUrl);
        // Strip long query strings (often just IDs) but keep the path
        if (parsed.search.length > 60) {
          displayUrl = parsed.origin + parsed.pathname;
        } else {
          displayUrl = sourceUrl;
        }
      } catch {
        displayUrl = sourceUrl;
      }
    }

    let sourceLabel = '';
    switch (pushSource) {
      case 'website':
        sourceLabel = platformName || 'Website';
        break;
      case 'tag-manager':
        sourceLabel = platformName || 'Tag Manager';
        break;
      case 'script':
        sourceLabel = platformName || 'Third-party script';
        break;
      case 'historical':
        sourceLabel = 'Historical (before debugger)';
        break;
      default:
        sourceLabel = pushSource;
    }

    // Build a rich DOM element with platform badge when we have a known platform
    if (platformId && getPlatformIcon(platformId)) {
      const sourceEl = document.createElement('span');
      sourceEl.className = 'overview-value push-source-value';

      // Platform badge (same style as event list badges)
      const badge = document.createElement('span');
      badge.className = `event-platform ${platformId}`;
      badge.dataset.platform = platformId;
      badge.innerHTML = `${getPlatformIcon(platformId)}<span class="platform-text">${escapeHtml(platformName)}</span>`;
      sourceEl.appendChild(badge);

      // Append URL after the badge if available
      if (displayUrl && pushSource !== 'historical') {
        const urlSpan = document.createElement('span');
        urlSpan.className = 'push-source-url';
        urlSpan.textContent = ` — ${displayUrl}`;
        sourceEl.appendChild(urlSpan);
      }

      overviewData['Source'] = sourceEl;
    } else {
      // Fallback to plain text when no platform icon available
      if (displayUrl && pushSource !== 'historical') {
        sourceLabel += ` — ${displayUrl}`;
      }
      overviewData['Source'] = sourceLabel;
    }
  }
  // For consent-related events, show the consent category info
  const categoryInfo = isConsentRelated
    ? _deps.getCategoryInfo('google-ccm')
    : _deps.getCategoryInfo(event.platform);

  // Feature #113: build descriptor list, then apply user order.
  const descriptors = [];

  const overviewEl = createOverviewCard(overviewData, { event, categoryInfo });
  descriptors.push({ id: 'overview', present: true, render: () => overviewEl });

  // AI Summary section (collapsed by default)
  const aiSummary = renderAISummarySection(event);
  if (aiSummary) {
    descriptors.push({ id: 'ai-summary', present: true, render: () => aiSummary });
  }

  // Unified Consent Check section
  const consentCheckSection = createUnifiedConsentSection(event, consentMode);
  if (consentCheckSection) {
    consentCheckSection.classList.add('consent-check-ui');
    descriptors.push({ id: 'consent', present: true, render: () => consentCheckSection });
  }

  // About Tool section (collapsed by default)
  const aboutPlatformId = isConsentRelated ? 'google-ccm' : event.platform;
  const aboutSection = createAboutToolSection(aboutPlatformId);
  if (aboutSection) {
    descriptors.push({ id: 'about-tool', present: true, render: () => aboutSection });
  }

  // dataLayer.push section (full push including event variable)
  const fullPushData = {};
  if (event.formatted?.event) {
    fullPushData['event'] = event.formatted.event;
  }
  const pushData = event.formatted?.pushData || {};
  Object.entries(pushData).forEach(([key, value]) => {
    if (key !== 'event') {
      fullPushData[key] = value;
    }
  });
  if (!fullPushData['event'] && pushData['event']) {
    fullPushData['event'] = pushData['event'];
  }

  const pushHeaderActions = (!event.formatted?.isGTMInternalEvent && !isDeveloperId)
    ? createDataLayerPushButtons(event)
    : null;
  const pushEl = createDataSection('dataLayer.push', fullPushData, { headerActions: pushHeaderActions, sectionId: 'datalayer-push' });
  descriptors.push({ id: 'datalayer-push', present: true, render: () => pushEl });

  // Computed dataLayer section
  const dataLayerState = event.formatted?.dataLayerState || {};
  const computedCount = Object.keys(dataLayerState).length;
  const computedTitle = computedCount > 0 ? `Computed dataLayer (${computedCount})` : 'Computed dataLayer';
  const computedEl = createDataSection(computedTitle, dataLayerState, { tall: true, sectionId: 'computed-datalayer' });
  descriptors.push({ id: 'computed-datalayer', present: true, render: () => computedEl });

  _appendOrderedSections(container, descriptors);
  return container;
}

// =============================================================================
// Consent Insight Section — comparison table showing CMP vs GCM state
// =============================================================================

const UNIFIED_CATEGORY_ORDER = ['analytics', 'marketing', 'functional'];
const UNIFIED_CATEGORY_LABELS = { analytics: 'Analytics', marketing: 'Marketing', functional: 'Functional' };

// Secondary GCM signals that map to marketing. These don't drive consent violation checks
// (ad_storage does), but mismatches between these and CMP state are worth flagging.
const GCM_SECONDARY_MARKETING_SIGNALS = [
  { key: 'ad_user_data', label: 'Ad User Data', signal: 'ad_user_data' },
  { key: 'ad_personalization', label: 'Ad Personalization', signal: 'ad_personalization' },
];

/** Map check.source to a human-readable detection method label */
function formatDetectionSource(source) {
  const labels = {
    cookie: 'cookie', 'window-api': 'window API', 'cmp-push': 'dataLayer', 'cmp-lifecycle': 'dataLayer',
    'google-cm': 'dataLayer (GCM)', gcs: 'Per-request (GCS)', timeline: 'Timeline',
  };
  return labels[source] || source || 'Unknown';
}

/**
 * Gather all consent data needed for the insight table.
 * Determines the scenario (A–F) and builds row data.
 * @param {Object|null} check - From the injected getConsentCheckForEvent
 * @param {Object} event - The event object
 * @param {Object|null} consentMode - event.formatted.googleConsentMode
 * @returns {Object} Insight data with scenario, rows, CMP info
 */
function gatherConsentInsightData(check, event, consentMode) {
  // Determine CMP data
  const isTrueCMP = check && check.cmp && check.cmp !== 'Google Consent Mode';
  const cmpName = check?.cmp || null;
  const cmpSource = formatDetectionSource(check?.source);
  const cmpCategories = (isTrueCMP && check.categories) ? check.categories : null;
  const isBinaryCMP = isTrueCMP && !check.categories;

  // Determine GCM data — prefer per-event consentMode, fall back to timeline
  let gcmCategories = null;
  if (consentMode && consentMode.params) {
    gcmCategories = normalizeGCMToCategories(consentMode.params);
  }
  if (!gcmCategories) {
    gcmCategories = _deps.getGCMCategoriesAtTime(event.timestamp);
  }

  // When CMP IS Google Consent Mode, its categories are GCM data
  const gcmOnlyCategories = (!isTrueCMP && check?.categories) ? check.categories : null;
  const gcmAtEvent = gcmCategories || gcmOnlyCategories;

  // Google tags consume GCM, so they ALWAYS show GCM columns so the implementation
  // signal can be checked against the CMP state (GCS fallback from the request URL,
  // or empty columns to highlight a missing signal). Non-Google tags don't read GCM,
  // but when the site uses Google Consent Mode we still surface its ambient state for
  // context — same columns as Google tags so the table reads consistently regardless
  // of vendor, and framed as informational (never a violation). See resolveGcmForDisplay.
  const GOOGLE_TAG_IDS = ['ga4', 'sgtm', 'google-ccm', 'google-ads-conversion', 'google-ads-remarketing'];
  const isGoogleTag = !!(event.platform && GOOGLE_TAG_IDS.includes(event.platform));
  const { effectiveGCM, gcmInformational } = resolveGcmForDisplay({
    isGoogleTag,
    gcmAtEvent,
    gcsState: isGoogleTag ? getGCSConsentState(event) : null,
    latestSiteGcm: isGoogleTag ? null : _deps.getGCMCategoriesAtTime(Number.MAX_SAFE_INTEGER),
  });

  // Determine scenario — binary CMP checks must come before generic !cmpCategories
  // because isBinaryCMP implies !cmpCategories (binary entries have no per-category data)
  let scenario;
  if (cmpCategories && effectiveGCM) scenario = 'A';       // Full comparison
  else if (cmpCategories && !effectiveGCM) scenario = 'B'; // CMP only
  else if (isBinaryCMP && effectiveGCM) scenario = 'D';    // Binary CMP + GCM
  else if (isBinaryCMP) scenario = 'E';                    // Binary only
  else if (!cmpCategories && effectiveGCM) scenario = 'C'; // GCM only
  else scenario = 'F';                                      // No data

  // Build rows for scenarios A/B/C/D and pre-consent (F with required category)
  const rows = [];
  const buildRows = scenario === 'A' || scenario === 'B' || scenario === 'C' || scenario === 'D'
    || (scenario === 'F' && check && (check.status === 'pre-consent' || check.status === 'unknown') && check.category);
  if (buildRows) {
    for (const cat of UNIFIED_CATEGORY_ORDER) {
      const cmpState = cmpCategories ? (cmpCategories[cat] || null) : null;
      const gcmState = effectiveGCM ? (effectiveGCM[cat] || null) : null;
      const cmpCategoryName = (cmpName && cmpName !== 'Google Consent Mode')
        ? getCMPCategoryName(cmpName, cat)
        : null;
      const gcmSignalName = GCM_SIGNAL_NAMES[cat] || null;
      const mismatch = !gcmInformational && cmpState !== null && gcmState !== null && cmpState !== gcmState;
      const isRequired = check ? (cat === check.category) : false;

      rows.push({
        unified: cat,
        unifiedLabel: UNIFIED_CATEGORY_LABELS[cat],
        cmpState,
        cmpCategoryName,
        gcmState,
        gcmSignalName,
        mismatch,
        isRequired,
      });

      // After marketing row, add secondary GCM marketing signals (ad_user_data, ad_personalization)
      // if they differ from the CMP's marketing state — flags implementation mismatches
      if (cat === 'marketing' && effectiveGCM) {
        for (const sec of GCM_SECONDARY_MARKETING_SIGNALS) {
          const secState = effectiveGCM[sec.key] || null;
          if (!secState) continue; // Signal not present — skip row
          const secMismatch = !gcmInformational && cmpState !== null && secState !== null && cmpState !== secState;
          rows.push({
            unified: sec.key,
            unifiedLabel: sec.label,
            cmpState: cmpState, // CMP marketing state for comparison
            cmpCategoryName,
            gcmState: secState,
            gcmSignalName: sec.signal,
            mismatch: secMismatch,
            isRequired: false, // Secondary signals don't drive violation checks
            isSecondary: true, // Visual hint for sub-row styling
          });
        }
      }
    }
  }

  // Binary action for scenario D/E
  const binaryAction = isBinaryCMP ? check.status : null;

  return { scenario, cmpName, cmpSource, isBinaryCMP, binaryAction, rows, gcmInformational };
}

/**
 * Build the consent comparison table. Adapts columns per scenario.
 * @param {Object} insightData - From gatherConsentInsightData()
 * @returns {HTMLElement}
 */
function createConsentInsightTable(insightData) {
  const { scenario, rows } = insightData;
  const wrap = document.createElement('div');
  wrap.className = 'consent-insight-table-wrap';

  const table = document.createElement('table');
  table.className = 'consent-insight-table';

  // Build header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = ['Category'];

  // Always name the state column after its source ("CMP State" / "GCM State") so the
  // table header reads the same way for Google and non-Google tags. The bare "State"
  // label was ambiguous: a CMP-only (B) and a GCM-only (C/D) table both showed "State",
  // making the two cases look identical when they describe different signals.
  if (scenario === 'A') {
    headers.push('CMP State', 'CMP Category', 'GCM State', 'GCM Signal');
  } else if (scenario === 'B') {
    headers.push('CMP State', 'CMP Category');
  } else if (scenario === 'C' || scenario === 'D') {
    headers.push('GCM State', 'GCM Signal');
  } else if (scenario === 'F') {
    headers.push('State');
  }

  for (const h of headers) {
    const th = document.createElement('th');
    th.textContent = h;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Build body
  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    if (row.mismatch && row.isRequired) tr.className = 'mismatch required-row';
    else if (row.mismatch) tr.className = 'mismatch';
    else if (row.isRequired) tr.className = 'required-row';
    if (row.isSecondary) tr.classList.add('secondary-signal');

    // Category cell
    const catTd = document.createElement('td');
    catTd.className = 'ci-category';
    catTd.textContent = row.unifiedLabel;
    tr.appendChild(catTd);

    if (scenario === 'A') {
      // CMP State
      tr.appendChild(createStateTd(row.cmpState));
      // CMP Category Name
      const cmpNameTd = document.createElement('td');
      cmpNameTd.className = 'ci-cmp-name';
      cmpNameTd.textContent = row.cmpCategoryName || '\u2014';
      tr.appendChild(cmpNameTd);
      // GCM State
      tr.appendChild(createStateTd(row.gcmState));
      // GCM Signal Name
      const gcmNameTd = document.createElement('td');
      gcmNameTd.className = 'ci-gcm-name';
      gcmNameTd.textContent = row.gcmSignalName || '\u2014';
      tr.appendChild(gcmNameTd);
    } else if (scenario === 'B') {
      tr.appendChild(createStateTd(row.cmpState));
      const cmpNameTd = document.createElement('td');
      cmpNameTd.className = 'ci-cmp-name';
      cmpNameTd.textContent = row.cmpCategoryName || '\u2014';
      tr.appendChild(cmpNameTd);
    } else if (scenario === 'C' || scenario === 'D') {
      tr.appendChild(createStateTd(row.gcmState));
      const gcmNameTd = document.createElement('td');
      gcmNameTd.className = 'ci-gcm-name';
      gcmNameTd.textContent = row.gcmSignalName || '\u2014';
      tr.appendChild(gcmNameTd);
    } else if (scenario === 'F') {
      tr.appendChild(createStateTd(null)); // No data — shows "—"
    }

    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

/** Create a <td> with granted/denied state icon and class */
function createStateTd(state) {
  const td = document.createElement('td');
  td.className = `ci-state ${state || 'not_set'}`;
  if (state === 'granted') td.textContent = '\u2713 granted';
  else if (state === 'denied') td.textContent = '\u2717 denied';
  else td.textContent = '\u2014 not configured';
  return td;
}

/**
 * Create the CMP identification row — more prominent than the old text line.
 * @param {string} cmpName - CMP name
 * @param {string} cmpSource - Detection source label
 * @returns {HTMLElement}
 */
function createCMPInfoRow(cmpName, cmpSource) {
  const row = document.createElement('div');
  row.className = 'consent-cmp-info';

  const label = document.createElement('span');
  label.className = 'consent-cmp-label';
  label.textContent = 'CMP';

  const name = document.createElement('span');
  name.className = 'consent-cmp-name';
  name.textContent = cmpName;

  const source = document.createElement('span');
  source.className = 'consent-cmp-source';
  source.textContent = `via ${cmpSource.toLowerCase()}`;

  row.appendChild(label);
  row.appendChild(name);
  row.appendChild(source);
  return row;
}

/**
 * Create the unified Consent Insight section for event detail.
 * Shows a comparison table with CMP state, CMP category names, GCM state, and mismatch flags.
 * Three visual states: green (granted, collapsed), red (denied, expanded), yellow (pre-consent, expanded).
 * @param {Object} event - The event object
 * @param {Object} consentMode - Google Consent Mode data (if present)
 * @returns {HTMLElement|null} Consent section or null if no data
 */
function createUnifiedConsentSection(event, consentMode) {
  // OFF mode: hide consent section entirely
  if (_deps.getConsentFilterMode() === 'off') return null;

  const check = _deps.getConsentCheckForEvent(event);

  // Exempt platform category — no consent section needed
  if (check && check.status === 'exempt') return null;

  // No consent data — show "no data" for tracking events, or nothing
  if (!check) {
    if (event.platform && event.platform !== 'pages' && event.platform !== 'datalayer'
        && event.platform !== 'gtm' && event.isScriptLoad !== true) {
      const wrapper = document.createElement('div');
      wrapper.className = 'consent-check-section';
      const noData = document.createElement('div');
      noData.className = 'consent-check-no-data';
      noData.textContent = 'No consent signals detected on this page.';
      wrapper.appendChild(noData);
      return createDataSection('Consent', wrapper, { expanded: false });
    }
    return null;
  }

  // Gather all insight data and determine scenario
  const insight = gatherConsentInsightData(check, event, consentMode);
  const wrapper = document.createElement('div');
  wrapper.className = 'consent-check-section';

  // Warning/status banner (only for violations and pre-consent)
  if (check.status === 'denied') {
    const warning = document.createElement('div');
    // Shield icon — shared across all denial variants
    const warnIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    warnIcon.setAttribute('width', '14');
    warnIcon.setAttribute('height', '14');
    warnIcon.setAttribute('viewBox', '0 0 24 24');
    warnIcon.setAttribute('fill', 'none');
    warnIcon.setAttribute('stroke', 'currentColor');
    warnIcon.setAttribute('stroke-width', '2');
    const warnPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    warnPath.setAttribute('d', 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z');
    warnIcon.appendChild(warnPath);
    warning.appendChild(warnIcon);
    const textEl = document.createElement('div');

    if (check.cookielessPing) {
      // Advanced Consent Mode — advisory notice with expandable explanation
      warning.className = 'consent-check-warning advanced-consent-mode';
      const strong = document.createElement('strong');
      strong.textContent = 'Advanced Consent Mode';
      textEl.appendChild(strong);
      textEl.appendChild(document.createElement('br'));
      textEl.appendChild(document.createTextNode(
        `This ${check.categoryLabel} tag fired as a cookieless ping. Consent is denied, but the tag is configured to send limited data without cookies.`
      ));
      // Expandable "Learn more" section
      const learnMore = document.createElement('div');
      learnMore.className = 'consent-acm-expand';
      const expandToggle = document.createElement('span');
      expandToggle.className = 'consent-acm-toggle';
      expandToggle.innerHTML = 'Learn more <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
      const acmExpanded = getSectionExpandedState('_inline:cookieless-learn-more', false);
      const expandContent = document.createElement('div');
      expandContent.className = `consent-acm-detail${acmExpanded ? '' : ' collapsed'}`;
      if (acmExpanded) expandToggle.classList.add('expanded');
      const gcsValue = event.raw?.params?.gcs || '';
      expandContent.textContent = 'Google Advanced Consent Mode allows tags to send cookieless, anonymized pings even when consent is denied. '
        + 'These pings contain no user identifiers and cannot be used for ad personalization. '
        + (gcsValue ? `This request contains Google Consent Status gcs=${gcsValue}, confirming that consent is denied. ` : '')
        + 'Whether to allow cookieless pings is a business and compliance decision for your organization.';
      expandToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        expandContent.classList.toggle('collapsed');
        expandToggle.classList.toggle('expanded');
        saveSectionState('_inline:cookieless-learn-more', expandContent.classList.contains('collapsed'));
      });
      learnMore.appendChild(expandToggle);
      learnMore.appendChild(expandContent);
      textEl.appendChild(learnMore);
    } else {
      // Standard violation or potential issue
      const isPotential = check.severity === 'potential';
      warning.className = `consent-check-warning denied${isPotential ? ' potential' : ''}`;
      const strong = document.createElement('strong');
      strong.textContent = isPotential ? 'Potential Consent Issue' : 'Consent Violation';
      textEl.appendChild(strong);
      textEl.appendChild(document.createElement('br'));
      textEl.appendChild(document.createTextNode(isPotential
        ? `This event requires ${check.categoryLabel} consent (denied), but the request may not be collecting tracking data.`
        : `This event requires ${check.categoryLabel} consent, which was denied when it fired.`));
    }
    warning.appendChild(textEl);
    wrapper.appendChild(warning);
  } else if (check.status === 'pre-consent') {
    const warning = document.createElement('div');
    warning.className = 'consent-check-warning pre-consent';
    const warnIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    warnIcon.setAttribute('width', '14');
    warnIcon.setAttribute('height', '14');
    warnIcon.setAttribute('viewBox', '0 0 24 24');
    warnIcon.setAttribute('fill', 'none');
    warnIcon.setAttribute('stroke', 'currentColor');
    warnIcon.setAttribute('stroke-width', '2');
    const triPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    triPath.setAttribute('d', 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z');
    warnIcon.appendChild(triPath);
    warning.appendChild(warnIcon);
    const textEl = document.createElement('div');
    const strong2 = document.createElement('strong');
    strong2.textContent = 'Pre-Consent';
    textEl.appendChild(strong2);
    textEl.appendChild(document.createElement('br'));
    textEl.appendChild(document.createTextNode(
      check.categoryLabel
        ? `This event requires ${check.categoryLabel} consent but fired before any consent signal was received.`
        : 'This event fired before any consent signal was received.'
    ));
    warning.appendChild(textEl);
    wrapper.appendChild(warning);
  } else if (check.status === 'unknown') {
    const warning = document.createElement('div');
    warning.className = 'consent-check-warning pre-consent';
    const warnIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    warnIcon.setAttribute('width', '14');
    warnIcon.setAttribute('height', '14');
    warnIcon.setAttribute('viewBox', '0 0 24 24');
    warnIcon.setAttribute('fill', 'none');
    warnIcon.setAttribute('stroke', 'currentColor');
    warnIcon.setAttribute('stroke-width', '2');
    const triPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    triPath.setAttribute('d', 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z');
    warnIcon.appendChild(triPath);
    warning.appendChild(warnIcon);
    const textEl = document.createElement('div');
    const strong3 = document.createElement('strong');
    strong3.textContent = 'Consent Unknown';
    textEl.appendChild(strong3);
    textEl.appendChild(document.createElement('br'));
    textEl.appendChild(document.createTextNode(
      `This event requires ${check.categoryLabel} consent, but the CMP's cookie uses non-standard category names that could not be mapped. Verify manually.`
    ));
    warning.appendChild(textEl);
    wrapper.appendChild(warning);
  }

  // CMP info row — prominent display, with expandable consent detection path
  if (insight.cmpName) {
    const cmpRow = createCMPInfoRow(insight.cmpName, insight.cmpSource);
    wrapper.appendChild(cmpRow);

    // Expandable consent detection path (how consent state was determined)
    const consentPath = reconstructConsentPath(event);
    if (consentPath.length > 0) {
      const consentPathExpanded = getSectionExpandedState('_inline:consent-detection-path', false);
      const expandToggle = document.createElement('span');
      expandToggle.className = `matching-viz-expand${consentPathExpanded ? ' expanded' : ''}`;
      expandToggle.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>`;
      expandToggle.title = 'Show consent detection path';
      cmpRow.appendChild(expandToggle);

      const pathContent = document.createElement('div');
      pathContent.className = `consent-detection-path${consentPathExpanded ? '' : ' collapsed'}`;

      for (const pathStep of consentPath) {
        pathContent.appendChild(createDetectionPathStep(pathStep));
      }

      expandToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        pathContent.classList.toggle('collapsed');
        expandToggle.classList.toggle('expanded');
        saveSectionState('_inline:consent-detection-path', pathContent.classList.contains('collapsed'));
      });

      wrapper.appendChild(pathContent);
    }
  }

  // Binary CMP banner for scenario D/E
  if (insight.isBinaryCMP && (insight.scenario === 'D' || insight.scenario === 'E')) {
    const binaryBanner = document.createElement('div');
    binaryBanner.className = 'consent-check-binary';
    binaryBanner.textContent = `${insight.cmpName || 'CMP'} fired a ${check.status === 'granted' ? 'consent accept' : check.status === 'denied' ? 'consent decline' : 'consent'} event. Category-level data not available from this CMP.`;
    wrapper.appendChild(binaryBanner);
  }

  // Comparison table (scenarios A/B/C/D)
  if (insight.rows.length > 0) {
    wrapper.appendChild(createConsentInsightTable(insight));
  }

  // Informational GCM note — shown when the GCM columns appear next to a non-Google
  // tag (which doesn't read GCM). Clarifies the columns are site context, not a check,
  // so a CMP↔GCM difference isn't mistaken for a violation. Only meaningful when the
  // table actually rendered GCM state.
  if (insight.gcmInformational && insight.rows.some(r => r.gcmState)) {
    const gcmNote = document.createElement('div');
    gcmNote.className = 'consent-gcm-info-note';
    gcmNote.textContent = 'ℹ Google Consent Mode state shown for context. Non-Google tags aren’t required to respect GCM, so a difference from the CMP isn’t necessarily a violation — it depends on how this tag is set up.';
    wrapper.appendChild(gcmNote);
  }

  // Mismatch note (scenario A only)
  if (insight.scenario === 'A') {
    const categoryMismatches = insight.rows.filter(r => r.mismatch && !r.isSecondary).length;
    const signalMismatches = insight.rows.filter(r => r.mismatch && r.isSecondary).length;
    if (categoryMismatches > 0 || signalMismatches > 0) {
      const mismatchNote = document.createElement('div');
      mismatchNote.className = 'consent-mismatch-note';
      const parts = [];
      if (categoryMismatches > 0) {
        parts.push(`${categoryMismatches} ${categoryMismatches === 1 ? 'category' : 'categories'}`);
      }
      if (signalMismatches > 0) {
        parts.push(`${signalMismatches} secondary ${signalMismatches === 1 ? 'signal' : 'signals'}`);
      }
      mismatchNote.textContent = `\u26A0 CMP and Google Consent Mode disagree on ${parts.join(' and ')}. CMP is the primary consent authority.`;
      wrapper.appendChild(mismatchNote);
    }
  }

  // Disclaimer with report button (always shown, same style as "Report Tool" for unknown events)
  const noteRow = document.createElement('div');
  noteRow.className = 'consent-check-note-row';
  const note = document.createElement('span');
  note.className = 'consent-check-note';
  note.textContent = 'Based on platform category.';
  noteRow.appendChild(note);
  const reportLink = document.createElement('button');
  reportLink.className = 'action-btn action-btn--warn';
  // Build SVG via DOM (flag icon)
  const rlSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  rlSvg.setAttribute('width', '11');
  rlSvg.setAttribute('height', '11');
  rlSvg.setAttribute('viewBox', '0 0 24 24');
  rlSvg.setAttribute('fill', 'none');
  rlSvg.setAttribute('stroke', 'currentColor');
  rlSvg.setAttribute('stroke-width', '2');
  const rlPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  rlPath.setAttribute('d', 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z');
  rlSvg.appendChild(rlPath);
  const rlLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  rlLine.setAttribute('x1', '4');
  rlLine.setAttribute('y1', '22');
  rlLine.setAttribute('x2', '4');
  rlLine.setAttribute('y2', '15');
  rlSvg.appendChild(rlLine);
  reportLink.appendChild(rlSvg);
  reportLink.appendChild(document.createTextNode('Report wrong category'));
  reportLink.title = 'Report that this tool should be in a different consent category';
  const reportSource = check.status === 'denied' ? 'violation' : check.status === 'pre-consent' ? 'pre_consent' : check.status === 'granted' ? 'granted' : 'disclaimer';
  reportLink.addEventListener('click', () => _deps.openReportModalForConsent(event, reportSource));
  noteRow.appendChild(reportLink);
  wrapper.appendChild(noteRow);

  // Determine section title, tags, and collapse state (mode-aware)
  const filterMode = _deps.getConsentFilterMode();
  let expanded = false;
  const tags = [];
  let tagClass = 'consent-status-tag';
  if (check.status === 'denied') {
    if (check.cookielessPing) {
      tags.push('Cookieless Ping');
      tagClass = 'consent-status-tag advisory';
      expanded = filterMode !== 'off';
    } else {
      const isPotential = check.severity === 'potential';
      tags.push(isPotential ? 'Potential Issue' : 'Denied');
      tagClass = isPotential ? 'consent-status-tag potential' : 'consent-status-tag denied';
      expanded = filterMode !== 'off'; // expand warnings in AUTO and ONLY, collapse in OFF
    }
  } else if (check.status === 'pre-consent') {
    tags.push('Pre-Consent');
    tagClass = 'consent-status-tag pre-consent';
    expanded = filterMode !== 'off'; // expand warnings in AUTO and ONLY, collapse in OFF
  } else if (check.status === 'unknown') {
    tags.push('Unknown');
    tagClass = 'consent-status-tag pre-consent'; // yellow style
    expanded = filterMode !== 'off';
  } else if (check.status === 'granted') {
    tags.push(check.categoryLabel || 'Granted');
    tagClass = 'consent-status-tag granted';
    if (check.gcmMismatch) {
      // CMP says granted but Google Consent Mode disagrees — surface the GCM state
      // as a separate yellow chip alongside the green category chip so the
      // implementation drift is visible at a glance.
      const gcmLabel = check.gcmMismatch.gcmState === 'denied'
        ? 'Consent Mode: Denied'
        : `Consent Mode: ${check.gcmMismatch.gcmState.charAt(0).toUpperCase() + check.gcmMismatch.gcmState.slice(1)}`;
      tags.push({ label: gcmLabel, className: 'consent-status-tag pre-consent' });
      expanded = filterMode !== 'off'; // open the comparison table on mismatch
    } else {
      expanded = filterMode === 'only'; // only expand granted in ONLY mode
    }
  }

  // Copy Consent (JSON) button in section header
  const copyBtn = document.createElement('button');
  copyBtn.className = 'datalayer-push-btn';
  const copySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  copySvg.setAttribute('width', '12');
  copySvg.setAttribute('height', '12');
  copySvg.setAttribute('viewBox', '0 0 24 24');
  copySvg.setAttribute('fill', 'none');
  copySvg.setAttribute('stroke', 'currentColor');
  copySvg.setAttribute('stroke-width', '2.5');
  const copyPath1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  copyPath1.setAttribute('x', '9');
  copyPath1.setAttribute('y', '9');
  copyPath1.setAttribute('width', '13');
  copyPath1.setAttribute('height', '13');
  copyPath1.setAttribute('rx', '2');
  copySvg.appendChild(copyPath1);
  const copyPath2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  copyPath2.setAttribute('d', 'M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1');
  copySvg.appendChild(copyPath2);
  copyBtn.appendChild(copySvg);
  copyBtn.appendChild(document.createTextNode('Copy'));
  copyBtn.title = 'Copy consent debug data as JSON';
  copyBtn.addEventListener('click', () => {
    const json = buildConsentDebugJSON(event);
    copyTextFallback(safeStringify(json, { space: 2 }), copyBtn);
    trackEvent('copy_output', { scope: 'event', format: 'consent', feature: 'event_detail' });
  });

  return createDataSection('Consent', wrapper, { expanded, tags, tagClass, headerActions: [copyBtn] });
}

/**
 * Create Adobe Analytics Products section with table view + expandable JSON
 * @param {Array} products - Parsed product objects from parseAdobeProducts
 * @param {string} rawValue - Original raw s.products string
 * @returns {HTMLElement} Products section content
 */
function createProductsTableContent(products, rawValue) {
  const wrapper = document.createElement('div');
  wrapper.className = 'products-section';

  // Table view
  const table = document.createElement('table');
  table.className = 'products-table';

  // Header row
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = ['Category', 'Product', 'Qty', 'Price', 'Events', 'Merch eVars'];
  for (const header of headers) {
    const th = document.createElement('th');
    th.textContent = header;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body rows
  const tbody = document.createElement('tbody');
  for (const product of products) {
    const row = document.createElement('tr');

    // Category
    const catCell = document.createElement('td');
    catCell.className = 'cell-category';
    catCell.textContent = product.category || '—';
    row.appendChild(catCell);

    // Product
    const prodCell = document.createElement('td');
    prodCell.className = 'cell-product';
    prodCell.textContent = product.product || '—';
    row.appendChild(prodCell);

    // Quantity
    const qtyCell = document.createElement('td');
    qtyCell.className = 'cell-quantity';
    qtyCell.textContent = product.quantity != null ? product.quantity : '—';
    row.appendChild(qtyCell);

    // Price
    const priceCell = document.createElement('td');
    priceCell.className = 'cell-price';
    priceCell.textContent = product.price != null ? product.price.toFixed(2) : '—';
    row.appendChild(priceCell);

    // Events
    const eventsCell = document.createElement('td');
    eventsCell.className = 'cell-events';
    if (product.events && Object.keys(product.events).length > 0) {
      const eventStrs = Object.entries(product.events).map(([k, v]) =>
        v === true ? k : `${k}=${v}`
      );
      eventsCell.textContent = eventStrs.join(', ');
    } else {
      eventsCell.textContent = '—';
    }
    row.appendChild(eventsCell);

    // Merchandising eVars
    const evarsCell = document.createElement('td');
    evarsCell.className = 'cell-evars';
    if (product.merchandisingEVars && Object.keys(product.merchandisingEVars).length > 0) {
      const evarStrs = Object.entries(product.merchandisingEVars).map(([k, v]) => `${k}=${v}`);
      evarsCell.textContent = evarStrs.join(', ');
    } else {
      evarsCell.textContent = '—';
    }
    row.appendChild(evarsCell);

    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  wrapper.appendChild(table);

  // Expandable JSON view toggle
  const jsonToggle = document.createElement('div');
  jsonToggle.className = 'products-json-toggle';
  jsonToggle.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg> <span>Show parsed JSON</span>`;

  const jsonExpanded = getSectionExpandedState('_inline:products-json', false);
  const jsonContent = document.createElement('div');
  jsonContent.className = `products-json-content${jsonExpanded ? '' : ' collapsed'}`;
  if (jsonExpanded) jsonToggle.classList.add('expanded');

  // Create JSON viewer for parsed products
  const jsonContainer = document.createElement('div');
  jsonContainer.className = 'json-viewer';
  renderJSON(jsonContainer, products, { copyableData: products });
  jsonContent.appendChild(jsonContainer);

  // Also show raw string
  const rawDiv = document.createElement('div');
  rawDiv.className = 'products-raw';
  rawDiv.innerHTML = `<span class="products-raw-label">Raw:</span> <code class="products-raw-value">${escapeHtml(rawValue)}</code>`;
  jsonContent.appendChild(rawDiv);

  // Update label to match initial state
  const initialLabel = jsonToggle.querySelector('span');
  if (initialLabel && jsonExpanded) initialLabel.textContent = 'Hide parsed JSON';

  jsonToggle.addEventListener('click', () => {
    jsonContent.classList.toggle('collapsed');
    jsonToggle.classList.toggle('expanded');
    const label = jsonToggle.querySelector('span');
    if (jsonContent.classList.contains('collapsed')) {
      label.textContent = 'Show parsed JSON';
    } else {
      label.textContent = 'Hide parsed JSON';
    }
    saveSectionState('_inline:products-json', jsonContent.classList.contains('collapsed'));
  });

  wrapper.appendChild(jsonToggle);
  wrapper.appendChild(jsonContent);

  return wrapper;
}

/**
 * Render Adobe Launch / ACDL event detail
 * Single-column layout: Overview, Event Data, adobeDataLayer State
 * Similar to Tealium view - Adobe's data layer implementation
 */
function renderAdobeLaunchDetail(event) {
  const container = document.createElement('div');
  container.className = 'detail-layout';

  // Feature #113: build descriptor list, then apply user order.
  const descriptors = [];

  // Overview card
  const source = event.formatted?.source || 'adobeDataLayer';
  const overviewData = {
    'Event': event.formatted?.eventName || event.eventName,
    'Source': source === '_satellite' ? '_satellite.track()' : 'adobeDataLayer.push()',
    'Event #': event.formatted?.eventIndex
  };
  if (event.formatted?.isHistorical) {
    overviewData['Note'] = 'Historical (before debugger loaded)';
  }
  const categoryInfo = _deps.getCategoryInfo(event.platform);
  const overviewEl = createOverviewCard(overviewData, { event, categoryInfo });
  descriptors.push({ id: 'overview', present: true, render: () => overviewEl });

  // About Tool section (collapsed by default)
  const aboutSection = createAboutToolSection(event.platform);
  if (aboutSection) {
    descriptors.push({ id: 'about-tool', present: true, render: () => aboutSection });
  }

  // Event Data section (Adobe's equivalent of dataLayer.push)
  const eventData = event.formatted?.eventData || {};
  const eventDataTitle = source === '_satellite'
    ? '_satellite.track() Data'
    : 'adobeDataLayer.push() Data';
  // Maps to the same stable id as GTM's dataLayer.push so a user
  // who promoted 'datalayer-push' to the top sees Adobe's equivalent
  // promoted too.
  const pushEl = createDataSection(eventDataTitle, eventData, { sectionId: 'datalayer-push' });
  descriptors.push({ id: 'datalayer-push', present: true, render: () => pushEl });

  // adobeDataLayer State section (Adobe's equivalent of Computed dataLayer)
  const adobeDataLayerState = event.formatted?.adobeDataLayerState || {};
  const stateCount = Object.keys(adobeDataLayerState).length;
  const stateTitle = stateCount > 0 ? `adobeDataLayer State (${stateCount})` : 'adobeDataLayer State';
  const stateEl = createDataSection(stateTitle, adobeDataLayerState, { tall: true, sectionId: 'computed-datalayer' });
  descriptors.push({ id: 'computed-datalayer', present: true, render: () => stateEl });

  _appendOrderedSections(container, descriptors);
  return container;
}

/**
 * Render a Tealium utag_data event (the Universal Data Object) with a dedicated
 * data-layer detail view, modeled on renderAdobeLaunchDetail so all three data
 * layers — GTM dataLayer, Adobe adobeDataLayer, Tealium utag_data — read the same
 * (Feature #152).
 *
 * Two data-layer sections carry GTM/Adobe's stable section ids so they move in
 * lockstep when a user reorders sections (Feature #113):
 *   - 'datalayer-push'      → the flat "utag_data" object (business data)
 *   - 'computed-datalayer'  → the categorized "utag_data State" (full UDO,
 *                             including the system keys the flat section strips)
 *
 * Routed AHEAD of the formatted.overview shortcut in renderEventDetail (#152) —
 * utag_data events set formatted.overview, so without that ordering they'd be
 * caught by the generic renderer first. utag.view()/utag.link() (platform
 * 'tealium') are tag-manager API calls and keep the generic renderer.
 */
function renderTealiumDataLayerDetail(event) {
  const container = document.createElement('div');
  container.className = 'detail-layout';
  const formatted = event.formatted || {};
  const descriptors = [];

  // Overview card
  const overviewData = formatted.overview || {};
  const categoryInfo = _deps.getCategoryInfo(event.platform);
  const overviewCard = createOverviewCard(overviewData, { event, categoryInfo });
  descriptors.push({ id: 'overview', present: true, render: () => overviewCard });

  // About Tool section (collapsed by default)
  const aboutSection = createAboutToolSection(event.platform);
  if (aboutSection) {
    descriptors.push({ id: 'about-tool', present: true, render: () => aboutSection });
  }

  // Parser sections: the flat "utag_data" object (the push equivalent) plus an
  // optional Products section for e-commerce UDOs. The "utag_data" section takes
  // the shared 'datalayer-push' id so it reorders in lockstep with GTM's
  // dataLayer.push / Adobe's adobeDataLayer.push() Data.
  if (Array.isArray(formatted.sections)) {
    for (const section of formatted.sections) {
      if (!section.data) continue;
      const hasData = Array.isArray(section.data)
        ? section.data.length > 0
        : Object.keys(section.data).length > 0;
      if (!hasData) continue;
      const sectionId = section.title === 'utag_data'
        ? 'datalayer-push'
        : _formattedIdFor(section.title);
      const el = createDataSection(section.title, section.data, {
        expanded: section.expanded !== false,
        displayMode: section.type === 'table' ? 'table' : undefined,
        sortRows: section.sortRows !== false,
        sectionId
      });
      descriptors.push({ id: sectionId, present: true, render: () => el });
    }
  }

  // utag_data State section — Tealium's infrastructure keys (cp.*, dom.*, ut.*, …),
  // the equivalent of GTM's Computed dataLayer / Adobe's adobeDataLayer State. Present
  // only when the push actually carried system keys (#152); a business-only utag_data
  // (the common case — system keys ride the Collect beacon, not the push) shows just the
  // flat object section above, with no redundant duplicate.
  const state = formatted.dataLayerState;
  if (state && state.count > 0) {
    const stateEl = createDataSection(`utag_data State (${state.count})`, state.data, { tall: true, sectionId: 'computed-datalayer' });
    descriptors.push({ id: 'computed-datalayer', present: true, render: () => stateEl });
  }

  // Raw Request — the verbatim push object (_eventData / _utag_data / push source).
  // The dedicated renderer initially dropped this (modeled on Adobe's minimal view),
  // but users rely on the raw JSON for utag_data; restored to match the pre-#152 view.
  // Expanded by default, mirroring the generic renderer's behaviour for utag_data
  // (which carries no formatted.params, so its Raw Request defaulted to expanded).
  const rawForDisplay = filterRawForDisplay(event.raw);
  if (hasRawData(rawForDisplay)) {
    const rawEl = createDataSection('Raw Request', rawForDisplay, {
      expanded: true,
      platformId: event.platform,
      sectionId: 'raw-request'
    });
    descriptors.push({ id: 'raw-request', present: true, render: () => rawEl });
  }

  _appendOrderedSections(container, descriptors);
  return container;
}

/**
 * Render event detail using the standardized configured format.
 * Used for all tools that output formatted.overview (both config-driven and migrated custom parsers).
 * Single-column layout: Overview, [Consent chips], About Tool, [Extra Sections], Parsed Data, Raw Request
 */
function renderConfiguredDetail(event, options = {}) {
  const { showTriggerCorrelation = true } = options;
  const container = document.createElement('div');
  container.className = 'detail-layout';
  const formatted = event.formatted || {};

  // Build sections as descriptor list (feature #113) so the user's
  // stored eventDetailSectionOrder can re-order them. Build everything
  // eagerly (preserving today's conditional-presence checks); push
  // each built element with its stable id; apply user order; append.
  const descriptors = [];

  // Overview card - reads formatted.overview directly (human-readable labels)
  const overviewData = formatted.overview || {};
  const categoryInfo = _deps.getCategoryInfo(event.platform);
  const overviewCard = createOverviewCard(overviewData, {
    event,
    triggeredBy: showTriggerCorrelation ? event.triggeredBy : null,
    rawData: event.raw,
    categoryInfo,
    consentSignals: formatted.consentSignals || null
  });
  descriptors.push({ id: 'overview', present: true, render: () => overviewCard });

  // AI Summary section (collapsed by default) — Event Explainer #17
  const aiSummary = renderAISummarySection(event);
  if (aiSummary) {
    descriptors.push({ id: 'ai-summary', present: true, render: () => aiSummary });
  }

  // Unified Consent Check section (replaces Google-only consent for configured events)
  const consentSection = createUnifiedConsentSection(event, formatted.googleConsentMode);
  if (consentSection) {
    consentSection.classList.add('consent-check-ui');
    descriptors.push({ id: 'consent', present: true, render: () => consentSection });
  }

  // About Tool section (collapsed by default)
  const aboutSection = createAboutToolSection(event.platform);
  if (aboutSection) {
    descriptors.push({ id: 'about-tool', present: true, render: () => aboutSection });
  }

  // Cookies section — unified Set + Sent with per-row direction badge
  const unifiedCookiesKnown = buildUnifiedCookieList(extractSetCookies(event), extractSentCookies(event));
  if (unifiedCookiesKnown.length > 0) {
    const cookieContent = buildEditableCookieContent(unifiedCookiesKnown, event);
    const cookieButtons = createCookieHeaderButtons(unifiedCookiesKnown, event, cookieContent);
    const cookieSectionKnown = createDataSection(
      buildCookieSectionTitle(unifiedCookiesKnown),
      cookieContent,
      { expanded: false, headerActions: cookieButtons, tags: buildCookieNameTags(unifiedCookiesKnown), tagClass: 'cookie-name-chip', sectionId: 'cookies' }
    );
    cookieSectionKnown.classList.add('cookie-detection-ui');
    descriptors.push({ id: 'cookies', present: true, render: () => cookieSectionKnown });
  }

  // Additional sections (if any - e.g., Adobe Analytics eVars, Props, Events, Products)
  if (formatted.sections && Array.isArray(formatted.sections)) {
    for (const section of formatted.sections) {
      // Skip Consent Mode section — when Auto/Only it's integrated into the
      // unified Consent section; when Off the user doesn't want consent UI
      if (section.title === 'Consent Mode') {
        continue;
      }
      const sectionId = _formattedIdFor(section.title);
      // Handle products-table type specially
      if (section.type === 'products-table' && Array.isArray(section.data) && section.data.length > 0) {
        const productsContent = createProductsTableContent(section.data, section.rawValue || '');
        const el = createDataSection(
          section.title,
          productsContent,
          { expanded: section.expanded !== false, sectionId }
        );
        descriptors.push({ id: sectionId, present: true, render: () => el });
      } else if (section.type === 'table' && section.data && Object.keys(section.data).length > 0) {
        // Property table layout for human-readable structured sections
        const el = createDataSection(
          section.title,
          section.data,
          { expanded: section.expanded !== false, displayMode: 'table', sortRows: section.sortRows !== false, sectionId }
        );
        descriptors.push({ id: sectionId, present: true, render: () => el });
      } else if (section.data && (Array.isArray(section.data) ? section.data.length > 0 : Object.keys(section.data).length > 0)) {
        const el = createDataSection(
          section.title,
          section.data,
          { expanded: section.expanded !== false, sectionId }
        );
        descriptors.push({ id: sectionId, present: true, render: () => el });
      }
    }
  }

  // Parsed Data section - all params with raw/short names
  // Pass platformId for lazy-loading descriptions when Labels button is clicked
  const params = formatted.params || {};
  const parsedDataOptions = {
    platformId: event.platform,
    sectionId: 'parsed-data'
  };
  if (formatted.tags && formatted.tags.length > 0) {
    parsedDataOptions.tags = formatted.tags;
  }
  if (formatted.parsedDisplayMode) {
    parsedDataOptions.displayMode = formatted.parsedDisplayMode;
  }
  if (!isDataEmpty(params)) {
    const parsedDataEl = createDataSection('Parsed Data', params, parsedDataOptions);
    descriptors.push({ id: 'parsed-data', present: true, render: () => parsedDataEl });
  }

  // Raw Request section - expand if Parsed Data is empty
  // Filter out internal keys (initiator, _har) that are used by extension features but noisy for users
  const rawForDisplay = filterRawForDisplay(event.raw);
  const expandRaw = isDataEmpty(params) && hasRawData(rawForDisplay);
  const rawEl = createDataSection('Raw Request', rawForDisplay, {
    expanded: expandRaw,
    platformId: event.platform,
    sectionId: 'raw-request'
  });
  descriptors.push({ id: 'raw-request', present: true, render: () => rawEl });

  _appendOrderedSections(container, descriptors);
  return container;
}

/**
 * Create action bar for unknown events — Report Missing Tool / Ignore
 * Shown between the overview card and parsed data sections
 */
/**
 * Create an info box for events identified by structural fingerprinting.
 * Shows explanation, confidence, and "Add as Custom Endpoint" / "Not [platform]" actions.
 * @param {Object} event - The event object with formatted.fingerprint data
 * @returns {HTMLElement}
 */
function createFingerprintInfoBox(event) {
  const fp = event.formatted.fingerprint;
  const platformName = event.platformName || fp.platformId;
  const confidence = fp.confidence;

  const box = document.createElement('div');
  box.className = 'fingerprint-info-box';

  // Info icon + title
  const header = document.createElement('div');
  header.className = 'fingerprint-info-box__header';
  header.innerHTML = `<svg class="fingerprint-info-box__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><span class="fingerprint-info-box__title">Assumed platform match</span><span class="fingerprint-info-box__confidence ${confidence}">${confidence}</span>`;
  box.appendChild(header);

  // Explanation text
  const desc = document.createElement('p');
  desc.className = 'fingerprint-info-box__desc';
  desc.textContent = `This event was identified as ${platformName} based on its payload structure (${fp.reason}), not by URL. This match could be incorrect.`;
  box.appendChild(desc);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'fingerprint-info-box__actions';

  const addBtn = document.createElement('button');
  addBtn.className = 'action-btn action-btn--accent';
  addBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>Add as Custom Endpoint`;
  addBtn.title = `Confirm this is ${platformName} and add the hostname as a custom endpoint`;
  addBtn.addEventListener('click', () => {
    try {
      const url = new URL(event.raw?.url || '');
      _deps.openToolsModalForCustomEndpoint({
        domain: url.hostname,
        path: url.pathname,
        platformId: fp.platformId
      });
    } catch {
      _deps.openToolsModalForCustomEndpoint({ platformId: fp.platformId });
    }
    trackEvent('fingerprint_action', { action: 'add_endpoint', platform: fp.platformId, confidence });
  });

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'action-btn';
  dismissBtn.textContent = `Not ${platformName}`;
  dismissBtn.title = `Dismiss this suggestion — events from this hostname will revert to Unknown`;
  dismissBtn.addEventListener('click', () => {
    try {
      const url = new URL(event.raw?.url || '');
      _deps.dismissFingerprintSuggestion(url.hostname, event.id);
    } catch {
      // URL parse failed — still dismiss
    }
    trackEvent('fingerprint_action', { action: 'dismiss', platform: fp.platformId, confidence });
  });

  actions.appendChild(addBtn);
  actions.appendChild(dismissBtn);
  box.appendChild(actions);

  return box;
}

function createUnknownEventActions(event) {
  const bar = document.createElement('div');
  bar.className = 'event-action-bar';

  // Icon + "Not recognized" label
  bar.innerHTML = `<svg class="event-action-bar__icon event-action-bar__icon--warn" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span class="event-action-bar__label">Not recognized</span>`;

  const reportBtn = document.createElement('button');
  reportBtn.className = 'action-btn action-btn--warn';
  reportBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>Report tool`;
  reportBtn.title = 'Report as missing tool or endpoint';
  reportBtn.addEventListener('click', () => _deps.openReportModalForEvent(event));

  const ignoreBtn = document.createElement('button');
  ignoreBtn.className = 'action-btn';
  ignoreBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>Ignore`;
  ignoreBtn.title = 'Hide this endpoint — events from this URL pattern will be hidden';
  ignoreBtn.addEventListener('click', () => _deps.ignoreEndpoint(event));

  const addEndpointBtn = document.createElement('button');
  addEndpointBtn.className = 'action-btn action-btn--accent';
  addEndpointBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>Add endpoint`;
  addEndpointBtn.title = 'Map this URL to a known or custom tool';
  addEndpointBtn.addEventListener('click', () => {
    try {
      const url = new URL(event.raw?.url || '');
      _deps.openToolsModalForCustomEndpoint({
        domain: url.hostname,
        path: url.pathname
      });
    } catch {
      _deps.openToolsModalForCustomEndpoint({});
    }
    trackEvent('custom_endpoint', { action: 'open_form', source: 'unknown_event', feature: 'event_detail' });
  });

  bar.appendChild(reportBtn);
  bar.appendChild(addEndpointBtn);
  bar.appendChild(ignoreBtn);

  return bar;
}

/**
 * Reconstruct the full dataLayer.push() payload from a captured event
 * @param {Object} event - The captured event object
 * @returns {Object|Array} The full push payload ready for dataLayer.push()
 */
function reconstructPushPayload(event) {
  const pushData = event.formatted?.pushData;

  // Array-type pushes (consent commands like ["consent", "update", {...}]) — use as-is
  if (Array.isArray(pushData)) {
    return pushData;
  }

  // Object-type pushes — reconstruct by combining event name with push data
  const payload = {};
  if (event.formatted?.event) {
    payload.event = event.formatted.event;
  }
  if (pushData && typeof pushData === 'object') {
    Object.assign(payload, pushData);
  }
  return payload;
}

/**
 * Send a dataLayer.push() payload to the inspected page via the reverse messaging channel
 * Panel → Service Worker → Content Script → Page Script → dataLayer.push()
 * @param {Object|Array} payload - The data to push to dataLayer
 */
function pushDataLayerToPage(payload) {
  chrome.runtime.sendMessage({
    type: MSG.PUSH_DATALAYER_EVENT,
    payload: payload,
    tabId: chrome.devtools.inspectedWindow.tabId
  });
}

/**
 * Create Push Again / Edit & Push buttons for the dataLayer.push section header
 * @param {Object} event - The captured dataLayer event
 * @returns {HTMLElement[]} Array of button elements
 */
function createDataLayerPushButtons(event) {
  // Push Again button (green)
  const pushAgainBtn = document.createElement('button');
  pushAgainBtn.className = 'datalayer-push-btn datalayer-push-btn-green';
  pushAgainBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>Push again`;
  pushAgainBtn.title = 'Re-push this dataLayer event to the page';
  pushAgainBtn.addEventListener('click', () => {
    const payload = reconstructPushPayload(event);
    pushDataLayerToPage(payload);
    trackEvent('datalayer_push', { action: 'push_again' });

    // Brief visual feedback
    pushAgainBtn.textContent = 'Pushed!';
    pushAgainBtn.disabled = true;
    setTimeout(() => {
      pushAgainBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>Push again`;
      pushAgainBtn.disabled = false;
    }, 1500);
  });

  // Edit & Push button
  const editPushBtn = document.createElement('button');
  editPushBtn.className = 'datalayer-push-btn';
  editPushBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit & Push`;
  editPushBtn.title = 'Edit the payload JSON and push to the page';
  editPushBtn.addEventListener('click', () => {
    const payload = reconstructPushPayload(event);
    showEditPushModal(payload);
    trackEvent('datalayer_push', { action: 'edit_open' });
  });

  return [pushAgainBtn, editPushBtn];
}

/**
 * Show modal overlay for editing a dataLayer payload before pushing
 * @param {Object|Array} payload - The initial payload to edit
 */
function showEditPushModal(payload) {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'datalayer-edit-overlay';

  const modal = document.createElement('div');
  modal.className = 'datalayer-edit-modal';

  // Header
  const header = document.createElement('div');
  header.className = 'datalayer-edit-header';
  header.textContent = 'Edit & Push to dataLayer';
  modal.appendChild(header);

  // Warning
  const warning = document.createElement('div');
  warning.className = 'datalayer-edit-warning';
  warning.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>This will fire a real dataLayer.push(). Tags may send data to analytics platforms.`;
  modal.appendChild(warning);

  // Textarea
  const textarea = document.createElement('textarea');
  textarea.className = 'datalayer-edit-textarea';
  textarea.value = safeStringify(payload, { space: 2 });
  textarea.spellcheck = false;
  modal.appendChild(textarea);

  // Error message
  const errorEl = document.createElement('div');
  errorEl.className = 'datalayer-edit-error';
  errorEl.style.display = 'none';
  modal.appendChild(errorEl);

  // Button row
  const buttons = document.createElement('div');
  buttons.className = 'datalayer-edit-buttons';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'datalayer-push-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    overlay.remove();
    trackEvent('datalayer_push', { action: 'edit_cancel' });
  });

  const pushBtn = document.createElement('button');
  pushBtn.className = 'datalayer-push-btn datalayer-push-btn-primary';
  pushBtn.textContent = 'Push to dataLayer';
  pushBtn.addEventListener('click', () => {
    try {
      const editedPayload = parseDataLayerInput(textarea.value);
      pushDataLayerToPage(editedPayload);
      trackEvent('datalayer_push', { action: 'edit_and_push' });
      overlay.remove();
    } catch (e) {
      errorEl.textContent = `Invalid input: ${e.message}`;
      errorEl.style.display = 'block';
    }
  });

  buttons.appendChild(cancelBtn);
  buttons.appendChild(pushBtn);
  modal.appendChild(buttons);

  // Validate input on every keystroke — accepts JSON, dataLayer.push(...) wrappers, and JS object literals
  textarea.addEventListener('input', () => {
    try {
      parseDataLayerInput(textarea.value);
      pushBtn.disabled = false;
      errorEl.style.display = 'none';
    } catch (e) {
      pushBtn.disabled = true;
      errorEl.textContent = `Invalid input: ${e.message}`;
      errorEl.style.display = 'block';
    }
  });

  // Close on overlay click (outside modal)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      trackEvent('datalayer_push', { action: 'edit_cancel' });
    }
  });

  // Close on Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
      trackEvent('datalayer_push', { action: 'edit_cancel' });
    }
  };
  document.addEventListener('keydown', handleEscape);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  textarea.focus();
}

// =============================================================================
// COOKIE SECTION — Delete & Edit inline actions
// =============================================================================

/** 13 months in seconds — ePrivacy recommended maximum cookie lifetime */
const EPRIVACY_COOKIE_MAX_SECONDS = 13 * 30 * 86400;

/**
 * Build section title for cookies with count.
 * @param {Array} cookies - Array of cookie objects with .name property
 * @returns {string} Title like "Cookie Set (2)"
 */
function buildCookieSectionTitle(cookies) {
  return `Cookies (${cookies.length})`;
}

/**
 * Build a small inline badge marking a cookie's direction in the unified
 * Cookies section: 'set' / 'sent' / 'set+sent'.
 * @param {string} direction
 * @returns {HTMLElement}
 */
function buildDirectionBadge(direction) {
  const badge = document.createElement('span');
  const variant = direction === 'set+sent' ? 'set-sent' : direction;
  badge.className = `cookie-direction-badge cookie-direction-${variant}`;
  badge.textContent = direction === 'set' ? 'Set'
    : direction === 'sent' ? 'Sent'
    : 'Set & Sent';
  return badge;
}

/**
 * Build cookie name tags for section header chips.
 * Includes names until ~50 chars total, then shows "+N" for overflow.
 * Dedupes by name — a cookie that appears as both Set and Sent (with different
 * values) shows once in the chip row.
 * @param {Array} cookies - Array of cookie objects with .name property
 * @returns {string[]} Tag strings for the tags option
 */
function buildCookieNameTags(cookies) {
  const maxLen = 50;
  const names = [...new Set(cookies.map(c => c.name))];
  let totalLen = 0;
  const shown = [];

  for (let i = 0; i < names.length; i++) {
    const nameLen = names[i].length;
    if (totalLen + nameLen > maxLen && shown.length > 0) {
      shown.push(`+${names.length - shown.length}`);
      return shown;
    }
    shown.push(names[i]);
    totalLen += nameLen;
  }

  return shown;
}

/**
 * Construct URL for chrome.cookies API from a parsed cookie and its source event
 * @param {Object} cookie - Parsed cookie from extractSetCookies
 * @param {Object} event - The captured event
 * @returns {string} URL for chrome.cookies API calls
 */
function buildCookieUrl(cookie, event) {
  let domain = '';
  if (cookie.attributes.domain) {
    domain = cookie.attributes.domain.replace(/^\./, '');
  } else {
    try { domain = new URL(event.raw?.url || '').hostname; } catch { /* fallback */ }
  }
  const path = cookie.attributes.path || '/';
  const scheme = cookie.attributes.secure ? 'https' : 'http';
  return `${scheme}://${domain}${path}`;
}

/**
 * Build an editable cookie content element for the Cookies Set section.
 * Renders the same prop-table-viewer structure as renderPropertyTable but with
 * inline editing support and per-cookie delete buttons (when multiple cookies).
 * @param {Array} cookies - Parsed cookie objects from extractSetCookies
 * @param {Object} event - The captured event
 * @returns {HTMLElement} Content element for createDataSection
 */
function buildEditableCookieContent(cookies, event) {
  const container = document.createElement('div');
  container.className = 'prop-table-viewer';

  // Toolbar (copy button)
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
    const data = buildUnifiedCookiesCopyData(cookies);
    copyTextFallback(safeStringify(data, { space: 2 }), copyBtn);
  });
  toolbar.appendChild(copyBtn);
  container.appendChild(toolbar);

  const isMultiple = cookies.length > 1;

  cookies.forEach((cookie, index) => {
    const group = document.createElement('div');
    group.className = 'prop-table-group';
    group.dataset.cookieIndex = index;

    // Group header
    const header = document.createElement('div');
    header.className = 'prop-table-group-header';

    if (isMultiple) {
      header.classList.add('cookie-group-header-multi');

      const nameWrap = document.createElement('span');
      nameWrap.className = 'cookie-name-wrap';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = cookie.name;
      nameWrap.appendChild(nameSpan);
      if (cookie.direction) nameWrap.appendChild(buildDirectionBadge(cookie.direction));
      header.appendChild(nameWrap);

      // Sent-only cookies come from the request Cookie header; no domain/path
      // is recoverable so chrome.cookies.remove can't scope to them. Skip
      // per-cookie delete affordance for those rows.
      if (cookie.direction === 'sent') {
        // No per-cookie delete button.
      } else {
      const perDeleteBtn = document.createElement('button');
      perDeleteBtn.className = 'cookie-inline-delete-btn';
      perDeleteBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Delete`;
      perDeleteBtn.title = `Delete ${cookie.name}`;
      perDeleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const url = buildCookieUrl(cookie, event);
        try {
          await chrome.cookies.remove({ url, name: cookie.name });
          trackEvent('cookie_action', { action: 'delete', cookie_count: 1 });
          perDeleteBtn.textContent = 'Deleted!';
          perDeleteBtn.disabled = true;
          setTimeout(() => {
            group.remove();
            // If no groups left, remove the entire section
            if (container.querySelectorAll('.prop-table-group').length === 0) {
              container.closest('.detail-section-card')?.remove();
            }
          }, 800);
        } catch {
          perDeleteBtn.textContent = 'Failed';
          setTimeout(() => {
            perDeleteBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Delete`;
            perDeleteBtn.disabled = false;
          }, 1500);
        }
      });
      header.appendChild(perDeleteBtn);
      } // end of else (cookie.direction !== 'sent')
    } else {
      // Single cookie: name + direction badge. No per-cookie delete — the
      // section header carries the Delete action when the cookie is settable.
      header.classList.add('cookie-group-header-multi');
      const singleWrap = document.createElement('span');
      singleWrap.className = 'cookie-name-wrap';
      const singleName = document.createElement('span');
      singleName.textContent = cookie.name;
      singleWrap.appendChild(singleName);
      if (cookie.direction) singleWrap.appendChild(buildDirectionBadge(cookie.direction));
      header.appendChild(singleWrap);
    }

    group.appendChild(header);

    // Build rows for this cookie
    const rows = document.createElement('div');
    rows.className = 'prop-table-rows';

    // Define fields with their display values and edit types.
    // Sent-only cookies come from the outbound Cookie request header which
    // carries name=value pairs only — no Domain/Path/Expires/SameSite/Secure/
    // HttpOnly attributes exist for them, and there's nothing to "save back",
    // so the Value is read-only.
    const fields = [];
    const isSentOnly = cookie.direction === 'sent';

    if (cookie.value) {
      const displayVal = cookie.value.length > 50 ? cookie.value.slice(0, 50) + '...' : cookie.value;
      fields.push({
        key: 'Value',
        display: displayVal,
        editValue: cookie.value,
        type: isSentOnly ? 'readonly' : 'text'
      });
    }
    if (!isSentOnly && cookie.attributes.domain) {
      fields.push({ key: 'Domain', display: cookie.attributes.domain, editValue: cookie.attributes.domain, type: 'text' });
    }
    if (!isSentOnly && cookie.attributes.path) {
      fields.push({ key: 'Path', display: cookie.attributes.path, editValue: cookie.attributes.path, type: 'text' });
    }
    if (!isSentOnly && cookie.expiresIn) {
      let expiryText = cookie.expiresIn;
      if (cookie.expirySeconds > EPRIVACY_COOKIE_MAX_SECONDS) {
        expiryText += '  \u26A0 Exceeds 13-month ePrivacy recommendation';
      }
      fields.push({ key: 'Expires', display: expiryText, type: 'readonly' });
    }
    if (!isSentOnly) {
      fields.push({
        key: 'SameSite',
        display: cookie.attributes.sameSite || 'Not set (defaults to Lax)',
        editValue: cookie.attributes.sameSite || '',
        type: 'select',
        options: [
          { value: '', label: 'Not set (defaults to Lax)' },
          { value: 'Lax', label: 'Lax' },
          { value: 'Strict', label: 'Strict' },
          { value: 'None', label: 'None' }
        ]
      });
      fields.push({ key: 'Secure', display: cookie.attributes.secure ? 'Yes' : 'No', editValue: cookie.attributes.secure ? 'Yes' : 'No', type: 'toggle' });
      fields.push({ key: 'HttpOnly', display: cookie.attributes.httpOnly ? 'Yes' : 'No', editValue: cookie.attributes.httpOnly ? 'Yes' : 'No', type: 'toggle' });
      if (cookie.attributes.partitioned) {
        fields.push({ key: 'Partitioned', display: 'Yes', type: 'readonly' });
      }
    }

    for (const field of fields) {
      const row = document.createElement('div');
      row.className = 'prop-table-row';
      row.dataset.fieldKey = field.key;

      const keyEl = document.createElement('span');
      keyEl.className = 'prop-table-key';
      keyEl.textContent = field.key;

      const valueEl = document.createElement('span');
      valueEl.className = 'prop-table-value';
      valueEl.textContent = field.display;
      valueEl.dataset.editType = field.type;
      if (field.editValue !== undefined) valueEl.dataset.editValue = field.editValue;
      if (field.options) valueEl.dataset.editOptions = JSON.stringify(field.options);

      row.appendChild(keyEl);
      row.appendChild(valueEl);
      rows.appendChild(row);
    }

    group.appendChild(rows);
    container.appendChild(group);
  });

  return container;
}

/**
 * Create header action buttons for the Cookie section
 * @param {Array} cookies - Parsed cookie objects
 * @param {Object} event - The captured event
 * @param {HTMLElement} contentEl - The cookie content element (for edit toggling)
 * @returns {HTMLElement[]} Array of button elements [deleteBtn, editBtn]
 */
function createCookieHeaderButtons(cookies, event, contentEl) {
  const buttons = [];
  const trashIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
  const editIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

  // Delete / Edit only operate on cookies that exist on disk — i.e. those
  // surfaced via Set-Cookie response headers ('set' or 'set+sent'). Sent-only
  // cookies come from the request Cookie header and have no recoverable
  // domain/path to scope chrome.cookies.remove against.
  const deletableEntries = cookies
    .map((cookie, index) => ({ cookie, index }))
    .filter(entry => entry.cookie.direction !== 'sent');
  const deletable = deletableEntries.map(e => e.cookie);
  if (deletable.length === 0) return buttons;

  // Delete / Delete All button (red)
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'datalayer-push-btn cookie-delete-btn';
  if (deletable.length === 1) {
    deleteBtn.innerHTML = `${trashIcon}Delete`;
    deleteBtn.title = `Delete cookie "${deletable[0].name}"`;
  } else {
    deleteBtn.innerHTML = `${trashIcon}Delete All`;
    deleteBtn.title = `Delete all ${deletable.length} cookies`;
  }
  deleteBtn.addEventListener('click', async () => {
    deleteBtn.disabled = true;
    const results = await Promise.allSettled(
      deletable.map(c => chrome.cookies.remove({ url: buildCookieUrl(c, event), name: c.name }))
    );
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    trackEvent('cookie_action', { action: deletable.length === 1 ? 'delete' : 'delete_all', cookie_count: successCount });

    deleteBtn.textContent = successCount === deletable.length ? 'Deleted!' : `Deleted ${successCount}/${deletable.length}`;
    setTimeout(() => {
      // Remove only the deletable rows; sent-only rows stay visible.
      for (const { index } of deletableEntries) {
        contentEl.querySelector(`.prop-table-group[data-cookie-index="${index}"]`)?.remove();
      }
      // If no rows remain, dismiss the whole section card.
      if (contentEl.querySelectorAll('.prop-table-group').length === 0) {
        contentEl.closest('.detail-section-card')?.remove();
      }
    }, 800);
  });
  buttons.push(deleteBtn);

  // Edit button
  const editBtn = document.createElement('button');
  editBtn.className = 'datalayer-push-btn';
  editBtn.innerHTML = `${editIcon}Edit`;
  editBtn.title = 'Edit cookie values inline';
  editBtn.addEventListener('click', () => {
    // Auto-expand the section if collapsed so edit fields are visible
    const card = contentEl.closest('.detail-section-card');
    if (card) {
      const hdr = card.querySelector('.detail-section-card-header');
      const cnt = card.querySelector('.detail-section-card-content');
      if (hdr?.classList.contains('collapsed')) {
        hdr.classList.remove('collapsed');
        cnt.classList.remove('collapsed');
      }
    }
    toggleCookieEditMode(contentEl, cookies, event, editBtn);
  });
  buttons.push(editBtn);

  return buttons;
}

/**
 * Toggle inline edit mode for cookie content.
 * Converts value cells to inputs/selects and adds per-cookie Save buttons.
 */
function toggleCookieEditMode(contentEl, cookies, event, editBtn) {
  const editIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const isEditing = contentEl.classList.toggle('cookie-edit-mode');

  if (isEditing) {
    editBtn.textContent = 'Cancel';
    trackEvent('cookie_action', { action: 'edit_open' });

    cookies.forEach((cookie, index) => {
      // Sent-only cookies have nothing editable — Value is the only field and
      // it's read-only since there's no Set-Cookie target to write back to.
      if (cookie.direction === 'sent') return;
      const group = contentEl.querySelector(`.prop-table-group[data-cookie-index="${index}"]`);
      if (!group) return;

      // Convert value cells to inputs
      for (const valueEl of group.querySelectorAll('.prop-table-value')) {
        const editType = valueEl.dataset.editType;
        if (editType === 'readonly') continue;

        valueEl.dataset.originalDisplay = valueEl.textContent;

        if (editType === 'text') {
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'cookie-edit-input';
          input.value = valueEl.dataset.editValue || valueEl.textContent;
          valueEl.textContent = '';
          valueEl.appendChild(input);
        } else if (editType === 'select') {
          const select = document.createElement('select');
          select.className = 'cookie-edit-select';
          const options = JSON.parse(valueEl.dataset.editOptions || '[]');
          for (const opt of options) {
            const optEl = document.createElement('option');
            optEl.value = opt.value;
            optEl.textContent = opt.label;
            if (opt.value === (valueEl.dataset.editValue || '')) optEl.selected = true;
            select.appendChild(optEl);
          }
          valueEl.textContent = '';
          valueEl.appendChild(select);
        } else if (editType === 'toggle') {
          const select = document.createElement('select');
          select.className = 'cookie-edit-select';
          for (const v of ['Yes', 'No']) {
            const optEl = document.createElement('option');
            optEl.value = v;
            optEl.textContent = v;
            if (v === valueEl.dataset.editValue) optEl.selected = true;
            select.appendChild(optEl);
          }
          valueEl.textContent = '';
          valueEl.appendChild(select);
        }
      }

      // Add Save button row
      const saveRow = document.createElement('div');
      saveRow.className = 'cookie-save-row';
      const saveBtn = document.createElement('button');
      saveBtn.className = 'datalayer-push-btn datalayer-push-btn-primary cookie-save-btn';
      saveBtn.textContent = 'Save';
      saveBtn.addEventListener('click', () => {
        // Collect edited values from inputs
        const editedValues = {};
        for (const row of group.querySelectorAll('.prop-table-row')) {
          const key = row.dataset.fieldKey;
          const input = row.querySelector('.prop-table-value input, .prop-table-value select');
          if (input) editedValues[key] = input.value;
        }

        // Build chrome.cookies.set() details
        const url = buildCookieUrl(cookie, event);
        const sameSiteMap = { '': 'unspecified', 'Lax': 'lax', 'Strict': 'strict', 'None': 'no_restriction' };
        const details = {
          url,
          name: cookie.name,
          value: editedValues.Value ?? cookie.value,
          path: editedValues.Path ?? cookie.attributes.path ?? '/',
          secure: (editedValues.Secure ?? (cookie.attributes.secure ? 'Yes' : 'No')) === 'Yes',
          httpOnly: (editedValues.HttpOnly ?? (cookie.attributes.httpOnly ? 'Yes' : 'No')) === 'Yes',
          sameSite: sameSiteMap[editedValues.SameSite ?? ''] || 'unspecified',
        };
        if (cookie.attributes.domain) details.domain = editedValues.Domain ?? cookie.attributes.domain;

        // Preserve original expiration
        if (cookie.attributes.expires) {
          const d = new Date(cookie.attributes.expires);
          if (!isNaN(d.getTime())) details.expirationDate = d.getTime() / 1000;
        } else if (cookie.attributes.maxAge != null && !isNaN(cookie.attributes.maxAge) && cookie.attributes.maxAge > 0) {
          details.expirationDate = (Date.now() / 1000) + cookie.attributes.maxAge;
        }

        const showSaveError = () => {
          saveBtn.textContent = 'Error';
          saveBtn.classList.add('cookie-save-error');
          setTimeout(() => {
            saveBtn.textContent = 'Save';
            saveBtn.classList.remove('cookie-save-error');
            saveBtn.disabled = false;
          }, 1500);
        };

        // Use .then/.catch instead of await to avoid DevTools "Pause on caught exceptions"
        // triggering a jump to the Sources panel
        chrome.cookies.set(details).then((result) => {
          if (!result) {
            showSaveError();
            return;
          }

          trackEvent('cookie_action', { action: 'edit_save' });

          // Show feedback
          saveBtn.textContent = 'Saved!';
          saveBtn.disabled = true;

          // Update display values and exit edit mode for this group
          for (const row of group.querySelectorAll('.prop-table-row')) {
            const valueEl = row.querySelector('.prop-table-value');
            const input = valueEl?.querySelector('input, select');
            if (input) {
              const newVal = input.value;
              valueEl.dataset.editValue = newVal;
              // Update display text
              if (row.dataset.fieldKey === 'Value') {
                valueEl.textContent = newVal.length > 50 ? newVal.slice(0, 50) + '...' : newVal;
              } else if (row.dataset.fieldKey === 'SameSite' && !newVal) {
                valueEl.textContent = 'Not set (defaults to Lax)';
              } else {
                valueEl.textContent = newVal;
              }
              valueEl.dataset.originalDisplay = valueEl.textContent;
            }
          }
          setTimeout(() => saveRow.remove(), 800);
        }).catch(() => {
          showSaveError();
        });
      });
      saveRow.appendChild(saveBtn);
      group.appendChild(saveRow);
    });
  } else {
    // Exit edit mode — revert all changes
    editBtn.innerHTML = `${editIcon}Edit`;
    trackEvent('cookie_action', { action: 'edit_cancel' });

    for (const valueEl of contentEl.querySelectorAll('.prop-table-value')) {
      if (valueEl.dataset.originalDisplay !== undefined) {
        valueEl.textContent = valueEl.dataset.originalDisplay;
        delete valueEl.dataset.originalDisplay;
      }
    }
    for (const saveRow of contentEl.querySelectorAll('.cookie-save-row')) {
      saveRow.remove();
    }
  }
}

/**
 * Render generic event detail
 * Single-column layout: Overview, Parsed Data, Raw Request
 */
function renderGenericDetail(event, options = {}) {
  const { showTriggerCorrelation = true } = options;
  const container = document.createElement('div');
  container.className = 'detail-layout';

  // Feature #113: build descriptor list, then apply user order.
  const descriptors = [];

  // Overview card - can use internal metadata from _meta
  const overviewData = {
    'Event': event.eventName || 'Unknown'
  };
  if (event.formatted?._meta?.trackingId) {
    overviewData['Tracking ID'] = event.formatted._meta.trackingId;
  }
  const categoryInfo = _deps.getCategoryInfo(event.platform);
  const overviewEl = createOverviewCard(overviewData, {
    event,
    triggeredBy: showTriggerCorrelation ? event.triggeredBy : null,
    rawData: event.raw,
    categoryInfo
  });
  descriptors.push({ id: 'overview', present: true, render: () => overviewEl });

  // AI Summary section (collapsed by default) — Event Explainer #17
  const aiSummaryGen = renderAISummarySection(event);
  if (aiSummaryGen) {
    descriptors.push({ id: 'ai-summary', present: true, render: () => aiSummaryGen });
  }

  // Unified Consent Check section
  const consentSectionGen = createUnifiedConsentSection(event, null);
  if (consentSectionGen) {
    consentSectionGen.classList.add('consent-check-ui');
    descriptors.push({ id: 'consent', present: true, render: () => consentSectionGen });
  }

  // Structural fingerprint info box — shows when event was identified by payload structure.
  // Treated as part of the unknown-event-actions ordinal slot (same conceptual position).
  if (event.formatted?.fingerprint) {
    const fpBox = createFingerprintInfoBox(event);
    descriptors.push({ id: 'fingerprint', present: true, render: () => fpBox });
  }

  // Unknown event action bar — report or ignore
  if (event.platform === 'other') {
    const actionsBar = createUnknownEventActions(event);
    descriptors.push({ id: 'unknown-event-actions', present: true, render: () => actionsBar });
  }

  // About Tool section (collapsed by default)
  const aboutSectionGen = createAboutToolSection(event.platform);
  if (aboutSectionGen) {
    descriptors.push({ id: 'about-tool', present: true, render: () => aboutSectionGen });
  }

  // Cookies section — unified Set + Sent with per-row direction badge
  const unifiedCookiesGeneric = buildUnifiedCookieList(extractSetCookies(event), extractSentCookies(event));
  if (unifiedCookiesGeneric.length > 0) {
    const cookieContentGeneric = buildEditableCookieContent(unifiedCookiesGeneric, event);
    const cookieButtonsGeneric = createCookieHeaderButtons(unifiedCookiesGeneric, event, cookieContentGeneric);
    const cookieSectionGeneric = createDataSection(
      buildCookieSectionTitle(unifiedCookiesGeneric),
      cookieContentGeneric,
      { expanded: false, headerActions: cookieButtonsGeneric, tags: buildCookieNameTags(unifiedCookiesGeneric), tagClass: 'cookie-name-chip', sectionId: 'cookies' }
    );
    cookieSectionGeneric.classList.add('cookie-detection-ui');
    descriptors.push({ id: 'cookies', present: true, render: () => cookieSectionGeneric });
  }

  // Parsed Data section - only show actual event params, not internal metadata
  const parsedData = event.formatted?.params || {};
  const parsedDataTags = event.formatted?.wasDecoded ? ['Decoded'] : [];
  const parsedDataEmpty = Object.keys(parsedData).length === 0;
  const parsedEl = createDataSection('Parsed Data', parsedData, { tags: parsedDataTags, sectionId: 'parsed-data' });
  descriptors.push({ id: 'parsed-data', present: true, render: () => parsedEl });

  // Raw Request section - expand if Parsed Data is empty and Raw Request has data
  if (event.raw) {
    const rawHasData = Object.keys(event.raw).length > 0;
    const expandRaw = parsedDataEmpty && rawHasData;
    const rawForDisplay = filterRawForDisplay(event.raw);
    const rawEl = createDataSection('Raw Request', rawForDisplay, { expanded: expandRaw, sectionId: 'raw-request' });
    descriptors.push({ id: 'raw-request', present: true, render: () => rawEl });
  }

  _appendOrderedSections(container, descriptors);
  return container;
}

/**
 * Render interaction event detail (click, change, or submit marker)
 * Shows element tag, text/label, ID, href, and page context
 * Phase 2: form-specific fields (field type, value for Tier 1, form action/method)
 */
function renderInteractionDetail(event) {
  const container = document.createElement('div');
  container.className = 'detail-layout';
  const raw = event.raw || {};
  const element = raw.element || {};
  const action = raw.action || 'click';

  // Overview card — adapted based on action type
  const overviewData = {
    'Action': action.charAt(0).toUpperCase() + action.slice(1)
  };

  if (action === 'submit') {
    // Form submit: show form identity and action URL
    overviewData['Element'] = 'FORM';
    if (element.id) overviewData['ID'] = `#${element.id}`;
    if (element.name) overviewData['Name'] = element.name;
    if (element.formAction) overviewData['Form Action'] = element.formAction;
    if (element.formMethod) overviewData['Method'] = element.formMethod;
  } else if (action === 'change' || raw.elementType) {
    // Form field change: show element type, field label, and value (Tier 1 only)
    overviewData['Element'] = raw.elementType || element.tagName || 'Unknown';
    if (element.id) overviewData['ID'] = `#${element.id}`;
    if (element.name) overviewData['Name'] = element.name;
    if (raw.isTier1 && raw.value != null) {
      overviewData['Value'] = raw.value;
    } else if (raw.isTier1 === false) {
      overviewData['Value'] = '(not captured \u2014 privacy)';
    }
  } else {
    // Phase 1 click: show element tag, label, ID, link
    overviewData['Element'] = element.tagName || 'Unknown';
    if (element.textContent) overviewData['Label'] = element.textContent;
    if (element.id) overviewData['ID'] = `#${element.id}`;
    if (element.href) overviewData['Link'] = element.href;
  }

  const interactionEventForDisplay = {
    ...event,
    platform: 'interaction-event',
    platformName: 'Interaction'
  };

  // Feature #113: build descriptor list, then apply user order.
  const descriptors = [];

  const overviewEl = createOverviewCard(overviewData, { event: interactionEventForDisplay });
  descriptors.push({ id: 'overview', present: true, render: () => overviewEl });

  // Element Details section
  const elementData = {};
  if (element.tagName) elementData['Tag'] = element.tagName;
  if (element.type) elementData['Input Type'] = element.type;
  if (element.textContent) elementData['Text Content'] = element.textContent;
  if (element.id) elementData['ID'] = `#${element.id}`;
  if (element.name) elementData['Name'] = element.name;
  if (element.href) elementData['href'] = element.href;
  if (element.formAction) elementData['Form Action'] = element.formAction;
  if (element.formMethod) elementData['Method'] = element.formMethod;

  if (Object.keys(elementData).length > 0) {
    const elementEl = createDataSection('Element Details', elementData, { sectionId: 'element-details' });
    descriptors.push({ id: 'element-details', present: true, render: () => elementEl });
  }

  // Page Context section (collapsed by default)
  const pageData = {};
  if (raw.pageUrl) pageData['Page URL'] = raw.pageUrl;
  if (raw.pageHostname) pageData['Hostname'] = raw.pageHostname;

  if (Object.keys(pageData).length > 0) {
    const pageCtxEl = createDataSection('Page Context', pageData, { expanded: false, sectionId: 'page-context' });
    descriptors.push({ id: 'page-context', present: true, render: () => pageCtxEl });
  }

  _appendOrderedSections(container, descriptors);
  return container;
}

/**
 * Render page event detail (page load/SPA page change)
 * Single-column layout with collapsible sections: Overview, URL Details, Page Info
 */
function renderPageDetail(event) {
  const container = document.createElement('div');
  container.className = 'detail-layout';

  // Parse URL for detailed info
  let urlInfo = {};
  try {
    const urlObj = new URL(event.raw?.url || event.formatted?.url || '');
    urlInfo = {
      'Full URL': urlObj.href,
      'Protocol': urlObj.protocol.replace(':', ''),
      'Host': urlObj.host,
      'Pathname': urlObj.pathname || '/',
      'Search': urlObj.search || '(none)',
      'Hash': urlObj.hash || '(none)'
    };
  } catch (e) {
    urlInfo = {
      'Path': event.eventName || '/',
      'URL': event.raw?.url || '(unknown)'
    };
  }

  // Overview card - for page events, we override the platform display
  const overviewData = {
    'Type': event.raw?.isInitial ? 'Initial Page Load' : 'SPA Page Change',
    'Path': event.eventName || '/'
  };

  // Add load duration to overview if available
  if (event.raw?.loadDurationMs != null) {
    const seconds = Math.floor(event.raw.loadDurationMs / 1000);
    const milliseconds = event.raw.loadDurationMs % 1000;
    overviewData['Load Time'] = `${seconds}s ${milliseconds}ms`;
  }
  // Create a modified event object for display purposes
  const pageEventForDisplay = {
    ...event,
    platform: 'page-event',
    platformName: 'Page'
  };

  // Feature #113: build descriptor list, then apply user order.
  const descriptors = [];

  const overviewEl = createOverviewCard(overviewData, { event: pageEventForDisplay });
  descriptors.push({ id: 'overview', present: true, render: () => overviewEl });

  // AI Summary section — scoped to the page, not a single event.
  const aiSummary = renderAISummarySection(event, { scope: 'page' });
  if (aiSummary) {
    descriptors.push({ id: 'ai-summary', present: true, render: () => aiSummary });
  }

  // URL Details section (collapsible)
  const urlEl = createDataSection('URL Details', urlInfo, { sectionId: 'url-details' });
  descriptors.push({ id: 'url-details', present: true, render: () => urlEl });

  // Page Info section (collapsible)
  const pageInfo = {
    'Timestamp': new Date(event.timestamp).toLocaleString(),
    'Page Type': event.raw?.isInitial ? 'Hard navigation (page load)' : 'Soft navigation (SPA/History API)'
  };

  if (event.raw?.navigationStart) {
    pageInfo['Navigation Start'] = new Date(event.raw.navigationStart).toLocaleString();
  }
  if (event.raw?.navigationEnd) {
    pageInfo['Navigation End'] = new Date(event.raw.navigationEnd).toLocaleString();
  }
  if (event.raw?.loadDurationMs != null) {
    const durationSec = (event.raw.loadDurationMs / 1000).toFixed(2);
    pageInfo['Load Duration'] = `${durationSec}s (${event.raw.loadDurationMs}ms)`;
  }

  const pageInfoEl = createDataSection('Page Info', pageInfo, { sectionId: 'page-info' });
  descriptors.push({ id: 'page-info', present: true, render: () => pageInfoEl });

  _appendOrderedSections(container, descriptors);
  return container;
}

/**
 * Render detail view for a consent state marker.
 * Uses the standard card-based layout: Overview card + collapsible "About CMP" section.
 * @param {Object} marker - Consent state marker data
 * @returns {HTMLElement} Detail content element
 */
function renderConsentMarkerDetail(marker) {
  const wrapper = document.createElement('div');
  wrapper.className = 'detail-layout';

  // === Overview Card ===
  // Only Source and Action as KV data — consent categories shown as table below
  const overviewData = {};
  overviewData['Source'] = marker.sourceLabel || marker.source;
  overviewData['Action'] = marker.action;

  // Look up CMP platform to build a real platform badge
  const cmpToolInfo = marker.cmp ? (ENDPOINT_BY_NAME.get(marker.cmp) || null) : null;

  // Build a pseudo-event with CMP platform info for the overview card header
  const pseudoEvent = {
    eventName: marker.actionLabel,
    timestamp: marker.timestamp > 0 ? marker.timestamp : null,
    platform: cmpToolInfo?.id || null,
    platformName: cmpToolInfo?.shortName || marker.cmp || null,
  };

  const card = createOverviewCard(overviewData, { event: pseudoEvent });

  // For T=0 markers, show "T=0" in timestamp area
  if (marker.timestamp === 0) {
    const headerRight = card.querySelector('.overview-header-right');
    if (headerRight) {
      const tsSpan = document.createElement('span');
      tsSpan.className = 'overview-timestamp';
      tsSpan.textContent = 'T=0';
      headerRight.textContent = '';
      headerRight.appendChild(tsSpan);
    }
  }

  // Insert consent state table into the card content (after KV items)
  const cardContent = card.querySelector('.detail-card-content');
  if (cardContent) {
    const consentCategories = ['analytics', 'marketing', 'functional'];
    const hasCategories = marker.categories && consentCategories.some(cat => cat in marker.categories);

    if (hasCategories) {
      const tableWrap = document.createElement('div');
      tableWrap.className = 'consent-insight-table-wrap';
      tableWrap.style.marginTop = '8px';

      const table = document.createElement('table');
      table.className = 'consent-insight-table';

      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      for (const h of ['Category', 'State']) {
        const th = document.createElement('th');
        th.textContent = h;
        headerRow.appendChild(th);
      }
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      for (const cat of consentCategories) {
        const value = marker.categories[cat];
        const tr = document.createElement('tr');

        const catTd = document.createElement('td');
        catTd.className = 'ci-category';
        catTd.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
        tr.appendChild(catTd);

        tr.appendChild(createStateTd(value));
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      tableWrap.appendChild(table);
      cardContent.appendChild(tableWrap);
    }

    if (marker.completeness === 'binary') {
      const note = document.createElement('div');
      note.style.cssText = 'font-size:11px;color:var(--text-muted);font-style:italic;margin-top:8px;';
      note.textContent = 'Binary consent \u2014 category breakdown not available from this source';
      cardContent.appendChild(note);
    }
  }

  // Feature #113: build descriptor list, then apply user order.
  const descriptors = [];
  descriptors.push({ id: 'overview', present: true, render: () => card });

  // === About CMP Section (collapsible) ===
  if (marker.cmp) {
    const aboutSection = createAboutCMPSection(marker.cmp);
    if (aboutSection) {
      descriptors.push({ id: 'about-tool', present: true, render: () => aboutSection });
    }
  }

  _appendOrderedSections(wrapper, descriptors);
  return wrapper;
}

/**
 * Create an "About CMP" collapsible section with CMP info and detection coverage.
 * @param {string} cmpName - CMP display name
 * @returns {HTMLElement|null} Section element or null if no CMP info found
 */
function createAboutCMPSection(cmpName) {
  // Look up CMP platform by name
  const toolInfo = ENDPOINT_BY_NAME.get(cmpName);
  const coverage = CMP_DETECTION_COVERAGE[cmpName];
  if (!toolInfo && !coverage) return null;

  const sectionTitle = `About ${cmpName}`;
  const expanded = getSectionExpandedState(sectionTitle, false);

  const section = document.createElement('div');
  section.className = 'detail-section-card';

  const header = document.createElement('div');
  header.className = `detail-section-card-header${expanded ? '' : ' collapsed'}`;

  const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  chevron.setAttribute('viewBox', '0 0 24 24');
  chevron.setAttribute('fill', 'none');
  chevron.setAttribute('stroke', 'currentColor');
  chevron.setAttribute('stroke-width', '2');
  const chevronPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  chevronPath.setAttribute('d', 'M6 9l6 6 6-6');
  chevron.appendChild(chevronPath);
  header.appendChild(chevron);

  const titleSpan = document.createElement('span');
  titleSpan.textContent = sectionTitle;
  header.appendChild(titleSpan);

  const contentWrapper = document.createElement('div');
  contentWrapper.className = `detail-section-card-content${expanded ? '' : ' collapsed'}`;

  const content = document.createElement('div');
  content.className = 'about-tool-content';

  // Description
  if (toolInfo?.description) {
    const descEl = document.createElement('div');
    descEl.className = 'about-tool-description';
    descEl.textContent = toolInfo.description;
    content.appendChild(descEl);
  }

  // Website link
  if (toolInfo?.url) {
    const linkEl = document.createElement('div');
    linkEl.className = 'about-tool-link';
    const linkAnchor = document.createElement('a');
    linkAnchor.href = toolInfo.url;
    linkAnchor.target = '_blank';
    linkAnchor.rel = 'noopener noreferrer';
    linkAnchor.textContent = toolInfo.url;
    linkEl.appendChild(linkAnchor);
    content.appendChild(linkEl);
  }

  // Detection coverage
  if (coverage) {
    const coverageEl = document.createElement('div');
    coverageEl.className = 'about-tool-patterns';

    const coverageLabel = document.createElement('div');
    coverageLabel.className = 'about-tool-patterns-label';
    coverageLabel.textContent = 'Consent Detection Coverage:';
    coverageEl.appendChild(coverageLabel);

    const coverageList = document.createElement('ul');
    coverageList.className = 'about-tool-patterns-list';

    const methods = [
      { key: 'cookie', label: 'Cookie Parsing', desc: 'Read consent from stored cookie' },
      { key: 'windowApi', label: 'Window API', desc: 'Read consent from JavaScript API' },
      { key: 'pushDetection', label: 'DataLayer Push', desc: 'Detect consent events in dataLayer' },
      { key: 'categoryMapping', label: 'Category Mapping', desc: 'Map CMP categories to unified names' },
    ];

    for (const method of methods) {
      const li = document.createElement('li');
      li.className = 'about-tool-pattern';
      const iconSpan = document.createElement('span');
      iconSpan.className = coverage[method.key] ? 'coverage-supported' : 'coverage-unsupported';
      iconSpan.textContent = coverage[method.key] ? '\u2713' : '\u2717';
      li.appendChild(iconSpan);
      li.appendChild(document.createTextNode(' ' + method.label + ' '));
      const descSpan = document.createElement('span');
      descSpan.className = 'coverage-desc';
      descSpan.textContent = '\u2014 ' + method.desc;
      li.appendChild(descSpan);
      coverageList.appendChild(li);
    }

    coverageEl.appendChild(coverageList);
    content.appendChild(coverageEl);
  }

  contentWrapper.appendChild(content);

  header.addEventListener('click', () => {
    const wasCollapsed = header.classList.contains('collapsed');
    header.classList.toggle('collapsed');
    contentWrapper.classList.toggle('collapsed');
    saveSectionState(sectionTitle, header.classList.contains('collapsed'));
    if (wasCollapsed) {
      trackEvent('about_tool', { action: 'open', tool: cmpName, category: 'consent' });
    }
  });

  section.appendChild(header);
  section.appendChild(contentWrapper);
  return section;
}

/**
 * Render event detail view
 * @param {HTMLElement} container - Container element
 * @param {import('../../shared/event-shape.js').CapturedEvent} event - Event to render (shape contract: shared/event-shape.js, #135 WP2)
 * @param {Object} options - Rendering options
 * @param {boolean} options.showTriggerCorrelation - Whether to show GTM trigger correlation
 */
export function renderEventDetail(container, event, options = {}) {
  const { showTriggerCorrelation = true } = options;

  // If user selected a different event, reset section states.
  // If the same event is re-rendered (e.g. a new event arrived in the
  // stream while the detail panel was open), keep them so the user's
  // open sections / AI Summary thread stay visible.
  if (resetIfNewEvent(event?.id || null)) {
    clearLabelsState(); // Also clear JSON labels state
    clearExpandedTextState(); // Collapse any expanded long-text cells from the previous event
  }

  container.innerHTML = '';

  if (!event) {
    container.innerHTML = `
      <div class="empty-state">
        <p>Select an event to view details</p>
      </div>
    `;
    return;
  }

  // Consent state markers get their own detail view
  if (event.type === 'consent-state') {
    container.appendChild(renderConsentMarkerDetail(event));
    return;
  }

  // Script load events get their own detail view
  if (event.isScriptLoad) {
    container.appendChild(renderScriptLoadDetail(event));
    return;
  }

  // Tealium utag_data is a data layer (sibling of GTM's window.dataLayer and
  // Adobe's window.adobeDataLayer). Unlike Adobe's adobe-datalayer — which has no
  // formatted.overview and is routed from the platform switch below (BUG69) —
  // utag_data events DO set formatted.overview, so they'd be caught by the
  // standardized-renderer shortcut just below before the switch is reached. Route
  // them to the dedicated data-layer renderer ahead of that shortcut (#152).
  // utag.view()/utag.link() (platform 'tealium') are tag-manager API calls and
  // intentionally keep the generic renderer path.
  if (event.platform === 'tealium-datalayer') {
    container.appendChild(renderTealiumDataLayerDetail(event));
    return;
  }

  // Standardized format detection: any event with formatted.overview uses the unified renderer
  if (event.formatted?.overview) {
    container.appendChild(renderConfiguredDetail(event, { showTriggerCorrelation }));
    return;
  }

  // Legacy platform-specific detail rendering (for non-network event types)
  let detailContent;
  switch (event.platform) {
    case 'interactions':
      detailContent = renderInteractionDetail(event);
      break;
    case 'pages':
      detailContent = renderPageDetail(event);
      break;
    case 'gtm':
    case 'gtag':
    case 'datalayer':
      detailContent = renderGTMDetail(event);
      break;
    case 'adobe-launch':
    case 'adobe-datalayer':
      // Both Adobe surfaces share renderAdobeLaunchDetail — it branches on
      // formatted.source ('_satellite' vs 'adobeDataLayer') for the right
      // section titles. adobe-datalayer (Adobe Client Data Layer) was missing
      // here and fell through to the generic renderer (BUG69).
      detailContent = renderAdobeLaunchDetail(event);
      break;
    default:
      detailContent = renderGenericDetail(event, { showTriggerCorrelation });
  }

  container.appendChild(detailContent);
}
