// Tracker endpoint matching shared by every capture path.
//
// The page-level hooks (main world) cannot translate Chrome match patterns
// cheaply, so both they and the tests use this hostname/path rule list instead.
//
// Rules are grouped by registrable domain once at module load, so a lookup
// costs one map probe plus a couple of candidate checks rather than a scan of
// every rule. Candidate lookup uses the request's eTLD+1; each rule still
// verifies its own host suffix, so `adservice.google.com` never widens into
// all of google.com.

import type { Platform } from "../core/types";
import { apexDomain, hostOf } from "./detection/url-patterns";

interface BeaconRule {
  platform: Platform;
  /** Matches this host or any subdomain of it.
   * Path-only rules omit it and match any https/http host. */
  hostSuffix?: string;
  /** When set, at least one prefix must match the URL path. */
  pathPrefixes?: string[];
}

const BEACON_RULES: ReadonlyArray<BeaconRule> = [
  // ── Google Analytics 4 ────────────────────────────────────────────────────
  { platform: "ga4", hostSuffix: "google-analytics.com" },
  { platform: "ga4", hostSuffix: "analytics.google.com" },
  { platform: "ga4", hostSuffix: "region1.google-analytics.com" },
  { platform: "ga4", hostSuffix: "region2.google-analytics.com" },
  { platform: "ga4", hostSuffix: "region1.analytics.google.com" },
  { platform: "ga4", hostSuffix: "region2.analytics.google.com" },

  // ── Google Tag Manager + gtag ─────────────────────────────────────────────
  { platform: "gtm", hostSuffix: "googletagmanager.com" },

  // ── Google Ads ────────────────────────────────────────────────────────────
  { platform: "google_ads", hostSuffix: "googleadservices.com" },
  { platform: "google_ads", hostSuffix: "doubleclick.net" },
  { platform: "google_ads", hostSuffix: "adservice.google.com" },
  { platform: "google_ads", hostSuffix: "2mdn.net" },
  { platform: "google_ads", hostSuffix: "s0.2mdn.net" },
  { platform: "google_ads", hostSuffix: "s1.2mdn.net" },
  { platform: "google_ads", hostSuffix: "securepubads.g.doubleclick.net" },
  { platform: "google_ads", hostSuffix: "pubads.g.doubleclick.net" },
  { platform: "google_ads", hostSuffix: "googleads4.g.doubleclick.net" },
  { platform: "google_ads", hostSuffix: "googletagservices.com" },
  { platform: "google_ads", hostSuffix: "feedads.g.doubleclick.net" },
  { platform: "google_ads", hostSuffix: "pagead2.googlesyndication.com" },
  { platform: "google_ads", hostSuffix: "adtrafficquality.google" },
  { platform: "google_ads", hostSuffix: "ep1.adtrafficquality.google" },
  { platform: "google_ads", hostSuffix: "ep2.adtrafficquality.google" },
  { platform: "google_ads", hostSuffix: "merchant-center-analytics.goog" },
  // stats.g.doubleclick.net serves both products: /g/collect is GA4
  // measurement relayed via DoubleClick; /r|j/collect are Ads Signals.
  { platform: "ga4", hostSuffix: "stats.g.doubleclick.net", pathPrefixes: ["/g/collect"] },
  { platform: "google_ads", hostSuffix: "stats.g.doubleclick.net", pathPrefixes: ["/r/collect", "/j/collect"] },

  // ── Meta Pixel ────────────────────────────────────────────────────────────
  { platform: "meta", hostSuffix: "facebook.com", pathPrefixes: ["/tr", "/fr/"] },
  { platform: "meta", hostSuffix: "facebook.net", pathPrefixes: ["/tr", "/signals"] },
  { platform: "meta", hostSuffix: "connect.facebook.net", pathPrefixes: ["/signals"] },
  { platform: "meta", hostSuffix: "connect.facebook.com", pathPrefixes: ["/signals"] },

  // ── TikTok Pixel ──────────────────────────────────────────────────────────
  {
    platform: "tiktok",
    hostSuffix: "analytics.tiktok.com",
    pathPrefixes: ["/api/v2/pixel", "/i18n/pixel"],
  },
  { platform: "tiktok", hostSuffix: "tiktok.com", pathPrefixes: ["/i18n/pixel"] },
  { platform: "tiktok", hostSuffix: "events.tiktok.com" },
  { platform: "tiktok", hostSuffix: "analytics-sg.tiktok.com" },
  { platform: "tiktok", hostSuffix: "an.tiktok.com" },
  { platform: "tiktok", hostSuffix: "analytics-ipv6.tiktokw.us" },
  { platform: "tiktok", hostSuffix: "tiktokw.us" },

  // ── Microsoft Clarity ─────────────────────────────────────────────────────
  { platform: "clarity", hostSuffix: "clarity.ms" },
  { platform: "clarity", hostSuffix: "www.clarity.ms" },

  // ── LinkedIn ──────────────────────────────────────────────────────────────
  { platform: "linkedin", hostSuffix: "px.ads.linkedin.com" },
  { platform: "linkedin", hostSuffix: "linkedin.com", pathPrefixes: ["/px"] },
  { platform: "linkedin", hostSuffix: "snap.licdn.com" },

  // ── Pinterest ─────────────────────────────────────────────────────────────
  { platform: "pinterest", hostSuffix: "ct.pinterest.com" },
  { platform: "pinterest", hostSuffix: "pinterest.com", pathPrefixes: ["/ct.html"] },
  { platform: "pinterest", hostSuffix: "log.pinterest.com" },
  { platform: "pinterest", hostSuffix: "s.pinimg.com", pathPrefixes: ["/ct/"] },

  // ── Reddit ────────────────────────────────────────────────────────────────
  { platform: "reddit", hostSuffix: "ads.reddit.com" },
  { platform: "reddit", hostSuffix: "alb.reddit.com" },
  { platform: "reddit", hostSuffix: "redditmedia.com", pathPrefixes: ["/pixel"] },
  { platform: "reddit", hostSuffix: "pixel-config.reddit.com" },
  { platform: "reddit", hostSuffix: "www.redditstatic.com", pathPrefixes: ["/ads/"] },

  // ── Twitter/X ─────────────────────────────────────────────────────────────
  { platform: "twitter", hostSuffix: "static.ads-twitter.com" },
  { platform: "twitter", hostSuffix: "analytics.twitter.com" },
  { platform: "twitter", hostSuffix: "t.co", pathPrefixes: ["/i/adsct"] },

  // ── Snapchat ──────────────────────────────────────────────────────────────
  { platform: "snapchat", hostSuffix: "tr.snapchat.com" },
  { platform: "snapchat", hostSuffix: "tr6.snapchat.com" },
  { platform: "snapchat", hostSuffix: "sc-static.net", pathPrefixes: ["/scevent"] },
  { platform: "snapchat", hostSuffix: "gcp.api.snapchat.com" },

  // ── Amplitude ─────────────────────────────────────────────────────────────
  { platform: "amplitude", hostSuffix: "api.amplitude.com" },
  { platform: "amplitude", hostSuffix: "api2.amplitude.com" },
  { platform: "amplitude", hostSuffix: "api.eu.amplitude.com" },
  { platform: "amplitude", hostSuffix: "analytics.amplitude.com" },
  { platform: "amplitude", hostSuffix: "cdn.amplitude.com" },

  // ── Mixpanel ──────────────────────────────────────────────────────────────
  { platform: "mixpanel", hostSuffix: "api.mixpanel.com" },
  { platform: "mixpanel", hostSuffix: "api-eu.mixpanel.com" },
  { platform: "mixpanel", hostSuffix: "api-in.mixpanel.com" },
  { platform: "mixpanel", hostSuffix: "decide.mixpanel.com" },
  { platform: "mixpanel", hostSuffix: "api-js.mixpanel.com" },
  { platform: "mixpanel", hostSuffix: "cdn.mxpnl.com" },
  { platform: "mixpanel", hostSuffix: "mxpnl.com" },

  // ── Matomo ────────────────────────────────────────────────────────────────
  { platform: "matomo", hostSuffix: "matomo.org" },
  { platform: "matomo", hostSuffix: "matomo.cloud" },

  // ── Adobe ─────────────────────────────────────────────────────────────────
  { platform: "adobe", hostSuffix: ".2o7.net" },
  { platform: "adobe", hostSuffix: ".sc.omtrdc.net" },
  { platform: "adobe", hostSuffix: "omniture.com" },
  { platform: "adobe", hostSuffix: ".tt.omtrdc.net" },
  { platform: "adobe", hostSuffix: "demdex.net" },
  { platform: "adobe", hostSuffix: "dpm.demdex.net" },
  { platform: "adobe", hostSuffix: "dcs.demdex.net" },
  { platform: "adobe", hostSuffix: "fast.demdex.net" },
  { platform: "adobe", hostSuffix: "edge.adobedc.net" },
  { platform: "adobe", hostSuffix: "server.adobedc.net" },
  { platform: "adobe", hostSuffix: ".adobedc.net" },
  { platform: "adobe", hostSuffix: "assets.adobedtm.com" },
  { platform: "adobe", hostSuffix: "launch.adobe.com" },
  { platform: "adobe", hostSuffix: "everesttech.net" },
  { platform: "adobe", hostSuffix: "pixel.everesttech.net" },

  // ── Segment ───────────────────────────────────────────────────────────────
  { platform: "segment", hostSuffix: "api.segment.io" },
  { platform: "segment", hostSuffix: "api.segment.com" },
  { platform: "segment", hostSuffix: "cdn.segment.io" },
  { platform: "segment", hostSuffix: "cdn.segment.com" },
  { platform: "segment", hostSuffix: "events.segment.io" },
  { platform: "segment", hostSuffix: "events.segment.com" },
  { platform: "segment", hostSuffix: "collect.tealiumiq.com" },
  { platform: "segment", hostSuffix: "tags.tiqcdn.com" },

  // ── Heap ──────────────────────────────────────────────────────────────────
  { platform: "heap", hostSuffix: "heapanalytics.com" },
  { platform: "heap", hostSuffix: "cdn.heapanalytics.com" },
  { platform: "heap", hostSuffix: "track.heap.io" },
  { platform: "heap", hostSuffix: "api.heap.io" },
  { platform: "heap", hostSuffix: "c.us.heap-api.com" },
  { platform: "heap", hostSuffix: "c.eu.heap-api.com" },

  // ── Criteo ────────────────────────────────────────────────────────────────
  { platform: "criteo", hostSuffix: "static.criteo.net" },
  { platform: "criteo", hostSuffix: "dis.criteo.com" },
  { platform: "criteo", hostSuffix: "sslwidget.criteo.com" },
  { platform: "criteo", hostSuffix: "bidder.criteo.com" },
  { platform: "criteo", hostSuffix: "gum.criteo.com" },
  { platform: "criteo", hostSuffix: "rtax.criteo.com" },
  { platform: "criteo", hostSuffix: "cat.criteo.com" },
  { platform: "criteo", hostSuffix: "dynamic.criteo.com" },

  // ── Bing ──────────────────────────────────────────────────────────────────
  { platform: "bing", hostSuffix: "bat.bing.com" },
  { platform: "bing", hostSuffix: "bat.r.msn.com" },
  { platform: "bing", hostSuffix: "c.bing.com" },
  { platform: "bing", hostSuffix: "bat.bing.net" },

  // ── Hotjar ────────────────────────────────────────────────────────────────
  { platform: "hotjar", hostSuffix: "static.hotjar.com" },
  { platform: "hotjar", hostSuffix: "script.hotjar.com" },
  { platform: "hotjar", hostSuffix: "vars.hotjar.com" },
  { platform: "hotjar", hostSuffix: "insights.hotjar.com" },
  { platform: "hotjar", hostSuffix: "in.hotjar.com" },
  { platform: "hotjar", hostSuffix: "ws.hotjar.com" },

  // ── HubSpot ───────────────────────────────────────────────────────────────
  { platform: "hubspot", hostSuffix: "js.hs-scripts.com" },
  { platform: "hubspot", hostSuffix: "js.hsforms.net" },
  { platform: "hubspot", hostSuffix: "track.hubspot.com" },
  { platform: "hubspot", hostSuffix: "forms.hubspot.com" },
  { platform: "hubspot", hostSuffix: "js.hs-analytics.net" },
  { platform: "hubspot", hostSuffix: "js.hsadspixel.net" },
];

// Path-only rules for self-hosted trackers that can live on any domain.
// The path is distinctive enough (/matomo.php is the Matomo endpoint by
// convention) that a match on an arbitrary site is still a real signal.
const PATH_ONLY_RULES: ReadonlyArray<BeaconRule> = [
  { platform: "matomo", pathPrefixes: ["/matomo.php", "/piwik.php"] },
];

/** eTLD+1 of a rule suffix → rules reachable under that domain. */
const RULES_BY_APEX = new Map<string, BeaconRule[]>();
for (const rule of BEACON_RULES) {
  if (rule.hostSuffix === undefined) continue; // path-only rules live elsewhere
  const apex = apexDomain(rule.hostSuffix);
  const bucket = RULES_BY_APEX.get(apex);
  if (bucket) bucket.push(rule);
  else RULES_BY_APEX.set(apex, [rule]);
}

function matchesRule(url: URL, rule: BeaconRule): boolean {
  const host = url.hostname.toLowerCase();
  const suffix = rule.hostSuffix;
  if (suffix !== undefined) {
    if (host !== suffix && !host.endsWith(`.${suffix}`)) return false;
  }
  if (!rule.pathPrefixes) return suffix !== undefined;
  return rule.pathPrefixes.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(prefix)
  );
}

function findBeaconRule(rawUrl: string): BeaconRule | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = hostOf(rawUrl);
  const candidates = RULES_BY_APEX.get(apexDomain(host));
  if (candidates) {
    for (const rule of candidates) {
      if (matchesRule(url, rule)) return rule;
    }
  }
  for (const rule of PATH_ONLY_RULES) {
    if (matchesRule(url, rule)) return rule;
  }
  return null;
}

/** True when the URL targets a marketing/tracking endpoint we decode. */
export function looksTracked(rawUrl: string): boolean {
  return findBeaconRule(rawUrl) !== null;
}

/** Which of our platforms a tracking URL belongs to (null when none). Used by
 * the background observation plane to attribute requests without parsing. */
export function classifyBeacon(rawUrl: string): Platform | null {
  return findBeaconRule(rawUrl)?.platform ?? null;
}
