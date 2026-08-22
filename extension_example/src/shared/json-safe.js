// Circular-safe JSON.stringify for rendering / exporting captured payloads.
//
// Raw tracking payloads can (rarely) contain circular references — e.g. an
// object that echoes a DOM/window ref back to itself. A bare `JSON.stringify`
// throws on those, which would blank the event-detail pane or abort an export
// (F9, feature #138). This helper never throws: it tries a plain stringify
// first (fast path), falls back to a circular-safe pass that replaces repeated
// object refs with the string "[Circular]", and finally returns a placeholder
// if even that fails (e.g. a BigInt value, which is unserialisable regardless).
//
// Leaf module with no imports — safe to use from any layer (panel, content,
// background) and trivially unit-testable.

/**
 * @param {*} value - value to serialise
 * @param {{ space?: number|string, fallback?: string }} [opts]
 *   space    - passed through to JSON.stringify (pretty-print indent)
 *   fallback - returned when the value cannot be serialised at all
 * @returns {string} a JSON string, a circular-safe JSON string, or the fallback
 */
export function safeStringify(value, opts = {}) {
  const { space, fallback = '{"_error":"unserializable"}' } = opts;
  try {
    return JSON.stringify(value, null, space);
  } catch (_e) {
    // Most likely a circular reference — retry with a seen-set replacer.
    try {
      const seen = new WeakSet();
      return JSON.stringify(value, (key, val) => {
        if (val && typeof val === 'object') {
          if (seen.has(val)) return '[Circular]';
          seen.add(val);
        }
        return val;
      }, space);
    } catch (_e2) {
      // Still unserialisable (e.g. BigInt) — give callers a safe placeholder.
      return fallback;
    }
  }
}
