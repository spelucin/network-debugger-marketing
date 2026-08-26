import type { RawRequest } from "../core/types";
import { Ga4Parser } from "./ga4/parser";
import { UniversalAnalyticsParser } from "./universal-analytics/parser";
import { GoogleAdsParser } from "./google-ads/parser";
import { MetaParser } from "./meta/parser";
import { TikTokParser } from "./tiktok/parser";
import { AmplitudeParser } from "./amplitude/parser";
import { ClarityParser } from "./clarity/parser";
import { PinterestParser } from "./pinterest/parser";
import { HeapParser } from "./heap/parser";
import { BingParser } from "./bing/parser";
import { CriteoParser } from "./criteo/parser";
import { HubSpotParser } from "./hubspot/parser";
import { LinkedInParser } from "./linkedin/parser";
import { MatomoParser } from "./matomo/parser";
import { MixpanelParser } from "./mixpanel/parser";
import { SnapchatParser } from "./snapchat/parser";
import { TwitterParser } from "./twitter/parser";
import type { MarketingParser } from "./types";

export const PARSERS: MarketingParser[] = [
  UniversalAnalyticsParser,
  Ga4Parser,
  GoogleAdsParser,
  MetaParser,
  TikTokParser,
  ClarityParser,
  AmplitudeParser,
  PinterestParser,
  HeapParser,
  BingParser,
  CriteoParser,
  HubSpotParser,
  LinkedInParser,
  MatomoParser,
  MixpanelParser,
  SnapchatParser,
  TwitterParser,
];

export {
  UniversalAnalyticsParser,
  Ga4Parser,
  GoogleAdsParser,
  MetaParser,
  TikTokParser,
  ClarityParser,
  AmplitudeParser,
  PinterestParser,
  HeapParser,
  BingParser,
  CriteoParser,
  HubSpotParser,
  LinkedInParser,
  MatomoParser,
  MixpanelParser,
  SnapchatParser,
  TwitterParser,
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