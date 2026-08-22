// ============================================================
// Feature flags — compile-time defaults persisted to
// chrome.storage.local for discoverability.
//
// The defaults below are what ships in the built extension. On
// first boot the effective state is written to
// `chrome.storage.local.feature_flags` so every install exposes
// the flags as a plain editable object in the DevTools
// Application → Local Storage view — next to `settings`,
// `sidepanelSettings`, etc.
//
// A user who finds the key can flip any value to `true`:
//
//   chrome.storage.local.set({ feature_flags: { labsSection: true } })
//
// …and on the next DevTools reload the UI gates open. There is
// NO in-product UI for this — the DevTools storage viewer is the
// discovery surface by design. The goal is to see (via the
// `feature_flags` Amplitude property on every event) whether
// curious users find and flip these flags.
//
// This module is dependency-free so any file, including Node
// tests, can read the flags without pulling in the DOM-touching
// settings.js import chain.
// ============================================================

const DEFAULTS = Object.freeze({
  labsSection: false,   // Labs section in settings (React Flow JSON export)
  // Kill-switch for Stack View (Feature #71). Default ON because Stack
  // ships as a normal feature in v1.3.0; flip to `false` in
  // `chrome.storage.local.feature_flags` when attribution accuracy on a
  // given site is poor enough that the user wants to hide the toggle and
  // the view entirely. Hides:
  //   - the #view-mode-stack-toggle button
  //   - the Stack-related context-menu entries (Export → Stack)
  //   - the Stack section of any Settings UI that references it
  // Setting this off does NOT clear cached graphs in state.stackGraphs;
  // re-enabling restores them with no rebuild.
  stackView: true,
});

const STORAGE_KEY = 'feature_flags';

// Mutable live object. Consumers import this and read at call
// time. `loadFeatureFlags()` reconciles it with storage;
// `chrome.storage.onChanged` keeps it fresh for the rest of the
// session so mid-session edits show up on subsequent events.
export const FEATURE_FLAGS = { ...DEFAULTS };

/**
 * Reconcile FEATURE_FLAGS with chrome.storage.local on boot.
 *
 * - If `feature_flags` is missing from storage, persist the current
 *   defaults so the key shows up in the DevTools storage viewer.
 * - If it's present but missing one or more known flags (i.e. a
 *   new flag was added in a later release), merge the missing keys
 *   in and persist back so the object stays self-describing.
 * - If it's present and complete, read each boolean value as an
 *   override and leave storage untouched.
 *
 * Also installs a storage listener so a user pasting
 * `chrome.storage.local.set(...)` in the DevTools console flows
 * into FEATURE_FLAGS for the rest of the session. The boot-time
 * DOM sweep in panel.js is one-shot, so UI mounted (or removed)
 * at boot stays that way until a reload.
 *
 * Safe to call multiple times. Safe to call without chrome APIs
 * (Node tests fall through to compile-time defaults).
 */
export async function loadFeatureFlags() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const stored = result[STORAGE_KEY];
    const reconciled = reconcile(stored);
    applyFlags(reconciled);

    // Persist if either the key was missing entirely or a known
    // flag was missing from the stored object. Writing exactly the
    // reconciled view keeps storage self-describing.
    if (needsPersist(stored, reconciled)) {
      await chrome.storage.local.set({ [STORAGE_KEY]: reconciled });
    }
  } catch {
    // Storage unavailable (Node tests, service worker edge cases) —
    // keep compile-time defaults.
  }

  try {
    chrome.storage.onChanged?.addListener((changes, area) => {
      if (area === 'local' && changes[STORAGE_KEY]) {
        applyFlags(reconcile(changes[STORAGE_KEY].newValue));
      }
    });
  } catch {
    // No-op if storage API isn't available.
  }
}

/**
 * Merge a stored object with the compile-time defaults. Unknown
 * keys are dropped; non-boolean values for known keys fall back
 * to the default. Returns a fresh object every call.
 */
function reconcile(stored) {
  const out = {};
  const source = (stored && typeof stored === 'object') ? stored : {};
  for (const key of Object.keys(DEFAULTS)) {
    out[key] = typeof source[key] === 'boolean' ? source[key] : DEFAULTS[key];
  }
  return out;
}

function needsPersist(stored, reconciled) {
  if (!stored || typeof stored !== 'object') return true;
  for (const key of Object.keys(DEFAULTS)) {
    if (typeof stored[key] !== 'boolean') return true;
    if (stored[key] !== reconciled[key]) return true;
  }
  // Also persist if there are unknown keys we want to drop — but
  // don't: leave user-written extras alone. Only persist when a
  // known key is missing or malformed.
  return false;
}

function applyFlags(reconciled) {
  for (const key of Object.keys(DEFAULTS)) {
    FEATURE_FLAGS[key] = reconciled[key];
  }
}

/**
 * Test-only reset. Restores defaults; the DOM sweep only runs
 * once at boot, so resetting mid-test won't affect production
 * render paths.
 */
export function _resetFeatureFlagsForTests() {
  applyFlags(reconcile(null));
}

/**
 * Snake_case snapshot of the effective flag state for Amplitude
 * event properties. Read per-event so a user flipping a flag
 * mid-session starts showing up in analytics immediately.
 *
 * Enumerating flags explicitly (rather than dumping FEATURE_FLAGS)
 * keeps the Amplitude schema stable — new flags must be added
 * here on purpose.
 */
export function getFeatureFlagsForAnalytics() {
  return {
    labs_section: !!FEATURE_FLAGS.labsSection,
    stack_view: !!FEATURE_FLAGS.stackView,
  };
}
