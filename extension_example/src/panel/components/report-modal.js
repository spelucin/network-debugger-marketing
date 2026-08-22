// ============================================================
// Report Modal — extracted from panel.js (Phase 4c)
// Multi-purpose modal: feedback, feature request, bug report,
// missing tool report. Handles type selection, form fields,
// and submission via Amplitude events.
// ============================================================

import { registerModalCloser, closeOtherModals } from './modal-utils.js';

let _deps;

/**
 * Initialize the report modal module with dependencies from panel.js.
 * Must be called after elements are defined.
 */
export function initReportModal(deps) {
  _deps = deps;
  setupReportListeners();
  registerModalCloser('report-modal-panel', closeReportModal);
}

// ----------------------------------------
// Constants
// ----------------------------------------

// Track current report type
let currentReportType = null;

// Fallback only — runtime prefers window.ReviewPrompt.CWS_REVIEW_URL.
const CWS_REVIEW_URL_FALLBACK = 'https://chromewebstore.google.com/detail/extension/bhdinplchmdmciglcpbjmeglbloekfgc/reviews';

// Cooldown after × / "No thanks" before the CTA re-surfaces.
// `rated: true` silences forever regardless; this only applies to dismisses.
const REVIEW_DISMISS_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Returns true if the given dismiss timestamp is still within the cooldown.
function isDismissActive(timestamp) {
  if (!timestamp || typeof timestamp !== 'number') return false;
  return (Date.now() - timestamp) < REVIEW_DISMISS_COOLDOWN_MS;
}

// Tracks whether review_prompt_shown has already been fired for the current
// modal open (landing) / current submission (post-submit) — avoids double-count.
let landingCtaShownTracked = false;
let postSubmitAskShownTracked = false;

function getCwsReviewUrl() {
  return (window.ReviewPrompt && window.ReviewPrompt.CWS_REVIEW_URL) || CWS_REVIEW_URL_FALLBACK;
}

async function readReviewState() {
  const RP = window.ReviewPrompt;
  if (!RP || typeof RP.getPersistedState !== 'function') return {};
  try { return await RP.getPersistedState(); } catch (_) { return {}; }
}

async function patchReviewState(patch) {
  const RP = window.ReviewPrompt;
  if (!RP || typeof RP.patchPersistedState !== 'function') return;
  try { await RP.patchPersistedState(patch); } catch (_) { /* non-critical */ }
}

function openCwsReviewTab() {
  try { window.open(getCwsReviewUrl(), '_blank', 'noopener'); } catch (_) { /* non-critical */ }
}

async function updateLandingReviewCtaVisibility() {
  const cta = document.getElementById('report-review-cta');
  if (!cta) return;
  const state = await readReviewState();
  const shouldShow = !(state.rated || isDismissActive(state.feedbackModalDismissedAt));
  cta.classList.toggle('hidden', !shouldShow);
  // Clear any lingering star hover state
  resetStarHoverState();
  if (shouldShow && !landingCtaShownTracked) {
    landingCtaShownTracked = true;
    _deps?.trackEvent?.('review_prompt_shown', { phase: 'feedback_modal' });
  }
}

function resetStarHoverState() {
  const row = document.getElementById('report-star-row');
  if (!row) return;
  row.querySelectorAll('.report-star').forEach(s => s.classList.remove('is-active'));
}

// Description text for each report type
const REPORT_DESCRIPTIONS = {
  feedback: 'Share your thoughts about Event Watcher. We read every piece of feedback.',
  feature: 'Suggest a new feature or improvement. Tell us what would make Event Watcher better for you.',
  bug: 'Found something broken? Describe the issue and we\'ll look into it.',
  tool: 'Can\'t find a tracking tool or endpoint? Let us know and we\'ll look into adding it.',
  consent: 'Think a tool is flagged under the wrong consent category? Let us know so we can fix it.'
};

// Header titles for each report type
const REPORT_TITLES = {
  feedback: 'General Feedback',
  feature: 'Feature Request',
  bug: 'Report a Bug',
  tool: 'Missing Tool',
  consent: 'Wrong Consent Category'
};

// Header icons for each report type (SVG)
const REPORT_ICONS = {
  feedback: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  feature: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/></svg>',
  bug: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 2l1.88 1.88M14.12 3.88L16 2M9 7.13v-1a3 3 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a6 6 0 0 1 12 0v3c0 3.3-2.7 6-6 6z"/><path d="M12 20v2M6 13H2M6 17H2M22 13h-4M22 17h-4"/></svg>',
  tool: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>',
  consent: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
};

// ----------------------------------------
// Report Modal Functions
// ----------------------------------------

// Update modal header (title and icon) based on type
function updateReportModalHeader(type) {
  const { elements } = _deps;
  if (elements.reportModalTitleText) {
    elements.reportModalTitleText.textContent = REPORT_TITLES[type] || 'Send Feedback';
  }
  if (elements.reportModalIcon) {
    elements.reportModalIcon.innerHTML = REPORT_ICONS[type] || REPORT_ICONS.feedback;
  }
}

// Show the appropriate field group for the selected type
function showReportFields(type) {
  const { elements } = _deps;
  currentReportType = type;

  // Hide all field groups (using classList to properly override .hidden class)
  elements.reportFieldsFeedback.classList.add('hidden');
  elements.reportFieldsFeature.classList.add('hidden');
  elements.reportFieldsBug.classList.add('hidden');
  elements.reportFieldsTool.classList.add('hidden');
  elements.reportFieldsConsent.classList.add('hidden');

  // Show the selected one
  const fieldMap = {
    feedback: elements.reportFieldsFeedback,
    feature: elements.reportFieldsFeature,
    bug: elements.reportFieldsBug,
    tool: elements.reportFieldsTool,
    consent: elements.reportFieldsConsent
  };
  if (fieldMap[type]) {
    fieldMap[type].classList.remove('hidden');
  }

  // Update description
  if (elements.reportModalDesc) {
    elements.reportModalDesc.textContent = REPORT_DESCRIPTIONS[type] || '';
  }

  // Update header title and icon
  updateReportModalHeader(type);

  // Update active button in type selector bar
  elements.reportTypeSelector?.querySelectorAll('.report-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
}

// Select a report type (from cards or selector bar)
function selectReportType(type, trackStart = true) {
  const { elements } = _deps;
  currentReportType = type;

  // Hide type cards + landing review CTA, show form container
  if (elements.reportTypeCards) {
    elements.reportTypeCards.style.display = 'none';
  }
  const landingCta = document.getElementById('report-review-cta');
  if (landingCta) landingCta.classList.add('hidden');
  if (elements.reportFormContainer) {
    elements.reportFormContainer.classList.add('show');
  }

  // Show appropriate fields
  showReportFields(type);

  // Pre-fill website for bug, tool, and consent types
  if (type === 'bug' || type === 'tool' || type === 'consent') {
    try {
      chrome.devtools.inspectedWindow.eval('location.hostname', (result, isException) => {  // eslint-disable-line no-eval -- DevTools API, not arbitrary eval
        if (!isException && result) {
          if (type === 'bug' && elements.reportBugWebsite) {
            elements.reportBugWebsite.value = result;
          } else if (type === 'tool' && elements.reportToolWebsite) {
            elements.reportToolWebsite.value = result;
          } else if (type === 'consent' && elements.reportConsentWebsite) {
            elements.reportConsentWebsite.value = result;
          }
        }
      });
    } catch (e) { /* ignore */ }
  }

  // Track start event
  if (trackStart) {
    _deps.trackEvent('report_start', {
      report_type: type
    });
  }
}

export function openReportModal(preselectedType = null) {
  const { elements } = _deps;
  closeOtherModals('report-modal-panel');
  elements.reportModalPanel.classList.add('open');

  // Reset form and any per-open CTA tracking
  elements.reportModalForm.reset();
  elements.reportModalSuccess.classList.remove('show');
  landingCtaShownTracked = false;
  postSubmitAskShownTracked = false;
  // Reset success screen back to its default (hide post-submit ask, show minimal)
  const postSubmitAsk = document.getElementById('report-submit-review-ask');
  const successMinimal = document.getElementById('report-modal-success-minimal');
  if (postSubmitAsk) postSubmitAsk.classList.add('hidden');
  if (successMinimal) successMinimal.classList.remove('hidden');

  // Always start with the landing CTA hidden; only the cards-view branch
  // toggles it on based on persisted state. Avoids a race where the async
  // visibility check resolves after selectReportType hides the form siblings.
  const landingCta = document.getElementById('report-review-cta');
  if (landingCta) landingCta.classList.add('hidden');

  if (preselectedType) {
    // Skip type selection, go directly to form
    if (elements.reportTypeCards) {
      elements.reportTypeCards.style.display = 'none';
    }
    if (elements.reportFormContainer) {
      elements.reportFormContainer.classList.add('show');
    }
    selectReportType(preselectedType, true);
  } else {
    // Show type selection cards
    currentReportType = null;
    if (elements.reportTypeCards) {
      elements.reportTypeCards.style.display = '';
    }
    if (elements.reportFormContainer) {
      elements.reportFormContainer.classList.remove('show');
    }
    // Cards view — reveal the landing CTA if state permits.
    updateLandingReviewCtaVisibility();
    // Reset header to default
    if (elements.reportModalTitleText) {
      elements.reportModalTitleText.textContent = 'Send Feedback';
    }
    if (elements.reportModalIcon) {
      elements.reportModalIcon.innerHTML = REPORT_ICONS.feedback;
    }
  }

  _deps.trackEvent('report_modal', {
    action: 'open',
    report_type: preselectedType || null
  });
}

export function closeReportModal() {
  // Closes are intentionally not tracked — abandonment isn't a metric
  // for this surface and the paired open/close doubled event volume.
  // Same convention as `setting_modal` and `help_modal`. Submitted
  // reports are covered by `report_submit`.
  _deps.elements.reportModalPanel.classList.remove('open');
}

// ----------------------------------------
// Report Modal Event Listeners
// ----------------------------------------

function setupReportListeners() {
  const { elements } = _deps;

  // Type cards click handler (initial selection)
  if (elements.reportTypeCards) {
    elements.reportTypeCards.addEventListener('click', (e) => {
      const card = e.target.closest('.report-type-card');
      if (card && card.dataset.type) {
        selectReportType(card.dataset.type, true);
      }
    });
  }

  // Type selector bar click handler (allows changing type after selection)
  if (elements.reportTypeSelector) {
    elements.reportTypeSelector.addEventListener('click', (e) => {
      const btn = e.target.closest('.report-type-btn');
      if (btn && btn.dataset.type) {
        // Don't track start again when switching types
        showReportFields(btn.dataset.type);
      }
    });
  }

  // Open/close button handlers
  if (elements.reportModalBtn) {
    elements.reportModalBtn.addEventListener('click', () => {
      if (elements.reportModalPanel.classList.contains('open')) {
        closeReportModal();
      } else {
        openReportModal(); // No preselected type - show cards
      }
    });
  }

  if (elements.reportModalClose) {
    elements.reportModalClose.addEventListener('click', closeReportModal);
  }

  // Close when clicking backdrop
  elements.reportModalPanel?.addEventListener('click', (e) => {
    if (e.target === elements.reportModalPanel) {
      closeReportModal();
    }
  });

  // Form submission
  if (elements.reportModalForm) {
    elements.reportModalForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const commonProps = {
        report_type: currentReportType,
        name: (elements.reportContactName?.value || '').trim(),
        email: (elements.reportContactEmail?.value || '').trim()
      };

      let eventName;
      let eventProps;

      switch (currentReportType) {
        case 'feedback': {
          const subject = (elements.reportFeedbackSubject?.value || '').trim();
          const comment = (elements.reportFeedbackComment?.value || '').trim();
          if (!subject || !comment) return;
          eventName = 'report_submit';
          eventProps = { subject, comment, ...commonProps };
          break;
        }
        case 'feature': {
          const subject = (elements.reportFeatureSubject?.value || '').trim();
          const comment = (elements.reportFeatureComment?.value || '').trim();
          const why_needed = (elements.reportFeatureWhy?.value || '').trim();
          if (!subject || !comment) return;
          eventName = 'report_submit';
          eventProps = { subject, comment, why_needed, ...commonProps };
          break;
        }
        case 'bug': {
          const subject = (elements.reportBugSubject?.value || '').trim();
          const comment = (elements.reportBugComment?.value || '').trim();
          const website = (elements.reportBugWebsite?.value || '').trim();
          if (!subject || !comment) return;
          eventName = 'report_submit';
          eventProps = { subject, comment, website, ...commonProps };
          break;
        }
        case 'tool': {
          const subject = (elements.reportToolSubject?.value || '').trim();
          const category = (elements.reportToolCategory?.value || '').trim();
          const comment = (elements.reportToolComment?.value || '').trim();
          const website = (elements.reportToolWebsite?.value || '').trim();
          const endpoint_pattern = (elements.reportToolEndpoint?.value || '').trim();
          if (!subject) return;
          eventName = 'report_submit';
          eventProps = { subject, comment, website, endpoint_pattern, ...commonProps };
          if (category) eventProps.category = category;
          break;
        }
        case 'consent': {
          const tool = (elements.reportConsentTool?.value || '').trim();
          const current_category = (elements.reportConsentCurrent?.value || '').trim();
          const suggested_category = (elements.reportConsentSuggested?.value || '').trim();
          const website = (elements.reportConsentWebsite?.value || '').trim();
          const comment = (elements.reportConsentComment?.value || '').trim();
          if (!tool || !suggested_category) return;
          eventName = 'report_submit';
          eventProps = { subject: tool, current_category, suggested_category, website, comment, ...commonProps };
          break;
        }
        default:
          return;
      }

      // Set Amplitude user ID when email is provided
      if (commonProps.email) {
        _deps.setUserId(commonProps.email);
      }

      _deps.trackEvent(eventName, eventProps);

      // Show success, hide form container
      if (elements.reportFormContainer) {
        elements.reportFormContainer.classList.remove('show');
      }
      elements.reportModalSuccess.classList.add('show');

      // Decide: show post-submit review ask, or keep the original auto-close toast.
      showPostSubmitFlow();
    });
  }

  // Footer feedback link - opens feedback modal with all options
  if (elements.footerReportLink) {
    elements.footerReportLink.addEventListener('click', (e) => {
      e.preventDefault();
      openReportModal(); // No preselected type - show all 4 options
    });
  }

  // ----- Landing-screen review CTA: star row + dismiss × -----

  const starRow = document.getElementById('report-star-row');
  if (starRow) {
    const stars = Array.from(starRow.querySelectorAll('.report-star'));

    // Hover preview: fill stars up to and including hovered index
    starRow.addEventListener('mouseover', (e) => {
      const star = e.target.closest('.report-star');
      if (!star) return;
      const idx = Number(star.dataset.index) || 0;
      stars.forEach((s, i) => s.classList.toggle('is-active', i < idx));
    });
    starRow.addEventListener('mouseleave', () => resetStarHoverState());
    starRow.addEventListener('focusin', (e) => {
      const star = e.target.closest('.report-star');
      if (!star) return;
      const idx = Number(star.dataset.index) || 0;
      stars.forEach((s, i) => s.classList.toggle('is-active', i < idx));
    });
    starRow.addEventListener('focusout', () => resetStarHoverState());

    // Click any star → open CWS, persist rated, hide block, track
    starRow.addEventListener('click', async (e) => {
      const star = e.target.closest('.report-star');
      if (!star) return;
      const idx = Number(star.dataset.index) || 0;
      openCwsReviewTab();
      await patchReviewState({ rated: true, dismissedFinal: true });
      const cta = document.getElementById('report-review-cta');
      if (cta) cta.classList.add('hidden');
      _deps?.trackEvent?.('review_prompt_action', {
        action: 'rated_stars_inline',
        phase: 'feedback_modal',
        stars: idx
      });
    });
  }

  const dismissBtn = document.getElementById('report-review-cta-dismiss');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', async () => {
      await patchReviewState({ feedbackModalDismissedAt: Date.now() });
      const cta = document.getElementById('report-review-cta');
      if (cta) cta.classList.add('hidden');
      _deps?.trackEvent?.('review_prompt_action', {
        action: 'feedback_modal_dismissed',
        phase: 'feedback_modal'
      });
    });
  }

  // ----- Post-submit review ask: Leave a review / No thanks -----

  const reviewOpen = document.getElementById('report-submit-review-open');
  if (reviewOpen) {
    reviewOpen.addEventListener('click', async () => {
      openCwsReviewTab();
      await patchReviewState({ rated: true, dismissedFinal: true });
      _deps?.trackEvent?.('review_prompt_action', {
        action: 'rated_review_post_submit',
        phase: 'post_submit'
      });
      closeReportModal();
    });
  }

  const reviewDismiss = document.getElementById('report-submit-review-dismiss');
  if (reviewDismiss) {
    reviewDismiss.addEventListener('click', async () => {
      await patchReviewState({ postSubmitDismissedAt: Date.now() });
      _deps?.trackEvent?.('review_prompt_action', {
        action: 'post_submit_no_thanks',
        phase: 'post_submit'
      });
      closeReportModal();
    });
  }
}

// Decide what to show after a successful submission:
//   - If not suppressed → show review ask, no auto-close.
//   - If suppressed (already rated or dismissed post-submit) → minimal toast + 2s auto-close.
async function showPostSubmitFlow() {
  const ask = document.getElementById('report-submit-review-ask');
  const minimal = document.getElementById('report-modal-success-minimal');
  const state = await readReviewState();
  const suppressed = !!(state.rated || isDismissActive(state.postSubmitDismissedAt));

  if (suppressed || !ask) {
    if (ask) ask.classList.add('hidden');
    if (minimal) minimal.classList.remove('hidden');
    setTimeout(() => { closeReportModal(); }, 2000);
    return;
  }

  // Show review ask; minimal sits above as the checkmark headline.
  ask.classList.remove('hidden');
  if (minimal) minimal.classList.add('hidden');
  if (!postSubmitAskShownTracked) {
    postSubmitAskShownTracked = true;
    _deps?.trackEvent?.('review_prompt_shown', { phase: 'post_submit' });
  }
}
