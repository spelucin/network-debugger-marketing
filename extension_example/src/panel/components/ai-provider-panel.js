// ============================================================
// AI Provider Panel — the Provider tab inside the AI modal.
//
// Three-provider selector (Gemini / Claude / OpenAI) with per-provider
// keys stored independently so switching providers never loses a key you
// already saved.
//
// Storage shape (chrome.storage.local.ai_config):
//   {
//     activeProvider: 'gemini' | 'anthropic' | 'openai',
//     consentGiven: true,
//     consentTimestamp: ISO string,
//     providers: {
//       [providerId]: { apiKey, model }
//     }
//   }
//
// The API key is stored in chrome.storage.local (sandboxed per-extension,
// never synced). It is read by the service worker for every AI_REQUEST
// and by this panel only at save-time so the Test button can validate
// the value the user just typed before persisting it.
// ============================================================

import {
  listProviders,
  validateKey as validateProviderKey,
  maskKey as maskProviderKey,
  testConnection,
} from '../../shared/ai/ai-provider.js';
import { getProviderLogo } from '../../shared/ai/provider-logos.js';
import { buildAiUserProperties } from '../settings.js';

/**
 * Push the current `ai_config` state to Amplitude as user_properties so
 * BYOK cohorts (`configured`, `active_provider`, `providers_count`,
 * `auto_identify_unknown`) stay in sync with on-event segmentation.
 * Safe no-op when `_deps.setSettingsUserProperties` isn't wired (older
 * host that hasn't been updated).
 */
function syncAiUserProperties() {
  if (typeof _deps?.setSettingsUserProperties !== 'function') return;
  _deps.setSettingsUserProperties(buildAiUserProperties(_state.aiConfig));
}

let _deps;
let _state = {
  activeProvider: null, // resolved on init — first configured provider, else first listed (Gemini)
  aiConfig: null,
  keyVisible: false,
  // True when the user clicked "Change key" on a configured provider —
  // temporarily re-shows the full form so they can type a new key.
  editingKey: false,
  // Per-provider unsaved input state so switching tabs doesn't drop what
  // the user typed.
  keyInputs: {}, // { providerId: 'typed key' }
};

export function initAiProviderPanel(deps) {
  _deps = deps;
  renderShell();
  wireListeners();
  refreshFromStorage();
}


// ─── Safe DOM helpers ────────────────────────────────────────────────────────

function setHtml(el, html) {
  if (!el) return;
  el.replaceChildren();
  el.insertAdjacentHTML('afterbegin', html);
}

function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

// ─── Render ──────────────────────────────────────────────────────────────────

function allProviders() {
  return listProviders();
}

function getActiveProviderMeta() {
  const providers = allProviders();
  return providers.find((p) => p.id === _state.activeProvider) || providers[0];
}

function getActiveProviderConfig() {
  if (!_state.aiConfig?.providers) return null;
  return _state.aiConfig.providers[_state.activeProvider] || null;
}

function renderShell() {
  const container = _deps.elements.aiTabProvider;
  if (!container) return;

  const providers = allProviders();
  const configActive = _state.aiConfig?.activeProvider;
  const selectorHtml = providers
    .map((p) => {
      const hasKey = !!(_state.aiConfig?.providers?.[p.id]?.apiKey);
      const isViewing = p.id === _state.activeProvider;
      const isInUse = hasKey && p.id === configActive;
      const logo = p.logoId ? getProviderLogo(p.logoId) : null;
      const brandStyle = logo && logo.brandColor
        ? ` style="--ai-brand: ${escapeAttr(logo.brandColor)}; --ai-brand-dark: ${escapeAttr(logo.brandColorDark || logo.brandColor)};"`
        : '';

      // Status icon — encodes the provider's *role* in the running
      // config (not which tab you're viewing):
      //   in use       → green check  (requests route here)
      //   key but paused → grey pause (configured, dormant)
      //   no key        → nothing
      let statusHtml = '';
      if (isInUse) {
        statusHtml = `
          <span class="ai-provider-selector-status ai-provider-selector-status--active" aria-label="Active — in use">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </span>`;
      } else if (hasKey) {
        statusHtml = `
          <span class="ai-provider-selector-status ai-provider-selector-status--paused" aria-label="Key saved — not in use">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="5" width="4" height="14" rx="1"/>
              <rect x="14" y="5" width="4" height="14" rx="1"/>
            </svg>
          </span>`;
      }

      const logoHtml = logo
        ? `<span class="ai-provider-selector-logo" aria-hidden="true">${logo.svg}</span>`
        : '';

      return `
        <button type="button"
          class="ai-provider-selector-btn${isViewing ? ' active' : ''}${isInUse ? ' in-use' : ''}"
          data-provider="${escapeAttr(p.id)}"
          title="${escapeAttr(p.name)}${isInUse ? ' — in use' : (hasKey ? ' — key saved' : '')}"${brandStyle}>
          ${logoHtml}
          <span class="ai-provider-selector-name">${escapeAttr(p.shortName)}</span>
          ${p.freeTierNote ? '<span class="ai-provider-selector-badge ai-provider-selector-badge--free">Free tier</span>' : ''}
          ${statusHtml}
        </button>
      `;
    })
    .join('');

  const html = `
    <section class="ai-section">
      <div class="ai-provider-selector" id="ai-provider-selector">
        ${selectorHtml}
      </div>
      <div class="ai-provider-body" id="ai-provider-body"></div>
      <div class="ai-auto-actions" id="ai-auto-actions" hidden></div>
    </section>
  `;
  setHtml(container, html);
  renderProviderBody();
  renderAutoActions();
}

// ─── Automatic actions ───────────────────────────────────────────────────────
//
// Config-driven list of "opt-in automatic AI actions". Each toggle spends
// the user's tokens without a per-event click, so the list is default-OFF,
// lives in its own clearly-labelled section, and every entry must include
// a short description that names the cost implication in plain English.
// New auto-actions slot in by appending to this array.
const AUTO_ACTIONS = [
  {
    key: 'identifyUnknown',
    label: 'Auto-identify unknown platforms',
    description: 'When you open an unknown event\'s detail, automatically send its request data to your configured AI provider to identify the platform. Uses your API tokens. Results are cached per event, so each unknown event costs at most one request.',
  },
];

/**
 * Render the Automatic actions sub-section. Shown only when the user has
 * a fully configured, active provider — there's nothing meaningful to
 * toggle before BYOK is set up, and showing it pre-setup would imply
 * these actions fire for everyone.
 */
function renderAutoActions() {
  const box = document.getElementById('ai-auto-actions');
  if (!box) return;

  const activeProvider = _state.aiConfig?.activeProvider;
  const hasKey = !!(activeProvider && _state.aiConfig?.providers?.[activeProvider]?.apiKey);
  if (!hasKey) {
    box.hidden = true;
    box.replaceChildren();
    return;
  }

  box.hidden = false;
  box.replaceChildren();

  const title = document.createElement('h4');
  title.className = 'ai-usage-title';
  title.textContent = 'Automatic actions';
  box.appendChild(title);

  const preamble = document.createElement('p');
  preamble.className = 'ai-muted ai-auto-actions-preamble';
  preamble.textContent = 'When on, Event Watcher automatically uses your API tokens to perform these actions without asking each time. Designed for users with generous API quotas. Every toggle is off by default.';
  box.appendChild(preamble);

  const currentAuto = _state.aiConfig?.autoActions || {};

  for (const action of AUTO_ACTIONS) {
    const row = document.createElement('label');
    row.className = 'ai-auto-actions-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'ai-auto-actions-toggle';
    checkbox.dataset.actionKey = action.key;
    checkbox.checked = !!currentAuto[action.key];
    row.appendChild(checkbox);

    const textWrap = document.createElement('span');
    textWrap.className = 'ai-auto-actions-text';

    const labelEl = document.createElement('span');
    labelEl.className = 'ai-auto-actions-label';
    labelEl.textContent = action.label;
    textWrap.appendChild(labelEl);

    const descEl = document.createElement('span');
    descEl.className = 'ai-auto-actions-desc';
    descEl.textContent = action.description;
    textWrap.appendChild(descEl);

    row.appendChild(textWrap);
    box.appendChild(row);
  }
}

/**
 * Persist a toggle change for an auto-action. Called from the change
 * handler wired in `wireListeners`. Merges into `ai_config.autoActions`
 * so other toggles in the same object are preserved.
 */
async function setAutoAction(key, enabled) {
  if (!_state.aiConfig) return;
  const nextAuto = { ...(_state.aiConfig.autoActions || {}), [key]: !!enabled };
  const newConfig = { ..._state.aiConfig, autoActions: nextAuto };
  try {
    await chrome.storage.local.set({ ai_config: newConfig });
    _state.aiConfig = newConfig;
  } catch {
    // non-critical — revert the UI so it matches what's actually stored
    renderAutoActions();
    return;
  }
  _deps.trackEvent('ai_provider', {
    action: 'auto_action_toggle',
    auto_action: key,
    enabled: !!enabled,
  });
  syncAiUserProperties();
}

function renderProviderBody() {
  const body = document.getElementById('ai-provider-body');
  if (!body) return;
  const meta = getActiveProviderMeta();
  const providerConfig = getActiveProviderConfig();
  const hasSavedKey = !!providerConfig?.apiKey;
  const isActiveForConfig = _state.aiConfig?.activeProvider === _state.activeProvider;

  // Configured state — compact summary card. Shown when the current
  // provider has a saved key AND is the active provider AND the user
  // isn't editing. Replaces the whole form with a "ready to use" card.
  if (hasSavedKey && isActiveForConfig && !_state.editingKey) {
    renderConfiguredCard(body, meta, providerConfig);
    return;
  }

  // Otherwise — full form. Used for: first-time setup, switching active
  // provider, changing key, adding a key to a non-active provider.
  const modelOptions = meta.models
    .map((m) => `<option value="${escapeAttr(m.id)}" data-tier="${escapeAttr(m.tier)}">${escapeAttr(m.name)} — ${escapeAttr(m.tier)}</option>`)
    .join('');

  let calloutHtml = '';
  if (meta.freeTierNote) {
    calloutHtml = `
      <div class="ai-callout ai-callout--good">
        <strong>${escapeAttr(meta.shortName)} is the easiest way to get started.</strong>
        <p>${escapeAttr(meta.freeTierNote)} Sign in with any Google account at
          <a href="${escapeAttr(meta.keyIssuanceUrl)}" target="_blank" rel="noopener">aistudio.google.com/apikey</a>
          and paste the key below.</p>
      </div>
    `;
  } else if (meta.subscriptionTrap) {
    const trap = meta.subscriptionTrap;
    calloutHtml = `
      <div class="ai-callout ai-callout--warn">
        <strong>${escapeAttr(trap.subscription)} is NOT the same as API access.</strong>
        <p>${escapeAttr(trap.distinction)}</p>
        <p>To get an API key, go to <a href="${escapeAttr(trap.setupUrl)}" target="_blank" rel="noopener">${escapeAttr(trap.setupLabel)}</a>, add a payment method, and create a key. Your consumer subscription login works — billing just lives separately.</p>
      </div>
    `;
  }

  const keyIssuanceLabel = meta.freeTierNote
    ? `Get a free ${meta.shortName} key →`
    : `Get an ${meta.shortName} API key →`;

  const html = `
    <div class="ai-provider-header">
      <div>
        <h3 class="ai-section-title">${escapeAttr(meta.name)}</h3>
        <p class="ai-muted ai-provider-sub">${escapeAttr(meta.tagline || '')}</p>
      </div>
      <span class="ai-status-pill" id="ai-status-pill" data-status="unconfigured">Not configured</span>
    </div>

    ${calloutHtml}

    <div class="ai-form-row">
      <label for="ai-model-select" class="ai-form-label">Model</label>
      <select id="ai-model-select" class="ai-select">
        ${modelOptions}
      </select>
    </div>

    <div class="ai-form-row">
      <label for="ai-key-input" class="ai-form-label">API key</label>
      <div class="ai-key-row">
        <input
          type="password"
          id="ai-key-input"
          class="ai-input"
          placeholder="Paste your ${escapeAttr(meta.shortName)} API key"
          autocomplete="off"
          spellcheck="false"
        />
        <button type="button" id="ai-key-toggle" class="btn btn-icon" title="Show/hide key" aria-label="Show/hide key">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
      </div>
      <p class="ai-muted ai-form-hint">
        Your key lives only on this device.
        <a href="${escapeAttr(meta.keyIssuanceUrl)}" target="_blank" rel="noopener">${escapeAttr(keyIssuanceLabel)}</a>
      </p>
      <p class="ai-form-error" id="ai-key-error" hidden></p>
    </div>

    <div class="ai-form-actions">
      <button type="button" id="ai-save-btn" class="btn btn-primary" disabled>Save &amp; test</button>
      <button type="button" id="ai-clear-btn" class="btn btn-secondary"${hasSavedKey ? '' : ' hidden'}>Remove ${escapeAttr(meta.shortName)} key</button>
    </div>
  `;
  setHtml(body, html);

  // Restore per-provider input state (what the user typed but hasn't saved)
  const input = document.getElementById('ai-key-input');
  if (input && _state.keyInputs[meta.id]) {
    input.value = _state.keyInputs[meta.id];
  }

  renderModelSelect();
  renderKeyField();
  renderStatus();
  renderSaveButton();
}

function renderConfiguredCard(body, meta, providerConfig) {
  const modelMeta = meta.models.find((m) => m.id === providerConfig.model) || meta.models[0];
  const modelOptions = meta.models
    .map((m) => `<option value="${escapeAttr(m.id)}"${m.id === providerConfig.model ? ' selected' : ''}>${escapeAttr(m.name)} — ${escapeAttr(m.tier)}</option>`)
    .join('');
  const maskedKey = maskProviderKey(meta.id, providerConfig.apiKey);
  const revealed = _state.keyVisible;

  const html = `
    <div class="ai-configured-card">
      <div class="ai-configured-head">
        <div class="ai-configured-check" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
        <div class="ai-configured-text">
          <h3 class="ai-configured-title">${escapeAttr(meta.shortName)} is set up and ready</h3>
          <p class="ai-configured-sub">AI features will use your ${escapeAttr(meta.shortName)} key for every request. You can close this panel.</p>
        </div>
      </div>

      <dl class="ai-configured-meta">
        <div class="ai-configured-row">
          <dt>Model</dt>
          <dd>
            <select id="ai-model-select" class="ai-select ai-select--inline">
              ${modelOptions}
            </select>
            <span class="ai-muted ai-configured-hint">Changes save automatically.</span>
          </dd>
        </div>
        <div class="ai-configured-row">
          <dt>API key</dt>
          <dd class="ai-configured-key-row">
            <code class="ai-configured-key" id="ai-configured-key">${escapeAttr(revealed ? providerConfig.apiKey : maskedKey)}</code>
            <button type="button" id="ai-key-toggle" class="btn btn-icon" title="${revealed ? 'Hide key' : 'Show key'}" aria-label="${revealed ? 'Hide key' : 'Show key'}">
              ${revealed ? `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.77 19.77 0 0 1 4.22-5.22"/>
                  <path d="M9.9 4.24A10.93 10.93 0 0 1 12 4c7 0 11 8 11 8a19.78 19.78 0 0 1-2.16 3.19"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ` : `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              `}
            </button>
          </dd>
        </div>
      </dl>

      <div class="ai-configured-actions">
        <button type="button" id="ai-change-key-btn" class="btn btn-secondary">Change key</button>
        <button type="button" id="ai-clear-btn" class="btn btn-secondary ai-btn-danger">Remove ${escapeAttr(meta.shortName)} key</button>
      </div>
    </div>
  `;
  setHtml(body, html);
}

function renderStatus() {
  const pill = document.getElementById('ai-status-pill');
  if (!pill) return;
  const providerConfig = getActiveProviderConfig();
  const isActiveForConfig = _state.aiConfig?.activeProvider === _state.activeProvider;
  let status = 'unconfigured';
  let label = 'Not configured';
  if (providerConfig?.apiKey) {
    if (isActiveForConfig) {
      status = 'connected';
      label = 'Connected · Active';
    } else {
      status = 'saved';
      label = 'Key saved';
    }
  }
  pill.dataset.status = status;
  pill.textContent = label;
}

function renderKeyField() {
  const input = document.getElementById('ai-key-input');
  if (!input) return;
  input.type = _state.keyVisible ? 'text' : 'password';
  const providerConfig = getActiveProviderConfig();
  if (providerConfig?.apiKey && input.value === '') {
    input.placeholder = maskProviderKey(_state.activeProvider, providerConfig.apiKey);
  }
}

/**
 * Eye-button click handler. Works in both the configured card (toggles
 * the mask/reveal on the `<code>` display) and in form mode (toggles
 * the input's password/text type; if a saved key exists and the user
 * hasn't typed anything yet, populates the input with the full saved
 * key so they can actually see what's stored).
 */
function toggleKeyVisibility() {
  _state.keyVisible = !_state.keyVisible;

  // Configured-card path: just re-render, the `<code>` element is
  // rebuilt with the revealed/masked string.
  const configuredKeyEl = document.getElementById('ai-configured-key');
  if (configuredKeyEl) {
    renderShell();
    return;
  }

  // Form path: toggle input type. If the user hasn't typed anything
  // and a key is saved, populate with the saved key so they can see it.
  const input = document.getElementById('ai-key-input');
  if (!input) return;
  const providerConfig = getActiveProviderConfig();
  if (_state.keyVisible && input.value === '' && providerConfig?.apiKey) {
    input.value = providerConfig.apiKey;
    _state.keyInputs[_state.activeProvider] = input.value;
  } else if (!_state.keyVisible && input.value === providerConfig?.apiKey) {
    input.value = '';
    _state.keyInputs[_state.activeProvider] = '';
  }
  renderKeyField();
  renderSaveButton();
}

function renderModelSelect() {
  const sel = document.getElementById('ai-model-select');
  if (!sel) return;
  const meta = getActiveProviderMeta();
  const providerConfig = getActiveProviderConfig();
  const current = providerConfig?.model || meta.defaultModel;
  sel.value = current;
}

function renderSaveButton() {
  const btn = document.getElementById('ai-save-btn');
  const clearBtn = document.getElementById('ai-clear-btn');
  const input = document.getElementById('ai-key-input');
  if (!btn || !input) return;
  const typed = input.value.trim();
  const valid = typed.length === 0 || validateProviderKey(_state.activeProvider, typed);
  const providerConfig = getActiveProviderConfig();
  // Save enabled when (a) there's a valid new key typed, OR
  // (b) a key is already saved and the user switched provider (switching
  // = making that provider active without changing the key).
  const hasSavedKey = !!providerConfig?.apiKey;
  const isAlreadyActive = _state.aiConfig?.activeProvider === _state.activeProvider;
  const canSwitchActive = hasSavedKey && !isAlreadyActive && typed.length === 0;
  btn.disabled = !((typed.length > 0 && valid) || canSwitchActive);
  btn.textContent = canSwitchActive ? `Use ${getActiveProviderMeta().shortName}` : 'Save & test';
  if (clearBtn) clearBtn.hidden = !hasSavedKey;

  const err = document.getElementById('ai-key-error');
  if (err) {
    if (typed.length > 0 && !valid) {
      err.hidden = false;
      err.textContent = 'That key looks incomplete (too short, or has whitespace). Paste it exactly as shown by the provider.';
    } else {
      err.hidden = true;
      err.textContent = '';
    }
  }
}

// ─── Data flow ───────────────────────────────────────────────────────────────

async function refreshFromStorage() {
  try {
    const { ai_config: stored } = await chrome.storage.local.get('ai_config');
    _state.aiConfig = normalizeAiConfig(stored);
  } catch {
    _state.aiConfig = null;
  }

  // Resolve active provider for display: prefer the saved active,
  // else the first provider that has a key, else the first listed (Gemini).
  const providers = allProviders();
  const saved = _state.aiConfig?.activeProvider;
  if (saved && providers.some((p) => p.id === saved)) {
    _state.activeProvider = saved;
  } else {
    const firstConfigured = providers.find((p) => _state.aiConfig?.providers?.[p.id]?.apiKey);
    _state.activeProvider = firstConfigured?.id || providers[0]?.id;
  }

  renderShell();
}

/**
 * Back-compat shim: older v1.1.0 dev builds used a flat
 * `{ provider, model, apiKey, consentGiven, consentTimestamp }`. If we
 * find that shape, migrate it to the multi-provider layout in memory
 * (not re-saved until the user hits Save).
 */
function normalizeAiConfig(raw) {
  if (!raw) return null;
  if (raw.providers && raw.activeProvider) return raw; // already new shape
  if (raw.provider && raw.apiKey) {
    return {
      activeProvider: raw.provider,
      consentGiven: !!raw.consentGiven,
      consentTimestamp: raw.consentTimestamp || null,
      providers: {
        [raw.provider]: { apiKey: raw.apiKey, model: raw.model || null },
      },
    };
  }
  return raw;
}

async function saveAndTest() {
  const input = document.getElementById('ai-key-input');
  const sel = document.getElementById('ai-model-select');
  const saveBtn = document.getElementById('ai-save-btn');
  if (!input || !sel || !saveBtn) return;

  const typed = input.value.trim();
  const model = sel.value;
  const providerId = _state.activeProvider;
  const providerConfig = getActiveProviderConfig();

  // If there's no new key typed but a saved key exists, this is a
  // "switch active provider" action.
  if (typed.length === 0 && providerConfig?.apiKey) {
    const newConfig = {
      ..._state.aiConfig,
      activeProvider: providerId,
      // Allow changing the model even when not re-saving the key
      providers: {
        ..._state.aiConfig.providers,
        [providerId]: { ...providerConfig, model },
      },
    };
    try {
      await chrome.storage.local.set({ ai_config: newConfig });
    } catch {
      flashError('Failed to update active provider.');
      return;
    }
    _state.aiConfig = newConfig;
    renderShell();
    _deps.trackEvent('ai_provider', { action: 'switched_active', provider: providerId, model });
    syncAiUserProperties();
    return;
  }

  if (!validateProviderKey(providerId, typed)) return;

  // 1. Consent (once per key setup — applies across all providers)
  if (!_state.aiConfig?.consentGiven) {
    const accepted = await _deps.requestAiConsent();
    if (!accepted) return;
  }

  // 2. Host access — already covered by the extension's <all_urls>
  // host_permissions declared for tracking detection. This contains()
  // check is a safety net in case host_permissions is ever narrowed.
  const meta = getActiveProviderMeta();
  saveBtn.disabled = true;
  saveBtn.textContent = 'Testing…';
  let hasAccess = false;
  try {
    hasAccess = await chrome.permissions.contains({ origins: meta.hostOrigins });
  } catch {
    hasAccess = false;
  }
  if (!hasAccess) {
    saveBtn.textContent = 'Save & test';
    saveBtn.disabled = false;
    flashError(`Event Watcher does not have access to ${meta.hostOrigins[0]}. Reinstall the extension.`);
    _deps.trackEvent('ai_provider', { action: 'permission_missing', provider: providerId });
    return;
  }

  // 3. Test connection
  const result = await testConnection({ provider: providerId, apiKey: typed, model });
  if (!result.success) {
    saveBtn.textContent = 'Save & test';
    saveBtn.disabled = false;
    flashError(testErrorMessage(result, meta));
    _deps.trackEvent('ai_provider', {
      action: 'test_connection',
      provider: providerId,
      model,
      success: false,
      error_type: result.type || 'unknown',
    });
    return;
  }

  // 4. Persist
  const prev = _state.aiConfig || { providers: {} };
  const newConfig = {
    activeProvider: providerId,
    consentGiven: true,
    consentTimestamp: prev.consentTimestamp || new Date().toISOString(),
    providers: {
      ...(prev.providers || {}),
      [providerId]: { apiKey: typed, model },
    },
  };
  try {
    await chrome.storage.local.set({ ai_config: newConfig });
  } catch {
    saveBtn.textContent = 'Save & test';
    saveBtn.disabled = false;
    flashError('Failed to save key to local storage.');
    return;
  }

  _state.aiConfig = newConfig;
  _state.keyInputs[providerId] = ''; // saved; don't restore
  _state.editingKey = false; // return to configured card
  _state.keyVisible = false;
  input.value = '';

  renderShell();

  _deps.trackEvent('ai_provider', {
    action: 'configured',
    provider: providerId,
    model,
    tokens_in: result.tokensIn,
    tokens_out: result.tokensOut,
  });
  syncAiUserProperties();
}

async function clearKey() {
  const meta = getActiveProviderMeta();
  const confirmed = window.confirm(`Remove your ${meta.shortName} API key from this device? AI features will stop working for ${meta.shortName} until you re-add it.`);
  if (!confirmed) return;

  if (!_state.aiConfig) return;
  const newProviders = { ..._state.aiConfig.providers };
  delete newProviders[_state.activeProvider];

  let newConfig;
  if (Object.keys(newProviders).length === 0) {
    // Last key removed — wipe entire config
    try { await chrome.storage.local.remove('ai_config'); } catch { /* ignore */ }
    newConfig = null;
  } else {
    const newActive = _state.aiConfig.activeProvider === _state.activeProvider
      ? Object.keys(newProviders)[0]
      : _state.aiConfig.activeProvider;
    newConfig = {
      ..._state.aiConfig,
      activeProvider: newActive,
      providers: newProviders,
    };
    try { await chrome.storage.local.set({ ai_config: newConfig }); } catch { /* ignore */ }
  }

  _state.aiConfig = newConfig;
  _state.keyInputs[_state.activeProvider] = '';
  _state.editingKey = false;
  _state.keyVisible = false;

  renderShell();

  _deps.trackEvent('ai_provider', { action: 'removed', provider: _state.activeProvider, reason: 'user' });
  syncAiUserProperties();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function testErrorMessage(result, meta) {
  if (!result) return 'Unknown error.';
  switch (result.type) {
    case 'invalid_key': return `${meta.shortName} rejected the key. Double-check it was copied correctly.`;
    case 'rate_limited': return `Rate limited by ${meta.shortName}. Try again in a minute.`;
    case 'server_error': return `${meta.shortName} is having a bad moment. Try again in a few minutes.`;
    case 'network': return `Network error reaching ${meta.hostOrigins[0]}. Check your connection.`;
    case 'timeout': return `${meta.shortName} took too long to answer. Try again.`;
    case 'context_too_large': return 'The test prompt was rejected as too large — unexpected.';
    default: return result.message || 'Unexpected error during the test request.';
  }
}

function flashError(message) {
  const err = document.getElementById('ai-key-error');
  if (!err) return;
  err.hidden = false;
  err.textContent = message;
}

// ─── Listeners ───────────────────────────────────────────────────────────────

function wireListeners() {
  const container = _deps.elements.aiTabProvider;
  if (!container) return;

  container.addEventListener('input', (e) => {
    if (e.target && e.target.id === 'ai-key-input') {
      _state.keyInputs[_state.activeProvider] = e.target.value;
      renderSaveButton();
    }
  });
  container.addEventListener('change', async (e) => {
    if (e.target && e.target.classList?.contains('ai-auto-actions-toggle')) {
      const key = e.target.dataset.actionKey;
      if (key) await setAutoAction(key, e.target.checked);
      return;
    }
    if (e.target && e.target.id === 'ai-model-select') {
      // In the configured card, model changes auto-save (no key change
      // required). In form mode, the change is picked up on Save & test.
      const providerConfig = getActiveProviderConfig();
      const inConfiguredCard = !!document.getElementById('ai-configured-key');
      if (inConfiguredCard && providerConfig?.apiKey) {
        const newModel = e.target.value;
        const newConfig = {
          ..._state.aiConfig,
          providers: {
            ..._state.aiConfig.providers,
            [_state.activeProvider]: { ...providerConfig, model: newModel },
          },
        };
        try {
          await chrome.storage.local.set({ ai_config: newConfig });
          _state.aiConfig = newConfig;
          _deps.trackEvent('ai_provider', {
            action: 'model_changed',
            provider: _state.activeProvider,
            model: newModel,
          });
          // model changes don't shift provider/configured/count/auto state,
          // but keep the sync here so any future field added to
          // buildAiUserProperties (e.g. setting_ai_active_model) picks it up.
          syncAiUserProperties();
        } catch {
          // non-critical — next render will re-sync from storage
        }
      }
      renderSaveButton();
    }
  });
  container.addEventListener('click', (e) => {
    const selectorBtn = e.target.closest('.ai-provider-selector-btn');
    if (selectorBtn && selectorBtn.dataset.provider) {
      if (selectorBtn.dataset.provider !== _state.activeProvider) {
        // Save any in-flight input before switching
        const input = document.getElementById('ai-key-input');
        if (input) _state.keyInputs[_state.activeProvider] = input.value;
        _state.activeProvider = selectorBtn.dataset.provider;
        _state.editingKey = false;
        _state.keyVisible = false;
        renderShell();
        _deps.trackEvent('ai_provider', { action: 'provider_tab_switch', provider: _state.activeProvider });
      }
      return;
    }
    const target = e.target.closest('button');
    if (!target) return;
    if (target.id === 'ai-key-toggle') {
      toggleKeyVisibility();
    } else if (target.id === 'ai-save-btn') {
      saveAndTest();
    } else if (target.id === 'ai-clear-btn') {
      clearKey();
    } else if (target.id === 'ai-change-key-btn') {
      _state.editingKey = true;
      _state.keyVisible = false;
      renderShell();
      _deps.trackEvent('ai_provider', { action: 'change_key_start', provider: _state.activeProvider });
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !('ai_config' in changes)) return;
    refreshFromStorage();
  });
}
