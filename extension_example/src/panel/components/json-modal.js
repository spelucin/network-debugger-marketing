// JSON Modal Component
// Opens any JSON payload in a tall, viewport-maximizing overlay using the
// shared collapsible tree renderer (json-viewer.js). Read-only companion to the
// inline section view — the "Expand" affordance on JSON section headers calls
// this so large payloads (e.g. a deep dataLayer.push) can be read without
// scrolling inside a cramped detail-view section.

import { renderJSON } from './json-viewer.js';

/**
 * Show a read-only JSON payload in a tall modal overlay.
 * Reuses renderJSON so the tree (colors, collapsibility, indent guides,
 * expand/collapse + copy toolbar, Labels) is identical to the inline view.
 * @param {string} title - Section title shown in the modal header
 * @param {Object|Array} data - The JSON payload to display
 * @param {Object} [options]
 * @param {string|null} [options.platformId] - Platform id for param-name Labels
 * @returns {{ overlay: HTMLElement, close: () => void }}
 */
export function showJsonModal(title, data, options = {}) {
  const { platformId = null } = options;

  const overlay = document.createElement('div');
  overlay.className = 'json-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'json-modal';

  // Header: title + close button
  const header = document.createElement('div');
  header.className = 'json-modal-header';

  const titleEl = document.createElement('span');
  titleEl.className = 'json-modal-title';
  titleEl.textContent = title;
  header.appendChild(titleEl);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'json-modal-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.title = 'Close (Esc)';
  closeBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  header.appendChild(closeBtn);

  modal.appendChild(header);

  // Body: scroll container hosting the shared JSON tree. renderJSON overwrites
  // its target's className with 'json-viewer', so render into an inner element
  // and let the body own the scroll/padding.
  const body = document.createElement('div');
  body.className = 'json-modal-body';
  const viewer = document.createElement('div');
  body.appendChild(viewer);
  renderJSON(viewer, data, { platformId, copyableData: data, sectionId: `modal:${title}` });
  modal.appendChild(body);

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', onKey);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Freeze the modal at the height it opened at. The shell first sizes to its
  // content (capped at 90vh by CSS); reading the rendered height forces layout,
  // and pinning it inline stops the modal from resizing/re-centering when the
  // user collapses or expands nodes inside (the body scrolls instead).
  const openedHeight = modal.getBoundingClientRect().height;
  if (openedHeight > 0) {
    modal.style.height = `${Math.round(openedHeight)}px`;
  }

  return { overlay, close };
}
