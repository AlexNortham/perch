// The Golden Egg (GDD §7.11, D-EP-039). Written test-first (D-EP-006, W4.5 QA): gated until sim/world, combat and
// economy land it in wave 5. Run with PERCH_PENDING=1 npx vitest run tests/rules/golden-egg.test.ts
import { describe, expect, it } from 'vitest';
import { Button, type EntityId } from '../../src/sim/core/contracts';
import { TICK_RATE } from '../../src/sim/data/core';
import type { Sandbox } from '../helpers/sandbox';
import { advanceBy, advanceTo, dist, earned, flat, heavyMelee, lethal, lightMelee, meleeHits, mmss, objectiveEvents, pickupsOf, standBeside, world } from '../helpers/world';

const TIMEOUT_MS = 300_000;
const LANDING_S = 10;
const DROP_LOCKOUT_S = 1.0;
const UNATTENDED_S = 180;
const COOL_AFTER_S = 45;
const COOL_FOR_S = 45;
const STONE_RADIUS_M = 3;
const ROLL_MS = 2;

const eggOf = (sb: Sandbox) => {
  const id = sb.ctx.objectives.egg?.pickup;
  return id == null ? undefined : pickupsOf(sb, 'egg').find((p) => p.id === id);
};
const stone = (sb: Sandbox) => sb.ctx.map.eggPerches[1 - sb.ctx.objectives.egg!.perch]!;
const valueAt = (m: number) => 400 + 70 * m;

/** Two Dawn heroes (the courier and an escort), one Dusk hero; time at 10:00 with the Egg landed. */
async function landed() {
  const sb = await world({ heroes: ['shrike', { hero: 'kingfisher', team: 'dawn' }, 'lyrebird'] });
  const [courier, escort, foe] = sb.heroes as [EntityId, EntityId, EntityId];
  advanceTo(sb, mmss(10));
  sb.step(2);
  advanceBy(sb, LANDING_S + 0.5);
  const egg = eggOf(sb)!;
  expect(egg, '§7.11 the Egg has landed by 10:10').toBeDefined();
  return { sb, courier, escort, foe, egg };
}

async function carried() {
  const w = await landed();
  standBeside(w.sb, w.courier, w.egg.pos);
  lightMelee(w.sb, w.courier);
  return w;
}

describe.runIf(process.env.PERCH_PENDING === '1')('W5 Golden Egg (§7.11)', { timeout: TIMEOUT_MS }, () => {
  it('§7.11 first spawn: nothing before 10:00; at 10:00 an egg pickup on one of the two Egg Perches with an eggSpawned event', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    advanceTo(sb, mmss(9, 59));
    expect(pickupsOf(sb, 'egg')).toHaveLength(0);
    expect(sb.ctx.objectives.eggAt).toBe(mmss(10) * TICK_RATE);
    advanceTo(sb, mmss(10, 1));
    const egg = eggOf(sb)!;
    expect(egg, 'the Egg exists at 10:00').toBeDefined();
    expect(objectiveEvents(sb, 'eggSpawned')).toHaveLength(1);
    const { perch } = sb.ctx.objectives.egg!;
    expect([0, 1]).toContain(perch);
    expect(flat(egg.pos, sb.ctx.map.eggPerches[perch]!.pos), 'it is on its perch').toBeLessThan(1);
  });

  it('§7.11 arrival: lowered over 10 s; a melee hit before it lands picks nothing up, one after does', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const [hero] = sb.heroes as [EntityId];
    advanceTo(sb, mmss(10, 1));
    const egg = eggOf(sb)!;
    expect(egg.pickup.claimableAt, 'claimable only after the 10 s lowering').toBeGreaterThanOrEqual(mmss(10, LANDING_S) * TICK_RATE - 2);
    standBeside(sb, hero, egg.pos);
    lightMelee(sb, hero);
    expect(egg.pickup.carrier, 'a hit while it is still lowering does nothing').toBeNull();
    advanceTo(sb, mmss(10, LANDING_S + 1));
    standBeside(sb, hero, egg.pos);
    lightMelee(sb, hero);
    expect(egg.pickup.carrier).toBe(hero);
  });

  it('§7.11 pick up: a light melee hit takes the Egg (and so does a heavy one); eggTaken names the hero', async () => {
    const { sb, courier, egg } = await landed();
    standBeside(sb, courier, egg.pos);
    lightMelee(sb, courier);
    expect(egg.pickup.carrier, 'light hit').toBe(courier);
    expect(objectiveEvents(sb, 'eggTaken')[0]).toMatchObject({ hero: courier, pickupType: 'egg' });

    const second = await landed();
    standBeside(second.sb, second.courier, second.egg.pos);
    heavyMelee(second.sb, second.courier);
    expect(second.egg.pickup.carrier, 'heavy hit').toBe(second.courier);
  });

  it('§7.11 carrier status: cannot fire or cast, is revealed with a map-wide beam, is +1.5 m/s and +1 stamina pip, and takes no slow', async () => {
    const { sb, courier } = await carried();
    const h = sb.hero(courier);
    expect(h.stats.conditions.has('eggCarrier')).toBe(true);
    expect(h.stats.conditions.has('revealed'), '§7.11 revealed, golden beam visible map-wide').toBe(true);
    const free = sb.hero(sb.heroes[1]!).stats.final;
    expect(h.stats.final.moveSpeed - 0).toBeCloseTo(1.5, 1);
    expect(h.stats.final.stamina, '+1 stamina pip').toBeGreaterThanOrEqual(1);
    expect(free.moveSpeed).toBe(0);

    sb.clearEvents();
    sb.aimAt(courier, sb.pointOf(sb.heroes[2]!));
    sb.fire(courier);
    sb.cast(courier, 0);
    sb.step(30);
    sb.fire(courier, false);
    expect(sb.eventsOf('weapon.fired').filter((e) => e.shooter === courier), 'cannot fire').toHaveLength(0);
    expect(sb.eventsOf('ability').filter((e) => e.caster === courier), 'cannot cast').toHaveLength(0);
    sb.apply({ kind: 'applyStatus', status: { id: 'qa-slow', name: 'QA slow', negative: true, durationS: 3, stacking: 'perSource', maxStacks: 1,
      modifiers: { stats: [{ stat: 'slow', op: 'add', value: 0.5 }] } } }, courier, sb.cause(sb.heroes[2]!));
    sb.step();
    expect(sb.hero(courier).stats.final.slow, 'immune to slows').toBe(0);
  });

  it('§7.11 trailing carrier: +2% Talon and Song resist and +0.2 m/s sprint per 1% net-worth deficit (10% deficit: +20%, +2 m/s)', async () => {
    const { sb, courier, escort, foe } = await landed();
    sb.hero(courier).progress.netWorth = 9_000;
    sb.hero(escort).progress.netWorth = 0;
    sb.hero(foe).progress.netWorth = 10_000;
    standBeside(sb, courier, eggOf(sb)!.pos);
    lightMelee(sb, courier);
    const f = sb.hero(courier).stats.final;
    expect(f.talonResist, '§7.11 +2% per 1% deficit').toBeCloseTo(0.2, 2);
    expect(f.songResist).toBeCloseTo(0.2, 2);
    expect(f.sprintSpeed).toBeCloseTo(2, 1);
  });

  it('§7.11 trailing carrier caps at +30% resist and +3 m/s at a 15% deficit', async () => {
    const { sb, courier, escort, foe } = await landed();
    sb.hero(courier).progress.netWorth = 1_000;
    sb.hero(escort).progress.netWorth = 0;
    sb.hero(foe).progress.netWorth = 10_000;
    standBeside(sb, courier, eggOf(sb)!.pos);
    lightMelee(sb, courier);
    const f = sb.hero(courier).stats.final;
    expect(f.talonResist).toBeCloseTo(0.3, 2);
    expect(f.sprintSpeed).toBeCloseTo(3, 1);
  });

  it('§7.11 drop on death: the Egg falls where the carrier died, an eggDropped event, nobody can take it for 1.0 s', async () => {
    const { sb, courier, escort, foe, egg } = await carried();
    const where = { ...sb.hero(courier).pos };
    sb.clearEvents();
    lethal(sb, foe, courier);
    sb.step();
    expect(egg.pickup.carrier).toBeNull();
    expect(objectiveEvents(sb, 'eggDropped')).toHaveLength(1);
    expect(flat(egg.pos, where), 'where it fell').toBeLessThan(2);
    expect(egg.pickup.claimableAt, '1.0 s lockout').toBeGreaterThanOrEqual(sb.sim.tick + DROP_LOCKOUT_S * TICK_RATE - 3);
    standBeside(sb, escort, egg.pos);
    lightMelee(sb, escort);
    advanceBy(sb, DROP_LOCKOUT_S + 0.2);
    standBeside(sb, escort, egg.pos);
    lightMelee(sb, escort);
    expect(egg.pickup.carrier, 'taken once the lockout ends').toBe(escort);
  });

  it('§7.11 drop: an enemy hero melee hit on the carrier knocks the Egg loose', async () => {
    const { sb, courier, foe, egg } = await carried();
    sb.place(foe, { x: sb.hero(courier).pos.x - 1, y: sb.hero(courier).pos.y, z: sb.hero(courier).pos.z }, Math.PI / 2);
    sb.aimAt(foe, sb.pointOf(courier));
    sb.step();
    lightMelee(sb, foe);
    expect(meleeHits(sb, foe, courier).length).toBeGreaterThan(0);
    expect(egg.pickup.carrier).toBeNull();
    expect(objectiveEvents(sb, 'eggDropped')).toHaveLength(1);
  });

  it('§7.11 drop: a stun drops the Egg', async () => {
    const { sb, courier, foe, egg } = await carried();
    sb.apply({ kind: 'applyStatus', status: { id: 'qa-stun', name: 'QA stun', negative: true, durationS: 1, stacking: 'perSource', maxStacks: 1,
      modifiers: { conditions: ['stunned'] } } }, courier, sb.cause(foe));
    sb.step(2);
    expect(egg.pickup.carrier).toBeNull();
  });

  it('§7.11 drop: the carrier pressing Melee sets the Egg down 1 m ahead (and is not a hit on anything)', async () => {
    const { sb, courier, egg } = await carried();
    const before = { ...sb.hero(courier).pos };
    sb.clearEvents();
    sb.press(courier, Button.Melee);
    sb.step(3);
    expect(egg.pickup.carrier).toBeNull();
    expect(flat(egg.pos, before), '1 m ahead').toBeCloseTo(1, 0);
    expect(objectiveEvents(sb, 'eggDropped')).toHaveLength(1);
  });

  it('§7.11 unattended: 180 s after landing with nobody taking it, it rolls toward its Hatching Stone at 2 m/s and can still be taken', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const [hero] = sb.heroes as [EntityId];
    advanceTo(sb, mmss(10, LANDING_S));
    const egg = eggOf(sb)!;
    const start = { ...egg.pos };
    advanceBy(sb, UNATTENDED_S - 5);
    expect(objectiveEvents(sb, 'eggRolling')).toHaveLength(0);
    advanceBy(sb, 6);
    expect(objectiveEvents(sb, 'eggRolling')).toHaveLength(1);
    const rolling = { ...egg.pos };
    advanceBy(sb, 5);
    expect(flat(egg.pos, rolling), '2 m/s over 5 s').toBeCloseTo(5 * ROLL_MS, 0);
    expect(flat(egg.pos, stone(sb).pos), 'closer to the Stone than it started').toBeLessThan(flat(start, stone(sb).pos));
    standBeside(sb, hero, egg.pos);
    lightMelee(sb, hero);
    expect(egg.pickup.carrier, 'a rolling Egg can still be picked up').toBe(hero);
  });

  it('§7.11 spoil: it starts to cool 45 s after its first pickup, falls linearly to 0 over the next 45 s, then cracks and is gone', async () => {
    const { sb, courier, egg } = await carried();
    const e0 = sb.ctx.objectives.egg!.value;
    expect(e0, 'E = 400 + 70 per minute when it landed').toBeCloseTo(valueAt(10), 0);
    advanceBy(sb, COOL_AFTER_S - 2);
    expect(sb.ctx.objectives.egg!.value).toBeCloseTo(e0, 0);
    advanceBy(sb, 2 + COOL_FOR_S / 2);
    expect(sb.ctx.objectives.egg!.value, 'halfway through the cooling').toBeCloseTo(e0 / 2, -1);
    advanceBy(sb, COOL_FOR_S / 2 + 1);
    expect(objectiveEvents(sb, 'eggSpoiled')).toHaveLength(1);
    expect(egg.removed || pickupsOf(sb, 'egg').length === 0, 'gone').toBe(true);
    expect(sb.hero(courier).stats.conditions.has('eggCarrier'), 'the carrier is released').toBe(false);
  });

  it('§7.11 deliver: entering the Hatching Stone circle (3 m) delivers automatically, no key; value E, six golden pods worth E/6', async () => {
    const { sb, courier, egg } = await carried();
    const e = sb.ctx.objectives.egg!.value;
    const s = stone(sb).pos;
    sb.place(courier, { x: s.x + STONE_RADIUS_M + 2, y: s.y, z: s.z });
    sb.step(3);
    expect(egg.pickup.carrier, 'outside the circle: still carried').toBe(courier);
    sb.place(courier, { x: s.x + STONE_RADIUS_M - 1, y: s.y, z: s.z });
    sb.step(3);
    const delivered = objectiveEvents(sb, 'eggDelivered');
    expect(delivered, 'D-EP-039 automatic delivery').toHaveLength(1);
    expect(delivered[0]!.value).toBeCloseTo(e, 0);
    const pods = pickupsOf(sb, 'pod');
    expect(pods, '§7.11 hatches into 6 pods').toHaveLength(6);
    for (const p of pods) expect(p.pickup.value).toBeGreaterThanOrEqual(Math.floor(e / 6) - 1);
  });

  it('§7.11 payout: the courier securing a pod keeps all of it; an enemy shooting one denies it for 25%', async () => {
    const { sb, courier, foe } = await carried();
    const e = sb.ctx.objectives.egg!.value;
    const s = stone(sb).pos;
    sb.place(courier, { x: s.x + 1, y: s.y, z: s.z });
    sb.step(3);
    const [secured, denied] = pickupsOf(sb, 'pod') as [ReturnType<typeof pickupsOf>[number], ReturnType<typeof pickupsOf>[number]];
    sb.clearEvents();
    advanceBy(sb, 0.8); // §8.2 rise 0.6 s, then ripe 1.4 s
    standBeside(sb, courier, secured.pos);
    lightMelee(sb, courier);
    expect(earned(sb, courier, 'egg'), 'courier secures: keeps all').toBeGreaterThanOrEqual(Math.floor(e / 6) - 1);
    sb.place(foe, { x: denied.pos.x - 1, y: denied.pos.y, z: denied.pos.z }, Math.PI / 2);
    sb.aimAt(foe, denied.pos);
    sb.step();
    lightMelee(sb, foe);
    expect(earned(sb, foe, 'egg'), 'enemy denies: 25%').toBeCloseTo(e / 6 / 4, -1);
  });

  it('§7.11 value ×1.25 when the delivering flock has the lower total net worth', async () => {
    const { sb, courier, foe, egg } = await carried();
    sb.hero(foe).progress.netWorth = 20_000;
    sb.hero(courier).progress.netWorth = 0;
    const e = sb.ctx.objectives.egg!.value;
    const s = stone(sb).pos;
    sb.place(courier, { x: s.x + 1, y: s.y, z: s.z });
    sb.step(3);
    expect(egg.removed || egg.pickup.carrier === null).toBe(true);
    expect(objectiveEvents(sb, 'eggDelivered')[0]!.value).toBeCloseTo(e * 1.25, 0);
  });

  it('§7.11 keepsakes: the courier gets 3, an escort within 30 m of the Stone gets 1, a far hero 0', async () => {
    const { sb, courier, escort, foe } = await carried();
    const s = stone(sb).pos;
    sb.place(escort, { x: s.x + 20, y: s.y, z: s.z });
    sb.place(foe, { x: s.x + 20, y: s.y, z: s.z + 2 });
    sb.place(courier, { x: s.x + 1, y: s.y, z: s.z });
    sb.step(3);
    expect(sb.hero(courier).keepsakes?.count).toBe(3);
    expect(sb.hero(escort).keepsakes?.count).toBe(1);
    expect(sb.hero(foe).keepsakes?.count ?? 0, 'the other flock gets none').toBe(0);
  });

  it('§7.11 next spawns: the 15:00 Egg is on the perch that did not hold the last Egg', async () => {
    const { sb, courier, egg } = await carried();
    const first = sb.ctx.objectives.egg!.perch;
    const s = stone(sb).pos;
    sb.place(courier, { x: s.x + 1, y: s.y, z: s.z });
    sb.step(3);
    advanceTo(sb, mmss(15, 1));
    expect(egg.removed || egg.pickup.carrier === null).toBe(true);
    expect(objectiveEvents(sb, 'eggSpawned').length).toBeGreaterThanOrEqual(2);
    expect(sb.ctx.objectives.egg!.perch, 'other perch').toBe(1 - first);
    expect(dist(eggOf(sb)!.pos, sb.ctx.map.eggPerches[1 - first]!.pos)).toBeLessThan(2);
  });

  it('§7.11 next spawns: while an Egg is carried or lying dropped, no new one spawns at the mark', async () => {
    const { sb, courier } = await carried();
    advanceTo(sb, mmss(15, 1));
    expect(sb.hero(courier).stats.conditions.has('eggCarrier') || pickupsOf(sb, 'egg').length <= 1).toBe(true);
    expect(pickupsOf(sb, 'egg').length, 'never two Eggs').toBeLessThanOrEqual(1);
  });
});
