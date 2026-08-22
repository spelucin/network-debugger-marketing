// Normalized internal model shared by parsers, QA, background capture and UI.

export type Platform =
  | "ga4"
  | "google_ads"
  | "meta"
  | "tiktok"
  | "clarity"
  | "unknown";

export const PLATFORMS: readonly Platform[] = [
  "ga4",
  "google_ads",
  "meta",
  "tiktok",
  "clarity",
  "unknown",
];

export interface PlatformInfo {
  id: Platform;
  label: string;
  shortLabel: string;
}

export const PLATFORM_INFO: Record<Platform, PlatformInfo> = {
  ga4: { id: "ga4", label: "Google Analytics 4", shortLabel: "GA4" },
  google_ads: { id: "google_ads", label: "Google Ads", shortLabel: "ADS" },
  meta: { id: "meta", label: "Meta", shortLabel: "META" },
  tiktok: { id: "tiktok", label: "TikTok", shortLabel: "TIKTOK" },
  clarity: { id: "clarity", label: "Microsoft Clarity", shortLabel: "CLARITY" },
  unknown: { id: "unknown", label: "Unknown", shortLabel: "UNKNOWN" },
};

export type ParamCategory = "standard" | "custom" | "context" | "ecommerce";

export type ParameterType =
  | "string"
  | "number"
  | "boolean"
  | "json"
  | "currency"
  | "url"
  | "id"
  | "timestamp";

export interface Parameter {
  key: string;
  label: string;
  value: unknown;
  category: ParamCategory;
  description?: string;
  documentationUrl?: string;
  type?: ParameterType;
}

export interface EcommerceItem {
  item_id?: string;
  item_name?: string;
  price?: number;
  quantity?: number;
  brand?: string;
  category?: string;
  item_variant?: string;
  coupon?: string;
  currency?: string;
  position?: number;
  [key: string]: unknown;
}

export interface EcommerceData {
  items: EcommerceItem[];
  value?: number;
  currency?: string;
  transaction_id?: string;
  shipping?: number;
  tax?: number;
  coupon?: string;
  affiliation?: string;
}

export type QASeverity = "warning" | "info";

export interface QAIssue {
  /** Stable id used to de-duplicate issues. */
  id: string;
  severity: QASeverity;
  /** Machine code, e.g. "possible-duplicate". */
  code: string;
  message: string;
  detail?: string;
}

export interface RawRequest {
  id: string;
  tabId?: number;
  requestId: string;
  url: string;
  method: string;
  timestamp: number;
  queryParams: Record<string, string | string[]>;
  body?: unknown;
  bodyText?: string;
  headers?: Record<string, string>;
  sizeBytes?: number;
}

export interface PlatformMeta {
  /** GA4 measurement id, e.g. G-XXXXXXX */
  measurementId?: string;
  /** Google Ads conversion id, e.g. AW-123456789 */
  conversionId?: string;
  /** Meta / TikTok pixel id */
  pixelId?: string;
  /** Microsoft Clarity project id */
  projectId?: string;
  [key: string]: unknown;
}

export interface DecodedEvent {
  platform: Platform;
  eventName: string;
  standardParameters: Parameter[];
  customParameters: Parameter[];
  contextParameters: Parameter[];
  ecommerce?: EcommerceData;
  meta: PlatformMeta;
}

export interface MarketingRequest {
  id: string;
  tabId?: number;
  timestamp: number;
  platform: Platform;
  eventName?: string;
  method: string;
  url: string;
  queryParams: Record<string, string | string[]>;
  body?: unknown;
  bodyText?: string;
  headers?: Record<string, string>;
  decoded?: DecodedEvent;
  qa: QAIssue[];
  unknown: boolean;
  sizeBytes?: number;
}

/**
 * Capture = network interception. Always on by default, like a network
 * inspector: every matching request is stored regardless of recording.
 *
 * Record = what the panel keeps on screen. Two non-exclusive scopes decide
 * whether the list is cleared on navigation / tab switches:
 *   - recordThisTab: keep the current tab's requests; switching tabs resets.
 *   - recordAllTabs: keep everything from every tab and domain; never resets.
 * With neither active the list is transient: any navigation (refresh, domain
 * change) clears it and starts fresh.
 */
export interface CaptureSettings {
  captureEnabled: boolean;
  recordThisTab: boolean;
  recordAllTabs: boolean;
  retainLimit: number;
  theme: "system" | "light" | "dark";
}

export const DEFAULT_SETTINGS: CaptureSettings = {
  captureEnabled: true,
  recordThisTab: false,
  // Default to the inspector-like scope: history from every tab stays visible
  // no matter which tab the panel is opened from, so requests captured while
  // the panel was closed are always there when it opens.
  recordAllTabs: true,
  retainLimit: 5000,
  theme: "system",
};

/** True when either recording scope is active. */
export function isRecording(settings: CaptureSettings): boolean {
  return settings.recordThisTab || settings.recordAllTabs;
}

export interface CaptureSnapshot {
  requests: MarketingRequest[];
  settings: CaptureSettings;
  /** Id of the active tab in the focused window, tracked by the worker. */
  activeTabId?: number;
}