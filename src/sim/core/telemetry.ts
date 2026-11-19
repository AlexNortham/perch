import { TELEMETRY_SAMPLE_SECONDS } from '../data/core';
import type {
  Clock,
  EntityId,
  EventBus,
  EntityStore,
  HeroId,
  HeroTelemetry,
  ItemId,
  MatchTelemetry,
  ObjectiveTelemetry,
  PlayerTeam,
  ResolvedSimConfig,
} from './contracts';
import { ticks } from './math';

/** Live per-hero counters; also feed the scoreboard in the view. */
export interface HeroScore {
  kills: number;
  deaths: number;
  assists: number;
  lastHits: number;
  denies: number;
  podsSecured: number;
  damageToHeroes: number;
  damageToStructures: number;
  damageTaken: number;
  healing: number;
  gunHits: number;
  beakShots: number;
  readonly netWorthCurve: number[];
  readonly itemsBought: { s: number; item: ItemId }[];
  readonly itemsSold: { s: number; item: ItemId }[];
}

export interface TelemetryCollector {
  score(hero: EntityId): HeroScore | undefined;
  teamKills(team: PlayerTeam): number;
  /** Core calls this at the end of every tick (and once for tick 0); samples net worth on schedule. */
  endTick(): void;
  build(winner: PlayerTeam | null): MatchTelemetry;
}

const SAMPLE_TICKS = ticks(TELEMETRY_SAMPLE_SECONDS);

/**
 * Builds the match telemetry from events. `heroes` maps each hero entity to its roster slot (createSim spawns
 * heroes in roster order).
 */
export function createTelemetry(
  config: ResolvedSimConfig,
  bus: EventBus,
  store: EntityStore,
  clock: Clock,
  heroes: readonly EntityId[],
): TelemetryCollector {
  const scores = new Map<EntityId, HeroScore>();
  for (const id of heroes) {
    scores.set(id, {
      kills: 0,
      deaths: 0,
      assists: 0,
      lastHits: 0,
      denies: 0,
      podsSecured: 0,
      damageToHeroes: 0,
      damageToStructures: 0,
      damageTaken: 0,
      healing: 0,
      gunHits: 0,
      beakShots: 0,
      netWorthCurve: [],
      itemsBought: [],
      itemsSold: [],
    });
  }
  const kills: Record<PlayerTeam, number> = { dawn: 0, dusk: 0 };
  const teamCurve: Record<PlayerTeam, number[]> = { dawn: [], dusk: [] };
  const objectives: ObjectiveTelemetry[] = [];

  const seconds = (): number => clock.seconds;
  const heroIdOf = (id: EntityId | null): HeroId | null =>
    id === null ? null : (store.getKind(id, 'hero')?.hero.heroId ?? null);

  bus.on('damage.applied', (e) => {
    const target = scores.get(e.target);
    if (target) target.damageTaken += e.amount;
    const source = e.source === null ? undefined : scores.get(e.source);
    if (!source) return;
    if (e.targetKind === 'hero') source.damageToHeroes += e.amount;
    if (e.targetKind === 'structure') source.damageToStructures += e.amount;
    // Beak-shot % = beakShots / gunHits, so both count gun hits on heroes only (not decoys or Moonlit Mark).
    if (e.targetKind === 'hero' && e.via === 'weapon') {
      source.gunHits++;
      if (e.beakShot) source.beakShots++;
    }
  });
  bus.on('heal.applied', (e) => {
    const source = e.source === null ? undefined : scores.get(e.source);
    if (source) source.healing += e.amount;
  });
  bus.on('entity.died', (e) => {
    const credit = e.creditHero === null ? undefined : scores.get(e.creditHero);
    if (e.victimKind === 'hero') {
      const victim = scores.get(e.victim);
      if (victim) victim.deaths++;
      if (credit && e.creditHero !== null) {
        credit.kills++;
        const team = store.getKind(e.creditHero, 'hero')?.team;
        if (team) kills[team]++;
      }
      for (const a of e.assisters) {
        const s = scores.get(a);
        if (s) s.assists++;
      }
    } else if (e.victimKind === 'unit' && credit) {
      credit.lastHits++;
    }
    if (e.victimKind === 'structure' || e.victimType === 'roc') {
      objectives.push({ s: seconds(), what: e.victimType, team: e.victimTeam, hero: heroIdOf(e.creditHero) });
    }
  });
  bus.on('pod.resolved', (e) => {
    const s = scores.get(e.by);
    if (!s) return;
    if (e.outcome === 'denied') s.denies++;
    else s.podsSecured++;
  });
  bus.on('item.bought', (e) => scores.get(e.hero)?.itemsBought.push({ s: seconds(), item: e.item }));
  bus.on('item.sold', (e) => scores.get(e.hero)?.itemsSold.push({ s: seconds(), item: e.item }));
  bus.on('objective', (e) => {
    objectives.push({ s: seconds(), what: e.action, team: e.team, hero: heroIdOf(e.hero) });
  });
  bus.on('structure.state', (e) => {
    if (e.state !== 'phase2') return;
    const team = store.get(e.structure)?.team ?? 'neutral';
    objectives.push({ s: seconds(), what: 'patronPhase2', team, hero: null });
  });
  bus.on('flexSlots', (e) => objectives.push({ s: seconds(), what: 'flexSlots', team: e.team, hero: null }));

  return {
    score: (id) => scores.get(id),
    teamKills: (team) => kills[team],
    endTick() {
      if (clock.tick % SAMPLE_TICKS !== 0) return;
      const sum: Record<PlayerTeam, number> = { dawn: 0, dusk: 0 };
      for (const [id, s] of scores) {
        const h = store.getKind(id, 'hero');
        const worth = h?.progress.netWorth ?? 0;
        s.netWorthCurve.push(worth);
        if (h) sum[h.team] += worth;
      }
      teamCurve.dawn.push(sum.dawn);
      teamCurve.dusk.push(sum.dusk);
    },
    build(winner) {
      const list: HeroTelemetry[] = heroes.map((id, slot) => {
        const s = scores.get(id) as HeroScore;
        const h = store.getKind(id, 'hero');
        const r = config.roster[slot];
        if (!h || !r) throw new Error(`telemetry: hero ${id} (slot ${slot}) missing`);
        return {
          slot,
          heroId: r.hero,
          team: r.team,
          controller: r.controller,
          kills: s.kills,
          deaths: s.deaths,
          assists: s.assists,
          lastHits: s.lastHits,
          denies: s.denies,
          podsSecured: s.podsSecured,
          damageToHeroes: s.damageToHeroes,
          damageToStructures: s.damageToStructures,
          damageTaken: s.damageTaken,
          healing: s.healing,
          gunHits: s.gunHits,
          beakShots: s.beakShots,
          level: h.progress.level,
          netWorth: h.progress.netWorth,
          netWorthCurve: [...s.netWorthCurve],
          itemsBought: [...s.itemsBought],
          itemsSold: [...s.itemsSold],
        };
      });
      return {
        version: 1,
        seed: config.seed,
        map: config.map,
        ticks: clock.tick,
        seconds: clock.seconds,
        winner,
        sampleSeconds: TELEMETRY_SAMPLE_SECONDS,
        heroes: list,
        teams: {
          dawn: { kills: kills.dawn, netWorthCurve: [...teamCurve.dawn] },
          dusk: { kills: kills.dusk, netWorthCurve: [...teamCurve.dusk] },
        },
        objectives: [...objectives],
      };
    },
  };
}
