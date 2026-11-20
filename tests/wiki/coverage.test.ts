// The wiki's coverage gate: runs the generator into a temp folder and fails if any hero, implemented ability, catalogue
// item, status, structure type or unit type has no page or section, or if any internal link or anchor is broken.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HERO_IDS } from '../../src/sim/core/contracts';
import { HEROES } from '../../src/sim/heroes/registry';
import { ITEMS } from '../../src/sim/data/items';
import { FLEDGLINGS, STRUCTURE_BODY } from '../../src/sim/data/world';
import { STATUSES } from '../../tools/wiki/facts';
import { generate } from '../../tools/wiki/generate';
import type { GenResult } from '../../tools/wiki/generate';

const GENERATION_TIMEOUT_MS = 60_000;
let out = '';
let result: GenResult;
const read = (p: string): string => readFileSync(join(out, p), 'utf8');
const ids = (html: string): Set<string> => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1] ?? ''));

beforeAll(() => {
  out = mkdtempSync(join(tmpdir(), 'perch-wiki-'));
  result = generate(out, '2026-01-01');
}, GENERATION_TIMEOUT_MS);
afterAll(() => rmSync(out, { recursive: true, force: true }));

describe('wiki coverage', () => {
  it('builds with no broken [[links]] in the sources', () => {
    expect(result.broken).toEqual([]);
  });

  it('has a page for every hero, and a section for every implemented ability', () => {
    for (const id of HERO_IDS) {
      expect(existsSync(join(out, `heroes/${id}.html`)), `hero page ${id}`).toBe(true);
      const page = read(`heroes/${id}.html`);
      if (HEROES[id].implemented) {
        const have = ids(page);
        for (const a of HEROES[id].def.abilities) expect(have.has(`ability-${a.id.replace(/\./g, '-')}`), `${id}: ability ${a.id}`).toBe(true);
      } else {
        expect(page, `${id} is marked as coming later`).toContain('Coming in Stage');
      }
    }
  });

  it('lists every catalogue item in its category page', () => {
    for (const item of ITEMS) {
      expect(ids(read(`items/${item.category}.html`)).has(`item-${item.id}`), `item ${item.id}`).toBe(true);
    }
  });

  it('explains every status', () => {
    const have = ids(read('mechanics/statuses.html'));
    for (const s of STATUSES) expect(have.has(`status-${s.id}`), `status ${s.id}`).toBe(true);
  });

  it('covers every structure and unit type', () => {
    const towers = ids(read('units/towers.html'));
    for (const t of ['hawk', 'heron', 'warden', 'shrine'] as const) {
      expect(Object.keys(STRUCTURE_BODY)).toContain(t);
      expect(towers.has(t), `structure ${t}`).toBe(true);
    }
    expect(Object.keys(STRUCTURE_BODY)).toContain('patron');
    expect(read('units/patrons.html')).toContain('Phase 2');
    expect(ids(read('units/planned.html')).has('nests'), 'nest (planned)').toBe(true);
    const fledglings = read('units/fledglings.html').toLowerCase();
    for (const type of Object.keys(FLEDGLINGS)) expect(fledglings, `unit ${type}`).toContain(type);
  });

  it('has working internal links and anchors, and alt text on every image', () => {
    const pages = result.pages;
    const idCache = new Map<string, Set<string>>();
    const problems: string[] = [];
    for (const page of pages) {
      const html = read(page);
      for (const m of html.matchAll(/<img\b[^>]*>/g)) {
        if (!/\salt="[^"]+"/.test(m[0])) problems.push(`${page}: image without alt text`);
        const src = /\ssrc="([^"]+)"/.exec(m[0])?.[1];
        if (src && !/^(https?:|data:)/.test(src) && !existsSync(resolve(out, dirname(page), src))) problems.push(`${page}: image ${src} does not exist`);
      }
      for (const m of html.matchAll(/\shref="([^"#]*)(?:#([^"]*))?"/g)) {
        const [, target = '', anchor] = m;
        if (/^(https?:|mailto:|data:)/.test(target)) continue;
        const file = target === '' ? page : join(dirname(page), target).replace(/\\/g, '/');
        const full = resolve(out, file);
        if (!existsSync(full)) { problems.push(`${page}: ${target} does not exist`); continue; }
        if (anchor && full.endsWith('.html')) {
          let have = idCache.get(file);
          if (!have) idCache.set(file, (have = ids(readFileSync(full, 'utf8'))));
          if (!have.has(anchor)) problems.push(`${page}: #${anchor} not found in ${file}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('keeps reference-game names off every page', () => {
    for (const page of result.pages) expect(read(page), page).not.toMatch(/deadlock|valve|dota/i);
  });

  it('is self-contained: no external scripts, styles or fonts', () => {
    for (const page of result.pages) expect(read(page), page).not.toMatch(/(?:src|href)="https?:/);
    expect(readdirSync(join(out, 'assets'))).toEqual(expect.arrayContaining(['wiki.css', 'wiki.js', 'search-index.js']));
  });

  it('reports screenshots that are not captured yet (run npm run wiki)', () => {
    // Not a failure: a balance or model change moves an image's hash, and `npm run wiki` re-captures it.
    if (result.missingImages.length > 0) console.warn(`wiki: ${result.missingImages.length} screenshot(s) are stale or missing; run npm run wiki`);
    expect(result.pages.length).toBeGreaterThan(40);
  });

  it('warns (never fails) when the committed wiki/ is stale; npm run wiki regenerates it at each gate', () => {
    const strip = (h: string): string => h.replace(/Last regenerated [\d-]+/, '');
    const committed = resolve(__dirname, '../../wiki');
    const stale = result.pages.filter((p) => !existsSync(join(committed, p)) || strip(readFileSync(join(committed, p), 'utf8')) !== strip(read(p)));
    if (stale.length > 0) console.warn(`wiki: committed wiki/ is stale (${stale.length} page(s), e.g. ${stale[0]}); run npm run wiki`);
    expect(Array.isArray(stale)).toBe(true);
  });
});
