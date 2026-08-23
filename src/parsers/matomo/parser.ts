import type { DecodedEvent, EcommerceItem, Parameter, RawRequest } from "../../core/types";
import { tryJsonParse } from "../../core/url";
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

function parseEcommerceItems(raw: string | string[] | undefined): EcommerceItem[] | undefined {
  const str = stringValue(raw);
  if (!str) return undefined;
  const parsed = tryJsonParse(str);
  if (!Array.isArray(parsed)) return undefined;
  return parsed
    .filter((item): item is unknown[] => Array.isArray(item))
    .map((row) => ({
      item_id: row[0] != null ? String(row[0]) : undefined,
      item_name: row[1] != null ? String(row[1]) : undefined,
      category: row[2] != null ? String(row[2]) : undefined,
      price: row[3] != null ? Number(row[3]) : undefined,
      quantity: row[4] != null ? Number(row[4]) : undefined,
    }));
}

export const MatomoParser: MarketingParser = {
  id: "matomo",
  platform: "matomo",

  canParse(request: RawRequest): boolean {
    const url = safeUrl(request.url);
    if (!url) return false;
    const host = url.hostname;
    if (host.endsWith(".matomo.cloud")) return true;
    const path = url.pathname;
    return (
      path.endsWith("/matomo.php") ||
      path.endsWith("/piwik.php") ||
      path.startsWith("/matomo.php") ||
      path.startsWith("/piwik.php")
    );
  },

  parse(request: RawRequest): DecodedEvent {
    const q = request.queryParams;

    const standard: Parameter[] = [];
    const context: Parameter[] = [];
    const custom: Parameter[] = [];

    const eventCategory = stringValue(q.e_c);
    const eventAction = stringValue(q.e_a);
    const eventName = stringValue(q.e_n);
    const actionName = stringValue(q.action_name);

    let resolvedEventName = eventName || actionName || "event";
    if (eventCategory && eventAction) {
      resolvedEventName = `${eventCategory}:${eventAction}`;
    } else if (eventCategory) {
      resolvedEventName = eventCategory;
    } else if (eventAction) {
      resolvedEventName = eventAction;
    }

    const STANDARD_KEYS = [
      "idsite", "e_c", "e_a", "e_n", "e_v", "revenue",
      "ec_id", "ec_items", "action_name", "idgoal",
      "c_n", "c_p", "c_t", "c_i",
    ];

    const CONTEXT_KEYS = [
      "_id", "uid", "cid", "url", "urlref", "ua", "lang",
      "res", "date", "time", "_cvar",
    ];

    for (const [key, rawValue] of Object.entries(q)) {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      for (const value of values) {
        if (key.startsWith("dimension")) {
          custom.push(makeParam("matomo", key, value, "custom"));
        } else if (STANDARD_KEYS.includes(key)) {
          const fallbackType = key === "e_v" ? "number" as const : undefined;
          standard.push(makeParam("matomo", key, value, "standard", fallbackType));
        } else if (CONTEXT_KEYS.includes(key)) {
          context.push(makeParam("matomo", key, value, "context"));
        } else {
          context.push(makeParam("matomo", key, value, "context"));
        }
      }
    }

    let ecommerce;
    const ecItems = parseEcommerceItems(q.ec_items);
    if (ecItems && ecItems.length > 0) {
      const revenueRaw = stringValue(q.revenue);
      const ecIdRaw = stringValue(q.ec_id);
      ecommerce = {
        items: ecItems,
        value: revenueRaw ? Number(revenueRaw) : undefined,
        transaction_id: ecIdRaw || undefined,
      };
    }

    const idsite = stringValue(q.idsite);

    return {
      platform: "matomo",
      eventName: resolvedEventName,
      standardParameters: standard,
      customParameters: custom,
      contextParameters: context,
      ecommerce,
      meta: {
        projectId: idsite,
        measurementId: idsite,
        protocol: "Matomo",
      },
    };
  },
};
