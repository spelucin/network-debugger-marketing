// @ts-check
/**
 * AI Provider — adapter layer for BYOK (Bring Your Own Key) requests.
 *
 * v1.1.0 ships with the Anthropic Claude adapter only. The registry shape
 * is designed so OpenAI and Gemini adapters can be added later with no
 * re-architecture — just add another entry to `PROVIDERS`.
 *
 * Runs in the extension service worker (MV3 `background` type: "module").
 * Pure except for `fetch` — callers can inject `fetchFn` for tests.
 *
 * Error contract: `executeRequest` rejects with a structured error:
 *   { type, message, retryAfter?, provider?, model? }
 * `type` is one of: 'invalid_key' | 'rate_limited' | 'server_error' |
 *   'context_too_large' | 'bad_request' | 'network' | 'timeout' |
 *   'aborted' | 'no_provider' | 'unknown'.
 */

/**
 * The shapes below are the adapter layer's written contract (#137 Slice 6).
 *
 * @typedef {Object} ChatMessage
 * @property {string} role
 * @property {string} content
 *
 * @typedef {Object} RequestOptions
 * @property {number} [maxTokens]
 * @property {number} [temperature]
 * @property {Object} [jsonSchema]
 * @property {string} [jsonSchemaName]
 * @property {string} [jsonSchemaDescription]
 * @property {boolean} [stream]
 * @property {number} [timeoutMs]
 *
 * @typedef {Object} ProviderModel
 * @property {string} id
 * @property {string} name
 * @property {number} costPer1kIn
 * @property {number} costPer1kOut
 * @property {string} tier
 *
 * @typedef {Object} SubscriptionTrap
 * @property {string} subscription
 * @property {string} distinction
 * @property {string} setupUrl
 * @property {string} setupLabel
 *
 * @typedef {Object} BuiltRequest
 * @property {string} url
 * @property {string} method
 * @property {Object<string, string>} headers
 * @property {string} body
 *
 * @typedef {Object} ParsedResponse
 * @property {string} text
 * @property {any} structured
 * @property {number} tokensIn
 * @property {number} tokensOut
 * @property {string|null} stopReason
 *
 * @typedef {Object} RateLimitBucket
 * @property {number|null} limit
 * @property {number|null} remaining
 * @property {number|null} resetAt
 *
 * @typedef {Object} RateLimitInfo
 * @property {RateLimitBucket|null} requests
 * @property {RateLimitBucket|null} tokens
 * @property {RateLimitBucket|null} inputTokens
 * @property {RateLimitBucket|null} outputTokens
 * @property {number} capturedAt
 *
 * Anything with a Headers-like get() — real fetch Headers in production,
 * plain stubs in tests.
 * @typedef {{ get: (name: string) => string|null }} HeaderReader
 *
 * @typedef {Object} ProviderAdapter
 * @property {string} id
 * @property {string} name
 * @property {string} shortName
 * @property {string} logoId
 * @property {string|null} brandColor
 * @property {string|null} brandColorDark
 * @property {string} tagline
 * @property {string} [freeTierNote]
 * @property {SubscriptionTrap} [subscriptionTrap]
 * @property {Array<ProviderModel>} models
 * @property {string} defaultModel
 * @property {string} endpoint
 * @property {string} modelsEndpoint
 * @property {string} keyIssuanceUrl
 * @property {Array<string>} hostOrigins
 * @property {(key: any) => boolean} validateKey
 * @property {(key: string) => string} maskKey
 * @property {(apiKey: string, model: string, messages: Array<ChatMessage>, options?: RequestOptions) => BuiltRequest} buildRequest
 * @property {(json: any) => ParsedResponse} parseResponse
 * @property {(headers?: HeaderReader|null) => RateLimitInfo|null} parseRateLimits
 * @property {(status: number, json: any) => { type: string }} classifyError
 *
 * The structured rejection shape every executeRequest() failure carries.
 * @typedef {Error & { type: string, httpStatus?: number, retryAfter?: number, provider?: string, model?: string }} StructuredError
 *
 * @typedef {ParsedResponse & { model: string, provider: string, costEstimate: number, rateLimits: RateLimitInfo|null }} ExecuteResult
 */

/**
 * Shared key sanity check. Deliberately minimal — just catches obviously
 * wrong pastes (empty, whitespace in middle, absurdly short). Format
 * validation is left to the provider's own API, which returns a clear
 * "invalid_key" error when the key is malformed. Providers change key
 * formats (e.g. Google's Gemini keys moved from `AIza…` to `AQ.…`
 * without documentation), so strict regex validation is a maintenance
 * trap that blocks legitimate keys.
 * @param {any} key
 * @returns {boolean}
 */
function sanityCheckKey(key) {
  if (typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.length < 10) return false;
  // Reject keys containing whitespace in the middle (usually a paste
  // glitch where part of the URL or a newline slipped in).
  if (/\s/.test(trimmed)) return false;
  return true;
}

// Costs are approximate as of April 2026 — used only for the in-session
// cost estimator, not for billing. Re-verify at each release.
//
// Provider order matters — Gemini first because its free tier removes
// all onboarding friction for new users. UI renders providers in this
// order.
/** @type {Object<string, ProviderAdapter>} */
const PROVIDERS = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    shortName: 'Gemini',
    logoId: 'gemini',
    brandColor: '#4285F4',
    brandColorDark: '#8AB4F8',
    tagline: 'Free tier — just a Google account',
    // Free-tier message surfaced in the Provider panel. Claude Max /
    // ChatGPT Plus users get a subscriptionTrap warning instead (see
    // anthropic and openai below).
    freeTierNote: 'Gemini has a free tier (generous daily quota) available from Google AI Studio — no credit card, no separate billing setup.',
    models: [
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', costPer1kIn: 0.0,    costPer1kOut: 0.0,    tier: 'free'  },
      { id: 'gemini-2.5-flash',      name: 'Gemini 2.5 Flash',      costPer1kIn: 0.0001, costPer1kOut: 0.0004, tier: 'fast'  },
      { id: 'gemini-2.5-pro',        name: 'Gemini 2.5 Pro',        costPer1kIn: 0.00125, costPer1kOut: 0.005, tier: 'smart' },
    ],
    defaultModel: 'gemini-2.5-flash-lite',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    modelsEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    keyIssuanceUrl: 'https://aistudio.google.com/apikey',
    hostOrigins: ['https://generativelanguage.googleapis.com/*'],

    validateKey: sanityCheckKey,

    maskKey(key) {
      if (typeof key !== 'string' || key.length < 8) return '••••';
      // Show first 4 + last 4 so the prefix (AIza / AQ. / future)
      // stays recognizable without leaking the secret middle.
      return `${key.slice(0, 4)}…${key.slice(-4)}`;
    },

    buildRequest(apiKey, model, messages, options = {}) {
      const system = messages.find((m) => m.role === 'system')?.content || '';
      const userContent = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));
      /** @type {{ maxOutputTokens: number, temperature?: number, responseMimeType?: string, responseSchema?: Object }} */
      const generationConfig = { maxOutputTokens: options.maxTokens ?? 1024 };
      if (options.temperature != null) generationConfig.temperature = options.temperature;
      if (options.jsonSchema) {
        generationConfig.responseMimeType = 'application/json';
        generationConfig.responseSchema = options.jsonSchema;
      }
      const body = {
        system_instruction: system ? { parts: [{ text: system }] } : undefined,
        contents: userContent,
        generationConfig,
      };
      const verb = options.stream ? 'streamGenerateContent' : 'generateContent';
      // Key goes in the query string per Google AI Studio convention. This
      // URL must never appear in analytics — see isOwnAmplitudeRequest() /
      // PII rules in analytics.js.
      return {
        url: `${this.endpoint}/${model}:${verb}?key=${encodeURIComponent(apiKey)}`,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      };
    },

    parseResponse(json) {
      const parts = json.candidates?.[0]?.content?.parts;
      const text = Array.isArray(parts)
        ? parts.map((p) => p?.text ?? '').filter(Boolean).join('')
        : '';
      let structured = null;
      if (text && text.trim().startsWith('{')) {
        try { structured = JSON.parse(text); } catch { structured = null; }
      }
      return {
        text,
        structured,
        tokensIn: json.usageMetadata?.promptTokenCount ?? 0,
        tokensOut: json.usageMetadata?.candidatesTokenCount ?? 0,
        stopReason: json.candidates?.[0]?.finishReason ?? null,
      };
    },

    // Gemini does not return rate-limit headers on success — quota
    // information is only delivered via 429 RESOURCE_EXHAUSTED. The
    // service worker tracks a local per-day request count to give the
    // user a rough fuel-gauge against the published free-tier ceiling.
    parseRateLimits(/* headers */) {
      return null;
    },

    classifyError(status, json) {
      if (status === 400) {
        const msg = json?.error?.message || '';
        if (/API key not valid|API_KEY_INVALID/i.test(msg)) return { type: 'invalid_key' };
        if (/context|token|too (long|large)/i.test(msg)) return { type: 'context_too_large' };
        return { type: 'bad_request' };
      }
      if (status === 401 || status === 403) return { type: 'invalid_key' };
      if (status === 429) return { type: 'rate_limited' };
      if (status >= 500) return { type: 'server_error' };
      return { type: 'unknown' };
    },
  },

  anthropic: {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    shortName: 'Claude',
    logoId: 'claude',
    brandColor: '#D97757',
    brandColorDark: '#E8906F',
    tagline: 'Claude Haiku, Sonnet, Opus',
    subscriptionTrap: {
      subscription: 'Claude Max / Claude Pro',
      distinction: 'Claude Max and Claude Pro subscriptions give you access to claude.ai and Claude Desktop — they do NOT include API access. The Anthropic API is a separate developer product with its own billing.',
      setupUrl: 'https://platform.claude.com',
      setupLabel: 'platform.claude.com',
    },
    models: [
      { id: 'claude-haiku-4-5',  name: 'Claude Haiku 4.5',  costPer1kIn: 0.001, costPer1kOut: 0.005, tier: 'fast'  },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', costPer1kIn: 0.003, costPer1kOut: 0.015, tier: 'smart' },
      { id: 'claude-opus-4-7',   name: 'Claude Opus 4.7',   costPer1kIn: 0.015, costPer1kOut: 0.075, tier: 'smart' },
    ],
    defaultModel: 'claude-haiku-4-5',
    endpoint: 'https://api.anthropic.com/v1/messages',
    modelsEndpoint: 'https://api.anthropic.com/v1/models',
    // Anthropic migrated the developer console from console.anthropic.com
    // to platform.claude.com (the old URL still redirects). Link directly
    // to the new one to skip the hop.
    keyIssuanceUrl: 'https://platform.claude.com/settings/keys',
    hostOrigins: ['https://api.anthropic.com/*'],

    validateKey: sanityCheckKey,

    maskKey(key) {
      if (typeof key !== 'string' || key.length < 8) return '••••';
      return `${key.slice(0, 7)}…${key.slice(-4)}`;
    },

    buildRequest(apiKey, model, messages, options = {}) {
      const system = messages.find((m) => m.role === 'system')?.content || '';
      const userMessages = messages.filter((m) => m.role !== 'system');
      /** @type {{ model: string, system: string, messages: Array<ChatMessage>, max_tokens: number, temperature?: number, tools?: Array<Object>, tool_choice?: Object, stream?: boolean }} */
      const body = {
        model,
        system,
        messages: userMessages,
        max_tokens: options.maxTokens ?? 1024,
      };
      if (options.temperature != null) body.temperature = options.temperature;
      if (options.jsonSchema) {
        // Anthropic structured output: a forced tool_use call with the
        // schema as the tool's input_schema.
        const toolName = options.jsonSchemaName || 'respond';
        body.tools = [{
          name: toolName,
          description: options.jsonSchemaDescription || 'Return the requested structured response.',
          input_schema: options.jsonSchema,
        }];
        body.tool_choice = { type: 'tool', name: toolName };
      }
      if (options.stream) body.stream = true;
      return {
        url: this.endpoint,
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
          // Pinned API version — bump deliberately after testing.
          'anthropic-version': '2023-06-01',
          // Required for browser-origin requests including extension
          // service workers. Safe here because the key lives on the
          // user's machine.
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
      };
    },

    parseResponse(json) {
      /** @type {Array<any>} */
      const content = Array.isArray(json.content) ? json.content : [];
      const toolBlock = content.find((b) => b && b.type === 'tool_use');
      const textBlock = content.find((b) => b && b.type === 'text');
      return {
        text: textBlock?.text ?? '',
        structured: toolBlock?.input ?? null,
        tokensIn: json.usage?.input_tokens ?? 0,
        tokensOut: json.usage?.output_tokens ?? 0,
        stopReason: json.stop_reason ?? null,
      };
    },

    // Anthropic returns four parallel quotas on every successful
    // response. `reset` is an ISO timestamp.
    // https://docs.anthropic.com/en/api/rate-limits#response-headers
    parseRateLimits(headers) {
      if (!headers || typeof headers.get !== 'function') return null;
      const bucket = (/** @type {string} */ prefix) => buildBucket(
        headers.get(`${prefix}-limit`),
        headers.get(`${prefix}-remaining`),
        parseIsoToMs(headers.get(`${prefix}-reset`)),
      );
      const requests = bucket('anthropic-ratelimit-requests');
      const tokens = bucket('anthropic-ratelimit-tokens');
      const inputTokens = bucket('anthropic-ratelimit-input-tokens');
      const outputTokens = bucket('anthropic-ratelimit-output-tokens');
      if (!requests && !tokens && !inputTokens && !outputTokens) return null;
      return { requests, tokens, inputTokens, outputTokens, capturedAt: Date.now() };
    },

    /**
     * Map an HTTP response to a structured error type.
     * `json` may be null when the body wasn't parseable.
     */
    classifyError(status, json) {
      if (status === 401 || status === 403) return { type: 'invalid_key' };
      if (status === 429) return { type: 'rate_limited' };
      if (status >= 500) return { type: 'server_error' };
      if (status === 400) {
        const msg = json?.error?.message || '';
        if (/context|token|too (long|large)/i.test(msg)) return { type: 'context_too_large' };
        return { type: 'bad_request' };
      }
      return { type: 'unknown' };
    },
  },

  openai: {
    id: 'openai',
    name: 'OpenAI',
    shortName: 'OpenAI',
    logoId: 'openai',
    brandColor: null,
    brandColorDark: null,
    tagline: 'GPT-5 family',
    subscriptionTrap: {
      subscription: 'ChatGPT Plus / Team / Enterprise',
      distinction: 'ChatGPT Plus, Team, and Enterprise subscriptions give you access to chatgpt.com — they do NOT include API access. The OpenAI API is a separate developer product with its own pay-as-you-go billing.',
      setupUrl: 'https://platform.openai.com',
      setupLabel: 'platform.openai.com',
    },
    models: [
      { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini',           costPer1kIn: 0.00075, costPer1kOut: 0.0045, tier: 'fast'  },
      { id: 'gpt-5.4',      name: 'GPT-5.4',                costPer1kIn: 0.0025,  costPer1kOut: 0.015,  tier: 'smart' },
      { id: 'o3-mini',      name: 'o3 Mini (reasoning)',    costPer1kIn: 0.0011,  costPer1kOut: 0.0044, tier: 'reasoning' },
    ],
    defaultModel: 'gpt-5.4-mini',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    modelsEndpoint: 'https://api.openai.com/v1/models',
    keyIssuanceUrl: 'https://platform.openai.com/api-keys',
    hostOrigins: ['https://api.openai.com/*'],

    validateKey: sanityCheckKey,

    maskKey(key) {
      if (typeof key !== 'string' || key.length < 8) return '••••';
      return `${key.slice(0, 3)}…${key.slice(-4)}`;
    },

    buildRequest(apiKey, model, messages, options = {}) {
      // GPT-5 family and o-series reasoning models reject `max_tokens` and
      // require `max_completion_tokens`. Every model currently listed for
      // this provider is in that set — if a legacy `gpt-4o` / `gpt-4-turbo`
      // model is ever re-added, gate this on a per-model flag in `models[]`.
      /** @type {{ model: string, messages: Array<ChatMessage>, max_completion_tokens: number, temperature?: number, response_format?: Object, stream?: boolean }} */
      const body = {
        model,
        messages,
        max_completion_tokens: options.maxTokens ?? 1024,
      };
      if (options.temperature != null) body.temperature = options.temperature;
      if (options.jsonSchema) {
        // OpenAI structured output: strict json_schema response_format.
        body.response_format = {
          type: 'json_schema',
          json_schema: {
            name: options.jsonSchemaName || 'response',
            schema: options.jsonSchema,
            strict: true,
          },
        };
      }
      if (options.stream) body.stream = true;
      return {
        url: this.endpoint,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      };
    },

    parseResponse(json) {
      const msg = json.choices?.[0]?.message || {};
      const text = typeof msg.content === 'string' ? msg.content : '';
      let structured = msg.parsed ?? null;
      if (!structured && text && text.trim().startsWith('{')) {
        try { structured = JSON.parse(text); } catch { structured = null; }
      }
      return {
        text,
        structured,
        tokensIn: json.usage?.prompt_tokens ?? 0,
        tokensOut: json.usage?.completion_tokens ?? 0,
        stopReason: json.choices?.[0]?.finish_reason ?? null,
      };
    },

    // OpenAI emits two quotas on every response. Reset is a duration
    // string (e.g. "6m0s", "1.234s") that we convert to a future ms
    // timestamp so the UI displays it the same way as Anthropic's ISO.
    // https://platform.openai.com/docs/guides/rate-limits/headers
    parseRateLimits(headers) {
      if (!headers || typeof headers.get !== 'function') return null;
      const now = Date.now();
      const requests = buildBucket(
        headers.get('x-ratelimit-limit-requests'),
        headers.get('x-ratelimit-remaining-requests'),
        now + parseDurationToMs(headers.get('x-ratelimit-reset-requests')),
      );
      const tokens = buildBucket(
        headers.get('x-ratelimit-limit-tokens'),
        headers.get('x-ratelimit-remaining-tokens'),
        now + parseDurationToMs(headers.get('x-ratelimit-reset-tokens')),
      );
      if (!requests && !tokens) return null;
      return { requests, tokens, inputTokens: null, outputTokens: null, capturedAt: now };
    },

    classifyError(status, json) {
      if (status === 401 || status === 403) return { type: 'invalid_key' };
      if (status === 429) return { type: 'rate_limited' };
      if (status >= 500) return { type: 'server_error' };
      if (status === 400) {
        const msg = json?.error?.message || '';
        const code = json?.error?.code || '';
        if (/context_length|too many tokens|maximum context/i.test(msg) || /context_length_exceeded/i.test(code)) {
          return { type: 'context_too_large' };
        }
        return { type: 'bad_request' };
      }
      return { type: 'unknown' };
    },
  },
};

export function listProviders() {
  return Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    name: p.name,
    shortName: p.shortName || p.name,
    logoId: p.logoId || null,
    brandColor: p.brandColor || null,
    brandColorDark: p.brandColorDark || null,
    tagline: p.tagline || '',
    models: p.models.map((m) => ({ ...m })),
    defaultModel: p.defaultModel,
    keyIssuanceUrl: p.keyIssuanceUrl,
    hostOrigins: [...p.hostOrigins],
    freeTierNote: p.freeTierNote || null,
    subscriptionTrap: p.subscriptionTrap ? { ...p.subscriptionTrap } : null,
  }));
}

/**
 * @param {string} providerId
 * @returns {ProviderAdapter|null}
 */
export function getProvider(providerId) {
  return PROVIDERS[providerId] || null;
}

/**
 * @param {string} providerId
 * @param {string} modelId
 * @returns {ProviderModel|null}
 */
export function getModel(providerId, modelId) {
  const p = PROVIDERS[providerId];
  if (!p) return null;
  return p.models.find((m) => m.id === modelId) || null;
}

/**
 * @param {string} providerId
 * @param {any} key
 */
export function validateKey(providerId, key) {
  const p = PROVIDERS[providerId];
  return !!p && p.validateKey(key);
}

/**
 * @param {string} providerId
 * @param {string} key
 */
export function maskKey(providerId, key) {
  const p = PROVIDERS[providerId];
  if (!p) return '••••';
  return p.maskKey(key);
}

/**
 * Estimate cost for a completed request. Returns 0 if model unknown.
 * @param {string} providerId
 * @param {string} modelId
 * @param {number} tokensIn
 * @param {number} tokensOut
 */
export function estimateCost(providerId, modelId, tokensIn, tokensOut) {
  const m = getModel(providerId, modelId);
  if (!m) return 0;
  return ((tokensIn || 0) / 1000) * m.costPer1kIn + ((tokensOut || 0) / 1000) * m.costPer1kOut;
}

// ─── Retry policy ────────────────────────────────────────────────────────────

/** @type {Object<string, { maxAttempts: number, baseDelayMs: number }>} */
const RETRY_POLICY = {
  rate_limited: { maxAttempts: 3, baseDelayMs: 1000 },
  server_error: { maxAttempts: 2, baseDelayMs: 1000 },
  network:      { maxAttempts: 2, baseDelayMs: 500 },
  timeout:      { maxAttempts: 1, baseDelayMs: 0 },
};

const DEFAULT_TIMEOUT_MS = 30_000;

/** @param {string|null} header */
function parseRetryAfter(header) {
  if (!header) return null;
  const seconds = parseInt(header, 10);
  if (!Number.isNaN(seconds) && seconds >= 0) return seconds * 1000;
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}

// ─── Rate-limit helpers (used by adapter parseRateLimits) ───────────────────

/**
 * Build a normalised quota bucket. Returns null if neither limit nor
 * remaining is parseable — providers occasionally omit individual
 * dimensions (e.g. some Anthropic responses lack input/output split).
 * @param {string|null|undefined} limit
 * @param {string|null|undefined} remaining
 * @param {number|null|undefined} resetAtMs
 * @returns {RateLimitBucket|null}
 */
export function buildBucket(limit, remaining, resetAtMs) {
  const lim = parseIntOrNull(limit);
  const rem = parseIntOrNull(remaining);
  if (lim == null && rem == null) return null;
  return { limit: lim, remaining: rem, resetAt: typeof resetAtMs === 'number' && Number.isFinite(resetAtMs) ? resetAtMs : null };
}

/** @param {any} v */
function parseIntOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse an ISO 8601 timestamp string to ms-since-epoch. Anthropic uses
 * this format on `*-reset` headers. Returns null on parse failure.
 * @param {string|null|undefined} iso
 * @returns {number|null}
 */
export function parseIsoToMs(iso) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Parse an OpenAI-style duration string ("6m0s", "1.234s", "7d2h",
 * "100ms") into milliseconds. Used to add to `Date.now()` so the UI
 * can store a future absolute timestamp.
 *
 * Returns 0 (not null) when parsing fails — the caller adds it to
 * `Date.now()` and a 0 yields "expired", which is honest about not
 * knowing rather than implying a fresh window.
 * @param {string|null|undefined} s
 * @returns {number}
 */
export function parseDurationToMs(s) {
  if (!s || typeof s !== 'string') return 0;
  let total = 0;
  // Tokenise "<number><unit>" segments. matchAll is preferred over
  // RegExp's stateful API to avoid lint flags about the legacy method.
  const re = /(\d+(?:\.\d+)?)(ms|d|h|m|s)/g;
  for (const match of s.matchAll(re)) {
    const n = parseFloat(match[1]);
    if (!Number.isFinite(n)) continue;
    switch (match[2]) {
      case 'ms': total += n; break;
      case 's':  total += n * 1000; break;
      case 'm':  total += n * 60_000; break;
      case 'h':  total += n * 3_600_000; break;
      case 'd':  total += n * 86_400_000; break;
    }
  }
  return total;
}

/**
 * @param {number} ms
 * @param {AbortSignal} [signal]
 */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(structuredError('aborted', 'Request aborted'));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(structuredError('aborted', 'Request aborted'));
      },
      { once: true },
    );
  });
}

/**
 * @param {string} type
 * @param {string} message
 * @param {Object} [extras]
 * @returns {StructuredError}
 */
function structuredError(type, message, extras = {}) {
  const err = /** @type {StructuredError} */ (new Error(message));
  err.type = type;
  Object.assign(err, extras);
  return err;
}

/** @param {Response} response */
async function safeParseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// ─── In-flight dedup ─────────────────────────────────────────────────────────

/** @type {Map<string, Promise<any>>} */
const inflight = new Map(); // hash → Promise

/** @param {{ provider: string, model: string, messages: Array<ChatMessage>, options: Object }} req */
function hashRequest({ provider, model, messages, options }) {
  // Small, deterministic fingerprint. Not cryptographic — collisions just
  // mean two different requests share a Promise, which for identical
  // semantic requests is the desired behavior anyway.
  const str = JSON.stringify({ provider, model, messages, options });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return `${provider}:${model}:${hash}`;
}

export function clearInflight() {
  inflight.clear();
}

// ─── executeRequest ──────────────────────────────────────────────────────────

/**
 * Execute a BYOK request against the configured provider.
 *
 * @param {Object} req
 * @param {string} req.provider - provider id (e.g. 'anthropic')
 * @param {string} req.apiKey
 * @param {string} req.model
 * @param {Array<{role: string, content: string}>} req.messages
 * @param {RequestOptions} [req.options] - passed through to adapter.buildRequest
 * @param {typeof fetch} [req.fetchFn] - injectable for tests
 * @param {AbortSignal} [req.signal]
 * @param {boolean} [req.dedupe=true] - dedupe identical in-flight requests
 * @returns {Promise<ExecuteResult>}
 */
export async function executeRequest(req) {
  const {
    provider,
    apiKey,
    model,
    messages,
    options = {},
    fetchFn = globalThis.fetch,
    signal,
    dedupe = true,
  } = req;

  const adapter = PROVIDERS[provider];
  if (!adapter) {
    throw structuredError('no_provider', `Unknown provider: ${provider}`);
  }
  if (!adapter.validateKey(apiKey)) {
    throw structuredError('invalid_key', 'API key format is invalid.');
  }
  if (!model || !adapter.models.some((m) => m.id === model)) {
    // Don't block — unknown model may still be valid (power user typed an
    // unlisted model id). Warn via the provider itself by forwarding the
    // request.
  }

  const key = hashRequest({ provider, model, messages, options });
  if (dedupe && inflight.has(key)) {
    return inflight.get(key);
  }

  const run = (async () => {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    const attempt = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
      // Named so it can be removed on success too — { once: true } only
      // auto-removes if it FIRES. On a non-aborted request it never fires, so a
      // long-lived caller `signal` shared across requests (or our own retries)
      // would otherwise accumulate listeners (N11, feature #139).
      const onSignalAbort = () => controller.abort(new Error('aborted'));
      if (signal) {
        if (signal.aborted) controller.abort(new Error('aborted'));
        else signal.addEventListener('abort', onSignalAbort, { once: true });
      }
      const cleanup = () => {
        clearTimeout(timeoutId);
        if (signal) signal.removeEventListener('abort', onSignalAbort);
      };

      const { url, method, headers, body } = adapter.buildRequest(apiKey, model, messages, options);

      let response;
      try {
        response = await fetchFn(url, { method, headers, body, signal: controller.signal });
      } catch (err) {
        cleanup();
        const e = /** @type {any} */ (err);
        // Distinguish timeout from network error via the controller reason.
        const isTimeout = e?.name === 'AbortError' && controller.signal.reason?.message === 'timeout';
        const isUserAbort = e?.name === 'AbortError' && signal?.aborted;
        if (isTimeout) throw structuredError('timeout', 'Request timed out');
        if (isUserAbort) throw structuredError('aborted', 'Request aborted');
        throw structuredError('network', e?.message || 'Network error');
      }
      cleanup();

      if (response.ok) {
        const json = await safeParseJson(response);
        if (!json) throw structuredError('unknown', 'Empty response body');
        const parsed = adapter.parseResponse(json);
        const rateLimits = typeof adapter.parseRateLimits === 'function'
          ? adapter.parseRateLimits(response.headers)
          : null;
        return {
          ...parsed,
          model,
          provider,
          costEstimate: estimateCost(provider, model, parsed.tokensIn, parsed.tokensOut),
          rateLimits,
        };
      }

      const errJson = await safeParseJson(response);
      const classified = adapter.classifyError(response.status, errJson);
      const message = errJson?.error?.message
        || errJson?.message
        || `HTTP ${response.status}`;
      const retryAfter = response.status === 429
        ? parseRetryAfter(response.headers.get('retry-after'))
        : null;
      throw structuredError(classified.type, message, {
        httpStatus: response.status,
        retryAfter: retryAfter ?? undefined,
        provider,
        model,
      });
    };

    let lastErr;
    // Track per-type attempt counts so we don't let one category exhaust
    // the other's budget.
    /** @type {Object<string, number>} */
    const attempts = { rate_limited: 0, server_error: 0, network: 0, timeout: 0 };
    for (let i = 0; i < 6; i++) {
      try {
        return await attempt();
      } catch (err) {
        lastErr = err;
        const e = /** @type {StructuredError} */ (err);
        const policy = RETRY_POLICY[e.type];
        if (!policy) throw err;
        attempts[e.type] = (attempts[e.type] || 0) + 1;
        if (attempts[e.type] >= policy.maxAttempts) throw err;

        const backoff = e.retryAfter != null && e.type === 'rate_limited'
          ? e.retryAfter
          : policy.baseDelayMs * Math.pow(2, attempts[e.type] - 1);
        await sleep(Math.min(backoff, 30_000), signal);
      }
    }
    throw lastErr;
  })();

  if (dedupe) {
    inflight.set(key, run);
    run.finally(() => inflight.delete(key));
  }
  return run;
}

// ─── Test connection ─────────────────────────────────────────────────────────

/**
 * Minimal request to verify the key works. Uses the smallest model + lowest
 * max_tokens so the cost is effectively zero.
 * @param {{ provider: string, apiKey: string, model?: string, fetchFn?: typeof fetch }} cfg
 */
export async function testConnection({ provider, apiKey, model, fetchFn }) {
  const adapter = PROVIDERS[provider];
  if (!adapter) throw structuredError('no_provider', `Unknown provider: ${provider}`);
  const testModel = model || adapter.defaultModel;
  try {
    const result = await executeRequest({
      provider,
      apiKey,
      model: testModel,
      messages: [
        { role: 'system', content: 'Reply with the single word: OK' },
        { role: 'user', content: 'ping' },
      ],
      options: { maxTokens: 16, timeoutMs: 15_000 },
      fetchFn,
      dedupe: false,
    });
    return { success: true, model: testModel, tokensIn: result.tokensIn, tokensOut: result.tokensOut };
  } catch (err) {
    const e = /** @type {StructuredError} */ (err);
    return { success: false, type: e.type || 'unknown', message: e.message };
  }
}
