import type { RawRequest } from "../core/types";
import { Ga4Parser } from "./ga4/parser";
import { GoogleAdsParser } from "./google-ads/parser";
import { MetaParser } from "./meta/parser";
import { TikTokParser } from "./tiktok/parser";
import { ClarityParser } from "./clarity/parser";
import type { MarketingParser } from "./types";

export const PARSERS: MarketingParser[] = [
  Ga4Parser,
  GoogleAdsParser,
  MetaParser,
  TikTokParser,
  ClarityParser,
];

export {
  Ga4Parser,
  GoogleAdsParser,
  MetaParser,
  TikTokParser,
  ClarityParser,
};
export type { MarketingParser } from "./types";
export { makeParam, valueText } from "./types";

/** Resolve the parser that understands a raw request, or undefined. */
export function resolveParser(request: RawRequest): MarketingParser | undefined {
  for (const parser of PARSERS) {
    try {
      if (parser.canParse(request)) return parser;
    } catch {
      // Defensive: a throwing canParse must never break capture.
    }
  }
  return undefined;
}