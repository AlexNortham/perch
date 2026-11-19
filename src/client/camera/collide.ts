/**
 * Visual-only camera collision against the map's solid primitives (GDD §4.4). The sim's physics world isn't
 * available client-side, so this is pure maths: a signed-distance estimate per primitive, marched along a segment.
 * Boxes and ramps use max-of-planes (never overestimates the distance); cylinders are exact.
 */
import type { BlockoutPrim, MapData, Vec3 } from '../../sim/core/contracts';
import { PULL_MARGIN, PULL_RADIUS, PULL_STEP } from './constants';

/** Estimated distance from `p` to the primitive's surface (negative inside). */
export function primDistance(prim: BlockoutPrim, p: Vec3): number {
  const dx = p.x - prim.centre.x;
  const dy = p.y - prim.centre.y;
  const dz = p.z - prim.centre.z;
  if (prim.shape === 'cylinder') return Math.max(Math.hypot(dx, dz) - prim.radius, Math.abs(dy) - prim.height / 2);
  // World to the prim's frame: local z is its forward (sin yaw, cos yaw), local x the right.
  const s = Math.sin(prim.yaw);
  const c = Math.cos(prim.yaw);
  const lx = -dx * c + dz * s;
  const lz = dx * s + dz * c;
  const hx = prim.size.x / 2;
  const hy = prim.size.y / 2;
  const hz = prim.size.z / 2;
  if (prim.shape === 'box') return Math.max(Math.abs(lx) - hx, Math.abs(dy) - hy, Math.abs(lz) - hz);
  // Ramp: floor at the box bottom, rising from local -z to the full height at +z; the +z end is a wall.
  const k = prim.size.y / prim.size.z;
  const slope = (dy + hy - (lz + hz) * k) / Math.hypot(1, k);
  return Math.max(Math.abs(lx) - hx, -dy - hy, lz - hz, -lz - hz, slope);
}

/** Radius of a primitive's bounding sphere (for the cheap broad phase). */
function boundRadius(prim: BlockoutPrim): number {
  if (prim.shape === 'cylinder') return Math.hypot(prim.radius, prim.height / 2);
  return Math.hypot(prim.size.x, prim.size.y, prim.size.z) / 2;
}

/** A map's solid primitives with their bounds, built once per map. */
interface Solids {
  readonly prims: readonly BlockoutPrim[];
  readonly bounds: readonly number[];
  /** Scratch list of the prims near the current segment (reused, so no per-frame allocation). */
  readonly near: BlockoutPrim[];
}
const cache = new WeakMap<MapData, Solids>();

function solidsOf(map: MapData): Solids {
  let s = cache.get(map);
  if (!s) {
    const prims = map.prims.filter((p) => p.solid);
    s = { prims, bounds: prims.map(boundRadius), near: [] };
    cache.set(map, s);
  }
  return s;
}

/** Sphere radius for a ray pick: effectively a point. */
const POINT_RADIUS = 0.01;
const probe: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };

/**
 * Distance along the segment from→to a sphere of `radius` travels before touching solid geometry, or the full
 * segment length if it is clear. 0 when it starts in contact.
 */
function march(map: MapData, from: Vec3, to: Vec3, radius: number): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  if (len === 0) return 0;
  const { prims, bounds, near } = solidsOf(map);
  near.length = 0;
  const mx = from.x + dx / 2;
  const my = from.y + dy / 2;
  const mz = from.z + dz / 2;
  for (let i = 0; i < prims.length; i++) {
    const p = prims[i];
    const b = bounds[i];
    if (!p || b === undefined) continue;
    if (Math.hypot(p.centre.x - mx, p.centre.y - my, p.centre.z - mz) <= len / 2 + b + radius) near.push(p);
  }
  for (let t = 0; ; t += PULL_STEP) {
    const d = Math.min(t, len);
    probe.x = from.x + (dx * d) / len;
    probe.y = from.y + (dy * d) / len;
    probe.z = from.z + (dz * d) / len;
    for (const p of near) if (primDistance(p, probe) < radius) return d;
    if (d === len) return len;
  }
}

/**
 * How far along pivot→desired the camera may sit: the sphere-cast hit distance minus the margin, never past the
 * desired position. The caller applies the minimum boom.
 */
export function freeDistance(map: MapData, pivot: Vec3, desired: Vec3): number {
  const len = Math.hypot(desired.x - pivot.x, desired.y - pivot.y, desired.z - pivot.z);
  const hit = march(map, pivot, desired, PULL_RADIUS);
  return hit >= len ? len : Math.max(0, hit - PULL_MARGIN);
}

/** First solid point along a ray (for pings): a point-sized march; null if nothing within `range`. */
export function rayWorldPoint(map: MapData, origin: Vec3, dir: Vec3, range: number, skip: number): Vec3 | null {
  const start = { x: origin.x + dir.x * skip, y: origin.y + dir.y * skip, z: origin.z + dir.z * skip };
  const end = { x: origin.x + dir.x * range, y: origin.y + dir.y * range, z: origin.z + dir.z * range };
  const hit = march(map, start, end, POINT_RADIUS);
  const len = range - skip;
  if (hit >= len) return null;
  return { x: start.x + dir.x * hit, y: start.y + dir.y * hit, z: start.z + dir.z * hit };
}
