import { ChevronDown, History, Layers, Search, X } from "lucide-react";
import type { MarketingRequest } from "../../core/types";
import { PLATFORM_INFO } from "../../core/types";
import {
  collectEvents,
  countByPlatform,
  type FilterState,
  type PlatformFilter,
} from "../lib/filters";
import type { ListView } from "./RequestList";
import { Segmented } from "./Segmented";

interface Props {
  filters: FilterState;
  requests: MarketingRequest[];
  captureEnabled: boolean;
  onToggleCapture: () => void;
  onFiltersChange: (filters: FilterState) => void;
  view: ListView;
  onViewChange: (view: ListView) => void;
}

const PLATFORM_TABS: Array<{ id: PlatformFilter; label: string }> = [
  { id: "all", label: "ALL" },
  { id: "ga4", label: PLATFORM_INFO.ga4.shortLabel },
  { id: "google_ads", label: PLATFORM_INFO.google_ads.shortLabel },
  { id: "meta", label: PLATFORM_INFO.meta.shortLabel },
  { id: "tiktok", label: PLATFORM_INFO.tiktok.shortLabel },
  { id: "clarity", label: PLATFORM_INFO.clarity.shortLabel },
];

export function FilterBar({
  filters,
  requests,
  captureEnabled,
  onToggleCapture,
  onFiltersChange,
  view,
  onViewChange,
}: Props) {
  const counts = countByPlatform(requests);
  const events = collectEvents(requests);

  return (
    <div className="filter-bar">
      <div className="capture-row">
        <button
          type="button"
          className={`capture-toggle ${captureEnabled ? "on" : "off"}`}
          onClick={onToggleCapture}
          aria-pressed={captureEnabled}
          title={
            captureEnabled
              ? "Capture is on — every matching request is intercepted and decoded. Click to pause."
              : "Capture is paused — requests are not intercepted. Click to resume."
          }
        >
          <span className={`capture-dot ${captureEnabled ? "on" : "off"}`} />
          Capture
        </button>
        <span className="capture-hint">
          {captureEnabled
            ? "Watches traffic live — the list resets on navigation unless recording is on."
            : "Paused — no requests are being intercepted."}
        </span>
      </div>

      <div className="search-row">
        <div className="search-box">
          <Search size={13} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search requests…"
            value={filters.query}
            onChange={(e) => onFiltersChange({ ...filters, query: e.target.value })}
            spellCheck={false}
          />
          {filters.query && (
            <button
              type="button"
              className="search-clear"
              onClick={() => onFiltersChange({ ...filters, query: "" })}
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="tab-row">
        {PLATFORM_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`chip ${filters.platform === tab.id ? "active" : ""}`}
            onClick={() => onFiltersChange({ ...filters, platform: tab.id })}
          >
            {tab.label}
            <span className="chip-count">{counts[tab.id]}</span>
          </button>
        ))}
      </div>

      <div className="tab-row tab-row-options">
        <Segmented
          ariaLabel="List layout"
          className="view-toggle"
          value={view}
          options={[
            {
              id: "grouped",
              label: (
                <>
                  <Layers size={11} />
                  Platforms
                </>
              ),
              title: "Group requests by platform, most recently active first.",
            },
            {
              id: "history",
              label: (
                <>
                  <History size={11} />
                  History
                </>
              ),
              title: "Flat chronological list across all platforms.",
            },
          ]}
          onChange={onViewChange}
        />
        <div className="event-select-wrap">
          <select
            className="event-select"
            value={filters.event}
            onChange={(e) => onFiltersChange({ ...filters, event: e.target.value })}
            aria-label="Filter by event"
          >
            <option value="">All events</option>
            {events.map((ev) => (
              <option key={ev} value={ev}>
                {ev}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="event-select-caret" />
        </div>
      </div>
    </div>
  );
}
