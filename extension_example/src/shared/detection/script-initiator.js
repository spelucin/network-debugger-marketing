// @ts-check
// Script Initiator Detection - Determines how scripts were loaded
// Uses CDP (Chrome DevTools Protocol) _initiator data from HAR entries
// Used by panel for Script Tree view and initiator badges

import { TAG_MANAGER_PATTERNS } from './tag-manager-patterns.js';

/**
 * CDP `_initiator` shapes as they arrive on HAR entries.
 * @typedef {Object} CdpCallFrame
 * @property {string} [url]
 *
 * @typedef {Object} CdpStack
 * @property {Array<CdpCallFrame>} [callFrames]
 * @property {CdpStack} [parent]
 *
 * @typedef {Object} CdpInitiator
 * @property {string} [type]
 * @property {string} [url]
 * @property {CdpStack} [stack]
 */

/**
 * Check if a URL is a document/HTML page (not a script)
 * Used to detect when initiator type is 'script' but the URL is actually the HTML document
 * @param {string} url - URL to check
 * @returns {boolean} True if this appears to be a document URL, not a script
 */
export function isDocumentUrl(url) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    // Check if it ends with common document extensions or has no extension (typical for HTML pages)
    // Scripts typically end in .js or have .js? with query params
    if (pathname.endsWith('.js')) return false;
    if (pathname.includes('.js?')) return false;
    // Common document patterns: /, /path, /path/, .html, .htm, .php, .asp, etc.
    if (pathname === '/' || pathname.endsWith('/')) return true;
    if (pathname.endsWith('.html') || pathname.endsWith('.htm')) return true;
    if (pathname.endsWith('.php') || pathname.endsWith('.asp') || pathname.endsWith('.aspx')) return true;
    // No extension in the last path segment = likely a document route
    const lastSegment = pathname.split('/').pop() || '';
    if (!lastSegment.includes('.')) return true;
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Determine the initiator type for a script based on CDP initiator data
 * @param {CdpInitiator|null|undefined} initiator - The _initiator object from HAR entry
 * @returns {'website'|'tagmanager'|'script'|'unknown'} The initiator type
 */
export function getScriptInitiatorType(initiator) {
  if (!initiator) return 'unknown';

  // Parser = loaded directly from HTML
  if (initiator.type === 'parser') {
    return 'website';
  }

  // Script = loaded by another script
  if (initiator.type === 'script' && initiator.stack) {
    const frames = initiator.stack.callFrames || [];

    // Get the first frame URL (immediate initiator)
    const firstFrameUrl = frames.length > 0 ? (frames[0].url || '') : '';

    // If the initiator URL is a document (not a .js file), treat as website
    // This happens with inline scripts or document.write() loading external scripts
    if (isDocumentUrl(firstFrameUrl)) {
      return 'website';
    }

    // Check all frames in the call stack for Tag Manager URLs
    for (const frame of frames) {
      const frameUrl = frame.url || '';
      if (TAG_MANAGER_PATTERNS.some(pattern => pattern.test(frameUrl))) {
        return 'tagmanager';
      }
    }

    // Not a Tag Manager, but still loaded by a script
    return 'script';
  }

  // Preload or other types default to website
  return 'website';
}

/**
 * Extract the initiator URL from CDP initiator data
 * @param {CdpInitiator|null|undefined} initiator - The _initiator object from HAR entry
 * @returns {string|null} The URL of the script that initiated this load
 */
export function getInitiatorUrl(initiator) {
  if (!initiator) return null;

  // For parser, the initiator is the document URL
  if (initiator.type === 'parser' && initiator.url) {
    return initiator.url;
  }

  // For script, get the URL from the call stack
  if (initiator.type === 'script' && initiator.stack) {
    const frames = initiator.stack.callFrames || [];
    // Return the first frame's URL (top of call stack = immediate initiator)
    if (frames.length > 0 && frames[0].url) {
      return frames[0].url;
    }
  }

  return null;
}

/**
 * Get all URLs from the initiator call stack, walking the full async-parent
 * chain. Many real-world initiators (especially anything dispatched via
 * setTimeout / setInterval / Promise / Image()) carry an empty top-level
 * `callFrames` — the actual loader is nested under `stack.parent` (and
 * sometimes `parent.parent...`). Walking the chain is what lets Stack View
 * attribute, e.g., a Tealium-fired Adobe Analytics beacon back to utag.js
 * even though the synchronous frame at request-finish time is empty.
 *
 * @param {CdpInitiator|null|undefined} initiator - The _initiator object from HAR entry
 * @returns {string[]} De-duplicated URLs across the full async stack
 */
export function getInitiatorCallStack(initiator) {
  if (!initiator || !initiator.stack) return [];

  /** @type {string[]} */
  const urls = [];
  const seen = new Set();
  /** @type {CdpStack|undefined} */
  let stack = initiator.stack;
  let safety = 32;

  while (stack && safety-- > 0) {
    const frames = stack.callFrames || [];
    for (const frame of frames) {
      if (frame.url && !seen.has(frame.url)) {
        seen.add(frame.url);
        urls.push(frame.url);
      }
    }
    stack = stack.parent;
  }

  return urls;
}
