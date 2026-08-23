import { describe, expect, it } from "vitest";
import { HeapParser } from "./parser";
import { rawRequest } from "../../test/fixtures";

describe("HeapParser.canParse", () => {
  it("accepts heap capture hosts", () => {
    expect(HeapParser.canParse(rawRequest("https://track.heap.io/api/track"))).toBe(true);
    expect(HeapParser.canParse(rawRequest("https://cdn.heapanalytics.com/js/heap.js"))).toBe(true);
    expect(HeapParser.canParse(rawRequest("https://c.us.heap-api.com/a"))).toBe(true);
  });

  it("rejects unrelated hosts", () => {
    expect(HeapParser.canParse(rawRequest("https://example.com/api/track"))).toBe(false);
  });
});

describe("HeapParser.parse", () => {
  it("decodes a JSON event with identity and properties", () => {
    const r = rawRequest("https://track.heap.io/api/track", {
      method: "POST",
      body: JSON.stringify({
        event: "Add item to cart",
        identity: "buyer@example.com",
        app_id: "123456789",
        properties: { price: 9.99, sku: "SKU1" },
      }),
      bodyText: JSON.stringify({
        event: "Add item to cart",
        identity: "buyer@example.com",
        app_id: "123456789",
        properties: { price: 9.99, sku: "SKU1" },
      }),
    });
    const d = HeapParser.parse(r);

    expect(d.platform).toBe("heap");
    expect(d.eventName).toBe("Add item to cart");
    expect(d.meta.projectId).toBe("123456789");
    expect(d.contextParameters.some((p) => p.key === "identity")).toBe(true);
    expect(d.customParameters.some((p) => p.key === "price")).toBe(true);
  });

  it("maps identify calls to an identify event name", () => {
    const r = rawRequest("https://track.heap.io/api/identify", {
      method: "POST",
      bodyText: JSON.stringify({ identity: "u-1", app_id: "42" }),
    });
    const d = HeapParser.parse(r);

    expect(d.eventName).toBe("identify");
    expect(d.contextParameters.some((p) => p.key === "identity" && p.value === "u-1")).toBe(true);
  });

  it("falls back to heap_event when no event name is present", () => {
    const r = rawRequest("https://track.heap.io/api/track", { method: "POST" });
    expect(HeapParser.parse(r).eventName).toBe("heap_event");
  });
});
