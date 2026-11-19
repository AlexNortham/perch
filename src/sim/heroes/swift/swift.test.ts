/** Swift smoke tests (GDD §9.15): the gun, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import { Button } from '../../core/contracts';
import type { EntityId, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { validateKit } from '../../abilities/kit';
import { swiftDef } from '../../data/heroes/swift';
import { swift } from './index';

const FAR: Vec3 = { x: 0, y: 0, z: -10 };
const NEAR: Vec3 = { x: 0, y: 0, z: 5 };
/** Four metres in front of the caster. */
const CLOSE: Vec3 = { x: 0, y: 0, z: -6 };
/** A slightly upward aim straight ahead (+z) from FAR: a dash follows the pitch, so a downward one would dig into the ground. */
/** Wing Scythe flies along the aim and ends on the ground, so it is thrown level, not at the target's body. */
const LEVEL: Vec3 = { x: 0, y: 1.5, z: 20 };
const AHEAD: Vec3 = { x: 0, y: 2.5, z: 10 };

/** Swift (Dawn) with the given tiers bought and a Pelican (Dusk); no regeneration. */
async function setup(tiers: readonly number[] = [0, 0, 0, 0], foeAt: Vec3 = NEAR, from: Vec3 = FAR) {
  const sb = await createSandbox({ heroes: [{ hero: 'swift', at: from }, { hero: 'pelican', at: foeAt }] });
  const [me, foe] = sb.heroes as [EntityId, EntityId];
  sb.hero(me).abilities.ap = 99;
  tiers.forEach((tier, slot) => {
    for (let t = 0; t < tier; t++) {
      sb.upgrade(me, slot);
      sb.step();
    }
  });
  return { sb, me, foe };
}

const hitsOn = (sb: Sandbox, me: EntityId, foe: EntityId, ability?: string) =>
  sb.eventsOf('damage.applied').filter((e) => e.source === me && e.target === foe && (ability === undefined || e.ability === ability));
const total = (hits: readonly { amount: number }[]) => hits.reduce((s, h) => s + h.amount, 0);
const statusOn = (sb: Sandbox, foe: EntityId, id: string) => sb.eventsOf('status.applied').filter((e) => e.target === foe && e.status === id);

describe('Swift', () => {
  it('has a valid, implemented kit with a swatch', () => {
    expect(validateKit(swift)).toEqual([]);
    expect(swift.implemented).toBe(true);
    expect(swiftDef.swatch).toBeDefined();
  });

  describe('Sickle SMG (hitscan, 7 Talon, 42 rounds, 12 shots/s, 1.6 s reload)', () => {
    it('deals 7 per shot and 7 × 1.65 on the head', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 0], { x: 0, y: 0, z: -8 });
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.step(10);
      sb.fire(me, false);
      const body = hitsOn(sb, me, foe);
      expect(body.length).toBeGreaterThan(0);
      for (const e of body) expect([e.beakShot, e.amount]).toEqual([false, expect.closeTo(7, 1)]);
      sb.clearEvents();
      sb.step(30);
      sb.aimAt(me, foe, 'head');
      sb.fire(me);
      sb.step(10);
      const head = hitsOn(sb, me, foe).filter((e) => e.beakShot);
      expect(head.length).toBeGreaterThan(0);
      for (const e of head) expect(e.amount).toBeCloseTo(7 * 1.65, 1);
    });

    it('holds 42 rounds, fires 12 a second and reloads in 1.6 s', async () => {
      const { sb, me } = await setup();
      expect(sb.hero(me).weapon.ammo).toBe(42);
      const fired: number[] = [];
      sb.ctx.bus.on('weapon.fired', () => fired.push(sb.sim.tick));
      let started = 0;
      let done = 0;
      sb.ctx.bus.on('weapon.reload', (e) => (e.done ? (done = sb.sim.tick) : (started = sb.sim.tick)));
      sb.fire(me);
      sb.stepUntil(() => done > 0, 900);
      expect(fired.filter((t) => t <= started)).toHaveLength(42);
      expect((fired[1] as number) - (fired[0] as number)).toBe(TICK_RATE / 12);
      expect(done - started).toBe(Math.round(1.6 * TICK_RATE));
    });
  });

  describe('Slipstream', () => {
    it('dashes 16 m along the aim, and has two charges', async () => {
      const { sb, me } = await setup();
      expect(sb.hero(me).abilities.slots[0]?.charges).toBe(2);
      sb.cast(me, 0, AHEAD);
      sb.step(TICK_RATE * 0.6);
      const moved = sb.entity(me).pos.z + 10; // the dash's own 16 m, plus a little momentum on leaving it
      expect(moved).toBeGreaterThan(15);
      expect(moved).toBeLessThan(19);
      expect(sb.hero(me).abilities.slots[0]?.charges).toBe(1);
      expect(sb.hero(me).abilities.slots[0]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('T3 (with T1, T2): 3 charges, 7 s cooldown, and 50 Song damage to an enemy passed through', async () => {
      const { sb, me, foe } = await setup([3, 0, 0, 0], { x: 0, y: 0, z: 0 });
      expect(sb.hero(me).abilities.slots[0]?.charges).toBe(3);
      sb.cast(me, 0, AHEAD);
      sb.step(TICK_RATE * 0.6);
      const hits = hitsOn(sb, me, foe, 'swift.slipstream');
      expect(hits).toHaveLength(1);
      expect(hits[0]?.amount).toBeCloseTo(50, 1);
      expect(sb.hero(me).abilities.slots[0]?.cooldownTicks).toBe(7 * TICK_RATE);
    });

    it('does no damage to an enemy before T3', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 0], { x: 0, y: 0, z: 0 });
      sb.cast(me, 0, AHEAD);
      sb.step(TICK_RATE * 0.6);
      expect(hitsOn(sb, me, foe, 'swift.slipstream')).toHaveLength(0);
    });
  });

  describe('Screaming Party', () => {
    it('hurts 25 a second, slows 15% and speeds you 20% for 4 s', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 0], CLOSE);
      sb.cast(me, 1);
      sb.step(TICK_RATE * 1.2);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(7.6 * 1.2, 2);
      expect(sb.ctx.stats.get(foe, 'slow')).toBeCloseTo(0.15, 3);
      sb.step(TICK_RATE * 4);
      const hits = hitsOn(sb, me, foe, 'swift.screamingParty');
      expect(total(hits)).toBeGreaterThan(25 * 4 - 13);
      expect(total(hits)).toBeLessThanOrEqual(25 * 4 + 0.5);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(7.6, 2);
      expect(sb.hero(me).abilities.slots[1]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('T3 (with T1, T2): 9 m wide, 6 s, and a 25% fire-rate slow', async () => {
      const { sb, me, foe } = await setup([0, 3, 0, 0], { x: 0, y: 0, z: -2 });
      sb.cast(me, 1);
      sb.step(TICK_RATE * 1.2);
      expect(sb.ctx.stats.get(foe, 'fireRateSlow')).toBeCloseTo(0.25, 3);
      sb.step(TICK_RATE * 5);
      expect(statusOn(sb, foe, 'slow').length).toBeGreaterThan(8); // still ticking at 6 s
      expect(total(hitsOn(sb, me, foe, 'swift.screamingParty'))).toBeGreaterThan(25 * 6 - 13);
    });
  });

  describe('Wing Scythe', () => {
    it('hits on the way out and back for 70 each and slows 25%', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 0], { x: 0, y: 0, z: 0 });
      sb.cast(me, 2, LEVEL);
      sb.step(TICK_RATE * 2);
      const hits = hitsOn(sb, me, foe, 'swift.wingScythe');
      expect(hits).toHaveLength(2);
      for (const h of hits) expect(h.amount).toBeCloseTo(70, 1);
      expect(statusOn(sb, foe, 'slow').length).toBe(2);
      expect(statusOn(sb, foe, 'stun')).toHaveLength(0);
      expect(sb.hero(me).abilities.slots[2]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('T3 (with T1, T2): 95 a pass, 9 s cooldown, and the return pass stuns 0.5 s', async () => {
      const { sb, me, foe } = await setup([0, 0, 3, 0], { x: 0, y: 0, z: 0 });
      const stunned: number[] = [];
      sb.ctx.bus.on('status.applied', (e) => {
        if (e.target === foe && e.status === 'stun') stunned.push((e.expiresAt - sb.sim.tick) / TICK_RATE);
      });
      sb.cast(me, 2, LEVEL);
      sb.step(TICK_RATE * 0.6); // out, not yet back
      expect(hitsOn(sb, me, foe, 'swift.wingScythe')).toHaveLength(1);
      expect(stunned).toHaveLength(0);
      sb.step(TICK_RATE * 1.4);
      const hits = hitsOn(sb, me, foe, 'swift.wingScythe');
      expect(hits).toHaveLength(2);
      for (const h of hits) expect(h.amount).toBeCloseTo(95, 1);
      expect(stunned).toHaveLength(1);
      expect(stunned[0]).toBeCloseTo(0.5, 1);
      expect(sb.hero(me).abilities.slots[2]?.cooldownTicks).toBe(9 * TICK_RATE);
    });
  });

  describe('Sky Stitch', () => {
    it('is locked before level 6 and usable at 6', async () => {
      const sb = await createSandbox({ heroes: [{ hero: 'swift', at: FAR }, { hero: 'pelican', at: NEAR }], options: { unlockAbilities: false } });
      const [me] = sb.heroes as [EntityId];
      expect(sb.hero(me).abilities.slots[3]?.unlocked).toBe(false);
      sb.cast(me, 3);
      sb.step(5);
      expect(sb.hero(me).abilities.slots[3]?.readyAt).toBe(0);
      sb.ctx.bus.emit({ type: 'hero.level', hero: me, level: 6, ap: 0, unlockSlot: 3 });
      sb.step();
      expect(sb.hero(me).abilities.slots[3]?.unlocked).toBe(true);
      sb.cast(me, 3);
      sb.step(5);
      expect(sb.hero(me).abilities.slots[3]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('flies for 6 s with +20% gun damage, climbs on Jump and stops at 25 m', async () => {
      const { sb, me } = await setup();
      sb.cast(me, 3);
      sb.step(5);
      expect(sb.hero(me).motor.mode).toBe('flight');
      expect(sb.ctx.stats.get(me, 'gunDamage')).toBeCloseTo(0.2, 3);
      sb.hold(me, Button.Jump);
      sb.step(TICK_RATE * 1);
      expect(sb.entity(me).pos.y).toBeGreaterThan(8);
      sb.step(TICK_RATE * 2);
      expect(sb.entity(me).pos.y).toBeLessThanOrEqual(25.01);
      expect(sb.entity(me).pos.y).toBeGreaterThan(24);
      sb.release(me, Button.Jump);
      sb.step(TICK_RATE * 3.2); // 6 s in total
      expect(sb.hero(me).motor.mode).toBeNull();
      expect(sb.ctx.stats.get(me, 'gunDamage')).toBe(0);
      expect(hitsOnSlam(sb, me)).toHaveLength(0); // no slam before T3
    });

    it('T3 (with T1, T2): 8 s, +20% fire rate, and a ground slam of 120 when it ends', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 3], FAR);
      sb.place(foe, { x: 2, y: 0, z: -10 });
      sb.cast(me, 3);
      sb.step(5);
      expect(sb.ctx.stats.get(me, 'fireRate')).toBeCloseTo(0.2, 3);
      sb.hold(me, Button.Jump);
      sb.step(TICK_RATE * 1);
      sb.release(me, Button.Jump);
      sb.step(TICK_RATE * 6);
      expect(sb.hero(me).motor.mode).toBe('flight'); // 7 s in: 8 s long
      expect(hitsOnSlam(sb, me)).toHaveLength(0);
      sb.step(TICK_RATE * 1.2);
      expect(sb.hero(me).motor.mode).toBeNull();
      const slam = hitsOn(sb, me, foe, 'swift.skyStitch');
      expect(slam).toHaveLength(1);
      expect(slam[0]?.amount).toBeCloseTo(120, 1);
    });
  });
});

const hitsOnSlam = (sb: Sandbox, me: EntityId) => sb.eventsOf('damage.applied').filter((e) => e.source === me && e.ability === 'swift.skyStitch');
