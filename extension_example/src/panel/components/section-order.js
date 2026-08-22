// ============================================================
// Section Order — stable section IDs, shipped defaults, and the
// applyUserOrder() function that merges the user's sparse stored
// order with the shipped default into a fully-ordered list.
//
// Feature #113 — event detail section reordering.
//
// Why this exists:
//   The event-detail render paths used to call appendChild() in a
//   hardcoded sequence. To let users reorder sections (drag the
//   four-dot handle on the right of each section card), each render
//   path now builds a list of `{ id, present, render }` descriptors
//   and hands it to `applyUserOrder()` which produces the final
//   ordered list to render.
//
// Design notes:
//   - The user's stored order is *sparse*: only ids the user has
//     actually moved are stored. Everything else falls into the gaps
//     in shipped order. This means a user who only moves Raw Request
//     to position 2 gets exactly that change, and any new section we
//     ship later slots into its shipped position without needing a
//     migration.
//   - Overview is always pinned to position 1, regardless of what the
//     user has in storage. The drag handle on the Overview card is
//     omitted by the renderer; this module enforces the invariant on
//     the data side as a defence-in-depth.
//   - This module is pure (no DOM, no storage). The renderer reads
//     settings.lookAndFeel.eventDetailSectionOrder and passes it in.
// ============================================================

/**
 * Canonical list of every section id the event detail can render,
 * in the shipped default order. New sections must be added here so
 * applyUserOrder() can place them correctly when not in the user's
 * stored list.
 *
 * Order reflects the documented layout in panel-code.md:
 *   Overview → AI Summary → About Tool → Cookies → formatted.sections
 *   (Consent, Custom Data, E-Commerce, Products) → script-load
 *   specifics → GTM specifics → Parsed Data → Raw Request.
 *
 * Sections not present on a given event are skipped silently at
 * render time — the order is universal, not per-event-type.
 */
export const SHIPPED_DEFAULT_ORDER = [
  'overview',
  'ai-summary',
  'consent',
  'fingerprint',
  'unknown-event-actions',
  'about-tool',
  'cookies',
  'formatted:consent',
  'formatted:custom-data',
  'formatted:ecommerce',
  'formatted:products',
  'script-dependencies',
  'container-info',
  'cdp-destinations',
  'adobe-launch-extensions',
  'aep-destinations',
  'script-parameters',
  'gtm-environment',
  'datalayer-push',
  'computed-datalayer',
  'parsed-data',
  'raw-request'
];

/**
 * Human-readable labels — used by tests and any future Settings UI
 * that wants to display the section name alongside its id. (Not used
 * by the shipped UI today — Settings carries only the status line +
 * Reset button, not a per-section list.)
 */
export const SECTION_LABELS = {
  'overview': 'Overview',
  'ai-summary': 'AI Summary',
  'consent': 'Consent Check',
  'fingerprint': 'Fingerprint Match',
  'unknown-event-actions': 'Unknown Event Actions',
  'about-tool': 'About Tool',
  'cookies': 'Cookies',
  'formatted:consent': 'Consent Mode',
  'formatted:custom-data': 'Custom Data',
  'formatted:ecommerce': 'E-Commerce',
  'formatted:products': 'Products',
  'script-dependencies': 'Script Dependencies',
  'container-info': 'Container Info',
  'cdp-destinations': 'Destinations Configured',
  'adobe-launch-extensions': 'Adobe Launch Extensions',
  'aep-destinations': 'AEP Destinations',
  'script-parameters': 'Script Parameters',
  'gtm-environment': 'GTM Environment',
  'datalayer-push': 'dataLayer.push',
  'computed-datalayer': 'Computed dataLayer',
  'parsed-data': 'Parsed Data',
  'raw-request': 'Raw Request'
};

/**
 * Sections that only appear on certain event types — used by the
 * Settings UI to show a hint next to the "Default expanded" checkbox.
 * null = appears on all events that have the section.
 */
export const SECTION_AVAILABILITY = {
  'fingerprint': 'Fingerprint-matched events only',
  'unknown-event-actions': 'Generic events only',
  'script-dependencies': 'Script-load events only',
  'container-info': 'GTM container events only',
  'cdp-destinations': 'Segment/RudderStack/Hightouch/mParticle only',
  'adobe-launch-extensions': 'Adobe Launch script loads only',
  'aep-destinations': 'Adobe Web SDK script loads only',
  'script-parameters': 'Script-load events only',
  'gtm-environment': 'GTM container events only',
  'datalayer-push': 'dataLayer events only',
  'computed-datalayer': 'dataLayer events only'
};

/**
 * Sections that are pinned to position 1 and cannot be reordered or
 * dragged. Overview is the only one — it carries the event header
 * (timestamp, platform, comment, intercept badges) and would feel
 * broken anywhere but the top.
 */
export const PINNED_SECTIONS = new Set(['overview']);

/**
 * Merge a sparse user order with the shipped default to produce a
 * fully-ordered list of section ids covering every input descriptor.
 *
 * Algorithm:
 *   1. Start from the shipped default order — every known id in its
 *      shipped position.
 *   2. For each id the user has in their stored order, splice it
 *      into the user's chosen ordinal. Other ids slide to fill the
 *      gap left behind.
 *   3. Overview is always forced to position 1 regardless of what
 *      the user has stored.
 *   4. Filter the result to only the ids that appear in `descriptors`
 *      (i.e. sections that are actually present on this event).
 *
 * Sparse user order means a user who moves Raw Request to slot 2
 * gets exactly that — every other section stays in its shipped slot.
 * New sections shipped later slot into their shipped position
 * without the user re-touching their stored order.
 *
 * @param {Array<{id: string, present: boolean, render: Function}>} descriptors
 *   The render-time list of section descriptors built by a render
 *   path. Order within this list is the shipped order for that
 *   event type — applyUserOrder() rewrites it.
 * @param {Array<string>|null|undefined} userOrder
 *   The user's stored sparse order from
 *   settings.lookAndFeel.eventDetailSectionOrder. May be null /
 *   undefined / empty array → returns descriptors unchanged.
 * @returns {Array<{id: string, present: boolean, render: Function}>}
 *   The descriptors re-ordered. Same objects, new order.
 */
export function applyUserOrder(descriptors, userOrder) {
  if (!Array.isArray(descriptors)) return [];
  if (!Array.isArray(userOrder) || userOrder.length === 0) {
    // No user customization — but still enforce Overview-at-top
    // invariant for paths that might not have it first in their
    // shipped order (defensive; today every path does put it first).
    return enforceOverviewFirst(descriptors);
  }

  // Build a lookup of descriptor by id for fast access.
  const byId = new Map();
  for (const desc of descriptors) {
    if (desc && typeof desc.id === 'string') byId.set(desc.id, desc);
  }

  // Start from SHIPPED_DEFAULT_ORDER projected onto the descriptor
  // set — this gives us a stable baseline that includes every known
  // id whether or not the user has touched it.
  const baseline = SHIPPED_DEFAULT_ORDER.filter((id) => byId.has(id));

  // Also include any descriptor ids not in SHIPPED_DEFAULT_ORDER
  // (forward-compat: a render path could introduce an id we haven't
  // catalogued yet). Append them in their original render-path order.
  for (const desc of descriptors) {
    if (desc && typeof desc.id === 'string' && !baseline.includes(desc.id)) {
      baseline.push(desc.id);
    }
  }

  // Filter the user's order to only entries that are (a) strings and
  // (b) present in the current descriptor set. This is important: the
  // user's intent when they listed ['overview', null, 42, 'raw-request']
  // is "raw-request should be the next thing after overview" — invalid
  // entries should not consume a target slot. Same logic when an id
  // (like 'gtm-environment') is in the user's order but absent from
  // the current event — it shouldn't shift the other entries' slots.
  const effectiveUserOrder = userOrder.filter(
    (id) => typeof id === 'string' && byId.has(id)
  );

  // Apply the filtered sparse order. For each id, pluck it from
  // baseline and re-insert at the index it occupies in the filtered
  // user order (clamped to baseline.length).
  const orderedIds = baseline.slice();
  for (let userIdx = 0; userIdx < effectiveUserOrder.length; userIdx++) {
    const id = effectiveUserOrder[userIdx];
    const currentIdx = orderedIds.indexOf(id);
    if (currentIdx === -1) continue; // defensive — shouldn't happen post-filter
    if (currentIdx === userIdx) continue; // already in place
    // Remove from current position, re-insert at desired position
    orderedIds.splice(currentIdx, 1);
    const insertAt = Math.min(userIdx, orderedIds.length);
    orderedIds.splice(insertAt, 0, id);
  }

  // Force Overview to position 0 regardless of stored order.
  const ovIdx = orderedIds.indexOf('overview');
  if (ovIdx > 0) {
    orderedIds.splice(ovIdx, 1);
    orderedIds.unshift('overview');
  }

  // Map back to descriptors.
  return orderedIds.map((id) => byId.get(id)).filter(Boolean);
}

/**
 * Defensive helper: when no userOrder is supplied, still enforce the
 * Overview-at-top invariant. Today every render path already puts
 * Overview first; this is belt-and-braces.
 */
function enforceOverviewFirst(descriptors) {
  const ovIdx = descriptors.findIndex((d) => d && d.id === 'overview');
  if (ovIdx <= 0) return descriptors;
  const copy = descriptors.slice();
  const [ov] = copy.splice(ovIdx, 1);
  copy.unshift(ov);
  return copy;
}

/**
 * Map a parser-emitted formatted-section title to its stable section
 * id. Universal titles (Consent, Custom Data, E-Commerce Items,
 * Products) get the pre-defined stable ids users can reorder via
 * Settings. Anything else gets a slugified fallback id of the shape
 * `formatted:<slug>` — that section still gets a stable position via
 * applyUserOrder() but won't show up in the Settings list (users can
 * still drag it on the event detail itself).
 *
 * Defined here (not in parsers) so the parser layer stays unaware of
 * the panel-side ordering feature.
 *
 * @param {string} title — the parser's `section.title`
 * @returns {string} stable section id like `formatted:custom-data`
 */
export function formattedSectionIdFromTitle(title) {
  if (typeof title !== 'string' || !title) return 'formatted:unknown';

  // Strip suffix counts like "(12)" or "(3/5 executed)" so titles
  // that vary by count stay on one stable id across events.
  const base = title.replace(/\s*\([^)]*\)\s*$/, '').trim();

  // Universal sections — match the ids in SHIPPED_DEFAULT_ORDER.
  const baseLower = base.toLowerCase();
  if (baseLower === 'consent' || baseLower === 'consent mode' || baseLower === 'consent state') {
    return 'formatted:consent';
  }
  if (baseLower === 'custom data' || baseLower === 'event data'
      || baseLower === 'properties' || baseLower === 'traits'
      || baseLower === 'event properties' || baseLower === 'user properties') {
    return 'formatted:custom-data';
  }
  if (baseLower === 'e-commerce items' || baseLower === 'e-commerce'
      || baseLower === 'items' || baseLower === 'cart items') {
    return 'formatted:ecommerce';
  }
  if (baseLower === 'products') {
    return 'formatted:products';
  }

  // Fallback — slugify the title for a stable but unlisted id. Keeps
  // alnum + replaces spaces / special chars with hyphens.
  const slug = base.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `formatted:${slug || 'unknown'}`;
}

/**
 * Whether the user has any custom section order stored — used by the
 * Settings UI to decide whether to show "Custom section order in use"
 * + Reset button, or the default helper text.
 *
 * @param {Array<string>|null|undefined} userOrder
 * @returns {boolean}
 */
export function hasCustomLayout(userOrder) {
  return Array.isArray(userOrder) && userOrder.length > 0;
}

// ============================================================
// Drag-state guard — see Phase 3. Phase 1 ships the API so the
// renderer can defensively short-circuit re-renders that happen
// mid-drag (e.g. a new event arrives in the stream while the user
// is dragging a section). Phase 3 will write to it from the drag
// handlers.
// ============================================================

let _isDragging = false;

export function setDragging(value) {
  _isDragging = !!value;
}

export function isDragging() {
  return _isDragging;
}
