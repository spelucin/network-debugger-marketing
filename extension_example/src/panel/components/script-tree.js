// Script Tree rendering extracted from panel.js
// Renders the Script Tree view — hierarchical script dependency visualization.
// Dependencies are injected via initScriptTree().

import { getPlatformIcon } from './platform-icons.js';
import { SCRIPT_INITIATOR_ICONS } from './script-initiator-icons.js';

// Dependencies injected by panel.js via initScriptTree()
let _deps;

/**
 * Initialize script tree module with dependencies from panel.js.
 * Must be called after state is defined but before any render occurs.
 * @param {Object} deps
 * @param {Function} deps.getCollapsedScriptGroups - Returns Set of collapsed group IDs (read/mutate)
 * @param {Map} deps.tealiumTagConfig - Tag UID → vendor info (read-only)
 * @param {Function} deps.updateExpandCollapseButtonState - Sync expand/collapse button state after toggle
 * @param {Function} deps.render - Trigger a full re-render after collapse toggle
 * @param {Function} deps.escapeHtml - HTML-escape a string
 */
export function initScriptTree(deps) {
  _deps = deps;
}

/**
 * Render Script Tree view - shows script dependencies as a hierarchy
 * Scripts are organized by how they were loaded:
 * - Top level: scripts loaded directly by the website (parser)
 * - Nested under Tag Managers: scripts loaded by GTM, Tealium, etc.
 * - Nested under other scripts: scripts loaded by another script
 */
export function renderScriptTreeView(container, events, selectedEventId, onSelect, options = {}) {
  const { highlightedPlatforms = new Set(), onScriptTreeContextMenu } = options;

  // Filter to only script load events
  const scriptEvents = events.filter(e => e.isScriptLoad);

  // Clear existing content (except empty state)
  const emptyState = container.querySelector('.empty-state');
  container.innerHTML = '';
  if (emptyState) container.appendChild(emptyState);

  if (scriptEvents.length === 0) {
    // Show empty state for script tree
    const emptyEl = document.createElement('div');
    emptyEl.className = 'script-tree-empty';
    emptyEl.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="1.5">
        <line x1="6" y1="3" x2="6" y2="15"/>
        <circle cx="18" cy="6" r="3"/>
        <circle cx="18" cy="18" r="3"/>
        <circle cx="6" cy="18" r="3"/>
        <path d="M6 9c6 0 9 0 9 6"/>
      </svg>
      <p>No scripts detected yet</p>
      <p class="hint">Script dependencies will appear as they load</p>
    `;
    container.appendChild(emptyEl);
    return;
  }

  // Build tree structure from initiator relationships
  const treeRoot = buildScriptTree(scriptEvents);

  // Create tree container
  const treeContainer = document.createElement('div');
  treeContainer.className = 'script-tree-container';

  // Render root nodes as collapsible groups
  // Pass tree to context menu so it can be used for copy operations
  renderScriptGroups(treeContainer, treeRoot, selectedEventId, onSelect, highlightedPlatforms, onScriptTreeContextMenu);

  container.appendChild(treeContainer);
}

/**
 * Build tree structure from script events using initiator data
 */
export function buildScriptTree(scriptEvents) {
  // Deduplicate by script URL — a script that loads N times on a page
  // should appear once in the tree (matches Stack view's first-sighting
  // semantics). Events without a resolvable URL fall back to event.id so
  // they aren't dropped, but they also can't act as parents.
  const dedupedByUrl = new Map(); // scriptUrl -> earliest event
  const orphanEvents = []; // events with no scriptUrl
  scriptEvents.forEach(event => {
    const scriptUrl = event.formatted?.scriptUrl || event.raw?.url;
    if (!scriptUrl) {
      orphanEvents.push(event);
      return;
    }
    const existing = dedupedByUrl.get(scriptUrl);
    if (!existing || (event.timestamp || 0) < (existing.timestamp || 0)) {
      dedupedByUrl.set(scriptUrl, event);
    }
  });

  const dedupedEvents = [...dedupedByUrl.values(), ...orphanEvents];

  // Map script URL to event for quick lookup
  const urlToEvent = new Map();
  dedupedEvents.forEach(event => {
    const scriptUrl = event.formatted?.scriptUrl || event.raw?.url;
    if (scriptUrl) {
      urlToEvent.set(scriptUrl, event);
    }
  });

  // Build parent-child relationships
  const children = new Map(); // parentUrl -> [childEvents]
  const hasParent = new Set(); // set of events that have a parent

  dedupedEvents.forEach(event => {
    const initiatorType = event.formatted?.initiatorType || event.raw?.initiatorType;
    const initiatorUrl = event.formatted?.initiatorUrl || event.raw?.initiatorUrl;

    if (initiatorType === 'script' || initiatorType === 'tagmanager') {
      // This script was loaded by another script
      if (initiatorUrl && urlToEvent.has(initiatorUrl)) {
        // Parent exists in our tracked scripts
        const parentChildren = children.get(initiatorUrl) || [];
        parentChildren.push(event);
        children.set(initiatorUrl, parentChildren);
        hasParent.add(event.id);
      }
    }
  });

  // Root nodes are scripts that have no parent in our tracked scripts
  // or were loaded by the parser (website)
  const rootNodes = dedupedEvents.filter(event => !hasParent.has(event.id));

  // Sort root nodes by timestamp
  rootNodes.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  return { rootNodes, children, urlToEvent };
}

/**
 * Render root scripts as collapsible groups
 * Each top-level script becomes a group that can be expanded/collapsed
 */
function renderScriptGroups(container, tree, selectedEventId, onSelect, highlightedPlatforms, onScriptTreeContextMenu) {
  const { rootNodes, children } = tree;
  const collapsedScriptGroups = _deps.getCollapsedScriptGroups();

  rootNodes.forEach(event => {
    const scriptUrl = event.formatted?.scriptUrl || event.raw?.url;
    const childEvents = scriptUrl ? (children.get(scriptUrl) || []) : [];
    const groupId = event.id;
    const isCollapsed = collapsedScriptGroups.has(groupId);

    // Count total descendants (not just immediate children)
    const descendantCount = countDescendants(scriptUrl, children);

    // Create group container
    const group = document.createElement('div');
    group.className = `script-tree-group${isCollapsed ? ' collapsed' : ''}`;
    group.dataset.groupId = groupId;

    // Create group header (the root script itself)
    const header = document.createElement('div');
    header.className = 'script-tree-group-header';

    // Chevron for expand/collapse (only if has children)
    if (childEvents.length > 0) {
      const chevron = document.createElement('span');
      chevron.className = 'script-tree-chevron';
      chevron.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 18l6-6-6-6"/>
      </svg>`;
      chevron.title = isCollapsed ? 'Expand' : 'Collapse';
      chevron.addEventListener('click', (e) => {
        e.stopPropagation();
        const groups = _deps.getCollapsedScriptGroups();
        if (groups.has(groupId)) {
          groups.delete(groupId);
        } else {
          groups.add(groupId);
        }
        _deps.updateExpandCollapseButtonState();
        _deps.render(); // Re-render to update UI
      });
      header.appendChild(chevron);
    } else {
      // Spacer for alignment when no chevron
      const spacer = document.createElement('span');
      spacer.className = 'script-tree-chevron-spacer';
      header.appendChild(spacer);
    }

    // Render the root node content inline in header
    renderTreeNodeContent(header, event, 0, tree, selectedEventId, onSelect, highlightedPlatforms, onScriptTreeContextMenu);
    group.appendChild(header);

    // Create children container
    if (childEvents.length > 0 && !isCollapsed) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'script-tree-group-children';

      // Render children recursively - first child is marked as first sibling
      childEvents.forEach((childEvent, index) => {
        renderTreeNode(childrenContainer, childEvent, 1, tree, selectedEventId, onSelect, highlightedPlatforms, onScriptTreeContextMenu, index === 0);
      });

      group.appendChild(childrenContainer);
    }

    container.appendChild(group);
  });
}

/**
 * Count total descendants of a script (recursive)
 */
function countDescendants(scriptUrl, children) {
  if (!scriptUrl) return 0;
  const directChildren = children.get(scriptUrl) || [];
  let count = directChildren.length;
  directChildren.forEach(child => {
    const childUrl = child.formatted?.scriptUrl || child.raw?.url;
    count += countDescendants(childUrl, children);
  });
  return count;
}

/**
 * Render tree node content into a container (used by both group headers and regular nodes)
 */
function renderTreeNodeContent(container, event, depth, tree, selectedEventId, onSelect, highlightedPlatforms, onScriptTreeContextMenu) {
  const { children } = tree;
  const scriptUrl = event.formatted?.scriptUrl || event.raw?.url;
  const directChildren = scriptUrl ? (children.get(scriptUrl) || []) : [];
  // For root nodes, count total descendants; for nested nodes, count direct children
  const displayCount = depth === 0 ? countDescendants(scriptUrl, children) : directChildren.length;

  // Get initiator type for icon
  const initiatorType = event.formatted?.initiatorType || event.raw?.initiatorType || 'unknown';
  const initiatorIcon = SCRIPT_INITIATOR_ICONS[initiatorType] || SCRIPT_INITIATOR_ICONS.unknown;

  // Build node content
  const icon = getPlatformIcon(event.platform);
  const platformText = event.platformName || event.platform?.toUpperCase() || 'Script';

  // Extract script name from URL
  let scriptName = event.eventName || 'Unknown Script';
  if (scriptUrl) {
    try {
      const url = new URL(scriptUrl);
      scriptName = url.pathname.split('/').pop() || url.hostname;
    } catch (e) {}
  }

  const escapeHtml = _deps.escapeHtml;

  // Create content wrapper
  const content = document.createElement('div');
  content.className = 'script-tree-node-content';
  if (event.id === selectedEventId) content.classList.add('selected');
  if (highlightedPlatforms.has(event.platform)) content.classList.add('highlighted');
  content.dataset.eventId = event.id;

  // Resolve Tealium vendor hint for vendor tag scripts
  let vendorHintHtml = '';
  if (event.platform === 'tealium' && event.formatted?.tealiumTagUid) {
    const vendorInfo = _deps.tealiumTagConfig.get(event.formatted.tealiumTagUid);
    if (vendorInfo?.vendorCompact) {
      vendorHintHtml = `<span class="event-name-hint" title="TID ${vendorInfo.tid} — ${escapeHtml(vendorInfo.vendorCompact)} (${vendorInfo.confidence})">${escapeHtml(vendorInfo.vendorCompact)}</span>`;
    }
  }

  content.innerHTML = `
    <span class="event-platform ${event.platform}" data-platform="${event.platform}">${icon}<span class="platform-text">${escapeHtml(platformText)}</span></span>
    <span class="script-tree-name">${escapeHtml(scriptName)}</span>${vendorHintHtml}
    <span class="event-script-badge" title="${getInitiatorTitle(initiatorType)}">${initiatorIcon}</span>
    ${displayCount > 0 ? `<span class="script-tree-child-count">${displayCount}</span>` : ''}
  `;

  // Click handler
  content.addEventListener('click', () => onSelect(event.id));

  // Context menu - pass event and tree for copy operations
  if (onScriptTreeContextMenu) {
    content.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      onScriptTreeContextMenu(e, event, tree);
    });
  }

  container.appendChild(content);
}

/**
 * Render a single tree node and its children (for nested levels)
 * @param {boolean} isFirstSibling - Whether this is the first sibling at this level (no top margin needed)
 */
function renderTreeNode(container, event, depth, tree, selectedEventId, onSelect, highlightedPlatforms, onScriptTreeContextMenu, isFirstSibling = true) {
  const { children } = tree;
  const scriptUrl = event.formatted?.scriptUrl || event.raw?.url;
  const childEvents = scriptUrl ? (children.get(scriptUrl) || []) : [];
  const hasChildren = childEvents.length > 0;

  // Create node element
  const node = document.createElement('div');
  node.className = 'script-tree-node';
  if (hasChildren) node.classList.add('has-children');
  if (!isFirstSibling) node.classList.add('sibling'); // Add spacing before non-first siblings
  node.style.paddingLeft = `${depth * 20}px`;

  // Add branch line indicator
  if (depth > 0) {
    const branchLine = document.createElement('span');
    branchLine.className = 'tree-branch-line';
    node.appendChild(branchLine);
  }

  // Render node content
  renderTreeNodeContent(node, event, depth, tree, selectedEventId, onSelect, highlightedPlatforms, onScriptTreeContextMenu);

  container.appendChild(node);

  // Render children recursively - first child is marked as first sibling
  childEvents.forEach((childEvent, index) => {
    renderTreeNode(container, childEvent, depth + 1, tree, selectedEventId, onSelect, highlightedPlatforms, onScriptTreeContextMenu, index === 0);
  });
}

/**
 * Get tooltip text for initiator type
 */
function getInitiatorTitle(initiatorType) {
  const titles = {
    website: 'Loaded directly from HTML (parser)',
    tagmanager: 'Loaded by Tag Manager',
    script: 'Loaded by another script',
    unknown: 'Script load event'
  };
  return titles[initiatorType] || 'Script load event';
}
