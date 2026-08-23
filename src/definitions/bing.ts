import { define, type ParameterDefinition } from "./types";

export const BING_DOCS =
  "https://learn.microsoft.com/en-us/advertising/guides/universal-event-tracking";

export const BING_DEFINITIONS: ParameterDefinition[] = [
  define("ti", "Tag ID", "The Microsoft Advertising UET tag ID that fired the event.", "context", { type: "id", documentationUrl: BING_DOCS }),
  define("evt", "Event Type", "The type of UET event (e.g. 'page_view', 'custom').", "standard", { documentationUrl: BING_DOCS }),
  define("ea", "Event Action", "The action associated with a custom event.", "standard", { documentationUrl: BING_DOCS }),
  define("ec", "Event Category", "The category of a custom event.", "standard", { documentationUrl: BING_DOCS }),
  define("el", "Event Label", "The label of a custom event.", "standard", { documentationUrl: BING_DOCS }),
  define("ev", "Event Value", "The numeric value of a custom event.", "standard", { type: "number", documentationUrl: BING_DOCS }),
  define("gv", "Goal Value", "The monetary value of the conversion goal.", "standard", { type: "currency", documentationUrl: BING_DOCS }),
  define("gc", "Goal Currency", "The currency of the goal value (3-letter ISO 4217 code).", "standard", { documentationUrl: BING_DOCS }),
  define("msclkid", "Microsoft Click ID", "The click identifier passed in the URL by Microsoft Advertising.", "context", { type: "id", documentationUrl: BING_DOCS }),
  define("mid", "Microsoft ID", "The Microsoft Advertising user identifier.", "context", { type: "id", documentationUrl: BING_DOCS }),
  define("ecomm_pagetype", "Page Type", "The type of page for ecommerce events (e.g. 'home', 'product', 'cart', 'purchase').", "ecommerce", { documentationUrl: BING_DOCS }),
  define("ecomm_prodid", "Product ID", "The product identifier for ecommerce events.", "ecommerce", { type: "id", documentationUrl: BING_DOCS }),
  define("ecomm_totalvalue", "Total Value", "The total monetary value of the ecommerce transaction.", "ecommerce", { type: "currency", documentationUrl: BING_DOCS }),
  define("currency", "Currency", "The currency for ecommerce values (3-letter ISO 4217 code).", "ecommerce", { documentationUrl: BING_DOCS }),
  define("transaction_id", "Transaction ID", "The unique identifier for an ecommerce transaction.", "ecommerce", { type: "id", documentationUrl: BING_DOCS }),
  define("p", "Page URL", "The URL of the page where the event fired.", "context", { type: "url", documentationUrl: BING_DOCS }),
  define("r", "Referrer", "The URL of the referring page.", "context", { type: "url", documentationUrl: BING_DOCS }),
  define("res", "Screen Resolution", "The user's screen resolution (e.g. '1920x1080').", "context", { documentationUrl: BING_DOCS }),
];

export const BING_DEFINITION_MAP = new Map(
  BING_DEFINITIONS.map((d) => [d.name, d])
);
