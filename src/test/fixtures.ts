import type { RawRequest } from "../core/types";

let counter = 0;

/** Build a minimal RawRequest for parser/QA tests. */
export function rawRequest(
  url: string,
  overrides: Partial<RawRequest> = {}
): RawRequest {
  counter += 1;
  return {
    id: `test-${counter}`,
    requestId: `req-${counter}`,
    method: "GET",
    timestamp: 1_700_000_000_000 + counter,
    queryParams: {},
    ...overrides,
    url,
  };
}

/** Split a query string into the queryParams record shape parsers expect.
 * Mirrors production parseQuery: both keys and values are percent-decoded
 * and `+` collapses to a space. */
export function queryParams(qs: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  const search = qs.startsWith("?") ? qs.slice(1) : qs;
  if (!search) return out;
  for (const pair of search.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const key = safeDecode(eq === -1 ? pair : pair.slice(0, eq));
    const value = safeDecode(eq === -1 ? "" : pair.slice(eq + 1));
    if (key in out) {
      const prev = out[key] as string | string[];
      if (Array.isArray(prev)) prev.push(value);
      else out[key] = [prev, value];
    } else {
      out[key] = value;
    }
  }
  return out;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}