/**
 * What's New — version upgrade announcement bubble.
 *
 * Shows a centered bubble (reusing the onboarding tour CSS) when a user
 * upgrades from a previous version. Fresh installs never see this — they
 * get the onboarding tour instead.
 *
 * Detection: the service worker sets a `_whatsNew` flag in chrome.storage.local
 * on `chrome.runtime.onInstalled` with `reason === 'update'`. This module reads
 * that flag on panel init, shows the bubble once, then clears the flag.
 *
 * Loaded as a classic (non-module) script. Exposes window.WhatsNew for panel.js.
 */
(function () {
  'use strict';

  // ----------------------------------------
  // Version-specific release notes
  // ----------------------------------------
  // Only the latest shipping version is kept here. The bubble looks up
  // RELEASE_NOTES[_whatsNew.to], so older versions never fire on a fresh
  // upgrade — keeping them around inflates the file and risks someone
  // wiring up a "show every release since you last updated" path that
  // bloats the modal until it stops fitting on screen. Drop the previous
  // entry when bumping to a new version. Content uses the same safe HTML
  // subset as the onboarding tour: <p>, <ul>, <li>, <strong>, <em>, <code>.
  const RELEASE_NOTES = {
    '1.4.0': {
      title: "What's New in Event Watcher 1.4.0",
      content:
        '<h4 class="whats-new-category">New</h4>' +
        '<ul>' +
        '<li><strong>Data layer detail views</strong> — Tealium <code>utag_data</code> and Adobe Client Data Layer now open in dedicated data-layer views, matching Google\'s.</li>' +
        '<li><strong>Easier-to-read JSON</strong> — bigger expand arrows, indent guides, row highlighting, click-anywhere-to-collapse, and open any section in a larger window for big payloads.</li>' +
        '</ul>' +
        '<h4 class="whats-new-category">Improvements</h4>' +
        '<ul>' +
        '<li><strong>Self-describing Unknown events</strong> — unrecognised requests now show their endpoint host in the stream and as a filter chip.</li>' +
        '<li><strong>Copy dataLayer Pushes</strong> — a lighter export of just what the site pushed to <code>window.dataLayer</code>.</li>' +
        '<li><strong>Consistent, current tool names</strong> — every tool now reads the same in the stream and its filter chip, under its current official name and logo.</li>' +
        '<li><strong>Sharper detection & steadier long sessions</strong> — fewer false positives, lighter on memory, plus quality and stability work under the hood.</li>' +
        '</ul>' +
        '<h4 class="whats-new-category">Tools</h4>' +
        '<ul>' +
        '<li><strong>Adobe Web SDK (Alloy) recognised</strong> — first-party (proxied) Adobe Experience Platform traffic now decodes into its full readable breakdown.</li>' +
        '<li><strong>Readable PostHog events</strong> — gzip-compressed PostHog captures now decode to their event name and properties. Thanks to Stipe L. via the in-app Submit a Feature form.</li>' +
        '</ul>' +
        '<p><em>Full details in Help → Versions.</em></p>'
    }
  };

  // Chrome Web Store review URL
  const CWS_REVIEW_URL = 'https://chromewebstore.google.com/detail/extension/bhdinplchmdmciglcpbjmeglbloekfgc/reviews';

  let whatsNewState = {
    bubble: null,
    overlay: null,
    trackEventFn: null,
    hooks: null,
    version: null,
    // Synchronously set true at the top of checkAndShow() — covers the gap
    // between "we've claimed the modal slot" and "the bubble DOM is mounted",
    // which spans the awaited storage reads. Reset on every early-return path.
    // Read by isActive() so the onboarding-tour scheduler's defer guard works
    // even before buildBubble() runs. See BUG16.
    pending: false
  };

  // ----------------------------------------
  // Safe HTML renderer (subset of onboarding-tour's renderStepBody)
  //
  // Also accepts two kinds of section header that match the Versions tab styling:
  //   <h4 class="whats-new-category">  — group by kind (New / Improvements /
  //       Fixes / Tools). The header text is the label, taken from content.
  //       This is the style used from v1.4.0 onward.
  //   <h4 class="whats-new-surface help-surface-(devtools|sidepanel|shared)">
  //       — legacy group-by-surface header, kept for backward compatibility.
  // ----------------------------------------
  const SURFACE_OPEN_RE = /^<h4 class="whats-new-surface help-surface-(devtools|sidepanel|shared)">$/i;
  const CATEGORY_OPEN_RE = /^<h4 class="whats-new-category">$/i;
  const SPLIT_RE = /(<\/?(?:strong|em|p|ul|li|code|h4)>|<h4 class="whats-new-surface help-surface-(?:devtools|sidepanel|shared)">|<h4 class="whats-new-category">)/i;

  function renderBody(el, template) {
    while (el.firstChild) el.removeChild(el.firstChild);
    const tokens = template.split(SPLIT_RE);
    const stack = [el];
    for (const token of tokens) {
      if (!token) continue;
      const openMatch = token.match(/^<(strong|em|p|ul|li|code|h4)>$/i);
      const closeMatch = token.match(/^<\/(strong|em|p|ul|li|code|h4)>$/i);
      const surfaceMatch = token.match(SURFACE_OPEN_RE);
      const categoryMatch = token.match(CATEGORY_OPEN_RE);
      if (surfaceMatch) {
        const h4 = document.createElement('h4');
        h4.className = `whats-new-surface help-surface-${surfaceMatch[1].toLowerCase()}`;
        stack[stack.length - 1].appendChild(h4);
        stack.push(h4);
      } else if (categoryMatch) {
        const h4 = document.createElement('h4');
        h4.className = 'whats-new-category';
        stack[stack.length - 1].appendChild(h4);
        stack.push(h4);
      } else if (openMatch) {
        const child = document.createElement(openMatch[1].toLowerCase());
        stack[stack.length - 1].appendChild(child);
        stack.push(child);
      } else if (closeMatch) {
        if (stack.length > 1) stack.pop();
      } else {
        if (stack[stack.length - 1] === el && !token.trim()) continue;
        stack[stack.length - 1].appendChild(document.createTextNode(token));
      }
    }
  }

  // ----------------------------------------
  // Build the bubble DOM
  // ----------------------------------------
  function buildBubble(notes) {
    // Semi-transparent overlay to focus attention
    const overlay = document.createElement('div');
    overlay.className = 'whats-new-overlay';

    const bubble = document.createElement('div');
    bubble.className = 'onboarding-bubble onboarding-bubble-large onboarding-bubble-centered visible';
    bubble.setAttribute('role', 'dialog');
    bubble.setAttribute('aria-modal', 'true');
    bubble.setAttribute('aria-labelledby', 'whats-new-title');
    bubble.setAttribute('aria-describedby', 'whats-new-body');

    // Arrow hidden by centered class, but structure matches onboarding bubble
    const arrow = document.createElement('div');
    arrow.className = 'onboarding-bubble-arrow';
    arrow.setAttribute('aria-hidden', 'true');

    const titleEl = document.createElement('div');
    titleEl.className = 'onboarding-bubble-title';
    titleEl.id = 'whats-new-title';
    titleEl.textContent = notes.title;

    const bodyEl = document.createElement('div');
    bodyEl.className = 'onboarding-bubble-body';
    bodyEl.id = 'whats-new-body';
    renderBody(bodyEl, notes.content);

    // Review / feedback CTA
    const ctaEl = document.createElement('div');
    ctaEl.className = 'whats-new-cta';
    const ctaText = document.createElement('p');
    ctaText.className = 'whats-new-cta-text';
    ctaText.textContent = 'Enjoying Event Watcher? A quick rating or review helps other developers find it.';
    ctaEl.appendChild(ctaText);

    const ctaLinks = document.createElement('div');
    ctaLinks.className = 'whats-new-cta-links';

    if (CWS_REVIEW_URL) {
      const reviewLink = document.createElement('a');
      reviewLink.href = CWS_REVIEW_URL;
      reviewLink.target = '_blank';
      reviewLink.rel = 'noopener';
      reviewLink.className = 'whats-new-cta-link';
      reviewLink.textContent = 'Leave a review';
      reviewLink.addEventListener('click', () => trackAction('review_click'));
      ctaLinks.appendChild(reviewLink);
    }

    const feedbackBtn = document.createElement('button');
    feedbackBtn.type = 'button';
    feedbackBtn.className = 'whats-new-cta-link';
    feedbackBtn.textContent = 'Send feedback';
    feedbackBtn.addEventListener('click', () => {
      trackAction('feedback_click');
      dismiss();
      if (whatsNewState.hooks && whatsNewState.hooks.openReport) {
        whatsNewState.hooks.openReport();
      }
    });
    ctaLinks.appendChild(feedbackBtn);

    ctaEl.appendChild(ctaLinks);

    // Footer with action buttons
    const footer = document.createElement('div');
    footer.className = 'onboarding-bubble-footer';

    // Left side — empty (no counter for a single bubble)
    const spacer = document.createElement('div');

    const controls = document.createElement('div');
    controls.className = 'onboarding-bubble-controls';

    // Detect whether a What's New tour is registered for this version — if so,
    // promote "Take the tour" to the primary action and demote "Got it" to
    // secondary. Missing tour (e.g. a patch release with only release notes)
    // falls back to "Got it" as the single primary action.
    const hasTour =
      !!(window.WhatsNewTour &&
         typeof window.WhatsNewTour.hasTour === 'function' &&
         window.WhatsNewTour.hasTour(whatsNewState.version));

    const dismissBtn = document.createElement('button');
    dismissBtn.type = 'button';
    dismissBtn.className = hasTour
      ? 'onboarding-bubble-btn onboarding-bubble-skip'
      : 'onboarding-bubble-btn onboarding-bubble-next onboarding-bubble-next-primary onboarding-bubble-btn-large';
    dismissBtn.textContent = 'Got it';
    dismissBtn.addEventListener('click', () => {
      trackAction('dismiss');
      dismiss();
    });
    controls.appendChild(dismissBtn);

    if (hasTour) {
      const tourBtn = document.createElement('button');
      tourBtn.type = 'button';
      tourBtn.className = 'onboarding-bubble-btn onboarding-bubble-next onboarding-bubble-next-primary onboarding-bubble-btn-large';
      tourBtn.textContent = 'Take the tour';
      tourBtn.addEventListener('click', () => {
        // No `tour_start` event — the tour itself fires
        // `onboarding_step { action: "show", step: 0,
        // tour: "whats_new_<version>" }` immediately on launch, which
        // already proves the user accepted the tour. A separate
        // `tour_start` event would double-count the same gesture.
        const version = whatsNewState.version;
        const trackFn = whatsNewState.trackEventFn;
        dismiss();
        // Launch on the next tick so the bubble removal finishes first and
        // focus can transfer cleanly to the tour bubble.
        // We intentionally do NOT forward whatsNewState.hooks here — the tour
        // relies on the full hook set (openSettings, etc.) that panel.js has
        // already registered via OnboardingTour.configureHooks().
        setTimeout(() => {
          if (window.WhatsNewTour && typeof window.WhatsNewTour.launch === 'function') {
            window.WhatsNewTour.launch(version, { trackEventFn: trackFn });
          }
        }, 0);
      });
      controls.appendChild(tourBtn);
    }

    footer.appendChild(spacer);
    footer.appendChild(controls);

    bubble.appendChild(arrow);
    bubble.appendChild(titleEl);
    bubble.appendChild(bodyEl);
    bubble.appendChild(ctaEl);
    bubble.appendChild(footer);

    // Esc to dismiss
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        trackAction('dismiss_esc');
        dismiss();
      }
    };
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(overlay);
    document.body.appendChild(bubble);

    // Center the bubble
    bubble.style.left = '50%';
    bubble.style.top = '50%';

    // Focus the primary action for keyboard users. When a tour exists the
    // "Take the tour" button is the primary; otherwise the Got it button is.
    const primaryBtn = controls.querySelector('.onboarding-bubble-next-primary') || dismissBtn;
    primaryBtn.focus();

    // Trap Tab within the bubble
    bubble.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusable = bubble.querySelectorAll('button, a[href]');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    whatsNewState.bubble = bubble;
    whatsNewState.overlay = overlay;
    whatsNewState.escHandler = escHandler;
  }

  function dismiss() {
    if (whatsNewState.bubble) {
      whatsNewState.bubble.classList.remove('visible');
      setTimeout(() => {
        if (whatsNewState.bubble && whatsNewState.bubble.parentNode) {
          whatsNewState.bubble.parentNode.removeChild(whatsNewState.bubble);
        }
        if (whatsNewState.overlay && whatsNewState.overlay.parentNode) {
          whatsNewState.overlay.parentNode.removeChild(whatsNewState.overlay);
        }
        whatsNewState.bubble = null;
        whatsNewState.overlay = null;
      }, 200);
    }
    if (whatsNewState.escHandler) {
      document.removeEventListener('keydown', whatsNewState.escHandler);
      whatsNewState.escHandler = null;
    }
    // Clear the What's New flag so the bubble never shows again for this version.
    // Also persist a hint so the onboarding tour scheduler knows this session's
    // user is an upgrader (not a fresh install) — consumed on next tour trigger.
    // The hint is harmless for upgraders who've already completed the tour:
    // the scheduler reads + clears it even if no tour actually starts.
    try {
      chrome.storage.local.remove('_whatsNew');
      chrome.storage.local.set({ _tourReasonHint: 'upgrade' });
    } catch (_) { /* non-critical */ }
  }

  function trackAction(action) {
    if (typeof whatsNewState.trackEventFn === 'function') {
      try {
        whatsNewState.trackEventFn('whats_new', {
          action,
          version: whatsNewState.version
        });
      } catch (_) { /* non-critical */ }
    }
  }

  // ----------------------------------------
  // Public API
  // ----------------------------------------

  /**
   * Check chrome.storage.local for a pending _whatsNew flag and show the bubble
   * if release notes exist for that version.
   *
   * @param {Object} options
   * @param {Function} [options.trackEventFn]  - Analytics tracking function
   * @param {Object}   [options.hooks]         - { openReport, onTourComplete }
   * @returns {Promise<boolean>} true if the bubble was shown
   */
  async function checkAndShow(options) {
    // Claim the modal slot synchronously so isActive() reports true through
    // the awaited storage reads below — the onboarding-tour scheduler runs
    // in the same task-queue tick and would otherwise race past us. BUG16.
    whatsNewState.pending = true;
    try {
      const { _whatsNew } = await chrome.storage.local.get('_whatsNew');
      if (!_whatsNew || !_whatsNew.to) {
        whatsNewState.pending = false;
        return false;
      }

      const notes = RELEASE_NOTES[_whatsNew.to];
      if (!notes) {
        // No release notes for this version — clear the flag silently
        chrome.storage.local.remove('_whatsNew');
        whatsNewState.pending = false;
        return false;
      }

      // Precedence: a user who has not completed the base onboarding tour
      // sees the Welcome tour, never the upgrade bubble. The bubble assumes
      // the user already knows the panel — that assumption breaks for
      // upgraders who skipped onboarding on a previous version. Leave the
      // _whatsNew flag in storage so the bubble can announce the upgrade
      // on a later session, after Welcome has completed.
      const settings = await readSettings();
      const completedVersion =
        (settings && settings.onboardingCompletedVersion) || 0;
      const tourVersion =
        (window.OnboardingTour && window.OnboardingTour.TOUR_VERSION) || 0;
      if (tourVersion && completedVersion < tourVersion) {
        whatsNewState.pending = false;
        return false;
      }

      const opts = options || {};
      whatsNewState.trackEventFn = opts.trackEventFn || null;
      whatsNewState.hooks = opts.hooks || {};
      whatsNewState.version = _whatsNew.to;

      buildBubble(notes);
      whatsNewState.pending = false;
      trackAction('show');
      return true;
    } catch (_) {
      whatsNewState.pending = false;
      return false;
    }
  }

  // Read the persisted settings object. Kept inline to avoid coupling this
  // classic script to settings.js (which is an ES module). The shape we care
  // about is { onboardingCompletedVersion: number, ... }.
  async function readSettings() {
    try {
      const { settings } = await chrome.storage.local.get('settings');
      return settings || {};
    } catch (_) {
      return {};
    }
  }

  /**
   * Whether the What's New bubble is currently visible — or about to be.
   * Returns true synchronously from the moment checkAndShow() is called
   * until the bubble is mounted (or an early-return path resets pending),
   * so callers running in the same task-queue tick can defer correctly.
   */
  function isActive() {
    if (whatsNewState.pending) return true;
    return !!(whatsNewState.bubble && whatsNewState.bubble.classList.contains('visible'));
  }

  window.WhatsNew = {
    checkAndShow,
    isActive
  };
})();
