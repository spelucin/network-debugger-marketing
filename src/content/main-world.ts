// Runs in the page's MAIN world (declared in manifest content_scripts with
// "world": "MAIN"). Patches fetch / XHR / sendBeacon so tracking calls are
// observed at the source — this works even when the browser never dispatches
// webRequest events to the extension (adblockers, Edge tracking prevention,
// Brave shields, or Chromium webRequest wakeup bugs). A PerformanceObserver
// additionally reports SDK script/pixel loads for the detection chips,
// because Chromium only delivers webRequest sub-resource events when host
// permissions cover both the request URL and its initiator.
//
// The page context has no chrome.* APIs, so observations are posted to the
// isolated-world relay via window.postMessage.
import { classifyBeacon, looksTracked } from "../shared/trackers";
import { identifySdkScript } from "../shared/detection/script-loads";

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

  // --- resource loads (PerformanceObserver) ---
  // Feeds the background's detection chips with script/pixel sightings the
  // webRequest plane cannot see (see header note). Only tracker-matching
  // URLs are posted, batched to keep messaging cheap.
  if (typeof PerformanceObserver !== "undefined") {
    let pending: string[] = [];
    let flushTimer: number | undefined;

    const flush = () => {
      if (flushTimer !== undefined) {
        window.clearTimeout(flushTimer);
        flushTimer = undefined;
      }
      if (pending.length === 0) return;
      const urls = pending;
      pending = [];
      try {
        window.postMessage({ source: TOKEN, kind: "resources", urls }, "*");
      } catch {
        // A failed observation must not affect the page.
      }
    };

    const queue = (url: string) => {
      pending.push(url);
      if (pending.length >= 50) {
        flush();
      } else if (flushTimer === undefined) {
        // Short window: detection chips should light up promptly.
        flushTimer = window.setTimeout(flush, 300);
      }
    };

    try {
      new PerformanceObserver((list) => {
        try {
          for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
            const url = entry.name;
            if (typeof url !== "string") continue;
            const resourceType =
              entry.initiatorType === "script" ? "script" : undefined;
            if (
              classifyBeacon(url) === null &&
              identifySdkScript(url, resourceType) === null
            ) {
              continue;
            }
            queue(url);
          }
        } catch {
          // Ignore.
        }
      }).observe({ type: "resource", buffered: true });
    } catch {
      // Engines that reject unknown entry types; observation is best-effort.
    }

    window.addEventListener("pagehide", flush);
  }
})();
