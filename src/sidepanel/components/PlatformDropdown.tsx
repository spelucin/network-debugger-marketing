import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { MarketingRequest, Platform } from "../../core/types";
import { PLATFORM_INFO } from "../../core/types";
import type { PlatformFilter } from "../lib/filters";
import { PlatformIcon } from "./PlatformIcon";

interface Props {
  requests: MarketingRequest[];
  value: PlatformFilter;
  onChange: (value: PlatformFilter) => void;
}

interface Entry {
  platform: Exclude<PlatformFilter, "all">;
  label: string;
  count: number;
}

/**
 * Dynamic platform filter. The menu lists only platforms actually present
 * in the captured requests, most captured first — the filter can never
 * offer a platform that has nothing to show.
 */
export function PlatformDropdown({ requests, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const counts = new Map<Platform, number>();
    for (const r of requests) {
      if (r.platform === "unknown") continue;
      counts.set(r.platform, (counts.get(r.platform) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([platform, count]): Entry => ({
        platform: platform as Exclude<PlatformFilter, "all">,
        label: PLATFORM_INFO[platform].label,
        count,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [requests]);

  // A cleared capture can orphan the active filter — fall back to all.
  useEffect(() => {
    if (value !== "all" && !entries.some((e) => e.platform === value)) {
      onChange("all");
    }
  }, [value, entries, onChange]);

  const active = entries.find((e) => e.platform === value);
  const total = requests.length;

  return (
    <div className="menu-wrap platform-filter" ref={wrapRef}>
      <button
        type="button"
        className="platform-filter-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Filter by platform"
      >
        {active ? (
          <PlatformIcon platform={active.platform} size={14} />
        ) : (
          <span className="platform-filter-glyph">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" fill="currentColor" opacity="0.55" />
              <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" fill="currentColor" opacity="0.35" />
              <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" fill="currentColor" opacity="0.35" />
              <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" fill="currentColor" opacity="0.55" />
            </svg>
          </span>
        )}
        <span className="platform-filter-label">
          {active ? active.label : "All platforms"}
        </span>
        <span className="platform-filter-count num">{active ? active.count : total}</span>
        <ChevronDown size={11} className="platform-filter-caret" />
      </button>

      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="menu platform-filter-menu" role="listbox" aria-label="Platform">
            <button
              type="button"
              role="option"
              aria-selected={value === "all"}
              className="platform-filter-row"
              onClick={() => {
                onChange("all");
                setOpen(false);
              }}
            >
              <span className="platform-filter-row-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" fill="currentColor" opacity="0.55" />
                  <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" fill="currentColor" opacity="0.35" />
                  <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" fill="currentColor" opacity="0.35" />
                  <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" fill="currentColor" opacity="0.55" />
                </svg>
              </span>
              <span className="platform-filter-row-label">All platforms</span>
              <span className="platform-filter-row-count num">{total}</span>
              {value === "all" && <Check size={13} className="platform-filter-check" />}
            </button>

            {entries.map((entry) => (
              <button
                key={entry.platform}
                type="button"
                role="option"
                aria-selected={value === entry.platform}
                className="platform-filter-row"
                onClick={() => {
                  onChange(entry.platform);
                  setOpen(false);
                }}
              >
                <span className="platform-filter-row-icon">
                  <PlatformIcon platform={entry.platform} size={14} />
                </span>
                <span className="platform-filter-row-label">{entry.label}</span>
                <span className="platform-filter-row-count num">{entry.count}</span>
                {value === entry.platform && (
                  <Check size={13} className="platform-filter-check" />
                )}
              </button>
            ))}

            {entries.length === 0 && (
              <div className="platform-filter-empty">No platforms captured yet.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
