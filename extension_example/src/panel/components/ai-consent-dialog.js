// ============================================================
// AI Consent Dialog — first-time data-use disclosure.
//
// Shown once, before the extension is willing to store an AI key
// in chrome.storage.local. Required by Chrome Web Store in-product
// disclosure rules for BYOK features.
//
// Not a blocking modal of the whole panel — just a decision surface.
// Declining leaves ai_config untouched; accepting records consent and
// allows the caller to proceed with key storage.
// ============================================================

let _deps;

/**
 * @param {Object} deps
 * @param {Object} deps.elements - must include aiConsentDialog, aiConsentAccept, aiConsentCancel
 * @param {Function} deps.trackEvent
 */
export function initAiConsentDialog(deps) {
  _deps = deps;
}

/**
 * Show the dialog and resolve with true (accepted) or false (cancelled/closed).
 * Trap ESC + backdrop-click as cancel.
 */
export function requestAiConsent() {
  const { elements } = _deps;
  const dialog = elements.aiConsentDialog;
  if (!dialog) return Promise.resolve(false);

  dialog.classList.add('open');
  _deps.trackEvent('ai_provider', { action: 'consent_shown' });

  return new Promise((resolve) => {
    const cleanup = () => {
      dialog.classList.remove('open');
      elements.aiConsentAccept?.removeEventListener('click', onAccept);
      elements.aiConsentCancel?.removeEventListener('click', onCancel);
      dialog.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
    };
    const onAccept = () => {
      _deps.trackEvent('ai_provider', { action: 'consent_accepted' });
      cleanup();
      resolve(true);
    };
    const onCancel = () => {
      _deps.trackEvent('ai_provider', { action: 'consent_cancelled' });
      cleanup();
      resolve(false);
    };
    const onBackdrop = (e) => {
      if (e.target === dialog) onCancel();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };

    elements.aiConsentAccept?.addEventListener('click', onAccept);
    elements.aiConsentCancel?.addEventListener('click', onCancel);
    dialog.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
  });
}
