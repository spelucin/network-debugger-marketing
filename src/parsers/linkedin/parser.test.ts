import { describe, expect, it } from "vitest";
import { LinkedInParser } from "./parser";
import { rawRequest } from "../../test/fixtures";

describe("LinkedInParser.canParse", () => {
  it("accepts the insight tag collector", () => {
    expect(
      LinkedInParser.canParse(
        rawRequest("https://px.ads.linkedin.com/collect/?pid=123&conversionId=0")
      )
    ).toBe(true);
  });

  it("accepts linkedin.com/px paths", () => {
    expect(
      LinkedInParser.canParse(rawRequest("https://www.linkedin.com/px/li_track?id=1"))
    ).toBe(true);
  });

  it("rejects unrelated hosts and non-px paths", () => {
    expect(LinkedInParser.canParse(rawRequest("https://www.linkedin.com/feed"))).toBe(false);
    expect(LinkedInParser.canParse(rawRequest("https://example.com/collect"))).toBe(false);
  });
});

describe("LinkedInParser.parse", () => {
  it("decodes a conversion ping with partner id", () => {
    const r = rawRequest(
      "https://px.ads.linkedin.com/collect/?pid=987&conversionId=C-1&li_fat_id=ABC"
    );
    const d = LinkedInParser.parse(r);

    expect(d.platform).toBe("linkedin");
    expect(d.eventName).toBe("Conversion C-1");
    expect(d.meta.pixelId).toBe("987");
    expect(d.standardParameters.some((p) => p.key === "pid")).toBe(true);
    expect(d.standardParameters.some((p) => p.key === "conversionId")).toBe(true);
    expect(d.contextParameters.some((p) => p.key === "li_fat_id")).toBe(true);
  });

  it("falls back to PageView when no conversion id is present", () => {
    const r = rawRequest("https://px.ads.linkedin.com/collect/?pid=987");
    const d = LinkedInParser.parse(r);

    expect(d.eventName).toBe("PageView");
    expect(d.meta.pixelId).toBe("987");
  });
});
