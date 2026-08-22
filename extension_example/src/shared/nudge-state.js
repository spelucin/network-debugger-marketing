// @ts-check
/**
 * Nudge state — persistent state for the sidepanel banner system (Features #49 +
 * version-update banner).
 *
 * Stores three banner-related concerns:
 *   1. DevTools discovery (Feature #49) — `hasOpenedDevTools`, `sidepanelOpens`,
 *      `nudgeLastShownAt`, `nudgeShownCount` drive the default ↔ nudge variant
 *      swap on the blue banner.
 *   2. Per-version update announcement — `versionBannerShownFor`,
 *      `versionBannerFirstShownAt`, `versionBannerDismissedFor` drive the
 *      soft-purple "Event Watcher updated to vX" banner that takes precedence
 *      over the discovery banner for 7 days after each update.
 *   3. DevTools-open-since-update tracking — `lastDevToolsOpenVersion` records
 *      the version that was current the last time the user opened the Event
 *      Watcher tab in DevTools. The version banner uses this to disappear once
 *      the user has reached DevTools on the new version.
 *
 * Shared between sidepanel (reads + writes), DevTools panel (flips
 * `hasOpenedDevTools` and `lastDevToolsOpenVersion` on first `devtool_start`),
 * and the service worker (seeds version-banner dismissal on fresh install so
 * brand-new users don't see "updated to vX" with no prior version to compare).
 */

const STORAGE_KEY = 'nudge_devtools_state';

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The persisted shape of the `nudge_devtools_state` storage key (see
 * docs/STORAGE-KEYS.md for owner + call sites).
 *
 * @typedef {Object} NudgeState
 * @property {boolean} hasOpenedDevTools
 * @property {number|null} devToolsFirstOpenAt - Epoch ms.
 * @property {number} sidepanelOpens
 * @property {number|null} nudgeLastShownAt - Epoch ms.
 * @property {number} nudgeShownCount
 * @property {string|null} versionBannerShownFor - Manifest version, e.g. '1.3.0'.
 * @property {number|null} versionBannerFirstShownAt - Epoch ms.
 * @property {string|null} versionBannerDismissedFor - Manifest version.
 * @property {string|null} lastDevToolsOpenVersion - Manifest version.
 */

/** @type {NudgeState} */
export const DEFAULT_NUDGE_STATE = {
  hasOpenedDevTools: false,
  devToolsFirstOpenAt: null,
  sidepanelOpens: 0,
  nudgeLastShownAt: null,
  nudgeShownCount: 0,
  // Version banner (the "Event Watcher updated to vX" surface).
  versionBannerShownFor: null,
  versionBannerFirstShownAt: null,
  versionBannerDismissedFor: null,
  // Tracks the manifest version that was current when the user last opened
  // the Event Watcher DevTools tab. Lets the version banner detect "this user
  // has already reached DevTools on the new version" and self-retire.
  lastDevToolsOpenVersion: null,
};

/**
 * Load the persisted nudge state, merged over defaults (storage failures
 * fall back to pure defaults so banner logic never throws).
 * @returns {Promise<NudgeState>}
 */
export async function loadNudgeState() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return { ...DEFAULT_NUDGE_STATE, ...(result[STORAGE_KEY] || {}) };
  } catch (_) {
    return { ...DEFAULT_NUDGE_STATE };
  }
}

/**
 * Shallow-merge a patch into the persisted state and write it back.
 * @param {Partial<NudgeState>} patch
 * @returns {Promise<NudgeState>}
 */
export async function patchNudgeState(patch) {
  try {
    const current = await loadNudgeState();
    const next = { ...current, ...patch };
    await chrome.storage.local.set({ [STORAGE_KEY]: next });
    return next;
  } catch (_) {
    return { ...DEFAULT_NUDGE_STATE, ...patch };
  }
}

/**
 * Pure trigger predicate — exported for unit tests.
 * Returns true when Variant B (nudge) should render instead of Variant A.
 * Caller is responsible for deciding whether the banner is visible at all
 * (dismissal cooldown lives in sidepanel mount logic); this predicate only
 * picks the variant once visibility is decided.
 *
 * @param {Partial<NudgeState>|null} state - persisted nudge state
 * @param {number} [now] - override for Date.now() in tests
 * @returns {boolean}
 */
export function shouldShowNudge(state, now = Date.now()) {
  const s = { ...DEFAULT_NUDGE_STATE, ...(state || {}) };
  if (s.hasOpenedDevTools) return false;
  if (s.sidepanelOpens < 3) return false;
  if (s.nudgeShownCount >= 4) return false;
  if (s.nudgeLastShownAt && (now - s.nudgeLastShownAt) < SEVEN_DAYS_MS) return false;
  return true;
}

/**
 * Pure trigger predicate for the version-update banner.
 * Returns true when the soft-purple "Event Watcher updated to vX" banner
 * should render (and therefore replace the blue DevTools banner) on this
 * sidepanel mount.
 *
 * Rules:
 *   - Suppressed if the user already dismissed the banner for this exact
 *     version (`versionBannerDismissedFor === currentVersion`).
 *   - Suppressed once the user has opened the Event Watcher DevTools tab
 *     while running this version (`lastDevToolsOpenVersion === currentVersion`).
 *   - Suppressed for fresh installs — the service worker seeds both
 *     `versionBannerShownFor` and `versionBannerDismissedFor` to the install
 *     version, so the predicate returns false on first sidepanel open.
 *   - Otherwise shown until 7 days have elapsed since the first sidepanel
 *     mount that surfaced it for this version.
 *
 * @param {Partial<NudgeState>|null} state - persisted nudge state
 * @param {string} currentVersion - manifest version, e.g. "1.1.0"
 * @param {number} [now] - override for Date.now() in tests
 * @returns {boolean}
 */
export function shouldShowVersionBanner(state, currentVersion, now = Date.now()) {
  if (!currentVersion) return false;
  const s = { ...DEFAULT_NUDGE_STATE, ...(state || {}) };
  if (s.versionBannerDismissedFor === currentVersion) return false;
  if (s.lastDevToolsOpenVersion === currentVersion) return false;
  // First exposure to this version — caller will record the timestamp.
  if (s.versionBannerShownFor !== currentVersion) return true;
  // Returning exposure — show only inside the 7-day window.
  if (s.versionBannerFirstShownAt && (now - s.versionBannerFirstShownAt) < SEVEN_DAYS_MS) return true;
  return false;
}
