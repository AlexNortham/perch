/** Kiwi smoke tests (GDD §9.24): the gun, then each ability at its base and tiers, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import type { EntityId, HeroId, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { validateKit } from '../../abilities/kit';
import { kiwiDef } from '../../data/heroes/kiwi';
import { kiwi } from './index';

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
const AHEAD = (z: number, x = 0): Vec3 => ({ x, y: 0, z });

/** Kiwi (Dawn, at the origin facing +z) first, then the others (Dusk); tiers bought for the Kiwi. */
async function setup(others: readonly { hero: HeroId; at: Vec3 }[] = [], tiers: readonly number[] = [0, 0, 0, 0]) {
  const sb = await createSandbox({ heroes: [{ hero: 'kiwi', at: ORIGIN, yaw: 0 }, ...others] });
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
const has = (sb: Sandbox, id: EntityId, c: 'invisible' | 'intangible' | 'trueSight') => sb.ctx.stats.has(id, c);
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

describe('Kiwi', () => {
  it('has a valid, implemented kit with the GDD body, stats and gun', () => {
    expect(validateKit(kiwi)).toEqual([]);
    expect(kiwi.implemented).toBe(true);
    expect(kiwiDef.body).toMatchObject({ height: 1.2, radius: 0.4, head: { radius: 0.15, centre: { up: 1 } } });
    expect(kiwiDef.stats).toMatchObject({ maxHealth: 560, moveSpeed: 7.2, weaponDamage: 7, magazine: 5 });
    expect(kiwiDef.weapon).toMatchObject({ hitscan: true, pellets: 6, spreadDeg: 3.5, fireRate: 1.6, reloadS: 2, falloff: { start: 8, end: 18 } });
  });

  describe('Burrow Blunderbuss (hitscan shotgun, 6 × 7 Talon, 5 rounds, 1.6 shots/s, 2 s reload)', () => {
    it('lands up to 6 pellets of 7 each, so at most 42 in a shot', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(4) }]);
      const foe = rest[0] as EntityId;
      shoot(sb, me, foe);
      const pellets = sb.eventsOf('damage.applied').filter((e) => e.source === me && e.target === foe && e.via === 'weapon');
      expect(pellets.length).toBeGreaterThanOrEqual(3);
      expect(pellets.length).toBeLessThanOrEqual(6);
      for (const p of pellets.filter((e) => !e.beakShot)) expect(p.amount).toBeCloseTo(7, 1);
    });

    it('fires 1.6 shots a second, holds 5 rounds and reloads in 2 s', async () => {
      const { sb, me } = await setup();
      expect(sb.hero(me).weapon.ammo).toBe(5);
      const fired: number[] = [];
      sb.ctx.bus.on('weapon.fired', () => fired.push(sb.sim.tick));
      let started = 0;
      let done = 0;
      sb.ctx.bus.on('weapon.reload', (e) => (e.done ? (done = sb.sim.tick) : (started = sb.sim.tick)));
      sb.fire(me);
      sb.stepUntil(() => fired.length >= 5, 900);
      sb.fire(me, false);
      sb.stepUntil(() => done > 0, 600);
      expect(fired).toHaveLength(5);
      expect(((fired[4] as number) - (fired[0] as number)) / 4).toBeCloseTo(TICK_RATE / 1.6, 0);
      expect((done - started) / TICK_RATE).toBeCloseTo(2, 1);
    });
  });

  describe('Burrow', () => {
    it('goes underground (intangible, invisible, 9 m/s, no gun), and surfaces after 4 s with a knock-up and 80 damage', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(30, 0) }]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 0);
      // (the foe only checks that nothing can hurt the Kiwi while it digs)
      sb.step(2);
      expect(has(sb, me, 'intangible')).toBe(true);
      expect(has(sb, me, 'invisible')).toBe(true);
      expect(sb.hero(me).motor.mode).toBe('burrow');
      expect(sb.hero(me).motor.modeAllowsGun).toBe(false);
      sb.move(me, 1);
      sb.step(TICK_RATE);
      expect(sb.hero(me).pos.z).toBeGreaterThan(8);
      expect(sb.hero(me).pos.z).toBeLessThan(10);
      // Nothing can hurt it while it digs.
      sb.apply({ kind: 'damage', amount: 300, type: 'song' }, me, sb.cause(foe));
      sb.step(2);
      expect(sb.health(me).hp).toBe(sb.ctx.stats.get(me, 'maxHealth'));
      sb.move(me, 0);
      sb.step(TICK_RATE * 3.2);
      expect(sb.hero(me).motor.mode).toBeNull();
      expect(has(sb, me, 'intangible')).toBe(false);
      expect(has(sb, me, 'invisible')).toBe(false);
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(18 * TICK_RATE);
    });

    it('erupting hits enemies within 3 m: 80 Song damage and a knock-up; those further off are spared', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(2) },
        { hero: 'owl', at: AHEAD(6) },
      ]);
      const [near, far] = rest as [EntityId, EntityId];
      sb.cast(me, 0);
      sb.step(2);
      sb.cast(me, 0); // the second press surfaces it
      let peak = 0;
      for (let i = 0; i < TICK_RATE * 0.8; i++) {
        sb.step();
        peak = Math.max(peak, sb.hero(near).pos.y);
      }
      expect(sb.hero(me).motor.mode).toBeNull();
      const hit = hitsOn(sb, me, near, 'kiwi.burrow');
      expect(hit).toHaveLength(1);
      expect(hit[0]?.amount).toBeCloseTo(80, 1);
      expect(hit[0]?.damageType).toBe('song');
      expect(peak).toBeGreaterThan(0.8);
      expect(hitsOn(sb, me, far)).toHaveLength(0);
    });

    it('lasts 4 s by itself', async () => {
      const { sb, me } = await setup();
      sb.cast(me, 0);
      sb.step(TICK_RATE * 3.5);
      expect(sb.hero(me).motor.mode).toBe('burrow');
      sb.step(TICK_RATE);
      expect(sb.hero(me).motor.mode).toBeNull();
      expect(has(sb, me, 'intangible')).toBe(false);
    });

    it('T1 5 s, T2 14 s cooldown, T3 resurfacing heals 15% of max HP', async () => {
      const { sb, me } = await setup([], [3, 0, 0, 0]);
      sb.health(me).hp = 100;
      sb.cast(me, 0);
      sb.step(TICK_RATE * 4.5);
      expect(sb.hero(me).motor.mode).toBe('burrow');
      sb.step(TICK_RATE);
      expect(sb.hero(me).motor.mode).toBeNull();
      const max = sb.ctx.stats.get(me, 'maxHealth');
      expect(sb.health(me).hp).toBeGreaterThan(100 + max * 0.15 - 1);
      expect(sb.health(me).hp).toBeLessThan(100 + max * 0.15 + 12);
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(14 * TICK_RATE);
    });

    it('a base Burrow heals nothing when it surfaces', async () => {
      const { sb, me } = await setup();
      sb.health(me).hp = 100;
      sb.cast(me, 0);
      sb.step(TICK_RATE * 4.2);
      expect(sb.health(me).hp).toBeLessThan(115);
    });
  });

  describe('Probe', () => {
    it('stabs 3 m ahead: 90 Song damage and -15% Talon resist for 5 s', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(2.5) },
        { hero: 'owl', at: AHEAD(6) },
      ]);
      const [foe, far] = rest as [EntityId, EntityId];
      const shred = durations(sb, foe, 'talonShred');
      sb.cast(me, 1, foe);
      sb.step(3);
      const hit = hitsOn(sb, me, foe, 'kiwi.probe');
      expect(hit).toHaveLength(1);
      expect(hit[0]?.amount).toBeCloseTo(90, 1);
      expect(hit[0]?.damageType).toBe('song');
      expect(shred[0]).toBeCloseTo(5, 1);
      expect(sb.ctx.stats.get(foe, 'talonShred')).toBeCloseTo(0.15, 3);
      expect(hitsOn(sb, me, far)).toHaveLength(0);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(9 * TICK_RATE);
    });

    it('T1 +25 damage, T2 7 s cooldown, T3 roots 0.75 s', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(2.5) }], [0, 3, 0, 0]);
      const foe = rest[0] as EntityId;
      const root = durations(sb, foe, 'root');
      sb.cast(me, 1, foe);
      sb.step(3);
      expect(hitsOn(sb, me, foe, 'kiwi.probe')[0]?.amount).toBeCloseTo(115, 1);
      expect(root[0]).toBeCloseTo(0.75, 1);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(7 * TICK_RATE);
    });

    it('does not root at base', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(2.5) }]);
      const root = durations(sb, rest[0] as EntityId, 'root');
      sb.cast(me, 1, rest[0] as EntityId);
      sb.step(3);
      expect(root).toEqual([]);
    });
  });

  describe('Night Sense', () => {
    it('gives true sight within 20 m for 6 s and reveals enemy heroes below 50% HP within 50 m', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(30) },
        { hero: 'owl', at: AHEAD(30, 8) },
        { hero: 'vulture', at: AHEAD(30, -8) },
      ]);
      const [hurt, healthy, farHurt] = rest as [EntityId, EntityId, EntityId];
      sb.health(hurt).hp = sb.ctx.stats.get(hurt, 'maxHealth') * 0.4;
      sb.health(farHurt).hp = sb.ctx.stats.get(farHurt, 'maxHealth') * 0.9;
      sb.cast(me, 2);
      sb.step(TICK_RATE);
      expect(has(sb, me, 'trueSight')).toBe(true);
      expect(sb.ctx.stats.get(me, 'trueSightRadius')).toBe(20);
      expect(sb.ctx.stats.has(hurt, 'revealed')).toBe(true);
      expect(sb.ctx.stats.has(healthy, 'revealed')).toBe(false);
      expect(sb.ctx.stats.has(farHurt, 'revealed')).toBe(false);
      sb.step(TICK_RATE * 6);
      expect(has(sb, me, 'trueSight')).toBe(false);
      expect(sb.ctx.stats.has(hurt, 'revealed')).toBe(false);
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(22 * TICK_RATE);
    });

    it('does not reveal anyone beyond 50 m', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(30) }]);
      const foe = rest[0] as EntityId;
      sb.place(me, { x: 0, y: 0, z: -39 });
      sb.health(foe).hp = 100;
      sb.cast(me, 2);
      sb.step(TICK_RATE);
      expect(sb.ctx.stats.has(foe, 'revealed')).toBe(false); // 69 m away
    });

    it('T1 lasts 9 s', async () => {
      const { sb, me } = await setup([], [0, 0, 1, 0]);
      const sight = durations(sb, me, 'kiwi.nightSense');
      sb.cast(me, 2);
      sb.step(2);
      expect(sight[0]).toBeCloseTo(9, 1);
    });

    it('T2 true sight reaches 30 m, and the move speed is unchanged', async () => {
      const { sb, me } = await setup([], [0, 0, 2, 0]);
      sb.cast(me, 2);
      sb.step(2);
      expect(sb.ctx.stats.get(me, 'trueSightRadius')).toBe(30);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(kiwiDef.stats.moveSpeed as number, 3);
    });

    it('T3 +20% move speed for the duration', async () => {
      const { sb, me } = await setup([], [0, 0, 3, 0]);
      sb.cast(me, 2);
      sb.step(2);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo((kiwiDef.stats.moveSpeed as number) * 1.2, 3);
      sb.step(TICK_RATE * 10);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(kiwiDef.stats.moveSpeed as number, 3);
    });
  });

  describe('Ambush Pit', () => {
    it('tunnels 20 m in 1 s unseen and untouchable, then erupts: 220 damage in 6 m, a knock-up, then a 40% slow for 2 s', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(20, 3) },
        { hero: 'owl', at: AHEAD(20, 9) },
      ]);
      const [foe, safe] = rest as [EntityId, EntityId];
      const slow = durations(sb, foe, 'slow');
      sb.cast(me, 3, AHEAD(20));
      sb.step(TICK_RATE * 0.5);
      expect(has(sb, me, 'intangible')).toBe(true);
      expect(has(sb, me, 'invisible')).toBe(true);
      expect(sb.hero(me).pos.z).toBeGreaterThan(5);
      expect(sb.hero(me).pos.z).toBeLessThan(15);
      sb.step(TICK_RATE * 0.7);
      expect(sb.hero(me).pos.z).toBeCloseTo(20, 0);
      expect(has(sb, me, 'intangible')).toBe(false);
      expect(has(sb, me, 'invisible')).toBe(false);
      const hit = hitsOn(sb, me, foe, 'kiwi.ambushPit');
      expect(hit).toHaveLength(1);
      expect(hit[0]?.amount).toBeCloseTo(220, 1);
      expect(hitsOn(sb, me, safe)).toHaveLength(0);
      expect(slow).toEqual([]);
      sb.step(TICK_RATE * 1.2);
      expect(slow[0]).toBeCloseTo(2, 1);
      expect(sb.ctx.stats.get(foe, 'slow')).toBeCloseTo(0.4, 3);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(100 * TICK_RATE);
    });

    it('T1 30 m range, T2 +60 damage, T3 70 s cooldown', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(30) }], [0, 0, 0, 3]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 3, AHEAD(30));
      sb.step(TICK_RATE * 1.4);
      expect(sb.hero(me).pos.z).toBeCloseTo(30, 0);
      expect(hitsOn(sb, me, foe, 'kiwi.ambushPit')[0]?.amount).toBeCloseTo(280, 1);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(70 * TICK_RATE);
    });
  });
});
