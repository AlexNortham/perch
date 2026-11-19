/** Starling smoke tests (GDD §9.8): the gun, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import type { EntityId, HeroId, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { validateKit } from '../../abilities/kit';
import { SLOW } from '../../data/combat';
import { starlingDef } from '../../data/heroes/starling';
import { starling } from './index';

const AT = (z: number, x = 0): Vec3 => ({ x, y: 0, z });
const FOE: HeroId = 'albatross';

async function setup(foes: readonly { hero: HeroId; at: Vec3 }[] = [{ hero: FOE, at: AT(10) }], tiers: readonly number[] = [0, 0, 0, 0]) {
  const sb = await createSandbox({ heroes: [{ hero: 'starling', at: AT(0), yaw: 0 }, ...foes] });
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
const total = (hits: readonly { amount: number }[]) => hits.reduce((s, h) => s + h.amount, 0);

describe('Starling', () => {
  it('has a valid, implemented kit with a swatch', () => {
    expect(validateKit(starling)).toEqual([]);
    expect(starling.implemented).toBe(true);
    expect(starlingDef.swatch).toBeDefined();
  });

  describe('Chatter Pistol (projectile 70 m/s, 9 Talon x 2 pellets, 16 rounds, 4 shots/s)', () => {
    it('fires two travelling pellets of 9 up close and holds 16 rounds', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(6) }]);
      expect(sb.hero(me).weapon.ammo).toBe(16);
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.step(TICK_RATE / 4 + 20);
      sb.fire(me, false);
      const hits = hitsOn(sb, me, foe).filter((e) => !e.beakShot);
      expect(hits.length).toBeGreaterThanOrEqual(2);
      for (const e of hits) expect(e.amount).toBeCloseTo(9, 1);
      expect(sb.eventsOf('weapon.fired').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Murmuration', () => {
    it('pierces everything in 30 m: 110 Song damage to each of two heroes and a fledgling', async () => {
      const { sb, me, foe, rest } = await setup([{ hero: FOE, at: AT(10) }, { hero: 'kingfisher', at: AT(20) }]);
      const scrapper = sb.dummy({ kind: 'unit', type: 'scrapper', team: 'dusk', at: AT(15), hp: 900 });
      sb.cast(me, 0, { x: 0, y: 1, z: 30 });
      sb.step(TICK_RATE * 2);
      expect(hitsOn(sb, me, foe, 'starling.murmuration')).toHaveLength(1);
      expect(hitsOn(sb, me, foe, 'starling.murmuration')[0]).toMatchObject({ damageType: 'song', amount: expect.closeTo(110, 1) });
      expect(hitsOn(sb, me, rest[1] as EntityId, 'starling.murmuration')[0]?.amount).toBeCloseTo(110, 1);
      expect(hitsOn(sb, me, scrapper, 'starling.murmuration')).toHaveLength(1);
    });

    it('stops at 30 m', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(33) }]);
      sb.cast(me, 0, { x: 0, y: 1, z: 30 });
      sb.step(TICK_RATE * 2);
      expect(hitsOn(sb, me, foe, 'starling.murmuration')).toHaveLength(0);
    });

    it('T1 +40 damage, T2 -3 s cooldown, T3 two charges', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(10) }], [3, 0, 0, 0]);
      expect(sb.hero(me).abilities.slots[0]?.charges).toBe(2);
      sb.cast(me, 0, { x: 0, y: 1, z: 30 });
      sb.step(TICK_RATE * 2);
      expect(hitsOn(sb, me, foe, 'starling.murmuration')[0]?.amount).toBeCloseTo(150, 1);
      expect(sb.hero(me).abilities.slots[0]?.cooldownTicks).toBe(8 * TICK_RATE);
    });
  });

  describe('Mob', () => {
    it('a 5 m cloud for 4 s: about 35 a second, 20% slow and revealed', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(20) }]);
      sb.cast(me, 1, AT(20));
      sb.step(TICK_RATE);
      expect(sb.ctx.stats.get(foe, 'slow')).toBeCloseTo(0.2, 3);
      expect(sb.ctx.stats.has(foe, 'revealed')).toBe(true);
      sb.step(TICK_RATE * 4);
      const dealt = total(hitsOn(sb, me, foe, 'starling.mob'));
      expect(dealt).toBeGreaterThan(35 * 3.5);
      expect(dealt).toBeLessThanOrEqual(35 * 4 + 0.5);
      expect(sb.ctx.stats.has(foe, 'revealed')).toBe(false);
      expect(sb.ctx.stats.get(foe, 'healReduction')).toBe(0);
    });

    it('does not reach a hero 6 m from the centre', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(26) }]);
      sb.cast(me, 1, AT(20));
      sb.step(TICK_RATE * 2);
      expect(hitsOn(sb, me, foe, 'starling.mob')).toHaveLength(0);
    });

    it('T1 6 s, T2 6.5 m radius, T3 heal reduction 50%', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(26) }], [0, 3, 0, 0]);
      sb.cast(me, 1, AT(20));
      sb.step(TICK_RATE);
      expect(hitsOn(sb, me, foe, 'starling.mob').length).toBeGreaterThan(0); // 6 m, inside 6.5
      expect(sb.ctx.stats.get(foe, 'healReduction')).toBeCloseTo(0.5, 3);
      sb.step(TICK_RATE * 5);
      expect(sb.ctx.stats.has(foe, 'revealed')).toBe(true); // 6 s
      sb.step(TICK_RATE * 2);
      expect(sb.ctx.stats.has(foe, 'revealed')).toBe(false);
    });
  });

  describe('Scatter', () => {
    it('names slows and roots in its cleanse (a rooted hero cannot cast a movement ability: INTERFACES request)', () => {
      expect(starlingDef.abilities[2].effects[0]).toMatchObject({ kind: 'cleanse', remove: ['slow', 'root'] });
    });

    it('is intangible for 1 s, travels 12 m through a hero and lifts a slow', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(6) }]);
      sb.apply({ kind: 'applyStatus', status: SLOW, durationS: 5, magnitude: 0.4 }, me, sb.cause(foe));
      expect(sb.ctx.stats.get(me, 'slow')).toBeCloseTo(0.4, 3);
      sb.cast(me, 2, AT(20));
      sb.step(5);
      expect(sb.ctx.stats.get(me, 'slow')).toBe(0);
      expect(sb.ctx.stats.has(me, 'intangible')).toBe(true);
      sb.step(TICK_RATE * 1.2);
      expect(sb.ctx.stats.has(me, 'intangible')).toBe(false);
      expect(sb.entity(me).pos.z).toBeGreaterThan(10);
      expect(sb.entity(me).pos.z).toBeLessThan(13);
    });

    it('T1 16 s cooldown, T2 18 m, T3 the reform deals 80 Song damage within 4 m', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(20) }], [0, 0, 3, 0]);
      sb.cast(me, 2, AT(30));
      sb.step(2);
      expect(sb.hero(me).abilities.slots[2]?.cooldownTicks).toBe(16 * TICK_RATE);
      sb.step(TICK_RATE * 1.5);
      expect(sb.entity(me).pos.z).toBeGreaterThan(16);
      const hits = hitsOn(sb, me, foe, 'starling.scatter');
      expect(hits).toHaveLength(1);
      expect(hits[0]?.amount).toBeCloseTo(80, 1);
    });
  });

  describe('Black Sun', () => {
    it('roots through a 0.75 s windup, then a 10 m sphere deals 100 a second and +15% Song damage for 3 s', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(8) }]);
      sb.cast(me, 3);
      sb.step(Math.round(TICK_RATE * 0.4));
      expect(hitsOn(sb, me, foe, 'starling.blackSun')).toHaveLength(0);
      expect(sb.hero(me).abilities.casting).not.toBeNull();
      sb.step(TICK_RATE);
      expect(sb.ctx.stats.get(foe, 'songAmp')).toBeCloseTo(0.15, 3);
      sb.step(TICK_RATE * 3);
      const dealt = total(hitsOn(sb, me, foe, 'starling.blackSun'));
      // 100 a second for 3 s, each tick also amplified by the sun's own +15%.
      expect(dealt).toBeGreaterThan(100 * 1.15 * 2.5);
      expect(dealt).toBeLessThanOrEqual(100 * 1.15 * 3 + 0.5);
      sb.step(TICK_RATE);
      expect(sb.ctx.stats.get(foe, 'songAmp')).toBe(0);
    });

    it('does not reach a hero 12 m away', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(12) }]);
      sb.cast(me, 3);
      sb.step(TICK_RATE * 4);
      expect(hitsOn(sb, me, foe, 'starling.blackSun')).toHaveLength(0);
    });

    it('T1 13 m, T2 4 s, T3 a 150 Song damage burst and 1 s silence after the windup', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(12) }], [0, 0, 0, 3]);
      sb.cast(me, 3);
      sb.step(Math.round(TICK_RATE * 0.9));
      const burst = hitsOn(sb, me, foe, 'starling.blackSun');
      expect(burst[0]?.amount).toBeCloseTo(150, 1);
      expect(sb.ctx.stats.has(foe, 'silenced')).toBe(true);
      sb.step(TICK_RATE * 5);
      const ticks = hitsOn(sb, me, foe, 'starling.blackSun').length - 1;
      expect(ticks).toBe(8); // 4 s of 0.5 s ticks
    });
  });
});
