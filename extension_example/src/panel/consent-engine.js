// @ts-check
// ============================================================
// Consent Engine — pure consent-timeline logic extracted from
// panel.js (#135 WP3, findings C2 + D-ii).
//
// Why this module exists: these functions used to live inside
// panel.js, whose top-level chrome.* side effects make it
// un-importable in Node — so the test suite kept hand-synced
// mirror copies (tests/helpers/marker-builder.mjs and
// path-builder.mjs, both deleted in WP3). This module is the
// single implementation: panel.js, the components, and the
// tests all import it directly. No copy to maintain.
//
// Design constraints:
//   - NO chrome.* calls, NO DOM access, NO import of panel.js
//     or any component — the module must load cleanly in Node.
//   - Panel state is parameter-injected: pure functions take
//     the data they need; reconstructConsentPath() reads live
//     panel state through the deps seam below (same pattern as
//     request-handlers.js's _deps).
// ============================================================

import {
  getRequiredConsentCategory,
  getGCSConsentState,
  lookupTimeline
} from '../shared/detection/parsers/index.js';

// ── Deps seam ────────────────────────────────────────────────
// panel.js injects accessors to its live state once at startup
// so components can call reconstructConsentPath(event) without
// importing panel.js. Tests pass an explicit deps object instead.

/**
 * @typedef {Object} ConsentEngineDeps
 * @property {() => Array<import('../shared/event-shape.js').ConsentTimelineEntry>} getConsentTimeline
 * @property {() => number|null} getFirstConsentTimestamp
 * @property {() => Array<import('../shared/event-shape.js').CapturedEvent>} getEvents
 * @property {(platformId: string) => string} getCategoryForPlatform
 */

/** @type {ConsentEngineDeps|null} */
let _deps = null;

/**
 * Inject live-state accessors (called once by panel.js).
 * @param {ConsentEngineDeps} deps
 */
export function setConsentEngineDeps(deps) {
  _deps = deps;
}

/**
 * Insert an entry into a consent timeline (sorted by timestamp, append-only)
 * and apply the scoped `_consentCheck` cache-invalidation policy (#131 F3).
 *
 * Mutates `session.consentTimeline` (sorted insert), `session.firstConsentTimestamp`
 * (earliest real-time signal), and the events' `_consentCheck` caches. The panel
 * passes its `state` object as `session`; tests pass a plain fixture object.
 *
 * Invalidation policy: verdicts are backward-looking only —
 * computeConsentCheck()/lookupTimeline() consult timeline entries at-or-before the
 * event's timestamp, so a new entry at time T cannot change the verdict of an event
 * before T. Earlier events keep their cached _consentCheck. Retroactive prior-consent
 * cookie entries carry timestamp 0, so they scope to "everything" by construction.
 * One exception needs the full wipe: the session's first real-time consent signal
 * flips firstConsentTimestamp from null, which can retroactively change earlier
 * events' verdicts (no-data null → pre-consent via the priority-5 check). That
 * transition happens at most once per session, early, when few events exist.
 *
 * firstConsentTimestamp is only updated from real-time entries (timestamp > 0) —
 * T=0 entries represent prior consent or historical state, not in-session consent
 * signals. Including them would make firstConsentTimestamp always 0, preventing
 * pre-consent detection.
 *
 * @param {{ consentTimeline: Array<import('../shared/event-shape.js').ConsentTimelineEntry>, firstConsentTimestamp: number|null, events: Array<import('../shared/event-shape.js').CapturedEvent> }} session
 * @param {import('../shared/event-shape.js').ConsentTimelineEntry} entry
 */
export function insertConsentTimelineEntry(session, entry) {
  const timeline = session.consentTimeline;
  // Insert in sorted order by timestamp (avoids O(n log n) re-sort on every addition)
  let i = timeline.length;
  while (i > 0 && timeline[i - 1].timestamp > entry.timestamp) i--;
  timeline.splice(i, 0, entry);

  const hadFirstConsent = session.firstConsentTimestamp !== null;
  if (entry.timestamp > 0) {
    if (session.firstConsentTimestamp === null || entry.timestamp < session.firstConsentTimestamp) {
      session.firstConsentTimestamp = entry.timestamp;
    }
  }

  const firstConsentJustSet = !hadFirstConsent && session.firstConsentTimestamp !== null;
  for (const ev of session.events) {
    if (firstConsentJustSet || ev.timestamp >= entry.timestamp) {
      delete ev._consentCheck;
    }
  }
}

/**
 * Build consent state markers from a consent timeline.
 * Deduplicates by only creating a new marker when the effective consent state changes.
 *
 * @param {Array<import('../shared/event-shape.js').ConsentTimelineEntry>} timeline - Sorted consent timeline entries
 * @returns {Array<import('../shared/event-shape.js').ConsentMarker>} Deduplicated consent state markers
 */
export function rebuildConsentStateMarkers(timeline) {
  /** @type {Array<import('../shared/event-shape.js').ConsentMarker>} */
  const markers = [];
  /** @type {string|null} */
  let lastState = null; // Track last effective state for dedup

  for (const entry of timeline) {
    const cats = entry.categories;
    if (!cats) continue;

    // Skip GCM-only entries — Google Consent Mode is a signal relay, not a CMP.
    // Its state is shown as mismatches on individual events, not as separate markers.
    if (entry.source === 'google-cm') continue;

    // Skip initial window-api reads when we already have a cookie entry for the same CMP.
    // The cookie is the authoritative source for initial consent state. Window APIs can
    // return stale or incorrect state during page load (e.g., Cookie Information reports
    // analytics:granted while the cookie correctly says analytics:denied).
    // Window-api "update" entries (user interacted) are still shown.
    if (entry.source === 'window-api' && entry.action === 'default' && entry.cmp) {
      // Only skip when a genuine prior-consent cookie exists (returning visitor).
      // Mid-session cookie writes (action='update') should NOT suppress the initial window-api state,
      // because that initial denied state is the real T=0 consent for first-time visitors.
      const hasInitialCookieEntry = timeline.some(
        e => e.source === 'cookie' && e.cmp === entry.cmp && e.action === 'prior-consent'
      );
      if (hasInitialCookieEntry) continue;
    }

    // Build effective state string for dedup comparison (unified 3 categories only)
    const effectiveState = `${cats.analytics || ''}|${cats.marketing || ''}|${cats.functional || ''}`;

    if (lastState === null || effectiveState !== lastState ||
        (entry.completeness === 'full' && markers.length > 0 && markers[markers.length - 1].completeness !== 'full') ||
        entry.action === 'confirmed') {
      // Determine action label
      const action = entry.action || 'default';

      let actionLabel;
      if (entry.completeness === 'binary') {
        actionLabel = action === 'update' ? 'Updated' : 'Given';
      } else if (action === 'prior-consent') {
        actionLabel = 'Returning';
      } else if (action === 'confirmed') {
        actionLabel = 'Confirmed';
      } else if (action === 'update') {
        actionLabel = 'Update';
      } else if (action === 'set') {
        actionLabel = 'Set';
      } else {
        actionLabel = 'Default';
      }

      markers.push({
        id: `consent-marker-${entry.timestamp}-${entry.source}`,
        timestamp: entry.timestamp,
        type: 'consent-state',
        action,
        actionLabel,
        source: entry.source,
        sourceLabel: entry.sourceLabel || entry.cmp || '',
        cmp: entry.cmp || null,
        categories: { ...cats },
        completeness: entry.completeness || 'full',
        timelineEntry: entry
      });
      lastState = effectiveState;
    } else {
      // Same state — update the existing marker's source attribution if higher priority
      const existing = markers[markers.length - 1];
      const priority = ['cookie', 'window-api', 'cmp-push', 'cmp-lifecycle'];
      const existingPriority = priority.indexOf(existing.source);
      const newPriority = priority.indexOf(entry.source);
      if (newPriority >= 0 && (existingPriority < 0 || newPriority < existingPriority)) {
        existing.source = entry.source;
        existing.sourceLabel = entry.sourceLabel || entry.cmp || '';
        existing.cmp = entry.cmp || existing.cmp;
      }
    }
  }

  return markers;
}

/**
 * Reconstruct the consent detection pipeline for an event.
 * Shows which detection methods were tried, which one won, and what data each provided.
 * Used by the expandable consent detection path in the overview card.
 *
 * Callable two ways:
 *   - reconstructConsentPath(event) — panel/components; reads live state via the deps seam
 *   - reconstructConsentPath(event, deps) — tests; explicit accessors over fixtures
 *
 * @param {import('../shared/event-shape.js').CapturedEvent} event - The event object
 * @param {ConsentEngineDeps|null} [deps] - State accessors (defaults to the seam set by panel.js)
 * @returns {Array<{label: string, status: string, detail: string|null}>}
 */
export function reconstructConsentPath(event, deps = _deps) {
  if (!deps) {
    // Same misuse outcome as before typing (a TypeError on the next line),
    // just with an actionable message: the seam must be injected first.
    throw new Error('consent-engine: reconstructConsentPath() called before setConsentEngineDeps()');
  }
  const consentTimeline = deps.getConsentTimeline();
  const firstConsentTimestamp = deps.getFirstConsentTimestamp();
  const events = deps.getEvents();

  const platformCategory = deps.getCategoryForPlatform(event.platform);
  const requiredCategory = getRequiredConsentCategory(platformCategory);
  if (!requiredCategory) return [];

  // CMP sources (real consent authority) listed first, then Google signals
  const CMP_SOURCES = [
    { id: 'cookie', label: 'CMP Cookie (T=0)' },
    { id: 'window-api', label: 'CMP Window API' },
    { id: 'cmp-push', label: 'CMP Push' },
    { id: 'cmp-lifecycle', label: 'CMP Lifecycle' },
  ];

  /** @type {Array<{label: string, status: string, detail: string|null}>} */
  const steps = [];

  // Scan timeline for all source types with entries at-or-before event time
  /** @type {Map<string, import('../shared/event-shape.js').ConsentTimelineEntry>} */
  const availableSources = new Map(); // source -> latest entry
  for (const entry of consentTimeline) {
    if (entry.timestamp > event.timestamp) continue;
    const existing = availableSources.get(entry.source);
    if (!existing || entry.timestamp > existing.timestamp) {
      availableSources.set(entry.source, entry);
    }
  }

  // Format detail for a timeline entry
  /**
   * @param {import('../shared/event-shape.js').ConsentTimelineEntry|undefined} entry
   * @returns {string|null}
   */
  function formatEntryDetail(entry) {
    if (!entry) return null;
    const cmpPart = entry.cmp || entry.sourceLabel || '';
    if (entry.categories) {
      const allGranted = Object.values(entry.categories).every(v => v === 'granted');
      const allDenied = Object.values(entry.categories).every(v => v === 'denied');
      const catSummary = allGranted ? 'all granted' : allDenied ? 'all denied'
        : Object.entries(entry.categories).map(([k, v]) => `${k}: ${v}`).join(', ');
      return cmpPart ? `${cmpPart} → ${catSummary}` : catSummary;
    }
    if (entry.action) {
      return cmpPart ? `${cmpPart} (${entry.action})` : entry.action;
    }
    return cmpPart || null;
  }

  // Find the CMP winner (highest-priority CMP source with data)
  const cmpFullSources = ['cookie', 'window-api', 'cmp-push'];
  const cmpWinner = lookupTimeline(event.timestamp, consentTimeline, cmpFullSources);
  const cmpBinaryWinner = !cmpWinner
    ? lookupTimeline(event.timestamp, consentTimeline, ['cmp-lifecycle'])
    : null;
  const cmpWinnerSource = cmpWinner?.source || cmpBinaryWinner?.source || null;

  // If no CMP data, check Google signals for fallback winner
  let googleWinnerSource = null;
  if (!cmpWinnerSource) {
    const gcsState = getGCSConsentState(event);
    if (gcsState && gcsState[requiredCategory]) {
      googleWinnerSource = 'gcs';
    } else {
      const gcmEntry = availableSources.get('google-cm');
      if (gcmEntry) googleWinnerSource = 'google-cm';
    }
  }

  const winnerSource = cmpWinnerSource || googleWinnerSource || null;

  // Steps 1-4: CMP sources — once a CMP winner is found, skip remaining CMP steps
  let foundCMPWinner = false;
  for (const src of CMP_SOURCES) {
    if (foundCMPWinner) {
      steps.push({ label: src.label, status: 'skipped', detail: null });
      continue;
    }
    const entry = availableSources.get(src.id);
    if (entry && src.id === winnerSource) {
      steps.push({ label: src.label, status: 'matched', detail: formatEntryDetail(entry) });
      foundCMPWinner = true;
    } else if (entry) {
      steps.push({ label: src.label, status: 'available', detail: formatEntryDetail(entry) });
    } else {
      steps.push({ label: src.label, status: 'failed', detail: null });
    }
  }

  // Steps 5-6: Google signals — always checked for comparison, shown as "available" when CMP won
  const gcsState = getGCSConsentState(event);
  if (gcsState && gcsState[requiredCategory]) {
    const parts = Object.entries(gcsState).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
    const gcsDetail = parts.join(', ');
    if (googleWinnerSource === 'gcs') {
      steps.push({ label: 'Google Consent Status', status: 'matched', detail: gcsDetail });
    } else {
      steps.push({ label: 'Google Consent Status', status: 'available', detail: gcsDetail });
    }
  } else {
    steps.push({ label: 'Google Consent Status', status: 'failed', detail: null });
  }

  const gcmEntry = availableSources.get('google-cm');
  if (gcmEntry) {
    if (googleWinnerSource === 'google-cm') {
      steps.push({ label: 'Google Consent Mode', status: 'matched', detail: formatEntryDetail(gcmEntry) });
    } else {
      steps.push({ label: 'Google Consent Mode', status: 'available', detail: formatEntryDetail(gcmEntry) });
    }
  } else {
    steps.push({ label: 'Google Consent Mode', status: 'failed', detail: null });
  }

  // Step 7: Pre-consent
  if (!winnerSource) {
    if (firstConsentTimestamp !== null && event.timestamp < firstConsentTimestamp) {
      const firstEventTime = events[0]?.timestamp || event.timestamp;
      const eventMs = Math.round(event.timestamp - firstEventTime);
      const consentMs = Math.round(firstConsentTimestamp - firstEventTime);
      steps.push({
        label: 'Pre-consent',
        status: 'matched',
        detail: `Event at ${eventMs}ms, first consent at ${consentMs}ms`,
      });
    } else {
      steps.push({ label: 'Pre-consent', status: 'failed', detail: null });
    }
  } else {
    steps.push({ label: 'Pre-consent', status: 'skipped', detail: null });
  }

  return steps;
}
