import type {
  DecodedEvent,
  EcommerceData,
  EcommerceItem,
  Parameter,
  RawRequest,
} from "../../core/types";
import {
  isPlainObject,
  splitBracketKey,
  toNumber,
  tryJsonParse,
} from "../../core/url";
import { getDefinition } from "../../definitions";
import { makeParam, type MarketingParser } from "../types";

function safeUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

function isFacebookHost(host: string): boolean {
  return (
    host === "facebook.com" ||
    host.endsWith(".facebook.com") ||
    host === "facebook.net" ||
    host.endsWith(".facebook.net")
  );
}

function stringValue(raw: string | string[] | undefined): string {
  if (raw === undefined) return "";
  return Array.isArray(raw) ? (raw[0] ?? "") : raw;
}

const TRANSPORT_KEYS = new Set([
  "id", "ev", "dl", "rl", "ts", "sw", "sh", "v", "r", "a", "eid", "ec",
  "tt", "dbg", "if", "o", "fb", "tid", "_fbp", "_fbc", "tp", "dc", "nm",
  "dd", "hd", "sc", "sq", "sr", "ss", "v_", "w", "th", "to", "gc",
]);

/** Decode `contents`/`content_ids` into ecommerce items. */
function itemsFromContents(value: unknown): EcommerceItem[] {
  if (Array.isArray(value)) {
    return value
      .filter(isPlainObject)
      .map((entry) => {
        const item: EcommerceItem = {};
        for (const [k, v] of Object.entries(entry)) {
          if (k === "id" || k === "content_id") item.item_id = String(v);
          else if (k === "name" || k === "content_name") item.item_name = String(v);
          else if (k === "quantity") item.quantity = toNumber(v);
          else if (k === "item_price" || k === "price") item.price = toNumber(v);
          else if (k === "category") item.category = String(v);
          else item[k] = v;
        }
        return item;
      });
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return itemsFromContents(parsed);
    } catch {
      // not JSON — treat as a comma-separated list of content ids
    }
    const ids = value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length > 0) return ids.map((id) => ({ item_id: id }));
  }
  return [];
}

export const MetaParser: MarketingParser = {
  id: "meta",
  platform: "meta",

  canParse(request: RawRequest): boolean {
    const url = safeUrl(request.url);
    if (!url) return false;
    if (isFacebookHost(url.hostname) && url.pathname === "/tr/") return true;
    if (url.hostname === "graph.facebook.com" && /^\/(?:v\d+\.\d+\/)?\d+\/events/.test(url.pathname)) {
      return true;
    }
    return false;
  },

  parse(request: RawRequest): DecodedEvent {
    const url = safeUrl(request.url);
    const q = request.queryParams;

    // --- Server-side Conversions API style (graph.facebook.com/.../events) ---
    if (url?.hostname === "graph.facebook.com") {
      return parseServerSide(request);
    }

    const pixelId = stringValue(q.id);
    const eventName = stringValue(q.ev) || "unknown";

    const standard: Parameter[] = [];
    const custom: Parameter[] = [];
    const context: Parameter[] = [];
    let contents: unknown;

    for (const [key, rawValue] of Object.entries(q)) {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      for (const value of values) {
        const { base, subKey } = splitBracketKey(key);
        if (base === "cd" && subKey) {
          const def = getDefinition("meta", key);
          const category = def?.category ?? "custom";
          const isEcommerce = def?.category === "ecommerce";
          const val = subKey === "contents" ? (tryJsonParse(value) ?? value) : value;
          if (subKey === "contents") contents = val;
          if (isEcommerce) custom.push(makeParam("meta", key, val, "ecommerce"));
          else if (category === "standard") standard.push(makeParam("meta", key, val, "standard"));
          else custom.push(makeParam("meta", key, val, "custom"));
          continue;
        }
        if (base === "ud" && subKey) {
          context.push(makeParam("meta", key, value, "context"));
          continue;
        }
        if (TRANSPORT_KEYS.has(base)) {
          context.push(makeParam("meta", key, value, "context"));
          continue;
        }
        custom.push(makeParam("meta", key, value, "custom"));
      }
    }

    // Ecommerce summary from standard/custom data.
    const dataMap = new Map<string, unknown>();
    for (const p of [...standard, ...custom]) {
      const { subKey } = splitBracketKey(p.key);
      dataMap.set(subKey ?? p.key, p.value);
    }
    let items = itemsFromContents(contents);
    if (items.length === 0) {
      const ids = dataMap.get("content_ids") ?? dataMap.get("content_id");
      items = itemsFromContents(ids);
    }

    const value = toNumber(dataMap.get("value"));
    const currency = dataMap.get("currency");
    const orderId = dataMap.get("order_id");
    const ecommerce: EcommerceData | undefined =
      items.length > 0 || value !== undefined
        ? {
            items,
            value,
            currency: typeof currency === "string" ? currency.toUpperCase() : undefined,
            transaction_id: typeof orderId === "string" ? orderId : undefined,
          }
        : undefined;

    return {
      platform: "meta",
      eventName,
      standardParameters: standard,
      customParameters: custom,
      contextParameters: context,
      ecommerce,
      meta: {
        pixelId,
        version: stringValue(q.v),
        eventId: stringValue(q.eid),
        documentLocation: stringValue(q.dl),
        protocol: "Meta Pixel /tr",
      },
    };
  },
};

function parseServerSide(request: RawRequest): DecodedEvent {
  const body = isPlainObject(request.body) ? request.body : {};
  const eventList = Array.isArray(body.data) ? body.data : [];
  const first = isPlainObject(eventList[0]) ? eventList[0] : {};
  const url = safeUrl(request.url);
  const pixelMatch = url?.pathname.match(/\/(\d+)\/events$/);

  const eventName = typeof first.event_name === "string" ? first.event_name : "unknown";
  const standard: Parameter[] = [];
  const custom: Parameter[] = [];
  const context: Parameter[] = [];

  const customData = isPlainObject(first.custom_data) ? first.custom_data : {};
  for (const [key, value] of Object.entries(customData)) {
    if (key === "contents") {
      const items = itemsFromContents(value);
      if (items.length > 0) {
        standard.push(makeParam("meta", "contents", value, "ecommerce"));
      }
      continue;
    }
    const def = getDefinition("meta", `cd[${key}]`);
    const category = def?.category === "ecommerce" ? "ecommerce" : def ? "standard" : "custom";
    standard.push(makeParam("meta", `cd[${key}]`, value, category));
  }

  const userData = isPlainObject(first.user_data) ? first.user_data : {};
  for (const [key, value] of Object.entries(userData)) {
    context.push(makeParam("meta", `ud[${key}]`, value, "context"));
  }

  for (const [key, value] of Object.entries(first)) {
    if (key === "custom_data" || key === "user_data" || key === "event_name") continue;
    context.push(makeParam("meta", key, value, "context"));
  }

  const customMap = new Map(customData ? Object.entries(customData) : []);
  const value = toNumber(customMap.get("value"));
  const currency = customMap.get("currency");
  const ecommerce: EcommerceData | undefined =
    value !== undefined || customMap.has("contents")
      ? {
          items: itemsFromContents(customMap.get("contents")),
          value,
          currency: typeof currency === "string" ? currency.toUpperCase() : undefined,
        }
      : undefined;

  return {
    platform: "meta",
    eventName,
    standardParameters: standard,
    customParameters: custom,
    contextParameters: context,
    ecommerce,
    meta: {
      pixelId: pixelMatch?.[1],
      eventId: typeof first.event_id === "string" ? first.event_id : undefined,
      accessToken: typeof body.access_token === "string" ? "(present)" : undefined,
      protocol: "Meta CAPI (graph events)",
      actionSource: typeof first.action_source === "string" ? first.action_source : undefined,
    },
  };
}