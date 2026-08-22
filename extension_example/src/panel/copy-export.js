// Copy/export functions extracted from panel.js
// Handles clipboard operations, table/JSON/HAR export, and script tree copy.
// Dependencies are injected via initCopyExport().

import { getCMPCategoryName, GCM_SIGNAL_NAMES } from '../shared/detection/parsers/index.js';
import { MSG } from '../shared/messages.js';
import { safeStringify } from '../shared/json-safe.js';

// Dependencies injected by panel.js via initCopyExport()
let _deps;

// Monotonic counter for the AI export bridge (Feature #81 Phase 1).
// Combined with Date.now() into an exportId so the page-side
// `[ew-export] <id>` console sentinel is unique even for rapid successive
// exports within the same millisecond.
let _aiExportSeq = 0;

// Auto-publish mode (Feature #81 Phase 2 — dev-only convenience).
// When enabled, every captured event triggers a debounced republish of the
// all-events-ai payload to the page-script global. Switched on in panel.js
// when `chrome.management.getSelf().installType === 'development'` so the MCP
// can poll `window.__eventWatcher.lastAIExport` without the human-in-the-loop
// "Copy for AI" click. CWS installs leave this disabled.
let _aiExportAutoPublish = false;
let _aiExportAutoTimer = null;
const AI_EXPORT_AUTO_DEBOUNCE_MS = 500;

/** Enable / disable auto-publish. Called by panel.js after resolving installType. */
export function setAIExportAutoPublish(enabled) {
  _aiExportAutoPublish = !!enabled;
  if (!enabled && _aiExportAutoTimer) {
    clearTimeout(_aiExportAutoTimer);
    _aiExportAutoTimer = null;
  }
}

/**
 * Read the auto-publish flag. Used by panel.js to gate MCP-mode-only behaviour
 * like clearing the event list on cross-domain navigation — a sweep that
 * doesn't reset between URLs would accumulate events from 50 sites in one panel.
 */
export function isAIExportAutoPublishEnabled() {
  return _aiExportAutoPublish;
}

/**
 * Notify the bridge that the event list changed. Schedules a debounced
 * republish if auto-publish is enabled; no-op otherwise. Called from
 * panel.js's addEvent() (and other event-list mutators like clearEvents).
 *
 * Reuses `buildAIExportV4Output` so the auto-published payload is byte-for-byte
 * the same shape Copy for AI emits — diffing two consecutive snapshots is
 * meaningful.
 */
export function notifyEventListChanged() {
  if (!_aiExportAutoPublish) return;
  if (_aiExportAutoTimer) clearTimeout(_aiExportAutoTimer);
  _aiExportAutoTimer = setTimeout(() => {
    _aiExportAutoTimer = null;
    try {
      const events = _deps.getEventsForExport ? _deps.getEventsForExport() : [];
      const sortedEvents = [...events].sort(_deps.compareEventsAsc);
      const state = _deps.getState ? _deps.getState() : {};
      const mc = countEventsForMeta(sortedEvents);
      // build-and-publish-only; clipboard untouched
      buildAIExportV4Output(sortedEvents, {
        scopeType: 'all-events-ai',
        mode: 'clipboard',  // applies the standard caps so the auto payload mirrors a real Copy-for-AI click
        sessionMeta: {
          view: state.viewMode,
          pages: mc?.pageMarkers || 0,
          intr: mc?.interactionMarkers || 0,
          auto: true,  // exposed via _export.auto so MCP-side diffs can tell auto from manual
        },
      });
    } catch (e) { /* never break event ingestion */ }
  }, AI_EXPORT_AUTO_DEBOUNCE_MS);
}

/**
 * Publish a freshly built "Copy for AI" payload to the inspected tab's
 * page-scoped `window.__eventWatcher.lastAIExport` global. Service worker
 * dev-gates the relay (installType === 'development') — on CWS installs
 * this fires-and-forgets without reaching the page.
 *
 * Feature #81 Phase 1 — the maintainer-side regression-testing bridge.
 * No behaviour change for end users; the existing Copy for AI clipboard
 * write is unchanged.
 */
function publishAIExportToPage(payload, scopeType) {
  try {
    const tabId = chrome.devtools?.inspectedWindow?.tabId;
    if (!tabId) return;
    const ts = Date.now();
    const exportId = `${ts}-${++_aiExportSeq}`;
    chrome.runtime.sendMessage({
      type: MSG.PUBLISH_AI_EXPORT,
      tabId,
      ts,
      exportId,
      scopeType: scopeType || null,
      payload,
    }).catch(() => { /* fire-and-forget */ });
  } catch (e) { /* never break Copy for AI */ }
}

// Export settings (configurable via settings panel)
let _exportToFile = false;      // true = save as .json file instead of clipboard

// Per-tool warning thresholds. The user picks an "AI tool target" in Settings,
// which controls when the large-export warning fires. "off" subsumes the old
// disable-warning toggle — picking it is the same as disabling warnings entirely.
//
// Thresholds reflect approximate inline-paste ceilings before AI tool web apps
// convert pastes to file attachments (chat-input UI behaviour, not model context).
const EXPORT_WARNING_THRESHOLDS = {
  strict:    25_000,           // ChatGPT Free
  standard:  50_000,           // ChatGPT Plus / Pro (default — preserves prior behaviour)
  relaxed:   80_000,           // Claude (any plan) / Gemini
  generous: 150_000,           // Claude Enterprise / large-context tools
  off:      Number.POSITIVE_INFINITY,  // never warn
};

// Display metadata for each AI tool target — surfaced in the Compare formats
// modal so the user can see what they're currently sized for and recognise
// whether it matches the tool they actually paste into.
const AI_TOOL_TARGET_META = {
  strict:   { name: 'Strict',    short: '25K',  tool: 'ChatGPT Free' },
  standard: { name: 'Standard',  short: '50K',  tool: 'ChatGPT Plus / Pro' },
  relaxed:  { name: 'Relaxed',   short: '80K',  tool: 'Claude (any plan) / Gemini' },
  generous: { name: 'Generous',  short: '150K', tool: 'Claude Enterprise / large-context' },
  off:      { name: 'Off',       short: 'no warning', tool: 'API or trusted tool' },
};

let _exportWarningTarget = 'standard';

/** Set whether exports go to file instead of clipboard */
export function setExportToFile(enabled) { _exportToFile = enabled; }

/**
 * Set the AI tool target that controls the export warning threshold.
 * Accepts: 'strict' | 'standard' | 'relaxed' | 'generous' | 'off'.
 * Falls back to 'standard' for unknown values so callers don't need to validate.
 */
export function setExportWarningTarget(target) {
  _exportWarningTarget = Object.prototype.hasOwnProperty.call(EXPORT_WARNING_THRESHOLDS, target)
    ? target
    : 'standard';
}

/**
 * Initialize copy/export module with dependencies from panel.js.
 * Must be called after state is defined but before any context menu is triggered.
 * @param {Object} deps
 * @param {Function} deps.getState - Returns the state object (read-only access to state.events)
 * @param {Function} deps.getFilteredEvents - Get currently visible/filtered events
 * @param {Function} deps.getEventsForExport - Returns pinned-domain events in Pinned mode, otherwise getFilteredEvents()
 * @param {Function} deps.getPinnedSnapshotById - Look up a stored pin snapshot by id + domain (Pinned-view fallback for cleared events)
 * @param {Function} deps.getPinnedSnapshotByIdAcrossDomains - Look up a stored pin snapshot across every domain (cross-site Pinned-view fallback)
 * @param {Function} deps.getCurrentPinDomain - Returns the registrable domain DevTools is currently inspecting
 * @param {Function} deps.getPinnedRecordsForDomain - Returns full pinned records (with groupIds) for a domain
 * @param {Function} deps.getGroupsForDomain - Returns user-created group definitions for a domain
 * @param {Function} deps.getPinnedRecordsForDomain - Returns the list of pinned records for a domain
 * @param {Function} deps.getPageEvents - Get events for a specific page navigation
 * @param {Function} deps.getCategoryInfo - Category info lookup for a platform
 * @param {Function} deps.getCategoryForPlatform - Category ID lookup for a platform
 * @param {Object} deps.PLATFORM_CATEGORIES - Category display names
 * @param {Object} deps.PLATFORM_NAMES - Tool display names
 * @param {Function} deps.compareEventsAsc - Sort events chronologically
 * @param {Function} deps.getContextMenuScriptTree - Getter for contextMenuScriptTree
 * @param {Function} deps.getContextMenuScriptEventId - Getter for contextMenuScriptEventId
 * @param {Function} deps.getConsentCheckForEvent - Get consent check result for an event
 * @param {Function} deps.isConsentCheckEnabled - Whether consent check is enabled
 * @param {Function} deps.getGCMCategoriesAtTime - Get GCM categories at a given timestamp
 * @param {Function} deps.getConsentTimeline - Get the consent timeline array
 * @param {Function} deps.getConsentStateMarkers - Get deduplicated consent state markers
 * @param {Function} [deps.getUnknownHostnames] - Returns sorted snapshot of `state.unknownHosts` (Feature #87 — emitted into AI export as `tools_unknown_hostnames` so MCP regression sweeps can harvest unknown-platform candidates without having to read the panel's internal state).
 * @param {Function} [deps.getAssumedPairs] - Returns the same `"<platformId> | <hostname>"` array (feature #70) that panel.js sends to Amplitude in `devtool_page.tools_assumed`. Emitted into AI export as `tools_assumed` so MCP regression sweeps can harvest structural-fingerprint `(platformId, host)` pairs as Extend candidates — feature #94.
 */
export function initCopyExport(deps) {
  _deps = deps;
}

/**
 * Build consent JSON for an event (returns null if consent check disabled or no data).
 * Used by both single-event and multi-event JSON exports.
 */
function buildConsentJSON(event) {
  if (!_deps.isConsentCheckEnabled?.()) return null;
  const check = _deps.getConsentCheckForEvent?.(event);
  if (!check || check.status === 'exempt') return null;

  const consent = {};

  // Normalized consent categories (granted/denied per category)
  if (check.categories) {
    consent.categories = { ...check.categories };
  }

  // Source that determined this consent check
  if (check.source) {
    consent.source = check.source;
  }

  // Violation info — only emit when there's an actual violation. Absence
  // of `violation` in the output means `false` (no violation). Downstream
  // consumers all use truthy / `=== true` checks, so omitting the field
  // is safe and removes ~25 chars × every clean event from the export.
  const isViolation = check.status === 'denied' || check.status === 'pre-consent' || check.status === 'unknown';
  if (isViolation) {
    consent.violation = true;
    consent.violationDetails = {
      status: check.status,
      requiredCategory: check.category,
    };
    if (check.severity) {
      consent.violationDetails.severity = check.severity;
    }
  }

  return consent;
}

/**
 * Build comprehensive consent debug JSON for AI-assisted QA.
 * Includes event identity, consent check result, CMP/GCM comparison, raw signals, and timing.
 * Always returns an object (even when no consent data — that itself is useful for debugging).
 */
export function buildConsentDebugJSON(event) {
  const platformName = _deps.PLATFORM_NAMES[event.platform] || event.platform;
  const categoryInfo = _deps.getCategoryInfo(event.platform);

  // Event identity — just enough to know what was flagged
  const output = {
    event: {
      tool: platformName,
      event: event.eventName || 'Unknown',
      category: categoryInfo.name,
    }
  };
  if (event.raw?.url) output.event.url = event.raw.url;
  if (event.raw?.method) output.event.method = event.raw.method;
  if (event.raw?.type) output.event.resourceType = event.raw.type;
  output.event.timestamp = new Date(event.timestamp).toISOString();

  // Consent check result
  const check = _deps.getConsentCheckForEvent?.(event);
  if (!check) {
    output.consentCheck = { status: 'no_consent_data' };
    return output;
  }

  const checkObj = { status: check.status };
  if (check.severity) checkObj.severity = check.severity;
  if (check.category) checkObj.requiredCategory = check.category;
  if (check.categoryLabel) checkObj.requiredCategoryLabel = check.categoryLabel;
  if (check.source) checkObj.source = check.source;
  if (check.sourceLabel) checkObj.sourceLabel = check.sourceLabel;
  if (check.cmp) checkObj.cmp = check.cmp;
  output.consentCheck = checkObj;

  // Consent state — per-category CMP/GCM comparison
  if (check.status !== 'exempt') {
    const cmpCategories = check.cmp && check.cmp !== 'Google Consent Mode' ? check.categories : null;
    const gcmCategories = _deps.getGCMCategoriesAtTime?.(event.timestamp)
      || (check.cmp === 'Google Consent Mode' ? check.categories : null);

    if (cmpCategories || gcmCategories) {
      const consentState = { categories: {} };
      const categoryOrder = ['analytics', 'marketing', 'functional'];
      let mismatches = 0;

      for (const cat of categoryOrder) {
        const entry = {};
        if (cmpCategories?.[cat]) {
          entry.cmpState = cmpCategories[cat];
          const cmpName = check.cmp ? getCMPCategoryName(check.cmp, cat) : null;
          if (cmpName) entry.cmpName = cmpName;
        }
        if (gcmCategories?.[cat]) {
          entry.gcmState = gcmCategories[cat];
          entry.gcmSignal = GCM_SIGNAL_NAMES[cat] || null;
        }
        if (entry.cmpState && entry.gcmState && entry.cmpState !== entry.gcmState) {
          entry.mismatch = true;
          mismatches++;
        }
        if (check.category === cat) entry.isRequired = true;
        if (Object.keys(entry).length > 0) {
          consentState.categories[cat] = entry;
        }
      }

      consentState.mismatches = mismatches;
      output.consentState = consentState;
    }
  }

  // Raw consent signals on the event itself (GCS/GCD/NPA)
  // Extract from URL query string since formatted.params may be grouped/labelled
  const rawSignals = {};
  try {
    const url = new URL(event.raw?.url || '');
    const sp = url.searchParams;
    if (sp.has('gcs')) rawSignals.gcs = sp.get('gcs');
    if (sp.has('gcd')) rawSignals.gcd = sp.get('gcd');
    if (sp.has('npa')) rawSignals.npa = sp.get('npa');
  } catch { /* invalid URL or no URL */ }
  if (Object.keys(rawSignals).length > 0) {
    output.rawSignals = rawSignals;
  }

  // Timing context
  const timeline = _deps.getConsentTimeline?.() || [];
  const firstConsentTs = timeline.length > 0 ? timeline.find(e => e.timestamp > 0)?.timestamp : null;
  const timing = {
    eventFiredAt: new Date(event.timestamp).toISOString(),
  };
  if (firstConsentTs) {
    timing.firstConsentAt = new Date(firstConsentTs).toISOString();
    timing.firedAfterConsent = event.timestamp >= firstConsentTs;
  } else {
    timing.firstConsentAt = null;
    timing.firedAfterConsent = false;
  }
  timing.consentEntriesInTimeline = timeline.length;
  output.timing = timing;

  return output;
}

// Copy consent JSON for a single event
export function copyEventConsent(eventId) {
  const event = _deps.getState().events.find(e => e.id === eventId);
  if (!event) {
    copyToClipboard(JSON.stringify({ error: 'Event not found' }, null, 2));
    return;
  }

  const json = buildConsentDebugJSON(event);
  const mc = countEventsForMeta([event]);
  copyJsonWithMeta(json, 'single-event-consent', mc);
}

export function formatTimeForExport(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// Format datetime for export header
export function formatDateTimeForExport(timestamp) {
  const date = new Date(timestamp);
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Build GTM intercept metadata for an event (returns null if no intercept rule was active).
 * Included in JSON exports so recipients know when a container was blocked, swapped, or previewed.
 */
function buildInterceptJSON(event) {
  const action = event.formatted?.interceptAction;
  if (!action) return null;
  if (action === 'replaced') {
    return {
      action: 'swapped',
      originalId: event.formatted.interceptOriginalId || null,
      replacementId: event.formatted.interceptReplacementId || null
    };
  }
  if (action === 'blocked') return { action: 'blocked' };
  if (action === 'swap_failed') {
    return {
      action: 'swap_failed',
      replacementId: event.formatted.interceptReplacementId || null
    };
  }
  if (action === 'preview') return { action: 'preview' };
  if (action === 'swapped_away') {
    return {
      action: 'swapped_away',
      replacementId: event.formatted.interceptReplacementId || null
    };
  }
  return null;
}

// Extract detection pattern from detectedBy field (only for URL-based detection)
// Returns null for non-URL detections (dataLayer, script loads, etc.)
export function getDetectionPattern(event) {
  const detectedBy = event.formatted?.detectedBy;
  if (!detectedBy || typeof detectedBy !== 'string') return null;

  // Only include URL-based detections
  if (!detectedBy.startsWith('URL ')) return null;

  // Extract the pattern part after the colon, or use the whole string
  // e.g., "URL contains facebook.com/tr" -> "URL contains facebook.com/tr"
  // e.g., "URL matches known pattern: /pagead/landing" -> "URL matches known pattern: /pagead/landing"
  return detectedBy;
}

// Count event types and consent violations for export metadata
function countEventsForMeta(events) {
  let pageMarkers = 0, interactionMarkers = 0, consentViolations = 0;
  const uniqueTools = new Set();

  for (const e of events) {
    if (e.isNavigation || e.platform === 'pages') {
      pageMarkers++;
    } else if (e.isInteraction) {
      interactionMarkers++;
    } else {
      if (e.platform) uniqueTools.add(e.platform);
      const consent = buildConsentJSON(e);
      if (consent?.violation) consentViolations++;
    }
  }

  return {
    eventCount: events.length,
    pageMarkers,
    interactionMarkers,
    consentViolations,
    uniqueTools: uniqueTools.size
  };
}

// Per-event truncation defaults (clipboard mode only; file mode is never truncated).
// Tuned to keep typical stream exports under common AI-tool input limits without
// dropping events. Layer 1 = array/string caps, Layer 2 = whole-event size cap.
//
// stringCharCap is intentionally aggressive (200 chars) because tracking values
// over ~200 chars are almost always opaque tokens — session IDs, hashes, UAs,
// fingerprint blobs, marketing-cloud blobs — none of which carry analytics signal
// for AI-assisted QA. Real customer-meaningful strings (page titles, eVar values,
// product names) virtually always fit under 200.
const TRUNCATE_DEFAULTS = {
  arrayItemCap: 20,
  stringCharCap: 200,
  eventCharCap: 5000,
};

// Per-event `rawParams` size budget for "Copy for Human" exports. Over budget
// → emit a `_truncated` stub pointing at Copy JSON / Copy Complete instead of
// the full payload. Keeps the Human export readable when an unparsed event
// carries a truly oversized body (the canonical case: AppDynamics adrum's
// ~10k of browser RUM telemetry — pure noise for analytics QA).
//
// Threshold tuning: classical analytics / advertising / a-b-testing / cdp /
// tag-manager / widgets payloads all stay well under 6000 chars even on the
// heaviest captures observed (the worst-case Snapchat PAGE_VIEW with full
// ctx + req body lands at ~5.6k). Setting the cap at 6000 means tracking
// tools are never stubbed — only obvious outliers (typically monitoring or
// session-replay telemetry) get the truncation marker. A future refinement
// could lower the cap per category once we have data on how monitoring /
// session-replay payloads look across many sites; for now keep it uniform
// so we don't over-generalise from a single trace.
const HUMAN_RAW_PARAMS_CAP = 6000;

// (Deleted: `EXPORT_SCHEMA_HINTS` and the `includeSchemaHints` opt-in. The
// six entries it carried (`all-events-optimized` / `*-properties`, and the
// page / single / group variants) were tied to the v1 AI export's verbose
// schema. v4 (the only AI export now) builds its own self-describing
// `_export` header inside `buildAIExportV4Output` — legend + notes + limits +
// truncation_hint + omitted_fields all live there. Non-AI exports
// ("Copy for Human", "Copy Complete", etc.) never used the hints.)

/**
 * Recursively truncate strings (over stringCharCap) and arrays (over arrayItemCap).
 * Mutates `state.modified` to true if any cap was hit. Returns a new value (input untouched).
 */
function truncatePayloadValue(value, limits, state) {
  if (typeof value === 'string') {
    if (value.length > limits.stringCharCap) {
      state.modified = true;
      return value.slice(0, limits.stringCharCap)
        + `… [+${value.length - limits.stringCharCap} chars truncated]`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    // Cycle guard: page dataLayer payloads can echo a ref back to an ancestor
    // (obj.self = obj). Without this, the recursion stack-overflows before any
    // serialization runs (N1, feature #139). Track ancestors on a path-scoped
    // WeakSet — add on enter, remove on exit — so true cycles short-circuit
    // while harmless diamond refs (same object in two sibling slots) survive.
    if (!state.ancestors) state.ancestors = new WeakSet();
    if (state.ancestors.has(value)) return '[Circular]';
    state.ancestors.add(value);
    let result;
    if (value.length > limits.arrayItemCap) {
      state.modified = true;
      const kept = value.slice(0, limits.arrayItemCap).map(v => truncatePayloadValue(v, limits, state));
      kept.push({ _truncated_items: value.length - limits.arrayItemCap });
      result = kept;
    } else {
      result = value.map(v => truncatePayloadValue(v, limits, state));
    }
    state.ancestors.delete(value);
    return result;
  }
  if (value && typeof value === 'object') {
    if (!state.ancestors) state.ancestors = new WeakSet();
    if (state.ancestors.has(value)) return '[Circular]';
    state.ancestors.add(value);
    const out = {};
    for (const k of Object.keys(value)) {
      out[k] = truncatePayloadValue(value[k], limits, state);
    }
    state.ancestors.delete(value);
    return out;
  }
  return value;
}

/**
 * Apply Layer 1 (array/string caps) and Layer 2 (whole-event cap) to each event.
 * Returns { events, manifest } — manifest lists every truncated event for `_export.truncated`.
 */
function applyEventTruncation(events, limits) {
  const TRUNCATABLE_FIELDS = ['properties', 'rawParams', 'push', 'computedState'];
  const manifest = [];

  const truncatedEvents = events.map(eventObj => {
    const cloned = { ...eventObj };

    // Layer 1: array/string caps inside truncatable fields
    let layer1Modified = false;
    for (const field of TRUNCATABLE_FIELDS) {
      if (cloned[field] != null) {
        const state = { modified: false };
        cloned[field] = truncatePayloadValue(cloned[field], limits, state);
        if (state.modified) layer1Modified = true;
      }
    }

    // Layer 2: whole-event size cap. If still over budget, drop body fields entirely.
    const json = safeStringify(cloned);
    if (json.length > limits.eventCharCap) {
      const stub = { ...cloned };
      for (const field of TRUNCATABLE_FIELDS) delete stub[field];
      stub._truncated = {
        originalSize: json.length,
        reason: 'event_size_cap',
        hint: 'Right-click this event row in the stream and pick "Copy JSON" for the full untruncated payload.',
      };
      manifest.push({
        order: cloned.order,
        tool: cloned.tool,
        event: cloned.event,
        originalSize: json.length,
        reason: 'event_size_cap',
      });
      return stub;
    }

    if (layer1Modified) {
      manifest.push({
        order: cloned.order,
        tool: cloned.tool,
        event: cloned.event,
        reason: 'array_or_string_cap',
      });
    }
    return cloned;
  });

  return { events: truncatedEvents, manifest };
}

// Build standardized _export metadata header for JSON exports
function buildExportMeta(exportType, options = {}) {
  const manifest = chrome.runtime.getManifest();
  const state = _deps.getState();

  // `targetTool` was previously emitted here but is only meaningful for the
  // AI export (which sizes its payload to fit a target). Human / Complete /
  // Table / Full dataLayer don't truncate, so the field is noise on those.
  // The v4 AI builder emits its own `_export.target` inline and doesn't go
  // through this helper, so dropping it here is safe.
  const meta = {
    generator: manifest.name,
    version: manifest.version,
    exportedAt: new Date().toISOString(),
    exportType,
    viewMode: state.viewMode,
  };

  if (options.url) meta.url = options.url;

  meta.counts = {
    events: options.eventCount || 0,
    pageMarkers: options.pageMarkers || 0,
    interactionMarkers: options.interactionMarkers || 0,
    consentMarkers: options.consentMarkers != null
      ? options.consentMarkers
      : (_deps.getConsentStateMarkers?.() || []).length,
    consentViolations: options.consentViolations || 0,
    uniqueTools: options.uniqueTools || 0,
  };

  // Truncation reporting — only present when caps were applied.
  if (options.limits) meta.limits = options.limits;
  if (Array.isArray(options.truncatedManifest) && options.truncatedManifest.length > 0) {
    meta.truncated = options.truncatedManifest;
  }

  return meta;
}

// Serialize JSON with _export metadata header and approximate character count.
// `metaOptions.compact` switches off pretty-print (no indent) — used by the
// optimized export to maximise content density under AI input limits.
// `metaOptions.truncatedManifest` (when present and non-empty) is forwarded to the
// toast so the user can see "(N events truncated)" without parsing the body.
function copyJsonWithMeta(jsonOutput, exportType, metaOptions = {}) {
  const meta = buildExportMeta(exportType, metaOptions);
  const output = { _export: meta, ...jsonOutput };
  const indent = metaOptions.compact ? 0 : 2;
  // Single pass (#131 F8): serialize once with a 0 placeholder, then patch the
  // measured length in. `characters` is documented as approximate — the patched
  // value is off by the count's own digit width. The placeholder match is safe:
  // `_export` is the first key serialized, so the first occurrence is always ours.
  meta.characters = 0;
  let finalJson = safeStringify(output, { space: indent });
  meta.characters = finalJson.length;
  const placeholder = indent ? '"characters": 0' : '"characters":0';
  const patched = placeholder.replace('0', String(meta.characters));
  finalJson = finalJson.replace(placeholder, patched);
  const truncatedCount = Array.isArray(metaOptions.truncatedManifest)
    ? metaOptions.truncatedManifest.length
    : 0;
  copyToClipboard(finalJson, { truncatedCount });
}

// Copy page events as table format
// ─── Markdown table emission (Copy Markdown Table) ─────────────────────────
// All three Table entry points (`copyAllEventsAsTable`, `copyPageEventsAsTable`,
// `copyEventsAsTable`) emit GitHub-flavoured Markdown with a YAML frontmatter
// block at the top for machine readers, an H1 + bolded metadata block for
// human readers, and a pipe-table of events. Markdown renders in every modern
// doc tool (GitHub / Notion / Confluence / Slack / Claude / ChatGPT / Gemini);
// plain text reads acceptably too. Columns: `# | Category | Tool | Event | Δ`.
// Wall-clock time deliberately dropped — the summary header carries the
// capture timestamp, and Δ shows the spacing between events.
//
// Schema version `markdown-table-v2` — v1 was the legacy fixed-width
// plain-text format. Bump the version (-v3, -v4) when columns change, cells
// gain escape rules, or the summary structure changes — consumers can gate
// their parser on `schema` in the YAML frontmatter.
const MARKDOWN_TABLE_SCHEMA = 'markdown-table-v2';

// Format a millisecond span as a compact human-readable string.
function formatMsSpan(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '0ms';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

// Escape pipe / newline characters that would otherwise break the Markdown
// table cell boundaries. Replace newlines with a single space so the cell
// stays on its row.
//
// Formula-injection guard (F2): a cell whose value begins with =, +, -, or @
// is interpreted as a formula when an exported table is pasted into Excel /
// Google Sheets (the classic CSV-injection class). Captured event data is
// page-controlled (event names, params, URLs), so neutralise a leading trigger
// with a single quote — the canonical spreadsheet text-forcing prefix — before
// escaping. Any future CSV exporter MUST reuse this guard (or this function).
function escapeMarkdownCell(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (/^[=+\-@]/.test(str)) str = `'${str}`;
  return str.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ');
}

// Extract the hostname from a URL. Returns null on parse failure.
function extractDomainFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try { return new URL(url).hostname; } catch (e) { return null; }
}

// Build the Markdown pipe-table from a sorted event list. Caller owns the
// summary header above and the optional trailer below. `opts.omitDelta` drops
// the Δ column — used by Pinned exports where the events come from disparate
// sessions and "ms since first pin" isn't a meaningful column.
function buildMarkdownEventTable(sortedEvents, firstEventTime, opts = {}) {
  const omitDelta = !!opts.omitDelta;
  let out = omitDelta
    ? '| # | Category | Tool | Event |\n|---|----------|------|-------|\n'
    : '| # | Category | Tool | Event | Δ |\n|---|----------|------|-------|---|\n';
  for (let i = 0; i < sortedEvents.length; i++) {
    const event = sortedEvents[i];
    const categoryId = _deps.getCategoryForPlatform(event.platform);
    const category = _deps.PLATFORM_CATEGORIES[categoryId];
    const categoryName = escapeMarkdownCell(category?.name || categoryId || 'Unknown');
    const tool = escapeMarkdownCell(event.platformName || event.platform || 'unknown');
    const eventName = escapeMarkdownCell(event.eventName || 'Unknown');
    if (omitDelta) {
      out += `| ${i + 1} | ${categoryName} | ${tool} | ${eventName} |\n`;
    } else {
      const delta = i === 0 ? '0ms' : `+${event.timestamp - firstEventTime}ms`;
      out += `| ${i + 1} | ${categoryName} | ${tool} | ${eventName} | ${delta} |\n`;
    }
  }
  return out;
}

// Escape a YAML scalar value. Quotes strings that contain reserved chars
// (`: ` or `#` or leading whitespace or `&` `*` `?` `|` `-` `<` `>` `=` `!`
// `%` `@` `` ` ``) or that look like other YAML types (numbers / bools / null).
// Numbers and booleans pass through unquoted.
function yamlScalar(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const s = String(value);
  if (s === '') return '""';
  // Always quote when the string contains a colon-space, a hash, control
  // chars, or characters that have YAML meaning at the start.
  const needsQuote = /[:#\n\r\t]| #|^[\s&*?|<>=!%@`-]|^(true|false|null|yes|no|on|off|\d)/i.test(s);
  if (needsQuote) {
    // Use double quotes; escape backslashes and double quotes.
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

// Build a YAML frontmatter block with generator + schema + scope + counts.
// Inserted at the top of multi-event exports for machine readers (Obsidian /
// Hugo / Jekyll / VS Code / AI tools that parse frontmatter). Skipped for
// single-event exports — overkill for a one-row paste.
function buildYamlFrontmatter(opts) {
  const manifest = chrome.runtime.getManifest();
  const lines = ['---'];
  lines.push(`generator: ${yamlScalar(manifest.name)}`);
  lines.push(`version: ${yamlScalar(manifest.version)}`);
  lines.push(`schema: ${yamlScalar(MARKDOWN_TABLE_SCHEMA)}`);
  lines.push(`scope: ${yamlScalar(opts.scope)}`);
  lines.push(`exported_at: ${yamlScalar(opts.exportedAt)}`);
  if (opts.domain) lines.push(`domain: ${yamlScalar(opts.domain)}`);
  if (opts.pagePath) lines.push(`page_path: ${yamlScalar(opts.pagePath)}`);
  if (opts.pageUrl) lines.push(`page_url: ${yamlScalar(opts.pageUrl)}`);
  if (typeof opts.eventCount === 'number') lines.push(`event_count: ${opts.eventCount}`);
  if (typeof opts.uniqueTools === 'number') lines.push(`unique_tools: ${opts.uniqueTools}`);
  if (typeof opts.spanMs === 'number') lines.push(`span_ms: ${opts.spanMs}`);
  if (typeof opts.pages === 'number' && opts.pages > 0) lines.push(`pages: ${opts.pages}`);
  if (typeof opts.groups === 'number' && opts.groups > 0) lines.push(`groups: ${opts.groups}`);
  if (typeof opts.consentViolations === 'number') lines.push(`consent_violations: ${opts.consentViolations}`);
  lines.push('---', '');
  return lines.join('\n');
}

// Build the H1 + bolded metadata block that sits above the table. `opts`
// carries the scope-specific fields. For single-event scope (1 event in a
// group export) we skip the summary entirely — caller just emits the table.
function buildMarkdownSummary(opts) {
  const {
    title,
    captureTime,
    domain,
    pageUrl,
    eventCount,
    uniqueTools,
    spanMs,
    pages,
    violations,
  } = opts;

  const lines = [`# ${title}`, ''];

  // Human-visible attribution — mirrors the YAML frontmatter `generator` /
  // `version` / `schema` fields for readers who don't have a Markdown engine
  // that renders the frontmatter.
  const manifest = chrome.runtime.getManifest();
  lines.push(`_Generated by ${manifest.name} v${manifest.version} · Schema: ${MARKDOWN_TABLE_SCHEMA}_`);
  lines.push('');

  const ctxParts = [];
  if (captureTime) ctxParts.push(`**Captured:** ${captureTime}`);
  if (domain) ctxParts.push(`**Domain:** ${domain}`);
  if (pageUrl) ctxParts.push(`**URL:** ${escapeMarkdownCell(pageUrl)}`);
  if (ctxParts.length > 0) lines.push(ctxParts.join(' · '));

  const statParts = [];
  if (typeof eventCount === 'number') statParts.push(`**${eventCount} events**`);
  if (typeof uniqueTools === 'number' && uniqueTools > 0) statParts.push(`**${uniqueTools} tools**`);
  if (typeof spanMs === 'number') statParts.push(`**${formatMsSpan(spanMs)}** span`);
  if (typeof pages === 'number' && pages > 1) statParts.push(`**${pages} pages**`);
  if (typeof violations === 'number') {
    statParts.push(violations > 0 ? `**${violations} consent violations**` : '0 consent violations');
  }
  if (statParts.length > 0) lines.push(statParts.join(' · '));

  lines.push('', '');
  return lines.join('\n');
}

export function copyPageEventsAsTable(pageEventId) {
  const { page, events } = _deps.getPageEvents(pageEventId);
  if (!page || events.length === 0) {
    copyToClipboard('No events captured for this page.');
    return;
  }

  const pagePath = page.eventName || page.raw?.url || '/';
  const pageUrl = page.raw?.url || page.formatted?.url || null;
  const captureTime = formatDateTimeForExport(page.timestamp);
  const sortedEvents = [...events].sort(_deps.compareEventsAsc);
  const firstEventTime = sortedEvents[0].timestamp;
  const lastEventTime = sortedEvents[sortedEvents.length - 1].timestamp;
  const mc = countEventsForMeta(sortedEvents);
  const spanMs = lastEventTime - firstEventTime;
  const domain = extractDomainFromUrl(pageUrl);

  const frontmatter = buildYamlFrontmatter({
    scope: 'page-events',
    exportedAt: new Date().toISOString(),
    domain,
    pagePath,
    pageUrl: pageUrl || null,
    eventCount: events.length,
    uniqueTools: mc.uniqueTools,
    spanMs,
    consentViolations: mc.consentViolations,
  });
  const summary = buildMarkdownSummary({
    title: `Event Watcher — Page: ${escapeMarkdownCell(pagePath)}`,
    captureTime,
    domain,
    pageUrl: pageUrl || null,
    eventCount: events.length,
    uniqueTools: mc.uniqueTools,
    spanMs,
    violations: mc.consentViolations,
  });
  const table = buildMarkdownEventTable(sortedEvents, firstEventTime);
  copyToClipboard(frontmatter + summary + table);
}

// Copy page events as JSON format
export function copyPageEventsAsJSON(pageEventId) {
  const { page, events } = _deps.getPageEvents(pageEventId);
  if (!page || events.length === 0) {
    copyToClipboard(JSON.stringify({ error: 'No events captured for this page.' }, null, 2));
    return;
  }

  const pagePath = page.eventName || page.raw?.url || '/';
  const pageUrl = page.raw?.url || page.formatted?.url || null;
  const captureTime = new Date(page.timestamp).toISOString();
  const firstEventTime = events[0].timestamp;

  // Sort events by timestamp (with pushIndex as tiebreaker)
  const sortedEvents = [...events].sort(_deps.compareEventsAsc);

  const jsonOutput = {
    page: pagePath,
    url: pageUrl,
    captured: captureTime,
    eventCount: events.length,
    events: sortedEvents.map((event, index) =>
      buildSimpleEventObj(event, index, firstEventTime)
    ),
  };

  const mc = countEventsForMeta(sortedEvents);
  copyJsonWithMeta(jsonOutput, 'page-events', { url: pageUrl, ...mc });
}

// Build a curated `properties` object for "Copy for Human" — only the parser's
// analytics-relevant sections (Event Data, Custom Data, Consent Mode, Event
// Properties, E-Commerce, Push) plus the dataLayer push payload.
//
// Diagnostic sections are identified by the `diagnostic: true` flag set by
// individual parsers (currently only Tealium tags Browser / Tags / Performance
// Timing / Full Data Layer / utag_data State as diagnostic). New parsers
// default to non-diagnostic — if you add a section that's a debug dump rather
// than analytics-relevant data, mark it `diagnostic: true` on the section
// object and Basic will skip it automatically. AI Ready and Complete keep
// every section regardless of the flag.
//
// Basic also does NOT fall back to raw params for unparsed events. Mental
// model: Basic = what was tracked; if you need the raw payload use Complete.
function buildPropertiesForBasic(event) {
  const props = {};

  const sections = event?.formatted?.sections;
  if (Array.isArray(sections) && sections.length) {
    for (const section of sections) {
      if (!section || section.type !== 'table' || !section.data) continue;
      if (section.diagnostic === true) continue;
      const data = section.data;
      const hasContent = Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0;
      if (!hasContent) continue;
      const title = section.title || 'Section';
      props[title] = data;
    }
  }

  const pushData = event?.formatted?.pushData;
  if (pushData && typeof pushData === 'object' && !Array.isArray(pushData) && Object.keys(pushData).length > 0) {
    props['Push'] = pushData;
  }

  return Object.keys(props).length > 0 ? props : null;
}

// Build parser-normalized `properties` (and fallback `rawParams`) for an event.
// Returns { properties, rawParams } — either side may be null; omit the key when null.
// `properties` uses the parser's Custom Data / Consent Mode / E-Commerce / Event Properties
// sections so the export matches what the user sees in the detail view. For dataLayer
// events (which have no parser sections), `formatted.pushData` is surfaced as a `Push`
// section so JSON-with-Properties carries the actual push payload.
// Used by AI Ready and (with rawParams fallback) for unparsed events.
function buildPropertiesForExport(event) {
  const out = { properties: null, rawParams: null };
  const props = {};

  // Same diagnostic filter as Basic — diagnostic sections are debug dumps (full
  // dataLayer state, perf timing, browser fingerprint, Tealium ss.* session
  // passthroughs) and including them in AI Ready blows past the per-event size
  // cap, which truncates the WHOLE event to a stub and the AI sees nothing.
  // Keeping the export curated means Tealium Collect events fit under the cap
  // and the AI sees the actual tracked payload. Users wanting diagnostic data
  // should use Copy Complete (which uses raw event.raw, not this builder).
  const sections = event?.formatted?.sections;
  if (Array.isArray(sections) && sections.length) {
    for (const section of sections) {
      if (!section || section.type !== 'table' || !section.data) continue;
      if (section.diagnostic === true) continue;
      const data = section.data;
      const hasContent = Array.isArray(data) ? data.length > 0 : Object.keys(data).length > 0;
      if (!hasContent) continue;
      const title = section.title || 'Section';
      props[title] = data;
    }
  }

  const pushData = event?.formatted?.pushData;
  if (pushData && typeof pushData === 'object' && !Array.isArray(pushData) && Object.keys(pushData).length > 0) {
    props['Push'] = pushData;
  }

  if (Object.keys(props).length > 0) out.properties = props;

  // Fallback only when nothing surfaced — keeps unparsed network platforms useful.
  if (!out.properties) {
    const raw = event?.raw || {};
    const fallback = {};
    if (raw.params && typeof raw.params === 'object' && Object.keys(raw.params).length > 0) {
      fallback.params = raw.params;
    }
    let body = null;
    if (raw.postData && typeof raw.postData === 'object') {
      body = raw.postData;
    } else if (typeof raw.postData === 'string') {
      try { body = JSON.parse(raw.postData); } catch { /* non-JSON body — skip */ }
    }
    if (body && (Array.isArray(body) ? body.length > 0 : Object.keys(body).length > 0)) {
      fallback.postData = body;
    }
    if (Object.keys(fallback).length > 0) out.rawParams = fallback;
  }

  return out;
}

// Copy page events as JSON with parser-normalized event properties.
// Sibling of copyPageEventsAsJSON — same top-level shape, each event augmented with
// `properties` (from formatted.sections) or `rawParams` (fallback for unparsed events).
// Copy events under one page marker — page-scoped "Copy for AI".
// Emits the v4 sparse-object AI schema (see `buildAIExportV4Output`),
// adding `page` (path) and `url` to the _export header for context.
export function copyPageEventsWithProperties(pageEventId) {
  const { page, events } = _deps.getPageEvents(pageEventId);
  if (!page || events.length === 0) {
    copyToClipboard(JSON.stringify({ error: 'No events captured for this page.' }, null, 2));
    return;
  }
  const sortedEvents = [...events].sort(_deps.compareEventsAsc);
  const { jsonString, truncatedManifestCount } = buildAIExportV4Output(sortedEvents, {
    scopeType: 'page-events-ai',
    mode: _exportToFile ? 'file' : 'clipboard',
    sessionMeta: {
      page: page.eventName || page.raw?.url || '/',
      url: page.raw?.url || page.formatted?.url || null,
    },
  });
  copyToClipboard(jsonString, { truncatedCount: truncatedManifestCount });
}

// Copy dataLayer events with push data and computed states as JSON
export function copyDataLayerAsJSON(pageEventId) {
  const { page, events } = _deps.getPageEvents(pageEventId);
  if (!page || events.length === 0) {
    copyToClipboard(JSON.stringify({ error: 'No events captured for this page.' }, null, 2));
    return;
  }

  const pagePath = page.eventName || page.raw?.url || '/';
  const pageUrl = page.raw?.url || page.formatted?.url || null;
  const captureTime = new Date(page.timestamp).toISOString();

  // Filter to only dataLayer events (datalayer and gtm platforms)
  const dataLayerEvents = events.filter(e =>
    e.platform === 'datalayer' || e.platform === 'gtm'
  ).sort(_deps.compareEventsAsc);

  if (dataLayerEvents.length === 0) {
    copyToClipboard(JSON.stringify({
      page: pagePath,
      url: pageUrl,
      captured: captureTime,
      message: 'No dataLayer events captured for this page.'
    }, null, 2));
    return;
  }

  const jsonOutput = {
    page: pagePath,
    url: pageUrl,
    captured: captureTime,
    dataLayerEventCount: dataLayerEvents.length,
    dataLayerEvents: dataLayerEvents.map((event, index) => {
      const eventObj = {
        pushIndex: event.formatted?.pushIndex || index + 1,
        event: event.eventName || 'dataLayer.push',
        time: formatTimeForExport(event.timestamp),
        isHistorical: event.formatted?.isHistorical || false,
        isGTMInternal: event.formatted?.isGTMInternalEvent || false,
        stateSource: event.raw?._stateSource || 'computed',
        push: event.formatted?.pushData || event.raw?._pushData || {},
        computedState: event.formatted?.dataLayerState || event.raw?._dataLayerState || {}
      };

      return eventObj;
    }),
    // Also include the final computed state (last event's state)
    finalComputedState: dataLayerEvents.length > 0
      ? (dataLayerEvents[dataLayerEvents.length - 1].formatted?.dataLayerState ||
         dataLayerEvents[dataLayerEvents.length - 1].raw?._dataLayerState || {})
      : {}
  };

  const mc = countEventsForMeta(dataLayerEvents);
  copyJsonWithMeta(jsonOutput, 'page-datalayer', { url: pageUrl, ...mc });
}

// ========================================
// Full Export (raw data + consent timeline + markers)
// ========================================

// Prefixes in _utag_data that repeat identically on every Tealium event.
// Only _eventData carries per-event payload — the rest is page-level state.
const UTAG_DATA_STRIP_PREFIXES = [
  'cp.',        // cookie values (already captured by consent parsing)
  'meta.',      // HTML meta tags
  'dom.',       // DOM state (referrer, title, url)
  'ut.',        // Tealium internals
  'tealium_',   // Tealium session/visitor data
  'ls.',        // localStorage dumps
  'config_',    // TMS config flags
  'wa_site_',   // site-level constants
  'cookie_',    // consent cookie config
  'adobe_',     // Adobe config (reportsuite, cname)
  'aep_config_', // AEP datastream config
];

// Strip repeated page-level fields from _utag_data, keeping only event-specific data
function cleanUtagData(utagData) {
  if (!utagData || typeof utagData !== 'object') return utagData;
  const cleaned = {};
  for (const key of Object.keys(utagData)) {
    if (UTAG_DATA_STRIP_PREFIXES.some(p => key.startsWith(p))) continue;
    cleaned[key] = utagData[key];
  }
  return cleaned;
}

// Strip bloat from raw data for Full Export:
// - Remove _har (headers, timings, cookies — very large)
// - Simplify initiator stacks (keep type + url only)
// - Strip repeated page-level fields from Tealium _utag_data/_eventData
// - Remove _rawDataLayerArray (full dataLayer history — each push already has its own timeline entry)
function cleanRawForExport(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  const cleaned = {};
  for (const key of Object.keys(raw)) {
    if (key === '_har') continue;
    if (key === '_rawDataLayerArray') continue; // Full DL history — redundant, each push is its own event
    if (key === 'initiator') {
      // Simplify initiator: keep type but drop deep stack frames
      const init = raw.initiator;
      if (init && typeof init === 'object') {
        cleaned.initiator = { type: init.type };
        if (init.url) cleaned.initiator.url = init.url;
        if (init.lineNumber != null) cleaned.initiator.lineNumber = init.lineNumber;
      }
      continue;
    }
    // Strip repeated page-level fields from Tealium dataLayer snapshots.
    // Both _utag_data and _eventData contain the full enriched data layer on view events.
    if (key === '_utag_data' || key === '_eventData') {
      cleaned[key] = cleanUtagData(raw[key]);
      continue;
    }
    cleaned[key] = raw[key];
  }
  return cleaned;
}

// Build a full-export event object (raw data + detailed consent) — shared by page and all-events
function buildFullExportEvent(event, firstEventTime, prevState) {
  const platformName = _deps.PLATFORM_NAMES[event.platform] || event.platform;
  const categoryInfo = _deps.getCategoryInfo(event.platform);

  const eventObj = {
    eventDebugger: {
      tool: platformName,
      event: event.eventName || 'Unknown',
      category: categoryInfo.name,
      timestamp: new Date(event.timestamp).toISOString(),
      time: formatTimeForExport(event.timestamp),
      deltaMs: event.timestamp - firstEventTime
    },
    raw: cleanRawForExport(event.raw)
  };

  // User comment (Feature #50) — session-scoped note attached in the Overview card.
  // Absent-when-empty: omit the field entirely rather than emitting null/''.
  if (typeof event.userComment === 'string' && event.userComment.trim().length > 0) {
    eventObj.userComment = event.userComment;
  }

  if (event.finishTimestamp && event.finishTimestamp !== event.timestamp) {
    eventObj.eventDebugger.finishTimestamp = new Date(event.finishTimestamp).toISOString();
    eventObj.eventDebugger.durationMs = event.finishTimestamp - event.timestamp;
  }
  if (event.status) {
    eventObj.eventDebugger.status = event.status;
  }

  // Full consent check with state change detection and CMP/GCM comparison
  const check = _deps.getConsentCheckForEvent?.(event);
  if (check && check.status !== 'exempt') {
    const consentObj = {
      status: check.status,
      source: check.source || null,
      sourceLabel: check.sourceLabel || null,
      cmp: check.cmp || null,
      requiredCategory: check.category || null,
    };
    if (check.categories) consentObj.categories = { ...check.categories };
    if (check.severity) consentObj.severity = check.severity;

    // CMP vs GCM comparison
    const cmpCategories = check.cmp && check.cmp !== 'Google Consent Mode' ? check.categories : null;
    const gcmCategories = _deps.getGCMCategoriesAtTime?.(event.timestamp)
      || (check.cmp === 'Google Consent Mode' ? check.categories : null);
    if (cmpCategories && gcmCategories) {
      const mismatches = {};
      for (const cat of ['analytics', 'marketing', 'functional']) {
        if (cmpCategories[cat] && gcmCategories[cat] && cmpCategories[cat] !== gcmCategories[cat]) {
          mismatches[cat] = { cmp: cmpCategories[cat], gcm: gcmCategories[cat] };
        }
      }
      if (Object.keys(mismatches).length > 0) consentObj.mismatches = mismatches;
    }

    // State change detection
    if (!prevState.categories) {
      consentObj.stateChange = false;
    } else if (check.categories) {
      const changed = {};
      for (const cat of ['analytics', 'marketing', 'functional']) {
        if (prevState.categories[cat] && check.categories[cat] && prevState.categories[cat] !== check.categories[cat]) {
          changed[cat] = { from: prevState.categories[cat], to: check.categories[cat] };
        }
      }
      if (Object.keys(changed).length > 0) {
        consentObj.stateChange = { ...changed, source: check.source };
      } else if (prevState.source && check.source !== prevState.source) {
        consentObj.stateChange = { sourceChange: { from: prevState.source, to: check.source } };
      } else {
        consentObj.stateChange = false;
      }
    }
    if (check.categories) prevState.categories = { ...check.categories };
    if (check.source) prevState.source = check.source;

    eventObj.consent = consentObj;

    // Count violations
    if (check.status === 'denied') prevState.violations++;
    if (check.status === 'pre-consent') prevState.preConsent++;
    if (check.status === 'unknown') prevState.unknown++;
  }

  return eventObj;
}

// Build consent state marker entry for timeline
function buildConsentMarkerEntry(marker, firstEventTime) {
  const markerObj = {
    type: 'consent-state',
    action: marker.action,
    source: marker.source || null,
    cmp: marker.cmp || null,
    time: marker.timestamp > 0 ? formatTimeForExport(marker.timestamp) : 'T=0',
    deltaMs: marker.timestamp > 0 ? marker.timestamp - firstEventTime : 0,
    categories: { ...marker.categories },
  };
  if (marker.completeness === 'binary') markerObj.completeness = 'binary';
  return markerObj;
}

// Build consent header (CMP name + baseline from cookies)
function buildConsentHeader() {
  const timeline = _deps.getConsentTimeline?.() || [];
  const consentHeader = {};
  const cmpEntry = timeline.find(e => e.cmp && e.cmp !== 'Google Consent Mode');
  if (cmpEntry) consentHeader.cmp = cmpEntry.cmp;
  const baselineEntry = timeline.find(e => e.timestamp === 0 && e.categories);
  if (baselineEntry) consentHeader.baseline = { ...baselineEntry.categories };
  return Object.keys(consentHeader).length > 0 ? consentHeader : null;
}

// Merge events and consent markers into a sorted timeline, build full export entries
function buildFullExportTimeline(sortedEvents, markers, firstEventTime) {
  const mergedItems = [];
  for (const event of sortedEvents) {
    mergedItems.push({ type: 'event', data: event, timestamp: event.timestamp });
  }
  for (const marker of markers) {
    mergedItems.push({ type: 'consent-state', data: marker, timestamp: marker.timestamp });
  }
  // Consent markers sort before events at the same timestamp
  mergedItems.sort((a, b) => {
    if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    if (a.type === 'consent-state' && b.type !== 'consent-state') return -1;
    if (a.type !== 'consent-state' && b.type === 'consent-state') return 1;
    return 0;
  });

  const prevState = { categories: null, source: null, violations: 0, preConsent: 0, unknown: 0 };
  const timelineEntries = mergedItems.map(item => {
    if (item.type === 'consent-state') {
      return buildConsentMarkerEntry(item.data, firstEventTime);
    }
    return buildFullExportEvent(item.data, firstEventTime, prevState);
  });

  return { timeline: timelineEntries, summary: { violations: prevState.violations, preConsent: prevState.preConsent, unknown: prevState.unknown } };
}

// Copy page full export — raw data + consent timeline + markers
export function copyPageFullExport(pageEventId) {
  const { page, events } = _deps.getPageEvents(pageEventId);
  if (!page || events.length === 0) {
    copyToClipboard(JSON.stringify({ error: 'No events captured for this page.' }, null, 2));
    return;
  }

  const pagePath = page.eventName || page.raw?.url || '/';
  const pageUrl = page.raw?.url || page.formatted?.url || null;
  const captureTime = new Date(page.timestamp).toISOString();
  const sortedEvents = [...events].sort(_deps.compareEventsAsc);
  const firstEventTime = sortedEvents[0].timestamp;

  // Get consent state markers for this page's time range
  const allMarkers = _deps.getConsentStateMarkers?.() || [];
  const lastEventTime = sortedEvents[sortedEvents.length - 1]?.timestamp || firstEventTime;
  const pageMarkers = allMarkers.filter(m =>
    m.timestamp === 0 || (m.timestamp >= firstEventTime && m.timestamp <= lastEventTime)
  );

  const { timeline, summary } = buildFullExportTimeline(sortedEvents, pageMarkers, firstEventTime);
  const consentHeader = buildConsentHeader();

  const jsonOutput = {
    page: pagePath,
    url: pageUrl,
    captured: captureTime,
    eventCount: events.length,
  };
  if (consentHeader) jsonOutput.consent = consentHeader;
  if (summary.violations || summary.preConsent || summary.unknown) jsonOutput.consentSummary = summary;
  jsonOutput.timeline = timeline;

  const mc = countEventsForMeta(sortedEvents);
  copyJsonWithMeta(jsonOutput, 'page-full', {
    url: pageUrl, ...mc,
    consentMarkers: pageMarkers.length,
    consentViolations: summary.violations + summary.preConsent + summary.unknown
  });
}

// Copy events for a set of platforms as Table format
// ========================================
// Generic Group-Events Copy (Feature #61)
// ========================================
// Used by the unified group context menu (Tool category / Tool platform / Page-pivot
// domain / Event Name / Consent Category headers). Selection happens at the call
// site — the menu hands an event-id list, these fns just filter `state.events`
// and run the same five export shapes the page menu does. Page-pivot pages keep
// the page-specific `copyPage*` paths above (dataLayer / Full Export with
// per-page time window).

function selectEventsByIds(eventIds) {
  if (!Array.isArray(eventIds) || eventIds.length === 0) return [];
  const ids = new Set(eventIds);
  const state = _deps.getState();
  const all = state.events || [];
  const found = all.filter(e => ids.has(e.id));
  // Pinned-view fallback: any id without a live match is resolved to the
  // stored snapshot so events pinned in a previous session (or cleared
  // since they were pinned) still show up in copy/export.
  //
  // Two-stage lookup: first try the currently-inspected domain (fast path),
  // then fall back to a cross-domain search so right-clicking a group
  // header from a different site than the one DevTools is inspecting still
  // produces a working export.
  if (state.viewMode === 'pinned') {
    const liveIds = new Set(found.map(e => e.id));
    const currentDomain = _deps.getCurrentPinDomain && _deps.getCurrentPinDomain();
    for (const id of eventIds) {
      if (liveIds.has(id)) continue;
      let snap = currentDomain && _deps.getPinnedSnapshotById
        ? _deps.getPinnedSnapshotById(id, currentDomain)
        : null;
      if (!snap && _deps.getPinnedSnapshotByIdAcrossDomains) {
        const hit = _deps.getPinnedSnapshotByIdAcrossDomains(id);
        snap = hit ? hit.snapshot : null;
      }
      if (snap) found.push(snap);
    }
  }
  return found;
}

// Shared event-row builder used by Basic (curated) and AI Ready (full).
// `propertyMode`:
//   'basic' — curated parser sections only (drops diagnostic sections + skips
//             rawParams fallback); for "Copy for Human"
//   'full'  — all parser sections + rawParams fallback for unparsed events
//             (legacy mode — the v4 "Copy for AI" builder no longer routes
//             through this helper; left in place for any future consumer)
//   'none'  — metadata wrapper only, no payload
// Build a per-event object for Human JSON exports. Shape:
//   { order, category, tool, event, time, deltaMs, detectedBy?, consent?,
//     intercepted?, properties?, rawParams? }
// `categoryId`/`toolId` are deliberately omitted — display name covers humans;
// the machine ids are only useful for app-internal filtering, not for reading.
// `tool` carries the proper-cased display name (`Snapchat`), not the legacy
// upper-cased form (`SNAPCHAT`).
//
// Property emission uses `buildPropertiesForExport` so events without a custom
// parser fall back to `rawParams` — preserves the actual tracking payload
// instead of leaving the user looking at an empty event card.
//
// `rawParams` is then size-capped per event (HUMAN_RAW_PARAMS_CAP). Over-cap
// payloads (e.g. AppDynamics adrum's resource-timing dumps — ~5.5k of browser
// RUM telemetry, useless for analytics QA) get replaced with a `_truncated`
// stub pointing to where the full payload lives. Parsed `properties` is NOT
// capped — the parser already filters out diagnostic dumps via
// `diagnostic: true` so curated sections are always reasonable in size.
//
// `propertyMode` legacy parameter retained for the dead 'none' path; today
// every caller uses the default (full properties + rawParams fallback).
function buildSimpleEventObj(event, index, firstEventTime, propertyMode = 'full') {
  const toolId = event.platform || 'unknown';
  const categoryId = _deps.getCategoryForPlatform(toolId);
  const category = _deps.PLATFORM_CATEGORIES[categoryId];
  const eventObj = {
    order: index + 1,
    category: category?.name || categoryId,
    tool: event.platformName || event.platform || 'unknown',
    event: event.eventName || 'Unknown',
    time: formatTimeForExport(event.timestamp),
    deltaMs: event.timestamp - firstEventTime,
  };
  const detectionPattern = getDetectionPattern(event);
  if (detectionPattern) eventObj.detectedBy = detectionPattern;
  const consent = buildConsentJSON(event);
  if (consent) eventObj.consent = consent;
  const intercepted = buildInterceptJSON(event);
  if (intercepted) eventObj.intercepted = intercepted;
  if (propertyMode !== 'none') {
    const { properties, rawParams } = buildPropertiesForExport(event);
    if (properties) eventObj.properties = properties;
    if (rawParams) {
      const serialised = safeStringify(rawParams);
      if (serialised.length > HUMAN_RAW_PARAMS_CAP) {
        eventObj.rawParams = {
          _truncated: {
            originalSize: serialised.length,
            reason: 'rawParams_over_size_cap',
            cap: HUMAN_RAW_PARAMS_CAP,
            hint: 'Right-click this event → Copy JSON for the full payload, or use Copy Complete.',
          },
        };
      } else {
        eventObj.rawParams = rawParams;
      }
    }
  }
  return eventObj;
}

// Copy a selection / group of events (single-event scope uses a 1-element id list).
// Emits a Markdown pipe-table. For single-event scope we skip the summary header
// — one row doesn't need a session-level summary above it.
//
// Optional `opts.scopeContext` lets callers thread a richer scope label into
// the YAML + title. The Pinned-view group-header right-click uses this to
// report which site's group is being exported (e.g. "ase.dk — FORM Submit"),
// which matters when the right-click target is on a different domain from
// the one DevTools is inspecting.
export function copyEventsAsTable(eventIds, opts = {}) {
  const events = selectEventsByIds(eventIds);
  if (events.length === 0) {
    copyToClipboard('No events captured.');
    return;
  }
  const sortedEvents = [...events].sort(_deps.compareEventsAsc);
  const firstEventTime = sortedEvents[0].timestamp;
  const lastEventTime = sortedEvents[sortedEvents.length - 1].timestamp;

  let output = '';
  if (events.length > 1) {
    const mc = countEventsForMeta(sortedEvents);
    const spanMs = lastEventTime - firstEventTime;
    // Pinned view's group-header right-click routes through this same path —
    // tag the scope as `pinned` and weave the source domain + group into
    // the YAML + title.
    const ctx = opts.scopeContext || {};
    const isPinned = ctx.scope === 'pinned' || _deps.getState()?.viewMode === 'pinned';
    const scope = isPinned ? 'pinned' : 'group-events';
    let title;
    if (isPinned && ctx.domain && ctx.group) {
      title = `Event Watcher — Pinned: ${ctx.domain} — ${ctx.group}`;
    } else if (isPinned) {
      title = 'Event Watcher — Pinned Events';
    } else {
      title = 'Event Watcher — Events';
    }
    output += buildYamlFrontmatter({
      scope,
      exportedAt: new Date().toISOString(),
      domain: isPinned ? ctx.domain : undefined,
      eventCount: events.length,
      uniqueTools: mc.uniqueTools,
      spanMs,
      consentViolations: mc.consentViolations,
    });
    // For Pinned scope, attach the group as an extra YAML field. Done via
    // a tiny inline injection because buildYamlFrontmatter doesn't know
    // about pinned groups.
    if (isPinned && ctx.group) {
      // Replace the closing `---\n` with the extra line then close.
      output = output.replace(/\n---\n\n$/, `\npinned_group: ${yamlScalar(ctx.group)}\n---\n\n`);
    }
    output += buildMarkdownSummary({
      title,
      captureTime: formatDateTimeForExport(firstEventTime),
      domain: isPinned ? ctx.domain : undefined,
      eventCount: events.length,
      uniqueTools: mc.uniqueTools,
      spanMs: isPinned ? undefined : spanMs,
      violations: mc.consentViolations,
    });
  }
  // Pinned-scope events come from disparate sessions — Δ doesn't reflect a
  // meaningful continuous spacing. Drop the column for Pinned exports.
  const isPinnedScope = (opts.scopeContext?.scope === 'pinned')
    || _deps.getState()?.viewMode === 'pinned';
  output += buildMarkdownEventTable(sortedEvents, firstEventTime, { omitDelta: isPinnedScope });
  copyToClipboard(output);
}

export function copyEventsAsJSON(eventIds) {
  const events = selectEventsByIds(eventIds);
  if (events.length === 0) {
    copyToClipboard(JSON.stringify({ error: 'No events captured.' }, null, 2));
    return;
  }
  const sortedEvents = [...events].sort(_deps.compareEventsAsc);
  const firstEventTime = sortedEvents[0].timestamp;

  const jsonOutput = {
    eventCount: events.length,
    events: sortedEvents.map((event, index) => buildSimpleEventObj(event, index, firstEventTime)),
  };

  const mc = countEventsForMeta(sortedEvents);
  copyJsonWithMeta(jsonOutput, 'group-events', mc);
}

// Copy a selection / group of events — group-scoped "Copy for AI".
// Emits the v4 sparse-object AI schema (see `buildAIExportV4Output`).
export function copyEventsAsProperties(eventIds) {
  const events = selectEventsByIds(eventIds);
  if (events.length === 0) {
    copyToClipboard(JSON.stringify({ error: 'No events captured.' }, null, 2));
    return;
  }
  const sortedEvents = [...events].sort(_deps.compareEventsAsc);
  const { jsonString, truncatedManifestCount } = buildAIExportV4Output(sortedEvents, {
    scopeType: 'group-events-ai',
    mode: _exportToFile ? 'file' : 'clipboard',
  });
  copyToClipboard(jsonString, { truncatedCount: truncatedManifestCount });
}

export function copyEventsAsFullExport(eventIds) {
  const events = selectEventsByIds(eventIds);
  if (events.length === 0) {
    copyToClipboard(JSON.stringify({ error: 'No events captured.' }, null, 2));
    return;
  }
  const sortedEvents = [...events].sort(_deps.compareEventsAsc);
  const firstEventTime = sortedEvents[0].timestamp;
  const lastEventTime = sortedEvents[sortedEvents.length - 1].timestamp;

  const allMarkers = _deps.getConsentStateMarkers?.() || [];
  const groupMarkers = allMarkers.filter(m =>
    m.timestamp === 0 || (m.timestamp >= firstEventTime && m.timestamp <= lastEventTime)
  );

  const { timeline, summary } = buildFullExportTimeline(sortedEvents, groupMarkers, firstEventTime);
  const consentHeader = buildConsentHeader();

  const jsonOutput = {
    captured: new Date().toISOString(),
    eventCount: events.length,
  };
  if (consentHeader) jsonOutput.consent = consentHeader;
  if (summary.violations || summary.preConsent || summary.unknown) jsonOutput.consentSummary = summary;
  jsonOutput.timeline = timeline;

  const mc = countEventsForMeta(sortedEvents);
  copyJsonWithMeta(jsonOutput, 'group-full', {
    ...mc,
    consentMarkers: groupMarkers.length,
    consentViolations: summary.violations + summary.preConsent + summary.unknown,
  });
}

// ========================================
// All-Events Copy (entire stream)
// ========================================

// Copy all stream events as TSV table (includes pages, interactions, consent markers)
// Copy events from the toolbar Export button as a Markdown pipe-table.
// Honours the active view mode:
//   - Stream / Grouped / Stack / Script: flat single table covering all
//     filtered stream events; domain pulled from the first page marker.
//   - Pinned: per-group sections (H2 per Inbox + user group) when the
//     current domain has multiple groups, else a single flat table. Δ
//     column dropped — pinned events span sessions so the column doesn't
//     reflect a meaningful spacing.
//
// `getEventsForExport()` returns the right set per view; the Pinned path
// re-fetches the records via `getPinnedRecordsForDomain` so it can preserve
// the group structure.
export function copyAllEventsAsTable() {
  const viewMode = _deps.getState()?.viewMode;
  const isPinned = viewMode === 'pinned';

  if (isPinned) {
    const currentDomain = _deps.getCurrentPinDomain && _deps.getCurrentPinDomain();
    copyPinnedAsTable(currentDomain);
    return;
  }

  const filteredEvents = _deps.getEventsForExport();
  if (filteredEvents.length === 0) {
    copyToClipboard('No events captured.');
    return;
  }

  const sortedEvents = [...filteredEvents].sort(_deps.compareEventsAsc);
  const firstEventTime = sortedEvents[0].timestamp;
  const lastEventTime = sortedEvents[sortedEvents.length - 1].timestamp;
  const captureTime = formatDateTimeForExport(Date.now());
  const mc = countEventsForMeta(sortedEvents);
  const spanMs = lastEventTime - firstEventTime;

  // Domain derived from the first page-marker event's URL (the site being
  // inspected). Skipped when no events expose a URL.
  const firstPage = sortedEvents.find(e => e.platform === 'pages' && e.raw?.url);
  const firstUrl = firstPage?.raw?.url
    || sortedEvents.find(e => e.raw?.url)?.raw?.url
    || null;
  const domain = extractDomainFromUrl(firstUrl);

  const frontmatter = buildYamlFrontmatter({
    scope: 'all-events',
    exportedAt: new Date().toISOString(),
    domain,
    eventCount: filteredEvents.length,
    uniqueTools: mc.uniqueTools,
    spanMs,
    pages: mc.pageMarkers,
    consentViolations: mc.consentViolations,
  });
  const summary = buildMarkdownSummary({
    title: 'Event Watcher — All Events',
    captureTime,
    domain,
    eventCount: filteredEvents.length,
    uniqueTools: mc.uniqueTools,
    spanMs,
    pages: mc.pageMarkers,
    violations: mc.consentViolations,
  });
  const table = buildMarkdownEventTable(sortedEvents, firstEventTime);
  copyToClipboard(frontmatter + summary + table);
}

// Pinned-view markdown table for a specific domain — emits a structured
// markdown with one H2 section per group (Inbox + user groups). Used by
// both the toolbar Export button (passes the current pin domain) and the
// right-click on a domain header in the multi-domain layout (passes the
// clicked domain, which may differ from the inspected page's domain).
export function copyPinnedAsTable(domain) {
  if (!domain) {
    copyToClipboard('No pin domain available.');
    return;
  }
  const records = (_deps.getPinnedRecordsForDomain && _deps.getPinnedRecordsForDomain(domain)) || [];
  if (records.length === 0) {
    copyToClipboard('No pinned events for this domain.');
    return;
  }
  const groupDefs = (_deps.getGroupsForDomain && _deps.getGroupsForDomain(domain)) || [];

  // Resolve each record into a live event or stored snapshot. Live wins so
  // any updates since the pin (e.g. consent re-classification) carry into
  // the export.
  const state = _deps.getState();
  const liveById = new Map((state?.events || []).map(e => [e.id, e]));
  const recordToEvent = (rec) => liveById.get(rec.pinId) || rec.snapshot;

  // Bucket records: Inbox (no groupIds) first, then each user group in
  // definition order. Empty groups are skipped — no section header for a
  // group with zero pins.
  const inboxRecords = records.filter(r => !r.groupIds || r.groupIds.length === 0);
  // One-pass group index (#131 F11) — avoids re-filtering the full records
  // array once per group. Record order within each group matches the
  // records array, same as the per-group filter produced.
  const recordsByGroup = new Map();
  for (const r of records) {
    if (!Array.isArray(r.groupIds)) continue;
    for (const gid of r.groupIds) {
      if (!recordsByGroup.has(gid)) recordsByGroup.set(gid, []);
      recordsByGroup.get(gid).push(r);
    }
  }
  const groupSections = groupDefs
    .map(g => ({ name: g.name, records: recordsByGroup.get(g.id) || [] }))
    .filter(s => s.records.length > 0);

  // Section list: Default first if non-empty, then user groups
  const sections = [];
  if (inboxRecords.length > 0) sections.push({ name: 'Default', records: inboxRecords });
  sections.push(...groupSections);

  const totalPins = sections.reduce((n, s) => n + s.records.length, 0);
  if (totalPins === 0) {
    copyToClipboard('No pinned events for this domain.');
    return;
  }

  // Aggregate stats across all sections
  const allEvents = sections.flatMap(s => s.records.map(recordToEvent).filter(Boolean));
  const mc = countEventsForMeta(allEvents);

  const captureTime = formatDateTimeForExport(Date.now());
  let output = buildYamlFrontmatter({
    scope: 'pinned',
    exportedAt: new Date().toISOString(),
    domain,
    eventCount: totalPins,
    uniqueTools: mc.uniqueTools,
    groups: sections.length,
    consentViolations: mc.consentViolations,
  });

  // For a single-section domain (Inbox only, no user groups), emit a flat
  // table — no H2 sub-headers needed when there's only one section.
  if (sections.length === 1) {
    const single = sections[0];
    const events = single.records.map(recordToEvent).filter(Boolean);
    output += buildMarkdownSummary({
      title: `Event Watcher — Pinned Events on ${domain}`,
      captureTime,
      domain,
      eventCount: events.length,
      uniqueTools: mc.uniqueTools,
      violations: mc.consentViolations,
    });
    output += buildMarkdownEventTable(events, 0, { omitDelta: true });
    copyToClipboard(output);
    return;
  }

  // Multi-section: H1 + summary + per-group H2 sections.
  output += buildMarkdownSummary({
    title: `Event Watcher — Pinned Events on ${domain}`,
    captureTime,
    domain,
    eventCount: totalPins,
    uniqueTools: mc.uniqueTools,
    violations: mc.consentViolations,
  });

  for (const section of sections) {
    const events = section.records.map(recordToEvent).filter(Boolean);
    output += `## ${escapeMarkdownCell(section.name)} (${events.length})\n\n`;
    output += buildMarkdownEventTable(events, 0, { omitDelta: true });
    output += '\n';
  }

  copyToClipboard(output);
}

// Copy all stream events as JSON
export function copyAllEventsAsJSON() {
  const filteredEvents = _deps.getEventsForExport();
  if (filteredEvents.length === 0) {
    copyToClipboard(JSON.stringify({ error: 'No events captured.' }, null, 2));
    return;
  }

  const sortedEvents = [...filteredEvents].sort(_deps.compareEventsAsc);
  const firstEventTime = sortedEvents[0].timestamp;

  const jsonOutput = {
    captured: new Date().toISOString(),
    eventCount: filteredEvents.length,
    events: sortedEvents.map((event, index) =>
      buildSimpleEventObj(event, index, firstEventTime)
    ),
  };

  const mc = countEventsForMeta(sortedEvents);
  copyJsonWithMeta(jsonOutput, 'all-events', mc);
}

// Copy all filtered stream events — the "Copy for AI" menu item.
// Emits the v4 sparse-object AI schema (see `buildAIExportV4Output`).
// Honors the "Save as file" setting via copyToClipboard: clipboard mode
// applies per-event Layer 1/2 truncation, file mode emits pretty-printed
// uncapped payload.
export function copyAllEventsWithProperties() {
  const filteredEvents = _deps.getEventsForExport();
  if (filteredEvents.length === 0) {
    copyToClipboard(JSON.stringify({ error: 'No events captured.' }, null, 2));
    return;
  }

  const sortedEvents = [...filteredEvents].sort(_deps.compareEventsAsc);
  const mc = countEventsForMeta(sortedEvents);
  const state = _deps.getState();
  const { jsonString, truncatedManifestCount } = buildAIExportV4Output(sortedEvents, {
    scopeType: 'all-events-ai',
    mode: _exportToFile ? 'file' : 'clipboard',
    sessionMeta: {
      view: state.viewMode,
      pages: mc.pageMarkers || 0,
      intr: mc.interactionMarkers || 0,
    },
  });
  copyToClipboard(jsonString, { truncatedCount: truncatedManifestCount });
}

// Copy all stream events — full export (raw data + consent timeline + markers)
export function copyAllFullExport() {
  const filteredEvents = _deps.getEventsForExport();
  if (filteredEvents.length === 0) {
    copyToClipboard(JSON.stringify({ error: 'No events captured.' }, null, 2));
    return;
  }

  const sortedEvents = [...filteredEvents].sort(_deps.compareEventsAsc);
  const firstEventTime = sortedEvents[0].timestamp;

  // Get all consent state markers
  const allMarkers = _deps.getConsentStateMarkers?.() || [];

  const { timeline, summary } = buildFullExportTimeline(sortedEvents, allMarkers, firstEventTime);
  const consentHeader = buildConsentHeader();

  const jsonOutput = {
    captured: new Date().toISOString(),
    eventCount: filteredEvents.length,
  };
  if (consentHeader) jsonOutput.consent = consentHeader;
  if (summary.violations || summary.preConsent || summary.unknown) jsonOutput.consentSummary = summary;
  jsonOutput.timeline = timeline;

  const mc = countEventsForMeta(sortedEvents);
  copyJsonWithMeta(jsonOutput, 'all-full', {
    ...mc,
    consentMarkers: allMarkers.length,
    consentViolations: summary.violations + summary.preConsent + summary.unknown
  });
}

// ── Full dataLayer export: validation-grade builder ─────────────────────────
// "Copy Full dataLayer" emits every classic window.dataLayer push across all pages PLUS the
// signals needed to validate the computed-state engine: both state models per
// push (EW's reconstruction vs GTM's ground truth), page-load segmentation,
// hidden-push gaps, and state-source transitions. See the per-field semantics in
// DATALAYER_EXPORT_SCHEMA_NOTES (emitted inline so a reader/AI knows the contract).

const DATALAYER_EXPORT_SCHEMA_VERSION = 3;

const DATALAYER_EXPORT_SCHEMA_NOTES = {
  stateSource: "'gtm' = primary state read from GTM's live data model (ground truth); 'computed' = EW's own reconstruction (before GTM loads).",
  computedState: 'Per-push primary state shown in the panel (GTM model when available, else EW reconstruction).',
  modelsDiffer: "true when EW's computed reconstruction structurally differs from GTM's model on this push (only meaningful when GTM is live). Per-key detail is in `divergences`.",
  divergences: 'Compact per-push diff for rows where modelsDiffer: { order, event, stateSource, onlyComputed[], onlyGtm[], valueDiff[] } (top-level keys). The full reconstruction/model objects are NOT repeated per row, to keep the export small — see finalComputedReconstruction / finalGtmModel for the end state.',
  push: "Pushed payload with the 'event' key stripped (shown separately as `event`); `rawPush` keeps the full untouched payload.",
  pushIndexGap: 'Count of dataLayer pushes hidden/filtered between this and the previous visible push within the same page segment (GTM-internal or routed to another platform).',
  dataLayerResetBefore: 'true on the first push of a new page-load segment (the dataLayer array was re-initialised by a navigation).',
  segment: 'Zero-based page-load segment index; pushIndex restarts at each navigation.',
  validation: 'Top-level rollup: page segments, computed/gtm counts, source transitions, hidden-push total, and computed-vs-gtm divergence count.'
};

// Deep structural equality with key-order independence. Deliberately avoids
// JSON.stringify so it is unaffected by key ordering (and stays clear of the
// captured-payload-safety guard's bare-stringify ban).
function deepEqualNormalized(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  const ta = typeof a, tb = typeof b;
  if (ta !== tb) return false;
  if (ta !== 'object') return a === b;
  const aArr = Array.isArray(a), bArr = Array.isArray(b);
  if (aArr !== bArr) return false;
  if (aArr) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqualNormalized(a[i], b[i])) return false;
    }
    return true;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqualNormalized(a[k], b[k])) return false;
  }
  return true;
}

// Compact top-level key diff between EW's computed reconstruction (a) and GTM's
// model (b), for the full export's `divergences` summary. Avoids repeating the
// (potentially huge) full state objects on every row.
function diffTopLevelKeys(a, b) {
  const ak = (a && typeof a === 'object') ? Object.keys(a) : [];
  const bk = (b && typeof b === 'object') ? Object.keys(b) : [];
  const aSet = new Set(ak), bSet = new Set(bk);
  return {
    onlyComputed: ak.filter(k => !bSet.has(k)),
    onlyGtm: bk.filter(k => !aSet.has(k)),
    valueDiff: ak.filter(k => bSet.has(k) && !deepEqualNormalized(a[k], b[k]))
  };
}

// Build the validation-grade dataLayer event entries + a top-level validation
// summary. Pure: operates only on plain captured-event objects + a time formatter,
// so it is mirrored and unit-tested in tests/panel/copy-export.test.mjs.
function buildDataLayerExportEntries(dataLayerEvents, formatTime) {
  const entries = [];
  const segments = [];
  const stateSourceCounts = { computed: 0, gtm: 0 };
  let segIndex = -1;
  let prevStateSource = null;
  let prevPushIndex = null;
  let transitions = 0;
  let pageResets = 0;
  let totalHiddenPushes = 0;
  let divergences = 0;

  dataLayerEvents.forEach((event, order) => {
    const pushIndex = event.formatted?.pushIndex || order + 1;
    const stateSource = event.raw?._stateSource || 'computed';

    // A page-load segment boundary: first event, or pushIndex did not advance.
    // Within a segment pushIndex strictly increases (with gaps for hidden pushes),
    // so any non-increase marks a dataLayer re-initialisation (navigation).
    const isReset = order === 0 || (prevPushIndex != null && pushIndex <= prevPushIndex);
    if (isReset) {
      segIndex++;
      segments.push({
        index: segIndex,
        firstOrder: order,
        lastOrder: order,
        firstPushIndex: pushIndex,
        lastPushIndex: pushIndex,
        visiblePushes: 0,
        hiddenPushes: 0
      });
      if (order !== 0) pageResets++;
    }
    const seg = segments[segIndex];

    // Hidden pushes between visible ones (filtered GTM-internal / other-platform pushes).
    const gap = isReset
      ? Math.max(0, pushIndex - 1)
      : Math.max(0, pushIndex - prevPushIndex - 1);
    totalHiddenPushes += gap;
    seg.hiddenPushes += gap;
    seg.visiblePushes += 1;
    seg.lastOrder = order;
    seg.lastPushIndex = pushIndex;

    const stateSourceChanged = prevStateSource != null && stateSource !== prevStateSource;
    if (stateSourceChanged) transitions++;
    stateSourceCounts[stateSource] = (stateSourceCounts[stateSource] || 0) + 1;

    const primary = event.formatted?.dataLayerState || event.raw?._dataLayerState || {};
    // Degrade gracefully for captures made before the dual-model page script shipped:
    // fall back to the single primary state so old exports still produce sane output.
    const computedReconstruction = event.raw?._computedState
      ?? event.raw?._dataLayerState ?? {};
    const gtmModel = event.raw?._gtmModel
      ?? (stateSource === 'gtm' ? (event.raw?._dataLayerState ?? null) : null);

    let modelsDiffer = false;
    if (gtmModel && typeof gtmModel === 'object') {
      modelsDiffer = !deepEqualNormalized(computedReconstruction, gtmModel);
      if (modelsDiffer) divergences++;
    }

    entries.push({
      order,
      segment: segIndex,
      pushIndex,
      dataLayerResetBefore: isReset && order !== 0,
      pushIndexGap: gap,
      event: event.eventName || 'dataLayer.push',
      time: formatTime(event.timestamp),
      isHistorical: event.formatted?.isHistorical || false,
      isGTMInternal: event.formatted?.isGTMInternalEvent || false,
      pushSource: event.formatted?.pushSource || event.raw?._pushSource || null,
      pushSourceUrl: event.formatted?.pushSourceUrl || event.raw?._pushSourceUrl || null,
      dataLayerLength: event.formatted?.dataLayerLength ?? event.raw?._dataLayerLength ?? null,
      stateSource,
      stateSourceChanged,
      push: event.formatted?.pushData || event.raw?._pushData || {},
      rawPush: event.raw?._pushData ?? null,
      computedState: primary,
      computedReconstruction,
      gtmModel,
      modelsDiffer
    });

    prevStateSource = stateSource;
    prevPushIndex = pushIndex;
  });

  return {
    entries,
    validation: {
      segments,
      stateSourceCounts,
      stateSourceTransitions: transitions,
      pageResets,
      totalHiddenPushes,
      computedVsGtmDivergences: divergences
    }
  };
}

// Get the sorted dataLayer + GTM events for either export.
function getDataLayerEventsForExport() {
  return _deps.getEventsForExport()
    .filter(e => e.platform === 'datalayer' || e.platform === 'gtm')
    .sort(_deps.compareEventsAsc);
}

// Copy all dataLayer events across all pages — FULL / validation export.
// Per-push computed state + a compact divergence summary (computed reconstruction
// vs GTM ground truth). The full reconstruction/gtmModel objects are NOT repeated
// per row (they balloon the export on heavy ecommerce stacks); their per-key diff
// lives in `divergences`, and the end state in finalComputed* / finalGtmModel.
export function copyAllDataLayerAsJSON() {
  const dataLayerEvents = getDataLayerEventsForExport();

  if (dataLayerEvents.length === 0) {
    copyToClipboard(JSON.stringify({
      captured: new Date().toISOString(),
      message: 'No dataLayer events captured.'
    }, null, 2));
    return;
  }

  const { entries, validation } = buildDataLayerExportEntries(dataLayerEvents, formatTimeForExport);
  const lastEntry = entries[entries.length - 1];

  // Compact per-row divergences from the (internally computed) reconstruction vs model.
  const divergences = entries
    .filter(e => e.modelsDiffer)
    .map(e => {
      const d = diffTopLevelKeys(e.computedReconstruction, e.gtmModel);
      return { order: e.order, event: e.event, stateSource: e.stateSource, onlyComputed: d.onlyComputed, onlyGtm: d.onlyGtm, valueDiff: d.valueDiff };
    });

  // Drop the two heavy per-row state copies; keep per-row primary computedState + modelsDiffer.
  const slimEntries = entries.map(({ computedReconstruction, gtmModel, ...rest }) => rest);

  const jsonOutput = {
    captured: new Date().toISOString(),
    schemaVersion: DATALAYER_EXPORT_SCHEMA_VERSION,
    exportNote: 'Classic window.dataLayer (GTM/gtag) only, including the computed state GTM reconstructs per push. Excludes named data layers (Adobe Client Data Layer, Tealium utag_data, W3C digitalData) — those are separate layers and not part of GTM\'s computed dataLayer model.',
    schemaNotes: DATALAYER_EXPORT_SCHEMA_NOTES,
    dataLayerEventCount: dataLayerEvents.length,
    validation,
    divergences,
    dataLayerEvents: slimEntries,
    finalComputedState: lastEntry ? lastEntry.computedState : {},
    finalComputedReconstruction: lastEntry ? lastEntry.computedReconstruction : {},
    finalGtmModel: lastEntry ? lastEntry.gtmModel : null
  };

  const mc = countEventsForMeta(dataLayerEvents);
  copyJsonWithMeta(jsonOutput, 'all-datalayer', mc);
}

// Copy just the actual dataLayer pushes across all pages — LITE export.
// Focuses on what the site pushed (no computed state), so it stays small even on
// heavy ecommerce stacks. The everyday "what fired on the dataLayer?" view.
export function copyDataLayerPushesAsJSON() {
  const dataLayerEvents = getDataLayerEventsForExport();

  if (dataLayerEvents.length === 0) {
    copyToClipboard(JSON.stringify({
      captured: new Date().toISOString(),
      message: 'No dataLayer events captured.'
    }, null, 2));
    return;
  }

  const { entries, validation } = buildDataLayerExportEntries(dataLayerEvents, formatTimeForExport);
  const pushes = entries.map(e => ({
    order: e.order,
    segment: e.segment,
    pushIndex: e.pushIndex,
    dataLayerResetBefore: e.dataLayerResetBefore,
    pushIndexGap: e.pushIndexGap,
    event: e.event,
    time: e.time,
    isHistorical: e.isHistorical,
    isGTMInternal: e.isGTMInternal,
    pushSource: e.pushSource,
    // The literal pushed payload (un-stripped) — faithful to what the site pushed,
    // so a `{event:'…'}`-only push shows its event key rather than an empty {}.
    push: e.rawPush ?? e.push
  }));

  // Lite validation: only the push-structure fields. The computed-state counts
  // (stateSourceCounts / transitions / computedVsGtmDivergences) belong to the full
  // export, which actually carries the computed state they describe.
  const liteValidation = {
    segments: validation.segments,
    pageResets: validation.pageResets,
    totalHiddenPushes: validation.totalHiddenPushes
  };

  const jsonOutput = {
    captured: new Date().toISOString(),
    schemaVersion: DATALAYER_EXPORT_SCHEMA_VERSION,
    exportNote: 'Classic window.dataLayer (GTM/gtag) pushes only, no computed state. Excludes named data layers (Adobe Client Data Layer, Tealium utag_data, W3C digitalData). Use "Copy Full dataLayer" for computed-state validation.',
    dataLayerEventCount: dataLayerEvents.length,
    validation: liteValidation,
    dataLayerPushes: pushes
  };

  const mc = countEventsForMeta(dataLayerEvents);
  copyJsonWithMeta(jsonOutput, 'all-datalayer-lite', mc);
}

function formatSize(chars) {
  if (chars >= 1_000_000) return `${(chars / 1_000_000).toFixed(1)}M`;
  if (chars >= 1_000) return `${Math.round(chars / 1_000)}K`;
  return `${chars}`;
}

// Create warning triangle SVG icon (matches datalayer-edit-warning pattern)
function createWarningIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z');
  svg.appendChild(path);
  const l1 = document.createElementNS(ns, 'line');
  l1.setAttribute('x1', '12'); l1.setAttribute('y1', '9');
  l1.setAttribute('x2', '12'); l1.setAttribute('y2', '13');
  svg.appendChild(l1);
  const l2 = document.createElementNS(ns, 'line');
  l2.setAttribute('x1', '12'); l2.setAttribute('y1', '17');
  l2.setAttribute('x2', '12.01'); l2.setAttribute('y2', '17');
  svg.appendChild(l2);
  return svg;
}

// Save text as a downloadable .json file
function saveAsFile(text, opts = {}) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  a.download = 'event-watcher-export-' + timestamp + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showCopyToast({ chars: text.length, mode: 'save', truncatedCount: opts.truncatedCount || 0 });
}

// Most recent pointerdown viewport coordinates — used to anchor the copy toast
// near the button the user just clicked instead of the bottom of the screen.
// Captured in the capture phase so we record coords even when the click handler
// closes the menu (e.g. export dropdown items) before the toast renders.
let _lastPointerCoords = null;
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => {
    _lastPointerCoords = { x: e.clientX, y: e.clientY };
  }, { capture: true, passive: true });
}

// Auto-dismissing toast confirming a copy/save completed.
// Shows character count (45K characters) and an optional "(N events truncated)" suffix
// so the user knows immediately how big the export was and whether anything was capped.
// Anchors near the most recent click so feedback appears next to the button the user
// just pressed, rather than at the bottom of the screen.
function showCopyToast(opts = {}) {
  const { chars = 0, mode = 'copy', truncatedCount = 0 } = opts;

  const sizeText = chars >= 1000
    ? `${formatSize(chars)} characters`
    : `${chars} character${chars === 1 ? '' : 's'}`;
  const action = mode === 'save' ? 'Saved as file' : 'Copied';
  let message = `${action} — ${sizeText}`;
  if (truncatedCount > 0) {
    message += ` (${truncatedCount} event${truncatedCount === 1 ? '' : 's'} truncated)`;
  }

  // Replace any in-flight toast so rapid copies don't stack
  const existing = document.querySelector('.copy-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'copy-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  // Green checkmark marker — mirrors the Stack View build-ready capstone style
  const check = document.createElement('span');
  check.className = 'copy-toast-check';
  check.setAttribute('aria-hidden', 'true');
  toast.appendChild(check);

  const label = document.createElement('span');
  label.className = 'copy-toast-label';
  label.textContent = message;
  toast.appendChild(label);

  document.body.appendChild(toast);

  positionToastNearLastClick(toast);

  requestAnimationFrame(() => toast.classList.add('copy-toast-visible'));
  setTimeout(() => {
    toast.classList.remove('copy-toast-visible');
    setTimeout(() => toast.remove(), 250);
  }, 2200);
}

// Place the toast near the user's most recent pointerdown, clamped to the viewport
// with an 8px gutter. Prefers below-right of the click; flips to above/left when
// that would overflow. Falls back to top-right of the panel when no click recorded.
function positionToastNearLastClick(toast) {
  const GUTTER = 8;
  const OFFSET = 14;
  const rect = toast.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let originX, originY;
  if (_lastPointerCoords) {
    originX = _lastPointerCoords.x;
    originY = _lastPointerCoords.y;
  } else {
    // Fallback: top-right region, mirroring where the export button typically lives
    originX = vw - 24;
    originY = 60;
  }

  let x = originX + OFFSET;
  let y = originY + OFFSET;

  // Flip to the left of the click if right side would overflow
  if (x + rect.width > vw - GUTTER) {
    x = originX - rect.width - OFFSET;
  }
  // Flip above the click if bottom would overflow
  if (y + rect.height > vh - GUTTER) {
    y = originY - rect.height - OFFSET;
  }
  // Final clamp so we never sit outside the viewport
  if (x < GUTTER) x = GUTTER;
  if (y < GUTTER) y = GUTTER;

  toast.style.left = x + 'px';
  toast.style.top = y + 'px';
}

// "Compare formats" help modal — opens from the small (?) link at the top of
// each export context menu. Pure-presentation, no event state needed; the copy
// is hard-coded against the five named export formats so it stays in sync only
// with the menu labels.
export function showExportFormatsHelp() {
  // Replace any existing instance (e.g. user double-clicked the help link)
  const existing = document.querySelector('.export-formats-help-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'datalayer-edit-overlay export-formats-help-overlay';

  const modal = document.createElement('div');
  modal.className = 'export-formats-help-modal';

  const header = document.createElement('div');
  header.className = 'export-formats-help-header';
  header.textContent = 'Compare export formats';
  modal.appendChild(header);

  // Prominent AI tool target banner at the top — explains the size budget v4
  // is currently aiming for. Promoted from a footer line because users were
  // missing the option to change it when their AI tool differs from the
  // default. The banner reads "Currently sized for …" + tool name + "Change"
  // pointer so it's clear this is a setting, not a permanent default.
  const targetMeta = AI_TOOL_TARGET_META[_exportWarningTarget] || AI_TOOL_TARGET_META.standard;
  const banner = document.createElement('div');
  banner.className = 'export-formats-help-target-banner';
  const bannerLabel = document.createElement('div');
  bannerLabel.className = 'export-formats-help-target-banner-label';
  bannerLabel.textContent = 'Currently sized for';
  const bannerValue = document.createElement('div');
  bannerValue.className = 'export-formats-help-target-banner-value';
  const bannerTier = document.createElement('strong');
  bannerTier.textContent = `${targetMeta.name} (~${targetMeta.short})`;
  const bannerTool = document.createElement('span');
  bannerTool.className = 'export-formats-help-target-banner-tool';
  bannerTool.textContent = ` — ${targetMeta.tool}`;
  bannerValue.append(bannerTier, bannerTool);
  const bannerHint = document.createElement('div');
  bannerHint.className = 'export-formats-help-target-banner-hint';
  bannerHint.textContent = 'Using a different AI tool? Change the target in Settings → Export & Debug → AI tool target.';
  banner.append(bannerLabel, bannerValue, bannerHint);
  modal.appendChild(banner);

  const intro = document.createElement('p');
  intro.className = 'export-formats-help-intro';
  intro.textContent = 'Pick the format that matches what you\'re trying to do.';
  modal.appendChild(intro);

  const list = document.createElement('ul');
  list.className = 'export-formats-help-list';

  const formats = [
    {
      name: 'Copy for AI',
      desc: 'Paste into Claude, ChatGPT, or Gemini for debugging. Compact format sized to fit the AI tool target above.',
    },
    {
      name: 'Copy for Human',
      desc: 'Read it yourself or share with a teammate. Pretty-printed and readable.',
    },
    {
      name: 'Copy Complete',
      desc: 'Deep debugging — everything captured including raw HTTP and consent timeline. Use when AI / Human skipped what you need.',
    },
    {
      name: 'Copy Markdown Table',
      desc: 'Quick visual scan. Markdown pipe-table — renders as a real table in GitHub / Notion / Confluence / Slack / Claude / ChatGPT / Gemini, and reads acceptably as plain text. Summary header carries domain, capture time, event count, tools, total span, and consent violations.',
    },
    {
      name: 'Copy dataLayer Pushes',
      desc: 'Just what the site pushed to the classic window.dataLayer (GTM/gtag) — every push across all pages, no computed state. Excludes named layers like Adobe Client Data Layer / Tealium utag_data / W3C digitalData. The everyday "what fired?" view; stays small even on heavy ecommerce stacks.',
    },
    {
      name: 'Copy Full dataLayer',
      desc: 'GTM debugging — every classic window.dataLayer push plus the computed state after each push (EW reconstruction vs GTM ground truth, with a divergence summary). Classic dataLayer only; excludes Adobe Client Data Layer / Tealium / W3C. Larger; use when validating computed state.',
    },
    {
      name: 'Copy Consent',
      desc: 'Debug consent classification on a single event — CMP / GCM comparison, raw signals, timing.',
    },
  ];

  for (const fmt of formats) {
    const li = document.createElement('li');
    li.className = 'export-formats-help-item';
    const name = document.createElement('span');
    name.className = 'export-formats-help-item-name';
    name.textContent = fmt.name;
    const desc = document.createElement('span');
    desc.className = 'export-formats-help-item-desc';
    desc.textContent = fmt.desc;
    li.appendChild(name);
    li.appendChild(desc);
    list.appendChild(li);
  }
  modal.appendChild(list);

  const tip = document.createElement('p');
  tip.className = 'export-formats-help-tip';
  tip.textContent = 'Tip: Settings → Export & Debug → "Save as file" turns any clipboard format into a downloadable .json with no truncation.';
  modal.appendChild(tip);

  const buttons = document.createElement('div');
  buttons.className = 'datalayer-edit-buttons';
  const close = document.createElement('button');
  close.className = 'btn btn-sm btn-accent';
  close.textContent = 'Close';
  buttons.appendChild(close);
  modal.appendChild(buttons);

  const cleanup = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      cleanup();
    }
  }
  close.addEventListener('click', cleanup);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });
  document.addEventListener('keydown', onKey);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  close.focus();
}

// "About MartechStack Builder" modal — opens in two contexts:
//
//  1. From the inline ℹ️ icon next to a *Save as MartechStack Builder JSON*
//     menu item — info-only, no save action; just Close.
//
//  2. As a first-encounter gate before the actual save fires (when
//     `settings.martechStackInfoSeen !== true`). In this mode the modal
//     renders a "Save now" primary button and a "Don't show this again"
//     checkbox. Ticking the box + clicking Save persists the seen flag
//     so future clicks save directly. Cancelling does nothing — the
//     modal will reopen on the next click.
//
// @param {Object} [opts]
// @param {Function} [opts.onProceed] - if provided, the modal renders a Save
//                                       button + dismiss checkbox; the callback
//                                       fires with `dontShowAgain: boolean`.
export function showMartechStackBuilderInfo(opts = {}) {
  const existing = document.querySelector('.martechstack-info-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'datalayer-edit-overlay export-formats-help-overlay martechstack-info-overlay';

  const modal = document.createElement('div');
  modal.className = 'export-formats-help-modal martechstack-info-modal';

  // Hero row: brand logo + title + clickable link beneath.
  const hero = document.createElement('div');
  hero.className = 'martechstack-info-hero';

  const logo = document.createElement('img');
  logo.className = 'martechstack-info-logo';
  logo.src = '../../icons/martechstackbuilder-logo-icon.png';
  logo.alt = 'MartechStack Builder logo';
  logo.width = 64;
  logo.height = 64;
  hero.appendChild(logo);

  const heroText = document.createElement('div');
  heroText.className = 'martechstack-info-hero-text';
  const title = document.createElement('div');
  title.className = 'export-formats-help-header martechstack-info-title';
  title.textContent = 'About MartechStack Builder';
  heroText.appendChild(title);
  const heroLink = document.createElement('a');
  heroLink.className = 'martechstack-info-link';
  heroLink.href = 'https://app.martechstackbuilder.com/';
  heroLink.target = '_blank';
  heroLink.rel = 'noopener noreferrer';
  heroLink.textContent = 'app.martechstackbuilder.com →';
  heroText.appendChild(heroLink);
  hero.appendChild(heroText);
  modal.appendChild(hero);

  const intro = document.createElement('p');
  intro.className = 'export-formats-help-intro';
  intro.textContent = 'This export targets one specific tool — MartechStack Builder. The JSON file imports cleanly via File → Import JSON and lands on the canvas with the right vendor logos auto-attached.';
  modal.appendChild(intro);

  const list = document.createElement('ul');
  list.className = 'export-formats-help-list';

  const points = [
    {
      name: 'I use it myself',
      desc: 'I, Rune the creator of Event Watcher, use MartechStack Builder when illustrating martech architectures. I use it for diagrams, sharing, and iterating without a whiteboard.',
    },
    {
      name: 'Best in class for the purpose',
      desc: 'Of the diagramming tools I\'ve tried, this is the one I keep coming back to for martech stack pictures specifically. Vendor logos, sensible categories, fast layout.',
    },
    {
      name: 'Thanks',
      desc: 'Hat-tip to Matthew Niederberger for building MartechStack Builder, sharing the import schema, and giving permission for Event Watcher to ship a spec-compliant export.',
    },
  ];

  for (const p of points) {
    const li = document.createElement('li');
    li.className = 'export-formats-help-item';
    const name = document.createElement('span');
    name.className = 'export-formats-help-item-name';
    name.textContent = p.name;
    li.appendChild(name);
    const desc = document.createElement('span');
    desc.className = 'export-formats-help-item-desc';
    desc.textContent = p.desc;
    li.appendChild(desc);
    list.appendChild(li);
  }
  modal.appendChild(list);

  // Proceed-mode footer: dismiss checkbox + Save Now / Cancel buttons.
  // Info-only mode: just a Close button.
  const buttons = document.createElement('div');
  buttons.className = 'datalayer-edit-buttons martechstack-info-buttons';

  let dismissCheckbox = null;
  if (typeof opts.onProceed === 'function') {
    const dismissRow = document.createElement('label');
    dismissRow.className = 'martechstack-info-dismiss';
    dismissCheckbox = document.createElement('input');
    dismissCheckbox.type = 'checkbox';
    dismissCheckbox.className = 'martechstack-info-dismiss-checkbox';
    const dismissLabel = document.createElement('span');
    dismissLabel.textContent = "Don't show this again";
    dismissRow.appendChild(dismissCheckbox);
    dismissRow.appendChild(dismissLabel);
    modal.appendChild(dismissRow);

    const cancel = document.createElement('button');
    cancel.className = 'btn btn-sm';
    cancel.textContent = 'Cancel';
    buttons.appendChild(cancel);

    const save = document.createElement('button');
    save.className = 'btn btn-sm btn-accent';
    save.textContent = 'Save now';
    buttons.appendChild(save);
    modal.appendChild(buttons);

    cancel.addEventListener('click', cleanup);
    save.addEventListener('click', () => {
      const dontShowAgain = !!dismissCheckbox.checked;
      cleanup();
      try { opts.onProceed({ dontShowAgain }); } catch { /* ignore */ }
    });

    setTimeout(() => save.focus(), 0);
  } else {
    const close = document.createElement('button');
    close.className = 'btn btn-sm btn-accent';
    close.textContent = 'Close';
    buttons.appendChild(close);
    modal.appendChild(buttons);
    close.addEventListener('click', cleanup);
    setTimeout(() => close.focus(), 0);
  }

  function cleanup() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      cleanup();
    }
  }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(); });
  document.addEventListener('keydown', onKey);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// Build the contextual description for the large-export warning. Three tiers
// keyed off how far past the user's chosen AI tool target the export is, so a
// 184K paste against a Relaxed (80K) target gets a much firmer "this won't
// inline-paste" message than a 92K paste against the same target. Returns one
// or two strings \u2014 the caller renders each as its own paragraph.
function buildLargeExportLines({ chars, target, threshold }) {
  const meta = AI_TOOL_TARGET_META[target] || AI_TOOL_TARGET_META.standard;
  const ratio = chars / threshold;
  const sizeFmt = formatSize(chars);
  const targetFmt = `your ${meta.name} target (~${meta.short}, sized for ${meta.tool})`;
  const recommendation = 'Saving as a file gives you the full payload with no truncation.';

  // Slightly over (< 1.3\u00d7): probably still pastes, just flag it.
  if (ratio < 1.3) {
    return [
      `${sizeFmt} characters is just past ${targetFmt}.`,
      `Most matching AI tools should still accept this inline. ${recommendation}`,
    ];
  }
  // Moderately over (1.3\u00d7 \u2013 2\u00d7): real risk of file conversion at the AI tool.
  if (ratio < 2) {
    const ratioFmt = ratio.toFixed(1).replace(/\.0$/, '');
    return [
      `${sizeFmt} characters is about ${ratioFmt}\u00d7 ${targetFmt}.`,
      `Pastes this large are usually converted to a file attachment by the AI tool itself. ${recommendation}`,
    ];
  }
  // Significantly over (\u2265 2\u00d7): all but certain to be file-attached or rejected.
  const ratioFmt = ratio.toFixed(1).replace(/\.0$/, '');
  return [
    `${sizeFmt} characters is ${ratioFmt}\u00d7 ${targetFmt} \u2014 well above what fits inline.`,
    `Pastes this large get converted to a file attachment by virtually every AI tool, or rejected outright. Saving as a file is the natural fit.`,
  ];
}

// Show native confirmation dialog for large exports.
// `opts`: { chars, target, threshold } \u2014 used to build a contextual message.
// Resolves with 'copy', 'save', or null (cancelled)
function showLargeExportConfirm(opts) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'datalayer-edit-overlay';

    const modal = document.createElement('div');
    modal.className = 'large-export-modal';

    // Header with warning icon
    const header = document.createElement('div');
    header.className = 'large-export-header';
    header.appendChild(createWarningIcon());
    header.appendChild(document.createTextNode('Large export \u2014 ' + formatSize(opts.chars) + ' characters'));
    modal.appendChild(header);

    // Two-paragraph contextual description (tier-keyed).
    const lines = buildLargeExportLines(opts);
    for (const line of lines) {
      const p = document.createElement('div');
      p.className = 'large-export-desc';
      p.textContent = line;
      modal.appendChild(p);
    }

    // Buttons
    const buttons = document.createElement('div');
    buttons.className = 'datalayer-edit-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-sm';
    cancelBtn.textContent = 'Cancel';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-sm btn-accent';
    saveBtn.textContent = 'Save as file';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-sm';
    copyBtn.textContent = 'Copy anyway';

    function cleanup(result) {
      overlay.remove();
      resolve(result);
    }

    cancelBtn.addEventListener('click', () => cleanup(null));
    saveBtn.addEventListener('click', () => cleanup('save'));
    copyBtn.addEventListener('click', () => cleanup('copy'));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(null); });

    buttons.appendChild(cancelBtn);
    buttons.appendChild(saveBtn);
    buttons.appendChild(copyBtn);
    modal.appendChild(buttons);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    saveBtn.focus();
  });
}

// Copy text to clipboard (with fallback for DevTools panels).
// `opts.truncatedCount` is forwarded to the toast so it can show "(N events truncated)".
export function copyToClipboard(text, opts = {}) {
  // If user prefers file export, always save as file
  if (_exportToFile) {
    saveAsFile(text, opts);
    return;
  }

  // Warn on large exports — threshold is set by the user's AI tool target in Settings.
  // 'off' resolves to Infinity so the predicate is always false (no warning).
  const threshold = EXPORT_WARNING_THRESHOLDS[_exportWarningTarget] ?? EXPORT_WARNING_THRESHOLDS.standard;
  if (text.length > threshold) {
    showLargeExportConfirm({
      chars: text.length,
      target: _exportWarningTarget,
      threshold,
    }).then(action => {
      if (action === 'copy') writeToClipboard(text, opts);
      else if (action === 'save') saveAsFile(text, opts);
    });
    return;
  }
  writeToClipboard(text, opts);
}

function writeToClipboard(text, opts = {}) {
  const onSuccess = () => showCopyToast({
    chars: text.length,
    mode: 'copy',
    truncatedCount: opts.truncatedCount || 0,
  });
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
      copyToClipboardFallback(text, opts);
    });
  } else {
    copyToClipboardFallback(text, opts);
  }
}

// Fallback clipboard method using execCommand (works in DevTools panels)
export function copyToClipboardFallback(text, opts = {}) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    document.execCommand('copy');
  } catch (err) {
    // copy failed silently
  }

  document.body.removeChild(textarea);
  showCopyToast({
    chars: text.length,
    mode: 'copy',
    truncatedCount: opts.truncatedCount || 0,
  });
}

// Copy a single event as detailed JSON
export function copyEventAsJSON(eventId) {
  const event = _deps.getState().events.find(e => e.id === eventId);
  if (!event) {
    copyToClipboard(JSON.stringify({ error: 'Event not found' }, null, 2));
    return;
  }

  // Get category info
  const categoryInfo = _deps.getCategoryInfo(event.platform);

  // Get platform display name
  const platformName = _deps.PLATFORM_NAMES[event.platform] || event.platform;

  // Determine event type
  let eventType = 'tracking';
  if (event.isNavigation || event.platform === 'pages') {
    eventType = 'page';
  } else if (event.isInteraction) {
    eventType = 'interaction';
  } else if (event.isScriptLoad) {
    eventType = 'script';
  } else if (['datalayer', 'adobe-datalayer', 'tealium-datalayer', 'w3c-datalayer'].includes(event.platform)) {
    eventType = 'datalayer';
  }

  // Event overview
  const eventDebugger = {
    tool: platformName,
    event: event.eventName || 'Unknown',
    category: categoryInfo.name,
    eventType: eventType,
    timestamp: new Date(event.timestamp).toISOString(),
    time: formatTimeForExport(event.timestamp)
  };

  // Add detection method if available
  if (event.detectionMethod) {
    eventDebugger.detectionMethod = event.detectionMethod;
  }

  // Add finish timestamp if different from start (for tracking requests)
  if (event.finishTimestamp && event.finishTimestamp !== event.timestamp) {
    eventDebugger.finishTimestamp = new Date(event.finishTimestamp).toISOString();
    eventDebugger.durationMs = event.finishTimestamp - event.timestamp;
  }

  // Add status if available
  if (event.status) {
    eventDebugger.status = event.status;
  }

  // Build the complete JSON output (exclude internal keys: initiator, _har)
  const raw = event.raw || {};
  const cleanRaw = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key !== 'initiator' && key !== '_har') {
      cleanRaw[key] = value;
    }
  }

  const jsonOutput = {
    eventDebugger: eventDebugger,
    raw: cleanRaw
  };

  // Basic includes curated parser sections (skips Tealium tag log, full DL
  // dump, browser context, perf timing). Users wanting the full payload
  // should use Copy Complete which includes the raw HTTP request data.
  const properties = buildPropertiesForBasic(event);
  if (properties) jsonOutput.properties = properties;

  // User comment (Feature #50)
  if (typeof event.userComment === 'string' && event.userComment.trim().length > 0) {
    jsonOutput.userComment = event.userComment;
  }

  // Add consent info if consent check is enabled and event has consent data
  const consent = buildConsentJSON(event);
  if (consent) {
    jsonOutput.consent = consent;
  }

  const mc = countEventsForMeta([event]);
  copyJsonWithMeta(jsonOutput, 'single-event', mc);
}

// Copy a single event — single-event "Copy for AI".
// Emits the v4 sparse-object AI schema (see `buildAIExportV4Output`).
// Skips `_consent_default` and folding internally since the input is one event.
export function copyEventWithProperties(eventId) {
  const event = _deps.getState().events.find(e => e.id === eventId);
  if (!event) {
    copyToClipboard(JSON.stringify({ error: 'Event not found' }, null, 2));
    return;
  }
  const sessionMeta = {};
  if (typeof event.userComment === 'string' && event.userComment.trim().length > 0) {
    sessionMeta.userComment = event.userComment;
  }
  const { jsonString, truncatedManifestCount } = buildAIExportV4Output([event], {
    scopeType: 'single-event-ai',
    mode: _exportToFile ? 'file' : 'clipboard',
    sessionMeta,
  });
  copyToClipboard(jsonString, { truncatedCount: truncatedManifestCount });
}

export function copyEventAsExtended(eventId) {
  const event = _deps.getState().events.find(e => e.id === eventId);
  if (!event) {
    copyToClipboard(JSON.stringify({ error: 'Event not found' }, null, 2));
    return;
  }

  const categoryInfo = _deps.getCategoryInfo(event.platform);
  const platformName = _deps.PLATFORM_NAMES[event.platform] || event.platform;

  let eventType = 'tracking';
  if (event.isNavigation || event.platform === 'pages') {
    eventType = 'page';
  } else if (event.isInteraction) {
    eventType = 'interaction';
  } else if (event.isScriptLoad) {
    eventType = 'script';
  } else if (['datalayer', 'adobe-datalayer', 'tealium-datalayer', 'w3c-datalayer'].includes(event.platform)) {
    eventType = 'datalayer';
  }

  const eventDebugger = {
    tool: platformName,
    event: event.eventName || 'Unknown',
    category: categoryInfo.name,
    eventType: eventType,
    timestamp: new Date(event.timestamp).toISOString(),
    time: formatTimeForExport(event.timestamp)
  };

  if (event.detectionMethod) {
    eventDebugger.detectionMethod = event.detectionMethod;
  }
  if (event.finishTimestamp && event.finishTimestamp !== event.timestamp) {
    eventDebugger.finishTimestamp = new Date(event.finishTimestamp).toISOString();
    eventDebugger.durationMs = event.finishTimestamp - event.timestamp;
  }
  if (event.status) {
    eventDebugger.status = event.status;
  }

  const jsonOutput = {
    eventDebugger: eventDebugger,
    raw: event.raw || {}
  };

  // Include the full `formatted` object — extended export should expose every
  // panel-side annotation (proxyHost, fingerprint, sections, overview, …) so
  // debugging classification / annotation issues doesn't require reading
  // panel state through DevTools.
  if (event.formatted) {
    jsonOutput.formatted = event.formatted;
  }

  // User comment (Feature #50)
  if (typeof event.userComment === 'string' && event.userComment.trim().length > 0) {
    jsonOutput.userComment = event.userComment;
  }

  const consent = buildConsentJSON(event);
  if (consent) {
    jsonOutput.consent = consent;
  }

  const mc = countEventsForMeta([event]);
  copyJsonWithMeta(jsonOutput, 'single-event-extended', mc);
}

export function buildScriptNodeJSON(event) {
  const scriptUrl = event.formatted?.scriptUrl || event.raw?.url;
  let scriptName = 'unknown';
  try {
    const url = new URL(scriptUrl);
    scriptName = url.pathname.split('/').pop() || url.hostname;
  } catch (e) {
    scriptName = scriptUrl || 'unknown';
  }

  return {
    platform: event.platform,
    platformName: event.platformName || event.platform?.toUpperCase(),
    script: scriptName,
    url: scriptUrl,
    initiatorType: event.formatted?.initiatorType || event.raw?.initiatorType,
    timestamp: event.timestamp
  };
}

// Recursively build tree structure for JSON export
export function buildTreeJSON(event, tree, includeChildren = true) {
  const { children } = tree;
  const scriptUrl = event.formatted?.scriptUrl || event.raw?.url;

  const node = buildScriptNodeJSON(event);

  if (includeChildren) {
    const childEvents = scriptUrl ? (children.get(scriptUrl) || []) : [];
    if (childEvents.length > 0) {
      node.children = childEvents.map(child => buildTreeJSON(child, tree, true));
    }
  }

  return node;
}

// Build the script-tree Markdown bullet representation.
// Mirrors the Stack View Markdown export style — `- **Name** _(category, N requests)_`
// nested under each parent. Pastes natively into GitHub, Notion, Slack, etc.
function buildScriptTreeMarkdown(rootNodes, children) {
  const lines = [`# Script Tree — ${rootNodes.length} root scripts`, ''];
  function appendNode(event, depth) {
    const indent = '  '.repeat(depth);
    const name = (event.platformName || event.platform || 'unknown').toUpperCase();
    const scriptUrl = event.formatted?.scriptUrl || event.raw?.url || '';
    let scriptName = scriptUrl;
    try {
      const u = new URL(scriptUrl);
      scriptName = u.pathname.split('/').filter(Boolean).pop() || u.hostname;
    } catch { /* keep raw */ }
    lines.push(`${indent}- **${name}** \`${scriptName}\``);
    const kids = children.get(scriptUrl) || [];
    for (const kid of kids) appendNode(kid, depth + 1);
  }
  for (const root of rootNodes) appendNode(root, 0);
  return lines.join('\n');
}

// Copy script tree as Markdown bullet list (from export menu — builds tree from all events).
export function copyAllScriptTreeAsMarkdown() {
  const allEvents = _deps.getFilteredEvents();
  const scriptEvents = allEvents.filter(e => e.isScriptLoad);
  if (scriptEvents.length === 0) {
    copyToClipboard('No script load events captured.');
    return;
  }

  // Same tree-building logic as copyAllScriptTreeAsJSON below — kept inline
  // to avoid coupling the JSON path's _export envelope to the plain-text export.
  const urlToEvent = new Map();
  scriptEvents.forEach(event => {
    const scriptUrl = event.formatted?.scriptUrl || event.raw?.url;
    if (scriptUrl) urlToEvent.set(scriptUrl, event);
  });

  const children = new Map();
  const hasParent = new Set();
  scriptEvents.forEach(event => {
    const initiatorType = event.formatted?.initiatorType || event.raw?.initiatorType;
    const initiatorUrl = event.formatted?.initiatorUrl || event.raw?.initiatorUrl;
    if (initiatorType === 'script' || initiatorType === 'tagmanager') {
      if (initiatorUrl && urlToEvent.has(initiatorUrl)) {
        const parentChildren = children.get(initiatorUrl) || [];
        parentChildren.push(event);
        children.set(initiatorUrl, parentChildren);
        hasParent.add(event.id);
      }
    }
  });

  const rootNodes = scriptEvents.filter(e => !hasParent.has(e.id));
  rootNodes.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  copyToClipboard(buildScriptTreeMarkdown(rootNodes, children));
}

// Copy all script tree as JSON (from export menu — builds tree from all events, no context menu needed)
export function copyAllScriptTreeAsJSON() {
  const allEvents = _deps.getFilteredEvents();
  const scriptEvents = allEvents.filter(e => e.isScriptLoad);
  if (scriptEvents.length === 0) {
    copyToClipboard(JSON.stringify({ error: 'No script load events captured.' }, null, 2));
    return;
  }

  // Build tree using same logic as script-tree.js buildScriptTree()
  const urlToEvent = new Map();
  scriptEvents.forEach(event => {
    const scriptUrl = event.formatted?.scriptUrl || event.raw?.url;
    if (scriptUrl) urlToEvent.set(scriptUrl, event);
  });

  const children = new Map();
  const hasParent = new Set();
  scriptEvents.forEach(event => {
    const initiatorType = event.formatted?.initiatorType || event.raw?.initiatorType;
    const initiatorUrl = event.formatted?.initiatorUrl || event.raw?.initiatorUrl;
    if (initiatorType === 'script' || initiatorType === 'tagmanager') {
      if (initiatorUrl && urlToEvent.has(initiatorUrl)) {
        const parentChildren = children.get(initiatorUrl) || [];
        parentChildren.push(event);
        children.set(initiatorUrl, parentChildren);
        hasParent.add(event.id);
      }
    }
  });

  const rootNodes = scriptEvents.filter(event => !hasParent.has(event.id));
  rootNodes.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  const tree = { rootNodes, children, urlToEvent };
  const fullTree = {
    rootScripts: rootNodes.map(root => buildTreeJSON(root, tree, true))
  };

  copyJsonWithMeta(fullTree, 'script-tree-full', { eventCount: rootNodes.length });
}

// Read the seen-flag from chrome.storage.local. Returns false on first call,
// missing settings object, or any storage failure (worst case = user sees the
// modal one more time).
export async function hasSeenMartechStackInfo() {
  try {
    const result = await chrome.storage.local.get('settings');
    return result?.settings?.martechStackInfoSeen === true;
  } catch {
    return false;
  }
}

// Persist the seen-flag inside the existing `settings` composite. Best-effort —
// failure just means the user sees the modal again next time.
export async function markMartechStackInfoSeen() {
  try {
    const result = await chrome.storage.local.get('settings');
    const settings = (result && result.settings) || {};
    settings.martechStackInfoSeen = true;
    await chrome.storage.local.set({ settings });
  } catch { /* ignore */ }
}

// Copy selected branch (ancestors + node + descendants, no siblings)
export function copySelectedBranch() {
  if (!_deps.getContextMenuScriptEventId() || !_deps.getContextMenuScriptTree()) return;

  const { rootNodes, children, urlToEvent } = _deps.getContextMenuScriptTree();

  // Find the selected event
  const selectedEvent = _deps.getState().events.find(e => e.id === _deps.getContextMenuScriptEventId());
  if (!selectedEvent) return;

  const selectedUrl = selectedEvent.formatted?.scriptUrl || selectedEvent.raw?.url;

  // Build ancestor chain (walk up from selected to root)
  function findAncestorChain(event) {
    const chain = [event];
    let current = event;

    while (true) {
      const initiatorUrl = current.formatted?.initiatorUrl || current.raw?.initiatorUrl;
      const initiatorType = current.formatted?.initiatorType || current.raw?.initiatorType;

      if (!initiatorUrl || initiatorType === 'website') {
        break; // Reached root (loaded by website/parser)
      }

      const parent = urlToEvent.get(initiatorUrl);
      if (!parent) break; // Parent not in our tracked scripts

      chain.unshift(parent);
      current = parent;
    }

    return chain;
  }

  const ancestorChain = findAncestorChain(selectedEvent);

  // Build the branch structure: ancestors with only the path to selected, then selected with all descendants
  function buildBranchNode(event, ancestorChain, currentIndex) {
    const node = buildScriptNodeJSON(event);
    const scriptUrl = event.formatted?.scriptUrl || event.raw?.url;

    if (currentIndex < ancestorChain.length - 1) {
      // This is an ancestor - only include the child that leads to selected
      const nextInChain = ancestorChain[currentIndex + 1];
      node.children = [buildBranchNode(nextInChain, ancestorChain, currentIndex + 1)];
    } else {
      // This is the selected node - include ALL descendants
      const childEvents = scriptUrl ? (children.get(scriptUrl) || []) : [];
      if (childEvents.length > 0) {
        node.children = childEvents.map(child => buildTreeJSON(child, _deps.getContextMenuScriptTree(), true));
      }
    }

    // Mark the selected node
    if (event.id === _deps.getContextMenuScriptEventId()) {
      node._selected = true;
    }

    return node;
  }

  const branchTree = {
    selectedScript: selectedEvent.formatted?.scriptUrl || selectedEvent.raw?.url,
    branch: buildBranchNode(ancestorChain[0], ancestorChain, 0)
  };

  copyJsonWithMeta(branchTree, 'script-tree-branch', { eventCount: 1 });
}

// ========================================
// Shared helpers for the v4 AI export (see `buildAIExportV4Output` below).
// These helpers carry their original `v2*` / `v3*` prefixes from the iterative
// design rounds in which they were introduced — the experimental v2 and v3
// entry points were dropped once v4 stabilised, but the helpers stayed because
// v4 reuses them unchanged. Renaming to a unified prefix is a follow-up.
// ========================================

// Sections coming out of buildPropertiesForExport / buildPropertiesForBasic use
// Title-Case display labels (e.g. "Custom Data", "E-Commerce", "Consent Mode",
// "Event Properties", "Push"). The AI export maps them to lower_snake_case so
// keys are shorter and disambiguated. Unknown labels fall through verbatim
// (lower-cased, spaces → underscores).
const V2_SECTION_KEY_MAP = {
  'Custom Data': 'custom_data',
  'Event Data': 'event_data',
  'Event Properties': 'event_properties',
  'Consent Mode': 'consent_mode',
  'Consent': 'consent_mode',
  'E-Commerce': 'ecommerce',
  'Products': 'products',
  'Push': 'push',
  'Parsed Data': 'parsed_data',
};

function v2NormaliseSectionKey(label) {
  if (typeof label !== 'string') return 'section';
  if (V2_SECTION_KEY_MAP[label]) return V2_SECTION_KEY_MAP[label];
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'section';
}

function v2NormaliseProperties(properties) {
  if (!properties || typeof properties !== 'object') return null;
  const out = {};
  for (const k of Object.keys(properties)) {
    out[v2NormaliseSectionKey(k)] = properties[k];
  }
  return Object.keys(out).length > 0 ? out : null;
}

// Slim consent shape: drop verbose `violation: false` and label fields the AI
// can already see from `status`. Only emit the fields that actually carry signal.
function v2BuildConsent(event) {
  const c = buildConsentJSON(event);
  if (!c) return null;
  const out = {};
  if (c.categories) out.categories = c.categories;
  if (c.source) out.source = c.source;
  if (c.violation === true) {
    out.violation = true;
    if (c.violationDetails) {
      const vd = {};
      if (c.violationDetails.status) vd.status = c.violationDetails.status;
      if (c.violationDetails.requiredCategory) vd.required = c.violationDetails.requiredCategory;
      if (c.violationDetails.severity) vd.severity = c.violationDetails.severity;
      out.details = vd;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

// Compact intercept — mirrors buildInterceptJSON but without redundant nulls.
function v2BuildIntercept(event) {
  const i = buildInterceptJSON(event);
  if (!i) return null;
  const out = { action: i.action };
  if (i.originalId) out.from = i.originalId;
  if (i.replacementId) out.to = i.replacementId;
  return out;
}

// Strip the "URL " prefix from detection patterns — the AI can infer it's
// URL-based from context. Saves a few chars per event with no info loss.
function v2DetectionPattern(event) {
  const raw = getDetectionPattern(event);
  if (!raw) return null;
  return raw.startsWith('URL ') ? raw.slice(4) : raw;
}

// Body keys that count as "low-signal" — varying values are expected
// (timestamps, random IDs, session tokens) and shouldn't block sequence
// collapsing. The v4 fold cell surfaces these under `r.varyLow` while real
// content differences land in `r.vary`.
const V3_LOW_SIGNAL_KEY_HINTS = new Set([
  'timestamp', 'time', 'ts', 'cid', 'sid', 'session_id', 'request_id',
  '_p', 'gtm', 'tid', 'cb',
]);

// Maximum number of events to fold into a single `rep` cell. Caps the
// information density of one row — beyond this, the AI starts losing detail.
const V3_MAX_RUN_LENGTH = 25;

// Compute the set of body keys that differ across a run of events. Returns
// null when bodies are byte-identical, an array of varying top-level keys
// otherwise. Recurses one level deep into known parser sections so callers
// can see "varied: [custom_data.page_path]" rather than just "varied:
// [custom_data]".
function v3CollectBodyVaryingKeys(bodies) {
  if (bodies.length < 2) return null;
  const varying = new Set();
  const ref = bodies[0];
  const refKeys = ref ? Object.keys(ref) : [];

  for (let i = 1; i < bodies.length; i++) {
    const b = bodies[i];
    const bKeys = b ? Object.keys(b) : [];
    const allKeys = new Set([...refKeys, ...bKeys]);
    for (const k of allKeys) {
      const a = ref ? ref[k] : undefined;
      const c = b ? b[k] : undefined;
      if (JSON.stringify(a) === JSON.stringify(c)) continue;
      // Recurse one level for parser sections (objects)
      if (a && c && typeof a === 'object' && typeof c === 'object'
          && !Array.isArray(a) && !Array.isArray(c)) {
        const subKeys = new Set([...Object.keys(a), ...Object.keys(c)]);
        for (const sk of subKeys) {
          if (JSON.stringify(a[sk]) !== JSON.stringify(c[sk])) {
            varying.add(`${k}.${sk}`);
          }
        }
      } else {
        varying.add(k);
      }
    }
  }
  return varying.size > 0 ? [...varying] : null;
}

// Decide whether two consecutive events are "collapsible". They must share
// tool + event name + (deeply equal) consent + (deeply equal) intercept.
// Body differences are allowed — we surface them as `rep.vary`.
function v3IsCollapsible(prev, next) {
  if (!prev || !next) return false;
  if (prev.toolId !== next.toolId) return false;
  if (prev.eventName !== next.eventName) return false;
  if (JSON.stringify(prev.consent) !== JSON.stringify(next.consent)) return false;
  if (JSON.stringify(prev.intercept) !== JSON.stringify(next.intercept)) return false;
  return true;
}

// (Deleted: experimental v3 main export `copyAllEventsForAIv3` and its alias
// helpers `v3NormaliseProperties` / `v3BuildConsent` / `v3BuildIntercept` /
// `v3DetectionPattern` — all four "Copy for AI" entry points now route through
// `buildAIExportV4Output`. Helpers `V3_LOW_SIGNAL_KEY_HINTS`,
// `V3_MAX_RUN_LENGTH`, `v3CollectBodyVaryingKeys`, and `v3IsCollapsible`
// survive above as the v4 builder reuses the same fold semantics.)

// ========================================
// "Copy for AI" (schema v4) — sparse-object AI export.
//
// Designed against the three-evaluator review in
// docs/inspiration/ai-copy/AI-tool-inpit.txt. Combines:
//
//   - v2's tabular discipline (one row per event, compact field names)
//   - v3's top-level `tools` map (drops per-row category) and run-folding
//   - Gemini's sparse-object row form: null keys are absent, no padding.
//     Sparse rows win on Event Watcher's typical traffic (script loads
//     with mostly null cells); folding becomes free on rows that don't
//     fold because `r` is an optional key, not a fixed column.
//   - ChatGPT's structured truncation: `{_trunc:N, prefix:"..."}` and
//     `{_trunc_items:N}` instead of English `"…[+N chars truncated]"`.
//   - Claude's `_consent_default` dedup: the biggest single waste in v2/v3
//     was the consent block printed ~30× per trace. v4 emits the modal
//     consent shape once at top level and uses `c:0` per event when the
//     event's consent matches it. Falls back to full consent objects if
//     <50% of consented events share a shape.
//
// Like v2/v3, this is intentionally A/B-able alongside the older exports
// — they all stay in the menu until v4 is confirmed superior in real use.
// ========================================

// Sentinel for Layer 1 string-truncation strings produced by truncatePayloadValue.
// We use it to detect the suffix and wrap the value into `{_trunc, prefix}`.
const V4_STRING_TRUNC_SUFFIX = /^([\s\S]*?)… \[\+(\d+) chars truncated]$/;

// Minimum run length that folds into a single row via the `r` cell. Runs
// shorter than this stay expanded as individual events. Chosen so trivial
// 2-event repeats stay explicit (the parser doesn't have to reason about
// implicit `i+1` rows for a single-row saving) while real bursts (≥3) still
// compress meaningfully.
const V4_MIN_FOLD_LENGTH = 3;

function v4NormaliseProperties(properties) {
  return v2NormaliseProperties(properties);
}

// Convert v2's per-event consent object into a stable signature so we can
// vote on the modal shape. Violations are excluded from the vote so a single
// violation doesn't drag the default toward an unusual shape.
function v4ConsentSignature(consent) {
  if (!consent || consent.violation === true) return null;
  const cats = consent.categories
    ? Object.keys(consent.categories).sort()
        .map(k => `${k}:${consent.categories[k]}`)
        .join(',')
    : '';
  return `${cats}|${consent.source || ''}`;
}

// Compute the modal consent shape across events. Returns null if fewer than
// 50% of consented events share a shape — in that case v4 emits full `c`
// objects per row rather than forcing a bad default.
export function v4ComputeConsentDefault(logical) {
  const counts = new Map();
  const samples = new Map();
  let totalConsented = 0;
  for (const ev of logical) {
    const sig = v4ConsentSignature(ev.consent);
    if (sig === null) continue;
    totalConsented += 1;
    counts.set(sig, (counts.get(sig) || 0) + 1);
    if (!samples.has(sig)) samples.set(sig, ev.consent);
  }
  if (totalConsented === 0) return null;
  let bestSig = null;
  let bestCount = 0;
  for (const [sig, count] of counts) {
    if (count > bestCount) { bestSig = sig; bestCount = count; }
  }
  if (!bestSig || bestCount / totalConsented < 0.5) return null;
  const sample = samples.get(bestSig);
  const out = {};
  if (sample.categories) out.categories = sample.categories;
  if (sample.source) out.source = sample.source;
  return out;
}

// Encode an event's consent against `_consent_default`:
//   - null  ⇒ caller omits the `c` key entirely
//   - 0     ⇒ matches default exactly
//   - {...} ⇒ diff (only differing fields) or full object on violation/no-default
export function v4EncodeConsent(consent, defaultConsent) {
  if (!consent) return null;
  if (consent.violation === true) {
    return consent;
  }
  if (!defaultConsent) {
    return consent;
  }
  const sameSource = (consent.source || '') === (defaultConsent.source || '');
  const sameCategories = JSON.stringify(consent.categories || {})
    === JSON.stringify(defaultConsent.categories || {});
  if (sameSource && sameCategories) return 0;
  const diff = {};
  if (!sameCategories) diff.categories = consent.categories;
  if (!sameSource) diff.source = consent.source;
  return diff;
}

// Recursively wrap Layer 1 truncation artefacts produced by truncatePayloadValue:
//   - string  "abc… [+N chars truncated]"  ⇒  { _trunc: N, prefix: "abc" }
//   - object  { _truncated_items: N }       ⇒  { _trunc_items: N }
export function v4StructureTruncation(value) {
  if (typeof value === 'string') {
    const m = value.match(V4_STRING_TRUNC_SUFFIX);
    if (m) {
      return { _trunc: Number(m[2]), prefix: m[1] };
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(v4StructureTruncation);
  }
  if (value && typeof value === 'object') {
    if (Object.keys(value).length === 1
        && Object.prototype.hasOwnProperty.call(value, '_truncated_items')) {
      return { _trunc_items: value._truncated_items };
    }
    const out = {};
    for (const k of Object.keys(value)) out[k] = v4StructureTruncation(value[k]);
    return out;
  }
  return value;
}

// Return the set of optional keys (`b`, `c`, `icpt`, `p`, `r`) that appear
// in zero emitted rows — exposed via `_export.omitted_fields` so consumers
// know the absence is intentional, not a bug.
export function v4DetectOmittedFields(rows) {
  const optional = ['b', 'c', 'icpt', 'p', 'r'];
  const seen = new Set();
  for (const row of rows) {
    for (const k of optional) {
      if (Object.prototype.hasOwnProperty.call(row, k)) seen.add(k);
    }
    if (seen.size === optional.length) break;
  }
  return optional.filter(k => !seen.has(k));
}

/**
 * Build the v4 AI export output for a set of events.
 *
 * Single shared builder for every "Copy for AI" entry point — all-events,
 * page-scope, single-event, group-scope. Pure: takes pre-sorted source
 * events plus options, returns the JSON string + a truncation manifest
 * count. Caller is responsible for filtering, sorting (ascending), and
 * dispatching the output via `copyToClipboard` (which auto-routes to
 * `saveAsFile` when the user has "Save as file" enabled in Settings).
 *
 * @param {Array} sourceEvents - Pre-sorted captured events (ascending by timestamp).
 * @param {Object} opts
 * @param {string} opts.scopeType - One of 'all-events-ai', 'page-events-ai',
 *   'single-event-ai', 'group-events-ai'. Recorded in `_export.type` so a
 *   consumer can tell which scope the export came from.
 * @param {'clipboard' | 'file'} opts.mode - File mode skips Layer 1/2 truncation
 *   and pretty-prints with 2-space indent. Clipboard mode applies caps and minifies.
 * @param {Object} [opts.sessionMeta] - Extra fields merged into `_export` header
 *   (e.g. view, pages, intr, url, path). Scope-specific.
 * @returns {{ jsonString: string, truncatedManifestCount: number }}
 */
function buildAIExportV4Output(sourceEvents, opts) {
  const { scopeType, mode, sessionMeta = {} } = opts;
  const isFileMode = mode === 'file';
  const firstEventTime = sourceEvents.length > 0 ? sourceEvents[0].timestamp : 0;
  const limits = TRUNCATE_DEFAULTS;
  const truncatedManifest = [];

  // Pass 1: build logical events (one per source event) carrying everything
  // we need to render a row. Apply Layer 1 caps via the existing helper, then
  // wrap any truncation artefacts into structured `_trunc` objects. File mode
  // skips Layer 1 entirely — the user opted into the full uncapped payload.
  const logical = sourceEvents.map((event, index) => {
    const toolId = event.platform || 'unknown';
    const categoryId = _deps.getCategoryForPlatform(toolId);
    const platformName = _deps.PLATFORM_NAMES[toolId] || toolId;
    const eventName = event.eventName || 'Unknown';
    const deltaMs = event.timestamp - firstEventTime;

    const detectedBy = v2DetectionPattern(event);
    const consent = v2BuildConsent(event);
    const intercept = v2BuildIntercept(event);

    const { properties, rawParams } = buildPropertiesForExport(event);
    let body = null;
    if (properties) body = v4NormaliseProperties(properties);
    else if (rawParams) body = { raw_params: rawParams };

    let layer1Modified = false;
    if (body && !isFileMode) {
      const state = { modified: false };
      body = truncatePayloadValue(body, limits, state);
      if (state.modified) {
        layer1Modified = true;
        body = v4StructureTruncation(body);
      }
    }

    return {
      origIndex: index + 1,
      toolId, categoryId: categoryId || null, platformName,
      eventName, deltaMs, detectedBy, consent, intercept, body,
      layer1Modified,
    };
  });

  // Pass 2: fold consecutive collapsible runs. Reuse v3's predicates so v4
  // inherits the same `tool + ev + consent + intercept` collapsibility contract.
  // Build greedy runs first, then unfold any below V4_MIN_FOLD_LENGTH so trivial
  // 2-event repeats stay explicit (the parser doesn't reason about implicit
  // `i+1` rows for a single-row saving). Single-event scope skips folding
  // entirely — nothing to fold.
  const emitted = [];
  if (logical.length === 1) {
    emitted.push({ logical: logical[0], run: [logical[0]] });
  } else {
    const greedyEmitted = [];
    for (const ev of logical) {
      const last = greedyEmitted[greedyEmitted.length - 1];
      const lastLead = last && last.run[last.run.length - 1];
      const canFold = lastLead
        && last.run.length < V3_MAX_RUN_LENGTH
        && v3IsCollapsible(lastLead, ev);
      if (canFold) last.run.push(ev);
      else greedyEmitted.push({ logical: ev, run: [ev] });
    }
    for (const slot of greedyEmitted) {
      if (slot.run.length >= V4_MIN_FOLD_LENGTH) {
        emitted.push(slot);
      } else {
        for (const ev of slot.run) emitted.push({ logical: ev, run: [ev] });
      }
    }
  }

  // Compute the modal consent shape before serialising so encodeConsent has
  // a stable target. Use the lead event of each run (collapsibility guarantees
  // consent is constant within a run, so this matches every member's consent).
  // Single-event scope skips this — emitting a default + `c:0` for one event
  // costs more characters than just inlining the consent block.
  const consentDefault = logical.length > 1
    ? v4ComputeConsentDefault(emitted.map(s => s.logical))
    : null;

  // Pass 3: emit sparse rows, collect tools map + truncation manifest.
  const events = [];
  const seenTools = new Map();
  for (const slot of emitted) {
    const lead = slot.logical;
    const runLen = slot.run.length;

    if (!seenTools.has(lead.toolId)) {
      const entry = { n: lead.platformName };
      if (lead.categoryId) entry.c = lead.categoryId;
      seenTools.set(lead.toolId, entry);
    }

    const row = {
      i: lead.origIndex,
      t: lead.toolId,
      e: lead.eventName,
      d: lead.deltaMs,
    };
    if (lead.detectedBy) row.b = lead.detectedBy;
    const encodedConsent = v4EncodeConsent(lead.consent, consentDefault);
    if (encodedConsent !== null) row.c = encodedConsent;
    if (lead.intercept) row.icpt = lead.intercept;
    if (lead.body) row.p = lead.body;
    if (runLen > 1) {
      const bodies = slot.run.map(m => m.body);
      const vary = v3CollectBodyVaryingKeys(bodies);
      const repObj = { n: runLen, lastDt: slot.run[runLen - 1].deltaMs };
      if (vary && vary.length > 0) {
        const lowSignal = vary.filter(k => V3_LOW_SIGNAL_KEY_HINTS.has(k.split('.').pop()));
        const highSignal = vary.filter(k => !V3_LOW_SIGNAL_KEY_HINTS.has(k.split('.').pop()));
        if (highSignal.length > 0) repObj.vary = highSignal;
        if (lowSignal.length > 0) repObj.varyLow = lowSignal;
      }
      row.r = repObj;
    }

    // Layer 2: whole-row size cap (clipboard mode only — file mode keeps the
    // full uncapped payload). Replace `p` with a structured truncation stub.
    // Uses `_trunc_event` (not `_trunc`) to keep the key types unambiguous:
    // Layer 1's `_trunc` is always a number (dropped char count), Layer 2's
    // `_trunc_event` is always boolean true. Strict parsers can discriminate
    // by key name without needing to know value-type semantics.
    if (!isFileMode) {
      const rowJson = safeStringify(row);
      if (rowJson.length > limits.eventCharCap) {
        row.p = { _trunc_event: true, originalSize: rowJson.length, reason: 'event_size_cap' };
        truncatedManifest.push({
          i: lead.origIndex,
          tool: lead.toolId,
          ev: lead.eventName,
          originalSize: rowJson.length,
          reason: 'event_size_cap',
        });
      } else if (slot.run.some(m => m.layer1Modified)) {
        truncatedManifest.push({
          i: lead.origIndex,
          tool: lead.toolId,
          ev: lead.eventName,
          reason: 'str_arr_cap',
        });
      }
    }

    events.push(row);
  }

  const omittedFields = v4DetectOmittedFields(events);

  const toolsMap = {};
  for (const [id, info] of seenTools) toolsMap[id] = info;

  const violationsCount = logical.reduce(
    (n, ev) => n + (ev.consent && ev.consent.violation === true ? 1 : 0),
    0,
  );
  const manifest = chrome.runtime.getManifest();
  const exportMeta = {
    g: manifest.name,
    v: manifest.version,
    at: new Date().toISOString(),
    type: scopeType,
    target: _exportWarningTarget,
    mode: isFileMode ? 'file' : 'clipboard',
    n: sourceEvents.length,
    rows: events.length,
    tools: seenTools.size,
    violations: violationsCount,
    ...sessionMeta,
    limits: { str: limits.stringCharCap, arr: limits.arrayItemCap, evt: limits.eventCharCap },
    truncation_hint: isFileMode
      ? 'File mode: full uncapped payload, no truncation applied'
      : 'Right-click event row → Copy JSON for full payload',
    legend: {
      i: '1-based index',
      t: 'tool id — resolve display name + category via top-level `tools` map',
      e: 'event name',
      d: 'ms since first event',
      b: 'detection pattern (e.g., "contains google-analytics.com/g/collect")',
      c: 'consent — 0 = matches _consent_default; object = diff fields, or full {..., violation:true, details?} on violation; key absent = no consent data',
      icpt: 'gtm intercept { action, from?, to? }',
      p: 'properties — parser sections in lower_snake_case, or { raw_params } fallback; Layer-1 strings wrap to {_trunc: <dropped chars>, prefix}, Layer-1 array overflow inserts {_trunc_items: <dropped count>}, Layer-2 over-cap replaces p with {_trunc_event: true, originalSize, reason}',
      r: 'fold cell { n, vary?, varyLow?, lastDt } — present only on rows that collapse a run of ≥3 identical (tool, ev) events; runs of 1–2 events stay expanded',
    },
    notes: 'Schema v4: each event is a sparse minified object. Keys absent ⇒ no data for that field. Resolve `t` via top-level `tools` map. `c:0` matches `_consent_default` exactly; diff objects list only fields that differ; omitted `violation` means false. Folded runs (≥3 identical events) occupy original indices i..i+r.n-1 implicitly. Truncation keys are distinct by type: `_trunc` (number) is Layer-1 string-cap; `_trunc_items` (number) is Layer-1 array-cap; `_trunc_event` (boolean true) is Layer-2 whole-row cap with sibling originalSize+reason.',
  };
  if (omittedFields.length > 0) exportMeta.omitted_fields = omittedFields;
  if (truncatedManifest.length > 0) exportMeta.truncated = truncatedManifest;

  const output = { _v: 4, _export: exportMeta };
  if (consentDefault) output._consent_default = consentDefault;
  output.tools = toolsMap;
  // Feature #87 — sorted snapshot of unknown hostnames (registered but unmatched
  // by any registry pattern). Same privacy filter as the `tools_unknown` Amplitude
  // telemetry property. Omitted when the panel hasn't wired the dep, the user has
  // turned off the Privacy share-unknown-endpoint-hostnames toggle, or no unknowns
  // were collected. MCP regression sweeps read this to feed /ew-platform-discover.
  if (typeof _deps.getUnknownHostnames === 'function') {
    const toolsUnknownHostnames = _deps.getUnknownHostnames();
    if (Array.isArray(toolsUnknownHostnames) && toolsUnknownHostnames.length > 0) {
      output.tools_unknown_hostnames = toolsUnknownHostnames;
    }
  }
  // Feature #94 — sorted snapshot of structural-fingerprint `"<platformId> | <hostname>"`
  // pairs (collectAssumedPairs from unknown-reporter.js). Mirrors the Amplitude
  // `devtool_page.tools_assumed` property emitted by panel.js. MCP regression
  // sweeps read this to feed /ew-platform-discover Mode C's Extend candidate harvest.
  if (typeof _deps.getAssumedPairs === 'function') {
    const toolsAssumed = _deps.getAssumedPairs();
    if (Array.isArray(toolsAssumed) && toolsAssumed.length > 0) {
      output.tools_assumed = toolsAssumed;
    }
  }
  output.events = events;

  // Two-pass for char count. File mode pretty-prints; clipboard minifies.
  const indent = isFileMode ? 2 : 0;
  const firstPass = safeStringify(output, { space: indent });
  exportMeta.chars = firstPass.length;
  const finalJson = safeStringify(output, { space: indent });

  // Feature #81 Phase 1 — publish the same payload to the page-scoped global
  // so MCP-driven regression runs can read it via evaluate_script. Service
  // worker dev-gates the relay; on CWS installs this is a no-op.
  publishAIExportToPage(output, scopeType);

  return { jsonString: finalJson, truncatedManifestCount: truncatedManifest.length };
}

