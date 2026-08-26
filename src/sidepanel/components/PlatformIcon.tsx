import {
  siGoogleads,
  siGoogleanalytics,
  siGoogletagmanager,
  siHotjar,
  siHubspot,
  siMatomo,
  siMeta,
  siMixpanel,
  siPinterest,
  siReddit,
  siSnapchat,
  siTiktok,
  siX,
  siYoutube,
} from "simple-icons";
import type { Platform } from "../../core/types";
import { PLATFORM_INFO } from "../../core/types";
import { PLATFORM_MARKS, type PlatformMark } from "./platform-marks";

interface Props {
  platform: Platform;
  size?: number;
  className?: string;
}

interface Glyph {
  /** Flat brand color for dots / accents. */
  hex: string;
  viewBox: string;
  body: string;
}

function fromSimpleIcons(si: { hex: string; path: string }): Glyph {
  return {
    hex: `#${si.hex}`,
    viewBox: "0 0 24 24",
    body: `<path fill="#${si.hex}" d="${si.path}"/>`,
  };
}

/** A simple-icons glyph drained to a neutral gray — used for sunset
 * platforms whose artwork should read as retired (Universal Analytics). */
function grayed(si: { path: string }): Glyph {
  return {
    hex: "#9AA0A6",
    viewBox: "0 0 24 24",
    body: `<path fill="#9AA0A6" d="${si.path}"/>`,
  };
}

function fromMark(mark: PlatformMark): Glyph {
  return { hex: mark.hex, viewBox: mark.viewBox, body: mark.body };
}

const GLYPHS: Record<Exclude<Platform, "unknown">, Glyph> = {
  ga4: fromSimpleIcons(siGoogleanalytics),
  universal_analytics: grayed(siGoogleanalytics),
  google_ads: fromSimpleIcons(siGoogleads),
  meta: fromSimpleIcons(siMeta),
  tiktok: fromSimpleIcons(siTiktok),
  gtm: fromSimpleIcons(siGoogletagmanager),
  clarity: fromMark(PLATFORM_MARKS.microsoft),
  amplitude: fromMark(PLATFORM_MARKS.amplitude),
  mixpanel: fromSimpleIcons(siMixpanel),
  matomo: fromSimpleIcons(siMatomo),
  piwik: fromSimpleIcons(siMatomo),
  linkedin: fromMark(PLATFORM_MARKS.linkedin),
  reddit: fromSimpleIcons(siReddit),
  pinterest: fromSimpleIcons(siPinterest),
  adobe: fromMark(PLATFORM_MARKS.adobe),
  segment: fromMark(PLATFORM_MARKS.segment),
  bing: fromMark(PLATFORM_MARKS.bing),
  twitter: fromSimpleIcons(siX),
  snapchat: fromSimpleIcons(siSnapchat),
  youtube: fromSimpleIcons(siYoutube),
  heap: fromMark(PLATFORM_MARKS.heap),
  criteo: fromMark(PLATFORM_MARKS.criteo),
  optimizely: fromMark(PLATFORM_MARKS.optimizely),
  hubspot: fromSimpleIcons(siHubspot),
  hotjar: fromSimpleIcons(siHotjar),
};

/** Official platform marks rendered favicon-style: native artwork on a
 * light chip so multicolor logos read correctly in both themes. */
export function PlatformIcon({ platform, size = 16, className }: Props) {
  if (platform === "unknown") {
    return (
      <span
        className={`platform-badge unknown ${className ?? ""}`}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <UnknownMark size={size * 0.6} />
      </span>
    );
  }
  const glyph = GLYPHS[platform];
  return (
    <span
      className={`platform-badge ${className ?? ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox={glyph.viewBox}
        width={size}
        height={size}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: glyph.body }}
      />
    </span>
  );
}

export function platformDotColor(platform: Platform): string {
  if (platform === "unknown") return "var(--text-3)";
  return GLYPHS[platform].hex;
}

export function platformLabel(platform: Platform): string {
  return PLATFORM_INFO[platform].label;
}

function UnknownMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1.6" />
      <path
        d="M9.6 9.2a2.6 2.6 0 1 1 3.4 2.5c-.6.25-1 .8-1 1.5v.3"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.85"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
