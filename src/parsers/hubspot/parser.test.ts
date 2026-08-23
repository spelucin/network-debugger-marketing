import { describe, expect, it } from "vitest";
import { HubSpotParser } from "./parser";
import { rawRequest } from "../../test/fixtures";

describe("HubSpotParser.canParse", () => {
  it("accepts the tracking pixel endpoints", () => {
    expect(
      HubSpotParser.canParse(
        rawRequest("https://track.hubspot.com/__ptq.gif?a=123&vi=abc")
      )
    ).toBe(true);
  });

  it("rejects hubspot hosts without a tracking pixel path", () => {
    expect(
      HubSpotParser.canParse(rawRequest("https://js.hs-scripts.com/123.js"))
    ).toBe(false);
    expect(
      HubSpotParser.canParse(rawRequest("https://example.com/__ptq.gif"))
    ).toBe(false);
  });
});

describe("HubSpotParser.parse", () => {
  it("decodes a page view ping with account and visitor ids", () => {
    const r = rawRequest(
      "https://track.hubspot.com/__ptq.gif?a=2221552&vi=VIS-1&u=https%3A%2F%2Fsite.com%2F&k=keyword"
    );
    const d = HubSpotParser.parse(r);

    expect(d.platform).toBe("hubspot");
    expect(d.eventName).toBe("PageView");
    expect(d.meta.projectId).toBe("2221552");
    expect(
      d.standardParameters.some((p) => p.key === "a" && p.value === "2221552")
    ).toBe(true);
    expect(d.contextParameters.some((p) => p.key === "vi")).toBe(true);
    expect(d.contextParameters.some((p) => p.key === "k")).toBe(true);
  });

  it("omits absent optional parameters", () => {
    const r = rawRequest("https://track.hubspot.com/__ptq.gif?a=1");
    const d = HubSpotParser.parse(r);
    expect(d.contextParameters.some((p) => p.key === "vi")).toBe(false);
  });
});
