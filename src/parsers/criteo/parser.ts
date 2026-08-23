import type { DecodedEvent, Parameter, ParamCategory, ParameterType, RawRequest } from "../../core/types";
import { isPlainObject, tryJsonParse } from "../../core/url";
import { makeParam, type MarketingParser } from "../types";

function parseSiteType(val: string | undefined): string | undefined {
  if (!val) return undefined;
  const map: Record<string, string> = { d: "Desktop", m: "Mobile", t: "Tablet" };
  return map[val.toLowerCase()] || val;
}

function mergeParams(...sources: Record<string, string>[]): Record<string, string> {
  return Object.assign({}, ...sources);
}

function parsePostBody(body: string | undefined): Record<string, string> {
  if (!body) return {};
  try {
    const json = tryJsonParse(body);
    if (isPlainObject(json)) {
      return Object.fromEntries(
        Object.entries(json).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])
      );
    }
  } catch {}
  const params: Record<string, string> = {};
  for (const pair of body.split("&")) {
    const [k, v] = pair.split("=");
    if (k) params[decodeURIComponent(k)] = v ? decodeURIComponent(v) : "";
  }
  return params;
}

export const CriteoParser: MarketingParser = {
  id: "criteo",
  platform: "criteo",

  canParse(req: RawRequest): boolean {
    try {
      const url = new URL(req.url);
      const host = url.hostname.toLowerCase();
      return host.endsWith(".criteo.com") || host.endsWith(".criteo.net");
    } catch {
      return false;
    }
  },

  parse(req: RawRequest): DecodedEvent {
    const url = new URL(req.url);
    const urlParams: Record<string, string> = {};
    url.searchParams.forEach((v, k) => { urlParams[k] = v; });
    const postParams = parsePostBody(typeof req.body === "string" ? req.body : undefined);
    const all = mergeParams(urlParams, postParams);

    const standard: Parameter[] = [];
    const context: Parameter[] = [];
    const custom: Parameter[] = [];

    const add = (name: string, value: string | undefined, category: ParamCategory, type?: ParameterType) => {
      if (value !== undefined && value !== "") {
        const p = makeParam("criteo", name, value, category, type);
        if (category === "standard" || category === "ecommerce") {
          standard.push(p);
        } else if (category === "context") {
          context.push(p);
        } else {
          custom.push(p);
        }
      }
    };

    add("e", all.e, "standard");
    add("a", all.a, "context", "id");
    add("item", all.item, "ecommerce", "json");
    add("productid", all.productid, "ecommerce", "json");
    add("transactionid", all.transactionid, "ecommerce", "id");
    add("deduplication", all.deduplication, "ecommerce", "number");
    add("new_customer", all.new_customer, "standard", "boolean");
    add("sc", all.sc, "context", "json");
    add("retailerVisitorId", all.retailerVisitorId, "context", "id");
    add("customerId", all.customerId, "context", "id");
    add("siteType", parseSiteType(all.siteType), "context");
    add("type", parseSiteType(all.type), "context");
    add("external_advids", all.external_advids, "context", "json");
    add("fu", all.fu, "context", "url");
    add("tld", all.tld, "context");
    add("v", all.v, "context");
    add("p0", all.p0, "context");
    add("ci", all.ci, "context");
    add("glb", all.glb, "context");

    return {
      platform: "criteo",
      eventName: all.e || "unknown",
      standardParameters: standard,
      customParameters: custom,
      contextParameters: context,
      meta: {
        conversionId: all.transactionid || undefined,
        protocol: "Criteo OneTag",
      },
    };
  },
};
