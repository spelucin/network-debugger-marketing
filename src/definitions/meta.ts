import { define, type ParameterDefinition, META_DOCS } from "./types";

const docs = META_DOCS;

/** Meta Pixel parameters. Event data arrives as `cd[...]`, user data as `ud[...]`. */
export const META_DEFINITIONS: ParameterDefinition[] = [
  define("value", "Value", "The monetary value of the event, e.g. 129.90.", "standard", { type: "number", documentationUrl: docs }),
  define("currency", "Currency", "The currency of the value (3-letter ISO 4217 code).", "standard", { type: "currency", documentationUrl: docs }),
  define("content_name", "Content Name", "The name of the page or product.", "standard", { documentationUrl: docs }),
  define("content_type", "Content Type", "The type of content, e.g. 'product'.", "standard", { documentationUrl: docs }),
  define("content_ids", "Content IDs", "A list of product or content IDs.", "standard", { type: "json", documentationUrl: docs }),
  define("content_id", "Content ID", "A single product or content ID.", "standard", { type: "id", documentationUrl: docs }),
  define("contents", "Contents", "A list of products, each with { id, quantity, item_price }.", "ecommerce", { type: "json", documentationUrl: docs }),
  define("num_items", "Number of Items", "The number of items in the event.", "ecommerce", { type: "number", documentationUrl: docs }),
  define("content_category", "Content Category", "The category of the content.", "standard", { documentationUrl: docs }),
  define("content_group", "Content Group", "The group of the content.", "standard", { documentationUrl: docs }),
  define("search_string", "Search String", "The search term used by the user.", "standard", { documentationUrl: docs }),
  define("status", "Status", "The status of the event, e.g. 'completed' for a lead.", "standard", { documentationUrl: docs }),
  define("order_id", "Order ID", "The unique order identifier of the transaction.", "standard", { type: "id", documentationUrl: docs }),
  define("item_id", "Item ID", "The ID of the item involved in the event.", "ecommerce", { type: "id", documentationUrl: docs }),
  define("item_name", "Item Name", "The name of the item.", "ecommerce", { documentationUrl: docs }),
  define("item_price", "Item Price", "The price of the item.", "ecommerce", { type: "number", documentationUrl: docs }),
  define("item_quantity", "Item Quantity", "The quantity of the item.", "ecommerce", { type: "number", documentationUrl: docs }),
  define("quantity", "Quantity", "The quantity involved in the event.", "ecommerce", { type: "number", documentationUrl: docs }),
  define("category", "Category", "The category of the item or content.", "ecommerce", { documentationUrl: docs }),
  define("initiate_checkout", "Initiate Checkout", "Whether the event initiated a checkout.", "standard", { type: "boolean", documentationUrl: docs }),
  define("predicted_ltv", "Predicted LTV", "The predicted lifetime value of the user.", "standard", { type: "number", documentationUrl: docs }),
  define("signup_method", "Signup Method", "The method used to sign up.", "standard", { documentationUrl: docs }),
  define("registration_method", "Registration Method", "The method used to register.", "standard", { documentationUrl: docs }),
  define("em", "Email", "Email address (hashed or plaintext) used as user data.", "context", { documentationUrl: docs }),
  define("ph", "Phone", "Phone number (hashed or plaintext) used as user data.", "context", { documentationUrl: docs }),
  define("fn", "First Name", "First name used as user data.", "context", { documentationUrl: docs }),
  define("ln", "Last Name", "Last name used as user data.", "context", { documentationUrl: docs }),
  define("external_id", "External ID", "An external identifier for the user.", "context", { type: "id", documentationUrl: docs }),
  define("_fbp", "Browser Pixel Cookie", "The _fbp cookie value identifying the browser.", "context", { type: "id", documentationUrl: docs }),
  define("_fbc", "Browser Click Cookie", "The _fbc cookie value identifying the click that led to the page.", "context", { type: "id", documentationUrl: docs }),
  define("fbclid", "Facebook Click ID", "The click identifier passed in the URL by Meta.", "context", { type: "id", documentationUrl: docs }),
  define("state", "State", "The state associated with the event.", "context", { documentationUrl: docs }),
  define("country", "Country", "The country associated with the event.", "context", { documentationUrl: docs }),
  define("ct", "City", "The city associated with the event.", "context", { documentationUrl: docs }),
  define("zp", "Zip", "The postal code associated with the event.", "context", { documentationUrl: docs }),
];

/** Top-level Meta Pixel transport parameters. */
export const META_TRANSPORT_DEFINITIONS: ParameterDefinition[] = [
  define("id", "Pixel ID", "The Meta Pixel ID that fired the event.", "context", { type: "id", documentationUrl: docs }),
  define("ev", "Event Name", "The name of the Meta Pixel event.", "context", { documentationUrl: docs }),
  define("dl", "Document Location", "The URL of the page where the event fired.", "context", { type: "url", documentationUrl: docs }),
  define("rl", "Referrer", "The URL of the referring page.", "context", { type: "url", documentationUrl: docs }),
  define("ts", "Timestamp", "The Unix timestamp of the event.", "context", { type: "timestamp", documentationUrl: docs }),
  define("sw", "Screen Width", "The user's screen width in pixels.", "context", { type: "number", documentationUrl: docs }),
  define("sh", "Screen Height", "The user's screen height in pixels.", "context", { type: "number", documentationUrl: docs }),
  define("if", "In Iframe", "Whether the page is rendered inside an iframe.", "context", { type: "boolean", documentationUrl: docs }),
  define("v", "Pixel Version", "The version of the Meta Pixel SDK.", "context", { documentationUrl: docs }),
  define("r", "Release Channel", "The release channel of the pixel SDK.", "context", { documentationUrl: docs }),
  define("a", "Agent", "An agent identifier used by the pixel.", "context", { documentationUrl: docs }),
  define("eid", "Event ID", "A unique identifier for the event, used for deduplication with the Conversions API.", "context", { type: "id", documentationUrl: "https://developers.facebook.com/docs/meta-pixel/implementation/server-side" }),
  define("ec", "Event Count", "A per-page counter of events fired.", "context", { type: "number" }),
  define("tt", "Tracking Type", "The tracking type of the request.", "context", { documentationUrl: docs }),
  define("dbg", "Debug", "Whether the request is in debug mode.", "context", { type: "boolean", documentationUrl: docs }),
  define("cd", "Custom Data", "Container for event-specific data parameters.", "context", { documentationUrl: docs }),
  define("ud", "User Data", "Container for user data parameters (email, phone, etc.).", "context", { documentationUrl: docs }),
];

export const META_DEFINITION_MAP = new Map(
  [...META_DEFINITIONS, ...META_TRANSPORT_DEFINITIONS].map((d) => [d.name, d])
);