import type {
  CaptureSettings,
  CaptureSnapshot,
  CaptureStats,
  MarketingRequest,
} from "../core/types";

/** A tracking call observed inside the page (main-world hooks). */
export interface MainWorldRequestPayload {
  kind: "fetch" | "xhr" | "beacon";
  method: string;
  url: string;
  bodyText?: string;
}

/** Messages sent from the side panel / options page / content scripts. */
export type PanelToBackgroundMessage =
  | { type: "get-snapshot" }
  | { type: "get-capture-stats"; tabId?: number }
  | { type: "clear-capture" }
  | { type: "mainworld-request"; payload: MainWorldRequestPayload }
  | { type: "mainworld-resources"; urls: string[] }
  | { type: "clear-tab"; tabId: number }
  | { type: "set-capture-enabled"; enabled: boolean }
  | { type: "set-record-scope"; thisTab: boolean; allTabs: boolean }
  | { type: "set-settings"; settings: Partial<CaptureSettings> };

export type BackgroundResponse =
  | { ok: true; snapshot: CaptureSnapshot; activeTabId?: number }
  | { ok: true; requests: MarketingRequest[] }
  | { ok: true; settings: CaptureSettings }
  | { ok: true; stats: CaptureStats }
  | { ok: false; error: string };

export const STORAGE_KEYS = {
  requests: "nd.requests",
  settings: "nd.settings",
  activeTab: "nd.activeTab",
} as const;