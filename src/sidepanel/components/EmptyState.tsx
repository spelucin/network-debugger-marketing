import { Play, Radio, RotateCw, WifiOff } from "lucide-react";

interface Props {
  captureEnabled: boolean;
  recording: boolean;
  onStart: () => void;
  onReload: () => void;
}

/**
 * Composed empty state. While live it doubles as onboarding: the three
 * things a first-time user needs to do, in order, with the one actionable
 * step (reload) as an inline button.
 */
export function EmptyState({ captureEnabled, recording, onStart, onReload }: Props) {
  if (!captureEnabled) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <WifiOff size={22} />
        </div>
        <div className="empty-title">Capture is paused</div>
        <div className="empty-desc">
          Requests are not being intercepted. Turn capture back on to resume.
        </div>
        <button type="button" className="empty-action" onClick={onStart}>
          <Play size={13} />
          Start capture
        </button>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Radio size={22} />
      </div>
      <div className="empty-title">Listening for requests</div>
      <ol className="empty-steps">
        <li className="empty-step">
          <span className="empty-step-marker num">1</span>
          <span className="empty-step-text">
            Reload this tab to capture everything from page load.
            <button type="button" className="empty-step-action" onClick={onReload}>
              <RotateCw size={11} />
              Reload
            </button>
          </span>
        </li>
        <li className="empty-step">
          <span className="empty-step-marker num">2</span>
          <span className="empty-step-text">
            Browse the site — decoded requests appear here as they fire.
          </span>
        </li>
        {!recording && (
          <li className="empty-step">
            <span className="empty-step-marker num">3</span>
            <span className="empty-step-text">
              The list resets on navigation. Use Record in the header to keep
              history.
            </span>
          </li>
        )}
      </ol>
    </div>
  );
}
