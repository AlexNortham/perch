// The Build Lab's maths on synthetic data with known answers (D-BAL-001). Run: npx vitest run --root tools/buildlab
import { describe, expect, it } from 'vitest';
import type { ItemId, ItemScores } from '../../src/sim/core/contracts';
import { createRng } from '../../src/sim/core/rng';
import { ITEMS } from '../../src/sim/data/items';
import { cholesky, cholInverse, cholSolve, fitHero, fitLogistic, holdsOf, outcome, recommend, type Game, type Row } from './learn';
import { spearman } from './report';

const catalogue = new Map(ITEMS.map((i) => [i.id, i]));
const flat: ItemScores = { base: Object.fromEntries(ITEMS.map((i) => [i.id, 0.5])), synergy: {}, phase: {} };
const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));
const MATCH_S = 1800;

/** Games where each of `pool` is bought with probability ½ at a random early second and held to the end. */
function synthetic(seed: number, n: number, pool: readonly ItemId[], logit: (held: ReadonlyMap<ItemId, number>) => number): Game[] {
  const rng = createRng(seed, 'test');
  return Array.from({ length: n }, (_, k) => {
    const holds = pool.filter(() => rng.next() < 0.5).map((item) => ({ item, from: Math.floor(rng.next() * 500), to: MATCH_S, phase: 0 }));
    const held = new Map(holds.map((h) => [h.item, (h.to - h.from) / MATCH_S]));
    return { seed: k, y: rng.next() < sigmoid(logit(held)) ? 1 : 0, seconds: MATCH_S, holds };
  });
}

describe('linear algebra', () => {
  it('solves and inverts a symmetric positive-definite system', () => {
    const a = Float64Array.from([4, 2, 0.6, 2, 5, 1, 0.6, 1, 3]);
    const l = cholesky(a, 3);
    const x = cholSolve(l, 3, Float64Array.from([1, 2, 3]));
    for (let i = 0; i < 3; i++) expect(a[i * 3]! * x[0]! + a[i * 3 + 1]! * x[1]! + a[i * 3 + 2]! * x[2]!).toBeCloseTo([1, 2, 3][i]!, 10);
    const inv = cholInverse(l, 3);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        let s = 0;
        for (let k = 0; k < 3; k++) s += a[i * 3 + k]! * inv[k * 3 + j]!;
        expect(s).toBeCloseTo(i === j ? 1 : 0, 10);
      }
    }
  });
});

describe('regularised logistic regression', () => {
  it('recovers known coefficients from plenty of data under a weak prior', () => {
    const truth = [-0.4, 1.2, -0.8];
    const rng = createRng(7, 'test');
    const rows: Row[] = Array.from({ length: 20000 }, () => {
      const x = [1, rng.next(), rng.next()];
      const z = x.reduce((s, v, i) => s + v * truth[i]!, 0);
      return { x: x.map((v, i) => [i, v] as const), y: rng.next() < sigmoid(z) ? 1 : 0 };
    });
    const fit = fitLogistic(rows, truth.map(() => ({ mean: 0, sd: 10 })));
    truth.forEach((t, i) => expect(Math.abs(fit.theta[i]! - t)).toBeLessThan(3 * Math.sqrt(fit.cov[i * 3 + i]!) + 0.02));
  });

  it('gives back the prior when there is no data', () => {
    const fit = fitLogistic([], [{ mean: 0.3, sd: 1 }, { mean: -2, sd: 0.5 }]);
    expect([...fit.theta]).toEqual([0.3, -2]);
    expect(fit.cov[3]).toBeCloseTo(0.25, 12);
  });
});

describe('fitHero', () => {
  const pool = ['thick-quills', 'quill-clip', 'lilt-seed', 'dew-drinker', 'featherlight', 'mocking-note', 'grit-gizzard', 'down-padding'];

  it('ranks a known best item first, a known bad item last, and leads the early core with it', () => {
    const games = synthetic(1, 2500, pool, (h) => -0.2 + 1.5 * (h.get('lilt-seed') ?? 0) - 1.0 * (h.get('quill-clip') ?? 0));
    const m = fitHero('owl', games, flat, catalogue);
    const ranked = [...pool].sort((a, b) => m.scores.base[b]! - m.scores.base[a]!);
    expect(ranked[0]).toBe('lilt-seed');
    expect(ranked.at(-1)).toBe('quill-clip');
    expect(recommend(m.scores, catalogue, [], m).build.early[0]).toBe('lilt-seed');
  });

  it('finds a known synergy pair', () => {
    const games = synthetic(2, 3000, pool, (h) => {
      const a = h.get('dew-drinker') ?? 0;
      const b = h.get('down-padding') ?? 0;
      return -0.3 + 2 * Math.min(a, b);
    });
    const m = fitHero('owl', games, flat, catalogue);
    const syn = m.pairs.map(([a, b]) => ({ key: `${a}|${b}`, v: m.scores.synergy[a]?.[b] ?? 0 })).sort((x, y) => y.v - x.v);
    expect(syn[0]?.key).toBe('dew-drinker|down-padding');
    expect(syn[0]!.v).toBeGreaterThan(0.5);
    expect(m.scores.synergy['down-padding']?.['dew-drinker']).toBe(syn[0]!.v);
  });

  it('returns the prior exactly with no games, and keeps its component synergy', () => {
    const prior: ItemScores = {
      base: { ...flat.base, 'lilt-seed': 1 },
      synergy: { 'lilt-seed': { 'rising-song': 0.3 } },
      phase: { 'lilt-seed': [0.3, 0, 0] },
    };
    const m = fitHero('owl', [], prior, catalogue);
    expect(m.scores.base).toEqual(prior.base);
    expect(m.scores.phase).toEqual(prior.phase);
    expect(m.scores.synergy).toEqual(prior.synergy);
  });

  it('settles a clear pick: its lead over the runner-up is outside the 95% interval', () => {
    const m = fitHero('owl', synthetic(3, 2500, pool, (h) => 2 * (h.get('lilt-seed') ?? 0)), flat, catalogue);
    const { picks } = recommend(m.scores, catalogue, [], m);
    const first = picks[0]!;
    expect(first.item).toBe('lilt-seed');
    expect(first.gap).toBeGreaterThan(1.96 * first.se!);
  });
});

describe('records', () => {
  it('ends a component when its upgrade is bought, and an item when sold', () => {
    const holds = holdsOf({ buys: [[100, 'lilt-seed'], [200, 'quill-clip'], [900, 'rising-song']], sells: [[600, 'quill-clip']] }, 1800, catalogue);
    const by = Object.fromEntries(holds.map((h) => [h.item, [h.from, h.to, h.phase]]));
    expect(by).toEqual({ 'lilt-seed': [100, 900, 0], 'quill-clip': [200, 600, 0], 'rising-song': [900, 1800, 1] });
  });

  it('scores wins, losses and the net-worth proxy', () => {
    const teams = { dawn: { netWorth: 11000, kills: 0, towersLost: 0 }, dusk: { netWorth: 10000, kills: 0, towersLost: 0 } };
    expect(outcome({ winner: 'dusk', teams }, 'dusk')).toBe(1);
    expect(outcome({ winner: 'dusk', teams }, 'dawn')).toBe(0);
    expect(outcome({ winner: null, teams }, 'dawn')).toBeCloseTo(0.722, 3);
    expect(outcome({ winner: null, teams }, 'dawn') + outcome({ winner: null, teams }, 'dusk')).toBeCloseTo(1, 12);
  });

  it('computes Spearman ρ with ties', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 12);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 12);
    expect(spearman([1, 1, 2, 3], [5, 5, 6, 7])).toBeCloseTo(1, 12);
  });
});
