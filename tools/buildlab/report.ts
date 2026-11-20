/**
 * Build Lab round outputs: fit every hero, run the convergence tests (D-BAL-005), and write the learned data
 * (src/sim/data/learned/builds.ts), the round's learned.json and docs/balance/report.md.
 */
import type { GamePhase, HeroId, ItemId, ItemScores, PlayerTeam, RecommendedBuild } from '../../src/sim/core/contracts';
import { HERO_IDS } from '../../src/sim/core/contracts';
import { SHOP } from '../../src/sim/data/ai';
import { BUILDS } from '../../src/sim/data/builds';
import { STARTER_SCORES } from '../../src/sim/data/item-scores';
import { HEROES } from '../../src/sim/heroes/registry';
import {
  MARGIN,
  POINTS_PER_LOGODDS,
  STATS,
  buildGap,
  checkCores,
  contributionModel,
  contributions,
  fitHero,
  gamesOf,
  outcome,
  recommend,
  type Catalogue,
  type Contribution,
  type CoreCheck,
  type HeroModel,
} from './learn';
import type { MatchRecord } from './match';

/** D-BAL-005: when the lab may stop. */
export const CONVERGENCE = { minMatches: 1000 } as const;

/** D-BAL-003: report flags (reported only). */
export const FLAGS = {
  minGames: 20,
  /** One ability giving at least this share of its hero's value (damage to heroes, healing and shields). */
  dominantShare: 0.5,
  /** Casts per minute unlocked below this: rarely cast (ultimates: `rareUltimate`). */
  rareCasts: 0.3,
  rareUltimate: 0.05,
  /** Under this share of the value, this kill participation and this many statuses on enemies a game. */
  tinyShare: 0.03,
  tinyKp: 0.1,
  tinyStatuses: 1,
} as const;

/** The designer prior every round is centred on (round 0), and its situational picks. */
export const PRIOR_SCORES = STARTER_SCORES as Readonly<Partial<Record<HeroId, ItemScores>>>;
const situationalOf = (h: HeroId): RecommendedBuild['situational'] => BUILDS.builds[h]?.situational ?? [];

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
const PERCENT = 100;
const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const mean = (xs: readonly number[]): number => (xs.length ? sum(xs) / xs.length : NaN);
const median = (xs: readonly number[]): number => [...xs].sort((a, b) => a - b)[xs.length >> 1] ?? NaN;
const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));
/** Mean and 95% half-width (normal approximation). */
function ci(xs: readonly number[]): { m: number; h: number } {
  const m = mean(xs);
  if (xs.length < 2) return { m, h: NaN };
  const v = sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1);
  return { m, h: Z95 * Math.sqrt(v / xs.length) };
}

export interface HeroLearning {
  readonly model: HeroModel | null;
  readonly build: RecommendedBuild;
  readonly cores: readonly CoreCheck[];
  /** How much worse (win-rate points, full model) the worse half's build is than the full build; null without data. */
  readonly halfGap: number | null;
  /** How much worse the previous round's build is, under this round's model; null without one. */
  readonly roundGap: number | null;
}

/** Fit every hero on `matches`, with the core, split-half and between-round tests (D-BAL-005). */
export function learnRound(
  matches: readonly MatchRecord[],
  catalogue: Catalogue,
  prevBuilds: Partial<Record<HeroId, RecommendedBuild>>,
): { heroes: Map<HeroId, HeroLearning>; contribution: Contribution } {
  const contribution = contributionModel(matches);
  const halves = [matches.filter((m) => m.seed % 2 === 1), matches.filter((m) => m.seed % 2 === 0)];
  const heroes = new Map<HeroId, HeroLearning>();
  for (const hero of HERO_IDS) {
    const prior = PRIOR_SCORES[hero];
    if (!prior) continue;
    const games = gamesOf(matches, hero, catalogue, contribution);
    const model = games.length ? fitHero(hero, games, prior, catalogue) : null;
    const build = recommend(model?.scores ?? prior, catalogue, situationalOf(hero));
    let halfGap: number | null = null;
    let roundGap: number | null = null;
    let cores: CoreCheck[] = [];
    if (model) {
      cores = checkCores(model, build, catalogue);
      halfGap = Math.max(...halves.map((h) => {
        const half = fitHero(hero, gamesOf(h, hero, catalogue, contribution), prior, catalogue);
        return buildGap(model, build, recommend(half.scores, catalogue, []));
      }));
      const prev = prevBuilds[hero];
      if (prev) roundGap = buildGap(model, build, prev);
    }
    heroes.set(hero, { model, build, cores, halfGap, roundGap });
  }
  return { heroes, contribution };
}

const fmt = (n: number, d = 2): string => (Number.isFinite(n) ? n.toFixed(d) : '–');
const pct = (n: number): string => (Number.isFinite(n) ? `${Math.round(n * PERCENT)}%` : '–');
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
 * GENERATED by the Build Lab (tools/buildlab, D-BAL-001..005). Do not edit; rerun \`npx tsx tools/buildlab/run.ts\`.
 * Round ${l.round} · ${l.matches} matches · seeds ${seeds} · match cap ${minutes.join('/')} min · ${difficulty} bots.
 * Heroes without games keep the designer prior (round 0). docs/balance/report.md has the evidence.
 */
import type { BuildData } from '../../core/contracts';

export const LEARNED_BUILDS: BuildData = {
  round: ${l.round},
  matches: ${l.matches},
  phases: ${JSON.stringify({ midFromS: SHOP.midFromS, lateFromS: SHOP.lateFromS })},
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
  readonly contribution: Contribution;
  readonly timings: readonly Timing[];
  readonly runs: readonly RunLine[];
  readonly catalogue: Catalogue;
}

/** The flock's chance to win from its stats (the contribution model), not from who happened to win. */
function predicted(m: MatchRecord, team: PlayerTeam, model: Contribution): number {
  const c = contributions(m, model);
  const z = model.w[0]! + sum(m.heroes.map((h, i) => (h.team === 'dawn' ? 1 : -1) * c[i]!));
  return team === 'dawn' ? sigmoid(z) : 1 - sigmoid(z);
}

/** A policy test: the named flock's wins and predicted wins, with 95% CIs. */
function heldOut(matches: readonly MatchRecord[], side: (m: MatchRecord) => PlayerTeam | null, model: Contribution) {
  const pairs = matches.flatMap((m) => {
    const t = side(m);
    const win = t ? outcome(m, t) : null;
    return t && win !== null ? [{ win, p: predicted(m, t, model) }] : [];
  });
  const wins = ci(pairs.map((x) => x.win));
  const pred = ci(pairs.map((x) => x.p));
  const n = pairs.length;
  return {
    n,
    better: n >= 2 && wins.m - wins.h > 0.5,
    notWorse: n >= 2 && pred.m - pred.h > 0.5 - MARGIN.points / PERCENT,
    text: `${n} matches: won ${pct(wins.m)} ± ${fmt(wins.h * PERCENT, 1)} points; predicted from stats ${pct(pred.m)} ± ${fmt(pred.h * PERCENT, 1)}`,
  };
}

export function reportMarkdown(r: ReportInput): string {
  const name = (h: HeroId): string => HEROES[h].def.name;
  const itemName = (id: ItemId): string => r.catalogue.get(id)?.name ?? id;
  const seeds = ranges(r.matches.map((m) => m.seed));
  const decidedMatches = r.matches.filter((m) => m.winner);
  const caps = [...new Set(r.matches.map((m) => m.minutes))].sort((a, b) => a - b);
  const difficulty = [...new Set(r.matches.map((m) => m.difficulty))].join('/');
  const lengths = decidedMatches.map((m) => m.seconds / MINUTE);
  const out: string[] = [];
  const push = (...s: string[]): void => void out.push(...s);
  const yes = (b: boolean): string => (b ? 'pass' : '**not yet**');

  // ---- Convergence. ----
  const heroes = [...r.learned].filter(([, l]) => l.model);
  const cores = heroes.flatMap(([, l]) => l.cores);
  const settledCores = cores.filter((c) => c.settled).length;
  const halfGaps = heroes.map(([, l]) => l.halfGap ?? Infinity);
  const roundGaps = heroes.map(([, l]) => l.roundGap ?? Infinity);
  const enough = decidedMatches.length >= CONVERGENCE.minMatches;
  const scoredSide = (m: MatchRecord): PlayerTeam | null =>
    m.policy.dawn.kind !== m.policy.dusk.kind ? (m.policy.dawn.kind === 'scores' ? 'dawn' : 'dusk') : null;
  const explore = heldOut(r.matches, scoredSide, r.contribution);
  const newest = (m: MatchRecord): PlayerTeam => (m.policy.dawn.kind === 'scores' && m.policy.dawn.round === r.round ? 'dawn' : 'dusk');
  const duel = (kind: string) => {
    const d = r.duels.find((x) => x.kind === kind);
    return d ? heldOut(d.matches, newest, r.contribution) : null;
  };
  const vsRandom = duel('random');
  const vsPrev = duel('prev');
  const w = r.contribution.w;

  push(
    '# Build Lab balance report',
    '',
    `Generated by \`tools/buildlab\` (D-BAL-001..005) from round ${r.round}: ${r.matches.length} training matches, seeds ` +
      `${seeds.map(([a, b]) => `${a}–${b}`).join(', ')}, ${difficulty} bots, match cap ${caps.join('/')} min. ` +
      `${decidedMatches.length} were decided (${fmt(Math.min(...lengths), 1)}–${fmt(Math.max(...lengths), 1)} min, median ` +
      `${fmt(median(lengths), 1)}); only decided matches are used. Regenerate with \`npx tsx tools/buildlab/run.ts --round N --learn-only\`.`,
    '',
    '## Convergence (D-EP-037, D-EP-049, D-BAL-005)',
    '',
    `Practical margin: ${MARGIN.points} win-rate points. Values are win-rate points from the contribution model (below).`,
    '',
    '| Test | Value | Needed | State |',
    '|---|---|---|---|',
    `| Decided training matches | ${decidedMatches.length} | ≥ ${CONVERGENCE.minMatches} | ${yes(enough)} |`,
    `| Cores settled: no explored one-item swap gains ≥ ${MARGIN.points} points at 95% | ${settledCores} of ${cores.length} cores | every core | ${yes(settledCores === cores.length)} |`,
    `| Halves agree: the worse half's build vs the full build | worst ${fmt(Math.max(...halfGaps), 2)}, median ${fmt(median(halfGaps), 2)} points | every hero < ${MARGIN.points} | ${yes(halfGaps.every((g) => g < MARGIN.points))} |`,
    `| Rounds agree: round ${r.round - 1}'s build vs this round's | worst ${fmt(Math.max(...roundGaps), 2)}, median ${fmt(median(roundGaps), 2)} points | every hero < ${MARGIN.points} | ${yes(roundGaps.every((g) => g < MARGIN.points))} |`,
    `| Duel vs random buying (wins) | ${vsRandom ? vsRandom.text : 'not run'} | better, p < 0.05 | ${yes(!!vsRandom?.better)} |`,
    `| Duel vs round ${r.round - 1} (predicted from stats) | ${vsPrev ? vsPrev.text : 'not run'} | not worse by ${MARGIN.points} points at 95% | ${yes(!!vsPrev?.notWorse)} |`,
    '',
    `Scored flocks against random-buying flocks inside the training matches (exploration, earlier rounds' scores): ${explore.text}.`,
    `Unexplored alternatives (held in fewer than ${MARGIN.minGames} of a hero's games, not judged yet): median ` +
      `${fmt(median(cores.map((c) => c.unexplored)), 0)} per core.`,
    '',
    '### The contribution measure',
    '',
    `Fitted on ${r.contribution.matches} decided matches; the stats model names the winner in ${pct(r.contribution.accuracy)} of them. ` +
      'A hero\'s contribution is Σ w·(its share of the match total − 1/12), in win log-odds; ×25 gives win-rate points.',
    '',
    `| ${STATS.join(' | ')} | Dawn side |`,
    `|${STATS.map(() => '---|').join('')}---|`,
    `| ${STATS.map((_, k) => fmt(w[k + 1]!, 2)).join(' | ')} | ${fmt(w[0]!, 2)} |`,
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
    `${r.timings.length} matches timed: ${fmt(wall / MINUTE / MINUTE, 1)} process-hours, ${fmt(wall / Math.max(1, r.timings.length), 0)} s a match, ` +
      `${fmt(ticks / Math.max(1, wall), 0)} ticks/s per process (60 ticks a game second) on a machine shared with other agents.`,
    '',
  );

  // ---- Heroes. ----
  push(
    '## Heroes',
    '',
    'Decided games only. Win rate ± 95% CI; contribution: mean win-rate points the hero adds to its flock by its stat ' +
      'shares (above). Damage share: of its flock\'s damage to heroes. Damage split: gun / abilities / melee / items. ' +
      'Support: healing and shields given a game.',
    '',
    '| Hero | Games | Win rate | Contribution | K / D / A | Damage share | Seeds/min | Damage split | Support | Flag |',
    '|---|---|---|---|---|---|---|---|---|---|',
  );
  const flags: string[] = [];
  const gamesOfHero = (hero: HeroId) =>
    decidedMatches.flatMap((m) => {
      const c = contributions(m, r.contribution);
      return m.heroes.flatMap((h, i) => (h.hero === hero ? [{ m, h, c: c[i]! }] : []));
    });
  for (const hero of HERO_IDS) {
    const games = gamesOfHero(hero);
    if (!games.length) {
      push(`| ${name(hero)} | 0 | | | | | | | | no games; designer prior |`);
      continue;
    }
    const res = ci(games.map(({ m, h }) => outcome(m, h.team) ?? 0));
    const con = ci(games.map((g) => g.c * POINTS_PER_LOGODDS));
    const per = (f: (x: (typeof games)[number]) => number, d = 1): string => fmt(mean(games.map(f)), d);
    const share = mean(games.map(({ m, h }) => h.dmgHeroes / Math.max(1, sum(m.heroes.filter((x) => x.team === h.team).map((x) => x.dmgHeroes)))));
    const spm = mean(games.map(({ m, h }) => h.netWorth / (m.seconds / MINUTE)));
    const dmg = sum(games.map(({ h }) => h.dmgHeroes)) || 1;
    const by = (k: 'weapon' | 'ability' | 'melee' | 'item'): string => pct(sum(games.map(({ h }) => h.dmgBy[k])) / dmg);
    let flag = '';
    if (games.length >= FLAGS.minGames && res.m - res.h > 0.5) flag = 'strong (CI above 50%)';
    if (games.length >= FLAGS.minGames && res.m + res.h < 0.5) flag = 'weak (CI below 50%)';
    if (flag) flags.push(`- **${name(hero)}**: ${flag}, ${pct(res.m)} ± ${fmt(res.h * PERCENT, 1)} points over ${games.length} games.`);
    push(
      `| ${name(hero)} | ${games.length} | ${pct(res.m)} ± ${fmt(res.h * PERCENT, 1)} | ${fmt(con.m, 1)} ± ${fmt(con.h, 1)} | ` +
        `${per(({ h }) => h.k)} / ${per(({ h }) => h.d)} / ${per(({ h }) => h.a)} | ${pct(share)} | ${fmt(spm, 0)} | ` +
        `${by('weapon')} / ${by('ability')} / ${by('melee')} / ${by('item')} | ${per(({ h }) => h.healing + h.shielding, 0)} | ${flag} |`,
    );
  }
  push('');

  // ---- Abilities. ----
  push(
    '## Abilities',
    '',
    'Casts per minute after unlock; per game: damage to heroes, healing and shields given, statuses put on enemy heroes. ' +
      'Value share: the ability\'s damage to heroes plus healing and shields, of the hero\'s. KP: share of the hero\'s kill ' +
      'participations where the ability hit the victim in the 12 s assist window. KB: killing blows.',
    '',
    '| Hero | Ability | Casts/min | Damage | Heal | Shield | Statuses | Value share | KP | KB | Flag |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  );
  for (const hero of HERO_IDS) {
    const games = gamesOfHero(hero);
    if (!games.length) continue;
    const value = sum(games.map(({ h }) => h.dmgHeroes + h.healing + h.shielding));
    const parts = sum(games.map(({ h }) => h.k + h.a));
    for (const [slot, def] of HEROES[hero].def.abilities.entries()) {
      const recs = games.map(({ m, h }) => ({ m, h, a: h.abilities[def.id] }));
      const tot = (f: (a: NonNullable<(typeof recs)[number]['a']>) => number): number => sum(recs.map((x) => (x.a ? f(x.a) : 0)));
      const casts = tot((a) => a.casts);
      const unlockedMin = sum(recs.map(({ m, h }) => {
        const at = h.ups.find(([, s, t]) => s === slot && t === 0)?.[0];
        return at === undefined ? 0 : (m.seconds - at) / MINUTE;
      }));
      const d = tot((a) => a.dmgHeroes);
      const heal = tot((a) => a.heal);
      const shield = tot((a) => a.shield);
      const statuses = tot((a) => a.statuses);
      const dOther = tot((a) => a.dmgOther);
      const kp = tot((a) => a.kp);
      const kb = tot((a) => a.kills);
      const n = games.length;
      const rate = unlockedMin > 0 ? casts / unlockedMin : NaN;
      const share = value > 0 ? (d + heal + shield) / value : NaN;
      const kpShare = parts > 0 ? kp / parts : NaN;
      const ult = slot === HEROES[hero].def.abilities.length - 1;
      let flag = '';
      if (n >= FLAGS.minGames) {
        if (share >= FLAGS.dominantShare) flag = 'dominant: most of the kit\'s value';
        else if (unlockedMin > 0 && rate < (ult ? FLAGS.rareUltimate : FLAGS.rareCasts)) flag = 'rarely cast';
        else if (d + dOther + heal + shield > 0 && share < FLAGS.tinyShare && kpShare < FLAGS.tinyKp && statuses / n < FLAGS.tinyStatuses) flag = 'tiny effect';
        else if (d + dOther + heal + shield + statuses === 0 && casts > 0) flag = 'utility: value not measured';
      }
      if (flag && !flag.startsWith('utility')) {
        flags.push(`- **${name(hero)} · ${def.name}**: ${flag} (value share ${pct(share)}, ${fmt(rate)} casts/min, KP ${pct(kpShare)}, ${fmt(statuses / n, 1)} statuses a game).`);
      }
      push(
        `| ${name(hero)} | ${def.name} | ${fmt(rate)} | ${fmt(d / n, 0)} | ${fmt(heal / n, 0)} | ${fmt(shield / n, 0)} | ${fmt(statuses / n, 1)} | ` +
          `${pct(share)} | ${pct(kpShare)} | ${kb} | ${flag} |`,
      );
    }
  }
  push('');

  // ---- Builds. ----
  push(
    '## Recommended builds',
    '',
    'Greedy cores from the learned scores: four T1 early, four T2–3 mid, three T4 late, synergy and component chains ' +
      `counted, at most four actives. Cores: ✓ when no explored one-item swap could gain ${MARGIN.points} points at 95%, else ` +
      'the riskiest swap and its upper bound. Halves and rounds: win-rate points lost by the other build. Situational ' +
      'picks are the designer\'s (the model has no enemy-flock terms).',
    '',
    '| Hero | Games | Early | Mid | Late | Cores (early / mid / late) | Unexplored | Halves | Rounds |',
    '|---|---|---|---|---|---|---|---|---|',
  );
  for (const [hero, l] of r.learned) {
    const list = (p: GamePhase): string => l.build[p].map(itemName).join(', ');
    const core = l.cores.map((c) => (c.settled ? '✓' : `${itemName(c.worst!.out)} → ${itemName(c.worst!.in)} ≤ +${fmt(c.worst!.upper, 1)}`)).join(' / ');
    push(
      `| ${name(hero)} | ${l.model?.games ?? 0} | ${list('early')} | ${list('mid')} | ${list('late')} | ${core || '–'} | ` +
        `${l.cores.map((c) => c.unexplored).join('/') || '–'} | ${fmt(l.halfGap ?? NaN)} | ${fmt(l.roundGap ?? NaN)} |`,
    );
  }
  push(
    '',
    '## Flagged for Stage 5 review',
    '',
    'Reported only (D-EP-043, D-EP-045, D-EP-050): no balance changes follow from this report in Stage 4.',
    '',
    ...(flags.length ? flags : ['- Nothing reaches the flag thresholds.']),
    '',
    '## What the data can\'t tell yet',
    '',
    '- **Value the stats don\'t see.** The contribution measure credits Seeds, damage, kills, deaths, assists and support ' +
      'shares; an item whose value shows up elsewhere (vision, zoning, objectives without damage) is undervalued. The ' +
      'duels judge the scores by real wins.',
    `- **Unexplored items.** Swaps to items held in fewer than ${MARGIN.minGames} of a hero's games are not judged; they keep ` +
      'close to the designer prior.',
    '- **Situational picks and enemy-dependent value** (vs healers, vs divers): the model has no enemy-flock terms.',
    '- **Ability win-rate effects and ablations** (D-EP-043): need paired runs with an ability disabled (Stage 5, not started).',
    '- **Bot competence:** bots cast by use rules; "rarely cast" can mean the bot rarely finds a use, not that the ability is weak.',
    '',
  );
  return out.join('\n');
}
