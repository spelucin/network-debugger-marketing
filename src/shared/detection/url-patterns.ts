// Hostname utilities shared by tracker matching and SDK detection.
//
// The background service worker classifies every observed URL, so lookup cost
// matters: registrable-domain reduction lets rule tables bucket candidates by
// domain instead of scanning every entry per request.
//
// Matching contract (keep in sync with tests):
//   - string pattern  → case-insensitive substring test against the full URL.
//     Hostnames arrive lowercased; tolerating mixed-case paths means a site
//     serving `collect.PNG`-style oddities still matches its endpoint token.
//   - RegExp pattern  → tested against the RAW url. The regex owns casing, so
//     case-significant tokens (GA4 `G-…`, Ads `AW-…`) survive intact.

/** Requests for static assets are never tracking calls. `.gif` is deliberately
 * absent — classic tracking pixels are GIFs (HubSpot, old Adobe). */
export const STATIC_ASSET_RE =
  /\.(woff2?|ttf|eot|otf|css|png|jpe?g|webp|svg|ico|avif)(\?|$)/i;

/**
 * Public suffixes where the registrable domain spans three labels instead of
 * two: country-code second levels (`co.uk`, `com.au`, …) and hosting platforms
 * that hand out per-customer subdomains (`vercel.app`, `netlify.app`, …).
 * Without these, unrelated tenants would collapse into one "site".
 */
export const MULTI_PART_SUFFIXES: ReadonlySet<string> = new Set([
  // ccTLD second levels
  "co.uk", "com.au", "co.nz", "com.br", "co.jp", "co.kr",
  "co.za", "com.mx", "co.in", "com.sg", "com.hk", "com.tw",
  "co.il", "com.ar", "com.tr", "com.pl", "com.cn", "com.ua",
  // PaaS / multi-tenant hosts
  "vercel.app", "netlify.app", "pages.dev", "workers.dev",
  "github.io", "gitlab.io", "herokuapp.com", "firebaseapp.com",
  "web.app", "appspot.com", "azurewebsites.net",
  "replit.app", "glitch.me", "surge.sh", "myshopify.com",
]);

/** Fast hostname pull for hot paths — avoids `new URL()` allocation.
 * Handles ports, IPv6 literals and fully-qualified trailing dots. */
export function hostOf(url: string): string {
  const schemeEnd = url.indexOf("://");
  if (schemeEnd === -1) return "";
  const start = schemeEnd + 3;
  let end = url.length;
  for (let i = start; i < url.length; i++) {
    const c = url[i];
    if (c === "/" || c === "?" || c === "#") {
      end = i;
      break;
    }
  }
  let host = url.slice(start, end).toLowerCase();
  if (host.startsWith("[")) {
    const close = host.indexOf("]");
    return close === -1 ? "" : host.slice(1, close); // drop brackets
  }
  const port = host.indexOf(":");
  if (port !== -1) host = host.slice(0, port);
  if (host.endsWith(".")) host = host.slice(0, -1);
  return host;
}

/** Registrable domain (eTLD+1) of a hostname: `sub.example.co.uk` →
 * `example.co.uk`. Single-label and IP-literal inputs pass through. */
export function apexDomain(hostname: string): string {
  if (!hostname || hostname.startsWith("[")) return hostname;
  const labels = hostname.split(".");
  if (labels.length <= 2) return hostname;
  const lastTwo = labels.slice(-2).join(".");
  if (MULTI_PART_SUFFIXES.has(lastTwo)) {
    return labels.slice(-3).join(".");
  }
  return lastTwo;
}
