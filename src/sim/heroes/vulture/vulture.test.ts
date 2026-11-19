/** Vulture smoke tests (GDD §9.14): the gun, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import type { EntityId, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { validateKit } from '../../abilities/kit';
import { vultureDef } from '../../data/heroes/vulture';
import { vulture } from './index';

const FAR: Vec3 = { x: 0, y: 0, z: -10 };
const NEAR: Vec3 = { x: 0, y: 0, z: 5 };
/** Five metres in front of the caster: inside Pick the Bones' 8 m cone. */
const CLOSE: Vec3 = { x: 0, y: 0, z: -5 };

/** Vulture (Dawn) with the given tiers bought, a Pelican (Dusk) and optionally an Owl ally (Dawn). */
async function setup(tiers: readonly number[] = [0, 0, 0, 0], foeAt: Vec3 = NEAR, from: Vec3 = FAR, allyAt?: Vec3) {
  const sb = await createSandbox({
    heroes: [
      { hero: 'vulture', at: from },
      { hero: 'pelican', at: foeAt },
      ...(allyAt ? [{ hero: 'owl' as const, at: allyAt, team: 'dawn' as const }] : []),
    ],
  });
  const [me, foe, ally] = sb.heroes as [EntityId, EntityId, EntityId];
  sb.hero(me).abilities.ap = 99;
  tiers.forEach((tier, slot) => {
    for (let t = 0; t < tier; t++) {
      sb.upgrade(me, slot);
      sb.step();
    }
  });
  return { sb, me, foe, ally };
}

const hitsOn = (sb: Sandbox, me: EntityId, foe: EntityId, ability?: string) =>
  sb.eventsOf('damage.applied').filter((e) => e.source === me && e.target === foe && (ability === undefined || e.ability === ability));
const total = (hits: readonly { amount: number }[]) => hits.reduce((s, h) => s + h.amount, 0);
const statusOn = (sb: Sandbox, foe: EntityId, id: string) => sb.eventsOf('status.applied').filter((e) => e.target === foe && e.status === id);

describe('Vulture', () => {
  it('has a valid, implemented kit with a swatch', () => {
    expect(validateKit(vulture)).toEqual([]);
    expect(vulture.implemented).toBe(true);
    expect(vultureDef.swatch).toBeDefined();
  });

  describe('Bone Shot (hitscan, 18 Talon, 20 rounds, 4.2 shots/s, 2.4 s reload)', () => {
    it('deals 18 per shot and 18 × 1.65 on the head', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 0], { x: 0, y: 0, z: -4 });
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.step(10);
      sb.fire(me, false);
      const body = hitsOn(sb, me, foe);
      expect(body.length).toBeGreaterThan(0);
      for (const e of body) expect([e.beakShot, e.amount]).toEqual([false, expect.closeTo(18, 1)]);
      sb.clearEvents();
      sb.step(30);
      sb.aimAt(me, foe, 'head');
      sb.fire(me);
      sb.step(10);
      const head = hitsOn(sb, me, foe);
      expect(head.length).toBeGreaterThan(0);
      for (const e of head) expect([e.beakShot, e.amount]).toEqual([true, expect.closeTo(18 * 1.65, 1)]);
    });

    it('holds 20 rounds, fires 4.2 a second and reloads in 2.4 s', async () => {
      const { sb, me } = await setup();
      expect(sb.hero(me).weapon.ammo).toBe(20);
      const fired: number[] = [];
      sb.ctx.bus.on('weapon.fired', () => fired.push(sb.sim.tick));
      let started = 0;
      let done = 0;
      sb.ctx.bus.on('weapon.reload', (e) => (e.done ? (done = sb.sim.tick) : (started = sb.sim.tick)));
      sb.fire(me);
      sb.stepUntil(() => done > 0, 900);
      expect(fired.filter((t) => t <= started)).toHaveLength(20);
      expect(Math.abs((fired[4] as number) - (fired[0] as number) - (4 * TICK_RATE) / 4.2)).toBeLessThanOrEqual(1);
      expect(done - started).toBe(Math.round(2.4 * TICK_RATE));
    });
  });

  describe('Carrion Circle', () => {
    it('after 1 s damages 20 a second for 7 s and cuts healing 30%', async () => {
      const { sb, me, foe } = await setup();
      sb.cast(me, 0, NEAR);
      sb.step(TICK_RATE * 0.9);
      expect(hitsOn(sb, me, foe, 'vulture.carrionCircle')).toHaveLength(0); // not yet circling
      sb.step(TICK_RATE * 1);
      expect(sb.ctx.stats.get(foe, 'healReduction')).toBeCloseTo(0.3, 3);
      sb.step(TICK_RATE * 8);
      const hits = hitsOn(sb, me, foe, 'vulture.carrionCircle');
      expect(total(hits)).toBeGreaterThan(20 * 7 - 11);
      expect(total(hits)).toBeLessThanOrEqual(20 * 7 + 0.5);
      for (const h of hits) expect([h.amount, h.damageType]).toEqual([expect.closeTo(10, 1), 'song']);
      expect(sb.ctx.stats.get(foe, 'healReduction')).toBe(0); // gone after the 7 s
      expect(sb.hero(me).abilities.slots[0]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('T3 (with T1, T2): 8 m wide, 50% heal reduction, double damage below 50% HP', async () => {
      const { sb, me, foe } = await setup([3, 0, 0, 0], { x: 7, y: 0, z: 5 });
      const max = sb.ctx.stats.get(foe, 'maxHealth');
      sb.health(foe).hp = max * 0.4;
      sb.cast(me, 0, NEAR);
      sb.step(TICK_RATE * 2);
      expect(sb.ctx.stats.get(foe, 'healReduction')).toBeCloseTo(0.5, 3); // 7 m out: only inside with the +2 m
      const hits = hitsOn(sb, me, foe, 'vulture.carrionCircle');
      expect(hits.length).toBeGreaterThan(0);
      for (const h of hits) expect(h.amount).toBeCloseTo(20, 1);
    });
  });

  describe('Pick the Bones', () => {
    it('hits for 50, shreds 12% Talon resist and heals you half of it', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 0], CLOSE);
      sb.health(me).hp = 300;
      sb.cast(me, 1, foe);
      sb.step(5);
      const hits = hitsOn(sb, me, foe, 'vulture.pickTheBones');
      expect(hits).toHaveLength(1);
      expect(hits[0]?.amount).toBeCloseTo(50, 1);
      expect(sb.ctx.stats.get(foe, 'talonShred')).toBeCloseTo(0.12, 3);
      expect(sb.health(me).hp).toBeCloseTo(325, 0);
      expect(sb.hero(me).abilities.slots[1]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('does not keep healing you from other Song damage afterwards', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 0], CLOSE);
      sb.cast(me, 1, foe);
      sb.step(TICK_RATE);
      sb.health(me).hp = 300;
      sb.apply({ kind: 'damage', amount: 100, type: 'song' }, foe, sb.cause(me));
      sb.step(3);
      expect(sb.health(me).hp).toBeCloseTo(300, 0);
    });

    it('T3 (with T1, T2): 75 damage, shred 18%, two charges', async () => {
      const { sb, me, foe } = await setup([0, 3, 0, 0], CLOSE);
      expect(sb.hero(me).abilities.slots[1]?.charges).toBe(2);
      sb.cast(me, 1, foe);
      sb.step(5);
      expect(hitsOn(sb, me, foe, 'vulture.pickTheBones')[0]?.amount).toBeCloseTo(75, 1);
      expect(sb.ctx.stats.get(foe, 'talonShred')).toBeCloseTo(0.18, 3);
      expect(sb.hero(me).abilities.slots[1]?.charges).toBe(1);
    });
  });

  describe('Thermal', () => {
    it('lifts an allied hero that enters the column 10 m and lets it glide', async () => {
      const { sb, me, ally } = await setup([0, 0, 0, 0], { x: 30, y: 0, z: 30 }, FAR, NEAR);
      sb.cast(me, 2, NEAR);
      sb.step(TICK_RATE * 1.5);
      expect(sb.entity(ally).pos.y).toBeGreaterThan(5);
      expect(sb.hero(ally).motor.mode).toBe('glide');
      expect(sb.hero(me).abilities.slots[2]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('T3 (with T1, T2): cooldown 18 s, and allies leaving the column get +20% damage for 4 s', async () => {
      const { sb, me, ally } = await setup([0, 0, 3, 0], { x: 30, y: 0, z: 30 }, FAR, NEAR);
      sb.cast(me, 2, NEAR);
      sb.step(TICK_RATE * 3); // the glide carries the Owl out of the 3 m column
      expect(statusOn(sb, ally, 'vulture.thermalBoost').length).toBeGreaterThan(0);
      expect(sb.ctx.stats.get(ally, 'gunDamage')).toBeCloseTo(0.2, 3);
      expect(sb.hero(me).abilities.slots[2]?.cooldownTicks).toBe(18 * TICK_RATE);
    });
  });

  describe('Death Spiral', () => {
    it('is locked before level 6 and usable at 6', async () => {
      const sb = await createSandbox({ heroes: [{ hero: 'vulture', at: FAR }, { hero: 'pelican', at: NEAR }], options: { unlockAbilities: false } });
      const [me] = sb.heroes as [EntityId];
      expect(sb.hero(me).abilities.slots[3]?.unlocked).toBe(false);
      sb.cast(me, 3, NEAR);
      sb.step(5);
      expect(sb.hero(me).abilities.slots[3]?.readyAt).toBe(0);
      sb.ctx.bus.emit({ type: 'hero.level', hero: me, level: 6, ap: 0, unlockSlot: 3 });
      sb.step();
      expect(sb.hero(me).abilities.slots[3]?.unlocked).toBe(true);
      sb.cast(me, 3, NEAR);
      sb.step(5);
      expect(sb.hero(me).abilities.slots[3]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('pulls enemies toward the centre, grounds them and deals 40 a second for 5 s', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 0], { x: 0, y: 0, z: 13 });
      sb.cast(me, 3, NEAR); // centre z 5: the Pelican starts 8 m out
      sb.step(TICK_RATE * 2);
      expect(sb.entity(foe).pos.z).toBeLessThan(11);
      expect(statusOn(sb, foe, 'grounded').length).toBeGreaterThan(0);
      sb.step(TICK_RATE * 4);
      const hits = hitsOn(sb, me, foe, 'vulture.deathSpiral');
      expect(total(hits)).toBeGreaterThan(40 * 5 - 21);
      expect(total(hits)).toBeLessThanOrEqual(40 * 5 + 0.5);
      expect(sb.hero(me).abilities.slots[3]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('T3 (with T1, T2): lasts 7 s, pulls 5 m/s and ends with a 150 burst', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 3], NEAR);
      sb.cast(me, 3, NEAR);
      sb.step(TICK_RATE * 6.5);
      expect(hitsOn(sb, me, foe, 'vulture.deathSpiral').some((h) => Math.abs(h.amount - 150) < 1)).toBe(false);
      sb.step(TICK_RATE * 1.5);
      const hits = hitsOn(sb, me, foe, 'vulture.deathSpiral');
      expect(hits.filter((h) => Math.abs(h.amount - 150) < 1)).toHaveLength(1);
      expect(total(hits.filter((h) => h.amount < 100))).toBeGreaterThan(40 * 7 - 21);
    });
  });
});
