/**
 * What's New Tour — version-specific upgrade walkthrough.
 *
 * Companion to whats-new.js. When a user upgrades and dismisses the What's New
 * bubble via the "Take the tour" button, this module launches a short coachmark
 * tour that highlights only the features that are new in that version.
 *
 * Reuses window.OnboardingTour as the rendering engine — this module only owns
 * the version-keyed step definitions and a thin launch wrapper. Loaded as a
 * classic (non-module) script; exposes window.WhatsNewTour.
 *
 * Latest-version-only policy: WHATS_NEW_TOURS holds the tour for the current
 * shipping version only. The bubble's "Take the tour" button always launches
 * `getLatestVersion()`, and a user upgrading from N-2 to N sees only the N
 * notes (whats-new.js) + N tour — never a cumulative concatenation. Drop the
 * previous version's entry when bumping; otherwise the modal grows past the
 * viewport on every release.
 *
 * Extending the current tour while the release is still in development:
 *   1. Append a new object to the current version's `steps` (see step schema
 *      below — same shape as onboarding-tour.js TOUR_STEPS).
 *   2. Add a matching bullet to the current version's RELEASE_NOTES entry in
 *      whats-new.js so the bubble summary and the tour stay in sync.
 *
 * Bumping to a new version:
 *   1. Replace the existing top-level key with the new version (e.g.
 *      '1.2.0' → '1.3.0') — keep one entry, drop the old one. The What's
 *      New bubble itself acts as the welcome, so no welcome bookend is added
 *      to the tour.
 *   2. Replace the matching RELEASE_NOTES entry in whats-new.js with the
 *      new version's notes (drop the previous version's entry there too).
 *
 * Step schema (identical to onboarding-tour.js for compatibility):
 *   { id, step_name, title, content, targetSelectors, placement,
 *     beforeEnter?, afterExit?, skipIf?, resolveTarget? }
 */
(function () {
  'use strict';

  const STORAGE_KEY_COMPLETED = 'onboarding_whats_new_tour_completed_version';

  // ----------------------------------------
  // Version-keyed tours
  //
  // Each entry declares the welcome/thanks bookends and the content steps
  // between them. The module wraps bookends automatically so adding a new
  // feature just means appending one object to `steps`.
  // ----------------------------------------
  // v1.4.0 ships with a What's New NOTICE only — no upgrade tour. Leaving this
  // empty means hasTour('1.4.0') is false (so the bubble shows "Got it" alone)
  // and getLatestVersion() returns null (so Settings hides the replay-tour row).
  // To add a tour for a future release, append one entry keyed on that version
  // (see the "Bumping to a new version" note in the file header).
  const WHATS_NEW_TOURS = {};

  // ----------------------------------------
  // Helpers
  // ----------------------------------------

  function getVersions() {
    return Object.keys(WHATS_NEW_TOURS);
  }

  /**
   * Latest version is the last key in WHATS_NEW_TOURS — relies on insertion
   * order, so new versions must be appended, not prepended.
   */
  function getLatestVersion() {
    const keys = getVersions();
    return keys.length > 0 ? keys[keys.length - 1] : null;
  }

  function hasTour(version) {
    return !!(version && WHATS_NEW_TOURS[version]);
  }

  function buildSteps(version) {
    const tour = WHATS_NEW_TOURS[version];
    if (!tour) return null;

    // No welcome bookend — the What's New bubble that launched the tour is
    // itself the welcome, so the first tour step jumps straight to the
    // first feature highlight.
    const thanks = {
      id: 'whats_new_thanks',
      step_name: 'whats_new_thanks',
      title: tour.thanks.title,
      content: tour.thanks.content,
      centered: true,
      variant: 'large',
      isBookend: true,
      hideSkip: true,
      nextLabel: 'Done'
    };

    return [...tour.steps, thanks];
  }

  // ----------------------------------------
  // Public API
  // ----------------------------------------

  /**
   * Launch the What's New tour for a given version. No-op if the tour is
   * unknown, OnboardingTour isn't loaded, or a tour is already active.
   *
   * @param {string} version            - e.g. '1.1.0'
   * @param {Object} [options]
   * @param {Function} [options.trackEventFn]
   * @param {Object}   [options.hooks]  - Forwarded to OnboardingTour.start;
   *                                      if omitted, OnboardingTour falls back
   *                                      to its own configuredHooks.
   * @param {Function} [options.onComplete]
   * @param {string}   [options.reason] - Analytics reason; defaults to
   *                                      'whats_new' (or 'replay' from Settings).
   * @returns {boolean} true if the tour was started
   */
  function launch(version, options) {
    if (!window.OnboardingTour) return false;
    if (typeof window.OnboardingTour.isActive === 'function' && window.OnboardingTour.isActive()) {
      return false;
    }
    const steps = buildSteps(version);
    if (!steps) return false;

    const tour = WHATS_NEW_TOURS[version];
    const opts = options || {};

    window.OnboardingTour.start({
      steps,
      version: `${version}-v${tour.tourVersion}`,
      // Custom analytics name — consumed by emit() in onboarding-tour.js so
      // this tour shows up as `whats_new_1.1.0` in Amplitude instead of 'base'.
      tourName: `whats_new_${version}`,
      trackEventFn: opts.trackEventFn || null,
      hooks: opts.hooks,
      reason: opts.reason || 'whats_new',
      onComplete: (tourVersion) => {
        try {
          chrome.storage.local.set({ [STORAGE_KEY_COMPLETED]: version });
        } catch (_) { /* non-critical */ }
        if (typeof opts.onComplete === 'function') {
          try { opts.onComplete(tourVersion, version); } catch (_) {}
        }
      }
    });

    return true;
  }

  window.WhatsNewTour = {
    hasTour,
    launch,
    getVersions,
    getLatestVersion,
    STORAGE_KEY_COMPLETED
  };
})();
