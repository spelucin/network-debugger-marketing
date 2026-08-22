// Supplier registry (Feature #80, v1.3.0).
//
// Models the orthogonal *supplier* dimension for tracking requests — *who*
// hosts, wraps, or attributes the request, distinct from the *platform* axis
// (`platform-registry.js`) which models *what protocol* the request speaks.
//
// Wave 1 entries: Stape (migrated from the one-off #65 implementation),
// Addingwell (CAPI body-stamp), TAGGRS (host pattern). Each entry declares
// any subset of:
//
//   - hostPatterns          — regex array against request hostname
//   - fingerprintPlatformIds — platform IDs whose structural fingerprint also
//                              identifies this supplier
//   - stampSignals          — declarative `partner_agent` / vendor-stamp table
//   - wrapperDecoder        — function reference (Custom Loader-style decode)
//   - cross-event inference — always-on, registry-agnostic, runs over
//                              state.detectedSuppliers in panel.js
//
// Strategies are ORed — any positive signal identifies the supplier.

/**
 * @typedef {Object} StampSignal
 * @property {string} on        — Platform ID whose request carries the stamp (e.g. 'facebook', 'meta-capi')
 * @property {'queryParam'|'body'} source — Where to look
 * @property {string} name      — Field name (param key or body key)
 * @property {string} [prefix]  — Value prefix to match (case-sensitive). Either `prefix` or `pattern` must be set.
 * @property {RegExp} [pattern] — Full regex to match the value. When set, takes precedence over `prefix` —
 *                                use when prefix alone is too loose (e.g. needs a trailing version number).
 */

/**
 * @typedef {Object} SupplierEntry
 * @property {string} id                          — Stable supplier ID, lowercase-kebab
 * @property {string} name                        — Display name
 * @property {string} brandColor                  — Hex brand colour for the pill
 * @property {string} iconRef                     — Key into platform-icons.js (re-uses existing icons)
 * @property {string} annotationLabel             — Pill copy (e.g. 'via Stape')
 * @property {string} annotationTooltip           — Hover tooltip
 * @property {RegExp[]} [hostPatterns]            — Hostname matchers
 * @property {string[]} [fingerprintPlatformIds]  — Platform IDs that also identify this supplier
 * @property {StampSignal[]} [stampSignals]       — Vendor-stamp table
 * @property {Function} [wrapperDecoder]          — Function: (parsedUrl) → decoded | null
 * @property {string[]} [annotatesPlatforms]      — Platform IDs the pill is shown on
 * @property {string[]} [selfRepresentingPlatforms] — Platform IDs that ARE this supplier (suppress pill)
 */

/** @type {SupplierEntry[]} */
export const SUPPLIER_REGISTRY = [
  // ───── Stape ─────────────────────────────────────────────────────────────
  {
    id: 'stape',
    name: 'Stape',
    brandColor: '#FF6D34',
    iconRef: 'stape',
    annotationLabel: 'via Stape',
    annotationTooltip: 'Routed through Stape-hosted server-side GTM',

    hostPatterns: [
      /(^|\.)stape\.(io|be|dog)$/i,
    ],

    fingerprintPlatformIds: ['stape-data-tag'],

    stampSignals: [
      // Pixel `a=stape-gtm-X.Y.Z[-pb]` — regex enforces version trailer so a
      // malformed `a=stape-gtm-` does not false-positive (parity with the
      // pre-#80 regex this generalises).
      { on: 'facebook',  source: 'queryParam', name: 'a',
        pattern: /^stape-gtm-\d+\.\d+\.\d+(-pb)?$/ },
      // Meta CAPI `partner_agent: stape-gtmss-X.Y.Z[-ee]` — same shape, body field.
      { on: 'meta-capi', source: 'body',       name: 'partner_agent',
        pattern: /^stape-gtmss-\d+\.\d+\.\d+(-ee)?$/ },
    ],

    // wrapperDecoder lives in shared/detection/topology.js for now
    // (Feature #76 absorbed into #79). When the supplier registry takes
    // ownership of wrapper decoders in a follow-up release, this field
    // becomes a function reference.

    annotatesPlatforms: ['gtm', 'sgtm', 'gtag', 'facebook', 'meta-capi'],
    selfRepresentingPlatforms: ['stape-data-tag'],
  },

  // ───── Addingwell ────────────────────────────────────────────────────────
  // Signal: `partner_agent: 'gtmss-addingwell-X.Y.Z'` body-stamp on Meta CAPI
  // requests. Verbatim from the public template at
  // github.com/addingwell/meta-conversion-api-tag/blob/master/template.tpl
  {
    id: 'addingwell',
    name: 'Addingwell',
    brandColor: '#1F2A5F',  // navy/blue — Addingwell brand
    iconRef: 'addingwell',  // not yet present in platform-icons; falls back to label when missing
    annotationLabel: 'via Addingwell',
    annotationTooltip: 'Routed through Addingwell-hosted server-side GTM',

    stampSignals: [
      // Addingwell's CAPI body stamp — verbatim shape from their public template
      // (`gtmss-addingwell-1.0.0` today; allow X.Y.Z trailers for future versions).
      { on: 'meta-capi', source: 'body', name: 'partner_agent',
        pattern: /^gtmss-addingwell-\d+\.\d+\.\d+$/ },
    ],

    annotatesPlatforms: ['meta-capi'],
    selfRepresentingPlatforms: [],
  },

  // ───── TAGGRS ────────────────────────────────────────────────────────────
  // Signal: hostname `*.taggrs.io` (default tenant `sst.taggrs.io`, monitoring
  // `api.taggrs.io?container_id=<10-char-id>&event_name=<name>`).
  {
    id: 'taggrs',
    name: 'TAGGRS',
    brandColor: '#14b8a6',  // teal/cyan — TAGGRS brand
    iconRef: 'taggrs',  // not yet present in platform-icons; falls back to label when missing
    annotationLabel: 'via TAGGRS',
    annotationTooltip: 'Routed through TAGGRS-hosted server-side GTM',

    hostPatterns: [
      /(^|\.)taggrs\.io$/i,
    ],

    annotatesPlatforms: ['gtm', 'sgtm', 'gtag', 'meta-capi'],
    selfRepresentingPlatforms: [],
  },
];

/** Quick lookup: supplier ID → entry. */
export const SUPPLIER_BY_ID = Object.freeze(
  Object.fromEntries(SUPPLIER_REGISTRY.map(s => [s.id, s]))
);

/**
 * Test whether a host matches any supplier's hostPatterns. Returns the
 * matched supplier ID or null. Cheap — used by routeRequest to detect
 * supplier-owned hosts on every request.
 *
 * @param {string} host - Lowercase hostname
 * @returns {string | null}
 */
export function matchSupplierHost(host) {
  if (!host) return null;
  for (const supplier of SUPPLIER_REGISTRY) {
    if (!supplier.hostPatterns) continue;
    for (const pattern of supplier.hostPatterns) {
      if (pattern.test(host)) return supplier.id;
    }
  }
  return null;
}

/**
 * Test whether a parsed body or query param carries a known supplier
 * `stampSignal` for a given platform. Returns the matched supplier ID or
 * null.
 *
 * @param {string} platformId - The classified platform of the request (e.g. 'meta-capi')
 * @param {Object} params - URL query params (string → string)
 * @param {Object} body - Parsed request body (any shape — string fields read directly)
 * @returns {string | null}
 */
export function matchSupplierStamp(platformId, params, body) {
  if (!platformId) return null;
  for (const supplier of SUPPLIER_REGISTRY) {
    if (!supplier.stampSignals) continue;
    for (const sig of supplier.stampSignals) {
      if (sig.on !== platformId) continue;
      const bag = sig.source === 'queryParam' ? params : body;
      if (!bag) continue;
      const value = bag[sig.name];
      if (typeof value !== 'string') continue;
      // `pattern` takes precedence when set — gives the strictness real-world
      // signals need (versioned suffix). `prefix` is the fallback for simple
      // startsWith matching.
      if (sig.pattern instanceof RegExp) {
        if (sig.pattern.test(value)) return supplier.id;
      } else if (typeof sig.prefix === 'string' && value.startsWith(sig.prefix)) {
        return supplier.id;
      }
    }
  }
  return null;
}

/**
 * Return the supplier ID associated with a platform whose structural
 * fingerprint just fired (e.g. `stape-data-tag` → `stape`).
 *
 * @param {string} platformId
 * @returns {string | null}
 */
export function matchSupplierFingerprint(platformId) {
  if (!platformId) return null;
  for (const supplier of SUPPLIER_REGISTRY) {
    if (!supplier.fingerprintPlatformIds) continue;
    if (supplier.fingerprintPlatformIds.includes(platformId)) return supplier.id;
  }
  return null;
}

/**
 * Should the supplier pill be shown on this event? `false` when the platform
 * IS the supplier (e.g. don't show "Stape Data Tag via Stape").
 *
 * @param {string} supplierId
 * @param {string} platformId
 * @returns {boolean}
 */
export function shouldShowSupplierPill(supplierId, platformId) {
  const supplier = SUPPLIER_BY_ID[supplierId];
  if (!supplier) return false;
  if (supplier.selfRepresentingPlatforms?.includes(platformId)) return false;
  if (supplier.annotatesPlatforms?.length) {
    return supplier.annotatesPlatforms.includes(platformId);
  }
  return true;
}

/**
 * Build the `formatted.supplier` payload for a classified event. Returns null
 * when no supplier is identified or when the pill should be suppressed.
 *
 * @param {string} supplierId
 * @param {string} platformId
 * @returns {{ id: string, label: string, color: string, tooltip: string, iconRef: string } | null}
 */
export function buildSupplierAnnotation(supplierId, platformId) {
  const supplier = SUPPLIER_BY_ID[supplierId];
  if (!supplier) return null;
  if (!shouldShowSupplierPill(supplierId, platformId)) return null;
  return {
    id: supplier.id,
    label: supplier.annotationLabel,
    color: supplier.brandColor,
    tooltip: supplier.annotationTooltip,
    iconRef: supplier.iconRef,
  };
}
