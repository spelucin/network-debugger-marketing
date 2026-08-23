import { describe, expect, it } from "vitest";
import { identifySdkScript } from "./script-loads";

describe("identifySdkScript", () => {
  it("flags GTM containers with their id", () => {
    expect(
      identifySdkScript(
        "https://www.googletagmanager.com/gtm.js?id=GTM-ABC123",
        "script"
      )
    ).toMatchObject({ platform: "gtm", scriptId: "GTM-ABC123" });
  });

  it("flags GA4 gtag loaders with the measurement id", () => {
    expect(
      identifySdkScript(
        "https://www.googletagmanager.com/gtag/js?id=G-XYZ789&l=dataLayer",
        "script"
      )
    ).toMatchObject({ platform: "ga4", scriptId: "G-XYZ789" });
  });

  it("routes Ads gtag loaders to google_ads, not ga4 (shared host)", () => {
    expect(
      identifySdkScript(
        "https://www.googletagmanager.com/gtag/js?id=AW-1100011",
        "script"
      )
    ).toMatchObject({ platform: "google_ads", scriptId: "AW-1100011" });
  });

  it("ignores gtag loads whose id belongs to neither rule", () => {
    // e.g. UA-era ids on the shared loader: no rule claims it
    expect(
      identifySdkScript(
        "https://www.googletagmanager.com/gtag/js?id=UA-123-2",
        "script"
      )
    ).toBeNull();
  });

  it("flags the classic conversion_async.js loader", () => {
    expect(
      identifySdkScript(
        "https://www.googleadservices.com/pagead/conversion_async.js",
        "script"
      )
    ).toMatchObject({ platform: "google_ads" });
  });

  it("flags Meta pixel presence even without an id in the query", () => {
    expect(
      identifySdkScript(
        "https://connect.facebook.net/en_US/fbevents.js",
        "script"
      )
    ).toMatchObject({ platform: "meta" });
  });

  it("extracts Meta pixel ids from id-style script urls when present", () => {
    expect(
      identifySdkScript(
        "https://connect.facebook.net/en_US/fbevents.js?id=1234567890123",
        "script"
      )?.scriptId
    ).toBe("1234567890123");
  });

  it("flags Clarity tag loads and pulls the project id from the path", () => {
    expect(
      identifySdkScript("https://www.clarity.ms/tag/abc123xyz", "script")
    ).toMatchObject({
      platform: "clarity",
      scriptId: "abc123xyz",
    });
  });

  it("accepts non-script resources for rules with scriptsOnly false", () => {
    // Clarity's loader token matches on the /tag/ path itself; unlike the
    // SDK hosts we don't gate it to resourceType === "script".
    const hit = identifySdkScript(
      "https://www.clarity.ms/tag/proj1",
      "xmlhttprequest"
    );
    expect(hit?.platform).toBe("clarity");
  });

  it("flags TikTok SDK scripts with the sdkid parameter", () => {
    expect(
      identifySdkScript(
        "https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=TT123&lib=ttq",
        "script"
      )
    ).toMatchObject({ platform: "tiktok", scriptId: "TT123" });
  });

  it("skips non-script resources for scriptsOnly rules", () => {
    expect(
      identifySdkScript(
        "https://connect.facebook.net/en_US/fbevents.js",
        "xmlhttprequest"
      )
    ).toBeNull();
  });

  it("treats an undefined resource type as eligible", () => {
    expect(
      identifySdkScript("https://www.clarity.ms/tag/proj1")
    ).not.toBeNull();
  });

  it("returns null for unrelated urls", () => {
    expect(identifySdkScript("https://example.com/app.js", "script")).toBeNull();
    expect(identifySdkScript(undefined, "script")).toBeNull();
  });
});
