// @ts-check
// walkerOS event-envelope detection (BUG56)
//
// walkerOS (elbwalker) is a self-hosted client-side tag manager. Its dataLayer
// destination writes the canonical walkerOS event object into window.dataLayer, so
// on real deployments walkerOS events arrive through the ordinary dataLayer push
// path rather than via direct window.elb() calls (verified live on mitgas.de and
// casamoda.com 2026-06-06 — both emit exclusively via the dataLayer destination).
//
// This module recognises that envelope so the dataLayer handler can re-attribute
// the push from the generic `datalayer` tool to `walkeros` (category tag-manager)
// instead of leaving walkerOS invisible.
//
// Discriminator: the walkerOS event shape — entity + action + trigger (the core
// triplet) together with id + a timing field + the nested array (corroborators).
// Plain GTM/GA4 pushes use `event` / `ecommerce` and never carry
// entity+action+trigger+nested together, so this AND-combination does not collide
// with non-walkerOS dataLayer traffic.

/**
 * Detect whether a dataLayer push is a walkerOS event envelope.
 *
 * @param {*} pushData - the raw object pushed to window.dataLayer
 * @returns {{ name: string }|null} the resolved event name ('entity action',
 *   e.g. "page view"), or null if the push is not a walkerOS envelope.
 */
export function detectWalkerOSEnvelope(pushData) {
  if (!pushData || typeof pushData !== 'object' || Array.isArray(pushData)) return null;

  // Core triplet — all three must be present as strings.
  const hasCore = typeof pushData.entity === 'string'
    && typeof pushData.action === 'string'
    && typeof pushData.trigger === 'string';
  if (!hasCore) return null;

  // Corroborators — the fields every walkerOS event carries that a coincidental
  // {entity, action, trigger} object would not: a stable id, a timing field, and
  // the nested-entities array.
  const hasCorroborators = ('id' in pushData)
    && ('timestamp' in pushData || 'timing' in pushData)
    && Array.isArray(pushData.nested);
  if (!hasCorroborators) return null;

  // walkerOS sets `name` to 'entity action' (e.g. "page view"); fall back to
  // composing it from the triplet if `name` is missing.
  const name = typeof pushData.name === 'string' && pushData.name.trim()
    ? pushData.name.trim()
    : `${pushData.entity} ${pushData.action}`;

  return { name };
}
