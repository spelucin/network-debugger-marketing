import type { MarketingRequest, Platform } from "../../core/types";
import { PLATFORM_INFO } from "../../core/types";
import { bareName } from "../../definitions";

export type PlatformFilter = "all" | Exclude<Platform, "unknown">;
export type QaFilter = "all" | "issues" | "warnings" | "clean";

export interface FilterState {
  platform: PlatformFilter;
  qa: QaFilter;
  event: string;
  query: string;
}

export const DEFAULT_FILTERS: FilterState = {
  platform: "all",
  qa: "all",
  event: "",
  query: "",
};

export function qaBucket(
  request: MarketingRequest
): "issues" | "warnings" | "clean" {
  if (request.qa.some((i) => i.severity === "warning")) return "issues";
  if (request.qa.length > 0) return "warnings";
  return "clean";
}

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
    const bucket = qaBucket(r);
    if (filters.qa === "issues" && bucket !== "issues") return false;
    if (filters.qa === "warnings" && bucket !== "warnings") return false;
    if (filters.qa === "clean" && bucket !== "clean") return false;
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
  };
  for (const r of requests) {
    if (r.platform === "ga4") counts.ga4 += 1;
    else if (r.platform === "google_ads") counts.google_ads += 1;
    else if (r.platform === "meta") counts.meta += 1;
    else if (r.platform === "tiktok") counts.tiktok += 1;
    else if (r.platform === "clarity") counts.clarity += 1;
  }
  return counts;
}

export function countByQa(
  requests: MarketingRequest[]
): Record<QaFilter, number> {
  const counts: Record<QaFilter, number> = { all: requests.length, issues: 0, warnings: 0, clean: 0 };
  for (const r of requests) {
    counts[qaBucket(r)] += 1;
  }
  return counts;
}

export { bareName };