import { define, type ParameterDefinition, TIKTOK_DOCS } from "./types";

const docs = TIKTOK_DOCS;

/** TikTok Pixel event properties (found inside the `properties` object of the payload). */
export const TIKTOK_DEFINITIONS: ParameterDefinition[] = [
  define("value", "Value", "The monetary value of the event, e.g. 129.90.", "standard", { type: "number", documentationUrl: docs }),
  define("currency", "Currency", "The currency of the value (3-letter ISO 4217 code).", "standard", { type: "currency", documentationUrl: docs }),
  define("contents", "Contents", "A list of products, each with { content_id, content_type, quantity, price }.", "ecommerce", { type: "json", documentationUrl: docs }),
  define("content_id", "Content ID", "The ID of the content or product.", "ecommerce", { type: "id", documentationUrl: docs }),
  define("content_name", "Content Name", "The name of the content or product.", "standard", { documentationUrl: docs }),
  define("content_category", "Content Category", "The category of the content.", "standard", { documentationUrl: docs }),
  define("content_type", "Content Type", "The type of content, e.g. 'product'.", "standard", { documentationUrl: docs }),
  define("quantity", "Quantity", "The quantity of items in the event.", "ecommerce", { type: "number", documentationUrl: docs }),
  define("price", "Price", "The price of a single item.", "ecommerce", { type: "number", documentationUrl: docs }),
  define("description", "Description", "A description of the content.", "standard", { documentationUrl: docs }),
  define("search_string", "Search String", "The search term used by the user.", "standard", { documentationUrl: docs }),
  define("order_id", "Order ID", "A unique identifier for the order/transaction.", "standard", { type: "id", documentationUrl: docs }),
  define("event_id", "Event ID", "A unique identifier for the event, used for deduplication.", "context", { type: "id", documentationUrl: docs }),
  define("event_source", "Event Source", "The source of the event, e.g. 'web'.", "context", { documentationUrl: docs }),
  define("event_trigger", "Event Trigger", "How the event was triggered.", "context", { documentationUrl: docs }),
  define("partner_name", "Partner Name", "The name of the partner sending the event.", "context", { documentationUrl: docs }),
  define("pixel_code", "Pixel Code", "The TikTok Pixel code (e.g. Cxxxxxxxxxxxxxx) that fired the event.", "context", { type: "id", documentationUrl: docs }),
  define("test_event_code", "Test Event Code", "A code that marks events as test events.", "context", { type: "id", documentationUrl: docs }),
  define("advanced_filtering", "Advanced Filtering", "Whether advanced matching/filtering is enabled.", "context", { type: "boolean", documentationUrl: docs }),
  define("timestamp", "Timestamp", "The time the event occurred.", "context", { type: "timestamp", documentationUrl: docs }),
];

/** TikTok user / context fields. */
export const TIKTOK_CONTEXT_DEFINITIONS: ParameterDefinition[] = [
  define("url", "Page URL", "The URL of the page where the event fired.", "context", { type: "url", documentationUrl: docs }),
  define("referrer", "Referrer", "The URL of the referring page.", "context", { type: "url", documentationUrl: docs }),
  define("page_title", "Page Title", "The title of the page where the event fired.", "context", { documentationUrl: docs }),
  define("language", "Language", "The browser language.", "context", { documentationUrl: docs }),
  define("screen_resolution", "Screen Resolution", "The user's screen resolution.", "context", { documentationUrl: docs }),
  define("user_agent", "User Agent", "The user agent of the browser.", "context", { documentationUrl: docs }),
  define("client_ip", "Client IP", "The IP address of the user (server-side events).", "context", { documentationUrl: docs }),
  define("client_user_agent", "Client User Agent", "The user agent of the user (server-side events).", "context", { documentationUrl: docs }),
  define("referrer_url", "Referrer URL", "The referring URL of the user.", "context", { type: "url", documentationUrl: docs }),
  define("page_url", "Page URL", "The URL of the page where the event fired.", "context", { type: "url", documentationUrl: docs }),
  define("anonymous_id", "Anonymous ID", "An anonymous identifier for the user.", "context", { type: "id", documentationUrl: docs }),
  define("external_id", "External ID", "An external identifier for the user.", "context", { type: "id", documentationUrl: docs }),
  define("phone_number", "Phone Number", "A phone number associated with the user.", "context", { documentationUrl: docs }),
  define("email", "Email", "An email address associated with the user.", "context", { documentationUrl: docs }),
];

export const TIKTOK_DEFINITION_MAP = new Map(
  [...TIKTOK_DEFINITIONS, ...TIKTOK_CONTEXT_DEFINITIONS].map((d) => [d.name, d])
);