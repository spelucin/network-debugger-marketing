// Script Initiator Icons
// SVG icons indicating how a script was loaded (website, tag manager, or another script)

// Import detection logic from shared module
import {
  getScriptInitiatorType,
  getInitiatorUrl,
  getInitiatorCallStack,
  isDocumentUrl
} from '../../shared/detection/script-initiator.js';

// Import tag manager patterns from shared module
import { TAG_MANAGER_PATTERNS } from '../../shared/detection/tag-manager-patterns.js';

// Re-export detection functions for backward compatibility
export {
  getScriptInitiatorType,
  getInitiatorUrl,
  getInitiatorCallStack,
  isDocumentUrl,
  TAG_MANAGER_PATTERNS
};

export const SCRIPT_INITIATOR_ICONS = {
  // Website/Parser - script tag was in HTML source, loaded directly by browser
  website: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,

  // Tag Manager - script was injected by GTM, Tealium, Adobe Launch, etc.
  tagmanager: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><circle cx="7" cy="7" r="1.5" fill="currentColor"/></svg>`,

  // Script dependency - loaded by another script (e.g., CMP loading a pixel)
  // Git-fork style: vertical line with curved branch going up-right
  script: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="5" r="3"/><circle cx="7" cy="19" r="3"/><circle cx="17" cy="12" r="3"/><path d="M7 8v8"/><path d="M7 14q0-2 7-2"/></svg>`,

  // Unknown/fallback - use website icon as default
  unknown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
};
