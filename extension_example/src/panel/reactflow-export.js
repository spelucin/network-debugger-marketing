// MartechStack Builder JSON export.
// Converts Event Watcher's detected tools into a JSON file that imports cleanly
// into https://app.martechstackbuilder.com/ via File → Import JSON.
//
// Spec source of truth: docs/REACT-FLOW-MARTECHSTACK-BUILDER-JSON-IMPORT-SPEC.md
//
// Scope: this module only translates Event Watcher's internal model into the
// import shape. Event Watcher's own categorisation, platform registry, and UI
// taxonomy are NOT touched here — only what we emit at export time.

let _deps;

/**
 * Initialize the export module.
 * @param {Object} deps
 * @param {Function} deps.getFilteredEvents - Returns the currently visible/filtered events
 * @param {Function} deps.getCategoryForPlatform - (toolId) → Event Watcher category id
 * @param {Object}   deps.PLATFORM_CATEGORIES - Event Watcher category metadata (display names)
 */
export function initReactFlowExport(deps) {
  _deps = deps;
}

// ============================================================================
// MartechStack Builder vendor catalogue
// ============================================================================
// Maps Event Watcher toolId → MSB import data. Provider slugs come from spec
// §2.4 verbatim where available; for vendors not listed in §2.4 but present in
// MSB's DB (confirmed by an existing vendor-logos asset) we use that slug.
// When neither applies we leave `provider` unset so MSB renders the node with
// our label/color/icon rather than mismatching against an unrelated vendor.

const VENDOR_LOGO_BASE = 'https://uqkuhmxhbgoteyubspir.supabase.co/storage/v1/object/public/vendor-logos';

const MSB_VENDOR_MAP = {
  // ── Tag managers (spec §2.4) ────────────────────────────────────────────────
  'gtm':           { provider: 'google-tag-manager', label: 'Google Tag Manager', logo: `${VENDOR_LOGO_BASE}/gtm.png`,           color: '#246FDB', icon: 'Tag', category: 'source', nodeRole: 'Tag manager', implementationMethod: 'javascript-sdk' },
  'adobe-launch':  { provider: 'adobe-launch',       label: 'Adobe Tags',         logo: `${VENDOR_LOGO_BASE}/adobe-launch.png`,  color: '#F7382B', icon: 'Tag', category: 'source', nodeRole: 'Tag manager', implementationMethod: 'javascript-sdk' },
  'tealium':       { provider: 'tealium-iq',         label: 'Tealium iQ',         logo: `${VENDOR_LOGO_BASE}/tealium.png`,       color: '#24D6E0', icon: 'Tag', category: 'source', nodeRole: 'Tag manager', implementationMethod: 'javascript-sdk' },

  // ── Web/product analytics (spec §2.4 → category: analytics) ─────────────────
  'ga4':              { provider: 'ga4',              label: 'Google Analytics 4', logo: `${VENDOR_LOGO_BASE}/google-analytics-4.png`, color: '#E37400', icon: 'BarChart3', category: 'analytics', nodeRole: 'Web analytics' },
  'adobe-analytics':  { provider: 'adobe-analytics',  label: 'Adobe Analytics',    logo: `${VENDOR_LOGO_BASE}/adobe-analytics.png`,    color: '#9A7AF7', icon: 'BarChart3', category: 'analytics', nodeRole: 'Web analytics' },
  'amplitude':        { provider: 'amplitude',        label: 'Amplitude',          logo: `${VENDOR_LOGO_BASE}/amplitude.png`,          color: '#1E61F0', icon: 'BarChart3', category: 'analytics', nodeRole: 'Product analytics' },
  'mixpanel':         { provider: 'mixpanel',         label: 'Mixpanel',           logo: `${VENDOR_LOGO_BASE}/mixpanel.png`,           color: '#7753FF', icon: 'BarChart3', category: 'analytics', nodeRole: 'Product analytics' },
  'heap':             { provider: 'heap',             label: 'Heap',               logo: `${VENDOR_LOGO_BASE}/heap.png`,               color: '#31D891', icon: 'BarChart3', category: 'analytics', nodeRole: 'Product analytics' },
  'plausible':        { provider: 'plausible',        label: 'Plausible',          logo: `${VENDOR_LOGO_BASE}/plausible.png`,          color: '#5850EC', icon: 'BarChart3', category: 'analytics', nodeRole: 'Web analytics' },
  'fathom':           { provider: 'fathom',           label: 'Fathom',             logo: `${VENDOR_LOGO_BASE}/fathom.png`,             color: '#9059FF', icon: 'BarChart3', category: 'analytics', nodeRole: 'Web analytics' },
  'pendo':            { provider: 'pendo',            label: 'Pendo',              logo: `${VENDOR_LOGO_BASE}/pendo.png`,              color: '#EC1F5A', icon: 'BarChart3', category: 'analytics', nodeRole: 'Product analytics' },
  'posthog':          { provider: 'posthog',          label: 'PostHog',            logo: `${VENDOR_LOGO_BASE}/posthog.png`,            color: '#1D4AFF', icon: 'BarChart3', category: 'analytics', nodeRole: 'Product analytics' },

  // ── Pixels (spec §2.4 → source) ─────────────────────────────────────────────
  'facebook':  { provider: 'meta-pixel',           label: 'Meta Pixel',           logo: `${VENDOR_LOGO_BASE}/meta_ads.svg`,           color: '#1877F2', icon: 'Eye', category: 'source', nodeRole: 'Pixel', implementationMethod: 'pixel' },
  'linkedin':  { provider: 'linkedin-insight-tag', label: 'LinkedIn Insight Tag', logo: `${VENDOR_LOGO_BASE}/linkedin_ads.svg`,       color: '#0A66C2', icon: 'Eye', category: 'source', nodeRole: 'Pixel', implementationMethod: 'pixel' },
  'twitter':   { provider: 'twitter-pixel',        label: 'X / Twitter Pixel',    logo: `${VENDOR_LOGO_BASE}/twitter_ads.svg`,        color: '#000000', icon: 'Eye', category: 'source', nodeRole: 'Pixel', implementationMethod: 'pixel' },
  'tiktok':    { provider: 'tiktok-pixel',         label: 'TikTok Pixel',         logo: `${VENDOR_LOGO_BASE}/tiktok_ads.svg`,         color: '#000000', icon: 'Eye', category: 'source', nodeRole: 'Pixel', implementationMethod: 'pixel' },
  'pinterest': { provider: 'pinterest-tag',        label: 'Pinterest Tag',        logo: `${VENDOR_LOGO_BASE}/pinterest_ads.svg`,      color: '#E60023', icon: 'Eye', category: 'source', nodeRole: 'Pixel', implementationMethod: 'pixel' },
  'snapchat':  { provider: 'snapchat-pixel',       label: 'Snapchat Pixel',       logo: `${VENDOR_LOGO_BASE}/snapchat_ads.svg`,       color: '#FFFC00', icon: 'Eye', category: 'source', nodeRole: 'Pixel', implementationMethod: 'pixel' },

  // ── CDPs / event routers (spec §2.4 → processing) ──────────────────────────
  'segment':     { provider: 'segment',     label: 'Segment',     logo: `${VENDOR_LOGO_BASE}/segment.png`,     color: '#52BD95', icon: 'Layers',         category: 'processing', nodeRole: 'CDP' },
  'rudderstack': { provider: 'rudderstack', label: 'RudderStack', logo: `${VENDOR_LOGO_BASE}/rudderstack.png`, color: '#105ED5', icon: 'Radio',          category: 'processing', nodeRole: 'CDP' },
  'mparticle':   { provider: 'mparticle',   label: 'mParticle',   logo: `${VENDOR_LOGO_BASE}/mparticle.png`,   color: '#000000', icon: 'Layers',         category: 'processing', nodeRole: 'CDP' },
  'hightouch':   { provider: 'hightouch',   label: 'Hightouch',   logo: `${VENDOR_LOGO_BASE}/hightouch.png`,   color: '#4FC26C', icon: 'ArrowLeftRight', category: 'processing', nodeRole: 'Reverse ETL' },

  // ── CMPs / consent (spec §2.4 → governance) ─────────────────────────────────
  'cookie-information': { provider: 'cookie-information', label: 'Cookie Information', logo: `${VENDOR_LOGO_BASE}/cookie-information.png`, color: '#000000', icon: 'Shield', category: 'governance', nodeRole: 'CMP', tags: ['consent-aware', 'GDPR'] },
  'cookiebot':          { provider: 'cookiebot',          label: 'Cookiebot',          logo: `${VENDOR_LOGO_BASE}/cookiebot.png`,          color: '#39A7F2', icon: 'Shield', category: 'governance', nodeRole: 'CMP', tags: ['consent-aware', 'GDPR'] },
  'cookieyes':          { provider: 'cookieyes',          label: 'CookieYes',          logo: `${VENDOR_LOGO_BASE}/cookieyes.png`,          color: '#134FB0', icon: 'Shield', category: 'governance', nodeRole: 'CMP', tags: ['consent-aware', 'GDPR'] },
  'didomi':             { provider: 'didomi',             label: 'Didomi',             logo: `${VENDOR_LOGO_BASE}/didomi.png`,             color: '#306EF4', icon: 'Shield', category: 'governance', nodeRole: 'CMP', tags: ['consent-aware', 'GDPR'] },
  'onetrust':           { provider: 'onetrust',           label: 'OneTrust',           logo: `${VENDOR_LOGO_BASE}/onetrust.png`,           color: '#55A05F', icon: 'Shield', category: 'governance', nodeRole: 'CMP', tags: ['consent-aware', 'GDPR', 'CCPA'] },
  'sourcepoint':        { provider: 'sourcepoint',        label: 'Sourcepoint',        logo: `${VENDOR_LOGO_BASE}/sourcepoint.png`,        color: '#0066FF', icon: 'Shield', category: 'governance', nodeRole: 'CMP', tags: ['consent-aware', 'GDPR'] },
  'transcend':          { provider: 'transcend',          label: 'Transcend',          logo: `${VENDOR_LOGO_BASE}/transcend.png`,          color: '#1F2937', icon: 'Shield', category: 'governance', nodeRole: 'CMP', tags: ['consent-aware', 'GDPR'] },
  'trustarc':           { provider: 'trustarc',           label: 'TrustArc',           logo: `${VENDOR_LOGO_BASE}/trustarc.png`,           color: '#0073AA', icon: 'Shield', category: 'governance', nodeRole: 'CMP', tags: ['consent-aware', 'GDPR'] },
  'usercentrics':       { provider: 'usercentrics',       label: 'Usercentrics',       logo: `${VENDOR_LOGO_BASE}/usercentrics.png`,       color: '#1D4FD7', icon: 'Shield', category: 'governance', nodeRole: 'CMP', tags: ['consent-aware', 'GDPR'] },

  // ── Ad platforms (spec §2.4 → activation) ───────────────────────────────────
  'google-ads-conversion':  { provider: 'google-ads',     label: 'Google Ads',      logo: `${VENDOR_LOGO_BASE}/google_ads.svg`,    color: '#4285F4', icon: 'Target', category: 'activation', nodeRole: 'Conversion tracking' },
  'google-ads-remarketing': { provider: 'google-ads',     label: 'Google Ads',      logo: `${VENDOR_LOGO_BASE}/google_ads.svg`,    color: '#4285F4', icon: 'Target', category: 'activation', nodeRole: 'Remarketing' },
  'criteo':                 { provider: 'criteo',         label: 'Criteo',          logo: `${VENDOR_LOGO_BASE}/criteo.png`,        color: '#FF8000', icon: 'Target', category: 'activation', nodeRole: 'Advertising' },
  'thetradedesk':           { provider: 'the-trade-desk', label: 'The Trade Desk',  logo: `${VENDOR_LOGO_BASE}/the-trade-desk.png`, color: '#E9242B', icon: 'Target', category: 'activation', nodeRole: 'DSP' },

  // ── Email / messaging (spec §2.4 → activation) ──────────────────────────────
  'braze':       { provider: 'braze',       label: 'Braze',       logo: `${VENDOR_LOGO_BASE}/braze.png`,       color: '#FFA524', icon: 'Mail', category: 'activation', nodeRole: 'Customer engagement' },
  'iterable':    { provider: 'iterable',    label: 'Iterable',    logo: `${VENDOR_LOGO_BASE}/iterable.png`,    color: '#5719CE', icon: 'Mail', category: 'activation', nodeRole: 'Marketing automation' },
  'klaviyo':     { provider: 'klaviyo',     label: 'Klaviyo',     logo: `${VENDOR_LOGO_BASE}/klaviyo.png`,     color: '#000000', icon: 'Mail', category: 'activation', nodeRole: 'Email / SMS' },
  'mailchimp':   { provider: 'mailchimp',   label: 'Mailchimp',   logo: `${VENDOR_LOGO_BASE}/mailchimp.png`,   color: '#FFE01B', icon: 'Mail', category: 'activation', nodeRole: 'Marketing automation' },
  'customerio':  { provider: 'customer-io', label: 'Customer.io', logo: `${VENDOR_LOGO_BASE}/customer-io.png`, color: '#7C3AED', icon: 'Mail', category: 'activation', nodeRole: 'Marketing automation' },

  // ── Personalization & A/B testing (spec §2.4 → activation) ──────────────────
  'optimizely':    { provider: 'optimizely',     label: 'Optimizely',    logo: `${VENDOR_LOGO_BASE}/optimizely.png`,     color: '#0037FF', icon: 'Target', category: 'activation', nodeRole: 'A/B testing' },
  'vwo':           { provider: 'vwo',            label: 'VWO',           logo: `${VENDOR_LOGO_BASE}/vwo.png`,            color: '#3B82F6', icon: 'Target', category: 'activation', nodeRole: 'A/B testing' },
  'dynamicyield':  { provider: 'dynamic-yield',  label: 'Dynamic Yield', logo: `${VENDOR_LOGO_BASE}/dynamic-yield.png`,  color: '#F39200', icon: 'Target', category: 'activation', nodeRole: 'Personalization' },
  'monetate':      { provider: 'monetate',       label: 'Monetate',      logo: `${VENDOR_LOGO_BASE}/monetate.png`,       color: '#0066CC', icon: 'Target', category: 'activation', nodeRole: 'Personalization' },
  'adobe-target':  { provider: 'adobe-target',   label: 'Adobe Target',  logo: `${VENDOR_LOGO_BASE}/adobe-target.png`,   color: '#00D2F8', icon: 'Target', category: 'activation', nodeRole: 'Personalization' },

  // ── Session replay (spec §2.4 → analytics) ──────────────────────────────────
  'clarity':        { provider: 'microsoft-clarity', label: 'Microsoft Clarity', logo: `${VENDOR_LOGO_BASE}/microsoft-clarity.png`, color: '#3B82F6', icon: 'MousePointer', category: 'analytics', nodeRole: 'Session replay' },
  'contentsquare':  { provider: 'contentsquare',     label: 'Contentsquare',     logo: `${VENDOR_LOGO_BASE}/contentsquare.png`,     color: '#F44C26', icon: 'MousePointer', category: 'analytics', nodeRole: 'Session replay' },
  'fullstory':      { provider: 'fullstory',         label: 'Fullstory',         logo: `${VENDOR_LOGO_BASE}/fullstory.png`,         color: '#FF6B00', icon: 'MousePointer', category: 'analytics', nodeRole: 'Session replay' },
  'hotjar':         { provider: 'hotjar',            label: 'Hotjar',            logo: `${VENDOR_LOGO_BASE}/hotjar.png`,            color: '#FF3C00', icon: 'MousePointer', category: 'analytics', nodeRole: 'Session replay' },
  'logrocket':      { provider: 'logrocket',         label: 'LogRocket',         logo: `${VENDOR_LOGO_BASE}/logrocket.png`,         color: '#764ABC', icon: 'MousePointer', category: 'analytics', nodeRole: 'Session replay' },

  // ── Server-side / GTM (spec §2.4 → infrastructure) ──────────────────────────
  'sgtm': { provider: 'gtm-server', label: 'sGTM', logo: `${VENDOR_LOGO_BASE}/gtm-server-side.png`, color: '#8AB4F8', icon: 'Server', category: 'infrastructure', nodeRole: 'Server-side', implementationMethod: 'server-side-tag' },

  // ── Other vendors confirmed in MSB DB (logo asset exists), not in spec §2.4 ─
  'adform':                       { provider: 'adform',                       label: 'AdForm',                       logo: `${VENDOR_LOGO_BASE}/adform.png`,                       color: '#40D3B4', icon: 'Target', category: 'activation', nodeRole: 'Ad tech' },
  'adobe-experience-platform':    { provider: 'adobe-experience-platform',    label: 'Adobe Experience Platform',    logo: `${VENDOR_LOGO_BASE}/adobe-aep.png`,                    color: '#DC2125', icon: 'Layers', category: 'processing', nodeRole: 'Customer experience platform' },
  'adobe-audience-manager':       { provider: 'adobe-audience-manager',       label: 'Adobe Audience Manager',       logo: `${VENDOR_LOGO_BASE}/adobe-audience.png`,               color: '#6F89EA', icon: 'Layers', category: 'processing', nodeRole: 'DMP' },
  'salesforce-marketing-cloud':   { provider: 'salesforce-marketing-cloud',   label: 'Salesforce Marketing Cloud',   logo: `${VENDOR_LOGO_BASE}/salesforce-marketing-cloud.png`,   color: '#00A1E0', icon: 'Cloud',  category: 'activation', nodeRole: 'Marketing cloud' },
};

// Keys for the consent → TM and TM → tool inference when no graph is
// available (the events-stream Copy-All path). The Stack-view path passes
// a real attribution graph and uses parent-child relationships directly,
// so this list is only the fallback ordering when we have nothing better.
const TAG_MANAGER_TOOL_IDS = ['gtm', 'adobe-launch', 'tealium'];

// Sort tools within a group so feeders sit on top and the diagram reads
// top-down. Depth-in-graph wins: a tool's parent in the same group renders
// above it. Cycle-safe via the seen set.
function sortToolsInGroup(toolIds, graph) {
  const ids = [...toolIds];
  const depth = (id) => {
    let d = 0;
    let cur = id;
    const seen = new Set();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      const node = graph.nodes.get(cur);
      const parent = node?.parentPlatformId;
      if (!parent || !toolIds.includes(parent)) break;
      d++;
      cur = parent;
    }
    return d;
  };
  return ids.sort((a, b) => {
    const da = depth(a);
    const db = depth(b);
    if (da !== db) return da - db;
    return a.localeCompare(b);
  });
}

// ============================================================================
// Fallback node — for tools we don't have an MSB mapping for
// ============================================================================
// Per spec §2.4: "If you can't find a match, leave `provider` unset". We do not
// invent slugs. The node still renders cleanly with our label/category/color.

const FALLBACK_BY_CATEGORY = {
  'consent':                { color: '#EF4444', icon: 'Shield',       category: 'governance',     nodeRole: 'Consent / privacy' },
  'tag-manager':            { color: '#3B82F6', icon: 'Tag',          category: 'source',         nodeRole: 'Tag manager' },
  'analytics':              { color: '#8B5CF6', icon: 'BarChart3',    category: 'analytics',      nodeRole: 'Analytics' },
  'session-replay':         { color: '#8B5CF6', icon: 'MousePointer', category: 'analytics',      nodeRole: 'Session replay' },
  'monitoring':             { color: '#06B6D4', icon: 'Eye',          category: 'analytics',      nodeRole: 'Monitoring' },
  'advertising':            { color: '#F59E0B', icon: 'Target',       category: 'activation',     nodeRole: 'Advertising' },
  'ad-tech':                { color: '#F59E0B', icon: 'Target',       category: 'activation',     nodeRole: 'Ad tech' },
  'first-party-collection': { color: '#06B6D4', icon: 'Server',       category: 'infrastructure', nodeRole: 'Server-side' },
  'cdp':                    { color: '#10B981', icon: 'Layers',       category: 'processing',     nodeRole: 'CDP' },
  'personalization':        { color: '#F59E0B', icon: 'Target',       category: 'activation',     nodeRole: 'Personalization' },
  'marketing-automation':   { color: '#F59E0B', icon: 'Mail',         category: 'activation',     nodeRole: 'Marketing automation' },
  'video':                  { color: '#8B5CF6', icon: 'BarChart3',    category: 'analytics',      nodeRole: 'Video analytics' },
  'widgets':                { color: '#6B7280', icon: 'Box',          category: 'custom',         nodeRole: 'Widget' },
  'data-layer':             { color: '#6B7280', icon: 'Box',          category: 'custom',         nodeRole: 'Data layer' },
  'ab-testing':             { color: '#F59E0B', icon: 'Target',       category: 'activation',     nodeRole: 'A/B testing' },
};

function buildFallbackNodeData(toolName, eventWatcherCategoryId) {
  const defaults = FALLBACK_BY_CATEGORY[eventWatcherCategoryId]
    || { color: '#6B7280', icon: 'Box', category: 'custom', nodeRole: 'Tool' };
  return {
    label: toolName,
    category: defaults.category,
    color: defaults.color,
    icon: defaults.icon,
    nodeRole: defaults.nodeRole,
  };
}

// ============================================================================
// Internal column / group layout (visual hint to the importer; positions are
// optional per spec §4 — MSB auto-fits anyway).
// ============================================================================

const CATEGORY_GROUP_MAP = {
  'consent':                { groupLabel: 'Consent & Privacy',     groupColor: 'green'  },
  'tag-manager':            { groupLabel: 'Tag Management',         groupColor: 'blue'   },
  'analytics':              { groupLabel: 'Analytics & Insights',   groupColor: 'purple' },
  'session-replay':         { groupLabel: 'Analytics & Insights',   groupColor: 'purple' },
  'monitoring':             { groupLabel: 'Analytics & Insights',   groupColor: 'purple' },
  'advertising':            { groupLabel: 'Advertising & Activation', groupColor: 'orange' },
  'ad-tech':                { groupLabel: 'Advertising & Activation', groupColor: 'orange' },
  'first-party-collection': { groupLabel: 'Server-side',            groupColor: 'gray'   },
  'cdp':                    { groupLabel: 'Customer Data',          groupColor: 'purple' },
  'personalization':        { groupLabel: 'Advertising & Activation', groupColor: 'orange' },
  'marketing-automation':   { groupLabel: 'Advertising & Activation', groupColor: 'orange' },
  'ab-testing':             { groupLabel: 'Advertising & Activation', groupColor: 'orange' },
};

// ============================================================================
// Builder
// ============================================================================

/**
 * Build a MartechStack Builder import JSON from the current event stream.
 * Returns null if there's nothing to export, or if no attribution graph is
 * supplied — the export only runs from Stack view, which always provides
 * the graph from buildStackGraph().
 *
 * @param {Object} opts
 * @param {string} [opts.rootDomain] - Site the events were captured on (used in name/description)
 * @param {Object} opts.graph - Attribution graph from buildStackGraph(); the
 *                              layout uses real parent-child relationships
 *                              (so e.g. Tealium correctly renders above GTM
 *                              when Tealium is the loader).
 * @returns {Object|null} Spec-compliant import payload
 */
export function buildReactFlowJSON(opts = {}) {
  const graph = opts.graph;
  if (!graph || !graph.nodes) return null;

  const filteredEvents = _deps.getFilteredEvents();
  if (filteredEvents.length === 0) return null;

  const toolMap = collectTools(filteredEvents);
  if (toolMap.size === 0) return null;

  const groupNodes = layOutGroups(toolMap, graph);
  const nodes = emitNodes(toolMap, groupNodes);
  const edges = emitGraphEdges(toolMap, graph);

  return {
    name: buildName(opts.rootDomain),
    description: buildDescription(opts.rootDomain, toolMap.size, edges.length),
    nodes,
    edges,
  };
}

// ── Tool collection ──────────────────────────────────────────────────────────

const SKIP_TOOL_IDS = new Set(['datalayer', 'pages', 'unknown']);

function collectTools(events) {
  const toolMap = new Map(); // toolId → { toolName, categoryId, events, eventNames, scriptUrls }

  for (const event of events) {
    const toolId = event.platform || 'unknown';
    const categoryId = _deps.getCategoryForPlatform(toolId);
    if (SKIP_TOOL_IDS.has(toolId) || SKIP_TOOL_IDS.has(categoryId)) continue;

    if (!toolMap.has(toolId)) {
      toolMap.set(toolId, {
        toolName: event.platformName || event.platform || 'Unknown',
        categoryId,
        events: [],
        eventNames: [],
        scriptUrls: [],
      });
    }
    const entry = toolMap.get(toolId);
    entry.events.push(event);
    if (event.eventName) entry.eventNames.push(event.eventName);
    const url = event.url || event.scriptUrl;
    if (url) entry.scriptUrls.push(url);
  }
  return toolMap;
}

// ── Layout: column-based group placement ─────────────────────────────────────

// Layout constants — shared between layOutGroups (sizes the groupBox) and
// emitNodes (positions tools inside it). Tuned so adjacent columns have
// enough horizontal breathing room for edge bundles to bend cleanly while
// keeping each group's vertical footprint compact (so a column with three
// tools doesn't tower over the rest of the canvas).
const TOOL_HEIGHT = 100;
const GROUP_PAD_X = 16;
const GROUP_PAD_TOP = 36;
const GROUP_PAD_BOTTOM = 16;
const GROUP_WIDTH = 240;
const GROUP_GAP = 36;
// Asymmetric on purpose: col 0 → col 1 gets 50% more horizontal room than
// col 1 → col 2. The Consent → Tag-Manager edge bundle is dense (one edge
// per CMP), so it benefits from extra runway; the Tag-Manager → right
// column already has plenty of room because the right column is taller.
const COL_X = [-540, 0, 440];
const GROUP_POSITIONS = {
  'Consent & Privacy':       { col: 0, order: 0 },
  'Tag Management':          { col: 1, order: 0 },
  'Advertising & Activation': { col: 2, order: 0 },
  'Analytics & Insights':    { col: 2, order: 1 },
  'Server-side':             { col: 2, order: 2 },
  'Customer Data':           { col: 2, order: 3 },
  'Other':                   { col: 2, order: 4 },
};

function layOutGroups(toolMap, graph) {
  const groups = new Map(); // groupLabel → { groupColor, tools: [toolId, ...] }
  for (const [toolId, info] of toolMap) {
    const mapping = CATEGORY_GROUP_MAP[info.categoryId] || { groupLabel: 'Other', groupColor: 'gray' };
    if (!groups.has(mapping.groupLabel)) {
      groups.set(mapping.groupLabel, { groupColor: mapping.groupColor, tools: [] });
    }
    groups.get(mapping.groupLabel).tools.push(toolId);
  }

  // Sort tools within each group so feeders render at the top. With a real
  // graph, depth-in-graph wins (parent above child); otherwise hardcoded
  // TM priority.
  for (const group of groups.values()) {
    group.tools = sortToolsInGroup(group.tools, graph);
  }

  const groupNodes = [];
  let groupIndex = 0;
  for (const [groupLabel, group] of groups) {
    const groupHeight = GROUP_PAD_TOP + group.tools.length * TOOL_HEIGHT + GROUP_PAD_BOTTOM;
    groupNodes.push({
      groupLabel,
      groupId: `group-${groupIndex}`,
      groupColor: group.groupColor,
      tools: group.tools,
      width: GROUP_WIDTH,
      height: groupHeight,
    });
    groupIndex++;
  }

  groupNodes.sort((a, b) => {
    const posA = GROUP_POSITIONS[a.groupLabel] || { col: 2, order: 99 };
    const posB = GROUP_POSITIONS[b.groupLabel] || { col: 2, order: 99 };
    return posA.col - posB.col || posA.order - posB.order;
  });

  const colNextY = [0, 0, 0];
  for (const g of groupNodes) {
    const pos = GROUP_POSITIONS[g.groupLabel] || { col: 2, order: 99 };
    g.x = COL_X[pos.col];
    g.y = colNextY[pos.col];
    colNextY[pos.col] = g.y + g.height + GROUP_GAP;
  }

  // Vertically centre shorter columns against the tallest. Without this the
  // Consent and Tag Management columns (typically 1 group each) anchor to the
  // top of the canvas while the right column stacks 4+ groups downward — so
  // edges from a Tag Manager all fan downward to reach the bottom groups,
  // making them hard to follow. Centring lets edges fan above and below the
  // source instead.
  const colTotalHeight = colNextY.map((y) => Math.max(0, y - GROUP_GAP));
  const tallest = Math.max(...colTotalHeight);
  for (const g of groupNodes) {
    const pos = GROUP_POSITIONS[g.groupLabel] || { col: 2, order: 99 };
    const offset = Math.max(0, (tallest - colTotalHeight[pos.col]) / 2);
    g.y += offset;
  }

  return groupNodes;
}

// ── Node emission ────────────────────────────────────────────────────────────

function emitNodes(toolMap, groupNodes) {
  const nodes = [];
  for (const g of groupNodes) {
    nodes.push({
      id: g.groupId,
      type: 'groupBox',
      position: { x: g.x, y: g.y },
      data: {
        label: g.groupLabel,
        category: 'custom',
        color: '#6B7280',
        icon: 'Folder',
        groupColor: g.groupColor,
        groupLabel: g.groupLabel,
      },
      style: { width: g.width, height: g.height },
      width: g.width,
      height: g.height,
    });

    g.tools.forEach((toolId, i) => {
      const info = toolMap.get(toolId);
      const msb = MSB_VENDOR_MAP[toolId];

      const data = msb
        ? buildBrandedNodeData(msb, info)
        : buildFallbackNodeData(info.toolName, info.categoryId);

      const subtitle = extractSubtitle(info);
      if (subtitle) data.customSubtitle = subtitle;

      const discoveredVia = extractDiscoveredVia(info);
      if (discoveredVia) data.discoveredVia = discoveredVia;

      nodes.push({
        id: `tool-${toolId}`,
        type: 'generic',
        position: { x: GROUP_PAD_X, y: GROUP_PAD_TOP + i * TOOL_HEIGHT },
        data,
        parentId: g.groupId,
        extent: 'parent',
      });
    });
  }
  return nodes;
}

function buildBrandedNodeData(msb, info) {
  const data = {
    label: msb.label,
    category: msb.category,
    color: msb.color,
    icon: msb.icon,
    provider: msb.provider,
    logo: msb.logo,
    nodeRole: msb.nodeRole,
  };
  if (msb.tags) data.tags = [...msb.tags];
  if (msb.implementationMethod) data.implementationMethod = msb.implementationMethod;

  // If our detected name diverges from the MSB display name, surface it as a
  // subtitle so users can see what we actually saw on the wire.
  if (info.toolName && info.toolName !== msb.label) {
    data.customSubtitle = info.toolName;
  }
  return data;
}

// ── Edge emission ────────────────────────────────────────────────────────────

// Edge builder that uses the real attribution graph from buildStackGraph().
// Each captured tool gets at most one parent edge — sourced from
// `node.parentPlatformId` when the parent is also a captured tool. Same-group
// edges use vertical handles so they read top-down inside the group; cross-
// group edges use the default left/right handles.
function emitGraphEdges(toolMap, graph) {
  const edges = [];
  if (!graph || !graph.nodes) return edges;

  // Resolve which group each tool belongs to so we can pick the right handle
  // pair (vertical for same-group, horizontal for cross-group).
  const groupOf = (toolId) => {
    const info = toolMap.get(toolId);
    if (!info) return null;
    return CATEGORY_GROUP_MAP[info.categoryId]?.groupLabel || 'Other';
  };

  for (const [toolId] of toolMap) {
    const node = graph.nodes.get(toolId);
    if (!node) continue;
    const parentId = node.parentPlatformId;
    if (!parentId || parentId === toolId) continue;
    if (!toolMap.has(parentId)) continue;

    const sameGroup = groupOf(parentId) === groupOf(toolId);
    edges.push(buildEdge(parentId, toolId, {
      handles: sameGroup
        ? { source: 'bottom-0', target: 'top-0' }
        : { source: 'right', target: 'left' },
    }));
  }

  // Consent → primary tag manager. Real attribution doesn't model consent
  // gating as a parent edge (CMPs don't *load* tag managers), so we still
  // synthesise one connecting edge per CMP. The "primary" TM is the one
  // whose graph-parent is outside our captured set (i.e. the top of the
  // tag-manager chain in this stack); fall back to the first captured TM.
  const consentTools = [];
  const tmsInGraph = [];
  for (const [id, info] of toolMap) {
    if (info.categoryId === 'consent') consentTools.push(id);
    if (TAG_MANAGER_TOOL_IDS.includes(id)) tmsInGraph.push(id);
  }
  if (consentTools.length > 0 && tmsInGraph.length > 0) {
    let primaryTM = tmsInGraph.find((id) => {
      const n = graph.nodes.get(id);
      return !n?.parentPlatformId || !toolMap.has(n.parentPlatformId);
    }) || tmsInGraph[0];
    for (const consentId of consentTools) {
      edges.push(buildEdge(consentId, primaryTM, {
        handles: { source: 'right', target: 'left' },
      }));
    }
  }

  return edges;
}

function buildEdge(sourceToolId, targetToolId, opts = {}) {
  const targetMsb = MSB_VENDOR_MAP[targetToolId];
  const stroke = targetMsb?.color || '#6B7280';
  const edge = {
    id: `edge-${sourceToolId}-to-${targetToolId}`,
    source: `tool-${sourceToolId}`,
    target: `tool-${targetToolId}`,
    animated: true,
    style: { stroke, strokeWidth: 2 },
    markerEnd: 'arrow',
    sourceHandle: opts.handles?.source || 'right',
    targetHandle: opts.handles?.target || 'left',
  };
  if (opts.label) edge.label = opts.label;
  if (opts.data) edge.data = opts.data;
  return edge;
}

// ── Per-event hints ──────────────────────────────────────────────────────────

function buildName(rootDomain) {
  if (rootDomain) return `${rootDomain} — Event Watcher Stack`;
  return 'Event Watcher Stack';
}

function buildDescription(rootDomain, toolCount, edgeCount) {
  const today = new Date().toISOString().slice(0, 10);
  const where = rootDomain ? ` from ${rootDomain}` : '';
  const rels = edgeCount > 0 ? `, ${edgeCount} connection${edgeCount === 1 ? '' : 's'}` : '';
  return `Detected by Event Watcher${where} on ${today} — ${toolCount} tool${toolCount === 1 ? '' : 's'}${rels}.`;
}

function extractDiscoveredVia(info) {
  // Surface the first script URL we saw — useful audit trail per spec §2.3.
  const url = info.scriptUrls.find(Boolean);
  if (!url) return null;
  // Trim query strings to keep the field readable.
  const trimmed = url.split('?')[0];
  return `script: ${trimmed}`;
}

function extractSubtitle(info) {
  // Tool instance identifiers (container IDs, account IDs, site IDs).
  // NOT event names — subtitles identify which instance of the tool.
  for (const name of info.eventNames) {
    const gtmMatch = name.match(/GTM-[A-Z0-9]+/);
    if (gtmMatch) return gtmMatch[0];
    const gtagMatch = name.match(/G-[A-Z0-9]+/);
    if (gtagMatch) return gtagMatch[0];
    const loadIdMatch = name.match(/Load:?\s+(\S+)/);
    if (loadIdMatch) return loadIdMatch[1];
  }
  for (const event of info.events) {
    const params = event.raw?.params || event.formatted?.params || {};
    if (params.tid) return params.tid;
    if (params.id) {
      const fbId = String(params.id);
      if (/^\d{10,}$/.test(fbId)) return fbId;
    }
    const convLabel = params.conversion_id || params.label;
    if (convLabel) return convLabel;
  }
  for (const name of info.eventNames) {
    const accountIdMatch = name.match(/\b(\d{6,})\b/);
    if (accountIdMatch) return accountIdMatch[1];
  }
  return null;
}

// Test-only exports — keep MSB_VENDOR_MAP etc. accessible for unit tests
// without leaking internals into the runtime API.
export const __test__ = {
  MSB_VENDOR_MAP,
  TAG_MANAGER_TOOL_IDS,
  buildName,
  buildDescription,
  buildFallbackNodeData,
  buildBrandedNodeData,
};
