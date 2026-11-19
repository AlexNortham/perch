/** The physics tick budget on a city map (D-EP-022): serial, in `npm run perf`, median of PERF_RUNS runs; plus the determinism check that shares its run. */
import { describe, expect, it, vi } from 'vitest';
import { Button, IDLE_COMMAND } from '../core/contracts';
import type { BlockoutPrim, EntityId, MapData, MapId, SimContext, Vec3 } from '../core/contracts';
import { PERF_RUNS } from '../../../tests/helpers/perf';
import { allBotRoster, createSim } from '../index';
import { ARENA } from '../world/map';

const fixture = vi.hoisted(() => ({ map: null as MapData | null }));
vi.mock('../world/map', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../world/map')>();
  return { ...orig, loadMap: (id: MapId) => fixture.map ?? orig.loadMap(id) };
});

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
    const runs: Awaited<ReturnType<typeof cityRun>>[] = [];
    for (let i = 0; i < PERF_RUNS; i++) runs.push(await cityRun(1800));
    runs.sort((a, b) => a.stepMs + a.unitMs - (b.stepMs + b.unitMs));
    const run = runs[Math.floor(PERF_RUNS / 2)] as (typeof runs)[number];
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
