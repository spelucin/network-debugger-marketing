import type { RawRequest } from "../../core/types";
import {
  isPlainObject,
  toNumber,
  tryJsonParse,
} from "../../core/url";
import { getDefinition, bareName } from "../../definitions";
import { makeParam, type MarketingParser } from "../types";
import type {
  DecodedEvent,
  EcommerceData,
  EcommerceItem,
  ParamCategory,
  Parameter,
} from "../../core/types";

const GA4_HOST_RE = /(^|\.)(google-analytics\.com|analytics\.google\.com)$/;
const GA4_PATH_RE = /^\/(?:g|mp)\/collect$/;

const EVENT_PREFIXES: Array<{ prefix: string; category: ParamCategory }> = [
  { prefix: "epn.", category: "standard" },
  { prefix: "ep.", category: "standard" },
  { prefix: "upn.", category: "context" },
  { prefix: "up.", category: "context" },
  { prefix: "seg.", category: "context" },
];

const ITEM_FIELD_KEYS: Record<string, keyof EcommerceItem | "item_price" | "item_quantity"> = {
  id: "item_id",
  nm: "item_name",
  br: "item_brand",
  ca: "item_category",
  va: "item_variant",
  pr: "item_price",
  qt: "item_quantity",
  cp: "coupon",
  ps: "position",
  cur: "currency",
};

function decodeItemField(
  field: string,
  value: string
): [keyof EcommerceItem, unknown] | undefined {
  const key = ITEM_FIELD_KEYS[field];
  if (!key) return undefined;
  if (field === "pr" || field === "qt") {
    return [key, toNumber(value) ?? value];
  }
  if (field === "cur") return [key, value.toUpperCase()];
  return [key, value];
}

function extractCompressedItems(q: Record<string, string | string[]>): EcommerceItem[] {
  const grouped = new Map<number, EcommerceItem>();
  for (const [key, rawValue] of Object.entries(q)) {
    const m = key.match(/^pr(\d+)([a-z]+)$/);
    if (!m) continue;
    const index = Number(m[1]);
    const field = m[2] as string;
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      const decoded = decodeItemField(field, value);
      if (!decoded) continue;
      const [itemKey, itemValue] = decoded;
      const item = grouped.get(index) ?? {};
      item[itemKey] = itemValue;
      grouped.set(index, item);
    }
  }
  const items = [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, item]) => item);
  return items.filter((item) => Object.keys(item).length > 0);
}

function extractJsonItems(q: Record<string, string | string[]>): EcommerceItem[] {
  const candidates = ["ep.items", "epn.items", "items"];
  for (const key of candidates) {
    const raw = q[key];
    if (raw === undefined) continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const parsed = tryJsonParse(value ?? "");
    if (Array.isArray(parsed)) {
      return parsed
        .filter(isPlainObject)
        .map((entry) => {
          const item: EcommerceItem = {};
          for (const [k, v] of Object.entries(entry)) {
            if (k === "price" || k === "quantity" || k === "position") {
              item[`item_${k === "price" ? "price" : k}` as keyof EcommerceItem] = toNumber(v) ?? v;
            } else if (k === "item_id" || k === "id") {
              item.item_id = String(v);
            } else if (k === "item_name" || k === "name") {
              item.item_name = String(v);
            } else {
              item[k] = v;
            }
          }
          return item;
        });
    }
  }
  return [];
}

function buildEcommerce(
  standard: Parameter[],
  items: EcommerceItem[]
): EcommerceData | undefined {
  const data: EcommerceData = { items };
  for (const p of standard) {
    const name = bareName("ga4", p.key);
    if (name === "value" && p.value !== undefined) {
      data.value = toNumber(p.value);
    } else if (name === "currency" && p.value !== undefined) {
      data.currency = String(p.value).toUpperCase();
    } else if (name === "transaction_id" && p.value !== undefined) {
      data.transaction_id = String(p.value);
    } else if (name === "shipping") {
      data.shipping = toNumber(p.value);
    } else if (name === "tax") {
      data.tax = toNumber(p.value);
    } else if (name === "coupon") {
      data.coupon = String(p.value);
    } else if (name === "affiliation") {
      data.affiliation = String(p.value);
    }
  }
  if (items.length === 0 && data.value === undefined && data.transaction_id === undefined) {
    return undefined;
  }
  return data;
}

function stringValue(raw: string | string[] | undefined): string {
  if (raw === undefined) return "";
  return Array.isArray(raw) ? (raw[0] ?? "") : raw;
}

export const Ga4Parser: MarketingParser = {
  id: "ga4",
  platform: "ga4",

  canParse(request: RawRequest): boolean {
    const url = safeUrl(request.url);
    if (!url) return false;
    // GA4 measurement relayed through DoubleClick (consent-mode / Signals):
    // same /g/collect shape, different host. The strict G-… tid check does
    // not apply to the relay.
    const isStatsRelay =
      url.hostname === "stats.g.doubleclick.net" && url.pathname === "/g/collect";
    return (
      ((GA4_HOST_RE.test(url.hostname) && GA4_PATH_RE.test(url.pathname)) ||
        isStatsRelay) &&
      (isStatsRelay || /^G-[A-Z0-9]+$/i.test(stringValue(request.queryParams.tid)))
    );
  },

  parse(request: RawRequest): DecodedEvent {
    const q = request.queryParams;
    const eventName = stringValue(q.en) || "unknown";

    const standard: Parameter[] = [];
    const custom: Parameter[] = [];
    const context: Parameter[] = [];

    for (const [key, rawValue] of Object.entries(q)) {
      if (key === "en" || key === "tid") continue;
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];

      if (key.match(/^pr\d+[a-z]+$/)) continue; // consumed by ecommerce

      let category: ParamCategory | undefined;
      let bareKey = key;
      for (const { prefix, category: cat } of EVENT_PREFIXES) {
        if (key.startsWith(prefix)) {
          category = cat;
          bareKey = key.slice(prefix.length);
          break;
        }
      }
      if (bareKey === "items") continue; // rendered in the ecommerce section

      const def = getDefinition("ga4", key);
      category = def?.category ?? category ?? "custom";

      for (const value of values) {
        const isNumeric = category === "standard" && /^epn\./.test(key);
        const parsedValue = isNumeric ? (toNumber(value) ?? value) : value;
        standard.push(
          makeParam("ga4", key, parsedValue, category, isNumeric ? "number" : undefined)
        );
        if (category !== "standard") {
          // keep context/custom separate; re-route the just-built param
          const param = standard.pop()!;
          (category === "context" ? context : custom).push(param);
        }
      }
    }

    const items = [
      ...extractCompressedItems(q),
      ...extractJsonItems(q),
    ];
    const ecommerce = buildEcommerce(standard, items);

    return {
      platform: "ga4",
      eventName,
      standardParameters: standard,
      customParameters: custom,
      contextParameters: context,
      ecommerce,
      meta: {
        measurementId: stringValue(q.tid),
        version: stringValue(q.v),
        clientId: stringValue(q.cid),
        sessionId: stringValue(q.sid),
        protocol: "GA4 collect",
      },
    };
  },
};

function safeUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}