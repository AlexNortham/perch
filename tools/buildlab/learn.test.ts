// The Build Lab's maths on synthetic data with known answers (D-BAL-001, D-BAL-005).
import { describe, expect, it } from 'vitest';
import type { ItemId, ItemScores, PlayerTeam } from '../../src/sim/core/contracts';
import { createRng } from '../../src/sim/core/rng';
import { ITEMS } from '../../src/sim/data/items';
import {
  STATS,
  buildGap,
  checkCores,
  cholesky,
  cholInverse,
  cholSolve,
  contributionModel,
  contributions,
  fitGaussian,
  fitHero,
  fitLogistic,
  holdsOf,
  outcome,
  recommend,
  type Game,
  type Row,
} from './learn';
import type { HeroRecord, MatchRecord } from './match';

const catalogue = new Map(ITEMS.map((i) => [i.id, i]));
const flat: ItemScores = { base: Object.fromEntries(ITEMS.map((i) => [i.id, 0.5])), synergy: {}, phase: {} };
const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));
const MATCH_S = 2700;
const NOISE = 0.3;

/** Games where each of `pool` is bought with probability ½ early and held to the end; c = effect(held) + noise. */
function synthetic(seed: number, n: number, pool: readonly ItemId[], effect: (held: ReadonlyMap<ItemId, number>) => number, buy = 0.5): Game[] {
  const rng = createRng(seed, 'test');
  const normal = (): number => Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());
  return Array.from({ length: n }, (_, k) => {
    const holds = pool.filter(() => rng.next() < buy).map((item) => ({ item, from: Math.floor(rng.next() * 500), to: MATCH_S, phase: 0 }));
    const held = new Map(holds.map((h) => [h.item, (h.to - h.from) / MATCH_S]));
    const c = effect(held) + NOISE * normal();
    return { seed: k, win: c > 0 ? 1 : 0, c, seconds: MATCH_S, holds };
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

describe('regularised regressions', () => {
  const truth = [-0.4, 1.2, -0.8];
  const rng = createRng(7, 'test');
  const xs = Array.from({ length: 20000 }, () => [1, rng.next(), rng.next()]);
  const z = (x: number[]): number => x.reduce((s, v, i) => s + v * truth[i]!, 0);
  const weak = truth.map(() => ({ mean: 0, sd: 10 }));
  const near = (theta: Float64Array, cov: Float64Array): void =>
    truth.forEach((t, i) => expect(Math.abs(theta[i]! - t)).toBeLessThan(3 * Math.sqrt(cov[i * 3 + i]!) + 0.02));

  it('logistic: recovers known coefficients from plenty of data under a weak prior', () => {
    const rows: Row[] = xs.map((x) => ({ x: x.map((v, i) => [i, v] as const), y: rng.next() < sigmoid(z(x)) ? 1 : 0 }));
    const fit = fitLogistic(rows, weak);
    near(fit.theta, fit.cov);
  });

  it('Gaussian: recovers known coefficients and gives back the prior with no data', () => {
    const rows: Row[] = xs.map((x) => ({ x: x.map((v, i) => [i, v] as const), y: z(x) + 0.5 * (rng.next() - 0.5) }));
    const fit = fitGaussian(rows, weak, 0.5 ** 2 / 12);
    near(fit.theta, fit.cov);
    const none = fitGaussian([], [{ mean: 0.3, sd: 1 }, { mean: -2, sd: 0.5 }], 1);
    expect([...none.theta]).toEqual([0.3, -2]);
    expect(none.cov[3]).toBeCloseTo(0.25, 12);
  });

  it('logistic gives back the prior with no data', () => {
    const fit = fitLogistic([], [{ mean: 0.3, sd: 1 }, { mean: -2, sd: 0.5 }]);
    expect([...fit.theta]).toEqual([0.3, -2]);
  });
});

describe('contribution', () => {
  /** Matches where the flock with more Seeds tends to win; other stats are noise. */
  function matches(n: number): MatchRecord[] {
    const rng = createRng(11, 'test');
    return Array.from({ length: n }, (_, k) => {
      const heroes = Array.from({ length: 12 }, (_, i): HeroRecord => {
        const v = (): number => 100 + Math.floor(rng.next() * 900);
        return {
          hero: 'owl', team: (i % 2 ? 'dusk' : 'dawn') as PlayerTeam, k: v(), d: v(), a: v(), lastHits: 0, dmgHeroes: v(),
          dmgStructures: v(), dmgTaken: 0, healing: v(), shielding: 0, netWorth: v(), level: 1,
          dmgBy: { weapon: 0, melee: 0, ability: 0, item: 0, other: 0 }, buys: [], sells: [], ups: [], abilities: {},
        };
      });
      const share = (t: PlayerTeam): number => heroes.filter((h) => h.team === t).reduce((s, h) => s + h.netWorth, 0);
      const total = share('dawn') + share('dusk');
      const z = 12 * ((share('dawn') - share('dusk')) / total);
      const winner: PlayerTeam = rng.next() < sigmoid(z) ? 'dawn' : 'dusk';
      return {
        v: 2, seed: k, minutes: 60, difficulty: 'hard', policy: { dawn: { kind: 'random' }, dusk: { kind: 'random' } }, winner,
        seconds: MATCH_S, hash: '', teams: { dawn: { netWorth: 0, kills: 0, towersLost: 0 }, dusk: { netWorth: 0, kills: 0, towersLost: 0 } }, heroes,
      };
    });
  }

  it('weights the stat that decides wins, and flock contributions add up to the model\'s log-odds', () => {
    const ms = matches(3000);
    const model = contributionModel(ms);
    const w = model.w.slice(1);
    const nw = STATS.indexOf('netWorth');
    expect(w[nw]).toBeGreaterThan(8);
    w.forEach((v, k) => k !== nw && expect(Math.abs(v)).toBeLessThan(4));
    const m = ms[0]!;
    const c = contributions(m, model);
    const flocks = m.heroes.reduce((s, h, i) => s + (h.team === 'dawn' ? 1 : -1) * c[i]!, 0);
    const totals = STATS.map((k) => m.heroes.reduce((s, h) => s + (k === 'support' ? h.healing + h.shielding : h[k]), 0));
    const direct = STATS.reduce((s, k, i) => {
      const a = m.heroes.reduce((t, h) => t + (h.team === 'dawn' ? 1 : -1) * (k === 'support' ? h.healing + h.shielding : h[k]), 0);
      return s + model.w[i + 1]! * (a / totals[i]!);
    }, 0);
    expect(flocks).toBeCloseTo(direct, 10);
  });
});

describe('fitHero and builds', () => {
  const pool = ['thick-quills', 'quill-clip', 'lilt-seed', 'dew-drinker', 'featherlight', 'mocking-note', 'grit-gizzard', 'down-padding'];

  it('ranks a known best item first, a known bad item last, and leads the early core with it', () => {
    const games = synthetic(1, 2500, pool, (h) => 0.3 * (h.get('lilt-seed') ?? 0) - 0.2 * (h.get('quill-clip') ?? 0));
    const m = fitHero('owl', games, flat, catalogue);
    const ranked = [...pool].sort((a, b) => m.scores.base[b]! - m.scores.base[a]!);
    expect(ranked[0]).toBe('lilt-seed');
    expect(ranked.at(-1)).toBe('quill-clip');
    expect(recommend(m.scores, catalogue, []).early[0]).toBe('lilt-seed');
    expect(m.noise).toBeGreaterThan(NOISE * 0.9);
    expect(m.noise).toBeLessThan(NOISE * 1.1);
  });

  it('finds a known synergy pair', () => {
    const games = synthetic(2, 3000, pool, (h) => 0.4 * Math.min(h.get('dew-drinker') ?? 0, h.get('down-padding') ?? 0));
    const m = fitHero('owl', games, flat, catalogue);
    const syn = m.pairs.map(([a, b]) => ({ key: `${a}|${b}`, v: m.scores.synergy[a]?.[b] ?? 0 })).sort((x, y) => y.v - x.v);
    expect(syn[0]?.key).toBe('dew-drinker|down-padding');
    expect(syn[0]!.v).toBeGreaterThan(1);
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

  it('settles a core whose explored swaps are all worse, and catches a core missing a clearly better item', () => {
    const t1 = ITEMS.filter((i) => i.tier === 1).map((i) => i.id);
    const games = synthetic(3, 4000, t1, (h) => 0.3 * (h.get('lilt-seed') ?? 0) + 0.2 * (h.get('dew-drinker') ?? 0), 0.3);
    const m = fitHero('owl', games, flat, catalogue);
    const good = recommend(m.scores, catalogue, []);
    expect(good.early).toEqual(expect.arrayContaining(['lilt-seed', 'dew-drinker']));
    const early = checkCores(m, good, catalogue)[0]!;
    expect(early.unexplored).toBe(0);
    expect(early.settled).toBe(true);
    expect(early.worst!.upper).toBeLessThan(2);
    const bad = { ...good, early: good.early.map((x) => (x === 'lilt-seed' ? 'quill-clip' : x)) };
    const check = checkCores(m, bad, catalogue)[0]!;
    expect(check.settled).toBe(false);
    expect(check.worst?.in).toBe('lilt-seed');
    expect(check.worst!.gain).toBeGreaterThan(2);
    expect(buildGap(m, good, good)).toBe(0);
    expect(buildGap(m, good, bad)).toBeCloseTo(check.worst!.gain, 6);
  });
});

describe('records', () => {
  it('ends a component when its upgrade is bought, and an item when sold', () => {
    const holds = holdsOf({ buys: [[100, 'lilt-seed'], [200, 'quill-clip'], [900, 'rising-song']], sells: [[600, 'quill-clip']] }, 1800, catalogue);
    const by = Object.fromEntries(holds.map((h) => [h.item, [h.from, h.to, h.phase]]));
    expect(by).toEqual({ 'lilt-seed': [100, 900, 0], 'quill-clip': [200, 600, 0], 'rising-song': [900, 1800, 1] });
  });

  it('scores wins and losses, and nothing for an undecided match', () => {
    expect(outcome({ winner: 'dusk' }, 'dusk')).toBe(1);
    expect(outcome({ winner: 'dusk' }, 'dawn')).toBe(0);
    expect(outcome({ winner: null }, 'dawn')).toBeNull();
  });
});
