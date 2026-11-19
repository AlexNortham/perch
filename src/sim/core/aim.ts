import { CAMERA, CROUCH_SCALE } from '../data/core';
import type { BodyPlan, HeroEntity, LocalOffset, SightLine, Vec3 } from './contracts';
import { clamp } from './math';
import * as dmath from './dmath';

/**
 * The aim model (GDD §4.5), shared by the sim (sim/combat, sim/abilities, sim/ai) and the client camera, so the
 * crosshair is honest:
 *  1. Rebuild the camera from the hero's feet position, look yaw/pitch, shoulder side and body plan (`aimRay`).
 *     The client places its camera at `ray.origin` looking along `ray.dir`; its collision pull-in is visual only.
 *  2. Ignore hits nearer than `ray.start` (camera-to-pivot distance + CAMERA.aimStartPad), so nothing between the
 *     camera and the hero, the hero included, can be the aim point.
 *  3. The first hit along the ray up to the aim range (CAMERA.aimRange or WeaponDef.aimRange) is the aim point:
 *     solid world via ctx.physics (LAYERS_SOLID), heroes and units via their hitboxes (sim/combat); allies are
 *     ignored (no friendly fire). With no hit it is the ray's end.
 *  4. Shots leave the muzzle (`muzzlePoint`) toward the aim point; spread is applied around that direction.
 * Bots aim by setting look yaw/pitch in their command, exactly like the human.
 */

export interface AimRay {
  /** Camera position. */
  readonly origin: Vec3;
  /** Unit look direction through the crosshair. */
  readonly dir: Vec3;
  /** Distance along the ray before which hits are ignored. */
  readonly start: number;
}

/** Unit look direction for a yaw and pitch. */
export function lookDir(yaw: number, pitch: number): Vec3 {
  const cp = dmath.cos(pitch);
  return { x: dmath.sin(yaw) * cp, y: dmath.sin(pitch), z: dmath.cos(yaw) * cp };
}

/** Horizontal unit vector to the right of a yaw. */
export function rightDir(yaw: number): Vec3 {
  return { x: -dmath.cos(yaw), y: 0, z: dmath.sin(yaw) };
}

/** A point in an entity's frame (feet at `pos`, facing `yaw`) to world space. */
export function toWorld(pos: Vec3, yaw: number, off: LocalOffset): Vec3 {
  const s = dmath.sin(yaw);
  const c = dmath.cos(yaw);
  return {
    x: pos.x + s * off.forward - c * off.right,
    y: pos.y + off.up,
    z: pos.z + c * off.forward + s * off.right,
  };
}

export function clampPitch(pitch: number): number {
  return clamp(pitch, CAMERA.pitchMin, CAMERA.pitchMax);
}

/** Boom length for a hero: scaled with its height, clamped (GDD §4.1). */
export function boomLength(body: BodyPlan): number {
  return clamp((CAMERA.boom * body.height) / CAMERA.referenceHeight, CAMERA.boomMin, CAMERA.boomMax);
}

/** Camera pivot height above the feet (lowered with the head while crouched or sliding). */
export function pivotHeight(body: BodyPlan, crouching: boolean): number {
  return (body.head.centre.up - CAMERA.pivotBelowHead) * (crouching ? CROUCH_SCALE : 1);
}

/** Steps 1 and 2 of the aim model. */
export function aimRay(
  pos: Vec3,
  yaw: number,
  pitch: number,
  shoulder: 1 | -1,
  body: BodyPlan,
  crouching: boolean,
): AimRay {
  const dir = lookDir(yaw, clampPitch(pitch));
  const right = rightDir(yaw);
  const boom = boomLength(body);
  const side = CAMERA.shoulderRight * shoulder;
  const pivot = { x: pos.x, y: pos.y + pivotHeight(body, crouching), z: pos.z };
  const origin = {
    x: pivot.x + right.x * side - dir.x * boom,
    y: pivot.y + CAMERA.shoulderUp - dir.y * boom,
    z: pivot.z + right.z * side - dir.z * boom,
  };
  const toPivot = dmath.hypot(pivot.x - origin.x, pivot.y - origin.y, pivot.z - origin.z);
  return { origin, dir, start: toPivot + CAMERA.aimStartPad };
}

/** Resolve the displayed crosshair in the sim; the muzzle-to-target leg still tests real cover. */
export function heroAimRay(hero: HeroEntity, body: BodyPlan, sight: SightLine | undefined = hero.command.sight): AimRay {
  const crouching = hero.motor.crouching || hero.motor.sliding;
  const fallback = (): AimRay => aimRay(hero.pos, hero.yaw, hero.pitch, hero.shoulder, body, crouching);
  if (!sight || hero.hero.controller !== 'human') return fallback();
  const { origin, dir } = sight;
  const dx = hero.pos.x - origin.x, dy = hero.pos.y + pivotHeight(body, crouching) - origin.y, dz = hero.pos.z - origin.z;
  const length = dmath.hypot(dir.x, dir.y, dir.z);
  if (!Number.isFinite(length) || !length || !(dmath.hypot(dx, dy, dz) <= CAMERA.boomMax + body.height)) return fallback();
  const unit = { x: dir.x / length, y: dir.y / length, z: dir.z / length };
  return { origin, dir: unit, start: Math.max(0, dx * unit.x + dy * unit.y + dz * unit.z + CAMERA.aimStartPad) };
}

/** Step 4 of the aim model: where shots leave the gun. */
export function muzzlePoint(pos: Vec3, yaw: number, body: BodyPlan, crouching: boolean): Vec3 {
  const k = crouching ? CROUCH_SCALE : 1;
  return toWorld(pos, yaw, { right: body.muzzle.right, up: body.muzzle.up * k, forward: body.muzzle.forward });
}
