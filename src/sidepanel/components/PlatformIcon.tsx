import {
  siGoogleanalytics,
  siGoogleads,
  siMeta,
  siTiktok,
} from "simple-icons";
import type { Platform } from "../../core/types";
import { PLATFORM_INFO } from "../../core/types";

interface Props {
  platform: Platform;
  size?: number;
  className?: string;
}

interface BrandGlyph {
  path: string;
  hex: string;
}

// Microsoft Clarity has no Simple Icons mark; the four-square Microsoft logo
// is the platform's parent brand glyph. Brand color: Clarity indigo.
const CLARITY_GLYPH: BrandGlyph = {
  hex: "4A6CF7",
  path: "M11.4 0H0v11.4h11.4V0zM24 0H12.6v11.4H24V0zM11.4 12.6H0V24h11.4V12.6zM24 12.6H12.6V24H24V12.6z",
};

const BRAND_GLYPHS: Record<Exclude<Platform, "unknown">, BrandGlyph> = {
  ga4: siGoogleanalytics,
  google_ads: siGoogleads,
  meta: siMeta,
  tiktok: siTiktok,
  clarity: CLARITY_GLYPH,
};

/** Official Simple Icons brand marks rendered as app-icon style badges. */
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
  const glyph = BRAND_GLYPHS[platform];
  return (
    <span
      className={`platform-badge ${className ?? ""}`}
      style={{ background: `#${glyph.hex}`, width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="#fff">
        <path d={glyph.path} />
      </svg>
    </span>
  );
}

export function platformDotColor(platform: Platform): string {
  if (platform === "unknown") return "var(--text-3)";
  return `#${BRAND_GLYPHS[platform].hex}`;
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