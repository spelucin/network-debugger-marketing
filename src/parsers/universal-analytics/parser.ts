import type {
  DecodedEvent,
  EcommerceData,
  Parameter,
  RawRequest,
} from "../../core/types";
import { toNumber } from "../../core/url";
import { getDefinition } from "../../definitions";
import { makeParam, type MarketingParser } from "../types";

// Universal Analytics rides the same hosts (and even the same /j/collect
// path) as GA4; only the payload tells them apart: protocol version v=1
// and a UA-… tracking id (GA4 uses v=2 with a G-… id).
const UA_HOST_RE = /(^|\.)(google-analytics\.com|analytics\.google\.com)$/;
// Collect endpoints seen in the wild: /collect, /j/collect (gtag builds),
// /r/collect (analytics.js), plus doubled-slash variants, and /batch.
const UA_PATH_RE = /^\/+(?:(?:j|r|d)\/)?(?:collect|batch)$/;

const UA_TID_RE = /^UA-\d+-\d+$/i;

function safeUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

function stringValue(raw: string | string[] | undefined): string {
  if (raw === undefined) return "";
  return Array.isArray(raw) ? (raw[0] ?? "") : raw;
}

/** Human label for UA custom dimensions / metrics (cd1…cd200, cm1…cm200). */
function customDimLabel(key: string): string | undefined {
  const dim = key.match(/^cd(\d+)$/);
  if (dim) return `Custom Dimension ${dim[1]}`;
  const met = key.match(/^cm(\d+)$/);
  if (met) return `Custom Metric ${met[1]}`;
  return undefined;
}

function hitTypeName(q: Record<string, string | string[]>): string {
  const t = stringValue(q.t);
  if (t === "event") {
    const category = stringValue(q.ec);
    const action = stringValue(q.ea);
    if (category && action) return `${category}:${action}`;
    return category || action || "event";
  }
  return t || "unknown";
}

export const UniversalAnalyticsParser: MarketingParser = {
  id: "universal_analytics",
  platform: "universal_analytics",

  canParse(request: RawRequest): boolean {
    const url = safeUrl(request.url);
    if (!url) return false;
    if (!UA_HOST_RE.test(url.hostname)) return false;
    if (!UA_PATH_RE.test(url.pathname)) return false;
    // Payload check: UA protocol version or a UA- tracking id. This is what
    // keeps GA4's /j/collect pings (v=2, G-…) out of this parser.
    return (
      stringValue(request.queryParams.v) === "1" ||
      UA_TID_RE.test(stringValue(request.queryParams.tid))
    );
  },

  parse(request: RawRequest): DecodedEvent {
    const q = request.queryParams;

    const standard: Parameter[] = [];
    const custom: Parameter[] = [];
    const context: Parameter[] = [];

    for (const [key, rawValue] of Object.entries(q)) {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      const dimLabel = customDimLabel(key);
      const def = getDefinition("universal_analytics", key);
      const category = dimLabel ? "custom" : (def?.category ?? "custom");

      for (const value of values) {
        const param = makeParam("universal_analytics", key, value, category, undefined);
        if (dimLabel) param.label = dimLabel;
        if (category === "standard") standard.push(param);
        else if (category === "context") context.push(param);
        else custom.push(param);
      }
    }

    const transactionId = stringValue(q.ti);
    const revenue = toNumber(stringValue(q.tr));
    const ecommerce: EcommerceData | undefined =
      transactionId || revenue !== undefined
        ? {
            items: [],
            transaction_id: transactionId || undefined,
            value: revenue ?? undefined,
            shipping: toNumber(stringValue(q.ts)),
            tax: toNumber(stringValue(q.tt)),
            currency: stringValue(q.cu).toUpperCase() || undefined,
          }
        : undefined;

    return {
      platform: "universal_analytics",
      eventName: hitTypeName(q),
      standardParameters: standard,
      customParameters: custom,
      contextParameters: context,
      ecommerce,
      meta: {
        measurementId: stringValue(q.tid),
        version: stringValue(q.v),
        clientId: stringValue(q.cid),
        protocol: "Universal Analytics",
      },
    };
  },
};
