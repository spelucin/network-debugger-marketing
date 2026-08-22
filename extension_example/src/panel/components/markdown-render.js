// ============================================================
// Tiny Markdown renderer — safe HTML output for AI responses.
//
// AI providers reply in Markdown by default (** for bold, * for
// bullets, ``` for code blocks, [text](url) for links, etc.).
// Without a renderer those markers print literally in the panel,
// which is what the user reported. This module converts a known
// subset of Markdown into HTML that's safe to insert into the DOM
// via `element.innerHTML`.
//
// Safety contract:
//   1. ALL input HTML is escaped FIRST (`escapeHtml` on every line).
//   2. Markdown patterns are applied to the escaped text, so any
//      `<script>` or `<img onerror>` in the AI output is harmless.
//   3. Link URLs are validated — only http(s) and relative paths
//      pass; `javascript:`, `data:`, and friends are stripped.
//   4. The renderer emits ONLY a closed set of tags: <p>, <h2>,
//      <h3>, <h4>, <strong>, <em>, <code>, <pre>, <ul>, <ol>, <li>,
//      <a>, <br>. No attributes other than `href`/`target`/`rel`
//      on <a>.
//
// Supported syntax (intentionally small):
//   - Headings: `#`, `##`, `###` (mapped to <h2>, <h3>, <h4> so
//     they don't collide with the panel's own <h1>)
//   - Bold: **text** or __text__
//   - Italic: *text* or _text_
//   - Inline code: `text`
//   - Code block: ```\n…\n``` (optional language tag ignored)
//   - Unordered list: lines starting with `-`, `*`, or `+`
//   - Ordered list: lines starting with `1.`, `2.`, etc.
//   - Links: [text](http://…) or [text](/relative)
//   - Paragraphs: blank-line-separated runs of text
//   - Hard break: trailing two spaces or a literal `<br>`
//
// Not supported (won't crash, just won't format):
//   tables, blockquotes, images, autolinks, footnotes, HTML pass-through
// ============================================================

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

/**
 * Render markdown to a safe HTML string.
 * @param {string} markdown
 * @returns {string} safe HTML
 */
export function renderMarkdown(markdown) {
  if (!markdown) return '';
  const text = String(markdown).replace(/\r\n/g, '\n');

  // 1. Pull out fenced code blocks first so their contents are not
  //    touched by inline pattern processing. Replace each with a
  //    placeholder, then re-insert at the end.
  const codeBlocks = [];
  const stripped = text.replace(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g, (_m, _lang, body) => {
    const idx = codeBlocks.push(body) - 1;
    return `\u0000CODEBLOCK${idx}\u0000`;
  });

  // 2. Split into blocks (paragraphs / lists / headings). Blocks are
  //    separated by one or more blank lines.
  const blocks = stripped.split(/\n{2,}/);
  const out = [];

  for (const rawBlock of blocks) {
    const block = rawBlock.replace(/^\n+|\n+$/g, '');
    if (!block) continue;

    // Heading?
    const headingMatch = block.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch && !block.includes('\n')) {
      const level = Math.min(headingMatch[1].length, 4) + 1; // # → h2, ## → h3, ### → h4 (clamped)
      out.push(`<h${Math.min(level, 4)}>${renderInline(headingMatch[2])}</h${Math.min(level, 4)}>`);
      continue;
    }

    // Code-block placeholder?
    const codeBlockMatch = block.match(/^\u0000CODEBLOCK(\d+)\u0000$/);
    if (codeBlockMatch) {
      const body = codeBlocks[Number(codeBlockMatch[1])] || '';
      out.push(`<pre><code>${escapeHtml(body)}</code></pre>`);
      continue;
    }

    // Unordered list — every line starts with a bullet marker
    const lines = block.split('\n');
    if (lines.every((l) => /^\s*[-*+]\s+/.test(l))) {
      const items = lines
        .map((l) => l.replace(/^\s*[-*+]\s+/, ''))
        .map((l) => `<li>${renderInline(l)}</li>`)
        .join('');
      out.push(`<ul>${items}</ul>`);
      continue;
    }

    // Ordered list — every line starts with `<digits>.`
    if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
      const items = lines
        .map((l) => l.replace(/^\s*\d+\.\s+/, ''))
        .map((l) => `<li>${renderInline(l)}</li>`)
        .join('');
      out.push(`<ol>${items}</ol>`);
      continue;
    }

    // Mixed list with continuation lines — best-effort: if first
    // line is a list item, treat as list; continuation lines join
    // the previous item with a <br>
    if (/^\s*[-*+]\s+/.test(lines[0]) || /^\s*\d+\.\s+/.test(lines[0])) {
      const isOrdered = /^\s*\d+\.\s+/.test(lines[0]);
      const items = [];
      for (const line of lines) {
        const m = isOrdered ? line.match(/^\s*\d+\.\s+(.*)$/) : line.match(/^\s*[-*+]\s+(.*)$/);
        if (m) {
          items.push(renderInline(m[1]));
        } else if (items.length > 0) {
          items[items.length - 1] += '<br>' + renderInline(line.trim());
        }
      }
      const tag = isOrdered ? 'ol' : 'ul';
      out.push(`<${tag}>${items.map((i) => `<li>${i}</li>`).join('')}</${tag}>`);
      continue;
    }

    // Plain paragraph — keep single newlines as <br>
    const paraLines = lines.map((l) => renderInline(l)).join('<br>');
    out.push(`<p>${paraLines}</p>`);
  }

  return out.join('\n');
}

// ─── Inline patterns ─────────────────────────────────────────────────────────

/**
 * Apply inline Markdown patterns to a single line of already-escaped
 * text. Order matters: code spans first (their content shouldn't be
 * re-formatted), then links, then bold, then italic.
 */
function renderInline(line) {
  let s = escapeHtml(line);

  // Inline code — `text`. Stash to placeholders so inner content
  // isn't processed by bold/italic regex.
  const codeSpans = [];
  s = s.replace(/`([^`\n]+)`/g, (_m, body) => {
    const idx = codeSpans.push(body) - 1;
    return `\u0000CODE${idx}\u0000`;
  });

  // Links — [text](url). Validate URL before emitting.
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
    const safe = sanitizeUrl(url);
    if (!safe) return label; // drop the link wrapper, keep label text
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  });

  // Bold — **text** or __text__. Match before single-marker italic
  // so we don't consume the inner `*`/`_`.
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_\n]+?)__/g, '<strong>$1</strong>');

  // Italic — *text* or _text_. Avoid eating list bullets by requiring
  // a non-space character right after the opening marker.
  s = s.replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_])_(?!\s)([^_\n]+?)_/g, '$1<em>$2</em>');

  // Restore code spans — body was already escaped at the top of this
  // function, so DO NOT re-escape (would produce `&amp;lt;div&amp;gt;`).
  s = s.replace(/\u0000CODE(\d+)\u0000/g, (_m, n) => `<code>${codeSpans[Number(n)] || ''}</code>`);

  return s;
}

/**
 * Sanitize a URL for use in an <a href>. Returns the original URL
 * (escaped for attribute context) if safe, or null to indicate the
 * link should be dropped.
 *
 * Allowed: http://, https://, mailto:, relative paths starting with
 * `/`, `#`, or `?`.
 * Blocked: javascript:, data:, vbscript:, file:, chrome-extension:,
 * and anything else with an unrecognised scheme.
 */
function sanitizeUrl(url) {
  if (typeof url !== 'string' || !url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Relative URLs are fine
  if (/^[/#?]/.test(trimmed)) return escapeAttr(trimmed);

  // Scheme-bearing URL — only allow http/https/mailto
  const schemeMatch = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!schemeMatch) {
    // No scheme and not relative — treat as relative-ish (e.g. "foo.com")
    return escapeAttr(trimmed);
  }
  const scheme = schemeMatch[1].toLowerCase();
  if (scheme === 'http' || scheme === 'https' || scheme === 'mailto') {
    return escapeAttr(trimmed);
  }
  return null;
}

function escapeAttr(s) {
  return String(s).replace(/[&"'<>]/g, (c) => ESCAPE_MAP[c]);
}

/**
 * Scheme check for URLs that will be assigned via DOM setters
 * (`a.href = …` / `setAttribute`), where the DOM handles its own
 * attribute serialisation. Unlike `sanitizeUrl`, this does NOT
 * pre-escape — double-encoding would corrupt legitimate URLs
 * containing `&` query separators.
 */
function isSafeHttpUrl(url) {
  if (typeof url !== 'string' || !url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  const schemeMatch = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!schemeMatch) return false;
  const scheme = schemeMatch[1].toLowerCase();
  return scheme === 'http' || scheme === 'https' || scheme === 'mailto';
}

// Bare-URL regex for plain text: http/https, greedy up to whitespace or
// common quote/bracket terminators. Trailing sentence punctuation is
// stripped off the match so "… see url.com/foo." doesn't swallow
// the period.
const BARE_URL_RE = /https?:\/\/[^\s<>"')\]}]+/g;
const TRAILING_PUNCT_RE = /[.,;:!?)\]]+$/;

/**
 * Append plain text to a DOM parent, auto-linkifying bare http(s) URLs.
 * Builds only text nodes and <a> elements — no HTML string synthesis,
 * no innerHTML. Safe even for fully-attacker-controlled input because
 * every span is set via textContent.
 *
 * Newline handling: `\n\n` starts a new <p> sibling, single `\n`
 * inserts a <br> within the current <p>.
 *
 * @param {Element} parent - element to append into
 * @param {string} text - plain text (may contain URLs and newlines)
 * @param {Document} [doc] - document to create nodes with (default: parent's ownerDocument)
 * @returns {Element} the parent (chainable)
 */
export function appendTextWithLinks(parent, text, doc) {
  if (!parent) return parent;
  const d = doc || parent.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!d) return parent;

  const source = String(text ?? '').replace(/\r\n/g, '\n');
  if (!source) return parent;

  const paragraphs = source.split(/\n{2,}/);
  const multiPara = paragraphs.length > 1;

  for (const para of paragraphs) {
    if (!para) continue;
    const target = multiPara ? d.createElement('p') : parent;

    const lines = para.split('\n');
    lines.forEach((line, idx) => {
      if (idx > 0) target.appendChild(d.createElement('br'));
      appendLineWithLinks(target, line, d);
    });

    if (multiPara) parent.appendChild(target);
  }

  return parent;
}

function appendLineWithLinks(target, line, d) {
  if (!line) return;

  const matches = [...line.matchAll(BARE_URL_RE)];
  let cursor = 0;

  for (const match of matches) {
    const start = match.index;
    if (start > cursor) {
      target.appendChild(d.createTextNode(line.slice(cursor, start)));
    }

    let url = match[0];
    const trailing = url.match(TRAILING_PUNCT_RE);
    if (trailing) url = url.slice(0, -trailing[0].length);

    if (isSafeHttpUrl(url)) {
      const a = d.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      a.textContent = url;
      target.appendChild(a);
    } else {
      target.appendChild(d.createTextNode(url));
    }

    if (trailing) target.appendChild(d.createTextNode(trailing[0]));
    cursor = start + match[0].length;
  }

  if (cursor < line.length) {
    target.appendChild(d.createTextNode(line.slice(cursor)));
  }
}
