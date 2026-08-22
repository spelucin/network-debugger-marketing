// Event Row Delegation (#131 F4)
//
// One click + one contextmenu listener on the event-list container replaces
// the three per-row listeners previously attached inside createEventItem()
// (row click, row contextmenu, pin-button click). At 1,000+ rendered rows
// each 16ms-debounced full re-render was registering ~3,000 listeners and
// orphaning the previous render's closures; with delegation the container
// carries two listeners total, regardless of row count.
//
// Rows carry their event object and callbacks as expando properties set at
// render time (`_ewEvent`, `_ewOnSelect`, `_ewOnContextMenu` via
// attachRowData()). Per-row callbacks are load-bearing — do NOT replace them
// with module-level handlers: the Pinned view renders rows whose callbacks
// capture that row's group id and domain, so two rows in the same container
// can have different handlers. Dispatch must always use the row's own.
//
// This module is dependency-free on purpose: event-list.js cannot be imported
// in Node unit tests (it pulls in panel.js), so the dispatch logic lives here
// and receives its pin-action dependencies via createRowDelegationHandlers(deps).

/**
 * Store the row's event object and callbacks as expandos for the delegated
 * dispatch. Called by createEventItem() instead of addEventListener().
 */
export function attachRowData(item, event, onSelect, onContextMenu) {
  item._ewEvent = event;
  item._ewOnSelect = onSelect;
  if (onContextMenu) item._ewOnContextMenu = onContextMenu;
}

/**
 * Build the two container-level handlers. Dependencies are injected so the
 * dispatch logic is unit-testable without importing panel.js.
 *
 * @param {Object} deps
 * @param {Function} deps.isPartOfMultiSelection - (eventId) => boolean
 * @param {Function} deps.togglePinForMultiSelection - () => void
 * @param {Function} deps.togglePinForEvent - (event) => void
 */
export function createRowDelegationHandlers(deps) {
  const { isPartOfMultiSelection, togglePinForMultiSelection, togglePinForEvent } = deps;

  function handleClick(e) {
    const pinBtn = e.target && e.target.closest ? e.target.closest('.event-pin-btn') : null;
    if (pinBtn) {
      // Same contract as the old per-button listener: never let a pin click
      // open the detail panel or reach document-level handlers.
      e.stopPropagation();
      const row = pinBtn.closest('.event-item');
      const ev = row && row._ewEvent;
      if (!ev) return;
      try {
        // When the row is part of an active multi-selection, the pin button
        // becomes a bulk-pin trigger — pins every unpinned event in the
        // selection at once (already-pinned rows skip).
        if (isPartOfMultiSelection(ev.id)) {
          togglePinForMultiSelection();
        } else {
          togglePinForEvent(ev);
        }
      } catch (_) { /* panel may not be ready */ }
      return;
    }

    const row = e.target && e.target.closest ? e.target.closest('.event-item') : null;
    if (!row || !row._ewEvent || typeof row._ewOnSelect !== 'function') return;
    // Pass the native event so callers can read modifier keys
    // (Shift / Ctrl / Cmd) for multi-select gestures in Stream view.
    row._ewOnSelect(row._ewEvent.id, e);
  }

  function handleContextMenu(e) {
    const row = e.target && e.target.closest ? e.target.closest('.event-item') : null;
    if (!row || !row._ewEvent || typeof row._ewOnContextMenu !== 'function') return;
    row._ewOnContextMenu(e, row._ewEvent.platform, row._ewEvent.id);
  }

  return { handleClick, handleContextMenu };
}

/**
 * Install the delegated listeners on a container exactly once (idempotent —
 * every render entry point calls this lazily, so whichever view renders
 * first wires the shared container).
 */
export function installEventRowDelegation(container, deps) {
  if (!container || container._ewRowDelegationInstalled) return;
  container._ewRowDelegationInstalled = true;
  const handlers = createRowDelegationHandlers(deps);
  container.addEventListener('click', handlers.handleClick);
  container.addEventListener('contextmenu', handlers.handleContextMenu);
}
