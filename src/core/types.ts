// Normalized internal model shared by parsers, background capture and UI.

export type Platform =
  | "ga4"
  | "universal_analytics"
  | "google_ads"
  | "meta"
  | "tiktok"
  | "clarity"
  | "amplitude"
  | "mixpanel"
  | "matomo"
  | "linkedin"
  | "reddit"
  | "pinterest"
  | "gtm"
  | "adobe"
  | "segment"
  | "bing"
  | "twitter"
  | "snapchat"
  | "youtube"
  | "heap"
  | "criteo"
  | "piwik"
  | "optimizely"
  | "hubspot"
  | "hotjar"
  | "unknown";

export const PLATFORMS: readonly Platform[] = [
  "ga4",
  "universal_analytics",
  "google_ads",
  "meta",
  "tiktok",
  "clarity",
  "amplitude",
  "mixpanel",
  "matomo",
  "linkedin",
  "reddit",
  "pinterest",
  "gtm",
  "adobe",
  "segment",
  "bing",
  "twitter",
  "snapchat",
  "youtube",
  "heap",
  "criteo",
  "piwik",
  "optimizely",
  "hubspot",
  "hotjar",
  "unknown",
];

export interface PlatformInfo {
  id: Platform;
  label: string;
  shortLabel: string;
}

export const PLATFORM_INFO: Record<Platform, PlatformInfo> = {
  ga4: { id: "ga4", label: "Google Analytics 4", shortLabel: "GA4" },
  universal_analytics: {
    id: "universal_analytics",
    label: "Universal Analytics",
    shortLabel: "UA",
  },
  google_ads: { id: "google_ads", label: "Google Ads", shortLabel: "ADS" },
  meta: { id: "meta", label: "Meta", shortLabel: "META" },
  tiktok: { id: "tiktok", label: "TikTok", shortLabel: "TIKTOK" },
  clarity: { id: "clarity", label: "Microsoft Clarity", shortLabel: "CLARITY" },
  amplitude: { id: "amplitude", label: "Amplitude", shortLabel: "AMP" },
  mixpanel: { id: "mixpanel", label: "Mixpanel", shortLabel: "MIX" },
  matomo: { id: "matomo", label: "Matomo", shortLabel: "MATOMO" },
  linkedin: { id: "linkedin", label: "LinkedIn", shortLabel: "LI" },
  reddit: { id: "reddit", label: "Reddit", shortLabel: "REDDIT" },
  pinterest: { id: "pinterest", label: "Pinterest", shortLabel: "PIN" },
  gtm: { id: "gtm", label: "Google Tag Manager", shortLabel: "GTM" },
  adobe: { id: "adobe", label: "Adobe", shortLabel: "ADOBE" },
  segment: { id: "segment", label: "Segment", shortLabel: "SEGMENT" },
  bing: { id: "bing", label: "Bing", shortLabel: "BING" },
  twitter: { id: "twitter", label: "Twitter", shortLabel: "TWTR" },
  snapchat: { id: "snapchat", label: "Snapchat", shortLabel: "SNAP" },
  youtube: { id: "youtube", label: "YouTube", shortLabel: "YT" },
  heap: { id: "heap", label: "Heap", shortLabel: "HEAP" },
  criteo: { id: "criteo", label: "Criteo", shortLabel: "CRITEO" },
  piwik: { id: "piwik", label: "Piwik", shortLabel: "PIWIK" },
  optimizely: { id: "optimizely", label: "Optimizely", shortLabel: "OPT" },
  hubspot: { id: "hubspot", label: "HubSpot", shortLabel: "HUBSPOT" },
  hotjar: { id: "hotjar", label: "Hotjar", shortLabel: "HOTJAR" },
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
  unknown: boolean;
  sizeBytes?: number;
}

/**
 * Capture = network interception. Always on by default, like a network
 * inspector: every matching request is stored regardless of recording.
 *
 * The panel boots into capture-only mode (neither recording scope active):
 * requests stream in live, but the view is transient and starts fresh on
 * every navigation. Recording is strictly opt-in:
 *   - recordThisTab: keep the current tab's requests; switching tabs resets.
 *   - recordAllTabs: keep everything from every tab and domain; never resets.
 */
export interface CaptureSettings {
  captureEnabled: boolean;
  recordThisTab: boolean;
  recordAllTabs: boolean;
  /** How the request list lays out captured traffic. */
  listView: "grouped" | "history";
  retainLimit: number;
  theme: "system" | "light" | "dark";
}

export const DEFAULT_SETTINGS: CaptureSettings = {
  captureEnabled: true,
  // Capture-only by default: interception runs, but the view stays transient
  // until the user explicitly turns on a recording scope in the header.
  recordThisTab: false,
  recordAllTabs: false,
  listView: "grouped",
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

/** One platform observed on a tab, from URL classification and/or its SDK
 * loader script — even before (or without) any decoded beacon. */
export interface DetectedPlatform {
  platform: Platform;
  /** Beacon-classified request count since last reset. */
  hits: number;
  /** IDs lifted from loader scripts (GTM-…, G-…, AW-…, project ids). */
  scriptIds: string[];
}

/** Observation-plane throughput counters for one tab. */
export interface MatcherPerf {
  /** URLs classified since last reset (static assets skipped pre-count). */
  observed: number;
  /** Subset that matched a known tracker endpoint or SDK script. */
  matched: number;
  /** Mean classification time in milliseconds. */
  avgMs: number;
}

/** What the panel's detection row / status footer render. */
export interface CaptureStats {
  platforms: DetectedPlatform[];
  perf: MatcherPerf;
}

export const EMPTY_CAPTURE_STATS: CaptureStats = {
  platforms: [],
  perf: { observed: 0, matched: 0, avgMs: 0 },
};