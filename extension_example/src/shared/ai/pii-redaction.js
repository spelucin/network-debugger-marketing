// @ts-check
/**
 * PII Redaction — defense-in-depth for BYOK AI requests.
 *
 * Redacts common credential / identity patterns from event data before it
 * leaves the extension for an external AI provider. This is intentionally
 * conservative: false positives are preferable to leaking real secrets.
 *
 * NOT a privacy guarantee — the user chose to send event data to a third
 * party when they configured BYOK. This layer catches accidental leakage
 * of things the user probably didn't intend to share (emails in params,
 * JWTs in headers, bearer tokens in initiator stacks).
 *
 * Scope (v1 — heuristic-only, no entropy detection):
 *   - Email addresses
 *   - North American / E.164-ish phone numbers
 *   - Credit-card-looking digit runs (13–19 digits)
 *   - JWTs (three base64url segments separated by dots)
 *   - Bearer tokens in Authorization headers
 *   - Common API key prefixes (sk-*, sk-ant-*, AIza*, xoxb-*, ghp_*, github_pat_*)
 *
 * Schema: consumers pass in a value (string / object / array) — the
 * function returns a value with strings redacted. Subtrees that needed no
 * redaction are returned by ORIGINAL reference (#131 F9) — treat the result
 * as immutable. Object keys are not redacted (keys are usually semantic).
 * Non-string leaves are passed through untouched.
 */

const PATTERNS = [
  // Bearer tokens first — they often contain substrings that would match
  // API-key patterns on their own, so redacting the whole token is cleaner.
  { name: 'bearer', regex: /Bearer\s+[\w.\-+/=]+/gi, replacement: 'Bearer [REDACTED]' },

  // API key prefixes used by major providers. Ordered by specificity so
  // sk-ant-* beats the generic sk-* rule.
  { name: 'anthropic_key', regex: /sk-ant-[A-Za-z0-9_\-]{20,}/g, replacement: '[REDACTED_ANTHROPIC_KEY]' },
  { name: 'openai_key', regex: /sk-[A-Za-z0-9_\-]{20,}/g, replacement: '[REDACTED_OPENAI_KEY]' },
  { name: 'google_key', regex: /AIza[A-Za-z0-9_\-]{20,}/g, replacement: '[REDACTED_GOOGLE_KEY]' },
  { name: 'slack_bot', regex: /xox[baprs]-[A-Za-z0-9\-]{10,}/g, replacement: '[REDACTED_SLACK_TOKEN]' },
  { name: 'github_pat', regex: /(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/g, replacement: '[REDACTED_GITHUB_TOKEN]' },

  // JWT — three base64url segments joined by dots. Common in auth cookies
  // and initiator stacks.
  { name: 'jwt', regex: /eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/g, replacement: '[REDACTED_JWT]' },

  // Email — RFC 5322 is too permissive; this catches the common case
  // without pulling in the kitchen sink.
  { name: 'email', regex: /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, replacement: '[REDACTED_EMAIL]' },

  // Credit-card-shaped digit runs (with optional spaces/dashes every 4).
  // Requires 14–19 digits total. 13-digit Visa legacy is effectively
  // extinct and collides with 13-digit Unix millisecond timestamps.
  { name: 'credit_card', regex: /\b(?:\d[ \-]?){13,18}\d\b/g, replacement: '[REDACTED_CC]' },

  // E.164 phone numbers (+ country code followed by 7–14 digits, optional
  // separators). Conservative — won't catch every local format.
  { name: 'phone_e164', regex: /\+\d{1,3}[\s\-]?(?:\(?\d{1,4}\)?[\s\-]?){1,4}\d{2,4}\b/g, replacement: '[REDACTED_PHONE]' },
];

// Combined pre-test (#131 F9) — one alternation over every pattern source,
// derived mechanically from PATTERNS so it can never drift out of sync when
// a pattern is added. Case-insensitive, which makes it a strict SUPERSET
// matcher (a false-positive pre-test just runs the 9 passes and redacts
// nothing; a false negative would be a leak, which the superset direction
// makes impossible). Non-global on purpose: .test() on a /g regex mutates
// lastIndex and would skip matches on subsequent calls.
const QUICK_TEST = new RegExp(PATTERNS.map((p) => `(?:${p.regex.source})`).join('|'), 'i');

/**
 * Redact a single string. Returns the ORIGINAL string reference when no
 * pattern can match (the overwhelmingly common case — one combined scan
 * instead of 9 sequential passes).
 * @param {string} s
 * @returns {string}
 */
export function redactString(s) {
  if (typeof s !== 'string' || s.length === 0) return s;
  if (!QUICK_TEST.test(s)) return s;
  let out = s;
  for (const { regex, replacement } of PATTERNS) {
    out = out.replace(regex, replacement);
  }
  return out;
}

/**
 * Redact any value (string / array / plain object / primitive). Class
 * instances are passed through untouched — we only recurse into plain
 * objects and arrays. Keys are preserved as-is.
 *
 * Clean subtrees return the ORIGINAL reference (#131 F9) — a copy is only
 * allocated along paths where something was actually redacted. Treat the
 * result as immutable; the sole consumer (prompt-templates.js) already
 * receives the raw original on its non-redacting branch, so the no-mutation
 * contract holds for both branches.
 *
 * @param {*} value
 * @returns {*}
 */
export function redactValue(value) {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) {
    let out = null; // allocated lazily on first changed element
    for (let i = 0; i < value.length; i++) {
      const r = redactValue(value[i]);
      if (out === null && r !== value[i]) out = value.slice(0, i);
      if (out !== null) out.push(r);
    }
    return out === null ? value : out;
  }
  if (value && typeof value === 'object' && value.constructor === Object) {
    /** @type {Object<string, *>|null} */
    let out = null; // allocated lazily on first changed property
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const r = redactValue(value[key]);
      if (out === null && r !== value[key]) {
        out = {};
        for (let j = 0; j < i; j++) out[keys[j]] = value[keys[j]];
      }
      if (out !== null) out[key] = r;
    }
    return out === null ? value : out;
  }
  return value;
}

/**
 * Redact a prompt-template data payload before it's sent to a provider.
 * Thin wrapper around `redactValue` — named for clarity at the call site.
 *
 * @param {*} data
 * @returns {*}
 */
export function redactPromptData(data) {
  return redactValue(data);
}

/**
 * Exposed for tests and diagnostics. Do not mutate.
 */
export const REDACTION_PATTERNS = PATTERNS.map((p) => ({ name: p.name, replacement: p.replacement }));
