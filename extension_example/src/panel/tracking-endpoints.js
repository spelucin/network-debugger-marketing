// Known Tracking Endpoints
// Re-exports platform data from shared module and adds panel-specific utilities.
// See docs/PLATFORM-REGISTRY-REFACTOR.md for the new architecture.

import { isLightColor, getEventBadgeTextColor } from './color-utils.js';

// Import platform registry from single source of truth
import { KNOWN_TRACKING_ENDPOINTS, PLATFORM_COUNT } from '../shared/platform-registry.js';

// Import URL utilities from shared module
import {
  SKIP_EXTENSIONS,
  extractHostname,
  normalizeToRegistrableDomain,
  buildDomainIndex,
  matchSinglePattern
} from '../shared/detection/url-patterns.js';

// Import CNAME detection from shared module
import {
  detectCNAMETracking,
  CNAME_SUBDOMAIN_PATTERNS,
  CNAME_PATH_PATTERNS,
  CNAME_QUERY_PATTERNS,
  getRootDomain,
  isSameRootDomain
} from '../shared/detection/cname-detection.js';

export { KNOWN_TRACKING_ENDPOINTS, PLATFORM_COUNT };

// O(1) registry lookups (#131 F7) — built once at module load. Render paths
// (event-detail, consent markers) resolve platforms by id or display name
// several times per render; a Map beats a ~516-entry .find() scan each time.
// Name keys are display names exactly as registered (e.g. 'OneTrust').
export const ENDPOINT_BY_ID = new Map(KNOWN_TRACKING_ENDPOINTS.map(ep => [ep.id, ep]));
export const ENDPOINT_BY_NAME = new Map(KNOWN_TRACKING_ENDPOINTS.map(ep => [ep.name, ep]));

// =============================================================================
// CUSTOM ENDPOINTS: User-defined endpoint patterns (stored locally)
// =============================================================================

let customEndpoints = [];

/**
 * Load custom endpoints from chrome.storage.local
 * Call on panel init and whenever storage changes
 */
export async function loadCustomEndpoints() {
  try {
    const result = await chrome.storage.local.get('customEndpoints');
    customEndpoints = result.customEndpoints || [];
  } catch {
    customEndpoints = [];
  }
  // Register colors for custom "new" tools so badges/chips render correctly
  for (const ep of customEndpoints) {
    if (ep.mode === 'new' && ep.id && ep.color) {
      registerCustomToolColor(ep.id, ep.color);
    }
  }
  // Clear cache so new custom patterns take effect immediately
  clearMatchCache();
}

/**
 * Get the current custom endpoints (for UI rendering)
 * @returns {Array} Custom endpoint objects
 */
export function getCustomEndpoints() {
  return customEndpoints;
}

/**
 * Match a URL against user-defined custom endpoints
 * Uses simple domain + path matching (no regex)
 * @param {string} url - The URL to check
 * @returns {object|null} Matching custom endpoint, or null
 */
function matchCustomEndpoint(url) {
  if (!customEndpoints || customEndpoints.length === 0) return null;

  let hostname, pathname;
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.toLowerCase();
    pathname = parsed.pathname.toLowerCase();
  } catch {
    return null;
  }

  for (const custom of customEndpoints) {
    const domainLower = custom.domain ? custom.domain.toLowerCase() : '';
    const pathLower = custom.path ? custom.path.toLowerCase() : '';

    const domainMatch = !custom.domain || hostname === domainLower
      || hostname.endsWith('.' + domainLower);
    const pathMatch = !custom.path || pathname.startsWith(pathLower);

    if (domainMatch && pathMatch && (custom.domain || custom.path)) {
      return custom;
    }
  }
  return null;
}

// Re-export CNAME detection
export {
  detectCNAMETracking,
  CNAME_SUBDOMAIN_PATTERNS,
  CNAME_PATH_PATTERNS,
  CNAME_QUERY_PATTERNS,
  getRootDomain,
  isSameRootDomain
};

// =============================================================================
// PERFORMANCE OPTIMIZATION: Pre-built domain index for fast lookups
// =============================================================================

// Build the index once at module load time using shared utility
const { domainIndex: DOMAIN_INDEX, genericEndpoints: GENERIC_ENDPOINTS } = buildDomainIndex(KNOWN_TRACKING_ENDPOINTS);

// URL result cache (cleared on navigation)
const URL_MATCH_CACHE = new Map();
const MAX_CACHE_SIZE = 1000;

// SKIP_EXTENSIONS imported from shared/detection/url-patterns.js

let debugLoggingEnabled = false;
// Extended tracking mode - collects detailed data for export (only when enabled)
let extendedTrackingEnabled = false;
let debugStats = {
  totalCalls: 0,
  cacheHits: 0,
  knownDomains: 0, // URLs with hostname found in domain index
  unknownDomains: 0, // URLs with hostname but no domain index match (only checked generic endpoints)
  fullScanFallbacks: 0,
  totalEndpointsChecked: 0,
  skippedByExtension: 0, // URLs skipped due to static asset extensions
  slowestUrls: [], // [{url, time, endpointsChecked}]
  // Extended mode only - detailed tracking for export
  skippedUrls: [], // [{url, extension, reason}] - only in extended mode
  matchedPatterns: new Map(), // Map<endpointId, [{url, matchedPattern}]> - only in extended mode
  unmatchedUrls: [] // [{url, hostname}] - URLs that didn't match any endpoint (only in extended mode)
};

/**
 * Enable or disable debug logging
 */
export function setDebugLogging(enabled) {
  debugLoggingEnabled = enabled;
}

/**
 * Enable or disable extended tracking mode
 * When enabled, collects detailed data about skipped URLs and matched patterns
 * for debugging/export purposes. Has minor performance overhead, so only enable when needed.
 */
export function setExtendedTracking(enabled) {
  extendedTrackingEnabled = enabled;
  if (!enabled) {
    // Clear extended data when disabled to free memory
    debugStats.skippedUrls = [];
    debugStats.matchedPatterns = new Map();
    debugStats.unmatchedUrls = [];
  }
}

/**
 * Get debug stats
 * Returns extended data (skippedUrls, matchedPatterns) only if extended tracking is enabled
 */
export function getDebugStats() {
  const stats = {
    totalCalls: debugStats.totalCalls,
    cacheHits: debugStats.cacheHits,
    knownDomains: debugStats.knownDomains,
    unknownDomains: debugStats.unknownDomains,
    fullScanFallbacks: debugStats.fullScanFallbacks,
    totalEndpointsChecked: debugStats.totalEndpointsChecked,
    skippedByExtension: debugStats.skippedByExtension,
    slowestUrls: debugStats.slowestUrls
  };

  // Include extended data only if extended tracking is enabled
  if (extendedTrackingEnabled) {
    stats.skippedUrls = debugStats.skippedUrls;
    stats.unmatchedUrls = debugStats.unmatchedUrls;
    // Convert Map to object for JSON serialization
    stats.matchedPatterns = Object.fromEntries(debugStats.matchedPatterns);
  }

  return stats;
}

/**
 * Reset debug stats (call on page navigation)
 */
export function resetDebugStats() {
  debugStats = {
    totalCalls: 0,
    cacheHits: 0,
    knownDomains: 0,
    unknownDomains: 0,
    fullScanFallbacks: 0,
    totalEndpointsChecked: 0,
    skippedByExtension: 0,
    slowestUrls: [],
    skippedUrls: [],
    matchedPatterns: new Map(),
    unmatchedUrls: []
  };
}

/**
 * Clear the URL match cache (call on page navigation)
 */
export function clearMatchCache() {
  URL_MATCH_CACHE.clear();
  if (debugLoggingEnabled) {
    getDebugStats(); // Reset stats on page navigation
  }
}

/**
 * Generic tracking URL patterns that indicate a tracking request
 * These are checked when a URL doesn't match any known platform
 */
export const GENERIC_TRACKING_PATTERNS = [
  // Common tracking path patterns
  /\/track(ing)?(\.|\/|$)/i,
  /\/pixel(\.|\/|$)/i,
  /\/beacon(\.|\/|$)/i,
  /\/collect(\.|\/|$)/i,
  /\/event(s)?(\.|\/|$)/i,
  /\/analytics(\.|\/|$)/i,
  /\/telemetry(\.|\/|$)/i,
  /\/log(\.|\/|$)/i,
  /\/ping(\.|\/|$)/i,
  /\/impression(\.|\/|$)/i,
  /\/conversion(\.|\/|$)/i,
  /\/tr(\.|\/|$)/i,
  /\/px(\.|\/|$)/i,

  // Bloomreach/Exponea CTD (Custom Tracking Domain) endpoints
  /\/bulk($|\?)/i,
  /\/campaigns\/(experiments|banners)\/show/i,
  /\/managed-tags\/show/i,
  /\/webxp\/projects\//i,

  // Common tracking query parameters - must be combined with tracking-like patterns
  // These alone are too generic (e.g., 'event' could be anything)
  // tid/pid/cid are commonly used for tracking IDs
  /[?&](tid|pixel_id|tracking_id)=/i,

  // GTM container IDs in query params (GTM-XXXXX pattern)
  /[?&]id=GTM-/i,

  // 1x1 pixel images with tracking IDs
  /\.gif\?.*[?&](id|pid|tid)=/i
];

/**
 * URL patterns that should be excluded from generic tracking detection
 * (to avoid false positives)
 */
export const TRACKING_EXCLUSION_PATTERNS = [
  // CDN and static resources
  /\.(css|js|woff|woff2|ttf|eot|svg|png|jpg|jpeg|webp)(\?|$)/i,
  /fonts\./i,
  /cdn\./i,
  /static\./i,
  /assets\./i,

  // Common non-tracking APIs
  /api\.(github|stripe|paypal|google\.com\/maps)/i,
  /maps\.google/i,
  /recaptcha/i,

  // Social embeds (not tracking pixels)
  /platform\.(twitter|instagram)/i,
  /youtube\.com\/embed/i,
  /player\.vimeo/i,

  // Framework data fetching (not tracking)
  /\/_next\/data\//i,           // Next.js data routes
  /\/_next\/static\//i,         // Next.js static assets
  /\/__nextjs/i,                // Next.js internal
  /\.nuxt\//i,                  // Nuxt.js
  /\/@vite\//i,                 // Vite dev server
  /\/@fs\//i,                   // Vite file system routes

  // Queue/load management systems (not tracking)
  /\/queue\//i,
  /javascriptqueue/i
];

/**
 * Match a URL against known tracking endpoints (optimized with domain index)
 * @param {string} url - The URL to check
 * @returns {{ matched: boolean, endpoint?: object }} Result with match info
 */
export function matchKnownEndpoint(url) {
  const startTime = debugLoggingEnabled ? performance.now() : 0;

  debugStats.totalCalls++;

  // Check cache first
  const cached = URL_MATCH_CACHE.get(url);
  if (cached !== undefined) {
    debugStats.cacheHits++;
    return cached;
  }

  const result = matchKnownEndpointInternal(url);

  // Cache the result (with size limit)
  if (URL_MATCH_CACHE.size >= MAX_CACHE_SIZE) {
    // Evict the single oldest entry (#131 F11) — Maps iterate in insertion
    // order, so this is O(1) and allocation-free, vs materialising all keys
    // to clear half.
    URL_MATCH_CACHE.delete(URL_MATCH_CACHE.keys().next().value);
  }
  URL_MATCH_CACHE.set(url, result);

  // Log slow matches
  if (debugLoggingEnabled) {
    const elapsed = performance.now() - startTime;
    if (elapsed > 5) { // Log URLs taking more than 5ms
      debugStats.slowestUrls.push({
        url: url.substring(0, 100),
        time: elapsed.toFixed(2),
        matched: result.matched,
        endpoint: result.endpoint?.id
      });
      // Keep only top 10 slowest
      if (debugStats.slowestUrls.length > 10) {
        debugStats.slowestUrls.sort((a, b) => b.time - a.time);
        debugStats.slowestUrls = debugStats.slowestUrls.slice(0, 10);
      }
    }
  }

  return result;
}

/**
 * Internal matching logic with domain pre-filtering
 */
function matchKnownEndpointInternal(url) {
  // Quick rejection for non-HTTP URLs (data:, blob:, chrome-extension:, etc.)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return { matched: false };
  }

  // Check custom endpoints FIRST — user-defined mappings take priority
  const customMatch = matchCustomEndpoint(url);
  if (customMatch) {
    if (customMatch.mode === 'existing') {
      // Map to an existing built-in platform (full parser/icon support)
      const platform = ENDPOINT_BY_ID.get(customMatch.platformId);
      if (platform) {
        return { matched: true, endpoint: platform, isCustomMatch: true, customEndpointId: customMatch.id };
      }
    } else {
      // Return a virtual endpoint for the custom tool
      return {
        matched: true,
        endpoint: {
          id: customMatch.id,
          name: customMatch.name,
          shortName: customMatch.name,
          category: customMatch.category,
          color: customMatch.color,
          patterns: [],
          isCustom: true
        },
        isCustomMatch: true,
        customEndpointId: customMatch.id
      };
    }
  }

  // Skip static assets - no tracking endpoint uses these extensions
  if (SKIP_EXTENSIONS.test(url)) {
    debugStats.skippedByExtension++;
    // Track details in extended mode
    if (extendedTrackingEnabled && debugStats.skippedUrls.length < 100) {
      // Extract the extension from URL
      const extMatch = url.match(/\.(\w+)(?:\?|$)/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'unknown';
      debugStats.skippedUrls.push({
        url: url.length > 150 ? url.substring(0, 150) + '...' : url,
        extension: ext,
        reason: 'static-asset'
      });
    }
    return { matched: false };
  }

  const urlLower = url.toLowerCase();

  // Extract hostname and normalize domain using shared utilities
  const hostname = extractHostname(url);
  const normalizedDomain = hostname ? normalizeToRegistrableDomain(hostname) : '';

  // Collect endpoints to check (domain-specific + generic)
  let endpointsToCheck = [];
  let usedDomainIndex = false;

  // Add endpoints that match this domain
  if (normalizedDomain) {
    const domainEndpoints = DOMAIN_INDEX.get(normalizedDomain);
    if (domainEndpoints) {
      endpointsToCheck.push(...domainEndpoints);
      usedDomainIndex = true;
    }

    // Also check full hostname (e.g., for api.amplitude.com)
    const fullDomainEndpoints = DOMAIN_INDEX.get(hostname);
    if (fullDomainEndpoints && fullDomainEndpoints !== domainEndpoints) {
      endpointsToCheck.push(...fullDomainEndpoints);
      usedDomainIndex = true;
    }
  }

  // Add generic endpoints (those without clear domain patterns)
  endpointsToCheck.push(...GENERIC_ENDPOINTS);

  // Safety: if we couldn't extract a domain, check all endpoints
  if (!usedDomainIndex && !hostname) {
    endpointsToCheck = KNOWN_TRACKING_ENDPOINTS;
    debugStats.fullScanFallbacks++;
  } else if (usedDomainIndex) {
    debugStats.knownDomains++;
  } else {
    // Has hostname but no domain index match - only checking generic endpoints
    debugStats.unknownDomains++;
  }

  debugStats.totalEndpointsChecked += endpointsToCheck.length;

  // Check only the relevant endpoints
  for (const endpoint of endpointsToCheck) {
    for (const pattern of endpoint.patterns) {
      // Canonical contract: string = case-insensitive substring, regex = raw URL.
      // See matchSinglePattern() in url-patterns.js.
      const isMatch = matchSinglePattern(url, pattern, urlLower);

      if (isMatch) {
        // Track matched pattern in extended mode
        if (extendedTrackingEnabled) {
          const patternStr = pattern instanceof RegExp ? pattern.source : pattern;
          if (!debugStats.matchedPatterns.has(endpoint.id)) {
            debugStats.matchedPatterns.set(endpoint.id, []);
          }
          const matches = debugStats.matchedPatterns.get(endpoint.id);
          // Limit to 20 examples per endpoint to avoid memory bloat
          if (matches.length < 20) {
            matches.push({
              url: url.length > 150 ? url.substring(0, 150) + '...' : url,
              matchedPattern: patternStr.length > 100 ? patternStr.substring(0, 100) + '...' : patternStr
            });
          }
        }
        return { matched: true, endpoint };
      }
    }
  }

  // Track unmatched URLs in extended mode
  if (extendedTrackingEnabled && debugStats.unmatchedUrls.length < 100) {
    debugStats.unmatchedUrls.push({
      url: url.length > 150 ? url.substring(0, 150) + '...' : url,
      hostname: hostname || 'unknown'
    });
  }

  return { matched: false };
}

/**
 * Check if a URL looks like a generic tracking request
 * @param {string} url - The URL to check
 * @returns {boolean} True if URL appears to be tracking-related
 */
export function isGenericTrackingRequest(url) {
  // First check exclusions
  for (const pattern of TRACKING_EXCLUSION_PATTERNS) {
    if (pattern.test(url)) {
      return false;
    }
  }

  // Then check for generic tracking patterns
  for (const pattern of GENERIC_TRACKING_PATTERNS) {
    if (pattern.test(url)) {
      return true;
    }
  }

  return false;
}

/**
 * Try to extract meaningful info from an unknown tracking request
 * @param {string} url - The request URL
 * @returns {object} Extracted info
 */
export function extractUnknownTrackingInfo(url) {
  try {
    const parsed = new URL(url);
    const params = Object.fromEntries(parsed.searchParams);

    // Try to identify what might be an event name
    const possibleEventParams = ['event', 'ev', 'action', 't', 'type', 'name', 'en'];
    let eventName = null;
    for (const param of possibleEventParams) {
      if (params[param]) {
        eventName = params[param];
        break;
      }
    }

    // Try to identify what might be an ID
    const possibleIdParams = ['id', 'tid', 'pid', 'cid', 'uid', 'aid', 'sid', 'pixel_id', 'account_id'];
    let trackingId = null;
    for (const param of possibleIdParams) {
      if (params[param]) {
        trackingId = params[param];
        break;
      }
    }

    return {
      hostname: parsed.hostname,
      pathname: parsed.pathname,
      eventName,
      trackingId,
      params,
      paramCount: Object.keys(params).length
    };
  } catch (e) {
    return {
      hostname: 'unknown',
      pathname: '',
      params: {},
      paramCount: 0
    };
  }
}


/**
 * Platform colors - maps platform ID to brand color hex
 * Generated from KNOWN_TRACKING_ENDPOINTS color field, with defaults for missing
 */
export const PLATFORM_COLORS = {};

/**
 * Icon verification status - maps platform ID to boolean
 * true = verified official icon, false = generic/placeholder icon
 */
export const PLATFORM_ICON_VERIFIED = {};

// Default color for platforms without a defined color
const DEFAULT_PLATFORM_COLOR = '#607d8b';

// Build the color and iconVerified maps from KNOWN_TRACKING_ENDPOINTS
KNOWN_TRACKING_ENDPOINTS.forEach(endpoint => {
  PLATFORM_COLORS[endpoint.id] = endpoint.color || DEFAULT_PLATFORM_COLOR;
  PLATFORM_ICON_VERIFIED[endpoint.id] = endpoint.iconVerified === true;
});

// Add special entries not in KNOWN_TRACKING_ENDPOINTS
PLATFORM_COLORS['datalayer'] = '#0891b2';
PLATFORM_COLORS['navigation'] = '#6b7280';
PLATFORM_COLORS['other'] = '#607d8b';
PLATFORM_COLORS['unknown'] = '#9ca3af';

PLATFORM_ICON_VERIFIED['datalayer'] = true;
PLATFORM_ICON_VERIFIED['navigation'] = true;
PLATFORM_ICON_VERIFIED['other'] = false;
PLATFORM_ICON_VERIFIED['unknown'] = false;

/**
 * Platform color configuration - comprehensive color info for each platform
 * Used for dynamic CSS generation to ensure consistency between badges and filter-chips
 * @type {Object.<string, {brand: string, text: string, textDark: string, bgOpacity: number, needsDarkBadgeText: boolean}>}
 */
export const PLATFORM_COLOR_CONFIG = {};

// Build comprehensive color config from endpoints
KNOWN_TRACKING_ENDPOINTS.forEach(endpoint => {
  const brandColor = endpoint.color || DEFAULT_PLATFORM_COLOR;
  PLATFORM_COLOR_CONFIG[endpoint.id] = {
    brand: brandColor,
    text: getEventBadgeTextColor(brandColor, endpoint.textColor),
    textDark: getEventBadgeTextColor(brandColor),
    bgOpacity: isLightColor(brandColor) ? 0.12 : 0.08,
    needsDarkBadgeText: isLightColor(brandColor)
  };
});

// Add special entries not in KNOWN_TRACKING_ENDPOINTS
PLATFORM_COLOR_CONFIG['datalayer'] = {
  brand: '#0891b2',
  text: '#0891b2',
  textDark: '#0891b2',
  bgOpacity: 0.08,
  needsDarkBadgeText: false
};
PLATFORM_COLOR_CONFIG['navigation'] = {
  brand: '#6b7280',
  text: getEventBadgeTextColor('#6b7280'),
  textDark: getEventBadgeTextColor('#6b7280'),
  bgOpacity: 0.08,
  needsDarkBadgeText: false
};
PLATFORM_COLOR_CONFIG['other'] = {
  brand: '#607d8b',
  text: getEventBadgeTextColor('#607d8b'),
  textDark: getEventBadgeTextColor('#607d8b'),
  bgOpacity: 0.08,
  needsDarkBadgeText: false
};
PLATFORM_COLOR_CONFIG['unknown'] = {
  brand: '#9ca3af',
  text: getEventBadgeTextColor('#9ca3af'),
  textDark: getEventBadgeTextColor('#9ca3af'),
  bgOpacity: 0.08,
  needsDarkBadgeText: false
};

/**
 * Register a custom tool's color in the platform color maps
 * Called when custom endpoints are loaded or added
 * @param {string} id - Custom endpoint ID
 * @param {string} color - Hex color string
 */
export function registerCustomToolColor(id, color) {
  const brandColor = color || DEFAULT_PLATFORM_COLOR;
  PLATFORM_COLORS[id] = brandColor;
  PLATFORM_ICON_VERIFIED[id] = false;
  PLATFORM_COLOR_CONFIG[id] = {
    brand: brandColor,
    text: getEventBadgeTextColor(brandColor),
    textDark: getEventBadgeTextColor(brandColor),
    bgOpacity: isLightColor(brandColor) ? 0.12 : 0.08,
    needsDarkBadgeText: isLightColor(brandColor)
  };
}

/**
 * Get the color for a platform
 * @param {string} platformId - The platform ID
 * @returns {string} Hex color string
 */
export function getPlatformColor(platformId) {
  return PLATFORM_COLORS[platformId] || DEFAULT_PLATFORM_COLOR;
}

/**
 * Check if a platform has a verified icon
 * @param {string} platformId - The platform ID
 * @returns {boolean} True if icon is verified official, false if generic
 */
export function isPlatformIconVerified(platformId) {
  return PLATFORM_ICON_VERIFIED[platformId] === true;
}

