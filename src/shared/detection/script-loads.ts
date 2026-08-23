// SDK script identification — recognises a marketing platform by its loader
// script, independent of any tracking beacon.
//
// A page can load `fbevents.js` or `gtag.js` long before (or without) ever
// firing an event. Surfacing those loads lets the panel show what is *present
// on the page*, and the extracted IDs (measurement / pixel / project) give the
// same identifiers the decoded beacons carry.

import type { Platform } from "../../core/types";

export interface SdkScriptHit {
  platform: Platform;
  /** Human-readable loader name for tooltips. */
  label: string;
  /** Identifier pulled out of the URL when extractable (GTM-XXX, G-ABC, …). */
  scriptId?: string;
}

interface SdkScriptRule {
  platform: Platform;
  label: string;
  /** Cheap substring pre-filter before any regex runs. */
  token: string;
  /** First capture group becomes the scriptId. */
  idFrom?: RegExp;
  /**
   * When true the idFrom regex MUST also match for the rule to qualify.
   * Shared loader hosts need this: `googletagmanager.com/gtag/js` serves both
   * GA4 (`G-…`) and Google Ads (`AW-…`) tags on the same URL shape.
   */
  idRequired: boolean;
  /** When true only `script` resource types qualify (beacons excluded). */
  scriptsOnly: boolean;
}

const RULES: ReadonlyArray<SdkScriptRule> = [
  {
    // GTM web container
    platform: "gtm",
    label: "Google Tag Manager",
    token: "googletagmanager.com/gtm.js",
    idFrom: /[?&]id=(GTM-[A-Z0-9]+)/i,
    idRequired: false,
    scriptsOnly: true,
  },
  {
    // GA4 gtag loader
    platform: "ga4",
    label: "GA4 gtag.js",
    token: "googletagmanager.com/gtag/js",
    idFrom: /[?&]id=(G-[A-Z0-9]+)/,
    idRequired: true,
    scriptsOnly: true,
  },
  {
    // Google Ads gtag loader (conversion linker lives on the same host)
    platform: "google_ads",
    label: "Google Ads gtag.js",
    token: "googletagmanager.com/gtag/js",
    idFrom: /[?&]id=(AW-\d+)/,
    idRequired: true,
    scriptsOnly: true,
  },
  {
    // Classic Ads conversion async loader
    platform: "google_ads",
    label: "Google Ads conversion",
    token: "googleadservices.com/pagead/conversion_async.js",
    idFrom: undefined,
    idRequired: false,
    scriptsOnly: true,
  },
  {
    // Meta Pixel SDK — pixel ids ride separate config calls, so treat the
    // loader itself as presence-only and accept an id when one shows up.
    platform: "meta",
    label: "Meta Pixel",
    token: "connect.facebook.net",
    idFrom: /[?&]id=(\d{6,})/,
    idRequired: false,
    scriptsOnly: true,
  },
  {
    // Clarity tag loader carries the project id in its path
    platform: "clarity",
    label: "Microsoft Clarity",
    token: "clarity.ms/tag/",
    idFrom: /clarity\.ms\/tag\/([^/?&#]+)/,
    idRequired: false,
    scriptsOnly: false,
  },
  {
    // TikTok pixel SDK
    platform: "tiktok",
    label: "TikTok Pixel",
    token: "analytics.tiktok.com",
    idFrom: /[?&]sdkid=([^&]+)/i,
    idRequired: false,
    scriptsOnly: true,
  },
  {
    // Amplitude SDK
    platform: "amplitude",
    label: "Amplitude SDK",
    token: "cdn.amplitude.com",
    idFrom: undefined,
    idRequired: false,
    scriptsOnly: true,
  },
  {
    // Mixpanel SDK
    platform: "mixpanel",
    label: "Mixpanel SDK",
    token: "cdn.mxpnl.com",
    idFrom: undefined,
    idRequired: false,
    scriptsOnly: true,
  },
  {
    // LinkedIn Insight Tag
    platform: "linkedin",
    label: "LinkedIn Insight Tag",
    token: "snap.licdn.com",
    idFrom: undefined,
    idRequired: false,
    scriptsOnly: true,
  },
  {
    // Hotjar Script
    platform: "hotjar",
    label: "Hotjar",
    token: "script.hotjar.com",
    idFrom: undefined,
    idRequired: false,
    scriptsOnly: true,
  },
  {
    // HubSpot Tracking Code
    platform: "hubspot",
    label: "HubSpot Tracking",
    token: "js.hs-scripts.com",
    idFrom: undefined,
    idRequired: false,
    scriptsOnly: true,
  },
  {
    // Criteo OneTag
    platform: "criteo",
    label: "Criteo OneTag",
    token: "static.criteo.net",
    idFrom: undefined,
    idRequired: false,
    scriptsOnly: true,
  },
  {
    // Heap Analytics SDK
    platform: "heap",
    label: "Heap Analytics",
    token: "cdn.heapanalytics.com",
    idFrom: undefined,
    idRequired: false,
    scriptsOnly: true,
  },
  {
    // Bing UET Tag
    platform: "bing",
    label: "Bing UET Tag",
    token: "bat.bing.com",
    idFrom: undefined,
    idRequired: false,
    scriptsOnly: true,
  },
  {
    // Twitter/X Pixel
    platform: "twitter",
    label: "Twitter/X Pixel",
    token: "static.ads-twitter.com",
    idFrom: undefined,
    idRequired: false,
    scriptsOnly: true,
  },
  {
    // Pinterest Tag
    platform: "pinterest",
    label: "Pinterest Tag",
    token: "s.pinimg.com",
    idFrom: undefined,
    idRequired: false,
    scriptsOnly: true,
  },
  {
    // Reddit Pixel
    platform: "reddit",
    label: "Reddit Pixel",
    token: "www.redditstatic.com/ads",
    idFrom: undefined,
    idRequired: false,
    scriptsOnly: true,
  },
  {
    // Snapchat Pixel
    platform: "snapchat",
    label: "Snapchat Pixel",
    token: "sc-static.net/scevent",
    idFrom: undefined,
    idRequired: false,
    scriptsOnly: true,
  },
  {
    // Adobe Tags (Launch) loader
    platform: "adobe",
    label: "Adobe Tags (Launch)",
    token: "assets.adobedtm.com",
    idFrom: undefined,
    idRequired: false,
    scriptsOnly: true,
  },
  {
    // Adobe Analytics AppMeasurement
    platform: "adobe",
    label: "Adobe Analytics",
    token: "/AppMeasurement.js",
    idFrom: undefined,
    idRequired: false,
    scriptsOnly: true,
  },
];

/** Recognise a platform SDK load. `resourceType` comes from webRequest
 * details; pass undefined to skip the script-type gate entirely. */
export function identifySdkScript(
  url: string | undefined,
  resourceType?: string
): SdkScriptHit | null {
  if (!url) return null;
  const lowerUrl = url.toLowerCase();
  const scriptOk = resourceType === undefined || resourceType === "script";
  for (const rule of RULES) {
    if (!lowerUrl.includes(rule.token)) continue;
    if (rule.scriptsOnly && !scriptOk) continue;
    let scriptId: string | undefined;
    const m = rule.idFrom ? url.match(rule.idFrom) : null;
    if (m?.[1]) {
      scriptId = m[1];
    } else if (rule.idRequired) {
      continue; // right host, wrong tenant — let later rules try
    }
    return { platform: rule.platform, label: rule.label, ...(scriptId ? { scriptId } : {}) };
  }
  return null;
}
