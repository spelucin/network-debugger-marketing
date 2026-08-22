/**
 * Detection Path stage grouping (#25 Phase A3)
 *
 * Pure helpers that fold the flat ROUTING_STEPS decision path (one entry
 * per routeRequest() check, ~50 rows) into the four stages the Detection
 * Path UI renders: a wall of failed checks collapses to one summary row
 * per stage, while the winning check stays visible with its detail.
 *
 * No DOM, no imports — event-detail.js owns the rendering; this module
 * owns the grouping so it can be unit-tested directly (tests/panel/
 * detection-path-stages.test.mjs).
 *
 * Stage assignment is by step id, mirroring the order of routeRequest()
 * in request-handlers.js: every check before the config-driven registry
 * lookup is a platform-specific check; the three tail checks each form
 * their own single-step stage.
 */

export const PATH_STAGES = {
  platform: {
    label: 'Platform-specific checks',
    failedHint: null // computed from check count by the renderer
  },
  registry: {
    label: 'Platform registry',
    failedHint: 'no URL pattern match'
  },
  custom: {
    label: 'Custom endpoints',
    failedHint: 'none matched'
  },
  generic: {
    label: 'Generic tracking pattern',
    failedHint: 'not tracking-shaped'
  }
};

/**
 * Map a decision-path step id to its stage key.
 * @param {string} stepId - ROUTING_STEPS entry id (or 'fallback')
 * @returns {string|null} Stage key, or null for the synthetic fallback row
 */
export function stageOfStep(stepId) {
  if (stepId === 'known-endpoint') return 'registry';
  if (stepId === 'custom-endpoint') return 'custom';
  if (stepId === 'generic-tracking') return 'generic';
  if (stepId === 'fallback') return null;
  return 'platform';
}

/**
 * Group an evaluated decision path (output of reconstructDecisionPath)
 * into consecutive stage groups.
 *
 * Each group carries:
 *   stage       — stage key (null for the synthetic fallback row)
 *   label       — display label (null for fallback)
 *   steps       — the evaluated steps in this stage, original order
 *   status      — 'matched' | 'failed' | 'skipped'
 *   matchedStep — the winning step, when status is 'matched'
 *
 * Because routeRequest() is first-match-wins, groups after a matched
 * group are always fully 'skipped'.
 *
 * @param {Array} decisionPath - Evaluated steps with status
 * @returns {Array} Stage groups in path order
 */
export function groupDecisionPathByStage(decisionPath) {
  const groups = [];
  let current = null;

  for (const step of decisionPath) {
    const stage = stageOfStep(step.id);
    if (!current || current.stage !== stage) {
      current = {
        stage,
        label: stage ? PATH_STAGES[stage].label : null,
        steps: [],
        status: 'failed',
        matchedStep: null
      };
      groups.push(current);
    }
    current.steps.push(step);
  }

  for (const group of groups) {
    group.matchedStep = group.steps.find(s => s.status === 'matched') || null;
    if (group.matchedStep) {
      group.status = 'matched';
    } else if (group.steps.every(s => s.status === 'skipped')) {
      group.status = 'skipped';
    } else {
      group.status = 'failed';
    }
  }

  return groups;
}
