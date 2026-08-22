/**
 * Detail Section State — shared collapsed/expanded memory for every
 * collapsible card in the event detail view.
 *
 * Why it exists: `renderEventDetail()` blows away the detail DOM on
 * every re-render (including when new events arrive in the stream
 * while the user has a section open). Without this, every section
 * would snap back to its default collapsed/expanded state on each
 * re-render, which is especially annoying for the AI Summary section
 * where an in-progress conversation would close mid-thought.
 *
 * Contract:
 *   - State is keyed by a string — either a `sectionId` (preferred,
 *     stable across label changes, used by feature #113's descriptor
 *     refactor) or a `sectionTitle` (legacy, still supported for
 *     inline collapsibles and sections that don't go through the
 *     descriptor list).
 *   - Default scope: the currently selected event. Selecting a
 *     different event clears the map — no memory accumulation, no
 *     "state from event A leaking into event B" bugs.
 *   - Opt-in `persistent: true` scope: state survives event changes
 *     for sections whose shape is shared across all events (e.g.
 *     Overview — every event has the same header/timestamp/platform
 *     layout, so its collapse choice should follow the user across
 *     selections).
 *   - `resetIfNewEvent(eventId)` is the single lifecycle hook the
 *     detail renderer calls at the top of every render. Sections
 *     themselves only need `getSectionExpandedState` and
 *     `saveSectionState`.
 *
 * Feature #113 migration note:
 *   The first parameter to getSectionExpandedState/saveSectionState
 *   is documented as `sectionKey` rather than `sectionTitle` — it can
 *   be either a stable id (like 'raw-request', 'formatted:consent')
 *   or a human-readable title (like 'Overview', 'Script Dependencies').
 *   The store is content-agnostic; it just uses the key as a map key.
 *   New code from feature #113 onward should pass section ids; legacy
 *   call sites keep passing titles. State is in-memory only and resets
 *   on event change (or extension reload), so no on-disk migration is
 *   needed.
 *
 * This lives in its own module (rather than as exports from
 * event-detail.js) so that `ai-summary-section.js` can import the
 * state API without creating a circular dependency — event-detail.js
 * already imports `renderAISummarySection` from ai-summary-section.js.
 */

const currentSectionStates = new Map();
const persistentSectionStates = new Map();
let currentEventId = null;

/**
 * Call at the top of `renderEventDetail()`. If the selected event
 * changed, wipes remembered section states so a new event starts
 * fresh. Returns true when a reset happened (callers can use this to
 * also reset related UI memory, e.g. JSON labels state).
 *
 * @param {string|null} eventId
 * @returns {boolean} true if state was reset
 */
export function resetIfNewEvent(eventId) {
  const newId = eventId || null;
  if (newId !== currentEventId) {
    currentSectionStates.clear();
    currentEventId = newId;
    return true;
  }
  return false;
}

/**
 * Whether a section should render expanded. Returns the user's last
 * toggle choice if they've interacted, otherwise the caller's default.
 *
 * @param {string} sectionKey — stable section id (preferred, e.g.
 *   'raw-request', 'formatted:consent') OR a human-readable title
 *   for legacy callers ('Overview', 'Script Dependencies'). The store
 *   is content-agnostic; whichever string you pass becomes the map key.
 * @param {boolean} defaultExpanded
 * @param {{ persistent?: boolean }} [options] — when `persistent` is true,
 *   the state is read from the cross-event map (survives event changes).
 * @returns {boolean}
 */
export function getSectionExpandedState(sectionKey, defaultExpanded, options) {
  const map = options && options.persistent ? persistentSectionStates : currentSectionStates;
  if (!map.has(sectionKey)) return defaultExpanded;
  // Stored value is `isCollapsed`; expanded = !collapsed.
  return !map.get(sectionKey);
}

/**
 * Persist the user's collapse/expand choice for a section. Call from
 * the section's header click handler (or equivalent).
 *
 * @param {string} sectionKey — see getSectionExpandedState for shape.
 * @param {boolean} isCollapsed
 * @param {{ persistent?: boolean }} [options] — when `persistent` is true,
 *   the state is written to the cross-event map (survives event changes).
 */
export function saveSectionState(sectionKey, isCollapsed, options) {
  const map = options && options.persistent ? persistentSectionStates : currentSectionStates;
  map.set(sectionKey, isCollapsed);
}

// Test-only escape hatch — lets unit tests exercise the reset-on-new-
// event behaviour without running a full renderEventDetail.
export function _resetForTests() {
  currentSectionStates.clear();
  persistentSectionStates.clear();
  currentEventId = null;
}
