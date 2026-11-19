/**
 * The hero character controller (GDD §3), run in the movement phase from each hero's latched command: walk, sprint,
 * jump, air control, crouch, slide, dash, dash-jump, mantle, stamina, Updrafts, Chimneys, Vines and ladders, Bough
 * Springs, the Cellar Run's speed, knockback state, and the scripted motions physics-owned effects start (ability
 * dashes, movement modes, attach). One state machine per hero; exactly one of these runs per tick, first match wins:
 * dead, attached, mantle, ability dash, Updraft ride, climb, movement mode, ordinary locomotion.
 *
 * Updrafts (GDD §3.7, D-EP-039): no key. Jump held for UPDRAFT.latchHoldS within reach (updrafts.ts) latches: an
 * airborne hero within airReach attaches in attachS, anyone else is pulled up at pullSpeed. A fresh Jump press
 * (released since latching) jumps off; Crouch drops off.
 */
import { Button } from '../core/contracts';
import type {
  BoxVolume,
  CoreContext,
  DamageAppliedEvent,
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
import { COMBAT, SLOW } from '../data/combat';
import { TICK_SECONDS } from '../data/core';
import { AIR, CHIMNEY, CONTROLLER, DASH, DISPLACE, GROUND, MANTLE, SLIDE, SPRING, TUNNEL, UPDRAFT, VINE } from '../data/movement';
import { MOVE_MASK } from './rapier';
import type { MoveResult, Space } from './rapier';
import { pointOnLine } from './updrafts';
import type { Reach, Updrafts } from './updrafts';
import * as dmath from '../core/dmath';

const dt = TICK_SECONDS;
const NEVER = Number.NEGATIVE_INFINITY;

const HALF = 0.5;
const ARC = 4;
const WALKABLE_NY = dmath.cos(GROUND.maxSlope);
const SLIDE_MIN_SLOPE_TAN = dmath.tan(SLIDE.minSlope);
const JUMP_SPEED = Math.sqrt(2 * AIR.gravity * AIR.jumpApex);
const TOBOGGAN_HOP_SPEED = Math.sqrt(2 * AIR.gravity * AIR.tobogganHopApex);
/** Mantle probes start this far above the highest reachable ledge. */
const PROBE_PAD = 0.05;
const DOWN = { x: 0, y: -1, z: 0 };

const T = {
  coyote: ticks(AIR.coyoteS),
  buffer: ticks(AIR.jumpBufferS),
  land: ticks(AIR.landEventMinAirS),
  dash: ticks(DASH.durationS),
  lockout: ticks(DASH.lockoutS),
  dashJumpOpen: ticks(DASH.jumpWindowOpenS),
  dashJumpClose: ticks(DASH.jumpWindowCloseS),
  crouchTap: ticks(DASH.down.tapWindowS),
  wallGrace: ticks(AIR.wall.graceS),
  wallFatigue: ticks(AIR.wall.fatigueS),
  sprintDelay: ticks(GROUND.sprintDelayS),
  afterCombat: ticks(GROUND.sprintDelayS - COMBAT.combatStateS),
  slideBoost: ticks(SLIDE.boostCooldownS),
  mantle: ticks(MANTLE.durationS),
  latchHold: ticks(UPDRAFT.latchHoldS),
  attach: ticks(UPDRAFT.attachS),
  damageLock: ticks(UPDRAFT.damageLockoutS),
  leaveLock: ticks(UPDRAFT.leaveLockoutS),
  boost: ticks(UPDRAFT.boostS),
  boostCooldown: ticks(UPDRAFT.boostCooldownS),
  boostLock: ticks(UPDRAFT.boostDamageLockS),
  springCooldown: ticks(SPRING.cooldownS),
  springClip: ticks(SPRING.clipS),
  knockUp: ticks(DISPLACE.knockUpMaxS),
} as const;
const TAU = 2 * Math.PI;
/** `a` wrapped into [−π, π). */
const wrapAngle = (a: number): number => {
  const w = (a + Math.PI) % TAU;
  return (w < 0 ? w + TAU : w) - Math.PI;
};

/** An ability dash (DashEffect) in progress. */
interface ScriptedDash {
  /** Unit direction; dirY ≠ 0 for 'aim' dashes that follow the aim pitch and dashes to a surface point. */
  dirX: number;
  readonly dirY: number;
  dirZ: number;
  /** Follows the aim yaw within ±max of `base` (radians) while it runs (STEER_VALUE), or null. */
  readonly steer: { readonly base: number; readonly max: number } | null;
  /** Metres per tick along the direction. */
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
  readonly allowGun: boolean;
  readonly allowAbilities: boolean;
  readonly onCollide: readonly Effect[];
  readonly onEnd: readonly Effect[];
  /** MovementModeEffect.endOn, or null for the mode's own rule (glide: land and Jump; toboggan: Jump with a hop). */
  readonly endOn: readonly ('land' | 'jump')[] | null;
  readonly cause: EffectCause;
  readonly hit: EntityId[];
}

/** A displacement's wall-slam payload (DisplaceEffect.onWall with the displacement's cause). */
export interface Slam {
  readonly onWall: readonly Effect[];
  readonly cause: EffectCause;
}

interface Ride {
  readonly line: number;
  s: number;
  readonly dir: 1 | -1;
  /** Ticks of the latch (air attach or pull-up) left, out of `mountTicks`. */
  mount: number;
  readonly mountTicks: number;
  readonly from: Vec3;
  boostUntil: number;
  /** Jump has been released since latching, so the next press jumps off. */
  released: boolean;
}

/** A Bough Spring launch in flight (GDD §7.15). */
interface SpringFlight {
  /** No air control before this tick (the apex), SPRING.airControl after. */
  apexAt: number;
  /** Enemy hero damage before this tick clips the launch. */
  clipUntil: number;
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
  dashStarted: number;
  nextDashAt: number;
  airDashUsed: boolean;
  airJumpUsed: boolean;
  downDashUsed: boolean;
  lastCrouchPress: number;
  wallAt: number;
  wallX: number;
  wallZ: number;
  wallJumps: number;
  fatigueAt: number;
  aimReadyAt: number;
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
  /** Last tick an enemy hero damaged this hero (latch lockout, boost lock, Spring clip). */
  heroDamagedAt: number;
  /** No latch before this tick (UPDRAFT.leaveLockoutS after leaving a line). */
  remountAt: number;
  /** Consecutive ticks Jump has been held, this one included. */
  jumpHeld: number;
  /** Feet inside a 'tunnel' room this tick (TUNNEL.runSpeedMult). */
  tunnel: boolean;
  spring: SpringFlight | null;
  springReadyAt: number;
  vineSide: number;
  /** In a push, pull or along displacement until landing (20% air control, stops at walls). */
  displaced: boolean;
  /** That displacement's wall slam, until it fires or the hero lands. */
  slam: Slam | null;
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
    dashStarted: NEVER,
    nextDashAt: NEVER,
    airDashUsed: false,
    airJumpUsed: false,
    downDashUsed: false,
    lastCrouchPress: NEVER,
    wallAt: NEVER,
    wallX: 0,
    wallZ: 0,
    wallJumps: 0,
    fatigueAt: NEVER,
    aimReadyAt: NEVER,
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
    jumpHeld: 0,
    tunnel: false,
    spring: null,
    springReadyAt: NEVER,
    vineSide: 0,
    displaced: false,
    slam: null,
    knockUpUntil: NEVER,
    dash: null,
    mode: null,
    attach: null,
  };
}

/** A room volume as a point test: centre, half sizes and the yaw's sine and cosine. */
interface Volume {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly hx: number;
  readonly hy: number;
  readonly hz: number;
  readonly sin: number;
  readonly cos: number;
}

const volume = (v: BoxVolume): Volume => ({
  x: v.centre.x,
  y: v.centre.y,
  z: v.centre.z,
  hx: v.size.x * HALF,
  hy: v.size.y * HALF,
  hz: v.size.z * HALF,
  sin: dmath.sin(v.yaw),
  cos: dmath.cos(v.yaw),
});

/** Feet at `p` inside the volume (a feet height on its floor counts). */
function within(v: Volume, p: Vec3): boolean {
  const dx = p.x - v.x;
  const dz = p.z - v.z;
  const dy = p.y - v.y;
  return Math.abs(dx * v.cos - dz * v.sin) <= v.hx && Math.abs(dx * v.sin + dz * v.cos) <= v.hz &&
    dy >= -v.hy - CONTROLLER.restBand && dy <= v.hy;
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

export function createController(ctx: CoreContext, space: Space, service: PhysicsService, updrafts: Updrafts): Controller {
  const { store, bus, map, clock } = ctx;
  const states = new Map<EntityId, HeroState>();
  const lines = updrafts.lines;
  const hasUpdrafts = lines.length > 0;
  const springs = map.springs ?? [];
  const tunnels = (map.rooms ?? []).filter((r) => r.tag === 'tunnel').map((r) => volume(r.volume));
  const W = { x: 0, y: 0, z: 0 };
  const D = { x: 0, y: 0, z: 0 };
  const P = { x: 0, y: 0, z: 0 };
  const TAN = { x: 0, y: 0, z: 0 };
  const REACH: Reach = { updraft: -1, point: { x: 0, y: 0, z: 0 }, t: 0, d: 0 };
  const near: EntityId[] = [];

  const emit = (hero: EntityId, action: MovementAction): void => bus.emit({ type: 'movement', hero, action });
  const isEgg = (h: HeroEntity): boolean => h.stats.conditions.has('eggCarrier');

  /**
   * Enemy hero damage: locks Updraft latching and boosts for a while (GDD §3.7) and clips a Bough Spring launch in its
   * first SPRING.clipS: no more rise, and a slow (GDD §7.15).
   */
  bus.on('damage.applied', (e) => {
    const s = states.get(e.target);
    const h = s && store.getKind(e.target, 'hero');
    if (!s || !h || e.source === null || e.sourceTeam === h.team || !store.getKind(e.source, 'hero')) return;
    s.heroDamagedAt = clock.tick;
    if (s.spring && clock.tick < s.spring.clipUntil) clipSpring(h, s, e);
  });
  /** Casting an ability dismounts an Updraft (GDD §3.7). */
  bus.on('ability', (e) => {
    const h = store.getKind(e.caster, 'hero');
    const s = states.get(e.caster);
    if (!h || !s || e.stage !== 'start') return;
    if (s.ride) leaveRide(h, s, false);
    s.dashStarted = NEVER;
    h.motor.dashJumpReady = false;
  });

  /** Fills W with the move direction; returns the input strength 0..1. */
  const wish = (h: HeroEntity): number => {
    let f = h.command.forward;
    let r = h.command.right;
    const len = dmath.hypot(f, r);
    if (len > 1) {
      f /= len;
      r /= len;
    }
    const sin = dmath.sin(h.yaw);
    const cos = dmath.cos(h.yaw);
    W.x = sin * f - cos * r;
    W.z = cos * f + sin * r;
    const m = dmath.hypot(W.x, W.z);
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
  /** Run speed: the stat (×1.3 in the Cellar Run), the sprint ramp, slows. */
  const runSpeed = (h: HeroEntity, s: HeroState): number =>
    slowed(h, h.stats.final.moveSpeed * (s.tunnel ? TUNNEL.runSpeedMult : 1) + h.stats.final.sprintSpeed * s.sprint);

  /**
   * Move through the controller and write pos; returns the shared result. `rest`: the hero stands on the ground with
   * no horizontal motion. Rapier's contact tolerance then nudges the feet up to ~1e-4 m a tick, so a grounded move
   * smaller than CONTROLLER.restBand is dropped and the hero stays exactly still (a real fall moves more).
   */
  const move = (h: HeroEntity, rest = false): MoveResult => {
    const r = space.moveHero(h.id, h.pos, h.motor.crouching, D, isEgg(h));
    const m = r.moved;
    if (rest && r.grounded && Math.abs(m.x) + Math.abs(m.y) + Math.abs(m.z) < CONTROLLER.restBand) {
      m.x = 0;
      m.y = 0;
      m.z = 0;
    }
    h.pos.x += r.moved.x;
    h.pos.y += r.moved.y;
    h.pos.z += r.moved.z;
    return r;
  };

  /**
   * Gravity for one tick with exact integration (jump apex matches the data); returns the vertical delta. None for a
   * hero standing on the ground: the controller's snap-down keeps it there, and a gravity step would sink the proxy
   * into the controller's skin, where Rapier stalls a horizontal move for a tick now and then.
   */
  const fall = (h: HeroEntity, v: Vec3, limit: number = AIR.maxFallSpeed): number => {
    if (h.motor.grounded && v.y <= 0) {
      v.y = 0;
      return 0;
    }
    const before = v.y;
    v.y = Math.max(v.y - AIR.gravity * dt, -limit);
    return (before + v.y) * HALF * dt;
  };

  const land = (h: HeroEntity, s: HeroState): void => {
    if (s.airTicks >= T.land) emit(h.id, 'land');
    s.airTicks = 0;
    s.airDashUsed = false;
    s.airJumpUsed = false;
    s.downDashUsed = false;
    s.lastCrouchPress = NEVER;
    s.wallJumps = 0;
    s.wallAt = NEVER;
    s.fatigueAt = NEVER;
    s.spring = null;
    // A displacement ends where it lands: its distance is the flat-ground distance (GDD §3.9), with no skid after.
    if (s.displaced) {
      h.vel.x = 0;
      h.vel.z = 0;
    }
    s.displaced = false;
    s.slam = null;
    h.motor.knockedUp = false;
  };

  /**
   * GDD §3.9 wall slam: a displaced hero meeting a wall (outward normal `n`) with at least DISPLACE.wallSlamSpeed
   * toward it gets the displacement's onWall effects and a 'wallSlam' movement event, once per displacement.
   */
  const wallSlam = (h: HeroEntity, s: HeroState, n: Vec3, vx: number, vz: number): void => {
    const slam = s.slam;
    const nl = dmath.hypot(n.x, n.z);
    if (!slam || nl === 0 || -(vx * n.x + vz * n.z) / nl < DISPLACE.wallSlamSpeed) return;
    s.slam = null;
    emit(h.id, 'wallSlam');
    ctx.effects.applyAll(slam.onWall, { entity: h.id, point: copy(h.pos), dir: { x: -n.x / nl, y: 0, z: -n.z / nl } }, slam.cause);
  };

  const rememberWall = (s: HeroState, n: Vec3): void => {
    if (Math.abs(n.y) > AIR.wall.maxNormalY) return;
    const len = dmath.hypot(n.x, n.z);
    if (len === 0) return;
    s.wallX = n.x / len;
    s.wallZ = n.z / len;
    s.wallAt = clock.tick;
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
    if (r.hasWall && !m.grounded) rememberWall(s, r.wall);
    if (r.hasWall && (s.displaced || !m.grounded)) {
      const vx = v.x;
      const vz = v.z;
      v.x = s.displaced ? 0 : r.moved.x / dt;
      v.z = s.displaced ? 0 : r.moved.z / dt;
      // After the stop, so a slam effect that displaces the hero again keeps its new velocity.
      if (s.displaced) wallSlam(h, s, r.wall, vx, vz);
    }
    if (m.grounded) {
      const along = dmath.hypot(r.moved.x, r.moved.z);
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
    s.remountAt = clock.tick + T.leaveLock;
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
    s.spring = null;
    s.dashUntil = NEVER;
    s.dashStarted = NEVER;
    h.motor.dashJumpReady = false;
    h.motor.mantling = false;
    h.motor.dashing = false;
  };

  /** No movement mode: the gun and casting are allowed again (Motor.modeAllows*, D-ARCH-016). */
  const clearMode = (h: HeroEntity): void => {
    h.motor.mode = null;
    h.motor.modeAllowsGun = true;
    h.motor.modeAllowsAbilities = true;
  };

  const endMode = (h: HeroEntity): void => {
    const s = states.get(h.id);
    const mode = s?.mode;
    if (!s || !mode) return;
    s.mode = null;
    clearMode(h);
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
    clearMode(h);
    m.attachedTo = null;
    m.stamina = h.stats.final.stamina;
    m.dashJumpReady = false;
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
    s.dashStarted = clock.tick;
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
    s.slideSpeed = Math.max(speed, Math.min(speed + boost, SLIDE.maxStartSpeed));
    s.slideX = h.vel.x / speed;
    s.slideZ = h.vel.z / speed;
    s.slideDecel = (s.slideSpeed - crouchSpeed) / SLIDE.decayS;
    s.dashUntil = NEVER;
    h.motor.dashing = false;
    h.vel.x = s.slideX * s.slideSpeed;
    h.vel.z = s.slideZ * s.slideSpeed;
    h.motor.sliding = true;
    emit(h.id, 'slide');
  };

  /** Slide speed and steering for one tick; ends the slide at crouch-walk speed. */
  const slideTick = (h: HeroEntity, s: HeroState, crouchSpeed: number): void => {
    // Steer toward the look direction at SLIDE.steerDegPerS.
    const fx = dmath.sin(h.yaw);
    const fz = dmath.cos(h.yaw);
    const ang = dmath.atan2(fx * s.slideZ - fz * s.slideX, fz * s.slideZ + fx * s.slideX);
    const turn = clamp(ang, -SLIDE.steerPerS * dt, SLIDE.steerPerS * dt);
    const c = dmath.cos(turn);
    const sn = dmath.sin(turn);
    const x = s.slideX * c + s.slideZ * sn;
    s.slideZ = s.slideZ * c - s.slideX * sn;
    s.slideX = x;
    // Downhill steeper than SLIDE.minSlope adds gravity along the slope; elsewhere friction decays it.
    if (s.downhill > SLIDE_MIN_SLOPE_TAN) {
      const sin = s.downhill / dmath.hypot(1, s.downhill);
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
    const diff = dmath.hypot(dx, dz);
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
    const before = dmath.hypot(v.x, v.z);
    const a = AIR.accel * factor * input * dt;
    v.x += W.x * a;
    v.z += W.z * a;
    const after = dmath.hypot(v.x, v.z);
    const cap = Math.max(before, run);
    if (after > cap) {
      v.x *= cap / after;
      v.z *= cap / after;
    }
  };

  const tryMantle = (h: HeroEntity, s: HeroState, normal: Vec3, input: number, vx: number, vz: number, gap = h.radius): boolean => {
    const nl = dmath.hypot(normal.x, normal.z);
    if (nl === 0) return false;
    const dx = -normal.x / nl;
    const dz = -normal.z / nl;
    const speed = dmath.hypot(vx, vz);
    const forward = lookDir(h.yaw, 0);
    if (forward.x * dx + forward.z * dz < MANTLE.facing) return false;
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
    const from = { x: h.pos.x + dx * (gap + MANTLE.probeIn), y: ref + MANTLE.maxHeight + PROBE_PAD, z: h.pos.z + dz * (gap + MANTLE.probeIn) };
    const hit = service.raycast(from, DOWN, MANTLE.maxHeight - MANTLE.minHeight + PROBE_PAD, MOVE_MASK);
    if (!hit || hit.normal.y < WALKABLE_NY) return false;
    const rise = hit.point.y - ref;
    if (rise < MANTLE.minHeight || rise > MANTLE.maxHeight) return false;
    const to = { x: h.pos.x + dx * (gap + h.radius + MANTLE.probeIn), y: hit.point.y, z: h.pos.z + dz * (gap + h.radius + MANTLE.probeIn) };
    if (!space.fits(h.id, to, false, isEgg(h))) return false;
    s.mantle = { t: 0, from: copy(h.pos), to, exitX: vx, exitZ: vz };
    endSlide(h, s);
    s.dashUntil = NEVER;
    h.motor.dashing = false;
    h.motor.mantling = true;
    h.vel = { x: 0, y: 0, z: 0 };
    emit(h.id, 'mantle');
    return true;
  };

  /**
   * Latch onto the cable point `r` (GDD §3.7): an airborne hero within airReach attaches in attachS; anyone else is
   * pulled to the point at pullSpeed. The ride runs toward the end the camera faces.
   */
  const latch = (h: HeroEntity, s: HeroState, r: Reach): void => {
    const l = lines[r.updraft];
    if (!l) return;
    pointOnLine(l, r.t, P, TAN);
    const f = lookDir(h.yaw, h.pitch);
    const dir = f.x * TAN.x + f.y * TAN.y + f.z * TAN.z >= 0 ? 1 : -1;
    const n = !h.motor.grounded && r.d <= UPDRAFT.airReach ? T.attach : Math.max(1, Math.ceil(r.d / (UPDRAFT.pullSpeed * dt)));
    s.ride = { line: r.updraft, s: r.t, dir, mount: n, mountTicks: n, from: copy(h.pos), boostUntil: NEVER, released: false };
    endSlide(h, s);
    s.dashUntil = NEVER;
    s.spring = null;
    h.motor.dashing = false;
    h.motor.crouching = false;
    h.motor.updraft = r.updraft;
    h.motor.updraftInReach = null;
    h.vel = { x: 0, y: 0, z: 0 };
    emit(h.id, 'updraftOn');
  };

  /** Jump held for latchHoldS within reach, outside both lockouts, latches (a tap never does). */
  const tryLatch = (h: HeroEntity, s: HeroState, inReach: boolean): boolean => {
    const tick = clock.tick;
    if (!inReach || s.jumpHeld < T.latchHold || tick < s.remountAt || tick < s.heroDamagedAt + T.damageLock) return false;
    latch(h, s, REACH);
    return true;
  };

  /** A grounded hero on a Bough Spring pad flies its arc to the landing point (GDD §7.15). */
  const trySpring = (h: HeroEntity, s: HeroState): boolean => {
    const tick = clock.tick;
    const cond = h.stats.conditions;
    if (springs.length === 0 || tick < s.springReadyAt || cond.has('grounded') || isEgg(h)) return false;
    for (const sp of springs) {
      const dx = h.pos.x - sp.pad.x;
      const dz = h.pos.z - sp.pad.z;
      if (dx * dx + dz * dz > sp.radius * sp.radius || Math.abs(h.pos.y - sp.pad.y) > SPRING.padHeight) continue;
      const rise = sp.apexY - h.pos.y;
      if (rise <= 0) continue;
      // A ballistic arc under hero gravity: up to the apex, then down to the landing height.
      const vy = Math.sqrt(2 * AIR.gravity * rise);
      const up = vy / AIR.gravity;
      const flight = up + Math.sqrt((2 * Math.max(0, sp.apexY - sp.land.y)) / AIR.gravity);
      h.vel = { x: (sp.land.x - h.pos.x) / flight, y: vy, z: (sp.land.z - h.pos.z) / flight };
      endSlide(h, s);
      s.dashUntil = NEVER;
      s.lastGroundTick = NEVER;
      s.jumpBufferUntil = NEVER;
      s.spring = { apexAt: tick + ticks(up), clipUntil: tick + T.springClip };
      s.springReadyAt = tick + T.springCooldown;
      h.motor.dashing = false;
      h.motor.grounded = false;
      emit(h.id, 'jump');
      return true;
    }
    return false;
  };

  /** GDD §7.15 clipped launch: the rise stops, air control drops to the after-apex share, and a slow. */
  const clipSpring = (h: HeroEntity, s: HeroState, e: DamageAppliedEvent): void => {
    const sp = s.spring;
    if (!sp) return;
    sp.clipUntil = NEVER;
    sp.apexAt = clock.tick;
    h.vel.y = Math.min(h.vel.y, 0);
    const cause: EffectCause = {
      source: e.source,
      team: e.sourceTeam,
      via: 'objective',
      ability: null,
      item: null,
      values: null,
      songPower: 0,
      proc: true,
      origin: copy(h.pos),
    };
    ctx.effects.apply(
      { kind: 'applyStatus', status: SLOW, durationS: SPRING.clipSlowS, magnitude: SPRING.clipSlow },
      { entity: h.id, point: copy(h.pos), dir: lookDir(h.yaw, 0) },
      cause,
    );
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

  const groundedOrCoyote = (h: HeroEntity, s: HeroState): boolean =>
    h.motor.grounded || clock.tick - s.lastGroundTick <= T.coyote;

  const dashJumpReady = (h: HeroEntity, s: HeroState): boolean => {
    const elapsed = clock.tick - s.dashStarted;
    return s.dashGround && elapsed >= T.dashJumpOpen && elapsed <= T.dashJumpClose &&
      h.motor.stamina >= DASH.jumpCost && groundedOrCoyote(h, s);
  };

  const canSlide = (h: HeroEntity, s: HeroState, speed: number): boolean =>
    h.motor.crouching && speed > 0 && (speed >= SLIDE.minSpeed || s.downhill > SLIDE_MIN_SLOPE_TAN);

  const locomotion = (h: HeroEntity, s: HeroState, inReach: boolean): void => {
    const m = h.motor;
    const v = h.vel;
    const cond = h.stats.conditions;
    const tick = clock.tick;
    if (m.knockedUp && tick >= s.knockUpUntil) m.knockedUp = false;
    const canAct = !cond.has('stunned') && !m.knockedUp;
    const canMove = canAct && !cond.has('rooted');
    const canLeave = canMove && !cond.has('grounded');
    const egg = isEgg(h);
    const pressed = canAct ? h.command.pressed : 0;
    const held = canAct ? h.command.held : 0;
    const input = canMove ? wish(h) : 0;

    if ((held & Button.Aim) !== 0) s.aimReadyAt = tick + T.sprintDelay + 1;
    const combatReady = h.health.inCombatUntil > 0 ? h.health.inCombatUntil + T.afterCombat : NEVER;
    if (tick < Math.max(s.aimReadyAt, combatReady)) s.sprint = 0;
    else if (input > 0 && !m.crouching) s.sprint = Math.min(1, s.sprint + dt / GROUND.sprintRampS);
    const run = runSpeed(h, s);
    const crouchSpeed = slowed(h, GROUND.crouchSpeed);

    const wantCrouch = (held & Button.Crouch) !== 0;
    if (wantCrouch !== m.crouching && (wantCrouch || space.fits(h.id, h.pos, false))) m.crouching = wantCrouch;
    if (m.sliding && (!m.crouching || !canMove)) endSlide(h, s);

    const speed = dmath.hypot(v.x, v.z);
    if (canMove && m.grounded && !m.sliding && !m.dashing && canSlide(h, s, speed)) {
      startSlide(h, s, speed, crouchSpeed);
    }
    const jumpPressed = (pressed & Button.Jump) !== 0;
    const wantsMantle = ((pressed | held) & Button.Jump) !== 0 && canLeave && !egg && !s.displaced;
    if (wantsMantle && input > 0) {
      const origin = { x: h.pos.x, y: h.pos.y + GROUND.stepUp, z: h.pos.z };
      const face = service.raycast(origin, W, MANTLE.reach + h.radius, MOVE_MASK);
      const gap = face ? -face.distance * (face.normal.x * W.x + face.normal.z * W.z) : 0;
      if (face && tryMantle(h, s, face.normal, input, v.x, v.z, gap)) return;
    }
    // GDD §3.3 jump priority: a held-Jump latch comes after a ledge pull-up.
    if (canLeave && !egg && !s.displaced && tryLatch(h, s, inReach)) return;
    if (jumpPressed) s.jumpBufferUntil = tick + T.buffer;
    if (
      (pressed & Button.Dash) !== 0 && canLeave && m.stamina >= DASH.cost && tick >= s.nextDashAt &&
      (m.grounded || !s.airDashUsed)
    ) {
      startDash(h, s, input);
    }
    if (m.dashing && !canLeave) {
      m.dashing = false;
      s.dashStarted = NEVER;
    }
    if (m.dashing && tick >= s.dashUntil) {
      // Dash over: exit at run speed + 1 in the dash direction.
      m.dashing = false;
      v.x = s.dashX * (run + DASH.exitBonus);
      v.z = s.dashZ * (run + DASH.exitBonus);
    }


    m.dashJumpReady = canLeave && dashJumpReady(h, s);
    let jump: MovementAction | null = null;
    let downDash = false;
    if (canLeave && tick <= s.jumpBufferUntil) {
      if (m.dashJumpReady) {
        v.x = s.dashX * DASH.jumpHorizontal;
        v.z = s.dashZ * DASH.jumpHorizontal;
        v.y = DASH.jumpVertical;
        m.stamina -= DASH.jumpCost;
        jump = 'dashJump';
      } else if (groundedOrCoyote(h, s)) {
        if (m.dashing) {
          v.x = s.dashX * (run + DASH.exitBonus);
          v.z = s.dashZ * (run + DASH.exitBonus);
        }
        v.y = JUMP_SPEED;
        jump = 'jump';
      } else if (tick <= s.wallAt + T.wallGrace && (s.wallJumps === 0 || m.stamina >= AIR.wall.repeatCost)) {
        const together = v.x * s.wallX + v.z * s.wallZ;
        v.x += (AIR.wall.push - together) * s.wallX;
        v.z += (AIR.wall.push - together) * s.wallZ;
        const strength = clamp((tick - s.fatigueAt) / T.wallFatigue, 0, 1);
        v.y = AIR.wall.minimumLaunch + (AIR.wall.launch - AIR.wall.minimumLaunch) * strength;
        if (s.wallJumps++ > 0) m.stamina -= AIR.wall.repeatCost;
        s.fatigueAt = tick;
        s.wallAt = NEVER;
        jump = 'wallJump';
      } else if (jumpPressed && !s.airJumpUsed && m.stamina >= AIR.jumpCost) {
        v.y = JUMP_SPEED;
        s.airJumpUsed = true;
        m.stamina -= AIR.jumpCost;
        jump = 'airJump';
      }
    }
    if (jump !== null) {
      emit(h.id, jump);
      endSlide(h, s);
      m.grounded = false;
      m.dashing = false;
      m.dashJumpReady = false;
      s.dashUntil = NEVER;
      s.dashStarted = NEVER;
      s.lastGroundTick = NEVER;
      s.jumpBufferUntil = NEVER;
    } else if (canLeave && !m.grounded && (pressed & Button.Crouch) !== 0) {
      if (tick <= s.lastCrouchPress + T.crouchTap && !s.downDashUsed && m.stamina >= DASH.down.cost) {
        v.y = -DASH.down.speed;
        s.downDashUsed = true;
        m.stamina -= DASH.down.cost;
        m.dashing = false;
        s.dashStarted = NEVER;
        s.dashUntil = NEVER;
        downDash = true;
        emit(h.id, 'downDash');
      }
      s.lastCrouchPress = tick;
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
    } else if (jump === null && !downDash) {
      const spring = s.spring ? (tick < s.spring.apexAt ? 0 : SPRING.airControl) : 1;
      airControl(v, input, run, m.knockedUp ? 0 : s.displaced ? DISPLACE.airControl : spring);
    }
    if (!canMove && m.grounded) v.x = v.z = 0;

    const vx = v.x;
    const vz = v.z;
    D.x = v.x * dt;
    D.z = v.z * dt;
    D.y = airDash ? 0 : fall(h, v);
    const wasGrounded = m.grounded;
    const r = move(h, m.grounded && v.y <= 0 && D.x === 0 && D.z === 0);
    settle(h, s, r, v.y > 0);
    if (m.sliding && r.hasWall) {
      v.x = r.moved.x / dt;
      v.z = r.moved.z / dt;
      s.slideSpeed = dmath.hypot(v.x, v.z);
      if (s.slideSpeed <= crouchSpeed) endSlide(h, s);
      else {
        s.slideX = v.x / s.slideSpeed;
        s.slideZ = v.z / s.slideSpeed;
      }
    }
    if (!m.grounded && m.sliding) endSlide(h, s);
    if (!wasGrounded && m.grounded && canMove && canSlide(h, s, dmath.hypot(v.x, v.z))) {
      startSlide(h, s, dmath.hypot(v.x, v.z), crouchSpeed);
    }
    m.dashJumpReady = canLeave && dashJumpReady(h, s);

    if (m.grounded && !s.displaced && trySpring(h, s)) return;
    if (!canLeave || egg || s.displaced) return;
    if (wantsMantle && r.hasWall && tryMantle(h, s, r.wall, input, vx, vz)) return;
    tryClimb(h, s, input);
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
    const speed = dmath.hypot(mt.exitX, mt.exitZ);
    const crouching = (h.command.held & Button.Crouch) !== 0;
    h.motor.crouching = crouching;
    h.vel = { x: mt.exitX, y: 0, z: mt.exitZ };
    s.downhill = 0;
    if (canSlide(h, s, speed)) {
      startSlide(h, s, speed, slowed(h, GROUND.crouchSpeed));
      emit(h.id, 'mantleGlide');
    } else {
      h.vel.x *= MANTLE.exitSpeedFraction;
      h.vel.z *= MANTLE.exitSpeedFraction;
    }
    s.lastGroundTick = clock.tick;
    s.groundY = y;
    land(h, s);
  };

  const dashTick = (h: HeroEntity, s: HeroState, d: ScriptedDash): void => {
    d.t++;
    if (d.steer) {
      // Follow the aim yaw, at most steer.max either side of where the dash started (Rampage, D-SYS-011).
      const yaw = d.steer.base + clamp(wrapAngle(h.yaw - d.steer.base), -d.steer.max, d.steer.max);
      const flat = dmath.hypot(d.dirX, d.dirZ);
      d.dirX = dmath.sin(yaw) * flat;
      d.dirZ = dmath.cos(yaw) * flat;
    }
    const f0 = (d.t - 1) / d.n;
    const f1 = d.t / d.n;
    D.x = d.dirX * d.step;
    D.z = d.dirZ * d.step;
    D.y = d.dirY * d.step + d.arc * ARC * (f1 * (1 - f1) - f0 * (1 - f0));
    const r = move(h);
    h.vel = { x: r.moved.x / dt, y: r.moved.y / dt, z: r.moved.z / dt };
    h.motor.grounded = r.grounded && D.y <= 0;
    // Horizontal progress against what was asked: a pitched dash sliding along the floor isn't blocked.
    const flatStep = dmath.hypot(D.x, D.z);
    const blocked = dmath.hypot(r.moved.x, r.moved.z) < flatStep * HALF;
    const dir = flatStep > 0 ? { x: D.x / flatStep, y: 0, z: D.z / flatStep } : lookDir(h.yaw, 0);
    const stopped = (d.onHit.length > 0 || d.stopOnHit) && touch(h, d.cause, d.hit, d.onHit, dir) && d.stopOnHit;
    if (d.cause.via === 'melee') {
      if (r.hasWall && !h.motor.grounded) rememberWall(s, r.wall);
      if ((h.command.pressed & Button.Jump) !== 0) s.jumpBufferUntil = clock.tick + T.buffer;
    }
    if (d.t < d.n && !blocked && !stopped) return;
    s.dash = null;
    h.motor.dashing = false;
    const exit = d.keepSpeed && !blocked && !stopped ? Math.min(flatStep / dt, runSpeed(h, s) + DASH.exitBonus) : 0;
    h.vel = { x: dir.x * exit, y: 0, z: dir.z * exit };
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
    const pressed = h.command.pressed;
    // Holding Jump through the latch and the ride does nothing; once it is let go, the next press jumps off.
    if ((h.command.held & Button.Jump) === 0) ride.released = true;
    if (ride.mount > 0) {
      // The latch: nothing but looking until the hero reaches the cable.
      ride.mount--;
      pointOnLine(line, ride.s, P, TAN);
      const f = 1 - ride.mount / ride.mountTicks;
      const x = ride.from.x + (P.x - ride.from.x) * f;
      const y = ride.from.y + (P.y - ride.from.y) * f;
      const z = ride.from.z + (P.z - ride.from.z) * f;
      h.vel = { x: (x - h.pos.x) / dt, y: (y - h.pos.y) / dt, z: (z - h.pos.z) / dt };
      h.pos = { x, y, z };
      return;
    }
    if ((pressed & Button.Crouch) !== 0) {
      leaveRide(h, s, false);
      return;
    }
    if ((pressed & Button.Jump) !== 0 && ride.released) {
      leaveRide(h, s, true);
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
    const jumped = canMove && (h.command.pressed & Button.Jump) !== 0;
    if (jumped && mode.endOn?.includes('jump') === true) {
      endMode(h);
      return;
    }
    if (mode.endOn === null && mode.kind === 'toboggan' && jumped) {
      // Jump ends a toboggan with a hop that keeps the slide's horizontal speed (air control never adds to it).
      endMode(h);
      if (s.mode === null) {
        v.y = TOBOGGAN_HOP_SPEED;
        h.motor.grounded = false;
        s.lastGroundTick = NEVER;
        emit(h.id, 'jump');
      }
      return;
    }
    if (mode.endOn === null && mode.kind === 'glide' && jumped) {
      // GDD §9.5: Space ends a glide (no hop: the hero falls from there).
      endMode(h);
      return;
    }
    const f = lookDir(h.yaw, h.pitch);
    switch (mode.kind) {
      case 'cling':
        h.vel = { x: 0, y: 0, z: 0 };
        return;
      case 'glide': {
        const gx = input > 0 ? W.x : f.x;
        const gz = input > 0 ? W.z : f.z;
        const gl = dmath.hypot(gx, gz) || 1;
        v.x = (gx / gl) * mode.speed;
        v.z = (gz / gl) * mode.speed;
        D.y = fall(h, v, mode.vertical);
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
        const fl = dmath.hypot(f.x, f.z) || 1;
        const dx = mode.kind === 'toboggan' ? f.x / fl : W.x * input;
        const dz = mode.kind === 'toboggan' ? f.z / fl : W.z * input;
        v.x = canMove ? dx * mode.speed : 0;
        v.z = canMove ? dz * mode.speed : 0;
        D.y = fall(h, v);
        break;
      }
    }
    D.x = v.x * dt;
    D.z = v.z * dt;
    const r = move(h);
    const wasGrounded = h.motor.grounded;
    settle(h, s, r, v.y > 0);
    // GDD §9.5: a glide also ends on landing; `endOn` 'land' says so for any mode.
    const endsOnLand = mode.endOn === null ? mode.kind === 'glide' : mode.endOn.includes('land');
    if (endsOnLand && h.motor.grounded && !wasGrounded) endMode(h);
    else if (mode.onCollide.length > 0) touch(h, mode.cause, mode.hit, mode.onCollide, { x: v.x, y: 0, z: v.z });
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
      if (hasUpdrafts) m.updraftInReach = null;
      s.spring = null;
      s.mode = null;
      if (m.mode !== null) clearMode(h);
      m.knockedUp = false;
      s.displaced = false;
      s.slam = null;
      h.vel = { x: 0, y: 0, z: 0 };
      return;
    }
    const maxStamina = h.stats.final.stamina;
    const recharge = h.stats.final.staminaRecharge;
    if (m.stamina < maxStamina && recharge > 0) m.stamina = Math.min(maxStamina, m.stamina + dt / recharge);
    else if (m.stamina > maxStamina) m.stamina = maxStamina;

    m.dashJumpReady = false;
    s.jumpHeld = (h.command.held & Button.Jump) !== 0 ? s.jumpHeld + 1 : 0;
    // The HUD prompt and bots read the cable in reach; physics latches from it (D-EP-039). No Updrafts, nothing to say.
    const inReach = hasUpdrafts && s.ride === null && s.attach === null && updrafts.reach(h.pos, REACH);
    if (hasUpdrafts) m.updraftInReach = inReach ? REACH.updraft : null;
    s.tunnel = tunnels.some((v) => within(v, h.pos));
    if (s.attach) return;
    if (s.mantle) mantleTick(h, s, s.mantle);
    else if (s.dash) dashTick(h, s, s.dash);
    else if (s.ride) rideTick(h, s, s.ride);
    else if (m.climb !== null) climbTick(h, s, m.climb);
    else if (s.mode) modeTick(h, s, s.mode);
    else locomotion(h, s, inReach);

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
      if (d.cause.via === 'melee' && !h.motor.grounded) s.fatigueAt = clock.tick;
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
      h.motor.modeAllowsGun = mode.allowGun;
      h.motor.modeAllowsAbilities = mode.allowAbilities;
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
