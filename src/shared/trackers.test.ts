import { describe, expect, it } from "vitest";
import { looksTracked } from "./trackers";

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
