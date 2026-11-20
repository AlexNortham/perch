/**
 * Build Lab learning (D-BAL-001): per hero, an L2-regularised (Gaussian-prior, MAP) logistic model of the flock's
 * result on what the hero held and when,
 *   logit P(win) = a + b·spend + Σ_i β_i·x_i + Σ_i δ_{i,p(i)}·x_i + Σ_{i<j} γ_ij·x_ij
 * x_i: share of the match item i was held; p(i): the phase it was bought in; x_ij: share of the match i and j were held
 * together; spend: Seeds held in items over the match (so β is value beyond its price, not "rich heroes win").
 * Priors are centred on the designer prior (round 0), so no data gives back the prior exactly:
 *   β_i ~ N(c·(base_i − mean base), σβ²), δ_ip ~ N(c·phase_ip, σδ²), γ_ij ~ N(0, σγ²), c = MODEL.logOddsPerScore.
 * Scores out: base_i = mean base + β_i/c, phase_ip = δ_ip/c, synergy = prior synergy + γ/c (both directions).
 * Newton's method; the inverse Hessian at the optimum is the posterior covariance (Laplace), used for the CIs.
 */
import type { GamePhase, HeroId, ItemDef, ItemId, ItemScores, PlayerTeam, RecommendedBuild } from '../../src/sim/core/contracts';
import { GAME_PHASES } from '../../src/sim/core/contracts';
import { itemScore, ownedWithChains, phaseOf } from '../../src/sim/ai/shop';
import { SHOP } from '../../src/sim/data/ai';
import type { HeroRecord, MatchRecord } from './match';

export const MODEL = {
  /** Win log-odds per score unit, for an item held the whole match. */
  logOddsPerScore: 0.5,
  /** Prior standard deviations, in log-odds. */
  sd: { intercept: 2, spend: 2, base: 0.5, phase: 0.25, synergy: 0.25 },
  /** An undecided match scores σ(κ·ln(own net worth / enemy net worth)); a 10% lead is 0.72. */
  netWorthKappa: 10,
  /** Seeds per unit of the spend feature. */
  spendUnit: 1000,
  /** A pair gets a synergy term once it was held together in this many of the hero's games. */
  minPairGames: 8,
  // ponytail: the most co-held pairs only (the fit is O(columns³)); raise it if Phase B finds synergy beyond them.
  maxPairs: 150,
  newtonSteps: 50,
  tolerance: 1e-9,
} as const;

/** Recommended core sizes and the tiers each phase draws from (GDD §11.8 cores: four T1, four T2–3, three T4). */
export const CORES: Readonly<Record<GamePhase, { readonly size: number; readonly tiers: readonly number[] }>> = {
  early: { size: 4, tiers: [1] },
  mid: { size: 4, tiers: [2, 3] },
  late: { size: 3, tiers: [4] },
};

export type Catalogue = ReadonlyMap<ItemId, ItemDef>;
const PHASES = { midFromS: SHOP.midFromS, lateFromS: SHOP.lateFromS };
const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));

// ---- Linear algebra (dense, row-major n×n). ----

/** Cholesky factor L (lower) of a symmetric positive-definite matrix. */
export function cholesky(a: Float64Array, n: number): Float64Array {
  const l = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = a[i * n + j]!;
      for (let k = 0; k < j; k++) s -= l[i * n + k]! * l[j * n + k]!;
      if (i === j) {
        if (!(s > 0)) throw new Error(`cholesky: not positive definite at ${i}`);
        l[i * n + i] = Math.sqrt(s);
      } else l[i * n + j] = s / l[j * n + j]!;
    }
  }
  return l;
}

/** Solve L·Lᵀ·x = b. */
export function cholSolve(l: Float64Array, n: number, b: Float64Array): Float64Array {
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = b[i]!;
    for (let k = 0; k < i; k++) s -= l[i * n + k]! * y[k]!;
    y[i] = s / l[i * n + i]!;
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i]!;
    for (let k = i + 1; k < n; k++) s -= l[k * n + i]! * x[k]!;
    x[i] = s / l[i * n + i]!;
  }
  return x;
}

export function cholInverse(l: Float64Array, n: number): Float64Array {
  const inv = new Float64Array(n * n);
  const e = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    e.fill(0);
    e[j] = 1;
    const col = cholSolve(l, n, e);
    for (let i = 0; i < n; i++) inv[i * n + j] = col[i]!;
  }
  return inv;
}

// ---- Regularised logistic regression with soft labels. ----

/** One observation: sparse features [column, value] and an outcome in [0, 1]. */
export interface Row {
  readonly x: readonly (readonly [number, number])[];
  readonly y: number;
}
export interface Prior {
  readonly mean: number;
  readonly sd: number;
}
export interface Fit {
  readonly theta: Float64Array;
  /** Posterior covariance (n×n). */
  readonly cov: Float64Array;
}

export function fitLogistic(rows: readonly Row[], priors: readonly Prior[]): Fit {
  const n = priors.length;
  const theta = Float64Array.from(priors, (p) => p.mean);
  const prec = priors.map((p) => 1 / (p.sd * p.sd));
  let l: Float64Array = new Float64Array(0);
  for (let step = 0; step < MODEL.newtonSteps; step++) {
    const h = new Float64Array(n * n);
    const g = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      h[i * n + i] = prec[i]!;
      g[i] = -prec[i]! * (theta[i]! - priors[i]!.mean);
    }
    for (const r of rows) {
      let z = 0;
      for (const [c, v] of r.x) z += theta[c]! * v;
      const p = sigmoid(z);
      const w = p * (1 - p);
      for (const [c, v] of r.x) {
        g[c]! += (r.y - p) * v;
        for (const [d, u] of r.x) h[c * n + d]! += w * v * u;
      }
    }
    l = cholesky(h, n);
    const delta = cholSolve(l, n, g);
    let biggest = 0;
    for (let i = 0; i < n; i++) {
      theta[i]! += delta[i]!;
      biggest = Math.max(biggest, Math.abs(delta[i]!));
    }
    if (biggest < MODEL.tolerance) break;
  }
  return { theta, cov: cholInverse(l, n) };
}

// ---- From match records to one hero's observations. ----

export interface Hold {
  readonly item: ItemId;
  readonly from: number;
  to: number;
  /** GAME_PHASES index at purchase. */
  readonly phase: number;
}

/** Holding intervals: from purchase to sale, to the purchase that consumed it as a component, or to the end. */
export function holdsOf(h: Pick<HeroRecord, 'buys' | 'sells'>, end: number, catalogue: Catalogue): Hold[] {
  const events = [
    ...h.sells.map(([s, item]) => ({ s, item, sell: true })),
    ...h.buys.map(([s, item]) => ({ s, item, sell: false })),
  ].sort((a, b) => a.s - b.s || Number(b.sell) - Number(a.sell));
  const open = new Map<ItemId, Hold>();
  const out: Hold[] = [];
  const close = (item: ItemId, s: number): void => {
    const o = open.get(item);
    if (!o) return;
    o.to = s;
    out.push(o);
    open.delete(item);
  };
  for (const e of events) {
    if (e.sell) {
      close(e.item, e.s);
      continue;
    }
    const component = catalogue.get(e.item)?.component;
    if (component) close(component, e.s);
    close(e.item, e.s);
    open.set(e.item, { item: e.item, from: e.s, to: end, phase: GAME_PHASES.indexOf(phaseOf(e.s, PHASES)) });
  }
  return [...out, ...open.values()];
}

/** The flock's result in [0, 1]: the win, or for an undecided match the net-worth proxy. */
export function outcome(m: Pick<MatchRecord, 'winner' | 'teams'>, team: PlayerTeam): number {
  if (m.winner) return m.winner === team ? 1 : 0;
  const own = Math.max(1, m.teams[team].netWorth);
  const enemy = Math.max(1, m.teams[team === 'dawn' ? 'dusk' : 'dawn'].netWorth);
  return sigmoid(MODEL.netWorthKappa * Math.log(own / enemy));
}

/** One hero in one match, as the model sees it. */
export interface Game {
  readonly seed: number;
  readonly y: number;
  readonly seconds: number;
  readonly holds: readonly Hold[];
}

export function gamesOf(matches: readonly MatchRecord[], hero: HeroId, catalogue: Catalogue): Game[] {
  const out: Game[] = [];
  for (const m of matches) {
    const h = m.heroes.find((x) => x.hero === hero);
    if (h && m.seconds > 0) out.push({ seed: m.seed, y: outcome(m, h.team), seconds: m.seconds, holds: holdsOf(h, m.seconds, catalogue) });
  }
  return out;
}

// ---- One hero's model. ----

export interface HeroModel {
  readonly hero: HeroId;
  readonly games: number;
  /** Times each item was bought in those games. */
  readonly bought: Readonly<Record<ItemId, number>>;
  readonly scores: ItemScores;
  readonly fit: Fit;
  /** Column layout: 0 intercept, 1 spend, then β per item, δ per item and phase, then γ per pair. */
  readonly items: readonly ItemId[];
  readonly pairs: readonly (readonly [ItemId, ItemId])[];
}

const pairKey = (a: ItemId, b: ItemId): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function fitHero(hero: HeroId, games: readonly Game[], prior: ItemScores, catalogue: Catalogue): HeroModel {
  const c = MODEL.logOddsPerScore;
  const items = [...catalogue.keys()];
  const at = new Map(items.map((id, i) => [id, i]));
  const ni = items.length;
  const betaCol = (i: number): number => 2 + i;
  const deltaCol = (i: number, p: number): number => 2 + ni + i * GAME_PHASES.length + p;

  const overlap = (a: Hold, b: Hold, d: number): number => Math.max(0, Math.min(a.to, b.to) - Math.max(a.from, b.from)) / d;
  const pairGames = new Map<string, number>();
  const bought: Record<ItemId, number> = {};
  for (const g of games) {
    const seen = new Set<string>();
    for (const [k, a] of g.holds.entries()) {
      bought[a.item] = (bought[a.item] ?? 0) + 1;
      for (const b of g.holds.slice(k + 1)) {
        if (a.item !== b.item && overlap(a, b, g.seconds) > 0) seen.add(pairKey(a.item, b.item));
      }
    }
    for (const key of seen) pairGames.set(key, (pairGames.get(key) ?? 0) + 1);
  }
  const pairs = [...pairGames]
    .filter(([, n]) => n >= MODEL.minPairGames)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, MODEL.maxPairs)
    .map(([key]) => key)
    .sort();
  const pairCol = new Map(pairs.map((key, i) => [key, 2 + ni * (1 + GAME_PHASES.length) + i]));

  const meanBase = items.reduce((s, id) => s + (prior.base[id] ?? 0), 0) / ni;
  const priors: Prior[] = [
    { mean: 0, sd: MODEL.sd.intercept },
    { mean: 0, sd: MODEL.sd.spend },
    ...items.map((id) => ({ mean: c * ((prior.base[id] ?? 0) - meanBase), sd: MODEL.sd.base })),
    ...items.flatMap((id) => GAME_PHASES.map((_, p) => ({ mean: c * (prior.phase[id]?.[p] ?? 0), sd: MODEL.sd.phase }))),
    ...pairs.map(() => ({ mean: 0, sd: MODEL.sd.synergy })),
  ];

  const rows: Row[] = games.map((g) => {
    const x = new Map<number, number>([[0, 1], [1, 0]]);
    const add = (col: number, v: number): void => void x.set(col, (x.get(col) ?? 0) + v);
    for (const [k, a] of g.holds.entries()) {
      const share = (a.to - a.from) / g.seconds;
      const i = at.get(a.item);
      if (i === undefined || !(share > 0)) continue;
      add(1, ((catalogue.get(a.item)?.cost ?? 0) * share) / MODEL.spendUnit);
      add(betaCol(i), share);
      add(deltaCol(i, a.phase), share);
      for (const b of g.holds.slice(k + 1)) {
        const col = pairCol.get(pairKey(a.item, b.item));
        const v = overlap(a, b, g.seconds);
        if (col !== undefined && v > 0) add(col, v);
      }
    }
    return { x: [...x], y: g.y };
  });
  const fit = fitLogistic(rows, priors);
  const t = fit.theta;

  const round = (v: number): number => Math.round(v * 1000) / 1000 || 0;
  const base: Record<ItemId, number> = {};
  const phase: Record<ItemId, [number, number, number]> = {};
  const synergy: Record<ItemId, Record<ItemId, number>> = {};
  for (const [i, id] of items.entries()) {
    base[id] = round(meanBase + t[betaCol(i)]! / c);
    const offsets = GAME_PHASES.map((_, p) => round(t[deltaCol(i, p)]! / c)) as [number, number, number];
    if (offsets.some((v) => v !== 0)) phase[id] = offsets;
  }
  for (const [owned, row] of Object.entries(prior.synergy)) for (const [id, v] of Object.entries(row)) (synergy[owned] ??= {})[id] = v;
  for (const key of pairs) {
    const [a, b] = key.split('|') as [ItemId, ItemId];
    const v = t[pairCol.get(key)!]! / c;
    (synergy[a] ??= {})[b] = round((synergy[a][b] ?? 0) + v);
    (synergy[b] ??= {})[a] = round((synergy[b][a] ?? 0) + v);
  }
  return {
    hero,
    games: games.length,
    bought,
    scores: { base, synergy, phase },
    fit,
    items,
    pairs: pairs.map((k) => k.split('|') as [ItemId, ItemId]),
  };
}

/**
 * Score of `item` for the model (as sim/ai computes it, without situational picks) and its gradient over the model's
 * columns, so a difference of two scores has variance vᵀΣv.
 */
export function scoreWithGradient(m: HeroModel, item: ItemId, owned: ReadonlySet<ItemId>, p: GamePhase): { score: number; grad: Map<number, number> } {
  const c = MODEL.logOddsPerScore;
  const ni = m.items.length;
  const i = m.items.indexOf(item);
  const grad = new Map<number, number>([[2 + i, 1 / c], [2 + ni + i * GAME_PHASES.length + GAME_PHASES.indexOf(p), 1 / c]]);
  for (const [k, [a, b]] of m.pairs.entries()) {
    if ((a === item && owned.has(b)) || (b === item && owned.has(a))) grad.set(2 + ni * (1 + GAME_PHASES.length) + k, 1 / c);
  }
  return { score: itemScore(m.scores, item, owned, p, new Set()), grad };
}

/** Standard error of score(a) − score(b). */
export function diffSe(m: HeroModel, a: Map<number, number>, b: Map<number, number>): number {
  const v = new Map(a);
  for (const [k, x] of b) v.set(k, (v.get(k) ?? 0) - x);
  const n = m.items.length * (1 + GAME_PHASES.length) + 2 + m.pairs.length;
  let s = 0;
  for (const [i, x] of v) for (const [j, y] of v) s += x * y * m.fit.cov[i * n + j]!;
  return Math.sqrt(Math.max(0, s));
}

// ---- Recommended builds. ----

/** One greedy pick: the chosen item, the runner-up, their score gap and its standard error (null without a model). */
export interface BuildPick {
  readonly phase: GamePhase;
  readonly item: ItemId;
  readonly runnerUp: ItemId | null;
  readonly gap: number;
  readonly se: number | null;
}

/**
 * The recommended cores: per phase, greedily the best-scoring item of the phase's tiers given everything already in
 * the build (synergy and component chains count, at most SHOP.maxActives actives), as a Raptor (temperature 0) bot
 * with Seeds to spare would buy. Situational picks are carried from `situational` (learning them needs the enemy
 * flock in the model; Phase B).
 */
export function recommend(
  scores: ItemScores,
  catalogue: Catalogue,
  situational: RecommendedBuild['situational'],
  model?: HeroModel,
): { build: RecommendedBuild; picks: BuildPick[] } {
  const chosen: ItemId[] = [];
  const picks: BuildPick[] = [];
  const cores: Record<GamePhase, ItemId[]> = { early: [], mid: [], late: [] };
  for (const p of GAME_PHASES) {
    for (let k = 0; k < CORES[p].size; k++) {
      const owned = ownedWithChains(chosen, catalogue);
      const actives = chosen.filter((id) => catalogue.get(id)?.active).length;
      const ranked = [...catalogue.values()]
        .filter((d) => CORES[p].tiers.includes(d.tier) && !owned.has(d.id) && (!d.active || actives < SHOP.maxActives))
        .map((d) => ({ id: d.id, s: itemScore(scores, d.id, owned, p, new Set()) }))
        .sort((a, b) => b.s - a.s || (a.id < b.id ? -1 : 1));
      const [best, next] = ranked;
      if (!best) break;
      let se: number | null = null;
      if (model && next) se = diffSe(model, scoreWithGradient(model, best.id, owned, p).grad, scoreWithGradient(model, next.id, owned, p).grad);
      picks.push({ phase: p, item: best.id, runnerUp: next?.id ?? null, gap: next ? best.s - next.s : Infinity, se });
      chosen.push(best.id);
      cores[p].push(best.id);
    }
  }
  return { build: { ...cores, situational }, picks };
}
