/**
 * Help Panel - Version History
 *
 * Version changelog entries for the Versions tab.
 * Separated from help-content.js since this grows with each release.
 *
 * To add a new version:
 * 1. Add a new entry at the TOP of the VERSIONS array (latest version first)
 * 2. Each entry needs: version, label, and sections[]
 * 3. From v1.4.0 onward, group work by KIND, not by surface. Use a single
 *    category-only section whose categories are New / Improvements / Fixes /
 *    Tools (omit any category with no items for that release):
 *        sections: [{ categories: [
 *          { title: 'New',          items: [...] },
 *          { title: 'Improvements', items: [...] },
 *          { title: 'Fixes',        items: [...] },
 *          { title: 'Tools',        items: [...] }  // new + extended tool support
 *        ] }]
 *    A reader opening "What's New" cares what KIND of change shipped, not which
 *    surface it touched — the DevTools/Shared/Side Panel split was noise. The
 *    matching What's New bubble (whats-new.js) uses the same four buckets.
 *
 *    A category's `intro` is optional HTML (prose paragraphs) rendered above the bullet list.
 *    `items` is optional — a category can be prose-only.
 *
 * Legacy section shapes (used by pre-v1.4.0 entries below — do NOT use for new entries):
 *    - Group work by surface with sub-categories:
 *        { surface: 'devtools', categories: [{ title, intro?, items? }] }
 *    - Be a flat list under a surface (Shared, Side Panel):
 *        { surface: 'shared', items: [...] }
 *
 * Legacy surfaces (still rendered for historic entries):
 *   - `devtools`  — DevTools panel work
 *   - `shared`    — work that affects both DevTools and the Side Panel (dark mode, CMP support, etc.)
 *   - `sidepanel` — Side Panel only
 *   - `platforms` — newly supported tracking platforms; renders as "New Supported Platforms".
 *                   Use a flat `items: []` list grouped by category, e.g.
 *                     '<strong>Ad Tech</strong> &mdash; Vendor A, Vendor B'
 *
 * Editorial guidelines:
 *   - List only user-facing changes (new features, bug fixes, new tools).
 *   - Skip internal/cosmetic work (icon backfills, design-token parity, accessibility internals).
 *   - Keep items concise — bold headline + one short clause is usually enough.
 *   - Group new tools by category, not one item per tool.
 *
 * Rendering:
 *   - The latest version (index 0) is expanded by default.
 *   - All older versions are collapsed and expand on click via native <details>.
 */

const VERSIONS = [
  {
    version: '1.4.2',
    label: 'Consent Detection & New Tools',
    sections: [
      {
        categories: [
          {
            title: 'Fixes',
            items: [
              '<strong>Usercentrics now recognised on EU-region setups</strong> &mdash; sites running Usercentrics in EU Mode showed no consent platform at all. Every current Usercentrics setup is now detected, including the moment a visitor&rsquo;s choice is saved and the pre-consent tag blocker.',
              '<strong>OneTrust now recognised on regional data centres</strong> &mdash; banners served from OneTrust&rsquo;s UK, Asia-Pacific or Australian data centre showed no consent platform. All three regions are now detected, along with any region OneTrust adds later.'
            ]
          },
          {
            title: 'Tools',
            items: [
              '<strong>13 newly supported tools</strong> &mdash; added across Analytics, Marketing Automation, Widgets, A/B testing, session replay, CDPs, and more, so more of what a site runs is recognised out of the box.',
              '<strong>Wider coverage of tools you already track</strong> &mdash; new endpoints added to platforms already supported (Tolstoy, Attentive, and others), whose actual tracking data was showing as Unknown while only their loading script was recognised.'
            ]
          }
        ]
      }
    ]
  },
  {
    version: '1.4.1',
    label: 'Broader Tool Coverage',
    sections: [
      {
        categories: [
          {
            title: 'Tools',
            items: [
              '<strong>Over 60 newly supported tools</strong> &mdash; a broad coverage expansion across Analytics, Advertising, Ad Tech, Marketing Automation, CDPs, Widgets, and more, so more of what a site runs is recognised out of the box.',
              '<strong>Wider coverage of tools you already track</strong> &mdash; new endpoints and subdomains added to platforms already supported (HubSpot, Hotjar, and others), so more of their traffic is recognised instead of showing as Unknown.'
            ]
          },
          {
            title: 'Fixes',
            items: [
              '<strong>Fewer false positives</strong> &mdash; a handful of over-broad detection rules were tightened so unrelated sites, and vendors&rsquo; own dashboards, are no longer mislabelled as tracking.'
            ]
          }
        ]
      }
    ]
  },
  {
    version: '1.4.0',
    label: 'Clarity & Consistency',
    sections: [
      {
        categories: [
          {
            title: 'New',
            items: [
              '<strong>Data layer detail views</strong> &mdash; Tealium <code>utag_data</code> and Adobe Client Data Layer now open in dedicated data-layer views (the data set, plus full current state), matching Google&rsquo;s.',
              '<strong>Easier-to-read JSON</strong> &mdash; clearer dataLayer and JSON sections (bigger expand arrows, indent guides, row highlighting, click-anywhere-to-collapse), and open any section in a larger window for big payloads.'
            ]
          },
          {
            title: 'Improvements',
            items: [
              '<strong>Self-describing Unknown events</strong> &mdash; unrecognised requests now show their endpoint host (e.g. telemetry.example.com) in the stream and as a filter chip, so you can tell what&rsquo;s firing at a glance.',
              '<strong>Copy dataLayer Pushes</strong> &mdash; a lighter export of just what the site pushed to window.dataLayer (Copy Full dataLayer still adds computed state for GTM debugging).',
              '<strong>Steadier long sessions</strong> &mdash; lighter on memory, with a more accurate consent counter throughout.',
              '<strong>Consistent AI privacy</strong> &mdash; privacy scrubbing now covers the whole AI chat, not just the first question.',
              '<strong>Consistent, current tool names</strong> &mdash; every tool reads the same in the stream and its filter chip, and Adobe, Google and other vendors now use their current official product names under consistent logos.',
              '<strong>Sharper detection</strong> &mdash; fewer false positives, and fuller consent-platform coverage.',
              '<strong>Smoother &amp; steadier</strong> &mdash; handles complex captured data more gracefully, plus quality and stability work under the hood.',
              '<strong>Steadier side panel</strong> &mdash; copes gracefully with unusual tracking URLs.'
            ]
          },
          {
            title: 'Fixes',
            items: [
              '<strong>Truer computed dataLayer</strong> &mdash; a re-pushed array value now shows as merged the way GTM keeps it, not replaced.'
            ]
          },
          {
            title: 'Tools',
            items: [
              '<strong>Adobe Web SDK (Alloy) recognised</strong> &mdash; first-party (proxied) Adobe Experience Platform traffic now decodes into its full readable breakdown instead of a generic &ldquo;1st Party Proxy&rdquo; row.',
              '<strong>Readable PostHog events</strong> &mdash; gzip-compressed PostHog captures now decode to their event name and properties instead of an unreadable row. Thanks to Stipe L. via the in-app Submit a Feature form.'
            ]
          }
        ]
      }
    ]
  },
  {
    version: '1.3.2',
    label: 'Performance & Detection Fixes',
    sections: [
      {
        surface: 'devtools',
        categories: [
          {
            title: 'New',
            items: [
              '<strong>Detection Path reads as a decision tree</strong> &mdash; a stage-by-stage summary that names the winning check, with the full check list one click away.'
            ]
          },
          {
            title: 'Improvements',
            items: [
              '<strong>Faster panel</strong> &mdash; less repeated work during capture and rendering; very long sessions now cap at the newest 10,000 events (pinned events are never trimmed).',
              '<strong>Custom Endpoints uncapped</strong> &mdash; the 5-endpoint limit is gone; match by domain, path, or both.',
              '<strong>Consent Mode context for non-Google tags</strong> &mdash; the consent table now shows the site&rsquo;s Google Consent Mode state next to non-Google tags as information, never a violation.'
            ]
          }
        ]
      },
      {
        surface: 'shared',
        items: [
          '<strong>Braze</strong> &mdash; US data endpoint now detected, with a new parser that decodes Braze events into readable sections.',
          '<strong>Didomi</strong> &mdash; consent categories now read from the dataLayer push, clearing false violation warnings after accept.',
          '<strong>walkerOS</strong> &mdash; self-hosted deployments now detected by their event shape.',
          '<strong>InMobi CMP</strong> &mdash; consent pushes no longer mislabelled as Cookie Information.'
        ]
      },
      {
        surface: 'platforms',
        items: [
          '<strong>Ad Tech</strong> &mdash; Lunio (click-fraud / invalid-traffic protection)',
          '<strong>Marketing Automation</strong> &mdash; RevenueHero (B2B lead routing &amp; scheduling)'
        ]
      }
    ]
  },
  {
    version: '1.3.1',
    label: 'Hotfix',
    sections: [
      {
        surface: 'devtools',
        categories: [
          {
            title: 'Fixes',
            items: [
              '<strong>Right-click menu near the screen edge</strong> &mdash; context menus on the last event in the stream no longer clip their bottom options (Copy Complete, etc.); every menu now measures its real height and stays fully on screen.',
              '<strong>Pinned view sort</strong> &mdash; the sort button now names the order you&rsquo;re actually looking at (was off by one), cycles Start / Finish / Index / Pinned with the Stream view&rsquo;s accent colours, and a new <em>Sort order</em> toggle flips the direction. Defaults to Index oldest-first.'
            ]
          }
        ]
      },
      {
        surface: 'shared',
        items: [
          '<strong>Reverse-proxied GTM containers</strong> &mdash; a first-party GTM loader served from the site&rsquo;s own domain (not googletagmanager.com) is now labelled <em>Google Tag Manager</em> instead of <em>Unknown</em>, read from the <code>?id=GTM-&hellip;</code> container ID.',
          '<strong>Google first-party mode</strong> &mdash; Google Ads Remarketing (<code>/rmkt/collect</code>) and Floodlight (<code>/gmp/conversion</code>) are now recognised on the first-party-mode transports instead of showing as Unknown.',
          '<strong>Matomo consent false-positive</strong> &mdash; non-Google tools (Matomo, Amplitude, Mixpanel, Adobe&hellip;) are no longer flagged as consent violations just because a site denies Google&rsquo;s analytics signal. Google&rsquo;s signal now only judges the platforms that obey it.',
          '<strong>CookieHub</strong> consent platform now detected &mdash; loader, stored consent choices, category mapping, and dataLayer consent events.'
        ]
      }
    ]
  },
  {
    version: '1.3.0',
    label: 'New views: Pinned & Stack',
    sections: [
      {
        surface: 'devtools',
        categories: [
          {
            title: 'New &mdash; Pinned view',
            intro: '<p>A persistent parking spot for events &mdash; pin anything you want to keep around and it survives <strong>Clear</strong> and inspected-page reloads.</p>',
            items: [
              '<strong>Pinned view mode</strong> &mdash; new toolbar button next to Stack. Shows the per-domain pinned list.',
              '<strong>Pin from Stream</strong> &mdash; hover any event row in Stream view and click the pushpin to save it. The pin sticks until you remove it.',
              '<strong>Per-domain</strong> &mdash; pins are scoped to the registrable domain you captured them on, so different sites don&rsquo;t mix.',
              '<strong>Survives Clear and reloads</strong> &mdash; no more export round-trip just to revisit a handful of events.'
            ]
          },
          {
            title: 'New &mdash; Stack view',
            intro: '<p>A martech-stack tree for the current site. Answers &ldquo;<em>what does this site use, and how is it wired together?</em>&rdquo; in one glance &mdash; tools as nodes, parent/child by who-loaded-whom.</p>',
            items: [
              '<strong>Stack view mode</strong> &mdash; new toolbar button next to Script. Each node is a <strong>platform</strong> (not a script), so GTM loading three GA4 scripts shows GA4 once.',
              '<strong>Per top-level domain</strong> &mdash; switching tabs to a different site repaints the stack.',
              '<strong>Tool detail panel</strong> in the right pane &mdash; Overview, About Tool, Stack position, Session activity, Consent context, Quick actions.',
              '<strong>Attribution dot</strong> on each card &mdash; green / yellow / grey shows how confident the attribution is. The detail panel&rsquo;s <em>Why this attribution</em> section explains in plain English which signal placed the tool where it sits.',
              '<strong>Loader-config awareness</strong> &mdash; Tealium loader.cfg, GTM tag-execution telemetry, and CDP destination configs (Segment, RudderStack, Hightouch, mParticle, Adobe AEP Web SDK, Adobe Launch) feed an authoritative parent index that wins over heuristic chain-walking.',
              '<strong>Three exports per domain</strong> &mdash; Markdown bullet tree, Mermaid <code>flowchart LR</code>, and SVG snapshot.'
            ]
          },
          {
            title: 'New &mdash; Multi-select in Stream',
            items: [
              '<strong>Shift-click</strong> in Stream view selects the visible range between the anchor row and the clicked row.',
              '<strong>Ctrl/Cmd-click</strong> toggles a single row&rsquo;s membership in the selection without affecting the rest.',
              '<strong>Bulk pin</strong> &mdash; with 2+ rows selected, the in-row pushpin pins the whole selection in one gesture (already-pinned events stay pinned).',
              '<strong>Bulk Copy</strong> &mdash; right-click a row that&rsquo;s part of the selection to copy every selected event as Table / JSON for Human / JSON for AI / JSON Complete in one go.',
              '<strong>Esc</strong> clears the selection.'
            ]
          },
          {
            title: 'New &mdash; Look &amp; Feel',
            items: [
              '<strong>Consent violations on tool chips</strong> &mdash; the count badge on each filter-toolbar chip now reads as neutral metadata (grey fill, thin brand-coloured border). When a tool fired with denied or pre-consent events, a small <strong>red or yellow pill</strong> appears next to the count showing the actual violation count. So you can see <em>which</em> tool is the offender at a glance, not just <em>that</em> a violation exists somewhere in the session.',
              '<strong>Settings &rarr; Look &amp; Feel &rarr; Tool chips &rarr; Count chip</strong> &mdash; new toggle. <em>Consent status</em> (default) shows the new severity pill; <em>Brand colour</em> reverts to the v1.2.0 brand-coloured count badge with no severity overlay.',
              '<strong>Settings &rarr; Look &amp; Feel &rarr; Display density</strong> &mdash; new <em>Density</em> toggle (<em>Comfortable</em> default, <em>Compact</em>). Compact reduces padding on the toolbar, event list rows, and detail panel cards/sections so more fits on screen. Font size is unchanged &mdash; use browser zoom (Ctrl/Cmd +/-) for that.'
            ]
          },
          {
            title: 'New &mdash; Export menu overhaul',
            intro: '<p>Three-tier JSON export model with self-describing metadata for the AI tool you paste into. Same five formats wherever you copy events &mdash; toolbar Export button, right-click on a page, right-click on a group header.</p>',
            items: [
              '<strong>Copy for Human</strong> &mdash; the readable JSON export. Pretty-printed, uncapped, with curated parser sections (Custom Data, Consent Mode, E-Commerce, Event Properties, dataLayer Push). Skips diagnostic dumps so the export reads cleanly.',
              '<strong>Copy for AI</strong> &mdash; sparse-object schema (v4) tuned for AI tool input limits. Compact single-letter keys, top-level <code>_consent_default</code> dedup, structured truncation, run-folding for repeated events. Use this when pasting into Claude / ChatGPT / Gemini for QA.',
              '<strong>Copy Complete</strong> &mdash; everything: raw HTTP request data, consent state timeline, full per-event consent change tracking, all diagnostic sections. The full readable view of every captured event.',
              '<strong>Copy Full dataLayer</strong> &mdash; only classic window.dataLayer pushes plus the computed state after each push. For GTM debugging or to reproduce dataLayer state.',
              '<strong>Copy Consent</strong> (single events) &mdash; diagnostic JSON for that one event&rsquo;s consent state, including the CMP / Google Consent Mode comparison.',
              '<strong>Compare formats</strong> at the bottom of every export menu &mdash; one-click side-by-side description of all five formats with the current AI tool target shown.',
              '<strong>AI tool target</strong> in Settings &rarr; Export &amp; Debug &mdash; pick Strict / Standard / Relaxed / Generous / Off (replaces the binary <em>Large export warning</em> toggle). Each choice maps to a paste-size threshold matching ChatGPT Free / Plus / Claude / Claude Enterprise. Recorded in <code>_export.targetTool</code> so a downstream AI agent can self-calibrate.',
              '<strong>Multi-select &amp; single-event copy</strong> aligned to the same vocabulary &mdash; <em>Copy as JSON</em> &rarr; <em>Copy for Human</em>, <em>Copy as Full JSON</em> &rarr; <em>Copy Complete</em>, plus <em>Copy for AI</em> on every row.',
              '<strong>Tealium Collect events split</strong> in exports &mdash; the actual tracked payload stays in <em>Event Data</em>; Tealium&rsquo;s session-storage passthroughs (<code>ss.*</code> Adobe perf log, BellMetric blob, Snapchat tokens) move to a diagnostic <em>Session State</em> section that only appears in <em>Copy Complete</em>.'
            ]
          },
          {
            title: 'New: MartechStack Builder export',
            intro: '<p>A spec-compliant JSON export that drops your captured stack straight into <a href="https://app.martechstackbuilder.com/" target="_blank" rel="noopener">MartechStack Builder</a> via <strong>File &rarr; Import JSON</strong>. Vendor logos, brand colours, and capability metadata auto-attach on import, taking you from &ldquo;captured events&rdquo; to a shareable martech-stack diagram in two clicks.</p>',
            items: [
              '<strong>Save as MartechStack Builder JSON.</strong> New action in the Stack view export menu. Uses the real attribution graph for parent-child edges (Tealium loads GTM, GTM loads GA4, and so on) so the diagram reflects what actually loaded what.',
              '<strong>Spec-compliant payload.</strong> Categories match MartechStack Builder&rsquo;s 7-bucket vocabulary (Source / Infrastructure / Processing / Activation / Analytics / Governance / Custom), <code>provider</code> slugs are lowercase-hyphenated for vendor auto-matching, and the diagram lands pre-named with the captured site and detection date.',
              '<strong>About modal on first save.</strong> The first time you click the new export, an <em>About MartechStack Builder</em> modal opens with the tool&rsquo;s logo, a clickable link, and a <em>Don&rsquo;t show this again</em> opt-out so future saves go direct. Click the &#9432; next to the Stack view menu row to re-open it any time.',
              '<strong>Out of Labs.</strong> Previously hidden behind a Labs toggle; now first-class. Thanks to <em>Matthew Niederberger</em> for sharing the import schema and granting permission to redistribute MartechStack Builder&rsquo;s vendor catalogue inside Event Watcher.'
            ]
          },
          {
            title: 'New &mdash; Settings modal redesign',
            items: [
              '<strong>Search bar</strong> at the top of Settings &mdash; filters rows by label or description text, auto-expands the section that matches, Esc clears.',
              '<strong>Session Defaults</strong> (renamed from <em>Defaults</em>) &mdash; section starts collapsed by default so all section headings are visible at a glance.',
              '<strong>Data Layer</strong> section (renamed from <em>Data Layer Detection</em>) &mdash; now contains both <em>Detection</em> (the eight dataLayer-type toggles) and <em>Nesting</em> (DL Nesting default + correlation windows, moved out of <em>Defaults</em>).',
              '<strong>Look &amp; Feel rows</strong> now carry a one-line explanation under each label (Theme / Filter toolbar / Categories / Count chip / Density). Same for the Nesting rows.',
              '<strong>Description text contrast</strong> lifted to WCAG AA across the modal (<code>--text-secondary</code>, ~5.5:1 on light, ~7.5:1 on dark). Subsection headers (<em>STREAM</em>, <em>FILTERS</em>, <em>DETECTION</em>, etc.) get a separator line and a darker shade to read clearly as headers.',
              '<strong>Toggle and button-group rows share the same grey card</strong> background and 6px gap so the modal reads as one consistent list.',
              '<strong>Features descriptions</strong> trimmed across 8 toggles &mdash; removed boilerplate (<em>&ldquo;When off, hides&hellip;&rdquo;</em> &rarr; <em>&ldquo;Hides&hellip;&rdquo;</em>), kept the <em>what</em>, dropped the <em>why-you-might-care</em>.'
            ]
          },
          {
            title: 'Improvements',
            items: [
              '<strong>Copy toast</strong> &mdash; small auto-dismissing confirmation appears next to the button you clicked after every copy or save. Shows character count plus an optional <em>(N events truncated)</em> suffix.',
              '<strong>Stack Mermaid export &mdash; left-to-right</strong> &mdash; <code>flowchart LR</code> instead of <code>flowchart TD</code>. Reads naturally as data flow: site &rarr; loaders &rarr; tools.',
              '<strong>Script Tree renamed to &ldquo;Script&rdquo;</strong> &mdash; same view, one-word label that lines up with the rest (Stream / Tool / Page / Stack / Pinned). New view-specific toolbar with <strong>Clear</strong> and <strong>Refresh</strong> buttons (replaces the Stream-only toolbar while you&rsquo;re in Script view).',
              '<strong>Context-menu scope header</strong> &mdash; right-click menus on group headers, pages, and scripts now show a small uppercase line at the top (e.g. <em>Tool: GA4</em>, <em>Selected page</em>) so you can tell at a glance what the menu&rsquo;s actions apply to.',
              '<strong>L2 sub-headers in Grouped view</strong> &mdash; right-click now opens the same menu as L1 group headers (Copy Markdown Table / for Human / for AI / Complete / Start AI Chat / Compare formats), scoped to that slice.',
              '<strong>Brighter warning yellow</strong> (consent counter, tool-chip warning pill, event-row pre-consent shield) &mdash; the previous olive-leaning yellow was too close to the interactions-filter amber and read as brown on light backgrounds.',
              '<strong>CDP destinations parsed</strong> &mdash; Segment / RudderStack / Hightouch / mParticle config requests now render a <em>Destinations configured</em> section with clickable brand pills. Adobe Launch and Adobe AEP Web SDK Edge Network configs render the same way.'
            ]
          },
          {
            title: 'Removed',
            items: [
              '<strong>Copy Extended Debug</strong> &mdash; menu items, the function, and the <em>Extended debug export</em> setting toggle all retired. The format overlapped heavily with <em>Copy Complete</em>, the Network panel, and Stack View. Migration path: <em>Copy Complete</em> covers raw HTTP and full consent tracking; the Network panel covers HAR data; Stack View covers script-initiator stacks.'
            ]
          },
          {
            title: 'Fixes',
            items: [
              '<strong>Stape Data Tag beacons</strong> on first-party <code>analytics.&lt;root&gt;</code> subdomains were silently dropped by the unknown-tracking gate &mdash; now reach CNAME detection and the structural fingerprint as intended.',
              '<strong>First-party CNAME bypass</strong> no longer mis-classifies fonts and stylesheets on the page&rsquo;s own domain as <em>1st Party Proxy</em> (cache-busted asset URLs were matching the tracking heuristic).',
              '<strong>Script view duplicates</strong> &mdash; the Script (tree) view rendered the same script multiple times when the page loaded it more than once (reloads, SPA route changes). Now collapses to one canonical event per URL.'
            ]
          }
        ]
      },
      {
        surface: 'platforms',
        items: [
          '<strong>Tag Managers</strong> &mdash; walkerOS (open-source, self-hosted client-side tag manager by elbwalker; CDN-loaded variants caught via <code>@elbwalker/walker.js</code> and <code>/@walkeros/</code> npm scopes), Google Tag Assistant (Preview session endpoint), GTM Diagnostics (signals consumed by the Tag Diagnostics UI in Google Tag and Google Ads)',
          '<strong>Analytics</strong> &mdash; Avo (Avo Inspector tracking-plan validation), Google Merchant Center Key Events',
          '<strong>CDPs</strong> &mdash; Salesforce Data Cloud',
          '<strong>First-Party Collection</strong> &mdash; Squarespace Analytics, Framer Analytics',
          '<strong>Widgets</strong> &mdash; Giosg (Finnish live-chat / conversational sales), Kiwi Sizing (Shopify size-chart and AI fit-recommender)'
        ]
      }
    ]
  },
  {
    version: '1.2.0',
    label: 'Grouped View',
    sections: [
      {
        surface: 'devtools',
        categories: [
          {
            title: 'New',
            items: [
              '<strong>Grouped view</strong> &mdash; Tool and Page collapsed into one mode with six new pivots: Event Name, Consent Category, Datalayer, Endpoint, Cookie, Identity',
              '<strong>Pivot picker</strong> &mdash; pin and drag-to-reorder the pivots you use',
              '<strong>Split expand/collapse</strong> &mdash; independent toggles for top-level groups and sub-groups',
              '<strong>Group-header context menus</strong> &mdash; right-click any group header for one shared menu (Copy Table / JSON / Full Export / Start AI Chat for that group)',
              '<strong>AI Chat for any group scope</strong> &mdash; chat opens scoped to the slice you right-clicked',
              '<strong>Full-width view-mode bar</strong> &mdash; view modes moved into a strip above the main panel'
            ]
          },
          {
            title: 'Improvements',
            items: [
              '<strong>Sharper detection</strong> &mdash; server-side CAPI gateways on bespoke proxy hosts, and a more precise CMP vs. Google Consent Mode mismatch warning',
              '<strong>CMP detection coverage</strong> extended to 11 more CMPs',
              '<strong>GTM intercept</strong> &mdash; concurrency guard for rapid rule toggling',
              '<strong>&ldquo;via Stape&rdquo;</strong> annotation on server-side GA4 events',
              '<strong>Broader detection</strong> &mdash; new subdomains across HubSpot, Mailchimp, Medallia, Freshchat, and others'
            ]
          },
          {
            title: 'Fixes',
            items: [
              '<strong>OpenAI <em>Save &amp; test</em></strong> works with the current GPT-5 family models',
              '<strong>Edit &amp; Push to dataLayer</strong> accepts <code>dataLayer.push({&hellip;})</code> syntax (unquoted keys, single quotes, trailing commas)',
              '<strong>Overview collapse state</strong> persists across event selections'
            ]
          }
        ]
      },
      {
        surface: 'platforms',
        items: [
          '<strong>A/B Testing</strong> &mdash; Intellimize (Webflow Optimize)',
          '<strong>Ad Tech</strong> &mdash; AdTarget, ArtsAI, Bidtellect, Brightline, Cognitiv, Integral Ad Science, OnAudience, Optimal People, ownerIQ, SingleView, Triton Digital',
          '<strong>Advertising</strong> &mdash; Adot, MikMak, plista',
          '<strong>Analytics</strong> &mdash; Byggfakta Analytics Pro, Converge, Polar Analytics, Snitcher, UserReport',
          '<strong>CDPs</strong> &mdash; Segmint',
          '<strong>First-Party Collection</strong> &mdash; Stape Data Tag',
          '<strong>Monitoring</strong> &mdash; Azure Application Insights, Forter, Pingdom RUM',
          '<strong>Video</strong> &mdash; Spotify',
          '<strong>Widgets</strong> &mdash; 15Gifts, Mapbox, Social Intents, Tally, Zoho SalesIQ'
        ]
      }
    ]
  },
  {
    version: '1.1.0',
    label: 'AI with Your Own API Key',
    sections: [
      {
        surface: 'devtools',
        categories: [
          {
            title: 'New &mdash; AI with your own API key',
            items: [
              '<strong>AI Summary</strong> in every event&rsquo;s detail panel with four task presets and follow-up chat',
              '<strong>Page-scoped AI</strong> on page-event detail views with four page-focused presets',
              '<strong>GTM Container AI</strong> on GTM script loads &mdash; also rendered inside every container card in the GTM Hub',
              '<strong>DataLayer AI</strong> on dataLayer/GTM/gtag pushes',
              '<strong>Script-load AI</strong> on captured script loads',
              '<strong>AI Chat tab</strong> for questions across the whole captured session',
              '<strong>Identify Platform</strong> task on unknown events &mdash; turns a confirmed identification into a persistent Custom Endpoint mapping',
              'Bring your own API key for Anthropic Claude, OpenAI, or Google Gemini &mdash; nothing flows through our servers, you pay your provider directly'
            ]
          },
          {
            title: 'New &mdash; Settings &rarr; Features',
            items: [
              'A new <strong>Features</strong> section in Settings to hide whole feature areas you don&rsquo;t use &mdash; <em>AI features</em>, <em>GTM Hub</em>, <em>Script view</em>, <em>Cookie detection</em>, <em>Consent Check</em>'
            ]
          },
          {
            title: 'New &mdash; Event Comments',
            items: [
              '<strong>Attach a free-text note</strong> to any event via a pencil affordance at the bottom of the Overview card',
              '<strong>Row indicator</strong> on event-list rows that have a comment, with tooltip preview',
              'Comments travel with your JSON exports, so AI assistants reading the export see your observation next to the raw event'
            ]
          },
          {
            title: 'Fixes',
            items: [
              '<strong>Scripts &amp; Consent filters</strong> now layer on top of your tool/category selection instead of replacing it'
            ]
          }
        ]
      },
      {
        surface: 'platforms',
        items: [
          '<strong>Analytics</strong> &mdash; Ahrefs Web Analytics'
        ]
      },
      {
        surface: 'sidepanel',
        items: [
          '<strong>Version-update banner</strong> &mdash; the side panel greets you on upgrade with a banner pointing to what&rsquo;s new',
          '<strong>DevTools Discovery nudge</strong> &mdash; sidepanel-only users who&rsquo;ve never opened DevTools see a banner with an inline &ldquo;Show me how&rdquo; expansion'
        ]
      }
    ]
  },
  {
    version: '1.0.3',
    label: 'Dark Mode, Intro Tour & GTM Inject Removed',
    sections: [
      {
        surface: 'devtools',
        categories: [
          {
            title: 'New',
            items: [
              'Intro tour on first run. A quick walkthrough of the essentials so new users find the good stuff fast',
              'Extended tour for power-user features, unlocked once you&rsquo;ve settled in or available on demand',
              'Replay either tour any time from Settings &rarr; Defaults &rarr; Help'
            ]
          },
          {
            title: 'Improvements',
            items: [
              'Toolbar and filter bar now collapse progressively as the panel narrows. Buttons slide into a &hellip; overflow menu instead of clipping',
              'Presets and Save Preset merged into one dropdown'
            ]
          },
          {
            title: 'Fixes',
            items: [
              'Interactions filter no longer disappears when the filter bar is collapsed',
              'Opening a modal now closes any other modal that was already open. No more stacked overlays'
            ]
          },
          {
            title: 'Removed',
            items: [
              'GTM &ldquo;Inject Container&rdquo; action &mdash; the feature loaded <code>gtm.js</code> from googletagmanager.com, which conflicts with the Chrome Web Store&rsquo;s Manifest&nbsp;V3 &ldquo;no remotely hosted code&rdquo; rule. <strong>Block</strong>, <strong>Swap</strong>, and <strong>Preview</strong> are unaffected'
            ]
          }
        ]
      },
      {
        surface: 'shared',
        items: [
          'Dark mode polish and a sun/moon toggle in the toolbar, synced across DevTools and the side panel',
          'Consentmo CMP support <em>(thanks Steve Lamar)</em>'
        ]
      },
      {
        surface: 'sidepanel',
        items: [
          'Expanded tool cards now show a &ldquo;Website&rdquo; link in the footer. Jump straight to vendor docs without leaving the side panel',
          'Amplitude cards now list the actual event names being sent (with API Key), matching how GA4 and Facebook events are displayed. No more opaque <code>/2/httpapi</code> rows'
        ]
      }
    ]
  },
  {
    version: '1.0.1',
    label: 'GTM Preview Bug Fix',
    sections: [
      {
        surface: 'devtools',
        categories: [
          {
            title: 'Fixes',
            items: [
              'Fixed GTM Preview not loading the preview container on subsequent page navigations',
              'Added Reload button in GTM Hub when preview is active. Hard refreshes to fetch the latest container version after GTM workspace updates'
            ]
          }
        ]
      }
    ]
  },
  {
    version: '1.0.0',
    label: 'Initial Release',
    sections: [
      {
        categories: [
          {
            title: 'Features',
            items: [
              'Real-time capture and display of analytics and marketing events',
              'Four view modes: Stream, Tool, Page, and Script Tree',
              'DataLayer monitoring for 8 data layer types (GTM, Adobe ACDL, Tealium, W3C, Commanders Act, Relay42, Piwik PRO, Ensighten)',
              'DataLayer push source detection: identifies who called each dataLayer.push()',
              'DL Nesting: GTM trigger correlation linking dataLayer pushes to fired tags',
              'Script initiator detection (Website, Tag Manager, Script)',
              'Capture controls: pause, stop, and resume event recording',
              'Stream direction: newest first or oldest first',
              '4-state filters for Scripts and Consent events (Tool, Hide, Only, Always)',
              'Collapsible filter toolbar with tool search',
              'Filter presets: save and load filter configurations',
              'Categories &amp; Tools panel with full platform browser',
              'Context menu with Show Only, Hide, Highlight, Copy JSON, and Copy HAR',
              'Export events as JSON, HAR, or table format (per event, per page, or all events)',
              'Event sorting by Start time, Finish time, or Index',
              'Resizable panels with double-click collapse',
              'Configurable defaults with "Last used" memory option',
              'Side Panel for quick overview of detected tools',
              'Cookie detection: badge on events that set cookies, with detailed attributes and ePrivacy compliance flags',
              'Cookie management: delete or edit cookies directly from the detail view',
              'DataLayer push replay: re-fire captured dataLayer events with one click',
              'Edit &amp; Push: modify dataLayer payloads in a JSON editor before pushing to the page',
              '&ldquo;Pushed&rdquo; badge on replayed dataLayer events to distinguish from organic events',
              'Built-in feedback system for bug reports, feature requests, and missing tools'
            ]
          },
          {
            title: 'Tool Detection',
            items: [
              '<span data-platform-count></span> analytics and marketing platforms supported',
              '14 categories: Analytics, Tag Managers, Advertising, Ad Tech, CDPs, A/B Testing, Session Replay, Video, Marketing Automation, Consent, Data Layer, First-Party Collection, Widgets, and Monitoring',
              'Detailed parameter parsing for GA4, Adobe Analytics, Meta Pixel, and more',
              'CNAME detection for first-party collection endpoints'
            ]
          }
        ]
      }
    ]
  }
];

const SURFACE_LABELS = {
  devtools: 'DevTools',
  shared: 'Shared',
  sidepanel: 'Side Panel',
  platforms: 'New Supported Platforms'
};

function renderItems(items) {
  return items.map(item => `<li>${item}</li>`).join('');
}

function renderCategories(categories) {
  return categories.map(cat => {
    const intro = cat.intro ? `<div class="help-version-intro">${cat.intro}</div>` : '';
    const list = (cat.items && cat.items.length)
      ? `<ul>${renderItems(cat.items)}</ul>`
      : '';
    return `
    <div class="help-version-category">
      <h4>${cat.title}</h4>
      ${intro}${list}
    </div>`;
  }).join('');
}

function renderSection(section) {
  const surfaceLabel = SURFACE_LABELS[section.surface];
  const surfaceHeader = surfaceLabel
    ? `<h3 class="help-version-surface-title help-surface-${section.surface}">${surfaceLabel}</h3>`
    : '';

  const body = section.categories
    ? renderCategories(section.categories)
    : `<div class="help-version-category help-version-category-flat"><ul>${renderItems(section.items || [])}</ul></div>`;

  return `<div class="help-version-surface">${surfaceHeader}${body}</div>`;
}

/**
 * Render all version entries as HTML.
 * The latest version (index 0) is expanded by default; older versions
 * collapse into native <details> blocks the user can expand on demand.
 * @returns {string} HTML string for the versions tab
 */
function renderVersionsHTML() {
  return '<div class="help-versions">' +
    VERSIONS.map((entry, index) => `
      <details class="help-version-entry"${index === 0 ? ' open' : ''}>
        <summary class="help-version-header">
          <span class="help-version-badge">v${entry.version}</span>
          <span class="help-version-label">${entry.label}</span>
        </summary>
        ${entry.sections.map(renderSection).join('')}
      </details>`).join('\n') +
    '</div>';
}

// Export for use in help-content.js
window.HelpVersions = {
  VERSIONS,
  renderVersionsHTML
};
