/**
 * Owl Easter Egg - Tips and Animations
 *
 * Displays helpful tips when clicking the owl logo in the toolbar.
 * Tips rotate randomly and include inline SVG icons.
 */

// Owl animation classes (defined in panel.css)
const OWL_ANIMATIONS = [
  'owl-wink',
  'owl-spin',
  'owl-bow',
  'owl-wiggle',
  'owl-bounce',
  'owl-shake',
  'owl-nod',
  'owl-peek',
  'owl-zoom',
  'owl-float',
  'owl-tilt',
  'owl-blink',
  'owl-swing',
  'owl-hop'
];

// Inline SVG icons for tips (matching the icons used in the tool)
const TIP_ICONS = {
  settings: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></span>',
  grid: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg></span>',
  plus: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg></span>',
  pause: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg></span>',
  stop: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></span>',
  search: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></span>',
  help: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg></span>',
  eye: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></span>',
  layers: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></span>',
  copy: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></span>',
  save: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg></span>',
  nesting: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h4M3 12h8M3 18h4M9 6h12M13 12h8M9 18h12"/></svg></span>',
  sort: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5h10M11 9h7M11 13h4"/><path d="M3 17l3 3 3-3M6 18V4"/></svg></span>',
  clear: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></span>',
  feedback: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>',
  tree: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="15" r="3"/><circle cx="18" cy="18" r="3"/><circle cx="6" cy="9" r="3"/><path d="M6 9c6 0 9 0 9 6"/></svg></span>',
  scripts: '<span class="tip-icon tip-icon-scripts"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>',
  shield: '<span class="tip-icon tip-icon-consent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>',
  chevron: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></span>',
  theme: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg></span>',
  ai: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M19 14l.75 2L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-1z"/><path d="M5 4l.5 1.5L7 6l-1.5.5L5 8l-.5-1.5L3 6l1.5-.5z"/></svg></span>',
  pin: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76V6a3 3 0 0 1 6 0v4.76a2 2 0 0 0 1.11 1.79l1.78.9A2 2 0 0 1 19 15.24V16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-.76a2 2 0 0 1 1.11-1.79l1.78-.9A2 2 0 0 0 9 10.76z"/></svg></span>',
  maximize: '<span class="tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg></span>'
};

// Tips for DevTools panel - displayed when clicking the owl.
//
// Each tip is an object with `html` (the tooltip content) and an optional
// `target` CSS selector. When a tip has a target, the matching toolbar element
// gets the same highlight ring the onboarding tour uses — so users can see
// *where* the tip is about. Overflow-menu fallbacks are listed second in
// arrays so tips still anchor when their primary button is collapsed at
// narrow widths.
//
// Tips without a target (right-click patterns, in-detail-panel features,
// general behaviour descriptions) show as plain tooltips with no highlight.
const OWL_TIPS = [
  { html: `<strong>Right-click</strong> a filter → 'Show only' hides all other platforms` },
  { html: `<strong>Right-click</strong> a filter → 'Highlight' makes events stand out ${TIP_ICONS.layers}` },
  { html: `<strong>DL Nesting</strong> ${TIP_ICONS.nesting} groups GTM tags under their dataLayer triggers`, target: '.nested-toggle' },
  { html: `<strong>Presets</strong> ${TIP_ICONS.save} save your filter setup for quick switching`, target: '#preset-dropdown-btn' },
  { html: `<strong>Right-click</strong> a page → copy all events as Table or JSON ${TIP_ICONS.copy}` },
  { html: `<strong>Right-click</strong> a page → <em>Copy for AI</em> ${TIP_ICONS.copy} keeps GA4, Amplitude &amp; other event properties in the export, sized for AI tool input limits` },
  { html: `<strong>Expand</strong> ${TIP_ICONS.maximize} any JSON section (dataLayer, Raw Request…) to read big payloads in a larger window` },
  { html: `<strong>Copy dataLayer Pushes</strong> ${TIP_ICONS.copy} exports the classic <code>window.dataLayer</code> pushes; <em>Copy Full dataLayer</em> adds the computed state for debugging`, target: ['#export-btn', '#toolbar-overflow-btn'] },
  { html: `<strong>Click any value</strong> in event details to copy it to clipboard` },
  { html: `<strong>Add a comment</strong> to any event via the pencil at the bottom of the Overview card — it travels with your JSON exports` },
  { html: `<strong>Sort</strong> ${TIP_ICONS.sort} events by Start Time, Finish Time, or Capture Index`, target: '#sort-toggle-btn' },
  { html: `<strong>Settings</strong> ${TIP_ICONS.settings} → choose which data layers to detect`, target: '#datalayer-settings', openSettings: true },
  { html: `<strong>Categories</strong> ${TIP_ICONS.grid} shows all 500+ supported platforms`, target: ['#supported-tools-btn', '#toolbar-overflow-btn'] },
  { html: `<strong>Search</strong> ${TIP_ICONS.search} filters events by platform, name, or payload data`, target: '#smart-search-container' },
  { html: `<strong>Unknown events</strong> ${TIP_ICONS.eye} now show the endpoint host they hit — in the stream row and as a filter chip — so you can tell which unrecognised service is firing; the "?" marks it as still-unidentified` },
  { html: `<strong>About this tool</strong> in event details shows detection patterns and docs` },
  { html: `<strong>Detection path</strong> — expand the chevron on the <em>Match</em> row in event details to see how the event was identified, stage by stage` },
  { html: `<strong>Reorder event detail sections</strong> ${TIP_ICONS.layers} by dragging the four-dot handle on the right of any section. Reset under Settings → Look &amp; Feel.` },
  { html: `<strong>Pause</strong> ${TIP_ICONS.pause} freezes capture until next page load`, target: '#capture-btn' },
  { html: `<strong>Stop</strong> ${TIP_ICONS.stop} halts capture completely until you resume`, target: '#capture-btn' },
  { html: `<strong>Feedback</strong> ${TIP_ICONS.feedback} lets you report bugs, request features, flag missing tools, or share general thoughts`, target: ['#report-tool-btn', '#toolbar-overflow-btn'] },
  { html: `<strong>Help</strong> ${TIP_ICONS.help} has guides on all features and shortcuts`, target: ['#help-btn', '#toolbar-overflow-btn'] },
  { html: `<strong>Script view</strong> ${TIP_ICONS.tree} shows all captured scripts in a load hierarchy — great for auditing tag setup`, target: '#view-mode-tree-toggle', requiresScriptTree: true },
  { html: `<strong>Stack</strong> ${TIP_ICONS.layers} shows the site's martech stack — what tools are loaded and how they're wired (page-source vs tag manager vs daisy-chain). Per top-level domain.`, target: '#view-mode-stack-toggle' },
  { html: `<strong>Export the Stack</strong> ${TIP_ICONS.copy} as Markdown, Mermaid, SVG, or <strong>MartechStack Builder JSON</strong> — paste into deliverables, or open the JSON in <a href="https://app.martechstackbuilder.com/" target="_blank" rel="noopener">MartechStack Builder</a> via File → Import JSON`, target: '#view-mode-stack-toggle' },
  { html: `<strong>Script load events</strong> show a dependency tree in the detail panel — see what loaded it and what it triggered` },
  { html: `<strong>Script badges</strong> show how each script was loaded: directly from the page, via a tag manager, or by another script` },
  { html: `<strong>Collapse categories</strong> ${TIP_ICONS.chevron} — use the arrows next to Show/Hide All to collapse or expand all category frames at once` },
  { html: `<strong>Collapse the filter bar</strong> to a single row — click the up-chevron at the left of the filter toolbar`, target: '#filter-toolbar-collapse-btn' },
  { html: `<strong>Scripts filter</strong> ${TIP_ICONS.scripts} has 3 modes: <em>Auto</em> (follow tool visibility), <em>Only</em> (show only scripts), <em>Hide</em> — click to cycle`, target: '#scripts-filter' },
  { html: `<strong>Consent filter</strong> ${TIP_ICONS.shield} has 4 modes: <em>Auto</em> (show violations), <em>Only</em> (all consent), <em>Hide</em>, <em>Off</em> — click to cycle`, target: '#consent-filter', requiresConsentCheck: true },
  { html: `<strong>Tool chips show consent severity</strong> ${TIP_ICONS.shield} — a red or yellow pill next to the count means that tool fired with denied or pre-consent events. The number inside the pill is the violation count. Switch to brand-coloured counts in Settings → Look &amp; Feel → Tool chips.`, requiresConsentCheck: true },
  { html: `<strong>Compact density</strong> ${TIP_ICONS.settings} → Look &amp; Feel → Display density tightens padding on the toolbar, event list, and detail panel — useful on small screens. Font size is unchanged; use browser zoom for that.`, target: '#density-settings', openSettings: true },
  { html: `<strong>Default settings</strong> ${TIP_ICONS.settings} → Defaults section lets you set startup preferences or use "Last used" to remember your session`, target: '#view-mode-default-settings', openSettings: true },
  { html: `<strong>Custom Endpoints</strong> ${TIP_ICONS.plus} in Categories &amp; Tools → map CNAME proxies or internal tools to known platforms, or create your own`, target: ['#supported-tools-btn', '#toolbar-overflow-btn'] },
  { html: `<strong>Consent Check</strong> ${TIP_ICONS.shield} detects your CMP and shows consent state for each event — granted, denied, or pre-consent`, requiresConsentCheck: true },
  { html: `<strong>Consent badges</strong> ${TIP_ICONS.shield} in the event list show if each tracking request has consent — green for granted, red for denied, yellow for pre-consent`, requiresConsentCheck: true },
  { html: `A <strong>yellow shield</strong> ${TIP_ICONS.shield} on a granted event means the CMP and Google Consent Mode disagree on that category — the event is allowed, but Google tags may run degraded until consent updates propagate`, requiresConsentCheck: true },
  { html: `<strong>Consent Insight Table</strong> maps CMP categories to unified Analytics, Marketing, and Functional — see it in the event detail ${TIP_ICONS.shield}`, requiresConsentCheck: true },
  { html: `<strong>40+ CMPs detected</strong> automatically — Cookiebot, OneTrust, Cookie Information, CookieYes, Didomi, and more ${TIP_ICONS.shield}`, requiresConsentCheck: true },
  { html: `<strong>GTM Hub</strong> shows container intelligence — tag counts, event names, script dependencies, and rule management in one place`, target: ['#gtm-btn', '#toolbar-overflow-btn'], requiresGTM: true },
  { html: `<strong>GTM Intercept</strong> lets you block, swap, or preview GTM containers — rules default to DevTools-only so they won't affect production`, target: ['#gtm-btn', '#toolbar-overflow-btn'], requiresGTM: true },
  { html: `<strong>GTM Health Ping</strong> is Google's <code>&amp;gtg_health=1</code> follow-up library request — captured as its own Tag Manager tool so it doesn't masquerade as a duplicate GTM Load`, requiresGTM: true },
  { html: `<strong>Smart Search</strong> ${TIP_ICONS.search} understands keywords — try "ga4 purchase", "failed", "consent", or "scripts" to filter instantly`, target: '#smart-search-container' },
  { html: `<strong>Cookie badges</strong> appear on events that set cookies — click to see names, expiry, and ePrivacy compliance`, requiresCookieDetection: true },
  { html: `<strong>Cookie Direction badges</strong> ${TIP_ICONS.eye} — the Cookies section in the event detail tags each row <em>Set</em>, <em>Sent</em>, or <em>Set &amp; Sent</em>, so you can see exactly which cookies the browser attached vs which the response wrote.` },
  { html: `<strong>Push Again</strong> replays a dataLayer event with one click — or use <em>Edit &amp; Push</em> to modify the payload first` },
  { html: `<strong>Interaction events</strong> show clicks and form changes as timeline markers — see what the user did before each tracking event`, target: '#interactions-filter' },
  { html: `<strong>Grouped view</strong> ${TIP_ICONS.grid} pins your favourite groupings as chips — Tool and Page by default — click between them to slice the same events different ways`, target: '#view-mode-grouped-toggle' },
  { html: `<strong>The <em>+</em> chip</strong> ${TIP_ICONS.plus} in Grouped view opens a picker — pin the pivots you use, drag pinned rows to reorder the chip row, unpin from the same place`, target: '#grouped-picker-btn' },
  { html: `<strong>Datalayer view</strong> ${TIP_ICONS.layers} groups dataLayer pushes by where they came from — your site, a tag manager (GTM, Tealium, Adobe Tags, …), or a third-party script. Pin it from the <em>+</em> picker.`, target: '#grouped-picker-btn' },
  { html: `<strong>Endpoint view</strong> ${TIP_ICONS.layers} groups requests by destination host — first-party (your domains, including server-side / CNAME collectors) vs third-party. Pin it from the <em>+</em> picker.`, target: '#grouped-picker-btn' },
  { html: `<strong>Cookie view</strong> ${TIP_ICONS.layers} groups events that write cookies — first-party vs third-party, then by cookie name (<em>_ga</em>, <em>OptanonConsent</em>, <em>_fbp</em>, …). Pin it from the <em>+</em> picker.`, target: '#grouped-picker-btn', requiresCookieDetection: true },
  { html: `<strong>Identity view</strong> ${TIP_ICONS.layers} groups events by identifier kind (<em>Client ID</em>, <em>User ID</em>, <em>ECID</em>, …) and value — if an identifier shows 2+ value buckets, it changed mid-session.`, target: '#grouped-picker-btn' },
  { html: `<strong>Right-click any group header</strong> ${TIP_ICONS.copy} in Grouped view to copy that group's events — Tool, Domain, Event Name, Consent Category all share the same menu` },
  { html: `<strong>Start AI Chat for any group</strong> ${TIP_ICONS.ai} — right-click a Tool / Domain / Event Name / Consent Category header and the chat opens scoped to just that slice`, requiresAI: true },
  { html: `<strong>ASSUMED badge</strong> identifies unknown events by their payload structure — confirm or dismiss the suggestion in event details` },
  { html: `<strong>Stape Data Tag</strong> detected automatically — server-side GTM events on <em>*.stape.io</em> or sent through Stape's Data Tag template show as their own tool, with a <em>via Stape</em> tag on related GTM, sGTM, Facebook Pixel and Meta CAPI events` },
  { html: `<strong>Consent markers</strong> ${TIP_ICONS.shield} appear in the stream when consent state changes — green chips for granted, red for denied`, requiresConsentCheck: true },
  { html: `<strong>Correlation windows</strong> ${TIP_ICONS.settings} → adjust how long to wait for GTM tags after a dataLayer push`, target: '#setting-correlation-standard', openSettings: true },
  { html: `<strong>Light/dark theme</strong> ${TIP_ICONS.theme} — click the sun/moon in the toolbar to flip, or pick System/Light/Dark in Settings → Appearance`, target: ['#theme-toggle-btn', '#toolbar-overflow-btn'] },
  { html: `<strong>The toolbar adapts</strong> to the panel width — labels collapse, ${TIP_ICONS.search} becomes a click-to-expand icon, and the rest tuck into a ⋯ menu` },
  { html: `<strong>Want the tour again?</strong> Settings ${TIP_ICONS.settings} → Defaults → Help → <em>Replay tour</em>`, target: '#setting-replay-onboarding', openSettings: true },
  { html: `<strong>Missed the latest update tour?</strong> Settings ${TIP_ICONS.settings} → Defaults → Help → <em>What's new tour</em> — replay the highlights of the current release`, target: '#setting-replay-whats-new-tour', openSettings: true },
  { html: `<strong>AI Summary</strong> ${TIP_ICONS.ai} in event details turns a raw payload into a 2–4 sentence plain-English explanation — bring your own AI key, free Gemini tier works`, target: ['#ai-btn', '#toolbar-overflow-btn'], requiresAI: true },
  { html: `<strong>Unknown event?</strong> ${TIP_ICONS.ai} The same section becomes <em>AI Identification</em> — one click asks your AI to name the vendor. Opt in to <em>Auto-identify</em> in AI Provider settings to skip the click.`, target: ['#ai-btn', '#toolbar-overflow-btn'], requiresAI: true },
  { html: `<strong>DataLayer pushes</strong> ${TIP_ICONS.ai} get their own AI tasks — <em>Explain This Push</em>, <em>Evaluate Quality &amp; Consistency</em>, <em>Check Best Practices</em>, <em>Suggest Improvements</em>, plus an "Ask anything…" box for free-form questions`, target: ['#ai-btn', '#toolbar-overflow-btn'], requiresAI: true },
  { html: `<strong>Page events</strong> ${TIP_ICONS.ai} get their own AI tasks — <em>Summarise Page</em>, <em>QA Tracking</em>, <em>Check Consent Flow</em>, <em>Find Gaps</em>. Right-click any page in the stream → <em>Start AI Chat for Page</em> to open a scoped chat`, requiresAI: true },
  { html: `<strong>AI Session Chat</strong> ${TIP_ICONS.ai} lives behind the Export button too — click Export → <em>Start AI Session Chat</em> to ask questions across the whole captured session`, target: ['#export-btn', '#toolbar-overflow-btn'], requiresAI: true },
  { html: `<strong>Not using a feature?</strong> Settings ${TIP_ICONS.settings} → Features lets you hide AI, GTM Hub, Script view, Cookie detection, or Consent Check — tailor the panel to what you actually use`, target: '#features-settings', openSettings: true },
  { html: `<strong>Pinned</strong> ${TIP_ICONS.pin} — hover any event in Stream and click the pushpin to save it. Pinned events live per domain and survive Clear and reloads. Open the Pinned view to see them all.`, target: '#view-mode-pinned-toggle' }
];

/**
 * Returns the indices of OWL_TIPS that are eligible to show right now.
 * Tips tied to a feature that the user has disabled in Settings → Features
 * are filtered out. Each opt-out is signaled by a `body.<feature>-disabled`
 * class set by settings.js.
 */
function getEligibleTipIndices() {
  const body = typeof document !== 'undefined' ? document.body : null;
  const aiDisabled = body?.classList?.contains('ai-features-disabled');
  const gtmDisabled = body?.classList?.contains('gtm-hub-disabled');
  const scriptTreeDisabled = body?.classList?.contains('script-tree-disabled');
  const cookieDetectionDisabled = body?.classList?.contains('cookie-detection-disabled');
  const consentCheckDisabled = body?.classList?.contains('consent-check-disabled');
  const indices = [];
  for (let i = 0; i < OWL_TIPS.length; i++) {
    const tip = OWL_TIPS[i];
    if (aiDisabled && tip.requiresAI) continue;
    if (gtmDisabled && tip.requiresGTM) continue;
    if (scriptTreeDisabled && tip.requiresScriptTree) continue;
    if (cookieDetectionDisabled && tip.requiresCookieDetection) continue;
    if (consentCheckDisabled && tip.requiresConsentCheck) continue;
    indices.push(i);
  }
  return indices;
}

// State for tracking last shown tip/animation to avoid repetition
let lastOwlTipIndex = -1;
let lastOwlAnimationIndex = -1;
let owlTooltipEl = null;
let owlTooltipHideTimeout = null;
let isHoveringOwlLogo = false;
let isHoveringOwlTooltip = false;
// Element currently getting the highlight ring while an anchored tip is
// visible. Tracked so we can clean up on hide or when a new tip replaces it.
let owlHighlightedEl = null;
// Integration hooks installed by panel.js so settings-specific tips can open
// the Settings modal and highlight an item inside it. Owl-tips loads as a
// classic script and can't import panel functions directly.
let configuredHooks = null;

/**
 * Get a random tip, avoiding the previously shown one.
 * Returns { html, index } — html for the tooltip, index for analytics.
 */
function getRandomOwlTip() {
  const eligible = getEligibleTipIndices();
  if (eligible.length === 0) return { html: '', index: -1 };
  let index;
  do {
    index = eligible[Math.floor(Math.random() * eligible.length)];
  } while (index === lastOwlTipIndex && eligible.length > 1);
  lastOwlTipIndex = index;
  return { html: OWL_TIPS[index].html, index };
}

/**
 * Get a random animation class, avoiding the previously used one
 */
function getRandomOwlAnimation() {
  let index;
  do {
    index = Math.floor(Math.random() * OWL_ANIMATIONS.length);
  } while (index === lastOwlAnimationIndex && OWL_ANIMATIONS.length > 1);
  lastOwlAnimationIndex = index;
  return OWL_ANIMATIONS[index];
}

/**
 * Resolve the first visible element from a selector or selector list.
 * Used for anchored tips with overflow-menu fallbacks at narrow widths.
 */
function resolveOwlTipTarget(target) {
  if (!target) return null;
  const selectors = Array.isArray(target) ? target : [target];
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (!el || !el.isConnected) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    return el;
  }
  return null;
}

/**
 * Apply the tour's highlight ring to the given element (if any) and remember
 * it so we can clean up later. Reuses `.onboarding-target-highlight` from
 * panel.css for visual consistency with the onboarding tour.
 */
function highlightOwlTipTarget(el) {
  clearOwlTipHighlight();
  if (!el) return;
  el.classList.add('onboarding-target-highlight');
  owlHighlightedEl = el;
}

function clearOwlTipHighlight() {
  if (owlHighlightedEl) {
    owlHighlightedEl.classList.remove('onboarding-target-highlight');
    owlHighlightedEl = null;
  }
}

/**
 * Hide the tooltip if not hovering on owl or tooltip
 */
function hideOwlTooltip() {
  if (!isHoveringOwlLogo && !isHoveringOwlTooltip && owlTooltipEl) {
    owlTooltipEl.classList.remove('visible');
    clearOwlTipHighlight();
  }
}

/**
 * Schedule tooltip hide with a delay
 */
function scheduleHideOwlTooltip() {
  if (owlTooltipHideTimeout) {
    clearTimeout(owlTooltipHideTimeout);
  }
  owlTooltipHideTimeout = setTimeout(hideOwlTooltip, 300);
}

/**
 * Show the tooltip with tip content positioned below the owl
 */
function showOwlTipTooltip(owlElement, tipHtml) {
  // Clear any pending hide
  if (owlTooltipHideTimeout) {
    clearTimeout(owlTooltipHideTimeout);
    owlTooltipHideTimeout = null;
  }

  if (!owlTooltipEl) {
    owlTooltipEl = document.createElement('div');
    owlTooltipEl.className = 'owl-tip-tooltip';
    document.body.appendChild(owlTooltipEl);

    // Keep tooltip visible while hovering on it
    owlTooltipEl.addEventListener('mouseenter', () => {
      isHoveringOwlTooltip = true;
      if (owlTooltipHideTimeout) {
        clearTimeout(owlTooltipHideTimeout);
        owlTooltipHideTimeout = null;
      }
    });

    owlTooltipEl.addEventListener('mouseleave', () => {
      isHoveringOwlTooltip = false;
      scheduleHideOwlTooltip();
    });
  }

  owlTooltipEl.innerHTML = tipHtml;

  const rect = owlElement.getBoundingClientRect();
  owlTooltipEl.style.left = `${rect.left}px`;
  owlTooltipEl.style.top = `${rect.bottom + 8}px`;

  owlTooltipEl.classList.add('visible');

  // Apply anchor highlight — toolbar tips resolve immediately, settings tips
  // open the Settings modal first, then expand/scroll/highlight inside it.
  applyTipAnchor(tipLookupByHtml(tipHtml));
}

// Look up the full tip object from the html string (identity compare on the
// `html` field). Keeps showOwlTipTooltip's existing signature stable while
// letting us read `target` + `openSettings` per tip.
function tipLookupByHtml(tipHtml) {
  for (const tip of OWL_TIPS) {
    if (tip.html === tipHtml) return tip;
  }
  return null;
}

/**
 * Apply the highlight ring for an owl tip. Handles two cases:
 *
 * 1. Toolbar tip (no openSettings) — resolve the selector, highlight directly.
 * 2. Settings tip (openSettings: true) — open the Settings modal via the hook
 *    registered by panel.js, then after a small delay (modal render) expand
 *    the matching <details> section, scroll the target into view, and highlight.
 *
 * Tips with no `target` at all show as plain tooltips with no highlight.
 */
function applyTipAnchor(tip) {
  if (!tip) { clearOwlTipHighlight(); return; }

  if (tip.openSettings && configuredHooks && typeof configuredHooks.openSettings === 'function') {
    // If the settings modal isn't already open, open it. Idempotent check lets
    // users who had it open manually keep their scroll position etc.
    const panel = document.getElementById('settings-panel');
    if (!panel || !panel.classList.contains('open')) {
      try { configuredHooks.openSettings(); } catch (_) { /* non-critical */ }
    }
    // Wait one paint so the modal has rendered and <details> sizes resolve
    // before we measure the target.
    setTimeout(() => highlightSettingsTarget(tip.target), 60);
    return;
  }

  highlightOwlTipTarget(resolveOwlTipTarget(tip.target));
}

/**
 * Highlight a selector inside the Settings modal — opens any ancestor
 * <details> so the row is visible, scrolls it into view, applies the ring.
 */
function highlightSettingsTarget(selector) {
  if (!selector) return;
  const el = document.querySelector(Array.isArray(selector) ? selector[0] : selector);
  if (!el || !el.isConnected) return;

  // Expand any closed <details> ancestors so the element is visible.
  let parent = el.parentElement;
  while (parent) {
    if (parent.tagName === 'DETAILS' && !parent.open) parent.open = true;
    parent = parent.parentElement;
  }

  try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) { /* older browsers */ }
  highlightOwlTipTarget(el);
}

/**
 * Register integration hooks. Panel.js calls this once at init so
 * settings-specific owl tips can open the Settings modal through the same
 * path the onboarding tour uses.
 */
function configureHooks(hooks) {
  configuredHooks = hooks || {};
}

/**
 * Extract plain text from tip HTML for analytics
 */
function getOwlTipPlainText(tipHtml) {
  const temp = document.createElement('div');
  temp.innerHTML = tipHtml;
  return temp.textContent || temp.innerText || '';
}

/**
 * Trigger the owl easter egg animation and tip display
 * @param {Function} trackEventFn - Optional analytics tracking function
 */
function triggerOwlEasterEgg(trackEventFn) {
  const owl = document.getElementById('owlLogo');
  if (!owl) return;

  // Remove any existing animation classes
  OWL_ANIMATIONS.forEach(anim => owl.classList.remove(anim));
  void owl.offsetWidth; // Force reflow

  const animation = getRandomOwlAnimation();
  const { html: tipHtml, index: tipIndex } = getRandomOwlTip();

  owl.classList.add(animation);
  showOwlTipTooltip(owl, tipHtml);

  // Track if analytics function provided
  if (typeof trackEventFn === 'function') {
    trackEventFn('owl_click', {
      animation: animation.replace('owl-', ''),
      tip_index: tipIndex
    });
  }

  setTimeout(() => {
    owl.classList.remove(animation);
  }, 700);
}

/**
 * Initialize owl easter egg event listeners
 * @param {Function} trackEventFn - Optional analytics tracking function
 */
function initOwlEasterEgg(trackEventFn) {
  const owlLogoEl = document.getElementById('owlLogo');
  if (!owlLogoEl) return;

  owlLogoEl.addEventListener('click', () => triggerOwlEasterEgg(trackEventFn));

  // Track hover state on owl to keep tooltip visible
  owlLogoEl.addEventListener('mouseenter', () => {
    isHoveringOwlLogo = true;
    if (owlTooltipHideTimeout) {
      clearTimeout(owlTooltipHideTimeout);
      owlTooltipHideTimeout = null;
    }
  });

  owlLogoEl.addEventListener('mouseleave', () => {
    isHoveringOwlLogo = false;
    scheduleHideOwlTooltip();
  });
}

/**
 * Animate the owl without showing a tip tooltip.
 * Used by the first-run onboarding wiggle (Phase 0) to draw attention
 * to the owl without the full tooltip, which would be noisy on first load.
 * @param {string} animationClass - e.g. 'owl-wiggle', 'owl-bounce'
 */
function animateOwl(animationClass) {
  const owl = document.getElementById('owlLogo');
  if (!owl) return;
  OWL_ANIMATIONS.forEach(anim => owl.classList.remove(anim));
  void owl.offsetWidth; // Force reflow
  owl.classList.add(animationClass);
  setTimeout(() => owl.classList.remove(animationClass), 700);
}

// Exposed via window because this is loaded as a non-module script
window.OwlTips = {
  init: initOwlEasterEgg,
  trigger: triggerOwlEasterEgg,
  animate: animateOwl,
  configureHooks,
  OWL_TIPS,
  OWL_ANIMATIONS
};
