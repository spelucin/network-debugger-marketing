import { X } from "lucide-react";
import type { CaptureSettings } from "../../core/types";

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

interface Props {
  settings: CaptureSettings;
  onUpdate: (patch: Partial<CaptureSettings>) => void;
  onClose: () => void;
}

export function SettingsOverlay({ settings, onUpdate, onClose }: Props) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-panel" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header">
          <h2>Settings</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close settings">
            <X size={15} />
          </button>
        </div>

        <div className="settings-body">
          <Setting label="Capture" hint="Network interception. Always on by default; pausing stops storing new requests.">
            <div className="segmented" role="group">
              <button
                type="button"
                className={`seg-btn ${settings.captureEnabled ? "active" : ""}`}
                onClick={() => onUpdate({ captureEnabled: true })}
              >
                On
              </button>
              <button
                type="button"
                className={`seg-btn ${!settings.captureEnabled ? "active" : ""}`}
                onClick={() => onUpdate({ captureEnabled: false })}
              >
                Off
              </button>
            </div>
          </Setting>

          <Setting
            label="Record"
            hint="Both off = capture-only: requests stream in live, but the list resets on navigation. “This tab” keeps the current tab's history; “All tabs” keeps every tab's. They can be combined."
          >
            <div className="segmented record-scope" role="group">
              <button
                type="button"
                className={`seg-btn ${settings.recordThisTab ? "active" : ""}`}
                onClick={() => onUpdate({ recordThisTab: !settings.recordThisTab })}
              >
                This tab
              </button>
              <button
                type="button"
                className={`seg-btn ${settings.recordAllTabs ? "active" : ""}`}
                onClick={() => onUpdate({ recordAllTabs: !settings.recordAllTabs })}
              >
                All tabs
              </button>
            </div>
          </Setting>

          <Setting label="Retained requests" hint="Older requests are dropped beyond this limit.">
            <input
              type="number"
              min={100}
              max={100000}
              step={100}
              className="number-input"
              value={settings.retainLimit}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 100) onUpdate({ retainLimit: Math.min(100000, Math.round(n)) });
              }}
            />
          </Setting>

          <Setting label="Theme" hint="Color scheme for the sidebar.">
            <div className="segmented" role="group">
              {(["system", "light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`seg-btn ${settings.theme === t ? "active" : ""}`}
                  onClick={() => onUpdate({ theme: t })}
                >
                  {t === "system" ? "System" : t === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
          </Setting>

          <div className="settings-divider" />

          <Setting label="Watched domains" hint="Only these hosts are observed. Nothing else is touched.">
            <div className="domain-list">
              {WATCH_DOMAINS.map((d) => (
                <span key={d} className="domain-chip">
                  {d}
                </span>
              ))}
            </div>
          </Setting>

          <div className="settings-divider" />

          <div className="privacy-note">
            <div className="privacy-title">Privacy</div>
            <p>
              Captured network data stays in your browser and is not sent to a
              server. No analytics, no telemetry, no accounts.
            </p>
            <p>
              Everything — parsing and decoding — runs locally. Requests are
              only read from the marketing domains listed above while capture is
              enabled.
            </p>
          </div>

          <div className="about-note">
            Network Decoder v1.5.0 · a marketing network request decoder.
          </div>
        </div>
      </div>
    </div>
  );
}

function Setting({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting">
      <div className="setting-info">
        <div className="setting-label">{label}</div>
        <div className="setting-hint">{hint}</div>
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}