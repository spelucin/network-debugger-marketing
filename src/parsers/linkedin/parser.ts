import type { DecodedEvent, Parameter, RawRequest } from "../../core/types";
import { makeParam, type MarketingParser } from "../types";

export const LinkedInParser: MarketingParser = {
  id: "linkedin",
  platform: "linkedin",

  canParse(req: RawRequest): boolean {
    try {
      const url = new URL(req.url);
      const hostname = url.hostname;
      return (
        hostname === "px.ads.linkedin.com" ||
        (hostname.endsWith(".linkedin.com") && url.pathname.startsWith("/px"))
      );
    } catch {
      return false;
    }
  },

  parse(req: RawRequest): DecodedEvent {
    const url = new URL(req.url);
    const standard: Parameter[] = [];
    const context: Parameter[] = [];

    url.searchParams.forEach((value, key) => {
      const lower = key.toLowerCase();

      if (lower === "pid") {
        standard.push(makeParam("linkedin", key, value, "standard", "id"));
      } else if (lower === "conversionid" || lower === "conversion_id") {
        standard.push(makeParam("linkedin", key, value, "standard", "id"));
      } else {
        context.push(makeParam("linkedin", key, value, "context"));
      }
    });

    const pid = url.searchParams.get("pid") ?? undefined;
    const conversionId =
      url.searchParams.get("conversionId") ||
      url.searchParams.get("conversion_id") ||
      undefined;

    return {
      platform: "linkedin",
      eventName: conversionId ? `Conversion ${conversionId}` : "PageView",
      standardParameters: standard,
      customParameters: [],
      contextParameters: context,
      meta: {
        pixelId: pid,
        protocol: "LinkedIn Insight Tag",
      },
    };
  },
};
