// @ts-check
// Event Shape - the written contract for the captured-event object
// (Feature #135 finding A; WP2).
//
// ~49 parser functions in panel/request-handlers.js build event objects that
// funnel through panel.js addEvent(); the consumers are event-list,
// event-detail, copy-export, and the AI context serializer. Until this file,
// the shape lived nowhere - it was learned by imitating the previous parser.
// These typedefs are that missing contract.
//
// DESIGN NOTES (read before "fixing" anything here):
//   - Pure JSDoc. This module ships zero runtime bytes (the lone `export {}`
//     makes it a module so `import('../shared/event-shape.js').CapturedEvent`
//     annotations resolve). The no-build constraint is untouched.
//   - Events are DELIBERATELY expando objects. Post-creation mutation is
//     shipped design: addEvent() assigns id/timestamps, correlation adds
//     `triggeredBy`, the consent engine caches `_consentCheck`, GTM intercept
//     annotates `formatted.interceptAction`, users add `userComment`. The
//     typedef documents the load-bearing fields; platform parsers may carry
//     additional fields the detail renderer knows per-platform.
//   - Underscore-prefixed fields are caches/internal: they may be deleted at
//     any time (consent invalidation deletes `_consentCheck`) and must never
//     be exported or persisted.
//   - When you ADD a load-bearing field: document it here in the same change.
//     This file rots the way the file-organization rule's line counts rotted
//     unless edits travel together.

/**
 * A captured event as it lives in panel state (`state.events[]`) after
 * addEvent() enrichment. Parsers construct a subset of this (no `id` /
 * `timestamp` required - addEvent() fills them); consumers see the full
 * shape.
 *
 * @typedef {Object} CapturedEvent
 * @property {string} id - UUID, assigned by addEvent() when absent.
 * @property {string} platform - Registry platform id (e.g. 'ga4'), or a
 *   pseudo-platform: 'datalayer', 'pages' (navigation), 'interactions',
 *   'other' (unmatched tracking), or a custom-endpoint id.
 * @property {string} [platformName] - Display name (e.g. 'GA4').
 * @property {string} [eventName] - Parsed event name (e.g. 'purchase',
 *   'gtm.js', a dataLayer event name, or a script-load label).
 * @property {number} timestamp - Epoch ms when the event/request STARTED.
 *   Assigned by addEvent() from event.timestamp || raw.timestamp || now.
 * @property {number} finishTimestamp - Epoch ms when it finished (network
 *   requests; equals `timestamp` for dataLayer events).
 * @property {number} duration - Request duration in ms (0 for non-network).
 * @property {RawRequest} [raw] - Transport-level data (absent on synthetic
 *   events such as consent markers interleaved at render time).
 * @property {FormattedEvent} [formatted] - Parser output for rendering.
 * @property {boolean} [isNavigation] - Page-navigation event ('pages').
 * @property {boolean} [isInteraction] - User-interaction event (click etc.).
 * @property {boolean} [isScriptLoad] - Script/library load, not a beacon.
 * @property {boolean} [isWarning] - Warning-styled synthetic event.
 * @property {boolean} [isCustomEndpoint] - Matched a user-defined endpoint.
 * @property {number|string} [status] - HTTP status for network events.
 * @property {string} [detectionMethod] - How the platform was identified
 *   (e.g. 'pattern', 'fingerprint', 'cname').
 * @property {string} [detectedBy] - Human-readable detection attribution.
 * @property {TriggeredBy} [triggeredBy] - Correlation enrichment added by
 *   addEvent() when a recent dataLayer/GTM trigger explains this event.
 * @property {string} [userComment] - User-authored comment (Feature #50).
 *   Lives inside the Overview card, persists for the session only.
 * @property {Object} [_consentCheck] - CACHE. Memoised consent verdict for
 *   this event ({ status: 'granted'|'denied'|'pre-consent'|'unknown'|null,
 *   ... }). Written by the consent engine, deleted wholesale on timeline
 *   changes (#131 F3) - never read it directly; go through
 *   getConsentCheckForEvent().
 * @property {Object} [_searchCache] - CACHE. Smart-search haystack memo.
 * @property {Object} [_aiSummaries] - Per-task AI chat threads keyed by task
 *   preset id (AI Summary section, #17). Session-only.
 */

/**
 * Transport-level request data, built by getRequestMeta() in
 * request-handlers.js from the DevTools HAR entry.
 *
 * @typedef {Object} RawRequest
 * @property {string} url
 * @property {string} method - 'GET', 'POST', ... ('GET' default).
 * @property {string} type - HAR resource type ('xhr', 'script', 'image', ...).
 * @property {number} timestamp - Request start, epoch ms.
 * @property {number} finishTimestamp - Request finish, epoch ms.
 * @property {number} duration - Total elapsed ms.
 * @property {Object} [params] - Parsed query/body params (parser-specific).
 * @property {string|null} [postData] - Raw POST body when present.
 * @property {Object} [harData] - Minimum fields to reconstruct a valid HAR
 *   entry for "Copy as HAR" (headers, sizes, timings, status, ...).
 * @property {Object|null} [initiator] - Chrome `_initiator` field.
 * @property {string} [initiatorType] - Script-initiator classification
 *   ('script', 'tagmanager', ...) when resolvable at the transport level.
 * @property {string} [initiatorUrl] - URL of the initiating script.
 */

/**
 * Parser presentation output. The section layout contract (order, expanded
 * defaults, the `diagnostic` flag) is governed by the detection-patterns
 * rule - see `.claude/rules/detection-patterns.md`.
 *
 * @typedef {Object} FormattedEvent
 * @property {Object} [overview] - Key/value pairs for the Overview card
 *   (human-readable labels, e.g. { 'Measurement ID': 'G-XXX' }).
 * @property {FormattedSection[]} [sections] - Collapsible detail sections
 *   (Consent, Custom Data, E-Commerce, ...), rendered in array order.
 * @property {Object} [params] - System/protocol data as grouped objects,
 *   rendered as the Parsed Data section.
 * @property {'table'} [parsedDisplayMode] - Renders `params` as a table.
 * @property {Object} [consentSignals] - Google consent chips data - Google
 *   tags only, built via buildConsentSignals() (see panel-code rule).
 * @property {string} [detectedBy] - Detection attribution for the UI.
 * @property {string} [eventName] - Parser-level event name override.
 * @property {number} [pushIndex] - dataLayer push sequence number.
 * @property {number} [eventIndex] - Alternative sequence field (vendor DLs).
 * @property {string} [containerId] - GTM container id (GTM events only).
 * @property {string} [interceptAction] - GTM intercept annotation:
 *   'blocked' | 'swapped' | 'preview' | 'swapped_away'. ('injected' was
 *   removed in v1.0.3 per CWS MV3 policy - do not reintroduce.)
 * @property {string} [proxyHost] - sGTM proxy supplier marker (e.g. 'stape').
 * @property {Object} [supplier] - Supplier annotation (#65/#80).
 * @property {string} [url] - Page URL (navigation events).
 * @property {string} [scriptUrl] - Loaded script URL (script-load events).
 * @property {string} [initiatorType] - Script-initiator classification for
 *   script-load events ('script', 'tagmanager', ...).
 * @property {string} [initiatorUrl] - URL of the initiating script.
 * @property {string} [initiatorPlatform] - Registry id of the initiating
 *   platform when identified.
 */

/**
 * One collapsible section in the event detail view. All sections use
 * type 'table' today.
 *
 * @typedef {Object} FormattedSection
 * @property {string} title - Section heading (e.g. 'Consent Mode').
 * @property {'table'} type
 * @property {Object} data - Rows: { key: value } or grouped
 *   { 'Sub-group': { key: value } }.
 * @property {boolean} [expanded] - Initial expand state (Consent: false;
 *   Custom Data / E-Commerce: true).
 * @property {boolean} [sortRows] - false preserves insertion order
 *   (E-Commerce items).
 * @property {boolean} [diagnostic] - Debug dump, not the tracked payload.
 *   "Copy for Human" filters these out (only tealium.js sets it today).
 */

/**
 * Correlation enrichment: which dataLayer/GTM trigger most plausibly caused
 * this event. Added by addEvent(); consumed by event rows + detail view.
 *
 * @typedef {Object} TriggeredBy
 * @property {string} dataLayerEventId - id of the triggering CapturedEvent.
 * @property {string} dataLayerEventName
 * @property {number} [dataLayerPushIndex]
 * @property {string} dataLayerPlatform
 * @property {number} timeDelta - ms between trigger and this event.
 */

/**
 * Unified 3-category consent state (the project-wide contract — cookie
 * parsers, window-API readers, push parsers, UI, and export all use these
 * three categories; see the consent-categories block in MEMORY/docs).
 *
 * @typedef {Object} ConsentCategories
 * @property {'granted'|'denied'} [analytics]
 * @property {'granted'|'denied'} [marketing]
 * @property {'granted'|'denied'} [functional]
 */

/**
 * One entry in `state.consentTimeline` (append-only, timestamp-sorted via
 * addConsentTimelineEntry()). timestamp 0 means prior consent / historical
 * state (returning-visitor cookie), deliberately excluded from
 * firstConsentTimestamp.
 *
 * @typedef {Object} ConsentTimelineEntry
 * @property {number} timestamp - Epoch ms, or 0 for prior-consent entries.
 * @property {string} source - 'cookie' | 'window-api' | 'cmp-push' |
 *   'cmp-lifecycle' | 'google-cm' (google-cm is a signal relay, filtered
 *   from markers).
 * @property {string} [sourceLabel] - Display label (e.g. 'OneTrust cookie').
 * @property {string} [cmp] - CMP platform id.
 * @property {string} [action] - 'default' | 'update' | 'prior-consent' |
 *   'confirmed' | 'set'.
 * @property {string} [completeness] - 'full' (per-category) | 'binary'
 *   (accepted/rejected only).
 * @property {ConsentCategories} categories - Unified 3-category state.
 * @property {string} [eventId] - Linked CapturedEvent id when the entry was
 *   derived from a captured event.
 */

/**
 * A consent-state marker interleaved into the event stream, derived from the
 * timeline by rebuildConsentStateMarkers() (deduped on effective state).
 *
 * @typedef {Object} ConsentMarker
 * @property {string} id - `consent-marker-<timestamp>-<source>`.
 * @property {number} timestamp
 * @property {'consent-state'} type
 * @property {string} action - See ConsentTimelineEntry.action.
 * @property {string} actionLabel - Display label: 'Returning' | 'Default' |
 *   'Update' | 'Confirmed' | 'Set' | 'Given' | 'Updated'.
 * @property {string} source
 * @property {string} sourceLabel
 * @property {string|null} cmp
 * @property {ConsentCategories} categories
 * @property {string} completeness
 * @property {ConsentTimelineEntry} timelineEntry - Backing entry.
 */

export {};
