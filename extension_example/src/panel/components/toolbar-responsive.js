// Responsive toolbar — progressive collapse with overflow menu.
// Watches the main toolbar's width via ResizeObserver and writes a tier
// (`xl` | `lg` | `md` | `sm` | `xs`) to `toolbar.dataset.toolbarSize`.
// Tier-driven CSS in panel.css does the visual collapsing; this module
// handles the interactive parts: the overflow menu and the search expand/collapse.

// Width thresholds, in px. Values below `sm` fall into `xs`.
export const TOOLBAR_BREAKPOINTS = Object.freeze({
  xl: 820,
  lg: 700,
  md: 580,
  sm: 460,
});

export function resolveTier(width) {
  if (width >= TOOLBAR_BREAKPOINTS.xl) return 'xl';
  if (width >= TOOLBAR_BREAKPOINTS.lg) return 'lg';
  if (width >= TOOLBAR_BREAKPOINTS.md) return 'md';
  if (width >= TOOLBAR_BREAKPOINTS.sm) return 'sm';
  return 'xs';
}

// GTM Hub stays pinned outside the overflow menu whenever it has detected
// containers (`has-gtm`) or active intercept rules (`has-rules`).
export function shouldPinGtm(gtmBtn) {
  if (!gtmBtn || !gtmBtn.classList) return false;
  return gtmBtn.classList.contains('has-gtm') || gtmBtn.classList.contains('has-rules');
}

// Priority-plus overflow: each utility button gets its own width threshold.
// Buttons higher in the list (lower priority) move into the overflow menu first
// as the toolbar shrinks. The width is the toolbar's contentRect width — if the
// toolbar is narrower than `hideBelow`, the button is displaced into the menu.
export const OVERFLOW_PRIORITY = Object.freeze([
  { id: 'report-tool-btn',     hideBelow: 520 },
  { id: 'help-btn',            hideBelow: 480 },
  { id: 'theme-toggle-btn',    hideBelow: 440 },
  { id: 'supported-tools-btn', hideBelow: 400 },
  { id: 'settings-btn',        hideBelow: 360 },
  { id: 'gtm-btn',             hideBelow: 320, pinWhenActive: true },
]);

// Returns the list of button IDs that should be displaced into the overflow menu
// at the given toolbar width. The `gtmActive` flag pins GTM regardless of width.
export function resolveOverflowIds(width, gtmActive) {
  const hidden = [];
  for (const item of OVERFLOW_PRIORITY) {
    if (item.pinWhenActive && gtmActive) continue;
    if (width < item.hideBelow) hidden.push(item.id);
  }
  return hidden;
}

// Filter-bar progressive collapse — each Row-1 control has its own width threshold.
// Controls higher in this list go compact (lose their name label for event-type
// filters, or icon-only for the Show All / Hide All action buttons) first as the
// panel narrows. The three filters compact first so their counts and modes stay
// legible; Show All / Hide All — visually a pair — compact together last.
export const FILTER_BAR_PRIORITY = Object.freeze([
  { id: 'interactions-filter', hideBelow: 700 },
  { id: 'consent-filter',      hideBelow: 640 },
  { id: 'scripts-filter',      hideBelow: 580 },
  { id: 'hide-all-tools-btn',  hideBelow: 520 },
  { id: 'show-all-tools-btn',  hideBelow: 520 },
]);

// Returns the list of control IDs that should be in their compact form at the
// given filter-bar width.
export function resolveFilterBarCompactions(width) {
  const ids = [];
  for (const item of FILTER_BAR_PRIORITY) {
    if (width < item.hideBelow) ids.push(item.id);
  }
  return ids;
}

export function initFilterBarResponsive({ filterBar } = {}) {
  if (!filterBar) return null;

  let rafId = 0;
  let currentIds = [];

  function applyCompactions(width) {
    const newIds = resolveFilterBarCompactions(width);
    const changed =
      newIds.length !== currentIds.length ||
      newIds.some((id, i) => id !== currentIds[i]);
    if (!changed) return;
    currentIds = newIds;
    for (const item of FILTER_BAR_PRIORITY) {
      const el = document.getElementById(item.id);
      if (!el) continue;
      el.classList.toggle('filter-compact', newIds.includes(item.id));
    }
  }

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const width = entry.contentRect.width;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        applyCompactions(width);
      });
    }
  });
  observer.observe(filterBar);
  applyCompactions(filterBar.clientWidth);

  return { applyCompactions };
}

function removeChildren(el) {
  if (!el) return;
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function initToolbarResponsive({
  toolbar,
  overflowBtn,
  overflowMenu,
  overflowGroup,
  searchContainer,
  searchInput,
  searchExpandBtn,
  gtmBtn,
  trackEvent = () => {},
} = {}) {
  if (!toolbar) return null;

  let currentTier = null;
  let rafId = 0;
  let overflowIds = [];

  // --- Overflow menu -------------------------------------------------------

  function populateOverflowMenu() {
    if (!overflowMenu || !overflowGroup) return;
    removeChildren(overflowMenu);
    const children = Array.from(overflowGroup.querySelectorAll(':scope > .btn-icon'));
    for (const src of children) {
      // Skip items currently pinned in the toolbar (e.g. active GTM Hub).
      if (getComputedStyle(src).display !== 'none') continue;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'toolbar-overflow-item';
      item.setAttribute('role', 'menuitem');
      const svg = src.querySelector('svg');
      if (svg) item.appendChild(svg.cloneNode(true));
      const label = document.createElement('span');
      label.textContent = src.dataset.overflowLabel || src.title || src.getAttribute('aria-label') || '';
      item.appendChild(label);
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        closeOverflowMenu();
        // Forward the click to the real button so its existing listeners fire.
        src.click();
      });
      overflowMenu.appendChild(item);
    }
  }

  function isOverflowOpen() {
    return !!overflowBtn && overflowBtn.parentElement.classList.contains('open');
  }

  function openOverflowMenu() {
    if (!overflowBtn || !overflowMenu) return;
    if (isOverflowOpen()) return;
    populateOverflowMenu();
    overflowBtn.parentElement.classList.add('open');
    overflowBtn.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', handleOutsideClick, true);
    document.addEventListener('keydown', handleDocKeydown);
    trackEvent('toolbar_overflow_menu', { action: 'open' });
  }

  function closeOverflowMenu() {
    if (!overflowBtn) return;
    if (!isOverflowOpen()) return;
    overflowBtn.parentElement.classList.remove('open');
    overflowBtn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', handleOutsideClick, true);
    document.removeEventListener('keydown', handleDocKeydown);
    trackEvent('toolbar_overflow_menu', { action: 'close' });
  }

  function handleOutsideClick(e) {
    if (!overflowMenu || !overflowBtn) return;
    if (overflowMenu.contains(e.target)) return;
    if (overflowBtn.contains(e.target)) return;
    closeOverflowMenu();
  }

  function handleDocKeydown(e) {
    if (e.key === 'Escape') closeOverflowMenu();
  }

  // --- Search expand / collapse -------------------------------------------

  function expandSearch() {
    if (!searchContainer || !searchInput) return;
    if (searchContainer.classList.contains('expanded')) return;
    searchContainer.classList.add('expanded');
    if (searchExpandBtn) searchExpandBtn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => searchInput.focus());
    trackEvent('toolbar_search', { action: 'expand' });
  }

  function collapseSearch() {
    if (!searchContainer) return;
    if (!searchContainer.classList.contains('expanded')) return;
    searchContainer.classList.remove('expanded');
    if (searchExpandBtn) searchExpandBtn.setAttribute('aria-expanded', 'false');
  }

  // --- Tier resolution -----------------------------------------------------

  function applyTier(width) {
    const tier = resolveTier(width);
    if (tier === currentTier) return;
    currentTier = tier;
    toolbar.dataset.toolbarSize = tier;
    if (tier !== 'sm' && tier !== 'xs') collapseSearch();
  }

  // Progressive overflow — toggles `.toolbar-in-overflow` on each utility button
  // in priority order based on the current width. One button slides into the
  // overflow menu at a time as the toolbar shrinks.
  function updateOverflowItems(width) {
    const gtmActive = shouldPinGtm(gtmBtn);
    const newIds = resolveOverflowIds(width, gtmActive);
    const changed =
      newIds.length !== overflowIds.length ||
      newIds.some((id, i) => id !== overflowIds[i]);
    if (!changed) return;
    overflowIds = newIds;

    for (const item of OVERFLOW_PRIORITY) {
      const btn = document.getElementById(item.id);
      if (!btn) continue;
      btn.classList.toggle('toolbar-in-overflow', newIds.includes(item.id));
    }

    if (overflowBtn && overflowBtn.parentElement) {
      overflowBtn.parentElement.classList.toggle('has-items', newIds.length > 0);
    }

    if (newIds.length === 0) closeOverflowMenu();
    else if (isOverflowOpen()) populateOverflowMenu();
  }

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const width = entry.contentRect.width;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        applyTier(width);
        updateOverflowItems(width);
      });
    }
  });
  observer.observe(toolbar);
  applyTier(toolbar.clientWidth);
  updateOverflowItems(toolbar.clientWidth);

  // --- Event wiring --------------------------------------------------------

  if (overflowBtn) {
    overflowBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isOverflowOpen()) closeOverflowMenu();
      else openOverflowMenu();
    });
  }

  if (searchExpandBtn) {
    searchExpandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      expandSearch();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('blur', () => {
      if (!searchContainer || !searchContainer.classList.contains('expanded')) return;
      if (searchInput.value === '') collapseSearch();
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && searchContainer && searchContainer.classList.contains('expanded')) {
        collapseSearch();
        searchInput.blur();
      }
    });
  }

  // If GTM pin state changes, re-evaluate progressive overflow so GTM leaves
  // or rejoins the overflow menu without waiting for a resize.
  if (gtmBtn) {
    const pinObserver = new MutationObserver(() => {
      updateOverflowItems(toolbar.clientWidth);
    });
    pinObserver.observe(gtmBtn, { attributes: true, attributeFilter: ['class'] });
  }

  return {
    applyTier,
    openOverflowMenu,
    closeOverflowMenu,
    expandSearch,
    collapseSearch,
    getCurrentTier: () => currentTier,
  };
}
