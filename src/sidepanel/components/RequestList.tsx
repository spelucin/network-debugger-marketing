import { memo } from "react";
import type { MarketingRequest } from "../../core/types";
import { formatMoney, formatTimeShort, truncateMiddle } from "../../core/url";
import { requestId, qaBucket } from "../lib/filters";
import { PlatformIcon, platformDotColor } from "./PlatformIcon";
import { useVirtualList } from "../hooks/useVirtualList";

const ROW_HEIGHT = 54;

interface Props {
  requests: MarketingRequest[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function valueSummary(request: MarketingRequest): string | undefined {
  const e = request.decoded?.ecommerce;
  if (e?.value === undefined) return undefined;
  return formatMoney(e.value, e.currency);
}

function Row({
  request,
  selected,
  onSelect,
}: {
  request: MarketingRequest;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const decoded = request.decoded;
  const id = requestId(request);
  const bucket = qaBucket(request);
  const value = valueSummary(request);

  return (
    <button
      type="button"
      className={`request-row ${selected ? "selected" : ""}`}
      style={{ height: ROW_HEIGHT }}
      onClick={() => onSelect(request.id)}
      title={request.url}
    >
      <span className="row-platform-icon">
        <PlatformIcon platform={request.platform} size={16} />
      </span>
      <span className="row-main">
        <span className="row-title">
          <span className="row-event">{request.eventName ?? "Unknown request"}</span>
          {value && <span className="row-value">{value}</span>}
        </span>
        <span className="row-sub">
          {request.unknown
            ? truncateMiddle(compactish(request.url), 46)
            : `${decoded?.platform === "ga4" ? "GA4" : shortPlatform(request.platform)}${id ? ` · ${id}` : ""}`}
        </span>
      </span>
      <span className="row-side">
        <span
          className={`row-status status-${bucket}`}
          title={
            bucket === "issues"
              ? "QA issues detected"
              : bucket === "warnings"
                ? "Notices detected"
                : "No QA flags"
          }
        >
          <span className="status-dot" style={{ background: statusColor(bucket) }} />
        </span>
        <span className="row-time">{formatTimeShort(request.timestamp)}</span>
      </span>
    </button>
  );
}

function shortPlatform(platform: MarketingRequest["platform"]): string {
  switch (platform) {
    case "ga4": return "GA4";
    case "google_ads": return "Ads";
    case "meta": return "Meta";
    case "tiktok": return "TikTok";
    default: return "Unknown";
  }
}

function compactish(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return url;
  }
}

function statusColor(bucket: "issues" | "warnings" | "clean"): string {
  if (bucket === "issues") return "var(--danger)";
  if (bucket === "warnings") return "var(--warn)";
  return "var(--success)";
}

export const RequestList = memo(function RequestList({
  requests,
  selectedId,
  onSelect,
}: Props) {
  const list = useVirtualList(requests.length, ROW_HEIGHT);

  if (requests.length === 0) {
    return <div className="list-empty">No matching requests.</div>;
  }

  return (
    <div className="request-list" ref={list.containerRef} onScroll={list.onScroll}>
      <div className="list-spacer" style={{ height: list.totalHeight }}>
        <div
          className="list-window"
          style={{ transform: `translateY(${list.offsetY}px)` }}
        >
          {requests.slice(list.start, list.end).map((r) => (
            <Row
              key={r.id}
              request={r}
              selected={r.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

export { platformDotColor };