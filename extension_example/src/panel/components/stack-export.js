// Stack export builders — Markdown, Mermaid, SVG, structured Stack JSON.
// Each builder takes the graph from buildStackGraph() and a name resolver,
// returning a string (Markdown, Mermaid DSL), a serialized SVG, or a JSON
// stringification of the stack with attribution metadata.
//
// MartechStack Builder import JSON ships in a sibling module
// (../reactflow-export.js); the import schema is governed by
// docs/REACT-FLOW-MARTECHSTACK-BUILDER-JSON-IMPORT-SPEC.md, and redistribution
// of the MartechStack Builder vendor catalogue inside this export is permitted
// by the MartechStack Builder team.

let _deps;

export function initStackExport(deps) {
  _deps = deps;
}

/**
 * Build a Markdown bullet-tree representation.
 * - <hostname>
 *   - GTM
 *     - GA4
 *     - Meta Pixel
 *   - Hotjar
 */
export function buildStackMarkdown(graph) {
  if (!graph) return '';
  const lines = [];
  lines.push(`# Martech Stack — ${graph.rootDomain || '(unknown site)'}`);
  lines.push('');
  lines.push(`- ${graph.root.label}`);
  for (const child of graph.root.children) {
    appendMarkdownNode(child, 1, lines);
  }
  return lines.join('\n');
}

function appendMarkdownNode(node, depth, lines, seen = new Set()) {
  // Defense-in-depth cycle guard (N9, #139) — the tree is acyclic by
  // construction, but a re-parenting regression would otherwise hang the export.
  if (seen.has(node.platformId)) return;
  seen.add(node.platformId);
  const indent = '  '.repeat(depth);
  const name = _deps.getPlatformName(node.platformId) || node.platformId;
  const categoryId = _deps.getPlatformCategory(node.platformId);
  const categoryName = _deps.PLATFORM_CATEGORIES?.[categoryId]?.name || categoryId || '';
  const meta = [];
  if (categoryName) meta.push(categoryName);
  if (node.requestCount) meta.push(`${node.requestCount} requests`);
  if (node.loaderType === 'unknown') meta.push('loader unknown');
  const suffix = meta.length ? ` _(${meta.join(', ')})_` : '';
  lines.push(`${indent}- **${name}**${suffix}`);
  for (const child of node.children) {
    appendMarkdownNode(child, depth + 1, lines, seen);
  }
}

/**
 * Build a Mermaid `flowchart LR` representation.
 * Left-to-right reads as data flow: site → loaders → tools (matches the way
 * users describe a martech stack). Renders natively in GitHub, Notion, GitLab,
 * and most modern Markdown previewers.
 */
export function buildStackMermaid(graph) {
  if (!graph) return '';
  const lines = ['flowchart LR'];
  const rootId = 'site';
  const rootLabel = sanitizeMermaidLabel(graph.root.label);
  lines.push(`  ${rootId}["🌐 ${rootLabel}"]`);

  let counter = 0;
  const idFor = new Map();
  const ensureId = (platformId) => {
    if (!idFor.has(platformId)) {
      idFor.set(platformId, `n${counter++}`);
    }
    return idFor.get(platformId);
  };

  // Declare each node first.
  for (const node of graph.nodes.values()) {
    const id = ensureId(node.platformId);
    const name = sanitizeMermaidLabel(_deps.getPlatformName(node.platformId) || node.platformId);
    const categoryId = _deps.getPlatformCategory(node.platformId);
    const categoryName = _deps.PLATFORM_CATEGORIES?.[categoryId]?.name || categoryId || '';
    const sub = categoryName ? `<br/><small>${sanitizeMermaidLabel(categoryName)}</small>` : '';
    lines.push(`  ${id}["${name}${sub}"]`);
  }

  // Edges from root to top-level nodes.
  for (const child of graph.root.children) {
    lines.push(`  ${rootId} --> ${ensureId(child.platformId)}`);
  }

  // Edges from each parent to its children.
  for (const node of graph.nodes.values()) {
    const parentId = ensureId(node.platformId);
    for (const child of node.children) {
      lines.push(`  ${parentId} --> ${ensureId(child.platformId)}`);
    }
  }

  return lines.join('\n');
}

function sanitizeMermaidLabel(text) {
  if (!text) return '';
  // Mermaid labels inside `["..."]` mostly tolerate text, but quotes and
  // square brackets break the syntax. Replace with similar-looking glyphs.
  return String(text)
    .replace(/"/g, '”')
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .replace(/\n/g, ' ');
}

/**
 * Snapshot the rendered Stack tree DOM as a serialised SVG document.
 * Strategy: walk the in-DOM tree (.stack-tree-container) and lay out a
 * minimal SVG with platform names + connecting lines. We draw fresh rather
 * than serialising the DOM because the tree is HTML, not SVG.
 */
export function buildStackSvg(graph) {
  if (!graph) return '';

  // Layout pass — assign each node an (x, y) position.
  const nodeBoxW = 180;
  const nodeBoxH = 40;
  const xGap = 40;
  const yGap = 16;
  const padX = 20;
  const padY = 20;

  const positioned = []; // [{ id, label, x, y, parentId|null }]
  let cursorY = padY;

  const place = (node, depth, parentId, seen = new Set()) => {
    // Defense-in-depth cycle guard (N9, #139).
    const nodeKey = node.isRoot ? '__root__' : node.platformId;
    if (seen.has(nodeKey)) return;
    seen.add(nodeKey);
    const x = padX + depth * (nodeBoxW + xGap);
    const y = cursorY;
    cursorY += nodeBoxH + yGap;
    const label = node.isRoot
      ? graph.root.label
      : (_deps.getPlatformName(node.platformId) || node.platformId);
    const id = node.isRoot ? '__root__' : node.platformId;
    positioned.push({ id, label, x, y, parentId });
    const children = node.children || [];
    for (const child of children) {
      place(child, depth + 1, id, seen);
    }
  };
  place(graph.root, 0, null);

  // SVG output dimensions.
  const maxX = positioned.reduce((m, n) => Math.max(m, n.x + nodeBoxW), 0);
  const maxY = positioned.reduce((m, n) => Math.max(m, n.y + nodeBoxH), 0);
  const width = maxX + padX;
  const height = maxY + padY;

  const lines = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="-apple-system, system-ui, sans-serif" font-size="13">`);
  lines.push(`  <title>Martech Stack — ${escapeXml(graph.rootDomain || 'unknown site')}</title>`);

  // Edges first (so nodes draw on top).
  const byId = new Map(positioned.map(n => [n.id, n]));
  for (const node of positioned) {
    if (!node.parentId) continue;
    const parent = byId.get(node.parentId);
    if (!parent) continue;
    const x1 = parent.x + nodeBoxW;
    const y1 = parent.y + nodeBoxH / 2;
    const x2 = node.x;
    const y2 = node.y + nodeBoxH / 2;
    const midX = (x1 + x2) / 2;
    lines.push(`  <path d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}" fill="none" stroke="#9ca3af" stroke-width="1.5"/>`);
  }

  // Nodes.
  for (const node of positioned) {
    const isRoot = node.id === '__root__';
    const fill = isRoot ? '#1f2937' : '#ffffff';
    const stroke = isRoot ? '#1f2937' : '#cbd5e1';
    const textColor = isRoot ? '#ffffff' : '#0f172a';
    lines.push(`  <rect x="${node.x}" y="${node.y}" width="${nodeBoxW}" height="${nodeBoxH}" rx="8" ry="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`);
    lines.push(`  <text x="${node.x + nodeBoxW / 2}" y="${node.y + nodeBoxH / 2 + 4}" fill="${textColor}" text-anchor="middle">${escapeXml(node.label)}</text>`);
  }

  lines.push(`</svg>`);
  return lines.join('\n');
}

function escapeXml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build a Markdown snippet for a single node — used by "Copy node"
 * in the Tool detail panel. Includes the parent and immediate children.
 */
export function buildStackNodeMarkdown(graph, platformId) {
  const node = graph?.nodes?.get(platformId);
  if (!node) return '';
  const lines = [];
  const name = _deps.getPlatformName(platformId) || platformId;
  let parentLabel = graph.rootDomain || 'site root';
  if (node.parentPlatformId && graph.nodes.has(node.parentPlatformId)) {
    parentLabel = _deps.getPlatformName(node.parentPlatformId) || node.parentPlatformId;
  }
  lines.push(`- **${name}**`);
  lines.push(`  - Parent: ${parentLabel}`);
  if (node.children.length > 0) {
    lines.push(`  - Children:`);
    for (const child of node.children) {
      const childName = _deps.getPlatformName(child.platformId) || child.platformId;
      lines.push(`    - ${childName}`);
    }
  }
  return lines.join('\n');
}

/**
 * Build a structured JSON dump of the captured stack. Suitable for
 * pasting into AI chats, support tickets, GitHub issues, or any
 * downstream tool that wants the full attribution picture. Includes
 * the rendered tree shape, every node's derivation inputs
 * (firstScriptUrl, parentPlatformId, loaderType, push-source breakdown,
 * sample events with their initiator metadata), and the script-
 * initiator map entries that drove parent attribution. URLs are scoped
 * to the current site; no user-typed text is included.
 *
 * @param {Object} graph - graph from buildStackGraph
 * @param {Array} events - state.events
 * @param {Map} scriptInitiatorMap - state.scriptInitiatorMap
 * @returns {string} pretty-printed JSON
 */
export function buildStackJSON(graph, events = [], scriptInitiatorMap = new Map()) {
  if (!graph) return '{}';

  const eventById = new Map();
  for (const ev of events) eventById.set(ev.id, ev);

  const summarizeEvent = (ev) => {
    if (!ev) return null;
    return {
      id: ev.id,
      platform: ev.platform,
      eventName: ev.eventName,
      timestamp: ev.timestamp,
      isScriptLoad: !!ev.isScriptLoad,
      isNavigation: !!ev.isNavigation,
      url: ev.raw?.url || null,
      scriptUrl: ev.formatted?.scriptUrl || null,
      initiatorType: ev.formatted?.initiatorType || ev.raw?.initiatorType || null,
      initiatorUrl: ev.formatted?.initiatorUrl || ev.raw?.initiatorUrl || null,
    };
  };

  // Per-platform debug record — everything that fed into parent attribution
  // plus a sample of the events that contributed to the node.
  const nodes = [];
  const sampleSize = 5;
  for (const node of graph.nodes.values()) {
    const sampleEvents = node.eventIds.slice(0, sampleSize).map((id) => summarizeEvent(eventById.get(id)));
    nodes.push({
      platformId: node.platformId,
      categoryId: _deps.getPlatformCategory(node.platformId),
      parentPlatformId: node.parentPlatformId,
      loaderType: node.loaderType,
      firstScriptUrl: node.firstScriptUrl,
      firstSeenAt: Number.isFinite(node.firstSeenAt) ? node.firstSeenAt : null,
      firstPageHost: node.firstPageHost || null,
      requestCount: node.requestCount,
      scriptLoadCount: node.scriptLoadCount,
      childPlatformIds: node.children.map((c) => c.platformId),
      alsoLoadedBy: node.alsoLoadedBy || [],
      eventNameCounts: node.eventNameCounts,
      pushSources: node.pushSources || {},
      sampleEvents,
      sampleEventCountTotal: node.eventIds.length,
    });
  }

  // Tree shape — what the user sees, abstracted to (platformId, children[]).
  // Defense-in-depth cycle guard (N9, #139): nodes are keyed uniquely by
  // platformId, so a repeat means a re-parenting bug — emit a [cycle] stub
  // rather than recurse forever.
  const treeShape = (node, seen = new Set()) => {
    const key = node.isRoot ? '__root__' : node.platformId;
    if (seen.has(key)) {
      return { platformId: key, label: '[cycle]', children: [] };
    }
    seen.add(key);
    return {
      platformId: key,
      label: node.isRoot ? node.label : (_deps.getPlatformName(node.platformId) || node.platformId),
      children: (node.children || []).map((c) => treeShape(c, seen)),
    };
  };

  // Initiator-map sample relevant to this stack — only entries whose URL
  // or initiatorUrl resolves to a captured platform.
  const platformUrls = new Set();
  for (const ev of events) {
    if (ev.platform && graph.nodes.has(ev.platform)) {
      const url = ev.formatted?.scriptUrl || ev.raw?.url;
      if (url) platformUrls.add(url);
    }
  }
  const initiatorEntries = [];
  for (const [url, info] of scriptInitiatorMap.entries()) {
    if (platformUrls.has(url) || (info?.initiatorUrl && platformUrls.has(info.initiatorUrl))) {
      initiatorEntries.push({ scriptUrl: url, ...info });
    }
  }

  const payload = {
    meta: {
      schema: 'event-watcher-stack/v1',
      generatedAt: new Date().toISOString(),
      rootDomain: graph.rootDomain || null,
      nodeCount: graph.nodes.size,
      eventCount: events.length,
      initiatorMapSize: scriptInitiatorMap.size,
    },
    treeShape: treeShape(graph.root),
    nodes,
    initiatorEntries,
  };

  return safeStringify(payload, { space: 2 });
}

/**
 * Generic "download a string as a file" helper.
 */
export function downloadString(filename, mimeType, content) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
