// The wiki generator: registers every page, renders them from game data and hand-written prose, and writes the site.
// `generate(outDir)` never touches the network or a browser; screenshots come from capture.ts (hash-named files).
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { CURRENT_STAGE, ROOT } from './facts';
import { esc, inline, markdown, slug } from './lib';
import { imageFor, plan } from './imageplan';
import { CSS, JS, layout, rel } from './site';
import type { Crumb, NavItem } from './site';
import { registerHeroes } from './heroes';
import { registerItems } from './items';
import { registerMechanics } from './mechanics';
import { registerWorld } from './world';
import { registerMeta } from './meta';

export interface PageDef {
  path: string;
  title: string;
  section: string;
  description: string;
  /** Extra words the search index should match strongly (names of heroes, items…). */
  keywords?: string;
  parent?: string;
  body: () => string;
}

export interface Ctx {
  add(def: PageDef): void;
  /** `heroes/owl` or `items/talon#quill-clip` → an <a> to that page. Unknown targets are recorded as broken. */
  link(target: string, text?: string): string;
  /** Just the relative URL of a page (for cards). */
  href(target: string): string;
  /** Markdown with [[page|text]] links. */
  md(src: string, idPrefix?: string): string;
  /** A hand-written page source from tools/wiki/pages/<name>.md (without its leading # title). */
  prose(name: string): { title: string; body: string };
  /** A captured image as a <figure> with caption, or '' when the key is unknown. */
  figure(key: string, caption?: string): string;
  /** A bare <img> for tables and cards. */
  imgTag(key: string, cls?: string): string;
  /** The page-relative URL of an image file from the current page; set while rendering. */
  here: string;
  stage: number;
  date: string;
  broken: string[];
  pages: Map<string, PageDef>;
}

const PAGES_DIR = join(ROOT, 'tools/wiki/pages');

export interface GenResult { pages: string[]; images: string[]; broken: string[]; missingImages: string[]; bytes: number }

export function generate(outDir: string, date = new Date().toISOString().slice(0, 10)): GenResult {
  const pages = new Map<string, PageDef>();
  const broken: string[] = [];
  const extraFiles = new Map<string, string>();
  const ctx: Ctx = {
    here: '',
    stage: CURRENT_STAGE,
    date,
    broken,
    pages,
    add(def) {
      if (pages.has(def.path)) throw new Error(`wiki: duplicate page ${def.path}`);
      pages.set(def.path, def);
    },
    link(target, text) {
      const [pathPart = '', anchor] = target.split('#');
      const path = pathPart.endsWith('.html') ? pathPart : `${pathPart}.html`;
      const key = pages.has(path) ? path : pages.has(`${pathPart}/index.html`) ? `${pathPart}/index.html` : '';
      if (!key) {
        broken.push(`${ctx.here}: [[${target}]]`);
        return esc(text ?? target);
      }
      const label = text ?? pages.get(key)?.title ?? target;
      return `<a href="${rel(ctx.here, key)}${anchor ? `#${anchor}` : ''}">${esc(label)}</a>`;
    },
    href(target) {
      return /href="([^"]+)"/.exec(ctx.link(target, 'x'))?.[1] ?? '#';
    },
    md(src, idPrefix = '') {
      return markdown(src, (t, text) => ctx.link(t, text), idPrefix);
    },
    prose(name) {
      const raw = readFileSync(join(PAGES_DIR, `${name}.md`), 'utf8').replace(/\r/g, '');
      const m = /^# (.+)\n/.exec(raw);
      return { title: m?.[1] ?? name, body: m ? raw.slice(m[0].length) : raw };
    },
    figure(key, caption) {
      const s = imageFor(key);
      if (!s) return '';
      const cap = caption ?? s.alt;
      return `<figure class="shot"><img src="${rel(ctx.here, s.file)}" alt="${esc(s.alt)}" width="${s.w}" height="${s.h}" loading="lazy"><figcaption>${inline(cap, (t, x) => ctx.link(t, x))}</figcaption></figure>`;
    },
    imgTag(key, cls = '') {
      const s = imageFor(key);
      return s ? `<img src="${rel(ctx.here, s.file)}" alt="${esc(s.alt)}" width="${s.w}" height="${s.h}" loading="lazy"${cls ? ` class="${cls}"` : ''}>` : '';
    },
  };

  registerMeta(ctx);
  registerHeroes(ctx, extraFiles);
  registerItems(ctx, extraFiles);
  registerMechanics(ctx);
  registerWorld(ctx, extraFiles);

  // ---- navigation tree from each page's section and parent ----
  const order = ['Home', 'Getting started', 'Heroes', "The Magpie's Hoard", 'Mechanics', 'The map', 'Units and objectives', 'Reference'];
  const nav: NavItem[] = [];
  for (const section of order) {
    const inSection = [...pages.values()].filter((p) => p.section === section);
    const top = inSection.find((p) => !p.parent) ?? inSection[0];
    if (!top) continue;
    nav.push({ title: section === 'Home' ? 'Home' : top.title, path: top.path, children: inSection.filter((p) => p !== top && p.path !== top.path).map((p) => ({ title: p.title, path: p.path })) });
  }
  const crumbsFor = (p: PageDef): Crumb[] => {
    const out: Crumb[] = [{ title: 'Home', path: 'index.html' }];
    const top = [...pages.values()].find((q) => q.section === p.section && !q.parent);
    if (top && top.path !== p.path && p.path !== 'index.html') out.push({ title: top.title, path: top.path });
    if (p.parent && p.parent !== top?.path) {
      const par = pages.get(p.parent);
      if (par) out.push({ title: par.title, path: par.path });
    }
    return p.path === 'index.html' ? [] : out;
  };

  // ---- render ----
  mkdirSync(outDir, { recursive: true });
  const written: string[] = [];
  const searchIndex: { t: string; u: string; s: string; k: string; x: string }[] = [];
  for (const p of pages.values()) {
    ctx.here = p.path;
    const body = p.body();
    const html = layout({ path: p.path, title: p.title, description: p.description, nav, crumbs: crumbsFor(p), body, stage: CURRENT_STAGE, date });
    mkdirSync(dirname(join(outDir, p.path)), { recursive: true });
    writeFileSync(join(outDir, p.path), html);
    written.push(p.path);
    const text = body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').toLowerCase();
    searchIndex.push({ t: p.title, u: p.path, s: p.section, k: `${p.keywords ?? ''} ${p.title}`.toLowerCase(), x: text.slice(0, 2500) });
  }
  mkdirSync(join(outDir, 'assets'), { recursive: true });
  writeFileSync(join(outDir, 'assets/wiki.css'), CSS);
  writeFileSync(join(outDir, 'assets/wiki.js'), JS);
  writeFileSync(join(outDir, 'assets/search-index.js'), `window.WIKI_INDEX=${JSON.stringify(searchIndex)};\n`);
  for (const [file, content] of extraFiles) {
    mkdirSync(dirname(join(outDir, file)), { recursive: true });
    writeFileSync(join(outDir, file), content);
  }

  // ---- images: copy committed ones when generating somewhere else (the coverage test), and report missing ones ----
  const committed = join(ROOT, 'wiki/img');
  const missingImages: string[] = [];
  const images: string[] = [];
  mkdirSync(join(outDir, 'img'), { recursive: true });
  for (const s of plan.values()) {
    const src = join(committed, s.file.replace(/^img\//, ''));
    const dst = join(outDir, s.file);
    if (resolve(src) !== resolve(dst) && existsSync(src)) copyFileSync(src, dst);
    if (existsSync(dst)) images.push(s.file);
    else {
      missingImages.push(s.file);
      // A screenshot not captured yet gets a placeholder when generating elsewhere (the test), so no reference dangles.
      if (resolve(src) !== resolve(dst)) writeFileSync(dst, `<svg xmlns="http://www.w3.org/2000/svg" width="${s.w}" height="${s.h}"><rect width="100%" height="100%" fill="#ccc"/></svg>`);
    }
  }
  for (const f of extraFiles.keys()) if (f.startsWith('img/')) images.push(f);
  // Stale hash-named JPEGs from older builds are removed so the folder only holds what pages use.
  const wanted = new Set([...plan.values()].map((s) => s.file.replace(/^img\//, '')));
  for (const f of extraFiles.keys()) wanted.add(f.replace(/^img\//, ''));
  for (const f of readdirSync(join(outDir, 'img'))) if (!wanted.has(f)) rmSync(join(outDir, 'img', f));
  let bytes = 0;
  const walk = (d: string): void => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(d, e.name));
      else bytes += readFileSync(join(d, e.name)).length;
    }
  };
  walk(outDir);
  return { pages: written, images, broken, missingImages, bytes };
}

export { slug };
