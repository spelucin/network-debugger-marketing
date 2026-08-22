// @ts-check
// ============================================================
// AI usage history — pure helpers for the 30-day rolling bucket
// persisted to chrome.storage.local.ai_usage_history.byDate.
//
// Storage shape:
//   ai_usage_history = {
//     byDate: {
//       'YYYY-MM-DD': {
//         [providerId]: { requests, tokensIn, tokensOut, costEstimate }
//       }
//     }
//   }
//
// - Everything is UTC-keyed so the 24h rollover matches what providers
//   bill / enforce, regardless of the user's local timezone.
// - `costEstimate` is OUR computation (tokens × hardcoded rate table in
//   ai-provider.js). Providers do NOT return cost on the wire — this
//   number must always be labelled as an estimate in the UI.
// - Token counts ARE from the provider's response payload, so those
//   are authoritative.
// ============================================================

export const MAX_HISTORY_DAYS = 30;

/**
 * Per-provider, per-day usage counters.
 * @typedef {Object} UsageBucket
 * @property {number} requests
 * @property {number} tokensIn - Authoritative (from the provider response).
 * @property {number} tokensOut - Authoritative (from the provider response).
 * @property {number} costEstimate - OUR computation; always label as estimate.
 */

/**
 * The `byDate` slice of `ai_usage_history`: 'YYYY-MM-DD' → providerId → bucket.
 * @typedef {Object<string, Object<string, UsageBucket>>} UsageByDate
 */

/** @returns {string} Today as 'YYYY-MM-DD' in UTC. */
export function todayUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** @param {string} str @returns {number} */
function parseUtcDate(str) {
  return Date.UTC(+str.slice(0, 4), +str.slice(5, 7) - 1, +str.slice(8, 10));
}

/**
 * Age in whole days from `dateStr` to `todayStr`. Positive when
 * `dateStr` is older than today, 0 for today, negative for future
 * (shouldn't happen but treated as "not stale").
 * @param {string} dateStr
 * @param {string} todayStr
 * @returns {number}
 */
export function daysBetween(dateStr, todayStr) {
  return Math.round((parseUtcDate(todayStr) - parseUtcDate(dateStr)) / 86_400_000);
}

/**
 * Drop entries older than `MAX_HISTORY_DAYS` days, plus malformed
 * keys. Returns a new object — callers should replace their copy
 * rather than mutating in place.
 * @param {UsageByDate|null|undefined} byDate
 * @param {string} [today]
 * @returns {UsageByDate}
 */
export function pruneUsageHistory(byDate, today = todayUTC()) {
  /** @type {UsageByDate} */
  const out = {};
  for (const [date, providers] of Object.entries(byDate || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const age = daysBetween(date, today);
    if (age >= 0 && age < MAX_HISTORY_DAYS) out[date] = providers;
  }
  return out;
}

/**
 * Sum every bucket into one `totals` object plus a per-provider
 * breakdown. Pre-pruning is the caller's job — this function does
 * not filter dates.
 * @param {UsageByDate|null|undefined} byDate
 * @returns {{ totals: UsageBucket, perProvider: Object<string, UsageBucket> }}
 */
export function computeLast30Days(byDate) {
  const totals = { requests: 0, tokensIn: 0, tokensOut: 0, costEstimate: 0 };
  /** @type {Object<string, UsageBucket>} */
  const perProvider = {};
  for (const providers of Object.values(byDate || {})) {
    for (const [providerId, bucket] of Object.entries(providers || {})) {
      if (!bucket) continue;
      totals.requests += Number(bucket.requests) || 0;
      totals.tokensIn += Number(bucket.tokensIn) || 0;
      totals.tokensOut += Number(bucket.tokensOut) || 0;
      totals.costEstimate += Number(bucket.costEstimate) || 0;
      if (!perProvider[providerId]) {
        perProvider[providerId] = { requests: 0, tokensIn: 0, tokensOut: 0, costEstimate: 0 };
      }
      perProvider[providerId].requests += Number(bucket.requests) || 0;
      perProvider[providerId].tokensIn += Number(bucket.tokensIn) || 0;
      perProvider[providerId].tokensOut += Number(bucket.tokensOut) || 0;
      perProvider[providerId].costEstimate += Number(bucket.costEstimate) || 0;
    }
  }
  return { totals, perProvider };
}

/**
 * Pure helper — given a history snapshot and a single request's
 * numbers, returns the updated `byDate` object (does NOT mutate).
 * Callers (service worker) handle the storage round-trip around it.
 * @param {UsageByDate} byDate
 * @param {{ provider: string, tokensIn?: number, tokensOut?: number, costEstimate?: number, date?: string }} record
 * @returns {UsageByDate}
 */
export function applyUsageRecord(byDate, { provider, tokensIn, tokensOut, costEstimate, date = todayUTC() }) {
  if (!provider) return byDate;
  const next = { ...byDate };
  const day = { ...(next[date] || {}) };
  const bucket = day[provider]
    ? { ...day[provider] }
    : { requests: 0, tokensIn: 0, tokensOut: 0, costEstimate: 0 };
  bucket.requests += 1;
  bucket.tokensIn += Number(tokensIn) || 0;
  bucket.tokensOut += Number(tokensOut) || 0;
  bucket.costEstimate += Number(costEstimate) || 0;
  day[provider] = bucket;
  next[date] = day;
  return next;
}
