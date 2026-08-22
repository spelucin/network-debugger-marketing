// Runs in the page's MAIN world (declared in manifest content_scripts with
// "world": "MAIN"). Patches fetch / XHR / sendBeacon so tracking calls are
// observed at the source — this works even when the browser never dispatches
// webRequest events to the extension (adblockers, Edge tracking prevention,
// Brave shields, or Chromium webRequest wakeup bugs).
//
// The page context has no chrome.* APIs, so observations are posted to the
// isolated-world relay via window.postMessage.
import { looksTracked } from "../shared/trackers";

(() => {
  const TOKEN = "nd-mainworld";
  const w = window as typeof window & { __ndMainWorldInstalled?: boolean };
  if (w.__ndMainWorldInstalled) return;
  w.__ndMainWorldInstalled = true;

  const MAX_BODY_CHARS = 256 * 1024;

  function bodyToString(body: unknown): string | undefined {
    try {
      if (typeof body === "string") {
        return body.length <= MAX_BODY_CHARS ? body : undefined;
      }
      if (body instanceof URLSearchParams) {
        const text = body.toString();
        return text.length <= MAX_BODY_CHARS ? text : undefined;
      }
    } catch {
      // Never let capture break the page's requests.
    }
    return undefined;
  }

  function report(
    kind: "fetch" | "xhr" | "beacon",
    method: string,
    url: string,
    bodyText?: string
  ) {
    try {
      window.postMessage({ source: TOKEN, kind, method, url, bodyText }, "*");
    } catch {
      // Ignore; a failed observation must not affect the request.
    }
  }

  // --- fetch ---
  const originalFetch = window.fetch.bind(window);
  window.fetch = function (...args: Parameters<typeof fetch>): Promise<Response> {
    try {
      const input = args[0];
      const init = args[1];
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request)?.url;
      if (typeof url === "string" && looksTracked(url)) {
        const method =
          init?.method ?? (input as Request)?.method ?? "GET";
        report("fetch", method, url, bodyToString(init?.body));
      }
    } catch {
      // Ignore.
    }
    return originalFetch.apply(this, args);
  };

  // --- XMLHttpRequest ---
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest & { __ndInfo?: { method: string; url: string } },
    ...args: unknown[]
  ) {
    try {
      this.__ndInfo = { method: String(args[0]), url: String(args[1]) };
    } catch {
      // Ignore.
    }
    return (originalOpen as (...o: unknown[]) => void).apply(this, args);
  };
  XMLHttpRequest.prototype.send = function (
    this: XMLHttpRequest & { __ndInfo?: { method: string; url: string } },
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    try {
      const info = this.__ndInfo;
      if (info && looksTracked(info.url)) {
        report("xhr", info.method, info.url, bodyToString(body));
      }
    } catch {
      // Ignore.
    }
    return originalSend.call(this, body);
  };

  // --- navigator.sendBeacon ---
  const nativeSendBeacon = navigator.sendBeacon?.bind(navigator);
  if (nativeSendBeacon) {
    navigator.sendBeacon = function (
      url: string | URL,
      data?: BodyInit | null
    ): boolean {
      try {
        const href = String(url);
        if (looksTracked(href)) {
          report("beacon", "POST", href, bodyToString(data));
        }
      } catch {
        // Ignore.
      }
      return nativeSendBeacon(url, data);
    };
  }
})();
