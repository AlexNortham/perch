/**
 * Economy (GDD §8), wave 3: Seeds, the last-hit share, seed pods and passive income. Bounties, levels, Molts, AP and
 * flex slots are wave 4.
 */
import type { EntityId, HeroEntity, SeedReason, SystemFactory, Team } from '../core/contracts';
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

  /** Whole Seeds only, rounded down at payment (GDD §8.1). */
  const pay = (hero: EntityId, amount: number, reason: SeedReason): void => {
    const h = store.getKind(hero, 'hero');
    const n = Math.floor(amount);
    if (!h || n <= 0) return;
    h.progress.seeds += n;
    h.progress.netWorth += n;
    bus.emit({ type: 'seeds.gained', hero, amount: n, reason });
  };

  bus.on('entity.spawned', (e) => {
    if (e.kind !== 'hero') return;
    const h = store.getKind(e.id, 'hero');
    const start = ctx.config.options.startSeeds ?? ECONOMY.startSeeds;
    if (h && start > 0) {
      h.progress.seeds = start;
      h.progress.netWorth = start;
    }
  });

  bus.on('entity.died', (e) => {
    if (e.victimKind !== 'unit' || (e.victimType !== 'scrapper' && e.victimType !== 'slinger') || e.victimTeam === 'neutral') {
      return;
    }
    const body = store.getKind(e.victim, 'unit');
    if (!body) return;
    const v = FLEDGLING.base[e.victimType] * Math.min(FLEDGLING.growthCap, 1 + (FLEDGLING.growthPerMin * clock.tick) / TICK_RATE / 60);
    const instant = v * FLEDGLING.instantShare;

    if (e.creditHero !== null) {
      // A hero of the fledgling's own side landing it earns nothing.
      if (store.getKind(e.creditHero, 'hero')?.team !== e.victimTeam) pay(e.creditHero, instant, 'lastHit');
    } else {
      // No hero landed it: split among enemy heroes in range (lost if none).
      const inRange = (h: HeroEntity): boolean => {
        const dx = h.pos.x - body.pos.x;
        const dy = h.pos.y - body.pos.y;
        const dz = h.pos.z - body.pos.z;
        return h.team !== e.victimTeam && !h.health.dead && dx * dx + dy * dy + dz * dz <= FLEDGLING.shareRange ** 2;
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
      casting: null,
      channelling: false,
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
    },
  };
};
