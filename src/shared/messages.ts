import type { CaptureSettings, CaptureSnapshot, MarketingRequest } from "../core/types";

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
  | { type: "clear-capture" }
  | { type: "clear-tab"; tabId: number }
  | { type: "set-capture-enabled"; enabled: boolean }
  | { type: "set-record-scope"; thisTab: boolean; allTabs: boolean }
  | { type: "set-settings"; settings: Partial<CaptureSettings> }
  | { type: "mainworld-request"; payload: MainWorldRequestPayload };

export type BackgroundResponse =
  | { ok: true; snapshot: CaptureSnapshot; activeTabId?: number }
  | { ok: true; requests: MarketingRequest[] }
  | { ok: true; settings: CaptureSettings }
  | { ok: false; error: string };

export const STORAGE_KEYS = {
  requests: "nd.requests",
  settings: "nd.settings",
  qaEvents: "nd.qaEvents",
  activeTab: "nd.activeTab",
} as const;