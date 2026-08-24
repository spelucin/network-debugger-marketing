import { useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Download,
  RotateCw,
  Settings,
  Trash2,
  FileJson,
  FileSpreadsheet,
} from "lucide-react";
import type { MarketingRequest } from "../../core/types";
import { buildCsvExport, buildJsonExport, downloadFile } from "../lib/export";
import { Switch } from "./Switch";

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

type StatusTone = "live" | "recording" | "paused";

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
  const [recordOpen, setRecordOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const count = requests.length;
  const stamp = useMemo(() => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-"), []);

  const status: { label: string; tone: StatusTone; title: string } = !captureEnabled
    ? {
        label: "Paused",
        tone: "paused",
        title: "Capture is paused — requests are not being intercepted.",
      }
    : recordAllTabs || recordThisTab
      ? {
          label: "Recording",
          tone: "recording",
          title: recordAllTabs
            ? "Recording all tabs — requests from every tab and site are kept until cleared."
            : "Recording this tab — history is kept while you browse here; switching tabs clears the view.",
        }
      : {
          label: "Live",
          tone: "live",
          title:
            "Capture-only: requests stream in live, but the list resets on navigation. Click to keep history.",
        };

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
        <span className="title-text">Network Decoder</span>

        <div className="menu-wrap">
          <button
            type="button"
            className={`status-pill ${status.tone}`}
            onClick={() => setRecordOpen((v) => !v)}
            aria-expanded={recordOpen}
            aria-haspopup="menu"
            title={status.title}
          >
            <span className="status-pill-dot" />
            {status.label}
            <span className="status-pill-count num">
              {count}
            </span>
            <ChevronDown size={10} className="status-pill-caret" />
          </button>

          {recordOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setRecordOpen(false)} />
              <div className="menu record-menu" role="menu" aria-label="Recording scope">
                <div className="menu-label">Recording</div>
                <div className="record-menu-row">
                  <div className="record-menu-text">
                    <div className="record-menu-title">This tab</div>
                    <div className="record-menu-hint">
                      Keeps this tab's requests across reloads; switching tabs clears the view.
                    </div>
                  </div>
                  <Switch
                    checked={recordThisTab}
                    onChange={(v) => onSetRecordScope(v, recordAllTabs)}
                    label="Record this tab"
                  />
                </div>
                <div className="record-menu-row">
                  <div className="record-menu-text">
                    <div className="record-menu-title">All tabs</div>
                    <div className="record-menu-hint">
                      Keeps requests from every tab and site until cleared.
                    </div>
                  </div>
                  <Switch
                    checked={recordAllTabs}
                    onChange={(v) => onSetRecordScope(recordThisTab, v)}
                    label="Record all tabs"
                  />
                </div>
                <div className="record-menu-footnote">
                  Scopes can be combined. Both off = capture-only: the list
                  resets on navigation.
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="header-actions">
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
