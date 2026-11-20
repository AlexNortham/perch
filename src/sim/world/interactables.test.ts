/**
 * Stage 4 interactables and indoor camps on fixture maps (GDD §§6.8, 7.8, 7.9, 7.14, 7.15): the flat arena plus the
 * anchors under test, with world's parts created on that map and stepped after each sandbox step. The real map's
 * anchors come from the Level Designer; QA's tests/rules suites cover them there.
 */
import { describe, expect, it } from 'vitest';
import type { EntityId, EventOf, MapData, StructureEntity, UnitEntity, Vec3 } from '../core/contracts';
import { canSee } from '../core/vision';
import { TICK_RATE } from '../data/core';
import { CREATURES, FEEDERS, INTERACTABLES, NEST_RULES, NESTS, THICKET_FAMILIES } from '../data/world';
import { createSandbox } from '../../../tests/helpers/sandbox';
import type { Sandbox } from '../../../tests/helpers/sandbox';
import { createHides } from './hides';
import { createKeepsakes } from './keepsakes';
import { createGranary, createNests } from './nests';
import { createPickups } from './pickups';
import { createThickets } from './thickets';
import { createVision } from './vision';

const T = 60_000;
type Fixture = Partial<Pick<MapData, 'thickets' | 'nests' | 'interactables' | 'rooms' | 'buildings' | 'prims' | 'hollow'>>;
type Heroes = Parameters<typeof createSandbox>[0]['heroes'];

async function fixture(map: Fixture, heroes: Heroes = ['shrike', 'lyrebird']) {
  const sb = await createSandbox({ map: 'arena', heroes, options: { neutrals: false } });
  const ctx = { ...sb.ctx, map: { ...sb.ctx.map, ...map } };
  const keepsakes = createKeepsakes(ctx);
  const granary = createGranary(ctx);
  const thickets = createThickets(ctx, granary);
  const nests = createNests(ctx, keepsakes, granary);
  const pickups = createPickups(ctx, keepsakes);
  const hides = createHides(ctx);
  const vision = createVision(ctx, hides);
  const log: EventOf<'objective'>[] = [];
  // World's parts run after each sandbox step here, so their events miss the step log: listen on the bus.
  const attacks: EventOf<'unit.attack'>[] = [];
  ctx.bus.on('unit.attack', (e) => attacks.push(e));
  ctx.bus.on('objective', (e) => log.push(e));
  const step = (n = 1): void => {
    for (let i = 0; i < n; i++) {
      sb.step();
      thickets.steer();
      hides.update();
      vision.update();
      thickets.update();
      nests.update();
      pickups.update();
    }
  };
  const seen = (action: EventOf<'objective'>['action']) => log.filter((e) => e.action === action);
  return { sb, ctx, step, seen, attacks };
}

const melee = (sb: Sandbox, attacker: EntityId, target: EntityId, heavy = false): void =>
  sb.ctx.bus.emit({ type: 'melee', attacker, heavy, target, parried: false });
const hit = (sb: Sandbox, source: EntityId, target: EntityId, amount: number): void =>
  sb.apply({ kind: 'damage', amount, type: 'talon' }, target, sb.cause(source, { via: 'weapon' }));
const tough = (sb: Sandbox, id: EntityId): void => {
  sb.modify(id, 'test-hp', { stats: [{ stat: 'maxHealth', op: 'add', value: 1_000_000 }] });
  sb.apply({ kind: 'heal', amount: 1_000_000 }, id, sb.cause(null));
};
const box = (centre: Vec3, size: Vec3) => ({ centre, size, yaw: 0 });

describe('Bell Feeders and the Granary (GDD §7.14)', () => {
  const map: Fixture = {
    interactables: [{ kind: 'feeder', pos: { x: 3, y: 0, z: 0 }, yaw: 0, camp: 0 }],
    thickets: [{ tier: 2, family: 'rats', pos: { x: -20, y: 0, z: 20 }, yaw: 0 }],
  };

  it('swing back for 70 Song until the chime, blink on a seeded beat, and give keepsakes for a lit breaking hit', async () => {
    const { sb, ctx, step } = await fixture(map);
    const hero = sb.heroes[0]!;
    tough(sb, hero);
    ctx.objectives.interactableAt![0] = sb.sim.tick + 1;
    step(2);
    const f = sb.ctx.store.list('structure').find((s) => s.structure.variant === 'feeder')!;
    expect(f.stats.final.maxHealth).toBe(FEEDERS.hp);
    expect(f.structure).toMatchObject({ type: 'nest', anchor: 0, solid: false, breakable: { by: 'melee', light: FEEDERS.light, heavy: FEEDERS.heavy } });

    sb.clearEvents();
    melee(sb, hero, f.id);
    step();
    const back = sb.eventsOf('damage.applied').filter((e) => e.target === hero && e.source === f.id);
    expect(back).toHaveLength(1);
    expect(back[0]).toMatchObject({ damageType: 'song' });
    expect(back[0]!.amount).toBeCloseTo(FEEDERS.swingBack * (1 - sb.hero(hero).stats.final.songResist), 5);

    hit(sb, hero, f.id, f.health.hp - FEEDERS.chimeHp);
    step(2);
    expect(f.health.hp).toBe(FEEDERS.chimeHp);
    sb.clearEvents();
    melee(sb, hero, f.id);
    step();
    expect(sb.eventsOf('damage.applied').filter((e) => e.target === hero), 'no swing-back while it chimes').toHaveLength(0);
    let lit = 0;
    for (let i = 0; i < 6 * TICK_RATE; i++) {
      step();
      if (f.structure.lit) lit++;
    }
    const share = lit / (6 * TICK_RATE);
    expect(FEEDERS.beats.some((b) => Math.abs(share - b.litS / b.everyS) < 0.02), `lit ${share.toFixed(3)}`).toBe(true);

    for (let i = 0; i < 2 * TICK_RATE && !f.structure.lit; i++) step();
    melee(sb, hero, f.id, true);
    hit(sb, hero, f.id, 10_000);
    step();
    expect(f.health.dead).toBe(true);
    expect(sb.hero(hero).keepsakes?.count, 'a heavy hit on the beat').toBe(FEEDERS.keepsakes.heavy);
    expect(ctx.objectives.interactableAt![0], 'a Granary Feeder waits for its Rats').toBeNull();
  }, T);

  it('an off-beat break pays no keepsakes; the Feeder and its Rats return together once both are down', async () => {
    const { sb, ctx, step, seen } = await fixture(map);
    const hero = sb.heroes[0]!;
    ctx.objectives.interactableAt![0] = sb.sim.tick + 1;
    ctx.objectives.campAt![0] = sb.sim.tick + 1;
    step(2);
    const f = sb.ctx.store.list('structure').find((s) => s.structure.variant === 'feeder')!;
    hit(sb, hero, f.id, f.health.hp - FEEDERS.chimeHp);
    step(2);
    for (let i = 0; i < 2 * TICK_RATE && f.structure.lit; i++) step();
    melee(sb, hero, f.id);
    hit(sb, hero, f.id, 10_000);
    step();
    expect(f.health.dead).toBe(true);
    expect(sb.hero(hero).keepsakes).toBeUndefined();

    const rats = sb.ctx.store.list('unit').filter((u) => u.unit.camp === 0);
    expect(rats).toHaveLength(5);
    for (const r of rats) hit(sb, hero, r.id, 1_000_000);
    step(2);
    const down = sb.sim.tick - 1;
    expect(seen('campCleared')).toHaveLength(1);
    expect(ctx.objectives.campAt![0]).toBe(down + THICKET_FAMILIES.rats.respawnS * TICK_RATE);
    expect(ctx.objectives.interactableAt![0]).toBe(down + FEEDERS.respawnS * TICK_RATE);
  }, T);
});

describe('Berries (GDD §7.15)', () => {
  it('are eaten within 1.2 m for 15% of max HP over 4 s and return 3:00 later', async () => {
    const { sb, ctx, step, seen } = await fixture({ interactables: [{ kind: 'berry', pos: { x: 0, y: 0.4, z: 5 }, yaw: 0 }] });
    const [hero, foe] = sb.heroes as [EntityId, EntityId];
    expect(ctx.objectives.interactableAt![0]).toBe(INTERACTABLES.berry.firstS * TICK_RATE);
    ctx.objectives.interactableAt![0] = sb.sim.tick + 1;
    step(2);
    const berry = sb.ctx.store.list('pickup').find((p) => p.pickup.type === 'berry')!;
    const max = sb.hero(hero).stats.final.maxHealth;
    hit(sb, foe, hero, max * 0.5);
    sb.place(hero, { x: 0, y: 0, z: 3 });
    step(2);
    expect(berry.removed, 'not from 2 m').toBe(false);
    const hurt = sb.health(hero).hp;
    sb.place(hero, { x: 0, y: 0, z: 3.9 });
    step(2);
    expect(seen('berryEaten')).toMatchObject([{ hero }]);
    step(4 * TICK_RATE + 2);
    expect(sb.health(hero).hp - hurt).toBeCloseTo(max * INTERACTABLES.berry.healFraction, 5);
    expect(ctx.objectives.interactableAt![0]! - sb.sim.tick).toBeCloseTo(INTERACTABLES.berry.respawnS * TICK_RATE - 4 * TICK_RATE - 4, -1);
  }, T);
});

describe('Hides, Lookouts and ivy (GDD §§6.8, 7.15)', () => {
  it('a hero wholly inside a Hide is hidden from enemies outside, shows for 2 s after hurting one, and regenerates', async () => {
    const hide = { building: -1, storey: 0, volume: box({ x: 0, y: 1.5, z: -10 }, { x: 6, y: 3, z: 6 }), tag: 'hide' as const };
    const { sb, step } = await fixture({ rooms: [hide] }, ['shrike', { hero: 'kingfisher', team: 'dawn' }, 'lyrebird']);
    const [hero, ally, foe] = sb.heroes as [EntityId, EntityId, EntityId];
    sb.place(hero, { x: 0, y: 0, z: -10 });
    sb.place(ally, { x: 10, y: 0, z: -10 });
    sb.place(foe, { x: 0, y: 0, z: 5 });
    step(3);
    expect(sb.hero(hero).stats.conditions.has('hidden')).toBe(true);
    expect(canSee('dusk', sb.hero(hero))).toBe(false);
    expect(canSee('dawn', sb.hero(hero))).toBe(true);
    expect(canSee('dusk', sb.hero(ally)), 'the ally outside is in plain sight').toBe(true);

    hit(sb, hero, foe, 10);
    step();
    expect(canSee('dusk', sb.hero(hero)), 'shown after hurting an enemy').toBe(true);
    step(Math.ceil((INTERACTABLES.hide.showS + 0.2) * TICK_RATE));
    expect(canSee('dusk', sb.hero(hero))).toBe(false);
    sb.place(foe, { x: 1, y: 0, z: -9 });
    step(2);
    expect(canSee('dusk', sb.hero(hero)), 'an enemy in the same Hide').toBe(true);

    sb.place(foe, { x: 0, y: 0, z: 5 });
    hit(sb, foe, hero, 300);
    step(Math.ceil((INTERACTABLES.hide.showS + 0.2) * TICK_RATE));
    const hp = sb.health(hero).hp;
    step(10 * TICK_RATE);
    const max = sb.hero(hero).stats.final.maxHealth;
    expect(sb.health(hero).hp - hp).toBeCloseTo(10 * (INTERACTABLES.hide.regen + INTERACTABLES.hide.regenMaxHp * max), 3);
    sb.place(hero, { x: 0, y: 0, z: -20 });
    step();
    expect(sb.hero(hero).stats.conditions.has('hidden')).toBe(false);
  }, T);

  it('a Lookout raises sight to 60 m; an ivy curtain blocks sight both ways unless the viewer is within 3 m', async () => {
    const ivy = { shape: 'box' as const, ...box({ x: 0, y: 1.5, z: 0 }, { x: 6, y: 3, z: 0.4 }), material: 'foliage' as const, solid: true,
      blocks: 'sight' as const };
    const { sb, step } = await fixture({ interactables: [{ kind: 'lookout', pos: { x: 0, y: 0, z: -30 }, yaw: 0 }],
      prims: [...(await createSandbox({ map: 'arena', heroes: [] })).ctx.map.prims, ivy] });
    const [hero, foe] = sb.heroes as [EntityId, EntityId];
    sb.place(foe, { x: 0, y: 0, z: 25 });
    sb.place(hero, { x: 3, y: 0, z: -30 });
    step(2);
    expect(canSee('dawn', sb.hero(foe)), '55 m from the Lookout, ivy between').toBe(false);
    sb.place(foe, { x: 20, y: 0, z: 25 });
    sb.place(hero, { x: 20, y: 0, z: -24 });
    step(2);
    expect(canSee('dawn', sb.hero(foe)), '49 m without a Lookout').toBe(false);
    sb.place(hero, { x: 0, y: 0, z: -29 });
    sb.place(foe, { x: 20, y: 0, z: 15 });
    step(2);
    expect(canSee('dawn', sb.hero(foe)), '48 m from the Lookout').toBe(true);

    sb.place(hero, { x: 0, y: 0, z: -6 });
    sb.place(foe, { x: 0, y: 0, z: 6 });
    step(2);
    expect(canSee('dawn', sb.hero(foe))).toBe(false);
    expect(canSee('dusk', sb.hero(hero))).toBe(false);
    sb.place(hero, { x: 0, y: 0, z: -2.5 });
    sb.place(foe, { x: 0, y: 0, z: 2.5 });
    step(2);
    expect(canSee('dawn', sb.hero(foe))).toBe(true);
    expect(canSee('dusk', sb.hero(hero))).toBe(true);
  }, T);
});

describe('indoor camps (GDD §7.8)', () => {
  const building = { id: 'test-house', archetype: 'cottage', footprint: box({ x: 0, y: 1.5, z: 20 }, { x: 10, y: 3, z: 10 }),
    storeys: [{ floorY: 0, height: 3 }], roof: { y: 3, walkable: false }, zone: 'test' };
  const room = { building: 0, storey: 0, volume: box({ x: 0, y: 1.5, z: 20 }, { x: 10, y: 3, z: 10 }) };

  it('toads lash at range and spit puddles, and never leave their room chasing a hero outside', async () => {
    const { sb, ctx, step, attacks } = await fixture({ buildings: [building], rooms: [room],
      thickets: [{ tier: 2, family: 'toads', building: 0, storey: 0, pos: { x: 0, y: 0, z: 20 }, yaw: 0 }] });
    const hero = sb.heroes[0]!;
    tough(sb, hero);
    ctx.objectives.campAt![0] = sb.sim.tick + 1;
    step(2);
    const toads = (): UnitEntity[] => sb.ctx.store.list('unit').filter((u) => u.unit.camp === 0);
    expect(toads()).toHaveLength(2);
    sb.place(hero, { x: 0, y: 0, z: 8 });
    step();
    sb.clearEvents();
    hit(sb, hero, toads()[0]!.id, 1);
    step(10 * TICK_RATE);
    expect(attacks.filter((e) => e.attack === 'lash').length).toBeGreaterThanOrEqual(4);
    expect(attacks.filter((e) => e.attack === 'spit').length).toBeGreaterThanOrEqual(1);
    const song = sb.eventsOf('damage.applied').filter((e) => e.target === hero && e.damageType === 'song');
    expect(song[0]!.amount).toBeCloseTo(CREATURES.toad.damage * (1 - sb.hero(hero).stats.final.songResist), 1);
    expect(sb.hero(hero).statuses.some((s) => s.def.id === 'slow') || song.some((e) => e.amount < CREATURES.toad.damage / 2)).toBe(true);

    sb.place(hero, { x: 0, y: 0, z: -2 });
    hit(sb, hero, toads()[0]!.id, 1);
    step(8 * TICK_RATE);
    for (const t of toads()) {
      expect(Math.abs(t.pos.x)).toBeLessThanOrEqual(5);
      expect(Math.abs(t.pos.z - 20)).toBeLessThanOrEqual(5);
    }
  }, T);

  it('rat bites apply 20% heal reduction for 2 s', async () => {
    const { sb, ctx, step } = await fixture({ thickets: [{ tier: 2, family: 'rats', pos: { x: 0, y: 0, z: 10 }, yaw: 0 }] });
    const hero = sb.heroes[0]!;
    tough(sb, hero);
    ctx.objectives.campAt![0] = sb.sim.tick + 1;
    step(2);
    sb.place(hero, { x: 0, y: 0, z: 9 });
    step();
    hit(sb, hero, sb.ctx.store.list('unit').find((u) => u.unit.camp === 0)!.id, 1);
    step(2 * TICK_RATE);
    expect(sb.hero(hero).stats.final.healReduction).toBeCloseTo(CREATURES.rat.healReduction!.value, 5);
  }, T);
});

describe('Nest classes and drops (GDD §7.9)', () => {
  it('surface, below-ground and Hollow Nests spawn at 3:00, 5:00 and 10:00; Woven Nests are solid; Keepsake Nests drop keepsakes', async () => {
    const keepsakeNests = Array.from({ length: 12 }, (_, i) => ({ pos: { x: -15 + i * 2.5, y: 0, z: 10 }, yaw: 0, variant: 'keepsake' as const }));
    const { sb, ctx, step } = await fixture({
      hollow: { centre: { x: 20, y: -10, z: -20 }, radius: 8, floorY: -10 },
      nests: [
        { pos: { x: 0, y: 0, z: 0 }, yaw: 0 },
        { pos: { x: 5, y: -3, z: 0 }, yaw: 0, storey: -1 },
        { pos: { x: 20, y: -10, z: -20 }, yaw: 0 },
        { pos: { x: -5, y: 0, z: 0 }, yaw: 0, variant: 'woven' },
        ...keepsakeNests,
      ],
    });
    const hero = sb.heroes[0]!;
    expect(ctx.objectives.nestAt!.slice(0, 4)).toEqual([180, 300, 600, 180].map((s) => s * TICK_RATE));
    for (let i = 0; i < ctx.objectives.nestAt!.length; i++) ctx.objectives.nestAt![i] = sb.sim.tick + 1;
    step(2);
    const of = (i: number): StructureEntity => sb.ctx.store.list('structure').find((s) => s.structure.anchor === i && s.structure.type === 'nest')!;
    expect(of(3).structure).toMatchObject({ variant: 'woven', solid: true, breakable: { by: 'heavyMelee' }, body: { radius: NESTS.woven.radius, height: NESTS.woven.height } });
    hit(sb, hero, of(1).id, 10);
    step(2);
    expect(ctx.objectives.nestAt![1]! - sb.sim.tick).toBeGreaterThan((NEST_RULES.respawnS.below - 1) * TICK_RATE);

    for (let i = 4; i < 16; i++) hit(sb, hero, of(i).id, 10);
    step(2);
    const drops = sb.ctx.store.list('pickup').filter((p) => p.pickup.type === 'keepsake');
    expect(drops.length).toBeGreaterThan(0);
    expect(drops.length).toBeLessThan(12);
    sb.place(hero, { x: drops[0]!.pos.x, y: 0, z: drops[0]!.pos.z });
    step(2);
    expect(sb.hero(hero).keepsakes?.count).toBeGreaterThanOrEqual(1);
  }, T);
});
