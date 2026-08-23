import type { DecodedEvent, Parameter, RawRequest } from "../../core/types";
import { isPlainObject, tryJsonParse } from "../../core/url";
import type { MarketingParser } from "../types";
import { makeParam } from "../types";

export const AmplitudeParser: MarketingParser = {
  id: "amplitude",
  platform: "amplitude",

  canParse: (req: RawRequest): boolean => {
    try {
      const url = new URL(req.url);
      return url.hostname === "api.amplitude.com";
    } catch {
      return false;
    }
  },

  parse: (req: RawRequest): DecodedEvent => {
    const url = new URL(req.url);
    const apiKey =
      url.searchParams.get("api_key") ||
      url.searchParams.get("apikey") ||
      "";

    let events: any[] = [];

    // 1. JSON body with events array and api_key
    if (req.body) {
      const parsed = typeof req.body === "string" ? tryJsonParse(req.body) : req.body;

      if (Array.isArray(parsed)) {
        events = parsed;
      } else if (isPlainObject(parsed)) {
        if (Array.isArray(parsed.events)) {
          events = parsed.events;
        } else if (parsed.e && typeof parsed.e === "string") {
          const inner = tryJsonParse(parsed.e);
          if (Array.isArray(inner)) events = inner;
        } else if (parsed.events && typeof parsed.events === "string") {
          const inner = tryJsonParse(parsed.events);
          if (Array.isArray(inner)) events = inner;
        }
      }
    }

    // 2. URL-encoded form data with e/events param
    if (events.length === 0 && req.body && typeof req.body === "string") {
      const params = new URLSearchParams(req.body);
      const eParam = params.get("e") || params.get("events");
      if (eParam) {
        const inner = tryJsonParse(eParam);
        if (Array.isArray(inner)) events = inner;
      }
    }

    // 3. URL query params with e/events param
    if (events.length === 0) {
      const eParam = url.searchParams.get("e") || url.searchParams.get("events");
      if (eParam) {
        const inner = tryJsonParse(eParam);
        if (Array.isArray(inner)) events = inner;
      }
    }

    const event = events.length > 0 ? events[0] : {};
    const eventProps = isPlainObject(event.event_properties) ? event.event_properties : {};
    const userProps = isPlainObject(event.user_properties) ? event.user_properties : {};

    const standard: Parameter[] = [];
    const custom: Parameter[] = [];
    const context: Parameter[] = [];

    standard.push(makeParam("amplitude", "event_type", event.event_type ?? "Unknown", "standard"));
    context.push(makeParam("amplitude", "user_id", event.user_id, "context", "id"));
    context.push(makeParam("amplitude", "device_id", event.device_id, "context", "id"));
    context.push(makeParam("amplitude", "session_id", event.session_id, "context", "id"));
    context.push(makeParam("amplitude", "timestamp", event.timestamp ?? event.time, "context", "timestamp"));

    for (const [key, value] of Object.entries(eventProps)) {
      custom.push(makeParam("amplitude", key, value, "custom"));
    }

    const contextKeys = [
      "os_name", "os_version", "device_brand", "device_model",
      "country", "region", "city", "language",
      "platform", "version_name", "library",
    ];

    for (const key of contextKeys) {
      if (key in userProps) {
        context.push(makeParam("amplitude", key, userProps[key], "context"));
      }
      if (key in event) {
        context.push(makeParam("amplitude", key, event[key], "context"));
      }
    }

    return {
      eventName: event.event_type ?? "Unknown",
      platform: "amplitude",
      standardParameters: standard,
      customParameters: custom,
      contextParameters: context,
      meta: {
        apiKey,
        projectId: apiKey,
        protocol: "Amplitude",
      },
    };
  },
};
