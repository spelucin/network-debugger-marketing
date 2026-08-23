import { describe, expect, it } from "vitest";
import { SnapchatParser } from "./parser";
import { rawRequest } from "../../test/fixtures";

describe("SnapchatParser.canParse", () => {
  it("accepts the snap pixel endpoints", () => {
    const r = rawRequest("https://tr.snapchat.com/config?pid=x");
    expect(SnapchatParser.canParse(r)).toBe(true);
    expect(SnapchatParser.canParse(rawRequest("https://tr6.snapchat.com/ping"))).toBe(true);
  });

  it("rejects unrelated hosts", () => {
    expect(SnapchatParser.canParse(rawRequest("https://sc-static.net/scevent"))).toBe(false);
    expect(SnapchatParser.canParse(rawRequest("https://example.com/config"))).toBe(false);
  });
});

describe("SnapchatParser.parse", () => {
  it("decodes a purchase event posted as JSON", () => {
    const body = {
      event_type: "PURCHASE",
      price: 20,
      currency: "USD",
      transaction_id: "T-1",
      ctx: { url: "https://site.com/checkout", ua: "Mozilla/5.0" },
      req: [{ i: { pids: ["snap-pixel-1"] } }],
    };
    const r = rawRequest("https://tr.snapchat.com/hit", {
      method: "POST",
      body,
      bodyText: JSON.stringify(body),
    });
    const d = SnapchatParser.parse(r);

    expect(d.platform).toBe("snapchat");
    expect(d.eventName).toBe("PURCHASE");
    expect(d.meta.pixelId).toBe("snap-pixel-1");
    expect(
      d.standardParameters.some((p) => p.key === "transaction_id" && p.value === "T-1")
    ).toBe(true);
    expect(d.contextParameters.some((p) => p.key === "context.url")).toBe(true);
  });

  it("reads the event name and pixel from the query string", () => {
    const qs = "ev=PAGE_VIEW&pid=qp-1";
    const r = rawRequest(`https://tr.snapchat.com/hit?${qs}`);
    const d = SnapchatParser.parse(r);

    expect(d.eventName).toBe("PAGE_VIEW");
    expect(d.meta.pixelId).toBe("qp-1");
  });

  it("defaults to PAGE_VIEW for empty payloads", () => {
    const r = rawRequest("https://tr.snapchat.com/hit");
    expect(SnapchatParser.parse(r).eventName).toBe("PAGE_VIEW");
  });
});
