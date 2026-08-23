import { describe, expect, it } from "vitest";
import { apexDomain, hostOf } from "./url-patterns";

describe("hostOf", () => {
  it("returns lowercase hostname", () => {
    expect(hostOf("https://WWW.Example.COM/a?b=1")).toBe("www.example.com");
  });

  it("strips the port", () => {
    expect(hostOf("https://example.com:8443/x")).toBe("example.com");
  });

  it("strips a trailing dot", () => {
    expect(hostOf("https://example.com./x")).toBe("example.com");
  });

  it("keeps IPv6 hosts intact", () => {
    expect(hostOf("https://[2001:db8::1]:443/x")).toBe("2001:db8::1");
  });

  it("falls back to empty string for garbage", () => {
    expect(hostOf("not a url at all")).toBe("");
    expect(hostOf("")).toBe("");
  });
});

describe("apexDomain", () => {
  it("reduces a normal host to its last two labels", () => {
    expect(apexDomain("analytics.tiktok.com")).toBe("tiktok.com");
    expect(apexDomain("com")).toBe("com");
  });

  it("keeps multi-part public suffixes intact", () => {
    expect(apexDomain("shop.co.uk")).toBe("shop.co.uk");
    expect(apexDomain("a.b.shop.co.uk")).toBe("shop.co.uk");
  });

  it("treats PaaS hosts as public suffixes (one extra label kept)", () => {
    // Registrable-domain semantics: under a known public suffix the
    // tenant label itself is part of the registrable domain.
    expect(apexDomain("my-app.vercel.app")).toBe("my-app.vercel.app");
    expect(apexDomain("site.github.io")).toBe("site.github.io");
    expect(apexDomain("a.b.my-app.vercel.app")).toBe("my-app.vercel.app");
  });

  it("handles empty input", () => {
    expect(apexDomain("")).toBe("");
  });
});
