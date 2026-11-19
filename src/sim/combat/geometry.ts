/** Pure hit geometry for sim/combat. Every ray direction is a unit vector; results are distances along it, −1 for a miss. */
import type { Rng, Vec3 } from '../core/contracts';
import * as dmath from '../core/dmath';

const EPS = 1e-9;
/** Above this |dir.y| the spread basis is built from the x axis instead of up. */
const AXIS_SWITCH = 0.9;

/** The nearer of two hits (either may be −1). */
export function nearer(a: number, b: number): number {
  if (a < 0) return b;
  if (b < 0) return a;
  return a < b ? a : b;
}

/** Entry distance into a sphere; 0 when the origin starts inside. */
export function raySphere(o: Vec3, d: Vec3, cx: number, cy: number, cz: number, r: number): number {
  const ox = o.x - cx;
  const oy = o.y - cy;
  const oz = o.z - cz;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  if (c <= 0) return 0;
  const b = ox * d.x + oy * d.y + oz * d.z;
  if (b >= 0) return -1;
  const h = b * b - c;
  return h < 0 ? -1 : -b - Math.sqrt(h);
}

/** Entry distance through the side of a vertical cylinder (axis at cx, cz) between heights y0 and y1. */
function raySide(o: Vec3, d: Vec3, cx: number, cz: number, y0: number, y1: number, r: number): number {
  const ox = o.x - cx;
  const oz = o.z - cz;
  const c = ox * ox + oz * oz - r * r;
  if (c <= 0) return o.y >= y0 && o.y <= y1 ? 0 : -1;
  const a = d.x * d.x + d.z * d.z;
  const b = ox * d.x + oz * d.z;
  if (a < EPS || b >= 0) return -1;
  const h = b * b - a * c;
  if (h < 0) return -1;
  const t = (-b - Math.sqrt(h)) / a;
  const y = o.y + t * d.y;
  return y >= y0 && y <= y1 ? t : -1;
}

/** Vertical capsule: sphere centres at heights y0 ≤ y1 above (cx, cz), radius r. */
export function rayCapsule(o: Vec3, d: Vec3, cx: number, cz: number, y0: number, y1: number, r: number): number {
  const side = raySide(o, d, cx, cz, y0, y1, r);
  return nearer(side, nearer(raySphere(o, d, cx, y0, cz, r), raySphere(o, d, cx, y1, cz, r)));
}

/** Vertical cylinder standing between heights y0 and y1, radius r (structures). */
export function rayCylinder(o: Vec3, d: Vec3, cx: number, cz: number, y0: number, y1: number, r: number): number {
  const t = raySide(o, d, cx, cz, y0, y1, r);
  if (Math.abs(d.y) <= EPS) return t;
  return nearer(t, nearer(rayCap(o, d, cx, cz, y0, r), rayCap(o, d, cx, cz, y1, r)));
}

/**
 * A box of half extents (hx, hy, hz) centred on (cx, cy, cz), turned by `yaw` about +y (its local z is the yaw's
 * forward), grown by r on every side (a swept sphere against the box's Minkowski hull, square-cornered). Slab test.
 */
export function rayBox(o: Vec3, d: Vec3, cx: number, cy: number, cz: number, yaw: number, hx: number, hy: number, hz: number, r: number): number {
  const s = dmath.sin(yaw);
  const c = dmath.cos(yaw);
  const ox = o.x - cx;
  const oz = o.z - cz;
  // Local axes: x = (cos, 0, −sin), z = (sin, 0, cos). Slabs unrolled: no allocation per cast.
  let tin = 0;
  let tout = Infinity;
  let p = ox * c - oz * s;
  let v = d.x * c - d.z * s;
  let h = hx + r;
  if (Math.abs(v) < EPS) {
    if (p < -h || p > h) return -1;
  } else {
    tin = Math.max(tin, Math.min((-h - p) / v, (h - p) / v));
    tout = Math.min(tout, Math.max((-h - p) / v, (h - p) / v));
  }
  p = o.y - cy;
  v = d.y;
  h = hy + r;
  if (Math.abs(v) < EPS) {
    if (p < -h || p > h) return -1;
  } else {
    tin = Math.max(tin, Math.min((-h - p) / v, (h - p) / v));
    tout = Math.min(tout, Math.max((-h - p) / v, (h - p) / v));
  }
  p = ox * s + oz * c;
  v = d.x * s + d.z * c;
  h = hz + r;
  if (Math.abs(v) < EPS) {
    if (p < -h || p > h) return -1;
  } else {
    tin = Math.max(tin, Math.min((-h - p) / v, (h - p) / v));
    tout = Math.min(tout, Math.max((-h - p) / v, (h - p) / v));
  }
  return tin <= tout ? tin : -1;
}

/** A horizontal disc at height y. */
function rayCap(o: Vec3, d: Vec3, cx: number, cz: number, y: number, r: number): number {
  const t = (y - o.y) / d.y;
  if (t < 0) return -1;
  const x = o.x + t * d.x - cx;
  const z = o.z + t * d.z - cz;
  return x * x + z * z <= r * r ? t : -1;
}

/** GDD §5.5: 1 up to start, linear to floor at end, floor beyond. */
export function falloff(dist: number, start: number, end: number, floor: number): number {
  if (dist <= start) return 1;
  if (dist >= end) return floor;
  return 1 - ((dist - start) / (end - start)) * (1 - floor);
}

/**
 * Writes into `out` a direction sampled uniformly (by solid angle) inside a cone of half-angle `halfAngle` (radians)
 * around the unit vector `dir`. Draws exactly two numbers from `rng`.
 */
export function spreadDir(dir: Vec3, halfAngle: number, rng: Rng, out: Vec3): Vec3 {
  const cosT = 1 - rng.next() * (1 - dmath.cos(halfAngle));
  const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
  const phi = rng.next() * Math.PI * 2;
  // Orthonormal basis around dir: u ⟂ dir picked away from the nearer axis, v = dir × u.
  let ux: number;
  let uy: number;
  let uz: number;
  if (Math.abs(dir.y) < AXIS_SWITCH) {
    // u = normalize(up × dir)
    ux = dir.z;
    uy = 0;
    uz = -dir.x;
  } else {
    // u = normalize(x × dir)
    ux = 0;
    uy = -dir.z;
    uz = dir.y;
  }
  const ul = dmath.hypot(ux, uy, uz);
  ux /= ul;
  uy /= ul;
  uz /= ul;
  const vx = dir.y * uz - dir.z * uy;
  const vy = dir.z * ux - dir.x * uz;
  const vz = dir.x * uy - dir.y * ux;
  const a = sinT * dmath.cos(phi);
  const b = sinT * dmath.sin(phi);
  out.x = dir.x * cosT + ux * a + vx * b;
  out.y = dir.y * cosT + uy * a + vy * b;
  out.z = dir.z * cosT + uz * a + vz * b;
  return out;
}
