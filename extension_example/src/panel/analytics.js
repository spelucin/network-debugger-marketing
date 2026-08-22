/**
 * Amplitude analytics module for Event Watcher extension.
 * Privacy-safe: random device ID, no cookies, no PII.
 * EU data residency endpoint.
 *
 * Properties added automatically by this module (call sites don't need to include them):
 *   event_properties: install_source (also emitted as a user_property during transition),
 *                     location, theme (when setResolvedThemeGetter() was called),
 *                     bucket (when setBucketGetter() was called) — opaque per-site
 *                     identifier; see TRACKING-PLAN.md for the salted-hash construction
 *   Amplitude fields: app_version, platform, language, os_name
 *   user_properties: browser, screen_resolution, install_source, feature_flags
 *                    (object: { labs_section, ... } — effective state including any
 *                    chrome.storage.local `featureFlagOverrides` applied),
 *                    setting_* (from setSettingsUserProperties)
 *
 * DevTools auto-context (when location='devtool' and setDevToolsContext() was called):
 *   event_properties: preset, nested, view, view_index
 *
 * Call sites provide: event-specific properties only (action, tool, category, etc.)
 *
 * Feature auto-tagging: EVENT_FEATURE_MAP resolves a `feature` property for each event.
 * For ambiguous events (link_click, custom_endpoint), call sites pass an explicit
 * `feature` override.
 */

import { getFeatureFlagsForAnalytics } from './feature-flags.js';

// Maps event names to their high-level product feature area.
// Every event must have an entry here, OR the call site must pass `feature` in
// eventProperties (used when an event spans multiple features — e.g. link_click,
// custom_endpoint).
const EVENT_FEATURE_MAP = {
  // Session lifecycle (surface-scoped)
  'sidepanel_start': 'session',
  'sidepanel_page': 'session',
  'sidepanel_end': 'session',
  'devtool_start': 'session',
  'devtool_page': 'session',
  'devtool_end': 'session',
  // Event stream interactions
  'event_select': 'stream',
  'capture_state': 'stream',
  'clear_events': 'stream',
  'script_tree_context': 'stream',
  'toolbar_action': 'stream',
  // Filtering & search
  'filter_tool': 'filtering',
  'filter_category': 'filtering',
  'filter_script': 'filtering',
  'filter_consent': 'filtering',
  'filter_interaction': 'filtering',
  'filter_all_show': 'filtering',
  'filter_all_hide': 'filtering',
  'toolbar_toggle': 'filtering',
  'search': 'filtering',
  'smart_search': 'filtering',
  'toolbar_overflow_menu': 'filtering',
  'toolbar_search': 'filtering',
  // Copy & export
  'copy_output': 'export',
  'copy_debug': 'export',
  // Event detail panel
  'about_tool': 'event_detail',
  'datalayer_push': 'event_detail',
  'event_detail_section_expand': 'event_detail',
  'cookie_action': 'event_detail',
  'fingerprint_action': 'event_detail',
  // Section reorder (feature #113)
  'event_detail_section_reorder': 'event_detail',
  'event_detail_section_reset': 'event_detail',
  // Event Comments (Feature #50)
  'event_comment': 'comments',
  // Settings
  'setting_modal': 'settings',
  'setting_change': 'settings',
  // Help
  'help_modal': 'help',
  // Reports & feedback
  'report_modal': 'report',
  'report_start': 'report',
  'report_submit': 'report',
  'report_tool_prefill': 'report',
  'report_consent_prefill': 'report',
  'report_tool_ignore': 'report',
  'review_prompt_shown': 'feedback',
  'review_prompt_action': 'feedback',
  'devtool_banner': 'onboarding',
  // Tools modal
  'tool_list_modal': 'tools_modal',
  // View switching
  'view_switch': 'views',
  'view_plus': 'views',
  // Stack view (#71)
  'stack_generate': 'stack_view',
  'stack_node_click': 'stack_view',
  'stack_export': 'stack_view',
  'stack_domain_toggle': 'stack_view',
  'stack_group_toggle': 'stack_view',
  'stack_clear': 'stack_view',
  // Script Tree view
  'tree_clear': 'script_tree',
  'tree_refresh': 'script_tree',
  // Sidepanel UI
  'tool_expand': 'sidepanel',
  'owl_click': 'sidepanel',
  // GTM Container Intercept
  'gtm_intercept': 'gtm_intercept',
  'gtm_hub_modal': 'gtm_intercept',
  // Onboarding tour (Feature #41)
  'onboarding_step': 'onboarding',
  // What's New upgrade announcement
  'whats_new': 'whats_new',
  // AI features (v1.1.0)
  'ai_modal': 'ai',
  'ai_provider': 'ai',
  'ai_summary': 'ai',
  'ai_identify_unknown': 'ai',
  'ai_chat': 'ai',
  // Pinned view (Feature #45)
  'pin_event': 'pinned',
  'unpin_event': 'pinned',
  'pin_batch': 'pinned',
  'pinned_view': 'pinned',
};

// Amplitude API keys (write-only, safe for client-side use)
const AMPLITUDE_KEY_DEV = '5944df8aca3496ec0c4584c522e0f60b';
const AMPLITUDE_KEY_STORE = '6e5881b1ef1a42ac32463c3f7c709063';

// Export both keys for self-exclusion filtering
export const AMPLITUDE_API_KEYS = [AMPLITUDE_KEY_DEV, AMPLITUDE_KEY_STORE];
const AMPLITUDE_ENDPOINT = 'https://api.eu.amplitude.com/2/httpapi';

// Amplitude API hostnames — single source of truth for endpoint matching across panel files
export const AMPLITUDE_API_HOSTNAMES = ['api.amplitude.com', 'api2.amplitude.com', 'api.eu.amplitude.com'];

let deviceId = null;
let userId = null;
let analyticsEnabled = true;
let apiKey = AMPLITUDE_KEY_DEV;
let installSource = 'dev';
let analyticsLocation = null; // 'devtool', 'sidepanel', or 'popup'
let devToolsContextFn = null; // getter for preset/nested (DevTools only)
let resolvedThemeFn = null; // getter for the currently displayed theme ('light' | 'dark')
let bucketGetter = null;  // getter for the `bucket` event property (salted SHA-256 of current eTLD+1, truncated)
let settingsProperties = {}; // user_properties from settings (set on init + on change)
let suppressed = false; // when true, trackEvent drops everything except onboarding_step
                        // (used by the onboarding tour so modal open/close side-effects
                        // it triggers via hooks don't contaminate user behaviour data)

/**
 * Check if extension is installed from Chrome Web Store.
 * @returns {boolean}
 */
function isWebStoreInstall() {
  // Chrome Web Store extensions have an update_url in their manifest
  // When loaded unpacked, this field is absent
  const manifest = chrome.runtime.getManifest();
  return !!manifest.update_url;
}

/**
 * Set the location label added to all events (e.g. 'devtool', 'sidepanel').
 * Call once after initAnalytics().
 * @param {string} loc
 */
export function setAnalyticsLocation(loc) {
  analyticsLocation = loc;
}

/**
 * Register a getter function for DevTools context properties (preset, nested).
 * When location is 'devtool', these properties are auto-added to every event.
 * Call once after initAnalytics() in the DevTools panel.
 * @param {function(): {preset: boolean, nested: boolean}} fn
 */
export function setDevToolsContext(fn) {
  devToolsContextFn = fn;
}

/**
 * Register a getter returning the currently displayed theme ('light' | 'dark').
 * Unlike `setting_theme` (the user's preference, which can be 'system'), this
 * resolves to the actual appearance at the time the event is sent — so events
 * from users on "system" mode can still be segmented by light vs. dark.
 * Call once after initAnalytics().
 * @param {function(): ('light'|'dark')} fn
 */
export function setResolvedThemeGetter(fn) {
  resolvedThemeFn = fn;
}

/**
 * Register a getter returning a stable per-site identifier for the page the
 * DevTools panel is currently inspecting — a SHA-256 digest of
 * `<install_seed> || <eTLD+1>`, truncated to 16 hex chars (64 bits). Sent
 * as the `bucket` event property on every event so a single install's
 * events can be grouped by site (e.g. *"this user has events from 4
 * distinct unknown sites"*) without the actual hostname leaving the device.
 *
 * The hash is **salted with a 128-bit random secret generated once per
 * install** and persisted in `chrome.storage.local.local_seed`. The seed
 * never leaves the device, so the hash is non-reversible even with an
 * exhaustive domain wordlist — observers (including us) cannot deduce
 * which site a given hash represents. The `local_` storage-key prefix
 * additionally signals the on-device-only contract in the storage viewer.
 *
 * Trade-off: because every install uses a different seed, the same domain
 * produces a different `bucket` on every install. Grouping is therefore
 * **per-install only** — *"how many users debugged amazon.com"* is not
 * answerable from this property by design.
 *
 * The event-property name (`bucket`) is intentionally opaque so the
 * Amplitude property list does not advertise the question this property
 * answers.
 *
 * The getter returns `null` until the seed has loaded and the current
 * page's hostname has been resolved and hashed; events fired during that
 * brief window simply omit `bucket` rather than block.
 * @param {function(): (string|null)} fn
 */
export function setBucketGetter(fn) {
  bucketGetter = fn;
}

/**
 * Temporarily suppress analytics tracking. Used by the onboarding tour to
 * silence the modal-open/close and view-switch events its own step hooks
 * trigger — without those, the tour's side-effects would show up as if the
 * user had opened Settings, Help, GTM Hub, etc. themselves.
 *
 * `onboarding_step` is exempt so tour progress can still be measured.
 * @param {boolean} on
 */
export function setAnalyticsSuppressed(on) {
  suppressed = !!on;
}

/**
 * Set settings as Amplitude user_properties (persisted across events).
 * Call on init with all current settings, then again when any setting changes.
 * @param {object} props - Key/value pairs to set as user properties
 */
export function setSettingsUserProperties(props) {
  settingsProperties = { ...settingsProperties, ...props };
}

/**
 * Set the user ID for Amplitude tracking.
 * Persists to chrome.storage.local so it survives restarts.
 * @param {string} id - The user ID (email address)
 */
export async function setUserId(id) {
  userId = id;
  try {
    await chrome.storage.local.set({ analytics_user_id: id });
  } catch (e) {
    // Silent fail
  }
}

/**
 * Initialize analytics module.
 * Reads or generates device ID, reads opt-out preference.
 */
export async function initAnalytics() {
  try {
    // Select API key and install source based on how extension was installed
    const isStore = isWebStoreInstall();
    apiKey = isStore ? AMPLITUDE_KEY_STORE : AMPLITUDE_KEY_DEV;
    installSource = isStore ? 'chrome_web_store' : 'dev';

    const stored = await chrome.storage.local.get([
      'analytics_device_id', 'analytics_user_id', 'analytics_enabled',
      'analyticsEnabled'
    ]);

    // The legacy v1.0.x 'analyticsEnabled' opt-out migration is deliberately
    // kept even though the sibling amplitudeDeviceId / amplitudeUserId
    // migrations were retired after two release windows: dropping it would
    // silently re-enable telemetry for a dormant opted-out user upgrading
    // straight from pre-v1.2.0, while a dropped device id only costs a fresh
    // anonymous identity.
    const legacyKeysToRemove = [];
    let migratedEnabled = stored.analytics_enabled;
    if (migratedEnabled === undefined && stored.analyticsEnabled !== undefined) {
      migratedEnabled = stored.analyticsEnabled;
      legacyKeysToRemove.push('analyticsEnabled');
    }

    // Get or generate device ID
    if (stored.analytics_device_id) {
      deviceId = stored.analytics_device_id;
    } else {
      deviceId = crypto.randomUUID();
    }

    // Restore user ID if previously set
    if (stored.analytics_user_id) {
      userId = stored.analytics_user_id;
    }

    // Read opt-out preference (default: enabled)
    analyticsEnabled = migratedEnabled !== false;

    // Persist any new/migrated values, then remove legacy keys.
    const toSet = {};
    if (stored.analytics_device_id !== deviceId) toSet.analytics_device_id = deviceId;
    if (migratedEnabled !== undefined && stored.analytics_enabled !== migratedEnabled) toSet.analytics_enabled = migratedEnabled;
    if (Object.keys(toSet).length > 0) {
      await chrome.storage.local.set(toSet);
    }
    if (legacyKeysToRemove.length > 0) {
      await chrome.storage.local.remove(legacyKeysToRemove);
    }

    // Listen for changes to analytics_enabled
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.analytics_enabled !== undefined) {
        analyticsEnabled = changes.analytics_enabled.newValue !== false;
      }
    });
  } catch (e) {
    // Silent fail - analytics must never break the extension
  }
}

/**
 * Get basic device/browser info from navigator (privacy-safe).
 * @returns {object}
 */
function getDeviceInfo() {
  const nav = navigator;
  return {
    // Amplitude built-in fields (will show in Amplitude UI)
    language: nav.language || undefined,
    os_name: getOSName(),
    // Custom properties
    browser: getBrowserName(),
    screen_resolution: `${screen.width}x${screen.height}`
  };
}

/**
 * Detect OS from userAgent.
 * @returns {string}
 */
function getOSName() {
  const ua = navigator.userAgent;
  if (ua.includes('Win')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('CrOS')) return 'Chrome OS';
  return 'Unknown';
}

/**
 * Detect browser name.
 * Exported so other modules (e.g. sidepanel) can share one UA-detection path.
 * @returns {string} 'Chrome' | 'Edge' | 'Firefox' | 'Safari' | 'Unknown'
 */
export function getBrowserName() {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome/')) return 'Chrome';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari';
  return 'Unknown';
}

/**
 * Track an event to Amplitude.
 * Fire and forget - no retries, silent failures.
 * @param {string} eventType - The event name
 * @param {object} eventProperties - Optional event properties
 * @param {object} [options] - Optional tracking options
 * @param {object} [options.userPropertyIncrements] - User properties to increment via Amplitude $add
 * @param {boolean} [options.beacon] - Use sendBeacon / keepalive fetch for unload-time events (e.g. `sidepanel_end`, `devtool_end`)
 */
export function trackEvent(eventType, eventProperties = {}, options = {}) {
  if (!analyticsEnabled || !deviceId) return;
  if (suppressed && eventType !== 'onboarding_step') return;

  try {
    const deviceInfo = getDeviceInfo();
    const featureFlags = getFeatureFlagsForAnalytics();

    // Auto-add DevTools context (preset, nested) when in DevTools panel
    let props = eventProperties;
    if (analyticsLocation === 'devtool' && devToolsContextFn) {
      const ctx = devToolsContextFn();
      props = { ...eventProperties, ...ctx };
    }

    // Auto-resolve feature from event name, allow explicit override from call site
    const feature = props.feature || EVENT_FEATURE_MAP[eventType];
    if (feature) {
      props = { ...props, feature };
    }

    // Build user_properties with explicit Amplitude operators.
    // install_source and feature_flags are stable per install, so they live on the
    // user profile. install_source is also kept on event_properties during the
    // transition so existing Amplitude charts that filter on it keep working.
    const userProps = {
      $set: {
        browser: deviceInfo.browser,
        screen_resolution: deviceInfo.screen_resolution,
        install_source: installSource,
        feature_flags: featureFlags,
        ...settingsProperties
      }
    };
    if (options.userPropertyIncrements) {
      userProps.$add = options.userPropertyIncrements;
    }

    const payload = {
      api_key: apiKey,
      options: {
        // Let Amplitude derive country from IP (IP is not stored)
        ip: '$remote'
      },
      events: [{
        device_id: deviceId,
        ...(userId ? { user_id: userId } : {}),
        event_type: eventType,
        event_properties: {
          ...props,
          install_source: installSource,
          ...(analyticsLocation ? { location: analyticsLocation } : {}),
          ...(resolvedThemeFn ? { theme: resolvedThemeFn() } : {}),
          ...(bucketGetter && bucketGetter() ? { bucket: bucketGetter() } : {})
        },
        // Amplitude built-in user properties
        language: deviceInfo.language,
        os_name: deviceInfo.os_name,
        user_properties: userProps,
        app_version: chrome.runtime.getManifest().version,
        platform: 'chrome-extension'
      }]
    };

    const body = JSON.stringify(payload);

    // Unload-time events need to survive document teardown. Prefer sendBeacon;
    // fall back to fetch with keepalive when beacon is unavailable or rejects.
    if (options.beacon) {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon && navigator.sendBeacon(AMPLITUDE_ENDPOINT, blob)) {
          return;
        }
      } catch (_) { /* fall through to keepalive fetch */ }
      fetch(AMPLITUDE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      }).catch(() => {});
      return;
    }

    fetch(AMPLITUDE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    }).catch(() => {
      // Silent fail
    });
  } catch (e) {
    // Silent fail - analytics must never break the extension
  }
}
