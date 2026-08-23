import { define } from "./types";
import type { ParameterDefinition } from "./types";

export const AMPLITUDE_DOCS =
  "https://www.docs.developers.amplitude.com/data/sdks/http-api-v2/";

export const AMPLITUDE_DEFINITIONS: ParameterDefinition[] = [
  define("event_type", "Event Type", "", "standard"),
  define("user_id", "User ID", "", "context", { type: "id" }),
  define("device_id", "Device ID", "", "context", { type: "id" }),
  define("session_id", "Session ID", "", "context", { type: "id" }),
  define("api_key", "API Key", "", "context", { type: "id" }),
  define("timestamp", "Timestamp", "", "context", { type: "timestamp" }),
  define("event_properties", "Event Properties", "", "custom", { type: "json" }),
  define("user_properties", "User Properties", "", "context", { type: "json" }),
  define("os_name", "OS Name", "", "context"),
  define("os_version", "OS Version", "", "context"),
  define("device_brand", "Device Brand", "", "context"),
  define("device_model", "Device Model", "", "context"),
  define("country", "Country", "", "context"),
  define("region", "Region", "", "context"),
  define("city", "City", "", "context"),
  define("language", "Language", "", "context"),
  define("platform", "Platform", "", "context"),
  define("version_name", "App Version", "", "context"),
  define("library", "SDK Library", "", "context"),
];

export const AMPLITUDE_DEFINITION_MAP = new Map(
  AMPLITUDE_DEFINITIONS.map((d) => [d.name, d])
);
