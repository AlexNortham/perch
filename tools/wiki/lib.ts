// Small shared helpers for the wiki generator: escaping, hashing, number formatting and a tiny Markdown renderer.
import { createHash } from 'node:crypto';

export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const hash = (...parts: unknown[]): string =>
  createHash('sha1').update(parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join('\u0000')).digest('hex').slice(0, 8);

/** 1234.5 -> "1,234.5"; trims float noise. */
export const num = (n: number, digits = 2): string => Number(n.toFixed(digits)).toLocaleString('en-GB');
export const pct = (f: number, digits = 1): string => `${num(f * 100, digits)}%`;
export const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Names a page link target: `[[heroes/owl]]` or `[[heroes/owl|the Owl]]`. Resolved by the generator against known pages. */
export type LinkResolver = (target: string, text?: string) => string;

/** Inline Markdown: code, bold, italic, [text](url) and [[page|text]]. */
export function inline(src: string, link: LinkResolver): string {
  let s = esc(src);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/&lt;kbd&gt;(.+?)&lt;\/kbd&gt;/g, '<kbd>$1</kbd>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, t: string, text?: string) => link(t, text));
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, url: string) => `<a href="${url}">${text}</a>`);
  return s;
}

/** Block Markdown: headings (## and ###), paragraphs, bullet and numbered lists, tables, and `<!-- -->` passthrough. */
export function markdown(src: string, link: LinkResolver, idPrefix = ''): string {
  const lines = src.replace(/\r/g, '').split('\n');
  const out: string[] = [];
  let i = 0;
  const cells = (row: string): string[] => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  while (i < lines.length) {
    const line = lines[i] ?? '';
    const h = /^(#{2,4}) (.+)$/.exec(line);
    if (h) {
      const level = (h[1] ?? '##').length;
      const explicit = /\s*\{#([\w-]+)\}$/.exec(h[2] ?? '');
      const text = (h[2] ?? '').replace(/\s*\{#[\w-]+\}$/, '');
      out.push(`<h${level} id="${idPrefix}${explicit?.[1] ?? slug(text)}">${inline(text, link)}</h${level}>`);
      i++;
    } else if (/^\|/.test(line) && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] ?? '')) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i] ?? '')) rows.push(cells(lines[i++] ?? ''));
      out.push(
        `<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c, link)}</th>`).join('')}</tr></thead><tbody>` +
          rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c, link)}</td>`).join('')}</tr>`).join('') +
          '</tbody></table></div>',
      );
    } else if (/^\s*([-*]|\d+\.) /.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.) /.test(lines[i] ?? '')) {
        let item = (lines[i++] ?? '').replace(/^\s*([-*]|\d+\.) /, '');
        while (i < lines.length && /^ {2,}\S/.test(lines[i] ?? '') && !/^\s*([-*]|\d+\.) /.test(lines[i] ?? '')) item += ` ${(lines[i++] ?? '').trim()}`;
        items.push(`<li>${inline(item, link)}</li>`);
      }
      out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
    } else if (/^<|^\s*$/.test(line)) {
      if (line.trim() !== '') out.push(line);
      i++;
    } else {
      const para: string[] = [];
      while (i < lines.length && !/^\s*$|^#{2,4} |^\||^\s*([-*]|\d+\.) |^</.test(lines[i] ?? '')) para.push((lines[i++] ?? '').trim());
      out.push(`<p>${inline(para.join(' '), link)}</p>`);
    }
  }
  return out.join('\n');
}
