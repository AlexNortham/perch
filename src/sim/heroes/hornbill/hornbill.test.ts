/** Hornbill smoke tests (GDD §9.9): the gun, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import type { EntityId, HeroId, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { resolveAbility, validateKit } from '../../abilities/kit';
import { hornbillDef } from '../../data/heroes/hornbill';
import { SLOW } from '../../data/combat';
import { hornbill } from './index';

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
const AHEAD = (z: number): Vec3 => ({ x: 0, y: 0, z });

async function setup(others: readonly { hero: HeroId; at: Vec3 }[] = [], tiers: readonly number[] = [0, 0, 0, 0]) {
  const sb = await createSandbox({ heroes: [{ hero: 'hornbill', at: ORIGIN, yaw: 0 }, ...others] });
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
const gunHits = (sb: Sandbox, me: EntityId, foe: EntityId) =>
  sb.eventsOf('damage.applied').filter((e) => e.source === me && e.target === foe && e.via === 'weapon');
/** One trigger pull: a single shot at the foe's body. */
function shoot(sb: Sandbox, me: EntityId, foe: EntityId): void {
  sb.aimAt(me, foe, 'body');
  sb.fire(me);
  sb.step(1);
  sb.fire(me, false);
  sb.step(2);
}
/** Assertions that wait for Combat's weaponMod.gunDamage (W4-contract-followups): run with PERCH_PENDING=1. */
const PENDING = process.env.PERCH_PENDING === '1';
const slot = (sb: Sandbox, me: EntityId, i: number) => sb.hero(me).abilities.slots[i];

describe('Hornbill', () => {
  it('has a valid, implemented kit with the GDD body, stats and gun', () => {
    expect(validateKit(hornbill)).toEqual([]);
    expect(hornbill.implemented).toBe(true);
    expect(hornbillDef.swatch).toBeDefined();
    expect(hornbillDef.body).toMatchObject({ height: 1.95, radius: 0.38, head: { radius: 0.2, centre: { up: 1.72 } } });
    expect(hornbillDef.stats).toMatchObject({ maxHealth: 620, moveSpeed: 6.9, weaponDamage: 30, magazine: 15 });
    expect(hornbillDef.weapon).toMatchObject({ hitscan: true, spreadDeg: 0.5, fireRate: 3, reloadS: 2.4, falloff: { start: 22, end: 50 } });
  });

  describe('Casque Rifle (hitscan, 30 Talon, 15 rounds, 3 shots/s, 2.4 s reload)', () => {
    it('deals 30 per shot and 30 × 1.65 on the head', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(15) }]);
      const foe = rest[0] as EntityId;
      shoot(sb, me, foe);
      expect(gunHits(sb, me, foe)[0]?.amount).toBeCloseTo(30, 1);
      sb.clearEvents();
      sb.step(30);
      sb.aimAt(me, foe, 'head');
      sb.fire(me);
      sb.step(1);
      sb.fire(me, false);
      sb.step(2);
      const head = gunHits(sb, me, foe).filter((e) => e.beakShot);
      expect(head[0]?.amount).toBeCloseTo(30 * 1.65, 1);
    });

    it('holds 15 rounds, fires 3 a second and reloads in 2.4 s', async () => {
      const { sb, me } = await setup();
      expect(sb.hero(me).weapon.ammo).toBe(15);
      const fired: number[] = [];
      sb.ctx.bus.on('weapon.fired', () => fired.push(sb.sim.tick));
      let started = 0;
      let done = 0;
      sb.ctx.bus.on('weapon.reload', (e) => (e.done ? (done = sb.sim.tick) : (started = sb.sim.tick)));
      sb.fire(me);
      sb.stepUntil(() => fired.length >= 15, 900);
      sb.fire(me, false);
      sb.stepUntil(() => done > 0, 600);
      expect(fired).toHaveLength(15);
      expect((fired[1] as number) - (fired[0] as number)).toBeCloseTo(TICK_RATE / 3, 0);
      expect((done - started) / TICK_RATE).toBeCloseTo(2.4, 1);
    });
  });

  describe('Heavy Rounds', () => {
    it('makes the next 6 shots deal +40% and slow the hero 15%, then stops', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(15) }]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 0);
      sb.step(2);
      const applied: number[] = [];
      sb.ctx.bus.on('status.applied', (e) => {
        if (e.target === foe && e.status === SLOW.id) applied.push((e.expiresAt - sb.sim.tick) / TICK_RATE);
      });
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.stepUntil(() => gunHits(sb, me, foe).length >= 7, 300);
      sb.fire(me, false);
      const hits = gunHits(sb, me, foe);
      expect(hits.length).toBeGreaterThanOrEqual(7);
      if (PENDING) {
        expect(hits.slice(0, 6).every((h) => Math.abs(h.amount - 42) < 0.5)).toBe(true); // weaponMod.gunDamage: Combat W4
        expect(hits[6]?.amount).toBeCloseTo(30, 1);
      }
      expect(applied).toHaveLength(6);
      expect(applied[0]).toBeCloseTo(1.5, 1);
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(14 * TICK_RATE);
    });

    it('T1 (8 rounds), T2 (11 s cooldown), T3 (pierces one extra target)', async () => {
      const def = hornbillDef.abilities[0];
      expect(resolveAbility(def, 1).values.rounds).toBe(8);
      expect(resolveAbility(def, 2).cooldownS).toBe(11);
      const { sb, me, rest } = await setup(
        [{ hero: 'pelican', at: AHEAD(12) }, { hero: 'kingfisher', at: AHEAD(16) }],
        [3, 0, 0, 0],
      );
      const [near, far] = rest as [EntityId, EntityId];
      sb.cast(me, 0);
      sb.step(2);
      sb.aimAt(me, near, 'body');
      sb.fire(me);
      sb.step(1);
      sb.fire(me, false);
      sb.step(2);
      expect(gunHits(sb, me, near)).toHaveLength(1);
      expect(gunHits(sb, me, far).length).toBe(1);
    });
  });

  describe('Mud Seal', () => {
    it('gives a 200 barrier and +20% fire rate, which end together; 22 s cooldown', async () => {
      const { sb, me } = await setup();
      sb.cast(me, 1);
      sb.step(2);
      expect(sb.hero(me).health.barrier).toBeCloseTo(200, 0);
      expect(sb.ctx.stats.get(me, 'fireRate')).toBeCloseTo(0.2, 3);
      sb.hero(me).health.barrier = 0; // broken early
      sb.step(2);
      expect(sb.ctx.stats.get(me, 'fireRate')).toBeCloseTo(0, 3);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(22 * TICK_RATE);
    });

    it('T3 (with T1, T2): 300 barrier, 17 s cooldown, and no slows while it holds', async () => {
      const { sb, me } = await setup([], [0, 3, 0, 0]);
      sb.cast(me, 1);
      sb.step(2);
      expect(sb.hero(me).health.barrier).toBeCloseTo(300, 0);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(17 * TICK_RATE);
      sb.apply([{ kind: 'applyStatus', status: SLOW, durationS: 3, magnitude: 0.5 }], me, sb.cause(me, {}));
      sb.step(2);
      expect(sb.ctx.stats.get(me, 'slow')).toBe(0);
    });
  });

  describe('Bounding Hop', () => {
    it('hops 8 m along the movement keys over 0.4 s; two charges and a slick at T3', async () => {
      const { sb, me } = await setup([], [0, 0, 3, 0]);
      expect(slot(sb, me, 2)?.charges).toBe(2);
      sb.move(me, 1, 0);
      sb.cast(me, 2);
      sb.step(TICK_RATE);
      sb.move(me, 0, 0);
      expect(sb.hero(me).pos.z).toBeGreaterThan(7);
      const slick = sb.ctx.store.list('area').filter((a) => a.area.owner === me);
      expect(slick.length).toBeGreaterThan(0);
      expect(Math.abs(slick[0]?.pos.z ?? 99)).toBeLessThan(1);
    });

    it('slows an enemy standing on the slick 30%', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(1) }], [0, 0, 3, 0]);
      sb.move(me, 1, 0);
      sb.cast(me, 2);
      sb.step(TICK_RATE);
      sb.move(me, 0, 0);
      sb.place(rest[0] as EntityId, ORIGIN);
      sb.step(TICK_RATE);
      expect(sb.ctx.stats.get(rest[0] as EntityId, 'slow')).toBeCloseTo(0.3, 2);
    });
  });

  describe('Marked Prey', () => {
    it('marks an enemy hero for 10 s: revealed, +40% damage and no falloff', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(35) }]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 3, sb.hero(foe).pos);
      sb.step(2);
      expect(sb.statuses(foe)).toEqual(expect.arrayContaining(['hornbill.marked', 'reveal']));
      shoot(sb, me, foe);
      // 35 m is past the 22 m falloff start; ignoreFalloff already works, weaponMod.gunDamage is Combat's W4 work.
      const marked = gunHits(sb, me, foe)[0]?.amount ?? 0;
      expect(marked).toBeGreaterThan(29.9);
      if (PENDING) expect(marked).toBeCloseTo(42, 0);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(90 * TICK_RATE);
    });

    it('refunds half the cooldown when the mark dies', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(20) }]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 3, sb.hero(foe).pos);
      sb.step(2);
      const before = (slot(sb, me, 3)?.readyAt ?? 0) - sb.sim.tick;
      sb.apply([{ kind: 'damage', amount: 99999, type: 'talon' }], foe, sb.cause(me, {}));
      sb.step(2);
      const after = (slot(sb, me, 3)?.readyAt ?? 0) - sb.sim.tick;
      expect(before - after).toBeGreaterThan(44 * TICK_RATE);
    });

    it('T1 14 s, T2 +60% total, T3 -20% Talon resist', () => {
      const def = hornbillDef.abilities[3];
      expect(resolveAbility(def, 1).values.duration).toBe(14);
      expect(resolveAbility(def, 2).selfEffects).toHaveLength(2);
      expect(resolveAbility(def, 3).effects.some((e) => e.kind === 'applyStatus' && e.status.id === 'talonShred')).toBe(true);
    });
  });
});
