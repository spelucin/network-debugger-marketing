// ============================================================
// AI Summary Section — Event Explainer (#17)
//
// Collapsible section inserted into the event detail view, right
// after the Overview card. Offers a small set of "task" presets —
// Explain Event, Explain Tool, Analyse Properties, QA Implementation —
// each backed by its own prompt template registered in shared/ai.
//
// Each task starts a thread:
//   - The first turn is the AI's response to the preset prompt.
//   - The user can ask follow-up questions in a chat-style input
//     below the response. Follow-ups send the full conversation
//     history (initial system + user prompt + every prior turn).
//
// Per-task state is cached on `event._aiSummaries[taskId]`:
//   {
//     provider, model,
//     initialMessages,  // [system, user] — for "Show prompt"
//     turns,            // [{role:'assistant'|'user', text}]
//     generatedAt
//   }
// Cache is naturally cleared by `clearEvents()` because it lives on
// the event object.
//
// Markdown rendering: AI responses are rendered through the local
// `markdown-render.js` so bold/lists/code/links display properly
// instead of printing literal Markdown markers.
//
// Visibility: when the user toggles "Show AI features" off in
// Settings, `body.ai-features-disabled` is added and panel.css hides
// the whole section.
// ============================================================

import { trackEvent } from '../analytics.js';
import { renderMarkdown, appendTextWithLinks } from './markdown-render.js';
import { MSG } from '../../shared/messages.js';
import {
  getSectionExpandedState,
  saveSectionState,
} from './detail-section-state.js';

// panel.js is imported lazily inside the "Add as Custom Endpoint" handler
// (see openCustomEndpointFormFromAI) to avoid pulling the whole panel
// coordinator into the module init path — the test harness imports this
// file directly and only needs buildAIInput, not the full panel graph.

// Cap on how many keys we keep from formatted.params before truncating —
// keeps the prompt under each template's max-token budget.
const MAX_PARAM_KEYS = 30;

// Hard cap on chat depth — protects context budgets and the user's wallet.
const MAX_FOLLOWUP_TURNS = 12;

// ─── Task presets ───────────────────────────────────────────────────────────
// Each preset maps to one registered prompt template in shared/ai.

const TASK_IDENTIFY_PLATFORM = {
  id: 'identify_platform',
  label: 'Identify Platform',
  description: 'Identify the tracking vendor behind this unknown event.',
};

const TASKS_KNOWN = [
  {
    id: 'explain_event',
    label: 'Explain Event',
    description: 'Plain-English summary of what this event captures.',
  },
  {
    id: 'explain_tool',
    label: 'Explain Tool',
    description: 'Background on the platform itself — what it is and who uses it.',
  },
  {
    id: 'analyse_properties',
    label: 'Analyse Properties',
    description: 'Walk through the parameters and call out gaps.',
  },
  {
    id: 'qa_implementation',
    label: 'QA Implementation',
    description: 'Opinionated review with concrete improvement suggestions.',
  },
];

// DataLayer / GTM / gtag pushes get their own preset set. The generic
// `explain_event` / `qa_implementation` tasks don't fit — they assume a
// known platform with a parser, whereas a dataLayer push is raw business
// data that calls for different angles (is the convention consistent
// across pushes? does it follow GA4 best practice?).
//
// `scope: 'session'` tells `runInitial` to include every captured
// dataLayer push in the AI input; `scope: 'single'` sends only the
// selected push + its dataLayer state snapshot.
const TASK_ASK_CUSTOM = {
  id: 'ask_custom',
  label: 'Your question',
  description: 'A custom question you asked about this dataLayer push.',
  scope: 'single',
  templateId: 'ask_datalayer_custom',
};

// Script-load pushes (event.isScriptLoad === true) get their own preset
// set. `trace_load_chain` depends on the initiator / children maps on
// the panel state — resolved lazily by `runInitial` before the prompt
// is built (same pattern used for dataLayer session scope).
const TASKS_SCRIPTLOAD = [
  {
    id: 'explain_script',
    label: 'Explain This Script',
    description: 'Plain-English summary of what this script is and what it does.',
    scope: 'single',
    templateId: 'explain_script',
  },
  {
    id: 'trace_load_chain',
    label: 'Trace Load Chain',
    description: 'Walk the parent + children tree that put this script on the page.',
    scope: 'single',
    templateId: 'trace_load_chain',
  },
  {
    id: 'review_privacy_consent',
    label: 'Review Privacy & Consent',
    description: 'Consent timing, origin, and whether this should have been gated.',
    scope: 'single',
    templateId: 'review_privacy_consent',
  },
  {
    id: 'optimization_tips',
    label: 'Optimization Tips',
    description: 'Performance & loading-strategy suggestions for this script.',
    scope: 'single',
    templateId: 'optimization_tips',
  },
];

const TASKS_DATALAYER = [
  {
    id: 'explain_push',
    label: 'Explain This Push',
    description: 'Plain-English summary of what this dataLayer push means.',
    scope: 'single',
    templateId: 'explain_push',
  },
  {
    id: 'evaluate_dl_quality',
    label: 'Evaluate Quality & Consistency',
    description: 'Audit naming, type drift, missing fields, duplicates across the session.',
    scope: 'session',
    templateId: 'evaluate_dl_quality',
  },
  {
    id: 'check_dl_best_practices',
    label: 'Check Best Practices',
    description: 'Detect the convention in use and validate against its best practices.',
    scope: 'session',
    templateId: 'check_dl_best_practices',
  },
  {
    id: 'suggest_dl_improvements',
    label: 'Suggest Improvements',
    description: 'Prioritised list of concrete improvements with before/after snippets.',
    scope: 'session',
    templateId: 'suggest_dl_improvements',
  },
];

// For unknown events (`event.platform === 'other'`) the 4 generic presets are
// replaced with a single purpose-built identification task. `Explain Event`
// and friends assume the platform is known and produce useless output like
// "this is a generic event from an unknown platform" — see the screenshots
// in docs/features/implemented/19-smart-unknown-identification.md.
const TASKS_UNKNOWN = [TASK_IDENTIFY_PLATFORM];

// GTM Container preset set. Shown in the AI Summary section rendered
// on GTM script-load events that have a parsed `containerData` block
// (tagCount, macroCount, predicateCount, pausedCount, tagsByEvent).
// Replaces the generic `TASKS_SCRIPTLOAD` set for GTM containers —
// those presets talk about "this script" in generic terms, whereas a
// container has structural data (tags, triggers, variables, events)
// that deserves its own prompts. Same section is also rendered inside
// each container card in the GTM Hub modal so the user can ask
// questions about the container without leaving the Hub.
const TASKS_CONTAINER = [
  {
    id: 'summarise_container',
    label: 'Summarise Container',
    description: 'Plain-English overview of what this GTM container is set up to do.',
    scope: 'container',
    templateId: 'summarise_container',
  },
  {
    id: 'qa_container_setup',
    label: 'QA Container Setup',
    description: 'Common-mistake audit: tag explosion, misused triggers, paused-that-should-fire.',
    scope: 'container',
    templateId: 'qa_container_setup',
  },
  {
    id: 'explain_container_events',
    label: 'Explain Events',
    description: 'Walk through the event names this container fires on and what runs for each.',
    scope: 'container',
    templateId: 'explain_container_events',
  },
  {
    id: 'suggest_container_improvements',
    label: 'Suggest Improvements',
    description: 'Concrete container-level improvements — consolidation, paused-tag cleanup, perf.',
    scope: 'container',
    templateId: 'suggest_container_improvements',
  },
];

// Page-event preset set. Shown in the AI Summary section rendered on
// page-event detail views. All four tasks operate on the *page scope*:
// the page event itself plus every event captured between it and the
// next page event. The session-wide chat still lives in the AI modal's
// Chat tab — these presets sit between per-event and per-session.
const TASKS_PAGE = [
  {
    id: 'summarise_page',
    label: 'Summarise Page',
    description: 'Plain-English overview of what happened on this page.',
    scope: 'page',
    templateId: 'summarise_page',
  },
  {
    id: 'qa_page_tracking',
    label: 'QA Tracking on Page',
    description: 'Completeness, missing fire-points, convention drift across this page.',
    scope: 'page',
    templateId: 'qa_page_tracking',
  },
  {
    id: 'check_page_consent',
    label: 'Check Consent Flow',
    description: 'Pre/post-consent behaviour and denied-category violations on this page.',
    scope: 'page',
    templateId: 'check_page_consent',
  },
  {
    id: 'find_page_gaps',
    label: 'Find Gaps',
    description: 'Events or parameters this page is missing relative to the detected convention.',
    scope: 'page',
    templateId: 'find_page_gaps',
  },
];

function isUnknownEvent(event) {
  return event?.platform === 'other';
}

// Page events are synthesised from webNavigation / history API — they
// carry `platform: 'pages'` or `isNavigation: true`. The AI Summary
// section on the page detail view routes these to the page preset set.
function isPageEvent(event) {
  return !!(event && (event.platform === 'pages' || event.isNavigation));
}

// GTM container script-loads whose response body was parsed by
// `parseGTMContainerResponse` — they carry structural data (tag
// counts, trigger/variable counts, tags-by-event map) that lets the
// container preset set reason about the container as a whole, not
// just as "one more script loaded on the page".
function isGTMContainerLoad(event) {
  return !!(
    event
    && event.isScriptLoad
    && event.platform === 'gtm'
    && event.formatted?.containerData
  );
}

// Script-load events (event.isScriptLoad === true). Must be screened
// BEFORE `isDataLayerEvent` because GTM script loads carry
// `platform: 'gtm'` — they'd otherwise mis-route to the dataLayer
// preset set (wrong prompt shape, no pushData).
function isScriptLoadEvent(event) {
  return !!event?.isScriptLoad;
}

// DataLayer-eligible event: any dataLayer / GTM / gtag push that is not
// a GTM lifecycle signal, historical reconstruction, or a consent push
// already covered by the Google consent AI path. Skipping the consent
// cases keeps the UI clean — a `consent update` push and a `gtag set
// consent` command don't need a separate AI explainer when the Google
// preset set already covers them.
function isDataLayerEvent(event) {
  if (!event) return false;
  if (!['datalayer', 'gtm', 'gtag'].includes(event.platform)) return false;
  const formatted = event.formatted || {};
  if (formatted.isHistorical) return false;
  if (formatted.isGTMInternalEvent) return false;
  const eventName = event.eventName || formatted.event || '';
  if (typeof eventName === 'string' && eventName.startsWith('gtm.')) return false;
  if (formatted.googleConsentMode) return false;
  if (formatted.gtagSetCommand?.type === 'consent-setting') return false;
  return true;
}

function getTasksForEvent(event) {
  // Order matters — later branches assume the earlier ones didn't match.
  // GTM container loads MUST be screened before the generic script-load
  // branch, and page events before known-platform routing, because both
  // would otherwise slip into the wrong preset set and return useless
  // "this is a generic event from an unknown platform" style output.
  if (isPageEvent(event)) return TASKS_PAGE;
  if (isGTMContainerLoad(event)) return TASKS_CONTAINER;
  if (isScriptLoadEvent(event)) return TASKS_SCRIPTLOAD;
  if (isDataLayerEvent(event)) return TASKS_DATALAYER;
  if (isUnknownEvent(event)) return TASKS_UNKNOWN;
  return TASKS_KNOWN;
}

// O(1) task resolution (#131 F7) — single Map over all preset arrays, built
// once at module load. Insertion order mirrors the old sequential-find
// priority (KNOWN → DATALAYER → SCRIPTLOAD → CONTAINER → PAGE) so a
// duplicated id would resolve to the same task the old code returned.
const TASK_BY_ID = new Map();
for (const task of [TASK_IDENTIFY_PLATFORM, TASK_ASK_CUSTOM,
  ...TASKS_KNOWN, ...TASKS_DATALAYER, ...TASKS_SCRIPTLOAD, ...TASKS_CONTAINER, ...TASKS_PAGE]) {
  if (!TASK_BY_ID.has(task.id)) TASK_BY_ID.set(task.id, task);
}

function getTaskById(taskId) {
  return TASK_BY_ID.get(taskId) || null;
}

// Static SVG strings (no user data, safe to inject as innerHTML).
// SPARKLE_SVG mirrors the icon on the toolbar AI button (#ai-btn in
// panel.html) so the section reads as "the same feature, in detail" —
// keep the two definitions in sync if either gets restyled.
const SPARKLE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M19 14l.75 2L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-1z"/><path d="M5 4l.5 1.5L7 6l-1.5.5L5 8l-.5-1.5L3 6l1.5-.5z"/></svg>';
const CHEVRON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const SPINNER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" class="ai-summary-spinner" aria-hidden="true"><path d="M12 2a10 10 0 0 1 10 10"/></svg>';
const COPY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const SEND_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>';
// Flag icon — mirrors the "Report tool" button in the unknown-event
// detail view so the AI Summary variant reads as the same action.
const FLAG_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';

/**
 * Build the AI Summary section element for an event. Returns null for
 * event types where summarization doesn't make sense (consent markers,
 * script loads, dataLayer pushes — see callers).
 *
 * @param {Object} event
 * @param {Object} [options]
 * @param {'event'|'page'} [options.scope] - controls the scope badge
 *   shown in the header and which task preset set is used. 'page' is
 *   only meaningful when the event is a page-navigation event; the
 *   preset set falls back to 'event' otherwise.
 * @returns {HTMLElement|null}
 */
export function renderAISummarySection(event, options = {}) {
  if (!event) return null;
  // Script-load events are always eligible — the dataLayer screen
  // below assumes `platform in {datalayer, gtm, gtag}` means a
  // dataLayer push, which would wrongly reject GTM script loads.
  if (!isScriptLoadEvent(event)) {
    // DataLayer / GTM / gtag events are only eligible when they pass
    // the `isDataLayerEvent` screen (drops GTM internals, historical
    // pushes, and Google-consent pushes). Known platform events and
    // unknown events fall through — they're always eligible.
    if (
      event.platform === 'datalayer'
      || event.platform === 'gtm'
      || event.platform === 'gtag'
    ) {
      if (!isDataLayerEvent(event)) return null;
    }
  }

  const section = document.createElement('div');
  section.className = 'detail-section-card ai-summary-section';

  // Section state is keyed by a stable title (not the user-facing
  // label, which swaps between "AI Summary" / "AI Identification"
  // depending on event class). Default is collapsed. If the user has
  // already opened this section on the currently selected event, that
  // choice is preserved across re-renders (new events arriving in the
  // stream, filter changes, etc. — see `detail-section-state.js`).
  const SECTION_STATE_KEY = 'ai_summary_section';
  const startExpanded = getSectionExpandedState(SECTION_STATE_KEY, false);

  const header = document.createElement('div');
  header.className = 'detail-section-card-header ai-summary-header';
  if (!startExpanded) header.classList.add('collapsed');

  const chevron = document.createElement('span');
  chevron.className = 'ai-summary-chevron';
  chevron.insertAdjacentHTML('afterbegin', CHEVRON_SVG);
  header.appendChild(chevron);

  const icon = document.createElement('span');
  icon.className = 'ai-summary-icon';
  icon.insertAdjacentHTML('afterbegin', SPARKLE_SVG);
  header.appendChild(icon);

  // Title swaps to "AI Identification" for unknown events so users
  // understand this surface is about identifying the vendor, not
  // summarising a known event. Icon and color stay unchanged so the
  // section stays visually recognisable as the same AI feature.
  const label = document.createElement('span');
  label.textContent = isUnknownEvent(event) ? 'AI Identification' : 'AI Summary';
  header.appendChild(label);

  // Scope badge — tells the user which scope of data this AI section
  // operates on. Explicit `options.scope` from the caller wins; otherwise
  // derive from the event: page events → 'page', GTM container loads →
  // 'container', everything else → 'event'. Unknown-platform
  // identification skips the badge entirely — the "AI Identification"
  // title already communicates scope, and a "[Event]" tag next to it
  // reads as noise.
  let resolvedScope = 'event';
  if (options?.scope === 'page' || options?.scope === 'container') {
    resolvedScope = options.scope;
  } else if (isPageEvent(event)) {
    resolvedScope = 'page';
  } else if (isGTMContainerLoad(event)) {
    resolvedScope = 'container';
  }
  const SCOPE_LABELS = { event: 'Event', page: 'Page', container: 'Container' };
  if (!isUnknownEvent(event)) {
    const badge = document.createElement('span');
    badge.className = `ai-summary-scope-badge ai-summary-scope-badge--${resolvedScope}`;
    badge.textContent = SCOPE_LABELS[resolvedScope] || 'Event';
    header.appendChild(badge);
  }

  const content = document.createElement('div');
  content.className = 'detail-section-card-content ai-summary-content';
  if (!startExpanded) content.classList.add('collapsed');

  // `localState.scope` is read downstream by `getTasksForEvent` and
  // `runInitial` to pick the page-scoped preset set + input builder.
  // Only 'page' unlocks the page preset set; any other value (including
  // undefined) falls back to the per-event presets.
  const localState = { activeTaskId: null, scope: resolvedScope };

  header.addEventListener('click', () => {
    const wasCollapsed = header.classList.contains('collapsed');
    header.classList.toggle('collapsed');
    content.classList.toggle('collapsed');
    saveSectionState(SECTION_STATE_KEY, header.classList.contains('collapsed'));
    if (wasCollapsed) paint(content, event, localState);
  });

  // Paint immediately if the section is starting expanded (because the
  // user had it open on this event before a re-render).
  if (startExpanded) paint(content, event, localState);

  section.appendChild(header);
  section.appendChild(content);
  return section;
}

// ─── Painting ────────────────────────────────────────────────────────────────

async function paint(container, event, localState) {
  // Default to whichever task already has a thread, if any
  if (!localState.activeTaskId) {
    const cached = event._aiSummaries || {};
    const cachedTaskIds = Object.keys(cached);
    if (cachedTaskIds.length > 0) {
      localState.activeTaskId = cachedTaskIds[0];
    }
  }

  if (container.dataset.painted === 'inflight') return;

  const configured = await isAIConfigured();
  if (!configured) {
    paintCTA(container, event);
    return;
  }

  // Re-hydrate a cached error from a prior attempt on this event, so
  // the detail-pane re-rendering (new events arriving, filter changes)
  // doesn't flash the error away. Stale transient errors (rate_limited,
  // server_error, timeout older than 60s) are treated as absent so
  // auto-identify can have another go once the window has passed.
  const errorTaskId = pickErrorTaskId(event, localState);
  if (errorTaskId) {
    localState.activeTaskId = errorTaskId;
    paintError(container, event, localState, event._aiErrors[errorTaskId], { skipCache: true });
    return;
  }

  // Opt-in auto-run: if the user has turned on "Auto-identify unknown
  // platforms" in AI Provider settings, kick off identification as soon
  // as the section paints — without a click. Cache-aware: if a result
  // is already on `event._aiSummaries.identify_platform`, we fall
  // through to the normal thread render instead of spending tokens
  // again.
  if (
    isUnknownEvent(event)
    && !event._aiSummaries?.[TASK_IDENTIFY_PLATFORM.id]
    && (await isAutoActionEnabled('identifyUnknown'))
  ) {
    localState.activeTaskId = TASK_IDENTIFY_PLATFORM.id;
    localState.autoRanTaskIds = localState.autoRanTaskIds || new Set();
    localState.autoRanTaskIds.add(TASK_IDENTIFY_PLATFORM.id);
    runInitial(container, event, localState, TASK_IDENTIFY_PLATFORM.id, /* isRegen */ false, /* isAuto */ true);
    return;
  }

  if (localState.activeTaskId) {
    paintTaskView(container, event, localState);
  } else {
    paintTaskPicker(container, event, localState);
  }
}

function paintCTA(container, event) {
  container.dataset.painted = 'cta';
  container.replaceChildren();

  const wrap = document.createElement('div');
  wrap.className = 'ai-summary-cta';

  const msg = document.createElement('p');
  msg.className = 'ai-summary-cta-text';
  if (isUnknownEvent(event)) {
    msg.textContent = 'Connect an AI provider to identify unknown tracking platforms on demand.';
  } else if (isScriptLoadEvent(event)) {
    msg.textContent = 'Connect an AI provider to explain and audit loaded scripts on demand.';
  } else if (isDataLayerEvent(event)) {
    msg.textContent = 'Connect an AI provider to explain and audit dataLayer pushes on demand.';
  } else {
    msg.textContent = 'Connect an AI provider to generate plain-English summaries of captured events.';
  }
  wrap.appendChild(msg);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-primary ai-summary-cta-btn';
  btn.textContent = 'Configure AI in Settings';
  btn.addEventListener('click', () => {
    const aiBtn = document.getElementById('ai-btn');
    if (aiBtn) aiBtn.click();
  });
  wrap.appendChild(btn);

  container.appendChild(wrap);
}

function paintTaskPicker(container, event, localState) {
  container.dataset.painted = 'picker';
  container.replaceChildren();

  const wrap = document.createElement('div');
  wrap.className = 'ai-summary-picker';

  const hint = document.createElement('p');
  hint.className = 'ai-summary-hint';
  if (isUnknownEvent(event)) {
    hint.textContent = 'Ask your configured AI to identify this unknown vendor — or ask your own question below.';
  } else if (isScriptLoadEvent(event)) {
    hint.textContent = 'Pick a focus — or ask your own question about this script load.';
  } else if (isDataLayerEvent(event)) {
    hint.textContent = 'Pick a focus — or ask your own question about this dataLayer push.';
  } else {
    hint.textContent = 'Pick a focus — or ask your own question about this event.';
  }
  wrap.appendChild(hint);

  const grid = document.createElement('div');
  grid.className = 'ai-summary-task-grid';
  const tasks = getTasksForEvent(event);
  for (const task of tasks) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ai-summary-task-btn';

    const labelEl = document.createElement('span');
    labelEl.className = 'ai-summary-task-btn-label';
    labelEl.textContent = task.label;
    btn.appendChild(labelEl);

    const descEl = document.createElement('span');
    descEl.className = 'ai-summary-task-btn-desc';
    descEl.textContent = task.description;
    btn.appendChild(descEl);

    btn.addEventListener('click', () => {
      localState.activeTaskId = task.id;
      runInitial(container, event, localState, task.id);
    });
    grid.appendChild(btn);
  }
  wrap.appendChild(grid);

  // Free-form "Ask anything…" input below the preset grid. Submitting
  // creates (or replaces) an `ask_custom` thread on the event, exactly
  // like picking a preset would. Rendered for every event class — the
  // template and input-builder are resolved per event type inside
  // `runCustomAsk`. Excluded for page events and GTM container loads:
  // scope-wide free-form questions belong in the AI modal's session
  // Chat tab, and `runCustomAsk` doesn't yet know how to build a
  // container payload — falling through to `buildAIInput` would drop
  // the containerData the model needs.
  if (!isPageEvent(event) && !isGTMContainerLoad(event)) {
    wrap.appendChild(buildCustomAskRow(container, event, localState));
  }

  container.appendChild(wrap);
}

function paintTaskView(container, event, localState) {
  container.replaceChildren();

  container.appendChild(buildTaskSwitcher(event, localState, container));

  const summary = event._aiSummaries?.[localState.activeTaskId];
  if (!summary) {
    runInitial(container, event, localState, localState.activeTaskId);
    return;
  }

  paintThread(container, event, localState, summary);
}

function buildTaskSwitcher(event, localState, container) {
  const switcher = document.createElement('div');
  switcher.className = 'ai-summary-task-switcher';

  // Unknown events only ever have one task. Hide the switcher entirely
  // in that case — a single-chip row would just be visual noise.
  const tasks = getTasksForEvent(event).slice();

  // Surface an `ask_custom` chip whenever a custom-question thread is
  // cached on the event, so users can return to it after navigating to
  // a preset. Applies to every event class that supports the "Ask
  // anything…" input (all of them, since the input renders on the
  // picker view for every event).
  if (
    event._aiSummaries?.[TASK_ASK_CUSTOM.id]
    && !tasks.some((t) => t.id === TASK_ASK_CUSTOM.id)
  ) {
    tasks.push(TASK_ASK_CUSTOM);
  }

  if (tasks.length <= 1) return switcher;

  for (const task of tasks) {
    const generated = !!event._aiSummaries?.[task.id];
    const isActive = task.id === localState.activeTaskId;

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'ai-summary-task-chip';
    if (isActive) chip.classList.add('active');
    if (generated) chip.classList.add('generated');
    chip.textContent = task.label;
    chip.title = task.description + (generated ? '' : ' — not generated yet');

    chip.addEventListener('click', () => {
      if (task.id === localState.activeTaskId) return;
      localState.activeTaskId = task.id;
      paintTaskView(container, event, localState);
    });

    switcher.appendChild(chip);
  }

  return switcher;
}

function paintThread(container, event, localState, summary) {
  container.dataset.painted = 'thread';

  const taskMeta = getTaskById(localState.activeTaskId);
  if (taskMeta?.description) {
    const taskDesc = document.createElement('p');
    taskDesc.className = 'ai-summary-task-desc';
    taskDesc.textContent = taskMeta.description;
    container.appendChild(taskDesc);
  }

  // "Auto-run" indicator — lets the user see at a glance that this
  // result was triggered automatically by the Auto-identify toggle,
  // not by their own click. Only shown on the very first view for a
  // given task; once the user has interacted (regenerated, sent a
  // follow-up) the indicator is no longer useful.
  const wasAutoRun = localState.autoRanTaskIds?.has(localState.activeTaskId);
  if (wasAutoRun && summary.turns?.length === 1) {
    const autoBadge = document.createElement('p');
    autoBadge.className = 'ai-summary-auto-indicator';
    autoBadge.textContent = 'Auto-run — you enabled this in AI Provider settings.';
    container.appendChild(autoBadge);
  }

  // Conversation thread — every turn gets its own block
  const thread = document.createElement('div');
  thread.className = 'ai-summary-thread';

  const turns = Array.isArray(summary.turns) ? summary.turns : [];
  turns.forEach((turn, idx) => {
    // Pass the summary into the first assistant turn so it can render
    // the "Show preset prompt" affordance — that prompt only describes
    // the initial reply, so the toggle belongs visually next to it
    // rather than at the bottom of the whole chat.
    thread.appendChild(buildTurnBlock(turn, idx === 0, idx === 0 ? { summary, taskId: localState.activeTaskId } : null));
  });
  container.appendChild(thread);

  // Provider/model meta — shown once below the thread
  const meta = document.createElement('div');
  meta.className = 'ai-summary-meta';
  const provider = summary.provider || 'AI';
  const model = summary.model ? ` · ${summary.model}` : '';
  meta.textContent = `Generated by ${provider}${model}`;
  container.appendChild(meta);

  // Action row — Regenerate, plus (for identify_platform) a shortcut
  // into the Custom Endpoints form so the user can turn a confirmed AI
  // identification into a persistent mapping in one click.
  const actions = document.createElement('div');
  actions.className = 'ai-summary-actions';

  if (localState.activeTaskId === TASK_IDENTIFY_PLATFORM.id) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn-primary ai-summary-add-endpoint-btn';
    addBtn.textContent = 'Add as Custom Endpoint';
    addBtn.title = 'Open the Custom Endpoints form pre-filled with this host — confirm and save to make the mapping permanent.';
    addBtn.addEventListener('click', () => {
      openCustomEndpointFormFromAI(event);
      trackEvent('ai_identify_unknown', {
        action: 'accept',
        provider: summary.provider || null,
      });
    });
    actions.appendChild(addBtn);

    // Report Missing Tool — yellow, mirrors the "Report tool" button
    // on the unknown-event detail view. Prefills everything we can
    // parse from the AI's identification reply (platform name,
    // category, endpoint, plus the full AI rationale in comments).
    const reportBtn = document.createElement('button');
    reportBtn.type = 'button';
    reportBtn.className = 'btn ai-summary-report-missing-btn';
    reportBtn.insertAdjacentHTML('afterbegin', FLAG_SVG);
    const reportLabel = document.createElement('span');
    reportLabel.textContent = 'Report missing tool';
    reportBtn.appendChild(reportLabel);
    reportBtn.title = "Open the missing-tool report form pre-filled with the AI's identification — add a comment or send as-is.";
    reportBtn.addEventListener('click', () => {
      openReportMissingToolFromAI(event, summary);
      trackEvent('ai_identify_unknown', {
        action: 'report_missing',
        provider: summary.provider || null,
      });
    });
    actions.appendChild(reportBtn);
  }

  const regen = document.createElement('button');
  regen.type = 'button';
  regen.className = 'btn btn-secondary ai-summary-regen-btn';
  regen.textContent = 'Regenerate first reply';
  regen.title = 'Discard the entire chat and re-run the preset prompt';
  regen.addEventListener('click', () => {
    if (turns.length > 1) {
      const ok = window.confirm('Regenerating discards the current chat for this task. Continue?');
      if (!ok) return;
    }
    runInitial(container, event, localState, localState.activeTaskId, /* isRegen */ true);
  });
  actions.appendChild(regen);

  container.appendChild(actions);

  // Chat input — hidden if we've hit the depth cap
  const followupSlot = document.createElement('div');
  followupSlot.className = 'ai-summary-followup-slot';
  container.appendChild(followupSlot);

  const followupCount = turns.filter((t) => t.role === 'user').length;
  if (followupCount >= MAX_FOLLOWUP_TURNS) {
    const cap = document.createElement('p');
    cap.className = 'ai-summary-cap-notice';
    cap.textContent = `Reached the ${MAX_FOLLOWUP_TURNS}-message follow-up limit. Regenerate to start fresh.`;
    followupSlot.appendChild(cap);
  } else {
    followupSlot.appendChild(buildChatInput(container, event, localState));
  }

  // Every event class exposes an "Ask something new" input below the
  // follow-up chat so users can start a fresh custom question without
  // having to unwind the current task. Submitting replaces any existing
  // `ask_custom` thread on the event. Page events and GTM container
  // loads opt out — see the picker-row comment for why.
  if (!isPageEvent(event) && !isGTMContainerLoad(event)) {
    container.appendChild(buildCustomAskRow(container, event, localState, /* inThread */ true));
  }
}

/**
 * Build a single conversation turn block. The first assistant turn
 * gets a subtle "first response" framing; later turns are tagged by
 * role so the thread is scannable.
 *
 * @param {Object} turn - { role, text }
 * @param {boolean} isFirst - true for the very first turn in the thread
 * @param {Object|null} promptInfo - { summary, taskId } when this turn
 *   should expose the "Show preset prompt" affordance (first assistant
 *   turn only). The toggle is scoped to this turn because the prompt
 *   it reveals describes only the initial reply, not later follow-ups.
 */
function buildTurnBlock(turn, isFirst, promptInfo = null) {
  const block = document.createElement('div');
  block.className = `ai-summary-turn ai-summary-turn--${turn.role}`;
  if (isFirst) block.classList.add('ai-summary-turn--first');

  const head = document.createElement('div');
  head.className = 'ai-summary-turn-head';

  const role = document.createElement('span');
  role.className = 'ai-summary-turn-role';
  role.textContent = turn.role === 'user' ? 'You' : 'AI';
  head.appendChild(role);

  if (turn.role === 'assistant') {
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn-icon ai-summary-copy-btn';
    copyBtn.title = 'Copy reply to clipboard';
    copyBtn.setAttribute('aria-label', 'Copy reply to clipboard');
    copyBtn.insertAdjacentHTML('afterbegin', COPY_SVG);
    copyBtn.addEventListener('click', () => copyTurnText(turn.text || '', copyBtn));
    head.appendChild(copyBtn);
  }

  block.appendChild(head);

  const body = document.createElement('div');
  body.className = 'ai-summary-turn-body';
  if (turn.role === 'assistant') {
    // Markdown-rendered HTML — already escaped by renderMarkdown
    body.innerHTML = renderMarkdown(turn.text || '');
  } else {
    // User input shown verbatim, never as HTML
    body.textContent = turn.text || '';
  }
  block.appendChild(body);

  // Show preset prompt toggle — first assistant turn only. Visually
  // scoped to this turn so it's clear the prompt belongs to this reply.
  if (promptInfo && turn.role === 'assistant') {
    block.appendChild(buildPromptToggle(promptInfo.summary, promptInfo.taskId));
  }

  return block;
}

/**
 * Footer affordance on the first assistant turn — "Show preset prompt"
 * link that expands the messages array sent to the provider for the
 * initial reply. Built lazily so the prompt details aren't materialised
 * unless the user opens them.
 */
function buildPromptToggle(summary, taskId) {
  const wrap = document.createElement('div');
  wrap.className = 'ai-summary-turn-footer';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'btn btn-link ai-summary-prompt-toggle';
  toggle.textContent = 'Show preset prompt';
  toggle.title = 'Reveal the system + user messages sent to the provider for this initial reply (does not include follow-ups)';
  toggle.setAttribute('aria-expanded', 'false');
  wrap.appendChild(toggle);

  const details = document.createElement('div');
  details.className = 'ai-summary-prompt-details';
  details.hidden = true;
  wrap.appendChild(details);

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = 'Show preset prompt';
      details.hidden = true;
    } else {
      toggle.setAttribute('aria-expanded', 'true');
      toggle.textContent = 'Hide preset prompt';
      if (!details.dataset.built) {
        renderPromptDetails(details, summary);
        details.dataset.built = '1';
      }
      details.hidden = false;
      trackEvent('ai_summary', { action: 'show_prompt', task: taskId });
    }
  });

  return wrap;
}

function copyTurnText(text, btn) {
  const done = () => {
    btn.classList.add('copied');
    const original = btn.title;
    btn.title = 'Copied!';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.title = original;
    }, 1500);
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
  trackEvent('ai_summary', { action: 'copy_reply' });
}

function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('copy');
    done();
  } catch {
    // copy failed silently
  }
  document.body.removeChild(ta);
}

/**
 * The chat-style input row below the thread. Submitting sends the
 * full conversation (initial messages + every prior turn) to the AI
 * via `AI_REQUEST` with an explicit `messages` array (no template).
 */
function buildChatInput(container, event, localState) {
  const wrap = document.createElement('div');
  wrap.className = 'ai-summary-followup';

  const ta = document.createElement('textarea');
  ta.className = 'ai-summary-followup-input';
  ta.rows = 2;
  ta.placeholder = 'Ask a follow-up about this event…';
  ta.setAttribute('aria-label', 'Follow-up question');
  wrap.appendChild(ta);

  const sendBtn = document.createElement('button');
  sendBtn.type = 'button';
  sendBtn.className = 'btn btn-primary ai-summary-followup-send';
  sendBtn.disabled = true;
  sendBtn.title = 'Send follow-up';
  sendBtn.setAttribute('aria-label', 'Send follow-up');
  sendBtn.insertAdjacentHTML('afterbegin', SEND_SVG);
  const sendLabel = document.createElement('span');
  sendLabel.textContent = 'Send';
  sendBtn.appendChild(sendLabel);
  wrap.appendChild(sendBtn);

  const updateState = () => {
    sendBtn.disabled = ta.value.trim().length === 0;
  };
  ta.addEventListener('input', updateState);
  ta.addEventListener('keydown', (e) => {
    // Ctrl/Cmd+Enter sends — plain Enter inserts a newline so users
    // can write multi-line questions.
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !sendBtn.disabled) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  sendBtn.addEventListener('click', () => {
    const text = ta.value.trim();
    if (!text) return;
    ta.value = '';
    updateState();
    sendFollowup(container, event, localState, text);
  });

  return wrap;
}

/**
 * Free-form "Ask anything about this dataLayer event" input row. Lives
 * directly below the preset grid in the picker view and below the
 * follow-up input in the thread view, so users can start a new custom
 * question from either place.
 *
 * Send button flips from grey (disabled) to blue (`.is-active`) on the
 * first non-whitespace keystroke. Submitting replaces any existing
 * `ask_custom` thread on the event — the cache is single-slot so the
 * last question is always what the user sees.
 *
 * @param {boolean} [inThread=false] - true when rendered under a thread
 *   (paintTaskView); renders an extra label/divider.
 */
function buildCustomAskRow(container, event, localState, inThread = false) {
  const wrap = document.createElement('div');
  wrap.className = 'ai-summary-custom-ask';
  if (inThread) wrap.classList.add('ai-summary-custom-ask--in-thread');

  if (inThread) {
    const divider = document.createElement('p');
    divider.className = 'ai-summary-custom-ask-divider';
    divider.textContent = 'Or ask something new:';
    wrap.appendChild(divider);
  }

  const row = document.createElement('div');
  row.className = 'ai-summary-custom-ask-row';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'ai-summary-custom-ask-input';
  // Context-aware placeholder — same UX on every event class, but the
  // wording reflects what "this event" means for the selected row.
  let placeholder;
  if (isScriptLoadEvent(event)) {
    placeholder = 'Ask anything about this script load…';
  } else if (isDataLayerEvent(event)) {
    placeholder = 'Ask anything about this dataLayer event…';
  } else if (isUnknownEvent(event)) {
    placeholder = 'Ask anything about this unknown request…';
  } else {
    placeholder = 'Ask anything about this event…';
  }
  input.placeholder = placeholder;
  input.setAttribute('aria-label', placeholder.replace(/…$/, ''));
  row.appendChild(input);

  const sendBtn = document.createElement('button');
  sendBtn.type = 'button';
  sendBtn.className = 'ai-summary-custom-ask-send';
  sendBtn.disabled = true;
  sendBtn.title = 'Send question';
  sendBtn.setAttribute('aria-label', 'Send question');
  sendBtn.insertAdjacentHTML('afterbegin', SEND_SVG);
  row.appendChild(sendBtn);

  wrap.appendChild(row);

  const updateState = () => {
    const hasText = input.value.trim().length > 0;
    sendBtn.disabled = !hasText;
    sendBtn.classList.toggle('is-active', hasText);
  };
  input.addEventListener('input', updateState);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !sendBtn.disabled) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  sendBtn.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    updateState();
    runCustomAsk(container, event, localState, text);
  });

  return wrap;
}

function paintLoading(container, event, localState, taskId, mode = 'initial') {
  container.dataset.painted = 'inflight';
  container.replaceChildren();

  // Keep the switcher visible during initial generation so the user
  // can bail out to another task while waiting.
  if (mode === 'initial') {
    container.appendChild(buildTaskSwitcher(event, localState, container));
  }

  const wrap = document.createElement('div');
  wrap.className = 'ai-summary-loading';

  const spinner = document.createElement('span');
  spinner.className = 'ai-summary-spinner-wrap';
  spinner.insertAdjacentHTML('afterbegin', SPINNER_SVG);
  wrap.appendChild(spinner);

  const taskMeta = getTaskById(taskId);
  const msg = document.createElement('span');
  if (mode === 'followup') {
    msg.textContent = 'Thinking…';
  } else {
    msg.textContent = taskMeta ? `Running "${taskMeta.label}"…` : 'Analyzing event…';
  }
  wrap.appendChild(msg);

  container.appendChild(wrap);
}

function paintError(container, event, localState, errorInfo, options = {}) {
  container.dataset.painted = 'error';
  container.replaceChildren();

  container.appendChild(buildTaskSwitcher(event, localState, container));

  // Cache the error on the event so re-renders (which happen whenever
  // the event-detail pane repaints — new events arriving in the stream,
  // filter changes, etc.) don't wipe the error and re-trigger another
  // failing request. The `paint()` re-hydration path passes skipCache so
  // the original cachedAt timestamp sticks across re-renders; that way
  // staleness counts from when the error first happened, not from the
  // most recent repaint.
  if (!options.skipCache && localState.activeTaskId) {
    event._aiErrors = event._aiErrors || {};
    event._aiErrors[localState.activeTaskId] = {
      error: errorInfo.error,
      message: errorInfo.message || '',
      provider: errorInfo.provider || null,
      cachedAt: Date.now(),
    };
  }

  const wrap = document.createElement('div');
  wrap.className = 'ai-summary-error';

  const heading = document.createElement('p');
  heading.className = 'ai-summary-error-heading';
  heading.textContent = friendlyErrorHeading(errorInfo.error, errorInfo.provider);
  wrap.appendChild(heading);

  if (errorInfo.message) {
    const detail = document.createElement('p');
    detail.className = 'ai-summary-error-detail';
    appendTextWithLinks(detail, errorInfo.message);
    wrap.appendChild(detail);
  }

  // Clarifier: make it unambiguous that the message above is from the
  // provider's API and not a bug in the extension. Shown only for
  // provider-origin errors — including it for `no_provider` / `network`
  // / `timeout` would mislead (those are config or client-side causes).
  if (PROVIDER_SIDE_ERRORS.has(errorInfo.error)) {
    const label = providerLabel(errorInfo.provider) || 'the AI provider';
    const clarifier = document.createElement('p');
    clarifier.className = 'ai-summary-error-clarifier';
    clarifier.textContent = `This message comes from ${label}, not Event Watcher.`;
    wrap.appendChild(clarifier);
  }

  const actions = document.createElement('div');
  actions.className = 'ai-summary-actions';

  if (errorInfo.error === 'no_provider' || errorInfo.error === 'no_consent') {
    const settingsBtn = document.createElement('button');
    settingsBtn.type = 'button';
    settingsBtn.className = 'btn btn-primary';
    settingsBtn.textContent = 'Open AI Settings';
    settingsBtn.addEventListener('click', () => {
      const aiBtn = document.getElementById('ai-btn');
      if (aiBtn) aiBtn.click();
    });
    actions.appendChild(settingsBtn);
  } else {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn-secondary';
    retry.textContent = 'Try again';
    retry.addEventListener('click', () => {
      // Drop the cached error before retrying so `paint()` doesn't
      // short-circuit back into the error view before the request fires.
      if (event._aiErrors && localState.activeTaskId) {
        delete event._aiErrors[localState.activeTaskId];
      }
      runInitial(container, event, localState, localState.activeTaskId);
    });
    actions.appendChild(retry);
  }

  wrap.appendChild(actions);
  container.appendChild(wrap);
}

function renderPromptDetails(container, summary) {
  container.replaceChildren();

  const intro = document.createElement('p');
  intro.className = 'ai-summary-prompt-intro';
  intro.textContent = 'The messages sent to the provider for the initial reply, after PII redaction. The system message frames how the model treats the data; the user message contains the event payload. Follow-up turns are not shown here — they only exist in the chat above.';
  container.appendChild(intro);

  const messages = Array.isArray(summary.initialMessages) ? summary.initialMessages : [];
  if (messages.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'ai-summary-prompt-empty';
    empty.textContent = 'No prompt was captured for this result.';
    container.appendChild(empty);
    return;
  }

  for (const msg of messages) {
    const block = document.createElement('div');
    block.className = `ai-summary-prompt-msg ai-summary-prompt-msg--${msg.role || 'unknown'}`;

    const roleLabel = document.createElement('div');
    roleLabel.className = 'ai-summary-prompt-msg-role';
    roleLabel.textContent = msg.role || 'message';
    block.appendChild(roleLabel);

    const pre = document.createElement('pre');
    pre.className = 'ai-summary-prompt-msg-content';
    pre.textContent = String(msg.content ?? '');
    block.appendChild(pre);

    container.appendChild(block);
  }
}

// ─── Generation paths ───────────────────────────────────────────────────────

/**
 * Run the preset prompt for a task. This kicks off (or restarts) the
 * thread for that task — any existing turns are discarded.
 *
 * @param {boolean} [isRegen=false] - user clicked Regenerate (not the initial run)
 * @param {boolean} [isAuto=false] - kicked off by the Auto-identify toggle, not a click
 */
async function runInitial(container, event, localState, taskId, isRegen = false, isAuto = false) {
  paintLoading(container, event, localState, taskId, 'initial');

  // DataLayer / script-load / page / container events use different
  // input builders and different sets of prompt templates. Task
  // metadata carries `templateId` and `scope` ('single' | 'session' |
  // 'page' | 'container') — resolve both here and pick the right
  // builder per event class. GTM container loads must be screened
  // before the generic script-load branch (same ordering as
  // `getTasksForEvent`).
  let aiInput;
  let promptType = taskId;
  if (isPageEvent(event)) {
    const task = getTaskById(taskId);
    if (task?.templateId) promptType = task.templateId;
    const pageEvents = await getPageScopedEvents(event);
    aiInput = buildPageAIInput(event, pageEvents);
  } else if (isGTMContainerLoad(event)) {
    const task = getTaskById(taskId);
    if (task?.templateId) promptType = task.templateId;
    const { initiator, children } = await getScriptChainContext(event);
    aiInput = buildGTMContainerAIInput(event, { initiator, children });
  } else if (isScriptLoadEvent(event)) {
    const task = getTaskById(taskId);
    if (task?.templateId) promptType = task.templateId;
    const { initiator, children } = await getScriptChainContext(event);
    aiInput = buildScriptLoadAIInput(event, { initiator, children });
  } else if (isDataLayerEvent(event)) {
    const task = getTaskById(taskId);
    if (task?.templateId) promptType = task.templateId;
    const fullSession = task?.scope === 'session';
    const allEvents = fullSession ? await getAllPanelEvents() : [];
    aiInput = buildDataLayerAIInput(event, allEvents, { fullSession });
  } else {
    aiInput = buildAIInput(event);
  }
  const response = await sendAIRequest({ promptType, data: aiInput });

  const target = resolveAnalyticsTarget(event);
  const trigger = isAuto ? 'auto' : (isRegen ? 'manual_regen' : 'manual');

  if (!response.success) {
    paintError(container, event, localState, response);
    trackEvent('ai_summary', {
      action: 'error',
      task: taskId,
      target,
      trigger,
      platform: event.platform || 'unknown',
      error_type: response.error,
    });
    return;
  }

  const summary = {
    provider: response.provider || null,
    model: response.model || null,
    initialMessages: response.messages || [],
    turns: [{ role: 'assistant', text: response.text || '' }],
    generatedAt: Date.now(),
  };
  event._aiSummaries = event._aiSummaries || {};
  event._aiSummaries[taskId] = summary;
  if (event._aiErrors) delete event._aiErrors[taskId];

  paintTaskView(container, event, localState);

  trackEvent('ai_summary', {
    action: isRegen ? 'regenerated' : 'generated',
    task: taskId,
    target,
    trigger,
    platform: event.platform || 'unknown',
    tokens_in: response.tokensIn,
    tokens_out: response.tokensOut,
    provider: response.provider,
  });
}

/**
 * Send a follow-up message in the current task's thread. The full
 * conversation history (initial messages + every prior turn) is sent
 * each time so the model has continuity.
 */
async function sendFollowup(container, event, localState, userText) {
  const summary = event._aiSummaries?.[localState.activeTaskId];
  if (!summary) return;

  const target = resolveAnalyticsTarget(event);

  // Optimistically append the user turn so it shows up immediately
  summary.turns.push({ role: 'user', text: userText });
  paintLoading(container, event, localState, localState.activeTaskId, 'followup');

  // Build the messages array the SW will forward to the model
  const messages = [
    ...summary.initialMessages,
    ...summary.turns.map((t) => ({ role: t.role, content: t.text })),
  ];

  const response = await sendAIRequest({ messages });

  if (!response.success) {
    // Roll back the optimistic user turn so the user can retry
    summary.turns.pop();
    paintTaskView(container, event, localState);
    // Surface the error inline by re-painting the thread + a notice.
    // Build via DOM rather than textContent so provider-returned URLs
    // in the detail message become clickable (see appendTextWithLinks).
    const notice = document.createElement('div');
    notice.className = 'ai-summary-followup-error';

    const heading = document.createElement('p');
    heading.className = 'ai-summary-error-heading';
    heading.textContent = friendlyErrorHeading(response.error, response.provider);
    notice.appendChild(heading);

    if (response.message) {
      const detail = document.createElement('p');
      detail.className = 'ai-summary-error-detail';
      appendTextWithLinks(detail, response.message);
      notice.appendChild(detail);
    }

    if (PROVIDER_SIDE_ERRORS.has(response.error)) {
      const label = providerLabel(response.provider) || 'the AI provider';
      const clarifier = document.createElement('p');
      clarifier.className = 'ai-summary-error-clarifier';
      clarifier.textContent = `This message comes from ${label}, not Event Watcher.`;
      notice.appendChild(clarifier);
    }

    container.appendChild(notice);
    trackEvent('ai_summary', {
      action: 'followup_error',
      task: localState.activeTaskId,
      target,
      platform: event.platform || 'unknown',
      error_type: response.error,
    });
    return;
  }

  summary.turns.push({ role: 'assistant', text: response.text || '' });
  // Keep the most recent provider/model in case the user switched providers
  summary.provider = response.provider || summary.provider;
  summary.model = response.model || summary.model;
  paintTaskView(container, event, localState);

  trackEvent('ai_summary', {
    action: 'followup',
    task: localState.activeTaskId,
    target,
    platform: event.platform || 'unknown',
    turn_count: summary.turns.length,
    tokens_in: response.tokensIn,
    tokens_out: response.tokensOut,
    provider: response.provider,
  });
}

/**
 * Spawn (or replace) the `ask_custom` thread with a free-form question
 * from the "Ask anything…" input. Renders the user turn immediately so
 * the submit feels instant, then streams the AI reply into the same
 * thread. Any existing `ask_custom` thread is discarded — single-slot
 * cache, by design.
 */
async function runCustomAsk(container, event, localState, userText) {
  const taskId = TASK_ASK_CUSTOM.id;
  localState.activeTaskId = taskId;

  // Seed the thread with the user's question first so the switcher chip
  // has something to reference, and so the spinner screen feels grounded.
  const seedSummary = {
    provider: null,
    model: null,
    initialMessages: [],
    turns: [{ role: 'user', text: userText }],
    generatedAt: Date.now(),
  };
  event._aiSummaries = event._aiSummaries || {};
  event._aiSummaries[taskId] = seedSummary;

  paintLoading(container, event, localState, taskId, 'initial');

  // Route template + input builder per event class:
  //   - DataLayer pushes → dataLayer-specific payload + prompt
  //   - Script loads     → script-load payload (with initiator chain +
  //                        children) + the generic event prompt
  //   - Known / unknown  → generic event payload + generic prompt
  // We reuse `ask_event_custom` for script loads rather than adding a
  // fifth template — the system frame is generic enough to handle the
  // script-load payload shape, and this keeps the template matrix small.
  const isDL = isDataLayerEvent(event);
  const isSL = isScriptLoadEvent(event);
  const target = resolveAnalyticsTarget(event);
  const promptType = isDL ? 'ask_datalayer_custom' : 'ask_event_custom';
  let baseInput;
  if (isDL) {
    baseInput = buildDataLayerAIInput(event, [], { fullSession: false });
  } else if (isSL) {
    const { initiator, children } = await getScriptChainContext(event);
    baseInput = buildScriptLoadAIInput(event, { initiator, children });
  } else {
    baseInput = buildAIInput(event);
  }
  const aiInput = { ...baseInput, question: userText };
  const response = await sendAIRequest({ promptType, data: aiInput });

  if (!response.success) {
    // Drop the seeded thread on error so the user isn't left with a
    // dangling question with no answer. Surface the error view.
    delete event._aiSummaries[taskId];
    paintError(container, event, localState, response);
    trackEvent('ai_summary', {
      action: 'error',
      task: taskId,
      target,
      platform: event.platform || 'unknown',
      error_type: response.error,
    });
    return;
  }

  // Populate the full thread now that we have the reply. The assistant
  // turn comes AFTER the seeded user turn so the conversation reads
  // naturally top-to-bottom.
  seedSummary.provider = response.provider || null;
  seedSummary.model = response.model || null;
  seedSummary.initialMessages = response.messages || [];
  seedSummary.turns = [
    { role: 'user', text: userText },
    { role: 'assistant', text: response.text || '' },
  ];

  paintTaskView(container, event, localState);

  trackEvent('ai_summary', {
    action: 'generated',
    task: taskId,
    target,
    platform: event.platform || 'unknown',
    question_length: bucketQuestionLength(userText),
    tokens_in: response.tokensIn,
    tokens_out: response.tokensOut,
    provider: response.provider,
  });
}

/**
 * Three-way classifier for the `target` analytics property on
 * `ai_summary` events. Script-load gets its own bucket so dashboards
 * can segment it from the generic "event" bucket without inferring
 * from the task id.
 */
function resolveAnalyticsTarget(event) {
  if (isScriptLoadEvent(event)) return 'script_load';
  if (isDataLayerEvent(event)) return 'datalayer';
  return 'event';
}

function bucketQuestionLength(text) {
  const len = (text || '').length;
  if (len <= 40) return 'short';
  if (len <= 160) return 'medium';
  return 'long';
}

/**
 * Thin wrapper around `chrome.runtime.sendMessage` for AI_REQUEST.
 * Always returns a normalised result with `success`, `error`, etc.
 */
async function sendAIRequest(payload) {
  let response;
  try {
    response = await chrome.runtime.sendMessage({ type: MSG.AI_REQUEST, ...payload });
  } catch (err) {
    return { success: false, error: 'extension', message: err?.message || 'Extension error' };
  }
  if (!response) return { success: false, error: 'unknown', message: 'No response from service worker.' };
  if (!response.success) {
    return { success: false, error: response.error || 'unknown', message: response.message || 'Unknown error.' };
  }
  return {
    success: true,
    text: response.text || '',
    messages: response.messages || [],
    provider: response.provider || null,
    model: response.model || null,
    tokensIn: response.tokensIn,
    tokensOut: response.tokensOut,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function isAIConfigured() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local?.get) return false;
  try {
    const { ai_config: aiConfig } = await chrome.storage.local.get('ai_config');
    if (!aiConfig?.activeProvider || !aiConfig.consentGiven) return false;
    const providerConfig = aiConfig.providers?.[aiConfig.activeProvider];
    return !!providerConfig?.apiKey;
  } catch {
    return false;
  }
}

/**
 * True when the user has explicitly opted into an automatic AI action
 * via AI Provider → Automatic actions. Used by the auto-run path to
 * kick off the identify_platform task on section mount without a click.
 * Also guards on the global "Show AI features" body class and on the
 * provider being configured, so a stale toggle never spends tokens
 * when the user has since disabled AI.
 */
/**
 * Parse the structured markdown reply produced by the
 * `identify_platform` prompt. The template asks for an exact
 * five-field format:
 *
 *   **Likely platform:** <vendor>
 *   **Confidence:** <high|medium|low>
 *   **Reasoning:** <1–3 sentences>
 *   **First-party proxy:** <yes|no|unclear> — <clause>
 *   **Next step:** <actionable line>
 *
 * Returns `{ platform, confidence, reasoning, firstPartyProxy, nextStep }`
 * with fields set to `null` when the model deviated from the format.
 *
 * @param {string} text - Raw assistant reply
 * @returns {{platform: string|null, confidence: string|null, reasoning: string|null, firstPartyProxy: string|null, nextStep: string|null}}
 */
export function parseIdentifyPlatformResponse(text) {
  const out = {
    platform: null,
    confidence: null,
    reasoning: null,
    firstPartyProxy: null,
    nextStep: null,
  };
  if (!text || typeof text !== 'string') return out;

  // Each field: `**Label:** value` on its own line (possibly followed
  // by wrapped continuation lines until the next bold label or a blank
  // line). We grab up to the next `**` label or EOL for the single-
  // line fields, and everything up to the next label for Reasoning.
  const grab = (label, { multiline = false } = {}) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = multiline
      ? new RegExp(`\\*\\*${escaped}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*|$)`, 'i')
      : new RegExp(`\\*\\*${escaped}:\\*\\*\\s*(.+?)(?:\\n|$)`, 'i');
    const match = text.match(pattern);
    return match ? match[1].trim() : null;
  };

  out.platform = grab('Likely platform');
  out.confidence = grab('Confidence')?.toLowerCase() || null;
  out.reasoning = grab('Reasoning', { multiline: true });
  out.firstPartyProxy = grab('First-party proxy');
  out.nextStep = grab('Next step');

  // "Unknown" is a valid AI answer meaning "I don't know" — don't
  // surface it as a tool name in the report form.
  if (out.platform && /^unknown$/i.test(out.platform.replace(/[.*_`]/g, '').trim())) {
    out.platform = null;
  }

  return out;
}

/**
 * Best-effort mapping from the AI's free-text reasoning (+ the
 * identified platform name) to a category dropdown value on the
 * Missing Tool form. First match wins; order is intentional —
 * narrower / more specific categories are checked before the broad
 * `analytics` / `advertising` buckets.
 *
 * Returns `null` when nothing matches so the dropdown stays on its
 * placeholder and the user has to pick.
 *
 * @param {string} haystack - Usually `platform + ' ' + reasoning`
 * @returns {string|null}
 */
export function inferCategoryFromReasoning(haystack) {
  if (!haystack || typeof haystack !== 'string') return null;
  const text = haystack.toLowerCase();

  const rules = [
    // More specific buckets first — many analytics vendors also
    // mention "analytics" in their description, so we want to match
    // the niche categories first.
    { cat: 'consent', patterns: [/consent/, /\bcmp\b/, /cookie banner/, /usercentrics/, /cookieyes/, /onetrust/, /trustarc/, /cookiebot/] },
    { cat: 'tag-manager', patterns: [/tag manager/, /\bgtm\b/, /tealium/, /adobe launch/, /matomo tag/, /ensighten/] },
    { cat: 'session-replay', patterns: [/session replay/, /heatmap/, /hotjar/, /fullstory/, /clarity/, /mouseflow/, /smartlook/, /logrocket/, /contentsquare/] },
    { cat: 'ab-testing', patterns: [/a\/b test/, /\bab test/, /experiment/, /optimizely/, /\bvwo\b/, /convert\.com/, /personaliz/] },
    { cat: 'cdp', patterns: [/\bcdp\b/, /customer data platform/, /\bsegment\b/, /mparticle/, /rudderstack/, /hightouch/, /census/] },
    { cat: 'marketing-automation', patterns: [/marketing automation/, /hubspot/, /marketo/, /pardot/, /mailchimp/, /braze/, /iterable/, /klaviyo/] },
    { cat: 'ad-tech', patterns: [/ad tech/, /ad exchange/, /ad server/, /\bssp\b/, /\bdsp\b/, /header bidding/, /prebid/] },
    { cat: 'video', patterns: [/\bvideo analytics\b/, /\bvideo tracking\b/, /brightcove/, /jwplayer/, /mux\.com/] },
    { cat: 'monitoring', patterns: [/\bmonitoring\b/, /\bsentry\b/, /\bdatadog\b/, /\bnew relic\b/, /\brollbar\b/, /\bbugsnag\b/, /error tracking/] },
    { cat: 'widgets', patterns: [/\bwidget\b/, /chat widget/, /intercom/, /drift/, /zendesk chat/] },
    { cat: 'data-layer', patterns: [/\bdata ?layer\b/] },
    { cat: 'first-party-collection', patterns: [/first-party/, /\b1p\b/, /\bcname\b/, /\bproxy\b/] },
    // Broad buckets last.
    { cat: 'advertising', patterns: [/advertising/, /\bads\b/, /conversion tracking/, /retargeting/, /\bpixel\b/, /\bfloodlight\b/, /doubleclick/, /google ads/, /facebook ads/, /meta ads/, /linkedin insight/, /tiktok pixel/, /snapchat pixel/] },
    { cat: 'analytics', patterns: [/analytics/, /measurement/, /\bga4\b/, /google analytics/, /adobe analytics/, /\bamplitude\b/, /mixpanel/, /posthog/, /matomo/, /plausible/, /\bfathom\b/] },
  ];

  for (const { cat, patterns } of rules) {
    if (patterns.some((re) => re.test(text))) return cat;
  }
  return null;
}

/**
 * Lazy-load panel.js's Custom Endpoints opener and call it. Lazy because
 * eager-importing panel.js would drag the whole panel coordinator into
 * this module's init path (which in turn breaks the unit tests, which
 * import this file directly to exercise `buildAIInput`).
 */
async function openCustomEndpointFormFromAI(event) {
  try {
    const mod = await import('../panel.js');
    try {
      const url = new URL(event.raw?.url || event.url || '');
      mod.openToolsModalForCustomEndpoint({ domain: url.hostname, path: url.pathname });
    } catch {
      mod.openToolsModalForCustomEndpoint({});
    }
  } catch (err) {
    console.error('[AI Summary] Failed to open Custom Endpoints form:', err);
  }
}

/**
 * Open the Missing Tool report modal, pre-filled with everything we
 * can infer from the AI Identification reply + the event itself.
 * Lazy-imports panel.js for the same reason `openCustomEndpointFormFromAI`
 * does — keeps this module import-safe from the test harness.
 */
async function openReportMissingToolFromAI(event, summary) {
  try {
    const aiText = summary?.turns?.[0]?.text || '';
    const parsed = parseIdentifyPlatformResponse(aiText);
    const category = inferCategoryFromReasoning(
      [parsed.platform, parsed.reasoning].filter(Boolean).join(' '),
    );

    let website = '';
    let endpoint = '';
    try {
      const url = new URL(event?.raw?.url || event?.url || '');
      website = url.origin;
      endpoint = url.hostname + url.pathname;
    } catch {
      // URL parsing failed — leave the fields empty, user can fill manually.
    }

    // Comment layout: empty "User comment" section first (so the
    // cursor-ready space is visible above the fold), then the AI
    // Identification block. No Method / Event name / Page lines —
    // those duplicate the Endpoint field and add noise.
    const commentLines = ['--- User comment ---', '', ''];
    if (parsed.platform || parsed.confidence || parsed.reasoning || parsed.firstPartyProxy) {
      commentLines.push('--- AI Identification ---');
      if (parsed.platform) commentLines.push(`Likely platform: ${parsed.platform}`);
      if (parsed.confidence) commentLines.push(`Confidence: ${parsed.confidence}`);
      if (parsed.firstPartyProxy) commentLines.push(`First-party proxy: ${parsed.firstPartyProxy}`);
      if (parsed.reasoning) {
        commentLines.push('');
        commentLines.push(`Reasoning: ${parsed.reasoning}`);
      }
    }

    const mod = await import('../panel.js');
    mod.openReportMissingToolModal({
      tool: parsed.platform || '',
      category: category || '',
      website,
      endpoint,
      comment: commentLines.join('\n'),
      source: 'ai_identify',
      // Tall textarea — the prefilled AI block is ~10 lines and we
      // want the empty User-comment region visible above the fold so
      // the user sees "there's room to add your own note here" at a
      // glance.
      commentRows: 14,
    });
  } catch (err) {
    console.error('[AI Summary] Failed to open Report Missing Tool form:', err);
  }
}

async function isAutoActionEnabled(key) {
  if (typeof chrome === 'undefined' || !chrome.storage?.local?.get) return false;
  if (typeof document !== 'undefined' && document.body?.classList.contains('ai-features-disabled')) {
    return false;
  }
  if (!(await isAIConfigured())) return false;
  try {
    const { ai_config: aiConfig } = await chrome.storage.local.get('ai_config');
    return !!aiConfig?.autoActions?.[key];
  } catch {
    return false;
  }
}

/**
 * Build the payload sent to every AI task template.
 *
 * Includes parsed payload + raw request context (URL, status, page,
 * consent-at-fire) so the model can produce a useful summary. PII
 * redaction (`redactPii: true` on each template) runs before the data
 * leaves the service worker, so leaked emails / phones / cards / tokens
 * inside params get stripped automatically.
 *
 * Excluded: cookies, request/response headers beyond status, raw HTML,
 * full document content, browsing history.
 */
export function buildAIInput(event) {
  const formatted = event.formatted || {};
  return {
    platform: event.platform || null,
    platformName: event.platformName || null,
    eventName: event.eventName || null,
    category: event.category || null,
    formatted: trimFormatted(formatted),
    url: event.url || null,
    method: event.method || null,
    status: event.status ?? null,
    initiator: event.initiator || null,
    timestamp: event.timestamp || null,
    pageUrl: event.pageUrl || null,
    pageTitle: event.pageTitle || null,
    responseBody: event.responseBody || null,
    consentAtFire: event.consentAtFire || null,
  };
}

/**
 * Build the payload sent to dataLayer-specific AI tasks. Distinct from
 * `buildAIInput` because a dataLayer push doesn't have URL / method /
 * status / initiator fields — it has pushIndex, pushSource, pushData,
 * and (optionally) a dataLayerState snapshot captured at push time.
 *
 * @param {Object} event - the selected dataLayer event
 * @param {Array<Object>} [allEvents=[]] - every captured event (used
 *   only when `fullSession` is true) — caller passes an empty array to
 *   avoid loading panel state for single-scope tasks.
 * @param {Object} [options]
 * @param {boolean} [options.fullSession=false] - when true, include a
 *   trimmed `sessionPushes` array with every dataLayer push captured in
 *   the session, so the model can reason about consistency across them.
 * @returns {Object} AI input payload
 */
export function buildDataLayerAIInput(event, allEvents = [], options = {}) {
  const { fullSession = false } = options;
  const formatted = event?.formatted || {};

  const payload = {
    eventName: event?.eventName || formatted.event || null,
    pushIndex: formatted.pushIndex ?? null,
    pushSource: formatted.pushSource || null,
    pushSourceUrl: formatted.pushSourceUrl || null,
    isGTMInternalEvent: !!formatted.isGTMInternalEvent,
    pushData: trimPushData(formatted.pushData),
    dataLayerState: trimDataLayerState(formatted.dataLayerState),
    pageUrl: event?.pageUrl || null,
    pageTitle: event?.pageTitle || null,
    googleConsentMode: formatted.googleConsentMode || null,
    gtagSetCommand: formatted.gtagSetCommand || null,
  };

  if (fullSession && Array.isArray(allEvents)) {
    payload.sessionPushes = buildSessionPushes(allEvents, event);
  }

  return payload;
}

// Hard cap on how many events inside a single page we include in the
// page-scope AI input. Matches MAX_SESSION_PUSHES — keeps token cost
// predictable even for very long pages (e.g. a dashboard with 100+
// dataLayer pushes). 50 events is enough to reason about ordering,
// gaps, and consent flow without overwhelming the context budget.
const MAX_PAGE_EVENTS = 50;

/**
 * Build the payload sent to page-scope AI tasks. The page event itself
 * becomes the anchor ("navigation"), and every event belonging to that
 * page (as grouped by the panel's `getPageEvents`) is included as a
 * trimmed summary. Consent and platform metadata are carried through so
 * the page-scope presets can reason about tracking completeness and
 * consent violations without a second round-trip.
 *
 * @param {Object} pageEvent - the navigation/page event itself
 * @param {Array<Object>} pageEvents - events captured between this page
 *   event and the next (already resolved by the caller)
 * @returns {Object} AI input payload
 */
export function buildPageAIInput(pageEvent, pageEvents = []) {
  const raw = pageEvent?.raw || {};
  const navigation = {
    pageUrl: pageEvent?.pageUrl || raw.url || null,
    pageTitle: pageEvent?.pageTitle || null,
    path: pageEvent?.eventName || null,
    type: raw.isInitial ? 'hard_navigation' : 'soft_navigation',
    loadDurationMs: raw.loadDurationMs ?? null,
    timestamp: pageEvent?.timestamp || null,
    consentAtFire: pageEvent?.consentAtFire || null,
  };

  const safeEvents = Array.isArray(pageEvents) ? pageEvents : [];
  // Most-recent-wins when the page carries more events than the cap —
  // the events leading up to the end of the page are usually the most
  // informative for "find gaps" / "QA tracking" style prompts.
  const startIdx = Math.max(0, safeEvents.length - MAX_PAGE_EVENTS);
  const windowed = safeEvents.slice(startIdx);
  const truncatedCount = safeEvents.length - windowed.length;

  const events = windowed.map((e, idx) => {
    const f = e?.formatted || {};
    return {
      index: startIdx + idx,
      platform: e?.platform || null,
      platformName: e?.platformName || null,
      category: e?.category || null,
      eventName: e?.eventName || f.event || null,
      method: e?.method || null,
      status: e?.status ?? null,
      isScriptLoad: !!e?.isScriptLoad,
      isDataLayerPush: ['datalayer', 'gtm', 'gtag'].includes(e?.platform),
      timestamp: e?.timestamp || null,
      consentAtFire: e?.consentAtFire || null,
      // Keep just the high-signal bits of `formatted` so the prompt
      // can reason about the event without blowing the token budget
      // with every parser section.
      summary: {
        event: f.event || null,
        params: trimFormatted(f)?.params || null,
        pushSource: f.pushSource || null,
        pushIndex: f.pushIndex ?? null,
      },
    };
  });

  return {
    navigation,
    events,
    eventCount: safeEvents.length,
    truncatedCount,
  };
}

/**
 * Trim a single push payload to at most MAX_PARAM_KEYS top-level keys.
 * Arrays are preserved up to the same cap. Leaves primitives and nulls
 * alone. Does not recurse into nested objects — per-push cap only.
 */
function trimPushData(pushData) {
  if (pushData == null) return pushData;
  if (Array.isArray(pushData)) {
    if (pushData.length <= MAX_PARAM_KEYS) return pushData;
    return [
      ...pushData.slice(0, MAX_PARAM_KEYS),
      `… and ${pushData.length - MAX_PARAM_KEYS} more items`,
    ];
  }
  if (typeof pushData !== 'object') return pushData;
  const keys = Object.keys(pushData);
  if (keys.length <= MAX_PARAM_KEYS) return pushData;
  const trimmed = {};
  for (let i = 0; i < MAX_PARAM_KEYS; i++) {
    trimmed[keys[i]] = pushData[keys[i]];
  }
  trimmed.__truncated__ = `… and ${keys.length - MAX_PARAM_KEYS} more keys`;
  return trimmed;
}

/**
 * dataLayerState snapshots can grow unbounded over the life of a page —
 * cap to MAX_PARAM_KEYS top-level keys so we don't blow the prompt
 * budget on stale accumulated state.
 */
function trimDataLayerState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return state;
  const keys = Object.keys(state);
  if (keys.length <= MAX_PARAM_KEYS) return state;
  const trimmed = {};
  for (let i = 0; i < MAX_PARAM_KEYS; i++) {
    trimmed[keys[i]] = state[keys[i]];
  }
  trimmed.__truncated__ = `… and ${keys.length - MAX_PARAM_KEYS} more keys`;
  return trimmed;
}

// Hard cap on how many dataLayer pushes we include in `sessionPushes`.
// Keeps token cost predictable on long capture sessions.
const MAX_SESSION_PUSHES = 50;

/**
 * Collect a trimmed array of every dataLayer push captured in the
 * session. Most-recent-wins — if the session has more than
 * `MAX_SESSION_PUSHES`, we keep the 50 pushes leading up to (and
 * including) the selected one, which is what "quality across recent
 * pushes" analysis actually needs.
 */
function buildSessionPushes(allEvents, selectedEvent) {
  const dlEvents = allEvents.filter(
    (e) => e && ['datalayer', 'gtm', 'gtag'].includes(e.platform),
  );

  // Anchor the window on the selected event so its context is always
  // included, even on very long sessions.
  let startIdx = 0;
  if (dlEvents.length > MAX_SESSION_PUSHES) {
    const selectedIdx = dlEvents.findIndex((e) => e === selectedEvent || e.id === selectedEvent?.id);
    const anchor = selectedIdx >= 0 ? selectedIdx : dlEvents.length - 1;
    startIdx = Math.max(0, anchor - MAX_SESSION_PUSHES + 1);
  }
  const windowEvents = dlEvents.slice(startIdx, startIdx + MAX_SESSION_PUSHES);

  return windowEvents.map((e) => {
    const f = e.formatted || {};
    return {
      pushIndex: f.pushIndex ?? null,
      eventName: e.eventName || f.event || null,
      pushSource: f.pushSource || null,
      isGTMInternalEvent: !!f.isGTMInternalEvent,
      pushData: trimPushData(f.pushData),
      isSelected: e === selectedEvent || e.id === selectedEvent?.id,
    };
  });
}

/**
 * Build the payload sent to script-load AI tasks. Script-load events
 * have no URL parameters / parsed payload to reason about — the
 * interesting context is the initiator chain (what loaded this) and
 * the children (what this script loaded in turn). Both are pulled
 * from the panel's script maps and passed in by the caller so this
 * module stays testable without the panel graph.
 *
 * @param {Object} event - the script-load event
 * @param {Object} [context]
 * @param {Object|null} [context.initiator] - immediate parent info
 *   `{ type, url, platform, platformName }` — may be null for
 *   first-party / root-level scripts.
 * @param {Array<Object>} [context.children] - direct child script
 *   summaries `[{ url, platform, platformName }]`.
 * @returns {Object} AI input payload
 */
export function buildScriptLoadAIInput(event, context = {}) {
  const formatted = event?.formatted || {};
  const raw = event?.raw || {};
  const scriptUrl = formatted.scriptUrl || raw.url || event?.url || null;
  const initiatorType = formatted.initiatorType || raw.initiatorType || null;
  const initiatorUrl = formatted.initiatorUrl || raw.initiatorUrl || null;

  const payload = {
    scriptUrl,
    platform: event?.platform || null,
    platformName: event?.platformName || null,
    initiator: context.initiator || (initiatorUrl || initiatorType
      ? { type: initiatorType, url: initiatorUrl, platform: null, platformName: null }
      : null),
    children: Array.isArray(context.children) ? context.children : [],
    statusCode: raw.statusCode ?? event?.status ?? null,
    responseSize: raw.responseSize ?? null,
    duration: raw.duration ?? null,
    containerId: formatted.containerId || null,
    measurementId: formatted.measurementId || null,
    dataLayerName: formatted.dataLayerName || null,
    tealiumTagUid: formatted.tealiumTagUid || null,
    pageUrl: event?.pageUrl || null,
    pageTitle: event?.pageTitle || null,
    consentAtFire: event?.consentAtFire || null,
  };

  return payload;
}

// Hard cap on how many tag-by-event groups we forward to the container
// prompts. A busy container can have 40+ distinct event names; most
// container-level analysis needs only the top activity, and trimming
// keeps the token budget predictable.
const MAX_CONTAINER_EVENT_GROUPS = 30;

/**
 * Build the payload sent to GTM Container AI tasks. Builds on
 * `buildScriptLoadAIInput` (same script-chain context) but adds the
 * parsed container structure — tagCount, macroCount (variables),
 * predicateCount (triggers), pausedCount, and the tags-by-event
 * breakdown from `parseGTMContainerResponse`. This is the meat of the
 * prompt: without `containerData` the container preset set wouldn't
 * beat the generic script-load templates.
 *
 * @param {Object} event - GTM script-load event with `formatted.containerData`
 * @param {Object} [context]
 * @param {Object|null} [context.initiator] - parent summary (same shape as script-load)
 * @param {Array<Object>} [context.children] - child-script summaries
 * @returns {Object} AI input payload
 */
export function buildGTMContainerAIInput(event, context = {}) {
  const formatted = event?.formatted || {};
  const raw = event?.raw || {};
  const containerData = formatted.containerData || {};
  const scriptUrl = formatted.scriptUrl || raw.url || event?.url || null;

  // Trim tagsByEvent to the top N groups by total tag count. The parser
  // sorts alphabetically for the UI — re-sort here so the model sees
  // the busiest events first when the list is capped.
  const allGroups = Array.isArray(containerData.tagsByEvent) ? containerData.tagsByEvent : [];
  const sorted = [...allGroups].sort((a, b) => (b?.total || 0) - (a?.total || 0));
  const windowed = sorted.slice(0, MAX_CONTAINER_EVENT_GROUPS);
  const truncatedGroups = Math.max(0, allGroups.length - windowed.length);

  return {
    scriptUrl,
    containerId: formatted.containerId || null,
    version: containerData.version || null,
    dataLayerName: formatted.dataLayerName || null,
    container: {
      tagCount: containerData.tagCount ?? null,
      // Surface GTM-UI-familiar names alongside the parser field names so
      // the model doesn't have to guess: macros = Variables, predicates
      // = Triggers.
      variableCount: containerData.macroCount ?? null,
      triggerCount: containerData.predicateCount ?? null,
      pausedCount: containerData.pausedCount ?? null,
      eventGroups: windowed,
      truncatedEventGroups: truncatedGroups,
    },
    initiator: context.initiator || null,
    children: Array.isArray(context.children) ? context.children : [],
    statusCode: raw.statusCode ?? event?.status ?? null,
    responseSize: raw.responseSize ?? null,
    duration: raw.duration ?? null,
    pageUrl: event?.pageUrl || null,
    pageTitle: event?.pageTitle || null,
    consentAtFire: event?.consentAtFire || null,
  };
}

// Hard cap on how many child scripts we include — a GTM container can
// load 30+ tags; trimming keeps the prompt budget predictable.
const MAX_SCRIPT_CHILDREN = 20;

/**
 * Read the initiator (immediate parent) and child-script summaries for
 * a given script-load event from the panel's script maps. Lazy-imports
 * `../panel.js` so the test harness can import this module without the
 * full panel graph. Returns `{ initiator: null, children: [] }` when
 * the panel module isn't available (tests, isolated runs).
 */
async function getScriptChainContext(event) {
  const fallback = { initiator: null, children: [] };
  try {
    const mod = await import('../panel.js');
    const formatted = event?.formatted || {};
    const raw = event?.raw || {};
    const scriptUrl = formatted.scriptUrl || raw.url || null;
    const initiatorUrl = formatted.initiatorUrl || raw.initiatorUrl || null;
    const initiatorType = formatted.initiatorType || raw.initiatorType || null;

    let initiator = null;
    if (initiatorUrl || initiatorType) {
      const platformInfo = typeof mod.getInitiatorPlatformInfo === 'function'
        ? mod.getInitiatorPlatformInfo(initiatorUrl)
        : null;
      initiator = {
        type: initiatorType,
        url: initiatorUrl,
        platform: platformInfo?.platform || null,
        platformName: platformInfo?.name || null,
      };
    }

    let children = [];
    if (scriptUrl && typeof mod.getScriptsLoadedBy === 'function') {
      const kids = mod.getScriptsLoadedBy(scriptUrl) || [];
      children = kids.slice(0, MAX_SCRIPT_CHILDREN).map((child) => ({
        url: child?.formatted?.scriptUrl || child?.raw?.url || null,
        platform: child?.platform || null,
        platformName: child?.platformName || null,
      }));
      if (kids.length > MAX_SCRIPT_CHILDREN) {
        children.push({ __truncated__: `… and ${kids.length - MAX_SCRIPT_CHILDREN} more children` });
      }
    }

    return { initiator, children };
  } catch {
    return fallback;
  }
}

/**
 * Lazy-load the panel coordinator's captured events array. Same lazy-
 * import pattern used by `openCustomEndpointFormFromAI` — keeps this
 * module import-safe from Node test runners that stub `chrome.*`.
 * Returns [] if anything goes wrong so callers can always proceed.
 */
async function getAllPanelEvents() {
  try {
    const mod = await import('../panel.js');
    if (typeof mod.getCapturedEvents === 'function') return mod.getCapturedEvents() || [];
    return [];
  } catch {
    return [];
  }
}

/**
 * Resolve the events that belong to a given page event. Delegates to
 * the panel coordinator's `getPageEvents()` so the grouping logic stays
 * in one place (same rules used by the stream's Page view). Returns []
 * if the panel module can't be loaded (test runners) or the page id is
 * unknown — the builder handles an empty list gracefully.
 */
async function getPageScopedEvents(pageEvent) {
  if (!pageEvent?.id) return [];
  try {
    const mod = await import('../panel.js');
    if (typeof mod.getPageEvents === 'function') {
      const res = mod.getPageEvents(pageEvent.id);
      return Array.isArray(res?.events) ? res.events : [];
    }
    return [];
  } catch {
    return [];
  }
}

function trimFormatted(formatted) {
  if (!formatted || typeof formatted !== 'object') return formatted;
  const params = formatted.params;
  if (!params || typeof params !== 'object' || Array.isArray(params)) return formatted;
  const keys = Object.keys(params);
  if (keys.length <= MAX_PARAM_KEYS) return formatted;

  const trimmed = {};
  for (let i = 0; i < MAX_PARAM_KEYS; i++) {
    trimmed[keys[i]] = params[keys[i]];
  }
  trimmed['__truncated__'] = `… and ${keys.length - MAX_PARAM_KEYS} more parameters`;
  return { ...formatted, params: trimmed };
}

const PROVIDER_LABELS = {
  gemini: 'Gemini',
  google: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  claude: 'Anthropic',
};

function providerLabel(providerId) {
  if (!providerId) return null;
  const id = String(providerId).toLowerCase();
  if (PROVIDER_LABELS[id]) return PROVIDER_LABELS[id];
  return id.charAt(0).toUpperCase() + id.slice(1);
}

// Errors that clearly originate from the AI provider's API (as opposed
// to local config, network, or bugs in Event Watcher itself). Used to
// decide when to prefix headings with the provider name and when to
// show the "not an Event Watcher issue" clarifier line.
const PROVIDER_SIDE_ERRORS = new Set([
  'rate_limited',
  'invalid_key',
  'server_error',
  'quota_exceeded',
  'context_too_large',
]);

// Errors where the provider may well recover on its own — so a cached
// error entry is treated as stale after a grace window, allowing
// auto-identify to retry without the user having to click.
const TRANSIENT_ERRORS = new Set(['rate_limited', 'server_error', 'timeout']);
const TRANSIENT_ERROR_TTL_MS = 60_000;

function isStaleCachedError(entry) {
  if (!entry || typeof entry !== 'object') return true;
  if (!TRANSIENT_ERRORS.has(entry.error)) return false;
  if (typeof entry.cachedAt !== 'number') return true;
  return Date.now() - entry.cachedAt > TRANSIENT_ERROR_TTL_MS;
}

/**
 * Pick which task's cached error to re-hydrate on paint. Preference
 * order: the task the user is currently looking at (localState), then
 * the most recently cached error. Returns null if no non-stale error
 * is cached — caller then proceeds to the normal paint paths.
 */
function pickErrorTaskId(event, localState) {
  const errors = event._aiErrors;
  if (!errors) return null;

  const active = localState.activeTaskId;
  if (active && errors[active] && !isStaleCachedError(errors[active])) {
    return active;
  }

  let bestId = null;
  let bestAt = -Infinity;
  for (const [taskId, entry] of Object.entries(errors)) {
    if (isStaleCachedError(entry)) continue;
    const at = typeof entry.cachedAt === 'number' ? entry.cachedAt : 0;
    if (at > bestAt) {
      bestAt = at;
      bestId = taskId;
    }
  }
  return bestId;
}

function friendlyErrorHeading(errorType, providerId) {
  const label = providerLabel(providerId);
  switch (errorType) {
    case 'no_provider': return 'No AI provider configured.';
    case 'no_consent': return 'AI data-use consent not yet accepted.';
    case 'invalid_key': return label
      ? `${label} rejected the API key you configured.`
      : 'The provider rejected your API key.';
    case 'rate_limited': return label
      ? `${label} rate limit reached — try again in a minute.`
      : 'Rate limited by the provider — try again in a minute.';
    case 'quota_exceeded': return label
      ? `${label} quota exceeded — check your provider plan.`
      : 'Provider quota exceeded — check your plan.';
    case 'context_too_large': return 'This thread is too large for the AI prompt budget.';
    case 'server_error': return label
      ? `${label} is having a bad moment — try again shortly.`
      : 'The AI provider is having a bad moment.';
    case 'network': return 'Network error reaching the AI provider.';
    case 'timeout': return 'The AI provider took too long to respond.';
    case 'unknown_template': return 'Internal error — unknown prompt template.';
    case 'bad_request': return 'Internal error — malformed AI request.';
    case 'extension': return 'Extension messaging error.';
    default: return 'Could not generate response.';
  }
}

// Expose tasks + caps for tests.
export const _AI_TASKS = TASKS_KNOWN;
export const _AI_TASKS_UNKNOWN = TASKS_UNKNOWN;
export const _AI_TASKS_DATALAYER = TASKS_DATALAYER;
export const _AI_TASKS_SCRIPTLOAD = TASKS_SCRIPTLOAD;
export const _AI_TASKS_CONTAINER = TASKS_CONTAINER;
export const _AI_TASKS_PAGE = TASKS_PAGE;
export const _AI_TASK_ASK_CUSTOM = TASK_ASK_CUSTOM;
export const _AI_MAX_FOLLOWUP_TURNS = MAX_FOLLOWUP_TURNS;
export const _AI_MAX_SESSION_PUSHES = MAX_SESSION_PUSHES;
export const _AI_MAX_PAGE_EVENTS = MAX_PAGE_EVENTS;
export const _AI_MAX_CONTAINER_EVENT_GROUPS = MAX_CONTAINER_EVENT_GROUPS;
export const _AI_MAX_SCRIPT_CHILDREN = MAX_SCRIPT_CHILDREN;
export {
  isDataLayerEvent as _isDataLayerEvent,
  isScriptLoadEvent as _isScriptLoadEvent,
  isPageEvent as _isPageEvent,
  isGTMContainerLoad as _isGTMContainerLoad,
  getTasksForEvent as _getTasksForEvent,
};
