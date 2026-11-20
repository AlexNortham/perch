/** Swan smoke tests (GDD §9.23): the gun, then each ability at its base and tiers, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import type { EntityId, HeroId, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { validateKit } from '../../abilities/kit';
import { swanDef } from '../../data/heroes/swan';
import { swan } from './index';

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
const AHEAD = (z: number, x = 0): Vec3 => ({ x, y: 0, z });

/** Swan (Dawn, at the origin facing +z) first, then the others (heroes 2+ on Dusk unless `team` says); tiers bought for the Swan. */
async function setup(others: readonly { hero: HeroId; at: Vec3; team?: 'dawn' | 'dusk' }[] = [], tiers: readonly number[] = [0, 0, 0, 0]) {
  const sb = await createSandbox({ heroes: [{ hero: 'swan', at: ORIGIN, yaw: 0 }, ...others] });
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
const ALLY = { hero: 'pelican', at: AHEAD(10), team: 'dawn' } as const;

describe('Swan', () => {
  it('has a valid, implemented kit with the GDD body, stats and gun', () => {
    expect(validateKit(swan)).toEqual([]);
    expect(swan.implemented).toBe(true);
    expect(swanDef.body).toMatchObject({ height: 2, radius: 0.42, head: { radius: 0.14, centre: { up: 1.88 } } });
    expect(swanDef.stats).toMatchObject({ maxHealth: 600, moveSpeed: 6.9, weaponDamage: 20, magazine: 14 });
    expect(swanDef.weapon).toMatchObject({ hitscan: true, spreadDeg: 0.5, fireRate: 3.6, reloadS: 2, falloff: { start: 20, end: 42 } });
  });

  describe('Lake Lance (hitscan, 20 Talon, 14 rounds, 3.6 shots/s, 2 s reload)', () => {
    it('deals 20 per shot and 20 × 1.65 on the head', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(10) }]);
      const foe = rest[0] as EntityId;
      const gun = () => hitsOn(sb, me, foe).filter((e) => e.via === 'weapon');
      shoot(sb, me, foe);
      expect(gun()[0]?.amount).toBeCloseTo(20, 1);
      sb.step(30);
      shoot(sb, me, foe, 'head');
      expect(gun().find((e) => e.beakShot)?.amount).toBeCloseTo(20 * 1.65, 1);
    });

    it('fires 3.6 shots a second, holds 14 rounds and reloads in 2 s', async () => {
      const { sb, me } = await setup();
      expect(sb.hero(me).weapon.ammo).toBe(14);
      const fired: number[] = [];
      sb.ctx.bus.on('weapon.fired', () => fired.push(sb.sim.tick));
      let started = 0;
      let done = 0;
      sb.ctx.bus.on('weapon.reload', (e) => (e.done ? (done = sb.sim.tick) : (started = sb.sim.tick)));
      sb.fire(me);
      sb.stepUntil(() => fired.length >= 14, 900);
      sb.fire(me, false);
      sb.stepUntil(() => done > 0, 600);
      expect(fired).toHaveLength(14);
      expect(((fired[13] as number) - (fired[0] as number)) / 13).toBeCloseTo(TICK_RATE / 3.6, 0);
      expect((done - started) / TICK_RATE).toBeCloseTo(2, 1);
    });
  });

  describe('Grace Link', () => {
    it('heals you and the ally 20 per second for 8 s, gives the ally +10% resists, and breaks beyond 35 m', async () => {
      const { sb, me, rest } = await setup([ALLY]);
      const ally = rest[0] as EntityId;
      sb.health(me).hp -= 200;
      sb.health(ally).hp -= 200;
      const [m0, a0] = [sb.health(me).hp, sb.health(ally).hp];
      let ended = false;
      sb.ctx.bus.on('tether', (e) => e.stage === 'end' && (ended = true));
      sb.cast(me, 0, ally);
      sb.step(TICK_RATE * 2.2);
      const regen = 2 * 2; // base regeneration, 2 HP/s
      expect(sb.health(me).hp - m0).toBeGreaterThan(30);
      expect(sb.health(me).hp - m0).toBeLessThan(40 + regen + 4);
      expect(sb.health(ally).hp - a0).toBeGreaterThan(30);
      expect(sb.health(ally).hp - a0).toBeLessThan(40 + regen + 4);
      expect(sb.ctx.stats.get(ally, 'talonResist')).toBeCloseTo(0.1, 3);
      expect(sb.ctx.stats.get(ally, 'songResist')).toBeCloseTo(0.1, 3);
      expect(sb.ctx.stats.get(me, 'talonResist')).toBe(0);
      expect(ended).toBe(false);
      sb.place(ally, AHEAD(36));
      sb.step(TICK_RATE);
      expect(ended).toBe(true);
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(18 * TICK_RATE);
    });

    it('lasts 8 s, and an enemy cannot be linked', async () => {
      const { sb, me, rest } = await setup([ALLY, { hero: 'owl', at: AHEAD(12, 6) }]);
      const events: string[] = [];
      let ticks = 0;
      sb.ctx.bus.on('tether', (e) => events.push(e.stage));
      sb.cast(me, 0, rest[1] as EntityId);
      sb.step(3);
      expect(events).toEqual([]);
      sb.cast(me, 0, rest[0] as EntityId);
      sb.step(1);
      expect(events).toEqual(['start']);
      ticks = sb.stepUntil(() => events.includes('end'), TICK_RATE * 10) ?? -1;
      expect(ticks / TICK_RATE).toBeCloseTo(8, 0);
    });

    it('T3 links a second ally (two charges)', async () => {
      const { sb, me, rest } = await setup(
        [ALLY, { hero: 'owl', at: AHEAD(8, 3), team: 'dawn' }],
        [3, 0, 0, 0],
      );
      const [a, b] = rest as [EntityId, EntityId];
      const stages: string[] = [];
      sb.ctx.bus.on('tether', (e) => stages.push(`${e.target}:${e.stage}`));
      sb.cast(me, 0, a);
      sb.step(TICK_RATE);
      sb.cast(me, 0, b);
      sb.step(1);
      expect(stages).toEqual([`${a}:start`, `${b}:start`]);
      expect(slot(sb, me, 0)?.charges).toBe(0);
      sb.health(b).hp -= 300;
      const before = sb.health(b).hp;
      sb.step(TICK_RATE * 2);
      expect(sb.health(b).hp - before).toBeGreaterThan(30);
    });

    it('T1 lasts 12 s', async () => {
      const { sb, me, rest } = await setup([ALLY], [1, 0, 0, 0]);
      let ended = false;
      sb.ctx.bus.on('tether', (e) => e.stage === 'end' && (ended = true));
      sb.cast(me, 0, rest[0] as EntityId);
      sb.step(TICK_RATE * 11.5);
      expect(ended).toBe(false);
      sb.step(TICK_RATE);
      expect(ended).toBe(true);
    });

    it('T2 raises the heal to 30 + 0.2 x SP per second', async () => {
      const base = await setup([ALLY]);
      const tier = await setup([ALLY], [2, 0, 0, 0]);
      const gain = async (c: typeof base) => {
        const ally = c.rest[0] as EntityId;
        c.sb.health(ally).hp -= 300;
        const before = c.sb.health(ally).hp;
        c.sb.cast(c.me, 0, ally);
        c.sb.step(TICK_RATE * 2.2);
        return c.sb.health(ally).hp - before;
      };
      const [lo, hi] = [await gain(base), await gain(tier)];
      expect(hi - lo).toBeGreaterThan(17);
      expect(hi - lo).toBeLessThan(23);
    });
  });

  describe('Hiss', () => {
    it('hits enemies in the 8 m, 60 degree cone: 50 Song damage, 6 m knockback, 30% slow for 2 s', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(5) },
        { hero: 'owl', at: AHEAD(5, 6) },
        { hero: 'vulture', at: AHEAD(12) },
      ]);
      const [inCone, wide, far] = rest as [EntityId, EntityId, EntityId];
      const slow = durations(sb, inCone, 'slow');
      sb.cast(me, 1, AHEAD(5));
      sb.step(TICK_RATE * 1.2);
      const hit = hitsOn(sb, me, inCone, 'swan.hiss');
      expect(hit).toHaveLength(1);
      expect(hit[0]?.amount).toBeCloseTo(50, 1);
      expect(hit[0]?.damageType).toBe('song');
      expect(sb.hero(inCone).pos.z).toBeGreaterThan(9.5);
      expect(slow[0]).toBeCloseTo(2, 1);
      expect(hitsOn(sb, me, wide)).toHaveLength(0);
      expect(hitsOn(sb, me, far)).toHaveLength(0);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(12 * TICK_RATE);
    });

    it('T1 +25 damage; T2 9 s cooldown; T3 also disarms 1 s', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(5) }], [0, 3, 0, 0]);
      const foe = rest[0] as EntityId;
      const disarm = durations(sb, foe, 'disarm');
      sb.cast(me, 1, AHEAD(5));
      sb.step(3);
      expect(hitsOn(sb, me, foe, 'swan.hiss')[0]?.amount).toBeCloseTo(75, 1);
      expect(disarm[0]).toBeCloseTo(1, 1);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(9 * TICK_RATE);
    });

    it('base Hiss does not disarm', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(5) }]);
      const disarm = durations(sb, rest[0] as EntityId, 'disarm');
      sb.cast(me, 1, AHEAD(5));
      sb.step(3);
      expect(disarm).toEqual([]);
    });
  });

  describe('Lake Glide', () => {
    it('gives you +40% speed for 3 s and allies within 6 m +20%, and removes slows', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(4), team: 'dawn' },
        { hero: 'owl', at: AHEAD(12), team: 'dawn' },
      ]);
      const [near, far] = rest as [EntityId, EntityId];
      const slow = sb.cause(null, { team: 'dusk' });
      const slowEffect = { kind: 'applyStatus', status: { id: 'slow', name: 'Slowed', negative: true, stacking: 'independent', maxStacks: 1, durationS: 2, modifiers: { stats: [{ stat: 'slow', op: 'max', value: 1 }] } }, durationS: 5, magnitude: 0.5 } as const;
      sb.apply(slowEffect, me, slow);
      sb.apply(slowEffect, near, slow);
      expect(sb.ctx.stats.get(me, 'slow')).toBeCloseTo(0.5, 3);
      sb.cast(me, 2);
      sb.step(TICK_RATE * 0.8);
      const base = swanDef.stats.moveSpeed as number;
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(base * 1.4, 3);
      expect(sb.ctx.stats.get(me, 'slow')).toBe(0);
      expect(sb.ctx.stats.get(near, 'slow')).toBe(0);
      expect(sb.ctx.stats.get(near, 'moveSpeed') / (sb.hero(near).stats.base.moveSpeed as number)).toBeCloseTo(1.2, 2);
      expect(sb.ctx.stats.get(far, 'moveSpeed') / (sb.hero(far).stats.base.moveSpeed as number)).toBeCloseTo(1, 2);
      sb.step(TICK_RATE * 3);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(base, 3);
      expect(sb.ctx.stats.get(near, 'moveSpeed') / (sb.hero(near).stats.base.moveSpeed as number)).toBeCloseTo(1, 2);
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(16 * TICK_RATE);
    });

    it('T1 4 s, T2 12 s cooldown, T3 allies get the full +40%', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(4), team: 'dawn' }], [0, 0, 3, 0]);
      const ally = rest[0] as EntityId;
      sb.cast(me, 2);
      sb.step(TICK_RATE * 0.8);
      expect(sb.ctx.stats.get(ally, 'moveSpeed') / (sb.hero(ally).stats.base.moveSpeed as number)).toBeCloseTo(1.4, 2);
      sb.step(TICK_RATE * 2.6);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeGreaterThan((swanDef.stats.moveSpeed as number) * 1.3);
      sb.step(TICK_RATE * 1.5);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(swanDef.stats.moveSpeed as number, 3);
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(12 * TICK_RATE);
    });
  });

  describe('Swan Song', () => {
    it('makes allies within 15 m undying for 4 s, then heals each 25% of max HP', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(10), team: 'dawn' },
        { hero: 'owl', at: AHEAD(25), team: 'dawn' },
        { hero: 'vulture', at: AHEAD(8), team: 'dusk' },
      ]);
      const [near, far] = rest as [EntityId, EntityId, EntityId];
      const foe = sb.cause(rest[2] as EntityId);
      sb.health(near).hp = 100;
      sb.cast(me, 3);
      sb.step(2);
      expect(sb.ctx.stats.has(me, 'undying')).toBe(true);
      expect(sb.ctx.stats.has(near, 'undying')).toBe(true);
      expect(sb.ctx.stats.has(far, 'undying')).toBe(false);
      sb.apply({ kind: 'damage', amount: 5000, type: 'talon' }, near, foe);
      sb.step(2);
      expect(sb.health(near).dead).toBe(false);
      expect(sb.health(near).hp).toBeLessThan(5);
      sb.step(TICK_RATE * 4);
      expect(sb.ctx.stats.has(near, 'undying')).toBe(false);
      const max = sb.ctx.stats.get(near, 'maxHealth');
      expect(sb.health(near).hp).toBeGreaterThan(max * 0.25 - 1);
      expect(sb.health(near).hp).toBeLessThan(max * 0.25 + 10);
      expect(sb.health(me).hp).toBeGreaterThanOrEqual(sb.ctx.stats.get(me, 'maxHealth') - 1);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(140 * TICK_RATE);
    });

    it('T1 20 m radius; T2 5 s; T3 100 s cooldown', async () => {
      const { sb, me, rest } = await setup([{ hero: 'owl', at: AHEAD(18), team: 'dawn' }], [0, 0, 0, 3]);
      const ally = rest[0] as EntityId;
      const undying = durations(sb, ally, 'swan.song');
      sb.cast(me, 3);
      sb.step(2);
      expect(undying[0]).toBeCloseTo(5, 1);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(100 * TICK_RATE);
    });
  });
});
