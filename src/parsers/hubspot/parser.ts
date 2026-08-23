import type { DecodedEvent, Parameter, RawRequest } from "../../core/types";
import { makeParam, type MarketingParser } from "../types";

export const HubSpotParser: MarketingParser = {
  id: "hubspot",
  platform: "hubspot",

  canParse(req: RawRequest): boolean {
    try {
      const url = new URL(req.url);
      const hostname = url.hostname;
      const path = url.pathname;

      const isHubSpotHost =
        hostname === "track.hubspot.com" || hostname.endsWith(".hubspot.com");
      const isTrackingPixel =
        path.includes("__ptq.gif") || path.includes("__ptbe.gif");

      return isHubSpotHost && isTrackingPixel;
    } catch {
      return false;
    }
  },

  parse(req: RawRequest): DecodedEvent {
    const url = new URL(req.url);
    const params = url.searchParams;

    const projectId = params.get("a") ?? "";
    const measurementId = params.get("a") ?? "";

    const standard: Parameter[] = [];
    const context: Parameter[] = [];

    const addParam = (key: string, category: "standard" | "context", type?: "id" | "boolean" | "url" | "timestamp" | "json") => {
      const val = params.get(key);
      if (val !== null && val !== "") {
        const param = makeParam("hubspot", key, val, category, type);
        if (category === "standard") {
          standard.push(param);
        } else {
          context.push(param);
        }
      }
    };

    addParam("a", "standard", "id");
    addParam("nc", "standard", "boolean");

    addParam("vi", "context", "id");
    addParam("u", "context", "id");
    addParam("k", "context");
    addParam("bfp", "context", "id");
    addParam("pu", "context", "url");
    addParam("t", "context");
    addParam("r", "context", "url");
    addParam("sd", "context");
    addParam("cts", "context", "timestamp");
    addParam("b", "context", "json");
    addParam("i", "context", "json");
    addParam("l", "context");
    addParam("cp", "context");
    addParam("cs", "context");
    addParam("ck", "context");
    addParam("cc", "context");

    return {
      platform: "hubspot",
      eventName: "PageView",
      standardParameters: standard,
      customParameters: [],
      contextParameters: context,
      meta: {
        projectId,
        measurementId,
        protocol: "HubSpot Tracking",
      },
    };
  },
};