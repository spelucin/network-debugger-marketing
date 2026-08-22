// Stack View - tool-level martech stack visualisation.
// Sibling of script-tree.js: same DOM/CSS shape, but each node is a platform
// card (icon + name + category + count) representing a tool in the site's stack.
// The tree collapses many-scripts-to-one-platform: if GTM loads gtag.js, gtm.js,
// and a vendor script all belonging to GA4, GA4 is one node under GTM.
//
// The graph derivation lives in `stack-attribution.js` (Strategies A/A2/B/C/E
// + cycle break). This file owns the renderer and routes init deps through to
// the attribution module.

import { getPlatformIcon } from './platform-icons.js';
import { initStackAttribution, buildStackGraph as buildStackGraphImpl } from './stack-attribution.js';

// Re-export for backwards compatibility. Tests and panel.js import
// `buildStackGraph` from this module.
export const buildStackGraph = buildStackGraphImpl;

let _deps;

/**
 * Initialise stack-view module. Forwards the same deps to the attribution
 * module so derivation and rendering share one configured surface.
 */
export function initStackView(deps) {
  _deps = deps;
  initStackAttribution(deps);
}

/**
 * Render the multi-domain Stack view into `container`.
 *
 * Render contract:
 *  - One graph per top-level domain (eTLD+1) so a SPA navigation between
 *    domains doesn't lose work — previous domains stay rendered (collapsed)
 *    and the current domain shows a "Generate stack for [domain]" entry
 *    point until the user opts in to building it.
 *  - A graph is null until the user clicks Generate for that domain. In
 *    that state we show a per-domain placeholder — never a partial graph
 *    derived mid-page-load.
 *  - Once a graph is supplied, the tree shape mirrors Script Tree:
 *    top-level platforms with children become `.script-tree-group`s
 *    (chevron-headered card), leaves become `.script-tree-node`s.
 *  - Each platform card uses `.event-platform`, the same brand-coloured
 *    pill the event list / tool view / script tree use.
 *
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {Map<string, Object>} options.stackGraphs   eTLD+1 → graph (cached)
 * @param {string} options.currentDomain              eTLD+1 of the page in focus, may be ''
 * @param {Set<string>} options.collapsedDomains      which domain sections are collapsed
 * @param {{domain: string, platformId: string, source: string|null}|null} options.selectedTool
 * @param {(domain: string, platformId: string, source: string|null) => void} options.onSelectTool
 * @param {(domain: string) => void} options.onGenerate
 * @param {(domain: string) => void} options.onToggleDomain
 * @param {Set<string>} [options.collapsedGroups]   keys of "<domain>|<platformId>" for collapsed group nodes
 * @param {(domain: string, platformId: string) => void} [options.onToggleGroup]
 */
export function renderStackView(container, options) {
  container.innerHTML = '';

  const {
    stackGraphs,
    currentDomain,
    collapsedDomains,
    selectedTool,
    onSelectTool,
    onGenerate,
    onToggleDomain,
    collapsedGroups,
    onToggleGroup,
  } = options;

  // Build the ordered list of domain sections: current page domain first
  // (so the user always sees today's work at the top), then any other
  // domains for which a graph has been generated. The current domain is
  // always present even when no graph exists yet so the user has a clear
  // "Generate stack for this site" entry point.
  const domains = [];
  const seen = new Set();
  if (currentDomain) {
    domains.push(currentDomain);
    seen.add(currentDomain);
  }
  for (const domain of stackGraphs.keys()) {
    if (!seen.has(domain)) {
      domains.push(domain);
      seen.add(domain);
    }
  }

  // No domain context yet — happens before any page event has been
  // captured. Fall back to the original empty placeholder so the view
  // isn't blank.
  if (domains.length === 0) {
    container.appendChild(buildPreGenerateState(() => onGenerate && onGenerate('')));
    return;
  }

  for (const domain of domains) {
    const graph = stackGraphs.get(domain) || null;
    const isCollapsed = collapsedDomains.has(domain);
    const section = buildDomainSection({
      domain,
      graph,
      isCollapsed,
      isCurrent: domain === currentDomain,
      selectedTool,
      onSelectTool,
      onGenerate,
      onToggleDomain,
      collapsedGroups,
      onToggleGroup,
    });
    container.appendChild(section);
  }
}

// One domain block: collapsible header + the body (tree, empty state,
// or "Generate stack for [domain]" placeholder when no graph exists yet).
// Mirrors the Page View domain-header / body pairing.
function buildDomainSection({ domain, graph, isCollapsed, isCurrent, selectedTool, onSelectTool, onGenerate, onToggleDomain, collapsedGroups, onToggleGroup }) {
  const wrap = document.createElement('div');
  wrap.className = 'stack-domain-section';
  // Stable domain selector so the build-animation step in panel.js can
  // find this body without traversing siblings.
  wrap.dataset.domain = domain;
  if (isCollapsed) wrap.classList.add('collapsed');

  wrap.appendChild(buildStackDomainHeader({
    domain,
    graph,
    isCollapsed,
    isCurrent,
    onToggleDomain,
  }));

  if (isCollapsed) return wrap;

  const body = document.createElement('div');
  body.className = 'stack-domain-body';

  if (!graph) {
    body.appendChild(buildGenerateForDomainState(domain, onGenerate));
    wrap.appendChild(body);
    return wrap;
  }

  if (graph.root.children.length === 0) {
    body.appendChild(buildEmptyState(() => onGenerate && onGenerate(domain)));
    wrap.appendChild(body);
    return wrap;
  }

  // Refresh lives in the panel-level toolbar (Refresh Stack button), so
  // no inline refresh bar is rendered here.

  const treeContainer = document.createElement('div');
  treeContainer.className = 'script-tree-container stack-tree-container';

  const rootGroup = document.createElement('div');
  rootGroup.className = 'script-tree-group stack-root-group';
  rootGroup.appendChild(buildRootHeader(graph));

  const childrenContainer = document.createElement('div');
  childrenContainer.className = 'script-tree-group-children stack-children';

  // Split root children into "attributed" (page-source / TMS / daisy-
  // chain) and "unknown" (initiator chain didn't resolve). Attributed
  // tools render in their normal category-priority position; unknown
  // tools collect into a yellow-bordered "Loader not detected — verify
  // manually" group at the bottom so the user sees at a glance which
  // platforms need eyes rather than mixing them in with confident rows.
  const attributedChildren = [];
  const unknownChildren = [];
  for (const child of graph.root.children) {
    if (child.loaderType === 'unknown') unknownChildren.push(child);
    else attributedChildren.push(child);
  }

  // Per-domain selection — only meaningful for this domain's tree. Captures
  // both platformId and source so multi-source shadows (e.g. a dataLayer
  // that's pushed by both page-source and OneTrust) highlight independently.
  const selectionInDomain = (selectedTool && selectedTool.domain === domain)
    ? { platformId: selectedTool.platformId, source: selectedTool.source || null }
    : null;
  const onSelectInDomain = (platformId, source) => onSelectTool && onSelectTool(domain, platformId, source);

  // Build a domain-scoped Set of just-platformIds so renderPlatformSubtree
  // can check membership with `.has(platformId)`. The state-level set keys
  // groups as `<domain>|<platformId>` so the same TMS in two domains
  // collapses independently — that composite is built per-toggle below.
  const domainCollapsedPrefix = `${domain}|`;
  const domainCollapsedSet = new Set();
  if (collapsedGroups) {
    for (const key of collapsedGroups) {
      if (typeof key === 'string' && key.startsWith(domainCollapsedPrefix)) {
        domainCollapsedSet.add(key.slice(domainCollapsedPrefix.length));
      }
    }
  }
  const groupCtx = {
    collapsedGroups: domainCollapsedSet,
    onToggleGroup: onToggleGroup ? (platformId) => onToggleGroup(domain, platformId) : null,
  };

  for (const child of attributedChildren) {
    renderPlatformSubtree(childrenContainer, child, 1, selectionInDomain, onSelectInDomain, groupCtx);
  }

  if (unknownChildren.length > 0) {
    const unknownGroup = buildUnknownLoaderGroup(unknownChildren.length);
    for (const child of unknownChildren) {
      renderPlatformSubtree(unknownGroup.children, child, 1, selectionInDomain, onSelectInDomain, groupCtx);
    }
    childrenContainer.appendChild(unknownGroup.element);
  }

  rootGroup.appendChild(childrenContainer);
  treeContainer.appendChild(rootGroup);
  body.appendChild(treeContainer);
  wrap.appendChild(body);
  return wrap;
}

// Domain bar — same visual pattern as Page View's `.domain-header`:
// chevron · domain name · tools-count summary on the right. Click the
// header to collapse / expand.
function buildStackDomainHeader({ domain, graph, isCollapsed, isCurrent, onToggleDomain }) {
  const header = document.createElement('div');
  header.className = `domain-header stack-domain-header${isCollapsed ? ' collapsed' : ''}`;

  const chevron = document.createElement('span');
  chevron.className = 'domain-chevron';
  chevron.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>`;
  header.appendChild(chevron);

  const nameEl = document.createElement('span');
  nameEl.className = 'domain-name';
  nameEl.textContent = domain;
  header.appendChild(nameEl);

  if (isCurrent) {
    const currentBadge = document.createElement('span');
    currentBadge.className = 'stack-domain-current-badge';
    currentBadge.textContent = 'Current';
    header.appendChild(currentBadge);
  }

  const summaryEl = document.createElement('span');
  summaryEl.className = 'domain-summary stack-domain-summary';
  if (graph) {
    const toolCount = graph.nodes.size;
    summaryEl.textContent = `${toolCount} ${toolCount === 1 ? 'tool' : 'tools'}`;
  } else {
    summaryEl.textContent = 'Not generated';
  }
  header.appendChild(summaryEl);

  header.addEventListener('click', () => {
    if (onToggleDomain) onToggleDomain(domain);
  });

  return header;
}

// Per-domain "Generate stack for <domain>" placeholder — shown when the
// section is expanded but no graph has been built for the domain yet
// (typically the current page right after entering Stack view, or a new
// domain the user navigated into without generating).
function buildGenerateForDomainState(domain, onGenerate) {
  const wrap = document.createElement('div');
  wrap.className = 'stack-view-empty stack-view-pregenerate stack-domain-pregenerate';

  const svg = makeSvg(
    ['path', { d: 'M12 2L2 7l10 5 10-5-10-5z' }],
    ['path', { d: 'M2 17l10 5 10-5' }],
    ['path', { d: 'M2 12l10 5 10-5' }],
  );
  svg.setAttribute('width', '32');
  svg.setAttribute('height', '32');
  svg.setAttribute('stroke', 'var(--text-tertiary)');
  svg.setAttribute('stroke-width', '1.5');
  wrap.appendChild(svg);

  const title = document.createElement('p');
  title.textContent = `Generate stack for ${domain}`;
  wrap.appendChild(title);

  const hint = document.createElement('p');
  hint.className = 'hint';
  const dash = String.fromCharCode(0x2014);
  hint.textContent = `Click Generate once the page has finished loading. The tree shows tools and how they're wired ${dash} page-source, tag manager, or daisy-chained.`;
  wrap.appendChild(hint);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-primary stack-generate-btn';
  btn.textContent = 'Generate stack';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onGenerate) onGenerate(domain);
  });
  wrap.appendChild(btn);

  return wrap;
}

// Yellow-bordered container holding root-level tools whose loader
// couldn't be attributed. Communicates "these need your verification"
// at the tree level — the inline `?` chip is a glance signal, this
// container is the explicit grouping.
function buildUnknownLoaderGroup(count) {
  const group = document.createElement('div');
  group.className = 'script-tree-group stack-unknown-group';

  const header = document.createElement('div');
  header.className = 'script-tree-group-header stack-unknown-header';

  const spacer = document.createElement('span');
  spacer.className = 'script-tree-chevron-spacer';
  header.appendChild(spacer);

  const icon = makeSvg(
    ['path', { d: 'M10.29 3.86L1.82 18a2 2 0 002 3h16.36a2 2 0 002-3L13.71 3.86a2 2 0 00-3.42 0z' }],
    ['line', { x1: '12', y1: '9', x2: '12', y2: '13' }],
    ['line', { x1: '12', y1: '17', x2: '12.01', y2: '17' }],
  );
  icon.setAttribute('width', '14');
  icon.setAttribute('height', '14');
  header.appendChild(icon);

  const label = document.createElement('span');
  label.className = 'stack-unknown-label';
  label.textContent = 'Loader not detected — verify manually';
  header.appendChild(label);

  const meta = document.createElement('span');
  meta.className = 'stack-unknown-meta';
  meta.textContent = `${count} ${count === 1 ? 'tool' : 'tools'}`;
  header.appendChild(meta);

  group.appendChild(header);

  const childrenContainer = document.createElement('div');
  childrenContainer.className = 'script-tree-group-children stack-unknown-children';
  group.appendChild(childrenContainer);

  return { element: group, children: childrenContainer };
}

// Pre-generation placeholder — what the user sees the first time they
// switch to Stack view, or after a domain change. Empty-stack styling
// with a single primary action.
function buildPreGenerateState(onGenerate) {
  const wrap = document.createElement('div');
  wrap.className = 'stack-view-empty stack-view-pregenerate';

  const svg = makeSvg(
    ['path', { d: 'M12 2L2 7l10 5 10-5-10-5z' }],
    ['path', { d: 'M2 17l10 5 10-5' }],
    ['path', { d: 'M2 12l10 5 10-5' }],
  );
  svg.setAttribute('width', '32');
  svg.setAttribute('height', '32');
  svg.setAttribute('stroke', 'var(--text-tertiary)');
  svg.setAttribute('stroke-width', '1.5');
  wrap.appendChild(svg);

  const title = document.createElement('p');
  title.textContent = 'Build the martech stack for this site';
  wrap.appendChild(title);

  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'Click Generate once the page has finished loading. The tree shows tools and how they’re wired — page-source, tag manager, or daisy-chained.';
  wrap.appendChild(hint);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-primary stack-generate-btn';
  btn.textContent = 'Generate stack';
  btn.addEventListener('click', () => onGenerate && onGenerate());
  wrap.appendChild(btn);

  return wrap;
}

function buildEmptyState(onGenerate) {
  const empty = document.createElement('div');
  empty.className = 'stack-view-empty';

  const svg = makeSvg(
    ['path', { d: 'M12 2L2 7l10 5 10-5-10-5z' }],
    ['path', { d: 'M2 17l10 5 10-5' }],
    ['path', { d: 'M2 12l10 5 10-5' }],
  );
  svg.setAttribute('width', '32');
  svg.setAttribute('height', '32');
  svg.setAttribute('stroke', 'var(--text-tertiary)');
  svg.setAttribute('stroke-width', '1.5');
  empty.appendChild(svg);

  const headline = document.createElement('p');
  headline.textContent = 'No tools detected yet';
  empty.appendChild(headline);

  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = 'Interact with the page to capture its martech stack, then refresh.';
  empty.appendChild(hint);

  if (typeof onGenerate === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-sm stack-generate-btn';
    btn.textContent = 'Refresh';
    btn.addEventListener('click', onGenerate);
    empty.appendChild(btn);
  }

  return empty;
}

// Site-root header — same shape as a script-tree group header (chevron
// spacer + label) so the root reads as the parent of the level-2 nodes.
function buildRootHeader(graph) {
  const rootHeader = document.createElement('div');
  rootHeader.className = 'script-tree-group-header stack-root-header';

  const spacer = document.createElement('span');
  spacer.className = 'script-tree-chevron-spacer';
  rootHeader.appendChild(spacer);

  const iconWrap = document.createElement('span');
  iconWrap.className = 'stack-root-icon';
  iconWrap.setAttribute('aria-hidden', 'true');
  const globe = makeSvg(
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M2 12h20' }],
    ['path', { d: 'M12 2a15 15 0 010 20' }],
    ['path', { d: 'M12 2a15 15 0 000 20' }],
  );
  globe.setAttribute('width', '16');
  globe.setAttribute('height', '16');
  iconWrap.appendChild(globe);
  rootHeader.appendChild(iconWrap);

  const label = document.createElement('span');
  label.className = 'stack-root-label';
  // Tools attached directly to the root come from the page's HTML source
  // (script tags, inline pushes). Label this slot "Page source" rather
  // than echoing the domain name from `graph.root.label` — the domain is
  // already shown in the section header above this row, and "Page source"
  // matches the `loaderType: 'page-source'` term used in attribution.
  label.textContent = 'Page source';
  label.title = `Tools loaded directly from ${graph.root.label}'s HTML source`;
  rootHeader.appendChild(label);

  const meta = document.createElement('span');
  meta.className = 'stack-root-meta';
  meta.textContent = `${graph.nodes.size} ${graph.nodes.size === 1 ? 'tool' : 'tools'}`;
  rootHeader.appendChild(meta);

  return rootHeader;
}

// Render a platform and its descendants. Mirrors the script-tree shape:
// a node with children becomes a `.script-tree-group` (highlighted header,
// chevron, indented children container); a leaf becomes a plain
// `.script-tree-node` with a `.script-tree-node-content` row.
//
// `selection` is `{platformId, source}` (source `null` for non-shadow
// nodes) or `null` when no row is selected. Threaded through verbatim so
// shadow rows can match on both axes.
function renderPlatformSubtree(container, node, depth, selection, onSelect, groupCtx, seen = new Set()) {
  // Defense-in-depth cycle guard (N9, #139): the stack tree is acyclic by
  // construction, but a future re-parenting bug would otherwise crash the
  // panel with unbounded recursion. Skip + warn instead.
  if (seen.has(node.platformId)) {
    console.warn('[stack-view] cycle detected in renderPlatformSubtree, skipping', node.platformId);
    return;
  }
  seen.add(node.platformId);
  const hasChildren = node.children.length > 0;

  if (hasChildren) {
    const group = document.createElement('div');
    group.className = 'script-tree-group stack-platform-group';

    const isCollapsed = groupCtx && groupCtx.collapsedGroups.has(node.platformId);
    if (isCollapsed) group.classList.add('collapsed');

    const header = document.createElement('div');
    header.className = 'script-tree-group-header stack-platform-header';

    // Chevron — clickable expand/collapse affordance.
    const chevron = document.createElement('span');
    chevron.className = 'stack-group-chevron';
    chevron.title = isCollapsed ? 'Expand' : 'Collapse';
    chevron.setAttribute('aria-label', isCollapsed ? 'Expand group' : 'Collapse group');
    chevron.appendChild(makeChevronSvg());
    chevron.addEventListener('click', (e) => {
      e.stopPropagation();
      if (groupCtx && groupCtx.onToggleGroup) groupCtx.onToggleGroup(node.platformId);
    });
    header.appendChild(chevron);

    // Click target — the tool-chip itself + its trailing count + ? indicator.
    header.appendChild(buildToolCard(node, selection, onSelect, /* asHeader */ true));
    group.appendChild(header);

    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'script-tree-group-children';
    for (const child of node.children) {
      renderPlatformSubtree(childrenContainer, child, depth + 1, selection, onSelect, groupCtx, seen);
    }
    group.appendChild(childrenContainer);
    container.appendChild(group);
    return;
  }

  // Leaf — a single .script-tree-node row.
  const wrapper = document.createElement('div');
  wrapper.className = 'script-tree-node stack-node';

  if (depth > 0) {
    const branch = document.createElement('span');
    branch.className = 'tree-branch-line';
    wrapper.appendChild(branch);
  }

  wrapper.appendChild(buildToolCard(node, selection, onSelect, /* asHeader */ false));
  container.appendChild(wrapper);
}

function makeChevronSvg() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', 'M7 10l5 5 5-5');
  svg.appendChild(path);
  return svg;
}

// Build the clickable card representing one platform. Uses the exact same
// shape as a row in Script Tree / Stream / Tool view: a small brand-coloured
// `.event-platform` pill followed by subtle text. The brand styling is
// auto-applied by class — `.event-platform.<platformId>` rules are injected
// at startup via injectPlatformStyles() in panel.js.
function buildToolCard(node, selection, onSelect, asHeader) {
  const platformId = node.platformId;
  const platformName = _deps.getPlatformName(platformId) || platformId;
  const categoryId = _deps.getPlatformCategory(platformId);
  const categoryName = _deps.PLATFORM_CATEGORIES[categoryId]?.name || categoryId || '';

  // Shadow rows carry a `_shadowSource` marker that distinguishes them
  // from each other and from the merged node. Selection compares on both
  // platformId AND source so two shadows of the same tool highlight
  // independently.
  const shadowSource = node._shadowSource || null;

  const row = document.createElement('div');
  row.className = 'script-tree-node-content stack-card';
  if (selection && selection.platformId === platformId && (selection.source || null) === shadowSource) {
    row.classList.add('selected');
  }
  row.dataset.platform = platformId;
  row.dataset.toolId = platformId;
  if (shadowSource) row.dataset.shadowSource = shadowSource;

  // Brand-coloured platform pill — identical to the one in event-list /
  // filter-bar / script-tree. Brand colour is injected at startup via
  // injectPlatformStyles(), keyed on the platform-id class, so just
  // adding the class picks it up automatically. innerHTML is the
  // project-wide pattern for platform-icon insertion (5 other call sites)
  // — input is a trusted SVG literal from platform-icons.js, never user
  // input.
  const pill = document.createElement('span');
  pill.className = `event-platform ${platformId}`;
  pill.dataset.platform = platformId;
  pill.innerHTML = getPlatformIcon(platformId);
  const platformText = document.createElement('span');
  platformText.className = 'platform-text';
  platformText.textContent = platformName;
  pill.appendChild(platformText);
  row.appendChild(pill);

  // Subtle italic grey category text — same visual role as the script-name
  // text in script-tree rows.
  if (categoryName) {
    const cat = document.createElement('span');
    cat.className = 'stack-card-category';
    cat.textContent = categoryName;
    row.appendChild(cat);
  }

  // Loader-unknown indicator — only when a script-load attempt couldn't be
  // attributed. Pure-beacon platforms hang off the root by definition, so a
  // `?` on every dataLayer / pixel row would just be noise.
  if (node.loaderType === 'unknown' && node.scriptLoadCount > 0) {
    const unk = document.createElement('span');
    unk.className = 'stack-card-loader-unknown';
    unk.title = 'Script loaded, but the loader could not be attributed to a parent';
    unk.textContent = '?';
    row.appendChild(unk);
  } else if (node.attributionConfidence) {
    // Confidence dot — small green/yellow/grey circle that lets the
    // reader see at a glance which attributions to trust. Hidden on
    // unknown-loader rows because the `?` already conveys "needs eyes",
    // and on shadow rows because they share the merged node's
    // confidence (the `via X` qualifier in the detail panel covers it).
    if (!shadowSource) {
      const dot = document.createElement('span');
      dot.className = `stack-card-confidence stack-card-confidence-${node.attributionConfidence}`;
      dot.title = `${capitalise(node.attributionConfidence)} confidence — click to see why`;
      dot.setAttribute('aria-label', `${node.attributionConfidence} confidence`);
      row.appendChild(dot);
    }
  }

  // Right-aligned request count — reuses the script-tree count pill so it
  // matches the visual rhythm of nested-children counts in Script Tree.
  const countEl = document.createElement('span');
  countEl.className = 'script-tree-child-count stack-card-request-count';
  countEl.textContent = String(node.requestCount);
  countEl.title = `${node.requestCount} captured request${node.requestCount === 1 ? '' : 's'}`;
  row.appendChild(countEl);

  row.addEventListener('click', (e) => {
    e.stopPropagation();
    onSelect(platformId, shadowSource);
  });

  return row;
}

function capitalise(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============================================================
// "Building your Stack" animation
// ============================================================
// Reflects the real strategy stack — each row is a strategy that genuinely
// runs in `buildStackGraph`. Counts come from the already-built graph's
// `attributionSource` distribution, so the animation isn't theatre: every
// "✓ Resolving initiator chains — 4 platforms" you see corresponds to 4
// real chain-walk attributions in the result.
//
// Honest pacing principle: we render the result first (already in state),
// THEN replay the strategies in sequence. The animation is a UX tool to
// communicate work that has already happened, not a fake spinner padding
// out instant work.

const BUILDING_STAGES = [
  {
    id: 'scan',
    label: 'Scanning captured events',
    count: (graph, eventCount) => eventCount,
    suffix: (n) => `${n} ${n === 1 ? 'event' : 'events'}`,
  },
  {
    id: 'authoritative',
    label: 'Reading authoritative TMS payloads',
    sources: new Set(['tealium-loader-cfg', 'gtm-tag-execution', 'gtm-container-body']),
    suffix: (n) => n === 0 ? 'no signal' : `${n} confirmed`,
  },
  {
    id: 'chain',
    label: 'Resolving initiator chains',
    sources: new Set(['chain-walk', 'website-classification']),
    suffix: (n) => n === 0 ? 'no signal' : `${n} resolved`,
  },
  {
    id: 'callstack',
    label: 'Cross-checking call stacks',
    sources: new Set(['call-stack-captured-platform', 'call-stack-tms-pattern', 'call-stack-page-source']),
    suffix: (n) => n === 0 ? 'no signal' : `${n} attributed`,
  },
  {
    id: 'vote',
    label: 'Voting across multi-event tools',
    sources: new Set(['parent-vote']),
    suffix: (n) => n === 0 ? 'no signal' : `${n} decided`,
  },
  {
    id: 'fallback',
    label: 'Filling fallback edges',
    sources: new Set(['first-party-recovery', 'script-children-map', 'cycle-break-recovery']),
    suffix: (n) => n === 0 ? 'no signal' : `${n} via fallback`,
  },
  {
    id: 'tree',
    label: 'Building the tree',
    count: (graph) => graph.nodes.size,
    suffix: (n) => `${n} ${n === 1 ? 'tool' : 'tools'}`,
  },
];

/**
 * Compute the per-stage counts a graph would feed into the animation.
 * Pure — exported for tests + reuse if a future caller wants the same
 * histogram without rendering the animation.
 *
 * @param {Object} graph - graph from buildStackGraph
 * @param {number} eventCount - total events that fed the build
 * @returns {Array<{id, label, count, suffix}>}
 */
export function computeBuildingStageCounts(graph, eventCount) {
  const sourceCounts = new Map();
  if (graph && graph.nodes) {
    for (const node of graph.nodes.values()) {
      const src = node.attributionSource || 'unresolved';
      sourceCounts.set(src, (sourceCounts.get(src) || 0) + 1);
    }
  }
  return BUILDING_STAGES.map((stage) => {
    let count;
    if (typeof stage.count === 'function') {
      count = stage.count(graph, eventCount);
    } else if (stage.sources) {
      count = 0;
      for (const src of stage.sources) {
        count += sourceCounts.get(src) || 0;
      }
    } else {
      count = 0;
    }
    return { id: stage.id, label: stage.label, count, suffix: stage.suffix(count) };
  });
}

/**
 * Render the staged "Building your Stack" animation into a domain body.
 * Replaces the body's contents with the checklist, then plays each row in
 * sequence. Resolves when complete — caller is expected to re-render the
 * body to show the finished tree afterwards.
 *
 * Honors `prefers-reduced-motion: reduce` by resolving immediately
 * (no checklist, no dwell) so the caller can render the tree right away.
 *
 * @param {HTMLElement} container - the .stack-domain-body to render into
 * @param {Object} graph
 * @param {number} eventCount
 * @param {Object} [opts]
 * @param {number} [opts.dwellMs=180] - per-step dwell. Tests pass 0.
 * @param {string} [opts.domainLabel='this site'] - shown in the header
 * @returns {Promise<void>} resolves when the animation completes
 */
export function renderBuildingAnimation(container, graph, eventCount, opts = {}) {
  const dwellMs = opts.dwellMs ?? 180;
  const domainLabel = opts.domainLabel || 'this site';
  const reducedMotion = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion || dwellMs === 0) {
    // No animation — caller still gets the lifecycle promise so the
    // wiring stays uniform.
    return Promise.resolve();
  }

  const stages = computeBuildingStageCounts(graph, eventCount);

  // Clear container before injecting the animation.
  while (container.firstChild) container.removeChild(container.firstChild);
  const wrap = document.createElement('div');
  wrap.className = 'stack-build-animation';

  const title = document.createElement('p');
  title.className = 'stack-build-title';
  title.textContent = `Building stack for ${domainLabel}…`;
  wrap.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'stack-build-stages';
  const rowEls = stages.map((stage) => {
    const li = document.createElement('li');
    li.className = 'stack-build-stage stack-build-stage-pending';
    li.dataset.stageId = stage.id;

    const marker = document.createElement('span');
    marker.className = 'stack-build-marker';
    li.appendChild(marker);

    const label = document.createElement('span');
    label.className = 'stack-build-label';
    label.textContent = stage.label;
    li.appendChild(label);

    const suffix = document.createElement('span');
    suffix.className = 'stack-build-suffix';
    li.appendChild(suffix);

    list.appendChild(li);
    return { li, marker, suffix, stage };
  });
  wrap.appendChild(list);

  container.appendChild(wrap);

  // Drive the staged reveal. Each step waits dwellMs, then flips the row
  // from pending → done and writes the count suffix. The closing summary
  // renders after the last row clears.
  return new Promise((resolve) => {
    let i = 0;
    const advance = () => {
      if (i >= rowEls.length) {
        // "Stack Ready" capstone — big checkmark in the same green palette as
        // the per-row markers, giving the user a beat to register that the
        // checklist actually completed before the tree replaces it.
        const ready = document.createElement('div');
        ready.className = 'stack-build-ready';
        const readyMarker = document.createElement('span');
        readyMarker.className = 'stack-build-ready-marker';
        const readyLabel = document.createElement('span');
        readyLabel.className = 'stack-build-ready-label';
        readyLabel.textContent = 'Stack Ready';
        ready.appendChild(readyMarker);
        ready.appendChild(readyLabel);
        wrap.appendChild(ready);

        // Trailing summary — quick recap of confidence breakdown.
        const summary = document.createElement('p');
        summary.className = 'stack-build-summary';
        summary.textContent = buildSummaryText(graph);
        wrap.appendChild(summary);

        // Brief dwell so the capstone is actually visible, then fade the
        // checklist out before the caller swaps in the rendered tree —
        // pairs with the .stack-tree-container fade-in keyframe on render.
        setTimeout(() => {
          wrap.classList.add('stack-build-fadeout');
          setTimeout(resolve, 180);
        }, 500);
        return;
      }
      const { li, suffix, stage } = rowEls[i];
      li.classList.remove('stack-build-stage-pending');
      li.classList.add('stack-build-stage-done');
      suffix.textContent = stage.suffix;
      i += 1;
      setTimeout(advance, dwellMs);
    };
    setTimeout(advance, dwellMs);
  });
}

// One-line summary printed below the staged list when animation finishes.
// Aggregates confidence distribution across the graph — gives the user a
// take-away without having to scan the tree row by row.
function buildSummaryText(graph) {
  if (!graph || !graph.nodes) return 'Done.';
  const total = graph.nodes.size;
  let high = 0, medium = 0, low = 0;
  for (const node of graph.nodes.values()) {
    const c = node.attributionConfidence;
    if (c === 'high') high += 1;
    else if (c === 'medium') medium += 1;
    else low += 1;
  }
  if (total === 0) return 'No tools captured yet — interact with the page and try again.';
  const parts = [];
  if (high > 0) parts.push(`${high} high-confidence`);
  if (medium > 0) parts.push(`${medium} medium`);
  if (low > 0) parts.push(`${low} low / unknown`);
  return `Done — ${total} tool${total === 1 ? '' : 's'}: ${parts.join(', ')}.`;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeSvg(...children) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  for (const [tag, attrs] of children) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.appendChild(el);
  }
  return svg;
}
