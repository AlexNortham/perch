// The wiki's coverage gate: runs the generator into a temp folder and fails if any hero, implemented ability, catalogue
// item, status, structure type or unit type has no page or section, or if any internal link or anchor is broken.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HERO_IDS } from '../../src/sim/core/contracts';
import { HEROES } from '../../src/sim/heroes/registry';
import { ITEMS } from '../../src/sim/data/items';
import { CREATURES, FLEDGLINGS, NESTS, RUNES, STRUCTURE_BODY } from '../../src/sim/data/world';
import { loadMap } from '../../src/sim/world/map';
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

// Every test reads the generated pages (and some the committed ones): under load they need more than the 5 s default.
describe('wiki coverage', { timeout: GENERATION_TIMEOUT_MS }, () => {
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
    expect(ids(read('units/objectives.html')).has('nests'), 'nests').toBe(true);
    const fledglings = read('units/fledglings.html').toLowerCase();
    for (const type of Object.keys(FLEDGLINGS)) expect(fledglings, `unit ${type}`).toContain(type);
  });

  it('describes every Stage 4 objective, creature, rune, Nest and building type, and says nothing is still to come', () => {
    const page = read('units/objectives.html').toLowerCase();
    for (const id of ['thickets', 'nests', 'runes', 'golden-egg', 'roc', 'embers', 'feeders', 'interactables']) expect(ids(read('units/objectives.html')).has(id), `section ${id}`).toBe(true);
    for (const c of Object.keys(CREATURES)) expect(page, `creature ${c}`).toContain(c === 'cub' ? 'badger cub' : c);
    for (const r of Object.values(RUNES.types)) expect(page, `rune ${r.name}`).toContain(r.name.toLowerCase());
    for (const v of Object.keys(NESTS)) expect(page, `nest ${v}`).toContain(`${v} nest`);
    const map = loadMap('main');
    const buildings = read('map/buildings.html').toLowerCase();
    for (const a of new Set((map.buildings ?? []).map((b) => b.archetype))) expect(buildings, `building ${a}`).toContain(a.replace(/-/g, ' '));
    expect(ids(read('map/buildings.html')).has('cellar-run')).toBe(true);
    expect(ids(read('map/buildings.html')).has('magpie-den')).toBe(true);
    expect(existsSync(join(out, 'units/bots.html'))).toBe(true);
    expect(existsSync(join(out, 'units/planned.html')), 'no page for features that already exist').toBe(false);
    for (const p of result.pages) expect(read(p), p).not.toMatch(/Coming in Stage|not built yet|press interact/i);
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

describe('hero tips', () => {
  it('has tips for every implemented hero', () => {
    const tips = readFileSync(resolve(__dirname, '../../tools/wiki/pages/hero-tips.md'), 'utf8');
    for (const id of HERO_IDS) if (HEROES[id].implemented) expect(tips, `tips for ${id}`).toMatch(new RegExp(`^## ${id}\\n\\S`, 'm'));
  });
});
