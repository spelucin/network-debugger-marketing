// ============================================================
// AI Modal — toolbar button + tabbed panel (Provider / External
// Bridge / About). Shell only: tab content is rendered by each
// tab's own component module (ai-provider-panel.js, etc.).
// ============================================================

import { registerModalCloser, closeOtherModals } from './modal-utils.js';
import { getProviderLogo } from '../../shared/ai/provider-logos.js';

let _deps;
let _providerPanelInitialized = false;
let _chatTabInitialized = false;
let _usageTabInitialized = false;

// Maps ai_config.activeProvider → (logoId, displayName). Anthropic's
// provider id is "anthropic" internally, but the brand / logo is
// "Claude" — keep the translation in one place.
const PROVIDER_META = {
  gemini:    { logoId: 'gemini', displayName: 'Gemini' },
  anthropic: { logoId: 'claude', displayName: 'Claude' },
  openai:    { logoId: 'openai', displayName: 'OpenAI' },
};

// Captured on first sync so the Chat tab icon can be restored to the
// generic sparkle when the user removes their last provider key. The
// tab icon sits inside the opened AI modal (not a primary extension
// surface like the toolbar button), so swapping it to the active
// provider's logo is safe nominative use — the user has already chosen
// their provider inside this same modal.
let _defaultChatTabIconHtml = null;

/**
 * Initialize the AI modal shell.
 * @param {Object} deps
 * @param {Object} deps.elements - DOM refs (aiBtn, aiPanel, aiClose, aiTabs, aiBody)
 * @param {Function} deps.trackEvent
 * @param {Function} deps.initProviderPanel - lazy-init callback for the Provider tab
 * @param {Function} [deps.initChatTab] - lazy-init callback for the Chat tab
 */
export function initAiModal(deps) {
  _deps = deps;
  setupAiListeners();
  registerModalCloser('ai-panel', closeAiModal);
  // Reflect provider-configured state in the toolbar AI button (sparkle
  // tinted teal when a key is saved). Async first paint, then live
  // updates from chrome.storage.onChanged so adding / removing a key
  // takes effect without a panel reload.
  syncAiBtnReadyState();
  if (chrome.storage?.onChanged?.addListener) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && 'ai_config' in changes) syncAiBtnReadyState();
    });
  }
}

/**
 * True when the user has a usable BYOK setup: an active provider, a
 * saved API key for it, and the data-use consent acknowledged. Shared
 * by the modal default-tab logic and the toolbar button ready state
 * so the two definitions can never drift.
 */
async function isAiConfigured() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local?.get) return false;
  try {
    const { ai_config: aiConfig } = await chrome.storage.local.get('ai_config');
    return !!(
      aiConfig?.activeProvider
      && aiConfig.consentGiven
      && aiConfig.providers?.[aiConfig.activeProvider]?.apiKey
    );
  } catch {
    return false;
  }
}

/**
 * Toggle the .ai-btn--ready class on the toolbar AI button and tint
 * the small indicator dot in the active provider's brand color. The
 * sparkle SVG itself is never swapped — keeping Event Watcher's own
 * icon preserves visual identity and sidesteps any "this extension
 * is a provider's product" ambiguity. The colored dot is the cheap
 * signal: green = not yet configured (default), brand hex = which
 * provider is running.
 */
async function syncAiBtnReadyState() {
  const btn = _deps?.elements?.aiBtn;
  const dot = _deps?.elements?.aiBtnDot;
  if (!btn) return;

  let ready = false;
  let activeProvider = null;
  try {
    const { ai_config: aiConfig } = await chrome.storage.local.get('ai_config');
    ready = !!(
      aiConfig?.activeProvider
      && aiConfig.consentGiven
      && aiConfig.providers?.[aiConfig.activeProvider]?.apiKey
    );
    activeProvider = ready ? aiConfig.activeProvider : null;
  } catch {
    ready = false;
  }

  btn.classList.toggle('ai-btn--ready', ready);

  if (dot) {
    if (ready) {
      const meta = PROVIDER_META[activeProvider];
      const logo = meta ? getProviderLogo(meta.logoId) : null;
      if (logo && logo.brandColor) {
        dot.style.setProperty('--ai-brand', logo.brandColor);
        dot.style.setProperty('--ai-brand-dark', logo.brandColorDark || logo.brandColor);
        dot.classList.add('ai-btn-dot--branded');
      } else {
        // OpenAI has no forced brand hex — fall back to the default
        // green "ready" color so the dot still communicates readiness.
        dot.style.removeProperty('--ai-brand');
        dot.style.removeProperty('--ai-brand-dark');
        dot.classList.remove('ai-btn-dot--branded');
      }
      dot.hidden = false;
    } else {
      dot.hidden = true;
      dot.style.removeProperty('--ai-brand');
      dot.style.removeProperty('--ai-brand-dark');
      dot.classList.remove('ai-btn-dot--branded');
    }
  }

  if (ready) {
    const providerName = PROVIDER_META[activeProvider]?.displayName || activeProvider;
    btn.title = `AI is set up — ${providerName} is running your requests`;
  } else {
    btn.title = 'AI features — Chat, Provider setup, About';
  }
  btn.setAttribute('aria-label', btn.title);

  syncChatTabIcon(ready ? activeProvider : null);
}

// Parse a trusted SVG literal with DOMParser rather than using
// innerHTML. All inputs to this come from provider-logos.js, a
// module-local constant source — never user input — but DOMParser
// avoids the innerHTML execution surface entirely.
function parseSvgLiteral(svg) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return doc.documentElement && doc.documentElement.tagName === 'svg'
    ? doc.documentElement
    : null;
}

/**
 * Swap the Chat tab's sparkle icon with the active provider's brand
 * logo (or restore the sparkle when no provider is configured). This
 * lives inside the AI modal — a surface the user reaches by explicitly
 * opening the modal and picking a provider — so replacing the icon
 * with the active provider's logo is clear nominative use.
 */
function syncChatTabIcon(activeProvider) {
  const iconEl = document.querySelector('.ai-tab--primary .ai-tab-icon--chat');
  if (!iconEl) return;

  if (_defaultChatTabIconHtml === null) {
    _defaultChatTabIconHtml = iconEl.outerHTML;
  }

  const meta = activeProvider ? PROVIDER_META[activeProvider] : null;
  const logo = meta ? getProviderLogo(meta.logoId) : null;

  if (logo) {
    const newSvg = parseSvgLiteral(logo.svg);
    if (!newSvg) return;
    newSvg.setAttribute('class', 'ai-tab-icon ai-tab-icon--chat');
    newSvg.setAttribute('aria-hidden', 'true');
    if (logo.brandColor) {
      newSvg.style.setProperty('--ai-brand', logo.brandColor);
      newSvg.style.setProperty('--ai-brand-dark', logo.brandColorDark || logo.brandColor);
      newSvg.classList.add('ai-tab-icon--branded');
    }
    iconEl.replaceWith(newSvg);
  } else if (_defaultChatTabIconHtml) {
    const original = parseSvgLiteral(_defaultChatTabIconHtml);
    if (original) iconEl.replaceWith(original);
  }
}

/**
 * Open the AI modal.
 *
 * `tabName` is honoured if explicit; otherwise the modal opens to the
 * tab the user most likely wants:
 *   - Provider, if BYOK setup is incomplete (missing key / consent /
 *     active provider)
 *   - Chat, once setup is done — clicking the AI button after setup
 *     should land on the workspace, not back on the settings.
 *
 * @param {string} [tabName]
 * @param {Object} [options]
 * @param {{kind: 'page', pageEventId: string}|{kind: string, eventIds: string[], displayName?: string}|null} [options.scope] -
 *   When set (and the target tab is 'chat'), the Chat tab's turn-1 snapshot
 *   is filtered to the scoped events instead of the whole session. Supported
 *   kinds: `'page'` (per-page menu) and `'tool'` / `'domain'` / `'event_name'`
 *   / `'consent_category'` (the unified group menu added in feature #61).
 *   Passed through to `applyChatScope` in ai-chat-tab.js.
 * @param {string} [options.source] -
 *   Discoverable entry surface that triggered the open: `'toolbar'`,
 *   `'page_context'`, `'export_dropdown'`, or one of the four #61 group
 *   surfaces (`'tool_context'` / `'domain_context'` / `'event_name_context'`
 *   / `'consent_category_context'`). Attached to the `ai_modal` open event
 *   so we can compare entry-point adoption without a separate
 *   `ai_chat_entry` event.
 */
export async function openAiModal(tabName, options = {}) {
  const { elements } = _deps;
  if (!elements.aiPanel) return;
  closeOtherModals('ai-panel');
  elements.aiPanel.classList.add('open');

  const initial = tabName || (await pickDefaultTab());
  switchAiTab(initial);

  // Scope is forwarded to the Chat tab after it's (lazily) initialised.
  // The tab decides how to act on the scope — see `applyChatScope` in
  // ai-chat-tab.js. Safe to call even when scope is null; the tab
  // resets itself to the full-session default in that case.
  if (initial === 'chat' && typeof _deps.applyChatScope === 'function') {
    try {
      _deps.applyChatScope(options.scope || null);
    } catch (err) {
      console.error('[AI Modal] applyChatScope failed:', err);
    }
  }

  const openProps = {
    action: 'open',
    tab: initial,
    scope: options.scope?.kind || 'session',
  };
  if (options.source) openProps.source = options.source;
  _deps.trackEvent('ai_modal', openProps);
}

/**
 * Decide which tab to land on when no explicit choice is made. Reads
 * ai_config via the shared `isAiConfigured` helper so the criteria for
 * "configured" never drift between the default-tab and the toolbar
 * button ready-state.
 */
async function pickDefaultTab() {
  return (await isAiConfigured()) ? 'chat' : 'provider';
}

export function closeAiModal() {
  const { elements } = _deps;
  if (!elements.aiPanel) return;
  if (!elements.aiPanel.classList.contains('open')) return;
  elements.aiPanel.classList.remove('open');
}

// Per-tab subtitle text shown in the modal header (#ai-title-sub).
// Frames the active tab's intent at a glance — useful because the Chat
// tab is the workspace and most users will land there; the brand
// label "BYOK · local-only" only matters when configuring the provider.
const TAB_SUBTITLES = {
  chat: 'Ask anything about this captured session',
  provider: 'BYOK · local-only',
  usage: 'How much AI you have used',
  about: 'About AI features',
};

function switchAiTab(tabName) {
  const { elements } = _deps;
  if (!elements.aiTabs || !elements.aiBody) return;

  elements.aiTabs.querySelectorAll('.ai-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });
  elements.aiBody.querySelectorAll('.ai-tab-content').forEach((content) => {
    content.classList.toggle('active', content.dataset.tab === tabName);
  });

  // Update the header subtitle so the user always sees a one-line
  // explanation of what the active tab is for.
  const subtitle = document.getElementById('ai-title-sub');
  if (subtitle && TAB_SUBTITLES[tabName]) {
    subtitle.textContent = TAB_SUBTITLES[tabName];
  }

  // Lazy-init the Provider panel on first activation — keeps storage
  // reads off the critical panel-boot path for users who never open AI.
  if (tabName === 'provider' && !_providerPanelInitialized && typeof _deps.initProviderPanel === 'function') {
    try {
      _deps.initProviderPanel();
      _providerPanelInitialized = true;
    } catch (err) {
      console.error('[AI Modal] Provider panel init failed:', err);
    }
  }

  // Lazy-init the Chat tab on first activation — defers the
  // context-serializer import until someone actually wants to use it.
  if (tabName === 'chat' && !_chatTabInitialized && typeof _deps.initChatTab === 'function') {
    try {
      _deps.initChatTab();
      _chatTabInitialized = true;
    } catch (err) {
      console.error('[AI Modal] Chat tab init failed:', err);
    }
  }

  // Lazy-init the Usage tab on first activation; on subsequent
  // activations, just refresh so recently-completed AI requests show.
  if (tabName === 'usage') {
    if (!_usageTabInitialized && typeof _deps.initUsageTab === 'function') {
      try {
        _deps.initUsageTab();
        _usageTabInitialized = true;
      } catch (err) {
        console.error('[AI Modal] Usage tab init failed:', err);
      }
    } else if (typeof _deps.refreshUsageTab === 'function') {
      _deps.refreshUsageTab();
    }
  }

  _deps.trackEvent('ai_modal', { action: 'tab_switch', tab: tabName });
}

function setupAiListeners() {
  const { elements } = _deps;

  if (elements.aiBtn) {
    elements.aiBtn.addEventListener('click', async () => {
      if (elements.aiPanel?.classList.contains('open')) {
        closeAiModal();
      } else {
        // Tag the open with the entry surface so the three chat entry
        // points (toolbar / page_context / export_dropdown) stay
        // comparable on a single `ai_modal { action: "open" }` stream.
        // Only attach when the open will land on Chat — Provider opens
        // shouldn't be skewed by toolbar-click counts.
        const source = (await isAiConfigured()) ? 'toolbar' : undefined;
        openAiModal(undefined, source ? { source } : undefined);
      }
    });
  }

  if (elements.aiClose) {
    elements.aiClose.addEventListener('click', closeAiModal);
  }

  if (elements.aiTabs) {
    elements.aiTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.ai-tab');
      if (tab && tab.dataset.tab) {
        switchAiTab(tab.dataset.tab);
      }
    });
  }

  // Close when clicking the backdrop (outside .ai-content)
  elements.aiPanel?.addEventListener('click', (e) => {
    if (e.target === elements.aiPanel) closeAiModal();
  });
}
