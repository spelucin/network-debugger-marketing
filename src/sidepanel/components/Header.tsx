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

type StatusTone = "live" | "tab" | "all" | "paused";

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
        title: "Capture is paused, so requests are not being recorded.",
      }
    : recordAllTabs
      ? {
          label: "All tabs",
          tone: "all",
          title: recordThisTab
            ? "Recording all tabs and this tab. Requests from every tab are kept until you clear them."
            : "Recording all tabs. Requests from every tab and site are kept until you clear them.",
        }
      : recordThisTab
        ? {
            label: "This tab",
            tone: "tab",
            title:
              "Recording this tab. History is kept while you browse here and clears when you switch tabs.",
          }
        : {
            label: "Live",
            tone: "live",
            title:
              "Live capture. Requests stream in but the list resets on navigation. Click to keep history.",
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
          <img src="icons/icon-32.png" width={16} height={16} alt="" />
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
                      Keep this tab&apos;s requests across reloads. Switching tabs clears the view.
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
                      Keep requests from every tab and site until you clear them.
                    </div>
                  </div>
                  <Switch
                    checked={recordAllTabs}
                    onChange={(v) => onSetRecordScope(recordThisTab, v)}
                    label="Record all tabs"
                  />
                </div>
                <div className="record-menu-footnote">
                  You can turn on both scopes. With both off, the list resets
                  on every navigation.
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
