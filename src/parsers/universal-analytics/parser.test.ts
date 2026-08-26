import { describe, expect, it } from "vitest";
import { UniversalAnalyticsParser } from "./parser";
import { queryParams, rawRequest } from "../../test/fixtures";

const UA = (path: string, qs: string) =>
  rawRequest(`https://www.google-analytics.com${path}?${qs}`, {
    queryParams: queryParams(qs),
  });

describe("UniversalAnalyticsParser.canParse", () => {
  it("accepts a /j/collect pageview ping with a UA- id", () => {
    const r = UA("/j/collect", "v=1&_v=j102&t=pageview&tid=UA-29179243-2&cid=1.2");
    expect(UniversalAnalyticsParser.canParse(r)).toBe(true);
  });

  it("accepts plain /collect and /r/collect", () => {
    expect(
      UniversalAnalyticsParser.canParse(
        UA("/collect", "v=1&tid=UA-1-1&t=event")
      )
    ).toBe(true);
    expect(
      UniversalAnalyticsParser.canParse(
        UA("/r/collect", "v=1&tid=UA-1-1&t=event")
      )
    ).toBe(true);
  });

  it("accepts /batch", () => {
    const r = UA("/batch", "v=1&tid=UA-1-1&t=pageview");
    expect(UniversalAnalyticsParser.canParse(r)).toBe(true);
  });

  it("accepts on the strength of v=1 alone (no tid)", () => {
    const r = UA("/j/collect", "v=1&t=pageview");
    expect(UniversalAnalyticsParser.canParse(r)).toBe(true);
  });

  it("rejects GA4 pings on the same path (v=2, G- id)", () => {
    const r = UA("/j/collect", "v=2&tid=G-ABC123&en=page_view");
    expect(UniversalAnalyticsParser.canParse(r)).toBe(false);
  });

  it("rejects GA4 collect paths", () => {
    const r = UA("/g/collect", "v=1&tid=UA-1-1");
    expect(UniversalAnalyticsParser.canParse(r)).toBe(false);
  });

  it("rejects non-GA hosts", () => {
    const r = rawRequest("https://example.com/j/collect?v=1&tid=UA-1-1", {
      queryParams: queryParams("v=1&tid=UA-1-1"),
    });
    expect(UniversalAnalyticsParser.canParse(r)).toBe(false);
  });
});

describe("UniversalAnalyticsParser.parse", () => {
  it("decodes a real-world pageview ping", () => {
    const qs =
      "v=1&_v=j102&a=1440017029&t=pageview&_s=1" +
      "&dl=https%3A%2F%2Fkristaseiden.com%2F" +
      "&ul=es-419&de=UTF-8&tid=UA-29179243-2&cid=208132167.1787700137" +
      "&jid=208132167&gjid=1018305346&_gid=2081321167.1787700137" +
      "&sr=1920x1080&vp=1376x975&gcd=1313131313&dma=0" +
      "&tag_exp=115938466~115938468&z=1018305346";
    const r = UA("/j/collect", qs);
    const d = UniversalAnalyticsParser.parse(r);

    expect(d.platform).toBe("universal_analytics");
    expect(d.eventName).toBe("pageview");
    expect(d.meta.measurementId).toBe("UA-29179243-2");
    expect(d.meta.version).toBe("1");
    expect(d.meta.clientId).toBe("208132167.1787700137");
    expect(d.meta.protocol).toBe("Universal Analytics");

    const tid = d.standardParameters.find((p) => p.key === "tid");
    expect(tid?.label).toBe("Tracking ID");
    const dl = d.contextParameters.find((p) => p.key === "dl");
    expect(dl?.value).toBe("https://kristaseiden.com/");
    expect(dl?.type).toBe("url");
  });

  it("names event hits category:action", () => {
    const r = UA("/collect", "v=1&tid=UA-1-1&t=event&ec=Videos&ea=Play&el=Intro&ev=1");
    const d = UniversalAnalyticsParser.parse(r);

    expect(d.eventName).toBe("Videos:Play");
    expect(d.standardParameters.some((p) => p.key === "el")).toBe(true);
    const ev = d.standardParameters.find((p) => p.key === "ev");
    expect(ev?.type).toBe("number");
  });

  it("falls back to a bare hit type or unknown", () => {
    expect(UniversalAnalyticsParser.parse(UA("/collect", "v=1&tid=UA-1-1&t=social")).eventName).toBe("social");
    expect(UniversalAnalyticsParser.parse(UA("/collect", "v=1&tid=UA-1-1")).eventName).toBe("unknown");
    expect(UniversalAnalyticsParser.parse(UA("/collect", "v=1&tid=UA-1-1&t=event&ea=Click")).eventName).toBe("Click");
  });

  it("builds ecommerce from transaction hits", () => {
    const r = UA("/collect", "v=1&tid=UA-1-1&t=transaction&ti=TX1&tr=49.99&ts=3&tt=2&cu=usd");
    const d = UniversalAnalyticsParser.parse(r);

    expect(d.eventName).toBe("transaction");
    expect(d.ecommerce).toBeDefined();
    expect(d.ecommerce!.transaction_id).toBe("TX1");
    expect(d.ecommerce!.value).toBe(49.99);
    expect(d.ecommerce!.currency).toBe("USD");
  });

  it("labels custom dimensions and metrics", () => {
    const r = UA("/collect", "v=1&tid=UA-1-1&t=pageview&cd1=member&cm5=42");
    const d = UniversalAnalyticsParser.parse(r);

    const cd1 = d.customParameters.find((p) => p.key === "cd1");
    expect(cd1?.label).toBe("Custom Dimension 1");
    const cm5 = d.customParameters.find((p) => p.key === "cm5");
    expect(cm5?.label).toBe("Custom Metric 5");
  });

  it("routes unknown keys to custom", () => {
    const r = UA("/collect", "v=1&tid=UA-1-1&t=pageview&mystery=1");
    const d = UniversalAnalyticsParser.parse(r);
    expect(d.customParameters.some((p) => p.key === "mystery")).toBe(true);
  });
});
