/** Woodpecker smoke tests (GDD §9.19): the gun, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import { Button } from '../../core/contracts';
import type { EntityId, HeroId, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { COMBAT, STUN } from '../../data/combat';
import { resolveAbility, validateKit } from '../../abilities/kit';
import { woodpeckerDef } from '../../data/heroes/woodpecker';
import { woodpecker } from './index';

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
const AHEAD = (z: number, x = 0): Vec3 => ({ x, y: 0, z });

/** Woodpecker (Dawn, at the origin facing +z) first, then the others; tiers bought for the Woodpecker. */
async function setup(others: readonly { hero: HeroId; at: Vec3 }[] = [], tiers: readonly number[] = [0, 0, 0, 0]) {
  const sb = await createSandbox({ heroes: [{ hero: 'woodpecker', at: ORIGIN, yaw: 0 }, ...others] });
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
const gunHits = (sb: Sandbox, me: EntityId, foe: EntityId) => hitsOn(sb, me, foe).filter((e) => e.via === 'weapon');
const slot = (sb: Sandbox, me: EntityId, i: number) => sb.hero(me).abilities.slots[i];
function durations(sb: Sandbox, who: EntityId, id: string): number[] {
  const out: number[] = [];
  sb.ctx.bus.on('status.applied', (e) => {
    if (e.target === who && e.status === id) out.push((e.expiresAt - sb.sim.tick) / TICK_RATE);
  });
  return out;
}

describe('Woodpecker', () => {
  it('has a valid, implemented kit with the GDD body, stats and gun', () => {
    expect(validateKit(woodpecker)).toEqual([]);
    expect(woodpecker.implemented).toBe(true);
    expect(woodpeckerDef.swatch).toBeDefined();
    expect(woodpeckerDef.body).toMatchObject({ height: 1.75, radius: 0.3, head: { radius: 0.16, centre: { up: 1.6 } } });
    expect(woodpeckerDef.stats).toMatchObject({ maxHealth: 600, moveSpeed: 6.9, weaponDamage: 7, magazine: 60 });
    expect(woodpeckerDef.weapon).toMatchObject({
      hitscan: true,
      spreadDeg: 1.4,
      fireRate: 14,
      spinUp: { fromRate: 6, seconds: 1.5 },
      reloadS: 3,
      falloff: { start: 16, end: 36 },
    });
    expect(woodpeckerDef.growth).toContainEqual({ stat: 'weaponDamage', op: 'pct', value: 0.04 });
  });

  describe('Drum Drill (hitscan, 7 Talon, 60 rounds, spins up 6 to 14 shots/s over 1.5 s, 3 s reload)', () => {
    it('deals 7 per shot and 7 × 1.65 on the head', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(8) }]);
      const foe = rest[0] as EntityId;
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.step(1);
      sb.fire(me, false);
      sb.step(2);
      expect(gunHits(sb, me, foe)[0]?.amount).toBeCloseTo(7, 1);
      sb.clearEvents();
      sb.step(60);
      sb.aimAt(me, foe, 'head');
      sb.fire(me);
      sb.step(1);
      sb.fire(me, false);
      sb.step(2);
      expect(gunHits(sb, me, foe).find((e) => e.beakShot)?.amount).toBeCloseTo(7 * 1.65, 1);
    });

    it('starts at 6 shots a second, reaches 14 after 1.5 s of fire and starts over after a pause', async () => {
      const { sb, me } = await setup();
      const fired: number[] = [];
      sb.ctx.bus.on('weapon.fired', () => fired.push(sb.sim.tick));
      sb.fire(me);
      sb.step(TICK_RATE * 3);
      sb.fire(me, false);
      const gaps = fired.slice(1).map((t, i) => t - (fired[i] as number));
      expect(gaps[0]).toBeGreaterThanOrEqual(9);
      expect(gaps[0]).toBeLessThanOrEqual(11);
      expect(gaps[gaps.length - 1]).toBeLessThanOrEqual(5);
      expect(gaps[gaps.length - 1]).toBeGreaterThanOrEqual(4);
      // Released and held again: slow once more.
      sb.step(TICK_RATE);
      fired.length = 0;
      sb.fire(me);
      sb.step(TICK_RATE);
      expect(fired.length).toBeLessThan(11); // 6/s rising to 11/s in the first second, against 14/s at full spin
    });

    it('holds 60 rounds and reloads in 3 s', async () => {
      const { sb, me } = await setup();
      expect(sb.hero(me).weapon.ammo).toBe(60);
      let started = 0;
      let done = 0;
      sb.ctx.bus.on('weapon.reload', (e) => (e.done ? (done = sb.sim.tick) : (started = sb.sim.tick)));
      sb.fire(me);
      sb.stepUntil(() => started > 0, 1200);
      sb.fire(me, false);
      sb.stepUntil(() => done > 0, 600);
      expect((done - started) / TICK_RATE).toBeCloseTo(3, 1);
      expect(sb.hero(me).weapon.ammo).toBe(60);
    });
  });

  describe('Drumroll', () => {
    it('gives +20% fire rate for 6 s', async () => {
      const { sb, me } = await setup();
      const buff = durations(sb, me, COMBAT.fullSpinStatus);
      sb.cast(me, 0);
      sb.step(2);
      expect(buff[0]).toBeCloseTo(6, 1);
      expect(sb.ctx.stats.get(me, 'fireRate')).toBeCloseTo(0.2, 3);
      sb.step(TICK_RATE * 6.2);
      expect(sb.ctx.stats.get(me, 'fireRate')).toBe(0);
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(18 * TICK_RATE);
    });

    it('reaches full spin at once: the first half second fires at 14/s × 1.2, not up from 6/s (GDD §9.19)', async () => {
      const { sb, me } = await setup();
      sb.cast(me, 0);
      sb.step(2);
      sb.fire(me);
      sb.step(TICK_RATE / 2);
      const shots = sb.eventsOf('weapon.fired').filter((e) => e.shooter === me).length;
      expect(Math.abs(shots - 14 * 1.2 * 0.5)).toBeLessThanOrEqual(1);
    });

    it('T2 (with T1): 8 s and +30% fire rate', async () => {
      const { sb, me } = await setup([], [2, 0, 0, 0]);
      const buff = durations(sb, me, COMBAT.fullSpinStatus);
      sb.cast(me, 0);
      sb.step(2);
      expect(buff[0]).toBeCloseTo(8, 1);
      expect(sb.ctx.stats.get(me, 'fireRate')).toBeCloseTo(0.3, 3);
    });

    it('T3: each gun hit on a hero shreds 3% Talon resist, up to 5 stacks, and fledglings do not', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(8) }], [3, 0, 0, 0]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 0);
      sb.step(2);
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.stepUntil(() => gunHits(sb, me, foe).length >= 2, 120);
      sb.fire(me, false);
      sb.step(2);
      const stacks = gunHits(sb, me, foe).length;
      expect(sb.ctx.stats.get(foe, 'talonShred')).toBeCloseTo(0.03 * Math.min(5, stacks), 3);
      sb.fire(me);
      sb.stepUntil(() => gunHits(sb, me, foe).length >= 9, 240);
      sb.fire(me, false);
      sb.step(2);
      expect(sb.ctx.stats.get(foe, 'talonShred')).toBeCloseTo(0.15, 3);
      const dummy = sb.dummy({ kind: 'unit', type: 'scrapper', team: 'dusk', at: AHEAD(8, 3), hp: 500 });
      sb.aimAt(me, dummy, 'body');
      sb.fire(me);
      sb.step(10);
      sb.fire(me, false);
      expect(sb.statuses(dummy)).not.toContain('woodpecker.drillShred');
    });
  });

  describe('Bore Hole', () => {
    it('hits the first enemy hero for 60 and shreds 15% Talon resist for 6 s; 25 m reach', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(10) },
        { hero: 'swan', at: AHEAD(20) },
        { hero: 'owl', at: AHEAD(35, 6) },
      ]);
      const [first, behind, far] = rest as [EntityId, EntityId, EntityId];
      const shred = durations(sb, first, 'talonShred');
      sb.cast(me, 1, first);
      sb.step(TICK_RATE);
      expect(hitsOn(sb, me, first, 'woodpecker.boreHole')[0]?.amount).toBeCloseTo(60, 1);
      expect(hitsOn(sb, me, first, 'woodpecker.boreHole')[0]?.damageType).toBe('song');
      expect(sb.ctx.stats.get(first, 'talonShred')).toBeCloseTo(0.15, 3);
      expect(shred[0]).toBeCloseTo(6, 1);
      expect(hitsOn(sb, me, behind)).toHaveLength(0);
      expect(hitsOn(sb, me, far)).toHaveLength(0);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(12 * TICK_RATE);
    });

    it('does not reach 30 m', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(30) }]);
      sb.cast(me, 1, rest[0] as EntityId);
      sb.step(TICK_RATE);
      expect(hitsOn(sb, me, rest[0] as EntityId)).toHaveLength(0);
    });

    it('T3 (with T1, T2): 20% shred, 9 s cooldown, 2 charges', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(10) }], [0, 3, 0, 0]);
      expect(slot(sb, me, 1)?.charges).toBe(2);
      sb.cast(me, 1, rest[0] as EntityId);
      sb.step(TICK_RATE);
      expect(sb.ctx.stats.get(rest[0] as EntityId, 'talonShred')).toBeCloseTo(0.2, 3);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(9 * TICK_RATE);
    });
  });

  describe('Tree Cling', () => {
    it('dashes to a point within 12 m and clings, shooting with +15% gun damage, for up to 6 s', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(20) }]);
      sb.cast(me, 2, AHEAD(8));
      sb.step(TICK_RATE * 0.6);
      expect(sb.hero(me).motor.mode).toBe('cling');
      expect(sb.hero(me).pos.z).toBeCloseTo(8, 0);
      expect(sb.ctx.stats.get(me, 'gunDamage')).toBeCloseTo(0.15, 3);
      // It can shoot: 7 × 1.15.
      const foe = rest[0] as EntityId;
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.step(1);
      sb.fire(me, false);
      sb.step(2);
      expect(gunHits(sb, me, foe)[0]?.amount).toBeCloseTo(7 * 1.15, 1);
      const z = sb.hero(me).pos.z;
      sb.step(TICK_RATE * 5.8);
      expect(sb.hero(me).motor.mode).toBeNull();
      expect(sb.ctx.stats.get(me, 'gunDamage')).toBe(0);
      expect(z).toBeCloseTo(8, 0);
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(14 * TICK_RATE);
    });

    it('Jump ends it and takes the gun bonus with it', async () => {
      const { sb, me } = await setup();
      sb.cast(me, 2, AHEAD(8));
      sb.step(TICK_RATE * 0.6);
      expect(sb.hero(me).motor.mode).toBe('cling');
      sb.step(TICK_RATE);
      expect(sb.hero(me).motor.mode).toBe('cling');
      sb.press(me, Button.Jump);
      sb.step(3);
      expect(sb.hero(me).motor.mode).toBeNull();
      expect(sb.ctx.stats.get(me, 'gunDamage')).toBe(0);
    });

    it('a stun ends it', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(20) }]);
      sb.cast(me, 2, AHEAD(8));
      sb.step(TICK_RATE * 0.6);
      sb.apply({ kind: 'applyStatus', status: STUN, durationS: 1 }, me, sb.cause(rest[0] as EntityId));
      sb.step(3);
      expect(sb.hero(me).motor.mode).toBeNull();
      expect(sb.ctx.stats.get(me, 'gunDamage')).toBe(0);
    });

    it('T3 (with T1, T2): 18 m reach, 10 s cooldown, and heals 3% of max HP a second while clinging', async () => {
      const { sb, me } = await setup([], [0, 0, 3, 0]);
      const max = sb.ctx.stats.get(me, 'maxHealth');
      sb.health(me).hp = max - 300;
      sb.cast(me, 2, AHEAD(16));
      sb.step(TICK_RATE * 0.6);
      expect(sb.hero(me).motor.mode).toBe('cling');
      expect(sb.hero(me).pos.z).toBeCloseTo(16, 0);
      const before = sb.health(me).hp;
      sb.step(TICK_RATE * 2);
      expect(sb.health(me).hp - before).toBeCloseTo(max * 0.03 * 2, 0);
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(10 * TICK_RATE);
      expect(resolveAbility(woodpeckerDef.abilities[2], 3).range).toBe(18);
    });

    it('does not heal without T3', async () => {
      const { sb, me } = await setup();
      const max = sb.ctx.stats.get(me, 'maxHealth');
      sb.health(me).hp = max - 300;
      sb.cast(me, 2, AHEAD(8));
      sb.step(TICK_RATE * 2.5);
      expect(sb.health(me).hp).toBe(max - 300);
    });
  });

  describe('Hammerhead', () => {
    it('is locked before level 6 and usable at 6', async () => {
      const sb = await createSandbox({ heroes: [{ hero: 'woodpecker', at: ORIGIN, yaw: 0 }, { hero: 'pelican', at: AHEAD(8) }], options: { unlockAbilities: false } });
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

    /** Fire at the foe until it has taken `n` more gun hits. */
    function shoot(sb: Sandbox, me: EntityId, foe: EntityId, n: number): void {
      const target = gunHits(sb, me, foe).length + n;
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.stepUntil(() => gunHits(sb, me, foe).length >= target, 600);
      sb.fire(me, false);
      sb.step(2);
    }

    it('gives +25% fire rate for 6 s, and every 10th gun hit on a hero detonates: 150 Song damage and a 0.5 s stun', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(8) }]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 3);
      sb.step(2);
      expect(sb.ctx.stats.get(me, 'fireRate')).toBeCloseTo(0.25, 3);
      const stun = durations(sb, foe, 'stun');
      shoot(sb, me, foe, 9);
      expect(hitsOn(sb, me, foe, 'woodpecker.hammerhead')).toHaveLength(0);
      shoot(sb, me, foe, 1);
      const blasts = hitsOn(sb, me, foe, 'woodpecker.hammerhead');
      expect(blasts).toHaveLength(1);
      expect(blasts[0]?.amount).toBeCloseTo(150, 1);
      expect(blasts[0]?.damageType).toBe('song');
      expect(stun[0]).toBeCloseTo(0.5, 1);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(90 * TICK_RATE);
    });

    it('counts hits on each hero separately, and stops after its duration', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(8) },
        { hero: 'swan', at: AHEAD(8, 6) },
      ]);
      const [a, b] = rest as [EntityId, EntityId];
      sb.cast(me, 3);
      sb.step(2);
      shoot(sb, me, a, 6);
      shoot(sb, me, b, 6);
      expect(hitsOn(sb, me, a, 'woodpecker.hammerhead')).toHaveLength(0);
      expect(hitsOn(sb, me, b, 'woodpecker.hammerhead')).toHaveLength(0);
      sb.step(TICK_RATE * 6.5);
      shoot(sb, me, a, 6);
      expect(hitsOn(sb, me, a, 'woodpecker.hammerhead')).toHaveLength(0);
    });

    it('T2 (with T1) detonates every 8 hits and lasts 9 s', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(8) }], [0, 0, 0, 2]);
      const foe = rest[0] as EntityId;
      const buff = durations(sb, me, 'woodpecker.hammerhead');
      sb.cast(me, 3);
      sb.step(2);
      expect(buff[0]).toBeCloseTo(9, 1);
      shoot(sb, me, foe, 7);
      expect(hitsOn(sb, me, foe, 'woodpecker.hammerhead')).toHaveLength(0);
      shoot(sb, me, foe, 1);
      expect(hitsOn(sb, me, foe, 'woodpecker.hammerhead')).toHaveLength(1);
    });

    it('T3 (with T1, T2): the detonation also hits enemies within 4 m of the target, and not beyond', async () => {
      const { sb, me, rest } = await setup(
        [
          { hero: 'pelican', at: AHEAD(8) },
          { hero: 'swan', at: AHEAD(8, 3) },
          { hero: 'owl', at: AHEAD(8, 7) },
        ],
        [0, 0, 0, 3],
      );
      const [foe, near, far] = rest as [EntityId, EntityId, EntityId];
      sb.cast(me, 3);
      sb.step(2);
      shoot(sb, me, foe, 8);
      expect(hitsOn(sb, me, foe, 'woodpecker.hammerhead')).toHaveLength(1);
      expect(hitsOn(sb, me, near, 'woodpecker.hammerhead')).toHaveLength(1);
      expect(hitsOn(sb, me, near, 'woodpecker.hammerhead')[0]?.amount).toBeCloseTo(150, 1);
      expect(hitsOn(sb, me, far)).toHaveLength(0);
    });
  });
});
