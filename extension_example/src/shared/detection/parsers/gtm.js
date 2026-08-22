// GTM (Google Tag Manager) Parsing Utilities
// Parses GTM container loads, GTAG loads, and GTM analytics/telemetry

/**
 * Parse GTM container script load data
 * @param {string} url - Request URL (googletagmanager.com/gtm.js)
 * @returns {Object} Parsed GTM load data
 */
export function parseGTMScriptLoadData(url) {
  const urlObj = new URL(url);
  const params = Object.fromEntries(urlObj.searchParams);

  // Extract container ID from the 'id' parameter (e.g., GTM-NJV5HM5)
  const containerId = params.id || 'Unknown';

  return {
    containerId,
    dataLayerName: params.l || 'dataLayer',
    gtmAuth: params.gtm_auth || null,
    gtmPreview: params.gtm_preview || null,
    gtmCookiesWin: params.gtm_cookies_win || null,
    scriptUrl: url,
    eventName: `GTM Load: ${containerId}`,
    params
  };
}

/**
 * Detect GTM health-check ping (gtg_health=1 follow-up library request).
 * Fires after the initial gtm.js load when the container includes Google tags;
 * throttled to once per 24h via _gcl_ls localStorage when ad consent is granted.
 */
export function isGTMHealthPing(url) {
  try {
    const params = new URL(url).searchParams;
    return params.get('gtg_health') === '1';
  } catch {
    return false;
  }
}

/**
 * Parse GTM health-check ping data (googletagmanager.com/gtm.js?id=...&gtg_health=1)
 */
export function parseGTMHealthPingData(url) {
  const urlObj = new URL(url);
  const params = Object.fromEntries(urlObj.searchParams);
  const containerId = params.id || 'Unknown';
  return {
    containerId,
    scriptUrl: url,
    eventName: `GTM Health Ping: ${containerId}`,
    params
  };
}

/**
 * Parse GTAG script load data
 * @param {string} url - Request URL (googletagmanager.com/gtag/js)
 * @returns {Object} Parsed GTAG load data
 */
export function parseGTAGScriptLoadData(url) {
  const urlObj = new URL(url);
  const params = Object.fromEntries(urlObj.searchParams);

  // Extract measurement ID from the 'id' parameter (e.g., G-YJ513FSP8W)
  const measurementId = params.id || 'Unknown';

  return {
    measurementId,
    dataLayerName: params.l || 'dataLayer',
    scriptUrl: url,
    eventName: `GTAG Load: ${measurementId}`,
    params
  };
}

/**
 * Parse GTM container response body to extract container configuration
 * @param {string} content - Response body of gtm.js (JavaScript, not JSON)
 * @returns {Object|null} Parsed container data, or null if parsing fails
 */
export function parseGTMContainerResponse(content) {
  if (!content || content.length > 2 * 1024 * 1024) return null; // 2MB cap
  try {
    // Response starts with: data={...}; or var data={...}; followed by GTM runtime
    const matchIdx = content.search(/^(?:var\s+)?data\s*=\s*\{/m);
    if (matchIdx === -1) return null;

    const braceStart = content.indexOf('{', matchIdx);
    if (braceStart === -1) return null;

    // Find matching closing brace via bracket counting
    let depth = 0;
    let endIdx = -1;
    for (let i = braceStart; i < content.length; i++) {
      const ch = content[i];
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { endIdx = i; break; }
      }
    }
    if (endIdx === -1) return null;
    const data = JSON.parse(content.slice(braceStart, endIdx + 1));
    const resource = data.resource || {};
    const tags = resource.tags || [];
    const blob = data.blob || {};

    const version = resource.version || blob['1'] || null;
    const pausedCount = tags.filter(t => t.function === '__paused').length;

    // Group tags by event name, tracking paused status per group.
    // Paused tags wrap their real config inside vtp_tag — look there first.
    // Try vtp_eventType and vtp_eventName (both are used across different GA4 tag versions).
    const eventMap = new Map();
    for (const tag of tags) {
      const isPaused = tag.function === '__paused';
      const effectiveTag = isPaused && tag.vtp_tag ? tag.vtp_tag : tag;
      const name = effectiveTag.vtp_eventType || effectiveTag.vtp_eventName;
      if (!name || typeof name !== 'string') continue; // Skip non-string values (GTM macro refs like ["macro", 6])
      if (!eventMap.has(name)) eventMap.set(name, { name, total: 0, paused: 0 });
      const entry = eventMap.get(name);
      entry.total++;
      if (isPaused) entry.paused++;
    }

    return {
      version,
      tagCount: tags.length,
      macroCount: (resource.macros || []).length,
      predicateCount: (resource.predicates || []).length,
      pausedCount,
      tagsByEvent: [...eventMap.values()].sort((a, b) => a.name.localeCompare(b.name))
    };
  } catch {
    return null;
  }
}

/**
 * Parse GTM log parameter (the 'l' param in /a analytics endpoint)
 * Format: L{loadTime}.S{subscribers}.Y{...}.B{...}~eventName.S{...}.V{...}.TS{tagType}.TI{tagId}.TE{execTime}~...
 * @param {string} logParam - The raw log parameter string
 * @returns {Array} Array of parsed tag execution events
 */
export function parseGTMLogParameter(logParam) {
  if (!logParam) return [];

  const events = [];
  // Split by ~ to get individual event entries
  const entries = logParam.split('~');

  for (const entry of entries) {
    // Skip the first entry which is typically load stats (L3541.S6.Y12...)
    if (entry.startsWith('L') || entry.startsWith('SS')) continue;

    // Parse event entries like: gtm.js.S9.V9.TS5googtag.TI4.TE2
    const eventMatch = entry.match(/^([^.]+)/);
    if (eventMatch) {
      const eventName = eventMatch[1];
      // Extract tag info if present
      const tagMatches = [...entry.matchAll(/TS(\d+)([^.]+)?\.TI(\d+)\.TE(\d+)/g)];

      if (tagMatches.length > 0) {
        for (const match of tagMatches) {
          events.push({
            event: eventName === '*' ? '(any event)' : eventName,
            tagType: match[2] || 'unknown',
            tagId: match[3],
            executionTime: match[4] + 'ms'
          });
        }
      } else if (eventName !== '*') {
        events.push({
          event: eventName,
          tagType: null,
          tagId: null,
          executionTime: null
        });
      }
    }
  }

  return events;
}

/**
 * Parse GTM Analytics/Telemetry request data
 * This is GTM's internal telemetry that sends performance and tag execution data back to Google
 * @param {string} url - Request URL
 * @returns {Object} Parsed GTM analytics data
 */
export function parseGTMAnalyticsRequestData(url) {
  const urlObj = new URL(url);
  const params = Object.fromEntries(urlObj.searchParams);

  // Parse the 'l' parameter which contains encoded tag execution log
  const logParam = params.l || '';
  const tagExecutions = parseGTMLogParameter(logParam);

  // Extract container info
  const containerId = params.cid || '';
  const containerConfigId = params.ccid || '';
  const runtimeVersion = params.rv || '';

  return {
    eventName: `GTM ${containerId}`,
    containerId,
    containerConfigId,
    runtimeVersion,
    protocolVersion: params.v,
    hitType: params.t,
    pageId: params.pid,
    tagExecutions: tagExecutions.length > 0 ? tagExecutions : null,
    rawLog: logParam || null,
    params
  };
}
