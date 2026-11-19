/** Pelican smoke tests (GDD §9.6): the gun, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import type { EntityId, HeroId, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { validateKit } from '../../abilities/kit';
import { pelicanDef } from '../../data/heroes/pelican';
import { pelican } from './index';

const AT = (z: number, x = 0): Vec3 => ({ x, y: 0, z });
const FOE: HeroId = 'albatross';

async function setup(foes: readonly { hero: HeroId; at: Vec3 }[] = [{ hero: FOE, at: AT(3) }], tiers: readonly number[] = [0, 0, 0, 0]) {
  const sb = await createSandbox({ heroes: [{ hero: 'pelican', at: AT(0), yaw: 0 }, ...foes] });
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
const shoot = (sb: Sandbox, me: EntityId, foe: EntityId, ticks: number) => {
  sb.aimAt(me, foe, 'body');
  sb.fire(me);
  sb.step(ticks);
  sb.fire(me, false);
};

describe('Pelican', () => {
  it('has a valid, implemented kit with a swatch', () => {
    expect(validateKit(pelican)).toEqual([]);
    expect(pelican.implemented).toBe(true);
    expect(pelicanDef.swatch).toBeDefined();
  });

  describe('Gullet Gatling (hitscan, 8 Talon, 50 rounds, 11 shots/s, 2.8 s reload)', () => {
    it('deals 8 per bullet up close, holds 50 rounds and fires every 5-6 ticks', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(8) }]);
      expect(sb.hero(me).weapon.ammo).toBe(50);
      const fired: number[] = [];
      sb.ctx.bus.on('weapon.fired', () => fired.push(sb.sim.tick));
      shoot(sb, me, foe, TICK_RATE);
      expect(fired.length).toBeGreaterThanOrEqual(10);
      expect(fired.length).toBeLessThanOrEqual(12);
      const body = hitsOn(sb, me, foe).filter((e) => !e.beakShot);
      expect(body.length).toBeGreaterThan(5);
      for (const e of body) expect(e.amount).toBeCloseTo(8, 1);
    });
  });

  describe('Gulp', () => {
    it('carries a hero stunned and intangible at 80% speed, then spits it 10 m for 70 Song damage, credited to the Pelican', async () => {
      const { sb, me, foe } = await setup();
      sb.cast(me, 0, sb.pointOf(foe));
      sb.step(10);
      expect(sb.hero(foe).motor.attachedTo).toBe(me);
      expect(sb.statuses(foe)).toContain('carried');
      expect(sb.ctx.stats.has(foe, 'stunned')).toBe(true);
      expect(sb.ctx.stats.has(foe, 'intangible')).toBe(true);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(6.8 * 0.8, 2);
      const z0 = sb.entity(foe).pos.z;
      expect(Math.abs(z0 - sb.entity(me).pos.z)).toBeLessThan(2);
      sb.step(TICK_RATE * 2);
      const hits = hitsOn(sb, me, foe, 'pelican.gulp');
      expect(hits).toHaveLength(1);
      expect(hits[0]).toMatchObject({ damageType: 'song', amount: expect.closeTo(70, 1) });
      expect(sb.hero(foe).motor.attachedTo).toBeNull();
      expect(sb.ctx.stats.has(foe, 'stunned')).toBe(false);
      expect(sb.entity(foe).pos.z - sb.entity(me).pos.z).toBeGreaterThan(8);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(6.8, 2);
    });

    it('swallows a fledgling: the Pelican gets the last hit, a pod at its feet and 60 HP', async () => {
      const { sb, me } = await setup([{ hero: FOE, at: AT(80) }]);
      const scrapper = sb.dummy({ kind: 'unit', type: 'scrapper', team: 'dusk', at: AT(3), hp: 300 });
      sb.hero(me).health.hp = 300;
      const seeds = sb.hero(me).progress.seeds;
      sb.cast(me, 0, sb.pointOf(scrapper));
      sb.step(3);
      const died = sb.eventsOf('entity.died').find((e) => e.victim === scrapper);
      expect(died?.creditHero).toBe(me);
      expect(sb.hero(me).health.hp).toBeCloseTo(360, 0);
      expect(sb.hero(me).progress.seeds).toBeGreaterThan(seeds);
      const pod = sb.ctx.store.list('pickup').find((p) => p.pickup.type === 'pod');
      expect(pod).toBeDefined();
      expect(Math.hypot((pod?.pos.x ?? 99) - sb.entity(me).pos.x, (pod?.pos.z ?? 99) - sb.entity(me).pos.z)).toBeLessThan(0.5);
    });

    it('T1 +30 damage; T2 cooldown 15 s; T3 stuns 0.75 s on landing', async () => {
      const { sb, me, foe } = await setup(undefined, [3, 0, 0, 0]);
      expect(sb.hero(me).abilities.slots[0]?.tier).toBe(3);
      sb.cast(me, 0, sb.pointOf(foe));
      sb.step(2);
      expect(sb.hero(me).abilities.slots[0]?.cooldownTicks).toBe(15 * TICK_RATE);
      sb.step(TICK_RATE + 10);
      expect(hitsOn(sb, me, foe, 'pelican.gulp')[0]?.amount).toBeCloseTo(100, 1);
      sb.step(Math.round(0.54 * TICK_RATE) + 8);
      expect(sb.ctx.stats.has(foe, 'stunned')).toBe(true);
      sb.step(TICK_RATE);
      expect(sb.ctx.stats.has(foe, 'stunned')).toBe(false);
    });

    it('does nothing to an unstoppable hero', async () => {
      const { sb, me, foe } = await setup();
      sb.modify(foe, 'steady', { conditions: ['unstoppable'] });
      sb.cast(me, 0, sb.pointOf(foe));
      sb.step(TICK_RATE * 2);
      expect(hitsOn(sb, me, foe)).toHaveLength(0);
    });
  });

  describe('Feeding Frenzy', () => {
    it('reloads at once, +35% fire rate and 15% lifesteal for 6 s', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(8) }]);
      sb.hero(me).weapon.ammo = 3;
      sb.hero(me).health.hp = 300;
      sb.cast(me, 1);
      sb.step(2);
      expect(sb.hero(me).weapon.ammo).toBe(50);
      expect(sb.ctx.stats.get(me, 'fireRate')).toBeCloseTo(0.35, 3);
      expect(sb.ctx.stats.get(me, 'talonLifesteal')).toBeCloseTo(0.15, 3);
      const before = sb.hero(me).health.hp;
      shoot(sb, me, foe, TICK_RATE);
      expect(sb.hero(me).health.hp).toBeGreaterThan(before);
      sb.step(TICK_RATE * 6);
      expect(sb.ctx.stats.get(me, 'fireRate')).toBe(0);
    });

    it('T1 8 s, T2 +15% fire rate, T3 each hero hit shreds 2% Talon resist up to 5 stacks', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(8) }], [0, 3, 0, 0]);
      sb.cast(me, 1);
      sb.step(2);
      expect(sb.ctx.stats.get(me, 'fireRate')).toBeCloseTo(0.5, 3);
      shoot(sb, me, foe, TICK_RATE);
      expect(sb.ctx.stats.get(foe, 'talonShred')).toBeCloseTo(0.1, 3); // 5 stacks of 2%
      sb.step(TICK_RATE * 7);
      expect(sb.ctx.stats.get(me, 'fireRate')).toBe(0); // 8 s
    });
  });

  describe('Belly Flop', () => {
    it('leaps to the point and lands for 70 Song damage, a 4 m knockback and a 30% slow', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(11) }]);
      sb.cast(me, 2, AT(8));
      sb.step(TICK_RATE * 2);
      const hits = hitsOn(sb, me, foe, 'pelican.bellyFlop');
      expect(hits).toHaveLength(1);
      expect(hits[0]?.amount).toBeCloseTo(70, 1);
      expect(sb.entity(me).pos.z).toBeGreaterThan(6);
      expect(sb.entity(foe).pos.z).toBeGreaterThan(13);
      expect(sb.statuses(foe)).toContain('slow');
    });

    it('T3 (with T1, T2) holds 2 charges, 10 s cooldown and a 6.5 m landing', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(14) }], [0, 0, 3, 0]);
      expect(sb.hero(me).abilities.slots[2]?.charges).toBe(2);
      sb.cast(me, 2, AT(8));
      sb.step(TICK_RATE * 2);
      expect(hitsOn(sb, me, foe, 'pelican.bellyFlop')).toHaveLength(1); // 6.5 m from the landing
      expect(sb.hero(me).abilities.slots[2]?.cooldownTicks).toBe(10 * TICK_RATE);
    });
  });

  describe('Bottomless Pouch', () => {
    it('uses no ammo, +30% damage and 35% splash to a second hero within 1.5 m', async () => {
      const { sb, me, foe, rest } = await setup([{ hero: FOE, at: AT(8) }, { hero: 'kingfisher', at: AT(8, 1.2) }]);
      sb.cast(me, 3);
      sb.step(2);
      shoot(sb, me, foe, TICK_RATE);
      expect(sb.hero(me).weapon.ammo).toBe(50);
      const direct = hitsOn(sb, me, foe).filter((e) => !e.beakShot);
      expect(direct.length).toBeGreaterThan(5);
      expect(direct[0]?.amount).toBeCloseTo(8 * 1.3, 1);
      const splash = hitsOn(sb, me, rest[1] as EntityId);
      expect(splash.length).toBeGreaterThan(0);
      expect(splash[0]?.amount).toBeCloseTo(8 * 1.3 * 0.35, 1);
    });

    it('T1 11 s, T2 +15% gun damage, T3 20% lifesteal', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(8) }], [0, 0, 0, 3]);
      sb.cast(me, 3);
      sb.step(2);
      expect(sb.ctx.stats.get(me, 'talonLifesteal')).toBeCloseTo(0.2, 3);
      shoot(sb, me, foe, 10);
      const direct = hitsOn(sb, me, foe).filter((e) => !e.beakShot);
      expect(direct[0]?.amount).toBeCloseTo(8 * 1.45, 1);
      sb.step(TICK_RATE * 10);
      expect(sb.ctx.stats.get(me, 'talonLifesteal')).toBeCloseTo(0.2, 3); // 11 s
      sb.step(TICK_RATE * 2);
      expect(sb.ctx.stats.get(me, 'talonLifesteal')).toBe(0);
    });
  });
});
