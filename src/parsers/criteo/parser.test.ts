import { describe, expect, it } from "vitest";
import { CriteoParser } from "./parser";
import { rawRequest } from "../../test/fixtures";

describe("CriteoParser.canParse", () => {
  it("accepts criteo endpoints", () => {
    expect(
      CriteoParser.canParse(rawRequest("https://sslwidget.criteo.com/event?a=123"))
    ).toBe(true);
    expect(
      CriteoParser.canParse(rawRequest("https://static.criteo.net/js/ld/publishertag.js"))
    ).toBe(true);
  });

  it("rejects unrelated hosts", () => {
    expect(CriteoParser.canParse(rawRequest("https://example.com/event"))).toBe(false);
  });
});

describe("CriteoParser.parse", () => {
  it("decodes a OneTag event from URL parameters", () => {
    const r = rawRequest(
      "https://gum.criteo.com/sync?e=purchase&a=PARTNER1&transactionid=T-9&productid=SKU42&siteType=d"
    );
    const d = CriteoParser.parse(r);

    expect(d.platform).toBe("criteo");
    expect(d.eventName).toBe("purchase");
    expect(d.meta.conversionId).toBe("T-9");
    // event → standard; transaction/product ids ride with the standard block.
    expect(d.standardParameters.some((p) => p.key === "e")).toBe(true);
    expect(d.standardParameters.some((p) => p.key === "transactionid")).toBe(true);
    expect(d.contextParameters.some((p) => p.key === "a" && p.value === "PARTNER1")).toBe(true);
    expect(d.contextParameters.some((p) => p.key === "siteType" && p.value === "Desktop")).toBe(true);
  });

  it("merges JSON POST bodies into the parameter pool", () => {
    const r = rawRequest("https://sslwidget.criteo.com/event", {
      method: "POST",
      body: JSON.stringify({ e: "addToCart", productid: ["SKU1"] }),
      bodyText: '{"e":"addToCart","productid":["SKU1"]}',
    });
    const d = CriteoParser.parse(r);

    expect(d.eventName).toBe("addToCart");
    expect(d.standardParameters.some((p) => p.key === "productid")).toBe(true);
  });

  it("names unknown payloads conservatively", () => {
    const r = rawRequest("https://dis.criteo.com/dis/dis.aspx?p=1");
    expect(CriteoParser.parse(r).eventName).toBe("unknown");
  });
});
