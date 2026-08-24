import { useEffect, useState } from "react";
import type { CaptureSettings } from "../core/types";
import { DEFAULT_SETTINGS } from "../core/types";
import { STORAGE_KEYS } from "../shared/messages";
import { watchDomains } from "../shared/watch-urls";
import { Switch } from "../sidepanel/components/Switch";
import { Segmented } from "../sidepanel/components/Segmented";

const WATCH_DOMAINS = watchDomains();

export function App() {
  const [settings, setSettings] = useState<CaptureSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    void chrome.storage.session
      .get(STORAGE_KEYS.settings)
      .then((res) => {
        const stored = res[STORAGE_KEYS.settings] as Partial<CaptureSettings> | undefined;
        if (stored) setSettings({ ...DEFAULT_SETTINGS, ...stored });
      });
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area !== "session") return;
      const st = changes[STORAGE_KEYS.settings];
      if (st) setSettings({ ...DEFAULT_SETTINGS, ...(st.newValue as Partial<CaptureSettings>) });
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  useEffect(() => {
    const apply = () => {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const dark =
        settings.theme === "dark" || (settings.theme === "system" && systemDark);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme]);

  const update = (patch: Partial<CaptureSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    void chrome.storage.session.set({ [STORAGE_KEYS.settings]: next });
  };

  return (
    <div className="options-page">
      <div className="options-card">
        <h1>Network Decoder</h1>
        <p className="options-tag">
          Marketing request debugger · v1.5.0
        </p>

        <h2>Capture</h2>
        <div className="options-row">
          <span>
            Capture network requests
            <small>
              On by default. When paused, new requests are not stored.
            </small>
          </span>
          <Switch
            checked={settings.captureEnabled}
            onChange={(v) => update({ captureEnabled: v })}
            label="Capture network requests"
          />
        </div>

        <h2>Record</h2>
        <div className="options-row">
          <span>
            This tab
            <small>
              Keep the current tab's requests across reloads. Switching tabs
              clears the view.
            </small>
          </span>
          <Switch
            checked={settings.recordThisTab}
            onChange={(v) => update({ recordThisTab: v })}
            label="Record this tab"
          />
        </div>
        <div className="options-row">
          <span>
            All tabs
            <small>
              Keep requests from every tab and site until you clear them. You
              can combine this with This tab.
            </small>
          </span>
          <Switch
            checked={settings.recordAllTabs}
            onChange={(v) => update({ recordAllTabs: v })}
            label="Record all tabs"
          />
        </div>

        <div className="options-row">
          <span>
            Retained requests
            <small>Older requests are dropped beyond this limit.</small>
          </span>
          <input
            type="number"
            min={100}
            max={100000}
            step={100}
            className="number-input num"
            value={settings.retainLimit}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n) && n >= 100) {
                update({ retainLimit: Math.min(100000, Math.round(n)) });
              }
            }}
          />
        </div>

        <div className="options-row">
          <span>Theme</span>
          <Segmented
            ariaLabel="Theme"
            value={settings.theme}
            options={[
              { id: "system", label: "System" },
              { id: "light", label: "Light" },
              { id: "dark", label: "Dark" },
            ]}
            onChange={(theme) => update({ theme })}
          />
        </div>

        <h2>Watched domains</h2>
        <p className="options-body">
          The extension only reads requests sent to these hosts. Nothing else is
          observed.
        </p>
        <div className="domain-list">
          {WATCH_DOMAINS.map((d) => (
            <span key={d} className="domain-chip">
              {d}
            </span>
          ))}
        </div>

        <h2>Privacy</h2>
        <p className="options-body">
          Captured network data stays in your browser and is never sent to a
          server. There are no analytics, no telemetry, and no accounts.
          Parsing and decoding all run locally.
        </p>
      </div>
    </div>
  );
}
