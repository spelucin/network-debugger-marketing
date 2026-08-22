import { describe, expect, it } from "vitest";
import { Ga4Parser } from "./parser";
import { queryParams, rawRequest } from "../../test/fixtures";

const G = (path: string, qs: string) =>
  rawRequest(`https://www.google-analytics.com${path}?${qs}`, {
    queryParams: queryParams(qs),
  });

describe("Ga4Parser.canParse", () => {
  it("accepts /g/collect with a valid G- id", () => {
    const r = G("/g/collect", "v=2&tid=G-ABC123&en=page_view");
    expect(Ga4Parser.canParse(r)).toBe(true);
  });

  it("accepts /mp/collect (Measurement Protocol)", () => {
    const r = G("/mp/collect", "tid=G-ABC123&en=page_view");
    expect(Ga4Parser.canParse(r)).toBe(true);
  });

  it("rejects non-GA4 hosts", () => {
    const r = rawRequest("https://example.com/g/collect?tid=G-ABC123&en=page_view", {
      queryParams: queryParams("tid=G-ABC123&en=page_view"),
    });
    expect(Ga4Parser.canParse(r)).toBe(false);
  });

  it("rejects GA4 host without a measurement id", () => {
    const r = G("/g/collect", "v=2&en=page_view");
    expect(Ga4Parser.canParse(r)).toBe(false);
  });
});

describe("Ga4Parser.parse", () => {
  it("decodes a page_view event and its standard params", () => {
    const r = G(
      "/g/collect",
      "v=2&tid=G-ABC123&cid=123.456&en=page_view&ep.source=home&epn.sessions=1"
    );
    const d = Ga4Parser.parse(r);

    expect(d.platform).toBe("ga4");
    expect(d.eventName).toBe("page_view");
    expect(d.meta.measurementId).toBe("G-ABC123");
    expect(d.meta.clientId).toBe("123.456");
    expect(d.meta.protocol).toBe("GA4 collect");
    expect(d.meta.version).toBe("2");

    // "source" is an auto-collected GA4 dimension, so it is routed to context.
    const source = d.contextParameters.find((p) => p.key === "ep.source");
    expect(source?.value).toBe("home");

    const sessions = d.standardParameters.find((p) => p.key === "epn.sessions");
    expect(sessions?.value).toBe(1);
    expect(sessions?.type).toBe("number");
  });

  it("decodes a custom event with context params", () => {
    const r = G(
      "/g/collect",
      "v=2&tid=G-ABC123&en=custom_event&ep.foo=bar&up.scroll=deep"
    );
    const d = Ga4Parser.parse(r);

    expect(d.eventName).toBe("custom_event");
    expect(d.standardParameters.some((p) => p.key === "ep.foo")).toBe(true);
    expect(d.contextParameters.some((p) => p.key === "up.scroll")).toBe(true);
  });

  it("decodes purchase with compressed pr# items", () => {
    const r = G(
      "/g/collect",
      "v=2&tid=G-ABC123&en=purchase&ep.transaction_id=TX1&epn.value=49.99&ep.currency=USD&pr1id=sku1&pr1nm=Shirt&pr1pr=24.99&pr1qt=2"
    );
    const d = Ga4Parser.parse(r);

    expect(d.eventName).toBe("purchase");
    expect(d.ecommerce).toBeDefined();
    expect(d.ecommerce!.transaction_id).toBe("TX1");
    expect(d.ecommerce!.value).toBe(49.99);
    expect(d.ecommerce!.currency).toBe("USD");
    expect(d.ecommerce!.items).toHaveLength(1);
    const item = d.ecommerce!.items[0]!;
    expect(item.item_id).toBe("sku1");
    expect(item.item_name).toBe("Shirt");
    expect(item.item_price).toBe(24.99);
    expect(item.item_quantity).toBe(2);
  });

  it("decodes add_to_cart with JSON ep.items", () => {
    const itemsJson = JSON.stringify([
      { item_id: "a1", item_name: "Alpha", price: 9.99, quantity: 2 },
    ]);
    const r = G(
      "/g/collect",
      `v=2&tid=G-ABC123&en=add_to_cart&ep.items=${encodeURIComponent(itemsJson)}`
    );
    const d = Ga4Parser.parse(r);

    expect(d.eventName).toBe("add_to_cart");
    expect(d.ecommerce!.items).toHaveLength(1);
    expect(d.ecommerce!.items[0]!.item_id).toBe("a1");
    expect(d.ecommerce!.items[0]!.item_price).toBe(9.99);
    expect(d.ecommerce!.items[0]!.item_quantity).toBe(2);
  });

  it("keeps item params out of the standard list", () => {
    const r = G(
      "/g/collect",
      "v=2&tid=G-ABC123&en=purchase&pr1id=sku1&pr1nm=Shirt"
    );
    const d = Ga4Parser.parse(r);
    expect(d.standardParameters.some((p) => p.key.startsWith("pr1"))).toBe(false);
    expect(d.ecommerce!.items[0]!.item_id).toBe("sku1");
  });

  it("falls back to a generic event name when missing", () => {
    const r = G("/g/collect", "v=2&tid=G-ABC123");
    expect(Ga4Parser.parse(r).eventName).toBe("unknown");
  });
});