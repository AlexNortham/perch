/** Cassowary smoke tests (GDD §9.17): the gun, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import type { EntityId, HeroId, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { resolveAbility, validateKit } from '../../abilities/kit';
import { cassowaryDef } from '../../data/heroes/cassowary';
import { cassowary } from './index';

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
const AHEAD = (z: number): Vec3 => ({ x: 0, y: 0, z });

/** Cassowary (Dawn, at the origin facing +z) first, then the others; tiers bought for the Cassowary. */
async function setup(others: readonly { hero: HeroId; at: Vec3 }[] = [], tiers: readonly number[] = [0, 0, 0, 0]) {
  const sb = await createSandbox({ heroes: [{ hero: 'cassowary', at: ORIGIN, yaw: 0 }, ...others] });
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
/** Seconds each application of a status lasts, measured as it lands. Call before the cast. */
function durations(sb: Sandbox, who: EntityId, id: string): number[] {
  const out: number[] = [];
  sb.ctx.bus.on('status.applied', (e) => {
    if (e.target === who && e.status === id) out.push((e.expiresAt - sb.sim.tick) / TICK_RATE);
  });
  return out;
}

describe('Cassowary', () => {
  it('has a valid, implemented kit with the GDD body, stats and gun', () => {
    expect(validateKit(cassowary)).toEqual([]);
    expect(cassowary.implemented).toBe(true);
    expect(cassowaryDef.swatch).toBeDefined();
    expect(cassowaryDef.body).toMatchObject({ height: 2.4, radius: 0.48, head: { radius: 0.17, centre: { up: 2.25 } } });
    expect(cassowaryDef.stats).toMatchObject({ maxHealth: 740, moveSpeed: 7, weaponDamage: 20, magazine: 16 });
    expect(cassowaryDef.weapon).toMatchObject({ hitscan: true, spreadDeg: 1.2, fireRate: 3.5, reloadS: 2.4, falloff: { start: 14, end: 30 } });
    expect(cassowaryDef.growth).toContainEqual({ stat: 'maxHealth', op: 'add', value: 46 });
  });

  describe('Wattle Blaster (hitscan, 20 Talon, 16 rounds, 3.5 shots/s, 2.4 s reload)', () => {
    it('deals 20 per shot and 20 × 1.65 on the head', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(8) }]);
      const foe = rest[0] as EntityId;
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.step(1);
      sb.fire(me, false);
      sb.step(2);
      expect(hitsOn(sb, me, foe)[0]?.amount).toBeCloseTo(20, 1);
      sb.clearEvents();
      sb.step(30);
      sb.aimAt(me, foe, 'head');
      sb.fire(me);
      sb.step(1);
      sb.fire(me, false);
      sb.step(2);
      const head = hitsOn(sb, me, foe).filter((e) => e.beakShot);
      expect(head[0]?.amount).toBeCloseTo(20 * 1.65, 1);
    });

    it('fires 3.5 shots a second, holds 16 rounds and reloads in 2.4 s', async () => {
      const { sb, me } = await setup();
      expect(sb.hero(me).weapon.ammo).toBe(16);
      const fired: number[] = [];
      sb.ctx.bus.on('weapon.fired', () => fired.push(sb.sim.tick));
      let started = 0;
      let done = 0;
      sb.ctx.bus.on('weapon.reload', (e) => (e.done ? (done = sb.sim.tick) : (started = sb.sim.tick)));
      sb.fire(me);
      sb.stepUntil(() => fired.length >= 16, 600);
      sb.fire(me, false);
      sb.stepUntil(() => done > 0, 600);
      expect(fired).toHaveLength(16);
      expect(((fired[15] as number) - (fired[0] as number)) / 15).toBeCloseTo(TICK_RATE / 3.5, 0);
      expect((done - started) / TICK_RATE).toBeCloseTo(2.4, 1);
    });
  });

  describe('Rampage', () => {
    it('charges 20 m in 1 s unstoppable; the first hero hit takes 90 and goes up, and the charge stops there', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(10) },
        { hero: 'swan', at: AHEAD(16) },
      ]);
      const [first, second] = rest as [EntityId, EntityId];
      const unstoppable = durations(sb, me, 'unstoppable');
      sb.cast(me, 0, AHEAD(10));
      sb.step(2);
      expect(unstoppable[0]).toBeCloseTo(1, 1);
      sb.step(TICK_RATE * 1.2);
      const hit = hitsOn(sb, me, first, 'cassowary.rampage');
      expect(hit).toHaveLength(1);
      expect(hit[0]?.amount).toBeCloseTo(90, 1);
      expect(hit[0]?.damageType).toBe('song');
      expect(sb.hero(first).motor.knockedUp || sb.hero(first).pos.y > 0).toBe(true);
      expect(hitsOn(sb, me, second)).toHaveLength(0);
      expect(sb.hero(me).pos.z).toBeGreaterThan(8);
      expect(sb.hero(me).pos.z).toBeLessThan(12);
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(18 * TICK_RATE);
    });

    it('T1 adds 30 damage; T2 shortens the cooldown to 14 s', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(10) }], [2, 0, 0, 0]);
      sb.cast(me, 0, AHEAD(10));
      sb.step(TICK_RATE * 1.2);
      expect(hitsOn(sb, me, rest[0] as EntityId, 'cassowary.rampage')[0]?.amount).toBeCloseTo(120, 1);
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(14 * TICK_RATE);
    });

    it('does not stop for a fledgling, and a hero it never touches takes nothing', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(30) }]);
      sb.dummy({ kind: 'unit', type: 'scrapper', team: 'dusk', at: AHEAD(8), hp: 500 });
      sb.cast(me, 0, AHEAD(10));
      sb.step(TICK_RATE * 1.2);
      expect(sb.hero(me).pos.z).toBeGreaterThan(17);
      expect(hitsOn(sb, me, rest[0] as EntityId)).toHaveLength(0);
    });

    it('T3 hits every hero along the path and does not stop', async () => {
      const { sb, me, rest } = await setup(
        [
          { hero: 'pelican', at: AHEAD(8) },
          { hero: 'swan', at: AHEAD(14) },
        ],
        [3, 0, 0, 0],
      );
      sb.cast(me, 0, AHEAD(10));
      sb.step(TICK_RATE * 1.2);
      for (const foe of rest) expect(hitsOn(sb, me, foe, 'cassowary.rampage')).toHaveLength(1);
      expect(sb.hero(me).pos.z).toBeGreaterThan(17);
    });
  });

  describe('Dagger Kick', () => {
    it('hits a 4 m, 60 degree cone for 100, knocks back 5 m and shreds 15% Talon resist for 5 s', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(3) },
        { hero: 'swan', at: { x: 3, y: 0, z: 0.5 } }, // outside the cone
        { hero: 'owl', at: AHEAD(6) }, // too far
      ]);
      const [inside, aside, far] = rest as [EntityId, EntityId, EntityId];
      const shred = durations(sb, inside, 'talonShred');
      sb.cast(me, 1, AHEAD(3));
      sb.step(3);
      const hit = hitsOn(sb, me, inside, 'cassowary.daggerKick');
      expect(hit).toHaveLength(1);
      expect(hit[0]?.amount).toBeCloseTo(100, 1);
      expect(sb.ctx.stats.get(inside, 'talonShred')).toBeCloseTo(0.15, 3);
      expect(shred[0]).toBeCloseTo(5, 1);
      sb.step(TICK_RATE * 1.5);
      expect(sb.hero(inside).pos.z).toBeGreaterThan(7);
      expect(hitsOn(sb, me, aside)).toHaveLength(0);
      expect(hitsOn(sb, me, far)).toHaveLength(0);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(10 * TICK_RATE);
    });

    it('T3 (with T1, T2): 130 damage, 25% shred and 2 charges', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(3) }], [0, 3, 0, 0]);
      expect(slot(sb, me, 1)?.charges).toBe(2);
      sb.cast(me, 1, AHEAD(3));
      sb.step(3);
      expect(hitsOn(sb, me, rest[0] as EntityId, 'cassowary.daggerKick')[0]?.amount).toBeCloseTo(130, 1);
      expect(sb.ctx.stats.get(rest[0] as EntityId, 'talonShred')).toBeCloseTo(0.25, 3);
    });
  });

  describe('Bristle', () => {
    it('gives a 250 Talon shield for 5 s, and heroes within 15 m who hit you take 20% back as Song damage', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(8) },
        { hero: 'owl', at: AHEAD(30) },
      ]);
      const [near, far] = rest as [EntityId, EntityId];
      sb.cast(me, 2);
      sb.step(2);
      const hpBefore = sb.health(near).hp;
      sb.apply({ kind: 'damage', amount: 100, type: 'talon' }, me, sb.cause(near));
      sb.step(2);
      const back = hitsOn(sb, me, near, 'cassowary.bristle');
      expect(back).toHaveLength(1);
      expect(back[0]?.amount).toBeCloseTo(20, 1);
      expect(back[0]?.damageType).toBe('song');
      expect(sb.health(near).hp).toBeLessThan(hpBefore);
      // The shield took the hit (250 absorbs 100), so the Cassowary is untouched.
      expect(sb.health(me).hp).toBe(sb.ctx.stats.get(me, 'maxHealth'));
      sb.apply({ kind: 'damage', amount: 100, type: 'talon' }, me, sb.cause(far));
      sb.step(2);
      expect(hitsOn(sb, me, far, 'cassowary.bristle')).toHaveLength(0);
      sb.step(TICK_RATE * 5);
      sb.apply({ kind: 'damage', amount: 100, type: 'talon' }, me, sb.cause(near));
      sb.step(2);
      expect(hitsOn(sb, me, near, 'cassowary.bristle')).toHaveLength(1);
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(24 * TICK_RATE);
    });

    it('T3 (with T1, T2): a 350 Talon shield and a 350 Song shield, 18 s cooldown', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(8) }], [0, 0, 3, 0]);
      sb.cast(me, 2);
      sb.step(2);
      const foe = rest[0] as EntityId;
      sb.apply({ kind: 'damage', amount: 300, type: 'talon' }, me, sb.cause(foe));
      sb.apply({ kind: 'damage', amount: 300, type: 'song' }, me, sb.cause(foe));
      sb.step(2);
      expect(sb.health(me).hp).toBe(sb.ctx.stats.get(me, 'maxHealth'));
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(18 * TICK_RATE);
    });
  });

  describe('Boom Call', () => {
    it('is locked before level 6 and usable at 6', async () => {
      const sb = await createSandbox({ heroes: [{ hero: 'cassowary', at: ORIGIN, yaw: 0 }, { hero: 'pelican', at: AHEAD(8) }], options: { unlockAbilities: false } });
      const [me] = sb.heroes as [EntityId];
      sb.cast(me, 3);
      sb.step(5);
      expect(slot(sb, me, 3)?.unlocked).toBe(false);
      expect(slot(sb, me, 3)?.readyAt).toBe(0);
      sb.ctx.bus.emit({ type: 'hero.level', hero: me, level: 6, ap: 0, unlockSlot: 3 });
      sb.step();
      expect(slot(sb, me, 3)?.unlocked).toBe(true);
      sb.cast(me, 3);
      sb.step(5);
      expect(slot(sb, me, 3)?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('pulls enemies within 12 m 6 m in, deals 120, slows 50%, then you are unstoppable with +40% resists for 4 s', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(11) },
        { hero: 'owl', at: AHEAD(20) },
      ]);
      const [pulled, out] = rest as [EntityId, EntityId];
      const unstoppable = durations(sb, me, 'unstoppable');
      const slow = durations(sb, pulled, 'slow');
      sb.cast(me, 3);
      sb.step(2);
      expect(hitsOn(sb, me, pulled, 'cassowary.boomCall')[0]?.amount).toBeCloseTo(120, 1);
      expect(slow[0]).toBeCloseTo(2, 1);
      expect(sb.ctx.stats.get(pulled, 'slow')).toBeCloseTo(0.5, 3);
      expect(hitsOn(sb, me, out)).toHaveLength(0);
      expect(unstoppable[0]).toBeCloseTo(4, 1);
      expect(sb.ctx.stats.get(me, 'talonResist')).toBeCloseTo(0.4, 3);
      expect(sb.ctx.stats.get(me, 'songResist')).toBeCloseTo(0.4, 3);
      expect(sb.statuses(pulled)).not.toContain('stun');
      sb.step(TICK_RATE * 2);
      expect(sb.hero(pulled).pos.z).toBeLessThan(7);
      expect(sb.hero(pulled).pos.z).toBeGreaterThan(3);
      sb.step(TICK_RATE * 2.5);
      expect(sb.ctx.stats.get(me, 'talonResist')).toBe(0);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(110 * TICK_RATE);
    });

    it('T3 (with T1, T2): reaches 16 m, stuns pulled enemies 0.75 s, 80 s cooldown', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(15) }], [0, 0, 0, 3]);
      const stun = durations(sb, rest[0] as EntityId, 'stun');
      sb.cast(me, 3);
      sb.step(2);
      expect(hitsOn(sb, me, rest[0] as EntityId, 'cassowary.boomCall')).toHaveLength(1);
      expect(stun[0]).toBeCloseTo(0.75, 1);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(80 * TICK_RATE);
      expect(resolveAbility(cassowaryDef.abilities[3], 3).range).toBe(16);
    });
  });
});
