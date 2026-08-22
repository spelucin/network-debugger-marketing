/**
 * Help Panel Content
 *
 * HTML content for the help panel tabs.
 * Extracted from panel.html for maintainability.
 */

// SVG icons used in help content
const HELP_ICONS = {
  eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
  wrench: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  // Capture control icons (match actual toolbar buttons)
  capturePlay: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="5" fill="currentColor"/></svg>',
  capturePause: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  captureStop: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>',
  // View mode icons (match actual toolbar)
  viewStream: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  viewTool: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  viewPage: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h4v10H3zM10 4h4v13h-4zM17 9h4v8h-4z"/></svg>',
  viewTree: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v12"/><circle cx="18" cy="6" r="3" fill="none"/><circle cx="18" cy="18" r="3" fill="none"/><circle cx="6" cy="18" r="3" fill="none"/><path d="M6 9c6 0 9 0 9 6"/></svg>',
  viewStack: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
  viewPinned: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76V6a3 3 0 0 1 6 0v4.76a2 2 0 0 0 1.11 1.79l1.78.9A2 2 0 0 1 19 15.24V16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-.76a2 2 0 0 1 1.11-1.79l1.78-.9A2 2 0 0 0 9 10.76z"/></svg>',
  // Filter toolbar icons
  chevronUp: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>',
  chevronDown: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>',
  chevronLeft: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>',
  chevronRight: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>',
  // Script initiator badges
  house: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  tag: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/></svg>',
  fork: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="5" r="3"/><circle cx="7" cy="19" r="3"/><circle cx="17" cy="12" r="3"/><path d="M7 8v8"/><path d="M7 14q0-2 7-2"/></svg>',
  // Toolbar button icons
  dlNesting: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h4M3 12h8M3 18h4M9 6h12M13 12h8M9 18h12"/></svg>',
  savePreset: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
  gear: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
  chat: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  grid: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  resize: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 3H3v18h18V3zM12 3v18"/></svg>',
  // Additional feature reference icons
  shield: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  shieldFilled: '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  arrowUp: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7-7 7 7"/></svg>',
  arrowDown: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7 7 7-7"/></svg>',
  copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
  info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  // "Compare formats" help link — circle with question mark, matches the
  // (?) icon used in the Compare formats menu item.
  help: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  expandAll: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 10l5 5 5-5"/></svg>',
  collapseAll: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 14l5-5 5 5"/></svg>',
  // Context menu icons
  ctxJson: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/></svg>',
  ctxHuman: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  ctxAI: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
  ctxTable: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>',
  ctxHighlight: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
  ctxDataLayer: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>',
  owlLogo: '<svg class="help-about-logo" width="48" height="48" viewBox="9 7 46 53" fill="none"><rect x="11" y="20" width="42" height="38" rx="14" fill="#10b981"/><polygon points="15,26 17,9 27,26" fill="#10b981"/><polygon points="37,26 47,9 49,26" fill="#10b981"/><circle cx="23" cy="36" r="12" fill="#6ee7b7"/><circle cx="41" cy="36" r="12" fill="#6ee7b7"/><circle cx="23" cy="36" r="9" fill="#1a1a2e"/><circle cx="41" cy="36" r="9" fill="#1a1a2e"/><circle cx="25" cy="36" r="3.5" fill="#ffffff"/><circle cx="43" cy="36" r="3.5" fill="#ffffff"/><polygon points="27,44 37,44 32,52" fill="#065f46"/><polygon points="30,44 32,40 34,44" fill="#064e3b"/></svg>',
  feedback: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  linkedin: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
  github: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>',
  // Cookie detection icons
  cookie: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.8 14.2A10 10 0 1 1 9.8 2.2a7 7 0 0 0 5.6 5.6 7 7 0 0 0 6.4 6.4z"/><circle cx="7.5" cy="9.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="11" cy="14" r="1.4" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r="1.2" fill="currentColor" stroke="none"/></svg>',
  // DataLayer push icons
  replay: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
  pencil: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  // Custom endpoints icons
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>'
};

// Help content for each tab
const HELP_CONTENT = {
  overview: `
    <div class="help-section">
      <h3>What is Event Watcher?</h3>
      <p>Event Watcher is a Chrome/Edge DevTools extension for debugging analytics and marketing tracking implementations. It captures and displays tracking events in real-time as you browse.</p>
    </div>
    <div class="help-section">
      <h3>Key Capabilities</h3>
      <ul>
        <li><strong>Real-time capture</strong> of 500+ analytics and marketing platforms</li>
        <li><strong>DataLayer monitoring</strong> for GTM, Adobe Data Layer, Tealium, and 5 more data layer types</li>
        <li><strong>Network request tracking</strong> to identify pixel fires and API calls</li>
        <li><strong>Script detection</strong> to see which tracking libraries are loaded</li>
        <li><strong>Script view</strong> to visualize script loading dependencies and see which scripts loaded which</li>
        <li><strong>Stack view</strong> to see the site&rsquo;s martech stack as a tree &mdash; one node per platform, parented by who loaded it</li>
        <li><strong>Pinned view</strong> to save a per-domain &ldquo;parking spot&rdquo; for events that survives Clear and reloads</li>
        <li><strong>Script initiator badges</strong> showing if a script was loaded by the website, a tag manager, or another script</li>
        <li><strong>DataLayer push source detection</strong> identifying who called each dataLayer.push()</li>
        <li><strong>GTM trigger correlation</strong> to link dataLayer pushes with fired tags</li>
        <li><strong>Cookie detection</strong> showing which cookies are set by tracking requests, with ePrivacy compliance flags</li>
        <li><strong>Consent Validation</strong> detecting 40+ CMPs and showing per-event consent status (granted, denied, pre-consent)</li>
        <li><strong>Cookie management</strong> to delete or edit cookies directly from the detail view</li>
        <li><strong>DataLayer push replay</strong> to re-fire or edit captured dataLayer events and observe GTM tag responses</li>
        <li><strong>Custom endpoints</strong> to map CNAME proxies or internal tools to known platforms, or create local-only tools</li>
        <li><strong>AI features (Bring Your Own Key)</strong> &mdash; per-event AI Summary, full-session AI Chat, Identify Unknown Platform, GTM Container AI &mdash; using your own Anthropic, OpenAI, or Gemini key</li>
        <li><strong>Event Comments</strong> to attach a free-text note to any captured event &mdash; flows into JSON exports and AI features</li>
        <li><strong>Capture controls</strong> to pause, stop, and resume event capture</li>
        <li><strong>Export events</strong> as JSON, table, or full export via right-click context menus and the Export button</li>
      </ul>
    </div>
    <div class="help-section">
      <h3>Supported Categories</h3>
      <p>Analytics, Tag Managers, Data Layers, First-Party Collection, Advertising, Ad Tech, CDPs, A/B Testing, Session Replay, Video Analytics, Marketing Automation, Consent Management, Widgets, and Monitoring.</p>
    </div>
  `,

  'getting-started': `
    <div class="help-section">
      <h3>Basic Usage</h3>
      <ol>
        <li>Open DevTools and click the <strong>Event Watcher</strong> tab</li>
        <li>Browse the website. Events appear in the left panel</li>
        <li>Click any event to see its details on the right</li>
      </ol>
    </div>

    <div class="help-section">
      <h3>View Modes</h3>
      <p>Switch how events are organized:</p>
      <div class="help-view-modes">
        <span class="help-view-btn help-view-btn-active">
          ${HELP_ICONS.viewStream}
          Stream
        </span>
        <span class="help-view-btn">
          ${HELP_ICONS.viewTool}
          Tool
        </span>
        <span class="help-view-btn">
          ${HELP_ICONS.viewPage}
          Page
        </span>
        <span class="help-view-btn">+</span>
        <span class="help-view-btn help-view-btn-standalone">
          ${HELP_ICONS.viewTree}
          Script
        </span>
        <span class="help-view-btn help-view-btn-standalone">
          ${HELP_ICONS.viewStack}
          Stack
        </span>
        <span class="help-view-btn help-view-btn-standalone">
          ${HELP_ICONS.viewPinned}
          Pinned
        </span>
      </div>
      <div class="help-capture-states" style="margin-top: 8px;">
        <div class="help-capture-row">
          <strong>Stream</strong>
          <span class="help-capture-desc">Chronological list grouped by page</span>
        </div>
        <div class="help-capture-row">
          <strong>Grouped</strong>
          <span class="help-capture-desc">Pinned-chip group: <em>Tool</em> (category/platform) and <em>Page</em> (domain/page path). The <strong>+</strong> opens the picker for more pivots — <em>Event Name</em>, <em>Consent Category</em>, <em>Datalayer</em> (push origin → vendor / script), <em>Endpoint</em> (first-party / third-party → host), <em>Cookie</em> (first-party / third-party → cookie name), and <em>Identity</em> (identifier kind → value) today, with more on the way.</span>
        </div>
        <div class="help-capture-row">
          <strong>Script</strong>
          <span class="help-capture-desc">Script loading dependency hierarchy</span>
        </div>
        <div class="help-capture-row">
          <strong>Stack</strong>
          <span class="help-capture-desc">The site&rsquo;s martech stack as a tree — one node per platform, parented by who loaded it (page → tag manager → tools)</span>
        </div>
        <div class="help-capture-row">
          <strong>Pinned</strong>
          <span class="help-capture-desc">A per-domain parking spot for events you&rsquo;ve saved. Hover any Stream row and click the pushpin; pinned events survive <em>Clear</em> and inspected-page reloads</span>
        </div>
      </div>
    </div>

    <div class="help-section">
      <h3>Capture Controls</h3>
      <p>Click the capture button to cycle through states:</p>
      <div class="help-capture-states">
        <div class="help-capture-row">
          <span class="help-toolbar-btn help-toolbar-btn-play">
            ${HELP_ICONS.capturePlay}
          </span>
          <div>
            <strong>Recording</strong>
            <span class="help-capture-desc">Events are captured in real-time</span>
          </div>
        </div>
        <div class="help-capture-row">
          <span class="help-toolbar-btn help-toolbar-btn-pause">
            ${HELP_ICONS.capturePause}
          </span>
          <div>
            <strong>Paused</strong>
            <span class="help-capture-desc">Events buffered until resumed</span>
          </div>
        </div>
        <div class="help-capture-row">
          <span class="help-toolbar-btn help-toolbar-btn-stop">
            ${HELP_ICONS.captureStop}
          </span>
          <div>
            <strong>Stopped</strong>
            <span class="help-capture-desc">No new events recorded</span>
          </div>
        </div>
        <div class="help-capture-row" style="margin-top: 4px;">
          <span class="help-toolbar-btn help-toolbar-btn-clear">
            ${HELP_ICONS.trash}
          </span>
          <div>
            <strong>Clear</strong>
            <span class="help-capture-desc">Remove all captured events</span>
          </div>
        </div>
      </div>
    </div>

    <div class="help-section">
      <h3>Search</h3>
      <div class="help-search-demo">
        <span class="help-search-box">
          ${HELP_ICONS.search}
          <span class="help-search-placeholder">Search events...</span>
        </span>
      </div>
      <p>Filter by event name, platform name, or URL.</p>
    </div>

    <div class="help-section">
      <h3>Filtering Events</h3>
      <p>The filter toolbar shows detected tools as colored chips.</p>
      <div class="help-capture-states">
        <div class="help-capture-row">
          <span class="help-btn help-btn-show">
            ${HELP_ICONS.eye}
            Show All
          </span>
          <span class="help-btn help-btn-hide">
            ${HELP_ICONS.eyeOff}
            Hide All
          </span>
        </div>
        <div class="help-capture-row">
          <strong>Click</strong>
          <span class="help-capture-desc">a chip to toggle visibility (<strong>colored</strong> = visible, <strong>grey</strong> = hidden)</span>
        </div>
        <div class="help-capture-row">
          <strong>Right-click</strong>
          <span class="help-capture-desc">a chip for "Show Only", "Hide", or "Highlight"</span>
        </div>
        <div class="help-capture-row">
          <strong>Click a category name</strong>
          <span class="help-capture-desc">to collapse/expand that category</span>
        </div>
        <div class="help-capture-row">
          <div class="help-collapse-btns">
            <span class="help-collapse-btn">${HELP_ICONS.chevronLeft}</span>
            <span class="help-collapse-btn">${HELP_ICONS.chevronRight}</span>
          </div>
          <span class="help-capture-desc">Collapse/expand all categories at once</span>
        </div>
        <div class="help-capture-row">
          <span class="help-collapse-btn help-collapse-btn-lg">${HELP_ICONS.chevronUp}</span>
          <span class="help-capture-desc">Collapse the entire filter toolbar into a single row</span>
        </div>
      </div>
    </div>

    <div class="help-section">
      <h3>Scripts &amp; Consent Filters</h3>
      <p>These special filters have three modes. Click to cycle:</p>
      <div class="help-filter-states">
        <div class="help-filter-state">
          <span class="help-chip help-chip-scripts">
            ${HELP_ICONS.wrench}
            Scripts:
            <span class="help-mode-badge help-mode-auto">AUTO</span>
            <span class="help-count">12</span>
          </span>
          <span class="help-state-desc">Scripts follow <strong>tool visibility</strong></span>
        </div>
        <div class="help-filter-state">
          <span class="help-chip help-chip-scripts help-chip-only">
            ${HELP_ICONS.wrench}
            Scripts:
            <span class="help-mode-badge help-mode-only">ONLY</span>
            <span class="help-count">12</span>
          </span>
          <span class="help-state-desc"><strong>Only scripts</strong>, hide all else</span>
        </div>
        <div class="help-filter-state">
          <span class="help-chip help-chip-scripts help-chip-hide">
            ${HELP_ICONS.wrench}
            Scripts:
            <span class="help-mode-badge help-mode-hide">HIDE</span>
            <span class="help-count">12</span>
          </span>
          <span class="help-state-desc"><strong>Hidden</strong> from event stream</span>
        </div>
      </div>
      <p class="help-hint">Consent filter: Auto / Only / Hide (events hidden, violations still tracked) / Off (all consent features disabled).</p>
    </div>

    <div class="help-section">
      <h3>Side Panel</h3>
      <p>Click the Event Watcher icon in the browser toolbar for a quick overview of detected tools grouped by category.</p>
    </div>
  `,

  features: `
    <!-- Options Bar -->
    <div class="help-accordion open">
      <button class="help-accordion-header">
        <span class="help-accordion-chevron">${HELP_ICONS.chevronDown}</span>
        Options Bar
      </button>
      <div class="help-accordion-body">
        <div class="help-section">
          <h3>Presets</h3>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <span class="help-toolbar-chip" style="color: var(--text-secondary); border-color: var(--border-color); background: var(--bg-secondary);">
                ${HELP_ICONS.savePreset}
                Presets
                ${HELP_ICONS.chevronDown}
              </span>
              <span class="help-capture-desc">Load a saved filter preset to quickly switch filter configurations</span>
            </div>
            <div class="help-capture-row">
              <span class="help-toolbar-chip help-toolbar-chip-accent">
                ${HELP_ICONS.savePreset}
                Save Preset
              </span>
              <span class="help-capture-desc">Save current tool visibility, Scripts/Consent modes, and DL Nesting state</span>
            </div>
          </div>
        </div>
        <div class="help-section">
          <h3>DL Nesting (GTM Correlation)</h3>
          <div class="help-capture-row" style="margin-bottom: 8px;">
            <span class="help-toolbar-chip help-toolbar-chip-nesting">
              ${HELP_ICONS.dlNesting}
              DL Nesting
            </span>
          </div>
          <p>Groups GTM tags under the <code>dataLayer.push()</code> that triggered them, shown as nested children. Works in Stream view and the Page pivot of Grouped view.</p>
        </div>
        <div class="help-section">
          <h3>Categories &amp; Tools</h3>
          <div class="help-capture-row" style="margin-bottom: 8px;">
            <span class="help-toolbar-btn" style="color: var(--text-secondary); border-color: var(--border-color); background: var(--bg-secondary);">
              ${HELP_ICONS.grid}
            </span>
            <span class="help-capture-desc">Browse all 500+ supported platforms. Search by name, view by category, and see detection patterns.</span>
          </div>
        </div>
        <div class="help-section">
          <h3>Custom Endpoints</h3>
          <div class="help-capture-row" style="margin-bottom: 8px;">
            <span class="help-toolbar-btn" style="color: var(--text-secondary); border-color: var(--border-color); background: var(--bg-secondary);">
              ${HELP_ICONS.plus}
            </span>
            <span class="help-capture-desc">The <strong>Custom</strong> tab in Categories &amp; Tools lets you add custom endpoint patterns.</span>
          </div>
          <p>Two modes:</p>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <strong>Add to existing tool</strong>
              <span class="help-capture-desc">Map a custom domain/path to a known platform (e.g. CNAME proxy &rarr; GA4)</span>
            </div>
            <div class="help-capture-row">
              <strong>Create new tool</strong>
              <span class="help-capture-desc">Define a local-only tool with custom name, category, and color</span>
            </div>
          </div>
          <p style="margin-top: 8px;">Custom endpoints are checked before built-in patterns, so your mappings take priority. Matched events show a blue <strong>CUSTOM</strong> badge in the stream.</p>
          <p class="help-hint">Saved in your browser only, so they won&rsquo;t sync across devices or browsers. Unknown events also show an &ldquo;Add endpoint&rdquo; button for quick setup.</p>
        </div>
        <div class="help-section">
          <h3>Feedback</h3>
          <div class="help-capture-row" style="margin-bottom: 8px;">
            <span class="help-toolbar-btn" style="color: var(--text-secondary); border-color: var(--border-color); background: var(--bg-secondary);">
              ${HELP_ICONS.chat}
            </span>
            <span class="help-capture-desc">Send feedback, report bugs, request features, report missing tools, or flag wrong consent categories. No account required.</span>
          </div>
        </div>
        <div class="help-section">
          <h3>Settings</h3>
          <div class="help-capture-row" style="margin-bottom: 8px;">
            <span class="help-toolbar-btn" style="color: var(--text-secondary); border-color: var(--border-color); background: var(--bg-secondary);">
              ${HELP_ICONS.gear}
            </span>
          </div>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <strong>Session Defaults</strong>
              <span class="help-capture-desc">How a new session starts &mdash; stream direction, sort order, Scripts/Consent modes, view mode, interactions visibility</span>
            </div>
            <div class="help-capture-row">
              <strong>Look &amp; Feel</strong>
              <span class="help-capture-desc">Visual presentation &mdash; <em>Theme</em> (System / Light / Dark), <em>Filter toolbar</em> layout (Full / One-row), <em>Categories</em> layout (Expanded / Collapsed), and <em>Tool chips &rarr; Count chip</em> (<em>Consent status</em> default with severity pill, or <em>Brand colour</em> for the legacy v1.2.0 look).</span>
            </div>
            <div class="help-capture-row">
              <strong>Features</strong>
              <span class="help-capture-desc">User on/off switches for whole feature areas &mdash; <em>Show AI features</em>, <em>GTM Hub</em>, <em>Script view</em>, <em>Cookie detection</em>, <em>Consent Check</em>. Default: on. Hides the surfaces instantly with no re-render. Also includes <em>Redact PII in AI prompts</em> (default on).</span>
            </div>
            <div class="help-capture-row">
              <strong>Data Layer</strong>
              <span class="help-capture-desc">Two subsections. <em>Detection:</em> toggle 8 data layer types &mdash; Google, Adobe Data Layer, Tealium, W3C, Commanders Act, Relay42, Piwik PRO, Ensighten (page reload required). <em>Nesting:</em> default DL Nesting state, correlation window, name-match window.</span>
            </div>
            <div class="help-capture-row">
              <strong>Export &amp; Debug</strong>
              <span class="help-capture-desc"><em>Export target</em> (clipboard or save as .json file), <em>AI tool target</em> for the large-export warning threshold (Strict 25K / Standard 50K / Relaxed 80K / Generous 150K / Off — recorded in <code>_export.targetTool</code>), and <em>Console logging</em> for URL matching diagnostics.</span>
            </div>
            <div class="help-capture-row">
              <strong>Privacy</strong>
              <span class="help-capture-desc">Anonymous usage analytics opt-out</span>
            </div>
          </div>
          <p class="help-hint">Each default can be set to a fixed value or "Last used" to remember your previous session.</p>
        </div>
      </div>
    </div>

    <!-- AI Features (BYOK) -->
    <div class="help-accordion">
      <button class="help-accordion-header">
        <span class="help-accordion-chevron">${HELP_ICONS.chevronDown}</span>
        AI Features (Bring Your Own Key)
      </button>
      <div class="help-accordion-body">
        <div class="help-section">
          <p>Event Watcher ships with optional AI features that run against your own API key with Anthropic (Claude), OpenAI, or Google (Gemini). Keys are stored locally in <code>chrome.storage.local</code> &mdash; they never leave your browser except to your chosen provider. You pay the provider directly; there is no Event Watcher account or proxy.</p>
        </div>

        <div class="help-section">
          <h3>Setting Up a Provider</h3>
          <ol style="margin: 4px 0; padding-left: 18px;">
            <li>Open the <strong>AI modal</strong> from the toolbar (sparkle icon) &mdash; the <strong>Provider</strong> tab opens first until setup is complete.</li>
            <li>Accept the one-time BYOK consent dialog (explains where keys are stored and what gets sent).</li>
            <li>Paste an API key for Anthropic, OpenAI, or Gemini. The key is tested with a small round-trip before it&rsquo;s saved.</li>
            <li>Pick a model from the provider&rsquo;s available list. Switch the active provider anytime from the same tab.</li>
          </ol>
          <p class="help-hint">You can configure more than one provider and switch between them. Remove a key any time &mdash; it wipes the stored credential immediately.</p>
        </div>

        <div class="help-section">
          <h3>AI Summary (per event)</h3>
          <p>Open any event&rsquo;s detail view and scroll to the <strong>AI Summary</strong> section. Pick a preset or ask a free-form question &mdash; the event payload is sent to your provider and a Markdown reply is rendered inline. Every turn is saved to the event so you can come back later.</p>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <strong>Known platform events</strong>
              <span class="help-capture-desc">Explain Event &middot; Explain Tool &middot; Analyse Properties &middot; QA Implementation</span>
            </div>
            <div class="help-capture-row">
              <strong>DataLayer / GTM / gtag pushes</strong>
              <span class="help-capture-desc">Explain Push &middot; Evaluate DL Quality &middot; Check Best Practices &middot; Suggest Improvements</span>
            </div>
            <div class="help-capture-row">
              <strong>Script loads</strong>
              <span class="help-capture-desc">Explain Script &middot; Trace Load Chain &middot; Review Privacy / Consent &middot; Optimisation Tips</span>
            </div>
            <div class="help-capture-row">
              <strong>Unknown events</strong>
              <span class="help-capture-desc">Identify Platform &mdash; one click to get a best-guess platform name; accept to save it as a Custom Endpoint.</span>
            </div>
            <div class="help-capture-row">
              <strong>Ask anything&hellip;</strong>
              <span class="help-capture-desc">Free-form question about the current event. Follow-ups continue the same thread.</span>
            </div>
          </div>
          <p class="help-hint">Replies render as Markdown. Use <strong>Copy reply</strong> on each assistant turn, or <strong>Show prompt</strong> to inspect the exact payload that was sent.</p>
        </div>

        <div class="help-section">
          <h3>AI Chat (whole session)</h3>
          <p>The <strong>Chat</strong> tab in the AI modal lets you ask questions across the full captured session &mdash; <em>"did all purchase events fire with currency?"</em>, <em>"what order did the signup flow fire in?"</em>, <em>"which consent category is this site missing?"</em></p>
          <p>A snapshot of your captured events is sent once at the start of the conversation; follow-ups send only the new chat history, so long threads stay cheap. Toggle <strong>Use filtered only</strong> to scope the snapshot to what the Stream filters currently show.</p>
          <p class="help-hint">Recent chats are saved locally (last 5). Start a new chat from the Chat tab header, or load / delete saved chats from the history menu.</p>
        </div>

        <div class="help-section">
          <h3>Auto-identify Unknown Platforms</h3>
          <p>Optional toggle under Provider &rarr; Automatic actions. When on, every unknown event runs the <em>Identify Platform</em> preset automatically in the background. The usual AI Summary UI surfaces the result &mdash; you still confirm with <strong>Add as Custom Endpoint</strong> before anything is saved.</p>
          <p class="help-hint">Off by default. Uses your own API quota, one call per unknown endpoint.</p>
        </div>

        <div class="help-section">
          <h3>Privacy &amp; Cost</h3>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <strong>Where keys live</strong>
              <span class="help-capture-desc"><code>chrome.storage.local</code>, this browser only. No sync, no telemetry of key material, no server involvement on our side.</span>
            </div>
            <div class="help-capture-row">
              <strong>What gets sent</strong>
              <span class="help-capture-desc">The parsed event &amp; request context for the selected event, or a snapshot of captured events for Chat. Never raw cookies, page content, or browsing history.</span>
            </div>
            <div class="help-capture-row">
              <strong>PII redaction</strong>
              <span class="help-capture-desc">Settings &rarr; Features &rarr; <em>Redact PII in AI prompts</em> runs a regex pass in the service worker before anything is sent. Default: on.</span>
            </div>
            <div class="help-capture-row">
              <strong>Turning AI off</strong>
              <span class="help-capture-desc">Settings &rarr; Features &rarr; <em>Show AI features</em>. Hides the AI toolbar button and in-event AI Summary sections entirely &mdash; no background calls, nothing sent.</span>
            </div>
          </div>
          <p class="help-hint">Token counts for each request are shown under the reply so you can see what each call costs against your provider quota.</p>
        </div>
      </div>
    </div>

    <!-- Filter Toolbar -->
    <div class="help-accordion">
      <button class="help-accordion-header">
        <span class="help-accordion-chevron">${HELP_ICONS.chevronDown}</span>
        Filter Toolbar
      </button>
      <div class="help-accordion-body">
        <div class="help-section">
          <h3>Show &amp; Hide Tools</h3>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <span class="help-btn help-btn-show">
                ${HELP_ICONS.eye}
                Show All
              </span>
              <span class="help-btn help-btn-hide">
                ${HELP_ICONS.eyeOff}
                Hide All
              </span>
            </div>
          </div>
          <p>Quickly toggle visibility of all detected tools at once.</p>
        </div>
        <div class="help-section">
          <h3>Tool Chip Interactions</h3>
          <p>Each detected tool appears as a colored chip in the filter toolbar. The chip&rsquo;s icon and border carry brand identity (Adobe red, Snapchat yellow, &hellip;); the small <strong>count badge</strong> at the right shows how many events that tool fired in the session.</p>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <strong>Click</strong>
              <span class="help-capture-desc">Toggle visibility (<strong>colored</strong> = visible, <strong>grey</strong> = hidden)</span>
            </div>
            <div class="help-capture-row">
              <strong>Right-click</strong>
              <span class="help-capture-desc">"Show Only", "Hide", or "Highlight" that tool</span>
            </div>
            <div class="help-capture-row">
              <strong>Click a category name</strong>
              <span class="help-capture-desc">Collapse/expand that category&rsquo;s tools</span>
            </div>
          </div>
          <p style="margin-top: 10px;"><strong>Consent severity pill (new in v1.3.0).</strong> When a tool fired with denied or pre-consent events, a small red or yellow pill appears next to its count badge with the actual violation count:</p>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <span class="help-consent-badge help-consent-badge-denied">${HELP_ICONS.shieldFilled}</span>
              <span class="help-capture-desc"><strong>Red pill</strong> &mdash; at least one event for this tool fired with denied consent. Digit = number of denied events.</span>
            </div>
            <div class="help-capture-row">
              <span class="help-consent-badge help-consent-badge-preconsent">${HELP_ICONS.shieldFilled}</span>
              <span class="help-capture-desc"><strong>Yellow pill</strong> &mdash; pre-consent / unknown / cookieless ping / CMP &harr; Google Consent Mode mismatch. Digit = number of warning events.</span>
            </div>
          </div>
          <p class="help-hint">The pill is suppressed when the Consent filter is set to <em>Off</em>, or when <em>Show Consent Check</em> is off in Settings &rarr; Features. Prefer the old brand-coloured count badge? Switch in Settings &rarr; Look &amp; Feel &rarr; Tool chips &rarr; <em>Count chip: Brand colour</em>.</p>
        </div>
        <div class="help-section">
          <h3>Scripts &amp; Consent Filters</h3>
          <p>These special filters have three modes. Click to cycle:</p>
          <div class="help-filter-states">
            <div class="help-filter-state">
              <span class="help-chip help-chip-scripts">
                ${HELP_ICONS.wrench}
                Scripts:
                <span class="help-mode-badge help-mode-auto">AUTO</span>
                <span class="help-count">12</span>
              </span>
              <span class="help-state-desc">Scripts follow <strong>tool visibility</strong></span>
            </div>
            <div class="help-filter-state">
              <span class="help-chip help-chip-scripts help-chip-only">
                ${HELP_ICONS.wrench}
                Scripts:
                <span class="help-mode-badge help-mode-only">ONLY</span>
                <span class="help-count">12</span>
              </span>
              <span class="help-state-desc"><strong>Only scripts</strong>, hide everything else</span>
            </div>
            <div class="help-filter-state">
              <span class="help-chip help-chip-scripts help-chip-hide">
                ${HELP_ICONS.wrench}
                Scripts:
                <span class="help-mode-badge help-mode-hide">HIDE</span>
                <span class="help-count">12</span>
              </span>
              <span class="help-state-desc"><strong>Hidden</strong> from event stream</span>
            </div>
          </div>
          <p class="help-hint">Consent filter (${HELP_ICONS.shield} shield icon, teal): Auto / Only / Hide / Off.</p>
        </div>
        <div class="help-section">
          <h3>Tool Search</h3>
          <div class="help-search-demo">
            <span class="help-search-box">
              ${HELP_ICONS.search}
              <span class="help-search-placeholder">Search detected tools...</span>
            </span>
          </div>
          <p>Filter the tool chips in the filter toolbar by name.</p>
        </div>
        <div class="help-section">
          <h3>Collapse Controls</h3>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <div class="help-collapse-btns">
                <span class="help-collapse-btn">${HELP_ICONS.chevronLeft}</span>
                <span class="help-collapse-btn">${HELP_ICONS.chevronRight}</span>
              </div>
              <span class="help-capture-desc">Collapse/expand all category frames at once</span>
            </div>
            <div class="help-capture-row">
              <span class="help-collapse-btn help-collapse-btn-lg">${HELP_ICONS.chevronUp}</span>
              <span class="help-capture-desc">Collapse entire filter toolbar into a compact one-row with category chips</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Event List & Views -->
    <div class="help-accordion">
      <button class="help-accordion-header">
        <span class="help-accordion-chevron">${HELP_ICONS.chevronDown}</span>
        Event List &amp; Views
      </button>
      <div class="help-accordion-body">
        <div class="help-section">
          <h3>View Modes</h3>
          <div class="help-view-modes">
            <span class="help-view-btn help-view-btn-active">
              ${HELP_ICONS.viewStream}
              Stream
            </span>
            <span class="help-view-btn">
              ${HELP_ICONS.viewTool}
              Tool
            </span>
            <span class="help-view-btn">
              ${HELP_ICONS.viewPage}
              Page
            </span>
            <span class="help-view-btn">+</span>
            <span class="help-view-btn help-view-btn-standalone">
              ${HELP_ICONS.viewTree}
              Script
            </span>
            <span class="help-view-btn help-view-btn-standalone">
              ${HELP_ICONS.viewStack}
              Stack
            </span>
            <span class="help-view-btn help-view-btn-standalone">
              ${HELP_ICONS.viewPinned}
              Pinned
            </span>
          </div>
          <div class="help-capture-states" style="margin-top: 8px;">
            <div class="help-capture-row">
              <strong>Stream</strong>
              <span class="help-capture-desc">Chronological event list grouped by page navigation. Default view.</span>
            </div>
            <div class="help-capture-row">
              <strong>Grouped &middot; Tool</strong>
              <span class="help-capture-desc">Events grouped by category and platform. Right-click headers for bulk export.</span>
            </div>
            <div class="help-capture-row">
              <strong>Grouped &middot; Page</strong>
              <span class="help-capture-desc">Events grouped by domain and page path. Right-click headers for export.</span>
            </div>
            <div class="help-capture-row">
              <strong>Grouped &middot; +</strong>
              <span class="help-capture-desc">Click the <strong>+</strong> chip to pin more pivots — <em>Event Name</em> (page_view, purchase, …), <em>Consent Category</em>, <em>Datalayer</em> (Website / Tag Manager / Script / Historical, with TMS vendor or script URL as the second tier), <em>Endpoint</em> (first-party / third-party → destination host), <em>Cookie</em> (first-party / third-party → cookie name), and <em>Identity</em> (identifier kind → value, surfaces mid-session ID changes) today; more pivots ship in future releases.</span>
            </div>
            <div class="help-capture-row">
              <strong>Script</strong>
              <span class="help-capture-desc">Script loading dependency hierarchy showing which scripts loaded which.</span>
            </div>
            <div class="help-capture-row">
              <strong>Stack</strong>
              <span class="help-capture-desc">The site&rsquo;s martech stack at the tool level &mdash; one node per platform, parented by who loaded it. See the <em>Stack view</em> section below.</span>
            </div>
            <div class="help-capture-row">
              <strong>Pinned</strong>
              <span class="help-capture-desc">Per-domain &ldquo;parking spot&rdquo; for events that survives Clear and reloads. See the <em>Pinned view</em> section below.</span>
            </div>
          </div>
        </div>
        <div class="help-section">
          <h3>Script View Details</h3>
          <p>Each script gets an initiator badge showing how it was loaded:</p>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <span class="help-initiator-badge">${HELP_ICONS.house}</span>
              <div>
                <strong>Website</strong>
                <span class="help-capture-desc">Loaded directly from the page HTML</span>
              </div>
            </div>
            <div class="help-capture-row">
              <span class="help-initiator-badge">${HELP_ICONS.tag}</span>
              <div>
                <strong>Tag Manager</strong>
                <span class="help-capture-desc">Injected by GTM, Tealium, Adobe Tags, etc.</span>
              </div>
            </div>
            <div class="help-capture-row">
              <span class="help-initiator-badge">${HELP_ICONS.fork}</span>
              <div>
                <strong>Script</strong>
                <span class="help-capture-desc">Loaded by another script (e.g., CMP loading a pixel)</span>
              </div>
            </div>
          </div>
          <p>Click any script to see what loaded it, what it loaded, and which platforms it provides.</p>
        </div>
        <div class="help-section">
          <h3>Stack view</h3>
          <p><strong>Stack view</strong> answers &ldquo;<em>what does this site use, and how is it wired together?</em>&rdquo; in one glance. The site&rsquo;s martech stack is rendered as a tree where each <strong>node is a platform</strong> (not a script), parented by who loaded it &mdash; page &rarr; tag manager &rarr; vendor tools.</p>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <strong>Per top-level domain</strong>
              <span class="help-capture-desc">Stack is scoped to the registrable domain of the inspected tab. Switching to a different site repaints the stack.</span>
            </div>
            <div class="help-capture-row">
              <strong>One card per platform</strong>
              <span class="help-capture-desc">GTM loading three GA4 scripts collapses to a single GA4 card &mdash; the stack tells you which tools the site uses, not how many beacons each one fired.</span>
            </div>
            <div class="help-capture-row">
              <strong>Attribution dot</strong>
              <span class="help-capture-desc">Each card carries a coloured dot &mdash; <strong>green</strong> (high-confidence parent), <strong>yellow</strong> (heuristic), <strong>grey</strong> (root or unknown). The detail panel&rsquo;s <em>Why this attribution</em> section explains in plain English which signal placed the tool where it sits.</span>
            </div>
            <div class="help-capture-row">
              <strong>Tool detail panel</strong>
              <span class="help-capture-desc">Click any card for the right-pane detail: <em>Overview</em>, <em>About Tool</em>, <em>Stack position</em>, <em>Session activity</em>, <em>Consent context</em>, and <em>Quick actions</em>.</span>
            </div>
          </div>
          <p style="margin-top: 8px;"><strong>Export formats</strong> &mdash; the toolbar Export button (when in Stack view) offers:</p>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <strong>Copy Stack as Markdown</strong>
              <span class="help-capture-desc">Bullet-tree text that pastes into docs, tickets, or AI chats.</span>
            </div>
            <div class="help-capture-row">
              <strong>Copy Stack as Mermaid</strong>
              <span class="help-capture-desc"><code>flowchart LR</code> diagram source &mdash; left-to-right data flow. Paste into any Mermaid-aware renderer (GitHub, Notion, Mermaid Live).</span>
            </div>
            <div class="help-capture-row">
              <strong>Download Stack as SVG</strong>
              <span class="help-capture-desc">A rendered snapshot of the stack as it appears on screen.</span>
            </div>
            <div class="help-capture-row">
              <strong>Copy Stack JSON</strong>
              <span class="help-capture-desc">Structured <code>event-watcher-stack/v1</code> JSON for programmatic use.</span>
            </div>
            <div class="help-capture-row">
              <strong>Save as MartechStack Builder JSON</strong>
              <span class="help-capture-desc">Drops the captured stack into <a href="https://app.martechstackbuilder.com/" target="_blank" rel="noopener">MartechStack Builder</a> via <em>File &rarr; Import JSON</em>. Vendor logos, brand colours, and capability metadata auto-attach on import.</span>
            </div>
          </div>
        </div>
        <div class="help-section">
          <h3>Pinned view</h3>
          <p><strong>Pinned view</strong> is a persistent parking spot for events. Hover any row in <em>Stream</em> view and click the pushpin &mdash; the event is saved and <strong>survives <em>Clear</em> and inspected-page reloads</strong>. No more export round-trip just to revisit a handful of events.</p>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <span class="help-toolbar-btn" style="color: var(--text-secondary); border-color: var(--border-color); background: var(--bg-secondary);">
                ${HELP_ICONS.viewPinned}
              </span>
              <div>
                <strong>Pinned toolbar button</strong>
                <span class="help-capture-desc">Sits next to Stack in the view-mode bar. The count badge shows how many events are pinned for the current domain.</span>
              </div>
            </div>
            <div class="help-capture-row">
              <strong>Pin from Stream</strong>
              <span class="help-capture-desc">Hover an event row and click the pushpin that appears on the right edge. Already-pinned rows keep the icon visible in teal.</span>
            </div>
            <div class="help-capture-row">
              <strong>Per-domain</strong>
              <span class="help-capture-desc">Pins are scoped to the registrable domain you captured them on. Different sites don&rsquo;t mix; switching tabs to a new site shows that site&rsquo;s own pins.</span>
            </div>
            <div class="help-capture-row">
              <strong>Multi-select &amp; bulk pin</strong>
              <span class="help-capture-desc">In Stream view, <strong>Shift-click</strong> a range or <strong>Ctrl/Cmd-click</strong> to toggle individual rows. With 2+ rows selected, click any row&rsquo;s pushpin to pin the whole selection in one gesture. <strong>Esc</strong> clears the selection.</span>
            </div>
            <div class="help-capture-row">
              <strong>Per-pin notes</strong>
              <span class="help-capture-desc">Each pinned row has an inline note field for a short reminder (&ldquo;<em>fires twice on mobile</em>&rdquo;, &ldquo;<em>missing currency</em>&rdquo;) &mdash; useful when you come back to the pin tomorrow.</span>
            </div>
            <div class="help-capture-row">
              <strong>Groups</strong>
              <span class="help-capture-desc">Drag pins between groups to organise investigation work; right-click a group header for copy or delete actions.</span>
            </div>
          </div>
          <p class="help-hint">Click the pushpin icon on a row again to unpin. Pinned events are stored in <code>chrome.storage.local</code> per domain &mdash; they don&rsquo;t sync across devices or browsers.</p>
        </div>
        <div class="help-section">
          <h3>GTM Container Info</h3>
          <p>When Event Watcher loads a GTM container (<code>gtm.js</code>), it parses the response body to surface container details — no GTM UI access required.</p>
          <ul>
            <li>The <strong>event stream</strong> shows version and active tag count in muted text: <em>GTM Load: GTM-XXXXX v29 &middot; 48 tags</em></li>
            <li>The <strong>overview card</strong> includes a Version row</li>
            <li>The <strong>Container Info</strong> section lists active/paused tag counts, variable count, trigger count, and an alphabetical list of event names read from tag configurations</li>
          </ul>
          <p class="help-hint">Event names come from tag configurations using a standard event type field — covers GA4, Amplitude, and similar templates. Custom HTML tags and vendor-specific templates with different field names are not shown. These are event names, not GTM tag names or trigger names.</p>
        </div>
        <div class="help-section">
          <h3>GTM Hub &amp; Container Intercept</h3>
          <p>The GTM Hub (diamond icon in the toolbar) provides container intelligence and intercept controls for all detected GTM containers.</p>
          <h4 style="margin: 10px 0 6px; font-size: 12px; color: var(--text-secondary);">Actions</h4>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <strong>Block</strong>
              <span class="help-capture-desc">Prevent a container from loading. The script request is cancelled at the network level. Use this to test what tracking fires without GTM.</span>
            </div>
            <div class="help-capture-row">
              <strong>Swap</strong>
              <span class="help-capture-desc">Replace a container with a different one. The original request is redirected to the replacement container. Use this to compare staging vs production GTM, or test a different container on any page.</span>
            </div>
            <div class="help-capture-row">
              <strong>Preview</strong>
              <span class="help-capture-desc">Load an unpublished GTM environment (draft, staging, or specific version). Paste a preview share link from GTM. The extension extracts the auth token and rewrites the container URL.</span>
            </div>
          </div>
          <h4 style="margin: 10px 0 6px; font-size: 12px; color: var(--text-secondary);">Quick Actions</h4>
          <p>GTM container events in the detail view show contextual action buttons: <strong>Block | Swap</strong> for containers with no rules, <strong>Disable | Remove</strong> for containers with active rules.</p>
          <h4 style="margin: 10px 0 6px; font-size: 12px; color: var(--text-secondary);">Rule Management</h4>
          <p>All rules support <strong>Disable</strong> (save for later reactivation) and <strong>Remove</strong> (permanently delete). Disabled rules appear in the Inactive section of the GTM Hub, grouped by domain.</p>
          <p>Active rules show a banner above the event stream with colored badges (Blocked / Swapped / Preview) and Disable/Remove buttons. Swapped containers show only the swap event in the stream; the original blocked load is hidden.</p>
          <h4 style="margin: 10px 0 6px; font-size: 12px; color: var(--text-secondary);">Good to Know</h4>
          <ul style="margin: 4px 0 0; padding-left: 18px; font-size: 11px; color: var(--text-secondary);">
            <li>Rules require a <strong>page reload</strong> to take effect. GTM loads once during page init and cannot be un-loaded mid-session.</li>
            <li>Rules are <strong>scoped per domain</strong>, so navigating to a different site won&rsquo;t apply rules from another domain.</li>
            <li>Rules <strong>persist across browser sessions</strong> and survive DevTools closure. Remember to disable or remove rules when done.</li>
            <li>Swap supports an optional <strong>note</strong> to describe the purpose of the rule (e.g., &ldquo;QA container for Campaign A&rdquo;).</li>
          </ul>
        </div>
        <div class="help-section">
          <h3>Capture Controls</h3>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <span class="help-toolbar-btn help-toolbar-btn-play">
                ${HELP_ICONS.capturePlay}
              </span>
              <div>
                <strong>Recording</strong>
                <span class="help-capture-desc">Events captured in real-time</span>
              </div>
            </div>
            <div class="help-capture-row">
              <span class="help-toolbar-btn help-toolbar-btn-pause">
                ${HELP_ICONS.capturePause}
              </span>
              <div>
                <strong>Paused</strong>
                <span class="help-capture-desc">Events buffered until resumed</span>
              </div>
            </div>
            <div class="help-capture-row">
              <span class="help-toolbar-btn help-toolbar-btn-stop">
                ${HELP_ICONS.captureStop}
              </span>
              <div>
                <strong>Stopped</strong>
                <span class="help-capture-desc">No new events recorded</span>
              </div>
            </div>
            <div class="help-capture-row" style="margin-top: 4px;">
              <span class="help-toolbar-btn help-toolbar-btn-clear">
                ${HELP_ICONS.trash}
              </span>
              <div>
                <strong>Clear</strong>
                <span class="help-capture-desc">Remove all captured events</span>
              </div>
            </div>
          </div>
          <p class="help-hint">Click the capture button to cycle: Recording → Paused → Stopped → Recording.</p>
        </div>
        <div class="help-section">
          <h3>Stream Direction &amp; Sort Order</h3>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <span class="help-toolbar-btn" style="color: var(--text-secondary); border-color: var(--border-color); background: var(--bg-secondary);">
                ${HELP_ICONS.arrowUp}
              </span>
              <div>
                <strong>Stream Direction</strong>
                <span class="help-capture-desc">Toggle newest events on top or oldest on top</span>
              </div>
            </div>
            <div class="help-capture-row">
              <span class="help-toolbar-btn" style="color: var(--text-secondary); border-color: var(--border-color); background: var(--bg-secondary);">
                <span style="font-size: 10px; font-weight: 600;">Start</span>
              </span>
              <div>
                <strong>Sort Order</strong>
                <span class="help-capture-desc">Sort by: <strong>Start</strong> (request initiated), <strong>Finish</strong> (request completed), or <strong>Index</strong> (capture order)</span>
              </div>
            </div>
          </div>
        </div>
        <div class="help-section">
          <h3>Search &amp; Expand/Collapse</h3>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <div class="help-search-demo" style="margin: 0;">
                <span class="help-search-box">
                  ${HELP_ICONS.search}
                  <span class="help-search-placeholder">Search events...</span>
                </span>
              </div>
              <span class="help-capture-desc">Filter by event name, platform, or URL</span>
            </div>
            <div class="help-capture-row">
              <span class="help-toolbar-btn" style="color: var(--text-secondary); border-color: var(--border-color); background: var(--bg-secondary);">
                ${HELP_ICONS.collapseAll}
              </span>
              <div>
                <strong>Expand / Collapse All</strong>
                <span class="help-capture-desc">Collapse or expand all groups in the current view mode</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Event Details -->
    <div class="help-accordion">
      <button class="help-accordion-header">
        <span class="help-accordion-chevron">${HELP_ICONS.chevronDown}</span>
        Event Details
      </button>
      <div class="help-accordion-body">
        <div class="help-section">
          <h3>Overview Card</h3>
          <p>Click any event to see its details. The overview card shows:</p>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <strong>Platform badge</strong>
              <span class="help-capture-desc">Platform icon, name, and brand color</span>
            </div>
            <div class="help-capture-row">
              <strong>Category tag</strong>
              <span class="help-capture-desc">Analytics, Advertising, Tag Manager, etc.</span>
            </div>
            <div class="help-capture-row">
              <strong>Timestamp</strong>
              <span class="help-capture-desc">High-precision time (HH:MM:SS.mmm)</span>
            </div>
            <div class="help-capture-row">
              <strong>Key properties</strong>
              <span class="help-capture-desc">Event name, page URL, and platform-specific fields</span>
            </div>
            <div class="help-capture-row">
              <strong>Request info</strong>
              <span class="help-capture-desc">HTTP method, request type, endpoint URL</span>
            </div>
          </div>
          <div class="help-capture-row" style="margin-top: 8px;">
            <span class="help-toolbar-btn" style="color: var(--text-secondary); border-color: var(--border-color); background: var(--bg-secondary);">
              ${HELP_ICONS.copy}
            </span>
            <span class="help-capture-desc">Click any value in the overview card to copy it to clipboard.</span>
          </div>
        </div>
        <div class="help-section">
          <h3>Consent Validation &amp; Trigger Correlation</h3>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <span class="help-toolbar-btn help-toolbar-btn-consent">
                ${HELP_ICONS.shield}
              </span>
              <div>
                <strong>Consent Validation</strong>
                <span class="help-capture-desc">Shows consent status for every event: green (granted), red (denied), or yellow (pre-consent). Detects 40+ CMPs automatically.</span>
              </div>
            </div>
            <div class="help-capture-row">
              <span class="help-toolbar-chip help-toolbar-chip-nesting">
                ${HELP_ICONS.dlNesting}
              </span>
              <div>
                <strong>Trigger Correlation</strong>
                <span class="help-capture-desc">Shows which <code>dataLayer.push()</code> triggered this tag (when DL Nesting is on)</span>
              </div>
            </div>
          </div>
        </div>
        <div class="help-section">
          <h3>Platform-Specific Sections</h3>
          <p>Parsed event data shown as structured tables or trees depending on platform:</p>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <strong>GA4</strong>
              <span class="help-capture-desc">Custom Data (event + user properties), E-Commerce Items, Consent Mode</span>
            </div>
            <div class="help-capture-row">
              <strong>Adobe Analytics</strong>
              <span class="help-capture-desc">eVars, props, events, products</span>
            </div>
            <div class="help-capture-row">
              <strong>Tealium</strong>
              <span class="help-capture-desc">utag_data, event data categorized by type</span>
            </div>
            <div class="help-capture-row">
              <strong>Amplitude, Mixpanel, PostHog</strong>
              <span class="help-capture-desc">Event properties and user properties as tables</span>
            </div>
            <div class="help-capture-row">
              <strong>Others</strong>
              <span class="help-capture-desc">Structured JSON tree with full request parameters</span>
            </div>
          </div>
        </div>
        <div class="help-section">
          <h3>Script Dependency Tree</h3>
          <p>Shows who loaded this script and what scripts it loaded in turn. Each node shows:</p>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <span class="help-initiator-badge">${HELP_ICONS.house}</span>
              <span class="help-capture-desc">Initiator badge (Website, Tag Manager, or Script)</span>
            </div>
            <div class="help-capture-row">
              <strong>Platform chips</strong>
              <span class="help-capture-desc">Which known platforms each script provides</span>
            </div>
          </div>
        </div>
        <div class="help-section">
          <h3>DataLayer Push Source</h3>
          <p>Each <code>dataLayer.push()</code> is classified by call stack analysis using the same initiator badges. Known platforms show a full badge with icon, name, and brand color.</p>
        </div>
        <div class="help-section">
          <h3>About Tool &amp; Matching Visualization</h3>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <span class="help-toolbar-btn" style="color: var(--text-secondary); border-color: var(--border-color); background: var(--bg-secondary);">
                ${HELP_ICONS.info}
              </span>
              <div>
                <strong>About Tool</strong>
                <span class="help-capture-desc">Platform description, documentation link, and detection patterns used</span>
              </div>
            </div>
            <div class="help-capture-row">
              <span class="help-toolbar-btn" style="color: var(--text-secondary); border-color: var(--border-color); background: var(--bg-secondary);">
                ${HELP_ICONS.search}
              </span>
              <div>
                <strong>Matching Visualization</strong>
                <span class="help-capture-desc">Step-by-step detection path showing how the event was identified (CNAME, pattern match, etc.)</span>
              </div>
            </div>
          </div>
        </div>
        <div class="help-section">
          <h3>Resizable Panels</h3>
          <div class="help-capture-row">
            <span class="help-toolbar-btn" style="color: var(--text-secondary); border-color: var(--border-color); background: var(--bg-secondary);">
              ${HELP_ICONS.resize}
            </span>
            <span class="help-capture-desc">Drag the divider between event list and detail panel. Double-click to collapse/expand the detail panel.</span>
          </div>
        </div>
        <div class="help-section">
          <h3>Cookie Detection</h3>
          <p>Events that set cookies via <code>Set-Cookie</code> response headers show a cookie badge in the event list:</p>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <span class="help-toolbar-btn help-toolbar-btn-cookie">
                ${HELP_ICONS.cookie}
              </span>
              <div>
                <strong>Cookie badge</strong>
                <span class="help-capture-desc">Appears on events whose response sets one or more cookies. Hover for cookie names and expiry durations.</span>
              </div>
            </div>
          </div>
          <p style="margin-top: 8px;">Click the event to see the <strong>Cookies Set</strong> section in the detail view (collapsed by default). Each cookie shows:</p>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <strong>Attributes</strong>
              <span class="help-capture-desc">Name, Value, Domain, Path, Expires, SameSite, Secure, HttpOnly, Partitioned</span>
            </div>
            <div class="help-capture-row">
              <strong>Compliance flag</strong>
              <span class="help-capture-desc">Cookies with expiry exceeding 13 months show an ePrivacy warning</span>
            </div>
          </div>
          <p style="margin-top: 8px;">Section header buttons:</p>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <span class="help-toolbar-btn help-toolbar-btn-clear">
                ${HELP_ICONS.trash}
              </span>
              <div>
                <strong>Delete / Delete All</strong>
                <span class="help-capture-desc">Remove cookies from the browser via the Chrome cookies API</span>
              </div>
            </div>
            <div class="help-capture-row">
              <span class="help-toolbar-btn" style="color: var(--text-secondary); border-color: var(--border-color); background: var(--bg-secondary);">
                ${HELP_ICONS.pencil}
              </span>
              <div>
                <strong>Edit</strong>
                <span class="help-capture-desc">Toggle edit mode to modify cookie attributes (Value, Domain, SameSite, etc.) and save changes</span>
              </div>
            </div>
          </div>
        </div>
        <div class="help-section">
          <h3>Event Comments</h3>
          <p>Spotted something off about an event? Click the <strong>${HELP_ICONS.pencil} pencil</strong> at the bottom of the Overview card to attach a free-text note &mdash; <em>"this purchase is missing currency"</em>, <em>"fires twice on mobile"</em>.</p>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <strong>Session-scoped</strong>
              <span class="help-capture-desc">Comments live with the event in this session. They clear when you clear events; nothing persists across reloads.</span>
            </div>
            <div class="help-capture-row">
              <strong>Travels with exports</strong>
              <span class="help-capture-desc">Stored as <code>userComment</code> in JSON / Full Export, so any AI assistant reading the export sees your note next to the raw event.</span>
            </div>
            <div class="help-capture-row">
              <strong>Picked up by AI features</strong>
              <span class="help-capture-desc">AI Summary, Page AI, and AI Chat automatically include attached comments in their prompts.</span>
            </div>
            <div class="help-capture-row">
              <strong>Row indicator</strong>
              <span class="help-capture-desc">Events with a comment show a small marker on the event-list row; hover for the first line.</span>
            </div>
          </div>
          <p class="help-hint">Plain text only, 2000-character cap, paste-overflow truncation, counter near the limit.</p>
        </div>
        <div class="help-section">
          <h3>DataLayer Push &amp; Replay</h3>
          <p>For captured <code>dataLayer.push()</code> events, two action buttons appear in the section header:</p>
          <div class="help-capture-states">
            <div class="help-capture-row">
              <span class="help-toolbar-btn help-toolbar-btn-datalayer">
                ${HELP_ICONS.replay}
              </span>
              <div>
                <strong>Push again</strong>
                <span class="help-capture-desc">Re-push the exact payload to the page. GTM processes it and fires matching tags.</span>
              </div>
            </div>
            <div class="help-capture-row">
              <span class="help-toolbar-btn" style="color: var(--text-secondary); border-color: var(--border-color); background: var(--bg-secondary);">
                ${HELP_ICONS.pencil}
              </span>
              <div>
                <strong>Edit &amp; Push</strong>
                <span class="help-capture-desc">Opens a JSON editor to modify the payload before pushing. Useful for testing edge cases.</span>
              </div>
            </div>
          </div>
          <p style="margin-top: 8px;">Replayed events appear in the stream with a blue <strong>&ldquo;Pushed&rdquo;</strong> badge to distinguish them from organic events. If DL Nesting is enabled, triggered tags are nested under the pushed event automatically.</p>
          <p class="help-hint">GTM internal events (gtm.js, gtm.dom, gtm.load) are excluded; push buttons are not shown for these.</p>
        </div>
      </div>
    </div>

    <!-- Context Menus & Export -->
    <div class="help-accordion">
      <button class="help-accordion-header">
        <span class="help-accordion-chevron">${HELP_ICONS.chevronDown}</span>
        Context Menus &amp; Export
      </button>
      <div class="help-accordion-body">
        <div class="help-section">
          <h3>Right-click Events</h3>
          <div class="help-context-menu">
            <div class="help-context-item">
              ${HELP_ICONS.eye}
              Show only
            </div>
            <div class="help-context-item">
              ${HELP_ICONS.eyeOff}
              Hide tool
            </div>
            <div class="help-context-sep"></div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxHighlight}
              Highlight
            </div>
            <div class="help-context-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              Clear all highlights
            </div>
            <div class="help-context-sep"></div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxAI}
              Copy for AI
            </div>
            <div class="help-context-sep"></div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxHuman}
              Copy for Human
            </div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxJson}
              Copy Complete
            </div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxTable}
              Copy Markdown Table
            </div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxJson}
              Copy Consent
            </div>
            <div class="help-context-sep"></div>
            <div class="help-context-item">
              ${HELP_ICONS.help}
              Compare formats
            </div>
          </div>
        </div>
        <div class="help-section">
          <h3>Right-click Page Headers</h3>
          <p class="help-hint" style="margin-bottom: 6px;">In Stream view, right-click any page header:</p>
          <div class="help-context-menu">
            <div class="help-context-item">
              ${HELP_ICONS.ctxAI}
              Copy for AI
            </div>
            <div class="help-context-sep"></div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxHuman}
              Copy for Human
            </div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxJson}
              Copy Complete
            </div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxTable}
              Copy page as TSV
            </div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxDataLayer}
              Copy Full dataLayer
            </div>
            <div class="help-context-sep"></div>
            <div class="help-context-item">
              ${HELP_ICONS.help}
              Compare formats
            </div>
          </div>
        </div>
        <div class="help-section">
          <h3>Right-click Group Headers</h3>
          <p class="help-hint" style="margin-bottom: 6px;">In the Tool and Page pivots of Grouped view, right-click category, platform, domain, or page headers:</p>
          <div class="help-context-menu">
            <div class="help-context-item">
              ${HELP_ICONS.eye}
              Show only
            </div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxHighlight}
              Highlight
            </div>
            <div class="help-context-sep"></div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxAI}
              Copy for AI
            </div>
            <div class="help-context-sep"></div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxHuman}
              Copy for Human
            </div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxJson}
              Copy Complete
            </div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxTable}
              Copy Markdown Table
            </div>
            <div class="help-context-sep"></div>
            <div class="help-context-item">
              ${HELP_ICONS.help}
              Compare formats
            </div>
          </div>
        </div>
        <div class="help-section">
          <h3>Right-click Script view</h3>
          <div class="help-context-menu">
            <div class="help-context-item">
              ${HELP_ICONS.eye}
              Show only
            </div>
            <div class="help-context-item">
              ${HELP_ICONS.eyeOff}
              Hide tool
            </div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxHighlight}
              Highlight
            </div>
            <div class="help-context-sep"></div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxJson}
              Copy JSON Branch
            </div>
          </div>
        </div>
        <div class="help-section">
          <h3>Export Button</h3>
          <p>The Export button in the toolbar exports all captured events across all pages. The same formats are also available in <em>right-click on a page</em> and <em>right-click on a group header</em>:</p>
          <div class="help-context-menu">
            <div class="help-context-item">
              ${HELP_ICONS.ctxAI}
              Copy for AI
            </div>
            <div class="help-context-sep"></div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxHuman}
              Copy for Human
            </div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxJson}
              Copy Complete
            </div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxTable}
              Copy Markdown Table
            </div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxDataLayer}
              Copy dataLayer Pushes
            </div>
            <div class="help-context-item">
              ${HELP_ICONS.ctxDataLayer}
              Copy Full dataLayer
            </div>
            <div class="help-context-sep"></div>
            <div class="help-context-item">
              ${HELP_ICONS.help}
              Compare formats
            </div>
          </div>
          <p class="help-hint"><strong>Copy dataLayer Pushes</strong> exports just what the site pushed to the classic <code>window.dataLayer</code> (GTM/gtag); <strong>Copy Full dataLayer</strong> adds the computed state after each push for GTM debugging. Both cover the classic <code>window.dataLayer</code> only &mdash; named layers like Adobe Client Data Layer, Tealium <code>utag_data</code>, and W3C <code>digitalData</code> are not included.</p>
          <p class="help-hint">In <strong>Script view</strong>, the Export button shows view-specific items instead: <em>Copy as Markdown</em> (bullet tree) and <em>Copy JSON Full Tree</em>. In <strong>Stack view</strong>: <em>Copy Stack as Markdown</em>, <em>Copy Stack as Mermaid</em> (<code>flowchart LR</code>), <em>Download Stack as SVG</em>, and <em>Copy Stack JSON</em>.</p>
          <p class="help-hint"><strong>Compare formats</strong> at the bottom of every export menu opens a side-by-side description with the current AI tool target. Three JSON tiers: <strong>for AI</strong> (sparse-object schema, capped to fit AI tool input limits), <strong>for Human</strong> (curated, readable), <strong>Complete</strong> (raw HTTP, consent timeline, all diagnostic sections). Plus <strong>Copy Markdown Table</strong> (renders in GitHub / Notion / Slack / AI chat). Pick the AI tool target in <em>Settings &rarr; Export &amp; Debug</em>.</p>
        </div>
        <div class="help-section">
          <h3>Side Panel</h3>
          <p>Click the Event Watcher icon in the browser toolbar for a quick overview of detected tools grouped by category. No DevTools needed.</p>
        </div>
      </div>
    </div>
  `,

  'consent-check': `
    <div class="help-section">
      <h3>What is Consent Validation?</h3>
      <p>Consent Validation automatically detects the Consent Management Platform (CMP) on each page and shows whether each tracking request was fired with proper consent. It answers: <em>&ldquo;Did this tool have permission to fire?&rdquo;</em></p>
      <div class="help-info-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <div>
          <strong>Disclaimer</strong><br>
          Consent Validation relies on general assumptions about how CMPs and tracking tools work. It cannot detect every CMP, custom implementation, or non-standard setup. A &ldquo;denied&rdquo; flag is a starting point for investigation &mdash; not proof of a violation. Always verify flagged events against your actual consent configuration before drawing conclusions.
        </div>
      </div>
      <h4 style="margin-top: 14px; margin-bottom: 6px; font-size: 12px;">Consent Badges</h4>
      <div class="help-capture-states">
        <div class="help-capture-row">
          <span class="help-consent-badge help-consent-badge-denied">${HELP_ICONS.shieldFilled}</span>
          <span class="help-capture-desc"><strong>Violation.</strong> The required consent category was denied. Always visible when detected.</span>
        </div>
        <div class="help-capture-row">
          <span class="help-consent-badge help-consent-badge-preconsent">${HELP_ICONS.shieldFilled}</span>
          <span class="help-capture-desc"><strong>Potential issue.</strong> Fired before the user made a consent choice, or the consent state could not be determined. Also shown for denied requests that may not be actual tracking (e.g., config calls).</span>
        </div>
        <div class="help-capture-row">
          <span class="help-consent-badge help-consent-badge-preconsent">${HELP_ICONS.shieldFilled}</span>
          <span class="help-capture-desc"><strong>Consent Mode mismatch.</strong> The CMP says the category is granted, but Google Consent Mode (a <code>consent:default</code> or <code>consent:update</code> push) disagrees on the same category at event time. CMP remains the consent authority &mdash; the event is allowed &mdash; but the Google product running degraded (cookieless pings) until the GCM signal catches up. Shown <em>only</em> for Google products that actually read GCM (GA4, Google Ads, Floodlight, Campaign Manager, gtag/GTM, etc.); other vendors (Meta, Snap, TikTok, LinkedIn, &hellip;) have their own pixel-level consent APIs and ignore GCM, so the warning is suppressed for their requests.</span>
        </div>
        <div class="help-capture-row">
          <span class="help-consent-badge help-consent-badge-granted">${HELP_ICONS.shieldFilled}</span>
          <span class="help-capture-desc"><strong>Granted.</strong> The required consent category was granted. Only shown in &ldquo;Only&rdquo; filter mode.</span>
        </div>
        <div class="help-capture-row">
          <span class="help-consent-badge help-consent-badge-signal">${HELP_ICONS.shield}</span>
          <span class="help-capture-desc"><strong>Consent signal.</strong> CMP platform events, Google Consent Mode pushes, and dataLayer consent events. Informational only, not a pass/fail check.</span>
        </div>
      </div>
      <h4 style="margin-top: 14px; margin-bottom: 6px; font-size: 12px;">Per-Tool Severity in the Filter Toolbar</h4>
      <p>The <strong>session counter</strong> (top toolbar) tells you <em>that</em> a violation exists somewhere in the session. The <strong>per-tool warning pill</strong> on each filter-toolbar chip tells you <em>which tool</em> is the offender, and how many violations it fired:</p>
      <ul>
        <li><strong>Red pill</strong> next to a tool&rsquo;s count &mdash; that tool fired at least one event with denied consent. The digit is the denied-event count.</li>
        <li><strong>Yellow pill</strong> &mdash; that tool fired at least one pre-consent, unknown-state, cookieless-ping, or CMP &harr; Google Consent Mode mismatched event. The digit is the warning-event count.</li>
        <li><strong>No pill</strong> &mdash; every event from that tool was granted-and-clean (or exempt infrastructure).</li>
      </ul>
      <p class="help-hint">Suppressed when the <strong>Consent filter</strong> is set to <em>Off</em>, or when <strong>Show Consent Check</strong> is turned off in Settings &rarr; Features. Switch back to brand-coloured count badges (no severity overlay) in Settings &rarr; Look &amp; Feel &rarr; Tool chips.</p>
    </div>

    <div class="help-section">
      <h3>Three Unified Categories</h3>
      <p>Every CMP uses different names and groupings. Event Watcher normalizes them into 3 unified categories:</p>
      <table class="help-consent-table">
        <thead>
          <tr><th>Category</th><th>What it covers</th><th>Google CM signal</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>Analytics</strong></td><td>Analytics, session replay, video analytics, CDPs, first-party collection</td><td>analytics_storage</td></tr>
          <tr><td><strong>Marketing</strong></td><td>Advertising, ad tech, marketing automation</td><td>ad_storage</td></tr>
          <tr><td><strong>Functional</strong></td><td>A/B testing, widgets, monitoring</td><td>functionality_storage</td></tr>
        </tbody>
      </table>
      <p class="help-hint">Infrastructure tools (tag managers, data layers, consent platforms) are <strong>exempt</strong> and don&rsquo;t require consent.</p>
    </div>

    <div class="help-section">
      <h3>How It Works</h3>
      <ol>
        <li><strong>CMP Detection.</strong> Reads consent state from CMP cookies, window APIs, and dataLayer pushes</li>
        <li><strong>Timeline.</strong> Builds a chronological consent timeline with all consent signals</li>
        <li><strong>Per-event check.</strong> For each tracking event, looks up the consent state at the time it fired</li>
        <li><strong>Category matching.</strong> Maps the tool&rsquo;s platform category to a required consent category</li>
      </ol>
    </div>

    <div class="help-section">
      <h3>Consent State Markers</h3>
      <p>When consent state changes are detected, markers appear in the event stream showing the transition:</p>
      <div class="help-capture-states">
        <div class="help-capture-row">
          <strong>Baseline</strong>
          <span class="help-capture-desc">Initial consent state from CMP cookies at page load (T=0)</span>
        </div>
        <div class="help-capture-row">
          <strong>Consent Given / Updated</strong>
          <span class="help-capture-desc">User accepted or changed consent via the CMP banner</span>
        </div>
        <div class="help-capture-row">
          <strong>Consent Revoked</strong>
          <span class="help-capture-desc">User withdrew consent for one or more categories</span>
        </div>
      </div>
      <p class="help-hint">Each marker shows category chips (analytics, marketing, functional) color-coded by consent state. Click a marker to see the full consent timeline in the detail view.</p>
    </div>

    <div class="help-section">
      <h3>Consent Data Sources (Priority Order)</h3>
      <p>When multiple sources provide consent data, the most recent wins:</p>
      <div class="help-capture-states">
        <div class="help-capture-row">
          <strong>1. CMP Full</strong>
          <span class="help-capture-desc">Cookie, window API, or dataLayer push with per-category data (most authoritative)</span>
        </div>
        <div class="help-capture-row">
          <strong>2. CMP Binary</strong>
          <span class="help-capture-desc">Accept/decline lifecycle events (e.g., Cookiebot &ldquo;CookiebotOnAccept&rdquo;)</span>
        </div>
        <div class="help-capture-row">
          <strong>3. Per-request GCS</strong>
          <span class="help-capture-desc">Google Consent Status parameter in the request URL (Google tags only)</span>
        </div>
        <div class="help-capture-row">
          <strong>4. Google Consent Mode</strong>
          <span class="help-capture-desc">consent:default/update from the dataLayer (Google tags only)</span>
        </div>
      </div>
    </div>

    <div class="help-section">
      <h3>Consent Insight Table</h3>
      <p>Click any event with a consent badge to see the <strong>Consent</strong> section in the detail view. The table shows:</p>
      <div class="help-capture-states">
        <div class="help-capture-row">
          <strong>Category</strong>
          <span class="help-capture-desc">Unified category (Analytics, Marketing, Functional)</span>
        </div>
        <div class="help-capture-row">
          <strong>CMP State</strong>
          <span class="help-capture-desc">What the CMP reports (\u2713 granted / \u2717 denied / &mdash;)</span>
        </div>
        <div class="help-capture-row">
          <strong>CMP Category</strong>
          <span class="help-capture-desc">The CMP&rsquo;s own category name (e.g., &ldquo;C0002 (Performance)&rdquo; for OneTrust)</span>
        </div>
        <div class="help-capture-row">
          <strong>GCM columns</strong>
          <span class="help-capture-desc">Google Consent Mode signals (shown for Google tags to compare CMP vs. GCM)</span>
        </div>
      </div>
      <p class="help-hint">The required category row is shown in <strong>bold</strong>. Mismatches between CMP and GCM are highlighted.</p>
    </div>

    <div class="help-section">
      <h3>Assumptions &amp; Limitations</h3>
      <div class="help-capture-states">
        <div class="help-capture-row">
          <strong>Category bundling</strong>
          <span class="help-capture-desc">Some CMPs bundle analytics + functional into one category (e.g., TrustArc, Piwik PRO). Both unified categories map to the same CMP category.</span>
        </div>
        <div class="help-capture-row">
          <strong>Missing categories</strong>
          <span class="help-capture-desc">If a CMP doesn&rsquo;t configure a category (e.g., OneTrust site without C0003), that category shows &ldquo;&mdash;&rdquo; instead of false &ldquo;denied&rdquo;.</span>
        </div>
        <div class="help-capture-row">
          <strong>Custom group IDs</strong>
          <span class="help-capture-desc">OneTrust sites using custom group IDs (non-C-series) are detected but consent state is not parsed.</span>
        </div>
        <div class="help-capture-row">
          <strong>Keyword-match CMPs</strong>
          <span class="help-capture-desc">Didomi, Fides, Ketch, Axeptio use site-configurable category names. We match by keywords (e.g., &ldquo;analytics&rdquo;, &ldquo;marketing&rdquo;), which may not always align perfectly.</span>
        </div>
        <div class="help-capture-row">
          <strong>ad_personalization</strong>
          <span class="help-capture-desc">Google&rsquo;s <code>ad_personalization</code> signal maps to Marketing (it controls remarketing), not a separate personalization category.</span>
        </div>
        <div class="help-capture-row">
          <strong>Infrastructure exempt</strong>
          <span class="help-capture-desc">Tag managers, data layers, and consent platforms are exempt from consent checks. They are infrastructure, not tracking.</span>
        </div>
      </div>
    </div>

    <div class="help-section">
      <h3>Supported CMPs &amp; Category Mapping</h3>
      <p>40+ Consent Management Platforms are detected automatically via cookies, window APIs, and dataLayer events.</p>
      <p>The table below shows CMPs where we can display the CMP&rsquo;s own category names alongside our unified categories. All other CMPs still have full consent validation, with consent state read via cookie parsing, window APIs, or the IAB TCF standard.</p>
      <table class="help-consent-table">
        <thead>
          <tr><th>CMP</th><th>Analytics</th><th>Marketing</th><th>Functional</th></tr>
        </thead>
        <tbody>
          <tr><td>Cookiebot</td><td>statistics</td><td>marketing</td><td>preferences</td></tr>
          <tr><td>OneTrust</td><td>C0002 (Performance)</td><td>C0004 (Targeting)</td><td>C0003 (Functional)</td></tr>
          <tr><td>Cookie Information</td><td>cookie_cat_statistic</td><td>cookie_cat_marketing</td><td>cookie_cat_functional</td></tr>
          <tr><td>CookieYes</td><td>analytics</td><td>advertisement</td><td>functional</td></tr>
          <tr><td>Complianz</td><td>statistics</td><td>marketing</td><td>preferences</td></tr>
          <tr><td>CookieScript</td><td>performance</td><td>targeting</td><td>functionality</td></tr>
          <tr><td>CookieFirst</td><td>performance</td><td>advertising</td><td>functional</td></tr>
          <tr><td>Osano</td><td>ANALYTICS</td><td>MARKETING</td><td>PERSONALIZATION</td></tr>
          <tr><td>iubenda</td><td>Purpose 4</td><td>Purpose 5</td><td>Purpose 2</td></tr>
          <tr><td>Borlabs Cookie</td><td>statistics</td><td>marketing</td><td>external-media</td></tr>
          <tr><td>TrustArc</td><td>Category 2</td><td>Category 3</td><td>Category 2</td></tr>
          <tr><td>Piwik PRO</td><td>analytics</td><td>remarketing</td><td>analytics</td></tr>
          <tr><td>Pandectes</td><td>C0002 (Performance)</td><td>C0003 (Targeting)</td><td>C0001 (Functionality)</td></tr>
          <tr><td>Digital Control Room</td><td>Level 3 (Analytics)</td><td>Level 4 (Advertising)</td><td>Level 2 (Functionality)</td></tr>
          <tr><td>Ethyca Fides</td><td>analytics</td><td>advertising</td><td>functional</td></tr>
          <tr><td>Ketch</td><td>analytics</td><td>behavioral_advertising</td><td>personalization</td></tr>
          <tr><td>Termly</td><td>analytics</td><td>advertising</td><td>essential</td></tr>
          <tr><td>Transcend</td><td>Analytics</td><td>Advertising</td><td>Functional</td></tr>
          <tr><td>Moove GDPR</td><td>thirdparty</td><td>advanced</td><td>preference</td></tr>
          <tr><td>WPLP Cookie Consent</td><td>analytics</td><td>marketing</td><td>preferences</td></tr>
          <tr><td>WebToffee GDPR</td><td>analytics</td><td>advertisement</td><td>functional</td></tr>
          <tr><td>IAB TCF</td><td>Purposes 7,8</td><td>Purposes 2-6</td><td>Purpose 1</td></tr>
          <tr><td>Google Consent Mode</td><td>analytics_storage</td><td>ad_storage</td><td>functionality_storage</td></tr>
        </tbody>
      </table>
      <p class="help-hint">Additional CMPs detected (without per-category mapping): Admiral, Axeptio, Civic Cookie Control, Commanders Act, consentmanager, Cookie Notice, Didomi, Enzuzo, Evidon, InMobi, Klaro, Quantcast Choice, Real Cookie Banner, Secure Privacy, Securiti, Sirdata, Sourcepoint, Tarteaucitron, UniConsent, Usercentrics.</p>
    </div>
  `,

  // Version history is maintained in help-versions.js (loaded before this file)
  get versions() {
    return window.HelpVersions.renderVersionsHTML();
  },

  get about() {
    const version = chrome.runtime.getManifest().version;
    return `
    <div class="help-section help-about-header">
      ${HELP_ICONS.owlLogo}
      <div>
        <h3>Event Watcher</h3>
        <p class="help-version">Version ${version}</p>
      </div>
    </div>
    <div class="help-section help-about-card">
      <h4>Why Event Watcher?</h4>
      <p class="help-about-text">Built because I needed it - and because learning by doing is the best way to learn.<br>After 10+ years of benefiting from the analytics community's tools, it felt right to give something back.<br>Enjoy, and reach out if you have feedback or just want to connect.</p>
      <div class="help-about-divider"></div>
      <div class="help-about-creator">
        <p class="help-creator-name">Rune Andersen</p>
        <p class="help-creator-location">Copenhagen, Denmark</p>
        <p class="help-links">
          <a href="https://www.linkedin.com/in/runeandersendk/" target="_blank" rel="noopener" class="help-link-linkedin">
            ${HELP_ICONS.linkedin}
            LinkedIn
          </a>
          <a href="https://github.com/rune-andersen" target="_blank" rel="noopener" class="help-link-github">
            ${HELP_ICONS.github}
            GitHub
          </a>
          <button type="button" class="help-feedback-btn">
            ${HELP_ICONS.feedback}
            Send Feedback
          </button>
        </p>
      </div>
    </div>
    <div class="help-section help-legal">
      <a href="https://eventwatcher.dev/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a>
    </div>
  `;
  }
};

/**
 * Get help content for a specific tab
 * @param {string} tabId - The tab identifier (overview, getting-started, features, about)
 * @returns {string} HTML content for the tab
 */
function getTabContent(tabId) {
  return HELP_CONTENT[tabId] || '';
}

// Export for use in panel.js
window.HelpContent = {
  HELP_CONTENT,
  HELP_ICONS,
  getTabContent
};
