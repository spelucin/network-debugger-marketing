import type {
  DecodedEvent,
  EcommerceData,
  EcommerceItem,
  Parameter,
  RawRequest,
} from "../../core/types";
import {
  isPlainObject,
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

function stringValue(raw: string | string[] | undefined): string {
  if (raw === undefined) return "";
  return Array.isArray(raw) ? (raw[0] ?? "") : raw;
}

const TIKTOK_CONTEXT_PARAM_KEYS = new Set([
  "ts", "timestamp", "event_id", "event_trigger", "test_event_code",
  "partner_name", "page_url", "page_referrer", "page_title", "url", "referrer",
  "browser_language", "browser_platform", "screen_resolution", "user_agent",
  "anon_id", "anonymous_id", "limit", "vid", "mid", "ttq", "fp",
  "advanced_filtering", "event_source", "pixel_code", "pixelCode",
  "client_ip", "client_user_agent", "referrer_url", "language", "device_id",
  "user_agent", "ua",
]);

function itemsFromContents(value: unknown): EcommerceItem[] {
  if (Array.isArray(value)) {
    return value
      .filter(isPlainObject)
      .map((entry) => {
        const item: EcommerceItem = {};
        for (const [k, v] of Object.entries(entry)) {
          if (k === "content_id" || k === "id") item.item_id = String(v);
          else if (k === "content_name" || k === "name") item.item_name = String(v);
          else if (k === "content_type" || k === "type") item.category = String(v);
          else if (k === "content_category") item.category = String(v);
          else if (k === "quantity") item.quantity = toNumber(v);
          else if (k === "price") item.price = toNumber(v);
          else item[k] = v;
        }
        return item;
      });
  }
  if (typeof value === "string") {
    const parsed = tryJsonParse(value);
    if (Array.isArray(parsed)) return itemsFromContents(parsed);
    return [{ item_id: value }];
  }
  return [];
}

function categorize(
  key: string,
  value: unknown,
  isEcommerce: boolean,
  isContext: boolean
): { category: "standard" | "custom" | "context" | "ecommerce"; param: Parameter } {
  const def = getDefinition("tiktok", key);
  if (isContext || TIKTOK_CONTEXT_PARAM_KEYS.has(key)) {
    return { category: "context", param: makeParam("tiktok", key, value, "context") };
  }
  if (isEcommerce || def?.category === "ecommerce") {
    return { category: "ecommerce", param: makeParam("tiktok", key, value, "ecommerce") };
  }
  if (def) {
    return { category: def.category, param: makeParam("tiktok", key, value, def.category) };
  }
  return { category: "custom", param: makeParam("tiktok", key, value, "custom") };
}

export const TikTokParser: MarketingParser = {
  id: "tiktok",
  platform: "tiktok",

  canParse(request: RawRequest): boolean {
    const url = safeUrl(request.url);
    if (!url) return false;
    if (url.hostname === "analytics.tiktok.com" || url.hostname.endsWith(".analytics.tiktok.com")) {
      if (url.pathname.startsWith("/api/v2/pixel/")) return true;
      if (url.pathname.startsWith("/i18n/pixel/")) return true;
    }
    if (
      url.hostname === "business-api.tiktok.com" &&
      (url.pathname.includes("/pixel/track") || url.pathname.includes("/pixel/batch"))
    ) {
      return true;
    }
    return false;
  },

  parse(request: RawRequest): DecodedEvent {
    const url = safeUrl(request.url);
    const q = request.queryParams;
    const isServerSide =
      url?.hostname === "business-api.tiktok.com" ||
      (request.method === "POST" && isPlainObject(request.body));

    if (isServerSide) return parseServerSide(request);

    // Client-side pixel: query string or JSON body carrying event info.
    const body = isPlainObject(request.body) ? request.body : undefined;
    const eventName = stringValue(
      (body?.event as string | undefined) ?? q.event
    ) || "unknown";
    const pixelCode = stringValue(
      (body?.pixel_code as string | undefined) ?? q.pixel_code ?? q.pixelCode
    );

    const standard: Parameter[] = [];
    const custom: Parameter[] = [];
    const context: Parameter[] = [];
    let contents: unknown;

    // Properties arrive as a JSON body field or, on GET beacons, as a JSON
    // query parameter (e.g. analytics.tiktok.com/api/v2/pixel/?properties=...).
    let properties: Record<string, unknown> = {};
    if (body?.properties !== undefined) {
      const props = body.properties;
      if (isPlainObject(props)) properties = props;
    } else {
      const propsRaw = stringValue(q.properties);
      const parsed = propsRaw ? tryJsonParse(propsRaw) : undefined;
      if (isPlainObject(parsed)) properties = parsed;
    }

    for (const [key, value] of Object.entries(properties)) {
      if (key === "contents") {
        contents = Array.isArray(value) ? value : tryJsonParse(String(value)) ?? value;
        custom.push(makeParam("tiktok", key, contents, "ecommerce"));
        continue;
      }
      const { category, param } = categorize(key, value, false, false);
      if (category === "standard") standard.push(param);
      else if (category === "context") context.push(param);
      else custom.push(param);
    }

    if (body) {
      const page = isPlainObject(body.page) ? body.page : {};
      for (const [key, value] of Object.entries(page)) {
        context.push(makeParam("tiktok", key, value, "context"));
      }
      const user = isPlainObject(body.user) ? body.user : {};
      for (const [key, value] of Object.entries(user)) {
        context.push(makeParam("tiktok", key, value, "context"));
      }
      const contextObj = isPlainObject(body.context) ? body.context : {};
      for (const [key, value] of Object.entries(contextObj)) {
        context.push(makeParam("tiktok", key, value, "context"));
      }
      for (const [key, value] of Object.entries(body)) {
        if (["event", "event_id", "properties", "user", "page", "context", "pixel_code"].includes(key)) continue;
        context.push(makeParam("tiktok", key, value, "context"));
      }
    } else {
      for (const [key, rawValue] of Object.entries(q)) {
        if (key === "event" || key === "pixel_code" || key === "pixelCode" || key === "properties") continue;
        const values = Array.isArray(rawValue) ? rawValue : [rawValue];
        for (const value of values) {
          const { category, param } = categorize(key, value, false, false);
          if (category === "context") context.push(param);
          else if (category === "standard") standard.push(param);
          else custom.push(param);
        }
      }
    }

    const propMap = new Map<string, unknown>();
    for (const p of standard) propMap.set(p.key, p.value);
    for (const p of custom) {
      if (p.category === "ecommerce") propMap.set(p.key, p.value);
    }

    const items = itemsFromContents(contents);
    const value = toNumber(propMap.get("value"));
    const currency = propMap.get("currency");
    const ecommerce: EcommerceData | undefined =
      items.length > 0 || value !== undefined
        ? {
            items,
            value,
            currency: typeof currency === "string" ? currency.toUpperCase() : undefined,
            transaction_id:
              typeof propMap.get("order_id") === "string"
                ? (propMap.get("order_id") as string)
                : undefined,
          }
        : undefined;

    return {
      platform: "tiktok",
      eventName,
      standardParameters: standard,
      customParameters: custom,
      contextParameters: context,
      ecommerce,
      meta: {
        pixelId: pixelCode,
        eventId: stringValue(q.event_id),
        protocol: "TikTok Pixel",
      },
    };
  },
};

function parseServerSide(request: RawRequest): DecodedEvent {
  const body = isPlainObject(request.body) ? request.body : {};
  const eventName = typeof body.event === "string" ? body.event : "unknown";
  const standard: Parameter[] = [];
  const custom: Parameter[] = [];
  const context: Parameter[] = [];

  const properties = isPlainObject(body.properties) ? body.properties : {};
  for (const [key, value] of Object.entries(properties)) {
    const { category, param } = categorize(key, value, false, false);
    if (category === "standard") standard.push(param);
    else if (category === "context") context.push(param);
    else custom.push(param);
  }
  const user = isPlainObject(body.user) ? body.user : {};
  for (const [key, value] of Object.entries(user)) {
    context.push(makeParam("tiktok", key, value, "context"));
  }
  const page = isPlainObject(body.page) ? body.page : {};
  for (const [key, value] of Object.entries(page)) {
    context.push(makeParam("tiktok", key, value, "context"));
  }

  const ecommerceItems = itemsFromContents(properties.contents);
  const value = toNumber(properties.value);
  const currency = properties.currency;
  const ecommerce: EcommerceData | undefined =
    ecommerceItems.length > 0 || value !== undefined
      ? {
          items: ecommerceItems,
          value,
          currency: typeof currency === "string" ? currency.toUpperCase() : undefined,
          transaction_id:
            typeof properties.order_id === "string" ? properties.order_id : undefined,
        }
      : undefined;

  return {
    platform: "tiktok",
    eventName,
    standardParameters: standard,
    customParameters: custom,
    contextParameters: context,
    ecommerce,
    meta: {
      pixelId:
        typeof body.pixel_code === "string" ? body.pixel_code : undefined,
      eventId: typeof body.event_id === "string" ? body.event_id : undefined,
      protocol: "TikTok Events API",
    },
  };
}