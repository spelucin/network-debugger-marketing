import { define, type ParameterDefinition } from "./types";

export const LINKEDIN_DOCS = "https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads-conversions/about-conversions-api";

export const LINKEDIN_DEFINITIONS: ParameterDefinition[] = [
  define("pid", "Partner ID", "LinkedIn Partner/Pixel ID", "context", { type: "id", documentationUrl: LINKEDIN_DOCS }),
  define("conversionId", "Conversion ID", "LinkedIn Conversion Action ID", "standard", { type: "id", documentationUrl: LINKEDIN_DOCS }),
  define("conversion_id", "Conversion ID", "Alternative Conversion ID key", "standard", { type: "id", documentationUrl: LINKEDIN_DOCS }),
  define("li_fat_id", "First-Party Ad Tracking ID", "LinkedIn first-party visitor identifier", "context", { type: "id", documentationUrl: LINKEDIN_DOCS }),
  define("li_sugr", "Suggested User", "Internal LinkedIn user match helper", "context", { documentationUrl: LINKEDIN_DOCS }),
  define("cpuid", "CPU ID", "LinkedIn browser-associated client ID", "context", { documentationUrl: LINKEDIN_DOCS }),
  define("fmt", "Format", "Response format", "context"),
  define("v", "Version", "Pixel version tracking number", "context"),
  define("time", "Timestamp", "Client click/view timestamp", "context", { type: "timestamp" }),
  define("bs", "Browser Signal", "Client-side telemetry signal", "context"),
  define("csid", "Client Session ID", "Client session tracker identifier", "context", { type: "id" }),
];

export const LINKEDIN_DEFINITION_MAP = new Map(
  LINKEDIN_DEFINITIONS.map((d) => [d.name, d])
);
