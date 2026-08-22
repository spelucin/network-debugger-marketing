/**
 * Review Prompt — engagement-gated Chrome Web Store review ask.
 *
 * Shows a centered bubble (reusing the onboarding tour CSS) once the user
 * has accumulated enough engagement on ANY of three independent signals:
 *   - DevTools panel opens (sessions)
 *   - Event selections in the stream / tool / page views (event_select)
 *   - Page loads observed
 *
 * Two-step NPS-style flow:
 *   Step 1: "Enjoying Event Watcher?" → Loving it / Not really
 *   Step 2A (Loving it):  Write a review / Just leave stars / Maybe later
 *   Step 2B (Not really): Send feedback (opens Report modal) / No thanks
 *
 * Trigger thresholds:
 *   First ask  — 10 panel opens OR 50 tool selects OR 50 page loads
 *   Second ask — 50 panel opens OR 250 tool selects OR 250 page loads
 *                (only for users who picked "Maybe later" — sentiment 'liked')
 * Anyone who picks "Not really", rates, or hits the second prompt is never
 * asked again.
 *
 * Copy intentionally avoids any explicit count — the local counters start at
 * 0 on the release that ships them, so existing users would see wrong
 * numbers. The thresholds are private gates, not surfaced milestones.
 *
 * Loaded as a classic (non-module) script. Exposes window.ReviewPrompt for panel.js.
 */
(function () {
  'use strict';

  const CWS_REVIEW_URL = 'https://chromewebstore.google.com/detail/extension/bhdinplchmdmciglcpbjmeglbloekfgc/reviews';

  // Static SVG constants — parsed via DOMParser, never rendered via innerHTML.
  const CWS_LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 190.5 190.5">'
    + '<circle fill="#fff" cx="95.25" cy="95.25" r="84"/>'
    + '<path fill="#DB4437" d="M95.25 26.47a68.78 68.78 0 0 1 60.06 34.93H95.25a33.85 33.85 0 0 0-29.31 16.97L35.29 61.4a68.78 68.78 0 0 1 59.96-34.93z"/>'
    + '<path fill="#0F9D58" d="M35.29 61.4l30.65 53.07a33.85 33.85 0 0 0 29.31 16.97h.01a33.7 33.7 0 0 0 10.67-1.74L85.46 163.5A68.78 68.78 0 0 1 35.29 61.4z"/>'
    + '<path fill="#FFCD40" d="M155.31 61.4a68.78 68.78 0 0 1-69.85 102.1l20.47-33.8a33.84 33.84 0 0 0 19.33-51.3l-.01-.02h30.06z"/>'
    + '<circle fill="#4285F4" cx="95.25" cy="95.25" r="28.12"/>'
    + '</svg>';

  const STAR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">'
    + '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'
    + '</svg>';

  const THRESHOLDS = {
    first:  { panelOpens: 10, toolSelects: 50,  pageLoads: 50  },
    second: { panelOpens: 50, toolSelects: 250, pageLoads: 250 }
  };

  const STORAGE_KEY = 'reviewPromptState';

  const DEFAULT_STATE = {
    shown: 0,
    lastShownAtCount: null,  // { panelOpens, toolSelects, pageLoads } at last show
    dismissedFinal: false,
    rated: false,
    sentiment: null
  };

  let promptState = {
    bubble: null,
    overlay: null,
    escHandler: null,
    trackEventFn: null,
    hooks: null,
    persisted: { ...DEFAULT_STATE },
    phase: null,         // 'first' | 'second'
    engagement: null     // snapshot of counts at show time
  };

  function normalizeEngagement(engagement) {
    return {
      panelOpenCount:  Math.max(0, Number(engagement?.panelOpenCount)  || 0),
      toolSelectCount: Math.max(0, Number(engagement?.toolSelectCount) || 0),
      pageLoadCount:   Math.max(0, Number(engagement?.pageLoadCount)   || 0)
    };
  }

  function meetsThreshold(engagement, t) {
    return engagement.panelOpenCount  >= t.panelOpens
        || engagement.toolSelectCount >= t.toolSelects
        || engagement.pageLoadCount   >= t.pageLoads;
  }

  /**
   * Pure trigger predicate — exported for unit tests.
   * @param {Object} engagement - { panelOpenCount, toolSelectCount, pageLoadCount }
   * @param {Object} state - persisted reviewPromptState
   * @param {Object} settings - { showReviewPrompt: boolean }
   * @returns {boolean}
   */
  function shouldShowReviewPrompt(engagement, state, settings) {
    if (!settings || settings.showReviewPrompt === false) return false;
    const s = { ...DEFAULT_STATE, ...(state || {}) };
    if (s.dismissedFinal || s.rated) return false;
    const e = normalizeEngagement(engagement);
    if (s.shown === 0 && meetsThreshold(e, THRESHOLDS.first)) return true;
    if (s.shown === 1 && meetsThreshold(e, THRESHOLDS.second) && s.sentiment !== 'not_really') return true;
    return false;
  }

  function pickPhase(state) {
    return state.shown === 0 ? 'first' : 'second';
  }

  async function loadPersistedState() {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      return { ...DEFAULT_STATE, ...(result[STORAGE_KEY] || {}) };
    } catch (_) {
      return { ...DEFAULT_STATE };
    }
  }

  async function savePersistedState(patch) {
    promptState.persisted = { ...promptState.persisted, ...patch };
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: promptState.persisted });
    } catch (_) { /* non-critical */ }
  }

  function trackAction(action, extra) {
    if (typeof promptState.trackEventFn !== 'function') return;
    try {
      promptState.trackEventFn('review_prompt_action', {
        action,
        phase: promptState.phase,
        ...(extra || {})
      });
    } catch (_) { /* non-critical */ }
  }

  function trackShown() {
    if (typeof promptState.trackEventFn !== 'function') return;
    const e = promptState.engagement || {};
    try {
      promptState.trackEventFn('review_prompt_shown', {
        action: 'shown',
        phase: promptState.phase,
        panel_opens:  e.panelOpenCount  || 0,
        tool_selects: e.toolSelectCount || 0,
        page_loads:   e.pageLoadCount   || 0
      });
    } catch (_) { /* non-critical */ }
  }

  // ----------------------------------------
  // Bubble construction
  // ----------------------------------------

  function buildShell() {
    const overlay = document.createElement('div');
    overlay.className = 'whats-new-overlay';

    const bubble = document.createElement('div');
    bubble.className = 'onboarding-bubble onboarding-bubble-large onboarding-bubble-centered visible';
    bubble.setAttribute('role', 'dialog');
    bubble.setAttribute('aria-modal', 'true');
    bubble.setAttribute('aria-labelledby', 'review-prompt-title');
    bubble.setAttribute('aria-describedby', 'review-prompt-body');

    const arrow = document.createElement('div');
    arrow.className = 'onboarding-bubble-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    bubble.appendChild(arrow);

    document.body.appendChild(overlay);
    document.body.appendChild(bubble);

    bubble.style.left = '50%';
    bubble.style.top = '50%';

    promptState.bubble = bubble;
    promptState.overlay = overlay;
    return bubble;
  }

  function clearBubbleBody() {
    const bubble = promptState.bubble;
    if (!bubble) return;
    while (bubble.firstChild) bubble.removeChild(bubble.firstChild);
  }

  function makeButton(label, variant) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const classes = ['onboarding-bubble-btn', 'onboarding-bubble-btn-large'];
    if (variant === 'primary') {
      classes.push('onboarding-bubble-next', 'onboarding-bubble-next-primary');
    } else {
      classes.push('onboarding-bubble-skip');
    }
    btn.className = classes.join(' ');
    btn.textContent = label;
    return btn;
  }


  // Parse a static SVG string into real DOM nodes (safe: no script execution).
  function svgFromString(svgString) {
    const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
    return doc.documentElement;
  }

  // Single-step prompt: Chrome Web Store logo + headline + star row + Maybe later.
  // Clicking any star opens the CWS reviews page and marks the user as rated
  // (permanent silence). "Maybe later" leaves sentiment null so the phase-2
  // reprompt can still fire at the higher thresholds. ESC behaves like Maybe later.
  function renderPrompt() {
    const bubble = promptState.bubble;
    if (!bubble) return;
    clearBubbleBody();

    const arrow = document.createElement('div');
    arrow.className = 'onboarding-bubble-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    bubble.appendChild(arrow);

    // Header: Chrome Web Store logo + title stack
    const header = document.createElement('div');
    header.className = 'review-prompt-header';

    const logo = document.createElement('span');
    logo.className = 'review-prompt-logo';
    logo.setAttribute('aria-hidden', 'true');
    logo.appendChild(svgFromString(CWS_LOGO_SVG));
    header.appendChild(logo);

    const titleStack = document.createElement('div');
    titleStack.className = 'review-prompt-title-stack';

    const titleEl = document.createElement('div');
    titleEl.className = 'onboarding-bubble-title';
    titleEl.id = 'review-prompt-title';
    titleEl.textContent = 'Enjoying Event Watcher?';
    titleStack.appendChild(titleEl);

    const subtitle = document.createElement('div');
    subtitle.className = 'review-prompt-subtitle';
    subtitle.textContent = 'Rate it on the Chrome Web Store';
    titleStack.appendChild(subtitle);

    header.appendChild(titleStack);
    bubble.appendChild(header);

    // Body
    const bodyEl = document.createElement('div');
    bodyEl.className = 'onboarding-bubble-body';
    bodyEl.id = 'review-prompt-body';
    const bodyP = document.createElement('p');
    bodyP.textContent = 'A quick review helps other developers find the extension.';
    bodyEl.appendChild(bodyP);
    bubble.appendChild(bodyEl);

    // Star row
    const starRow = document.createElement('div');
    starRow.className = 'review-prompt-stars';
    starRow.setAttribute('role', 'group');
    starRow.setAttribute('aria-label', 'Rate on Chrome Web Store');

    const starButtons = [];
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('button');
      star.type = 'button';
      star.className = 'review-prompt-star';
      star.dataset.index = String(i);
      star.setAttribute('aria-label', `${i} star${i === 1 ? '' : 's'}`);
      star.title = 'Rate on the Chrome Web Store';
      star.appendChild(svgFromString(STAR_SVG));
      star.addEventListener('click', async () => {
        trackAction('rated_stars', { stars: i });
        await savePersistedState({ rated: true, dismissedFinal: true });
        try { window.open(CWS_REVIEW_URL, '_blank', 'noopener'); } catch (_) { /* non-critical */ }
        dismiss();
      });
      starRow.appendChild(star);
      starButtons.push(star);
    }

    const setHoverTo = (idx) => {
      starButtons.forEach((btn, i) => btn.classList.toggle('is-active', i < idx));
    };
    starRow.addEventListener('mouseover', (e) => {
      const star = e.target.closest('.review-prompt-star');
      if (star) setHoverTo(Number(star.dataset.index) || 0);
    });
    starRow.addEventListener('mouseleave', () => setHoverTo(0));
    starRow.addEventListener('focusin', (e) => {
      const star = e.target.closest('.review-prompt-star');
      if (star) setHoverTo(Number(star.dataset.index) || 0);
    });
    starRow.addEventListener('focusout', () => setHoverTo(0));
    bubble.appendChild(starRow);

    // Footer — single "Maybe later" secondary button
    const footer = document.createElement('div');
    footer.className = 'onboarding-bubble-footer review-prompt-footer';
    const spacer = document.createElement('div');
    const controlsEl = document.createElement('div');
    controlsEl.className = 'onboarding-bubble-controls';

    const laterBtn = makeButton('Maybe later', 'secondary');
    laterBtn.addEventListener('click', () => {
      trackAction('maybe_later');
      // Don't set dismissedFinal — phase-2 reprompt may still fire.
      dismiss();
    });
    controlsEl.appendChild(laterBtn);

    footer.appendChild(spacer);
    footer.appendChild(controlsEl);
    bubble.appendChild(footer);

    if (starButtons[0]) starButtons[0].focus();
  }

  function dismiss() {
    if (promptState.bubble) {
      promptState.bubble.classList.remove('visible');
      const bubble = promptState.bubble;
      const overlay = promptState.overlay;
      setTimeout(() => {
        if (bubble && bubble.parentNode) bubble.parentNode.removeChild(bubble);
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
      promptState.bubble = null;
      promptState.overlay = null;
    }
    if (promptState.escHandler) {
      document.removeEventListener('keydown', promptState.escHandler);
      promptState.escHandler = null;
    }
  }

  function attachKeyHandlers() {
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        trackAction('dismiss_esc');
        // ESC on step 1 leaves dismissedFinal alone — same semantics as
        // "Maybe later" (counts toward shown, allows reprompt).
        dismiss();
      }
    };
    document.addEventListener('keydown', escHandler);
    promptState.escHandler = escHandler;

    const bubble = promptState.bubble;
    if (!bubble) return;
    bubble.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusable = bubble.querySelectorAll('button');
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
  }

  // ----------------------------------------
  // Public API
  // ----------------------------------------

  /**
   * Check trigger conditions and show the bubble if eligible.
   * @param {Object}   options
   * @param {Object}   options.engagement - { panelOpenCount, toolSelectCount, pageLoadCount }
   * @param {Object}   options.settings   - panel settings object (reads showReviewPrompt)
   * @param {Function} [options.trackEventFn]
   * @param {Object}   [options.hooks]    - { openReport }
   * @returns {Promise<boolean>} true if the bubble was shown
   */
  async function checkAndShow(options) {
    const opts = options || {};
    const engagement = normalizeEngagement(opts.engagement);
    const settings = opts.settings || {};

    // Don't stack on top of other modals/onboarding — defer to the next signal.
    try {
      if (window.WhatsNew && window.WhatsNew.isActive && window.WhatsNew.isActive()) return false;
    } catch (_) { /* ignore */ }
    try {
      if (window.OnboardingTour && window.OnboardingTour.isActive && window.OnboardingTour.isActive()) return false;
    } catch (_) { /* ignore */ }
    if (isActive()) return false;

    const persisted = await loadPersistedState();
    if (!shouldShowReviewPrompt(engagement, persisted, settings)) return false;

    promptState.persisted = persisted;
    promptState.trackEventFn = opts.trackEventFn || null;
    promptState.hooks = opts.hooks || {};
    promptState.phase = pickPhase(persisted);
    promptState.engagement = engagement;

    // Persist that we're showing it BEFORE rendering so a quick reload can't
    // re-show the same phase.
    await savePersistedState({
      shown: persisted.shown + 1,
      lastShownAtCount: engagement
    });

    buildShell();
    renderPrompt();
    attachKeyHandlers();
    trackShown();
    return true;
  }

  function isActive() {
    return !!(promptState.bubble && promptState.bubble.classList.contains('visible'));
  }

  // Expose async read/write so sibling features (e.g. feedback-modal review
  // CTAs) can share the same storage key without duplicating logic.
  async function getPersistedState() {
    return loadPersistedState();
  }

  async function patchPersistedState(patch) {
    const current = await loadPersistedState();
    const next = { ...current, ...(patch || {}) };
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: next });
    } catch (_) { /* non-critical */ }
    promptState.persisted = next;
    return next;
  }

  window.ReviewPrompt = {
    checkAndShow,
    isActive,
    shouldShowReviewPrompt,
    THRESHOLDS,
    STORAGE_KEY,
    DEFAULT_STATE,
    CWS_REVIEW_URL,
    getPersistedState,
    patchPersistedState
  };
})();
