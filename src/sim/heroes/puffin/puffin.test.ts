/** Puffin smoke tests (GDD §9.12): the gun, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import type { EntityId, HeroId, PlayerTeam, UnitEntity, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { resolveAbility, validateKit } from '../../abilities/kit';
import { puffinDef } from '../../data/heroes/puffin';
import { puffin } from './index';

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
const AT = (x: number, z: number): Vec3 => ({ x, y: 0, z });
interface Spec {
  readonly hero: HeroId;
  readonly at: Vec3;
  readonly team?: PlayerTeam;
}

async function setup(others: readonly Spec[] = [], tiers: readonly number[] = [0, 0, 0, 0]) {
  const sb = await createSandbox({ heroes: [{ hero: 'puffin', at: ORIGIN, yaw: 0 }, ...others] });
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
const turrets = (sb: Sandbox): UnitEntity[] => sb.ctx.store.list('unit').filter((u) => u.unit.summon === 'turret');

describe('Puffin', () => {
  it('has a valid, implemented kit with the GDD body, stats and gun', () => {
    expect(validateKit(puffin)).toEqual([]);
    expect(puffin.implemented).toBe(true);
    expect(puffinDef.swatch).toBeDefined();
    expect(puffinDef.body).toMatchObject({ height: 1.45, radius: 0.36, head: { radius: 0.19, centre: { up: 1.27 } } });
    expect(puffinDef.stats).toMatchObject({ maxHealth: 580, moveSpeed: 6.9, weaponDamage: 18, magazine: 18 });
    expect(puffinDef.weapon).toMatchObject({ hitscan: false, projectileSpeed: 100, spreadDeg: 0.6, fireRate: 4, reloadS: 2, falloff: { start: 18, end: 40 } });
  });

  it('Eel Sling: a travelling 18 Talon bullet, 18 rounds, 4 a second', async () => {
    const { sb, me, rest } = await setup([{ hero: 'pelican', at: AT(0, 8), team: 'dusk' }]);
    const foe = rest[0] as EntityId;
    expect(sb.hero(me).weapon.ammo).toBe(18);
    sb.aimAt(me, foe, 'body');
    sb.fire(me);
    sb.step(TICK_RATE / 2);
    sb.fire(me, false);
    const hits = sb.eventsOf('damage.applied').filter((e) => e.source === me && e.target === foe && e.via === 'weapon');
    expect(hits[0]?.amount).toBeCloseTo(18, 0);
    expect(sb.hero(me).weapon.ammo).toBeLessThan(18);
  });

  describe('Burrow Colony', () => {
    it('digs a 200 HP turret for 20 s that shoots the nearest enemy 12 Song every 0.5 s; two charges', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AT(0, 14), team: 'dusk' }]);
      const foe = rest[0] as EntityId;
      expect(slot(sb, me, 0)?.charges).toBe(2);
      sb.cast(me, 0, AT(0, 10));
      sb.step(TICK_RATE * 3);
      const [t] = turrets(sb);
      expect(t?.health.hp).toBeCloseTo(200, 0);
      const hits = abilityHits(sb, me, foe, 'puffin.burrowColony');
      expect(hits.length).toBeGreaterThanOrEqual(4);
      expect(hits.length).toBeLessThanOrEqual(7);
      for (const h of hits) expect([h.damageType, h.amount]).toEqual(['song', expect.closeTo(12, 0)]);
      sb.step(TICK_RATE * 18);
      expect(turrets(sb)).toHaveLength(0);
    });

    it('T1: 3 charges and a data cap of 3; T3: turrets burst for 80 in 4 m when they expire', async () => {
      const def = puffinDef.abilities[0];
      expect(resolveAbility(def, 1)).toMatchObject({ charges: 3, values: { extra: 1 } });
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AT(0, 17), team: 'dusk' }], [3, 0, 0, 0]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 0, AT(0, 15)); // the turret shoots for 12 now and then; the expiry burst is the one 80
      sb.step(TICK_RATE * 21);
      const hits = abilityHits(sb, me, foe, 'puffin.burrowColony');
      expect(hits.some((h) => Math.abs(h.amount - 80) < 1)).toBe(true);
    });

    it('T2: turret hits slow the enemy 15% for 1 s', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AT(0, 14), team: 'dusk' }], [2, 0, 0, 0]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 0, AT(0, 10));
      sb.step(TICK_RATE);
      expect(sb.ctx.stats.get(foe, 'slow')).toBeCloseTo(0.15, 2);
    });
  });

  describe('Sea Spray', () => {
    it('hits enemies in a 10 m cone for 50 Song, knocks them back and slows 25%; not those behind', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AT(0, 7), team: 'dusk' },
        { hero: 'kingfisher', at: AT(0, -5), team: 'dusk' },
      ]);
      const [front, back] = rest as [EntityId, EntityId];
      sb.cast(me, 1, AT(0, 30));
      sb.step(TICK_RATE / 2);
      const hits = abilityHits(sb, me, front, 'puffin.seaSpray');
      expect(hits).toHaveLength(1);
      expect([hits[0]?.damageType, hits[0]?.amount]).toEqual(['song', expect.closeTo(50, 0)]);
      expect(sb.hero(front).pos.z).toBeGreaterThan(12);
      expect(sb.ctx.stats.get(front, 'slow')).toBeCloseTo(0.25, 2);
      expect(abilityHits(sb, me, back, 'puffin.seaSpray')).toHaveLength(0);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(12 * TICK_RATE);
    });

    it('T3 (with T1, T2): 13 m, 9 s cooldown, enemies take +15% Song damage for 4 s', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AT(0, 12), team: 'dusk' }], [0, 3, 0, 0]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 1, AT(0, 30));
      sb.step(2);
      expect(abilityHits(sb, me, foe, 'puffin.seaSpray')).toHaveLength(1);
      expect(sb.ctx.stats.get(foe, 'songAmp')).toBeCloseTo(0.15, 2);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(9 * TICK_RATE);
    });
  });

  describe('Fog Bank', () => {
    it('cloaks allies inside without breaking on fire and reveals enemies inside, for 7 s', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AT(0, 20), team: 'dusk' },
        { hero: 'kingfisher', at: AT(2, 20), team: 'dawn' },
      ]);
      const [foe, ally] = rest as [EntityId, EntityId];
      sb.cast(me, 2, AT(0, 20));
      sb.step(TICK_RATE * 0.7);
      expect(sb.statuses(ally)).toContain('puffin.fogCloak');
      expect(sb.statuses(foe)).toContain('reveal');
      sb.aimAt(ally, foe, 'body');
      sb.fire(ally);
      sb.step(TICK_RATE / 2);
      sb.fire(ally, false);
      expect(sb.statuses(ally)).toContain('puffin.fogCloak');
      sb.step(TICK_RATE * 7);
      expect(sb.statuses(ally)).not.toContain('puffin.fogCloak');
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(22 * TICK_RATE);
    });

    it('conceals allies only against observers outside it (data), and T1-T3 add radius, time and a slow', async () => {
      const def = puffinDef.abilities[2];
      expect(def.effects[0]).toMatchObject({ kind: 'area', concealsAlliesOutside: true });
      expect(resolveAbility(def, 3).values).toMatchObject({ radius: 9, duration: 10 });
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AT(0, 20), team: 'dusk' }], [0, 0, 3, 0]);
      sb.cast(me, 2, AT(0, 20));
      sb.step(TICK_RATE);
      expect(sb.ctx.stats.get(rest[0] as EntityId, 'slow')).toBeCloseTo(0.2, 2);
    });
  });

  describe('Rogue Wave', () => {
    it('is locked before level 6 and usable at 6', async () => {
      const sb = await createSandbox({ heroes: [{ hero: 'puffin', at: ORIGIN, yaw: 0 }], options: { unlockAbilities: false } });
      const me = sb.heroes[0] as EntityId;
      sb.cast(me, 3);
      sb.step(2);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(0);
      sb.ctx.bus.emit({ type: 'hero.level', hero: me, level: 6, ap: 0, unlockSlot: 3 });
      sb.step(1);
      sb.cast(me, 3, AT(0, 30));
      sb.step(2);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(110 * TICK_RATE);
    });

    it('sweeps a 16 m wave forward: an enemy in its width takes 160 Song once, a bystander off to the side none', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AT(0, 12), team: 'dusk' },
        { hero: 'kingfisher', at: AT(14, 12), team: 'dusk' },
      ]);
      const [hit, side] = rest as [EntityId, EntityId];
      sb.cast(me, 3, AT(0, 30));
      sb.step(TICK_RATE * 2);
      const hits = abilityHits(sb, me, hit, 'puffin.rogueWave');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits).toHaveLength(1); // onEnter does not repeat: the carried target rides inside the wave (D-ABIL-011)
      expect([hits[0]?.damageType, hits[0]?.amount]).toEqual(['song', expect.closeTo(160, 0)]);
      expect(abilityHits(sb, me, side, 'puffin.rogueWave')).toHaveLength(0);
    });

    it('carries the enemy with it, at most 12 m (Abilities maxCarry)', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AT(0, 12), team: 'dusk' }]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 3, AT(0, 30));
      sb.step(TICK_RATE * 2);
      expect(sb.hero(foe).pos.z).toBeGreaterThan(12); // carried by displace along the wave at least a little
      expect(sb.hero(foe).pos.z - 12).toBeLessThanOrEqual(12.5);
    });

    it('T1 22 m wide, T2 220 damage, T3 wet ground slows 30%', async () => {
      const def = puffinDef.abilities[3];
      expect(resolveAbility(def, 1).values.halfWidth).toBe(11);
      expect(resolveAbility(def, 2).values.damage).toBe(220);
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AT(0, 25), team: 'dusk' }], [0, 0, 0, 3]);
      sb.cast(me, 3, AT(0, 30));
      sb.step(TICK_RATE * 2);
      sb.place(rest[0] as EntityId, AT(0, 20));
      sb.step(TICK_RATE);
      expect(sb.ctx.stats.get(rest[0] as EntityId, 'slow')).toBeCloseTo(0.3, 2);
    });
  });
});
