import type { MarketingRequest, Platform } from "../../core/types";
import { PLATFORM_INFO } from "../../core/types";
import { bareName } from "../../definitions";

export type PlatformFilter = "all" | Exclude<Platform, "unknown">;

export interface FilterState {
  platform: PlatformFilter;
  event: string;
  query: string;
}

export const DEFAULT_FILTERS: FilterState = {
  platform: "all",
  event: "",
  query: "",
};

/**
 * Restricts a request list to a single tab. Never mutates the source list,
 * so switching tabs preserves every tab's history.
 *
 * When the active tab id is unknown (worker could not resolve it), the full
 * list is returned so the panel is never blank.
 */
export function filterByTab(
  requests: MarketingRequest[],
  activeTabId: number | undefined
): MarketingRequest[] {
  if (activeTabId === undefined) return requests;
  return requests.filter((r) => r.tabId === activeTabId);
}

export function requestId(request: MarketingRequest): string {
  const meta = request.decoded?.meta;
  return (
    (typeof meta?.measurementId === "string" && meta.measurementId) ||
    (typeof meta?.conversionId === "string" && meta.conversionId) ||
    (typeof meta?.pixelId === "string" && meta.pixelId) ||
    (typeof meta?.projectId === "string" && meta.projectId) ||
    ""
  );
}

function searchableText(request: MarketingRequest): string {
  const parts: string[] = [
    PLATFORM_INFO[request.platform].label,
    PLATFORM_INFO[request.platform].shortLabel,
    request.eventName ?? "",
    request.url,
    requestId(request),
  ];
  const decoded = request.decoded;
  if (decoded) {
    for (const p of [
      ...decoded.standardParameters,
      ...decoded.customParameters,
      ...decoded.contextParameters,
    ]) {
      parts.push(p.key, p.label);
      if (p.value !== undefined && p.value !== null) parts.push(String(p.value));
    }
    if (decoded.ecommerce?.items) {
      for (const item of decoded.ecommerce.items) {
        parts.push(String(item.item_id ?? ""), String(item.item_name ?? ""));
      }
    }
  }
  for (const [k, v] of Object.entries(request.queryParams)) {
    parts.push(k, Array.isArray(v) ? v.join(" ") : v);
  }
  return parts.join("\n").toLowerCase();
}

export function matchesQuery(request: MarketingRequest, query: string): boolean {
  if (!query) return true;
  return searchableText(request).includes(query.toLowerCase());
}

export function filterRequests(
  requests: MarketingRequest[],
  filters: FilterState
): MarketingRequest[] {
  return requests.filter((r) => {
    if (filters.platform !== "all" && r.platform !== filters.platform) return false;
    if (filters.event && r.eventName !== filters.event) return false;
    if (filters.query && !matchesQuery(r, filters.query)) return false;
    return true;
  });
}

export function collectEvents(requests: MarketingRequest[]): string[] {
  const seen = new Set<string>();
  for (const r of requests) {
    if (r.eventName) seen.add(r.eventName);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export function countByPlatform(
  requests: MarketingRequest[]
): Record<PlatformFilter, number> {
  const counts: Record<PlatformFilter, number> = {
    all: requests.length,
    ga4: 0,
    google_ads: 0,
    meta: 0,
    tiktok: 0,
    clarity: 0,
    amplitude: 0,
    mixpanel: 0,
    matomo: 0,
    linkedin: 0,
    reddit: 0,
    pinterest: 0,
    gtm: 0,
    adobe: 0,
    segment: 0,
    bing: 0,
    twitter: 0,
    snapchat: 0,
    youtube: 0,
    heap: 0,
    criteo: 0,
    piwik: 0,
    optimizely: 0,
    hubspot: 0,
    hotjar: 0,
  };
  for (const r of requests) {
    if (r.platform in counts && r.platform !== "unknown") {
      counts[r.platform as Exclude<Platform, "unknown">] += 1;
    }
  }
  return counts;
}

/**
 * Groups requests by platform for the grouped view. Capture order within a
 * section is preserved; sections are ordered by their most recent request so
 * the platform currently firing sits on top. The unknown bucket always sinks
 * to the bottom.
 */
export function groupByPlatform(
  requests: MarketingRequest[]
): Array<{ platform: Platform; requests: MarketingRequest[] }> {
  const sections = new Map<Platform, MarketingRequest[]>();
  for (const r of requests) {
    const list = sections.get(r.platform);
    if (list) list.push(r);
    else sections.set(r.platform, [r]);
  }
  return [...sections.entries()]
    .map(([platform, list]) => ({ platform, requests: list }))
    .sort((a, b) => {
      if (a.platform === "unknown") return 1;
      if (b.platform === "unknown") return -1;
      const aNewest = a.requests[a.requests.length - 1]?.timestamp ?? 0;
      const bNewest = b.requests[b.requests.length - 1]?.timestamp ?? 0;
      return bNewest - aNewest;
    });
}

export { bareName };