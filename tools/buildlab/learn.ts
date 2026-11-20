/**
 * Build Lab learning (D-BAL-001, Phase B: D-BAL-005).
 *
 * 1. Contribution (the lower-variance measure). On decided matches, a logistic model of the winner on the flocks'
 *    differences in stat shares: logit P(dawn wins) = a + Σ_k w_k·(Σ_dawn s_hk − Σ_dusk s_hk), where s_hk is hero h's
 *    share of the match total of stat k (Seeds, damage to heroes, damage to structures, kills, deaths, assists, healing
 *    and shields given). A hero's contribution is c_h = Σ_k w_k·(s_hk − 1/12), in win log-odds: the flock's
 *    contributions minus the enemy's are the model's log-odds, so c is calibrated on real wins.
 * 2. Item value. Per hero, a Gaussian-prior (MAP) linear model of c on what the hero held and when,
 *      c = a + b·spend + Σ_i β_i·x_i + Σ_i δ_{i,p(i)}·x_i + Σ_{i<j} γ_ij·x_ij + noise
 *    x_i: share of the match item i was held; p(i): the phase it was bought in; x_ij: share held together; spend: Seeds
 *    held in items (so β is value beyond price). Priors centre on the designer prior (round 0):
 *      β_i ~ N(c·(base_i − mean base), σβ²), δ_ip ~ N(c·phase_ip, σδ²), γ_ij ~ N(0, σγ²), c = MODEL.logOddsPerScore,
 *    so no data gives back the prior exactly. The posterior covariance gives every CI.
 * 3. Scores out: base = mean base + β/c, phase = δ/c, synergy = prior synergy (component chains) + γ/c both ways.
 * 4. Builds: greedy cores on the scores; judged as whole cores and builds in win-rate points (D-BAL-005).
 */
import type { GamePhase, HeroId, ItemDef, ItemId, ItemScores, PlayerTeam, RecommendedBuild } from '../../src/sim/core/contracts';
import { GAME_PHASES } from '../../src/sim/core/contracts';
import { itemScore, ownedWithChains, phaseOf } from '../../src/sim/ai/shop';
import { SHOP } from '../../src/sim/data/ai';
import type { HeroRecord, MatchRecord } from './match';

export const MODEL = {
  /** Win log-odds of contribution per score unit, for an item held the whole match (0.1 ≈ 2.5 win-rate points). */
  logOddsPerScore: 0.1,
  /** Prior standard deviations, in log-odds: no single item is likely to move a hero's flock by more than ~10 points. */
  sd: { intercept: 2, spend: 2, average: 2, base: 0.2, phase: 0.1, synergy: 0.02 },
  /** Seeds per unit of the spend feature. */
  spendUnit: 1000,
  /** A pair gets a synergy term once it was held together in this many of the hero's games. */
  minPairGames: 30,
  // ponytail: the most co-held pairs only (the fit is O(columns³)); raise it if synergy beyond them matters.
  maxPairs: 150,
  /** Floor on the contribution noise variance (keeps the first pass sane on tiny data). */
  minNoise: 1e-3,
  newtonSteps: 50,
  tolerance: 1e-9,
} as const;

/** D-BAL-005: the practical margin, in win-rate percentage points, and what counts as enough data on an alternative. */
export const MARGIN = {
  points: 2,
  z: 1.96,
  /** An alternative item is judged once the hero held it in this many games; fewer: "unexplored". */
  minGames: 30,
} as const;
/** Percentage points of win rate per log-odds near 50%. */
export const POINTS_PER_LOGODDS = 25;

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

// ---- Regularised regressions. ----

/** One observation: sparse features [column, value] and an outcome. */
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

/** MAP logistic regression (outcomes in [0, 1]) by Newton's method; Laplace covariance. */
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

/** MAP linear regression with Gaussian noise of variance `noise` (exact: one solve). */
export function fitGaussian(rows: readonly Row[], priors: readonly Prior[], noise: number): Fit {
  const n = priors.length;
  const h = new Float64Array(n * n);
  const b = new Float64Array(n);
  priors.forEach((p, i) => {
    h[i * n + i] = 1 / (p.sd * p.sd);
    b[i] = p.mean / (p.sd * p.sd);
  });
  for (const r of rows) {
    for (const [c, v] of r.x) {
      b[c]! += (r.y * v) / noise;
      for (const [d, u] of r.x) h[c * n + d]! += (v * u) / noise;
    }
  }
  const l = cholesky(h, n);
  return { theta: cholSolve(l, n, b), cov: cholInverse(l, n) };
}

const predict = (theta: Float64Array, r: Row): number => r.x.reduce((s, [c, v]) => s + theta[c]! * v, 0);

// ---- Contribution: a per-hero share of the win, calibrated on decided matches. ----

export const STATS = ['netWorth', 'dmgHeroes', 'dmgStructures', 'k', 'd', 'a', 'support'] as const;
type Stat = (typeof STATS)[number];
const statOf = (h: HeroRecord, k: Stat): number => (k === 'support' ? h.healing + h.shielding : h[k]);
const ROSTER = 12;

/** Each hero's share of the match total of each stat (0 when nobody scored it). */
function shares(m: MatchRecord): number[][] {
  const totals = STATS.map((k) => m.heroes.reduce((s, h) => s + statOf(h, k), 0));
  return m.heroes.map((h) => STATS.map((k, i) => (totals[i]! > 0 ? statOf(h, k) / totals[i]! : 1 / ROSTER)));
}

export interface Contribution {
  /** [intercept for Dawn, w per STATS entry]. */
  readonly w: readonly number[];
  readonly matches: number;
  /** Share of decided matches whose winner the stats model picks. */
  readonly accuracy: number;
}

/** Fit the stat weights on decided matches (weak N(0, 10²) priors). */
export function contributionModel(matches: readonly MatchRecord[]): Contribution {
  const decided = matches.filter((m) => m.winner);
  const rows: Row[] = decided.map((m) => {
    const s = shares(m);
    const x: [number, number][] = [[0, 1]];
    STATS.forEach((_, k) => {
      let a = 0;
      m.heroes.forEach((h, i) => (a += (h.team === 'dawn' ? 1 : -1) * s[i]![k]!));
      x.push([k + 1, a]);
    });
    return { x, y: m.winner === 'dawn' ? 1 : 0 };
  });
  const fit = fitLogistic(rows, [{ mean: 0, sd: 10 }, ...STATS.map(() => ({ mean: 0, sd: 10 }))]);
  const right = rows.filter((r) => predict(fit.theta, r) > 0 === (r.y === 1)).length;
  return { w: [...fit.theta], matches: decided.length, accuracy: right / Math.max(1, rows.length) };
}

/** Each hero's contribution to its flock's win log-odds, in roster order. */
export function contributions(m: MatchRecord, model: Contribution): number[] {
  return shares(m).map((s) => s.reduce((sum, v, k) => sum + model.w[k + 1]! * (v - 1 / ROSTER), 0));
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

/** 1 for a win, 0 for a loss, null when the match was not decided. */
export function outcome(m: Pick<MatchRecord, 'winner'>, team: PlayerTeam): number | null {
  return m.winner ? (m.winner === team ? 1 : 0) : null;
}

/** One hero in one decided match, as the model sees it. */
export interface Game {
  readonly seed: number;
  readonly win: number;
  /** Contribution, win log-odds. */
  readonly c: number;
  readonly seconds: number;
  readonly holds: readonly Hold[];
}

export function gamesOf(matches: readonly MatchRecord[], hero: HeroId, catalogue: Catalogue, model: Contribution): Game[] {
  const out: Game[] = [];
  for (const m of matches) {
    const i = m.heroes.findIndex((x) => x.hero === hero);
    const h = m.heroes[i];
    const win = h ? outcome(m, h.team) : null;
    if (h && win !== null && m.seconds > 0) {
      out.push({ seed: m.seed, win, c: contributions(m, model)[i]!, seconds: m.seconds, holds: holdsOf(h, m.seconds, catalogue) });
    }
  }
  return out;
}

// ---- One hero's model. ----

export interface HeroModel {
  readonly hero: HeroId;
  readonly games: number;
  /** Games in which the hero held each item. */
  readonly bought: Readonly<Record<ItemId, number>>;
  readonly scores: ItemScores;
  readonly fit: Fit;
  /** Residual standard deviation of the contribution (log-odds). */
  readonly noise: number;
  /** Mean share of the match an item bought in each phase was held (for build values). */
  readonly held: readonly [number, number, number];
  /** Column layout (see COL): intercept, spend, the average item, β per item, δ per item and phase, γ per pair. */
  readonly items: readonly ItemId[];
  readonly pairs: readonly (readonly [ItemId, ItemId])[];
}

/**
 * Column layout. `average` is the value of the average item held (a shared mean for every β), so an item without
 * data is assumed average for its price plus the designer's offset, not worth exactly its price.
 */
const COL = {
  intercept: 0,
  spend: 1,
  average: 2,
  beta: (i: number): number => 3 + i,
  delta: (ni: number, i: number, p: number): number => 3 + ni + i * GAME_PHASES.length + p,
  pair: (ni: number, k: number): number => 3 + ni * (1 + GAME_PHASES.length) + k,
} as const;

const pairKey = (a: ItemId, b: ItemId): string => (a < b ? `${a}|${b}` : `${b}|${a}`);
/** Held shares when a phase has no data: about what a 45-minute match gives. */
const DEFAULT_HELD: readonly [number, number, number] = [0.6, 0.35, 0.15];

export function fitHero(hero: HeroId, games: readonly Game[], prior: ItemScores, catalogue: Catalogue): HeroModel {
  const c = MODEL.logOddsPerScore;
  const items = [...catalogue.keys()];
  const at = new Map(items.map((id, i) => [id, i]));
  const ni = items.length;
  const betaCol = COL.beta;
  const deltaCol = (i: number, p: number): number => COL.delta(ni, i, p);

  const overlap = (a: Hold, b: Hold, d: number): number => Math.max(0, Math.min(a.to, b.to) - Math.max(a.from, b.from)) / d;
  const pairGames = new Map<string, number>();
  const bought: Record<ItemId, number> = {};
  const heldSum = [0, 0, 0];
  const heldN = [0, 0, 0];
  for (const g of games) {
    const seen = new Set<string>();
    const inGame = new Set<ItemId>();
    for (const [k, a] of g.holds.entries()) {
      inGame.add(a.item);
      heldSum[a.phase]! += (a.to - a.from) / g.seconds;
      heldN[a.phase]!++;
      for (const b of g.holds.slice(k + 1)) {
        if (a.item !== b.item && overlap(a, b, g.seconds) > 0) seen.add(pairKey(a.item, b.item));
      }
    }
    for (const id of inGame) bought[id] = (bought[id] ?? 0) + 1;
    for (const key of seen) pairGames.set(key, (pairGames.get(key) ?? 0) + 1);
  }
  const held = DEFAULT_HELD.map((d, p) => (heldN[p]! > 0 ? heldSum[p]! / heldN[p]! : d)) as [number, number, number];
  const pairs = [...pairGames]
    .filter(([, n]) => n >= MODEL.minPairGames)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, MODEL.maxPairs)
    .map(([key]) => key)
    .sort();
  const pairCol = new Map(pairs.map((key, i) => [key, COL.pair(ni, i)]));

  const meanBase = items.reduce((s, id) => s + (prior.base[id] ?? 0), 0) / ni;
  const priors: Prior[] = [
    { mean: 0, sd: MODEL.sd.intercept },
    { mean: 0, sd: MODEL.sd.spend },
    { mean: 0, sd: MODEL.sd.average },
    ...items.map((id) => ({ mean: c * ((prior.base[id] ?? 0) - meanBase), sd: MODEL.sd.base })),
    ...items.flatMap((id) => GAME_PHASES.map((_, p) => ({ mean: c * (prior.phase[id]?.[p] ?? 0), sd: MODEL.sd.phase }))),
    ...pairs.map(() => ({ mean: 0, sd: MODEL.sd.synergy })),
  ];

  const rows: Row[] = games.map((g) => {
    const x = new Map<number, number>([[COL.intercept, 1], [COL.spend, 0], [COL.average, 0]]);
    const add = (col: number, v: number): void => void x.set(col, (x.get(col) ?? 0) + v);
    for (const [k, a] of g.holds.entries()) {
      const share = (a.to - a.from) / g.seconds;
      const i = at.get(a.item);
      if (i === undefined || !(share > 0)) continue;
      add(COL.spend, ((catalogue.get(a.item)?.cost ?? 0) * share) / MODEL.spendUnit);
      add(COL.average, share);
      add(betaCol(i), share);
      add(deltaCol(i, a.phase), share);
      for (const b of g.holds.slice(k + 1)) {
        const col = pairCol.get(pairKey(a.item, b.item));
        const v = overlap(a, b, g.seconds);
        if (col !== undefined && v > 0) add(col, v);
      }
    }
    return { x: [...x], y: g.c };
  });
  // Noise variance: start from the outcome's variance, then refit on the residuals once.
  const mean = rows.reduce((s, r) => s + r.y, 0) / Math.max(1, rows.length);
  let noise = Math.max(MODEL.minNoise, rows.reduce((s, r) => s + (r.y - mean) ** 2, 0) / Math.max(1, rows.length - 1));
  let fit = fitGaussian(rows, priors, noise);
  if (rows.length > 1) {
    noise = Math.max(MODEL.minNoise, rows.reduce((s, r) => s + (r.y - predict(fit.theta, r)) ** 2, 0) / (rows.length - 1));
    fit = fitGaussian(rows, priors, noise);
  }
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
    noise: Math.sqrt(noise),
    held,
    items,
    pairs: pairs.map((k) => k.split('|') as [ItemId, ItemId]),
  };
}

// ---- Recommended builds and their value. ----

/**
 * The recommended cores: per phase, greedily the best-scoring item of the phase's tiers given everything already in
 * the build (synergy and component chains count, at most SHOP.maxActives actives), as a Raptor (temperature 0) bot
 * with Seeds to spare would buy. Situational picks are carried from `situational` (they need enemy-flock terms).
 */
export function recommend(scores: ItemScores, catalogue: Catalogue, situational: RecommendedBuild['situational']): RecommendedBuild {
  const chosen: ItemId[] = [];
  const cores: Record<GamePhase, ItemId[]> = { early: [], mid: [], late: [] };
  for (const p of GAME_PHASES) {
    for (let k = 0; k < CORES[p].size; k++) {
      const best = candidates(chosen, p, catalogue)
        .map((id) => ({ id, s: itemScore(scores, id, ownedWithChains(chosen, catalogue), p, new Set()) }))
        .sort((a, b) => b.s - a.s || (a.id < b.id ? -1 : 1))[0];
      if (!best) break;
      chosen.push(best.id);
      cores[p].push(best.id);
    }
  }
  return { ...cores, situational };
}

/** Items a build could add in phase `p`: the phase's tiers, not owned through a chain, within the active cap. */
function candidates(build: readonly ItemId[], p: GamePhase, catalogue: Catalogue): ItemId[] {
  const owned = ownedWithChains(build, catalogue);
  const actives = build.filter((id) => catalogue.get(id)?.active).length;
  return [...catalogue.values()]
    .filter((d) => CORES[p].tiers.includes(d.tier) && !owned.has(d.id) && (!d.active || actives < SHOP.maxActives))
    .map((d) => d.id);
}

const flat = (b: Pick<RecommendedBuild, GamePhase>): { item: ItemId; p: number }[] =>
  GAME_PHASES.flatMap((ph, p) => b[ph].map((item) => ({ item, p })));

/**
 * A build's value beyond its price as a linear function of the model's columns: each item held for its phase's typical
 * share (average + β + δ), and each modelled pair held for the later one's share (γ). Log-odds of contribution.
 */
export function buildGradient(m: HeroModel, b: Pick<RecommendedBuild, GamePhase>): Map<number, number> {
  const ni = m.items.length;
  const g = new Map<number, number>();
  const add = (col: number, v: number): void => void g.set(col, (g.get(col) ?? 0) + v);
  const list = flat(b);
  for (const { item, p } of list) {
    const i = m.items.indexOf(item);
    if (i < 0) continue;
    add(COL.average, m.held[p]!);
    add(COL.beta(i), m.held[p]!);
    add(COL.delta(ni, i, p), m.held[p]!);
  }
  const phaseOfItem = new Map(list.map((x) => [x.item, x.p]));
  for (const [k, [a, c]] of m.pairs.entries()) {
    const pa = phaseOfItem.get(a);
    const pc = phaseOfItem.get(c);
    if (pa !== undefined && pc !== undefined) add(COL.pair(ni, k), m.held[Math.max(pa, pc)]!);
  }
  return g;
}

const dot = (theta: Float64Array, g: Map<number, number>): number => [...g].reduce((s, [c, v]) => s + theta[c]! * v, 0);
function diff(a: Map<number, number>, b: Map<number, number>): Map<number, number> {
  const v = new Map(a);
  for (const [k, x] of b) v.set(k, (v.get(k) ?? 0) - x);
  return v;
}
function se(m: HeroModel, v: Map<number, number>): number {
  const n = m.fit.theta.length;
  let s = 0;
  for (const [i, x] of v) for (const [j, y] of v) s += x * y * m.fit.cov[i * n + j]!;
  return Math.sqrt(Math.max(0, s));
}

/** Point estimate of value(a) − value(b) in win-rate points under `m`. */
export function buildGap(m: HeroModel, a: Pick<RecommendedBuild, GamePhase>, b: Pick<RecommendedBuild, GamePhase>): number {
  return dot(m.fit.theta, diff(buildGradient(m, a), buildGradient(m, b))) * POINTS_PER_LOGODDS;
}

export interface CoreCheck {
  readonly phase: GamePhase;
  /** The explored one-item swap with the highest upper 95% bound on its gain, in win-rate points. */
  readonly worst: { readonly out: ItemId; readonly in: ItemId; readonly gain: number; readonly upper: number } | null;
  /** Alternatives the hero held in fewer than MARGIN.minGames games (not judged yet). */
  readonly unexplored: number;
  /** No explored swap can plausibly gain MARGIN.points or more. */
  readonly settled: boolean;
}

/** D-BAL-005's core test: could swapping one core item for an explored alternative gain ≥ 2 points at 95%? */
export function checkCores(m: HeroModel, b: RecommendedBuild, catalogue: Catalogue): CoreCheck[] {
  const base = buildGradient(m, b);
  return GAME_PHASES.map((p): CoreCheck => {
    let worst: CoreCheck['worst'] = null;
    const unexplored = new Set<ItemId>();
    for (const out of b[p]) {
      const rest = { ...b, [p]: b[p].filter((x) => x !== out) };
      for (const alt of candidates(flat(rest).map((x) => x.item), p, catalogue)) {
        if (alt === out) continue;
        if ((m.bought[alt] ?? 0) < MARGIN.minGames) {
          unexplored.add(alt);
          continue;
        }
        const swapped = { ...b, [p]: b[p].map((x) => (x === out ? alt : x)) };
        const v = diff(buildGradient(m, swapped), base);
        const gain = dot(m.fit.theta, v) * POINTS_PER_LOGODDS;
        const upper = gain + MARGIN.z * se(m, v) * POINTS_PER_LOGODDS;
        if (!worst || upper > worst.upper) worst = { out, in: alt, gain, upper };
      }
    }
    return { phase: p, worst, unexplored: unexplored.size, settled: !worst || worst.upper < MARGIN.points };
  });
}
