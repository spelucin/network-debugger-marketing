import { describe, expect, it } from "vitest";
import { AmplitudeParser } from "./parser";
import { rawRequest } from "../../test/fixtures";

describe("AmplitudeParser.canParse", () => {
  it("accepts the v2 HTTP API host", () => {
    const r = rawRequest("https://api.amplitude.com/2/httpapi?api_key=k");
    expect(AmplitudeParser.canParse(r)).toBe(true);
  });

  it("rejects other amplitude and unrelated hosts", () => {
    expect(AmplitudeParser.canParse(rawRequest("https://api2.amplitude.com/batch"))).toBe(false);
    expect(AmplitudeParser.canParse(rawRequest("https://cdn.amplitude.com/libs/x.js"))).toBe(false);
    expect(AmplitudeParser.canParse(rawRequest("https://example.com/2/httpapi"))).toBe(false);
  });
});

describe("AmplitudeParser.parse", () => {
  it("decodes an event from a JSON body", () => {
    const r = rawRequest("https://api.amplitude.com/2/httpapi", {
      method: "POST",
      body: {
        api_key: "SECRET",
        events: [
          {
            event_type: "Song Played",
            user_id: "u-1",
            device_id: "d-1",
            session_id: 1700000000,
            event_properties: { plan: "pro" },
            user_properties: { language: "en" },
          },
        ],
      },
    });
    const d = AmplitudeParser.parse(r);

    expect(d.platform).toBe("amplitude");
    expect(d.eventName).toBe("Song Played");
    expect(d.standardParameters.some((p) => p.key === "event_type")).toBe(true);
    expect(d.customParameters.some((p) => p.key === "plan")).toBe(true);
    expect(d.contextParameters.some((p) => p.key === "user_id")).toBe(true);
    expect(d.contextParameters.some((p) => p.key === "device_id")).toBe(true);
    expect(d.contextParameters.some((p) => p.key === "session_id")).toBe(true);
    expect(d.contextParameters.some((p) => p.key === "language")).toBe(true);
  });

  it("reads the API key from the URL when present", () => {
    const r = rawRequest(
      "https://api.amplitude.com/?api_key=URLKEY&e=" +
        encodeURIComponent('[{"event_type":"Login"}]')
    );
    const d = AmplitudeParser.parse(r);
    expect(d.meta.apiKey).toBe("URLKEY");
    expect(d.eventName).toBe("Login");
  });

  it("falls back to Unknown when the body carries no events", () => {
    const r = rawRequest("https://api.amplitude.com/", { method: "POST" });
    expect(AmplitudeParser.parse(r).eventName).toBe("Unknown");
  });
});
