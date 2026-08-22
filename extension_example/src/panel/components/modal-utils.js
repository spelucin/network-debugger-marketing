/**
 * Modal mutual-exclusion helper.
 *
 * All five top-level modals (Settings, Help, Report, Supported Tools, GTM Hub)
 * should behave like a single-slot surface: opening one closes any other that
 * was already open. Each modal module registers its (panel-id → close-fn)
 * pair once at init, and calls `closeOtherModals(selfId)` at the top of its
 * own open function.
 *
 * Context menus, dropdowns, and toolbar overflow menus are deliberately out
 * of scope — they can coexist with a modal without user confusion.
 */

const closers = new Map();

/**
 * Register a modal's close function. Called once per modal at init.
 * @param {string} panelId - DOM id of the modal's root element
 * @param {Function} closeFn - Function that cleanly closes this modal
 */
export function registerModalCloser(panelId, closeFn) {
  closers.set(panelId, closeFn);
}

/**
 * Close every registered modal that is currently open, except the one whose
 * id matches `exceptPanelId`. Safe to call even when nothing is open.
 * @param {string} exceptPanelId - The modal about to open; skip closing it
 */
export function closeOtherModals(exceptPanelId) {
  for (const [id, closeFn] of closers) {
    if (id === exceptPanelId) continue;
    const panel = document.getElementById(id);
    if (panel && panel.classList.contains('open')) {
      try { closeFn(); } catch (_) { /* non-critical */ }
    }
  }
}
