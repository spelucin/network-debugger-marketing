# Network Decoder

A Chrome extension that shows the marketing requests your browser sends to GA4, Meta, TikTok and more — decoded live in your sidebar. Everything stays local.

## Features

- **Live capture** — intercepts tracking beacons as you browse via `chrome.webRequest`, with no external services involved
- **Decoded events** — raw query params and request bodies are parsed into human-readable events with typed parameters (strings, numbers, currency, URLs, JSON…)
- **Parameter docs inline** — known parameters are labeled and linked to official platform documentation; unknown ones are flagged as custom
- **Ecommerce breakdown** — items, transaction ids, value/currency pulled out of purchase-style events
- **Platform detection** — detects SDK loader scripts (GTM container ids, GA4 measurement ids, pixel ids…) even before any beacon fires
- **Recording scopes** — transient capture-only view by default; opt-in to record the current tab or every tab, with a configurable retention limit
- **Export** — copy or download captured requests

## Supported platforms

GA4 · Google Ads · Meta · TikTok · Google Tag Manager · Microsoft Clarity · Amplitude · Mixpanel · Matomo · LinkedIn · Reddit · Pinterest · Bing · Twitter/X · Snapchat · Adobe · Segment · Heap · Criteo · HubSpot · Hotjar · Piwik · Optimizely · YouTube

## Getting started

Requirements: Node.js 18+, Chrome 116+.

```sh
npm install
npm run dev        # watch-mode build → dist/
```

Then load the extension:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` directory
4. Click the extension icon to open the side panel on any page

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Watch build (Vite + esbuild content scripts) |
| `npm run build` | One-shot production build into `dist/` |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint (`src`, zero warnings allowed) |
| `npm run test` | Vitest suite |
| `npm run icons` | Regenerate icon assets |
| `npm run verify` | typecheck + lint + test + build |

## Architecture

- `src/background/` — MV3 service worker: webRequest interception, tab tracking, capture stats
- `src/content/` — page-world script that lifts SDK identifiers plus an isolated-world relay back to the worker
- `src/parsers/` — one parser per platform turning raw requests into decoded events
- `src/definitions/` — parameter dictionaries, docs links, and known-event schemas per platform
- `src/sidepanel/` — React UI: request list, filters, event detail view
- `src/options/` — options page
- `src/core/`, `src/shared/` — normalized data model, URL classification, messaging

Content scripts are bundled as classic IIFE scripts with esbuild; everything else goes through Vite. Static assets (`manifest.json`, icons) are copied to `dist/` by `scripts/build.mjs`.

## Privacy

All parsing happens locally in your browser. No data leaves your machine — there are no servers, no telemetry, no analytics of its own.
