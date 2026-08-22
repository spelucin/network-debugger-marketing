// Platform Registry — all platform definitions for Event Watcher
// New platforms also need an icon entry in platform-icons.js
//
// Metadata-only fields (not consumed by runtime code):
//   colorVerified  — whether the brand color has been verified against official sources
//   addedInVersion — extension version when the platform was first added
//   addedDate      — date (YYYY-MM-DD) when the platform was first added
//
// Optional consent field:
//   consentCategory — overrides the default consent category derived from `category`.
//     Values: 'analytics' | 'marketing' | 'functional'. When absent, the consent
//     category is inferred from `category` via getRequiredConsentCategory() in consent.js.
//     Use when a platform's consent requirement differs from its category default
//     (e.g., a CDP used for ad targeting needs 'marketing', not the CDP default 'analytics').
//
//   consumesGCM — `true` for Google products that read Google Consent Mode signals
//     (gtag.js / GTM relay the dataLayer `consent:default` / `consent:update` pushes to
//     these platforms). Only platforms with this flag get the CMP↔GCM mismatch advisory
//     in computeConsentCheck(); other vendors (Meta, Snapchat, TikTok, LinkedIn, etc.)
//     have their own pixel-level consent APIs and do not read GCM, so flagging a GCM
//     denial against their requests would be a false alarm.

export const KNOWN_TRACKING_ENDPOINTS = [
  // === DATA LAYER METHODS ===
  {
    id: 'adobe-datalayer',
    name: 'Adobe Data Layer',
    shortName: 'Adobe Data Layer',
    patterns: [],  // Detected via JavaScript interception
    syntax: ['window.adobeDataLayer.push({...})'],
    category: 'data-layer',
    description: 'Adobe Experience Platform data layer - array-based event structure for Adobe Tags and AEP.',
    url: 'https://github.com/adobe/adobe-client-data-layer',
    color: '#ff0000',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'commandersact-datalayer',
    name: 'Commanders Act tc_vars',
    shortName: 'tc_vars',
    patterns: [],  // Detected via JavaScript interception
    syntax: ['window.tc_vars = {...}'],
    category: 'data-layer',
    description: 'Commanders Act data layer - object-based data structure for TagCommander TMS.',
    url: 'https://doc.commandersact.com/',
    color: '#002cbd',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  // These are client-side data structures detected via JavaScript interception, not network requests
  {
    id: 'datalayer',
    name: 'dataLayer',
    shortName: 'dataLayer',
    patterns: [],  // Detected via JavaScript interception
    syntax: ['window.dataLayer.push({...})'],
    category: 'data-layer',
    description: 'Google Tag Manager data layer - array-based event data structure for passing information to GTM.',
    url: 'https://developers.google.com/tag-manager/devguide',
    color: '#4285F4',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'ensighten-datalayer',
    name: 'Ensighten Data Layer',
    shortName: 'Ensighten DL',
    patterns: [],  // Detected via JavaScript interception
    syntax: ['window.Bootstrapper.dataLayer', 'window.ensightenDataLayer'],
    category: 'data-layer',
    description: 'Ensighten data layer - various implementations for Ensighten Manage.',
    url: 'https://www.ensighten.com/',
    color: '#fe0072',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'piwik-datalayer',
    name: 'Piwik Pro DataLayer',
    shortName: 'Piwik Pro DataLayer',
    patterns: [],  // Detected via JavaScript interception
    syntax: ['window.dataLayer.push({...})'],
    category: 'data-layer',
    description: 'Piwik PRO data layer - array-based structure similar to Google dataLayer.',
    url: 'https://help.piwik.pro/support/tag-manager/data-layer/',
    color: '#0254c0',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'relay42-datalayer',
    name: 'Relay42 defined42',
    shortName: 'defined42',
    patterns: [],  // Detected via JavaScript interception
    syntax: ['window.defined42.push({...})'],
    category: 'data-layer',
    description: 'Relay42 data layer - array-based event structure for Relay42 journey orchestration.',
    url: 'https://www.relay42.com/',
    color: '#33b062',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'tealium-datalayer',
    name: 'Tealium utag_data',
    shortName: 'utag_data',
    patterns: [],  // Detected via JavaScript interception
    syntax: ['window.utag_data = {...}'],
    category: 'data-layer',
    description: 'Tealium data layer - object-based data structure for Tealium iQ.',
    url: 'https://docs.tealium.com/platforms/javascript/data-layer/',
    color: '#24D6E0',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'w3c-datalayer',
    name: 'W3C digitalData',
    shortName: 'digitalData',
    patterns: [],  // Detected via JavaScript interception
    syntax: ['window.digitalData = {...}'],
    category: 'data-layer',
    description: 'W3C Customer Experience Digital Data Layer standard - a standardized data layer specification.',
    url: 'https://www.w3.org/2013/12/ceddl-201312.pdf',
    color: '#005a9c',
    colorVerified: true,
    iconVerified: true, // Material Design Icons: W3C
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },

  // === TAG MANAGERS ===
  {
    id: 'adobe-launch',
    name: 'Adobe Tags (Launch)',
    shortName: 'Adobe Tags',
    patterns: [
      'assets.adobedtm.com',
      'launch.adobe.com',
      /\/launch-[A-Za-z0-9]+-[^/]+\.min\.js(?:\?|$)/  // Adobe Launch container files (first-party hosting)
    ],
    category: 'tag-manager',
    description: 'Adobe Experience Platform Tags (formerly Launch) - enterprise tag management for deploying and orchestrating marketing/analytics tags.',
    url: 'https://experienceleague.adobe.com/en/docs/experience-platform/tags/home',
    color: '#ff0000',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'cloudflare-zaraz',
    name: 'Cloudflare Zaraz',
    shortName: 'Cloudflare Zaraz',
    patterns: [
      '/cdn-cgi/zaraz/'
    ],
    category: 'tag-manager',
    description: 'Edge-side tag management running on Cloudflare Workers - loads and executes tags at the CDN edge.',
    url: 'https://www.cloudflare.com/products/zaraz/',
    color: '#F48120',
    colorVerified: true,
    iconVerified: true, // Simple Icons: Cloudflare
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'commandersact-tms',
    name: 'Commanders Act TMS',
    shortName: 'Commanders Act',
    patterns: [
      'tagcommander.com',
      'commander1.com',
      /\/tc_[^/]+\.js(?:\?|$)/  // Commanders Act container files (first-party hosting)
    ],
    category: 'tag-manager',
    description: 'European enterprise tag management system with server-side capabilities.',
    url: 'https://www.commandersact.com/',
    color: '#002cbd',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'ensighten',
    name: 'Ensighten Manage',
    shortName: 'Ensighten',
    patterns: [
      'ensighten.com/tag',
      'nexus.ensighten.com'
    ],
    category: 'tag-manager',
    description: 'Enterprise tag management with privacy compliance and data governance features.',
    url: 'https://www.ensighten.com',
    color: '#fe0072',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'gtag',
    name: 'Google Tag',
    shortName: 'GTAG',
    patterns: [
      'googletagmanager.com/gtag/js'
    ],
    category: 'tag-manager',
    description: 'Google unified JavaScript tagging framework for all Google products.',
    url: 'https://developers.google.com/tag-platform/gtagjs',
    color: '#34A853',
    colorVerified: true,
    iconVerified: false,
    consumesGCM: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'gtag-destination',
    name: 'Google Tag Destination',
    shortName: 'GTAG Destination',
    patterns: [
      'googletagmanager.com/gtag/destination'
    ],
    category: 'tag-manager',
    description: 'Auxiliary gtag.js fetch that loads per-destination configuration when a single Google tag has multiple linked destinations (e.g. a GA4 measurement ID linked to a Google Ads conversion ID). Client-side request to Google\'s CDN — not server-side GTM (that traffic goes to a customer-controlled domain and is detected as sgtm).',
    url: 'https://support.google.com/tagmanager/answer/12324787',
    color: '#34A853',
    colorVerified: true,
    iconVerified: false,
    consumesGCM: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'gtm',
    name: 'Google Tag Manager',
    shortName: 'GTM',
    patterns: [
      'googletagmanager.com/gtm.js'
    ],
    category: 'tag-manager',
    description: 'Container-based tag management for deploying marketing and analytics tags without code changes.',
    url: 'https://tagmanager.google.com',
    color: '#4285F4',
    colorVerified: true,
    iconVerified: true,
    consumesGCM: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'gtm-analytics',
    name: 'GTM Telemetry',
    shortName: 'GTM Telemetry',
    patterns: [
      'googletagmanager.com/a?',
      'googletagmanager.com/a/'
    ],
    category: 'tag-manager',
    description: 'GTM internal telemetry — performance and tag-execution data sent by container scripts back to Google for diagnostic reporting.',
    url: 'https://tagmanager.google.com',
    color: '#4285F4',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-04-28'
  },
  {
    id: 'gtm-diagnostics',
    name: 'GTM Diagnostics',
    shortName: 'GTM Diagnostics',
    patterns: [
      'googletagmanager.com/td'
    ],
    category: 'tag-manager',
    description: 'Observed GTM-family endpoint at googletagmanager.com/td — believed to carry the signals consumed by the Tag Diagnostics UI in Google Tag and Google Ads (out-of-order config, untagged pages, stopped tags, deprecated patterns). Diagnostic infrastructure, not user-behaviour tracking. Path purpose inferred — Google has not publicly documented the /td route.',
    url: 'https://support.google.com/tagmanager/answer/14681508',
    color: '#4285F4',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-05'
  },
  {
    id: 'gtm-health',
    name: 'GTM Health',
    shortName: 'GTM Health',
    patterns: [
      /googletagmanager\.com\/gtm\.js\?[^#]*[?&]gtg_health=1/
    ],
    category: 'tag-manager',
    description: 'Google Tag Manager health-check ping (&gtg_health=1) — a small follow-up library request that reports whether Google Tags loaded successfully. Throttled to once per 24h via the _gcl_ls localStorage key when ad_storage and ad_user_data consent are granted; fires every page load otherwise. Always hits www.googletagmanager.com even on server-side tagging setups.',
    url: 'https://tagmanager.google.com',
    color: '#4285F4',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-03'
  },
  {
    id: 'piwik-pro-tm',
    name: 'Piwik Pro Tag Manager',
    shortName: 'Piwik Pro Tag Manager',
    // BUG44 (2026-05-26): tightened from bare 'containers.piwik.pro' to the
    // per-container loader path. The bare-host pattern over-claimed the host
    // and starved the sibling piwik-pro-consent entry (`/ppms.js` +
    // `/privacy-templates.json`) since the panel matcher is first-match-wins.
    // Verified on pplus.dk: every TM loader hit lands on `/containers/<UUID>.js`.
    patterns: [
      'containers.piwik.pro/containers/'
    ],
    category: 'tag-manager',
    description: 'Privacy-focused tag management as part of Piwik PRO Analytics Suite.',
    url: 'https://piwik.pro/tag-manager/',
    color: '#0254c0',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'tag-assistant',
    name: 'GTM Preview',
    shortName: 'GTM Preview',
    patterns: [
      'googletagmanager.com/debug'
    ],
    category: 'tag-manager',
    description: 'Google Tag Assistant — authoring debug session endpoint for the Google Tag Manager Preview / Tag Assistant flow. Streams tag-firing data back to the Tag Assistant UI. Fires only when a GTM author has Preview connected; not visible on end-user (visitor) pageviews. Web-container only — server-side GTM uses a different mechanism (X-Gtm-Server-Preview header).',
    url: 'https://tagassistant.google.com/',
    color: '#4285F4',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-05'
  },
  {
    id: 'tealium-collect',
    name: 'Tealium Collect',
    shortName: 'Tealium Collect',
    patterns: [
      'collect.tealiumiq.com',                      // Standard Tealium Collect endpoint
      /collect-[a-z]+-\d+\.tealiumiq\.com/,          // Regional endpoints (collect-eu-central-1.tealiumiq.com)
      /collect\.[^/]+\/[^/]+\/[^/]+\/\d+\/i\.gif/,  // First-party CNAME collect (collect.example.com/account/profile/2/i.gif)
      /\/vdata\/i\.gif/                              // VData pixel endpoint (/vdata/i.gif?tealium_account=...)
    ],
    category: 'cdp',
    parsing: { customParser: true, formattedParser: true },
    description: 'Tealium server-side data collection. Feeds EventStream (server-side tag management), AudienceStream (CDP), and DataAccess.',
    url: 'https://docs.tealium.com/client-side-tags/tealium-collect-tag/',
    color: '#24D6E0',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-25'
  },
  {
    id: 'tealium',
    name: 'Tealium iQ',
    shortName: 'Tealium iQ',
    patterns: [
      'tags.tiqcdn.com',
      /(?<!collect[-.])tealiumiq\.com/,  // Visitor service, CDN, etc. — excludes collect.tealiumiq.com (matched by tealium-collect)
      /\/utag\.js(\?|$)/,      // Tealium container - matches utag.js with optional query params
      /\/utag\.sync\.js(\?|$)/, // Tealium sync container
      /\/utag\.\d+\.js(\?|$)/  // Tealium individual tag configs (utag.140.js = tag UID 140, loads specific vendor)
    ],
    category: 'tag-manager',
    description: 'Enterprise tag management with built-in customer data platform (AudienceStream).',
    url: 'https://tealium.com',
    color: '#24D6E0',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'walkeros',
    name: 'walkerOS',
    shortName: 'walkerOS',
    patterns: [
      '@elbwalker/walker.js',  // Legacy v1/v2 npm bundle on jsDelivr/unpkg
      '/@walkeros/'            // v3+ npm scope (web-source-browser, collector, web-destination-*)
    ],
    category: 'tag-manager',
    description: 'Open-source, self-hosted client-side tag manager that captures DOM events via data-elb attributes and forwards them to third-party destinations (GA4, Meta, Mixpanel, Plausible, etc.).',
    url: 'https://www.walkeros.io/',
    color: '#00b8e1',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-04'
  },

  // === ANALYTICS ===
  {
    id: 'adobe-analytics',
    name: 'Adobe Analytics',
    shortName: 'Adobe Analytics',
    patterns: [
      '.2o7.net',
      '.sc.omtrdc.net',  // Analytics uses sc.omtrdc.net (not tt.omtrdc.net which is Target)
      'omniture.com',
      '/b/ss/',
      '/s_code.js',
      '/AppMeasurement.js',
      /^https?:\/\/smetrics\./i
    ],
    category: 'analytics',
    description: 'Enterprise digital analytics for measuring traffic, conversions, and customer journeys across channels.',
    url: 'https://business.adobe.com/products/adobe-analytics.html',
    color: '#ff0000',
    colorVerified: true,
    iconVerified: true,
    parsing: { customParser: true, formattedParser: true },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'adora',
    name: 'Adora',
    shortName: 'Adora',
    patterns: [
      'c.adora-cdn.com',
      'adora-cdn.com',
      'api.adora.so'
    ],
    category: 'analytics',
    description: 'Product analytics and session replay platform focused on user engagement insights.',
    url: 'https://www.adora.so',
    color: '#592eff',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'agma-analytics',
    name: 'AGMA Analytics',
    shortName: 'AGMA',
    patterns: [
      'pbc.agma-analytics.de',
      'agma-analytics.de'
    ],
    category: 'analytics',
    description: 'Official German media research body (Arbeitsgemeinschaft Media-Analyse) for audience measurement on German publishers.',
    url: 'https://www.agma-mmc.de',
    color: '#003e7e',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'ahrefs-analytics',
    name: 'Ahrefs Web Analytics',
    shortName: 'Ahrefs',
    patterns: [
      'analytics.ahrefs.com'
    ],
    category: 'analytics',
    description: 'Cookieless, privacy-friendly web analytics by Ahrefs — tracks pageviews, outbound link clicks, form submissions, and custom events.',
    url: 'https://ahrefs.com/web-analytics',
    color: '#FF8800',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.1.0',
    addedDate: '2026-04-21'
  },
  {
    id: 'albacross',
    name: 'Albacross',
    shortName: 'Albacross',
    patterns: [
      'serve.albacross.com',
      'new-collect.albacross.com',
      'c.albss.com',
      'albss.com'
    ],
    category: 'analytics',
    description: 'B2B website visitor identification (reverse IP lookup) that reveals which companies visit your site.',
    url: 'https://www.albacross.com',
    color: '#5046e5',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26',
    updatedDate: '2026-05-18'
  },
  {
    id: 'algolia-insights',
    name: 'Algolia Insights',
    shortName: 'Algolia',
    patterns: [
      'insights.algolia.io',
      'insights.us.algolia.io',
      'insights.de.algolia.io'
    ],
    category: 'analytics',
    description: 'User behavior event tracking for Algolia search — clicks, conversions, and views for search analytics and personalization.',
    url: 'https://www.algolia.com',
    color: '#003DFF',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-19'
  },
  {
    id: 'amplitude',
    name: 'Amplitude',
    shortName: 'Amplitude',
    patterns: [
      'api.amplitude.com',
      'api2.amplitude.com',
      'api.eu.amplitude.com',
      'amplitude.com/2/httpapi',
      'amplitude.com/batch',
      'analytics.amplitude.com',
      'regionconfig.amplitude.com',
      'cdn.amplitude.com'  // Script load detection
    ],
    category: 'analytics',
    description: 'Product analytics for tracking user behavior, retention, and feature adoption.',
    url: 'https://amplitude.com',
    color: '#1e61f0',
    colorVerified: true,
    iconVerified: false,
    parsing: { customParser: true, formattedParser: true },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'audioeye-analytics',
    name: 'AudioEye Analytics',
    shortName: 'AudioEye',
    patterns: [
      'analytics.audioeye.com'
    ],
    category: 'analytics',
    description: 'Site usage and performance telemetry emitted by the AudioEye web-accessibility widget.',
    url: 'https://www.audioeye.com',
    color: '#2c5cc5',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.1',
    addedDate: '2026-06-02'
  },
  {
    id: 'avo',
    name: 'Avo',
    shortName: 'Avo',
    patterns: [
      'api.avo.app'
    ],
    category: 'analytics',
    description: 'Analytics governance and tracking-plan platform; the Avo Inspector SDK reports event schemas (no values, no PII) for tracking-plan validation.',
    url: 'https://www.avo.app',
    color: '#7B5BFF',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-05'
  },
  {
    id: 'baidu-analytics',
    name: 'Baidu Analytics',
    shortName: 'Baidu Analytics',
    patterns: [
      'hm.baidu.com',
      'hmcdn.baidu.com',
      'tongji.baidu.com'
    ],
    category: 'analytics',
    description: 'Web analytics service by Baidu, the dominant search engine in China.',
    url: 'https://tongji.baidu.com',
    color: '#2932E1',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'brandmetrics',
    name: 'Brandmetrics',
    shortName: 'Brandmetrics',
    patterns: [
      'cdn.brandmetrics.com',
      'collector.brandmetrics.com',
      'brandmetrics.com'
    ],
    category: 'analytics',
    description: 'Brand lift measurement for digital advertising, measuring attention and brand impact across campaigns.',
    url: 'https://www.brandmetrics.com',
    color: '#3d007f',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'byggfakta-analytics-pro',
    name: 'Byggfakta Analytics Pro',
    shortName: 'Byggfakta',
    patterns: [
      '.stats.docu.info/'
    ],
    category: 'analytics',
    description: 'Self-hosted Matomo-based analytics from Byggfakta Group (formerly DOCU Nordic), used by Nordic construction-product and building-material vendor sites for B2B engagement intelligence.',
    url: 'https://byggfaktagroup.com',
    color: '#FF6B35',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'cabin',
    name: 'Cabin',
    shortName: 'Cabin',
    patterns: [
      'scripts.withcabin.com',
      'ping.withcabin.com'
    ],
    category: 'analytics',
    description: 'Privacy-first, carbon-aware web analytics — cookieless, GDPR-compliant, and powered by renewable energy.',
    url: 'https://withcabin.com',
    color: '#4495F6',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-06'
  },
  {
    id: 'calibermind',
    name: 'CaliberMind',
    shortName: 'CaliberMind',
    // The '//' anchor is LOAD-BEARING, not cosmetic: a bare 'e.calibermind.com' substring would
    // also match any future host ending in 'e' - secure./live./store.calibermind.com - and
    // secure. is a plausible console hostname. No apex wildcard: my.calibermind.com is the
    // customer console, and app./docs./learn./email./www. are all non-tracking.
    // The tag is a rebranded MetaRouter (Segment-spec) analytics.js - it sets ajs_anonymous_id /
    // ajs_group_id and its duplicate-load guard still prints 'MetaRouter snippet included twice.'
    // Category follows the dreamdata precedent (first-party measurement tag = analytics), NOT the
    // 6sense/demandbase precedent (third-party intent network = advertising).
    // KNOWN GAP: CaliberMind officially documents self-hosting the script on a customer domain -
    // those deployments are single-tenant and unenumerable, same class as lead-forensics.
    patterns: [
      '//cdn.calibermind.com',
      '//e.calibermind.com'
    ],
    category: 'analytics',
    description: 'B2B multi-touch attribution platform tracking page views, form-capture email identification, browser fingerprinting and reverse-IP account de-anonymisation.',
    url: 'https://calibermind.com',
    color: '#001022',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-22'
  },
  {
    id: 'chartbeat',
    name: 'Chartbeat',
    shortName: 'Chartbeat',
    patterns: [
      'static.chartbeat.com',
      'ping.chartbeat.net'
    ],
    category: 'analytics',
    description: 'Real-time content analytics for publishers and editorial teams.',
    url: 'https://chartbeat.com',
    color: '#46a0ff',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'clicky',
    name: 'Clicky',
    shortName: 'Clicky',
    patterns: [
      'static.getclicky.com',
      'in.getclicky.com',
      'getclicky.com/js',
      'clicky.com/js'
    ],
    category: 'analytics',
    description: 'Real-time web analytics with heatmaps, uptime monitoring, and individual visitor tracking.',
    url: 'https://clicky.com',
    color: '#2e7bc9',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'cnzz',
    name: 'CNZZ (Umeng+)',
    shortName: 'CNZZ',
    patterns: [
      '.cnzz.com'
    ],
    category: 'analytics',
    description: 'China\'s most widely-used web analytics platform, owned by Alibaba Group (merged into Umeng+ in 2016).',
    url: 'https://www.umeng.com/',
    color: '#1677FF',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-19'
  },
  {
    id: 'cloudflare-analytics',
    name: 'Cloudflare Analytics',
    shortName: 'Cloudflare Analytics',
    patterns: [
      'static.cloudflareinsights.com',
      'cloudflareinsights.com/beacon.min.js'
    ],
    category: 'analytics',
    description: 'Privacy-first, cookie-free analytics included free with Cloudflare.',
    url: 'https://www.cloudflare.com/web-analytics/',
    color: '#f38020',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'cludo',
    name: 'Cludo',
    shortName: 'Cludo',
    patterns: [
      // Search widget bundle + per-customer CSS templates served from customer.cludo.com.
      // Path-scoped to /scripts/ because the apex also serves CSS/templates under /css/.
      'customer.cludo.com/scripts/',
      // querylog + clicklog tracking beacons:
      // api.cludo.com/api/v3/<CustomerID>/<EngineID>/search/pushstat/{querylog,clicklog}
      // /api/v3/ prefix is tracking-only; the search API uses different paths.
      'api.cludo.com/api/v3/'
    ],
    category: 'analytics',
    description: 'Danish site-search SaaS — tracks search queries (querylog) and result click-throughs (clicklog) for the customer\'s Cludo Analytics dashboard.',
    url: 'https://www.cludo.com',
    color: '#1d3557',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-26'
  },
  {
    id: 'comscore',
    name: 'Comscore',
    shortName: 'Comscore',
    patterns: [
      'b.scorecardresearch.com',
      'sb.scorecardresearch.com',
      'comscore.com/beacon',
      'zqtk.net'
    ],
    category: 'analytics',
    description: 'Cross-platform audience measurement for media planning and currency.',
    url: 'https://www.comscore.com',
    color: '#E4282A',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'converge',
    name: 'Converge',
    shortName: 'Converge',
    patterns: [
      'app.runconverge.com',
      'static.runconverge.com'
    ],
    category: 'analytics',
    description: 'DTC e-commerce conversion tracking, multi-touch attribution, and server-side CAPI platform (YC S23). Pixel installed via theme.liquid on Shopify storefronts.',
    url: 'https://www.runconverge.com',
    color: '#000000',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'countly',
    name: 'Countly',
    shortName: 'Countly',
    patterns: [
      'count.ly',
      'api.count.ly',
      'countly.io'
    ],
    category: 'analytics',
    description: 'Open-source product analytics with crash reporting and push notifications for mobile and web.',
    url: 'https://count.ly',
    color: '#2CAE5C',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'dimml',
    name: 'DimML',
    shortName: 'DimML',
    patterns: [
      'cdn.dimml.io',
      '.dimml.io'
    ],
    category: 'analytics',
    description: 'Real-time data analytics platform using DimML (Data in Motion Machine Language) for event collection, sessionization, and predictive analytics.',
    url: 'https://www.dimml.io',
    color: '#0096DA',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-06'
  },
  {
    id: 'dreamdata',
    name: 'Dreamdata',
    shortName: 'Dreamdata',
    patterns: [
      'cdn.dreamdata.cloud',
      'evs.s.dreamdata.io',
      'api.dreamdata.cloud'
    ],
    category: 'analytics',
    description: 'B2B revenue attribution platform collecting customer journey data for multi-touch attribution.',
    url: 'https://dreamdata.io',
    color: '#002B6D',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-19'
  },
  {
    id: 'dotmetrics',
    name: 'DotMetrics (Sirdata)',
    shortName: 'DotMetrics',
    patterns: [
      'uk-script.dotmetrics.net',
      'rm-script.dotmetrics.net',
      'dotmetrics.net',
      /[a-z]{2}-script\.dotmetrics\.net/
    ],
    category: 'analytics',
    description: 'Cross-device audience measurement for publishers. Now part of Sirdata.',
    url: 'https://www.dotmetrics.net',
    color: '#004f9f',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'dub',
    name: 'Dub',
    shortName: 'Dub',
    patterns: ['dubcdn.com'],
    category: 'analytics',
    description: 'Modern link management platform with built-in conversion analytics — dub.co\'s tracking script ships from www.dubcdn.com.',
    url: 'https://dub.co',
    color: '#000000',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-15'
  },
  {
    id: 'etracker',
    name: 'etracker',
    shortName: 'etracker',
    patterns: [
      'srv.etracker.com',
      'code.etracker.com',
      'static.etracker.com',
      'cnt.etracker.de'
    ],
    category: 'analytics',
    description: 'German privacy-focused web analytics with consent-free mode, dominant on DACH region publishers and retailers.',
    url: 'https://www.etracker.com',
    color: '#f24e1e',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'factors-ai',
    name: 'Factors.ai',
    shortName: 'Factors.ai',
    patterns: [
      'api.factors.ai/sdk',
      'app.factors.ai/assets/factors.js'
    ],
    category: 'analytics',
    description: 'AI-powered B2B account intelligence and ABM platform tracking website visitors at account level.',
    url: 'https://www.factors.ai',
    color: '#f94d00',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-19'
  },
  {
    id: 'fathom',
    name: 'Fathom',
    shortName: 'Fathom',
    patterns: [
      'usefathom.com',
      'cdn.usefathom.com'
    ],
    category: 'analytics',
    description: 'Privacy-focused, cookie-free web analytics compliant with GDPR without consent.',
    url: 'https://usefathom.com',
    color: '#9482ff',
    colorVerified: true,
    textColor: '#7c6be6',
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'flixmedia',
    name: 'Flixmedia',
    shortName: 'Flix',
    // Measurement is a separate host pair from the content CDN: media.flixcar.com serves
    // shopper-visible minisite HTML, images and loader.js and is deliberately NOT matched.
    patterns: [
      'rt.flix360.com',
      't.flix360.com'
    ],
    category: 'analytics',
    description: 'Content-syndication network delivering brand product content to retailer product pages and reporting shopper engagement back to brands via its Measure Effect analytics.',
    url: 'https://www.flixmedia.com/',
    color: '#2CCD6F',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'freshpaint',
    name: 'Freshpaint',
    shortName: 'Freshpaint',
    patterns: [
      'perfalytics.com',
      'freshpaint.io',
      'api.freshpaint.io'
    ],
    category: 'analytics',
    description: 'Customer data platform focused on healthcare with HIPAA compliance and auto-capture.',
    url: 'https://www.freshpaint.io',
    color: '#ee5757',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'ga-connector',
    name: 'GA Connector',
    shortName: 'GA Connector',
    patterns: [
      'track.gaconnector.com',
      'tracker.gaconnector.com'
    ],
    category: 'analytics',
    description: 'Attribution layer bridging Google Analytics 4 with CRMs (Salesforce, HubSpot, Pipedrive, Zoho, MS Dynamics) — captures visitor and campaign attribution data via form-input listeners and pushes closed-deal data back to GA4 for revenue attribution.',
    url: 'https://gaconnector.com',
    color: '#1f88ff',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-18'
  },
  {
    id: 'ga-universal',
    name: 'Google Analytics Universal',
    shortName: 'GA Universal',
    patterns: [
      'google-analytics.com/collect'
    ],
    category: 'analytics',
    description: 'Legacy session-based analytics (standard properties sunset July 2023; 360 properties July 2024), replaced by GA4.',
    url: 'https://support.google.com/analytics/answer/11583528',
    color: '#e37400',
    colorVerified: true,
    iconVerified: true,
    consumesGCM: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    shortName: 'GA4',
    patterns: [
      'google-analytics.com/g/collect',
      'analytics.google.com/g/collect',
      'google-analytics.com/r/collect',
      'google-analytics.com/mp/collect',
      'google-analytics.com/debug/mp/collect',
      'region1.google-analytics.com',
      'region2.google-analytics.com',
      'region1.analytics.google.com',
      'region2.analytics.google.com',
      /googletagmanager\.com\/a\?/,  // GA4 via GTM proxy
      // GA4 routed through Google Consent Mode transport (/ccm/collect with G-* measurement id).
      // Mirrors the dispatch in parsers/google-ccm.js so the diff engine and badge scanner
      // attribute the URL to the destination platform, not the transport. See BUG22.
      // Tested against the RAW URL (see matchSinglePattern in url-patterns.js), so the
      // uppercase `G-` discriminator matches as-is. The `i` flag is defensive only —
      // it keeps the disambiguation correct even if a future matcher lowercases first.
      /google\.com\/ccm\/collect\?[^]*tids?=G-/i,
      // GA4 Measurement Protocol v2 served from DoubleClick when Google Signals is enabled.
      // Same gtag() call emits a copy of the hit to stats.g.doubleclick.net so advertising
      // features (Remarketing, demographics, cross-device) can join the event to the user's
      // Google ads identity. tid=G-* is the unambiguous GA4 discriminator.
      'stats.g.doubleclick.net/g/collect'
    ],
    category: 'analytics',
    description: 'Event-based analytics with cross-platform tracking and BigQuery export.',
    url: 'https://analytics.google.com',
    color: '#e37400',
    colorVerified: true,
    iconVerified: true,
    parsing: { customParser: true, formattedParser: true },
    consumesGCM: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-05-26'
  },
  {
    id: 'gainsight-px',
    name: 'Gainsight PX',
    shortName: 'Gainsight PX',
    patterns: [
      'web-sdk.aptrinsic.com',
      'api.aptrinsic.com',
      'aptrinsic.com'
    ],
    category: 'analytics',
    description: 'Product experience platform for in-app engagement, analytics, and user feedback.',
    url: 'https://www.gainsight.com/product-experience/',
    color: '#38a2ff',
    colorVerified: true,
    iconVerified: true, // Official icon: gainsight.com/icon.svg
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'gemius',
    name: 'Gemius',
    shortName: 'Gemius',
    patterns: [
      /[a-z]+\.hit\.gemius\.pl/,
      'gemius.pl'
    ],
    category: 'analytics',
    description: 'European audience measurement and cross-media analytics platform.',
    url: 'https://www.gemius.com',
    color: '#00a651',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'glimr',
    name: 'Glimr',
    shortName: 'Glimr',
    patterns: [
      'glimr.io',
      'pixel.glimr.io'
    ],
    category: 'analytics',
    description: 'B2B audience intelligence for company identification and IP enrichment.',
    url: 'https://glimr.io',
    color: '#6743ff',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'global-e',
    name: 'Global-e',
    shortName: 'Global-e',
    // GEO-GATED: only injects for out-of-market visitors, so a capture from a domestic IP
    // shows nothing. globale-analytics-sdk is the true analytics beacon; the rest are the
    // localisation/checkout tier that still identifies Global-e presence.
    patterns: [
      'globale-analytics-sdk.global-e.com',
      'webservices.global-e.com',
      'checkout-service.global-e.com',
      'web.global-e.com',
      'gepi.global-e.com',
      'utils.global-e.com'
    ],
    category: 'analytics',
    description: 'Cross-border e-commerce localisation whose client SDK captures browsing sessions, attribution and A/B allocation, and hosts localised checkout on its own domain.',
    url: 'https://www.global-e.com/',
    color: '#F15A2C',
    colorVerified: false,
    iconVerified: true,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'gosquared',
    name: 'GoSquared',
    shortName: 'GoSquared',
    patterns: [
      'd1l6p2sc9645hc.cloudfront.net',
      'gosquared.com',
      'data.gosquared.com'
    ],
    category: 'analytics',
    description: 'Real-time web analytics and live chat with visitor identification and CRM features.',
    url: 'https://www.gosquared.com',
    color: '#0095ff',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'goatcounter',
    name: 'GoatCounter',
    shortName: 'GoatCounter',
    patterns: [
      '.goatcounter.com/count',
      'gc.zgo.at/count'
    ],
    category: 'analytics',
    description: 'Open-source, privacy-friendly web analytics — no cookies, no personal data tracking, lightweight ~3.5KB script.',
    url: 'https://www.goatcounter.com',
    color: '#9a15a4',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-06'
  },
  {
    id: 'google-merchant-center',
    name: 'Google Merchant Center',
    shortName: 'Google Merchant',
    patterns: [
      'merchant-center-analytics.goog'
    ],
    category: 'analytics',
    description: 'Google Merchant Center key-event / conversion tracking endpoint — receives purchase and key-event data via gtag.js when a site uses Merchant Center as a Google tag destination (separate from GA4 and Google Ads).',
    url: 'https://support.google.com/merchants/answer/15322730',
    color: '#4285F4',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-05'
  },
  {
    id: 'heap',
    name: 'Heap Analytics',
    shortName: 'Heap',
    patterns: [
      'heapanalytics.com',
      'cdn.heapanalytics.com',
      'track.heap.io',
      'api.heap.io',
      'c.us.heap-api.com',
      'c.eu.heap-api.com',
      'events.rm-api.com',
      'assets.rm-api.com'
    ],
    category: 'analytics',
    parsing: { customParser: true, formattedParser: true },
    description: 'Auto-capture analytics that retroactively tracks all user interactions without manual instrumentation.',
    url: 'https://heap.io',
    color: '#100841',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'indicative',
    name: 'Indicative',
    shortName: 'Indicative',
    patterns: [
      'api.indicative.com',
      'indicative.com'
    ],
    category: 'analytics',
    description: 'Product analytics with multi-path funnel analysis and customer journey mapping (now mParticle).',
    url: 'https://www.indicative.com',
    color: '#20007a',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'issuu',
    name: 'Issuu',
    shortName: 'Issuu',
    patterns: [
      'pingback.issuu.com'
    ],
    category: 'analytics',
    description: 'Issuu embed pingback — anonymously reports reads, time-spent, and load-time statistics for Issuu digital publications embedded on third-party sites.',
    url: 'https://issuu.com',
    color: '#F36D5D',
    colorVerified: false,
    iconVerified: true,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-11'
  },
  {
    id: 'iterate',
    name: 'Iterate',
    shortName: 'Iterate',
    patterns: [
      'iteratehq.com',
      'platform.iteratehq.com'
    ],
    category: 'analytics',
    description: 'In-product survey and feedback tool for NPS, CSAT, and user research.',
    url: 'https://iteratehq.com',
    color: '#6c63ff',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'jetpack-stats',
    name: 'Jetpack Stats',
    shortName: 'Jetpack Stats',
    patterns: [
      'pixel.wp.com/g.gif'
    ],
    category: 'analytics',
    description: 'Automattic first-party traffic analytics pixel for WordPress.com-hosted and Jetpack-connected WordPress sites.',
    url: 'https://jetpack.com/stats/',
    color: '#069E08',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-11'
  },
  {
    id: 'kilkaya',
    name: 'Kilkaya',
    shortName: 'Kilkaya',
    patterns: [
      'k5a.io',
      'kilkaya.com/api'
    ],
    category: 'analytics',
    description: 'Real-time content analytics platform for publishers with AI-powered personalization and engagement optimization.',
    url: 'https://www.kilkaya.com',
    color: '#eea41d',
    colorVerified: true,
    textColor: '#8a5e0f',
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'kissmetrics',
    name: 'Kissmetrics',
    shortName: 'Kissmetrics',
    patterns: [
      'kissmetrics.com',
      'doug1izaerwt3.cloudfront.net',
      'trk.kissmetrics.io',
      'i.kissmetrics.io'
    ],
    category: 'analytics',
    description: 'Behavioral analytics linking every action to a person for SaaS and e-commerce optimization.',
    url: 'https://www.kissmetrics.io',
    color: '#4652ff',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'koala',
    name: 'Koala',
    shortName: 'Koala',
    patterns: [
      'api.getkoala.com',
      'cdn.getkoala.com',
      'getkoala.com'
    ],
    category: 'analytics',
    description: 'B2B intent signal platform that identifies companies and buying intent from website visits.',
    url: 'https://www.getkoala.com',
    color: '#4D32E4',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'lead-forensics',
    name: 'Lead Forensics',
    shortName: 'Lead Forensics',
    patterns: [
      'ldynamicspublicapi.leadforensics.com',
      'webeo-web-content.s3-eu-west-1.amazonaws.com'
    ],
    category: 'analytics',
    description: 'B2B website-visitor identification via reverse-IP lookup against a proprietary B2B IP database. Includes the Webeo on-site personalization arm sharing the same infrastructure (core tracker loaded from webeo-web-content.s3-eu-west-1.amazonaws.com). Competitor to Leadfeeder/Dealfront. Customer cloaks (`secure.<customer>.com`) are single-tenant and not enumerable; this entry covers the apex-stable tracking endpoints.',
    url: 'https://www.leadforensics.com',
    color: '#0a1f44',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-18'
  },
  {
    id: 'leadfeeder',
    name: 'Leadfeeder (Dealfront)',
    shortName: 'Leadfeeder',
    patterns: [
      'sc.lfeeder.com',
      'lftracker.leadfeeder.com',
      'tr.lfeeder.com'
    ],
    category: 'analytics',
    description: 'B2B website visitor identification — reveals which companies visit your site via reverse IP lookup and intent scoring. Ships as the unified Dealfront tracker after the 2022 Leadfeeder + Echobot merger; Dealfront rebranded back to Leadfeeder in March 2026.',
    url: 'https://www.dealfront.com',
    color: '#6dcc69',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-18',
    updatedDate: '2026-05-19'
  },
  {
    id: 'limy',
    name: 'Limy Analytics',
    shortName: 'Limy',
    // Apex getlimy.ai deliberately excluded. Only SVG the vendor ships is a wordmark
    // lockup, so this uses a monogram fallback.
    patterns: [
      'analytics.getlimy.ai',
      'sdk.getlimy.ai',
      'stream.getlimy.ai'
    ],
    category: 'analytics',
    description: 'AI-visibility analytics tracking AI-bot crawls and referral traffic from ChatGPT, Gemini and Perplexity, attributing on-site behaviour back to AI search visibility.',
    url: 'https://limy.ai/',
    color: '#6B5CD6',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'mapp',
    name: 'Mapp/Webtrekk',
    shortName: 'Mapp/Webtrekk',
    patterns: [
      'micpn.com',
      '.micpn.com',
      'mapp.com',
      'webtrekk.com',
      'wt-eu02.net',
      'wt-safetag.com'
    ],
    category: 'analytics',
    description: 'Marketing cloud combining analytics, cross-channel automation, and customer insights.',
    url: 'https://mapp.com',
    color: '#fc4482',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'marfeel',
    name: 'Marfeel',
    shortName: 'Marfeel',
    // The collection host uses the newsroom.bi domain hack, which is why it reads as an
    // unrelated vendor in tools_unknown. Not a mistake -- do not 'correct' it to marfeel.com.
    // Excluded: .marfeel.com (marketing + hub. dashboard), live./flowcards.mrf.io (rendering).
    patterns: [
      'events.newsroom.bi',
      'sdk.mrf.io'
    ],
    category: 'analytics',
    description: 'Publisher content analytics and audience intelligence tracking page views, engagement time, Core Web Vitals and on-page recirculation.',
    url: 'https://www.marfeel.com/',
    color: '#FF8200',
    colorVerified: false,
    iconVerified: true,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'matomo',
    name: 'Matomo/Piwik',
    shortName: 'Matomo',
    patterns: [
      '/matomo.php',
      /^(?!.*piwik\.pro).*\/piwik\.php/,
      '/matomo.js',
      /^(?!.*piwik\.pro).*\/piwik\.js/
    ],
    category: 'analytics',
    parsing: { customParser: true, formattedParser: true },
    description: 'Open-source, self-hosted web analytics with full data ownership.',
    url: 'https://matomo.org',
    color: '#3152a0',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'maze',
    name: 'Maze',
    shortName: 'Maze',
    patterns: [
      'snippet.maze.co',
      'prompts.maze.co',
      'api.maze.co',
      't.maze.co'
    ],
    category: 'analytics',
    description: 'User research and unmoderated testing platform — in-product surveys, prompts, and website usability tests via an embedded snippet.',
    url: 'https://maze.co',
    color: '#0568FD',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-28'
  },
  {
    id: 'medietall',
    name: 'Medietall (NAMP)',
    shortName: 'Medietall',
    patterns: [
      'log.medietall.no',
      'medietall.no'
    ],
    category: 'analytics',
    description: 'Official Norwegian audience measurement panel (Norsk Akseptert Mediemåling). Industry standard for Norwegian publishers.',
    url: 'https://www.medietall.no',
    color: '#003366',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'melidata',
    name: 'Melidata',
    shortName: 'Melidata',
    // Do NOT add http2.mlstatic.com: it is MELI's general static CDN (product images, CSS,
    // fonts) and would fire on every Mercado Libre page view. Only the melidata. collectors
    // are tracking-only. Monogram icon: Simple Icons carries only the Mercado Pago mark, and
    // this collector serves the marketplace half too, so the sub-brand logo would mislabel it.
    // Colour is Mercado Libre's brand yellow per the Brandfetch brand record.
    // Host completeness (2026-08-04): the Mercado Pago SDK (sdk.mercadopago.com/js/v2) posts
    // melidata events to api.mercadolibre.com/tracks, NOT to the melidata.* collectors, so
    // merchant-site checkout telemetry was falling through to tools_unknown. Path-scoped
    // deliberately -- a bare api.mercadolibre.com is the whole public marketplace REST API
    // (Items, Orders, Search, Payments) and would flag every legitimate commerce call as
    // tracking. /tracks and /melidata are collector-only; no MELI REST resource uses either.
    patterns: [
      'melidata.mercadolibre.com',
      'melidata.mercadopago.com',
      'api.mercadolibre.com/tracks',
      'api.mercadolibre.com/melidata'
    ],
    category: 'analytics',
    description: 'Mercado Libre\'s in-house event-collection platform, embedded on MELI and Mercado Pago properties and on merchant sites via the Mercado Pago checkout plugin.',
    url: 'https://www.mercadolibre.com',
    color: '#FFF159',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21',
    updatedDate: '2026-08-04'
  },
  {
    id: 'mixpanel',
    name: 'Mixpanel',
    shortName: 'Mixpanel',
    patterns: [
      'api.mixpanel.com',
      'api-eu.mixpanel.com',
      'api-in.mixpanel.com',
      'mixpanel.com/track',
      'mixpanel.com/engage',
      'decide.mixpanel.com',
      'api-js.mixpanel.com',
      'cdn.mxpnl.com',
      'mxpnl.com'
    ],
    category: 'analytics',
    description: 'Event-based product analytics with funnel analysis, retention, and A/B testing.',
    url: 'https://mixpanel.com',
    color: '#a086d3',
    colorVerified: true,
    iconVerified: true,
    parsing: { customParser: true, formattedParser: true },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'naver-analytics',
    name: 'Naver Analytics',
    shortName: 'Naver',
    patterns: [
      'wcs.naver.net',
      'wcs.naver.com'
    ],
    category: 'analytics',
    description: 'Web analytics and ad conversion tracking platform from Naver, South Korea\'s dominant search engine.',
    url: 'https://analytics.naver.com',
    color: '#03C75A',
    colorVerified: true,
    iconVerified: true, // Simple Icons: Naver
    addedInVersion: '1.0.0',
    addedDate: '2026-03-19'
  },
  {
    id: 'netlify-analytics',
    name: 'Netlify Analytics',
    shortName: 'Netlify Analytics',
    patterns: [
      'netlify-cdp-loader.netlify.app'
    ],
    category: 'analytics',
    description: 'Server-side analytics for Jamstack sites without client-side JavaScript.',
    url: 'https://www.netlify.com/products/analytics/',
    color: '#00c7b7',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'nielsen',
    name: 'Nielsen',
    shortName: 'Nielsen',
    patterns: [
      'imrworldwide.com',
      'secure-us.imrworldwide.com'
    ],
    category: 'analytics',
    description: 'Audience measurement and media ratings for TV, digital, and cross-platform.',
    url: 'https://www.nielsen.com',
    color: '#6E37FA',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'oracle-infinity',
    name: 'Oracle Infinity',
    shortName: 'Oracle Infinity',
    patterns: [
      'oracleinfinity.io',
      'c.oracleinfinity.io',
      'd.oracleinfinity.io',
      'dc.oracleinfinity.io'
    ],
    category: 'analytics',
    description: 'Enterprise behavioral intelligence and web analytics platform, integrated with Oracle Unity CDP.',
    url: 'https://www.oracle.com/cx/marketing/digital-intelligence/',
    color: '#F80000',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'openpanel',
    name: 'OpenPanel',
    shortName: 'OpenPanel',
    patterns: [
      'api.openpanel.dev/track',
      'openpanel.dev/op.js'
    ],
    category: 'analytics',
    description: 'Open-source product analytics combining Mixpanel-style event tracking with Plausible-style simplicity.',
    url: 'https://openpanel.dev',
    color: '#3B82F6',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-06'
  },
  {
    id: 'parsely',
    name: 'Parse.ly',
    shortName: 'Parse.ly',
    patterns: [
      'parse.ly/plogger',
      'cdn.parsely.com',
      'srv.pixel.parsely.com',
      'pixel.parsely.com'
    ],
    category: 'analytics',
    description: 'Content analytics platform owned by WordPress/Automattic for publishers and media companies.',
    url: 'https://www.parse.ly',
    color: '#70A452',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'pendo',
    name: 'Pendo',
    shortName: 'Pendo',
    patterns: [
      'cdn.pendo.io',
      'app.pendo.io',
      'data.pendo.io',
      /pendo-static-\d+/
    ],
    category: 'analytics',
    parsing: { customParser: true, formattedParser: true },
    description: 'Combines retroactive analytics with in-app guides and NPS surveys to drive feature adoption without code deployments.',
    url: 'https://www.pendo.io',
    color: '#ec2059',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'piano-analytics',
    name: 'Piano Analytics',
    shortName: 'Piano Analytics',
    patterns: [
      'pa.piano.io',
      'api.piano.io',
      'xiti.com',
      'at-o.net',
      'aticdn.net'
    ],
    category: 'analytics',
    parsing: { customParser: true, formattedParser: true },
    description: 'European analytics platform (formerly AT Internet) with privacy-first approach and real-time insights.',
    url: 'https://piano.io/product/analytics/',
    color: '#C8192E',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'pirsch',
    name: 'Pirsch Analytics',
    shortName: 'Pirsch',
    patterns: [
      'api.pirsch.io/hit',
      'api.pirsch.io/event',
      'api.pirsch.io/api/v1/hit'
    ],
    category: 'analytics',
    description: 'Privacy-first, server-side web analytics — cookieless, lightweight, GDPR-compliant by design.',
    url: 'https://pirsch.io',
    color: '#2dbc8a',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-06'
  },
  {
    id: 'piwik-pro',
    name: 'Piwik Pro Analytics',
    shortName: 'Piwik Pro Analytics',
    patterns: [
      'piwik.pro/ppms.php',
      'piwik.pro/piwik.php'
    ],
    category: 'analytics',
    parsing: { customParser: true, formattedParser: true },
    description: 'Privacy-focused analytics suite with built-in consent management. Commercial fork of Piwik (now Matomo) — uses the same Tracking API protocol with UUID site IDs.',
    url: 'https://piwik.pro/web-analytics/',
    color: '#0254c0',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-03'
  },
  {
    id: 'pixall',
    name: 'Pixall',
    shortName: 'Pixall',
    // esm1.net is Dealer.com's opaque infrastructure apex; the dealer.com brand apex carries
    // marketing + a dealer-facing admin console and is deliberately NOT registered. Enumerated
    // to exclude -dev/-qa staging and update.esm1.net. Pixall has no logo of its own.
    // Colour is Dealer.com's accent per the Brandfetch brand record (Pixall has no brand
    // of its own).
    patterns: [
      'pixall.esm1.net',
      'pixw.esm1.net',
      'pixall-fp.esm1.net'
    ],
    category: 'analytics',
    description: 'Dealer.com (Cox Automotive) shopper-behaviour analytics for automotive dealership websites, scoring each shopper for purchase intent.',
    url: 'https://www.dealer.com/solutions/analytics/',
    color: '#ff8210',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'plausible',
    name: 'Plausible',
    shortName: 'Plausible',
    patterns: [
      'plausible.io/api/event',
      // Self-hosted instances: the tracker derives its endpoint from its own script
      // origin, so `plausible.<anything>/api/event` is structurally guaranteed.
      // Unanchored on purpose - matchSinglePattern tests the FULL url incl. scheme,
      // so a ^ anchor could never fire. Host alone would be unsafe (it would flag the
      // instance's own /sites, /login dashboard), hence the conjunction with the path.
      /plausible\.[a-z0-9.-]+\/api\/event/,
      /plausible\.[a-z0-9.-]+\/js\/script/
    ],
    category: 'analytics',
    description: 'Lightweight, privacy-friendly analytics (under 1KB) that is GDPR-compliant without consent.',
    url: 'https://plausible.io',
    color: '#4b38d8',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-07-21'
  },
  {
    id: 'polar-analytics',
    name: 'Polar Analytics',
    shortName: 'Polar',
    patterns: [
      'api-production.polaranalytics.com',
      'cdn-production.polaranalytics.com'
    ],
    category: 'analytics',
    description: 'E-commerce analytics and first-party tracking pixel for Shopify (Lifetime ID, cross-device journey stitching, server-side CAPI).',
    url: 'https://www.polaranalytics.com',
    color: '#1E1E2E',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'poool',
    name: 'Poool',
    shortName: 'Poool',
    patterns: [
      'api.poool.fr',
      'assets.poool.fr',
      'cdn.poool.fr'
    ],
    category: 'analytics',
    description: 'French paywall and subscription-conversion platform for publishers — tracks paywall impressions, dismissals, and subscription conversions via Access.js and Audit.js SDKs.',
    url: 'https://www.poool.fr',
    color: '#0066FF',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-11'
  },
  {
    id: 'posthog',
    name: 'PostHog',
    shortName: 'PostHog',
    patterns: [
      'us.i.posthog.com',
      'eu.i.posthog.com',
      'app.posthog.com',
      'posthog.com/e',
      'posthog.com/capture',
      'posthog.com/batch',
      'posthog.com/flags',
      'posthog.com/decide',
      't.posthog.com',
      'us.posthog.com',
      'eu.posthog.com'
    ],
    category: 'analytics',
    description: 'Open-source product analytics with session replay, feature flags, and A/B testing.',
    url: 'https://posthog.com',
    color: '#F7A501',
    colorVerified: true,
    textColor: '#c48500',
    iconVerified: true,
    parsing: { customParser: true, formattedParser: true },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'promptwatch',
    name: 'Promptwatch',
    shortName: 'Promptwatch',
    // One host serves both the SDK (/js/client.min.js) and the collection, so a single
    // pattern covers the whole surface. Never widen to a .promptwatch.com apex: the apex and
    // www. are marketing + docs, app. is the customer dashboard, server. is the API-key REST
    // API, sso-auth./sso-setup. are auth. NAME COLLISION: unrelated to PromptWatch.io, a
    // server-side Python LLM-tracing library that never touches a page.
    patterns: [
      'ingest.promptwatch.com'
    ],
    category: 'analytics',
    description: 'AI search visibility (GEO) platform whose Visitor Analytics tag attributes and measures human traffic referred from ChatGPT, Perplexity, Claude, Gemini and AI Overviews.',
    url: 'https://promptwatch.com',
    color: '#101828',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.2',
    addedDate: '2026-08-04'
  },
  {
    id: 'qualtrics',
    name: 'Qualtrics',
    shortName: 'Qualtrics',
    patterns: [
      'siteintercept.qualtrics.com',
      'zn_2.qualtrics.com',
      /[a-z0-9]+\.siteintercept\.qualtrics\.com/
    ],
    category: 'analytics',
    description: 'Experience management platform for surveys, website feedback, and customer insights.',
    url: 'https://www.qualtrics.com',
    color: '#0768DD',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'quantcast',
    name: 'Quantcast',
    shortName: 'Quantcast',
    patterns: [
      'pixel.quantserve.com',
      'secure.quantserve.com',
      'cms.quantserve.com',
      'auconsent.quantserve.com',
      'rules.quantcount.com',
      'quantcast.com/pixel'
    ],
    category: 'analytics',
    description: 'Audience measurement and real-time advertising with AI-powered insights.',
    url: 'https://www.quantcast.com',
    color: '#316b6f',
    colorVerified: true,
    textColor: '#c99700',
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'raffle-ai',
    name: 'Raffle.ai',
    shortName: 'Raffle',
    // CATEGORY: analytics, following the algolia-insights and searchspring precedent (site-search
    // vendors are filed by what their beacon measures, not by the on-page widget).
    // NO APEX WILDCARD: raffle.ai + business.raffle.ai are marketing, app.raffle.ai is the
    // customer login/dashboard, docs.raffle.ai is documentation.
    // search-backend. (the v1/events beacon) and api. (v2/search + v2/feedback) were NOT in the
    // observed sweep set - they were recovered from the SDK bundle and vendor docs and registered
    // pre-emptively per host-completeness discipline. Treat their first live sighting as the
    // confirmation. All *.staging.raffle.ai and the unverified rofl*/pwa/ds-queue hosts excluded.
    patterns: [
      '//cdn.raffle.ai/',
      '//searchcfg.raffle.ai/',
      '//search-backend.raffle.ai/',
      '//api.raffle.ai/'
    ],
    category: 'analytics',
    description: 'Danish AI site-search and answer-engine widget that captures search queries, clicks and session data for its Insights analytics dashboard.',
    url: 'https://raffle.ai',
    color: '#FF385D',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-22'
  },
  {
    id: 'reaktion',
    name: 'Reaktion',
    shortName: 'Reaktion',
    patterns: [
      'api.reaktion.com'
    ],
    category: 'analytics',
    description: 'Ecommerce server-side tracking and profit analytics that captures orders/events and forwards profit-enriched conversions to ad platforms, GA4, and Klaviyo.',
    url: 'https://reaktion.com',
    color: '#101820',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.1',
    addedDate: '2026-06-02'
  },
  {
    id: 'realtimestack',
    name: 'RealtimeStack',
    shortName: 'RealtimeStack',
    patterns: [
      'events.v3.realtimestack.com'
    ],
    category: 'analytics',
    description: 'Real-time visitor and e-commerce analytics for Shopify stores, operated by Spritefish (Denmark).',
    url: 'https://apps.shopify.com/realtime-view',
    color: '#1a1a1a',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-11'
  },
  {
    id: 'recharge',
    name: 'Recharge',
    shortName: 'Recharge',
    patterns: [
      'static.rechargecdn.com',
      'rechargepayments.com',
      'rechargeapps.com'
    ],
    category: 'marketing-automation',
    description: 'Subscription billing and management for Shopify recurring-revenue merchants.',
    url: 'https://rechargepayments.com',
    color: '#3901F1',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'reo-dev',
    name: 'Reo.Dev',
    shortName: 'Reo',
    patterns: ['api.reo.dev', 'static.reo.dev'],
    category: 'analytics',
    description: 'Developer-marketing analytics platform that tracks first-party developer-activity signals (docs, product, website) for B2B dev-tool GTM intent scoring.',
    url: 'https://www.reo.dev',
    color: '#7C3AED',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-15'
  },
  {
    id: 'route',
    name: 'Route',
    shortName: 'Route',
    // NEVER wildcard .route.com: the apex carries marketing, the merchant dashboard, the
    // CONSUMER package-tracking app (tracking.), returns portals and two support centres.
    // wobs. is a dedicated beacon -- its root 404s and only /collect is live.
    patterns: [
      'wobs.route.com',
      'shopify-widget.route.com'
    ],
    category: 'analytics',
    description: 'Post-purchase e-commerce platform (shipping protection, package tracking, returns) whose cart and checkout widget beacons browser-side events from merchant storefronts.',
    url: 'https://www.route.com',
    color: '#53E6E6',
    colorVerified: false,
    iconVerified: true,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'schibsted',
    name: 'Schibsted/Adevinta',
    shortName: 'Schibsted',
    patterns: [
      'm10s.io',
      'dc.m10s.io',
      'adevinta.com'
    ],
    category: 'analytics',
    description: 'Nordic media company proprietary analytics for marketplace and publishing properties.',
    url: 'https://www.adevinta.com',
    color: '#000000',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'searchspring',
    name: 'Searchspring',
    shortName: 'Searchspring',
    // Two apexes, different roles. searchspring.io = shopper-side serving/collection.
    // searchspring.net = merchant-facing (manage. console, help. desk) EXCEPT cdn., which
    // serves both the IntelliSuggest tracker and doc images -- hence the path scope.
    patterns: [
      'beacon.searchspring.io',
      '.a.searchspring.io',
      'snapui.searchspring.io',
      'cdn.searchspring.net/intellisuggest/'
    ],
    category: 'analytics',
    description: 'E-commerce site search, merchandising and personalisation whose Beacon API collects searches, product clicks, cart adds and purchases.',
    url: 'https://searchspring.com',
    color: '#4C3CE2',
    colorVerified: false,
    iconVerified: true,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'segmetrics',
    name: 'SegMetrics',
    shortName: 'SegMetrics',
    patterns: [
      'tag.segmetrics.io',
      'track.segmetrics.io'
    ],
    category: 'analytics',
    description: 'Marketing attribution and lead tracking for info-product and course businesses.',
    url: 'https://segmetrics.io',
    color: '#3B5BDB',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-19'
  },
  {
    id: 'sensors-data',
    name: 'Sensors Data',
    shortName: 'Sensors',
    patterns: [
      'static.sensorsdata.cn',
      '.datasink.sensorsdata.cn',
      '.cloud.sensorsdata.cn',
      'sensorsdata.com',
      'sensorsdata.cn'
    ],
    category: 'analytics',
    description: 'Chinese product analytics and CDP platform providing behavioral analytics and marketing automation for enterprises.',
    url: 'https://www.sensorsdata.com/',
    color: '#0052D9',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-19'
  },
  {
    id: 'shift-digital',
    name: 'Shift Digital Tagging',
    shortName: 'Shift Digital',
    // Loader: tagging.shiftdigitalapps.io/scripts/sd.js?containerId=<id>. The apex is an
    // Azure-fronted app-hosting apex likely carrying dealer/OEM dashboards on siblings --
    // do NOT wildcard. shiftdigital.com is marketing/legal only.
    // Colour: the logo file uses #f8971d but both the site CSS and the Brandfetch brand
    // record report #ff8200 as the accent -- two sources against one, so #ff8200 wins.
    patterns: [
      'tagging.shiftdigitalapps.io'
    ],
    category: 'analytics',
    description: 'Automotive-vertical analytics and tagging platform deployed across OEM dealer networks for visitor-journey tracking and campaign measurement.',
    url: 'https://www.shiftdigital.com/',
    color: '#ff8200',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'shopify-analytics',
    name: 'Shopify Analytics',
    shortName: 'Shopify Analytics',
    patterns: [
      'cdn.shopify.com/s/trekkie',
      'monorail-edge.shopifysvc.com',
      'v.shopify.com'
    ],
    category: 'analytics',
    description: 'Native Shopify tracking for store analytics, conversion tracking, and customer behavior.',
    url: 'https://www.shopify.com',
    color: '#96bf48',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'simple-analytics',
    name: 'Simple Analytics',
    shortName: 'Simple Analytics',
    patterns: [
      'simpleanalytics.com',
      'simpleanalyticscdn.com',
      'queue.simpleanalytics.io',
      'scripts.simpleanalyticscdn.com'
    ],
    category: 'analytics',
    description: 'Privacy-friendly analytics that does not track users or use cookies, GDPR compliant by default.',
    url: 'https://simpleanalytics.com',
    color: '#ff4f64',
    colorVerified: true,
    iconVerified: true, // Simple Icons: Simple Analytics
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'siteimprove',
    name: 'Siteimprove',
    shortName: 'Siteimprove',
    patterns: [
      'siteimproveanalytics.com',
      'siteimproveanalytics.io',
      /siteimproveanalytics\.io\/.*\.aspx/,
      'us1.siteimprove.com',
      'us2.siteimprove.com'
    ],
    category: 'analytics',
    description: 'Content intelligence and web analytics platform for accessibility, SEO, and performance optimization.',
    url: 'https://www.siteimprove.com',
    color: '#0E4CD3',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'snitcher',
    name: 'Snitcher',
    shortName: 'Snitcher',
    patterns: [
      'radar.snitcher.com',
      'cdn.snitcher.com'
    ],
    category: 'analytics',
    description: 'B2B website visitor identification — reveals which companies visit your site by matching visitor IP against a company database.',
    url: 'https://www.snitcher.com',
    color: '#4133F5',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'sprig',
    name: 'Sprig (UserLeap)',
    shortName: 'Sprig',
    patterns: [
      'cdn.userleap.com',
      'api.userleap.com',
      'userleap.com'
    ],
    category: 'analytics',
    description: 'In-product survey and user research platform for continuous product discovery.',
    url: 'https://sprig.com',
    color: '#F9C600',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'statcounter',
    name: 'StatCounter',
    shortName: 'StatCounter',
    patterns: [
      'statcounter.com/counter',
      'c.statcounter.com',
      'secure.statcounter.com'
    ],
    category: 'analytics',
    description: 'Free web analytics service providing real-time visitor statistics and traffic analysis.',
    url: 'https://statcounter.com',
    color: '#3e8125',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'swetrix',
    name: 'Swetrix',
    shortName: 'Swetrix',
    patterns: [
      'api.swetrix.com/log',
      'swetrix.org/script.js'
    ],
    category: 'analytics',
    description: 'Open-source, cookieless web analytics with real-time dashboards, performance monitoring, and error tracking.',
    url: 'https://swetrix.com',
    color: '#818cf8',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-06'
  },
  {
    id: 'tagalys',
    name: 'Tagalys',
    shortName: 'Tagalys',
    // Regional API shard family (api-rN). UNANCHORED on purpose: patterns are tested against
    // the FULL url including scheme and path, so the ^...$ form the investigation proposed
    // could never have fired. Excluded: www. (marketing), static. (docs), support. (help),
    // next.tagalys.com (logged-in merchant dashboard).
    // Colour from the Brandfetch brand record (accent); the vendor ships no published
    // guideline and its site palette is monochrome, hence colorVerified: false.
    patterns: [
      /api(-r\d+)?\.tagalys\.com/,
      'd3htxdwqp62ai4.cloudfront.net/tagalys-plugins-v6.js'
    ],
    category: 'analytics',
    description: 'E-commerce product discovery and merchandising for Shopify, Magento and BigCommerce, tracking product views, add-to-carts and purchases to attribute conversions to search queries and listing pages.',
    url: 'https://www.tagalys.com/',
    color: '#ff492c',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'tilda-stat',
    name: 'Tilda Statistics',
    shortName: 'Tilda',
    // Collector is stat.tildaapi.one/event/; loader is stat.tildacdn.com/js/tildastat-*.min.js.
    // Do NOT add static.tildacdn.com/.ink/.net or any tildacdn.* apex wildcard -- pure asset
    // CDN firing on every page of every Tilda site (same reasoning as melidata excluding
    // http2.mlstatic.com). Do NOT add .tilda.cc (builder marketing + customer admin) or
    // tilda.ws (the published first-party page itself). forms./feeds./store.tildaapi.one are
    // functional site plumbing, not analytics. stat.tildaapi.com + sysstat.tildacdn.com rest
    // on blocklist entries only -- harmless if they never fire, worth confirming in a sweep.
    patterns: [
      'stat.tildaapi.one',
      'stat.tildaapi.com',
      'sysstat.tildacdn.com',
      'stat.tildacdn.com'
    ],
    category: 'analytics',
    description: 'Built-in website statistics tracker for sites built on the Tilda Publishing no-code website builder, collecting pageviews, sessions, unique visitors, events, UTM parameters and e-commerce orders.',
    url: 'https://tilda.cc/',
    color: '#FFA282',
    colorVerified: false,
    iconVerified: true,
    addedInVersion: '1.4.2',
    addedDate: '2026-08-04'
  },
  {
    id: 'triple-whale',
    name: 'Triple Whale',
    shortName: 'Triple Whale',
    patterns: [
      'triplewhale.com',
      'api.triplewhale.com',
      'pixel.triplewhale.com'
    ],
    category: 'analytics',
    description: 'First-party pixel for Shopify brands showing true ROAS, profit margins, and blended CAC in real-time.',
    url: 'https://www.triplewhale.com',
    color: '#0C70F2',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'umami',
    name: 'Umami',
    shortName: 'Umami',
    patterns: [
      'analytics.umami.is',
      'umami.is/api',
      /cloud\.umami\.is/
    ],
    category: 'analytics',
    description: 'Privacy-focused, open-source alternative to Google Analytics with simple metrics and GDPR compliance.',
    url: 'https://umami.is',
    color: '#000000',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'userpilot',
    name: 'Userpilot',
    shortName: 'Userpilot',
    patterns: [
      'userpilot.io',
      'js.userpilot.io',
      'api.userpilot.io',
      'analytics.userpilot.io'
    ],
    category: 'analytics',
    description: 'Product growth platform combining analytics with in-app experiences and user onboarding.',
    url: 'https://userpilot.com',
    color: '#6766e8',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'userreport',
    name: 'UserReport',
    shortName: 'UserReport',
    patterns: [
      'visitanalytics.userreport.com',
      'visitanalytics.dnt-userreport.com',
      'sak.userreport.com'
    ],
    category: 'analytics',
    description: 'Audience measurement and survey platform by AudienceProject (Danish ad-tech). Widely used by Nordic publishers for FIAM/IAM-style audience measurement.',
    url: 'https://www.userreport.com',
    color: '#1976D2',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'vercel-analytics',
    name: 'Vercel Analytics',
    shortName: 'Vercel Analytics',
    patterns: [
      'vitals.vercel-insights.com',
      'vercel-insights.com',
      'va.vercel-scripts.com',
      // First-party-routed paths — Vercel-hosted sites proxy Analytics + Speed
      // Insights through their own domain via these `_vercel/` Next.js routes.
      // Path prefix is Vercel-specific (`_vercel/` namespace) — safe match.
      '/_vercel/insights/',
      '/_vercel/speed-insights/'
    ],
    category: 'analytics',
    description: 'Web performance and analytics built for Next.js and Vercel-deployed sites.',
    url: 'https://vercel.com/analytics',
    color: '#000000',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'vtex-analytics',
    name: 'VTEX Storefront Analytics',
    shortName: 'VTEX Analytics',
    // Covers BOTH generations of VTEX's platform-default storefront analytics, which fire
    // simultaneously on live stores. Precedent for folding SDK + ingest + pixel into one
    // entry is shopify-analytics. Host completeness matters here: activity-flow.vtex.com
    // serves ONLY the SDK (/af/af.js) and af-origin.vtex.com is the actual collector --
    // af-origin is ABSENT from EasyPrivacy, so registering only the blocklisted host would
    // drop every Activity Flow event into tools_unknown. Same shape on the legacy side:
    // vtex.com.br/rc/rc.js serves the script, rc.vtex.com/v8 is the beacon.
    // The EasyPrivacy-listed rc.vtex.com.br is DEAD (NXDOMAIN since ~2021) and deliberately
    // NOT registered. The rc.js pattern is host-agnostic within *.vtex.com.br so a future
    // relocation still matches -- io.vtex.com.br must NEVER be registered bare (general VTEX
    // IO developer CDN). RC beacon is version-pinned at /v8; re-check if VTEX ships /v9.
    // Never wildcard .vtex.com or .vtex.com.br (marketing, developer docs, help centre,
    // merchant admin console). Colour is VTEX 'Rebel Pink'; Simple Icons carries a stale
    // #ED125F -- do not resync from there.
    patterns: [
      'activity-flow.vtex.com',
      'af-origin.vtex.com/api/activity-flow',
      'rc.vtex.com/v8',
      'vtex.com.br/rc/rc.js'
    ],
    category: 'analytics',
    description: 'VTEX\'s platform-default storefront behavioural analytics, covering both the current Activity Flow RUM SDK and the legacy NavigationCapture (RC) beacon it is replacing — page views, sessions, clicks, impressions, cart add/remove, order placement, VTEX Ads impressions and Web Vitals.',
    url: 'https://developers.vtex.com/docs/guides/activity-flow',
    color: '#F71963',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.4.2',
    addedDate: '2026-08-04'
  },
  {
    id: 'vtex-intelligent-search',
    name: 'VTEX Intelligent Search',
    shortName: 'VTEX Search',
    // Path-scoped: the host CNAMEs to biggy-apis.vtex.com, a shared Intelligent Search
    // backend that may serve non-event routes. Never wildcard .vtex.com (marketing, docs,
    // merchant admin). Colour is VTEX 'Rebel Pink' -- note Simple Icons carries a STALE
    // #ED125F for vtex; do not resync from there.
    patterns: [
      'sp.vtex.com/event-api'
    ],
    category: 'analytics',
    description: 'VTEX Intelligent Search behavioural event collector tracking search queries, autocomplete, result clicks and purchase confirmation across VTEX storefronts.',
    url: 'https://developers.vtex.com/docs/guides/intelligent-search-api-overview',
    color: '#F71963',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'walkme',
    name: 'WalkMe',
    shortName: 'WalkMe',
    patterns: [
      'cdn.walkme.com',
      'playerserver.walkme.com',
      'ec.walkme.com'
    ],
    category: 'analytics',
    description: 'Digital adoption platform providing in-app guidance, analytics, and automation.',
    url: 'https://www.walkme.com',
    color: '#0072F5',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'woopra',
    name: 'Woopra',
    shortName: 'Woopra',
    patterns: [
      'woopra.com/track',
      'static.woopra.com',
      'ping.woopra.com'
    ],
    category: 'analytics',
    description: 'Real-time customer journey analytics with individual user tracking and automation triggers.',
    url: 'https://www.woopra.com',
    color: '#21159b',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'workmagic',
    name: 'WorkMagic',
    shortName: 'WorkMagic',
    // Category is analytics, not advertising: WorkMagic does not serve ads, bid, or build
    // retargeting audiences -- the pixel feeds measurement models. fe-assets is PATH-SCOPED
    // to /pixel/ because that host also serves the logged-in merchant dashboard front-end.
    patterns: [
      'track-api.workmagic.io',
      'fe-assets.workmagic.io/pixel/'
    ],
    category: 'analytics',
    description: 'E-commerce marketing measurement combining incrementality testing, multi-touch attribution and media-mix modelling via a browser pixel.',
    url: 'https://www.workmagic.io/',
    color: '#683AE9',
    colorVerified: false,
    iconVerified: true,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'yahoo-analytics',
    name: 'Yahoo Analytics',
    shortName: 'Yahoo Analytics',
    patterns: [
      'ups.analytics.yahoo.com',
      'analytics.yahoo.com',
      'sp.analytics.yahoo.com'
    ],
    category: 'analytics',
    description: 'Audience measurement and conversion tracking for Yahoo DSP advertising.',
    url: 'https://www.advertising.yahooinc.com/',
    color: '#5F01D1',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'yandex-metrica',
    name: 'Yandex Metrica',
    shortName: 'Yandex Metrica',
    patterns: [
      'mc.yandex.ru',
      'mc.yandex.com',
      'mc.yandex.md',
      'mc.webvisor.org',
      'metrika.yandex.ru'
    ],
    category: 'analytics',
    description: 'Web analytics service by Yandex with session replay and heatmaps, widely used in Russian-speaking markets.',
    url: 'https://metrica.yandex.com',
    color: '#FC3F1D',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },

  // === AD TECH ===
  {
    id: '33across',
    name: '33Across',
    shortName: '33Across',
    patterns: [
      '33across.com',
      'lexicon.33across.com',
      'ssc-cms.33across.com',
      'pixel.33across.com'
    ],
    category: 'ad-tech',
    description: 'Attention-based header bidding and cookieless identity solution (Lexicon ID).',
    url: 'https://www.33across.com',
    color: '#FF4081',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'adalyser',
    name: 'Adalyser',
    shortName: 'Adalyser',
    // Operated by OneSoon Ltd (UK). CATEGORY IS A JUDGMENT CALL: WhoTracks.Me files Adalyser
    // under Site Analytics, but the product measures advertising response rather than general
    // site behaviour, so ad-tech is the better fit; analytics is the defensible alternative.
    // Apex wildcard FORBIDDEN — www.adalyser.com is marketing + the customer console.
    patterns: [
      'c0.adalyser.com',
      'c1.adalyser.com',
      'c5.adalyser.com',
      'tracking.adalyser.com'
    ],
    category: 'ad-tech',
    description: 'TV advertising attribution platform that measures website response and conversions driven by linear and digital TV campaigns.',
    url: 'https://www.adalyser.com/',
    color: '#f3584e',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'adform',
    name: 'Adform',
    shortName: 'Adform',
    patterns: [
      'track.adform.net',
      's2.adform.net',
      'adform.net/serving',
      'adform.net/Banners'
    ],
    category: 'ad-tech',
    description: 'Full-stack programmatic advertising platform with DSP, DMP, and ad serving.',
    url: 'https://www.adform.com',
    color: '#7A9A00',
    colorVerified: true,
    iconVerified: false,
    parsing: {
      sources: ['urlParams'],
      eventName: { param: 'ADFPageName', alt: ['pagename'], default: 'Tracking Point' },
      overview: {
        'Tracking ID': { param: 'pm' },
        'Page Name': { param: 'ADFPageName', alt: ['pagename'] },
        'Divider': { param: 'ADFdivider', alt: ['divider'] }
      }
    },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'adhese',
    name: 'Adhese',
    shortName: 'Adhese',
    patterns: [
      /\.adhese\.com/,
      'pool.adhese.com',
      'ads.adhese.com'
    ],
    category: 'ad-tech',
    description: 'European ad serving platform for publishers with header bidding and programmatic advertising.',
    url: 'https://www.adhese.com',
    color: '#FF6600',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'adition',
    name: 'Adition (Virtual Minds)',
    shortName: 'Adition',
    patterns: [
      'dsp.adfarm1.adition.com',
      'imagesrv.adition.com',
      'adition.com',
      'ad.adition.com'
    ],
    category: 'ad-tech',
    description: 'German ad server platform, now part of Virtual Minds / ProSiebenSat.1. Common on German publishers.',
    url: 'https://www.virtual-minds.com',
    color: '#006bb6',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'adnami',
    name: 'Adnami',
    shortName: 'Adnami',
    patterns: [
      'functions.adnami.io',
      'macro.adnami.io',
      'adnami.io'
    ],
    category: 'ad-tech',
    description: 'Nordic high-impact and rich media ad platform for premium display advertising.',
    url: 'https://www.adnami.io',
    color: '#3c4cac',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'adventori',
    name: 'ADventori',
    shortName: 'ADventori',
    patterns: ['.adventori.com'],
    category: 'ad-tech',
    description: 'Data-driven creative ad server specializing in DCO (Dynamic Creative Optimization) and campaign conversion tracking.',
    url: 'https://www.adventori.com',
    color: '#44bdb6',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-06'
  },
  {
    id: 'adnuntius',
    name: 'Adnuntius',
    shortName: 'Adnuntius',
    patterns: [
      'delivery.adnuntius.com',
      'ads.adnuntius.delivery',
      'api.adnuntius.com'
    ],
    category: 'ad-tech',
    description: 'Norwegian ad server and SSP with header bidding, native ads, and self-serve marketplace.',
    url: 'https://adnuntius.com',
    color: '#1a73e8',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'adroll',
    name: 'AdRoll',
    shortName: 'AdRoll',
    patterns: [
      's.adroll.com',
      'd.adroll.com'
    ],
    category: 'ad-tech',
    description: 'Retargeting and prospecting platform focused on e-commerce growth.',
    url: 'https://www.adroll.com',
    color: '#00AEEF',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'adtarget',
    name: 'AdTarget',
    shortName: 'AdTarget',
    patterns: [
      '.console.adtarget.com.tr'
    ],
    category: 'ad-tech',
    description: 'Turkish ad-tech platform — self-service ad-serving, retargeting, and attribution; TCF-registered vendor with multi-tenant publisher adoption.',
    url: 'https://adtarget.com.tr',
    color: '#E8412C',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'adtraction',
    name: 'Adtraction',
    shortName: 'Adtraction',
    // Added 2026-07-22: aservice.cloud serves the Adservice Master Tag, self-identified in the
    // script's own copyright header ('Adservice Master Tag Tracking, @copyright Adservice 2023').
    // Adservice A/S was acquired by Adtraction Group AB in Jan 2023 and the platforms merged in
    // 2024, so this extends adtraction rather than getting its own entry; adservice.com now 301s
    // to adtraction.com.
    // PATH-SCOPED DELIBERATELY: only /trc/mastertag returns 200 - every other path 301s to
    // adtraction.com - so an apex wildcard would add no coverage. Listed in EasyPrivacy as
    // ||aservice.cloud/trc/mastertag.
    // KNOWN GAP: the conversion beacon host is templated per advertiser at serve time and could
    // not be enumerated; it is likely a per-advertiser first-party domain.
    patterns: [
      'track.adtraction.com',
      'adtraction.com/t/t',
      'aservice.cloud/trc/mastertag'
    ],
    category: 'ad-tech',
    description: 'Nordic affiliate marketing network connecting advertisers with publishers for performance-based marketing.',
    url: 'https://adtraction.com',
    color: '#0d1e78',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-07-22'
  },
  {
    id: 'amazon-ads',
    name: 'Amazon Advertising',
    shortName: 'Amazon Ads',
    // Added 2026-07-22: the whole label chain is distinctive enough that one substring covers
    // ara./s2./alb.s2./cslewis. plus every regional (us-east-1, eu-west-1, ap-southeast-1) and
    // beta-/gamma- stage host, so new Amazon regions are covered automatically. It cannot match
    // amazon.com, advertising.amazon.com or sellercentral.amazon.com. Ghostery groups this domain
    // with amazon-adsystem.com under one tracker entity, which is why it extends rather than
    // getting its own entry.
    patterns: [
      's.amazon-adsystem.com',
      'z-na.amazon-adsystem.com',
      'fls-na.amazon-adsystem.com',
      'paa-reporting-advertising.amazon'
    ],
    category: 'ad-tech',
    description: 'Conversion tracking for Sponsored Products, Brands, and Display ads on Amazon.',
    url: 'https://advertising.amazon.com',
    color: '#ff9900',
    colorVerified: true,
    textColor: '#cc7a00',
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-07-22'
  },
  {
    id: 'amazon-aps',
    name: 'Amazon Publisher Services',
    shortName: 'Amazon APS',
    patterns: [
      'c.amazon-adsystem.com/aax2/apstag.js',
      'aax.amazon-adsystem.com',
      'aps.amazon.com'
    ],
    category: 'ad-tech',
    description: 'Header bidding solution connecting publishers to Amazon advertising demand.',
    url: 'https://aps.amazon.com',
    color: '#ff9900',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'amx',
    name: 'AMX',
    shortName: 'AMX',
    patterns: [
      'a-mo.net',
      'prebid.a-mo.net',
      'sync.a-mo.net',
      'amxrtb.com'
    ],
    category: 'ad-tech',
    description: 'Real-time bidding exchange and header bidding wrapper (formerly AppMonet/Monet Engine).',
    url: 'https://amxrtb.com',
    color: '#FF6D00',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'applovin',
    name: 'AppLovin',
    shortName: 'AppLovin',
    patterns: [
      'b.applovin.com',
      're.applovin.com',
      'res4.applovin.com',
      'd.applvn.com',
      'ms.applvn.com'
    ],
    category: 'ad-tech',
    description: 'Mobile and web advertising platform for user acquisition, monetization, and ad attribution.',
    url: 'https://www.applovin.com',
    color: '#0683aa',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'artsai',
    name: 'ArtsAI',
    shortName: 'ArtsAI',
    patterns: [
      'arttrk.com',
      'data.adxcel-ec2.com'
    ],
    category: 'ad-tech',
    description: 'Adaptive ad-tech platform from Adxcel — rich-media DCO ad serving, programmatic optimization, and conversion tracking across CTV, video, audio, podcast, and display.',
    url: 'https://artsai.com',
    color: '#0072CE',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'audigent',
    name: 'Audigent',
    shortName: 'Audigent',
    // Two observed hosts, ONE vendor: ad.gt is a serving-only domain hack and the corporate
    // site is audigent.com, so there is no admin-UI risk on the listed hosts. The .ad.gt apex
    // is deliberately NOT wildcarded (apex content unverified), and monitoring.crawler.stg.ad.gt
    // is excluded as staging. Acquired by Experian in 2024.
    patterns: [
      'a.ad.gt',
      'id.hadron.ad.gt',
      'uid2.hadron.ad.gt',
      'ids.ad.gt',
      'ids4.ad.gt',
      'seg.ad.gt',
      'p.ad.gt',
      'pixels.ad.gt'
    ],
    category: 'ad-tech',
    description: 'Data activation, curation and identity platform whose Hadron ID is a cookieless cross-site identifier for publishers and advertisers.',
    url: 'https://audigent.com/',
    color: '#9f47bf',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'awin',
    name: 'Awin/Affiliate Window',
    shortName: 'Awin',
    patterns: [
      'dwin1.com',
      'dwin2.com',
      'awin1.com'
    ],
    category: 'ad-tech',
    description: 'Global affiliate network connecting advertisers with publishers for performance-based marketing.',
    url: 'https://www.awin.com',
    color: '#E65C00',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'bannerflow',
    name: 'Bannerflow',
    shortName: 'Bannerflow',
    patterns: [
      'c.bannerflow.net',
      'a.bannerflow.net'
    ],
    category: 'ad-tech',
    description: 'Creative management platform for producing, scaling, and distributing display advertising.',
    url: 'https://www.bannerflow.com',
    color: '#01a1fe',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'beeswax',
    name: 'Beeswax',
    shortName: 'Beeswax',
    patterns: [
      'bidr.io',
      'match.prod.bidr.io',
      'segment.prod.bidr.io'
    ],
    category: 'ad-tech',
    description: 'Bidder-as-a-service DSP providing customizable real-time bidding infrastructure.',
    url: 'https://www.beeswax.com',
    color: '#FFC107',
    colorVerified: false,
    textColor: '#000000',
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  // --- SSPs & Exchanges ---
  {
    id: 'bidswitch',
    name: 'BidSwitch',
    shortName: 'BidSwitch',
    patterns: [
      'bidswitch.net',
      'x.bidswitch.net',
      'grid.bidswitch.net'
    ],
    category: 'ad-tech',
    description: 'Supply-side ad exchange infrastructure for real-time bidding interconnections (owned by Criteo).',
    url: 'https://www.bidswitch.com',
    color: '#FF5722',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'bidtellect',
    name: 'Bidtellect',
    shortName: 'Bidtellect',
    patterns: [
      // Single bare-host footprint — all observed traffic on bttrack.com (no subdomains).
      // Primary path /pixel/cookiesync (TCF v2.2 GDPR-compliant). Common initiator:
      // Magnite/Rubicon Project SSP cookie-sync (eus.rubiconproject.com/usync.js).
      'bttrack.com'
    ],
    category: 'ad-tech',
    description: 'Native-advertising DSP — content distribution and cookie-syncing across native ad formats (owned by Simpli.fi since 2023).',
    url: 'https://www.bidtellect.com',
    color: '#2D3142',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-04-29'
  },
  {
    id: 'blis',
    name: 'Blis',
    shortName: 'Blis',
    patterns: [
      'blismedia.com',
      'tr.blismedia.com'
    ],
    category: 'ad-tech',
    description: 'Location intelligence and mobile programmatic advertising platform.',
    url: 'https://blis.com',
    color: '#00B0FF',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'bliss-point',
    name: 'Bliss Point by Tinuiti',
    shortName: 'Bliss Point',
    patterns: [
      'pointmediatracker.com'
    ],
    category: 'ad-tech',
    description: 'TV, streaming, and digital-audio attribution pixel from Bliss Point by Tinuiti — closed-loop measurement correlating web conversions with non-click-based ad exposure. Common on DTC Shopify Plus brands running streaming/linear TV campaigns.',
    url: 'https://tinuiti.com/blisspoint/',
    color: '#1d8be0',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-19'
  },
  {
    id: 'blockthrough',
    name: 'Blockthrough',
    shortName: 'Blockthrough',
    patterns: [
      'btloader.com',
      'blockthrough.com'
    ],
    category: 'ad-tech',
    description: 'Ad recovery platform that serves Acceptable Ads-compliant advertisements to users with ad blockers installed.',
    url: 'https://blockthrough.com',
    color: '#0083ff',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  // Brightcom / LoopMe - Ad exchange and programmatic advertising
  {
    id: 'brightcom',
    name: 'Brightcom',
    shortName: 'Brightcom',
    patterns: [
      'brightcom.com',
      'loopme.com',
      'loopme.me',
      'loopmertb.com',
      'lm0x1.com',
      'tk0x1.com'
    ],
    category: 'ad-tech',
    description: 'Digital advertising and ad exchange platform with programmatic video and display.',
    url: 'https://www.brightcom.com',
    color: '#FF6600',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  // Centro / Basis - DSP and programmatic media buying
  {
    id: 'brightline',
    name: 'Brightline',
    shortName: 'Brightline',
    patterns: [
      'events.brightline.tv',
      'services.brightline.tv'
    ],
    category: 'ad-tech',
    description: 'CTV interactive advertising platform — remote-control-enabled formats (polls, trivia, advergames) running across Disney+, Hulu, Fubo, Warner Bros. Discovery, and NBCUniversal streaming inventory.',
    url: 'https://brightline.tv',
    color: '#0072CE',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'cadent-adtheorent',
    name: 'Cadent (AdTheorent)',
    shortName: 'Cadent',
    patterns: [
      'px.adentifi.com'
    ],
    category: 'ad-tech',
    description: 'Cadent conversion / retargeting pixel (formerly AdTheorent, acquired Dec 2024) — collects activity IDs, custom values, product IDs and page URLs for ad measurement and audience building.',
    url: 'https://cadent.tv/',
    color: '#1B3F7C',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-11'
  },
  {
    id: 'centro-basis',
    name: 'Centro / Basis',
    shortName: 'Centro / Basis',
    patterns: [
      'basis.net',
      'centro.net',
      'pixel.ad',
      'sitescout.com'
    ],
    category: 'ad-tech',
    description: 'Programmatic media buying DSP platform (formerly Centro, now Basis Technologies).',
    url: 'https://basis.net',
    color: '#0072CE',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'cint-lucid',
    name: 'Cint (Lucid)',
    shortName: 'Cint',
    patterns: [
      'samplicio.us'
    ],
    category: 'ad-tech',
    description: 'Cint/Lucid audience-research and media-measurement platform — cookie-syncing (usersync.samplicio.us) and measurement pixels (tracker.samplicio.us) used for campaign measurement and audience matching. Lucid was acquired by Cint Group in 2021; samplicio.us remains the live tracking apex.',
    url: 'https://www.cint.com',
    color: '#15bb86',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-19'
  },
  {
    id: 'cj',
    name: 'CJ Affiliate',
    shortName: 'CJ Affiliate',
    patterns: [
      'emjcd.com',
      'dpbolvw.net',
      'anrdoezrs.net'
    ],
    category: 'ad-tech',
    description: 'Affiliate marketing network (formerly Commission Junction) for performance partnerships.',
    url: 'https://www.cj.com',
    color: '#013a37',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'claritas',
    name: 'Claritas',
    shortName: 'Claritas',
    patterns: ['trkn.us'],
    category: 'ad-tech',
    description: 'Audience measurement, segmentation (PRIZM), and cross-device attribution. The trkn.us pixel (Track Ninja) powers Claritas AudienceAnywhere Optimize.',
    url: 'https://claritas.com',
    color: '#1B365D',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-15'
  },
  {
    id: 'clickcertain',
    name: 'ClickCertain',
    shortName: 'ClickCertain',
    patterns: [
      'a.remarketstats.com'
    ],
    category: 'ad-tech',
    description: 'Self-serve and white-label RTB display retargeting platform — advertisers buy retargeting and targeted display traffic; tracking beacon at a.remarketstats.com (the operations apex; clickcertain.com is the corporate site).',
    url: 'https://www.clickcertain.com',
    color: '#0066cc',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-19'
  },
  {
    id: 'cognitiv',
    name: 'Cognitiv',
    shortName: 'Cognitiv',
    patterns: [
      // Dot-prefixed: catches every subdomain (beacon.lynx.cognitivlabs.com today,
      // future beacon.<product>.cognitivlabs.com siblings) without matching the bare
      // marketing-site root or substring-colliding with unrelated domains.
      '.cognitivlabs.com'
    ],
    category: 'ad-tech',
    description: 'AI / deep-learning programmatic advertising platform — audience prediction, cookie-syncing, and bidstream beacons (Cognitiv Lynx product family).',
    url: 'https://www.cognitiv.ai',
    color: '#1B3A5C',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-04-29'
  },
  {
    id: 'commission-factory',
    name: 'Commission Factory',
    shortName: 'Commission Factory',
    patterns: [
      't.cfjump.com',
      'c.cfjump.com'
    ],
    category: 'ad-tech',
    description: 'Affiliate marketing network for performance-based partnerships, primarily in Australia and APAC.',
    url: 'https://www.commissionfactory.com',
    color: '#00aade',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'connatix',
    name: 'Connatix',
    shortName: 'Connatix',
    patterns: [
      'capi.connatix.com',
      'cd.connatix.com',
      'connatix.com/api'
    ],
    category: 'ad-tech',
    description: 'Video technology platform for content monetization and advertising.',
    url: 'https://www.connatix.com',
    color: '#ec0041',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'connectad',
    name: 'ConnectAd',
    shortName: 'ConnectAd',
    patterns: [
      'i.connectad.io',
      'sync.connectad.io',
      'connectad.io'
    ],
    category: 'ad-tech',
    description: 'Austrian header bidding and ad exchange platform for European publishers.',
    url: 'https://connectad.io',
    color: '#1a73e8',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'content-exchange',
    name: 'Content Exchange',
    shortName: 'ContentExchange',
    // Apex wildcard is FORBIDDEN — www.contentexchange.me carries marketing pages AND the
    // logged-in publisher dashboard. images4.contentexchange.me (widget image CDN) and the
    // admin/ms-dev hosts are deliberately excluded. Siblings enumerated via urlscan.
    patterns: [
      'analytics.contentexchange.me',
      'collector.contentexchange.me',
      'collector_sr.contentexchange.me',
      'match.contentexchange.me',
      'hb.contentexchange.me',
      'hbstat.contentexchange.me',
      'tracker-ug.contentexchange.me'
    ],
    category: 'ad-tech',
    description: 'Southeast European native advertising and content-recommendation network serving cross-promotion widgets with click-level analytics for publishers.',
    url: 'https://www.contentexchange.me',
    color: '#4fc0d2',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'contimo',
    name: 'Contimo',
    shortName: 'Contimo',
    patterns: [
      'contimo.app',
      'contimo.io'
    ],
    category: 'ad-tech',
    description: 'Native advertising and affiliate marketing platform for publishers with content optimization and commerce integration.',
    url: 'https://www.contimo.io',
    color: '#1a1a2e',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'conversant',
    name: 'Conversant',
    shortName: 'Conversant',
    patterns: [
      'dotomi.com',
      'web.hb.ad.cpe.dotomi.com',
      'media.msg.dotomi.com'
    ],
    category: 'ad-tech',
    description: 'Identity-based ad serving and header bidding platform (Publicis/Epsilon).',
    url: 'https://www.conversantmedia.com',
    color: '#D50000',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'crib-notes',
    name: 'Crib Notes',
    shortName: 'Crib Notes',
    // Enumerated only. Do NOT wildcard .cribnotes.jp -- the apex is shared with www.
    // (marketing) and docs.cribnotes.jp (customer documentation). Do NOT wildcard
    // .j-a-net.jp at all -- that apex is JANet's own affiliate-network site and partner
    // dashboard. development-/staging- twins excluded (vendor-internal). org-tag.cribnotes.jp
    // resolves and is tracking-shaped but is unverified as a production endpoint -- add only
    // after a live sighting.
    patterns: [
      'log.cribnotes.jp',
      'tag.cribnotes.jp',
      'tag-cribnotes.j-a-net.jp'
    ],
    category: 'ad-tech',
    description: 'First-party-cookie conversion measurement tag from ADWAYS DEEE, used as the ITP-resilient tracking layer for the JANet, Smart-C and adna affiliate/ad networks in Japan.',
    url: 'https://cribnotes.jp/',
    color: '#1F3A5F',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.2',
    addedDate: '2026-08-04'
  },
  {
    id: 'criteo',
    name: 'Criteo',
    shortName: 'Criteo',
    patterns: [
      'static.criteo.net',
      'dis.criteo.com',
      'sslwidget.criteo.com',
      'bidder.criteo.com',
      '.criteo.com/rm',
      'gum.criteo.com',
      '.eu.criteo.com',
      '.fr3.eu.criteo.com',
      'rtax.criteo.com',
      'cat.criteo.com',
      'dynamic.criteo.com',
      'b.fr3.eu.criteo.com'
    ],
    category: 'ad-tech',
    description: 'Commerce media platform specializing in retargeting and dynamic product ads.',
    url: 'https://www.criteo.com',
    color: '#FE5000',
    colorVerified: true,
    iconVerified: false,
    parsing: { customParser: true, formattedParser: true },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'equativ',
    name: 'Equativ',
    shortName: 'Equativ',
    patterns: [
      'smartadserver.com',
      'ssbsync.smartadserver.com',
      'prg.smartadserver.com',
      'equativ.com'
    ],
    category: 'ad-tech',
    description: 'European full-stack ad serving and supply-side platform (formerly Smart AdServer).',
    url: 'https://www.equativ.com',
    color: '#6C3CE1',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'everest',
    name: 'Adobe Advertising',
    shortName: 'Adobe Advertising',
    patterns: [
      'everesttech.net',
      'pixel.everesttech.net',
      'everesttech.net/px'
    ],
    category: 'ad-tech',
    description: 'Adobe Advertising conversion/measurement pixel (everesttech.net) for cross-channel attribution.',
    url: 'https://business.adobe.com/products/advertising.html',
    color: '#ff0000',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'experian-match',
    name: 'Experian Match',
    shortName: 'Experian',
    patterns: [
      'experianmatch.info',
      'experianmatch.com'
    ],
    category: 'ad-tech',
    description: 'Experian audience and identity matching for ad targeting. Links online behavior to Experian consumer profiles.',
    url: 'https://www.experian.com/marketing-services',
    color: '#262c65',
    colorVerified: true,
    iconVerified: true, // Official favicon from experian.com
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  // eyeota - Audience data marketplace
  {
    id: 'eyeota',
    name: 'Eyeota',
    shortName: 'Eyeota',
    patterns: [
      'eyeota.net'
    ],
    category: 'ad-tech',
    description: 'Audience data marketplace for programmatic advertising and targeting.',
    url: 'https://www.eyeota.com',
    color: '#00B2A9',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'flashtalking',
    name: 'Flashtalking',
    shortName: 'Flashtalking',
    patterns: [
      'servedby.flashtalking.com',
      'cdn.flashtalking.com'
    ],
    category: 'ad-tech',
    description: 'Independent ad server and creative management for personalized advertising.',
    url: 'https://www.flashtalking.com',
    color: '#007aff',
    colorVerified: true,
    textColor: '#c99700',
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'fraud0',
    name: 'fraud0',
    shortName: 'fraud0',
    // IN SCOPE ON PURPOSE. Bot-detection is not uniformly rejected: the PLATFORMS-REJECTED
    // bot/fraud entries sit on the security/payment/identity axis (AWS WAF, reCAPTCHA, Visa
    // Cardinal 3DS, Socure, Feroot). fraud0 sits on the AD-VERIFICATION axis alongside the
    // IVT vendors already registered, so it belongs here rather than in REJECTED.
    patterns: [
      'api.fraud0.com',
      'bt.fraud0.com'
    ],
    category: 'ad-tech',
    description: 'Ad-fraud and invalid-traffic detection whose browser tag fingerprints device, network and behavioural signals to classify traffic quality.',
    url: 'https://www.fraud0.com',
    color: '#21cd9d',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'freewheel',
    name: 'FreeWheel',
    shortName: 'FreeWheel',
    patterns: [
      'fwmrm.net',
      'mssl.fwmrm.net',
      'user-sync.fwmrm.net'
    ],
    category: 'ad-tech',
    description: 'Premium video ad management and serving platform owned by Comcast.',
    url: 'https://www.freewheel.com',
    color: '#7B1FA2',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'google-adsense',
    name: 'Google AdSense',
    shortName: 'Google AdSense',
    patterns: [
      'pagead2.googlesyndication.com/pagead/js/adsbygoogle.js',
      'pagead2.googlesyndication.com/pagead/show_ads.js'
    ],
    category: 'ad-tech',
    description: 'Publisher monetization platform serving contextual advertisements.',
    url: 'https://www.google.com/adsense',
    color: '#4285f4',
    colorVerified: true,
    iconVerified: true, // Simple Icons: Google AdSense
    consumesGCM: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    // Ordering: google-cm360 must be checked before google-floodlight and search-ads-360
    // for ad.doubleclick.net URLs — CM360 uses specific /ddm/* paths, while floodlight
    // uses /ddm/activity and /activity, and SA360 uses bare /clk.
    id: 'google-cm360',
    name: 'Google CM360',
    shortName: 'Google CM360',
    patterns: [
      'ad.doubleclick.net/ddm/ad/',
      'ad.doubleclick.net/ddm/jump/',
      'ad.doubleclick.net/ddm/clk',
      'ad.doubleclick.net/ddm/trackclk',
      'ad.doubleclick.net/ddm/trackimp',
      'ad.doubleclick.net/ddm/adi/',
      'ad.doubleclick.net/ddm/pfadx/',
      '2mdn.net',
      's0.2mdn.net',
      's1.2mdn.net'
    ],
    category: 'ad-tech',
    description: 'Campaign Manager 360 ad delivery, creative hosting, click tracking, and impression tracking.',
    url: 'https://support.google.com/campaignmanager',
    color: '#4285f4',
    colorVerified: true,
    consumesGCM: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    // google-adtraffic is category 'advertising' but placed here before google-publisher-tag
    // because both share pagead2.googlesyndication.com — specific must precede broad
    id: 'google-adtraffic',
    name: 'Google Ad Traffic Quality',
    shortName: 'Google Ad Traffic Quality',
    patterns: [
      'adtrafficquality.google',
      'ep1.adtrafficquality.google',
      'ep2.adtrafficquality.google',
      'pagead2.googlesyndication.com/getconfig/sodar'
    ],
    category: 'advertising',
    description: 'Google invalid traffic detection and ad quality measurement system.',
    url: 'https://www.google.com/ads/adtrafficquality/',
    color: '#4285f4',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'google-publisher-tag',
    name: 'Google Publisher Tag',
    shortName: 'Google Publisher Tag',
    patterns: [
      'securepubads.g.doubleclick.net',
      'pubads.g.doubleclick.net',
      'pagead2.googlesyndication.com/tag/js/gpt.js',
      'pagead2.googlesyndication.com/gampad/',
      'googleads4.g.doubleclick.net',
      'googletagservices.com/tag/js/gpt.js'
    ],
    category: 'ad-tech',
    description: 'Google Ad Manager ad serving tag for publishers to display and manage ad inventory.',
    url: 'https://developers.google.com/publisher-tag/guides/get-started',
    color: '#4285f4',
    colorVerified: true,
    iconVerified: true,
    consumesGCM: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'google-signals',
    name: 'Google Signals',
    shortName: 'Google Signals',
    patterns: [
      'stats.g.doubleclick.net/r/collect',
      'stats.g.doubleclick.net/j/collect'
    ],
    category: 'ad-tech',
    description: 'Cross-device tracking and demographics data collection for Google Analytics.',
    url: 'https://support.google.com/analytics/answer/7532985',
    color: '#4285f4',
    colorVerified: true,
    consumesGCM: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'gumgum',
    name: 'GumGum',
    shortName: 'GumGum',
    patterns: [
      'g2.gumgum.com',
      'js.gumgum.com',
      'c.gumgum.com',
      'gumgum.com'
    ],
    category: 'ad-tech',
    description: 'Contextual intelligence company with in-image, in-screen, and video ad formats.',
    url: 'https://gumgum.com',
    color: '#ff3366',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  // --- Identity & Data ---
  {
    id: 'ias',
    name: 'Integral Ad Science',
    shortName: 'Integral Ad Science',
    patterns: [
      '.adsafeprotected.com',
      '.iasds01.com'
    ],
    category: 'ad-tech',
    description: 'Ad verification platform measuring viewability, brand safety, and ad fraud (IVT) on display and video ad impressions.',
    url: 'https://integralads.com',
    color: '#7DB72F',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'id5',
    name: 'ID5',
    shortName: 'ID5',
    patterns: [
      'id5-sync.com',
      'cdn.id5-sync.com',
      'api.id5-sync.com'
    ],
    category: 'ad-tech',
    description: 'Universal ID solution for programmatic advertising as a cookie alternative.',
    url: 'https://id5.io',
    color: '#0072CE',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'idx-dmp',
    name: 'IDX DMP',
    shortName: 'IDX',
    // Operator identified via the Maven artifact com.dxmdp.android:datamanagerprovider ('IDX DMP
    // Android SDK', developer pavel@id-x.co.il) — the dxmdp acronym alone was NOT treated as
    // evidence. Both hosts corroborated by AdGuard filter issue #154344.
    // Colour is Brandfetch's accent but reads as a framework default (Tailwind slate-900);
    // treat as low-confidence, hence colorVerified: false.
    patterns: [
      'event.dxmdp.com',
      'tags.dxmdp.com'
    ],
    category: 'ad-tech',
    description: 'Data management platform building user audience segments and injecting them as targeting parameters into ad requests.',
    url: 'https://id-x.co.il',
    color: '#0f172a',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'impact',
    name: 'Impact',
    shortName: 'Impact',
    // REWRITTEN 2026-07-22. The previous patterns were the bare substrings 'impact.com' and
    // 'impactradius.com', which were wrong in BOTH directions:
    //   - 11 verified false positives, incl. app.impact.com (the advertiser/partner DASHBOARD),
    //     member.impactradius.com (partner portal), api.impact.com, and the UNRELATED real domains
    //     socialimpact.com / climateimpact.com / highimpact.com, plus impact.com.evil.net and any
    //     URL merely carrying '?ref=impact.com'.
    //   - they MISSED 3 of the 4 real tracking hosts, including utt.impactcdn.com, which is the
    //     CURRENT default UTT script host.
    // The //host/ form pins both ends: leading // blocks the xyzimpact.com prefix class, trailing
    // / blocks the impact.com.evil.net suffix class.
    // NOT included, deliberately: the affiliate click-redirect apexes (.7eer.net/.evyy.net/
    // .ojrq.net/.r7ls.net) fire as top-level navigations rather than subresources and their
    // exclusivity to Impact was unverified; em.impact.com (email click redirect, different
    // surface); and a CloudFront distribution host attributed by WhoTracks.Me but unconfirmed.
    // RECALL RISK ACCEPTED: an unenumerated legacy *.impactradius.com tracking host would now stop
    // matching - add such hosts individually if a sweep surfaces them, never by restoring the apex.
    patterns: [
      '//d.impactradius-event.com/',
      '//utt.impactcdn.com/',
      '//a.impactradius-tag.com/',
      '//customtracking.impact.com/',
      '//goto.impact.com/',
      '//go2.impact.com/',
      '//trk.chn.impactradius.com/'
    ],
    category: 'ad-tech',
    description: 'Partnership automation platform for affiliate, influencer, and referral programs.',
    url: 'https://impact.com',
    color: '#F5333F',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-07-22'
  },
  {
    id: 'improve-digital',
    name: 'Improve Digital',
    shortName: 'Improve Digital',
    patterns: [
      'ad.360yield.com',
      'match.360yield.com',
      'ice.360yield.com',
      'dsp.360yield.com',
      '360yield.com'
    ],
    category: 'ad-tech',
    description: 'European SSP offering holistic yield management and header bidding solutions.',
    url: 'https://www.improvedigital.com',
    color: '#ff6600',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'index-exchange',
    name: 'Index Exchange',
    shortName: 'Index Exchange',
    patterns: [
      'casalemedia.com',
      'indexww.com',
      'htlb.casalemedia.com'
    ],
    category: 'ad-tech',
    description: 'Header bidding exchange with transparent auction mechanics and direct publisher integrations.',
    url: 'https://www.indexexchange.com',
    color: '#4CD3CC',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'intentsify',
    name: 'Intentsify',
    shortName: 'Intentsify',
    patterns: ['tracking.intentsify.io'],
    category: 'ad-tech',
    description: 'B2B intent data and ABM activation platform. Customer-deployed pixel collects first-party page-view intent signals and layers them onto Intentsify’s third-party intent graph used for buying-group identification and cross-channel activation.',
    url: 'https://intentsify.io',
    color: '#0B5FFF',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-14'
  },
  {
    id: 'intent-iq',
    name: 'Intent IQ',
    shortName: 'Intent IQ',
    patterns: [
      'intentiq.com',
      'api.intentiq.com',
      'sync.intentiq.com'
    ],
    category: 'ad-tech',
    description: 'Cross-device identity resolution and audience intelligence for cookieless ad targeting.',
    url: 'https://www.intentiq.com',
    color: '#FF6B35',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  // --- Other Ad-Tech ---
  {
    id: 'liveintent',
    name: 'LiveIntent',
    shortName: 'LiveIntent',
    patterns: [
      'liadm.com',
      'i.liadm.com',
      'idx.liadm.com',
      'rp.liadm.com'
    ],
    category: 'ad-tech',
    description: 'Identity resolution and programmatic advertising within email newsletters.',
    url: 'https://www.liveintent.com',
    color: '#6200EA',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'liveramp',
    name: 'LiveRamp',
    shortName: 'LiveRamp',
    patterns: [
      'idsync.rlcdn.com',
      'pippio.com',
      'api.rlcdn.com',
      's.axon.ai',
      'axon.ai',
      'id.rlcdn.com'
    ],
    category: 'ad-tech',
    description: 'Matches first-party data to pseudonymous IDs across the ad ecosystem for people-based targeting without cookies.',
    url: 'https://liveramp.com',
    color: '#32db86',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-07-21'
  },
  {
    id: 'livewrapped',
    name: 'Livewrapped',
    shortName: 'Livewrapped',
    patterns: [
      'lwgadm.com',
      'livewrapped.com/a/',
      'content.lwgadm.com'
    ],
    category: 'ad-tech',
    description: 'Swedish header bidding platform specializing in Prebid management and ad revenue optimization for Nordic publishers.',
    url: 'https://www.livewrapped.com',
    color: '#67d6fa',
    colorVerified: true,
    textColor: '#0a5a6d',
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'lotame',
    name: 'Lotame',
    shortName: 'Lotame',
    patterns: [
      'tags.crwdcntrl.net',
      'bcp.crwdcntrl.net',
      'ad.crwdcntrl.net'
    ],
    category: 'ad-tech',
    description: 'Builds and enriches audience segments from first-, second-, and third-party data for activation across DSPs.',
    url: 'https://www.lotame.com',
    color: '#1861f5',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'lunio',
    name: 'Lunio',
    shortName: 'Lunio',
    patterns: ['conversions.lunio.ai'],
    category: 'ad-tech',
    description: 'Ad-traffic verification and click-fraud protection platform; conversion-tracking script feeds invalid-traffic exclusions back to ad platforms.',
    url: 'https://www.lunio.ai',
    color: '#4B0E75',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.1',
    addedDate: '2026-06-06'
  },
  {
    id: 'magnite',
    name: 'Magnite',
    shortName: 'Magnite',
    patterns: [
      'rubiconproject.com',
      'fastlane.rubiconproject.com',
      'pixel.rubiconproject.com',
      'prebid-server.rubiconproject.com'
    ],
    category: 'ad-tech',
    description: 'Largest independent sell-side platform combining display, video, and CTV inventory in a single exchange.',
    url: 'https://www.magnite.com',
    color: '#f3657b',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'media-net',
    name: 'Media.net',
    shortName: 'Media.net',
    patterns: [
      '.media.net',
      '://media.net',
      'contextual.media.net',
      'hblg.media.net',
      'prebid.media.net'
    ],
    category: 'ad-tech',
    description: 'Contextual advertising platform and header bidding exchange powering Yahoo/Bing contextual ads.',
    url: 'https://www.media.net',
    color: '#2196F3',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  // MediaGo - Baidu's international programmatic advertising platform
  {
    id: 'mediago',
    name: 'MediaGo',
    shortName: 'MediaGo',
    patterns: [
      'trace.mediago.io',
      'mediago.io'
    ],
    category: 'ad-tech',
    description: 'Baidu\'s international programmatic advertising and ad exchange platform.',
    url: 'https://www.mediago.io',
    color: '#2932E1',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'mediamath',
    name: 'MediaMath',
    shortName: 'MediaMath',
    patterns: [
      'pixel.mathtag.com',
      'sync.mathtag.com'
    ],
    category: 'ad-tech',
    description: 'Enterprise demand-side platform for programmatic media buying.',
    url: 'https://www.mediamath.com',
    color: '#57BEED',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'mgid',
    name: 'MGID',
    shortName: 'MGID',
    // APEX WILDCARD FORBIDDEN. mgid.com carries dashboard.mgid.com (the publisher/advertiser
    // console) AND MGID's own internal estate: gitlab., n8n., langfuse., growthbook., openreplay.,
    // zabbix2., plus test-*/local-*/alpha.* tiers. A .mgid.com wildcard would flag MGID staff's
    // own GitLab and monitoring dashboards as third-party tracking.
    // s-img.mgid.com deliberately excluded - pure ad-creative image CDN, and jsc./a. already fire
    // on the same pageview so nothing is lost.
    // servicer. and widgets. are MODERATE confidence (host DBs, no vendor doc) - drop them if a
    // sweep does not confirm. Adskeeper and the dt00.net family are sometimes attributed to MGID
    // but ownership was NOT verified - do not add without evidence.
    // Category ad-tech over advertising: the observed host reaches sites via the PUBLISHER widget
    // and cm. is SSP/DSP cookie-match plumbing, both supply-side. MGID does also ship an
    // advertiser conversion pixel, so this is a genuine hybrid - revisit if that surfaces.
    // Colour is the Brandfetch 'dark' token: its 'accent' is pure #ff0000, a degenerate value.
    patterns: [
      '//a.mgid.com/',
      '//jsc.mgid.com/',
      '//cm.mgid.com/',
      '//servicer.mgid.com/',
      '//widgets.mgid.com/'
    ],
    category: 'ad-tech',
    description: 'Native advertising and content-recommendation network serving publisher widgets, impression/click pixels and SSP-to-DSP cookie-matching syncs.',
    url: 'https://www.mgid.com/',
    color: '#1f3d4e',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-22'
  },
  {
    id: 'mntn',
    name: 'MNTN',
    shortName: 'MNTN',
    patterns: [
      'px.mountain.com',
      'dx.mountain.com'
    ],
    category: 'ad-tech',
    description: 'Connected TV performance marketing pixel — tracks site visits, product views, and conversions to power CTV ad attribution and audience targeting.',
    url: 'https://mountain.com',
    color: '#000000',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-14'
  },
  {
    id: 'nativo',
    name: 'Nativo',
    shortName: 'Nativo',
    patterns: [
      'postrelease.com',
      'jadserve.postrelease.com',
      'exchange.postrelease.com'
    ],
    category: 'ad-tech',
    description: 'Native advertising SSP serving in-feed native ad units with programmatic capabilities.',
    url: 'https://www.nativo.com',
    color: '#00C853',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  // Neustar / agkn - Identity resolution and ad scoring (now TransUnion)
  {
    id: 'neustar',
    name: 'Neustar',
    shortName: 'Neustar',
    patterns: [
      'agkn.com',
      'aa.agkn.com',
      'neustar.biz'
    ],
    category: 'ad-tech',
    description: 'Identity resolution and ad scoring platform for audience verification (now TransUnion).',
    url: 'https://www.transunion.com/solution/truaudience',
    color: '#009FDA',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'nexxen',
    name: 'Nexxen',
    shortName: 'Nexxen',
    patterns: [
      '1rx.io',
      'sync.1rx.io',
      'tag.1rx.io',
      'unrulymedia.com',
      'targeting.unrulymedia.com',
      'tremorhub.com',
      /publishers\.tremorhub\.com/
    ],
    category: 'ad-tech',
    description: 'Video and display programmatic platform (formerly Tremor International/RhythmOne/Unruly).',
    url: 'https://www.nexxen.com',
    color: '#00C2FF',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'northbeam',
    name: 'Northbeam',
    shortName: 'Northbeam',
    patterns: [
      'northbeam.io',
      'api.northbeam.io',
      't.northbeam.io'
    ],
    category: 'ad-tech',
    description: 'Machine-learning attribution comparing MTA models side-by-side with media mix modeling for DTC brands.',
    url: 'https://www.northbeam.io',
    color: '#444d9a',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'onaudience',
    name: 'OnAudience',
    shortName: 'OnAudience',
    patterns: [
      // Catches every subdomain (pixel today, future siblings) — leading dot prevents
      // matching the bare marketing root onaudience.com or substring-colliding.
      '.onaudience.com'
    ],
    category: 'ad-tech',
    description: 'European data management platform — 27B+ user profiles across 200 markets, audience-segment marketplace distributed through major DSPs (owned by Cloud Technologies SA, Warsaw).',
    url: 'https://www.onaudience.com',
    color: '#1A4D8F',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-04-29'
  },
  {
    id: 'onetag',
    name: 'OneTag',
    shortName: 'OneTag',
    patterns: [
      'onetag-sys.com',
      'onetag.com',
      'get.s-onetag.com'
    ],
    category: 'ad-tech',
    description: 'Header bidding SSP focused on European publishers with in-image and in-content ad formats.',
    url: 'https://www.onetag.com',
    color: '#ff6b00',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'openx',
    name: 'OpenX',
    shortName: 'OpenX',
    patterns: [
      'openx.net',
      'servedbyopenx.com',
      'u.openx.net'
    ],
    category: 'ad-tech',
    description: 'Supply-side platform with curated private marketplaces and first-party data onboarding for publishers.',
    url: 'https://www.openx.com',
    color: '#00aaff',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  // Opera Ads - Opera browser advertising exchange
  {
    id: 'opera-ads',
    name: 'Opera Ads',
    shortName: 'Opera Ads',
    patterns: [
      'adx.opera.com',
      't.adx.opera.com',
      't.oa.opera.com'
    ],
    category: 'ad-tech',
    description: 'Opera browser advertising exchange and cookie sync platform.',
    url: 'https://ads.opera.com',
    color: '#FF1B2D',
    colorVerified: true, // Simple Icons: Opera
    iconVerified: true, // Simple Icons: Opera
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'oracle-moat',
    name: 'Oracle Moat',
    shortName: 'Oracle Moat',
    patterns: [
      'moatads.com',
      'z.moatads.com',
      'px.moatads.com',
      'js.moatads.com',
      's.moatads.com'
    ],
    category: 'ad-tech',
    description: 'Ad verification and viewability measurement platform (sunset Sep 2024, still seen on legacy sites).',
    url: 'https://www.oracle.com/cx/advertising/',
    color: '#F80000',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'optimal-people',
    name: 'Optimal People',
    shortName: 'Optimal People',
    patterns: [
      'analytics.optimalpeople.fr'
    ],
    category: 'ad-tech',
    description: 'French performance-marketing and affiliate tracking platform with device fingerprinting; multi-tenant via merchant_id at /d.php and /t/sale.php endpoints.',
    url: 'https://www.optimalpeople.fr',
    color: '#0a66c2',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'outbrain',
    name: 'Outbrain',
    shortName: 'Outbrain',
    patterns: [
      'outbrain.com/widget',
      'tr.outbrain.com',
      'log.outbrain.com',
      'amplify.outbrain.com'
    ],
    category: 'ad-tech',
    description: 'Native advertising platform for content recommendation and discovery.',
    url: 'https://www.outbrain.com',
    color: '#ee6513',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'owneriq',
    name: 'ownerIQ',
    shortName: 'ownerIQ',
    patterns: [
      '.owneriq.net'
    ],
    category: 'ad-tech',
    description: 'Second-party shopper-data marketplace and ad-tech pixel; part of Inmar Data & Media Platform (CoEx).',
    url: 'https://www.owneriq.com',
    color: '#1B72E0',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'partnerize',
    name: 'Partnerize',
    shortName: 'Partnerize',
    patterns: [
      'prf.hn',
      'pzapi-kg.com',
      'pzapi-ij.com'
    ],
    category: 'ad-tech',
    description: 'Partner marketing platform for affiliate tracking, attribution, and commission management. Formerly Performance Horizon.',
    url: 'https://partnerize.com',
    color: '#FF9438',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'permutive',
    name: 'Permutive',
    shortName: 'Permutive',
    patterns: [
      'cdn.permutive.com',
      'api.permutive.com',
      /.*\.permutive\.app/
    ],
    category: 'ad-tech',
    description: 'On-device audience processing for publishers, enabling targeting without sending user data to external servers.',
    url: 'https://permutive.com',
    color: '#6c5ce7',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'prebid',
    name: 'Prebid.js',
    shortName: 'Prebid',
    patterns: [
      '/prebid.js',
      'pbjs.',
      /\/\/[^/]+\/prebid/,  // /prebid in path only, not in hostname (avoids matching prebid.vendor.com)
      'pbjsChunk',
      'prebid.org'
    ],
    category: 'ad-tech',
    description: 'Open-source header bidding wrapper used by publishers to run real-time ad auctions.',
    url: 'https://prebid.org',
    color: '#d2423e',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'pubstack',
    name: 'Pubstack',
    shortName: 'Pubstack',
    patterns: ['.pbstck.com'],
    category: 'ad-tech',
    description: 'French ad-tech SaaS providing real-time analytics and monetisation management for digital publishers’ Prebid / header-bidding stacks. Registered Prebid analytics adapter.',
    url: 'https://www.pubstack.io',
    color: '#1F2937',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-14'
  },
  {
    id: 'pubmatic',
    name: 'PubMatic',
    shortName: 'PubMatic',
    patterns: [
      'ads.pubmatic.com',
      'image6.pubmatic.com',
      'hbopenbid.pubmatic.com'
    ],
    category: 'ad-tech',
    description: 'Cloud infrastructure for real-time bidding with header bidding wrappers and identity solutions.',
    url: 'https://pubmatic.com',
    color: '#4fc8ed',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'pubx-ai',
    name: 'pubX.ai',
    shortName: 'pubX',
    // The beacon domain pbxai.com is DELIBERATELY distinct from the corporate domain pubx.ai —
    // do NOT add pubx.ai (marketing, docs, logged-in publisher dashboard) and do NOT wildcard
    // the pbxai.com apex (bi.pbxai.com is dashboard-shaped). floor.pbxai.com is confirmed
    // verbatim as the RTD provider's default endpoint. This is yield optimisation, NOT call
    // tracking — the name collides with a well-known PBX vendor.
    patterns: [
      'api.pbxai.com',
      'floor.pbxai.com'
    ],
    category: 'ad-tech',
    description: 'Prebid.js header-bidding yield optimisation — an analytics adapter ingests bid-stream data and a real-time-data provider returns AI-generated dynamic price floors.',
    url: 'https://pubx.ai/',
    color: '#f05223',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'pulsepoint',
    name: 'Pulsepoint',
    shortName: 'Pulsepoint',
    patterns: [
      'contextweb.com',
      'bh.contextweb.com',
      'bid.contextweb.com',
      'tag.contextweb.com'
    ],
    category: 'ad-tech',
    description: 'Health-specialized supply-side platform and programmatic exchange.',
    url: 'https://www.pulsepoint.com',
    color: '#26C6DA',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'rakuten-advertising',
    name: 'Rakuten Advertising',
    shortName: 'Rakuten Ads',
    patterns: [
      'track.linksynergy.com',
      'ad.linksynergy.com',
      'click.linksynergy.com',
      'tag.rmp.rakuten.com'
    ],
    category: 'ad-tech',
    description: 'Global affiliate marketing network (formerly LinkShare) for performance-based partnerships and conversion tracking.',
    url: 'https://rakutenadvertising.com',
    color: '#BF0000',
    colorVerified: true,
    iconVerified: true, // Simple Icons: Rakuten
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'relevant-digital',
    name: 'Relevant Digital',
    shortName: 'Relevant Digital',
    patterns: [
      /pbs.*\.relevant-digital\.com/,
      'relevant-digital.com',
      'a.rvlve.co',
      'rvlve.co'
    ],
    category: 'ad-tech',
    description: 'Swedish yield management platform with Prebid wrapper and header bidding optimization.',
    url: 'https://www.relevant-digital.com',
    color: '#00c389',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'rise',
    name: 'Rise',
    shortName: 'Rise',
    patterns: [
      'hb.yellowblue.io',
      's2s.yellowblue.io',
      'cs-server-s2s.yellowblue.io',
      'yellowblue.io'
    ],
    category: 'ad-tech',
    description: 'Video-first SSP with header bidding and CTV/OTT monetization solutions.',
    url: 'https://www.risecodes.com',
    color: '#6366f1',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'rockerbox',
    name: 'Rockerbox',
    shortName: 'Rockerbox',
    patterns: [
      'getrockerbox.com',
      'api.getrockerbox.com',
      't.rockerbox.com'
    ],
    category: 'ad-tech',
    description: 'Deduplicates conversions across all paid channels and models incrementality with holdout testing.',
    url: 'https://www.rockerbox.com',
    color: '#6969f9',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'rtb-house',
    name: 'RTB House',
    shortName: 'RTB House',
    patterns: [
      'creativecdn.com/tags',
      'creativecdn.com/collect',
      'esp.rtbhouse.com',
      // subdomain host - the existing 'creativecdn.com/tags' PATH pattern does not match it
      'tags.creativecdn.com'
    ],
    category: 'ad-tech',
    description: 'AI-powered retargeting and personalized advertising platform.',
    url: 'https://www.rtbhouse.com',
    color: '#EC4434',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-07-21'
  },
  {
    id: 'seedtag',
    name: 'Seedtag',
    shortName: 'Seedtag',
    patterns: [
      's.seedtag.com',
      'seedtag.com',
      'config.seedtag.com',
      't.seedtag.com'
    ],
    category: 'ad-tech',
    description: 'Contextual AI advertising platform that targets ads based on page content without cookies.',
    url: 'https://www.seedtag.com',
    color: '#e85d64',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'sharethrough',
    name: 'Sharethrough',
    shortName: 'Sharethrough',
    patterns: [
      'btlr.sharethrough.com',
      'match.sharethrough.com',
      'native.sharethrough.com',
      'sharethrough.com'
    ],
    category: 'ad-tech',
    description: 'Omnichannel SSP focused on native ads, enhanced display, and CTV inventory.',
    url: 'https://www.sharethrough.com',
    color: '#2ecc71',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'simplifi',
    name: 'Simplifi',
    shortName: 'Simplifi',
    patterns: [
      'simpli.fi',
      'um.simpli.fi',
      'i.simpli.fi',
      'tag.simpli.fi'
    ],
    category: 'ad-tech',
    description: 'Programmatic DSP with location-based targeting, search retargeting, and geo-fencing.',
    url: 'https://simpli.fi',
    color: '#1565C0',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'singleview',
    name: 'SingleView (R.O.EYE / Awin)',
    shortName: 'SingleView',
    patterns: [
      'lantern.roeye.com',
      'lantern.roeyecdn.com'
    ],
    category: 'ad-tech',
    description: 'Multi-touch attribution platform built by R.O.EYE, now operated by Awin. Tracks cross-channel touch points to attribute sales to marketing channels via a fingerprint pixel.',
    url: 'https://www.awin.com/gb/awin-for-advertisers/awin-singleview',
    color: '#E65C00',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'smaato',
    name: 'Smaato',
    shortName: 'Smaato',
    patterns: [
      'smaato.net',
      's.ad.smaato.net',
      'prebid.ad.smaato.net'
    ],
    category: 'ad-tech',
    description: 'Mobile-first supply-side platform and ad exchange, owned by Verve Group.',
    url: 'https://www.smaato.com',
    color: '#FF9800',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'smilewanted',
    name: 'SmileWanted',
    shortName: 'SmileWanted',
    patterns: [
      'prebid.smilewanted.com',
      'smilewanted.com'
    ],
    category: 'ad-tech',
    description: 'French SSP specializing in header bidding and programmatic monetization.',
    url: 'https://www.smilewanted.com',
    color: '#ffcc00',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'sonobi',
    name: 'Sonobi',
    shortName: 'Sonobi',
    patterns: [
      'sonobi.com',
      'sync.go.sonobi.com',
      'apex.go.sonobi.com'
    ],
    category: 'ad-tech',
    description: 'Header-bidding-focused ad exchange with direct-to-publisher integrations.',
    url: 'https://sonobi.com',
    color: '#1E88E5',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'sovrn',
    name: 'Sovrn',
    shortName: 'Sovrn',
    patterns: [
      'ap.lijit.com',
      'pba.aws.lijit.com',
      'lijit.com'
    ],
    category: 'ad-tech',
    description: 'Publisher technology company with exchange, header bidding, and commerce solutions.',
    url: 'https://www.sovrn.com',
    color: '#00b2a9',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'stackadapt',
    name: 'StackAdapt',
    shortName: 'StackAdapt',
    patterns: [
      'stackadapt.com',
      'tags.srv.stackadapt.com',
      'sync.srv.stackadapt.com'
    ],
    category: 'ad-tech',
    description: 'Self-serve programmatic DSP for native, display, video, CTV, and in-game advertising.',
    url: 'https://www.stackadapt.com',
    color: '#4A25E1',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'taboola',
    name: 'Taboola',
    shortName: 'Taboola',
    patterns: [
      'trc.taboola.com',
      'trc-events.taboola.com',
      'cdn.taboola.com',
      'api.taboola.com',
      'popup.taboola.com',
      'nr.taboola.com'
    ],
    category: 'ad-tech',
    description: 'Native advertising platform for content recommendation and discovery networks.',
    url: 'https://www.taboola.com',
    color: '#151318',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'tapad',
    name: 'Tapad',
    shortName: 'Tapad',
    patterns: [
      'tapad.com',
      'pixel.tapad.com',
      'tag.tapad.com',
      'tapestry.tapad.com'
    ],
    category: 'ad-tech',
    description: 'Cross-device identity graph and audience matching platform, owned by Experian.',
    url: 'https://www.tapad.com',
    color: '#36B5A0',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'teads',
    name: 'Teads',
    shortName: 'Teads',
    patterns: [
      't.teads.tv',
      'a.teads.tv'
    ],
    category: 'ad-tech',
    description: 'Outstream video advertising platform for publishers and brand advertisers.',
    url: 'https://www.teads.com',
    color: '#00c8ff',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'temu-ads',
    name: 'Temu Ads',
    shortName: 'Temu Ads',
    patterns: [
      /temu\.com\/api\/adx/,
      'www.temu.com/api/adx'
    ],
    category: 'ad-tech',
    description: 'E-commerce ad exchange by Pinduoduo/PDD Holdings with cross-platform cookie matching.',
    url: 'https://www.temu.com',
    color: '#F26522',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'thetradedesk',
    name: 'The Trade Desk',
    shortName: 'The Trade Desk',
    patterns: [
      'insight.adsrvr.org',
      'match.adsrvr.org',
      'js.adsrvr.org',
      'tracking.adsrvr.org',
      'data.adsrvr.org'
    ],
    category: 'ad-tech',
    description: 'Independent demand-side platform for programmatic advertising across channels.',
    url: 'https://www.thetradedesk.com',
    color: '#0099fa',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'tradedoubler',
    name: 'Tradedoubler',
    shortName: 'Tradedoubler',
    patterns: [
      'tradedoubler.com/track',
      'clk.tradedoubler.com'
    ],
    category: 'ad-tech',
    description: 'European affiliate marketing network connecting advertisers with publishers.',
    url: 'https://www.tradedoubler.com',
    color: '#2b73ff',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'triplelift',
    name: 'TripleLift',
    shortName: 'TripleLift',
    patterns: [
      'tlx.3lift.com',
      'eb2.3lift.com',
      'ib.3lift.com',
      '3lift.com'
    ],
    category: 'ad-tech',
    description: 'Native advertising exchange with in-feed, branded content, and video ad formats.',
    url: 'https://triplelift.com',
    color: '#f26722',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'triton-digital',
    name: 'Triton Digital',
    shortName: 'Triton',
    patterns: [
      // Catches every observed Triton subdomain (idsync, yield-op-idsync, playerservices,
      // cmod-world) plus future siblings, across environments. Leading dot ensures we
      // don't match the bare marketing-redirect root or substring-collide with unrelated
      // domains. Excluded by design: the bare streamtheworld.com (no preceding dot).
      '.streamtheworld.com'
    ],
    category: 'ad-tech',
    description: 'Audio-streaming infrastructure and identity sync — the dominant digital-audio platform for radio and podcasts (2,000+ stations across 25 countries; owned by iHeartMedia since 2021).',
    url: 'https://www.tritondigital.com',
    color: '#0A4D74',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-04-29'
  },
  {
    id: 'tune',
    name: 'TUNE (HasOffers)',
    shortName: 'TUNE',
    patterns: [
      'go2sdk.com',
      'tune.com',
      'hasoffers.com'
    ],
    category: 'ad-tech',
    description: 'Partner marketing and affiliate attribution platform for mobile and web.',
    url: 'https://www.tune.com',
    color: '#4280ff',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'turn',
    name: 'Turn/Amobee',
    shortName: 'Turn/Amobee',
    patterns: [
      'ad.turn.com',
      'r.turn.com'
    ],
    category: 'ad-tech',
    description: 'Demand-side platform for programmatic advertising (now part of Amobee/Tremor).',
    url: 'https://www.amobee.com',
    color: '#3860be',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  // --- DSPs ---
  {
    id: 'viant',
    name: 'Viant/Adelphic',
    shortName: 'Viant/Adelphic',
    patterns: [
      'ipredictive.com',
      'sync.ipredictive.com',
      'js.ipredictive.com',
      'ad.ipredictive.com'
    ],
    category: 'ad-tech',
    description: 'People-based demand-side platform for programmatic ad buying (Adelphic DSP).',
    url: 'https://www.viantinc.com',
    color: '#E040FB',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'xandr',
    name: 'Xandr',
    shortName: 'Xandr',
    patterns: [
      'acdn.adnxs.com',
      'ib.adnxs.com',
      'secure.adnxs.com',
      'prebid.adnxs.com'
    ],
    category: 'ad-tech',
    description: 'Microsoft ad marketplace powering both buy-side (Invest) and sell-side (Monetize) programmatic deals.',
    url: 'https://www.xandr.com',
    color: '#fc5047',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'yieldlab',
    name: 'Yieldlab',
    shortName: 'Yieldlab',
    patterns: [
      'ad.yieldlab.net',
      'yieldlab.net'
    ],
    category: 'ad-tech',
    description: 'German SSP (Virtual Minds) with private marketplace and programmatic guaranteed deals.',
    url: 'https://www.yieldlab.de',
    color: '#e63329',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'yieldmo',
    name: 'YieldMo',
    shortName: 'YieldMo',
    patterns: [
      'yieldmo.com',
      'ads.yieldmo.com',
      'static.yieldmo.com',
      'matchadsrvr.yieldmo.com'
    ],
    category: 'ad-tech',
    description: 'Mobile-first programmatic ad exchange with high-impact ad formats.',
    url: 'https://www.yieldmo.com',
    color: '#00BFA5',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'zeta-global',
    name: 'Zeta Global',
    shortName: 'Zeta Global',
    patterns: [
      'rfihub.com',
      'p.rfihub.com',
      'a.rfihub.com',
      'zetaglobal.com',
      'cdn.boomtrain.com',
      'events.api.boomtrain.com',
      'onsiterecs.api.boomtrain.com',
      'people.api.boomtrain.com'
    ],
    category: 'ad-tech',
    description: 'AI-powered data platform for audience targeting, identity resolution, and marketing automation.',
    url: 'https://zetaglobal.com',
    color: '#0033A0',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },

  // === ADVERTISING ===
  {
    id: '6sense',
    name: '6sense',
    shortName: '6sense',
    patterns: [
      'j.6sc.co',
      '6sc.co',
      'b.6sc.co',
      '6sense.com/api',
      // subdomain-anchored: the 6sense.com apex is the marketing site
      'epsilon.6sense.com'
    ],
    category: 'advertising',
    description: 'B2B intent data and account engagement platform for revenue intelligence.',
    url: 'https://6sense.com',
    color: '#0dbf7e',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-07-21'
  },
  {
    id: 'adjust',
    name: 'Adjust',
    shortName: 'Adjust',
    patterns: [
      'cdn.adjust.com',
      'app.adjust.com',
      'app.adjust.net.in',
      'app.adjust.world',
      'eu.adjust.com',
      'tr.adjust.com',
      'us.adjust.com',
      's2s.adjust.com'
    ],
    category: 'advertising',
    description: 'Mobile measurement and attribution platform with web SDK for cross-device and web-to-app tracking.',
    url: 'https://www.adjust.com',
    color: '#005ff7',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-19'
  },
  {
    id: 'adot',
    name: 'Adot (Veepee|ad Connect)',
    shortName: 'Adot',
    patterns: ['.tracker.adotmob.com'],
    category: 'advertising',
    description: 'French programmatic advertising DSP and retail-media platform (formerly Adotmob, rebranded to Veepee|ad Connect in 2025); cross-device audience identification and ad delivery via tracking pixels.',
    url: 'https://veepee-ad.com/en/',
    color: '#E6004C',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'adscale',
    name: 'AdScale',
    shortName: 'AdScale',
    // HOST COMPLETENESS INCOMPLETE: only the telemetry-observed collector is verified.
    // A sibling ecommerce-events.adscale.com is plausible but UNVERIFIED — add only on a
    // confirmed sighting. Never wildcard the apex (marketing + merchant dashboard).
    // Colour is the Brandfetch `dark` token, not `accent`: the accent (#8fa5d3) is a pale
    // tint that reads poorly as a badge and is not the recognisable brand navy.
    patterns: [
      'ecommerce-events-lb.adscale.com'
    ],
    category: 'advertising',
    description: 'AI advertising automation for e-commerce merchants, collecting first-party storefront events to run and optimise Google and Meta campaigns.',
    url: 'https://adscale.com/',
    color: '#1a2c6f',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'appsflyer',
    name: 'AppsFlyer',
    shortName: 'AppsFlyer',
    patterns: [
      'appsflyer.com',
      'onelink.me'
    ],
    category: 'advertising',
    description: 'Smart banners and deep linking for web-to-app marketing campaigns.',
    url: 'https://www.appsflyer.com',
    color: '#00C2FF',
    colorVerified: true,
    textColor: '#009acc',
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'bing',
    name: 'Bing Ads',
    shortName: 'Bing Ads',
    patterns: [
      'bat.bing.com',
      'bat.r.msn.com',
      'c.bing.com',
      'bing.com/action/0',
      'bat.bing.com/action',
      // Microsoft UET alternate ccTLD variant of bat.bing.com. Same vendor (Microsoft
      // Advertising), same product (Bing Ads UET), byte-identical /actionp/0?ti=<UET-tag-id>
      // payload shape. Tracking-only apex (Microsoft corporate / Bing search on .com).
      'bat.bing.net'
    ],
    category: 'advertising',
    description: 'Microsoft Universal Event Tracking (UET) for search and native ad conversion tracking.',
    url: 'https://ads.microsoft.com',
    color: '#00A4EF',
    colorVerified: true,
    iconVerified: false,
    parsing: { customParser: true, formattedParser: true },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-05-26'
  },
  {
    id: 'blue-retargeting',
    name: 'Blue (Retargeting)',
    shortName: 'Blue',
    patterns: [
      'widget.getblue.io'
    ],
    category: 'advertising',
    description: 'AI/ML-driven retargeting and recommendation adtech platform (OC Group) that tracks on-site behavior and serves personalized retargeting banners.',
    url: 'https://web.getblue.io',
    color: '#0067b8',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.1',
    addedDate: '2026-06-02'
  },
  {
    id: 'bombora',
    name: 'Bombora',
    shortName: 'Bombora',
    patterns: [
      'ml314.com',
      'tag.ml314.com',
      'd.ml314.com'
    ],
    category: 'advertising',
    description: 'B2B intent data provider measuring content consumption across the web.',
    url: 'https://bombora.com',
    color: '#ec7e1e',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'branch',
    name: 'Branch.io',
    shortName: 'Branch',
    patterns: [
      'branch.io',
      'api2.branch.io'
    ],
    category: 'advertising',
    description: 'Deep linking platform for web-to-app journeys and smart banners.',
    url: 'https://branch.io',
    color: '#00bd70',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'channelsight',
    name: 'ChannelSight',
    shortName: 'ChannelSight',
    patterns: [
      'channelsight.com',
      'tracking.channelsight.com',
      'api.channelsight.com'
    ],
    category: 'advertising',
    description: 'Where-to-buy solution connecting brand product pages to retailer checkout.',
    url: 'https://www.channelsight.com',
    color: '#525dd3',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'claydar',
    name: 'Claydar',
    shortName: 'Claydar',
    patterns: [
      'api.claydar.com',
      'static.claydar.com',
      'cdn.claydar.com',
      'claydar.com/tracker'
    ],
    category: 'advertising',
    description: 'B2B lead intelligence platform for identifying anonymous website visitors.',
    url: 'https://www.claydar.com',
    color: '#4A90D9',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'clearbit',
    name: 'Clearbit',
    shortName: 'Clearbit',
    patterns: [
      'reveal.clearbit.com',
      'x.clearbitjs.com',
      'clearbitscripts.com',
      'tag.clearbitscripts.com'
    ],
    category: 'advertising',
    description: 'B2B data enrichment and visitor identification for marketing and sales intelligence.',
    url: 'https://clearbit.com',
    color: '#3e60f9',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'clerkio',
    name: 'Clerk.io',
    shortName: 'Clerk.io',
    patterns: [
      'cdn.clerk.io',
      'api.clerk.io',
      'clerk.io'
    ],
    category: 'advertising',
    description: 'AI-powered product recommendations and personalized search for e-commerce.',
    url: 'https://clerk.io',
    color: '#00bfd0',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'cometly',
    name: 'Cometly',
    shortName: 'Cometly',
    patterns: [
      't.cometlytrack.com'
    ],
    category: 'advertising',
    description: 'AI-powered ad attribution platform tracking the full customer journey from ad click to conversion.',
    url: 'https://cometly.com',
    color: '#0072FF',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-19'
  },
  {
    id: 'demandbase',
    name: 'Demandbase',
    shortName: 'Demandbase',
    patterns: [
      'tag.demandbase.com',
      'api.demandbase.com',
      'demandbase.com/autocomplete',
      // company-target.com is a Demandbase-owned ABM domain (ex-InsideView/Engagio
      // lineage); verified via Better.fyi + Netify tracker records 2026-07-21.
      'api.company-target.com'
    ],
    category: 'advertising',
    description: 'Account-based marketing (ABM) platform for B2B targeting, identification, and intent data.',
    url: 'https://www.demandbase.com',
    color: '#003DA5',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-07-21'
  },
  {
    id: 'doubleclick-cookie-match',
    name: 'Google Cookie Matching',
    shortName: 'Google Cookie Matching',
    patterns: [
      'cm.g.doubleclick.net/pixel',
      'cm.g.doubleclick.net',
      'cm.doubleclick.net'
    ],
    category: 'advertising',
    description: 'Real-time bidding (RTB) cookie synchronization between ad exchanges.',
    url: 'https://developers.google.com/authorized-buyers/rtb/cookie-guide',
    color: '#4285f4',
    colorVerified: true,
    consumesGCM: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'facebook',
    name: 'Facebook',
    shortName: 'Facebook',
    patterns: [
      'facebook.com/tr',
      'facebook.net/tr',
      'facebook.com/fr/',
      'connect.facebook.net',
      'connect.facebook.com'
    ],
    category: 'advertising',
    description: 'Meta Pixel for conversion tracking, audience building, and ad optimization.',
    url: 'https://www.facebook.com/business/tools/meta-pixel',
    color: '#1877f2',
    colorVerified: true,
    iconVerified: true,
    parsing: { customParser: true, formattedParser: true },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'favi',
    name: 'FAVI Partner Events',
    shortName: 'FAVI',
    // Multi-tenant, multi-country: each partner shop posts to partner-events.favi.<XX>/api/v1
    // where XX is the shop's country TLD — hence the trailing-dot suffix pattern, which
    // deliberately does NOT match partner-events.favicdn.net (own pattern below).
    patterns: [
      'partner-events.favi.',
      'partner-events.favicdn.net'
    ],
    category: 'advertising',
    description: 'Conversion and order tracking pixel installed by partner e-shops of FAVI, a Central/Eastern European furniture and home-decor price-comparison marketplace.',
    url: 'https://favionline.com/',
    color: '#891530',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'g2crowd',
    name: 'G2 Crowd',
    shortName: 'G2 Crowd',
    patterns: [
      'tracking.g2crowd.com',
      'tracking.g2crowd.com/attribution_tracking',
      'g2crowd.com/attribution_tracking'
    ],
    category: 'advertising',
    description: 'B2B software review platform with attribution tracking for marketing campaigns.',
    url: 'https://www.g2.com',
    color: '#FF492C',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'glami-pixel',
    name: 'GLAMI piXel',
    shortName: 'GLAMI',
    // The observed host was www.glami.cz — that is the CONSUMER MARKETPLACE and must never
    // be registered; it appears only as an img-src beacon fallback in merchant CSP guidance
    // with no documented path prefix. The pixel's own apex is glamipixel.com.
    patterns: [
      'glamipixel.com'
    ],
    category: 'advertising',
    description: 'Merchant-side conversion and retargeting pixel for GLAMI, a Czech/CEE fashion comparison-shopping engine, tracking product views, add-to-cart and purchases on partner e-shops.',
    url: 'https://www.glami.cz/info/pixel/',
    color: '#853cff',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    // Ordering: google-ads-conversion and google-ads-remarketing share
    // googleads.g.doubleclick.net but use distinct /pagead/* paths.
    id: 'google-ads-conversion',
    name: 'Google Ads Conversion',
    shortName: 'Google Ads Conversion',
    patterns: [
      'googleads.g.doubleclick.net/pagead/conversion',
      'googleads.g.doubleclick.net/pagead/viewthroughconversion',
      'googleads.g.doubleclick.net/pagead/1p-conversion',
      'googleads.g.doubleclick.net/pagead/conversion_async',
      'googleadservices.com/pagead/conversion',
      'googleadservices.com/pagead/viewthroughconversion',
      'googleadservices.com/pagead/1p-conversion',
      'googleadservices.com/pagead/conversion_async',
      'google.com/pagead/conversion',
      'google.com/pagead/viewthroughconversion',
      'google.com/pagead/1p-conversion',
      'google.com/pagead/conversion_async',
      // Google Ads routed through Google Consent Mode transport (/ccm/collect with AW-* conversion id).
      // Mirrors the dispatch in parsers/google-ccm.js so the diff engine and badge scanner
      // attribute the URL to the destination platform, not the transport. See BUG22.
      // Tested against the raw URL; `i` flag is defensive only (see ga4 entry).
      /google\.com\/ccm\/collect\?[^]*tids?=AW-/i
    ],
    category: 'advertising',
    description: 'Tracks conversions (purchases, signups, etc.) from Google Ads campaigns.',
    url: 'https://ads.google.com',
    color: '#4285f4',
    colorVerified: true,
    iconVerified: true,
    parsing: { customParser: true, formattedParser: true },
    consumesGCM: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'google-ads-remarketing',
    name: 'Google Ads Remarketing',
    shortName: 'Google Ads Remarketing',
    patterns: [
      'googleads.g.doubleclick.net/pagead/landing',
      'googleads.g.doubleclick.net/pagead/1p-user-list',
      'googleadservices.com/pagead/landing',
      'googleadservices.com/pagead/1p-user-list',
      'google.com/pagead/landing',
      'google.com/pagead/1p-user-list',
      // Google Ads remarketing routed through Google first-party mode (FPM) transport:
      // www.google.com/rmkt/collect/<AW conversion id>/?...&en=page_view&...  The numeric
      // path segment is the AW account; en=page_view is the audience signal. Newer than the
      // /ccm/collect route (BUG22). Path-scoped so the google.com apex (search/admin) is not
      // over-matched. See BUG49.
      'google.com/rmkt/collect'
    ],
    category: 'advertising',
    description: 'Builds audience lists for Google Ads remarketing and retargeting campaigns.',
    url: 'https://ads.google.com',
    color: '#34a853',
    colorVerified: true,
    iconVerified: true,
    parsing: { customParser: true, formattedParser: true },
    consumesGCM: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'google-audiences',
    name: 'Google Audiences',
    shortName: 'Google Audiences',
    patterns: [
      /google\.[a-z.]+\/ads\/ga-audiences/  // Matches all Google TLDs (google.com, google.dk, google.co.uk, etc.)
    ],
    category: 'advertising',
    description: 'Remarketing audience synchronization between Google Analytics and Google Ads.',
    url: 'https://support.google.com/analytics/answer/2611404',
    color: '#4285f4',
    colorVerified: true,
    consumesGCM: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'google-conversion-linker',
    name: 'Google Conversion Linker',
    shortName: 'Google Conversion Linker',
    patterns: [],  // Detected via CCM custom parser (shares /ccm/collect endpoint)
    category: 'advertising',
    description: 'Google Conversion Linker sets first-party cookies to store ad click information (GCLID, WBRAID, GBRAID) for cross-domain conversion tracking.',
    url: 'https://support.google.com/tagmanager/answer/7549390',
    color: '#4285f4',
    colorVerified: true,
    iconVerified: false,
    consumesGCM: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    // Ordering: must come after google-cm360 — both share ad.doubleclick.net
    // CM360 matches /ddm/ad/, /ddm/clk etc.; floodlight matches /ddm/activity and /activity
    id: 'google-floodlight',
    name: 'Google Floodlight',
    shortName: 'Google Floodlight',
    patterns: [
      /\.?fls\.doubleclick\.net\/activity/,
      'ad.doubleclick.net/ddm/activity',
      'ad.doubleclick.net/activity',
      // Floodlight routed through Google Consent Mode transport (/ccm/collect with DC-* advertiser id).
      // Mirrors the dispatch in parsers/google-ccm.js so the diff engine and badge scanner
      // attribute the URL to the destination platform, not the transport. See BUG22.
      // Tested against the raw URL; `i` flag is defensive only (see ga4 entry).
      /google\.com\/ccm\/collect\?[^]*tids?=DC-/i,
      // Floodlight / CM360 routed through Google first-party mode (FPM) transport:
      // www.google.com/gmp/conversion/...;src=<advertiser>;type=<activity>;cat=<activity>;ord=...
      // Same Floodlight param shape as ad.doubleclick.net/activity (BUG31), new transport
      // host/path. Path-scoped so the google.com apex is not over-matched. See BUG50.
      'google.com/gmp/conversion'
    ],
    category: 'advertising',
    description: 'Campaign Manager 360 / DV360 conversion tracking for enterprise advertisers.',
    url: 'https://support.google.com/campaignmanager/answer/2823450',
    color: '#4285f4',
    colorVerified: true,
    consumesGCM: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'google-shopping-ads',
    name: 'Google Shopping Ads',
    shortName: 'Google Shopping Ads',
    patterns: [
      'feedads.g.doubleclick.net'
    ],
    category: 'advertising',
    description: 'Product feed tracking for Google Shopping and Merchant Center campaigns.',
    url: 'https://merchants.google.com',
    color: '#4285f4',
    colorVerified: true,
    iconVerified: false,
    consumesGCM: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'groovinads',
    name: 'GroovinAds',
    shortName: 'GroovinAds',
    patterns: [
      /ads\d+\.groovinads\.com/i
    ],
    category: 'advertising',
    description: 'LATAM-based programmatic DSP and Dynamic Creative Optimization (DCO) platform serving display, DOOH, CTV, and retail media ads with built-in conversion tracking.',
    url: 'https://www.groovinads.com/',
    color: '#FF6900',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-11'
  },
  {
    id: 'kakao-pixel',
    name: 'Kakao Pixel',
    shortName: 'Kakao',
    patterns: [
      't1.daumcdn.net/kas/static/kp.js',
      't1.daumcdn.net/adfit/static/kp.js',
      'bc.ds.kakao.com',
      'bc.ad.daum.net'
    ],
    category: 'advertising',
    description: 'Conversion tracking pixel for KakaoMoment, Kakao\'s advertising platform for the South Korean market.',
    url: 'https://developers.kakao.com/docs/latest/en/kakaomoment/pixel-and-sdk',
    color: '#FFE812',
    colorVerified: true,
    iconVerified: true, // Simple Icons: KakaoTalk
    addedInVersion: '1.0.0',
    addedDate: '2026-03-19'
  },
  {
    id: 'line-tag',
    name: 'LINE Tag',
    shortName: 'LINE',
    patterns: [
      'tr.line.me/tag.gif',
      'd.line-scdn.net/n/line_tag/',
      'd.line-cdn.net/n/line_tag/'
    ],
    category: 'advertising',
    description: 'Conversion tracking pixel for LINE Ads, the dominant messaging platform in Japan, Thailand, and Taiwan.',
    url: 'https://lineforbusiness.com',
    color: '#06C755',
    colorVerified: true,
    iconVerified: true, // Simple Icons: LINE
    addedInVersion: '1.0.0',
    addedDate: '2026-03-19'
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    shortName: 'LinkedIn',
    patterns: [
      'px.ads.linkedin.com',
      'linkedin.com/px',
      'snap.licdn.com'
    ],
    category: 'advertising',
    description: 'Insight Tag for B2B conversion tracking, retargeting, and website demographics.',
    url: 'https://business.linkedin.com/marketing-solutions',
    color: '#0073B1',
    colorVerified: true,
    iconVerified: true,
    parsing: { customParser: true, formattedParser: true },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'mikmak',
    name: 'MikMak',
    shortName: 'MikMak',
    patterns: [
      // Catches every regional WTB tag-API shard (eu-west-1, future us-east-1 / ap-southeast-1
      // etc.), the central wtb-api-hub, and trace.swaven.com analytics endpoint. Leading dot
      // ensures we don't match the bare marketing-redirect root or substring-collide.
      // Excluded by design: the bare swaven.com (no preceding dot) which redirects to mikmak.com.
      '.swaven.com'
    ],
    category: 'advertising',
    description: 'Shoppable-media and where-to-buy platform — embeds checkout-routing widgets on brand product pages with closed-loop retailer-attribution analytics (formerly Swaven, acquired March 2023).',
    url: 'https://www.mikmak.com',
    color: '#1A1A1A',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-04-29'
  },
  {
    id: 'nosto',
    name: 'Nosto',
    shortName: 'Nosto',
    patterns: [
      'connect.nosto.com',
      'cdn.nosto.com',
      'api.nosto.com',
      'nosto.com'
    ],
    category: 'advertising',
    description: 'E-commerce personalization with product recommendations and behavioral pop-ups.',
    url: 'https://www.nosto.com',
    color: '#FF1BA4',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'nextdoor',
    name: 'Nextdoor Ads',
    shortName: 'Nextdoor',
    patterns: [
      'ads.nextdoor.com/public/pixel',
      'flask.nextdoor.com'
    ],
    category: 'advertising',
    description: 'Neighborhood social network advertising pixel for page view and conversion tracking on Nextdoor ad campaigns.',
    url: 'https://ads.nextdoor.com',
    color: '#8ED500',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-19'
  },
  {
    id: 'openai-ads',
    name: 'OpenAI Ads Measurement Pixel',
    shortName: 'OpenAI Ads',
    patterns: ['bzrcdn.openai.com', 'bzr.openai.com', 'bzrcdn.openai-staging.com', 'bzr.openai-staging.com'],
    category: 'advertising',
    description: 'OpenAI\'s JavaScript measurement pixel (OAIQ) for ChatGPT Ads — tracks post-click conversion events on advertiser sites.',
    url: 'https://developers.openai.com/ads/measurement-pixel',
    color: '#000000',
    colorVerified: false,
    iconVerified: true,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-15'
  },
  {
    id: 'paved',
    name: 'Paved',
    shortName: 'Paved',
    // Apex wildcard is deliberate and VERIFIED safe: pvdpix.com/ returns HTTP 404 with no
    // marketing site, docs or dashboard, and the pixel is served from the apex at /pixel.js.
    // All customer-facing Paved surfaces live on the separate paved.com apex.
    // Colour from a CLAIMED Brandfetch profile.
    patterns: [
      'pvdpix.com'
    ],
    category: 'advertising',
    description: 'Conversion pixel for Paved, a newsletter advertising marketplace, powering lookalike audiences and site demographics for advertisers running newsletter campaigns.',
    url: 'https://www.paved.com/',
    color: '#0e63f4',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    shortName: 'Pinterest',
    patterns: [
      'ct.pinterest.com',
      'pinterest.com/ct.html',
      'log.pinterest.com',
      // Pinterest Tag's hard-coded loader path (`/ct/core.js` + `/ct/lib/main.<hash>.js`).
      // Path-scoped to /ct/ because pinimg.com is Pinterest's general image CDN (pin
      // thumbnails, board art, logos, favicons) — apex wildcard would false-positive on
      // every Pinterest pin or Pin-It widget. EasyPrivacy blocks ||s.pinimg.com/ct/.
      's.pinimg.com/ct/'
    ],
    category: 'advertising',
    description: 'Conversion tracking tag for Pinterest ad campaigns and audience building.',
    url: 'https://business.pinterest.com',
    color: '#E60024',
    colorVerified: true,
    iconVerified: true,
    parsing: { customParser: true, formattedParser: true },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-05-26'
  },
  {
    id: 'plista',
    name: 'plista',
    shortName: 'plista',
    patterns: [
      'farm.plista.com'
    ],
    category: 'advertising',
    description: 'German native advertising and content recommendation network — serves widget impressions, click tracking, and behavioral retargeting via farm.plista.com.',
    url: 'https://www.plista.com',
    color: '#FF6600',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'podscribe',
    name: 'Podscribe',
    shortName: 'Podscribe',
    // pdscrb.com is a Podscribe-OPERATED ALIAS DOMAIN (created 2025-09-24, WHOIS privacy,
    // Amazon Registrar), confirmed by Podscribe's OWN CSP documentation - the classic
    // adblock-evasion alias pattern. Registering only the podscribe.com hosts would miss it.
    // The ipv4.* hosts force IPv4-only resolution so the server captures the client IPv4 address
    // alongside the dual-stack verifi.* call (hostname-convention reading is inferred, not
    // vendor-confirmed; no ipv6.* host was observed).
    // NO APEX WILDCARD: app.podscribe.com / app.podscribe.ai are the advertiser dashboard, and
    // preview-pr-*/feat-*/fix-issue-* branch deploys are visible in CT logs.
    // pixel.tapad.com appears in Podscribe's CSP but is Tapad (Experian) identity-graph
    // infrastructure, NOT Podscribe - deliberately not registered here.
    patterns: [
      '//verifi.podscribe.com',
      '//ipv4.podscribe.com',
      '//verifi.pdscrb.com',
      '//ipv4.pdscrb.com'
    ],
    category: 'advertising',
    description: 'Podcast and audio advertising attribution platform matching ad impressions to web conversions via household-level IP and identity-graph matching.',
    url: 'https://podscribe.com',
    color: '#4a3aff',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-22'
  },
  {
    id: 'quora',
    name: 'Quora',
    shortName: 'Quora',
    patterns: [
      'q.quora.com',
      'quora.com/_/ad'
    ],
    category: 'advertising',
    description: 'Conversion pixel for Quora Ads targeting professionals based on questions and topics.',
    url: 'https://www.quora.com/business',
    color: '#B92B27',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'readpeak',
    name: 'Readpeak',
    shortName: 'Readpeak',
    patterns: [
      'static.readpeak.com',
      'api.readpeak.com',
      'track.readpeak.com'
    ],
    category: 'advertising',
    description: 'Nordic native advertising platform for content recommendation and programmatic native ads.',
    url: 'https://www.readpeak.com',
    color: '#ff6b35',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'reddit',
    name: 'Reddit',
    shortName: 'Reddit',
    patterns: [
      'ads.reddit.com',
      'alb.reddit.com',
      'redditmedia.com/pixel',
      // Reddit Ads pixel-config endpoint — loader fetches per-pixel config after
      // rdt('init', '<pixel-id>'). Same SDK-handshake role as connect.facebook.net/fbevents.js.
      'pixel-config.reddit.com',
      // Canonical Reddit Pixel install path. Path-scoped to /ads/ because redditstatic.com
      // is Reddit's general static CDN (emoji, icons, web-app JS, mobile assets); apex
      // wildcard would flag every reddit.com visit. EasyPrivacy blocks ||s.redditstatic.com/ads/.
      'www.redditstatic.com/ads/'
    ],
    category: 'advertising',
    description: 'Conversion tracking for Reddit Ads targeting users by interest and community.',
    url: 'https://ads.reddit.com',
    color: '#FF4500',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-05-26'
  },
  {
    id: 'rokt',
    name: 'Rokt',
    shortName: 'Rokt',
    patterns: [
      'cdn.rokt.com',
      'apps.rokt.com',
      'api.rokt.com',
      'data.rokt.com'
    ],
    category: 'advertising',
    description: 'Transaction moment marketing platform showing personalized offers on checkout and confirmation pages.',
    url: 'https://www.rokt.com',
    color: '#B51E6D',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    // Ordering: must come after google-cm360 — both share ad.doubleclick.net
    // CM360 matches /ddm/clk (different substring from SA360's bare /clk)
    id: 'search-ads-360',
    name: 'Search Ads 360',
    shortName: 'Search Ads 360',
    patterns: [
      'ad.doubleclick.net/clk'
    ],
    category: 'advertising',
    description: 'Search management platform for enterprise advertisers managing campaigns across search engines.',
    url: 'https://marketingplatform.google.com/about/search-ads-360/',
    color: '#4285f4',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'seznam-sklik',
    name: 'Seznam Sklik / Zboží.cz',
    shortName: 'Sklik',
    // The observed host was www.zbozi.cz — that is the CONSUMER MARKETPLACE and must NOT be
    // registered. Standard Zbozi.cz conversion data goes server-to-server; the browser-side
    // surface is the c.seznam.cz retargeting/conversion trio below. Path-scoped so the rest
    // of seznam.cz (search, email, news portal) stays unmatched.
    patterns: [
      'c.seznam.cz/js/rc.js',
      'c.seznam.cz/retargeting',
      'c.seznam.cz/conv'
    ],
    category: 'advertising',
    description: 'Seznam.cz advertising stack for the Czech market — Sklik search and display retargeting plus Zboží.cz merchant conversion measurement.',
    url: 'https://www.sklik.cz/',
    color: '#cc0000',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'skai',
    name: 'Skai (Kenshoo)',
    shortName: 'Skai',
    patterns: [
      // xg4ken.com is a dedicated tracking apex (Skai's corporate site is skai.io);
      // covers numeric per-advertiser subdomains (e.g. 5138.) + the services. Match Pixel host.
      '.xg4ken.com'
    ],
    category: 'advertising',
    description: 'Skai (formerly Kenshoo) omnichannel marketing platform — its Match/conversion tracking pixel reports user and conversion activity from advertiser-specific subdomains on xg4ken.com.',
    url: 'https://skai.io',
    color: '#1a1a2e',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.1',
    addedDate: '2026-06-02'
  },
  {
    id: 'skimlinks',
    name: 'Skimlinks',
    shortName: 'Skimlinks',
    // Apex wildcards are safe on these two: both are tracking/redirect-only infrastructure.
    // .skimlinks.com is FORBIDDEN — it carries hub.skimlinks.com, the publisher dashboard.
    // Colour read from the official logo SVG's icon-mark fill. NOTE all three Brandfetch
    // records for this vendor are wrong (one is literally Google blue) — do not resync.
    patterns: [
      '.skimresources.com',
      '.redirectingat.com'
    ],
    category: 'advertising',
    description: 'Affiliate-link monetisation network for publishers, rewriting outbound merchant links at click time and tracking clicks, conversions and page context.',
    url: 'https://skimlinks.com',
    color: '#00B5D9',
    colorVerified: false,
    iconVerified: true,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'sleeknote',
    name: 'Sleeknote',
    shortName: 'Sleeknote',
    patterns: [
      'analytics.sleeknote.com',
      // Per-customer popup configs (numbered files by account ID — same s1 ID space the
      // multipart-form parser below uses). Apex sleeknote.com is shared with vendor
      // marketing (www.) and customer dashboard (app.) — enumerate tracking-only subdomains.
      'sleeknotecustomerscripts.sleeknote.com',
      // Sleeknote SDK core delivery (core.js, package-core-boot.js) — loader for the
      // popup configs above; firing this URL means the tracker is actively initialising.
      'sleeknotestaticcontent.sleeknote.com'
    ],
    category: 'advertising',
    description: 'Popup builder for lead generation, conversions, and on-site messaging with built-in analytics.',
    url: 'https://sleeknote.com',
    color: '#066756',
    colorVerified: true,
    iconVerified: false,
    parsing: {
      type: 'multipart-form',
      sources: ['formData'],
      eventName: { param: 'v8', default: 'pageview' },
      overview: {
        'Account ID': 's1',
        'Event Type': 'v8',
        'Page URL': 's4',
        'Page Title': 's2',
        'Hostname': 's3',
        'Referrer': 'v4'
      },
      details: {
        'Event': {
          'Event Type': 'v8',
          'Timestamp': 'v3'
        },
        'Page': {
          'URL': 's4',
          'Title': 's2',
          'Hostname': 's3',
          'Path': 's11',
          'Protocol': 's9',
          'Query': 's12',
          'Hash': 's13'
        },
        'User': {
          'Visitor ID': 'v0',
          'Session ID': 'v21',
          'First Visit': 'v6',
          'Last Visit': 'v7'
        },
        'Device': {
          'User Agent': 'v5',
          'Browser': 'v22',
          'Browser Version': 'v23',
          'OS': 'v24',
          'Device Type': 'v26',
          'Language': 's7',
          'Timezone Offset': 'c1'
        },
        'Tracking': {
          'Account ID': 's1',
          'Referrer': 'v4',
          'Scroll Depth': 'v27'
        }
      }
    },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-05-26'
  },
  {
    id: 'smind-cpx',
    name: 'sMind CPX',
    shortName: 'sMind CPX',
    // Request shape / payload UNVERIFIED — no public vendor implementation docs and the
    // urlscan detail requires auth. Confirm with a capture sweep before writing a parser.
    // Category is a judgment call: advertising, because the pixel serves comparison-shopping
    // campaign attribution rather than site-owner analytics.
    patterns: [
      'cpx.smind.hr',
      'cpx.smind.si',
      'cpx.smind.rs'
    ],
    category: 'advertising',
    description: 'Merchant-side conversion tracking pixel for the Ceneje Group price-comparison network (jeftinije.hr, ceneje.si, idealno.rs).',
    url: 'https://smind.hr/',
    color: '#ff660a',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'snapchat',
    name: 'Snapchat',
    shortName: 'Snapchat',
    patterns: [
      'tr.snapchat.com',
      'sc-static.net/scevent',
      'tr6.snapchat.com',
      'gcp.api.snapchat.com'
    ],
    category: 'advertising',
    description: 'Snap Pixel for conversion tracking and audience building on Snapchat Ads.',
    url: 'https://forbusiness.snapchat.com',
    color: '#FFCC00',
    colorVerified: true,
    textColor: '#000000',
    iconVerified: true,
    parsing: { customParser: true, formattedParser: true },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'sojern',
    name: 'Sojern',
    shortName: 'Sojern',
    patterns: [
      'pixel.sojern.com',
      'beacon.sojern.com'
    ],
    category: 'advertising',
    description: 'Travel advertising platform using pixel-based retargeting to convert travel shoppers across hotels, airlines, and destinations.',
    url: 'https://www.sojern.com',
    color: '#E35F3E',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-06'
  },
  {
    id: 'spotify-ad-analytics',
    name: 'Spotify Ad Analytics',
    shortName: 'Spotify Ads',
    // Distinct from the `spotify` entry (video/embed telemetry) — this is the podcast-ad
    // attribution pixel, formerly Podsights. adanalytics.spotify.com is the CUSTOMER
    // DASHBOARD and is deliberately NOT a pattern; the sibling spotify entry was narrowed
    // on 2026-07-21 so its analytics.spotify.com pattern stops swallowing it.
    // Colour from a CLAIMED Brandfetch profile (#1ED760 is current; #1DB954 is the old green).
    patterns: [
      'ping.pdst.fm',
      'cdn.pdst.fm/ping',
      'pixel.byspotify.com',
      'pixels.spotify.com'
    ],
    category: 'advertising',
    description: 'Podcast advertising attribution pixel (formerly Podsights) that matches podcast ad exposure to on-site conversions such as purchases and leads.',
    url: 'https://adanalytics.spotify.com',
    color: '#1ED760',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'streetmetrics',
    name: 'StreetMetrics',
    shortName: 'StreetMetrics',
    // Register the pixel. subdomain ONLY — never a .streetmetrics.io apex wildcard. That apex
    // carries dashboard. (customer login), admin. + admin-test. (internal admin UI), docs.,
    // blog., info. and polygon. Corporate marketing is on the separate streetmetrics.com.
    patterns: [
      'pixel.streetmetrics.io'
    ],
    category: 'advertising',
    description: 'Out-of-home advertising measurement platform that models transit and stationary ad exposure from mobility signals and ties it to site visits and conversions.',
    url: 'https://www.streetmetrics.com/',
    color: '#07c0c7',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'strossle',
    name: 'Strossle',
    shortName: 'Strossle',
    patterns: [
      'assets.strossle.com',
      'api.strossle.com',
      'widgets.strossle.com'
    ],
    category: 'advertising',
    description: 'Swedish content recommendation and native advertising platform for publishers.',
    url: 'https://www.strossle.com',
    color: '#00b4d8',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    shortName: 'TikTok',
    patterns: [
      'analytics.tiktok.com',
      'tiktok.com/i18n/pixel',
      'events.tiktok.com',
      'analytics-sg.tiktok.com',
      'an.tiktok.com',
      // TikTok's IPv6 enrichment beacon endpoint on alternate ccTLD. Verified TikTok-owned
      // via wildcard cert *.tiktokw.us + x-tt-trace-tag response header + Akamai CDN. Path
      // /ipv6/enrich_ipv6 routes IPv6 traffic through alternate ccTLDs to bypass IPv6-blocking
      // middleboxes (parallels Adobe Analytics' 2o7.net, Facebook's facebook.net).
      'analytics-ipv6.tiktokw.us',
      // tiktokw.us apex is tracking-only — TikTok's corporate/consumer/advertiser surfaces
      // all live on tiktok.com. Apex wildcard appropriate per the platform-files rule's
      // "tracking-only apex" exception.
      '.tiktokw.us'
    ],
    category: 'advertising',
    description: 'TikTok Pixel for conversion tracking and audience building on TikTok Ads.',
    url: 'https://ads.tiktok.com',
    color: '#000000',
    colorVerified: true,
    iconVerified: true,
    parsing: { customParser: true, formattedParser: true },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-05-26'
  },
  {
    id: 'tripadvisor',
    name: 'Tripadvisor',
    shortName: 'Tripadvisor',
    patterns: [
      'tamgrt.com',
      'tripadvisor.com/js3/conversion'
    ],
    category: 'advertising',
    description: 'Conversion tracking pixel for travel and hospitality advertisers on Tripadvisor.',
    url: 'https://www.tripadvisor.com',
    color: '#34E0A1',
    colorVerified: false,
    textColor: '#1a8c5e',
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'trybe',
    name: 'Trybe',
    shortName: 'Trybe',
    // The observed host was the BARE APEX and must not be registered as-is: jointrybe.com/
    // serves the marketing site, /auth/signup, and the brand dashboard. Only /attribution/
    // is a verified tracking surface, so the pattern is path-scoped.
    patterns: [
      'jointrybe.com/attribution/'
    ],
    category: 'advertising',
    description: 'Performance-based creator-commission platform attributing Shopify orders back to individual creators via a storefront pixel.',
    url: 'https://jointrybe.com/',
    color: '#4a23b6',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'twitter',
    name: 'Twitter/X',
    shortName: 'Twitter/X',
    patterns: [
      'static.ads-twitter.com',
      'analytics.twitter.com',
      't.co/i/adsct'
    ],
    category: 'advertising',
    description: 'X Pixel (formerly Twitter) for conversion tracking and website event audiences.',
    url: 'https://ads.x.com',
    color: '#000000',
    colorVerified: true,
    iconVerified: true,
    parsing: { customParser: true, formattedParser: true },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'veritone-attribute',
    name: 'Veritone Attribute Pixel',
    shortName: 'Veritone Attribute',
    patterns: [
      'pixel.veritone-ce.com',
      'p.veritone-ce.com'
    ],
    category: 'advertising',
    description: 'Ad attribution pixel from Veritone (Attribute product) measuring web traffic driven by streaming audio and broadcast advertising campaigns.',
    url: 'https://www.veritone.com/applications/attribute/',
    color: '#000000',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-11'
  },
  {
    id: 'vibe',
    name: 'Vibe',
    shortName: 'Vibe',
    // t6.vibe.co is the IPv6 TWIN of t.vibe.co (SITE_CENTRIC_ENDPOINT vs SITE_CENTRIC_V6_
    // ENDPOINT), NOT a shard index — there is no t1-t5/t7-t9 family, so do NOT generalise
    // to a t\d+ regex. Colour from a CLAIMED Brandfetch profile.
    patterns: [
      't.vibe.co',
      't6.vibe.co',
      's.vibe.co'
    ],
    category: 'advertising',
    description: 'Self-serve Connected TV and streaming advertising platform whose site pixel attributes web conversions to CTV ad exposure via household IP matching.',
    url: 'https://www.vibe.co/',
    color: '#4f46e5',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'zoominfo',
    name: 'ZoomInfo',
    shortName: 'ZoomInfo',
    patterns: [
      'ws.zoominfo.com',
      'pixel.zoominfo.com',
      'zoominfo.com/pixel',
      'js.zi-scripts.com',
      'aorta.clickagy.com' // Clickagy acquired by ZoomInfo in 2020
    ],
    category: 'advertising',
    description: 'B2B data platform for sales and marketing intelligence with visitor identification.',
    url: 'https://www.zoominfo.com',
    color: '#00A6A6',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },

  // === MARKETING AUTOMATION ===
  {
    id: 'activecampaign',
    name: 'ActiveCampaign',
    shortName: 'ActiveCampaign',
    patterns: [
      'trackcmp.net',
      'app-us1.com',
      'app-eu1.com'
    ],
    category: 'marketing-automation',
    description: 'Email marketing and marketing automation platform with CRM capabilities.',
    url: 'https://www.activecampaign.com',
    color: '#356ae6',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'agillic',
    name: 'Agillic',
    shortName: 'Agillic',
    patterns: [
      '.agillic.eu'
    ],
    category: 'marketing-automation',
    description: 'Danish/Nordic omnichannel marketing-automation platform (email, SMS, push, on-page behavioral tracking) with first-party recipient identification via a JS pixel and ag-uid cookie.',
    url: 'https://agillic.com',
    color: '#1A2A4A',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-26'
  },
  {
    id: 'airship',
    name: 'Airship',
    shortName: 'Airship',
    patterns: [
      'web-sdk.urbanairship.com',
      'combine.urbanairship.com',
      'device-api.urbanairship.com',
      'go.airship.com'
    ],
    category: 'marketing-automation',
    description: 'Mobile-first customer engagement platform with push, SMS, and in-app messaging.',
    url: 'https://www.airship.com',
    color: '#2a55dd',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'apsis-one',
    name: 'APSIS One',
    shortName: 'APSIS',
    patterns: [
      'static.ws.apsis.one',
      'static.ws-apac.apsis.one'
    ],
    category: 'marketing-automation',
    description: 'Nordic marketing-automation and customer-experience platform (email, SMS, web tracking, automation flows) owned by Efficy Group; tracking script feeds visitor behaviour into Audience Profiles.',
    url: 'https://apsis.com',
    color: '#FF4F87',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-28'
  },
  {
    id: 'attentive',
    name: 'Attentive',
    shortName: 'Attentive',
    // attn.tv is tracking-only infrastructure end to end, so the apex wildcard is safe here:
    // the merchant dashboard is ui.attentivemobile.com and corporate marketing is
    // www.attentive.com -- both different registrable domains. The wildcard is REQUIRED
    // because collection rides a per-merchant subdomain (<brand>-<country>.attn.tv, 863+
    // observed and growing with the customer base), which cannot be enumerated. The tag JS
    // stayed on cdn.attn.tv/<merchant>/dtag.js, which is why the tag matched while every
    // actual data call fell through to tools_unknown.
    // Do NOT wildcard attentivemobile.com -- that apex carries ui. (dashboard) and help.
    patterns: [
      '.attn.tv',
      // REMOVED 2026-08-04: 'cdn.attn.tv' -- strictly subsumed by the '.attn.tv' wildcard
      // above. No coverage loss; this was a redundant duplicate, not an over-breadth removal.
      'api.attentivemobile.com',
      'events.attentivemobile.com'
    ],
    category: 'marketing-automation',
    description: 'Two-tap mobile sign-up and conversational SMS flows optimized for e-commerce cart abandonment and promotions.',
    url: 'https://www.attentive.com',
    color: '#D4AF00',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-08-04'
  },
  {
    id: 'automizely-analytics',
    name: 'Automizely (AfterShip)',
    shortName: 'Automizely',
    patterns: [
      '.automizely-analytics.com'
    ],
    category: 'marketing-automation',
    description: 'Marketing-automation and onsite personalization analytics for Shopify stores, part of AfterShip’s Automizely suite (email, SMS, popups, personalization, reviews).',
    url: 'https://www.aftership.com/automizely',
    color: '#1a1a1a',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-11'
  },
  {
    id: 'bluecore',
    name: 'Bluecore',
    shortName: 'Bluecore',
    patterns: [
      'api.bluecore.app'
    ],
    category: 'marketing-automation',
    description: 'Retail e-commerce personalization and triggered-marketing platform that collects shopper behavior and product-signal events to power 1:1 email, SMS, site, and paid-media campaigns.',
    url: 'https://www.bluecore.com',
    color: '#1a5bf6',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.1',
    addedDate: '2026-06-02'
  },
  {
    id: 'braze',
    name: 'Braze',
    shortName: 'Braze',
    patterns: [
      'sdk.iad-01.braze.com',
      'sdk.iad-02.braze.com',
      'sdk.iad-03.braze.com',
      'sdk.fra-01.braze.eu',
      'sdk.fra-02.braze.eu',
      '.braze.com/api/',
      '.braze.eu/api/',
      'js.appboycdn.com',
      'appboycdn.com'
    ],
    category: 'marketing-automation',
    description: 'Orchestrates push, email, SMS, and in-app messages based on real-time user behavior and lifecycle stage.',
    url: 'https://www.braze.com',
    parsing: { customParser: true, formattedParser: true },
    color: '#801DD7',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'byside',
    name: 'BySide',
    shortName: 'BySide',
    // PATH-SCOPED deliberately: webcare.byside.com is dual-purpose — it serves the visitor-
    // facing Active TAG (/agent/) and content endpoints (/BWA<id>/), but the HOST ROOT is the
    // logged-in customer backoffice (CoreMedia Engagement Studio). A bare host pattern would
    // flag every customer's own admin console.
    patterns: [
      'webcare.byside.com/agent/',
      'webcare.byside.com/BWA'
    ],
    category: 'marketing-automation',
    description: 'Customer-engagement and personalisation platform (now sold as CoreMedia Engagement Cloud) whose Active TAG collects on-site behaviour to drive real-time targeting.',
    url: 'https://www.coremedia.com/',
    color: '#d82e21',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'clevertap',
    name: 'CleverTap',
    shortName: 'CleverTap',
    patterns: [
      'wzrkt.com',
      'clevertap-prod.com',
      'in.wzrkt.com',
      'eu1.wzrkt.com'
    ],
    category: 'marketing-automation',
    description: 'Mobile-first engagement platform with RFM segmentation, predictive churn scoring, and regional data residency.',
    url: 'https://clevertap.com',
    color: '#1076FB',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'common-room',
    name: 'Common Room',
    shortName: 'Common Room',
    patterns: [
      // Anti-adblock relay apex (Common-Room-only per circumstantial evidence —
      // urlscan shows cr-relay.com on 10+ B2B SaaS sites matching Common Room's
      // customer profile; vendor publishes the tracking-domain only via per-customer
      // CSP whitelists, not public docs. Same anti-adblock pattern as Statsig's
      // featureassets.org and Sourcepoint's privacy-mgmt.com).
      'api.cr-relay.com',
      'cdn.cr-relay.com'
    ],
    category: 'marketing-automation',
    description: 'B2B community-intelligence and warm-outbound platform — identifies website visitors and surfaces buying signals from public and private channels.',
    url: 'https://www.commonroom.io',
    color: '#5E4DCD',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-15'
  },
  {
    id: 'convertflow',
    name: 'ConvertFlow',
    shortName: 'ConvertFlow',
    // Do NOT register bare 'app.convertflow.co' — that host also serves the authenticated
    // customer dashboard and login. The visitor-tracking surface is the /websites/<id>/visitors/
    // path, hence the regex (unanchored: patterns test the full URL incl. scheme).
    // Colour from a CLAIMED Brandfetch profile.
    patterns: [
      'js.convertflow.co',
      /app\.convertflow\.co\/websites\/\d+\/visitors\//i
    ],
    category: 'marketing-automation',
    description: 'Funnel, CTA, quiz and popup builder that captures leads and personalises on-site campaigns against a contact record.',
    url: 'https://www.convertflow.com/',
    color: '#003FFF',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'cordial',
    name: 'Cordial',
    shortName: 'Cordial',
    patterns: [
      'track.cordial.io',
      'track.usw2.cordial.com',
      'track.use1.cordial.com',
      'track-ehs-svc.cordial.com',
      'track-ehs-svc.usw2.cordial.com',
      'track-ehs-svc.use1.cordial.com',
      'events-handling-svc.cordial.io'
    ],
    category: 'marketing-automation',
    description: 'Cross-channel marketing platform with web JS Listener for behavioral tracking, page views, and contact identification.',
    url: 'https://cordial.com',
    color: '#FABC1C',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-19'
  },
  {
    id: 'convertkit',
    name: 'Kit (ConvertKit)',
    shortName: 'Kit',
    patterns: [
      'f.convertkit.com',
      'app.convertkit.com/forms',
      'api.convertkit.com/v3/forms',
      'api.kit.com/v4/forms'
    ],
    category: 'marketing-automation',
    description: 'Email marketing platform for creators with form embeds, subscriptions, and journey tracking.',
    url: 'https://kit.com',
    color: '#44B1FF',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-19'
  },
  {
    id: 'customerio',
    name: 'Customer.io',
    shortName: 'Customer.io',
    patterns: [
      'track.customer.io',
      'cdp.customer.io',
      'assets.customer.io',
      'customerioforms.com',
      // Gist (Customer.io's acquired in-app-messaging product) — kept under
      // the `customerio` brand per the buyer-facing UX decision (merge rather
      // than split). Add more `*.gist.build` subdomains here as they surface.
      'consumer.cloud.gist.build'
    ],
    category: 'marketing-automation',
    description: 'Event-triggered messaging with a code-friendly API, Liquid templating, and data warehouse sync.',
    url: 'https://customer.io',
    color: '#3B0B22',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'drip',
    name: 'Drip',
    shortName: 'Drip',
    patterns: [
      'api.getdrip.com',
      'tag.getdrip.com',
      'getdrip.com/forms'
    ],
    category: 'marketing-automation',
    description: 'E-commerce marketing automation with email campaigns, on-site behavior tracking, and revenue attribution.',
    url: 'https://www.drip.com',
    color: '#AF00AF',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-06'
  },
  {
    id: 'dotdigital',
    name: 'Dotdigital',
    shortName: 'Dotdigital',
    patterns: [
      'static.trackedweb.net',
      'r1.trackedweb.net',
      'r2.trackedweb.net',
      'r3.trackedweb.net',
      'trackedweb.net/pagevisit'
    ],
    category: 'marketing-automation',
    description: 'Cross-channel marketing automation platform with web behavior tracking for email, SMS, and personalization.',
    url: 'https://dotdigital.com',
    color: '#D40F7D',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-19'
  },
  {
    id: 'emarsys',
    name: 'Emarsys',
    shortName: 'Emarsys',
    patterns: [
      'cdn.scarabresearch.com',
      'static.scarabresearch.com',
      'recommender.scarabresearch.com',
      'webchannel-content.eservice.emarsys.net',
      'api.emarsys.net'
    ],
    category: 'marketing-automation',
    description: 'Pre-built retail and e-commerce tactics with AI-powered product recommendations. Now owned by SAP.',
    url: 'https://emarsys.com',
    color: '#0070F2',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'getsitecontrol',
    name: 'Getsitecontrol',
    shortName: 'Getsitecontrol',
    // Two apexes: getsitectrl.com is the (abbreviated) event collector, getsitecontrol.com the
    // widget CDN. widgets.getsitecontrol.com is verified in-corpus at
    // sweeps/runs/dk/fibia.dk/2026-05-21-telco-peer-enrichment/. Apex excluded (marketing).
    patterns: [
      'events.getsitectrl.com',
      'widgets.getsitecontrol.com'
    ],
    category: 'marketing-automation',
    description: 'On-site popup and widget builder with an email marketing suite — lead-capture forms, surveys and notification bars with per-widget impression and conversion tracking.',
    url: 'https://getsitecontrol.com',
    color: '#ff492c',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'heyloyalty',
    name: 'Heyloyalty',
    shortName: 'Heyloyalty',
    patterns: [
      'tracking.heyloyalty.com',
      'bi.heyloyalty.com'
    ],
    category: 'marketing-automation',
    description: 'Danish marketing-automation platform (email, SMS, automations) with on-page behavioral tracking via its SmartWeb module; commonly deployed on Nordic e-commerce sites.',
    url: 'https://heyloyalty.com',
    color: '#FF5A36',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-26'
  },
  {
    id: 'highlevel',
    name: 'HighLevel',
    shortName: 'HighLevel',
    // Apex wildcard is FORBIDDEN: app. (agency/sub-account dashboard), login., marketplace.,
    // help. and rest. (admin-only API) all sit on .leadconnectorhq.com, so a wildcard would
    // flag every HighLevel agency operator's own dashboard as tracking. images. excluded as a
    // pure image-transform CDN. Agencies white-label the admin app, but the telemetry host is
    // NOT rebranded per tenant (verified live on two independent custom-domain sites), so
    // detection holds. Verified endpoints on backend.: /stats/event,
    // /attribution_service/user_session_v3/create_session, /funnels/funnel/geo-location/,
    // /forms/submit.
    patterns: [
      'backend.leadconnectorhq.com',
      'widgets.leadconnectorhq.com',
      'services.leadconnectorhq.com',
      'api.leadconnectorhq.com',
      'stcdn.leadconnectorhq.com'
    ],
    category: 'marketing-automation',
    description: 'White-label agency CRM and funnel platform (GoHighLevel) that tracks funnel page views, visitor attribution sessions and form conversions via its LeadConnector infrastructure.',
    url: 'https://www.gohighlevel.com',
    color: '#188BF6',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.2',
    addedDate: '2026-08-04'
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    shortName: 'HubSpot',
    patterns: [
      'js.hs-scripts.com',
      'js.hsforms.net',
      'track.hubspot.com',
      'forms.hubspot.com',
      'app.hubspot.com/api/usage-logging',
      // Host-anchored on the leading '//' rather than '^'. The previous /^cta-.../ form
      // could NEVER fire: matchSinglePattern tests the FULL url, which always begins
      // "https://", so the caret never reached the host. Precision is unchanged: it still
      // deliberately does NOT match app-eu1.hubspot.com (the CRM admin UI that every
      // HubSpot customer logs into). Dead since introduction; found and fixed 2026-07-21.
      /\/\/cta-[a-z0-9][a-z0-9-]*\.hubspot\.com/,
      'js.hs-analytics.net',
      'js-eu1.hs-analytics.net',
      'js.hsadspixel.net',
      'js-eu1.hsadspixel.net',
      'track-eu1.hubspot.com'
    ],
    category: 'marketing-automation',
    description: 'Inbound marketing platform with CRM, forms, email tracking, and lead scoring.',
    url: 'https://www.hubspot.com',
    color: '#FE4802',
    colorVerified: true,
    iconVerified: true,
    parsing: { customParser: true, formattedParser: true },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-07-21'
  },
  {
    id: 'instant-one',
    name: 'Instant',
    shortName: 'Instant',
    // The observed host was event.api.instant.one, but cdn.instant.one/instant.js is the primary
    // loader named in the vendor's own whitelisting doc — all four registered. Apex and www are
    // marketing, help.instant.one is docs: no apex wildcard.
    // Colour from a CLAIMED Brandfetch profile.
    patterns: [
      'cdn.instant.one',
      'm.instant.one',
      'event.api.instant.one',
      'cf.api.instant.one'
    ],
    category: 'marketing-automation',
    description: 'Anonymous-visitor identity resolution and email/SMS retention marketing for Shopify DTC brands, identifying unrecognised shoppers via first-party signals.',
    url: 'https://www.instant.one',
    color: '#00d160',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'iterable',
    name: 'Iterable',
    shortName: 'Iterable',
    patterns: [
      'api.iterable.com',
      'static.iterable.com',
      'js.iterable.com'
    ],
    category: 'marketing-automation',
    description: 'Visual workflow builder for multi-channel campaigns with send-time optimization and catalog-based personalization.',
    url: 'https://iterable.com',
    color: '#fca20a',
    colorVerified: true,
    textColor: '#c98000',
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'klaviyo',
    name: 'Klaviyo',
    shortName: 'Klaviyo',
    patterns: [
      'static.klaviyo.com',
      'a.klaviyo.com',
      'static-tracking.klaviyo.com'
    ],
    category: 'marketing-automation',
    description: 'Email and SMS marketing automation with deep e-commerce integrations.',
    url: 'https://www.klaviyo.com',
    color: '#F86353',
    colorVerified: true,
    iconVerified: false,
    excludeConsentCheck: [
      'custom-fonts/',         // Font configuration endpoint
      'static.klaviyo.com'     // Static SDK/CSS assets
    ],
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-07-21'
  },
  {
    id: 'leanplum',
    name: 'Leanplum',
    shortName: 'Leanplum',
    patterns: [
      'api.leanplum.com',
      'dev.leanplum.com',
      'www.leanplum.com'
    ],
    category: 'marketing-automation',
    description: 'A/B tests push notification timing, content, and delivery to maximize mobile app engagement. Now part of CleverTap.',
    url: 'https://www.leanplum.com',
    color: '#ea6986',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'listrak',
    name: 'Listrak',
    shortName: 'Listrak',
    patterns: [
      'cdn.listrakbi.com',
      's1.listrakbi.com',
      'listrak.com'
    ],
    category: 'marketing-automation',
    description: 'Cross-channel marketing automation platform for retail and e-commerce.',
    url: 'https://www.listrak.com',
    color: '#8f52a0',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    shortName: 'Mailchimp',
    patterns: [
      'chimpstatic.com',
      'list-manage.com',
      /mc\.us\d+\.list-manage\.com/,
      'eventcollector.mcf-prod.a.intuit.com'
    ],
    category: 'marketing-automation',
    description: 'Email marketing and audience management platform with website tracking.',
    url: 'https://mailchimp.com',
    color: '#FFE01B',
    colorVerified: true,
    textColor: '#241c15',
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'manychat',
    name: 'ManyChat',
    shortName: 'ManyChat',
    patterns: [
      'widget.manychat.com',
      'manychat.com'
    ],
    category: 'marketing-automation',
    description: 'Chat marketing automation for Instagram, Messenger, and WhatsApp with conversational flows.',
    url: 'https://manychat.com',
    color: '#3B42C4',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'marketo',
    name: 'Adobe Marketo Engage',
    shortName: 'Adobe Marketo',
    patterns: [
      'munchkin.marketo.net',
      'marketo.com/j'
    ],
    category: 'marketing-automation',
    description: 'B2B marketing automation for lead management, email campaigns, and lead scoring.',
    url: 'https://business.adobe.com/products/marketo/adobe-marketo.html',
    color: '#ff0000',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'moengage',
    name: 'MoEngage',
    shortName: 'MoEngage',
    patterns: [
      'cdn.moengage.com',
      '.moengage.com/v1/'
    ],
    category: 'marketing-automation',
    description: 'Customer engagement platform with web push, in-app messaging, and behavioral analytics across channels.',
    url: 'https://www.moengage.com',
    color: '#001447',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-06'
  },
  {
    id: 'movable-ink',
    name: 'Movable Ink',
    shortName: 'Movable Ink',
    patterns: [
      'cdn.movableink.com',
      'movableink.com',
      'p.movableink.com'
    ],
    category: 'marketing-automation',
    description: 'Dynamic content personalization platform that generates real-time visuals for email and web.',
    url: 'https://movableink.com',
    color: '#e21c79',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'onesignal',
    name: 'OneSignal',
    shortName: 'OneSignal',
    patterns: [
      'onesignal.com',
      'cdn.onesignal.com',
      'api.onesignal.com'
    ],
    category: 'marketing-automation',
    description: 'Free-tier push notification service with segments, A/B testing, and intelligent delivery timing.',
    url: 'https://onesignal.com',
    color: '#e54b4d',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'oracle-eloqua',
    name: 'Oracle Eloqua',
    shortName: 'Oracle Eloqua',
    patterns: [
      'eloqua.com',
      /s\d+\.t\.eloqua\.com/,
      /s\d+\.hs\.eloqua\.com/,
      'en25.com',
      /img\d*\.en25\.com/,
      'tracking.eloqua.com'
    ],
    category: 'marketing-automation',
    description: 'B2B marketing automation platform for email campaigns, lead scoring, and campaign orchestration.',
    url: 'https://www.oracle.com/cx/marketing/automation/',
    color: '#F80000',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'pardot',
    name: 'Pardot (Salesforce)',
    shortName: 'Pardot',
    patterns: [
      'pi.pardot.com',
      'pardot.com/analytics'
    ],
    category: 'marketing-automation',
    description: 'B2B marketing automation with lead scoring, nurturing, and Salesforce CRM integration.',
    url: 'https://www.salesforce.com/products/marketing-cloud/marketing-automation/',
    color: '#00a1e0',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'partnerstack',
    name: 'PartnerStack',
    shortName: 'PartnerStack',
    patterns: [
      'js.partnerstack.com',
      'partnerstack.com',
      // PartnerStack's referral-tracking alt-domains — `partnerlinks.io` is the
      // current short-link host, `grsm.io` is the legacy GrowSumo apex
      // (PartnerStack acquired GrowSumo and kept the link host live for backward
      // compatibility). Both are PartnerStack-only — no admin UI on apex.
      'partnerlinks.io',
      'grsm.io'
    ],
    category: 'marketing-automation',
    description: 'B2B partner and affiliate ecosystem platform for managing referral programs and channel partnerships.',
    url: 'https://partnerstack.com',
    color: '#1d1d38',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'playable',
    name: 'Playable (formerly Leadfamly)',
    shortName: 'Playable',
    patterns: [
      // Current Playable host (post-2022 rebrand)
      'popup.campaign.playable.com',
      // Legacy Leadfamly hosts — still live and serving customer popups; the
      // leadfamly.com runtime infrastructure was kept after the 2022 rebrand so
      // existing tenants don't have to re-embed. Both hosts are tracking-only
      // (vendor marketing lives on the leadfamly.com / playable.com apex; admin
      // UI on app.playable.com — neither is matched here).
      'popup.leadfamly.com',
      'api.leadfamly.com'
    ],
    category: 'marketing-automation',
    description: 'Danish gamified-marketing SaaS (spin-the-wheel, quizzes, scratch cards) for lead capture and zero-party data collection; rebranded from Leadfamly in 2022 but both leadfamly.com and playable.com runtime hosts remain live.',
    url: 'https://www.playable.com',
    color: '#F66A74',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-28'
  },
  {
    id: 'postscript',
    name: 'Postscript',
    shortName: 'Postscript',
    patterns: [
      'sdk.postscript.io',
      'sdk-api-proxy.postscript.io',
      'bicp-analytics.postscript.io'
    ],
    category: 'marketing-automation',
    description: 'SMS and MMS marketing platform for Shopify stores — subscriber capture popups, opt-in attribution, and page-event tracking.',
    url: 'https://postscript.io',
    color: '#C5F277',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-28'
  },
  {
    id: 'pushpushgo',
    name: 'PushPushGo',
    shortName: 'PushPushGo',
    // Apex wildcard deliberately excluded: pushpushgo.com is marketing, app. is the customer
    // admin console, swagger. is API docs (docs live on the separate pushpushgo.company TLD).
    // KNOWN GAP: the regional host family beyond s-eu-1 is undocumented — expect siblings.
    patterns: [
      'api.pushpushgo.com',
      'api-core.pushpushgo.com',
      'cdn.pushpushgo.com',
      's-eu-1.pushpushgo.com'
    ],
    category: 'marketing-automation',
    description: 'Multichannel engagement platform for web push, mobile push and onsite messaging with subscriber segmentation and behavioural triggers.',
    url: 'https://pushpushgo.com',
    color: '#16a085',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'pushwoosh',
    name: 'Pushwoosh',
    shortName: 'Pushwoosh',
    patterns: [
      'cdn.pushwoosh.com',
      'go.pushwoosh.com',
      'cp.pushwoosh.com'
    ],
    category: 'marketing-automation',
    description: 'Multi-channel push notification platform for mobile and web.',
    url: 'https://www.pushwoosh.com',
    color: '#0e72e5',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'retail-rocket',
    name: 'Retail Rocket',
    shortName: 'Retail Rocket',
    // Apex excluded (marketing site). my.retailrocket.net is excluded too despite carrying the
    // Trackers/SetEmail API surface — it is the logged-in merchant console.
    patterns: [
      'tracking.retailrocket.net',
      'cdn.retailrocket.net'
    ],
    category: 'marketing-automation',
    description: 'E-commerce retention and personalisation platform tracking on-site product, cart, search and order behaviour to power recommendations and triggered campaigns.',
    url: 'https://retailrocket.net/',
    color: '#16aadb',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'revenuehero',
    name: 'RevenueHero',
    shortName: 'RevenueHero',
    patterns: [
      // Deliberately obfuscated, anti-adblock telemetry apex — tracking-only
      // (RevenueHero's corporate + dashboard surfaces live on revenuehero.io,
      // not here). Apex wildcard covers both api. (event collection) and
      // asset. (SDK delivery: asset.b3mxnuvcer.com/b3mxnuvcer.js). Caveat:
      // rotating-candidate domain — RevenueHero may cycle it, so re-verify
      // periodically. Multi-tenant per urlscan + EasyPrivacy.
      '.b3mxnuvcer.com'
    ],
    category: 'marketing-automation',
    description: 'B2B pipeline-acceleration tool (inbound lead qualification, routing, and meeting scheduling) whose embedded widget collects page/visitor analytics.',
    url: 'https://www.revenuehero.io',
    color: '#6c5ce7',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.1',
    addedDate: '2026-06-05'
  },
  {
    id: 'sailthru',
    name: 'Sailthru (Marigold)',
    shortName: 'Sailthru',
    patterns: [
      'cdn.sailthru.com',
      'ak.sail-horizon.com',
      'api.sail-horizon.com',
      'ak.sail-personalize.com'
    ],
    category: 'marketing-automation',
    description: 'Marketing automation for publishers and media with personalized email, on-site recommendations, and lifecycle campaigns. Now part of Marigold.',
    url: 'https://www.sailthru.com',
    color: '#3A7AF0',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'salesforce-marketing',
    name: 'Salesforce Marketing',
    shortName: 'Salesforce Marketing',
    patterns: [
      'evergage.com',
      '.evergage.com/api',
      '.evergage.com/api2/event',
      'collect.igodigital.com',
      'tau.collect.igodigital.com',
      '.igodigital.com/collect'
    ],
    category: 'marketing-automation',
    description: 'Salesforce Marketing Cloud personalization, email, and customer journey tracking.',
    url: 'https://www.salesforce.com/products/marketing-cloud',
    color: '#00a1e0',
    colorVerified: true,
    iconVerified: true, // Material Design Icons: Salesforce
    parsing: { customParser: true, formattedParser: true },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'talon-one',
    name: 'Talon.One',
    shortName: 'Talon.One',
    patterns: [
      /[a-z0-9-]+\.[a-z-]+\.talon\.one\/v\d+/,
      'talon.one/v2/',
      'talon.one/v1/'
    ],
    category: 'marketing-automation',
    description: 'Loyalty programs and promotion engine for personalized incentives, coupons, and gamified campaigns.',
    url: 'https://www.talon.one',
    color: '#0061FF',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'trendemon',
    name: 'Trendemon',
    shortName: 'Trendemon',
    // Two hosts intentionally: trackingapi. is the collect endpoint, assets. is the tag CDN
    // (/tag/trends.min.js) and the cookie-setting domain per vendor docs — a capture may show
    // only one depending on the page. Apex excluded (marketing).
    // Colour from a CLAIMED Brandfetch profile.
    patterns: [
      'trackingapi.trendemon.com',
      'assets.trendemon.com'
    ],
    category: 'marketing-automation',
    description: 'B2B account-based marketing and website personalisation platform that maps anonymous and known buyer journeys and serves goal-based personalised content.',
    url: 'https://trendemon.com/',
    color: '#ED2470',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'unbounce',
    name: 'Unbounce',
    shortName: 'Unbounce',
    patterns: ['.ubembed.com'],
    category: 'marketing-automation',
    description: 'Landing page builder and conversion-optimization platform — popups, sticky bars, A/B testing, and Smart Traffic.',
    url: 'https://unbounce.com',
    color: '#FF5C39',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-15'
  },
  {
    id: 'unify',
    name: 'Unify',
    shortName: 'Unify',
    patterns: ['.unifyintent.com'],
    category: 'marketing-automation',
    description: 'B2B website-visitor identification and intent-tracking platform feeding Unify\'s warm-outbound automation.',
    url: 'https://www.unifygtm.com',
    color: '#000000',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-15'
  },
  {
    id: 'userled',
    name: 'Userled',
    shortName: 'Userled',
    patterns: ['api.userled.io'],
    category: 'marketing-automation',
    description: 'Account-based marketing and website personalization platform for B2B revenue teams — 1:1 personalized microsites, contact-level engagement tracking, CRM sync.',
    url: 'https://www.userled.io',
    color: '#000000',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-14'
  },
  {
    id: 'usergems',
    name: 'UserGems',
    shortName: 'UserGems',
    patterns: ['api.usergems.com', 'puid=usergems-'],
    category: 'marketing-automation',
    description: 'B2B identity-resolution / champion-tracking platform — identifies known contacts visiting a site for sales follow-up.',
    url: 'https://www.usergems.com',
    color: '#7C3AED',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-15'
  },
  {
    id: 'voyado',
    name: 'Voyado Engage',
    shortName: 'Voyado',
    // NEVER wildcard the apex: <tenant>.voyado.com is each customer's Engage admin dashboard
    // (vendor docs example: supershop.voyado.com), and voyado.com / developer. / help.engage. /
    // connect. are marketing, docs, support and partner sites. assets. is path-scoped to
    // /jsfiles/ for the same reason. Colour is the Brandfetch `brand` token.
    patterns: [
      't1.voyado.com',
      'assets.voyado.com/jsfiles/'
    ],
    category: 'marketing-automation',
    description: 'Retail customer-experience and loyalty platform whose web activity tracking script collects product views and cart changes to power abandoned-cart and personalised campaigns.',
    url: 'https://voyado.com/',
    color: '#9B1C45',
    colorVerified: false,
    iconVerified: true,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'webengage',
    name: 'WebEngage',
    shortName: 'WebEngage',
    patterns: [
      'webengage.com',
      'cdn.webengage.com',
      'c.webengage.com'
    ],
    category: 'marketing-automation',
    description: 'Journey designer with 10+ channels including web push, WhatsApp, and on-site notifications for retention campaigns.',
    url: 'https://webengage.com',
    color: '#00b079',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'webpushr',
    name: 'Webpushr',
    shortName: 'Webpushr',
    // Hosts enumerated by reading the SDK source (cdn.webpushr.com/app.min.js) directly.
    // No apex wildcard: www.webpushr.com serves marketing AND docs (docs. 301s to
    // www./docs/), app. is the customer console, forum. is the public support forum.
    // api.webpushr.com deliberately omitted -- documented server-side-only REST API requiring
    // secret webpushrKey/webpushrAuthToken headers, so it never fires from a browser.
    // webpushr-3744.kxcdn.com is shared multi-tenant KeyCDN infra and must NOT be registered.
    patterns: [
      'analytics.webpushr.com',
      'bot.webpushr.com',
      'subscriber.webpushr.com',
      'notevents.webpushr.com',
      'cdn.webpushr.com'
    ],
    category: 'marketing-automation',
    description: 'Web push notification platform for opt-in prompts, subscriber segmentation, and notification delivery/engagement tracking.',
    url: 'https://www.webpushr.com/',
    color: '#4A90E2',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.2',
    addedDate: '2026-08-04'
  },
  {
    id: 'wunderkind',
    name: 'Wunderkind (BounceX)',
    shortName: 'Wunderkind',
    patterns: [
      'api.bounceexchange.com',
      'assets.bounceexchange.com',
      'events.bouncex.net',
      'tag.wknd.ai',
      'wknd.ai',
      'cdn.wknd.ai'
    ],
    category: 'marketing-automation',
    description: 'Behavioral identity resolution and performance marketing with exit-intent, email capture, and one-to-one messaging.',
    url: 'https://www.wunderkind.co',
    color: '#191919',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },

  // === CUSTOMER DATA PLATFORMS ===
  {
    id: 'adobe-audience-manager',
    name: 'Adobe Audience Manager',
    shortName: 'AAM',
    patterns: [
      'demdex.net',            // Primary AAM domain (acquired company)
      'dpm.demdex.net',        // Data Provider Match endpoint
      'dcs.demdex.net',        // Data Collection Server
      'fast.demdex.net',       // Fast endpoint
      '/event?d_'              // AAM event tracking pattern
    ],
    category: 'cdp',
    consentCategory: 'marketing',
    description: 'Data management platform (DMP) for building audience segments and activating them across channels.',
    url: 'https://business.adobe.com/products/audience-manager/adobe-audience-manager.html',
    color: '#ff0000',
    colorVerified: true,
    iconVerified: true, // gilbarbara/logos: Adobe (icon)
    parsing: { customParser: true, formattedParser: true },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'adobe-experience-platform',
    name: 'Adobe Experience Platform',
    shortName: 'AEP',
    patterns: [
      'edge.adobedc.net',      // Edge Network endpoint (Web SDK)
      'server.adobedc.net',    // Authenticated Edge endpoint
      '.adobedc.net',          // Regional edge endpoints
      '/ee/v2/interact',       // Interactive data collection (Adobe-specific path)
      '/ee/v2/collect',        // Non-interactive batch collection (Adobe-specific path)
      '/ee/v1/interact',       // v1 interactive collection (older API version, still live; catches first-party-proxied edges on the default `ee` base path)
      '/ee/v1/collect',        // v1 batch collection (same; custom-base-path proxied hosts handled by the Alloy XDM structural fingerprint — Feature #147)
      /\/alloy(?:\.min)?\.js(?:\?|$)/  // Web SDK library (Alloy) — anchored to end of path
    ],
    category: 'cdp',
    consentCategory: 'marketing',
    description: 'Unified data collection via Web SDK (Alloy) for Real-Time CDP, Journey Optimizer, and Experience Cloud.',
    url: 'https://business.adobe.com/products/experience-platform/adobe-experience-platform.html',
    color: '#ff0000',
    colorVerified: true,
    iconVerified: true, // gilbarbara/logos: Adobe (icon)
    parsing: { customParser: true, formattedParser: true },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-06-16'
  },
  {
    id: 'b-dash',
    name: 'b→dash',
    shortName: 'b→dash',
    // Tag on cdn.activity., beacon to tracker./tracking -- classic CDP web-activity collector.
    // NEVER wildcard the apex: smart-bdash.com itself is the customer-facing SaaS app (awselb
    // 403) and support./handbook./discourse./lineconnect./ftps./push-history. plus rc-*
    // staging all live there. Tag is typically GTM-injected so it will not appear in raw page
    // HTML. Sets first-party cookie _bd_prev_page. Sibling domain bdash-cloud.com looks like
    // the same vendor (EasyPrivacy /tracking-script/ + /recommend-script/ paths) but its
    // collection subdomains were not enumerable -- investigate separately before adding.
    patterns: [
      'tracker.smart-bdash.com',
      'tracker-rec.smart-bdash.com',
      'cdn.activity.smart-bdash.com',
      'receptions.smart-bdash.com',
      'recommendserveweb.smart-bdash.com',
      'airecserveweb.smart-bdash.com'
    ],
    category: 'cdp',
    description: 'Japanese all-in-one data marketing cloud from Data X Inc. combining CDP, marketing automation, BI and on-site engagement; its bdash_log.js tag collects behavioural activity and beacons it to tracker.smart-bdash.com.',
    url: 'https://bdash-marketing.com/',
    color: '#1E5BFF',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.4.2',
    addedDate: '2026-08-04'
  },
  {
    id: 'bloomreach',
    name: 'Bloomreach',
    shortName: 'Bloomreach',
    patterns: [
      'cdn.exponea.com',
      'api.exponea.com',
      'bloomreach.com',
      'exponea.com'
    ],
    category: 'cdp',
    consentCategory: 'marketing',
    description: 'Commerce-focused CDP (formerly Exponea) with personalization engine.',
    url: 'https://www.bloomreach.com',
    color: '#FFD500',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'blueconic',
    name: 'BlueConic',
    shortName: 'BlueConic',
    patterns: [
      'blueconic.net',
      'cdn.blueconic.net',
      'profile.blueconic.com'
    ],
    category: 'cdp',
    consentCategory: 'marketing',
    description: 'Real-time CDP with unified customer profiles and segment activation.',
    url: 'https://www.blueconic.com',
    color: '#0066cc',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'blueshift',
    name: 'Blueshift',
    shortName: 'Blueshift',
    patterns: [
      'blueshift.com',
      'getblueshift.com',
      'api.getblueshift.com',
      'cdn.getblueshift.com'
    ],
    category: 'cdp',
    consentCategory: 'marketing',
    description: 'AI-powered CDP for personalized customer engagement across channels.',
    url: 'https://blueshift.com',
    color: '#2790FF',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'celebrus',
    name: 'Celebrus',
    shortName: 'Celebrus',
    patterns: [
      /\/celebrusinsert\.js/  // Celebrus CSA script (matched case-insensitively via urlLower)
    ],
    category: 'cdp',
    consentCategory: 'functional',
    description: 'Enterprise real-time behavioral data platform for regulated industries. Self-hosted collection via first-party domains.',
    url: 'https://www.celebrus.com',
    color: '#1a3b6b',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'census',
    name: 'Census',
    shortName: 'Census',
    patterns: [
      'getcensus.com',
      'api.getcensus.com',
      'app.getcensus.com'
    ],
    category: 'cdp',
    description: 'Reverse ETL platform syncing customer data from warehouse to 200+ tools.',
    url: 'https://www.getcensus.com',
    color: '#4f46e5',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'cxense',
    name: 'Cxense (Piano DMP)',
    shortName: 'Cxense',
    patterns: [
      'cdn.cxense.com',
      'comcluster.cxense.com',
      'cxense.com'
    ],
    category: 'cdp',
    consentCategory: 'marketing',
    description: 'Content recommendation and data management platform. Acquired by Piano. Powers on-site personalization for major publishers.',
    url: 'https://piano.io',
    color: '#C8192E',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'gigya',
    name: 'Gigya (SAP CDC)',
    shortName: 'Gigya',
    patterns: [
      'cdns.gigya.com',
      'accounts.gigya.com',
      'socialize.gigya.com',
      'fidm.gigya.com'
    ],
    category: 'cdp',
    consentCategory: 'functional',
    description: 'SAP Customer Data Cloud - customer identity and access management (CIAM) with social login and profile management.',
    url: 'https://www.sap.com/products/crm/customer-data-cloud.html',
    color: '#0FAAFF',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'hightouch',
    name: 'Hightouch',
    shortName: 'Hightouch',
    patterns: [
      'hightouch.io',
      'api.hightouch.io',
      'cdn.hightouch.io',
      'events.hightouch.io',
      'hightouch-events.com'
    ],
    category: 'cdp',
    parsing: { customParser: true, formattedParser: true },
    description: 'Composable CDP using reverse ETL to sync warehouse data to any destination.',
    url: 'https://hightouch.io',
    color: '#40DE9E',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'insider',
    name: 'Insider',
    shortName: 'Insider',
    patterns: [
      'useinsider.com',
      'api.useinsider.com',
      'insr.us'
    ],
    category: 'cdp',
    consentCategory: 'marketing',
    description: 'Growth management platform combining CDP with personalization and messaging.',
    url: 'https://useinsider.com',
    color: '#4edcce',
    colorVerified: true,
    textColor: '#2a9e93',
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'kevel-audience',
    name: 'Kevel Audience',
    shortName: 'Kevel Audience',
    // The OBSERVED host (tr.cdp.sonaedev.audience.kevel.com) is deliberately NOT registered
    // verbatim: 'sonaedev' is a per-customer slug and the 'dev' suffix suggests a non-production
    // tenant, so the literal host would match exactly one customer's staging traffic.
    // Pattern 1 = vendor-hosted shape, generalised across customer slugs.
    // Pattern 2 = the vendor's DOCUMENTED DEFAULT: a first-party CNAME (tr.cdp.<customer-domain>),
    // which is the higher-volume production case. It is anchored on BOTH the host prefix and the
    // path, because `tr.cdp.` alone is a plausible generic token - the path anchor carries the
    // precision, so do not relax it.
    // NEVER use .kevel.com or even a bare .audience.kevel.com: the apex carries www. (marketing)
    // and dev. (ad-server docs), and docs.audience.kevel.com sits INSIDE the narrower suffix.
    // Both regexes lead with ^https?:// so the ^ anchor is legitimate (it matches the scheme) -
    // this is not the dead-anchor shape tests/detection/registry-pattern-health.test.mjs rejects.
    // SEPARATE CANDIDATE, not covered here: Kevel's ad-serving side (ex-Adzerk) on
    // e-<networkId>.adzerk.net - different product, category ad-tech, needs its own investigation.
    patterns: [
      /^https?:\/\/(tr|cdn)\.cdp\.[a-z0-9-]+\.audience\.kevel\.com\//i,
      /^https?:\/\/(tr|cdn)\.cdp\.[a-z0-9.-]+\/(events\/|pcdp_)/i
    ],
    category: 'cdp',
    description: 'First-party customer data platform from Kevel (formerly Adzerk), collecting on-site behavioural events via a JS API, a JS-free pixel and click interception.',
    url: 'https://www.kevel.com/audience',
    color: '#FD563C',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'lemnisk',
    name: 'Lemnisk',
    shortName: 'Lemnisk',
    patterns: [
      'pi.lemnisk.co',
      'lemnisk.co'
    ],
    category: 'cdp',
    consentCategory: 'marketing',
    description: 'Real-time customer data platform dominant in Indian banking and financial services.',
    url: 'https://www.lemnisk.co',
    color: '#0038ff',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'lytics',
    name: 'Lytics',
    shortName: 'Lytics',
    patterns: [
      'c.lytics.io',
      'api.lytics.io'
    ],
    category: 'cdp',
    consentCategory: 'marketing',
    description: 'Customer data platform with built-in machine learning for audience segmentation.',
    url: 'https://www.lytics.com',
    color: '#794cff',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'mediarithmics',
    name: 'mediarithmics',
    shortName: 'mediarithmics',
    patterns: ['events.mediarithmics.com'],
    category: 'cdp',
    description: 'French multi-tenant Customer Data Platform — collects web/app events via JS tag and Tracking API for real-time segmentation, personalisation, and audience activation.',
    url: 'https://www.mediarithmics.io',
    color: '#FF5C39',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-11'
  },
  {
    id: 'mparticle',
    name: 'mParticle',
    shortName: 'mParticle',
    patterns: [
      'jssdks.mparticle.com',
      'identity.mparticle.com',
      's2s.mparticle.com'
    ],
    category: 'cdp',
    parsing: { customParser: true, formattedParser: true },
    description: 'Customer data platform for collecting, cleaning, and routing event data to downstream tools.',
    url: 'https://www.mparticle.com',
    color: '#ad0069',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'ometria',
    name: 'Ometria',
    shortName: 'Ometria',
    patterns: [
      'trk.ometria.com'
    ],
    category: 'cdp',
    description: 'Retail-focused Customer Data Experience Platform (CDXP) combining CDP data unification with cross-channel marketing orchestration (email, SMS, web, ads). Used by major retail brands including Steve Madden, Sephora, Charlotte Tilbury.',
    url: 'https://ometria.com',
    color: '#ff6b3c',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-19'
  },
  {
    id: 'optimove',
    name: 'Optimove',
    shortName: 'Optimove',
    patterns: [
      'optimove.net',
      'api.optimove.net',
      'sdk.optimove.net',
      'log.optimove.net'
    ],
    category: 'cdp',
    consentCategory: 'marketing',
    description: 'CDP with AI-powered orchestration for CRM marketing and retention.',
    url: 'https://www.optimove.com',
    color: '#FF8560',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'rb2b',
    name: 'RB2B (Retention.com)',
    shortName: 'RB2B',
    patterns: [
      's3-us-west-2.amazonaws.com/b2bjsstore/',  // SDK loader served from shared AWS S3 bucket — path-anchored on RB2B's namespace
      '/reb2b.js'                                 // Secondary catch — vendor-specific file name (survives bucket rename)
    ],
    category: 'cdp',
    consentCategory: 'marketing',
    description: 'B2B contact-level website-visitor identification — resolves anonymous US visitors to LinkedIn profiles and pushes identified contacts to Slack / CRM / outbound tooling. Product line of Retention.com.',
    url: 'https://www.rb2b.com',
    color: '#FF4F1F',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-17'
  },
  {
    id: 'relay42',
    name: 'Relay42 (Supermetrics)',
    shortName: 'Relay42',
    patterns: [
      '.r42tag.com',            // Tag container and data collection (tdn.r42tag.com)
      '.svtrd.com',             // Tracking pixels and scripts
      'synovite-scripts.com'    // Legacy domain (pre-rebrand)
    ],
    category: 'cdp',
    consentCategory: 'marketing',
    description: 'Real-time CDP with journey orchestration and tag management. Acquired by Supermetrics in 2025. Uses r42tag.com for client-side data collection.',
    url: 'https://supermetrics.com/relay42-is-supermetrics',
    color: '#33b062',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-06'
  },
  {
    id: 'rudderstack',
    name: 'RudderStack',
    shortName: 'RudderStack',
    patterns: [
      'rudderstack.com',
      'rudderlabs.com',
      'cdn.rudderlabs.com',
      'api.rudderstack.com',
      'api.rudderlabs.com',
      'dataplane.rudderstack.com'
    ],
    category: 'cdp',
    parsing: { customParser: true, formattedParser: true },
    description: 'Open-source customer data platform with warehouse-first approach and Segment-compatible API.',
    url: 'https://www.rudderstack.com',
    color: '#105ED5',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'salesforce-data-cloud',
    name: 'Salesforce Data Cloud',
    shortName: 'Salesforce Data Cloud',
    patterns: [
      '.c360a.salesforce.com'
    ],
    category: 'cdp',
    description: 'Salesforce Data Cloud (formerly Customer 360 Audiences / Salesforce CDP) — unified customer data platform. The c360a.salesforce.com sub-zone hosts per-tenant Web SDK ingest endpoints for browser-side event collection.',
    url: 'https://www.salesforce.com/data/',
    color: '#00a1e0',
    colorVerified: true, // Matches existing salesforce-marketing / salesforce-dmp / pardot entries; Salesforce parent brand colour
    iconVerified: true, // Reuses Salesforce parent brand cloud icon (same as salesforce-marketing / salesforce-dmp)
    addedInVersion: '1.3.0',
    addedDate: '2026-05-05'
  },
  {
    id: 'salesforce-dmp',
    name: 'Salesforce DMP (Krux)',
    shortName: 'Salesforce DMP',
    patterns: ['krxd.net'],
    category: 'cdp',
    description: 'Data Management Platform from Salesforce (formerly Krux, then Audience Studio). Officially End of Life on Feb 1, 2024, but pixels remain active on many publisher sites — useful for spotting legacy/orphaned tags.',
    url: 'https://www.salesforce.com/products/marketing-cloud/data-management/',
    color: '#00a1e0',
    colorVerified: true, // Matches existing salesforce-marketing entry; Salesforce parent brand colour
    iconVerified: true, // Reuses Salesforce parent brand cloud icon (same as salesforce-marketing)
    addedInVersion: '1.1.0',
    addedDate: '2026-04-26'
  },
  {
    id: 'segment',
    name: 'Segment',
    shortName: 'Segment',
    patterns: [
      'api.segment.io',
      'api.segment.com',
      'cdn.segment.io',
      'cdn.segment.com',
      'events.segment.io',
      'events.segment.com'
    ],
    category: 'cdp',
    parsing: { customParser: true, formattedParser: true },
    description: 'Customer data platform for collecting events and routing to 400+ downstream destinations.',
    url: 'https://segment.com',
    color: '#52bd94',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'segmint',
    name: 'Segmint',
    shortName: 'Segmint',
    patterns: ['.segmint.net'],
    category: 'cdp',
    description: 'Customer intelligence and data-marketing platform for financial institutions; uses transaction-derived Key Lifestyle Indicators (KLI) for segmentation, targeted media, and campaign measurement.',
    url: 'https://www.alkami.com/data-and-marketing-solutions/',
    color: '#0098D9',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'simon-data',
    name: 'Simon Data',
    shortName: 'Simon Data',
    // Apex wildcard is SAFE here, unusually: simonsignal.com is a dedicated tracking domain fully
    // separate from every corporate/docs/dashboard surface (simon.ai, simondata.com) and its apex
    // GET returns no marketing content. This is the .onaudience.com case, not the .hubspot.com one.
    // Vendor rebranded Simon Data -> Simon AI; the registry keeps 'Simon Data' as the recognisable
    // name, since that is what the docs and the tracking domain still say.
    patterns: [
      '.simonsignal.com'
    ],
    category: 'cdp',
    description: 'Customer data platform for retail and travel brands, combining warehouse-native segmentation with cross-channel campaign delivery.',
    url: 'https://www.simon.ai/',
    color: '#259edc',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'sitecore-cdp',
    name: 'Sitecore CDP / Personalize',
    shortName: 'Sitecore CDP',
    patterns: [
      // Dedicated Edge collection subdomain only — apex sitecorecloud.io is shared with
      // admin dashboards (app-cdp-us.) and regional API hosts (api-engage-*.), so no apex wildcard.
      'edge-platform.sitecorecloud.io'
    ],
    category: 'cdp',
    description: 'Sitecore Edge Platform endpoint for the Cloud SDK — collects behavioural events for Sitecore CDP and serves Personalize decisioning in XM Cloud sites.',
    url: 'https://www.sitecore.com/products/cdp',
    color: '#eb1f23',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.3.1',
    addedDate: '2026-06-02'
  },
  {
    id: 'snowplow',
    name: 'Snowplow',
    shortName: 'Snowplow',
    patterns: [
      '/com.snowplowanalytics.snowplow/',
      // GET pixel: /i at path root + Snowplow event type param (avoids /v3/i?aid= false positives)
      /\/\/[^/]+\/i\?([^&]*&)*e=(pv|pp|ue|se|tr|ti)(&|$)/,
      'com.snowplowanalytics',
      '/snowplow.js',
      // sp.js must be at path boundary to avoid matching "usp.js", "crisp.js", etc.
      /\/sp\.js/
    ],
    category: 'cdp',
    parsing: { customParser: true, formattedParser: true },
    description: 'Open-source behavioral data platform for creating first-party data assets in your own warehouse.',
    url: 'https://snowplow.io',
    color: '#9e62dd',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'treasure-data',
    name: 'Treasure Data',
    shortName: 'Treasure Data',
    patterns: [
      'in.treasuredata.com',
      'cdp.treasuredata.com'
    ],
    category: 'cdp',
    consentCategory: 'marketing',
    description: 'Enterprise customer data platform with data warehouse and AI-powered insights.',
    url: 'https://www.treasuredata.com',
    color: '#00B3FF',
    colorVerified: true,
    iconVerified: true, // Brandfetch: Treasure Data (symbol)
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'unveild',
    name: 'Unveild',
    shortName: 'Unveild',
    // REBRAND: usesneakpeek.com 301-redirects to unveild.ai (verified 2026-07-20). The legacy
    // e.usesneakpeek.com collector is the ONLY verified tracking host and is what still fires.
    // HOST ENUMERATION INCOMPLETE: an Unveild-era collector subdomain could not be verified from
    // any tracker database, vendor doc or urlscan result - extend when one is observed.
    patterns: [
      'e.usesneakpeek.com'
    ],
    category: 'cdp',
    description: 'Visitor-identification and audience-resolution platform that resolves anonymous traffic into contactable profiles.',
    url: 'https://www.unveild.ai/',
    color: '#eca766',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'vector',
    name: 'Vector',
    shortName: 'Vector',
    patterns: [
      'api.vector.co',
      'cdn.vector.co',
      'cdn2.vector.co'
    ],
    category: 'cdp',
    description: 'B2B contact-level website visitor identification and intent-signal platform. Deploys a first-party pixel that de-anonymises visitors and forwards intent signals to ad platforms (LinkedIn, Google, Meta) and CRMs.',
    url: 'https://www.vector.co',
    color: '#000000',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-14'
  },

  // === SESSION REPLAY ===
  {
    id: 'amplitude-session-replay',
    name: 'Amplitude Session Replay',
    shortName: 'Amplitude SR',
    patterns: [
      'sr-client-cfg.eu.amplitude.com',  // Session Replay remote-config (EU region)
      'sr-client-cfg.amplitude.com'      // Session Replay remote-config (US region)
    ],
    category: 'session-replay',
    description: 'Session replay add-on for Amplitude — records and replays user sessions alongside Amplitude product analytics. Separate endpoint from Amplitude core analytics.',
    url: 'https://amplitude.com/session-replay',
    color: '#1e61f0',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-28'
  },
  {
    id: 'clarity',
    name: 'Microsoft Clarity',
    shortName: 'Clarity',
    patterns: [
      'clarity.ms',
      'www.clarity.ms'
    ],
    category: 'session-replay',
    description: 'Free heatmaps and session recordings with AI-powered insights.',
    url: 'https://clarity.microsoft.com',
    color: '#0078d4',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'clicktale',
    name: 'ClickTale',
    shortName: 'ClickTale',
    patterns: [
      'clicktale.net',
      'c.az.clicktale.net',
      'clicktale.com',
      'cdn.clicktale.net'
    ],
    category: 'session-replay',
    description: 'Legacy session replay and heatmap tool, now acquired by Contentsquare.',
    url: 'https://contentsquare.com/',
    color: '#CD3246',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'contentsquare',
    name: 'ContentSquare',
    shortName: 'ContentSquare',
    patterns: [
      '.contentsquare.net',
      'c.contentsquare.net',
      't.contentsquare.net',
      'contentsquare.com'
    ],
    category: 'session-replay',
    description: 'Digital experience analytics combining session replay, heatmaps, and journey analysis.',
    url: 'https://contentsquare.com',
    color: '#CD3246',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'crazyegg',
    name: 'Crazy Egg',
    shortName: 'Crazy Egg',
    patterns: [
      'script.crazyegg.com',
      'ce.crazyegg.com',
      'tracking.crazyegg.com',
      'track.crazyegg.com'
    ],
    category: 'session-replay',
    description: 'Heatmaps, scrollmaps, and click tracking for conversion optimization.',
    url: 'https://www.crazyegg.com',
    color: '#8ABC00',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'fullstory',
    name: 'FullStory',
    shortName: 'FullStory',
    patterns: [
      'fullstory.com/s/fs.js',
      'rs.fullstory.com',
      'edge.fullstory.com',
      'o.fullstory.com'
    ],
    category: 'session-replay',
    description: 'Digital experience intelligence combining session replay with product analytics.',
    url: 'https://www.fullstory.com',
    color: '#0071EB',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'glassbox',
    name: 'Glassbox',
    shortName: 'Glassbox',
    patterns: [
      'cdn.glassboxdigital.io',
      'api.glassboxdigital.io',
      /.*\.glassboxdigital\.io/
    ],
    category: 'session-replay',
    description: 'Captures 100% of sessions with automatic struggle detection and PCI-compliant data masking for financial services.',
    url: 'https://www.glassbox.com',
    color: '#ED38AB',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'heatmap',
    name: 'Heatmap',
    shortName: 'Heatmap',
    // A bare 'heatmap.com' is unsafe twice over: it matches the vendor's own marketing site
    // AND any unrelated URL containing the literal string (e.g. a competitor blog post at
    // /blog/heatmap.com-vs-clarity). dashboard.heatmap.com is path-scoped rather than bare
    // because the host name implies a possible customer UI that could not be ruled out;
    // portal.heatmap.com is the documented customer login and is excluded.
    // Despite the name, ws.heatmap.com/record/get-initial-dom was observed serving plain
    // HTTPS. If a wss:// upgrade is also used, Chrome exposes only the handshake to
    // webRequest -- treat detection as presence-level, not payload-level.
    // Do NOT confuse with the WhoTracks.Me tracker named 'Heatmap' (heatmap.me / heatmap.it,
    // an unrelated older vendor).
    patterns: [
      'ws.heatmap.com',
      'c.heatmap.com',
      'dashboard.heatmap.com/preprocessor',
      'dashboard.heatmap.com/heatmap-light',
      'dashboard.heatmap.com/conversions.js'
    ],
    category: 'session-replay',
    description: 'Ecommerce-focused heatmap and click-analytics tool that attributes revenue to individual page elements by joining on-site interaction data with store order data.',
    url: 'https://www.heatmap.com/',
    color: '#17B26A',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.2',
    addedDate: '2026-08-04'
  },
  {
    id: 'hotjar',
    name: 'Hotjar',
    shortName: 'Hotjar',
    patterns: [
      'static.hotjar.com',
      'script.hotjar.com',
      'vars.hotjar.com',
      'insights.hotjar.com',
      'in.hotjar.com',
      'ws.hotjar.com',
      // .io recording-config + event-collector siblings of the .com family above
      'content.hotjar.io',
      'vc.hotjar.io'
    ],
    category: 'session-replay',
    description: 'Heatmaps, session recordings, and user feedback surveys for UX insights.',
    url: 'https://www.hotjar.com',
    color: '#ff3c00',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-07-21'
  },
  {
    id: 'inspectlet',
    name: 'Inspectlet',
    shortName: 'Inspectlet',
    patterns: [
      'hn.inspectlet.com',
      'cdn.inspectlet.com'
    ],
    category: 'session-replay',
    description: 'Eye-tracking heatmaps predicting where users look, plus form analytics showing field drop-off rates.',
    url: 'https://www.inspectlet.com',
    color: '#84c12d',
    colorVerified: true,
    textColor: '#5d8a1e',
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'logrocket',
    name: 'LogRocket',
    shortName: 'LogRocket',
    patterns: [
      'cdn.logrocket.io',
      'r.logrocket.io'
    ],
    category: 'session-replay',
    description: 'Session replay with frontend monitoring for debugging user-reported issues.',
    url: 'https://logrocket.com',
    color: '#764abc',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'lucky-orange',
    name: 'Lucky Orange',
    shortName: 'Lucky Orange',
    patterns: [
      'www.luckyorange.com',
      'cs.luckyorange.com',
      'luckyorange.net'
    ],
    category: 'session-replay',
    description: 'Session recordings, heatmaps, and conversion funnels for small-to-mid-size sites.',
    url: 'https://www.luckyorange.com',
    color: '#ff704c',
    colorVerified: true,
    textColor: '#cc8400',
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'mouseflow',
    name: 'Mouseflow',
    shortName: 'Mouseflow',
    patterns: [
      'cdn.mouseflow.com',
      'o2.mouseflow.com'
    ],
    category: 'session-replay',
    description: 'Session replay, heatmaps, and form analytics for behavior analysis.',
    url: 'https://mouseflow.com',
    color: '#FCC453',
    colorVerified: true,
    textColor: '#c99800',
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'plerdy',
    name: 'Plerdy',
    shortName: 'Plerdy',
    patterns: [
      'a.plerdy.com',
      'd.plerdy.com'
    ],
    category: 'session-replay',
    description: 'Session replay, heatmaps, and SEO checker with click tracking and e-commerce analytics.',
    url: 'https://www.plerdy.com',
    color: '#4285F3',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-06'
  },
  {
    id: 'quantum-metric',
    name: 'Quantum Metric',
    shortName: 'Quantum Metric',
    patterns: [
      'cdn.quantummetric.com',
      'api.quantummetric.com',
      /.*\.quantummetric\.com/
    ],
    category: 'session-replay',
    description: 'Quantifies UX friction in dollars lost, with AI alerts for anomalies and out-of-the-box retail/finance dashboards.',
    url: 'https://www.quantummetric.com',
    color: '#E6005C',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'session-rewind',
    name: 'Session Rewind',
    shortName: 'Session Rewind',
    // Do NOT use a .sessionrewind.com apex wildcard - the apex is the marketing site and
    // dash.sessionrewind.com is the customer dashboard.
    // rec.* serves srloader.js; api.* is the API host (report-script-error confirmed, ingest paths
    // inferred from the tools_unknown sighting).
    patterns: [
      'api.sessionrewind.com',
      'rec.sessionrewind.com'
    ],
    category: 'session-replay',
    description: 'Lightweight session-replay tool capturing user sessions, console output and DOM interactions for debugging.',
    url: 'https://sessionrewind.com',
    color: '#a233ff',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'smartlook',
    name: 'Smartlook',
    shortName: 'Smartlook',
    patterns: [
      'rec.smartlook.com',
      'manager.smartlook.com',
      'web-sdk.smartlook.com'
    ],
    category: 'session-replay',
    description: 'Records sessions across web and native mobile apps with event-based filtering and dev tool integrations.',
    url: 'https://www.smartlook.com',
    color: '#023189',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'survicate',
    name: 'Survicate',
    shortName: 'Survicate',
    patterns: [
      'survey.survicate.com',
      'survicate-cdn.com',
      'survicate.com/workspaces'
    ],
    category: 'session-replay',
    description: 'Customer feedback and survey platform for collecting in-app and website feedback.',
    url: 'https://survicate.com',
    color: '#2D2D2D',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'uxcam',
    name: 'UXCam',
    shortName: 'UXCam',
    patterns: [
      'api.uxcam.com',
      'sdk.uxcam.com',
      'app.uxcam.com'
    ],
    category: 'session-replay',
    description: 'Mobile-only session replay with touch heatmaps, frustration signals, and screen-flow analytics for iOS/Android.',
    url: 'https://uxcam.com',
    color: '#5D97FF',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'zipy',
    name: 'Zipy',
    shortName: 'Zipy',
    patterns: [
      'cdn.zipy.ai',               // SDK loader
      'services.zipy.ai',          // Session manager (POST sdk-session-manager/v2/enduser-info/{tenant})
      'collector8.zipy.ai',        // Event collector (sharded — only collector8 verified; siblings via /ew-platform-discover)
      'pageperfcollector.zipy.ai'  // RUM / page-perf metrics collector
    ],
    category: 'session-replay',
    description: 'AI-powered session replay, error tracking, and product analytics for developer-facing apps.',
    url: 'https://www.zipy.ai/',
    color: '#6F1FFF',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-17'
  },
  {
    id: 'zoho-pagesense',
    name: 'Zoho PageSense',
    shortName: 'PageSense',
    patterns: [
      'pagesense.zoho.com',
      'cdn.pagesense.io'
    ],
    category: 'session-replay',
    description: 'CRO platform with heatmaps, session recordings, A/B testing, and funnel analysis from the Zoho suite.',
    url: 'https://www.zoho.com/pagesense/',
    color: '#E42527',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-06'
  },

  // === A/B TESTING ===
  {
    id: 'abconvert',
    name: 'ABConvert',
    shortName: 'ABConvert',
    patterns: ['app.abconvert.io'],
    category: 'ab-testing',
    description: 'Shopify-native A/B testing app for price, shipping, theme, PDP, and checkout experiments — uses a Web Pixel plus an in-theme script for visitor bucketing and event collection.',
    url: 'https://www.abconvert.io',
    color: '#10B981',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-11'
  },
  {
    id: 'abtasty',
    name: 'AB Tasty',
    shortName: 'AB Tasty',
    patterns: [
      'abtasty.com',
      'try.abtasty.com',
      'tag.abtasty.com'
    ],
    category: 'ab-testing',
    description: 'Visual editor for client-side experiments with AI-powered traffic allocation and emotional targeting widgets.',
    url: 'https://www.abtasty.com',
    color: '#000155',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'acadia-splittesting',
    name: 'Acadia SplitTesting',
    shortName: 'Acadia Split',
    // AGENCY-OPERATED multi-tenant tool, not a self-serve SaaS product: no public docs and no
    // tracker-DB coverage, so the request/response shape is UNVERIFIED and no parser should be
    // assumed for it.
    // NEVER widen to a .acadia.io apex wildcard - the apex is the agency's own marketing site.
    // Colour is from a CLAIMED Brandfetch profile, but it is the AGENCY's brand rather than a
    // product-specific palette.
    patterns: [
      'splittesting.acadia.io'
    ],
    category: 'ab-testing',
    description: 'Agency-operated split-testing tool deployed across client storefronts by the Acadia performance-marketing agency.',
    url: 'https://acadia.io/conversion-optimization/',
    color: '#000639',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'adobe-target',
    name: 'Adobe Target',
    shortName: 'Adobe Target',
    patterns: [
      '.tt.omtrdc.net',        // Target uses tt.omtrdc.net subdomain
      '/rest/v1/delivery',     // Target Delivery API
      '/rest/v2/batchmbox',    // Batch mbox API
      '/mbox/json',            // Legacy mbox endpoint
      'mboxedge'               // Edge server requests
    ],
    category: 'ab-testing',
    description: 'A/B testing and personalization platform for optimizing digital experiences across web and mobile.',
    url: 'https://business.adobe.com/products/target/adobe-target.html',
    color: '#ff0000',
    colorVerified: true,
    iconVerified: false,
    parsing: { customParser: true, formattedParser: true },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'convert',
    name: 'Convert',
    shortName: 'Convert',
    patterns: [
      'cdn.convert.com',
      'logs.convert.com',
      // REMOVED 2026-07-21: bare 'convert.com' apex wildcard matched the vendor's own
      // marketing site and the app.convert.com customer dashboard. The cdn./logs. hosts
      // above plus the convertexperiments.com family below carry all real coverage.
      // convertexperiments.com carries 100% of runtime traffic (CSP-documented).
      // Leading-dot patterns are suffix-anchored to match any <accountId>. prefix.
      '.metrics.convertexperiments.com',
      '.signals.convertexperiments.com',
      'logs.convertexperiments.com',
      'cdn-3.convertexperiments.com',
      'cdn-4.convertexperiments.com'
    ],
    category: 'ab-testing',
    description: 'Flicker-free testing with privacy controls, integrations to 100+ analytics tools, and no data sampling.',
    url: 'https://www.convert.com',
    color: '#0066FF',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-07-21'
  },
  {
    id: 'dynamicyield',
    name: 'Dynamic Yield',
    shortName: 'Dynamic Yield',
    patterns: [
      'dynamicyield.com',
      'rcom.dynamicyield.com',
      'rcom-eu.dynamicyield.com',
      'px.dynamicyield.com',
      'st.dynamicyield.com',
      '.dy-api.com',
      '.dy-api.eu'
    ],
    category: 'ab-testing',
    description: 'Personalization engine for A/B testing, recommendations, and dynamic content (now Mastercard).',
    url: 'https://www.dynamicyield.com',
    color: '#F64C72',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'eppo',
    name: 'Eppo',
    shortName: 'Eppo',
    patterns: [
      'eppo.cloud',
      'api.eppo.cloud',
      'fscdn.eppo.cloud'
    ],
    category: 'ab-testing',
    description: 'Runs experiments on your data warehouse, so results stay consistent with your existing metrics definitions.',
    url: 'https://www.geteppo.com',
    color: '#8266FF',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'frosmo',
    name: 'Frosmo',
    shortName: 'Frosmo',
    patterns: [
      'frosmo.com',
      'fi1.frosmo.com',
      'eu1.frosmo.com',
      /frosmo\.com\/optimizerapi/  // Frosmo optimizer API (domain-anchored)
    ],
    category: 'ab-testing',
    description: 'Finnish personalization and recommendation engine for e-commerce.',
    url: 'https://frosmo.com',
    color: '#fea115',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'growthbook',
    name: 'GrowthBook',
    shortName: 'GrowthBook',
    patterns: [
      'cdn.growthbook.io',
      'api.growthbook.io'
    ],
    category: 'ab-testing',
    description: 'Open-source feature flags with Bayesian statistics, warehouse-native analysis, and self-hosting option.',
    url: 'https://www.growthbook.io',
    color: '#401598',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'intelligems',
    name: 'Intelligems',
    shortName: 'Intelligems',
    // Apex wildcard UNSAFE: app.intelligems.io is the merchant dashboard; www. and docs. are
    // marketing and documentation.
    // cdn. serves the per-customer SDK bundle (<customer_id>.js and esm/<customer_id>/bundle.js)
    // and is most likely to fire first; api. is the collection endpoint.
    patterns: [
      'api.intelligems.io',
      'cdn.intelligems.io'
    ],
    category: 'ab-testing',
    description: 'Price, offer and content A/B testing for Shopify merchants, measuring profit impact rather than conversion rate alone.',
    url: 'https://www.intelligems.io/',
    color: '#2962ff',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'intellimize',
    name: 'Intellimize',
    shortName: 'Intellimize',
    patterns: [
      '.intellimize.co'
    ],
    category: 'ab-testing',
    description: 'AI-powered website personalization and A/B testing platform; rebranded as Webflow Optimize after Webflow\'s April 2024 acquisition (still ships standalone for non-Webflow customers).',
    url: 'https://www.intellimize.com',
    color: '#7C3AED',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'kameleoon',
    name: 'Kameleoon',
    shortName: 'Kameleoon',
    patterns: [
      'kameleoon.eu',
      'kameleoon.com',
      'static.kameleoon.com'
    ],
    category: 'ab-testing',
    description: 'Server-side and hybrid testing with a built-in machine learning engine for predicting conversion likelihood.',
    url: 'https://www.kameleoon.com',
    color: '#1D342F',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'launchdarkly',
    name: 'LaunchDarkly',
    shortName: 'LaunchDarkly',
    patterns: [
      'events.launchdarkly.com',
      'clientstream.launchdarkly.com'
    ],
    category: 'ab-testing',
    description: 'Feature flag management for controlled rollouts, A/B testing, and experimentation.',
    url: 'https://launchdarkly.com',
    color: '#405BFF',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'mida',
    name: 'Mida',
    shortName: 'Mida',
    patterns: [
      // Regional tracking API split + loader CDN. Apex mida.so / app.mida.so are
      // marketing + customer dashboard, so enumerate the tracking subdomains (no apex wildcard).
      'api-eu.mida.so',
      'api-us.mida.so',
      'cdn.mida.so'
    ],
    category: 'ab-testing',
    description: 'Lightweight no-code A/B testing and experimentation platform that runs split tests and forwards conversion data to analytics tools.',
    url: 'https://www.mida.so',
    color: '#6c5ce7',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.1',
    addedDate: '2026-06-02'
  },
  {
    id: 'monetate',
    name: 'Monetate',
    shortName: 'Monetate',
    patterns: [
      'monetate.net',
      'se.monetate.net',
      'sb.monetate.net'
    ],
    category: 'ab-testing',
    description: 'Personalization and A/B testing platform for e-commerce optimization.',
    url: 'https://www.monetate.com',
    color: '#F74BB3',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'mutiny',
    name: 'Mutiny',
    shortName: 'Mutiny',
    patterns: [
      'mutinyhq.io',
      'mutinyhq.com',
      'app.mutinyhq.com'
    ],
    category: 'ab-testing',
    description: 'Personalizes B2B websites by company, industry, or intent signal without involving engineering.',
    url: 'https://www.mutinyhq.com',
    color: '#aa00ff',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'optimizely',
    name: 'Optimizely',
    shortName: 'Optimizely',
    patterns: [
      'cdn.optimizely.com',
      'logx.optimizely.com',
      'optimizely.s3.amazonaws.com'
    ],
    category: 'ab-testing',
    parsing: { customParser: true, formattedParser: true },
    description: 'Experimentation platform for A/B testing, feature flags, and personalization.',
    url: 'https://www.optimizely.com',
    color: '#0037FF',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'shoplift',
    name: 'Shoplift',
    shortName: 'Shoplift',
    patterns: [
      'events.shoplift.ai'
    ],
    category: 'ab-testing',
    description: 'Shopify-native A/B testing and conversion-rate-optimization platform that tracks pageviews, cart adds, checkouts, and orders to measure experiment lift.',
    url: 'https://www.shoplift.ai',
    color: '#1a1a1a',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-11'
  },
  {
    id: 'statsig',
    name: 'Statsig',
    shortName: 'Statsig',
    patterns: [
      'api.statsig.com',
      'featuregates.org',
      'featureassets.org',
      'prodregistryv2.org',
      'statsigapi.net'
    ],
    category: 'ab-testing',
    description: 'Feature gates with automatic metric lift analysis, built by ex-Facebook engineers for high-velocity teams.',
    url: 'https://statsig.com',
    color: '#367eed',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'trbo',
    name: 'trbo',
    shortName: 'trbo',
    // Enumerated hosts only -- NEVER widen to a .trbo.com apex wildcard: www. is the
    // WordPress marketing site, app. is a 403-gated customer dashboard, help. is support,
    // analytics.trbo.com self-identifies as a backend microservice API never seen in a
    // browser capture, and agentic./admin.agentic./demo.agentic. are product demo and admin
    // surfaces. trbo.de resolves but serves nothing and carries no tracking -- do not add it.
    // Tenant id appears as cl=<shopId> on collect and sh=<shopId> inside the JSON g= param on
    // api-v4. Page globals for structural fingerprinting: window._trbo, _trboq, __trboQueue.
    patterns: [
      'collect.trbo.com',
      'api-v4.trbo.com',
      'api.trbo.com',
      'track2.trbo.com',
      'static.trbo.com',
      'static-v2.trbo.com'
    ],
    category: 'ab-testing',
    description: 'German onsite-personalization, optimization and A/B/n testing platform (trbo GmbH, Munich) that collects visitor characteristics client-side to drive real-time recommendations, layers and experiments on e-commerce sites.',
    url: 'https://www.trbo.com',
    color: '#00264C',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.2',
    addedDate: '2026-08-04'
  },
  {
    id: 'vwo',
    name: 'VWO',
    shortName: 'VWO',
    patterns: [
      'dev.visualwebsiteoptimizer.com',
      'd5phz18u4wuww.cloudfront.net'
    ],
    category: 'ab-testing',
    description: 'A/B testing and conversion optimization platform with heatmaps and session recordings.',
    url: 'https://vwo.com',
    color: '#bf3b78',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },

  // === CONSENT / PRIVACY ===
  {
    id: 'axeptio',
    name: 'Axeptio',
    shortName: 'Axeptio',
    patterns: [
      'static.axept.io',
      'api.axept.io',
      'client.axept.io'
    ],
    category: 'consent',
    description: 'GDPR-compliant cookie consent manager with a user-friendly widget interface.',
    url: 'https://www.axeptio.eu',
    color: '#2b7de9',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  // Admiral CMP - US publisher CMP with adblock recovery and IAB TCF
  {
    id: 'admiral-cmp',
    name: 'Admiral CMP',
    shortName: 'Admiral',
    patterns: [
      'cdn.getadmiral.com',
      'js.getadmiral.com'
    ],
    category: 'consent',
    description: 'US publisher consent management platform with adblock recovery and IAB TCF v2 compliance.',
    url: 'https://www.getadmiral.com',
    color: '#C20060',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-08'
  },
  // Borlabs Cookie - WordPress CMP popular in DACH markets (self-hosted, no external CDN)
  {
    id: 'borlabs-cookie',
    name: 'Borlabs Cookie',
    shortName: 'Borlabs',
    patterns: [],
    hasBadgePatterns: false,
    category: 'consent',
    description: 'WordPress cookie consent plugin popular in DACH markets — self-hosted, no external CDN. Detection requires future DOM-based approach.',
    url: 'https://borlabs.io/borlabs-cookie/',
    color: '#29ABE2',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-03'
  },
  // Complianz - WordPress cookie consent plugin (self-hosted, no external CDN)
  {
    id: 'complianz',
    name: 'Complianz',
    shortName: 'Complianz',
    patterns: [],
    hasBadgePatterns: false,
    category: 'consent',
    description: 'WordPress cookie consent plugin — self-hosted, no external CDN. Detection requires future DOM-based approach.',
    url: 'https://complianz.io',
    color: '#0693E3',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-03'
  },
  // CCM19 - German cookie consent manager by Papoo Software & Media GmbH
  {
    id: 'ccm19',
    name: 'CCM19',
    shortName: 'CCM19',
    patterns: [
      'cloud.ccm19.de'
    ],
    category: 'consent',
    description: 'German cookie consent manager with self-hosted and cloud options, popular in the DACH region.',
    url: 'https://www.ccm19.de',
    color: '#2B7BB9',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-08'
  },
  // Civic Cookie Control - UK CMP by CIVIC UK
  {
    id: 'civic-cookie-control',
    name: 'Civic Cookie Control',
    shortName: 'Civic',
    patterns: [
      'cc.cdn.civiccomputing.com'
    ],
    category: 'consent',
    description: 'UK-based cookie consent solution with extensive customisation, IAB TCF support, and Google Consent Mode v2 integration.',
    url: 'https://www.civicuk.com/cookie-control',
    color: '#00B0B9',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-08'
  },
  {
    id: 'consentmanager',
    name: 'consentmanager',
    shortName: 'consentmanager',
    patterns: [
      'cdn.consentmanager.net',
      'delivery.consentmanager.net',
      'api.consentmanager.net'
    ],
    category: 'consent',
    description: 'Consent management platform for GDPR/ePrivacy compliance across EU markets.',
    url: 'https://www.consentmanager.net',
    color: '#46b38b',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  // Consentmo - Shopify-focused GDPR/CCPA consent management (Google-certified CMP, TCF v2.3)
  {
    id: 'consentmo',
    name: 'Consentmo',
    shortName: 'Consentmo',
    patterns: [
      'gdprcdn.b-cdn.net',
      'consentmo.com'
    ],
    category: 'consent',
    description: 'Shopify-focused GDPR/CCPA consent management app with Google Consent Mode v2 and TCF v2.3 support.',
    url: 'https://www.consentmo.com',
    color: '#1A2E4A',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.2',
    addedDate: '2026-04-08'
  },
  // Commanders Act CMP (TrustCommander) - Enterprise EU consent management
  {
    id: 'commanders-act-cmp',
    name: 'Commanders Act CMP',
    shortName: 'TrustCommander',
    patterns: [
      'cdn.trustcommander.net'
    ],
    category: 'consent',
    description: 'Enterprise consent management platform (TrustCommander) by Commanders Act, popular in French/EU enterprise market.',
    url: 'https://www.commandersact.com/en/solutions/trustcommander/',
    color: '#002CBD',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-08'
  },
  // CookieFirst - Consent management with auto cookie scanning
  {
    id: 'cookie-first',
    name: 'CookieFirst',
    shortName: 'CookieFirst',
    patterns: [
      'consent.cookiefirst.com'
    ],
    category: 'consent',
    description: 'Consent management with automatic cookie scanning, supporting 44+ languages.',
    url: 'https://cookiefirst.com',
    color: '#267A48',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-03'
  },
  // Cookie Notice - WordPress cookie consent plugin by Hu-manity.co (self-hosted + CDN)
  {
    id: 'cookie-notice',
    name: 'Cookie Notice',
    shortName: 'Cookie Notice',
    patterns: [
      'cdn.hu-manity.co/hu-banner'
    ],
    category: 'consent',
    description: 'WordPress cookie consent plugin by Hu-manity.co — free tier is self-hosted, premium Cookie Compliance tier loads from CDN.',
    url: 'https://cookie-compliance.co',
    color: '#00a99d',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-08'
  },
  {
    id: 'cookie-information',
    name: 'Cookie Information',
    shortName: 'Cookie Information',
    patterns: [
      'cookieinformation.com',
      'policy.app.cookieinformation.com'
    ],
    category: 'consent',
    description: 'Danish consent management platform for GDPR cookie compliance.',
    url: 'https://cookieinformation.com',
    color: '#2379c2',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  // CookieScript - Cookie consent for GDPR/CCPA
  {
    id: 'cookie-script',
    name: 'CookieScript',
    shortName: 'CookieScript',
    patterns: [
      'cdn.cookie-script.com',
      'cookie-script.com'
    ],
    category: 'consent',
    description: 'Cookie consent solution for GDPR and CCPA compliance, Google CMP Gold-certified.',
    url: 'https://cookie-script.com',
    color: '#22B8F0',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-03'
  },
  {
    id: 'cookiebot',
    name: 'Cookiebot',
    shortName: 'Cookiebot',
    patterns: [
      // Simple pattern for script load detection (badge)
      'consent.cookiebot.com',
      // Main SDK script (uc.js with cbid parameter)
      /consent\.cookiebot\.com\/uc\.js/,
      // Cookie declaration script
      /consent\.cookiebot\.com\/[a-f0-9-]+\/cd\.js/,
      // Consent CDN scripts only (not images/CSS)
      /consentcdn\.cookiebot\.com\/.*\.js(?:\?|$)/,
      // Cookiebot's Akamai-backed CDN — banner UI iframes (/sdk/bc-v4.min.html), per-customer
      // config JSON (/consentconfig/<uuid>/settings.json), cross-domain consent state.
      // Required in CSP script-src/frame-src/connect-src per vendor docs.
      'consentcdn.cookiebot.com',
      // EU-residency sibling — same role, European CDN solution.
      'consentcdn.cookiebot.eu'
    ],
    category: 'consent',
    description: 'Consent management platform for GDPR/CCPA cookie compliance.',
    url: 'https://www.cookiebot.com',
    color: '#11a7fe',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-05-26'
  },
  {
    id: 'cookiehub',
    name: 'CookieHub',
    shortName: 'CookieHub',
    patterns: [
      // Container loader served from CookieHub's dedicated CDN host:
      // cdn.cookiehub.eu/c2/<8-char-domain-code>.js (current v2 install snippet).
      /cdn\.cookiehub\.eu\/c2\/.*\.js/,
      // Host is CookieHub-only (the dashboard/marketing site lives on
      // cookiehub.com), so the bare CDN host is a safe tracking-only anchor that
      // also covers older loader paths and config fetches.
      'cdn.cookiehub.eu'
    ],
    category: 'consent',
    description: 'Consent management platform for GDPR, CCPA and global cookie compliance.',
    url: 'https://www.cookiehub.com',
    color: '#e51e25',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.3.1',
    addedDate: '2026-05-29'
  },
  {
    id: 'cookieyes',
    name: 'CookieYes',
    shortName: 'CookieYes',
    patterns: [
      /cdn-cookieyes\.com\/client_data\/.*\/script\.js/,
      'cdn-cookieyes.com',
      'app.cookieyes.com',
      'log.cookieyes.com'
    ],
    category: 'consent',
    description: 'Cookie consent solution for GDPR and CCPA compliance with automated scanning.',
    url: 'https://www.cookieyes.com',
    color: '#3559e0',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'didomi',
    name: 'Didomi',
    shortName: 'Didomi',
    patterns: [
      // Didomi-owned, tracking-only subdomains (loader, SDK files, integrations,
      // notice configs, vendor lists). The whole `sdk.privacy-center.org` host is
      // the Didomi CMP web SDK; `api.privacy-center.org` is the consent storage API.
      'sdk.privacy-center.org',
      'api.privacy-center.org'
    ],
    category: 'consent',
    description: 'Multi-regulation consent with preference centers, vendor management, and Google Consent Mode integration.',
    url: 'https://www.didomi.io',
    color: '#f1c40f',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  // Digital Control Room (Cookie Reports) - Enterprise cookie compliance CMP
  {
    id: 'digital-control-room',
    name: 'Digital Control Room',
    shortName: 'Digital Control Room',
    patterns: [
      'policy.cookiereports.com'
    ],
    category: 'consent',
    description: 'Enterprise cookie compliance platform used by government, pharma, and regulated industries. Formerly Cookie Reports.',
    url: 'https://www.digitalcontrolroom.com',
    color: '#0667f3',
    colorVerified: true, // Brandfetch
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-09'
  },
  // Enzuzo - Shopify/SMB-focused CMP
  {
    id: 'enzuzo',
    name: 'Enzuzo',
    shortName: 'Enzuzo',
    patterns: [
      'app.enzuzo.com'
    ],
    category: 'consent',
    description: 'All-in-one privacy compliance platform for Shopify and small businesses with cookie consent, policy generation, and DSR handling.',
    url: 'https://www.enzuzo.com',
    color: '#2EC4B6',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-08'
  },
  // Ethyca Fides - Open-source privacy engineering platform
  {
    id: 'ethyca-fides',
    name: 'Ethyca Fides',
    shortName: 'Fides',
    patterns: [
      /fides-cdn\.ethyca\.com\/fides\.js/
    ],
    category: 'consent',
    description: 'Open-source privacy engineering platform with consent management. Cloud version detectable via Ethyca CDN; self-hosted instances use custom domains.',
    url: 'https://ethyca.com',
    color: '#8243F2',
    colorVerified: false,
    iconVerified: true, // Official favicon: ethyca.com/favicon.svg
    addedInVersion: '1.0.0',
    addedDate: '2026-03-03'
  },
  {
    id: 'evidon',
    name: 'Evidon (Crownpeak)',
    shortName: 'Evidon',
    patterns: [
      'c.evidon.com',
      'evidon.com',
      'l.evidon.com'
    ],
    category: 'consent',
    description: 'Tag governance and consent management platform. US enterprise alternative to OneTrust, now part of Crownpeak.',
    url: 'https://www.crownpeak.com',
    color: '#00a5e3',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'google-ccm',
    name: 'Google Consent Mode',
    shortName: 'Google Consent Mode',
    patterns: [
      // Only match /ccm/collect when the tid(s) parameter does NOT begin with a
      // recognised destination prefix (AW-* Google Ads, DC-* Floodlight, G-* GA4).
      // Those routes are owned by the platform-specific entries and dispatched
      // out of google-ccm by parsers/google-ccm.js. See BUG22.
      // Tested against the RAW URL (see matchSinglePattern in url-patterns.js) so the
      // negative lookahead correctly sees the uppercase AW-/DC-/G- discriminators and
      // yields to the destination entries. The `i` flag is defensive only — it keeps
      // the lookahead correct even if a future matcher lowercases the URL first.
      /google\.com\/ccm\/collect(?!\?[^]*tids?=(?:AW-|DC-|G-))/i,
      'google.com/ccm/form-data'
    ],
    category: 'consent',
    description: 'Google Consent Mode (CCM) sends consent state updates to Google services for privacy-compliant measurement.',
    url: 'https://support.google.com/google-ads/answer/10000067',
    color: '#4285f4',
    colorVerified: true,
    iconVerified: true,
    parsing: { customParser: true, formattedParser: true },
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  // InMobi CMP - formerly Quantcast Choice (acquired August 2023)
  {
    id: 'inmobi-cmp',
    name: 'InMobi CMP',
    shortName: 'InMobi CMP',
    patterns: [
      'cmp.inmobi.com',
      'api.cmp.inmobi.com'
    ],
    category: 'consent',
    description: 'Consent management platform (formerly Quantcast Choice) for TCF 2.2, GDPR, and CCPA compliance.',
    url: 'https://choice.inmobi.com',
    color: '#1F67F3',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-03'
  },
  {
    id: 'iubenda',
    name: 'iubenda',
    shortName: 'iubenda',
    patterns: [
      // iubenda CMP serves all assets and consent APIs from these subdomains
      // (iubenda-only — safe to use bare hostnames per platform-files rule).
      'cdn.iubenda.com',
      'cs.iubenda.com',
      'consent.iubenda.com'
    ],
    category: 'consent',
    description: 'Generates privacy policies, cookie policies, and consent banners from a single dashboard with lawyer-backed clauses.',
    url: 'https://www.iubenda.com',
    color: '#3c29ff',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'ketch',
    name: 'Ketch',
    shortName: 'Ketch',
    patterns: [
      'global.ketchcdn.com',
      'cdn.ketchjs.com',
      'ketchcdn.com'
    ],
    category: 'consent',
    description: 'Data permissioning and consent management platform for privacy-first compliance.',
    url: 'https://www.ketch.com',
    color: '#6366F1',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  // Klaro - Open-source privacy/consent manager by KIProtect
  {
    id: 'klaro',
    name: 'Klaro',
    shortName: 'Klaro',
    patterns: [
      'cdn.kiprotect.com/klaro',
      'klaro.kiprotect.com'
    ],
    category: 'consent',
    description: 'Open-source, privacy-friendly consent manager with per-service consent and a powerful JavaScript API.',
    url: 'https://klaro.org',
    color: '#1A936F',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-08'
  },
  // Moove GDPR - WordPress cookie consent plugin (self-hosted, no external CDN)
  {
    id: 'moove-gdpr',
    name: 'Moove GDPR',
    shortName: 'Moove',
    patterns: [],
    hasBadgePatterns: false,
    category: 'consent',
    description: 'WordPress GDPR cookie compliance plugin by Moove Agency — self-hosted, no external CDN. Detection requires future DOM-based approach.',
    url: 'https://www.mooveagency.com/wordpress-plugins/gdpr-cookie-compliance/',
    color: '#f79322',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-08'
  },
  {
    id: 'onetrust',
    name: 'OneTrust',
    shortName: 'OneTrust',
    patterns: [
      // Global CDN — covers every path on the host (stub, autoblock, consent JSON)
      'cdn.cookielaw.org',
      // REMOVED 2026-08-03: /cdn\.cookielaw\.org\/scripttemplates\/otsdkstub\.js/ and
      // /cdn\.cookielaw\.org\/consent\/[^/]+\/otautoblock\.js/ — dead code on a case
      // mismatch. OneTrust serves otSDKStub.js / OtAutoBlock.js; regexes test the RAW
      // url with no `i` flag, so neither had ever fired. Both paths are already
      // covered by the bare 'cdn.cookielaw.org' string above (BUG71)
      // Regional data-residency CDNs — exclusive, not additive: a regional site emits
      // NO cdn.cookielaw.org request at all, so these are its only detection surface
      'cdn-ukwest.onetrust.com',
      'cdn-apac.onetrust.com',
      'cdn-au.onetrust.com',
      // Future-proof any cdn-<region> host. `//`-anchored to the host position so the
      // customer admin console (app-uk.), knowledge base (my.) and marketing apex,
      // none of which use the cdn- prefix, can never match
      /\/\/cdn-[a-z0-9-]+\.onetrust\.com\//i,
      // Consent receipt API endpoints
      /privacyportal.*\.onetrust\.com\/request\/v1\/consentreceipts/,
      /\.onetrust\.com\/request\/v1\/consentreceipts/,
      // Legacy Optanon SDK
      /optanon\.blob\.core\.windows\.net.*\.js(?:\?|$)/,
      // CookiePro (OneTrust product)
      /cookiepro\.com\/.*\.js(?:\?|$)/,
      // Legacy CookiePro blob storage (low volume, still live)
      'cookiepro.blob.core.windows.net'
      // EXCLUDED: no apex wildcard on onetrust.com — app-uk. (customer admin console),
      // my. (knowledge base), developer docs, trust portal and the marketing apex all
      // live there. geolocation.onetrust.com is deliberately out too: an 86-byte geo-IP
      // JSONP with no Set-Cookie and no visitor identifier (see PLATFORMS-REJECTED.md)
    ],
    category: 'consent',
    description: 'Privacy management and consent platform for global compliance (GDPR, CCPA, etc.).',
    url: 'https://www.onetrust.com',
    color: '#3a7d44',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-08-03'
  },
  {
    id: 'osano',
    name: 'Osano',
    shortName: 'Osano',
    patterns: [
      // Main CMP script (osano.js)
      /cmp\.osano\.com\/.*\/osano\.js/,
      // Segment wrapper script
      /cmp\.osano\.com\/osano\.segment\.js/,
      // Disclosure API (vendor risk data)
      /disclosure\.osano\.com/
    ],
    category: 'consent',
    description: 'Consent management plus vendor risk monitoring that scores third-party privacy practices automatically.',
    url: 'https://www.osano.com',
    color: '#7a3ff1',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'piwik-pro-consent',
    name: 'Piwik Pro Consent Manager',
    shortName: 'Piwik Pro Consent',
    // BUG44 (2026-05-26): two complementary surfacing paths.
    //  1. URL pattern — `ppms.js` is the Consent SDK loader, distinct from the
    //     TM container loader (`/containers/<UUID>.js`). It fires on every pageload
    //     of a Piwik PRO Consent customer, including pageloads where no consent
    //     event dispatches (the cookie was already set by a prior visit).
    //  2. Parse-time elevation — when Analytics's `ppms.php` request carries
    //     `e_c=consent_*`, the piwik-pro parser routes the event to this platform's
    //     id (handles the user-interaction case: form impression / click / accept).
    // Together they cover both "Consent product deployed but quiet" and "Consent
    // product actively dispatching decision events." `containers.piwik.pro/ppms.js`
    // does not overlap with `piwik-pro-tm`'s narrower `/containers/` path so the
    // first-match-wins matcher resolves each URL to a single platform unambiguously.
    // Note: `/privacy-templates.json` IS Consent-product-specific but lives under
    // the TM container's path namespace (`/containers/<UUID>/privacy-templates.json`)
    // so TM's pattern claims it under first-match-wins. Accepted trade-off — the
    // `ppms.js` hit alone is enough to surface Consent on every pageload.
    patterns: [
      'containers.piwik.pro/ppms.js',
    ],
    hasBadgePatterns: false,
    category: 'consent',
    description: 'Consent collection and management integrated with Piwik PRO Analytics Suite — tracks consent form impressions, clicks, and decisions.',
    url: 'https://piwik.pro/gdpr-consent-manager/',
    color: '#0254c0',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-03'
  },
  // Pandectes - Shopify-focused GDPR/CCPA cookie consent with Google Consent Mode v2
  {
    id: 'pandectes',
    name: 'Pandectes GDPR Compliance',
    shortName: 'Pandectes',
    patterns: [
      's.pandect.es',
      'pandectes-gdpr-compliance'
    ],
    category: 'consent',
    description: 'Shopify-focused GDPR and CCPA cookie consent platform with Google Consent Mode v2 and TCF support.',
    url: 'https://pandectes.io',
    color: '#257cff',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-07'
  },
  // Quantcast Choice - Free CMP for publishers (TCF 2.2, GDPR, CCPA)
  {
    id: 'quantcast-choice',
    name: 'Quantcast Choice',
    shortName: 'Quantcast CMP',
    patterns: [
      'cmp.quantcast.com',
      'quantcast.mgr.consensu.org'
    ],
    category: 'consent',
    description: 'Free consent management platform popular with publishers, supporting TCF 2.2, GDPR, and CCPA.',
    url: 'https://www.quantcast.com/products/choice/',
    color: '#316b6f',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-03'
  },
  // Real Cookie Banner - WordPress cookie consent plugin (self-hosted, no external CDN)
  {
    id: 'real-cookie-banner',
    name: 'Real Cookie Banner',
    shortName: 'Real Cookie Banner',
    patterns: [],
    hasBadgePatterns: false,
    category: 'consent',
    description: 'WordPress cookie consent plugin popular in German market — self-hosted, no external CDN. Detection requires future DOM-based approach.',
    url: 'https://devowl.io/wordpress-real-cookie-banner/',
    color: '#4527A0',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-08'
  },
  // Secure Privacy - Agency-optimized CMP
  {
    id: 'secure-privacy',
    name: 'Secure Privacy',
    shortName: 'Secure Privacy',
    patterns: [
      'app.secureprivacy.ai',
      'secureprivacy.ai'
    ],
    category: 'consent',
    description: 'Agency-optimized consent management platform with per-domain pricing.',
    url: 'https://secureprivacy.ai',
    color: '#24B04B',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-03'
  },
  // Securiti - Enterprise privacy and consent management platform
  {
    id: 'securiti',
    name: 'Securiti',
    shortName: 'Securiti',
    patterns: [
      'cdn-prod.securiti.ai',
      'cdn.securiti.ai'
    ],
    category: 'consent',
    description: 'Enterprise privacy and consent management platform with Google-certified CMP and IAB TCF support.',
    url: 'https://securiti.ai/products/consent-management-platform/',
    color: '#1CA8DD',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-08'
  },
  // Sirdata CMP (ABconsent) - EU publisher CMP with IAB TCF
  {
    id: 'sirdata-cmp',
    name: 'Sirdata CMP',
    shortName: 'Sirdata',
    patterns: [
      'cmp.sirdata.com',
      'cache.consentframework.com'
    ],
    category: 'consent',
    description: 'EU publisher consent management platform (ABconsent) with IAB TCF v2.2 certification.',
    url: 'https://www.sirdata.com/en/Consent-Management',
    color: '#FF6B35',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-08'
  },
  {
    id: 'sourcepoint',
    name: 'Sourcepoint',
    shortName: 'Sourcepoint',
    patterns: [
      // Sourcepoint Unified anti-adblock relay apex (Sourcepoint-only; covers
      // cdn., mms., wrapper., consent., notice., etc.)
      'privacy-mgmt.com',
      // MMS endpoint (messaging service)
      /mms\.sp-prod\.net/,
      // CCPA service endpoint
      /ccpa\.sp-prod\.net/,
      // Message endpoints (with account ID pattern)
      /message\d*\.sp-prod\.net/,
      // Unified wrapper on .sp-prod.net (case-insensitive — `wrapperMessagingWithoutDetection.js`)
      /\.sp-prod\.net\/unified\/wrappermessagingwithoutdetection\.js/i,
      // TCF consent string storage
      /sourcepoint\.mgr\.consensu\.org/,
      'privacymanager.io',
      'ats-wrapper.privacymanager.io',
      'geo.privacymanager.io'
    ],
    category: 'consent',
    description: 'Publisher-focused CMP handling consent, ad-block recovery, and privacy messaging with granular A/B testing.',
    url: 'https://www.sourcepoint.com',
    color: '#411f90',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  // Termly - CMP and legal compliance platform for SMBs
  {
    id: 'termly',
    name: 'Termly',
    shortName: 'Termly',
    patterns: [
      'app.termly.io',
      /termly\.io\/api\/v1/
    ],
    category: 'consent',
    description: 'Consent management and legal compliance platform for SMBs, Google CMP Gold Partner.',
    url: 'https://termly.io',
    color: '#4469F3',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-03'
  },
  // Tarteaucitron.js - French open-source GDPR CMP
  {
    id: 'tarteaucitron',
    name: 'Tarteaucitron',
    shortName: 'Tarteaucitron',
    patterns: [
      'cdntag.tarteaucitron.io'
    ],
    category: 'consent',
    description: 'French open-source GDPR cookie consent manager with automatic service detection and Google Consent Mode v2 support.',
    url: 'https://tarteaucitron.io',
    color: '#48A89A',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-08'
  },
  {
    id: 'transcend',
    name: 'Transcend',
    shortName: 'Transcend',
    patterns: [
      // Main airgap.js consent script (with bundle ID)
      /transcend-cdn\.com\/cm\/[^/]+\/airgap\.js/,
      // API endpoints for consent/DSR
      /api\.transcend\.io/,
      /consent\.transcend\.io/,
      // airgap.js telemetry ingestion - CSP-documented as required on the customer's
      // own site, so definitionally page-context. .us. is the data-residency sibling.
      // cdn. is the documented legacy consent-manager CDN.
      'telemetry.transcend.io',
      'telemetry.us.transcend.io',
      'cdn.transcend.io'
    ],
    category: 'consent',
    description: 'Automates DSR fulfillment (access, deletion) across your data systems with a privacy-by-design consent vault.',
    url: 'https://transcend.io',
    color: '#3333ff',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-07-21'
  },
  {
    id: 'trustarc',
    name: 'TrustArc',
    shortName: 'TrustArc',
    patterns: [
      // CCM Advanced script (notice endpoint with params)
      /consent\.trustarc\.com\/notice\?/,
      // CCM Pro script (v2 notice)
      /consent\.trustarc\.com\/v2\/notice\//,
      // Segment wrapper and other JS utilities
      /consent\.trustarc\.com\/get\?name=.*\.js/,
      // Preference center API
      /consent-pref\.trustarc\.com/,
      // Legacy TRUSTe brand
      /consent\.truste\.com/,
      // TrustArc's deliberately-non-branded analytics relay (observed on
      // trustarc.com itself in the 2026-05-15 sweep — TrustArc-only apex)
      'collect.datas3ntinel.com'
    ],
    category: 'consent',
    description: 'Privacy compliance and consent management for enterprise organizations.',
    url: 'https://trustarc.com',
    color: '#00aec7',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  // UniConsent - IAB TCF certified global CMP
  {
    id: 'uniconsent',
    name: 'UniConsent',
    shortName: 'UniConsent',
    patterns: [
      'cmp.uniconsent.com'
    ],
    category: 'consent',
    description: 'IAB TCF v2.3 certified consent management platform supporting GDPR, CCPA, LGPD, and TCF Canada.',
    url: 'https://www.uniconsent.com',
    color: '#2563EB',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-08'
  },
  {
    id: 'usercentrics',
    name: 'Usercentrics',
    shortName: 'Usercentrics',
    patterns: [
      // REMOVED 2026-08-03: /app\.usercentrics\.eu\/browser-sdk\/[^/]+\/bundle.*\.js/ — dead-narrow;
      // pinned the retired CMP v1 `browser-sdk/…/bundle*.js` path and never matched the current
      // `browser-ui` generation; fully subsumed by the //app(.eu) host pattern below (BUG70)
      // API endpoints for consent storage/retrieval
      /api\.usercentrics\.eu/,
      // CMP web interface
      'web.cmp.usercentrics.eu',
      // Loader + browser-ui bundle host, standard and EU-Mode ("//"-anchored so
      // app-preference.preference-management.usercentrics.eu cannot match)
      /\/\/app(?:\.eu)?\.usercentrics\.eu\//,
      // EU-Mode settings/config host
      'config.eu.usercentrics.eu',
      // Cross-device consent sharing
      'cdcs.usercentrics.eu',
      // GraphQL consent API
      'graphql.usercentrics.eu',
      // Consent history endpoint
      'consents.usercentrics.eu',
      // CMP asset/image host
      'img.usercentrics.eu',
      // CMP v3 family (web.cmp / v1.api.service.cmp) — dot-prefixed so only *.cmp.usercentrics.eu matches
      /\.cmp\.usercentrics\.eu\//,
      // Consent-save beacon (/consent/uw/3), standard and eu1 data residency
      /\.consent\.(?:eu1\.)?usercentrics\.eu\//,
      // Usercentrics tracking/analytics beacon (uct), standard, EU-Mode and service variants
      /\/\/uct(?:\.eu)?(?:\.service)?\.usercentrics\.eu\//,
      // Consent aggregator service
      /\/\/aggregator(?:\.eu|\.service)\.usercentrics\.eu\//,
      // Smart Data Protector (pre-consent tag blocker + embed preview proxy)
      /privacy-proxy(?:-server)?\.usercentrics\.eu/
      // EXCLUDED: admin.usercentrics.eu / account.usercentrics.eu (customer admin consoles),
      // *.preference-management.usercentrics.eu (Preference-Manager login),
      // logger.service.usercentrics.eu (CMP crash telemetry, not visitor tracking) — no apex wildcard
    ],
    category: 'consent',
    description: 'Scans your site for trackers and auto-generates consent banners meeting TCF 2.0, GDPR, and CCPA requirements.',
    url: 'https://usercentrics.com',
    color: '#F25800',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-08-03'
  },
  // WebToffee GDPR Cookie Consent - WordPress cookie consent plugin (self-hosted, no external CDN)
  {
    id: 'webtoffee-gdpr',
    name: 'WebToffee GDPR',
    shortName: 'WebToffee',
    patterns: [],
    hasBadgePatterns: false,
    category: 'consent',
    description: 'WordPress GDPR cookie consent plugin by WebToffee — self-hosted, no external CDN. Google-certified CMP with GCM v2 and TCF v2.3 support.',
    url: 'https://www.webtoffee.com/product/gdpr-cookie-consent/',
    color: '#1863dc',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-08'
  },
  // WPLP Cookie Consent - WordPress cookie consent plugin (self-hosted, no external CDN)
  {
    id: 'wplp-cookie-consent',
    name: 'WPLP Cookie Consent',
    shortName: 'WPLP',
    patterns: [],
    hasBadgePatterns: false,
    category: 'consent',
    description: 'WordPress cookie consent plugin by WP Legal Pages — self-hosted, no external CDN. Detection requires future DOM-based approach.',
    url: 'https://wplegalpages.com/cookie-consent/',
    color: '#0066CC',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-03-08'
  },

  // === MONITORING ===
  {
    id: 'akamai-mpulse',
    name: 'Akamai mPulse',
    shortName: 'mPulse',
    // APEX WILDCARDS ARE CORRECT HERE - both apexes are tracking-only and do not even resolve
    // (NXDOMAIN); the mPulse dashboard lives on the separate mpulse.akamai.com. akstat.io
    // subdomains are per-tenant hex values, so enumeration is impossible and the wildcard is
    // required rather than merely convenient.
    // Three-host stack: s.go-mpulse.net serves boomerang.js keyed by a 25-char App key,
    // c.go-mpulse.net/api/config.json is the per-page-load config XHR, <8-hex>.akstat.io is the
    // beacon collector. DELIBERATELY EXCLUDED: mpulse.akamai.com + control.akamai.com (dashboard),
    // akamaihd.net / akamaized.net / akamai.net (general CDN - would flag huge volumes of assets).
    // CATEGORY IS BORDERLINE: WhoTracks.Me files mPulse under Site Analytics because the beacon
    // carries a session id plus site-configurable custom dimensions/metrics and A/B bucket. Kept
    // as monitoring because the product's purpose and default payload are performance.
    patterns: [
      '.go-mpulse.net',
      '.akstat.io'
    ],
    category: 'monitoring',
    description: 'Akamai\'s real-user monitoring service, beaconing page-load performance, session and custom business metrics via boomerang.js.',
    url: 'https://techdocs.akamai.com/mpulse/docs/',
    color: '#D03439',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-22'
  },
  {
    id: 'analyze-ly',
    name: 'Analyze.ly',
    shortName: 'Analyze.ly',
    // OPERATOR INFERRED, PRODUCT UNCONFIRMED. InfoTrust is established as operator via domain
    // history plus an archived product site at ftp.analyze.ly/products/inspect/ - NOT from the
    // hostname. The specific product behind the beacon is unconfirmed: Tag Inspector Realtime is
    // the plausible candidate but no vendor doc names collect.analyze.ly.
    // Category monitoring is therefore a best-inference call; revisit after a live capture.
    // Colour is InfoTrust's brand (the parent), not a product-specific palette.
    patterns: [
      'collect.analyze.ly'
    ],
    category: 'monitoring',
    description: 'Tag-governance beacon associated with InfoTrust, reporting on tag presence and firing behaviour across a site.',
    url: 'https://infotrust.com/products/tag-inspector/',
    color: '#0c6dc7',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'appdynamics',
    name: 'AppDynamics',
    shortName: 'AppDynamics',
    patterns: [
      'cdn.appdynamics.com',
      'col.eum-appdynamics.com',
      /.*\.saas\.appdynamics\.com/
    ],
    category: 'monitoring',
    description: 'End-user monitoring with business transaction correlation, showing how slow pages affect conversion rates.',
    url: 'https://www.appdynamics.com',
    color: '#725EFF',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'azure-application-insights',
    name: 'Azure Application Insights',
    shortName: 'App Insights',
    patterns: [
      'dc.services.visualstudio.com',
      '.in.applicationinsights.azure.com',
      'dc.applicationinsights.azure.com',
      'dc.applicationinsights.microsoft.com'
    ],
    category: 'monitoring',
    description: 'Microsoft Azure Monitor RUM/APM service that collects page views, exceptions, performance metrics, and custom telemetry from web and server applications.',
    url: 'https://azure.microsoft.com/en-us/products/monitor',
    color: '#0078D4',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'blue-triangle',
    name: 'Blue Triangle',
    shortName: 'Blue Triangle',
    patterns: [
      // btttag.com apex is tracking-only (corporate site/dashboard live on bluetriangle.com),
      // so the dot-prefix wildcard safely covers the script host ([siteID].btttag.com) and the
      // d/d1-d6.btttag.com RUM beacon endpoints. NOT Bidtellect (that is bttrack.com).
      '.btttag.com'
    ],
    category: 'monitoring',
    description: 'Real User Monitoring (RUM) and revenue-assurance platform that beacons web/mobile performance and conversion telemetry to btttag.com.',
    url: 'https://bluetriangle.com',
    color: '#0091da',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.1',
    addedDate: '2026-06-02'
  },
  {
    id: 'bugsnag',
    name: 'Bugsnag',
    shortName: 'Bugsnag',
    patterns: [
      'notify.bugsnag.com',
      'sessions.bugsnag.com',
      'd2wy8f7a9ursnm.cloudfront.net'
    ],
    category: 'monitoring',
    description: 'Stability monitoring with release health dashboards, breadcrumb trails, and framework-specific integrations.',
    url: 'https://www.bugsnag.com',
    color: '#097eb3',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'clean-io',
    name: 'Clean.io (HUMAN)',
    shortName: 'Clean.io',
    patterns: [
      'i.clean.gg',
      'clean.gg',
      'clean.io'
    ],
    category: 'monitoring',
    description: 'Ad quality and malvertising protection that blocks malicious ads in real-time. Acquired by HUMAN Security.',
    url: 'https://www.humansecurity.com/products/clean-ad',
    color: '#000000',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'clickcease',
    name: 'ClickCease',
    shortName: 'ClickCease',
    patterns: [
      'www.clickcease.com/monitor/stat.js',
      'monitor.clickcease.com',
      'clickcease.com/monitor'
    ],
    category: 'monitoring',
    description: 'Click fraud protection and ad fraud prevention for Google and Facebook Ads.',
    url: 'https://www.clickcease.com',
    color: '#00C853',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'datadog',
    name: 'Datadog RUM',
    shortName: 'Datadog',
    patterns: [
      'rum.browser-intake-datadoghq.com',
      'rum.browser-intake-datadoghq.eu'
    ],
    category: 'monitoring',
    description: 'Real User Monitoring for frontend performance, errors, and user sessions.',
    url: 'https://www.datadoghq.com',
    color: '#632CA6',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'doubleverify',
    name: 'DoubleVerify',
    shortName: 'DoubleVerify',
    patterns: [
      'pub.doubleverify.com',
      'vtrk.doubleverify.com',
      'cdn.doubleverify.com',
      'tps.doubleverify.com',
      'rtbcdn.doubleverify.com',
      'rtb0.doubleverify.com'
    ],
    category: 'monitoring',
    description: 'Ad verification, brand safety, viewability measurement, and fraud detection for digital advertising.',
    url: 'https://doubleverify.com',
    color: '#6E2CA9',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'dynatrace',
    name: 'Dynatrace',
    shortName: 'Dynatrace',
    patterns: [
      'js-cdn.dynatrace.com',
      'bf.dynatrace.com',
      /.*\.dynatrace\.com\/rum/
    ],
    category: 'monitoring',
    description: 'AI-driven full-stack observability correlating frontend performance with backend traces and infrastructure.',
    url: 'https://www.dynatrace.com',
    color: '#3481F4',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'elastic-rum',
    name: 'Elastic RUM',
    shortName: 'Elastic RUM',
    patterns: [
      'rum-intake.elastic.co',
      'apm.elastic.co',
      'elastic-apm-js'
    ],
    category: 'monitoring',
    description: 'Open-source real user monitoring as part of the Elastic Observability stack.',
    url: 'https://www.elastic.co/observability/application-performance-monitoring',
    color: '#005571',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'forter',
    name: 'Forter',
    shortName: 'Forter',
    patterns: ['.forter.com'],
    category: 'monitoring',
    description: 'E-commerce fraud prevention platform using device fingerprinting, behavioral signals, and identity matching to score transactions and account events in real time.',
    url: 'https://www.forter.com',
    color: '#6B4FBB',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'geoedge',
    name: 'GeoEdge',
    shortName: 'GeoEdge',
    patterns: [
      'rumcdn.geoedge.be',
      'geoedge.be',
      'd.geoedge.be'
    ],
    category: 'monitoring',
    description: 'Ad quality and security verification platform that protects publishers from malicious, offensive, and low-quality ads.',
    url: 'https://www.geoedge.com',
    color: '#4169e1',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'grafana-faro',
    name: 'Grafana Faro',
    shortName: 'Faro',
    patterns: [
      /faro-collector-[a-z0-9-]+\.grafana\.net/i
    ],
    category: 'monitoring',
    description: 'Grafana\'s open-source frontend observability SDK (@grafana/faro-web-sdk) — captures errors, web vitals, user sessions, and OpenTelemetry traces from the browser and ships them to a Grafana Cloud or self-hosted Faro collector. Sibling to Sentry, Datadog RUM, New Relic Browser.',
    url: 'https://grafana.com/oss/faro/',
    color: '#F46800',
    colorVerified: true,
    iconVerified: true,
    parsing: { customParser: true, formattedParser: true },
    addedInVersion: '1.3.0',
    addedDate: '2026-05-19'
  },
  {
    id: 'honeycomb',
    name: 'Honeycomb',
    shortName: 'Honeycomb',
    patterns: [
      'api.honeycomb.io',
      'api.eu1.honeycomb.io'
    ],
    category: 'monitoring',
    description: 'Observability platform with a frontend product line (Honeycomb for Frontend Observability) built on OpenTelemetry. Browser SDK (@honeycombio/opentelemetry-web) captures Core Web Vitals, user interactions, route changes, and custom wide-event attributes and ships OTLP/HTTP traces to api.honeycomb.io.',
    url: 'https://www.honeycomb.io',
    color: '#F5A623',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-19'
  },
  {
    id: 'monsido',
    name: 'Monsido',
    shortName: 'Monsido',
    patterns: [
      'heatmaps.monsido.com',
      'tracking.monsido.com',
      'cdn.monsido.com',
      'app-script.monsido.com'
    ],
    category: 'monitoring',
    description: 'Web governance platform with heatmaps and analytics. Now part of Acquia.',
    url: 'https://www.acquia.com/products/acquia-web-governance',
    color: '#0098db',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-07-21'
  },
  {
    id: 'newrelic',
    name: 'New Relic Browser',
    shortName: 'New Relic',
    patterns: [
      'bam.nr-data.net',
      'bam.eu01.nr-data.net',
      'js-agent.newrelic.com',
      'insights-collector.newrelic.com',
      'insights-collector.eu01.nr-data.net',
      'gov-insights-collector.newrelic.com'
    ],
    category: 'monitoring',
    description: 'Real user monitoring for browser performance, JavaScript errors, and page load timing.',
    url: 'https://newrelic.com',
    color: '#1CE783',
    colorVerified: true,
    textColor: '#0ea55e',
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'perimeterx',
    name: 'PerimeterX (HUMAN)',
    shortName: 'PerimeterX',
    patterns: [
      'client.px-cloud.net',
      /collector-[a-z0-9]+\.px-cloud\.net/,
      'px-cloud.net',
      'px-cdn.net',
      'pxchk.net'
    ],
    category: 'monitoring',
    description: 'Bot detection and fraud prevention platform for protecting websites from automated threats. Rebranded as HUMAN Security.',
    url: 'https://www.humansecurity.com',
    color: '#136ff8',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'pingdom',
    name: 'Pingdom RUM',
    shortName: 'Pingdom',
    patterns: [
      '.pingdom.net'
    ],
    category: 'monitoring',
    description: 'Real User Monitoring (RUM) by SolarWinds Pingdom — Navigation Timing beacons sent from a JS snippet to sharded rum-collector-N.pingdom.net collectors.',
    url: 'https://www.pingdom.com',
    color: '#FFCB05',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'raygun',
    name: 'Raygun',
    shortName: 'Raygun',
    patterns: [
      'api.raygun.io',
      'cdn.raygun.io',
      'js.raygun.io'
    ],
    category: 'monitoring',
    description: 'Combines crash reporting with real user monitoring so you see both errors and their performance impact.',
    url: 'https://raygun.com',
    color: '#f4db12',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'riskified',
    name: 'Riskified',
    shortName: 'Riskified',
    patterns: [
      'beacon.riskified.com'
    ],
    category: 'monitoring',
    description: 'Anti-fraud and chargeback prevention platform widely used by ecommerce sites — deploys a client-side beacon that captures device and behavioural signals to score transactions for fraud risk. Used by major D2C and apparel retailers (Zara, Wayfair, Peloton, Gymshark).',
    url: 'https://www.riskified.com',
    color: '#5b30a8',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-18'
  },
  {
    id: 'rollbar',
    name: 'Rollbar',
    shortName: 'Rollbar',
    patterns: [
      'api.rollbar.com',
      'd37gvrvc0wt4s1.cloudfront.net',
      'cdn.rollbar.com'
    ],
    category: 'monitoring',
    description: 'Groups errors by root cause, links to source code, and predicts which issues will impact users most.',
    url: 'https://rollbar.com',
    color: '#3569F3',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'sentry',
    name: 'Sentry',
    shortName: 'Sentry',
    patterns: [
      '.ingest.sentry.io',
      'sentry.io/api',
      // browser-SDK CDN - the loader that bootstraps before the *.ingest.sentry.io beacon
      'browser.sentry-cdn.com'
    ],
    category: 'monitoring',
    description: 'Application monitoring for error tracking, performance, and debugging in production.',
    url: 'https://sentry.io',
    color: '#e1567c',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-07-21'
  },
  {
    id: 'speedcurve',
    name: 'SpeedCurve',
    shortName: 'SpeedCurve',
    patterns: [
      'cdn.speedcurve.com',
      'lux.speedcurve.com',
      // RUM POST beacon (lux.js v4+, opt-out removed 2024-11-30). CSP-documented
      // connect-src host. Enumerated, not wildcarded: the apex is marketing,
      // support. is docs, api. is the authenticated customer REST API.
      'beacon.speedcurve.com'
    ],
    category: 'monitoring',
    description: 'Synthetic and RUM performance monitoring with filmstrip comparisons and Core Web Vitals tracking.',
    url: 'https://www.speedcurve.com',
    color: '#09b2b9',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-07-21'
  },
  {
    id: 'trackjs',
    name: 'TrackJS',
    shortName: 'TrackJS',
    patterns: [
      'usage.trackjs.com',
      'capture.trackjs.com',
      'cdn.trackjs.com'
    ],
    category: 'monitoring',
    description: 'JavaScript-focused error tracker with timeline reconstruction showing console logs, network, and clicks before crash.',
    url: 'https://trackjs.com',
    color: '#d03f40',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'vtex-telemetry',
    name: 'VTEX Telemetry',
    shortName: 'VTEX Telemetry',
    // Identified via the origin's own envoy routing header:
    // x-envoy-decorator-operation: otel-o11y-public-stable-opentelemetry-collector.traces...
    // Host-scoped without a path is correct here and is NOT a relaxation of the precision
    // rule: every probed path returns the identical collector gateway, the host accepts only
    // POST/OPTIONS and serves no HTML/admin/docs surface. The OTLP convention /v1/traces is
    // UNVERIFIED, so path-scoping would risk a silent miss (the BUG24/25/27/28/29 class).
    // NEVER widen to .vtex.com -- the apex serves marketing, developer docs, help centre and
    // the merchant admin console. Distinct from vtex-analytics (behavioural) and
    // vtex-intelligent-search (search relevance): different product, different category.
    // Colour is VTEX 'Rebel Pink'; Simple Icons carries a stale #ED125F -- do not resync.
    patterns: [
      'telemetry.vtex.com'
    ],
    category: 'monitoring',
    description: 'VTEX\'s public OpenTelemetry Collector traces ingest, receiving browser-side OTel spans (page load, fetch, user interaction, errors) from VTEX storefronts, predominantly VTEX Checkout.',
    url: 'https://vtex.com',
    color: '#F71963',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.4.2',
    addedDate: '2026-08-04'
  },
  {
    id: 'yottaa',
    name: 'Yottaa',
    shortName: 'Yottaa',
    patterns: [
      '.yottaa.net'
    ],
    category: 'monitoring',
    description: 'eCommerce site acceleration and Real User Monitoring (RUM) platform — sequences third-party app loading on Shopify Plus and other storefronts, and collects page-load performance beacons via .yottaa.net (qoe-N shards).',
    url: 'https://www.yottaa.com',
    color: '#1f3b6e',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-19'
  },

  // === VIDEO ===
  {
    id: 'bambuser',
    name: 'Bambuser',
    shortName: 'Bambuser',
    patterns: [
      'bambuser.com',
      'liveshopping.bambuser.com'
    ],
    category: 'video',
    description: 'Video commerce platform enabling live shopping, shoppable video, and one-to-one video consultations for e-commerce.',
    url: 'https://bambuser.com',
    color: '#5D2E8C',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'bitmovin',
    name: 'Bitmovin',
    shortName: 'Bitmovin',
    patterns: [
      // Analytics endpoints only
      'analytics.bitmovin.com',
      'bitanalytics.bitmovin.com'
      // EXCLUDED: bitmovin.com (website/player)
      // EXCLUDED: bitmovin-a.akamaihd.net (CDN)
      // EXCLUDED: cdn.bitmovin.com (CDN)
    ],
    category: 'video',
    description: 'Video player analytics with QoE monitoring across all platforms.',
    url: 'https://bitmovin.com',
    color: '#1ab3ff',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'brightcove',
    name: 'Brightcove',
    shortName: 'Brightcove',
    patterns: [
      // Analytics endpoints only
      'metrics.brightcove.com',
      'analytics.brightcove.com'
      // EXCLUDED: players.brightcove.net (player JS loading)
      // EXCLUDED: bcove.video (video delivery)
      // EXCLUDED: brightcove.com (website)
    ],
    category: 'video',
    description: 'Enterprise video platform analytics and video marketing metrics.',
    url: 'https://www.brightcove.com',
    color: '#F76531',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'conviva',
    name: 'Conviva',
    shortName: 'Conviva',
    patterns: [
      // Conviva Web Service (analytics)
      'cws.conviva.com',
      // Analytics pass
      'livepass.conviva.com',
      // Beacon endpoint pattern
      /.*\.conviva\.com\/0\/wsg/
      // EXCLUDED: conviva.com (too broad, includes website)
    ],
    category: 'video',
    description: 'Streaming intelligence platform for video quality of experience measurement.',
    url: 'https://www.conviva.com',
    color: '#9cdc00',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'firework',
    name: 'Firework',
    shortName: 'Firework',
    // .fwpixel.com apex wildcard is safe: it is a dedicated tracking-only domain (covers p1,
    // p2, p2-custom, p2-staging). Firework's marketing site, docs, login and customer
    // dashboard all live on firework.com / business.firework.com / docs.firework.com, so
    // there is no admin-UI surface on fwpixel.com. Do NOT add .firework.com.
    // fireworkapi1.com excluded as a widget content API rather than a tracking beacon.
    // *.pixelsdata.com appears in Firework's CSP allowlist but the operator could not be
    // attributed -- leave it unregistered rather than credit it to Firework.
    // Purchase beacon path is /trk/user:purchase. Operator is Loop Now Technologies, Inc.
    patterns: [
      '.fwpixel.com',
      'fireworkanalytics.com',
      'fireworkadservices1.com',
      'asset.fwcdn2.com',
      'asset.fwcdn3.com'
    ],
    category: 'video',
    description: 'Shoppable and interactive video commerce platform by Loop Now Technologies, tracking video engagement and purchase conversions via its fwpixel beacon.',
    url: 'https://firework.com',
    color: '#006AFF',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.2',
    addedDate: '2026-08-04'
  },
  {
    id: 'jwplayer',
    name: 'JW Player',
    shortName: 'JW Player',
    patterns: [
      // JW Analytics pixel domain (the real analytics)
      /.*\.jwpltx\.com/,
      'ping.jwpltx.com',
      'prd.jwpltx.com'
      // EXCLUDED: ssl.p.jwpcdn.com (player CDN)
      // EXCLUDED: cdn.jwplayer.com (player CDN)
      // EXCLUDED: jwplayer.com (website/player)
    ],
    category: 'video',
    description: 'Video player analytics, ad serving metrics, and recommendation tracking for publishers.',
    url: 'https://www.jwplayer.com',
    color: '#ec0041',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'mux',
    name: 'Mux',
    shortName: 'Mux',
    patterns: [
      // Mux Data analytics (litix.io is Mux's analytics domain)
      /.*\.litix\.io/,
      'img.litix.io',
      'inferred.litix.io'
      // EXCLUDED: stream.mux.com (video streaming)
      // EXCLUDED: mux.com (website)
      // EXCLUDED: cdn.mux.com (CDN)
      // EXCLUDED: image.mux.com (thumbnails)
    ],
    category: 'video',
    description: 'Developer video platform with streaming infrastructure and built-in quality analytics.',
    url: 'https://mux.com',
    color: '#FF6101',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'spotify',
    name: 'Spotify',
    shortName: 'Spotify',
    patterns: [
      // Telemetry hosts
      'log.spotify.com',
      // Host-anchored so it cannot swallow ADanalytics.spotify.com, which is Spotify Ad
      // Analytics' customer dashboard (its own registry entry: spotify-ad-analytics).
      // A bare 'analytics.spotify.com' substring matched that dashboard — fixed 2026-07-21.
      /\/\/analytics\.spotify\.com/,
      // Regional client API shards (gew1=Google Europe West 1, gue1, guc, etc.) — mix of metadata + telemetry
      '-spclient.spotify.com',
      // Legacy non-regional shard
      'spclient.wg.spotify.com'
      // EXCLUDED: open.spotify.com (web player UI)
      // EXCLUDED: api.spotify.com (public Web API)
      // EXCLUDED: *.scdn.co (audio CDN)
    ],
    category: 'video',
    description: 'Audio streaming platform — embed analytics and telemetry from Spotify Web Player and Spotify embeds (podcasts, music, playlists).',
    url: 'https://spotify.com',
    color: '#1DB954',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.2.0',
    addedDate: '2026-04-29'
  },
  {
    id: 'terrific-live',
    name: 'Terrific Live',
    shortName: 'Terrific',
    // CATEGORY: video over widgets - the primary product is embedded live-shopping / shoppable
    // video; the bundled Terrific Pixel is attribution plumbing for that video product rather than
    // a standalone analytics tool.
    // The two apex patterns are PATH-SCOPED on purpose. Corporate/marketing/support live on a
    // SEPARATE apex (terrificlive.com) which is deliberately NOT registered - do not confuse the two.
    patterns: [
      'live-sdk.terrific.live',
      'live-cdn.terrific.live',
      'app-terrific-live-prod.terrific.live',
      'polls.terrific.live',
      'terrific.live/api/customer-shop-event',
      'terrific.live/terrific-sdk.js'
    ],
    category: 'video',
    description: 'Live-shopping and shoppable-video platform embedding interactive streams, polls and product events into storefronts.',
    url: 'https://www.terrificlive.com/',
    color: '#fd7830',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'vidyard',
    name: 'Vidyard',
    shortName: 'Vidyard',
    patterns: [
      // Analytics API endpoint
      'analytics-api.vidyard.com',
      // Analytics tracking on play subdomain
      /play\.vidyard\.com\/.*analytics/,
      /.*\.vidyard\.com\/.*tracking/
      // EXCLUDED: cdn.vidyard.com (assets)
      // EXCLUDED: embed.vidyard.com (player embed)
      // EXCLUDED: vidyard.com (website)
    ],
    category: 'video',
    description: 'B2B video hosting platform with viewer analytics and sales engagement tracking.',
    url: 'https://www.vidyard.com',
    color: '#8685FB',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'vimeo',
    name: 'Vimeo',
    shortName: 'Vimeo',
    patterns: [
      // Vimeo's analytics service (Fresnel)
      'fresnel.vimeo.com',
      'fresnel.vimeocdn.com',
      // Event logging
      /.*\.vimeo\.com\/.*\/log/
      // EXCLUDED: player.vimeo.com (embed/player)
      // EXCLUDED: f.vimeocdn.com (CDN delivery)
      // EXCLUDED: vimeo.com/api (general API)
    ],
    category: 'video',
    description: 'Video hosting with engagement analytics and viewer insights for creators.',
    url: 'https://vimeo.com',
    color: '#1ab7ea',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'whatmore',
    name: 'Whatmore',
    shortName: 'Whatmore',
    // NEVER wildcard whatmore.live: the apex redirects to the whatmore.ai marketing site and
    // dashboard.whatmore.live is the merchant admin UI.
    // api.whatmore.live DELIBERATELY OMITTED - a JSON endpoint whose caller context is unverified
    // and which is plausibly the dashboard backend; extend only after a live storefront capture.
    patterns: [
      'analytics.whatmore.live',
      'consumer.whatmore.live',
      'cdn-consumer.whatmore.live'
    ],
    category: 'video',
    description: 'Shoppable-video and live-commerce widget for e-commerce storefronts, tracking video engagement and product interactions.',
    url: 'https://www.whatmore.ai/',
    color: '#47e2ff',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'wistia',
    name: 'Wistia',
    shortName: 'Wistia',
    patterns: [
      // Analytics processing endpoints
      /distillery.*\.wistia\.com/,
      'pipedream.wistia.com',
      // Event tracking on fast.wistia (the /ev path)
      /fast\.wistia?\.(com|net)\/.*\/ev/
      // EXCLUDED: embedwistia-a.akamaihd.net (CDN)
      // EXCLUDED: fast.wistia.com general (player loading)
    ],
    category: 'video',
    description: 'Video hosting platform with built-in analytics, heatmaps, and marketing integrations.',
    url: 'https://wistia.com',
    color: '#54bbff',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'youbora',
    name: 'NPAW / Youbora',
    shortName: 'YOUBORA',
    patterns: [
      // NQS = Nice Query Service (analytics)
      'nqs.nice264.com',
      // FDS analytics servers
      /.*\.youborafds.*\.com/,
      /a-fds\.youbora.*\.com/
      // EXCLUDED: youbora.com (website/dashboard)
      // EXCLUDED: npaw.com (website)
    ],
    category: 'video',
    description: 'Streaming video analytics for quality of experience (QoE) measurement.',
    url: 'https://npaw.com',
    color: '#5c96be',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'youtube-stats',
    name: 'YouTube Stats',
    shortName: 'YouTube Stats',
    patterns: [
      // Stats API - the real analytics endpoints
      'youtube.com/api/stats',
      's.youtube.com/api/stats',
      'youtube-nocookie.com/api/stats',
      // Telemetry logging
      'youtube.com/youtubei/v1/log_event',
      'youtube-nocookie.com/youtubei/v1/log_event'
      // EXCLUDED: googlevideo.com (CDN delivery)
      // EXCLUDED: /youtubei/v1/player (API metadata, not analytics)
    ],
    category: 'video',
    description: 'Video engagement tracking: watch time, quality metrics, and viewer analytics.',
    url: 'https://www.youtube.com/',
    color: '#ff0000',
    colorVerified: true,
    iconVerified: true, // Simple Icons: YouTube
    consumesGCM: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },

  // === WIDGETS ===
  {
    id: '15gifts',
    name: '15Gifts (Humara)',
    shortName: '15Gifts',
    patterns: ['.15gifts.com'],
    category: 'widgets',
    description: 'Guided-selling and conversational-commerce widget for telco — drives in-page product recommendations and plan selection. Rebranded as Humara in 2026; widget infrastructure remains on 15gifts.com.',
    url: 'https://www.humara.com',
    color: '#1F2937',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: '247-ai-engagement-cloud',
    name: '[24]7.ai Engagement Cloud',
    shortName: '[24]7.ai',
    patterns: ['.247-inc.net'],
    category: 'widgets',
    description: 'Conversational AI and predictive customer engagement platform — chat invitations, intent prediction, and visitor analytics delivered via the TIE (Tag Insertion Engine) tag.',
    url: 'https://www.247.ai',
    color: '#DA291C',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-11'
  },
  // AddToAny - Social sharing widget
  {
    id: 'addtoany',
    name: 'AddToAny',
    shortName: 'AddToAny',
    patterns: [
      'addtoany.com',
      'static.addtoany.com/menu',
      'www.addtoany.com/page'
    ],
    category: 'widgets',
    description: 'Universal social sharing buttons and analytics widget embedded on websites.',
    url: 'https://www.addtoany.com',
    color: '#0166FF',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'alia',
    name: 'Alia',
    shortName: 'Alia',
    // api.alia-prod.com added by host-completeness enumeration (loaded by the vendor's own
    // site). cdn.alia-prod.com is plausible but UNVERIFIED - do not add without evidence.
    // Not in WhoTracks.Me / Ghostery / Better.fyi; identification is vendor-docs-based.
    patterns: [
      'backend.alia-prod.com',
      'api.alia-prod.com'
    ],
    category: 'widgets',
    description: 'Shopify popup and quiz widget that captures zero-party data through on-site offers and surveys.',
    url: 'https://www.aliapopups.com/',
    color: '#e5ff66',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'appcues',
    name: 'Appcues',
    shortName: 'Appcues',
    patterns: [
      'fast.appcues.com',
      'api.appcues.com',
      'my.appcues.com'
    ],
    category: 'widgets',
    description: 'Product onboarding and adoption platform with in-app flows, tooltips, and announcements.',
    url: 'https://www.appcues.com',
    color: '#5c5cff',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'bazaarvoice',
    name: 'Bazaarvoice',
    shortName: 'Bazaarvoice',
    patterns: [
      'display.ugc.bazaarvoice.com',
      'apps.bazaarvoice.com'
    ],
    category: 'widgets',
    description: 'User-generated content platform for ratings, reviews, and Q&A syndication.',
    url: 'https://www.bazaarvoice.com',
    color: '#4C60F6',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'bestchat',
    name: 'BestChat',
    shortName: 'BestChat',
    patterns: ['event.bestchat.com'],
    category: 'widgets',
    description: 'AI chatbot and live-chat widget for Shopify, Wix, and WordPress stores; event.bestchat.com collects visitor and widget-engagement telemetry.',
    url: 'https://www.bestchat.com',
    color: '#5165FF',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-11'
  },
  {
    id: 'bmetric',
    name: 'bMetric',
    shortName: 'bMetric',
    patterns: [
      'insight.bellmetric.net',
      'bellmetric.net',
      'web.telemetric.dk',
      'telemetric.dk',
      'bmetric.com'
    ],
    category: 'widgets',
    description: 'Danish call tracking and customer insight platform.',
    url: 'https://bmetric.dk',
    color: '#6366f1',
    colorVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'bold-metrics',
    name: 'Bold Metrics',
    shortName: 'Bold Metrics',
    // web-api. is the browser telemetry/conversion host (POST /purchase with anon_id, order
    // value, geo); api. is the functional sizing API (virtualsizer/virtualtailor) and is often
    // server-side, so it may rarely fire client-side. Never wildcard the apex: docs. is the
    // public developer portal and webhooks. is integration plumbing. The SDK loads from a
    // rotation-prone CloudFront distribution host, deliberately not registered.
    // No Brandfetch record on either apex; colour is a neutral placeholder.
    patterns: [
      'web-api.boldmetrics.io',
      'api.boldmetrics.io'
    ],
    category: 'widgets',
    description: 'AI body-measurement and smart size-chart widget for apparel retailers, predicting garment fit from a few shopper inputs.',
    url: 'https://boldmetrics.com',
    color: '#000000',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'crisp',
    name: 'Crisp',
    shortName: 'Crisp',
    patterns: [
      'client.crisp.chat',
      'client.relay.crisp.chat',
      'storage.crisp.chat',
      'app.crisp.chat'
    ],
    category: 'widgets',
    description: 'Live chat and customer messaging platform with shared inbox.',
    url: 'https://crisp.chat',
    color: '#1981f5',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'disqus',
    name: 'Disqus',
    shortName: 'Disqus',
    patterns: [
      'disqus.com/embed.js',
      'disqus.com/count.js',
      'disqus.com/embed/comments',
      /[a-z0-9-]+\.disqus\.com/
    ],
    category: 'widgets',
    description: 'Third-party commenting and community engagement platform embedded on websites.',
    url: 'https://disqus.com',
    color: '#2E9FFF',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'dixa',
    name: 'Dixa',
    shortName: 'Dixa',
    patterns: [
      'messenger.dixa.io',
      'messenger-edge.dixa.io'
    ],
    category: 'widgets',
    description: 'Danish conversational customer-engagement and live-chat platform; embeddable messenger widget for ecommerce support (Mejuri, Rapha, Interflora, Too Good To Go).',
    url: 'https://www.dixa.com',
    color: '#204ECF',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-28'
  },
  {
    id: 'drift',
    name: 'Drift',
    shortName: 'Drift',
    patterns: [
      'js.driftt.com',
      'event.api.drift.com',
      'api.drift.com',
      'customer.api.drift.com'
    ],
    category: 'widgets',
    description: 'Conversational marketing platform with AI chatbots and live chat for B2B.',
    url: 'https://www.drift.com',
    color: '#0a5bff',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'ekonsilio',
    name: 'eKonsilio',
    shortName: 'eKonsilio',
    // The observed host was analytics.ekonsilio.io, but the documented and universally-loaded
    // host is livechat.ekonsilio.io/{ID}.js - both registered. Service domain is ekonsilio.io;
    // marketing + dashboard live on the separate ekonsilio.com. Do NOT wildcard .ekonsilio.io:
    // privacy. and developers. are docs hosts.
    patterns: [
      'livechat.ekonsilio.io',
      'analytics.ekonsilio.io',
      'api.livechat.ekonsilio.io'
    ],
    category: 'widgets',
    description: 'Conversational-marketing live chat that qualifies and routes inbound leads for automotive and real-estate advertisers.',
    url: 'https://www.ekonsilio.com/',
    color: '#563a9c',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'fittingbox',
    name: 'Fittingbox Virtual Try-On',
    shortName: 'Fittingbox',
    // analytics-api.fittingbox.com is NOT confirmed in any tracker database - the collector
    // role is inferred from the host name plus the vendor's web-storage doc describing
    // sessionNavigationToken as an analytics identifier. VERIFY WITH A LIVE CAPTURE.
    patterns: [
      'analytics-api.fittingbox.com',
      'vto-advanced-integration-api.fittingbox.com'
    ],
    category: 'widgets',
    description: 'Virtual try-on widget for eyewear retailers, rendering frames on a live camera feed and reporting try-on engagement.',
    url: 'https://www.fittingbox.com/',
    color: '#17274a',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'flowbox',
    name: 'Flowbox',
    shortName: 'Flowbox',
    patterns: [
      'a.getflowbox.com',
      'connect.getflowbox.com'
    ],
    category: 'widgets',
    description: 'User-generated content (UGC) and visual commerce platform that embeds shoppable social-proof galleries on e-commerce sites.',
    url: 'https://getflowbox.com',
    color: '#5E33B5',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-11'
  },
  {
    id: 'foresee',
    name: 'ForeSee (Verint)',
    shortName: 'ForeSee',
    patterns: [
      'foresee.com',
      'answerscloud.com',
      '4seeresults.com',
      'foreseeresults.com'
    ],
    category: 'widgets',
    description: 'Voice of Customer survey platform with CX measurement and session recording. Now part of Verint.',
    url: 'https://www.verint.com/foresee/',
    color: '#00AF87',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'freshdesk',
    name: 'Freshdesk',
    shortName: 'Freshdesk',
    patterns: [
      'wchat.freshchat.com',
      'assetscdn-wchat.freshchat.com',
      'widget.freshworks.com',
      'euc-widget.freshworks.com',
      // Per-tenant Freshchat subdomains (e.g. teamhaven.freshchat.com).
      // Negative lookahead skips wchat./web./assetscdn-wchat. — those are either
      // the shared widget host (already matched above) or the operator-internal
      // agent admin portal, which we do NOT want to flag as tracking.
      /\/\/(?!(?:wchat|web|assetscdn-wchat)\.)[a-z0-9-]+\.freshchat\.com/i
    ],
    category: 'widgets',
    description: 'Customer support suite with live chat, ticketing, and messaging widgets.',
    url: 'https://www.freshworks.com',
    color: '#8512E0',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'giosg',
    name: 'Giosg',
    shortName: 'Giosg',
    patterns: [
      'api.giosg.com',
      'service.giosg.com'
    ],
    category: 'widgets',
    description: 'Finnish live-chat, chatbot, and conversational sales widget platform. Visitor sessions, messages, and goal/conversion tracking flow through api.giosg.com and service.giosg.com.',
    url: 'https://www.giosg.com',
    color: '#1A1A1A',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-05'
  },
  {
    id: 'gladly',
    name: 'Gladly',
    shortName: 'Gladly',
    patterns: [
      'cdn.gladly.com',
      'chat-assets.cdn.gladly.com',
      'chat-sdk.cdn.gladly.com',
      'media.cdn.gladly.com',
      'api.us-1.gladly.chat',
      'ws.us-1.gladly.chat'
    ],
    category: 'widgets',
    description: 'Customer-service platform with an embedded chat widget used by consumer brands (Allbirds, JetBlue, Crate & Barrel, Warby Parker, Brooklinen).',
    url: 'https://www.gladly.com',
    color: '#009B00',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-28'
  },
  {
    id: 'gorgias',
    name: 'Gorgias',
    shortName: 'Gorgias',
    patterns: [
      'config.gorgias.chat',
      'api.gorgias.io',
      'chat.gorgias.io'
    ],
    category: 'widgets',
    description: 'E-commerce helpdesk pulling order data from Shopify/BigCommerce directly into chat conversations.',
    url: 'https://www.gorgias.com',
    color: '#FF977F',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'helpscout',
    name: 'Help Scout',
    shortName: 'Help Scout',
    patterns: [
      'beacon-v2.helpscout.net',
      'd3hb14vkzrxvla.cloudfront.net',
      'beaconapi.helpscout.net'
    ],
    category: 'widgets',
    description: 'Embeddable Beacon widget showing help docs, live chat, and contact forms in a single popover.',
    url: 'https://www.helpscout.com',
    color: '#2F4DDB',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'intercom',
    name: 'Intercom',
    shortName: 'Intercom',
    patterns: [
      'api.intercom.io',
      'api-iam.intercom.io',
      'widget.intercom.io',
      'js.intercomcdn.com',
      'intercom.io/messenger'
    ],
    category: 'widgets',
    description: 'Customer messaging platform with chat, bots, and product tours for support and engagement.',
    url: 'https://www.intercom.com',
    color: '#0087FF',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'judge-me',
    name: 'Judge.me',
    shortName: 'Judge.me',
    patterns: [
      'cdn.judge.me',
      'judge.me'
    ],
    category: 'widgets',
    description: 'Product review and UGC collection app, popular on Shopify stores.',
    url: 'https://judge.me',
    color: '#151515',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'justuno',
    name: 'Justuno',
    shortName: 'Justuno',
    patterns: [
      'cdn.justuno.com',
      'app.justuno.com',
      // REMOVED 2026-07-21: bare 'justuno.com' matched my.justuno.com (logged-in
      // customer dashboard) + support./hub.justuno.com (docs). Superseded by the
      // analytics. + scripttags. hosts below; cdn. and app. above still stand.
      'analytics.justuno.com',
      'scripttags.justuno.com',
      // jst.ai is Justuno's CNAME-cloaked serving domain (cdn.justuno.com -> cdn.jst.ai,
      // migrated Jan 2020). Carries the bulk of production tracking; no customer-facing
      // surface lives on this apex. Enumerated rather than wildcarded - apex unverifiable.
      'aly.jst.ai',
      'analytics.jst.ai',
      'cdn.jst.ai',
      'scripttags.jst.ai',
      'client.jst.ai',
      'push.jst.ai'
    ],
    category: 'widgets',
    description: 'Conversion optimization with AI-driven popups, banners, and promotions.',
    url: 'https://www.justuno.com',
    color: '#F2B344',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-07-21'
  },
  {
    id: 'kiwi-sizing',
    name: 'Kiwi Sizing',
    shortName: 'Kiwi Sizing',
    patterns: [
      'app.kiwisizing.com'
    ],
    category: 'widgets',
    description: 'Shopify and WooCommerce size chart and AI fit recommender widget; tracks sizing-tool interactions and forwards custom events to Google Analytics.',
    url: 'https://kiwisizing.com',
    color: '#7BC043',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-05'
  },
  {
    id: 'kustomer',
    name: 'Kustomer',
    shortName: 'Kustomer',
    // Do NOT use a bare .kustomerapp.com wildcard - <org>.kustomerapp.com is the Kustomer
    // AGENT/ADMIN CONSOLE and would be flagged as tracking for every customer's own staff.
    // The leading dot suffix-anchors the per-tenant API form instead. Realtime transport runs
    // over PubNub (shared multi-vendor infra) and must not be attributed to Kustomer.
    // Marketing, help centre and developer docs are on the separate kustomer.com apex.
    patterns: [
      '.api.kustomerapp.com',
      'api.kustomerapp.com',
      'cdn.kustomerapp.com'
    ],
    category: 'widgets',
    description: 'CRM-based customer-service platform with an embeddable web chat widget that issues identity, session and conversation calls.',
    url: 'https://www.kustomer.com/',
    color: '#658A9A',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'livechat',
    name: 'LiveChat',
    shortName: 'LiveChat',
    patterns: [
      'cdn.livechatinc.com',
      'api.livechatinc.com',
      'secure.livechatinc.com',
      'accounts.livechat.com'
    ],
    category: 'widgets',
    description: 'Live chat software for customer service and sales conversations.',
    url: 'https://www.livechat.com',
    color: '#d36832',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'liveperson',
    name: 'LivePerson',
    shortName: 'LivePerson',
    patterns: [
      'lptag.liveperson.net',
      '.v.liveperson.net',
      'lpsnmedia.net'
    ],
    category: 'widgets',
    description: 'AI-powered conversational engagement platform with live chat, messaging, and monitoring SDK.',
    url: 'https://www.liveperson.com',
    color: '#3863E5',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'loyaltylion',
    name: 'LoyaltyLion',
    shortName: 'LoyaltyLion',
    // NEVER wildcard loyaltylion.com - app.loyaltylion.com is the merchant admin dashboard and
    // help./developers./status./info./www. are support + marketing. The SDK loader lives on the
    // separate .net apex (sdk.loyaltylion.net), which is tracking-only.
    patterns: [
      'platform.loyaltylion.com',
      'sdk.loyaltylion.net',
      'api.loyaltylion.com'
    ],
    category: 'widgets',
    description: 'E-commerce loyalty and referrals platform whose on-site widget tracks points, rewards and referral activity.',
    url: 'https://loyaltylion.com',
    color: '#C97DF0',
    colorVerified: false,
    iconVerified: true,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'mapbox',
    name: 'Mapbox',
    shortName: 'Mapbox',
    patterns: [
      // Telemetry-only pattern following the Vimeo / Wistia / Mux convention.
      // Real captures (e.g. strava.com → mapbox-gl-js v2.15.0) confirm POST /events/v2
      // with map.load lifecycle events. EXCLUDED by design: api.mapbox.com (REST API
      // for geocoding/directions — app-functional), *.tiles.mapbox.com (tile CDN),
      // mapbox.com bare (marketing site).
      'events.mapbox.com'
    ],
    category: 'widgets',
    description: 'Geospatial mapping platform — embed analytics and SDK telemetry from Mapbox GL JS and mobile SDKs (alternative to Google Maps used by Strava, Foursquare, GitHub, and many others).',
    url: 'https://www.mapbox.com',
    color: '#007AFC',
    colorVerified: true,
    iconVerified: true,
    addedInVersion: '1.2.0',
    addedDate: '2026-04-29'
  },
  {
    id: 'markerio',
    name: 'Marker.io',
    shortName: 'Marker.io',
    patterns: [
      'api.marker.io',
      'edge.marker.io'
    ],
    category: 'widgets',
    description: 'Visual feedback and in-page bug-reporting widget — lets site visitors annotate pages and file issues to Jira, Linear, GitHub, Trello, Asana, or ClickUp.',
    url: 'https://marker.io',
    color: '#7c3bed',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-14'
  },
  {
    id: 'medallia',
    name: 'Medallia',
    shortName: 'Medallia',
    patterns: [
      'kampyle.com',
      'nebula-cdn.kampyle.com',
      'nebula.kampyle.com',
      // Regional Medallia Digital cloud variants — covers digital-cloud.,
      // digital-cloud-west., digital-cloud-us-main., digital-cloud-gov.,
      // digital-cloud-prem., digital-cloud-uk. (on .medallia.com, .medallia.eu, or .medallia.ca).
      // Subsumes the previous literals digital-cloud.medallia.com and
      // resources.digital-cloud-west.medallia.com. The .ca TLD covers the Canadian-residency
      // hublet (analytics-fe.digital-cloud.medallia.ca), added 2026-06-02.
      /digital-cloud(-[a-z0-9-]+)?\.medallia\.(com|eu|ca)/
    ],
    category: 'widgets',
    description: 'Enterprise Voice of Customer (VoC) platform with digital feedback surveys and intercepts. Formerly Kampyle.',
    url: 'https://www.medallia.com',
    color: '#4050C6',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26',
    updatedDate: '2026-06-02'
  },
  {
    id: 'mopinion',
    name: 'Mopinion',
    shortName: 'Mopinion',
    patterns: [
      'deploy.mopinion.com',
      'app.mopinion.com'
    ],
    category: 'widgets',
    description: 'Customer feedback and survey platform for collecting user insights across digital channels.',
    url: 'https://mopinion.com',
    color: '#1a73e8',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'navattic',
    name: 'Navattic',
    shortName: 'Navattic',
    patterns: [
      'js.navattic.com',
      'app.navattic.com',
      'capture.navattic.com',
      'api.navattic.com',
      'events.navattic.com'
    ],
    category: 'widgets',
    description: 'Interactive product demo platform for creating self-guided product tours.',
    url: 'https://www.navattic.com',
    color: '#5046E5',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'olark',
    name: 'Olark',
    shortName: 'Olark',
    patterns: [
      'static.olark.com',
      'api.olark.com'
    ],
    category: 'widgets',
    description: 'Simple live chat with real-time visitor monitoring, canned responses, and CRM integrations.',
    url: 'https://www.olark.com',
    color: '#3d3683',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'optimonk',
    name: 'OptiMonk',
    shortName: 'OptiMonk',
    // CATEGORY JUSTIFICATION: widgets over ab-testing. OptiMonk markets 'popups, website
    // personalization and A/B testing in one toolset', but the product identity and the on-page
    // artifact are an overlay widget; the A/B testing is scoped to popup variants.
    // Colour from a CLAIMED Brandfetch profile.
    patterns: [
      'onsite.optimonk.com',
      'front.optimonk.com',
      'cdn-content.optimonk.com'
    ],
    category: 'widgets',
    description: 'On-site popup and personalisation platform serving overlays, embedded content and message experiments.',
    url: 'https://www.optimonk.com/',
    color: '#ed5a29',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'optinmonster',
    name: 'OptinMonster',
    shortName: 'OptinMonster',
    patterns: [
      '.omappapi.com',
      'optnmnstr.com',
      'optmnstr.com',
      'omsrec.com',
      'optinmonster.com'
    ],
    category: 'widgets',
    description: 'Lead capture with exit-intent popups, slide-ins, and floating bars for list building.',
    url: 'https://optinmonster.com',
    color: '#0d82df',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'pickzen',
    name: 'PickZen',
    shortName: 'PickZen',
    // Apex deliberately excluded - www. is marketing, help. is public docs, and the merchant
    // dashboard sits under the apex. The -us suffix implies regional CDN siblings (cdn-eu. etc.)
    // that are NOT verified; add only when observed.
    // Colour is the Brandfetch `dark` token: its `accent` is literal grey (#888888), which would
    // render as an unbranded badge.
    patterns: [
      'events.pickzen.com',
      'cdn-us.pickzen.com'
    ],
    category: 'widgets',
    description: 'E-commerce product-finder quiz widget that guides shoppers to a recommendation and reports per-question engagement.',
    url: 'https://www.pickzen.com/',
    color: '#634212',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'privy',
    name: 'Privy',
    shortName: 'Privy',
    patterns: [
      'privy.com',
      'widget.privy.com',
      'dashboard.privy.com'
    ],
    category: 'widgets',
    description: 'E-commerce popup and email capture platform with Shopify integration.',
    url: 'https://www.privy.com',
    color: '#e3e32b',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'purple-dot',
    name: 'Purple Dot',
    shortName: 'Purple Dot',
    patterns: [
      'www.purpledotprice.com/'
    ],
    category: 'widgets',
    description: 'Shopify pre-order and waitlist platform that vaults customer cards and auto-charges on ship; loads a per-merchant checkout widget and forwards pre-order events to merchant analytics.',
    url: 'https://www.getpurpledot.com',
    color: '#7c3aed',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-19'
  },
  {
    id: 'puzzel',
    name: 'Puzzel',
    shortName: 'Puzzel',
    // Added 2026-07-22: EUWA = End User Web Application, Puzzel's CURRENT-generation chat widget
    // (loader at euwa.puzzel.com/loader/index.js). Every other pattern here is an app-* host from
    // the LEGACY generation, so sites on the new widget were invisible to the registry.
    // This is a host-completeness fix, not a claim that euwa is tracking - it is chat transport,
    // same class as the app-cdn/app-commsrv hosts already listed.
    // api.puzzel.com was DELIBERATELY NOT added: its browser-facing chat endpoints could not be
    // tied to that host (they may live on the already-registered app-commsrv), the Dialler API on
    // it is server-to-server only, and as a substring it would also match messaging-api.puzzel.com.
    // Note the app- hyphen is load-bearing: app.puzzel.com/admin is the agent console.
    patterns: [
      'app-cdn.puzzel.com',
      'app-statistics.puzzel.com',
      'app-state.puzzel.com',
      'app-commsrv.puzzel.com',
      'app-consumeridp.puzzel.com',
      'euwa.puzzel.com'
    ],
    category: 'widgets',
    description: 'Norwegian/UK contact-center-as-a-service platform (chat, voice, customer-service routing) deployed as an on-page chat widget on enterprise customer sites.',
    url: 'https://www.puzzel.com',
    color: '#6E29A3',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-26',
    updatedDate: '2026-07-22'
  },
  {
    id: 'qualaroo',
    name: 'Qualaroo',
    shortName: 'Qualaroo',
    patterns: [
      'ki.qualaroo.com',
      'cl.qualaroo.com',
      'qualaroo.com/ki'
    ],
    category: 'widgets',
    description: 'AI-powered survey and user feedback tool for website and in-app feedback collection.',
    url: 'https://qualaroo.com',
    color: '#1870D5',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'qualified',
    name: 'Qualified',
    shortName: 'Qualified',
    patterns: [
      'js.qualified.com',
      'api.qualified.com',
      'xdot.qualified.com'
    ],
    category: 'widgets',
    description: 'Routes VIP accounts to sales reps instantly using Salesforce data to personalize chat greetings.',
    url: 'https://www.qualified.com',
    color: '#67b8c7',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'reamaze',
    name: 'Reamaze',
    shortName: 'Reamaze',
    patterns: [
      'cdn.reamaze.io',
      /.*\.reamaze\.io/,
      /.*\.reamaze\.com/
    ],
    category: 'widgets',
    description: 'Unified inbox for chat, email, social, and SMS with Shopify order sidebar and FAQ chatbot.',
    url: 'https://www.reamaze.com',
    color: '#64cbe5',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'rebuy',
    name: 'Rebuy',
    shortName: 'Rebuy',
    // Do NOT add a bare 'rebuyengine.com' apex: it serves the B2B marketing site and the
    // merchant dashboard login at /admin/login. The path-scoped 'rebuyengine.com/api/v1/'
    // (the documented storefront REST base) was investigated 2026-08-03 but deliberately NOT
    // shipped -- it could not be verified whether the merchant admin SPA issues its own
    // /api/v1/ XHRs, which would flag a logged-in merchant's own dashboard as tracking.
    patterns: [
      'cdn.rebuyengine.com',
      'cached.rebuyengine.com',
      'api.rebuyengine.com',
      'recs.rebuyengine.com',
      'events.rebuyengine.com',
      'shopify.rebuyengine.com'
    ],
    category: 'widgets',
    description: 'Shopify-native AI personalization and upsell engine — product recommendations, smart cart, post-purchase offers, and conversion attribution.',
    url: 'https://rebuyengine.com',
    color: '#1a1a1a',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-11',
    updatedDate: '2026-08-04'
  },
  {
    id: 'scout-copilot',
    name: 'Scout Copilot',
    shortName: 'Scout',
    patterns: ['copilot.scoutos.com'],  // Bare hostname; widget JS at /copilot.js — apex scoutos.com is vendor marketing + docs
    category: 'widgets',
    description: 'Embeddable AI chat / Copilot widget by ScoutOS — multi-tenant SaaS that loads as a floating action button or inline element via copilot.scoutos.com/copilot.js with a per-customer copilot_id.',
    url: 'https://www.scoutos.com/',
    color: '#1E40AF',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-17'
  },
  {
    id: 'sequel-io',
    name: 'Sequel.io',
    shortName: 'Sequel',
    patterns: ['data.sequel.io'],
    category: 'widgets',
    description: 'Embedded webinar and virtual-event platform — drops live and on-demand webinar widgets directly into customer websites.',
    url: 'https://sequel.io',
    color: '#0F172A',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-15'
  },
  {
    id: 'sharethis',
    name: 'ShareThis',
    shortName: 'ShareThis',
    patterns: [
      'sharethis.com',
      'platform-cdn.sharethis.com',
      'buttons-config.sharethis.com',
      't.sharethis.com',
      'l.sharethis.com'
    ],
    category: 'widgets',
    description: 'Social sharing buttons with built-in audience tracking and data collection.',
    url: 'https://sharethis.com',
    color: '#5BAC4D',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'shop-app',
    name: 'Shop Pay (Shopify)',
    shortName: 'Shop Pay',
    patterns: [
      'shop.app/checkouts/',
      'shop.app/pay/'
    ],
    category: 'widgets',
    description: "Shopify's consumer-facing Shop App and Shop Pay accelerated checkout — embedded button + iframe on merchant storefronts that preloads checkout sessions and routes payments.",
    url: 'https://shop.app',
    color: '#5A31F4',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-28'
  },
  {
    id: 'smartsupp',
    name: 'Smartsupp',
    shortName: 'Smartsupp',
    // Do NOT wildcard .smartsupp.com - that apex carries marketing, help., docs. and the app.
    // agent dashboard. Only smartsuppchat.com is tracking-only and safe to wildcard. Other
    // plugin-<platform>.smartsupp.com hosts likely exist (shopware, prestashop, shopify) but
    // were NOT verified - the observed shoptet one is registered explicitly.
    patterns: [
      '.smartsuppchat.com',
      'websocket-visitors.smartsupp.com',
      'plugin-shoptet.smartsupp.com'
    ],
    category: 'widgets',
    description: 'Live chat and chatbot widget with visitor recording and conversion tracking for small e-commerce sites.',
    url: 'https://www.smartsupp.com/',
    color: '#4088e6',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'smile-io',
    name: 'Smile.io',
    shortName: 'Smile.io',
    patterns: [
      'js.smile.io',
      'smile.io'
    ],
    category: 'widgets',
    description: 'Leading loyalty and rewards program widget for Shopify and e-commerce stores.',
    url: 'https://smile.io',
    color: '#ffc629',
    colorVerified: true,
    iconVerified: true, // Official logo: smile.io website asset
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'social-intents',
    name: 'Social Intents',
    shortName: 'Social Intents',
    patterns: [
      'socialintents.com/api/chat/'
    ],
    category: 'widgets',
    description: 'Live chat widget connecting website visitors to agents via Slack, Microsoft Teams, Webex, Zoom, or Google Chat.',
    url: 'https://www.socialintents.com',
    color: '#1E88E5',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'sprinklr-live-chat',
    name: 'Sprinklr Live Chat',
    shortName: 'Sprinklr Chat',
    // Apex .sprinklr.com wildcard FORBIDDEN - the apex hosts marketing AND the customer admin
    // console (prod2/prod4/qa4/space/lite .sprinklr.com/ui/login) plus dev.sprinklr.com. The
    // shard-prefix space is open-ended and undocumented, so the SUFFIX anchor is load-bearing:
    // prod2- is shared with non-chat hosts, making prefix-based patterns unsafe.
    // Host-anchored on '//' - the investigation supplied /^...$/, which can never fire.
    // Excluded as shared/non-chat infra: sprcdn, sprcdn-assets, thumb, gallery, dap, space,
    // prod2-jumbo-azrlb. pixel-prod2.sprinklr.com is a SEPARATE Sprinklr pixel host and may
    // warrant its own investigation - it is not part of Live Chat.
    patterns: [
      /\/\/(live-chat-static|[a-z0-9-]+-live-chat(-mqtt)?|[a-z0-9-]+-lc-mqtt(-[a-z0-9]+)?)\.sprinklr\.com/
    ],
    category: 'widgets',
    description: 'Enterprise live-chat widget from the Sprinklr customer-service suite, served from per-customer regional shards.',
    url: 'https://www.sprinklr.com/products/customer-service/livechat/',
    color: '#107EFF',
    colorVerified: false,
    iconVerified: true,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'stylitics',
    name: 'Stylitics',
    shortName: 'Stylitics',
    patterns: [
      'web-assets.stylitics.com',
      'stylitics.com',
      'widget-api.stylitics.com'
    ],
    category: 'widgets',
    description: 'Visual merchandising and outfit recommendation widget for fashion and home retailers. Powers "complete the look" experiences.',
    url: 'https://stylitics.com',
    color: '#000000',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-26'
  },
  {
    id: 'tally',
    name: 'Tally',
    shortName: 'Tally',
    patterns: [
      'tally.so'
    ],
    category: 'widgets',
    description: 'Form and survey builder (Typeform alternative) — embedded via tally.so/widgets/embed.js with iframe forms hosted on tally.so.',
    url: 'https://tally.so',
    color: '#000000',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },
  {
    id: 'tawk',
    name: 'Tawk.to',
    shortName: 'Tawk.to',
    patterns: [
      'embed.tawk.to',
      'va.tawk.to',
      'vs.tawk.to',
      'tawk.link'
    ],
    category: 'widgets',
    description: 'Free live chat widget with unlimited agents and chat history.',
    url: 'https://www.tawk.to',
    color: '#23a455',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'tidio',
    name: 'Tidio',
    shortName: 'Tidio',
    patterns: [
      'code.tidio.co',
      'widget-v4.tidiochat.com',
      'socket.tidio.co',
      'tracking.tidio.co'
    ],
    category: 'widgets',
    description: 'Live chat and AI chatbot platform for e-commerce customer support.',
    url: 'https://www.tidio.com',
    color: '#001433',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'tolstoy',
    name: 'Tolstoy',
    shortName: 'Tolstoy',
    // Host completeness (2026-08-04): the storefront widget bundle hard-codes
    // analytics-v2.gotolstoy.com/{event,site-activity} as the behavioural collector -- every
    // viewer event was falling through to tools_unknown while only api.gotolstoy.com (identity
    // only, in the current bundle) was registered. cf-apilb is the DEFAULT widget-config API;
    // apilb is the non-cached fallback. Never wildcard .gotolstoy.com: platform./app. are
    // merchant dashboards, www./help. are marketing and Intercom docs, videos./assets. are
    // pure media CDN.
    patterns: [
      'api.gotolstoy.com',
      'analytics-v2.gotolstoy.com',
      'cf-apilb.gotolstoy.com',
      'apilb.gotolstoy.com',
      'widget.gotolstoy.com',
      'play.gotolstoy.com',
      'player.gotolstoy.com'
    ],
    category: 'widgets',
    description: 'Shoppable-video and UGC widget platform for ecommerce (Shopify-native); captures viewer events (pageView, sessionStart, clickCta, video views) via analytics-v2.gotolstoy.com.',
    url: 'https://www.gotolstoy.com',
    color: '#000000',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-19',
    updatedDate: '2026-08-04'
  },
  {
    id: 'true-fit',
    name: 'True Fit',
    shortName: 'True Fit',
    // Tracking runs on truefitcorp.com; truefit.com is corporate/marketing/admin only. The
    // OBSERVED host setup.truefit.com is the retailer self-serve signup portal and is
    // intentionally NOT registered - this add will not clear it from tools_unknown.
    // No apex wildcard on truefitcorp.com either: techdocs. is public developer documentation.
    // The per-retailer CDN shard is <storeKey>-cdn.truefitcorp.com, covered by the second
    // pattern. HOST ENUMERATION INCOMPLETE: a distinct recommendation/telemetry API host could
    // not be verified from public docs - extend if a capture surfaces one.
    // WhoTracks.Me classifies True Fit as Advertising; widgets chosen for consistency with the
    // Bold Metrics fit-widget precedent.
    patterns: [
      'cdn.truefitcorp.com',
      '-cdn.truefitcorp.com'
    ],
    category: 'widgets',
    description: 'Apparel and footwear fit-recommendation widget that personalises size guidance on product pages.',
    url: 'https://www.truefit.com/',
    color: '#d31145',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.1',
    addedDate: '2026-07-21'
  },
  {
    id: 'trustpilot',
    name: 'Trustpilot',
    shortName: 'Trustpilot',
    patterns: [
      'widget.trustpilot.com',
      'invitations-api.trustpilot.com',
      'invitejs.trustpilot.com'
    ],
    category: 'widgets',
    description: 'Customer review platform with embeddable widgets for displaying ratings and reviews.',
    url: 'https://www.trustpilot.com',
    color: '#00B67A',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'weply',
    name: 'Weply',
    shortName: 'Weply',
    // app.weply.chat is deliberately NOT a bare-host pattern -- the same host serves the
    // Weply customer/agent dashboard and login at its root, so a bare pattern would flag the
    // vendor's own admin UI. Scoped to the two verified browser-facing widget paths instead.
    // cdn.weply.chat is safe bare: it serves only the widget iframe document and its bundles.
    // Excluded: weply.chat / www. (Webflow marketing), platform./growth./get. (dashboard or
    // stale landing pages), files.crowdio.com (legacy S3 static chat-icon bucket).
    // Collector requests fire from INSIDE the cdn.weply.chat iframe, not the top frame, and
    // are per-tenant switchable, so absence on a given site does not mean the pattern is
    // wrong. 'Crowdio' is the legacy brand name and persists in the config key.
    patterns: [
      'analytics.weply.chat',
      'cdn.weply.chat',
      'app.weply.chat/widget/',
      'app.weply.chat/visitor/'
    ],
    category: 'widgets',
    description: 'Nordic live-chat and lead-generation widget staffed by human chat agents, whose embedded widget reports visitor session, page-URL and chat-funnel events to Weply\'s own analytics collector.',
    url: 'https://www.weply.chat/',
    color: '#1B44DD',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.2',
    addedDate: '2026-08-04'
  },
  {
    id: 'yotpo',
    name: 'Yotpo',
    shortName: 'Yotpo',
    patterns: [
      'staticw2.yotpo.com',
      'api.yotpo.com',
      'cdn-widgetsrepository.yotpo.com'
    ],
    category: 'widgets',
    description: 'E-commerce marketing platform for reviews, loyalty, referrals, and SMS.',
    url: 'https://www.yotpo.com',
    color: '#0042E4',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20',
    updatedDate: '2026-07-21'
  },
  {
    id: 'zendesk',
    name: 'Zendesk',
    shortName: 'Zendesk',
    patterns: [
      'static.zdassets.com',
      'ekr.zdassets.com',
      'v2.zopim.com',
      'widget-mediator.zopim.com',
      'api.smooch.io'
    ],
    category: 'widgets',
    description: 'Customer service platform with chat widget, messaging, and help center embeds.',
    url: 'https://www.zendesk.com',
    color: '#03363D',
    colorVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'zigpoll',
    name: 'Zigpoll',
    shortName: 'Zigpoll',
    // api. is the response/event collector, cdn. is the widget bundle (documented install is
    // //cdn.zigpoll.com/static/js/main.js, identical across all platform integration docs).
    // No apex wildcard -- zigpoll.com / www. is the vendor marketing site. app. (merchant
    // dashboard) excluded because it could not be verified as tracking-only.
    // survey.zigpoll.com is a first-party navigation destination, not an embedded resource.
    // track.zigpoll.com exists and the name is suggestive, but its function is unverified
    // (likely email open/click tracking) -- add via Extend only after a real browser sighting.
    // Widget is frequently exit-intent or post-purchase triggered, so a capture may need a
    // dwell or exit gesture to fire.
    patterns: [
      'api.zigpoll.com',
      'cdn.zigpoll.com'
    ],
    category: 'widgets',
    description: 'Embeddable customer survey and feedback widget for post-purchase, exit-intent, attribution and NPS micro-surveys, heavily distributed via the Shopify App Store.',
    url: 'https://www.zigpoll.com',
    color: '#3B82F6',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.4.2',
    addedDate: '2026-08-04'
  },
  {
    id: 'zoho-salesiq',
    name: 'Zoho SalesIQ',
    shortName: 'SalesIQ',
    patterns: [
      'salesiq.zohopublic.',
      'salesiq.zoho.com/widget'
    ],
    category: 'widgets',
    description: 'Live chat, chatbot, and website-visitor tracking widget from the Zoho suite — visitor footprints, proactive triggers, audio/video calls.',
    url: 'https://www.zoho.com/salesiq/',
    color: '#E42527',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-05-01'
  },

  // === FIRST-PARTY COLLECTION ===
  {
    id: '1st-party-proxy',
    name: '1st Party Proxy',
    shortName: '1st Party Proxy',
    patterns: [],  // Detection handled by detectCNAMETracking() for same-origin tracking endpoints
    category: 'first-party-collection',
    description: 'First-party server-side data collection. Data is sent to the site\'s own domain (via path, subdomain CNAME, A-record, or any DNS method) and forwarded server-side to non-Google destinations.',
    url: '',
    color: '#6366f1',  // Indigo - distinct from other tools
    colorVerified: false,
    iconVerified: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'framer-analytics',
    name: 'Framer Analytics',
    shortName: 'Framer',
    patterns: [
      'events.framer.com'
    ],
    category: 'first-party-collection',
    description: 'Built-in, cookie-free site analytics for sites published on Framer — captures pageviews and custom events fired via the useTracking() hook; powers Framer\'s Analytics tab, Funnels, and A/B testing.',
    url: 'https://www.framer.com',
    color: '#0099FF',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-05'
  },
  {
    id: 'squarespace-analytics',
    name: 'Squarespace Analytics',
    shortName: 'Squarespace',
    patterns: [
      'clanker-events.squarespace.com/api/v1/clanker/events'
    ],
    category: 'first-party-collection',
    description: 'Squarespace\'s first-party analytics and events collector for sites built on the Squarespace platform; powers the Squarespace Analytics dashboard (page views, traffic sources, sales, RSVPs).',
    url: 'https://www.squarespace.com/',
    color: '#000000',
    colorVerified: false,
    iconVerified: false,
    addedInVersion: '1.3.0',
    addedDate: '2026-05-05'
  },
  {
    id: 'sgtm',
    name: 'sGTM',
    shortName: 'sGTM',
    patterns: [],  // Detection handled by detectCNAMETracking() - first-party endpoint with GA4 params
    category: 'first-party-collection',
    description: 'Server-side Google Tag Manager (or a managed sGTM service like Stape / Addingwell / TAGGRS / Cloudflare Zaraz). Detected when GA4 measurement-protocol markers (tid=G-*, /g/collect path) are sent to a first-party endpoint, indicating server-side forwarding to Google. The signal is "GA4 protocol on a first-party domain" — the actual server identity is inferred (most commonly sGTM); the supplier dimension (Stape, etc.) is annotated separately when detectable.',
    url: 'https://developers.google.com/tag-platform/tag-manager/server-side',
    color: '#EA4335',
    colorVerified: true,
    iconVerified: false,
    consumesGCM: true,
    addedInVersion: '1.0.0',
    addedDate: '2026-02-20'
  },
  {
    id: 'stape-data-tag',
    name: 'Stape Data Tag',
    shortName: 'Stape Data Tag',
    patterns: [],  // Fingerprint-only detection — see structural-fingerprints.js (matches body._dcid_temp shape)
    category: 'first-party-collection',
    description: 'Stape Data Tag — a GTM client-side tag template that posts events to a server-side container in Stape\'s own JSON shape (not GA4 Measurement Protocol). Identified purely by request body structure since the operator chooses the host and path.',
    url: 'https://stape.io/solutions/data-tag-client',
    color: '#FF6D34',
    colorVerified: true,
    iconVerified: false,
    addedInVersion: '1.2.0',
    addedDate: '2026-04-30'
  }
];

// Platform count derived from the registry — use this instead of hardcoding numbers
// Excludes data-layer entries (not standalone tools), generic first-party proxies
// (unknown platform), and auxiliary gtag.js infrastructure that isn't a tool of its own.
// sGTM is kept since it's a known platform.
const EXCLUDED_CATEGORIES = new Set(['data-layer']);
const EXCLUDED_IDS = new Set(['1st-party-proxy', 'gtag-destination']);
export const PLATFORM_COUNT = KNOWN_TRACKING_ENDPOINTS.filter(p => !EXCLUDED_CATEGORIES.has(p.category) && !EXCLUDED_IDS.has(p.id)).length;

