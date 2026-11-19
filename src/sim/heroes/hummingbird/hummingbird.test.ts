/** Hummingbird smoke tests (GDD §9.16): the gun, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import { Button } from '../../core/contracts';
import type { EntityId, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { validateKit } from '../../abilities/kit';
import { hummingbirdDef } from '../../data/heroes/hummingbird';
import { hummingbird } from './index';

const FAR: Vec3 = { x: 0, y: 0, z: -10 };
const NEAR: Vec3 = { x: 0, y: 0, z: 5 };
/** Five metres in front of the caster: inside Nectar Sip's 6 m reach. */
const CLOSE: Vec3 = { x: 0, y: 0, z: -5 };
/** A slightly upward aim straight ahead (+z) from FAR: a dash follows the pitch, so a downward one would dig into the ground. */
const AHEAD: Vec3 = { x: 0, y: 2.5, z: 10 };

/** Hummingbird (Dawn) with the given tiers bought and a Pelican (Dusk); no regeneration. */
async function setup(tiers: readonly number[] = [0, 0, 0, 0], foeAt: Vec3 = NEAR, from: Vec3 = FAR) {
  const sb = await createSandbox({ heroes: [{ hero: 'hummingbird', at: from }, { hero: 'pelican', at: foeAt }] });
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
const charges = (sb: Sandbox, me: EntityId, slot: number) => sb.hero(me).abilities.slots[slot]?.charges;
const tetherEnds = (sb: Sandbox) => sb.eventsOf('tether').filter((e) => e.stage === 'end');

describe('Hummingbird', () => {
  it('has a valid, implemented kit with a swatch', () => {
    expect(validateKit(hummingbird)).toEqual([]);
    expect(hummingbird.implemented).toBe(true);
    expect(hummingbirdDef.swatch).toBeDefined();
  });

  describe('Nectar Needler (hitscan, 6 Talon, 45 rounds, 13 shots/s, 1.8 s reload)', () => {
    it('deals 6 per shot and 6 × 1.65 on the head', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 0], { x: 0, y: 0, z: -8 });
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.step(10);
      sb.fire(me, false);
      const body = hitsOn(sb, me, foe);
      expect(body.length).toBeGreaterThan(0);
      for (const e of body) expect([e.beakShot, e.amount]).toEqual([false, expect.closeTo(6, 1)]);
      sb.clearEvents();
      sb.step(30);
      sb.aimAt(me, foe, 'head');
      sb.fire(me);
      sb.step(10);
      const head = hitsOn(sb, me, foe).filter((e) => e.beakShot);
      expect(head.length).toBeGreaterThan(0);
      for (const e of head) expect(e.amount).toBeCloseTo(6 * 1.65, 1);
    });

    it('holds 45 rounds, fires 13 a second and reloads in 1.8 s', async () => {
      const { sb, me } = await setup();
      expect(sb.hero(me).weapon.ammo).toBe(45);
      const fired: number[] = [];
      sb.ctx.bus.on('weapon.fired', () => fired.push(sb.sim.tick));
      let started = 0;
      let done = 0;
      sb.ctx.bus.on('weapon.reload', (e) => (e.done ? (done = sb.sim.tick) : (started = sb.sim.tick)));
      sb.fire(me);
      sb.stepUntil(() => done > 0, 900);
      expect(fired.filter((t) => t <= started)).toHaveLength(45);
      expect(Math.abs((fired[13] as number) - (fired[0] as number) - TICK_RATE)).toBeLessThanOrEqual(1);
      expect(done - started).toBe(Math.round(1.8 * TICK_RATE));
    });
  });

  describe('Hover (passive)', () => {
    /** A jump (a press, then held) from the ground: the 1.6 m apex is reached at about 0.4 s. */
    const jump = (sb: Sandbox, me: EntityId) => {
      sb.press(me, Button.Jump);
      sb.hold(me, Button.Jump);
    };

    it('holding Space at the top of a jump holds your height for 1.5 s, then you fall', async () => {
      const { sb, me } = await setup([0, 0, 0, 0], { x: 30, y: 0, z: 30 });
      jump(sb, me);
      sb.step(TICK_RATE * 1.7); // 1.3 s into the hover
      expect(sb.entity(me).pos.y).toBeGreaterThan(1.5);
      expect(sb.hero(me).motor.grounded).toBe(false);
      sb.step(TICK_RATE * 0.5); // the 1.5 s is up around 1.9 s and gravity takes over
      expect(sb.entity(me).pos.y).toBeLessThan(1);
    });

    it('without Space you fall at once', async () => {
      const { sb, me } = await setup([0, 0, 0, 0], { x: 30, y: 0, z: 30 });
      sb.press(me, Button.Jump);
      sb.step(TICK_RATE * 0.8); // a plain jump is over in about 0.65 s
      expect(sb.hero(me).motor.grounded).toBe(true);
    });

    it('recharges on landing', async () => {
      const { sb, me } = await setup([0, 0, 0, 0], { x: 30, y: 0, z: 30 });
      jump(sb, me);
      sb.step(TICK_RATE * 2.6); // hovered, fell and landed
      expect(sb.hero(me).motor.grounded).toBe(true);
      sb.release(me, Button.Jump);
      sb.step(5);
      jump(sb, me);
      sb.step(TICK_RATE * 1.7);
      expect(sb.entity(me).pos.y).toBeGreaterThan(1.5); // a full second hover
    });
  });

  describe('Dart', () => {
    it('dashes 8 m along the aim, straight up included, and has three charges', async () => {
      const { sb, me } = await setup();
      expect(charges(sb, me, 0)).toBe(3);
      sb.cast(me, 0, AHEAD);
      sb.step(TICK_RATE * 0.4);
      expect(sb.entity(me).pos.z + 10).toBeGreaterThan(7);
      expect(charges(sb, me, 0)).toBe(2);
      expect(sb.hero(me).abilities.slots[0]?.readyAt).toBeGreaterThan(sb.sim.tick);
      sb.place(me, { x: 0, y: 0, z: 20 });
      sb.step(TICK_RATE);
      sb.cast(me, 0, { x: 0, y: 40, z: 20.1 });
      sb.step(TICK_RATE * 0.3);
      expect(sb.entity(me).pos.y).toBeGreaterThan(5);
    });

    it('T3 (with T1, T2): 4 charges, 5 s cooldown, and the next shot within 1 s deals +60%', async () => {
      const { sb, me, foe } = await setup([3, 0, 0, 0], { x: 0, y: 0, z: -8 });
      expect(charges(sb, me, 0)).toBe(4);
      sb.cast(me, 0, { x: 0, y: 2.5, z: -40 }); // away from the Pelican, which stays 10+ m off
      sb.step(TICK_RATE * 0.3);
      expect(sb.hero(me).abilities.slots[0]?.cooldownTicks).toBe(5 * TICK_RATE);
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.step(15);
      sb.fire(me, false);
      const hits = hitsOn(sb, me, foe);
      expect(hits.length).toBeGreaterThan(2);
      expect(hits[0]?.amount).toBeCloseTo(6 * 1.6, 1);
      for (const h of hits.slice(1)) expect(h.amount).toBeCloseTo(6, 1);
    });
  });

  describe('Nectar Sip', () => {
    it('drains 40 a second for 2 s and heals you the same', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 0], CLOSE);
      sb.health(me).hp = 300;
      sb.cast(me, 1, foe);
      sb.step(TICK_RATE * 2.6);
      const hits = hitsOn(sb, me, foe, 'hummingbird.nectarSip');
      expect(total(hits)).toBeGreaterThan(40 * 2 - 21);
      expect(total(hits)).toBeLessThanOrEqual(40 * 2 + 0.5);
      for (const h of hits) expect([h.amount, h.damageType]).toEqual([expect.closeTo(20, 1), 'song']);
      expect(sb.health(me).hp).toBeCloseTo(300 + total(hits), 0);
      expect(sb.eventsOf('tether').map((e) => e.stage)).toEqual(['start', 'end']);
      expect(sb.hero(me).abilities.slots[1]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('fails on an enemy beyond 6 m, and breaks beyond 12 m', async () => {
      const far = await setup([0, 0, 0, 0], { x: 0, y: 0, z: -2 }); // 8 m
      far.sb.cast(far.me, 1, far.foe);
      far.sb.step(TICK_RATE);
      expect(far.sb.eventsOf('tether')).toHaveLength(0);
      const { sb, me, foe } = await setup([0, 0, 0, 0], CLOSE);
      sb.cast(me, 1, foe);
      sb.step(TICK_RATE * 0.3);
      sb.place(foe, { x: 0, y: 0, z: 3 }); // 13 m
      sb.step(TICK_RATE * 0.5);
      expect(tetherEnds(sb)).toHaveLength(1);
      expect(hitsOn(sb, me, foe, 'hummingbird.nectarSip')).toHaveLength(0);
    });

    it('T3 (with T1, T2): 3 s, reaches 10 m, breaks at 16 m, and slows 30%', async () => {
      const { sb, me, foe } = await setup([0, 3, 0, 0], { x: 0, y: 0, z: -1 }); // 9 m: beyond the base 6 m
      sb.cast(me, 1, foe);
      sb.step(TICK_RATE * 0.3);
      sb.place(foe, { x: 0, y: 0, z: 5 }); // 15 m: past 12, inside 16
      sb.step(TICK_RATE * 3.5);
      expect(hitsOn(sb, me, foe, 'hummingbird.nectarSip')).toHaveLength(6);
      expect(sb.ctx.stats.get(foe, 'slow')).toBe(0); // gone with the tether
      expect(sb.eventsOf('status.applied').filter((e) => e.target === foe && e.status === 'slow').length).toBeGreaterThan(0);
    });

    it('does not slow before T3', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 0], CLOSE);
      sb.cast(me, 1, foe);
      sb.step(TICK_RATE * 2.6);
      expect(sb.eventsOf('status.applied').filter((e) => e.target === foe && e.status === 'slow')).toHaveLength(0);
    });
  });

  describe('Blur', () => {
    it('gives +40% move speed and +40% Talon resist for 2 s', async () => {
      const { sb, me } = await setup();
      sb.cast(me, 2);
      sb.step(3);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(7.4 * 1.4, 2);
      expect(sb.ctx.stats.get(me, 'talonResist')).toBeCloseTo(0.4, 3);
      expect(sb.ctx.stats.get(me, 'songResist')).toBe(0);
      sb.step(TICK_RATE * 2);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(7.4, 2);
      expect(sb.hero(me).abilities.slots[2]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('T3 (with T1, T2): 3 s, also +40% Song resist, cooldown 10 s', async () => {
      const { sb, me } = await setup([0, 0, 3, 0]);
      sb.cast(me, 2);
      sb.step(3);
      expect(sb.ctx.stats.get(me, 'songResist')).toBeCloseTo(0.4, 3);
      expect(sb.hero(me).abilities.slots[2]?.cooldownTicks).toBe(10 * TICK_RATE);
      sb.step(TICK_RATE * 2.5);
      expect(sb.ctx.stats.get(me, 'talonResist')).toBeCloseTo(0.4, 3); // 2.6 s in: it lasts 3
      sb.step(TICK_RATE);
      expect(sb.ctx.stats.get(me, 'talonResist')).toBe(0);
    });
  });

  describe('Thousand Beats', () => {
    it('is locked before level 6 and usable at 6', async () => {
      const sb = await createSandbox({ heroes: [{ hero: 'hummingbird', at: FAR }, { hero: 'pelican', at: NEAR }], options: { unlockAbilities: false } });
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

    it('a Dart without it hurts nobody; with it, it deals 100, refunds a charge and Dart holds 5', async () => {
      const plain = await setup([0, 0, 0, 0], { x: 0, y: 0, z: -4 });
      plain.sb.cast(plain.me, 0, AHEAD);
      plain.sb.step(TICK_RATE * 0.4);
      expect(hitsOn(plain.sb, plain.me, plain.foe)).toHaveLength(0);

      const { sb, me, foe } = await setup([0, 0, 0, 0], { x: 0, y: 0, z: -4 });
      sb.cast(me, 3);
      sb.step(8);
      expect(charges(sb, me, 0)).toBe(5); // 3 + 2, both filled now
      sb.cast(me, 0, AHEAD);
      sb.step(TICK_RATE * 0.4);
      const hits = hitsOn(sb, me, foe);
      expect(hits).toHaveLength(1);
      expect(hits[0]?.amount).toBeCloseTo(100, 1);
      expect(charges(sb, me, 0)).toBe(5); // one spent, one refunded
      sb.step(TICK_RATE * 5);
      expect(charges(sb, me, 0)).toBe(3); // the wings are wings again
      expect(sb.hero(me).abilities.slots[3]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('T3 (with T1, T2): 140 damage and a 0.75 s silence on each Dart hit', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 3], { x: 0, y: 0, z: -4 });
      const silenced: number[] = [];
      sb.ctx.bus.on('status.applied', (e) => {
        if (e.target === foe && e.status === 'silence') silenced.push((e.expiresAt - sb.sim.tick) / TICK_RATE);
      });
      sb.cast(me, 3);
      sb.step(8);
      sb.cast(me, 0, AHEAD);
      sb.step(TICK_RATE * 0.4);
      expect(hitsOn(sb, me, foe)[0]?.amount).toBeCloseTo(140, 1);
      expect(silenced[0]).toBeCloseTo(0.75, 1);
      expect(sb.hero(me).abilities.slots[3]?.cooldownTicks).toBe(90 * TICK_RATE);
    });
  });
});
