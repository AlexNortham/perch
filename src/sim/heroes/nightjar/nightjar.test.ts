/** Nightjar smoke tests (GDD §9.20): the gun, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import type { EntityId, HeroId, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { resolveAbility, validateKit } from '../../abilities/kit';
import { nightjarDef } from '../../data/heroes/nightjar';
import { nightjar } from './index';

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
const AHEAD = (z: number, x = 0): Vec3 => ({ x, y: 0, z });

/** Nightjar (Dawn, at the origin facing +z) first, then the others; tiers bought for the Nightjar. */
async function setup(others: readonly { hero: HeroId; at: Vec3 }[] = [], tiers: readonly number[] = [0, 0, 0, 0]) {
  const sb = await createSandbox({ heroes: [{ hero: 'nightjar', at: ORIGIN, yaw: 0 }, ...others] });
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
const invisible = (sb: Sandbox, me: EntityId) => sb.hero(me).stats.conditions.has('invisible');
function durations(sb: Sandbox, who: EntityId, id: string): number[] {
  const out: number[] = [];
  sb.ctx.bus.on('status.applied', (e) => {
    if (e.target === who && e.status === id) out.push((e.expiresAt - sb.sim.tick) / TICK_RATE);
  });
  return out;
}
/** One trigger pull: a single shot at the foe's body. */
function shoot(sb: Sandbox, me: EntityId, foe: EntityId): void {
  sb.aimAt(me, foe, 'body');
  sb.fire(me);
  sb.step(1);
  sb.fire(me, false);
  sb.step(2);
}

describe('Nightjar', () => {
  it('has a valid, implemented kit with the GDD body, stats and gun', () => {
    expect(validateKit(nightjar)).toEqual([]);
    expect(nightjar.implemented).toBe(true);
    expect(nightjarDef.swatch).toBeDefined();
    expect(nightjarDef.body).toMatchObject({ height: 1.55, radius: 0.32, head: { radius: 0.2, centre: { up: 1.35 } } });
    expect(nightjarDef.stats).toMatchObject({ maxHealth: 520, moveSpeed: 7.2, weaponDamage: 26, magazine: 10 });
    expect(nightjarDef.weapon).toMatchObject({ hitscan: true, spreadDeg: 0.5, fireRate: 3.2, reloadS: 1.8, falloff: { start: 18, end: 38 } });
  });

  describe('Moth Pistol (hitscan, 26 Talon, 10 rounds, 3.2 shots/s, 1.8 s reload)', () => {
    it('deals 26 per shot and 26 × 1.65 on the head', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(10) }]);
      const foe = rest[0] as EntityId;
      shoot(sb, me, foe);
      expect(gunHits(sb, me, foe)[0]?.amount).toBeCloseTo(26, 1);
      sb.clearEvents();
      sb.step(30);
      sb.aimAt(me, foe, 'head');
      sb.fire(me);
      sb.step(1);
      sb.fire(me, false);
      sb.step(2);
      expect(gunHits(sb, me, foe).find((e) => e.beakShot)?.amount).toBeCloseTo(26 * 1.65, 1);
    });

    it('fires 3.2 shots a second, holds 10 rounds and reloads in 1.8 s', async () => {
      const { sb, me } = await setup();
      expect(sb.hero(me).weapon.ammo).toBe(10);
      const fired: number[] = [];
      sb.ctx.bus.on('weapon.fired', () => fired.push(sb.sim.tick));
      let started = 0;
      let done = 0;
      sb.ctx.bus.on('weapon.reload', (e) => (e.done ? (done = sb.sim.tick) : (started = sb.sim.tick)));
      sb.fire(me);
      sb.stepUntil(() => fired.length >= 10, 600);
      sb.fire(me, false);
      sb.stepUntil(() => done > 0, 600);
      expect(fired).toHaveLength(10);
      expect(((fired[9] as number) - (fired[0] as number)) / 9).toBeCloseTo(TICK_RATE / 3.2, 0);
      expect((done - started) / TICK_RATE).toBeCloseTo(1.8, 1);
    });
  });

  describe('Gape', () => {
    it('lunges 6 m and bites: 90 damage, a 1 s silence, and you heal 30% of the damage dealt', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(6.8) },
        { hero: 'swan', at: AHEAD(10) },
      ]);
      const [bitten, safe] = rest as [EntityId, EntityId];
      const max = sb.ctx.stats.get(me, 'maxHealth');
      sb.health(me).hp = max - 300;
      const silence = durations(sb, bitten, 'silence');
      sb.cast(me, 0, AHEAD(6));
      sb.step(TICK_RATE * 0.5);
      expect(sb.hero(me).pos.z).toBeGreaterThan(5.5); // 6 m, plus the dash's exit glide
      expect(sb.hero(me).pos.z).toBeLessThan(7.5);
      const bite = hitsOn(sb, me, bitten, 'nightjar.gape');
      expect(bite).toHaveLength(1);
      expect(bite[0]?.amount).toBeCloseTo(90, 1);
      expect(bite[0]?.damageType).toBe('song');
      expect(silence[0]).toBeCloseTo(1, 1);
      expect(sb.health(me).hp).toBeCloseTo(max - 300 + 27, 1);
      expect(hitsOn(sb, me, safe)).toHaveLength(0);
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(12 * TICK_RATE);
    });

    it('heals nothing when it bites nobody', async () => {
      const { sb, me } = await setup();
      sb.health(me).hp = 100;
      sb.cast(me, 0, AHEAD(6));
      sb.step(TICK_RATE * 0.5);
      expect(sb.health(me).hp).toBe(100);
    });

    it('T3 (with T1, T2): 120 damage, a 1.75 s silence, 9 s cooldown', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(6.8) }], [3, 0, 0, 0]);
      const silence = durations(sb, rest[0] as EntityId, 'silence');
      sb.cast(me, 0, AHEAD(6));
      sb.step(TICK_RATE * 0.5);
      expect(hitsOn(sb, me, rest[0] as EntityId, 'nightjar.gape')[0]?.amount).toBeCloseTo(120, 1);
      expect(silence[0]).toBeCloseTo(1.75, 1);
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(9 * TICK_RATE);
    });
  });

  describe('Nightfall', () => {
    it('makes you invisible for 7 s, and the first hit out of it adds 60 Song damage and a 30% slow for 1.5 s', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(10) }]);
      const foe = rest[0] as EntityId;
      const nightfall = durations(sb, me, 'nightjar.nightfall');
      const slow = durations(sb, foe, 'slow');
      sb.cast(me, 1);
      sb.step(2);
      expect(invisible(sb, me)).toBe(true);
      expect(nightfall[0]).toBeCloseTo(7, 1);
      shoot(sb, me, foe);
      expect(invisible(sb, me)).toBe(false);
      const ambush = hitsOn(sb, me, foe, 'nightjar.nightfall');
      expect(ambush).toHaveLength(1);
      expect(ambush[0]?.amount).toBeCloseTo(60, 1);
      expect(ambush[0]?.damageType).toBe('song');
      expect(gunHits(sb, me, foe)[0]?.amount).toBeCloseTo(26, 1);
      expect(slow[0]).toBeCloseTo(1.5, 1);
      expect(sb.ctx.stats.get(foe, 'slow')).toBeCloseTo(0.3, 3);
      sb.step(30);
      shoot(sb, me, foe);
      expect(hitsOn(sb, me, foe, 'nightjar.nightfall')).toHaveLength(1);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(26 * TICK_RATE);
    });

    it('is spent: the bonus ends 1.5 s after the invisibility runs out', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(10) }]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 1);
      sb.step(TICK_RATE * 7.2);
      expect(invisible(sb, me)).toBe(false);
      shoot(sb, me, foe); // 0.2 s after: still inside the 1.5 s window
      expect(hitsOn(sb, me, foe, 'nightjar.nightfall')).toHaveLength(1);
      const b = await setup([{ hero: 'pelican', at: AHEAD(10) }]);
      b.sb.cast(b.me, 1);
      b.sb.step(TICK_RATE * 9);
      shoot(b.sb, b.me, b.rest[0] as EntityId);
      expect(hitsOn(b.sb, b.me, b.rest[0] as EntityId, 'nightjar.nightfall')).toHaveLength(0);
    });

    it('T2 (with T1): 10 s and a 20 s cooldown', async () => {
      const { sb, me } = await setup([], [0, 2, 0, 0]);
      const nightfall = durations(sb, me, 'nightjar.nightfall');
      sb.cast(me, 1);
      sb.step(2);
      expect(nightfall[0]).toBeCloseTo(10, 1);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(20 * TICK_RATE);
    });

    it('T3: you stay invisible after the first hit, and the second hit ends it with no bonus', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(10) }], [0, 3, 0, 0]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 1);
      sb.step(2);
      shoot(sb, me, foe);
      expect(hitsOn(sb, me, foe, 'nightjar.nightfall')).toHaveLength(1);
      expect(invisible(sb, me)).toBe(true);
      sb.step(30);
      shoot(sb, me, foe);
      expect(invisible(sb, me)).toBe(false);
      expect(hitsOn(sb, me, foe, 'nightjar.nightfall')).toHaveLength(1);
    });
  });

  describe('Churring Call', () => {
    it('reveals enemies in a 12 m, 60 degree cone for 5 s and amplifies their damage taken by 15%', async () => {
      const { sb, me, rest } = await setup([
        { hero: 'pelican', at: AHEAD(8) },
        { hero: 'swan', at: AHEAD(8, 7) }, // 41 degrees off the aim
        { hero: 'owl', at: AHEAD(15) }, // too far
      ]);
      const [inside, aside, far] = rest as [EntityId, EntityId, EntityId];
      const reveal = durations(sb, inside, 'reveal');
      const amp = durations(sb, inside, 'damageAmp');
      sb.cast(me, 2, AHEAD(8));
      sb.step(2);
      expect(reveal[0]).toBeCloseTo(5, 1);
      expect(amp[0]).toBeCloseTo(5, 1);
      expect(sb.ctx.stats.get(inside, 'talonAmp')).toBeCloseTo(0.15, 3);
      expect(sb.ctx.stats.get(inside, 'songAmp')).toBeCloseTo(0.15, 3);
      for (const id of [aside, far]) expect(sb.statuses(id)).not.toContain('reveal');
      shoot(sb, me, inside);
      expect(gunHits(sb, me, inside)[0]?.amount).toBeCloseTo(26 * 1.15, 1);
      sb.step(TICK_RATE * 5);
      expect(sb.ctx.stats.get(inside, 'talonAmp')).toBe(0);
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(14 * TICK_RATE);
    });

    it('T3 (with T1, T2): reaches 18 m, +25% amp, 10 s cooldown', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(16) }], [0, 0, 3, 0]);
      sb.cast(me, 2, AHEAD(16));
      sb.step(2);
      expect(sb.statuses(rest[0] as EntityId)).toContain('reveal');
      expect(sb.ctx.stats.get(rest[0] as EntityId, 'talonAmp')).toBeCloseTo(0.25, 3);
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(10 * TICK_RATE);
      expect(resolveAbility(nightjarDef.abilities[2], 3).range).toBe(18);
    });
  });

  describe('Night Swallow', () => {
    it('is locked before level 6 and usable at 6', async () => {
      const sb = await createSandbox({ heroes: [{ hero: 'nightjar', at: ORIGIN, yaw: 0 }, { hero: 'pelican', at: AHEAD(8) }], options: { unlockAbilities: false } });
      const [me, foe] = sb.heroes as [EntityId, EntityId];
      sb.cast(me, 3, foe);
      sb.step(5);
      expect(slot(sb, me, 3)?.unlocked).toBe(false);
      expect(slot(sb, me, 3)?.readyAt).toBe(0);
      sb.ctx.bus.emit({ type: 'hero.level', hero: me, level: 6, ap: 0, unlockSlot: 3 });
      sb.step();
      expect(slot(sb, me, 3)?.unlocked).toBe(true);
      sb.cast(me, 3, foe);
      sb.step(5);
      expect(slot(sb, me, 3)?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('dashes to an enemy hero within 12 m and strikes for 200 Song damage', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(10) }]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 3, foe);
      sb.step(TICK_RATE * 0.5);
      expect(sb.hero(me).pos.z).toBeGreaterThan(8);
      const strike = hitsOn(sb, me, foe, 'nightjar.nightSwallow');
      expect(strike).toHaveLength(1);
      expect(strike[0]?.amount).toBeCloseTo(200, 1);
      expect(strike[0]?.damageType).toBe('song');
      expect(strike[0]?.lethal).toBe(false);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(90 * TICK_RATE);
    });

    it('fails with no enemy hero in range', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(14) }]);
      sb.cast(me, 3, rest[0] as EntityId);
      sb.step(TICK_RATE * 0.5);
      expect(hitsOn(sb, me, rest[0] as EntityId)).toHaveLength(0);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(0);
    });

    it('spares a target that is no longer where the dash ends', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(10) }]);
      const foe = rest[0] as EntityId;
      sb.cast(me, 3, foe);
      sb.step(3);
      sb.place(foe, AHEAD(30));
      sb.step(TICK_RATE * 0.5);
      expect(hitsOn(sb, me, foe)).toHaveLength(0);
    });

    it('kills a hero left below 20% of max HP', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(10) }]);
      const foe = rest[0] as EntityId;
      const max = sb.ctx.stats.get(foe, 'maxHealth');
      sb.health(foe).hp = 200 + max * 0.15; // 15% of max is left after the strike
      sb.cast(me, 3, foe);
      sb.step(TICK_RATE * 0.5);
      expect(hitsOn(sb, me, foe, 'nightjar.nightSwallow')[0]?.lethal).toBe(true);
      expect(sb.hero(foe).health.dead).toBe(true);
    });

    it('lets a hero above 20% live, and T1 raises the threshold to 25%', async () => {
      const left = (pct: number) => 200 + 640 * pct;
      const a = await setup([{ hero: 'pelican', at: AHEAD(10) }]);
      a.sb.health(a.rest[0] as EntityId).hp = left(0.22);
      a.sb.cast(a.me, 3, a.rest[0] as EntityId);
      a.sb.step(TICK_RATE * 0.5);
      expect(a.sb.hero(a.rest[0] as EntityId).health.dead).toBe(false);
      const b = await setup([{ hero: 'pelican', at: AHEAD(10) }], [0, 0, 0, 1]);
      b.sb.health(b.rest[0] as EntityId).hp = left(0.22);
      b.sb.cast(b.me, 3, b.rest[0] as EntityId);
      b.sb.step(TICK_RATE * 0.5);
      expect(b.sb.hero(b.rest[0] as EntityId).health.dead).toBe(true);
    });

    it('T2 (with T1): a 70 s cooldown', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(10) }], [0, 0, 0, 2]);
      sb.cast(me, 3, rest[0] as EntityId);
      sb.step(TICK_RATE * 0.5);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(70 * TICK_RATE);
    });

    it('T3: an execute resets the cooldown and leaves you invisible for 3 s', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(10) }], [0, 0, 0, 3]);
      const foe = rest[0] as EntityId;
      sb.health(foe).hp = 200 + 640 * 0.1;
      const vanish = durations(sb, me, 'nightjar.nightfall');
      sb.cast(me, 3, foe);
      sb.step(TICK_RATE * 0.5);
      expect(sb.hero(foe).health.dead).toBe(true);
      expect(slot(sb, me, 3)?.readyAt).toBeLessThanOrEqual(sb.sim.tick);
      expect(invisible(sb, me)).toBe(true);
      expect(vanish[0]).toBeGreaterThan(2);
      expect(vanish[0]).toBeLessThanOrEqual(3);
    });

    it('without T3 an execute leaves the cooldown running and you visible', async () => {
      const { sb, me, rest } = await setup([{ hero: 'pelican', at: AHEAD(10) }]);
      const foe = rest[0] as EntityId;
      sb.health(foe).hp = 200 + 640 * 0.1;
      sb.cast(me, 3, foe);
      sb.step(TICK_RATE * 0.5);
      expect(sb.hero(foe).health.dead).toBe(true);
      expect(slot(sb, me, 3)?.readyAt).toBeGreaterThan(sb.sim.tick);
      expect(invisible(sb, me)).toBe(false);
    });
  });
});
