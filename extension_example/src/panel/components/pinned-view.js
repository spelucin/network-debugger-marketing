// Pinned view (Feature #45) — multi-domain, Stack-style layout extracted from
// the coordinator (Feature #142). Each domain is a collapsible section holding
// the implicit "Default" inbox plus any user-created groups; rows support
// drag-to-group, inline notes, keyboard multi-select, and per-scope copy/delete
// context menus.
//
// Mirrors the view-component pattern used by stack-view.js / script-tree.js:
// `initPinnedView(deps)` wires the small panel-owned surface (shared `state`,
// `elements`, `render`, `getCurrentPinDomain`, `handleEventSelect`,
// `updateSetting`) once at startup; everything else is imported directly from
// the already-extracted primitives. The coordinator keeps ownership of pinned
// state persistence (pinned-state.js), the toolbar handlers, and the in-row
// pin toggle — this module owns only the view rendering and its in-view menus.

import { trackEvent } from '../analytics.js';
import { showPinnedContextMenu } from './pinned-context-menu.js';
import { showConfirmDialog } from './confirm-modal.js';
import {
  getPinnedRecordsForDomain,
  getGroupsForDomain,
  getAllDomainsWithPins,
  setPinnedNote,
  renameGroup as renamePinnedGroup,
  reorderGroup as reorderPinnedGroup,
  movePinToGroup,
  movePinsToGroup,
  togglePin as togglePinnedState,
  clearAllPinnedForDomain,
  deleteGroupAndPins,
  unpinMany,
  clearInboxForDomain,
} from '../pinned-state.js';
import {
  copyEventAsExtended,
  copyEventsAsTable,
  copyEventsAsJSON,
  copyEventsAsProperties,
  copyEventsAsFullExport,
  copyEventAsJSON,
  copyEventWithProperties,
  copyEventConsent,
  copyPinnedAsTable,
} from '../copy-export.js';

// Panel-owned surface injected once via initPinnedView(). Render functions and
// in-view handlers read it instead of reaching into panel.js globals.
//   state               — the shared mutable panel state object
//   elements            — DOM element refs (only elements.eventList is used here)
//   render              — coordinator re-render trigger
//   getCurrentPinDomain — () => registrable domain of the inspected page, or null
//   handleEventSelect   — (eventId, clickEvent, domain) => void
//   updateSetting       — (key, value) => void  (persists a single setting)
//   createEventItem        — event-list.js row builder (injected to avoid the
//                            panel ↔ event-list import cycle, keeping this module
//                            independently importable in tests)
//   ensureEventRowDelegation — event-list.js delegation installer (same reason)
let _deps = null;

export function initPinnedView(deps) {
  _deps = deps;
}

// Chronological compare for two pinned records — timestamp ascending with the
// dataLayer pushIndex as a stable tiebreaker for same-millisecond events.
// Mirrors event-list.js compareEventsAsc so the Pinned-view "index" (capture
// order) sort behaves like the Stream view's index sort for equal timestamps.
function pinnedChronoCompareAsc(a, b) {
  const at = a.snapshot?.timestamp || 0;
  const bt = b.snapshot?.timestamp || 0;
  if (at !== bt) return at - bt;
  const ai = a.snapshot?.formatted?.pushIndex ?? a.snapshot?.formatted?.eventIndex ?? 0;
  const bi = b.snapshot?.formatted?.pushIndex ?? b.snapshot?.formatted?.eventIndex ?? 0;
  return ai - bi;
}

// Sort comparator for the Pinned-view sort modes (BUG52). The base comparator
// for each mode is ascending (oldest / first / earliest at the top); the
// active direction flips it. 'newest-bottom' = ascending, 'newest-top' =
// descending — same semantics as the Stream view's stream-direction-btn.
function getPinnedSortComparator() {
  // dir = +1 keeps the ascending base order; -1 reverses it to descending.
  const dir = _deps.state.pinnedSortDirection === 'newest-top' ? -1 : 1;
  let base;
  switch (_deps.state.pinnedSortMode) {
    case 'start':
      // When the event/request started firing.
      base = (a, b) => (a.snapshot?.timestamp || 0) - (b.snapshot?.timestamp || 0);
      break;
    case 'finish':
      // When the response completed. For dataLayer pushes finish === start;
      // for pinned network requests it's the later of the two.
      base = (a, b) =>
        ((a.snapshot?.finishTimestamp ?? a.snapshot?.timestamp) || 0) -
        ((b.snapshot?.finishTimestamp ?? b.snapshot?.timestamp) || 0);
      break;
    case 'pinned':
      // When the user pinned the event.
      base = (a, b) => (a.pinnedAt || 0) - (b.pinnedAt || 0);
      break;
    case 'index':
    default:
      // Capture order — chronological proxy for frozen snapshots.
      base = pinnedChronoCompareAsc;
      break;
  }
  return (a, b) => dir * base(a, b);
}

// Render the Pinned view — Stack-style multi-domain layout. Each domain
// is a collapsible section. The currently-inspected domain auto-expands
// on first render; the user can collapse/expand any domain after that.
// Inside a domain, pins are grouped into the implicit "Inbox" plus any
// user-created Groups.
export function renderPinnedView(container) {
  _deps.ensureEventRowDelegation(container);
  container.innerHTML = '';

  const domains = getAllDomainsWithPins();
  const currentDomain = _deps.getCurrentPinDomain();

  // Empty state — no pinned events on any domain
  if (domains.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'pinned-empty-state';
    if (currentDomain) {
      empty.appendChild(document.createTextNode('Nothing pinned for '));
      const strong = document.createElement('strong');
      strong.textContent = currentDomain;
      empty.appendChild(strong);
      empty.appendChild(document.createTextNode(' yet.'));
    } else {
      empty.textContent = 'Pinned events live per domain. Open a page to start pinning.';
    }
    empty.appendChild(document.createElement('br'));
    const hint = document.createElement('span');
    hint.className = 'pinned-empty-hint';
    hint.textContent = 'Hover an event in Stream and click the pushpin to save it here. Pinned events survive Clear and reloads.';
    empty.appendChild(hint);
    container.appendChild(empty);
    return;
  }

  // Default-collapse every domain except the currently-inspected one,
  // but only on the very first render after a Pinned-view entry — once
  // the user has touched a chevron we respect their choice. The set is
  // populated lazily here so domains added during the session inherit
  // the same default behaviour.
  for (const d of domains) {
    if (d !== currentDomain && !_deps.state.pinnedDomainsCollapsed.has(d)) {
      // Mark non-current domains as collapsed by default the *first*
      // time we see them; if the user expands one we won't re-collapse.
      if (!_deps.state.pinnedDomainsCollapsed.has(`__seen::${d}`)) {
        _deps.state.pinnedDomainsCollapsed.add(d);
        _deps.state.pinnedDomainsCollapsed.add(`__seen::${d}`);
      }
    } else if (d === currentDomain) {
      _deps.state.pinnedDomainsCollapsed.delete(d);
      _deps.state.pinnedDomainsCollapsed.add(`__seen::${d}`);
    }
  }

  const fragment = document.createDocumentFragment();

  // Onboarding hint bar — teaches drag-and-drop + keyboard multi-select.
  // Sits above the current-domain section. Dismissible via X; the dismissal
  // persists in settings as `pinnedHintsDismissed`.
  if (!_deps.state.pinnedHintsDismissed) {
    fragment.appendChild(renderPinnedHintsBar());
  }

  // Sort domains: current first, then alphabetical
  const orderedDomains = domains.slice().sort((a, b) => {
    if (a === currentDomain) return -1;
    if (b === currentDomain) return 1;
    return a < b ? -1 : 1;
  });

  for (const domain of orderedDomains) {
    fragment.appendChild(renderPinnedDomainSection(domain, currentDomain));
  }
  container.appendChild(fragment);
}

function renderPinnedHintsBar() {
  const bar = document.createElement('div');
  bar.className = 'pinned-hints-bar';
  bar.setAttribute('role', 'note');

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('class', 'pinned-hints-icon');
  icon.setAttribute('width', '14');
  icon.setAttribute('height', '14');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '2');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  // Same info-icon glyph as .script-tree-info-banner / .grouped-info-banner
  const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '10');
  icon.appendChild(c);
  const p1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p1.setAttribute('d', 'M12 16v-4M12 8h.01');
  icon.appendChild(p1);
  bar.appendChild(icon);

  const text = document.createElement('span');
  text.className = 'pinned-hints-text';
  const tip1 = document.createElement('span');
  tip1.textContent = 'Drag an event onto a group to move it';
  text.appendChild(tip1);
  text.appendChild(document.createTextNode(' · '));
  const tip2 = document.createElement('span');
  tip2.textContent = 'Shift- or Ctrl-click to select multiple';
  text.appendChild(tip2);
  bar.appendChild(text);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'pinned-hints-close';
  closeBtn.setAttribute('aria-label', 'Dismiss tip');
  closeBtn.title = 'Dismiss';
  const x = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  x.setAttribute('width', '12'); x.setAttribute('height', '12');
  x.setAttribute('viewBox', '0 0 24 24');
  x.setAttribute('fill', 'none');
  x.setAttribute('stroke', 'currentColor');
  x.setAttribute('stroke-width', '2');
  x.setAttribute('stroke-linecap', 'round');
  x.setAttribute('stroke-linejoin', 'round');
  const xp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  xp.setAttribute('d', 'M18 6L6 18M6 6l12 12');
  x.appendChild(xp);
  closeBtn.appendChild(x);
  closeBtn.addEventListener('click', () => {
    _deps.state.pinnedHintsDismissed = true;
    _deps.updateSetting('pinnedHintsDismissed', true);
    _deps.render();
  });
  bar.appendChild(closeBtn);

  return bar;
}

function renderPinnedDomainSection(domain, currentDomain) {
  const records = getPinnedRecordsForDomain(domain);
  const groups = getGroupsForDomain(domain);
  const isCurrent = domain === currentDomain;
  const collapsed = _deps.state.pinnedDomainsCollapsed.has(domain);

  const section = document.createElement('div');
  section.className = `pinned-domain-section${collapsed ? ' collapsed' : ''}`;
  section.dataset.domain = domain;

  // Header
  const header = document.createElement('div');
  header.className = 'pinned-domain-header';
  const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  chevron.setAttribute('class', 'pinned-domain-chevron');
  chevron.setAttribute('width', '12');
  chevron.setAttribute('height', '12');
  chevron.setAttribute('viewBox', '0 0 24 24');
  chevron.setAttribute('fill', 'none');
  chevron.setAttribute('stroke', 'currentColor');
  chevron.setAttribute('stroke-width', '2');
  const chevPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  chevPath.setAttribute('d', 'M6 9l6 6 6-6');
  chevron.appendChild(chevPath);
  header.appendChild(chevron);

  const title = document.createElement('strong');
  title.textContent = domain;
  header.appendChild(title);

  if (isCurrent) {
    const tag = document.createElement('span');
    tag.className = 'pinned-domain-current-tag';
    tag.textContent = 'Current';
    header.appendChild(tag);
  }

  const count = document.createElement('span');
  count.className = 'pinned-domain-count';
  const groupCountText = groups.length > 0 ? ` · ${groups.length} group${groups.length === 1 ? '' : 's'}` : '';
  count.textContent = `${records.length} pinned${groupCountText}`;
  header.appendChild(count);

  header.addEventListener('click', () => {
    if (_deps.state.pinnedDomainsCollapsed.has(domain)) {
      _deps.state.pinnedDomainsCollapsed.delete(domain);
    } else {
      _deps.state.pinnedDomainsCollapsed.add(domain);
    }
    _deps.render();
  });
  // Right-click on a domain header opens the same export menu as the
  // toolbar Export button — but scoped to this domain (whether or not
  // it's the inspected page's domain). Without this handler the browser
  // shows its native context menu, which is useless for pinned data.
  header.addEventListener('contextmenu', (e) => {
    showPinnedDomainHeaderContextMenu(e, domain);
  });
  section.appendChild(header);

  // Body
  const body = document.createElement('div');
  body.className = 'pinned-domain-body';

  // Bucket records by group: Inbox (no groupIds) first, then each user group
  const inboxRecords = records.filter(r => !r.groupIds || r.groupIds.length === 0);
  body.appendChild(renderPinnedGroupSection(domain, 'inbox', 'Default', inboxRecords, true));
  for (const group of groups) {
    const groupRecords = records.filter(r => Array.isArray(r.groupIds) && r.groupIds.includes(group.id));
    body.appendChild(renderPinnedGroupSection(domain, group.id, group.name, groupRecords, false));
  }

  section.appendChild(body);
  return section;
}

function renderPinnedGroupSection(domain, groupId, groupName, records, isInbox) {
  const collapseKey = `${domain}::${groupId}`;
  const collapsed = _deps.state.pinnedGroupsCollapsed.has(collapseKey);
  const section = document.createElement('div');
  section.className = `pinned-group-section${collapsed ? ' collapsed' : ''}`;
  section.dataset.groupId = groupId;

  const header = document.createElement('div');
  header.className = 'pinned-group-header';

  const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  chevron.setAttribute('class', 'pinned-group-chevron');
  chevron.setAttribute('width', '10');
  chevron.setAttribute('height', '10');
  chevron.setAttribute('viewBox', '0 0 24 24');
  chevron.setAttribute('fill', 'none');
  chevron.setAttribute('stroke', 'currentColor');
  chevron.setAttribute('stroke-width', '2');
  const chevPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  chevPath.setAttribute('d', 'M6 9l6 6 6-6');
  chevron.appendChild(chevPath);
  header.appendChild(chevron);

  const name = document.createElement('span');
  name.className = `pinned-group-name${isInbox ? ' pinned-group-name-inbox' : ''}`;
  name.textContent = groupName;
  header.appendChild(name);

  const count = document.createElement('span');
  count.className = 'pinned-group-count';
  count.textContent = `${records.length}`;
  header.appendChild(count);

  header.addEventListener('click', () => {
    if (_deps.state.pinnedGroupsCollapsed.has(collapseKey)) {
      _deps.state.pinnedGroupsCollapsed.delete(collapseKey);
    } else {
      _deps.state.pinnedGroupsCollapsed.add(collapseKey);
    }
    _deps.render();
  });
  // Right-click on group header → Rename / Delete (Inbox shows a disabled
  // explainer instead).
  header.addEventListener('contextmenu', (e) => {
    showPinnedGroupHeaderContextMenu(e, domain, groupId, groupName, isInbox);
  });
  // Drag source — user groups can be dragged onto each other to reorder.
  // Default ("Inbox") stays anchored at top, so it's not a drag source.
  if (!isInbox) {
    header.setAttribute('draggable', 'true');
    header.addEventListener('dragstart', (e) => {
      _pinnedDragGroupId = groupId;
      _pinnedDragGroupSourceDomain = domain;
      header.classList.add('dragging');
      // Stop propagation so the dragstart doesn't bubble to any ancestor
      // that might treat it as a different gesture.
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('application/x-pinned-group-id', groupId); } catch (_) { /* defensive */ }
      }
    });
    header.addEventListener('dragend', () => {
      _pinnedDragGroupId = null;
      _pinnedDragGroupSourceDomain = null;
      header.classList.remove('dragging');
      document.querySelectorAll('.pinned-group-section.group-reorder-target').forEach(el => {
        el.classList.remove('group-reorder-target');
        delete el.dataset.dropPosition;
      });
    });
  }
  // Drop target — drag a pinned event onto a group header to assign
  // membership (existing). Also accepts a group-header drag for reorder
  // (skipped on Inbox to keep Default anchored at top).
  attachGroupDropTarget(section, header, domain, groupId, isInbox);
  section.appendChild(header);

  const body = document.createElement('div');
  body.className = 'pinned-group-body';

  if (records.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'pinned-group-empty';
    empty.textContent = isInbox
      ? 'No pinned events in Default.'
      : 'Empty group. Drag a pinned event here, or right-click an event to add it.';
    body.appendChild(empty);
  } else {
    const cmp = getPinnedSortComparator();
    const ordered = records.slice().sort(cmp);
    ordered.forEach((rec, idx) => {
      const ev = rec.snapshot;
      // Row-scoped context menu shows pinned-aware actions (Move ▸ /
      // Also in ▸ / Remove from group / Edit note / Unpin). The
      // sourceGroupId is captured in closure so "Remove from this group"
      // knows which group the row was drawn under. The `domain` is
      // threaded so multi-select gestures and bulk operations stay
      // scoped to the right domain when multiple are visible.
      const onRowContextMenu = (e) => showPinnedRowContextMenuInPinnedView(e, ev, groupId, domain);
      const onSelect = (eventId, clickEvent) => _deps.handleEventSelect(eventId, clickEvent, domain);
      const item = _deps.createEventItem(
        ev,
        idx,
        ev.id === _deps.state.selectedEventId,
        onSelect,
        false,
        _deps.state.highlightedPlatforms,
        onRowContextMenu,
        null
      );
      attachPinnedNoteAffordance(item, ev, domain, rec.note || '');
      makePinnedRowDraggable(item, ev.id, domain);
      applyPinnedRowTooltip(item);
      body.appendChild(item);
    });
  }

  section.appendChild(body);
  return section;
}

// Pin ids in the order they're rendered for a domain — Inbox first
// (sorted by the active comparator), then each group's pins in the same
// order. Used for Shift-click range selection so the highlighted band
// matches what the user sees on screen.
export function getVisiblePinIdsInDomain(domain) {
  if (!domain) return [];
  const records = getPinnedRecordsForDomain(domain);
  const groups = getGroupsForDomain(domain);
  const cmp = getPinnedSortComparator();
  const inboxRecords = records.filter(r => !r.groupIds || r.groupIds.length === 0).slice().sort(cmp);
  const ids = inboxRecords.map(r => r.pinId);
  for (const g of groups) {
    const groupRecords = records.filter(r => Array.isArray(r.groupIds) && r.groupIds.includes(g.id)).slice().sort(cmp);
    for (const r of groupRecords) ids.push(r.pinId);
  }
  return ids;
}

// Apply the .multi-selected highlight class to every pinned row in the
// active selection. Done as a post-render pass so the selection state
// doesn't have to be plumbed through createEventItem's render API.
export function applyPinnedMultiSelectClasses() {
  if (_deps.state.pinnedSelectedEventIds.size === 0) return;
  for (const id of _deps.state.pinnedSelectedEventIds) {
    const row = _deps.elements.eventList.querySelector(`.event-item[data-event-id="${CSS.escape(id)}"]`);
    if (row) row.classList.add('multi-selected');
  }
}

// ===== Pinned-view drag and drop =====

// Track the active drag target across the dragstart/dragover/drop chain
// so dragend can clean up indicator classes even if the user dropped
// outside any valid target. Bulk-drag uses an array of ids; single-drag
// stores a one-element array.
let _pinnedDragRowIds = null;
let _pinnedDragSourceDomain = null;

// Group-header drag (manual reorder). Mutually exclusive with the pin-row
// drag above — only one is non-null at a time. Default ("Inbox") is never
// a drag source and never a reorder drop target — it stays anchored at the
// top of every domain section.
let _pinnedDragGroupId = null;
let _pinnedDragGroupSourceDomain = null;

// Replaces the per-element "event name" tooltip on a Pinned-view row with a
// simple verb hint. Other titles on the row (badges, chips, platform icon)
// keep their richer text — those carry context-specific info worth surfacing.
const PINNED_ROW_TOOLTIP = 'Click to view · drag to move';

function applyPinnedRowTooltip(item) {
  item.title = PINNED_ROW_TOOLTIP;
  const nameEl = item.querySelector('.event-name');
  if (nameEl) nameEl.title = PINNED_ROW_TOOLTIP;
  const labelEl = item.querySelector('.interaction-label');
  if (labelEl) labelEl.title = PINNED_ROW_TOOLTIP;
}

function makePinnedRowDraggable(item, eventId, domain) {
  item.setAttribute('draggable', 'true');
  item.addEventListener('dragstart', (e) => {
    // If the dragged row is part of an active multi-selection in the
    // same domain, drag the whole set — otherwise drag just this row.
    const isInMulti = _deps.state.pinnedSelectionDomain === domain
      && _deps.state.pinnedSelectedEventIds.size >= 2
      && _deps.state.pinnedSelectedEventIds.has(eventId);
    _pinnedDragRowIds = isInMulti ? Array.from(_deps.state.pinnedSelectedEventIds) : [eventId];
    _pinnedDragSourceDomain = domain;
    // Mark every dragged row as .dragging for the visual fade.
    for (const id of _pinnedDragRowIds) {
      const row = _deps.elements.eventList.querySelector(`.event-item[data-event-id="${CSS.escape(id)}"]`);
      if (row) row.classList.add('dragging');
    }
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      // Marker payload — we read state via the closure above, but
      // setting *some* data is required for dragstart to "stick" in some
      // browsers.
      try { e.dataTransfer.setData('application/x-pinned-event-id', _pinnedDragRowIds.join(',')); } catch (_) { /* defensive */ }
    }
  });
  item.addEventListener('dragend', () => {
    for (const id of _pinnedDragRowIds || []) {
      const row = _deps.elements.eventList.querySelector(`.event-item[data-event-id="${CSS.escape(id)}"]`);
      if (row) row.classList.remove('dragging');
    }
    _pinnedDragRowIds = null;
    _pinnedDragSourceDomain = null;
    document.querySelectorAll('.pinned-group-section.drop-target, .pinned-group-header.drop-target-header').forEach(el => {
      el.classList.remove('drop-target', 'drop-target-header');
    });
  });
}

function attachGroupDropTarget(section, header, domain, groupId, isInbox) {
  const acceptPinDrop = (e) => {
    if (!_pinnedDragRowIds || _pinnedDragRowIds.length === 0) return false;
    if (_pinnedDragSourceDomain !== domain) return false; // cross-domain drag isn't supported
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    return true;
  };
  // Group-on-group reorder. Default ("Inbox") stays anchored at top, so it
  // never accepts a group-reorder drop. A group dropped on itself is a no-op.
  const acceptGroupReorder = (e) => {
    if (!_pinnedDragGroupId) return false;
    if (_pinnedDragGroupSourceDomain !== domain) return false;
    if (isInbox) return false;
    if (_pinnedDragGroupId === groupId) return false;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    return true;
  };
  // Pick "above" vs "below" based on which half of the header the cursor is
  // hovering. Header is the stable anchor — sections can be tall when
  // expanded, so the section midpoint isn't intuitive.
  const computeDropPosition = (e) => {
    const r = header.getBoundingClientRect();
    return e.clientY < r.top + r.height / 2 ? 'above' : 'below';
  };
  section.addEventListener('dragover', (e) => {
    if (acceptPinDrop(e)) {
      section.classList.add('drop-target');
      header.classList.add('drop-target-header');
    } else if (acceptGroupReorder(e)) {
      const pos = computeDropPosition(e);
      section.classList.add('group-reorder-target');
      section.dataset.dropPosition = pos;
    }
  });
  section.addEventListener('dragleave', (e) => {
    if (e.target === section || !section.contains(e.relatedTarget)) {
      section.classList.remove('drop-target', 'group-reorder-target');
      header.classList.remove('drop-target-header');
      delete section.dataset.dropPosition;
    }
  });
  section.addEventListener('drop', async (e) => {
    // Pin-row drop (existing behaviour) — move pin(s) into this group.
    if (_pinnedDragRowIds && _pinnedDragRowIds.length > 0 && _pinnedDragSourceDomain === domain) {
      e.preventDefault();
      section.classList.remove('drop-target');
      header.classList.remove('drop-target-header');
      const draggedIds = _pinnedDragRowIds.slice();
      _pinnedDragRowIds = null;
      _pinnedDragSourceDomain = null;
      if (draggedIds.length === 1) {
        await movePinToGroup(draggedIds[0], domain, groupId);
        trackEvent('pinned_view', { action: 'drag_move_to_group', count: 1 });
      } else {
        await movePinsToGroup(draggedIds, domain, groupId);
        trackEvent('pinned_view', { action: 'drag_move_to_group', count: draggedIds.length });
        // Clear the selection on bulk-move so the user gets a fresh state
        // (matches Stream's bulk-pin idiom — gesture consumed).
        _deps.state.pinnedSelectedEventIds.clear();
        _deps.state.pinnedSelectionAnchor = null;
        _deps.state.pinnedSelectionDomain = null;
      }
      return;
    }
    // Group-header drop — reorder the dragged group above or below this
    // group based on the cursor's position over the header.
    if (_pinnedDragGroupId && _pinnedDragGroupSourceDomain === domain && !isInbox && _pinnedDragGroupId !== groupId) {
      e.preventDefault();
      const pos = section.dataset.dropPosition || computeDropPosition(e);
      section.classList.remove('group-reorder-target');
      delete section.dataset.dropPosition;
      const draggedGroupId = _pinnedDragGroupId;
      _pinnedDragGroupId = null;
      _pinnedDragGroupSourceDomain = null;
      const reorderPos = pos === 'below' ? 'after' : 'before';
      const moved = await reorderPinnedGroup(domain, draggedGroupId, groupId, reorderPos);
      if (moved) {
        trackEvent('pinned_view', { action: 'group_reorder', position: reorderPos });
      }
    }
  });
}

// Append the inline-note affordance to a pinned event row. Renders a
// muted text span after the event name; clicking opens an inline input
// that persists on blur or Enter.
function attachPinnedNoteAffordance(item, event, domain, currentNote) {
  const nameEl = item.querySelector('.event-name');
  if (!nameEl) return;

  const noteEl = document.createElement('span');
  noteEl.className = `event-pinned-note${currentNote ? ' has-note' : ' empty-note'}`;
  noteEl.textContent = currentNote ? `— ${currentNote}` : '+ note';
  noteEl.title = currentNote
    ? 'Click to edit note (saved with this pin)'
    : 'Click to add a note (saved with this pin)';
  noteEl.addEventListener('click', (e) => {
    e.stopPropagation(); // don't open detail panel when editing note
    startNoteEdit(noteEl, event, domain, currentNote);
  });
  nameEl.appendChild(noteEl);
}

function startNoteEdit(noteEl, event, domain, currentNote) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'event-pinned-note-input';
  input.value = currentNote || '';
  input.placeholder = 'Note (visible after the event name)';
  input.maxLength = 200;
  // Replace the muted span with the input
  noteEl.replaceWith(input);
  input.focus();
  input.select();

  let committed = false;
  const commit = async () => {
    if (committed) return;
    committed = true;
    const next = input.value.trim();
    await setPinnedNote(event.id, domain, next);
    // pinned-state subscriber triggers render() — input goes away with re-render
  };
  const cancel = () => {
    if (committed) return;
    committed = true;
    _deps.render(); // discard the input by re-rendering
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    e.stopPropagation();
  });
  // Don't let clicks inside the input bubble to the row's select handler
  input.addEventListener('click', (e) => e.stopPropagation());
}

// ===== Pinned context-menu builders =====
//
// Streamlined design: right-click only offers actions that have no other
// entry point in the UI. Edit-note is reachable by clicking the inline note
// affordance; Move-to-group is reachable via drag-and-drop. Multi-group
// membership was dropped — pins live in one place at a time.
//
// The remaining actions are:
//   - Copy (AI / Human / Complete / Markdown Table, plus Consent on a row)
//   - Rename group
//   - Delete (cascade — domain delete wipes the whole domain; group delete
//     removes the group + its pins; event delete is unpin)

// Reusable per-scope confirm copy. Keeps the wording consistent across the
// three menus (domain / group / Inbox / event / bulk).
function confirmDelete(opts) {
  return showConfirmDialog({
    title: opts.title,
    message: opts.message,
    confirmLabel: opts.confirmLabel || 'Delete',
    cancelLabel: 'Cancel',
    danger: true,
  });
}

// Pinned view: right-click on a pinned event row inside a specific group
// section. Two modes — single (default) and bulk (when the right-clicked row
// is part of a same-domain multi-selection of 2+ rows).
function showPinnedRowContextMenuInPinnedView(e, event, sourceGroupId, rowDomain) {
  const domain = rowDomain || _deps.getCurrentPinDomain();
  if (!domain || !event || !event.id) return;
  const items = [];

  const isBulk = _deps.state.pinnedSelectionDomain === domain
    && _deps.state.pinnedSelectedEventIds.size >= 2
    && _deps.state.pinnedSelectedEventIds.has(event.id);
  const bulkIds = isBulk ? Array.from(_deps.state.pinnedSelectedEventIds) : null;
  const count = isBulk ? bulkIds.length : 1;

  if (isBulk) {
    items.push({
      scopeHeader: `${count} pinned events selected`,
      icon: 'jsonProperties',
      label: 'Copy for AI',
      onClick: () => {
        copyEventsAsProperties(bulkIds);
        trackEvent('pinned_view', { action: 'bulk_copy', format: 'ai_ready', count });
      },
    });
    items.push({ separator: true });
    items.push({
      icon: 'jsonBasic',
      label: 'Copy for Human',
      onClick: () => {
        copyEventsAsJSON(bulkIds);
        trackEvent('pinned_view', { action: 'bulk_copy', format: 'basic', count });
      },
    });
    items.push({
      icon: 'jsonComplete',
      label: 'Copy Complete',
      onClick: () => {
        copyEventsAsFullExport(bulkIds);
        trackEvent('pinned_view', { action: 'bulk_copy', format: 'complete', count });
      },
    });
    items.push({
      icon: 'table',
      label: 'Copy Markdown Table',
      onClick: () => {
        copyEventsAsTable(bulkIds, { scopeContext: { scope: 'pinned', domain } });
        trackEvent('pinned_view', { action: 'bulk_copy', format: 'table', count });
      },
    });
    items.push({ separator: true });
    items.push({
      icon: 'trash',
      label: `Delete ${count} events`,
      danger: true,
      onClick: async () => {
        const ok = await confirmDelete({
          title: `Delete ${count} pinned events?`,
          message: `Removes ${count} events from the Pinned view on ${domain}.\nThis cannot be undone.`,
        });
        if (!ok) return;
        await unpinMany(bulkIds, domain);
        trackEvent('pinned_view', { action: 'bulk_delete', count, from: 'pinned_view' });
        _deps.state.pinnedSelectedEventIds.clear();
        _deps.state.pinnedSelectionAnchor = null;
        _deps.state.pinnedSelectionDomain = null;
      },
    });
    showPinnedContextMenu(e, items);
    return;
  }

  // Single-event menu — mirrors the stream-view event copy menu, then a
  // single destructive Delete action at the bottom.
  items.push({
    scopeHeader: 'Selected pinned event',
    icon: 'jsonProperties',
    label: 'Copy for AI',
    onClick: () => {
      copyEventWithProperties(event.id);
      trackEvent('pinned_view', { action: 'event_copy', format: 'ai_ready' });
    },
  });
  items.push({ separator: true });
  items.push({
    icon: 'jsonBasic',
    label: 'Copy for Human',
    onClick: () => {
      copyEventAsJSON(event.id);
      trackEvent('pinned_view', { action: 'event_copy', format: 'basic' });
    },
  });
  items.push({
    icon: 'jsonComplete',
    label: 'Copy Complete',
    onClick: () => {
      copyEventAsExtended(event.id);
      trackEvent('pinned_view', { action: 'event_copy', format: 'complete' });
    },
  });
  items.push({
    icon: 'table',
    label: 'Copy Markdown Table',
    onClick: () => {
      copyEventsAsTable([event.id]);
      trackEvent('pinned_view', { action: 'event_copy', format: 'table' });
    },
  });
  items.push({
    icon: 'shield',
    label: 'Copy Consent',
    onClick: () => {
      copyEventConsent(event.id);
      trackEvent('pinned_view', { action: 'event_copy', format: 'consent' });
    },
  });
  items.push({ separator: true });
  items.push({
    icon: 'trash',
    label: 'Delete event',
    danger: true,
    onClick: async () => {
      const ok = await confirmDelete({
        title: 'Delete this pinned event?',
        message: 'Removes the event from the Pinned view.\nThis cannot be undone.',
      });
      if (!ok) return;
      await togglePinnedState(event, domain);
      trackEvent('unpin_event', { platform: event.platform, from: 'pinned_view' });
    },
  });

  showPinnedContextMenu(e, items);
}

// Pinned view: right-click on a domain header. Four copy actions scoped to
// the clicked domain, plus a destructive Delete-all that wipes every pin
// and group for the domain (and removes the domain header itself).
function showPinnedDomainHeaderContextMenu(e, domain) {
  const items = [];
  const records = getPinnedRecordsForDomain(domain);
  const groups = getGroupsForDomain(domain);
  const pinIds = records.map(r => r.pinId);
  const totalPins = pinIds.length;
  const groupCount = groups.filter(g =>
    records.some(r => Array.isArray(r.groupIds) && r.groupIds.includes(g.id))
  ).length;
  const groupSuffix = groupCount > 0
    ? ` (${totalPins} pins · ${groupCount} group${groupCount === 1 ? '' : 's'})`
    : ` (${totalPins} pins)`;
  const scopeLabel = `Pinned: ${domain}${groupSuffix}`;

  if (totalPins === 0) {
    items.push({
      scopeHeader: scopeLabel,
      label: 'No pinned events on this domain',
      disabled: true,
      onClick: () => {},
    });
    showPinnedContextMenu(e, items);
    return;
  }

  items.push({
    scopeHeader: scopeLabel,
    icon: 'jsonProperties',
    label: 'Copy for AI',
    onClick: () => {
      copyEventsAsProperties(pinIds);
      trackEvent('pinned_view', { action: 'domain_copy', format: 'ai_ready', count: totalPins });
    },
  });
  items.push({ separator: true });
  items.push({
    icon: 'jsonBasic',
    label: 'Copy for Human',
    onClick: () => {
      copyEventsAsJSON(pinIds);
      trackEvent('pinned_view', { action: 'domain_copy', format: 'basic', count: totalPins });
    },
  });
  items.push({
    icon: 'jsonComplete',
    label: 'Copy Complete',
    onClick: () => {
      copyEventsAsFullExport(pinIds);
      trackEvent('pinned_view', { action: 'domain_copy', format: 'complete', count: totalPins });
    },
  });
  items.push({
    icon: 'table',
    label: 'Copy Markdown Table',
    onClick: () => {
      copyPinnedAsTable(domain);
      trackEvent('pinned_view', { action: 'domain_copy', format: 'table', count: totalPins });
    },
  });
  items.push({ separator: true });
  items.push({
    icon: 'trash',
    label: `Delete all (${totalPins} event${totalPins === 1 ? '' : 's'})`,
    danger: true,
    onClick: async () => {
      const ok = await confirmDelete({
        title: `Delete all pinned events on ${domain}?`,
        message: `Removes every pinned event and group for this site (${totalPins} event${totalPins === 1 ? '' : 's'}${groupCount > 0 ? `, ${groupCount} group${groupCount === 1 ? '' : 's'}` : ''}).\nPins on other domains are not affected. This cannot be undone.`,
      });
      if (!ok) return;
      await clearAllPinnedForDomain(domain);
      trackEvent('pinned_view', { action: 'domain_delete', count: totalPins });
    },
  });

  showPinnedContextMenu(e, items);
}

// Pinned view: right-click on a group header. User groups get Rename + Copy
// + Delete-group-and-its-pins. Default (Inbox) can't be renamed or deleted
// but its pins can be cleared.
function showPinnedGroupHeaderContextMenu(e, domain, groupId, groupName, isInbox) {
  const items = [];
  const groupLabel = isInbox ? 'Default' : groupName;
  const scopeLabel = `Pinned: ${domain} — ${groupLabel}`;

  const getGroupPinIds = () => {
    const records = getPinnedRecordsForDomain(domain);
    const matching = isInbox
      ? records.filter(r => !r.groupIds || r.groupIds.length === 0)
      : records.filter(r => Array.isArray(r.groupIds) && r.groupIds.includes(groupId));
    return matching.map(r => r.pinId);
  };

  // Rename comes first for user groups; Inbox skips it.
  if (!isInbox) {
    items.push({
      scopeHeader: scopeLabel,
      icon: 'pencil',
      label: 'Rename group',
      onClick: () => {
        // eslint-disable-next-line no-alert
        const next = window.prompt('Rename group:', groupName);
        if (next == null) return;
        const trimmed = String(next).trim();
        if (!trimmed) return;
        renamePinnedGroup(domain, groupId, trimmed).then(() => {
          trackEvent('pinned_view', { action: 'group_rename' });
        });
      },
    });
    items.push({ separator: true });
  }

  items.push({
    ...(isInbox ? { scopeHeader: scopeLabel } : {}),
    icon: 'jsonProperties',
    label: 'Copy for AI',
    onClick: () => {
      const ids = getGroupPinIds();
      if (ids.length === 0) return;
      copyEventsAsProperties(ids);
      trackEvent('pinned_view', { action: 'group_copy', format: 'ai_ready', count: ids.length });
    },
  });
  items.push({ separator: true });
  items.push({
    icon: 'jsonBasic',
    label: 'Copy for Human',
    onClick: () => {
      const ids = getGroupPinIds();
      if (ids.length === 0) return;
      copyEventsAsJSON(ids);
      trackEvent('pinned_view', { action: 'group_copy', format: 'basic', count: ids.length });
    },
  });
  items.push({
    icon: 'jsonComplete',
    label: 'Copy Complete',
    onClick: () => {
      const ids = getGroupPinIds();
      if (ids.length === 0) return;
      copyEventsAsFullExport(ids);
      trackEvent('pinned_view', { action: 'group_copy', format: 'complete', count: ids.length });
    },
  });
  items.push({
    icon: 'table',
    label: 'Copy Markdown Table',
    onClick: () => {
      const ids = getGroupPinIds();
      if (ids.length === 0) return;
      copyEventsAsTable(ids, { scopeContext: { scope: 'pinned', domain, group: groupLabel } });
      trackEvent('pinned_view', { action: 'group_copy', format: 'table', count: ids.length });
    },
  });

  // Destructive Delete row — wording differs for Inbox (clears pins, keeps
  // Default itself) vs user groups (removes group + its pins).
  items.push({ separator: true });
  if (isInbox) {
    items.push({
      icon: 'trash',
      label: 'Delete all pins in Default',
      danger: true,
      onClick: async () => {
        const ids = getGroupPinIds();
        if (ids.length === 0) return;
        const ok = await confirmDelete({
          title: 'Delete all pins in Default?',
          message: `Removes ${ids.length} event${ids.length === 1 ? '' : 's'} from Default. User-group pins are not affected. This cannot be undone.`,
        });
        if (!ok) return;
        await clearInboxForDomain(domain);
        trackEvent('pinned_view', { action: 'inbox_delete', count: ids.length });
      },
    });
  } else {
    items.push({
      icon: 'trash',
      label: 'Delete group',
      danger: true,
      onClick: async () => {
        const ids = getGroupPinIds();
        const ok = await confirmDelete({
          title: `Delete group "${groupName}"?`,
          message: ids.length === 0
            ? `Removes the empty group "${groupName}".\nThis cannot be undone.`
            : `Removes the group "${groupName}" and its ${ids.length} pinned event${ids.length === 1 ? '' : 's'}.\nThis cannot be undone.`,
        });
        if (!ok) return;
        await deleteGroupAndPins(domain, groupId);
        trackEvent('pinned_view', { action: 'group_delete', count: ids.length });
      },
    });
  }

  showPinnedContextMenu(e, items);
}
