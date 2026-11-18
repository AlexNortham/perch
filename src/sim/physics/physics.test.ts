import { describe, expect, it, vi } from 'vitest';
import { Button, IDLE_COMMAND, Layer, LAYERS_SOLID } from '../core/contracts';
import type { BlockoutPrim, EntityId, MapData, MapId, PlayerTeam, SimContext, Vec3 } from '../core/contracts';
import { allBotRoster, createSim } from '../index';
import { ARENA } from '../world/map';

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
    for (let i = 0; i < 60; i++) {
      const m = ctx.physics.moveCharacter(id, { x: 0, y: -0.1, z: 0.1 });
      unit.pos = m.pos;
      expect(m.grounded).toBe(true);
    }
    // Ramp: 6 m long, rises 2 m from local −z (z −3) to +z (z 3); the unit is at z 0 → height 1.
    expect(unit.pos.z).toBeCloseTo(0, 6);
    expect(unit.pos.y).toBeCloseTo(1, 1);
    expect(ctx.physics.moveCharacter(id, { x: 0, y: 0, z: 0 }).wall).toBeNull();
  });
});

/** A 260 × 300 m city: ground, ~1,000 buildings in blocks, kerbs and ramps; the arena's spawn rows. */
function cityMap(): MapData {
  const prims: BlockoutPrim[] = [
    { shape: 'box', centre: { x: 0, y: -0.5, z: 0 }, size: { x: 260, y: 1, z: 300 }, yaw: 0, material: 'grass', solid: true },
  ];
  for (let x = -126; x <= 126; x += 7) {
    for (let z = -146; z <= 146; z += 9) {
      if (Math.abs(x) < 12 || Math.abs(z) < 24) continue;
      const kind = (x * 7 + z * 13) % 5;
      prims.push(
        kind === 0
          ? { shape: 'ramp', centre: { x, y: 0.75, z }, size: { x: 3, y: 1.5, z: 5 }, yaw: x * 0.1, material: 'stone', solid: true }
          : { shape: 'box', centre: { x, y: kind, z }, size: { x: 4, y: kind * 2, z: 5 }, yaw: z * 0.05, material: 'brick', solid: true },
      );
    }
  }
  return {
    ...ARENA,
    bounds: { min: { x: -130, y: -20, z: -150 }, max: { x: 130, y: 80, z: 150 } },
    killY: -20,
    prims,
  };
}

/** Wall-clock time for the perf report: the test times the sim from outside; the sim itself never reads a clock. */
// eslint-disable-next-line no-restricted-properties -- timing the test, not used by the sim
const now = (): number => performance.now();

async function cityRun(ticks: number) {
  fixture.map = cityMap();
  const sim = await createSim({ seed: 9, map: 'arena', roster: allBotRoster(9) });
  fixture.map = null;
  const { ctx } = sim;
  const units: EntityId[] = [];
  for (let i = 0; i < 150; i++) units.push(spawnUnit(ctx, { x: (i % 15) * 4 - 28, y: 0, z: Math.floor(i / 15) * 4 - 100 }));
  const heroes = ctx.store.list('hero');
  let stepMs = 0;
  let unitMs = 0;
  const measureFrom = ticks / 6;
  for (let t = 0; t < ticks; t++) {
    const commands = heroes.map((h, i) => {
      const k = t + i * 37;
      const pressed = k % 150 === 0 ? Button.Dash : k % 70 === 0 ? Button.Jump : k % 200 === 20 ? Button.Crouch : 0;
      const held = k % 200 < 50 ? Button.Crouch : 0;
      return { hero: h.id, command: { ...IDLE_COMMAND, forward: 1, right: Math.sin(k / 40), yaw: (k / 120) + i, pressed, held } };
    });
    const t0 = now();
    sim.step(commands);
    const t1 = now();
    for (const id of units) {
      const u = ctx.store.get(id);
      if (!u) continue;
      const m = ctx.physics.moveCharacter(id, { x: 0, y: -0.05, z: 3 / 60 });
      u.pos = m.pos;
    }
    const t2 = now();
    if (t >= measureFrom) {
      stepMs += t1 - t0;
      unitMs += t2 - t1;
    }
    sim.drainEvents();
  }
  const n = ticks - measureFrom;
  return { sim, stepMs: stepMs / n, unitMs: unitMs / n, heroes };
}

describe('performance and determinism on a city map', () => {
  it('12 moving heroes + 150 units through moveCharacter: ms per tick', async () => {
    const run = await cityRun(1800);
    // Reported in the Character Controller log (docs/STATUS.md). The bound only catches gross regressions: the
    // whole tick, core and the W1 stubs included, must stay inside the sim's 1 ms budget even under a busy test run.
    console.log(
      `physics perf: step ${run.stepMs.toFixed(3)} ms/tick (12 heroes, core + stubs included), ` +
        `units moveCharacter ${run.unitMs.toFixed(3)} ms/tick (150 units)`,
    );
    expect(run.stepMs + run.unitMs).toBeLessThan(1);
    expect(run.heroes.every((h) => h.pos.y > -1 && h.pos.y < 20)).toBe(true);
  });

  it('two identical runs give identical positions and hashes', async () => {
    const a = await cityRun(600);
    const b = await cityRun(600);
    expect(b.heroes.map((h) => h.pos)).toEqual(a.heroes.map((h) => h.pos));
    expect(b.sim.hash()).toBe(a.sim.hash());
  });
});
