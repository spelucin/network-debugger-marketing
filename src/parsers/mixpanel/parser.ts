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

function base64Decode(input: string): string | undefined {
  try {
    return atob(input);
  } catch {
    return undefined;
  }
}

function tryExtractJsonFromData(raw: string): unknown[] | undefined {
  const decoded = base64Decode(raw);
  if (!decoded) return undefined;
  const parsed = tryJsonParse(decoded);
  if (Array.isArray(parsed)) return parsed;
  if (isPlainObject(parsed)) return [parsed];
  return undefined;
}

function extractEventsFromRequest(
  request: RawRequest
): { event: Record<string, unknown>; eventName: string }[] {
  const q = request.queryParams;
  const results: { event: Record<string, unknown>; eventName: string }[] = [];

  // 1. Try URL query `data` param → base64 decode → JSON parse
  const dataParam = stringValue(q.data);
  if (dataParam) {
    const events = tryExtractJsonFromData(dataParam);
    if (events) {
      for (const ev of events) {
        if (isPlainObject(ev)) {
          results.push({
            event: ev as Record<string, unknown>,
            eventName: (ev.event as string) || "unknown",
          });
        }
      }
      if (results.length > 0) return results;
    }
  }

  // 2. Try POST body JSON with `data` field → base64 decode
  if (isPlainObject(request.body) && typeof request.body.data === "string") {
    const events = tryExtractJsonFromData(request.body.data);
    if (events) {
      for (const ev of events) {
        if (isPlainObject(ev)) {
          results.push({
            event: ev as Record<string, unknown>,
            eventName: (ev.event as string) || "unknown",
          });
        }
      }
      if (results.length > 0) return results;
    }
  }

  // 3. Try POST body as direct JSON array
  if (Array.isArray(request.body)) {
    for (const ev of request.body) {
      if (isPlainObject(ev)) {
        results.push({
          event: ev as Record<string, unknown>,
          eventName: (ev.event as string) || "unknown",
        });
      }
    }
    if (results.length > 0) return results;
  }

  // 4. Try URL-encoded form with `data` field (already in queryParams)
  // Covered by step 1 since queryParams parses URL-encoded bodies too.

  return results;
}

export const MixpanelParser: MarketingParser = {
  id: "mixpanel",
  platform: "mixpanel",

  canParse(request: RawRequest): boolean {
    const url = safeUrl(request.url);
    if (!url) return false;
    const host = url.hostname;
    return host === "mixpanel.com" || host.endsWith(".mixpanel.com");
  },

  parse(request: RawRequest): DecodedEvent {
    const extracted = extractEventsFromRequest(request);

    if (extracted.length === 0) {
      return {
        platform: "mixpanel",
        eventName: "unknown",
        standardParameters: [],
        customParameters: [],
        contextParameters: [],
        meta: {
          protocol: "Mixpanel",
        },
      };
    }

    // Parse the first event (Mixpanel batches; each batch is an array)
    const { event, eventName } = extracted[0]!;
    const props = isPlainObject(event.properties)
      ? (event.properties as Record<string, unknown>)
      : {};

    const token =
      typeof props.token === "string" ? props.token : undefined;

    const standard: Parameter[] = [
      makeParam("mixpanel", "event", eventName, "standard"),
    ];

    const context: Parameter[] = [];
    const custom: Parameter[] = [];

    // Well-known context fields
    const contextKeys = [
      "distinct_id",
      "device_id",
      "session_id",
      "time",
      "mp_lib",
      "mp_version",
      "initial_referrer",
      "referrer",
      "referring_domain",
      "screen_height",
      "screen_width",
      "browser",
      "browser_version",
      "os",
      "os_version",
    ];

    for (const key of contextKeys) {
      if (key in props) {
        context.push(makeParam("mixpanel", key, props[key], "context"));
      }
    }

    // Token → context
    if (token) {
      context.push(makeParam("mixpanel", "token", token, "context"));
    }

    // All other properties → custom params
    const skipKeys = new Set([...contextKeys, "token"]);
    for (const [key, value] of Object.entries(props)) {
      if (skipKeys.has(key)) continue;
      custom.push(makeParam("mixpanel", key, value, "custom"));
    }

    // Remaining top-level fields → context
    for (const [key, value] of Object.entries(event)) {
      if (key === "event" || key === "properties") continue;
      context.push(makeParam("mixpanel", key, value, "context"));
    }

    return {
      platform: "mixpanel",
      eventName,
      standardParameters: standard,
      customParameters: custom,
      contextParameters: context,
      meta: {
        token,
        projectId: token,
        measurementId: token,
        protocol: "Mixpanel",
      },
    };
  },
};
