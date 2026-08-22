// ============================================================
// AI Chat Tab — free-form Q&A over the captured session.
//
// Lives in the AI Modal next to Provider and About, and is the
// default landing tab once the user has a provider configured (the
// modal opens to Provider only when setup is incomplete).
//
// The user types a question; the extension builds a JSON snapshot
// of the current session via shared/ai/context-serializer.js and
// sends it through the configured BYOK provider using the
// registered `ask` prompt template.
//
// Cost discipline:
//   - The snapshot (potentially 10–200 KB) is sent ONCE in turn 1.
//   - Follow-up turns send only the rolling user/assistant chat
//     history; the snapshot stays in the model's context from turn 1.
//   - "Refresh snapshot" wipes the conversation and rebuilds.
//
// Markdown safety: assistant turns are rendered through the local
// markdown-render.js sanitiser (escapes input, allows only a closed
// tag set, sanitises link schemes) before being inserted as HTML.
// User turns are inserted via textContent — never as HTML.
// ============================================================

import { renderMarkdown } from './markdown-render.js';
import { buildAiContextSnapshot } from '../../shared/ai/context-serializer.js';
import { MSG } from '../../shared/messages.js';
import { generateChatSuggestions, FALLBACK_SUGGESTIONS } from './ai-chat-suggestions.js';

const MAX_FOLLOWUP_TURNS = 12;

// Conversation persistence — chrome.storage.local. Cap is conservative
// because each entry includes the snapshot (10–200 KB) inside
// `initialMessages[1].content`. 5 × 200 KB worst case = 1 MB, well
// under chrome.storage.local's 10 MB quota.
const HISTORY_STORAGE_KEY = 'ai_chat_history';
const MAX_HISTORY = 5;
const TITLE_MAX_LENGTH = 60;
const AUTOSAVE_DEBOUNCE_MS = 300;

// Empty-state suggestions are generated locally on every paint via
// `generateChatSuggestions()` in ./ai-chat-suggestions.js. Rule-based,
// no AI calls — the user always owns the decision to spend tokens.

// Static SVG strings (no user data — safe to inject as innerHTML)
const SPINNER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="ai-summary-spinner" aria-hidden="true"><path d="M12 2a10 10 0 0 1 10 10"/></svg>';
const COPY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const SEND_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>';
const REFRESH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
const PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const HISTORY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
const CARET_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const X_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

let _deps;
const chatState = {
  id: null,             // assigned on first successful turn; same id reused across follow-ups so saves overwrite the right history entry
  snapshot: null,
  snapshotTakenAt: null,
  snapshotEventCount: 0,
  snapshotBytes: 0,
  useFilteredOnly: false,
  // When set (e.g. via "Start AI Chat for <group>"), the next snapshot is
  // built from the events returned by `_deps.getScopedEvents(scope)` instead
  // of the full session. Supported kinds: 'page' (carries `pageEventId`) and
  // — from feature #61 — 'tool' / 'domain' / 'event_name' / 'consent_category'
  // (each carries `eventIds` + `displayName`). Full-session default is
  // signalled by `scope: null`.
  scope: null,          // { kind: 'page', pageEventId } | { kind, eventIds, displayName } | null
  turns: [],            // [{role: 'user'|'assistant', text}]
  initialMessages: null, // [system, user] from `ask` template — used for follow-ups
  inflight: false,
  provider: null,
  model: null,
};

// Cached history (loaded from chrome.storage.local once on init, kept
// in-memory and re-saved as a whole on every change). Storage round-
// trips are async so we render off the cache for snappy UI.
let historyCache = [];
let historyDropdownOpen = false;
let autosaveTimer = null;

/**
 * Initialize the Chat tab. Called lazily by ai-modal.js the first
 * time the user activates the tab.
 *
 * @param {Object} deps
 * @param {Object} deps.elements - { aiTabChat }
 * @param {Function} deps.trackEvent
 * @param {Function} deps.getState - returns { events, consentTimeline, ... }
 * @param {Function} deps.getHelpers - returns { getPlatformName, getCategoryInfo, getConsentCheckForEvent }
 * @param {Function} deps.getFilteredEvents - returns the currently filtered events
 * @param {Function} deps.getGenerator - returns { name, version }
 */
export function initAiChatTab(deps) {
  _deps = deps;
  paint();
  _deps.trackEvent('ai_chat', { action: 'opened' });
  // Load history from storage in the background; repaint once it's
  // ready so the History (N) chip reflects the real count.
  loadHistory().then((loaded) => {
    historyCache = loaded;
    paint();
  });
}

// ─── Painting ────────────────────────────────────────────────────────────────

function paint() {
  const container = _deps?.elements?.aiTabChat;
  if (!container) return;
  container.replaceChildren();

  container.appendChild(buildHistoryBar());
  container.appendChild(buildSnapshotBar());
  container.appendChild(buildThread());
  // History dropdown is rendered as a popover absolutely positioned
  // relative to its trigger; mount inside the tab container so it
  // shares the modal's stacking context.
  if (historyDropdownOpen) container.appendChild(buildHistoryDropdown());
  container.appendChild(buildChatInput());
}

function buildHistoryBar() {
  const bar = document.createElement('div');
  bar.className = 'ai-chat-history-bar';

  const newBtn = document.createElement('button');
  newBtn.type = 'button';
  newBtn.className = 'btn btn-secondary ai-chat-history-new';
  newBtn.title = 'Start a fresh conversation. The current one is saved to History.';
  newBtn.setAttribute('aria-label', 'Start a fresh conversation. The current one is saved to History.');
  newBtn.insertAdjacentHTML('afterbegin', PLUS_SVG);
  const newLabel = document.createElement('span');
  newLabel.textContent = 'New chat';
  newBtn.appendChild(newLabel);
  newBtn.disabled = chatState.inflight;
  newBtn.addEventListener('click', startNewChat);
  bar.appendChild(newBtn);

  const historyBtn = document.createElement('button');
  historyBtn.type = 'button';
  historyBtn.className = 'btn btn-secondary ai-chat-history-toggle';
  if (historyDropdownOpen) historyBtn.classList.add('open');
  historyBtn.disabled = chatState.inflight;
  historyBtn.setAttribute('aria-expanded', historyDropdownOpen ? 'true' : 'false');

  const histIcon = document.createElement('span');
  histIcon.className = 'ai-chat-history-icon';
  histIcon.insertAdjacentHTML('afterbegin', HISTORY_SVG);
  historyBtn.appendChild(histIcon);

  const histLabel = document.createElement('span');
  const count = historyCache.length;
  historyBtn.title = count > 0
    ? `Open one of your ${count} saved conversation${count === 1 ? '' : 's'}.`
    : 'No saved conversations yet — they\'ll appear here after you ask a question.';
  historyBtn.setAttribute('aria-label', historyBtn.title);
  histLabel.textContent = count > 0 ? `History (${count})` : 'History';
  historyBtn.appendChild(histLabel);

  const caret = document.createElement('span');
  caret.className = 'ai-chat-history-caret';
  caret.insertAdjacentHTML('afterbegin', CARET_SVG);
  historyBtn.appendChild(caret);

  if (count === 0) historyBtn.disabled = true;
  historyBtn.addEventListener('click', () => {
    historyDropdownOpen = !historyDropdownOpen;
    paint();
  });
  bar.appendChild(historyBtn);

  return bar;
}

function buildHistoryDropdown() {
  const dropdown = document.createElement('div');
  dropdown.className = 'ai-chat-history-dropdown';

  if (historyCache.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'ai-chat-history-empty';
    empty.textContent = 'No saved conversations yet.';
    dropdown.appendChild(empty);
    return dropdown;
  }

  // Most recent first
  const sorted = [...historyCache].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  for (const entry of sorted) {
    const row = document.createElement('div');
    row.className = 'ai-chat-history-row';
    if (entry.id === chatState.id) row.classList.add('active');

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'ai-chat-history-row-load';
    main.title = `Load this conversation (${entry.turns?.length || 0} turns)`;

    const title = document.createElement('span');
    title.className = 'ai-chat-history-row-title';
    title.textContent = entry.title || '(no title)';
    main.appendChild(title);

    const ageEl = document.createElement('span');
    ageEl.className = 'ai-chat-history-row-age';
    ageEl.textContent = describeAge(Date.now() - (entry.updatedAt || entry.createdAt || 0));
    main.appendChild(ageEl);

    main.addEventListener('click', () => loadFromHistory(entry.id));
    row.appendChild(main);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'ai-chat-history-row-delete';
    delBtn.title = 'Delete this conversation';
    delBtn.setAttribute('aria-label', 'Delete this conversation');
    delBtn.insertAdjacentHTML('afterbegin', X_SVG);
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteFromHistory(entry.id);
    });
    row.appendChild(delBtn);

    dropdown.appendChild(row);
  }

  return dropdown;
}

// Map a scope.kind to the chip label prefix shown above the snapshot bar.
// `kind: 'page'` is the original page-context scope; the rest were added by
// feature #61's unified group menu (Tool / Domain / Event Name / Consent
// Category headers). Unknown kinds collapse to "Custom" so the chip always
// renders something meaningful.
const SCOPE_KIND_LABELS = {
  page: 'Page',
  tool: 'Tool',
  domain: 'Domain',
  event_name: 'Event',
  consent_category: 'Consent',
};

// Compare two `eventIds` arrays cheaply for the `applyChatScope` no-op check.
// Both sides may be undefined (e.g. for `kind: 'page'` scopes); treat that as
// equal. Order matters because the menu always builds the list deterministically.
function eventIdsMatch(a, b) {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function formatScopeChipLabel(scope) {
  const prefix = SCOPE_KIND_LABELS[scope.kind] || 'Custom';
  // Feature #61 scopes carry a `displayName` for the clicked group (e.g.
  // "Advertising", "purchase", "Marketing"). Append it so the chip reads
  // "Tool: Advertising" rather than just "Tool".
  if (scope.displayName) return `Scope: ${prefix}: ${scope.displayName}`;
  return `Scope: ${prefix}`;
}

function buildSnapshotBar() {
  const bar = document.createElement('div');
  bar.className = 'ai-chat-snapshot-bar';

  const meta = document.createElement('div');
  meta.className = 'ai-chat-snapshot-meta';

  // Scope chip — visible only for non-session scopes, so the default
  // (full-session) chat stays clutter-free. The chip lets the user see
  // what they're chatting about and clear the scope back to session-
  // wide in one click.
  if (chatState.scope) {
    const chip = document.createElement('span');
    chip.className = 'ai-chat-scope-chip';
    chip.title = 'This chat is scoped to a subset of the session. Click to clear and return to the full session.';
    const chipLabel = document.createElement('span');
    chipLabel.className = 'ai-chat-scope-chip-label';
    chipLabel.textContent = formatScopeChipLabel(chatState.scope);
    chip.appendChild(chipLabel);
    const chipClear = document.createElement('button');
    chipClear.type = 'button';
    chipClear.className = 'ai-chat-scope-chip-clear';
    chipClear.setAttribute('aria-label', 'Clear scope');
    chipClear.insertAdjacentHTML('afterbegin', X_SVG);
    chipClear.addEventListener('click', () => applyChatScope(null));
    chip.appendChild(chipClear);
    meta.appendChild(chip);

    const sep = document.createElement('span');
    sep.className = 'ai-chat-snapshot-sep';
    sep.textContent = '·';
    meta.appendChild(sep);
  }

  if (chatState.snapshot) {
    const sizeKB = Math.max(1, Math.round(chatState.snapshotBytes / 1024));
    const sizeClass = classifySize(chatState.snapshotBytes);

    const eventsSpan = document.createElement('span');
    eventsSpan.className = 'ai-chat-snapshot-meta-item';
    eventsSpan.textContent = `${chatState.snapshotEventCount} events`;
    meta.appendChild(eventsSpan);

    const sep1 = document.createElement('span');
    sep1.className = 'ai-chat-snapshot-sep';
    sep1.textContent = '·';
    meta.appendChild(sep1);

    const sizeSpan = document.createElement('span');
    sizeSpan.className = `ai-chat-snapshot-size ai-chat-snapshot-size--${sizeClass}`;
    sizeSpan.textContent = `~${sizeKB} KB`;
    if (sizeClass !== 'ok') {
      sizeSpan.title = sizeClass === 'red'
        ? 'Snapshot is large — token costs add up fast. Use the filter to scope it down.'
        : 'Snapshot is getting big. Consider using the filter to scope it down.';
    }
    meta.appendChild(sizeSpan);

    const sep2 = document.createElement('span');
    sep2.className = 'ai-chat-snapshot-sep';
    sep2.textContent = '·';
    meta.appendChild(sep2);

    const ageSpan = document.createElement('span');
    ageSpan.className = 'ai-chat-snapshot-age';
    ageSpan.textContent = describeAge(Date.now() - chatState.snapshotTakenAt);
    meta.appendChild(ageSpan);
  } else {
    const empty = document.createElement('span');
    empty.className = 'ai-chat-snapshot-empty';
    empty.textContent = 'No snapshot yet — built when you ask the first question.';
    meta.appendChild(empty);
  }

  const controls = document.createElement('div');
  controls.className = 'ai-chat-snapshot-controls';

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'btn btn-secondary ai-chat-snapshot-refresh';
  refreshBtn.title = 'Take a fresh snapshot. Clears the current conversation.';
  refreshBtn.setAttribute('aria-label', 'Take a fresh snapshot. Clears the current conversation.');
  refreshBtn.insertAdjacentHTML('afterbegin', REFRESH_SVG);
  const refreshLabel = document.createElement('span');
  refreshLabel.textContent = 'Refresh';
  refreshBtn.appendChild(refreshLabel);
  refreshBtn.disabled = chatState.inflight;
  refreshBtn.addEventListener('click', refreshSnapshot);
  controls.appendChild(refreshBtn);

  const filterToggle = document.createElement('label');
  filterToggle.className = 'ai-chat-filter-toggle';
  filterToggle.title = 'Build the snapshot from the currently filtered events only, instead of every captured event.';
  const filterInput = document.createElement('input');
  filterInput.type = 'checkbox';
  filterInput.checked = chatState.useFilteredOnly;
  filterInput.addEventListener('change', () => {
    chatState.useFilteredOnly = filterInput.checked;
    if (chatState.snapshot) {
      chatState.snapshot = null;
      chatState.snapshotTakenAt = null;
      paint();
    }
  });
  filterToggle.appendChild(filterInput);
  const filterLabel = document.createElement('span');
  filterLabel.textContent = 'Use filtered only';
  filterToggle.appendChild(filterLabel);
  controls.appendChild(filterToggle);

  bar.appendChild(meta);
  bar.appendChild(controls);
  return bar;
}

function buildThread() {
  const wrap = document.createElement('div');
  wrap.className = 'ai-chat-thread';

  if (chatState.turns.length === 0 && !chatState.inflight) {
    wrap.appendChild(buildEmptyState());
    return wrap;
  }

  // Conversation thread — reuses the .ai-summary-turn* CSS classes
  // for visual consistency with the Event Explainer chat. The classes
  // are role-agnostic; renaming to .ai-chat-* is a future cleanup.
  const thread = document.createElement('div');
  thread.className = 'ai-summary-thread';
  for (let i = 0; i < chatState.turns.length; i++) {
    thread.appendChild(buildTurnBlock(chatState.turns[i], i === 0));
  }
  wrap.appendChild(thread);

  if (chatState.inflight) {
    const loading = document.createElement('div');
    loading.className = 'ai-summary-loading';
    const spinner = document.createElement('span');
    spinner.className = 'ai-summary-spinner-wrap';
    spinner.insertAdjacentHTML('afterbegin', SPINNER_SVG);
    loading.appendChild(spinner);
    const msg = document.createElement('span');
    msg.textContent = 'Thinking…';
    loading.appendChild(msg);
    wrap.appendChild(loading);
  } else if (chatState.provider) {
    const meta = document.createElement('div');
    meta.className = 'ai-summary-meta';
    const provider = chatState.provider || 'AI';
    const model = chatState.model ? ` · ${chatState.model}` : '';
    meta.textContent = `Generated by ${provider}${model}`;
    wrap.appendChild(meta);

    if (chatState.turns.length > 0) {
      const actions = document.createElement('div');
      actions.className = 'ai-summary-actions';
      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'btn btn-secondary';
      clearBtn.textContent = 'Clear conversation';
      clearBtn.addEventListener('click', clearConversation);
      actions.appendChild(clearBtn);
      wrap.appendChild(actions);
    }
  }

  return wrap;
}

function buildEmptyState() {
  const empty = document.createElement('div');
  empty.className = 'ai-chat-empty';

  const heading = document.createElement('p');
  heading.className = 'ai-chat-empty-heading';
  heading.textContent = 'Ask a free-form question about everything captured in this session.';
  empty.appendChild(heading);

  const sub = document.createElement('p');
  sub.className = 'ai-chat-empty-sub';
  sub.textContent = 'Try one of these to get started — you can edit before sending:';
  empty.appendChild(sub);

  // Suggestions are computed locally from the captured session (no AI
  // call) so the user stays in control of token spend. Rule-based —
  // see ai-chat-suggestions.js for the rule list.
  const events = (_deps.getState && _deps.getState().events) || [];
  const helpers = (_deps.getHelpers && _deps.getHelpers()) || {};
  let prompts;
  try {
    prompts = generateChatSuggestions({ events, helpers });
  } catch {
    prompts = FALLBACK_SUGGESTIONS.slice(0, 5);
  }

  const list = document.createElement('div');
  list.className = 'ai-chat-suggestions';
  for (const prompt of prompts) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'ai-chat-suggestion';
    chip.textContent = prompt;
    chip.addEventListener('click', () => {
      const input = document.querySelector('.ai-chat-input');
      if (input) {
        input.value = prompt;
        input.focus();
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      _deps.trackEvent('ai_chat', { action: 'suggestion_used' });
    });
    list.appendChild(chip);
  }
  empty.appendChild(list);

  return empty;
}

function buildTurnBlock(turn, isFirst) {
  const block = document.createElement('div');
  block.className = `ai-summary-turn ai-summary-turn--${turn.role}`;
  if (isFirst && turn.role === 'assistant') block.classList.add('ai-summary-turn--first');

  const head = document.createElement('div');
  head.className = 'ai-summary-turn-head';

  const role = document.createElement('span');
  role.className = 'ai-summary-turn-role';
  role.textContent = turn.role === 'user' ? 'You' : 'AI';
  head.appendChild(role);

  if (turn.role === 'assistant') {
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn-icon ai-summary-copy-btn';
    copyBtn.title = 'Copy reply to clipboard';
    copyBtn.setAttribute('aria-label', 'Copy reply to clipboard');
    copyBtn.setAttribute('aria-label', 'Copy reply to clipboard');
    copyBtn.insertAdjacentHTML('afterbegin', COPY_SVG);
    copyBtn.addEventListener('click', () => copyTurnText(turn.text || '', copyBtn));
    head.appendChild(copyBtn);
  }
  block.appendChild(head);

  const body = document.createElement('div');
  body.className = 'ai-summary-turn-body';
  if (turn.role === 'assistant') {
    // Markdown output is sanitised by renderMarkdown — see
    // markdown-render.js for the closed-tag whitelist + URL scheme
    // validation. insertAdjacentHTML is equivalent to innerHTML here
    // (the body element is freshly created and empty).
    body.insertAdjacentHTML('afterbegin', renderMarkdown(turn.text || ''));
  } else {
    // User input shown verbatim, never as HTML
    body.textContent = turn.text || '';
  }
  block.appendChild(body);

  return block;
}

function buildChatInput() {
  const wrap = document.createElement('div');
  wrap.className = 'ai-summary-followup ai-chat-followup';

  const ta = document.createElement('textarea');
  ta.className = 'ai-summary-followup-input ai-chat-input';
  ta.rows = 2;
  ta.placeholder = chatState.turns.length === 0
    ? 'Ask anything about this captured session…'
    : 'Ask a follow-up about this session…';
  ta.setAttribute('aria-label', 'Chat question');
  wrap.appendChild(ta);

  const sendBtn = document.createElement('button');
  sendBtn.type = 'button';
  sendBtn.className = 'btn btn-primary ai-summary-followup-send';
  sendBtn.disabled = true;
  sendBtn.title = 'Send (Ctrl/Cmd+Enter)';
  sendBtn.setAttribute('aria-label', 'Send (Ctrl/Cmd+Enter)');
  sendBtn.setAttribute('aria-label', 'Send');
  sendBtn.insertAdjacentHTML('afterbegin', SEND_SVG);
  const sendLabel = document.createElement('span');
  sendLabel.textContent = 'Send';
  sendBtn.appendChild(sendLabel);
  wrap.appendChild(sendBtn);

  // Cap notice when we've maxed out follow-ups
  const userTurnCount = chatState.turns.filter((t) => t.role === 'user').length;
  if (userTurnCount >= MAX_FOLLOWUP_TURNS) {
    ta.disabled = true;
    sendBtn.disabled = true;
    const cap = document.createElement('p');
    cap.className = 'ai-summary-cap-notice ai-chat-cap-notice';
    cap.textContent = `Reached the ${MAX_FOLLOWUP_TURNS}-message limit. Use Refresh to start fresh.`;
    wrap.appendChild(cap);
    return wrap;
  }

  const updateState = () => {
    sendBtn.disabled = ta.value.trim().length === 0 || chatState.inflight;
  };
  ta.addEventListener('input', updateState);
  ta.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !sendBtn.disabled) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  sendBtn.addEventListener('click', () => {
    const text = ta.value.trim();
    if (!text) return;
    ta.value = '';
    updateState();
    sendQuestion(text);
  });

  return wrap;
}

// ─── Snapshot lifecycle ─────────────────────────────────────────────────────

function takeSnapshot() {
  const state = _deps.getState();
  const helpers = _deps.getHelpers();

  // Source-of-events precedence: scope wins over the filtered-only
  // toggle. A page-scoped chat is opt-in from a context menu and should
  // see the page's events regardless of what the user left the toolbar
  // filters set to. If the scope resolver fails or returns [], fall
  // through to the regular session/filtered source so the chat is
  // still useful (the snapshot meta will show the event count).
  let events = null;
  if (chatState.scope && typeof _deps.getScopedEvents === 'function') {
    try {
      const scoped = _deps.getScopedEvents(chatState.scope);
      if (Array.isArray(scoped) && scoped.length > 0) events = scoped;
    } catch {
      /* fall through to default */
    }
  }
  if (events === null) {
    events = chatState.useFilteredOnly && _deps.getFilteredEvents
      ? _deps.getFilteredEvents()
      : (state.events || []);
  }

  const consentTimeline = state.consentTimeline || [];
  const generator = typeof _deps.getGenerator === 'function'
    ? _deps.getGenerator()
    : { name: 'Event Watcher', version: 'unknown' };

  const snapshot = buildAiContextSnapshot({
    events,
    consentTimeline,
    session: { startedAt: state.captureStartedAt || null },
    generator,
    helpers,
  });

  const json = JSON.stringify(snapshot);
  chatState.snapshot = snapshot;
  chatState.snapshotTakenAt = Date.now();
  chatState.snapshotEventCount = Array.isArray(snapshot.events) ? snapshot.events.length : events.length;
  chatState.snapshotBytes = json.length;
  return snapshot;
}

/**
 * Apply a chat scope chosen from outside the modal (e.g. the page
 * context menu's "Start AI Chat for Page"). Resets the current
 * conversation so the incoming scope actually takes effect — an in-
 * progress chat would otherwise stay pinned to its old snapshot.
 * Passing `null` clears the scope and returns the chat to session-wide
 * default on the next question.
 *
 * @param {{kind: 'page', pageEventId: string}|{kind: string, eventIds: string[], displayName?: string}|null} scope
 */
export function applyChatScope(scope) {
  // Ignore no-op re-applies — re-opening the modal shouldn't wipe the
  // user's in-progress conversation just because the scope object is
  // the same. Compare by kind plus the kind-specific identifier so
  // the check works for both `page` (pageEventId) and #61 group scopes
  // (eventIds list).
  const sameScope =
    (scope === null && chatState.scope === null)
    || (scope && chatState.scope
        && scope.kind === chatState.scope.kind
        && scope.pageEventId === chatState.scope.pageEventId
        && eventIdsMatch(scope.eventIds, chatState.scope.eventIds));
  if (sameScope) return;

  chatState.scope = scope || null;
  // Wipe any in-flight conversation — the snapshot is about to change,
  // so existing turns would reference data that's no longer in context.
  chatState.id = null;
  chatState.turns = [];
  chatState.initialMessages = null;
  chatState.snapshot = null;
  chatState.snapshotTakenAt = null;
  chatState.snapshotEventCount = 0;
  chatState.snapshotBytes = 0;
  chatState.provider = null;
  chatState.model = null;
  if (_deps?.trackEvent) {
    _deps.trackEvent('ai_chat', {
      action: 'scope_applied',
      scope_kind: scope?.kind || 'session',
    });
  }
  paint();
}

async function refreshSnapshot() {
  if (chatState.turns.length > 0) {
    const ok = window.confirm('Refreshing the snapshot will clear the current conversation. Continue?');
    if (!ok) return;
    // Flush autosave so the just-cleared conversation is in history
    if (autosaveTimer) {
      clearTimeout(autosaveTimer);
      autosaveTimer = null;
      await persistCurrent();
    }
  }
  chatState.id = null; // next turn starts a new history entry
  chatState.turns = [];
  chatState.initialMessages = null;
  chatState.provider = null;
  chatState.model = null;
  takeSnapshot();
  _deps.trackEvent('ai_chat', {
    action: 'refresh_snapshot',
    snapshot_event_count: chatState.snapshotEventCount,
    snapshot_size_kb: Math.max(1, Math.round(chatState.snapshotBytes / 1024)),
    snapshot_filtered: chatState.useFilteredOnly,
  });
  paint();
}

async function clearConversation() {
  if (chatState.turns.length === 0) return;
  const ok = window.confirm('Clear the conversation? It is saved to chat History (last 5) before clearing, and the snapshot stays so the next question can reuse it.');
  if (!ok) return;
  // Persist before wiping so the cleared chat lives on in History
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
  await persistCurrent();
  chatState.id = null; // next turn starts a new history entry
  chatState.turns = [];
  chatState.initialMessages = null;
  chatState.provider = null;
  chatState.model = null;
  _deps.trackEvent('ai_chat', { action: 'clear_conversation' });
  paint();
}

// ─── Question / follow-up flow ──────────────────────────────────────────────

async function sendQuestion(question) {
  // Optimistically append the user turn so it shows up immediately
  chatState.turns.push({ role: 'user', text: question });
  chatState.inflight = true;
  paint();

  let payload;
  let isInitialTurn;
  if (!chatState.initialMessages) {
    if (!chatState.snapshot) takeSnapshot();
    payload = {
      promptType: 'ask',
      data: { question, snapshot: chatState.snapshot },
    };
    isInitialTurn = true;
  } else {
    payload = {
      messages: buildFollowupMessages(chatState.initialMessages, chatState.turns),
    };
    isInitialTurn = false;
  }

  const response = await sendAIRequest(payload);
  chatState.inflight = false;

  if (!response.success) {
    chatState.turns.pop(); // roll back optimistic user turn so they can retry
    paint();
    showError(response);
    _deps.trackEvent('ai_chat', {
      action: 'prompt_error',
      error_type: response.error,
      turn_count: chatState.turns.length,
    });
    return;
  }

  if (isInitialTurn) {
    chatState.initialMessages = response.messages || [];
  }
  chatState.turns.push({ role: 'assistant', text: response.text || '' });
  chatState.provider = response.provider || chatState.provider;
  chatState.model = response.model || chatState.model;
  paint();

  // Persist after each successful turn — debounced so rapid follow-ups
  // collapse into one storage write.
  scheduleAutosave();

  _deps.trackEvent('ai_chat', {
    action: 'prompt_sent',
    turn_count: chatState.turns.length,
    snapshot_event_count: chatState.snapshotEventCount,
    snapshot_size_kb: Math.max(1, Math.round(chatState.snapshotBytes / 1024)),
    snapshot_filtered: chatState.useFilteredOnly,
    provider: response.provider,
    tokens_in: response.tokensIn,
    tokens_out: response.tokensOut,
  });
}

/**
 * Build the messages array for a follow-up turn. The initial system +
 * first-user pair (which contains the snapshot) is preserved, then
 * each subsequent chat turn is appended in role/content shape. The
 * very first user turn in `turns` is skipped because its content is
 * already inside `initialMessages[1].content` via the `ask` template.
 *
 * Exported for unit testing.
 */
export function buildFollowupMessages(initialMessages, turns) {
  return [
    ...(Array.isArray(initialMessages) ? initialMessages : []),
    ...turns.slice(1).map((t) => ({ role: t.role, content: t.text })),
  ];
}

// ─── Persistence ────────────────────────────────────────────────────────────

/**
 * Load saved chat history from chrome.storage.local. Returns an array
 * of conversation entries (most-recent first); empty array on any
 * error so the UI can keep rendering.
 */
export async function loadHistory() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local?.get) return [];
  try {
    const { ai_chat_history: history } = await chrome.storage.local.get(HISTORY_STORAGE_KEY);
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

/**
 * Persist the current in-memory chat to history. Idempotent — uses
 * `chatState.id` to upsert. No-op when there are no turns. Schedules
 * a debounced write so rapid follow-ups coalesce into one storage hit.
 */
function scheduleAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(persistCurrent, AUTOSAVE_DEBOUNCE_MS);
}

async function persistCurrent() {
  autosaveTimer = null;
  if (!chatState.turns.length || !chatState.initialMessages) return;
  if (!chatState.id) chatState.id = `chat-${Date.now()}`;

  const entry = serializeCurrent();
  // Upsert into the in-memory cache, then write the whole array back.
  const next = upsertHistory(historyCache, entry);
  historyCache = enforceLruCap(next, MAX_HISTORY);

  try {
    await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: historyCache });
  } catch {
    // Storage write failed (likely quota). Drop the oldest entry and
    // retry once — a well-formed conversation should still fit even if
    // the previous heaviest one had to go.
    if (historyCache.length > 1) {
      historyCache = historyCache.slice(0, -1);
      try {
        await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: historyCache });
      } catch { /* give up — non-critical */ }
    }
  }
}

function serializeCurrent() {
  return {
    id: chatState.id,
    title: deriveTitle(chatState.turns),
    turns: chatState.turns.map((t) => ({ role: t.role, text: t.text })),
    initialMessages: chatState.initialMessages,
    provider: chatState.provider,
    model: chatState.model,
    snapshotEventCount: chatState.snapshotEventCount,
    snapshotBytes: chatState.snapshotBytes,
    snapshotTakenAt: chatState.snapshotTakenAt,
    useFilteredOnly: chatState.useFilteredOnly,
    createdAt: findCreatedAt(chatState.id) || Date.now(),
    updatedAt: Date.now(),
  };
}

function findCreatedAt(id) {
  const existing = historyCache.find((e) => e.id === id);
  return existing?.createdAt || null;
}

/**
 * Build a display title from the first user turn. Truncates to
 * TITLE_MAX_LENGTH and trims a trailing partial word for readability.
 *
 * Exported for tests.
 */
export function deriveTitle(turns) {
  const firstUser = (turns || []).find((t) => t.role === 'user');
  const raw = (firstUser?.text || '').trim();
  if (!raw) return '(no title)';
  if (raw.length <= TITLE_MAX_LENGTH) return raw;
  const truncated = raw.slice(0, TITLE_MAX_LENGTH);
  // Trim back to the last space so we don't cut mid-word
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > TITLE_MAX_LENGTH * 0.6 ? truncated.slice(0, lastSpace) : truncated) + '…';
}

/**
 * Upsert an entry by id. Exported for tests.
 */
export function upsertHistory(history, entry) {
  const next = (history || []).filter((e) => e.id !== entry.id);
  next.push(entry);
  return next;
}

/**
 * Enforce LRU cap by `updatedAt`. Exported for tests.
 */
export function enforceLruCap(history, cap) {
  if (!Array.isArray(history) || history.length <= cap) return history || [];
  return [...history]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, cap);
}

// ─── Conversation lifecycle controls ────────────────────────────────────────

/**
 * Discard in-memory state and start a fresh thread. The current
 * conversation has already been auto-saved (or is being saved by the
 * pending debounced write), so no explicit save is needed here.
 */
async function startNewChat() {
  // Flush any pending autosave so the current conversation is in
  // history before we wipe state.
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
    await persistCurrent();
  }
  resetChatState();
  historyDropdownOpen = false;
  _deps.trackEvent('ai_chat', { action: 'new_chat', history_count: historyCache.length });
  paint();
}

/**
 * Load a saved conversation into the active chat state.
 */
async function loadFromHistory(id) {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
    await persistCurrent();
  }
  const entry = historyCache.find((e) => e.id === id);
  if (!entry) return;

  chatState.id = entry.id;
  chatState.turns = (entry.turns || []).map((t) => ({ role: t.role, text: t.text }));
  chatState.initialMessages = entry.initialMessages || null;
  chatState.provider = entry.provider || null;
  chatState.model = entry.model || null;
  chatState.snapshotEventCount = entry.snapshotEventCount || 0;
  chatState.snapshotBytes = entry.snapshotBytes || 0;
  chatState.snapshotTakenAt = entry.snapshotTakenAt || null;
  chatState.useFilteredOnly = !!entry.useFilteredOnly;
  // The snapshot object itself is reconstructed from initialMessages
  // implicitly — we don't need it as a JS object anymore for follow-ups
  // (those send `messages` directly). Set to a marker so the snapshot
  // bar shows the correct meta without re-running buildAiContextSnapshot.
  chatState.snapshot = entry.snapshotEventCount > 0 ? { __restored__: true } : null;
  chatState.inflight = false;
  historyDropdownOpen = false;
  _deps.trackEvent('ai_chat', { action: 'load_chat', history_count: historyCache.length });
  paint();
}

/**
 * Remove a conversation from history. If it's the active one, also
 * resets the in-memory state so the user isn't left looking at an
 * orphaned thread.
 */
async function deleteFromHistory(id) {
  historyCache = historyCache.filter((e) => e.id !== id);
  try {
    await chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: historyCache });
  } catch { /* non-critical */ }
  if (chatState.id === id) resetChatState();
  // If the dropdown emptied out, close it
  if (historyCache.length === 0) historyDropdownOpen = false;
  _deps.trackEvent('ai_chat', { action: 'delete_chat', history_count: historyCache.length });
  paint();
}

function resetChatState() {
  chatState.id = null;
  chatState.snapshot = null;
  chatState.snapshotTakenAt = null;
  chatState.snapshotEventCount = 0;
  chatState.snapshotBytes = 0;
  chatState.useFilteredOnly = false;
  chatState.turns = [];
  chatState.initialMessages = null;
  chatState.inflight = false;
  chatState.provider = null;
  chatState.model = null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function sendAIRequest(payload) {
  let response;
  try {
    response = await chrome.runtime.sendMessage({ type: MSG.AI_REQUEST, ...payload });
  } catch (err) {
    return { success: false, error: 'extension', message: err?.message || 'Extension error' };
  }
  if (!response) return { success: false, error: 'unknown', message: 'No response from service worker.' };
  if (!response.success) {
    return { success: false, error: response.error || 'unknown', message: response.message || 'Unknown error.' };
  }
  return {
    success: true,
    text: response.text || '',
    messages: response.messages || [],
    provider: response.provider || null,
    model: response.model || null,
    tokensIn: response.tokensIn,
    tokensOut: response.tokensOut,
  };
}

function showError(errorInfo) {
  const container = _deps?.elements?.aiTabChat;
  if (!container) return;
  const existing = container.querySelector('.ai-chat-error');
  if (existing) existing.remove();
  const wrap = document.createElement('div');
  wrap.className = 'ai-chat-error ai-summary-error';
  const heading = document.createElement('p');
  heading.className = 'ai-summary-error-heading';
  heading.textContent = friendlyErrorHeading(errorInfo.error);
  wrap.appendChild(heading);
  if (errorInfo.message) {
    const detail = document.createElement('p');
    detail.className = 'ai-summary-error-detail';
    detail.textContent = errorInfo.message;
    wrap.appendChild(detail);
  }
  container.appendChild(wrap);
}

function copyTurnText(text, btn) {
  const done = () => {
    btn.classList.add('copied');
    const original = btn.title;
    btn.title = 'Copied!';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.title = original;
    }, 1500);
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
  _deps.trackEvent('ai_chat', { action: 'copy_reply' });
}

function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    done();
  } catch {
    // copy failed silently
  }
  document.body.removeChild(ta);
}

function classifySize(bytes) {
  if (bytes > 200 * 1024) return 'red';
  if (bytes > 50 * 1024) return 'amber';
  return 'ok';
}

function describeAge(ms) {
  if (ms < 1000) return 'just now';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

function friendlyErrorHeading(errorType) {
  switch (errorType) {
    case 'no_provider': return 'No AI provider configured.';
    case 'no_consent': return 'AI data-use consent not yet accepted.';
    case 'invalid_key': return 'The provider rejected your API key.';
    case 'rate_limited': return 'Rate limited by the provider — try again in a minute.';
    case 'context_too_large': return 'This snapshot is too large for the provider — try Use filtered only.';
    case 'server_error': return 'The AI provider is having a bad moment.';
    case 'network': return 'Network error reaching the AI provider.';
    case 'timeout': return 'The AI provider took too long to respond.';
    case 'unknown_template': return 'Internal error — unknown prompt template.';
    case 'bad_request': return 'Internal error — malformed AI request.';
    case 'extension': return 'Extension messaging error.';
    default: return 'Could not generate response.';
  }
}

// Test exports
export const _CHAT_MAX_FOLLOWUP_TURNS = MAX_FOLLOWUP_TURNS;
