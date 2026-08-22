// Generic one-level grouped renderer — Feature #60.
//
// Used by Grouped-view pivots whose grouping descriptor doesn't supply a
// custom renderer (Tool and Page keep their bespoke two-level renderers
// in event-list.js). The descriptor provides `groupKey` and `groupLabel`;
// this module turns that into collapsible group headers + sorted event
// rows. Reuses `createEventItem` and `compareEventsAsc` from event-list.js
// so row chrome stays identical across views.

import { createEventItem, compareEventsAsc, getSummaryCounts, formatSummary, ensureEventRowDelegation } from './event-list.js';

/**
 * Render a flat (one-level) grouped view.
 *
 * @param {HTMLElement} container - The event list container.
 * @param {Array}       events    - Filtered events to render.
 * @param {string|null} selectedId - Currently selected event id.
 * @param {Function}    onSelect  - Event-row click handler.
 * @param {Object}      grouping  - Grouping descriptor from groupings.js.
 * @param {Object}      options   - Render context.
 *   collapsedGroups: Set<string> — group keys currently collapsed (matched
 *                    via the descriptor's `id`-prefixed namespace, so multiple
 *                    pivots share one Set without colliding)
 *   onToggleGroupCollapse: (key) => void  — receives the bare group key
 *   onGroupContextMenu: optional (e, key, eventsInGroup) => void
 *   onEventContextMenu: optional event-row context menu handler
 *   highlightedPlatforms: Set<string>|null
 *   sortMode: 'start' | 'finish' | 'index'
 *   ctx: extra context (getCategoryForPlatform, …) forwarded to descriptor
 */
export function renderFlatGroupedView(container, events, selectedId, onSelect, grouping, options = {}) {
  ensureEventRowDelegation(container);
  const {
    collapsedGroups = new Set(),
    onToggleGroupCollapse,
    onGroupContextMenu,
    onEventContextMenu = null,
    highlightedPlatforms = null,
    sortMode = 'start',
    ctx = {},
  } = options;

  // Collapsed-set keys are namespaced by grouping id in panel.js so different
  // pivots can share one Set without collision. Mirror that namespacing here
  // when probing membership — using the bare key would always miss.
  const collapsePrefix = grouping.id + ':';
  const isCollapsedKey = (key) => collapsedGroups.has(collapsePrefix + key);

  const fragment = document.createDocumentFragment();

  // Apply descriptor-level event filter. Pivots like `event_name` use this to
  // exclude events that don't carry the dimension (navigations, script loads,
  // unparsed requests) so the buckets stay focused.
  const filteredEvents = typeof grouping.eventFilter === 'function'
    ? events.filter(grouping.eventFilter)
    : events;

  // Build index map for stable event indices in event rows.
  const indexMap = new Map();
  filteredEvents.forEach((e, i) => indexMap.set(e.id, i));

  // Sort comparator inside groups.
  const getSortTimestamp = sortMode === 'finish'
    ? (e) => e.finishTimestamp || e.timestamp
    : (e) => e.timestamp;
  const compareForSort = sortMode === 'index'
    ? (a, b) => (indexMap.get(a.id) ?? 0) - (indexMap.get(b.id) ?? 0)
    : (a, b) => compareEventsAsc(getSortTimestamp(a), getSortTimestamp(b), a, b);

  // Bucket events by the descriptor's groupKey. The descriptor may return
  // either a single key (most pivots — one event lands in one bucket) or
  // an array of keys (Identity pivot fan-out — one event with multiple
  // identifier kinds lands in every relevant bucket). The renderer
  // accepts both transparently; null entries inside an array are skipped.
  const buckets = new Map(); // key -> events[]
  for (const event of filteredEvents) {
    const keyOrKeys = grouping.groupKey(event, ctx);
    if (keyOrKeys == null) continue;
    const eventKeys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
    for (const key of eventKeys) {
      if (key == null) continue;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(event);
    }
  }

  // Order the groups.
  const keys = Array.from(buckets.keys());
  if (typeof grouping.sortGroups === 'function') {
    keys.sort(grouping.sortGroups);
  } else if (grouping.sortGroups === 'count-desc') {
    keys.sort((a, b) => buckets.get(b).length - buckets.get(a).length || (a < b ? -1 : a > b ? 1 : 0));
  } else if (grouping.sortGroups === 'alpha') {
    keys.sort();
  }
  // Default: insertion order (chronological by first occurrence).

  // Pivots that ship a `subGroupKey` get a two-level layout (Category ->
  // State -> Events for the consent pivot). When `subGroupKey(event, parentKey, ctx)`
  // returns null for a particular parent, that bucket falls back to flat
  // rendering (used for "No consent required", which has no meaningful state).
  const hasSubGrouping = typeof grouping.subGroupKey === 'function';

  for (const key of keys) {
    const eventsInGroup = buckets.get(key);
    const isCollapsed = isCollapsedKey(key);

    const groupEl = document.createElement('div');
    groupEl.className = `grouped-flat-group${isCollapsed ? ' collapsed' : ''}`;
    groupEl.dataset.groupKey = key;

    const header = createFlatGroupHeader(key, eventsInGroup, grouping, isCollapsed, onToggleGroupCollapse);
    if (onGroupContextMenu) {
      header.addEventListener('contextmenu', (e) => {
        onGroupContextMenu(e, key, eventsInGroup);
      });
    }
    groupEl.appendChild(header);

    if (!isCollapsed) {
      // Decide whether this parent bucket renders sub-groups or flat events.
      // Sample the first event to ask the descriptor — null means "skip
      // sub-grouping for this parent" (e.g. consent's "No consent required").
      // Array returns also count as "use sub-grouping" as long as at least
      // one element is non-null (Identity pivot fan-out case).
      const sampleSub = hasSubGrouping && eventsInGroup.length > 0
        ? grouping.subGroupKey(eventsInGroup[0], key, ctx)
        : null;
      const useSubGrouping = Array.isArray(sampleSub)
        ? sampleSub.some(k => k != null)
        : sampleSub != null;

      if (useSubGrouping) {
        renderSubGroups(
          groupEl, key, eventsInGroup, grouping, ctx,
          collapsedGroups, collapsePrefix, onToggleGroupCollapse,
          compareForSort, indexMap, selectedId, onSelect,
          highlightedPlatforms, onEventContextMenu, onGroupContextMenu
        );
      } else {
        const eventsEl = document.createElement('div');
        eventsEl.className = 'grouped-flat-group-events';
        const sortedEvents = [...eventsInGroup].sort(compareForSort);
        for (const event of sortedEvents) {
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
        }
        groupEl.appendChild(eventsEl);
      }
    }

    fragment.appendChild(groupEl);
  }

  // Clear container and append.
  const emptyState = container.querySelector('.empty-state');
  container.innerHTML = '';
  if (emptyState) container.appendChild(emptyState);
  container.appendChild(fragment);
}

// Render the level-2 sub-groups inside a parent bucket. Only invoked for
// pivots whose descriptor opted into sub-grouping. Collapse keys are
// compound `<parentKey>:<subKey>` so they sit alongside level-1 keys in
// the same Set without colliding.
function renderSubGroups(
  groupEl, parentKey, eventsInGroup, grouping, ctx,
  collapsedGroups, collapsePrefix, onToggleGroupCollapse,
  compareForSort, indexMap, selectedId, onSelect,
  highlightedPlatforms, onEventContextMenu, onGroupContextMenu
) {
  // Same array-or-single contract as L1: descriptors may return one key
  // or an array of keys per event. Identity uses arrays so an event with
  // multiple identifiers of the same canonical kind (e.g. Adobe events
  // with both Marketing Cloud ID and Analytics ID — both Device ID kind)
  // appears in every relevant L2 bucket.
  const subBuckets = new Map();
  for (const event of eventsInGroup) {
    const subKeyOrKeys = grouping.subGroupKey(event, parentKey, ctx);
    if (subKeyOrKeys == null) continue;
    const eventSubKeys = Array.isArray(subKeyOrKeys) ? subKeyOrKeys : [subKeyOrKeys];
    for (const subKey of eventSubKeys) {
      if (subKey == null) continue;
      if (!subBuckets.has(subKey)) subBuckets.set(subKey, []);
      subBuckets.get(subKey).push(event);
    }
  }

  const subKeys = Array.from(subBuckets.keys());
  if (typeof grouping.subGroupSort === 'function') {
    subKeys.sort(grouping.subGroupSort);
  } else if (grouping.subGroupSort === 'count-desc') {
    subKeys.sort((a, b) =>
      subBuckets.get(b).length - subBuckets.get(a).length
      || (a < b ? -1 : a > b ? 1 : 0)
    );
  } else if (grouping.subGroupSort === 'alpha') {
    subKeys.sort();
  }

  const subWrapEl = document.createElement('div');
  subWrapEl.className = 'grouped-flat-subgroups';

  for (const subKey of subKeys) {
    const eventsInSub = subBuckets.get(subKey);
    const compoundKey = parentKey + ':' + subKey;
    const isSubCollapsed = collapsedGroups.has(collapsePrefix + compoundKey);

    const subEl = document.createElement('div');
    subEl.className = `grouped-flat-subgroup${isSubCollapsed ? ' collapsed' : ''}`;
    subEl.dataset.groupKey = compoundKey;

    const subHeader = createSubGroupHeader(
      subKey, eventsInSub, grouping, isSubCollapsed,
      compoundKey, onToggleGroupCollapse
    );
    // Wire the same context menu used by L1 group headers — same actions
    // (Copy for AI / for Human / Complete / Markdown Table / AI Chat / Compare formats)
    // applied to just this slice's events. The display name passed to the menu
    // includes the parent key so headers like "Marketing → Granted" render right.
    if (onGroupContextMenu) {
      subHeader.addEventListener('contextmenu', (e) => {
        onGroupContextMenu(e, compoundKey, eventsInSub);
      });
    }
    subEl.appendChild(subHeader);

    if (!isSubCollapsed) {
      const eventsEl = document.createElement('div');
      eventsEl.className = 'grouped-flat-subgroup-events';
      const sortedEvents = [...eventsInSub].sort(compareForSort);
      for (const event of sortedEvents) {
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
      }
      subEl.appendChild(eventsEl);
    }

    subWrapEl.appendChild(subEl);
  }

  groupEl.appendChild(subWrapEl);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

// Create the chevron SVG used in flat and sub headers (rotates via CSS
// when the parent element carries `.collapsed`).
function buildHeaderChevron() {
  const chevron = document.createElement('span');
  chevron.className = 'grouped-flat-chevron';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M9 18l6-6-6-6');
  svg.appendChild(path);
  chevron.appendChild(svg);
  return chevron;
}

// Build the descriptor-supplied leading icon (e.g. coloured shield for
// consent states). Spec is `{ className, svgPath }`. SVG nodes are
// created via createElementNS — no innerHTML so XSS guards stay green.
function buildSubGroupIcon(spec) {
  const wrap = document.createElement('span');
  wrap.className = `grouped-flat-subicon ${spec.className || ''}`.trim();
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('stroke', 'none');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', spec.svgPath);
  svg.appendChild(path);
  wrap.appendChild(svg);
  return wrap;
}

function createSubGroupHeader(subKey, eventsInSub, grouping, isCollapsed, compoundKey, onToggle) {
  const header = document.createElement('div');
  header.className = `grouped-flat-subheader${isCollapsed ? ' collapsed' : ''}`;

  header.appendChild(buildHeaderChevron());

  if (typeof grouping.subGroupIcon === 'function') {
    const spec = grouping.subGroupIcon(subKey);
    if (spec && spec.svgPath) header.appendChild(buildSubGroupIcon(spec));
  }

  const labelEl = document.createElement('span');
  labelEl.className = 'grouped-flat-sublabel';
  labelEl.textContent = grouping.subGroupLabel
    ? grouping.subGroupLabel(subKey, eventsInSub)
    : subKey;
  header.appendChild(labelEl);

  const summary = document.createElement('span');
  summary.className = 'grouped-flat-subsummary';
  const n = eventsInSub.length;
  summary.textContent = `${n} event${n === 1 ? '' : 's'}`;
  header.appendChild(summary);

  if (onToggle) {
    header.style.cursor = 'pointer';
    header.addEventListener('click', (e) => {
      if (e.button !== 0) return;
      onToggle(compoundKey);
    });
  }

  return header;
}

function createFlatGroupHeader(key, eventsInGroup, grouping, isCollapsed, onToggle) {
  const header = document.createElement('div');
  header.className = `grouped-flat-header${isCollapsed ? ' collapsed' : ''}`;

  // Chevron
  const chevron = document.createElement('span');
  chevron.className = 'grouped-flat-chevron';
  chevron.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`;
  header.appendChild(chevron);

  // Group label
  const labelEl = document.createElement('span');
  labelEl.className = 'grouped-flat-label';
  labelEl.textContent = grouping.groupLabel(key, eventsInGroup);
  header.appendChild(labelEl);

  // Summary: tool count + event count
  const { toolCount, eventCount } = getSummaryCounts(eventsInGroup);
  const summary = document.createElement('span');
  summary.className = 'grouped-flat-summary';
  summary.textContent = formatSummary(toolCount, eventCount);
  header.appendChild(summary);

  if (onToggle) {
    header.style.cursor = 'pointer';
    header.addEventListener('click', (e) => {
      // Don't trigger when right-clicking
      if (e.button !== 0) return;
      onToggle(key);
    });
  }

  return header;
}
