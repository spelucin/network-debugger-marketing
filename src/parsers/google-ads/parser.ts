import type {
  DecodedEvent,
  EcommerceData,
  Parameter,
  RawRequest,
} from "../../core/types";
import { isPlainObject, safeDecode, tryJsonParse } from "../../core/url";
import { makeParam, type MarketingParser } from "../types";

function safeUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

function isAdsHost(host: string): boolean {
  if (
    host === "doubleclick.net" ||
    host.endsWith(".doubleclick.net") ||
    host === "googleadservices.com" ||
    host.endsWith(".googleadservices.com") ||
    host === "adservice.google.com" ||
    host.endsWith(".adservice.google.com")
  ) {
    return true;
  }
  if (host === "google.com" || host.endsWith(".google.com")) {
    // Only pagead paths count; www.google.com/pagead is a real conversion host.
    return true;
  }
  return false;
}

function stringValue(raw: string | string[] | undefined): string {
  if (raw === undefined) return "";
  return Array.isArray(raw) ? (raw[0] ?? "") : raw;
}

const CONTEXT_KEYS = new Set([
  "aw_id", "aw_c", "aw_f", "aw_rem", "are", "cnv", "aw", "data",
  "gclid", "gclsrc", "wbraid", "gbraid", "dclid", "dclsrc",
  "type", "u", "w", "t", "l", "c", "o", "e", "sf", "em", "fb", "ln",
  "google_cver", "rd", "url", "gdpr", "gdpr_consent", "cu",
]);

export const GoogleAdsParser: MarketingParser = {
  id: "google_ads",
  platform: "google_ads",

  canParse(request: RawRequest): boolean {
    const url = safeUrl(request.url);
    if (!url) return false;
    if (isAdsHost(url.hostname) && url.pathname.startsWith("/pagead/")) {
      return true;
    }
    if (
      (url.hostname === "googletagmanager.com" ||
        url.hostname.endsWith(".googletagmanager.com")) &&
      url.pathname === "/gtag/destination" &&
      /^AW-/i.test(stringValue(request.queryParams.id))
    ) {
      return true;
    }
    return false;
  },

  parse(request: RawRequest): DecodedEvent {
    const q = request.queryParams;
    const url = safeUrl(request.url);
    const path = url?.pathname ?? "";

    let eventName: string;
    if (path.includes("viewthroughconversion")) eventName = "viewthrough_conversion";
    else if (path.includes("remarketing")) eventName = "remarketing";
    else if (path.includes("interaction")) eventName = "conversion_linker";
    else if (path.includes("landing")) eventName = "landing";
    else if (path === "/gtag/destination") eventName = "conversion";
    else eventName = stringValue(q.type) || "conversion";

    // Conversion ID may come from aw_id, the data JSON, or the gtag destination id.
    let conversionId = stringValue(q.aw_id);
    const dataRaw = stringValue(q.data);
    const dataJson = tryJsonParse(safeDecode(dataRaw));
    if (!conversionId && isPlainObject(dataJson)) {
      const aw = dataJson.aw;
      if (typeof aw === "string") conversionId = aw;
    }
    if (!conversionId && /^AW-/i.test(stringValue(q.id))) {
      conversionId = stringValue(q.id);
    }
    if (!conversionId && isPlainObject(dataJson)) {
      const aw = dataJson.aw_id;
      if (typeof aw === "string") conversionId = aw;
    }

    const standard: Parameter[] = [];
    const custom: Parameter[] = [];
    const context: Parameter[] = [];

    for (const [key, rawValue] of Object.entries(q)) {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      for (const value of values) {
        const param = makeParam(
          "google_ads",
          key,
          CONTEXT_KEYS.has(key) ? decodeMaybeJson(value) : value,
          CONTEXT_KEYS.has(key) ? "context" : "standard",
          key === "cv" ? "number" : undefined
        );
        if (CONTEXT_KEYS.has(key)) context.push(param);
        else if (key === "data") context.push(param);
        else standard.push(param);
      }
    }

    // Surface the parsed data payload keys as extra standard params so the
    // conversion metadata is not buried in a JSON blob.
    if (isPlainObject(dataJson)) {
      for (const [key, value] of Object.entries(dataJson)) {
        if (key === "aw" || key === "aw_id") continue;
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          standard.push(makeParam("google_ads", `data.${key}`, value, "standard"));
        }
      }
    }

    const valueRaw = stringValue(q.cv) || stringValue(q.value);
    const value =
      valueRaw !== "" && Number.isFinite(Number(valueRaw)) ? Number(valueRaw) : undefined;
    const currencyRaw = stringValue(q.currency_code);
    const currency =
      currencyRaw !== "" ? currencyRaw.toUpperCase() : undefined;
    const ecommerce: EcommerceData | undefined =
      value !== undefined ? { items: [], value, currency } : undefined;

    return {
      platform: "google_ads",
      eventName,
      standardParameters: standard,
      customParameters: custom,
      contextParameters: context,
      ecommerce,
      meta: {
        conversionId,
        type: eventName,
        value,
        currency,
        url: request.url,
        dataPayload: dataJson,
      },
    };
  },
};

function decodeMaybeJson(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed.startsWith("{")) {
    const parsed = tryJsonParse(trimmed);
    if (parsed !== undefined) return parsed;
  }
  return value;
}