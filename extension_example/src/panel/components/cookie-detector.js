// Cookie Detector Component
// Parses Set-Cookie response headers and outbound Cookie request headers
// from captured tracking events. Provides badge data and detail section
// content for cookie visibility (both cookies set by the response and
// cookies the browser sent with the request).

/**
 * Format a duration in seconds to a human-readable string
 * @param {number} seconds - Duration in seconds
 * @returns {string} Human-readable duration (e.g., "24 hours", "2 years")
 */
export function formatCookieDuration(seconds) {
  if (seconds <= 0) return 'Expired';
  if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
  if (seconds < 2592000) return `${Math.round(seconds / 86400)} days`;
  if (seconds < 31536000) return `${Math.round(seconds / 2592000)} months`;
  return `${(seconds / 31536000).toFixed(1)} years`;
}

/**
 * Parse a single Set-Cookie header value into a structured object
 * @param {string} header - Raw Set-Cookie header value
 * @returns {{ name: string, value: string, attributes: Object, expiresIn: string }}
 */
export function parseCookieHeader(header) {
  const parts = header.split(';').map(p => p.trim());
  const [nameValue, ...attrParts] = parts;
  const eqIndex = nameValue.indexOf('=');
  const name = eqIndex === -1 ? nameValue.trim() : nameValue.slice(0, eqIndex).trim();
  const value = eqIndex === -1 ? '' : nameValue.slice(eqIndex + 1);

  const cookie = { name, value, attributes: {} };

  for (const attr of attrParts) {
    const attrEqIndex = attr.indexOf('=');
    const attrName = (attrEqIndex === -1 ? attr : attr.slice(0, attrEqIndex)).trim().toLowerCase();
    const attrValue = attrEqIndex === -1 ? '' : attr.slice(attrEqIndex + 1).trim();

    switch (attrName) {
      case 'domain': cookie.attributes.domain = attrValue; break;
      case 'path': cookie.attributes.path = attrValue; break;
      case 'expires': cookie.attributes.expires = attrValue; break;
      case 'max-age': cookie.attributes.maxAge = parseInt(attrValue); break;
      case 'samesite': cookie.attributes.sameSite = attrValue; break;
      case 'secure': cookie.attributes.secure = true; break;
      case 'httponly': cookie.attributes.httpOnly = true; break;
      case 'partitioned': cookie.attributes.partitioned = true; break;
    }
  }

  // Calculate human-readable expiry
  if (cookie.attributes.maxAge != null && !isNaN(cookie.attributes.maxAge)) {
    cookie.expiresIn = formatCookieDuration(cookie.attributes.maxAge);
    cookie.expirySeconds = cookie.attributes.maxAge;
  } else if (cookie.attributes.expires) {
    const expiresDate = new Date(cookie.attributes.expires);
    if (!isNaN(expiresDate.getTime())) {
      const seconds = (expiresDate - new Date()) / 1000;
      cookie.expiresIn = seconds <= 0 ? 'Expired' : formatCookieDuration(seconds);
      cookie.expirySeconds = seconds;
    } else {
      cookie.expiresIn = 'Session';
      cookie.expirySeconds = 0;
    }
  } else {
    cookie.expiresIn = 'Session';
    cookie.expirySeconds = 0;
  }

  return cookie;
}

/**
 * Extract and parse all Set-Cookie headers from an event's response
 * Results are cached on the event object to avoid re-parsing
 * @param {Object} event - Captured event object
 * @returns {Array} Array of parsed cookie objects
 */
export function extractSetCookies(event) {
  // Return cached result if available
  if (event._parsedCookies !== undefined) return event._parsedCookies;

  const headers = event.raw?._har?.responseHeaders || [];
  const cookies = headers
    .filter(h => h.name.toLowerCase() === 'set-cookie')
    .map(h => parseCookieHeader(h.value));

  // Cache on event object
  event._parsedCookies = cookies;
  return cookies;
}

// 13 months in seconds — ePrivacy recommended maximum cookie lifetime
const EPRIVACY_MAX_SECONDS = 13 * 30 * 86400;

/**
 * Build grouped data object for the "Cookies Set" detail section
 * Uses the table display mode with cookie names as group headers
 * @param {Array} cookies - Array of parsed cookie objects from extractSetCookies
 * @returns {Object} Grouped object for createDataSection with displayMode: 'table'
 */
export function buildCookiesSectionData(cookies) {
  const grouped = {};

  for (const cookie of cookies) {
    const attrs = {};

    // Value — truncate for security (session tokens, PII)
    if (cookie.value) {
      attrs['Value'] = cookie.value.length > 50
        ? cookie.value.slice(0, 50) + '...'
        : cookie.value;
    }

    // Domain
    if (cookie.attributes.domain) {
      attrs['Domain'] = cookie.attributes.domain;
    }

    // Path
    if (cookie.attributes.path) {
      attrs['Path'] = cookie.attributes.path;
    }

    // Expires — with compliance annotation for long expiry
    if (cookie.expiresIn) {
      let expiryDisplay = cookie.expiresIn;
      if (cookie.expirySeconds > EPRIVACY_MAX_SECONDS) {
        expiryDisplay += '  \u26A0 Exceeds 13-month ePrivacy recommendation';
      }
      attrs['Expires'] = expiryDisplay;
    }

    // SameSite
    attrs['SameSite'] = cookie.attributes.sameSite || 'Not set (defaults to Lax)';

    // Secure
    attrs['Secure'] = cookie.attributes.secure ? 'Yes' : 'No';

    // HttpOnly
    attrs['HttpOnly'] = cookie.attributes.httpOnly ? 'Yes' : 'No';

    // Partitioned (if set)
    if (cookie.attributes.partitioned) {
      attrs['Partitioned'] = 'Yes';
    }

    grouped[cookie.name] = attrs;
  }

  return grouped;
}

/**
 * Build copy-friendly data for the unified Cookies section toolbar button.
 * Each cookie becomes a keyed entry; collisions (same name, different value
 * across Set vs Sent) are disambiguated by suffixing the key with the
 * direction so the JSON stays unambiguous.
 * @param {Array} unifiedCookies - From buildUnifiedCookieList
 * @returns {Object}
 */
export function buildUnifiedCookiesCopyData(unifiedCookies) {
  const data = {};
  const seenNames = new Set();

  for (const cookie of unifiedCookies) {
    const directionLabel = cookie.direction === 'set+sent'
      ? 'Set & Sent'
      : cookie.direction === 'sent' ? 'Sent' : 'Set';

    const key = seenNames.has(cookie.name)
      ? `${cookie.name} (${directionLabel})`
      : cookie.name;
    seenNames.add(cookie.name);

    const entry = { Direction: directionLabel };
    if (cookie.value) {
      entry.Value = cookie.value.length > 50
        ? cookie.value.slice(0, 50) + '...'
        : cookie.value;
    }
    if (cookie.direction !== 'sent') {
      if (cookie.attributes.domain) entry.Domain = cookie.attributes.domain;
      if (cookie.attributes.path) entry.Path = cookie.attributes.path;
      if (cookie.expiresIn) {
        let expiry = cookie.expiresIn;
        if (cookie.expirySeconds > EPRIVACY_MAX_SECONDS) {
          expiry += '  ⚠ Exceeds 13-month ePrivacy recommendation';
        }
        entry.Expires = expiry;
      }
      entry.SameSite = cookie.attributes.sameSite || 'Not set (defaults to Lax)';
      entry.Secure = cookie.attributes.secure ? 'Yes' : 'No';
      entry.HttpOnly = cookie.attributes.httpOnly ? 'Yes' : 'No';
      if (cookie.attributes.partitioned) entry.Partitioned = 'Yes';
    }

    data[key] = entry;
  }

  return data;
}

/**
 * Parse a `Cookie:` request header value into structured cookies.
 * The Cookie request header has no per-cookie attributes (Domain/Expires/etc.).
 * Format: `name1=value1; name2=value2; ...`
 * @param {string} header - Raw Cookie header value
 * @returns {Array<{ name: string, value: string }>}
 */
export function parseCookieRequestHeader(header) {
  if (!header) return [];
  return header
    .split(';')
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .map(part => {
      const eqIndex = part.indexOf('=');
      if (eqIndex === -1) return { name: part, value: '' };
      return {
        name: part.slice(0, eqIndex).trim(),
        value: part.slice(eqIndex + 1)
      };
    });
}

/**
 * Extract and parse all cookies from an event's outbound Cookie request header.
 * Multiple Cookie: headers are uncommon but legal — concatenate them with `; `
 * before parsing so duplicates merge cleanly. Results are cached on the event.
 * @param {Object} event - Captured event object
 * @returns {Array<{ name: string, value: string }>}
 */
export function extractSentCookies(event) {
  if (event._parsedSentCookies !== undefined) return event._parsedSentCookies;

  const headers = event.raw?._har?.requestHeaders || [];
  const cookieHeaderValues = headers
    .filter(h => h.name.toLowerCase() === 'cookie')
    .map(h => h.value);

  const combined = cookieHeaderValues.join('; ');
  const cookies = parseCookieRequestHeader(combined);

  event._parsedSentCookies = cookies;
  return cookies;
}

/**
 * Merge set + sent cookies into a single list with `direction` annotation
 * for the unified "Cookies" detail section.
 *
 * Direction values:
 *   'set'      — only present in Set-Cookie response header
 *   'sent'     — only present in outbound Cookie request header
 *   'set+sent' — same name AND same value in both (steady-state cookie roundtrip)
 *
 * Same-name-different-value pairs intentionally produce TWO rows (one Set, one
 * Sent) so cookie-value rotations stay visible — e.g. an AWS load balancer
 * cookie where the request carries the previous value and the response sets a
 * new one. Merging by name alone would silently hide the rotation.
 *
 * Set rows keep their full attribute set (Domain/Path/Expires/SameSite/Secure/
 * HttpOnly/Partitioned). Sent-only rows have no attributes — the Cookie request
 * header carries name=value pairs only.
 *
 * @param {Array} setCookies  - From extractSetCookies(event)
 * @param {Array} sentCookies - From extractSentCookies(event)
 * @returns {Array<Object>} Cookies with `direction` field added
 */
export function buildUnifiedCookieList(setCookies, sentCookies) {
  const merged = setCookies.map(c => ({ ...c, direction: 'set' }));

  for (const sent of sentCookies) {
    const matchIdx = merged.findIndex(
      c => c.direction === 'set' && c.name === sent.name && c.value === sent.value
    );
    if (matchIdx >= 0) {
      merged[matchIdx].direction = 'set+sent';
    } else {
      merged.push({
        name: sent.name,
        value: sent.value,
        attributes: {},
        expiresIn: '',
        expirySeconds: 0,
        direction: 'sent'
      });
    }
  }

  return merged;
}

/**
 * Build grouped data object for the "Cookies Sent" detail section.
 * Each cookie name becomes a group header; the only inner field is `Value`,
 * truncated to 50 chars to avoid leaking session tokens / PII into the UI.
 * @param {Array<{ name: string, value: string }>} cookies
 * @returns {Object} Grouped object for createDataSection with displayMode: 'table'
 */
export function buildSentCookiesSectionData(cookies) {
  const grouped = {};

  for (const cookie of cookies) {
    const attrs = {};
    if (cookie.value) {
      attrs['Value'] = cookie.value.length > 50
        ? cookie.value.slice(0, 50) + '...'
        : cookie.value;
    } else {
      attrs['Value'] = '';
    }
    grouped[cookie.name] = attrs;
  }

  return grouped;
}
