/**
 * Context Menus Module
 *
 * Extracted from panel.js (Phase 6) — handles show/hide/action for five context menus:
 * Page, Script Tree, Tool View, Domain, and Interaction.
 *
 * Dependencies are injected via initContextMenus() to avoid circular imports.
 *
 * @param {Function} deps.getState - Returns the panel state object
 * @param {Object} deps.elements - DOM element references
 * @param {Function} deps.trackEvent - Analytics tracking
 * @param {Function} deps.getCategoryForPlatform - Category lookup for a platform
 * @param {Function} deps.hidePlatformContextMenu - Hide the filter bar's platform context menu
 * @param {Function} deps.showOnlyPlatform - Show only one platform (from filter-bar)
 * @param {Function} deps.hideToolFromContextMenu - Hide a tool via context menu (from filter-bar)
 * @param {Function} deps.toggleHighlightPlatform - Toggle platform highlight (from filter-bar)
 * @param {Function} deps.clearAllHighlights - Clear all highlights (from filter-bar)
 * @param {Function} deps.showOnlyCategory - Show only one category (from filter-bar)
 * @param {Function} deps.toggleHighlightCategory - Toggle category highlight (from filter-bar)
 * @param {Function} deps.copyPageEventsAsTable - Copy page events as table
 * @param {Function} deps.copyPageEventsAsJSON - Copy page events as JSON
 * @param {Function} deps.copyPageEventsWithProperties - Copy page events as JSON with parser-normalized properties
 * @param {Function} deps.copyPageFullExport - Copy page full export (raw + consent timeline)
 * @param {Function} deps.copyDataLayerAsJSON - Copy dataLayer as JSON
 * @param {Function} deps.copySelectedBranch - Copy selected branch as JSON
 * @param {Function} deps.copyEventsAsTable - Copy events (by id list) as table
 * @param {Function} deps.copyEventsAsJSON - Copy events (by id list) as JSON
 * @param {Function} deps.copyEventsAsProperties - Copy events (by id list) as JSON with properties
 * @param {Function} deps.copyEventsAsFullExport - Copy events (by id list) as full export
 * @param {Function} deps.hideInteractions - Hide interactions (set filter, update UI, save, render)
 * @param {Function} deps.copyAllEventsAsTable - Copy all stream events as table
 * @param {Function} deps.copyAllEventsAsJSON - Copy all stream events as JSON
 * @param {Function} deps.copyAllEventsWithProperties - Copy all stream events as the v4 AI export (sparse objects, _consent_default dedup, structured truncation, fold ≥3)
 * @param {Function} deps.copyAllScriptTreeAsJSON - Copy full script tree as JSON (from export menu)
 * @param {Function} deps.copyAllFullExport - Copy all stream events full export (raw + consent timeline)
 * @param {Function} deps.copyAllDataLayerAsJSON - Copy all dataLayer events as JSON (full / validation)
 * @param {Function} deps.copyDataLayerPushesAsJSON - Copy actual dataLayer pushes as JSON (lite)
 * @param {Function} [deps.openAiModal] - Open the AI modal on a specific tab (used by the page/export menu "Start AI Chat" entries)
 */

import { positionContextMenu } from './context-menu-position.js';

let _deps;

// ----------------------------------------
// Scope-header helper — populates the small uppercase metadata line at
// the top of any canonical .context-menu so the user sees what the
// menu's actions apply to. Selects the `[data-role="scope-header"]`
// child element placed in the menu's HTML (panel.html).
// Empty `text` hides the header.
// ----------------------------------------
function setScopeHeader(menuEl, text) {
  if (!menuEl) return;
  const header = menuEl.querySelector('[data-role="scope-header"]');
  if (!header) return;
  if (text) {
    header.textContent = text;
    header.classList.remove('hidden');
  } else {
    header.classList.add('hidden');
  }
}

// Friendly label for a Grouped-view pivot id, used by the group context
// menu's scope header. Mirrors the display labels in components/groupings.js
// so the right-click metadata reads the same as the chip-row labels.
const GROUPING_LABELS = {
  tool: 'Tool',
  page: 'Page',
  event_name: 'Event Name',
  consent_category: 'Consent Category',
  datalayer: 'DataLayer',
  endpoint_host: 'Endpoint',
  cookie_activity: 'Cookie',
  identity: 'Identity',
};

// ========================================
// Module-level state
// ========================================

// Page context menu
let contextMenuPageId = null;

// Script tree context menu
let contextMenuScriptEventId = null;
let contextMenuScriptTree = null;
let contextMenuScriptPlatform = null;

// Group context menu — covers Tool category / Tool platform / Page-pivot domain /
// Event Name / Consent Category. Holds the active group's payload between show
// and click (the listener in initContextMenus dispatches via dataset.action).
let groupContextMenuGroupingId = null;
let groupContextMenuDisplayName = null;
let groupContextMenuEventIds = null;

// ========================================
// Init
// ========================================

export function initContextMenus(deps) {
  _deps = deps;

  // Set up context menu item click listeners
  const { elements } = _deps;

  if (elements.pageContextMenu) {
    elements.pageContextMenu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        handlePageContextMenuAction(item.dataset.action);
      });
    });
  }

  if (elements.scriptTreeContextMenu) {
    elements.scriptTreeContextMenu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        handleScriptTreeContextMenuAction(item.dataset.action);
      });
    });
  }

  if (elements.groupContextMenu) {
    elements.groupContextMenu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        handleGroupContextMenuAction(item.dataset.action);
      });
    });
  }

  if (elements.interactionContextMenu) {
    elements.interactionContextMenu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        handleInteractionContextMenuAction(item.dataset.action);
      });
    });
  }

  if (elements.exportContextMenu) {
    elements.exportContextMenu.querySelectorAll('.context-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        // Inline ℹ️ icons (e.g. About MartechStack Builder) carry their own
        // data-action and shouldn't trigger the parent row's save action.
        const inline = e.target.closest('.context-menu-item-inline-info');
        if (inline && item.contains(inline)) {
          handleExportContextMenuAction(inline.dataset.action);
          return;
        }
        handleExportContextMenuAction(item.dataset.action);
      });
    });
    // Keyboard activation for the inline ℹ️ icons — they're <span role="button">
    // (a real <button> can't nest inside the menu-item button), so Enter/Space
    // don't fire a click for free.
    elements.exportContextMenu.querySelectorAll('.context-menu-item-inline-info').forEach(icon => {
      icon.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          handleExportContextMenuAction(icon.dataset.action);
        }
      });
    });
  }

  // Export button click handler — show menu anchored to button
  if (elements.exportBtn) {
    elements.exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showExportContextMenu(e);
    });
  }
}

// ========================================
// Getters for copy-export dependency injection
// ========================================

export function getContextMenuScriptTree() {
  return contextMenuScriptTree;
}

export function getContextMenuScriptEventId() {
  return contextMenuScriptEventId;
}

// ========================================
// Page Context Menu (Copy Page Events)
// ========================================

export function showPageContextMenu(e, pageEventId) {
  e.preventDefault();
  e.stopPropagation();

  // Hide other context menus
  _deps.hidePlatformContextMenu();
  hideScriptTreeContextMenu();
  hideGroupContextMenu();
  hideInteractionContextMenu();
  hideExportContextMenu();

  contextMenuPageId = pageEventId;
  const menu = _deps.elements.pageContextMenu;

  setScopeHeader(menu, 'Selected page');

  // Position the menu using its real rendered height (BUG54).
  positionContextMenu(menu, e.clientX, e.clientY);
}

export function hidePageContextMenu() {
  _deps.elements.pageContextMenu.classList.remove('open');
  contextMenuPageId = null;
}

export function handlePageContextMenuAction(action) {
  // No generic wrapper event here — each branch below fires its own
  // scope-specific event (`copy_output`, or `ai_modal` open via the
  // chat-page case below).

  const copyActionProps = {
    'copy-page-table': { scope: 'page_events', format: 'table' },
    'copy-page-json': { scope: 'page_events', format: 'basic' },
    'copy-page-properties': { scope: 'page_events', format: 'ai_ready' },
    'copy-datalayer-json': { scope: 'datalayer', format: 'full_datalayer' },
    'copy-page-full': { scope: 'page_events', format: 'complete' },
  };

  switch (action) {
    case 'copy-page-table':
      if (contextMenuPageId) _deps.copyPageEventsAsTable(contextMenuPageId);
      break;
    case 'copy-page-json':
      if (contextMenuPageId) _deps.copyPageEventsAsJSON(contextMenuPageId);
      break;
    case 'copy-page-properties':
      if (contextMenuPageId) _deps.copyPageEventsWithProperties(contextMenuPageId);
      break;
    case 'copy-datalayer-json':
      if (contextMenuPageId) _deps.copyDataLayerAsJSON(contextMenuPageId);
      break;
    case 'copy-page-full':
      if (contextMenuPageId) _deps.copyPageFullExport(contextMenuPageId);
      break;
    case 'export-formats-help':
      if (typeof _deps.showExportFormatsHelp === 'function') _deps.showExportFormatsHelp();
      break;
    case 'ai-chat-page': {
      // Open the AI modal on the Chat tab, pre-seeded with a page-
      // scoped snapshot. The `openAiModal` dep is injected from panel.js
      // so this module stays free of direct ai-modal imports. The
      // entry-source tag rides on the `ai_modal { action: "open" }` event.
      const pageEventId = contextMenuPageId;
      if (typeof _deps.openAiModal === 'function') {
        _deps.openAiModal('chat', {
          scope: { kind: 'page', pageEventId },
          source: 'page_context',
        });
      }
      break;
    }
  }

  if (copyActionProps[action]) {
    _deps.trackEvent('copy_output', copyActionProps[action]);
  }

  hidePageContextMenu();
}

// ========================================
// Script Tree Context Menu
// ========================================

export function showScriptTreeContextMenu(e, event, tree) {
  e.preventDefault();
  e.stopPropagation();

  // Hide other context menus
  _deps.hidePlatformContextMenu();
  hidePageContextMenu();
  hideGroupContextMenu();
  hideInteractionContextMenu();
  hideExportContextMenu();

  contextMenuScriptEventId = event.id;
  contextMenuScriptTree = tree;
  contextMenuScriptPlatform = event.platform;

  const state = _deps.getState();
  const menu = _deps.elements.scriptTreeContextMenu;

  setScopeHeader(menu, 'Selected script');

  // Show/hide "Hide tool" based on whether tool is already hidden
  const hideToolBtn = menu.querySelector('[data-action="hide-tool"]');
  if (hideToolBtn && contextMenuScriptPlatform) {
    const isHidden = state.activePresetVisibleTools
      ? !state.activePresetVisibleTools.includes(contextMenuScriptPlatform)
      : state.hiddenTools.includes(contextMenuScriptPlatform);
    hideToolBtn.classList.toggle('hidden', isHidden);
  }

  // Show/hide "Clear all highlights" based on whether any highlights exist
  const clearHighlightsBtn = menu.querySelector('[data-action="clear-highlights"]');
  if (clearHighlightsBtn) {
    clearHighlightsBtn.classList.toggle('hidden', state.highlightedPlatforms.size === 0);
  }

  // Position the menu using its real rendered height (BUG54).
  positionContextMenu(menu, e.clientX, e.clientY);
}

export function hideScriptTreeContextMenu() {
  if (_deps.elements.scriptTreeContextMenu) {
    _deps.elements.scriptTreeContextMenu.classList.remove('open');
  }
  contextMenuScriptEventId = null;
  contextMenuScriptTree = null;
  contextMenuScriptPlatform = null;
}

export function handleScriptTreeContextMenuAction(action) {
  // Track analytics for platform-level actions
  if (contextMenuScriptPlatform && ['show-only', 'hide-tool', 'highlight'].includes(action)) {
    _deps.trackEvent('script_tree_context', {
      action: action.replace(/-/g, '_'),
      tool: contextMenuScriptPlatform,
      category: _deps.getCategoryForPlatform(contextMenuScriptPlatform)
    });
  }

  switch (action) {
    case 'show-only':
      if (contextMenuScriptPlatform) {
        _deps.showOnlyPlatform(contextMenuScriptPlatform);
      }
      break;
    case 'hide-tool':
      if (contextMenuScriptPlatform) {
        _deps.hideToolFromContextMenu(contextMenuScriptPlatform);
      }
      break;
    case 'highlight':
      if (contextMenuScriptPlatform) {
        _deps.toggleHighlightPlatform(contextMenuScriptPlatform);
      }
      break;
    case 'clear-highlights':
      _deps.clearAllHighlights();
      break;
    case 'copy-selected-branch':
      _deps.copySelectedBranch();
      _deps.trackEvent('copy_output', { scope: 'selected_branch', format: 'branch' });
      break;
  }

  hideScriptTreeContextMenu();
}

// ========================================
// Group Context Menu (Feature #61)
// ========================================
// One shared menu used by every Grouped-view group surface that isn't
// a Page-pivot page (those keep #page-context-menu for their dataLayer /
// per-page Full Export extras). Carries an event-id list so copy fns and
// AI chat scope are both parametric — the menu doesn't need to know the
// pivot's filter dimension, only which events sit in the clicked group.

// Map a grouping id to the ai_modal { source } enum value. Mirrors the
// `<kind>_context` naming used by the existing `page_context` source.
const GROUPING_TO_SOURCE = {
  tool: 'tool_context',
  page: 'domain_context',
  event_name: 'event_name_context',
  consent_category: 'consent_category_context',
};

// Map a grouping id to the AI chat scope kind. The snapshot-bar labels in
// ai-chat-tab.js read this kind to render "Tool: Advertising" etc.
const GROUPING_TO_SCOPE_KIND = {
  tool: 'tool',
  page: 'domain',
  event_name: 'event_name',
  consent_category: 'consent_category',
};

export function showGroupContextMenu(e, { groupingId, displayName, eventIds }) {
  e.preventDefault();
  e.stopPropagation();

  // Hide other context menus
  _deps.hidePlatformContextMenu();
  hidePageContextMenu();
  hideScriptTreeContextMenu();
  hideInteractionContextMenu();
  hideExportContextMenu();

  groupContextMenuGroupingId = groupingId;
  groupContextMenuDisplayName = displayName;
  groupContextMenuEventIds = Array.isArray(eventIds) ? eventIds.slice() : [];

  const menu = _deps.elements.groupContextMenu;
  if (!menu) return;

  // Scope header — "Tool: GA4" / "Domain: example.com" / "Event Name: page_view" etc.
  // Falls back to the displayName alone if the groupingId isn't in the
  // friendly-label map (defensive — the registry in groupings.js is the
  // source of truth and may add new pivots before this map catches up).
  const scopeLabel = GROUPING_LABELS[groupingId] || 'Group';
  setScopeHeader(menu, displayName ? `${scopeLabel}: ${displayName}` : scopeLabel);

  // Substitute the group's name into the AI chat row label.
  const aiLabel = menu.querySelector('.group-ai-chat-label');
  if (aiLabel) {
    aiLabel.textContent = displayName
      ? `Start AI Chat for ${displayName}`
      : 'Start AI Chat';
  }

  // Position the menu using its real rendered height (BUG54).
  positionContextMenu(menu, e.clientX, e.clientY);
}

export function hideGroupContextMenu() {
  if (_deps && _deps.elements.groupContextMenu) {
    _deps.elements.groupContextMenu.classList.remove('open');
  }
  groupContextMenuGroupingId = null;
  groupContextMenuDisplayName = null;
  groupContextMenuEventIds = null;
}

export function handleGroupContextMenuAction(action) {
  const eventIds = groupContextMenuEventIds || [];
  const groupingId = groupContextMenuGroupingId;
  const displayName = groupContextMenuDisplayName;

  const copyActionProps = {
    'copy-group-table': { scope: 'group_events', format: 'table' },
    'copy-group-json': { scope: 'group_events', format: 'basic' },
    'copy-group-properties': { scope: 'group_events', format: 'ai_ready' },
    'copy-group-full': { scope: 'group_events', format: 'complete' },
  };

  switch (action) {
    case 'copy-group-table':
      _deps.copyEventsAsTable(eventIds);
      break;
    case 'copy-group-json':
      _deps.copyEventsAsJSON(eventIds);
      break;
    case 'copy-group-properties':
      _deps.copyEventsAsProperties(eventIds);
      break;
    case 'copy-group-full':
      _deps.copyEventsAsFullExport(eventIds);
      break;
    case 'export-formats-help':
      if (typeof _deps.showExportFormatsHelp === 'function') _deps.showExportFormatsHelp();
      break;
    case 'ai-chat-group': {
      // Open the AI modal on the Chat tab, scoped to the group's events.
      // `kind` differentiates the snapshot-bar label; `eventIds` is what
      // `getScopedEvents` actually filters against.
      const kind = GROUPING_TO_SCOPE_KIND[groupingId] || 'group';
      const source = GROUPING_TO_SOURCE[groupingId] || 'group_context';
      if (typeof _deps.openAiModal === 'function') {
        _deps.openAiModal('chat', {
          scope: { kind, displayName, eventIds: eventIds.slice() },
          source,
        });
      }
      break;
    }
  }

  if (copyActionProps[action]) {
    _deps.trackEvent('copy_output', copyActionProps[action]);
  }

  hideGroupContextMenu();
}

// ========================================
// Interaction Context Menu (Hide Interactions)
// ========================================

export function showInteractionContextMenu(e) {
  e.preventDefault();
  e.stopPropagation();

  // Hide other context menus
  _deps.hidePlatformContextMenu();
  hidePageContextMenu();
  hideScriptTreeContextMenu();
  hideGroupContextMenu();
  hideExportContextMenu();

  const menu = _deps.elements.interactionContextMenu;

  setScopeHeader(menu, 'Interaction marker');

  // Position the menu using its real rendered height (BUG54).
  positionContextMenu(menu, e.clientX, e.clientY);
}

export function hideInteractionContextMenu() {
  if (_deps && _deps.elements.interactionContextMenu) {
    _deps.elements.interactionContextMenu.classList.remove('open');
  }
}

export function handleInteractionContextMenuAction(action) {
  switch (action) {
    case 'hide-interactions':
      _deps.hideInteractions();
      _deps.trackEvent('filter_interaction', { action: 'context_menu_hide' });
      break;
  }
  hideInteractionContextMenu();
}

// ========================================
// Export Context Menu (All Events)
// ========================================

export function showExportContextMenu(e) {
  e.preventDefault();
  e.stopPropagation();

  const menu = _deps.elements.exportContextMenu;

  // Toggle — if already open, just close it
  if (menu.classList.contains('open')) {
    hideExportContextMenu();
    return;
  }

  // View-mode-aware menu shape:
  //  - Tree mode: standard event exports + Copy Script Tree at the bottom.
  //  - Stack mode: hide the event-export items (they're not what you want
  //    when staring at the martech-stack tree) and show three Stack-only
  //    download items in their place. AI Session Chat stays available so
  //    the user can ask questions about the captured session regardless
  //    of view.
  //  - Everything else: standard event exports, no Stack/Tree items.
  const state = _deps.getState();
  const viewMode = state.viewMode;
  const isStack = viewMode === 'stack';
  const isTree = viewMode === 'tree';
  const isGrouped = viewMode === 'grouped';
  const isPinned = viewMode === 'pinned';

  const scriptTreeItem = menu.querySelector('.script-tree-export-item');
  if (scriptTreeItem) scriptTreeItem.style.display = isTree ? '' : 'none';

  const stackItems = menu.querySelectorAll('.stack-export-item');
  stackItems.forEach((el) => { el.style.display = isStack ? '' : 'none'; });

  // Items that operate on the captured event stream — hidden in Stack OR Tree
  // mode so the menu only shows view-specific exports for those modes.
  const hideStreamExports = isStack || isTree;
  const eventExportSelectors = [
    '[data-action="copy-all-table"]',
    '[data-action="copy-all-json"]',
    '[data-action="copy-all-properties"]',
    '[data-action="copy-datalayer-pushes"]',
    '[data-action="copy-all-datalayer"]',
    '[data-action="copy-all-full"]',
  ];
  for (const sel of eventExportSelectors) {
    const el = menu.querySelector(sel);
    if (el) el.style.display = hideStreamExports ? 'none' : '';
  }
  // Dividers around the now-hidden standard exports — orphan in Stack/Tree.
  // - view-specific-divider: separates view-specific items from standard items;
  //   no standard items show in Stack/Tree, and Tree's separation to Compare
  //   formats is handled by the compareFormatsDivider below.
  // - datalayer-divider: between Copy Complete and Copy Full dataLayer.
  const viewSpecificDivider = menu.querySelector('.view-specific-divider');
  if (viewSpecificDivider) viewSpecificDivider.style.display = hideStreamExports ? 'none' : '';
  const datalayerDivider = menu.querySelector('.datalayer-divider');
  if (datalayerDivider) datalayerDivider.style.display = hideStreamExports ? 'none' : '';

  // AI Session Chat operates on captured event stream — same hide-rule.
  const aiChat = menu.querySelector('[data-action="ai-chat-session"]');
  if (aiChat) aiChat.style.display = hideStreamExports ? 'none' : '';
  const aiChatDivider = aiChat?.previousElementSibling?.classList?.contains('ai-menu-item')
    ? aiChat.previousElementSibling : null;
  if (aiChatDivider) aiChatDivider.style.display = hideStreamExports ? 'none' : '';

  // Compare formats — stream-format-specific. Hide in Stack mode (Stack has its
  // own self-explanatory format names). Show in Tree mode (the modal still
  // describes JSON Full Tree / Markdown contextually-ish; we keep one place
  // that explains formats consistently).
  const compareFormats = menu.querySelector('[data-action="export-formats-help"]');
  if (compareFormats) compareFormats.style.display = isStack ? 'none' : '';
  // The separator just before Compare formats (if present) — hide alongside.
  const compareFormatsDivider = compareFormats?.previousElementSibling;
  if (compareFormatsDivider && compareFormatsDivider.classList?.contains('context-menu-separator')) {
    compareFormatsDivider.style.display = isStack ? 'none' : '';
  }

  // Scope header — names the active view so the user knows what "Copy all"
  // applies to. Format: "Export <View>" (no dash / em-dash).
  let viewName = 'Stream';
  if (isStack) viewName = 'Stack';
  else if (isTree) viewName = 'Script Tree';
  else if (isPinned) viewName = 'Pinned';
  else if (isGrouped) viewName = GROUPING_LABELS[state.activeGrouping] || 'Grouped';
  setScopeHeader(menu, `Export ${viewName}`);

  // Hide other context menus
  _deps.hidePlatformContextMenu();
  hidePageContextMenu();
  hideScriptTreeContextMenu();
  hideGroupContextMenu();
  hideInteractionContextMenu();
  const btn = _deps.elements.exportBtn;

  // Reveal first so the menu can be measured — its real height drives the
  // flip decision below (replaces the old hardcoded 180px estimate, BUG54).
  menu.classList.add('open');
  const rect = btn.getBoundingClientRect();
  const menuWidth = menu.offsetWidth || 200;
  const menuHeight = menu.offsetHeight;
  const margin = 5;

  // Right-align the menu to the button, clamped within the viewport.
  let x = rect.right - menuWidth;
  if (x < margin) x = rect.left;
  if (x + menuWidth > window.innerWidth - margin) x = window.innerWidth - menuWidth - margin;

  // Open below the button; flip above if the menu would overflow the bottom.
  let y = rect.bottom + 4;
  if (y + menuHeight > window.innerHeight - margin) {
    const above = rect.top - menuHeight - 4;
    y = above >= margin ? above : window.innerHeight - menuHeight - margin;
  }

  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
}

export function hideExportContextMenu() {
  if (_deps && _deps.elements.exportContextMenu) {
    _deps.elements.exportContextMenu.classList.remove('open');
  }
}

function handleExportContextMenuAction(action) {
  // No generic wrapper event — each branch fires its own
  // action-specific event (`copy_output` for copy/export, `ai_modal`
  // open for the chat entry). The previous `export_event` ping was a
  // duplicate of `copy_output` (same scope/format payload) and was
  // removed in v1.2.0.
  const copyActionProps = {
    'copy-all-table': { scope: 'all_events', format: 'table' },
    'copy-all-json': { scope: 'all_events', format: 'basic' },
    'copy-all-properties': { scope: 'all_events', format: 'ai_ready' },
    'copy-datalayer-pushes': { scope: 'all_datalayer', format: 'pushes_datalayer' },
    'copy-all-datalayer': { scope: 'all_datalayer', format: 'full_datalayer' },
    'copy-all-script-tree': { scope: 'script_tree', format: 'full_tree' },
    'copy-all-script-tree-md': { scope: 'script_tree', format: 'markdown' },
    'copy-all-full': { scope: 'all_events', format: 'complete' },
  };

  switch (action) {
    case 'copy-all-table':
      _deps.copyAllEventsAsTable();
      break;
    case 'copy-all-json':
      _deps.copyAllEventsAsJSON();
      break;
    case 'copy-all-properties':
      _deps.copyAllEventsWithProperties();
      break;
    case 'copy-datalayer-pushes':
      _deps.copyDataLayerPushesAsJSON();
      break;
    case 'copy-all-datalayer':
      _deps.copyAllDataLayerAsJSON();
      break;
    case 'copy-all-script-tree':
      _deps.copyAllScriptTreeAsJSON();
      break;
    case 'copy-all-script-tree-md':
      _deps.copyAllScriptTreeAsMarkdown();
      break;
    case 'copy-all-full':
      _deps.copyAllFullExport();
      break;
    case 'export-formats-help':
      if (typeof _deps.showExportFormatsHelp === 'function') _deps.showExportFormatsHelp();
      break;
    case 'ai-chat-session':
      // Session scope is the Chat tab's default — no scope override
      // needed. The entry source rides on the `ai_modal { action:
      // "open" }` event so we can compare discovery rates across
      // toolbar / page menu / export menu without a separate event.
      if (typeof _deps.openAiModal === 'function') {
        _deps.openAiModal('chat', { source: 'export_dropdown' });
      }
      break;
    case 'stack-export-markdown':
      if (typeof _deps.exportStack === 'function') _deps.exportStack('markdown');
      break;
    case 'stack-export-mermaid':
      if (typeof _deps.exportStack === 'function') _deps.exportStack('mermaid');
      break;
    case 'stack-export-svg':
      if (typeof _deps.exportStack === 'function') _deps.exportStack('svg');
      break;
    case 'stack-export-json':
      if (typeof _deps.exportStack === 'function') _deps.exportStack('json');
      break;
    case 'stack-export-reactflow':
      if (typeof _deps.exportStack === 'function') _deps.exportStack('reactflow');
      break;
    case 'show-martechstack-builder-info':
      if (typeof _deps.showMartechStackBuilderInfo === 'function') {
        _deps.showMartechStackBuilderInfo();
      }
      break;
  }

  if (copyActionProps[action]) {
    _deps.trackEvent('copy_output', copyActionProps[action]);
  }

  hideExportContextMenu();
}
