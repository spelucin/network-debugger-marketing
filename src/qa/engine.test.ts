import { describe, expect, it } from "vitest";
import { runQa, type QaContext } from "./engine";
import type { DecodedEvent, Platform, RawRequest } from "../core/types";
import { rawRequest } from "../test/fixtures";

function decoded(
  platform: Platform,
  eventName: string,
  overrides: Partial<DecodedEvent> = {}
): DecodedEvent {
  return {
    platform,
    eventName,
    standardParameters: [],
    customParameters: [],
    contextParameters: [],
    meta: {},
    ...overrides,
  };
}

function ga4(eventName: string, overrides: Partial<DecodedEvent> = {}) {
  return decoded("ga4", eventName, {
    meta: { measurementId: "G-ABC123" },
    ...overrides,
  });
}

function req(
  url: string,
  overrides: Partial<RawRequest> = {}
): RawRequest {
  return rawRequest(url, { queryParams: {}, ...overrides });
}

function ctx(events: QaContext["events"] = []): QaContext {
  return { events };
}

describe("runQa — suspicious values", () => {
  it("flags an empty event name", () => {
    const d = ga4("  ");
    const { issues } = runQa(d, req("https://x/g/collect?tid=G-ABC123"), ctx());
    expect(issues.some((i) => i.code === "empty-event-name")).toBe(true);
  });

  it("flags a missing GA4 measurement id", () => {
    const d = decoded("ga4", "page_view", { meta: {} });
    const { issues } = runQa(d, req("https://x/g/collect"), ctx());
    expect(issues.some((i) => i.code === "missing-measurement-id")).toBe(true);
  });

  it("flags a malformed measurement id", () => {
    const d = decoded("ga4", "page_view", { meta: { measurementId: "UA-123" } });
    const { issues } = runQa(d, req("https://x/g/collect?tid=UA-123"), ctx());
    expect(issues.some((i) => i.code === "suspicious-id")).toBe(true);
  });

  it("flags a zero purchase value", () => {
    const d = ga4("purchase", {
      ecommerce: { items: [], value: 0, currency: "USD", transaction_id: "T1" },
    });
    const { issues } = runQa(
      d,
      req("https://x/g/collect?tid=G-ABC123&en=purchase&epn.value=0"),
      ctx()
    );
    expect(issues.some((i) => i.code === "suspicious-zero-value")).toBe(true);
  });

  it("flags an invalid currency code", () => {
    const d = ga4("purchase", {
      ecommerce: { items: [], value: 10, currency: "US", transaction_id: "T1" },
    });
    const { issues } = runQa(
      d,
      req("https://x/g/collect?tid=G-ABC123&en=purchase&ep.currency=US"),
      ctx()
    );
    expect(issues.some((i) => i.code === "suspicious-currency")).toBe(true);
  });
});

describe("runQa — missing parameters", () => {
  it("flags missing currency on a GA4 purchase", () => {
    const d = ga4("purchase", {
      standardParameters: [
        {
          key: "ep.transaction_id",
          label: "Transaction ID",
          value: "T1",
          category: "standard",
        },
        { key: "epn.value", label: "Value", value: 10, category: "standard" },
      ],
      ecommerce: {
        items: [{ item_id: "a" }],
        value: 10,
        transaction_id: "T1",
      },
    });
    const { issues } = runQa(
      d,
      req("https://x/g/collect?tid=G-ABC123&en=purchase"),
      ctx()
    );
    const missing = issues.filter((i) => i.code === "missing-parameter");
    expect(missing.some((i) => i.message.includes("currency"))).toBe(true);
  });

  it("flags missing items on add_to_cart", () => {
    const d = ga4("add_to_cart", {
      standardParameters: [
        { key: "ep.currency", label: "Currency", value: "USD", category: "standard" },
      ],
      ecommerce: { items: [], currency: "USD" },
    });
    const { issues } = runQa(
      d,
      req("https://x/g/collect?tid=G-ABC123&en=add_to_cart"),
      ctx()
    );
    expect(
      issues.some(
        (i) => i.code === "missing-parameter" && i.message.includes("items")
      )
    ).toBe(true);
  });
});

describe("runQa — duplicates", () => {
  it("flags a possible duplicate within the window (same transaction)", () => {
    const d = ga4("purchase", {
      ecommerce: {
        items: [{ item_id: "a" }],
        value: 10,
        currency: "USD",
        transaction_id: "TX-1",
      },
    });
    const context = ctx();
    const first = runQa(
      d,
      req("https://x/g/collect?tid=G-ABC123&en=purchase", { timestamp: 1_000_000 }),
      context
    );
    context.events.push(first.entry);

    const second = runQa(
      d,
      req("https://x/g/collect?tid=G-ABC123&en=purchase", { timestamp: 1_003_000 }),
      context
    );
    expect(
      second.issues.some((i) => i.code === "possible-duplicate")
    ).toBe(true);
  });

  it("flags an identical request sent twice within 1.5s", () => {
    const d = ga4("page_view", {
      standardParameters: [
        { key: "ep.page_location", label: "Page", value: "/", category: "standard" },
      ],
      meta: { measurementId: "G-ABC123", documentLocation: "/" },
    });
    const url = "https://x/g/collect?tid=G-ABC123&en=page_view";
    const context = ctx();
    const first = runQa(d, req(url, { timestamp: 1_000_000 }), context);
    context.events.push(first.entry);

    const second = runQa(d, req(url, { timestamp: 1_000_700 }), context);
    expect(
      second.issues.some(
        (i) => i.code === "possible-duplicate" &&
          i.message.includes("identical request")
      )
    ).toBe(true);
  });

  it("does not flag distinct events on the same URL", () => {
    const url = "https://x/g/collect?tid=G-ABC123&en=page_view";
    const context = ctx();
    const first = runQa(
      ga4("page_view", { meta: { measurementId: "G-ABC123" } }),
      req(url, { timestamp: 1_000_000 }),
      context
    );
    context.events.push(first.entry);

    const second = runQa(
      ga4("scroll", { meta: { measurementId: "G-ABC123" } }),
      req(url, { timestamp: 1_000_900 }),
      context
    );
    expect(
      second.issues.some((i) => i.code === "possible-duplicate")
    ).toBe(false);
  });
});

describe("runQa — inconsistent payload", () => {
  it("flags conflicting values for the same transaction", () => {
    const mk = (value: number, timestamp: number, url: string) =>
      runQa(
        ga4("purchase", {
          ecommerce: {
            items: [{ item_id: "a" }],
            value,
            currency: "USD",
            transaction_id: "TX-1",
          },
        }),
        req(url, { timestamp }),
        context
      );

    const context = ctx();
    const first = mk(100, 1_000_000, "https://x/g/collect?tid=G-ABC123&en=purchase");
    context.events.push(first.entry);

    const second = mk(50, 1_100_000, "https://x/g/collect?tid=G-ABC123&en=purchase&x=2");
    expect(
      second.issues.some((i) => i.code === "inconsistent-payload")
    ).toBe(true);
  });
});

describe("runQa — informational notices", () => {
  it("notes GA4 debug mode", () => {
    const d = ga4("page_view");
    const { issues } = runQa(
      d,
      req("https://x/g/collect?tid=G-ABC123&en=page_view&_dbg=1", {
        queryParams: { tid: "G-ABC123", en: "page_view", _dbg: "1" },
      }),
      ctx()
    );
    const debug = issues.find((i) => i.code === "debug-mode");
    expect(debug?.severity).toBe("info");
    expect(debug?.message).toMatch(/debug mode/i);
  });

  it("notes Meta debug mode", () => {
    const d = decoded("meta", "PageView", { meta: { pixelId: "123" } });
    const { issues } = runQa(
      d,
      req("https://x/tr/?id=123&ev=PageView&dbg=1", {
        queryParams: { id: "123", ev: "PageView", dbg: "1" },
      }),
      ctx()
    );
    expect(issues.some((i) => i.code === "debug-mode")).toBe(true);
  });
});