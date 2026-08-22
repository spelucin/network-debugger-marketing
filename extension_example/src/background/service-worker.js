// Event Watcher - Background Service Worker

import { matchUrlToEndpoint, BADGE_ENDPOINT_COUNT } from './badge-endpoints.js';
import { MSG } from '../shared/messages.js';
import { KNOWN_TRACKING_ENDPOINTS, PLATFORM_COUNT } from '../shared/platform-registry.js';
import { formatTealiumEventData } from '../shared/detection/parsers/tealium.js';
import { readConsentCookies } from '../shared/detection/parsers/consent-cookies.js';
import { parseAmplitudeRequestData } from '../shared/detection/parsers/amplitude.js';
import { detectWalkerOSEnvelope } from '../shared/detection/walkeros-envelope.js';
import { executeRequest, getProvider } from '../shared/ai/ai-provider.js';
import { renderPrompt, getPromptTemplate } from '../shared/ai/prompt-templates.js';
import { redactString } from '../shared/ai/pii-redaction.js';
import {
  pruneUsageHistory,
  computeLast30Days,
  applyUsageRecord,
  todayUTC as usageHistoryTodayUTC,
} from '../shared/ai/usage-history.js';

// Total platform count for UI display (includes data-layer-only platforms)
const TOTAL_PLATFORM_COUNT = PLATFORM_COUNT;

// ===== Install-type cache (Feature #81) =====
// chrome.management.getSelf() returns 'development' when loaded unpacked,
// 'normal' for CWS installs. Cached once at SW startup; consulted by the
// AI-export bridge (#81 Phase 1) to keep the page-script global write path
// dormant on CWS installs. Permissionless — does not require the management
// permission. Defaults to 'normal' if the API ever fails. `installTypeReady`
// is the resolution promise so async callers (GET_INSTALL_TYPE) can wait
// before answering — eliminates the race where the panel asks before
// management.getSelf() resolves.
let installType = 'normal';
const installTypeReady = chrome.management.getSelf().then((info) => {
  if (info && typeof info.installType === 'string') {
    installType = info.installType;
  }
  return installType;
}).catch(() => installType);

// Apply the user's preferred view mode (side panel or popup)
async function applyViewMode() {
  const { viewMode } = await chrome.storage.local.get('viewMode');
  const mode = viewMode || 'sidepanel';

  if (mode === 'popup') {
    await chrome.action.setPopup({ popup: 'src/sidepanel/sidepanel.html?popup=true' });
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
    // Disable the side panel to close it if currently open
    await chrome.sidePanel.setOptions({ enabled: false }).catch(() => {});
  } else {
    // Re-enable side panel before opening
    await chrome.sidePanel.setOptions({ enabled: true }).catch(() => {});
    await chrome.action.setPopup({ popup: '' });
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
}

applyViewMode();

// ===== Context menu + upgrade detection =====
chrome.runtime.onInstalled.addListener(async (details) => {
  chrome.contextMenus.create({
    id: 'event-watcher-open',
    title: 'Event Watcher \u25E7 Show Trackers in Side Panel',
    contexts: ['all']
  });

  // Flag upgrade so the panel can show "What's New" on next open.
  // Fresh installs (reason === 'install') get the onboarding tour instead.
  if (details.reason === 'update' && details.previousVersion) {
    chrome.storage.local.set({
      _whatsNew: {
        from: details.previousVersion,
        to: chrome.runtime.getManifest().version
      }
    });
  }

  // Suppress the sidepanel version-update banner for brand-new installs —
  // they have no prior version to be "updated from", so seeding the install
  // version into both shown/dismissed slots makes the predicate return false.
  // For 'update', we deliberately leave nudge state untouched so the next
  // sidepanel mount surfaces the banner naturally.
  if (details.reason === 'install') {
    try {
      const installVersion = chrome.runtime.getManifest().version;
      const stored = await chrome.storage.local.get('nudge_devtools_state');
      const next = {
        ...(stored.nudge_devtools_state || {}),
        versionBannerShownFor: installVersion,
        versionBannerDismissedFor: installVersion,
      };
      await chrome.storage.local.set({ nudge_devtools_state: next });
    } catch (_) { /* best-effort */ }
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'event-watcher-open') {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

// Store events per tab
const tabEvents = new Map();

// ===== Badge: Track detected platforms per tab =====
// Maps tabId -> Map of platformId -> { count, urls[] }.
// Stores platform identifiers, counts, and up to 10 recent request URLs per platform.
const tabBadgePlatforms = new Map();
const MAX_URLS_PER_PLATFORM = 10;

// ===== Performance stats per tab (for side panel status footer) =====
// Tracks total requests processed and matching time per tab.
const tabPerfStats = new Map(); // tabId -> { requestCount, matchCount, totalMatchTimeMs }

// Store connected DevTools panels (tabId -> Port).
// Populated via persistent port connections from DevTools panels.
// Stored as the actual `Port` object so the SW can push messages directly
// via `port.postMessage(...)` rather than the runtime-broadcast bus
// (Feature #81 Phase 2 — see MCP_CLEAR_PANEL_EVENTS handler below).
const devtoolsPanels = new Map();

// Feature #81 Phase 2 — direct broadcast helper exposed on the SW global so
// chrome-devtools-mcp can trigger it from `evaluate_script(serviceWorkerId)`
// without going through `chrome.runtime.sendMessage` (which would hit the SW
// self-call routing tangle that earlier manifested as eval timeouts). Only
// fires when `installType === 'development'`. Returns the number of panels
// successfully signalled.
//
// Usage from chrome-devtools-mcp:
//   mcp__chrome-devtools__evaluate_script({
//     serviceWorkerId: 'sw-1',
//     function: '() => globalThis.__mcpClearPanelEvents()'
//   })
globalThis.__mcpClearPanelEvents = () => {
  if (installType !== 'development') return { ok: false, reason: 'not-dev-install', panelCount: 0 };
  let panelCount = 0;
  for (const port of devtoolsPanels.values()) {
    if (!port) continue;
    try {
      port.postMessage({ type: MSG.MCP_CLEAR_PANEL_EVENTS });
      panelCount++;
    } catch { /* port disconnected; cleanup happens via onDisconnect */ }
  }
  return { ok: true, panelCount };
};

// Handle persistent port connections from DevTools panels.
// The port keeps the service worker alive while DevTools is open.
// If the SW restarts, all ports disconnect and panels automatically reconnect,
// re-sending PANEL_CONNECTED so devtools-scoped DNR rules are re-synced.
chrome.runtime.onConnect.addListener((port) => {
  if (!port.name.startsWith('devtools-panel-')) return;
  port.onMessage.addListener((message) => {
    if (message.type === MSG.PANEL_CONNECTED) {
      devtoolsPanels.set(message.tabId, port);
      handleGTMInterceptUpdate();
    } else if (message.type === MSG.PANEL_DISCONNECTED) {
      devtoolsPanels.delete(message.tabId);
      handleGTMInterceptUpdate();
    }
  });
  port.onDisconnect.addListener(() => {
    // Extract tabId from port name and clean up
    const tabId = parseInt(port.name.replace('devtools-panel-', ''), 10);
    if (!isNaN(tabId)) {
      devtoolsPanels.delete(tabId);
      handleGTMInterceptUpdate();
    }
  });
});

// Track recent navigation URLs per tab to avoid duplicates
// (page script and webNavigation API may both fire for the same navigation)
const recentNavigations = new Map(); // tabId -> { url, timestamp, isHardNavigation }

// Track navigation start times for calculating page load duration
const navigationStartTimes = new Map(); // tabId -> { url, startTime }

// Store CMP consent state per tab (from window API probing in page script)
// tabId -> { cmp, id, categories, hasInteracted, timestamp }
const tabCMPConsentState = new Map();

// Listen for messages from content scripts and DevTools panels
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Content-script messages carry an authentic sender.tab.id, which always wins.
  // message.tabId is only honoured for extension-page senders (the DevTools panel
  // and sidepanel have no sender.tab), so a content script cannot spoof the tab
  // it targets — `??` falls back only when there is genuinely no sender tab (F12).
  const tabId = sender.tab?.id ?? message.tabId;

  switch (message.type) {
    case MSG.DATALAYER_PUSH:
      // Handle dataLayer push from content script
      handleDataLayerPush(tabId, message.data);
      addBadgePlatform(tabId, 'datalayer');
      sendResponse({ success: true });
      break;

    case MSG.PAGE_NAVIGATION:
      // Handle page navigation from content script
      handlePageNavigation(tabId, message.data);
      sendResponse({ success: true });
      break;

    case MSG.TEALIUM_PUSH:
      // Handle Tealium utag.view/utag.link from content script
      // handleTealiumPush returns false for filtered-out events (e.g. Cookie Information CMP)
      if (handleTealiumPush(tabId, message.data)) {
        addBadgePlatform(tabId, 'tealium');
      }
      sendResponse({ success: true });
      break;

    case MSG.ADOBE_LAUNCH_PUSH:
      // Handle Adobe Launch / ACDL events from content script
      handleAdobeLaunchPush(tabId, message.data);
      addBadgePlatform(tabId, 'adobe-datalayer');
      sendResponse({ success: true });
      break;

    case MSG.W3C_DIGITALDATA_PUSH:
      // Handle W3C digitalData events from content script
      handleW3CDigitalDataPush(tabId, message.data);
      addBadgePlatform(tabId, 'w3c-datalayer');
      sendResponse({ success: true });
      break;

    case MSG.COMMANDERSACT_PUSH:
      // Handle Commanders Act tc_vars events from content script
      handleCommandersActPush(tabId, message.data);
      addBadgePlatform(tabId, 'commandersact-datalayer');
      sendResponse({ success: true });
      break;

    case MSG.RELAY42_PUSH:
      // Handle Relay42 defined42 events from content script
      handleRelay42Push(tabId, message.data);
      addBadgePlatform(tabId, 'relay42-datalayer');
      sendResponse({ success: true });
      break;

    case MSG.ENSIGHTEN_PUSH:
      // Handle Ensighten data layer events from content script
      handleEnsightenPush(tabId, message.data);
      addBadgePlatform(tabId, 'ensighten-datalayer');
      sendResponse({ success: true });
      break;

    case MSG.INTERACTION_EVENT:
      // Handle user interaction (click) from content script
      handleInteractionEvent(tabId, message.data);
      sendResponse({ success: true });
      break;

    case MSG.CMP_CONSENT_STATE:
      // Store CMP consent state from window API probing (page script)
      if (tabId && message.data) {
        tabCMPConsentState.set(tabId, message.data);
      }
      sendResponse({ success: true });
      break;

    case MSG.GET_EVENTS:
      // Return stored events and CMP consent state for a tab
      const events = tabEvents.get(message.tabId) || [];
      const cmpConsentState = tabCMPConsentState.get(message.tabId) || null;
      sendResponse({ events, cmpConsentState });
      break;

    case MSG.CLEAR_EVENTS:
      // Clear events for a tab
      tabEvents.set(message.tabId, []);
      tabCMPConsentState.delete(message.tabId);
      sendResponse({ success: true });
      break;

    case MSG.PUSH_DATALAYER_EVENT:
      // Forward push command from panel to content script of the inspected tab
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: MSG.PUSH_DATALAYER_TO_PAGE,
          payload: message.payload
        }).catch(() => {
          // Content script may not be available (page reloaded, navigated away, etc.)
        });
      }
      sendResponse({ success: true });
      break;

    case MSG.PUBLISH_AI_EXPORT:
      // Feature #81 Phase 1 — relay a fresh "Copy for AI" payload from the
      // panel to the inspected tab's page-injected global. Dev-gate is
      // enforced here so the message never reaches downstream layers on CWS
      // installs.
      if (installType === 'development' && tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: MSG.AI_EXPORT_TO_PAGE,
          payload: message.payload,
          ts: message.ts,
          exportId: message.exportId,
          scopeType: message.scopeType,
        }).catch(() => { /* tab may have navigated; ignore */ });
      }
      sendResponse({ success: true, installType });
      break;

    case MSG.GET_INSTALL_TYPE:
      // Await the management.getSelf() promise so the panel never gets a
      // pre-resolution `'normal'` default during the SW startup race.
      installTypeReady.then((resolved) => {
        sendResponse({ installType: resolved });
      });
      return true;  // tells Chrome the response is async

    case MSG.MCP_CLEAR_PANEL_EVENTS: {
      // Feature #81 Phase 2 helper — clears the captured event list on every
      // open DevTools panel so an MCP-driven regression run can move between
      // URLs without earlier captures leaking into the next snapshot. Gated
      // to `installType === 'development'` like every other Phase 1/2 surface.
      //
      // Pushes directly through each panel's persistent port (port.postMessage)
      // rather than `chrome.runtime.sendMessage` — the runtime bus would route
      // back into this SW's own onMessage listener and create a self-call
      // routing tangle, which manifested as MCP eval timeouts.
      const dev = installType === 'development';  // already-resolved sync read
      let panelCount = 0;
      if (dev) {
        for (const port of devtoolsPanels.values()) {
          if (!port) continue;  // fallback-registered panel with no port
          try {
            port.postMessage({ type: MSG.MCP_CLEAR_PANEL_EVENTS });
            panelCount++;
          } catch { /* port disconnected; cleanup happens via onDisconnect */ }
        }
      }
      sendResponse({ success: dev, installType, panelCount });
      break;
    }

    case MSG.CLEAR_BADGE_PLATFORMS:
      // Clear badge platforms and perf stats for a tab (used by sidepanel clear)
      tabBadgePlatforms.delete(message.tabId);
      tabPerfStats.delete(message.tabId);
      updateBadge(message.tabId);
      sendResponse({ success: true });
      break;

    case MSG.PANEL_CONNECTED:
      // Fallback for sendMessage path (primary path is persistent port in onConnect).
      // No port object available here — store `null` so .size still reports the
      // panel but port-based broadcasts (#81 Phase 2 clear) just skip this entry.
      devtoolsPanels.set(message.tabId, null);
      handleGTMInterceptUpdate();
      sendResponse({ success: true });
      break;

    case MSG.PANEL_DISCONNECTED:
      // Fallback for sendMessage path (primary path is persistent port in onConnect)
      devtoolsPanels.delete(message.tabId);
      handleGTMInterceptUpdate();
      sendResponse({ success: true });
      break;

    case MSG.SET_VIEW_MODE:
      // Switch between side panel and popup mode
      (async () => {
        await chrome.storage.local.set({ viewMode: message.mode });
        await applyViewMode();
        // If switching to sidepanel, open it for the current window
        if (message.mode === 'sidepanel') {
          try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
              await chrome.sidePanel.open({ windowId: tab.windowId });
            }
          } catch (e) { /* sidePanel.open may fail if not supported */ }
        }
        sendResponse({ ok: true });
      })();
      break;

    case MSG.GET_BADGE_PLATFORMS:
      // Return detected platforms and their request counts for a tab
      const badgePlatforms = tabBadgePlatforms.get(message.tabId);
      const perfStatsForTab = tabPerfStats.get(message.tabId);
      const eventsForTab = tabEvents.get(message.tabId) || [];

      // DataLayer-type platforms that get event names from tabEvents (not from URL params)
      // Note: 'gtm' is excluded because GTM shows Container ID from network requests
      const dataLayerPlatforms = new Set([
        'datalayer', 'tealium-datalayer',
        'adobe-datalayer', 'w3c-datalayer', 'commandersact-datalayer', 'relay42-datalayer',
        'ensighten-datalayer', 'walkeros'
      ]);

      // Build a map of platform -> event names from tabEvents
      const platformEventNames = new Map();
      for (const event of eventsForTab) {
        if (event.eventName && dataLayerPlatforms.has(event.platform)) {
          if (!platformEventNames.has(event.platform)) {
            platformEventNames.set(event.platform, new Map());
          }
          const eventCounts = platformEventNames.get(event.platform);
          eventCounts.set(event.eventName, (eventCounts.get(event.eventName) || 0) + 1);
        }
      }

      if (badgePlatforms) {
        const platforms = [];
        for (const [id, data] of badgePlatforms) {
          const platformData = { id, count: data.count, urls: data.urls || [] };
          // Add event names for dataLayer platforms
          if (platformEventNames.has(id)) {
            const eventCounts = platformEventNames.get(id);
            platformData.eventNames = [...eventCounts.entries()].map(([name, count]) => ({ name, count }));
          }
          // Add event names parsed from POST request bodies (e.g., Amplitude).
          // Key format: "identifier|eventName" — identifier may be empty.
          if (data.networkEventCounts && data.networkEventCounts.size > 0) {
            platformData.networkEvents = [...data.networkEventCounts.entries()].map(([key, count]) => {
              const sep = key.indexOf('|');
              const identifier = sep >= 0 ? key.slice(0, sep) : '';
              const name = sep >= 0 ? key.slice(sep + 1) : key;
              return { identifier, name, count };
            });
          }
          platforms.push(platformData);
        }
        sendResponse({
          platforms,
          stats: {
            requestCount: perfStatsForTab?.requestCount || 0,
            matchCount: perfStatsForTab?.matchCount || 0,
            totalMatchTimeMs: perfStatsForTab?.totalMatchTimeMs || 0,
            totalToolCount: TOTAL_PLATFORM_COUNT,
          }
        });
      } else {
        sendResponse({
          platforms: [],
          stats: {
            requestCount: perfStatsForTab?.requestCount || 0,
            matchCount: perfStatsForTab?.matchCount || 0,
            totalMatchTimeMs: perfStatsForTab?.totalMatchTimeMs || 0,
            totalToolCount: TOTAL_PLATFORM_COUNT,
          }
        });
      }
      break;

    case MSG.GTM_INTERCEPT_UPDATED:
      // GTM Container Intercept — sync DNR rules from storage
      handleGTMInterceptUpdate(tabId).then(() => {
        sendResponse({ success: true });
      }).catch(() => {
        sendResponse({ success: false });
      });
      return true; // Async sendResponse

    case MSG.PAGE_SCRIPT_BLOCKED:
      // Page script was blocked by CSP - store this info for the tab
      if (tabId) {
        // Create a warning event so the user knows dataLayer events won't be captured
        const warningEvent = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          platform: 'warning',
          platformName: 'Warning',
          eventName: 'Page script blocked by CSP',
          isWarning: true,
          raw: {
            message: 'DataLayer events cannot be captured on this page due to Content Security Policy restrictions.',
            reason: message.reason || 'csp'
          },
          formatted: {
            message: 'DataLayer events cannot be captured on this page due to Content Security Policy restrictions.',
            reason: message.reason || 'csp'
          }
        };
        handleAnalyticsEvent(tabId, warningEvent);
      }
      sendResponse({ success: true });
      break;

    case MSG.GET_TAB_URL:
      // Return the tab URL so panel can extract hostname without inspectedWindow.eval
      chrome.tabs.get(message.tabId, (tab) => {
        sendResponse({ url: tab?.url || '' });
      });
      break;

    case MSG.GET_TAB_COOKIE_STORE:
      // Return the cookie store ID for this tab so the panel can filter
      // chrome.cookies.onChanged events to the correct store (normal vs incognito).
      (async () => {
        try {
          const stores = await chrome.cookies.getAllCookieStores();
          const store = stores.find(s => s.tabIds.includes(message.tabId));
          sendResponse({ cookieStoreId: store?.id || null });
        } catch {
          sendResponse({ cookieStoreId: null });
        }
      })();
      break;

    case MSG.READ_CONSENT_COOKIES:
      // Read and parse consent cookies via chrome.cookies (guaranteed available in SW)
      // Look up the tab's cookie store so incognito tabs read from the correct store.
      (async () => {
        try {
          const tab = await chrome.tabs.get(message.tabId);
          const url = tab?.url || '';
          if (!url) { sendResponse({}); return; }
          const stores = await chrome.cookies.getAllCookieStores();
          const store = stores.find(s => s.tabIds.includes(message.tabId));
          const cookieStates = await readConsentCookies(url, store?.id);
          sendResponse(cookieStates);
        } catch {
          sendResponse({});
        }
      })();
      break;

    case MSG.AI_REQUEST:
      // BYOK AI — routes the panel's prompt request through the configured
      // provider. All AI traffic goes through this handler so the API key
      // never leaves the service worker context.
      handleAIRequest(message)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({
          success: false,
          error: err?.type || 'unknown',
          message: err?.message || 'Unexpected error',
        }));
      return true; // async sendResponse

    case MSG.GET_AI_USAGE:
      // Snapshot of in-session totals + latest rate-limit headers per
      // provider + Gemini's local daily count. The Provider tab calls
      // this when it opens and after each request.
      getAIUsageSnapshot()
        .then((snap) => sendResponse({ success: true, ...snap }))
        .catch(() => sendResponse({ success: false }));
      return true;

    case MSG.RESET_AI_SESSION_USAGE:
      // Panel calls this from clearEvents() so the AI Modal's "this
      // session" totals reset alongside the rest of the captured data.
      resetSessionAIUsage();
      sendResponse({ success: true });
      return true;

    default:
      sendResponse({ error: 'Unknown message type' });
  }

  return true; // Keep message channel open for async response
});

// ===== BYOK AI request handler =====
// Loads the user's AI config from chrome.storage.local and dispatches to
// the provider adapter in shared/ai. The API key never leaves this
// service worker — content/panel pages receive only the response.
//
// Storage shape (ai_config):
//   {
//     activeProvider: 'gemini' | 'anthropic' | 'openai',
//     consentGiven: true,
//     consentTimestamp: '2026-04-18T…',
//     providers: {
//       [providerId]: { apiKey, model }
//     }
//   }
async function handleAIRequest(message) {
  const { ai_config: aiConfig } = await chrome.storage.local.get('ai_config');
  if (!aiConfig || !aiConfig.activeProvider) {
    return {
      success: false,
      error: 'no_provider',
      message: 'Configure an AI provider in the AI panel to use AI features.',
    };
  }
  if (!aiConfig.consentGiven) {
    return {
      success: false,
      error: 'no_consent',
      message: 'Accept the AI data-use disclosure before using AI features.',
    };
  }

  const providerId = message.provider || aiConfig.activeProvider;
  // Defense-in-depth (F12): only ever dispatch to a known provider adapter.
  // getProvider() is the single source of truth for the supported set, so an
  // unexpected `message.provider` can never reach executeRequest().
  if (!getProvider(providerId)) {
    return {
      success: false,
      error: 'unknown_provider',
      message: `Unsupported AI provider: ${providerId}`,
    };
  }
  const providerConfig = aiConfig.providers?.[providerId];
  if (!providerConfig || !providerConfig.apiKey) {
    return {
      success: false,
      error: 'no_provider',
      message: `No API key configured for ${providerId}. Open the AI panel to add one.`,
    };
  }

  let messages;
  let options;
  if (message.promptType) {
    if (!getPromptTemplate(message.promptType)) {
      return { success: false, error: 'unknown_template', message: `Unknown prompt template: ${message.promptType}` };
    }
    // User can flip PII redaction off in Settings → Features ("PII
    // redaction in AI prompts"). Default ON. Read fresh per-request so
    // a toggle takes effect on the next prompt without any caching.
    const { settings } = await chrome.storage.local.get('settings');
    const redactPii = settings?.aiRedactPii !== false;
    const rendered = renderPrompt(message.promptType, message.data, undefined, { redactPii });
    messages = rendered.messages;
    options = rendered.options;
  } else if (Array.isArray(message.messages)) {
    // Follow-up turns arrive as a pre-built messages array and previously
    // bypassed redaction entirely — only the promptType path redacted. The
    // snapshot in initialMessages was already redacted on turn 1, but a user's
    // free-text follow-up question (a fresh user-role turn) was forwarded raw,
    // so a pasted email/JWT/key could leak. Redact user-authored content here
    // too; redaction is idempotent so re-passing the snapshot is a no-op
    // (N5, feature #139).
    const { settings } = await chrome.storage.local.get('settings');
    const redactPii = settings?.aiRedactPii !== false;
    messages = redactPii
      ? message.messages.map((m) =>
          m && m.role === 'user' && typeof m.content === 'string'
            ? { ...m, content: redactString(m.content) }
            : m)
      : message.messages;
    options = message.options || {};
  } else {
    return { success: false, error: 'bad_request', message: 'Request must include promptType or messages.' };
  }

  try {
    const result = await executeRequest({
      provider: providerId,
      apiKey: providerConfig.apiKey,
      model: message.model || providerConfig.model,
      messages,
      options,
    });

    // Record usage centrally so the Provider tab and any future cost /
    // quota dashboards read from one source. Failures are non-fatal —
    // the AI response itself is what the caller needs.
    try {
      await recordAIUsage({
        provider: result.provider,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        costEstimate: result.costEstimate,
        rateLimits: result.rateLimits,
      });
    } catch { /* usage tracking is best-effort */ }

    return {
      success: true,
      text: result.text,
      structured: result.structured,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      provider: result.provider,
      model: result.model,
      costEstimate: result.costEstimate,
      stopReason: result.stopReason,
      rateLimits: result.rateLimits || null,
      // Echo the rendered prompt back so panels can offer a "Show prompt"
      // affordance. This is the post-PII-redaction payload that actually
      // reached the provider, not a client-side reconstruction.
      messages,
    };
  } catch (err) {
    return {
      success: false,
      error: err?.type || 'unknown',
      message: err?.message || 'Unexpected error',
      retryAfter: err?.retryAfter,
      httpStatus: err?.httpStatus,
    };
  }
}

// ===== AI usage tracker =====
// Service-worker-local in-memory state. Lost on SW restart (acceptable
// — rate limits refresh on the next request, session totals reset
// reasonably often anyway). The Gemini daily count is also persisted
// to chrome.storage.local because Gemini provides no rate-limit
// headers, and a fuel-gauge that resets every time the SW dies would
// be useless.

const aiUsageMemory = {
  perProvider: {},   // { [providerId]: { rateLimits, lastUpdatedAt } }
  sessionTotals: { requests: 0, tokensIn: 0, tokensOut: 0, costEstimate: 0 },
};

function todayUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function loadDailyCounts() {
  try {
    const { ai_daily_counts: dailyCounts } = await chrome.storage.local.get('ai_daily_counts');
    const today = todayUTC();
    if (!dailyCounts || dailyCounts.date !== today) {
      return { date: today, counts: {} };
    }
    return dailyCounts;
  } catch {
    return { date: todayUTC(), counts: {} };
  }
}

// 30-day rolling history. See shared/ai/usage-history.js for pure
// helpers (pruneUsageHistory, computeLast30Days, applyUsageRecord) —
// they're shared with the Usage tab renderer and unit tests.

async function loadUsageHistory() {
  try {
    const { ai_usage_history: usageHistory } = await chrome.storage.local.get('ai_usage_history');
    const byDate = pruneUsageHistory(usageHistory?.byDate || {});
    return { byDate };
  } catch {
    return { byDate: {} };
  }
}

async function recordAIUsage({ provider, tokensIn, tokensOut, costEstimate, rateLimits }) {
  // Session totals
  aiUsageMemory.sessionTotals.requests += 1;
  aiUsageMemory.sessionTotals.tokensIn += Number(tokensIn) || 0;
  aiUsageMemory.sessionTotals.tokensOut += Number(tokensOut) || 0;
  aiUsageMemory.sessionTotals.costEstimate += Number(costEstimate) || 0;

  // Latest rate-limit headers per provider
  if (provider) {
    aiUsageMemory.perProvider[provider] = {
      rateLimits: rateLimits || null,
      lastUpdatedAt: Date.now(),
    };
  }

  // Persisted daily count — primary purpose is the Gemini fuel gauge,
  // but we track all providers for symmetry.
  if (provider) {
    const daily = await loadDailyCounts();
    daily.counts[provider] = (daily.counts[provider] || 0) + 1;
    try {
      await chrome.storage.local.set({ ai_daily_counts: daily });
    } catch { /* non-critical */ }
  }

  // 30-day history — one bucket per (date, provider). Pruned on load
  // so old entries can't accumulate even if the user never opens the
  // Usage tab.
  if (provider) {
    const history = await loadUsageHistory();
    const nextByDate = applyUsageRecord(history.byDate, {
      provider,
      tokensIn,
      tokensOut,
      costEstimate,
      date: usageHistoryTodayUTC(),
    });
    try {
      await chrome.storage.local.set({ ai_usage_history: { byDate: nextByDate } });
    } catch { /* non-critical */ }
  }
}

function resetSessionAIUsage() {
  aiUsageMemory.sessionTotals = { requests: 0, tokensIn: 0, tokensOut: 0, costEstimate: 0 };
  // Note: perProvider rate-limit cache, the daily counts, and the
  // 30-day history are NOT reset — those are workspace-wide truths,
  // not per-capture-session.
}

async function getAIUsageSnapshot() {
  const daily = await loadDailyCounts();
  const history = await loadUsageHistory();
  const last30Days = computeLast30Days(history.byDate);
  return {
    sessionTotals: { ...aiUsageMemory.sessionTotals },
    perProvider: { ...aiUsageMemory.perProvider },
    dailyCounts: daily,
    last30Days,
    historyByDate: history.byDate,
  };
}

// Handle analytics events
function handleAnalyticsEvent(tabId, event) {
  if (!tabId) return;

  // Initialize events array if needed
  if (!tabEvents.has(tabId)) {
    tabEvents.set(tabId, []);
  }

  // Add event
  const events = tabEvents.get(tabId);
  events.push(event);

  // Keep only last 1000 events per tab
  if (events.length > 1000) {
    events.shift();
  }

}

// GTM internal events - these are triggered by GTM itself, not the website
const GTM_INTERNAL_EVENTS = [
  'gtm.js',
  'gtm.dom',
  'gtm.load',
  'gtm.click',
  'gtm.linkClick',
  'gtm.formSubmit',
  'gtm.historyChange',
  'gtm.scrollDepth',
  'gtm.timer',
  'gtm.video',
  'gtm.elementVisibility',
  'gtm.start'
];

// Check if an event is a GTM internal event
function isGTMInternalEvent(eventName) {
  if (!eventName) return false;
  // Check exact match or if it starts with 'gtm.'
  return GTM_INTERNAL_EVENTS.includes(eventName) || eventName.startsWith('gtm.');
}

// Check if this is a duplicate navigation (same URL within 10 seconds)
function isDuplicateNavigation(tabId, url, isSoftNavigation = false) {
  const recent = recentNavigations.get(tabId);
  if (!recent) return false;

  // If this is a soft navigation (History API) to the same URL as a previous hard navigation,
  // it's almost always a duplicate - sites often trigger History API after page load.
  // Real SPA navigations change the path, they don't navigate to the same URL.
  if (isSoftNavigation && recent.isHardNavigation && recent.url === url) {
    return true;
  }

  const timeDiff = Date.now() - recent.timestamp;
  // Consider duplicate if same URL within 10 seconds
  // This handles cases where webNavigation.onCompleted and onHistoryStateUpdated
  // both fire for the same page load (some sites trigger History API after load)
  return recent.url === url && timeDiff < 10000;
}

// Record a navigation to track duplicates
function recordNavigation(tabId, url, isHardNavigation = false) {
  recentNavigations.set(tabId, { url, timestamp: Date.now(), isHardNavigation });
}

// Handle page navigation events (from page script)
function handlePageNavigation(tabId, data) {
  if (!tabId) return;

  const url = data._url;
  const isHardNavigation = data._isInitial === true;

  // Skip if duplicate - soft navigations to same URL as hard navigation are duplicates
  if (isDuplicateNavigation(tabId, url, !isHardNavigation)) {
    return;
  }

  // Record this navigation
  recordNavigation(tabId, url, isHardNavigation);

  // Calculate page load duration if we have the start time from onBeforeNavigate
  const navStart = navigationStartTimes.get(tabId);
  const endTime = Date.now();
  let loadDurationMs = null;
  let startTime = null;
  if (navStart && navStart.url === url) {
    startTime = navStart.startTime;
    loadDurationMs = endTime - startTime;
    navigationStartTimes.delete(tabId);
  }

  const event = {
    id: crypto.randomUUID(),
    timestamp: endTime,
    platform: 'pages',
    platformName: 'Page',
    eventName: data._path || '/',
    isNavigation: true,
    raw: {
      url: data._url,
      path: data._path,
      isInitial: data._isInitial,
      source: 'pageScript', // Mark as coming from page script
      navigationStart: startTime,
      navigationEnd: endTime,
      loadDurationMs: loadDurationMs
    },
    formatted: {
      url: data._url,
      path: data._path,
      isInitial: data._isInitial,
      source: 'pageScript',
      navigationStart: startTime,
      navigationEnd: endTime,
      loadDurationMs: loadDurationMs
    }
  };

  handleAnalyticsEvent(tabId, event);
}

// Detect Google Consent Mode pushes from dataLayer
// Google Consent Mode uses: dataLayer.push(["consent", "update"|"default", {params}])
// Returns { action, params } if detected, null otherwise
function detectGoogleConsentMode(pushData) {
  // Check actual arrays
  if (Array.isArray(pushData) && pushData.length >= 3 && pushData[0] === 'consent') {
    return { action: pushData[1], params: pushData[2] };
  }
  // Check array-like objects (numeric keys from message serialization)
  if (pushData && typeof pushData === 'object' && pushData[0] === 'consent' && pushData[2]) {
    return { action: pushData[1], params: pushData[2] };
  }
  return null;
}

// Known gtag developer_id mappings
// Platforms register a unique ID with Google when integrating gtag.js
// Set via: gtag('set', 'developer_id.XXXXX', true) → dataLayer.push(["set", "developer_id.XXXXX", true])
// Source: GTM templates, open-source plugins, vendor docs
const GTAG_DEVELOPER_IDS = {
  // CMS / Website Builders
  'dZTNiMT': 'Google Site Kit',
  'dZmZmYj': 'Google Site Kit (Tag Gateway)',
  'dYjhlMD': 'Magento 2 (Adobe Commerce)',
  'dMDhkMT': 'Drupal',
  'dOGY3NW': 'WooCommerce',
  // Consent Management Platforms
  'dMWZhNz': 'Cookiebot (Usercentrics)',
  'dNjAwYj': 'CookieFirst',
  'dNzMyY2': 'OneTrust',
  'dYWJhMj': 'OneTrust (GTM)',
  'dNTIxZG': 'TrustArc',
  'dODQ2Mj': 'Transcend',
  'dZTcxZD': 'UniConsent',
  'dMzRlOT': 'Osano',
  'dMTc4Zm': 'Didomi',
  'dN2JhM2': 'Ketch',
  'dYWVlZG': 'Complianz',
  'dM2I0MW': 'Concord',
  'dMzY0Yz': 'CookieHub',
  'dYmU3OD': 'Legal Web',
  'dY2Q2ZW': 'CookieYes',
  'dNzg2MD': 'Termly',
  'dMmY1Mm': 'CookieScript',
};

// Google Consent Mode advanced settings set via gtag('set', ...)
const GOOGLE_CONSENT_SETTINGS = ['ads_data_redaction', 'url_passthrough'];

// Detect gtag "set" commands: ["set", "key", value]
// Returns typed result for consent settings and developer_id, null otherwise
function detectGtagSetCommand(pushData) {
  // Get first element - works for arrays and array-like objects
  const command = Array.isArray(pushData) ? pushData[0] : pushData?.[0];
  if (command !== 'set') return null;

  const key = Array.isArray(pushData) ? pushData[1] : pushData?.[1];
  const value = Array.isArray(pushData) ? pushData[2] : pushData?.[2];
  if (!key) return null;

  // Google Consent Mode advanced settings: ads_data_redaction, url_passthrough
  if (GOOGLE_CONSENT_SETTINGS.includes(key)) {
    return { type: 'consent-setting', setting: key, value };
  }

  // gtag developer_id: identifies which platform deployed the tag
  // Format 1: ["set", "developer_id.X", true]
  if (typeof key === 'string' && key.startsWith('developer_id.')) {
    const id = key.replace('developer_id.', '');
    const platform = GTAG_DEVELOPER_IDS[id] || null;
    return { type: 'developer-id', id, platform, value };
  }

  // Format 2: ["set", {"developer_id.X": true, ...}] — GTM batched set
  if (typeof key === 'object' && key !== null) {
    const devIdKey = Object.keys(key).find(k => k.startsWith('developer_id.'));
    if (devIdKey) {
      const id = devIdKey.replace('developer_id.', '');
      const platform = GTAG_DEVELOPER_IDS[id] || null;
      return { type: 'developer-id', id, platform, value: key[devIdKey] };
    }
  }

  return null;
}

// Detect consent-related dataLayer events from various consent tools
// Returns { tool, category } if detected, null otherwise.
// Optionally takes the raw push data for disambiguation when an event name
// is generic enough to be used by more than one CMP.
function detectConsentEvent(eventName, pushData) {
  if (!eventName) return null;

  // Disambiguation for the generic 'consent_status' event name: if the push
  // carries Usercentrics-specific payload (ucCategory), prefer Usercentrics.
  // Consentmo's Shopify app uses the same event name but a different shape
  // ({ analytics, marketing, functionality, necessary }) — handled below.
  if (eventName === 'consent_status' && pushData && typeof pushData === 'object') {
    const hasUcCategory = Array.isArray(pushData)
      ? pushData.some(p => p && typeof p === 'object' && 'ucCategory' in p)
      : ('ucCategory' in pushData);
    if (hasUcCategory) {
      return { tool: 'Usercentrics', category: 'status' };
    }
  }

  // Disambiguation for 'cookie_consent_update': InMobi CMP / Quantcast Choice
  // (shared TCF codebase) push this name, but it also falls inside Cookie
  // Information's site-configurable `cookie_consent_*` namespace (handled by the
  // prefix rule below). An InMobi/Quantcast push carries IAB TCF markers
  // (tcString, TCF purpose/vendor consents, the __cmp* siblings); a Cookie
  // Information push does not. Prefer InMobi only when a TCF marker is present;
  // otherwise fall through to the Cookie Information prefix rule (no regression).
  if (eventName === 'cookie_consent_update' && pushData && typeof pushData === 'object') {
    const objs = Array.isArray(pushData) ? pushData : [pushData];
    const hasTcfMarker = objs.some(p => p && typeof p === 'object' && (
      'tcString' in p || 'tcData' in p || 'gdprApplies' in p ||
      'purposeConsents' in p || 'vendorConsents' in p ||
      'cmpId' in p || '__cmpConsents' in p
    ));
    if (hasTcfMarker) {
      return { tool: 'InMobi CMP', category: 'consent update' };
    }
  }

  // ========================================
  // Cookie Information
  // ========================================
  // cookie_cat_* events (e.g., cookie_cat_necessary, cookie_cat_marketing)
  if (eventName.startsWith('cookie_cat_')) {
    const category = eventName.replace('cookie_cat_', '');
    return { tool: 'Cookie Information', category };
  }
  // cookie_consent_* events (e.g., cookie_consent_preferences, cookie_consent_marketing)
  if (eventName.startsWith('cookie_consent_')) {
    const category = eventName.replace('cookie_consent_', '');
    return { tool: 'Cookie Information', category };
  }

  // ========================================
  // CookieHub
  // ========================================
  // CookieHub pushes a family of cookiehub_* events/variables to the dataLayer:
  // per-category booleans (cookiehub_analytics, cookiehub_marketing, …), lifecycle
  // events (cookiehub_ready, cookiehub_dialog, cookiehub_modified,
  // cookiehub_consent_update, cookiehub_allowsale), and the GTM-template callbacks
  // (cookiehub_onInitialise, cookiehub_onStatusChange, cookiehub_onAllow,
  // cookiehub_onRevoke). Strip the prefix + leading "on" and humanise the rest.
  if (eventName.startsWith('cookiehub_')) {
    const category = eventName
      .replace('cookiehub_', '')
      .replace(/^on/, '')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .toLowerCase()
      .trim();
    return { tool: 'CookieHub', category: category || 'event' };
  }

  // ========================================
  // Borlabs Cookie
  // ========================================
  // v3 GTM package: borlabs-cookie-opt-in-{service-id} (e.g., borlabs-cookie-opt-in-google-analytics)
  if (eventName.startsWith('borlabs-cookie-opt-in-')) {
    const service = eventName.replace('borlabs-cookie-opt-in-', '');
    return { tool: 'Borlabs Cookie', category: `opt-in ${service}` };
  }
  // DOM events sometimes bridged to dataLayer by site implementations
  if (eventName === 'borlabs-cookie-consent-saved') {
    return { tool: 'Borlabs Cookie', category: 'consent saved' };
  }

  // ========================================
  // CCM19
  // ========================================
  if (eventName === 'CCM19.consentStateChanged') {
    return { tool: 'CCM19', category: 'consent changed' };
  }
  if (eventName === 'CCM19.embeddingAccepted') {
    return { tool: 'CCM19', category: 'embedding accepted' };
  }

  // ========================================
  // Complianz
  // ========================================
  if (eventName === 'cmplz_fire_categories') {
    return { tool: 'Complianz', category: 'fire categories' };
  }
  if (eventName === 'cmplz_fire') {
    return { tool: 'Complianz', category: 'fire' };
  }
  if (eventName === 'cmplz_status') {
    return { tool: 'Complianz', category: 'status' };
  }
  if (eventName === 'cmplz_consent_status') {
    return { tool: 'Complianz', category: 'consent status' };
  }

  // ========================================
  // Cookiebot
  // ========================================
  if (eventName === 'CookiebotOnAccept') {
    return { tool: 'Cookiebot', category: 'accept' };
  }
  if (eventName === 'CookiebotOnDecline') {
    return { tool: 'Cookiebot', category: 'decline' };
  }
  if (eventName === 'CookiebotOnLoad') {
    return { tool: 'Cookiebot', category: 'load' };
  }
  if (eventName === 'CookiebotOnDialogDisplay') {
    return { tool: 'Cookiebot', category: 'dialog display' };
  }
  if (eventName === 'CookiebotOnTagsExecuted') {
    return { tool: 'Cookiebot', category: 'tags executed' };
  }

  // ========================================
  // OneTrust / Optanon
  // ========================================
  if (eventName === 'OneTrustLoaded') {
    return { tool: 'OneTrust', category: 'loaded' };
  }
  if (eventName === 'OneTrustGroupsUpdated') {
    return { tool: 'OneTrust', category: 'groups updated' };
  }
  if (eventName === 'OptanonLoaded') {
    return { tool: 'OneTrust', category: 'loaded' };
  }

  // ========================================
  // CookieYes
  // ========================================
  if (eventName === 'cookieyes_consent_update') {
    return { tool: 'CookieYes', category: 'consent update' };
  }

  // ========================================
  // Digital Control Room (Cookie Reports)
  // ========================================
  if (eventName === 'wscr.consent') {
    return { tool: 'Digital Control Room', category: 'consent' };
  }
  if (eventName === 'wscr.init') {
    return { tool: 'Digital Control Room', category: 'init' };
  }

  // ========================================
  // Didomi
  // ========================================
  if (eventName === 'didomi-consent') {
    return { tool: 'Didomi', category: 'consent' };
  }
  if (eventName === 'didomi-ready') {
    return { tool: 'Didomi', category: 'ready' };
  }
  if (eventName === 'didomi-consent-changed') {
    return { tool: 'Didomi', category: 'consent changed' };
  }

  // ========================================
  // Consentmo
  // ========================================
  // Consentmo's Shopify app pushes a `consent_status` dataLayer event whose
  // payload carries per-category booleans: { analytics, marketing, functionality,
  // necessary } (plus the special 'non_gdpr' value for out-of-region visitors).
  // See https://support.consentmo.com/en/article/how-to-use-the-datalayer-set-by-our-app-gia1vl/
  if (eventName === 'consent_status') {
    return { tool: 'Consentmo', category: 'status' };
  }

  // ========================================
  // Usercentrics
  // ========================================
  // Note: Usercentrics' default marker is `ucConsentEvent`. The generic
  // `consent_status` name is a user-configurable Window Event in the admin UI,
  // not a Usercentrics default — it was previously hard-coded to Usercentrics
  // here, which caused Consentmo (Shopify) pushes to be misattributed.
  if (eventName === 'ucConsentEvent') {
    return { tool: 'Usercentrics', category: 'consent' };
  }

  // ========================================
  // iubenda
  // ========================================
  if (eventName === 'iubenda_consent_given') {
    return { tool: 'iubenda', category: 'consent given' };
  }
  if (eventName === 'iubenda_consent_rejected') {
    return { tool: 'iubenda', category: 'consent rejected' };
  }
  if (eventName === 'iubenda_preference_not_needed') {
    return { tool: 'iubenda', category: 'not needed' };
  }
  if (eventName.startsWith('iubenda_consent_given_purpose_')) {
    const purpose = eventName.replace('iubenda_consent_given_purpose_', '');
    return { tool: 'iubenda', category: `purpose ${purpose}` };
  }

  // ========================================
  // Termly
  // ========================================
  if (eventName === 'Termly.consentSaveDone') {
    return { tool: 'Termly', category: 'consent saved' };
  }

  // ========================================
  // Osano
  // ========================================
  if (eventName === 'osano-cm-initialized') {
    return { tool: 'Osano', category: 'initialized' };
  }
  if (eventName === 'osano-cm-consent-saved') {
    return { tool: 'Osano', category: 'consent saved' };
  }

  // ========================================
  // Pandectes
  // ========================================
  if (eventName === 'Pandectes_Consent_Update' || eventName === 'PandectesConsentUpdate') {
    return { tool: 'Pandectes', category: 'consent' };
  }

  // ========================================
  // Transcend
  // ========================================
  if (eventName === 'transcend_consent_ready') {
    return { tool: 'Transcend', category: 'ready' };
  }

  // ========================================
  // Securiti
  // ========================================
  if (eventName === 'userPrefUpdate') {
    return { tool: 'Securiti', category: 'preference update' };
  }

  // ========================================
  // CookieScript
  // ========================================
  // DataLayer event: CookieScriptConsentUpdated[categories] (e.g., CookieScriptConsentUpdated[functionality,targeting])
  if (eventName.startsWith('CookieScriptConsentUpdated')) {
    const cats = eventName.match(/\[(.+)\]/)?.[1] || 'all';
    return { tool: 'CookieScript', category: `consent updated (${cats})` };
  }
  if (eventName === 'CookieScriptGoogleConsentUpdated') {
    return { tool: 'CookieScript', category: 'google consent updated' };
  }

  // ========================================
  // CookieFirst
  // ========================================
  if (eventName === 'cf_after_consent_update') {
    return { tool: 'CookieFirst', category: 'consent update' };
  }
  if (eventName === 'cf_consent') {
    return { tool: 'CookieFirst', category: 'consent' };
  }
  if (eventName === 'cf_consent_loaded') {
    return { tool: 'CookieFirst', category: 'loaded' };
  }

  // ========================================
  // Ethyca Fides
  // ========================================
  if (eventName === 'FidesInitialized') {
    return { tool: 'Ethyca Fides', category: 'initialized' };
  }
  if (eventName === 'FidesUpdated') {
    return { tool: 'Ethyca Fides', category: 'updated' };
  }

  // ========================================
  // Ketch
  // ========================================
  if (eventName === 'ketch_consent') {
    return { tool: 'Ketch', category: 'consent' };
  }
  if (eventName === 'ketch_environment') {
    return { tool: 'Ketch', category: 'environment' };
  }

  // ========================================
  // Axeptio
  // ========================================
  if (eventName === 'axeptio_consent') {
    return { tool: 'Axeptio', category: 'consent' };
  }
  if (eventName === 'axeptio_complete') {
    return { tool: 'Axeptio', category: 'complete' };
  }

  // ========================================
  // Piwik PRO
  // ========================================
  if (eventName === 'stg_consent_changed') {
    return { tool: 'Piwik Pro Consent', category: 'consent changed' };
  }

  // ========================================
  // TrustArc
  // ========================================
  if (eventName.startsWith('GDPR Pref Allows ')) {
    const category = eventName.replace('GDPR Pref Allows ', '');
    return { tool: 'TrustArc', category };
  }

  // ========================================
  // Consentmanager
  // ========================================
  if (eventName === 'cmpvent' || eventName === 'cmpEvent') {
    return { tool: 'consentmanager', category: 'consent' };
  }
  if (eventName === 'cmp_consent') {
    return { tool: 'consentmanager', category: 'consent' };
  }

  // ========================================
  // Sourcepoint
  // ========================================
  if (eventName === 'sp.consent') {
    return { tool: 'Sourcepoint', category: 'consent' };
  }
  if (eventName === 'sp.onMessageReady') {
    return { tool: 'Sourcepoint', category: 'message ready' };
  }
  if (eventName === 'sp.onMessageChoiceSelect') {
    return { tool: 'Sourcepoint', category: 'choice select' };
  }

  // ========================================
  // Evidon / Crownpeak
  // ========================================
  if (eventName === 'evidon_consent_given' || eventName === 'evidonConsentGiven') {
    return { tool: 'Evidon', category: 'consent given' };
  }
  if (eventName === 'evidon_banner_closed') {
    return { tool: 'Evidon', category: 'banner closed' };
  }

  // ========================================
  // Secure Privacy
  // ========================================
  if (eventName === 'sp_consent_changed') {
    return { tool: 'Secure Privacy', category: 'consent changed' };
  }

  // ========================================
  // InMobi CMP / Quantcast Choice (shared codebase)
  // ========================================
  // `cookie_consent_update` is disambiguated against Cookie Information up top
  // (see the TCF-marker check before the Cookie Information section) — a plain
  // exact match here is unreachable behind the `cookie_consent_*` prefix rule.
  if (eventName === '__cmpConsents') {
    return { tool: 'InMobi CMP', category: 'consents' };
  }
  if (eventName === '__cmpLoaded') {
    return { tool: 'InMobi CMP', category: 'loaded' };
  }

  // ========================================
  // Tarteaucitron
  // ========================================
  if (eventName === 'tac_consent_update') {
    return { tool: 'Tarteaucitron', category: 'consent update' };
  }

  // ========================================
  // Commanders Act CMP (TrustCommander)
  // ========================================
  if (eventName === 'tcConsentChanged') {
    return { tool: 'Commanders Act CMP', category: 'consent changed' };
  }

  // ========================================
  // Enzuzo
  // ========================================
  if (eventName === 'enzuzo_consent_update') {
    return { tool: 'Enzuzo', category: 'consent update' };
  }

  // ========================================
  // Generic patterns
  // ========================================
  // cookieconsent_* events (e.g., cookieconsent_preferences, cookieconsent_statistics)
  if (eventName.startsWith('cookieconsent_')) {
    const category = eventName.replace('cookieconsent_', '');
    return { tool: 'Cookie Consent', category };
  }

  return null;
}

// Handle dataLayer push events
function handleDataLayerPush(tabId, data) {
  if (!tabId) return;

  // Extract the push data and dataLayer state from the new format
  const pushData = data._pushData || data;
  const dataLayerState = data._dataLayerState || null;
  const pushIndex = data._pushIndex || null;
  const isHistorical = data._isHistorical || false;
  // CRITICAL: Use timestamp captured at the moment of dataLayer.push() for accurate ordering
  // This ensures events appear in the correct chronological order in the panel
  const capturedTimestamp = data._timestamp || Date.now();

  const eventName = pushData.event || getDataLayerEventName(pushData);

  // Detect Google Consent Mode pushes: ["consent", "update"|"default", {...}]
  const consentMode = detectGoogleConsentMode(pushData);

  // Detect gtag "set" commands: ads_data_redaction, url_passthrough, developer_id
  const setCommand = detectGtagSetCommand(pushData);

  // Detect Cookie Information consent category events (cookie_cat_*)
  const consentEvent = detectConsentEvent(eventName, pushData);

  // Determine if this is a GTM internal event or a website dataLayer push.
  // walkerOS events (detected by their envelope shape) are re-attributed from the
  // generic `datalayer` tool to `walkeros` (tag-manager) — BUG56. GTM internal
  // events (gtm.*) take precedence and never match the walkerOS envelope.
  const isGTMEvent = isGTMInternalEvent(eventName);
  const walkerEnvelope = isGTMEvent ? null : detectWalkerOSEnvelope(pushData);
  let platform, platformName;
  if (isGTMEvent) {
    platform = 'gtm';
    platformName = 'GTM';
  } else if (walkerEnvelope) {
    platform = 'walkeros';
    platformName = 'walkerOS';
    // Count walkerOS toward the badge so it surfaces as a detected tool.
    addBadgePlatform(tabId, 'walkeros');
  } else {
    platform = 'datalayer';
    platformName = 'dataLayer';
  }

  // Build display event name
  let displayEventName = eventName;
  if (walkerEnvelope) {
    // walkerOS uses 'entity action' as the event name (e.g. "page view").
    displayEventName = walkerEnvelope.name;
  }
  if (consentMode) {
    // ["consent", "update", {...}] → "Google Consent: Update"
    const action = consentMode.action;
    displayEventName = `Google Consent: ${action.charAt(0).toUpperCase() + action.slice(1)}`;
  } else if (setCommand?.type === 'consent-setting') {
    // ["set", "ads_data_redaction", true] → "Google Consent: ads_data_redaction"
    displayEventName = `Google Consent: ${setCommand.setting}`;
  } else if (setCommand?.type === 'developer-id') {
    // ["set", "developer_id.dNmIyNz", true] → "set developer_id"
    displayEventName = 'set developer_id';
  }

  // Create event from dataLayer push
  const event = {
    id: crypto.randomUUID(),
    timestamp: capturedTimestamp, // Use timestamp from when push() actually occurred
    platform: platform,
    platformName: platformName,
    eventName: displayEventName,
    raw: data,
    formatted: {
      pushIndex: pushIndex,
      event: eventName,
      pushData: cleanPushData(pushData),
      dataLayerState: dataLayerState,
      dataLayerLength: data._dataLayerLength || null,
      isHistorical: isHistorical,
      isGTMInternalEvent: isGTMEvent,
      googleConsentMode: consentMode,
      consentEvent: consentEvent || (setCommand?.type === 'consent-setting' ? { tool: 'Google Consent Mode', category: setCommand.setting, value: setCommand.value } : null),
      gtagSetCommand: setCommand,
      // developer_id events are consent-related (they indicate CMP/vendor integration)
      isDeveloperIdEvent: setCommand?.type === 'developer-id',
      // Push source: who called dataLayer.push() — detected via stack trace in page script
      pushSource: data._pushSource || null,       // 'website' | 'tag-manager' | 'script' | 'historical' | 'unknown'
      pushSourceUrl: data._pushSourceUrl || null,  // URL of the source script
      // Detect if this event was pushed by Event Watcher (replay/manual push)
      isEventWatcherPush: !!pushData._eventWatcherPush
    }
  };

  handleAnalyticsEvent(tabId, event);
}

// Clean push data by removing internal properties
function cleanPushData(data) {
  // Handle arrays - return as-is (don't spread into object)
  // Use multiple detection methods in case Array.isArray fails for cross-realm arrays
  if (Array.isArray(data) ||
      (data && typeof data === 'object' && typeof data.length === 'number' && data.constructor?.name === 'Array') ||
      Object.prototype.toString.call(data) === '[object Array]') {
    return data;
  }

  // Also detect "array-like objects" that were incorrectly converted from arrays
  // These have numeric string keys ("0", "1", "2") and no other properties
  if (data && typeof data === 'object') {
    const keys = Object.keys(data);
    const isArrayLike = keys.length > 0 &&
      keys.every(k => /^\d+$/.test(k)) &&
      !data.hasOwnProperty('event') && // Real dataLayer objects have 'event'
      !data.hasOwnProperty('gtm.start'); // Or GTM internal properties

    if (isArrayLike) {
      // Convert back to array
      const maxIndex = Math.max(...keys.map(k => parseInt(k, 10)));
      const arr = [];
      for (let i = 0; i <= maxIndex; i++) {
        arr.push(data[i]);
      }
      return arr;
    }
  }

  const cleaned = { ...data };
  delete cleaned._pushIndex;
  delete cleaned._timestamp;
  delete cleaned._pushData;
  delete cleaned._dataLayerState;
  delete cleaned._dataLayerLength;
  delete cleaned._isHistorical;
  delete cleaned._stateSource;
  delete cleaned._eventWatcherPush;
  delete cleaned.event; // event is shown separately
  return cleaned;
}

// Handle Tealium utag.view/utag.link/utag_data events
// utag_data = Data Layer (website sets this object, exists without Tealium)
// utag.view()/utag.link() = Tag Management (Tealium API methods, wouldn't exist without utag.js)
// The Tag Manager (Tealium IQ) is detected via network requests to tags.tiqcdn.com
function handleTealiumPush(tabId, data) {
  if (!tabId) return false;

  const eventType = data._eventType || 'track';
  const eventData = data._eventData || {};

  // Skip false positives: Cookie Information CMP writes consent data to window.utag_data
  // even when Tealium is not present on the site. Detect by checking if the data contains
  // only Cookie Information keys (cookie_information_*) and no actual Tealium data.
  if (eventType === 'utag_data') {
    const dataKeys = Object.keys(eventData);
    const allCookieInfo = dataKeys.length > 0 && dataKeys.every(key =>
      key.startsWith('cookie_information_') || key.startsWith('cookie_cat_')
    );
    if (allCookieInfo) return false;
  }

  // Use shared parser for structured formatting
  const parsed = formatTealiumEventData(data);

  // Only utag_data is a true Data Layer (exists without tag manager)
  // utag.view() and utag.link() are Tealium API methods (Tag Management)
  const platform = parsed.isDataLayerEvent ? 'tealium-datalayer' : 'tealium';
  const platformName = parsed.isDataLayerEvent ? 'Tealium utag_data' : 'Tealium';

  const event = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    platform: platform,
    platformName: platformName,
    eventName: parsed.eventName,
    raw: data,
    formatted: {
      overview: parsed.overview,
      sections: parsed.sections,
      eventIndex: data._tealiumEventIndex,
      eventType: parsed.eventType,
      isHistorical: data._isHistorical || false,
      // Categorized full-UDO state for the dedicated utag_data renderer (#152);
      // null for utag.view/link (they render via the generic renderer).
      dataLayerState: parsed.dataLayerState
    }
  };

  handleAnalyticsEvent(tabId, event);
  return true;
}

// Handle Adobe Data Layer (ACDL) events
// adobeDataLayer.push() = Data Layer (website pushes data, the ACDL library can exist without Adobe Tags)
// _satellite.track() = Tag Management (Adobe Tags API method, wouldn't exist without Tags/Launch)
// The Tag Manager (Adobe Tags) is detected via network requests to assets.adobedtm.com
function handleAdobeLaunchPush(tabId, data) {
  if (!tabId) return;

  const eventType = data._eventType || 'push'; // 'push', 'track', etc.
  const source = data._source || 'adobeDataLayer'; // 'adobeDataLayer' or '_satellite'
  const eventData = data._eventData || {};
  const adobeDataLayerState = data._adobeDataLayerState || null;
  const isHistorical = data._isHistorical || false;

  // Get event name - for ACDL use event property, for _satellite.track use identifier
  let eventName;
  if (source === '_satellite') {
    eventName = eventData.identifier || eventType;
  } else {
    eventName = eventData.event || data.event || 'push';
  }

  // Clean the event data (remove internal properties)
  const cleanedData = { ...eventData };
  delete cleanedData.event; // shown separately

  // adobeDataLayer is a true Data Layer (exists without Adobe Launch)
  // _satellite.track() is an Adobe Launch API method (Tag Management)
  const isDataLayerEvent = source === 'adobeDataLayer';
  const platform = isDataLayerEvent ? 'adobe-datalayer' : 'adobe-launch';
  const platformName = isDataLayerEvent ? 'Adobe Data Layer' : 'Adobe Tags';

  const event = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    platform: platform,
    platformName: platformName,
    eventName: eventName,
    raw: data,
    formatted: {
      eventIndex: data._adobeLaunchEventIndex,
      eventType: eventType,
      source: source,
      eventName: eventName,
      eventData: cleanedData,
      adobeDataLayerState: adobeDataLayerState,
      isHistorical: isHistorical
    }
  };

  handleAnalyticsEvent(tabId, event);
}

// Handle W3C digitalData events
function handleW3CDigitalDataPush(tabId, data) {
  if (!tabId) return;

  const eventType = data._eventType || 'snapshot';
  const eventData = data._eventData || {};
  const isHistorical = data._isHistorical || false;

  const event = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    platform: 'w3c-datalayer',
    platformName: 'W3C digitalData',
    eventName: 'digitalData',
    raw: data,
    formatted: {
      eventIndex: data._w3cEventIndex,
      eventType: eventType,
      eventData: eventData,
      isHistorical: isHistorical
    }
  };

  handleAnalyticsEvent(tabId, event);
}

// Handle Commanders Act tc_vars events
function handleCommandersActPush(tabId, data) {
  if (!tabId) return;

  const eventType = data._eventType || 'snapshot';
  const eventData = data._eventData || {};
  const isHistorical = data._isHistorical || false;

  const event = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    platform: 'commandersact-datalayer',
    platformName: 'Commanders Act tc_vars',
    eventName: 'tc_vars',
    raw: data,
    formatted: {
      eventIndex: data._tcVarsEventIndex,
      eventType: eventType,
      eventData: eventData,
      isHistorical: isHistorical
    }
  };

  handleAnalyticsEvent(tabId, event);
}

// Handle Relay42 defined42 events
function handleRelay42Push(tabId, data) {
  if (!tabId) return;

  const eventType = data._eventType || 'push';
  const eventData = data._eventData || {};
  const isHistorical = data._isHistorical || false;

  // Try to extract event name from the data
  let eventName = 'defined42';
  if (eventData.event) {
    eventName = eventData.event;
  } else if (eventData.type) {
    eventName = eventData.type;
  }

  const event = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    platform: 'relay42-datalayer',
    platformName: 'Relay42 defined42',
    eventName: eventName,
    raw: data,
    formatted: {
      eventIndex: data._relay42EventIndex,
      eventType: eventType,
      eventData: eventData,
      isHistorical: isHistorical
    }
  };

  handleAnalyticsEvent(tabId, event);
}

// Handle Ensighten data layer events
function handleEnsightenPush(tabId, data) {
  if (!tabId) return;

  const eventType = data._eventType || 'snapshot';
  const source = data._source || 'ensightenDataLayer';
  const eventData = data._eventData || {};
  const isHistorical = data._isHistorical || false;

  const event = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    platform: 'ensighten-datalayer',
    platformName: 'Ensighten Data Layer',
    eventName: source,
    raw: data,
    formatted: {
      eventIndex: data._ensightenEventIndex,
      eventType: eventType,
      source: source,
      eventData: eventData,
      isHistorical: isHistorical
    }
  };

  handleAnalyticsEvent(tabId, event);
}

// Handle user interaction events (click, change, submit markers)
function handleInteractionEvent(tabId, data) {
  if (!tabId) return;

  const label = data.label || data.element?.tagName || 'Unknown';
  const action = data.action || 'click';
  const elementType = data.elementType || null;
  const value = data.value || null;

  // Build eventName based on action type and element info
  let eventName;
  if (action === 'click' && !elementType) {
    // Phase 1 click (buttons, links): Click: "Label"
    eventName = `Click: "${label}"`;
  } else if (action === 'click' && elementType) {
    // Checkbox click: Click: CHECKBOX "Label" → checked/unchecked
    eventName = value
      ? `Click: ${elementType} "${label}" \u2192 ${value}`
      : `Click: ${elementType} "${label}"`;
  } else if (action === 'change') {
    // Tier 1: Change: SELECT "Label" → "Value"
    // Tier 2: Change: INPUT[text] "Label" (no value)
    eventName = value
      ? `Change: ${elementType} "${label}" \u2192 "${value}"`
      : `Change: ${elementType} "${label}"`;
  } else if (action === 'submit') {
    // Submit: FORM "Label" → /action/path
    if (label && value) {
      eventName = `Submit: FORM "${label}" \u2192 ${value}`;
    } else if (value) {
      eventName = `Submit: FORM \u2192 ${value}`;
    } else if (label) {
      eventName = `Submit: FORM "${label}"`;
    } else {
      eventName = 'Submit: FORM';
    }
  } else {
    eventName = `${action}: "${label}"`;
  }

  const event = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    platform: 'interactions',
    platformName: 'Interaction',
    eventName: eventName,
    isInteraction: true,
    raw: {
      action: action,
      elementType: elementType,
      value: value,
      isTier1: data.isTier1 ?? null,
      element: {
        tagName: data.element?.tagName || null,
        textContent: data.element?.textContent || null,
        type: data.element?.type || null,
        id: data.element?.id || null,
        name: data.element?.name || null,
        href: data.element?.href || null,
        formAction: data.element?.formAction || null,
        formMethod: data.element?.formMethod || null
      },
      pageUrl: data.pageUrl || null,
      pageHostname: data.pageHostname || null
    }
  };

  handleAnalyticsEvent(tabId, event);
}

// Get event name from dataLayer push
function getDataLayerEventName(data) {
  // Handle array and array-like commands: ["command", arg1, arg2]
  // GTM/gtag uses array format for event, config, set, consent, js commands
  // Data can be a real Array or array-like object with numeric keys (from message serialization)
  const isArray = Array.isArray(data) ||
    (data && typeof data === 'object' && data[0] !== undefined && typeof data[0] === 'string');

  if (isArray) {
    const command = data[0];
    const arg1 = data[1];

    if (command === 'event' && arg1) return String(arg1);
    if (command === 'config' && arg1) return `config: ${arg1}`;
    if (command === 'js') return 'js';
    if (command === 'set' && typeof arg1 === 'string') return `set: ${arg1}`;
    if (command === 'set' && arg1 && typeof arg1 === 'object') return 'set';
    if (command === 'consent') return 'consent';
    if (typeof command === 'string') return command;
    return 'dataLayer.push';
  }

  // Check for common event name patterns (object format)
  if (data.event) return data.event;
  if (data['gtm.start']) return 'gtm.start';
  if (data.ecommerce) return 'ecommerce';

  // Check for GTM auto-events
  const keys = Object.keys(data || {});
  const gtmKey = keys.find(k => k.startsWith('gtm.'));
  if (gtmKey) return gtmKey;

  // If there's only one meaningful key, use that
  const meaningfulKeys = keys.filter(k => !k.startsWith('_'));
  if (meaningfulKeys.length === 1) return meaningfulKeys[0];

  return 'dataLayer.push';
}



// Clean up when tab is closed
// Drop every per-tab map entry for a tab that's gone. Factored out so
// onReplaced can reuse it (N14, #139): a tab discarded by Memory Saver or a
// crashed renderer can be replaced without ever firing onRemoved, which would
// otherwise leak recentNavigations / navigationStartTimes / tabCMPConsentState.
function cleanupTabState(tabId) {
  tabEvents.delete(tabId);
  devtoolsPanels.delete(tabId);
  recentNavigations.delete(tabId);
  navigationStartTimes.delete(tabId);
  tabBadgePlatforms.delete(tabId);
  tabPerfStats.delete(tabId);
  tabCMPConsentState.delete(tabId);
  const badgeTimer = badgeUpdateTimers.get(tabId);
  if (badgeTimer) {
    clearTimeout(badgeTimer);
    badgeUpdateTimers.delete(tabId);
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  cleanupTabState(tabId);
});

// onReplaced fires when a prerendered/discarded tab swaps its tabId — the old
// id never fires onRemoved, so clean it up here to stop the per-tab maps leaking.
chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  cleanupTabState(removedTabId);
});

// Clean up when tab navigates (hard navigation)
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  // Only clear for main frame navigation
  if (details.frameId === 0) {
    tabEvents.set(details.tabId, []);
    tabBadgePlatforms.delete(details.tabId);
    tabPerfStats.delete(details.tabId);
    tabCMPConsentState.delete(details.tabId);
    // Clear recent navigation state - new hard navigation means fresh start for deduplication
    recentNavigations.delete(details.tabId);
    updateBadge(details.tabId);

    // Track navigation start time for calculating page load duration
    const url = details.url;
    if (!url.startsWith('chrome://') &&
        !url.startsWith('chrome-extension://') &&
        !url.startsWith('about:') &&
        !url.startsWith('data:') &&
        !url.startsWith('blob:')) {
      navigationStartTimes.set(details.tabId, { url, startTime: Date.now() });
    }
  }
});

// Inject debug_mode into dataLayer for active preview rules with gtmDebug enabled.
// Fires on onCommitted (after navigation commits, before page scripts run) so the
// dataLayer entry exists before GTM loads. GA4 picks up debug_mode: true and routes
// events to DebugView instead of regular reports — no Tag Assistant popup triggered.
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  const url = details.url;
  if (url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
      url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:')) return;

  chrome.storage.local.get(['gtmInterceptRules'], (result) => {
    const rules = result.gtmInterceptRules || [];
    const hasDebugPreview = rules.some(r =>
      r.active && r.action === 'preview' && r.gtmDebug && matchesRuleDomain(r, url)
    );
    if (!hasDebugPreview) return;

    chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      world: 'MAIN',
      func: () => {
        try {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ debug_mode: true });
        } catch { /* page may block access */ }
      }
    }).catch(() => { /* tab may not be scriptable */ });
  });
});

/**
 * Check if a rule's domain scope matches a given URL.
 * Lightweight version for the service worker (no import from panel modules).
 */
function matchesRuleDomain(rule, url) {
  if (!rule.domain) return true; // global rule
  try {
    const hostname = new URL(url).hostname;
    if (rule.domain.startsWith('.')) {
      const base = rule.domain.slice(1);
      return hostname === base || hostname.endsWith(rule.domain);
    }
    if (rule.domain.startsWith('regex:')) {
      return new RegExp(rule.domain.slice(6)).test(hostname);
    }
    return rule.domain === hostname;
  } catch { return false; }
}

// Track navigation events via webNavigation API as fallback
// This catches navigations even when page script can't run (CSP blocked)
chrome.webNavigation.onCompleted.addListener((details) => {
  // Only track main frame navigations
  if (details.frameId !== 0) return;

  const tabId = details.tabId;
  const url = details.url;

  // Skip internal URLs
  if (url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('about:') ||
      url.startsWith('data:') ||
      url.startsWith('blob:')) {
    return;
  }

  // Skip if duplicate (page script already sent this)
  if (isDuplicateNavigation(tabId, url)) {
    return;
  }

  // Record this navigation (hard navigation from webNavigation API)
  recordNavigation(tabId, url, true);

  try {
    const urlObj = new URL(url);
    const path = (urlObj.pathname + urlObj.search + urlObj.hash) || '/';

    // Calculate page load duration if we have the start time
    const navStart = navigationStartTimes.get(tabId);
    const endTime = Date.now();
    let loadDurationMs = null;
    let startTime = null;
    if (navStart && navStart.url === url) {
      startTime = navStart.startTime;
      loadDurationMs = endTime - startTime;
      navigationStartTimes.delete(tabId);
    }

    // Create navigation event
    const event = {
      id: crypto.randomUUID(),
      timestamp: endTime,
      platform: 'pages',
      platformName: 'Page',
      eventName: path,
      isNavigation: true,
      raw: {
        url: url,
        path: path,
        isInitial: false,
        source: 'webNavigation', // Mark as coming from webNavigation API
        navigationStart: startTime,
        navigationEnd: endTime,
        loadDurationMs: loadDurationMs
      },
      formatted: {
        url: url,
        path: path,
        isInitial: false,
        source: 'webNavigation',
        navigationStart: startTime,
        navigationEnd: endTime,
        loadDurationMs: loadDurationMs
      }
    };

    handleAnalyticsEvent(tabId, event);
  } catch (e) {
    // Invalid URL, ignore
  }
});

// Also track SPA navigations via history state changes
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  // Only track main frame
  if (details.frameId !== 0) return;

  const tabId = details.tabId;
  const url = details.url;

  // Skip internal URLs
  if (url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('about:')) {
    return;
  }

  // Skip if duplicate - especially soft navigations to same URL as hard navigation
  // (sites often trigger History API after page load, but real SPA navigations change the path)
  if (isDuplicateNavigation(tabId, url, true)) {
    return;
  }

  // Record this navigation (soft navigation from History API)
  recordNavigation(tabId, url, false);

  try {
    const urlObj = new URL(url);
    const path = (urlObj.pathname + urlObj.search + urlObj.hash) || '/';

    // Create navigation event for SPA navigation
    const event = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      platform: 'pages',
      platformName: 'Page',
      eventName: path,
      isNavigation: true,
      raw: {
        url: url,
        path: path,
        isInitial: false,
        source: 'historyStateUpdated' // SPA navigation via history API
      },
      formatted: {
        url: url,
        path: path,
        isInitial: false,
        source: 'historyStateUpdated'
      }
    };

    handleAnalyticsEvent(tabId, event);
  } catch (e) {
    // Invalid URL, ignore
  }
});

// ===== Badge: Extension icon badge showing detected tool count =====

/**
 * Check if a tab's current domain has active GTM intercept rules.
 * @param {number} tabId
 * @returns {Promise<boolean>}
 */
// In-memory mirror of gtmInterceptRules (#131 F11) — updateBadge() runs on
// every platform detection and every tab switch, and previously paid a
// storage round-trip each time. Hydrated lazily on first use; kept fresh by
// the storage.onChanged listener below (which already exists for badge
// refresh). A freshly-woken service worker starts at null and re-hydrates.
let gtmRulesCache = null;
async function getGtmInterceptRules() {
  if (gtmRulesCache === null) {
    const { gtmInterceptRules = [] } = await chrome.storage.local.get('gtmInterceptRules');
    gtmRulesCache = gtmInterceptRules;
  }
  return gtmRulesCache;
}

async function hasActiveInterceptRules(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) return false;
    const gtmInterceptRules = await getGtmInterceptRules();
    const hasOpenPanel = devtoolsPanels.size > 0;
    return gtmInterceptRules.some(r =>
      r.active && matchesRuleDomain(r, tab.url) && ((r.scope || 'always') === 'always' || hasOpenPanel)
    );
  } catch {
    return false;
  }
}

/**
 * Update the extension badge for a tab.
 * Shows "GTM" in blue when intercept rules are active on the tab's domain,
 * otherwise shows the count of unique platforms detected in red.
 */
async function updateBadge(tabId) {
  const platformCounts = tabBadgePlatforms.get(tabId);
  const count = platformCounts ? platformCounts.size : 0;
  const interceptActive = await hasActiveInterceptRules(tabId);

  try {
    if (interceptActive) {
      await chrome.action.setBadgeText({ text: 'GTM', tabId });
      await chrome.action.setBadgeBackgroundColor({ color: '#1A73E8', tabId });
      await chrome.action.setBadgeTextColor({ color: '#FFFFFF', tabId });
    } else if (count > 0) {
      await chrome.action.setBadgeText({ text: String(count), tabId });
      await chrome.action.setBadgeBackgroundColor({ color: '#C0392B', tabId });
    } else {
      await chrome.action.setBadgeText({ text: '', tabId });
    }
  } catch (e) {
    // Tab may have been closed - ignore the error
  }
}

// Per-tab trailing-edge debounce for badge updates. `updateBadge` is async with
// awaited reads (tabs.get + rule lookup), so two overlapping calls for the same
// tab — onCompleted firing rapidly while onActivated fires, or an O(tabs) burst
// from a rule write — could resolve out of order and paint a stale count / wrong
// "GTM" text (N13). Coalescing to one trailing run per tab also collapses the
// rule-write burst into one update per tab (N15). (#139)
const badgeUpdateTimers = new Map(); // tabId -> timeoutId
const BADGE_UPDATE_DEBOUNCE_MS = 100;
function scheduleBadgeUpdate(tabId) {
  if (!tabId) return;
  const existing = badgeUpdateTimers.get(tabId);
  if (existing) clearTimeout(existing);
  badgeUpdateTimers.set(tabId, setTimeout(() => {
    badgeUpdateTimers.delete(tabId);
    updateBadge(tabId);
  }, BADGE_UPDATE_DEBOUNCE_MS));
}

// Re-check badge when user switches tabs (different domain → different rule state)
chrome.tabs.onActivated.addListener((activeInfo) => {
  scheduleBadgeUpdate(activeInfo.tabId);
});

// Re-check badge on all tabs when intercept rules change
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.gtmInterceptRules) return;
  // Refresh the in-memory mirror BEFORE re-running badges (#131 F11)
  gtmRulesCache = changes.gtmInterceptRules.newValue || [];
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      scheduleBadgeUpdate(tab.id);
    }
  });
});

/**
 * Register a detected platform for badge counting.
 * Increments the request count and stores the URL (up to MAX_URLS_PER_PLATFORM).
 * @param {number} tabId
 * @param {string} platformId
 * @param {string} [url] - Optional URL of the request
 */
function addBadgePlatform(tabId, platformId, url = null) {
  if (!tabId || !platformId) return;

  if (!tabBadgePlatforms.has(tabId)) {
    tabBadgePlatforms.set(tabId, new Map());
  }

  const platforms = tabBadgePlatforms.get(tabId);
  const existing = platforms.get(platformId);
  // An entry may have been pre-created by onBeforeRequest (count 0) to attach
  // networkEventCounts before the response completes — treat that as "first request".
  const isFirstRequest = !existing || existing.count === 0;

  if (!existing) {
    platforms.set(platformId, { count: 1, urls: url ? [url] : [] });
  } else {
    existing.count++;
    if (url && existing.urls.length < MAX_URLS_PER_PLATFORM) {
      existing.urls.push(url);
    }
  }

  if (isFirstRequest) scheduleBadgeUpdate(tabId);
}

// Platforms whose event names live in POST request bodies (parsed in onBeforeRequest).
const POST_BODY_EVENT_PLATFORMS = new Set(['amplitude']);

// Decode a webRequest requestBody into a string for parser input.
function decodeRequestBody(requestBody) {
  if (!requestBody) return null;
  if (requestBody.raw && requestBody.raw.length > 0) {
    try {
      const decoder = new TextDecoder('utf-8');
      let text = '';
      for (const part of requestBody.raw) {
        if (part.bytes) text += decoder.decode(part.bytes, { stream: true });
      }
      return text + decoder.decode();
    } catch {
      return null;
    }
  }
  if (requestBody.formData) {
    const params = new URLSearchParams();
    for (const [key, values] of Object.entries(requestBody.formData)) {
      for (const v of values) params.append(key, v);
    }
    return params.toString();
  }
  return null;
}

// Record per-(identifier, event-name) counts for a platform whose events live in POST bodies.
function recordNetworkEvent(tabId, platformId, identifier, eventName) {
  if (!tabId || !platformId || !eventName) return;

  if (!tabBadgePlatforms.has(tabId)) {
    tabBadgePlatforms.set(tabId, new Map());
  }
  const platforms = tabBadgePlatforms.get(tabId);
  let data = platforms.get(platformId);
  if (!data) {
    data = { count: 0, urls: [] };
    platforms.set(platformId, data);
  }
  if (!data.networkEventCounts) data.networkEventCounts = new Map();

  const key = `${identifier || ''}|${eventName}`;
  data.networkEventCounts.set(key, (data.networkEventCounts.get(key) || 0) + 1);
}

function handleAmplitudePostBody(tabId, url, postData) {
  try {
    const parsed = parseAmplitudeRequestData(url, postData);
    if (!parsed.events || parsed.events.length === 0) return;
    for (const ev of parsed.events) {
      if (!ev.eventName) continue;
      recordNetworkEvent(tabId, 'amplitude', parsed.apiKey || '', ev.eventName);
    }
  } catch {
    // Parsing failed — ignore silently, the badge/URL counter still works.
  }
}

// Capture POST bodies for platforms whose event names aren't in the URL.
// URL filter is scoped to the known POST-body platforms to avoid loading
// request bodies for every POST on the page. Add new entries here when
// expanding POST_BODY_EVENT_PLATFORMS.
const POST_BODY_URL_FILTERS = [
  '*://*.amplitude.com/*',
  '*://amplitude.com/*'
];

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return;
    if (details.method !== 'POST') return;
    const platformId = matchUrlToEndpoint(details.url, details.type);
    if (!platformId || !POST_BODY_EVENT_PLATFORMS.has(platformId)) return;

    const postData = decodeRequestBody(details.requestBody);
    if (!postData) return;

    if (platformId === 'amplitude') {
      handleAmplitudePostBody(details.tabId, details.url, postData);
    }
  },
  { urls: POST_BODY_URL_FILTERS },
  ['requestBody']
);

// Detect tracking tools from network requests (works without DevTools open).
// Only observes request URLs for badge counting - no request bodies or details are stored.
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.tabId < 0) return;

    const perfStart = performance.now();
    // Pass resource type to enable script load detection (e.g., Hotjar, Clarity CDN loads)
    const platformId = matchUrlToEndpoint(details.url, details.type);
    const elapsed = performance.now() - perfStart;

    // Update per-tab perf stats
    if (!tabPerfStats.has(details.tabId)) {
      tabPerfStats.set(details.tabId, { requestCount: 0, matchCount: 0, totalMatchTimeMs: 0 });
    }
    const stats = tabPerfStats.get(details.tabId);
    stats.requestCount++;
    stats.totalMatchTimeMs += elapsed;

    if (platformId) {
      stats.matchCount++;
      addBadgePlatform(details.tabId, platformId, details.url);
    }
  },
  { urls: ['<all_urls>'] }
);

// ===== GTM Container Intercept — DNR Rule Management =====
// Manages declarativeNetRequest dynamic rules for blocking/replacing GTM containers.
// Rules are stored in chrome.storage.local as gtmInterceptRules[] and synced to DNR.
// DNR rule IDs are allocated from 1001+ to avoid conflicts.

const GTM_DNR_RULE_ID_BASE = 1001;
// Preview mode pairs each redirect rule with an "allow" rule at
// dnrRuleId + DNR_PREVIEW_RULE_OFFSET. The allocator in gtm-intercept.js
// reserves the [BASE+OFFSET, …) band so a freshly-allocated base ID can never
// collide with an existing preview-allow twin (F13) — keep the two in sync.
const DNR_PREVIEW_RULE_OFFSET = 5000;

// In-flight gate: serialise DNR read-modify-write so two concurrent invocations
// can't both read the same rule set and have the second updateDynamicRules()
// delete rules added by the first. Trailing flag collapses any number of
// overlapping calls into one extra run, so the latest storage state still wins.
let gtmInterceptInFlight = null;
let gtmInterceptPending = false;

/**
 * Sync DNR dynamic rules from storage.
 * Reads gtmInterceptRules from storage, removes old GTM DNR rules, and adds current ones.
 */
async function handleGTMInterceptUpdate() {
  if (gtmInterceptInFlight) {
    gtmInterceptPending = true;
    return gtmInterceptInFlight;
  }
  gtmInterceptInFlight = (async () => {
    try {
      do {
        gtmInterceptPending = false;
        await runGTMInterceptUpdate();
      } while (gtmInterceptPending);
    } finally {
      gtmInterceptInFlight = null;
    }
  })();
  return gtmInterceptInFlight;
}

async function runGTMInterceptUpdate() {
  try {
    const { gtmInterceptRules = [] } = await chrome.storage.local.get('gtmInterceptRules');
    const hasOpenPanel = devtoolsPanels.size > 0;
    // Existing rules without scope default to 'always' (backward compat)
    const activeRules = gtmInterceptRules.filter(r =>
      r.active && ((r.scope || 'always') === 'always' || hasOpenPanel)
    );

    // Get existing dynamic rules and remove any GTM intercept rules (ID >= 1001)
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const gtmRuleIds = existingRules
      .filter(r => r.id >= GTM_DNR_RULE_ID_BASE)
      .map(r => r.id);

    // Build new DNR rules from active intercept rules
    const newRules = [];
    for (const rule of activeRules) {
      if (rule.action === 'block') {
        newRules.push({
          id: rule.dnrRuleId,
          priority: 1,
          action: { type: 'block' },
          condition: {
            regexFilter: `https?://(?:www\\.)?googletagmanager\\.com/gtm\\.js\\?.*id=${escapeRegex(rule.containerId)}`,
            resourceTypes: ['script']
          }
        });
      } else if (rule.action === 'replace' && rule.replacementId) {
        // Capture everything up to and including "id=", then the container ID, then the rest.
        // regexSubstitution replaces only the matched portion, so we must match the full URL
        // to avoid the original protocol/host prefix being prepended to the substitution.
        newRules.push({
          id: rule.dnrRuleId,
          priority: 1,
          action: {
            type: 'redirect',
            redirect: {
              regexSubstitution: `\\1${rule.replacementId}\\2`
            }
          },
          condition: {
            regexFilter: `(https?://(?:www\\.)?googletagmanager\\.com/gtm\\.js\\?.*id=)${escapeRegex(rule.containerId)}(.*)`,
            resourceTypes: ['script']
          }
        });
      }
      else if (rule.action === 'preview' && rule.gtmAuth && rule.gtmPreview) {
        // Preview needs two DNR rules to avoid an infinite redirect loop:
        // 1. Allow rule (higher priority): skip URLs that already have gtm_auth (already redirected)
        // 2. Redirect rule (lower priority): append preview params to the original URL
        // Without the allow rule, the redirected URL still matches the regex (same container ID),
        // causing the browser to redirect infinitely (307 loop).
        newRules.push({
          id: rule.dnrRuleId + DNR_PREVIEW_RULE_OFFSET,
          priority: 2,
          action: { type: 'allow' },
          condition: {
            regexFilter: `https?://(?:www\\.)?googletagmanager\\.com/gtm\\.js\\?.*id=${escapeRegex(rule.containerId)}.*gtm_auth=`,
            resourceTypes: ['script']
          }
        });
        newRules.push({
          id: rule.dnrRuleId,
          priority: 1,
          action: {
            type: 'redirect',
            redirect: {
              regexSubstitution: `\\1${escapeRegex(rule.containerId)}\\2&gtm_auth=${escapeRegex(rule.gtmAuth)}&gtm_preview=${escapeRegex(rule.gtmPreview)}&gtm_cookies_win=x`
            }
          },
          condition: {
            regexFilter: `(https?://(?:www\\.)?googletagmanager\\.com/gtm\\.js\\?.*id=)${escapeRegex(rule.containerId)}(.*)`,
            resourceTypes: ['script']
          }
        });
      }
    }

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: gtmRuleIds,
      addRules: newRules
    });
  } catch (e) {
    console.warn('[Event Watcher] GTM intercept DNR update failed:', e);
  }
}

/** Escape special regex chars in a container ID */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// One-time migration: strip deprecated GTM inject rules ("enable" action) from storage.
// Removed in v1.0.3 to comply with Chrome Web Store's Manifest V3 remote-code policy.
// Runs once, then DNR sync picks up the cleaned rule set.
chrome.storage.local.get(['gtmInterceptRules'], (result) => {
  const rules = result.gtmInterceptRules || [];
  const cleaned = rules.filter(r => r.action !== 'enable');
  if (cleaned.length !== rules.length) {
    chrome.storage.local.set({ gtmInterceptRules: cleaned }, () => {
      handleGTMInterceptUpdate();
    });
  } else {
    handleGTMInterceptUpdate();
  }
});
