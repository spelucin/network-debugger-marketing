// Badge Endpoint Patterns — builds the badge matching index from platform-registry.js

import { KNOWN_TRACKING_ENDPOINTS } from '../shared/platform-registry.js';
import { matchScriptLoad } from '../shared/detection/script-patterns.js';
import {
  SKIP_EXTENSIONS,
  TWO_PART_TLDS,
  buildDomainIndex,
  extractHostname,
  normalizeToRegistrableDomain,
  matchSinglePattern
} from '../shared/detection/url-patterns.js';

// Derive BADGE_ENDPOINTS from the platform registry
// Filter to only platforms with URL patterns for network request matching
const BADGE_ENDPOINTS = KNOWN_TRACKING_ENDPOINTS
  .filter(p => p.patterns && p.patterns.length > 0 && p.hasBadgePatterns !== false)
  .map(p => ({ id: p.id, patterns: p.patterns }));

// Build the domain index once at module load time using shared utility
const { domainIndex: DOMAIN_INDEX, genericEndpoints: GENERIC_ENDPOINTS } = buildDomainIndex(BADGE_ENDPOINTS);

export const BADGE_ENDPOINT_COUNT = BADGE_ENDPOINTS.length;

/**
 * Match a URL against known tracking endpoints.
 * Uses domain-based indexing for O(1) average case instead of O(n) full scan.
 * @param {string} url - The request URL to match
 * @param {string} [resourceType] - Optional resource type from webRequest (e.g., 'script', 'xhr')
 * @returns {string|null} - Platform ID if matched, null otherwise
 */
export function matchUrlToEndpoint(url, resourceType = null) {
  if (!url || typeof url !== 'string') return null;

  // Skip common static assets immediately
  if (SKIP_EXTENSIONS.test(url)) return null;

  // Check script load patterns for script resources
  // This detects platforms via their CDN script loads (e.g., Hotjar, Clarity, GTM)
  if (resourceType === 'script') {
    const scriptMatch = matchScriptLoad(url, resourceType);
    if (scriptMatch) return scriptMatch.platformId;
  }

  // Extract hostname using shared utility
  const hostname = extractHostname(url);

  // Normalize to eTLD+1 using shared utility
  const normalizedDomain = hostname ? normalizeToRegistrableDomain(hostname) : '';

  // Collect endpoints to check (domain-specific + generic)
  let endpointsToCheck = [];

  if (normalizedDomain) {
    // Check by normalized domain
    const domainEndpoints = DOMAIN_INDEX.get(normalizedDomain);
    if (domainEndpoints) {
      endpointsToCheck.push(...domainEndpoints);
    }

    // Also check by full hostname (for subdomains indexed separately)
    if (hostname !== normalizedDomain) {
      const fullDomainEndpoints = DOMAIN_INDEX.get(hostname);
      if (fullDomainEndpoints) {
        endpointsToCheck.push(...fullDomainEndpoints);
      }
    }
  }

  // Always check generic endpoints (regex-only patterns)
  endpointsToCheck.push(...GENERIC_ENDPOINTS);

  // Fallback: if no domain extracted and no endpoints to check, check all
  if (endpointsToCheck.length === 0 && !hostname) {
    endpointsToCheck = BADGE_ENDPOINTS;
  }

  // Match against candidates via the canonical contract: string = case-insensitive
  // substring, regex = raw URL. See matchSinglePattern() in url-patterns.js.
  const urlLower = url.toLowerCase();
  for (const endpoint of endpointsToCheck) {
    for (const pattern of endpoint.patterns) {
      if (matchSinglePattern(url, pattern, urlLower)) return endpoint.id;
    }
  }
  return null;
}
