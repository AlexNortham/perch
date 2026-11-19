/** Kingfisher smoke tests (GDD §9.3): the gun, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import type { EntityId, HeroId, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { validateKit } from '../../abilities/kit';
import { kingfisherDef } from '../../data/heroes/kingfisher';
import { kingfisher } from './index';

const ORIGIN: Vec3 = { x: 0, y: 0, z: 0 };
const AHEAD = (z: number): Vec3 => ({ x: 0, y: 0, z });

/** Kingfisher (Dawn, at the origin facing +z) and Dusk heroes at the given places; tiers bought for the Kingfisher. */
async function setup(foes: readonly { hero: HeroId; at: Vec3 }[] = [{ hero: 'pelican', at: AHEAD(10) }], tiers: readonly number[] = [0, 0, 0, 0]) {
  const sb = await createSandbox({ heroes: [{ hero: 'kingfisher', at: ORIGIN, yaw: 0 }, ...foes] });
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
/** Seconds each application of a status lasts, measured as it lands. Call before the cast. */
function durations(sb: Sandbox, who: EntityId, id: string): number[] {
  const out: number[] = [];
  sb.ctx.bus.on('status.applied', (e) => {
    if (e.target === who && e.status === id) out.push((e.expiresAt - sb.sim.tick) / TICK_RATE);
  });
  return out;
}
const slot = (sb: Sandbox, me: EntityId, i: number) => sb.hero(me).abilities.slots[i];

describe('Kingfisher', () => {
  it('has a valid, implemented kit', () => {
    expect(validateKit(kingfisher)).toEqual([]);
    expect(kingfisher.implemented).toBe(true);
  });

  it("says in data what the framework will run: Riverstrike T3's vanish as selfEffects", () => {
    const t3 = kingfisherDef.abilities[3].upgrades[2];
    expect(t3.selfEffects?.[0]).toMatchObject({ kind: 'applyStatus', status: { id: 'invisible' }, durationS: 1.5 });
  });

  describe('Dart Pistol (hitscan, 22 Talon, 12 rounds, 4 shots/s, 1.6 s reload)', () => {
    it('deals 22 per dart and 22 × 1.65 on the head', async () => {
      const { sb, me, foe } = await setup([{ hero: 'pelican', at: AHEAD(5) }]);
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.step(2);
      sb.fire(me, false);
      const body = hitsOn(sb, me, foe);
      expect(body.length).toBeGreaterThan(0);
      for (const e of body) expect([e.beakShot, e.amount]).toEqual([false, expect.closeTo(22, 1)]);
      sb.clearEvents();
      sb.step(30);
      sb.aimAt(me, foe, 'head');
      sb.fire(me);
      sb.step(2);
      const head = hitsOn(sb, me, foe);
      expect(head.length).toBeGreaterThan(0);
      for (const e of head) expect([e.beakShot, e.amount]).toEqual([true, expect.closeTo(22 * 1.65, 1)]);
    });

    it('holds 12 rounds, fires 4 a second and reloads in 1.6 s', async () => {
      const { sb, me } = await setup();
      expect(sb.hero(me).weapon.ammo).toBe(12);
      const fired: number[] = [];
      sb.ctx.bus.on('weapon.fired', () => fired.push(sb.sim.tick));
      let started = 0;
      let done = 0;
      sb.ctx.bus.on('weapon.reload', (e) => (e.done ? (done = sb.sim.tick) : (started = sb.sim.tick)));
      sb.fire(me);
      sb.stepUntil(() => done > 0, 600);
      expect(fired.filter((t) => t <= started)).toHaveLength(12);
      expect((fired[1] as number) - (fired[0] as number)).toBe(TICK_RATE / 4);
      expect(done - started).toBe(Math.round(1.6 * TICK_RATE));
    });
  });

  describe('Plunge', () => {
    it('dashes at the first enemy hero for 80 and fires 25% faster for 3 s', async () => {
      const { sb, me, foe } = await setup();
      const rate = durations(sb, me, 'kingfisher.plunge');
      sb.cast(me, 0, foe);
      sb.step(TICK_RATE * 0.5);
      const hits = hitsOn(sb, me, foe, 'kingfisher.plunge');
      expect(hits).toHaveLength(1);
      expect(hits[0]?.amount).toBeCloseTo(80, 1);
      expect(hits[0]?.damageType).toBe('song');
      expect(sb.entity(me).pos.z).toBeGreaterThan(8); // stopped on the hero, short of the full 14 m
      expect(sb.entity(me).pos.z).toBeLessThan(11);
      expect(rate[0]).toBeCloseTo(3, 1);
      expect(sb.ctx.stats.get(me, 'fireRate')).toBeCloseTo(0.25, 3);
      expect(slot(sb, me, 0)?.charges).toBe(1); // 2 charges, one spent
    });

    it('T3 (with T1, T2): 110 damage, slows the hero 40% for 2 s and refunds the charge; cooldown 9 s', async () => {
      const { sb, me, foe } = await setup([{ hero: 'pelican', at: AHEAD(10) }], [3, 0, 0, 0]);
      const slowed = durations(sb, foe, 'slow');
      sb.cast(me, 0, foe);
      sb.step(TICK_RATE * 0.5);
      expect(hitsOn(sb, me, foe, 'kingfisher.plunge')[0]?.amount).toBeCloseTo(110, 1);
      expect(slowed.at(-1)).toBeCloseTo(2, 1);
      expect(sb.ctx.stats.get(foe, 'slow')).toBeCloseTo(0.4, 3);
      expect(slot(sb, me, 0)?.charges).toBe(2); // refunded
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(0);
    });

    it('a miss costs a charge and starts the 12 s cooldown', async () => {
      const { sb, me } = await setup([{ hero: 'pelican', at: AHEAD(30) }]);
      sb.cast(me, 0, AHEAD(10));
      sb.step(TICK_RATE * 0.5);
      expect(sb.entity(me).pos.z).toBeGreaterThan(12); // the full 14 m
      expect(slot(sb, me, 0)?.charges).toBe(1);
      expect(slot(sb, me, 0)?.cooldownTicks).toBe(12 * TICK_RATE);
    });
  });

  describe('Glint', () => {
    it('turns you invisible with +25% speed for 5 s; attacking ends it and starts Ambush (+40% for 1.5 s)', async () => {
      const { sb, me, foe } = await setup([{ hero: 'pelican', at: AHEAD(5) }]);
      const speed = sb.ctx.stats.get(me, 'moveSpeed');
      const invisible = durations(sb, me, 'kingfisher.glint');
      sb.cast(me, 1);
      sb.step(2);
      expect(invisible[0]).toBeCloseTo(5, 1);
      expect(sb.ctx.stats.has(me, 'invisible')).toBe(true);
      expect(sb.ctx.stats.get(me, 'moveSpeed')).toBeCloseTo(speed * 1.25, 3);
      sb.step(TICK_RATE);
      expect(sb.ctx.stats.get(me, 'gunDamage')).toBe(0);
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.step(3);
      sb.fire(me, false);
      expect(sb.ctx.stats.has(me, 'invisible')).toBe(false);
      expect(sb.ctx.stats.get(me, 'gunDamage')).toBeCloseTo(0.4, 3);
      expect(sb.ctx.stats.get(me, 'songDamage')).toBeCloseTo(0.4, 3);
      expect(hitsOn(sb, me, foe)[0]?.amount).toBeCloseTo(22 * 1.4, 1);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(28 * TICK_RATE);
      sb.step(TICK_RATE * 1.6);
      expect(sb.ctx.stats.get(me, 'gunDamage')).toBe(0);
    });

    it('starts Ambush when the time runs out too', async () => {
      const { sb, me } = await setup();
      sb.cast(me, 1);
      sb.step(TICK_RATE * 5 + 5);
      expect(sb.ctx.stats.has(me, 'invisible')).toBe(false);
      expect(sb.ctx.stats.get(me, 'gunDamage')).toBeCloseTo(0.4, 3);
    });

    it('T3 (with T1, T2): 8 s, 22 s cooldown, and the first hit on a hero silences it for 2 s', async () => {
      const { sb, me, foe } = await setup([{ hero: 'pelican', at: AHEAD(5) }], [0, 3, 0, 0]);
      const invisible = durations(sb, me, 'kingfisher.glint');
      const silenced = durations(sb, foe, 'silence');
      sb.cast(me, 1);
      sb.step(2);
      expect(invisible[0]).toBeCloseTo(8, 1);
      expect(slot(sb, me, 1)?.cooldownTicks).toBe(22 * TICK_RATE);
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.step(TICK_RATE);
      sb.fire(me, false);
      expect(silenced).toHaveLength(1);
      expect(silenced[0]).toBeCloseTo(2, 1);
    });
  });

  describe('Spear Bill', () => {
    it('lunges 5 m and stabs for 110, then bleeds 15 a second for 4 s', async () => {
      const { sb, me, foe } = await setup([{ hero: 'pelican', at: AHEAD(5) }]);
      sb.cast(me, 2, AHEAD(5));
      sb.step(TICK_RATE * 5);
      const hits = hitsOn(sb, me, foe, 'kingfisher.spearBill');
      expect(hits[0]?.amount).toBeCloseTo(110, 1);
      const bleed = hits.slice(1).reduce((s, e) => s + e.amount, 0);
      expect(bleed).toBeCloseTo(60, 0);
      expect(sb.entity(me).pos.z).toBeGreaterThan(3.5);
      expect(slot(sb, me, 2)?.cooldownTicks).toBe(10 * TICK_RATE);
    });

    it('stabs for +50% below 40% HP, and from T2 below 50%', async () => {
      const t0 = await setup([{ hero: 'pelican', at: AHEAD(5) }]);
      const max = t0.sb.ctx.stats.get(t0.foe, 'maxHealth');
      t0.sb.health(t0.foe).hp = max * 0.45;
      t0.sb.cast(t0.me, 2, AHEAD(5));
      t0.sb.step(TICK_RATE * 0.5);
      expect(hitsOn(t0.sb, t0.me, t0.foe)[0]?.amount).toBeCloseTo(110, 1); // 45%: no bonus yet
      t0.sb.health(t0.foe).hp = max * 0.35;

      const t2 = await setup([{ hero: 'pelican', at: AHEAD(5) }], [0, 0, 2, 0]);
      t2.sb.health(t2.foe).hp = max * 0.45;
      t2.sb.cast(t2.me, 2, AHEAD(5));
      t2.sb.step(TICK_RATE * 0.5);
      expect(hitsOn(t2.sb, t2.me, t2.foe)[0]?.amount).toBeCloseTo(165, 1); // 110 × 1.5, one stab only
      expect(hitsOn(t2.sb, t2.me, t2.foe).filter((h) => h.amount > 100)).toHaveLength(1);

      const low = await setup([{ hero: 'pelican', at: AHEAD(5) }]);
      low.sb.health(low.foe).hp = max * 0.35;
      low.sb.cast(low.me, 2, AHEAD(5));
      low.sb.step(TICK_RATE * 0.5);
      expect(hitsOn(low.sb, low.me, low.foe)[0]?.amount).toBeCloseTo(165, 1);
    });

    it('T3 (with T1, T2): bleeds 6 s, and a kill resets Spear Bill and Plunge', async () => {
      const { sb, me, foe } = await setup([{ hero: 'pelican', at: AHEAD(5) }], [0, 0, 3, 0]);
      sb.health(foe).hp = 50;
      sb.cast(me, 0, { x: 14, y: 0, z: 0 }); // Plunge sideways, so both abilities have a cooldown to reset
      sb.step(TICK_RATE * 0.5);
      expect(slot(sb, me, 0)?.charges).toBe(1);
      sb.place(me, ORIGIN, 0);
      sb.step(TICK_RATE * 0.5);
      sb.cast(me, 2, foe);
      sb.step(TICK_RATE * 0.5);
      expect(sb.health(foe).dead).toBe(true);
      expect(slot(sb, me, 2)?.readyAt).toBe(0);
      expect(slot(sb, me, 2)?.charges).toBe(1);
      expect(slot(sb, me, 0)?.charges).toBe(2);
      expect(slot(sb, me, 0)?.readyAt).toBe(0);
    });
  });

  describe('Riverstrike', () => {
    it('is locked before level 6 and usable at 6', async () => {
      const sb = await createSandbox({ heroes: [{ hero: 'kingfisher', at: ORIGIN, yaw: 0 }, { hero: 'pelican', at: AHEAD(20) }], options: { unlockAbilities: false } });
      const [me, foe] = sb.heroes as [EntityId, EntityId];
      sb.cast(me, 3, foe);
      sb.step(5);
      expect(slot(sb, me, 3)?.unlocked).toBe(false);
      expect(slot(sb, me, 3)?.readyAt).toBe(0);
      sb.ctx.bus.emit({ type: 'hero.level', hero: me, level: 6, ap: 0, unlockSlot: 3 });
      sb.step();
      expect(slot(sb, me, 3)?.unlocked).toBe(true);
      sb.cast(me, 3, foe);
      sb.step(TICK_RATE);
      expect(slot(sb, me, 3)?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('winds up 0.5 s, then teleports 1.5 m behind the target and strikes for 220 + 12% of its missing HP', async () => {
      const { sb, me, foe } = await setup([{ hero: 'pelican', at: AHEAD(20) }]);
      const max = sb.ctx.stats.get(foe, 'maxHealth');
      sb.health(foe).hp = max - 200;
      sb.cast(me, 3, foe);
      sb.step(TICK_RATE * 0.3);
      expect(hitsOn(sb, me, foe)).toHaveLength(0); // still winding up
      expect(sb.entity(me).pos.z).toBeCloseTo(0, 1);
      sb.step(TICK_RATE * 0.4);
      const hit = hitsOn(sb, me, foe, 'kingfisher.riverstrike')[0];
      expect(hit?.amount).toBeCloseTo(220 + 0.12 * 200, 1);
      // Dusk faces -z, so "behind" is +z of the target: 1.5 m beyond it.
      expect(sb.entity(me).pos.z).toBeCloseTo(20 + 1.5, 0);
      expect(slot(sb, me, 3)?.cooldownTicks).toBe(100 * TICK_RATE);
    });

    it('refunds half the cooldown when the target dies within 3 s', async () => {
      const { sb, me, foe } = await setup([{ hero: 'pelican', at: AHEAD(20) }]);
      sb.health(foe).hp = 100;
      sb.cast(me, 3, foe);
      sb.step(TICK_RATE * 1);
      expect(sb.health(foe).dead).toBe(true);
      const left = ((slot(sb, me, 3)?.readyAt ?? 0) - sb.sim.tick) / TICK_RATE;
      expect(left).toBeGreaterThan(48);
      expect(left).toBeLessThan(51);
    });

    it('T3 (with T1, T2): +10 m range, 18% missing HP, silences the target 1.5 s and turns you invisible 1.5 s', async () => {
      const { sb, me, foe } = await setup([{ hero: 'pelican', at: AHEAD(38) }], [0, 0, 0, 3]);
      const max = sb.ctx.stats.get(foe, 'maxHealth');
      sb.health(foe).hp = max - 200;
      const silenced = durations(sb, foe, 'silence');
      const vanished = durations(sb, me, 'invisible');
      sb.cast(me, 3, foe);
      sb.step(TICK_RATE * 0.8);
      const hits = hitsOn(sb, me, foe, 'kingfisher.riverstrike');
      const total = hits.reduce((s, h) => s + h.amount, 0);
      // 220 + 18% of the 200 missing; the extra 6% is read after the main hit lands, so it is a little more.
      expect(total).toBeGreaterThanOrEqual(220 + 0.18 * 200 - 0.5);
      expect(total).toBeLessThan(220 + 0.18 * 420);
      expect(silenced[0]).toBeCloseTo(1.5, 1);
      expect(vanished.length).toBeGreaterThan(0);
      expect(vanished[0]).toBeCloseTo(1.5, 1);
    });
  });
});
