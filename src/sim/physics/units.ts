/**
 * Units under physics effects (D-ARCH-014): displace, dash and attach move fledglings, neutrals and summons too.
 * While one acts on a unit, physics writes its pos and vel and roots it under the stat source 'physics:displaced'
 * (world and abilities don't steer a rooted unit); the root clears when the motion ends. Units have no character
 * controller: they move over the cached ground (moveCharacter's cheap path), with one horizontal ray per tick for
 * walls, where they stop (and slam, GDD §3.9).
 */
import { LAYERS_SOLID } from '../core/contracts';
import type { CharacterMove, CoreContext, Effect, EffectCause, EntityId, Hasher, PhysicsService, UnitEntity, Vec3 } from '../core/contracts';
import { lookDir } from '../core/aim';
import { copy } from '../core/math';
import { TICK_SECONDS } from '../data/core';
import { AIR, DISPLACE, GROUND } from '../data/movement';
import type { Slam } from './controller';
import * as dmath from '../core/dmath';

const dt = TICK_SECONDS;
const HALF = 0.5;
const ARC = 4;
const KEY = 'physics:displaced';
const ROOTED = { conditions: ['rooted'] } as const;
const WALKABLE_NY = dmath.cos(GROUND.maxSlope);

interface Motion {
  /** Scripted dash: ticks done and total (n 0 for a flight), per-tick delta, arc height, effects on arrival. */
  t: number;
  readonly n: number;
  readonly step: Vec3;
  readonly arc: number;
  readonly onArrive: readonly Effect[];
  readonly cause: EffectCause | null;
  slam: Slam | null;
  /** Held at another entity's socket until `until` (attach). */
  readonly holder: EntityId | null;
  readonly until: number;
  readonly onRelease: readonly Effect[];
}

export interface UnitMover {
  /** A push, pull, along or knock-up: flies from `vel` until it lands. */
  displace(u: UnitEntity, vel: Vec3, slam: Slam | null): void;
  /** A dash of `n` ticks moving `step` per tick (plus the arc), then a fall. */
  dash(u: UnitEntity, step: Vec3, n: number, arc: number, onArrive: readonly Effect[], cause: EffectCause): void;
  attach(u: UnitEntity, holder: EntityId, until: number, onRelease: readonly Effect[], cause: EffectCause): void;
  /** Movement phase. */
  step(): void;
  remove(id: EntityId): void;
  hash(h: Hasher): void;
}

export function createUnitMover(ctx: CoreContext, service: PhysicsService): UnitMover {
  const { store, stats, clock, map } = ctx;
  const motions = new Map<EntityId, Motion>();
  const ZERO: Vec3 = { x: 0, y: 0, z: 0 };
  const result: CharacterMove = { pos: { x: 0, y: 0, z: 0 }, grounded: false, wall: null };

  const start = (u: UnitEntity, m: Motion): void => {
    motions.set(u.id, m);
    stats.set(u.id, KEY, ROOTED);
  };
  const end = (u: UnitEntity): void => {
    motions.delete(u.id);
    stats.set(u.id, KEY, null);
    u.vel.x = 0;
    u.vel.y = 0;
    u.vel.z = 0;
  };
  const flight = (slam: Slam | null): Motion => ({
    t: 0, n: 0, step: ZERO, arc: 0, onArrive: [], cause: null, slam, holder: null, until: 0, onRelease: [],
  });

  /** Stops the horizontal part of `d` at a wall in front of the unit; slams if it was fast enough. */
  const wall = (u: UnitEntity, m: Motion, d: Vec3): boolean => {
    const len = dmath.hypot(d.x, d.z);
    if (len === 0) return false;
    const dir = { x: d.x / len, y: 0, z: d.z / len };
    const from = { x: u.pos.x, y: u.pos.y + Math.min(u.unit.height * HALF, GROUND.stepUp + u.radius), z: u.pos.z };
    const hit = service.raycast(from, dir, len + u.radius, LAYERS_SOLID);
    if (!hit || hit.normal.y >= WALKABLE_NY) return false;
    const k = Math.max(0, hit.distance - u.radius) / len;
    const toward = (len / dt) * -(dir.x * hit.normal.x + dir.z * hit.normal.z) / (dmath.hypot(hit.normal.x, hit.normal.z) || 1);
    d.x *= k;
    d.z *= k;
    const slam = m.slam;
    m.slam = null;
    if (slam && toward >= DISPLACE.wallSlamSpeed) {
      ctx.effects.applyAll(slam.onWall, { entity: u.id, point: copy(u.pos), dir }, slam.cause);
    }
    return true;
  };

  const hold = (u: UnitEntity, m: Motion): void => {
    const holder = m.holder === null ? undefined : store.get(m.holder);
    const free =
      !holder || holder.removed || ('health' in holder && holder.health.dead) || stats.has(holder.id, 'stunned') ||
      clock.tick >= m.until;
    const f = lookDir(holder?.yaw ?? u.yaw, 0);
    if (!free && holder) {
      const gap = holder.radius + u.radius;
      u.pos.x = holder.pos.x + f.x * gap;
      u.pos.y = holder.pos.y;
      u.pos.z = holder.pos.z + f.z * gap;
      u.vel.x = holder.vel.x;
      u.vel.y = holder.vel.y;
      u.vel.z = holder.vel.z;
      return;
    }
    end(u);
    if (m.cause) ctx.effects.applyAll(m.onRelease, { entity: u.id, point: copy(u.pos), dir: f }, m.cause);
  };

  const move = (u: UnitEntity, m: Motion): void => {
    const v = u.vel;
    const d = { x: 0, y: 0, z: 0 };
    const dashing = m.t < m.n;
    if (dashing) {
      m.t++;
      const f0 = (m.t - 1) / m.n;
      const f1 = m.t / m.n;
      d.x = m.step.x;
      d.y = m.step.y + m.arc * ARC * (f1 * (1 - f1) - f0 * (1 - f0));
      d.z = m.step.z;
    } else {
      const before = v.y;
      v.y = Math.max(v.y - AIR.gravity * dt, -AIR.maxFallSpeed);
      d.x = v.x * dt;
      d.y = (before + v.y) * HALF * dt;
      d.z = v.z * dt;
    }
    const blocked = wall(u, m, d);
    const rising = d.y > 0;
    const r = service.moveCharacter(u.id, d, result);
    // A dash keeps to the ground within the snap; a flight lands only when it reaches the ground (r.pos.y), and only
    // the part of the tick before touching down moves it on, so it lands `distance` away.
    const landed = r.grounded && !rising && (dashing || u.pos.y + d.y <= r.pos.y);
    const k = landed && !dashing && d.y < 0 ? Math.min(1, Math.max(0, (u.pos.y - r.pos.y) / -d.y)) : 1;
    u.pos.x += d.x * k;
    u.pos.z += d.z * k;
    if (landed) u.pos.y = r.pos.y;
    else u.pos.y += d.y;
    if (dashing) {
      v.x = d.x / dt;
      v.y = d.y / dt;
      v.z = d.z / dt;
      if (m.t < m.n && !blocked) return;
      // Dash over (or cut short by a wall): onArrive, then it falls from where it is.
      m.t = m.n;
      v.x = 0;
      v.y = 0;
      v.z = 0;
      const len = dmath.hypot(m.step.x, m.step.z) || 1;
      if (m.cause) ctx.effects.applyAll(m.onArrive, { entity: u.id, point: copy(u.pos), dir: { x: m.step.x / len, y: 0, z: m.step.z / len } }, m.cause);
      return;
    }
    if (blocked) {
      v.x = 0;
      v.z = 0;
    }
    if (landed || u.pos.y < map.killY) end(u);
  };

  return {
    displace(u, vel, slam) {
      u.vel.x = vel.x;
      u.vel.y = vel.y;
      u.vel.z = vel.z;
      start(u, flight(slam));
    },
    dash(u, step, n, arc, onArrive, cause) {
      start(u, { t: 0, n, step: copy(step), arc, onArrive, cause, slam: null, holder: null, until: 0, onRelease: [] });
    },
    attach(u, holder, until, onRelease, cause) {
      start(u, { t: 0, n: 0, step: ZERO, arc: 0, onArrive: [], cause, slam: null, holder, until, onRelease });
    },
    step() {
      for (const [id, m] of motions) {
        const u = store.getKind(id, 'unit');
        if (!u || u.removed || u.health.dead) {
          motions.delete(id);
          continue;
        }
        if (m.holder !== null) hold(u, m);
        else move(u, m);
      }
    },
    remove(id) {
      motions.delete(id);
    },
    hash(h) {
      for (const [id, m] of motions) {
        h.num(id);
        h.num(m.t);
        h.num(m.until);
        h.num(m.slam ? 1 : 0);
      }
    },
  };
}
