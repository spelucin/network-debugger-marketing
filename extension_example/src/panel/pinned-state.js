/**
 * Pinned state — Feature #45 Phase 1 + Phase 2 starter (groups + notes).
 *
 * Persistent per-domain "parking spot" for events. A pinned event survives
 * `clearEvents()` and reloads of the inspected page.
 *
 * Storage shape (chrome.storage.local key `pinned_state`):
 *   {
 *     '<domain>': {
 *       pinnedEvents: [
 *         {
 *           pinId: <event.id>,
 *           contentFp: 'fp_<hash>',
 *           pinnedAt: <ms>,
 *           note: '<user-entered string>',  // Phase 1 inline note
 *           groupIds: ['group_<uuid>'],     // Phase 2 group memberships
 *           snapshot: <event object>
 *         }
 *       ],
 *       groups: [
 *         { id: 'group_<uuid>', name: '<user-entered>', createdAt: <ms> }
 *       ],
 *       schemaVersion: 1
 *     }
 *   }
 *
 * **Pin keying is event-instance-level.** Two captures of the same logical
 * event (e.g. two `page_view` calls with the same params) are pinned
 * independently — the user sees a separate row indicator on each, and each
 * lives as its own Pinned-view entry. `pinId === event.id` is the
 * discriminator.
 *
 * `contentFp` is a stable per-platform content hash carried alongside but
 * not used for in-session dedup. It exists for Phase 3's AI Journey
 * Analysis review-marks gate, where after a session restart the persisted
 * snapshots need to be re-applied against newly-captured live events that
 * have fresh `event.id`s.
 *
 * Snapshots store the full captured event object so the existing
 * createEventItem / renderEventDetail renderers work unchanged in the
 * Pinned view, even after `clearEvents()` empties `state.events`.
 */

const STORAGE_KEY = 'pinned_state';
const SCHEMA_VERSION = 1;

// In-memory mirror of the storage object. Keyed by registrable domain.
// `null` = not yet loaded; `{}` = loaded but empty.
let cache = null;

// Subscribers fire after every successful pin / unpin.
const subscribers = new Set();

/**
 * Compute a stable fingerprint id for an event. Two captures of the same
 * underlying tracking event on the same page should produce the same fpId
 * so we don't end up with duplicates after a re-pin attempt.
 *
 * Per-platform "key params" subset is intentionally narrow — page_path for
 * GA4, event_type for Amplitude, type+selector for interactions, etc.
 * Keeping the subset narrow trades a small false-merge risk for stable
 * dedup across reloads.
 */
export function fingerprintEvent(event) {
  if (!event) return 'fp_invalid';
  const platform = String(event.platform || 'unknown');
  const name = String(event.eventName || event.formatted?.eventType || 'unknown');
  const keyParams = pickKeyParams(event);
  const raw = `${platform}|${name}|${keyParams}`;
  return `fp_${djb2(raw)}`;
}

function pickKeyParams(event) {
  const f = event.formatted || {};
  const p = f.params || {};
  switch (event.platform) {
    case 'ga4':
    case 'sgtm':
    case 'sst-ga4':  // legacy id from v1.0.0–v1.3.0; kept so pinned events persisted before the v1.3.x rename still dedupe under the same key
      return [p.event_name, p.page_path, p.page_location].filter(Boolean).join('::');
    case 'amplitude':
      return [p.event_type, p.user_id, p.session_id].filter(Boolean).join('::');
    case 'mixpanel':
      return [p.event, p.distinct_id].filter(Boolean).join('::');
    case 'segment':
    case 'rudderstack':
    case 'hightouch':
      return [p.type, p.event, p.userId, p.anonymousId].filter(Boolean).join('::');
    case 'facebook':
      return [p.event, p.eid].filter(Boolean).join('::');
    case 'interaction':
      return [p.type, p.text, p.selector].filter(Boolean).join('::');
    default:
      // Fallback: use the parsed URL path as a tie-breaker so two captures
      // of the same endpoint dedupe but two captures of distinct endpoints
      // don't.
      return String(event.url || event.raw?.url || event.id || '').slice(0, 200);
  }
}

// djb2 string hash — short, deterministic, no crypto dependency.
function djb2(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

/**
 * Load the persisted pinned state into the in-memory cache. Idempotent —
 * call once at panel boot.
 */
export async function loadPinnedState() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    cache = result[STORAGE_KEY] || {};
  } catch (_) {
    cache = {};
  }
  // Normalise every domain entry on load so the rest of the module can
  // assume the Phase 2 shape (groups, note, groupIds) without per-call
  // defensive checks.
  for (const domain of Object.keys(cache)) {
    cache[domain] = normalizeEntry(cache[domain]);
  }
  return cache;
}

function ensureLoaded() {
  if (cache === null) {
    // Lazy fallback for callers that hit a synchronous code path before
    // loadPinnedState() resolves. Returns empty until the async load lands.
    cache = {};
  }
  return cache;
}

function getDomainEntry(domain) {
  const c = ensureLoaded();
  return c[domain] || { pinnedEvents: [], groups: [], schemaVersion: SCHEMA_VERSION };
}

// Lazy-upgrade an entry to the Phase 2 shape so older persisted records
// from earlier Phase 1 builds (no `groups`, no `note`, no `groupIds`) keep
// working without a hand-written migration.
function normalizeEntry(entry) {
  if (!entry) return { pinnedEvents: [], groups: [], schemaVersion: SCHEMA_VERSION };
  if (!Array.isArray(entry.groups)) entry.groups = [];
  if (Array.isArray(entry.pinnedEvents)) {
    for (const p of entry.pinnedEvents) {
      if (typeof p.note !== 'string') p.note = '';
      if (!Array.isArray(p.groupIds)) p.groupIds = [];
    }
  }
  return entry;
}

async function persist() {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: cache });
  } catch (_) {
    // Storage may be unavailable in test contexts — non-critical
  }
  for (const fn of subscribers) {
    try { fn(); } catch (_) { /* subscriber bug shouldn't break persistence */ }
  }
}

/** True if `event` is currently pinned for `domain`. Keyed on event.id. */
export function isPinned(event, domain) {
  if (!event || !domain || !event.id) return false;
  const entry = getDomainEntry(domain);
  return entry.pinnedEvents.some(p => p.pinId === event.id);
}

/** True if `eventId` is the id of a pinned snapshot for `domain`. */
export function isPinnedById(eventId, domain) {
  if (!eventId || !domain) return false;
  const entry = getDomainEntry(domain);
  return entry.pinnedEvents.some(p => p.pinId === eventId);
}

/** Look up a pinned snapshot by its pinId (= original event.id). */
export function getPinnedSnapshotById(eventId, domain) {
  if (!eventId || !domain) return null;
  const entry = getDomainEntry(domain);
  const hit = entry.pinnedEvents.find(p => p.pinId === eventId);
  return hit ? hit.snapshot : null;
}

/**
 * Look up a pinned snapshot across every domain. Returns the snapshot and
 * the domain it was found on so callers can label the result. Used by
 * copy/export paths in Pinned view, where the right-clicked group can
 * belong to a different domain than the one DevTools is currently
 * inspecting.
 */
export function getPinnedSnapshotByIdAcrossDomains(eventId) {
  if (!eventId) return null;
  const c = ensureLoaded();
  for (const domain of Object.keys(c)) {
    const entry = c[domain];
    if (!entry || !Array.isArray(entry.pinnedEvents)) continue;
    const hit = entry.pinnedEvents.find(p => p.pinId === eventId);
    if (hit) return { snapshot: hit.snapshot, domain };
  }
  return null;
}

/**
 * Toggle pin state for `event` on `domain`. Returns the new state
 * (`true` = pinned, `false` = unpinned). Keyed on event.id so two
 * captures of the same logical event are pinned independently.
 */
export async function togglePin(event, domain) {
  if (!event || !domain || !event.id) return false;
  const c = ensureLoaded();
  const entry = normalizeEntry(c[domain]);
  const existingIdx = entry.pinnedEvents.findIndex(p => p.pinId === event.id);

  let nowPinned;
  if (existingIdx >= 0) {
    entry.pinnedEvents.splice(existingIdx, 1);
    nowPinned = false;
  } else {
    entry.pinnedEvents.push({
      pinId: event.id,
      contentFp: fingerprintEvent(event),
      pinnedAt: Date.now(),
      note: '',
      groupIds: [],
      snapshot: snapshotEvent(event),
    });
    nowPinned = true;
  }

  // Drop the domain entry only when both pinnedEvents and groups are empty —
  // an empty group with no pins is still meaningful (the user just made it).
  if (entry.pinnedEvents.length === 0 && entry.groups.length === 0) {
    delete c[domain];
  } else {
    c[domain] = entry;
  }

  await persist();
  return nowPinned;
}

/**
 * Set or clear the inline note shown after the event name in Pinned view.
 * Empty string is treated as "no note" but stored verbatim — the renderer
 * decides whether to show a placeholder.
 */
export async function setPinnedNote(eventId, domain, note) {
  if (!eventId || !domain) return;
  const c = ensureLoaded();
  const entry = normalizeEntry(c[domain]);
  const hit = entry.pinnedEvents.find(p => p.pinId === eventId);
  if (!hit) return;
  hit.note = String(note || '');
  c[domain] = entry;
  await persist();
}

export function getPinnedNote(eventId, domain) {
  if (!eventId || !domain) return '';
  const entry = getDomainEntry(domain);
  const hit = entry.pinnedEvents.find(p => p.pinId === eventId);
  return hit ? (hit.note || '') : '';
}

// ===== Groups =====

function uuid() {
  // RFC4122-ish v4; good enough for client-side ids.
  return 'group_' + 'xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));
}

/**
 * Create a new group on `domain` with the given name. Returns the new
 * group object (`{ id, name, createdAt }`). Caller is expected to have
 * trimmed/validated the name.
 */
export async function createGroup(domain, name) {
  if (!domain || !name) return null;
  const c = ensureLoaded();
  const entry = normalizeEntry(c[domain]);
  const group = { id: uuid(), name: String(name), createdAt: Date.now() };
  entry.groups.push(group);
  c[domain] = entry;
  await persist();
  return group;
}

export function getGroupsForDomain(domain) {
  return getDomainEntry(domain).groups.slice();
}

/** Look up a single group record by id. Returns null if not found. */
export function getGroupById(domain, groupId) {
  if (!domain || !groupId) return null;
  const entry = getDomainEntry(domain);
  return entry.groups.find(g => g.id === groupId) || null;
}

/**
 * Rename a group. Trims whitespace; rejects empty names. Returns true on
 * success, false otherwise (no-op when name is unchanged).
 */
export async function renameGroup(domain, groupId, newName) {
  if (!domain || !groupId) return false;
  const trimmed = String(newName || '').trim();
  if (!trimmed) return false;
  const c = ensureLoaded();
  const entry = normalizeEntry(c[domain]);
  const group = entry.groups.find(g => g.id === groupId);
  if (!group || group.name === trimmed) return false;
  group.name = trimmed;
  c[domain] = entry;
  await persist();
  return true;
}

/**
 * Reorder `draggedGroupId` relative to `targetGroupId`. Pure array reorder
 * — no new field, no schema change.
 *
 * `position` ('before' default | 'after') controls which side of the target
 * the dragged group lands on:
 *   - 'before': dragged lands at target's slot; target and following shift down
 *   - 'after':  dragged lands at target's slot + 1; following groups shift down
 *
 * Returns true on success, false on no-op or invalid ids. Same-group and
 * already-adjacent-in-the-requested-direction are both no-ops.
 */
export async function reorderGroup(domain, draggedGroupId, targetGroupId, position = 'before') {
  if (!domain || !draggedGroupId || !targetGroupId) return false;
  if (draggedGroupId === targetGroupId) return false;
  if (position !== 'before' && position !== 'after') return false;
  const c = ensureLoaded();
  const entry = normalizeEntry(c[domain]);
  const groups = entry.groups;
  const draggedIdx = groups.findIndex(g => g.id === draggedGroupId);
  const targetIdx = groups.findIndex(g => g.id === targetGroupId);
  if (draggedIdx < 0 || targetIdx < 0) return false;
  // Compute the destination index in the *pre-splice* coordinate system,
  // then adjust for the splice if the dragged group was originally before
  // the target.
  let destIdx = position === 'before' ? targetIdx : targetIdx + 1;
  // Already-in-place no-op: dragging onto your own slot or the slot
  // immediately after yourself when the target is the next-door neighbour.
  if (destIdx === draggedIdx || destIdx === draggedIdx + 1) return false;
  const [dragged] = groups.splice(draggedIdx, 1);
  const insertAt = draggedIdx < destIdx ? destIdx - 1 : destIdx;
  groups.splice(insertAt, 0, dragged);
  c[domain] = entry;
  await persist();
  return true;
}

/**
 * Delete a group. Pins that were members of this group lose the membership
 * (their `groupIds` is filtered) — the pins themselves are NOT deleted, they
 * fall back to Inbox. This matches the spec's rule:
 *   "Delete group → events stay pinned in Inbox"
 */
export async function deleteGroup(domain, groupId) {
  if (!domain || !groupId) return false;
  const c = ensureLoaded();
  const entry = normalizeEntry(c[domain]);
  const idx = entry.groups.findIndex(g => g.id === groupId);
  if (idx < 0) return false;
  entry.groups.splice(idx, 1);
  for (const p of entry.pinnedEvents) {
    if (Array.isArray(p.groupIds)) {
      p.groupIds = p.groupIds.filter(id => id !== groupId);
    }
  }
  if (entry.pinnedEvents.length === 0 && entry.groups.length === 0) {
    delete c[domain];
  } else {
    c[domain] = entry;
  }
  await persist();
  return true;
}

/**
 * Move `eventId` so it's a member of *only* `groupId` — replaces any
 * existing memberships. Pass `null` (or 'inbox') to move to Inbox.
 */
export async function movePinToGroup(eventId, domain, groupId) {
  if (!eventId || !domain) return false;
  const c = ensureLoaded();
  const entry = normalizeEntry(c[domain]);
  const pin = entry.pinnedEvents.find(p => p.pinId === eventId);
  if (!pin) return false;
  pin.groupIds = (groupId && groupId !== 'inbox') ? [groupId] : [];
  c[domain] = entry;
  await persist();
  return true;
}

/**
 * Add `eventId` to `groupId` *additively* — preserves existing memberships.
 * No-op if already a member.
 */
export async function addPinToGroup(eventId, domain, groupId) {
  if (!eventId || !domain || !groupId || groupId === 'inbox') return false;
  const c = ensureLoaded();
  const entry = normalizeEntry(c[domain]);
  const pin = entry.pinnedEvents.find(p => p.pinId === eventId);
  if (!pin) return false;
  if (!Array.isArray(pin.groupIds)) pin.groupIds = [];
  if (pin.groupIds.includes(groupId)) return false;
  pin.groupIds.push(groupId);
  c[domain] = entry;
  await persist();
  return true;
}

/**
 * Remove `eventId`'s membership in `groupId` — the pin itself stays
 * (returns to Inbox if this was its only group). For full unpin, use
 * `togglePin` instead.
 */
export async function removePinFromGroup(eventId, domain, groupId) {
  if (!eventId || !domain || !groupId) return false;
  const c = ensureLoaded();
  const entry = normalizeEntry(c[domain]);
  const pin = entry.pinnedEvents.find(p => p.pinId === eventId);
  if (!pin || !Array.isArray(pin.groupIds)) return false;
  const before = pin.groupIds.length;
  pin.groupIds = pin.groupIds.filter(id => id !== groupId);
  if (pin.groupIds.length === before) return false;
  c[domain] = entry;
  await persist();
  return true;
}

/**
 * Bulk variant of movePinToGroup — moves N pins to the same target group
 * with a single persist() call. Pass `null` (or 'inbox') to move to Inbox.
 * Returns the count of pins actually moved (skips ids that aren't pinned).
 */
export async function movePinsToGroup(eventIds, domain, groupId) {
  if (!Array.isArray(eventIds) || eventIds.length === 0 || !domain) return 0;
  const c = ensureLoaded();
  const entry = normalizeEntry(c[domain]);
  const target = (groupId && groupId !== 'inbox') ? [groupId] : [];
  let moved = 0;
  for (const eventId of eventIds) {
    const pin = entry.pinnedEvents.find(p => p.pinId === eventId);
    if (!pin) continue;
    pin.groupIds = target.slice();
    moved++;
  }
  if (moved > 0) {
    c[domain] = entry;
    await persist();
  }
  return moved;
}

/**
 * Bulk variant of addPinToGroup — additively adds N pins to a group with
 * a single persist() call. Skips ids that aren't pinned or are already
 * members. Returns the count of pins actually added.
 */
export async function addPinsToGroup(eventIds, domain, groupId) {
  if (!Array.isArray(eventIds) || eventIds.length === 0 || !domain) return 0;
  if (!groupId || groupId === 'inbox') return 0;
  const c = ensureLoaded();
  const entry = normalizeEntry(c[domain]);
  let added = 0;
  for (const eventId of eventIds) {
    const pin = entry.pinnedEvents.find(p => p.pinId === eventId);
    if (!pin) continue;
    if (!Array.isArray(pin.groupIds)) pin.groupIds = [];
    if (pin.groupIds.includes(groupId)) continue;
    pin.groupIds.push(groupId);
    added++;
  }
  if (added > 0) {
    c[domain] = entry;
    await persist();
  }
  return added;
}

/**
 * Bulk variant of removePinFromGroup — removes N pins from a group with a
 * single persist() call. Pins fall back to Inbox if this was their only
 * group. Returns the count of pins actually removed from the group.
 */
export async function removePinsFromGroup(eventIds, domain, groupId) {
  if (!Array.isArray(eventIds) || eventIds.length === 0 || !domain || !groupId) return 0;
  const c = ensureLoaded();
  const entry = normalizeEntry(c[domain]);
  let removed = 0;
  for (const eventId of eventIds) {
    const pin = entry.pinnedEvents.find(p => p.pinId === eventId);
    if (!pin || !Array.isArray(pin.groupIds)) continue;
    const before = pin.groupIds.length;
    pin.groupIds = pin.groupIds.filter(id => id !== groupId);
    if (pin.groupIds.length !== before) removed++;
  }
  if (removed > 0) {
    c[domain] = entry;
    await persist();
  }
  return removed;
}

/**
 * Pin `event` and immediately drop it into `groupId`. Used by Stream view's
 * right-click → "Pin to ▸ {group}" submenu. Returns the pin's id.
 */
export async function pinEventIntoGroup(event, domain, groupId) {
  if (!event || !domain || !event.id) return null;
  const c = ensureLoaded();
  const entry = normalizeEntry(c[domain]);
  let pin = entry.pinnedEvents.find(p => p.pinId === event.id);
  if (!pin) {
    pin = {
      pinId: event.id,
      contentFp: fingerprintEvent(event),
      pinnedAt: Date.now(),
      note: '',
      groupIds: [],
      snapshot: snapshotEvent(event),
    };
    entry.pinnedEvents.push(pin);
  }
  if (groupId && groupId !== 'inbox') {
    if (!Array.isArray(pin.groupIds)) pin.groupIds = [];
    if (!pin.groupIds.includes(groupId)) pin.groupIds.push(groupId);
  } else {
    pin.groupIds = [];
  }
  c[domain] = entry;
  await persist();
  return event.id;
}

/**
 * Pin records and groups for every domain that has at least one of
 * either. Used by the multi-domain Pinned view layout.
 */
export function getAllDomainsWithPins() {
  const c = ensureLoaded();
  return Object.keys(c).filter(d => {
    const e = c[d];
    return (e.pinnedEvents && e.pinnedEvents.length > 0)
      || (e.groups && e.groups.length > 0);
  });
}

/**
 * Full pinned-events records (not just snapshots) for a domain — needed
 * by the Pinned view so it can read `note` and `groupIds` per-pin.
 */
export function getPinnedRecordsForDomain(domain) {
  return getDomainEntry(domain).pinnedEvents.slice();
}

/**
 * Strip in-memory-only fields from an event before snapshotting. Keeps the
 * snapshot reasonably small without losing anything the renderers need.
 */
function snapshotEvent(event) {
  // Shallow clone — formatted/params are JSON-safe primitives or plain objects.
  // Drop heavy/cyclic fields that the renderers don't need from a snapshot.
  const { _aiSummaries, _interceptedBy, ...rest } = event;
  try {
    return JSON.parse(JSON.stringify(rest));
  } catch (_) {
    // Defensive: if anything is non-cloneable, fall back to a minimal shape.
    return {
      id: event.id,
      platform: event.platform,
      platformName: event.platformName,
      eventName: event.eventName,
      timestamp: event.timestamp,
      url: event.url,
    };
  }
}

/** Return all pinned snapshots for `domain`, oldest-pinned first. */
export function getPinnedEventsForDomain(domain) {
  const entry = getDomainEntry(domain);
  return entry.pinnedEvents.map(p => p.snapshot);
}

/** Total pin count for a domain (used by toolbar count badges, etc). */
export function getPinnedCountForDomain(domain) {
  return getDomainEntry(domain).pinnedEvents.length;
}

/** Subscribe to pin/unpin notifications. Returns an unsubscribe function. */
export function subscribePinnedState(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/** Wipe every pin and group for `domain`. Caller must confirm with the user. */
export async function clearAllPinnedForDomain(domain) {
  if (!domain) return;
  const c = ensureLoaded();
  if (c[domain]) {
    delete c[domain];
    await persist();
  }
}

/**
 * Delete a group AND every pin that was a member of it (in a single persist).
 * Differs from `deleteGroup`, which leaves the pins behind in Inbox.
 * Returns the number of pins deleted (0 if the group didn't exist).
 */
export async function deleteGroupAndPins(domain, groupId) {
  if (!domain || !groupId) return 0;
  const c = ensureLoaded();
  const entry = normalizeEntry(c[domain]);
  const idx = entry.groups.findIndex(g => g.id === groupId);
  if (idx < 0) return 0;
  entry.groups.splice(idx, 1);
  const before = entry.pinnedEvents.length;
  entry.pinnedEvents = entry.pinnedEvents.filter(
    p => !(Array.isArray(p.groupIds) && p.groupIds.includes(groupId))
  );
  const removed = before - entry.pinnedEvents.length;
  if (entry.pinnedEvents.length === 0 && entry.groups.length === 0) {
    delete c[domain];
  } else {
    c[domain] = entry;
  }
  await persist();
  return removed;
}

/**
 * Unpin many events on a domain in a single persist. Pin ids that aren't
 * currently pinned are silently skipped. Returns the number actually removed.
 */
export async function unpinMany(eventIds, domain) {
  if (!domain || !Array.isArray(eventIds) || eventIds.length === 0) return 0;
  const c = ensureLoaded();
  const entry = normalizeEntry(c[domain]);
  const idSet = new Set(eventIds);
  const before = entry.pinnedEvents.length;
  entry.pinnedEvents = entry.pinnedEvents.filter(p => !idSet.has(p.pinId));
  const removed = before - entry.pinnedEvents.length;
  if (removed === 0) return 0;
  if (entry.pinnedEvents.length === 0 && entry.groups.length === 0) {
    delete c[domain];
  } else {
    c[domain] = entry;
  }
  await persist();
  return removed;
}

/**
 * Unpin every event currently in Inbox (i.e. with no group membership) for a
 * domain — leaves user-group pins untouched. Returns the count removed.
 */
export async function clearInboxForDomain(domain) {
  if (!domain) return 0;
  const c = ensureLoaded();
  const entry = normalizeEntry(c[domain]);
  const before = entry.pinnedEvents.length;
  entry.pinnedEvents = entry.pinnedEvents.filter(
    p => Array.isArray(p.groupIds) && p.groupIds.length > 0
  );
  const removed = before - entry.pinnedEvents.length;
  if (removed === 0) return 0;
  if (entry.pinnedEvents.length === 0 && entry.groups.length === 0) {
    delete c[domain];
  } else {
    c[domain] = entry;
  }
  await persist();
  return removed;
}

/** Wipe pins and groups for *every* domain. Caller must confirm with the user. */
export async function clearAllPinnedEverywhere() {
  cache = {};
  await persist();
}
