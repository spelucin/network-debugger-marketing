import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  RotateCw,
  Settings,
  Trash2,
  FileJson,
  FileSpreadsheet,
} from "lucide-react";
import type { MarketingRequest } from "../../core/types";
import { buildCsvExport, buildJsonExport, downloadFile } from "../lib/export";

interface Props {
  requests: MarketingRequest[];
  captureEnabled: boolean;
  recordThisTab: boolean;
  recordAllTabs: boolean;
  activeTabId: number | undefined;
  onSetRecordScope: (thisTab: boolean, allTabs: boolean) => void;
  onClear: () => void;
  onOpenSettings: () => void;
  onRefreshTab: () => void;
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  return `${m}m`;
}

export function Header({
  requests,
  captureEnabled,
  recordThisTab,
  recordAllTabs,
  activeTabId,
  onSetRecordScope,
  onClear,
  onOpenSettings,
  onRefreshTab,
}: Props) {
  const [exportOpen, setExportOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const menuRef = useRef<HTMLDivElement>(null);

  const count = requests.length;
  const stamp = useMemo(() => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-"), []);

  // One-second ticker so the "updated Xs ago" label stays fresh.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const newest = useMemo(() => {
    let max = 0;
    for (const r of requests) if (r.timestamp > max) max = r.timestamp;
    return max;
  }, [requests]);

  const statusText = !captureEnabled
    ? "capture paused"
    : recordAllTabs
      ? "recording all tabs"
      : recordThisTab
        ? "recording this tab"
        : count === 0
          ? "not recording"
          : `not recording · updated ${formatAge(Math.max(0, Math.floor((now - newest) / 1000)))} ago`;

  const doExport = (kind: "json" | "csv") => {
    const stampPart = stamp;
    if (kind === "json") {
      downloadFile(
        `network-decoder-${stampPart}.json`,
        buildJsonExport(requests),
        "application/json"
      );
    } else {
      downloadFile(
        `network-decoder-${stampPart}.csv`,
        buildCsvExport(requests),
        "text/csv"
      );
    }
    setExportOpen(false);
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <span className="brand-mark" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M4 18 9 12l4 4 7-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="4" cy="18" r="1.6" fill="currentColor" />
            <circle cx="9" cy="12" r="1.6" fill="currentColor" />
            <circle cx="13" cy="16" r="1.6" fill="currentColor" />
            <circle cx="20" cy="7" r="1.6" fill="currentColor" />
          </svg>
        </span>
        <div className="header-title">
          <span className="title-text">Network Decoder</span>
          <span className="title-sub">
            v1.5.0 · {count} request{count === 1 ? "" : "s"} · {statusText}
          </span>
        </div>
      </div>

      <div className="header-actions">
        <div className="segmented record-scope" role="group" aria-label="Recording scope">
          <button
            type="button"
            className={`seg-btn ${recordThisTab ? "active" : ""}`}
            onClick={() => onSetRecordScope(!recordThisTab, recordAllTabs)}
            aria-pressed={recordThisTab}
            title={
              recordThisTab
                ? "Recording this tab. Requests are kept while you stay here; switching tabs clears the view."
                : "Record this tab only. Requests are kept for the current tab; switching tabs or navigating to a new domain clears the list."
            }
          >
            This tab
          </button>
          <button
            type="button"
            className={`seg-btn ${recordAllTabs ? "active" : ""}`}
            onClick={() => onSetRecordScope(recordThisTab, !recordAllTabs)}
            aria-pressed={recordAllTabs}
            title={
              recordAllTabs
                ? "Recording all tabs. Requests from every tab and domain are kept and nothing is cleared on navigation."
                : "Record all tabs. Keep requests from every tab and domain, across refreshes and domain changes."
            }
          >
            All tabs
          </button>
        </div>

        <button
          type="button"
          className="icon-btn"
          onClick={onRefreshTab}
          disabled={activeTabId === undefined}
          title="Reload this tab to capture requests from page load"
          aria-label="Reload current tab"
        >
          <RotateCw size={15} />
        </button>

        <div className="menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setExportOpen((v) => !v)}
            title="Export captured requests"
            aria-label="Export captured requests"
            aria-expanded={exportOpen}
          >
            <Download size={15} />
          </button>
          {exportOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setExportOpen(false)} />
              <div className="menu" role="menu">
                <div className="menu-label">Export session</div>
                <button type="button" role="menuitem" onClick={() => doExport("json")}>
                  <span className="menu-icon"><FileJson size={14} /></span>
                  JSON <span className="menu-hint">normalized</span>
                </button>
                <button type="button" role="menuitem" onClick={() => doExport("csv")}>
                  <span className="menu-icon"><FileSpreadsheet size={14} /></span>
                  CSV <span className="menu-hint">table</span>
                </button>
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          className="icon-btn danger"
          onClick={onClear}
          title="Clear captured requests"
          aria-label="Clear captured requests"
        >
          <Trash2 size={15} />
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={onOpenSettings}
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={15} />
        </button>
      </div>
    </header>
  );
}