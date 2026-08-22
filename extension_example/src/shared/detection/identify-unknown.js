// @ts-check
// Smart Unknown Identification — structural fingerprinting for unrecognized tracking requests
// Runs deterministic payload-level checks to identify the likely platform when URL matching fails.
// Results are cached per hostname to avoid re-running checks on every event from the same domain.

import { STRUCTURAL_FINGERPRINTS } from './structural-fingerprints.js';

/**
 * @typedef {Object} FingerprintResult
 * @property {string} platformId
 * @property {'high'|'medium'|'low'} confidence
 * @property {string} reason
 * @property {number} checksMatched
 */

/**
 * Per-hostname cache of fingerprint results.
 * Key: hostname string, Value: FingerprintResult | null (null = checked, no match).
 * Cleared when events are cleared (panel.js clearEvents).
 * @type {Map<string, FingerprintResult|null>}
 */
const hostnameCache = new Map();

/**
 * Per-hostname dismissals — user clicked "Not [platform]".
 * Key: hostname string, Value: true
 * In-memory only, cleared with events.
 * @type {Set<string>}
 */
const dismissedHostnames = new Set();

/**
 * Attempt to identify an unknown tracking request by structural fingerprinting.
 * Checks URL structure, query parameters, and POST body against known platform signatures.
 *
 * @param {string} urlString - The full request URL
 * @param {Object|null} [parsedBody] - Parsed POST body (JSON object), or null
 * @returns {FingerprintResult | null}
 */
export function identifyUnknownRequest(urlString, parsedBody = null) {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Check dismissal cache
    if (dismissedHostnames.has(hostname)) {
      return null;
    }

    // Check result cache
    const cached = hostnameCache.get(hostname);
    if (cached !== undefined) {
      return cached;
    }

    // Build params from both URL search params and any form-encoded body
    const params = new URLSearchParams(url.search);

    // Run fingerprint checks
    const result = runFingerprints(url, params, parsedBody);

    // Cache result (even null, to avoid re-checking)
    hostnameCache.set(hostname, result);
    return result;
  } catch {
    return null;
  }
}

/**
 * Run all fingerprint definitions against the request data.
 * Returns the first match where ALL checks pass (AND logic).
 * Confidence is based on number of matching checks.
 *
 * @param {URL} url
 * @param {URLSearchParams} params
 * @param {Object|null} body
 * @returns {FingerprintResult | null}
 */
function runFingerprints(url, params, body) {
  for (const fingerprint of STRUCTURAL_FINGERPRINTS) {
    let allPassed = true;
    let matchCount = 0;

    for (const check of fingerprint.checks) {
      try {
        if (check(url, params, body)) {
          matchCount++;
        } else {
          allPassed = false;
          break;
        }
      } catch {
        allPassed = false;
        break;
      }
    }

    if (allPassed && matchCount > 0) {
      // Confidence based on check count: 1=low, 2=medium, 3+=high
      const confidence = matchCount >= 3 ? 'high' : matchCount === 2 ? 'medium' : 'low';
      return {
        platformId: fingerprint.platform,
        confidence,
        reason: fingerprint.reason,
        checksMatched: matchCount
      };
    }
  }

  return null;
}

/**
 * Dismiss a fingerprint suggestion for a given hostname.
 * Called when user clicks "Not [platform]".
 * @param {string} hostname
 */
export function dismissFingerprint(hostname) {
  if (!hostname) return;
  const normalized = hostname.toLowerCase();
  dismissedHostnames.add(normalized);
  hostnameCache.delete(normalized);
}

/**
 * Clear fingerprint caches. Must be called from clearEvents().
 */
export function clearFingerprintCache() {
  hostnameCache.clear();
  dismissedHostnames.clear();
}

/**
 * Check if a hostname has been dismissed by the user.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isFingerprintDismissed(hostname) {
  return dismissedHostnames.has(hostname?.toLowerCase() || '');
}

// Export internals for testing
export { hostnameCache, dismissedHostnames, runFingerprints };
