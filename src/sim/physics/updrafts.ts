/**
 * Updraft cables as arc-length polylines, and the latch reach (GDD §3.7, D-EP-039): a hero can latch anywhere along a
 * cable when its feet are within UPDRAFT.reach horizontally of the cable's line on the ground with the cable
 * UPDRAFT.reachAboveMin–reachAboveMax above them, or within UPDRAFT.airReach of the cable itself.
 */
import type { MapData, PhysicsService, Vec3 } from '../core/contracts';
import { clamp } from '../core/math';
import { UPDRAFT } from '../data/movement';
import * as dmath from '../core/dmath';

/** An Updraft polyline with cumulative lengths. */
export interface Line {
  readonly points: readonly Vec3[];
  readonly cum: readonly number[];
  readonly length: number;
}

/** A cable point in reach: which Updraft, where, its arc length `t`, and the 3D distance `d` from the feet. */
export interface Reach {
  updraft: number;
  readonly point: Vec3;
  t: number;
  d: number;
}

export function makeLine(points: readonly Vec3[]): Line {
  const cum = [0];
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b) length += dmath.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    cum.push(length);
  }
  return { points, cum, length };
}

/** Point at arc length `s` (clamped) into `out`, unit tangent into `tan`. */
export function pointOnLine(line: Line, s: number, out: Vec3, tan: Vec3): void {
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

/** Arc length of the cable point nearest `p` (3D). */
export function arcLengthAt(line: Line, p: Vec3): number {
  let best = 0;
  let bestD2 = Number.POSITIVE_INFINITY;
  for (let i = 1; i < line.points.length; i++) {
    const a = line.points[i - 1] as Vec3;
    const b = line.points[i] as Vec3;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const ez = b.z - a.z;
    const len2 = ex * ex + ey * ey + ez * ez;
    const f = len2 > 0 ? clamp(((p.x - a.x) * ex + (p.y - a.y) * ey + (p.z - a.z) * ez) / len2, 0, 1) : 0;
    const dx = a.x + ex * f - p.x;
    const dy = a.y + ey * f - p.y;
    const dz = a.z + ez * f - p.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = (line.cum[i - 1] ?? 0) + f * ((line.cum[i] ?? 0) - (line.cum[i - 1] ?? 0));
    }
  }
  return best;
}

export interface Updrafts {
  readonly lines: readonly Line[];
  /** Fills `out` with the nearest cable point in latch reach of feet at `pos`; false when none is. */
  reach(pos: Vec3, out: Reach): boolean;
  /** PhysicsService.updraftInReach. */
  readonly service: NonNullable<PhysicsService['updraftInReach']>;
}

export function createUpdrafts(map: MapData): Updrafts {
  const lines = map.updrafts.map((u) => makeLine(u.points));
  const reachSq = UPDRAFT.reach * UPDRAFT.reach;
  const airSq = UPDRAFT.airReach * UPDRAFT.airReach;

  /** Nearest in-reach point on segment a→b (arc length `start` at a) of line `i`, if better than `out` so far. */
  const segment = (i: number, a: Vec3, b: Vec3, start: number, p: Vec3, out: Reach): boolean => {
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const ez = b.z - a.z;
    const len = dmath.hypot(ex, ey, ez);
    let found = false;
    // The column: the point above the feet's nearest spot on the cable's ground line.
    const lenH2 = ex * ex + ez * ez;
    const th = lenH2 > 0 ? clamp(((p.x - a.x) * ex + (p.z - a.z) * ez) / lenH2, 0, 1) : 0;
    const hx = a.x + ex * th - p.x;
    const hz = a.z + ez * th - p.z;
    const above = a.y + ey * th - p.y;
    if (hx * hx + hz * hz <= reachSq && above >= UPDRAFT.reachAboveMin && above <= UPDRAFT.reachAboveMax) {
      const d = dmath.hypot(hx, above, hz);
      if (d < out.d) {
        set(out, i, a, ex, ey, ez, th, start + len * th, d);
        found = true;
      }
    }
    // Close to the cable itself (an airborne hero beside or above it).
    const len2 = ex * ex + ey * ey + ez * ez;
    const t = len2 > 0 ? clamp(((p.x - a.x) * ex + (p.y - a.y) * ey + (p.z - a.z) * ez) / len2, 0, 1) : 0;
    const dx = a.x + ex * t - p.x;
    const dy = a.y + ey * t - p.y;
    const dz = a.z + ez * t - p.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 <= airSq && d2 < out.d * out.d) {
      set(out, i, a, ex, ey, ez, t, start + len * t, Math.sqrt(d2));
      found = true;
    }
    return found;
  };

  const reach = (pos: Vec3, out: Reach): boolean => {
    out.d = Number.POSITIVE_INFINITY;
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i] as Line;
      for (let k = 1; k < l.points.length; k++) {
        const a = l.points[k - 1];
        const b = l.points[k];
        if (a && b && segment(i, a, b, l.cum[k - 1] ?? 0, pos, out)) found = true;
      }
    }
    return found;
  };

  const scratch: Reach = { updraft: -1, point: { x: 0, y: 0, z: 0 }, t: 0, d: 0 };
  return {
    lines,
    reach,
    service: (pos) => (reach(pos, scratch) ? { updraft: scratch.updraft, point: { ...scratch.point }, t: scratch.t } : null),
  };
}

function set(out: Reach, i: number, a: Vec3, ex: number, ey: number, ez: number, f: number, t: number, d: number): void {
  out.updraft = i;
  const p = out.point;
  p.x = a.x + ex * f;
  p.y = a.y + ey * f;
  p.z = a.z + ez * f;
  out.t = t;
  out.d = d;
}
