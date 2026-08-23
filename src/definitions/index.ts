import type { Platform } from "../core/types";
import { splitBracketKey } from "../core/url";
import { AMPLITUDE_DEFINITION_MAP } from "./amplitude";
import { BING_DEFINITION_MAP } from "./bing";
import { GA4_DEFINITION_MAP } from "./ga4";
import { GOOGLE_ADS_DEFINITION_MAP } from "./google-ads";
import { HEAP_DEFINITION_MAP } from "./heap";
import { MATOMO_DEFINITION_MAP } from "./matomo";
import { META_DEFINITION_MAP } from "./meta";
import { MIXPANEL_DEFINITION_MAP } from "./mixpanel";
import { PINTEREST_DEFINITION_MAP } from "./pinterest";
import { TIKTOK_DEFINITION_MAP } from "./tiktok";
import { CRITEO_DEFINITION_MAP, CRITEO_DOCS } from "./criteo";
import { HUBSPOT_DEFINITION_MAP, HUBSPOT_DOCS } from "./hubspot";
import { LINKEDIN_DEFINITION_MAP, LINKEDIN_DOCS } from "./linkedin";
import { SNAPCHAT_DEFINITION_MAP, SNAPCHAT_DOCS } from "./snapchat";
import { TWITTER_DEFINITION_MAP, TWITTER_DOCS } from "./twitter";
import type { ParameterDefinition } from "./types";

export * from "./types";
export { AMPLITUDE_DOCS } from "./amplitude";
export { BING_DOCS } from "./bing";
export { GA4_DOCS, GOOGLE_ADS_DOCS, META_DOCS, TIKTOK_DOCS } from "./types";
export { HEAP_DOCS } from "./heap";
export { MATOMO_DOCS } from "./matomo";
export { MIXPANEL_DOCS } from "./mixpanel";
export { PINTEREST_DOCS } from "./pinterest";
export { CRITEO_DOCS, HUBSPOT_DOCS, LINKEDIN_DOCS, SNAPCHAT_DOCS, TWITTER_DOCS };


const GA4_EVENT_PREFIXES = ["epn.", "ep.", "upn.", "up.", "seg."];

/** Reduce a raw transport key (e.g. `epn.value`, `cd[content_name]`) to its bare name. */
export function bareName(platform: Platform, key: string): string {
  if (platform === "ga4") {
    for (const prefix of GA4_EVENT_PREFIXES) {
      if (key.startsWith(prefix)) return key.slice(prefix.length);
    }
    // compressed product fields like pr1nm → item name
    const itemMatch = key.match(/^pr\d+([a-z]+)$/);
    if (itemMatch) return ITEM_FIELD_NAMES[itemMatch[1] as string] ?? key;
  }
  if (platform === "meta") {
    const { base, subKey } = splitBracketKey(key);
    if (base === "cd" || base === "ud") return subKey ?? base;
    return base;
  }
  return key;
}

const ITEM_FIELD_NAMES: Record<string, string> = {
  id: "item_id",
  nm: "item_name",
  br: "item_brand",
  ca: "item_category",
  va: "item_variant",
  pr: "item_price",
  qt: "item_quantity",
  cp: "coupon",
  ps: "position",
  lp: "item_list_position",
  af: "affiliation",
  ds: "discount",
  pd: "item_promotion",
  cur: "currency",
};

/** GA4 compressed product field → human label for item rows. */
export const ITEM_FIELD_LABELS: Record<string, string> = {
  id: "Item ID",
  nm: "Item Name",
  br: "Brand",
  ca: "Category",
  va: "Variant",
  pr: "Price",
  qt: "Quantity",
  cp: "Coupon",
  ps: "Position",
  af: "Affiliation",
};

/** Look up a parameter definition for a raw transport key. */
export function getDefinition(
  platform: Platform,
  key: string
): ParameterDefinition | undefined {
  const name = bareName(platform, key);
  const maps: Record<Platform, Map<string, ParameterDefinition> | undefined> = {
    ga4: GA4_DEFINITION_MAP,
    google_ads: GOOGLE_ADS_DEFINITION_MAP,
    meta: META_DEFINITION_MAP,
    tiktok: TIKTOK_DEFINITION_MAP,
    clarity: undefined,
    amplitude: AMPLITUDE_DEFINITION_MAP,
    mixpanel: MIXPANEL_DEFINITION_MAP,
    matomo: MATOMO_DEFINITION_MAP,
    linkedin: LINKEDIN_DEFINITION_MAP,
    reddit: undefined,
    pinterest: PINTEREST_DEFINITION_MAP,
    gtm: undefined,
    adobe: undefined,
    segment: undefined,
    bing: BING_DEFINITION_MAP,
    twitter: TWITTER_DEFINITION_MAP,
    snapchat: SNAPCHAT_DEFINITION_MAP,
    youtube: undefined,
    heap: HEAP_DEFINITION_MAP,
    criteo: CRITEO_DEFINITION_MAP,
    piwik: undefined,
    optimizely: undefined,
    hubspot: HUBSPOT_DEFINITION_MAP,
    hotjar: undefined,
    unknown: undefined,
  };
  return maps[platform]?.get(name);
}

/**
 * Known events per platform and the parameters that should normally be present.
 * Documents each platform's expected event schema.
 */
export interface KnownEventSpec {
  name: string;
  label: string;
  expected: string[];
  description?: string;
}

export const GA4_KNOWN_EVENTS: KnownEventSpec[] = [
  { name: "page_view", label: "Page View", expected: ["page_location", "page_title"], description: "Fired whenever a page is loaded." },
  { name: "first_visit", label: "First Visit", expected: [], description: "Fired the first time a user visits." },
  { name: "session_start", label: "Session Start", expected: [], description: "Fired at the start of each session." },
  { name: "view_item", label: "View Item", expected: ["items"], description: "Fired when a user views an item." },
  { name: "view_item_list", label: "View Item List", expected: ["items"], description: "Fired when a user views a list of items." },
  { name: "select_item", label: "Select Item", expected: ["items"], description: "Fired when a user selects an item from a list." },
  { name: "add_to_cart", label: "Add to Cart", expected: ["items", "currency"], description: "Fired when a user adds an item to their cart." },
  { name: "remove_from_cart", label: "Remove from Cart", expected: ["items", "currency"], description: "Fired when a user removes an item from their cart." },
  { name: "begin_checkout", label: "Begin Checkout", expected: ["items", "currency"], description: "Fired when a user begins the checkout flow." },
  { name: "add_payment_info", label: "Add Payment Info", expected: ["items", "currency"], description: "Fired when a user adds payment information." },
  { name: "purchase", label: "Purchase", expected: ["transaction_id", "value", "currency", "items"], description: "Fired when a purchase is completed." },
  { name: "refund", label: "Refund", expected: ["transaction_id", "value", "currency"], description: "Fired when a refund is issued." },
  { name: "view_cart", label: "View Cart", expected: ["items", "currency"], description: "Fired when a user views their cart." },
  { name: "search", label: "Search", expected: ["search_term"], description: "Fired when a user searches." },
  { name: "sign_up", label: "Sign Up", expected: ["method"], description: "Fired when a user signs up." },
  { name: "login", label: "Login", expected: ["method"], description: "Fired when a user logs in." },
  { name: "generate_lead", label: "Generate Lead", expected: [], description: "Fired when a user generates a lead." },
  { name: "scroll", label: "Scroll", expected: ["scroll_percent"], description: "Fired when a user scrolls through a page." },
  { name: "click", label: "Click", expected: [], description: "Fired when a user clicks a link." },
  { name: "form_start", label: "Form Start", expected: [], description: "Fired when a user starts filling a form." },
  { name: "form_submit", label: "Form Submit", expected: [], description: "Fired when a user submits a form." },
  { name: "video_start", label: "Video Start", expected: ["video_title"], description: "Fired when a user starts a video." },
  { name: "video_progress", label: "Video Progress", expected: ["video_title"], description: "Fired as a user watches a video." },
  { name: "video_complete", label: "Video Complete", expected: ["video_title"], description: "Fired when a user finishes a video." },
  { name: "file_download", label: "File Download", expected: ["file_name"], description: "Fired when a user downloads a file." },
];

export const META_KNOWN_EVENTS: KnownEventSpec[] = [
  { name: "PageView", label: "Page View", expected: [], description: "Fired whenever a page is loaded." },
  { name: "ViewContent", label: "View Content", expected: ["content_name"], description: "Fired when a user views content." },
  { name: "Search", label: "Search", expected: ["search_string"], description: "Fired when a user searches." },
  { name: "AddToCart", label: "Add to Cart", expected: ["contents", "value", "currency"], description: "Fired when a user adds an item to their cart." },
  { name: "AddToWishlist", label: "Add to Wishlist", expected: ["contents"], description: "Fired when a user adds an item to their wishlist." },
  { name: "InitiateCheckout", label: "Initiate Checkout", expected: ["contents", "value", "currency"], description: "Fired when a user begins checkout." },
  { name: "AddPaymentInfo", label: "Add Payment Info", expected: ["contents"], description: "Fired when a user adds payment information." },
  { name: "Purchase", label: "Purchase", expected: ["value", "currency", "contents"], description: "Fired when a purchase is completed." },
  { name: "Lead", label: "Lead", expected: [], description: "Fired when a user submits a lead." },
  { name: "CompleteRegistration", label: "Complete Registration", expected: ["status"], description: "Fired when a user completes registration." },
  { name: "Contact", label: "Contact", expected: [], description: "Fired when a user contacts the business." },
  { name: "Schedule", label: "Schedule", expected: [], description: "Fired when a user schedules an appointment." },
  { name: "Donate", label: "Donate", expected: ["value", "currency"], description: "Fired when a user donates." },
];

export const TIKTOK_KNOWN_EVENTS: KnownEventSpec[] = [
  { name: "PageView", label: "Page View", expected: [], description: "Fired whenever a page is loaded." },
  { name: "ViewContent", label: "View Content", expected: ["content_id", "content_name"], description: "Fired when a user views content." },
  { name: "AddToCart", label: "Add to Cart", expected: ["contents", "value", "currency"], description: "Fired when a user adds an item to their cart." },
  { name: "AddToWishlist", label: "Add to Wishlist", expected: ["contents"], description: "Fired when a user adds an item to their wishlist." },
  { name: "InitiateCheckout", label: "Initiate Checkout", expected: ["contents", "value", "currency"], description: "Fired when a user begins checkout." },
  { name: "AddPaymentInfo", label: "Add Payment Info", expected: ["contents"], description: "Fired when a user adds payment information." },
  { name: "CompletePayment", label: "Complete Payment", expected: ["value", "currency", "contents"], description: "Fired when a purchase is completed." },
  { name: "PlaceAnOrder", label: "Place an Order", expected: ["value", "currency"], description: "Fired when an order is placed." },
  { name: "Contact", label: "Contact", expected: [], description: "Fired when a user contacts the business." },
  { name: "SubmitForm", label: "Submit Form", expected: [], description: "Fired when a user submits a form." },
  { name: "Search", label: "Search", expected: ["search_string"], description: "Fired when a user searches." },
];

export const GOOGLE_ADS_KNOWN_EVENTS: KnownEventSpec[] = [
  { name: "conversion", label: "Conversion", expected: [], description: "Fired when a Google Ads conversion tag fires." },
  { name: "viewthrough_conversion", label: "View-Through Conversion", expected: [], description: "Fired for view-through conversions." },
  { name: "remarketing", label: "Remarketing", expected: [], description: "Fired when a remarketing tag fires." },
];

export function knownEvent(
  platform: Platform,
  eventName: string
): KnownEventSpec | undefined {
  const list: KnownEventSpec[] =
    platform === "ga4"
      ? GA4_KNOWN_EVENTS
      : platform === "meta"
        ? META_KNOWN_EVENTS
        : platform === "tiktok"
          ? TIKTOK_KNOWN_EVENTS
          : platform === "google_ads"
            ? GOOGLE_ADS_KNOWN_EVENTS
            : [];
  return list.find(
    (e) => e.name.toLowerCase() === eventName.toLowerCase()
  );
}