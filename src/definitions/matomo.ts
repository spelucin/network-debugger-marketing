import { define, type ParameterDefinition } from "./types";

export const MATOMO_DOCS = "https://developer.matomo.org/api-reference/tracking-api";

export const MATOMO_DEFINITIONS: ParameterDefinition[] = [
  define("idsite", "Site ID", "The unique website ID assigned to your Matomo property.", "context", { type: "id", documentationUrl: MATOMO_DOCS }),
  define("_id", "Visitor ID", "A unique visitor identifier (MD5 hash).", "context", { type: "id", documentationUrl: MATOMO_DOCS }),
  define("uid", "User ID", "An authenticated user identifier for cross-device tracking.", "context", { type: "id", documentationUrl: MATOMO_DOCS }),
  define("e_c", "Event Category", "The event category (e.g. 'Video', 'Feedback').", "standard", { documentationUrl: MATOMO_DOCS }),
  define("e_a", "Event Action", "The event action (e.g. 'Play', 'Submit').", "standard", { documentationUrl: MATOMO_DOCS }),
  define("e_n", "Event Name", "The event name.", "standard", { documentationUrl: MATOMO_DOCS }),
  define("e_v", "Event Value", "The numeric value of the event.", "standard", { type: "number", documentationUrl: MATOMO_DOCS }),
  define("revenue", "Revenue", "The goal or ecommerce revenue amount.", "ecommerce", { type: "currency", documentationUrl: MATOMO_DOCS }),
  define("ec_id", "Ecommerce Order ID", "The unique order ID for an ecommerce transaction.", "ecommerce", { type: "id", documentationUrl: MATOMO_DOCS }),
  define("ec_items", "Ecommerce Items", "JSON array of items, each as [sku, name, category, price, quantity].", "ecommerce", { type: "json", documentationUrl: MATOMO_DOCS }),
  define("action_name", "Action Name", "A custom name for the tracked action (e.g. page title).", "standard", { documentationUrl: MATOMO_DOCS }),
  define("url", "Page URL", "The URL of the page being tracked.", "context", { type: "url", documentationUrl: MATOMO_DOCS }),
  define("urlref", "Referrer URL", "The URL of the referring page.", "context", { type: "url", documentationUrl: MATOMO_DOCS }),
  define("ua", "User Agent", "The browser's user agent string.", "context", { documentationUrl: MATOMO_DOCS }),
  define("lang", "Language", "The browser language code.", "context", { documentationUrl: MATOMO_DOCS }),
  define("res", "Screen Resolution", "The screen resolution (e.g. '1920x1080').", "context", { documentationUrl: MATOMO_DOCS }),
  define("date", "Date", "The date of the visit (YYYY-MM-DD format).", "context", { documentationUrl: MATOMO_DOCS }),
  define("time", "Time", "The time of the visit (HH:MM format).", "context", { documentationUrl: MATOMO_DOCS }),
  define("_cvar", "Custom Variables", "JSON-encoded custom variables for the visit.", "custom", { type: "json", documentationUrl: MATOMO_DOCS }),
  define("idgoal", "Goal ID", "The ID of the goal that was triggered.", "standard", { type: "id", documentationUrl: MATOMO_DOCS }),
  define("c_n", "Content Name", "The name of the content being tracked.", "standard", { documentationUrl: MATOMO_DOCS }),
  define("c_p", "Content Piece", "The content piece (e.g. article title or video URL).", "standard", { documentationUrl: MATOMO_DOCS }),
  define("c_t", "Content Target", "The target URL the content links to.", "standard", { documentationUrl: MATOMO_DOCS }),
  define("c_i", "Content Interaction", "The interaction type (e.g. 'click').", "standard", { documentationUrl: MATOMO_DOCS }),
];

export const MATOMO_DEFINITION_MAP = new Map(
  MATOMO_DEFINITIONS.map((d) => [d.name, d])
);
