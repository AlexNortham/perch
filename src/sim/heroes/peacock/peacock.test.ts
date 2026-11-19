/** Peacock smoke tests (GDD §9.13): the gun, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import type { EntityId, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { resolveAbility, validateKit } from '../../abilities/kit';
import { peacock } from './index';
import { peacockDef } from '../../data/heroes/peacock';

const FAR: Vec3 = { x: 0, y: 0, z: -10 };
const NEAR: Vec3 = { x: 0, y: 0, z: 5 };
/** Five metres in front of the caster: inside Dazzle's 10 m cone. */
const CLOSE: Vec3 = { x: 0, y: 0, z: -5 };
/** Two metres in front of the caster: every dart of the fan passes through the target's body. */
const POINT_BLANK: Vec3 = { x: 0, y: 0, z: -8 };

/** Peacock (Dawn) with the given tiers bought and a Pelican (Dusk); no regeneration. */
async function setup(tiers: readonly number[] = [0, 0, 0, 0], foeAt: Vec3 = NEAR, from: Vec3 = FAR) {
  const sb = await createSandbox({ heroes: [{ hero: 'peacock', at: from }, { hero: 'pelican', at: foeAt }] });
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
/** Seconds each application of a status lasts, measured as it lands. Call before the cast. */
function durations(sb: Sandbox, foe: EntityId, id: string): number[] {
  const out: number[] = [];
  sb.ctx.bus.on('status.applied', (e) => {
    if (e.target === foe && e.status === id) out.push((e.expiresAt - sb.sim.tick) / TICK_RATE);
  });
  return out;
}

describe('Peacock', () => {
  it('has a valid, implemented kit with a swatch', () => {
    expect(validateKit(peacock)).toEqual([]);
    expect(peacock.implemented).toBe(true);
    expect(peacockDef.swatch).toBeDefined();
  });

  describe('Plume Darts (projectile 85 m/s, 15 Talon, 18 rounds, 4.5 shots/s, 2.2 s reload)', () => {
    it('deals 15 per dart and 15 × 1.65 on the head', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 0], { x: 0, y: 0, z: -4 });
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.step(12);
      sb.fire(me, false);
      const body = hitsOn(sb, me, foe);
      expect(body.length).toBeGreaterThan(0);
      for (const e of body) expect([e.beakShot, e.amount]).toEqual([false, expect.closeTo(15, 1)]);
      sb.clearEvents();
      sb.step(30);
      sb.aimAt(me, foe, 'head');
      sb.fire(me);
      sb.step(12);
      const head = hitsOn(sb, me, foe);
      expect(head.length).toBeGreaterThan(0);
      for (const e of head) expect([e.beakShot, e.amount]).toEqual([true, expect.closeTo(15 * 1.65, 1)]);
    });

    it('holds 18 rounds, fires 4.5 a second and reloads in 2.2 s', async () => {
      const { sb, me } = await setup();
      expect(sb.hero(me).weapon.ammo).toBe(18);
      const fired: number[] = [];
      sb.ctx.bus.on('weapon.fired', () => fired.push(sb.sim.tick));
      let started = 0;
      let done = 0;
      sb.ctx.bus.on('weapon.reload', (e) => (e.done ? (done = sb.sim.tick) : (started = sb.sim.tick)));
      sb.fire(me);
      sb.stepUntil(() => done > 0, 900);
      expect(fired.filter((t) => t <= started)).toHaveLength(18);
      expect(Math.abs((fired[3] as number) - (fired[0] as number) - (3 * TICK_RATE) / 4.5)).toBeLessThanOrEqual(1);
      expect(done - started).toBe(Math.round(2.2 * TICK_RATE));
    });
  });

  describe('Hundred Eyes', () => {
    it('a fan of darts at point blank hits a hero for 45 each, at most 3 times', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 0], POINT_BLANK);
      sb.cast(me, 0, foe);
      sb.step(TICK_RATE);
      const hits = hitsOn(sb, me, foe, 'peacock.hundredEyes');
      expect(hits).toHaveLength(3); // five darts reach it; the fourth and fifth do nothing
      for (const h of hits) expect([h.amount, h.damageType]).toEqual([expect.closeTo(45, 1), 'song']);
      expect(sb.hero(me).abilities.slots[0]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('T1 fires 6 darts, T2 cools 3 s faster, T3 reveals for 4 s and shreds 10% Song resist for 6 s', async () => {
      const { sb, me, foe } = await setup([3, 0, 0, 0], POINT_BLANK);
      expect(resolveAbility(peacockDef.abilities[0], 1).values.darts).toBe(6);
      const revealed = durations(sb, foe, 'reveal');
      const shred = durations(sb, foe, 'songShred');
      sb.cast(me, 0, foe);
      sb.step(TICK_RATE);
      expect(hitsOn(sb, me, foe, 'peacock.hundredEyes')).toHaveLength(3);
      expect(revealed[0]).toBeCloseTo(4, 1);
      expect(shred[0]).toBeCloseTo(6, 1);
      expect(sb.hero(me).abilities.slots[0]?.cooldownTicks).toBe(9 * TICK_RATE);
    });
  });

  describe('Dazzle', () => {
    it('damages 70 and disarms 1.25 s inside the cone', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 0], CLOSE);
      const disarmed = durations(sb, foe, 'disarm');
      sb.cast(me, 1, foe);
      sb.step(5);
      const hits = hitsOn(sb, me, foe, 'peacock.dazzle');
      expect(hits).toHaveLength(1);
      expect(hits[0]?.amount).toBeCloseTo(70, 1);
      expect(disarmed[0]).toBeCloseTo(1.25, 1);
      expect(sb.hero(me).abilities.slots[1]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('T3 (with T1, T2): reaches 14 m, disarms 1.75 s and silences 1 s', async () => {
      const { sb, me, foe } = await setup([0, 3, 0, 0], { x: 0, y: 0, z: 3 });
      const disarmed = durations(sb, foe, 'disarm');
      const silenced = durations(sb, foe, 'silence');
      sb.cast(me, 1, foe);
      sb.step(5);
      expect(hitsOn(sb, me, foe, 'peacock.dazzle')).toHaveLength(1); // 13 m away: beyond the base 10 m
      expect(disarmed[0]).toBeCloseTo(1.75, 1);
      expect(silenced[0]).toBeCloseTo(1, 1);
    });
  });

  describe('Strut', () => {
    it('speeds you 30% for 3 s and makes the next cast hit 25% harder, once', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 0], CLOSE);
      sb.cast(me, 2);
      sb.step(3);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(7 * 1.3, 2);
      sb.cast(me, 1, foe);
      sb.step(5);
      expect(hitsOn(sb, me, foe, 'peacock.dazzle')[0]?.amount).toBeCloseTo(70 * 1.25, 1);
      sb.step(TICK_RATE); // the bonus lapses a moment after the cast it was spent on
      sb.clearEvents();
      sb.cast(me, 0, foe);
      sb.step(TICK_RATE);
      expect(hitsOn(sb, me, foe, 'peacock.hundredEyes')[0]?.amount).toBeCloseTo(45, 1);
      sb.step(TICK_RATE * 3);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(7, 2);
      expect(sb.hero(me).abilities.slots[2]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('T3 (with T1, T2): 4 s, cooldown 10 s, and a 100 Song shield', async () => {
      const { sb, me } = await setup([0, 0, 3, 0]);
      sb.cast(me, 2);
      sb.step(3);
      expect(sb.hero(me).abilities.slots[2]?.cooldownTicks).toBe(10 * TICK_RATE);
      // The shield soaks a hit: 60 Song damage costs no health.
      const before = sb.health(me).hp;
      sb.apply({ kind: 'damage', amount: 60, type: 'song' }, me, sb.cause(null, { team: 'dusk' }));
      sb.step(2);
      expect(sb.health(me).hp).toBe(before);
      sb.step(TICK_RATE * 3.5);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(7 * 1.3, 2); // 3.6 s in, still going: it lasts 4
      sb.step(TICK_RATE);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(7, 2);
    });
  });

  describe('Full Display', () => {
    it('is locked before level 6 and usable at 6', async () => {
      const sb = await createSandbox({ heroes: [{ hero: 'peacock', at: FAR }, { hero: 'pelican', at: NEAR }], options: { unlockAbilities: false } });
      const [me] = sb.heroes as [EntityId];
      expect(sb.hero(me).abilities.slots[3]?.unlocked).toBe(false);
      sb.cast(me, 3, NEAR);
      sb.step(5);
      expect(sb.hero(me).abilities.slots[3]?.readyAt).toBe(0);
      sb.ctx.bus.emit({ type: 'hero.level', hero: me, level: 6, ap: 0, unlockSlot: 3 });
      sb.step();
      expect(sb.hero(me).abilities.slots[3]?.unlocked).toBe(true);
      sb.cast(me, 3, NEAR);
      sb.step(TICK_RATE * 1.2); // the cast lands after its 1 s wind-up
      expect(sb.hero(me).abilities.slots[3]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('opens for 1 s, then damages 300 and reveals 6 s; T2 also stuns 1 s', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 2]);
      const revealed = durations(sb, foe, 'reveal');
      const stunned = durations(sb, foe, 'stun');
      sb.cast(me, 3, foe);
      sb.step(TICK_RATE * 0.5);
      expect(hitsOn(sb, me, foe, 'peacock.fullDisplay')).toHaveLength(0); // still opening
      sb.step(TICK_RATE * 0.8);
      const hits = hitsOn(sb, me, foe, 'peacock.fullDisplay');
      expect(hits).toHaveLength(1);
      expect(hits[0]?.amount).toBeCloseTo(300, 1);
      expect(revealed[0]).toBeCloseTo(6, 1);
      expect(stunned[0]).toBeCloseTo(1, 1);
    });

    it('T1 reaches 23 m', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 1], { x: 0, y: 0, z: 13 });
      sb.cast(me, 3, foe);
      sb.step(TICK_RATE * 1.4);
      expect(hitsOn(sb, me, foe, 'peacock.fullDisplay')).toHaveLength(1);
    });
  });
});
