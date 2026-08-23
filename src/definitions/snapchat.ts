import { define, type ParameterDefinition } from "./types";

export const SNAPCHAT_DOCS = "https://businesshelp.snapchat.com/s/article/pixel-setup";

export const SNAPCHAT_DEFINITIONS: ParameterDefinition[] = [
  define("currency", "Currency", "The currency for the transaction value.", "standard", { documentationUrl: SNAPCHAT_DOCS }),
  define("price", "Price", "The price of the item.", "standard", { type: "currency", documentationUrl: SNAPCHAT_DOCS }),
  define("transaction_id", "Transaction ID", "A unique ID for the transaction.", "standard", { type: "id", documentationUrl: SNAPCHAT_DOCS }),
  define("item_ids", "Item IDs", "A list of item IDs associated with the event.", "ecommerce", { documentationUrl: SNAPCHAT_DOCS }),
  define("item_category", "Item Category", "The category of the item.", "ecommerce", { documentationUrl: SNAPCHAT_DOCS }),
  define("number_items", "Number of Items", "The number of items in the transaction.", "standard", { type: "number", documentationUrl: SNAPCHAT_DOCS }),
  define("description", "Description", "A description of the item or event.", "standard", { documentationUrl: SNAPCHAT_DOCS }),
  define("search_string", "Search String", "The search string entered by the user.", "standard", { documentationUrl: SNAPCHAT_DOCS }),
  define("sign_up_method", "Sign Up Method", "The method used to sign up.", "standard", { documentationUrl: SNAPCHAT_DOCS }),
  define("success", "Success", "Whether the event was successful.", "standard", { type: "boolean", documentationUrl: SNAPCHAT_DOCS }),
  define("payment_info_available", "Payment Info Available", "Whether payment info is available.", "standard", { type: "boolean", documentationUrl: SNAPCHAT_DOCS }),
];

export const SNAPCHAT_DEFINITION_MAP = new Map(SNAPCHAT_DEFINITIONS.map(d => [d.name, d]));
