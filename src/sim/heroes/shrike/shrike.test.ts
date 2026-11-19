/** Shrike smoke tests (GDD §9.1): the gun, then each ability at a relevant tier, in the QA sandbox. */
import { describe, expect, it } from 'vitest';
import type { EntityId, Vec3 } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../../tests/helpers/sandbox';
import { TICK_RATE } from '../../data/core';
import { validateKit } from '../../abilities/kit';
import { shrike } from './index';

const FAR: Vec3 = { x: 0, y: 0, z: -10 };
const NEAR: Vec3 = { x: 0, y: 0, z: 5 };

/** Shrike (Dawn) with the given tiers bought, a Pelican (Dusk) and optionally an Owl (Dusk); no regeneration. */
async function setup(tiers: readonly number[] = [0, 0, 0, 0], foeAt: Vec3 = NEAR, from: Vec3 = FAR, owlAt?: Vec3) {
  const sb = await createSandbox({
    heroes: [{ hero: 'shrike', at: from }, { hero: 'pelican', at: foeAt }, ...(owlAt ? [{ hero: 'owl' as const, at: owlAt }] : [])],
  });
  const [me, foe, owl] = sb.heroes as [EntityId, EntityId, EntityId];
  sb.hero(me).abilities.ap = 99;
  tiers.forEach((tier, slot) => {
    for (let t = 0; t < tier; t++) {
      sb.upgrade(me, slot);
      sb.step();
    }
  });
  return { sb, me, foe, owl };
}

const hitsOn = (sb: Sandbox, me: EntityId, foe: EntityId, ability?: string) =>
  sb.eventsOf('damage.applied').filter((e) => e.source === me && e.target === foe && (ability === undefined || e.ability === ability));
const statusOn = (sb: Sandbox, foe: EntityId, id: string) =>
  sb.eventsOf('status.applied').filter((e) => e.target === foe && e.status === id);
/** Seconds each application of a status lasts, measured as it lands. Call before the cast. */
function durations(sb: Sandbox, foe: EntityId, id: string): number[] {
  const out: number[] = [];
  sb.ctx.bus.on('status.applied', (e) => {
    if (e.target === foe && e.status === id) out.push((e.expiresAt - sb.sim.tick) / TICK_RATE);
  });
  return out;
}

describe('Shrike', () => {
  it('has a valid, implemented kit', () => {
    expect(validateKit(shrike)).toEqual([]);
    expect(shrike.implemented).toBe(true);
  });

  describe('Barb Rifle (projectile 180 m/s, 14 Talon, 24 rounds, 2.2 s reload)', () => {
    it('deals 14 per bullet and 14 × 1.65 on the head', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 0], { x: 0, y: 0, z: -4 });
      sb.aimAt(me, foe, 'body');
      sb.fire(me);
      sb.step(10);
      sb.fire(me, false);
      const body = hitsOn(sb, me, foe);
      expect(body.length).toBeGreaterThan(0);
      for (const e of body) expect([e.beakShot, e.amount]).toEqual([false, expect.closeTo(14, 1)]);
      sb.clearEvents();
      sb.step(30);
      sb.aimAt(me, foe, 'head');
      sb.fire(me);
      sb.step(10);
      const head = hitsOn(sb, me, foe);
      expect(head.length).toBeGreaterThan(0);
      for (const e of head) expect([e.beakShot, e.amount]).toEqual([true, expect.closeTo(14 * 1.65, 1)]);
    });

    it('holds 24 rounds, fires 6 a second and reloads in 2.2 s', async () => {
      const { sb, me } = await setup();
      expect(sb.hero(me).weapon.ammo).toBe(24);
      const fired: number[] = [];
      sb.ctx.bus.on('weapon.fired', () => fired.push(sb.sim.tick));
      let started = 0;
      let done = 0;
      sb.ctx.bus.on('weapon.reload', (e) => (e.done ? (done = sb.sim.tick) : (started = sb.sim.tick)));
      sb.fire(me);
      sb.stepUntil(() => done > 0, 600);
      expect(fired.filter((t) => t <= started)).toHaveLength(24);
      expect((fired[1] as number) - (fired[0] as number)).toBe(TICK_RATE / 6);
      expect(done - started).toBe(Math.round(2.2 * TICK_RATE));
    });
  });

  describe('Thorn Larder', () => {
    it('arms, then roots 1 s, reveals 4 s and damages 80 the first enemy hero that comes near', async () => {
      const { sb, me, foe } = await setup();
      const rooted = durations(sb, foe, 'root');
      const revealed = durations(sb, foe, 'reveal');
      sb.cast(me, 0, NEAR);
      sb.step(TICK_RATE * 1.5); // 0.75 s arming; the enemy standing on it triggers it
      const hits = hitsOn(sb, me, foe, 'shrike.thornLarder');
      expect(hits).toHaveLength(1);
      expect(hits[0]?.amount).toBeCloseTo(80, 1);
      expect(hits[0]?.damageType).toBe('song');
      expect(rooted[0]).toBeCloseTo(1, 1);
      expect(revealed[0]).toBeCloseTo(4, 1);
      const slot = sb.hero(me).abilities.slots[0];
      expect(slot?.charges).toBe(1); // 2 charges, one spent
      expect(slot?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('T3 (with T1, T2): 3 charges, root 1.5 s, and the burst hits a second hero 3 m away', async () => {
      const { sb, me, foe, owl } = await setup([3, 0, 0, 0], NEAR, FAR, { x: 3, y: 0, z: 5 });
      expect(sb.hero(me).abilities.slots[0]?.charges).toBe(3);
      const rooted = durations(sb, foe, 'root');
      sb.cast(me, 0, NEAR);
      sb.step(TICK_RATE * 1.5);
      expect(rooted[0]).toBeCloseTo(1.5, 1);
      expect(hitsOn(sb, me, foe, 'shrike.thornLarder')).toHaveLength(1);
      expect(hitsOn(sb, me, owl, 'shrike.thornLarder')).toHaveLength(1);
    });
  });

  describe('Briar Patch', () => {
    it('deals about 25 a second and slows 30% for 6 s', async () => {
      const { sb, me, foe } = await setup();
      sb.cast(me, 1, NEAR);
      sb.step(TICK_RATE * 7);
      const total = hitsOn(sb, me, foe, 'shrike.briarPatch').reduce((s, e) => s + e.amount, 0);
      expect(total).toBeGreaterThan(25 * 6 - 13); // 12 ticks of 12.5, the first after 0.5 s
      expect(total).toBeLessThanOrEqual(25 * 6 + 0.5);
      expect(sb.statuses(foe)).not.toContain('slow'); // gone after the zone ended
      expect(statusOn(sb, foe, 'slow').length).toBeGreaterThan(0);
      expect(sb.hero(me).abilities.slots[1]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('T3 (with T1, T2): grounds and adds +15% Song damage taken, cooldown 18 − 4 s', async () => {
      const { sb, me, foe } = await setup([0, 3, 0, 0]);
      sb.cast(me, 1, NEAR);
      sb.step(TICK_RATE * 2);
      expect(sb.ctx.stats.has(foe, 'grounded')).toBe(true);
      expect(sb.ctx.stats.get(foe, 'songAmp')).toBeCloseTo(0.15, 3);
      expect(sb.ctx.stats.get(foe, 'slow')).toBeCloseTo(0.3, 3);
      const slot = sb.hero(me).abilities.slots[1];
      expect(slot?.cooldownTicks).toBe(14 * TICK_RATE);
    });
  });

  describe('Impaling Bolt', () => {
    it('hits the first hero for 70 and knocks it back (6 m of displacement, a little more on the ground)', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 0], { x: 0, y: 0, z: 0 });
      sb.cast(me, 2, foe);
      const z0 = sb.entity(foe).pos.z;
      sb.step(TICK_RATE * 2);
      const hits = hitsOn(sb, me, foe, 'shrike.impalingBolt');
      expect(hits).toHaveLength(1);
      expect(hits[0]?.amount).toBeCloseTo(70, 1);
      // physics lands a 6 m displace 8.4 m away (the landing slide, D-CTRL-005): a finding for the Character Controller
      expect(sb.entity(foe).pos.z - z0).toBeGreaterThanOrEqual(6);
      expect(sb.entity(foe).pos.z - z0).toBeLessThan(9);
      expect(statusOn(sb, foe, 'stun')).toHaveLength(0); // open ground: no pin
      expect(sb.hero(me).abilities.slots[2]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('pins against a wall: 40 more damage and a 1.25 s stun', async () => {
      // The arena's 2 m crate stands at x 7–9: push the Pelican toward it.
      const { sb, me, foe } = await setup([0, 0, 0, 0], { x: 5.5, y: 0, z: 0 }, { x: -4, y: 0, z: 0 });
      const stunned = durations(sb, foe, 'stun');
      sb.cast(me, 2, foe);
      sb.step(TICK_RATE * 2);
      expect(hitsOn(sb, me, foe, 'shrike.impalingBolt').map((h) => Math.round(h.amount))).toEqual([70, 40]);
      expect(stunned).toHaveLength(1);
      expect(stunned[0]).toBeCloseTo(1.25, 1);
    });

    it('T3 (with T1, T2): 100 damage, cooldown 12 s, pierces to the hero behind, pin stun 2 s', async () => {
      // Pelican at x 4.5 and Owl at x 5.5, both in the bolt's line, the crate behind them.
      const { sb, me, foe, owl } = await setup([0, 0, 3, 0], { x: 4.5, y: 0, z: 0 }, { x: -4, y: 0, z: 0 }, { x: 5.5, y: 0, z: 0 });
      const stunned = durations(sb, owl, 'stun');
      sb.cast(me, 2, { x: 4.5, y: 1, z: 0 });
      sb.step(TICK_RATE * 2);
      expect(hitsOn(sb, me, foe, 'shrike.impalingBolt')[0]?.amount).toBeCloseTo(100, 1);
      expect(hitsOn(sb, me, owl, 'shrike.impalingBolt')[0]?.amount).toBeCloseTo(100, 1);
      expect(stunned[0]).toBeCloseTo(2, 1);
      expect(sb.hero(me).abilities.slots[2]?.cooldownTicks).toBe(12 * TICK_RATE);
    });
  });

  describe("Butcher's Ring", () => {
    it('is locked before level 6 and usable at 6', async () => {
      const sb = await createSandbox({ heroes: [{ hero: 'shrike', at: FAR }, { hero: 'pelican', at: NEAR }], options: { unlockAbilities: false } });
      const [me] = sb.heroes as [EntityId];
      expect(sb.hero(me).abilities.slots[3]?.unlocked).toBe(false);
      sb.cast(me, 3, NEAR);
      sb.step(5);
      expect(sb.hero(me).abilities.slots[3]?.readyAt).toBe(0); // nothing was cast
      sb.ctx.bus.emit({ type: 'hero.level', hero: me, level: 6, ap: 0, unlockSlot: 3 });
      sb.step();
      expect(sb.hero(me).abilities.slots[3]?.unlocked).toBe(true);
      sb.cast(me, 3, NEAR);
      sb.step(5);
      expect(sb.hero(me).abilities.slots[3]?.readyAt).toBeGreaterThan(sb.sim.tick);
    });

    it('stands after 0.8 s, then roots 1.25 s and damages 150 a hero that crosses it, and halves healing inside', async () => {
      const { sb, me, foe } = await setup([0, 0, 0, 0], { x: 0, y: 0, z: 14.5 }, { x: 0, y: 0, z: -2 });
      const rooted = durations(sb, foe, 'root');
      sb.cast(me, 3, { x: 0, y: 0, z: 5 }); // radius 9 around z 5: the ring line is at z 14 and z -4
      sb.step(TICK_RATE * 1); // it has stood since 0.8 s
      sb.move(foe, 1); // Dusk faces -z
      sb.step(TICK_RATE * 1.5);
      const hits = hitsOn(sb, me, foe, 'shrike.butchersRing');
      expect(hits).toHaveLength(1);
      expect(hits[0]?.amount).toBeCloseTo(150, 1);
      expect(rooted[0]).toBeCloseTo(1.25, 1);
      expect(sb.ctx.stats.get(foe, 'healReduction')).toBeCloseTo(0.4, 3);
      expect(sb.hero(me).abilities.slots[3]?.cooldownTicks).toBe(110 * TICK_RATE);
    });
  });
});
