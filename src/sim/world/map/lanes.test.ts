// The lanes rework (D-EP-053): every lane has bridges, rises and falls, and is walled off from the others.
import { describe, expect, it } from 'vitest';
import type { Lane, Vec3 } from '../../core/contracts';
import { pathLength, pointOnPath } from './build';
import { columnClear, indexPrims, standAt, surfacesAt } from './geometry';
import { loadMap } from './index';

const map = loadMap('main');
const index = indexPrims(map.prims);
/** Sight blockers: every solid prim but the shot-window fillers (ivy curtains block sight). */
const sight = indexPrims(map.prims.filter((p) => p.solid && p.blocks !== 'movement').map((p) => ({ ...p, blocks: undefined })));
const { nodes } = map.nav;

/** A bridge deck stands at least this far above the lane it crosses. */
const BRIDGE_CLEAR = 4;
const EYE = 1.6;

/** The point at arc length s, `off` metres to the side (positive = right of the direction of travel). */
function across(lane: Lane, s: number, off: number): Vec3 {
  const len = pathLength(lane.path);
  const p = pointOnPath(lane.path, s);
  const q = pointOnPath(lane.path, Math.min(len, s + 0.1));
  const r = s + 0.1 > len ? pointOnPath(lane.path, s - 0.1) : p;
  const [a, b] = s + 0.1 > len ? [r, p] : [p, q];
  const d = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { x: p.x + ((b.z - a.z) / d) * off, y: p.y, z: p.z - ((b.x - a.x) / d) * off };
}

/** Arc-length runs where a walkable deck spans the whole lane, one metre past each edge, with the lane clear under it. */
function crossings(lane: Lane): [number, number][] {
  const len = pathLength(lane.path);
  const runs: [number, number][] = [];
  let start = -1;
  for (let s = 0; s <= len; s += 0.5) {
    const y = pointOnPath(lane.path, s).y;
    let ok = standAt(index, across(lane, s, 0).x, across(lane, s, 0).z, y + 0.5) !== null;
    for (let off = -(lane.halfWidth + 1); ok && off <= lane.halfWidth + 1; off += 0.5) {
      const p = across(lane, s, off);
      ok = surfacesAt(index, p.x, p.z).some((h) => h >= y + BRIDGE_CLEAR);
    }
    if (ok && start < 0) start = s;
    if (!ok && start >= 0) {
      runs.push([start, s]);
      start = -1;
    }
  }
  if (start >= 0) runs.push([start, len]);
  return runs;
}

describe('bridges (D-EP-053)', () => {
  for (const lane of map.lanes) {
    it(`${lane.id}: at least two bridges cross the lane, walkable on top and in the nav graph, the lane open beneath`, () => {
      const found = crossings(lane);
      expect(found.length, `${lane.id} crossings ${JSON.stringify(found)}`).toBeGreaterThanOrEqual(2);
      for (const [s0, s1] of found) {
        const mid = (s0 + s1) / 2;
        const y = pointOnPath(lane.path, mid).y;
        // A node on the deck over the lane, so bots can reach it and cross.
        const on = nodes.some((n) => n.y >= y + BRIDGE_CLEAR && [-lane.halfWidth, 0, lane.halfWidth].some((off) => {
          const p = across(lane, mid, off);
          return Math.hypot(n.x - p.x, n.z - p.z) < 3;
        }));
        expect(on, `${lane.id} bridge at ${mid}`).toBe(true);
        // The lane runs underneath: a hero (1.8 m) and a jump (1.6 m) fit under the deck.
        const c = across(lane, mid, 0);
        expect(columnClear(index, c.x, c.z, y + 0.05, y + 3.4), `${lane.id} under the bridge at ${mid}`).toBe(true);
      }
    });
  }

  it('every bridge deck has a stair or ramp up to it on both sides of the lane', () => {
    for (const lane of map.lanes) {
      for (const [s0, s1] of crossings(lane)) {
        const mid = (s0 + s1) / 2;
        const y = pointOnPath(lane.path, mid).y;
        for (const side of [-1, 1]) {
          // Beyond the lane's edge on this side, nodes at the deck's level link down to the ground by walking: the deck
          // is in the strongly connected graph, so it is enough that the deck reaches past the edge on this side.
          const p = across(lane, mid, side * (lane.halfWidth + 1));
          expect(surfacesAt(index, p.x, p.z).some((h) => h >= y + BRIDGE_CLEAR), `${lane.id} ${mid} side ${side}`).toBe(true);
        }
      }
    }
  });
});

describe('lanes rise and fall (D-EP-053)', () => {
  for (const lane of map.lanes) {
    it(`${lane.id}: the lane's surface varies by at least 2 m along it (and at most 6 m)`, () => {
      const len = pathLength(lane.path);
      const heights: number[] = [];
      for (let s = 0; s <= len; s += 1) {
        const p = pointOnPath(lane.path, s);
        heights.push(standAt(index, p.x, p.z, p.y + 0.5) ?? Number.NaN);
      }
      const span = Math.max(...heights) - Math.min(...heights);
      expect(span).toBeGreaterThanOrEqual(2);
      expect(span).toBeLessThanOrEqual(6);
    });
  }
});

describe('lanes are isolated (D-EP-053)', () => {
  /** Eye points along a lane: every 2 m, across five lines of its width, 1.6 m above its surface. */
  function eyes(lane: Lane): Vec3[] {
    const out: Vec3[] = [];
    for (let s = 0; s <= pathLength(lane.path); s += 2) {
      for (const k of [-(lane.halfWidth - 0.5), -lane.halfWidth / 2, 0, lane.halfWidth / 2, lane.halfWidth - 0.5]) {
        const p = across(lane, s, k);
        out.push({ ...p, y: (standAt(index, p.x, p.z, p.y + 0.5) ?? p.y) + EYE });
      }
    }
    return out;
  }

  function seen(a: Vec3, b: Vec3): boolean {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / 0.5);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const y = a.y + (b.y - a.y) * t;
      if (!columnClear(sight, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, y, y + 0.01)) return false;
    }
    return true;
  }

  it('no lane sees or shoots into another, except through the designated crossings', () => {
    // Designated crossings: the centre (Perch Road, the Hollow and the rune bridges, all on z = 0), so a line from one
    // half to the other passes it; and the gate aprons outside the bases, where the three lanes leave the same wall.
    const outside = (p: Vec3) => Math.abs(p.z) > 6 && Math.abs(p.z) < 108;
    const lanes = map.lanes.map((l) => ({ id: l.id, pts: eyes(l).filter(outside) }));
    const leaks: string[] = [];
    for (let i = 0; i < lanes.length; i++) {
      for (let j = i + 1; j < lanes.length; j++) {
        for (const a of lanes[i]?.pts ?? []) {
          for (const b of lanes[j]?.pts ?? []) {
            if (Math.sign(a.z) !== Math.sign(b.z)) continue;
            if (seen(a, b)) leaks.push(`${lanes[i]?.id} (${a.x.toFixed(1)}, ${a.z.toFixed(1)}) sees ${lanes[j]?.id} (${b.x.toFixed(1)}, ${b.z.toFixed(1)})`);
          }
        }
      }
    }
    expect(leaks.slice(0, 10)).toEqual([]);
  });
});
