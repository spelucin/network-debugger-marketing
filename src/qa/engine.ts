import type {
  DecodedEvent,
  Platform,
  QAIssue,
  RawRequest,
} from "../core/types";
import { bareName, knownEvent } from "../definitions";

/**
 * Lightweight, deterministic QA context. The background worker keeps a bounded
 * window of recently-seen events so rules can detect duplicates and
 * inconsistencies without storing every request.
 */
export interface QaEventEntry {
  id: string;
  platform: Platform;
  eventName: string;
  timestamp: number;
  url: string;
  transactionId?: string;
  eventId?: string;
  pixelId?: string;
  measurementId?: string;
  documentLocation?: string;
  value?: number;
  currency?: string;
}

export interface QaContext {
  /** Newest entries last. Bounded by the caller. */
  events: QaEventEntry[];
}

export interface QaResult {
  issues: QAIssue[];
  entry: QaEventEntry;
}

const DUPLICATE_WINDOW_MS = 6000;
const EXACT_DUPLICATE_WINDOW_MS = 1500;

let issueCounter = 0;
function makeIssue(
  code: string,
  severity: "warning" | "info",
  message: string,
  detail?: string
): QAIssue {
  issueCounter += 1;
  return { id: `${code}-${issueCounter}`, severity, code, message, detail };
}

function isPurchaseEvent(platform: Platform, eventName: string): boolean {
  const n = eventName.toLowerCase();
  if (platform === "ga4") return n === "purchase" || n === "refund";
  if (platform === "meta") return n === "purchase";
  if (platform === "tiktok") return n === "completepayment" || n === "placeanorder";
  return false;
}

function hasParamValue(decoded: DecodedEvent, name: string): boolean {
  const all = [
    ...decoded.standardParameters,
    ...decoded.customParameters,
    ...decoded.contextParameters,
  ];
  return all.some((p) => {
    if (p.value === undefined || p.value === null || p.value === "") return false;
    return bareName(decoded.platform, p.key) === name;
  });
}

function hasItems(decoded: DecodedEvent): boolean {
  return (decoded.ecommerce?.items.length ?? 0) > 0;
}

function valueOf(decoded: DecodedEvent, name: string): unknown {
  const all = [
    ...decoded.standardParameters,
    ...decoded.customParameters,
    ...decoded.contextParameters,
  ];
  for (const p of all) {
    if (bareName(decoded.platform, p.key) === name) return p.value;
  }
  return undefined;
}

function isRecent(entry: QaEventEntry, now: number, windowMs: number): boolean {
  return now - entry.timestamp <= windowMs;
}

/** Signature used to compare events across requests for duplicates/inconsistency. */
function signature(entry: QaEventEntry): string | undefined {
  if (entry.transactionId) return `tx:${entry.platform}|${entry.eventName}|${entry.transactionId}`;
  if (entry.eventId) return `eid:${entry.platform}|${entry.eventName}|${entry.eventId}`;
  if (entry.documentLocation) {
    const owner = entry.pixelId ?? entry.measurementId;
    if (owner) return `loc:${entry.platform}|${entry.eventName}|${owner}|${entry.documentLocation}`;
  }
  return undefined;
}

export function runQa(
  decoded: DecodedEvent,
  raw: RawRequest,
  context: QaContext
): QaResult {
  const issues: QAIssue[] = [];
  const now = raw.timestamp;
  const q = raw.queryParams;
  const platform = decoded.platform;
  const eventName = decoded.eventName;
  const ecommerce = decoded.ecommerce;

  const entry: QaEventEntry = {
    id: raw.id,
    platform,
    eventName,
    timestamp: now,
    url: raw.url,
    transactionId: ecommerce?.transaction_id,
    eventId:
      typeof decoded.meta.eventId === "string" ? decoded.meta.eventId : undefined,
    pixelId:
      typeof decoded.meta.pixelId === "string" ? decoded.meta.pixelId : undefined,
    measurementId:
      typeof decoded.meta.measurementId === "string"
        ? decoded.meta.measurementId
        : undefined,
    documentLocation:
      typeof decoded.meta.documentLocation === "string"
        ? decoded.meta.documentLocation
        : valueOf(decoded, "page_location") !== undefined
          ? String(valueOf(decoded, "page_location"))
          : undefined,
    value: ecommerce?.value,
    currency: ecommerce?.currency,
  };

  // ---------------------------------------------------------------------
  // 1. Suspicious values
  // ---------------------------------------------------------------------
  if (!eventName || /^\s*$/.test(eventName)) {
    issues.push(
      makeIssue(
        "empty-event-name",
        "warning",
        "Suspicious value — empty event name.",
        "The request has no recognizable event name."
      )
    );
  }

  if (platform === "ga4") {
    const mid = entry.measurementId;
    if (!mid) {
      issues.push(
        makeIssue(
          "missing-measurement-id",
          "warning",
          "Suspicious value — measurement ID missing.",
          "GA4 requests should include a tid parameter (G-XXXXXXX)."
        )
      );
    } else if (!/^G-[A-Za-z0-9]+$/.test(mid)) {
      issues.push(
        makeIssue(
          "suspicious-id",
          "warning",
          `Suspicious value — measurement ID "${mid}" does not look like a GA4 ID.`,
          "GA4 measurement IDs normally start with G-."
        )
      );
    }
  }

  if (platform === "meta" && !entry.pixelId) {
    issues.push(
      makeIssue(
        "missing-pixel-id",
        "warning",
        "Suspicious value — pixel ID missing.",
        "Meta Pixel requests should include an id parameter."
      )
    );
  }

  if (platform === "tiktok" && !entry.pixelId) {
    issues.push(
      makeIssue(
        "missing-pixel-id",
        "warning",
        "Suspicious value — pixel code missing.",
        "TikTok Pixel requests should include a pixel_code."
      )
    );
  }

  if (platform === "google_ads" && eventName === "conversion") {
    const convId = decoded.meta.conversionId;
    if (!convId) {
      issues.push(
        makeIssue(
          "missing-conversion-id",
          "warning",
          "Suspicious value — conversion ID missing.",
          "Google Ads conversion pings usually carry an AW-XXXXXXX identifier."
        )
      );
    }
  }

  // Numeric / currency sanity checks on purchase-like events.
  const rawValue = ecommerce?.value;
  if (isPurchaseEvent(platform, eventName) && rawValue !== undefined) {
    if (rawValue === 0) {
      issues.push(
        makeIssue(
          "suspicious-zero-value",
          "warning",
          "Suspicious value — event value is 0.",
          `"${eventName}" normally carries a positive transaction value.`
        )
      );
    } else if (typeof rawValue === "number" && rawValue < 0) {
      issues.push(
        makeIssue(
          "suspicious-negative-value",
          "warning",
          "Suspicious value — event value is negative.",
          `"${eventName}" value should not be negative.`
        )
      );
    }
  }

  const currency = entry.currency;
  if (currency !== undefined && !/^[A-Z]{3}$/.test(currency)) {
    issues.push(
      makeIssue(
        "suspicious-currency",
        "warning",
        `Suspicious value — currency "${currency}" is not a valid ISO 4217 code.`,
        "Currency should be a 3-letter code such as USD, EUR or PEN."
      )
    );
  }

  if (entry.transactionId !== undefined && /^\s*$/.test(entry.transactionId)) {
    issues.push(
      makeIssue(
        "suspicious-transaction-id",
        "warning",
        "Suspicious value — empty transaction ID.",
        "The transaction_id parameter is present but empty."
      )
    );
  } else if (
    entry.transactionId !== undefined &&
    /\s/.test(entry.transactionId)
  ) {
    issues.push(
      makeIssue(
        "suspicious-transaction-id",
        "warning",
        "Suspicious value — transaction ID contains whitespace.",
        `"${entry.transactionId}" looks malformed.`
      )
    );
  }

  // ---------------------------------------------------------------------
  // 2. Missing expected parameters
  // ---------------------------------------------------------------------
  const spec = knownEvent(platform, eventName);
  if (spec && spec.expected.length > 0) {
    const missing = spec.expected.filter((name) => {
      if (name === "items") return !hasItems(decoded);
      if (name === "value") {
        return !hasParamValue(decoded, name) && ecommerce?.value === undefined;
      }
      if (name === "currency") {
        return !hasParamValue(decoded, name) && ecommerce?.currency === undefined;
      }
      if (name === "transaction_id") {
        return !hasParamValue(decoded, name) && ecommerce?.transaction_id === undefined;
      }
      return !hasParamValue(decoded, name);
    });
    for (const name of missing) {
      issues.push(
        makeIssue(
          "missing-parameter",
          "warning",
          `Missing parameter — "${name}" not present on ${eventName}.`,
          spec.expected
            .filter((n) => n !== name)
            .map((n) => `✓ ${n}`)
            .join(", ") || undefined
        )
      );
    }
  }

  // ---------------------------------------------------------------------
  // 3. Possible duplicate / inconsistent payload (contextual)
  // ---------------------------------------------------------------------
  const sig = signature(entry);
  // Find the most recent prior event with the same signature.
  const prior = sig
    ? [...context.events].reverse().find((e) => signature(e) === sig)
    : undefined;
  const exactPrior = [...context.events]
    .reverse()
    .find((e) => e.url === raw.url && e.platform === platform);

  if (prior && isRecent(prior, now, DUPLICATE_WINDOW_MS)) {
    const gap = now - prior.timestamp;
    const what = entry.transactionId
      ? "the same transaction ID"
      : entry.eventId
        ? "the same event ID"
        : "the same page context";
    issues.push(
      makeIssue(
        "possible-duplicate",
        "warning",
        `Possible duplicate — same event + ${what}.`,
        `${entry.eventName} fired again ${gap}ms after the previous occurrence.`
      )
    );
  }

  if (
    exactPrior &&
    isRecent(exactPrior, now, EXACT_DUPLICATE_WINDOW_MS) &&
    exactPrior.eventName === eventName
  ) {
    issues.push(
      makeIssue(
        "possible-duplicate",
        "warning",
        "Possible duplicate — identical request sent twice.",
        `The exact same URL was captured ${now - exactPrior.timestamp}ms earlier.`
      )
    );
  }

  if (prior && !isRecent(prior, now, DUPLICATE_WINDOW_MS)) {
    // Same identifying key seen earlier (outside the duplicate window).
    const mismatches: string[] = [];
    if (
      prior.value !== undefined &&
      entry.value !== undefined &&
      prior.value !== entry.value
    ) {
      mismatches.push(`value (${prior.value} vs ${entry.value})`);
    }
    if (prior.currency && entry.currency && prior.currency !== entry.currency) {
      mismatches.push(`currency (${prior.currency} vs ${entry.currency})`);
    }
    if (mismatches.length > 0) {
      issues.push(
        makeIssue(
          "inconsistent-payload",
          "warning",
          `Inconsistent payload — the same ${
            entry.transactionId ? "transaction" : "event"
          } appears with different ${mismatches.join(" and ")}.`,
          "Two requests representing the same event carry conflicting values."
        )
      );
    }
  }

  // ---------------------------------------------------------------------
  // 4. Informational notices
  // ---------------------------------------------------------------------
  if (platform === "ga4" && q._dbg !== undefined) {
    const dbg = q._dbg === "1" || q._dbg === "true";
    if (dbg) {
      issues.push(
        makeIssue(
          "debug-mode",
          "info",
          "Debug mode is enabled for this event.",
          "Sent with _dbg=1 — this event shows in GA4 DebugView and may not reach production data."
        )
      );
    }
  }
  if (platform === "meta" && (q.dbg === "1" || q.dbg === "true")) {
    issues.push(
      makeIssue(
        "debug-mode",
        "info",
        "Debug mode is enabled for this event.",
        "The pixel was fired with dbg=1 — likely from the Meta Pixel Helper or a test."
      )
    );
  }

  return { issues, entry };
}