/**
 * DOM-based HTML escaping shared by panel.js and the event-detail component.
 *
 * Sets textContent on a detached <div> and reads back innerHTML, letting the
 * browser handle entity encoding. Returns '' for null/undefined.
 *
 * Consolidated in Feature #144 from two functionally-equivalent local copies
 * (panel.js + components/event-detail.js).
 *
 * NOTE: this is deliberately NOT the markdown-render.js escapeHtml — that one
 * uses a regex variant that also escapes the apostrophe ('), which changes
 * rendered output. The two must stay separate.
 */
export function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}
