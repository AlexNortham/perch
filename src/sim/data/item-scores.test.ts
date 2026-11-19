import { expect, it } from 'vitest';
import { ITEMS } from './items';
import { ARCHETYPE_CORES, HERO_ARCHETYPE, SCORE_PRIOR, STARTER_SCORES } from './item-scores';

it('the starter table covers 24 heroes and only names catalogue items', () => {
  const ids = new Set(ITEMS.map((i) => i.id));
  expect(Object.keys(STARTER_SCORES)).toHaveLength(24);
  for (const s of Object.values(STARTER_SCORES)) {
    expect(Object.keys(s.base).sort()).toEqual([...ids].sort());
    for (const id of Object.keys(s.phase)) expect(ids.has(id), id).toBe(true);
  }
  for (const c of Object.values(ARCHETYPE_CORES)) for (const l of Object.values(c)) for (const id of l) expect(ids.has(id), id).toBe(true);
});

it('the prior follows GDD 11.4: list order, component synergy, phase core', () => {
  const s = STARTER_SCORES.pelican!;
  expect(s.base['quick-preen']).toBe(SCORE_PRIOR.first);
  expect(s.base['quill-clip']).toBeCloseTo(SCORE_PRIOR.first - SCORE_PRIOR.step);
  expect(s.base['whirlwind-knot']).toBe(SCORE_PRIOR.off);
  expect(s.synergy['quick-preen']!['flurry-feathers']).toBe(SCORE_PRIOR.component);
  expect(s.phase['apex-talon']).toEqual([0, 0, SCORE_PRIOR.core]);
  expect(HERO_ARCHETYPE.pelican).toBe('gunCarry');
});

it('every one of the 64 items is in some hero list', () => {
  const listed = new Set<string>();
  for (const s of Object.values(STARTER_SCORES)) for (const [id, v] of Object.entries(s.base)) if (v > SCORE_PRIOR.off) listed.add(id);
  expect(ITEMS.filter((i) => !listed.has(i.id)).map((i) => i.id)).toEqual([]);
});
