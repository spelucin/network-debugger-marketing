// Event stream cap (#131 F5)
//
// state.events previously grew without bound — unlike the service worker
// (1,000 events/tab) and recentDataLayerEvents (50). A long DevTools session
// on a chatty SPA accumulates tens of thousands of events at ~2-5 KB each,
// and every O(N) walk (consent counters, renders, exports) scales with it.
//
// The cap evicts from the HEAD (oldest arrivals) in chunks, so the amortized
// cost is one splice + one recount per EVICT_CHUNK additions, and the
// timestamp-ordering invariant that #131 F3's scoped consent invalidation
// relies on is preserved. Reconciliation of derived state deliberately
// reuses rebuildDetectedPlatforms() in panel.js — the same canonical
// recount partial clears already trust — so counter drift cannot happen.
//
// What eviction deliberately does NOT touch (audited 2026-06-10):
//  - Pinned events — pins are independent snapshots in pinned-state.js
//  - knownEventIds — evicted ids MUST stay known, or service-worker polling
//    would re-add evicted events
//  - consentTimeline / firstConsentTimestamp — independent of state.events
//
// What eviction DOES prune (#138 F14, 2026-06-14): the scriptUrl-keyed script-
// relationship maps. The pre-#138 note here claimed these were "bounded by
// distinct scripts" — true for a static site, but a chatty SPA that keeps
// loading uniquely-named scripts grows scriptInitiatorMap / scriptChildrenMap /
// scriptUrlToEventId without bound across a long-lived DevTools session. They
// are now pruned via pruneScriptMaps() in lockstep with head eviction; see that
// function for why tealiumTagConfig is the one map left untouched.
//
// This module is dependency-free so the cap math is unit-testable without
// importing panel.js (tests in tests/panel/event-cap.test.mjs).

export const MAX_EVENTS = 10000;
export const EVICT_CHUNK = 500;

/**
 * How many events to evict from the head, given the current array length.
 * Returns 0 while at-or-under the cap. When over, evicts the overflow PLUS
 * one chunk of headroom, so the held count oscillates in
 * [MAX_EVENTS - EVICT_CHUNK, MAX_EVENTS] instead of paying a splice per add.
 * Never returns more than `length` (defensive — unreachable with production
 * constants, since the newest event can never be part of the evicted head).
 *
 * @param {number} length - current state.events.length
 * @param {number} [maxEvents]
 * @param {number} [chunk]
 * @returns {number}
 */
export function computeEvictCount(length, maxEvents = MAX_EVENTS, chunk = EVICT_CHUNK) {
  if (length <= maxEvents) return 0;
  return Math.min(length, (length - maxEvents) + chunk);
}

/**
 * Prune script-relationship map entries whose owning event has been evicted
 * (#138 F14). The three maps are keyed by scriptUrl; scriptUrlToEventId ties
 * each scriptUrl to the event that created it. Once that event is evicted, the
 * entry is an orphan — no surviving event will look it up (every graph consumer
 * keys lookups off URLs derived from state.events and degrades to a no-op on a
 * miss) — so it can be dropped to reclaim memory in long SPA sessions.
 *
 * scriptChildrenMap is keyed by the PARENT script's URL, which is itself a
 * scriptUrl with a scriptUrlToEventId entry, so an evicted parent's children
 * list is pruned by the same orphan-by-scriptUrl pass. Child URLs that linger
 * inside a surviving parent's array are harmless (Strategy E resolves them
 * against surviving events and skips misses).
 *
 * tealiumTagConfig is intentionally NOT pruned here: it is keyed by Tealium tag
 * UID (bounded by the site's fixed tag configuration, not by script count) and
 * a single config entry is shared across many events, so tying its lifetime to
 * any one evicted event could drop a config a surviving event still needs.
 *
 * @param {Set<string|number>} evictedIds - ids of events removed from the head
 * @param {{scriptInitiatorMap: Map, scriptChildrenMap: Map, scriptUrlToEventId: Map}} maps
 * @returns {number} count of scriptUrl entries pruned
 */
export function pruneScriptMaps(evictedIds, { scriptInitiatorMap, scriptChildrenMap, scriptUrlToEventId } = {}) {
  if (!evictedIds || evictedIds.size === 0) return 0;
  if (!scriptUrlToEventId) return 0;
  const orphanUrls = [];
  for (const [scriptUrl, eventId] of scriptUrlToEventId.entries()) {
    if (evictedIds.has(eventId)) orphanUrls.push(scriptUrl);
  }
  for (const url of orphanUrls) {
    scriptUrlToEventId.delete(url);
    scriptInitiatorMap?.delete(url);
    scriptChildrenMap?.delete(url);
  }
  return orphanUrls.length;
}
