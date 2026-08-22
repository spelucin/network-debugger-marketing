// ============================================================
// Help Modal — extracted from panel.js (Phase 4b)
// Handles the help/about panel with tabs and lazy-loaded content.
// ============================================================

import { PLATFORM_COUNT } from '../tracking-endpoints.js';
import { registerModalCloser, closeOtherModals } from './modal-utils.js';

let _deps;

/**
 * Initialize the help modal module with dependencies from panel.js.
 * Must be called after elements are defined.
 */
export function initHelpModal(deps) {
  _deps = deps;
  setupHelpListeners();
  registerModalCloser('help-panel', closeHelpModal);
}

// ----------------------------------------
// Help Modal Functions
// ----------------------------------------

export function openHelpModal(tabName) {
  const { elements } = _deps;
  closeOtherModals('help-panel');
  elements.helpPanel.classList.add('open');

  // If a specific tab was requested, switch to it (handles lazy-load of that tab).
  if (tabName) {
    switchHelpTab(tabName);
    _deps.trackEvent('help_modal', { action: 'open' });
    return;
  }

  // Ensure active tab content is loaded (first open)
  const activeTab = elements.helpBody?.querySelector('.help-tab-content.active');
  if (activeTab && !activeTab.dataset.loaded && window.HelpContent) {
    const html = window.HelpContent.getTabContent(activeTab.dataset.tab);
    if (html) {
      activeTab.innerHTML = html;
      activeTab.dataset.loaded = 'true';
      // Populate platform count in version history
      const countEl = activeTab.querySelector('[data-platform-count]');
      if (countEl) countEl.textContent = PLATFORM_COUNT;
    }
  }

  _deps.trackEvent('help_modal', { action: 'open' });
}

export function closeHelpModal() {
  _deps.elements.helpPanel.classList.remove('open');
}

function switchHelpTab(tabName) {
  const { elements } = _deps;
  if (!elements.helpTabs || !elements.helpBody) return;

  // Update tab buttons
  elements.helpTabs.querySelectorAll('.help-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  // Update tab content (inject from HelpContent module if available)
  elements.helpBody.querySelectorAll('.help-tab-content').forEach(content => {
    const isActive = content.dataset.tab === tabName;
    content.classList.toggle('active', isActive);

    // Inject content from HelpContent module (lazy load on first activation)
    if (isActive && !content.dataset.loaded && window.HelpContent) {
      const html = window.HelpContent.getTabContent(content.dataset.tab);
      if (html) {
        content.innerHTML = html;
        content.dataset.loaded = 'true';
        // Populate platform count in version history
        const countEl = content.querySelector('[data-platform-count]');
        if (countEl) countEl.textContent = PLATFORM_COUNT;
      }
    }
  });

  _deps.trackEvent('help_modal', { action: 'tab_' + tabName });
}

// ----------------------------------------
// Help Modal Event Listeners
// ----------------------------------------

function setupHelpListeners() {
  const { elements } = _deps;

  // Help button and panel
  if (elements.helpBtn) {
    elements.helpBtn.addEventListener('click', () => {
      if (elements.helpPanel.classList.contains('open')) {
        closeHelpModal();
      } else {
        openHelpModal();
      }
    });
  }

  if (elements.helpClose) {
    elements.helpClose.addEventListener('click', closeHelpModal);
  }

  // Help tab click handlers
  if (elements.helpTabs) {
    elements.helpTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.help-tab');
      if (tab && tab.dataset.tab) {
        switchHelpTab(tab.dataset.tab);
      }
    });
  }

  // Close help modal when clicking outside
  elements.helpPanel?.addEventListener('click', (e) => {
    if (e.target === elements.helpPanel) {
      closeHelpModal();
    }
  });

  // Track link clicks in help panel
  elements.helpPanel?.querySelectorAll('a[href]').forEach(link => {
    link.addEventListener('click', () => {
      _deps.trackEvent('link_click', { feature: 'help', link: link.href, tool: 'help_extension' });
    });
  });

  // Help accordion toggle (delegated, works with lazy-loaded content)
  elements.helpBody?.addEventListener('click', (e) => {
    const header = e.target.closest('.help-accordion-header');
    if (!header) return;
    const accordion = header.closest('.help-accordion');
    if (accordion) accordion.classList.toggle('open');
  });

  // Help feedback button (delegated, works with lazy-loaded about tab)
  elements.helpBody?.addEventListener('click', (e) => {
    const feedbackBtn = e.target.closest('.help-feedback-btn');
    if (!feedbackBtn) return;
    closeHelpModal();
    _deps.openReportModal();
  });
}
