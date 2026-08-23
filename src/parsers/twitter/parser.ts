import type { DecodedEvent, Parameter, RawRequest } from "../../core/types";
import { isPlainObject, tryJsonParse } from "../../core/url";
import { makeParam, type MarketingParser } from "../types";

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

export const TwitterParser: MarketingParser = {
  id: "twitter",
  platform: "twitter",

  canParse(request: RawRequest): boolean {
    const url = safeUrl(request.url);
    if (!url) return false;
    const host = url.hostname;
    if (host === "analytics.twitter.com") return true;
    if (host === "t.co" && url.pathname.startsWith("/i/adsct")) return true;
    if (host === "static.ads-twitter.com") return true;
    return false;
  },

  parse(request: RawRequest): DecodedEvent {
    const q: Record<string, string> = {};
    const url = safeUrl(request.url);
    if (url) {
      for (const [k, v] of url.searchParams) {
        q[k] = v;
      }
    }

    // Merge POST body params (form-encoded or JSON)
    if (request.bodyText) {
      try {
        const bodyParams = new URLSearchParams(request.bodyText);
        for (const [k, v] of bodyParams) {
          if (!q[k]) q[k] = v;
        }
      } catch {
        const json = tryJsonParse(request.bodyText);
        if (isPlainObject(json)) {
          for (const [k, v] of Object.entries(json)) {
            if (!q[k] && typeof v === "string") q[k] = v;
          }
        }
      }
    }

    const eventName = stringValue(q.event) || stringValue(q.ev) || "PageView";
    const pixelId = stringValue(q.txn_id);

    const standard: Parameter[] = [];
    const context: Parameter[] = [];

    // Standard: conversion parameters
    const STANDARD_KEYS = new Set([
      "event", "ev", "txn_id", "p_id",
      "tw_sale_amount", "tw_order_quantity", "tw_order_id",
      "tw_currency", "tw_value", "tw_num_items",
      "tw_search_string", "tw_content_type", "tw_content_id", "tw_content_name",
    ]);

    for (const [key, value] of Object.entries(q)) {
      if (STANDARD_KEYS.has(key)) {
        standard.push(makeParam("twitter", key, value, "standard"));
      } else {
        context.push(makeParam("twitter", key, value, "context"));
      }
    }

    // Parse contents JSON for ecommerce items
    const contentsRaw = stringValue(q.contents);
    let ecommerceItems: Parameter[] | undefined;
    if (contentsRaw) {
      const parsed = tryJsonParse(contentsRaw);
      if (Array.isArray(parsed)) {
        ecommerceItems = parsed.map((item, i) =>
          makeParam("twitter", `contents[${i}]`, item, "ecommerce", "json")
        );
      }
    }

    return {
      platform: "twitter",
      eventName,
      standardParameters: standard,
      customParameters: ecommerceItems ?? [],
      contextParameters: context,
      meta: {
        pixelId,
        protocol: "Twitter/X Pixel",
      },
    };
  },
};
