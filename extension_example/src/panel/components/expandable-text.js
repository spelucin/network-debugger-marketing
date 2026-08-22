// Expandable Text Component
// Renders a long string truncated with an ellipsis. Click expands inline with
// word-wrap and reveals a copy icon; clicking outside collapses it back.
//
// State is persisted across re-renders via an `expandedKeys` Set, so a new
// event arriving in the stream does not collapse what the user just opened.
// Callers pass a stable `key` (typically `<eventId>:<role>`); the detail
// renderer wipes the set via `clearExpandedTextState()` when the user
// selects a different event.

const expandedKeys = new Set();

export function clearExpandedTextState() {
  expandedKeys.clear();
}

const COPY_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
</svg>`;

const CHECK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="20 6 9 17 4 12"/>
</svg>`;

function copyToClipboard(text, button) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    button.classList.add('copied');
    // Static SVG string controlled by this module — no user input.
    button.innerHTML = CHECK_SVG;
    button.title = 'Copied!';
    setTimeout(() => {
      button.classList.remove('copied');
      button.innerHTML = COPY_SVG;
      button.title = 'Copy';
    }, 1500);
  } catch (e) {
    // copy failed silently
  }
  document.body.removeChild(textarea);
}

/**
 * Create an inline expandable text element.
 * Collapsed: single-line ellipsis truncation.
 * Expanded: word-wraps to show the full value, with a copy button.
 * Clicking outside the element collapses it back.
 *
 * @param {string} fullText - The full text value (used for copy + expanded view)
 * @param {string} [displayText] - Optional shorter form shown when collapsed
 * @param {{ key?: string }} [options] - `key` enables expand state to survive
 *   re-renders. The detail renderer must call `clearExpandedTextState()` on
 *   event changes; otherwise omit `key` for ephemeral state.
 * @returns {HTMLElement}
 */
export function createExpandableText(fullText, displayText, options = {}) {
  const { key } = options;
  const wrapper = document.createElement('span');
  wrapper.className = 'expandable-text';

  const content = document.createElement('span');
  content.className = 'expandable-text-content';
  content.textContent = displayText || fullText;
  content.title = 'Click to expand';
  content.setAttribute('role', 'button');
  content.setAttribute('tabindex', '0');
  wrapper.appendChild(content);

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'expandable-text-copy';
  copyBtn.title = 'Copy';
  // Static SVG string controlled by this module — no user input.
  copyBtn.innerHTML = COPY_SVG;
  copyBtn.setAttribute('aria-label', 'Copy text');
  wrapper.appendChild(copyBtn);

  let outsideHandler = null;

  function collapse() {
    if (!wrapper.classList.contains('expanded')) return;
    wrapper.classList.remove('expanded');
    content.textContent = displayText || fullText;
    content.title = 'Click to expand';
    if (key) expandedKeys.delete(key);
    if (outsideHandler) {
      document.removeEventListener('mousedown', outsideHandler, true);
      outsideHandler = null;
    }
  }

  function expand() {
    if (wrapper.classList.contains('expanded')) return;
    wrapper.classList.add('expanded');
    content.textContent = fullText;
    content.title = '';
    if (key) expandedKeys.add(key);
    outsideHandler = (ev) => {
      if (!wrapper.contains(ev.target)) collapse();
    };
    document.addEventListener('mousedown', outsideHandler, true);
  }

  if (key && expandedKeys.has(key)) {
    // Restore expanded state after a re-render. Defer the outside-click
    // listener attach so it doesn't fire on the click that triggered the
    // re-render itself.
    wrapper.classList.add('expanded');
    content.textContent = fullText;
    content.title = '';
    outsideHandler = (ev) => {
      if (!wrapper.contains(ev.target)) collapse();
    };
    document.addEventListener('mousedown', outsideHandler, true);
  }

  content.addEventListener('click', (e) => {
    e.stopPropagation();
    if (wrapper.classList.contains('expanded')) return;
    expand();
  });

  content.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!wrapper.classList.contains('expanded')) expand();
    } else if (e.key === 'Escape' && wrapper.classList.contains('expanded')) {
      collapse();
    }
  });

  copyBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    copyToClipboard(fullText, copyBtn);
  });

  return wrapper;
}
