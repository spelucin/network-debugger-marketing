// TMS loader-config parsers — Adobe Launch + (future) Ensighten /
// Commanders Act. Parallel to cdp-destinations.js but for TMSes whose
// container payloads need response-body parsing (vs. embedded payloads
// like Tealium loader.cfg or telemetry like GTM tag executions).
//
// Adobe Launch publishes its container as a JS literal embedded in the
// library script, just like GTM. Two signals:
//   1. `container.extensions` — keyed by canonical extension name
//      ('adobe-analytics', 'adobe-target', 'google-analytics-4', …).
//      These are the extensions installed in the Launch property —
//      configured to load.
//   2. `container.rules[*].actions[*].modulePath` — strings shaped
//      `'<extension-name>/src/lib/actions/...'`. The prefix before the
//      first `/` is the canonical extension name. A rule action with a
//      `modulePath` from a given extension means that extension's
//      action will run when the rule fires — so this is the strongest
//      signal that the extension is actually used (not just installed).
//
// We surface both: the parser returns `extensions[]` and
// `actionExtensions[]` (deduplicated extension names referenced by rule
// actions). Strategy A consumes both — installed gives breadth,
// rule-actions give the authoritative subset that actually executes.

// Adobe Launch canonical extension name → platform-registry id.
// Names are stable (preserved through minification because the runtime
// resolves modules by string lookup). New extensions land in the Adobe
// catalog regularly; substring patterns mirror what GTM_TAG_TYPE_TO_PLATFORMS
// does so we don't lose extensions named slightly differently from the
// canonical key.
const ADOBE_LAUNCH_EXTENSION_PATTERNS = [
  // Adobe — first-party extensions
  { pattern: /^adobe-analytics$/i, platformId: 'adobe-analytics' },
  { pattern: /^adobe-target$/i, platformId: 'adobe-target' },
  { pattern: /^adobe-audience-manager$|^audience-manager$/i, platformId: 'adobe-audience-manager' },
  { pattern: /^adobe-experience-platform$|^web-sdk$|^alloy$/i, platformId: 'adobe-experience-platform' },
  // Google
  { pattern: /^google-analytics$/i, platformId: 'google-analytics' },
  { pattern: /^google-analytics-4$|^ga4$/i, platformId: 'ga4' },
  { pattern: /^google-tag-manager$|^gtag$/i, platformId: 'gtm' },
  { pattern: /^google-ads$|^adwords$/i, platformId: 'google-ads-conversion' },
  // Meta / social
  { pattern: /^facebook(-pixel)?$/i, platformId: 'facebook' },
  { pattern: /^linkedin(-insight)?$/i, platformId: 'linkedin' },
  { pattern: /^twitter$|^x-tag$/i, platformId: 'twitter' },
  { pattern: /^pinterest(-tag)?$/i, platformId: 'pinterest' },
  { pattern: /^tiktok$/i, platformId: 'tiktok' },
  // Product analytics
  { pattern: /^mixpanel$/i, platformId: 'mixpanel' },
  { pattern: /^amplitude$/i, platformId: 'amplitude' },
  // Session replay / heatmap
  { pattern: /^hotjar$/i, platformId: 'hotjar' },
  { pattern: /^fullstory$/i, platformId: 'fullstory' },
  // Ad tech
  { pattern: /^criteo$/i, platformId: 'criteo' },
  // Note: 'core', 'mobile-core', 'web' are Adobe Launch's built-in
  // extensions — they don't map to a third-party platform. Intentionally
  // omitted so they don't pollute the loader index.
];

/**
 * Parse an Adobe Launch published library response body, extracting
 * the list of installed extensions and the set of extensions referenced
 * by rule actions. Resilient to minification — keys we care about
 * (`extensions`, `rules`, `modulePath`) are preserved as string literals
 * because the Launch runtime resolves them dynamically.
 *
 * Returns null on parse failure so callers keep emitting the captured
 * event without the rich section. Never throws.
 *
 * Strategy:
 *   1. Find the `"extensions":{` substring (most common — quoted key) or
 *      `extensions:{` fallback. Bracket-count to the matching `}` to
 *      delimit the extensions block.
 *   2. Inside that block, identify top-level keys at depth=1 — those
 *      are extension names.
 *   3. Find every `"modulePath":"<x>/..."` occurrence in the whole body;
 *      the prefix before the first `/` is the extension name an action
 *      belongs to.
 *
 * @param {string} content - Raw response body (the Launch library JS)
 * @returns {{
 *   extensions: Array<{ name: string, platformId: string|null }>,
 *   actionExtensions: Array<{ name: string, platformId: string|null }>,
 *   extensionCount: number,
 * }|null}
 */
export function parseAdobeLaunchContainer(content) {
  if (!content || typeof content !== 'string') return null;
  if (content.length > 5 * 1024 * 1024) return null; // 5MB cap — Launch libraries are typically <1MB

  // ---- Step 1: locate the extensions block ----
  // Match either "extensions":{ or 'extensions':{ — minified Launch
  // libraries virtually always quote string keys.
  const extMatch = content.match(/["']extensions["']\s*:\s*\{/);
  if (!extMatch) return null;
  const blockStart = extMatch.index + extMatch[0].length - 1; // points at the opening `{`

  // ---- Step 2: bracket-count to find the closing `}` ----
  // Tracks depth + tolerates nested strings (single and double-quoted).
  let depth = 0;
  let blockEnd = -1;
  for (let i = blockStart; i < content.length; i++) {
    const ch = content[i];
    if (ch === '"' || ch === "'") {
      // Skip the string literal — don't count braces inside.
      const quote = ch;
      i += 1;
      while (i < content.length) {
        const c = content[i];
        if (c === '\\') { i += 2; continue; } // skip escaped char
        if (c === quote) break;
        i += 1;
      }
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) { blockEnd = i; break; }
    }
  }
  if (blockEnd === -1) return null;

  // ---- Step 3: extract top-level keys at depth=1 ----
  const extensionsBlock = content.slice(blockStart + 1, blockEnd);
  const extensionNames = extractTopLevelKeys(extensionsBlock);

  // ---- Step 4: scan modulePath occurrences across the entire body ----
  // The prefix before the first `/` is the extension name that owns
  // the module. Both single and double quoted; matchAll handles both
  // via the alternation in the regex.
  const actionNames = new Set();
  const modulePathRe = /["']modulePath["']\s*:\s*["']([^"']+?)\/[^"']+?["']/g;
  for (const match of content.matchAll(modulePathRe)) {
    if (match[1]) actionNames.add(match[1]);
  }

  // Filter out built-in 'core' / 'mobile-core' / 'web' from the
  // surfaced lists — they aren't third-party loaders.
  const isBuiltIn = (name) => /^(?:mobile-)?core$|^web$/i.test(name);

  const extensions = extensionNames
    .filter((name) => !isBuiltIn(name))
    .map((name) => ({ name, platformId: matchAdobeLaunchExtension(name) }));

  const actionExtensions = [...actionNames]
    .filter((name) => !isBuiltIn(name))
    .map((name) => ({ name, platformId: matchAdobeLaunchExtension(name) }));

  return {
    extensions,
    actionExtensions,
    extensionCount: extensions.length,
  };
}

/**
 * Walk a JS-object body string and extract its top-level keys.
 * Handles nested objects/arrays and string literals. Returns the keys
 * in encounter order (no deduplication — Launch containers don't
 * repeat keys at the same level).
 *
 * Keys can be quoted ("foo" / 'foo') or bare (`foo:`).
 *
 * @param {string} body - the contents BETWEEN the outer `{` and `}`
 *   (exclusive — caller has already stripped them)
 * @returns {string[]}
 */
function extractTopLevelKeys(body) {
  const keys = [];
  let depth = 0;
  let i = 0;
  while (i < body.length) {
    const ch = body[i];

    // Skip string literals at any depth — quotes inside don't count.
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const startsAtDepthZero = depth === 0;
      const stringStart = i + 1;
      i += 1;
      while (i < body.length) {
        const c = body[i];
        if (c === '\\') { i += 2; continue; }
        if (c === quote) break;
        i += 1;
      }
      // If this quoted string was at depth 0, peek ahead for `:` —
      // that confirms it's a key.
      if (startsAtDepthZero) {
        const stringEnd = i;
        let j = i + 1;
        while (j < body.length && /\s/.test(body[j])) j += 1;
        if (body[j] === ':') {
          keys.push(body.slice(stringStart, stringEnd));
        }
      }
      i += 1;
      continue;
    }

    if (ch === '{' || ch === '[') depth += 1;
    else if (ch === '}' || ch === ']') depth -= 1;

    // Bare unquoted key — runs of identifier chars at depth 0 followed
    // by `:`. Rare in modern minified Launch libraries (which always
    // quote keys for safety), but handles older or hand-edited libs.
    if (depth === 0 && /[A-Za-z_$]/.test(ch)) {
      let j = i;
      while (j < body.length && /[A-Za-z0-9_$-]/.test(body[j])) j += 1;
      let k = j;
      while (k < body.length && /\s/.test(body[k])) k += 1;
      if (body[k] === ':') {
        keys.push(body.slice(i, j));
        i = k;
        continue;
      }
    }

    i += 1;
  }
  return keys;
}

// Map an Adobe Launch extension name to a platform-registry id, or
// null if no match.
export function matchAdobeLaunchExtension(name) {
  if (!name || typeof name !== 'string') return null;
  for (const { pattern, platformId } of ADOBE_LAUNCH_EXTENSION_PATTERNS) {
    if (pattern.test(name)) return platformId;
  }
  return null;
}

/**
 * Detect whether a URL is an Adobe Launch published library.
 * Two host families:
 *   - assets.adobedtm.com/launch-{ENVID}.min.js (Adobe-hosted CDN)
 *   - first-party hosting: any path matching /launch-[A-Za-z0-9]+-...min.js
 *
 * Note: this overlaps with the existing platform-registry detection
 * for adobe-launch (which determines that a URL is a Launch library at
 * all). This helper specifically identifies URLs we want to fetch the
 * response body for — same set, narrower purpose.
 */
export function isAdobeLaunchLibraryUrl(url) {
  if (!url) return false;
  if (/assets\.adobedtm\.com\/.*\.js/i.test(url)) return true;
  if (/launch\.adobe\.com\/.*\.js/i.test(url)) return true;
  // First-party hosting — `launch-{ENVID}.min.js` (production) or
  // `launch-{ENVID}-{ENVNAME}.min.js` (dev/staging).
  if (/\/launch-[A-Za-z0-9]+(?:-[^/]+)?\.min\.js$/i.test(url)) return true;
  return false;
}

/**
 * Parse an Adobe Experience Platform Web SDK (alloy.js) interact-endpoint
 * response. The Edge Network may dispatch audience-activation destinations
 * via `handle[]` entries of type `activation:push` (canonical) or
 * `destinations` (legacy). Each entry's `payload[]` lists URL pixels and
 * cookie syncs that the SDK fires on behalf of the page.
 *
 * Different from CDP / TMS sources: AEP doesn't tell us "this vendor was
 * loaded" — it tells us "fire this URL". We map URLs to platform-ids via
 * a caller-supplied resolver (the panel passes `matchKnownEndpoint`)
 * because the URL→platform routing logic lives in the panel layer
 * (where the registry index is hot-cached).
 *
 * Returns null on parse failure. Never throws.
 *
 * @param {string} content - Raw response body (JSON text)
 * @param {(url: string) => string | null} [urlResolver] - Optional. Maps
 *   an absolute URL to a platform-id. Caller supplies the panel-layer
 *   matcher; the parser is host-agnostic. When omitted, destinations
 *   come back with `platformId: null` and the caller can resolve later.
 * @returns {{
 *   destinations: Array<{ url: string, type: string, platformId: string|null }>,
 *   destinationCount: number,
 *   handleTypes: string[],
 * }|null}
 */
export function parseAepInteractResponse(content, urlResolver) {
  if (!content) return null;
  let body;
  try {
    body = JSON.parse(content);
  } catch {
    return null;
  }
  if (!body || !Array.isArray(body.handle)) return null;

  const destinations = [];
  const handleTypes = [];
  for (const entry of body.handle) {
    if (entry && typeof entry.type === 'string') handleTypes.push(entry.type);
    // Both `activation:push` (RTCDP audiences) and the legacy
    // `destinations` type carry the same payload shape: array of
    // url/cookie items with `spec.url`.
    if (entry?.type !== 'activation:push' && entry?.type !== 'destinations') continue;
    const payload = Array.isArray(entry.payload) ? entry.payload : [];
    for (const item of payload) {
      if (!item || typeof item !== 'object') continue;
      // URL pixel — fired by the SDK as a tracking pixel notification.
      if (item.type === 'url' && item.spec?.url) {
        const url = item.spec.url;
        const resolved = typeof urlResolver === 'function' ? urlResolver(url) : null;
        destinations.push({
          url,
          type: 'url',
          platformId: resolved || null,
        });
      }
      // Cookie sync — server-orchestrated cookie write. Surfaced for
      // visibility but typically can't be platform-resolved.
      else if (item.type === 'cookie' && item.spec?.url) {
        const url = item.spec.url;
        const resolved = typeof urlResolver === 'function' ? urlResolver(url) : null;
        destinations.push({
          url,
          type: 'cookie',
          platformId: resolved || null,
        });
      }
    }
  }

  return {
    destinations,
    destinationCount: destinations.length,
    handleTypes,
  };
}

/**
 * Detect whether a URL is the AEP Web SDK interact endpoint.
 * Adobe-hosted: `edge.adobedc.net/ee/v{N}/interact` (and various regional
 * edge.<region>.adobedc.net subdomains).
 * First-party CNAME variants typically end in `.alloyio.com` or use a
 * customer-supplied subdomain that proxies to the Edge Network — the
 * stable signature is the `/ee/v{N}/interact` path.
 */
export function isAepInteractUrl(url) {
  if (!url) return false;
  return /\/ee\/v\d+\/interact(?:\?|$)/i.test(url);
}
