/**
 * Hero controller and physics-owned effects against GDD §3 numbers, on the arena plus small fixture maps.
 * Tolerances are stated per assertion; "tick" is 1/60 s.
 */
import { describe, expect, it, vi } from 'vitest';
import { createSandbox } from '../../../tests/helpers/sandbox';
import { Button, IDLE_COMMAND, LAYERS_SOLID, Layer, RETIRED_BUTTONS } from '../core/contracts';
import type {
  BlockoutPrim,
  Climb,
  Effect,
  EffectCause,
  HeroEntity,
  MapData,
  MapId,
  MovementAction,
  PlayerCommand,
  Sim,
  UnitEntity,
  Vec3,
} from '../core/contracts';
import { createSim } from '../index';
import { ARENA } from '../world/map';
import { STUN } from '../data/combat';
import { SURFACE_VALUE } from '../data/abilities';
import { PHYSICS_LAYERS, STEER_VALUE } from '../data/movement';
import { MOVE_MASK } from './rapier';

const fixture = vi.hoisted(() => ({ map: null as MapData | null }));
vi.mock('../world/map', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../world/map')>();
  return { ...orig, loadMap: (id: MapId) => fixture.map ?? orig.loadMap(id) };
});

const box = (centre: Vec3, size: Vec3): BlockoutPrim => ({ shape: 'box', centre, size, yaw: 0, material: 'stone', solid: true });
const withArena = (extra: Partial<MapData>): MapData => ({ ...ARENA, ...extra, prims: [...ARENA.prims, ...(extra.prims ?? [])] });
const flatSpeed = (h: HeroEntity): number => Math.hypot(h.vel.x, h.vel.z);

interface Bench {
  sim: Sim;
  h: HeroEntity;
  other: HeroEntity | undefined;
  /** Step n ticks with this command for the hero (presses only on the first tick). */
  step(cmd?: Partial<PlayerCommand>, n?: number): void;
  /** Movement events so far, in order. */
  actions: MovementAction[];
  place(pos: Vec3): void;
  cause(origin?: Vec3): EffectCause;
  apply(effect: Effect, target?: { entity?: number | null; point?: Vec3; dir?: Vec3 }, cause?: EffectCause): void;
}

async function bench(map: MapData | null = null, at?: Vec3, enemy?: Vec3): Promise<Bench> {
  fixture.map = map;
  const roster = [{ team: 'dawn' as const, hero: 'owl' as const, controller: 'human' as const }];
  if (enemy) roster.push({ team: 'dusk' as never, hero: 'swan' as never, controller: 'easy' as never });
  const sim = await createSim({ seed: 1, map: 'arena', roster });
  fixture.map = null;
  const [h, other] = sim.ctx.store.list('hero');
  if (!h) throw new Error('no hero');
  // No sprint unless a test asks for it.
  h.health.inCombatUntil = Number.MAX_SAFE_INTEGER;
  const actions: MovementAction[] = [];
  // Subscribed, so effects applied between steps (b.apply) report their events too.
  sim.ctx.bus.on('movement', (e) => {
    if (e.hero === h.id) actions.push(e.action);
  });
  const drain = (): void => void sim.drainEvents();
  const b: Bench = {
    sim,
    h,
    other,
    actions,
    step(cmd = {}, n = 1) {
      for (let i = 0; i < n; i++) {
        const command = { ...IDLE_COMMAND, ...cmd, pressed: i === 0 ? (cmd.pressed ?? 0) : 0 };
        sim.step([{ hero: h.id, command }]);
        drain();
      }
    },
    place(pos) {
      sim.ctx.bus.emit({ type: 'hero.respawned', hero: h.id, pos });
      sim.step();
      drain();
    },
    cause(origin = { x: 0, y: 0, z: 0 }) {
      return { source: h.id, team: 'dawn', via: 'ability', ability: null, item: null, values: null, songPower: 0, proc: false, origin };
    },
    apply(effect, target = {}, cause = b.cause()) {
      sim.ctx.effects.apply(
        effect,
        { entity: target.entity === undefined ? h.id : target.entity, point: target.point ?? { ...h.pos }, dir: target.dir ?? { x: 0, y: 0, z: 1 } },
        cause,
      );
    },
  };
  if (at) b.place(at);
  if (enemy && other) {
    sim.ctx.bus.emit({ type: 'hero.respawned', hero: other.id, pos: enemy });
    sim.step();
  }
  drain();
  actions.length = 0;
  return b;
}

const FWD = { forward: 1, yaw: 0 };

describe('ground movement (GDD §3.2)', () => {
  it('reaches 7.0 m/s in ≤ 0.15 s, stops in ≤ 0.2 s, strafes at the same speed', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -30 });
    b.step(FWD, 9);
    expect(b.h.vel.z).toBeCloseTo(7, 6);
    b.step(FWD, 30);
    expect(b.h.vel.z).toBeCloseTo(7, 6);
    b.step({}, 11);
    expect(flatSpeed(b.h)).toBeLessThan(1e-9);
    b.step({ right: 1, yaw: 0 }, 20);
    expect(b.h.vel.x).toBeCloseTo(-7, 6);
    b.step({ forward: 1, right: 1, yaw: 0 }, 20);
    expect(flatSpeed(b.h)).toBeCloseTo(7, 6);
    expect(b.h.motor.grounded).toBe(true);
    expect(b.h.pos.y).toBeCloseTo(0, 1);
  });

  it('sprints +2.0 m/s after 0.5 s out of combat, loses it on entering combat; crouch 3.5; slows floor at 1.5', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -30 });
    b.h.health.inCombatUntil = 0;
    b.step(FWD, 40);
    expect(b.h.vel.z).toBeCloseTo(9, 6);
    b.h.health.inCombatUntil = Number.MAX_SAFE_INTEGER;
    b.step(FWD, 3);
    expect(b.h.vel.z).toBeCloseTo(7, 6);
    b.step({ ...FWD, held: Button.Crouch }, 1);
    b.step({ ...FWD, held: Button.Crouch }, 65);
    expect(b.h.motor.crouching).toBe(true);
    expect(b.h.vel.z).toBeCloseTo(3.5, 6);
    b.sim.ctx.stats.set(b.h.id, 'test:slow', { stats: [{ stat: 'slow', op: 'max', value: 0.5 }] });
    b.step(FWD, 30);
    expect(b.h.vel.z).toBeCloseTo(3.5, 6);
    b.sim.ctx.stats.set(b.h.id, 'test:slow', { stats: [{ stat: 'slow', op: 'max', value: 0.9 }] });
    b.step(FWD, 30);
    expect(b.h.vel.z).toBeCloseTo(1.5, 6);
  });

  it('aim drops sprint and releasing aim restarts the five-second running delay', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -30 });
    b.h.health.inCombatUntil = 0;
    b.step(FWD, 40);
    b.step({ ...FWD, held: Button.Aim }, 8);
    expect(flatSpeed(b.h)).toBeCloseTo(7);
    b.step({}, 295);
    b.step(FWD, 5);
    expect(flatSpeed(b.h)).toBeLessThan(7);
    b.step(FWD, 30);
    expect(flatSpeed(b.h)).toBeCloseTo(9);
  });

  it('steps up 0.4 m kerbs without jumping but not 0.55 m ones (below mantle height); walks up the 18° ramp', async () => {
    const map = withArena({
      prims: [box({ x: -20, y: 0.2, z: -25 }, { x: 4, y: 0.4, z: 4 }), box({ x: 20, y: 0.275, z: -25 }, { x: 4, y: 0.55, z: 4 })],
    });
    const b = await bench(map, { x: -20, y: 0, z: -32 });
    b.step(FWD, 65);
    expect(b.h.pos.z).toBeGreaterThan(-26);
    expect(b.h.pos.z).toBeLessThan(-23.5);
    expect(b.h.pos.y).toBeCloseTo(0.4, 1);
    b.place({ x: 20, y: 0, z: -32 });
    b.step(FWD, 90);
    expect(b.h.pos.z).toBeLessThan(-27);
    expect(b.h.pos.y).toBeCloseTo(0, 1);
    // The arena ramp rises 2 m over z −3…3 (18°): on it, y = (z + 3) / 3.
    b.place({ x: -8, y: 0, z: -6 });
    b.step(FWD, 60);
    expect(b.h.pos.z).toBeGreaterThan(-1);
    expect(b.h.pos.y).toBeCloseTo((b.h.pos.z + 3) / 3, 1);
    expect(b.h.motor.grounded).toBe(true);
  });
});

describe('jump and air (GDD §3.3)', () => {
  it('jump apex is 1.6 m ± 0.05 at ~0.36 s; lands back on the ground', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -30 });
    let apex = 0;
    let apexTick = 0;
    b.step({ pressed: Button.Jump });
    for (let t = 2; t < 60; t++) {
      b.step();
      if (b.h.pos.y > apex) {
        apex = b.h.pos.y;
        apexTick = t;
      }
    }
    expect(apex).toBeGreaterThan(1.55);
    expect(apex).toBeLessThan(1.65);
    expect(apexTick).toBeGreaterThanOrEqual(21);
    expect(apexTick).toBeLessThanOrEqual(23);
    expect(b.h.motor.grounded).toBe(true);
    expect(b.actions).toEqual(['jump', 'land']);
  });

  it('spends one air-jump pip and a half-pip on two fresh crouch presses, preserving forward speed', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -32 });
    b.step(FWD, 16);
    b.step({ ...FWD, pressed: Button.Jump }, 12);
    b.step({ ...FWD, pressed: Button.Jump });
    expect(flatSpeed(b.h)).toBeCloseTo(7);
    expect(b.h.motor.stamina).toBeCloseTo(2);
    b.step({ ...FWD, pressed: Button.Jump });
    expect(b.actions.filter((a) => a === 'airJump')).toHaveLength(1);
    b.step({ ...FWD, held: Button.Crouch, pressed: Button.Crouch });
    b.step({ ...FWD, held: Button.Crouch });
    expect(b.actions).not.toContain('downDash');
    b.step(FWD);
    b.step({ ...FWD, held: Button.Crouch, pressed: Button.Crouch });
    expect(b.actions).toContain('downDash');
    expect(b.h.vel.y).toBeLessThan(-18);
    expect(flatSpeed(b.h)).toBeCloseTo(7);
    expect(b.h.motor.stamina).toBeCloseTo(1.5 + 5 / 300);
    b.step({ ...FWD, held: Button.Crouch }, 18);
    expect(b.actions).toContain('land');
    expect(b.h.motor.sliding).toBe(true);
    b.step({ ...FWD, pressed: Button.Jump });
    b.step({ ...FWD, pressed: Button.Jump });
    expect(b.actions.filter((a) => a === 'airJump')).toHaveLength(2);
  });

  it('pushes off either wall, charges half a pip for the repeat, and shortens its launch under fatigue', async () => {
    const wall = (z: number) => box({ x: -20, y: 3, z }, { x: 10, y: 6, z: 1 });
    const b = await bench(withArena({ prims: [wall(-31.8), wall(-28.2)] }), { x: -20, y: 0, z: -30 });
    b.step({ ...FWD, pressed: Button.Jump }, 25);
    b.step({ ...FWD, pressed: Button.Jump });
    expect(b.actions.at(-1)).toBe('wallJump');
    expect(b.h.vel.z).toBeCloseTo(-6);
    expect(b.h.vel.y).toBeCloseTo(7 - 25 / 60);
    expect(b.h.motor.stamina).toBe(3);

    b.step({ forward: -1 }, 21);
    b.step({ forward: -1, pressed: Button.Jump });
    expect(b.actions.filter((a) => a === 'wallJump')).toHaveLength(2);
    expect(b.h.vel.z).toBeCloseTo(6);
    expect(b.h.vel.y).toBeGreaterThan(3.5 - 25 / 60);
    expect(b.h.vel.y).toBeLessThan(7 - 25 / 60);
    expect(b.h.motor.stamina).toBeCloseTo(2.5);
  });

  it('lets an airborne heavy commitment chain to a free but fatigued wall jump', async () => {
    const b = await bench(withArena({ prims: [box({ x: -20, y: 3, z: -27 }, { x: 10, y: 6, z: 1 })] }), { x: -20, y: 0, z: -30 });
    b.step({ pressed: Button.Jump });
    b.step({ pressed: Button.Melee, held: Button.Melee }, 22);
    expect(b.h.motor.dashing).toBe(true);
    for (let i = 0; i < 18 && b.h.motor.dashing; i++) b.step({ held: Button.Melee });
    expect(b.h.motor.dashing).toBe(false);
    b.step({ pressed: Button.Jump });
    expect(b.actions.at(-1)).toBe('wallJump');
    expect(b.h.vel.z).toBeCloseTo(-6);
    expect(b.h.vel.y).toBeLessThan(5);
    expect(b.h.motor.stamina).toBe(3);
  });

  it('buffers a jump pressed 0.1 s before landing and keeps run speed with air control', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -30 });
    b.step({ pressed: Button.Jump });
    b.step({}, 36);
    expect(b.h.motor.grounded).toBe(false);
    b.h.motor.stamina = 0; // With no air jump available, the fresh press buffers until landing.
    b.step({ pressed: Button.Jump });
    b.step({}, 10);
    expect(b.actions.filter((a) => a === 'jump')).toHaveLength(2);
    b.place({ x: -20, y: 0, z: -30 });
    b.step(FWD, 20);
    b.step({ ...FWD, pressed: Button.Jump }, 10);
    expect(b.h.vel.z).toBeCloseTo(7, 6);
  });
});

describe('stamina, dash and dash-jump (GDD §3.4)', () => {
  it('ground dash covers 5.5 m in 0.2 s for one pip; 0.4 s lockout', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -30 });
    const z0 = b.h.pos.z;
    b.step({ yaw: 0, pressed: Button.Dash });
    b.step({}, 11);
    expect(b.h.pos.z - z0).toBeCloseTo(5.5, 2);
    expect(b.h.motor.dashing).toBe(true);
    b.step({ pressed: Button.Dash });
    expect(b.h.motor.dashing).toBe(false);
    expect(b.h.motor.stamina).toBeCloseTo(2 + 12 / 300, 6);
    b.step({}, 11);
    b.step({ pressed: Button.Dash });
    expect(b.h.motor.dashing).toBe(true);
    expect(b.actions).toEqual(['dash', 'dash']);
  });

  it('dashes in the WASD direction relative to the camera yaw', async () => {
    const b = await bench(null, { x: 0, y: 0, z: -30 });
    b.step({ right: 1, yaw: Math.PI / 2, pressed: Button.Dash });
    b.step({ right: 1, yaw: Math.PI / 2 }, 11);
    // yaw π/2 faces +x; its right is +z.
    expect(b.h.pos.z).toBeCloseTo(-24.5, 2);
    expect(b.h.pos.x).toBeCloseTo(0, 3);
  });

  it('air dash: 4.5 m horizontal, no vertical speed, once per airtime', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -30 });
    b.step({ pressed: Button.Jump });
    b.step({}, 9);
    const p = { ...b.h.pos };
    b.step({ yaw: 0, pressed: Button.Dash });
    b.step({}, 11);
    expect(b.h.pos.z - p.z).toBeCloseTo(4.5, 2);
    expect(b.h.pos.y).toBeCloseTo(p.y, 6);
    b.step({ pressed: Button.Dash });
    expect(b.h.motor.dashing).toBe(false);
    expect(b.actions).toEqual(['jump', 'dash']);
  });

  it('regenerates one pip every 5.0 s, one at a time, also airborne', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -30 });
    for (let i = 0; i < 3; i++) {
      b.step({ yaw: Math.PI, pressed: Button.Dash });
      b.step({}, 23);
    }
    const after = b.h.motor.stamina;
    // 23 idle ticks after each dash, plus one regen tick before the second and third dash.
    expect(after).toBeCloseTo(71 / 300, 6);
    b.step({}, 300);
    expect(b.h.motor.stamina).toBeCloseTo(after + 1, 6);
    b.step({ pressed: Button.Jump }, 30);
    expect(b.h.motor.stamina).toBeCloseTo(after + 1.1, 6);
    b.step({}, 1000);
    expect(b.h.motor.stamina).toBe(3);
  });

  it('no dash while rooted, grounded or stunned; the Egg carrier can dash', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -30 });
    for (const c of ['rooted', 'grounded', 'stunned'] as const) {
      b.sim.ctx.stats.set(b.h.id, 'test', { conditions: [c] });
      b.step({ pressed: Button.Dash });
      expect(b.h.motor.dashing).toBe(false);
    }
    b.sim.ctx.stats.set(b.h.id, 'test', { conditions: ['eggCarrier'] });
    b.step({ pressed: Button.Dash });
    expect(b.h.motor.dashing).toBe(true);
  });

  it('dash-jump costs a second pip and launches 7.3 m with a ~1.0 m apex on flat ground', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -35 });
    b.step({ yaw: 0, pressed: Button.Dash });
    b.step({}, 6);
    expect(b.h.motor.dashJumpReady).toBe(true);
    b.step({ pressed: Button.Jump });
    expect(b.h.motor.dashJumpReady).toBe(false);
    expect(b.h.vel.z).toBeCloseTo(13, 6);
    expect(b.h.vel.y).toBeCloseTo(7 - 25 / 60, 6);
    const z0 = b.h.pos.z - 13 / 60;
    let apex = 0;
    while (!b.h.motor.grounded) {
      b.step();
      apex = Math.max(apex, b.h.pos.y);
    }
    expect(apex).toBeCloseTo(0.98, 1);
    expect(b.h.pos.z - z0).toBeGreaterThan(7.28 - 0.15);
    expect(b.h.pos.z - z0).toBeLessThan(7.28 + 0.15);
    expect(b.h.motor.stamina).toBeLessThan(1.2);
    expect(b.actions).toEqual(['dash', 'dashJump', 'land']);
  });

  it('shows an affordable dash-jump only between ticks six and eighteen', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -35 });
    b.step({ pressed: Button.Dash });
    for (let elapsed = 0; elapsed <= 19; elapsed++) {
      expect(b.h.motor.dashJumpReady, 'elapsed ' + elapsed).toBe(elapsed >= 6 && elapsed <= 18);
      b.step();
    }
    b.place({ x: -20, y: 0, z: -35 });
    b.h.motor.stamina = 1.2;
    b.step({ pressed: Button.Dash });
    b.step({}, 6);
    expect(b.h.motor.dashJumpReady).toBe(false);
    b.step({ pressed: Button.Jump });
    expect(b.actions.at(-1)).toBe('jump');
    expect(b.h.vel.z).toBeCloseTo(8);
    expect(b.h.motor.stamina).toBeCloseTo(0.2 + 8 / 300);
  });

  it('permits ordinary casting during a dash and closes its conversion cue on cast start', async () => {
    const sb = await createSandbox({ heroes: [{ hero: 'shrike', at: { x: 0, y: 0, z: -30 } }] });
    const me = sb.heroes[0]!;
    sb.press(me, Button.Dash);
    sb.step(7);
    expect(sb.hero(me).motor.dashJumpReady).toBe(true);
    sb.cast(me, 1, { x: 0, y: 0, z: -10 });
    sb.step();
    expect(sb.eventsOf('ability')).toContainEqual(expect.objectContaining({ caster: me, stage: 'start' }));
    expect(sb.hero(me).motor.dashing).toBe(true);
    expect(sb.hero(me).motor.dashJumpReady).toBe(false);
  });

  it('a dash-jump off the edge in coyote time clears an 8 m gap', async () => {
    const map: MapData = {
      ...ARENA,
      prims: [box({ x: 0, y: -0.5, z: -20 }, { x: 10, y: 1, z: 40 }), box({ x: 0, y: -0.5, z: 22 }, { x: 10, y: 1, z: 28 })],
    };
    const b = await bench(map, { x: 0, y: 0, z: -3 });
    b.step({ yaw: 0, pressed: Button.Dash });
    while (b.h.motor.grounded) b.step({ yaw: 0 });
    b.step({ yaw: 0 }, 3);
    expect(b.h.motor.dashing).toBe(true);
    b.step({ yaw: 0, pressed: Button.Jump });
    b.step({ forward: 1, yaw: 0 }, 60);
    expect(b.h.pos.z).toBeGreaterThan(8);
    expect(b.h.pos.y).toBeCloseTo(0, 1);
    expect(b.actions).toEqual(['dash', 'dashJump', 'land']);
  });
});

describe('slide (GDD §3.5)', () => {
  it('starts at run + 2 (9 m/s) from ≥ 5 m/s and decays to crouch walk in 1.0 s; boost back 1 s after', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -35 });
    b.step(FWD, 20);
    b.step({ ...FWD, held: Button.Crouch, pressed: Button.Crouch });
    expect(b.h.motor.sliding).toBe(true);
    expect(b.h.vel.z).toBeCloseTo(9 - 5.5 / 60, 6);
    let ticks = 1;
    while (b.h.motor.sliding) {
      b.step({ ...FWD, held: Button.Crouch });
      ticks++;
    }
    expect(ticks).toBeGreaterThanOrEqual(59);
    expect(ticks).toBeLessThanOrEqual(61);
    expect(b.h.vel.z).toBeCloseTo(3.5, 6);
    // Released and re-run at once: no boost yet.
    b.step(FWD, 15);
    b.step({ ...FWD, held: Button.Crouch, pressed: Button.Crouch });
    expect(b.h.vel.z).toBeCloseTo(7 - 3.5 / 60, 6);
    expect(b.actions).toEqual(['slide', 'slide']);
  });

  it('needs 5 m/s: no slide from a crouch walk; slide-jump keeps the slide speed', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -35 });
    b.sim.ctx.stats.set(b.h.id, 'test:slow', { stats: [{ stat: 'slow', op: 'max', value: 0.4 }] });
    b.step(FWD, 30);
    b.step({ ...FWD, held: Button.Crouch, pressed: Button.Crouch });
    expect(b.h.motor.sliding).toBe(false);
    b.sim.ctx.stats.set(b.h.id, 'test:slow', null);
    b.step(FWD, 30);
    b.step({ ...FWD, held: Button.Crouch, pressed: Button.Crouch }, 5);
    const speed = b.h.vel.z;
    b.step({ ...FWD, held: Button.Crouch, pressed: Button.Jump });
    expect(b.h.motor.sliding).toBe(false);
    expect(b.h.vel.z).toBeCloseTo(speed, 6);
  });

  it('a downhill slope steeper than 8° keeps the slide going and speeds it up (max 16 m/s)', async () => {
    // A 30 m ramp falling 6 m toward +z (11°), from a 6 m platform.
    const ramp: BlockoutPrim = { shape: 'ramp', centre: { x: 20, y: 3, z: 0 }, size: { x: 6, y: 6, z: 30 }, yaw: Math.PI, material: 'stone', solid: true };
    const map = withArena({ prims: [ramp, box({ x: 20, y: 3, z: -20 }, { x: 6, y: 6, z: 10 })] });
    const b = await bench(map, { x: 20, y: 6, z: -22 });
    b.step(FWD, 60);
    b.step({ ...FWD, held: Button.Crouch, pressed: Button.Crouch });
    b.step({ ...FWD, held: Button.Crouch }, 60);
    expect(b.h.motor.sliding).toBe(true);
    expect(b.h.pos.y).toBeLessThan(5);
    expect(flatSpeed(b.h)).toBeGreaterThan(9);
    expect(flatSpeed(b.h)).toBeLessThanOrEqual(16);
  });
});

describe('mantle (GDD §3.6)', () => {
  const wall = (height: number): MapData =>
    withArena({ prims: [box({ x: -20, y: height / 2, z: -25 }, { x: 6, y: height, z: 4 })] });

  it('mantles a 2.2 m ledge in 0.35 s and stands on it with half the speed', async () => {
    const b = await bench(wall(2.2), { x: -20, y: 0, z: -32 });
    let ticks = 0;
    while (!b.h.motor.mantling && ticks < 120) {
      b.step({ ...FWD, held: Button.Jump });
      ticks++;
    }
    expect(b.actions).toEqual(['mantle']);
    let mantleTicks = 0;
    while (b.h.motor.mantling) {
      b.step(FWD);
      mantleTicks++;
    }
    expect(mantleTicks).toBe(21);
    expect(b.h.pos.y).toBeCloseTo(2.2, 3);
    expect(b.h.pos.z).toBeGreaterThan(-27);
    b.step(FWD, 10);
    expect(b.h.motor.grounded).toBe(true);
    expect(b.h.pos.y).toBeCloseTo(2.2, 1);
  });

  it('walks into a ledge without auto-mantling and carries a sliding approach onto the top', async () => {
    const b = await bench(wall(2.2), { x: -20, y: 0, z: -32 });
    b.step(FWD, 60);
    expect(b.actions).not.toContain('mantle');
    b.place({ x: -20, y: 0, z: -32 });
    b.step(FWD, 23);
    const glide = { ...FWD, held: Button.Crouch | Button.Jump };
    for (let i = 0; i < 75 && !b.actions.includes('mantleGlide'); i++) b.step(glide);
    expect(b.actions).toContain('mantleGlide');
    expect(b.h.pos.y).toBeCloseTo(2.2);
    expect(flatSpeed(b.h)).toBeGreaterThan(5);
  });

  it('also mantles 2.2 m from a jump, never a 2.6 m ledge (even jumping), and not while rooted', async () => {
    const b = await bench(wall(2.2), { x: -20, y: 0, z: -27.2 });
    b.step({ ...FWD, pressed: Button.Jump });
    b.step(FWD, 40);
    expect(b.actions).toContain('mantle');
    const c = await bench(wall(2.6), { x: -20, y: 0, z: -32 });
    for (let i = 0; i < 10; i++) {
      c.step({ ...FWD, pressed: Button.Jump });
      c.step(FWD, 100);
    }
    expect(c.actions).not.toContain('mantle');
    expect(c.h.pos.y).toBeLessThan(0.1);
    const d = await bench(wall(2.2), { x: -20, y: 0, z: -27.2 });
    d.sim.ctx.stats.set(d.h.id, 'test', { conditions: ['rooted'] });
    d.step({ ...FWD, held: Button.Jump }, 30);
    expect(d.actions).not.toContain('mantle');
  });
});

describe('Updrafts (GDD §3.7)', () => {
  const line: MapData = withArena({
    updrafts: [
      {
        lane: 'riverbank',
        points: [{ x: 0, y: 12, z: -30 }, { x: 0, y: 12, z: 30 }],
        stations: [{ x: 0, y: 12, z: -30 }, { x: 0, y: 12, z: 0 }, { x: 0, y: 12, z: 30 }],
      },
    ],
    prims: [box({ x: 0, y: 5.25, z: 10 }, { x: 4, y: 10.5, z: 4 })],
  });

  const HOLD = { yaw: 0, held: Button.Jump };
  const hitBy = (b: Bench): void => {
    const other = b.other;
    if (!other) throw new Error('no enemy');
    b.sim.ctx.bus.emit({
      type: 'damage.applied', source: other.id, sourceTeam: 'dusk', target: b.h.id, targetKind: 'hero', amount: 10,
      absorbed: 0, damageType: 'talon', via: 'weapon', ability: null, item: null, beakShot: false, weakPoint: false,
      proc: false, lethal: false, pos: { ...b.h.pos },
    });
  };

  it('Jump held 0.2 s in reach latches and pulls up at 30 m/s; rides 11 m/s, boosts 18 m/s for 3 s (12 s cooldown), drops off the end', async () => {
    const b = await bench(line, { x: 1, y: 0, z: -31 });
    expect(b.h.motor.updraftInReach, 'feet 1.4 m from the ground line, cable 12 m up').toBe(0);
    b.step(HOLD, 11);
    expect(b.h.motor.updraft, 'not before 0.2 s').toBeNull();
    b.step(HOLD);
    expect(b.h.motor.updraft).toBe(0);
    expect(b.h.motor.updraftInReach, 'null while riding').toBeNull();
    // 12.08 m to the cable at 30 m/s: 25 ticks.
    b.step(HOLD, 24);
    expect(b.h.pos.y).toBeLessThan(12);
    b.step(HOLD);
    expect(b.h.pos.y).toBeCloseTo(12, 6);
    b.step(HOLD, 30);
    expect(b.h.vel.z, 'holding Jump on the ride does nothing').toBeCloseTo(11, 6);
    b.step({ yaw: 0, pressed: Button.Dash });
    expect(b.h.vel.z).toBeCloseTo(18, 6);
    expect(b.h.motor.stamina).toBe(3);
    b.step({ yaw: 0 }, 30);
    b.step({ yaw: 0, pressed: Button.Dash });
    expect(b.actions.filter((a) => a === 'updraftBoost')).toHaveLength(1);
    const z = b.h.pos.z;
    b.step({ yaw: 0 }, 60);
    expect(b.h.pos.z - z).toBeCloseTo(18, 1);
    b.step({ yaw: 0 }, 200);
    expect(b.h.motor.updraft).toBeNull();
    expect(b.actions).toEqual(['updraftOn', 'updraftBoost', 'updraftOff', 'land']);
    expect(b.h.pos.z).toBeCloseTo(30, 1);
  });

  it('a tap never latches, nor a press that starts a normal jump and lets go; out of reach, nothing', async () => {
    const b = await bench(line, { x: 1, y: 0, z: -20 });
    b.step({ yaw: 0, pressed: Button.Jump });
    b.step({ yaw: 0 }, 60);
    expect(b.actions).toEqual(['jump', 'land']);
    b.step({ ...HOLD, pressed: Button.Jump });
    b.step(HOLD, 5);
    b.step({ yaw: 0 }, 60);
    expect(b.h.motor.updraft).toBeNull();
    b.place({ x: 4, y: 0, z: -20 });
    expect(b.h.motor.updraftInReach, '4 m from the ground line').toBeNull();
    b.step(HOLD, 60);
    expect(b.h.motor.updraft).toBeNull();
  });

  it('from the ground the press starts a normal jump and the hold pulls up from the air; airborne within 1.5 m it attaches in 0.15 s', async () => {
    const b = await bench(line, { x: 1, y: 0, z: -20 });
    b.step({ ...HOLD, pressed: Button.Jump });
    b.step(HOLD, 11);
    expect(b.actions).toEqual(['jump', 'updraftOn']);
    expect(b.h.pos.y, 'latched in the air, then pulled up').toBeGreaterThan(1);
    // On the 10.5 m block under the cable: a jump puts the feet within 1.5 m of it by the time the hold counts.
    const c = await bench(line, { x: 0, y: 10.5, z: 10 });
    c.step({ ...HOLD, pressed: Button.Jump });
    c.step(HOLD, 11);
    expect(c.h.motor.updraft).toBe(0);
    c.step(HOLD, 8);
    expect(c.h.pos.y).toBeLessThan(12);
    c.step(HOLD);
    expect(c.h.pos.y, '0.15 s: 9 ticks').toBeCloseTo(12, 6);
  });

  it('rides toward the end the camera faces; a fresh Jump press jumps off with +4 m/s up and 70% of the ride speed', async () => {
    const b = await bench(line, { x: 0, y: 0, z: 1 });
    b.step({ yaw: Math.PI, held: Button.Jump }, 12);
    b.step({ yaw: Math.PI, held: Button.Jump, pressed: Button.Jump }, 40);
    expect(b.h.motor.updraft, 'a press while Jump was never released does nothing').toBe(0);
    expect(b.h.vel.z).toBeCloseTo(-11, 6);
    b.step({ yaw: Math.PI });
    b.step({ yaw: Math.PI, pressed: Button.Jump });
    expect(b.h.motor.updraft).toBeNull();
    expect(b.h.vel.z).toBeCloseTo(-7.7, 6);
    expect(b.h.vel.y).toBeCloseTo(4, 6);
    const y = b.h.pos.y;
    b.step({}, 5);
    expect(b.h.pos.y).toBeGreaterThan(y);
  });

  it('Crouch drops off with 70%; no latch for 1.0 s after leaving, even falling back through reach', async () => {
    const b = await bench(line, { x: 0, y: 0, z: 1 });
    b.step({ yaw: Math.PI, held: Button.Jump }, 60);
    b.step({ yaw: Math.PI, pressed: Button.Crouch });
    expect(b.h.motor.updraft).toBeNull();
    expect(b.h.vel.z).toBeCloseTo(-7.7, 6);
    expect(b.h.vel.y).toBeCloseTo(0, 6);
    b.step({ yaw: Math.PI, held: Button.Jump }, 50);
    expect(b.h.motor.updraft, 'inside the 1.0 s leave lockout').toBeNull();
    b.step({ yaw: Math.PI, held: Button.Jump }, 20);
    expect(b.h.motor.updraft, 'after it, with Jump still held').toBe(0);
  });

  it('no latch for 3 s after enemy hero damage, no boost within 3 s of it; stun forces a dismount', async () => {
    const b = await bench(line, { x: 0, y: 0, z: -20 }, { x: 20, y: 0, z: 20 });
    hitBy(b);
    b.step(HOLD, 170);
    expect(b.h.motor.updraft, 'inside the 3 s damage lockout').toBeNull();
    b.step(HOLD, 20);
    expect(b.h.motor.updraft).toBe(0);
    b.step({ yaw: 0 }, 30);
    hitBy(b);
    b.step({ pressed: Button.Dash });
    expect(b.actions).not.toContain('updraftBoost');
    b.step({}, 179);
    b.step({ pressed: Button.Dash });
    expect(b.actions).toContain('updraftBoost');
    b.sim.ctx.stats.set(b.h.id, 'test', { conditions: ['stunned'] });
    b.step();
    expect(b.h.motor.updraft).toBeNull();
  });

  it('casting an ability dismounts; the Egg carrier cannot latch; the Interact bit does nothing (D-EP-039)', async () => {
    const b = await bench(line, { x: 1, y: 0, z: -31 });
    b.step(HOLD, 30);
    b.sim.ctx.bus.emit({ type: 'ability', caster: b.h.id, slot: 0, ability: 'owl.1', stage: 'start', point: { ...b.h.pos } });
    expect(b.h.motor.updraft).toBeNull();
    const c = await bench(line, { x: 1, y: 0, z: -31 });
    c.sim.ctx.stats.set(c.h.id, 'test', { conditions: ['eggCarrier'] });
    c.step(HOLD, 30);
    expect(c.h.motor.updraft).toBeNull();
    const d = await bench(line, { x: 1, y: 0, z: -31 });
    d.step({ yaw: 0, pressed: RETIRED_BUTTONS.Interact, held: RETIRED_BUTTONS.Interact }, 30);
    expect(d.h.motor.updraft).toBeNull();
  });

  it('PhysicsService.updraftInReach: anywhere along the cable within 2.5 m of its ground line and 0.5–14 m below it, or within 1.5 m of it', async () => {
    const b = await bench(line);
    const reach = b.sim.ctx.physics.updraftInReach;
    if (!reach) throw new Error('physics lands updraftInReach');
    const r = reach({ x: 2, y: 0, z: 17.3 });
    expect(r?.updraft).toBe(0);
    expect(r?.point.x).toBeCloseTo(0, 9);
    expect(r?.point.y).toBeCloseTo(12, 9);
    expect(r?.point.z).toBeCloseTo(17.3, 9);
    expect(r?.t, 'arc length from the first point').toBeCloseTo(47.3, 9);
    expect(reach({ x: 2.6, y: 0, z: 0 })).toBeNull();
    expect(reach({ x: 0, y: -2.5, z: 0 }), '14.5 m below').toBeNull();
    expect(reach({ x: 0, y: 11.6, z: 0 }), 'feet 0.4 m below: only the 1.5 m sphere').not.toBeNull();
    expect(reach({ x: 1.2, y: 12.5, z: 5 }), 'beside and above').not.toBeNull();
    expect(reach({ x: 0, y: 14, z: 5 }), '2 m above').toBeNull();
  });
});

describe('Chimneys and Vines (GDD §3.8)', () => {
  const climbs: Climb[] = [
    { kind: 'chimney', bottom: { x: 20, y: 0, z: -20 }, top: { x: 20, y: 10, z: -20 }, out: { x: 0, y: 0, z: 0 } },
    { kind: 'vine', bottom: { x: -20, y: 0, z: -20.5 }, top: { x: -20, y: 8, z: -20.5 }, out: { x: 0, y: 0, z: -1 } },
  ];
  const map = withArena({ climbs, prims: [box({ x: -20, y: 4, z: -20 }, { x: 4, y: 8, z: 1 })] });

  it('a Chimney lifts at 9 m/s and exits at the top with +6 m/s up', async () => {
    const b = await bench(map, { x: 20, y: 0, z: -24 });
    let t = 0;
    while (b.h.motor.climb === null && t++ < 60) b.step(FWD);
    expect(b.h.motor.climb).toBe(0);
    const y0 = b.h.pos.y;
    b.step({}, 30);
    expect(b.h.pos.y - y0).toBeCloseTo(4.5, 6);
    expect(b.h.vel.y).toBe(9);
    b.step({}, 40);
    // Without steering onto a roof the hero falls back down the warm-air column.
    expect(b.actions).toEqual(['climbOn', 'climbOff']);
    const b2 = await bench(map, { x: 20, y: 0, z: -20 });
    b2.step({}, 67);
    expect(b2.h.pos.y).toBeCloseTo(10, 6);
    expect(b2.h.vel.y).toBe(6);
  });

  it('a Vine climbs at 4.5 m/s holding W, shimmies at 2 m/s and steps onto the wall top', async () => {
    const b = await bench(map, { x: -20, y: 0, z: -24 });
    let t = 0;
    while (b.h.motor.climb === null && t++ < 60) b.step(FWD);
    expect(b.h.motor.climb).toBe(1);
    const y0 = b.h.pos.y;
    b.step(FWD, 60);
    expect(b.h.pos.y - y0).toBeCloseTo(4.5, 6);
    b.step({ forward: 0, right: 1, yaw: 0 }, 15);
    expect(b.h.pos.x).toBeCloseTo(-20 - 0.5, 2);
    expect(b.h.pos.y - y0).toBeCloseTo(4.5, 6);
    t = 0;
    while (b.h.motor.climb !== null && t++ < 60) b.step(FWD);
    expect(b.h.motor.climb).toBeNull();
    expect(b.h.pos.y).toBeCloseTo(8, 3);
    b.step({}, 5);
    expect(b.h.motor.grounded).toBe(true);
    expect(b.actions).toEqual(['climbOn', 'climbOff']);
  });

  it('S climbs down to the bottom; Space jumps off backwards at 5 m/s; grounded blocks climbing', async () => {
    const b = await bench(map, { x: -20, y: 0, z: -24 });
    while (b.h.motor.climb === null) b.step(FWD);
    b.step(FWD, 30);
    b.step({ forward: -1, yaw: 0 }, 40);
    expect(b.h.motor.climb).toBeNull();
    while (b.h.motor.climb === null) b.step(FWD);
    b.step(FWD, 30);
    b.step({ pressed: Button.Jump });
    expect(b.h.motor.climb).toBeNull();
    expect(b.h.vel.z).toBe(-5);
    const c = await bench(map, { x: -20, y: 0, z: -24 });
    c.sim.ctx.stats.set(c.h.id, 'test', { conditions: ['grounded'] });
    c.step(FWD, 60);
    expect(c.h.motor.climb).toBeNull();
  });
});

describe('physics-owned effects', () => {
  it('displace push lands `distance` away on flat ground (± 0.2 m) with 20% air control; pull; unstoppable ignores', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -30 });
    b.apply({ kind: 'displace', mode: 'push', distance: 6 }, {}, b.cause({ x: -20, y: 0, z: -32 }));
    expect(b.h.motor.grounded).toBe(false);
    while (!b.h.motor.grounded) b.step();
    expect(b.h.pos.z + 30).toBeGreaterThan(5.8);
    expect(b.h.pos.z + 30).toBeLessThan(6.2);
    b.place({ x: -20, y: 0, z: -30 });
    b.apply({ kind: 'displace', mode: 'pull', distance: 10 }, {}, b.cause({ x: -20, y: 0, z: -26 }));
    while (!b.h.motor.grounded) b.step();
    expect(b.h.pos.z).toBeCloseTo(-26, 0);
    b.place({ x: -20, y: 0, z: -30 });
    b.sim.ctx.stats.set(b.h.id, 'test', { conditions: ['unstoppable'] });
    b.apply({ kind: 'displace', mode: 'push', distance: 6 }, {}, b.cause({ x: -20, y: 0, z: -32 }));
    expect(b.h.vel.z).toBe(0);
  });

  it('knock-up rises `distance` with no control until landing; a displaced hero stops at a wall', async () => {
    const b = await bench(withArena({ prims: [box({ x: -20, y: 2, z: -27 }, { x: 6, y: 4, z: 0.2 })] }), { x: -20, y: 0, z: -30 });
    b.apply({ kind: 'displace', mode: 'up', distance: 3 });
    let apex = 0;
    while (!b.h.motor.grounded) {
      b.step(FWD);
      apex = Math.max(apex, b.h.pos.y);
      expect(b.h.motor.knockedUp || b.h.motor.grounded).toBe(true);
    }
    expect(apex).toBeCloseTo(3, 1);
    expect(b.h.pos.z).toBeCloseTo(-30, 6);
    b.apply({ kind: 'displace', mode: 'push', distance: 30 }, {}, b.cause({ x: -20, y: 0, z: -32 }));
    b.step({}, 40);
    expect(b.h.pos.z).toBeLessThan(-27.1);
    expect(b.h.vel.z).toBe(0);
  });

  it('dash effect: distance over duration, arc, onHit and stopOnHit against an enemy, onArrive', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -30 });
    const up: Effect = { kind: 'displace', mode: 'up', distance: 0.5 };
    b.apply({ kind: 'dash', distance: 8, durationS: 0.4, dir: 'aim', arcHeight: 2, onArrive: [up] }, { dir: { x: 0, y: 0.3, z: 1 } });
    let top = 0;
    for (let i = 0; i < 24; i++) {
      expect(b.h.motor.dashing).toBe(true);
      b.step();
      top = Math.max(top, b.h.pos.y);
    }
    expect(b.h.motor.dashing).toBe(false);
    expect(b.h.pos.z).toBeCloseTo(-22, 1);
    expect(top).toBeCloseTo(2, 1);
    expect(b.h.motor.knockedUp).toBe(true);

    const c = await bench(null, { x: 0, y: 0, z: -30 }, { x: 0, y: 0, z: -24 });
    const enemy = c.other;
    if (!enemy) throw new Error('no enemy');
    c.apply({ kind: 'dash', distance: 12, durationS: 0.4, dir: 'aim', stopOnHit: true, onHit: [up] });
    c.step({}, 30);
    expect(enemy.motor.knockedUp || enemy.vel.y !== 0).toBe(true);
    expect(c.h.pos.z).toBeGreaterThan(-25.5);
    expect(c.h.pos.z).toBeLessThan(-24);
  });

  it('dash to a target point; teleport to a point, behind a target and to base', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -30 }, { x: 10, y: 0, z: 10 });
    b.apply({ kind: 'dash', distance: 20, durationS: 0.3, dir: 'target' }, { entity: null, point: { x: -20, y: 0, z: -25 } });
    b.step({}, 20);
    expect(b.h.pos.z).toBeCloseTo(-25, 1);
    b.apply({ kind: 'teleport', to: 'point', face: 'keep' }, { entity: null, point: { x: 8, y: 0.5, z: 0 } });
    expect(b.h.pos).toEqual({ x: 8, y: 2, z: 0 });
    const enemy = b.other;
    if (!enemy) throw new Error('no enemy');
    b.apply({ kind: 'teleport', to: 'behindTarget', behind: 2, face: 'target' }, { entity: enemy.id });
    // The enemy faces −z (Dusk spawn yaw), so behind it is +z.
    expect(b.h.pos.z).toBeCloseTo(12, 6);
    expect(b.h.yaw).toBeCloseTo(Math.PI, 6);
    b.apply({ kind: 'teleport', to: 'base', face: 'keep' });
    expect(b.h.pos).toEqual(ARENA.spawns[0]?.pos);
  });

  it('movement modes: glide, flight, hover, cling, toboggan, burrow; onEnd on expiry', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -35 });
    const mode = (kind: 'glide' | 'flight' | 'hover' | 'cling' | 'toboggan' | 'burrow', speed: number, vertical: number): Effect => ({
      kind: 'movementMode', mode: kind, durationS: 1, speed, verticalSpeed: vertical, allowGun: true, allowAbilities: false,
      onEnd: [{ kind: 'displace', mode: 'up', distance: 0.1 }],
    });
    b.place({ x: -20, y: 10, z: -35 });
    b.apply(mode('glide', 8, 2));
    b.step(FWD, 30);
    expect(b.h.motor.mode).toBe('glide');
    expect(b.h.vel.y).toBe(-2);
    expect(b.h.vel.z).toBeCloseTo(8, 6);
    b.step(FWD, 31);
    expect(b.h.motor.mode).toBeNull();
    expect(b.h.motor.knockedUp).toBe(true);

    b.place({ x: -20, y: 0, z: -35 });
    b.apply(mode('flight', 10, 4));
    b.step({ ...FWD, held: Button.Jump }, 30);
    expect(b.h.pos.y).toBeCloseTo(2, 1);
    expect(b.h.vel.z).toBeCloseTo(10, 6);
    b.apply(mode('hover', 6, 0));
    const y = b.h.pos.y;
    b.step(FWD, 30);
    expect(b.h.pos.y).toBeCloseTo(y, 6);
    expect(b.h.vel.z).toBeCloseTo(6, 6);
    b.apply(mode('cling', 0, 0));
    const p = { ...b.h.pos };
    b.step(FWD, 30);
    expect(b.h.pos).toEqual(p);

    b.place({ x: -20, y: 0, z: -35 });
    let z = b.h.pos.z;
    b.apply(mode('toboggan', 12, 0));
    b.step({ yaw: 0 }, 30);
    expect(b.h.pos.z - z).toBeCloseTo(6, 2);
    b.place({ x: -20, y: 0, z: -35 });
    z = b.h.pos.z;
    b.apply(mode('burrow', 9, 0));
    b.step({}, 10);
    expect(b.h.pos.z).toBeCloseTo(z, 6);
    b.step(FWD, 20);
    expect(b.h.pos.z - z).toBeCloseTo(3, 3);
    expect(b.h.motor.mode).toBe('burrow');
  });

  it('Jump ends a toboggan with a 1.2 m hop that keeps its speed; expiry does not hop', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -35 });
    const onEnd: Effect[] = [{ kind: 'heal', amount: 1 }];
    const toboggan: Effect = { kind: 'movementMode', mode: 'toboggan', durationS: 3, speed: 13, verticalSpeed: 0, allowGun: false, allowAbilities: true, onEnd };
    const ended = vi.fn();
    b.sim.ctx.bus.on('heal.applied', ended);
    b.h.health.hp -= 10;
    b.apply(toboggan);
    b.step({ yaw: 0 }, 20);
    b.step({ yaw: 0, pressed: Button.Jump });
    expect(b.h.motor.mode).toBeNull();
    expect(ended).toHaveBeenCalledTimes(1); // the mode's own onEnd
    expect(b.actions.at(-1)).toBe('jump');
    let apex = 0;
    for (let i = 0; i < 40 && !b.h.motor.grounded; i++) {
      b.step({ yaw: 0 });
      apex = Math.max(apex, b.h.pos.y);
      if (!b.h.motor.grounded) expect(flatSpeed(b.h)).toBeCloseTo(13, 6);
    }
    expect(apex).toBeCloseTo(1.2, 1);
    expect(b.h.motor.stamina).toBe(3); // no air-jump pip

    b.place({ x: -20, y: 0, z: -35 });
    b.apply({ ...toboggan, durationS: 0.2 });
    b.step({ yaw: 0 }, 13);
    expect(b.h.motor.mode).toBeNull();
    expect(b.h.motor.grounded).toBe(true);
    expect(b.h.vel.y).toBeLessThanOrEqual(0);
  });

  it('a glide ends itself on landing and on Jump, running its onEnd (GDD §9.5)', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -35 });
    const ended = vi.fn();
    b.sim.ctx.bus.on('heal.applied', ended);
    b.h.health.hp -= 10;
    const glide: Effect = { kind: 'movementMode', mode: 'glide', durationS: 4, speed: 9, verticalSpeed: 2, allowGun: true, allowAbilities: true, onEnd: [{ kind: 'heal', amount: 1 }] };
    b.place({ x: -20, y: 1, z: -35 });
    b.apply(glide);
    b.step(FWD, 20);
    expect(b.h.motor.mode).toBe('glide');
    b.step(FWD, 20);
    expect(b.h.motor.grounded).toBe(true);
    expect(b.h.motor.mode).toBeNull();
    expect(ended).toHaveBeenCalledTimes(1);

    b.place({ x: -20, y: 10, z: -35 });
    b.apply(glide);
    b.step(FWD, 5);
    b.step({ ...FWD, pressed: Button.Jump });
    expect(b.h.motor.mode).toBeNull();
    expect(b.h.motor.grounded).toBe(false);
    expect(ended).toHaveBeenCalledTimes(2);
  });

  it('attach holds the target at the carrier and applies onRelease when it ends', async () => {
    const b = await bench(null, { x: 0, y: 0, z: -30 }, { x: 0, y: 0, z: -27 });
    const victim = b.other;
    if (!victim) throw new Error('no enemy');
    b.apply(
      { kind: 'attach', durationS: 0.5, onRelease: [{ kind: 'displace', mode: 'push', distance: 4 }] },
      { entity: victim.id },
    );
    expect(victim.motor.attachedTo).toBe(b.h.id);
    b.step(FWD, 20);
    expect(victim.pos.z - b.h.pos.z).toBeCloseTo(b.h.radius + victim.radius, 6); // touching, whatever the bodies
    b.step(FWD, 11);
    expect(victim.motor.attachedTo).toBeNull();
    expect(victim.motor.grounded).toBe(false);
  });
});

/** A dusk fledgling-like unit at `pos` (nothing else steers it in the bench). */
const unitAt = (b: Bench, pos: Vec3, height = 1): UnitEntity =>
  b.sim.ctx.store.spawn({
    kind: 'unit',
    team: 'dusk',
    pos: { ...pos },
    vel: { x: 0, y: 0, z: 0 },
    yaw: 0,
    radius: 0.4,
    unit: { type: 'scrapper', lane: null, height, owner: null, summon: null, target: null, attacking: false },
    health: { hp: 100, talonShield: 0, songShield: 0, barrier: 0, dead: false, respawnAt: null, inCombatUntil: 0 },
    stats: b.sim.ctx.stats.create({ maxHealth: 100 }),
    statuses: [],
  });

describe('wave 3 follow-ups (Character Controller 1–5, EP findings)', () => {
  const stun: Effect = { kind: 'applyStatus', status: STUN, durationS: 1.25 };
  const wallMap = withArena({ prims: [box({ x: -20, y: 2, z: -27 }, { x: 6, y: 4, z: 0.2 })] });

  it('a 6 m push travels 6 m (± 0.2) and stops there: no skid after landing; emits displaced', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -30 });
    b.apply({ kind: 'displace', mode: 'push', distance: 6 }, {}, b.cause({ x: -20, y: 0, z: -32 }));
    b.step({}, 90);
    expect(b.h.pos.z + 30).toBeGreaterThan(5.8);
    expect(b.h.pos.z + 30).toBeLessThan(6.2);
    expect(b.actions[0]).toBe('displaced');
  });

  it('wall slam: onWall with the displacement cause and a wallSlam event at ≥ 4 m/s toward the wall, not below', async () => {
    const b = await bench(wallMap, { x: -20, y: 0, z: -31 });
    const cause = b.cause({ x: -20, y: 0, z: -33 });
    b.apply({ kind: 'displace', mode: 'push', distance: 8, onWall: [stun] }, {}, cause);
    b.step({}, 30);
    expect(b.actions).toEqual(['displaced', 'wallSlam', 'land']);
    expect(b.h.stats.conditions.has('stunned')).toBe(true);
    expect(b.h.pos.z).toBeLessThan(-27.1);

    // 0.4 m push: 3.7 m/s horizontal, the wall 0.2 m ahead of the capsule.
    const slow = await bench(wallMap, { x: -20, y: 0, z: -27.7 });
    slow.apply({ kind: 'displace', mode: 'push', distance: 0.4, onWall: [stun] }, {}, slow.cause({ x: -20, y: 0, z: -33 }));
    slow.step({}, 30);
    expect(slow.actions).not.toContain('wallSlam');
    expect(slow.h.stats.conditions.has('stunned')).toBe(false);
  });

  it('teleport face target reports the new yaw on a teleport movement event', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -30 }, { x: 0, y: 0, z: 0 });
    const enemy = b.other;
    if (!enemy) throw new Error('no enemy');
    const yaws: (number | undefined)[] = [];
    b.sim.ctx.bus.on('movement', (e) => {
      if (e.action === 'teleport') yaws.push(e.yaw);
    });
    b.apply({ kind: 'teleport', to: 'behindTarget', behind: 2, face: 'target' }, { entity: enemy.id });
    b.apply({ kind: 'teleport', to: 'point', face: 'keep' }, { entity: null, point: { x: 5, y: 0, z: 5 } });
    expect(yaws).toEqual([Math.PI, undefined]);
  });

  it('a movement mode publishes allowGun and allowAbilities on Motor, back to true when it ends', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -30 });
    b.apply({ kind: 'movementMode', mode: 'burrow', durationS: 0.5, speed: 9, verticalSpeed: 0, allowGun: false, allowAbilities: false });
    expect([b.h.motor.modeAllowsGun, b.h.motor.modeAllowsAbilities]).toEqual([false, false]);
    b.step({}, 31);
    expect([b.h.motor.mode, b.h.motor.modeAllowsGun, b.h.motor.modeAllowsAbilities]).toEqual([null, true, true]);
  });

  it('a target dash whose target entity is the caster goes to the point (Tempest Dive from a point cast)', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -30 });
    b.apply({ kind: 'dash', distance: 30, durationS: 0.9, dir: 'target', arcHeight: 8 }, { entity: b.h.id, point: { x: -20, y: 0, z: -10 } });
    b.step({}, 60);
    expect(b.h.pos.z).toBeCloseTo(-10, 1);
  });

  it('an aim dash follows the aim pitch, at most 30° up; arcHeight keeps it flat', async () => {
    const up = { x: 0, y: Math.sin(Math.PI / 3), z: Math.cos(Math.PI / 3) }; // looking 60° up
    const b = await bench(null, { x: -20, y: 0, z: -30 });
    b.apply({ kind: 'dash', distance: 14, durationS: 0.3, dir: 'aim' }, { dir: up });
    b.step({}, 18);
    expect(b.h.pos.y).toBeCloseTo(14 * Math.sin(Math.PI / 6), 1);
    expect(b.h.pos.z + 30).toBeCloseTo(14 * Math.cos(Math.PI / 6), 1);
    const flatDash = await bench(null, { x: -20, y: 0, z: -30 });
    flatDash.apply({ kind: 'dash', distance: 12, durationS: 0.35, dir: 'aim', arcHeight: 0 }, { dir: up });
    flatDash.step({}, 21);
    // Flat within a few centimetres: the character controller's ground contact varies a little with capsule size.
    expect(Math.abs(flatDash.h.pos.y)).toBeLessThan(0.05);
    expect(flatDash.h.pos.z + 30).toBeCloseTo(12, 1);
  });

  it('honours a flat 0° effect and a positive cap while retaining downward angles', async () => {
    const b = await bench(null, { x: -20, y: 5, z: -30 });
    const up = { x: 0, y: Math.sqrt(0.5), z: Math.sqrt(0.5) };
    const dash = { kind: 'dash', distance: 6, durationS: 0.2, dir: 'aim' } as const;
    b.apply({ ...dash, maxPitchUpDeg: 0 }, { dir: up });
    b.step({}, 12);
    expect(b.h.pos.y).toBeCloseTo(5, 1);
    b.apply({ ...dash, maxPitchUpDeg: 10 }, { dir: up });
    b.step({}, 12);
    expect(b.h.pos.y).toBeCloseTo(5 + 6 * Math.sin(Math.PI / 18), 1);
    b.apply({ ...dash, maxPitchUpDeg: 10 }, { dir: { ...up, y: -up.y } });
    b.step({}, 12);
    expect(b.h.pos.y).toBeCloseTo(5 + 6 * Math.sin(Math.PI / 18) - 6 * Math.sqrt(0.5), 1);
  });

  it('units: displace flies them `distance` (± 0.2) rooted under physics:displaced, then unroots; walls stop and slam them', async () => {
    const b = await bench(wallMap, { x: 10, y: 0, z: 10 });
    const u = unitAt(b, { x: -10, y: 0, z: -30 });
    b.apply({ kind: 'displace', mode: 'push', distance: 6 }, { entity: u.id }, b.cause({ x: -10, y: 0, z: -32 }));
    b.step({}, 2);
    expect(u.stats.conditions.has('rooted')).toBe(true);
    expect(u.pos.y).toBeGreaterThan(0);
    b.step({}, 60);
    expect(u.stats.conditions.has('rooted')).toBe(false);
    expect(u.pos.z + 30).toBeGreaterThan(5.8);
    expect(u.pos.z + 30).toBeLessThan(6.2);
    expect(u.pos.y).toBe(0);
    expect(u.vel).toEqual({ x: 0, y: 0, z: 0 });

    const w = unitAt(b, { x: -20, y: 0, z: -31 });
    b.apply({ kind: 'displace', mode: 'push', distance: 8, onWall: [stun] }, { entity: w.id }, b.cause({ x: -20, y: 0, z: -33 }));
    b.step({}, 60);
    expect(w.pos.z).toBeLessThan(-27.1 - 0.39);
    expect(w.stats.conditions.has('stunned')).toBe(true);
  });

  it('units: a dash moves them; attach holds them at the carrier and releases with onRelease', async () => {
    const b = await bench(null, { x: 0, y: 0, z: -30 });
    const u = unitAt(b, { x: 10, y: 0, z: -30 });
    b.apply({ kind: 'dash', distance: 5, durationS: 0.25, dir: 'aim' }, { entity: u.id, dir: { x: 0, y: 0, z: 1 } });
    b.step({}, 20);
    expect(u.pos.z + 30).toBeCloseTo(5, 3);
    expect(u.stats.conditions.has('rooted')).toBe(false);

    const g = unitAt(b, { x: 0, y: 0, z: -27 });
    b.apply({ kind: 'attach', durationS: 0.5, onRelease: [{ kind: 'displace', mode: 'up', distance: 1 }] }, { entity: g.id });
    b.step(FWD, 20);
    expect(g.pos.z - b.h.pos.z).toBeCloseTo(b.h.radius + g.radius, 6);
    expect(g.stats.conditions.has('rooted')).toBe(true);
    b.step({}, 11);
    expect(g.pos.y).toBeGreaterThan(0);
    b.step({}, 60);
    expect([g.pos.y, g.stats.conditions.has('rooted')]).toEqual([0, false]);
  });
});

describe('Hedgerow traversal run (GDD §3.10) on Old Mossmarket', () => {
  it('dash, dash-jump on the cue, slide, mantle-glide over the 1.2 m hedge, mount, boost over the Hawk, jump off', async () => {
    const sb = await createSandbox({ map: 'main', heroes: [{ hero: 'shrike', at: { x: -90.5, y: 0, z: -66 }, yaw: 0 }] });
    const me = sb.heroes[0]!;
    const h = () => sb.hero(me);
    const actions = () => sb.eventsOf('movement').filter((e) => e.hero === me).map((e) => e.action);
    sb.move(me, 1);
    sb.step(30);
    sb.press(me, Button.Dash);
    sb.step();
    expect(sb.stepUntil(() => h().motor.dashJumpReady === true, 30), 'the cue shows during the dash').not.toBeNull();
    sb.press(me, Button.Jump);
    sb.step();
    expect(h().motor.stamina, 'dash plus dash-jump spend two of three pips').toBeCloseTo(1, 1);
    sb.hold(me, Button.Crouch); // before landing, to carry the speed into a slide
    sb.stepUntil(() => h().motor.grounded, 120);
    expect(h().motor.sliding).toBe(true);
    expect(flatSpeed(h()), 'landing keeps the dash-jump speed').toBeCloseTo(13, 0);

    sb.hold(me, Button.Jump); // into the hedge's face (x −92…−88, z −49…−47.5)
    expect(sb.stepUntil(() => h().motor.mantling, 60)).not.toBeNull();
    sb.stepUntil(() => !h().motor.mantling, 60);
    expect(h().pos.y).toBeCloseTo(1.2, 1);
    expect(h().motor.sliding, 'crouch held: the mantle exits in a slide').toBe(true);
    expect(flatSpeed(h())).toBeGreaterThan(10);
    sb.release(me, Button.Jump | Button.Crouch);

    // On to the station 6 m gateward of the Hawk, then mount facing the bridge.
    expect(sb.stepUntil(() => {
      sb.look(me, Math.atan2(-95 - h().pos.x, -41 - h().pos.z), 0);
      return Math.hypot(h().pos.x + 95, h().pos.z + 41) < 1;
    }, 300)).not.toBeNull();
    sb.move(me, 0);
    sb.look(me, 0, 0);
    sb.hold(me, Button.Jump); // under the cable: the hold latches and pulls the Shrike up (D-EP-039)
    expect(sb.stepUntil(() => h().motor.updraft !== null && h().pos.y > 11.99, 60)).not.toBeNull();
    sb.release(me, Button.Jump);
    sb.press(me, Button.Dash);
    sb.stepUntil(() => h().pos.z >= -35, 120);
    expect(h().pos.y, 'the rider passes 2 m over the 10 m tower cap').toBeCloseTo(12, 3);
    expect(flatSpeed(h())).toBeCloseTo(18, 3);
    sb.press(me, Button.Jump);
    sb.step();
    expect(sb.stepUntil(() => h().motor.grounded, 300), 'a jump off falls back through the line without remounting').not.toBeNull();
    expect(h().motor.updraft).toBeNull();
    expect(actions()).toEqual([
      'dash', 'dashJump', 'land', 'slide', 'mantle', 'slide', 'mantleGlide', 'land',
      'updraftOn', 'updraftBoost', 'updraftOff', 'land',
    ]);
  });
});

describe('robustness', () => {
  it('never tunnels through a 0.1 m wall: dash, 40 m push, 30 m/s fall onto a thin floor', async () => {
    const thin = withArena({
      prims: [box({ x: -20, y: 4, z: -25 }, { x: 10, y: 8, z: 0.1 }), box({ x: 20, y: 5, z: -20 }, { x: 4, y: 0.1, z: 4 })],
    });
    const b = await bench(thin, { x: -20, y: 0, z: -28 });
    b.step({ yaw: 0, pressed: Button.Dash });
    b.step(FWD, 30);
    expect(b.h.pos.z).toBeLessThan(-25.4);
    b.apply({ kind: 'displace', mode: 'push', distance: 40 }, {}, b.cause({ x: -20, y: 0, z: -40 }));
    b.step(FWD, 60);
    expect(b.h.pos.z).toBeLessThan(-25.4);
    b.place({ x: 20, y: 39, z: -20 });
    b.h.vel.y = -30;
    b.step({}, 90);
    expect(b.h.pos.y).toBeCloseTo(5.05, 1);
  });

  it('reseats on hero.respawned and at the kill plane', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -30 });
    b.step({ yaw: 0, pressed: Button.Dash });
    b.place({ x: 5, y: 0, z: 5 });
    expect(b.h.pos.x).toBeCloseTo(5, 4);
    expect(b.h.pos.z).toBeCloseTo(5, 4);
    expect(b.h.pos.y).toBeCloseTo(0, 1);
    expect(b.h.motor.stamina).toBe(3);
    expect(b.h.motor.dashing).toBe(false);
    b.h.pos = { x: 50, y: -20, z: 0 };
    b.step();
    expect(b.h.pos).toEqual(ARENA.spawns[0]?.pos);
  });

  it('an idle hero rests exactly: flat ground, after stopping, on the 18° ramp, on the main map (W2 review defect)', async () => {
    const still = (b: { h: HeroEntity; step: Bench['step'] }, ticks: number): void => {
      const snap = () => JSON.stringify({ pos: b.h.pos, vel: b.h.vel, motor: b.h.motor });
      const before = snap();
      b.step({}, ticks);
      expect(snap()).toBe(before);
      expect(b.h.motor.grounded).toBe(true);
    };
    const b = await bench(null, { x: -20, y: 0, z: -30 });
    still(b, 300);
    expect(b.h.pos).toEqual({ x: -20, y: 0, z: -30 });
    b.step(FWD, 30);
    b.step({}, 15);
    still(b, 300);
    b.place({ x: -8, y: 1.6, z: 0.5 });
    b.step({}, 30);
    expect(b.h.pos.y).toBeGreaterThan(1);
    still(b, 300);
    // Walking off the box still falls: the rest band never holds a hero in the air.
    b.place({ x: 8, y: 2, z: 0.9 });
    b.step({}, 10);
    still(b, 60);
    b.step({ forward: 1, yaw: 0 }, 20);
    b.step({}, 40);
    expect(b.h.pos.y).toBeCloseTo(0, 3);

    const sim = await createSim({ seed: 1, map: 'main', roster: [{ team: 'dawn', hero: 'kingfisher', controller: 'human' }] });
    const [h] = sim.ctx.store.list('hero');
    if (!h) throw new Error('no hero');
    const step: Bench['step'] = (_cmd, n = 1) => {
      for (let i = 0; i < n; i++) sim.step([{ hero: h.id, command: { ...IDLE_COMMAND } }]);
    };
    step({}, 30);
    still({ h, step }, 600);
  });

  it('is deterministic: identical command scripts give identical positions and hashes', async () => {
    const script = async () => {
      const b = await bench(withArena({ prims: [box({ x: -20, y: 1.1, z: -20 }, { x: 6, y: 2.2, z: 4 })] }), { x: -20, y: 0, z: -35 });
      for (let t = 0; t < 600; t++) {
        const pressed = t % 97 === 0 ? Button.Dash : t % 41 === 0 ? Button.Jump : t % 150 === 5 ? Button.Crouch : 0;
        b.step({ forward: 1, right: Math.sin(t / 50), yaw: Math.sin(t / 80) * 0.5, pressed, held: Button.Jump | (t % 150 < 40 ? Button.Crouch : 0) });
      }
      return { pos: { ...b.h.pos }, hash: b.sim.hash(), actions: b.actions.join() };
    };
    const [a, c] = [await script(), await script()];
    expect(a).toEqual(c);
    expect(a.actions).toContain('mantle');
  });
});

describe('wave 5: interiors, Bough Springs and the Cellar Run (GDD §§6.8, 6.11, 7.15)', () => {
  /** One two-storey kit building (x −30…−16, z −30…−16): a door north, a shot window west, an ivy arch east. */
  const filler = (centre: Vec3, size: Vec3, blocks: 'movement' | 'sight'): BlockoutPrim => ({ ...box(centre, size), blocks });
  const house: MapData = withArena({
    prims: [
      box({ x: -23, y: 4, z: -29.75 }, { x: 14, y: 8, z: 0.5 }),
      box({ x: -27.1, y: 4, z: -16.25 }, { x: 5.8, y: 8, z: 0.5 }),
      box({ x: -18.9, y: 4, z: -16.25 }, { x: 5.8, y: 8, z: 0.5 }),
      box({ x: -23, y: 5.5, z: -16.25 }, { x: 2.4, y: 5, z: 0.5 }),
      box({ x: -29.75, y: 4, z: -27.4 }, { x: 0.5, y: 8, z: 5.2 }),
      box({ x: -29.75, y: 4, z: -19.6 }, { x: 0.5, y: 8, z: 7.2 }),
      box({ x: -29.75, y: 0.6, z: -24 }, { x: 0.5, y: 1.2, z: 1.6 }),
      box({ x: -29.75, y: 5.1, z: -24 }, { x: 0.5, y: 5.8, z: 1.6 }),
      filler({ x: -29.75, y: 1.7, z: -24 }, { x: 0.5, y: 1, z: 1.6 }, 'movement'),
      box({ x: -16.25, y: 4, z: -27.1 }, { x: 0.5, y: 8, z: 5.8 }),
      box({ x: -16.25, y: 4, z: -18.9 }, { x: 0.5, y: 8, z: 5.8 }),
      box({ x: -16.25, y: 5.5, z: -23 }, { x: 0.5, y: 5, z: 2.4 }),
      filler({ x: -16.25, y: 1.5, z: -23 }, { x: 0.1, y: 3, z: 2.4 }, 'sight'),
      // Upper floor (top at 4 m) around the stairwell; stairs 2 m wide rising 4 m over 8 m (26.6°) along +x; roof at 8 m.
      box({ x: -23, y: 3.8, z: -21.75 }, { x: 14, y: 0.4, z: 11.5 }),
      box({ x: -18.75, y: 3.8, z: -28.75 }, { x: 5.5, y: 0.4, z: 2.5 }),
      { shape: 'ramp', centre: { x: -25.5, y: 2, z: -28.5 }, size: { x: 2, y: 4, z: 8 }, yaw: Math.PI / 2, material: 'wood', solid: true },
      box({ x: -23, y: 7.8, z: -23 }, { x: 14, y: 0.4, z: 14 }),
    ],
    climbs: [{ kind: 'ladder', bottom: { x: -19, y: 0, z: -16 }, top: { x: -19, y: 8, z: -16 }, out: { x: 0, y: 0, z: 1 } }],
    rooms: [
      { building: 0, storey: 0, volume: { centre: { x: -23, y: 1.8, z: -23 }, size: { x: 13, y: 3.6, z: 13 }, yaw: 0 } },
      { building: -1, storey: -1, volume: { centre: { x: 10, y: 1.5, z: -30 }, size: { x: 30, y: 3, z: 6 }, yaw: 0 }, tag: 'tunnel' },
    ],
    openings: [
      { kind: 'door', rooms: [0, -1], centre: { x: -23, y: 1.5, z: -16.25 }, width: 2.4, height: 3, yaw: 0, passable: true, blocksEggCarrier: true },
    ],
    springs: [{ pad: { x: 8, y: 0, z: -6 }, radius: 1.2, land: { x: 8, y: 2, z: 0 }, apexY: 5 }],
  });
  const NORTH = Math.PI;
  const EAST = Math.PI / 2;
  const WEST = -Math.PI / 2;

  it('walks in through a door, up the stairs onto the upper floor; queries see both floors', async () => {
    const b = await bench(house, { x: -23, y: 0, z: -12 });
    b.step({ forward: 1, yaw: NORTH }, 60);
    expect(b.h.pos.z, 'through the 2.4 m door').toBeLessThan(-17);
    b.place({ x: -29, y: 0, z: -28.5 });
    b.step({ forward: 1, yaw: EAST }, 120);
    expect(b.h.pos.y, 'on the upper floor').toBeCloseTo(4, 1);
    expect(b.h.pos.x).toBeGreaterThan(-21.5);
    expect(b.h.motor.grounded).toBe(true);
    const ps = b.sim.ctx.physics;
    expect(ps.groundHeight(-20, -20, 6)).toBeCloseTo(4, 6);
    expect(ps.groundHeight(-20, -20, 3)).toBeCloseTo(0, 6);
    expect(ps.raycast({ x: -20, y: 6, z: -20 }, { x: 0, y: -1, z: 0 }, 10, LAYERS_SOLID)?.distance).toBeCloseTo(2, 6);
  });

  it('a shot window passes bullets and sight but no hero; an ivy curtain stops only sight queries and is walked through', async () => {
    const b = await bench(house, { x: -28.5, y: 0, z: -24 });
    const ps = b.sim.ctx.physics;
    const west = { x: -1, y: 0, z: 0 };
    expect(ps.raycast({ x: -28, y: 1.7, z: -24 }, west, 5, LAYERS_SOLID), 'bullets and sight pass the window').toBeNull();
    expect(ps.raycast({ x: -28, y: 1.7, z: -24 }, west, 5, MOVE_MASK)?.distance).toBeCloseTo(1.5, 6);
    b.step({ forward: 1, yaw: WEST, held: Button.Jump }, 60);
    expect(b.h.pos.x, 'no hero through the window').toBeGreaterThan(-29.5);
    expect(b.h.pos.y).toBeLessThan(1);
    const east = { x: 1, y: 0, z: 0 };
    expect(ps.raycast({ x: -17.5, y: 1.5, z: -23 }, east, 3, LAYERS_SOLID), 'shots pass the ivy').toBeNull();
    expect(ps.raycast({ x: -17.5, y: 1.5, z: -23 }, east, 3, LAYERS_SOLID | PHYSICS_LAYERS.sight)?.distance).toBeCloseTo(1.2, 6);
    b.place({ x: -18, y: 0, z: -23 });
    b.step({ forward: 1, yaw: EAST }, 60);
    expect(b.h.pos.x, 'walked out through the curtain').toBeGreaterThan(-15);
  });

  it('a ladder climbs like a Vine: move into it holding forward, over the top onto the roof', async () => {
    const b = await bench(house, { x: -19, y: 0, z: -15.4 });
    b.step({ forward: 1, yaw: NORTH }, 150);
    expect(b.actions).toEqual(['climbOn', 'climbOff']);
    expect(b.h.pos.y).toBeCloseTo(8, 2);
    expect(b.h.pos.z).toBeLessThan(-16);
    expect(b.h.motor.grounded).toBe(true);
  });

  it('a blocksEggCarrier opening stops the Egg carrier only (the Cellar Run stair heads)', async () => {
    const b = await bench(house, { x: -23, y: 0, z: -12 });
    b.sim.ctx.stats.set(b.h.id, 'test', { conditions: ['eggCarrier'] });
    b.step({ forward: 1, yaw: NORTH }, 90);
    expect(b.h.pos.z, 'the carrier stays outside').toBeGreaterThan(-16);
    b.sim.ctx.stats.set(b.h.id, 'test', null);
    b.step({ forward: 1, yaw: NORTH }, 60);
    expect(b.h.pos.z).toBeLessThan(-17);
  });

  it('the Cellar Run: run speed ×1.3 inside a tunnel room; the sprint bonus is not scaled', async () => {
    const b = await bench(house, { x: -2, y: 0, z: -30 });
    b.step({ forward: 1, yaw: EAST }, 30);
    expect(b.h.vel.x).toBeCloseTo(7 * 1.3, 6);
    b.place({ x: -2, y: 0, z: -20 });
    b.step({ forward: 1, yaw: EAST }, 30);
    expect(b.h.vel.x).toBeCloseTo(7, 6);
    b.place({ x: -2, y: 0, z: -30 });
    b.h.health.inCombatUntil = 0;
    b.step({ forward: 1, yaw: EAST }, 40);
    expect(b.h.vel.x, 'run 9.1 + sprint 2').toBeCloseTo(7 * 1.3 + 2, 6);
  });

  it('a Bough Spring launches along its arc to the landing point, once per 1.0 s; not while grounded or carrying the Egg', async () => {
    const b = await bench(house, { x: 8, y: 0, z: -9 });
    for (let i = 0; i < 60 && b.h.vel.y <= 0; i++) b.step({ forward: 1, yaw: 0 });
    expect(b.actions).toEqual(['jump']);
    let top = 0;
    for (let i = 0; i < 120 && !(b.h.motor.grounded && b.h.pos.y > 1); i++) {
      b.step();
      top = Math.max(top, b.h.pos.y);
    }
    expect(top, 'the authored apex').toBeCloseTo(5, 1);
    expect(Math.hypot(b.h.pos.x - 8, b.h.pos.z), 'on the landing point').toBeLessThan(0.3);
    expect(b.h.pos.y).toBeCloseTo(2, 2);
    // Put back on the pad 0.2 s into a launch: the next launch waits for the 1.0 s.
    const pad = { x: 8, y: 0, z: -6 };
    const launches: number[] = [];
    b.sim.ctx.bus.on('movement', (e) => {
      if (e.hero === b.h.id && e.action === 'jump') launches.push(b.sim.tick);
    });
    b.apply({ kind: 'teleport', to: 'point', face: 'keep' }, { point: pad });
    b.step({}, 12);
    b.apply({ kind: 'teleport', to: 'point', face: 'keep' }, { point: pad });
    b.step({}, 60);
    expect(launches).toHaveLength(2);
    expect((launches[1] ?? 0) - (launches[0] ?? 0)).toBe(60);
    for (const condition of ['grounded', 'eggCarrier'] as const) {
      const c = await bench(house);
      c.sim.ctx.stats.set(c.h.id, 'test', { conditions: [condition] });
      c.place(pad);
      c.step({}, 30);
      expect(c.h.pos.y, condition).toBeCloseTo(0, 6);
    }
  });

  it('enemy hero damage in the first 0.6 s clips a launch: no more rise, and a 30% slow for 1.5 s', async () => {
    const b = await bench(house, { x: 8, y: 0, z: -6 }, { x: 20, y: 0, z: 20 });
    b.step({}, 18);
    expect(b.h.vel.y).toBeGreaterThan(0);
    const other = b.other;
    if (!other) throw new Error('no enemy');
    b.sim.ctx.bus.emit({
      type: 'damage.applied', source: other.id, sourceTeam: 'dusk', target: b.h.id, targetKind: 'hero', amount: 10,
      absorbed: 0, damageType: 'talon', via: 'weapon', ability: null, item: null, beakShot: false, weakPoint: false,
      proc: false, lethal: false, pos: { ...b.h.pos },
    });
    expect(b.h.vel.y).toBe(0);
    expect(b.h.stats.final.slow).toBeCloseTo(0.3, 6);
    const y = b.h.pos.y;
    b.step();
    expect(b.h.pos.y).toBeLessThan(y);
    b.step({}, 92);
    expect(b.h.stats.final.slow).toBe(0);
  });

  it('a structure with solid: false has no collider (Twig and Keepsake Nests); a solid one blocks', async () => {
    const b = await bench(house, { x: 0, y: 0, z: -25 });
    const nest = (x: number, solid: boolean) => b.sim.ctx.store.spawn({
      kind: 'structure', team: 'neutral', pos: { x, y: 0, z: -20 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, radius: 0.6,
      structure: { type: 'nest', lane: null, phase: 1, target: null, body: { radius: 0.6, height: 1 }, weakPoint: null, variant: 'twig', solid },
      health: { hp: 50, talonShield: 0, songShield: 0, barrier: 0, dead: false, respawnAt: null, inCombatUntil: 0 },
      stats: b.sim.ctx.stats.create({ maxHealth: 50 }),
      statuses: [],
    });
    nest(0, false);
    nest(4, true);
    b.step();
    const ps = b.sim.ctx.physics;
    const down = { x: 0, y: -1, z: 0 };
    expect(ps.raycast({ x: 0, y: 3, z: -20 }, down, 5, Layer.Structure)).toBeNull();
    expect(ps.raycast({ x: 4, y: 3, z: -20 }, down, 5, Layer.Structure)?.distance).toBeCloseTo(2, 6);
    b.step({ forward: 1, yaw: 0 }, 60);
    expect(b.h.pos.z, 'walked through the twig nest').toBeGreaterThan(-19);
    b.place({ x: 4, y: 0, z: -25 });
    b.step({ forward: 1, yaw: 0 }, 60);
    expect(b.h.pos.z, 'stopped by the woven one').toBeLessThan(-20);
  });
});

describe('wave 5: movement modes, steering and surface dashes', () => {
  const mode = (kind: 'hover' | 'flight' | 'cling', endOn?: ('land' | 'jump')[]): Effect => ({
    kind: 'movementMode', mode: kind, durationS: 5, speed: 6, verticalSpeed: 4, allowGun: true, allowAbilities: true,
    ...(endOn ? { endOn } : {}),
  });

  it('endOn: Jump ends a hover or a cling, landing ends a flight; without endOn a hover ignores Jump', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -30 });
    b.apply(mode('hover'));
    b.step({ pressed: Button.Jump });
    expect(b.h.motor.mode, 'no endOn: Jump climbs').toBe('hover');
    b.apply(mode('hover', ['jump']));
    b.step({ pressed: Button.Jump });
    expect(b.h.motor.mode).toBeNull();
    b.place({ x: -20, y: 3, z: -30 });
    b.apply(mode('flight', ['land']));
    b.step({ held: Button.Crouch }, 60);
    expect(b.h.motor.mode, 'landed').toBeNull();
    expect(b.h.motor.grounded).toBe(true);
    b.place({ x: -20, y: 3, z: -30 });
    b.apply(mode('cling', ['jump']));
    b.step({}, 10);
    expect(b.h.motor.mode).toBe('cling');
    expect(b.h.pos.y).toBeCloseTo(3, 6);
    b.step({ pressed: Button.Jump });
    expect(b.h.motor.mode).toBeNull();
  });

  it('an aim dash whose cause values carry steerDeg follows the aim, at most that far from its start (Rampage)', async () => {
    const charge: Effect = { kind: 'dash', distance: 20, durationS: 1, dir: 'aim', arcHeight: 0 };
    const run = async (values: Record<string, number> | null): Promise<number> => {
      const b = await bench(null, { x: 0, y: 0, z: -35 });
      b.apply(charge, { dir: { x: 0, y: 0, z: 1 } }, { ...b.cause(), values });
      b.step({ yaw: 0 }, 10);
      b.step({ yaw: Math.PI / 2 }, 10);
      return Math.atan2(b.h.vel.x, b.h.vel.z);
    };
    expect(await run(null)).toBeCloseTo(0, 6);
    expect(await run({ [STEER_VALUE]: 30 })).toBeCloseTo(Math.PI / 6, 6);
  });

  it('a target dash from a surface cast flies straight to the wall point and clings there (Tree Cling)', async () => {
    const wall = withArena({ prims: [box({ x: 0, y: 4, z: -25 }, { x: 6, y: 8, z: 1 })] });
    const run = async (values: Record<string, number> | null) => {
      const b = await bench(wall, { x: 0, y: 0, z: -33 });
      const point = { x: 0, y: 5, z: -25.5 };
      b.apply(
        { kind: 'dash', distance: 12, durationS: 0.25, dir: 'target', arcHeight: 0, onArrive: [mode('cling')] },
        { entity: b.h.id, point },
        { ...b.cause(), values },
      );
      b.step({}, 20);
      return b.h;
    };
    const h = await run({ [SURFACE_VALUE]: 1 });
    expect(h.motor.mode).toBe('cling');
    expect(h.pos.y).toBeCloseTo(5, 1);
    expect(-25.5 - h.pos.z).toBeCloseTo(h.radius, 1);
    const flat = await run(null);
    expect(flat.pos.y, 'an ordinary target dash stays on the floor').toBeLessThan(0.5);
  });
});
