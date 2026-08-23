import { define, type ParameterDefinition } from "./types";

export const PINTEREST_DOCS = "https://developers.pinterest.com/docs/pinterest-tags/";

export const PINTEREST_DEFINITIONS: ParameterDefinition[] = [
  define("event", "Event Name", "The event name fired by the Pinterest tag (e.g. pagevisit, signup, checkout).", "standard", { documentationUrl: PINTEREST_DOCS }),
  define("tid", "Tag ID", "The Pinterest Tag ID that fired this event.", "context", { type: "id", documentationUrl: PINTEREST_DOCS }),
  define("ed[value]", "Value", "The monetary value of the event.", "ecommerce", { type: "currency", documentationUrl: PINTEREST_DOCS }),
  define("ed[currency]", "Currency", "The currency of the value (3-letter ISO 4217 code).", "ecommerce", { type: "currency", documentationUrl: PINTEREST_DOCS }),
  define("ed[order_quantity]", "Order Quantity", "The quantity of items in the order.", "ecommerce", { type: "number", documentationUrl: PINTEREST_DOCS }),
  define("pd[em]", "Email Hash", "A SHA-256 hashed email address for enhanced matching.", "context", { documentationUrl: PINTEREST_DOCS }),
  define("pd[fn]", "First Name Hash", "A SHA-256 hashed first name for enhanced matching.", "context", { documentationUrl: PINTEREST_DOCS }),
  define("pd[ln]", "Last Name Hash", "A SHA-256 hashed last name for enhanced matching.", "context", { documentationUrl: PINTEREST_DOCS }),
  define("cb", "Cache Buster", "A random value to prevent caching of the tracking pixel.", "context", { documentationUrl: PINTEREST_DOCS }),
  define("v", "API Version", "The Pinterest Tag API version.", "context", { documentationUrl: PINTEREST_DOCS }),
];

export const PINTEREST_DEFINITION_MAP = new Map(
  PINTEREST_DEFINITIONS.map((d) => [d.name, d])
);
