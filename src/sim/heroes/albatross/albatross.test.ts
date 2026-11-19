/** Albatross smoke tests (GDD §9.2): the gun, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import type { EntityId, HeroId, PlayerTeam, UnitEntity, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { validateKit } from '../../abilities/kit';
import { albatross } from './index';

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
const AHEAD = (z: number): Vec3 => ({ x: 0, y: 0, z });

interface Spec {
  readonly hero: HeroId;
  readonly at: Vec3;
  readonly team?: PlayerTeam;
}

/** Albatross (Dawn, at the origin facing +z) first, then the others; tiers bought for the Albatross. */
async function setup(others: readonly Spec[] = [], tiers: readonly number[] = [0, 0, 0, 0]) {
  const sb = await createSandbox({ heroes: [{ hero: 'albatross', at: ORIGIN, yaw: 0 }, ...others] });
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
/** Seconds each application of a status lasts, measured as it lands. Call before the cast. */
function durations(sb: Sandbox, who: EntityId, id: string): number[] {
  const out: number[] = [];
  sb.ctx.bus.on('status.applied', (e) => {
    if (e.target === who && e.status === id) out.push((e.expiresAt - sb.sim.tick) / TICK_RATE);
  });
  return out;
}
const walls = (sb: Sandbox): UnitEntity[] => sb.ctx.store.list('unit').filter((u) => u.unit.summon === 'wall');

describe('Albatross', () => {
  it('has a valid, implemented kit', () => {
    expect(validateKit(albatross)).toEqual([]);
    expect(albatross.implemented).toBe(true);
  });

  describe('Gale Blunderbuss (hitscan shotgun, 8 × 6 Talon, 6 shells)', () => {
    it('lands 8 pellets of 6 at close range, and 6 × 1.65 on a head', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(2) }]);
      const foe = rest[0] as EntityId;
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.step(1);
      sb.fire(me, false);
      sb.step(2);
      const pellets = hitsOn(sb, me, foe);
      expect(pellets).toHaveLength(8);
      for (const p of pellets) expect([p.beakShot, p.amount]).toEqual([false, expect.closeTo(6, 1)]);
      sb.clearEvents();
      sb.step(60);
      sb.aimAt(me, foe, 'head');
      sb.fire(me);
      sb.step(1);
      sb.fire(me, false);
      sb.step(2);
      const head = hitsOn(sb, me, foe).filter((e) => e.beakShot);
      expect(head.length).toBeGreaterThan(0);
      for (const p of head) expect(p.amount).toBeCloseTo(6 * 1.65, 1);
    });

    it('fires 1.4 shots a second, holds 6 shells, and reloads 0.3 s + 0.45 s per shell', async () => {
      const { sb, me } = await setup();
      expect(sb.hero(me).weapon.ammo).toBe(6);
      const fired: number[] = [];
      sb.ctx.bus.on('weapon.fired', () => fired.push(sb.sim.tick));
      let started = 0;
      let done = 0;
      sb.ctx.bus.on('weapon.reload', (e) => (e.done ? (done = sb.sim.tick) : (started = sb.sim.tick)));
      sb.fire(me);
      sb.stepUntil(() => fired.length >= 6, 600);
      sb.fire(me, false);
      sb.stepUntil(() => done > 0, 600);
      expect(fired).toHaveLength(6);
      expect((fired[1] as number) - (fired[0] as number)).toBeCloseTo(TICK_RATE / 1.4, 0);
      expect(sb.hero(me).weapon.ammo).toBe(6);
      expect((done - started) / TICK_RATE).toBeCloseTo(0.3 + 6 * 0.45, 1);
    });
  });

  describe('Gale Shield', () => {
    it('stands a 6 × 3 m wall of 400 HP 2 m ahead for 4 s, turning with your aim, and slows you 15%', async () => {
      const { sb, me } = await setup();
      const speed = sb.ctx.stats.get(me, 'moveSpeed');
      sb.cast(me, 0);
      sb.step(2);
      const [wall] = walls(sb);
      expect(wall).toBeDefined();
      expect(wall?.team).toBe('dawn');
      expect(wall?.health.hp).toBeCloseTo(400, 1);
      expect(wall?.pos.z).toBeCloseTo(2, 1);
      expect(wall?.pos.x).toBeCloseTo(0, 1);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(speed * 0.85, 3);
      // Turn a quarter to the right: the wall follows.
      sb.look(me, Math.PI / 2);
      sb.step(3);
      expect(wall?.pos.x).toBeCloseTo(2, 1);
      expect(wall?.pos.z).toBeCloseTo(0, 1);
      sb.step(TICK_RATE * 4);
      expect(walls(sb)).toHaveLength(0);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(speed, 3);
      expect(sb.hero(me).abilities.slots[0]?.cooldownTicks).toBe(20 * TICK_RATE);
    });

    it('lifts the slow when the wall breaks early', async () => {
      const { sb, me } = await setup();
      const speed = sb.ctx.stats.get(me, 'moveSpeed');
      sb.cast(me, 0);
      sb.step(2);
      const [wall] = walls(sb);
      sb.apply({ kind: 'damage', amount: 9999, type: 'talon' }, wall?.id as EntityId, sb.cause(null));
      sb.step(3);
      expect(walls(sb)).toHaveLength(0);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(speed, 3);
    });

    it('T3 (with T1, T2): 600 HP, cooldown 15 s, and a burst forward for 60 damage and a knockback', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(6) }], [3, 0, 0, 0]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 0);
      sb.step(2);
      expect(walls(sb)[0]?.health.hp).toBeCloseTo(600, 1);
      expect(sb.hero(me).abilities.slots[0]?.cooldownTicks).toBe(15 * TICK_RATE);
      sb.step(TICK_RATE * 4.2);
      const hits = hitsOn(sb, me, foe, 'albatross.galeShield');
      expect(hits).toHaveLength(1);
      expect(hits[0]?.amount).toBeCloseTo(60, 1);
      expect(sb.entity(foe).pos.z).toBeGreaterThan(8);
    });
  });

  describe('Wing Slam', () => {
    it('dashes 12 m, hitting enemies on the way for 75 and knocking them up', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(6) }]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 1, AHEAD(12));
      sb.step(TICK_RATE * 0.35 + 4);
      const hits = hitsOn(sb, me, foe, 'albatross.wingSlam');
      expect(hits).toHaveLength(1);
      expect(hits[0]?.amount).toBeCloseTo(75, 1);
      expect(sb.hero(foe).motor.knockedUp || sb.entity(foe).pos.y > 0).toBe(true);
      sb.step(TICK_RATE);
      expect(sb.entity(me).pos.z).toBeGreaterThan(10);
      expect(sb.entity(me).pos.z).toBeLessThan(15);
      expect(sb.hero(me).abilities.slots[1]?.cooldownTicks).toBe(15 * TICK_RATE);
    });

    it('T3 (with T1, T2): 100 damage, 12 s cooldown, 2 charges', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(6) }], [0, 3, 0, 0]);
      const foe = rest[0] as EntityId;
      expect(sb.hero(me).abilities.slots[1]?.charges).toBe(2);
      sb.cast(me, 1, AHEAD(12));
      sb.step(TICK_RATE * 0.5);
      expect(hitsOn(sb, me, foe, 'albatross.wingSlam')[0]?.amount).toBeCloseTo(100, 1);
      expect(sb.hero(me).abilities.slots[1]?.charges).toBe(1);
      expect(sb.hero(me).abilities.slots[1]?.cooldownTicks).toBe(12 * TICK_RATE);
    });
  });

  describe('Salt Hide', () => {
    it('gives +30% Talon and Song resist for 6 s and heals 10% of max HP over them', async () => {
      const { sb, me } = await setup();
      const max = sb.ctx.stats.get(me, 'maxHealth');
      sb.health(me).hp = max - 300;
      sb.cast(me, 2);
      sb.step(2);
      expect(sb.ctx.stats.get(me, 'talonResist')).toBeCloseTo(0.3, 3);
      expect(sb.ctx.stats.get(me, 'songResist')).toBeCloseTo(0.3, 3);
      sb.step(TICK_RATE * 6.5);
      expect(sb.ctx.stats.get(me, 'talonResist')).toBe(0);
      expect(sb.health(me).hp).toBeCloseTo(max - 300 + max * 0.1, 0);
      expect(sb.hero(me).abilities.slots[2]?.cooldownTicks).toBe(30 * TICK_RATE);
    });

    it('T3 (with T1, T2): 40% resist, 22 s cooldown, unstoppable 2 s, allies within 8 m get half', async () => {
      const { sb, me, rest } = await setup(
        [{ hero: 'swan', at: { x: 4, y: 0, z: 0 }, team: 'dawn' }, { hero: 'flamingo', at: { x: 12, y: 0, z: 0 }, team: 'dawn' }],
        [0, 0, 3, 0],
      );
      const [near, far] = rest as [EntityId, EntityId];
      const unstoppable = durations(sb, me, 'unstoppable');
      sb.cast(me, 2);
      sb.step(2);
      expect(sb.ctx.stats.get(me, 'talonResist')).toBeCloseTo(0.4, 3);
      expect(sb.ctx.stats.get(me, 'songResist')).toBeCloseTo(0.4, 3);
      expect(unstoppable[0]).toBeCloseTo(2, 1);
      expect(sb.ctx.stats.get(near, 'talonResist')).toBeCloseTo(0.2, 3);
      expect(sb.ctx.stats.get(far, 'talonResist')).toBe(0);
      expect(sb.hero(me).abilities.slots[2]?.cooldownTicks).toBe(22 * TICK_RATE);
    });
  });

  describe('Tempest Dive', () => {
    it('is locked before level 6 and usable at 6', async () => {
      const sb = await createSandbox({ heroes: [{ hero: 'albatross', at: ORIGIN }, 'pelican'], options: { unlockAbilities: false } });
      const [me] = sb.heroes as [EntityId];
      sb.cast(me, 3, AHEAD(20));
      sb.step(5);
      expect(sb.hero(me).abilities.slots[3]?.unlocked).toBe(false);
      expect(sb.hero(me).abilities.slots[3]?.readyAt).toBe(0);
      sb.ctx.bus.emit({ type: 'hero.level', hero: me, level: 6, ap: 0, unlockSlot: 3 });
      sb.step();
      expect(sb.hero(me).abilities.slots[3]?.unlocked).toBe(true);
      sb.cast(me, 3, AHEAD(20));
      sb.step(5);
      expect(sb.hero(me).abilities.slots[3]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('leaps 20 m in 0.9 s, then slams: 180 damage, 1.25 s stun and a pull toward the centre in 8 m', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(24) }, { hero: 'owl', at: AHEAD(34) }]);
      const [near, far] = rest as [EntityId, EntityId];
      const stunned = durations(sb, near, 'stun');
      const unstoppable = durations(sb, me, 'unstoppable');
      sb.cast(me, 3, AHEAD(20));
      sb.step(TICK_RATE * 0.5);
      expect(sb.entity(me).pos.y).toBeGreaterThan(3); // mid-arc
      expect(unstoppable[0]).toBeCloseTo(0.9, 1);
      sb.step(TICK_RATE * 1);
      expect(sb.entity(me).pos.z).toBeGreaterThan(19);
      expect(sb.entity(me).pos.z).toBeLessThan(21);
      const hits = hitsOn(sb, me, near, 'albatross.tempestDive');
      expect(hits).toHaveLength(1);
      expect(hits[0]?.amount).toBeCloseTo(180, 1);
      expect(stunned[0]).toBeCloseTo(1.25, 1);
      expect(sb.entity(near).pos.z).toBeLessThan(24); // pulled toward the centre
      expect(hitsOn(sb, me, far, 'albatross.tempestDive')).toHaveLength(0); // 14 m out
      expect(sb.hero(me).abilities.slots[3]?.cooldownTicks).toBe(120 * TICK_RATE);
    });

    it('T3 (with T1, T2): 10 m radius, stun 1.75 s, 85 s cooldown', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(30) }], [0, 0, 0, 3]);
      const foe = rest[0] as EntityId;
      const stunned = durations(sb, foe, 'stun');
      sb.cast(me, 3, AHEAD(20));
      sb.step(TICK_RATE * 1.5);
      expect(hitsOn(sb, me, foe, 'albatross.tempestDive')).toHaveLength(1); // 10 m away: inside the 10 m radius
      expect(stunned[0]).toBeCloseTo(1.75, 1);
      expect(sb.hero(me).abilities.slots[3]?.cooldownTicks).toBe(85 * TICK_RATE);
    });
  });
});
