import { ChevronDown, Search, X } from "lucide-react";
import type { MarketingRequest } from "../../core/types";
import { PLATFORM_INFO } from "../../core/types";
import {
  collectEvents,
  countByPlatform,
  countByQa,
  type FilterState,
  type PlatformFilter,
  type QaFilter,
} from "../lib/filters";

interface Props {
  filters: FilterState;
  requests: MarketingRequest[];
  captureEnabled: boolean;
  onToggleCapture: () => void;
  onFiltersChange: (filters: FilterState) => void;
}

const PLATFORM_TABS: Array<{ id: PlatformFilter; label: string }> = [
  { id: "all", label: "ALL" },
  { id: "ga4", label: PLATFORM_INFO.ga4.shortLabel },
  { id: "google_ads", label: PLATFORM_INFO.google_ads.shortLabel },
  { id: "meta", label: PLATFORM_INFO.meta.shortLabel },
  { id: "tiktok", label: PLATFORM_INFO.tiktok.shortLabel },
  { id: "clarity", label: PLATFORM_INFO.clarity.shortLabel },
];

const QA_TABS: Array<{ id: QaFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "issues", label: "Issues" },
  { id: "warnings", label: "Warnings" },
  { id: "clean", label: "Clean" },
];

export function FilterBar({ filters, requests, captureEnabled, onToggleCapture, onFiltersChange }: Props) {
  const counts = countByPlatform(requests);
  const qaCounts = countByQa(requests);
  const events = collectEvents(requests);

  return (
    <div className="filter-bar">
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
        <button
          type="button"
          className={`capture-toggle ${captureEnabled ? "on" : "off"}`}
          onClick={onToggleCapture}
          aria-pressed={captureEnabled}
          title={
            captureEnabled
              ? "Capture is on — every matching request is stored. Click to pause."
              : "Capture is paused — requests are not intercepted. Click to resume."
          }
        >
          <span className={`capture-dot ${captureEnabled ? "on" : "off"}`} />
          Capture
        </button>
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

      <div className="tab-row tab-row-qa">
        <div className="segmented" role="group" aria-label="QA filter">
          {QA_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`seg-btn ${filters.qa === tab.id ? "active" : ""}`}
              onClick={() => onFiltersChange({ ...filters, qa: tab.id })}
              title={
                tab.id === "issues"
                  ? "Requests with warnings (duplicates, missing, suspicious, inconsistent)"
                  : tab.id === "warnings"
                    ? "Requests with informational notices"
                    : "Requests with no QA flags"
              }
            >
              {tab.label}
              <span className="seg-count">{qaCounts[tab.id]}</span>
            </button>
          ))}
        </div>
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