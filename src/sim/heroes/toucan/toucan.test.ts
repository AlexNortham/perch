/** Toucan smoke tests (GDD §9.18): the gun, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import type { Effect, EffectCause, EffectTarget, EntityId, HeroId, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { resolveAbility, validateKit } from '../../abilities/kit';
import { MORTAR, toucanDef } from '../../data/heroes/toucan';
import { toucan } from './index';

const BACK: Vec3 = { x: 0, y: 0, z: -35 };
const AT = (z: number, x = 0): Vec3 => ({ x, y: 0, z });

/** Toucan (Dawn, at z = -35 facing +z) first, then the others; tiers bought for the Toucan. */
async function setup(others: readonly { hero: HeroId; at: Vec3 }[] = [], tiers: readonly number[] = [0, 0, 0, 0], at: Vec3 = BACK) {
  const sb = await createSandbox({ heroes: [{ hero: 'toucan', at, yaw: 0 }, ...others] });
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
function durations(sb: Sandbox, who: EntityId, id: string): number[] {
  const out: number[] = [];
  sb.ctx.bus.on('status.applied', (e) => {
    if (e.target === who && e.status === id) out.push((e.expiresAt - sb.sim.tick) / TICK_RATE);
  });
  return out;
}
/** Every Fruit Barrage mortar as it lands: the tick and the spot. */
function mortars(sb: Sandbox): { tick: number; point: Vec3 }[] {
  const out: { tick: number; point: Vec3 }[] = [];
  const router = sb.ctx.effects as { apply: (e: Effect, t: EffectTarget, c: EffectCause) => void };
  const apply = router.apply.bind(router);
  router.apply = (e, t, c) => {
    if (e === MORTAR) out.push({ tick: sb.sim.tick, point: { ...t.point } });
    apply(e, t, c);
  };
  return out;
}
const flat = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);

describe('Toucan', () => {
  it('has a valid, implemented kit with the GDD body, stats and gun', () => {
    expect(validateKit(toucan)).toEqual([]);
    expect(toucan.implemented).toBe(true);
    expect(toucanDef.swatch).toBeDefined();
    expect(toucanDef.body).toMatchObject({ height: 1.7, radius: 0.32, head: { radius: 0.17, centre: { up: 1.5 } } });
    expect(toucanDef.stats).toMatchObject({ maxHealth: 540, moveSpeed: 7, weaponDamage: 34, magazine: 10 });
    expect(toucanDef.weapon).toMatchObject({ hitscan: true, spreadDeg: 0.25, fireRate: 2.2, reloadS: 2.4, falloff: { start: 35, end: 75 } });
  });

  describe('Bill Rifle (hitscan, 34 Talon, 10 rounds, 2.2 shots/s, 2.4 s reload)', () => {
    it('deals 34 per shot and 34 × 1.65 on the head', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AT(-15) }]);
      const foe = rest[0] as EntityId;
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.step(1);
      sb.fire(me, false);
      sb.step(2);
      expect(hitsOn(sb, me, foe)[0]?.amount).toBeCloseTo(34, 1);
      sb.clearEvents();
      sb.step(30);
      sb.aimAt(me, foe, 'head');
      sb.fire(me);
      sb.step(1);
      sb.fire(me, false);
      sb.step(2);
      expect(hitsOn(sb, me, foe).find((e) => e.beakShot)?.amount).toBeCloseTo(34 * 1.65, 1);
    });

    it('fires 2.2 shots a second, holds 10 rounds and reloads in 2.4 s', async () => {
      const { sb, me } = await setup();
      expect(sb.hero(me).weapon.ammo).toBe(10);
      const fired: number[] = [];
      sb.ctx.bus.on('weapon.fired', () => fired.push(sb.sim.tick));
      let started = 0;
      let done = 0;
      sb.ctx.bus.on('weapon.reload', (e) => (e.done ? (done = sb.sim.tick) : (started = sb.sim.tick)));
      sb.fire(me);
      sb.stepUntil(() => fired.length >= 10, 600);
      sb.fire(me, false);
      sb.stepUntil(() => done > 0, 600);
      expect(fired).toHaveLength(10);
      expect(((fired[9] as number) - (fired[0] as number)) / 9).toBeCloseTo(TICK_RATE / 2.2, 0);
      expect((done - started) / TICK_RATE).toBeCloseTo(2.4, 1);
    });
  });

  describe('Fruit Lob', () => {
    it('lands 1.2 s after the cast: 90 damage in 4 m and a 25% slow for 2 s; two charges', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AT(-10) },
        { hero: 'swan', at: AT(-18) }, // outside 4 m
      ]);
      const [hit, miss] = rest as [EntityId, EntityId];
      expect(slot(sb, me, 0)?.charges).toBe(2);
      const slow = durations(sb, hit, 'slow');
      sb.cast(me, 0, AT(-10));
      sb.step(TICK_RATE * 1.1);
      expect(hitsOn(sb, me, hit)).toHaveLength(0);
      sb.step(TICK_RATE * 0.3);
      expect(hitsOn(sb, me, hit, 'toucan.fruitLob')[0]?.amount).toBeCloseTo(90, 1);
      expect(hitsOn(sb, me, miss)).toHaveLength(0);
      expect(sb.ctx.stats.get(hit, 'slow')).toBeCloseTo(0.25, 3);
      expect(slow[0]).toBeCloseTo(2, 1);
      expect(slot(sb, me, 0)?.charges).toBe(1);
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(10 * TICK_RATE);
    });

    it('T1 adds 25 damage and T2 a third charge', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AT(-10) }], [2, 0, 0, 0]);
      expect(slot(sb, me, 0)?.charges).toBe(3);
      sb.cast(me, 0, AT(-10));
      sb.step(TICK_RATE * 1.4);
      expect(hitsOn(sb, me, rest[0] as EntityId, 'toucan.fruitLob')[0]?.amount).toBeCloseTo(115, 1);
    });

    it('T3 leaves pulp for 4 s that slows enemies 40%', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AT(-10) }], [3, 0, 0, 0]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 0, AT(-10));
      sb.step(TICK_RATE * 1.2 + 2);
      sb.step(TICK_RATE * 3);
      expect(sb.ctx.stats.get(foe, 'slow')).toBeCloseTo(0.4, 3);
      sb.step(TICK_RATE * 2);
      expect(sb.ctx.stats.get(foe, 'slow')).toBe(0);
    });
  });

  describe('Seed Spit', () => {
    it('hits the first enemy for 60, reveals it 6 s and shreds 10% Song resist; 60 m reach', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AT(-5) },
        { hero: 'swan', at: AT(5) },
      ]);
      const [first, behind] = rest as [EntityId, EntityId];
      const reveal = durations(sb, first, 'reveal');
      const shred = durations(sb, first, 'songShred');
      sb.cast(me, 1, first);
      sb.step(TICK_RATE * 0.5);
      expect(hitsOn(sb, me, first, 'toucan.seedSpit')[0]?.amount).toBeCloseTo(60, 1);
      expect(reveal[0]).toBeCloseTo(6, 1);
      expect(shred[0]).toBeCloseTo(6, 1);
      expect(sb.ctx.stats.get(first, 'songShred')).toBeCloseTo(0.1, 3);
      expect(hitsOn(sb, me, behind)).toHaveLength(0);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(9 * TICK_RATE);
    });

    it('stops at 60 m, and T1 reaches 80 m', async () => {
      const far = [{ hero: 'pelican' as HeroId, at: AT(30) }]; // 65 m from the Toucan
      const a = await setup(far);
      a.sb.cast(a.me, 1, AT(30, 0));
      a.sb.step(TICK_RATE);
      expect(hitsOn(a.sb, a.me, a.rest[0] as EntityId)).toHaveLength(0);
      const b = await setup(far, [0, 1, 0, 0]);
      b.sb.cast(b.me, 1, b.rest[0] as EntityId);
      b.sb.step(TICK_RATE);
      expect(hitsOn(b.sb, b.me, b.rest[0] as EntityId, 'toucan.seedSpit')).toHaveLength(1);
    });

    it('T3 (with T1, T2) pierces every enemy in its path; 6 s cooldown', async () => {
      const { sb, me, rest } = await setup(
        [
          { hero: 'pelican', at: AT(-10) },
          { hero: 'swan', at: AT(0) },
        ],
        [0, 3, 0, 0],
      );
      sb.cast(me, 1, rest[0] as EntityId);
      sb.step(TICK_RATE * 0.8);
      for (const foe of rest) expect(hitsOn(sb, me, foe, 'toucan.seedSpit')).toHaveLength(1);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(6 * TICK_RATE);
    });
  });

  describe('Branch Swing', () => {
    it('swings you to a point within 25 m in 0.6 s, with no gun buff', async () => {
      const { sb, me } = await setup();
      sb.cast(me, 2, AT(-15));
      sb.step(TICK_RATE * 0.8);
      expect(sb.hero(me).pos.z).toBeCloseTo(-15, 0);
      expect(sb.hero(me).pos.y).toBeCloseTo(0, 0);
      expect(sb.statuses(me)).not.toContain('toucan.swingBuff');
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(16 * TICK_RATE);
    });

    it('T3 (with T1, T2): 12 s cooldown, 35 m reach and +25% gun damage for 4 s after landing', async () => {
      const { sb, me } = await setup([], [0, 0, 3, 0]);
      const buff = durations(sb, me, 'toucan.swingBuff');
      sb.cast(me, 2, AT(-6)); // a 29 m swing
      sb.step(TICK_RATE * 0.8);
      expect(sb.hero(me).pos.z).toBeCloseTo(-6, 0);
      expect(buff[0]).toBeCloseTo(4, 1);
      expect(sb.ctx.stats.get(me, 'gunDamage')).toBeCloseTo(0.25, 3);
      sb.step(TICK_RATE * 4);
      expect(sb.ctx.stats.get(me, 'gunDamage')).toBe(0);
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(12 * TICK_RATE);
    });
  });

  describe('Fruit Barrage', () => {
    it('is locked before level 6 and usable at 6', async () => {
      const sb = await createSandbox({ heroes: [{ hero: 'toucan', at: BACK, yaw: 0 }, { hero: 'pelican', at: AT(20) }], options: { unlockAbilities: false } });
      const [me] = sb.heroes as [EntityId];
      sb.cast(me, 3, AT(20));
      sb.step(5);
      expect(slot(sb, me, 3)?.unlocked).toBe(false);
      expect(slot(sb, me, 3)?.readyAt).toBe(0);
      sb.ctx.bus.emit({ type: 'hero.level', hero: me, level: 6, ap: 0, unlockSlot: 3 });
      sb.step();
      expect(slot(sb, me, 3)?.unlocked).toBe(true);
      sb.cast(me, 3, AT(20));
      sb.step(5);
      expect(slot(sb, me, 3)?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('drops 12 mortars over 3 s starting 1 s after the cast, inside a 9 m radius, each 50 damage in 3 m', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AT(20) }]);
      const landed = mortars(sb);
      const start = sb.sim.tick;
      sb.cast(me, 3, AT(20));
      sb.step(TICK_RATE * 4.5);
      expect(landed).toHaveLength(12);
      for (const m of landed) expect(flat(m.point, AT(20))).toBeLessThanOrEqual(9);
      expect(new Set(landed.map((m) => `${m.point.x.toFixed(2)},${m.point.z.toFixed(2)}`)).size).toBeGreaterThan(8);
      const first = (landed[0]?.tick ?? 0) - start;
      const last = (landed[11]?.tick ?? 0) - start;
      expect(first / TICK_RATE).toBeGreaterThanOrEqual(1);
      expect(first / TICK_RATE).toBeLessThan(1.3);
      expect((last - first) / TICK_RATE).toBeGreaterThan(2.5);
      expect(last / TICK_RATE).toBeLessThanOrEqual(4.1);
      const foe = rest[0] as EntityId;
      const near = landed.filter((m) => flat(m.point, sb.hero(foe).pos) <= 3 + sb.hero(foe).radius).length;
      const hits = hitsOn(sb, me, foe, 'toucan.fruitBarrage');
      expect(hits.length).toBeGreaterThanOrEqual(Math.max(0, near - 1));
      expect(hits.length).toBeLessThanOrEqual(near);
      for (const h of hits) expect(h.amount).toBeCloseTo(50, 1);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(100 * TICK_RATE);
    });

    it('picks the same spots for the same seed', async () => {
      const run = async () => {
        const { sb, me } = await setup();
        const landed = mortars(sb);
        sb.cast(me, 3, AT(20));
        sb.step(TICK_RATE * 4.5);
        return landed.map((m) => [m.tick, m.point.x, m.point.z]);
      };
      expect(await run()).toEqual(await run());
    });

    it('T1 adds four mortars, T2 widens it to 12 m, T3 shortens the cooldown to 75 s', async () => {
      const { sb, me } = await setup([], [0, 0, 0, 3]);
      const landed = mortars(sb);
      sb.cast(me, 3, AT(20));
      sb.step(TICK_RATE * 4.5);
      expect(landed).toHaveLength(16);
      for (const m of landed) expect(flat(m.point, AT(20))).toBeLessThanOrEqual(12);
      expect(landed.some((m) => flat(m.point, AT(20)) > 9)).toBe(true);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(75 * TICK_RATE);
      expect(resolveAbility(toucanDef.abilities[3], 3).values.radius).toBe(12);
    });
  });
});
