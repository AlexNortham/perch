/** Cockatoo smoke tests (GDD §9.22): the gun, then each ability at its base and tiers, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import type { EntityId, HeroId, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { validateKit } from '../../abilities/kit';
import { cockatooDef } from '../../data/heroes/cockatoo';
import { cockatoo } from './index';

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
const AHEAD = (z: number, x = 0): Vec3 => ({ x, y: 0, z });

/** Cockatoo (Dawn, at the origin facing +z) first, then the others; tiers bought for the Cockatoo. */
async function setup(others: readonly { hero: HeroId; at: Vec3 }[] = [], tiers: readonly number[] = [0, 0, 0, 0]) {
  const sb = await createSandbox({ heroes: [{ hero: 'cockatoo', at: ORIGIN, yaw: 0 }, ...others] });
  const [me, ...rest] = sb.heroes as [EntityId, ...EntityId[]];
  sb.hero(me).abilities.ap = 99;
  tiers.forEach((tier, slot) => {
    for (let t = 0; t < tier; t++) {
      sb.upgrade(me, slot);
      sb.step();
    }
  });
  return { sb, me, rest };
}
const hitsOn = (sb: Sandbox, me: EntityId, foe: EntityId, ability?: string) =>
  sb.eventsOf('damage.applied').filter((e) => e.source === me && e.target === foe && (ability === undefined || e.ability === ability));
const slot = (sb: Sandbox, me: EntityId, i: number) => sb.hero(me).abilities.slots[i];
/** Put an ability on a cooldown with `seconds` left, and read what is left. */
function cool(sb: Sandbox, me: EntityId, i: number, seconds: number): void {
  const s = slot(sb, me, i)!;
  s.charges = 0;
  s.cooldownTicks = seconds * TICK_RATE;
  s.readyAt = sb.sim.tick + seconds * TICK_RATE;
}
const left = (sb: Sandbox, me: EntityId, i: number): number => ((slot(sb, me, i)?.readyAt ?? 0) - sb.sim.tick) / TICK_RATE;
function durations(sb: Sandbox, who: EntityId, id: string): number[] {
  const out: number[] = [];
  sb.ctx.bus.on('status.applied', (e) => {
    if (e.target === who && e.status === id) out.push((e.expiresAt - sb.sim.tick) / TICK_RATE);
  });
  return out;
}
function shoot(sb: Sandbox, me: EntityId, foe: EntityId, part: 'head' | 'body' = 'body'): void {
  sb.aimAt(me, foe, part);
  sb.fire(me);
  sb.step(1);
  sb.fire(me, false);
  sb.step(10);
}

describe('Cockatoo', () => {
  it('has a valid, implemented kit with the GDD body, stats and gun', () => {
    expect(validateKit(cockatoo)).toEqual([]);
    expect(cockatoo.implemented).toBe(true);
    expect(cockatooDef.body).toMatchObject({ height: 1.75, radius: 0.34, head: { radius: 0.18, centre: { up: 1.52 } } });
    expect(cockatooDef.stats).toMatchObject({ maxHealth: 560, moveSpeed: 7, weaponDamage: 14, magazine: 20 });
    expect(cockatooDef.weapon).toMatchObject({ hitscan: false, projectileSpeed: 75, spreadDeg: 1, fireRate: 4.5, reloadS: 2, falloff: { start: 14, end: 32 } });
  });

  describe('Screech Horn (projectile 75 m/s, 14 Talon, 20 rounds, 4.5 shots/s, 2 s reload)', () => {
    it('deals 14 per shot and 14 × 1.65 on the head', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(8) }]);
      const foe = rest[0] as EntityId;
      const gun = () => hitsOn(sb, me, foe).filter((e) => e.via === 'weapon');
      shoot(sb, me, foe);
      expect(gun()[0]?.amount).toBeCloseTo(14, 1);
      sb.step(30);
      sb.clearEvents();
      for (let i = 0; i < 4 && !gun().some((e) => e.beakShot); i++) shoot(sb, me, foe, 'head');
      expect(gun().find((e) => e.beakShot)?.amount).toBeCloseTo(14 * 1.65, 1);
    });

    it('fires 4.5 shots a second, holds 20 rounds and reloads in 2 s', async () => {
      const { sb, me } = await setup();
      expect(sb.hero(me).weapon.ammo).toBe(20);
      const fired: number[] = [];
      sb.ctx.bus.on('weapon.fired', () => fired.push(sb.sim.tick));
      let started = 0;
      let done = 0;
      sb.ctx.bus.on('weapon.reload', (e) => (e.done ? (done = sb.sim.tick) : (started = sb.sim.tick)));
      sb.fire(me);
      sb.stepUntil(() => fired.length >= 20, 900);
      sb.fire(me, false);
      sb.stepUntil(() => done > 0, 600);
      expect(fired).toHaveLength(20);
      expect(((fired[19] as number) - (fired[0] as number)) / 19).toBeCloseTo(TICK_RATE / 4.5, 0);
      expect((done - started) / TICK_RATE).toBeCloseTo(2, 1);
    });
  });

  describe('Screech', () => {
    it('hits enemies in the 14 m, 45 degree cone for 100 Song damage and a 0.75 s silence', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(10) },
        { hero: 'swan', at: AHEAD(10, 9) },
        { hero: 'owl', at: AHEAD(20) },
      ]);
      const [inCone, wide, far] = rest as [EntityId, EntityId, EntityId];
      const silence = durations(sb, inCone, 'silence');
      sb.cast(me, 0, AHEAD(10));
      sb.step(3);
      const hit = hitsOn(sb, me, inCone, 'cockatoo.screech');
      expect(hit).toHaveLength(1);
      expect(hit[0]?.amount).toBeCloseTo(100, 1);
      expect(hit[0]?.damageType).toBe('song');
      expect(silence[0]).toBeCloseTo(0.75, 1);
      expect(hitsOn(sb, me, wide)).toHaveLength(0);
      expect(hitsOn(sb, me, far)).toHaveLength(0);
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(11 * TICK_RATE);
    });

    it('T3 (with T1, T2): 125 damage, a 1.5 s silence, 8 s cooldown', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(10) }], [3, 0, 0, 0]);
      const silence = durations(sb, rest[0] as EntityId, 'silence');
      sb.cast(me, 0, AHEAD(10));
      sb.step(3);
      expect(hitsOn(sb, me, rest[0] as EntityId, 'cockatoo.screech')[0]?.amount).toBeCloseTo(125, 1);
      expect(silence[0]).toBeCloseTo(1.5, 1);
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(8 * TICK_RATE);
    });
  });

  describe('Crest Flare', () => {
    it('gives +25 SP and +15% Song damage for 6 s and drops the other cooldowns by 3 s', async () => {
      const { sb, me } = await setup();
      const sp = sb.ctx.stats.get(me, 'songPower');
      cool(sb, me, 0, 10);
      cool(sb, me, 2, 10);
      cool(sb, me, 3, 2);
      sb.cast(me, 1);
      sb.step(2);
      expect(sb.ctx.stats.get(me, 'songPower')).toBeCloseTo(sp + 25, 3);
      expect(sb.ctx.stats.get(me, 'songDamage')).toBeCloseTo(0.15, 3);
      expect(left(sb, me, 0)).toBeLessThanOrEqual(7);
      expect(left(sb, me, 0)).toBeGreaterThan(6.5);
      expect(left(sb, me, 2)).toBeLessThanOrEqual(7);
      expect(slot(sb, me, 3)?.charges).toBe(1);
      expect(slot(sb, me, 1)?.cooldownTicks).toBeGreaterThan(19 * TICK_RATE);
      sb.step(TICK_RATE * 6);
      expect(sb.ctx.stats.get(me, 'songPower')).toBeCloseTo(sp, 3);
      expect(sb.ctx.stats.get(me, 'songDamage')).toBe(0);
    });

    it('T1 8 s; T2 +10 SP; T3 a 6 s cooldown drop', async () => {
      const { sb, me } = await setup([], [0, 3, 0, 0]);
      const sp = sb.ctx.stats.get(me, 'songPower');
      cool(sb, me, 0, 11);
      sb.cast(me, 1);
      sb.step(2);
      expect(sb.ctx.stats.get(me, 'songPower')).toBeCloseTo(sp + 35, 3);
      expect(left(sb, me, 0)).toBeLessThanOrEqual(5);
      sb.step(TICK_RATE * 7);
      expect(sb.ctx.stats.get(me, 'songPower')).toBeCloseTo(sp + 35, 3);
      sb.step(TICK_RATE * 1.2);
      expect(sb.ctx.stats.get(me, 'songPower')).toBeCloseTo(sp, 3);
    });
  });

  describe('Seed Crack', () => {
    it('cracks 0.8 s after landing: 120 Song damage in 5 m and a knock-up', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(20, 3) },
        { hero: 'swan', at: AHEAD(20, 9) },
      ]);
      const [hitFoe, safe] = rest as [EntityId, EntityId];
      sb.cast(me, 2, AHEAD(20));
      sb.step(TICK_RATE * 0.6);
      expect(hitsOn(sb, me, hitFoe)).toHaveLength(0);
      let peak = 0;
      for (let i = 0; i < TICK_RATE * 1.2; i++) {
        sb.step();
        peak = Math.max(peak, sb.hero(hitFoe).pos.y);
      }
      const hit = hitsOn(sb, me, hitFoe, 'cockatoo.seedCrack');
      expect(hit).toHaveLength(1);
      expect(hit[0]?.amount).toBeCloseTo(120, 1);
      expect(peak).toBeGreaterThan(0.6);
      expect(hitsOn(sb, me, safe)).toHaveLength(0);
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(13 * TICK_RATE);
    });

    it('T1 6 m radius; T2 10 s cooldown; T3 two charges', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(20, 5.5) }], [0, 0, 3, 0]);
      sb.cast(me, 2, AHEAD(20));
      sb.step(TICK_RATE * 1.2);
      expect(hitsOn(sb, me, rest[0] as EntityId, 'cockatoo.seedCrack')).toHaveLength(1);
      expect(slot(sb, me, 2)?.charges).toBe(1);
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(10 * TICK_RATE);
    });
  });

  describe('Sulphur Shriek', () => {
    it('channels 2 s at half speed with no gun: 4 pulses of 80 Song damage, and a stun on the third pulse', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(10) },
        { hero: 'swan', at: AHEAD(20) },
      ]);
      const [near, away] = rest as [EntityId, EntityId];
      const stun = durations(sb, near, 'stun');
      sb.cast(me, 3);
      sb.step(2);
      expect(sb.ctx.stats.get(me, 'slow')).toBeCloseTo(0.5, 3);
      expect(sb.ctx.stats.has(me, 'disarmed')).toBe(true);
      sb.step(TICK_RATE * 2.2);
      const hits = hitsOn(sb, me, near, 'cockatoo.sulphurShriek');
      expect(hits).toHaveLength(4);
      for (const h of hits) expect(h.amount).toBeCloseTo(80, 1);
      expect(stun).toHaveLength(1);
      expect(stun[0]).toBeCloseTo(1, 1);
      expect(hitsOn(sb, me, away)).toHaveLength(0);
      expect(sb.ctx.stats.has(me, 'disarmed')).toBe(false);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(110 * TICK_RATE);
    });

    it('ends early with a second press, and the penalty goes with it', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(10) }]);
      sb.cast(me, 3);
      sb.step(TICK_RATE * 0.8);
      sb.cast(me, 3);
      sb.step(2);
      expect(sb.ctx.stats.has(me, 'disarmed')).toBe(false);
      expect(sb.ctx.stats.get(me, 'slow')).toBe(0);
      expect(hitsOn(sb, me, rest[0] as EntityId, 'cockatoo.sulphurShriek').length).toBeLessThan(3);
    });

    it('T1 18 m radius; T2 a fifth pulse in a 2.5 s channel; T3 enemies lose 20% Song resist for 6 s', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(17) }], [0, 0, 0, 3]);
      const foe = rest[0] as EntityId;
      const shred = durations(sb, foe, 'cockatoo.shriekShred');
      sb.cast(me, 3);
      sb.step(TICK_RATE * 2.7);
      expect(hitsOn(sb, me, foe, 'cockatoo.sulphurShriek')).toHaveLength(5);
      expect(shred[0]).toBeCloseTo(6, 1);
      expect(sb.ctx.stats.get(foe, 'songShred')).toBeCloseTo(0.2, 3);
    });
  });
});
