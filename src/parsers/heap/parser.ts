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

export const HeapParser: MarketingParser = {
  id: "heap",
  platform: "heap",

  canParse(request: RawRequest): boolean {
    const url = safeUrl(request.url);
    if (!url) return false;
    const host = url.hostname;
    return (
      host.endsWith(".heapanalytics.com") ||
      host === "track.heap.io" ||
      host === "api.heap.io" ||
      host.endsWith(".heap-api.com")
    );
  },

  parse(request: RawRequest): DecodedEvent {
    const url = safeUrl(request.url);
    const pathname = url?.pathname ?? "";

    let body: Record<string, unknown> = {};
    if (isPlainObject(request.body)) {
      body = request.body;
    } else if (typeof request.bodyText === "string") {
      const parsed = tryJsonParse(request.bodyText);
      if (isPlainObject(parsed)) body = parsed;
    }

    // Determine endpoint kind and extract the primary event payload.
    const isBulk = pathname.endsWith("/bulk");
    const events: Record<string, unknown>[] = [];
    if (isBulk && Array.isArray(body.data)) {
      for (const item of body.data) {
        if (isPlainObject(item)) events.push(item);
      }
    } else if (isPlainObject(body) && (body.event || body.identity || body.user_id)) {
      events.push(body);
    }

    // For identify / add_user_properties there may be no event name.
    const isIdentify = pathname.endsWith("/identify");
    const isUserProps = pathname.endsWith("/add_user_properties");

    const first = events[0] ?? {};
    const eventName: string =
      (typeof first.event === "string" && first.event) ||
      (isIdentify ? "identify" : isUserProps ? "add_user_properties" : "heap_event");

    const standard: Parameter[] = [];
    const custom: Parameter[] = [];
    const context: Parameter[] = [];

    // Core identity / session fields → context.
    const identity = first.identity ?? first.user_id;
    if (identity !== undefined) {
      context.push(makeParam("heap", "identity", identity, "context", "id"));
    }
    if (first.user_id !== undefined && first.user_id !== first.identity) {
      context.push(makeParam("heap", "user_id", first.user_id, "context", "id"));
    }
    if (first.session_id !== undefined) {
      context.push(makeParam("heap", "session_id", first.session_id, "context", "id"));
    }
    if (first.app_id !== undefined) {
      context.push(makeParam("heap", "app_id", first.app_id, "context", "id"));
    }
    if (first.timestamp !== undefined) {
      context.push(makeParam("heap", "timestamp", first.timestamp, "context", "timestamp"));
    }

    // SDK metadata.
    if (first.library !== undefined) {
      context.push(makeParam("heap", "library", first.library, "context"));
    }
    if (first.version !== undefined) {
      context.push(makeParam("heap", "version", first.version, "context"));
    }

    // User properties (from identify / add_user_properties).
    if (isPlainObject(first.user_properties)) {
      context.push(makeParam("heap", "user_properties", first.user_properties, "context", "json"));
    }

    // Event properties → custom params.
    if (isPlainObject(first.properties)) {
      for (const [key, value] of Object.entries(first.properties)) {
        custom.push(makeParam("heap", key, value, "custom"));
      }
    }

    // Remaining top-level keys → context (best-effort).
    const knownKeys = new Set([
      "event", "properties", "identity", "user_id", "session_id",
      "app_id", "timestamp", "library", "version", "user_properties", "data",
    ]);
    for (const [key, value] of Object.entries(first)) {
      if (!knownKeys.has(key) && value !== undefined) {
        context.push(makeParam("heap", key, value, "context"));
      }
    }

    return {
      platform: "heap",
      eventName,
      standardParameters: standard,
      customParameters: custom,
      contextParameters: context,
      meta: {
        projectId: typeof first.app_id === "string" ? first.app_id : undefined,
        protocol: "Heap Analytics",
      },
    };
  },
};
