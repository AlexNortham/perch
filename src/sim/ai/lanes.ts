/**
 * Lane geometry for bots: arc length along a lane's polyline (Dawn gate = 0), the point and direction at an arc
 * length, and "forward" for a flock (Dawn walks +s, Dusk −s).
 */
import type { Lane, LaneId, PlayerTeam, Vec3 } from '../core/contracts';
import * as dmath from '../core/dmath';

export interface LaneGeom {
  readonly id: LaneId;
  readonly halfWidth: number;
  readonly length: number;
  /** Arc length and distance from the lane line of the nearest lane point to p (XZ). */
  project(p: Vec3): { s: number; off: number };
  /** The lane point at arc length s (clamped), shifted `side` metres to the right of Dawn's walking direction. */
  at(s: number, side?: number): Vec3;
  /** Unit XZ direction of Dawn's walk at arc length s. */
  dir(s: number): { x: number; z: number };
  /** Progress toward the enemy gate for `team`: s for Dawn, length − s for Dusk. */
  forward(team: PlayerTeam, s: number): number;
  /** Inverse of forward. */
  fromForward(team: PlayerTeam, f: number): number;
}

export function laneGeom(lane: Lane): LaneGeom {
  const pts = lane.path;
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + dmath.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.z - pts[i - 1]!.z));
  const length = cum[cum.length - 1] ?? 0;
  const segAt = (s: number): number => {
    let i = 1;
    while (i < pts.length - 1 && cum[i]! < s) i++;
    return i;
  };
  const dir = (s: number): { x: number; z: number } => {
    if (pts.length < 2) return { x: 0, z: 1 };
    const i = segAt(s);
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const len = dmath.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
  };
  return {
    id: lane.id,
    halfWidth: lane.halfWidth,
    length,
    project(p) {
      let best = Infinity;
      let bestS = 0;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const l2 = dx * dx + dz * dz;
        const t = l2 > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0;
        const d = dmath.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
        if (d < best) {
          best = d;
          bestS = cum[i - 1]! + t * (cum[i]! - cum[i - 1]!);
        }
      }
      return { s: bestS, off: best };
    },
    at(s, side = 0) {
      const c = Math.min(length, Math.max(0, s));
      const i = segAt(c);
      const a = pts[i - 1] ?? pts[0]!;
      const b = pts[i] ?? a;
      const segLen = cum[i]! - cum[i - 1]!;
      const t = segLen > 0 ? (c - cum[i - 1]!) / segLen : 0;
      const d = dir(c);
      // Right of the walking direction: (−dz, dx) rotated per base.ts (right = (−cos yaw, 0, sin yaw)).
      return { x: a.x + (b.x - a.x) * t - d.z * side, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t + d.x * side };
    },
    dir,
    forward: (team, s) => (team === 'dawn' ? s : length - s),
    fromForward: (team, f) => (team === 'dawn' ? f : length - f),
  };
}
