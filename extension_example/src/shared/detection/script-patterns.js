// @ts-check
// Script Load Patterns - Single source of truth for detecting known marketing/analytics scripts
// Used by both badge detection (service worker) and panel (DevTools)

/**
 * Known marketing/analytics scripts detected when loaded
 * Each entry: { pattern: string/regex, platformId: string, name: string, idExtract?: RegExp }
 */
export const KNOWN_SCRIPT_LOADS = [
  // PostHog SDK (config first — more specific pattern must match before broad catch-all)
  { pattern: 'posthog.com/array/', platformId: 'posthog', name: 'PostHog' },
  { pattern: '.posthog.com/', platformId: 'posthog', name: 'PostHog', filenameExtract: true },

  // Analytics & Session Replay
  { pattern: 'static.hotjar.com/c/hotjar-', platformId: 'hotjar', name: 'Hotjar', idExtract: /hotjar-(\d+)/ },
  { pattern: 'clarity.ms/tag/', platformId: 'clarity', name: 'Microsoft Clarity', idExtract: /tag\/([^?]+)/ },
  { pattern: 'cdn.mouseflow.com/projects/', platformId: 'mouseflow', name: 'Mouseflow', idExtract: /projects\/([^/]+)/ },
  { pattern: 'script.crazyegg.com/pages/', platformId: 'crazyegg', name: 'Crazy Egg', idExtract: /pages\/scripts\/(\d+\/\d+)/ },
  { pattern: 'cdn.heapanalytics.com/js/heap-', platformId: 'heap', name: 'Heap', idExtract: /heap-(\d+)/ },
  { pattern: 'cdn.amplitude.com', platformId: 'amplitude', name: 'Amplitude' },
  { pattern: 'cdn.segment.com/analytics.js', platformId: 'segment', name: 'Segment' },
  { pattern: 'cdn.rudderlabs.com', platformId: 'rudderstack', name: 'RudderStack' },
  { pattern: 'cdn.mxpnl.com', platformId: 'mixpanel', name: 'Mixpanel' },

  // Marketing & Reviews
  { pattern: 'widget.trustpilot.com', platformId: 'trustpilot', name: 'Trustpilot' },
  { pattern: 'connect.facebook.net', platformId: 'facebook', name: 'Facebook' },
  { pattern: 'snap.licdn.com/li.lms-analytics', platformId: 'linkedin', name: 'LinkedIn' },
  { pattern: 'static.ads-twitter.com/uwt.js', platformId: 'twitter', name: 'Twitter/X' },
  { pattern: 'analytics.tiktok.com', platformId: 'tiktok', name: 'TikTok' },
  { pattern: 'www.googleadservices.com/pagead/conversion_async.js', platformId: 'google-ads-conversion', name: 'Google Ads Conversion' },
  { pattern: 'securepubads.g.doubleclick.net/pagead/managed', platformId: 'google-publisher-tag', name: 'Google Publisher Tag' },
  { pattern: 'pagead2.googlesyndication.com', platformId: 'google-publisher-tag', name: 'Google Publisher Tag' },
  { pattern: 'sc-static.net/scevent', platformId: 'snapchat', name: 'Snapchat' },
  { pattern: 'bat.bing.com/bat.js', platformId: 'bing', name: 'Bing Ads' },
  { pattern: 'scripts.clarity.ms', platformId: 'clarity', name: 'Microsoft Clarity' },

  // Ad Tech
  { pattern: 'track.adform.net/serving/scripts/trackpoint', platformId: 'adform', name: 'Adform' },
  { pattern: 's2.adform.net/banners/scripts/st/trackpoint', platformId: 'adform', name: 'Adform' },

  // Tag Managers
  { pattern: 'tags.tiqcdn.com/utag/', platformId: 'tealium', name: 'Tealium', idExtract: /utag\/([^/]+\/[^/]+)/ },
  { pattern: /\/utag\.\d+\.js(\?|$)/, platformId: 'tealium', name: 'Tealium' },  // Tealium vendor tag scripts (first-party or custom CDN)
  { pattern: /\/utag\.js(\?|$)/, platformId: 'tealium', name: 'Tealium' },  // First-party hosted Tealium
  { pattern: /\/utag\.sync\.js(\?|$)/, platformId: 'tealium', name: 'Tealium' },
  { pattern: 'assets.adobedtm.com', platformId: 'adobe-launch', name: 'Adobe Tags' },
  { pattern: /\/launch-[A-Za-z0-9]+-[^/]+\.min\.js(\?|$)/, platformId: 'adobe-launch', name: 'Adobe Tags' },  // First-party hosted

  // Chat & Support
  { pattern: 'widget.intercom.io', platformId: 'intercom', name: 'Intercom' },
  { pattern: 'js.driftt.com', platformId: 'drift', name: 'Drift' },
  { pattern: 'embed.tawk.to', platformId: 'tawk', name: 'Tawk.to' },
  { pattern: 'static.zdassets.com', platformId: 'zendesk', name: 'Zendesk' },

  // Consent
  { pattern: 'cdn.cookielaw.org', platformId: 'onetrust', name: 'OneTrust' },
  { pattern: 'consent.cookiebot.com', platformId: 'cookiebot', name: 'Cookiebot' },

  // A/B Testing
  { pattern: 'cdn.optimizely.com', platformId: 'optimizely', name: 'Optimizely' },
  { pattern: 'dev.visualwebsiteoptimizer.com', platformId: 'vwo', name: 'VWO' },

  // Call Tracking
  { pattern: 'insight.bellmetric.net', platformId: 'bmetric', name: 'Bmetric' },
  { pattern: 'bellmetric.net', platformId: 'bmetric', name: 'Bmetric' },
  { pattern: 'web.telemetric.dk', platformId: 'bmetric', name: 'Bmetric' },
  { pattern: 'telemetric.dk', platformId: 'bmetric', name: 'Bmetric' }
];

/**
 * Match a URL against known script load patterns
 * @param {string} url - The request URL
 * @param {string} [resourceType] - Optional resource type ('script' to filter non-scripts)
 * @returns {{ platformId: string, name: string, scriptId: string|null } | null}
 */
export function matchScriptLoad(url, resourceType) {
  // Only check for script/JS files if resourceType is provided
  if (resourceType && resourceType !== 'script' && !url.endsWith('.js') && !url.includes('.js?')) {
    return null;
  }

  for (const script of KNOWN_SCRIPT_LOADS) {
    const isMatch = script.pattern instanceof RegExp
      ? script.pattern.test(url)
      : url.includes(script.pattern);

    if (isMatch) {
      let scriptId = null;
      if (script.idExtract) {
        const match = url.match(script.idExtract);
        if (match) {
          scriptId = match[1];
        }
      }
      // Filename extraction: use the .js filename from the URL path
      if (!scriptId && script.filenameExtract) {
        try {
          const filename = new URL(url).pathname.split('/').pop();
          if (filename) scriptId = filename;
        } catch (e) { /* ignore */ }
      }
      return {
        platformId: script.platformId,
        name: script.name,
        scriptId
      };
    }
  }
  return null;
}
