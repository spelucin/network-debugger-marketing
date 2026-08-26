import { Github, Globe, Linkedin, X } from "lucide-react";
import { WATCH_URLS } from "../../shared/watch-urls";

const ENDPOINT_COUNT = WATCH_URLS.length;

interface Props {
  onClose: () => void;
}

export function AboutOverlay({ onClose }: Props) {
  const version = (() => {
    try {
      return chrome.runtime.getManifest().version;
    } catch {
      return "";
    }
  })();

  return (
    <div className="overlay" onClick={onClose}>
      <div className="overlay-panel" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-header">
          <h2>About Network Decoder{version ? ` v${version}` : ""}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close about">
            <X size={15} />
          </button>
        </div>

        <div className="settings-body about-body">
          <section className="about-section">
            <h3>What is Network Decoder?</h3>
            <p>
              Network Decoder captures and decodes the analytics and marketing
              requests your browser sends, in real time as you browse. It
              watches {ENDPOINT_COUNT} known endpoints across 20+ platforms —
              Google Analytics 4, Meta Pixel, TikTok, Google Ads, and more —
              and turns each opaque beacon into readable events. Everything
              stays local: no servers, no telemetry.
            </p>
          </section>

          <section className="about-section">
            <h3>Side Panel vs DevTools</h3>
            <p>
              This side panel shows a quick, decoded overview of detected
              tracking traffic, grouped by platform. For byte-level inspection
              of the raw exchange, open DevTools (
              <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd>) and use its Network
              tab — then click the request here to see every parameter decoded
              and documented, or export the session as JSON/CSV.
            </p>
          </section>

          <section className="about-section">
            <h3>Reading the Request List</h3>
            <ul>
              <li>
                <strong>Platform badge &amp; event name</strong> — the tool
                detected and what it fired (Page View, Purchase, …).
              </li>
              <li>
                <strong>Host &amp; path</strong> — where the beacon was sent.
              </li>
              <li>
                <strong>Category headers</strong> — click to expand/collapse
                each platform&apos;s group.
              </li>
              <li>
                <strong>Unknown</strong> — captured traffic that doesn&apos;t
                match a known schema yet.
              </li>
            </ul>
          </section>

          <section className="about-section">
            <h3>Filters &amp; Views</h3>
            <ul>
              <li>
                <strong>Search</strong> — filter requests by URL, event, or
                parameter text.
              </li>
              <li>
                <strong>Platforms</strong> — focus on a single tracking tool.
              </li>
              <li>
                <strong>Events</strong> — filter by decoded event name.
              </li>
              <li>
                <strong>Platforms / History</strong> — group by tool, or a
                single chronological list.
              </li>
            </ul>
          </section>

          <section className="about-section">
            <h3>Recording</h3>
            <ul>
              <li>
                <strong>Live</strong> — requests stream in, but the list resets
                on every navigation.
              </li>
              <li>
                <strong>This tab</strong> — keep this tab&apos;s requests across
                reloads; switching tabs clears the view.
              </li>
              <li>
                <strong>All tabs</strong> — keep everything from every tab and
                site until you clear it. Both scopes can be combined from the
                status pill.
              </li>
            </ul>
          </section>

          <section className="about-section">
            <h3>Controls</h3>
            <ul>
              <li>
                <strong>Capture</strong> — pause or resume interception
                entirely.
              </li>
              <li>
                <strong>Reload</strong> — refresh the tab so requests from page
                load are captured too.
              </li>
              <li>
                <strong>Export</strong> — download the session as normalized
                JSON or a CSV table.
              </li>
              <li>
                <strong>Clear</strong> — wipe all captured requests.
              </li>
              <li>
                <strong>Settings</strong> — recording scopes, retention limit,
                and theme.
              </li>
            </ul>
          </section>

          <section className="about-section about-footer">
            <h3>About</h3>
            <p>
              Created by <strong>Alex Spelucin</strong>, who wanted the
              invisible plumbing of ad tech to be legible without opening
              DevTools.
            </p>
            <div className="about-links">
              <a
                className="about-link"
                href="https://www.linkedin.com/in/spelucin"
                target="_blank"
                rel="noreferrer"
              >
                <Linkedin size={12} />
                LinkedIn
              </a>
              <a
                className="about-link"
                href="https://github.com/spelucin"
                target="_blank"
                rel="noreferrer"
              >
                <Github size={12} />
                GitHub
              </a>
              <a
                className="about-link"
                href="https://spelucin.pro"
                target="_blank"
                rel="noreferrer"
              >
                <Globe size={12} />
                spelucin.pro
              </a>
            </div>
            <p className="about-privacy">
              Captured data never leaves your browser. Requests are read only
              from the marketing endpoints listed above, and only while capture
              is enabled.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
