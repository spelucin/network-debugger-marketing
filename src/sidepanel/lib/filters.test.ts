import { describe, expect, it } from "vitest";
import type { MarketingRequest } from "../../core/types";
import { rawRequest } from "../../test/fixtures";
import { filterByTab } from "./filters";

function req(tabId: number | undefined, eventName = "purchase"): MarketingRequest {
  const base = rawRequest("https://example.com/g/collect", { tabId });
  return {
    ...base,
    platform: "ga4",
    eventName,
    unknown: false,
  };
}

describe("filterByTab", () => {
  it("returns only requests matching the active tab", () => {
    const list = [req(1), req(2), req(3)];
    expect(filterByTab(list, 2)).toHaveLength(1);
    expect(filterByTab(list, 2)[0]!.tabId).toBe(2);
  });

  it("excludes requests with no tabId", () => {
    const list = [req(undefined), req(5)];
    expect(filterByTab(list, 5)).toHaveLength(1);
    expect(filterByTab(list, 5)[0]!.tabId).toBe(5);
  });

  it("shows all requests when the active tab is unknown (safe fallback)", () => {
    const list = [req(1), req(2), req(undefined)];
    expect(filterByTab(list, undefined)).toEqual(list);
  });

  it("never mutates the source list", () => {
    const list = [req(1), req(2), req(2)];
    const snapshot = [...list];
    filterByTab(list, 2);
    expect(list).toEqual(snapshot);
    expect(list).toHaveLength(3);
  });

  it("preserves history across tab switches", () => {
    const list = [req(1, "page_view"), req(2, "add_to_cart"), req(1, "purchase")];
    const tab1 = filterByTab(list, 1);
    const tab2 = filterByTab(list, 2);
    const tab1Again = filterByTab(list, 1);

    expect(tab1.map((r) => r.eventName)).toEqual(["page_view", "purchase"]);
    expect(tab2.map((r) => r.eventName)).toEqual(["add_to_cart"]);
    expect(tab1Again).toEqual(tab1);
    expect(list).toHaveLength(3);
  });
});