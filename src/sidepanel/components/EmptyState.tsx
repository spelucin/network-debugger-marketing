import { Play, WifiOff } from "lucide-react";

interface Props {
  captureEnabled: boolean;
  recording: boolean;
  onStart: () => void;
}

export function EmptyState({ captureEnabled, recording, onStart }: Props) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        {captureEnabled ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
            <path d="M7 13l3 3 7-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <WifiOff size={22} />
        )}
      </div>
      <div className="empty-title">
        {captureEnabled ? "No requests yet" : "Capture is paused"}
      </div>
      <div className="empty-desc">
        {captureEnabled
          ? recording
            ? "Nothing captured so far. If you opened the panel after the page loaded, reload this page (refresh button above) to capture all requests from page load."
            : "Capture-only mode: the view starts fresh on every navigation. Turn on a recording scope (This tab / All tabs) to keep history, or reload this page (refresh button above) to capture from page load."
          : "Turn capture on to start intercepting marketing requests."}
      </div>
      {!captureEnabled && (
        <button type="button" className="empty-action" onClick={onStart}>
          <Play size={13} />
          Start capture
        </button>
      )}
    </div>
  );
}