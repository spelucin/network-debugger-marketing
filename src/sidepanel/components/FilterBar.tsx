import { ChevronDown, Search, X } from "lucide-react";
import type { MarketingRequest } from "../../core/types";
import {
  collectEvents,
  type FilterState,
} from "../lib/filters";
import type { ListView } from "./RequestList";
import { Segmented } from "./Segmented";
import { PlatformDropdown } from "./PlatformDropdown";

interface Props {
  filters: FilterState;
  requests: MarketingRequest[];
  captureEnabled: boolean;
  onToggleCapture: () => void;
  onFiltersChange: (filters: FilterState) => void;
  view: ListView;
  onViewChange: (view: ListView) => void;
}

export function FilterBar({
  filters,
  requests,
  captureEnabled,
  onToggleCapture,
  onFiltersChange,
  view,
  onViewChange,
}: Props) {
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
              ? "Capture is on. Matching requests are intercepted and decoded. Click to pause."
              : "Capture is paused and requests are not intercepted. Click to resume."
          }
        >
          <span className={`capture-dot ${captureEnabled ? "on" : "off"}`} />
          Capture
        </button>
        <span className="capture-hint">
          {captureEnabled
            ? "Watching live. The list resets on navigation unless recording is on."
            : "Paused. No requests are being intercepted."}
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

      <div className="tab-row tab-row-options">
        <div className="filter-controls">
          <PlatformDropdown
            requests={requests}
            value={filters.platform}
            onChange={(platform) => onFiltersChange({ ...filters, platform })}
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
        <Segmented
          ariaLabel="List layout"
          className="view-toggle"
          value={view}
          options={[
            { id: "grouped", label: "Platforms" },
            { id: "history", label: "History" },
          ]}
          onChange={onViewChange}
        />
      </div>
    </div>
  );
}
