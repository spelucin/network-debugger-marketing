import { describe, expect, it } from "vitest";
import { MixpanelParser } from "./parser";
import { queryParams, rawRequest } from "../../test/fixtures";

const payload = [
  {
    event: "Page View",
    properties: {
      token: "tok123",
      distinct_id: "u-1",
      $current_url: "https://site.com/",
    },
  },
];

describe("MixpanelParser.canParse", () => {
  it("accepts mixpanel collector hosts", () => {
    const r = rawRequest("https://api.mixpanel.com/track/?data=x");
    expect(MixpanelParser.canParse(r)).toBe(true);
    expect(
      MixpanelParser.canParse(rawRequest("https://api-eu.mixpanel.com/track"))
    ).toBe(true);
  });

  it("rejects the SDK CDN and unrelated hosts", () => {
    expect(MixpanelParser.canParse(rawRequest("https://cdn.mxpnl.com/libs/x.js"))).toBe(false);
    expect(MixpanelParser.canParse(rawRequest("https://example.com/track"))).toBe(false);
  });
});

describe("MixpanelParser.parse", () => {
  it("decodes base64 data payloads from the URL", () => {
    const data = btoa(JSON.stringify(payload));
    const qs = `data=${encodeURIComponent(data)}`;
    const r = rawRequest(`https://api.mixpanel.com/track/?${qs}`, {
      queryParams: queryParams(qs),
    });
    const d = MixpanelParser.parse(r);

    expect(d.platform).toBe("mixpanel");
    expect(d.eventName).toBe("Page View");
    expect(
      d.contextParameters.some((p) => p.key === "token" && p.value === "tok123")
    ).toBe(true);
    expect(d.contextParameters.some((p) => p.key === "distinct_id")).toBe(true);
    expect(d.customParameters.some((p) => p.key === "$current_url")).toBe(true);
  });

  it("decodes plain JSON arrays posted directly", () => {
    const r = rawRequest("https://api.mixpanel.com/track/", {
      method: "POST",
      body: payload,
    });
    expect(MixpanelParser.parse(r).eventName).toBe("Page View");
  });

  it("returns an unknown event when nothing can be extracted", () => {
    const r = rawRequest("https://api.mixpanel.com/decide/");
    const d = MixpanelParser.parse(r);
    expect(d.eventName).toBe("unknown");
  });
});
