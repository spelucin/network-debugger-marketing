import { describe, expect, it } from "vitest";
import { ClarityParser } from "./parser";
import { queryParams, rawRequest } from "../../test/fixtures";

describe("ClarityParser.canParse", () => {
  it("accepts beacon, session and SDK hosts under clarity.ms", () => {
    expect(
      ClarityParser.canParse(rawRequest("https://c.clarity.ms/c.gif?u=x&p=123"))
    ).toBe(true);
    expect(
      ClarityParser.canParse(rawRequest("https://www.clarity.ms/collect/"))
    ).toBe(true);
    expect(
      ClarityParser.canParse(rawRequest("https://clarity.ms/s/abc123/clarity.js"))
    ).toBe(true);
  });

  it("rejects unrelated hosts", () => {
    expect(
      ClarityParser.canParse(rawRequest("https://example.com/c.gif?p=123"))
    ).toBe(false);
  });
});

describe("ClarityParser.parse", () => {
  it("decodes a pageview beacon with project id", () => {
    const qs = "u=x&p=1234&s=abc";
    const r = rawRequest(`https://c.clarity.ms/c.gif?${qs}`, {
      queryParams: queryParams(qs),
    });
    const d = ClarityParser.parse(r);

    expect(d.platform).toBe("clarity");
    expect(d.eventName).toBe("pageview");
    expect(d.meta.projectId).toBe("1234");
    expect(d.contextParameters.some((p) => p.key === "s")).toBe(true);
  });

  it("decodes a session upload envelope", () => {
    const r = rawRequest("https://www.clarity.ms/collect/", {
      method: "POST",
      body: { e: { p: "1234", s: "s1", u: "u1" }, events: [] },
    });
    const d = ClarityParser.parse(r);

    expect(d.eventName).toBe("session");
    expect(d.meta.projectId).toBe("1234");
    expect(d.contextParameters.some((p) => p.key === "s")).toBe(true);
  });

  it("reads the project id from a JSON payload when missing from the query", () => {
    const r = rawRequest("https://www.clarity.ms/collect/", {
      method: "POST",
      body: { project_id: "999", events: [] },
    });
    const d = ClarityParser.parse(r);

    expect(d.eventName).toBe("session");
    expect(d.meta.projectId).toBe("999");
  });
});