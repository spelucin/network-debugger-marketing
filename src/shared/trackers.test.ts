import { describe, expect, it } from "vitest";
import { classifyBeacon, looksTracked } from "./trackers";

describe("looksTracked", () => {
  const positive = [
    "https://www.google-analytics.com/g/collect?v=2&tid=G-ABC",
    "https://region1.google-analytics.com/g/collect",
    "https://google-analytics.com/",
    "https://www.googletagmanager.com/gtm.js?id=GTM-X",
    "https://www.facebook.com/tr/?id=1&ev=PageView",
    "https://www.facebook.net/tr?ev=x",
    "https://connect.facebook.net/signals/config/123?v=2",
    "https://analytics.tiktok.com/api/v2/pixel/track",
    "https://analytics.tiktok.com/i18n/pixel/config",
    "https://www.clarity.ms/tag/abc",
    "https://www.googleadservices.com/pagead/conversion/123",
    "https://ads.doubleclick.net/ddm/activity/x",
    "https://adservice.google.com/ddm/activity/x",
  ];

  const negative = [
    "https://example.com/google-analytics.com/fake",
    "https://www.facebook.com/profile?id=1",
    "https://connect.facebook.net/en_US/fbevents.js",
    "https://analytics.tiktok.com/other/path",
    "https://clarity.ms.example.com/decoy",
    "ftp://www.google-analytics.com/g/collect",
    "not a url at all",
    "",
  ];

  it.each(positive)("matches %s", (url) => {
    expect(looksTracked(url)).toBe(true);
  });

  it.each(negative)("rejects %s", (url) => {
    expect(looksTracked(url)).toBe(false);
  });
});

describe("new-platform beacon rules", () => {
  const byPlatform: Array<[string, string[]]> = [
    [
      "linkedin",
      [
        "https://px.ads.linkedin.com/collect/?pid=123",
        "https://snap.licdn.com/li.lms/insight/123",
      ],
    ],
    ["pinterest", ["https://ct.pinterest.com/ct.html", "https://s.pinimg.com/ct/core/123"]],
    ["reddit", ["https://ads.reddit.com/tpm", "https://alb.reddit.com/snoo.gif"]],
    ["twitter", ["https://static.ads-twitter.com/uwt.js", "https://t.co/i/adsct?txn_id=1"]],
    ["snapchat", ["https://tr.snapchat.com/config/xyz", "https://sc-static.net/scevent-e9/v3"]],
    ["amplitude", ["https://api.amplitude.com/2/httpapi", "https://cdn.amplitude.com/libs/analytics-browser-2.0.0-min.js.gz"]],
    ["mixpanel", ["https://api.mixpanel.com/track/?data=abc", "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js"]],
    ["heap", ["https://heapanalytics.com/h/t.gif", "https://cdn.heapanalytics.com/js/heap-123.js"]],
    ["criteo", ["https://static.criteo.net/js/ld/publishertag.js", "https://sslwidget.criteo.com/event?a=123"]],
    ["bing", ["https://bat.bing.com/bat.js", "https://bat.r.msn.com/action-uet/123"]],
    ["hotjar", ["https://script.hotjar.com/modules.xyz.js", "https://insights.hotjar.com/s/123.json"]],
    ["hubspot", ["https://js.hs-scripts.com/123.js", "https://track.hubspot.com/__ptq.gif?k=1"]],
    // Self-hosted Matomo on an arbitrary domain + Matomo Cloud.
    ["matomo", ["https://stats.example.org/matomo.php?idsite=1&rec=1", "https://client.matomo.cloud/matomo.php?idsite=1"]],
  ];

  it.each(byPlatform)("classifies %s endpoints", (platform, urls) => {
    for (const url of urls) {
      expect(classifyBeacon(url)).toBe(platform);
    }
  });

  it("classifies piwik.php paths as matomo", () => {
    expect(classifyBeacon("https://analytics.customer.com/piwik.php?idsite=2")).toBe("matomo");
  });

  it("splits stats.g.doubleclick.net by path between GA4 and Ads", () => {
    expect(classifyBeacon("https://stats.g.doubleclick.net/g/collect?v=2&tid=G-ABC")).toBe("ga4");
    expect(classifyBeacon("https://stats.g.doubleclick.net/r/collect?v=1")).toBe("google_ads");
    expect(classifyBeacon("https://stats.g.doubleclick.net/j/collect?v=1")).toBe("google_ads");
  });

  it("does not treat lookalike paths on unrelated domains as beacons", () => {
    expect(looksTracked("https://example.com/en/matomo-guide")).toBe(false);
    expect(looksTracked("https://example.com/downloads/piwik.php.backup")).toBe(false);
  });
});
