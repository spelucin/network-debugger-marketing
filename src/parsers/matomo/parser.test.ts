import { describe, expect, it } from "vitest";
import { MatomoParser } from "./parser";
import { queryParams, rawRequest } from "../../test/fixtures";

describe("MatomoParser.canParse", () => {
  it("accepts self-hosted tracking endpoints", () => {
    expect(
      MatomoParser.canParse(
        rawRequest("https://stats.example.org/matomo.php?idsite=1&rec=1")
      )
    ).toBe(true);
    expect(
      MatomoParser.canParse(rawRequest("https://analytics.customer.com/piwik.php?idsite=2"))
    ).toBe(true);
    expect(
      MatomoParser.canParse(rawRequest("https://client.matomo.cloud/matomo.php"))
    ).toBe(true);
  });

  it("rejects unrelated hosts and paths", () => {
    expect(MatomoParser.canParse(rawRequest("https://example.com/en/matomo-guide"))).toBe(false);
    expect(MatomoParser.canParse(rawRequest("https://matomo.org/faq"))).toBe(false);
  });
});

describe("MatomoParser.parse", () => {
  it("decodes an event with category and action", () => {
    const qs = "idsite=7&e_c=Video&e_a=Play&e_n=Tutorial&e_v=1.5&url=https%3A%2F%2Fsite.com%2F";
    const r = rawRequest(`https://stats.example.org/matomo.php?${qs}`, {
      queryParams: queryParams(qs),
    });
    const d = MatomoParser.parse(r);

    expect(d.platform).toBe("matomo");
    expect(d.eventName).toBe("Video:Play");
    expect(d.meta.projectId).toBe("7");
    expect(d.standardParameters.some((p) => p.key === "e_c")).toBe(true);
    expect(d.standardParameters.some((p) => p.key === "idsite")).toBe(true);
    expect(d.contextParameters.some((p) => p.key === "url")).toBe(true);
  });

  it("routes custom dimensions to the custom block", () => {
    const qs = "idsite=7&dimension1=premium&action_name=Home";
    const r = rawRequest(`https://stats.example.org/matomo.php?${qs}`, {
      queryParams: queryParams(qs),
    });
    const d = MatomoParser.parse(r);

    expect(d.customParameters.some((p) => p.key === "dimension1")).toBe(true);
    expect(d.standardParameters.some((p) => p.key === "action_name")).toBe(true);
  });

  it("decodes ecommerce orders from ec_items", () => {
    const items = JSON.stringify([["SKU1", "Shoe", "Footwear", 49.9, 2]]);
    const qs =
      `idsite=7&idgoal=0&revenue=59.8&ec_id=ORDER-9&ec_items=${encodeURIComponent(items)}`;
    const r = rawRequest(`https://stats.example.org/matomo.php?${qs}`, {
      queryParams: queryParams(qs),
    });
    const d = MatomoParser.parse(r);

    expect(d.ecommerce?.transaction_id).toBe("ORDER-9");
    expect(d.ecommerce?.value).toBe(59.8);
    expect(d.ecommerce?.items[0]).toMatchObject({
      item_id: "SKU1",
      item_name: "Shoe",
      quantity: 2,
    });
  });
});
