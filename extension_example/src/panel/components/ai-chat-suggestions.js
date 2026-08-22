// ============================================================
// AI Chat — local rule-based suggested prompts
//
// Generates the empty-state starter chips for the Chat tab WITHOUT
// calling the AI provider. The user always owns the decision to
// spend tokens — these suggestions just make the empty state feel
// session-aware.
//
// Each rule inspects the captured session (events + helpers) and
// either returns a suggestion string or null. The orchestrator runs
// every rule, dedups, and tops up with generic fallbacks until it has
// MAX_SUGGESTIONS. Pure functions throughout — no DOM, no chrome APIs,
// no side effects — so the whole thing is trivially testable.
// ============================================================

const MAX_SUGGESTIONS = 5;

// Generic fallbacks used when there's no captured data, or to fill
// out the list when only one or two rules fired. Kept short so they
// fit on a single line in the empty-state chip layout.
export const FALLBACK_SUGGESTIONS = [
  'Summarise everything captured on this session.',
  'Did all expected platforms fire on every page?',
  'List any events with HTTP errors or empty values.',
  'Which events fired before consent was given?',
  'Are there any duplicate events I should know about?',
];

// Common e-commerce event names recognised across GA4 / Meta / Adobe /
// custom dataLayer pushes. Lower-cased for case-insensitive matching.
const ECOMMERCE_EVENT_NAMES = new Set([
  'purchase',
  'transaction',
  'add_to_cart',
  'addtocart',
  'remove_from_cart',
  'view_item',
  'viewitem',
  'view_item_list',
  'select_item',
  'begin_checkout',
  'add_payment_info',
  'add_shipping_info',
  'checkout',
]);

// Platform IDs that count as "tracking platforms" for the comparison
// rule. We deliberately exclude tag managers, dataLayer pushes, and
// CMPs — comparing those doesn't yield a useful AI prompt.
const TRACKING_CATEGORIES = new Set([
  'analytics',
  'advertising',
  'ad-tech',
  'cdp',
  'ab-testing',
  'session-replay',
]);

/**
 * Build a list of suggested starter prompts for the Chat empty state.
 * 100% local — never makes an AI call. Returns at most MAX_SUGGESTIONS
 * unique strings.
 *
 * @param {Object} input
 * @param {Array} input.events - captured events (panel state.events)
 * @param {Object} input.helpers - { getPlatformName, getCategoryInfo, getConsentCheckForEvent }
 * @returns {string[]}
 */
export function generateChatSuggestions({ events = [], helpers = {} } = {}) {
  const ctx = buildContext(events, helpers);
  const out = [];

  for (const rule of RULES) {
    if (out.length >= MAX_SUGGESTIONS) break;
    let suggestion;
    try {
      suggestion = rule(ctx);
    } catch {
      suggestion = null; // a misbehaving rule never breaks the list
    }
    if (suggestion && !out.includes(suggestion)) out.push(suggestion);
  }

  for (const fallback of FALLBACK_SUGGESTIONS) {
    if (out.length >= MAX_SUGGESTIONS) break;
    if (!out.includes(fallback)) out.push(fallback);
  }

  return out;
}

// ─── Context derivation ────────────────────────────────────────────────────

/**
 * Walk events once to build the derived facts every rule needs.
 * Doing this up-front means each rule is a cheap object-property
 * inspection rather than another full pass over the events array.
 *
 * Exported for tests.
 */
export function buildContext(events, helpers = {}) {
  const trackingPlatforms = new Map();         // id → human name (only categories that count as trackers)
  const allPlatforms = new Map();              // id → human name (all)
  const eventNameCounts = new Map();           // "platform:eventName" → count
  let httpErrorCount = 0;
  let preConsentCount = 0;
  let ecommerceEventCount = 0;
  let totalCount = 0;

  for (const ev of events) {
    if (!ev) continue;
    totalCount++;

    if (ev.platform) {
      // Helpers come from panel state — defensive try/catch so a buggy
      // helper on a single event doesn't poison the whole derivation.
      let name = ev.platform;
      try {
        if (helpers.getPlatformName) name = helpers.getPlatformName(ev.platform) || ev.platform;
      } catch { /* fall back to id */ }
      allPlatforms.set(ev.platform, name);

      try {
        const cat = helpers.getCategoryInfo && helpers.getCategoryInfo(ev.platform);
        if (cat?.id && TRACKING_CATEGORIES.has(cat.id)) {
          trackingPlatforms.set(ev.platform, name);
        }
      } catch { /* helper threw — skip category classification for this event */ }
    }

    if (ev.eventName && ev.platform) {
      const key = `${ev.platform}:${ev.eventName}`;
      eventNameCounts.set(key, (eventNameCounts.get(key) || 0) + 1);
    }

    if (ev.eventName && ECOMMERCE_EVENT_NAMES.has(String(ev.eventName).toLowerCase())) {
      ecommerceEventCount++;
    }

    if (typeof ev.status === 'number' && (ev.status >= 400 || ev.status === 0)) {
      httpErrorCount++;
    }

    // Pre-consent / denied — use the panel helper when available; that's
    // the same source of truth the consent badges use. Wrapped because
    // the helper touches state machinery that could change shape.
    if (typeof helpers.getConsentCheckForEvent === 'function') {
      try {
        const check = helpers.getConsentCheckForEvent(ev);
        const status = check?.status;
        if (status === 'pre-consent' || status === 'denied' || status === 'potential') {
          preConsentCount++;
        }
      } catch { /* skip consent classification for this event */ }
    }
  }

  return {
    events,
    helpers,
    totalCount,
    trackingPlatforms,
    allPlatforms,
    eventNameCounts,
    httpErrorCount,
    preConsentCount,
    ecommerceEventCount,
  };
}

// ─── Rules ─────────────────────────────────────────────────────────────────
// Each rule: (ctx) => suggestion-string | null

function ruleCompareTwoTrackingPlatforms(ctx) {
  if (ctx.trackingPlatforms.size < 2) return null;
  // Pick the two platforms with the most events for the comparison
  // suggestion — they're the ones the user is most likely to care about.
  const counts = new Map();
  for (const [key] of ctx.eventNameCounts) {
    const platform = key.split(':')[0];
    if (!ctx.trackingPlatforms.has(platform)) continue;
    counts.set(platform, (counts.get(platform) || 0) + ctx.eventNameCounts.get(key));
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
  if (top.length < 2) return null;
  const [a, b] = top.map(([id]) => ctx.trackingPlatforms.get(id));
  return `Compare the ${a} and ${b} events captured here.`;
}

function rulePreConsentEvents(ctx) {
  if (ctx.preConsentCount === 0) return null;
  const noun = ctx.preConsentCount === 1 ? 'event' : 'events';
  return `Why did ${ctx.preConsentCount} ${noun} fire before consent was granted?`;
}

function ruleHttpErrors(ctx) {
  if (ctx.httpErrorCount === 0) return null;
  const noun = ctx.httpErrorCount === 1 ? 'event' : 'events';
  return `Explain the ${ctx.httpErrorCount} ${noun} with HTTP errors or that were blocked.`;
}

function ruleEcommerceFunnel(ctx) {
  if (ctx.ecommerceEventCount === 0) return null;
  return 'Walk me through the e-commerce funnel captured in this session.';
}

function ruleHeavyEvent(ctx) {
  if (ctx.eventNameCounts.size === 0) return null;
  let heaviestKey = null;
  let heaviestCount = 0;
  for (const [key, count] of ctx.eventNameCounts) {
    if (count > heaviestCount) {
      heaviestCount = count;
      heaviestKey = key;
    }
  }
  if (heaviestCount < 5) return null; // 5+ feels like a real pattern, not noise
  const [, eventName] = heaviestKey.split(':');
  return `The "${eventName}" event fired ${heaviestCount} times — is that expected?`;
}

function ruleSinglePlatformGapAnalysis(ctx) {
  if (ctx.trackingPlatforms.size !== 1) return null;
  if (ctx.totalCount < 5) return null; // need enough data to ask a meaningful question
  const [name] = ctx.trackingPlatforms.values();
  return `What's missing from this ${name} implementation?`;
}

function ruleCustomDataLayerPush(ctx) {
  // dataLayer pushes have platform 'datalayer' but no consent / network
  // status. If the session has lots of dataLayer activity but few
  // tracking events, the user is likely auditing the dataLayer itself.
  const dataLayerEvents = (ctx.allPlatforms.get('datalayer') || ctx.allPlatforms.get('adobe-datalayer'))
    ? [...ctx.eventNameCounts].filter(([k]) => k.startsWith('datalayer:') || k.startsWith('adobe-datalayer:'))
    : [];
  const dataLayerCount = dataLayerEvents.reduce((acc, [, c]) => acc + c, 0);
  if (dataLayerCount < 3) return null;
  if (dataLayerCount < ctx.totalCount * 0.3) return null;
  return 'Walk through the dataLayer pushes — anything that looks like a tagging issue?';
}

const RULES = [
  ruleCompareTwoTrackingPlatforms,
  rulePreConsentEvents,
  ruleHttpErrors,
  ruleEcommerceFunnel,
  ruleHeavyEvent,
  ruleSinglePlatformGapAnalysis,
  ruleCustomDataLayerPush,
];

// Test exports
export const _CHAT_SUGGESTION_RULES = RULES;
export const _CHAT_SUGGESTION_MAX = MAX_SUGGESTIONS;
