// Event Watcher — Page Script (runs in page context, has access to window.dataLayer)

(function() {
  'use strict';

  // Avoid double initialization
  if (window.__eventWatcherPageScript) return;
  window.__eventWatcherPageScript = true;

  // Default settings
  const DEFAULT_SETTINGS = {
    'datalayer': true,
    'adobe-datalayer': true,
    'tealium-datalayer': true,
    'w3c-datalayer': false,
    'commandersact-datalayer': false,
    'relay42-datalayer': false,
    'piwik-datalayer': false,
    'ensighten-datalayer': false
  };

  // Get settings from data attribute (CSP-safe method)
  // The content script injects a hidden element with settings as a data attribute
  function loadSettings() {
    try {
      const settingsEl = document.getElementById('__eventWatcherSettingsData');
      if (settingsEl) {
        const settingsJson = settingsEl.getAttribute('data-settings');
        if (settingsJson) {
          const parsed = JSON.parse(settingsJson);
          // Clean up the element after reading
          settingsEl.remove();
          return parsed;
        }
      }
    } catch (e) {
      // Fall back to defaults on parse error
    }
    return DEFAULT_SETTINGS;
  }

  const settings = loadSettings();

  // Helper to check if a data layer type is enabled
  function isDataLayerEnabled(type) {
    return settings[type] === true;
  }

  // Track push index
  let pushIndex = 0;

  // Page hostname for first-party detection
  const pageHostname = window.location.hostname;

  // Tag manager URL patterns (inlined from shared/detection/tag-manager-patterns.js — keep in sync)
  const TM_PATTERNS = [
    /googletagmanager\.com\/gtm\.js/,
    /googletagmanager\.com\/gtag\/js/,
    /\/utag\.js(\?|$)/,
    /\/utag\.sync\.js(\?|$)/,
    /\/utag\.\d+\.js(\?|$)/,
    /tealiumiq\.com/,
    /tags\.tiqcdn\.com/,
    /assets\.adobedtm\.com/,
    /launch\.adobe\.com/,
    /launch-cdn\.adobe\.com/,
    /\/launch-[A-Za-z0-9]+-\w+\.min\.js$/,
    /ensighten\.com\/tag/,
    /nexus\.ensighten\.com/,
    /tagcommander\.com/,
    /commander1\.com/,
    /\/tc_[^/]+\.js$/,
    /containers\.piwik\.pro/,
    /\/cdn-cgi\/zaraz\//,
    /cdn\.segment\.com/,
  ];

  /**
   * Parse Chrome V8 stack trace to extract frame URLs
   * Format: "    at functionName (url:line:col)" or "    at url:line:col"
   * @param {string} stack - Error.stack string
   * @returns {string[]} Array of URLs from stack frames
   */
  function parseStackUrls(stack) {
    if (!stack) return [];
    const urls = [];
    const lines = stack.split('\n');
    for (let i = 1; i < lines.length; i++) { // Skip "Error" line
      const line = lines[i].trim();
      // Match "at fn (url:line:col)" or "at url:line:col"
      const match = line.match(/at\s+(?:.*?\s+\()?(.+?):\d+:\d+\)?$/);
      if (match) {
        const url = match[1];
        // Skip chrome-extension:// URLs (our own extension), <anonymous>, eval
        if (url && !url.startsWith('chrome-extension://') && !url.startsWith('<') && url.includes('://')) {
          urls.push(url);
        }
      }
    }
    return urls;
  }

  /**
   * Check if a hostname is first-party (same domain or subdomain of the page)
   * @param {string} urlHostname - Hostname from a stack frame URL
   * @returns {boolean}
   */
  function isFirstParty(urlHostname) {
    if (!urlHostname) return false;
    if (urlHostname === pageHostname) return true;
    // Subdomain check: cdn.example.com for page example.com
    return urlHostname.endsWith('.' + pageHostname);
  }

  /**
   * Classify the source of a dataLayer.push() call using stack trace analysis
   * @returns {{ _pushSource: string, _pushSourceUrl: string|null }}
   *   _pushSource: 'website' | 'tag-manager' | 'script' | 'unknown'
   *   _pushSourceUrl: URL of the identified source script, or null
   */
  function getDataLayerPushSource() {
    try {
      const stack = new Error().stack;
      const urls = parseStackUrls(stack);

      if (urls.length === 0) {
        return { _pushSource: 'unknown', _pushSourceUrl: null };
      }

      // Check for tag manager in any frame
      let tmUrl = null;
      for (const url of urls) {
        for (const pattern of TM_PATTERNS) {
          if (pattern.test(url)) {
            tmUrl = url;
            break;
          }
        }
        if (tmUrl) break;
      }

      if (tmUrl) {
        return { _pushSource: 'tag-manager', _pushSourceUrl: tmUrl };
      }

      // No tag manager — use the first meaningful URL (the actual caller)
      const callerUrl = urls[0];
      try {
        const callerHostname = new URL(callerUrl).hostname;
        if (isFirstParty(callerHostname)) {
          return { _pushSource: 'website', _pushSourceUrl: callerUrl };
        }
        // Third-party script
        return { _pushSource: 'script', _pushSourceUrl: callerUrl };
      } catch {
        return { _pushSource: 'unknown', _pushSourceUrl: callerUrl };
      }
    } catch {
      return { _pushSource: 'unknown', _pushSourceUrl: null };
    }
  }

  // Track current URL for navigation detection
  let currentUrl = window.location.href;

  /**
   * Check if a URL should be tracked as a navigation event
   * Filters out internal/iframe/service worker URLs, cookie sharing, consent management, etc.
   */
  function shouldTrackNavigation(url) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.toLowerCase();
      const fullUrl = url.toLowerCase();

      // Skip internal browser/extension URLs
      if (urlObj.protocol === 'chrome-extension:' ||
          urlObj.protocol === 'chrome:' ||
          urlObj.protocol === 'about:' ||
          urlObj.protocol === 'data:' ||
          urlObj.protocol === 'blob:') {
        return false;
      }

      // Skip service worker and iframe URLs
      if (path.includes('service_worker') ||
          path.includes('sw_iframe') ||
          path.includes('/sw.js') ||
          path.includes('/serviceworker') ||
          path.includes('/_next/static') ||
          path.includes('/__') ||
          path.includes('/gtm/') ||
          path.includes('/gtag/') ||
          path.includes('/analytics/') ||
          path.includes('/pixel/') ||
          path.includes('/beacon/') ||
          path.includes('/collect')) {
        return false;
      }

      // Skip cookie sharing iframes and consent management URLs
      if (path.includes('cookiesharingiframe') ||
          path.includes('cookiesharing') ||
          path.includes('cookie-sync') ||
          path.includes('cookiesync') ||
          path.includes('cookie_sync') ||
          path.includes('/cm/') ||           // Common consent management path
          path.includes('/cm.') ||           // Cookie match endpoints
          path.includes('/consent/') ||
          path.includes('/cmp/') ||          // Consent Management Platform
          path.includes('/gdpr/') ||
          path.includes('/privacy-frame') ||
          path.includes('/match/') ||        // Cookie matching
          path.includes('/sync/') ||         // Sync frames
          path.includes('/usersync') ||
          path.includes('/id-sync') ||
          path.includes('/idsync')) {
        return false;
      }

      // Skip common tracking/ad iframe paths
      if (path.includes('/tr/') ||           // Facebook tracking
          path.includes('/tr.') ||
          path.includes('/td/') ||           // TradeDoubler
          path.includes('/pixel/') ||
          path.includes('/1x1') ||           // Tracking pixels
          path.includes('/i/') && path.length < 10 || // Short tracking paths
          path.includes('/t/') && path.length < 10 ||
          path.includes('/p/') && path.length < 10) {
        return false;
      }

      // Skip if URL has iframe-related or tracking query params
      if (urlObj.search.includes('iframe') ||
          urlObj.search.includes('origin=') ||
          urlObj.search.includes('u_scsid=') ||    // Session IDs (cookie sharing)
          urlObj.search.includes('u_sclid=') ||    // Cookie sharing IDs
          urlObj.search.includes('pid=') && urlObj.search.includes('scsid=')) { // Common consent patterns
        return false;
      }

      // Skip known tracking/consent domains entirely
      const trackingDomains = [
        'doubleclick.net',
        'googlesyndication.com',
        'googleadservices.com',
        'facebook.net',
        'fbcdn.net',
        'adsrvr.org',
        'criteo.com',
        'criteo.net',
        'taboola.com',
        'outbrain.com',
        'cookielaw.org',
        'onetrust.com',
        'trustarc.com',
        'quantcast.com',
        'quantserve.com',
        'liveramp.com',
        'rlcdn.com',
        'demdex.net',          // Adobe Audience Manager
        'everesttech.net',
        'adsymptotic.com',
        'rubiconproject.com',
        'pubmatic.com',
        'openx.net',
        'casalemedia.com',
        'contextweb.com',
        'adnxs.com',           // AppNexus
        // Widget/embed domains (third-party widgets loaded in iframes)
        'widget.trustpilot.com',
        'trustpilot.com',
        'recaptcha.net',
        'google.com/recaptcha',
        'gstatic.com',
        'youtube.com/embed',
        'player.vimeo.com',
        'maps.google.com',
        'maps.googleapis.com',
        'intercom.io',
        'intercomcdn.com',
        'zendesk.com',
        'zdassets.com',
        'drift.com',
        'crisp.chat',
        'tawk.to',
        'livechatinc.com',
        'tidio.co',
        'freshdesk.com',
        'hotjar.com',
        'mouseflow.com',
        'clarity.ms',
        'luckyorange.com'
      ];

      const hostname = urlObj.hostname.toLowerCase();
      for (const domain of trackingDomains) {
        if (hostname === domain || hostname.endsWith('.' + domain)) {
          return false;
        }
      }

      // Skip static file extensions
      const staticExtensions = ['.js', '.css', '.png', '.jpg', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.ico', '.json', '.xml'];
      for (const ext of staticExtensions) {
        if (path.endsWith(ext)) {
          return false;
        }
      }

      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Send a page navigation event to the extension
   */
  function sendNavigationEvent(url, isInitial = false) {
    try {
      // Filter out internal/iframe URLs
      if (!shouldTrackNavigation(url)) {
        return;
      }

      const urlObj = new URL(url);
      // Get path without domain - "/" for frontpage
      const path = (urlObj.pathname + urlObj.search + urlObj.hash) || '/';

      window.postMessage({
        type: 'EVENT_DEBUGGER_EVENT',
        payload: {
          _type: 'navigation',
          _url: url,
          _path: path,
          _isInitial: isInitial
        }
      }, '*');
    } catch (e) {
      // Invalid URL, ignore
    }
  }

  /**
   * Check for URL changes (for SPA navigation)
   */
  function checkUrlChange() {
    if (window.location.href !== currentUrl) {
      const newUrl = window.location.href;
      currentUrl = newUrl;
      sendNavigationEvent(newUrl, false);
    }
  }

  // Listen for history changes (pushState, replaceState)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    const result = originalPushState.apply(this, args);
    // Never break the host page's navigation call if our hook throws (F5,
    // same class as the dataLayer.push guard). The real pushState already ran.
    try { checkUrlChange(); } catch (e) { /* never break the host page */ }
    return result;
  };

  history.replaceState = function(...args) {
    const result = originalReplaceState.apply(this, args);
    try { checkUrlChange(); } catch (e) { /* never break the host page */ }
    return result;
  };

  // Listen for popstate (back/forward navigation)
  window.addEventListener('popstate', () => {
    checkUrlChange();
  });

  // Listen for hashchange
  window.addEventListener('hashchange', () => {
    checkUrlChange();
  });

  // Send initial page load navigation event
  sendNavigationEvent(currentUrl, true);

  // Track the computed/merged dataLayer state (like GTM does)
  let computedState = {};

  /**
   * Get GTM's actual internal data model state (if GTM is loaded)
   * Uses the undocumented "split function trick" to dump the entire data model
   * Returns null if GTM is not available
   */
  function getGTMDataModel() {
    try {
      // Find GTM container(s) on the page
      if (!window.google_tag_manager) return null;

      // Try each container to find one with a dataLayer
      for (const key of Object.keys(window.google_tag_manager)) {
        if (key.startsWith('GTM-') || key.startsWith('G-')) {
          const container = window.google_tag_manager[key];
          if (container && container.dataLayer && typeof container.dataLayer.get === 'function') {
            // Use the "split function trick" to get the entire data model
            const dataModel = container.dataLayer.get({
              split: function() { return []; }
            });
            if (dataModel && typeof dataModel === 'object') {
              // Filter out GTM internal properties (gtm.* keys)
              const filtered = {};
              for (const k of Object.keys(dataModel)) {
                if (!k.startsWith('gtm.') && typeof dataModel[k] !== 'function') {
                  filtered[k] = dataModel[k];
                }
              }
              return filtered;
            }
          }
        }
      }
      return null;
    } catch (e) {
      // GTM not available or error accessing it
      return null;
    }
  }

  /**
   * Helper to reliably detect arrays (works across realms/iframes)
   * Uses multiple detection methods to handle cross-realm arrays
   */
  function isArrayLike(obj) {
    if (!obj || typeof obj !== 'object') return false;

    // Standard check
    if (Array.isArray(obj)) return true;

    // Cross-realm check using Object.prototype.toString
    if (Object.prototype.toString.call(obj) === '[object Array]') return true;

    // Duck-typing check for array-like objects from other realms
    // Arrays have a numeric .length property and numeric indices
    if (typeof obj.length === 'number' &&
        obj.length >= 0 &&
        (obj.length === 0 || (obj.length - 1) in obj) &&
        typeof obj.push === 'function' &&
        typeof obj.splice === 'function') {
      return true;
    }

    // Check constructor name (works even for cross-realm)
    if (obj.constructor && obj.constructor.name === 'Array') return true;

    return false;
  }

  /**
   * Deep merge objects (like GTM does with dataLayer)
   * Later values override earlier values for the same key
   */
  function deepMerge(target, source) {
    // Don't merge if source is null, undefined, or not an object
    if (!source || typeof source !== 'object') return target;
    // Don't merge arrays - they should never be passed here
    if (isArrayLike(source)) return target;

    const result = { ...target };

    for (const key of Object.keys(source)) {
      const sourceVal = source[key];
      const targetVal = result[key];

      // Skip internal GTM properties and functions
      if (key.startsWith('gtm.') || typeof sourceVal === 'function') {
        continue;
      }

      // Handle undefined - it means "clear this property"
      if (sourceVal === undefined) {
        delete result[key];
      } else if (
        // If both are plain objects (not arrays), merge recursively
        sourceVal && typeof sourceVal === 'object' && !isArrayLike(sourceVal) &&
        targetVal && typeof targetVal === 'object' && !isArrayLike(targetVal)
      ) {
        result[key] = deepMerge(targetVal, sourceVal);
      } else if (isArrayLike(sourceVal) && isArrayLike(targetVal)) {
        // Both arrays — merge by index like GTM's data model, retaining the
        // trailing elements of the longer existing array (BUG64). A wholesale
        // replace here would hide the "stale array" leak every tag actually
        // reads (e.g. a 3-element push laid over a prior 16-element array).
        result[key] = mergeArrayByIndex(targetVal, sourceVal);
      } else {
        // Otherwise, override with new value
        result[key] = sourceVal;
      }
    }

    return result;
  }

  /**
   * Merge two arrays element-by-index, the way GTM's data model does (BUG64).
   * When the new (source) array is shorter than the existing (target) array, the
   * trailing elements of target are retained — GTM never truncates on a shorter
   * push, so this is the "stale array" state every tag reads. Same-index objects
   * merge recursively via deepMerge; same-index nested arrays recurse here;
   * primitives overwrite; an undefined source element keeps the existing one.
   * Returns a new array and never mutates its inputs.
   */
  function mergeArrayByIndex(target, source) {
    const result = isArrayLike(target) ? Array.prototype.slice.call(target) : [];

    for (let i = 0; i < source.length; i++) {
      const sourceVal = source[i];
      const targetVal = result[i];

      // An undefined element means "no value for this index" — keep what's there
      if (sourceVal === undefined) {
        continue;
      }

      if (
        sourceVal && typeof sourceVal === 'object' && !isArrayLike(sourceVal) &&
        targetVal && typeof targetVal === 'object' && !isArrayLike(targetVal)
      ) {
        result[i] = deepMerge(targetVal, sourceVal);
      } else if (isArrayLike(sourceVal) && isArrayLike(targetVal)) {
        result[i] = mergeArrayByIndex(targetVal, sourceVal);
      } else {
        result[i] = sourceVal;
      }
    }

    return result;
  }

  /**
   * Parse GTM's special array syntax commands
   * GTM supports: ["set", "path", value] or ["config", "GA_MEASUREMENT_ID", {...}]
   * Returns an object representation or null if not a special command
   */
  function parseGTMArrayCommand(arr) {
    if (!isArrayLike(arr) || arr.length < 2) return null;

    const command = arr[0];

    // Handle "set" command: ["set", "path.to.key", value]
    if (command === 'set' && arr.length >= 3) {
      const path = arr[1];
      const value = arr[2];

      // Create nested object from dot-notation path
      if (typeof path === 'string') {
        const parts = path.split('.');
        let obj = {};
        let current = obj;

        for (let i = 0; i < parts.length - 1; i++) {
          current[parts[i]] = {};
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = value;

        return obj;
      }
    }

    // Handle 2-arg "set" object form: ["set", { "developer_id.dNmIyNz": true, "user_properties": {} }]
    // gtag('set', {...}) sets multiple properties at once; keys may themselves be
    // dot-notation paths, so expand each into nested objects (BUG66).
    if (command === 'set' && arr.length === 2 && arr[1] && typeof arr[1] === 'object' && !isArrayLike(arr[1])) {
      const result = {};
      for (const rawKey of Object.keys(arr[1])) {
        const parts = rawKey.split('.');
        let current = result;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]] || typeof current[parts[i]] !== 'object') current[parts[i]] = {};
          current = current[parts[i]];
        }
        current[parts[parts.length - 1]] = arr[1][rawKey];
      }
      return result;
    }

    // Handle "config" command: ["config", "GA_MEASUREMENT_ID", {...}]
    if (command === 'config' && arr.length >= 2) {
      return { _gtmConfig: { id: arr[1], params: arr[2] || {} } };
    }

    // Handle "event" command: ["event", "event_name", {...}]
    if (command === 'event' && arr.length >= 2) {
      return { event: arr[1], ...(arr[2] || {}) };
    }

    // Handle "consent" command: ["consent", "update", {...}]
    if (command === 'consent' && arr.length >= 3) {
      return { _gtmConsent: { action: arr[1], params: arr[2] } };
    }

    return null;
  }

  /**
   * Compute the merged state from all dataLayer items up to a given index
   */
  function computeMergedState(dataLayer, upToIndex) {
    let merged = {};

    for (let i = 0; i <= upToIndex && i < dataLayer.length; i++) {
      const item = dataLayer[i];

      if (isArrayLike(item)) {
        // Try to parse GTM array commands
        const parsed = parseGTMArrayCommand(item);
        if (parsed) {
          merged = deepMerge(merged, parsed);
        }
      } else if (item && typeof item === 'object') {
        // Check if this object looks like it was converted from an array
        const keys = Object.keys(item);
        // GTM mutates a pushed gtag arguments object in place; tolerate both kinds
        // so the mutation doesn't defeat converted-array detection (and leak 0/1/2):
        //   - gtm.* keys, e.g. the gtm.uniqueEventId stamp (BUG65)
        //   - a mirrored `event` key GTM writes onto gtag('event', name, …) args,
        //     accepted only when it equals arr[1] so a real data object that merely
        //     carries an `event` field is not misread as gtag args (BUG66).
        const numericKeys = keys.filter(k => /^\d+$/.test(k));
        const looksLikeConvertedArray = numericKeys.length > 0 &&
          keys.every(k => /^\d+$/.test(k) || k.startsWith('gtm.') || (k === 'event' && item.event === item['1']));

        if (looksLikeConvertedArray) {
          // Convert back to array and try to parse as GTM command (numeric indices only)
          const arr = [];
          const maxIdx = Math.max(...numericKeys.map(k => parseInt(k, 10)));
          for (let j = 0; j <= maxIdx; j++) {
            arr.push(item[j]);
          }
          const parsed = parseGTMArrayCommand(arr);
          if (parsed) {
            merged = deepMerge(merged, parsed);
          }
        } else {
          // Regular object - merge all properties including 'event' (to match GTM's behavior)
          merged = deepMerge(merged, item);
        }
      }
    }

    return merged;
  }

  /**
   * Detect the type of a non-serializable value for better error messages
   */
  function getUnserializableType(value) {
    if (typeof value === 'function') {
      return 'function';
    }
    if (typeof value === 'symbol') {
      return 'Symbol';
    }
    if (typeof value === 'bigint') {
      return 'BigInt';
    }
    if (value instanceof HTMLElement) {
      return `HTMLElement<${value.tagName.toLowerCase()}>`;
    }
    if (value instanceof Node) {
      return `Node<${value.nodeName}>`;
    }
    if (value instanceof Window) {
      return 'Window';
    }
    if (value instanceof Document) {
      return 'Document';
    }
    if (value instanceof Event) {
      return `Event<${value.type || 'unknown'}>`;
    }
    if (value instanceof Error) {
      return `Error<${value.name}>`;
    }
    if (value instanceof RegExp) {
      // RegExp can be serialized but loses its type - show it as string
      return null; // Will be converted to string
    }
    return 'unserializable';
  }

  /**
   * Safely clone an object, preserving what can be serialized
   * and marking non-serializable values with descriptive errors
   */
  function safeClone(obj, seen = new WeakSet(), path = 'root') {
    // Handle null and undefined - these are normal JSON values
    // undefined will be omitted from objects or become null in arrays (standard JSON behavior)
    if (obj === null || obj === undefined) return obj;

    const type = typeof obj;

    // Handle primitive types that serialize fine
    if (type === 'string' || type === 'number' || type === 'boolean') {
      return obj;
    }

    // Handle non-serializable primitives
    if (type === 'function') {
      const funcName = obj.name || 'anonymous';
      return { _unserializable: 'function', _name: funcName, _path: path };
    }
    if (type === 'symbol') {
      return { _unserializable: 'Symbol', _description: obj.description || '', _path: path };
    }
    if (type === 'bigint') {
      return { _unserializable: 'BigInt', _value: obj.toString(), _path: path };
    }

    // Handle objects
    if (type === 'object') {
      // Check for circular references
      if (seen.has(obj)) {
        return { _unserializable: 'circular reference', _path: path };
      }

      // Handle special object types
      if (obj instanceof HTMLElement) {
        return {
          _unserializable: 'HTMLElement',
          _tagName: obj.tagName.toLowerCase(),
          _id: obj.id || undefined,
          _className: obj.className || undefined,
          _path: path
        };
      }
      if (obj instanceof Node) {
        return { _unserializable: 'Node', _nodeName: obj.nodeName, _path: path };
      }
      if (obj instanceof Window) {
        return { _unserializable: 'Window', _path: path };
      }
      if (obj instanceof Document) {
        return { _unserializable: 'Document', _path: path };
      }
      if (obj instanceof Event) {
        return { _unserializable: 'Event', _eventType: obj.type || 'unknown', _path: path };
      }
      if (obj instanceof Error) {
        return {
          _unserializable: 'Error',
          _errorName: obj.name,
          _message: obj.message,
          _path: path
        };
      }
      if (obj instanceof Date) {
        return obj.toISOString();
      }
      if (obj instanceof RegExp) {
        return obj.toString();
      }

      // Add to seen set for circular reference detection
      seen.add(obj);

      // Handle arrays - IMPORTANT: must return an array, not convert to object
      if (isArrayLike(obj)) {
        const clonedArray = [];
        for (let i = 0; i < obj.length; i++) {
          clonedArray.push(safeClone(obj[i], seen, `${path}[${i}]`));
        }
        return clonedArray;
      }

      // Handle plain objects
      const result = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          try {
            result[key] = safeClone(obj[key], seen, `${path}.${key}`);
          } catch (e) {
            result[key] = { _unserializable: 'error during clone', _error: e.message, _path: `${path}.${key}` };
          }
        }
      }
      return result;
    }

    // Fallback for any other type
    return { _unserializable: type, _path: path };
  }

  /**
   * Send data to content script
   */
  function sendToExtension(pushData, computedDataLayerState, dataLayerLength, isHistorical = false, pushSource = null) {
    // CRITICAL: Capture timestamp immediately at the moment of dataLayer.push()
    // This ensures correct chronological ordering in the panel
    const capturedTimestamp = Date.now();

    try {
      pushIndex++;

      // Capture BOTH state models for every push so the export can validate EW's
      // own reconstruction against GTM's ground-truth data model. GTM's model is
      // the most accurate when available; the computed reconstruction is what EW
      // falls back to before GTM has loaded. Emitting both lets the "Copy Full
      // DataLayer" export show exactly where (and whether) the two diverge.
      const gtmDataModel = getGTMDataModel();

      // GTM's data model lags one push behind at read time — it reflects state
      // BEFORE the current push is processed. Merge the current push into a base
      // state so each model reflects what it will be AFTER this push. deepMerge
      // returns a new object, so the source bases are never mutated.
      const mergeCurrentPush = (base) => {
        let s = (base && typeof base === 'object' && !isArrayLike(base)) ? base : {};
        if (pushData && typeof pushData === 'object' && !isArrayLike(pushData)) {
          s = deepMerge(s, pushData);
        } else if (isArrayLike(pushData)) {
          // Handle array commands like ["set", "path", value] or ["consent", "update", {...}]
          const parsed = parseGTMArrayCommand(pushData);
          if (parsed && typeof parsed === 'object') {
            s = deepMerge(s, parsed);
          }
        }
        return s;
      };

      // EW's own reconstruction — always available, even before GTM loads.
      const computedAfter = mergeCurrentPush(computedDataLayerState);
      // GTM's actual data model post-push — null until the container is live.
      const gtmAfter = (gtmDataModel && typeof gtmDataModel === 'object' && !isArrayLike(gtmDataModel))
        ? mergeCurrentPush(gtmDataModel)
        : null;
      // Primary state the panel shows: prefer ground truth, fall back to computed.
      const actualState = gtmAfter || computedAfter;

      const payload = {
        _pushIndex: pushIndex,
        _timestamp: capturedTimestamp, // Timestamp captured at push time
        _pushData: safeClone(pushData),
        _dataLayerState: safeClone(actualState), // Primary: GTM's actual state or our computed state
        _computedState: safeClone(computedAfter), // EW's always-on reconstruction (for validation)
        _gtmModel: gtmAfter ? safeClone(gtmAfter) : null, // GTM ground truth, null pre-load (for validation)
        _dataLayerLength: dataLayerLength,
        _isHistorical: isHistorical,
        _stateSource: gtmAfter ? 'gtm' : 'computed', // Track where the primary state came from
        _pushSource: pushSource ? pushSource._pushSource : null,
        _pushSourceUrl: pushSource ? pushSource._pushSourceUrl : null,
        event: pushData.event || null
      };

      window.postMessage({
        type: 'EVENT_DEBUGGER_EVENT',
        payload: payload
      }, '*');
    } catch (e) {
      pushIndex++;
      window.postMessage({
        type: 'EVENT_DEBUGGER_EVENT',
        payload: {
          _pushIndex: pushIndex,
          _timestamp: capturedTimestamp, // Timestamp captured at push time
          _pushData: { event: pushData?.event || 'dataLayer.push', _serializationError: true },
          _dataLayerState: computedDataLayerState,
          _dataLayerLength: dataLayerLength,
          _isHistorical: isHistorical,
          event: pushData?.event || 'dataLayer.push',
          _serializationError: true
        }
      }, '*');
    }
  }

  /**
   * Hook into dataLayer
   */
  function hookDataLayer() {
    if (!window.dataLayer) {
      window.dataLayer = [];
    }

    if (window.dataLayer.__eventDebuggerHooked) return;

    // Compute initial state from existing items
    if (window.dataLayer.length > 0) {
      computedState = computeMergedState(window.dataLayer, window.dataLayer.length - 1);
    }

    const originalPush = Array.prototype.push;

    window.dataLayer.push = function(...args) {
      // Call original push first
      const result = originalPush.apply(this, args);

      // Everything below is interception bookkeeping — it must NEVER throw into
      // the host page's push() caller. The real push already ran above, so its
      // return value is safe; a throw from getDataLayerPushSource(), deepMerge()
      // on a pathological/circular object, or sendToExtension() on a non-cloneable
      // payload would otherwise propagate into the website's own dataLayer.push()
      // call site and break the page's analytics stack.
      try {
        // Capture push source once per push() call (not per arg)
        const pushSource = getDataLayerPushSource();

        // Process each pushed item
        args.forEach(arg => {
          // Check if it's an array (GTM command syntax)
          if (isArrayLike(arg)) {
            // Handle GTM array commands like ["set", "path", value]
            const parsed = parseGTMArrayCommand(arg);
            if (parsed && typeof parsed === 'object' && !isArrayLike(parsed)) {
              computedState = deepMerge(computedState, parsed);
            }
            // Send to extension with the MERGED computed state (always an object, never array)
            sendToExtension(arg, computedState, this.length, false, pushSource);
          } else if (arg && typeof arg === 'object') {
            // Check if this object looks like it was converted from an array
            // (has only numeric string keys like "0", "1", "2")
            const keys = Object.keys(arg);
            // GTM mutates a pushed gtag arguments object in place; tolerate both kinds
            // so the mutation doesn't defeat converted-array detection (and leak 0/1/2):
            //   - gtm.* keys, e.g. the gtm.uniqueEventId stamp (BUG65)
            //   - a mirrored `event` key GTM writes onto gtag('event', name, …) args,
            //     accepted only when it equals arr[1] so a real data object that merely
            //     carries an `event` field is not misread as gtag args (BUG66).
            const numericKeys = keys.filter(k => /^\d+$/.test(k));
            const looksLikeConvertedArray = numericKeys.length > 0 &&
              keys.every(k => /^\d+$/.test(k) || k.startsWith('gtm.') || (k === 'event' && arg.event === arg['1']));

            if (looksLikeConvertedArray) {
              // Convert back to array and try to parse as GTM command (numeric indices only)
              const arr = [];
              const maxIdx = Math.max(...numericKeys.map(k => parseInt(k, 10)));
              for (let i = 0; i <= maxIdx; i++) {
                arr.push(arg[i]);
              }
              const parsed = parseGTMArrayCommand(arr);
              if (parsed && typeof parsed === 'object' && !isArrayLike(parsed)) {
                computedState = deepMerge(computedState, parsed);
              }
              // Send the reconstructed array to extension
              sendToExtension(arr, computedState, this.length, false, pushSource);
            } else {
              // Update the computed merged state (include event to match GTM's behavior)
              computedState = deepMerge(computedState, arg);
              // Send to extension with the MERGED computed state
              sendToExtension(arg, computedState, this.length, false, pushSource);
            }
          }
        });
      } catch (e) { /* never break the host page */ }

      // Re-probe CMP window API after consent-related pushes.
      // The interval-based probe stops after 60s, so mid-session consent changes
      // (e.g., user re-opens banner at 90s) would otherwise leave stale state.
      // Debounced: CMPs fire multiple events rapidly (e.g., 5 cookie_cat_* within 13ms),
      // and the CMP API may return transitional states during the save window.
      // A single debounced probe 500ms after the last event lets the CMP settle.
      try {
        for (const arg of args) {
          const eventName = isArrayLike(arg) ? (arg[0] === 'consent' ? 'consent' : '')
            : (arg && typeof arg === 'object' ? (arg.event || '') : '');
          if (eventName === 'consent' ||
              (typeof eventName === 'string' && (
                eventName.startsWith('cookie_cat_') ||
                eventName.startsWith('cookie_consent_') ||
                eventName === 'CookiebotOnAccept' ||
                eventName === 'CookiebotOnDecline'))) {
            clearTimeout(cmpRetriggerTimeout);
            cmpRetriggerTimeout = setTimeout(() => { try { probeCMPConsentState(); } catch (e) { /* ignore */ } }, 500);
            break;
          }
        }
      } catch (e) { /* never break the host page */ }

      return result;
    };

    window.dataLayer.__eventDebuggerHooked = true;

    // Process existing items (historical) - compute cumulative merged state for each
    // Historical items were pushed before our hook — no stack trace available
    const historicalSource = { _pushSource: 'historical', _pushSourceUrl: null };
    if (window.dataLayer.length > 0) {
      let historicalMerged = {};

      for (let i = 0; i < window.dataLayer.length; i++) {
        const item = window.dataLayer[i];

        if (isArrayLike(item)) {
          // Handle GTM array commands like ["set", "path", value]
          const parsed = parseGTMArrayCommand(item);
          if (parsed && typeof parsed === 'object' && !isArrayLike(parsed)) {
            historicalMerged = deepMerge(historicalMerged, parsed);
          }
          // Send with the computed state up to this point (always an object, never array)
          sendToExtension(item, historicalMerged, i + 1, true, historicalSource);
        } else if (item && typeof item === 'object') {
          // Check if this object looks like it was converted from an array
          const keys = Object.keys(item);
          // GTM mutates a pushed gtag arguments object in place; tolerate both kinds
          // so the mutation doesn't defeat converted-array detection (and leak 0/1/2):
          //   - gtm.* keys, e.g. the gtm.uniqueEventId stamp (BUG65)
          //   - a mirrored `event` key GTM writes onto gtag('event', name, …) args,
          //     accepted only when it equals arr[1] so a real data object that merely
          //     carries an `event` field is not misread as gtag args (BUG66).
          const numericKeys = keys.filter(k => /^\d+$/.test(k));
          const looksLikeConvertedArray = numericKeys.length > 0 &&
            keys.every(k => /^\d+$/.test(k) || k.startsWith('gtm.') || (k === 'event' && item.event === item['1']));

          if (looksLikeConvertedArray) {
            // Convert back to array and try to parse as GTM command (numeric indices only)
            const arr = [];
            const maxIdx = Math.max(...numericKeys.map(k => parseInt(k, 10)));
            for (let j = 0; j <= maxIdx; j++) {
              arr.push(item[j]);
            }
            const parsed = parseGTMArrayCommand(arr);
            if (parsed && typeof parsed === 'object' && !isArrayLike(parsed)) {
              historicalMerged = deepMerge(historicalMerged, parsed);
            }
            sendToExtension(arr, historicalMerged, i + 1, true, historicalSource);
          } else {
            // Merge this item into the historical state (include event to match GTM's behavior)
            historicalMerged = deepMerge(historicalMerged, item);
            // Send with the computed state up to this point
            sendToExtension(item, historicalMerged, i + 1, true, historicalSource);
          }
        }
      }
    }
  }

  // Initial hook (only if Google dataLayer is enabled)
  if (isDataLayerEnabled('datalayer')) {
    hookDataLayer();
  }

  // ========================================
  // Tealium utag Support (only if enabled)
  // ========================================

  // Track Tealium event index
  let tealiumEventIndex = 0;

  /**
   * Send Tealium event to extension
   */
  function sendTealiumEvent(eventType, data, isHistorical = false) {
    try {
      tealiumEventIndex++;
      const payload = {
        _tealiumEventIndex: tealiumEventIndex,
        _eventType: eventType, // 'view', 'link', or 'utag_data'
        _eventData: safeClone(data),
        _utag_data: window.utag_data ? safeClone(window.utag_data) : null,
        _isHistorical: isHistorical,
        tealium_event: data.tealium_event || eventType
      };

      // utag_data is the Tealium Universal Data Object — by definition it
      // is defined by the site's own <script> tag in the <head> before
      // utag.sync.js loads. Tag it page-source so Stack View attributes it
      // to the page rather than leaving it as `unknown`.
      if (eventType === 'utag_data') {
        payload._pushSource = 'website';
      }

      window.postMessage({
        type: 'TEALIUM_EVENT',
        payload: payload
      }, '*');
    } catch (e) {
      tealiumEventIndex++;
      window.postMessage({
        type: 'TEALIUM_EVENT',
        payload: {
          _tealiumEventIndex: tealiumEventIndex,
          _eventType: eventType,
          _eventData: { _serializationError: true },
          _isHistorical: isHistorical,
          tealium_event: eventType
        }
      }, '*');
    }
  }

  /**
   * Detect and report utag_data object (initial page data layer)
   */
  function detectUtagData() {
    if (!window.utag_data || typeof window.utag_data !== 'object') return;
    if (window.utag_data.__eventDebuggerReported) return;

    // Send snapshot of utag_data
    sendTealiumEvent('utag_data', window.utag_data, false);
    window.utag_data.__eventDebuggerReported = true;
  }

  // Tealium support (only if enabled)
  if (isDataLayerEnabled('tealium-datalayer')) {
    // Try to detect utag_data immediately
    detectUtagData();

    // Watch for utag_data to be defined (it's usually set before utag loads)
    let utagDataDescriptor = Object.getOwnPropertyDescriptor(window, 'utag_data');
    if (!utagDataDescriptor || utagDataDescriptor.configurable) {
      let _utag_data = window.utag_data;

      Object.defineProperty(window, 'utag_data', {
        get: function() {
          return _utag_data;
        },
        set: function(value) {
          _utag_data = value;
          if (_utag_data && typeof _utag_data === 'object') {
            setTimeout(detectUtagData, 0);
          }
        },
        configurable: true
      });
    }

    /**
     * Hook into Tealium utag object
     */
    function hookTealium() {
      if (!window.utag) return;
      if (window.utag.__eventDebuggerHooked) return;

      // Hook utag.view()
      if (typeof window.utag.view === 'function') {
        const originalView = window.utag.view;
        window.utag.view = function(data, callback, cfg) {
          // Send to extension
          sendTealiumEvent('view', data || {}, false);
          // Call original
          return originalView.call(this, data, callback, cfg);
        };
      }

      // Hook utag.link()
      if (typeof window.utag.link === 'function') {
        const originalLink = window.utag.link;
        window.utag.link = function(data, callback, cfg) {
          // Send to extension
          sendTealiumEvent('link', data || {}, false);
          // Call original
          return originalLink.call(this, data, callback, cfg);
        };
      }

      // Note: We intentionally do NOT hook utag.track() because:
      // 1. It's called internally by utag.view() and utag.link(), causing duplicates
      // 2. The user-facing API is utag.view() and utag.link()
      // 3. utag.track() is a lower-level internal function

      window.utag.__eventDebuggerHooked = true;
    }

    // Try to hook Tealium immediately
    hookTealium();

    // Watch for utag to be defined (it may load async)
    let utagDescriptor = Object.getOwnPropertyDescriptor(window, 'utag');
    if (!utagDescriptor || utagDescriptor.configurable) {
      let _utag = window.utag;

      Object.defineProperty(window, 'utag', {
        get: function() {
          return _utag;
        },
        set: function(value) {
          _utag = value;
          // Hook when utag is set
          if (_utag && typeof _utag === 'object') {
            setTimeout(hookTealium, 0);
          }
        },
        configurable: true
      });
    }
  }

  // Re-hook dataLayer if overwritten (only if Google dataLayer is enabled)
  if (isDataLayerEnabled('datalayer')) {
    let dataLayerDescriptor = Object.getOwnPropertyDescriptor(window, 'dataLayer');
    if (!dataLayerDescriptor || dataLayerDescriptor.configurable) {
      let _dataLayer = window.dataLayer;

      Object.defineProperty(window, 'dataLayer', {
        get: function() {
          return _dataLayer;
        },
        set: function(value) {
          _dataLayer = value;
          // Re-compute state from the new array instead of clearing
          if (Array.isArray(_dataLayer) && _dataLayer.length > 0) {
            computedState = computeMergedState(_dataLayer, _dataLayer.length - 1);
          } else {
            computedState = {};
          }
          if (Array.isArray(_dataLayer)) {
            setTimeout(hookDataLayer, 0);
          }
        },
        configurable: true
      });
    }
  }

  // ========================================
  // Adobe Launch / Adobe Client Data Layer (ACDL) Support (only if enabled)
  // ========================================

  if (isDataLayerEnabled('adobe-datalayer')) {
    // Track Adobe Launch event index
    let adobeLaunchEventIndex = 0;

    /**
     * Send Adobe Launch event to extension
     */
    function sendAdobeLaunchEvent(eventType, data, source, isHistorical = false) {
      try {
        adobeLaunchEventIndex++;
        const payload = {
          _adobeLaunchEventIndex: adobeLaunchEventIndex,
          _eventType: eventType, // 'push', 'track', or 'getState'
          _source: source, // 'adobeDataLayer' or '_satellite'
          _eventData: safeClone(data),
          _adobeDataLayerState: window.adobeDataLayer ? getAdobeDataLayerState() : null,
          _isHistorical: isHistorical,
          event: data?.event || eventType
        };

        window.postMessage({
          type: 'ADOBE_LAUNCH_EVENT',
          payload: payload
        }, '*');
      } catch (e) {
        adobeLaunchEventIndex++;
        window.postMessage({
          type: 'ADOBE_LAUNCH_EVENT',
          payload: {
            _adobeLaunchEventIndex: adobeLaunchEventIndex,
            _eventType: eventType,
            _source: source,
            _eventData: { _serializationError: true },
            _isHistorical: isHistorical,
            event: eventType
          }
        }, '*');
      }
    }

    /**
     * Get computed state from Adobe Data Layer
     * ACDL has a getState() method that returns merged state
     */
    function getAdobeDataLayerState() {
      try {
        if (window.adobeDataLayer && typeof window.adobeDataLayer.getState === 'function') {
          return safeClone(window.adobeDataLayer.getState());
        }
        // If getState not available, try to merge array items manually
        if (Array.isArray(window.adobeDataLayer)) {
          const state = {};
          window.adobeDataLayer.forEach(item => {
            if (item && typeof item === 'object' && !item.event) {
              Object.assign(state, item);
            }
          });
          return state;
        }
        return null;
      } catch (e) {
        return null;
      }
    }

    /**
     * Hook into Adobe Client Data Layer (adobeDataLayer)
     */
    function hookAdobeDataLayer() {
      if (!window.adobeDataLayer) return;
      if (window.adobeDataLayer.__eventDebuggerHooked) return;

      // Hook push method
      if (typeof window.adobeDataLayer.push === 'function') {
        const originalPush = window.adobeDataLayer.push;
        window.adobeDataLayer.push = function(...args) {
          // Send each pushed item to extension
          args.forEach(item => {
            if (item && typeof item === 'object') {
              sendAdobeLaunchEvent(item.event || 'push', item, 'adobeDataLayer', false);
            }
          });
          // Call original
          return originalPush.apply(this, args);
        };
      }

      // Process existing items in the data layer
      if (Array.isArray(window.adobeDataLayer)) {
        window.adobeDataLayer.forEach((item, index) => {
          if (item && typeof item === 'object') {
            sendAdobeLaunchEvent(item.event || 'initial', item, 'adobeDataLayer', true);
          }
        });
      }

      window.adobeDataLayer.__eventDebuggerHooked = true;
    }

    /**
     * Hook into _satellite.track() (Adobe Launch Direct Call Rules)
     */
    function hookSatelliteTrack() {
      if (!window._satellite) return;
      if (window._satellite.__eventDebuggerHooked) return;

      // Hook _satellite.track method
      if (typeof window._satellite.track === 'function') {
        const originalTrack = window._satellite.track;
        window._satellite.track = function(identifier, detail) {
          // Send to extension
          sendAdobeLaunchEvent(identifier, { identifier, detail }, '_satellite', false);
          // Call original
          return originalTrack.call(this, identifier, detail);
        };
      }

      window._satellite.__eventDebuggerHooked = true;
    }

    // Try to hook Adobe Launch immediately
    hookAdobeDataLayer();
    hookSatelliteTrack();

    // Watch for adobeDataLayer to be defined (it may load async)
    let adobeDataLayerDescriptor = Object.getOwnPropertyDescriptor(window, 'adobeDataLayer');
    if (!adobeDataLayerDescriptor || adobeDataLayerDescriptor.configurable) {
      let _adobeDataLayer = window.adobeDataLayer;

      Object.defineProperty(window, 'adobeDataLayer', {
        get: function() {
          return _adobeDataLayer;
        },
        set: function(value) {
          _adobeDataLayer = value;
          // Hook when adobeDataLayer is set
          if (_adobeDataLayer) {
            setTimeout(hookAdobeDataLayer, 0);
          }
        },
        configurable: true
      });
    }

    // Watch for _satellite to be defined
    let satelliteDescriptor = Object.getOwnPropertyDescriptor(window, '_satellite');
    if (!satelliteDescriptor || satelliteDescriptor.configurable) {
      let _satelliteObj = window._satellite;

      Object.defineProperty(window, '_satellite', {
        get: function() {
          return _satelliteObj;
        },
        set: function(value) {
          _satelliteObj = value;
          // Hook when _satellite is set
          if (_satelliteObj && typeof _satelliteObj === 'object') {
            setTimeout(hookSatelliteTrack, 0);
          }
        },
        configurable: true
      });
    }
  }

  // ========================================
  // Additional Data Layers (can be enabled via Settings)
  // ========================================
  // The following data layers can be enabled in Settings > Data Layer Detection:
  // - W3C digitalData (window.digitalData) - setting: 'w3c-datalayer'
  // - Commanders Act tc_vars (window.tc_vars) - setting: 'commandersact-datalayer'
  // - Relay42 defined42 (window.defined42) - setting: 'relay42-datalayer'
  // - Piwik PRO Data Layer - setting: 'piwik-datalayer'
  // - Ensighten (window.Bootstrapper.dataLayer) - setting: 'ensighten-datalayer'
  //
  // These are disabled by default because:
  // 1. Each watcher uses Object.defineProperty which has performance overhead
  // 2. Most sites only use 1-2 data layer implementations
  // 3. Users can enable specific ones they need in Settings

  // ========================================
  // W3C digitalData Support (if enabled)
  // ========================================
  if (isDataLayerEnabled('w3c-datalayer')) {
    let w3cEventIndex = 0;

    function sendW3CEvent(data, isHistorical = false) {
      try {
        w3cEventIndex++;
        window.postMessage({
          type: 'W3C_DIGITALDATA_EVENT',
          payload: {
            _w3cEventIndex: w3cEventIndex,
            _eventData: safeClone(data),
            _isHistorical: isHistorical,
            event: 'digitalData'
          }
        }, '*');
      } catch (e) {
        // Ignore serialization errors
      }
    }

    // Watch for digitalData changes
    let digitalDataDescriptor = Object.getOwnPropertyDescriptor(window, 'digitalData');
    if (!digitalDataDescriptor || digitalDataDescriptor.configurable) {
      let _digitalData = window.digitalData;

      // Report initial value if exists
      if (_digitalData && typeof _digitalData === 'object') {
        sendW3CEvent(_digitalData, true);
      }

      Object.defineProperty(window, 'digitalData', {
        get: function() {
          return _digitalData;
        },
        set: function(value) {
          _digitalData = value;
          if (_digitalData && typeof _digitalData === 'object') {
            sendW3CEvent(_digitalData, false);
          }
        },
        configurable: true
      });
    }
  }

  // ========================================
  // Commanders Act tc_vars Support (if enabled)
  // ========================================
  if (isDataLayerEnabled('commandersact-datalayer')) {
    let tcVarsEventIndex = 0;

    function sendCommandersActEvent(data, isHistorical = false) {
      try {
        tcVarsEventIndex++;
        window.postMessage({
          type: 'COMMANDERSACT_EVENT',
          payload: {
            _tcVarsEventIndex: tcVarsEventIndex,
            _eventData: safeClone(data),
            _isHistorical: isHistorical,
            event: 'tc_vars'
          }
        }, '*');
      } catch (e) {
        // Ignore serialization errors
      }
    }

    // Watch for tc_vars changes
    let tcVarsDescriptor = Object.getOwnPropertyDescriptor(window, 'tc_vars');
    if (!tcVarsDescriptor || tcVarsDescriptor.configurable) {
      let _tc_vars = window.tc_vars;

      // Report initial value if exists
      if (_tc_vars && typeof _tc_vars === 'object') {
        sendCommandersActEvent(_tc_vars, true);
      }

      Object.defineProperty(window, 'tc_vars', {
        get: function() {
          return _tc_vars;
        },
        set: function(value) {
          _tc_vars = value;
          if (_tc_vars && typeof _tc_vars === 'object') {
            sendCommandersActEvent(_tc_vars, false);
          }
        },
        configurable: true
      });
    }
  }

  // ========================================
  // Relay42 defined42 Support (if enabled)
  // ========================================
  if (isDataLayerEnabled('relay42-datalayer')) {
    let relay42EventIndex = 0;

    function sendRelay42Event(data, isHistorical = false) {
      try {
        relay42EventIndex++;
        window.postMessage({
          type: 'RELAY42_EVENT',
          payload: {
            _relay42EventIndex: relay42EventIndex,
            _eventData: safeClone(data),
            _isHistorical: isHistorical,
            event: 'defined42'
          }
        }, '*');
      } catch (e) {
        // Ignore serialization errors
      }
    }

    // Watch for defined42
    let defined42Descriptor = Object.getOwnPropertyDescriptor(window, 'defined42');
    if (!defined42Descriptor || defined42Descriptor.configurable) {
      let _defined42 = window.defined42;

      // Hook push if it's an array
      function hookDefined42Push() {
        if (!Array.isArray(_defined42)) return;
        if (_defined42.__eventDebuggerHooked) return;

        const originalPush = Array.prototype.push;
        _defined42.push = function(...args) {
          const result = originalPush.apply(this, args);
          args.forEach(arg => {
            if (arg && typeof arg === 'object') {
              sendRelay42Event(arg, false);
            }
          });
          return result;
        };
        _defined42.__eventDebuggerHooked = true;

        // Report existing items
        _defined42.forEach(item => {
          if (item && typeof item === 'object') {
            sendRelay42Event(item, true);
          }
        });
      }

      if (_defined42) {
        hookDefined42Push();
      }

      Object.defineProperty(window, 'defined42', {
        get: function() {
          return _defined42;
        },
        set: function(value) {
          _defined42 = value;
          if (_defined42) {
            setTimeout(hookDefined42Push, 0);
          }
        },
        configurable: true
      });
    }
  }

  // ========================================
  // Ensighten Data Layer Support (if enabled)
  // ========================================
  if (isDataLayerEnabled('ensighten-datalayer')) {
    let ensightenEventIndex = 0;

    function sendEnsightenEvent(data, source, isHistorical = false) {
      try {
        ensightenEventIndex++;
        window.postMessage({
          type: 'ENSIGHTEN_EVENT',
          payload: {
            _ensightenEventIndex: ensightenEventIndex,
            _source: source,
            _eventData: safeClone(data),
            _isHistorical: isHistorical,
            event: 'ensighten'
          }
        }, '*');
      } catch (e) {
        // Ignore serialization errors
      }
    }

    // Watch for Bootstrapper.dataLayer
    function hookEnsighten() {
      if (window.Bootstrapper && window.Bootstrapper.dataLayer) {
        if (window.Bootstrapper.dataLayer.__eventDebuggerHooked) return;

        // Report current state
        sendEnsightenEvent(window.Bootstrapper.dataLayer, 'Bootstrapper.dataLayer', true);

        // Note: Ensighten uses various patterns, this is a basic implementation
        window.Bootstrapper.dataLayer.__eventDebuggerHooked = true;
      }
    }

    // Try immediately
    hookEnsighten();

    // Watch for Bootstrapper
    let bootstrapperDescriptor = Object.getOwnPropertyDescriptor(window, 'Bootstrapper');
    if (!bootstrapperDescriptor || bootstrapperDescriptor.configurable) {
      let _Bootstrapper = window.Bootstrapper;

      Object.defineProperty(window, 'Bootstrapper', {
        get: function() {
          return _Bootstrapper;
        },
        set: function(value) {
          _Bootstrapper = value;
          if (_Bootstrapper) {
            setTimeout(hookEnsighten, 0);
          }
        },
        configurable: true
      });
    }
  }

  // Note (BUG56): walkerOS detection is handled in the service worker by recognising
  // the walkerOS event envelope inside ordinary dataLayer pushes (its dataLayer
  // destination writes the canonical event object to window.dataLayer). No dedicated
  // page-script hook is needed: real deployments emit via the dataLayer destination,
  // not direct window.elb() calls (verified live on mitgas.de + casamoda.com).
  // See detectWalkerOSEnvelope() in service-worker.js.

  // Listen for push commands from the extension (reverse channel)
  // Panel → Service Worker → Content Script → postMessage → here → dataLayer.push()
  window.addEventListener('message', (msgEvent) => {
    if (msgEvent.source !== window) return;
    if (msgEvent.data?.type !== 'EVENT_WATCHER_PUSH_DATALAYER') return;

    try {
      const payload = msgEvent.data.payload;
      if (!window.dataLayer) {
        window.dataLayer = window.dataLayer || [];
      }
      // Add internal marker so the hook can detect this was pushed by Event Watcher
      // The marker flows through the capture pipeline and is stripped by cleanPushData()
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        payload._eventWatcherPush = true;
      }
      window.dataLayer.push(payload);
    } catch (e) {
      // Never break the host page
    }
  });

  // Feature #81 Phase 1 — AI export bridge for MCP-driven regression testing.
  // Writes the panel's latest "Copy for AI" payload to a page-scoped global so
  // an MCP-driven Claude session can read it via evaluate_script and diff it
  // against the network/console truth the MCP itself sees. Service worker has
  // already enforced installType === 'development'; this listener is dead code
  // on CWS installs (the message never arrives).
  window.addEventListener('message', (msgEvent) => {
    if (msgEvent.source !== window) return;
    if (msgEvent.data?.source !== 'event-watcher') return;
    if (msgEvent.data?.type !== 'COPY_FOR_AI_EXPORT') return;

    try {
      window.__eventWatcher = window.__eventWatcher || {};
      window.__eventWatcher.lastAIExport = {
        ts: msgEvent.data.ts || Date.now(),
        url: location.href,
        scopeType: msgEvent.data.scopeType || null,
        exportId: msgEvent.data.exportId || null,
        payload: msgEvent.data.payload,
      };
      // Sentinel for list_console_messages — signals a fresh export is ready
      // to read via evaluate_script(`window.__eventWatcher.lastAIExport`).
      const id = msgEvent.data.exportId || msgEvent.data.ts || '';
      console.log('[ew-export] ' + id);
    } catch (e) {
      // Never break the host page
    }
  });

  // ========================================
  // CMP Consent State Reading (window.* APIs)
  // ========================================
  // Probes known CMP window objects to read per-category consent state.
  // Sends results upstream via postMessage so the panel can build the consent timeline.
  // All probing is wrapped in try/catch — must never break the host page.

  // Helper: keyword-match a string to a unified consent category
  // Used for CMPs with site-configurable category/purpose names
  function matchConsentCategory(name) {
    const lower = name.toLowerCase();
    // Order matters: check specific terms before generic ones
    if (lower.includes('marketing') || lower.includes('advertis') || lower.includes('targeting') || lower.includes('ad_storage') || lower.includes('ad_personalization')) return 'marketing';
    if (lower.includes('analytics') || lower.includes('statistic') || lower.includes('measure') || lower.includes('performance')) return 'analytics';
    if (lower.includes('personaliz') || lower.includes('preference') || lower.includes('function') || lower === 'necessary') return 'functional';
    return null;
  }

  // Registry of CMP window API readers
  // Each reader: { id, cmp, detect(), read(), hasInteracted?() }
  // detect() → true if CMP window object is present
  // read() → { analytics, marketing, functional } with 'granted'/'denied', or null
  // hasInteracted() → true if user has made a consent choice (optional)
  const CMP_READERS = [

    // --- Fixed-category sync readers ---

    {
      id: 'cookiebot', cmp: 'Cookiebot',
      detect: () => window.Cookiebot?.consent != null,
      read: () => ({
        analytics: window.Cookiebot.consent.statistics ? 'granted' : 'denied',
        marketing: window.Cookiebot.consent.marketing ? 'granted' : 'denied',
        functional: window.Cookiebot.consent.preferences ? 'granted' : 'denied',
      }),
      hasInteracted: () => window.Cookiebot.hasResponse === true,
    },

    {
      id: 'onetrust', cmp: 'OneTrust',
      detect: () => typeof window.OnetrustActiveGroups === 'string' && window.OnetrustActiveGroups.length > 2,
      read: () => {
        const g = window.OnetrustActiveGroups;
        // Only parse standard C-series group IDs — return null for custom IDs (e.g. CNN's dsh/dsl/req)
        if (!g.includes('C000')) return null;
        // Determine which groups are actually configured on this site via OneTrust API.
        // Sites may not have all groups (e.g. no C0003/Functional) — only report configured ones.
        let configured = null;
        try {
          const domainGroups = window.OneTrust?.GetDomainData?.()?.Groups;
          if (Array.isArray(domainGroups)) {
            configured = new Set(domainGroups.map(gr => gr.CustomGroupId));
          }
        } catch {}
        const exists = id => !configured || configured.has(id);
        const active = g.split(',').map(id => id.trim()).filter(Boolean);
        const has = id => active.includes(id);
        const result = {};
        if (exists('C0002')) result.analytics = has('C0002') ? 'granted' : 'denied';
        if (exists('C0004')) result.marketing = has('C0004') ? 'granted' : 'denied';
        if (exists('C0003')) result.functional = has('C0003') ? 'granted' : 'denied';
        return Object.keys(result).length > 0 ? result : null;
      },
      hasInteracted: () => typeof window.OneTrust?.IsAlertBoxClosed === 'function' && window.OneTrust.IsAlertBoxClosed(),
    },

    {
      id: 'cookieyes', cmp: 'CookieYes',
      detect: () => typeof window.getCkyConsent === 'function',
      read: () => {
        const c = window.getCkyConsent();
        if (!c?.categories) return null;
        return {
          analytics: c.categories.analytics ? 'granted' : 'denied',
          marketing: c.categories.advertisement ? 'granted' : 'denied',
          functional: c.categories.functional ? 'granted' : 'denied',
        };
      },
      hasInteracted: () => { try { return window.getCkyConsent()?.isUserActionCompleted === true; } catch { return false; } },
    },

    {
      id: 'termly', cmp: 'Termly',
      detect: () => typeof window.Termly?.getConsentState === 'function',
      read: () => {
        const s = window.Termly.getConsentState();
        if (!s) return null;
        return {
          analytics: s.analytics ? 'granted' : 'denied',
          marketing: s.advertising ? 'granted' : 'denied',
          functional: s.essential ? 'granted' : 'denied',
        };
      },
    },

    {
      id: 'osano', cmp: 'Osano',
      detect: () => typeof window.Osano?.cm?.getConsent === 'function',
      read: () => {
        const c = window.Osano.cm.getConsent();
        if (!c) return null;
        return {
          analytics: c.ANALYTICS === 'ACCEPT' ? 'granted' : 'denied',
          marketing: c.MARKETING === 'ACCEPT' ? 'granted' : 'denied',
          functional: c.ESSENTIAL === 'ACCEPT' ? 'granted' : 'denied',
        };
      },
    },

    {
      id: 'transcend', cmp: 'Transcend',
      detect: () => typeof window.airgap?.getConsent === 'function',
      read: () => {
        const c = window.airgap.getConsent();
        if (!c?.purposes) return null;
        return {
          analytics: c.purposes.Analytics ? 'granted' : 'denied',
          marketing: c.purposes.Advertising ? 'granted' : 'denied',
          functional: c.purposes.Functional ? 'granted' : 'denied',
        };
      },
    },

    {
      id: 'iubenda', cmp: 'iubenda',
      detect: () => window._iub?.cs?.consent != null,
      read: () => {
        const p = window._iub.cs.consent.purposes;
        if (!p) return null;
        return {
          analytics: p[4] ? 'granted' : 'denied',
          marketing: p[5] ? 'granted' : 'denied',
          functional: p[2] ? 'granted' : 'denied',
        };
      },
    },

    {
      id: 'cookiescript', cmp: 'CookieScript',
      detect: () => typeof window.CookieScript?.instance?.currentState === 'function',
      read: () => {
        const s = window.CookieScript.instance.currentState();
        if (!s?.categories) return null;
        const cats = s.categories;
        return {
          analytics: cats.includes('performance') ? 'granted' : 'denied',
          marketing: cats.includes('targeting') ? 'granted' : 'denied',
          functional: cats.includes('functionality') ? 'granted' : 'denied',
        };
      },
    },

    {
      id: 'cookiefirst', cmp: 'CookieFirst',
      detect: () => window.CookieFirst?.consent != null,
      read: () => {
        const c = window.CookieFirst.consent;
        if (!c) return null;
        return {
          analytics: c.performance ? 'granted' : 'denied',
          marketing: c.advertising ? 'granted' : 'denied',
          functional: c.functional ? 'granted' : 'denied',
        };
      },
    },

    {
      id: 'complianz', cmp: 'Complianz',
      detect: () => typeof window.cmplz_has_consent === 'function',
      read: () => ({
        analytics: window.cmplz_has_consent('statistics') ? 'granted' : 'denied',
        marketing: window.cmplz_has_consent('marketing') ? 'granted' : 'denied',
        functional: window.cmplz_has_consent('functional') ? 'granted' : 'denied',
      }),
    },

    {
      id: 'cookie-information', cmp: 'Cookie Information',
      detect: () => typeof window.CookieInformation?.getConsentGivenFor === 'function',
      read: () => ({
        analytics: window.CookieInformation.getConsentGivenFor('cookie_cat_statistic') ? 'granted' : 'denied',
        marketing: window.CookieInformation.getConsentGivenFor('cookie_cat_marketing') ? 'granted' : 'denied',
        functional: window.CookieInformation.getConsentGivenFor('cookie_cat_functional') ? 'granted' : 'denied',
      }),
    },

    {
      id: 'trustarc', cmp: 'TrustArc',
      detect: () => typeof window.PrivacyManagerAPI?.callApi === 'function',
      read: () => {
        // TrustArc API has 'functional' and 'advertising' — no separate 'analytics'.
        // Their 'functional' category covers both analytics/performance and preferences.
        const host = window.location.host;
        const funcResult = window.PrivacyManagerAPI.callApi('getConsent', host, null, null, 'functional');
        const adsResult = window.PrivacyManagerAPI.callApi('getConsent', host, null, null, 'advertising');
        return {
          analytics: funcResult?.consent === 'approved' ? 'granted' : 'denied',
          marketing: adsResult?.consent === 'approved' ? 'granted' : 'denied',
          functional: funcResult?.consent === 'approved' ? 'granted' : 'denied',
        };
      },
    },

    {
      id: 'borlabs', cmp: 'Borlabs Cookie',
      detect: () => typeof window.BorlabsCookie?.Consents?.hasConsentForServiceGroup === 'function',
      read: () => ({
        analytics: window.BorlabsCookie.Consents.hasConsentForServiceGroup('statistics') ? 'granted' : 'denied',
        marketing: window.BorlabsCookie.Consents.hasConsentForServiceGroup('marketing') ? 'granted' : 'denied',
        functional: window.BorlabsCookie.Consents.hasConsentForServiceGroup('essential') ? 'granted' : 'denied',
      }),
    },

    // --- Keyword-matching readers (site-configurable category names) ---

    {
      id: 'usercentrics', cmp: 'Usercentrics',
      detect: () => typeof window.UC_UI?.getServicesBaseInfo === 'function',
      read: () => {
        const services = window.UC_UI.getServicesBaseInfo();
        if (!services || !Array.isArray(services) || services.length === 0) return null;
        // Get category labels for keyword matching (slugs may be UUIDs)
        let catLabels = {};
        try {
          const cats = window.UC_UI.getCategoriesBaseInfo?.();
          if (cats && Array.isArray(cats)) {
            for (const cat of cats) catLabels[cat.slug] = cat.label || '';
          }
        } catch (e) { /* ignore */ }
        // Group services by category slug, tracking consent status and names
        const catData = {};
        for (const svc of services) {
          const slug = svc.categorySlug || '';
          if (!slug || slug === 'essential') continue;
          if (!catData[slug]) catData[slug] = { consents: [], label: catLabels[slug] || '', serviceNames: [] };
          catData[slug].consents.push(svc.consent?.status === true);
          if (svc.name) catData[slug].serviceNames.push(svc.name);
        }
        const result = { analytics: 'denied', marketing: 'denied', functional: 'denied' };
        for (const [slug, data] of Object.entries(catData)) {
          const anyGranted = data.consents.some(c => c);
          if (!anyGranted) continue;
          // Match using slug + category label
          let unified = matchConsentCategory(slug + ' ' + data.label);
          // Fallback for custom UUID categories: infer from service names
          // (getCategoriesBaseInfo unavailable in some UC versions — slug is a UUID with no keywords)
          if (!unified && slug.startsWith('customCategory-') && data.serviceNames.length > 0) {
            unified = matchConsentCategory(data.serviceNames.join(' '));
          }
          if (unified) result[unified] = 'granted';
        }
        return result;
      },
      hasInteracted: () => {
        try {
          const services = window.UC_UI.getServicesBaseInfo();
          if (!services) return null;
          // If any non-essential service is consented, user has made an active choice
          return services.some(s => !s.isEssential && s.consent?.status === true) || null;
        } catch { return null; }
      },
    },

    {
      id: 'didomi', cmp: 'Didomi',
      detect: () => typeof window.Didomi?.getCurrentUserStatus === 'function',
      read: () => {
        const status = window.Didomi.getCurrentUserStatus();
        if (!status?.purposes) return null;
        const result = { analytics: 'denied', marketing: 'denied', functional: 'denied' };
        for (const [purposeId, data] of Object.entries(status.purposes)) {
          if (data?.enabled !== true) continue;
          const unified = matchConsentCategory(purposeId);
          if (unified) result[unified] = 'granted';
        }
        return result;
      },
    },

    {
      id: 'fides', cmp: 'Ethyca Fides',
      detect: () => window.Fides?.consent != null && typeof window.Fides.consent === 'object',
      read: () => {
        const c = window.Fides.consent;
        if (!c || Object.keys(c).length === 0) return null;
        const result = { analytics: 'denied', marketing: 'denied', functional: 'denied' };
        for (const [key, value] of Object.entries(c)) {
          if (!value) continue;
          const unified = matchConsentCategory(key);
          if (unified) result[unified] = 'granted';
        }
        return result;
      },
    },

    {
      id: 'ketch', cmp: 'Ketch',
      detect: () => typeof window.semaphore?.consent === 'object' || typeof window.ketch === 'function',
      read: () => {
        // Try semaphore.consent first (direct object access)
        const c = window.semaphore?.consent;
        if (c && typeof c === 'object') {
          const result = { analytics: 'denied', marketing: 'denied', functional: 'denied' };
          for (const [key, value] of Object.entries(c)) {
            const unified = matchConsentCategory(key);
            if (unified) result[unified] = value === 'granted' || value === true ? 'granted' : 'denied';
          }
          return result;
        }
        return null;
      },
    },

    {
      id: 'axeptio', cmp: 'Axeptio',
      detect: () => window.axeptioSDK?.userPreferencesManager != null,
      read: () => {
        // Axeptio SDK userPreferencesManager.choices holds per-vendor consent booleans
        const prefs = window.axeptioSDK?.userPreferencesManager;
        if (!prefs) return null;
        const choices = prefs.choices || prefs.allChoices;
        if (!choices || typeof choices !== 'object') return null;
        const result = { analytics: 'denied', marketing: 'denied', functional: 'denied' };
        for (const [key, value] of Object.entries(choices)) {
          if (!value) continue;
          const unified = matchConsentCategory(key);
          if (unified) result[unified] = 'granted';
        }
        return result;
      },
    },

    {
      id: 'piwik-pro', cmp: 'Piwik Pro Consent',
      detect: () => typeof window.ppms?.cm?.api === 'function',
      read: () => {
        // Piwik PRO Consent Manager API — synchronous check via getComplianceSettings
        try {
          let result = null;
          window.ppms.cm.api('getComplianceSettings', (settings) => {
            if (!settings?.consents) return;
            const c = settings.consents;
            result = {
              analytics: c.analytics?.status === 1 ? 'granted' : 'denied',
              marketing: (c.remarketing?.status === 1 || c.conversion_tracking?.status === 1) ? 'granted' : 'denied',
              functional: c.analytics?.status === 1 ? 'granted' : 'denied',
            };
          }, () => { /* error callback */ });
          return result;
        } catch { return null; }
      },
    },

    // --- Secure Privacy (sp object with allGivenConsents) ---
    {
      id: 'secure-privacy', cmp: 'Secure Privacy',
      detect: () => window.sp?.allGivenConsents != null || typeof window.sp?.checkConsent === 'function',
      read: () => {
        try {
          const consents = window.sp?.allGivenConsents;
          if (!consents || typeof consents !== 'object') return null;
          const result = { analytics: 'denied', marketing: 'denied', functional: 'denied' };
          for (const [key, value] of Object.entries(consents)) {
            const k = key.toLowerCase();
            const granted = !!value;
            if (['analytics', 'statistic', 'performance', 'measurement'].some(t => k.includes(t))) {
              result.analytics = granted ? 'granted' : 'denied';
            } else if (['marketing', 'advertis', 'targeting'].some(t => k.includes(t))) {
              result.marketing = granted ? 'granted' : 'denied';
            } else if (['functional', 'preference', 'essential', 'necessary'].some(t => k.includes(t))) {
              result.functional = granted ? 'granted' : 'denied';
            }
          }
          return result;
        } catch { return null; }
      },
    },

    // --- Evidon / Crownpeak (window.evidon.notice with consent callback) ---
    {
      id: 'evidon', cmp: 'Evidon',
      detect: () => window.evidon?.notice != null,
      read: () => {
        try {
          // Evidon uses callbacks for consent state; try reading from notice properties
          const notice = window.evidon?.notice;
          if (!notice) return null;
          // Some implementations expose categoryConsent or consentCategories
          const cats = notice.categoryConsent || notice.consentCategories || notice._categoryConsent;
          if (!cats || typeof cats !== 'object') return null;
          const result = { analytics: 'denied', marketing: 'denied', functional: 'denied' };
          for (const [key, value] of Object.entries(cats)) {
            const k = key.toLowerCase();
            const granted = !!value;
            if (['analytics', 'statistic', 'performance', 'measurement'].some(t => k.includes(t))) {
              result.analytics = granted ? 'granted' : 'denied';
            } else if (['marketing', 'advertis', 'targeting'].some(t => k.includes(t))) {
              result.marketing = granted ? 'granted' : 'denied';
            } else if (['functional', 'preference', 'essential', 'necessary'].some(t => k.includes(t))) {
              result.functional = granted ? 'granted' : 'denied';
            }
          }
          return result;
        } catch { return null; }
      },
    },

    // --- Tarteaucitron (per-service keyword-matching) ---
    {
      id: 'tarteaucitron', cmp: 'Tarteaucitron',
      detect: () => window.tarteaucitron?.state != null && typeof window.tarteaucitron.state === 'object',
      read: () => {
        const state = window.tarteaucitron.state;
        if (!state || Object.keys(state).length === 0) return null;
        const result = { analytics: 'denied', marketing: 'denied', functional: 'denied' };
        for (const [key, value] of Object.entries(state)) {
          if (value !== true) continue;
          const unified = matchConsentCategory(key);
          if (unified) result[unified] = 'granted';
        }
        return result;
      },
    },

    // --- Klaro (per-service keyword-matching via ConsentManager) ---
    {
      id: 'klaro', cmp: 'Klaro',
      detect: () => typeof window.klaro?.getManager === 'function',
      read: () => {
        try {
          const manager = window.klaro.getManager();
          if (!manager?.consents) return null;
          const result = { analytics: 'denied', marketing: 'denied', functional: 'denied' };
          for (const [key, value] of Object.entries(manager.consents)) {
            if (!value) continue;
            const unified = matchConsentCategory(key);
            if (unified) result[unified] = 'granted';
          }
          return result;
        } catch { return null; }
      },
    },

    // --- Real Cookie Banner (per-service keyword-matching via consentApi) ---
    {
      id: 'real-cookie-banner', cmp: 'Real Cookie Banner',
      detect: () => window.consentApi != null && typeof window.consentApi === 'object',
      read: () => {
        // Real Cookie Banner stores consented service IDs — try to read from cookie
        // The window.consentApi is async (Promise-based), so we can't read state synchronously.
        // Fall back to null — consent state comes from cookie parser instead.
        return null;
      },
    },

    // --- Generic IAB TCF reader (covers Consentmanager, Quantcast, InMobi, Sourcepoint, etc.) ---
    // Must be LAST — only activates if no CMP-specific reader matched above.
    {
      id: 'tcf', cmp: 'IAB TCF',
      detect: () => typeof window.__tcfapi === 'function',
      read: () => {
        // __tcfapi is async, but getTCData fires callback synchronously when data is available
        let result = null;
        try {
          window.__tcfapi('getTCData', 2, (tcData, success) => {
            if (!success || !tcData?.purpose?.consents) return;
            const p = tcData.purpose.consents;
            // TCF purposes: 1=Store/Access, 2-6=Advertising, 7-8=Measurement, 9-10=Content
            result = {
              analytics: (p[7] || p[8]) ? 'granted' : 'denied',
              marketing: (p[2] || p[3] || p[4] || p[5] || p[6]) ? 'granted' : 'denied',
              functional: p[1] ? 'granted' : 'denied',
            };
          });
        } catch { /* ignore */ }
        return result;
      },
      hasInteracted: () => {
        let interacted = null;
        try {
          window.__tcfapi('getTCData', 2, (tcData, success) => {
            if (success) interacted = tcData?.eventStatus === 'useractioncomplete';
          });
        } catch { /* ignore */ }
        return interacted;
      },
    },

  ]; // end CMP_READERS

  // Probe state tracking
  let lastCMPStateJSON = null;
  let cmpDetected = false;
  let cmpProbeCount = 0;
  let cmpRetriggerTimeout = null; // Debounce for consent-event re-triggers
  const CMP_PROBE_MAX = 6;        // Max poll iterations (6 × 5s = 30s)
  const CMP_PROBE_INTERVAL = 5000; // 5 seconds between polls

  /**
   * Probe all CMP readers. If a CMP is found and state has changed, send upstream.
   * Stops at the first detected CMP (sites use one CMP, not multiple).
   */
  function probeCMPConsentState() {
    try {
      for (const reader of CMP_READERS) {
        try {
          if (!reader.detect()) continue;
          cmpDetected = true;
          const categories = reader.read();
          const hasInteracted = reader.hasInteracted ? reader.hasInteracted() : null;
          const statePayload = {
            cmp: reader.cmp,
            id: reader.id,
            categories: categories,
            hasInteracted: hasInteracted,
          };
          // Compare without timestamp so dedup works across probes with identical state
          const stateJSON = JSON.stringify(statePayload);
          if (stateJSON !== lastCMPStateJSON) {
            lastCMPStateJSON = stateJSON;
            statePayload.timestamp = Date.now();
            window.postMessage({
              type: 'CMP_CONSENT_STATE',
              payload: statePayload
            }, '*');
          }
          return; // Found a CMP, stop probing
        } catch (e) {
          // Individual reader threw, continue to next
        }
      }
    } catch (e) {
      // Never break the host page
    }
  }

  // Probe after DOMContentLoaded (most CMPs loaded by then)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => probeCMPConsentState());
  } else {
    probeCMPConsentState();
  }

  // Slow poll for late-loading CMPs + consent state changes
  // Runs every 5s. Stops after 30s if no CMP found, continues if CMP detected (to catch state changes).
  const cmpProbeIntervalId = setInterval(() => {
    cmpProbeCount++;
    probeCMPConsentState();
    // Stop polling after max iterations if no CMP found
    // If CMP is detected, keep polling to catch consent changes (user interacts with banner)
    if (!cmpDetected && cmpProbeCount >= CMP_PROBE_MAX) {
      clearInterval(cmpProbeIntervalId);
    }
    // After extended period (60s), stop even if CMP detected — consent changes are rare after that
    if (cmpProbeCount >= CMP_PROBE_MAX * 2) {
      clearInterval(cmpProbeIntervalId);
    }
  }, CMP_PROBE_INTERVAL);

  // Clear the probe interval when the page is being unloaded (#138 F11). The
  // interval self-terminates at CMP_PROBE_MAX*2 (~60s), but a page navigated
  // away from before that bound would keep an orphan timer alive in bfcache.
  // pagehide fires for both unload and bfcache eviction; the listener is a
  // no-op if the interval already cleared itself.
  window.addEventListener('pagehide', () => {
    try { clearInterval(cmpProbeIntervalId); } catch (e) { /* never break the host page */ }
  });

})();
