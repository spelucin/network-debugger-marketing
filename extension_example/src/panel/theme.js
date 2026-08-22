// ============================================================
// Theme Module
// ------------------------------------------------------------
// Resolves the user's theme preference (system / light / dark)
// and applies it to the document as a `data-theme` attribute.
//
// Persistence: chrome.storage.local under `themePreference`.
// Shared across all surfaces (DevTools panel, sidepanel, popup) —
// they write to the same key, and `chrome.storage.onChanged` keeps
// any already-open surface in sync with changes made elsewhere.
//
// Default: 'system' — panel follows the OS (prefers-color-scheme)
// and updates live when the OS theme flips.
//
// When the user picks an explicit value (light or dark), the
// matchMedia listener is ignored — the panel shows exactly
// what the user asked for until they switch back to 'system'.
// ============================================================

const STORAGE_KEY = 'themePreference';
// Legacy location: the sidepanel previously stored its theme under
// sidepanelSettings.theme. On first load after the unification we
// migrate that value into STORAGE_KEY so both surfaces share one source.
const LEGACY_SIDEPANEL_SETTINGS_KEY = 'sidepanelSettings';
const VALID_PREFERENCES = ['system', 'light', 'dark'];

let currentPreference = 'system';   // 'system' | 'light' | 'dark'
let currentResolved = 'light';      // 'light' | 'dark'  — what is actually shown
let systemMql = null;
let systemChangeListener = null;
const changeListeners = new Set();

/**
 * Get the OS-level theme preference.
 * @returns {'light'|'dark'}
 */
function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Apply `data-theme` attribute to <html> based on current preference.
 */
function apply() {
  const resolved = currentPreference === 'system' ? getSystemTheme() : currentPreference;
  currentResolved = resolved;
  document.documentElement.setAttribute('data-theme', resolved);

  // Notify any subscribers (e.g. the header toggle button to swap its icon)
  changeListeners.forEach((fn) => {
    try { fn({ preference: currentPreference, resolved }); } catch (e) { /* noop */ }
  });
}

/**
 * Attach or detach the matchMedia listener based on preference.
 * We only want to follow the OS theme while preference === 'system'.
 */
function updateSystemListener() {
  if (systemMql && systemChangeListener) {
    systemMql.removeEventListener('change', systemChangeListener);
    systemChangeListener = null;
  }
  if (currentPreference !== 'system') return;

  systemMql = window.matchMedia('(prefers-color-scheme: dark)');
  systemChangeListener = () => apply();
  systemMql.addEventListener('change', systemChangeListener);
}

/**
 * Initialize the theme system.
 * Reads stored preference (or defaults to 'system'), applies it,
 * and starts listening for OS theme changes when in system mode.
 * Call this as early as possible during panel startup.
 * @returns {Promise<{preference: string, resolved: 'light'|'dark'}>}
 */
export async function initTheme() {
  try {
    const stored = await chrome.storage.local.get([STORAGE_KEY, LEGACY_SIDEPANEL_SETTINGS_KEY]);
    let pref = stored[STORAGE_KEY];

    // One-time migration: the sidepanel used to keep its own copy under
    // sidepanelSettings.theme. If the shared key is empty but the legacy
    // one has a valid value, adopt it and drop it from the legacy object.
    if (!VALID_PREFERENCES.includes(pref)) {
      const legacy = stored[LEGACY_SIDEPANEL_SETTINGS_KEY];
      if (legacy && VALID_PREFERENCES.includes(legacy.theme)) {
        pref = legacy.theme;
        const { theme, ...rest } = legacy;
        await chrome.storage.local.set({
          [STORAGE_KEY]: pref,
          [LEGACY_SIDEPANEL_SETTINGS_KEY]: rest,
        });
      }
    }

    currentPreference = VALID_PREFERENCES.includes(pref) ? pref : 'system';
  } catch (e) {
    currentPreference = 'system';
  }
  apply();
  updateSystemListener();
  listenForCrossSurfaceChanges();
  return { preference: currentPreference, resolved: currentResolved };
}

// Attach the storage listener exactly once per document — calling
// initTheme() twice (unlikely, but harmless) should not stack listeners.
let storageListenerAttached = false;
function listenForCrossSurfaceChanges() {
  if (storageListenerAttached) return;
  try {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      const change = changes[STORAGE_KEY];
      if (!change) return;
      const next = VALID_PREFERENCES.includes(change.newValue) ? change.newValue : 'system';
      if (next === currentPreference) return;
      currentPreference = next;
      apply();
      updateSystemListener();
    });
    storageListenerAttached = true;
  } catch (e) {
    // chrome.storage may be unavailable in some contexts — fail silently.
  }
}

/**
 * Set the theme preference and persist it.
 * @param {'system'|'light'|'dark'} preference
 * @returns {Promise<{preference: string, resolved: 'light'|'dark'}>}
 */
export async function setThemePreference(preference) {
  if (!VALID_PREFERENCES.includes(preference)) return { preference: currentPreference, resolved: currentResolved };
  currentPreference = preference;
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: preference });
  } catch (e) {
    // Silent fail — theme is not critical
  }
  apply();
  updateSystemListener();
  return { preference: currentPreference, resolved: currentResolved };
}

/**
 * Get the current preference ('system' | 'light' | 'dark').
 */
export function getThemePreference() {
  return currentPreference;
}

/**
 * Get the resolved theme actually displayed ('light' | 'dark').
 */
export function getResolvedTheme() {
  return currentResolved;
}

/**
 * Toggle between light and dark (used by the header sun/moon button).
 * If currently resolved to light, sets preference to 'dark' (and vice versa).
 * This intentionally switches preference away from 'system' — the user is
 * making an explicit choice. They can return to 'system' from Settings.
 * @returns {Promise<{preference: string, resolved: 'light'|'dark'}>}
 */
export async function toggleTheme() {
  const next = currentResolved === 'dark' ? 'light' : 'dark';
  return setThemePreference(next);
}

/**
 * Subscribe to theme changes. The callback receives { preference, resolved }.
 * Returns an unsubscribe function.
 * @param {(info: {preference: string, resolved: 'light'|'dark'}) => void} fn
 * @returns {() => void}
 */
export function onThemeChange(fn) {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}
