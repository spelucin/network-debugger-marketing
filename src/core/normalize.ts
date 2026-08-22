// Turns a chrome.webRequest observation into our normalized RawRequest.
import type { RawRequest } from "./types";
import { parseQuery, safeDecode, tryJsonParse, uuid } from "./url";

export interface WebRequestLike {
  requestId: string;
  tabId: number;
  url: string;
  method: string;
  requestBody?: {
    error?: string;
    formData?: Record<string, string[]>;
    raw?: Array<{ bytes?: ArrayBuffer; error?: string }>;
  };
  requestHeaders?: Array<{ name: string; value?: string }>;
}

const MAX_BODY_BYTES = 512 * 1024; // cap captured bodies to keep memory sane

function headersToRecord(
  headers?: Array<{ name: string; value?: string }>
): Record<string, string> | undefined {
  if (!headers || headers.length === 0) return undefined;
  const out: Record<string, string> = {};
  for (const h of headers) {
    if (h.value !== undefined) {
      // keep the last occurrence for duplicate header names
      out[h.name.toLowerCase()] = h.value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function decodeBody(
  body: WebRequestLike["requestBody"]
): { body?: unknown; bodyText?: string } {
  if (!body) return {};
  if (body.error) return {};
  if (body.formData && Object.keys(body.formData).length > 0) {
    const flat: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(body.formData)) {
      flat[k] = v.length === 1 ? (v[0] as string) : v;
    }
    return { body: flat, bodyText: JSON.stringify(flat) };
  }
  const raw = body.raw;
  if (!raw || raw.length === 0) return {};
  let total = 0;
  for (const r of raw) total += (r.bytes?.byteLength ?? 0);
  if (total === 0) return {};
  if (total > MAX_BODY_BYTES) {
    return { body: undefined, bodyText: undefined };
  }
  const parts: Uint8Array[] = [];
  for (const r of raw) {
    if (r.bytes instanceof ArrayBuffer) parts.push(new Uint8Array(r.bytes));
  }
  if (parts.length === 0) return {};
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    merged.set(p, offset);
    offset += p.byteLength;
  }
  let text: string;
  try {
    text = new TextDecoder().decode(merged);
  } catch {
    return {};
  }
  const json = tryJsonParse(text);
  if (json !== undefined) return { body: json, bodyText: text };
  // Possibly urlencoded form data (e.g. Meta `/tr` POSTs)
  if (
    /^(application\/x-www-form-urlencoded|text\/plain)/i.test(text.trim().slice(0, 64)) ||
    text.includes("&") || text.includes("=")
  ) {
    const parsed = parseQuery(`?${text}`);
    return { body: parsed, bodyText: text };
  }
  return { body: text, bodyText: text };
}

export function normalizeRequest(details: WebRequestLike): RawRequest {
  return {
    id: uuid(),
    tabId: details.tabId,
    requestId: details.requestId,
    url: details.url,
    method: (details.method ?? "GET").toUpperCase(),
    timestamp: Date.now(),
    queryParams: parseQuery(details.url),
    headers: headersToRecord(details.requestHeaders),
    ...decodeBody(details.requestBody),
  };
}

/** Decode a raw webRequest value into a safe string for display. */
export function valueToString(value: string | string[] | undefined): string {
  if (value === undefined) return "";
  return Array.isArray(value) ? value.join(", ") : safeDecode(value);
}

