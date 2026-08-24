import { describe, expect, it } from "vitest";
import { MetaParser } from "./parser";
import { queryParams, rawRequest } from "../../test/fixtures";

describe("MetaParser.canParse", () => {
  it("accepts /tr/ pixel requests", () => {
    const r = rawRequest(
      "https://www.facebook.com/tr/?id=123456789&ev=PageView",
      { queryParams: queryParams("id=123456789&ev=PageView") }
    );
    expect(MetaParser.canParse(r)).toBe(true);
  });

  it("accepts the bare /tr path most real pixels fire", () => {
    const r = rawRequest(
      "https://www.facebook.com/tr?id=123456789&ev=PageView",
      { queryParams: queryParams("id=123456789&ev=PageView") }
    );
    expect(MetaParser.canParse(r)).toBe(true);
  });

  it("accepts bare /tr even with no query params at all", () => {
    expect(MetaParser.canParse(rawRequest("https://www.facebook.com/tr"))).toBe(true);
    expect(MetaParser.canParse(rawRequest("https://web.facebook.com/tr/"))).toBe(true);
  });

  it("accepts graph.facebook.com CAPI events", () => {
    const r = rawRequest("https://graph.facebook.com/v18.0/123456789/events", {
      method: "POST",
      body: { data: [] },
    });
    expect(MetaParser.canParse(r)).toBe(true);
  });

  it("rejects non-facebook hosts", () => {
    const r = rawRequest("https://example.com/tr/?id=123&ev=PageView", {
      queryParams: queryParams("id=123&ev=PageView"),
    });
    expect(MetaParser.canParse(r)).toBe(false);
  });

  it("rejects deeper facebook paths", () => {
    expect(
      MetaParser.canParse(rawRequest("https://www.facebook.com/tr/x?id=1"))
    ).toBe(false);
  });
});

describe("MetaParser.parse — client-side /tr/", () => {
  it("decodes a PageView event", () => {
    const r = rawRequest(
      "https://www.facebook.com/tr/?id=123456789&ev=PageView&dl=https%3A%2F%2Fsite.com%2F&v=2.9.145&eid=evt_123",
      {
        queryParams: queryParams(
          "id=123456789&ev=PageView&dl=https%3A%2F%2Fsite.com%2F&v=2.9.145&eid=evt_123"
        ),
      }
    );
    const d = MetaParser.parse(r);

    expect(d.platform).toBe("meta");
    expect(d.eventName).toBe("PageView");
    expect(d.meta.pixelId).toBe("123456789");
    expect(d.meta.documentLocation).toBe("https://site.com/");
    expect(d.meta.eventId).toBe("evt_123");
  });

  it("decodes a Purchase with cd[contents] and ecommerce summary", () => {
    const contents = encodeURIComponent(
      JSON.stringify([
        { id: "sku-1", quantity: 1 },
        { id: "sku-2", quantity: 2 },
      ])
    );
    const qs =
      `id=123456789&ev=Purchase&cd[contents]=${contents}` +
      "&cd[value]=49.97&cd[currency]=USD&cd[order_id]=ORD-9";
    const r = rawRequest(`https://www.facebook.com/tr/?${qs}`, {
      queryParams: queryParams(qs),
    });
    const d = MetaParser.parse(r);

    expect(d.eventName).toBe("Purchase");
    expect(d.ecommerce).toBeDefined();
    expect(d.ecommerce!.items).toHaveLength(2);
    expect(d.ecommerce!.items[0]!.item_id).toBe("sku-1");
    expect(d.ecommerce!.value).toBe(49.97);
    expect(d.ecommerce!.currency).toBe("USD");
    expect(d.ecommerce!.transaction_id).toBe("ORD-9");
  });

  it("handles a string content_ids fallback", () => {
    const qs = "id=123456789&ev=AddToCart&cd[content_ids]=sku-1,sku-2";
    const r = rawRequest(`https://www.facebook.com/tr/?${qs}`, {
      queryParams: queryParams(qs),
    });
    const d = MetaParser.parse(r);

    expect(d.eventName).toBe("AddToCart");
    expect(d.ecommerce!.items[0]!.item_id).toBe("sku-1");
  });

  it("decodes a form-encoded POST body (fbevents default transport)", () => {
    const bodyText =
      "id=123456789&ev=Purchase&cd[value]=89.00&cd[currency]=EUR" +
      "&cd[content_ids]=sku-7&dl=https%3A%2F%2Fshop.com%2Fthanks";
    const r = rawRequest("https://www.facebook.com/tr", {
      method: "POST",
      body: queryParams(bodyText),
      bodyText,
    });
    const d = MetaParser.parse(r);

    expect(d.platform).toBe("meta");
    expect(d.eventName).toBe("Purchase");
    expect(d.meta.pixelId).toBe("123456789");
    expect(d.meta.documentLocation).toBe("https://shop.com/thanks");
    expect(d.ecommerce!.value).toBe(89);
    expect(d.ecommerce!.currency).toBe("EUR");
    expect(d.ecommerce!.items[0]!.item_id).toBe("sku-7");
  });

  it("lets query params win over body params on conflict", () => {
    const bodyText = "id=111&ev=PageView";
    const r = rawRequest("https://www.facebook.com/tr?id=222&ev=PageView", {
      method: "POST",
      body: queryParams(bodyText),
      bodyText,
      queryParams: queryParams("id=222&ev=PageView"),
    });
    expect(MetaParser.parse(r).meta.pixelId).toBe("222");
  });
});

describe("MetaParser.parse — server-side CAPI", () => {
  it("decodes a Purchase event from the JSON body", () => {
    const body = {
      data: [
        {
          event_name: "Purchase",
          event_time: 1700000000,
          action_source: "website",
          event_id: "capi-1",
          custom_data: {
            currency: "EUR",
            value: 120,
            contents: [{ id: "x1", quantity: 1 }],
          },
          user_data: { em: ["a@b.com"], fbc: "fb.1.123" },
        },
      ],
    };
    const r = rawRequest("https://graph.facebook.com/v18.0/123456789/events", {
      method: "POST",
      body,
    });
    const d = MetaParser.parse(r);

    expect(d.eventName).toBe("Purchase");
    expect(d.meta.pixelId).toBe("123456789");
    expect(d.ecommerce!.value).toBe(120);
    expect(d.ecommerce!.currency).toBe("EUR");
    expect(d.ecommerce!.items[0]!.item_id).toBe("x1");
    expect(
      d.contextParameters.some((p) => p.key === "ud[em]")
    ).toBe(true);
  });
});