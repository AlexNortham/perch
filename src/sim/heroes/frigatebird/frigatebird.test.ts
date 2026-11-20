/** Frigatebird smoke tests (GDD §9.21): the gun, then each ability at its base and tiers, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import type { EntityId, HeroId, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { validateKit } from '../../abilities/kit';
import { frigatebirdDef } from '../../data/heroes/frigatebird';
import { frigatebird } from './index';

const ORIGIN: Vec3 = { x: 0, y: 0, z: -35 }; // the arena is 80 m square: stand at one end for the long shots
const AHEAD = (d: number, x = 0): Vec3 => ({ x, y: 0, z: ORIGIN.z + d });

/** Frigatebird (Dawn, at the origin facing +z) first, then the others; tiers bought for the Frigatebird. */
async function setup(others: readonly { hero: HeroId; at: Vec3 }[] = [], tiers: readonly number[] = [0, 0, 0, 0]) {
  const sb = await createSandbox({ heroes: [{ hero: 'frigatebird', at: ORIGIN, yaw: 0 }, ...others] });
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
function shoot(sb: Sandbox, me: EntityId, foe: EntityId, part: 'head' | 'body' = 'body'): void {
  sb.aimAt(me, foe, part);
  sb.fire(me);
  sb.step(1);
  sb.fire(me, false);
  sb.step(2);
}

describe('Frigatebird', () => {
  it('has a valid, implemented kit with the GDD body, stats and gun', () => {
    expect(validateKit(frigatebird)).toEqual([]);
    expect(frigatebird.implemented).toBe(true);
    expect(frigatebirdDef.body).toMatchObject({ height: 1.8, radius: 0.3, head: { radius: 0.15, centre: { up: 1.62 } } });
    expect(frigatebirdDef.stats).toMatchObject({ maxHealth: 530, moveSpeed: 7, weaponDamage: 40, magazine: 8 });
    expect(frigatebirdDef.weapon).toMatchObject({ hitscan: true, spreadDeg: 0.2, fireRate: 1.8, reloadS: 2.5, falloff: { start: 35, end: 80 } });
  });

  describe('Kite Rifle (hitscan, 40 Talon, 8 rounds, 1.8 shots/s, 2.5 s reload)', () => {
    it('deals 40 per shot and 40 × 1.65 on the head', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(20) }]);
      const foe = rest[0] as EntityId;
      shoot(sb, me, foe);
      const gun = () => hitsOn(sb, me, foe).filter((e) => e.via === 'weapon');
      expect(gun()[0]?.amount).toBeCloseTo(40, 1);
      sb.step(40);
      shoot(sb, me, foe, 'head');
      expect(gun().find((e) => e.beakShot)?.amount).toBeCloseTo(40 * 1.65, 1);
    });

    it('fires 1.8 shots a second, holds 8 rounds and reloads in 2.5 s', async () => {
      const { sb, me } = await setup();
      expect(sb.hero(me).weapon.ammo).toBe(8);
      const fired: number[] = [];
      sb.ctx.bus.on('weapon.fired', () => fired.push(sb.sim.tick));
      let started = 0;
      let done = 0;
      sb.ctx.bus.on('weapon.reload', (e) => (e.done ? (done = sb.sim.tick) : (started = sb.sim.tick)));
      sb.fire(me);
      sb.stepUntil(() => fired.length >= 8, 900);
      sb.fire(me, false);
      sb.stepUntil(() => done > 0, 600);
      expect(fired).toHaveLength(8);
      expect(((fired[7] as number) - (fired[0] as number)) / 7).toBeCloseTo(TICK_RATE / 1.8, 0);
      expect((done - started) / TICK_RATE).toBeCloseTo(2.5, 1);
    });
  });

  describe('Plunder Shot', () => {
    it('hits the first enemy hero for 70 Song damage, strips its positive statuses and gives you a 100 Song shield', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(20) },
        { hero: 'swan', at: AHEAD(30) },
      ]);
      const [first, behind] = rest as [EntityId, EntityId];
      const buff = sb.cause(first);
      sb.apply({ kind: 'statMod', id: 'test.buff', name: 'Buff', stats: [{ stat: 'moveSpeed', op: 'pct', value: 0.2 }], durationS: 10 }, first, buff);
      expect(sb.statuses(first)).toContain('test.buff');
      sb.cast(me, 0, first);
      sb.step(TICK_RATE * 0.6);
      const hit = hitsOn(sb, me, first, 'frigatebird.plunderShot');
      expect(hit).toHaveLength(1);
      expect(hit[0]?.amount).toBeCloseTo(70, 1);
      expect(hit[0]?.damageType).toBe('song');
      expect(sb.statuses(first)).not.toContain('test.buff');
      expect(hitsOn(sb, me, behind)).toHaveLength(0);
      expect(sb.health(me).songShield).toBeCloseTo(100, 1);
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(14 * TICK_RATE);
    });

    it('T1: +25 damage; T2: 11 s cooldown; T3: two charges', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(20) }], [3, 0, 0, 0]);
      sb.cast(me, 0, rest[0] as EntityId);
      sb.step(TICK_RATE * 0.6);
      expect(hitsOn(sb, me, rest[0] as EntityId, 'frigatebird.plunderShot')[0]?.amount).toBeCloseTo(95, 1);
      expect(slot(sb, me, 0)?.charges).toBe(1);
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(11 * TICK_RATE);
    });
  });

  describe('High Pass', () => {
    it('leaps to the point in 0.8 s and gives +40% gun falloff ranges for 5 s', async () => {
      const { sb, me } = await setup();
      sb.cast(me, 1, AHEAD(30));
      let peak = 0;
      for (let i = 0; i < TICK_RATE * 1.2; i++) {
        sb.step();
        peak = Math.max(peak, sb.hero(me).pos.y);
      }
      expect(sb.hero(me).pos.z).toBeCloseTo(AHEAD(30).z, 0);
      expect(peak).toBeGreaterThan(8);
      expect(sb.ctx.stats.get(me, 'falloffRange')).toBeCloseTo(0.4, 3);
      expect(sb.ctx.stats.get(me, 'gunDamage')).toBe(0);
      sb.step(TICK_RATE * 5);
      expect(sb.ctx.stats.get(me, 'falloffRange')).toBe(0);
      expect(slot(sb, me, 1)?.cooldownTicks).toBeGreaterThan(0);
    });

    it('T1 -4 s cooldown, T2 +10 m range, T3 also +20% gun damage', async () => {
      const { sb, me } = await setup([], [0, 3, 0, 0]);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(0);
      sb.cast(me, 1, AHEAD(40));
      sb.step(TICK_RATE * 1.2);
      expect(sb.hero(me).pos.z).toBeCloseTo(AHEAD(40).z, 0);
      expect(sb.ctx.stats.get(me, 'gunDamage')).toBeCloseTo(0.2, 3);
      expect(slot(sb, me, 1)?.cooldownTicks).toBeLessThanOrEqual(12 * TICK_RATE);
      expect(slot(sb, me, 1)?.cooldownTicks).toBeGreaterThan(10 * TICK_RATE);
    });
  });

  describe('Balloon Boom', () => {
    it('hits enemies within 5 m for 50 Song damage, knocks them back and gives you a 150 barrier', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(4) },
        { hero: 'swan', at: AHEAD(8) },
      ]);
      const [near, far] = rest as [EntityId, EntityId];
      sb.cast(me, 2);
      sb.step(TICK_RATE * 1.2);
      const hit = hitsOn(sb, me, near, 'frigatebird.balloonBoom');
      expect(hit).toHaveLength(1);
      expect(hit[0]?.amount).toBeCloseTo(50, 1);
      expect(sb.hero(near).pos.z).toBeGreaterThan(AHEAD(9).z);
      expect(hitsOn(sb, me, far)).toHaveLength(0);
      expect(sb.health(me).barrier).toBeCloseTo(150, 1);
    });

    it('T1: 7 m radius; T3: enemies are also slowed 40% for 2 s', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(6.5) }], [0, 0, 3, 0]);
      const foe = rest[0] as EntityId;
      const slow = durations(sb, foe, 'slow');
      sb.cast(me, 2);
      sb.step(2);
      expect(hitsOn(sb, me, foe, 'frigatebird.balloonBoom')).toHaveLength(1);
      expect(slow[0]).toBeCloseTo(2, 1);
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(11 * TICK_RATE);
    });
  });

  describe('Harpoon Line', () => {
    it('hits the first enemy hero for 200, pulls it 15 m toward you and stuns it for 1 s', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(45) },
        { hero: 'swan', at: AHEAD(70) },
      ]);
      const [foe, behind] = rest as [EntityId, EntityId];
      const stun = durations(sb, foe, 'stun');
      sb.cast(me, 3, foe);
      sb.step(TICK_RATE * 1.5);
      const hit = hitsOn(sb, me, foe, 'frigatebird.harpoonLine');
      expect(hit).toHaveLength(1);
      expect(hit[0]?.amount).toBeCloseTo(200, 1);
      expect(sb.hero(foe).pos.z).toBeGreaterThan(AHEAD(28).z);
      expect(sb.hero(foe).pos.z).toBeLessThan(AHEAD(32).z);
      expect(stun[0]).toBeCloseTo(1, 1);
      expect(hitsOn(sb, me, behind)).toHaveLength(0);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(90 * TICK_RATE);
    });

    it('does not reach beyond 70 m, and T1 reaches 90 m', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(72) }]);
      sb.cast(me, 3, rest[0] as EntityId);
      sb.step(TICK_RATE * 2);
      expect(hitsOn(sb, me, rest[0] as EntityId)).toHaveLength(0);
      const t = await setup([{ hero: 'pelican', at: AHEAD(72) }], [0, 0, 0, 1]);
      t.sb.cast(t.me, 3, t.rest[0] as EntityId);
      t.sb.step(TICK_RATE * 2);
      expect(hitsOn(t.sb, t.me, t.rest[0] as EntityId, 'frigatebird.harpoonLine')).toHaveLength(1);
    });

    it('T2: stun 1.5 s; T3: 65 s cooldown', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(40) }], [0, 0, 0, 3]);
      const stun = durations(sb, rest[0] as EntityId, 'stun');
      sb.cast(me, 3, rest[0] as EntityId);
      sb.step(TICK_RATE * 1.5);
      expect(stun[0]).toBeCloseTo(1.5, 1);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(65 * TICK_RATE);
    });
  });
});
