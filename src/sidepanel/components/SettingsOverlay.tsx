import { X } from "lucide-react";
import type { CaptureSettings } from "../../core/types";
import { watchDomains } from "../../shared/watch-urls";
import { Switch } from "./Switch";
import { Segmented } from "./Segmented";

const WATCH_DOMAINS = watchDomains();

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
          <Setting
            label="Capture"
            hint="On by default. When paused, new requests are not stored."
          >
            <Switch
              checked={settings.captureEnabled}
              onChange={(v) => onUpdate({ captureEnabled: v })}
              label="Capture network requests"
            />
          </Setting>

          <Setting
            label="Record this tab"
            hint="Keep the current tab's requests across reloads. Switching tabs clears the view."
          >
            <Switch
              checked={settings.recordThisTab}
              onChange={(v) => onUpdate({ recordThisTab: v })}
              label="Record this tab"
            />
          </Setting>

          <Setting
            label="Record all tabs"
            hint="Keep requests from every tab and site until you clear them. You can combine this with This tab."
          >
            <Switch
              checked={settings.recordAllTabs}
              onChange={(v) => onUpdate({ recordAllTabs: v })}
              label="Record all tabs"
            />
          </Setting>

          <Setting label="Retained requests" hint="Older requests are dropped beyond this limit.">
            <input
              type="number"
              min={100}
              max={100000}
              step={100}
              className="number-input num"
              value={settings.retainLimit}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 100) onUpdate({ retainLimit: Math.min(100000, Math.round(n)) });
              }}
            />
          </Setting>

          <Setting label="Theme" hint="Color scheme for the sidebar.">
            <Segmented
              ariaLabel="Theme"
              value={settings.theme}
              options={[
                { id: "system", label: "System" },
                { id: "light", label: "Light" },
                { id: "dark", label: "Dark" },
              ]}
              onChange={(theme) => onUpdate({ theme })}
            />
          </Setting>

          <div className="settings-divider" />

          <Setting label="Watched domains" hint="Only these hosts are observed. No other traffic is read.">
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
              Captured network data stays in your browser and is never sent to
              a server. There are no analytics, no telemetry, and no accounts.
            </p>
            <p>
              Parsing and decoding all run locally. Requests are read only from
              the marketing domains listed above, and only while capture is
              enabled.
            </p>
          </div>

          <div className="about-note">Network Decoder v1.5.0</div>
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
