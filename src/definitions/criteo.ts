import { define, type ParameterDefinition } from "./types";

export const CRITEO_DOCS = "https://documentation.criteo.com/en/ad-tags/onetag";

export const CRITEO_DEFINITIONS: ParameterDefinition[] = [
  define("e", "Event Type", "The type of tracking event", "standard", { documentationUrl: CRITEO_DOCS }),
  define("a", "Account ID", "Criteo advertiser account identifier", "context", { type: "id", documentationUrl: CRITEO_DOCS }),
  define("item", "Product Items", "Structured array of items or products", "ecommerce", { type: "json", documentationUrl: CRITEO_DOCS }),
  define("productid", "Product IDs", "Identifier of the product(s)", "ecommerce", { type: "json", documentationUrl: CRITEO_DOCS }),
  define("transactionid", "Transaction ID", "Conversion order identifier", "ecommerce", { type: "id", documentationUrl: CRITEO_DOCS }),
  define("deduplication", "Deduplication", "Deduplication status indicator", "ecommerce", { type: "number", documentationUrl: CRITEO_DOCS }),
  define("new_customer", "New Customer", "Indicator if user is a first-time buyer", "standard", { type: "boolean", documentationUrl: CRITEO_DOCS }),
  define("sc", "Visitor Identity", "Visitor context / identity string", "context", { type: "json", documentationUrl: CRITEO_DOCS }),
  define("retailerVisitorId", "Retailer Visitor ID", "Internal client user identifier", "context", { type: "id", documentationUrl: CRITEO_DOCS }),
  define("customerId", "Customer ID", "Customer user identifier", "context", { type: "id", documentationUrl: CRITEO_DOCS }),
  define("type", "Site Type", "Device site type category (e.g. desktop/mobile)", "context", { documentationUrl: CRITEO_DOCS }),
  define("siteType", "Site Type (alt)", "Alternative device site type name", "context", { documentationUrl: CRITEO_DOCS }),
  define("fu", "Page URL", "Full request referrer URL", "context", { type: "url", documentationUrl: CRITEO_DOCS }),
  define("tld", "Top Level Domain", "Base domain identifier", "context", { documentationUrl: CRITEO_DOCS }),
  define("v", "Version", "Tag library version", "context", { documentationUrl: CRITEO_DOCS }),
];

export const CRITEO_DEFINITION_MAP = new Map(CRITEO_DEFINITIONS.map(d => [d.name, d]));
