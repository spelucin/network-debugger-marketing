/**
 * Styled confirm dialog — replacement for `window.confirm` when the action
 * is destructive enough that a native browser prompt feels jarring.
 *
 * Reuses the existing `.datalayer-edit-overlay` backdrop (so z-index, click
 * outside, and dark scrim are consistent with other panel modals) and ships
 * its own compact `.confirm-modal` box in panel.css.
 *
 * Usage:
 *   const ok = await showConfirmDialog({
 *     title: 'Delete group?',
 *     message: 'Removes the group and all N pinned events. Cannot be undone.',
 *     confirmLabel: 'Delete',
 *     danger: true,
 *   });
 *   if (!ok) return;
 */

/**
 * @param {object} opts
 * @param {string} opts.title         Headline (required).
 * @param {string} [opts.message]     Body copy (one or more sentences).
 * @param {string} [opts.confirmLabel='Confirm']
 * @param {string} [opts.cancelLabel='Cancel']
 * @param {boolean} [opts.danger=false] Render confirm button in destructive style.
 * @returns {Promise<boolean>} resolves true if the user confirmed, false otherwise.
 */
export function showConfirmDialog(opts) {
  return new Promise(resolve => {
    const title = String(opts && opts.title || '').trim();
    const message = String(opts && opts.message || '').trim();
    const confirmLabel = opts && opts.confirmLabel || 'Confirm';
    const cancelLabel = opts && opts.cancelLabel || 'Cancel';
    const danger = !!(opts && opts.danger);

    const overlay = document.createElement('div');
    overlay.className = 'datalayer-edit-overlay';

    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    modal.setAttribute('role', 'alertdialog');
    modal.setAttribute('aria-modal', 'true');

    if (title) {
      const h = document.createElement('div');
      h.className = 'confirm-modal-title';
      h.textContent = title;
      modal.appendChild(h);
    }

    if (message) {
      // Split on newlines so callers can write a two-line body with `\n`.
      for (const line of message.split('\n')) {
        if (!line.trim()) continue;
        const p = document.createElement('div');
        p.className = 'confirm-modal-body';
        p.textContent = line;
        modal.appendChild(p);
      }
    }

    const buttons = document.createElement('div');
    buttons.className = 'datalayer-edit-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-sm';
    cancelBtn.textContent = cancelLabel;

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = danger ? 'btn btn-sm btn-danger' : 'btn btn-sm btn-accent';
    confirmBtn.textContent = confirmLabel;

    function cleanup(result) {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(result);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
      else if (e.key === 'Enter') { e.preventDefault(); cleanup(true); }
    }

    cancelBtn.addEventListener('click', () => cleanup(false));
    confirmBtn.addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
    document.addEventListener('keydown', onKey, true);

    buttons.appendChild(cancelBtn);
    buttons.appendChild(confirmBtn);
    modal.appendChild(buttons);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    confirmBtn.focus();
  });
}

/**
 * Styled single-line text prompt — replacement for `window.prompt`.
 * Resolves with the trimmed input value on confirm, or null on cancel.
 * Enter confirms, Escape cancels. Empty / whitespace-only input is treated
 * as cancellation so callers don't need to revalidate.
 *
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.message]
 * @param {string} [opts.placeholder]
 * @param {string} [opts.initialValue='']
 * @param {string} [opts.confirmLabel='OK']
 * @param {string} [opts.cancelLabel='Cancel']
 * @param {number} [opts.maxLength=120]
 * @returns {Promise<string|null>}
 */
export function showPromptDialog(opts) {
  return new Promise(resolve => {
    const title = String(opts && opts.title || '').trim();
    const message = String(opts && opts.message || '').trim();
    const placeholder = String(opts && opts.placeholder || '');
    const initialValue = String(opts && opts.initialValue || '');
    const confirmLabel = opts && opts.confirmLabel || 'OK';
    const cancelLabel = opts && opts.cancelLabel || 'Cancel';
    const maxLength = (opts && Number.isFinite(opts.maxLength)) ? opts.maxLength : 120;

    const overlay = document.createElement('div');
    overlay.className = 'datalayer-edit-overlay';

    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    if (title) {
      const h = document.createElement('div');
      h.className = 'confirm-modal-title';
      h.textContent = title;
      modal.appendChild(h);
    }

    if (message) {
      const p = document.createElement('div');
      p.className = 'confirm-modal-body';
      p.textContent = message;
      modal.appendChild(p);
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'confirm-modal-input';
    input.placeholder = placeholder;
    input.value = initialValue;
    input.maxLength = maxLength;
    modal.appendChild(input);

    const buttons = document.createElement('div');
    buttons.className = 'datalayer-edit-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn btn-sm';
    cancelBtn.textContent = cancelLabel;

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn btn-sm btn-accent';
    confirmBtn.textContent = confirmLabel;

    function settle(result) {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(result);
    }
    function tryConfirm() {
      const trimmed = input.value.trim();
      settle(trimmed === '' ? null : trimmed);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); settle(null); }
      else if (e.key === 'Enter') { e.preventDefault(); tryConfirm(); }
    }
    function updateConfirmEnabled() {
      confirmBtn.disabled = input.value.trim() === '';
    }

    cancelBtn.addEventListener('click', () => settle(null));
    confirmBtn.addEventListener('click', () => tryConfirm());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) settle(null); });
    input.addEventListener('input', updateConfirmEnabled);
    document.addEventListener('keydown', onKey, true);

    buttons.appendChild(cancelBtn);
    buttons.appendChild(confirmBtn);
    modal.appendChild(buttons);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    updateConfirmEnabled();
    // Defer focus one tick so the modal is in the DOM before .focus() runs
    setTimeout(() => {
      input.focus();
      if (initialValue) input.select();
    }, 0);
  });
}
