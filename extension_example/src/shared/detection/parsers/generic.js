// Generic Parsing Utilities
// Config-driven parsing and utilities for unknown tracking requests

/**
 * Check if a URL is a JavaScript file (not a JSONP tracking beacon)
 * @param {string} urlString - URL to check
 * @returns {boolean} True if URL appears to be a .js file
 */
export function isJavaScriptFileUrl(urlString) {
  try {
    const url = new URL(urlString);
    const pathname = url.pathname.toLowerCase();
    // Actual JS files end with .js (possibly with query params)
    return pathname.endsWith('.js');
  } catch (e) {
    return false;
  }
}

/**
 * Try to decode a Base64 encoded value
 * @param {string} value - Value to decode
 * @returns {Object} { decoded: boolean, value: any, original: string }
 */
export function tryDecodeBase64(value) {
  if (typeof value !== 'string' || value.length < 20) {
    return { decoded: false, value, original: value };
  }

  // Base64 characteristics:
  // - Standard Base64: A-Z, a-z, 0-9, +, /, =
  // - URL-safe Base64: A-Z, a-z, 0-9, -, _, = (used by Criteo and others)
  const standardBase64Regex = /^[A-Za-z0-9+/]+=*$/;
  const urlSafeBase64Regex = /^[A-Za-z0-9_-]+=*$/;

  const isStandardBase64 = standardBase64Regex.test(value);
  const isUrlSafeBase64 = urlSafeBase64Regex.test(value);

  // Heuristics for likely Base64:
  const hasMixedCase = /[a-z]/.test(value) && /[A-Z]/.test(value);
  const isLongEnough = value.length > 40;

  // Strong structural signals \u2014 a JWT prefix or explicit '=' padding \u2014 are
  // trusted on their own. Without one of those, the mixed-case length heuristic
  // is too loose: opaque tracking IDs (device ids, session tokens, signed
  // cookies) sit in the base64 charset and atob() "succeeds" on them, producing
  // a meaningless string that replaces the real value in the Parsed Data view
  // (N16, #139). For the weak branch, additionally require a clean multiple-of-4
  // length, then verify the decode below (JSON or canonical round-trip).
  const hasStrongSignal = value.startsWith('ey') || value.endsWith('=');
  const passesWeakHeuristic = isLongEnough && hasMixedCase && value.length % 4 === 0;

  const looksLikeBase64 = (isStandardBase64 || isUrlSafeBase64) &&
                          (hasStrongSignal || passesWeakHeuristic);

  if (!looksLikeBase64) {
    return { decoded: false, value, original: value };
  }

  try {
    // Convert URL-safe Base64 to standard Base64 for decoding
    let base64ToDecode = value;
    if (isUrlSafeBase64 && !isStandardBase64) {
      base64ToDecode = value.replace(/-/g, '+').replace(/_/g, '/');
    }

    const decoded = atob(base64ToDecode);
    // Check if decoded result looks like valid text (not binary garbage)
    if (!/^[\x20-\x7E\s\u00A0-\u00FF]*$/.test(decoded)) {
      return { decoded: false, value, original: value };
    }

    // Try to parse as JSON
    let parsed;
    let isJson = false;
    try {
      parsed = JSON.parse(decoded);
      isJson = true;
    } catch (e) {
      // Valid decoded string but not JSON
    }

    // Integrity gate for weak-branch values (no strong signal): only trust the
    // decode if it yields JSON or canonically round-trips (btoa(atob(x)) === x,
    // padding-normalised). This rejects opaque IDs that merely happen to decode
    // to printable bytes without being real base64 payloads (N16, #139).
    if (!hasStrongSignal && !isJson) {
      let reencoded = null;
      try { reencoded = btoa(decoded); } catch (e) { /* unencodable */ }
      const stripPad = (s) => s.replace(/=+$/, '');
      const roundTrips = reencoded !== null && stripPad(reencoded) === stripPad(base64ToDecode);
      if (!roundTrips) {
        return { decoded: false, value, original: value };
      }
    }

    return isJson
      ? { decoded: true, value: parsed, original: value }
      : { decoded: true, value: decoded, original: value };
  } catch (e) {
    // Not valid Base64
    return { decoded: false, value, original: value };
  }
}

/**
 * Recursively decode Base64 values in an object
 * @param {Object} obj - Object to process
 * @returns {Object} { data: decodedObject, wasDecoded: boolean }
 */
export function decodeBase64InObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return { data: obj, wasDecoded: false };
  }

  let anyDecoded = false;
  const result = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      const decoded = tryDecodeBase64(value);
      if (decoded.decoded) {
        anyDecoded = true;
        result[key] = decoded.value;
      } else {
        result[key] = value;
      }
    } else if (typeof value === 'object' && value !== null) {
      const nested = decodeBase64InObject(value);
      result[key] = nested.data;
      if (nested.wasDecoded) anyDecoded = true;
    } else {
      result[key] = value;
    }
  }

  return { data: result, wasDecoded: anyDecoded };
}

/**
 * Resolve a dot-notation path on an object (e.g., 'context.pixel.code')
 * @param {Object} obj - Object to traverse
 * @param {string} path - Dot-notation path
 * @returns {any} Value at path or undefined
 */
export function resolvePath(obj, path) {
  if (!path || !obj) return undefined;
  return path.split('.').reduce((curr, key) => curr?.[key], obj);
}

/**
 * Config-driven parser: reads parsing config from endpoint definition
 * and produces standardized formatted output (overview + params)
 * @param {string} url - Request URL
 * @param {string|null} postData - POST body text
 * @param {Object} endpoint - Endpoint configuration with parsing rules
 * @returns {Object} Parsed data
 */
export function parseConfiguredRequestData(url, postData, endpoint) {
  const config = endpoint.parsing;
  const urlObj = new URL(url);
  const allParams = {};

  // Step 1: Extract from configured sources
  let jsonBody = null;
  if (config.sources) {
    for (const source of config.sources) {
      if (source === 'urlParams') {
        Object.assign(allParams, Object.fromEntries(urlObj.searchParams));
      } else if (source === 'jsonBody' && postData) {
        try {
          jsonBody = JSON.parse(postData);
          if (typeof jsonBody === 'object' && !Array.isArray(jsonBody)) {
            Object.assign(allParams, jsonBody);
            // Also flatten first element of 'data' array (common batch format)
            if (Array.isArray(jsonBody.data) && jsonBody.data.length > 0 && typeof jsonBody.data[0] === 'object') {
              Object.assign(allParams, jsonBody.data[0]);
            }
          } else if (Array.isArray(jsonBody) && jsonBody.length > 0 && typeof jsonBody[0] === 'object') {
            // Root-level array: flatten first element
            Object.assign(allParams, jsonBody[0]);
          }
        } catch (e) { /* not JSON */ }
      } else if (source === 'formBody' && postData) {
        try {
          const formParams = new URLSearchParams(postData);
          for (const [k, v] of formParams) allParams[k] = v;
        } catch (e) { /* not form-encoded */ }
      }
    }
  }

  // Step 2: Value resolver - checks param, path, alt names, and URL path patterns
  function resolveValue(rule) {
    if (!rule) return undefined;
    let value = allParams[rule.param];
    if (value === undefined && rule.path && jsonBody) {
      value = resolvePath(jsonBody, rule.path);
    }
    if (value === undefined && rule.alt) {
      for (const alt of rule.alt) {
        value = allParams[alt];
        if (value !== undefined) break;
        if (jsonBody) {
          value = resolvePath(jsonBody, alt);
          if (value !== undefined) break;
        }
      }
    }
    // Fallback: extract from URL path using regex pattern
    if (value === undefined && rule.pathPattern) {
      // Guard against a malformed pathPattern in registry data: an invalid
      // regex throws synchronously from new RegExp and would break dispatch for
      // the whole event, unlike the JSON/form parsing above which swallows
      // failures (N21, #139).
      try {
        const pathMatch = urlObj.pathname.match(new RegExp(rule.pathPattern));
        if (pathMatch && pathMatch[1]) {
          value = pathMatch[1];
        }
      } catch (e) { /* invalid pathPattern in registry config */ }
    }
    return value;
  }

  // Step 3: Extract event name
  let eventName = 'Request';
  if (config.eventName) {
    const resolved = resolveValue(config.eventName);
    eventName = resolved || config.eventName.default || 'Request';
  }

  // Step 4: Extract overview values (human-readable labels)
  const overview = {};
  if (config.overview) {
    for (const [label, rule] of Object.entries(config.overview)) {
      const value = resolveValue(rule);
      if (value !== undefined && value !== null && value !== '') {
        overview[label] = value;
      }
    }
  }

  // Step 5: Build parsed data (all extracted params)
  let params = allParams;
  const { data: decodedParams, wasDecoded } = decodeBase64InObject(params);
  if (wasDecoded) params = decodedParams;

  // Step 6: Detection reason
  const matchedPattern = endpoint.patterns.find(p =>
    typeof p === 'string' ? urlObj.href.toLowerCase().includes(p.toLowerCase()) : p.test(urlObj.href)
  );
  const detectedBy = `URL matches known pattern: ${matchedPattern || endpoint.patterns[0]}`;

  return {
    eventName,
    overview,
    params,
    wasDecoded,
    detectedBy,
    rawParams: Object.fromEntries(urlObj.searchParams),
    postData
  };
}
