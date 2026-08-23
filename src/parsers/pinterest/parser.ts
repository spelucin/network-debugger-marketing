import type { DecodedEvent, EcommerceItem, Parameter, RawRequest } from "../../core/types";
import { isPlainObject } from "../../core/url";
import { makeParam, type MarketingParser } from "../types";

function safeUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

/**
 * Parse Pinterest's PHP bracket notation into a nested object.
 * e.g. "ed[line_items][0][product_name]" → { ed: { line_items: [{ product_name }] } }
 */
function parseBracketParams(
  q: Record<string, string | string[]>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [rawKey, rawValue] of Object.entries(q)) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    const value = values[0] ?? "";

    // Match patterns like "ed[line_items][0][product_name]" or "pd[em]"
    const match = rawKey.match(/^(\w+)\[(.+)\]$/);
    if (!match) {
      result[rawKey] = value;
      continue;
    }

    const prefix = match[1]!;
    const rest = match[2]!;
    const keys = rest.split("][").map((k) => k.replace(/]$/, "").replace(/\[/g, ""));

    let target: Record<string, unknown> = result;
    if (!(prefix in target)) target[prefix] = {};
    target = target[prefix] as Record<string, unknown>;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]!;
      if (!(key in target)) target[key] = {};
      target = target[key] as Record<string, unknown>;
    }

    const lastKey = keys[keys.length - 1]!;
    target[lastKey] = value;
  }

  return promoteNumericKeys(result);
}

/** Recursively turn objects whose every key is numeric (PHP-style indexed
 * children, e.g. line_items[0], line_items[1]) into real arrays so
 * downstream consumers can iterate them. */
function promoteNumericKeys(
  value: Record<string, unknown>
): Record<string, unknown> {
  function walk(node: unknown): unknown {
    if (Array.isArray(node)) return node.map(walk);
    if (!isPlainObject(node)) return node;

    const entries = Object.entries(node);
    if (
      entries.length > 0 &&
      entries.every(([k]) => /^\d+$/.test(k))
    ) {
      const out: unknown[] = [];
      for (const [k, v] of entries) out[Number(k)] = walk(v);
      return out;
    }
    return Object.fromEntries(entries.map(([k, v]) => [k, walk(v)]));
  }
  return walk(value) as Record<string, unknown>;
}

function stringValue(raw: string | string[] | undefined): string {
  if (raw === undefined) return "";
  return Array.isArray(raw) ? (raw[0] ?? "") : raw;
}

/** Build ecommerce line items from the parsed ed.line_items array. */
function buildEcommerceItems(
  lineItems: unknown
): EcommerceItem[] {
  if (!Array.isArray(lineItems)) return [];
  return lineItems.map((item) => {
    if (typeof item !== "object" || item === null) return {};
    const obj = item as Record<string, unknown>;
    return {
      item_id: obj.product_id as string | undefined,
      item_name: obj.product_name as string | undefined,
      price: obj.price != null ? Number(obj.price) : undefined,
      quantity: obj.quantity != null ? Number(obj.quantity) : undefined,
      brand: obj.product_brand as string | undefined,
      category: obj.product_category as string | undefined,
      item_variant: obj.product_variant_id as string | undefined,
      currency: obj.currency as string | undefined,
      ...obj,
    };
  });
}

export const PinterestParser: MarketingParser = {
  id: "pinterest",
  platform: "pinterest",

  canParse(request: RawRequest): boolean {
    const url = safeUrl(request.url);
    if (!url) return false;
    const host = url.hostname;
    if (host === "ct.pinterest.com" || host === "log.pinterest.com") return true;
    if (host === "s.pinimg.com" && url.pathname.startsWith("/ct/")) return true;
    return false;
  },

  parse(request: RawRequest): DecodedEvent {
    const q = request.queryParams;
    const nested = parseBracketParams(q);

    const eventName = stringValue(q.event);
    const tid = stringValue(q.tid);

    const standard: Parameter[] = [];
    const custom: Parameter[] = [];
    const context: Parameter[] = [];

    // Standard
    if (eventName) standard.push(makeParam("pinterest", "event", eventName, "standard"));
    if (tid) standard.push(makeParam("pinterest", "tid", tid, "standard", "id"));

    // Ecommerce custom params
    const ed = nested.ed as Record<string, unknown> | undefined;
    if (ed) {
      if (ed.value != null) custom.push(makeParam("pinterest", "ed[value]", ed.value, "ecommerce", "currency"));
      if (ed.currency != null) custom.push(makeParam("pinterest", "ed[currency]", ed.currency, "ecommerce"));
      if (ed.order_quantity != null) custom.push(makeParam("pinterest", "ed[order_quantity]", ed.order_quantity, "ecommerce", "number"));
      for (const [key, val] of Object.entries(ed)) {
        if (key === "value" || key === "currency" || key === "order_quantity" || key === "line_items") continue;
        custom.push(makeParam("pinterest", `ed[${key}]`, val, "custom"));
      }
    }

    // Context params
    const pd = nested.pd as Record<string, unknown> | undefined;
    if (pd) {
      for (const [key, val] of Object.entries(pd)) {
        context.push(makeParam("pinterest", `pd[${key}]`, val, "context"));
      }
    }

    // Remaining top-level context params
    const STANDARD_KEYS = new Set(["event", "tid", "ed", "pd"]);
    for (const [key, rawValue] of Object.entries(q)) {
      if (STANDARD_KEYS.has(key)) continue;
      // Skip nested keys that were already processed
      if (key.includes("[")) continue;
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      for (const value of values) {
        context.push(makeParam("pinterest", key, value, "context"));
      }
    }

    // Build ecommerce data
    const ecommerceItems = ed?.line_items ? buildEcommerceItems(ed.line_items) : [];
    const ecommerce = ecommerceItems.length > 0
      ? {
          items: ecommerceItems,
          value: ed?.value != null ? Number(ed.value) : undefined,
          currency: ed?.currency as string | undefined,
        }
      : undefined;

    return {
      platform: "pinterest",
      eventName,
      standardParameters: standard,
      customParameters: custom,
      contextParameters: context,
      ecommerce,
      meta: {
        pixelId: tid,
        protocol: "Pinterest Tag",
      },
    };
  },
};
