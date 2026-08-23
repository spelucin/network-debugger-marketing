import { describe, expect, it } from "vitest";
import { BingParser } from "./parser";
import { queryParams, rawRequest } from "../../test/fixtures";

describe("BingParser.canParse", () => {
  it("accepts UET beacon hosts", () => {
    const r = rawRequest(
      "https://bat.bing.com/action/0?ti=123&evt=purchase",
      { queryParams: queryParams("ti=123&evt=purchase") }
    );
    expect(BingParser.canParse(r)).toBe(true);
  });

  it("rejects unrelated hosts", () => {
    const r = rawRequest("https://example.com/action/0?ti=123");
    expect(BingParser.canParse(r)).toBe(false);
  });
});

describe("BingParser.parse", () => {
  it("decodes a conversion event with tag id and ecommerce fields", () => {
    const qs = "ti=TAG123&evt=purchase&gv=49.99&gc=USD&ecomm_pagetype=purchase&ecomm_prodid=SKU1";
    const r = rawRequest(`https://bat.bing.com/action/0?${qs}`, {
      queryParams: queryParams(qs),
    });
    const d = BingParser.parse(r);

    expect(d.platform).toBe("bing");
    expect(d.eventName).toBe("purchase");
    expect(d.meta.conversionId).toBe("TAG123");
    expect(
      d.standardParameters.some((p) => p.key === "gv" && p.value === "49.99")
    ).toBe(true);
    // UET merges context and ecommerce params into one display list.
    expect(d.contextParameters.some((p) => p.key === "ti")).toBe(true);
    expect(d.contextParameters.some((p) => p.key === "ecomm_pagetype")).toBe(true);
  });

  it("defaults the event name to pageview and tolerates a missing tag id", () => {
    const qs = "p=https%3A%2F%2Fsite.com%2F";
    const r = rawRequest(`https://bat.bing.com/action/0?${qs}`, {
      queryParams: queryParams(qs),
    });
    const d = BingParser.parse(r);

    expect(d.eventName).toBe("pageview");
    expect(d.meta.conversionId).toBeUndefined();
    expect(d.contextParameters.some((p) => p.key === "p")).toBe(true);
  });
});
