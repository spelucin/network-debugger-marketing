/**
 * GTM Hub Modal
 *
 * Dedicated modal for GTM container intelligence, intercept management, and quick actions.
 * Accessible via the #gtm-btn toolbar button (left of the Tools button).
 *
 * Owns all GTM intercept UI that was previously in the Tools modal.
 * Container cards are the primary entry point — each detected container gets its own
 * collapsible card with intelligence, script dependencies, and quick actions.
 *
 * Two-way sync: actions taken here are reflected in event-detail, and vice versa,
 * via the 'gtmRuleChanged' custom DOM event dispatched by gtm-intercept.js.
 */

import { trackEvent } from '../analytics.js';
import { getPlatformIcon } from './platform-icons.js';
import { registerModalCloser, closeOtherModals } from './modal-utils.js';
import { renderAISummarySection } from './ai-summary-section.js';
import {
  initGTMIntercept,
  createGTMInterceptButtons,
  matchesDomain,
  formatDomainScope,
  addRule,
  removeRule,
  disableRule,
  reactivateRule,
  removeAllRulesForDomain,
  parsePreviewLink,
  getTopDomain,
  buildScopeToggle,
  buildRuleForm,
  updateRule
} from './gtm-intercept.js';

let _deps;

// ============================================================
// Init & lifecycle
// ============================================================

/**
 * Initialize the GTM Hub Modal module.
 * @param {Object} deps
 * @param {Function} deps.getState              - Returns panel state
 * @param {Function} deps.getDetectedGTMContainers - Returns detected container IDs
 * @param {Function} deps.getCurrentDomain      - Returns current page hostname
 * @param {Function} deps.getScriptsLoadedBy    - Returns child script events for a URL
 * @param {Function} deps.escapeHtml            - HTML escape utility
 */
export function initGTMModal(deps) {
  _deps = deps;

  registerModalCloser('gtm-panel', closeGTMModal);

  // Initialize the shared GTM Intercept module with our deps
  initGTMIntercept({
    getState: deps.getState,
    escapeHtml: deps.escapeHtml,
    getDetectedGTMContainers: deps.getDetectedGTMContainers,
    getCurrentDomain: deps.getCurrentDomain
  });

  // Wire toolbar button
  const gtmBtn = document.getElementById('gtm-btn');
  if (gtmBtn) {
    gtmBtn.addEventListener('click', () => {
      if (_isOpen()) {
        closeGTMModal();
      } else {
        openGTMModal();
      }
    });
  }

  // Wire close button
  const closeBtn = document.getElementById('gtm-panel-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeGTMModal);
  }

  // Close on backdrop click
  const panel = document.getElementById('gtm-panel');
  if (panel) {
    panel.addEventListener('click', (e) => {
      if (e.target === panel) closeGTMModal();
    });
  }

  // Re-render modal and update button state whenever a rule changes
  document.addEventListener('gtmRuleChanged', () => {
    if (_isOpen()) renderGTMModal();
    updateGTMButtonState();
  });

  // Auto-refresh modal when a new GTM container is detected mid-session
  document.addEventListener('gtmContainerDetected', () => {
    if (_isOpen()) renderGTMModal();
  });
}

export function openGTMModal() {
  const panel = document.getElementById('gtm-panel');
  if (!panel) return;

  closeOtherModals('gtm-panel');

  panel.classList.add('open');
  renderGTMModal();
  updateGTMButtonState();
  trackEvent('gtm_hub_modal', { action: 'open' });
}

export function closeGTMModal() {
  document.getElementById('gtm-panel')?.classList.remove('open');
}

function _isOpen() {
  return document.getElementById('gtm-panel')?.classList.contains('open') ?? false;
}

// ============================================================
// Main render
// ============================================================

export function renderGTMModal() {
  const body = document.getElementById('gtm-panel-body');
  if (!body) return;

  chrome.storage.local.get(['gtmInterceptRules'], (result) => {
    const rules = result.gtmInterceptRules || [];
    const domain = _deps.getCurrentDomain();

    body.textContent = '';

    const containers = _deps.getDetectedGTMContainers();

    // Rules section — grouped by domain
    body.appendChild(_renderRulesSection(rules, domain));

    if (containers.length === 0) {
      body.appendChild(_renderEmptyState());
    } else {
      containers.forEach((containerId, index) => {
        const containerEvent = _getLatestContainerEvent(containerId);
        const expandCard = containers.length === 1 || index === 0;
        body.appendChild(renderContainerCard(containerId, containerEvent, rules, domain, expandCard));
      });
    }
  });
}

// ============================================================
// Button state
// ============================================================

/**
 * Update #gtm-btn visual state based on detected containers and active rules
 * **scoped to the current domain**.
 *
 * States:
 *   default    — no GTM on page AND no matching rules (grey icon, nothing shown)
 *   .has-gtm   — GTM detected, no matching rules (blue icon + count badge)
 *   .has-rules — matching rules on this domain (blue icon + optional count + colored dots)
 *
 * Count badge (top-right): number of detected containers (hidden when 0).
 * Status dots (bottom row): red = block, amber = swap, purple = preview.
 */
export function updateGTMButtonState() {
  const btn = document.getElementById('gtm-btn');
  if (!btn) return;

  const containers = _deps.getDetectedGTMContainers();
  const domain = _deps.getCurrentDomain();

  // Reset all state
  btn.classList.remove('has-gtm', 'has-rules');
  const countEl = document.getElementById('gtm-btn-count');
  const dotBlock = document.getElementById('gtm-btn-dot-block');
  const dotSwap = document.getElementById('gtm-btn-dot-swap');
  const dotPreview = document.getElementById('gtm-btn-dot-preview');
  if (countEl) countEl.textContent = '';
  if (dotBlock) dotBlock.classList.remove('active');
  if (dotSwap) dotSwap.classList.remove('active');
  if (dotPreview) dotPreview.classList.remove('active');

  // BUG43: this runs from the chrome.devtools.network.onNavigated listener, which
  // keeps firing on a stale DevTools panel after the extension is reloaded /
  // reinstalled / has its ID change. Once the context is invalidated,
  // chrome.storage.local.get throws "Extension context invalidated" synchronously
  // before the callback runs. chrome.runtime.id is undefined after invalidation —
  // bail quietly so the dead panel doesn't spew errors until DevTools is reopened.
  if (!chrome.runtime?.id) return;

  chrome.storage.local.get(['gtmInterceptRules'], (result) => {
    const rules = result.gtmInterceptRules || [];
    // Use matchesDomain() so subdomain, regex, and global scopes all work
    const domainRules = rules.filter(r => r.active && matchesDomain(r, domain));

    const hasContainers = containers.length > 0;
    const hasRules = domainRules.length > 0;

    if (!hasContainers && !hasRules) return; // Nothing relevant on this domain

    // Show container count badge only when containers are detected
    if (hasContainers && countEl) {
      countEl.textContent = containers.length;
    }

    if (!hasRules) {
      btn.classList.add('has-gtm');
      return;
    }

    btn.classList.add('has-rules');

    // Activate dots for each rule type present on this domain
    const actions = new Set(domainRules.map(r => r.action));
    if (actions.has('block') && dotBlock) dotBlock.classList.add('active');
    if (actions.has('replace') && dotSwap) dotSwap.classList.add('active');
    if (actions.has('preview') && dotPreview) dotPreview.classList.add('active');
  });
}

// ============================================================
// Container card
// ============================================================

function renderContainerCard(containerId, event, rules, domain, expandCard = true) {
  const formatted = event?.formatted;
  // Direct rule: this container is the subject
  const directRule = rules.find(
    r => r.containerId === containerId && r.active && matchesDomain(r, domain)
  );
  // Swap target: this container is the replacement in someone else's swap
  const swapTargetRule = !directRule ? rules.find(
    r => r.replacementId === containerId && r.action === 'replace' && r.active && matchesDomain(r, domain)
  ) : null;
  const effectiveRule = directRule || swapTargetRule;

  const details = document.createElement('details');
  details.className = 'settings-section gtm-container-card';
  details.open = expandCard;

  details.appendChild(_renderCardSummary(containerId, event, formatted, effectiveRule, domain, !!swapTargetRule));

  const content = document.createElement('div');
  content.className = 'settings-section-content gtm-card-content';

  // Quick Actions — first, above intelligence
  content.appendChild(_renderQuickActions(containerId, domain));

  // AI Summary — rendered above Container Intelligence so the "ask the
  // model about this container" affordance is visible before the user
  // scrolls into the raw counts. Passing `scope: 'container'` forces
  // the badge label regardless of how ai-summary-section would
  // auto-resolve (makes it robust if the event arrives here without
  // its `formatted.containerData` block, which can happen briefly on
  // first paint before the response body is parsed).
  if (event && formatted?.containerData) {
    const aiSummary = renderAISummarySection(event, { scope: 'container' });
    if (aiSummary) {
      // Reuse the settings-section visual language so the card reads
      // coherently — the AI section's own styling already matches.
      aiSummary.classList.add('gtm-card-ai-summary');
      content.appendChild(aiSummary);
    }
  }

  // Container Intelligence
  if (formatted?.containerData) {
    content.appendChild(_renderContainerIntelligence(formatted.containerData));
  }

  // Script Dependencies
  if (event?.url) {
    const scriptDeps = _deps.getScriptsLoadedBy(event.url);
    if (scriptDeps.length > 0) {
      content.appendChild(_renderScriptDeps(scriptDeps));
    }
  }

  details.appendChild(content);
  return details;
}

function _renderCardSummary(containerId, event, formatted, existingRule, domain, isSwapTarget = false) {
  const summary = document.createElement('summary');
  summary.className = 'settings-section-summary';

  summary.appendChild(_makeChevron());

  // Container ID (monospace)
  const idEl = document.createElement('span');
  idEl.className = 'gtm-hub-container-id settings-section-title';
  idEl.textContent = containerId;
  summary.appendChild(idEl);

  // Copy ID button
  summary.appendChild(_makeCopyBtn(containerId));

  // Version badge
  if (formatted?.containerData?.version != null) {
    const vBadge = document.createElement('span');
    vBadge.className = 'gtm-hub-badge gtm-hub-badge-version';
    vBadge.textContent = `v${formatted.containerData.version}`;
    summary.appendChild(vBadge);
  }

  // HTTP status badge — only shown for non-200 (error/blocked)
  if (event?.status && event.status !== 200) {
    const sBadge = document.createElement('span');
    sBadge.className = 'gtm-hub-badge gtm-hub-badge-error';
    sBadge.textContent = String(event.status);
    sBadge.title = 'HTTP status of the GTM script request';
    summary.appendChild(sBadge);
  }

  // Intercept rule badge
  if (existingRule) {
    const rBadge = document.createElement('span');
    rBadge.className = 'gtm-hub-badge';
    if (isSwapTarget) {
      // This container is the replacement in a swap — show as swapped-in
      rBadge.textContent = `SWAPPED \u2190 ${existingRule.containerId}`;
      rBadge.classList.add('gtm-hub-badge-swapped');
    } else if (existingRule.action === 'block') {
      rBadge.textContent = 'BLOCKED';
      rBadge.classList.add('gtm-hub-badge-blocked');
    } else if (existingRule.action === 'replace') {
      rBadge.textContent = `SWAPPED \u2192 ${existingRule.replacementId}`;
      rBadge.classList.add('gtm-hub-badge-swapped');
    } else if (existingRule.action === 'preview') {
      const envLabel = existingRule.gtmPreview ? ` ${existingRule.gtmPreview}` : '';
      rBadge.textContent = `PREVIEW${envLabel}`;
      rBadge.classList.add('gtm-hub-badge-preview');
    }
    summary.appendChild(rBadge);
  }

  // Domain label — always last so badges don't shift it
  if (domain) {
    const domainEl = document.createElement('span');
    domainEl.className = 'gtm-hub-domain-label';
    domainEl.textContent = domain;
    summary.appendChild(domainEl);
  }

  return summary;
}

// ============================================================
// Container Intelligence sub-section
// ============================================================

function _renderContainerIntelligence(cd) {
  const section = document.createElement('div');
  section.className = 'gtm-hub-sub-section';

  const heading = document.createElement('h4');
  heading.className = 'gtm-hub-sub-heading';
  heading.textContent = 'Container Info';
  section.appendChild(heading);

  // Stats grid
  const activeTags = cd.tagCount - cd.pausedCount;
  const statsGrid = document.createElement('div');
  statsGrid.className = 'gtm-hub-stats-grid';

  const stats = [
    { label: 'Tags', value: activeTags },
    { label: 'Variables', value: cd.macroCount },
    { label: 'Triggers', value: cd.predicateCount }
  ];
  if (cd.pausedCount > 0) stats.push({ label: 'Paused', value: cd.pausedCount });

  for (const { label, value } of stats) {
    const stat = document.createElement('div');
    stat.className = 'gtm-hub-stat';
    const num = document.createElement('span');
    num.className = 'gtm-hub-stat-value';
    num.textContent = String(value);
    const lbl = document.createElement('span');
    lbl.className = 'gtm-hub-stat-label';
    lbl.textContent = label;
    stat.appendChild(num);
    stat.appendChild(lbl);
    statsGrid.appendChild(stat);
  }
  section.appendChild(statsGrid);

  // Event names — collapsible, collapsed by default
  if (cd.tagsByEvent?.length > 0) {
    const eventDetails = document.createElement('details');
    eventDetails.className = 'gtm-hub-event-names-details';

    const eventSummary = document.createElement('summary');
    eventSummary.className = 'gtm-hub-event-names-summary';

    const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('class', 'gtm-hub-event-names-chevron');
    chevron.setAttribute('width', '12');
    chevron.setAttribute('height', '12');
    chevron.setAttribute('viewBox', '0 0 24 24');
    chevron.setAttribute('fill', 'none');
    chevron.setAttribute('stroke', 'currentColor');
    chevron.setAttribute('stroke-width', '2');
    const chevronPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    chevronPath.setAttribute('d', 'M9 18l6-6-6-6');
    chevron.appendChild(chevronPath);
    eventSummary.appendChild(chevron);

    const summaryText = document.createElement('span');
    summaryText.textContent = `Event Names (${cd.tagsByEvent.length})`;
    eventSummary.appendChild(summaryText);
    eventDetails.appendChild(eventSummary);

    const eventContent = document.createElement('div');
    eventContent.className = 'gtm-hub-event-names-content';

    // Info box
    const infoBox = document.createElement('div');
    infoBox.className = 'gtm-hub-info-box';
    infoBox.textContent = 'Only events from tags that use the standard Event Name field are listed here (e.g. GA4, Amplitude, Mixpanel). Tags with dynamic values, custom templates, or non-standard event fields may not appear.';
    eventContent.appendChild(infoBox);

    const list = document.createElement('div');
    list.className = 'gtm-hub-event-list';
    for (const ev of cd.tagsByEvent) {
      const item = document.createElement('div');
      item.className = 'gtm-hub-event-item';

      const nameEl = document.createElement('span');
      nameEl.className = 'gtm-hub-event-name';
      nameEl.textContent = ev.name;
      item.appendChild(nameEl);

      if (ev.paused > 0) {
        const pausedEl = document.createElement('span');
        pausedEl.className = 'gtm-hub-event-paused';
        pausedEl.textContent = ev.paused === ev.total ? '\u23f8 Paused' : `\u23f8 ${ev.paused} paused`;
        item.appendChild(pausedEl);
      }
      list.appendChild(item);
    }
    eventContent.appendChild(list);
    eventDetails.appendChild(eventContent);
    section.appendChild(eventDetails);
  }

  return section;
}

// ============================================================
// Script Dependencies sub-section
// ============================================================

function _renderScriptDeps(scriptEvents) {
  const section = document.createElement('div');
  section.className = 'gtm-hub-sub-section';

  const heading = document.createElement('h4');
  heading.className = 'gtm-hub-sub-heading';
  heading.textContent = `Script Dependencies (${scriptEvents.length})`;
  section.appendChild(heading);

  const list = document.createElement('div');
  list.className = 'gtm-hub-deps-list';

  for (const scriptEvent of scriptEvents) {
    const url = scriptEvent.url || scriptEvent.raw?.url || '';
    const platform = scriptEvent.platform;

    const item = document.createElement('div');
    item.className = 'gtm-hub-dep-item';

    const bullet = document.createElement('span');
    bullet.className = 'gtm-hub-dep-bullet';
    bullet.textContent = '\u00b7';
    item.appendChild(bullet);

    const urlEl = document.createElement('span');
    urlEl.className = 'gtm-hub-dep-url';
    try {
      const u = new URL(url);
      const path = u.pathname.length > 1
        ? u.pathname.slice(0, 50) + (u.pathname.length > 50 ? '\u2026' : '')
        : '';
      urlEl.textContent = u.hostname + path;
    } catch {
      urlEl.textContent = url.slice(0, 70);
    }
    urlEl.title = url;
    item.appendChild(urlEl);

    if (platform && platform !== 'unknown') {
      const platEl = document.createElement('span');
      platEl.className = 'gtm-hub-dep-platform';
      const icon = getPlatformIcon(platform);
      if (icon) {
        platEl.innerHTML = icon;
      }
      const platText = document.createElement('span');
      platText.textContent = platform;
      platEl.appendChild(platText);
      item.appendChild(platEl);
    }

    list.appendChild(item);
  }

  section.appendChild(list);
  return section;
}

// ============================================================
// Quick Actions sub-section
// ============================================================

function _renderQuickActions(containerId, domain) {
  const section = document.createElement('div');
  section.className = 'gtm-hub-sub-section gtm-hub-actions-section';

  const heading = document.createElement('h4');
  heading.className = 'gtm-hub-sub-heading';
  heading.textContent = 'Quick Actions';
  section.appendChild(heading);

  const bar = document.createElement('div');
  bar.className = 'gtm-hub-action-bar gtm-hub-action-bar--prominent event-action-bar';

  // Block / Swap / Restore — reuse the same buttons as event-detail
  // Pass section as formTarget so inline forms appear below the action bar (like Preview)
  const interceptBtns = createGTMInterceptButtons(containerId, domain, section);
  interceptBtns.forEach(btn => bar.appendChild(btn));

  // Preview button — opens inline form to paste a GTM preview/share link
  const previewBtn = document.createElement('button');
  previewBtn.className = 'action-btn action-btn--preview-action';
  previewBtn.title = 'Load a GTM environment preview on this page';

  // Check if there's an existing preview rule for this container
  chrome.storage.local.get(['gtmInterceptRules'], (result) => {
    const rules = result.gtmInterceptRules || [];
    const existingPreview = rules.find(
      r => r.containerId === containerId && r.action === 'preview' && r.active && matchesDomain(r, domain)
    );

    if (existingPreview) {
      // Show active preview state
      previewBtn.textContent = '';
      previewBtn.appendChild(_makePreviewIcon());
      previewBtn.appendChild(document.createTextNode(`Preview ${existingPreview.gtmPreview || ''}`));
      previewBtn.classList.add('action-btn--active', 'action-btn--preview');
      previewBtn.disabled = true;
      previewBtn.title = `Preview active: ${existingPreview.gtmPreview}`;

      // Reload button — hard refresh to fetch latest gtm.js (bypasses browser cache)
      const reloadBtn = document.createElement('button');
      reloadBtn.className = 'action-btn action-btn--reload';
      reloadBtn.title = 'Hard refresh — fetches the latest container version from GTM (bypasses cache)';
      const reloadSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      reloadSvg.setAttribute('width', '12');
      reloadSvg.setAttribute('height', '12');
      reloadSvg.setAttribute('viewBox', '0 0 24 24');
      reloadSvg.setAttribute('fill', 'none');
      reloadSvg.setAttribute('stroke', 'currentColor');
      reloadSvg.setAttribute('stroke-width', '2.5');
      reloadSvg.setAttribute('stroke-linecap', 'round');
      reloadSvg.setAttribute('stroke-linejoin', 'round');
      const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      polyline.setAttribute('points', '23 4 23 10 17 10');
      reloadSvg.appendChild(polyline);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M20.49 15a9 9 0 1 1-2.12-9.36L23 10');
      reloadSvg.appendChild(path);
      reloadBtn.appendChild(reloadSvg);
      reloadBtn.appendChild(document.createTextNode(' Reload'));
      reloadBtn.addEventListener('click', () => {
        chrome.devtools.inspectedWindow.reload({ ignoreCache: true });
        trackEvent('gtm_intercept', { action: 'preview_reload', container_id: containerId });
      });
      bar.appendChild(reloadBtn);

      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'action-btn';
      restoreBtn.textContent = 'End Preview';
      restoreBtn.title = 'Remove the preview rule and restore the live container';
      restoreBtn.addEventListener('click', () => {
        removeRule(existingPreview.id);
        trackEvent('gtm_intercept', { action: 'end_preview', container_id: containerId });
      });
      bar.appendChild(restoreBtn);
    } else {
      previewBtn.appendChild(_makePreviewIcon());
      previewBtn.appendChild(document.createTextNode('Preview'));
      previewBtn.addEventListener('click', () => {
        _showPreviewForm(section, containerId, domain);
      });
    }
  });

  bar.appendChild(previewBtn);

  section.appendChild(bar);
  return section;
}

// ============================================================
// Rules section (collapsible) — domain-first grouping
// ============================================================

function _renderRulesSection(rules, domain) {
  const details = document.createElement('details');
  details.className = 'settings-section';
  details.open = true;

  const summary = document.createElement('summary');
  summary.className = 'settings-section-summary';
  summary.appendChild(_makeChevron());

  const title = document.createElement('span');
  title.className = 'settings-section-title';
  title.textContent = 'Rules';
  summary.appendChild(title);

  if (rules.length > 0) {
    const badge = document.createElement('span');
    badge.className = 'settings-section-badge';
    badge.textContent = String(rules.length);
    summary.appendChild(badge);
  }

  if (domain) {
    const domainEl = document.createElement('span');
    domainEl.className = 'gtm-hub-domain-label';
    domainEl.textContent = domain;
    summary.appendChild(domainEl);
  }

  details.appendChild(summary);

  const content = document.createElement('div');
  content.className = 'settings-section-content gtm-intercept-view';

  {
    // Group all rules by top-domain
    const byTopDomain = new Map();
    const currentTopDomain = domain ? getTopDomain(domain) : null;
    const currentTopKey = currentTopDomain ? currentTopDomain.slice(1) : null;

    // Ensure current domain group always exists (even if empty)
    if (currentTopKey) byTopDomain.set(currentTopKey, []);

    for (const rule of rules) {
      const ruleDomain = rule.domain || 'global';
      let topKey;
      if (ruleDomain === 'global' || !ruleDomain) {
        topKey = 'Global';
      } else if (ruleDomain.startsWith('regex:')) {
        topKey = 'Custom patterns';
      } else {
        const clean = ruleDomain.startsWith('.') ? ruleDomain.slice(1) : ruleDomain;
        topKey = getTopDomain(clean).slice(1);
      }
      if (!byTopDomain.has(topKey)) byTopDomain.set(topKey, []);
      byTopDomain.get(topKey).push(rule);
    }

    // Sort: current top-domain first, then alphabetical
    const sortedKeys = [...byTopDomain.keys()].sort((a, b) => {
      if (a === currentTopKey) return -1;
      if (b === currentTopKey) return 1;
      return a.localeCompare(b);
    });

    for (const topKey of sortedKeys) {
      const groupRules = byTopDomain.get(topKey);
      const isCurrentDomain = topKey === currentTopKey;

      const groupDetails = document.createElement('details');
      groupDetails.className = 'gtm-rules-domain-group';
      groupDetails.open = isCurrentDomain;

      const groupSummary = document.createElement('summary');
      groupSummary.className = 'gtm-rules-domain-summary';
      if (isCurrentDomain) groupSummary.classList.add('gtm-rules-domain-current');

      groupSummary.appendChild(_makeChevron());

      const domainLabel = document.createElement('span');
      domainLabel.className = 'gtm-rules-domain-label';
      domainLabel.textContent = topKey;
      groupSummary.appendChild(domainLabel);

      const countBadge = document.createElement('span');
      countBadge.className = 'gtm-rules-domain-count';
      countBadge.textContent = String(groupRules.length);
      groupSummary.appendChild(countBadge);

      const removeAllBtn = document.createElement('button');
      removeAllBtn.className = 'datalayer-push-btn gtm-rules-domain-remove-all';
      removeAllBtn.textContent = 'Remove All';
      removeAllBtn.title = `Remove all rules for ${topKey}`;
      removeAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        groupRules.forEach(r => removeRule(r.id));
        trackEvent('gtm_intercept', { action: 'remove_all_domain', domain: topKey });
      });
      groupSummary.appendChild(removeAllBtn);

      groupDetails.appendChild(groupSummary);

      if (groupRules.length === 0) {
        // Current domain with no rules — show empty state with hint
        const emptyWrap = document.createElement('div');
        emptyWrap.className = 'gtm-rules-group';
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'gtm-intercept-empty';
        emptyMsg.textContent = 'No rules for this domain.';
        emptyWrap.appendChild(emptyMsg);
        const emptyHint = document.createElement('p');
        emptyHint.className = 'gtm-intercept-empty-hint';
        emptyHint.textContent = 'Use Block, Swap, or Preview to control which GTM containers load on this page.';
        emptyWrap.appendChild(emptyHint);
        groupDetails.appendChild(emptyWrap);
      } else {
        groupDetails.appendChild(_renderRuleGroup(groupRules, domain));
      }

      content.appendChild(groupDetails);
    }
  }

  // Reload prompt
  const reloadPrompt = document.createElement('div');
  reloadPrompt.className = 'gtm-intercept-reload';
  reloadPrompt.id = 'gtm-intercept-reload-rules';
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

  content.appendChild(reloadPrompt);
  details.appendChild(content);

  return details;
}

/**
 * Render a group of rule rows.
 * @param {Array} rules - Rules to render
 * @param {string} domain - Current domain
 * @param {boolean} isActive - Whether these are active rules (affects available actions)
 */
/**
 * Show an inline edit form below a rule row.
 */
function _showRuleEditForm(ruleRow, rule) {
  // Prevent duplicate forms
  if (ruleRow.nextElementSibling?.classList.contains('gtm-rule-form')) return;

  const form = buildRuleForm({
    fields: [
      { key: 'note', placeholder: 'Note (optional)', value: rule.note || '' }
    ],
    initialScope: rule.scope || 'always',
    confirmLabel: 'Save',
    onConfirm: ({ fields, scope }) => {
      updateRule(rule.id, {
        note: fields.note.trim() || null,
        scope
      });
      trackEvent('gtm_intercept', { action: 'edit_rule', container_id: rule.containerId });
    },
    onCancel: () => form.remove()
  });

  ruleRow.after(form);
}

function _renderRuleGroup(rules, domain) {
  const group = document.createElement('div');
  group.className = 'gtm-rules-group';

  // Sort: enabled rules first, then disabled
  const sorted = [...rules].sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0));

  const hasEnabled = sorted.some(r => r.active);

  // ACTIVE label
  const activeLabel = document.createElement('div');
  activeLabel.className = 'gtm-rules-section-label';
  activeLabel.textContent = 'Active';
  group.appendChild(activeLabel);

  // Render enabled rules, or "No active rules" centered hint
  const enabledRules = sorted.filter(r => r.active);
  const disabledRules = sorted.filter(r => !r.active);

  if (enabledRules.length > 0) {
    enabledRules.forEach((rule, i) => {
      const row = _buildRuleRow(rule, domain);
      if (i === enabledRules.length - 1) row.classList.add('gtm-rule-row-last');
      group.appendChild(row);
    });
  } else {
    const noActive = document.createElement('p');
    noActive.className = 'gtm-rules-empty-hint';
    noActive.textContent = 'No active rules';
    group.appendChild(noActive);
  }

  // Divider + DISABLED label (always shown)
  const divider = document.createElement('div');
  divider.className = 'gtm-rules-divider';
  const dividerLabel = document.createElement('span');
  dividerLabel.className = 'gtm-rules-divider-label';
  dividerLabel.textContent = 'Disabled';
  divider.appendChild(dividerLabel);
  group.appendChild(divider);

  // Render disabled rules
  disabledRules.forEach((rule, i) => {
    const row = _buildRuleRow(rule, domain);
    if (i === disabledRules.length - 1) row.classList.add('gtm-rule-row-last');
    group.appendChild(row);
  });

  return group;
}

/** Build a single rule row element. */
function _buildRuleRow(rule, domain) {
  const row = document.createElement('div');
  row.className = 'gtm-intercept-rule-row';
  if (!rule.active) row.classList.add('gtm-rule-disabled');

  // Action badge
  const badge = document.createElement('span');
  badge.className = 'gtm-rule-action-badge';
  if (rule.action === 'block') { badge.textContent = 'Blocked'; badge.classList.add('gtm-rule-badge-blocked'); }
  else if (rule.action === 'replace') { badge.textContent = 'Swapped'; badge.classList.add('gtm-rule-badge-swapped'); }
  else if (rule.action === 'preview') { badge.textContent = 'Preview'; badge.classList.add('gtm-rule-badge-preview'); }
  row.appendChild(badge);

  const infoWrap = document.createElement('div');
  infoWrap.className = 'gtm-intercept-rule-info';

  const idLine = document.createElement('div');
  idLine.className = 'gtm-intercept-rule-id-line';

  const desc = document.createElement('span');
  desc.className = 'gtm-intercept-rule-desc';
  const idSpan = document.createElement('strong');
  idSpan.textContent = rule.containerId;
  desc.appendChild(idSpan);
  if (rule.action === 'replace') {
    desc.appendChild(document.createTextNode(` \u2192 ${rule.replacementId}`));
  } else if (rule.action === 'preview' && rule.gtmPreview) {
    desc.appendChild(document.createTextNode(` \u2014 ${rule.gtmPreview}`));
    if (rule.gtmDebug) desc.appendChild(document.createTextNode(' + debug'));
  }
  idLine.appendChild(desc);

  if (rule.domain) {
    const domainBadge = document.createElement('span');
    domainBadge.className = 'gtm-rule-domain-badge';
    domainBadge.textContent = formatDomainScope(rule);
    idLine.appendChild(domainBadge);
  }

  const ruleScope = rule.scope || 'always';
  const scopeBadge = document.createElement('span');
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

  // Edit button
  const editBtn = document.createElement('button');
  editBtn.className = 'datalayer-push-btn gtm-rule-edit-btn';
  editBtn.title = 'Edit note and scope';
  const pencilSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  pencilSvg.setAttribute('width', '12');
  pencilSvg.setAttribute('height', '12');
  pencilSvg.setAttribute('viewBox', '0 0 24 24');
  pencilSvg.setAttribute('fill', 'none');
  pencilSvg.setAttribute('stroke', 'currentColor');
  pencilSvg.setAttribute('stroke-width', '2');
  const pencilPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pencilPath.setAttribute('d', 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z');
  pencilSvg.appendChild(pencilPath);
  editBtn.appendChild(pencilSvg);
  editBtn.addEventListener('click', () => _showRuleEditForm(row, rule));
  actionsWrap.appendChild(editBtn);

  if (rule.active) {
    const disableBtn = document.createElement('button');
    disableBtn.className = 'datalayer-push-btn';
    disableBtn.textContent = 'Disable';
    disableBtn.title = 'Disable this rule';
    disableBtn.addEventListener('click', () => {
      disableRule(rule.id);
      trackEvent('gtm_intercept', { action: 'disable', container_id: rule.containerId });
    });
    actionsWrap.appendChild(disableBtn);
  } else {
    const enableBtn = document.createElement('button');
    enableBtn.className = 'datalayer-push-btn datalayer-push-btn-primary';
    enableBtn.textContent = 'Enable';
    enableBtn.title = 'Re-enable this rule';
    enableBtn.addEventListener('click', () => {
      reactivateRule(rule.id);
      trackEvent('gtm_intercept', { action: 'reactivate', container_id: rule.containerId });
    });
    actionsWrap.appendChild(enableBtn);
  }

  // Delete button (trash icon)
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'datalayer-push-btn gtm-rule-edit-btn';
  deleteBtn.title = 'Delete this rule';
  const trashSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  trashSvg.setAttribute('width', '12');
  trashSvg.setAttribute('height', '12');
  trashSvg.setAttribute('viewBox', '0 0 24 24');
  trashSvg.setAttribute('fill', 'none');
  trashSvg.setAttribute('stroke', 'currentColor');
  trashSvg.setAttribute('stroke-width', '2');
  const trashPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  trashPath.setAttribute('d', 'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14');
  trashSvg.appendChild(trashPath);
  deleteBtn.appendChild(trashSvg);
  deleteBtn.addEventListener('click', () => {
    removeRule(rule.id);
    trackEvent('gtm_intercept', { action: 'remove', container_id: rule.containerId });
  });
  actionsWrap.appendChild(deleteBtn);

  row.appendChild(actionsWrap);
  return row;
}

// ============================================================
// Preview form (inline, within quick actions)
// ============================================================

function _showPreviewForm(actionsSection, containerId, domain) {
  // Don't add multiple forms
  if (actionsSection.querySelector('.gtm-preview-form')) return;
  // Remove any open rule form (Block/Swap)
  actionsSection.querySelector('.gtm-rule-form')?.remove();

  const form = document.createElement('div');
  form.className = 'gtm-preview-form';

  // Heading
  const heading = document.createElement('div');
  heading.className = 'gtm-preview-form-heading';
  heading.textContent = 'Load GTM Workspace Preview';
  form.appendChild(heading);

  // Instructions
  const hint = document.createElement('p');
  hint.className = 'gtm-preview-form-hint';
  hint.textContent = 'Paste a GTM preview share link, or the URL in the Tag Assistant page prior to Connect.';
  form.appendChild(hint);

  // Link input
  const inputLabel = document.createElement('label');
  inputLabel.className = 'gtm-form-field-label';
  inputLabel.textContent = 'Preview Link or URL';
  form.appendChild(inputLabel);

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'https://tagassistant.google.com/...&gtm_auth=...&gtm_preview=env-N';
  input.className = 'gtm-intercept-input gtm-preview-link-input';
  form.appendChild(input);

  // Parsed values display (hidden until valid input)
  const parsedInfo = document.createElement('div');
  parsedInfo.className = 'gtm-preview-parsed';
  parsedInfo.style.display = 'none';
  form.appendChild(parsedInfo);

  // Error message
  const errorMsg = document.createElement('div');
  errorMsg.className = 'gtm-preview-error';
  errorMsg.style.display = 'none';
  errorMsg.textContent = 'Could not find gtm_auth and gtm_preview in the pasted value. Check that you copied the full link or snippet.';
  form.appendChild(errorMsg);

  // Note field
  const noteLabel = document.createElement('label');
  noteLabel.className = 'gtm-form-field-label';
  noteLabel.textContent = 'Note (optional)';
  form.appendChild(noteLabel);

  const noteInput = document.createElement('input');
  noteInput.type = 'text';
  noteInput.placeholder = 'e.g. Testing new purchase event tag';
  noteInput.className = 'gtm-intercept-input gtm-preview-note-input';
  form.appendChild(noteInput);

  // Debug mode checkbox
  const debugRow = document.createElement('label');
  debugRow.className = 'gtm-preview-debug-row';
  const debugCheckbox = document.createElement('input');
  debugCheckbox.type = 'checkbox';
  debugCheckbox.checked = true;
  debugCheckbox.className = 'gtm-preview-debug-checkbox';
  debugRow.appendChild(debugCheckbox);
  const debugLabel = document.createElement('span');
  debugLabel.textContent = 'Enable GA4 debug mode';
  debugRow.appendChild(debugLabel);
  const debugHint = document.createElement('span');
  debugHint.className = 'gtm-preview-debug-hint';
  debugHint.textContent = 'Routes GA4 events to DebugView instead of regular reports';
  debugRow.appendChild(debugHint);
  form.appendChild(debugRow);

  // Persistence scope toggle
  const persistToggle = buildScopeToggle();
  form.appendChild(persistToggle.container);

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.className = 'gtm-preview-btn-row';

  const applyBtn = document.createElement('button');
  applyBtn.className = 'datalayer-push-btn datalayer-push-btn-primary';
  applyBtn.textContent = 'Apply Preview';
  applyBtn.disabled = true;
  btnRow.appendChild(applyBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'datalayer-push-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => form.remove());
  btnRow.appendChild(cancelBtn);

  form.appendChild(btnRow);

  let parsedValues = null;

  input.addEventListener('input', () => {
    const val = input.value.trim();
    parsedValues = parsePreviewLink(val);

    if (parsedValues) {
      parsedInfo.style.display = '';
      errorMsg.style.display = 'none';
      parsedInfo.innerHTML = '';

      const authRow = document.createElement('div');
      authRow.className = 'gtm-preview-parsed-row';
      const authLabel = document.createElement('span');
      authLabel.className = 'gtm-preview-parsed-label';
      authLabel.textContent = 'gtm_auth:';
      const authVal = document.createElement('code');
      authVal.className = 'gtm-preview-parsed-value';
      authVal.textContent = parsedValues.gtmAuth;
      authRow.appendChild(authLabel);
      authRow.appendChild(authVal);
      parsedInfo.appendChild(authRow);

      const envRow = document.createElement('div');
      envRow.className = 'gtm-preview-parsed-row';
      const envLabel = document.createElement('span');
      envLabel.className = 'gtm-preview-parsed-label';
      envLabel.textContent = 'gtm_preview:';
      const envVal = document.createElement('code');
      envVal.className = 'gtm-preview-parsed-value';
      envVal.textContent = parsedValues.gtmPreview;
      envRow.appendChild(envLabel);
      envRow.appendChild(envVal);
      parsedInfo.appendChild(envRow);

      input.classList.add('gtm-input-valid');
      input.classList.remove('gtm-input-error');
      applyBtn.disabled = false;
    } else {
      parsedInfo.style.display = 'none';
      applyBtn.disabled = true;
      input.classList.remove('gtm-input-valid');
      if (val.length > 10) {
        errorMsg.style.display = '';
        input.classList.add('gtm-input-error');
      } else {
        errorMsg.style.display = 'none';
        input.classList.remove('gtm-input-error');
      }
    }
  });

  applyBtn.addEventListener('click', () => {
    if (!parsedValues) return;

    addRule({
      containerId,
      action: 'preview',
      gtmAuth: parsedValues.gtmAuth,
      gtmPreview: parsedValues.gtmPreview,
      gtmDebug: debugCheckbox.checked,
      note: noteInput.value.trim() || null,
      domain,
      scope: persistToggle.getValue()
    });

    trackEvent('gtm_intercept', {
      action: 'preview',
      container_id: containerId,
      environment: parsedValues.gtmPreview,
      gtm_debug: debugCheckbox.checked
    });

    form.remove();
  });

  actionsSection.appendChild(form);
  input.focus();
}

// ============================================================
// Empty state
// ============================================================

function _renderEmptyState() {
  const el = document.createElement('div');
  el.className = 'gtm-hub-empty';
  el.textContent = 'No GTM containers detected on this page yet. Load a page with GTM, then reopen this panel.';
  return el;
}

// ============================================================
// Helpers
// ============================================================

function _getLatestContainerEvent(containerId) {
  const state = _deps.getState();
  const events = state.events.filter(
    e => e.platform === 'gtm' && e.formatted?.containerId === containerId
  );
  return events.length > 0 ? events[events.length - 1] : null;
}

function _makeChevron() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'settings-section-chevron');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M9 18l6-6-6-6');
  svg.appendChild(path);
  return svg;
}

function _makeCopyBtn(containerId) {
  const btn = document.createElement('button');
  btn.className = 'gtm-hub-copy-btn';
  btn.title = 'Copy container ID';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '11');
  svg.setAttribute('height', '11');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', '9'); rect.setAttribute('y', '9');
  rect.setAttribute('width', '13'); rect.setAttribute('height', '13');
  rect.setAttribute('rx', '2');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1');
  svg.appendChild(rect);
  svg.appendChild(path);
  btn.appendChild(svg);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(containerId).catch(() => {});
    btn.title = 'Copied!';
    setTimeout(() => { btn.title = 'Copy container ID'; }, 1500);
    trackEvent('gtm_hub_modal', { action: 'copy_id' });
  });

  return btn;
}

function _makePreviewIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12'); circle.setAttribute('cy', '12'); circle.setAttribute('r', '3');
  svg.appendChild(path);
  svg.appendChild(circle);
  return svg;
}
