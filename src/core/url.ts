// URL / body parsing helpers. Purely functional and dependency-free.

/** Parse a URL query string into a plain object. Keeps repeated keys as arrays. */
export function parseQuery(url: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  const qIndex = url.indexOf("?");
  if (qIndex === -1) return out;
  const search = url.slice(qIndex + 1);
  // A "#" fragment is not expected on beacon endpoints, but guard anyway.
  const frag = search.indexOf("#");
  const qs = frag === -1 ? search : search.slice(0, frag);
  for (const part of qs.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawValue = eq === -1 ? "" : part.slice(eq + 1);
    const key = safeDecode(rawKey);
    const value = safeDecode(rawValue);
    const existing = out[key];
    if (existing === undefined) {
      out[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      out[key] = [existing, value];
    }
  }
  return out;
}

export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

export function parseHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function parsePathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
}

export function parseProtocol(url: string): string {
  try {
    return new URL(url).protocol;
  } catch {
    return "";
  }
}

/** True when the URL is http(s). */
export function isHttpUrl(url: string): boolean {
  const p = parseProtocol(url);
  return p === "http:" || p === "https:";
}

/** Parse an application/x-www-form-urlencoded body. */
export function parseFormBody(body: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const part of body.split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawValue = eq === -1 ? "" : part.slice(eq + 1);
    const key = safeDecode(rawKey);
    const value = safeDecode(rawValue);
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else out[key] = [existing, value];
  }
  return out;
}

/** Try to JSON-parse a string. Returns the value or undefined. */
export function tryJsonParse(value: string): unknown | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/** Extract the value of a bracket-parameter like `cd[content_name]`. */
export function splitBracketKey(key: string): {
  base: string;
  subKey?: string;
} {
  const open = key.indexOf("[");
  if (open === -1) return { base: key };
  const close = key.indexOf("]", open);
  if (close === -1) return { base: key };
  return { base: key.slice(0, open), subKey: key.slice(open + 1, close) };
}

export function isNumeric(value: unknown): value is number | string {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string" && value.trim() !== "") {
    return Number.isFinite(Number(value));
  }
  return false;
}

export function toNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function prettyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return prettyJson(value);
  return String(value);
}

/** Format a number as a compact monetary string using its currency code. */
export function formatMoney(value: number, currency?: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: (currency ?? "USD").toUpperCase(),
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value} ${(currency ?? "").toUpperCase()}`.trim();
  }
}

/** Format a timestamp as HH:MM:SS.mmm */
export function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

/** Format a timestamp as HH:MM:SS */
export function formatTimeShort(timestamp: number): string {
  const d = new Date(timestamp);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function truncateMiddle(value: string, max = 80): string {
  if (value.length <= max) return value;
  const half = Math.floor((max - 1) / 2);
  return `${value.slice(0, half)}…${value.slice(-half)}`;
}

/** Short host + path for display, without query string. */
export function compactUrl(url: string, max = 64): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname === "/" ? "" : u.pathname;
    const combined = `${host}${path}`;
    return truncateMiddle(combined, max);
  } catch {
    return truncateMiddle(url, max);
  }
}

const UUID_VARIANT =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? () => crypto.randomUUID()
    : () =>
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });

export function uuid(): string {
  return UUID_VARIANT();
}

/** Clamp a number into a range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}