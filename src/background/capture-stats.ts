// Per-tab observation state for the passive classification plane.
//
// Sightings arrive from two planes — webRequest (when Chromium grants them,
// i.e. extension-context traffic) and the page-side PerformanceObserver feed
// (everything else) — so a per-tab recent-URL set collapses duplicates that
// would otherwise double-count. State lives in memory only: it resets with
// the tab's capture data and costs nothing on worker restart.

import type {
  CaptureStats,
  DetectedPlatform,
  MatcherPerf,
  Platform,
} from "../core/types";
import { EMPTY_CAPTURE_STATS } from "../core/types";

/** How many recent URLs to keep per platform for tooltip/debug value. */
const MAX_RECENT_URLS = 10;

/** Distinct URLs remembered per tab before old ones age out of dedup. */
const MAX_DEDUP_URLS = 256;

interface PresenceRecord {
  hits: number;
  recentUrls: string[];
  scriptIds: Set<string>;
}

interface TabMetrics {
  observed: number;
  matched: number;
  elapsedMs: number;
}

export class CaptureObserver {
  private presence = new Map<number, Map<Platform, PresenceRecord>>();
  private metrics = new Map<number, TabMetrics>();
  private seenUrls = new Map<number, Set<string>>();

  /** Record one classified request. `platform` is null when the URL matched
   * no known endpoint; the request still counts toward throughput. Returns
   * false when the URL was already sighted recently (cross-plane duplicate). */
  observe(
    tabId: number,
    url: string,
    platform: Platform | null,
    classifyMs: number
  ): boolean {
    let seen = this.seenUrls.get(tabId);
    if (!seen) {
      seen = new Set();
      this.seenUrls.set(tabId, seen);
    }
    if (seen.has(url)) return false;
    seen.add(url);
    if (seen.size > MAX_DEDUP_URLS) {
      seen.delete(seen.values().next().value as string);
    }

    const m = this.metrics.get(tabId) ?? { observed: 0, matched: 0, elapsedMs: 0 };
    m.observed += 1;
    m.elapsedMs += classifyMs;
    if (platform) m.matched += 1;
    this.metrics.set(tabId, m);

    if (!platform) return true;
    const tab = this.presence.get(tabId) ?? new Map<Platform, PresenceRecord>();
    const entry = tab.get(platform) ?? { hits: 0, recentUrls: [], scriptIds: new Set() };
    entry.hits += 1;
    entry.recentUrls.push(url);
    if (entry.recentUrls.length > MAX_RECENT_URLS) entry.recentUrls.shift();
    tab.set(platform, entry);
    this.presence.set(tabId, tab);
    return true;
  }

  /** Attach an SDK loader sighting. Creates the presence row even without an
   * extracted id — a platform whose loader fired counts as present; ids
   * repeat across SPA navigations so duplicates collapse. */
  noteScriptId(tabId: number, platform: Platform, scriptId?: string): void {
    const tab = this.presence.get(tabId) ?? new Map<Platform, PresenceRecord>();
    const entry = tab.get(platform) ?? { hits: 0, recentUrls: [], scriptIds: new Set() };
    if (scriptId && !entry.scriptIds.has(scriptId)) entry.scriptIds.add(scriptId);
    tab.set(platform, entry);
    this.presence.set(tabId, tab);
  }

  snapshot(tabId: number | undefined): CaptureStats {
    if (tabId === undefined) return EMPTY_CAPTURE_STATS;

    const perf: MatcherPerf = { observed: 0, matched: 0, avgMs: 0 };
    const m = this.metrics.get(tabId);
    if (m && m.observed > 0) {
      perf.observed = m.observed;
      perf.matched = m.matched;
      perf.avgMs = Math.round((m.elapsedMs / m.observed) * 1000) / 1000;
    }

    let platforms: DetectedPlatform[] | undefined;
    for (const [platform, entry] of this.presence.get(tabId) ?? []) {
      (platforms ??= []).push({
        platform,
        hits: entry.hits,
        scriptIds: [...entry.scriptIds],
      });
    }
    return { platforms: platforms ?? [], perf };
  }

  forgetTab(tabId: number): void {
    this.presence.delete(tabId);
    this.metrics.delete(tabId);
    this.seenUrls.delete(tabId);
  }
}
