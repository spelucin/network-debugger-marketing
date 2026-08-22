import { define, type ParameterDefinition, GOOGLE_ADS_DOCS } from "./types";

const docs = GOOGLE_ADS_DOCS;

/** Google Ads conversion / remarketing parameters seen on pagead endpoints. */
export const GOOGLE_ADS_DEFINITIONS: ParameterDefinition[] = [
  define("aw_id", "Conversion ID", "The Google Ads conversion ID, in the form AW-XXXXXXXXX.", "context", { type: "id", documentationUrl: docs }),
  define("aw_c", "Conversion Action", "The conversion action identifier associated with the ping.", "context", { type: "id", documentationUrl: docs }),
  define("aw_f", "Conversion Action Config", "Configuration bits for the conversion action.", "context", { documentationUrl: docs }),
  define("aw_rem", "Remarketing Flag", "Whether the conversion tag is also remarketing-enabled.", "context", { type: "boolean", documentationUrl: docs }),
  define("cv", "Conversion Value", "The value of the conversion as declared on the tag.", "standard", { type: "number", documentationUrl: docs }),
  define("cnv", "Conversion Number", "An internal conversion identifier.", "context", { type: "number", documentationUrl: docs }),
  define("data", "Data Payload", "JSON payload carrying conversion metadata (AW ID, label, etc.).", "standard", { type: "json", documentationUrl: docs }),
  define("gclid", "Google Click ID", "The Google Ads click identifier associated with the conversion.", "context", { type: "id", documentationUrl: "https://support.google.com/google-ads/answer/9744275" }),
  define("gclsrc", "Google Click Source", "Indicates the click source; 'aw.ds' means Google Ads.", "context", { documentationUrl: docs }),
  define("wbraid", "Web Click ID", "The Google Ads web click identifier.", "context", { type: "id", documentationUrl: docs }),
  define("gbraid", "iOS Click ID", "The Google Ads iOS click identifier.", "context", { type: "id", documentationUrl: docs }),
  define("dclid", "Display Click ID", "The Google Marketing Platform display click identifier.", "context", { type: "id", documentationUrl: docs }),
  define("dclsrc", "Display Click Source", "Source of the display click.", "context", { documentationUrl: docs }),
  define("type", "Type", "The type of conversion tag.", "context", { documentationUrl: docs }),
  define("label", "Conversion Label", "The conversion label of the tag.", "context", { type: "id", documentationUrl: docs }),
  define("ea", "Event Action", "The event action associated with the conversion.", "standard", { documentationUrl: docs }),
  define("el", "Event Label", "The event label associated with the conversion.", "standard", { documentationUrl: docs }),
  define("e", "Event", "An event identifier associated with the conversion.", "context", { documentationUrl: docs }),
  define("sf", "Site Flag", "An internal site flag.", "context", { documentationUrl: docs }),
  define("are", "Account Remarketing", "Remarketing configuration flags for the account.", "context", { documentationUrl: docs }),
  define("q", "Query", "The search query associated with the conversion.", "standard", { documentationUrl: docs }),
  define("em", "Email", "Hashed email parameter for enhanced conversions.", "context", { documentationUrl: "https://support.google.com/google-ads/answer/9888656" }),
  define("fb", "First Name", "Hashed first-name parameter for enhanced conversions.", "context", { documentationUrl: "https://support.google.com/google-ads/answer/9888656" }),
  define("ln", "Last Name", "Hashed last-name parameter for enhanced conversions.", "context", { documentationUrl: "https://support.google.com/google-ads/answer/9888656" }),
  define("u", "Universal", "An internal universal parameter.", "context", { documentationUrl: docs }),
  define("w", "Width", "The viewport width.", "context", { documentationUrl: docs }),
  define("t", "Time", "An internal timestamp parameter.", "context", { type: "timestamp", documentationUrl: docs }),
  define("l", "Language", "The browser language.", "context", { documentationUrl: docs }),
  define("c", "Category", "An internal category parameter.", "context", { documentationUrl: docs }),
  define("o", "Origin", "An internal origin flag.", "context", { documentationUrl: docs }),
];

export const GOOGLE_ADS_DEFINITION_MAP = new Map(
  GOOGLE_ADS_DEFINITIONS.map((d) => [d.name, d])
);