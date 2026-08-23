import { describe, expect, it } from "vitest";
import { TwitterParser } from "./parser";
import { queryParams, rawRequest } from "../../test/fixtures";

describe("TwitterParser.canParse", () => {
  it("accepts the ads endpoints", () => {
    expect(TwitterParser.canParse(rawRequest("https://static.ads-twitter.com/uwt.js"))).toBe(true);
    expect(TwitterParser.canParse(rawRequest("https://t.co/i/adsct?txn_id=1"))).toBe(true);
    expect(TwitterParser.canParse(rawRequest("https://analytics.twitter.com/adsct"))).toBe(true);
  });

  it("rejects unrelated hosts and paths", () => {
    expect(TwitterParser.canParse(rawRequest("https://t.co/privacy"))).toBe(false);
    expect(TwitterParser.canParse(rawRequest("https://example.com/i/adsct"))).toBe(false);
  });
});

describe("TwitterParser.parse", () => {
  it("decodes a conversion with pixel id and sale fields", () => {
    const qs =
      "txn_id=PIXEL1&event=Purchase&tw_sale_amount=49.90&tw_order_quantity=2&tw_document_href=https%3A%2F%2Fsite.com%2F";
    const r = rawRequest(`https://t.co/i/adsct?${qs}`, {
      queryParams: queryParams(qs),
    });
    const d = TwitterParser.parse(r);

    expect(d.platform).toBe("twitter");
    expect(d.eventName).toBe("Purchase");
    expect(d.meta.pixelId).toBe("PIXEL1");
    expect(
      d.standardParameters.some((p) => p.key === "tw_sale_amount" && p.value === "49.90")
    ).toBe(true);
    // Non-standard transport keys land in context.
    expect(d.contextParameters.some((p) => p.key === "tw_document_href")).toBe(true);
  });

  it("decodes contents JSON into ecommerce parameters", () => {
    const contents = JSON.stringify([{ content_id: "SKU9", quantity: 1 }]);
    const qs = `txn_id=PIXEL1&contents=${encodeURIComponent(contents)}`;
    const r = rawRequest(`https://t.co/i/adsct?${qs}`, {
      queryParams: queryParams(qs),
    });
    const d = TwitterParser.parse(r);

    expect(d.customParameters.length).toBe(1);
    expect(d.customParameters[0]!.key).toBe("contents[0]");
  });

  it("defaults the event name to PageView", () => {
    const qs = "txn_id=PIXEL1";
    const r = rawRequest(`https://t.co/i/adsct?${qs}`, {
      queryParams: queryParams(qs),
    });
    expect(TwitterParser.parse(r).eventName).toBe("PageView");
  });
});
