/**
 * Physics-owned effect kinds (GDD §9.25, §3.9): displace, dash, teleport, movementMode, attach.
 *
 * Who moves: displace and attach act on the target entity; a dash with dir 'target' and a teleport to a point or
 * behind a target move the cause's source (the caster) toward the target; every other dash, teleport 'base' and
 * movementMode move the target entity, or the source when the target has none (D-CTRL-004). Displace, dash and attach
 * move units too (units.ts, D-ARCH-014); teleports and movement modes are for heroes only.
 *
 * A dash 'target' whose target entity is the mover itself (a point cast: D-ABIL-001 sets entity = caster) goes to
 * `target.point`. An 'aim' dash follows the aim pitch, at most DASH.aimMaxPitchUp upward, unless its data sets
 * `arcHeight` (0 = a flat dash), which keeps it horizontal (D-SYS-003).
 */
import type { CoreContext, DisplaceEffect, EffectCause, EffectTarget, EntityId, HeroEntity, PhysicsService, UnitEntity, Vec3 } from '../core/contracts';
import { lookDir } from '../core/aim';
import { ticks } from '../core/math';
import { SURFACE_VALUE } from '../data/abilities';
import { AIR, CONTROLLER, DASH, DEGREES_PER_HALF_TURN, DISPLACE, STEER_VALUE } from '../data/movement';
import type { Controller, Slam } from './controller';
import type { UnitMover } from './units';
import * as dmath from '../core/dmath';

const LAUNCH = DISPLACE.launch;

export function registerEffects(ctx: CoreContext, ctrl: Controller, service: PhysicsService, units: UnitMover): void {
  const { store, effects, clock, bus } = ctx;

  const livingHero = (id: EntityId | null): HeroEntity | undefined => {
    const h = id === null ? undefined : store.getKind(id, 'hero');
    return h && !h.health.dead ? h : undefined;
  };
  const livingUnit = (id: EntityId | null): UnitEntity | undefined => {
    const u = id === null ? undefined : store.getKind(id, 'unit');
    return u && !u.removed && !u.health.dead && !u.stats.conditions.has('unstoppable') ? u : undefined;
  };
  /** Horizontal unit vector of (x, z), or the facing `yaw` when it is zero. */
  const flat = (yaw: number, x: number, z: number): Vec3 => {
    const len = dmath.hypot(x, z);
    return len > 0 ? { x: x / len, y: 0, z: z / len } : lookDir(yaw, 0);
  };

  /**
   * The launch velocity of a displacement of the entity at `pos` (GDD §3.9 gives flat-ground distances): an arc at
   * DISPLACE.launch landing `distance` away (pulls stop at the origin), or straight up to `distance`. Null for a push
   * or pull with no direction.
   */
  const launch = (e: DisplaceEffect, distance: number, pos: Vec3, target: EffectTarget, cause: EffectCause): Vec3 | null => {
    if (e.mode === 'up') return { x: 0, y: Math.sqrt(2 * AIR.gravity * distance), z: 0 };
    let dx = e.mode === 'along' ? target.dir.x : pos.x - cause.origin.x;
    let dz = e.mode === 'along' ? target.dir.z : pos.z - cause.origin.z;
    if (e.mode === 'pull') {
      dx = -dx;
      dz = -dz;
    }
    const len = dmath.hypot(dx, dz);
    if (len === 0) return null;
    const range = e.mode === 'pull' ? Math.min(distance, len) : distance;
    const speed = Math.sqrt((range * AIR.gravity) / dmath.sin(2 * LAUNCH));
    const h = speed * dmath.cos(LAUNCH);
    return { x: (dx / len) * h, y: speed * dmath.sin(LAUNCH), z: (dz / len) * h };
  };

  effects.handle('displace', 'physics', (e, target, cause) => {
    const distance = Math.max(0, effects.magnitude(e.distance, cause));
    const slam: Slam | null = e.mode === 'up' ? null : { onWall: e.onWall ?? [], cause };
    const u = livingUnit(target.entity);
    if (u) {
      const v = launch(e, distance, u.pos, target, cause);
      if (v) units.displace(u, v, slam);
      return;
    }
    const h = livingHero(target.entity);
    const s = h && ctrl.state(h.id);
    if (!h || !s || h.stats.conditions.has('unstoppable')) return;
    const v0 = launch(e, distance, h.pos, target, cause);
    if (!v0) return;
    ctrl.interrupt(h);
    const v = h.vel;
    if (e.mode === 'up') {
      // Knock-up: straight up to `distance`, no control until landing (max DISPLACE.knockUpMaxS).
      v.x = 0;
      v.z = 0;
      v.y = v0.y;
      h.motor.knockedUp = true;
      s.knockUpUntil = clock.tick + ticks(DISPLACE.knockUpMaxS);
    } else {
      // The push adds to the current velocity; the hero lands where the arc ends and stops there (controller land()).
      v.x += v0.x;
      v.z += v0.z;
      v.y = Math.max(v.y, 0) + v0.y;
      s.displaced = true;
      s.slam = slam;
    }
    h.motor.grounded = false;
    s.lastGroundTick = Number.NEGATIVE_INFINITY;
    bus.emit({ type: 'movement', hero: h.id, action: 'displaced' });
  });

  effects.handle('dash', 'physics', (e, target, cause) => {
    const moverId = e.dir === 'target' ? cause.source : (target.entity ?? cause.source);
    const h = livingHero(moverId);
    const u = h ? undefined : livingUnit(moverId);
    const mover = h ?? u;
    if (!mover) return;
    let distance = effects.magnitude(e.distance, cause);
    let dir: Vec3;
    if (e.dir === 'aim') {
      dir = flat(mover.yaw, target.dir.x, target.dir.z);
      if (e.arcHeight === undefined) {
        const cap = e.maxPitchUpDeg === undefined ? DASH.aimMaxPitchUp : (e.maxPitchUpDeg * Math.PI) / DEGREES_PER_HALF_TURN;
        const pitch = cap <= 0 ? 0 : Math.min(dmath.atan2(target.dir.y, dmath.hypot(target.dir.x, target.dir.z)), cap);
        dir = { x: dir.x * dmath.cos(pitch), y: dmath.sin(pitch), z: dir.z * dmath.cos(pitch) };
      }
    } else if (e.dir === 'move') {
      const m = h ? ctrl.moveDir(h) : target.dir;
      dir = flat(mover.yaw, m.x, m.z);
    } else {
      // To the target entity (stopping at contact) or point; a target that is the mover itself means the point.
      const t = target.entity !== null && target.entity !== mover.id ? store.get(target.entity) : undefined;
      const goal = t?.pos ?? target.point;
      const gap = dmath.hypot(goal.x - mover.pos.x, goal.z - mover.pos.z) - (t ? t.radius + mover.radius : 0);
      distance = Math.min(distance, Math.max(0, gap));
      dir = flat(mover.yaw, goal.x - mover.pos.x, goal.z - mover.pos.z);
      if (!t && (cause.values?.[SURFACE_VALUE] ?? 0) >= 1) {
        // A surface point (a wall or tree under the crosshair, D-SYS-012): fly straight at it, stopping with the body
        // just short of the surface.
        const back = mover.radius + CONTROLLER.skin;
        const dx = goal.x - dir.x * back - mover.pos.x;
        const dy = goal.y - mover.pos.y;
        const dz = goal.z - dir.z * back - mover.pos.z;
        const len = dmath.hypot(dx, dy, dz);
        distance = Math.min(effects.magnitude(e.distance, cause), len);
        if (len > 0) dir = { x: dx / len, y: dy / len, z: dz / len };
      }
    }
    const n = Math.max(1, ticks(effects.magnitude(e.durationS, cause)));
    const step = distance / n;
    if (u) {
      units.dash(u, { x: dir.x * step, y: dir.y * step, z: dir.z * step }, n, e.arcHeight ?? 0, e.onArrive ?? [], cause);
      return;
    }
    if (!h) return;
    const steerDeg = e.dir === 'aim' ? (cause.values?.[STEER_VALUE] ?? 0) : 0;
    ctrl.startAbilityDash(h, {
      dirX: dir.x,
      dirY: dir.y,
      dirZ: dir.z,
      steer: steerDeg > 0 ? { base: dmath.atan2(dir.x, dir.z), max: (steerDeg * Math.PI) / DEGREES_PER_HALF_TURN } : null,
      step,
      n,
      arc: e.arcHeight ?? 0,
      stopOnHit: e.stopOnHit ?? false,
      keepSpeed: e.dir !== 'target',
      onHit: e.onHit ?? [],
      onArrive: e.onArrive ?? [],
      cause,
    });
  });

  effects.handle('teleport', 'physics', (e, target, cause) => {
    const h = livingHero(e.to === 'base' ? (target.entity ?? cause.source) : cause.source);
    const s = h && ctrl.state(h.id);
    if (!h || !s) return;
    const other = target.entity !== null && target.entity !== h.id ? store.get(target.entity) : undefined;
    let dest: Vec3;
    if (e.to === 'base') {
      dest = ctrl.spawnPoint(h);
    } else if (e.to === 'point') {
      dest = { ...target.point };
    } else {
      if (!other) return;
      const back = lookDir(other.yaw, 0);
      const behind = e.behind ?? DISPLACE.behindDefault;
      dest = { x: other.pos.x - back.x * behind, y: other.pos.y, z: other.pos.z - back.z * behind };
    }
    if (e.to !== 'base') dest.y = service.groundHeight(dest.x, dest.z, dest.y + DISPLACE.groundProbe) ?? dest.y;
    ctrl.interrupt(h);
    h.pos = dest;
    h.vel = { x: 0, y: 0, z: 0 };
    s.groundY = dest.y;
    let yaw: number | undefined;
    if (e.face === 'target') {
      // Core re-latches yaw from the command next tick: the event's yaw is what input and ai adopt (W2.5 #27).
      const look = other?.pos ?? target.point;
      const dx = look.x - dest.x;
      const dz = look.z - dest.z;
      if (dx !== 0 || dz !== 0) yaw = h.yaw = dmath.atan2(dx, dz);
    }
    bus.emit(yaw === undefined ? { type: 'movement', hero: h.id, action: 'teleport' } : { type: 'movement', hero: h.id, action: 'teleport', yaw });
  });

  effects.handle('movementMode', 'physics', (e, target, cause) => {
    const h = livingHero(target.entity ?? cause.source);
    if (!h) return;
    ctrl.startMode(h, {
      kind: e.mode,
      until: clock.tick + Math.max(1, ticks(effects.magnitude(e.durationS, cause))),
      speed: e.speed,
      vertical: e.verticalSpeed,
      allowGun: e.allowGun,
      allowAbilities: e.allowAbilities,
      onCollide: e.onCollide ?? [],
      onEnd: e.onEnd ?? [],
      endOn: e.endOn ?? null,
      cause,
    });
  });

  effects.handle('attach', 'physics', (e, target, cause) => {
    const carrier = livingHero(cause.source);
    if (!carrier) return;
    const until = clock.tick + Math.max(1, ticks(effects.magnitude(e.durationS, cause)));
    const u = livingUnit(target.entity);
    if (u) {
      units.attach(u, carrier.id, until, e.onRelease, cause);
      return;
    }
    const victim = livingHero(target.entity);
    if (!victim || victim.id === carrier.id || victim.stats.conditions.has('unstoppable')) return;
    ctrl.startAttach(victim, { to: carrier.id, until, onRelease: e.onRelease, cause });
  });
}
