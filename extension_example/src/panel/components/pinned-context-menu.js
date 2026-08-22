/**
 * Pinned-specific context menus — Feature #45 follow-up.
 *
 * Lightweight dynamic menu builder that renders into the canonical
 * `.context-menu` design from UI-GUIDELINES.md §14 — same classes, same
 * styling, same dismiss behaviour as the static menus in `context-menus.js`.
 * The "dynamic" part is just that the items list (the user's groups in
 * particular) is built at show-time; the resulting DOM still uses
 * `.context-menu`, `.context-menu-item`, `.context-menu-separator`, and
 * `.context-menu-scope-header`.
 *
 * Three call sites:
 *   - Right-click an event row in Pinned view → row-scoped actions
 *   - Right-click a group header in Pinned view → group-scoped actions
 *   - Right-click an unpinned event row in Stream view (future)
 *
 * Items can carry a `submenu: [items]` array — submenus render as a second
 * `.context-menu` element positioned beside the parent item. Submenu
 * support is not in the canonical static-HTML menus; the only addition
 * is the `.context-menu-item.has-submenu` modifier and a small arrow.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

let activeMenu = null;
let activeSubmenu = null;

/**
 * Show a context menu at the event coordinates. `items` is an array of:
 *   {
 *     label: string,
 *     icon?: string,         // icon id (see ICON_FACTORIES below) or null
 *     onClick?: fn,
 *     submenu?: items[],
 *     disabled?: bool,
 *     danger?: bool,         // red text on hover (destructive actions)
 *     separator?: bool,
 *     hint?: string,         // muted right-aligned secondary label
 *     scopeHeader?: string,  // shown once at the top — e.g. "Selected pinned event"
 *   }
 */
export function showPinnedContextMenu(e, items) {
  hidePinnedContextMenu();
  e.preventDefault();
  e.stopPropagation();

  const menu = buildMenu(items);
  menu.classList.add('open');
  document.body.appendChild(menu);
  activeMenu = menu;

  positionMenu(menu, e.clientX, e.clientY);

  // Outside-click and Escape dismiss
  setTimeout(() => {
    document.addEventListener('mousedown', onOutsideClick, true);
    document.addEventListener('keydown', onKeydown, true);
  }, 0);
}

export function hidePinnedContextMenu() {
  closeSubmenu();
  if (!activeMenu) return;
  activeMenu.remove();
  activeMenu = null;
  document.removeEventListener('mousedown', onOutsideClick, true);
  document.removeEventListener('keydown', onKeydown, true);
}

function closeSubmenu() {
  if (!activeSubmenu) return;
  activeSubmenu.remove();
  activeSubmenu = null;
}

function onOutsideClick(e) {
  const inMain = activeMenu && activeMenu.contains(e.target);
  const inSub = activeSubmenu && activeSubmenu.contains(e.target);
  if (!inMain && !inSub) hidePinnedContextMenu();
}

function onKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    hidePinnedContextMenu();
  }
}

function buildMenu(items) {
  const menu = document.createElement('div');
  menu.className = 'context-menu';

  // Scope header — emitted once if any item carries a `scopeHeader` value.
  // Mirrors the same pattern as the static platform context menu.
  const scopeText = items.find(it => it && it.scopeHeader)?.scopeHeader;
  if (scopeText) {
    const sh = document.createElement('div');
    sh.className = 'context-menu-scope-header';
    sh.textContent = scopeText;
    menu.appendChild(sh);
  }

  for (const item of items) {
    if (!item) continue;
    if (item.scopeHeader && !item.label) continue; // pseudo-item, already consumed
    if (item.separator) {
      const sep = document.createElement('div');
      sep.className = 'context-menu-separator';
      menu.appendChild(sep);
      continue;
    }
    menu.appendChild(buildItem(item));
  }
  return menu;
}

function buildItem(item) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'context-menu-item';
  if (item.disabled) btn.classList.add('disabled');
  if (item.danger) btn.classList.add('danger');

  // Leading icon (always present so labels align — uses an empty 14×14
  // placeholder when no icon is supplied)
  if (item.icon && ICON_FACTORIES[item.icon]) {
    btn.appendChild(ICON_FACTORIES[item.icon]());
  } else {
    btn.appendChild(makePlaceholderIcon());
  }

  const label = document.createElement('span');
  label.className = 'context-menu-label';
  label.textContent = item.label;
  btn.appendChild(label);

  if (item.hint) {
    const hint = document.createElement('span');
    hint.className = 'context-menu-shortcut';
    hint.textContent = item.hint;
    btn.appendChild(hint);
  }

  if (item.submenu && item.submenu.length > 0) {
    btn.classList.add('has-submenu');
    btn.appendChild(makeSubmenuArrow());
    if (!item.disabled) wireSubmenu(btn, item.submenu);
  } else if (typeof item.onClick === 'function' && !item.disabled) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      try { item.onClick(); } finally { hidePinnedContextMenu(); }
    });
  }

  return btn;
}

function wireSubmenu(parentBtn, items) {
  parentBtn.addEventListener('mouseenter', () => {
    closeSubmenu();
    const sub = buildMenu(items);
    sub.classList.add('open');
    document.body.appendChild(sub);
    activeSubmenu = sub;

    const r = parentBtn.getBoundingClientRect();
    const subWidth = sub.offsetWidth || 220;
    let left = r.right;
    if (left + subWidth > window.innerWidth) left = r.left - subWidth;
    sub.style.left = `${Math.max(4, left)}px`;
    sub.style.top = `${r.top}px`;
  });
  // Submenu stays open while the cursor is over the parent or the
  // submenu itself; closes on leaving both.
  parentBtn.addEventListener('mouseleave', (ev) => {
    if (activeSubmenu && activeSubmenu.contains(ev.relatedTarget)) return;
    closeSubmenu();
  });
}

function positionMenu(menu, x, y) {
  // Render off-screen briefly to measure
  menu.style.left = '-9999px';
  menu.style.top = '0';
  const w = menu.offsetWidth || 220;
  const h = menu.offsetHeight || 200;
  let left = x;
  let top = y;
  if (left + w > window.innerWidth) left = Math.max(4, window.innerWidth - w - 4);
  if (top + h > window.innerHeight) top = Math.max(4, window.innerHeight - h - 4);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

// ----- Icon factories -----
// Built via DOM (createElementNS) so the security hook stays happy and
// every icon matches the canonical 14×14 / stroke-currentColor look used
// by the static menus.

function makeSvg() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  return svg;
}

function appendPath(svg, d) {
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', d);
  svg.appendChild(p);
}

function makePlaceholderIcon() {
  // Empty 14×14 spacer so labels align with icon-bearing items
  const span = document.createElement('span');
  span.style.width = '14px';
  span.style.height = '14px';
  span.style.flexShrink = '0';
  return span;
}

function makeSubmenuArrow() {
  const span = document.createElement('span');
  span.className = 'context-menu-submenu-arrow';
  const svg = makeSvg();
  svg.setAttribute('width', '10');
  svg.setAttribute('height', '10');
  appendPath(svg, 'M9 18l6-6-6-6');
  span.appendChild(svg);
  return span;
}

const ICON_FACTORIES = {
  pencil: () => {
    const svg = makeSvg();
    appendPath(svg, 'M12 20h9');
    appendPath(svg, 'M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z');
    return svg;
  },
  pin: () => {
    // Pushpin (filled-in look isn't used; matches the row affordance icon)
    const svg = makeSvg();
    appendPath(svg, 'M12 17v5');
    appendPath(svg, 'M9 10.76V6a3 3 0 0 1 6 0v4.76a2 2 0 0 0 1.11 1.79l1.78.9A2 2 0 0 1 19 15.24V16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-.76a2 2 0 0 1 1.11-1.79l1.78-.9A2 2 0 0 0 9 10.76z');
    return svg;
  },
  trash: () => {
    const svg = makeSvg();
    appendPath(svg, 'M3 6h18');
    appendPath(svg, 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2');
    return svg;
  },
  folderMove: () => {
    // Folder with a right arrow inside
    const svg = makeSvg();
    appendPath(svg, 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z');
    appendPath(svg, 'M9 14h6');
    appendPath(svg, 'M13 11l3 3-3 3');
    return svg;
  },
  folderPlus: () => {
    const svg = makeSvg();
    appendPath(svg, 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z');
    appendPath(svg, 'M12 11v6');
    appendPath(svg, 'M9 14h6');
    return svg;
  },
  folderMinus: () => {
    const svg = makeSvg();
    appendPath(svg, 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z');
    appendPath(svg, 'M9 14h6');
    return svg;
  },
  // Copy/export icons — kept in sync with the export-button menu in panel.html
  // so the same actions look the same wherever they appear.
  table: () => {
    const svg = makeSvg();
    appendPath(svg, 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z');
    appendPath(svg, 'M14 2v6h6M16 13H8M16 17H8M10 9H8');
    return svg;
  },
  jsonBasic: () => {
    // Person silhouette — "Copy for Human"
    const svg = makeSvg();
    appendPath(svg, 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2');
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', '12');
    c.setAttribute('cy', '7');
    c.setAttribute('r', '4');
    svg.appendChild(c);
    return svg;
  },
  jsonProperties: () => {
    // Robot/bot — "Copy for AI"
    const svg = makeSvg();
    appendPath(svg, 'M12 8V4H8');
    const r = document.createElementNS(SVG_NS, 'rect');
    r.setAttribute('width', '16');
    r.setAttribute('height', '12');
    r.setAttribute('x', '4');
    r.setAttribute('y', '8');
    r.setAttribute('rx', '2');
    svg.appendChild(r);
    appendPath(svg, 'M2 14h2');
    appendPath(svg, 'M20 14h2');
    appendPath(svg, 'M15 13v2');
    appendPath(svg, 'M9 13v2');
    return svg;
  },
  jsonComplete: () => {
    const svg = makeSvg();
    appendPath(svg, 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z');
    appendPath(svg, 'M14 2v6h6');
    appendPath(svg, 'M12 18v-6');
    appendPath(svg, 'M9 15h6');
    return svg;
  },
  shield: () => {
    // Consent shield — matches the icon on stream-view "Copy Consent"
    const svg = makeSvg();
    appendPath(svg, 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z');
    return svg;
  },
};
