import { describe, expect, it } from "vitest";
import { GoogleAdsParser } from "./parser";
import { queryParams, rawRequest } from "../../test/fixtures";

const req = (url: string) =>
  rawRequest(url, { queryParams: queryParams(new URL(url).search) });

describe("GoogleAdsParser.canParse", () => {
  it("accepts /pagead/ conversion pings", () => {
    expect(
      GoogleAdsParser.canParse(
        req("https://google.com/pagead/conversion/?google_cvt=1&ev=conversion")
      )
    ).toBe(true);
  });

  it("accepts gtag/destination with an AW- id", () => {
    expect(
      GoogleAdsParser.canParse(
        req("https://www.googletagmanager.com/gtag/destination?id=AW-123456789")
      )
    ).toBe(true);
  });

  it("rejects non-ads hosts", () => {
    expect(
      GoogleAdsParser.canParse(
        rawRequest("https://example.com/pagead/conversion/?ev=conversion", {
          queryParams: queryParams("ev=conversion"),
        })
      )
    ).toBe(false);
  });

  it("rejects gtag/destination without an AW- id", () => {
    expect(
      GoogleAdsParser.canParse(
        req("https://www.googletagmanager.com/gtag/destination?id=G-ABC123")
      )
    ).toBe(false);
  });

  it("accepts Campaign Manager measurement pings", () => {
    expect(
      GoogleAdsParser.canParse(
        req("https://ad.doubleclick.net/cm/s/collect?ty=1&aw_id=AW-9")
      )
    ).toBe(true);
  });

  it("accepts consent-mode /ccm/ collect pings", () => {
    expect(
      GoogleAdsParser.canParse(
        req(
          "https://ad.doubleclick.net/ccm/s/collect?auid=668259794.1787185004&fmt=8&gtm=45He68j1h2v9191109959za200zd9191109959xea&mt=8"
        )
      )
    ).toBe(true);
  });

  it("accepts Floodlight activity pings", () => {
    expect(
      GoogleAdsParser.canParse(
        req("https://ad.doubleclick.net/ddm/activity/src=123;type=456")
      )
    ).toBe(true);
    expect(
      GoogleAdsParser.canParse(
        req("https://fls.doubleclick.net/activityj;src=123;type=456")
      )
    ).toBe(true);
  });
});

describe("GoogleAdsParser.parse", () => {
  it("decodes a Campaign Manager collect ping as a conversion", () => {
    const r = req(
      "https://ad.doubleclick.net/cm/s/collect?ty=1&aw_id=AW-987654321&gclid=xyz"
    );
    const d = GoogleAdsParser.parse(r);

    expect(d.platform).toBe("google_ads");
    expect(d.eventName).toBe("conversion");
    expect(d.meta.conversionId).toBe("AW-987654321");
  });

  it("decodes a conversion event and its id", () => {
    const r = req(
      "https://google.com/pagead/conversion/?google_cvt=1&ev=conversion&aw_id=AW-123456789&value=10&currency_code=USD&gclid=abc123"
    );
    const d = GoogleAdsParser.parse(r);

    expect(d.platform).toBe("google_ads");
    expect(d.eventName).toBe("conversion");
    expect(d.meta.conversionId).toBe("AW-123456789");
    expect(d.meta.value).toBe(10);
  });

  it("decodes viewthrough conversion events", () => {
    const r = req("https://google.com/pagead/viewthroughconversion/987654321/?value=5");
    const d = GoogleAdsParser.parse(r);

    expect(d.eventName).toBe("viewthrough_conversion");
    expect(d.meta.conversionId).toBe("");
  });

  it("pulls the conversion id from gtag/destination", () => {
    const r = req(
      "https://www.googletagmanager.com/gtag/destination?id=AW-555666777&gclid=x&u_cd_value=3"
    );
    const d = GoogleAdsParser.parse(r);

    expect(d.eventName).toBe("conversion");
    expect(d.meta.conversionId).toBe("AW-555666777");
  });

  it("reads conversion id from the data JSON payload", () => {
    const data = encodeURIComponent(JSON.stringify({ aw: "AW-111222333", e: 5 }));
    const r = req(
      `https://google.com/pagead/conversion/?google_cvt=1&data=${data}`
    );
    const d = GoogleAdsParser.parse(r);

    expect(d.meta.conversionId).toBe("AW-111222333");
    expect(d.standardParameters.some((p) => p.key === "data.e")).toBe(true);
  });
});