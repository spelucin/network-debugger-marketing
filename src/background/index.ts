import {
  normalizeRequest,
  type WebRequestLike,
} from "../core/normalize";
import {
  DEFAULT_SETTINGS,
  isRecording,
  type CaptureSettings,
  type MarketingRequest,
} from "../core/types";
import { resolveParser } from "../parsers";
import { runQa, type QaContext, type QaEventEntry } from "../qa/engine";
import { syncKeepalive } from "./keepalive";
import type { BackgroundResponse, PanelToBackgroundMessage } from "../shared/messages";
import type { MainWorldRequestPayload } from "../shared/messages";
import { STORAGE_KEYS } from "../shared/messages";
import {
  clearStorage,
  createFlusher,
  loadQaEvents,
  loadRequests,
  loadSettings,
  saveQaEvents,
  saveRequests,
  saveSettings,
} from "../storage/store";

const WATCH_URLS = [
  // GA4 + Tag Manager
  "*://*.google-analytics.com/*",
  "*://*.googletagmanager.com/*",
  // Google Ads
  "*://*.googleadservices.com/*",
  "*://*.doubleclick.net/*",
  "*://adservice.google.com/*",
  // Meta Pixel — event beacon and pixel config
  "*://*.facebook.com/tr*",
  "*://*.facebook.net/tr*",
  "*://connect.facebook.net/signals/*",
  // TikTok Pixel — event beacon and SDK/config
  "*://analytics.tiktok.com/api/v2/pixel/*",
  "*://analytics.tiktok.com/i18n/pixel/*",
  // Microsoft Clarity
  "*://*.clarity.ms/*",
];

// Only page/document/style navigations are irrelevant to tracking beacons.
const CAPTURE_TYPES = new Set([
  "xmlhttprequest",
  "beacon",
  "ping",
  "image",
  "script",
  "object",
  "other",
]);

const MAX_QA_EVENTS = 2000;

let requests: MarketingRequest[] = [];
let settings: CaptureSettings = DEFAULT_SETTINGS;
let qaContext: QaContext = { events: [] };
let activeTabId: number | undefined = undefined;

const flushRequests = createFlusher(saveRequests, 250);
const flushQa = createFlusher((events) => saveQaEvents(events as unknown[]), 500);

let badgeTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleBadge(count: number) {
  if (badgeTimer) return;
  badgeTimer = setTimeout(() => {
    badgeTimer = undefined;
    const text = count > 0 ? String(count) : "";
    void chrome.action.setBadgeText({ text }).catch(() => undefined);
    void chrome.action.setBadgeBackgroundColor({ color: "#6e6bf8" }).catch(() => undefined);
  }, 400);
}

function trimRequests() {
  const limit = Math.max(100, settings.retainLimit || 5000);
  if (requests.length > limit) {
    requests.splice(0, requests.length - limit);
  }
}

/** The requests the panel should show given the current recording scope. */
function visibleRequests(): MarketingRequest[] {
  if (settings.recordAllTabs) return requests;
  if (activeTabId === undefined) return requests;
  return requests.filter((r) => r.tabId === activeTabId);
}

/** Drop every request (and related QA context) captured for a single tab. */
function clearTabRequests(tabId: number) {
  requests = requests.filter((r) => r.tabId !== tabId);
  const ids = new Set(requests.map((r) => r.id));
  qaContext.events = qaContext.events.filter((e) => ids.has(e.id));
  void Promise.all([flushRequests.flushNow(), flushQa.flushNow()]);
  scheduleBadge(visibleRequests().length);
}

async function persistActiveTab(tabId: number | undefined) {
  activeTabId = tabId;
  try {
    await chrome.storage.session.set({ [STORAGE_KEYS.activeTab]: tabId });
  } catch {
    // storage.session may be unavailable in very old Chrome; the snapshot
    // response still carries the active tab id.
  }
  scheduleBadge(visibleRequests().length);
}

async function refreshActiveTab() {
  try {
    const win = await chrome.windows.getLastFocused();
    if (!win || win.id === chrome.windows.WINDOW_ID_NONE) return;
    const tabs = await chrome.tabs.query({ active: true, windowId: win.id });
    const tab = tabs.find((t) => t.active);
    await persistActiveTab(tab?.id);
  } catch {
    // Best-effort; the panel falls back to showing all requests if unknown.
  }
}

// Dedup window for requests observed by both capture paths (webRequest and
// page-level hooks fire for the same call within milliseconds).
const recentCaptures = new Map<string, number>();
const DEDUP_TTL_MS = 2000;

function captureKey(tabId: number, method: string, url: string): string {
  return `${tabId}|${method.toUpperCase()}|${url}`;
}

function markCaptured(key: string) {
  const now = Date.now();
  recentCaptures.set(key, now);
  if (recentCaptures.size > 1000) {
    for (const [k, at] of recentCaptures) {
      if (now - at > DEDUP_TTL_MS) recentCaptures.delete(k);
    }
  }
}

function wasRecentlyCaptured(key: string): boolean {
  const at = recentCaptures.get(key);
  return at !== undefined && Date.now() - at < DEDUP_TTL_MS;
}

/** Ingest a tracking call reported by the page-level main-world hooks. */
function ingestMainWorld(
  payload: MainWorldRequestPayload,
  sender: chrome.runtime.MessageSender | undefined
) {
  const tabId = sender?.tab?.id ?? -1;
  if (wasRecentlyCaptured(captureKey(tabId, payload.method, payload.url))) {
    return;
  }

  const bytes =
    payload.bodyText !== undefined
      ? new TextEncoder().encode(payload.bodyText)
      : undefined;
  const details = {
    requestId: `mw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tabId,
    url: payload.url,
    method: payload.method || "GET",
    type: "xmlhttprequest",
    ...(bytes ? { requestBody: { raw: [{ bytes: bytes.buffer }] } } : {}),
  } as chrome.webRequest.WebRequestBodyDetails;

  // Same cold-start buffering as the webRequest path.
  if (!ready) {
    pendingRequests.push(details);
    return;
  }
  if (!settings.captureEnabled) return;
  processRequest(details);
}

function processRequest(details: chrome.webRequest.WebRequestBodyDetails) {
  if (!CAPTURE_TYPES.has(details.type ?? "other")) return;

  // Both capture paths (webRequest and page-level hooks) observe the same
  // calls; the first one to record wins and duplicates are dropped for a
  // short window.
  const dedupKey = captureKey(
    details.tabId,
    details.method ?? "GET",
    details.url
  );
  if (wasRecentlyCaptured(dedupKey)) return;
  markCaptured(dedupKey);

  try {
    const raw = normalizeRequest(details as WebRequestLike);
    const parser = resolveParser(raw);
    let marketing: MarketingRequest;

    if (parser) {
      const decoded = parser.parse(raw);
      const qa = runQa(decoded, raw, qaContext);
      qaContext.events.push(qa.entry);
      if (qaContext.events.length > MAX_QA_EVENTS) {
        qaContext.events.splice(0, qaContext.events.length - MAX_QA_EVENTS);
      }
      marketing = {
        ...raw,
        platform: decoded.platform,
        eventName: decoded.eventName,
        decoded,
        qa: qa.issues,
        unknown: false,
      };
    } else {
      marketing = {
        ...raw,
        platform: "unknown",
        qa: [],
        unknown: true,
      };
    }

    requests.push(marketing);
    trimRequests();
    flushRequests.push(requests);
    flushQa.push(qaContext.events);
    scheduleBadge(visibleRequests().length);
  } catch {
    // Defensive: a failing parse must never affect page requests.
  }
}

function onBeforeRequest(details: chrome.webRequest.WebRequestBodyDetails) {
  // The install-time self-test beacon only proves delivery; never store it.
  if (details.url.includes(SELF_TEST_MARKER)) {
    sawSelfTest = true;
    return;
  }
  // The worker boots with default settings until init() hydrates the stored
  // ones. Buffer everything that arrives during that window and reprocess it
  // once ready, so a short burst of tracking at page load is never dropped.
  if (!ready) {
    pendingRequests.push(details);
    return;
  }
  if (!settings.captureEnabled) return;
  processRequest(details);
}

function registerWebRequest() {
  try {
    chrome.webRequest.onBeforeRequest.addListener(
      onBeforeRequest,
      { urls: WATCH_URLS },
      // onBeforeRequest only supports "blocking" and "requestBody".
      // Request headers are not available on this event without the
      // onBeforeSendHeaders listener, so we don't request them.
      ["requestBody"]
    );
    console.info("[Network Decoder] webRequest observer registered");
  } catch (error) {
    // Never let a failed listener registration kill the worker: messaging and
    // init must still run so the panel can show stored requests.
    console.error("[Network Decoder] webRequest registration failed:", error);
  }
}

async function handleMessage(
  message: PanelToBackgroundMessage,
  sender?: chrome.runtime.MessageSender
): Promise<BackgroundResponse> {
  switch (message.type) {
    case "get-snapshot":
      if (!ready) await whenReady;
      return { ok: true, snapshot: { requests, settings }, activeTabId };
    case "mainworld-request":
      ingestMainWorld(message.payload, sender);
      return { ok: true, requests };
    case "clear-capture":
      requests = [];
      qaContext = { events: [] };
      await clearStorage();
      void chrome.action.setBadgeText({ text: "" }).catch(() => undefined);
      return { ok: true, requests };
    case "clear-tab":
      clearTabRequests(message.tabId);
      return { ok: true, requests };
    case "set-capture-enabled": {
      settings = { ...settings, captureEnabled: message.enabled };
      await saveSettings(settings);
      syncKeepalive(settings.captureEnabled);
      scheduleBadge(visibleRequests().length);
      return { ok: true, settings };
    }
    case "set-record-scope": {
      settings = {
        ...settings,
        recordThisTab: message.thisTab,
        recordAllTabs: message.allTabs,
      };
      await saveSettings(settings);
      scheduleBadge(visibleRequests().length);
      return { ok: true, settings };
    }
    case "set-settings": {
      settings = { ...settings, ...message.settings };
      await saveSettings(settings);
      syncKeepalive(settings.captureEnabled);
      scheduleBadge(visibleRequests().length);
      return { ok: true, settings };
    }
  }
}

function registerMessaging() {
  chrome.runtime.onMessage.addListener(
    (message: PanelToBackgroundMessage, sender, sendResponse) => {
      handleMessage(message, sender)
        .then(sendResponse)
        .catch((error) => {
          sendResponse({ ok: false, error: String(error) });
        });
      return true; // async response
    }
  );
}

let ready = false;
let resolveReady: (() => void) | undefined;
const whenReady = new Promise<void>((resolve) => {
  resolveReady = resolve;
});
// Web requests that arrived while the worker was still hydrating state are
// buffered and reprocessed once init() completes, so a short burst of tracking
// at page load is never dropped before settings are loaded.
const pendingRequests: chrome.webRequest.WebRequestBodyDetails[] = [];
// Navigations that fired while the worker was still hydrating state are
// replayed once init() completes so a tab reload never leaves stale data.
const pendingNavClears = new Set<number>();

// Install-time self-test: proves webRequest delivery works in this browser
// profile. A silently dead observer is the #1 way capture fails with no
// visible error (adblockers, withheld site access, stale extension loads).
const SELF_TEST_MARKER = "ND-SELFTEST";
const SELF_TEST_URL = `https://www.googletagmanager.com/gtc.js?id=${SELF_TEST_MARKER}`;
let sawSelfTest = false;

function runSelfTest() {
  sawSelfTest = false;
  setTimeout(() => {
    void fetch(SELF_TEST_URL, { mode: "no-cors" }).catch(() => undefined);
    setTimeout(() => {
      if (sawSelfTest) {
        console.info(
          "[Network Decoder] self-test passed: webRequest delivery confirmed"
        );
        return;
      }
      console.error(
        "[Network Decoder] webRequest events are NOT being delivered " +
          "(adblocker, Site access, or browser limitation). Capture will " +
          "still work through the in-page hooks."
      );
      void chrome.action.setBadgeText({ text: "!" }).catch(() => undefined);
      void chrome.action
        .setBadgeBackgroundColor({ color: "#dc2626" })
        .catch(() => undefined);
    }, 5000);
  }, 2000);
}

async function init() {
  try {
    const [storedSettings, storedRequests, storedQa] = await Promise.all([
      loadSettings(),
      loadRequests(),
      loadQaEvents(),
    ]);
    settings = storedSettings;
    syncKeepalive(settings.captureEnabled);
    requests = storedRequests;
    qaContext = { events: storedQa as QaEventEntry[] };
  } catch (error) {
    // Hydration must never brick capture: fall back to defaults so the
    // worker keeps serving snapshots and processing requests.
    console.error("[Network Decoder] hydration failed; using defaults:", error);
  }
  await refreshActiveTab();
  scheduleBadge(visibleRequests().length);
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch {
    // sidePanel API may be unavailable in very old Chrome; degrade gracefully
  }
  ready = true;
  resolveReady?.();
  // Replay queued navigations before queued requests: a navigation logically
  // precedes that page's tracking burst, so clearing first keeps the burst.
  for (const tabId of pendingNavClears) clearTabRequests(tabId);
  pendingNavClears.clear();
  const buffered = pendingRequests.splice(0);
  for (const details of buffered) {
    if (settings.captureEnabled) processRequest(details);
  }
}

/** Clear a tab's capture history when it starts a new page load. */
function handleNavigation(tabId: number) {
  if (!ready) {
    pendingNavClears.add(tabId);
    return;
  }
  if (!settings.captureEnabled) return;
  // Recording keeps the list across refreshes and domain changes; without it
  // the view is transient and starts fresh on every navigation.
  if (isRecording(settings)) return;
  clearTabRequests(tabId);
}

// Register listeners synchronously so the worker is ready for events, then
// hydrate state asynchronously.
try {
  const manifest = chrome.runtime.getManifest();
  console.info(
    `[Network Decoder] boot v${manifest.version} — permissions: ${
      manifest.permissions?.join(", ") ?? "none"
    }`
  );
} catch {
  // Diagnostics must never break the worker.
}
registerWebRequest();
registerMessaging();
syncKeepalive(settings.captureEnabled);
void init();

chrome.tabs.onActivated.addListener((info) => {
  const prev = activeTabId;
  void persistActiveTab(info.tabId);
  // Recording across all tabs keeps every tab's history; any other scope
  // starts fresh on the newly activated tab.
  if (prev !== undefined && prev !== info.tabId && !settings.recordAllTabs) {
    clearTabRequests(prev);
    clearTabRequests(info.tabId);
  }
});
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") handleNavigation(tabId);
});
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) void refreshActiveTab();
});

// A connected Port (e.g. from the always-open side panel) keeps this service
// worker alive, so tracking fired while the panel is open is never affected
// by an idle suspension.
const keepAlivePorts = new Set<chrome.runtime.Port>();
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "nd-keepalive") return;
  keepAlivePorts.add(port);
  port.onDisconnect.addListener(() => keepAlivePorts.delete(port));
});

chrome.runtime.onInstalled.addListener(() => {
  void init();
  runSelfTest();
});
chrome.runtime.onStartup.addListener(() => void init());