// Stack View — Tool detail panel.
// Rendered in the right-hand detail pane when a stack node is selected.
// A stack node is *a tool aggregated across the session*, not a single request,
// so the panel content differs from event detail (Overview, About Tool, Stack
// position, Session activity, Consent context, Quick actions).
//
// Visual contract: same components as event detail.
//   - Overview: `.detail-card.detail-card-overview`
//   - Each subsequent block: `.detail-section-card` with chevron + collapsible
//     `.detail-section-card-content`
// See docs/UI-GUIDELINES.md "Card" and "Detail Section Card".

import { getPlatformIcon } from './platform-icons.js';
import { getPlatformColor } from '../tracking-endpoints.js';
import { createAboutToolSection } from './event-detail.js';
import { getSectionExpandedState, saveSectionState } from './detail-section-state.js';
import { ATTRIBUTION_SOURCE_INFO } from './stack-attribution.js';
import { SCRIPT_INITIATOR_ICONS } from './script-initiator-icons.js';

let _deps;

export function initStackToolDetail(deps) {
  _deps = deps;
}

/**
 * Render the Tool detail pane for a selected stack node.
 *
 * Sections sit inside a `.detail-layout` wrapper so they inherit the same
 * 16px vertical gap event-detail uses — the wrapper is what makes a stack
 * of cards read as a column rather than as one undifferentiated block.
 *
 * `options.source` is set when the user clicked a multi-source shadow row
 * (e.g. the OneTrust-pushed dataLayer copy). The displayed facts (request
 * count, sources row, top event names, consent rollup) are scoped to that
 * sender so the user sees what came from this side of the merge, not the
 * union. Stack position still shows the merged tool's overall position
 * because that's a graph-level property, not a per-source one.
 *
 * @param {HTMLElement} container
 * @param {Object} graph
 * @param {string} platformId
 * @param {{source?: string|null}} [options]
 */
export function renderStackToolDetail(container, graph, platformId, options = {}) {
  container.innerHTML = '';

  if (!graph || !platformId) {
    container.appendChild(emptyState('Select a tool in Stack view to see its detail'));
    return;
  }

  const node = graph.nodes.get(platformId);
  if (!node) {
    container.appendChild(emptyState('This tool is no longer in the captured stack'));
    return;
  }

  // Build a per-source view of the node when a source is set (shadow
  // click). The view is a shallow projection: counts and event lists
  // are filtered to events whose resolved sender matches `source`.
  // Graph-level fields (parent / children / loaderType) stay on the
  // merged node.
  const source = options.source || null;
  const view = source ? buildSourceScopedView(node, source) : null;

  const layout = document.createElement('div');
  layout.className = 'detail-layout';

  layout.appendChild(buildOverviewCard(node, graph, { source, view }));
  const aboutSection = createAboutToolSection(platformId);
  if (aboutSection) layout.appendChild(aboutSection);
  layout.appendChild(buildStackPositionSection(node, graph));
  layout.appendChild(buildSessionActivitySection(node, view));
  const consentSection = buildConsentContextSection(view ? viewAsNode(node, view) : node);
  if (consentSection) layout.appendChild(consentSection);
  layout.appendChild(buildQuickActionsCard(node, graph));

  container.appendChild(layout);
}

// Compute a per-source view of a multi-source node: filter event-derived
// facts (eventIds, requestCount, eventNameCounts) down to events whose
// resolved sender matches `source`. Returns null when the node has no
// per-source bucket for this source (defensive — should not happen for a
// valid shadow click).
function buildSourceScopedView(node, source) {
  const bucket = node.eventIdsBySource && node.eventIdsBySource[source];
  if (!bucket || bucket.length === 0) return null;

  const eventIds = bucket;
  const requestCount = eventIds.length;

  const eventNameCounts = {};
  if (typeof _deps.getEventById === 'function') {
    for (const id of eventIds) {
      const ev = _deps.getEventById(id);
      if (!ev) continue;
      const name = ev.eventName;
      if (name) eventNameCounts[name] = (eventNameCounts[name] || 0) + 1;
    }
  }

  return {
    source,
    eventIds,
    requestCount,
    eventNameCounts,
    pushSources: { [source]: requestCount },
  };
}

// Wrap `view` in a shape compatible with helpers that read `eventIds`
// directly off a node (Consent Context). Lets us avoid duplicating the
// node-style API across helpers.
function viewAsNode(node, view) {
  return {
    ...node,
    eventIds: view.eventIds,
    requestCount: view.requestCount,
    eventNameCounts: view.eventNameCounts,
    pushSources: view.pushSources,
  };
}

function emptyState(message) {
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  const p = document.createElement('p');
  p.textContent = message;
  empty.appendChild(p);
  return empty;
}

// ---------------------------------------------------------------------------
// Overview card — adopts the same `.detail-card.detail-card-overview`
// collapsible pattern used everywhere else in the detail pane (see
// event-detail.js → createOverviewCard). Differences from event detail:
//   - Title is the tool name (not the event name)
//   - Right-side timestamp is "First seen" (a stack node spans many events
//     captured over the session)
//   - KV rows surface tool-aggregate facts: Loaded via, Sources (multi),
//     Total requests, Children, First page
//   - Unknown-loader warning replaces the "Loaded via" KV row when the
//     initiator chain didn't resolve
// ---------------------------------------------------------------------------
function buildOverviewCard(node, graph, { source = null, view = null } = {}) {
  const card = document.createElement('div');
  card.className = 'detail-card detail-card-overview stack-tool-overview';

  const platformId = node.platformId;
  const platformName = _deps.getPlatformName(platformId) || platformId;
  const categoryId = _deps.getPlatformCategory(platformId);
  const categoryName = _deps.PLATFORM_CATEGORIES[categoryId]?.name || categoryId || '';

  // Source-scoped projection: when the user clicked a shadow row, all
  // counts come from the per-source bucket rather than the merged node.
  const requestCount = view ? view.requestCount : node.requestCount;

  // Persistent collapse state — shares the same scope as event-detail's
  // Overview so a user who collapses one collapses the other. Distinct
  // section title ('Tool Overview') keeps the choice from leaking into
  // event detail's persistence key.
  const overviewExpanded = getSectionExpandedState('Tool Overview', true, { persistent: true });

  // Header — chevron + tool name + brand pill + category tag, with first-
  // seen timestamp on the right. Mirrors `.overview-header-left/right` in
  // event-detail's createOverviewCard.
  const header = document.createElement('div');
  header.className = `detail-card-header${overviewExpanded ? '' : ' collapsed'}`;

  const headerLeft = document.createElement('div');
  headerLeft.className = 'overview-header-left';

  // Chevron — created as DOM (safer than innerHTML for SVG)
  const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  chevron.setAttribute('class', 'overview-chevron');
  chevron.setAttribute('viewBox', '0 0 24 24');
  chevron.setAttribute('fill', 'none');
  chevron.setAttribute('stroke', 'currentColor');
  chevron.setAttribute('stroke-width', '2');
  const chevronPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  chevronPath.setAttribute('d', 'M6 9l6 6 6-6');
  chevron.appendChild(chevronPath);
  headerLeft.appendChild(chevron);

  // Tool name — same role as overview-event-name in event-detail.
  const toolName = document.createElement('span');
  toolName.className = 'overview-event-name';
  toolName.textContent = platformName;
  headerLeft.appendChild(toolName);

  // Brand-coloured platform pill — the same `.event-platform.<id>` pill
  // used everywhere. innerHTML is the project-wide pattern for platform
  // icon insertion (5 other call sites). Input is a trusted SVG literal.
  const pill = document.createElement('span');
  pill.className = `event-platform ${platformId}`;
  pill.dataset.platform = platformId;
  pill.innerHTML = getPlatformIcon(platformId);
  const pillText = document.createElement('span');
  pillText.className = 'platform-text';
  pillText.textContent = platformName;
  pill.appendChild(pillText);
  headerLeft.appendChild(pill);

  if (categoryName) {
    const catTag = document.createElement('span');
    catTag.className = 'overview-header-tag';
    const catLabel = document.createElement('span');
    catLabel.className = 'tag-label';
    catLabel.textContent = categoryName;
    catTag.appendChild(catLabel);
    headerLeft.appendChild(catTag);
  }

  // Source qualifier — only when the user is looking at one specific
  // sender of a multi-source tool. Reads "via Page source" or "via
  // OneTrust" so the user has unambiguous context for the scoped facts
  // below. Distinct from `.event-intercept-badge` and `.overview-header-tag`
  // — this is its own muted treatment.
  if (source) {
    const viaTag = document.createElement('span');
    viaTag.className = 'stack-tool-source-tag';
    const dash = String.fromCharCode(0x2014);
    viaTag.textContent = `${dash} via ${formatSourceLabel(source, graph)}`;
    viaTag.title = 'This view shows only events that came from this sender. Click another row to switch.';
    headerLeft.appendChild(viaTag);
  }

  header.appendChild(headerLeft);

  const headerRight = document.createElement('div');
  headerRight.className = 'overview-header-right';
  if (node.firstSeenAt && Number.isFinite(node.firstSeenAt)) {
    const ts = document.createElement('span');
    ts.className = 'overview-timestamp';
    const date = new Date(node.firstSeenAt);
    ts.textContent = `First seen ${date.toLocaleTimeString()}`;
    headerRight.appendChild(ts);
  }
  header.appendChild(headerRight);

  card.appendChild(header);

  // Content — KV rows describing the tool's role + activity.
  const content = document.createElement('div');
  content.className = `detail-card-content${overviewExpanded ? '' : ' collapsed'}`;

  // Unknown-loader case: replace the "Loaded via" row with a yellow
  // warning callout. The rest of the KV block still renders below.
  if (node.loaderType === 'unknown') {
    content.appendChild(buildUnknownLoaderWarning());
  }

  const kv = document.createElement('div');
  kv.className = 'overview-kv';

  // Loaded via — only when attribution resolved. Unknown is handled by
  // the yellow callout above.
  if (node.loaderType !== 'unknown') {
    const loadedValue = document.createElement('span');
    if (node.loaderType === 'page-source') {
      const strong = document.createElement('strong');
      strong.textContent = 'Page source';
      loadedValue.appendChild(strong);
    } else if (node.parentPlatformId && graph.nodes.has(node.parentPlatformId)) {
      const parentName = _deps.getPlatformName(node.parentPlatformId) || node.parentPlatformId;
      loadedValue.appendChild(makeToolLink(parentName, node.parentPlatformId));
    } else {
      loadedValue.textContent = '—';
    }
    kv.appendChild(buildKvItem('Loaded via', loadedValue));
  }

  // Sources — only on the merged view, and only when the platform was
  // pushed by more than one sender. When source-scoped, the header's
  // "via <source>" tag already conveys this — no need for the row.
  if (!source) {
    const pushSourceEntries = Object.entries(node.pushSources || {})
      .sort((a, b) => b[1] - a[1]);
    if (pushSourceEntries.length > 1) {
      kv.appendChild(buildKvItem('Sources', buildSourcesValue(pushSourceEntries, graph)));
    }
  }

  // Total requests — scoped count when a source is active.
  const requestsValue = document.createElement('strong');
  requestsValue.textContent = String(requestCount);
  kv.appendChild(buildKvItem(source ? 'Requests from this source' : 'Total requests', requestsValue));

  // Children — count + parenthetical names. Truncate the inline list at
  // 3 to keep the Overview tight; full list still renders in Stack
  // position.
  if (node.children && node.children.length > 0) {
    const childrenValue = document.createElement('span');
    const shown = node.children.slice(0, 3);
    shown.forEach((child, idx) => {
      const childName = _deps.getPlatformName(child.platformId) || child.platformId;
      childrenValue.appendChild(makeToolLink(childName, child.platformId));
      if (idx < shown.length - 1) {
        const sep = document.createElement('span');
        sep.className = 'stack-position-sep';
        sep.textContent = ', ';
        childrenValue.appendChild(sep);
      }
    });
    if (node.children.length > shown.length) {
      const more = document.createElement('span');
      more.className = 'overview-key-extra';
      more.textContent = ` +${node.children.length - shown.length} more`;
      childrenValue.appendChild(more);
    }
    kv.appendChild(buildKvItem(`Children (${node.children.length})`, childrenValue));
  }

  // First page — where the tool first appeared in the session. Useful
  // when navigating across multiple pages of a domain.
  if (node.firstPageHost) {
    const firstPage = document.createElement('span');
    firstPage.textContent = node.firstPageHost;
    kv.appendChild(buildKvItem('First page', firstPage));
  }

  content.appendChild(kv);

  // Attribution block — surfaces which strategy resolved the parent
  // and at what confidence. Lives inside the Overview card (below the
  // KV row, separated by a dashed line) so it reads as basic facts
  // about the tool, mirroring how stream event detail's overview
  // appends matching-viz beneath the KV row.
  content.appendChild(buildAttributionBlock(node));

  card.appendChild(content);

  // Wire collapse toggle on header click — same shape as event-detail's
  // Overview wiring.
  header.addEventListener('click', () => {
    const nowCollapsed = !header.classList.contains('collapsed');
    header.classList.toggle('collapsed', nowCollapsed);
    content.classList.toggle('collapsed', nowCollapsed);
    saveSectionState('Tool Overview', nowCollapsed, { persistent: true });
  });

  return card;
}

// Build one `.overview-kv-item` (Key: <value-node>). Mirrors the row
// shape produced by event-detail's createOverviewCard so the two
// surfaces share the same visual rhythm.
function buildKvItem(key, valueNode) {
  const item = document.createElement('div');
  item.className = 'overview-kv-item';

  const keySpan = document.createElement('span');
  keySpan.className = 'overview-key';
  keySpan.textContent = `${key}: `;
  item.appendChild(keySpan);

  if (valueNode instanceof Node) {
    item.appendChild(valueNode);
  } else {
    const valueSpan = document.createElement('span');
    valueSpan.className = 'overview-value';
    valueSpan.textContent = String(valueNode == null ? '' : valueNode);
    item.appendChild(valueSpan);
  }

  return item;
}

// Render the inline "Sources" value: count-sorted senders, each rendered
// as a tool link if it maps to a captured platform, or a labelled strong
// span otherwise. Returns a single span that callers wrap in a KV row.
function buildSourcesValue(entries, graph) {
  const wrap = document.createElement('span');

  entries.forEach(([senderKey, count], idx) => {
    if (idx > 0) {
      const sep = document.createElement('span');
      sep.className = 'stack-position-sep';
      sep.textContent = ', ';
      wrap.appendChild(sep);
    }
    const value = document.createElement('span');
    value.className = 'stack-tool-source-entry';

    if (senderKey === 'page-source') {
      const strong = document.createElement('strong');
      strong.textContent = 'Page source';
      value.appendChild(strong);
    } else if (graph.nodes.has(senderKey)) {
      const name = _deps.getPlatformName(senderKey) || senderKey;
      value.appendChild(makeToolLink(name, senderKey));
    } else {
      const strong = document.createElement('strong');
      strong.textContent = senderKey === 'tag-manager'
        ? 'Tag Manager'
        : senderKey === 'script'
        ? 'Third-party script'
        : senderKey;
      value.appendChild(strong);
    }

    const countEl = document.createElement('span');
    countEl.className = 'stack-tool-source-count';
    countEl.textContent = ` ×${count}`;
    value.appendChild(countEl);

    wrap.appendChild(value);
  });

  return wrap;
}

// Human-readable label for a source key. 'page-source' becomes
// "Page source"; a captured platform-id becomes its display name; a
// raw classification fallback ('tag-manager', 'script') gets a friendly
// label; anything else returns verbatim.
function formatSourceLabel(source, graph) {
  if (!source) return '';
  if (source === 'page-source') return 'Page source';
  if (graph && graph.nodes && graph.nodes.has(source)) {
    return _deps.getPlatformName(source) || source;
  }
  if (source === 'tag-manager') return 'Tag Manager';
  if (source === 'script') return 'Third-party script';
  return source;
}

// Yellow warning callout shown in the Overview card when the loader
// attribution failed. Distinct from the inline `?` indicator on the
// tree row — that's a glance signal, this is the explanation + the
// "verify manually" disclaimer.
function buildUnknownLoaderWarning() {
  const wrap = document.createElement('div');
  wrap.className = 'stack-loader-warning';

  const header = document.createElement('div');
  header.className = 'stack-loader-warning-header';

  const icon = makeSvg(
    ['path', { d: 'M10.29 3.86L1.82 18a2 2 0 002 3h16.36a2 2 0 002-3L13.71 3.86a2 2 0 00-3.42 0z' }],
    ['line', { x1: '12', y1: '9', x2: '12', y2: '13' }],
    ['line', { x1: '12', y1: '17', x2: '12.01', y2: '17' }],
  );
  header.appendChild(icon);

  const title = document.createElement('span');
  title.textContent = 'Loader not detected — verify manually';
  header.appendChild(title);
  wrap.appendChild(header);

  const body = document.createElement('p');
  body.className = 'stack-loader-warning-body';
  body.textContent =
    "The captured initiator chain didn’t resolve to a parent. Verify the loader manually — check the page HTML or your tag-manager configuration.";
  wrap.appendChild(body);

  return wrap;
}

// ---------------------------------------------------------------------------
// Section helper — produces a collapsible `.detail-section-card` matching the
// pattern used everywhere else in event detail (chevron path "M6 9l6 6 6-6",
// rotates -90deg when collapsed via panel.css).
// ---------------------------------------------------------------------------
function makeCollapsibleSection(title, contentBuilder, { startExpanded = true } = {}) {
  const section = document.createElement('div');
  section.className = 'detail-section-card';

  const header = document.createElement('div');
  header.className = `detail-section-card-header${startExpanded ? '' : ' collapsed'}`;

  const chevron = makeSvg(['path', { d: 'M6 9l6 6 6-6' }]);
  header.appendChild(chevron);

  const titleEl = document.createElement('span');
  titleEl.textContent = title;
  header.appendChild(titleEl);

  const contentWrapper = document.createElement('div');
  contentWrapper.className = `detail-section-card-content${startExpanded ? '' : ' collapsed'}`;
  contentBuilder(contentWrapper);

  header.addEventListener('click', () => {
    header.classList.toggle('collapsed');
    contentWrapper.classList.toggle('collapsed');
  });

  section.appendChild(header);
  section.appendChild(contentWrapper);
  return section;
}

// ---------------------------------------------------------------------------
// Stack position — Parent + Children + Also loaded by.
// ---------------------------------------------------------------------------
function buildStackPositionSection(node, graph) {
  return makeCollapsibleSection('Stack position', (content) => {
    // Visual tree — reuses the `.script-dep-tree*` classes from
    // event-detail's Script Dependencies section so the two surfaces
    // share the same visual rhythm. Parent at depth 0, this tool at
    // depth 1 (marked self), children at depth 2.
    const tree = document.createElement('div');
    tree.className = 'script-dep-tree';

    // Depth 0 — Parent. Three cases:
    //   1. parentPlatformId resolves to a captured tool → clickable pill
    //   2. loaderType === 'page-source' (or no parent) → "HTML (page source)" + home icon
    //   3. fall through → root domain label
    if (node.parentPlatformId && graph.nodes.has(node.parentPlatformId)) {
      const parentName = _deps.getPlatformName(node.parentPlatformId) || node.parentPlatformId;
      tree.appendChild(buildStackTreeRow({
        depth: 0,
        platformId: node.parentPlatformId,
        platformName: parentName,
        clickable: true,
      }));
    } else {
      const rootLabel = node.loaderType === 'page-source'
        ? 'HTML (page source)'
        : (graph.rootDomain || 'site root');
      tree.appendChild(buildStackTreeRow({
        depth: 0,
        initiatorIcon: 'website',
        rootLabel,
      }));
    }

    // Depth 1 — Self (this tool). Non-clickable, marked with the same
    // "← this tool" affordance as Script Dependencies' "← this script".
    tree.appendChild(buildStackTreeRow({
      depth: 1,
      platformId: node.platformId,
      platformName: _deps.getPlatformName(node.platformId) || node.platformId,
      isSelf: true,
    }));

    // Depth 2 — Children. Each row clickable.
    if (node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        tree.appendChild(buildStackTreeRow({
          depth: 2,
          platformId: child.platformId,
          platformName: _deps.getPlatformName(child.platformId) || child.platformId,
          clickable: true,
        }));
      });
    } else {
      // Surface the empty state explicitly so the tree isn't a silent
      // two-row stub when a leaf tool has no descendants.
      const emptyChildren = document.createElement('div');
      emptyChildren.className = 'script-dep-tree-node depth-2 more';
      const indent = document.createElement('span');
      indent.className = 'script-dep-tree-indent';
      indent.textContent = '└─';
      emptyChildren.appendChild(indent);
      const text = document.createElement('span');
      text.className = 'script-dep-tree-more';
      text.textContent = 'no children captured';
      emptyChildren.appendChild(text);
      tree.appendChild(emptyChildren);
    }

    content.appendChild(tree);

    // Also loaded by — alternative parents observed for the same tool
    // across the session (e.g. GTM and a website tag both seen loading
    // it). Stays as a labelled row beneath the tree because the tree
    // shape is "this tool's resolved position", not "every place it
    // appeared".
    if (node.alsoLoadedBy && node.alsoLoadedBy.length > 0) {
      const altRow = document.createElement('div');
      altRow.className = 'stack-position-row stack-position-also';
      const altLabel = document.createElement('span');
      altLabel.className = 'stack-position-label';
      altLabel.textContent = 'Also loaded by: ';
      altRow.appendChild(altLabel);
      node.alsoLoadedBy.forEach((altParentId, idx) => {
        const name = _deps.getPlatformName(altParentId) || altParentId;
        altRow.appendChild(makeToolLink(name, altParentId));
        if (idx < node.alsoLoadedBy.length - 1) {
          const sep = document.createElement('span');
          sep.className = 'stack-position-sep';
          sep.textContent = ', ';
          altRow.appendChild(sep);
        }
      });
      content.appendChild(altRow);
    }
  });
}

// Parse a trusted SVG string into a DOM node. The icon strings come
// from our own constants (`SCRIPT_INITIATOR_ICONS`, `getPlatformIcon`)
// — never from user input — so this is a controlled boundary. Uses
// `createContextualFragment` so the SVG inherits the HTML namespace
// rules (same behaviour as `innerHTML`); strict XML parsing via
// `DOMParser('image/svg+xml')` rejects icons that omit `xmlns`.
function svgFromString(svgStr) {
  const range = document.createRange();
  const frag = range.createContextualFragment(svgStr);
  return frag.firstElementChild;
}

// Render a single row in the Stack position tree. Reuses the
// `.script-dep-tree*` class set so styling stays in lock-step with
// event-detail's Script Dependencies tree. The `clickable` flag wires
// `onSelectTool(platformId)` and adds the `.clickable` modifier so CSS
// can show a pointer affordance.
function buildStackTreeRow({
  depth,
  platformId = null,
  platformName = null,
  initiatorIcon = null,
  rootLabel = null,
  isSelf = false,
  clickable = false,
}) {
  const node = document.createElement('div');
  node.className = `script-dep-tree-node depth-${depth}${isSelf ? ' self' : ''}${clickable ? ' clickable' : ''}`;

  if (depth > 0) {
    const indent = document.createElement('span');
    indent.className = 'script-dep-tree-indent';
    indent.textContent = '└─';
    node.appendChild(indent);
  }

  if (initiatorIcon) {
    const iconBadge = document.createElement('span');
    iconBadge.className = 'script-dep-tree-icon';
    iconBadge.appendChild(svgFromString(SCRIPT_INITIATOR_ICONS[initiatorIcon] || SCRIPT_INITIATOR_ICONS.unknown));
    node.appendChild(iconBadge);
  }

  if (platformId) {
    const pill = document.createElement('span');
    pill.className = `event-platform ${platformId}`;
    pill.dataset.platform = platformId;
    pill.appendChild(svgFromString(getPlatformIcon(platformId)));
    const pillText = document.createElement('span');
    pillText.className = 'platform-text';
    pillText.textContent = platformName || platformId;
    pill.appendChild(pillText);
    node.appendChild(pill);
  } else if (rootLabel) {
    const label = document.createElement('span');
    label.className = 'script-dep-tree-filename';
    label.textContent = rootLabel;
    node.appendChild(label);
  }

  if (isSelf) {
    const selfBadge = document.createElement('span');
    selfBadge.className = 'script-dep-tree-self-badge';
    selfBadge.textContent = '← this tool';
    node.appendChild(selfBadge);
  }

  if (clickable && platformId) {
    node.setAttribute('role', 'button');
    node.tabIndex = 0;
    node.title = `Show details for ${platformName || platformId}`;
    const handler = () => _deps.onSelectTool(platformId);
    node.addEventListener('click', handler);
    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
    });
  }

  return node;
}

// ---------------------------------------------------------------------------
// Attribution block (overview card) — surfaces which strategy resolved
// the parent and at what confidence. Lives inside the Overview card,
// separated from the KV row by a dashed line, so it reads as basic
// info about the tool. Was previously a standalone collapsible section
// ("Why this attribution") — moved inline to keep the detail pane
// scan-friendly. Critical UX for distinguishing high-confidence
// "GTM-loaded" verdicts from heuristic "page-source" guesses.
// ---------------------------------------------------------------------------
function buildAttributionBlock(node) {
  const confidence = node.attributionConfidence || 'low';
  const source = node.attributionSource || 'unresolved';
  const explanation = ATTRIBUTION_SOURCE_INFO[source]
    || "We couldn't trace this tool's loader from the captured signals.";

  const wrap = document.createElement('div');
  wrap.className = 'stack-why-block';

  // Confidence pill — the headline. Same green/yellow/grey palette as
  // the inline card dot, but rendered as a labelled badge here so the
  // user reads "High confidence" / "Medium confidence" / "Low
  // confidence" rather than guessing from a colour alone.
  const pill = document.createElement('span');
  pill.className = `stack-why-confidence stack-why-confidence-${confidence}`;
  pill.textContent = `${capitaliseFirst(confidence)} confidence`;
  wrap.appendChild(pill);

  // Explanation — the human-readable copy from
  // ATTRIBUTION_SOURCE_INFO. Mentions the specific signal (Tealium
  // loader.cfg / GTM telemetry / chain walk / etc.) so the user knows
  // exactly what to override if they disagree.
  const expl = document.createElement('p');
  expl.className = 'stack-why-explanation';
  expl.textContent = explanation;
  wrap.appendChild(expl);

  // Source code-style tag — the raw `attributionSource` value, useful
  // for debugging and for users skimming many tools who learn the
  // source vocabulary. Small, muted, monospace.
  const sourceTag = document.createElement('span');
  sourceTag.className = 'stack-why-source';
  sourceTag.textContent = source;
  wrap.appendChild(sourceTag);

  return wrap;
}

function capitaliseFirst(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Session activity — first seen, total requests, top event names.
// ---------------------------------------------------------------------------
function buildSessionActivitySection(node, view = null) {
  const requestCount = view ? view.requestCount : node.requestCount;
  const eventNameCounts = view ? view.eventNameCounts : (node.eventNameCounts || {});
  const sectionTitle = view
    ? 'Session activity from this source'
    : 'Session activity for this tool';

  return makeCollapsibleSection(sectionTitle, (content) => {
    // First seen — stays at the merged node's first-seen because that's
    // when the tool entered the stack overall. A per-source first-seen
    // would be a different question (out of scope for now).
    const firstRow = document.createElement('div');
    firstRow.className = 'stack-position-row';
    const firstLabel = document.createElement('span');
    firstLabel.className = 'stack-position-label';
    firstLabel.textContent = 'First seen: ';
    firstRow.appendChild(firstLabel);
    const firstValue = document.createElement('span');
    if (node.firstSeenAt && Number.isFinite(node.firstSeenAt)) {
      const date = new Date(node.firstSeenAt);
      firstValue.textContent = `${date.toLocaleTimeString()} (${node.firstPageHost || 'unknown page'})`;
    } else {
      firstValue.textContent = '—';
    }
    firstRow.appendChild(firstValue);
    content.appendChild(firstRow);

    // Total requests — scoped count when a source is active.
    const totalRow = document.createElement('div');
    totalRow.className = 'stack-position-row';
    const totalLabel = document.createElement('span');
    totalLabel.className = 'stack-position-label';
    totalLabel.textContent = view ? 'Requests from this source: ' : 'Total requests: ';
    totalRow.appendChild(totalLabel);
    const totalValue = document.createElement('strong');
    totalValue.textContent = String(requestCount);
    totalRow.appendChild(totalValue);
    content.appendChild(totalRow);

    // Top event names — counts come from the (possibly source-scoped) bucket.
    // Rendered as a vertical list of clickable rows, each with the tool's
    // platform pill so the row visually echoes the Stack position tree
    // and the Stream view's event rows. Click jumps to Stream filtered
    // to this tool + this event name.
    const entries = Object.entries(eventNameCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (entries.length > 0) {
      const namesLabel = document.createElement('div');
      namesLabel.className = 'stack-position-row stack-activity-heading';
      const namesLabelText = document.createElement('span');
      namesLabelText.className = 'stack-position-label';
      namesLabelText.textContent = entries.length === 1 ? 'Top event name:' : 'Top event names:';
      namesLabel.appendChild(namesLabelText);
      content.appendChild(namesLabel);

      const list = document.createElement('div');
      list.className = 'stack-activity-event-list';
      entries.forEach(([name, count]) => {
        list.appendChild(buildSessionActivityRow(node.platformId, name, count));
      });
      content.appendChild(list);
    }
  });
}

// ---------------------------------------------------------------------------
// Consent context — granted / warning / denied rollup pills, only when there
// is data and the consent feature isn't off.
// ---------------------------------------------------------------------------
function buildConsentContextSection(node) {
  if (typeof _deps.getConsentCheckForEvent !== 'function') return null;

  let granted = 0;
  let denied = 0;
  let warning = 0;
  for (const evId of node.eventIds) {
    const ev = _deps.getEventById(evId);
    if (!ev) continue;
    let verdict = null;
    try {
      verdict = _deps.getConsentCheckForEvent(ev);
    } catch { /* non-critical */ }
    if (!verdict) continue;
    const status = verdict.status || verdict.severity;
    if (status === 'granted' || status === 'ok') granted += 1;
    else if (status === 'denied' || status === 'violation') denied += 1;
    else if (status === 'warning' || status === 'pre-consent' || status === 'unknown') warning += 1;
  }

  if (granted + denied + warning === 0) return null;

  return makeCollapsibleSection('Consent context for this tool', (content) => {
    content.classList.add('stack-consent-rollup');
    const addPill = (label, count, modifier) => {
      if (count === 0) return;
      const pill = document.createElement('span');
      pill.className = `stack-consent-pill stack-consent-pill-${modifier}`;
      pill.textContent = `${label} ×${count}`;
      content.appendChild(pill);
    };
    addPill('Granted', granted, 'granted');
    addPill('Warning', warning, 'warning');
    addPill('Denied', denied, 'denied');
  });
}

// ---------------------------------------------------------------------------
// Quick actions — View all events / Open in Tool view / Copy node.
// ---------------------------------------------------------------------------
function buildQuickActionsCard(node, graph) {
  return makeCollapsibleSection('Quick actions', (content) => {
    content.classList.add('stack-quick-actions-row');

    const streamBtn = document.createElement('button');
    streamBtn.type = 'button';
    streamBtn.className = 'btn btn-sm';
    streamBtn.textContent = 'View all events';
    streamBtn.title = 'Switch to Stream filtered to this tool';
    streamBtn.addEventListener('click', () => _deps.onJumpToStream(node.platformId));
    content.appendChild(streamBtn);

    const toolViewBtn = document.createElement('button');
    toolViewBtn.type = 'button';
    toolViewBtn.className = 'btn btn-sm';
    toolViewBtn.textContent = 'Open in Tool view';
    toolViewBtn.title = 'Switch to Grouped/Tool view at this tool';
    toolViewBtn.addEventListener('click', () => _deps.onJumpToToolView(node.platformId));
    content.appendChild(toolViewBtn);

    if (typeof _deps.onCopyNode === 'function') {
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn btn-sm';
      copyBtn.textContent = 'Copy node';
      copyBtn.title = 'Copy this tool + its parent + children as Markdown';
      copyBtn.addEventListener('click', () => _deps.onCopyNode(graph, node.platformId));
      content.appendChild(copyBtn);
    }
  });
}

// Render one row in the Session activity event-name list. Each row
// shows the tool's platform pill, the event name, and an `×N` count,
// and is clickable as a quick filter (Stream filtered to tool + event
// name).
function buildSessionActivityRow(platformId, eventName, count) {
  const row = document.createElement('div');
  row.className = 'script-dep-tree-node depth-0 clickable stack-activity-event-row';
  row.setAttribute('role', 'button');
  row.tabIndex = 0;
  row.title = `Filter Stream to ${eventName} on this tool`;

  const pill = document.createElement('span');
  pill.className = `event-platform ${platformId}`;
  pill.dataset.platform = platformId;
  pill.appendChild(svgFromString(getPlatformIcon(platformId)));
  const pillText = document.createElement('span');
  pillText.className = 'platform-text';
  pillText.textContent = _deps.getPlatformName(platformId) || platformId;
  pill.appendChild(pillText);
  row.appendChild(pill);

  const nameEl = document.createElement('span');
  nameEl.className = 'stack-activity-event-name-text';
  nameEl.textContent = eventName;
  row.appendChild(nameEl);

  const countEl = document.createElement('span');
  countEl.className = 'stack-activity-event-count';
  countEl.textContent = `×${count}`;
  row.appendChild(countEl);

  const handler = () => {
    if (typeof _deps.onJumpToStreamForEventName === 'function') {
      _deps.onJumpToStreamForEventName(platformId, eventName);
    } else {
      _deps.onJumpToStream(platformId);
    }
  };
  row.addEventListener('click', handler);
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
  });

  return row;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeToolLink(label, platformId) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'stack-tool-link';
  btn.textContent = label;
  btn.addEventListener('click', () => _deps.onSelectTool(platformId));
  return btn;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function makeSvg(...children) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  for (const [tag, attrs] of children) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.appendChild(el);
  }
  return svg;
}
