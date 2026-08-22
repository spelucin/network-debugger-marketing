// Grafana Faro Parsing Utilities
// Extracts event data from Grafana Faro Web SDK collector requests.
//
// Faro payloads (POST JSON to faro-collector-<env>-<region>.grafana.net/collect/<appKey>)
// carry four parallel arrays under a top-level `meta` block:
//   - traces.resourceSpans[]    OpenTelemetry resource/scope spans
//   - events[]                  Faro-instrumented events (faro.tracing.fetch, faro.performance.resource, ...)
//   - logs[]                    SDK logs (console.* mirror, agent.api.pushLog)
//   - exceptions[]              JS errors / unhandled rejections
//   - measurements[]            web vitals + custom measurements
// The shape is documented at https://grafana.com/docs/grafana-cloud/monitor-applications/frontend-observability/
// and in the @grafana/faro-web-sdk source.

const FARO_SIGNAL_KEYS = ['events', 'logs', 'exceptions', 'measurements'];

/**
 * Parse a Grafana Faro collector request.
 * @param {string} url - Request URL (e.g. faro-collector-prod-eu-west-0.grafana.net/collect/<appKey>)
 * @param {string|null} postData - POST body text (JSON)
 * @returns {Object} { appKey, meta, signalCounts, signalNames, observedTargets, body, detectedBy }
 */
export function parseGrafanaFaroRequestData(url, postData) {
  let body = null;
  if (postData) {
    try { body = JSON.parse(postData); } catch { body = null; }
  }

  const appKey = extractAppKey(url);
  const meta = (body && typeof body.meta === 'object') ? body.meta : null;

  const signalCounts = {};
  const signalNames = {};
  let totalSignals = 0;
  for (const key of FARO_SIGNAL_KEYS) {
    const arr = body && Array.isArray(body[key]) ? body[key] : null;
    if (arr && arr.length > 0) {
      signalCounts[key] = arr.length;
      totalSignals += arr.length;
      // Count each signal by its `name` (events / exceptions / measurements)
      // or by `level` (logs).
      const tally = {};
      for (const item of arr) {
        const label = key === 'logs'
          ? (item && item.level ? String(item.level) : 'log')
          : (item && item.name ? String(item.name) : key.slice(0, -1));
        tally[label] = (tally[label] || 0) + 1;
      }
      signalNames[key] = tally;
    }
  }

  // Trace spans live under traces.resourceSpans[].scopeSpans[].spans[]
  let spanCount = 0;
  let traceCount = 0;
  if (body && body.traces && Array.isArray(body.traces.resourceSpans)) {
    traceCount = body.traces.resourceSpans.length;
    for (const rs of body.traces.resourceSpans) {
      if (!rs || !Array.isArray(rs.scopeSpans)) continue;
      for (const ss of rs.scopeSpans) {
        if (ss && Array.isArray(ss.spans)) spanCount += ss.spans.length;
      }
    }
  }
  if (traceCount > 0) {
    signalCounts.traces = traceCount;
    signalCounts.spans = spanCount;
  }

  const observedTargets = extractObservedTargets(body);

  return {
    appKey,
    meta,
    signalCounts,
    signalNames,
    totalSignals,
    spanCount,
    observedTargets,
    body,
    detectedBy: 'URL matches Grafana Faro collector pattern'
  };
}

/**
 * Pull the app key from the /collect/<key> path segment.
 * Returns `null` if the URL doesn't contain a /collect/ segment.
 */
function extractAppKey(url) {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/\/collect\/([^/?#]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Walk every Faro event/span attribute and pull the http.url / name hosts
 * that the SDK is auto-instrumenting. Returns a Map<hostname, count>
 * collapsed to the top contributors so the panel can show "this beacon
 * observed traffic to: amplitude.com, web.telemetric.dk, …".
 */
function extractObservedTargets(body) {
  if (!body) return {};
  const tally = new Map();

  const add = (rawUrl) => {
    if (!rawUrl || typeof rawUrl !== 'string') return;
    try {
      const h = new URL(rawUrl).hostname;
      if (!h) return;
      tally.set(h, (tally.get(h) || 0) + 1);
    } catch { /* not a URL */ }
  };

  // events[].attributes — Faro stores `http.url` (tracing) or `name` (performance.resource)
  if (Array.isArray(body.events)) {
    for (const ev of body.events) {
      if (!ev || !ev.attributes) continue;
      add(ev.attributes['http.url']);
      add(ev.attributes['name']);
    }
  }

  // traces.resourceSpans[].scopeSpans[].spans[].attributes — OTel KV pairs
  if (body.traces && Array.isArray(body.traces.resourceSpans)) {
    for (const rs of body.traces.resourceSpans) {
      if (!rs || !Array.isArray(rs.scopeSpans)) continue;
      for (const ss of rs.scopeSpans) {
        if (!ss || !Array.isArray(ss.spans)) continue;
        for (const span of ss.spans) {
          if (!span || !Array.isArray(span.attributes)) continue;
          for (const attr of span.attributes) {
            if (attr && (attr.key === 'http.url' || attr.key === 'http.host') && attr.value) {
              const v = attr.value.stringValue || attr.value.string_value;
              if (v) {
                if (attr.key === 'http.host') {
                  tally.set(v, (tally.get(v) || 0) + 1);
                } else {
                  add(v);
                }
              }
            }
          }
        }
      }
    }
  }

  // Collapse to plain object sorted by count desc, capped at 20 hosts
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  const result = {};
  for (const [host, n] of sorted) result[host] = n;
  return result;
}

/**
 * Pick the best human-readable event name for this Faro beacon.
 *   - If the beacon carries exactly one signal, use its label
 *   - If multiple, use the dominant kind (`Spans`, `Events`, `Logs`, ...)
 *   - Fallback: "Faro Beacon"
 */
export function buildGrafanaFaroEventName(parsed) {
  const c = parsed.signalCounts || {};
  const entries = Object.entries(c).filter(([k]) => k !== 'traces'); // traces is just resourceSpans, spans is the real number
  if (entries.length === 0) return 'Faro Beacon';

  // Single dominant signal type
  const total = entries.reduce((s, [, n]) => s + n, 0);
  entries.sort((a, b) => b[1] - a[1]);
  const [topKind, topCount] = entries[0];

  // If everything in this beacon is one signal name, surface it
  const tally = parsed.signalNames && parsed.signalNames[topKind];
  if (tally) {
    const names = Object.keys(tally);
    if (names.length === 1) {
      return `${names[0]} (×${topCount})`;
    }
  }

  if (topCount === total) {
    return `${capitalise(topKind)} (×${topCount})`;
  }
  return `Faro Beacon (${total} signals)`;
}

function capitalise(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
