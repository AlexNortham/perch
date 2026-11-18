/**
 * Lane geometry for the rules suites: progress along a lane polyline (from a flock's own gate), distance from the
 * path, and points on it. Lanes are authored Dawn gate → Dusk gate; Dusk walks them in reverse (MapData.lanes).
 */
import type { Lane, LaneId, MapData, PlayerTeam, Vec3 } from '../../src/sim/core/contracts';

export function laneOf(map: MapData, id: LaneId): Lane {
  const lane = map.lanes.find((l) => l.id === id);
  if (!lane) throw new Error(`map '${map.id}' has no lane '${id}'`);
  return lane;
}

interface Projection {
  /** Arc length from the Dawn end to the nearest point on the path (XZ). */
  readonly arc: number;
  /** Horizontal distance from the path. */
  readonly off: number;
  /** Unit horizontal direction of the path there, Dawn → Dusk. */
  readonly dir: Vec3;
  readonly point: Vec3;
}

function segments(lane: Lane): { a: Vec3; b: Vec3; start: number; len: number }[] {
  const out: { a: Vec3; b: Vec3; start: number; len: number }[] = [];
  let start = 0;
  for (let i = 1; i < lane.path.length; i++) {
    const a = lane.path[i - 1] as Vec3;
    const b = lane.path[i] as Vec3;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    out.push({ a, b, start, len });
    start += len;
  }
  return out;
}

export function laneLength(lane: Lane): number {
  return segments(lane).reduce((sum, s) => sum + s.len, 0);
}

export function project(lane: Lane, p: Vec3): Projection {
  let best: Projection | null = null;
  for (const s of segments(lane)) {
    if (s.len === 0) continue;
    const dir = { x: (s.b.x - s.a.x) / s.len, y: 0, z: (s.b.z - s.a.z) / s.len };
    const t = Math.min(s.len, Math.max(0, (p.x - s.a.x) * dir.x + (p.z - s.a.z) * dir.z));
    const point = { x: s.a.x + dir.x * t, y: s.a.y + ((s.b.y - s.a.y) * t) / s.len, z: s.a.z + dir.z * t };
    const off = Math.hypot(p.x - point.x, p.z - point.z);
    if (!best || off < best.off) best = { arc: s.start + t, off, dir, point };
  }
  if (!best) throw new Error(`lane '${lane.id}' has no length`);
  return best;
}

/** Metres walked from the flock's own gate. */
export function progress(lane: Lane, team: PlayerTeam, p: Vec3): number {
  const arc = project(lane, p).arc;
  return team === 'dawn' ? arc : laneLength(lane) - arc;
}

/** The point `s` metres from the Dawn gate, and the Dawn → Dusk direction there. */
export function pointAt(lane: Lane, s: number): { point: Vec3; dir: Vec3 } {
  const segs = segments(lane).filter((g) => g.len > 0);
  const seg = segs.find((g) => s <= g.start + g.len) ?? segs.at(-1);
  if (!seg) throw new Error(`lane '${lane.id}' has no length`);
  const t = Math.min(seg.len, Math.max(0, s - seg.start));
  const dir = { x: (seg.b.x - seg.a.x) / seg.len, y: 0, z: (seg.b.z - seg.a.z) / seg.len };
  return {
    point: { x: seg.a.x + dir.x * t, y: seg.a.y + ((seg.b.y - seg.a.y) * t) / seg.len, z: seg.a.z + dir.z * t },
    dir,
  };
}

/** p + along × dir + across × (dir turned 90° to the right of a Dawn walker). */
export function offset(p: Vec3, dir: Vec3, along: number, across = 0): Vec3 {
  return { x: p.x + dir.x * along - dir.z * across, y: p.y, z: p.z + dir.z * along + dir.x * across };
}
