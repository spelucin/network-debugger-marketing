// Shared Parsing Utilities - Index
// Re-exports all parsing functions from individual modules

// GA4 (Google Analytics 4)
export {
  parseGA4Events,
  extractGA4EventParams,
  extractGA4UserProperties,
  parseGA4EcommerceItems,
  buildGA4GroupedParams,
  parseGA4RequestData,
  parseServerSideGA4RequestData
} from './ga4.js';

// Consent Mode (Google — shared across GA4, GTM, and future platforms)
export {
  parseGCDConsent,
  parseGCSConsent,
  buildConsentSignals,
  buildConsentSection,
  getRequiredConsentCategory,
  normalizeGCMToCategories,
  getGCSConsentState,
  resolveGcmForDisplay,
  parseOneTrustPushData,
  parseCookieInfoPushData,
  parseUsercentricsData,
  parseDidomiPushData,
  lookupTimeline,
  computeConsentCheck,
  assessConsentSeverity,
  isAdvancedConsentMode,
  getCMPCategoryName,
  GCM_SIGNAL_NAMES,
  CMP_DETECTION_COVERAGE
} from './consent.js';

// Consent Cookie Parsers (CMP cookie reading + parsing)
export {
  readConsentCookies,
  getConsentCookieNames
} from './consent-cookies.js';

// Adobe Analytics (Omniture)
export {
  extractAdobeAnalyticsData,
  parseAdobeAnalyticsRequestData,
  parseAdobeProducts
} from './adobe-analytics.js';

// Adobe Target
export {
  parseAdobeTargetRequestData
} from './adobe-target.js';

// Adobe Audience Manager (AAM / Demdex)
export {
  parseAdobeAAMRequestData
} from './adobe-audience-manager.js';

// Adobe Experience Platform (Web SDK / Alloy)
export {
  parseAdobeAEPRequestData
} from './adobe-experience-platform.js';

// Amplitude
export {
  parseAmplitudeRequestData
} from './amplitude.js';

// Braze
export {
  parseBrazeRequestData,
  buildBrazeGroupedParams
} from './braze.js';

// Segment Spec (shared: Segment, RudderStack, Hightouch)
export {
  parseSegmentSpecRequestData
} from './segment-spec.js';

// CDP destinations config — Segment settings + RudderStack sourceConfig
// + mParticle kits (Hightouch pending — same Segment-spec config endpoint
// family). Parses the per-source destinations payload so the panel can
// show "Destinations configured" / "Kits configured" in the event detail
// and Stack View can use it as an authoritative loader signal (Strategy A).
export {
  parseSegmentSettings,
  parseRudderStackSourceConfig,
  parseMparticleConfig,
  matchSegmentDestination,
  matchRudderStackDestination,
  matchMparticleKit,
  isSegmentSettingsUrl,
  isRudderStackSourceConfigUrl,
  isHightouchSourceConfigUrl,
  isMparticleConfigUrl,
  extractSegmentWriteKey,
  extractMparticleApiKey
} from './cdp-destinations.js';

// TMS loader-config — Adobe Launch + Adobe Experience Platform Web SDK
// (alloy.js). Parses the published library response body (Launch) or
// the Edge Network interact response (Web SDK) to surface installed
// extensions / dispatched audience destinations.
export {
  parseAdobeLaunchContainer,
  parseAepInteractResponse,
  matchAdobeLaunchExtension,
  isAdobeLaunchLibraryUrl,
  isAepInteractUrl
} from './tms-config.js';

// mParticle
export {
  parseMparticleRequestData
} from './mparticle.js';

// Facebook Pixel
export {
  parseFacebookPixelData
} from './facebook.js';

// Google Ads (Conversion & Remarketing)
export {
  parseGoogleAdsConversionData,
  parseGoogleAdsRemarketingData
} from './google-ads.js';

// Google Consent Mode (CCM)
export {
  parseGoogleCCMData
} from './google-ccm.js';

// GTM (Google Tag Manager) & GTAG
export {
  parseGTMScriptLoadData,
  parseGTAGScriptLoadData,
  parseGTMLogParameter,
  parseGTMAnalyticsRequestData,
  parseGTMContainerResponse,
  parseGTMHealthPingData,
  isGTMHealthPing
} from './gtm.js';

// LinkedIn Insight Tag
export {
  parseLinkedInPixelData
} from './linkedin.js';

// Mixpanel
export {
  parseMixpanelRequestData
} from './mixpanel.js';

// PostHog
export {
  parsePostHogRequestData
} from './posthog.js';

// Tealium (utag_data, utag.view, utag.link — JS interception)
export {
  formatTealiumEventData
} from './tealium.js';

// Tealium Collect (HTTP requests to collect.tealiumiq.com)
export {
  parseTealiumCollectData,
  lookupTealiumTID
} from './tealium.js';

// TikTok Pixel
export {
  parseTikTokPixelData
} from './tiktok.js';

// Snapchat Pixel
export {
  parseSnapchatPixelData
} from './snapchat.js';

// Salesforce Marketing Cloud (igodigital/Collect)
export {
  parseSalesforceMarketingData
} from './salesforce-marketing.js';

// Matomo / Piwik
export {
  parseMatomoRequestData
} from './matomo.js';

// Piwik PRO
export {
  parsePiwikProRequestData
} from './piwik-pro.js';

// Bing / Microsoft UET
export {
  parseBingAdsData
} from './bing-ads.js';

// Twitter/X Pixel
export {
  parseTwitterPixelData
} from './twitter.js';

// Pinterest Tag
export {
  parsePinterestTagData
} from './pinterest.js';

// HubSpot
export {
  parseHubSpotData
} from './hubspot.js';

// Criteo OneTag
export {
  parseCriteoData
} from './criteo.js';

// Snowplow
export {
  parseSnowplowData
} from './snowplow.js';

// Optimizely
export {
  parseOptimizelyData
} from './optimizely.js';

// Heap Analytics
export {
  parseHeapData
} from './heap.js';

// Pendo
export {
  parsePendoData
} from './pendo.js';

// Piano Analytics (formerly AT Internet)
export {
  parsePianoAnalyticsData
} from './piano-analytics.js';

// Grafana Faro (frontend observability — OpenTelemetry-based RUM)
export {
  parseGrafanaFaroRequestData,
  buildGrafanaFaroEventName
} from './grafana-faro.js';

// Generic utilities
// Note: tryDecodeBase64 is internal-only (used by decodeBase64InObject), not exported
export {
  isJavaScriptFileUrl,
  decodeBase64InObject,
  resolvePath,
  parseConfiguredRequestData
} from './generic.js';
