import { define, type ParameterDefinition } from "./types";

export const HUBSPOT_DOCS =
  "https://developers.hubspot.com/docs/guides/analytics/tracking-implementation";

export const HUBSPOT_DEFINITIONS: ParameterDefinition[] = [
  define("a", "Hub ID", "HubSpot account ID", "context", { type: "id", documentationUrl: HUBSPOT_DOCS }),
  define("vi", "Visitor ID", "HubSpot unique visitor tracking ID", "context", { type: "id", documentationUrl: HUBSPOT_DOCS }),
  define("u", "HubSpot UTK", "Unique user tracking token (cookie)", "context", { type: "id", documentationUrl: HUBSPOT_DOCS }),
  define("k", "Tracking Key", "Specific tracking or action key", "context", { documentationUrl: HUBSPOT_DOCS }),
  define("nc", "New Contact", "Specifies if action represents a new contact", "standard", { type: "boolean", documentationUrl: HUBSPOT_DOCS }),
  define("bfp", "Browser Fingerprint", "Browser features fingerprint hash", "context", { type: "id", documentationUrl: HUBSPOT_DOCS }),
  define("pu", "Page URL", "The URL of the page containing the tracker", "context", { type: "url", documentationUrl: HUBSPOT_DOCS }),
  define("t", "Page Title", "The title of the page containing the tracker", "context", { documentationUrl: HUBSPOT_DOCS }),
  define("r", "Referrer", "Referrer URL page", "context", { type: "url", documentationUrl: HUBSPOT_DOCS }),
  define("sd", "Screen Dimensions", "User screen screen dimension representation", "context", { documentationUrl: HUBSPOT_DOCS }),
  define("cts", "Client Timestamp", "Millisecond timestamp tracking execution", "context", { type: "timestamp", documentationUrl: HUBSPOT_DOCS }),
  define("b", "Identity Data", "Structured identify data", "context", { type: "json", documentationUrl: HUBSPOT_DOCS }),
  define("i", "Identity Info", "Structured identity extra metadata information", "context", { type: "json", documentationUrl: HUBSPOT_DOCS }),
  define("l", "Language", "Locale/language settings of browser", "context", { documentationUrl: HUBSPOT_DOCS }),
  define("cp", "Content", "Content parameters", "context", { documentationUrl: HUBSPOT_DOCS }),
  define("cs", "Source", "Source tracking campaigns context", "context", { documentationUrl: HUBSPOT_DOCS }),
  define("ck", "Keyword", "Search keywords context", "context", { documentationUrl: HUBSPOT_DOCS }),
  define("cc", "Campaign", "Ad/marketing campaign descriptor", "context", { documentationUrl: HUBSPOT_DOCS }),
];

export const HUBSPOT_DEFINITION_MAP = new Map(
  HUBSPOT_DEFINITIONS.map((d) => [d.name, d])
);