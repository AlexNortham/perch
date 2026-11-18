/**
 * The hero character controller (GDD §3), run in the movement phase from each hero's latched command: walk, sprint,
 * jump, air control, crouch, slide, dash, dash-jump, mantle, stamina, Updrafts, Chimneys, Vines, knockback state, and
 * the scripted motions physics-owned effects start (ability dashes, movement modes, attach). One state machine per
 * hero; exactly one of these runs per tick, first match wins: dead, attached, mantle, ability dash, Updraft ride,
 * climb, movement mode, ordinary locomotion.
 */
import { Button, LAYERS_SOLID } from '../core/contracts';
import type {
  CoreContext,
  Effect,
  EffectCause,
  EntityId,
  HeroEntity,
  Hasher,
  MovementAction,
  MovementModeKind,
  PhysicsService,
  Vec3,
} from '../core/contracts';
import { lookDir } from '../core/aim';
import { clamp, copy, ticks } from '../core/math';
import { TICK_SECONDS } from '../data/core';
import { AIR, CHIMNEY, CONTROLLER, DASH, DISPLACE, GROUND, MANTLE, SLIDE, UPDRAFT, VINE } from '../data/movement';
import type { MoveResult, Space } from './rapier';

const dt = TICK_SECONDS;
const NEVER = Number.NEGATIVE_INFINITY;

const HALF = 0.5;
const ARC = 4;
const WALKABLE_NY = Math.cos(GROUND.maxSlope);
const SLIDE_MIN_SLOPE_TAN = Math.tan(SLIDE.minSlope);
const JUMP_SPEED = Math.sqrt(2 * AIR.gravity * AIR.jumpApex);
/** Mantle probes start this far above the highest reachable ledge. */
const PROBE_PAD = 0.05;
const DOWN = { x: 0, y: -1, z: 0 };

const T = {
  coyote: ticks(AIR.coyoteS),
  buffer: ticks(AIR.jumpBufferS),
  land: ticks(AIR.landEventMinAirS),
  dash: ticks(DASH.durationS),
  lockout: ticks(DASH.lockoutS),
  dashJump: ticks(DASH.jumpWindowS),
  slideBoost: ticks(SLIDE.boostCooldownS),
  mantle: ticks(MANTLE.durationS),
  mount: ticks(UPDRAFT.mountS),
  boost: ticks(UPDRAFT.boostS),
  boostCooldown: ticks(UPDRAFT.boostCooldownS),
  boostLock: ticks(UPDRAFT.boostDamageLockS),
  remount: ticks(UPDRAFT.remountDelayS),
  knockUp: ticks(DISPLACE.knockUpMaxS),
} as const;

/** An ability dash (DashEffect) in progress. */
interface ScriptedDash {
  readonly dirX: number;
  readonly dirZ: number;
  /** Horizontal metres per tick. */
  readonly step: number;
  readonly n: number;
  t: number;
  readonly arc: number;
  readonly stopOnHit: boolean;
  /** Leave at run speed + 1 (aim and move dashes); dashes to a target, or cut short, stop dead. */
  readonly keepSpeed: boolean;
  readonly onHit: readonly Effect[];
  readonly onArrive: readonly Effect[];
  readonly cause: EffectCause;
  readonly hit: EntityId[];
}

/** A movement mode (MovementModeEffect) in progress. */
interface Mode {
  readonly kind: MovementModeKind;
  readonly until: number;
  readonly speed: number;
  readonly vertical: number;
  readonly onCollide: readonly Effect[];
  readonly onEnd: readonly Effect[];
  readonly cause: EffectCause;
  readonly hit: EntityId[];
}

interface Ride {
  readonly line: number;
  s: number;
  readonly dir: 1 | -1;
  /** Ticks of the 0.3 s mount left. */
  mount: number;
  readonly from: Vec3;
  boostUntil: number;
}

interface Attach {
  readonly to: EntityId;
  readonly until: number;
  readonly onRelease: readonly Effect[];
  readonly cause: EffectCause;
}

interface Mantle {
  t: number;
  readonly from: Vec3;
  readonly to: Vec3;
  readonly exitX: number;
  readonly exitZ: number;
}

/** Private per-hero state (plain data, folded into the hash). Tick fields are absolute ticks. */
export interface HeroState {
  lastGroundTick: number;
  /** Feet height where the hero last stood (mantle reach is measured from here). */
  groundY: number;
  /** Drop per metre along the last grounded move (positive downhill); slides speed up on slopes. */
  downhill: number;
  airTicks: number;
  jumpBufferUntil: number;
  dashUntil: number;
  dashX: number;
  dashZ: number;
  dashSpeed: number;
  dashGround: boolean;
  dashEnded: number;
  nextDashAt: number;
  airDashUsed: boolean;
  /** Sprint ramp 0..1. */
  sprint: number;
  slideX: number;
  slideZ: number;
  slideSpeed: number;
  slideDecel: number;
  slideBoostAt: number;
  mantle: Mantle | null;
  ride: Ride | null;
  boostReadyAt: number;
  heroDamagedAt: number;
  remountAt: number;
  vineSide: number;
  displaced: boolean;
  knockUpUntil: number;
  dash: ScriptedDash | null;
  mode: Mode | null;
  attach: Attach | null;
}

function freshState(groundY: number): HeroState {
  return {
    lastGroundTick: NEVER,
    groundY,
    downhill: 0,
    airTicks: 0,
    jumpBufferUntil: NEVER,
    dashUntil: NEVER,
    dashX: 0,
    dashZ: 1,
    dashSpeed: 0,
    dashGround: false,
    dashEnded: NEVER,
    nextDashAt: NEVER,
    airDashUsed: false,
    sprint: 0,
    slideX: 0,
    slideZ: 1,
    slideSpeed: 0,
    slideDecel: 0,
    slideBoostAt: NEVER,
    mantle: null,
    ride: null,
    boostReadyAt: NEVER,
    heroDamagedAt: NEVER,
    remountAt: NEVER,
    vineSide: 0,
    displaced: false,
    knockUpUntil: NEVER,
    dash: null,
    mode: null,
    attach: null,
  };
}

/** An Updraft polyline with cumulative lengths. */
interface Line {
  readonly points: readonly Vec3[];
  readonly cum: readonly number[];
  readonly length: number;
}

function makeLine(points: readonly Vec3[]): Line {
  const cum = [0];
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b) length += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    cum.push(length);
  }
  return { points, cum, length };
}

/** Arc length of the point on `line` closest to `p`, and the squared distance to it. */
function closestOnLine(line: Line, p: Vec3): { s: number; d2: number } {
  let best = { s: 0, d2: Number.POSITIVE_INFINITY };
  for (let i = 1; i < line.points.length; i++) {
    const a = line.points[i - 1];
    const b = line.points[i];
    const start = line.cum[i - 1];
    if (!a || !b || start === undefined) continue;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const ez = b.z - a.z;
    const len2 = ex * ex + ey * ey + ez * ez;
    const t = len2 > 0 ? clamp(((p.x - a.x) * ex + (p.y - a.y) * ey + (p.z - a.z) * ez) / len2, 0, 1) : 0;
    const dx = a.x + ex * t - p.x;
    const dy = a.y + ey * t - p.y;
    const dz = a.z + ez * t - p.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < best.d2) best = { s: start + Math.sqrt(len2) * t, d2 };
  }
  return best;
}

/** Point at arc length `s` (clamped) into `out`, unit tangent into `tan`. */
function pointOnLine(line: Line, s: number, out: Vec3, tan: Vec3): void {
  let i = 1;
  while (i < line.points.length - 1 && (line.cum[i] ?? 0) < s) i++;
  const a = line.points[i - 1];
  const b = line.points[i];
  const start = line.cum[i - 1] ?? 0;
  const end = line.cum[i] ?? 0;
  if (!a || !b) return;
  const t = end > start ? clamp((s - start) / (end - start), 0, 1) : 0;
  const len = end - start || 1;
  tan.x = (b.x - a.x) / len;
  tan.y = (b.y - a.y) / len;
  tan.z = (b.z - a.z) / len;
  out.x = a.x + (b.x - a.x) * t;
  out.y = a.y + (b.y - a.y) * t;
  out.z = a.z + (b.z - a.z) * t;
}

export interface Controller {
  /** Called on entity.spawned for heroes. */
  add(h: HeroEntity): void;
  remove(id: EntityId): void;
  /** The movement phase. */
  step(): void;
  /** Put a hero at `pos` with everything reset (respawn, fell out of the world). */
  reseat(h: HeroEntity, pos: Vec3): void;
  /** Stop rides, climbs, mantles, slides and dashes (displacement, teleports, modes). */
  interrupt(h: HeroEntity): void;
  /** The hero's own spawn anchor (n-th spawn of its team, as core seats it). */
  spawnPoint(h: HeroEntity): Vec3;
  state(id: EntityId): HeroState | undefined;
  /** Horizontal unit move direction from the hero's command; length 0 without input. */
  moveDir(h: HeroEntity): Vec3;
  /** Current run speed (stat, sprint, slows). */
  runSpeed(h: HeroEntity): number;
  startAbilityDash(h: HeroEntity, d: Omit<ScriptedDash, 't' | 'hit'>): void;
  startMode(h: HeroEntity, m: Omit<Mode, 'hit'>): void;
  endMode(h: HeroEntity): void;
  startAttach(h: HeroEntity, a: Attach): void;
  hash(h: Hasher): void;
}

export function createController(ctx: CoreContext, space: Space, service: PhysicsService): Controller {
  const { store, bus, map, clock } = ctx;
  const states = new Map<EntityId, HeroState>();
  const lines = map.updrafts.map((u) => makeLine(u.points));
  const W = { x: 0, y: 0, z: 0 };
  const D = { x: 0, y: 0, z: 0 };
  const P = { x: 0, y: 0, z: 0 };
  const TAN = { x: 0, y: 0, z: 0 };
  const near: EntityId[] = [];

  const emit = (hero: EntityId, action: MovementAction): void => bus.emit({ type: 'movement', hero, action });

  /** Updraft boosts lock for a while after hero damage. */
  bus.on('damage.applied', (e) => {
    const s = states.get(e.target);
    if (s && e.source !== null && store.getKind(e.source, 'hero')) s.heroDamagedAt = clock.tick;
  });
  /** Casting an ability dismounts an Updraft (GDD §3.7). */
  bus.on('ability', (e) => {
    const h = store.getKind(e.caster, 'hero');
    const s = states.get(e.caster);
    if (h && s?.ride && e.stage === 'start') leaveRide(h, s, false);
  });

  /** Fills W with the move direction; returns the input strength 0..1. */
  const wish = (h: HeroEntity): number => {
    let f = h.command.forward;
    let r = h.command.right;
    const len = Math.hypot(f, r);
    if (len > 1) {
      f /= len;
      r /= len;
    }
    const sin = Math.sin(h.yaw);
    const cos = Math.cos(h.yaw);
    W.x = sin * f - cos * r;
    W.z = cos * f + sin * r;
    const m = Math.hypot(W.x, W.z);
    if (m > 0) {
      W.x /= m;
      W.z /= m;
    }
    return Math.min(len, 1);
  };

  const slowed = (h: HeroEntity, speed: number): number => {
    const slow = h.stats.final.slow;
    return slow > 0 ? Math.max(GROUND.minSlowedSpeed, speed * (1 - slow)) : speed;
  };
  const runSpeed = (h: HeroEntity, s: HeroState): number =>
    slowed(h, h.stats.final.moveSpeed + h.stats.final.sprintSpeed * s.sprint);

  /** Move through the controller and write pos; returns the shared result. */
  const move = (h: HeroEntity): MoveResult => {
    const r = space.moveHero(h.id, h.pos, h.motor.crouching, D);
    h.pos.x += r.moved.x;
    h.pos.y += r.moved.y;
    h.pos.z += r.moved.z;
    return r;
  };

  /** Gravity for one tick with exact integration (jump apex matches the data); returns the vertical delta. */
  const fall = (v: Vec3, limit: number = AIR.maxFallSpeed): number => {
    const before = v.y;
    v.y = Math.max(v.y - AIR.gravity * dt, -limit);
    return (before + v.y) * HALF * dt;
  };

  const land = (h: HeroEntity, s: HeroState): void => {
    if (s.airTicks >= T.land) emit(h.id, 'land');
    s.airTicks = 0;
    s.airDashUsed = false;
    s.displaced = false;
    h.motor.knockedUp = false;
  };

  /**
   * After a free move: grounded state, landing, and velocity. On the ground the intended velocity is kept against
   * walls (ground acceleration re-targets it every tick, and keeping the push is what lets the controller finish a
   * step-up); in the air it becomes what the collision allowed; a displaced hero that hits a wall stops (GDD §3.9).
   */
  const settle = (h: HeroEntity, s: HeroState, r: MoveResult, rising: boolean): void => {
    const m = h.motor;
    const v = h.vel;
    const was = m.grounded;
    m.grounded = r.grounded && !rising;
    if (r.hasWall && (s.displaced || !m.grounded)) {
      v.x = s.displaced ? 0 : r.moved.x / dt;
      v.z = s.displaced ? 0 : r.moved.z / dt;
    }
    if (m.grounded) {
      const along = Math.hypot(r.moved.x, r.moved.z);
      s.downhill = along > 0 ? -r.moved.y / along : 0;
      v.y = 0;
      s.lastGroundTick = clock.tick;
      s.groundY = h.pos.y;
      if (!was) land(h, s);
    } else {
      s.airTicks++;
      if (D.y > 0 && r.moved.y < D.y * HALF) v.y = Math.min(v.y, r.moved.y / dt);
    }
  };

  const endSlide = (h: HeroEntity, s: HeroState): void => {
    if (!h.motor.sliding) return;
    h.motor.sliding = false;
    s.slideBoostAt = clock.tick + T.slideBoost;
  };

  const leaveRide = (h: HeroEntity, s: HeroState, jump: boolean): void => {
    const ride = s.ride;
    if (!ride) return;
    const keep = ride.mount > 0 ? 0 : UPDRAFT.dismountKeep;
    h.vel.x *= keep;
    h.vel.y = h.vel.y * keep + (jump ? UPDRAFT.dismountUp : 0);
    h.vel.z *= keep;
    s.ride = null;
    s.remountAt = clock.tick + T.remount;
    h.motor.updraft = null;
    h.motor.grounded = false;
    emit(h.id, 'updraftOff');
  };

  const leaveClimb = (h: HeroEntity): void => {
    if (h.motor.climb === null) return;
    h.motor.climb = null;
    h.motor.grounded = false;
    emit(h.id, 'climbOff');
  };

  const interrupt = (h: HeroEntity): void => {
    const s = states.get(h.id);
    if (!s) return;
    leaveRide(h, s, false);
    leaveClimb(h);
    endSlide(h, s);
    s.mantle = null;
    s.dash = null;
    s.dashUntil = NEVER;
    h.motor.mantling = false;
    h.motor.dashing = false;
  };

  const endMode = (h: HeroEntity): void => {
    const s = states.get(h.id);
    const mode = s?.mode;
    if (!s || !mode) return;
    s.mode = null;
    h.motor.mode = null;
    const f = lookDir(h.yaw, 0);
    ctx.effects.applyAll(mode.onEnd, { entity: h.id, point: copy(h.pos), dir: f }, mode.cause);
  };

  /** Applies `effects` to enemies (heroes, units) touching the hero, once each; true if one was touched. */
  const touch = (h: HeroEntity, cause: EffectCause, hit: EntityId[], effects: readonly Effect[], dir: Vec3): boolean => {
    let any = false;
    for (const id of ctx.spatial.query(h.pos, h.radius, near)) {
      if (id === h.id || hit.includes(id)) continue;
      const e = store.get(id);
      if (!e || (e.kind !== 'hero' && e.kind !== 'unit') || e.team === cause.team || e.health.dead) continue;
      hit.push(id);
      any = true;
      ctx.effects.applyAll(effects, { entity: id, point: copy(e.pos), dir: { ...dir } }, cause);
    }
    return any;
  };

  const spawnPoint = (h: HeroEntity): Vec3 => {
    const index = ctx.config.roster.slice(0, h.hero.slot).filter((r) => r.team === h.team).length;
    const spawns = map.spawns.filter((a) => a.team === h.team);
    return copy(spawns[index % spawns.length]?.pos ?? h.pos);
  };

  const reseat = (h: HeroEntity, pos: Vec3): void => {
    interrupt(h);
    endMode(h);
    h.pos = copy(pos);
    h.vel = { x: 0, y: 0, z: 0 };
    const m = h.motor;
    m.grounded = true;
    m.crouching = false;
    m.knockedUp = false;
    m.mode = null;
    m.attachedTo = null;
    m.stamina = h.stats.final.stamina;
    states.set(h.id, freshState(pos.y));
  };

  // ---- Ordinary locomotion. ----

  const startDash = (h: HeroEntity, s: HeroState, input: number): void => {
    const m = h.motor;
    const f = lookDir(h.yaw, 0);
    s.dashX = input > 0 ? W.x : f.x;
    s.dashZ = input > 0 ? W.z : f.z;
    s.dashGround = m.grounded;
    s.dashSpeed = (m.grounded ? DASH.groundDistance : DASH.airDistance) / DASH.durationS;
    s.dashUntil = clock.tick + T.dash;
    s.nextDashAt = clock.tick + T.lockout;
    m.stamina -= DASH.cost;
    if (!m.grounded) {
      s.airDashUsed = true;
      h.vel.y = 0;
    }
    endSlide(h, s);
    m.dashing = true;
    emit(h.id, 'dash');
  };

  const startSlide = (h: HeroEntity, s: HeroState, speed: number, crouchSpeed: number): void => {
    const boost = clock.tick >= s.slideBoostAt ? SLIDE.boost : 0;
    s.slideSpeed = Math.min(speed + boost, SLIDE.maxStartSpeed);
    s.slideX = h.vel.x / speed;
    s.slideZ = h.vel.z / speed;
    s.slideDecel = (s.slideSpeed - crouchSpeed) / SLIDE.decayS;
    s.dashUntil = NEVER;
    h.motor.dashing = false;
    h.motor.sliding = true;
    emit(h.id, 'slide');
  };

  /** Slide speed and steering for one tick; ends the slide at crouch-walk speed. */
  const slideTick = (h: HeroEntity, s: HeroState, crouchSpeed: number): void => {
    // Steer toward the look direction at SLIDE.steerDegPerS.
    const fx = Math.sin(h.yaw);
    const fz = Math.cos(h.yaw);
    const ang = Math.atan2(fx * s.slideZ - fz * s.slideX, fz * s.slideZ + fx * s.slideX);
    const turn = clamp(ang, -SLIDE.steerPerS * dt, SLIDE.steerPerS * dt);
    const c = Math.cos(turn);
    const sn = Math.sin(turn);
    const x = s.slideX * c + s.slideZ * sn;
    s.slideZ = s.slideZ * c - s.slideX * sn;
    s.slideX = x;
    // Downhill steeper than SLIDE.minSlope adds gravity along the slope; elsewhere friction decays it.
    if (s.downhill > SLIDE_MIN_SLOPE_TAN) {
      const sin = s.downhill / Math.hypot(1, s.downhill);
      s.slideSpeed = Math.min(SLIDE.maxSlopeSpeed, s.slideSpeed + AIR.gravity * sin * dt);
    } else {
      s.slideSpeed -= s.slideDecel * dt;
    }
    if (s.slideSpeed <= crouchSpeed) {
      s.slideSpeed = crouchSpeed;
      endSlide(h, s);
    }
    h.vel.x = s.slideX * s.slideSpeed;
    h.vel.z = s.slideZ * s.slideSpeed;
  };

  const groundAccel = (v: Vec3, input: number, speed: number): void => {
    const dx = W.x * speed * input - v.x;
    const dz = W.z * speed * input - v.z;
    const diff = Math.hypot(dx, dz);
    const stepSize = (input > 0 ? GROUND.accel : GROUND.decel) * dt;
    if (diff <= stepSize) {
      v.x += dx;
      v.z += dz;
    } else {
      v.x += (dx / diff) * stepSize;
      v.z += (dz / diff) * stepSize;
    }
  };

  /** Air control: steer toward the input; never adds horizontal speed above max(current, run). */
  const airControl = (v: Vec3, input: number, run: number, factor: number): void => {
    if (input === 0 || factor === 0) return;
    const before = Math.hypot(v.x, v.z);
    const a = AIR.accel * factor * input * dt;
    v.x += W.x * a;
    v.z += W.z * a;
    const after = Math.hypot(v.x, v.z);
    const cap = Math.max(before, run);
    if (after > cap) {
      v.x *= cap / after;
      v.z *= cap / after;
    }
  };

  const tryMantle = (h: HeroEntity, s: HeroState, r: MoveResult, input: number, speed: number, vx: number, vz: number): boolean => {
    const nl = Math.hypot(r.wall.x, r.wall.z);
    if (nl === 0) return false;
    const dx = -r.wall.x / nl;
    const dz = -r.wall.z / nl;
    // Pushing into the wall: the input direction, or the flight direction when airborne without input.
    let mx = W.x;
    let mz = W.z;
    if (input === 0) {
      if (h.motor.grounded || speed === 0) return false;
      mx = vx / speed;
      mz = vz / speed;
    }
    if (mx * dx + mz * dz < MANTLE.facing) return false;
    const ref = Math.min(h.pos.y, s.groundY);
    const from = { x: h.pos.x + dx * (h.radius + MANTLE.probeIn), y: ref + MANTLE.maxHeight + PROBE_PAD, z: h.pos.z + dz * (h.radius + MANTLE.probeIn) };
    const hit = service.raycast(from, DOWN, MANTLE.maxHeight - MANTLE.minHeight + PROBE_PAD, LAYERS_SOLID);
    if (!hit || hit.normal.y < WALKABLE_NY) return false;
    const rise = hit.point.y - ref;
    if (rise < MANTLE.minHeight || rise > MANTLE.maxHeight) return false;
    const to = { x: h.pos.x + dx * (2 * h.radius + MANTLE.probeIn), y: hit.point.y, z: h.pos.z + dz * (2 * h.radius + MANTLE.probeIn) };
    if (!space.fits(h.id, to, h.motor.crouching)) return false;
    const exit = speed * MANTLE.exitSpeedFraction;
    s.mantle = { t: 0, from: copy(h.pos), to, exitX: dx * exit, exitZ: dz * exit };
    endSlide(h, s);
    s.dashUntil = NEVER;
    h.motor.dashing = false;
    h.motor.mantling = true;
    h.vel = { x: 0, y: 0, z: 0 };
    emit(h.id, 'mantle');
    return true;
  };

  const mountLine = (h: HeroEntity, s: HeroState, line: number, at: number): void => {
    const l = lines[line];
    if (!l) return;
    pointOnLine(l, at, P, TAN);
    const f = lookDir(h.yaw, h.pitch);
    const dir = f.x * TAN.x + f.y * TAN.y + f.z * TAN.z >= 0 ? 1 : -1;
    s.ride = { line, s: at, dir, mount: T.mount, from: copy(h.pos), boostUntil: NEVER };
    endSlide(h, s);
    s.dashUntil = NEVER;
    h.motor.dashing = false;
    h.motor.crouching = false;
    h.motor.updraft = line;
    h.vel = { x: 0, y: 0, z: 0 };
    emit(h.id, 'updraftOn');
  };

  const tryUpdraft = (h: HeroEntity, s: HeroState): boolean => {
    if ((h.command.pressed & Button.Interact) !== 0) {
      for (let i = 0; i < map.updrafts.length; i++) {
        const l = lines[i];
        for (const st of map.updrafts[i]?.stations ?? []) {
          const near2 = (h.pos.x - st.x) ** 2 + (h.pos.z - st.z) ** 2 <= UPDRAFT.stationRadius ** 2;
          if (l && near2 && h.pos.y >= st.y - UPDRAFT.stationBelow && h.pos.y <= st.y + UPDRAFT.stationAbove) {
            mountLine(h, s, i, closestOnLine(l, st).s);
            return true;
          }
        }
      }
    }
    if (h.motor.grounded || clock.tick < s.remountAt) return false;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l) continue;
      const c = closestOnLine(l, h.pos);
      if (c.d2 <= UPDRAFT.airMountRadius ** 2) {
        mountLine(h, s, i, c.s);
        return true;
      }
    }
    return false;
  };

  const tryClimb = (h: HeroEntity, s: HeroState, input: number): boolean => {
    for (let i = 0; i < map.climbs.length; i++) {
      const c = map.climbs[i];
      if (!c) continue;
      const rx = h.pos.x - c.bottom.x;
      const rz = h.pos.z - c.bottom.z;
      if (c.kind === 'chimney') {
        if (rx * rx + rz * rz > CHIMNEY.radius ** 2) continue;
        if (h.pos.y < c.bottom.y - CHIMNEY.baseBelow || h.pos.y > c.bottom.y + CHIMNEY.baseHeight) continue;
      } else {
        if (input === 0 || h.command.forward <= 0 || -(W.x * c.out.x + W.z * c.out.z) < VINE.facing) continue;
        const away = rx * c.out.x + rz * c.out.z;
        const side = rx * c.out.z - rz * c.out.x;
        if (away < 0 || away > h.radius + VINE.reach || Math.abs(side) > VINE.halfWidth) continue;
        if (h.pos.y < c.bottom.y - VINE.grabBelow || h.pos.y >= c.top.y) continue;
        s.vineSide = side;
      }
      endSlide(h, s);
      s.dashUntil = NEVER;
      h.motor.dashing = false;
      h.motor.crouching = false;
      h.motor.climb = i;
      h.vel = { x: 0, y: 0, z: 0 };
      emit(h.id, 'climbOn');
      return true;
    }
    return false;
  };

  const locomotion = (h: HeroEntity, s: HeroState): void => {
    const m = h.motor;
    const v = h.vel;
    const cond = h.stats.conditions;
    const tick = clock.tick;
    if (m.knockedUp && tick >= s.knockUpUntil) m.knockedUp = false;
    const canAct = !cond.has('stunned') && !m.knockedUp;
    const canMove = canAct && !cond.has('rooted');
    const canLeave = canMove && !cond.has('grounded');
    const egg = cond.has('eggCarrier');
    const pressed = canAct ? h.command.pressed : 0;
    const held = canAct ? h.command.held : 0;
    const input = canMove ? wish(h) : 0;

    s.sprint = tick < h.health.inCombatUntil ? 0 : Math.min(1, s.sprint + dt / GROUND.sprintRampS);
    const run = runSpeed(h, s);
    const crouchSpeed = slowed(h, GROUND.crouchSpeed);

    const wantCrouch = (held & Button.Crouch) !== 0;
    if (wantCrouch !== m.crouching && (wantCrouch || space.fits(h.id, h.pos, false))) m.crouching = wantCrouch;
    if (m.sliding && (!m.crouching || !canMove)) endSlide(h, s);

    const speed = Math.hypot(v.x, v.z);
    if ((pressed & Button.Crouch) !== 0 && canMove && m.grounded && !m.sliding && speed >= SLIDE.minSpeed) {
      startSlide(h, s, speed, crouchSpeed);
    }
    if ((pressed & Button.Jump) !== 0) s.jumpBufferUntil = tick + T.buffer;
    if (
      (pressed & Button.Dash) !== 0 && canLeave && m.stamina >= DASH.cost && tick >= s.nextDashAt &&
      (m.grounded || !s.airDashUsed)
    ) {
      startDash(h, s, input);
    }
    if (m.dashing && tick >= s.dashUntil) {
      // Dash over: exit at run speed + 1 in the dash direction.
      m.dashing = false;
      s.dashEnded = s.dashUntil;
      v.x = s.dashX * (run + DASH.exitBonus);
      v.z = s.dashZ * (run + DASH.exitBonus);
    }


    if (canLeave && tick <= s.jumpBufferUntil && (m.grounded || tick - s.lastGroundTick <= T.coyote)) {
      if (s.dashGround && (m.dashing || tick - s.dashEnded <= T.dashJump)) {
        v.x = s.dashX * DASH.jumpHorizontal;
        v.z = s.dashZ * DASH.jumpHorizontal;
        v.y = DASH.jumpVertical;
        s.dashUntil = NEVER;
        s.dashEnded = NEVER;
        m.dashing = false;
        emit(h.id, 'dashJump');
      } else {
        v.y = JUMP_SPEED;
        emit(h.id, 'jump');
      }
      endSlide(h, s);
      m.grounded = false;
      s.lastGroundTick = NEVER;
      s.jumpBufferUntil = NEVER;

    }

    const airDash = m.dashing && !s.dashGround;
    if (m.dashing) {
      v.x = s.dashX * s.dashSpeed;
      v.z = s.dashZ * s.dashSpeed;
      if (airDash) v.y = 0;
    } else if (m.sliding) {
      slideTick(h, s, crouchSpeed);
    } else if (m.grounded) {
      groundAccel(v, input, m.crouching ? crouchSpeed : run);
    } else {
      airControl(v, input, run, m.knockedUp ? 0 : s.displaced ? DISPLACE.airControl : 1);
    }
    if (!canMove && m.grounded) v.x = v.z = 0;

    const vx = v.x;
    const vz = v.z;
    D.x = v.x * dt;
    D.z = v.z * dt;
    D.y = airDash ? 0 : fall(v);
    const r = move(h);
    settle(h, s, r, v.y > 0);
    if (!m.grounded && m.sliding) endSlide(h, s);

    if (!canMove || egg) return;
    if (r.hasWall && !s.displaced && tryMantle(h, s, r, input, Math.hypot(vx, vz), vx, vz)) return;
    if (canLeave && !s.displaced && (tryUpdraft(h, s) || tryClimb(h, s, input))) return;
  };

  // ---- Scripted states. ----

  const mantleTick = (h: HeroEntity, s: HeroState, mt: Mantle): void => {
    mt.t++;
    const f = mt.t / T.mantle;
    const fy = Math.min(1, f / MANTLE.riseEnd);
    const fh = clamp((f - MANTLE.moveStart) / (1 - MANTLE.moveStart), 0, 1);
    const x = mt.from.x + (mt.to.x - mt.from.x) * fh;
    const y = mt.from.y + (mt.to.y - mt.from.y) * fy;
    const z = mt.from.z + (mt.to.z - mt.from.z) * fh;
    h.vel = { x: (x - h.pos.x) / dt, y: (y - h.pos.y) / dt, z: (z - h.pos.z) / dt };
    h.pos = { x, y, z };
    if (mt.t < T.mantle) return;
    s.mantle = null;
    h.motor.mantling = false;
    h.motor.grounded = true;
    h.vel = { x: mt.exitX, y: 0, z: mt.exitZ };
    s.lastGroundTick = clock.tick;
    s.groundY = y;
    s.airTicks = 0;
  };

  const dashTick = (h: HeroEntity, s: HeroState, d: ScriptedDash): void => {
    d.t++;
    const f0 = (d.t - 1) / d.n;
    const f1 = d.t / d.n;
    D.x = d.dirX * d.step;
    D.z = d.dirZ * d.step;
    D.y = d.arc * ARC * (f1 * (1 - f1) - f0 * (1 - f0));
    const r = move(h);
    h.vel = { x: r.moved.x / dt, y: r.moved.y / dt, z: r.moved.z / dt };
    h.motor.grounded = r.grounded && D.y <= 0;
    const blocked = Math.hypot(r.moved.x, r.moved.z) < d.step * HALF;
    const dir = { x: d.dirX, y: 0, z: d.dirZ };
    const stopped = (d.onHit.length > 0 || d.stopOnHit) && touch(h, d.cause, d.hit, d.onHit, dir) && d.stopOnHit;
    if (d.t < d.n && !blocked && !stopped) return;
    s.dash = null;
    h.motor.dashing = false;
    const exit = d.keepSpeed && !blocked && !stopped ? Math.min(d.step / dt, runSpeed(h, s) + DASH.exitBonus) : 0;
    h.vel = { x: d.dirX * exit, y: 0, z: d.dirZ * exit };
    ctx.effects.applyAll(d.onArrive, { entity: h.id, point: copy(h.pos), dir }, d.cause);
  };

  const rideTick = (h: HeroEntity, s: HeroState, ride: Ride): void => {
    const cond = h.stats.conditions;
    if (cond.has('stunned') || cond.has('rooted') || cond.has('grounded') || cond.has('eggCarrier')) {
      leaveRide(h, s, false);
      return;
    }
    const line = lines[ride.line];
    if (!line) return;
    if (ride.mount > 0) {
      ride.mount--;
      pointOnLine(line, ride.s, P, TAN);
      const f = 1 - ride.mount / T.mount;
      const x = ride.from.x + (P.x - ride.from.x) * f;
      const y = ride.from.y + (P.y - ride.from.y) * f;
      const z = ride.from.z + (P.z - ride.from.z) * f;
      h.vel = { x: 0, y: 0, z: 0 };
      h.pos = { x, y, z };
      return;
    }
    const pressed = h.command.pressed;
    if ((pressed & (Button.Jump | Button.Crouch)) !== 0) {
      leaveRide(h, s, (pressed & Button.Jump) !== 0);
      return;
    }
    const tick = clock.tick;
    if ((pressed & Button.Dash) !== 0 && tick >= s.boostReadyAt && tick >= s.heroDamagedAt + T.boostLock) {
      ride.boostUntil = tick + T.boost;
      s.boostReadyAt = tick + T.boostCooldown;
      emit(h.id, 'updraftBoost');
    }
    const speed = tick < ride.boostUntil ? UPDRAFT.boostSpeed : UPDRAFT.rideSpeed;
    ride.s += ride.dir * speed * dt;
    const end = ride.s <= 0 || ride.s >= line.length;
    pointOnLine(line, ride.s, P, TAN);
    h.pos = { x: P.x, y: P.y, z: P.z };
    h.vel = end
      ? { x: 0, y: 0, z: 0 }
      : { x: TAN.x * ride.dir * speed, y: TAN.y * ride.dir * speed, z: TAN.z * ride.dir * speed };
    if (end) leaveRide(h, s, false);
  };

  const climbTick = (h: HeroEntity, s: HeroState, index: number): void => {
    const c = map.climbs[index];
    const cond = h.stats.conditions;
    if (!c || cond.has('stunned') || cond.has('rooted') || cond.has('grounded') || cond.has('eggCarrier')) {
      h.vel = { x: 0, y: 0, z: 0 };
      leaveClimb(h);
      return;
    }
    if (c.kind === 'chimney') {
      h.pos.y += CHIMNEY.liftSpeed * dt;
      h.vel = { x: 0, y: CHIMNEY.liftSpeed, z: 0 };
      if (h.pos.y >= c.top.y) {
        h.pos.y = c.top.y;
        h.vel.y = CHIMNEY.exitUp;
        leaveClimb(h);
      }
      return;
    }
    const sideX = c.out.z;
    const sideZ = -c.out.x;
    if ((h.command.pressed & Button.Jump) !== 0) {
      h.vel = { x: c.out.x * VINE.jumpOffSpeed, y: JUMP_SPEED, z: c.out.z * VINE.jumpOffSpeed };
      leaveClimb(h);
      return;
    }
    const up = clamp(h.command.forward, -1, 1) * VINE.climbSpeed;
    s.vineSide = clamp(s.vineSide + clamp(h.command.right, -1, 1) * VINE.shimmySpeed * dt, -VINE.halfWidth, VINE.halfWidth);
    const away = h.radius + CONTROLLER.skin;
    const x = c.bottom.x + c.out.x * away + sideX * s.vineSide;
    const z = c.bottom.z + c.out.z * away + sideZ * s.vineSide;
    const y = h.pos.y + up * dt;
    h.vel = { x: (x - h.pos.x) / dt, y: up, z: (z - h.pos.z) / dt };
    h.pos = { x, y, z };
    if (y <= c.bottom.y && up < 0) {
      h.pos.y = c.bottom.y;
      h.vel = { x: 0, y: 0, z: 0 };
      leaveClimb(h);
    } else if (y >= c.top.y) {
      // Over the top onto the surface behind the vine, if there is one; otherwise hold at the top.
      const over = h.radius + MANTLE.probeIn;
      const to = { x: c.bottom.x - c.out.x * over + sideX * s.vineSide, y: c.top.y, z: c.bottom.z - c.out.z * over + sideZ * s.vineSide };
      const g = service.groundHeight(to.x, to.z, c.top.y + MANTLE.minHeight);
      if (g !== null && Math.abs(g - c.top.y) <= MANTLE.minHeight && space.fits(h.id, { ...to, y: g }, false)) {
        h.pos = { x: to.x, y: g, z: to.z };
        h.vel = { x: 0, y: 0, z: 0 };
        leaveClimb(h);
        h.motor.grounded = true;
        s.groundY = g;
      } else {
        h.pos.y = c.top.y;
        h.vel.y = 0;
      }
    }
  };

  const modeTick = (h: HeroEntity, s: HeroState, mode: Mode): void => {
    if (clock.tick >= mode.until) {
      endMode(h);
      return;
    }
    const v = h.vel;
    const cond = h.stats.conditions;
    const canMove = !cond.has('stunned') && !cond.has('rooted');
    const input = canMove ? wish(h) : 0;
    const held = canMove ? h.command.held : 0;
    const climb = (held & Button.Jump) !== 0 ? mode.vertical : (held & Button.Crouch) !== 0 ? -mode.vertical : 0;
    const f = lookDir(h.yaw, h.pitch);
    switch (mode.kind) {
      case 'cling':
        h.vel = { x: 0, y: 0, z: 0 };
        return;
      case 'glide': {
        const gx = input > 0 ? W.x : f.x;
        const gz = input > 0 ? W.z : f.z;
        const gl = Math.hypot(gx, gz) || 1;
        v.x = (gx / gl) * mode.speed;
        v.z = (gz / gl) * mode.speed;
        D.y = fall(v, mode.vertical);
        break;
      }
      case 'flight':
      case 'hover': {
        v.x = W.x * mode.speed * input;
        v.z = W.z * mode.speed * input;
        const pitchClimb = mode.kind === 'flight' ? f.y * mode.speed * Math.max(h.command.forward, 0) : 0;
        v.y = canMove ? clamp(pitchClimb + climb, -mode.vertical, mode.vertical) : 0;
        D.y = v.y * dt;
        break;
      }
      case 'toboggan':
      case 'burrow': {
        const fl = Math.hypot(f.x, f.z) || 1;
        const dx = mode.kind === 'toboggan' ? f.x / fl : W.x * input;
        const dz = mode.kind === 'toboggan' ? f.z / fl : W.z * input;
        v.x = canMove ? dx * mode.speed : 0;
        v.z = canMove ? dz * mode.speed : 0;
        D.y = fall(v);
        break;
      }
    }
    D.x = v.x * dt;
    D.z = v.z * dt;
    const r = move(h);
    settle(h, s, r, v.y > 0);
    if (mode.onCollide.length > 0) touch(h, mode.cause, mode.hit, mode.onCollide, { x: v.x, y: 0, z: v.z });
  };

  const followCarrier = (h: HeroEntity, s: HeroState, a: Attach): void => {
    const carrier = store.getKind(a.to, 'hero');
    const free =
      !carrier || carrier.removed || carrier.health.dead || carrier.stats.conditions.has('stunned') ||
      clock.tick >= a.until || h.health.dead;
    const f = lookDir(carrier?.yaw ?? h.yaw, 0);
    if (!free && carrier) {
      const gap = carrier.radius + h.radius;
      h.pos = { x: carrier.pos.x + f.x * gap, y: carrier.pos.y, z: carrier.pos.z + f.z * gap };
      h.vel = copy(carrier.vel);
      return;
    }
    s.attach = null;
    h.motor.attachedTo = null;
    if (!h.health.dead) ctx.effects.applyAll(a.onRelease, { entity: h.id, point: copy(h.pos), dir: f }, a.cause);
  };

  const stepHero = (h: HeroEntity, s: HeroState): void => {
    const m = h.motor;
    if (h.health.dead) {
      // Dead heroes stay where they fell; nothing they were doing survives (no onEnd effects).
      interrupt(h);
      s.mode = null;
      m.mode = null;
      m.knockedUp = false;
      s.displaced = false;
      h.vel = { x: 0, y: 0, z: 0 };
      return;
    }
    const maxStamina = h.stats.final.stamina;
    const recharge = h.stats.final.staminaRecharge;
    if (m.stamina < maxStamina && recharge > 0) m.stamina = Math.min(maxStamina, m.stamina + dt / recharge);
    else if (m.stamina > maxStamina) m.stamina = maxStamina;

    if (s.attach) return;
    if (s.mantle) mantleTick(h, s, s.mantle);
    else if (s.dash) dashTick(h, s, s.dash);
    else if (s.ride) rideTick(h, s, s.ride);
    else if (m.climb !== null) climbTick(h, s, m.climb);
    else if (s.mode) modeTick(h, s, s.mode);
    else locomotion(h, s);

    const b = map.bounds;
    if (h.pos.y < map.killY) {
      reseat(h, spawnPoint(h));
      return;
    }
    const x = clamp(h.pos.x, b.min.x + h.radius, b.max.x - h.radius);
    const z = clamp(h.pos.z, b.min.z + h.radius, b.max.z - h.radius);
    if (x !== h.pos.x) h.vel.x = 0;
    if (z !== h.pos.z) h.vel.z = 0;
    h.pos.x = x;
    h.pos.z = z;
    if (h.pos.y > b.max.y) {
      h.pos.y = b.max.y;
      h.vel.y = Math.min(h.vel.y, 0);
    }
  };

  return {
    add(h) {
      states.set(h.id, freshState(h.pos.y));
    },
    remove(id) {
      states.delete(id);
    },
    step() {
      const heroes = store.list('hero');
      for (const h of heroes) {
        const s = states.get(h.id);
        if (s) stepHero(h, s);
      }
      for (const h of heroes) {
        const s = states.get(h.id);
        if (s?.attach) followCarrier(h, s, s.attach);
      }
      space.heroesMoved();
    },
    reseat,
    interrupt,
    spawnPoint,
    state: (id) => states.get(id),
    moveDir(h) {
      const input = wish(h);
      return { x: W.x * (input > 0 ? 1 : 0), y: 0, z: W.z * (input > 0 ? 1 : 0) };
    },
    runSpeed(h) {
      const s = states.get(h.id);
      return s ? runSpeed(h, s) : h.stats.final.moveSpeed;
    },
    startAbilityDash(h, d) {
      const s = states.get(h.id);
      if (!s) return;
      interrupt(h);
      s.dash = { ...d, t: 0, hit: [] };
      h.motor.dashing = true;
      h.motor.grounded = false;
    },
    startMode(h, mode) {
      const s = states.get(h.id);
      if (!s) return;
      interrupt(h);
      endMode(h);
      s.mode = { ...mode, hit: [] };
      h.motor.mode = mode.kind;
    },
    endMode,
    startAttach(h, a) {
      const s = states.get(h.id);
      if (!s) return;
      interrupt(h);
      endMode(h);
      s.attach = a;
      h.motor.attachedTo = a.to;
    },
    hash(hasher) {
      for (const [id, s] of states) {
        hasher.num(id);
        hasher.value(s);
      }
    },
  };
}
