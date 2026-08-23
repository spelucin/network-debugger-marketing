import { memo, useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { MarketingRequest, Platform } from "../../core/types";
import { PLATFORM_INFO } from "../../core/types";
import { formatMoney, formatTimeShort, truncateMiddle } from "../../core/url";
import { groupByPlatform, requestId } from "../lib/filters";
import { PlatformIcon } from "./PlatformIcon";
import { useVirtualList, type VirtualItem } from "../hooks/useVirtualList";

const ROW_HEIGHT = 54;
const GROUP_HEIGHT = 30;

export type ListView = "grouped" | "history";

interface Props {
  requests: MarketingRequest[];
  view: ListView;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

type ListItem =
  | { kind: "row"; request: MarketingRequest }
  | { kind: "group"; platform: Platform; count: number };

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
  const id = requestId(request);
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
            : `${PLATFORM_INFO[request.platform].shortLabel}${id ? ` · ${id}` : ""}`}
        </span>
      </span>
      <span className="row-side">
        <span className="row-time">{formatTimeShort(request.timestamp)}</span>
      </span>
    </button>
  );
}

function compactish(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`;
  } catch {
    return url;
  }
}

function buildItems(
  requests: MarketingRequest[],
  view: ListView,
  collapsed: ReadonlySet<Platform>
): Array<VirtualItem & { data: ListItem }> {
  if (view === "history") {
    return requests.map((request) => ({
      id: `row:${request.id}`,
      height: ROW_HEIGHT,
      data: { kind: "row", request },
    }));
  }

  const items: Array<VirtualItem & { data: ListItem }> = [];
  for (const section of groupByPlatform(requests)) {
    items.push({
      id: `group:${section.platform}`,
      height: GROUP_HEIGHT,
      data: { kind: "group", platform: section.platform, count: section.requests.length },
    });
    if (collapsed.has(section.platform)) continue;
    for (const request of section.requests) {
      items.push({
        id: `row:${request.id}`,
        height: ROW_HEIGHT,
        data: { kind: "row", request },
      });
    }
  }
  return items;
}

export const RequestList = memo(function RequestList({
  requests,
  view,
  selectedId,
  onSelect,
}: Props) {
  // Accordion state: which platform groups are folded shut. Groups start
  // expanded; collapsing only hides rows, the sticky header count remains.
  const [collapsed, setCollapsed] = useState<ReadonlySet<Platform>>(new Set());

  const toggleGroup = useCallback((platform: Platform) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  }, []);

  const items = useMemo(
    () => buildItems(requests, view, collapsed),
    [requests, view, collapsed]
  );
  const list = useVirtualList(items);

  if (requests.length === 0) {
    return <div className="list-empty">No matching requests.</div>;
  }

  return (
    <div className="request-list" ref={list.containerRef} onScroll={list.onScroll}>
      <div className="list-spacer" style={{ height: list.totalHeight }}>
        {list.visible.map(({ item, top }) => {
          if (item.data.kind === "group") {
            const { platform, count } = item.data;
            const info = PLATFORM_INFO[platform];
            const isCollapsed = collapsed.has(platform);
            const Caret = isCollapsed ? ChevronRight : ChevronDown;
            return (
              <button
                key={item.id}
                type="button"
                className="group-header"
                style={{ top, height: item.height }}
                onClick={() => toggleGroup(platform)}
                aria-expanded={!isCollapsed}
                title={
                  isCollapsed
                    ? `Expand ${info.label} (${count} request${count === 1 ? "" : "s"})`
                    : `Collapse ${info.label}`
                }
              >
                <Caret size={11} className="group-caret" />
                <PlatformIcon platform={item.data.platform} size={13} />
                <span className="group-label">{info.label}</span>
                <span className="group-count">{count}</span>
              </button>
            );
          }
          const request = item.data.request;
          return (
            <div key={item.id} className="list-cell" style={{ top, height: item.height }}>
              <Row request={request} selected={request.id === selectedId} onSelect={onSelect} />
            </div>
          );
        })}
      </div>
    </div>
  );
});
