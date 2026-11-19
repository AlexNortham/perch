/** Flamingo smoke tests (GDD §9.10): the gun, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import type { EntityId, HeroId, PlayerTeam, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { SLOW } from '../../data/combat';
import { resolveAbility, validateKit } from '../../abilities/kit';
import { flamingoDef } from '../../data/heroes/flamingo';
import { flamingo } from './index';

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
const AHEAD = (z: number): Vec3 => ({ x: 0, y: 0, z });
interface Spec {
  readonly hero: HeroId;
  readonly at: Vec3;
  readonly team?: PlayerTeam;
}

async function setup(others: readonly Spec[] = [], tiers: readonly number[] = [0, 0, 0, 0]) {
  const sb = await createSandbox({ heroes: [{ hero: 'flamingo', at: ORIGIN, yaw: 0 }, ...others] });
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
const gunHits = (sb: Sandbox, me: EntityId, foe: EntityId) =>
  sb.eventsOf('damage.applied').filter((e) => e.source === me && e.target === foe && e.via === 'weapon');
const hurt = (sb: Sandbox, who: EntityId, by: EntityId, amount: number) =>
  sb.apply([{ kind: 'damage', amount, type: 'talon' }], who, sb.cause(by, {}));

describe('Flamingo', () => {
  it('has a valid, implemented kit with the GDD body, stats and gun', () => {
    expect(validateKit(flamingo)).toEqual([]);
    expect(flamingo.implemented).toBe(true);
    expect(flamingoDef.swatch).toBeDefined();
    expect(flamingoDef.body).toMatchObject({ height: 2.3, radius: 0.26, head: { radius: 0.14, centre: { up: 2.15 } } });
    expect(flamingoDef.stats).toMatchObject({ maxHealth: 560, moveSpeed: 7, weaponDamage: 12, magazine: 30 });
    expect(flamingoDef.weapon).toMatchObject({ hitscan: true, fireRate: 6, spreadDeg: 0.9, reloadS: 2, falloff: { start: 16, end: 36 } });
  });

  it('Wader Repeater: 12 per shot, 30 rounds, 6 shots a second', async () => {
    const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(10), team: 'dusk' }]);
    const foe = rest[0] as EntityId;
    expect(sb.hero(me).weapon.ammo).toBe(30);
    sb.aimAt(me, foe, 'body');
    sb.fire(me);
    sb.step(TICK_RATE);
    sb.fire(me, false);
    const hits = gunHits(sb, me, foe);
    expect(hits[0]?.amount).toBeCloseTo(12, 1);
    expect(sb.hero(me).weapon.ammo).toBeGreaterThanOrEqual(23);
    expect(sb.hero(me).weapon.ammo).toBeLessThanOrEqual(25);
  });

  describe('Pink Pool', () => {
    it('heals allies inside 30 a second for 6 s, not enemies', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(10), team: 'dawn' },
        { hero: 'kingfisher', at: AHEAD(10.5), team: 'dusk' },
      ]);
      const [ally, foe] = rest as [EntityId, EntityId];
      hurt(sb, ally, foe, 300);
      hurt(sb, foe, ally, 300);
      sb.step(1);
      const foeHp = sb.health(foe).hp;
      sb.cast(me, 0, AHEAD(10));
      sb.step(TICK_RATE * 7);
      const heals = sb.eventsOf('heal.applied').filter((e) => e.target === ally && e.source === me);
      expect(heals.length).toBeGreaterThanOrEqual(5);
      expect(heals.length).toBeLessThanOrEqual(7);
      for (const h of heals) expect(h.amount).toBeCloseTo(30, 0);
      expect(sb.health(foe).hp).toBe(foeHp);
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(18 * TICK_RATE);
    });

    it('T3 (with T1, T2): 6.5 m, 8 s, +15% speed, and entering removes slows', async () => {
      const def = flamingoDef.abilities[0];
      expect(resolveAbility(def, 2).values).toMatchObject({ radius: 6.5, duration: 8 });
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(10), team: 'dawn' }], [3, 0, 0, 0]);
      const ally = rest[0] as EntityId;
      sb.apply([{ kind: 'applyStatus', status: SLOW, durationS: 5, magnitude: 0.4 }], ally, sb.cause(me, {}));
      const before = sb.ctx.stats.get(ally, 'moveSpeed');
      sb.cast(me, 0, AHEAD(10));
      sb.step(TICK_RATE);
      expect(sb.ctx.stats.get(ally, 'slow')).toBe(0);
      expect(sb.ctx.stats.get(ally, 'moveSpeed')).toBeGreaterThan(before * 1.1);
    });
  });

  describe('Poise', () => {
    it('gives an ally a 150 barrier and +40% status resist for 5 s', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(10), team: 'dawn' }]);
      const ally = rest[0] as EntityId;
      sb.cast(me, 1, AHEAD(10));
      sb.step(2);
      expect(sb.health(ally).barrier).toBeCloseTo(150, 0);
      expect(sb.ctx.stats.get(ally, 'statusResist')).toBeCloseTo(0.4, 2);
      sb.step(TICK_RATE * 5);
      expect(sb.ctx.stats.get(ally, 'statusResist')).toBe(0);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(16 * TICK_RATE);
    });

    it('targets you with no ally in sights; T3 (with T1, T2): 225 barrier, 12 s, 2 charges', async () => {
      const { sb, me } = await setup([], [0, 3, 0, 0]);
      expect(slot(sb, me, 1)?.charges).toBe(2);
      sb.cast(me, 1);
      sb.step(2);
      expect(sb.health(me).barrier).toBeCloseTo(225, 0);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(12 * TICK_RATE);
    });
  });

  describe('Flock Dance', () => {
    it('hits enemies within 8 m for 60 Song and knocks them back; allies get +20% speed for 3 s', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'kingfisher', at: AHEAD(4), team: 'dusk' },
        { hero: 'pelican', at: { x: 3, y: 0, z: 0 }, team: 'dawn' },
      ]);
      const [foe, ally] = rest as [EntityId, EntityId];
      const allySpeed = sb.ctx.stats.get(ally, 'moveSpeed');
      sb.cast(me, 2);
      sb.step(TICK_RATE / 2);
      const hits = sb.eventsOf('damage.applied').filter((e) => e.source === me && e.target === foe);
      expect(hits).toHaveLength(1);
      expect(hits[0]?.damageType).toBe('song');
      expect(hits[0]?.amount).toBeCloseTo(60, 0);
      expect(sb.hero(foe).pos.z).toBeGreaterThan(8);
      expect(sb.ctx.stats.get(ally, 'moveSpeed')).toBeCloseTo(allySpeed * 1.2, 2);
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(15 * TICK_RATE);
    });

    it('T3 (with T1, T2): 10 m, 12 s cooldown, enemies disarmed 1 s', async () => {
      const { sb, me, rest } = await setup([{ hero: 'kingfisher', at: AHEAD(9), team: 'dusk' }], [0, 0, 3, 0]);
      sb.cast(me, 2);
      sb.step(2);
      expect(sb.statuses(rest[0] as EntityId)).toContain('disarm');
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(12 * TICK_RATE);
    });
  });

  describe('Tide Turn', () => {
    it('makes an ally unstoppable for 6 s, heals 30% of max HP over 3 s, and +30% damage', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(10), team: 'dawn' }, { hero: 'kingfisher', at: AHEAD(30), team: 'dusk' }]);
      const [ally, foe] = rest as [EntityId, EntityId];
      hurt(sb, ally, foe, 400);
      sb.step(1);
      const hp = sb.health(ally).hp;
      const max = sb.ctx.stats.get(ally, 'maxHealth');
      sb.cast(me, 3, AHEAD(10));
      sb.step(TICK_RATE * 3 + 5);
      expect(sb.statuses(ally)).toContain('unstoppable');
      expect(sb.health(ally).hp - hp).toBeCloseTo(max * 0.3, 0);
      expect(sb.ctx.stats.get(ally, 'gunDamage')).toBeCloseTo(0.3, 3);
      sb.step(TICK_RATE * 4);
      expect(sb.statuses(ally)).not.toContain('unstoppable');
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(100 * TICK_RATE);
    });

    it('T2 (with T1): reaches allies within 6 m of the target; T3: 70 s cooldown; T1: 60 m', async () => {
      const def = flamingoDef.abilities[3];
      expect(resolveAbility(def, 1).range).toBe(60);
      expect(resolveAbility(def, 3).cooldownS).toBe(70);
      const { sb, me, rest } = await setup(
        [{ hero: 'pelican', at: AHEAD(30), team: 'dawn' }, { hero: 'kingfisher', at: { x: 4, y: 0, z: 30 }, team: 'dawn' }],
        [0, 0, 0, 2],
      );
      const near = rest[1] as EntityId;
      sb.cast(me, 3, AHEAD(30));
      sb.step(3);
      expect(sb.statuses(near)).toContain('unstoppable');
      expect(sb.ctx.stats.get(near, 'songDamage')).toBeCloseTo(0.3, 3);
    });
  });
});
