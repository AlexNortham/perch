/** Owl smoke tests (GDD §9.5): the gun, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import { Button } from '../../core/contracts';
import type { EntityId, HeroId, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { validateKit } from '../../abilities/kit';
import { owlDef } from '../../data/heroes/owl';
import { owl } from './index';

const AT = (z: number): Vec3 => ({ x: 0, y: 0, z });
const FOE: HeroId = 'albatross';

async function setup(foes: readonly { hero: HeroId; at: Vec3 }[] = [{ hero: FOE, at: AT(20) }], tiers: readonly number[] = [0, 0, 0, 0]) {
  const sb = await createSandbox({ heroes: [{ hero: 'owl', at: AT(0), yaw: 0 }, ...foes] });
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
function durations(sb: Sandbox, who: EntityId, id: string): number[] {
  const out: number[] = [];
  sb.ctx.bus.on('status.applied', (e) => {
    if (e.target === who && e.status === id) out.push((e.expiresAt - sb.sim.tick) / TICK_RATE);
  });
  return out;
}

describe('Owl', () => {
  it('has a valid, implemented kit with a swatch and zoom 0.5', () => {
    expect(validateKit(owl)).toEqual([]);
    expect(owl.implemented).toBe(true);
    expect(owlDef.swatch).toBeDefined();
    expect(owlDef.weapon.aimZoom).toBe(0.5);
  });

  describe('Hush Rifle (hitscan, 52 Talon, 6 rounds, 1.25 shots/s, beak x2.0)', () => {
    it('deals 52 to the body and 104 to the head from 30 m', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(30) }]);
      expect(sb.hero(me).weapon.ammo).toBe(6);
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.step(2);
      sb.fire(me, false);
      expect(hitsOn(sb, me, foe)[0]).toMatchObject({ beakShot: false, amount: expect.closeTo(52, 1) });
      sb.clearEvents();
      sb.step(TICK_RATE);
      sb.aimAt(me, foe, 'head');
      sb.fire(me);
      sb.step(2);
      expect(hitsOn(sb, me, foe)[0]).toMatchObject({ beakShot: true, amount: expect.closeTo(104, 1) });
    });
  });

  describe('Hush', () => {
    it('bursts on the hero: 85 Song damage and a 1.5 s silence, once', async () => {
      const { sb, me, foe } = await setup();
      const silenced = durations(sb, foe, 'silence');
      sb.cast(me, 0, sb.entity(foe).pos);
      sb.step(TICK_RATE * 2);
      const hits = hitsOn(sb, me, foe, 'owl.hush');
      expect(hits).toHaveLength(1);
      expect(hits[0]).toMatchObject({ damageType: 'song', amount: expect.closeTo(85, 1) });
      expect(silenced[0]).toBeCloseTo(1.5, 1);
    });

    it('also bursts at the end of its flight; T3 (with T1, T2) holds 2 charges', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(46.5) }], [3, 0, 0, 0]);
      expect(sb.hero(me).abilities.slots[0]?.charges).toBe(2);
      const silenced = durations(sb, foe, 'silence');
      sb.cast(me, 0, { x: 0, y: 1.3, z: 45 }); // 45 m flight ends 1.5 m short of the target: inside the 4 m T1 radius
      sb.step(TICK_RATE * 2);
      expect(hitsOn(sb, me, foe, 'owl.hush')).toHaveLength(1);
      expect(silenced[0]).toBeCloseTo(2.25, 1);
    });
  });

  describe('Night Eyes', () => {
    it('gives true sight 30 m, reveals heroes within 35 m for 6 s and +20% beak damage', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(34) }]);
      sb.cast(me, 1);
      sb.step(TICK_RATE);
      expect(sb.ctx.stats.has(me, 'trueSight')).toBe(true);
      expect(sb.ctx.stats.get(me, 'trueSightRadius')).toBe(30);
      expect(sb.ctx.stats.get(me, 'beakShotBonus')).toBeCloseTo(0.4, 3);
      expect(sb.ctx.stats.has(foe, 'revealed')).toBe(true);
      sb.aimAt(me, foe, 'head');
      sb.fire(me);
      sb.step(2);
      expect(hitsOn(sb, me, foe).find((e) => e.beakShot)?.amount).toBeCloseTo(52 * 2.4, 0);
      sb.fire(me, false);
      sb.step(TICK_RATE * 6);
      expect(sb.ctx.stats.has(me, 'trueSight')).toBe(false);
      expect(sb.ctx.stats.has(foe, 'revealed')).toBe(false);
    });

    it('does not reveal a hero beyond 35 m', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(38) }]);
      sb.cast(me, 1);
      sb.step(TICK_RATE);
      expect(sb.ctx.stats.has(foe, 'revealed')).toBe(false);
    });

    it('T1 reaches 45 m with 40 m sight, T2 lasts 9 s, T3 revealed enemies take +10% damage', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(44) }], [0, 3, 0, 0]);
      sb.cast(me, 1);
      sb.step(TICK_RATE);
      expect(sb.ctx.stats.get(me, 'trueSightRadius')).toBe(40);
      expect(sb.ctx.stats.has(foe, 'revealed')).toBe(true);
      expect(sb.ctx.stats.get(foe, 'talonAmp')).toBeCloseTo(0.1, 3);
      sb.step(TICK_RATE * 7);
      expect(sb.ctx.stats.has(me, 'trueSight')).toBe(true); // 9 s
      sb.step(TICK_RATE * 3);
      expect(sb.ctx.stats.has(me, 'trueSight')).toBe(false);
    });
  });

  describe('Silent Wing', () => {
    it('leaps about 6 m, glides with the gun usable, and ends on landing', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(15) }]);
      sb.cast(me, 2);
      let peak = 0;
      for (let i = 0; i < TICK_RATE * 2; i++) {
        sb.step();
        peak = Math.max(peak, sb.entity(me).pos.y);
      }
      expect(peak).toBeGreaterThan(5);
      expect(sb.hero(me).motor.mode).toBe('glide');
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.step(3);
      sb.fire(me, false);
      expect(hitsOn(sb, me, foe).length).toBeGreaterThan(0);
      sb.stepUntil(() => sb.hero(me).motor.mode === null, TICK_RATE * 5);
      expect(sb.hero(me).motor.mode).toBeNull();
      expect(sb.statuses(me)).not.toContain('owl.silentWing');
      expect(sb.hero(me).abilities.slots[2]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('Space ends it in the air', async () => {
      const { sb, me } = await setup();
      sb.cast(me, 2);
      sb.step(TICK_RATE);
      expect(sb.hero(me).motor.mode).toBe('glide');
      sb.press(me, Button.Jump);
      sb.step(3);
      expect(sb.hero(me).motor.mode).toBeNull();
    });

    it('T2 shortens the cooldown to 13 s; T3 adds +25% gun damage while gliding', async () => {
      const { sb, me } = await setup([], [0, 0, 3, 0]);
      sb.cast(me, 2);
      sb.step(2);
      expect(sb.hero(me).abilities.slots[2]?.cooldownTicks).toBe(13 * TICK_RATE);
      expect(sb.ctx.stats.get(me, 'gunDamage')).toBeCloseTo(0.25, 3);
    });
  });

  describe('Moonlit Mark', () => {
    it('roots for 1.2 s, then hits the first hero: 260 Song, silence 2.5 s, reveal 8 s, passing a fledgling', async () => {
      const { sb, me, foe } = await setup([{ hero: FOE, at: AT(100) }]);
      sb.dummy({ kind: 'unit', type: 'scrapper', team: 'dusk', at: AT(50), hp: 500 });
      const silenced = durations(sb, foe, 'silence');
      const revealed = durations(sb, foe, 'reveal');
      sb.cast(me, 3, sb.entity(foe).pos);
      sb.step(Math.round(TICK_RATE * 0.6));
      expect(hitsOn(sb, me, foe)).toHaveLength(0);
      expect(sb.hero(me).abilities.casting).not.toBeNull();
      sb.step(TICK_RATE * 2);
      const hits = hitsOn(sb, me, foe, 'owl.moonlitMark');
      expect(hits).toHaveLength(1);
      expect(hits[0]?.amount).toBeCloseTo(260, 1);
      expect(silenced[0]).toBeCloseTo(2.5, 1);
      expect(revealed[0]).toBeCloseTo(8, 1);
    });

    it('T3 (with T1, T2) pierces: 340 to each of two heroes in line, 70 s cooldown', async () => {
      const { sb, me, foe, rest } = await setup(
        [{ hero: FOE, at: AT(60) }, { hero: 'kingfisher', at: AT(80) }],
        [0, 0, 0, 3],
      );
      sb.cast(me, 3, sb.entity(foe).pos);
      sb.step(TICK_RATE * 3);
      expect(hitsOn(sb, me, foe, 'owl.moonlitMark')[0]?.amount).toBeCloseTo(340, 1);
      expect(hitsOn(sb, me, rest[1] as EntityId, 'owl.moonlitMark')[0]?.amount).toBeCloseTo(340, 1);
      expect(sb.hero(me).abilities.slots[3]?.cooldownTicks).toBe(70 * TICK_RATE);
    });
  });
});
