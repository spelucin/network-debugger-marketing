/**
 * GTM Container Intercept Module
 *
 * Manages GTM container blocking, swapping, and previewing from the GTM Hub modal.
 * Renders the "GTM Intercept" tab with detected containers and active rules.
 *
 * Dependencies injected via initGTMIntercept() to avoid circular imports.
 */

import { trackEvent } from '../analytics.js';
import { MSG } from '../../shared/messages.js';

let _deps;

// GTM container ID format: GTM- followed by alphanumerics
const GTM_ID_REGEX = /^GTM-[A-Z0-9]+$/i;

// DNR rule ID base — must match service-worker.js
const GTM_DNR_RULE_ID_BASE = 1001;
// Preview mode pairs each redirect rule with an "allow" rule at
// dnrRuleId + DNR_PREVIEW_RULE_OFFSET (see service-worker.js — keep in sync).
// Base rule IDs are therefore confined to [BASE, BASE+OFFSET) so an allocated
// base ID can never collide with an existing preview-allow twin (F13).
const DNR_PREVIEW_RULE_OFFSET = 5000;
const GTM_DNR_RULE_ID_MAX = GTM_DNR_RULE_ID_BASE + DNR_PREVIEW_RULE_OFFSET - 1;

/**
 * Build a scope toggle for rule creation/editing forms.
 * @param {string} [initialScope='devtools'] - 'devtools' or 'always'
 * @returns {{ container: HTMLElement, getValue: () => 'devtools' | 'always' }}
 */
export function buildScopeToggle(initialScope = 'devtools') {
  const wrapper = document.createElement('div');
  wrapper.className = 'gtm-scope-toggle-wrapper';

  const row = document.createElement('div');
  row.className = 'gtm-scope-toggle';

  const label = document.createElement('span');
  label.className = 'gtm-scope-toggle-label';
  label.textContent = 'Active:';
  row.appendChild(label);

  const isAlways = initialScope === 'always';

  const devtoolsBtn = document.createElement('button');
  devtoolsBtn.type = 'button';
  devtoolsBtn.className = `gtm-scope-option${isAlways ? '' : ' gtm-scope-option--selected'}`;
  devtoolsBtn.textContent = 'DevTools only';

  const alwaysBtn = document.createElement('button');
  alwaysBtn.type = 'button';
  alwaysBtn.className = `gtm-scope-option${isAlways ? ' gtm-scope-option--selected' : ''}`;
  alwaysBtn.textContent = 'Always';

  // Hint text — changes based on selected scope
  const hint = document.createElement('div');
  hint.className = 'gtm-scope-hint';

  function updateHint(scope) {
    if (scope === 'always') {
      hint.className = 'gtm-scope-hint gtm-scope-hint--warning';
      hint.textContent = 'This rule stays active when you close DevTools. The toolbar badge shows "GTM" on affected pages as a reminder.';
    } else {
      hint.className = 'gtm-scope-hint';
      hint.textContent = 'This rule is only active while DevTools is open. It is automatically removed when you close DevTools.';
    }
  }

  let currentScope = initialScope;
  updateHint(currentScope);

  devtoolsBtn.addEventListener('click', () => {
    currentScope = 'devtools';
    devtoolsBtn.classList.add('gtm-scope-option--selected');
    alwaysBtn.classList.remove('gtm-scope-option--selected');
    updateHint('devtools');
  });

  alwaysBtn.addEventListener('click', () => {
    currentScope = 'always';
    alwaysBtn.classList.add('gtm-scope-option--selected');
    devtoolsBtn.classList.remove('gtm-scope-option--selected');
    updateHint('always');
  });

  row.appendChild(devtoolsBtn);
  row.appendChild(alwaysBtn);
  wrapper.appendChild(row);
  wrapper.appendChild(hint);

  return { container: wrapper, getValue: () => currentScope };
}

/**
 * Build a consistent inline form for rule creation or editing.
 * @param {Object} opts
 * @param {string} [opts.heading] - Form heading text
 * @param {Array<{key: string, label?: string, placeholder?: string, value?: string, validator?: Function}>} [opts.fields]
 * @param {string} [opts.initialScope='devtools'] - Pre-selected scope
 * @param {string} opts.confirmLabel - Confirm button text
 * @param {string} [opts.confirmStyle='primary'] - 'primary' or 'danger'
 * @param {boolean} [opts.confirmDisabled=false] - Start with confirm disabled
 * @param {Function} opts.onConfirm - Called with { fields: {key: value}, scope }
 * @param {Function} opts.onCancel - Called on cancel
 * @returns {HTMLElement}
 */
export function buildRuleForm(opts) {
  const form = document.createElement('div');
  form.className = 'gtm-rule-form';

  // Heading
  if (opts.heading) {
    const heading = document.createElement('div');
    heading.className = 'gtm-rule-form-heading';
    heading.textContent = opts.heading;
    form.appendChild(heading);
  }

  // Fields
  const fieldInputs = {};
  const validators = {};
  const fields = opts.fields || [];

  for (const field of fields) {
    const wrapper = document.createElement('div');
    wrapper.className = 'gtm-rule-form-field';

    if (field.label) {
      const lbl = document.createElement('label');
      lbl.className = 'gtm-rule-form-label';
      lbl.textContent = field.label;
      wrapper.appendChild(lbl);
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'gtm-intercept-input' + (field.short ? ' gtm-input-short' : '');
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.value) input.value = field.value;

    if (field.validator) {
      validators[field.key] = field.validator;
      input.addEventListener('input', () => {
        const val = input.value.trim();
        const valid = field.validator(val);
        input.classList.toggle('gtm-input-valid', valid && val.length > 0);
        input.classList.toggle('gtm-input-error', !valid && val.length > 0);
        updateConfirmState();
      });
    }

    fieldInputs[field.key] = input;
    wrapper.appendChild(input);
    form.appendChild(wrapper);
  }

  // Scope toggle
  const scopeToggle = buildScopeToggle(opts.initialScope || 'devtools');
  form.appendChild(scopeToggle.container);

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.className = 'gtm-rule-form-buttons';

  const confirmBtn = document.createElement('button');
  const btnClass = opts.confirmStyle === 'danger' ? 'datalayer-push-btn-danger' : 'datalayer-push-btn-primary';
  confirmBtn.className = `datalayer-push-btn ${btnClass}`;
  confirmBtn.textContent = opts.confirmLabel;
  if (opts.confirmDisabled) confirmBtn.disabled = true;

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'datalayer-push-btn';
  cancelBtn.textContent = 'Cancel';

  btnRow.appendChild(confirmBtn);
  btnRow.appendChild(cancelBtn);
  form.appendChild(btnRow);

  // Validation state check
  function updateConfirmState() {
    const hasValidators = Object.keys(validators).length > 0;
    if (!hasValidators) return;
    const allValid = Object.entries(validators).every(([key, fn]) =>
      fn(fieldInputs[key].value.trim())
    );
    confirmBtn.disabled = !allValid;
  }

  // Events
  confirmBtn.addEventListener('click', () => {
    const values = {};
    for (const [key, input] of Object.entries(fieldInputs)) {
      values[key] = input.value.trim();
    }
    opts.onConfirm({ fields: values, scope: scopeToggle.getValue() });
  });

  cancelBtn.addEventListener('click', () => {
    opts.onCancel();
  });

  return form;
}

/**
 * Initialize the GTM Intercept module.
 * @param {Object} deps
 * @param {Function} deps.getState - Returns panel state
 * @param {Function} deps.escapeHtml - HTML escape utility
 * @param {Function} deps.getDetectedGTMContainers - Returns detected GTM containers on current page
 * @param {Function} deps.getCurrentDomain - Returns current page hostname
 */
export function initGTMIntercept(deps) {
  _deps = deps;
}

/**
 * Render active rules content into a given container element.
 * Used by gtm-modal.js for the "Active Rules" collapsible section.
 * @param {HTMLElement} container
 * @param {Array} rules
 * @param {string} domain
 */
export function renderActiveRulesContent(container, rules, domain) {
  renderActiveRules(container, rules, domain);
}

/**
 * Get the current domain's active intercept rules.
 * @param {Function} callback - Receives { rules, domain }
 */
export function getActiveInterceptRules(callback) {
  chrome.storage.local.get(['gtmInterceptRules'], (result) => {
    const rules = result.gtmInterceptRules || [];
    const domain = _deps?.getCurrentDomain() || '';
    const activeRules = rules.filter(r => r.active && (!r.domain || r.domain === domain));
    callback({ rules: activeRules, domain });
  });
}

// ========================================
// Domain scope helpers
// ========================================

/**
 * Extract top-level domain (with leading dot) from a hostname.
 * e.g. www.kyowakirinhub.com → .kyowakirinhub.com
 */
export function getTopDomain(domain) {
  if (!domain) return null;
  const parts = domain.split('.');
  if (parts.length <= 2) return '.' + domain;
  return '.' + parts.slice(-2).join('.');
}

/**
 * Format a rule's domain for human-readable display.
 */
export function formatDomainScope(rule) {
  if (!rule.domain) return 'Global';
  if (rule.domain.startsWith('.')) return '*' + rule.domain;
  if (rule.domain.startsWith('regex:')) return '/' + rule.domain.slice(6) + '/';
  return rule.domain;
}

/**
 * Check whether a rule's domain field matches the given current hostname.
 * Supports: exact, subdomain wildcard (.example.com), global (null), regex (regex:pattern).
 */
export function matchesDomain(rule, currentDomain) {
  if (!rule.domain) return true;
  if (!currentDomain) return false;
  if (rule.domain.startsWith('.')) {
    const base = rule.domain.slice(1);
    return currentDomain === base || currentDomain.endsWith(rule.domain);
  }
  if (rule.domain.startsWith('regex:')) {
    try {
      return new RegExp(rule.domain.slice(6)).test(currentDomain);
    } catch { return false; }
  }
  return rule.domain === currentDomain;
}

// ========================================
// Detected Containers
// ========================================

function renderDetectedContainers(wrapper, rules, domain) {
  const section = document.createElement('div');
  section.className = 'gtm-intercept-section';

  const heading = document.createElement('h3');
  heading.className = 'gtm-intercept-heading';
  heading.textContent = 'Detected on this page';
  section.appendChild(heading);

  const containers = _deps.getDetectedGTMContainers();

  if (containers.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'gtm-intercept-empty';
    empty.textContent = 'No GTM containers detected on this page.';
    section.appendChild(empty);
  } else {
    containers.forEach(containerId => {
      const existingRule = rules.find(r => r.containerId === containerId && r.active && (!r.domain || r.domain === domain));
      const row = createContainerRow(containerId, existingRule, domain);
      section.appendChild(row);
    });
  }

  wrapper.appendChild(section);
}

function createContainerRow(containerId, existingRule, domain) {
  const row = document.createElement('div');
  row.className = 'gtm-intercept-row';

  const label = document.createElement('span');
  label.className = 'gtm-intercept-container-id';
  label.textContent = containerId;
  row.appendChild(label);

  if (existingRule) {
    // Show current state and restore button
    const statusSpan = document.createElement('span');
    statusSpan.className = 'gtm-intercept-status';
    if (existingRule.action === 'block') {
      statusSpan.textContent = 'Blocked';
      statusSpan.classList.add('gtm-status-blocked');
    } else if (existingRule.action === 'replace') {
      statusSpan.textContent = `→ ${_deps.escapeHtml(existingRule.replacementId)}`;
      statusSpan.classList.add('gtm-status-replaced');
    }
    row.appendChild(statusSpan);

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'datalayer-push-btn';
    restoreBtn.textContent = 'Restore';
    restoreBtn.title = 'Remove this intercept rule';
    restoreBtn.addEventListener('click', () => {
      removeRule(existingRule.id);
      trackEvent('gtm_intercept', { action: 'restore', container_id: containerId });
    });
    row.appendChild(restoreBtn);
  } else {
    // Block button
    const blockBtn = document.createElement('button');
    blockBtn.className = 'datalayer-push-btn datalayer-push-btn-danger';
    blockBtn.textContent = 'Block';
    blockBtn.title = 'Block this GTM container on this domain';
    blockBtn.addEventListener('click', () => {
      row.querySelector('.gtm-rule-form')?.remove();
      const form = buildRuleForm({
        heading: `Block ${containerId}`,
        fields: [{ key: 'note', placeholder: 'Note (optional)' }],
        confirmLabel: 'Block',
        confirmStyle: 'danger',
        onConfirm: ({ fields, scope }) => {
          addRule({ containerId, action: 'block', domain, note: fields.note || null, scope });
          trackEvent('gtm_intercept', { action: 'block', container_id: containerId, scope });
        },
        onCancel: () => form.remove()
      });
      row.appendChild(form);
    });
    row.appendChild(blockBtn);

    // Swap button with inline form
    const replaceBtn = document.createElement('button');
    replaceBtn.className = 'datalayer-push-btn';
    replaceBtn.textContent = 'Swap';
    replaceBtn.title = 'Replace with a different GTM container';
    replaceBtn.addEventListener('click', () => {
      row.querySelector('.gtm-rule-form')?.remove();
      const form = buildRuleForm({
        heading: 'Swap to',
        fields: [
          { key: 'replacementId', placeholder: 'GTM-XXXXXX', short: true, validator: v => GTM_ID_REGEX.test(v.trim().toUpperCase()) },
          { key: 'note', placeholder: 'Note (optional)' }
        ],
        confirmLabel: 'Swap',
        confirmDisabled: true,
        onConfirm: ({ fields, scope }) => {
          const replacementId = fields.replacementId.trim().toUpperCase();
          addRule({ containerId, action: 'replace', replacementId, domain, note: fields.note || null, scope });
          trackEvent('gtm_intercept', { action: 'replace', container_id: containerId, replacement_id: replacementId, scope });
        },
        onCancel: () => form.remove()
      });
      row.appendChild(form);
    });
    row.appendChild(replaceBtn);
  }

  return row;
}

// ========================================
// Active Rules
// ========================================

function renderActiveRules(wrapper, rules, domain) {
  const domainRules = rules.filter(r => r.active && matchesDomain(r, domain));

  const section = document.createElement('div');
  section.className = 'gtm-intercept-section';

  if (domainRules.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'gtm-intercept-empty';
    empty.textContent = 'No active intercept rules for this domain.';
    section.appendChild(empty);
  } else {
    domainRules.forEach(rule => {
      const row = document.createElement('div');
      row.className = 'gtm-intercept-rule-row';

      // Bullet
      const bullet = document.createElement('span');
      bullet.className = 'gtm-intercept-bullet';
      bullet.textContent = '●';
      if (rule.action === 'block') bullet.classList.add('gtm-bullet-blocked');
      else if (rule.action === 'replace') bullet.classList.add('gtm-bullet-replaced');
      else if (rule.action === 'preview') bullet.classList.add('gtm-bullet-preview');
      row.appendChild(bullet);

      // Main info: container ID + scope badge
      const infoWrap = document.createElement('div');
      infoWrap.className = 'gtm-intercept-rule-info';

      const idLine = document.createElement('div');
      idLine.className = 'gtm-intercept-rule-id-line';

      const desc = document.createElement('span');
      desc.className = 'gtm-intercept-rule-desc';
      if (rule.action === 'block') {
        desc.textContent = `${rule.containerId} — blocked`;
      } else if (rule.action === 'replace') {
        desc.textContent = `${rule.containerId} \u2192 ${rule.replacementId}`;
      } else if (rule.action === 'preview') {
        desc.textContent = `${rule.containerId} — preview ${rule.gtmPreview || ''}`;
      }
      idLine.appendChild(desc);

      const domainBadge = document.createElement('span');
      domainBadge.className = 'gtm-rule-domain-badge';
      domainBadge.textContent = formatDomainScope(rule);
      idLine.appendChild(domainBadge);

      const scopeBadge = document.createElement('span');
      const ruleScope = rule.scope || 'always';
      scopeBadge.className = `gtm-scope-badge ${ruleScope === 'always' ? 'gtm-scope-always' : 'gtm-scope-devtools'}`;
      scopeBadge.textContent = ruleScope === 'always' ? 'Always' : 'DevTools';
      idLine.appendChild(scopeBadge);

      infoWrap.appendChild(idLine);

      if (rule.note) {
        const noteEl = document.createElement('span');
        noteEl.className = 'gtm-rule-note';
        noteEl.textContent = rule.note;
        infoWrap.appendChild(noteEl);
      }

      row.appendChild(infoWrap);

      // Actions
      const actionsWrap = document.createElement('div');
      actionsWrap.className = 'gtm-intercept-rule-actions';

      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'datalayer-push-btn';
      restoreBtn.textContent = 'Restore';
      restoreBtn.title = 'Remove this intercept rule';
      restoreBtn.addEventListener('click', () => {
        removeRule(rule.id);
        trackEvent('gtm_intercept', { action: 'restore', container_id: rule.containerId });
      });
      actionsWrap.appendChild(restoreBtn);

      row.appendChild(actionsWrap);
      section.appendChild(row);
    });

    // Restore All button
    const restoreAllBtn = document.createElement('button');
    restoreAllBtn.className = 'datalayer-push-btn gtm-intercept-restore-all';
    restoreAllBtn.textContent = 'Restore All';
    restoreAllBtn.title = 'Remove all rules for this domain';
    restoreAllBtn.addEventListener('click', () => {
      removeAllRulesForDomain(domain);
      trackEvent('gtm_intercept', { action: 'restore_all' });
    });
    section.appendChild(restoreAllBtn);
  }

  // Reload prompt
  const reloadPrompt = document.createElement('div');
  reloadPrompt.className = 'gtm-intercept-reload';
  reloadPrompt.id = 'gtm-intercept-reload';
  reloadPrompt.style.display = 'none';

  const reloadIcon = document.createElement('span');
  reloadIcon.textContent = '\u26a0';
  reloadPrompt.appendChild(reloadIcon);

  const reloadText = document.createElement('span');
  reloadText.textContent = ' Reload page to apply changes';
  reloadPrompt.appendChild(reloadText);

  const reloadBtn = document.createElement('button');
  reloadBtn.className = 'datalayer-push-btn datalayer-push-btn-primary';
  reloadBtn.textContent = 'Reload';
  reloadBtn.addEventListener('click', () => {
    chrome.devtools.inspectedWindow.reload();
  });
  reloadPrompt.appendChild(reloadBtn);

  section.appendChild(reloadPrompt);
  wrapper.appendChild(section);
}

// ========================================
// Rule Management (storage + DNR sync)
// ========================================

/**
 * Allocate the next DNR rule ID, confined to the base band [BASE, BASE+OFFSET)
 * so an allocated ID can never land on a preview-allow twin (base+OFFSET) (F13).
 * Fast path: highest in-band ID + 1. If that would cross into the reserved band
 * (~5000 active rules — practically unreachable), fall back to the lowest free
 * slot in the base band.
 */
function allocateDnrRuleId(existingRules) {
  const used = new Set(
    existingRules.map(r => r.dnrRuleId).filter(n => typeof n === 'number')
  );
  let maxId = GTM_DNR_RULE_ID_BASE;
  for (const id of used) {
    if (id >= maxId && id <= GTM_DNR_RULE_ID_MAX) maxId = id + 1;
  }
  if (maxId <= GTM_DNR_RULE_ID_MAX) return maxId;
  // Reserved band reached — scan for the lowest free slot in the base band.
  for (let id = GTM_DNR_RULE_ID_BASE; id <= GTM_DNR_RULE_ID_MAX; id++) {
    if (!used.has(id)) return id;
  }
  // Base band genuinely exhausted (≥5000 live rules) — extreme edge; reuse base.
  return GTM_DNR_RULE_ID_BASE;
}

/**
 * Parse a GTM preview share link or snippet to extract gtm_auth and gtm_preview values.
 * Accepts formats like:
 *   - Full URL: https://tagmanager.google.com/...&gtm_auth=TOKEN&gtm_preview=env-N...
 *   - Snippet fragment: &gtm_auth=TOKEN&gtm_preview=env-N&gtm_cookies_win=x
 *   - gtm.js URL: ...gtm.js?id=GTM-XXXX&gtm_auth=TOKEN&gtm_preview=env-N
 * @param {string} input - User-pasted link or snippet
 * @returns {{ gtmAuth: string, gtmPreview: string } | null}
 */
export function parsePreviewLink(input) {
  if (!input) return null;
  const str = input.trim();

  // Try to extract gtm_auth and gtm_preview from anywhere in the string
  const authMatch = str.match(/gtm_auth=([A-Za-z0-9_-]+)/);
  const previewMatch = str.match(/gtm_preview=(env-\d+)/);

  if (authMatch && previewMatch) {
    return { gtmAuth: authMatch[1], gtmPreview: previewMatch[1] };
  }
  return null;
}

/**
 * Add a new intercept rule.
 * @param {Object} opts - { containerId, action, replacementId?, domain, gtmAuth?, gtmPreview? }
 */
export function addRule(opts) {
  chrome.storage.local.get(['gtmInterceptRules'], (result) => {
    const rules = result.gtmInterceptRules || [];

    // Remove any existing rule for this container on this domain
    const filtered = rules.filter(r => !(r.containerId === opts.containerId && r.domain === opts.domain && r.active));

    const newRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      dnrRuleId: allocateDnrRuleId(filtered),
      domain: opts.domain,
      containerId: opts.containerId,
      action: opts.action,
      replacementId: opts.replacementId || null,
      gtmAuth: opts.gtmAuth || null,
      gtmPreview: opts.gtmPreview || null,
      gtmDebug: opts.gtmDebug || false,
      note: opts.note || null,
      scope: opts.scope || 'devtools',
      createdAt: new Date().toISOString(),
      active: true
    };
    filtered.push(newRule);

    persistRules(filtered);
  });
}

/**
 * Soft-disable a rule (sets active: false, keeps it for reactivation).
 */
export function disableRule(ruleId) {
  chrome.storage.local.get(['gtmInterceptRules'], (result) => {
    const rules = (result.gtmInterceptRules || []).map(r =>
      r.id === ruleId ? { ...r, active: false } : r
    );
    persistRules(rules);
  });
}

/**
 * Reactivate a previously disabled rule (sets active: true).
 */
export function reactivateRule(ruleId) {
  chrome.storage.local.get(['gtmInterceptRules'], (result) => {
    const rules = (result.gtmInterceptRules || []).map(r =>
      r.id === ruleId ? { ...r, active: true } : r
    );
    persistRules(rules);
  });
}

/**
 * Update a rule's editable fields (note, scope).
 * Only shows reload prompt if scope changed (note edits don't affect DNR).
 * @param {string} ruleId
 * @param {{ note?: string|null, scope?: 'devtools'|'always' }} updates
 */
export function updateRule(ruleId, updates) {
  chrome.storage.local.get(['gtmInterceptRules'], (result) => {
    let scopeChanged = false;
    const rules = (result.gtmInterceptRules || []).map(r => {
      if (r.id !== ruleId) return r;
      if (updates.scope && updates.scope !== (r.scope || 'always')) scopeChanged = true;
      return { ...r, ...updates };
    });
    persistRules(rules, { reload: scopeChanged });
  });
}

/**
 * Remove a rule by ID.
 */
export function removeRule(ruleId) {
  chrome.storage.local.get(['gtmInterceptRules'], (result) => {
    const rules = (result.gtmInterceptRules || []).filter(r => r.id !== ruleId);
    persistRules(rules);
  });
}

/**
 * Remove all rules for a domain.
 */
export function removeAllRulesForDomain(domain) {
  chrome.storage.local.get(['gtmInterceptRules'], (result) => {
    const rules = (result.gtmInterceptRules || []).filter(r => r.domain !== domain);
    persistRules(rules);
  });
}

function showReloadPrompt() {
  const el = document.getElementById('gtm-intercept-reload');
  if (el) el.style.display = 'flex';
}

/**
 * Persist the rule list to storage and sync DNR — the single funnel for every
 * rule write so the `chrome.runtime.lastError` check lives in exactly one place
 * (F10). Previously each CRUD callback ignored `lastError` and redrew the UI as
 * if the write had succeeded, so a transient storage failure produced a silent
 * false-success — the user believed a block/swap rule was saved when it wasn't.
 *
 * On failure we log, then re-render WITHOUT firing the DNR-sync message or the
 * reload prompt (nothing actually changed). The re-render re-reads storage, so
 * the UI reflects the true (unchanged) rule set instead of the phantom success.
 *
 * @param {Array} rules - the full rule list to persist
 * @param {{ reload?: boolean }} [opts] - whether to show the reload prompt on success
 */
function persistRules(rules, { reload = true } = {}) {
  chrome.storage.local.set({ gtmInterceptRules: rules }, () => {
    if (chrome.runtime.lastError) {
      console.warn('[EventWatcher] GTM intercept rule save failed:', chrome.runtime.lastError.message);
      reRenderIfVisible();
      return;
    }
    chrome.runtime.sendMessage({ type: MSG.GTM_INTERCEPT_UPDATED });
    if (reload) showReloadPrompt();
    reRenderIfVisible();
  });
}

function reRenderIfVisible() {
  // Notify all listeners (gtm-modal.js, panel.js) that a rule changed.
  // Each listener decides whether to re-render based on its own visibility state.
  document.dispatchEvent(new CustomEvent('gtmRuleChanged'));
}

// ========================================
// Quick Action Helpers (for event-detail.js)
// ========================================

/**
 * Create a small SVG icon element for action buttons.
 */
function makeSvgIcon(type) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.5');
  if (type === 'block') {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '10');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', 'M4.93 4.93l14.14 14.14');
    svg.appendChild(circle); svg.appendChild(line);
  } else if (type === 'swap') {
    const p1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p1.setAttribute('d', 'M1 4v6h6');
    const p2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p2.setAttribute('d', 'M23 20v-6h-6');
    const p3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p3.setAttribute('d', 'M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15');
    svg.appendChild(p1); svg.appendChild(p2); svg.appendChild(p3);
  }
  return svg;
}

/**
 * Update a block button element to its "Blocked" active visual state.
 */
function setBlockedState(btn) {
  btn.textContent = '';
  btn.appendChild(makeSvgIcon('block'));
  btn.appendChild(document.createTextNode('Blocked'));
  btn.classList.add('action-btn--active');
}

/**
 * Create Block/Swap action buttons for a GTM container event.
 * @param {string} containerId - GTM container ID
 * @param {string} domain - Current page domain
 * @returns {HTMLElement[]} Array of button elements
 */
/**
 * Append Disable + Remove buttons for an active rule.
 */
function _appendDisableRemove(parent, rule, containerId) {
  const disableBtn = document.createElement('button');
  disableBtn.className = 'action-btn';
  disableBtn.textContent = 'Disable';
  disableBtn.title = 'Disable this rule (keeps it for easy reactivation)';
  disableBtn.addEventListener('click', () => {
    disableRule(rule.id);
    trackEvent('gtm_intercept', { action: 'disable', container_id: containerId });
  });
  parent.appendChild(disableBtn);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'action-btn';
  removeBtn.textContent = 'Remove';
  removeBtn.title = 'Permanently remove this rule';
  removeBtn.addEventListener('click', () => {
    removeRule(rule.id);
    trackEvent('gtm_intercept', { action: 'remove', container_id: containerId });
  });
  parent.appendChild(removeBtn);
}

/**
 * @param {string} containerId
 * @param {string} domain
 * @param {HTMLElement} [formTarget] - Element to append inline forms to (defaults to button parent)
 */
export function createGTMInterceptButtons(containerId, domain, formTarget) {
  const buttons = [];
  const placeholder = document.createElement('span');
  buttons.push(placeholder);

  chrome.storage.local.get(['gtmInterceptRules'], (result) => {
    const rules = result.gtmInterceptRules || [];
    const parent = placeholder.parentElement;
    if (!parent) return;
    placeholder.remove();
    const formContainer = formTarget || parent;

    // Direct rule: this container is the subject
    const directRule = rules.find(r =>
      r.containerId === containerId && r.active && matchesDomain(r, domain)
    );
    // Swap target: this container is the replacement in someone else's swap rule
    const swapTargetRule = !directRule ? rules.find(r =>
      r.replacementId === containerId && r.action === 'replace' && r.active && matchesDomain(r, domain)
    ) : null;

    // --- Any active rule (inject, block, swap, preview): Disable | Remove ---
    const activeRule = directRule || swapTargetRule;
    if (activeRule) {
      _appendDisableRemove(parent, activeRule, containerId);
      return;
    }

    // --- No active rule: Block / Swap ---
    const blockBtn = document.createElement('button');
    blockBtn.className = 'action-btn action-btn--block';
    blockBtn.appendChild(makeSvgIcon('block'));
    blockBtn.appendChild(document.createTextNode('Block'));
    blockBtn.title = 'Block this GTM container';
    blockBtn.addEventListener('click', () => {
      // Remove existing forms (rule form or preview form)
      formContainer.querySelector('.gtm-rule-form')?.remove();
      formContainer.querySelector('.gtm-preview-form')?.remove();

      const form = buildRuleForm({
        heading: `Block ${containerId}`,
        fields: [{ key: 'note', placeholder: 'Note (optional)' }],
        confirmLabel: 'Block',
        confirmStyle: 'danger',
        onConfirm: ({ fields, scope }) => {
          addRule({ containerId, action: 'block', domain, note: fields.note || null, scope });
          trackEvent('gtm_intercept', { action: 'block', container_id: containerId, scope });
        },
        onCancel: () => form.remove()
      });
      // Insert form right after the action bar, not at the end of the container
      parent.after(form);
    });
    parent.appendChild(blockBtn);

    const swapBtn = document.createElement('button');
    swapBtn.className = 'action-btn action-btn--swap';
    swapBtn.appendChild(makeSvgIcon('swap'));
    swapBtn.appendChild(document.createTextNode('Swap'));
    swapBtn.title = 'Replace with a different GTM container';
    swapBtn.addEventListener('click', () => {
      // Remove existing forms (rule form or preview form)
      formContainer.querySelector('.gtm-rule-form')?.remove();
      formContainer.querySelector('.gtm-preview-form')?.remove();

      const form = buildRuleForm({
        heading: 'Swap to',
        fields: [
          { key: 'replacementId', placeholder: 'GTM-XXXXXX', short: true, validator: v => GTM_ID_REGEX.test(v.trim().toUpperCase()) },
          { key: 'note', placeholder: 'Note (optional)' }
        ],
        confirmLabel: 'Swap',
        confirmDisabled: true,
        onConfirm: ({ fields, scope }) => {
          const replacementId = fields.replacementId.trim().toUpperCase();
          addRule({ containerId, action: 'replace', replacementId, domain, note: fields.note || null, scope });
          trackEvent('gtm_intercept', { action: 'replace', container_id: containerId, replacement_id: replacementId, scope });
        },
        onCancel: () => form.remove()
      });
      // Insert form right after the action bar
      parent.after(form);
    });
    parent.appendChild(swapBtn);
  });

  return buttons;
}

