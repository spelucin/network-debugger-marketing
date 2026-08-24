import { describe, expect, it } from "vitest";
import { TikTokParser } from "./parser";
import { queryParams, rawRequest } from "../../test/fixtures";

describe("TikTokParser.canParse", () => {
  it("accepts client-side pixel requests", () => {
    const r = rawRequest(
      "https://analytics.tiktok.com/api/v2/pixel/?pixel_code=CODE123&event=PageView",
      { queryParams: queryParams("pixel_code=CODE123&event=PageView") }
    );
    expect(TikTokParser.canParse(r)).toBe(true);
  });

  it("accepts the bare /api/v2/pixel path (POST target, no trailing slash)", () => {
    const r = rawRequest("https://analytics.tiktok.com/api/v2/pixel", {
      method: "POST",
    });
    expect(TikTokParser.canParse(r)).toBe(true);
  });

  it("accepts tiktokw.us infrastructure endpoints", () => {
    const r = rawRequest("https://analytics-ipv6.tiktokw.us/ipv6/enrich_ipv6");
    expect(TikTokParser.canParse(r)).toBe(true);
  });

  it("accepts server-side business-api requests", () => {
    const r = rawRequest("https://business-api.tiktok.com/open_api/v1.3/pixel/track/", {
      method: "POST",
      body: {},
    });
    expect(TikTokParser.canParse(r)).toBe(true);
  });

  it("rejects unrelated hosts", () => {
    const r = rawRequest("https://example.com/api/v2/pixel/?event=PageView", {
      queryParams: queryParams("event=PageView"),
    });
    expect(TikTokParser.canParse(r)).toBe(false);
  });
});

describe("TikTokParser.parse — client-side", () => {
  it("decodes a PageView event", () => {
    const r = rawRequest(
      "https://analytics.tiktok.com/api/v2/pixel/?pixel_code=CODE123&event=PageView&page_url=https%3A%2F%2Fsite.com%2F",
      {
        queryParams: queryParams(
          "pixel_code=CODE123&event=PageView&page_url=https%3A%2F%2Fsite.com%2F"
        ),
      }
    );
    const d = TikTokParser.parse(r);

    expect(d.platform).toBe("tiktok");
    expect(d.eventName).toBe("PageView");
    expect(d.meta.pixelId).toBe("CODE123");
    expect(
      d.contextParameters.some((p) => p.key === "page_url")
    ).toBe(true);
  });

  it("decodes CompletePayment with properties and value", () => {
    const properties = JSON.stringify({
      contents: [{ content_id: "s1", quantity: 2, price: 19.99 }],
      value: 39.98,
      currency: "USD",
    });
    const qs =
      "pixel_code=CODE123&event=CompletePayment&properties=" +
      encodeURIComponent(properties);
    const r = rawRequest(
      `https://analytics.tiktok.com/api/v2/pixel/?${qs}`,
      { queryParams: queryParams(qs) }
    );
    const d = TikTokParser.parse(r);

    expect(d.eventName).toBe("CompletePayment");
    expect(d.ecommerce).toBeDefined();
    expect(d.ecommerce!.items[0]!.item_id).toBe("s1");
    expect(d.ecommerce!.items[0]!.quantity).toBe(2);
    expect(d.ecommerce!.items[0]!.price).toBe(19.99);
    expect(d.ecommerce!.value).toBe(39.98);
    expect(d.ecommerce!.currency).toBe("USD");
  });
});

describe("TikTokParser.parse — server-side", () => {
  it("decodes a Purchase event from the JSON body", () => {
    const body = {
      event: "CompletePayment",
      event_time: 1700000000,
      pixel_code: "CODE123",
      properties: {
        contents: [
          { content_id: "p1", quantity: 1, price: 55 },
        ],
        value: 55,
        currency: "USD",
        order_id: "O-42",
      },
      context: { page: { url: "https://site.com/checkout" } },
    };
    const r = rawRequest("https://business-api.tiktok.com/open_api/v1.3/pixel/track/", {
      method: "POST",
      body,
    });
    const d = TikTokParser.parse(r);

    expect(d.eventName).toBe("CompletePayment");
    expect(d.meta.pixelId).toBe("CODE123");
    expect(d.ecommerce!.value).toBe(55);
    expect(d.ecommerce!.items[0]!.item_id).toBe("p1");
    expect(d.ecommerce!.transaction_id).toBe("O-42");
  });
});
describe("TikTokParser.parse — web pixel data envelope", () => {
  it("unwraps the form-encoded data array and decodes the event", () => {
    const events = JSON.stringify([
      {
        event: "Pageview",
        event_id: "tt-evt-1",
        properties: { page_url: "https://site.com/", screen_height: 900 },
      },
    ]);
    const bodyText = `data=${encodeURIComponent(events)}`;
    const r = rawRequest("https://analytics.tiktok.com/api/v2/pixel", {
      method: "POST",
      body: queryParams(bodyText),
      bodyText,
    });
    const d = TikTokParser.parse(r);

    expect(d.platform).toBe("tiktok");
    expect(d.eventName).toBe("Pageview");
    expect(d.meta.eventId).toBe("tt-evt-1");
    expect(
      d.contextParameters.some((p) => p.key === "page_url")
    ).toBe(true);
  });

  it("decodes ecommerce properties from the envelope", () => {
    const events = JSON.stringify([
      {
        event: "CompletePayment",
        properties: {
          currency: "USD",
          value: 42.5,
          contents: [{ content_id: "p1", quantity: 2 }],
        },
      },
    ]);
    const bodyText = `data=${encodeURIComponent(events)}`;
    const r = rawRequest("https://analytics.tiktok.com/api/v2/pixel", {
      method: "POST",
      body: queryParams(bodyText),
      bodyText,
    });
    const d = TikTokParser.parse(r);

    expect(d.eventName).toBe("CompletePayment");
    expect(d.ecommerce!.value).toBe(42.5);
    expect(d.ecommerce!.items[0]!.item_id).toBe("p1");
  });

  it("names infrastructure pings from the path", () => {
    const r = rawRequest("https://analytics-ipv6.tiktokw.us/ipv6/enrich_ipv6");
    const d = TikTokParser.parse(r);

    expect(d.platform).toBe("tiktok");
    expect(d.eventName).toBe("enrich_ipv6");
  });
});
