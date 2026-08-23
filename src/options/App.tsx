import { useEffect, useState } from "react";
import type { CaptureSettings } from "../core/types";
import { DEFAULT_SETTINGS } from "../core/types";
import { STORAGE_KEYS } from "../shared/messages";

const WATCH_DOMAINS = [
  "google-analytics.com",
  "analytics.google.com",
  "googletagmanager.com",
  "googleadservices.com",
  "doubleclick.net",
  "adservice.google.com",
  "google.com/pagead",
  "facebook.com",
  "facebook.net",
  "tiktok.com",
];

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
          Marketing network request decoder · v1.5.0
        </p>

        <h2>Capture</h2>
        <div className="options-row">
          <span>
            Capture network requests
            <small>Always on by default; pausing stops storing new requests.</small>
          </span>
          <div className="segmented" role="group">
            <button
              type="button"
              className={`seg-btn ${settings.captureEnabled ? "active" : ""}`}
              onClick={() => update({ captureEnabled: true })}
            >
              On
            </button>
            <button
              type="button"
              className={`seg-btn ${!settings.captureEnabled ? "active" : ""}`}
              onClick={() => update({ captureEnabled: false })}
            >
              Off
            </button>
          </div>
        </div>

        <h2>Record</h2>
        <div className="options-row">
          <span>
            What the panel keeps on screen
            <small>Options are not exclusive. Recording across all tabs keeps everything.</small>
          </span>
          <div className="segmented record-scope" role="group">
            <button
              type="button"
              className={`seg-btn ${settings.recordThisTab ? "active" : ""}`}
              onClick={() => update({ recordThisTab: !settings.recordThisTab })}
            >
              This tab
            </button>
            <button
              type="button"
              className={`seg-btn ${settings.recordAllTabs ? "active" : ""}`}
              onClick={() => update({ recordAllTabs: !settings.recordAllTabs })}
            >
              All tabs
            </button>
          </div>
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
            className="number-input"
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
          <div className="segmented" role="group">
            {(["system", "light", "dark"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`seg-btn ${settings.theme === t ? "active" : ""}`}
                onClick={() => update({ theme: t })}
              >
                {t === "system" ? "System" : t === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
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
          Captured network data stays in your browser and is not sent to a server.
          No analytics, no telemetry, no accounts. Everything — parsing and
          decoding — runs locally.
        </p>
      </div>
    </div>
  );
}