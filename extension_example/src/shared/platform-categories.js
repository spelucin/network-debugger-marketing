// @ts-check
// Platform Categories - the single canonical list of platform category ids.
//
// This is the authoritative enum behind:
//   - the `category:` field on every platform-registry.js entry
//     (membership validated by tests/platform-validation.test.mjs)
//   - the panel's PLATFORM_CATEGORIES filter metadata (panel.js, which adds
//     a panel-only 'unknown' pseudo-category for unmatched requests)
//   - the sidepanel's CATEGORY_ORDER / CATEGORY_META (sidepanel.js)
//   - the 14-value enum documented in .claude/rules/platform-files.md
//
// The panel and sidepanel copies carry deliberately different display
// metadata (names, icons, ordering), but the category IDS they use must be
// drawn from this list. Enforced by tests/panel/category-sync-guard.test.mjs
// (Feature #135 finding C3: the sidepanel copy had drifted to include a
// phantom 'crm-automation' category that no registry entry ever mapped to).
//
// Adding a category here is a deliberate product decision: the enum is
// intentionally bounded so the category filter UI stays scannable. Open a
// feature idea first, per the platform-files rule.

export const PLATFORM_CATEGORY_IDS = [
  'ab-testing',
  'ad-tech',
  'advertising',
  'analytics',
  'cdp',
  'consent',
  'data-layer',
  'first-party-collection',
  'marketing-automation',
  'monitoring',
  'session-replay',
  'tag-manager',
  'video',
  'widgets',
];

// Panel-only pseudo-category for tracking requests that match no known
// platform. Not a registry category: registry entries must never use it.
export const UNKNOWN_CATEGORY_ID = 'unknown';
