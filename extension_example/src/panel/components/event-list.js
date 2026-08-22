// Event List Component
// Renders the list of captured analytics events with Data Layer grouping
// Also renders page markers as visual separators

import { getPlatformIcon } from './platform-icons.js';
import { SCRIPT_INITIATOR_ICONS } from './script-initiator-icons.js';
import { matchScriptLoad } from '../../shared/detection/script-patterns.js';
import { matchKnownEndpoint, KNOWN_TRACKING_ENDPOINTS } from '../tracking-endpoints.js';
import { extractHostname, truncateHostLabel } from '../../shared/detection/url-patterns.js';
// Coordinator concerns injected by panel.js via initEventList() (#143).
// Same deps-injection seam as event-detail.js / script-tree.js — replaces a
// back-import from ../panel.js with one explicit, mockable contract. Call
// sites read through `_deps.fn(...)`.
let _deps;

/**
 * Initialize the event-list module with coordinator dependencies.
 * Must be called once at module-wiring time (panel.js init), before any
 * render or ensureEventRowDelegation() call.
 * @param {Object} deps
 * @param {Object} deps.PLATFORM_NAMES - id → compact label (shortName) map; stream
 *   rows resolve their badge label from this, the same source the filter chips use (#149)
 * @param {Function} deps.getTealiumVendorInfo - Vendor info for a Tealium tag UID
 * @param {Function} deps.getConsentCheckForEvent - Consent verdict for an event
 * @param {Function} deps.getConsentFilterMode - Current consent filter mode
 * @param {Function} deps.isEventPinnedForCurrentDomain - Whether an event is pinned for the current domain
 * @param {Function} deps.togglePinForEvent - Toggle pin state for an event
 * @param {Function} deps.isPartOfStreamMultiSelection - Whether an event id is in the stream multi-selection
 * @param {Function} deps.togglePinForMultiSelection - Toggle pin state for the multi-selection
 */
export function initEventList(deps) {
  _deps = deps;
}
import { extractSetCookies } from './cookie-detector.js';
import { GTM_TRIGGER_EVENTS } from '../../shared/detection/event-equivalents.js';
import { attachRowData, installEventRowDelegation } from './event-row-delegation.js';

/**
 * Lazily install the delegated row listeners on the shared event-list
 * container (#131 F4). Idempotent — called from every render entry point
 * that draws event rows (Stream, Tool view, Page view, grouped flat views,
 * Pinned view) so whichever view renders first wires the container.
 */
export function ensureEventRowDelegation(container) {
  installEventRowDelegation(container, {
    isPartOfMultiSelection: _deps.isPartOfStreamMultiSelection,
    togglePinForMultiSelection: _deps.togglePinForMultiSelection,
    togglePinForEvent: _deps.togglePinForEvent,
  });
}

// Data Layer platforms — derived from registry (single source of truth)
const DATA_LAYER_PLATFORMS = KNOWN_TRACKING_ENDPOINTS
  .filter(ep => ep.category === 'data-layer')
  .map(ep => ep.id);

// Consent Platform tools — derived from platform registry (single source of truth)
const CONSENT_PLATFORMS = KNOWN_TRACKING_ENDPOINTS
  .filter(ep => ep.category === 'consent')
  .map(ep => ep.id);

// Locale-aware number formatter for thousands separators in ms values
const localeNumberFormat = new Intl.NumberFormat();

// Cached time formatter — avoids creating Intl.DateTimeFormat on every event row render
const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
});

/**
 * Get push index for stable sorting of dataLayer events with same timestamp
 * @param {Object} event - Event object
 * @returns {number} Push index or 0 if not available
 */
function getPushIndex(event) {
  return event.formatted?.pushIndex || event.raw?._pushIndex || 0;
}

/**
 * Compare two events for sorting, using pushIndex as secondary key for same timestamps
 * @param {number} timestampA - First timestamp
 * @param {number} timestampB - Second timestamp
 * @param {Object} eventA - First event (for pushIndex)
 * @param {Object} eventB - Second event (for pushIndex)
 * @returns {number} Comparison result for sort
 */
export function compareEventsAsc(timestampA, timestampB, eventA, eventB) {
  if (timestampA !== timestampB) {
    return timestampA - timestampB;
  }
  // Same timestamp - use pushIndex for stable ordering
  return getPushIndex(eventA) - getPushIndex(eventB);
}

/**
 * Compare two events for sorting descending, using pushIndex as secondary key
 * @param {number} timestampA - First timestamp
 * @param {number} timestampB - Second timestamp
 * @param {Object} eventA - First event (for pushIndex)
 * @param {Object} eventB - Second event (for pushIndex)
 * @returns {number} Comparison result for sort
 */
function compareEventsDesc(timestampA, timestampB, eventA, eventB) {
  if (timestampA !== timestampB) {
    return timestampB - timestampA;
  }
  // Same timestamp - use pushIndex for stable ordering (higher index = later = shown first in desc)
  return getPushIndex(eventB) - getPushIndex(eventA);
}

/**
 * Create a collapsible page marker element (visual separator showing page URL)
 * @param {Object} event - Page event data
 * @param {boolean} isSelected - Whether this page event is selected
 * @param {Function} onSelect - Selection callback
 * @param {boolean} isCollapsed - Whether this page group is collapsed
 * @param {number} eventCount - Number of events in this page group
 * @param {Function} onToggleCollapse - Callback to toggle collapse state
 * @param {string} streamDirection - Stream direction: 'newest-top' or 'newest-bottom'
 * @param {Function|null} onContextMenu - Context menu callback (or null)
 * @returns {HTMLElement} Page marker element
 */
function createPageMarker(event, isSelected, onSelect, isCollapsed = false, eventCount = 0, onToggleCollapse = null, streamDirection = 'newest-top', onContextMenu = null) {
  const marker = document.createElement('div');
  marker.className = `page-marker${isSelected ? ' selected' : ''}${isCollapsed ? ' collapsed' : ''} stream-${streamDirection}`;
  marker.dataset.eventId = event.id;

  // Chevron icon for expand/collapse (only if there are events to collapse)
  if (eventCount > 0 && onToggleCollapse) {
    const chevronEl = document.createElement('span');
    chevronEl.className = 'page-chevron';
    chevronEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M9 18l6-6-6-6"/>
    </svg>`;
    chevronEl.title = isCollapsed ? 'Expand page events' : 'Collapse page events';
    chevronEl.addEventListener('click', (e) => {
      e.stopPropagation(); // Don't trigger selection
      onToggleCollapse(event.id);
    });
    marker.appendChild(chevronEl);
  }

  // Icon - arrow pointing up or down to show where events are relative to this marker
  const iconEl = document.createElement('span');
  iconEl.className = 'page-icon';
  if (streamDirection === 'newest-top') {
    // Arrow pointing up - events are above this marker (newest at top)
    iconEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 19V5M5 12l7-7 7 7"/>
    </svg>`;
  } else {
    // Arrow pointing down - events are below this marker (newest at bottom)
    iconEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 5v14M5 12l7 7 7-7"/>
    </svg>`;
  }
  marker.appendChild(iconEl);

  // Path label
  const pathEl = document.createElement('span');
  pathEl.className = 'page-path';
  pathEl.textContent = event.eventName || '/';
  pathEl.title = event.raw?.url || event.eventName;
  marker.appendChild(pathEl);

  // Event count badge (if has events)
  if (eventCount > 0) {
    const countEl = document.createElement('span');
    countEl.className = 'page-event-count';
    countEl.textContent = eventCount;
    countEl.title = `${eventCount} event${eventCount !== 1 ? 's' : ''} on this page`;
    marker.appendChild(countEl);
  }

  // Timestamp
  const timeEl = document.createElement('span');
  timeEl.className = 'page-time';
  timeEl.textContent = formatTime(event.timestamp);
  marker.appendChild(timeEl);

  // Line decoration
  const lineEl = document.createElement('span');
  lineEl.className = 'page-line';
  marker.appendChild(lineEl);

  // Click handler to select page event (not toggle collapse)
  marker.addEventListener('click', () => onSelect(event.id));

  // Right-click context menu handler
  if (onContextMenu) {
    marker.addEventListener('contextmenu', (e) => onContextMenu(e, event.id));
  }

  return marker;
}

// SVG icons for different interaction action types
const INTERACTION_ICONS = {
  // Cursor/pointer icon for click actions
  click: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2l-1 14 4-3 3 7 3-1-3-7 5-1z"/></svg>',
  // Pencil/edit icon for change actions (form field changes)
  change: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
  // Arrow-right icon for form submission
  submit: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>'
};

/**
 * Create an interaction marker element (user interaction marker in stream view)
 * Mirrors createPageMarker() but with action-specific icon and amber color scheme
 * @param {Object} event - Interaction event data
 * @param {boolean} isSelected - Whether this event is selected
 * @param {Function} onSelect - Selection callback
 * @param {Function|null} onContextMenu - Context menu callback (or null)
 * @returns {HTMLElement} Interaction marker element
 */
function createInteractionMarker(event, isSelected, onSelect, onContextMenu = null) {
  const marker = document.createElement('div');
  marker.className = `interaction-marker${isSelected ? ' selected' : ''}`;
  marker.dataset.eventId = event.id;

  // Action-specific icon (click: cursor, change: pencil, submit: arrow)
  const action = event.raw?.action || 'click';
  const iconEl = document.createElement('span');
  iconEl.className = 'interaction-icon';
  iconEl.innerHTML = INTERACTION_ICONS[action] || INTERACTION_ICONS.click;
  marker.appendChild(iconEl);

  // Label: "Click: "Add to Cart"" or "Change: SELECT "Label" → "Value""
  const labelEl = document.createElement('span');
  labelEl.className = 'interaction-label';
  labelEl.textContent = event.eventName || 'Interaction';
  labelEl.title = event.eventName || 'Interaction';
  marker.appendChild(labelEl);

  // Element detail: small grey text showing tag + type + ID
  // For INPUT fields, show the input type: INPUT[text]#field-id
  const elementTag = event.raw?.element?.tagName;
  const elementType = event.raw?.element?.type;
  const elementId = event.raw?.element?.id;
  if (elementTag) {
    const detailEl = document.createElement('span');
    detailEl.className = 'interaction-element-detail';
    let detailText = elementTag;
    if (elementTag === 'INPUT' && elementType) {
      detailText = `INPUT[${elementType}]`;
    }
    if (elementId) detailText += `#${elementId}`;
    detailEl.textContent = detailText;
    marker.appendChild(detailEl);
  }

  // Decorative line (flex: 1 fills remaining space)
  const lineEl = document.createElement('span');
  lineEl.className = 'interaction-line';
  marker.appendChild(lineEl);

  // Timestamp
  const timeEl = document.createElement('span');
  timeEl.className = 'interaction-time';
  timeEl.textContent = formatTime(event.timestamp);
  marker.appendChild(timeEl);

  // Click to select
  marker.addEventListener('click', () => onSelect(event.id));

  if (onContextMenu) {
    marker.addEventListener('contextmenu', (e) => onContextMenu(e, event.id));
  }

  return marker;
}

// Shield icon for consent markers (consistent with consent badge branding)
const CONSENT_SHIELD_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L4 5.5v5c0 5.25 3.44 10.18 8 11.5 4.56-1.32 8-6.25 8-11.5v-5L12 2z"/></svg>';

/**
 * Create a consent state marker element for the event stream.
 * Shows consent state (Analytics/Marketing/Functional) with color-coded chips.
 * @param {Object} marker - Consent state marker data
 * @param {boolean} isSelected - Whether this marker is selected
 * @param {Function} onSelect - Selection callback
 * @returns {HTMLElement} Consent state marker element
 */
function createConsentStateMarker(marker, isSelected, onSelect) {
  const el = document.createElement('div');
  el.className = `consent-state-marker${isSelected ? ' selected' : ''}`;
  el.dataset.markerId = marker.id;

  // Shield icon
  const iconEl = document.createElement('span');
  iconEl.className = 'consent-marker-icon';
  iconEl.innerHTML = CONSENT_SHIELD_ICON;
  el.appendChild(iconEl);

  // Action label: "Consent Default", "Consent Update", etc.
  const labelEl = document.createElement('span');
  labelEl.className = 'consent-marker-label';
  labelEl.textContent = marker.actionLabel;
  el.appendChild(labelEl);

  // CMP name
  if (marker.cmp) {
    const cmpEl = document.createElement('span');
    cmpEl.className = 'consent-marker-cmp';
    cmpEl.textContent = marker.cmp;
    el.appendChild(cmpEl);
  }

  // Category chips — color-only, no text for granted/denied
  const chipsEl = document.createElement('div');
  chipsEl.className = 'consent-marker-chips';

  const categoryOrder = ['analytics', 'marketing', 'functional'];
  for (const cat of categoryOrder) {
    const value = marker.categories[cat];
    const chip = document.createElement('span');
    chip.className = `consent-chip ${value || 'not_set'}`;
    chip.textContent = cat;
    chip.title = value ? `${cat}: ${value}` : `${cat}: not configured`;
    chipsEl.appendChild(chip);
  }

  // Binary consent (no categories) — show simplified message
  if (marker.completeness === 'binary' && chipsEl.children.length === 0) {
    const binaryEl = document.createElement('span');
    binaryEl.className = 'consent-marker-binary';
    binaryEl.textContent = 'Consent given — category details pending';
    chipsEl.appendChild(binaryEl);
  }

  el.appendChild(chipsEl);

  // Decorative line
  const lineEl = document.createElement('span');
  lineEl.className = 'consent-marker-line';
  el.appendChild(lineEl);

  // Timestamp
  const timeEl = document.createElement('span');
  timeEl.className = 'consent-marker-time';
  timeEl.textContent = marker.timestamp > 0 ? formatTime(marker.timestamp) : 'T=0';
  el.appendChild(timeEl);

  // Click to select
  el.addEventListener('click', () => onSelect(marker.id));

  return el;
}

/**
 * Check if an event is a trigger event (can cause tracking tags to fire)
 * Includes: Data Layer events + GTM built-in triggers (scrollDepth, click, etc.)
 * Note: GTM load events (gtm.js, gtm.dom) are NOT triggers - they're initialization events
 * @param {Object} event - Event data
 * @returns {boolean} True if the event is a trigger
 */
function isDataLayerEvent(event) {
  // Data Layer platforms (dataLayer.push, adobeDataLayer.push, etc.)
  if (DATA_LAYER_PLATFORMS.includes(event.platform)) return true;
  // GTM built-in triggers (scrollDepth, click, formSubmit, etc.)
  if (GTM_TRIGGER_EVENTS.includes(event.eventName)) return true;
  return false;
}

/**
 * Format timestamp to readable time
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted time string
 */
function formatTime(timestamp) {
  return timeFormatter.format(timestamp);
}

/**
 * Create an event item element
 * @param {Object} event - Event data
 * @param {number} index - Event index
 * @param {boolean} isSelected - Whether this event is selected
 * @param {Function} onSelect - Selection callback
 * @param {boolean} isChild - Whether this is a child event (triggered by dataLayer)
 * @param {Set|null} highlightedPlatforms - Set of platforms to highlight (or null)
 * @param {Function|null} onContextMenu - Context menu callback (or null)
 * @param {Object|null} timingRef - Timing reference {refTimestamp, refType} or null for full timestamp
 * @returns {HTMLElement} Event item element
 */
export function createEventItem(event, index, isSelected, onSelect, isChild = false, highlightedPlatforms = null, onContextMenu = null, timingRef = null) {
  const item = document.createElement('div');
  const isDataLayerPlatform = DATA_LAYER_PLATFORMS.includes(event.platform);
  const isGoogleDataLayer = event.platform === 'datalayer';
  const isGTM = event.platform === 'gtm';
  const isGTAG = event.platform === 'gtag';
  // Only trust the explicit isScriptLoad flag set by script-load detection code
  // Do NOT use event.raw?.type === 'script' - browser reports JSONP tracking requests as 'script' type
  const isScriptLoad = event.isScriptLoad === true;
  const isWarning = event.isWarning || event.platform === 'warning';

  // Set appropriate CSS class for the source type
  // Colors: dataLayer=teal, consent dataLayer=green, scripts=purple, tracking=blue (#1557b0)
  let sourceClass = '';
  if (isWarning) sourceClass = ' warning-event';
  else if (isDataLayerPlatform) sourceClass = ' datalayer-source';
  else if (isScriptLoad) sourceClass = ' script-load';
  else sourceClass = ' tracking-source'; // All other tracking events get blue border

  // Check if this dataLayer event is consent-related (green background instead of teal)
  const isConsentRelated = isDataLayerPlatform && (
    event.formatted?.googleConsentMode ||
    event.formatted?.consentEvent ||
    event.formatted?.isDeveloperIdEvent ||
    CONSENT_PLATFORMS.includes(event.platform)
  );

  // Check if this event should be highlighted (supports multiple highlighted platforms)
  const isHighlighted = highlightedPlatforms && highlightedPlatforms.has(event.platform);

  item.className = `event-item${isSelected ? ' selected' : ''}${sourceClass}${isConsentRelated ? ' consent-event' : ''}${isChild ? ' child-event' : ''}${isHighlighted ? ' highlighted' : ''}`;
  item.dataset.eventId = event.id;

  // Index number
  const indexEl = document.createElement('span');
  indexEl.className = 'event-index';
  indexEl.textContent = index + 1;
  item.appendChild(indexEl);

  // Platform badge with icon
  const platformEl = document.createElement('span');
  platformEl.className = `event-platform ${event.platform}`;
  platformEl.dataset.platform = event.platform;
  const icon = getPlatformIcon(event.platform);
  if (isGoogleDataLayer) {
    platformEl.innerHTML = `${icon}<span class="platform-text">dL</span>`;
    platformEl.title = 'Website dataLayer.push - triggers tracking tags';
  } else if (isGTM) {
    platformEl.innerHTML = `${icon}<span class="platform-text">GTM</span>`;
    platformEl.title = isScriptLoad ? 'Google Tag Manager script loaded' : 'GTM internal event (e.g., gtm.load, gtm.click)';
  } else if (isGTAG) {
    platformEl.innerHTML = `${icon}<span class="platform-text">GTAG</span>`;
    platformEl.title = isScriptLoad ? 'Google Tag (gtag.js) script loaded' : 'Google Tag event';
  } else if (event.platform === 'other' && !isScriptLoad) {
    // Feature #151: self-describing Unknown badge — show the endpoint host
    // (left-truncated) instead of "UNKNOWN", uppercased to match every other
    // stream badge. The separate "?" badge rendered alongside marks it as
    // still-unidentified. The host goes through textContent (never innerHTML)
    // so a hostile URL can't inject markup.
    const host = event.raw?.url ? extractHostname(event.raw.url) : '';
    const label = host ? truncateHostLabel(host) : (event.platformName || 'unknown');
    platformEl.title = host || 'Unrecognized endpoint';
    platformEl.innerHTML = icon; // static "?"-in-circle SVG from the icon registry
    const textSpan = document.createElement('span');
    textSpan.className = 'platform-text';
    textSpan.textContent = label;
    platformEl.appendChild(textSpan);
  } else {
    // #149: resolve the badge label from the shortName map (same source the
    // filter chips use) rather than the stamped full `event.platformName`, so a
    // tool reads identically in filter + stream. Falls back to the uppercased
    // raw id for unmapped platforms. The uppercase treatment is CSS
    // (.event-platform text-transform), so the casing is preserved automatically.
    const streamLabel = _deps.PLATFORM_NAMES?.[event.platform] || event.platform.toUpperCase();
    platformEl.innerHTML = icon; // trusted SVG from the icon registry
    const textSpan = document.createElement('span');
    textSpan.className = 'platform-text';
    // textContent (not innerHTML): custom-endpoint ids carry user-entered names
    // into PLATFORM_NAMES, so the label is never interpolated as markup.
    textSpan.textContent = streamLabel;
    platformEl.appendChild(textSpan);
  }
  item.appendChild(platformEl);

  // Event name
  const nameEl = document.createElement('span');
  nameEl.className = 'event-name';
  const displayName = event.eventName || 'Unknown Event';

  // For swapped GTM containers, show original ID with strikethrough and replacement
  if (event.platform === 'gtm' && event.formatted?.interceptAction === 'replaced' &&
      event.formatted.interceptOriginalId && event.formatted.interceptReplacementId) {
    const prefixEnd = displayName.lastIndexOf(event.formatted.interceptOriginalId);
    const prefix = prefixEnd >= 0 ? displayName.slice(0, prefixEnd) : 'GTM Load: ';
    nameEl.appendChild(document.createTextNode(prefix));
    const strikeEl = document.createElement('span');
    strikeEl.style.textDecoration = 'line-through';
    strikeEl.style.opacity = '0.55';
    strikeEl.textContent = event.formatted.interceptOriginalId;
    nameEl.appendChild(strikeEl);
    nameEl.appendChild(document.createTextNode(` \u2192 ${event.formatted.interceptReplacementId}`));
    nameEl.title = `${event.formatted.interceptOriginalId} swapped to ${event.formatted.interceptReplacementId}`;
  } else {
    nameEl.textContent = displayName;
    nameEl.title = displayName;
  }

  // GTM container data hint: version + active tag count (populated async after response body parse)
  if (event.platform === 'gtm' && isScriptLoad && event.formatted?.containerData) {
    const cd = event.formatted.containerData;
    const activeTags = cd.tagCount - cd.pausedCount;
    const hint = document.createElement('span');
    hint.className = 'event-name-hint';
    // Hide version for preview environments (QUICK_PREVIEW) — the PREVIEW badge already indicates this
    const isPreviewVersion = /^QUICK_PREVIEW/i.test(cd.version);
    hint.textContent = isPreviewVersion ? `${activeTags} tags` : `v${cd.version} · ${activeTags} tags`;
    nameEl.appendChild(hint);
  }

  // Tealium vendor tag: append resolved vendor name in muted text
  if (event.platform === 'tealium' && isScriptLoad && event.formatted?.tealiumTagUid) {
    const vendorInfo = _deps.getTealiumVendorInfo(event.formatted.tealiumTagUid);
    if (vendorInfo?.vendorCompact) {
      const vendorHint = document.createElement('span');
      vendorHint.className = 'event-name-hint';
      vendorHint.textContent = vendorInfo.vendorCompact;
      vendorHint.title = `TID ${vendorInfo.tid} — ${vendorInfo.vendorCompact} (${vendorInfo.confidence})`;
      nameEl.appendChild(vendorHint);
    }
  }

  item.appendChild(nameEl);

  // Consent badges — gated on consent filter mode
  const consentMode = _deps.getConsentFilterMode();
  const gcm = event.formatted?.googleConsentMode;
  const ce = event.formatted?.consentEvent;
  const isDeveloperId = event.formatted?.isDeveloperIdEvent;
  const isConsentPlatform = CONSENT_PLATFORMS.includes(event.platform);

  if (consentMode !== 'off') {
    // Teal signal badge for consent-related events (CMP loads, GCM pushes, developer_id)
    if (gcm || ce || isDeveloperId || isConsentPlatform) {
      const consentBadge = document.createElement('span');
      consentBadge.className = 'event-consent-badge';
      consentBadge.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
      consentBadge.title = gcm
        ? `Google Consent Mode: ${gcm.action}`
        : ce
          ? `${ce.tool}: ${ce.category}`
          : isDeveloperId
            ? `Developer ID: ${event.formatted?.gtagSetCommand?.platform || event.formatted?.gtagSetCommand?.id}`
            : `Consent Platform: ${event.platformName || event.platform}`;
      item.appendChild(consentBadge);
    }

    // Consent check badges for tracking events (not consent platforms or developer_id)
    if (!isConsentPlatform && !isDeveloperId) {
      const check = _deps.getConsentCheckForEvent(event);
      if (check && check.status !== 'exempt') {
        const filledShieldSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';

        if (check.status === 'denied' || check.status === 'pre-consent' || check.status === 'unknown') {
          // Red/orange/yellow warning badge (AUTO + ONLY)
          const checkBadge = document.createElement('span');
          const isAdvisory = check.status === 'denied' && (check.severity === 'potential' || check.cookielessPing);
          const severityClass = isAdvisory ? ' potential' : '';
          checkBadge.className = `event-consent-check-badge ${check.status}${severityClass}`;
          checkBadge.innerHTML = filledShieldSvg; // eslint-disable-line no-unsanitized/property
          const badgeTitle = check.status === 'denied'
            ? (check.cookielessPing
              ? `Advanced Consent Mode: ${check.categoryLabel} cookieless ping (consent denied)`
              : check.severity === 'potential'
              ? `Potential consent issue: ${check.categoryLabel} consent denied (request may not be tracking)`
              : `Consent violation: ${check.categoryLabel} consent denied`)
            : check.status === 'unknown'
            ? `Unknown: ${check.categoryLabel} consent could not be detected`
            : `Pre-consent: fired before consent signal`;
          checkBadge.title = badgeTitle;
          item.appendChild(checkBadge);
        } else if (check.status === 'granted' && check.gcmMismatch) {
          // Yellow advisory: CMP says granted, but Google Consent Mode disagrees
          const checkBadge = document.createElement('span');
          checkBadge.className = 'event-consent-check-badge unknown';
          const shieldSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          shieldSvg.setAttribute('width', '12');
          shieldSvg.setAttribute('height', '12');
          shieldSvg.setAttribute('viewBox', '0 0 24 24');
          shieldSvg.setAttribute('fill', 'currentColor');
          shieldSvg.setAttribute('stroke', 'none');
          const shieldPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          shieldPath.setAttribute('d', 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z');
          shieldSvg.appendChild(shieldPath);
          checkBadge.appendChild(shieldSvg);
          checkBadge.title = `Consent Mode mismatch: CMP says ${check.categoryLabel} granted, but Google Consent Mode is ${check.gcmMismatch.gcmState}`;
          item.appendChild(checkBadge);
        } else if (check.status === 'granted' && consentMode === 'only') {
          // Green granted badge (ONLY mode only, subtle at 60% opacity via CSS)
          const grantedBadge = document.createElement('span');
          grantedBadge.className = 'event-consent-check-badge granted';
          grantedBadge.innerHTML = filledShieldSvg;
          grantedBadge.title = `Consent granted: ${check.categoryLabel}`;
          item.appendChild(grantedBadge);
        }
      }
    }
  }

  // Developer ID badge - subtle tag indicator for gtag developer_id set commands
  const devId = event.formatted?.gtagSetCommand;
  if (devId?.type === 'developer-id' && devId.platform) {
    const devBadge = document.createElement('span');
    devBadge.className = 'event-developerid-badge';
    devBadge.textContent = devId.platform;
    devBadge.title = `gtag developer_id: ${devId.id} → ${devId.platform}`;
    item.appendChild(devBadge);
  }

  // GTM Container Intercept badge — BLOCKED / SWAPPED / SWAP FAILED / PREVIEW
  if (event.formatted?.interceptAction) {
    const action = event.formatted.interceptAction;
    const interceptBadge = document.createElement('span');
    let appendBadge = true;
    if (action === 'blocked') {
      interceptBadge.className = 'event-intercept-badge blocked';
      interceptBadge.textContent = 'BLOCKED';
      interceptBadge.title = `Container ${event.formatted.containerId || ''} blocked by intercept rule`;
    } else if (action === 'replaced') {
      interceptBadge.className = 'event-intercept-badge';
      interceptBadge.textContent = 'SWAPPED';
      interceptBadge.title = `Container swapped (${event.formatted.interceptOriginalId || 'original'} \u2192 ${event.formatted.interceptReplacementId || 'replacement'})`;
    } else if (action === 'swap_failed') {
      interceptBadge.className = 'event-intercept-badge swap-failed';
      interceptBadge.textContent = 'SWAP FAILED';
      interceptBadge.title = `The swapped container (${event.formatted.interceptReplacementId || ''}) failed to load`;
    } else if (action === 'preview') {
      interceptBadge.className = 'event-intercept-badge preview';
      interceptBadge.textContent = 'PREVIEW';
      interceptBadge.title = `Container ${event.formatted.containerId || ''} loaded in preview mode`;
    } else {
      appendBadge = false;
    }
    if (appendBadge) item.appendChild(interceptBadge);
  }

  // Structural fingerprint badge — "ASSUMED" for events identified by payload structure
  if (event.formatted?.fingerprint) {
    const assumedBadge = document.createElement('span');
    assumedBadge.className = 'event-intercept-badge assumed';
    assumedBadge.textContent = 'ASSUMED';
    assumedBadge.title = `Identified by payload structure: ${event.formatted.fingerprint.reason}`;
    item.appendChild(assumedBadge);
  }

  // Unknown event hint — subtle "?" badge for unrecognized events
  if (event.platform === 'other' && !isScriptLoad) {
    const unknownBadge = document.createElement('span');
    unknownBadge.className = 'event-unknown-badge';
    unknownBadge.textContent = '?';
    unknownBadge.title = 'Unrecognized endpoint — click to report or ignore';
    item.appendChild(unknownBadge);
  }

  // User comment indicator (Feature #50) — shown when the user has attached a
  // session-scoped note via the Overview card. Tooltip previews the first
  // ~80 chars. Passive: clicking the row opens the detail view as usual.
  if (typeof event.userComment === 'string' && event.userComment.trim().length > 0) {
    const commentBadge = document.createElement('span');
    commentBadge.className = 'event-comment-indicator';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '11');
    svg.setAttribute('height', '11');
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
    commentBadge.appendChild(svg);
    const firstLine = event.userComment.split('\n')[0];
    const preview = firstLine.length > 80 ? firstLine.slice(0, 80) + '…' : firstLine;
    commentBadge.title = `Comment: ${preview}`;
    item.appendChild(commentBadge);
  }

  // Script badge - icon indicates how the script was loaded (website, tag manager, or another script)
  if (isScriptLoad) {
    const scriptBadge = document.createElement('span');
    scriptBadge.className = 'event-script-badge';

    // Get initiator type from event data
    const initiatorType = event.formatted?.initiatorType || event.raw?.initiatorType || 'unknown';

    // Use initiator-specific icon
    const initiatorIcon = SCRIPT_INITIATOR_ICONS[initiatorType] || SCRIPT_INITIATOR_ICONS.unknown;
    scriptBadge.innerHTML = initiatorIcon;

    // Set tooltip based on initiator type
    const initiatorTitles = {
      website: 'Loaded directly from HTML (parser)',
      tagmanager: 'Loaded by Tag Manager',
      script: 'Loaded by another script',
      unknown: 'Script load event'
    };
    scriptBadge.title = initiatorTitles[initiatorType] || 'Script load event';

    item.appendChild(scriptBadge);
  }

  // Push source badge - icon indicates who called dataLayer.push() (website, tag manager, or third-party script)
  const pushSource = event.formatted?.pushSource;
  if (isDataLayerPlatform && pushSource && pushSource !== 'unknown') {
    const sourceBadge = document.createElement('span');
    sourceBadge.className = 'event-pushsource-badge';

    // Map push source types to initiator icon keys
    const iconMap = {
      'website': 'website',
      'tag-manager': 'tagmanager',
      'script': 'script',
      'historical': 'unknown'
    };
    const iconKey = iconMap[pushSource] || 'unknown';
    sourceBadge.innerHTML = SCRIPT_INITIATOR_ICONS[iconKey] || SCRIPT_INITIATOR_ICONS.unknown;

    // Build tooltip — resolve source URL to platform name if possible
    const sourceUrl = event.formatted?.pushSourceUrl;
    let sourceDetail = '';
    if (sourceUrl) {
      const scriptMatch = matchScriptLoad(sourceUrl);
      if (scriptMatch) {
        sourceDetail = scriptMatch.name;
      } else {
        const endpointMatch = matchKnownEndpoint(sourceUrl);
        if (endpointMatch.matched) {
          sourceDetail = endpointMatch.endpoint.shortName || endpointMatch.endpoint.name;
        } else {
          try { sourceDetail = new URL(sourceUrl).hostname; } catch {}
        }
      }
    }
    const sourceTitles = {
      'website': `Pushed by website${sourceDetail ? ` (${sourceDetail})` : ''}`,
      'tag-manager': `Pushed by ${sourceDetail || 'Tag Manager'}`,
      'script': `Pushed by ${sourceDetail || 'third-party script'}`,
      'historical': 'Historical (before debugger loaded)'
    };
    sourceBadge.title = sourceTitles[pushSource] || 'Push source unknown';

    item.appendChild(sourceBadge);
  }

  // Pushed badge - shows when event was manually pushed via Event Watcher
  if (event.formatted?.isEventWatcherPush) {
    const pushedBadge = document.createElement('span');
    pushedBadge.className = 'event-pushed-badge';
    pushedBadge.textContent = 'Pushed';
    pushedBadge.title = 'Manually pushed via Event Watcher';
    item.appendChild(pushedBadge);
  }

  // Custom endpoint badge - shows when event matched via a user-defined custom endpoint
  if (event.raw?.url) {
    const matchResult = matchKnownEndpoint(event.raw.url);
    if (matchResult?.isCustomMatch) {
      const customBadge = document.createElement('span');
      customBadge.className = 'event-custom-badge';
      customBadge.textContent = 'CUSTOM';
      customBadge.title = 'Matched by a custom endpoint';
      item.appendChild(customBadge);
    }
  }

  // Cookie badge - shows when response sets cookies via Set-Cookie header
  const setCookies = extractSetCookies(event);
  if (setCookies.length > 0) {
    const cookieBadge = document.createElement('span');
    cookieBadge.className = 'event-cookie-badge';
    cookieBadge.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.8 14.2A10 10 0 1 1 9.8 2.2a7 7 0 0 0 5.6 5.6 7 7 0 0 0 6.4 6.4z"/><circle cx="7.5" cy="9.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="11.5" cy="15.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="15" cy="11" r="1.2" fill="currentColor" stroke="none"/><circle cx="8.5" cy="14.5" r="1" fill="currentColor" stroke="none"/></svg>`;
    cookieBadge.title = `Sets ${setCookies.length} cookie${setCookies.length !== 1 ? 's' : ''}: ${setCookies.map(c => `${c.name} (${c.expiresIn})`).join(', ')}`;
    item.appendChild(cookieBadge);
  }

  // Time delta for child events (triggered by Data Layer event)
  if (isChild && event.triggeredBy) {
    const deltaEl = document.createElement('span');
    deltaEl.className = 'event-delta';
    deltaEl.textContent = `+${localeNumberFormat.format(event.triggeredBy.timeDelta)}ms`;
    deltaEl.title = `Fired ${localeNumberFormat.format(event.triggeredBy.timeDelta)}ms after Data Layer event`;
    item.appendChild(deltaEl);
  }

  // Timestamp or delta timing
  const timeEl = document.createElement('span');
  timeEl.className = 'event-time';

  // For non-child events with a timing reference, show delta relative to page load or last interaction
  if (!isChild && timingRef) {
    const deltaMs = event.timestamp - timingRef.refTimestamp;
    const refLabel = timingRef.refType === 'interaction' ? 'interaction' : 'page load';
    // -1000ms tolerance only for page load refs (timing quirk where events fire just before page event)
    // For interaction refs, always show the delta
    if (timingRef.refType === 'interaction' || deltaMs >= -1000) {
      timeEl.textContent = deltaMs >= 0 ? `+${localeNumberFormat.format(deltaMs)}ms` : `${localeNumberFormat.format(deltaMs)}ms`;
      timeEl.title = `${formatTime(event.timestamp)} (${deltaMs >= 0 ? localeNumberFormat.format(deltaMs) + 'ms after' : localeNumberFormat.format(Math.abs(deltaMs)) + 'ms before'} ${refLabel})`;
    } else {
      // Events more than 1 second before page - show full timestamp
      timeEl.textContent = formatTime(event.timestamp);
    }
  } else {
    // Show full timestamp for page events or when no page reference
    timeEl.textContent = formatTime(event.timestamp);
  }
  item.appendChild(timeEl);

  // Pin affordance (Feature #45 Phase 1) — hover-only pushpin button.
  // The ".pinned" class makes the icon stay opaque even when the row
  // isn't hovered, so users can see at a glance which events they've
  // already saved. Click toggles persistence; subscribePinnedState in
  // panel.js triggers a re-render.
  let alreadyPinned = false;
  let inMultiSelection = false;
  try {
    alreadyPinned = _deps.isEventPinnedForCurrentDomain(event);
    inMultiSelection = _deps.isPartOfStreamMultiSelection(event.id);
  } catch (_) { /* panel may not be ready */ }
  const pinBtn = document.createElement('button');
  pinBtn.type = 'button';
  pinBtn.className = `event-pin-btn${alreadyPinned ? ' pinned' : ''}`;
  pinBtn.title = inMultiSelection
    ? 'Pin all selected events to Default'
    : alreadyPinned
      ? 'Unpin (remove from Pinned view)'
      : 'Pin (save to Pinned view — survives Clear)';
  pinBtn.setAttribute('aria-label', pinBtn.title);
  appendPinIcon(pinBtn);
  item.appendChild(pinBtn);

  // No per-row listeners (#131 F4): row click / contextmenu / pin click are
  // dispatched by the container-level delegation (event-row-delegation.js).
  // The row carries its event object and callbacks as expandos instead.
  attachRowData(item, event, onSelect, onContextMenu);

  return item;
}

// Build the inline pushpin SVG via DOM APIs (no innerHTML so the security
// hook doesn't flag template-literal SVG injection).
function appendPinIcon(parent) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const stem = document.createElementNS(NS, 'path');
  stem.setAttribute('d', 'M12 17v5');
  svg.appendChild(stem);
  const head = document.createElementNS(NS, 'path');
  head.setAttribute('d', 'M9 10.76V6a3 3 0 0 1 6 0v4.76a2 2 0 0 0 1.11 1.79l1.78.9A2 2 0 0 1 19 15.24V16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-.76a2 2 0 0 1 1.11-1.79l1.78-.9A2 2 0 0 0 9 10.76z');
  svg.appendChild(head);
  parent.appendChild(svg);
}

/**
 * Create a Data Layer event group with its triggered children
 * Children are shown ABOVE the trigger event (since list is newest-first, children fired after trigger)
 * @param {Object} triggerEvent - Data Layer trigger event data
 * @param {Array} childEvents - Tracking events triggered by this Data Layer event
 * @param {number} triggerIndex - Index of the trigger event
 * @param {string} selectedId - Currently selected event ID
 * @param {Function} onSelect - Selection callback
 * @param {Map} indexMap - Map of event IDs to their original indices
 * @param {Function} compareForSort - Comparison function for sorting events
 * @param {Set|null} highlightedPlatforms - Set of platforms to highlight (or null)
 * @param {Function|null} onContextMenu - Context menu callback (or null)
 * @param {Map|null} timingRefMap - Map of event IDs to timing references (or null)
 * @returns {HTMLElement} Group element
 */
function createEventGroup(triggerEvent, childEvents, triggerIndex, selectedId, onSelect, indexMap, compareForSort, highlightedPlatforms = null, onContextMenu = null, timingRefMap = null) {
  const group = document.createElement('div');
  group.className = 'event-group';
  group.dataset.triggerId = triggerEvent.id;

  // Child events container - shown ABOVE the trigger event (newest first)
  if (childEvents.length > 0) {
    const childContainer = document.createElement('div');
    childContainer.className = 'event-group-children event-group-children-above';

    // Sort children using the provided compare function
    const sortedChildren = [...childEvents].sort(compareForSort);

    sortedChildren.forEach(childEvent => {
      const childIndex = indexMap.get(childEvent.id);
      // Child events show delta relative to trigger, not page, so don't pass pageTimestamp
      const childItem = createEventItem(childEvent, childIndex, childEvent.id === selectedId, onSelect, true, highlightedPlatforms, onContextMenu, null);
      childContainer.appendChild(childItem);
    });

    group.appendChild(childContainer);
  }

  // Trigger parent event (shown below its triggered children)
  // Trigger events show delta relative to page load or last interaction
  const triggerRef = timingRefMap ? (timingRefMap.get(triggerEvent.id) || null) : null;
  const triggerItem = createEventItem(triggerEvent, triggerIndex, triggerEvent.id === selectedId, onSelect, false, highlightedPlatforms, onContextMenu, triggerRef);

  // Add count badge and arrow indicator if there are children
  if (childEvents.length > 0) {
    const countBadge = document.createElement('span');
    countBadge.className = 'event-child-count';
    countBadge.innerHTML = `<span class="trigger-arrow">&#8593;</span>${childEvents.length}`;
    countBadge.title = `Triggered ${childEvents.length} tag${childEvents.length > 1 ? 's' : ''} above`;
    triggerItem.insertBefore(countBadge, triggerItem.querySelector('.event-time'));
  }

  group.appendChild(triggerItem);

  return group;
}

/**
 * Group events by their triggering Data Layer event
 * Data Layer events are website-set data structures that trigger tracking tags
 * @param {Array} events - Array of all events
 * @returns {Object} Grouped structure { groups: [{trigger, children}], ungrouped: [], pages: [] }
 */
function groupEventsByTrigger(events) {
  const groups = [];
  const triggerEventMap = new Map(); // triggerId -> { trigger: event, children: [] }
  const ungrouped = []; // Events not triggered by any Data Layer event
  const pages = []; // Page events (page changes)

  // First pass: identify all Data Layer events and create group containers
  events.forEach(event => {
    // Skip page events in this pass
    if (event.isNavigation || event.platform === 'pages') {
      pages.push(event);
      return;
    }
    if (isDataLayerEvent(event)) {
      triggerEventMap.set(event.id, { trigger: event, children: [] });
    }
  });

  // Second pass: assign child events to their Data Layer trigger parents
  events.forEach(event => {
    // Skip page events
    if (event.isNavigation || event.platform === 'pages') {
      return;
    }

    if (isDataLayerEvent(event)) {
      // Data Layer events are handled as group parents
      return;
    }

    if (event.triggeredBy && triggerEventMap.has(event.triggeredBy.dataLayerEventId)) {
      // This event was triggered by a Data Layer event we have
      triggerEventMap.get(event.triggeredBy.dataLayerEventId).children.push(event);
    } else {
      // No trigger found - ungrouped
      ungrouped.push(event);
    }
  });

  // Convert map to array, maintaining chronological order
  events.forEach(event => {
    if (isDataLayerEvent(event) && triggerEventMap.has(event.id)) {
      groups.push(triggerEventMap.get(event.id));
    }
  });

  return { groups, ungrouped, pages };
}

/**
 * Group events by page (between page events)
 * Each page event starts a new page group containing all subsequent events until the next page
 * Events that appear before the first page are included in the first page group (initial page load)
 * @param {Array} events - Array of all events (any order)
 * @returns {Array} Array of page groups: [{page, events}]
 */
function groupEventsByPage(events) {
  const pageGroups = [];
  const eventsBeforeFirstPage = [];

  // Sort events by timestamp ascending for grouping logic (with pushIndex as tiebreaker)
  const sortedAsc = [...events].sort((a, b) => compareEventsAsc(a.timestamp, b.timestamp, a, b));

  let currentPage = null;
  let currentEvents = [];

  sortedAsc.forEach(event => {
    if (event.isNavigation || event.platform === 'pages') {
      // Save previous group if exists
      if (currentPage) {
        pageGroups.push({
          page: currentPage,
          events: currentEvents
        });
      } else if (currentEvents.length > 0) {
        // Events before first page - save them to add to first page group
        eventsBeforeFirstPage.push(...currentEvents);
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

  // If there were events before the first page, add them to the first page group
  // These are events that were captured before the initial page event was registered
  if (eventsBeforeFirstPage.length > 0 && pageGroups.length > 0) {
    // Add them to the first page group's events (they belong to the initial page load)
    pageGroups[0].events = [...eventsBeforeFirstPage, ...pageGroups[0].events];
  }

  // Reverse so newest page is first (matching existing display order)
  pageGroups.reverse();

  return pageGroups;
}

/**
 * Build per-event timing references for a page group.
 * Walks events chronologically — starts with pageTimestamp as the reference,
 * updates the reference whenever an interaction event is encountered.
 * Events after an interaction show +ms relative to that interaction.
 * @param {Array} events - Events in this page group (excluding page events themselves)
 * @param {number} pageTimestamp - Timestamp of the page event
 * @returns {Map<string, {refTimestamp: number, refType: string}>}
 */
function buildTimingReferences(events, pageTimestamp) {
  const refMap = new Map();
  const sorted = [...events].sort((a, b) => compareEventsAsc(a.timestamp, b.timestamp, a, b));

  let currentRef = pageTimestamp;
  let currentType = 'page';

  for (const event of sorted) {
    refMap.set(event.id, { refTimestamp: currentRef, refType: currentType });
    if (event.isInteraction) {
      currentRef = event.timestamp;
      currentType = 'interaction';
    }
  }

  return refMap;
}

/**
 * Render events with trigger correlation grouping (helper function)
 * @param {Array} events - Events to render (non-page)
 * @param {HTMLElement} container - Container to append elements to
 * @param {string} selectedId - Currently selected event ID
 * @param {Function} onSelect - Selection callback
 * @param {Map} indexMap - Map of event IDs to their original indices
 * @param {Function} getSortTimestamp - Function to get sort timestamp
 * @param {Function} compareForSort - Comparison function for sorting events
 * @param {Set|null} highlightedPlatforms - Set of platforms to highlight (or null)
 * @param {Function|null} onContextMenu - Context menu callback (or null)
 * @param {Map|null} timingRefMap - Map of event IDs to timing references (or null)
 */
function renderEventsWithTriggerCorrelation(events, container, selectedId, onSelect, indexMap, getSortTimestamp, compareForSort, highlightedPlatforms = null, onContextMenu = null, timingRefMap = null, onInteractionContextMenu = null, consentMarkers = null) {
  const { groups, ungrouped } = groupEventsByTrigger(events);

  // Combine groups and ungrouped events
  const allItems = [];

  groups.forEach(group => {
    allItems.push({
      type: 'group',
      data: group
    });
  });

  ungrouped.forEach(event => {
    allItems.push({
      type: 'single',
      data: event
    });
  });

  // Add consent state markers if provided and consent filter is not off
  if (consentMarkers && consentMarkers.length > 0 && _deps.getConsentFilterMode() !== 'off') {
    for (const marker of consentMarkers) {
      allItems.push({
        type: 'consent-marker',
        data: marker
      });
    }
  }

  // Sort using the provided compare function — consent markers use synthetic event-like objects for comparison
  allItems.sort((a, b) => {
    const eventA = a.type === 'group' ? a.data.trigger : a.type === 'consent-marker' ? { id: a.data.id, timestamp: a.data.timestamp, formatted: {} } : a.data;
    const eventB = b.type === 'group' ? b.data.trigger : b.type === 'consent-marker' ? { id: b.data.id, timestamp: b.data.timestamp, formatted: {} } : b.data;
    return compareForSort(eventA, eventB);
  });

  // Render items
  allItems.forEach(item => {
    if (item.type === 'consent-marker') {
      const markerEl = createConsentStateMarker(item.data, item.data.id === selectedId, onSelect);
      container.appendChild(markerEl);
    } else if (item.type === 'group') {
      const triggerIndex = indexMap.get(item.data.trigger.id);
      const groupEl = createEventGroup(
        item.data.trigger,
        item.data.children,
        triggerIndex,
        selectedId,
        onSelect,
        indexMap,
        compareForSort,
        highlightedPlatforms,
        onContextMenu,
        timingRefMap
      );
      container.appendChild(groupEl);
    } else if (item.data.isInteraction) {
      // Interaction events render as full-width markers, not regular event items
      const markerEl = createInteractionMarker(item.data, item.data.id === selectedId, onSelect, onInteractionContextMenu);
      container.appendChild(markerEl);
    } else {
      const eventIndex = indexMap.get(item.data.id);
      const eventRef = timingRefMap ? (timingRefMap.get(item.data.id) || null) : null;
      const eventEl = createEventItem(item.data, eventIndex, item.data.id === selectedId, onSelect, false, highlightedPlatforms, onContextMenu, eventRef);
      container.appendChild(eventEl);
    }
  });
}

/**
 * Render events in flat list without trigger correlation (helper function)
 * @param {Array} events - Events to render (non-page)
 * @param {HTMLElement} container - Container to append elements to
 * @param {string} selectedId - Currently selected event ID
 * @param {Function} onSelect - Selection callback
 * @param {Map} indexMap - Map of event IDs to their original indices
 * @param {Function} compareForSort - Comparison function for sorting events
 * @param {Set|null} highlightedPlatforms - Set of platforms to highlight (or null)
 * @param {Function|null} onContextMenu - Context menu callback (or null)
 * @param {Map|null} timingRefMap - Map of event IDs to timing references (or null)
 */
function renderEventsFlat(events, container, selectedId, onSelect, indexMap, compareForSort, highlightedPlatforms = null, onContextMenu = null, timingRefMap = null, onInteractionContextMenu = null, consentMarkers = null) {
  // Merge events and consent markers into a single sortable array
  const allItems = events.map(e => ({ type: 'event', data: e }));
  if (consentMarkers && consentMarkers.length > 0 && _deps.getConsentFilterMode() !== 'off') {
    for (const marker of consentMarkers) {
      allItems.push({ type: 'consent-marker', data: marker });
    }
  }

  allItems.sort((a, b) => {
    const eventA = a.type === 'consent-marker' ? { id: a.data.id, timestamp: a.data.timestamp, formatted: {} } : a.data;
    const eventB = b.type === 'consent-marker' ? { id: b.data.id, timestamp: b.data.timestamp, formatted: {} } : b.data;
    return compareForSort(eventA, eventB);
  });

  allItems.forEach(item => {
    if (item.type === 'consent-marker') {
      const markerEl = createConsentStateMarker(item.data, item.data.id === selectedId, onSelect);
      container.appendChild(markerEl);
    } else if (item.data.isInteraction) {
      const markerEl = createInteractionMarker(item.data, item.data.id === selectedId, onSelect, onInteractionContextMenu);
      container.appendChild(markerEl);
    } else {
      const eventIndex = indexMap.get(item.data.id);
      const eventRef = timingRefMap ? (timingRefMap.get(item.data.id) || null) : null;
      const eventEl = createEventItem(item.data, eventIndex, item.data.id === selectedId, onSelect, false, highlightedPlatforms, onContextMenu, eventRef);
      container.appendChild(eventEl);
    }
  });
}

/**
 * Render the event list with page grouping and Data Layer correlation
 * @param {HTMLElement} container - Container element
 * @param {Array<import('../../shared/event-shape.js').CapturedEvent>} events - Events to render (shape contract: shared/event-shape.js, #135 WP2)
 * @param {string} selectedId - Currently selected event ID
 * @param {Function} onSelect - Selection callback
 * @param {Object} options - Rendering options
 * @param {boolean} options.showTriggerCorrelation - Whether to show Data Layer trigger correlation grouping
 * @param {string} options.sortMode - Sort mode: 'start' (request start) or 'finish' (request complete)
 * @param {Set} options.collapsedPageGroups - Set of page event IDs that are collapsed
 * @param {Function} options.onTogglePageCollapse - Callback to toggle page collapse state
 * @param {string} options.streamDirection - Stream direction: 'newest-top' (newest events at top, events above marker) or 'newest-bottom' (newest at bottom, events below marker)
 * @param {Set|null} options.highlightedPlatforms - Set of platforms to highlight in the event list (or null)
 * @param {Function|null} options.onEventContextMenu - Context menu callback for events (or null)
 * @param {Function|null} options.onPageContextMenu - Context menu callback for page markers (or null)
 */
export function renderEventList(container, events, selectedId, onSelect, options = {}) {
  ensureEventRowDelegation(container);
  const {
    showTriggerCorrelation = true,
    sortMode = 'start',
    collapsedPageGroups = new Set(),
    onTogglePageCollapse = null,
    streamDirection = 'newest-top',
    highlightedPlatforms = null,
    onEventContextMenu = null,
    onInteractionContextMenu = null,
    onPageContextMenu = null,
    consentStateMarkers = []
  } = options;

  // Hide swapped-away containers — the swap event (with SWAPPED badge) already tells the story
  events = events.filter(e => e.formatted?.interceptAction !== 'swapped_away');

  // Helper function to get the sort value based on mode
  // For 'index' mode, we use the original capture order from indexMap
  const getSortTimestamp = (event) => {
    if (sortMode === 'finish') {
      return event.finishTimestamp || event.timestamp;
    }
    return event.timestamp;
  };

  // Helper function to get sort key for index mode
  const getIndexSortKey = (event) => {
    return indexMap.get(event.id) ?? 0;
  };

  // Compare function that respects sortMode and streamDirection
  // For newest-top: descending order (newest first)
  // For newest-bottom: ascending order (oldest first)
  const isDescending = streamDirection === 'newest-top';
  const compareForSort = (eventA, eventB) => {
    if (sortMode === 'index') {
      // Sort by capture order (index)
      const diff = getIndexSortKey(eventB) - getIndexSortKey(eventA);
      return isDescending ? diff : -diff;
    }
    // Sort by timestamp
    return isDescending
      ? compareEventsDesc(getSortTimestamp(eventA), getSortTimestamp(eventB), eventA, eventB)
      : compareEventsAsc(getSortTimestamp(eventA), getSortTimestamp(eventB), eventA, eventB);
  };

  // Create index map for original positions
  const indexMap = new Map();
  events.forEach((event, index) => {
    indexMap.set(event.id, index);
  });

  // Register consent markers in the index map so they sort correctly in index mode.
  // T=0 markers go before all events (-1). Mid-session markers get placed after the
  // last event that arrived before them (using fractional indices to avoid collisions).
  if (consentStateMarkers.length > 0) {
    for (const marker of consentStateMarkers) {
      if (marker.timestamp === 0) {
        indexMap.set(marker.id, -1);
      } else {
        // Find the last event with timestamp <= marker timestamp
        let insertAfter = -1;
        for (let i = events.length - 1; i >= 0; i--) {
          if (events[i].timestamp <= marker.timestamp) {
            insertAfter = i;
            break;
          }
        }
        // Place marker just after that event (fractional index avoids displacing events)
        indexMap.set(marker.id, insertAfter + 0.5);
      }
    }
  }

  // Create a document fragment for batch DOM updates
  const fragment = document.createDocumentFragment();

  // Group events by page (between page events)
  // groupEventsByPage returns newest page first, reverse if showing oldest first
  let pageGroups = groupEventsByPage(events);
  if (streamDirection === 'newest-bottom') {
    pageGroups = pageGroups.reverse();
  }

  // If no page groups (no page events), render events ungrouped
  if (pageGroups.length === 0) {
    // Filter out any page events (shouldn't be any, but safety check)
    const nonPageEvents = events.filter(e => !e.isNavigation && e.platform !== 'pages');

    if (nonPageEvents.length > 0 || consentStateMarkers.length > 0) {
      // No page timestamp available when there's no page event
      if (showTriggerCorrelation) {
        renderEventsWithTriggerCorrelation(nonPageEvents, fragment, selectedId, onSelect, indexMap, getSortTimestamp, compareForSort, highlightedPlatforms, onEventContextMenu, null, onInteractionContextMenu, consentStateMarkers);
      } else {
        renderEventsFlat(nonPageEvents, fragment, selectedId, onSelect, indexMap, compareForSort, highlightedPlatforms, onEventContextMenu, null, onInteractionContextMenu, consentStateMarkers);
      }
    }
  } else {
    // Render each page group (newest page first)
    // Stream direction: 'newest-top' = events above page marker, 'newest-bottom' = events below
    const eventsAbove = streamDirection === 'newest-top';

    // Build page timestamp boundaries for consent marker assignment (sorted ascending)
    const pageTimestamps = pageGroups.map(pg => pg.page.timestamp).sort((a, b) => a - b);

    pageGroups.forEach((pageGroup, groupIdx) => {
      const isCollapsed = collapsedPageGroups.has(pageGroup.page.id);
      const eventCount = pageGroup.events.length;
      const pageTimestamp = pageGroup.page.timestamp;
      const timingRefMap = buildTimingReferences(pageGroup.events, pageTimestamp);

      // Filter consent markers for this page group by timestamp range
      const pageIdx = pageTimestamps.indexOf(pageTimestamp);
      const nextPageTimestamp = pageIdx < pageTimestamps.length - 1 ? pageTimestamps[pageIdx + 1] : Infinity;
      const groupConsentMarkers = consentStateMarkers.filter(m =>
        m.timestamp >= pageTimestamp && m.timestamp < nextPageTimestamp
      );
      // T=0 markers go to the earliest page group
      if (pageIdx === 0) {
        const t0Markers = consentStateMarkers.filter(m => m.timestamp < pageTimestamp);
        groupConsentMarkers.push(...t0Markers);
      }

      // Create page group container
      const groupContainer = document.createElement('div');
      groupContainer.className = `page-group${isCollapsed ? ' collapsed' : ''} stream-${streamDirection}`;
      groupContainer.dataset.pageId = pageGroup.page.id;

      // Create events container (position depends on layout)
      let eventsContainer = null;
      if (pageGroup.events.length > 0 || groupConsentMarkers.length > 0) {
        eventsContainer = document.createElement('div');
        eventsContainer.className = 'page-group-events';

        // Render events with existing trigger correlation logic, passing timing references for delta timing
        if (showTriggerCorrelation) {
          renderEventsWithTriggerCorrelation(pageGroup.events, eventsContainer, selectedId, onSelect, indexMap, getSortTimestamp, compareForSort, highlightedPlatforms, onEventContextMenu, timingRefMap, onInteractionContextMenu, groupConsentMarkers);
        } else {
          renderEventsFlat(pageGroup.events, eventsContainer, selectedId, onSelect, indexMap, compareForSort, highlightedPlatforms, onEventContextMenu, timingRefMap, onInteractionContextMenu, groupConsentMarkers);
        }
      }

      // Page marker
      const pageEl = createPageMarker(
        pageGroup.page,
        pageGroup.page.id === selectedId,
        onSelect,
        isCollapsed,
        eventCount,
        onTogglePageCollapse,
        streamDirection,
        onPageContextMenu
      );

      // Append in correct order based on layout
      if (eventsAbove) {
        // Events first, then page marker at bottom
        if (eventsContainer) groupContainer.appendChild(eventsContainer);
        groupContainer.appendChild(pageEl);
      } else {
        // Page marker first, then events below
        groupContainer.appendChild(pageEl);
        if (eventsContainer) groupContainer.appendChild(eventsContainer);
      }

      fragment.appendChild(groupContainer);
    });
  }

  // Clear container and append fragment
  const emptyState = container.querySelector('.empty-state');
  container.innerHTML = '';
  if (emptyState) {
    container.appendChild(emptyState);
  }
  container.appendChild(fragment);
}

// ============================================================================
// TOOL VIEW & PAGE VIEW - Grouping Functions
// ============================================================================

/**
 * Group events by platform.
 * @param {Array} events - Filtered events
 * @param {Function} getCategoryForPlatform - Function to get category ID for a platform
 * @returns {Array<{platformId: string, platformName: string, category: string, events: Array}>}
 */
export function groupEventsByPlatform(events, getCategoryForPlatform) {
  const platformGroups = new Map();

  for (const event of events) {
    // Skip page/navigation and interaction events - they don't belong to a platform
    if (event.isNavigation || event.platform === 'pages' || event.isInteraction) continue;

    const pid = event.platform || 'unknown';
    if (!platformGroups.has(pid)) {
      platformGroups.set(pid, {
        platformId: pid,
        platformName: event.platformName || pid,
        category: getCategoryForPlatform ? getCategoryForPlatform(pid) : 'unknown',
        events: []
      });
    }
    platformGroups.get(pid).events.push(event);
  }

  // Sort by event count descending, then alphabetically by name
  return [...platformGroups.values()].sort((a, b) => {
    if (b.events.length !== a.events.length) return b.events.length - a.events.length;
    return a.platformName.localeCompare(b.platformName);
  });
}

/**
 * Group platform groups by category.
 * @param {Array} platformGroups - Output of groupEventsByPlatform()
 * @param {Object} categoryMeta - Category metadata object (id -> {name, icon, ...})
 * @returns {Array<{category: string, categoryName: string, categoryIcon: string, platforms: Array, totalEvents: number}>}
 */
export function groupPlatformsByCategory(platformGroups, categoryMeta) {
  const categoryMap = new Map();

  for (const group of platformGroups) {
    const cat = group.category || 'unknown';
    if (!categoryMap.has(cat)) {
      const meta = categoryMeta[cat] || categoryMeta.unknown || { name: cat, icon: 'alert' };
      categoryMap.set(cat, {
        category: cat,
        categoryName: meta.name || cat,
        categoryIcon: meta.icon || 'alert',
        platforms: [],
        totalEvents: 0
      });
    }
    const catGroup = categoryMap.get(cat);
    catGroup.platforms.push(group);
    catGroup.totalEvents += group.events.length;
  }

  // Sort by total events descending, then alphabetically by name
  return [...categoryMap.values()].sort((a, b) => {
    if (b.totalEvents !== a.totalEvents) return b.totalEvents - a.totalEvents;
    return a.categoryName.localeCompare(b.categoryName);
  });
}

/**
 * Group page groups by domain (hostname).
 * @param {Array<{page: Object, events: Array}>} pageGroups - Output of groupEventsByPage()
 * @returns {Array<{hostname: string, pages: Array, firstTimestamp: number}>}
 */
export function groupPagesByDomain(pageGroups) {
  const domainMap = new Map();

  for (const group of pageGroups) {
    let hostname = 'unknown';
    try {
      hostname = new URL(group.page.raw?.url || '').hostname;
    } catch {
      // Fallback: try to extract from URL string
      const match = (group.page.raw?.url || '').match(/^https?:\/\/([^\/]+)/);
      hostname = match ? match[1] : 'unknown';
    }

    if (!domainMap.has(hostname)) {
      domainMap.set(hostname, {
        hostname,
        pages: [],
        firstTimestamp: group.page.timestamp
      });
    }

    const domainGroup = domainMap.get(hostname);
    domainGroup.pages.push(group);
    // Track earliest timestamp for sorting
    if (group.page.timestamp < domainGroup.firstTimestamp) {
      domainGroup.firstTimestamp = group.page.timestamp;
    }
  }

  // Sort domains chronologically (first visited on top)
  return [...domainMap.values()].sort((a, b) => a.firstTimestamp - b.firstTimestamp);
}

/**
 * Count unique platforms and total events within a set of events.
 * Excludes page/navigation events from counts.
 * @param {Array} events - Tracking events
 * @returns {{ toolCount: number, eventCount: number }}
 */
export function getSummaryCounts(events) {
  const platforms = new Set();
  let eventCount = 0;

  for (const event of events) {
    if (event.isNavigation || event.platform === 'pages' || event.isInteraction) continue;
    platforms.add(event.platform);
    eventCount++;
  }

  return { toolCount: platforms.size, eventCount };
}

/**
 * Format summary string for group headers.
 * @param {number} toolCount - Number of unique tools/platforms
 * @param {number} eventCount - Total number of events
 * @param {number} [pageCount] - Number of pages (only for domain headers)
 * @returns {string} Formatted string like "3 tools · 2 pages · 16 events"
 */
export function formatSummary(toolCount, eventCount, pageCount) {
  const parts = [];
  if (toolCount > 0) parts.push(`${toolCount} tool${toolCount !== 1 ? 's' : ''}`);
  if (pageCount !== undefined) parts.push(`${pageCount} page${pageCount !== 1 ? 's' : ''}`);
  parts.push(`${eventCount} event${eventCount !== 1 ? 's' : ''}`);
  return parts.join(' \u00B7 '); // middle dot separator
}

// ============================================================================
// TOOL VIEW - Render Functions
// ============================================================================

/**
 * Render Tool View - events grouped by category then platform (2-level hierarchy)
 * @param {HTMLElement} container - Container element
 * @param {Array} events - Filtered events
 * @param {string} selectedId - Currently selected event ID
 * @param {Function} onSelect - Selection callback
 * @param {Object} options - Rendering options
 */
export function renderToolView(container, events, selectedId, onSelect, options = {}) {
  ensureEventRowDelegation(container);
  const {
    collapsedCategoryGroups = new Set(),
    collapsedToolGroups = new Set(),
    onToggleCategoryCollapse,
    onToggleToolCollapse,
    highlightedPlatforms = null,
    onEventContextMenu = null,
    onCategoryContextMenu = null,
    onToolContextMenu = null,
    getCategoryForPlatform,
    categoryMeta = {},
    categoryIcons = {},
    sortMode = 'start'
  } = options;

  const fragment = document.createDocumentFragment();

  // Group events by platform, then by category
  const platformGroups = groupEventsByPlatform(events, getCategoryForPlatform);
  const categoryGroups = groupPlatformsByCategory(platformGroups, categoryMeta);

  // Build index map for event indices
  const indexMap = new Map();
  events.forEach((e, i) => indexMap.set(e.id, i));

  // Sort function based on sortMode
  const getSortTimestamp = sortMode === 'finish'
    ? (e) => e.finishTimestamp || e.timestamp
    : (e) => e.timestamp;

  const compareForSort = sortMode === 'index'
    ? (a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0)
    : (a, b) => compareEventsAsc(getSortTimestamp(a), getSortTimestamp(b), a, b);

  // Render each category
  for (const catGroup of categoryGroups) {
    const isCatCollapsed = collapsedCategoryGroups.has(catGroup.category);

    // Category container
    const catEl = document.createElement('div');
    catEl.className = `tool-view-category${isCatCollapsed ? ' collapsed' : ''}`;
    catEl.dataset.category = catGroup.category;

    // Category header
    const catHeader = createCategoryGroupHeader(catGroup, isCatCollapsed, onToggleCategoryCollapse, categoryIcons);
    // Context menu on category header: copy all events in this category
    if (onCategoryContextMenu) {
      const allCategoryPlatformIds = catGroup.platforms.map(p => p.platformId);
      catHeader.addEventListener('contextmenu', (e) => {
        onCategoryContextMenu(e, allCategoryPlatformIds, {
          category: catGroup.category,
          categoryPlatforms: allCategoryPlatformIds
        });
      });
    }
    catEl.appendChild(catHeader);

    // Platform groups (hidden when category collapsed via CSS)
    if (!isCatCollapsed) {
      for (const platformGroup of catGroup.platforms) {
        const isToolCollapsed = collapsedToolGroups.has(platformGroup.platformId);

        const toolEl = document.createElement('div');
        toolEl.className = `tool-view-group${isToolCollapsed ? ' collapsed' : ''}`;
        toolEl.dataset.platform = platformGroup.platformId;

        // Platform header
        const toolHeader = createToolGroupHeader(platformGroup, isToolCollapsed, onToggleToolCollapse);
        // Context menu on platform header: copy all events for this platform
        if (onToolContextMenu) {
          toolHeader.addEventListener('contextmenu', (e) => {
            onToolContextMenu(e, [platformGroup.platformId], {
              platform: platformGroup.platformId
            });
          });
        }
        toolEl.appendChild(toolHeader);

        // Events (hidden when collapsed via CSS)
        if (!isToolCollapsed) {
          const eventsEl = document.createElement('div');
          eventsEl.className = 'tool-view-group-events';

          // Sort events within group
          const sortedEvents = [...platformGroup.events].sort(compareForSort);

          sortedEvents.forEach(event => {
            const eventEl = createEventItem(
              event,
              indexMap.get(event.id) ?? 0,
              event.id === selectedId,
              onSelect,
              false,
              highlightedPlatforms,
              onEventContextMenu,
              null
            );
            eventsEl.appendChild(eventEl);
          });

          toolEl.appendChild(eventsEl);
        }

        catEl.appendChild(toolEl);
      }
    }

    fragment.appendChild(catEl);
  }

  // Clear container and append
  const emptyState = container.querySelector('.empty-state');
  container.innerHTML = '';
  if (emptyState) container.appendChild(emptyState);
  container.appendChild(fragment);
}

/**
 * Create category group header for Tool View
 */
function createCategoryGroupHeader(catGroup, isCollapsed, onToggle, categoryIcons) {
  const header = document.createElement('div');
  header.className = 'tool-view-category-header';

  // Chevron
  const chevron = document.createElement('span');
  chevron.className = 'category-chevron';
  chevron.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`;
  header.appendChild(chevron);

  // Category icon
  const iconEl = document.createElement('span');
  iconEl.className = 'tool-view-category-icon';
  const iconSvg = categoryIcons[catGroup.categoryIcon];
  if (iconSvg) {
    iconEl.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${iconSvg}</svg>`;
  }
  header.appendChild(iconEl);

  // Category name
  const nameEl = document.createElement('span');
  nameEl.className = 'tool-view-category-name';
  nameEl.textContent = catGroup.categoryName;
  header.appendChild(nameEl);

  // Summary: "3 tools · 22 events"
  const summaryEl = document.createElement('span');
  summaryEl.className = 'tool-view-category-summary';
  summaryEl.textContent = `${catGroup.platforms.length} tool${catGroup.platforms.length !== 1 ? 's' : ''} \u00B7 ${catGroup.totalEvents} event${catGroup.totalEvents !== 1 ? 's' : ''}`;
  header.appendChild(summaryEl);

  // Click handler
  header.addEventListener('click', () => {
    if (onToggle) onToggle(catGroup.category);
  });

  return header;
}

/**
 * Create platform/tool group header for Tool View
 */
function createToolGroupHeader(group, isCollapsed, onToggle) {
  const header = document.createElement('div');
  header.className = 'tool-view-group-header';

  // Chevron
  const chevron = document.createElement('span');
  chevron.className = 'platform-chevron';
  chevron.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`;
  header.appendChild(chevron);

  // Platform icon
  const iconEl = document.createElement('span');
  iconEl.className = 'tool-view-platform-icon';
  iconEl.innerHTML = getPlatformIcon(group.platformId);
  header.appendChild(iconEl);

  // Platform name
  const nameEl = document.createElement('span');
  nameEl.className = 'tool-view-platform-name';
  nameEl.textContent = group.platformName;
  header.appendChild(nameEl);

  // Event count badge
  const countEl = document.createElement('span');
  countEl.className = 'tool-view-event-count';
  countEl.textContent = group.events.length;
  header.appendChild(countEl);

  // Click handler
  header.addEventListener('click', () => {
    if (onToggle) onToggle(group.platformId);
  });

  return header;
}

// ============================================================================
// PAGE VIEW - Render Functions
// ============================================================================

/**
 * Render Page View - events grouped by domain then page (2-level hierarchy)
 * @param {HTMLElement} container - Container element
 * @param {Array} events - Filtered events
 * @param {string} selectedId - Currently selected event ID
 * @param {Function} onSelect - Selection callback
 * @param {Object} options - Rendering options
 */
export function renderPageView(container, events, selectedId, onSelect, options = {}) {
  ensureEventRowDelegation(container);
  const {
    collapsedDomains = new Set(),
    collapsedPageGroups = new Set(),
    onToggleDomainCollapse,
    onTogglePageCollapse,
    highlightedPlatforms = null,
    onEventContextMenu = null,
    onInteractionContextMenu = null,
    onPageContextMenu = null,
    onDomainContextMenu = null,
    onClearDomain = null,
    onClearPage = null,
    sortMode = 'start',
    showTriggerCorrelation = true,
    consentStateMarkers = []
  } = options;

  const fragment = document.createDocumentFragment();

  // Build index map for event indices
  const indexMap = new Map();
  events.forEach((e, i) => indexMap.set(e.id, i));

  // Sort function based on sortMode (same as Tool View)
  const getSortTimestamp = sortMode === 'finish'
    ? (e) => e.finishTimestamp || e.timestamp
    : (e) => e.timestamp;

  const compareForSort = sortMode === 'index'
    ? (a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0)
    : (a, b) => compareEventsAsc(getSortTimestamp(a), getSortTimestamp(b), a, b);

  // Group by page, then by domain
  const pageGroups = groupEventsByPage(events);
  const domainGroups = groupPagesByDomain(pageGroups);

  // Render each domain
  for (const domainGroup of domainGroups) {
    const isDomainCollapsed = collapsedDomains.has(domainGroup.hostname);

    // Domain header
    const domainEl = createDomainHeader(
      domainGroup,
      isDomainCollapsed,
      onToggleDomainCollapse,
      onClearDomain,
      onDomainContextMenu
    );
    fragment.appendChild(domainEl);

    if (isDomainCollapsed) continue;

    // Pages within domain (chronological: oldest first)
    const sortedPages = [...domainGroup.pages].sort((a, b) => a.page.timestamp - b.page.timestamp);

    for (let pageIdx = 0; pageIdx < sortedPages.length; pageIdx++) {
      const pageGroup = sortedPages[pageIdx];
      const isPageCollapsed = collapsedPageGroups.has(pageGroup.page.id);

      // Page header
      const pageEl = createPageViewItem(
        pageGroup,
        isPageCollapsed,
        pageGroup.page.id === selectedId,
        onSelect,
        onTogglePageCollapse,
        onPageContextMenu,
        onClearPage
      );
      fragment.appendChild(pageEl);

      if (isPageCollapsed) continue;

      // Filter consent markers for this page group
      const pageTimestamp = pageGroup.page.timestamp;
      const nextPageTimestamp = pageIdx < sortedPages.length - 1 ? sortedPages[pageIdx + 1].page.timestamp : Infinity;
      const groupConsentMarkers = consentStateMarkers.filter(m =>
        m.timestamp >= pageTimestamp && m.timestamp < nextPageTimestamp
      );
      if (pageIdx === 0) {
        const t0Markers = consentStateMarkers.filter(m => m.timestamp < pageTimestamp);
        groupConsentMarkers.push(...t0Markers);
      }

      // Events container
      const eventsEl = document.createElement('div');
      eventsEl.className = 'page-view-events';

      const timingRefMap = buildTimingReferences(pageGroup.events, pageTimestamp);

      // Render events with trigger correlation (DL nesting) if enabled
      if (showTriggerCorrelation) {
        renderEventsWithTriggerCorrelation(
          pageGroup.events,
          eventsEl,
          selectedId,
          onSelect,
          indexMap,
          getSortTimestamp,
          compareForSort,
          highlightedPlatforms,
          onEventContextMenu,
          timingRefMap,
          onInteractionContextMenu,
          groupConsentMarkers
        );
      } else {
        renderEventsFlat(
          pageGroup.events,
          eventsEl,
          selectedId,
          onSelect,
          indexMap,
          compareForSort,
          highlightedPlatforms,
          onEventContextMenu,
          timingRefMap,
          onInteractionContextMenu,
          groupConsentMarkers
        );
      }

      fragment.appendChild(eventsEl);
    }
  }

  // Clear container and append
  const emptyState = container.querySelector('.empty-state');
  container.innerHTML = '';
  if (emptyState) container.appendChild(emptyState);
  container.appendChild(fragment);
}

/**
 * Create domain header for Page View
 */
function createDomainHeader(domainGroup, isCollapsed, onToggle, onClear, onContextMenu) {
  const header = document.createElement('div');
  header.className = `domain-header${isCollapsed ? ' collapsed' : ''}`;

  // Chevron
  const chevron = document.createElement('span');
  chevron.className = 'domain-chevron';
  chevron.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`;
  header.appendChild(chevron);

  // Domain name
  const nameEl = document.createElement('span');
  nameEl.className = 'domain-name';
  nameEl.textContent = domainGroup.hostname;
  header.appendChild(nameEl);

  // Summary counts
  const allEvents = domainGroup.pages.flatMap(p => p.events);
  const { toolCount, eventCount } = getSummaryCounts(allEvents);
  const summaryEl = document.createElement('span');
  summaryEl.className = 'domain-summary';
  summaryEl.textContent = formatSummary(toolCount, eventCount, domainGroup.pages.length);
  header.appendChild(summaryEl);

  // Clear button (show on hover)
  if (onClear) {
    const clearBtn = document.createElement('button');
    clearBtn.className = 'page-view-delete-btn';
    clearBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
    clearBtn.title = `Clear ${domainGroup.hostname} and all its pages`;
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClear(domainGroup.hostname);
    });
    header.appendChild(clearBtn);
  }

  // Click handler for collapse toggle
  header.addEventListener('click', () => {
    if (onToggle) onToggle(domainGroup.hostname);
  });

  // Context menu handler
  if (onContextMenu) {
    header.addEventListener('contextmenu', (e) => onContextMenu(e, domainGroup.hostname));
  }

  return header;
}

/**
 * Create page item header for Page View
 */
function createPageViewItem(pageGroup, isCollapsed, isSelected, onSelect, onToggle, onContextMenu, onClear) {
  const item = document.createElement('div');
  item.className = `page-view-item${isCollapsed ? ' collapsed' : ''}${isSelected ? ' selected' : ''}`;
  item.dataset.pageId = pageGroup.page.id;

  // Indent spacer
  const indent = document.createElement('span');
  indent.className = 'page-view-indent';
  item.appendChild(indent);

  // Chevron (only if has events)
  if (pageGroup.events.length > 0) {
    const chevron = document.createElement('span');
    chevron.className = 'page-chevron';
    chevron.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`;
    chevron.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onToggle) onToggle(pageGroup.page.id);
    });
    item.appendChild(chevron);
  } else {
    // Empty spacer to maintain alignment
    const spacer = document.createElement('span');
    spacer.className = 'page-chevron-spacer';
    item.appendChild(spacer);
  }

  // Path
  const pathEl = document.createElement('span');
  pathEl.className = 'page-path';
  pathEl.textContent = pageGroup.page.eventName || '/';
  pathEl.title = pageGroup.page.raw?.url || pageGroup.page.eventName;
  item.appendChild(pathEl);

  // Summary
  const { toolCount, eventCount } = getSummaryCounts(pageGroup.events);
  const summaryEl = document.createElement('span');
  summaryEl.className = 'page-summary';
  summaryEl.textContent = formatSummary(toolCount, eventCount);
  item.appendChild(summaryEl);

  // Clear button (show on hover)
  if (onClear) {
    const clearBtn = document.createElement('button');
    clearBtn.className = 'page-view-delete-btn';
    clearBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
    clearBtn.title = 'Clear this page and its events';
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClear(pageGroup.page.id);
    });
    item.appendChild(clearBtn);
  }

  // Click handler for selection
  item.addEventListener('click', () => {
    if (onSelect) onSelect(pageGroup.page.id);
  });

  // Context menu
  if (onContextMenu) {
    item.addEventListener('contextmenu', (e) => onContextMenu(e, pageGroup.page.id));
  }

  return item;
}

// Export groupEventsByPage for use by other modules (already used internally)
export { groupEventsByPage };
