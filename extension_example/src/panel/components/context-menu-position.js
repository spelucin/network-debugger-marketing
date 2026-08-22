// ============================================================
// Context Menu Positioning — viewport-aware placement
// ============================================================
// Single source of truth for placing any `.context-menu` element so the
// FULL menu stays inside the viewport. Replaces the hardcoded per-menu
// `menuHeight` estimates that were copy-pasted across filter-bar.js and
// context-menus.js — those estimates under-counted tall menus (e.g. the
// "Selected event" menu with the Consent / Compare-formats rows), so the
// bottom items fell below the viewport edge and became unclickable (BUG54).
//
// The fix is to measure the menu's REAL rendered height after it's been
// made visible, then clamp against that instead of a guess.

/**
 * Pure geometry — given a desired anchor point, the menu's measured size,
 * and the viewport, return the clamped {x, y} that keeps the whole menu on
 * screen. Prefers the anchor point (cursor) and only shifts when the menu
 * would overflow an edge; clamps to the top/left edge as a last resort so
 * the menu head is never pushed off-screen (where its first items would be
 * unreachable).
 *
 * Exported separately so it can be unit-tested without a DOM.
 *
 * @param {Object} args
 * @param {number} args.clientX - desired left (viewport coords)
 * @param {number} args.clientY - desired top (viewport coords)
 * @param {number} args.menuWidth - measured menu width
 * @param {number} args.menuHeight - measured menu height
 * @param {number} args.viewportWidth - window.innerWidth
 * @param {number} args.viewportHeight - window.innerHeight
 * @param {number} [args.margin=5] - min gap to keep from each viewport edge
 * @returns {{x: number, y: number}}
 */
export function computeMenuPosition({
  clientX,
  clientY,
  menuWidth,
  menuHeight,
  viewportWidth,
  viewportHeight,
  margin = 5,
}) {
  let x = clientX;
  let y = clientY;

  // Horizontal: clamp to the right edge first, then the left edge.
  if (x + menuWidth > viewportWidth - margin) {
    x = viewportWidth - menuWidth - margin;
  }
  if (x < margin) x = margin;

  // Vertical: clamp to the bottom edge first, then the top edge. The
  // top-edge clamp is what guarantees the menu head (and its first rows)
  // stay reachable even when the menu is taller than the space below the
  // cursor.
  if (y + menuHeight > viewportHeight - margin) {
    y = viewportHeight - menuHeight - margin;
  }
  if (y < margin) y = margin;

  return { x, y };
}

/**
 * Position a `.context-menu` element at (clientX, clientY) and reveal it,
 * guaranteeing the whole menu is visible.
 *
 * The menu is made visible (`.open` -> display:block) BEFORE measuring,
 * because a `display:none` element reports zero size. The intermediate
 * pre-clamp position never paints — `offsetHeight` forces a synchronous
 * layout (not a paint) within the same task, so the user only ever sees
 * the final clamped position.
 *
 * @param {HTMLElement} menu - the `.context-menu` element
 * @param {number} clientX - anchor x (e.g. e.clientX)
 * @param {number} clientY - anchor y (e.g. e.clientY)
 * @param {Object} [opts]
 * @param {number} [opts.margin=5] - min gap to keep from each viewport edge
 */
export function positionContextMenu(menu, clientX, clientY, opts = {}) {
  if (!menu) return;
  const margin = opts.margin ?? 5;

  // Render at the requested point so the menu can be measured.
  menu.style.left = `${clientX}px`;
  menu.style.top = `${clientY}px`;
  menu.classList.add('open');

  const { x, y } = computeMenuPosition({
    clientX,
    clientY,
    menuWidth: menu.offsetWidth,
    menuHeight: menu.offsetHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    margin,
  });

  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
}
