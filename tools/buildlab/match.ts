/**
 * One Build Lab match (D-EP-036/037/043): a seeded headless 12-bot match with per-flock shopping, recorded compactly.
 * The record is a pure function of the job: the same job gives the same record (and the same hash) on every run.
 * Per-ability numbers come from bus listeners on `sim.ctx` (read-only, `Sim.ctx` allows tools), the rest from
 * `sim.telemetry()`. Wall-clock time is never in the record, so reruns diff clean.
 */
import type {
  AbilityId,
  BotDifficulty,
  BotShopping,
  EffectVia,
  HeroId,
  ItemId,
  ItemScores,
  PlayerTeam,
} from '../../src/sim/core/contracts';
import { allBotRoster, createSim } from '../../src/sim';
import { COMBAT } from '../../src/sim/data/combat';
import { TICK_RATE } from '../../src/sim/data/core';

/** How a flock shops in one match: a round's scores at a temperature, or uniform random buying. */
export type FlockPolicy =
  | { readonly kind: 'scores'; readonly round: number; readonly temperature: number }
  | { readonly kind: 'random' };

export interface MatchJob {
  readonly seed: number;
  /** Cap on match length; a match still running then is undecided. */
  readonly minutes: number;
  readonly difficulty: BotDifficulty;
  readonly policy: Readonly<Record<PlayerTeam, FlockPolicy>>;
  /** The scores each flock's `round` refers to; absent (round 0) means the sim's own data (src/sim/data/builds.ts). */
  readonly scores: Readonly<Partial<Record<PlayerTeam, Readonly<Partial<Record<HeroId, ItemScores>>>>>>;
}

/** Damage buckets by `EffectVia`, for gun versus ability value (D-EP-045). */
export type DamageBucket = 'weapon' | 'melee' | 'ability' | 'item' | 'other';

export interface AbilityRecord {
  /** Wind-ups started. */
  casts: number;
  dmgHeroes: number;
  dmgOther: number;
  /** Killing blows on heroes. */
  kills: number;
  /** Hero kills by the hero's flock where this ability hit the victim within the assist window. */
  kp: number;
}

export interface HeroRecord {
  readonly hero: HeroId;
  readonly team: PlayerTeam;
  readonly k: number;
  readonly d: number;
  readonly a: number;
  readonly lastHits: number;
  readonly dmgHeroes: number;
  readonly dmgStructures: number;
  readonly dmgTaken: number;
  readonly healing: number;
  readonly netWorth: number;
  readonly level: number;
  /** Damage to heroes by source. */
  readonly dmgBy: Readonly<Record<DamageBucket, number>>;
  /** [second, item] in buying order. */
  readonly buys: readonly (readonly [number, ItemId])[];
  readonly sells: readonly (readonly [number, ItemId])[];
  /** [second, slot, tier]: unlocks (tier 0) and upgrades. */
  readonly ups: readonly (readonly [number, number, number])[];
  readonly abilities: Readonly<Record<AbilityId, AbilityRecord>>;
}

export interface MatchRecord {
  readonly v: 1;
  readonly seed: number;
  readonly minutes: number;
  readonly difficulty: BotDifficulty;
  readonly policy: Readonly<Record<PlayerTeam, FlockPolicy>>;
  readonly winner: PlayerTeam | null;
  readonly seconds: number;
  readonly hash: string;
  readonly teams: Readonly<Record<PlayerTeam, { readonly netWorth: number; readonly kills: number; readonly towersLost: number }>>;
  readonly heroes: readonly HeroRecord[];
}

const BUCKET: Readonly<Record<EffectVia, DamageBucket>> = {
  weapon: 'weapon',
  melee: 'melee',
  ability: 'ability',
  area: 'ability',
  status: 'ability',
  item: 'item',
  rune: 'other',
  objective: 'other',
  unit: 'other',
  structure: 'other',
};
const TEAMS: readonly PlayerTeam[] = ['dawn', 'dusk'];
const ROUND = 1000;
const r = (n: number): number => Math.round(n * ROUND) / ROUND;

function shoppingOf(job: MatchJob, team: PlayerTeam): BotShopping {
  const p = job.policy[team];
  if (p.kind === 'random') return { random: true };
  const scores = job.scores[team];
  return scores ? { scores, temperature: p.temperature } : { temperature: p.temperature };
}

export async function runMatch(job: MatchJob): Promise<MatchRecord> {
  const sim = await createSim({
    seed: job.seed,
    roster: allBotRoster(job.seed, undefined, job.difficulty),
    options: { botShopping: { dawn: shoppingOf(job, 'dawn'), dusk: shoppingOf(job, 'dusk') } },
  });
  const { bus, store, clock } = sim.ctx;
  const heroes = store.list('hero');
  const slotOf = new Map(heroes.map((h) => [h.id, h.hero.slot]));
  const teamOf = new Map(heroes.map((h) => [h.id, h.team]));
  const teamOfSlot = new Map(heroes.map((h) => [h.hero.slot, h.team]));
  const abilities = heroes.map(() => new Map<AbilityId, AbilityRecord>());
  const dmgBy = heroes.map((): Record<DamageBucket, number> => ({ weapon: 0, melee: 0, ability: 0, item: 0, other: 0 }));
  const ups = heroes.map((): [number, number, number][] => []);
  /** victim → "slot ability" → last tick that ability hit it. */
  const recent = new Map<number, Map<string, number>>();
  const window = COMBAT.assistWindowS * TICK_RATE;
  const ab = (slot: number, id: AbilityId): AbilityRecord => {
    const m = abilities[slot]!;
    let a = m.get(id);
    if (!a) m.set(id, (a = { casts: 0, dmgHeroes: 0, dmgOther: 0, kills: 0, kp: 0 }));
    return a;
  };

  bus.on('ability', (e) => {
    const slot = slotOf.get(e.caster);
    if (slot !== undefined && e.stage === 'start') ab(slot, e.ability).casts++;
  });
  bus.on('ability.upgraded', (e) => {
    const slot = slotOf.get(e.hero);
    if (slot !== undefined) ups[slot]!.push([r(clock.seconds), e.slot, e.tier]);
  });
  bus.on('damage.applied', (e) => {
    const slot = e.source === null ? undefined : slotOf.get(e.source);
    if (slot === undefined) return;
    const toHero = e.targetKind === 'hero';
    if (toHero) dmgBy[slot]![BUCKET[e.via]] += e.amount;
    if (e.ability === null) return;
    const a = ab(slot, e.ability);
    if (!toHero) {
      a.dmgOther += e.amount;
      return;
    }
    a.dmgHeroes += e.amount;
    if (e.lethal) a.kills++;
    let hits = recent.get(e.target);
    if (!hits) recent.set(e.target, (hits = new Map()));
    hits.set(`${slot} ${e.ability}`, clock.tick);
  });
  bus.on('entity.died', (e) => {
    if (e.victimKind !== 'hero') return;
    const hits = recent.get(e.victim);
    recent.delete(e.victim);
    if (!hits || e.revives) return;
    const team = e.creditHero === null ? undefined : teamOf.get(e.creditHero);
    for (const [key, tick] of hits) {
      const [slot, ability] = key.split(' ') as [string, AbilityId];
      const s = Number(slot);
      if (clock.tick - tick <= window && teamOfSlot.get(s) === team) ab(s, ability).kp++;
    }
  });

  const limit = Math.round(job.minutes * 60 * TICK_RATE);
  while (!sim.isOver && sim.tick < limit) sim.step();

  const t = sim.telemetry();
  const teams = Object.fromEntries(TEAMS.map((team) => [team, { netWorth: 0, kills: t.teams[team].kills, towersLost: 0 }])) as
    Record<PlayerTeam, { netWorth: number; kills: number; towersLost: number }>;
  for (const o of t.objectives) {
    if ((o.team === 'dawn' || o.team === 'dusk') && ['hawk', 'heron', 'warden', 'shrine', 'patron'].includes(o.what)) teams[o.team].towersLost++;
  }
  const records = t.heroes.map((h): HeroRecord => {
    teams[h.team].netWorth += h.netWorth;
    const a = Object.fromEntries([...abilities[h.slot]!].map(([id, x]) => [id, { ...x, dmgHeroes: r(x.dmgHeroes), dmgOther: r(x.dmgOther) }]));
    const by = dmgBy[h.slot]!;
    return {
      hero: h.heroId,
      team: h.team,
      k: h.kills,
      d: h.deaths,
      a: h.assists,
      lastHits: h.lastHits,
      dmgHeroes: r(h.damageToHeroes),
      dmgStructures: r(h.damageToStructures),
      dmgTaken: r(h.damageTaken),
      healing: r(h.healing),
      netWorth: h.netWorth,
      level: h.level,
      dmgBy: { weapon: r(by.weapon), melee: r(by.melee), ability: r(by.ability), item: r(by.item), other: r(by.other) },
      buys: h.itemsBought.map((b) => [r(b.s), b.item] as const),
      sells: h.itemsSold.map((b) => [r(b.s), b.item] as const),
      ups: ups[h.slot]!,
      abilities: a,
    };
  });
  return {
    v: 1,
    seed: job.seed,
    minutes: job.minutes,
    difficulty: job.difficulty,
    policy: job.policy,
    winner: sim.winner,
    seconds: r(t.seconds),
    hash: sim.hash(),
    teams,
    heroes: records,
  };
}
