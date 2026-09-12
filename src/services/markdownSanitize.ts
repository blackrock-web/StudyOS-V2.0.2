/**
 * Minimal offline Markdown → safe React-friendly HTML string.
 * Disallows raw HTML, javascript: links, data: except images we strip, SVG/MathML.
 * Only http(s), mailto, and relative anchors allowed for links.
 */

const ALLOWED_SCHEMES = /^(https?:|mailto:|#|\/)/i;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(url: string): string | null {
  const t = url.trim();
  if (!t || t.length > 2048) return null;
  if (/^javascript:/i.test(t) || /^vbscript:/i.test(t) || /^data:/i.test(t)) return null;
  if (!ALLOWED_SCHEMES.test(t)) return null;
  return t;
}

/**
 * Convert a restricted Markdown subset to escaped HTML.
 * Supports: headings, bold, italic, code, links, lists, paragraphs. No raw HTML.
 */
export function sanitizeMarkdown(md: string, maxLen = 100_000): string {
  if (typeof md !== 'string') return '';
  let src = md.slice(0, maxLen);
  // Strip any HTML tags first (treat as text)
  src = src.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const lines = src.split(/\r?\n/);
  const out: string[] = [];
  let inCode = false;
  let inList = false;

  const flushList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (let raw of lines) {
    if (raw.startsWith('```')) {
      flushList();
      if (inCode) {
        out.push('</code></pre>');
        inCode = false;
      } else {
        out.push('<pre class="md-code"><code>');
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      out.push(raw + '\n');
      continue;
    }

    // Headings
    const h = raw.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      flushList();
      const level = h[1]!.length;
      out.push(`<h${level} class="md-h">${inline(h[2]!)}</h${level}>`);
      continue;
    }

    // Unordered list
    const li = raw.match(/^[-*]\s+(.+)$/);
    if (li) {
      if (!inList) {
        out.push('<ul class="md-ul">');
        inList = true;
      }
      out.push(`<li>${inline(li[1]!)}</li>`);
      continue;
    }

    flushList();
    if (!raw.trim()) {
      out.push('<br/>');
      continue;
    }
    out.push(`<p class="md-p">${inline(raw)}</p>`);
  }
  flushList();
  if (inCode) out.push('</code></pre>');
  return out.join('');
}

function inline(text: string): string {
  // Already HTML-escaped for < >
  let t = text;
  // Code
  t = t.replace(/`([^`]+)`/g, (_m, c) => `<code class="md-inline">${c}</code>`);
  // Bold / italic
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Links [text](url)
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    const safe = sanitizeUrl(String(url));
    if (!safe) return escapeHtml(String(label));
    return `<a href="${escapeHtml(safe)}" rel="noopener noreferrer" target="_blank">${label}</a>`;
  });
  // Images disabled by default (no remote / svg)
  t = t.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_m, alt) => escapeHtml(String(alt || '')));
  return t;
}

/** Plain-text only — safest for untrusted PDF extracts */
export function plainTextOnly(s: string, maxLen = 50_000): string {
  if (typeof s !== 'string') return '';
  return s.slice(0, maxLen).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}
