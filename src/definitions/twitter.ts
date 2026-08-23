import { define, type ParameterDefinition } from "./types";

export const TWITTER_DOCS =
  "https://developer.x.com/en/docs/x-ads-api/campaign-management/ads-api-implementation/conversion-events";

export const TWITTER_DEFINITIONS: ParameterDefinition[] = [
  define("event", "Event Name", "The event type being tracked", "standard"),
  define("ev", "Event Value", "Event value parameter", "standard", { type: "number" }),
  define("txn_id", "Pixel ID", "Twitter/X Pixel ID", "context", { type: "id", documentationUrl: TWITTER_DOCS }),
  define("p_id", "Partner ID", "Partner identifier", "context", { type: "id" }),
  define("tw_sale_amount", "Sale Amount", "Total sale amount", "standard", { type: "currency", documentationUrl: TWITTER_DOCS }),
  define("tw_order_quantity", "Order Quantity", "Number of items ordered", "standard", { type: "number", documentationUrl: TWITTER_DOCS }),
  define("tw_order_id", "Order ID", "Unique order identifier", "standard", { type: "id", documentationUrl: TWITTER_DOCS }),
  define("tw_currency", "Currency", "Currency code (ISO 4217)", "standard", { documentationUrl: TWITTER_DOCS }),
  define("tw_value", "Value", "Conversion value", "standard", { type: "currency", documentationUrl: TWITTER_DOCS }),
  define("tw_num_items", "Number of Items", "Number of items in the conversion", "standard", { type: "number", documentationUrl: TWITTER_DOCS }),
  define("tw_search_string", "Search String", "Search query that led to the conversion", "standard", { documentationUrl: TWITTER_DOCS }),
  define("tw_content_type", "Content Type", "Type of content (e.g. product)", "standard", { documentationUrl: TWITTER_DOCS }),
  define("tw_content_id", "Content ID", "Content or product identifier", "standard", { type: "id", documentationUrl: TWITTER_DOCS }),
  define("tw_content_name", "Content Name", "Name of the content or product", "standard"),
  define("tw_gclid", "Google Click ID", "Google Ads click identifier", "context", { type: "id" }),
  define("tw_user", "User", "User identifier", "context"),
  define("tw_document_href", "Page URL", "Page URL where the event fired", "context", { type: "url" }),
  define("tw_iframe_status", "Iframe Status", "Whether the pixel fired in an iframe", "context", { type: "boolean" }),
  define("tw_page_url", "Page URL (alt)", "Alternative page URL parameter", "context", { type: "url" }),
  define("tw_pixel_id", "Pixel ID (alt)", "Alternative pixel ID parameter", "context", { type: "id" }),
  define("tw_conversion_id", "Conversion ID", "Conversion identifier", "context", { type: "id" }),
  define("tpx_cb", "Callback", "Callback parameter", "context"),
];

export const TWITTER_DEFINITION_MAP = new Map(
  TWITTER_DEFINITIONS.map((d) => [d.name, d])
);
