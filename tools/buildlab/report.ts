/**
 * Build Lab round outputs: fit every hero, run the convergence tests (D-BAL-002), and write the learned data
 * (src/sim/data/learned/builds.ts), the round's learned.json and docs/balance/report.md.
 */
import type { GamePhase, HeroId, ItemId, ItemScores, PlayerTeam, RecommendedBuild } from '../../src/sim/core/contracts';
import { GAME_PHASES, HERO_IDS } from '../../src/sim/core/contracts';
import { BUILDS } from '../../src/sim/data/builds';
import { HEROES } from '../../src/sim/heroes/registry';
import { CORES, fitHero, gamesOf, outcome, recommend, type Catalogue, type HeroModel, type BuildPick } from './learn';
import type { MatchRecord } from './match';

/** D-BAL-002: when the lab may stop. */
export const CONVERGENCE = {
  minMatches: 1000,
  /** Split-half: Spearman ρ of every hero's base scores, over items it bought this often in each half. */
  splitHalfRho: 0.8,
  minSplitBuys: 5,
  /** Fewer items than this in common: no ρ for that hero. */
  minSplitItems: 5,
  /** Builds: at most this many items of any core change from the previous round. */
  maxCoreChanges: 1,
  /** CIs: a greedy pick is settled when its gap to the runner-up exceeds z·SE, or z·SE is under `equivalent`. */
  z: 1.96,
  equivalent: 0.05,
  /** Share of every hero's picks that must be settled. */
  settledShare: 0.9,
} as const;

/** D-BAL-003: report flags for Stage 5 (reported only). */
export const FLAGS = {
  minGames: 20,
  /** One ability dealing at least this share of its hero's damage to heroes. */
  dominantShare: 0.5,
  /** Casts per minute unlocked below this: rarely cast (ultimates: `rareUltimate`). */
  rareCasts: 0.3,
  rareUltimate: 0.05,
  /** A damaging ability under this share of its hero's damage and under `tinyKp` kill participation. */
  tinyShare: 0.03,
  tinyKp: 0.1,
} as const;

export interface Timing {
  readonly seed: number;
  readonly wallSeconds: number;
  readonly ticks: number;
}
export interface RunLine {
  readonly round: number;
  readonly kind: string;
  readonly matches: number;
  readonly parallel: number;
  readonly elapsedSeconds: number;
}
export interface LearnedRound {
  readonly round: number;
  readonly matches: number;
  readonly seeds: readonly (readonly [number, number])[];
  readonly scores: Partial<Record<HeroId, ItemScores>>;
  readonly builds: Partial<Record<HeroId, RecommendedBuild>>;
}

const Z95 = 1.96;
const MINUTE = 60;
const other = (t: PlayerTeam): PlayerTeam => (t === 'dawn' ? 'dusk' : 'dawn');
const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const mean = (xs: readonly number[]): number => (xs.length ? sum(xs) / xs.length : NaN);
const median = (xs: readonly number[]): number => [...xs].sort((a, b) => a - b)[xs.length >> 1] ?? NaN;
/** Mean and 95% half-width (normal approximation). */
function ci(xs: readonly number[]): { m: number; h: number } {
  const m = mean(xs);
  if (xs.length < 2) return { m, h: NaN };
  const v = sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1);
  return { m, h: Z95 * Math.sqrt(v / xs.length) };
}

/** Spearman's ρ with average ranks for ties. */
export function spearman(a: readonly number[], b: readonly number[]): number {
  const rank = (xs: readonly number[]): number[] => {
    const order = xs.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
    const r = new Array<number>(xs.length);
    for (let i = 0; i < order.length; ) {
      let j = i;
      while (j + 1 < order.length && order[j + 1]![0] === order[i]![0]) j++;
      for (let k = i; k <= j; k++) r[order[k]![1]] = (i + j) / 2;
      i = j + 1;
    }
    return r;
  };
  const ra = rank(a);
  const rb = rank(b);
  const ma = mean(ra);
  const mb = mean(rb);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < ra.length; i++) {
    num += (ra[i]! - ma) * (rb[i]! - mb);
    da += (ra[i]! - ma) ** 2;
    db += (rb[i]! - mb) ** 2;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : NaN;
}

const settled = (p: BuildPick): boolean =>
  p.se === null ? false : p.gap >= CONVERGENCE.z * p.se || CONVERGENCE.z * p.se <= CONVERGENCE.equivalent;

export interface HeroLearning {
  readonly model: HeroModel | null;
  readonly build: RecommendedBuild;
  readonly picks: readonly BuildPick[];
  /** Split-half ρ, or null with too little data. */
  readonly rho: number | null;
  /** Items changed per core since the previous round. */
  readonly changes: Readonly<Record<GamePhase, number>>;
}

/** Fit every hero on `matches`, with the split-half and build-change tests. */
export function learnRound(
  matches: readonly MatchRecord[],
  catalogue: Catalogue,
  prevBuilds: Partial<Record<HeroId, RecommendedBuild>>,
): Map<HeroId, HeroLearning> {
  const out = new Map<HeroId, HeroLearning>();
  const halves = [matches.filter((m) => m.seed % 2 === 1), matches.filter((m) => m.seed % 2 === 0)];
  for (const hero of HERO_IDS) {
    const prior = BUILDS.scores[hero];
    const situational = BUILDS.builds[hero]?.situational ?? [];
    if (!prior) continue;
    const games = gamesOf(matches, hero, catalogue);
    const model = games.length ? fitHero(hero, games, prior, catalogue) : null;
    const { build, picks } = recommend(model?.scores ?? prior, catalogue, situational, model ?? undefined);
    let rho: number | null = null;
    if (model) {
      const [a, b] = halves.map((h) => fitHero(hero, gamesOf(h, hero, catalogue), prior, catalogue)) as [HeroModel, HeroModel];
      const items = model.items.filter((id) => (a.bought[id] ?? 0) >= CONVERGENCE.minSplitBuys && (b.bought[id] ?? 0) >= CONVERGENCE.minSplitBuys);
      if (items.length >= CONVERGENCE.minSplitItems) {
        rho = spearman(items.map((id) => a.scores.base[id] ?? 0), items.map((id) => b.scores.base[id] ?? 0));
      }
    }
    const prev = prevBuilds[hero];
    const changes = Object.fromEntries(GAME_PHASES.map((p) => [p, prev ? build[p].filter((id) => !prev[p].includes(id)).length : CORES[p].size])) as
      Record<GamePhase, number>;
    out.set(hero, { model, build, picks, rho, changes });
  }
  return out;
}

const fmt = (n: number, d = 2): string => (Number.isFinite(n) ? n.toFixed(d) : '–');
const pct = (n: number): string => (Number.isFinite(n) ? `${Math.round(n * 100)}%` : '–');
const ranges = (seeds: readonly number[]): [number, number][] => {
  const byRound = new Map<number, number[]>();
  for (const s of seeds) {
    const r = Math.floor(s / 1e6);
    byRound.set(r, [...(byRound.get(r) ?? []), s]);
  }
  return [...byRound.values()].map((xs) => [Math.min(...xs), Math.max(...xs)]);
};

/** The generated sim data file: deterministic (no dates), one hero per line. */
export function learnedSource(l: LearnedRound, minutes: readonly number[], difficulty: string): string {
  const lines = (o: Partial<Record<HeroId, unknown>>): string =>
    HERO_IDS.filter((h) => o[h]).map((h) => `    ${JSON.stringify(h)}: ${JSON.stringify(o[h])},`).join('\n');
  const seeds = l.seeds.map(([a, b]) => `${a}–${b}`).join(', ');
  return `/**
 * GENERATED by the Build Lab (tools/buildlab, D-BAL-001..003). Do not edit; rerun \`npx tsx tools/buildlab/run.ts\`.
 * Round ${l.round} · ${l.matches} matches · seeds ${seeds} · match cap ${minutes.join('/')} min · ${difficulty} bots.
 * Heroes without games keep the designer prior (round 0). src/sim/data/builds.ts switches to this in W6.
 */
import type { BuildData } from '../../core/contracts';

export const LEARNED_BUILDS: BuildData = {
  round: ${l.round},
  matches: ${l.matches},
  phases: ${JSON.stringify(BUILDS.phases)},
  scores: {
${lines(l.scores)}
  },
  builds: {
${lines(l.builds)}
  },
};
`;
}

export interface ReportInput {
  readonly round: number;
  readonly matches: readonly MatchRecord[];
  readonly duels: readonly { readonly kind: string; readonly matches: readonly MatchRecord[] }[];
  readonly learned: ReadonlyMap<HeroId, HeroLearning>;
  readonly timings: readonly Timing[];
  readonly runs: readonly RunLine[];
  readonly catalogue: Catalogue;
}

/** Mean result of the flock using `side` (a policy test) against the other, with a 95% CI. */
function heldOut(matches: readonly MatchRecord[], side: (m: MatchRecord) => PlayerTeam | null): { text: string; better: boolean } {
  const ys = matches.flatMap((m) => {
    const t = side(m);
    return t ? [outcome(m, t)] : [];
  });
  const { m, h } = ci(ys);
  const better = ys.length >= 2 && m - h > 0.5;
  const verdict = ys.length < 2 ? 'too few' : better ? 'better (p < 0.05)' : m + h < 0.5 ? 'worse (p < 0.05)' : 'no significant difference';
  return { text: `${ys.length} matches, mean result ${fmt(m, 3)} ± ${fmt(h, 3)}: ${verdict}`, better };
}

export function reportMarkdown(r: ReportInput): string {
  const name = (h: HeroId): string => HEROES[h].def.name;
  const itemName = (id: ItemId): string => r.catalogue.get(id)?.name ?? id;
  const seeds = ranges(r.matches.map((m) => m.seed));
  const decided = r.matches.filter((m) => m.winner).length;
  const caps = [...new Set(r.matches.map((m) => m.minutes))].sort((a, b) => a - b);
  const difficulty = [...new Set(r.matches.map((m) => m.difficulty))].join('/');
  const out: string[] = [];
  const push = (...s: string[]): void => void out.push(...s);

  // ---- Convergence. ----
  const heroes = [...r.learned].filter(([, l]) => l.model);
  const rhos = heroes.map(([, l]) => l.rho);
  const withRho = rhos.filter((x): x is number => x !== null);
  const rhoPass = withRho.length === heroes.length && withRho.every((x) => x >= CONVERGENCE.splitHalfRho);
  const corePass = heroes.every(([, l]) => GAME_PHASES.every((p) => l.changes[p] <= CONVERGENCE.maxCoreChanges));
  const shares = heroes.map(([, l]) => l.picks.filter(settled).length / Math.max(1, l.picks.length));
  const ciPass = shares.every((s) => s >= CONVERGENCE.settledShare);
  const enough = r.matches.length >= CONVERGENCE.minMatches;
  const yes = (b: boolean): string => (b ? 'pass' : '**not yet**');
  const explore = heldOut(r.matches, (m) => (m.policy.dawn.kind !== m.policy.dusk.kind ? (m.policy.dawn.kind === 'scores' ? 'dawn' : 'dusk') : null));
  const duels = ['prev', 'random'].map((kind) => {
    const d = r.duels.find((x) => x.kind === kind);
    const rival = kind === 'prev' ? `round ${r.round - 1}` : 'random buying';
    if (!d) return { kind, better: false, line: `- Duel, round ${r.round} vs ${rival}: not run yet (\`--duel ${kind}\`).` };
    const h = heldOut(d.matches, (m) => (m.policy.dawn.kind === 'scores' && m.policy.dawn.round === r.round ? 'dawn' : 'dusk'));
    return { kind, better: h.better, line: `- Duel, round ${r.round} vs ${rival}: ${h.text}.` };
  });

  push(
    '# Build Lab balance report',
    '',
    `Generated by \`tools/buildlab\` (D-BAL-001..003) from round ${r.round}: ${r.matches.length} training matches, seeds ` +
      `${seeds.map(([a, b]) => `${a}–${b}`).join(', ')}, ${difficulty} bots, match cap ${caps.join('/')} min. ${decided} of ` +
      `${r.matches.length} matches were decided; the rest score by the net-worth proxy (D-BAL-001). Regenerate with ` +
      '`npx tsx tools/buildlab/run.ts --round N --learn-only`.',
    '',
    '## Convergence (D-EP-037, D-BAL-002)',
    '',
    '| Test | Value | Needed | State |',
    '|---|---|---|---|',
    `| Matches | ${r.matches.length} | ≥ ${CONVERGENCE.minMatches} | ${yes(enough)} |`,
    `| Split-half item ranks (Spearman ρ, odd vs even seeds) | median ${fmt(median(withRho))}, ` +
      `min ${fmt(Math.min(...withRho))}; ${withRho.length} of ${heroes.length} heroes have enough items | every hero ≥ ${CONVERGENCE.splitHalfRho} | ${yes(rhoPass)} |`,
    `| Cores vs round ${r.round - 1} | ${heroes.filter(([, l]) => GAME_PHASES.every((p) => l.changes[p] <= CONVERGENCE.maxCoreChanges)).length} of ${heroes.length} heroes within ` +
      `${CONVERGENCE.maxCoreChanges} change per core | every hero | ${yes(corePass)} |`,
    `| Settled picks (gap > ${CONVERGENCE.z}·SE or a tie within ${CONVERGENCE.equivalent}) | median ${pct(median(shares))}, ` +
      `min ${pct(Math.min(...shares))} | every hero ≥ ${pct(CONVERGENCE.settledShare)} | ${yes(ciPass)} |`,
    `| Held-out duels (newest scores vs round ${r.round - 1} and vs random) | ${duels.filter((d) => d.better).length} of 2 better | ` +
      `both, p < 0.05 | ${yes(duels.every((d) => d.better))} |`,
    '',
    'Held-out policy tests (one observation per match: the mean result of the named flock, 95% CI):',
    '',
    `- Scored flock vs a random-buying flock in training matches (round ${r.round - 1} scores and earlier): ${explore.text}.`,
    ...duels.map((d) => d.line),
    '',
  );

  // ---- Timings. ----
  const wall = sum(r.timings.map((t) => t.wallSeconds));
  const ticks = sum(r.timings.map((t) => t.ticks));
  push(
    '## Runs and timings',
    '',
    '| Round | Kind | Matches | Parallel | Elapsed |',
    '|---|---|---|---|---|',
    ...r.runs.map((x) => `| ${x.round} | ${x.kind} | ${x.matches} | ${x.parallel} | ${fmt(x.elapsedSeconds / MINUTE, 1)} min |`),
    '',
    `${r.timings.length} matches timed: ${fmt(wall / MINUTE, 1)} process-minutes, ${fmt(wall / Math.max(1, r.timings.length), 0)} s a match, ` +
      `${fmt(ticks / Math.max(1, wall), 0)} ticks/s per process (60 ticks a game second) on a machine shared with other agents.`,
    '',
  );

  // ---- Heroes. ----
  push(
    '## Heroes',
    '',
    'Result: the flock\'s result with this hero (1 win, 0 loss, else the net-worth proxy), mean ± 95% CI. Damage share: of ' +
      'its flock\'s damage to heroes. Damage split: gun / abilities / melee / items, of its own damage to heroes.',
    '',
    '| Hero | Games | W–L | Result | K / D / A | Damage share | Seeds/min | Damage split | Flag |',
    '|---|---|---|---|---|---|---|---|---|',
  );
  const flags: string[] = [];
  for (const hero of HERO_IDS) {
    const games = r.matches.flatMap((m) => m.heroes.filter((h) => h.hero === hero).map((h) => ({ m, h })));
    if (!games.length) {
      push(`| ${name(hero)} | 0 | | | | | | | no games${HEROES[hero].implemented ? '' : ' (not implemented)'}; designer prior |`);
      continue;
    }
    const res = ci(games.map(({ m, h }) => outcome(m, h.team)));
    const w = games.filter(({ m, h }) => m.winner === h.team).length;
    const l = games.filter(({ m, h }) => m.winner === other(h.team)).length;
    const per = (f: (x: (typeof games)[number]) => number): string => fmt(mean(games.map(f)), 1);
    const share = mean(games.map(({ m, h }) => h.dmgHeroes / Math.max(1, sum(m.heroes.filter((x) => x.team === h.team).map((x) => x.dmgHeroes)))));
    const spm = mean(games.map(({ m, h }) => h.netWorth / (m.seconds / MINUTE)));
    const dmg = sum(games.map(({ h }) => h.dmgHeroes)) || 1;
    const by = (k: 'weapon' | 'ability' | 'melee' | 'item'): string => pct(sum(games.map(({ h }) => h.dmgBy[k])) / dmg);
    let flag = '';
    if (games.length >= FLAGS.minGames && res.m - res.h > 0.5) flag = 'strong (CI above 0.5)';
    if (games.length >= FLAGS.minGames && res.m + res.h < 0.5) flag = 'weak (CI below 0.5)';
    if (flag) flags.push(`- **${name(hero)}**: ${flag}, result ${fmt(res.m, 3)} ± ${fmt(res.h, 3)} over ${games.length} games.`);
    push(
      `| ${name(hero)} | ${games.length} | ${w}–${l} | ${fmt(res.m, 3)} ± ${fmt(res.h, 3)} | ${per(({ h }) => h.k)} / ${per(({ h }) => h.d)} / ` +
        `${per(({ h }) => h.a)} | ${pct(share)} | ${fmt(spm, 0)} | ${by('weapon')} / ${by('ability')} / ${by('melee')} / ${by('item')} | ${flag} |`,
    );
  }
  push('');

  // ---- Abilities. ----
  push(
    '## Abilities',
    '',
    'Casts per minute after unlock; damage to heroes per game; value share: of the hero\'s damage to heroes; KP: share of ' +
      'the hero\'s kill participations (kills + assists) where the ability hit the victim in the 12 s assist window; KB: ' +
      'killing blows. Healing, shields and crowd control are not attributed to abilities yet (Interface requests).',
    '',
    '| Hero | Ability | Casts/min | Damage/game | Value share | KP | KB | Flag |',
    '|---|---|---|---|---|---|---|---|',
  );
  for (const hero of HERO_IDS) {
    const games = r.matches.flatMap((m) => m.heroes.filter((h) => h.hero === hero).map((h) => ({ m, h })));
    if (!games.length) continue;
    const dmg = sum(games.map(({ h }) => h.dmgHeroes));
    const parts = sum(games.map(({ h }) => h.k + h.a));
    for (const [slot, def] of HEROES[hero].def.abilities.entries()) {
      const recs = games.map(({ m, h }) => ({ m, h, a: h.abilities[def.id] }));
      const casts = sum(recs.map((x) => x.a?.casts ?? 0));
      const unlockedMin = sum(recs.map(({ m, h }) => {
        const at = h.ups.find(([, s, t]) => s === slot && t === 0)?.[0];
        return at === undefined ? 0 : (m.seconds - at) / MINUTE;
      }));
      const d = sum(recs.map((x) => x.a?.dmgHeroes ?? 0));
      const dOther = sum(recs.map((x) => x.a?.dmgOther ?? 0));
      const kp = sum(recs.map((x) => x.a?.kp ?? 0));
      const kb = sum(recs.map((x) => x.a?.kills ?? 0));
      const rate = unlockedMin > 0 ? casts / unlockedMin : NaN;
      const share = dmg > 0 ? d / dmg : NaN;
      const kpShare = parts > 0 ? kp / parts : NaN;
      const ult = slot === HEROES[hero].def.abilities.length - 1;
      let flag = '';
      if (games.length >= FLAGS.minGames) {
        if (share >= FLAGS.dominantShare) flag = 'dominant: most of the kit\'s damage';
        else if (unlockedMin > 0 && rate < (ult ? FLAGS.rareUltimate : FLAGS.rareCasts)) flag = 'rarely cast';
        else if (d + dOther > 0 && share < FLAGS.tinyShare && kpShare < FLAGS.tinyKp) flag = 'tiny effect';
        else if (d + dOther === 0 && casts > 0) flag = 'utility: value not measured';
      }
      if (flag && !flag.startsWith('utility')) flags.push(`- **${name(hero)} · ${def.name}**: ${flag} (value share ${pct(share)}, ${fmt(rate)} casts/min, KP ${pct(kpShare)}).`);
      push(`| ${name(hero)} | ${def.name} | ${fmt(rate)} | ${fmt(d / games.length, 0)} | ${pct(share)} | ${pct(kpShare)} | ${kb} | ${flag} |`);
    }
  }
  push('');

  // ---- Builds. ----
  push(
    '## Recommended builds',
    '',
    'Greedy cores from the learned scores (D-BAL-001): four T1 early, four T2–3 mid, three T4 late, synergy and component ' +
      'chains counted, at most four actives. Settled: picks whose lead over the runner-up is outside the 95% CI. ' +
      'Situational picks are the designer\'s until the model sees the enemy flock (Phase B).',
    '',
    '| Hero | Games | Early | Mid | Late | Settled | ρ | Changed |',
    '|---|---|---|---|---|---|---|---|',
  );
  for (const [hero, l] of r.learned) {
    const list = (p: GamePhase): string => l.build[p].map(itemName).join(', ');
    const s = l.picks.filter(settled).length;
    push(
      `| ${name(hero)} | ${l.model?.games ?? 0} | ${list('early')} | ${list('mid')} | ${list('late')} | ${s}/${l.picks.length} | ` +
        `${l.rho === null ? '–' : fmt(l.rho)} | ${GAME_PHASES.map((p) => l.changes[p]).join('/')} |`,
    );
  }
  push(
    '',
    '## Flagged for Stage 5 review',
    '',
    'Reported only (D-EP-043, D-EP-045): Stage 5 checks each against bot competence and ablation before any change.',
    '',
    ...(flags.length ? flags : ['- Nothing reaches the flag thresholds yet.']),
    '',
    '## What the data can\'t tell yet',
    '',
    `- **Real wins.** ${r.matches.length - decided} of ${r.matches.length} matches ended undecided at the cap, so results ` +
      'are mostly the net-worth proxy. Bot AI is making matches end (W5); Phase B runs full-length matches.',
    '- **Healing, shields and crowd control per ability.** `heal.applied` and statuses carry no ability id, so support ' +
      'and control abilities show only casts. Abilities with no damage are listed as "utility: value not measured".',
    '- **Item value at this sample size.** Most item scores are still the designer prior: the posterior moves away from ' +
      'it only where an item was held often. See the settled-pick and split-half rows above.',
    '- **Situational picks and enemy-dependent value** (vs healers, vs divers): the model has no enemy-flock terms yet.',
    '- **Ability win-rate effects and ablations** (D-EP-043): need paired runs with an ability disabled (Stage 5).',
    '- **Heroes not yet implemented** (no games): they keep the designer prior.',
    '- **Bot competence:** bots cast by use rules; "rarely cast" can mean the bot rarely finds a use, not that the ability is weak.',
    '',
  );
  return out.join('\n');
}
