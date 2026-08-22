// ============================================================
// Smart Search Module — enhanced keyword search for the toolbar
// Parses natural language queries into structured filter objects
// that control both tool chip visibility and event stream filtering.
// ============================================================

let _deps;

/**
 * Initialize the smart search module with dependencies from panel.js.
 * @param {Object} deps - { getState, elements, render, trackEvent, PLATFORM_NAMES, PLATFORM_CATEGORIES, KNOWN_TRACKING_ENDPOINTS, platformToCategory }
 */
export function initSmartSearch(deps) {
  _deps = deps;
}

// ----------------------------------------
// Platform and category aliases
// ----------------------------------------

// Maps common names/abbreviations to platform IDs
const PLATFORM_ALIASES = {
  // Google Analytics
  'ga4': ['ga4'],
  'google analytics': ['ga4'],
  'google analytics 4': ['ga4'],
  // Universal Analytics (legacy)
  'universal analytics': ['universal-analytics'],
  'ua': ['universal-analytics'],
  // Google Tag Manager
  'gtm': ['gtm'],
  'google tag manager': ['gtm'],
  // GTAG
  'gtag': ['gtag'],
  // Server-side GTM
  'sgtm': ['sgtm'],
  'ss-gtm': ['sgtm'],
  'server-side gtm': ['sgtm'],
  'server side': ['sgtm'],
  'sst-ga4': ['sgtm'],  // legacy id from v1.0.0–v1.3.0; kept so users typing the old id still find it
  'sst': ['sgtm'],
  // Facebook / Meta
  'facebook': ['facebook'],
  'meta': ['facebook'],
  'meta pixel': ['facebook'],
  'fb': ['facebook'],
  'fb pixel': ['facebook'],
  // Adobe
  'adobe': ['adobe-analytics'],
  'adobe analytics': ['adobe-analytics'],
  'omniture': ['adobe-analytics'],
  'adobe target': ['adobe-target'],
  'adobe aam': ['adobe-aam'],
  'adobe aep': ['adobe-aep'],
  // Amplitude
  'amplitude': ['amplitude'],
  // Mixpanel
  'mixpanel': ['mixpanel'],
  // Segment
  'segment': ['segment'],
  // mParticle
  'mparticle': ['mparticle'],
  // PostHog
  'posthog': ['posthog'],
  // Bing / Microsoft
  'bing': ['bing-ads'],
  'bing ads': ['bing-ads'],
  'microsoft ads': ['bing-ads'],
  'uet': ['bing-ads'],
  // LinkedIn
  'linkedin': ['linkedin'],
  // TikTok
  'tiktok': ['tiktok'],
  // Snapchat
  'snapchat': ['snapchat'],
  'snap': ['snapchat'],
  // Pinterest
  'pinterest': ['pinterest'],
  // Google Ads
  'google ads': ['google-ads-conversion', 'google-ads-remarketing'],
  'adwords': ['google-ads-conversion', 'google-ads-remarketing'],
  // Clarity
  'clarity': ['clarity'],
  'microsoft clarity': ['clarity'],
  // Hotjar
  'hotjar': ['hotjar'],
  // RudderStack
  'rudderstack': ['rudderstack'],
  // Hightouch
  'hightouch': ['hightouch-events'],
  // Optimizely
  'optimizely': ['optimizely'],
  // Salesforce
  'salesforce': ['salesforce-mc'],
  'salesforce mc': ['salesforce-mc'],
  'sfmc': ['salesforce-mc'],
  // Trustpilot
  'trustpilot': ['trustpilot'],
  // Cloudflare
  'cloudflare': ['cloudflare-analytics'],
  // TUNE
  'tune': ['tune'],
  // Adform
  'adform': ['adform'],
  // Cookiebot
  'cookiebot': ['cookiebot'],
  // OneTrust
  'onetrust': ['onetrust'],
  // Cookie Information
  'cookie information': ['cookie-information'],
  // bMetric
  'bmetric': ['bmetric'],
  // Heap
  'heap': ['heap'],
  // Piwik / Matomo
  'piwik': ['piwik-pro'],
  'piwik pro': ['piwik-pro'],
  'matomo': ['matomo'],
};

// Maps common names/abbreviations to category IDs
const CATEGORY_ALIASES = {
  'analytics': 'analytics',
  'advertising': 'advertising',
  'ads': 'advertising',
  'ad tech': 'ad-tech',
  'adtech': 'ad-tech',
  'tag manager': 'tag-manager',
  'tag managers': 'tag-manager',
  'tms': 'tag-manager',
  'cdp': 'cdp',
  'customer data': 'cdp',
  'a/b testing': 'ab-testing',
  'ab testing': 'ab-testing',
  'experimentation': 'ab-testing',
  'session replay': 'session-replay',
  'replay': 'session-replay',
  'consent': 'consent',
  'consent platforms': 'consent',
  'cmp': 'consent',
  'widgets': 'widgets',
  'marketing automation': 'marketing-automation',
  'marketing': 'marketing-automation',
  'data layer': 'data-layer',
  'datalayer': 'data-layer',
  'dl': 'data-layer',
  'first party': 'first-party-collection',
  '1st party': 'first-party-collection',
  '1p': 'first-party-collection',
  'monitoring': 'monitoring',
  'video': 'video',
  'video analytics': 'video',
  'unknown': 'unknown',
};

// Event name aliases — maps common terms to event name substrings
const EVENT_ALIASES = {
  'purchase': ['purchase', 'transaction', 'order_complete'],
  'pageview': ['page_view', 'pageview', 'page view'],
  'page view': ['page_view', 'pageview', 'page view'],
  'page_view': ['page_view', 'pageview'],
  'add to cart': ['add_to_cart', 'addtocart'],
  'add_to_cart': ['add_to_cart', 'addtocart'],
  'cart': ['add_to_cart', 'cart', 'addtocart'],
  'checkout': ['checkout', 'begin_checkout', 'initiate_checkout'],
  'login': ['login', 'sign_in', 'signin'],
  'signup': ['sign_up', 'signup', 'register', 'create_account'],
  'sign up': ['sign_up', 'signup', 'register'],
  'search': ['search', 'view_search_results'],
  'click': ['click', 'select_content', 'link_click'],
  'view item': ['view_item', 'product_view', 'view_content'],
  'view_item': ['view_item', 'product_view'],
  'remove from cart': ['remove_from_cart', 'removefromcart'],
  'refund': ['refund'],
  'scroll': ['scroll'],
  'video': ['video_start', 'video_progress', 'video_complete'],
  'form': ['form_submit', 'form_start', 'generate_lead'],
  'exception': ['exception', 'error'],
  'identify': ['identify', '$identify'],
  'track': ['track'],
  'dom': ['gtm.dom', 'dom'],
  'load': ['gtm.load', 'load'],
};

// Status/condition keywords
const STATUS_KEYWORDS = {
  'failed': { field: 'status', condition: 'gte', value: 400 },
  'errors': { field: 'status', condition: 'gte', value: 400 },
  'error': { field: 'status', condition: 'gte', value: 400 },
  'broken': { field: 'status', condition: 'gte', value: 400 },
  '4xx': { field: 'status', condition: 'gte', value: 400 },
  '5xx': { field: 'status', condition: 'gte', value: 500 },
};

// Special filter keywords
const SPECIAL_KEYWORDS = {
  'scripts': { filterType: 'eventType', value: 'scripts' },
  'script': { filterType: 'eventType', value: 'scripts' },
  'script loads': { filterType: 'eventType', value: 'scripts' },
  'interactions': { filterType: 'eventType', value: 'interactions' },
  'interaction': { filterType: 'eventType', value: 'interactions' },
  'clicks': { filterType: 'eventType', value: 'interactions' },
};

// ----------------------------------------
// Query parsing
// ----------------------------------------

/**
 * Check if a keyword appears in text as a whole word (not part of a larger word).
 * Uses word boundary logic: the character before/after the match must be a space,
 * hyphen, underscore, start/end of string, or the keyword itself is multi-word.
 */
function _matchesAsWord(text, keyword) {
  const idx = text.indexOf(keyword);
  if (idx === -1) return false;

  // Multi-word keywords (contain space) are specific enough — always match
  if (keyword.includes(' ')) return true;

  // Single-word: check boundaries
  const before = idx > 0 ? text[idx - 1] : ' ';
  const after = idx + keyword.length < text.length ? text[idx + keyword.length] : ' ';

  const isBoundary = (ch) => ch === ' ' || ch === '-' || ch === '_' || ch === '/' || ch === ':';
  return isBoundary(before) && isBoundary(after);
}

/**
 * Remove a matched keyword from text (word-boundary aware).
 */
function _removeMatch(text, keyword) {
  const idx = text.indexOf(keyword);
  if (idx === -1) return text;
  return (text.slice(0, idx) + text.slice(idx + keyword.length)).replace(/\s+/g, ' ').trim();
}

/**
 * Parse a search query into a structured filter object.
 * Tries to match tokens against platforms, categories, event names,
 * and special keywords. Unmatched tokens become text search terms.
 *
 * @param {string} query - The raw search query string
 * @returns {Object} Structured filter with matched conditions
 */
export function parseSearchQuery(query) {
  if (!query || !query.trim()) {
    return { isEmpty: true };
  }

  const result = {
    isEmpty: false,
    platforms: [],        // Matched platform IDs
    categories: [],       // Matched category IDs
    eventNames: [],       // Event name substrings to match
    statusFilter: null,   // HTTP status condition
    eventTypeFilter: null, // scripts/interactions override
    textSearch: '',       // Remaining unmatched text for substring search
    chips: [],            // Human-readable chip descriptions
  };

  const queryLower = query.toLowerCase().trim();

  // Try matching the full query first (handles multi-word names like "google ads")
  // Then progressively try smaller token combinations

  let remaining = queryLower;

  // 1. Match special keywords (scripts, interactions, failed, etc.)
  for (const [keyword, filter] of Object.entries(SPECIAL_KEYWORDS)) {
    if (_matchesAsWord(remaining, keyword)) {
      result.eventTypeFilter = filter.value;
      result.chips.push({ type: 'event-type', label: filter.value, value: filter.value });
      remaining = _removeMatch(remaining, keyword);
    }
  }

  for (const [keyword, condition] of Object.entries(STATUS_KEYWORDS)) {
    if (_matchesAsWord(remaining, keyword)) {
      result.statusFilter = condition;
      result.chips.push({ type: 'status', label: keyword, value: condition });
      remaining = _removeMatch(remaining, keyword);
    }
  }

  // 2. Match platform aliases (longest match first to prefer "google ads" over "google")
  const sortedPlatformAliases = Object.entries(PLATFORM_ALIASES)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [alias, platformIds] of sortedPlatformAliases) {
    if (_matchesAsWord(remaining, alias)) {
      for (const id of platformIds) {
        if (!result.platforms.includes(id)) {
          result.platforms.push(id);
        }
      }
      result.chips.push({ type: 'platform', label: alias, value: platformIds });
      remaining = _removeMatch(remaining, alias);
    }
  }

  // 3. Match category aliases (longest match first)
  const sortedCategoryAliases = Object.entries(CATEGORY_ALIASES)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [alias, categoryId] of sortedCategoryAliases) {
    if (_matchesAsWord(remaining, alias)) {
      // Don't match if we already matched platforms (e.g., "analytics" might match both)
      if (result.platforms.length === 0 || !PLATFORM_ALIASES[alias]) {
        result.categories.push(categoryId);
        result.chips.push({ type: 'category', label: alias, value: categoryId });
        remaining = _removeMatch(remaining, alias);
      }
    }
  }

  // 4. Also try matching remaining text against actual detected platform names
  // This handles platforms without explicit aliases
  if (remaining && _deps) {
    const endpoints = _deps.KNOWN_TRACKING_ENDPOINTS || [];
    for (const ep of endpoints) {
      const name = (ep.name || '').toLowerCase();
      const shortName = (ep.shortName || '').toLowerCase();
      if (remaining && (
        (name && _matchesAsWord(remaining, name)) ||
        (shortName && _matchesAsWord(remaining, shortName))
      )) {
        if (!result.platforms.includes(ep.id)) {
          result.platforms.push(ep.id);
          result.chips.push({ type: 'platform', label: ep.name || ep.id, value: [ep.id] });
          remaining = _removeMatch(remaining, name || shortName);
        }
      }
    }
  }

  // 5. Match event name aliases
  const sortedEventAliases = Object.entries(EVENT_ALIASES)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [alias, eventNames] of sortedEventAliases) {
    if (_matchesAsWord(remaining, alias)) {
      for (const name of eventNames) {
        if (!result.eventNames.includes(name)) {
          result.eventNames.push(name);
        }
      }
      result.chips.push({ type: 'event', label: alias, value: eventNames });
      remaining = _removeMatch(remaining, alias);
    }
  }

  // 6. Whatever is left becomes text search
  remaining = remaining.replace(/\s+/g, ' ').trim();
  if (remaining) {
    result.textSearch = remaining;
    result.chips.push({ type: 'text', label: remaining, value: remaining });
  }

  return result;
}

// ----------------------------------------
// Filter application
// ----------------------------------------

/**
 * Sync tool chip visibility with filtered events.
 * Called after render() has computed filtered events.
 *
 * When smart search is active, only show tool chips for platforms that have
 * at least one event in the filtered results. When search is empty, show all.
 *
 * @param {Array} filteredEvents - The events that passed all filters
 */
export function syncToolChipsWithFilteredEvents(filteredEvents) {
  if (!_deps) return;

  const parsed = _currentParsed;

  const categoriesContainer = _deps.elements.filterRowCategories || _deps.elements.categoryToggles;
  if (!categoriesContainer) return;

  const categoryFrames = categoriesContainer.querySelectorAll('.category-frame');

  // If search is empty, show all tools
  if (!parsed || parsed.isEmpty) {
    categoryFrames.forEach(frame => {
      frame.classList.remove('search-empty');
      frame.querySelectorAll('.tool-chip').forEach(chip => {
        chip.classList.remove('search-hidden');
      });
    });
    return;
  }

  // Collect platforms that have matching events
  const platformsWithEvents = new Set();
  for (const event of filteredEvents) {
    if (event.platform) {
      platformsWithEvents.add(event.platform);
    }
  }

  // For explicit platform/category matches, also include those even if they
  // have zero events right now (user asked to see them)
  for (const id of parsed.platforms) {
    platformsWithEvents.add(id);
  }
  if (parsed.categories.length > 0 && _deps.platformToCategory) {
    for (const [platformId, categoryId] of Object.entries(_deps.platformToCategory)) {
      if (parsed.categories.includes(categoryId)) {
        platformsWithEvents.add(platformId);
      }
    }
  }

  categoryFrames.forEach(frame => {
    const toolChips = frame.querySelectorAll('.tool-chip');
    let visibleCount = 0;

    toolChips.forEach(chip => {
      const platform = chip.dataset.platform;
      if (!platform) return;

      // Feature #151: Unknown per-host chips carry a synthetic `other:<host>` id,
      // but the underlying events all report platform === 'other'. Treat a host
      // chip as matching whenever the generic 'other' bucket has matching events.
      const matches = platformsWithEvents.has(platform) ||
        (platform.startsWith('other:') && platformsWithEvents.has('other'));

      if (matches) {
        chip.classList.remove('search-hidden');
        visibleCount++;
      } else {
        chip.classList.add('search-hidden');
      }
    });

    if (visibleCount === 0) {
      frame.classList.add('search-empty');
    } else {
      frame.classList.remove('search-empty');
    }
  });
}

/**
 * Check if an event matches the smart search filter.
 * Called from getFilteredEvents() for event-level conditions.
 *
 * @param {Object} event - The event object
 * @param {Object} parsed - Result from parseSearchQuery()
 * @param {Object} platformToCategory - Platform-to-category lookup
 * @returns {boolean} Whether the event passes the smart search filter
 */
export function eventMatchesSmartSearch(event, parsed, platformToCategory) {
  if (!parsed || parsed.isEmpty) return true;

  // Platform filter
  if (parsed.platforms.length > 0) {
    if (!parsed.platforms.includes(event.platform)) {
      // Also check if event platform is in a matched category
      if (parsed.categories.length === 0) return false;
    }
  }

  // Category filter
  if (parsed.categories.length > 0) {
    const eventCategory = platformToCategory[event.platform] || 'unknown';
    const platformMatched = parsed.platforms.includes(event.platform);
    const categoryMatched = parsed.categories.includes(eventCategory);
    if (!platformMatched && !categoryMatched) return false;
  }

  // Event name filter
  if (parsed.eventNames.length > 0) {
    const eventName = (event.eventName || '').toLowerCase();
    const nameMatches = parsed.eventNames.some(name =>
      eventName.includes(name.toLowerCase())
    );
    if (!nameMatches) return false;
  }

  // Status filter
  if (parsed.statusFilter) {
    const status = event.raw?.status || event.status || 200;
    const { condition, value } = parsed.statusFilter;
    if (condition === 'gte' && status < value) return false;
    if (condition === 'eq' && status !== value) return false;
    if (condition === 'lt' && status >= value) return false;
  }

  // Event type filter (scripts/interactions)
  if (parsed.eventTypeFilter === 'scripts') {
    if (!event.isScriptLoad) return false;
  }
  if (parsed.eventTypeFilter === 'interactions') {
    if (!event.isInteraction) return false;
  }

  // Text search (fallback for unmatched tokens)
  if (parsed.textSearch) {
    const searchLower = parsed.textSearch.toLowerCase();
    const eventName = (event.eventName || '').toLowerCase();
    const platform = (event.platform || '').toLowerCase();

    if (!event._searchCache) {
      event._searchCache = JSON.stringify(event.raw || {}).toLowerCase();
    }

    if (!eventName.includes(searchLower) &&
        !platform.includes(searchLower) &&
        !event._searchCache.includes(searchLower)) {
      return false;
    }
  }

  return true;
}

// ----------------------------------------
// Chip rendering
// ----------------------------------------

// Create a small X icon SVG element for chip remove buttons
function _createRemoveIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '8');
  svg.setAttribute('height', '8');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '3');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M18 6L6 18M6 6l12 12');
  svg.appendChild(path);
  return svg;
}

/**
 * Render filter chips below the smart search input.
 * Each chip shows an interpreted condition and can be removed.
 *
 * @param {Object} parsed - Result from parseSearchQuery()
 * @param {Function} onRemoveChip - Callback when a chip is removed (chipIndex)
 */
export function renderSmartSearchChips(parsed, onRemoveChip) {
  if (!_deps) return;

  const container = _deps.elements.smartSearchChips;
  if (!container) return;

  // Clear existing chips
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  if (!parsed || parsed.isEmpty || parsed.chips.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';

  parsed.chips.forEach((chip, index) => {
    const el = document.createElement('span');
    el.className = `smart-search-chip smart-search-chip--${chip.type}`;
    el.title = `${chip.type}: ${chip.label}`;

    const label = document.createElement('span');
    label.className = 'smart-search-chip-label';
    label.textContent = `${_getChipPrefix(chip.type)}${chip.label}`;
    el.appendChild(label);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'smart-search-chip-remove';
    removeBtn.type = 'button';
    removeBtn.title = 'Remove filter';
    removeBtn.appendChild(_createRemoveIcon());
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onRemoveChip(index);
    });
    el.appendChild(removeBtn);

    container.appendChild(el);
  });
}

function _getChipPrefix(type) {
  switch (type) {
    case 'platform': return 'Tool: ';
    case 'category': return 'Category: ';
    case 'event': return 'Event: ';
    case 'status': return 'Status: ';
    case 'event-type': return 'Type: ';
    case 'text': return '';
    default: return '';
  }
}

// ----------------------------------------
// Search state management
// ----------------------------------------

/** Current parsed search state (cached to avoid re-parsing on every render) */
let _currentParsed = { isEmpty: true };
let _currentQuery = '';

/**
 * Get the current parsed search state.
 * @returns {Object} The current parsed filter
 */
export function getCurrentParsedSearch() {
  return _currentParsed;
}

/**
 * Handle smart search input changes.
 * Parses the query, updates tool chip visibility, renders chips,
 * and triggers event stream re-render if needed.
 *
 * @param {string} query - The current search input value
 */
export function handleSmartSearchInput(query) {
  if (!_deps) return;

  const state = _deps.getState();
  _currentQuery = query;
  _currentParsed = parseSearchQuery(query);

  // Update legacy state for backward compatibility
  state.toolSearchQuery = query;

  // Update clear button visibility
  if (_deps.elements.smartSearchClear) {
    _deps.elements.smartSearchClear.style.opacity = query ? '1' : '0';
  }

  // Render interpretation chips
  renderSmartSearchChips(_currentParsed, (chipIndex) => {
    removeChipFromQuery(chipIndex);
  });

  // Always re-render — render() calls syncToolChipsWithFilteredEvents()
  // to keep tool chip visibility in sync with filtered event results
  _deps.render();
}

/**
 * Remove a chip by rebuilding the query without the removed chip's text.
 * @param {number} chipIndex - Index of the chip to remove
 */
function removeChipFromQuery(chipIndex) {
  if (!_deps) return;

  const chip = _currentParsed.chips[chipIndex];
  if (!chip) return;

  // Remove the chip's label from the query
  let newQuery = _currentQuery.toLowerCase();
  newQuery = newQuery.replace(chip.label.toLowerCase(), '').replace(/\s+/g, ' ').trim();

  // Update the input element
  if (_deps.elements.smartSearchInput) {
    _deps.elements.smartSearchInput.value = newQuery;
  }

  // Re-process
  handleSmartSearchInput(newQuery);
}

/**
 * Clear the smart search completely.
 */
export function clearSmartSearch() {
  if (!_deps) return;

  const state = _deps.getState();
  state.toolSearchQuery = '';
  _currentQuery = '';
  _currentParsed = { isEmpty: true };

  if (_deps.elements.smartSearchInput) {
    _deps.elements.smartSearchInput.value = '';
  }

  renderSmartSearchChips(_currentParsed, () => {});
  _deps.render();
}
