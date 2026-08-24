// Single source of truth for the hosts the extension observes.
//
// The background webRequest listeners filter on WATCH_URLS; the settings
// UI derives its "watched domains" list from the same table, so the two
// can never drift apart again. Keep in sync with manifest.json
// host_permissions (same patterns, duplicated there because the manifest
// cannot reference JS).
export const WATCH_URLS: ReadonlyArray<string> = [
  // ── Google Analytics 4 ─────────────────────────────────────────────────────
  "*://*.google-analytics.com/*",
  "*://*.analytics.google.com/*",
  "*://region1.google-analytics.com/*",
  "*://region2.google-analytics.com/*",
  "*://region1.analytics.google.com/*",
  "*://region2.analytics.google.com/*",

  // ── Google Tag Manager + gtag ──────────────────────────────────────────────
  "*://*.googletagmanager.com/*",

  // ── Google Ads ─────────────────────────────────────────────────────────────
  "*://*.googleadservices.com/*",
  "*://*.doubleclick.net/*",
  "*://adservice.google.com/*",
  "*://*.2mdn.net/*",
  "*://*.securepubads.g.doubleclick.net/*",
  "*://*.pubads.g.doubleclick.net/*",
  "*://*.googleads4.g.doubleclick.net/*",
  "*://*.googletagservices.com/*",
  "*://*.feedads.g.doubleclick.net/*",
  "*://pagead2.googlesyndication.com/*",
  "*://*.adtrafficquality.google/*",
  "*://stats.g.doubleclick.net/*",

  // ── Meta Pixel ─────────────────────────────────────────────────────────────
  "*://*.facebook.com/tr*",
  "*://*.facebook.net/tr*",
  "*://connect.facebook.net/*",
  "*://connect.facebook.com/*",

  // ── TikTok Pixel ───────────────────────────────────────────────────────────
  "*://analytics.tiktok.com/*",
  "*://*.tiktok.com/i18n/pixel/*",
  "*://events.tiktok.com/*",
  "*://analytics-sg.tiktok.com/*",
  "*://an.tiktok.com/*",
  "*://analytics-ipv6.tiktokw.us/*",
  "*://*.tiktokw.us/*",

  // ── Microsoft Clarity ──────────────────────────────────────────────────────
  "*://*.clarity.ms/*",

  // ── LinkedIn ───────────────────────────────────────────────────────────────
  "*://px.ads.linkedin.com/*",
  "*://linkedin.com/px*",
  "*://snap.licdn.com/*",

  // ── Pinterest ──────────────────────────────────────────────────────────────
  "*://ct.pinterest.com/*",
  "*://pinterest.com/ct.html*",
  "*://log.pinterest.com/*",
  "*://s.pinimg.com/ct/*",

  // ── Reddit ─────────────────────────────────────────────────────────────────
  "*://ads.reddit.com/*",
  "*://alb.reddit.com/*",
  "*://redditmedia.com/pixel/*",
  "*://pixel-config.reddit.com/*",
  "*://www.redditstatic.com/ads/*",

  // ── Twitter/X ──────────────────────────────────────────────────────────────
  "*://static.ads-twitter.com/*",
  "*://analytics.twitter.com/*",
  "*://t.co/i/adsct*",

  // ── Snapchat ───────────────────────────────────────────────────────────────
  "*://tr.snapchat.com/*",
  "*://tr6.snapchat.com/*",
  "*://sc-static.net/scevent*",
  "*://gcp.api.snapchat.com/*",

  // ── Amplitude ──────────────────────────────────────────────────────────────
  "*://api.amplitude.com/*",
  "*://api2.amplitude.com/*",
  "*://api.eu.amplitude.com/*",
  "*://analytics.amplitude.com/*",
  "*://cdn.amplitude.com/*",

  // ── Mixpanel ───────────────────────────────────────────────────────────────
  "*://api.mixpanel.com/*",
  "*://api-eu.mixpanel.com/*",
  "*://api-in.mixpanel.com/*",
  "*://decide.mixpanel.com/*",
  "*://api-js.mixpanel.com/*",
  "*://cdn.mxpnl.com/*",
  "*://mxpnl.com/*",

  // ── Adobe ──────────────────────────────────────────────────────────────────
  "*://*.2o7.net/*",
  "*://*.sc.omtrdc.net/*",
  "*://omniture.com/*",
  "*://*.tt.omtrdc.net/*",
  "*://demdex.net/*",
  "*://dpm.demdex.net/*",
  "*://dcs.demdex.net/*",
  "*://fast.demdex.net/*",
  "*://edge.adobedc.net/*",
  "*://server.adobedc.net/*",
  "*://*.adobedc.net/*",
  "*://assets.adobedtm.com/*",
  "*://launch.adobe.com/*",
  "*://everesttech.net/*",
  "*://pixel.everesttech.net/*",

  // ── Segment ────────────────────────────────────────────────────────────────
  "*://api.segment.io/*",
  "*://api.segment.com/*",
  "*://cdn.segment.io/*",
  "*://cdn.segment.com/*",
  "*://events.segment.io/*",
  "*://events.segment.com/*",
  "*://collect.tealiumiq.com/*",
  "*://tags.tiqcdn.com/*",

  // ── Heap ───────────────────────────────────────────────────────────────────
  "*://*.heapanalytics.com/*",
  "*://cdn.heapanalytics.com/*",
  "*://track.heap.io/*",
  "*://api.heap.io/*",
  "*://c.us.heap-api.com/*",
  "*://c.eu.heap-api.com/*",

  // ── Criteo ─────────────────────────────────────────────────────────────────
  "*://static.criteo.net/*",
  "*://dis.criteo.com/*",
  "*://sslwidget.criteo.com/*",
  "*://bidder.criteo.com/*",
  "*://gum.criteo.com/*",
  "*://rtax.criteo.com/*",
  "*://cat.criteo.com/*",
  "*://dynamic.criteo.com/*",

  // ── Bing ───────────────────────────────────────────────────────────────────
  "*://bat.bing.com/*",
  "*://bat.r.msn.com/*",
  "*://c.bing.com/*",
  "*://bat.bing.net/*",

  // ── Hotjar ─────────────────────────────────────────────────────────────────
  "*://static.hotjar.com/*",
  "*://script.hotjar.com/*",
  "*://vars.hotjar.com/*",
  "*://insights.hotjar.com/*",
  "*://in.hotjar.com/*",
  "*://ws.hotjar.com/*",

  // ── HubSpot ────────────────────────────────────────────────────────────────
  "*://js.hs-scripts.com/*",
  "*://js.hsforms.net/*",
  "*://track.hubspot.com/*",
  "*://forms.hubspot.com/*",
  "*://js.hs-analytics.net/*",
  "*://js.hsadspixel.net/*",
];

/** Unique, human-readable host list derived from WATCH_URLS — for display
 * in the settings surfaces. Paths are dropped; wildcard labels collapse
 * to their registrable form. */
export function watchDomains(): string[] {
  const domains = new Set<string>();
  for (const pattern of WATCH_URLS) {
    const host = pattern
      .replace(/^\*:\/\//, "")
      .replace(/\/[^/]*\*?$/, "")
      .replace(/^\*\./, "")
      .trim();
    if (host) domains.add(host);
  }
  return [...domains].sort((a, b) => a.localeCompare(b));
}
