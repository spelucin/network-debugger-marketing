// @ts-check
// Message Catalogue - the written contract for the cross-context message
// protocol (Feature #135 finding B; WP2).
//
// Every `{ type: ... }` message that crosses a context boundary is named
// here, with its hop and payload. Until this file the protocol was 40+
// scattered string literals across three transport hops with no payload
// documentation anywhere.
//
// THE THREE HOPS
//   1. page <-> content      window.postMessage
//        The page script (event-watcher-page.js) runs in the page's JS
//        context with no chrome.* access; the content script bridges. The
//        content listener guards `event.source === window`.
//   2. content -> SW         chrome.runtime.sendMessage
//        Forwarded page captures plus content-script-detected signals.
//        Reverse direction (SW -> content) uses chrome.tabs.sendMessage.
//   3. panel/sidepanel <-> SW
//        chrome.runtime.sendMessage for request/response, PLUS a persistent
//        port per panel (`devtools-panel-<tabId>`).
//
// CHANNEL DECISION (KEEP - affirmed by #135 finding B): the dual
// port + sendMessage channel is deliberate, not debt. The persistent port
//   - keeps the SW alive while DevTools is open,
//   - gives the SW a direct push path to specific panels
//     (devtoolsPanels Map -> port.postMessage), avoiding the SW self-call
//     routing tangle that `chrome.runtime.sendMessage` from SW context hits
//     (manifested as eval timeouts; see service-worker.js __mcpClearPanelEvents),
//   - re-syncs state on SW restart: ports disconnect, panels reconnect and
//     re-send PANEL_CONNECTED so devtools-scoped DNR rules are rebuilt.
// Do not unify onto a single channel.
//
// CLASSIC-SCRIPT EXCEPTION: event-watcher-content.js and
// event-watcher-page.js are classic scripts and CANNOT import this module.
// They keep string literals; tests/shared/message-catalogue-guard.test.mjs
// asserts every literal they use exists here (and that every entry here is
// still constructed and handled somewhere). Module contexts (panel,
// sidepanel, service worker, panel components) must use these constants -
// the guard fails on new bare literals there.
//
// Each value equals its key (guard-asserted) so logs stay greppable.

export const MSG = Object.freeze({
  // ── Hop 1: page -> content (window.postMessage, { type, payload }) ────────
  /** dataLayer push (or navigation: payload._type === 'navigation'). */
  EVENT_DEBUGGER_EVENT: 'EVENT_DEBUGGER_EVENT',
  /** Tealium utag_data / utag.link|view capture. */
  TEALIUM_EVENT: 'TEALIUM_EVENT',
  /** Adobe Launch / ACDL push capture. */
  ADOBE_LAUNCH_EVENT: 'ADOBE_LAUNCH_EVENT',
  /** W3C digitalData push capture. */
  W3C_DIGITALDATA_EVENT: 'W3C_DIGITALDATA_EVENT',
  /** Commanders Act tc_vars capture. */
  COMMANDERSACT_EVENT: 'COMMANDERSACT_EVENT',
  /** Relay42 defined42 capture. */
  RELAY42_EVENT: 'RELAY42_EVENT',
  /** Ensighten data layer capture. */
  ENSIGHTEN_EVENT: 'ENSIGHTEN_EVENT',
  /** CMP consent state read from the window API (also the content->SW name). */
  CMP_CONSENT_STATE: 'CMP_CONSENT_STATE',

  // ── Hop 1 reverse: content -> page (window.postMessage) ───────────────────
  /** Replay a dataLayer push into the page ("Push again", payload = push). */
  EVENT_WATCHER_PUSH_DATALAYER: 'EVENT_WATCHER_PUSH_DATALAYER',
  /** Dev-only: deliver a fresh AI export to the page bridge global
   *  (window.__eventWatcher.lastAIExport). Adds { source: 'event-watcher',
   *  payload, ts, exportId, scopeType }. Feature #81. */
  COPY_FOR_AI_EXPORT: 'COPY_FOR_AI_EXPORT',

  // ── Hop 2: content -> SW (chrome.runtime.sendMessage, { type, data }) ─────
  /** Page navigation detected (forwarded EVENT_DEBUGGER_EVENT navigation). */
  PAGE_NAVIGATION: 'PAGE_NAVIGATION',
  /** Forwarded dataLayer push. */
  DATALAYER_PUSH: 'DATALAYER_PUSH',
  /** Forwarded Tealium capture. */
  TEALIUM_PUSH: 'TEALIUM_PUSH',
  /** Forwarded Adobe Launch capture. */
  ADOBE_LAUNCH_PUSH: 'ADOBE_LAUNCH_PUSH',
  /** Forwarded W3C digitalData capture. */
  W3C_DIGITALDATA_PUSH: 'W3C_DIGITALDATA_PUSH',
  /** Forwarded Commanders Act capture. */
  COMMANDERSACT_PUSH: 'COMMANDERSACT_PUSH',
  /** Forwarded Relay42 capture. */
  RELAY42_PUSH: 'RELAY42_PUSH',
  /** Forwarded Ensighten capture. */
  ENSIGHTEN_PUSH: 'ENSIGHTEN_PUSH',
  /** User interaction (click / change / submit), { data: interaction }. */
  INTERACTION_EVENT: 'INTERACTION_EVENT',
  /** Page script injection was blocked (CSP), { data: { url, reason } }. */
  PAGE_SCRIPT_BLOCKED: 'PAGE_SCRIPT_BLOCKED',

  // ── Hop 2 reverse: SW -> content (chrome.tabs.sendMessage) ────────────────
  /** Relay a panel "Push again" payload to the page, { payload }. */
  PUSH_DATALAYER_TO_PAGE: 'PUSH_DATALAYER_TO_PAGE',
  /** Dev-only: relay an AI export toward the page bridge (Feature #81),
   *  { payload, ts, exportId, scopeType }. */
  AI_EXPORT_TO_PAGE: 'AI_EXPORT_TO_PAGE',

  // ── Hop 3: panel -> SW (sendMessage unless noted; responses via
  //    sendResponse) ──────────────────────────────────────────────────────────
  /** Request buffered events for a tab, { tabId } -> { events: [] }. */
  GET_EVENTS: 'GET_EVENTS',
  /** Clear SW-buffered events for a tab, { tabId }. Also sent by sidepanel. */
  CLEAR_EVENTS: 'CLEAR_EVENTS',
  /** Ask the SW for chrome.management installType -> { installType }. */
  GET_INSTALL_TYPE: 'GET_INSTALL_TYPE',
  /** Resolve the inspected tab's URL, { tabId } -> { url }. */
  GET_TAB_URL: 'GET_TAB_URL',
  /** Resolve the tab's cookieStoreId (incognito-aware cookie reads). */
  GET_TAB_COOKIE_STORE: 'GET_TAB_COOKIE_STORE',
  /** Read consent cookies for the inspected page, { tabId, url, ... }. */
  READ_CONSENT_COOKIES: 'READ_CONSENT_COOKIES',
  /** BYOK AI call relayed through the SW (fetch lives there),
   *  { provider, request } -> provider response/error contract. */
  AI_REQUEST: 'AI_REQUEST',
  /** Read in-session AI usage totals -> usage object. */
  GET_AI_USAGE: 'GET_AI_USAGE',
  /** Reset in-session AI usage totals (panel Clear). */
  RESET_AI_SESSION_USAGE: 'RESET_AI_SESSION_USAGE',
  /** Dev-only: hand a fresh "Copy for AI" payload to the SW for the page
   *  bridge (Feature #81), { payload, ts, exportId, scopeType, tabId }. */
  PUBLISH_AI_EXPORT: 'PUBLISH_AI_EXPORT',
  /** "Push again": ask the SW to replay a dataLayer event into the page,
   *  { tabId, payload }. */
  PUSH_DATALAYER_EVENT: 'PUSH_DATALAYER_EVENT',
  /** GTM intercept rules changed - SW re-syncs DNR rules. Sent by
   *  gtm-intercept.js / panel.js after rule CRUD. */
  GTM_INTERCEPT_UPDATED: 'GTM_INTERCEPT_UPDATED',
  /** Panel lifecycle: sent over the persistent port on connect (also has a
   *  sendMessage fallback path), { tabId }. Registers the port in the SW's
   *  devtoolsPanels Map and re-syncs devtools-scoped DNR rules. */
  PANEL_CONNECTED: 'PANEL_CONNECTED',
  /** Panel lifecycle counterpart of PANEL_CONNECTED, { tabId }. */
  PANEL_DISCONNECTED: 'PANEL_DISCONNECTED',

  // ── Hop 3: sidepanel -> SW ─────────────────────────────────────────────────
  /** Read per-tab badge platform list, { tabId } -> { platforms }. */
  GET_BADGE_PLATFORMS: 'GET_BADGE_PLATFORMS',
  /** Clear per-tab badge platform list, { tabId }. */
  CLEAR_BADGE_PLATFORMS: 'CLEAR_BADGE_PLATFORMS',
  /** Persist the sidepanel view mode preference. */
  SET_VIEW_MODE: 'SET_VIEW_MODE',

  // ── Hop 3 reverse: SW -> panel ─────────────────────────────────────────────
  /** Sent over the persistent port (NOT sendMessage - see channel decision):
   *  MCP-driven clear of the panel's event stream (Feature #81 Phase 2,
   *  BUG42 inter-URL clears). */
  MCP_CLEAR_PANEL_EVENTS: 'MCP_CLEAR_PANEL_EVENTS',
});

// Removed 2026-06-11 (#135 WP2 zombie cleanup) - do not re-add without BOTH
// a sender and a handler:
//   ANALYTICS_EVENT            dead inbound: SW + panel handled it, nothing sent it
//   GTM_CONTAINER_BLOCKED      dead outbound: content script sent it into the void
//   DATALAYER_SETTINGS_UPDATED dead outbound: settings.js sent it into the void
//                              (page script reads settings from storage at
//                              document_start; changes apply on next navigation)
