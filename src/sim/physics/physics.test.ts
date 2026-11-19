import { describe, expect, it, vi } from 'vitest';
import { Layer, LAYERS_SOLID } from '../core/contracts';
import type { EntityId, MapData, MapId, PlayerTeam, SimContext, Vec3 } from '../core/contracts';
import { createSim } from '../index';

const fixture = vi.hoisted(() => ({ map: null as MapData | null }));
vi.mock('../world/map', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../world/map')>();
  return { ...orig, loadMap: (id: MapId) => fixture.map ?? orig.loadMap(id) };
});

const DOWN = { x: 0, y: -1, z: 0 };

async function arena(map: MapData | null = null, heroes = 1) {
  fixture.map = map;
  const roster = (['owl', 'swan', 'kiwi', 'puffin'] as const).slice(0, heroes).map((hero, i) => ({
    team: (i % 2 ? 'dusk' : 'dawn') as PlayerTeam,
    hero,
    controller: i === 0 ? ('human' as const) : ('easy' as const),
  }));
  const sim = await createSim({ seed: 1, map: 'arena', roster });
  fixture.map = null;
  return sim;
}

function spawnUnit(ctx: SimContext, pos: Vec3): EntityId {
  return ctx.store.spawn({
    kind: 'unit',
    team: 'dawn',
    pos: { ...pos },
    vel: { x: 0, y: 0, z: 0 },
    yaw: 0,
    radius: 0.4,
    unit: { type: 'scrapper', lane: null, height: 1, owner: null, summon: null, target: null, attacking: false },
    health: { hp: 1, talonShield: 0, songShield: 0, barrier: 0, dead: false, respawnAt: null, inCombatUntil: 0 },
    stats: ctx.stats.create({}),
    statuses: [],
  }).id;
}

function spawnStructure(ctx: SimContext, pos: Vec3, radius: number, height: number): EntityId {
  return ctx.store.spawn({
    kind: 'structure',
    team: 'dusk',
    pos: { ...pos },
    vel: { x: 0, y: 0, z: 0 },
    yaw: 0,
    radius,
    structure: { type: 'hawk', lane: null, phase: 1, target: null, body: { radius, height }, weakPoint: null },
    health: { hp: 1, talonShield: 0, songShield: 0, barrier: 0, dead: false, respawnAt: null, inCombatUntil: 0 },
    stats: ctx.stats.create({}),
    statuses: [],
  }).id;
}

describe('PhysicsService on the arena', () => {
  it('raycasts and ground heights hit the map prims (box top y 2, ramp mid-height 1, ground 0)', async () => {
    const { ctx } = await arena();
    const hit = ctx.physics.raycast({ x: 8, y: 10, z: 0 }, DOWN, 50, LAYERS_SOLID);
    expect(hit?.distance).toBeCloseTo(8, 4);
    expect(hit?.point.y).toBeCloseTo(2, 4);
    expect(hit?.normal.y).toBeCloseTo(1, 4);
    expect(hit?.entity).toBeNull();
    expect(ctx.physics.raycast({ x: 8, y: 10, z: 0 }, DOWN, 5, LAYERS_SOLID)).toBeNull();
    expect(ctx.physics.raycast({ x: 8, y: 10, z: 0 }, DOWN, 50, Layer.Hero)).toBeNull();
    expect(ctx.physics.groundHeight(8, 0, 10)).toBeCloseTo(2, 4);
    // From inside a solid the ray is blocked at once.
    expect(ctx.physics.groundHeight(8, 0, 1)).toBeCloseTo(1, 4);
    expect(ctx.physics.groundHeight(5, 0, 3)).toBeCloseTo(0, 4);
    expect(ctx.physics.groundHeight(0, 5, 10)).toBeCloseTo(0, 4);
    expect(ctx.physics.groundHeight(-8, 0, 10)).toBeCloseTo(1, 3);
    expect(ctx.physics.groundHeight(100, 0, 10)).toBeNull();
    const cast = ctx.physics.shapeCast({ kind: 'sphere', radius: 0.5 }, { x: 0, y: 5, z: 0 }, DOWN, 50, LAYERS_SOLID);
    expect(cast?.distance).toBeCloseTo(4.5, 3);
    expect(cast?.point.y).toBeCloseTo(0, 3);
  });

  it('finds hero capsules on Layer.Hero, honours ignore, and drops dead heroes', async () => {
    const sim = await arena(null, 2);
    const { ctx } = sim;
    const [a, b] = ctx.store.list('hero');
    if (!a || !b) throw new Error('heroes missing');
    const from = { x: a.pos.x, y: 1, z: a.pos.z - 5 };
    const hit = ctx.physics.raycast(from, { x: 0, y: 0, z: 1 }, 10, Layer.Hero);
    expect(hit?.entity).toBe(a.id);
    expect(hit?.distance).toBeCloseTo(5 - 0.4, 3);
    expect(ctx.physics.raycast(from, { x: 0, y: 0, z: 1 }, 10, Layer.Hero, a.id)).toBeNull();
    const out: EntityId[] = [];
    expect(ctx.physics.overlap({ kind: 'sphere', radius: 1 }, { x: b.pos.x, y: 1, z: b.pos.z }, Layer.Hero, out)).toEqual([b.id]);
    expect(ctx.physics.overlap({ kind: 'box', halfExtents: { x: 40, y: 2, z: 40 }, yaw: 0.3 }, { x: 0, y: 1, z: 0 }, Layer.Hero, out))
      .toEqual([a.id, b.id]);
    a.health.dead = true;
    sim.step();
    expect(ctx.physics.raycast(from, { x: 0, y: 0, z: 1 }, 10, Layer.Hero)).toBeNull();
  });

  it('gives structures a collider on spawn and removes it on despawn', async () => {
    const sim = await arena();
    const { ctx } = sim;
    const id = spawnStructure(ctx, { x: 20, y: 0, z: 20 }, 2, 8);
    const hit = ctx.physics.raycast({ x: 10, y: 4, z: 20 }, { x: 1, y: 0, z: 0 }, 50, LAYERS_SOLID);
    expect(hit?.entity).toBe(id);
    expect(hit?.distance).toBeCloseTo(8, 3);
    expect(ctx.physics.raycast({ x: 10, y: 4, z: 20 }, { x: 1, y: 0, z: 0 }, 50, Layer.World)).toBeNull();
    expect(ctx.physics.raycast({ x: 10, y: 4, z: 20 }, { x: 1, y: 0, z: 0 }, 50, LAYERS_SOLID, id)).toBeNull();
    expect(ctx.physics.groundHeight(20, 20, 20)).toBeCloseTo(8, 3);
    const out: EntityId[] = [];
    expect(ctx.physics.overlap({ kind: 'capsule', radius: 0.5, halfHeight: 1 }, { x: 22, y: 1, z: 20 }, Layer.Structure, out)).toEqual([id]);
    ctx.store.despawn(id);
    sim.step();
    expect(ctx.physics.raycast({ x: 10, y: 4, z: 20 }, { x: 1, y: 0, z: 0 }, 50, LAYERS_SOLID)).toBeNull();
    expect(ctx.physics.overlap({ kind: 'sphere', radius: 3 }, { x: 20, y: 1, z: 20 }, LAYERS_SOLID, out)).toEqual([]);
  });

  it('moves units cheaply over the ground: up the ramp, no controller', async () => {
    const { ctx } = await arena();
    const id = spawnUnit(ctx, { x: -8, y: 0, z: -6 });
    const unit = ctx.store.get(id);
    if (!unit) throw new Error('unit missing');
    const out = { pos: { x: 0, y: 0, z: 0 }, grounded: false, wall: null };
    const originalPos = out.pos;
    for (let i = 0; i < 60; i++) {
      const m = ctx.physics.moveCharacter(id, { x: 0, y: -0.1, z: 0.1 }, out);
      expect(m).toBe(out);
      expect(m.pos).toBe(originalPos);
      Object.assign(unit.pos, m.pos);
      expect(m.grounded).toBe(true);
    }
    // Ramp: 6 m long, rises 2 m from local −z (z −3) to +z (z 3); the unit is at z 0 → height 1.
    expect(unit.pos.z).toBeCloseTo(0, 6);
    expect(unit.pos.y).toBeCloseTo(1, 1);
    expect(ctx.physics.moveCharacter(id, { x: 0, y: 0, z: 0 }).wall).toBeNull();
  });
});
