// Tracker endpoint matching shared by every capture path. The page-level
// hooks (main world) cannot translate Chrome match patterns cheaply, so both
// they and the tests use this hostname/path rule list instead.

interface HostRule {
  hostSuffix: string;
  pathPrefixes?: string[];
}

const HOST_RULES: HostRule[] = [
  // GA4 + Tag Manager
  { hostSuffix: "google-analytics.com" },
  { hostSuffix: "googletagmanager.com" },
  // Google Ads
  { hostSuffix: "googleadservices.com" },
  { hostSuffix: "doubleclick.net" },
  { hostSuffix: "adservice.google.com" },
  // Meta Pixel — event beacon and SDK/config
  { hostSuffix: "facebook.com", pathPrefixes: ["/tr"] },
  { hostSuffix: "facebook.net", pathPrefixes: ["/tr", "/signals"] },
  // TikTok Pixel — event beacon and SDK/config
  {
    hostSuffix: "analytics.tiktok.com",
    pathPrefixes: ["/api/v2/pixel", "/i18n/pixel"],
  },
  // Microsoft Clarity
  { hostSuffix: "clarity.ms" },
];

/** True when the URL targets a marketing/tracking endpoint we decode. */
export function looksTracked(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  return HOST_RULES.some((rule) => {
    const suffix = rule.hostSuffix.toLowerCase();
    if (host !== suffix && !host.endsWith(`.${suffix}`)) return false;
    if (!rule.pathPrefixes) return true;
    return rule.pathPrefixes.some(
      (prefix) => path === prefix || path.startsWith(prefix)
    );
  });
}
