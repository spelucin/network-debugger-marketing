// @ts-check
/**
 * AI Context Serializer — single source of truth for the JSON shape
 * consumed by AI features:
 *
 *   1. BYOK AI Infrastructure (#40) — in-panel prompts
 *   2. External AI Bridge (#42) — folder export files
 *
 * The serializer is PURE: it takes events + helpers and returns a snapshot
 * object. It imports nothing from panel code, never touches chrome.*, and
 * never reads global state. All platform-specific data (display names,
 * category info, consent checks) comes in via the `helpers` param so the
 * same module can run in DevTools panel, service worker, or unit tests.
 *
 * Schema changes MUST bump SCHEMA_VERSION. Consumers (BYOK prompts,
 * external AI tools reading bridge files) rely on this version to know
 * what fields to expect.
 */

export const SCHEMA_VERSION = 2;

/**
 * Consent verdict as returned by the panel's getConsentCheckForEvent()
 * (the `_consentCheck` cache shape — see shared/event-shape.js).
 * @typedef {Object} ConsentCheckResult
 * @property {string|null} [status]
 * @property {Object<string, string>} [categories]
 * @property {string} [source]
 * @property {string} [sourceLabel]
 * @property {string} [cmp]
 * @property {string} [category] - Required consent category for the platform.
 * @property {string} [severity]
 */

/**
 * Platform-specific accessors injected by the caller (DevTools panel,
 * service worker, or tests) so this module stays pure.
 * @typedef {Object} SerializerHelpers
 * @property {(platformId: string) => { id?: string, name?: string }} [getCategoryInfo]
 * @property {(event: import('../event-shape.js').CapturedEvent) => ConsentCheckResult|null} [getConsentCheckForEvent]
 * @property {Map<string, number>} [idMap] - Maps internal UUID → integer id.
 */

/**
 * One event in the snapshot's flat `events` array (schema v2 output shape).
 * @typedef {Object} SerializedEvent
 * @property {number|string} id
 * @property {string} platform
 * @property {string} category
 * @property {number} timestamp
 * @property {string} [eventName]
 * @property {string} [method]
 * @property {string} [url]
 * @property {number|string} [status]
 * @property {number} [durationMs]
 * @property {string} [pageId]
 * @property {boolean} [isPageLoad]
 * @property {boolean} [isScriptLoad]
 * @property {{ params: Object }} [formatted]
 * @property {SerializedConsent} [consent]
 * @property {{ type: string, url?: string, platform?: string }} [scriptInitiator]
 */

/**
 * Per-event consent block in the snapshot (schema v2 output shape).
 * @typedef {Object} SerializedConsent
 * @property {string} status
 * @property {Object<string, string>} [categories]
 * @property {string} [source]
 * @property {string} [sourceLabel]
 * @property {string} [cmp]
 * @property {string} [requiredCategory]
 * @property {string} [severity]
 */

/**
 * One consent-timeline entry in the snapshot (schema v2 output shape).
 * @typedef {Object} SerializedConsentEntry
 * @property {number} timestamp
 * @property {string} [source]
 * @property {string} [cmp]
 * @property {string} [action]
 * @property {import('../event-shape.js').ConsentCategories} [categories]
 * @property {string} [completeness]
 * @property {number|string} [eventId]
 */

/**
 * One node of the snapshot's script dependency tree (schema v2 output shape).
 * @typedef {Object} ScriptTreeNode
 * @property {number|string} id
 * @property {string} platform
 * @property {string} script - Filename (or hostname / full URL fallback).
 * @property {string|null} url
 * @property {string|null} initiatorType
 * @property {number} timestamp
 * @property {Array<ScriptTreeNode>} [children]
 */

/**
 * Serialize a single captured event to the flat AI-context shape.
 * Unlike `buildFullExportEvent` in copy-export.js (which wraps events in
 * an `eventDebugger` object for clipboard consumers), this produces a
 * top-level flat event so AI tools can iterate without nested lookups.
 *
 * @param {import('../event-shape.js').CapturedEvent} event - captured event from state.events (shape contract: shared/event-shape.js, #135 WP2)
 * @param {string|null} [pageId] - parent page id (e.g. "page-1") or null
 * @param {SerializerHelpers} [helpers]
 * @returns {SerializedEvent} flat serialized event
 */
export function serializeEvent(event, pageId, helpers = {}) {
  /** @type {{ id?: string, name?: string }} */
  const categoryInfo = helpers.getCategoryInfo?.(event.platform) || {};
  const category = categoryInfo.id
    || (typeof categoryInfo.name === 'string' ? categoryInfo.name.toLowerCase() : null)
    || 'unknown';

  const id = helpers.idMap?.get(event.id) ?? event.id;
  /** @type {SerializedEvent} */
  const out = {
    id,
    platform: event.platform,
    category,
    timestamp: event.timestamp,
  };

  if (event.eventName) out.eventName = event.eventName;
  if (event.raw?.method) out.method = event.raw.method;
  if (event.raw?.url) out.url = event.raw.url;
  if (event.status != null) out.status = event.status;
  if (event.finishTimestamp && event.finishTimestamp !== event.timestamp) {
    out.durationMs = event.finishTimestamp - event.timestamp;
  }
  if (pageId) out.pageId = pageId;
  if (event.isNavigation || event.platform === 'pages') out.isPageLoad = true;
  if (event.isScriptLoad) out.isScriptLoad = true;

  // Formatted payload — keep only `params` (the decoded request payload
  // including POST bodies, batched GA4, base64 Amplitude, form-decoded
  // bodies). Dropped in v2: `sections` (UI grouping the AI can rebuild
  // from params), `consentSignals` (redundant with per-event `consent`),
  // `eventName` (redundant with top-level `eventName`).
  if (event.formatted && typeof event.formatted === 'object') {
    if (event.formatted.params !== undefined) {
      out.formatted = { params: event.formatted.params };
    }
  }

  // Consent — skip exempt (events that don't need a consent check, e.g.
  // CMP telemetry itself). Non-exempt checks always include a status.
  const check = helpers.getConsentCheckForEvent?.(event);
  if (check && check.status && check.status !== 'exempt') {
    /** @type {SerializedConsent} */
    const c = { status: check.status };
    if (check.categories) c.categories = { ...check.categories };
    if (check.source) c.source = check.source;
    if (check.sourceLabel) c.sourceLabel = check.sourceLabel;
    if (check.cmp) c.cmp = check.cmp;
    if (check.category) c.requiredCategory = check.category;
    if (check.severity) c.severity = check.severity;
    out.consent = c;
  }

  // Script initiator — only set when the event knows how it was loaded.
  const initiatorType = event.formatted?.initiatorType || event.raw?.initiatorType;
  if (initiatorType) {
    /** @type {{ type: string, url?: string, platform?: string }} */
    const si = { type: initiatorType };
    const initiatorUrl = event.formatted?.initiatorUrl || event.raw?.initiatorUrl;
    if (initiatorUrl) si.url = initiatorUrl;
    if (event.formatted?.initiatorPlatform) si.platform = event.formatted.initiatorPlatform;
    out.scriptInitiator = si;
  }

  return out;
}

/**
 * Group events into pages by navigation markers. Events captured before
 * the first page load are prepended to the first page group (mirrors
 * `groupEventsByPage` in components/event-list.js). Pure — self-contained.
 *
 * @param {Array<import('../event-shape.js').CapturedEvent>} sortedEvents
 * @returns {Array<{ page: import('../event-shape.js').CapturedEvent, events: Array<import('../event-shape.js').CapturedEvent> }>}
 */
function groupByPage(sortedEvents) {
  // Precondition (#131 F10): caller passes a chronologically-sorted array —
  // buildAiContextSnapshot() sorts once at its entry point.
  const sorted = sortedEvents;
  /** @type {Array<{ page: import('../event-shape.js').CapturedEvent, events: Array<import('../event-shape.js').CapturedEvent> }>} */
  const pages = [];
  const orphans = [];
  let currentPage = null;
  let currentEvents = [];

  for (const ev of sorted) {
    const isPageLoad = ev.isNavigation || ev.platform === 'pages';
    if (isPageLoad) {
      if (currentPage) {
        pages.push({ page: currentPage, events: currentEvents });
      } else if (currentEvents.length > 0) {
        orphans.push(...currentEvents);
      }
      currentPage = ev;
      currentEvents = [];
    } else {
      currentEvents.push(ev);
    }
  }
  if (currentPage) {
    pages.push({ page: currentPage, events: currentEvents });
  } else if (currentEvents.length > 0) {
    orphans.push(...currentEvents);
  }

  if (orphans.length > 0 && pages.length > 0) {
    pages[0].events = [...orphans, ...pages[0].events];
  }
  return pages;
}

/**
 * Serialize the consent timeline (CMP/gtag signals + state markers).
 * Keeps timestamp, source, action, categories — drops UI-only fields.
 *
 * @param {Array<import('../event-shape.js').ConsentTimelineEntry>} timeline
 * @param {Map<string, number>} [idMap] - maps internal UUID → integer id (v2 schema)
 * @returns {Array<SerializedConsentEntry>}
 */
export function serializeConsentTimeline(timeline, idMap) {
  if (!Array.isArray(timeline)) return [];
  return timeline.map((entry) => {
    /** @type {SerializedConsentEntry} */
    const out = { timestamp: entry.timestamp ?? 0 };
    if (entry.source) out.source = entry.source;
    if (entry.cmp) out.cmp = entry.cmp;
    if (entry.action) out.action = entry.action;
    if (entry.categories) out.categories = { ...entry.categories };
    if (entry.completeness) out.completeness = entry.completeness;
    if (entry.eventId) out.eventId = idMap?.get(entry.eventId) ?? entry.eventId;
    return out;
  });
}

/**
 * Build a script dependency tree from captured script-load events.
 * Mirrors the logic in copy-export.js `copyAllScriptTreeAsJSON()` but
 * produces a reduced per-node shape suitable for AI consumption.
 *
 * @param {Array<import('../event-shape.js').CapturedEvent>} events - all captured events (script loads filtered internally)
 * @param {Map<string, number>} [idMap] - maps internal UUID → integer id (v2 schema)
 * @returns {{ rootScripts: Array<ScriptTreeNode> }}
 */
export function buildScriptTree(events, idMap) {
  const scripts = events.filter((e) => e.isScriptLoad);
  if (scripts.length === 0) return { rootScripts: [] };

  /** @type {Map<string, import('../event-shape.js').CapturedEvent>} */
  const urlToEvent = new Map();
  for (const e of scripts) {
    const url = e.formatted?.scriptUrl || e.raw?.url;
    if (url) urlToEvent.set(url, e);
  }

  /** @type {Map<string, Array<import('../event-shape.js').CapturedEvent>>} */
  const children = new Map();
  /** @type {Set<string>} */
  const hasParent = new Set();
  for (const e of scripts) {
    const initType = e.formatted?.initiatorType || e.raw?.initiatorType;
    const initUrl = e.formatted?.initiatorUrl || e.raw?.initiatorUrl;
    if ((initType === 'script' || initType === 'tagmanager') && initUrl && urlToEvent.has(initUrl)) {
      const list = children.get(initUrl) || [];
      list.push(e);
      children.set(initUrl, list);
      hasParent.add(e.id);
    }
  }

  const roots = scripts
    .filter((e) => !hasParent.has(e.id))
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  /**
   * @param {import('../event-shape.js').CapturedEvent} ev
   * @returns {ScriptTreeNode}
   */
  const buildNode = (ev) => {
    const url = ev.formatted?.scriptUrl || ev.raw?.url || null;
    let script = 'unknown';
    if (url) {
      try {
        const u = new URL(url);
        script = u.pathname.split('/').pop() || u.hostname;
      } catch {
        script = url;
      }
    }
    /** @type {ScriptTreeNode} */
    const node = {
      id: idMap?.get(ev.id) ?? ev.id,
      platform: ev.platform,
      script,
      url,
      initiatorType: ev.formatted?.initiatorType || ev.raw?.initiatorType || null,
      timestamp: ev.timestamp,
    };
    const kids = url ? children.get(url) : null;
    if (kids && kids.length > 0) node.children = kids.map(buildNode);
    return node;
  };

  return { rootScripts: roots.map(buildNode) };
}

/**
 * Build the full AI-context snapshot. This is the canonical shape written
 * to disk by the External AI Bridge and fed into BYOK AI prompts.
 *
 * @param {Object} input
 * @param {Array<import('../event-shape.js').CapturedEvent>} [input.events] - captured events (state.events)
 * @param {Array<import('../event-shape.js').ConsentTimelineEntry>} [input.consentTimeline] - consent timeline (state.consentTimeline)
 * @param {{ name?: string, version?: string }} [input.generator] - extension identity
 * @param {{ startedAt?: string }} [input.session] - session override
 * @param {SerializerHelpers} [input.helpers] - passed through to serializeEvent
 * @returns {Object} snapshot with { schemaVersion, exportedAt, generator, session, pages, events, consentTimeline, scriptTree }
 */
export function buildAiContextSnapshot({
  events = [],
  consentTimeline = [],
  session = {},
  generator,
  helpers = {},
} = {}) {
  const exportedAt = new Date().toISOString();
  const gen = {
    name: generator?.name || 'Event Watcher',
    version: generator?.version || 'unknown',
  };

  // Sort once (#131 F10) — groupByPage, id assignment, and the flat-events
  // fallback all need the same chronological order; previously each re-sorted.
  const chronological = [...events].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  const pageGroups = groupByPage(chronological);

  // Build UUID → integer id map. IDs are assigned in the same chronological
  // order used for the flat `events` array below, so page-load events get
  // their id before their child events. This keeps cross-references (pages,
  // scriptTree) compact and readable for AI consumers.
  /** @type {Map<string, number>} */
  const idMap = new Map();
  let nextId = 1;
  /** @param {import('../event-shape.js').CapturedEvent|undefined} ev */
  const assignId = (ev) => {
    if (ev && ev.id && !idMap.has(ev.id)) {
      idMap.set(ev.id, nextId++);
    }
  };
  if (pageGroups.length > 0) {
    for (const pg of pageGroups) {
      assignId(pg.page);
      for (const ev of pg.events) assignId(ev);
    }
  } else {
    for (const ev of chronological) assignId(ev);
  }
  const serializerHelpers = { ...helpers, idMap };

  /** @type {Array<{ id: string, url: string|null, pageLoadEventId: number|string, startedAt: string|null, events: Array<number|string> }>} */
  const pages = [];
  /** @type {Map<string, string>} */
  const eventToPageId = new Map();
  pageGroups.forEach((pg, i) => {
    const pageId = `page-${i + 1}`;
    /** @type {string|null} */
    let url = null;
    try {
      url = pg.page.raw?.url || pg.page.formatted?.url || null;
    } catch {
      url = null;
    }
    pages.push({
      id: pageId,
      url,
      pageLoadEventId: idMap.get(pg.page.id) ?? pg.page.id,
      startedAt: pg.page.timestamp ? new Date(pg.page.timestamp).toISOString() : null,
      events: pg.events.map((e) => idMap.get(e.id) ?? e.id),
    });
    eventToPageId.set(pg.page.id, pageId);
    pg.events.forEach((e) => eventToPageId.set(e.id, pageId));
  });

  // Flat events — include page-load events so their ids stay referenceable
  // from the `pages` array. Order: chronological.
  const flatEvents = [];
  if (pageGroups.length > 0) {
    for (const pg of pageGroups) {
      flatEvents.push(serializeEvent(pg.page, eventToPageId.get(pg.page.id), serializerHelpers));
      for (const ev of pg.events) {
        flatEvents.push(serializeEvent(ev, eventToPageId.get(ev.id) || null, serializerHelpers));
      }
    }
  } else {
    // No page loads captured — emit events with null pageId
    for (const ev of chronological) flatEvents.push(serializeEvent(ev, null, serializerHelpers));
  }

  // Session — prefer caller-provided startedAt, fall back to earliest event
  const firstTs = events.length > 0
    ? events.reduce((min, e) => (e.timestamp && e.timestamp < min ? e.timestamp : min), Infinity)
    : null;
  /** @type {Set<string>} */
  const domains = new Set();
  for (const pg of pageGroups) {
    try {
      const u = new URL(pg.page.raw?.url || '');
      if (u.hostname) domains.add(u.hostname);
    } catch {
      // skip unparseable URLs
    }
  }

  const sess = {
    startedAt: session.startedAt || (firstTs && firstTs !== Infinity ? new Date(firstTs).toISOString() : null),
    domains: [...domains],
    pageLoads: pageGroups.length,
    eventCount: events.length,
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    generator: gen,
    session: sess,
    pages,
    events: flatEvents,
    consentTimeline: serializeConsentTimeline(consentTimeline, idMap),
    scriptTree: buildScriptTree(events, idMap),
  };
}
