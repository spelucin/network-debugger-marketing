import type { DecodedEvent, Parameter, RawRequest } from "../../core/types";
import { makeParam, type MarketingParser } from "../types";

function safeUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}

interface SnapchatContext {
  ev?: string;
  url?: string;
  ua?: string;
  sw?: number;
  sh?: number;
  v?: string;
  ts?: number;
  pv?: number;
  d_ot?: number;
  d_os?: number;
  d_a?: number;
  d_bvs?: number;
  ss?: string;
  u_scsid?: string;
  [key: string]: unknown;
}

interface SnapchatRequestItem {
  i?: {
    pids?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface SnapchatBody {
  ctx?: SnapchatContext;
  req?: SnapchatRequestItem[];
  event_type?: string;
  currency?: string;
  price?: number;
  transaction_id?: string;
  item_ids?: string[];
  item_category?: string;
  number_items?: number;
  description?: string;
  search_string?: string;
  sign_up_method?: string;
  success?: boolean;
  payment_info_available?: boolean;
  [key: string]: unknown;
}

export const SnapchatParser: MarketingParser = {
  id: "snapchat",
  platform: "snapchat",

  canParse(request: RawRequest): boolean {
    const url = safeUrl(request.url);
    if (!url) return false;
    const host = url.hostname;
    return host === "tr.snapchat.com" || host === "tr6.snapchat.com";
  },

  parse(raw: RawRequest): DecodedEvent {
    const url = safeUrl(raw.url);
    const searchParams = url?.searchParams;
    let body: SnapchatBody = {};

    try {
      if (raw.body) {
        body = typeof raw.body === "string" ? JSON.parse(raw.body) : (raw.body as SnapchatBody);
      }
    } catch {
      // Ignore JSON parse error
    }

    const ctx = body.ctx ?? {};
    const req = body.req ?? [];

    const pixelId =
      req[0]?.i?.pids?.[0] ??
      searchParams?.get("pid") ??
      searchParams?.get("id") ??
      null;

    const eventName =
      searchParams?.get("ev") ??
      body.event_type ??
      ctx.ev ??
      "PAGE_VIEW";

    const standard: Parameter[] = [];
    const context: Parameter[] = [];

    const addParam = (name: string, value: unknown, category: "standard" | "context" | "ecommerce") => {
      if (value != null && value !== "") {
        const param = makeParam("snapchat", name, value, category);
        if (category === "standard" || category === "ecommerce") {
          standard.push(param);
        } else {
          context.push(param);
        }
      }
    };

    addParam("currency", body.currency ?? searchParams?.get("currency"), "standard");
    addParam("price", body.price ?? searchParams?.get("price"), "standard");
    addParam("transaction_id", body.transaction_id ?? searchParams?.get("transaction_id"), "standard");
    addParam("item_ids", body.item_ids ?? searchParams?.get("item_ids"), "ecommerce");
    addParam("item_category", body.item_category ?? searchParams?.get("item_category"), "ecommerce");
    addParam("number_items", body.number_items ?? searchParams?.get("number_items"), "standard");
    addParam("description", body.description ?? searchParams?.get("description"), "standard");
    addParam("search_string", body.search_string ?? searchParams?.get("search_string"), "standard");
    addParam("sign_up_method", body.sign_up_method ?? searchParams?.get("sign_up_method"), "standard");
    addParam("success", body.success ?? searchParams?.get("success"), "standard");
    addParam("payment_info_available", body.payment_info_available ?? searchParams?.get("payment_info_available"), "standard");

    addParam("context.url", ctx.url, "context");
    addParam("context.ua", ctx.ua, "context");
    addParam("context.sw", ctx.sw, "context");
    addParam("context.sh", ctx.sh, "context");
    addParam("context.v", ctx.v, "context");
    addParam("context.ts", ctx.ts, "context");
    addParam("context.pv", ctx.pv, "context");
    addParam("context.d_ot", ctx.d_ot, "context");
    addParam("context.d_os", ctx.d_os, "context");
    addParam("context.d_a", ctx.d_a, "context");
    addParam("context.d_bvs", ctx.d_bvs, "context");
    addParam("context.ss", ctx.ss, "context");
    addParam("u_scsid", ctx.u_scsid, "context");

    for (const [key, value] of Object.entries(ctx)) {
      if (!["ev", "url", "ua", "sw", "sh", "v", "ts", "pv", "d_ot", "d_os", "d_a", "d_bvs", "ss", "u_scsid"].includes(key)) {
        addParam(`context.${key}`, value, "context");
      }
    }

    return {
      platform: "snapchat",
      eventName,
      standardParameters: standard,
      customParameters: [],
      contextParameters: context,
      meta: {
        pixelId: pixelId ?? undefined,
        protocol: "Snap Pixel",
      },
    };
  },
};
