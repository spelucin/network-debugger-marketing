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
});

describe("GoogleAdsParser.parse", () => {
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