// Request handler functions extracted from panel.js
// Each platform-specific parser receives a network request and calls addEvent()
// to emit parsed events. Dependencies are injected via initRequestHandlers().

import {
  // GA4
  parseGA4RequestData,
  parseServerSideGA4RequestData,
  // Consent Mode (shared)
  buildConsentSection,
  buildConsentSignals,
  // Adobe Analytics
  parseAdobeAnalyticsRequestData,
  // Adobe Target
  parseAdobeTargetRequestData,
  // Adobe Audience Manager
  parseAdobeAAMRequestData,
  // Adobe Experience Platform (Web SDK / Alloy)
  parseAdobeAEPRequestData,
  // Google CCM (handles routing + GA4 extraction internally)
  parseGoogleCCMData,
  // GTM
  parseGTMScriptLoadData,
  parseGTAGScriptLoadData,
  parseGTMAnalyticsRequestData,
  parseGTMContainerResponse,
  parseGTMHealthPingData,
  isGTMHealthPing,
  // Platform-specific parsers
  parseTikTokPixelData,
  parseLinkedInPixelData,
  parseSnapchatPixelData,
  parseSalesforceMarketingData,
  parsePostHogRequestData,
  parseMixpanelRequestData,
  parseFacebookPixelData,
  parseAmplitudeRequestData,
  parseBrazeRequestData,
  buildBrazeGroupedParams,
  parseSegmentSpecRequestData,
  parseSegmentSettings,
  parseRudderStackSourceConfig,
  parseMparticleConfig,
  parseAdobeLaunchContainer,
  isSegmentSettingsUrl,
  isRudderStackSourceConfigUrl,
  isHightouchSourceConfigUrl,
  isMparticleConfigUrl,
  isAdobeLaunchLibraryUrl,
  parseAepInteractResponse,
  isAepInteractUrl,
  extractSegmentWriteKey,
  extractMparticleApiKey,
  parseMparticleRequestData,
  parseTealiumCollectData,
  lookupTealiumTID,
  parseGoogleAdsConversionData,
  parseGoogleAdsRemarketingData,
  // Matomo
  parseMatomoRequestData,
  // Piwik PRO
  parsePiwikProRequestData,
  // Bing / Microsoft UET
  parseBingAdsData,
  // Twitter/X Pixel
  parseTwitterPixelData,
  // Pinterest Tag
  parsePinterestTagData,
  // HubSpot
  parseHubSpotData,
  // Criteo OneTag
  parseCriteoData,
  // Snowplow
  parseSnowplowData,
  // Optimizely
  parseOptimizelyData,
  // Heap Analytics
  parseHeapData,
  // Pendo
  parsePendoData,
  // Piano Analytics
  parsePianoAnalyticsData,
  // Grafana Faro
  parseGrafanaFaroRequestData,
  buildGrafanaFaroEventName,
  // Generic utilities (used by routing helpers)
  isJavaScriptFileUrl,
  decodeBase64InObject,
  parseConfiguredRequestData
} from '../shared/detection/parsers/index.js';

import { AMPLITUDE_API_KEYS, AMPLITUDE_API_HOSTNAMES } from './analytics.js';

// Import detection/matching utilities for request routing (Phase 9)
import {
  matchKnownEndpoint,
  isGenericTrackingRequest,
  extractUnknownTrackingInfo,
  detectCNAMETracking,
  isSameRootDomain
} from './tracking-endpoints.js';

// Feature #79 — single source of truth for tracking topology / prefix shape.
// Replaces the inline `knownTrackingPrefixes`, `ssgtmPrefixes`, `isCustomDomainGTMLoad`,
// and `isCustomDomainGTAGLoad` checks that previously lived in this file.
import {
  classifyTopology,
  hasTrackingSubdomainPrefix,
} from '../shared/detection/topology.js';

// Feature #80 — supplier registry. Replaces inline Stape stamp regexes and
// hardcoded TLD checks with registry-driven detection that also covers
// Addingwell + TAGGRS from day one.
import {
  matchSupplierHost,
  matchSupplierStamp,
  buildSupplierAnnotation,
} from '../shared/supplier-registry.js';

import {
  getScriptInitiatorType,
  getInitiatorUrl
} from './components/script-initiator-icons.js';

import { matchScriptLoad } from '../shared/detection/script-patterns.js';
import { extractGtmContainerId } from '../shared/detection/tag-manager-patterns.js';
import { identifyUnknownRequest } from '../shared/detection/identify-unknown.js';
import { isAlloyEdgePayload } from '../shared/detection/structural-fingerprints.js';
import { MPARTICLE_CNAME_EVENTS_PATH_RE } from '../shared/detection/cname-detection.js';

// Dependencies injected by panel.js via initRequestHandlers().
// _deps.addEvent is the single funnel every parser feeds - the event object
// contract it accepts is documented in shared/event-shape.js (#135 WP2):
// parsers construct { platform, platformName?, eventName?, raw, formatted }
// and addEvent() assigns id/timestamps and correlation enrichment.
let _deps;

// One-entry URL-parse memo (#131 F6 prefix). routeRequest()'s helper chain
// parses the same request URL up to ~12 times per request; the memo collapses
// those to one real parse per distinct URL string without threading a parsed
// object through every helper signature (dispatch order untouched — the full
// Map-based dispatch refactor stays with #25 Phase B). Callers must NOT
// mutate the returned URL object — it is shared. Throws exactly like
// `new URL()`, so existing try/catch contracts are unchanged (the memo key
// is only committed after a successful parse, so a throwing URL never
// poisons the cache).
let _urlMemoKey = null;
let _urlMemoValue = null;
function parseUrlMemo(url) {
  if (url !== _urlMemoKey) {
    _urlMemoValue = new URL(url);
    _urlMemoKey = url;
  }
  return _urlMemoValue;
}

/**
 * Initialize request handlers with dependencies from panel.js.
 * Must be called after state is defined but before any requests arrive.
 * @param {Object} deps
 * @param {Function} deps.addEvent - Emit a parsed event into the stream
 * @param {Map} deps.scriptInitiatorMap - Script URL → initiator info (written by script load parsers)
 * @param {Map} deps.scriptChildrenMap - Script URL → child script URLs (written by script load parsers)
 * @param {Map} deps.scriptUrlToEventId - Script URL → event ID (written by script load parsers)
 * @param {Map} deps.tealiumTagConfig - Tag UID → vendor info (written by Tealium Collect parser)
 * @param {Function} deps.scheduleRender - Trigger a re-render (used by Tealium Collect after resolving vendor mappings)
 * @param {Function} deps.getCurrentPageHostname - Returns current page hostname for CNAME/SS-GTM detection
 * @param {Object} deps.PLATFORM_NAMES - Platform ID → display name mapping
 * @param {Function} [deps.addUnknownHostname] - Optional: receive hostnames (and pathname) of requests that stayed `platform === 'other'` after URL match, CNAME, and fingerprint checks all failed. Used by the tools_unknown crowdsourcing flow (feature #47). The pathname is passed so the receiver can apply the multi-purpose-host first-path hint (feature #69) on allow-listed hosts; on every other host the pathname is ignored.
 */
export function initRequestHandlers(deps) {
  _deps = deps;
}

// Build formatted.sections array for a GA4 event
// Section order: Consent Mode → Custom Data → E-Commerce Items
export function buildGA4Sections(eventData) {
  const sections = [];

  // Consent Mode — Active State (gcs) + Default Config (gcd) + Non-Personalized Ads (npa)
  // Collapsed by default — chips in overview provide the quick summary
  const consentSection = buildConsentSection(eventData.params || {});
  if (consentSection) {
    sections.push({ title: 'Consent Mode', data: consentSection, type: 'table', expanded: false });
  }

  // Custom Data — Event Parameters (ep.*/epn.*) and User Properties (up.*/upn.*),
  // combined into one grouped section with prefixes stripped from keys
  const eventParams = eventData.eventParams || {};
  const userProps = eventData.userProperties || {};
  const customData = {};

  if (Object.keys(eventParams).length > 0) {
    const stripped = {};
    for (const [key, value] of Object.entries(eventParams)) {
      const cleanKey = key.startsWith('epn.') ? key.slice(4) :
                       key.startsWith('ep.') ? key.slice(3) : key;
      stripped[cleanKey] = value;
    }
    customData['Event Parameters'] = stripped;
  }

  if (Object.keys(userProps).length > 0) {
    const stripped = {};
    for (const [key, value] of Object.entries(userProps)) {
      const cleanKey = key.startsWith('upn.') ? key.slice(4) :
                       key.startsWith('up.') ? key.slice(3) : key;
      stripped[cleanKey] = value;
    }
    customData['User Properties'] = stripped;
  }

  if (Object.keys(customData).length > 0) {
    sections.push({ title: 'Custom Data', data: customData, type: 'table' });
  }

  // E-Commerce Items (pr1, pr2, ...) — product/item data
  const items = eventData.ecommerceItems || [];
  if (items.length > 0) {
    const itemsData = {};
    items.forEach((item, i) => {
      itemsData[`Item ${i + 1}`] = item;
    });
    sections.push({ title: `E-Commerce Items (${items.length})`, data: itemsData, type: 'table', sortRows: false });
  }

  return sections;
}

// =============================================================================
// PROPERTY TABLE LAYOUT — platforms using formatted.sections + type:'table'
// These platforms show custom/event data as a clean key/value table instead of
// a JSON tree. To add a platform: build sections array with type:'table' entries
// and omit formatted.params (or leave empty so Parsed Data section is skipped).
//
// DONE:
//   ga4, sgtm       — Consent Mode + Custom Data (event+user props) + E-Commerce Items
//   google-ccm      — Consent Mode (all routes)
//   google-ads-*    — Consent Mode
//   amplitude       — Custom Data (Event Properties + User Properties)
//   mixpanel        — Event Properties
//   posthog         — Event Properties (custom) + Parsed Data (page/browser/session/library/identity/autocapture/campaign)
//   facebook        — Custom Data (cd param, when parsed as object)
//   mparticle       — Consent State + Custom Data (attrs+user attrs) + Parsed Data (event/identity/device/context)
//   segment         — Properties + Traits + Context
//   rudderstack     — Properties + Traits + Context (Segment-compatible)
//   hightouch       — Properties + Traits + Context (Segment-compatible)
//   adobe-analytics — Custom Data (eVars+Props+Events+Hierarchies) + Products + Parsed Data (context/link/identifiers)
//   adobe-target    — Execute/Prefetch/Notifications (JSON) + Parsed Data (context/ec/identifiers/request)
//   adobe-aam       — Custom Data (trait key-values) + Parsed Data (identifiers/request/timing)
//   adobe-aep       — Custom Data (event data + analytics overrides) + E-Commerce Items + Parsed Data (page/commerce/identity/personalization/config)
// =============================================================================

// Parse GA4 request
// GA4 can send data in two ways:
// 1. URL query string params (single event or first event of batch)
// 2. POST body with URL-encoded events (batched events, one per line)
// Uses shared parseGA4RequestData for extraction
export function parseGA4Request(request) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;

  // Use shared parser for GA4 event extraction
  const parsed = parseGA4RequestData(url, postData);

  // Add each event separately
  const meta = getRequestMeta(request);
  parsed.events.forEach(eventData => {
    // Build overview with human-readable labels
    const overview = {};
    if (eventData.measurementId) overview['Measurement ID'] = eventData.measurementId;
    if (eventData.clientId) overview['Client ID'] = eventData.clientId;

    // Build sections: Consent Mode, Custom Data, E-Commerce Items
    const sections = buildGA4Sections(eventData);

    _deps.addEvent({
      platform: 'ga4',
      platformName: 'GA4',
      eventName: eventData.eventName,
      raw: {
        ...meta,
        params: eventData.params,
        postData: parsed.postData
      },
      formatted: {
        overview,
        sections,
        params: eventData.groupedParams || {},
        parsedDisplayMode: 'table',
        consentSignals: buildConsentSignals(eventData.params || {}),
        detectedBy: parsed.detectedBy
      }
    });
  });
}

// Parse Server-Side GA4 request (via CNAME/first-party domain)
// Uses shared parseServerSideGA4RequestData for extraction
export function parseServerSideGA4Request(request, cnameInfo) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;

  // Use shared parser for SS-GA4 event extraction
  const parsed = parseServerSideGA4RequestData(url, postData, cnameInfo);

  // Feature #65 / #80 — supplier annotation. Priority: direct host match
  // (Stape, TAGGRS) → cross-event Stape inference fallback.
  let resolvedSupplierId = matchSupplierHost(parsed.hostname);
  if (!resolvedSupplierId && _deps.isStapeHost && _deps.isStapeHost(parsed.hostname)) {
    resolvedSupplierId = 'stape';
  }
  const proxyHost = resolvedSupplierId === 'stape' ? 'stape' : undefined;
  const supplier = resolvedSupplierId ? buildSupplierAnnotation(resolvedSupplierId, 'sgtm') : null;

  // Add each event separately
  const meta = getRequestMeta(request);
  parsed.events.forEach(eventData => {
    // Build overview with human-readable labels
    const overview = {};
    if (eventData.measurementId) overview['Measurement ID'] = eventData.measurementId;
    if (eventData.clientId) overview['Client ID'] = eventData.clientId;
    overview['Server Host'] = parsed.hostname;

    // Build sections: Consent Mode, Custom Data, E-Commerce Items
    const sections = buildGA4Sections(eventData);

    _deps.addEvent({
      platform: 'sgtm',
      platformName: 'sGTM',
      eventName: eventData.eventName,
      raw: {
        ...meta,
        params: eventData.params,
        postData: parsed.postData
      },
      formatted: {
        overview,
        sections,
        params: eventData.groupedParams || {},
        parsedDisplayMode: 'table',
        consentSignals: buildConsentSignals(eventData.params || {}),
        detectedBy: parsed.detectedBy,
        ...(proxyHost && { proxyHost }),
        ...(supplier && { supplier }),
      }
    });
  });
}

// Parse Google Consent Mode (CCM) request - uses shared parser for routing logic
export function parseGoogleCCMRequest(request) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;

  // Use shared parser for CCM routing logic
  const parsed = parseGoogleCCMData(url, postData);

  // Consent params: rawParams has the full URL params (GA4 route extracts event params separately)
  const consentParams = parsed.rawParams || parsed.params || {};

  // Build formatted object based on route type
  const formatted = {
    overview: parsed.overview,
    params: parsed.params,
    detectedBy: parsed.detectedBy,
    consentSignals: buildConsentSignals(consentParams)
  };

  // Build sections — consent first (collapsed), then event/user data for GA4 routes
  const sections = [];

  const consentSection = buildConsentSection(consentParams);
  if (consentSection) {
    sections.push({ title: 'Consent Mode', data: consentSection, type: 'table', expanded: false });
  }

  if (parsed.routeTo === 'ga4' && parsed.userProperties) {
    if (Object.keys(parsed.params).length > 0) {
      sections.push({ title: 'Event Parameters', data: parsed.params });
    }
    if (Object.keys(parsed.userProperties).length > 0) {
      sections.push({ title: 'User Properties', data: parsed.userProperties });
    }
  }

  if (sections.length > 0) {
    formatted.sections = sections;
  }

  _deps.addEvent({
    platform: parsed.routeTo,
    platformName: parsed.platformName,
    eventName: parsed.eventName,
    raw: {
      ...getRequestMeta(request),
      params: parsed.rawParams || parsed.params,
      postData: parsed.postData
    },
    formatted
  });
}

// Parse Adobe Analytics (Omniture) request - uses shared parser
export function parseAdobeAnalyticsRequest(request) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;

  // Use shared parser for Adobe Analytics extraction (pass POST body for POST requests)
  const parsed = parseAdobeAnalyticsRequestData(url, postData);

  _deps.addEvent({
    platform: 'adobe-analytics',
    platformName: 'Adobe Analytics',
    eventName: parsed.eventName,
    raw: {
      ...getRequestMeta(request),
      params: parsed.rawParams,
      postData
    },
    formatted: {
      overview: parsed.overview,
      params: parsed.params,
      parsedDisplayMode: parsed.parsedDisplayMode,
      sections: parsed.sections
    }
  });
}

// Parse Adobe Target request - uses shared parser
export function parseAdobeTargetRequest(request) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;

  // Use shared parser for Adobe Target extraction
  const parsed = parseAdobeTargetRequestData(url, postData);

  _deps.addEvent({
    platform: 'adobe-target',
    platformName: 'Adobe Target',
    eventName: parsed.eventName,
    raw: {
      ...getRequestMeta(request),
      params: parsed.rawParams,
      postData
    },
    formatted: {
      overview: parsed.overview,
      params: parsed.params,
      parsedDisplayMode: parsed.parsedDisplayMode,
      sections: parsed.sections
    }
  });
}

// Parse Adobe Audience Manager request - uses shared parser
export function parseAdobeAAMRequest(request) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;

  const parsed = parseAdobeAAMRequestData(url, postData);

  _deps.addEvent({
    platform: 'adobe-audience-manager',
    platformName: 'Adobe Audience Manager',
    eventName: parsed.eventName,
    raw: {
      ...getRequestMeta(request),
      params: parsed.rawParams,
      postData
    },
    formatted: {
      overview: parsed.overview,
      params: parsed.params,
      parsedDisplayMode: parsed.parsedDisplayMode,
      sections: parsed.sections
    }
  });
}

// Parse Adobe Experience Platform request - uses shared parser
// AEP can batch multiple events in one request, so we emit one parsed event per XDM event
//
// When called with `responseContent` (the dispatcher captures it for
// /interact URLs), the Edge Network's audience-activation destinations
// are parsed and attached to the FIRST emitted event's
// `formatted.aepDestinations`. Each AEP request typically corresponds to
// one user action; the destination payload applies to the whole request,
// not per individual XDM event in the batch.
export function parseAdobeAEPRequest(request, responseContent) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;

  const parsed = parseAdobeAEPRequestData(url, postData);
  const meta = getRequestMeta(request);

  // Parse destinations from the interact response body if present.
  // Resolves each destination URL to a platform-id via matchKnownEndpoint,
  // which lives in panel layer (tracking-endpoints.js) — passed as the
  // `urlResolver` parameter so the parser stays in the shared layer.
  let aepDestinations = null;
  if (responseContent && isAepInteractUrl(url)) {
    try {
      const matched = parseAepInteractResponse(responseContent, (destUrl) => {
        const result = _deps.matchKnownEndpoint?.(destUrl);
        return result?.matched ? result.endpoint?.id : null;
      });
      if (matched && matched.destinationCount > 0) {
        aepDestinations = matched.destinations;
      }
    } catch { /* parser is fail-safe; ignore */ }
  }

  if (parsed.events && parsed.events.length > 0) {
    parsed.events.forEach((event, idx) => {
      const formatted = {
        overview: event.overview,
        params: event.groupedParams,
        parsedDisplayMode: 'table',
        sections: event.sections
      };
      // Attach destinations to the first event in the batch — the
      // payload applies to the whole request, so duplicating it onto
      // every event would just clutter the stream.
      if (idx === 0 && aepDestinations) {
        formatted.aepDestinations = aepDestinations;
      }
      _deps.addEvent({
        platform: 'adobe-experience-platform',
        platformName: 'Adobe Experience Platform',
        eventName: event.eventName,
        raw: {
          ...meta,
          params: parsed.rawParams,
          postData,
          event: event.rawEvent
        },
        formatted
      });
    });
  }
}

// Parse Amplitude request - uses shared parser
export function parseAmplitudeRequest(request, responseContent) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;
  const parsed = parseAmplitudeRequestData(url, postData);

  // Self-exclusion: don't track the extension's own analytics requests
  if (AMPLITUDE_API_KEYS.includes(parsed.apiKey)) {
    return;
  }

  const meta = getRequestMeta(request);

  // Add each parsed event
  if (parsed.events && parsed.events.length > 0) {
    parsed.events.forEach(event => {
      const overview = {};
      if (parsed.apiKey) overview['API Key'] = parsed.apiKey;
      if (event.userId) overview['User ID'] = event.userId;
      if (event.deviceId) overview['Device ID'] = event.deviceId;
      if (event.sessionId) overview['Session ID'] = event.sessionId;

      // Build Custom Data section — Event Properties and User Properties as grouped table
      const customData = {};
      if (Object.keys(event.eventProperties).length > 0) {
        customData['Event Properties'] = event.eventProperties;
      }
      if (Object.keys(event.userProperties).length > 0) {
        customData['User Properties'] = event.userProperties;
      }
      const sections = [];
      if (Object.keys(customData).length > 0) {
        sections.push({ title: 'Custom Data', data: customData, type: 'table' });
      }

      _deps.addEvent({
        platform: 'amplitude',
        platformName: 'Amplitude',
        eventName: event.eventName,
        raw: { ...meta, event: event.rawEvent },
        formatted: {
          overview,
          sections,
          detectedBy: parsed.detectedBy
        }
      });
    });
  } else {
    // No events found, add a raw entry
    _deps.addEvent({
      platform: 'amplitude',
      platformName: 'Amplitude',
      eventName: '(request)',
      raw: { ...meta, postData },
      formatted: {
        overview: {},
        params: { note: 'Could not parse events from this request' },
        detectedBy: parsed.detectedBy
      }
    });
  }
}

// Parse Braze data-collection request - uses shared parser
export function parseBrazeRequest(request) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;
  const parsed = parseBrazeRequestData(url, postData);
  const meta = getRequestMeta(request);

  const ctx = {
    apiKey: parsed.apiKey,
    deviceId: parsed.deviceId,
    sdkVersion: parsed.sdkVersion,
    device: parsed.device
  };

  if (parsed.events && parsed.events.length > 0) {
    parsed.events.forEach(event => {
      const overview = {};
      if (event.eventName) overview['Event'] = event.eventName;
      if (event.sessionId) overview['Session ID'] = event.sessionId;

      // Custom Data — the business property bag (custom-event props / purchase fields)
      const sections = [];
      if (event.properties && Object.keys(event.properties).length > 0) {
        sections.push({ title: 'Custom Data', data: event.properties, type: 'table' });
      }

      _deps.addEvent({
        platform: 'braze',
        platformName: 'Braze',
        eventName: event.eventName,
        raw: { ...meta, event: event.rawEvent },
        formatted: {
          overview,
          sections,
          params: buildBrazeGroupedParams(event, ctx),
          parsedDisplayMode: 'table',
          detectedBy: parsed.detectedBy
        }
      });
    });
  } else {
    // No decodable events (e.g. config-only request) — add a raw entry
    _deps.addEvent({
      platform: 'braze',
      platformName: 'Braze',
      eventName: '(request)',
      raw: { ...meta, postData },
      formatted: {
        overview: {},
        params: buildBrazeGroupedParams({}, ctx),
        parsedDisplayMode: 'table',
        detectedBy: parsed.detectedBy
      }
    });
  }
}

// Parse Tealium Collect request - uses shared parser
export function parseTealiumCollectRequest(request, responseContent) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;
  const parsed = parseTealiumCollectData(url, postData);
  const meta = getRequestMeta(request);

  // Populate Tealium tag UID → vendor mapping from loader.cfg
  if (parsed.tagMapping && Object.keys(parsed.tagMapping).length > 0) {
    let updated = false;
    for (const [tagUid, tid] of Object.entries(parsed.tagMapping)) {
      if (!_deps.tealiumTagConfig.has(tagUid)) {
        const vendor = lookupTealiumTID(tid);
        _deps.tealiumTagConfig.set(tagUid, {
          tid,
          vendorCompact: vendor?.compact || null,
          confidence: vendor?.confidence || null,
          evidence: vendor?.evidence || null,
          platformId: vendor?.platformId || null
        });
        updated = true;
      }
    }
    // Re-render to update existing utag.XXX.js events with vendor names
    if (updated) {
      _deps.scheduleRender();
    }
  }

  _deps.addEvent({
    platform: 'tealium-collect',
    platformName: 'Tealium Collect',
    eventName: parsed.eventName,
    raw: { ...meta, postData },
    formatted: {
      overview: parsed.overview,
      sections: parsed.sections,
      detectedBy: `URL matches Tealium Collect endpoint`
    }
  });
}

// Parse Facebook Pixel request - uses shared parser
export function parseFacebookPixel(request) {
  const url = request.request.url;
  const parsed = parseFacebookPixelData(url);

  // Feature #80 — supplier annotation. The Facebook Pixel `a=…` partner stamp
  // is one of three Stape detection strategies (the others fire elsewhere in
  // the pipeline). Driven by `supplier-registry.js` so future suppliers shipping
  // an fb-tag template only need a registry entry.
  let proxyHost;          // legacy `formatted.proxyHost = 'stape'` — kept for back-compat with event-detail.js's existing pill render
  let supplier = null;    // new `formatted.supplier` — generic across all suppliers
  const currentPage = _deps.getCurrentPageHostname ? _deps.getCurrentPageHostname() : '';
  try {
    const urlObj = parseUrlMemo(url);
    const queryParams = Object.fromEntries(urlObj.searchParams);
    const supplierId = matchSupplierStamp('facebook', queryParams, null);
    if (supplierId) {
      supplier = buildSupplierAnnotation(supplierId, 'facebook');
      if (supplierId === 'stape') {
        proxyHost = 'stape';
        if (_deps.recordStapePage && currentPage) {
          _deps.recordStapePage(currentPage);
        }
      }
    } else if (_deps.isStapeHost && _deps.isStapeHost(currentPage)) {
      // Cross-event inference fallback — page-level Stape signal annotates this
      // event even without a per-request stamp.
      proxyHost = 'stape';
      supplier = buildSupplierAnnotation('stape', 'facebook');
    }
  } catch { /* invalid URL — ignore */ }

  // Build sections from parser's custom data
  const sections = [];
  if (Object.keys(parsed.customData).length > 0) {
    sections.push({ title: 'Custom Data', data: parsed.customData, type: 'table' });
  }

  _deps.addEvent({
    platform: 'facebook',
    platformName: 'Facebook',
    eventName: parsed.eventName,
    raw: { ...getRequestMeta(request), params: parsed.rawParams },
    formatted: {
      overview: parsed.overview,
      sections: sections.length > 0 ? sections : undefined,
      params: parsed.groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy,
      ...(proxyHost && { proxyHost }),
      ...(supplier && { supplier }),
    }
  });
}

// Parse GTM script load (googletagmanager.com/gtm.js) - uses shared parser
export function parseGTMScriptLoad(request) {
  const url = request.request.url;
  const requestMeta = getRequestMeta(request);

  // Use shared parser for GTM data extraction
  const parsed = parseGTMScriptLoadData(url);
  const eventId = crypto.randomUUID();

  // Store initiator relationship for script tree (panel-specific)
  if (requestMeta.initiatorType) {
    _deps.scriptInitiatorMap.set(parsed.scriptUrl, {
      type: requestMeta.initiatorType,
      initiatorUrl: requestMeta.initiatorUrl,
      initiatorEventId: null
    });

    if (requestMeta.initiatorUrl) {
      const children = _deps.scriptChildrenMap.get(requestMeta.initiatorUrl) || [];
      children.push(parsed.scriptUrl);
      _deps.scriptChildrenMap.set(requestMeta.initiatorUrl, children);
    }
  }

  _deps.scriptUrlToEventId.set(parsed.scriptUrl, eventId);

  const formatted = {
    type: 'Script Load',
    containerId: parsed.containerId,
    dataLayerName: parsed.dataLayerName,
    gtmAuth: parsed.gtmAuth,
    gtmPreview: parsed.gtmPreview,
    gtmCookiesWin: parsed.gtmCookiesWin,
    scriptUrl: parsed.scriptUrl,
    initiatorType: requestMeta.initiatorType,
    initiatorUrl: requestMeta.initiatorUrl
  };

  const eventData = {
    id: eventId,
    platform: 'gtm',
    platformName: 'GTM',
    eventName: parsed.eventName,
    isScriptLoad: true,
    raw: { ...requestMeta, params: parsed.params },
    formatted
  };

  // Wait for response body to extract container version, tag counts, and event names.
  // The request has already completed (onRequestFinished), so getContent should return quickly.
  // Use a timeout fallback to ensure the event always appears even if getContent is slow.
  let emitted = false;
  const emit = () => {
    if (emitted) return;
    emitted = true;
    _deps.addEvent(eventData);
  };

  const fallbackTimer = setTimeout(emit, 300);

  request.getContent((content, encoding) => {
    clearTimeout(fallbackTimer);
    if (content) {
      // Some browsers return base64-encoded content for compressed responses (e.g., zstd)
      let text = content;
      if (encoding === 'base64') {
        try { text = atob(content); } catch { text = null; }
      }
      if (text) {
        const containerData = parseGTMContainerResponse(text);
        if (containerData) {
          formatted.containerData = containerData;
        }
      }
    }
    emit();
  });
}

// Parse GTAG script load (googletagmanager.com/gtag/js) - uses shared parser
export function parseGTAGScriptLoad(request) {
  const url = request.request.url;
  const requestMeta = getRequestMeta(request);

  // Use shared parser for GTAG data extraction
  const parsed = parseGTAGScriptLoadData(url);
  const eventId = crypto.randomUUID();

  // Store initiator relationship for script tree (panel-specific)
  if (requestMeta.initiatorType) {
    _deps.scriptInitiatorMap.set(parsed.scriptUrl, {
      type: requestMeta.initiatorType,
      initiatorUrl: requestMeta.initiatorUrl,
      initiatorEventId: null
    });

    if (requestMeta.initiatorUrl) {
      const children = _deps.scriptChildrenMap.get(requestMeta.initiatorUrl) || [];
      children.push(parsed.scriptUrl);
      _deps.scriptChildrenMap.set(requestMeta.initiatorUrl, children);
    }
  }

  _deps.scriptUrlToEventId.set(parsed.scriptUrl, eventId);

  _deps.addEvent({
    id: eventId,
    platform: 'gtag',
    platformName: 'GTAG',
    eventName: parsed.eventName,
    isScriptLoad: true,
    raw: { ...requestMeta, params: parsed.params },
    formatted: {
      type: 'Script Load',
      measurementId: parsed.measurementId,
      dataLayerName: parsed.dataLayerName,
      scriptUrl: parsed.scriptUrl,
      initiatorType: requestMeta.initiatorType,
      initiatorUrl: requestMeta.initiatorUrl
    }
  });
}

// detectKnownScriptLoad — thin wrapper around shared matchScriptLoad
// Adapts the shared API (platformId) to the panel API (platform) expected by parseKnownScriptLoad
/**
 * Feature #79 (v1.3.0) — `isCustomDomainGTMLoad` and `isCustomDomainGTAGLoad`
 * were deleted as part of the topology-classifier consolidation. Their job is
 * now done by `classifyTopology(url, pageHostname).loaderHint`, which returns
 * `'gtm'`, `'gtag'`, or `null` from a single shared implementation in
 * `shared/detection/topology.js`. Callers below dispatch on `loaderHint`.
 */

function detectKnownScriptLoad(url, request) {
  const resourceType = request.request?.type || request._resourceType;
  const match = matchScriptLoad(url, resourceType);
  if (!match) return null;
  return { platform: match.platformId, name: match.name, scriptId: match.scriptId };
}

/**
 * Parse a known script load and track initiator relationships
 */
export function parseKnownScriptLoad(request, match) {
  const url = parseUrlMemo(request.request.url);
  const params = Object.fromEntries(url.searchParams);
  const requestMeta = getRequestMeta(request);

  // Extract Tealium tag UID from vendor tag scripts (utag.XXX.js where XXX is numeric)
  let tealiumTagUid = null;
  if (match.platform === 'tealium') {
    const tagUidMatch = url.pathname.match(/\/utag\.(\d+)\.js/);
    if (tagUidMatch) {
      tealiumTagUid = tagUidMatch[1];
    }
  }

  // Build event name — for Tealium vendor tags, use filename (vendor resolved at render time)
  let eventName;
  if (tealiumTagUid) {
    eventName = `utag.${tealiumTagUid}.js`;
  } else if (match.scriptId) {
    eventName = `${match.name} Load: ${match.scriptId}`;
  } else {
    eventName = `${match.name} Load`;
  }

  const eventId = crypto.randomUUID();
  const scriptUrl = url.href;

  // Store initiator relationship for script tree
  if (requestMeta.initiatorType) {
    _deps.scriptInitiatorMap.set(scriptUrl, {
      type: requestMeta.initiatorType,
      initiatorUrl: requestMeta.initiatorUrl,
      initiatorEventId: null // Will be resolved when we find the matching event
    });

    // Build parent-child relationship
    if (requestMeta.initiatorUrl) {
      const children = _deps.scriptChildrenMap.get(requestMeta.initiatorUrl) || [];
      children.push(scriptUrl);
      _deps.scriptChildrenMap.set(requestMeta.initiatorUrl, children);
    }
  }

  // Map script URL to event ID for jump-to links
  _deps.scriptUrlToEventId.set(scriptUrl, eventId);

  const eventData = {
    id: eventId,
    platform: match.platform,
    platformName: match.name,
    eventName: eventName,
    isScriptLoad: true,
    raw: { ...requestMeta, params },
    formatted: {
      type: 'Script Load',
      scriptId: match.scriptId,
      scriptUrl: scriptUrl,
      tealiumTagUid: tealiumTagUid,
      initiatorType: requestMeta.initiatorType,
      initiatorUrl: requestMeta.initiatorUrl
    }
  };

  // Adobe Launch published library — fetch the response body and parse
  // the embedded container literal so we can surface installed
  // extensions + the extensions referenced by rule actions in the
  // event detail (parallel to GTM's containerData). The body fetch is
  // async; mirror parseGTMScriptLoad's emit-with-fallback pattern so a
  // slow getContent doesn't drop the event entirely.
  if (match.platform === 'adobe-launch' && isAdobeLaunchLibraryUrl(scriptUrl)) {
    let emitted = false;
    const emit = () => {
      if (emitted) return;
      emitted = true;
      _deps.addEvent(eventData);
    };
    const fallback = setTimeout(emit, 300);
    request.getContent((content, encoding) => {
      clearTimeout(fallback);
      if (content) {
        let text = content;
        if (encoding === 'base64') {
          try { text = atob(content); } catch { text = null; }
        }
        if (text) {
          const parsed = parseAdobeLaunchContainer(text);
          if (parsed) {
            eventData.formatted.containerData = parsed;
          }
        }
      }
      emit();
    });
    return;
  }

  _deps.addEvent(eventData);
}

// Parse GTM health-check ping (gtg_health=1 follow-up library request)
// This is a separate, additional library request that fires after the initial gtm.js
// load when the container includes Google tags. Throttled to once per 24h via the
// _gcl_ls localStorage key when ad_storage and ad_user_data consent are granted;
// fires every page load otherwise.
export function parseGTMHealthPing(request) {
  const url = request.request.url;
  const parsed = parseGTMHealthPingData(url);

  _deps.addEvent({
    platform: 'gtm-health',
    platformName: 'GTM Health Ping',
    eventName: parsed.eventName,
    raw: { ...getRequestMeta(request), params: parsed.params },
    formatted: {
      containerId: parsed.containerId,
      scriptUrl: parsed.scriptUrl
    }
  });
}

// Parse GTM Analytics/Logging request - uses shared parser
// This is GTM's internal telemetry that sends performance and tag execution data back to Google
export function parseGTMAnalyticsRequest(request) {
  const url = request.request.url;

  // Use shared parser for GTM Analytics extraction
  const parsed = parseGTMAnalyticsRequestData(url);

  _deps.addEvent({
    platform: 'gtm-analytics',
    platformName: 'GTM Telemetry',
    eventName: parsed.eventName,
    raw: { ...getRequestMeta(request), params: parsed.params },
    formatted: {
      containerId: parsed.containerId,
      containerConfigId: parsed.containerConfigId,
      runtimeVersion: parsed.runtimeVersion,
      protocolVersion: parsed.protocolVersion,
      hitType: parsed.hitType,
      pageId: parsed.pageId,
      tagExecutions: parsed.tagExecutions,
      rawLog: parsed.rawLog
    }
  });
}

// Parse Google Ads Conversion request - uses shared parser
export function parseGoogleAdsConversion(request) {
  const url = request.request.url;
  const parsed = parseGoogleAdsConversionData(url);

  const consentSection = buildConsentSection(parsed.params || {});
  const sections = [];
  if (consentSection) {
    sections.push({ title: 'Consent Mode', data: consentSection, type: 'table', expanded: false });
  }

  _deps.addEvent({
    platform: 'google-ads-conversion',
    platformName: 'Google Ads Conversion',
    eventName: parsed.eventName,
    raw: { ...getRequestMeta(request), params: parsed.params },
    formatted: {
      overview: parsed.overview,
      params: parsed.groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy,
      consentSignals: buildConsentSignals(parsed.params || {}),
      ...(sections.length > 0 && { sections })
    }
  });
}

// Parse Google Ads Remarketing request - uses shared parser
export function parseGoogleAdsRemarketing(request) {
  const url = request.request.url;
  const parsed = parseGoogleAdsRemarketingData(url);

  const consentSection = buildConsentSection(parsed.params || {});
  const sections = [];
  if (consentSection) {
    sections.push({ title: 'Consent Mode', data: consentSection, type: 'table', expanded: false });
  }

  _deps.addEvent({
    platform: 'google-ads-remarketing',
    platformName: 'Google Ads Remarketing',
    eventName: parsed.eventName,
    raw: { ...getRequestMeta(request), params: parsed.params },
    formatted: {
      overview: parsed.overview,
      params: parsed.groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy,
      consentSignals: buildConsentSignals(parsed.params || {}),
      ...(sections.length > 0 && { sections })
    }
  });
}

// Parse TikTok Pixel request - uses shared parser
export function parseTikTokPixel(request) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;
  const parsed = parseTikTokPixelData(url, postData);

  // Build sections from parser's custom data
  const sections = [];
  if (Object.keys(parsed.customData).length > 0) {
    sections.push({ title: 'Custom Data', data: parsed.customData, type: 'table' });
  }

  _deps.addEvent({
    platform: 'tiktok',
    platformName: 'TikTok',
    eventName: parsed.eventName,
    raw: { ...getRequestMeta(request), params: parsed.rawParams, postData: parsed.postData },
    formatted: {
      overview: parsed.overview,
      sections: sections.length > 0 ? sections : undefined,
      params: parsed.groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy
    }
  });
}

// Parse LinkedIn Insight Tag request - uses shared parser
export function parseLinkedInPixel(request) {
  const url = request.request.url;
  const parsed = parseLinkedInPixelData(url);

  _deps.addEvent({
    platform: 'linkedin',
    platformName: 'LinkedIn',
    eventName: parsed.eventName,
    raw: { ...getRequestMeta(request), params: parsed.params },
    formatted: {
      overview: parsed.overview,
      params: parsed.groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy
    }
  });
}

// Parse Snapchat Pixel request - uses shared parser
export function parseSnapchatPixel(request) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;
  const parsed = parseSnapchatPixelData(url, postData);

  // Build sections from parser's custom data
  const sections = [];
  if (Object.keys(parsed.customData).length > 0) {
    sections.push({ title: 'Custom Data', data: parsed.customData, type: 'table' });
  }

  _deps.addEvent({
    platform: 'snapchat',
    platformName: 'Snapchat',
    eventName: parsed.eventName,
    raw: { ...getRequestMeta(request), params: parsed.rawParams, postData: parsed.postData },
    formatted: {
      overview: parsed.overview,
      sections: sections.length > 0 ? sections : undefined,
      params: parsed.groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy
    }
  });
}

// Parse Salesforce Marketing Cloud request - uses shared parser
export function parseSalesforceMarketing(request) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;
  const parsed = parseSalesforceMarketingData(url, postData);

  // Build sections from parser's custom data + e-commerce items
  const sections = [];
  if (Object.keys(parsed.customData).length > 0) {
    sections.push({ title: 'Custom Data', data: parsed.customData, type: 'table' });
  }
  if (parsed.ecommerceItems.length > 0) {
    sections.push({
      title: `Cart Items (${parsed.ecommerceItems.length})`,
      data: parsed.ecommerceItems,
      sortRows: false
    });
  }

  _deps.addEvent({
    platform: 'salesforce-marketing',
    platformName: 'Salesforce Marketing',
    eventName: parsed.eventName,
    raw: { ...getRequestMeta(request), params: parsed.rawParams, postData: parsed.postData },
    formatted: {
      overview: parsed.overview,
      sections: sections.length > 0 ? sections : undefined,
      params: parsed.groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy
    }
  });
}

// Gunzip a Uint8Array to a UTF-8 string via the DecompressionStream API (Chrome 80+).
// Shared core for the base64 and raw-binary PostHog decode paths below.
async function gunzipBytesToString(bytes) {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(result);
}

// Decompress gzip PostHog data delivered as base64 TEXT (base64 → gzip → JSON).
// Legacy/proxy transport: `?compression=gzip-js` with the gzip base64-encoded in the body.
export async function decompressGzipBase64(base64Data) {
  const binaryStr = atob(base64Data);
  const bytes = Uint8Array.from(binaryStr, c => c.charCodeAt(0));
  return gunzipBytesToString(bytes);
}

// Decompress gzip PostHog data delivered as a RAW BINARY body (modern posthog-js default).
// chrome.devtools.network surfaces the binary body as a JS string; reconstruct the bytes via
// charCodeAt and VERIFY the gzip magic header (0x1f 0x8b) before decompressing. If the browser
// delivered the body lossily (e.g. UTF-8-decoded with U+FFFD replacement chars), the magic
// check fails and we throw — the caller then renders the (request) fallback instead of feeding
// corrupt bytes to DecompressionStream. The `& 0xFF` is a no-op for a faithful Latin-1 byte
// string and a guard for the lossy case.
export async function decompressGzipBinaryString(binaryStr) {
  const bytes = Uint8Array.from(binaryStr, c => c.charCodeAt(0) & 0xFF);
  if (bytes.length < 2 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) {
    throw new Error('PostHog gzip body not recoverable from DevTools postData (lossy binary transport)');
  }
  return gunzipBytesToString(bytes);
}

/**
 * Separate PostHog $ properties from custom properties
 * @param {Object} properties - All event properties
 * @returns {{ customProps: Object, groupedParams: Object }}
 */
export function separatePostHogProperties(properties) {
  const customProps = {};
  const pageContext = {};
  const browserDevice = {};
  const session = {};
  const library = {};
  const identity = {};
  const autocapture = {};
  const campaign = {};
  const otherSystem = {};

  const pageKeys = new Set(['$current_url', '$host', '$pathname', '$referrer', '$referring_domain', '$title']);
  const browserKeys = new Set(['$browser', '$browser_version', '$os', '$os_version', '$device_type',
    '$screen_height', '$screen_width', '$viewport_height', '$viewport_width', '$browser_language']);
  const sessionKeys = new Set(['$session_id', '$window_id', '$pageview_id', '$replay_minimum_duration']);
  const libraryKeys = new Set(['$lib', '$lib_version', '$lib_version__major']);
  const identityKeys = new Set(['$distinct_id', '$anon_distinct_id', '$device_id', '$user_id']);
  const autocaptureKeys = new Set(['$event_type', '$el_text', '$elements', '$elements_chain']);

  for (const [key, value] of Object.entries(properties)) {
    if (!key.startsWith('$')) {
      customProps[key] = value;
    } else if (pageKeys.has(key)) {
      pageContext[key] = value;
    } else if (browserKeys.has(key)) {
      browserDevice[key] = value;
    } else if (sessionKeys.has(key)) {
      session[key] = value;
    } else if (libraryKeys.has(key)) {
      library[key] = value;
    } else if (identityKeys.has(key)) {
      identity[key] = value;
    } else if (autocaptureKeys.has(key)) {
      autocapture[key] = value;
    } else if (key.startsWith('$initial_')) {
      campaign[key] = value;
    } else {
      otherSystem[key] = value;
    }
  }

  const groupedParams = {};
  if (Object.keys(pageContext).length > 0) groupedParams['Page Context'] = pageContext;
  if (Object.keys(browserDevice).length > 0) groupedParams['Browser & Device'] = browserDevice;
  if (Object.keys(session).length > 0) groupedParams['Session'] = session;
  if (Object.keys(library).length > 0) groupedParams['Library'] = library;
  if (Object.keys(identity).length > 0) groupedParams['Identity'] = identity;
  if (Object.keys(autocapture).length > 0) groupedParams['Autocapture'] = autocapture;
  if (Object.keys(campaign).length > 0) groupedParams['Campaign & Attribution'] = campaign;
  if (Object.keys(otherSystem).length > 0) groupedParams['Other'] = otherSystem;

  return { customProps, groupedParams };
}

// Parse PostHog API request - uses shared parser
// Handles capture (/e/, /capture/, /batch/), flags, and decide endpoints
export async function parsePostHogRequest(request, responseContent) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;
  let parsed = parsePostHogRequestData(url, postData);
  const meta = getRequestMeta(request);

  // Handle gzip compression: async decompress, then re-parse. Two transports — base64 text
  // (rawBase64Data) and raw binary body (rawGzipBinary). The binary path verifies the gzip
  // magic header and throws on a lossy DevTools body, which lands us in the fallback below.
  if (parsed.needsAsyncDecode && (parsed.rawBase64Data || parsed.rawGzipBinary)) {
    try {
      const decoded = parsed.rawBase64Data
        ? await decompressGzipBase64(parsed.rawBase64Data)
        : await decompressGzipBinaryString(parsed.rawGzipBinary);
      parsed = parsePostHogRequestData(url, decoded);
    } catch (e) {
      // Decompression failed (or DevTools delivered the binary body lossily) — show what we can
    }
  }

  // Route by endpoint type
  if (parsed.endpointType === 'flags' || parsed.endpointType === 'decide') {
    // Feature Flags / Decide — show person properties and decoded data
    const overview = {};
    if (parsed.token) overview['API Key'] = parsed.token;
    if (parsed.distinctId) overview['Distinct ID'] = parsed.distinctId;
    overview['Region'] = parsed.region;
    overview['Endpoint'] = parsed.endpointType === 'flags' ? 'Feature Flags' : 'Decide';

    const sections = [];

    // Person properties as Custom Data section
    if (parsed.personProperties && Object.keys(parsed.personProperties).length > 0) {
      // Separate custom person props from $initial_* system props
      const customPersonProps = {};
      const systemPersonProps = {};
      for (const [key, value] of Object.entries(parsed.personProperties)) {
        if (key.startsWith('$')) {
          systemPersonProps[key] = value;
        } else {
          customPersonProps[key] = value;
        }
      }
      const personData = {};
      if (Object.keys(customPersonProps).length > 0) {
        personData['User Properties'] = customPersonProps;
      }
      if (Object.keys(systemPersonProps).length > 0) {
        personData['Initial Properties'] = systemPersonProps;
      }
      // If only one group, unwrap
      const sectionData = Object.keys(personData).length === 1
        ? Object.values(personData)[0]
        : personData;
      sections.push({ title: 'Person Properties', data: sectionData, type: 'table' });
    }

    // Groups section
    if (parsed.groups) {
      sections.push({ title: 'Groups', data: parsed.groups, type: 'table' });
    }

    const eventName = parsed.endpointType === 'flags' ? 'Feature Flags' : 'Decide';

    _deps.addEvent({
      platform: 'posthog',
      platformName: 'PostHog',
      eventName,
      raw: { ...meta, postData },
      formatted: {
        overview,
        sections,
        detectedBy: parsed.detectedBy
      }
    });
    return;
  }

  // Capture events (/e/, /capture/, /batch/)
  if (parsed.events && parsed.events.length > 0) {
    parsed.events.forEach(event => {
      const overview = {};
      if (parsed.token) overview['API Key'] = parsed.token;
      if (event.distinctId) overview['Distinct ID'] = event.distinctId;
      overview['Region'] = parsed.region;
      const sdkVersion = event.properties?.$lib_version || parsed.sdkVersion;
      if (sdkVersion) overview['SDK Version'] = sdkVersion;

      // Separate custom properties from $ system properties
      const { customProps, groupedParams } = separatePostHogProperties(event.properties);

      const sections = [];
      if (Object.keys(customProps).length > 0) {
        sections.push({ title: 'Event Properties', data: customProps, type: 'table' });
      }

      _deps.addEvent({
        platform: 'posthog',
        platformName: 'PostHog',
        eventName: event.eventName,
        raw: { ...meta, postData, event: event.rawEvent },
        formatted: {
          overview,
          sections,
          params: Object.keys(groupedParams).length > 0 ? groupedParams : undefined,
          parsedDisplayMode: Object.keys(groupedParams).length > 0 ? 'table' : undefined,
          detectedBy: parsed.detectedBy
        }
      });
    });
  } else {
    // No events found — show raw entry with context
    const overview = {};
    if (parsed.token) overview['API Key'] = parsed.token;
    if (parsed.distinctId) overview['Distinct ID'] = parsed.distinctId;
    overview['Region'] = parsed.region;

    // Detect beacon requests — browser doesn't expose body for sendBeacon/ping
    const isBeacon = url.includes('beacon=1') || meta.type === 'ping';
    // After a failed gzip decode, `parsed.needsAsyncDecode` is still true (a successful decode
    // re-parses into a plain-JSON result with the flag cleared) — distinguish that case so the
    // note explains the gzip limitation rather than a generic parse failure.
    let note;
    if (isBeacon) {
      note = 'Beacon request — event data sent via navigator.sendBeacon() (body not available in DevTools)';
    } else if (parsed.needsAsyncDecode) {
      note = 'Gzip-compressed capture body could not be decoded — the raw binary request body is not recoverable from this browser\'s DevTools network data';
    } else {
      note = 'Could not parse events from this request';
    }

    _deps.addEvent({
      platform: 'posthog',
      platformName: 'PostHog',
      eventName: isBeacon ? 'Event Capture (beacon)' : '(request)',
      raw: { ...meta, postData },
      formatted: {
        overview,
        params: { note },
        detectedBy: parsed.detectedBy
      }
    });
  }
}

// Parse Mixpanel request - uses shared parser
export function parseMixpanelRequest(request, responseContent) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;
  const parsed = parseMixpanelRequestData(url, postData);
  const meta = getRequestMeta(request);

  // Add each parsed event
  if (parsed.events && parsed.events.length > 0) {
    parsed.events.forEach(event => {
      const overview = {};
      if (parsed.token) overview['Token'] = parsed.token;
      if (event.distinctId) overview['Distinct ID'] = event.distinctId;
      overview['Region'] = parsed.region;

      const sections = [];
      if (Object.keys(event.properties).length > 0) {
        sections.push({ title: 'Event Properties', data: event.properties, type: 'table' });
      }

      _deps.addEvent({
        platform: 'mixpanel',
        platformName: 'Mixpanel',
        eventName: event.eventName,
        raw: { ...meta, postData, event: event.rawEvent },
        formatted: {
          overview,
          sections,
          detectedBy: parsed.detectedBy
        }
      });
    });
  } else {
    // No events found, add a raw entry
    _deps.addEvent({
      platform: 'mixpanel',
      platformName: 'Mixpanel',
      eventName: '(request)',
      raw: { ...meta, postData },
      formatted: {
        overview: { 'Region': parsed.region },
        params: { note: 'Could not parse events from this request' },
        detectedBy: parsed.detectedBy
      }
    });
  }
}

// Parse Matomo request - uses shared parser
export function parseMatomoRequest(request) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;
  const parsed = parseMatomoRequestData(url, postData);
  const meta = getRequestMeta(request);

  // Build sections array following standard layout
  const sections = [];

  // Custom Data — event tracking, content tracking, custom dimensions/variables
  if (Object.keys(parsed.customData).length > 0) {
    sections.push({ title: 'Custom Data', data: parsed.customData, type: 'table' });
  }

  // E-Commerce items
  if (parsed.ecommerce) {
    const itemData = {};
    if (Object.keys(parsed.ecommerce.summary).length > 0) {
      itemData['Order Summary'] = parsed.ecommerce.summary;
    }
    parsed.ecommerce.items.forEach((item, i) => {
      const label = item['Name'] || item['SKU'] || `Item ${i + 1}`;
      itemData[label] = item;
    });
    sections.push({ title: `E-Commerce Items (${parsed.ecommerce.items.length})`, data: itemData, type: 'table', sortRows: false });
  }

  _deps.addEvent({
    platform: 'matomo',
    platformName: 'Matomo',
    eventName: parsed.eventName,
    raw: { ...meta, params: parsed.params },
    formatted: {
      overview: parsed.overview,
      sections: sections.length > 0 ? sections : undefined,
      params: parsed.groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy
    }
  });
}

// Parse Piwik PRO request - uses shared parser
// Routes consent events to piwik-pro-consent, analytics events to piwik-pro
export function parsePiwikProRequest(request) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;
  const parsed = parsePiwikProRequestData(url, postData);
  const meta = getRequestMeta(request);

  // Route consent events to piwik-pro-consent platform
  const platform = parsed.isConsentEvent ? 'piwik-pro-consent' : 'piwik-pro';
  // BUG44 (2026-05-26): keep these literals in sync with the registry shortName
  // values so the event-stream row label matches the filter pill + tool dropdown.
  // event-list uses this stamped `platformName`; filter-bar reads from PLATFORM_NAMES
  // (built from registry shortName) — they were drifting until this fix.
  const platformName = parsed.isConsentEvent ? 'Piwik Pro Consent' : 'Piwik Pro Analytics';

  // Build sections array following standard layout
  const sections = [];

  // Consent section (for consent events)
  if (parsed.consent && Object.keys(parsed.consent).length > 0) {
    sections.push({ title: 'Consent Event', data: parsed.consent, type: 'table', expanded: true });
  }

  // Custom Data — event tracking, content tracking, custom dimensions/variables
  if (Object.keys(parsed.customData).length > 0) {
    sections.push({ title: 'Custom Data', data: parsed.customData, type: 'table' });
  }

  // E-Commerce items
  if (parsed.ecommerce) {
    const itemData = {};
    if (Object.keys(parsed.ecommerce.summary).length > 0) {
      itemData['Order Summary'] = parsed.ecommerce.summary;
    }
    parsed.ecommerce.items.forEach((item, i) => {
      const label = item['Name'] || item['SKU'] || `Item ${i + 1}`;
      itemData[label] = item;
    });
    sections.push({ title: `E-Commerce Items (${parsed.ecommerce.items.length})`, data: itemData, type: 'table', sortRows: false });
  }

  _deps.addEvent({
    platform,
    platformName,
    eventName: parsed.eventName,
    raw: { ...meta, params: parsed.params },
    formatted: {
      overview: parsed.overview,
      sections: sections.length > 0 ? sections : undefined,
      params: parsed.groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy
    }
  });
}

// Parse Bing / Microsoft UET request - uses shared parser
export function parseBingAdsRequest(request) {
  const url = request.request.url;
  const parsed = parseBingAdsData(url);

  const sections = [];
  if (Object.keys(parsed.customData).length > 0) {
    sections.push({ title: 'Custom Data', data: parsed.customData, type: 'table' });
  }

  _deps.addEvent({
    platform: 'bing',
    platformName: 'Bing Ads',
    eventName: parsed.eventName,
    raw: { ...getRequestMeta(request), params: parsed.params },
    formatted: {
      overview: parsed.overview,
      sections: sections.length > 0 ? sections : undefined,
      params: parsed.groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy
    }
  });
}

// Parse Twitter/X Pixel request - uses shared parser
export function parseTwitterPixelRequest(request) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;
  const parsed = parseTwitterPixelData(url, postData);

  const sections = [];
  if (Object.keys(parsed.customData).length > 0) {
    sections.push({ title: 'Custom Data', data: parsed.customData, type: 'table' });
  }
  if (parsed.ecommerceItems && parsed.ecommerceItems.length > 0) {
    const itemData = {};
    parsed.ecommerceItems.forEach((item, i) => {
      itemData[`Item ${i + 1}`] = item;
    });
    sections.push({ title: `E-Commerce Items (${parsed.ecommerceItems.length})`, data: itemData, type: 'table', sortRows: false });
  }

  _deps.addEvent({
    platform: 'twitter',
    platformName: 'Twitter/X',
    eventName: parsed.eventName,
    raw: { ...getRequestMeta(request), params: parsed.params },
    formatted: {
      overview: parsed.overview,
      sections: sections.length > 0 ? sections : undefined,
      params: parsed.groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy
    }
  });
}

// Parse Pinterest Tag request - uses shared parser
export function parsePinterestTagRequest(request) {
  const url = request.request.url;
  const parsed = parsePinterestTagData(url);

  const sections = [];
  if (Object.keys(parsed.customData).length > 0) {
    sections.push({ title: 'Custom Data', data: parsed.customData, type: 'table' });
  }
  if (parsed.ecommerceItems && parsed.ecommerceItems.length > 0) {
    const itemData = {};
    parsed.ecommerceItems.forEach((item, i) => {
      const label = item['Product Name'] || item['Product ID'] || `Item ${i + 1}`;
      itemData[label] = item;
    });
    sections.push({ title: `E-Commerce Items (${parsed.ecommerceItems.length})`, data: itemData, type: 'table', sortRows: false });
  }

  _deps.addEvent({
    platform: 'pinterest',
    platformName: 'Pinterest',
    eventName: parsed.eventName,
    raw: { ...getRequestMeta(request), params: parsed.params },
    formatted: {
      overview: parsed.overview,
      sections: sections.length > 0 ? sections : undefined,
      params: parsed.groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy
    }
  });
}

// Parse HubSpot tracking request - uses shared parser
export function parseHubSpotRequest(request) {
  const url = request.request.url;
  const parsed = parseHubSpotData(url);

  _deps.addEvent({
    platform: 'hubspot',
    platformName: 'HubSpot',
    eventName: parsed.eventName,
    raw: { ...getRequestMeta(request), params: parsed.params },
    formatted: {
      overview: parsed.overview,
      params: parsed.groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy
    }
  });
}

// Parse Criteo OneTag request - uses shared parser
export function parseCriteoRequest(request) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;
  const parsed = parseCriteoData(url, postData);

  const sections = [];
  if (Object.keys(parsed.customData).length > 0) {
    sections.push({ title: 'Custom Data', data: parsed.customData, type: 'table' });
  }
  if (parsed.ecommerceItems && parsed.ecommerceItems.length > 0) {
    const itemData = {};
    parsed.ecommerceItems.forEach((item, i) => {
      const label = item['Product ID'] || `Item ${i + 1}`;
      itemData[label] = item;
    });
    sections.push({ title: `E-Commerce Items (${parsed.ecommerceItems.length})`, data: itemData, type: 'table', sortRows: false });
  }

  _deps.addEvent({
    platform: 'criteo',
    platformName: 'Criteo',
    eventName: parsed.eventName,
    raw: { ...getRequestMeta(request), params: parsed.params, postData: parsed.postData },
    formatted: {
      overview: parsed.overview,
      sections: sections.length > 0 ? sections : undefined,
      params: parsed.groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy
    }
  });
}

// Parse Snowplow request - uses shared parser
export function parseSnowplowRequest(request, content) {
  const url = request.request.url;
  const postData = content || request.request.postData?.text || null;
  const parsed = parseSnowplowData(url, postData);

  const sections = [];
  if (Object.keys(parsed.customData).length > 0) {
    sections.push({ title: 'Custom Data', data: parsed.customData, type: 'table' });
  }

  _deps.addEvent({
    platform: 'snowplow',
    platformName: 'Snowplow',
    eventName: parsed.eventName,
    raw: { ...getRequestMeta(request), params: parsed.params, postData: parsed.postData },
    formatted: {
      overview: parsed.overview,
      sections: sections.length > 0 ? sections : undefined,
      params: parsed.groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy
    }
  });
}

// Parse Optimizely request - uses shared parser
export function parseOptimizelyRequest(request, content) {
  const url = request.request.url;
  const postData = content || request.request.postData?.text || null;
  const parsed = parseOptimizelyData(url, postData);

  const sections = [];
  if (Object.keys(parsed.customData).length > 0) {
    sections.push({ title: 'Custom Data', data: parsed.customData, type: 'table' });
  }

  _deps.addEvent({
    platform: 'optimizely',
    platformName: 'Optimizely',
    eventName: parsed.eventName,
    raw: { ...getRequestMeta(request), params: parsed.params, postData: parsed.postData },
    formatted: {
      overview: parsed.overview,
      sections: sections.length > 0 ? sections : undefined,
      params: parsed.groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy
    }
  });
}

// Parse Heap Analytics request - uses shared parser
export function parseHeapRequest(request, content) {
  const url = request.request.url;
  const postData = content || request.request.postData?.text || null;
  const parsed = parseHeapData(url, postData);

  const sections = [];
  if (Object.keys(parsed.customData).length > 0) {
    sections.push({ title: 'Custom Data', data: parsed.customData, type: 'table' });
  }

  _deps.addEvent({
    platform: 'heap',
    platformName: 'Heap',
    eventName: parsed.eventName,
    raw: { ...getRequestMeta(request), params: parsed.params, postData: parsed.postData },
    formatted: {
      overview: parsed.overview,
      sections: sections.length > 0 ? sections : undefined,
      params: parsed.groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy
    }
  });
}

// Parse Pendo request - uses shared parser
export function parsePendoRequest(request, content) {
  const url = request.request.url;
  const postData = content || request.request.postData?.text || null;
  const parsed = parsePendoData(url, postData);

  const sections = [];
  if (Object.keys(parsed.customData).length > 0) {
    sections.push({ title: 'Custom Data', data: parsed.customData, type: 'table' });
  }

  _deps.addEvent({
    platform: 'pendo',
    platformName: 'Pendo',
    eventName: parsed.eventName,
    raw: { ...getRequestMeta(request), params: parsed.params, postData: parsed.postData },
    formatted: {
      overview: parsed.overview,
      sections: sections.length > 0 ? sections : undefined,
      params: parsed.groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy
    }
  });
}

// Parse Piano Analytics request - uses shared parser
export function parsePianoAnalyticsRequest(request) {
  const url = request.request.url;
  const parsed = parsePianoAnalyticsData(url);

  const sections = [];
  if (Object.keys(parsed.customData).length > 0) {
    sections.push({ title: 'Custom Data', data: parsed.customData, type: 'table' });
  }

  _deps.addEvent({
    platform: 'piano-analytics',
    platformName: 'Piano Analytics',
    eventName: parsed.eventName,
    raw: { ...getRequestMeta(request), params: parsed.params },
    formatted: {
      overview: parsed.overview,
      sections: sections.length > 0 ? sections : undefined,
      params: parsed.groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy
    }
  });
}

// Parse Grafana Faro collector request — uses shared parser.
// Faro batches OpenTelemetry spans + events + logs + exceptions + measurements
// into one POST keyed by the app key in the URL path. The dominant signal kind
// becomes the event name; observed targets (hosts the SDK is auto-instrumenting)
// land in Parsed Data so the reader sees which other tracking calls this beacon
// is tracing.
export function parseGrafanaFaroRequest(request) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;
  const parsed = parseGrafanaFaroRequestData(url, postData);

  const meta = parsed.meta || {};
  const overview = {};
  if (parsed.appKey) overview['App Key'] = parsed.appKey;
  if (meta.app && meta.app.name) overview['App Name'] = meta.app.name;
  if (meta.app && meta.app.environment) overview['Environment'] = meta.app.environment;
  if (meta.app && meta.app.version) overview['App Version'] = meta.app.version;
  if (meta.session && meta.session.id) overview['Session ID'] = meta.session.id;
  if (meta.sdk && meta.sdk.name && meta.sdk.version) {
    overview['SDK'] = `${meta.sdk.name} ${meta.sdk.version}`;
  }

  // Custom Data — Faro's per-signal name tally (what kinds of signals are in this beacon)
  const sections = [];
  const customData = {};
  if (parsed.signalNames && Object.keys(parsed.signalNames).length > 0) {
    for (const [kind, tally] of Object.entries(parsed.signalNames)) {
      // Title-case the section header (Events / Logs / Exceptions / Measurements)
      const label = kind[0].toUpperCase() + kind.slice(1);
      customData[label] = tally;
    }
  }
  if (parsed.observedTargets && Object.keys(parsed.observedTargets).length > 0) {
    customData['Observed Hosts'] = parsed.observedTargets;
  }
  if (Object.keys(customData).length > 0) {
    sections.push({ title: 'Signal Breakdown', data: customData, type: 'table' });
  }

  // Parsed Data — system/protocol context in logical groups
  const groupedParams = {};
  if (meta.app && Object.keys(meta.app).length > 0) {
    groupedParams['App'] = meta.app;
  }
  if (meta.sdk && Object.keys(meta.sdk).length > 0) {
    groupedParams['SDK'] = meta.sdk;
  }
  const counts = { ...parsed.signalCounts };
  if (Object.keys(counts).length > 0) {
    groupedParams['Signal Counts'] = counts;
  }
  if (meta.browser && Object.keys(meta.browser).length > 0) {
    // Drop the noisy userAgent string from the grouped view — it's already in raw
    const { userAgent, brands, ...rest } = meta.browser;
    groupedParams['Browser'] = rest;
  }
  if (meta.page && meta.page.url) {
    groupedParams['Page'] = { 'URL': meta.page.url };
  }
  if (meta.session && Object.keys(meta.session).length > 0) {
    groupedParams['Session'] = meta.session;
  }

  _deps.addEvent({
    platform: 'grafana-faro',
    platformName: 'Grafana Faro',
    eventName: buildGrafanaFaroEventName(parsed),
    raw: { ...getRequestMeta(request), postData },
    formatted: {
      overview,
      sections: sections.length > 0 ? sections : undefined,
      params: groupedParams,
      parsedDisplayMode: 'table',
      detectedBy: parsed.detectedBy
    }
  });
}

// Helper: build formatted output for a Segment-spec parsed event
// Returns { sections, params } following the standard section layout:
//   1. Custom Data (expanded) — properties + traits grouped
//   2. Parsed Data (expanded, via params) — context, integrations, timing
export function buildSegmentSpecFormatted(event) {
  // === Sections: Custom Data (business data) ===
  const sections = [];
  const customData = {};

  // Properties (track/page/screen)
  if (event.properties && Object.keys(event.properties).length > 0) {
    customData['Properties'] = event.properties;
  }

  // Traits (identify/group)
  if (event.traits && Object.keys(event.traits).length > 0) {
    customData['Traits'] = event.traits;
  }

  if (Object.keys(customData).length > 0) {
    // If only one group, flatten to avoid unnecessary nesting
    const hasMultiple = Object.keys(customData).length > 1;
    sections.push({
      title: hasMultiple ? 'Custom Data' : Object.keys(customData)[0],
      data: hasMultiple ? customData : Object.values(customData)[0],
      type: 'table'
    });
  }

  // === Params: system/protocol data in logical groups ===
  const groupedParams = {};

  // Context group — library, page, campaign, userAgent, etc.
  if (event.context && Object.keys(event.context).length > 0) {
    groupedParams['Context'] = event.context;
  }

  // Integrations group
  if (event.integrations && Object.keys(event.integrations).length > 0) {
    groupedParams['Integrations'] = event.integrations;
  }

  // Timing/IDs group
  const timing = {};
  if (event.messageId) timing['Message ID'] = event.messageId;
  if (event.timestamp) timing['Timestamp'] = event.timestamp;
  if (Object.keys(timing).length > 0) {
    groupedParams['Message'] = timing;
  }

  return { sections, params: groupedParams };
}

// Helper: build overview for a Segment-spec parsed event
export function buildSegmentSpecOverview(parsed, event) {
  const overview = {};
  if (parsed.writeKey) overview['Write Key'] = parsed.writeKey;
  if (event.callType) overview['Call Type'] = event.callType;
  if (event.userId) overview['User ID'] = event.userId;
  if (event.anonymousId) overview['Anonymous ID'] = event.anonymousId;
  if (event.groupId) overview['Group ID'] = event.groupId;
  if (parsed.library) overview['Library'] = parsed.library;
  return overview;
}

// Parse the Segment CDN settings response — destinations configured
// for this source. Emits a single Segment event whose detail view
// renders a "Destinations configured" section, and whose
// `formatted.segmentDestinations` payload feeds Stack View Strategy A
// (the CDP itself told us what it loads — high confidence).
//
// Mirrors `parseGTMScriptLoad`'s async-getContent + fallback-emit
// pattern so a slow getContent doesn't drop the event entirely.
export function parseSegmentSettingsRequest(request) {
  const url = request.request.url;
  const requestMeta = getRequestMeta(request);
  const writeKey = extractSegmentWriteKey(url);
  const eventId = crypto.randomUUID();

  const baseEvent = {
    id: eventId,
    platform: 'segment',
    platformName: 'Segment',
    eventName: writeKey ? `Config: ${writeKey}` : 'Config',
    raw: { ...requestMeta },
    formatted: {
      type: 'CDP Config',
      writeKey,
      scriptUrl: url,
    },
  };

  let emitted = false;
  const emit = () => {
    if (emitted) return;
    emitted = true;
    _deps.addEvent(baseEvent);
  };
  const fallback = setTimeout(emit, 300);

  request.getContent((content, encoding) => {
    clearTimeout(fallback);
    if (content) {
      let text = content;
      if (encoding === 'base64') {
        try { text = atob(content); } catch { text = null; }
      }
      if (text) {
        const parsed = parseSegmentSettings(text);
        if (parsed) {
          baseEvent.eventName = writeKey
            ? `Config: ${writeKey} (${parsed.integrationCount} destination${parsed.integrationCount === 1 ? '' : 's'})`
            : `Config (${parsed.integrationCount} destination${parsed.integrationCount === 1 ? '' : 's'})`;
          baseEvent.formatted.segmentDestinations = parsed.destinations;
          baseEvent.formatted.consentCategories = parsed.consentCategories;
        }
      }
    }
    emit();
  });
}

// Parse the RudderStack sourceConfig response — destinations configured
// for this source. Same shape as the Segment settings handler; differs
// only in the parser called and the platform id emitted.
export function parseRudderStackSourceConfigRequest(request) {
  const url = request.request.url;
  const requestMeta = getRequestMeta(request);
  const eventId = crypto.randomUUID();

  const baseEvent = {
    id: eventId,
    platform: 'rudderstack',
    platformName: 'RudderStack',
    eventName: 'Config',
    raw: { ...requestMeta },
    formatted: {
      type: 'CDP Config',
      scriptUrl: url,
    },
  };

  let emitted = false;
  const emit = () => {
    if (emitted) return;
    emitted = true;
    _deps.addEvent(baseEvent);
  };
  const fallback = setTimeout(emit, 300);

  request.getContent((content, encoding) => {
    clearTimeout(fallback);
    if (content) {
      let text = content;
      if (encoding === 'base64') {
        try { text = atob(content); } catch { text = null; }
      }
      if (text) {
        const parsed = parseRudderStackSourceConfig(text);
        if (parsed) {
          baseEvent.eventName = parsed.sourceName
            ? `Config: ${parsed.sourceName} (${parsed.destinationCount} destination${parsed.destinationCount === 1 ? '' : 's'})`
            : `Config (${parsed.destinationCount} destination${parsed.destinationCount === 1 ? '' : 's'})`;
          baseEvent.formatted.rudderstackDestinations = parsed.destinations;
          baseEvent.formatted.writeKey = parsed.writeKey;
          baseEvent.formatted.sourceName = parsed.sourceName;
        }
      }
    }
    emit();
  });
}

// Parse the Hightouch sourceConfig response — destinations the SDK
// loads in-browser. Hightouch's browser SDK is a RudderStack fork; the
// JSON response has the exact same `source.destinations[*]` shape, so
// we reuse parseRudderStackSourceConfig directly. Only the platform tag
// + emitted event differ.
export function parseHightouchSourceConfigRequest(request) {
  const url = request.request.url;
  const requestMeta = getRequestMeta(request);
  const eventId = crypto.randomUUID();

  const baseEvent = {
    id: eventId,
    platform: 'hightouch',
    platformName: 'Hightouch',
    eventName: 'Config',
    raw: { ...requestMeta },
    formatted: {
      type: 'CDP Config',
      scriptUrl: url,
    },
  };

  let emitted = false;
  const emit = () => {
    if (emitted) return;
    emitted = true;
    _deps.addEvent(baseEvent);
  };
  const fallback = setTimeout(emit, 300);

  request.getContent((content, encoding) => {
    clearTimeout(fallback);
    if (content) {
      let text = content;
      if (encoding === 'base64') {
        try { text = atob(content); } catch { text = null; }
      }
      if (text) {
        const parsed = parseRudderStackSourceConfig(text);
        if (parsed) {
          baseEvent.eventName = parsed.sourceName
            ? `Config: ${parsed.sourceName} (${parsed.destinationCount} destination${parsed.destinationCount === 1 ? '' : 's'})`
            : `Config (${parsed.destinationCount} destination${parsed.destinationCount === 1 ? '' : 's'})`;
          baseEvent.formatted.hightouchDestinations = parsed.destinations;
          baseEvent.formatted.writeKey = parsed.writeKey;
          baseEvent.formatted.sourceName = parsed.sourceName;
        }
      }
    }
    emit();
  });
}

// Parse the mParticle config response — kits + pixels the SDK is set
// up to load. Same shape as the Segment / RudderStack settings handlers:
// emit a dedicated mParticle event whose detail view renders the kits
// section, and whose `formatted.mparticleDestinations` payload feeds
// Stack View Strategy A.
export function parseMparticleConfigRequest(request) {
  const url = request.request.url;
  const requestMeta = getRequestMeta(request);
  const apiKey = extractMparticleApiKey(url);
  const eventId = crypto.randomUUID();

  const baseEvent = {
    id: eventId,
    platform: 'mparticle',
    platformName: 'mParticle',
    eventName: apiKey ? `Config: ${apiKey}` : 'Config',
    raw: { ...requestMeta },
    formatted: {
      type: 'CDP Config',
      apiKey,
      scriptUrl: url,
    },
  };

  let emitted = false;
  const emit = () => {
    if (emitted) return;
    emitted = true;
    _deps.addEvent(baseEvent);
  };
  const fallback = setTimeout(emit, 300);

  request.getContent((content, encoding) => {
    clearTimeout(fallback);
    if (content) {
      let text = content;
      if (encoding === 'base64') {
        try { text = atob(content); } catch { text = null; }
      }
      if (text) {
        const parsed = parseMparticleConfig(text);
        if (parsed) {
          const kitCount = parsed.destinations.filter((d) => d.kind === 'kit').length;
          const pixelCount = parsed.destinations.filter((d) => d.kind === 'pixel').length;
          // Title prefers "kits" framing — that's mParticle's own
          // vocabulary and most users recognise it. Pixels (if any) are
          // surfaced inside the section, not summed into the headline.
          baseEvent.eventName = apiKey
            ? `Config: ${apiKey} (${kitCount} kit${kitCount === 1 ? '' : 's'}${pixelCount > 0 ? `, ${pixelCount} pixel${pixelCount === 1 ? '' : 's'}` : ''})`
            : `Config (${kitCount} kits${pixelCount > 0 ? `, ${pixelCount} pixels` : ''})`;
          baseEvent.formatted.mparticleDestinations = parsed.destinations;
          baseEvent.formatted.appName = parsed.appName;
        }
      }
    }
    emit();
  });
}

// Parse Segment request - uses shared Segment-spec parser
export function parseSegmentRequest(request, responseContent) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;
  const parsed = parseSegmentSpecRequestData(url, postData);
  const meta = getRequestMeta(request);

  if (parsed.events && parsed.events.length > 0) {
    parsed.events.forEach(event => {
      const { sections, params } = buildSegmentSpecFormatted(event);
      _deps.addEvent({
        platform: 'segment',
        platformName: 'Segment',
        eventName: event.eventName,
        raw: { ...meta, postData, event: event.rawEvent },
        formatted: {
          overview: buildSegmentSpecOverview(parsed, event),
          sections,
          params,
          parsedDisplayMode: 'table',
          detectedBy: parsed.detectedBy
        }
      });
    });
  } else {
    _deps.addEvent({
      platform: 'segment',
      platformName: 'Segment',
      eventName: '(request)',
      raw: { ...meta, postData },
      formatted: {
        overview: {},
        params: { note: 'Could not parse events from this request' },
        detectedBy: parsed.detectedBy
      }
    });
  }
}

// Parse RudderStack request - uses shared Segment-spec parser
export function parseRudderStackRequest(request, responseContent) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;
  const parsed = parseSegmentSpecRequestData(url, postData);
  const meta = getRequestMeta(request);

  if (parsed.events && parsed.events.length > 0) {
    parsed.events.forEach(event => {
      const { sections, params } = buildSegmentSpecFormatted(event);
      _deps.addEvent({
        platform: 'rudderstack',
        platformName: 'RudderStack',
        eventName: event.eventName,
        raw: { ...meta, postData, event: event.rawEvent },
        formatted: {
          overview: buildSegmentSpecOverview(parsed, event),
          sections,
          params,
          parsedDisplayMode: 'table',
          detectedBy: 'URL matches RudderStack API endpoint (Segment-compatible)'
        }
      });
    });
  } else {
    _deps.addEvent({
      platform: 'rudderstack',
      platformName: 'RudderStack',
      eventName: '(request)',
      raw: { ...meta, postData },
      formatted: {
        overview: {},
        params: { note: 'Could not parse events from this request' },
        detectedBy: 'URL matches RudderStack API endpoint (Segment-compatible)'
      }
    });
  }
}

// Parse Hightouch Events request - uses shared Segment-spec parser
export function parseHightouchRequest(request, responseContent) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;
  const parsed = parseSegmentSpecRequestData(url, postData);
  const meta = getRequestMeta(request);

  if (parsed.events && parsed.events.length > 0) {
    parsed.events.forEach(event => {
      const { sections, params } = buildSegmentSpecFormatted(event);
      _deps.addEvent({
        platform: 'hightouch',
        platformName: 'Hightouch',
        eventName: event.eventName,
        raw: { ...meta, postData, event: event.rawEvent },
        formatted: {
          overview: buildSegmentSpecOverview(parsed, event),
          sections,
          params,
          parsedDisplayMode: 'table',
          detectedBy: 'URL matches Hightouch Events endpoint (Segment-compatible)'
        }
      });
    });
  } else {
    _deps.addEvent({
      platform: 'hightouch',
      platformName: 'Hightouch',
      eventName: '(request)',
      raw: { ...meta, postData },
      formatted: {
        overview: {},
        params: { note: 'Could not parse events from this request' },
        detectedBy: 'URL matches Hightouch Events endpoint (Segment-compatible)'
      }
    });
  }
}

// Parse mParticle request - uses dedicated parser
export function parseMparticleRequest(request, responseContent) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;
  const parsed = parseMparticleRequestData(url, postData);
  const meta = getRequestMeta(request);

  if (parsed.events && parsed.events.length > 0) {
    parsed.events.forEach(event => {
      const overview = {};
      if (parsed.apiKey) overview['API Key'] = parsed.apiKey;
      if (parsed.environment) overview['Environment'] = parsed.environment;
      if (event.eventType) overview['Event Type'] = event.eventType;
      if (parsed.mpid) overview['MPID'] = parsed.mpid;
      if (parsed.mpDeviceId) overview['Device ID'] = parsed.mpDeviceId;

      // Show customer_id from user identities if available
      const customerId = parsed.userIdentities.customer_id || parsed.userIdentities.customerid;
      if (customerId) overview['Customer ID'] = customerId;

      // === Section structure follows standard layout ===
      // 1. Consent (collapsed) — consent signals if any
      // 2. Custom Data (expanded) — business data set by the team
      // 3. Parsed Data (expanded, via params) — all system/protocol data in groups

      const sections = [];

      // 1. Consent State (collapsed) — GDPR, CCPA signals
      if (parsed.consentState) {
        const consentData = {};
        for (const [framework, purposes] of Object.entries(parsed.consentState)) {
          if (purposes && typeof purposes === 'object') {
            for (const [purpose, details] of Object.entries(purposes)) {
              if (details && typeof details === 'object') {
                consentData[`${framework}.${purpose}`] = details.consented != null
                  ? (details.consented ? 'Consented' : 'Not Consented')
                  : details;
              }
            }
          }
        }
        if (Object.keys(consentData).length > 0) {
          sections.push({ title: 'Consent State', data: consentData, type: 'table', expanded: false });
        }
      }

      // 2. Custom Data (expanded) — custom_attributes + user_attributes grouped
      const customData = {};
      if (Object.keys(event.customAttributes).length > 0) {
        customData['Custom Attributes'] = event.customAttributes;
      }
      if (Object.keys(parsed.userAttributes).length > 0) {
        customData['User Attributes'] = parsed.userAttributes;
      }
      if (Object.keys(customData).length > 0) {
        sections.push({ title: 'Custom Data', data: customData, type: 'table' });
      }

      // 3. Parsed Data — all system/protocol data in logical groups (via params)
      const groupedParams = {};

      // Event group — per-event metadata
      if (Object.keys(event.eventData).length > 0) {
        groupedParams['Event'] = event.eventData;
      }

      // Identity group — user identities
      if (Object.keys(parsed.userIdentities).length > 0) {
        groupedParams['User Identities'] = parsed.userIdentities;
      }

      // Device & App group
      const deviceAppInfo = {};
      if (parsed.sdkVersion) deviceAppInfo['SDK Version'] = parsed.sdkVersion;
      for (const [key, value] of Object.entries(parsed.applicationInfo)) {
        deviceAppInfo[key] = value;
      }
      for (const [key, value] of Object.entries(parsed.deviceInfo)) {
        deviceAppInfo[key] = value;
      }
      if (Object.keys(deviceAppInfo).length > 0) {
        groupedParams['Device & App'] = deviceAppInfo;
      }

      // Context group — data plan, etc.
      if (parsed.context && Object.keys(parsed.context).length > 0) {
        groupedParams['Context'] = parsed.context;
      }

      _deps.addEvent({
        platform: 'mparticle',
        platformName: 'mParticle',
        eventName: event.eventName,
        raw: { ...meta, postData, event: event.rawEvent },
        formatted: {
          overview,
          sections,
          params: groupedParams,
          parsedDisplayMode: 'table',
          detectedBy: parsed.detectedBy
        }
      });
    });
  } else {
    _deps.addEvent({
      platform: 'mparticle',
      platformName: 'mParticle',
      eventName: '(request)',
      raw: { ...meta, postData },
      formatted: {
        overview: {},
        params: { note: 'Could not parse events from this request' },
        detectedBy: parsed.detectedBy
      }
    });
  }
}

// ========================================
// Request Routing (Phase 9)
// ========================================

// Helper to extract common request metadata (url, method, type, timing, initiator, HAR data)
function getRequestMeta(request) {
  // Get timestamps from HAR entry
  // startedDateTime = when request started (ISO 8601)
  // time = total elapsed time in milliseconds
  // finishedDateTime = startedDateTime + time (calculated)
  const now = Date.now();
  let startTimestamp = now;
  let finishTimestamp = now;
  let duration = 0;

  if (request.startedDateTime) {
    startTimestamp = new Date(request.startedDateTime).getTime();
    // HAR 'time' field contains total request duration in ms
    duration = request.time || 0;
    finishTimestamp = startTimestamp + duration;
  }

  // Extract initiator data from HAR entry (Chrome-specific _initiator field)
  // This tells us how/what loaded this request (parser, script, preload, etc.)
  const initiator = request._initiator || null;
  const initiatorType = getScriptInitiatorType(initiator);
  const initiatorUrl = getInitiatorUrl(initiator);

  // Extract HAR data for "Copy as HAR" export
  // Store the minimum needed to reconstruct a valid HAR entry
  const harData = {
    startedDateTime: request.startedDateTime || new Date(startTimestamp).toISOString(),
    time: duration,
    httpVersion: request.request.httpVersion || 'HTTP/1.1',
    requestHeaders: request.request.headers || [],
    requestHeadersSize: request.request.headersSize ?? -1,
    requestBodySize: request.request.bodySize ?? -1,
    responseStatus: request.response?.status || 0,
    responseStatusText: request.response?.statusText || '',
    responseHttpVersion: request.response?.httpVersion || 'HTTP/1.1',
    responseHeaders: request.response?.headers || [],
    responseHeadersSize: request.response?.headersSize ?? -1,
    responseBodySize: request.response?.bodySize ?? -1,
    responseContentSize: request.response?.content?.size ?? -1,
    responseContentMimeType: request.response?.content?.mimeType || '',
    timings: request.timings || { blocked: -1, dns: -1, connect: -1, send: 0, wait: 0, receive: 0, ssl: -1 },
    serverIPAddress: request.serverIPAddress || '',
    connection: request.connection || ''
  };

  return {
    url: request.request.url,
    method: request.request.method || 'GET',
    type: request._resourceType || request.type || 'unknown',
    timestamp: startTimestamp,      // When request started (for "Sort by Start")
    finishTimestamp: finishTimestamp, // When request finished (for "Sort by Finish")
    duration: duration,              // Request duration in ms
    // Initiator data (for script tree feature)
    initiator: initiator,
    initiatorType: initiatorType,
    initiatorUrl: initiatorUrl,
    // HAR entry data (for "Copy as HAR" export)
    _har: harData
  };
}

/**
 * Route a network request to the appropriate platform parser.
 * Called from panel.js's onRequestFinished listener wrapper.
 * @param {Object} request - Chrome DevTools HAR entry
 */
export function routeRequest(request) {
  const url = request.request.url;

  // Wrapper dispatch (Feature #76, absorbed into #79). When the topology
  // classifier decodes a Stape Custom Loader payload, the request's *real*
  // upstream is sgtm / gtag / gtm; route accordingly with the decoded payload
  // so the parsers extract the real measurement ID instead of the wrapper's
  // random path. The classifier already gated this on first-party-only, so a
  // positive `wrapper.platform` is a high-confidence signal.
  const wrapperTopology = classifyTopology(url, _deps.getCurrentPageHostname());
  if (wrapperTopology.wrapper) {
    const w = wrapperTopology.wrapper;
    const cnameInfo = {
      isCNAME: true,
      confidence: 'high',
      reason: `Decoded from Stape Custom Loader wrapper (${w.queryParam}) → ${w.pathname}`,
      isFirstParty: true,
      decoded: w,
    };
    if (w.platform === 'sgtm') {
      parseServerSideGA4Request(request, cnameInfo);
      return;
    }
    if (w.platform === 'gtag') {
      parseGTAGScriptLoad(request);
      return;
    }
    if (w.platform === 'gtm') {
      parseGTMScriptLoad(request);
      return;
    }
  }

  // Check for GA4 /g/collect endpoint
  // Detection priority:
  // 1. Standard GA4: google-analytics.com/g/collect or analytics.google.com/g/collect
  // 2. Server-Side GTM: First-party domain with /g/collect (same root domain as page)
  // 3. Third-party proxy: Different domain with /g/collect (not SS-GTM, just proxied GA4)
  try {
    const parsedUrl = parseUrlMemo(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();

    if (pathname.includes('/g/collect') || pathname.includes('/g/s/collect')) {
      // Check if this is a standard Google domain
      const isGoogleDomain = hostname.includes('google-analytics.com') ||
                             hostname.includes('analytics.google.com') ||
                             hostname.includes('googletagmanager.com');

      if (isGoogleDomain) {
        // Standard GA4 request to Google's servers
        parseGA4Request(request);
        return;
      }

      // Known SS-GTM/CNAME subdomain prefix — single source of truth lives in
      // shared/detection/topology.js (TRACKING_SUBDOMAIN_PREFIXES). The matcher
      // also enforces the BUG21 apex-rejection (no false positive on `stape.io`).
      const hasKnownPrefix = hasTrackingSubdomainPrefix(hostname) !== null;

      // Check if this is on the same top-level domain as the current page
      const currentPageHostname = _deps.getCurrentPageHostname();
      const isSameDomain = currentPageHostname && isSameRootDomain(hostname, currentPageHostname);

      // SS-GTM Detection:
      // - Same domain as current page with /g/collect = definitely SS-GTM
      // - Known tracking prefix (fpt., sgtm., etc.) with /g/collect = likely SS-GTM even if we can't verify domain
      if (isSameDomain || hasKnownPrefix) {
        let reason;
        let confidence;

        if (isSameDomain && hasKnownPrefix) {
          reason = `First-party tracking: ${hostname} with /g/collect`;
          confidence = 'high';
        } else if (isSameDomain) {
          reason = `Same-domain /g/collect endpoint on ${hostname}`;
          confidence = 'high';
        } else {
          // hasKnownPrefix but not same domain (or domain unknown)
          reason = `Known SS-GTM subdomain pattern: ${hostname.split('.')[0]}.*`;
          confidence = 'medium';
        }

        parseServerSideGA4Request(request, {
          isCNAME: true,
          confidence,
          reason,
          isFirstParty: isSameDomain
        });
        return;
      }

      // Not a Google domain and not detected as SS-GTM
      // Parse as regular GA4 (third-party proxy or unknown setup)
      parseGA4Request(request);
      return;
    }
  } catch (e) {
    // Ignore URL parsing errors
  }

  // Check for other CNAME tracking (non-GA4 first-party tracking)
  const currentPageHostname = _deps.getCurrentPageHostname();
  const cnameResult = detectCNAMETracking(url, currentPageHostname);
  if (cnameResult.isCNAME && cnameResult.suggestedPlatform === 'sgtm') {
    // First-party endpoint with GA4 params detected - route to SS-GTM parser
    parseServerSideGA4Request(request, {
      isCNAME: true,
      confidence: cnameResult.confidence,
      reason: cnameResult.reason,
      isFirstParty: true
    });
    return;
  }

  // Check for Google Consent Mode (CCM) endpoints (collect and form-data)
  if (url.includes('google.com/ccm/collect') || url.includes('google.com/ccm/form-data')) {
    parseGoogleCCMRequest(request);
    return;
  }

  // Check for Amplitude requests - multiple endpoint patterns (US and EU)
  if (AMPLITUDE_API_HOSTNAMES.some(h => url.includes(h)) ||
      url.includes('amplitude.com/2/httpapi') ||
      url.includes('amplitude.com/batch')) {
    request.getContent((content, encoding) => {
      parseAmplitudeRequest(request, content);
    });
    return;
  }

  // Check for Braze data-collection endpoint (rest.<cluster>.braze.com/api/v3/data/)
  if (url.includes('.braze.com/api/') || url.includes('.braze.eu/api/')) {
    parseBrazeRequest(request);
    return;
  }

  // Check for Grafana Faro frontend-observability collectors
  // (faro-collector-<env>-<region>.grafana.net/collect/<appKey>)
  if (/faro-collector-[a-z0-9-]+\.grafana\.net/i.test(url)) {
    parseGrafanaFaroRequest(request);
    return;
  }

  // Check for Facebook Pixel (includes /tr and /fr/ endpoints)
  if (url.includes('facebook.com/tr') || url.includes('facebook.net/tr') || url.includes('facebook.com/fr/')) {
    parseFacebookPixel(request);
    return;
  }

  // Check for Google Ads Conversion tracking
  if (url.match(/\/pagead\/(?:conversion|viewthroughconversion|1p-conversion|conversion_async)\//)) {
    parseGoogleAdsConversion(request);
    return;
  }

  // Check for Google Ads Remarketing
  if (url.match(/\/pagead\/(?:landing|1p-user-list)(?:\/|$)/)) {
    parseGoogleAdsRemarketing(request);
    return;
  }

  // Check for TikTok Pixel
  if (url.includes('analytics.tiktok.com') || url.includes('tiktok.com/i18n/pixel')) {
    parseTikTokPixel(request);
    return;
  }

  // Check for LinkedIn Insight Tag
  if (url.includes('px.ads.linkedin.com') || url.includes('linkedin.com/px')) {
    parseLinkedInPixel(request);
    return;
  }

  // Check for Snapchat Pixel (skip config/SDK script loads like /config/{region}/{pixelId}.js)
  if ((url.includes('tr.snapchat.com') || url.includes('tr6.snapchat.com') ||
      url.includes('gcp.api.snapchat.com')) && !isJavaScriptFileUrl(url)) {
    parseSnapchatPixel(request);
    return;
  }

  // Check for Salesforce Marketing Cloud (igodigital/Collect)
  if (url.includes('collect.igodigital.com') || url.includes('.igodigital.com/collect') ||
      url.includes('evergage.com')) {
    parseSalesforceMarketing(request);
    return;
  }

  // Check for PostHog API endpoints (event capture, flags, decide)
  // PostHog script loads are handled by KNOWN_SCRIPT_LOADS registry (detectKnownScriptLoad)
  // Endpoints: us.i.posthog.com, eu.i.posthog.com, app.posthog.com, t.posthog.com
  if (url.includes('.posthog.com/') || url.includes('posthog.com/')) {
    const posthogPath = parseUrlMemo(url).pathname.toLowerCase();
    const isPostHogAPI = posthogPath === '/e' || posthogPath === '/e/' ||
                         posthogPath.startsWith('/capture') ||
                         posthogPath.startsWith('/batch') ||
                         posthogPath.startsWith('/flags') ||
                         posthogPath.startsWith('/decide') ||
                         posthogPath.startsWith('/i/v0/e');
    if (isPostHogAPI) {
      request.getContent((content) => {
        parsePostHogRequest(request, content);
      });
      return;
    }
  }

  // Check for Mixpanel
  // Endpoints: api.mixpanel.com, api-eu.mixpanel.com, api-in.mixpanel.com
  if (url.includes('mixpanel.com/track') || url.includes('mixpanel.com/engage') || url.includes('mixpanel.com/import')) {
    request.getContent((content) => {
      parseMixpanelRequest(request, content);
    });
    return; // Don't continue to generic detection
  }

  // Check for Piwik PRO (must come BEFORE generic Matomo check)
  // Endpoints: *.piwik.pro/ppms.php, *.piwik.pro/piwik.php (deprecated)
  if (url.includes('piwik.pro/ppms.php') || url.includes('piwik.pro/piwik.php')) {
    parsePiwikProRequest(request);
    return;
  }

  // Check for Matomo / Piwik
  // Endpoints: *.matomo.cloud/matomo.php, any domain with /matomo.php or /piwik.php
  if (url.includes('/matomo.php') || url.includes('/piwik.php')) {
    parseMatomoRequest(request);
    return;
  }

  // Check for Segment CDN settings — destinations config endpoint.
  // Endpoint: cdn.segment.com/v1/projects/{writeKey}/settings (also cdn.segment.io)
  // Listed BEFORE the api/events Segment check so the settings URL doesn't
  // accidentally fall through. Yields a dedicated event with the parsed
  // destinations attached to formatted.segmentDestinations — feeds both
  // the event detail "Destinations configured" section and Stack View
  // Strategy A.
  if (isSegmentSettingsUrl(url)) {
    parseSegmentSettingsRequest(request);
    return;
  }

  // Check for Segment
  // Endpoints: api.segment.io/v1/*, events.segment.io/v1/*
  if ((url.includes('api.segment.io/') || url.includes('api.segment.com/') || url.includes('events.segment.io/') || url.includes('events.segment.com/')) &&
      !url.includes('/analytics.js')) {
    request.getContent((content) => {
      parseSegmentRequest(request, content);
    });
    return;
  }

  // Check for RudderStack sourceConfig — destinations config endpoint.
  // Endpoint: {dataplane}/sourceConfig?p={writeKey}&v={version}
  // Same role as Segment settings: emits a dedicated event with the
  // parsed destinations attached to formatted.rudderstackDestinations.
  if (isRudderStackSourceConfigUrl(url)) {
    parseRudderStackSourceConfigRequest(request);
    return;
  }

  // Check for RudderStack (Segment-compatible API)
  // Endpoints: *.dataplane.rudderstack.com/v1/*, api.rudderstack.com/v1/*, api.rudderlabs.com/v1/*
  if ((url.includes('rudderstack.com/v1/') || url.includes('rudderlabs.com/v1/')) &&
      !url.includes('/rsa.min.js')) {
    request.getContent((content) => {
      parseRudderStackRequest(request, content);
    });
    return;
  }

  // Check for Hightouch sourceConfig — destinations the SDK is set up
  // to load. Listed BEFORE the regular Hightouch tracking-events check
  // so the /sourceConfig URL doesn't accidentally fall through. The
  // Hightouch SDK is a RudderStack fork — same response shape — so
  // we reuse parseRudderStackSourceConfig as the body parser.
  if (isHightouchSourceConfigUrl(url)) {
    parseHightouchSourceConfigRequest(request);
    return;
  }

  // Check for Hightouch Events (Segment-compatible API)
  // Endpoints: *.hightouch-events.com/v1/*, events.hightouch.io/v1/*
  if (url.includes('hightouch-events.com/v1/') || url.includes('events.hightouch.io/v1/')) {
    request.getContent((content) => {
      parseHightouchRequest(request, content);
    });
    return;
  }

  // Check for mParticle config endpoint — kits + pixels the SDK is set
  // up to load. Listed BEFORE the regular mParticle event check so the
  // /config URL doesn't accidentally fall through to the events parser.
  // Default URL: jssdkcdns.mparticle.com/JS/v2/{apiKey}/config (also
  // matches self-hosted variants — the path shape is the signature).
  if (isMparticleConfigUrl(url)) {
    parseMparticleConfigRequest(request);
    return;
  }

  // Check for mParticle
  // Standard: jssdks.mparticle.com, s2s.mparticle.com
  // CNAME/proxy: any domain with /JS/<mparticle-api-key>/events path
  // API key format: region prefix (eu1-, us1-, us2-, au1-) + 32-char hex
  {
    const isMparticleDomain = url.includes('mparticle.com') && !url.endsWith('.js');
    // F6: test the anchored signature against the parsed pathname (shared
    // constant), not the full URL — a hex run in a query string can't match.
    let isMparticlePath = false;
    try { isMparticlePath = MPARTICLE_CNAME_EVENTS_PATH_RE.test(new URL(url).pathname); }
    catch (e) { /* malformed URL — not mParticle */ }
    if (isMparticleDomain || isMparticlePath) {
      request.getContent((content) => {
        parseMparticleRequest(request, content);
      });
      return;
    }
  }

  // Check for Adobe Experience Platform (Web SDK / Alloy)
  // Pattern: /ee/v2/interact or /ee/v2/collect on adobedc.net (must be
  // before Adobe Analytics check). For /interact specifically we also
  // capture the response body so audience-activation destinations
  // dispatched by the Edge Network can be surfaced in Stream and feed
  // Stack View Strategy A.
  if (url.includes('/ee/') && url.includes('adobedc.net')) {
    if (isAepInteractUrl(url)) {
      request.getContent((content) => {
        parseAdobeAEPRequest(request, content);
      });
    } else {
      parseAdobeAEPRequest(request);
    }
    return;
  }

  // Check for Adobe Analytics (Omniture)
  // Pattern: /b/ss/ or /i.gif with specific path structure
  if (url.includes('/b/ss/') ||
      (url.includes('/i.gif') && (url.includes('2o7.net') || url.includes('omtrdc.net') || url.includes('adobedc.net')))) {
    parseAdobeAnalyticsRequest(request);
    return;
  }

  // Also check for first-party Adobe Analytics (collect.* subdomain with i.gif)
  // Exclude Tealium Collect pattern: collect.domain.com/{account}/{profile}/{number}/i.gif
  try {
    const parsedUrl = parseUrlMemo(url);
    if (parsedUrl.hostname.startsWith('collect.') && parsedUrl.pathname.endsWith('/i.gif')) {
      // Tealium Collect: path has exactly /{account}/{profile}/{number}/i.gif (4 segments)
      const isTealiumCollect = /^\/[^/]+\/[^/]+\/\d+\/i\.gif$/.test(parsedUrl.pathname);
      if (!isTealiumCollect) {
        parseAdobeAnalyticsRequest(request);
        return;
      }
    }
  } catch (e) {
    // Ignore URL parsing errors
  }

  // Check for Tealium Collect (collect.tealiumiq.com or first-party CNAME collect)
  if (url.includes('collect.tealiumiq.com') ||
      url.includes('/vdata/i.gif') ||
      /collect-[a-z]+-\d+\.tealiumiq\.com/.test(url)) {
    request.getContent((content) => {
      parseTealiumCollectRequest(request, content);
    });
    return;
  }
  // First-party CNAME Tealium Collect: collect.domain.com/{account}/{profile}/{number}/i.gif
  try {
    const parsedUrl = parseUrlMemo(url);
    if (parsedUrl.hostname.startsWith('collect.') &&
        /^\/[^/]+\/[^/]+\/\d+\/i\.gif$/.test(parsedUrl.pathname)) {
      request.getContent((content) => {
        parseTealiumCollectRequest(request, content);
      });
      return;
    }
  } catch (e) {
    // Ignore URL parsing errors
  }

  // Check for Adobe Target (Delivery API)
  // Patterns: .tt.omtrdc.net, /rest/v1/delivery, /rest/v2/batchmbox, /mbox/json, mboxedge
  if (url.includes('.tt.omtrdc.net') ||
      url.includes('/rest/v1/delivery') ||
      url.includes('/rest/v2/batchmbox') ||
      url.includes('/mbox/json') ||
      url.includes('mboxedge')) {
    parseAdobeTargetRequest(request);
    return;
  }

  // Check for Adobe Audience Manager (Demdex)
  // Patterns: demdex.net (DPM, DCS, fast endpoints)
  if (url.includes('demdex.net')) {
    parseAdobeAAMRequest(request);
    return;
  }

  // Check for GTM health-check ping (gtm.js?id=...&gtg_health=1) — separate platform.
  // Must come before the plain gtm.js check below since the URL also matches that pattern.
  if (url.includes('googletagmanager.com/gtm.js') && isGTMHealthPing(url)) {
    parseGTMHealthPing(request);
    return;
  }

  // Check for GTM / GTAG script load (googletagmanager.com or custom domain).
  // Topology classifier handles the custom-domain case via its `loaderHint`
  // field — single shared implementation in shared/detection/topology.js.
  // Reuses `wrapperTopology` computed earlier in this function (same URL,
  // same pageHostname) so the classifier only runs once per request.
  if (url.includes('googletagmanager.com/gtm.js') || wrapperTopology.loaderHint === 'gtm') {
    parseGTMScriptLoad(request);
    return;
  }
  if (url.includes('googletagmanager.com/gtag/js') || wrapperTopology.loaderHint === 'gtag') {
    parseGTAGScriptLoad(request);
    return;
  }

  // Check for other known marketing/analytics script loads
  const scriptLoadMatch = detectKnownScriptLoad(url, request);
  if (scriptLoadMatch) {
    parseKnownScriptLoad(request, scriptLoadMatch);
    return;
  }

  // Check for GTM Analytics/Logging endpoint (googletagmanager.com/a)
  // This is GTM's internal telemetry that sends performance and tag execution data
  if (url.includes('googletagmanager.com/a?') || url.includes('googletagmanager.com/a/')) {
    parseGTMAnalyticsRequest(request);
    return;
  }

  // Check for Bing / Microsoft UET
  if (url.includes('bat.bing.com') || url.includes('bat.r.msn.com') || url.includes('bing.com/action/0')) {
    parseBingAdsRequest(request);
    return;
  }

  // Check for Twitter/X Pixel (analytics endpoint, not static JS)
  if ((url.includes('analytics.twitter.com') || url.includes('t.co/i/adsct')) && !isJavaScriptFileUrl(url)) {
    parseTwitterPixelRequest(request);
    return;
  }

  // Check for Pinterest Tag
  if (url.includes('ct.pinterest.com')) {
    parsePinterestTagRequest(request);
    return;
  }

  // Check for HubSpot tracking pixel
  if (url.includes('track.hubspot.com/__pt')) {
    parseHubSpotRequest(request);
    return;
  }

  // Check for Criteo OneTag (event tracking, not static JS)
  if ((url.includes('dis.criteo.com') || url.includes('sslwidget.criteo.com') ||
       url.includes('.criteo.com/rm') || url.includes('cat.criteo.com')) && !isJavaScriptFileUrl(url)) {
    parseCriteoRequest(request);
    return;
  }

  // Check for Snowplow (collector endpoints: /com.snowplowanalytics.snowplow/tp2 or /i?aid=)
  // Must be before generic detection since Snowplow uses custom domains
  {
    try {
      const parsedUrl = parseUrlMemo(url);
      const isSnowplowPath = parsedUrl.pathname.includes('/com.snowplowanalytics.snowplow/');
      const isSnowplowGET = parsedUrl.pathname === '/i' && parsedUrl.searchParams.has('aid');
      if (isSnowplowPath || isSnowplowGET) {
        request.getContent((content) => {
          parseSnowplowRequest(request, content);
        });
        return;
      }
    } catch (e) { /* ignore URL parse errors */ }
  }

  // Check for Optimizely event logging
  if (url.includes('logx.optimizely.com/v1/events')) {
    request.getContent((content) => {
      parseOptimizelyRequest(request, content);
    });
    return;
  }

  // Check for Heap Analytics API endpoints (not CDN/script loads)
  if ((url.includes('heap-api.com') || url.includes('heapanalytics.com/api') || url.includes('heap.io/api')) && !isJavaScriptFileUrl(url)) {
    request.getContent((content) => {
      parseHeapRequest(request, content);
    });
    return;
  }

  // Check for Pendo API endpoints (not CDN/script loads)
  if ((url.includes('data.pendo.io') || url.includes('app.pendo.io/data')) && !isJavaScriptFileUrl(url)) {
    request.getContent((content) => {
      parsePendoRequest(request, content);
    });
    return;
  }

  // Check for Piano Analytics (not CDN/script loads)
  if ((url.includes('pa.piano.io') || url.includes('xiti.com') || url.includes('at-o.net')) && !isJavaScriptFileUrl(url)) {
    parsePianoAnalyticsRequest(request);
    return;
  }

  // Adobe Experience Platform (Web SDK / Alloy) — first-party-proxied Edge Network (Feature #147).
  // The line-2845 block only catches the Adobe-hosted edge (adobedc.net). When a
  // site CNAME-proxies the edge onto its own apex and/or customises the base path
  // (e.g. business.adobe.com/experienceedge/irl1/v1/collect), the request misses
  // the registry on host, base-path, AND API-version simultaneously. Identify it
  // by the Alloy XDM body shape (host-/path-/version-independent) and route to the
  // rich parser so the full XDM breakdown is restored. This MUST run before the
  // config-driven routing below: the /ee/v1 registry Extend (commit 4c9359ff) makes
  // matchKnownEndpoint match the default-base-path proxied case, but config routing
  // deliberately excludes customParser platforms — so without this block the request
  // is relabelled AEP yet rendered as a generic flat-params event (no Page Context /
  // Commerce / Identity / Personalization sections). Routing here also runs before
  // the per-hostname fingerprint cache in parseUnknownTrackingRequest, so the cache
  // can't mis-serve AEP on a first-party apex shared with the whole site.
  if (request.request.postData?.text) {
    let alloyBody = null;
    try { alloyBody = JSON.parse(request.request.postData.text); } catch { /* not JSON */ }
    if (alloyBody && isAlloyEdgePayload(alloyBody)) {
      // Use a generic /interact path check (not isAepInteractUrl, whose regex is
      // pinned to /ee/v{N}/interact) so a custom-base-path proxied interact still
      // captures response content for audience-activation destinations. The body is
      // already confirmed Alloy, so the broader path check carries no extra risk.
      let isInteract = false;
      try { isInteract = parseUrlMemo(url).pathname.includes('/interact'); } catch { /* malformed URL */ }
      if (isInteract) {
        request.getContent((content) => {
          parseAdobeAEPRequest(request, content);
        });
      } else {
        parseAdobeAEPRequest(request);
      }
      return;
    }
  }

  // Config-driven routing: check if URL matches a known endpoint with parsing config
  const { matched: configMatched, endpoint: configEndpoint } = matchKnownEndpoint(url);
  if (configMatched && configEndpoint?.parsing && !configEndpoint.parsing.customParser) {
    parseConfiguredRequest(request, configEndpoint);
    return;
  }

  // Custom endpoint match: user-defined tools without parsing config
  // Handle these explicitly so they don't fall through to "unknown tracking" detection
  if (configMatched && configEndpoint?.isCustom) {
    parseCustomEndpointRequest(request, configEndpoint);
    return;
  }

  // Generic tracking detection for unknown platforms
  // Only check if we haven't matched any known platform above
  if (isUnknownTrackingRequest(url, request)) {
    parseUnknownTrackingRequest(request);
  }
}

// Check if a URL is a tracking request that we haven't explicitly handled
export function isUnknownTrackingRequest(url, request) {
  // Skip document requests (page navigations) - these aren't tracking requests
  // even if they have UTM parameters or tracking-like query strings
  const requestType = request?._resourceType || request?.type;
  if (requestType === 'document') {
    return false;
  }

  // BUG23: browser-chrome static paths are never tracking, regardless of resource
  // type or query params. Favicons in particular can arrive with `resourceType`
  // 'other' (or unset), bypassing the NON_TRACKING_RESOURCE_TYPES gate below, and
  // a cache-buster like `?v=1` matches CNAME_QUERY_PATTERNS.v= — classifying the
  // favicon as 1st-party-proxy. Reject these paths by exact match before any
  // further classification runs.
  const NON_TRACKING_PATHS = new Set([
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    '/sitemap-index.xml',
    '/apple-touch-icon.png',
    '/apple-touch-icon-precomposed.png',
  ]);
  try {
    const pathname = parseUrlMemo(url).pathname.toLowerCase();
    if (NON_TRACKING_PATHS.has(pathname)) {
      return false;
    }
  } catch { /* invalid URL — fall through */ }

  // Also check response content-type for HTML pages (fallback for cases where
  // requestType isn't reliably set). Only apply to GET requests without a body —
  // tracking endpoints can legitimately POST JSON and receive HTML acknowledgements
  // (e.g. Stape Data Tag's /main returns text/html), so don't filter those out.
  if (request?.request?.method === 'GET' && !request?.request?.postData?.text) {
    try {
      const contentType = request?.response?.content?.mimeType ||
        request?.response?.headers?.find(h => h.name.toLowerCase() === 'content-type')?.value || '';
      if (contentType.includes('text/html')) {
        return false;
      }
    } catch (e) {
      // Ignore
    }
  }

  // Skip if it's a known platform we already handled above
  const knownPlatformsHandled = [
    'google-analytics.com',
    'analytics.google.com',
    'amplitude.com',
    'facebook.com/tr',
    'facebook.net/tr',
    'facebook.com/fr/',
    // Google Ads conversion tracking (narrowed patterns)
    '/pagead/conversion/',
    '/pagead/viewthroughconversion/',
    '/pagead/1p-conversion/',
    'tiktok.com',
    'linkedin.com',
    'posthog.com',
    'mixpanel.com',
    // Adobe Analytics (use specific subdomains to avoid blocking Adobe Target which uses .tt.omtrdc.net)
    '/b/ss/',
    '2o7.net',
    '.sc.omtrdc.net',  // Adobe Analytics uses sc.omtrdc.net (not tt.omtrdc.net which is Target)
    'adobedc.net',
    // Google CCM
    '/ccm/collect',
    '/ccm/form-data'
  ];

  // Skip if already handled
  for (const pattern of knownPlatformsHandled) {
    if (url.includes(pattern)) {
      return false;
    }
  }

  // Skip SS-GTM domains (handled above)
  try {
    const parsedUrl = parseUrlMemo(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();

    // Skip first-party tracking subdomains with /g/collect (handled as SS-GTM).
    // Uses the canonical prefix set from shared/detection/topology.js — the
    // pre-#79 ssgtmPrefixes list was an 11-entry strict subset of the broader
    // tracking-subdomain set; broadening here is conservative (more SS-GTM-shape
    // requests get correctly skipped from the unknown-tracking pass).
    if (pathname.includes('/g/collect') || pathname.includes('/g/s/collect')) {
      if (hasTrackingSubdomainPrefix(hostname) !== null) {
        return false;
      }
    }
    // Skip collect.* subdomains with i.gif (Adobe first-party), but not Tealium Collect
    const isTealiumCollectPath = /^\/[^/]+\/[^/]+\/\d+\/i\.gif$/.test(pathname);
    if (hostname.startsWith('collect.') && pathname.endsWith('/i.gif') && !isTealiumCollectPath) {
      return false;
    }
  } catch (e) {
    // Ignore
  }

  // Check against known endpoints list (platforms we recognize but don't have full parsers for)
  const { matched } = matchKnownEndpoint(url);
  if (matched) {
    return true; // It's a known tracking endpoint we should show
  }

  // First-party CNAME bypass: tracking subdomains may use bespoke paths (e.g. Stape
  // Data Tag's /main, custom sGTM clients) that don't match GENERIC_TRACKING_PATTERNS.
  // Let them through so parseUnknownTrackingRequest can run CNAME detection and the
  // structural fingerprinter on the body.
  //
  // Resource-type gate (BUG18): the bypass only makes sense for request types that can
  // actually carry tracking payloads. Static-asset types (font/stylesheet/media/manifest)
  // on the page's own domain are content, never tracking — and CNAME's query-pattern
  // checks can false-positive on cache-busters like ?v=3.124.6.
  // Canonical Chrome DevTools Protocol Network.ResourceType values that can never
  // carry first-party tracking payloads. Both hyphenated and concatenated spellings
  // are listed because DevTools has used both across Chrome versions.
  // `script` and `image` were added in v1.3.0 (BUG21) — a vendor's own JS bundle
  // or marketing image served from their own domain is content, not tracking.
  // The trade-off accepted: rare JSONP-style first-party trackers that ride a
  // `script` resourceType will no longer be auto-classified via the CNAME bypass,
  // which is the correct conservative behaviour given that all 60 false-positives
  // on the stape.io marketing site were exactly this content-as-tracking shape.
  const NON_TRACKING_RESOURCE_TYPES = new Set([
    'font', 'stylesheet', 'media', 'manifest', 'texttrack',
    'websocket', 'eventsource', 'wasm',
    'signed-exchange', 'signedexchange',
    'preflight',
    'csp-violation-report', 'cspviolationreport',
    'script', 'image',
  ]);
  if (!NON_TRACKING_RESOURCE_TYPES.has(requestType)) {
    try {
      const pageHostname = _deps.getCurrentPageHostname();
      if (pageHostname && detectCNAMETracking(url, pageHostname).isCNAME) {
        return true;
      }
    } catch { /* fall through to generic check */ }
  }

  // Check if it looks like a generic tracking request
  return isGenericTrackingRequest(url);
}

// Config-driven parser: uses shared parseConfiguredRequestData for extraction
function parseConfiguredRequest(request, endpoint) {
  const url = request.request.url;
  const postData = request.request.postData?.text || null;

  // Use shared parser for config-driven extraction
  const parsed = parseConfiguredRequestData(url, postData, endpoint);

  // Determine if this is a script load based on:
  // 1. Browser reports type='script' AND
  // 2. URL is actually a .js file (not a JSONP tracking beacon)
  const requestMeta = getRequestMeta(request);
  const isActualScriptLoad = requestMeta.type === 'script' && isJavaScriptFileUrl(url);

  _deps.addEvent({
    platform: endpoint.id,
    platformName: endpoint.name,
    eventName: parsed.eventName,
    isScriptLoad: isActualScriptLoad,
    raw: {
      ...requestMeta,
      params: parsed.rawParams,
      postData: parsed.postData
    },
    formatted: {
      overview: parsed.overview,
      params: parsed.params,
      tags: parsed.wasDecoded ? ['Decoded'] : [],
      detectedBy: parsed.detectedBy,
      // Include script load info if this is a script
      ...(isActualScriptLoad && {
        scriptUrl: url,
        initiatorType: requestMeta.initiatorType,
        initiatorUrl: requestMeta.initiatorUrl
      })
    }
  });
}

// Parse custom endpoint request — user-defined tools that matched by domain/path
// These are flagged with isCustomEndpoint so the scripts filter doesn't hide them
// from Stream view (the user explicitly set up this endpoint to track these requests)
function parseCustomEndpointRequest(request, endpoint) {
  const url = request.request.url;
  const info = extractUnknownTrackingInfo(url);
  const eventName = info.eventName || info.pathname.split('/').pop() || 'Request';
  const requestMeta = getRequestMeta(request);
  const isActualScriptLoad = requestMeta.type === 'script' && isJavaScriptFileUrl(url);

  // Collect params from query string and POST body
  let params = info.params;
  let postData = null;
  if (request.request.postData?.text) {
    postData = request.request.postData.text;
    try {
      const parsed = JSON.parse(postData);
      if (typeof parsed === 'object') {
        params = { ...params, ...parsed };
      }
    } catch {
      try {
        const urlParams = new URLSearchParams(postData);
        for (const [key, value] of urlParams.entries()) {
          params[key] = value;
        }
      } catch { /* leave as-is */ }
    }
  }

  const { data: decodedParams, wasDecoded } = decodeBase64InObject(params);

  _deps.addEvent({
    platform: endpoint.id,
    platformName: endpoint.name,
    eventName: eventName,
    isScriptLoad: isActualScriptLoad,
    isCustomEndpoint: true,
    raw: {
      ...requestMeta,
      params: info.params,
      postData: postData
    },
    formatted: {
      params: Object.keys(decodedParams).length > 0 ? decodedParams : null,
      wasDecoded: wasDecoded,
      _meta: {
        hostname: info.hostname,
        pathname: info.pathname,
        category: endpoint.category,
        isKnownPlatform: true
      },
      detectedBy: `Custom endpoint: ${endpoint.name}`,
      ...(isActualScriptLoad && {
        scriptUrl: url,
        initiatorType: requestMeta.initiatorType,
        initiatorUrl: requestMeta.initiatorUrl
      })
    }
  });
}

// Parse unknown tracking request
function parseUnknownTrackingRequest(request) {
  const url = request.request.url;
  const { matched, endpoint } = matchKnownEndpoint(url);

  // Feature #80 — supplier annotation. `metaCapiSupplier` is filled in below
  // when the structural-fingerprint pass identifies a CAPI partner_agent stamp;
  // `hostSupplier` captures host-pattern matches (Stape, TAGGRS) here at the
  // top of the function. Both feed into the final formatted.supplier output.
  let hostSupplier = null;

  // Feature #65 / #80: page-level supplier inference. When a request hits a
  // known supplier's host (Stape `*.stape.{io,be,dog}`, TAGGRS `*.taggrs.io`,
  // etc.), record into page-level state so cross-event inference can annotate
  // subsequent events. Stape-specific state.stapeHosts is preserved for back-
  // compat; non-Stape suppliers ride on the per-event `formatted.supplier`
  // field for now (full state generalisation is a follow-up).
  try {
    const requestHostname = parseUrlMemo(url).hostname.toLowerCase();
    hostSupplier = matchSupplierHost(requestHostname);
    if (hostSupplier === 'stape' && _deps.recordStapeHost) {
      _deps.recordStapeHost(requestHostname);
      if (_deps.recordStapePage) {
        _deps.recordStapePage(_deps.getCurrentPageHostname());
      }
    }
  } catch { /* invalid URL — ignore */ }

  let platformId = 'other';
  let platformName = 'Unknown';
  let category = 'unknown';
  let detectedBy = 'Generic tracking pattern detected';
  let metaCapiSupplier = null;

  // If it matches a known endpoint, use that info
  if (matched && endpoint) {
    platformId = endpoint.id;
    platformName = endpoint.name;
    category = endpoint.category;
    // Find which pattern matched
    const matchedPattern = endpoint.patterns.find(p =>
      typeof p === 'string' ? url.toLowerCase().includes(p.toLowerCase()) : p.test(url)
    );
    detectedBy = `URL matches known pattern: ${matchedPattern || endpoint.patterns[0]}`;
  } else {
    // Check for first-party/CNAME tracking patterns
    const currentPageHostname = _deps.getCurrentPageHostname();
    const cnameResult = detectCNAMETracking(url, currentPageHostname);
    if (cnameResult.isCNAME) {
      // Detected as first-party tracking
      platformId = cnameResult.suggestedPlatform || '1st-party-proxy';
      platformName = _deps.PLATFORM_NAMES[platformId] || '1st Party Proxy';
      category = 'first-party-collection';
      detectedBy = `First-party tracking detected: ${cnameResult.reason}`;
    }
  }

  // Structural fingerprinting — if still unknown OR a generic 1st-party-proxy classification,
  // check payload signatures so distinctive markers (e.g. Stape Data Tag's _dcid_temp) can refine
  // a CNAME match into a named platform.
  let fingerprintResult = null;
  if (platformId === 'other' || platformId === '1st-party-proxy') {
    // Parse POST body for fingerprint checks
    let parsedBody = null;
    if (request.request.postData?.text) {
      try { parsedBody = JSON.parse(request.request.postData.text); } catch { /* not JSON */ }
    }
    fingerprintResult = identifyUnknownRequest(url, parsedBody);
    if (fingerprintResult) {
      platformId = fingerprintResult.platformId;
      platformName = _deps.PLATFORM_NAMES[platformId] || fingerprintResult.platformId;
      category = _deps.getPlatformCategory ? _deps.getPlatformCategory(platformId) : 'analytics';
      detectedBy = `Structural fingerprint: ${fingerprintResult.reason}`;

      // Feature #80 — supplier registry-driven Meta CAPI Gateway annotation.
      // When the CAPI Gateway fingerprint (Feature #64) hits, consult the
      // supplier registry for a `partner_agent` stamp match. Stape's
      // `stape-gtmss-X.Y.Z[-ee]` and Addingwell's `gtmss-addingwell-X.Y.Z`
      // share this field with different prefixes; the registry distinguishes
      // them. The Stape branch records into state.stapeHosts so cross-event
      // inference works (Addingwell doesn't have an equivalent state field
      // yet — follow-up generalisation per #80's state migration).
      if (fingerprintResult.platformId === 'facebook' && parsedBody) {
        const supplierId = matchSupplierStamp('meta-capi', null, parsedBody);
        if (supplierId === 'stape' && _deps.recordStapeHost) {
          try { _deps.recordStapeHost(parseUrlMemo(url).hostname); } catch { /* ignore */ }
          if (_deps.recordStapePage) {
            _deps.recordStapePage(_deps.getCurrentPageHostname());
          }
        }
        // Annotate the current event directly — both Stape and Addingwell
        // (and any future supplier shipping a CAPI partner_agent) flow through
        // this path. Note: `metaCapiSupplier` is consumed below when building
        // the formatted output for this event.
        if (supplierId) {
          metaCapiSupplier = supplierId;
        }
      }
    }
  }

  // Feature #65: when a Stape Data Tag fingerprint matches, record both the request
  // host and the current page host so sgtm events on either domain get annotated.
  if (platformId === 'stape-data-tag' && _deps.recordStapeHost) {
    try { _deps.recordStapeHost(parseUrlMemo(url).hostname); } catch { /* ignore */ }
    if (_deps.recordStapePage) {
      _deps.recordStapePage(_deps.getCurrentPageHostname());
    }
  }

  // Extract info from the request
  const info = extractUnknownTrackingInfo(url);
  const eventName = info.eventName || info.pathname.split('/').pop() || 'Request';

  // Get query params
  let params = info.params;

  // Try to get POST body if available
  let postData = null;
  if (request.request.postData?.text) {
    postData = request.request.postData.text;
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(postData);
      if (typeof parsed === 'object') {
        params = { ...params, ...parsed };
      }
    } catch (e) {
      // Not JSON, try URL-encoded
      try {
        const urlParams = new URLSearchParams(postData);
        for (const [key, value] of urlParams.entries()) {
          params[key] = value;
        }
      } catch (e2) {
        // Leave as-is
      }
    }
  }

  // Try to decode Base64 encoded values in params
  const { data: decodedParams, wasDecoded } = decodeBase64InObject(params);

  // Determine if this is a script load based on:
  // 1. Browser reports type='script' AND
  // 2. URL is actually a .js file (not a JSONP tracking beacon)
  const requestMeta = getRequestMeta(request);
  const isActualScriptLoad = requestMeta.type === 'script' && isJavaScriptFileUrl(url);

  // BUG53 — first-party / reverse-proxied GTM container loader. The standard
  // loader (googletagmanager.com/gtm.js?id=GTM-XXXX) and GTM Telemetry
  // (/a?id=GTM-XXXX) both match the registry before reaching here, so only a
  // container served from a first-party path (e.g. /fpsb/?id=GTM-XXXX) lands in
  // this fallthrough. The container-ID query param is a host-agnostic GTM signal;
  // gate on a `script` resource so a beacon that merely echoes a container ID
  // can't be misclassified as the loader.
  if (platformId === 'other' && requestMeta.type === 'script') {
    const gtmContainerId = extractGtmContainerId(url);
    if (gtmContainerId) {
      platformId = 'gtm';
      platformName = _deps.PLATFORM_NAMES['gtm'] || 'Google Tag Manager';
      category = 'tag-manager';
      detectedBy = `First-party GTM container loader (${gtmContainerId})`;
    }
  }

  // Feature #65 / #77 / #80 — supplier annotation. Resolve in priority order:
  //   1. metaCapiSupplier — from this event's CAPI partner_agent stamp (most specific)
  //   2. hostSupplier     — from the request hostname (Stape / TAGGRS host)
  //   3. cross-event inference via isStapeHost (page-level Stape signal)
  // Stape Data Tag events are themselves the supplier — no "via" pill needed.
  let resolvedSupplierId = null;
  if (platformId !== 'stape-data-tag') {
    if (metaCapiSupplier) {
      resolvedSupplierId = metaCapiSupplier;
    } else if (hostSupplier) {
      resolvedSupplierId = hostSupplier;
    } else if (_deps.isStapeHost && _deps.isStapeHost(info.hostname)) {
      resolvedSupplierId = 'stape';
    }
  }
  const proxyHost = resolvedSupplierId === 'stape' ? 'stape' : undefined;
  const supplier = resolvedSupplierId ? buildSupplierAnnotation(resolvedSupplierId, platformId) : null;

  _deps.addEvent({
    platform: platformId,
    platformName: platformName,
    eventName: eventName,
    isScriptLoad: isActualScriptLoad,
    raw: {
      ...requestMeta,
      params: info.params,
      postData: postData
    },
    formatted: {
      // Only store actual event data in formatted.params for "Parsed Data" display
      // Use decoded params if Base64 decoding was applied
      params: Object.keys(decodedParams).length > 0 ? decodedParams : null,
      // Track if Base64 decoding was applied
      wasDecoded: wasDecoded,
      // Internal metadata stored separately (used by Overview, not shown in Parsed Data)
      _meta: {
        hostname: info.hostname,
        pathname: info.pathname,
        trackingId: info.trackingId,
        category: category,
        isKnownPlatform: matched
      },
      detectedBy,
      // Structural fingerprint match data (used by event-list for ASSUMED badge, event-detail for info box)
      ...(fingerprintResult && {
        fingerprint: {
          platformId: fingerprintResult.platformId,
          confidence: fingerprintResult.confidence,
          reason: fingerprintResult.reason,
          checksMatched: fingerprintResult.checksMatched
        }
      }),
      // Supplier annotation — legacy `proxyHost` for back-compat with
      // event-detail.js's Stape pill render, plus the generic `supplier` field
      // (Feature #80) for new suppliers (Addingwell, TAGGRS, …).
      ...(proxyHost && { proxyHost }),
      ...(supplier && { supplier }),
      // Include script load info if this is a script
      ...(isActualScriptLoad && {
        scriptUrl: url,
        initiatorType: requestMeta.initiatorType,
        initiatorUrl: requestMeta.initiatorUrl
      })
    }
  });

  // Crowdsourced Unknown Tool Registry (feature #47): if nothing matched —
  // not a known endpoint, not CNAME, not a fingerprint — surface the hostname
  // so the panel/sidepanel can collect it for the tools_unknown property on
  // the page-load analytics event. Privacy filters and the multi-purpose-host
  // first-path hint (feature #69) both live in unknown-reporter.js — the
  // pathname is forwarded so applyHostHint() can decide whether to enrich the
  // value for allow-listed hosts.
  if (platformId === 'other' && _deps.addUnknownHostname && info.hostname) {
    _deps.addUnknownHostname(info.hostname, info.pathname);
  }
}
