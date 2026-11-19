/** Earned Seeds, Molts, bounties and flock unlocks (GDD §8). */
import type { EntityId, HeroEntity, PlayerTeam, SeedReason, SystemFactory, Team } from '../core/contracts';
import { distSq } from '../core/math';
import { TICK_RATE } from '../data/core';
import { ECONOMY } from '../data/economy';

const FLEDGLING = ECONOMY.fledgling;
const POD = ECONOMY.pod;
const RISE_TICKS = Math.round(POD.riseS * TICK_RATE);
const LIFE_TICKS = Math.round((POD.riseS + POD.ripeS) * TICK_RATE);
const PASSIVE_FROM = ECONOMY.passiveFromS * TICK_RATE;

interface PodState {
  readonly spawn: number;
  readonly value: number;
  readonly team: Team;
  readonly y0: number;
}
interface Hit {
  readonly by: EntityId;
  readonly pod: EntityId;
}

export const createEconomySystem: SystemFactory = (ctx) => {
  const { bus, store, clock } = ctx;
  const pods = new Map<EntityId, PodState>();
  const hits: Hit[] = [];
  const streaks = new Map<EntityId, number>();
  const falls = { dawn: { hawk: 0, heron: 0, warden: 0, shrine: 0 }, dusk: { hawk: 0, heron: 0, warden: 0, shrine: 0 } };

  const levelUp = (h: HeroEntity): void => {
    const rules = ECONOMY.levels;
    const p = h.progress;
    while (p.level < rules.max && p.netWorth >= rules.baseCost * p.level + rules.costGrowth * p.level * (p.level - 1)) {
      p.level++;
      p.molts++;
      const growth = ctx.heroes[h.hero.heroId].def.growth;
      ctx.stats.set(h.id, 'economy:molts', { stats: growth.map((g) => ({ ...g, value: g.value * p.molts })) });
      bus.emit({ type: 'hero.level', hero: h.id, level: p.level, ap: p.level % rules.doubleApEvery === 0 ? 2 : 1,
        unlockSlot: p.level === rules.ultimate ? rules.ultimateSlot : null });
    }
  };

  /** Whole Seeds only, rounded down at payment (GDD §8.1). */
  const pay = (hero: EntityId, amount: number, reason: SeedReason): void => {
    const h = store.getKind(hero, 'hero');
    const n = Math.floor(amount);
    if (!h || n <= 0) return;
    h.progress.seeds += n;
    h.progress.netWorth += n;
    bus.emit({ type: 'seeds.gained', hero, amount: n, reason });
    levelUp(h);
  };

  bus.on('entity.spawned', (e) => {
    if (e.kind !== 'hero') return;
    const h = store.getKind(e.id, 'hero');
    const start = ctx.config.options.startSeeds ?? ECONOMY.startSeeds;
    if (h && start > 0) {
      h.progress.seeds = Math.floor(start);
      h.progress.netWorth = h.progress.seeds;
      levelUp(h);
    }
  });

  bus.on('entity.died', (e) => {
    if (e.victimTeam === 'neutral') return;
    const side: PlayerTeam = e.victimTeam === 'dawn' ? 'dusk' : 'dawn';
    const all = store.list('hero');
    if (e.victimKind === 'structure') {
      const type = e.victimType;
      if (type !== 'hawk' && type !== 'heron' && type !== 'warden' && type !== 'shrine') return;
      for (const h of all) if (h.team === side) pay(h.id, ECONOMY.objective[type], 'objective');
      if (++falls[side][type] <= ECONOMY.flexAwards[type]) {
        const slots = ++ctx.teams[side].flexSlots;
        bus.emit({ type: 'flexSlots', team: side, slots });
      }
      return;
    }
    if (e.victimKind !== 'hero') return;
    const victim = store.getKind(e.victim, 'hero');
    if (!victim) return;
    const rules = ECONOMY.bounty;
    const shutdown = Math.min(rules.streakCap, rules.perStreakKill * Math.max(0, (streaks.get(victim.id) ?? 0) - rules.freeKills));
    streaks.delete(victim.id);
    const worth = { dawn: 0, dusk: 0 };
    for (const h of all) worth[h.team] += h.progress.netWorth;
    const deficit = Math.max(0, worth[victim.team] - worth[side]) / Math.max(1, worth[victim.team]);
    const bounty = (rules.base + rules.worthFraction * victim.progress.netWorth + shutdown) *
      (1 + Math.min(rules.comebackCap, rules.comebackRate * deficit));
    const killer = e.creditHero === null ? undefined : store.getKind(e.creditHero, 'hero');
    if (killer && killer.team !== side) return;
    if (killer) streaks.set(killer.id, (streaks.get(killer.id) ?? 0) + 1);
    const recipients = all.filter((h) => h.team === side && (killer ? h === killer || e.assisters.includes(h.id) :
      !h.health.dead && distSq(h.pos, e.pos) <= rules.shareRange ** 2));
    for (const h of recipients) pay(h.id, bounty / recipients.length, !killer ? 'share' : h === killer ? 'heroKill' : 'assist');
  });

  bus.on('entity.died', (e) => {
    if (e.victimKind !== 'unit' || (e.victimType !== 'scrapper' && e.victimType !== 'slinger') || e.victimTeam === 'neutral') {
      return;
    }
    const body = store.getKind(e.victim, 'unit');
    if (!body) return;
    const v = FLEDGLING.base[e.victimType] * Math.min(FLEDGLING.growthCap, 1 + FLEDGLING.growthPerMin * clock.seconds / ECONOMY.secondsPerMinute);
    const instant = v * FLEDGLING.instantShare;

    if (e.creditHero !== null) {
      // A hero of the fledgling's own side landing it earns nothing.
      if (store.getKind(e.creditHero, 'hero')?.team !== e.victimTeam) pay(e.creditHero, instant, 'lastHit');
    } else {
      // No hero landed it: split among enemy heroes in range (lost if none).
      const inRange = (h: HeroEntity): boolean => {
        return h.team !== e.victimTeam && !h.health.dead && distSq(h.pos, body.pos) <= FLEDGLING.shareRange ** 2;
      };
      const heroes = store.list('hero');
      let n = 0;
      for (const h of heroes) if (inRange(h)) n++;
      for (const h of heroes) if (inRange(h)) pay(h.id, instant / n, 'share');
    }

    const y0 = body.pos.y + body.unit.height * POD.chestFraction;
    const value = v * POD.shareOfValue;
    const pod = store.spawn({
      kind: 'pickup',
      team: e.victimTeam,
      pos: { x: body.pos.x, y: y0, z: body.pos.z },
      vel: { x: 0, y: POD.riseM / POD.riseS, z: 0 },
      yaw: 0,
      radius: POD.radius,
      pickup: { type: 'pod', variant: '', value, expiresAt: clock.tick + LIFE_TICKS, carrier: null },
    });
    pods.set(pod.id, { spawn: clock.tick, value, team: e.victimTeam, y0 });
  });

  // Only gun bullets and melee resolve pods; a missing `via` means 'weapon' (GDD §8.2).
  bus.on('projectile.impact', (e) => {
    if (e.owner !== null && e.target !== null && pods.has(e.target) && (e.via ?? 'weapon') === 'weapon') {
      hits.push({ by: e.owner, pod: e.target });
    }
  });
  bus.on('melee', (e) => {
    if (e.target !== null && pods.has(e.target)) hits.push({ by: e.attacker, pod: e.target });
  });

  const resolveHits = (): void => {
    for (const hit of hits) {
      const p = pods.get(hit.pod);
      const hero = store.getKind(hit.by, 'hero');
      const pod = store.getKind(hit.pod, 'pickup');
      if (!p || !hero || !pod || hero.health.dead) continue;
      const age = clock.tick - p.spawn;
      if (age < RISE_TICKS || age >= LIFE_TICKS) continue; // can't be hit while rising
      const secured = hero.team !== p.team;
      pay(hero.id, secured ? p.value : p.value * POD.denyFraction, 'pod');
      bus.emit({ type: 'pod.resolved', pod: hit.pod, by: hero.id, outcome: secured ? 'secured' : 'denied', pos: { ...pod.pos } });
      store.despawn(hit.pod);
      pods.delete(hit.pod);
    }
    hits.length = 0;
  };

  const tickPods = (): void => {
    for (const [id, p] of pods) {
      const pod = store.getKind(id, 'pickup');
      const age = clock.tick - p.spawn;
      if (!pod || age >= LIFE_TICKS) {
        if (pod) store.despawn(id); // withered: lost
        pods.delete(id);
        continue;
      }
      pod.pos.y = p.y0 + POD.riseM * Math.min(1, age / RISE_TICKS);
      pod.vel.y = age < RISE_TICKS ? POD.riseM / POD.riseS : 0;
    }
  };

  const passive = (): void => {
    if (clock.tick < PASSIVE_FROM || clock.tick % TICK_RATE !== 0) return;
    for (const h of store.list('hero')) pay(h.id, ECONOMY.passivePerSecond, 'passive');
  };

  return {
    name: 'economy',
    phases: {
      economy() {
        resolveHits();
        tickPods();
        passive();
      },
    },
    hash(h) {
      h.value([...pods]);
      h.value(streaks);
      h.value(falls);
    },
  };
};
