import { define, type ParameterDefinition } from "./types";

export const UA_DOCS =
  "https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters";

/** Universal Analytics Measurement Protocol v1 parameters. */
export const UA_DEFINITIONS: ParameterDefinition[] = [
  // ── Hit / payload core ─────────────────────────────────────────────────────
  define("v", "Protocol Version", "Protocol version. Always 1 for Universal Analytics.", "context", { documentationUrl: UA_DOCS }),
  define("tid", "Tracking ID", "The UA property identifier, e.g. UA-XXXXXX-Y.", "standard", { type: "id", documentationUrl: UA_DOCS }),
  define("cid", "Client ID", "Anonymous client identifier (a UUID, first set by the _ga cookie).", "context", { type: "id", documentationUrl: UA_DOCS }),
  define("uid", "User ID", "A persistent identifier for a logged-in user, set via set().", "standard", { type: "id", documentationUrl: UA_DOCS }),
  define("t", "Hit Type", "The type of hit: pageview, screenview, event, transaction, item, social, exception or timing.", "standard", { documentationUrl: UA_DOCS }),
  define("ni", "Non-Interaction Hit", "When 1, the event does not affect the bounce rate.", "standard", { type: "boolean", documentationUrl: UA_DOCS }),

  // ── Event hits ─────────────────────────────────────────────────────────────
  define("ec", "Event Category", "Category of the event, e.g. 'Videos'.", "standard", { documentationUrl: UA_DOCS }),
  define("ea", "Event Action", "Action of the event, e.g. 'Play'.", "standard", { documentationUrl: UA_DOCS }),
  define("el", "Event Label", "Optional label describing the event.", "standard", { documentationUrl: UA_DOCS }),
  define("ev", "Event Value", "Optional numeric value associated with the event.", "standard", { type: "number", documentationUrl: UA_DOCS }),

  // ── Ecommerce ──────────────────────────────────────────────────────────────
  define("ti", "Transaction ID", "Unique transaction identifier for the order.", "standard", { type: "id", documentationUrl: UA_DOCS }),
  define("tr", "Transaction Revenue", "Total revenue of the transaction, including shipping and tax.", "standard", { type: "number", documentationUrl: UA_DOCS }),
  define("ts", "Transaction Shipping", "Shipping cost of the transaction.", "standard", { type: "number", documentationUrl: UA_DOCS }),
  define("tt", "Transaction Tax", "Tax cost of the transaction.", "standard", { type: "number", documentationUrl: UA_DOCS }),
  define("ta", "Transaction Affiliation", "Store or affiliation of the transaction.", "standard", { documentationUrl: UA_DOCS }),
  define("cu", "Currency Code", "Currency of the transaction, as an ISO 4217 code.", "standard", { type: "currency", documentationUrl: UA_DOCS }),
  define("in", "Item Name", "Name of the item in the order.", "ecommerce", { documentationUrl: UA_DOCS }),
  define("ip", "Item Price", "Price of the item.", "ecommerce", { type: "number", documentationUrl: UA_DOCS }),
  define("iq", "Item Quantity", "Quantity of the item.", "ecommerce", { type: "number", documentationUrl: UA_DOCS }),
  define("ic", "Item Code", "SKU / code of the item.", "ecommerce", { type: "id", documentationUrl: UA_DOCS }),
  define("iv", "Item Category", "Category of the item.", "ecommerce", { documentationUrl: UA_DOCS }),

  // ── Social / timing / exception ────────────────────────────────────────────
  define("sn", "Social Network", "Network the social action occurred on, e.g. Facebook.", "standard", { documentationUrl: UA_DOCS }),
  define("sa", "Social Action", "The social action, e.g. Like or Share.", "standard", { documentationUrl: UA_DOCS }),
  define("st", "Social Target", "Target of the social action, e.g. a shared URL.", "standard", { type: "url", documentationUrl: UA_DOCS }),
  define("utc", "Timing Category", "Category of the user timing hit.", "standard", { documentationUrl: UA_DOCS }),
  define("utv", "Timing Variable", "Name of the user timing variable.", "standard", { documentationUrl: UA_DOCS }),
  define("utt", "Timing Value", "Elapsed time of the user timing hit, in milliseconds.", "standard", { type: "number", documentationUrl: UA_DOCS }),
  define("utl", "Timing Label", "Label of the user timing hit.", "standard", { documentationUrl: UA_DOCS }),
  define("exd", "Exception Description", "Description of the exception.", "standard", { documentationUrl: UA_DOCS }),
  define("exf", "Exception Fatal?", "Whether the exception was fatal (1) or not (0).", "standard", { type: "boolean", documentationUrl: UA_DOCS }),

  // ── Session / traffic attribution ──────────────────────────────────────────
  define("cs", "Campaign Source", "Traffic source of the campaign, e.g. google.", "context", { documentationUrl: UA_DOCS }),
  define("cm", "Campaign Medium", "Medium of the campaign, e.g. cpc.", "context", { documentationUrl: UA_DOCS }),
  define("cn", "Campaign Name", "Name of the campaign.", "context", { documentationUrl: UA_DOCS }),
  define("ck", "Campaign Keyword", "Keyword of the campaign.", "context", { documentationUrl: UA_DOCS }),
  define("cc", "Campaign Content", "Content variant of the campaign (A/B testing).", "context", { documentationUrl: UA_DOCS }),
  define("gclid", "Google Click ID", "Google Ads click identifier.", "context", { type: "id" }),
  define("dclid", "Display Click ID", "Google Marketing Platform display click identifier.", "context", { type: "id" }),
  define("_s", "Session Hit Count", "Ordinal of this hit within the session (analytics.js).", "context", { type: "number" }),

  // ── Content / environment ──────────────────────────────────────────────────
  define("dl", "Page URL", "Full URL of the page the hit was sent from.", "context", { type: "url", documentationUrl: UA_DOCS }),
  define("dh", "Page Hostname", "Hostname of the page.", "context", { type: "url", documentationUrl: UA_DOCS }),
  define("dp", "Page Path", "Path portion of the page URL.", "context", { type: "url", documentationUrl: UA_DOCS }),
  define("dt", "Page Title", "Title of the page.", "context", { documentationUrl: UA_DOCS }),
  define("dr", "Referrer", "Referring URL that brought the user to the page.", "context", { type: "url", documentationUrl: UA_DOCS }),
  define("ul", "Language", "The user's browser language, e.g. es-419.", "context", { documentationUrl: UA_DOCS }),
  define("sr", "Screen Resolution", "Screen resolution, e.g. 1376x975.", "context", { documentationUrl: UA_DOCS }),
  define("sd", "Screen Colors", "Screen color depth in bits, e.g. 24.", "context", { documentationUrl: UA_DOCS }),
  define("vp", "Viewport Size", "Visible area of the browser, e.g. 1376x975.", "context", { documentationUrl: UA_DOCS }),
  define("je", "Java Enabled", "Whether Java was enabled (1) or not (0).", "context", { type: "boolean", documentationUrl: UA_DOCS }),
  define("fl", "Flash Version", "Flash version of the browser (legacy).", "context", { documentationUrl: UA_DOCS }),
  define("geoid", "Geo ID", "Google-defined geographic identifier for the user.", "context", { type: "id" }),

  // ── Library / transport plumbing ───────────────────────────────────────────
  define("_v", "Library Version", "Version of the tracking library, e.g. j102 (analytics.js).", "context", { documentationUrl: UA_DOCS }),
  define("_u", "Client Hint Blob", "Opaque analytics.js client-state blob.", "context"),
  define("_gid", "GA Session Cookie", "Value of the short-lived _gid cookie.", "context", { type: "id" }),
  define("a", "Cache Parameter", "Legacy cache-busting parameter from utm.gif days.", "context", { type: "number" }),
  define("z", "Cache Buster", "Random value ensuring the hit is not cached.", "context", { type: "number" }),
  define("jid", "Join ID", "Random id joining this hit to a batch (used by GTM).", "context", { type: "id" }),
  define("gjid", "GA Join ID", "Random id joining this hit to a gtag batch.", "context", { type: "id" }),
  define("gtm", "GTM Container", "GTM container version that sent the hit, e.g. 45He68…", "context", { type: "id" }),
  define("gcd", "Consent State", "Encoded consent-mode state of the hit.", "context"),
  define("dma", "DMA Token", "Consent-mode token for ad personalization signals.", "context"),
  define("tag_exp", "Experiment Bucket", "Internal experiment / rollout bucketing.", "context"),
  define("uaa", "User Agent Architecture", "High-entropy user-agent architecture hints.", "context"),
  define("uab", "User Agent Bitness", "High-entropy user-agent bitness hint.", "context"),
  define("uafvl", "User Agent Full Version List", "High-entropy user-agent brand versions.", "context"),
  define("uamb", "User Agent Mobile?", "Whether the user agent reports a mobile device.", "context", { type: "boolean" }),
  define("uam", "User Agent Model", "High-entropy user-agent model hint.", "context"),
  define("uap", "User Agent Platform", "High-entropy user-agent platform hint.", "context"),
  define("uapv", "User Agent Platform Version", "High-entropy user-agent platform version.", "context"),
  define("uaw", "User Agent Wow64", "Whether the user agent reports Wow64.", "context", { type: "boolean" }),
];

export const UA_DEFINITION_MAP = new Map(UA_DEFINITIONS.map((d) => [d.name, d]));
