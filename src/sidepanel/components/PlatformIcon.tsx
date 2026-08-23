import {
  siGoogleanalytics,
  siGoogleads,
  siMeta,
  siTiktok,
  siPinterest,
  siReddit,
  siSnapchat,
  siX,
  siYoutube,
  siHotjar,
  siHubspot,
  siMatomo,
  siMixpanel,
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

const CLARITY_GLYPH: BrandGlyph = {
  hex: "4A6CF7",
  path: "M11.4 0H0v11.4h11.4V0zM24 0H12.6v11.4H24V0zM11.4 12.6H0V24h11.4V12.6zM24 12.6H12.6V24H24V12.6z",
};

const LINKEDIN_GLYPH: BrandGlyph = {
  hex: "0A66C2",
  path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
};

const GTM_GLYPH: BrandGlyph = {
  hex: "4285F4",
  path: "M12.003 0a3 3 0 0 0-2.121 5.121l6.865 6.865-4.446 4.541 1.745 1.836a3.432 3.432 0 0 1 .7.739l.012.011-.001.002a3.432 3.432 0 0 1 .609 1.953 3.432 3.432 0 0 1-.09.78l7.75-7.647c.031-.029.067-.05.098-.08.023-.023.038-.052.06-.076a2.994 2.994 0 0 0-.06-4.166l-9-9A2.99 2.99 0 0 0 12.003 0z",
};

const AMPLITUDE_GLYPH: BrandGlyph = {
  hex: "000000",
  path: "M12 0C5.363 0 0 5.363 0 12s5.363 12 12 12 12-5.363 12-12S18.637 0 12 0zm8.625 12.225s-.038.038-.038.038l-.037 0c-.075.038-.188.075-.3.075h-5.738c.038.188.113.412.15.637.3 1.35 1.125 4.913 2.025 4.913h.038c.675 0 1.05-.975 1.8-3.15l0-.038c.112-.337.262-.75.412-1.162l.038-.113c.037-.15.188-.225.337-.188.15.038.225.188.188.338l0 0-.038.15c-.075.263-.15.6-.263 1.013-.45 1.912-1.162 4.762-2.925 4.762h0c-1.162 0-1.837-1.837-2.137-2.625-.563-1.462-.975-3.037-1.35-4.537H9.488l-1.088 3.487 0 0c-.15.263-.488.338-.75.188-.15-.113-.263-.263-.263-.45v-.038l.075-.375c.15-.9.338-1.837.525-2.775h-2.212l0 0c-.412-.075-.712-.412-.712-.825 0-.412.3-.75.675-.825.075 0 .188 0 .263 0h.112c.713 0 1.425.038 2.25.038 1.162-4.688 2.475-7.05 3.975-7.088 1.575 0 2.775 3.638 3.713 7.163l0 0c1.95.038 4.012.112 6 .225l.075 0c.038 0 .075 0 .112 0h0c.338.075.563.412.488.75-.037.15-.112.263-.225.337z",
};

const ADOBE_GLYPH: BrandGlyph = {
  hex: "FF0000",
  path: "M12,9.19L17.65,22.6L13.95,22.6L12.26,18.33L8.12,18.33L12,9.19ZM24,1.36L24,22.6L15.13,1.36L24,1.36ZM8.88,1.36L0,22.6L0,1.36L8.88,1.36Z",
};

const SEGMENT_GLYPH: BrandGlyph = {
  hex: "52BD95",
  path: "M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm0 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zm0 15a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z",
};

const CRITEO_GLYPH: BrandGlyph = {
  hex: "ED6D3D",
  path: "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 3.6c4.637 0 8.4 3.763 8.4 8.4s-3.763 8.4-8.4 8.4-8.4-3.763-8.4-8.4S7.363 3.6 12 3.6zm0 3c-2.986 0-5.4 2.414-5.4 5.4S9.014 17.4 12 17.4s5.4-2.414 5.4-5.4S14.986 6.6 12 6.6z",
};

const HEAP_GLYPH: BrandGlyph = {
  hex: "FF5C35",
  path: "M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 9.75a3.75 3.75 0 1 1 0-7.5 3.75 3.75 0 0 1 0 7.5z",
};

const BING_GLYPH: BrandGlyph = {
  hex: "008373",
  path: "M4.58 0l4.79 1.69v16.88l6.75-3.9-3.31-1.55-2.09-5.2L21.42 12.36v5.44l-9.87 6.2L4.58 21.33z",
};

const OPTIMIZELY_GLYPH: BrandGlyph = {
  hex: "00B0FF",
  path: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z",
};

const BRAND_GLYPHS: Record<Exclude<Platform, "unknown">, BrandGlyph> = {
  ga4: siGoogleanalytics,
  google_ads: siGoogleads,
  meta: siMeta,
  tiktok: siTiktok,
  clarity: CLARITY_GLYPH,
  amplitude: AMPLITUDE_GLYPH,
  mixpanel: siMixpanel,
  matomo: siMatomo,
  linkedin: LINKEDIN_GLYPH,
  reddit: siReddit,
  pinterest: siPinterest,
  gtm: GTM_GLYPH,
  adobe: ADOBE_GLYPH,
  segment: SEGMENT_GLYPH,
  bing: BING_GLYPH,
  twitter: siX,
  snapchat: siSnapchat,
  youtube: siYoutube,
  heap: HEAP_GLYPH,
  criteo: CRITEO_GLYPH,
  piwik: siMatomo,
  optimizely: OPTIMIZELY_GLYPH,
  hubspot: siHubspot,
  hotjar: siHotjar,
};

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
