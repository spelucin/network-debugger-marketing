import { useMemo, useRef, useState } from "react";
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
  const menuRef = useRef<HTMLDivElement>(null);

  const count = requests.length;
  const stamp = useMemo(() => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-"), []);

  const statusText = !captureEnabled
    ? "capture paused"
    : recordAllTabs
      ? "recording all tabs"
      : recordThisTab
        ? "recording this tab"
        : "capture-only";

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
        <span className="record-label">Record:</span>
        <div className="segmented record-scope" role="group" aria-label="Recording scope">
          <button
            type="button"
            className={`seg-btn ${recordThisTab ? "active" : ""}`}
            onClick={() => onSetRecordScope(!recordThisTab, recordAllTabs)}
            aria-pressed={recordThisTab}
            title={
              recordThisTab
                ? "Recording this tab: requests from this tab are kept while you browse here. Switching to another tab clears the view."
                : "Click to keep this tab's history across reloads. Right now (off) capture-only is active: the list resets on every navigation."
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
                ? "Recording all tabs: requests from every tab and site are kept until you clear them. Nothing resets on navigation."
                : "Click to keep requests from every tab and site. Right now (off) capture-only is active: the list resets on every navigation."
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