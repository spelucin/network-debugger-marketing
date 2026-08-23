import type { DecodedEvent, Parameter, RawRequest } from "../../core/types";
import { makeParam, type MarketingParser } from "../types";

function safeUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

const BING_HOSTS = ["bat.bing.com", "bat.r.msn.com", "c.bing.com", "bat.bing.net"];

export const BingParser: MarketingParser = {
  id: "bing",
  platform: "bing",

  canParse(request: RawRequest): boolean {
    const url = safeUrl(request.url);
    if (!url) return false;
    return BING_HOSTS.includes(url.hostname);
  },

  parse(request: RawRequest): DecodedEvent {
    const q = request.queryParams;
    const standard: Parameter[] = [];
    const context: Parameter[] = [];
    const ecommerce: Parameter[] = [];

    const standardKeys = ["evt", "ea", "ec", "el", "ev", "gv", "gc"];
    const ecommerceKeys = [
      "ecomm_pagetype",
      "ecomm_prodid",
      "ecomm_query",
      "ecomm_category",
      "ecomm_totalvalue",
      "currency",
      "transaction_id",
      "items",
    ];
    const contextKeys = [
      "ti",
      "msclkid",
      "mid",
      "p",
      "r",
      "tl",
      "res",
      "lt",
      "kn",
      "je",
      "Ver",
      "rn",
      "spa",
      "stg",
    ];

    for (const [key, rawValue] of Object.entries(q)) {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      for (const value of values) {
        if (standardKeys.includes(key)) {
          standard.push(makeParam("bing", key, value, "standard"));
        } else if (ecommerceKeys.includes(key)) {
          ecommerce.push(makeParam("bing", key, value, "ecommerce"));
        } else if (contextKeys.includes(key)) {
          context.push(makeParam("bing", key, value, "context"));
        } else {
          context.push(makeParam("bing", key, value, "context"));
        }
      }
    }

    const conversionId =
      stringValue(q.ti) ?? stringValue(q.msclkid) ?? stringValue(q.mid);

    return {
      platform: "bing",
      eventName: stringValue(q.evt) || "pageview",
      standardParameters: standard,
      customParameters: [],
      contextParameters: [...context, ...ecommerce],
      meta: {
        conversionId: conversionId ?? undefined,
        protocol: "Microsoft UET",
      },
    };
  },
};

function stringValue(raw: string | string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const v = Array.isArray(raw) ? (raw[0] ?? "") : raw;
  return v || undefined;
}
