/**
 * First-Run Onboarding Tour (Feature #41, Phase 1)
 *
 * Five-step coachmark tour that walks new users through the features that
 * are invisible until you know to look for them: event stream, filters
 * (including right-click actions), page-header export menu, the owl tip
 * system, and the help modal.
 *
 * Non-blocking: the event stream stays fully interactive during the tour.
 * Dismissible: Skip/Esc/Done all persist the completion version so the tour
 * does not auto-show again. Replayable from Settings.
 *
 * Loaded as a classic (non-module) script, mirroring owl-tips.js. Exposes
 * window.OnboardingTour for panel.js and settings.js to invoke.
 */
(function () {
  const TOUR_VERSION = 6;

  // Base tour layout:
  // - Welcome (bookend, not counted in the step counter)
  // - 14 content steps (event_actions → owl) — counter shows "1/14" … "14/14".
  //   The `ai_features` step is skipped via skipIf when the user has disabled
  //   AI features in Settings, so the counter shrinks to 13/13 in that case.
  // - Thanks (bookend, not counted; centered closing bubble)
  //
  // Bookend steps use `isBookend: true` so the "N / total" counter treats them
  // as outside the tour and renders a large, centered bubble with no anchor.
  const TOUR_STEPS = [
    // 0. Welcome — centered large bubble. Warm greeting + clear choice to
    // start the tour or skip it. Not counted in "N / 10".
    {
      id: 'welcome',
      step_name: 'welcome',
      // Different copy for fresh installs vs. upgraders who just dismissed the
      // What's New bubble. `reason` is passed from start() — 'upgrade' when the
      // scheduler consumed a _tourReasonHint from storage, 'auto'/'replay'
      // otherwise.
      title: (reason) => reason === 'upgrade'
        ? 'Welcome back 👋'
        : 'Welcome to Event Watcher 👋',
      content: (reason) => reason === 'upgrade'
        ? '<p>You\'ve already been using Event Watcher. Thanks for sticking with it!</p>' +
          '<p>This quick walkthrough highlights the main features so you know where everything lives.</p>' +
          '<p><strong>About a minute.</strong> You can skip or exit any time.</p>'
        : '<p>Thanks for installing — and congrats on your first captured page!</p>' +
          '<p>Event Watcher packs a lot into a small panel. Let\'s take a quick tour of where everything lives and what it\'s for.</p>' +
          '<p><strong>About a minute.</strong> You can skip or exit any time.</p>',
      centered: true,
      variant: 'large',
      isBookend: true,
      hideBack: true,
      hideSkip: true,
      nextLabel: 'Start tour',
      primaryLarge: true,    // Visually bigger Next button to dominate over Skip
      primaryFirst: true,    // Render primary (Start tour) to the LEFT of secondary (Skip)
      secondaryButton: {
        label: 'Skip tour — I know the extension',
        action: 'skip_tour',
        variant: 'subtle'
      }
    },
    // 1. Event stream + per-event actions — combined (user feedback: no random
    // pick, no scroll-jump, highlight the stream as a whole).
    {
      id: 'event_actions',
      step_name: 'event_actions',
      title: 'This is the event stream',
      content:
        '<p>Every tracking request lands here as you browse.</p>' +
        '<p><strong>Click</strong> any event to see its full details on the right.</p>' +
        '<p><strong>Right-click</strong> an event for actions — <em>Copy</em>, or <em>Highlight</em> similar events.</p>',
      targetSelectors: ['#event-list', '#event-list-panel'],
      placement: 'right'
    },
    // 2. Stream toolbar — clear / reload / capture / sort. Anchored on the
    // secondary row specifically so the highlight ring hugs just these buttons
    // rather than the whole two-row toolbar (which includes view tabs).
    {
      id: 'stream_toolbar',
      step_name: 'stream_toolbar',
      title: 'Stream controls',
      content:
        '<p>The small toolbar above the list gives you:</p>' +
        '<ul>' +
        '<li><strong>Clear</strong> — wipe the event list</li>' +
        '<li><strong>Reload</strong> — refresh the page</li>' +
        '<li><strong>Capture</strong> — pause or stop recording</li>' +
        '<li><strong>Sort</strong> — order by start, finish, or capture index</li>' +
        '</ul>' +
        '<p><em>Right-click</em> Clear or Reload for handy variants.</p>',
      targetSelectors: ['.event-list-toolbar .toolbar-row-secondary', '.event-list-toolbar'],
      placement: 'bottom'
    },
    // 3. Download + page-header export — merged per user feedback.
    {
      id: 'download',
      step_name: 'download',
      title: 'Download or copy the stream',
      content:
        '<p>The <strong>Download</strong> button copies the whole stream as <strong>JSON</strong> or <strong>Table</strong>.</p>' +
        '<p>Want just one page? <em>Right-click</em> any page header in the stream to copy just that page\'s events.</p>' +
        '<p>Either way, filters scope what\'s included — <em>filter first, export second</em>.</p>',
      targetSelectors: ['#export-btn', '.event-list-toolbar'],
      placement: 'bottom'
    },
    // 4. Views: Stream / Grouped (Tool · Page · +) / Script Tree
    // — auto-switches to Grouped (Tool pivot) so users see what the chip-row
    // actually does; restores previous view on Next/Back.
    {
      id: 'views',
      step_name: 'views',
      title: 'Switch views for a different angle',
      content:
        '<p>Same events, different lenses:</p>' +
        '<ul>' +
        '<li><strong>Stream</strong> — chronological timeline</li>' +
        '<li><strong>Grouped</strong> — group events by Tool or Page. The <em>+</em> chip opens a picker with more pivots.</li>' +
        '</ul>' +
        '<p>We\'ve flipped you to <em>Grouped → Tool</em> for a taste — it\'ll flip back when you move on.</p>',
      targetSelectors: ['#view-mode-grouped-toggle', '#view-mode-toggle'],
      placement: 'bottom',
      beforeEnter: (hooks) => enterViewMode('views', 'grouped', hooks, 'tool'),
      afterExit: (hooks) => restoreViewMode('views', hooks)
    },
    // 5. More views — opens the `+` picker so users discover the Grouped
    // pivots beyond Tool/Page (Event Name, Consent Category, Datalayer,
    // Endpoint, Cookie, Identity). Stays in Grouped → Tool because the
    // picker rides on top of that view; restores on exit. The picker
    // open/close goes through silent()-wrapped hooks so the tour-driven
    // open doesn't fire `view_plus` (real user discovery only).
    {
      id: 'more_views',
      step_name: 'more_views',
      title: 'More views behind the +',
      content:
        '<p>The <em>+</em> chip opens a picker with extra Grouped pivots:</p>' +
        '<ul>' +
        '<li><strong>Event Name</strong> — same gesture across vendors lines up</li>' +
        '<li><strong>Consent Category</strong>, <strong>Datalayer</strong>, <strong>Endpoint</strong>, <strong>Cookie</strong>, <strong>Identity</strong></li>' +
        '</ul>' +
        '<p>Pin the ones you use, drag to reorder. We\'ve opened the picker for you — close it, or pick one when the tour is done.</p>',
      targetSelectors: ['.grouped-picker-popover', '#grouped-picker-btn'],
      placement: 'bottom',
      originSelector: '#grouped-picker-btn',
      beforeEnter: (hooks) => {
        enterViewMode('more_views', 'grouped', hooks, 'tool');
        if (hooks && typeof hooks.openGroupedPicker === 'function') {
          const existing = document.querySelector('.grouped-picker-popover');
          if (!existing) hooks.openGroupedPicker();
        }
      },
      afterExit: (hooks) => {
        if (hooks && typeof hooks.closeGroupedPicker === 'function') {
          hooks.closeGroupedPicker();
        }
        restoreViewMode('more_views', hooks);
      }
    },
    // 6. Script Tree — auto-switches to Tree view; restores on Next/Back.
    {
      id: 'script_tree',
      step_name: 'script_tree',
      title: 'Script',
      content:
        '<p><strong>Script view</strong> shows the full load hierarchy — tag managers down to vendor scripts and everything they spawned.</p>' +
        '<p>Perfect for auditing third-party sprawl.</p>' +
        '<p>We\'ve switched you to it so you can see; it\'ll flip back when you move on.</p>',
      targetSelectors: ['#view-mode-tree-toggle', '#view-mode-toggle'],
      placement: 'bottom',
      beforeEnter: (hooks) => {
        enterViewMode('script_tree', 'tree', hooks);
        // If the Script Tree would be empty, reload the inspected page so
        // scripts populate while the user reads the bubble. Users who opened
        // DevTools on an already-loaded page otherwise hit a blank "No
        // scripts detected yet" state. Conditional — preserves prior events
        // if any script loads were already captured.
        if (hooks && typeof hooks.hasScriptEvents === 'function'
            && typeof hooks.reloadPage === 'function'
            && !hooks.hasScriptEvents()) {
          hooks.reloadPage();
        }
      },
      afterExit: (hooks) => restoreViewMode('script_tree', hooks)
    },
    // 7. Stack view — auto-switches to Stack view; restores on Next/Back.
    // One node per platform, parented by who loaded it. Answers "what
    // does this site use, and how is it wired?" at the tool level.
    {
      id: 'stack_view',
      step_name: 'stack_view',
      title: 'Stack — the martech stack as a tree',
      content:
        '<p><strong>Stack view</strong> is the site\'s martech stack at the tool level — one node per platform, parented by who loaded it (page → tag manager → vendor tools).</p>' +
        '<p>Click a card for a per-tool detail panel: Overview, About Tool, Stack position, Session activity, Consent context.</p>' +
        '<p>Export it as Markdown, Mermaid (<code>flowchart LR</code>), SVG, or drop it into MartechStack Builder.</p>',
      targetSelectors: ['#view-mode-stack-toggle', '#view-mode-toggle'],
      placement: 'bottom',
      beforeEnter: (hooks) => enterViewMode('stack_view', 'stack', hooks),
      afterExit: (hooks) => restoreViewMode('stack_view', hooks)
    },
    // 8. Pinned view — auto-switches to Pinned view; restores on Next/Back.
    // The first state today that survives clearEvents() — gives users a
    // per-domain parking spot for events worth keeping.
    {
      id: 'pinned_view',
      step_name: 'pinned_view',
      title: 'Pinned — a parking spot that survives Clear',
      content:
        '<p>Hover any row in <strong>Stream</strong> and click the pushpin to save it.</p>' +
        '<p>Pinned events stick around across <strong>Clear</strong> and inspected-page reloads — no more export round-trip just to revisit a handful of events. Pins are scoped per domain.</p>' +
        '<p><strong>Shift-click</strong> a range or <strong>Ctrl/Cmd-click</strong> to select multiple rows, then pin the whole selection in one gesture.</p>',
      targetSelectors: ['#view-mode-pinned-toggle', '#view-mode-toggle'],
      placement: 'bottom',
      beforeEnter: (hooks) => enterViewMode('pinned_view', 'pinned', hooks),
      afterExit: (hooks) => restoreViewMode('pinned_view', hooks)
    },
    // 9. Filters — click-to-hide, right-click for opposite, collapse to
    // save space. The bubble actively demos one category-filter click on
    // enter (hiding events of that category from the stream) and reverts
    // on exit, so users see the filter effect happen rather than just
    // read about it.
    {
      id: 'filters',
      step_name: 'filters',
      title: 'Filter to focus on what matters',
      content:
        '<p><strong>Click</strong> any tool or category to hide it — click again to bring it back. We\'ve <em>narrowed the stream to one category</em> for you so you can see events drop in and out.</p>' +
        '<p><strong>Right-click</strong> for more actions:</p>' +
        '<ul>' +
        '<li><em>Show only</em> — hide everything except this one</li>' +
        '<li><em>Highlight</em> — make events stand out visually</li>' +
        '<li><em>Hide</em> — same as left-click</li>' +
        '</ul>' +
        '<p>Need more space? <em>Collapse</em> the filter bar with the chevron on the left.</p>',
      targetSelectors: ['#category-toolbar'],
      placement: 'bottom',
      beforeEnter: (hooks) => {
        ensureFilterToolbarExpanded();
        if (hooks && typeof hooks.demoFilterShowOnlyLast === 'function') {
          hooks.demoFilterShowOnlyLast();
        }
      },
      afterExit: (hooks) => {
        if (hooks && typeof hooks.demoFilterRestore === 'function') {
          hooks.demoFilterRestore();
        }
        restoreFilterToolbarState();
      }
    },
    // 8. AI features — anchored on the toolbar AI button. We intentionally do
    // NOT open the AI modal here: for users without a key configured, the
    // modal lands on the BYOK setup screen which is jarring mid-tour.
    // Skipped when the user has disabled AI features via Settings → Features,
    // so the tour stays honest for people who opted out.
    {
      id: 'ai_features',
      step_name: 'ai_features',
      title: 'AI with your own API key',
      content:
        '<p>Bring your own <strong>Claude</strong>, <strong>OpenAI</strong>, or <strong>Gemini</strong> key and unlock:</p>' +
        '<ul>' +
        '<li><strong>AI Summary</strong> in every event — 4 presets including <em>Explain Event</em> and <em>QA Implementation</em></li>' +
        '<li><strong>AI Chat</strong> — free-form Q&A across the whole captured session</li>' +
        '<li><strong>Identify Platform</strong> — one-click naming of unknown events</li>' +
        '</ul>' +
        '<p>Keys stay local, you pay your provider directly. Not interested? Turn it off in <em>Settings → Features</em>.</p>',
      targetSelectors: ['#ai-btn', '#toolbar-overflow-btn'],
      placement: 'bottom',
      skipIf: () => document.body.classList.contains('ai-features-disabled')
    },
    // 9. GTM Hub — always shown (even without a container detected) so users
    // learn it exists and what it does for the day a container appears.
    // Opens the modal on enter, closes on exit.
    {
      id: 'gtm_hub',
      step_name: 'gtm_hub',
      title: 'GTM Hub — inspect and intercept',
      content:
        '<p>When we detect a GTM container, the Hub shows what\'s inside and lets you:</p>' +
        '<ul>' +
        '<li><strong>Block</strong> — stop a container from loading</li>' +
        '<li><strong>Swap</strong> — replace it with a different container</li>' +
        '<li><strong>Preview</strong> — enter GTM\'s preview mode</li>' +
        '</ul>' +
        '<p>All without touching production.</p>',
      targetSelectors: ['#gtm-btn', '#toolbar-overflow-btn'],
      placement: 'bottom',
      beforeEnter: (hooks) => { if (hooks && typeof hooks.openGTM === 'function') hooks.openGTM(); },
      afterExit: (hooks) => { if (hooks && typeof hooks.closeGTM === 'function') hooks.closeGTM(); }
    },
    // 9. Defaults — opens the Settings modal so the user sees it, closes on next.
    {
      id: 'defaults',
      step_name: 'defaults',
      title: 'Make it yours — default preferences',
      content:
        '<p>We\'ve opened Settings for you.</p>' +
        '<p><strong>Defaults</strong> lets you tune startup preferences — view mode, filters, sort order, and more.</p>' +
        '<p>Pick a fixed value, or choose <em>Last used</em> to remember your previous session.</p>',
      targetSelectors: ['#settings-btn', '#toolbar-overflow-btn'],
      placement: 'bottom',
      beforeEnter: (hooks) => { if (hooks && typeof hooks.openSettings === 'function') hooks.openSettings(); },
      afterExit: (hooks) => { if (hooks && typeof hooks.closeSettings === 'function') hooks.closeSettings(); }
    },
    // 10. Help — opens the Help modal (Getting Started tab), closes on next.
    {
      id: 'help',
      step_name: 'help',
      title: 'The Help button has the full guide',
      content:
        '<p>Stuck? We\'ve opened the <strong>Help</strong> modal for you.</p>' +
        '<p>Inside you\'ll find:</p>' +
        '<ul>' +
        '<li><strong>Getting Started</strong> — an onboarding overview</li>' +
        '<li><strong>Features</strong> — full documentation</li>' +
        '<li><strong>Versions</strong> — changelog and release notes</li>' +
        '</ul>',
      targetSelectors: ['#help-btn', '#toolbar-overflow-btn'],
      placement: 'bottom',
      beforeEnter: (hooks) => { if (hooks && typeof hooks.openHelp === 'function') hooks.openHelp(); },
      afterExit: (hooks) => { if (hooks && typeof hooks.closeHelp === 'function') hooks.closeHelp(); }
    },
    // 10. Owl — last content step (counted as 10/10).
    {
      id: 'owl',
      step_name: 'owl',
      title: 'One more thing — the owl',
      content:
        '<p>Click the owl any time for a random tip.</p>' +
        '<p>40+ hints hide behind it — shortcuts, modes, and features you might have missed.</p>',
      targetSelectors: ['#owlLogo'],
      placement: 'bottom'
    },
    // 11. Thanks — centered large bubble. Warm closing, CTA to the extended
    // tour, and a soft rating ask. Not counted in "N / 10".
    {
      id: 'thanks',
      step_name: 'thanks',
      title: 'Thanks for taking the tour 🦉',
      content:
        '<p>You\'ve got the essentials. Go debug some tracking!</p>' +
        '<p>Ready for more? The <strong>extended tour</strong> digs into 9 power-user features.</p>' +
        '<p>Enjoying it? A <strong>Chrome Web Store rating</strong>, once you\'ve used it for real, would mean a lot.</p>',
      centered: true,
      variant: 'large',
      isBookend: true,
      hideSkip: true,
      nextLabel: 'Done',
      secondaryButton: {
        label: 'Take the extended tour',
        action: 'continue_extended'
      }
    }
  ];

  // ----------------------------------------
  // Extended tour — triggered after the user has spent some time in the app
  // (panel-open counter ≥ 10) or manually from the owl step's secondary button.
  // Covers features that are less critical on day one but valuable once the
  // basics are familiar.
  // ----------------------------------------
  const TOUR_VERSION_EXTENDED = 2;

  const EXTENDED_TOUR_STEPS = [
    {
      id: 'presets',
      step_name: 'presets',
      title: 'Presets — save a filter setup',
      content:
        '<p>Set up a filter combination you like, then save it as a <strong>Preset</strong>.</p>' +
        '<p>Switch between presets (e.g. <em>Google only</em>, <em>Ad tech audit</em>) with one click.</p>',
      targetSelectors: ['#preset-dropdown-btn', '#preset-dropdown'],
      placement: 'bottom'
    },
    {
      id: 'dl_nesting',
      step_name: 'dl_nesting',
      title: 'DL Nesting — group tags under their triggers',
      content:
        '<p><strong>DL Nesting</strong> groups GTM tag events under the <em>dataLayer.push()</em> that triggered them.</p>' +
        '<p>Toggle it off if you want a flat timeline instead.</p>',
      targetSelectors: ['.nested-toggle', '#trigger-correlation-toggle'],
      placement: 'bottom'
    },
    // 3. Feedback modal — replaces the earlier Dark mode step. Opens the
    // report modal on enter so users see exactly where to report bugs and
    // leave feedback, closes on exit.
    {
      id: 'feedback',
      step_name: 'feedback',
      title: 'Feedback & bug reports',
      content:
        '<p>We\'ve opened the <strong>Feedback</strong> modal for you.</p>' +
        '<p>Use it to:</p>' +
        '<ul>' +
        '<li><strong>Report a bug</strong> — something misbehaving? Let us know</li>' +
        '<li><strong>Request a feature</strong> — what would make you reach for it more often?</li>' +
        '<li><strong>Flag a missing tool</strong> — spotted tracking we didn\'t detect? Send a sample</li>' +
        '<li><strong>Just say hi</strong> — general feedback is always welcome</li>' +
        '</ul>',
      targetSelectors: ['#report-tool-btn', '#toolbar-overflow-btn'],
      placement: 'bottom',
      beforeEnter: (hooks) => { if (hooks && typeof hooks.openReport === 'function') hooks.openReport(); },
      afterExit: (hooks) => { if (hooks && typeof hooks.closeReport === 'function') hooks.closeReport(); }
    },
    {
      id: 'scripts_filter',
      step_name: 'scripts_filter',
      title: 'Scripts filter & script badges',
      content:
        '<p>The <strong>Scripts</strong> filter has three modes:</p>' +
        '<ul>' +
        '<li><em>Auto</em> — follow tool visibility</li>' +
        '<li><em>Only</em> — show just scripts</li>' +
        '<li><em>Hide</em> — remove scripts from the stream</li>' +
        '</ul>' +
        '<p>Every script load also gets a small purple <strong>badge</strong> telling you how it was loaded:</p>' +
        '<ul>' +
        '<li><badge type="script-website"/> loaded directly from the page\'s HTML</li>' +
        '<li><badge type="script-tagmanager"/> injected by GTM, GTAG, or another TMS</li>' +
        '<li><badge type="script-script"/> loaded by another tracker</li>' +
        '</ul>',
      targetSelectors: ['#scripts-filter'],
      placement: 'bottom'
    },
    {
      id: 'consent_filter',
      step_name: 'consent_filter',
      title: 'Consent filter & violations',
      content:
        '<p>The <strong>Consent</strong> filter flags requests that fired without the right consent.</p>' +
        '<p>Click to cycle through four modes:</p>' +
        '<ul>' +
        '<li><em>Auto</em> — surface violations only</li>' +
        '<li><em>Only</em> — show every consent-related event</li>' +
        '<li><em>Hide</em> — hide consent events but keep per-event badges</li>' +
        '<li><em>Off</em> — turn consent checking off entirely</li>' +
        '</ul>' +
        '<p>Events also get a coloured <strong>consent shield</strong>:</p>' +
        '<ul>' +
        '<li><badge type="consent-granted"/> <strong>Green</strong> — consent granted before the request fired</li>' +
        '<li><badge type="consent-pre"/> <strong>Yellow</strong> — fired before the user had a chance to consent (pre-consent)</li>' +
        '<li><badge type="consent-denied"/> <strong>Red</strong> — consent was denied, request fired anyway (a violation)</li>' +
        '</ul>',
      targetSelectors: ['#consent-filter'],
      placement: 'bottom'
    },
    {
      id: 'interactions',
      step_name: 'interactions',
      title: 'Interaction events',
      content:
        '<p><strong>Interactions</strong> adds user-action markers — clicks, form changes — to the stream as timeline markers.</p>' +
        '<p>Great for confirming <em>what the user did</em> right before a tracking event fired.</p>',
      targetSelectors: ['#interactions-filter'],
      placement: 'bottom'
    },
    {
      id: 'capture',
      step_name: 'capture',
      title: 'Pause, stop, and resume capture',
      content:
        '<p>Click the <strong>capture</strong> button to cycle modes:</p>' +
        '<ul>' +
        '<li><em>Play</em> — default, capturing everything</li>' +
        '<li><em>Pause</em> — stop until the next page load, then auto-resume</li>' +
        '<li><em>Stop</em> — fully halt, nothing captured until you click again</li>' +
        '</ul>' +
        '<p>Pause is handy right before a risky user flow so your stream doesn\'t fill with noise.</p>',
      targetSelectors: ['#capture-btn'],
      placement: 'bottom'
    },
    {
      id: 'sort',
      step_name: 'sort',
      title: 'Sort — start, finish, or capture index',
      content:
        '<p>Three sort options, each useful in different moments:</p>' +
        '<ul>' +
        '<li><em>Start</em> — when the request began (the default)</li>' +
        '<li><em>Finish</em> — when the request completed; useful for slow requests</li>' +
        '<li><em>Index</em> — the order we captured, preserving tie-breaks</li>' +
        '</ul>' +
        '<p>Switch away from <em>Start</em> when a slow vendor is shuffling your timeline.</p>',
      targetSelectors: ['#sort-toggle-btn'],
      placement: 'bottom'
    },
    // 9. Custom endpoints — opens the Tools modal directly to the Custom tab.
    // Replaces what used to be two separate steps (tool list + custom); per
    // user feedback, custom endpoints is the more actionable of the two.
    {
      id: 'custom_endpoints',
      step_name: 'custom_endpoints',
      title: 'Custom endpoints',
      content:
        '<p>Seeing traffic from a domain we don\'t recognise yet?</p>' +
        '<p>Add a <strong>custom endpoint</strong> to:</p>' +
        '<ul>' +
        '<li>Map CNAME proxies to a known platform</li>' +
        '<li>Identify internal tools so they show up in filters</li>' +
        '<li>Create your own platform from scratch</li>' +
        '</ul>' +
        '<p>Stored locally in your browser.</p>',
      targetSelectors: ['#supported-tools-btn', '#toolbar-overflow-btn'],
      placement: 'bottom',
      beforeEnter: (hooks) => { if (hooks && typeof hooks.openCustomEndpoints === 'function') hooks.openCustomEndpoints(); },
      afterExit: (hooks) => { if (hooks && typeof hooks.closeToolsList === 'function') hooks.closeToolsList(); }
    },
    // 10. Thanks bookend — closes the extended tour with a warm sign-off.
    {
      id: 'extended_thanks',
      step_name: 'extended_thanks',
      title: 'That\'s the lot 🚀',
      content:
        '<p>That\'s the works — <strong>happy debugging!</strong></p>' +
        '<p>A <strong>Chrome Web Store rating</strong>, once you\'ve used it for real, would mean a lot.</p>',
      centered: true,
      variant: 'large',
      isBookend: true,
      hideSkip: true,
      nextLabel: 'Done'
    }
  ];

  // Hooks configured once by panel.js at init (see window.OnboardingTour.configureHooks).
  // Needed so steps can open/close the Settings and Help modals and switch view modes
  // without the tour module importing panel-specific code (tour loads as a classic script).
  let configuredHooks = null;

  const tourState = {
    active: false,
    currentIndex: 0,
    visibleSteps: [],
    version: TOUR_VERSION,
    isExtended: false,
    trackEventFn: null,
    onComplete: null,
    hooks: null,
    bubble: null,
    arrow: null,
    bodyEl: null,
    titleEl: null,
    counterEl: null,
    skipBtn: null,
    backBtn: null,
    nextBtn: null,
    secondaryBtn: null,
    controls: null,
    liveRegion: null,
    highlightedEl: null,
    highlightedClasses: null,
    originHighlightedEl: null,
    previousFocus: null,
    escHandler: null,
    reposHandler: null,
    reason: 'auto',
    tourName: null,
    filterToolbarWasCollapsed: false,
    stepBackup: new Map(),
    currentStepAfterExitCalled: false
  };

  // ----------------------------------------
  // Anchor resolution
  // ----------------------------------------

  function resolveAnchor(step) {
    // Dynamic resolvers take priority — lets a step pick an element at runtime
    // (e.g. a random event row) rather than relying on a static selector.
    if (typeof step.resolveTarget === 'function') {
      try {
        const el = step.resolveTarget();
        if (el && isElementVisible(el)) return el;
      } catch (_) { /* fall through to static selectors */ }
    }
    for (const selector of step.targetSelectors || []) {
      const el = document.querySelector(selector);
      if (el && isElementVisible(el)) return el;
    }
    return null;
  }

  function isElementVisible(el) {
    if (!el) return false;
    if (!el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
  }

  // ----------------------------------------
  // View-mode transitions — per-step backup keyed by step id, so multiple
  // view-changing steps in a row don't stomp each other. Each step captures
  // the current view on enter and restores *its own* captured view on exit.
  // ----------------------------------------

  function enterViewMode(stepId, targetMode, hooks, targetGrouping) {
    if (!hooks || typeof hooks.setViewMode !== 'function' || typeof hooks.getViewMode !== 'function') return;
    const currentMode = hooks.getViewMode();
    const currentGrouping = typeof hooks.getActiveGrouping === 'function' ? hooks.getActiveGrouping() : null;
    tourState.stepBackup.set(stepId, { mode: currentMode, grouping: currentGrouping });
    const sameMode = currentMode === targetMode;
    const sameGrouping = !targetGrouping || currentGrouping === targetGrouping;
    if (!sameMode || !sameGrouping) hooks.setViewMode(targetMode, targetGrouping || null);
  }

  function restoreViewMode(stepId, hooks) {
    if (!hooks || typeof hooks.setViewMode !== 'function') return;
    const backup = tourState.stepBackup.get(stepId);
    tourState.stepBackup.delete(stepId);
    if (!backup) return;
    // Backwards-compat: older entries stored a string instead of an object.
    if (typeof backup === 'string') {
      if (backup !== hooks.getViewMode?.()) hooks.setViewMode(backup);
      return;
    }
    const currentMode = hooks.getViewMode?.();
    const currentGrouping = typeof hooks.getActiveGrouping === 'function' ? hooks.getActiveGrouping() : null;
    if (backup.mode !== currentMode || (backup.grouping && backup.grouping !== currentGrouping)) {
      hooks.setViewMode(backup.mode, backup.grouping || null);
    }
  }

  // ----------------------------------------
  // Filter toolbar expand/restore
  // ----------------------------------------

  function ensureFilterToolbarExpanded() {
    const toolbar = document.getElementById('category-toolbar');
    if (!toolbar) return;
    const isCollapsed = toolbar.classList.contains('collapsed');
    tourState.filterToolbarWasCollapsed = isCollapsed;
    if (isCollapsed) {
      const collapseBtn = document.getElementById('filter-toolbar-collapse-btn');
      if (collapseBtn) collapseBtn.click();
    }
  }

  function restoreFilterToolbarState() {
    if (!tourState.filterToolbarWasCollapsed) return;
    const toolbar = document.getElementById('category-toolbar');
    if (!toolbar) return;
    if (!toolbar.classList.contains('collapsed')) {
      const collapseBtn = document.getElementById('filter-toolbar-collapse-btn');
      if (collapseBtn) collapseBtn.click();
    }
  }

  // ----------------------------------------
  // Filter-step demo — runs `Show only` on the LAST category-frame in the
  // toolbar so the event stream visibly collapses to just that category's
  // events while the bubble is open. The last category is usually a small
  // one (Widgets, Session Replay, …) so the change is dramatic, not a
  // single category vanishing into a still-busy stream. The actual filter
  // mutation lives in panel.js via the `demoFilterShowOnlyLast` /
  // `demoFilterRestore` hooks, which are silent()-wrapped so the demo
  // doesn't fire `filter_category` into product analytics.
  // ----------------------------------------

  // ----------------------------------------
  // Bubble DOM
  // ----------------------------------------

  function buildBubble() {
    const bubble = document.createElement('div');
    bubble.className = 'onboarding-bubble';
    bubble.setAttribute('role', 'dialog');
    bubble.setAttribute('aria-modal', 'false');
    bubble.setAttribute('aria-labelledby', 'onboarding-bubble-title');
    bubble.setAttribute('aria-describedby', 'onboarding-bubble-body');

    const arrow = document.createElement('div');
    arrow.className = 'onboarding-bubble-arrow';
    arrow.setAttribute('aria-hidden', 'true');

    const titleEl = document.createElement('div');
    titleEl.className = 'onboarding-bubble-title';
    titleEl.id = 'onboarding-bubble-title';

    const bodyEl = document.createElement('div');
    bodyEl.className = 'onboarding-bubble-body';
    bodyEl.id = 'onboarding-bubble-body';

    const footer = document.createElement('div');
    footer.className = 'onboarding-bubble-footer';

    const counter = document.createElement('div');
    counter.className = 'onboarding-bubble-counter';

    const controls = document.createElement('div');
    controls.className = 'onboarding-bubble-controls';
    tourState.controls = controls;

    const skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.className = 'onboarding-bubble-btn onboarding-bubble-skip';
    skipBtn.textContent = 'Skip tour';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'onboarding-bubble-btn onboarding-bubble-back';
    backBtn.textContent = 'Back';

    // Optional per-step secondary action (e.g. "Continue on extended tour").
    // Hidden unless a step declares `secondaryButton: { label, action }`.
    const secondaryBtn = document.createElement('button');
    secondaryBtn.type = 'button';
    secondaryBtn.className = 'onboarding-bubble-btn onboarding-bubble-secondary';
    secondaryBtn.style.display = 'none';

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'onboarding-bubble-btn onboarding-bubble-next onboarding-bubble-next-primary';
    nextBtn.textContent = 'Next';

    controls.appendChild(skipBtn);
    controls.appendChild(backBtn);
    controls.appendChild(secondaryBtn);
    controls.appendChild(nextBtn);
    footer.appendChild(counter);
    footer.appendChild(controls);

    bubble.appendChild(arrow);
    bubble.appendChild(titleEl);
    bubble.appendChild(bodyEl);
    bubble.appendChild(footer);

    const liveRegion = document.createElement('div');
    liveRegion.className = 'onboarding-live-region';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');

    document.body.appendChild(bubble);
    document.body.appendChild(liveRegion);

    skipBtn.addEventListener('click', () => skipTour());
    backBtn.addEventListener('click', () => prevStep());
    nextBtn.addEventListener('click', () => nextStep());
    secondaryBtn.addEventListener('click', () => handleSecondaryButton());

    // Trap Tab within the bubble controls so keyboard users stay in context
    bubble.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusable = bubble.querySelectorAll('.onboarding-bubble-btn:not([disabled])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    tourState.bubble = bubble;
    tourState.arrow = arrow;
    tourState.titleEl = titleEl;
    tourState.bodyEl = bodyEl;
    tourState.counterEl = counter;
    tourState.skipBtn = skipBtn;
    tourState.backBtn = backBtn;
    tourState.nextBtn = nextBtn;
    tourState.secondaryBtn = secondaryBtn;
    tourState.liveRegion = liveRegion;
  }

  // ----------------------------------------
  // Positioning
  // ----------------------------------------

  function positionBubble(target, requestedPlacement) {
    const bubble = tourState.bubble;
    if (!bubble || !target) return;

    try {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } catch (_) { /* older browsers */ }

    const targetRect = target.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    const margin = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const candidates = [requestedPlacement, 'bottom', 'top', 'right', 'left'].filter(Boolean);
    let placement = candidates[0];
    for (const p of candidates) {
      if (placementFits(p, targetRect, bubbleRect, margin, vw, vh)) {
        placement = p;
        break;
      }
    }

    const coords = computeCoords(placement, targetRect, bubbleRect, margin, vw, vh);
    bubble.style.left = `${coords.left}px`;
    bubble.style.top = `${coords.top}px`;
    bubble.dataset.placement = placement;
    positionArrow(placement, targetRect, coords, bubbleRect);
  }

  function placementFits(placement, target, bubble, margin, vw, vh) {
    switch (placement) {
      case 'bottom':
        return target.bottom + margin + bubble.height <= vh;
      case 'top':
        return target.top - margin - bubble.height >= 0;
      case 'right':
        return target.right + margin + bubble.width <= vw;
      case 'left':
        return target.left - margin - bubble.width >= 0;
      default:
        return false;
    }
  }

  function computeCoords(placement, target, bubble, margin, vw, vh) {
    let left, top;
    switch (placement) {
      case 'bottom':
        top = target.bottom + margin;
        left = target.left + target.width / 2 - bubble.width / 2;
        break;
      case 'top':
        top = target.top - margin - bubble.height;
        left = target.left + target.width / 2 - bubble.width / 2;
        break;
      case 'right':
        left = target.right + margin;
        top = target.top + target.height / 2 - bubble.height / 2;
        break;
      case 'left':
      default:
        left = target.left - margin - bubble.width;
        top = target.top + target.height / 2 - bubble.height / 2;
        break;
    }
    left = Math.max(8, Math.min(left, vw - bubble.width - 8));
    top = Math.max(8, Math.min(top, vh - bubble.height - 8));
    return { left, top };
  }

  function positionArrow(placement, targetRect, bubbleCoords, bubbleRect) {
    const arrow = tourState.arrow;
    if (!arrow) return;
    arrow.dataset.placement = placement;
    if (placement === 'bottom' || placement === 'top') {
      const targetCenterX = targetRect.left + targetRect.width / 2;
      const arrowLeft = Math.max(12, Math.min(bubbleRect.width - 24, targetCenterX - bubbleCoords.left - 6));
      arrow.style.left = `${arrowLeft}px`;
      arrow.style.top = '';
    } else {
      const targetCenterY = targetRect.top + targetRect.height / 2;
      const arrowTop = Math.max(12, Math.min(bubbleRect.height - 24, targetCenterY - bubbleCoords.top - 6));
      arrow.style.top = `${arrowTop}px`;
      arrow.style.left = '';
    }
  }

  // ----------------------------------------
  // Target highlight
  // ----------------------------------------

  function highlightTarget(target, extraClass) {
    unhighlightTarget();
    if (!target) return;
    target.classList.add('onboarding-target-highlight');
    if (extraClass) target.classList.add(extraClass);
    tourState.highlightedEl = target;
    tourState.highlightedClasses = extraClass
      ? ['onboarding-target-highlight', extraClass]
      : ['onboarding-target-highlight'];
  }

  function unhighlightTarget() {
    if (tourState.highlightedEl && tourState.highlightedClasses) {
      for (const cls of tourState.highlightedClasses) {
        tourState.highlightedEl.classList.remove(cls);
      }
    }
    tourState.highlightedEl = null;
    tourState.highlightedClasses = null;
  }

  // Secondary "origin" highlight — applied to the toolbar button that opened
  // the modal the primary anchor lives inside. Keeps the visual link between
  // the tour bubble (inside the modal) and the button that launched it.
  function highlightOrigin(selector) {
    unhighlightOrigin();
    if (!selector) return;
    const el = document.querySelector(selector);
    if (!el) return;
    el.classList.add('onboarding-origin-highlight');
    tourState.originHighlightedEl = el;
  }

  function unhighlightOrigin() {
    if (tourState.originHighlightedEl) {
      tourState.originHighlightedEl.classList.remove('onboarding-origin-highlight');
    }
    tourState.originHighlightedEl = null;
  }

  // ----------------------------------------
  // Step rendering
  // ----------------------------------------

  // Inline SVG icons for tour badge samples. These are copies of the real
  // event-stream badge SVGs (SCRIPT_INITIATOR_ICONS + the filled consent shield)
  // so the tour shows users the exact badge they'll see later. onboarding-tour.js
  // loads as a classic script so we can't import — the duplication is intentional.
  const SCRIPT_ICON_WEBSITE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
  const SCRIPT_ICON_TAGMANAGER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/></svg>';
  const SCRIPT_ICON_SCRIPT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="5" r="3"/><circle cx="7" cy="19" r="3"/><circle cx="17" cy="12" r="3"/><path d="M7 8v8"/><path d="M7 14q0-2 7-2"/></svg>';
  const CONSENT_SHIELD = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';

  const BADGE_ICONS = {
    'script-website': SCRIPT_ICON_WEBSITE,
    'script-tagmanager': SCRIPT_ICON_TAGMANAGER,
    'script-script': SCRIPT_ICON_SCRIPT,
    'consent-granted': CONSENT_SHIELD,
    'consent-pre': CONSENT_SHIELD,
    'consent-denied': CONSENT_SHIELD
  };

  // Build step body markup from a trusted static template (TOUR_STEPS in this file).
  // Supports: <strong>, <em>, <p>, <ul>, <li>, <code>, and self-contained
  // <badge type="..."> markers that render the real event-stream badge icon
  // (purple script badge or coloured consent shield) so users recognise what
  // they'll see later. Whitespace-only tokens at the root (e.g. between </p><p>)
  // are skipped.
  function renderStepBody(el, template) {
    while (el.firstChild) el.removeChild(el.firstChild);
    const tokens = template.split(/(<\/?(?:strong|em|p|ul|li|code)>|<badge\s+type="[a-z0-9_-]+"\s*\/?>)/i);
    const stack = [el];
    for (const token of tokens) {
      if (!token) continue;
      const openMatch = token.match(/^<(strong|em|p|ul|li|code)>$/i);
      const closeMatch = token.match(/^<\/(strong|em|p|ul|li|code)>$/i);
      const badgeOpen = token.match(/^<badge\s+type="([a-z0-9_-]+)"\s*\/?>$/i);
      if (openMatch) {
        const child = document.createElement(openMatch[1].toLowerCase());
        stack[stack.length - 1].appendChild(child);
        stack.push(child);
      } else if (closeMatch) {
        if (stack.length > 1) stack.pop();
      } else if (badgeOpen) {
        // Self-contained — inject the real badge icon and don't push onto the stack.
        const badge = document.createElement('span');
        const type = badgeOpen[1].toLowerCase();
        badge.className = `tour-inline-badge tour-inline-badge-${type}`;
        const svg = BADGE_ICONS[type];
        if (svg) badge.innerHTML = svg; // Trusted static markup from this file
        stack[stack.length - 1].appendChild(badge);
      } else {
        if (stack[stack.length - 1] === el && !token.trim()) continue;
        stack[stack.length - 1].appendChild(document.createTextNode(token));
      }
    }
  }

  function showStep(index) {
    const step = tourState.visibleSteps[index];
    if (!step) return endTour('complete');

    // Run `beforeEnter` first so hooks that open modals or switch views can
    // make the anchor element visible before we try to resolve it. Previously
    // anchor resolution ran first, which meant a step whose target lives
    // inside a modal (e.g. `#features-settings` in the What's New tour) would
    // be spliced out because the closed modal's children aren't visible yet.
    if (typeof step.beforeEnter === 'function') {
      try { step.beforeEnter(tourState.hooks); } catch (_) { /* non-critical */ }
    }

    // Bookend (Welcome / Thanks) and other centered steps don't need an anchor;
    // everything else must resolve one or be dropped.
    let target = null;
    if (!step.centered) {
      target = resolveAnchor(step);
      if (!target) {
        tourState.visibleSteps.splice(index, 1);
        if (tourState.visibleSteps.length === 0) return endTour('complete');
        if (index >= tourState.visibleSteps.length) index = tourState.visibleSteps.length - 1;
        return showStep(index);
      }
    }

    // Resolve title/content dynamically if they're functions of tour reason.
    // Lets a step (e.g. Welcome) show different copy for fresh installs vs.
    // upgraders who arrived via the What's New bubble.
    const resolvedTitle = typeof step.title === 'function' ? step.title(tourState.reason) : step.title;
    const resolvedContent = typeof step.content === 'function' ? step.content(tourState.reason) : step.content;
    tourState.titleEl.textContent = resolvedTitle;
    renderStepBody(tourState.bodyEl, resolvedContent);

    // Content-only counter — bookends are hidden from the "N / total" display
    // so Welcome and Thanks don't inflate the count.
    const contentSteps = tourState.visibleSteps.filter((s) => !s.isBookend);
    if (step.isBookend) {
      tourState.counterEl.style.display = 'none';
      tourState.counterEl.textContent = '';
    } else {
      const contentIndex = contentSteps.indexOf(step);
      tourState.counterEl.style.display = '';
      tourState.counterEl.textContent = `${contentIndex + 1} / ${contentSteps.length}`;
    }

    // Button visibility & labels — each step can override
    tourState.backBtn.disabled = index === 0;
    tourState.backBtn.style.display = step.hideBack ? 'none' : '';
    if (step.nextLabel) {
      tourState.nextBtn.textContent = step.nextLabel;
    } else {
      tourState.nextBtn.textContent = index === tourState.visibleSteps.length - 1 ? 'Done' : 'Next';
    }
    tourState.skipBtn.style.display = step.hideSkip ? 'none' : '';

    // Larger primary button (Welcome "Start tour") — visual dominance over Skip.
    tourState.nextBtn.classList.toggle('onboarding-bubble-btn-large', !!step.primaryLarge);

    // Render order — by default the primary (Next) sits rightmost. On the
    // Welcome step we flip it so "Start tour" leads and "Skip" is to its right.
    if (tourState.controls) {
      if (step.primaryFirst) {
        tourState.controls.dataset.primaryFirst = 'true';
      } else {
        delete tourState.controls.dataset.primaryFirst;
      }
    }

    if (step.secondaryButton && step.secondaryButton.label) {
      tourState.secondaryBtn.textContent = step.secondaryButton.label;
      tourState.secondaryBtn.dataset.action = step.secondaryButton.action || '';
      // `variant: 'subtle'` de-emphasises the secondary button (used on Welcome so
      // Start tour is clearly primary). Default styling is accent-tinted for
      // positive CTAs like "Take the extended tour" on the Thanks bookend.
      if (step.secondaryButton.variant) {
        tourState.secondaryBtn.dataset.variant = step.secondaryButton.variant;
      } else {
        delete tourState.secondaryBtn.dataset.variant;
      }
      tourState.secondaryBtn.style.display = '';
    } else {
      tourState.secondaryBtn.style.display = 'none';
      delete tourState.secondaryBtn.dataset.action;
      delete tourState.secondaryBtn.dataset.variant;
    }

    // Size + positioning variant — centered (Welcome/Thanks) skip anchor work,
    // hide the arrow, and use viewport-centered inline positioning.
    if (step.variant === 'large') {
      tourState.bubble.classList.add('onboarding-bubble-large');
    } else {
      tourState.bubble.classList.remove('onboarding-bubble-large');
    }

    tourState.bubble.classList.add('visible');

    if (step.centered) {
      tourState.bubble.classList.add('onboarding-bubble-centered');
      tourState.bubble.style.left = '50%';
      tourState.bubble.style.top = '50%';
      unhighlightTarget();
      unhighlightOrigin();
      requestAnimationFrame(() => { tourState.nextBtn.focus(); });
    } else {
      tourState.bubble.classList.remove('onboarding-bubble-centered');
      highlightTarget(target, step.highlightClass);
      highlightOrigin(step.originSelector);
      requestAnimationFrame(() => {
        positionBubble(target, step.placement);
        tourState.nextBtn.focus();
      });
    }

    if (tourState.liveRegion) {
      const bodyText = tourState.bodyEl.textContent;
      const prefix = step.isBookend
        ? ''
        : `Step ${contentSteps.indexOf(step) + 1} of ${contentSteps.length}. `;
      tourState.liveRegion.textContent = `${prefix}${step.title}. ${bodyText}`;
    }

    tourState.currentIndex = index;
    tourState.currentStepAfterExitCalled = false;
    emit('show', step, index);
  }

  // ----------------------------------------
  // Navigation
  // ----------------------------------------

  // Run the current step's afterExit exactly once per step render, regardless of
  // whether transition is Next, Back, Skip, Esc, or tour-end-via-complete.
  function runAfterExit() {
    if (tourState.currentStepAfterExitCalled) return;
    const step = tourState.visibleSteps[tourState.currentIndex];
    if (step && typeof step.afterExit === 'function') {
      try { step.afterExit(tourState.hooks); } catch (_) { /* non-critical */ }
    }
    tourState.currentStepAfterExitCalled = true;
  }

  function nextStep() {
    runAfterExit();
    // No 'next' emit — every Next click is followed by a 'show' on the
    // next step (or a 'complete' on the final step), so tracking 'next'
    // would double-count progression.
    const nextIndex = tourState.currentIndex + 1;
    if (nextIndex >= tourState.visibleSteps.length) {
      return endTour('complete');
    }
    showStep(nextIndex);
  }

  function prevStep() {
    if (tourState.currentIndex === 0) return;
    runAfterExit();
    // No 'back' emit — every Back click is followed by a 'show' on the
    // previous step, so tracking 'back' would double-count navigation.
    showStep(tourState.currentIndex - 1);
  }

  function skipTour() {
    const step = tourState.visibleSteps[tourState.currentIndex];
    emit('skip', step, tourState.currentIndex);
    endTour('skip');
  }

  function endTour(reason) {
    if (!tourState.active) return;

    runAfterExit();
    restoreFilterToolbarState();
    unhighlightTarget();
    unhighlightOrigin();

    if (tourState.bubble) {
      tourState.bubble.classList.remove('visible');
      tourState.bubble.remove();
    }
    if (tourState.liveRegion) {
      tourState.liveRegion.remove();
    }
    if (tourState.escHandler) {
      document.removeEventListener('keydown', tourState.escHandler);
    }
    if (tourState.reposHandler) {
      window.removeEventListener('resize', tourState.reposHandler);
      window.removeEventListener('scroll', tourState.reposHandler, true);
    }
    if (tourState.previousFocus && typeof tourState.previousFocus.focus === 'function') {
      try { tourState.previousFocus.focus(); } catch (_) { /* ignore */ }
    }

    if (reason === 'complete') {
      emit('complete', null, tourState.currentIndex);
    }

    if (typeof tourState.onComplete === 'function') {
      try { tourState.onComplete(tourState.version); } catch (_) { /* non-critical */ }
    }

    tourState.active = false;
    tourState.bubble = null;
    tourState.arrow = null;
    tourState.titleEl = null;
    tourState.bodyEl = null;
    tourState.counterEl = null;
    tourState.backBtn = null;
    tourState.nextBtn = null;
    tourState.skipBtn = null;
    tourState.secondaryBtn = null;
    tourState.controls = null;
    tourState.liveRegion = null;
    tourState.visibleSteps = [];
    tourState.currentIndex = 0;
    tourState.onComplete = null;
    tourState.escHandler = null;
    tourState.reposHandler = null;
    tourState.previousFocus = null;
    tourState.filterToolbarWasCollapsed = false;
    tourState.tourName = null;
  }

  // ----------------------------------------
  // Analytics
  // ----------------------------------------

  function emit(action, step, index) {
    if (typeof tourState.trackEventFn !== 'function') return;
    try {
      tourState.trackEventFn('onboarding_step', {
        action,
        step: index,
        step_name: step ? step.step_name : null,
        total_steps: tourState.visibleSteps.length,
        tour_version: tourState.version,
        // tourName lets external tours (e.g. What's New) identify themselves
        // in analytics without a separate event type. Falls back to the
        // base/extended distinction for the built-in onboarding tours.
        tour: tourState.tourName || (tourState.isExtended ? 'extended' : 'base')
      });
    } catch (_) { /* non-critical */ }
  }

  // Handle clicks on the optional per-step secondary button (e.g. the owl
  // step's "Continue on extended tour"). Dispatches by action name so new
  // secondary actions can be added as data — no DOM wiring needed.
  function handleSecondaryButton() {
    const step = tourState.visibleSteps[tourState.currentIndex];
    if (!step || !step.secondaryButton) return;
    const action = step.secondaryButton.action;
    if (action === 'continue_extended') {
      emit('continue_extended', step, tourState.currentIndex);
      const launcher = configuredHooks && configuredHooks.startExtendedTour;
      // End the base tour as complete — persists onboardingCompletedVersion —
      // then hand off to the launcher for a clean start of the extended tour.
      endTour('complete');
      if (typeof launcher === 'function') {
        setTimeout(() => launcher(), 0);
      }
    } else if (action === 'skip_tour') {
      // Welcome step: "Skip tour — I know the extension" — ends the tour and
      // saves the completion flag so it doesn't auto-show again.
      skipTour();
    }
  }

  // ----------------------------------------
  // Entry point
  // ----------------------------------------

  function start(options) {
    if (tourState.active) return;
    const opts = options || {};
    const steps = Array.isArray(opts.steps) ? opts.steps : TOUR_STEPS;
    const version = opts.version || TOUR_VERSION;

    const visibleSteps = steps.filter((s) => {
      if (typeof s.skipIf !== 'function') return true;
      try { return !s.skipIf(); } catch (_) { return true; }
    });

    if (visibleSteps.length === 0) return;

    tourState.active = true;
    tourState.visibleSteps = visibleSteps;
    tourState.currentIndex = 0;
    tourState.version = version;
    tourState.isExtended = !!opts.isExtended;
    tourState.trackEventFn = opts.trackEventFn || null;
    tourState.onComplete = opts.onComplete || null;
    tourState.hooks = opts.hooks || configuredHooks || {};
    tourState.reason = opts.reason || 'auto';
    tourState.tourName = opts.tourName || null;
    tourState.previousFocus = document.activeElement;
    tourState.currentStepAfterExitCalled = false;
    tourState.stepBackup.clear();

    buildBubble();

    if (tourState.reason === 'replay') {
      emit('replay', visibleSteps[0], 0);
    }

    tourState.escHandler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        skipTour();
      }
    };
    document.addEventListener('keydown', tourState.escHandler);

    tourState.reposHandler = () => {
      const step = tourState.visibleSteps[tourState.currentIndex];
      if (!step || step.centered) return;
      const target = resolveAnchor(step);
      if (target) positionBubble(target, step.placement);
    };
    window.addEventListener('resize', tourState.reposHandler);
    window.addEventListener('scroll', tourState.reposHandler, true);

    showStep(0);
  }

  function startExtended(options) {
    const opts = options || {};
    start({
      ...opts,
      steps: EXTENDED_TOUR_STEPS,
      version: TOUR_VERSION_EXTENDED,
      isExtended: true
    });
  }

  /**
   * Register integration hooks once so both auto-start (from addEvent) and the
   * Replay button (from settings.js) can open the Settings/Help modals and
   * switch view modes without duplicating the wiring. Called by panel.js at init.
   *
   * Expected hooks (all optional): openSettings, closeSettings, openHelp,
   * closeHelp, setViewMode(mode), getViewMode() -> string.
   */
  function configureHooks(hooks) {
    configuredHooks = hooks || {};
  }

  window.OnboardingTour = {
    TOUR_VERSION,
    TOUR_VERSION_EXTENDED,
    start,
    startExtended,
    end: () => endTour('external'),
    isActive: () => tourState.active,
    configureHooks
  };
})();
