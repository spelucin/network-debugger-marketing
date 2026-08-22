// DataLayer Input Parser
// Parses user input from the Edit & Push to dataLayer modal.
// Accepts three input shapes so users can paste payloads as-is from logs, docs, or AI chats:
//   1. Strict JSON                         — { "event": "x", "data": { ... } }
//   2. dataLayer.push(...) wrapped calls   — dataLayer.push({ event: "x", ... });
//   3. Relaxed JS object/array literals    — { event: "x", data: { foo: 'bar', }, }
// Returns the parsed object/array. Throws SyntaxError on invalid input.

/**
 * Parse a dataLayer payload string into a JS value.
 * @param {string} input
 * @returns {Object|Array}
 * @throws {SyntaxError}
 */
export function parseDataLayerInput(input) {
  if (typeof input !== 'string') {
    throw new TypeError('Input must be a string');
  }
  const trimmed = input.trim();
  if (!trimmed) {
    throw new SyntaxError('Input is empty');
  }

  const direct = tryParseJSON(trimmed);
  if (direct.ok) return direct.value;

  const unwrapped = stripPushWrapper(trimmed);
  const second = tryParseJSON(unwrapped);
  if (second.ok) return second.value;

  const jsonified = jsLiteralToJson(unwrapped);
  const final = tryParseJSON(jsonified);
  if (final.ok) return final.value;
  throw new SyntaxError(final.error);
}

const PUSH_WRAPPER_RE = /^(?:window\s*\.\s*)?dataLayer\s*\.\s*push\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*$/;

function stripPushWrapper(s) {
  const m = s.match(PUSH_WRAPPER_RE);
  return m ? m[1].trim() : s;
}

function tryParseJSON(s) {
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Walks the input character by character, tracking string state so transformations
// only apply outside strings. Output is then run through JSON.parse by the caller.
function jsLiteralToJson(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let inString = null; // null | '"' | "'"

  const skipNonCode = (start) => {
    let k = start;
    while (k < n) {
      const ck = src[k];
      if (ck === ' ' || ck === '\t' || ck === '\n' || ck === '\r') { k++; continue; }
      if (ck === '/' && src[k + 1] === '/') {
        while (k < n && src[k] !== '\n') k++;
        continue;
      }
      if (ck === '/' && src[k + 1] === '*') {
        k += 2;
        while (k < n - 1 && !(src[k] === '*' && src[k + 1] === '/')) k++;
        if (k < n) k += 2;
        continue;
      }
      break;
    }
    return k;
  };

  while (i < n) {
    const c = src[i];

    if (inString !== null) {
      if (c === '\\' && i + 1 < n) {
        const next = src[i + 1];
        if (inString === "'" && next === "'") { out += "'"; i += 2; continue; }
        if (inString === "'" && next === '"') { out += '\\"'; i += 2; continue; }
        out += '\\' + next;
        i += 2;
        continue;
      }
      if (c === inString) {
        out += '"';
        inString = null;
        i++;
        continue;
      }
      if (inString === "'" && c === '"') {
        out += '\\"';
        i++;
        continue;
      }
      out += c;
      i++;
      continue;
    }

    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n - 1 && !(src[i] === '*' && src[i + 1] === '/')) i++;
      if (i < n) i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      out += '"';
      inString = c;
      i++;
      continue;
    }
    if (c === ',') {
      const k = skipNonCode(i + 1);
      if (k < n && (src[k] === '}' || src[k] === ']')) {
        i++;
        continue;
      }
      out += c;
      i++;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = out.length - 1;
      while (j >= 0 && (out[j] === ' ' || out[j] === '\t' || out[j] === '\n' || out[j] === '\r')) j--;
      const prevChar = j >= 0 ? out[j] : '';
      if (prevChar === '{' || prevChar === ',') {
        const m = src.slice(i).match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*:/);
        if (m) {
          out += '"' + m[1] + '"';
          i += m[1].length;
          continue;
        }
      }
    }

    out += c;
    i++;
  }
  return out;
}
