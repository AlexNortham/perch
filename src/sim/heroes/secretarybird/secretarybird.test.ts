/** Secretarybird smoke tests (GDD §9.7): the gun, Footwork, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import type { EntityId, HeroId, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { validateKit } from '../../abilities/kit';
import { FOOTWORK, secretarybirdDef } from '../../data/heroes/secretarybird';
import { secretarybird } from './index';

const AT = (z: number, x = 0): Vec3 => ({ x, y: 0, z });
const FOE: HeroId = 'albatross';

async function setup(foes: readonly { hero: HeroId; at: Vec3 }[] = [{ hero: FOE, at: AT(3) }], tiers: readonly number[] = [0, 0, 0, 0]) {
  const sb = await createSandbox({ heroes: [{ hero: 'secretarybird', at: AT(0), yaw: 0 }, ...foes] });
  const [me, ...rest] = sb.heroes as [EntityId, ...EntityId[]];
  sb.hero(me).abilities.ap = 99;
  tiers.forEach((tier, slot) => {
    for (let t = 0; t < tier; t++) {
      sb.upgrade(me, slot);
      sb.step();
    }
  });
  return { sb, me, foe: rest[0] as EntityId, rest };
}
const hitsOn = (sb: Sandbox, me: EntityId, foe: EntityId, ability?: string) =>
  sb.eventsOf('damage.applied').filter((e) => e.source === me && e.target === foe && (ability === undefined || e.ability === ability));
const footwork = (sb: Sandbox, me: EntityId): number => sb.hero(me).statuses.find((s) => s.def.id === 'secretarybird.footwork')?.stacks ?? 0;
const STAMP = 'secretarybird.snakeStamp';

describe('Secretarybird', () => {
  it('has a valid, implemented kit with a swatch', () => {
    expect(validateKit(secretarybird)).toEqual([]);
    expect(secretarybird.implemented).toBe(true);
    expect(secretarybirdDef.swatch).toBeDefined();
  });

  describe('Quill Pair (hitscan, 11 Talon, 28 rounds, 8 shots/s, 1.8 s reload)', () => {
    it('deals 11 per quill and 11 x 1.65 on the head', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(8) }]);
      expect(sb.hero(me).weapon.ammo).toBe(28);
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.step(3);
      sb.fire(me, false);
      for (const e of hitsOn(sb, me, foe)) expect([e.beakShot, e.amount]).toEqual([false, expect.closeTo(11, 1)]);
      sb.clearEvents();
      sb.step(TICK_RATE);
      sb.aimAt(me, foe, 'head');
      sb.fire(me);
      sb.step(3);
      for (const e of hitsOn(sb, me, foe)) expect([e.beakShot, e.amount]).toEqual([true, expect.closeTo(11 * 1.65, 1)]);
    });
  });

  describe('Stomp Kick and Footwork', () => {
    it('deals 80 Song damage and knocks the hero back 7 m', async () => {
      const { sb, me, foe } = await setup();
      sb.cast(me, 0, sb.pointOf(foe));
      sb.step(TICK_RATE * 2);
      const hits = hitsOn(sb, me, foe, 'secretarybird.stompKick');
      expect(hits).toHaveLength(1);
      expect(hits[0]).toMatchObject({ damageType: 'song', amount: expect.closeTo(80, 1) });
      expect(sb.entity(foe).pos.z - 3).toBeCloseTo(7, 0);
      expect(footwork(sb, me)).toBe(0); // its own hit gives none
    });

    it('stuns 1 s when the knockback hits a wall', async () => {
      const sb = await createSandbox({ heroes: [{ hero: 'secretarybird', at: AT(0), yaw: Math.PI / 2 }, { hero: FOE, at: { x: 3.5, y: 0, z: 0 } }] });
      const [me, foe] = sb.heroes as [EntityId, EntityId];
      const stunned: number[] = [];
      sb.ctx.bus.on('status.applied', (e) => {
        if (e.target === foe && e.status === 'stun') stunned.push((e.expiresAt - sb.sim.tick) / TICK_RATE);
      });
      sb.cast(me, 0, sb.pointOf(foe));
      sb.step(TICK_RATE * 2);
      expect(stunned).toHaveLength(1); // the arena's crate at x 7-9 stops the 7 m knockback
      expect(stunned[0]).toBeCloseTo(1, 1);
    });

    it('an ability hit gives Footwork; Stomp spends all stacks for +20% damage each', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(3) }]);
      sb.cast(me, 2, AT(3));
      sb.step(TICK_RATE);
      expect(footwork(sb, me)).toBeGreaterThanOrEqual(1);
      sb.apply({ kind: 'applyStatus', status: FOOTWORK, durationS: 5, stacks: 2 }, me, sb.cause(me)); // two more, to make three
      expect(footwork(sb, me)).toBe(3);
      sb.place(foe, AT(sb.entity(me).pos.z + 3));
      sb.step(TICK_RATE);
      sb.clearEvents();
      sb.cast(me, 0, sb.pointOf(foe));
      sb.step(3);
      const hit = hitsOn(sb, me, foe, 'secretarybird.stompKick')[0];
      expect(hit?.amount).toBeCloseTo(80 * 1.6, 1);
      expect(footwork(sb, me)).toBe(0);
      expect(sb.ctx.stats.get(me, 'songDamage')).toBe(0);
    });

    it('T1 +25 damage, T2 -2 s cooldown, T3 two charges', async () => {
      const { sb, me, foe } = await setup(undefined, [3, 0, 0, 0]);
      expect(sb.hero(me).abilities.slots[0]?.charges).toBe(2);
      sb.cast(me, 0, sb.pointOf(foe));
      sb.step(3);
      expect(hitsOn(sb, me, foe, 'secretarybird.stompKick')[0]?.amount).toBeCloseTo(105, 1);
      expect(sb.hero(me).abilities.slots[0]?.cooldownTicks).toBe(7 * TICK_RATE);
    });
  });

  describe('Long Stride', () => {
    it('dashes 10 m through a hero, slowing it 25% and giving 1 Footwork', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(5) }]);
      sb.cast(me, 1, AT(20));
      sb.step(TICK_RATE);
      expect(sb.entity(me).pos.z).toBeGreaterThan(8.5);
      expect(sb.statuses(foe)).toContain('slow');
      expect(sb.ctx.stats.get(foe, 'slow')).toBeCloseTo(0.25, 3);
      expect(footwork(sb, me)).toBe(1);
      expect(sb.hero(me).abilities.slots[1]?.charges).toBe(1);
    });

    it('T1 holds 3 charges, T2 7 s cooldown, T3 gives +30% fire rate per dash', async () => {
      const { sb, me } = await setup([], [0, 3, 0, 0]);
      expect(sb.hero(me).abilities.slots[1]?.charges).toBe(3);
      sb.cast(me, 1, AT(20));
      sb.step(3);
      expect(sb.hero(me).abilities.slots[1]?.cooldownTicks).toBe(7 * TICK_RATE);
      expect(sb.ctx.stats.get(me, 'fireRate')).toBeCloseTo(0.3, 3);
      sb.step(TICK_RATE * 3.5);
      expect(sb.ctx.stats.get(me, 'fireRate')).toBe(0);
    });
  });

  describe('Snake Stamp', () => {
    it('leaps to the point and lands for 100 Song damage and a 40% slow', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(12) }]);
      sb.cast(me, 2, AT(10));
      sb.step(TICK_RATE * 1.5);
      const hits = hitsOn(sb, me, foe, STAMP);
      expect(hits).toHaveLength(1);
      expect(hits[0]?.amount).toBeCloseTo(100, 1);
      expect(sb.ctx.stats.get(foe, 'slow')).toBeCloseTo(0.4, 3);
      expect(sb.ctx.stats.has(foe, 'stunned')).toBe(false);
      expect(footwork(sb, me)).toBe(1);
    });

    it('T1 5 m radius, T2 -3 s cooldown, T3 stuns 0.6 s instead of slowing', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(14.5) }], [0, 0, 3, 0]);
      sb.cast(me, 2, AT(10));
      sb.step(TICK_RATE * 0.7);
      expect(hitsOn(sb, me, foe, STAMP)).toHaveLength(1); // 4.5 m from the landing, inside the T1 radius
      expect(sb.ctx.stats.get(foe, 'slow')).toBe(0);
      expect(sb.ctx.stats.has(foe, 'stunned')).toBe(true);
      sb.step(TICK_RATE * 0.7);
      expect(sb.ctx.stats.has(foe, 'stunned')).toBe(false); // 0.6 s
      expect(sb.hero(me).abilities.slots[2]?.cooldownTicks).toBe(10 * TICK_RATE);
    });
  });

  describe('Viper Dance', () => {
    it('locks on for 2 s: 6 kicks of 40 Song damage each stun 0.35 s, the last knocks back 10 m; unstoppable throughout', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(4) }]);
      sb.cast(me, 3, sb.pointOf(foe));
      sb.step(5);
      expect(sb.ctx.stats.has(me, 'unstoppable')).toBe(true);
      sb.step(TICK_RATE * 1.5);
      expect(Math.hypot(sb.entity(me).pos.x - sb.entity(foe).pos.x, sb.entity(me).pos.z - sb.entity(foe).pos.z)).toBeLessThan(2.5);
      sb.step(TICK_RATE * 1);
      const kicks = hitsOn(sb, me, foe, 'secretarybird.viperDance');
      expect(kicks).toHaveLength(6);
      for (const k of kicks) expect(k.amount).toBeCloseTo(40, 1);
      expect(Math.abs(sb.entity(foe).pos.z - sb.entity(me).pos.z)).toBeGreaterThan(7);
      expect(sb.ctx.stats.has(me, 'unstoppable')).toBe(false);
    });

    it('ends early when the target dies', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(4) }]);
      sb.cast(me, 3, sb.pointOf(foe));
      sb.step(TICK_RATE * 0.8);
      sb.health(foe).hp = 1;
      sb.step(TICK_RATE);
      expect(sb.health(foe).dead).toBe(true);
      expect(sb.ctx.stats.has(me, 'unstoppable')).toBe(false);
      expect(hitsOn(sb, me, foe, 'secretarybird.viperDance').length).toBeLessThan(6);
    });

    it('T1 eight kicks, T2 75 s cooldown, T3 the last kick resets Long Stride and gives 3 Footwork', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(4) }], [0, 0, 0, 3]);
      sb.cast(me, 1, AT(20)); // spend a Long Stride charge first
      sb.step(TICK_RATE);
      sb.place(foe, AT(sb.entity(me).pos.z + 4));
      sb.step(2);
      const before = sb.hero(me).abilities.slots[1]?.charges;
      sb.cast(me, 3, sb.pointOf(foe));
      sb.step(TICK_RATE * 2.5);
      expect(hitsOn(sb, me, foe, 'secretarybird.viperDance')).toHaveLength(8);
      expect(sb.hero(me).abilities.slots[3]?.cooldownTicks).toBe(75 * TICK_RATE);
      expect(footwork(sb, me)).toBe(3);
      expect(sb.hero(me).abilities.slots[1]?.charges).toBeGreaterThan(before ?? 0);
    });
  });
});
