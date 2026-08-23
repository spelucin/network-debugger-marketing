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
import { syncKeepalive } from "./keepalive";
import { CaptureObserver } from "./capture-stats";
import { STATIC_ASSET_RE } from "../shared/detection/url-patterns";
import { identifySdkScript } from "../shared/detection/script-loads";
import { classifyBeacon } from "../shared/trackers";
import type { BackgroundResponse, PanelToBackgroundMessage } from "../shared/messages";
import type { MainWorldRequestPayload } from "../shared/messages";
import { STORAGE_KEYS } from "../shared/messages";
import {
  clearStorage,
  createFlusher,
  loadRequests,
  loadSettings,
  saveRequests,
  saveSettings,
} from "../storage/store";

const WATCH_URLS = [
  // ── Google Analytics 4 ─────────────────────────────────────────────────────
  "*://*.google-analytics.com/*",
  "*://*.analytics.google.com/*",
  "*://region1.google-analytics.com/*",
  "*://region2.google-analytics.com/*",
  "*://region1.analytics.google.com/*",
  "*://region2.analytics.google.com/*",

  // ── Google Tag Manager + gtag ──────────────────────────────────────────────
  "*://*.googletagmanager.com/*",

  // ── Google Ads ─────────────────────────────────────────────────────────────
  "*://*.googleadservices.com/*",
  "*://*.doubleclick.net/*",
  "*://adservice.google.com/*",
  "*://*.2mdn.net/*",
  "*://*.securepubads.g.doubleclick.net/*",
  "*://*.pubads.g.doubleclick.net/*",
  "*://*.googleads4.g.doubleclick.net/*",
  "*://*.googletagservices.com/*",
  "*://*.feedads.g.doubleclick.net/*",
  "*://pagead2.googlesyndication.com/*",
  "*://*.adtrafficquality.google/*",
  "*://stats.g.doubleclick.net/*",

  // ── Meta Pixel ─────────────────────────────────────────────────────────────
  "*://*.facebook.com/tr*",
  "*://*.facebook.net/tr*",
  "*://connect.facebook.net/*",
  "*://connect.facebook.com/*",

  // ── TikTok Pixel ───────────────────────────────────────────────────────────
  "*://analytics.tiktok.com/*",
  "*://*.tiktok.com/i18n/pixel/*",
  "*://events.tiktok.com/*",
  "*://analytics-sg.tiktok.com/*",
  "*://an.tiktok.com/*",
  "*://analytics-ipv6.tiktokw.us/*",
  "*://*.tiktokw.us/*",

  // ── Microsoft Clarity ──────────────────────────────────────────────────────
  "*://*.clarity.ms/*",

  // ── LinkedIn ───────────────────────────────────────────────────────────────
  "*://px.ads.linkedin.com/*",
  "*://linkedin.com/px*",
  "*://snap.licdn.com/*",

  // ── Pinterest ──────────────────────────────────────────────────────────────
  "*://ct.pinterest.com/*",
  "*://pinterest.com/ct.html*",
  "*://log.pinterest.com/*",
  "*://s.pinimg.com/ct/*",

  // ── Reddit ─────────────────────────────────────────────────────────────────
  "*://ads.reddit.com/*",
  "*://alb.reddit.com/*",
  "*://redditmedia.com/pixel/*",
  "*://pixel-config.reddit.com/*",
  "*://www.redditstatic.com/ads/*",

  // ── Twitter/X ──────────────────────────────────────────────────────────────
  "*://static.ads-twitter.com/*",
  "*://analytics.twitter.com/*",
  "*://t.co/i/adsct*",

  // ── Snapchat ───────────────────────────────────────────────────────────────
  "*://tr.snapchat.com/*",
  "*://tr6.snapchat.com/*",
  "*://sc-static.net/scevent*",
  "*://gcp.api.snapchat.com/*",

  // ── Amplitude ──────────────────────────────────────────────────────────────
  "*://api.amplitude.com/*",
  "*://api2.amplitude.com/*",
  "*://api.eu.amplitude.com/*",
  "*://analytics.amplitude.com/*",
  "*://cdn.amplitude.com/*",

  // ── Mixpanel ───────────────────────────────────────────────────────────────
  "*://api.mixpanel.com/*",
  "*://api-eu.mixpanel.com/*",
  "*://api-in.mixpanel.com/*",
  "*://decide.mixpanel.com/*",
  "*://api-js.mixpanel.com/*",
  "*://cdn.mxpnl.com/*",
  "*://mxpnl.com/*",

  // ── Adobe ──────────────────────────────────────────────────────────────────
  "*://*.2o7.net/*",
  "*://*.sc.omtrdc.net/*",
  "*://omniture.com/*",
  "*://*.tt.omtrdc.net/*",
  "*://demdex.net/*",
  "*://dpm.demdex.net/*",
  "*://dcs.demdex.net/*",
  "*://fast.demdex.net/*",
  "*://edge.adobedc.net/*",
  "*://server.adobedc.net/*",
  "*://*.adobedc.net/*",
  "*://assets.adobedtm.com/*",
  "*://launch.adobe.com/*",
  "*://everesttech.net/*",
  "*://pixel.everesttech.net/*",

  // ── Segment ────────────────────────────────────────────────────────────────
  "*://api.segment.io/*",
  "*://api.segment.com/*",
  "*://cdn.segment.io/*",
  "*://cdn.segment.com/*",
  "*://events.segment.io/*",
  "*://events.segment.com/*",
  "*://collect.tealiumiq.com/*",
  "*://tags.tiqcdn.com/*",

  // ── Heap ───────────────────────────────────────────────────────────────────
  "*://*.heapanalytics.com/*",
  "*://cdn.heapanalytics.com/*",
  "*://track.heap.io/*",
  "*://api.heap.io/*",
  "*://c.us.heap-api.com/*",
  "*://c.eu.heap-api.com/*",

  // ── Criteo ─────────────────────────────────────────────────────────────────
  "*://static.criteo.net/*",
  "*://dis.criteo.com/*",
  "*://sslwidget.criteo.com/*",
  "*://bidder.criteo.com/*",
  "*://gum.criteo.com/*",
  "*://rtax.criteo.com/*",
  "*://cat.criteo.com/*",
  "*://dynamic.criteo.com/*",

  // ── Bing ───────────────────────────────────────────────────────────────────
  "*://bat.bing.com/*",
  "*://bat.r.msn.com/*",
  "*://c.bing.com/*",
  "*://bat.bing.net/*",

  // ── Hotjar ─────────────────────────────────────────────────────────────────
  "*://static.hotjar.com/*",
  "*://script.hotjar.com/*",
  "*://vars.hotjar.com/*",
  "*://insights.hotjar.com/*",
  "*://in.hotjar.com/*",
  "*://ws.hotjar.com/*",

  // ── HubSpot ────────────────────────────────────────────────────────────────
  "*://js.hs-scripts.com/*",
  "*://js.hsforms.net/*",
  "*://track.hubspot.com/*",
  "*://forms.hubspot.com/*",
  "*://js.hs-analytics.net/*",
  "*://js.hsadspixel.net/*",
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

let requests: MarketingRequest[] = [];
let settings: CaptureSettings = DEFAULT_SETTINGS;
let activeTabId: number | undefined = undefined;
// Passive classification state (per-tab platform presence + throughput).
// Re-created on global clear; per-tab drops go through forgetTab().
let captureObserver = new CaptureObserver();

const flushRequests = createFlusher(saveRequests, 250);

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

/** Drop every request captured for a single tab. */
function clearTabRequests(tabId: number) {
  requests = requests.filter((r) => r.tabId !== tabId);
  captureObserver.forgetTab(tabId);
  void flushRequests.flushNow();
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
      marketing = {
        ...raw,
        platform: decoded.platform,
        eventName: decoded.eventName,
        decoded,
        unknown: false,
      };
    } else {
      marketing = {
        ...raw,
        platform: "unknown",
        unknown: true,
      };
    }

    requests.push(marketing);
    trimRequests();
    flushRequests.push(requests);
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
  registerObservationPlane();
}

// --- Observation plane -------------------------------------------------------
//
// Distinct from capture: every completed request is URL-classified (no bodies)
// to build the per-tab "what's on this page" picture and throughput metrics.
// It deliberately ignores the capture dedup window — a repeated beacon is
// still a real request — and it pauses with captureEnabled so paused state
// stays fully quiet. Loader scripts additionally yield platform IDs
// (GTM-…, G-…, AW-…) that beacons alone may never reveal.

let observationPlaneRegistered = false;

function registerObservationPlane() {
  if (observationPlaneRegistered) return;
  observationPlaneRegistered = true;
  try {
    chrome.webRequest.onCompleted.addListener(
      onCompletedRequest,
      { urls: WATCH_URLS }
    );
  } catch (error) {
    // Stats are additive; losing them must not affect capture or messaging.
    console.error("[Network Decoder] observation plane registration failed:", error);
  }
}

function onCompletedRequest(details: chrome.webRequest.WebResponseCacheDetails) {
  if (!settings.captureEnabled) return;
  const tabId = details.tabId;
  if (tabId < 0) return; // prerender / service-worker traffic has no tab
  // Ad hosts serve creatives too — an image banner from doubleclick.net is
  // not a signal that Ads tagging is on the page.
  if (STATIC_ASSET_RE.test(details.url)) return;

  // Pre-hydration: settings may still flip captureEnabled, so park the event
  // and classify it once init() settles.
  if (!ready) {
    if (pendingObservations.length < PENDING_OBSERVATION_CAP) {
      pendingObservations.push({
        tabId,
        url: details.url,
        resourceType: details.type,
      });
    }
    return;
  }
  recordObservation(tabId, details.url, details.type);
}

function recordObservation(
  tabId: number,
  url: string,
  resourceType?: string
): void {
  const startedAt = performance.now();
  const platform = classifyBeacon(url);
  const classifyMs = performance.now() - startedAt;
  captureObserver.observe(tabId, url, platform, classifyMs);

  const sdk = identifySdkScript(url, resourceType);
  if (sdk) {
    // Loader-only presence still counts — a page can load gtag/fbevents
    // without ever firing an event we can decode.
    captureObserver.noteScriptId(tabId, sdk.platform, sdk.scriptId);
  }
}

function drainPendingObservations(): void {
  while (pendingObservations.length > 0) {
    const obs = pendingObservations.shift();
    if (!obs) break;
    if (!settings.captureEnabled) continue;
    recordObservation(obs.tabId, obs.url, obs.resourceType);
  }
}

// Page-side PerformanceObserver feed: the webRequest plane is blind for
// ordinary sites (Chromium requires host access to both the request URL and
// its initiator), so the content script reports tracker-relevant resource
// loads instead. URLs arrive pre-filtered by the page script.
function ingestMainWorldResources(
  urls: string[],
  sender: chrome.runtime.MessageSender | undefined
) {
  const tabId = sender?.tab?.id;
  if (tabId === undefined || tabId < 0) return;
  for (const url of urls.slice(0, 500)) {
    if (!ready) {
      if (pendingObservations.length < PENDING_OBSERVATION_CAP) {
        pendingObservations.push({ tabId, url, resourceType: undefined });
      }
      continue;
    }
    recordObservation(tabId, url, undefined);
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
    case "get-capture-stats":
      if (!ready) await whenReady;
      return {
        ok: true,
        stats: captureObserver.snapshot(message.tabId ?? activeTabId),
      };
    case "mainworld-request":
      ingestMainWorld(message.payload, sender);
      return { ok: true, requests };
    case "mainworld-resources":
      if (settings.captureEnabled) ingestMainWorldResources(message.urls, sender);
      return { ok: true, requests };
    case "clear-capture":
      requests = [];
      captureObserver = new CaptureObserver();
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
// Observation-plane twin of pendingRequests: SDK loader scripts fire at the
// very start of a navigation, which is exactly when hydration is still in
// flight. Without this buffer, "what's on this page" misses page-load traffic.
interface PendingObservation {
  tabId: number;
  url: string;
  resourceType?: string;
}
const PENDING_OBSERVATION_CAP = 500;
const pendingObservations: PendingObservation[] = [];

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
    const [storedSettings, storedRequests] = await Promise.all([
      loadSettings(),
      loadRequests(),
    ]);
    settings = storedSettings;
    syncKeepalive(settings.captureEnabled);
    requests = storedRequests;
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
  drainPendingObservations();
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