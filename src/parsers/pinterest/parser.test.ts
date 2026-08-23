import { describe, expect, it } from "vitest";
import { PinterestParser } from "./parser";
import { queryParams, rawRequest } from "../../test/fixtures";

describe("PinterestParser.canParse", () => {
  it("accepts the tag endpoints", () => {
    const r = rawRequest(
      "https://ct.pinterest.com/ct.html",
      { queryParams: queryParams("tid=123") }
    );
    expect(PinterestParser.canParse(r)).toBe(true);
    expect(
      PinterestParser.canParse(rawRequest("https://s.pinimg.com/ct/core/123"))
    ).toBe(true);
  });

  it("rejects unrelated hosts", () => {
    expect(PinterestParser.canParse(rawRequest("https://pinterest.com/pin/1"))).toBe(false);
    expect(PinterestParser.canParse(rawRequest("https://example.com/ct.html"))).toBe(false);
  });
});

describe("PinterestParser.parse", () => {
  it("decodes an ecommerce event with bracket-notation data", () => {
    const qs =
      "tid=261234&event=checkout" +
      "&ed%5Bvalue%5D=25.00&ed%5Bcurrency%5D=USD" +
      "&ed%5Bline_items%5D%5B0%5D%5Bproduct_name%5D=Shoe" +
      "&ed%5Bline_items%5D%5B0%5D%5Bproduct_id%5D=SKU1" +
      "&pd%5Bem%5D=hashed-email";
    const r = rawRequest(`https://ct.pinterest.com/?${qs}`, {
      queryParams: queryParams(qs),
    });
    const d = PinterestParser.parse(r);

    expect(d.platform).toBe("pinterest");
    expect(d.eventName).toBe("checkout");
    expect(d.meta.pixelId).toBe("261234");
    expect(d.standardParameters.some((p) => p.key === "event")).toBe(true);
    expect(d.customParameters.some((p) => p.key === "ed[value]")).toBe(true);
    expect(d.contextParameters.some((p) => p.key === "pd[em]")).toBe(true);
    expect(d.ecommerce?.value).toBe(25);
    expect(d.ecommerce?.items[0]).toMatchObject({ item_name: "Shoe", item_id: "SKU1" });
  });

  it("decodes a plain page view without event data", () => {
    const qs = "tid=261234";
    const r = rawRequest(`https://ct.pinterest.com/?${qs}`, {
      queryParams: queryParams(qs),
    });
    const d = PinterestParser.parse(r);

    expect(d.eventName).toBe("");
    expect(d.meta.pixelId).toBe("261234");
    expect(d.ecommerce).toBeUndefined();
  });
});
