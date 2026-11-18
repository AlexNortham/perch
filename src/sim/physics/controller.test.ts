/**
 * Hero controller and physics-owned effects against GDD §3 numbers, on the arena plus small fixture maps.
 * Tolerances are stated per assertion; "tick" is 1/60 s.
 */
import { describe, expect, it, vi } from 'vitest';
import { Button, IDLE_COMMAND } from '../core/contracts';
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
  Vec3,
} from '../core/contracts';
import { createSim } from '../index';
import { ARENA } from '../world/map';

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
  const drain = (): void => {
    for (const e of sim.drainEvents()) if (e.type === 'movement' && e.hero === h.id) actions.push(e.action);
  };
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
    b.step({ ...FWD, held: Button.Crouch }, 30);
    expect(b.h.motor.crouching).toBe(true);
    expect(b.h.vel.z).toBeCloseTo(3.5, 6);
    b.sim.ctx.stats.set(b.h.id, 'test:slow', { stats: [{ stat: 'slow', op: 'max', value: 0.5 }] });
    b.step(FWD, 30);
    expect(b.h.vel.z).toBeCloseTo(3.5, 6);
    b.sim.ctx.stats.set(b.h.id, 'test:slow', { stats: [{ stat: 'slow', op: 'max', value: 0.9 }] });
    b.step(FWD, 30);
    expect(b.h.vel.z).toBeCloseTo(1.5, 6);
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

  it('buffers a jump pressed 0.1 s before landing and keeps run speed with air control', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -30 });
    b.step({ pressed: Button.Jump });
    b.step({}, 36);
    expect(b.h.motor.grounded).toBe(false);
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

  it('dash-jump launches at 13 m/s and 7 m/s: ~1.0 m apex, 7.3 m ± 0.15 leap on flat ground, no extra pip', async () => {
    const b = await bench(null, { x: -20, y: 0, z: -35 });
    b.step({ yaw: 0, pressed: Button.Dash });
    b.step({}, 3);
    b.step({ pressed: Button.Jump });
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
    expect(b.h.motor.stamina).toBeLessThan(2.2);
    expect(b.actions).toEqual(['dash', 'dashJump', 'land']);
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
      b.step(FWD);
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

  it('also mantles 2.2 m from a jump, never a 2.6 m ledge (even jumping), and not while rooted', async () => {
    const b = await bench(wall(2.2), { x: -20, y: 0, z: -27.2 });
    b.step({ ...FWD, pressed: Button.Jump });
    b.step(FWD, 40);
    expect(b.actions).toContain('mantle');
    const c = await bench(wall(2.6), { x: -20, y: 0, z: -32 });
    for (let i = 0; i < 10; i++) {
      c.step({ ...FWD, pressed: Button.Jump });
      c.step(FWD, 40);
    }
    expect(c.actions).not.toContain('mantle');
    expect(c.h.pos.y).toBeLessThan(0.1);
    const d = await bench(wall(2.2), { x: -20, y: 0, z: -27.2 });
    d.sim.ctx.stats.set(d.h.id, 'test', { conditions: ['rooted'] });
    d.step(FWD, 30);
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

  it('rides station to station: mount 0.3 s, 11 m/s, boost 18 m/s for 3 s (12 s cooldown), drops off the end', async () => {
    const b = await bench(line, { x: 1, y: 0, z: -31 });
    b.step({ yaw: 0, pressed: Button.Interact });
    expect(b.h.motor.updraft).toBe(0);
    b.step({ yaw: 0 }, 17);
    expect(b.h.pos.y).toBeLessThan(12);
    b.step({ yaw: 0 });
    expect(b.h.pos.y).toBeCloseTo(12, 6);
    b.step({ yaw: 0 }, 30);
    expect(b.h.vel.z).toBeCloseTo(11, 6);
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

  it('rides toward the end the camera faces; Space dismounts with +4 m/s up and 70% of the ride speed', async () => {
    const b = await bench(line, { x: 0, y: 0, z: 1 });
    b.step({ yaw: Math.PI, pressed: Button.Interact });
    b.step({ yaw: Math.PI }, 40);
    expect(b.h.vel.z).toBeCloseTo(-11, 6);
    b.step({ yaw: Math.PI, pressed: Button.Jump });
    expect(b.h.motor.updraft).toBeNull();
    expect(b.h.vel.z).toBeCloseTo(-7.7, 6);
    expect(b.h.vel.y).toBeCloseTo(4, 6);
    const y = b.h.pos.y;
    b.step({}, 5);
    expect(b.h.pos.y).toBeGreaterThan(y);
  });

  it('mounts by jumping into the line; no boost within 3 s of hero damage; stun forces a dismount', async () => {
    const b = await bench(line, { x: 0, y: 10.5, z: 10 }, { x: 20, y: 0, z: 20 });
    // Facing −z: 40 m of line ahead, enough for the 3 s lock below.
    b.step({ yaw: Math.PI, pressed: Button.Jump });
    b.step({ yaw: Math.PI }, 3);
    expect(b.h.motor.updraft).toBe(0);
    const other = b.other;
    if (!other) throw new Error('no enemy');
    b.sim.ctx.bus.emit({
      type: 'damage.applied', source: other.id, sourceTeam: 'dusk', target: b.h.id, targetKind: 'hero', amount: 10,
      absorbed: 0, damageType: 'talon', via: 'weapon', ability: null, item: null, beakShot: false, weakPoint: false,
      proc: false, lethal: false, pos: { ...b.h.pos },
    });
    b.step({ pressed: Button.Dash });
    expect(b.actions).not.toContain('updraftBoost');
    b.step({}, 179);
    b.step({ pressed: Button.Dash });
    expect(b.actions).toContain('updraftBoost');
    b.sim.ctx.stats.set(b.h.id, 'test', { conditions: ['stunned'] });
    b.step();
    expect(b.h.motor.updraft).toBeNull();
  });

  it('casting an ability dismounts; the Egg carrier cannot mount', async () => {
    const b = await bench(line, { x: 1, y: 0, z: -31 });
    b.step({ yaw: 0, pressed: Button.Interact }, 30);
    b.sim.ctx.bus.emit({ type: 'ability', caster: b.h.id, slot: 0, ability: 'owl.1', stage: 'start', point: { ...b.h.pos } });
    expect(b.h.motor.updraft).toBeNull();
    const c = await bench(line, { x: 1, y: 0, z: -31 });
    c.sim.ctx.stats.set(c.h.id, 'test', { conditions: ['eggCarrier'] });
    c.step({ yaw: 0, pressed: Button.Interact });
    expect(c.h.motor.updraft).toBeNull();
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
    expect(b.h.pos.x).toBeCloseTo(-20 - 0.5, 3);
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
    expect(b.h.pos.z - z).toBeCloseTo(6, 3);
    b.place({ x: -20, y: 0, z: -35 });
    z = b.h.pos.z;
    b.apply(mode('burrow', 9, 0));
    b.step({}, 10);
    expect(b.h.pos.z).toBeCloseTo(z, 6);
    b.step(FWD, 20);
    expect(b.h.pos.z - z).toBeCloseTo(3, 3);
    expect(b.h.motor.mode).toBe('burrow');
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
    expect(victim.pos.z - b.h.pos.z).toBeCloseTo(0.8, 6);
    b.step(FWD, 11);
    expect(victim.motor.attachedTo).toBeNull();
    expect(victim.motor.grounded).toBe(false);
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

  it('is deterministic: identical command scripts give identical positions and hashes', async () => {
    const script = async () => {
      const b = await bench(withArena({ prims: [box({ x: -20, y: 1.1, z: -20 }, { x: 6, y: 2.2, z: 4 })] }), { x: -20, y: 0, z: -35 });
      for (let t = 0; t < 600; t++) {
        const pressed = t % 97 === 0 ? Button.Dash : t % 41 === 0 ? Button.Jump : t % 150 === 5 ? Button.Crouch : 0;
        b.step({ forward: 1, right: Math.sin(t / 50), yaw: Math.sin(t / 80) * 0.5, pressed, held: t % 150 < 40 ? Button.Crouch : 0 });
      }
      return { pos: { ...b.h.pos }, hash: b.sim.hash(), actions: b.actions.join() };
    };
    const [a, c] = [await script(), await script()];
    expect(a).toEqual(c);
    expect(a.actions).toContain('mantle');
  });
});
