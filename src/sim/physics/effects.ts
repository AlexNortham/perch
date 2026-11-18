/**
 * Physics-owned effect kinds (GDD §9.25, §3.9): displace, dash, teleport, movementMode, attach. They move heroes
 * only: units' pos belongs to their spawner (sim/world, sim/abilities), so effects on units are ignored here.
 *
 * Who moves: displace and attach act on the target entity; a dash with dir 'target' and a teleport to a point or
 * behind a target move the cause's source (the caster) toward the target; every other dash, teleport 'base' and
 * movementMode move the target entity, or the source when the target has none (D-CTRL-004).
 */
import type { CoreContext, EntityId, HeroEntity, PhysicsService, Vec3 } from '../core/contracts';
import { lookDir } from '../core/aim';
import { ticks } from '../core/math';
import { AIR, DISPLACE } from '../data/movement';
import type { Controller } from './controller';


const LAUNCH = DISPLACE.launch;

export function registerEffects(ctx: CoreContext, ctrl: Controller, service: PhysicsService): void {
  const { store, effects, clock } = ctx;

  const livingHero = (id: EntityId | null): HeroEntity | undefined => {
    const h = id === null ? undefined : store.getKind(id, 'hero');
    return h && !h.health.dead ? h : undefined;
  };
  /** Horizontal unit vector of (x, z), or the hero's facing when it is zero. */
  const flat = (h: HeroEntity, x: number, z: number): Vec3 => {
    const len = Math.hypot(x, z);
    return len > 0 ? { x: x / len, y: 0, z: z / len } : lookDir(h.yaw, 0);
  };

  effects.handle('displace', 'physics', (e, target, cause) => {
    const h = livingHero(target.entity);
    const s = h && ctrl.state(h.id);
    if (!h || !s || h.stats.conditions.has('unstoppable')) return;
    const distance = Math.max(0, effects.magnitude(e.distance, cause));
    ctrl.interrupt(h);
    const v = h.vel;
    if (e.mode === 'up') {
      // Knock-up: straight up to `distance`, no control until landing (max DISPLACE.knockUpMaxS).
      v.x = 0;
      v.z = 0;
      v.y = Math.sqrt(2 * AIR.gravity * distance);
      h.motor.knockedUp = true;
      s.knockUpUntil = clock.tick + ticks(DISPLACE.knockUpMaxS);
    } else {
      let dx = e.mode === 'along' ? target.dir.x : h.pos.x - cause.origin.x;
      let dz = e.mode === 'along' ? target.dir.z : h.pos.z - cause.origin.z;
      if (e.mode === 'pull') {
        dx = -dx;
        dz = -dz;
      }
      const len = Math.hypot(dx, dz);
      if (len === 0) return;
      // An arc launched at DISPLACE.launchDeg that lands `distance` away on flat ground (pulls stop at the origin).
      const range = e.mode === 'pull' ? Math.min(distance, len) : distance;
      const speed = Math.sqrt((range * AIR.gravity) / Math.sin(2 * LAUNCH));
      v.x += (dx / len) * speed * Math.cos(LAUNCH);
      v.z += (dz / len) * speed * Math.cos(LAUNCH);
      v.y = Math.max(v.y, 0) + speed * Math.sin(LAUNCH);
      s.displaced = true;
    }
    h.motor.grounded = false;
    s.lastGroundTick = Number.NEGATIVE_INFINITY;
  });

  effects.handle('dash', 'physics', (e, target, cause) => {
    const h = livingHero(e.dir === 'target' ? cause.source : (target.entity ?? cause.source));
    if (!h) return;
    let distance = effects.magnitude(e.distance, cause);
    let dir: Vec3;
    if (e.dir === 'aim') {
      dir = flat(h, target.dir.x, target.dir.z);
    } else if (e.dir === 'move') {
      const m = ctrl.moveDir(h);
      dir = flat(h, m.x, m.z);
    } else {
      // To the target entity (stopping at contact) or point.
      const t = target.entity !== null ? store.get(target.entity) : undefined;
      const goal = t?.pos ?? target.point;
      const gap = Math.hypot(goal.x - h.pos.x, goal.z - h.pos.z) - (t ? t.radius + h.radius : 0);
      distance = Math.min(distance, Math.max(0, gap));
      dir = flat(h, goal.x - h.pos.x, goal.z - h.pos.z);
    }
    const n = Math.max(1, ticks(effects.magnitude(e.durationS, cause)));
    ctrl.startAbilityDash(h, {
      dirX: dir.x,
      dirZ: dir.z,
      step: distance / n,
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
    const other = target.entity !== null ? store.get(target.entity) : undefined;
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
    if (e.face === 'target') {
      // TODO(interface request): core re-latches hero yaw from the command next tick; input/ai must adopt it.
      const look = other?.pos ?? target.point;
      const dx = look.x - dest.x;
      const dz = look.z - dest.z;
      if (dx !== 0 || dz !== 0) h.yaw = Math.atan2(dx, dz);
    }
  });

  effects.handle('movementMode', 'physics', (e, target, cause) => {
    const h = livingHero(target.entity ?? cause.source);
    if (!h) return;
    ctrl.startMode(h, {
      kind: e.mode,
      until: clock.tick + Math.max(1, ticks(effects.magnitude(e.durationS, cause))),
      speed: e.speed,
      vertical: e.verticalSpeed,
      onCollide: e.onCollide ?? [],
      onEnd: e.onEnd ?? [],
      cause,
    });
  });

  effects.handle('attach', 'physics', (e, target, cause) => {
    const victim = livingHero(target.entity);
    const carrier = livingHero(cause.source);
    if (!victim || !carrier || victim.id === carrier.id || victim.stats.conditions.has('unstoppable')) return;
    ctrl.startAttach(victim, {
      to: carrier.id,
      until: clock.tick + Math.max(1, ticks(effects.magnitude(e.durationS, cause))),
      onRelease: e.onRelease,
      cause,
    });
  });
}
