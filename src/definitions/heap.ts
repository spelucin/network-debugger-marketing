import { define, type ParameterDefinition } from "./types";

export const HEAP_DOCS = "https://developers.heap.io/reference";

export const HEAP_DEFINITIONS: ParameterDefinition[] = [
  define("event", "Event Name", "The name of the Heap event.", "standard", { documentationUrl: HEAP_DOCS }),
  define("identity", "User Identity", "The anonymous or identified user identity string.", "context", { type: "id", documentationUrl: HEAP_DOCS }),
  define("user_id", "User ID", "A unique identifier for the user.", "context", { type: "id", documentationUrl: HEAP_DOCS }),
  define("session_id", "Session ID", "The Heap session identifier.", "context", { type: "id", documentationUrl: HEAP_DOCS }),
  define("app_id", "App ID", "The Heap app / environment identifier.", "context", { type: "id", documentationUrl: HEAP_DOCS }),
  define("timestamp", "Timestamp", "The timestamp of the event (epoch ms or ISO 8601).", "context", { type: "timestamp", documentationUrl: HEAP_DOCS }),
  define("properties", "Event Properties", "Custom properties attached to the event.", "custom", { type: "json", documentationUrl: HEAP_DOCS }),
  define("user_properties", "User Properties", "Properties set on the user via identify or add_user_properties.", "context", { type: "json", documentationUrl: HEAP_DOCS }),
  define("library", "SDK Library", "The client library used to send the event (e.g. 'js').", "context", { documentationUrl: HEAP_DOCS }),
  define("version", "SDK Version", "The version of the Heap SDK.", "context", { documentationUrl: HEAP_DOCS }),
];

export const HEAP_DEFINITION_MAP = new Map(HEAP_DEFINITIONS.map((d) => [d.name, d]));
