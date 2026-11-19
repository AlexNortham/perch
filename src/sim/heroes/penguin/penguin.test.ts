/** Penguin smoke tests (GDD §9.11): the gun, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import { Button } from '../../core/contracts';
import type { EntityId, HeroId, PlayerTeam, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { resolveAbility, validateKit } from '../../abilities/kit';
import { penguinDef } from '../../data/heroes/penguin';
import { penguin } from './index';

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
const AT = (x: number, z: number): Vec3 => ({ x, y: 0, z });
interface Spec {
  readonly hero: HeroId;
  readonly at: Vec3;
  readonly team?: PlayerTeam;
}

async function setup(others: readonly Spec[] = [], tiers: readonly number[] = [0, 0, 0, 0]) {
  const sb = await createSandbox({ heroes: [{ hero: 'penguin', at: ORIGIN, yaw: 0 }, ...others] });
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
const slot = (sb: Sandbox, me: EntityId, i: number) => sb.hero(me).abilities.slots[i];
const abilityHits = (sb: Sandbox, me: EntityId, foe: EntityId, ability: string) =>
  sb.eventsOf('damage.applied').filter((e) => e.source === me && e.target === foe && e.ability === ability);

describe('Penguin', () => {
  it('has a valid, implemented kit with the GDD body, stats and gun', () => {
    expect(validateKit(penguin)).toEqual([]);
    expect(penguin.implemented).toBe(true);
    expect(penguinDef.swatch).toBeDefined();
    expect(penguinDef.body).toMatchObject({ height: 1.6, radius: 0.42, head: { radius: 0.18, centre: { up: 1.42 } } });
    expect(penguinDef.stats).toMatchObject({ maxHealth: 700, moveSpeed: 6.6, weaponDamage: 10, magazine: 35 });
    expect(penguinDef.weapon).toMatchObject({ hitscan: false, projectileSpeed: 80, spreadDeg: 1.8, fireRate: 7, reloadS: 2.5, falloff: { start: 10, end: 25 } });
  });

  it('Ice Chipper: a travelling 10 Talon bullet, 35 rounds, 7 a second', async () => {
    const { sb, me, rest } = await setup([{ hero: 'pelican', at: AT(0, 6), team: 'dusk' }]);
    const foe = rest[0] as EntityId;
    expect(sb.hero(me).weapon.ammo).toBe(35);
    sb.aimAt(me, foe, 'body');
    sb.fire(me);
    sb.step(TICK_RATE / 2);
    sb.fire(me, false);
    const hits = sb.eventsOf('damage.applied').filter((e) => e.source === me && e.target === foe && e.via === 'weapon');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.amount).toBeGreaterThan(9);
    expect(hits[0]?.amount).toBeLessThanOrEqual(10.01);
    expect(sb.hero(me).weapon.ammo).toBeLessThan(35);
  });

  describe('Toboggan', () => {
    it('slides at 13 m/s with no gun, hits an enemy once for 60 Song and knocks it aside', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AT(0.3, 8), team: 'dusk' }]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 0);
      sb.step(2);
      expect(sb.hero(me).motor.mode).toBe('toboggan');
      expect(sb.hero(me).motor.modeAllowsGun).toBe(false);
      sb.step(TICK_RATE);
      expect(sb.hero(me).pos.z).toBeGreaterThan(12);
      const hits = abilityHits(sb, me, foe, 'penguin.toboggan');
      expect(hits).toHaveLength(1);
      expect([hits[0]?.damageType, hits[0]?.amount]).toEqual(['song', expect.closeTo(60, 0)]);
      expect(sb.hero(foe).pos.x).toBeGreaterThan(3.5); // knocked to its own side, 4 m
      sb.step(TICK_RATE * 3);
      expect(sb.hero(me).motor.mode).toBeNull();
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(16 * TICK_RATE);
    });

    it('Space ends the slide with a hop that keeps the speed', async () => {
      const { sb, me } = await setup();
      sb.cast(me, 0);
      sb.step(TICK_RATE / 2);
      const z = sb.hero(me).pos.z;
      let peak = 0;
      sb.press(me, Button.Jump);
      for (let i = 0; i < 40; i++) {
        sb.step(1);
        peak = Math.max(peak, sb.hero(me).pos.y);
      }
      expect(sb.hero(me).motor.mode).toBeNull();
      expect(sb.hero(me).pos.z - z).toBeGreaterThan(5);
      expect(peak).toBeGreaterThan(0.8);
      expect(peak).toBeLessThan(1.5);
    });

    it('T3 (with T1, T2): 85 damage, 12 s cooldown, knocks enemies up instead of aside', async () => {
      expect(resolveAbility(penguinDef.abilities[0], 3).values).toMatchObject({ damage: 85, knockUp: 1 });
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AT(0.3, 8), team: 'dusk' }], [3, 0, 0, 0]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 0);
      let peak = 0;
      for (let i = 0; i < TICK_RATE * 1.5; i++) {
        sb.step(1);
        peak = Math.max(peak, sb.hero(foe).pos.y);
      }
      expect(peak).toBeGreaterThan(0.4);
      expect(Math.abs(sb.hero(foe).pos.x - 0.3)).toBeLessThan(0.5);
      expect(abilityHits(sb, me, foe, 'penguin.toboggan')[0]?.amount).toBeCloseTo(85, 0);
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(12 * TICK_RATE);
    });
  });

  describe('Huddle', () => {
    it('gives you and allies within 6 m a 180 barrier for 4 s, not allies farther off', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AT(4, 0), team: 'dawn' },
        { hero: 'kingfisher', at: AT(9, 0), team: 'dawn' },
      ]);
      const [near, far] = rest as [EntityId, EntityId];
      sb.cast(me, 1);
      sb.step(2);
      expect(sb.health(me).barrier).toBeCloseTo(180, 0);
      expect(sb.health(near).barrier).toBeCloseTo(180, 0);
      expect(sb.health(far).barrier).toBe(0);
      sb.step(TICK_RATE * 4 + 5);
      expect(sb.health(me).barrier).toBe(0);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(22 * TICK_RATE);
    });

    it('T3 (with T1, T2): 240 barrier, 10 m, +25% status resist', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AT(9, 0), team: 'dawn' }], [0, 3, 0, 0]);
      sb.cast(me, 1);
      sb.step(2);
      expect(sb.health(rest[0] as EntityId).barrier).toBeCloseTo(240, 0);
      expect(sb.ctx.stats.get(me, 'statusResist')).toBeCloseTo(0.25, 2);
    });
  });

  describe('Ice Floe', () => {
    it('slows enemies on it 35% and speeds allies 20%, for 5 s', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AT(0, 15), team: 'dusk' },
        { hero: 'kingfisher', at: AT(2, 15), team: 'dawn' },
      ]);
      const [foe, ally] = rest as [EntityId, EntityId];
      const speed = sb.ctx.stats.get(ally, 'moveSpeed');
      sb.cast(me, 2, AT(0, 15));
      sb.step(TICK_RATE);
      expect(sb.ctx.stats.get(foe, 'slow')).toBeCloseTo(0.35, 2);
      expect(sb.ctx.stats.get(ally, 'moveSpeed')).toBeCloseTo(speed * 1.2, 2);
      sb.step(TICK_RATE * 5);
      expect(sb.ctx.stats.get(foe, 'slow')).toBe(0);
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(18 * TICK_RATE);
    });

    it('T3 (with T1, T2): 7 s, 8 m, enemies grounded', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AT(7, 15), team: 'dusk' }], [0, 0, 3, 0]);
      sb.cast(me, 2, AT(0, 15));
      sb.step(TICK_RATE);
      expect(sb.statuses(rest[0] as EntityId)).toContain('grounded');
    });
  });

  describe("Emperor's March", () => {
    it('is locked before level 6 and usable at 6', async () => {
      const sb = await createSandbox({ heroes: [{ hero: 'penguin', at: ORIGIN, yaw: 0 }], options: { unlockAbilities: false } });
      const me = sb.heroes[0] as EntityId;
      sb.cast(me, 3);
      sb.step(2);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(0);
      sb.ctx.bus.emit({ type: 'hero.level', hero: me, level: 6, ap: 0, unlockSlot: 3 });
      sb.step(1);
      sb.cast(me, 3);
      sb.step(2);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(110 * TICK_RATE);
    });

    it('is unstoppable and 40% faster for 3 s; a touched hero goes up and takes 150 once; then a 6 m slam stuns it', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AT(0, 6), team: 'dusk' }]);
      const foe = rest[0] as EntityId;
      const speed = sb.ctx.stats.get(me, 'moveSpeed');
      sb.cast(me, 3);
      sb.step(2);
      expect(sb.statuses(me)).toContain('unstoppable');
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(speed * 1.4, 2);
      sb.move(me, 1);
      let peak = 0;
      for (let i = 0; i < TICK_RATE * 2; i++) {
        sb.step(1);
        peak = Math.max(peak, sb.hero(foe).pos.y);
      }
      expect(peak).toBeGreaterThan(2);
      const touch = abilityHits(sb, me, foe, 'penguin.emperorsMarch').filter((h) => h.amount > 120);
      expect(touch).toHaveLength(1);
      expect(touch[0]?.amount).toBeCloseTo(150, 0);
      sb.move(me, 0);
      sb.place(foe, { x: sb.hero(me).pos.x + 4, y: 0, z: sb.hero(me).pos.z });
      sb.step(TICK_RATE * 2);
      const slam = abilityHits(sb, me, foe, 'penguin.emperorsMarch').filter((h) => h.amount < 120);
      expect(slam.length).toBeGreaterThan(0);
      expect(slam[0]?.amount).toBeCloseTo(100, 0);
      const stuns = sb.eventsOf('status.applied').filter((e) => e.target === foe && e.status === 'stun');
      expect(stuns).toHaveLength(1);
      expect((stuns[0] as { expiresAt: number; tick?: number }).expiresAt).toBeGreaterThan(0);
      expect(sb.statuses(me)).not.toContain('unstoppable');
    });

    it('T1 (4 s), T2 (stun 1.25 s), T3 (80 s cooldown)', () => {
      const def = penguinDef.abilities[3];
      expect(resolveAbility(def, 1).values.duration).toBe(4);
      expect(resolveAbility(def, 2).values.stun).toBe(1.25);
      expect(resolveAbility(def, 3).cooldownS).toBe(80);
    });
  });
});
