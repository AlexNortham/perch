/**
 * Stage 4 objectives on the real map (GDD §§7.8–7.13). Claims by melee are driven with `melee` events as combat
 * reports them, so these check world's rules on their own; QA's tests/rules suites check the whole pipeline.
 */
import { describe, expect, it } from 'vitest';
import { Button } from '../core/contracts';
import type { EntityId, EventOf, PickupEntity, UnitEntity, Vec3 } from '../core/contracts';
import { TICK_RATE } from '../data/core';
import { EGG, EMBERS, KEEPSAKES, ROC, RUNES, THICKET_FAMILIES, THICKETS } from '../data/world';
import { createSandbox } from '../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../tests/helpers/sandbox';
import { advanceBy, advanceTo, mmss, pickupsOf, seconds, world } from '../../../tests/helpers/world';

const T = 120_000;
const flat = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);
/** A melee hit as combat reports it, then one step so its effects and events land. */
const melee = (sb: Sandbox, attacker: EntityId, target: EntityId, heavy = false): void => {
  sb.ctx.bus.emit({ type: 'melee', attacker, heavy, target, parried: false });
  sb.step();
};
const hit = (sb: Sandbox, source: EntityId, target: EntityId, amount: number): void =>
  sb.apply({ kind: 'damage', amount, type: 'song' }, target, sb.cause(source, { via: 'weapon' }));
/** Max HP far above anything a test meets, with current HP filled to it. */
const tough = (sb: Sandbox, id: EntityId): void => {
  sb.modify(id, 'test-hp', { stats: [{ stat: 'maxHealth', op: 'add', value: 1_000_000 }] });
  sb.apply({ kind: 'heal', amount: 1_000_000 }, id, sb.cause(null));
};
const DAWN_PAIR = ['shrike', { hero: 'kingfisher', team: 'dawn' }, 'lyrebird'] as const;

/** Objective events straight from the bus: the sim's step log drops what a test's own `melee` events cause. */
const logs = new WeakMap<Sandbox, EventOf<'objective'>[]>();
async function open(spec: Parameters<typeof world>[0]): Promise<Sandbox> {
  const sb = await world(spec);
  const log: EventOf<'objective'>[] = [];
  logs.set(sb, log);
  sb.ctx.bus.on('objective', (e) => log.push(e));
  return sb;
}
const seen = (sb: Sandbox, action: EventOf<'objective'>['action']): EventOf<'objective'>[] =>
  logs.get(sb)!.filter((e) => e.action === action);

describe('Feather runes (GDD §7.10)', () => {
  it('spawn at 5:00 on both spots with two types, the 10:00 complement, and claim by heavy melee only', async () => {
    const sb = await open({ heroes: ['shrike', 'lyrebird'] });
    const hero = sb.heroes[0]!;
    advanceTo(sb, mmss(4, 58));
    expect(sb.ctx.objectives.runesAt).toBe(mmss(5) * TICK_RATE);
    advanceTo(sb, mmss(5, 1));
    const first = pickupsOf(sb, 'rune');
    expect(first).toHaveLength(2);
    expect(new Set(first.map((r) => r.pickup.variant)).size).toBe(2);
    expect(first.every((r) => r.pickup.melee === 'heavy')).toBe(true);

    const [a] = first as [PickupEntity];
    const base = sb.hero(hero).stats.final.fireRate;
    melee(sb, hero, a.id, false);
    expect(seen(sb, 'runeTaken'), 'a light hit does not claim').toHaveLength(0);
    melee(sb, hero, a.id, true);
    expect(seen(sb, 'runeTaken')).toMatchObject([{ hero, variant: a.pickup.variant }]);
    expect(a.removed).toBe(true);
    const rune = sb.hero(hero).statuses.find((s) => s.def.id === 'rune')!;
    expect(rune.expiresAt - sb.sim.tick).toBeCloseTo(RUNES.durationS * TICK_RATE, -1);
    if (a.pickup.variant === 'fierce') expect(sb.hero(hero).stats.final.fireRate - base).toBeCloseTo(0.12, 2);

    advanceTo(sb, mmss(10, 1));
    const second = pickupsOf(sb, 'rune').map((r) => r.pickup.variant).sort();
    const all = Object.keys(RUNES.types);
    expect(second).toEqual(all.filter((t) => !first.some((r) => r.pickup.variant === t)).sort());
  }, T);
});

describe('the Golden Egg (GDD §7.11)', () => {
  it('lands at 10:10, is taken by melee, set down by its own Melee, knocked loose by an enemy, and delivered at the Stone', async () => {
    const sb = await open({ heroes: [...DAWN_PAIR] });
    const [courier, escort, foe] = sb.heroes as [EntityId, EntityId, EntityId];
    expect(sb.ctx.objectives.eggAt).toBe(mmss(10) * TICK_RATE);
    advanceTo(sb, mmss(10, 1));
    const egg = pickupsOf(sb, 'egg')[0]!;
    const { perch } = sb.ctx.objectives.egg!;
    expect(flat(egg.pos, sb.ctx.map.eggPerches[perch]!.pos)).toBeLessThan(0.1);
    expect(egg.pickup.claimableAt).toBe((mmss(10) + EGG.lowerS) * TICK_RATE);
    melee(sb, courier, egg.id);
    expect(egg.pickup.carrier, 'still lowering').toBeNull();

    advanceTo(sb, mmss(10, 11));
    const free = { ...sb.hero(courier).stats.final };
    melee(sb, courier, egg.id);
    expect(egg.pickup.carrier).toBe(courier);
    const c = sb.hero(courier);
    expect(c.stats.conditions.has('eggCarrier') && c.stats.conditions.has('revealed')).toBe(true);
    expect(c.stats.final.moveSpeed - free.moveSpeed).toBeCloseTo(EGG.carrier.moveSpeed, 5);
    expect(c.stats.final.stamina - free.stamina).toBe(EGG.carrier.stamina);
    expect(sb.ctx.objectives.egg!.value, 'E = 400 + 70 × whole minutes at landing').toBe(1100);

    const at = { ...c.pos };
    sb.press(courier, Button.Melee);
    sb.step();
    expect(egg.pickup.carrier).toBeNull();
    expect(flat(egg.pos, at)).toBeCloseTo(EGG.setDownM, 1);
    expect(sb.hero(courier).stats.conditions.has('eggCarrier')).toBe(false);
    melee(sb, escort, egg.id);
    expect(egg.pickup.carrier, '1 s lockout after a drop').toBeNull();
    advanceBy(sb, EGG.dropLockoutS + 0.1);
    melee(sb, escort, egg.id);
    expect(egg.pickup.carrier).toBe(escort);
    melee(sb, foe, escort);
    expect(egg.pickup.carrier, 'an enemy hero melee hit knocks it loose').toBeNull();

    advanceBy(sb, EGG.dropLockoutS + 0.1);
    melee(sb, courier, egg.id);
    const stone = sb.ctx.map.eggPerches[1 - perch]!.pos;
    sb.place(escort, { x: stone.x + 10, y: stone.y, z: stone.z });
    sb.place(courier, { x: stone.x + 1, y: stone.y, z: stone.z });
    sb.step();
    const done = seen(sb, 'eggDelivered');
    expect(done).toHaveLength(1);
    expect(done[0]!.value, 'Dawn leads in net worth: no ×1.25').toBe(1100);
    expect(egg.removed).toBe(true);
    expect(sb.hero(courier).keepsakes?.count).toBe(EGG.keepsakes.courier);
    expect(sb.hero(escort).keepsakes?.count).toBe(EGG.keepsakes.escort);
    expect(sb.hero(foe).keepsakes).toBeUndefined();
    expect(sb.ctx.objectives.eggAt, 'the next mark').toBe(mmss(15) * TICK_RATE);

    advanceTo(sb, mmss(15, 1));
    expect(sb.ctx.objectives.egg!.perch).toBe(1 - perch);
    expect(flat(pickupsOf(sb, 'egg')[0]!.pos, stone)).toBeLessThan(0.1);
  }, T);

  it('rolls toward its Stone at 2 m/s when left alone, drops on a stun and on death, and cools to nothing', async () => {
    const sb = await open({ heroes: [...DAWN_PAIR] });
    const [courier, , foe] = sb.heroes as [EntityId, EntityId, EntityId];
    advanceTo(sb, mmss(10, 11));
    const egg = pickupsOf(sb, 'egg')[0]!;
    const stone = sb.ctx.map.eggPerches[1 - sb.ctx.objectives.egg!.perch]!.pos;
    const rollsAt = sb.ctx.objectives.egg!.rollsAt!;
    expect(rollsAt).toBe((mmss(10) + EGG.lowerS + EGG.unattendedS) * TICK_RATE);
    advanceTo(sb, rollsAt / TICK_RATE + 0.1);
    expect(seen(sb, 'eggRolling')).toHaveLength(1);
    const from = { ...egg.pos };
    advanceBy(sb, 3);
    expect(Math.hypot(egg.pos.x - from.x, egg.pos.y - from.y, egg.pos.z - from.z)).toBeLessThanOrEqual(3 * EGG.rollSpeed + 0.01);
    expect(flat(egg.pos, stone)).toBeLessThan(flat(from, stone) - 3);

    sb.place(courier, egg.pos);
    melee(sb, courier, egg.id);
    expect(egg.pickup.carrier, 'a rolling Egg can still be taken').toBe(courier);
    sb.apply({ kind: 'applyStatus', status: { id: 'test-stun', name: 'Stun', negative: true, durationS: 0.5, stacking: 'max', maxStacks: 1,
      modifiers: { conditions: ['stunned'] } } }, courier, sb.cause(foe));
    sb.step();
    expect(egg.pickup.carrier, 'a stun drops it').toBeNull();
    advanceBy(sb, 1.5);
    melee(sb, courier, egg.id);
    sb.apply({ kind: 'damage', amount: 1_000_000, type: 'talon' }, courier, sb.cause(foe, { via: 'weapon' }));
    sb.step();
    expect(egg.pickup.carrier, 'death drops it').toBeNull();
    expect(seen(sb, 'eggDropped')).toHaveLength(2);
    expect(sb.ctx.objectives.egg!.rollsAt! - sb.sim.tick).toBeCloseTo(EGG.unattendedS * TICK_RATE, -1);

    const cools = sb.ctx.objectives.egg!.coolsAt!;
    advanceTo(sb, cools / TICK_RATE + EGG.coolForS / 2);
    expect(sb.ctx.objectives.egg!.value).toBeCloseTo(550, -1);
    advanceTo(sb, cools / TICK_RATE + EGG.coolForS + 0.1);
    expect(seen(sb, 'eggSpoiled')).toHaveLength(1);
    expect(egg.removed).toBe(true);
  }, T);
});

describe('the Roc, Embers and Rekindle (GDD §7.12)', () => {
  const FLOOR: Vec3 = { x: -14, y: -10, z: 0 };
  const roc = (sb: Sandbox): UnitEntity | undefined => sb.ctx.store.list('unit').find((u) => u.unit.type === 'roc');

  it('sleeps invulnerable until 20:00, fights only heroes in the Hollow, enrages, and drops three Embers that grant Rekindle', async () => {
    const sb = await open({ heroes: [...DAWN_PAIR] });
    const [a, b, foe] = sb.heroes as [EntityId, EntityId, EntityId];
    sb.step();
    expect(roc(sb)!.unit.asleep).toBe(true);
    expect(roc(sb)!.stats.conditions.has('invulnerable')).toBe(true);
    advanceTo(sb, mmss(20, 1));
    const r = roc(sb)!;
    expect(r.unit.asleep).toBe(false);
    expect(r.stats.conditions.has('invulnerable')).toBe(false);
    expect(seen(sb, 'rocSpawned')).toHaveLength(1);
    expect(r.unit.damageFrom).toMatchObject({ maxY: ROC.hollowMaxY });

    sb.clearEvents();
    advanceBy(sb, 3);
    expect(sb.eventsOf('unit.attack'), 'nobody in the Hollow').toHaveLength(0);
    tough(sb, a);
    sb.place(a, FLOOR);
    advanceBy(sb, 6);
    const rakes = sb.eventsOf('unit.attack').filter((e) => e.attack === 'rake');
    expect(rakes.length).toBeGreaterThanOrEqual(2);
    expect((rakes[1]!.impactAt - rakes[0]!.impactAt) / TICK_RATE).toBeCloseTo(ROC.rake.everyS, 1);
    expect(sb.eventsOf('unit.attack').some((e) => e.attack === 'flap')).toBe(true);
    expect(sb.eventsOf('damage.applied').some((e) => e.source === r.id && e.target === a)).toBe(true);

    hit(sb, a, r.id, r.health.hp - r.stats.final.maxHealth * 0.2);
    sb.step(2);
    expect(r.unit.enraged).toBe(true);
    expect(sb.eventsOf('unit.state').filter((e) => e.state === 'enraged')).toHaveLength(1);
    sb.clearEvents();
    advanceBy(sb, 9);
    expect(sb.eventsOf('unit.attack').filter((e) => e.attack === 'shriek').length).toBeGreaterThanOrEqual(1);
    expect(sb.eventsOf('status.applied').some((e) => e.target === a && e.source === r.id)).toBe(true);

    hit(sb, a, r.id, 1_000_000);
    sb.step(2);
    expect(roc(sb)).toBeUndefined();
    const died = sb.sim.tick;
    expect(sb.ctx.objectives.rocAt! - died).toBeLessThanOrEqual(ROC.respawnS[0] * TICK_RATE);
    expect(sb.ctx.objectives.rocAt! - died).toBeGreaterThan(ROC.respawnS[0] * TICK_RATE - 3);
    expect(sb.hero(a).keepsakes?.count).toBe(ROC.reward.keepsakes);
    expect(sb.hero(b).keepsakes?.count).toBe(ROC.reward.keepsakes);
    expect(sb.hero(foe).keepsakes).toBeUndefined();
    const embers = pickupsOf(sb, 'ember');
    expect(embers).toHaveLength(3);
    for (const s of EMBERS.spots) expect(embers.some((e) => flat(e.pos, s) < 0.1)).toBe(true);

    melee(sb, a, embers[0]!.id, true);
    expect(seen(sb, 'emberClaimed'), 'still falling').toHaveLength(0);
    advanceBy(sb, EMBERS.fallS);
    expect(seen(sb, 'emberDropped')).toHaveLength(3);
    hit(sb, foe, a, 100);
    sb.step();
    melee(sb, a, embers[0]!.id, false);
    melee(sb, a, embers[0]!.id, true);
    expect(seen(sb, 'emberClaimed')).toHaveLength(1);
    expect(sb.health(a).hp).toBe(sb.hero(a).stats.final.maxHealth);
    const claimedAt = sb.sim.tick - 1; // the claim landed before the helper's step
    expect(sb.ctx.teams.dawn.rekindle).toEqual({ until: claimedAt + EMBERS.rekindleS * TICK_RATE, charges: 1 });
    melee(sb, b, embers[1]!.id, true);
    melee(sb, foe, embers[2]!.id, true);
    expect(sb.ctx.teams.dawn.rekindle!.charges).toBe(2);
    expect(sb.ctx.teams.dusk.rekindle!.charges, 'either flock may claim').toBe(1);

    sb.ctx.bus.emit({ type: 'entity.died', victim: b, victimKind: 'hero', victimTeam: 'dawn', victimType: 'kingfisher', killer: foe,
      creditHero: foe, assisters: [], via: 'weapon', pos: { ...sb.hero(b).pos }, revives: true });
    expect(sb.ctx.teams.dawn.rekindle!.charges, 'a revive spends a charge').toBe(1);
    advanceTo(sb, (claimedAt / TICK_RATE) + EMBERS.rekindleS + 0.1);
    expect(sb.ctx.teams.dawn.rekindle, 'ends after 180 s').toBeUndefined();
    advanceTo(sb, sb.ctx.objectives.rocAt! / TICK_RATE + 0.1);
    expect(roc(sb)?.unit.asleep).toBe(false);
  }, T);

  it('heals to full after 8 s with nobody in the Hollow', async () => {
    const sb = await open({ heroes: ['shrike', 'lyrebird'] });
    const a = sb.heroes[0]!;
    advanceTo(sb, mmss(20, 1));
    const r = roc(sb)!;
    tough(sb, a);
    sb.place(a, FLOOR);
    sb.step();
    hit(sb, a, r.id, 10_000);
    sb.step();
    sb.place(a, { x: 0, y: 0, z: 30 });
    advanceBy(sb, ROC.resetS - 1);
    expect(r.health.hp).toBeLessThan(r.stats.final.maxHealth - 5_000);
    advanceBy(sb, 1.5);
    expect(r.health.hp).toBe(r.stats.final.maxHealth);
  }, T);
});

describe('Thickets (GDD §7.8)', () => {
  it('spawn asleep at 2:00, wake at 30 m, fight, leash home, sleep again and respawn 1:30 after a full clear', async () => {
    const sb = await open({ heroes: ['shrike', 'lyrebird'] });
    const hero = sb.heroes[0]!;
    const index = sb.ctx.map.thickets.findIndex((a) => a.tier === 1);
    const anchor = sb.ctx.map.thickets[index]!;
    const units = (): UnitEntity[] => sb.ctx.store.list('unit').filter((u) => u.unit.camp === index);
    sb.place(hero, { x: anchor.pos.x + 45, y: anchor.pos.y, z: anchor.pos.z });
    advanceTo(sb, THICKET_FAMILIES.beetles.firstS - 2);
    expect(units()).toHaveLength(0);
    expect(sb.ctx.objectives.campAt![index]).toBe(THICKET_FAMILIES.beetles.firstS * TICK_RATE);
    advanceTo(sb, THICKET_FAMILIES.beetles.firstS + 1);
    expect(units()).toHaveLength(3);
    for (const u of units()) {
      expect(u.unit.asleep).toBe(true);
      expect(u.unit.damageFrom?.radius).toBe(THICKETS.snipeM);
      expect(u.stats.final.maxHealth).toBeCloseTo(200 * (1 + THICKETS.hpPerMinute * 2), 5);
      expect(u.stats.final.talonResist).toBeCloseTo(0.3, 5);
    }

    tough(sb, hero);
    sb.place(hero, { x: anchor.pos.x + 25, y: anchor.pos.y, z: anchor.pos.z });
    sb.step(2);
    expect(units().every((u) => !u.unit.asleep && u.unit.damageFrom === null)).toBe(true);
    sb.place(hero, { x: anchor.pos.x + 3, y: anchor.pos.y, z: anchor.pos.z });
    sb.step();
    sb.clearEvents();
    hit(sb, hero, units()[0]!.id, 50);
    advanceBy(sb, 4);
    const bites = sb.eventsOf('damage.applied').filter((e) => e.target === hero && units().some((u) => u.id === e.source));
    expect(bites.length).toBeGreaterThanOrEqual(6);
    expect(bites[0]!.amount).toBeCloseTo(12 * (1 + THICKETS.damagePerMinute * 2), 1);

    sb.place(hero, { x: anchor.pos.x + 45, y: anchor.pos.y, z: anchor.pos.z });
    advanceBy(sb, 8);
    for (const u of units()) expect(flat(u.pos, anchor.pos)).toBeLessThan(THICKETS.leashM + THICKETS.chaseM + 1);
    advanceBy(sb, 6);
    for (const u of units()) expect(u.health.hp).toBe(u.stats.final.maxHealth);
    advanceBy(sb, THICKETS.sleepS + 1);
    expect(units().every((u) => u.unit.asleep)).toBe(true);

    for (const u of units()) hit(sb, hero, u.id, 1_000_000);
    sb.step(2);
    expect(seen(sb, 'campCleared')).toMatchObject([{ camp: index, hero }]);
    const cleared = seconds(sb);
    advanceTo(sb, cleared + THICKET_FAMILIES.beetles.respawnS - 2);
    expect(units()).toHaveLength(0);
    advanceTo(sb, cleared + THICKET_FAMILIES.beetles.respawnS + 1);
    expect(units()).toHaveLength(3);
  }, T);

  it('fledglings and creatures ignore each other', async () => {
    const sb = await createSandbox({ map: 'main', heroes: [], options: { waves: true, neutrals: true } });
    advanceTo(sb, mmss(3));
    expect(sb.eventsOf('damage.applied').some((e) => {
      const a = sb.ctx.store.get(e.source ?? -1);
      const b = sb.ctx.store.get(e.target);
      return a?.kind === 'unit' && b?.kind === 'unit' && (a.team === 'neutral') !== (b.team === 'neutral');
    })).toBe(false);
  }, T);
});

describe('Nests (GDD §7.9)', () => {
  it('spawn at 3:00 without colliders, break on a hit or a fast pass, and return 3:00 after the break or after their drop is collected', async () => {
    const sb = await open({ heroes: ['shrike', 'lyrebird'], seed: 3 });
    const hero = sb.heroes[0]!;
    const nests = () => sb.ctx.store.list('structure').filter((s) => s.structure.type === 'nest' && !s.removed);
    advanceTo(sb, mmss(2, 59));
    expect(nests()).toHaveLength(0);
    advanceTo(sb, mmss(3, 1));
    expect(nests()).toHaveLength(sb.ctx.map.nests.length);
    for (const n of nests()) expect(n.structure).toMatchObject({ variant: 'twig', solid: false, breakable: { by: 'any' } });

    const fast = nests()[0]!;
    sb.place(hero, { x: fast.pos.x - 3, y: fast.pos.y, z: fast.pos.z }, Math.PI / 2);
    sb.modify(hero, 'test-speed', { stats: [{ stat: 'moveSpeed', op: 'add', value: 6 }] });
    sb.move(hero, 1);
    sb.step(TICK_RATE);
    sb.move(hero, 0);
    sb.modify(hero, 'test-speed', null);
    expect(fast.health.dead, 'run through at 13 m/s').toBe(true);

    for (const n of nests()) hit(sb, hero, n.id, 10);
    sb.step(2);
    expect(nests()).toHaveLength(0);
    const crumbs = pickupsOf(sb, 'crumb');
    expect(crumbs.length, 'about 15% of the Twig Nests drop a crumb').toBeGreaterThan(0);
    expect(crumbs.length).toBeLessThan(sb.ctx.map.nests.length / 2);
    expect(pickupsOf(sb, 'keepsake'), 'Twig Nests drop no keepsakes').toHaveLength(0);
    const crumb = crumbs[0]!;
    const index = sb.ctx.map.nests.findIndex((a) => flat(a.pos, crumb.pos) < 0.1);
    const brokeAt = seconds(sb);
    sb.place(hero, { x: 0, y: 0, z: -100 });
    advanceTo(sb, brokeAt + 185);
    expect(nests().some((n) => n.structure.anchor === index), 'its crumb still lies there').toBe(false);
    expect(nests().length, 'the others are back').toBeGreaterThan(0);
    sb.place(hero, { x: crumb.pos.x, y: crumb.pos.y - 0.3, z: crumb.pos.z });
    sb.step(2);
    expect(crumb.removed).toBe(true);
    expect(sb.hero(hero).statuses.some((s) => s.def.id === 'crumb')).toBe(true);
    const collected = seconds(sb);
    sb.place(hero, { x: 0, y: 0, z: -100 });
    advanceTo(sb, collected + 178);
    expect(nests().some((n) => n.structure.anchor === index)).toBe(false);
    advanceTo(sb, collected + 181);
    expect(nests().some((n) => n.structure.anchor === index)).toBe(true);
  }, T);
});

describe('keepsakes (GDD §7.13)', () => {
  it('draw weighted types from the bucket, cap per stat, publish one source, survive death', async () => {
    const sb = await open({ heroes: ['shrike', 'lyrebird'] });
    const [hero, foe] = sb.heroes as [EntityId, EntityId];
    advanceTo(sb, mmss(35));
    for (let i = 0; i < 400; i++) {
      sb.ctx.store.spawn({ kind: 'pickup', team: 'neutral', pos: { ...sb.hero(hero).pos }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, radius: 0.4,
        pickup: { type: 'keepsake', variant: '', value: 0, expiresAt: null, carrier: null } });
    }
    sb.step();
    const k = sb.hero(hero).keepsakes!;
    expect(k.count).toBe(400);
    expect(k.totals.talonResist).toBeCloseTo(KEEPSAKES.caps.talonResist!, 6);
    expect(k.totals.cooldownReduction).toBeCloseTo(KEEPSAKES.caps.cooldownReduction!, 6);
    expect(k.totals.maxHealth! % 35).toBeCloseTo(0, 6);
    const mods = sb.hero(hero).stats.sources.get('world:keepsakes')!.stats!;
    expect(new Set(mods.map((m) => m.stat)).size).toBe(mods.length);
    expect(seen(sb, 'keepsakeGained')).toHaveLength(400);
    sb.apply({ kind: 'damage', amount: 1_000_000, type: 'talon' }, hero, sb.cause(foe, { via: 'weapon' }));
    sb.step();
    expect(sb.hero(hero).keepsakes!.count).toBe(400);
    expect(sb.hero(hero).stats.sources.has('world:keepsakes')).toBe(true);
  }, T);
});

describe('siege flight (GDD §7.12)', () => {
  it('fledglings spawned while their flock holds Rekindle get +40% HP and +30% damage against structures', async () => {
    const sb = await createSandbox({ map: 'main', heroes: [], options: { waves: true, neutrals: false } });
    sb.ctx.teams.dawn.rekindle = { until: 10 * TICK_RATE * 60, charges: 1 };
    advanceTo(sb, 31);
    const dawn = sb.ctx.store.list('unit').filter((u) => u.team === 'dawn' && u.unit.type === 'scrapper');
    const dusk = sb.ctx.store.list('unit').filter((u) => u.team === 'dusk' && u.unit.type === 'scrapper');
    expect(dawn[0]!.stats.final.maxHealth / dusk[0]!.stats.final.maxHealth).toBeCloseTo(1 + EMBERS.siegeFlight.hp, 5);
    expect(dawn[0]!.health.hp / dusk[0]!.health.hp).toBeCloseTo(1 + EMBERS.siegeFlight.hp, 1);
  }, T);
});
