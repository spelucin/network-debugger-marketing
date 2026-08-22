// Event Watcher - Content Script
// Bridges communication between page context and background service worker

// Helper to safely send messages to background script
// Handles cases where extension context is invalidated (e.g., after extension reload)
function safeSendMessage(message) {
  try {
    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      return;
    }
    chrome.runtime.sendMessage(message).catch(() => {
      // Extension context might be invalidated, ignore
    });
  } catch (e) {
    // Extension context invalidated, ignore
  }
}

// Listen for messages from the page script
window.addEventListener('message', (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;

  // Check for dataLayer events
  if (event.data && event.data.type === 'EVENT_DEBUGGER_EVENT') {
    const payload = event.data.payload;

    // Check if this is a navigation event
    if (payload._type === 'navigation') {
      safeSendMessage({
        type: 'PAGE_NAVIGATION',
        data: payload
      });
      return;
    }

    // Forward to background service worker
    safeSendMessage({
      type: 'DATALAYER_PUSH',
      data: payload
    });
  }

  // Check for Tealium utag events
  if (event.data && event.data.type === 'TEALIUM_EVENT') {
    const payload = event.data.payload;

    // Forward to background service worker
    safeSendMessage({
      type: 'TEALIUM_PUSH',
      data: payload
    });
  }

  // Check for Adobe Launch / ACDL events
  if (event.data && event.data.type === 'ADOBE_LAUNCH_EVENT') {
    const payload = event.data.payload;

    // Forward to background service worker
    safeSendMessage({
      type: 'ADOBE_LAUNCH_PUSH',
      data: payload
    });
  }

  // Check for W3C digitalData events
  if (event.data && event.data.type === 'W3C_DIGITALDATA_EVENT') {
    const payload = event.data.payload;

    safeSendMessage({
      type: 'W3C_DIGITALDATA_PUSH',
      data: payload
    });
  }

  // Check for Commanders Act tc_vars events
  if (event.data && event.data.type === 'COMMANDERSACT_EVENT') {
    const payload = event.data.payload;

    safeSendMessage({
      type: 'COMMANDERSACT_PUSH',
      data: payload
    });
  }

  // Check for Relay42 defined42 events
  if (event.data && event.data.type === 'RELAY42_EVENT') {
    const payload = event.data.payload;

    safeSendMessage({
      type: 'RELAY42_PUSH',
      data: payload
    });
  }

  // Check for Ensighten data layer events
  if (event.data && event.data.type === 'ENSIGHTEN_EVENT') {
    const payload = event.data.payload;

    safeSendMessage({
      type: 'ENSIGHTEN_PUSH',
      data: payload
    });
  }

  // Check for CMP consent state from window API reading
  if (event.data && event.data.type === 'CMP_CONSENT_STATE') {
    safeSendMessage({
      type: 'CMP_CONSENT_STATE',
      data: event.data.payload
    });
  }
});

// Target origin for the same-document relay into the page-injected script (F3).
// The page-side listeners guard `event.source === window`, so a fixed origin is
// sufficient and avoids the gratuitous wildcard. One wrinkle: this content script
// runs in ALL frames (manifest `all_frames: true` on `<all_urls>`), so it also
// lives in sandboxed / `data:` / `srcdoc` frames whose `location.origin` is the
// opaque string 'null' — and `postMessage(msg, 'null')` THROWS a SyntaxError.
// Fall back to '*' only in that opaque case so the relay keeps working there
// instead of breaking the frame; every normal http(s) page gets the tight origin.
const PAGE_MESSAGE_TARGET_ORIGIN =
  (window.location.origin && window.location.origin !== 'null')
    ? window.location.origin
    : '*';

// Listen for messages FROM the extension (reverse channel: service worker → content script → page)
// This enables the panel to push dataLayer events to the inspected page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PUSH_DATALAYER_TO_PAGE') {
    window.postMessage({
      type: 'EVENT_WATCHER_PUSH_DATALAYER',
      payload: message.payload
    }, PAGE_MESSAGE_TARGET_ORIGIN);
    sendResponse({ success: true });
    return true;
  }

  // Feature #81 Phase 1 — relay a fresh "Copy for AI" payload to the page-
  // injected script. Service worker already enforces the installType=='development'
  // gate before sending this; this branch only fires on dev installs.
  if (message.type === 'AI_EXPORT_TO_PAGE') {
    window.postMessage({
      source: 'event-watcher',
      type: 'COPY_FOR_AI_EXPORT',
      payload: message.payload,
      ts: message.ts,
      exportId: message.exportId,
      scopeType: message.scopeType,
    }, PAGE_MESSAGE_TARGET_ORIGIN);
    sendResponse({ success: true });
    return true;
  }
});

// ===== GTM CONTAINER INTERCEPT =====
// MutationObserver fallback for blocking GTM containers (catches non-standard loaders).

/**
 * Install MutationObserver fallback for blocking GTM containers.
 * Reads blocked container IDs from storage and removes matching <script> tags.
 * Disconnects after 5 seconds to avoid performance overhead.
 */
function installGTMBlockObserver() {
  try {
    if (!chrome.runtime?.id) return;

    chrome.storage.local.get(['gtmInterceptRules'], (result) => {
      try {
        const rules = result.gtmInterceptRules || [];
        const domain = location.hostname;
        const blockedIds = rules
          .filter(r => r.active && r.action === 'block' && (!r.domain || r.domain === domain))
          .map(r => r.containerId);

        if (blockedIds.length === 0) return;

        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
              if (node.tagName !== 'SCRIPT') continue;
              const src = node.src || '';
              for (const id of blockedIds) {
                if (src.includes(`id=${id}`) && src.includes('googletagmanager.com')) {
                  // Remove silently — the panel shows blocked state from the
                  // intercept rules themselves; the old GTM_CONTAINER_BLOCKED
                  // notification had no listener (removed 2026-06-11, #135).
                  node.remove();
                  break;
                }
              }
            }
          }
        });

        observer.observe(document.documentElement, {
          childList: true,
          subtree: true
        });

        // Disconnect after 5s — GTM loads early
        setTimeout(() => observer.disconnect(), 5000);
      } catch (e) {
        // Observer setup failed, non-critical
      }
    });
  } catch (e) {
    // Extension context invalidated
  }
}

// Install GTM block observer at document_start
installGTMBlockObserver();

// Default data layer settings
const DEFAULT_DATALAYER_SETTINGS = {
  'datalayer': true,           // dataLayer
  'adobe-datalayer': true,     // Adobe Client Data Layer
  'tealium-datalayer': true,   // Tealium utag_data
  'w3c-datalayer': false,      // W3C digitalData
  'commandersact-datalayer': false, // Commanders Act tc_vars
  'relay42-datalayer': false,  // Relay42 defined42
  'piwik-datalayer': false,    // Piwik PRO Data Layer
  'ensighten-datalayer': false // Ensighten Data Layer
};

// Pass settings to page context via data attribute (CSP-safe)
function injectSettings(settings) {
  // Create a hidden element to pass settings (CSP-safe alternative to inline script)
  const settingsEl = document.createElement('div');
  settingsEl.id = '__eventWatcherSettingsData';
  settingsEl.style.display = 'none';
  settingsEl.setAttribute('data-settings', JSON.stringify(settings));
  (document.head || document.documentElement).appendChild(settingsEl);
}

// Check if we should inject into this frame
function shouldInjectInFrame() {
  try {
    // Skip sandboxed iframes (origin is 'null')
    if (window.origin === 'null') {
      return false;
    }

    // Skip cross-origin iframes - they have separate window/dataLayer contexts
    // and attempting to inject causes network errors (status 0)
    if (window.top !== window) {
      try {
        // This throws if cross-origin
        window.top.location.origin;
      } catch (e) {
        return false;
      }
    }

    return true;
  } catch (e) {
    return false;
  }
}

// Inject the page script to access window.dataLayer
function injectPageScript() {
  try {
    // Check if we should inject in this frame
    if (!shouldInjectInFrame()) {
      return;
    }

    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      // Extension context invalidated, skipping injection
      return;
    }

    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/content/event-watcher-page.js');
    script.onload = function() {
      this.remove();
    };
    script.onerror = function(e) {
      // Page script blocked by CSP - notify service worker
      safeSendMessage({
        type: 'PAGE_SCRIPT_BLOCKED',
        reason: 'csp'
      });
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  } catch (e) {
    // Silently fail - injection may not be possible in all contexts
  }
}

// Initialize: Load settings and inject page script
// Use a try-catch to handle cases where extension context is invalidated
try {
  chrome.storage.local.get('dataLayerSettings', (result) => {
    try {
      const settings = result.dataLayerSettings || DEFAULT_DATALAYER_SETTINGS;
      injectSettings(settings);
      injectPageScript();
    } catch (e) {
      // If injection fails (e.g., CSP), log but don't crash
      // Page script injection failed, non-critical
    }
  });
} catch (e) {
  // Extension context invalidated (extension was reloaded)
  // Inject with defaults as a fallback
  try {
    injectSettings(DEFAULT_DATALAYER_SETTINGS);
    injectPageScript();
  } catch (innerE) {
    // Fallback injection failed, non-critical
  }
}

// ===== INTERACTION EVENT CAPTURE =====
// Captures user interactions and sends them as markers to the event stream
// Phase 1: clicks on interactive elements
// Phase 2: form field changes (select, radio, checkbox, range, text inputs, textarea) and form submissions

// Capture clicks on interactive elements
// Tier 1: semantic HTML interactive elements
// Tier 2: ARIA roles that imply interactivity
// Tier 3: framework click-handler attributes (Angular ng-click, inline onclick)
const INTERACTIVE_SELECTOR = [
  'a', 'button', 'input[type="submit"]', 'input[type="button"]', 'summary',
  '[role="button"]', '[role="tab"]', '[role="menuitem"]', '[role="switch"]',
  '[role="option"]', '[role="link"]', '[role="treeitem"]',
  '[onclick]', '[ng-click]'
].join(', ');

// Debounce: ignore clicks within 200ms on the same element (matched by reference)
let lastInteractionElement = null;
let lastInteractionTime = 0;
const INTERACTION_DEBOUNCE_MS = 200;

/**
 * Extract human-readable label from an interactive element (buttons, links)
 * Fallback chain: textContent → aria-label → title → tagName
 */
function getElementLabel(el) {
  const text = el.textContent?.trim();
  if (text) return text.slice(0, 100);
  const ariaLabel = el.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel.slice(0, 100);
  const title = el.getAttribute('title')?.trim();
  if (title) return title.slice(0, 100);
  return el.tagName;
}

/**
 * Extract human-readable label for a form field element
 * Form fields have no textContent, so use label association, aria, placeholder, name
 * Fallback chain: label[for] → parent label → aria-label → placeholder → name → tagName
 */
function getFieldLabel(el) {
  // 1. Associated <label> via for attribute
  if (el.id) {
    try {
      const associatedLabel = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (associatedLabel?.textContent?.trim()) return associatedLabel.textContent.trim().slice(0, 100);
    } catch (e) {
      // CSS.escape or querySelector may fail on exotic IDs
    }
  }
  // 2. Parent <label>
  const parentLabel = el.closest('label');
  if (parentLabel?.textContent?.trim()) return parentLabel.textContent.trim().slice(0, 100);
  // 3. aria-label
  const ariaLabel = el.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel.slice(0, 100);
  // 4. placeholder
  const placeholder = el.getAttribute('placeholder')?.trim();
  if (placeholder) return placeholder.slice(0, 100);
  // 5. name attribute
  const name = el.getAttribute('name')?.trim();
  if (name) return name.slice(0, 100);
  // 6. Fallback: element type
  return el.tagName;
}

// Capture-phase click listener fires before page handlers (catches stopPropagation cases)
document.addEventListener('click', (e) => {
  try {
    // Find nearest interactive ancestor (handles clicks on <span> inside <button>)
    const el = e.target.closest(INTERACTIVE_SELECTOR);
    if (!el) return;

    // Debounce: ignore rapid clicks on the same element
    const now = Date.now();
    if (el === lastInteractionElement && (now - lastInteractionTime) < INTERACTION_DEBOUNCE_MS) {
      return;
    }
    lastInteractionElement = el;
    lastInteractionTime = now;

    safeSendMessage({
      type: 'INTERACTION_EVENT',
      data: {
        action: 'click',
        label: getElementLabel(el),
        element: {
          tagName: el.tagName,
          textContent: el.textContent?.trim().slice(0, 100) || null,
          id: el.id || null,
          href: el.href || el.getAttribute('href') || null
        },
        pageUrl: window.location.href,
        pageHostname: window.location.hostname
      }
    });
  } catch (err) {
    // Interaction capture must never break the host page
  }
}, { capture: true });

// ===== FORM FIELD CHANGE CAPTURE (Phase 2) =====
// Captures change events on form fields and sends them as interaction markers
// Tier 1 (discrete values — safe to show): select, radio, checkbox, range
// Tier 2 (free text — PII risk, omit value): text, email, tel, password, textarea

const FORM_FIELD_SELECTOR = [
  'select',
  'input[type="radio"]', 'input[type="checkbox"]', 'input[type="range"]',
  'input[type="text"]', 'input[type="email"]', 'input[type="tel"]',
  'input[type="password"]',
  'input:not([type])',  // bare <input> defaults to type="text"
  'textarea'
].join(', ');

// Tier 1 input types: discrete values safe to capture with value
const TIER1_TYPES = new Set(['select-one', 'select-multiple', 'radio', 'checkbox', 'range']);

// Debounce for range inputs (can fire repeatedly during slider drag)
let lastRangeElement = null;
let lastRangeTime = 0;
const RANGE_DEBOUNCE_MS = 300;

document.addEventListener('change', (e) => {
  try {
    const el = e.target;
    if (!el.matches(FORM_FIELD_SELECTOR)) return;

    // Debounce range inputs
    if (el.type === 'range') {
      const now = Date.now();
      if (el === lastRangeElement && (now - lastRangeTime) < RANGE_DEBOUNCE_MS) return;
      lastRangeElement = el;
      lastRangeTime = now;
    }

    const fieldLabel = getFieldLabel(el);
    const tagName = el.tagName;
    const inputType = el.type || 'text';
    const isTier1 = TIER1_TYPES.has(inputType);

    // Determine element type descriptor for the eventName
    let elementType;
    if (tagName === 'SELECT') {
      elementType = 'SELECT';
    } else if (tagName === 'TEXTAREA') {
      elementType = 'TEXTAREA';
    } else {
      elementType = `INPUT[${inputType}]`;
    }

    // Build value for Tier 1 elements only
    let value = null;
    if (isTier1) {
      if (tagName === 'SELECT') {
        value = el.options[el.selectedIndex]?.text?.trim().slice(0, 100) || el.value;
      } else if (inputType === 'checkbox') {
        value = el.checked ? 'checked' : 'unchecked';
      } else if (inputType === 'radio') {
        // For radio: use the specific option's label, not the group label
        const specificLabel = el.closest('label')?.textContent?.trim().slice(0, 100);
        if (specificLabel) {
          value = specificLabel;
        } else if (el.id) {
          try {
            const assocLabel = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
            if (assocLabel) value = assocLabel.textContent?.trim().slice(0, 100);
          } catch (e2) { /* ignore */ }
        }
        if (!value) value = el.value;
      } else {
        value = el.value;
      }
    }

    // For radio buttons, use name attribute as the group label
    let displayLabel = fieldLabel;
    if (inputType === 'radio' && el.getAttribute('name')) {
      displayLabel = el.getAttribute('name');
    }

    // Determine action verb: checkbox uses 'click', everything else 'change'
    const action = (inputType === 'checkbox') ? 'click' : 'change';

    safeSendMessage({
      type: 'INTERACTION_EVENT',
      data: {
        action: action,
        label: displayLabel,
        elementType: elementType,
        value: value,
        isTier1: isTier1,
        element: {
          tagName: tagName,
          type: inputType,
          id: el.id || null,
          name: el.getAttribute('name') || null
        },
        pageUrl: window.location.href,
        pageHostname: window.location.hostname
      }
    });
  } catch (err) {
    // Form change capture must never break the host page
  }
}, { capture: true });

// ===== FORM SUBMIT CAPTURE (Phase 2) =====
// Captures form submission events

document.addEventListener('submit', (e) => {
  try {
    const form = e.target;
    if (!form || form.tagName !== 'FORM') return;

    const formLabel = form.id || form.getAttribute('name') ||
                      form.getAttribute('aria-label')?.trim() || null;

    // Get form action path (not full URL to avoid PII in query strings)
    let formActionPath = null;
    const formAction = form.getAttribute('action');
    if (formAction) {
      try {
        formActionPath = new URL(formAction, window.location.href).pathname;
      } catch (e2) {
        formActionPath = formAction;
      }
    }

    const formMethod = (form.method || 'GET').toUpperCase();

    safeSendMessage({
      type: 'INTERACTION_EVENT',
      data: {
        action: 'submit',
        label: formLabel,
        elementType: 'FORM',
        value: formActionPath,
        isTier1: true,
        element: {
          tagName: 'FORM',
          id: form.id || null,
          name: form.getAttribute('name') || null,
          formAction: formActionPath,
          formMethod: formMethod
        },
        pageUrl: window.location.href,
        pageHostname: window.location.hostname
      }
    });
  } catch (err) {
    // Form submit capture must never break the host page
  }
}, { capture: true });
