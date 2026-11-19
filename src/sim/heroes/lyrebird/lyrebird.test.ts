/** Lyrebird smoke tests (GDD §9.4): the gun, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import type { AbilityDef, EntityId, HeroId, PlayerTeam, SummonEffect, UnitEntity, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { SLOW } from '../../data/combat';
import { resolveAbility, validateKit, walkEffects } from '../../abilities/kit';
import { lyrebirdDef } from '../../data/heroes/lyrebird';
import { lyrebird } from './index';

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
const AHEAD = (z: number): Vec3 => ({ x: 0, y: 0, z });

interface Spec {
  readonly hero: HeroId;
  readonly at: Vec3;
  readonly team?: PlayerTeam;
}

/** Lyrebird (Dawn, at the origin facing +z) first, then the others; tiers bought for the Lyrebird. */
async function setup(others: readonly Spec[] = [], tiers: readonly number[] = [0, 0, 0, 0]) {
  const sb = await createSandbox({ heroes: [{ hero: 'lyrebird', at: ORIGIN, yaw: 0 }, ...others] });
  const [me, ...rest] = sb.heroes as [EntityId, ...EntityId[]];
  sb.hero(me).abilities.ap = 99;
  tiers.forEach((tier, slot) => {
    for (let t = 0; t < tier; t++) {
      sb.upgrade(me, slot);
      sb.step();
    }
  });
  return { sb, me, rest, foe: rest[0] as EntityId };
}

const hitsOn = (sb: Sandbox, me: EntityId, foe: EntityId, ability?: string) =>
  sb.eventsOf('damage.applied').filter((e) => e.source === me && e.target === foe && (ability === undefined || e.ability === ability));
/** Seconds each application of a status lasts, measured as it lands. Call before the cast. */
function durations(sb: Sandbox, who: EntityId, id: string): number[] {
  const out: number[] = [];
  sb.ctx.bus.on('status.applied', (e) => {
    if (e.target === who && e.status === id) out.push((e.expiresAt - sb.sim.tick) / TICK_RATE);
  });
  return out;
}
const slot = (sb: Sandbox, me: EntityId, i: number) => sb.hero(me).abilities.slots[i];
const decoys = (sb: Sandbox): UnitEntity[] => sb.ctx.store.list('unit').filter((u) => u.unit.summon === 'decoy');
const healed = (sb: Sandbox, who: EntityId): number => sb.eventsOf('heal.applied').filter((e) => e.target === who).reduce((s, e) => s + e.amount, 0);

describe('Lyrebird', () => {
  it('has a valid, implemented kit', () => {
    expect(validateKit(lyrebird)).toEqual([]);
    expect(lyrebird.implemented).toBe(true);
  });

  describe('Echo Lute (projectile 90 m/s, radius 0.25, 16 Talon, 20 rounds, 4.5 shots/s, 2 s reload)', () => {
    it('deals 16 per bullet and 16 × 1.65 on the head', async () => {
      const { sb, me, foe } = await setup([{ hero: 'pelican', at: AHEAD(5) }]);
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.step(10);
      sb.fire(me, false);
      const body = hitsOn(sb, me, foe);
      expect(body.length).toBeGreaterThan(0);
      for (const e of body) expect([e.beakShot, e.amount]).toEqual([false, expect.closeTo(16, 1)]);
      sb.clearEvents();
      sb.step(30);
      sb.aimAt(me, foe, 'head');
      sb.fire(me);
      sb.step(10);
      const head = hitsOn(sb, me, foe);
      expect(head.length).toBeGreaterThan(0);
      for (const e of head) expect([e.beakShot, e.amount]).toEqual([true, expect.closeTo(16 * 1.65, 1)]);
    });

    it('holds 20 rounds, fires 4.5 a second and reloads in 2 s', async () => {
      const { sb, me } = await setup();
      expect(sb.hero(me).weapon.ammo).toBe(20);
      const fired: number[] = [];
      sb.ctx.bus.on('weapon.fired', () => fired.push(sb.sim.tick));
      let started = 0;
      let done = 0;
      sb.ctx.bus.on('weapon.reload', (e) => (e.done ? (done = sb.sim.tick) : (started = sb.sim.tick)));
      sb.fire(me);
      sb.stepUntil(() => done > 0, 600);
      expect(fired.filter((t) => t <= started)).toHaveLength(20);
      expect(((fired[19] as number) - (fired[0] as number)) / 19).toBeCloseTo(TICK_RATE / 4.5, 0); // whole ticks: 13 or 14 apart
      expect(done - started).toBe(2 * TICK_RATE);
    });

    it('has the 0.25 m bullet radius in its data', () => {
      expect(lyrebirdDef.weapon.projectileRadius).toBe(0.25);
    });
  });

  describe('Mended Song', () => {
    it('heals an ally 100 at once and 50 more over 4 s; two charges, 13 s cooldown', async () => {
      const { sb, me, rest } = await setup([{ hero: 'swan', at: AHEAD(10), team: 'dawn' }]);
      const ally = rest[0] as EntityId;
      sb.health(ally).hp = 200;
      sb.cast(me, 0, ally);
      sb.step(2);
      expect(sb.health(ally).hp).toBeCloseTo(300, 0);
      sb.step(TICK_RATE * 4.5);
      expect(sb.health(ally).hp).toBeCloseTo(350, 0);
      expect(healed(sb, ally)).toBeCloseTo(150, 0);
      expect(slot(sb, me, 0)?.charges).toBe(1);
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(13 * TICK_RATE);
    });

    it('heals you when no ally is under the crosshair', async () => {
      const { sb, me } = await setup([{ hero: 'pelican', at: AHEAD(10) }]);
      sb.health(me).hp = 300;
      sb.cast(me, 0, { x: 20, y: 0, z: 0 }); // looking away from everyone
      sb.step(2);
      expect(sb.health(me).hp).toBeCloseTo(400, 0);
    });

    it('T3 (with T1, T2): heals 140 at once, +15% Talon resist for 4 s, and cleanses', async () => {
      const { sb, me, rest } = await setup([{ hero: 'swan', at: AHEAD(10), team: 'dawn' }], [3, 0, 0, 0]);
      const ally = rest[0] as EntityId;
      sb.health(ally).hp = 200;
      sb.apply({ kind: 'applyStatus', status: SLOW, durationS: 5, magnitude: 0.3 }, ally, sb.cause(me));
      expect(sb.ctx.stats.get(ally, 'slow')).toBeCloseTo(0.3, 3);
      const resist = durations(sb, ally, 'lyrebird.mended');
      sb.cast(me, 0, ally);
      sb.step(2);
      expect(sb.health(ally).hp).toBeCloseTo(340, 0);
      expect(resist[0]).toBeCloseTo(4, 1);
      expect(sb.ctx.stats.get(ally, 'talonResist')).toBeCloseTo(0.15, 3);
      expect(sb.ctx.stats.get(ally, 'slow')).toBe(0);
    });
  });

  describe('Echo Double', () => {
    it('sends a 150 HP decoy running along your aim for 6 s, which shoots the nearest enemy; you vanish for 2 s', async () => {
      const { sb, me, foe } = await setup([{ hero: 'pelican', at: AHEAD(15) }]);
      const vanished = durations(sb, me, 'invisible');
      sb.cast(me, 1);
      sb.step(2);
      const [decoy] = decoys(sb);
      expect(decoy).toBeDefined();
      expect(decoy?.health.hp).toBeCloseTo(150, 1);
      expect(vanished[0]).toBeCloseTo(2, 1);
      expect(sb.ctx.stats.has(me, 'invisible')).toBe(true);
      sb.step(TICK_RATE * 1);
      expect(decoy?.pos.z).toBeCloseTo(sb.ctx.stats.get(me, 'moveSpeed') * (TICK_RATE + 2) / TICK_RATE, 0);
      const shots = hitsOn(sb, me, foe, 'lyrebird.echoDouble');
      expect(shots.length).toBeGreaterThan(0);
      for (const s of shots) expect([s.damageType, s.amount]).toEqual(['talon', expect.closeTo(4.8, 1)]);
      sb.step(TICK_RATE * 6);
      expect(decoys(sb)).toHaveLength(0);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(22 * TICK_RATE);
    });

    it('T1: decoy HP 300', async () => {
      const { sb, me } = await setup([], [0, 1, 0, 0]);
      sb.cast(me, 1);
      sb.step(2);
      expect(decoys(sb)[0]?.health.hp).toBeCloseTo(300, 1);
    });

    it('T2 runtime: one cast makes two decoys running 15° either side of your aim', async () => {
      const { sb, me } = await setup([], [0, 2, 0, 0]);
      sb.cast(me, 1);
      sb.step(TICK_RATE);
      const made = decoys(sb);
      expect(made).toHaveLength(2);
      const angles = made.map((d) => (Math.atan2(d.pos.x, d.pos.z) * 180) / Math.PI).sort((a, b) => a - b);
      expect(angles[0]).toBeCloseTo(-15, 0);
      expect(angles[1]).toBeCloseTo(15, 0);
    });

    it('T3 runtime: a decoy bursts at its last position when it expires: 80 Song and disarm 1.5 s in 4 m', async () => {
      // T3 includes T2: two decoys run 15 degrees either side for 6 s at 7 m/s; the foe waits where one ends.
      const { sb, me, foe } = await setup([{ hero: 'pelican', at: { x: 10.9, y: 0, z: 40.6 }, team: 'dusk' }], [0, 3, 0, 0]);
      sb.cast(me, 1);
      sb.step(TICK_RATE * 6 + 10);
      expect(decoys(sb)).toHaveLength(0);
      const burst = hitsOn(sb, me, foe, 'lyrebird.echoDouble').filter((h) => h.damageType === 'song');
      expect(burst.length).toBeGreaterThan(0);
      expect(burst[0]?.amount).toBeCloseTo(80, 0);
      const disarms = sb.eventsOf('status.applied').filter((e) => e.target === foe && e.status === 'disarm');
      expect(disarms.length).toBeGreaterThan(0);
    });

    it('T2: two decoys fanned 30° apart; T3: they burst for 80 and disarm 1.5 s in 4 m (data, run by the framework)', () => {
      const def = lyrebirdDef.abilities[1] as AbilityDef;
      const at = (tier: number) => resolveAbility(def, tier);
      const summon = (r: ReturnType<typeof at>): SummonEffect => {
        let found: SummonEffect | undefined;
        walkEffects(r.effects, (e) => {
          if (e.kind === 'summon') found = e;
        });
        if (!found) throw new Error('no summon');
        return found;
      };
      expect([at(1), at(2), at(3)].map((r) => r.values.decoys)).toEqual([1, 2, 2]);
      expect(summon(at(2)).count).toBe('decoys');
      expect(summon(at(2)).spreadDeg).toBe(30);
      expect(at(3).values.burst).toBe(4);
      const end = summon(at(3)).onEnd;
      expect(end?.[0]).toMatchObject({ kind: 'area', shape: { kind: 'sphere', radius: 'burst' }, affects: { teams: 'enemies' } });
      const effects = end?.[0]?.kind === 'area' ? end[0].effects : [];
      expect(effects[0]).toMatchObject({ kind: 'damage', type: 'song', amount: { of: 80, song: 0.8 } });
      expect(effects[1]).toMatchObject({ kind: 'applyStatus', status: { id: 'disarm' }, durationS: 1.5 });
    });
  });

  describe('Discord', () => {
    it('bursts at a point: 70 damage and disarm 1.5 s in 6 m', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(20) }, { hero: 'owl', at: AHEAD(27.5) }]);
      const [near, far] = rest as [EntityId, EntityId];
      const disarmed = durations(sb, near, 'disarm');
      sb.cast(me, 2, AHEAD(20));
      sb.step(2);
      const hits = hitsOn(sb, me, near, 'lyrebird.discord');
      expect(hits).toHaveLength(1);
      expect(hits[0]?.amount).toBeCloseTo(70, 1);
      expect(disarmed[0]).toBeCloseTo(1.5, 1);
      expect(sb.ctx.stats.has(near, 'disarmed')).toBe(true);
      expect(hitsOn(sb, me, far, 'lyrebird.discord')).toHaveLength(0); // 7.5 m: outside 6 m
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(18 * TICK_RATE);
    });

    it('T3 (with T1, T2): 7.5 m radius, disarm 2.25 s, +20% damage taken for 4 s', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(20) }, { hero: 'owl', at: AHEAD(27.5) }], [0, 0, 3, 0]);
      const [near, far] = rest as [EntityId, EntityId];
      const disarmed = durations(sb, far, 'disarm');
      sb.cast(me, 2, AHEAD(20));
      sb.step(2);
      expect(hitsOn(sb, me, far, 'lyrebird.discord')).toHaveLength(1);
      expect(disarmed[0]).toBeCloseTo(2.25, 1);
      expect(sb.ctx.stats.get(near, 'talonAmp')).toBeCloseTo(0.2, 3);
      expect(sb.ctx.stats.get(near, 'songAmp')).toBeCloseTo(0.2, 3);
    });
  });

  describe('Grand Chorus', () => {
    it('is locked before level 6 and usable at 6', async () => {
      const sb = await createSandbox({ heroes: [{ hero: 'lyrebird', at: ORIGIN }, { hero: 'pelican', at: AHEAD(20) }], options: { unlockAbilities: false } });
      const [me] = sb.heroes as [EntityId];
      sb.cast(me, 3);
      sb.step(5);
      expect(slot(sb, me, 3)?.unlocked).toBe(false);
      expect(slot(sb, me, 3)?.readyAt).toBe(0);
      sb.ctx.bus.emit({ type: 'hero.level', hero: me, level: 6, ap: 0, unlockSlot: 3 });
      sb.step();
      expect(slot(sb, me, 3)?.unlocked).toBe(true);
      sb.cast(me, 3);
      sb.step(5);
      expect(slot(sb, me, 3)?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('heals allies (you too) 45 a second, +20% resists, slows enemies 20%, and slows and disarms you', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(10) },
        { hero: 'swan', at: { x: 5, y: 0, z: 0 }, team: 'dawn' },
        { hero: 'owl', at: { x: 20, y: 0, z: 0 }, team: 'dawn' },
      ]);
      const [foe, near, far] = rest as [EntityId, EntityId, EntityId];
      for (const id of [me, near, far]) sb.health(id).hp = 100;
      sb.cast(me, 3);
      sb.step(TICK_RATE * 3 + 5);
      expect(sb.hero(me).abilities.channelling).toBe(true);
      expect(sb.ctx.stats.has(me, 'disarmed')).toBe(true);
      expect(sb.ctx.stats.get(me, 'slow')).toBeCloseTo(0.4, 3);
      expect(sb.health(near).hp).toBeCloseTo(100 + 45 * 3, 0);
      expect(sb.health(me).hp).toBeCloseTo(100 + 45 * 3, 0);
      expect(sb.health(far).hp).toBe(100); // 20 m: outside 14 m
      expect(sb.ctx.stats.get(near, 'talonResist')).toBeCloseTo(0.2, 3);
      expect(sb.ctx.stats.get(near, 'songResist')).toBeCloseTo(0.2, 3);
      expect(sb.ctx.stats.get(foe, 'slow')).toBeCloseTo(0.2, 3);
      sb.step(TICK_RATE * 3);
      expect(sb.hero(me).abilities.channelling).toBe(false); // 5 s
      expect(sb.ctx.stats.has(me, 'disarmed')).toBe(false);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(120 * TICK_RATE);
    });

    it('ending the channel early (a second press) ends the singing penalty', async () => {
      const { sb, me } = await setup();
      sb.cast(me, 3);
      sb.step(TICK_RATE);
      expect(sb.ctx.stats.has(me, 'disarmed')).toBe(true);
      sb.cast(me, 3);
      sb.step(3);
      expect(sb.hero(me).abilities.channelling).toBe(false);
      expect(sb.ctx.stats.has(me, 'disarmed')).toBe(false);
      expect(sb.ctx.stats.get(me, 'slow')).toBe(0);
    });

    it('T3 (with T1, T2): 18 m radius, allies +15% fire rate, and you shoot and move at full speed', async () => {
      const { sb, me, rest } = await setup([{ hero: 'swan', at: { x: 17, y: 0, z: 0 }, team: 'dawn' }], [0, 0, 0, 3]);
      const ally = rest[0] as EntityId;
      sb.health(ally).hp = 100;
      sb.cast(me, 3);
      sb.step(TICK_RATE * 2);
      expect(sb.hero(me).abilities.channelling).toBe(true);
      expect(sb.ctx.stats.has(me, 'disarmed')).toBe(false);
      expect(sb.ctx.stats.get(me, 'slow')).toBe(0);
      expect(sb.health(ally).hp).toBeGreaterThanOrEqual(100 + 45); // 17 m: inside the widened 18 m
      expect(sb.ctx.stats.get(ally, 'fireRate')).toBeCloseTo(0.15, 3);
    });
  });
});
