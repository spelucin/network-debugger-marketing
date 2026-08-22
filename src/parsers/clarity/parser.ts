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

/** Best-effort extraction of the Clarity project id. */
function extractProjectId(
  q: Record<string, string | string[]>,
  body: unknown
): string | undefined {
  const fromQuery =
    stringValue(q.p) || stringValue(q.project_id) || stringValue(q.projectId);
  if (fromQuery) return fromQuery;
  if (isPlainObject(body)) {
    const envelope = isPlainObject(body.e) ? body.e : {};
    const candidate = envelope.p ?? body.project_id ?? body.projectId;
    if (typeof candidate === "string" && candidate) return candidate;
  }
  return undefined;
}

export const ClarityParser: MarketingParser = {
  id: "clarity",
  platform: "clarity",

  canParse(request: RawRequest): boolean {
    const url = safeUrl(request.url);
    if (!url) return false;
    const host = url.hostname;
    return host === "clarity.ms" || host.endsWith(".clarity.ms");
  },

  parse(request: RawRequest): DecodedEvent {
    const url = safeUrl(request.url);
    const q = request.queryParams;
    const isPageview =
      url !== undefined && (url.pathname === "/c.gif" || url.pathname.startsWith("/c.gif"));
    const isSession =
      url !== undefined &&
      url.hostname === "www.clarity.ms" &&
      url.pathname.startsWith("/collect");
    const eventName = isPageview ? "pageview" : isSession ? "session" : "request";

    const standard: Parameter[] = [];
    const context: Parameter[] = [];

    // Pageview beacons carry the observed payload in the `u` query parameter
    // (URL-encoded JSON). Surface it as context, best-effort.
    if (isPageview) {
      const payloadRaw = stringValue(q.u);
      const payload = payloadRaw ? tryJsonParse(payloadRaw) : undefined;
      if (isPlainObject(payload)) {
        for (const [key, value] of Object.entries(payload)) {
          context.push(makeParam("clarity", key, value, "context"));
        }
      }
    }

    // Session uploads are JSON POSTs with an envelope under `e` containing
    // project (`p`), session (`s`) and user (`u`) ids.
    if (isSession && isPlainObject(request.body)) {
      const envelope = isPlainObject(request.body.e) ? request.body.e : {};
      for (const [key, value] of Object.entries(envelope)) {
        context.push(makeParam("clarity", key, value, "context"));
      }
      for (const [key, value] of Object.entries(request.body)) {
        if (key === "e") continue;
        context.push(makeParam("clarity", key, value, "context"));
      }
    }

    for (const [key, rawValue] of Object.entries(q)) {
      if (key === "u") continue;
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      for (const value of values) {
        context.push(makeParam("clarity", key, value, "context"));
      }
    }

    return {
      platform: "clarity",
      eventName,
      standardParameters: standard,
      customParameters: [],
      contextParameters: context,
      meta: {
        projectId: extractProjectId(q, request.body),
        protocol: isSession ? "Clarity Session" : "Clarity Beacon",
      },
    };
  },
};