/**
 * Point queries against blockout prims: footprints, top surfaces, standing spots and clearance. Used to build the nav
 * graph and ledges, and by the map tests. Pure; build a PrimIndex once per map (it precomputes each prim's frame so
 * the hot queries don't allocate or call trig).
 */
import type { BlockoutPrim, Vec3 } from '../../core/contracts';
import { REACH } from './data/traversal';
import * as dmath from '../../core/dmath';

/** Grid cell edge for the prim index (m). */
const CELL = 8;
/** Prims are filed in every cell within this of their footprint, so queries with a radius up to it are exact. */
export const MAX_QUERY_RADIUS = 1;
/** Thin skin so surfaces a hero stands on don't count as overlapping the hero. */
const SKIN = 0.05;

/** Does the prim stop heroes? Solid prims do, except sight-only ones (ivy curtains, GDD §6.8). */
export const blocksMovement = (p: BlockoutPrim): boolean => p.solid && p.blocks !== 'sight';

export function primBottom(p: BlockoutPrim): number {
  return p.centre.y - (p.shape === 'cylinder' ? p.height : p.size.y) / 2;
}

export function primTop(p: BlockoutPrim): number {
  return p.centre.y + (p.shape === 'cylinder' ? p.height : p.size.y) / 2;
}

/** A solid prim with its frame precomputed. Local +z is forward (sin yaw, cos yaw); local +x is (cos yaw, −sin yaw). */
interface Solid {
  readonly cx: number;
  readonly cz: number;
  readonly cos: number;
  readonly sin: number;
  /** Half extents (boxes, ramps) or radius in hx (cylinders). */
  readonly hx: number;
  readonly hz: number;
  readonly cylinder: boolean;
  readonly bottom: number;
  readonly top: number;
  /** Ramps: rise per metre along local +z; 0 otherwise. */
  readonly slope: number;
}

function solidOf(p: BlockoutPrim): Solid {
  const yaw = p.shape === 'cylinder' ? 0 : p.yaw;
  const cylinder = p.shape === 'cylinder';
  return {
    cx: p.centre.x,
    cz: p.centre.z,
    cos: dmath.cos(yaw),
    sin: dmath.sin(yaw),
    hx: cylinder ? p.radius : p.size.x / 2,
    hz: cylinder ? p.radius : p.size.z / 2,
    cylinder,
    bottom: primBottom(p),
    top: primTop(p),
    slope: p.shape === 'ramp' ? p.size.y / p.size.z : 0,
  };
}

/** Local z of (x, z), or NaN when outside the footprint grown by `margin`. */
function localZ(s: Solid, x: number, z: number, margin: number): number {
  const dx = x - s.cx;
  const dz = z - s.cz;
  if (s.cylinder) return dx * dx + dz * dz <= (s.hx + margin) * (s.hx + margin) ? 0 : NaN;
  const lx = dx * s.cos - dz * s.sin;
  const lz = dx * s.sin + dz * s.cos;
  return Math.abs(lx) <= s.hx + margin && Math.abs(lz) <= s.hz + margin ? lz : NaN;
}

/** Upper surface over local z (ramps rise from bottom at −hz to top at +hz). */
function surface(s: Solid, lz: number): number {
  if (s.slope === 0) return s.top;
  return s.bottom + s.slope * (Math.min(s.hz, Math.max(-s.hz, lz)) + s.hz);
}

/** Is (x, z) over the prim's footprint, grown by `margin`? */
export function inFootprint(p: BlockoutPrim, x: number, z: number, margin = 0): boolean {
  return !Number.isNaN(localZ(solidOf(p), x, z, margin));
}

/** Height of the prim's upper surface over (x, z) (clamped to the footprint for ramps). */
export function topAt(p: BlockoutPrim, x: number, z: number): number {
  const s = solidOf(p);
  const dx = x - s.cx;
  const dz = z - s.cz;
  return surface(s, dx * s.sin + dz * s.cos);
}

/** Axis-aligned XZ bounds of the prim's footprint. */
export function footprintBounds(p: BlockoutPrim): { minX: number; maxX: number; minZ: number; maxZ: number } {
  if (p.shape === 'cylinder') {
    return { minX: p.centre.x - p.radius, maxX: p.centre.x + p.radius, minZ: p.centre.z - p.radius, maxZ: p.centre.z + p.radius };
  }
  const c = Math.abs(dmath.cos(p.yaw));
  const s = Math.abs(dmath.sin(p.yaw));
  const hx = (p.size.x * c + p.size.z * s) / 2;
  const hz = (p.size.x * s + p.size.z * c) / 2;
  return { minX: p.centre.x - hx, maxX: p.centre.x + hx, minZ: p.centre.z - hz, maxZ: p.centre.z + hz };
}

/** The four footprint corners of a box or ramp, in order around it, grown by `grow`. */
export function corners(p: Exclude<BlockoutPrim, { shape: 'cylinder' }>, grow = 0): Vec3[] {
  const c = dmath.cos(p.yaw);
  const s = dmath.sin(p.yaw);
  const hx = p.size.x / 2 + grow;
  const hz = p.size.z / 2 + grow;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i = 0, k = 0]) => ({
    x: p.centre.x + i * hx * c + k * hz * s,
    y: p.centre.y,
    z: p.centre.z - i * hx * s + k * hz * c,
  }));
}

/** Uniform XZ grid over the prims that block movement. */
export interface PrimIndex {
  readonly near: (x: number, z: number) => readonly Solid[];
}

const EMPTY: readonly Solid[] = [];

export function indexPrims(prims: readonly BlockoutPrim[]): PrimIndex {
  const solid = prims.filter(blocksMovement);
  const pad = MAX_QUERY_RADIUS;
  const all = solid.map(footprintBounds).map((b) =>
    ({ minX: b.minX - pad, maxX: b.maxX + pad, minZ: b.minZ - pad, maxZ: b.maxZ + pad }));
  const minX = Math.min(...all.map((b) => b.minX));
  const minZ = Math.min(...all.map((b) => b.minZ));
  const cols = Math.ceil((Math.max(...all.map((b) => b.maxX)) - minX) / CELL) + 1;
  const rows = Math.ceil((Math.max(...all.map((b) => b.maxZ)) - minZ) / CELL) + 1;
  const cells: Solid[][] = Array.from({ length: cols * rows }, () => []);
  solid.forEach((p, i) => {
    const b = all[i];
    if (!b) return;
    const s = solidOf(p);
    for (let cx = Math.floor((b.minX - minX) / CELL); cx <= Math.floor((b.maxX - minX) / CELL); cx++) {
      for (let cz = Math.floor((b.minZ - minZ) / CELL); cz <= Math.floor((b.maxZ - minZ) / CELL); cz++) {
        cells[cz * cols + cx]?.push(s);
      }
    }
  });
  return {
    near(x, z) {
      const cx = Math.floor((x - minX) / CELL);
      const cz = Math.floor((z - minZ) / CELL);
      if (cx < 0 || cz < 0 || cx >= cols || cz >= rows) return EMPTY;
      return cells[cz * cols + cx] ?? EMPTY;
    },
  };
}

/** True when no solid prim occupies the vertical column y0..y1 at (x, z), grown by `radius` (≤ MAX_QUERY_RADIUS). */
export function columnClear(index: PrimIndex, x: number, z: number, y0: number, y1: number, radius = 0): boolean {
  for (const s of index.near(x, z)) {
    const lz = localZ(s, x, z, radius);
    if (Number.isNaN(lz)) continue;
    // Ramps: within the grown footprint the surface can be higher by the slope over `radius`.
    const top = surface(s, lz) + radius * s.slope;
    if (s.bottom < y1 && top > y0) return false;
  }
  return true;
}

/**
 * The highest surface at (x, z) no higher than `maxY` where a hero fits standing, or null when there is none. The
 * capsule (radius `radius`) must be clear of every solid prim above step height: lower things, such as the slope
 * of the ramp underfoot, are stepped over.
 */
export function standAt(index: PrimIndex, x: number, z: number, maxY: number, radius = 0): number | null {
  let best: number | null = null;
  for (const s of index.near(x, z)) {
    const lz = localZ(s, x, z, 0);
    if (Number.isNaN(lz)) continue;
    const top = surface(s, lz);
    if (top > maxY || (best !== null && top <= best)) continue;
    const from = top + (radius > 0 ? REACH.step : SKIN);
    if (columnClear(index, x, z, from, top + REACH.heroHeight, radius)) best = top;
  }
  return best;
}

/** Every surface at (x, z) a hero can stand on, highest first. */
export function surfacesAt(index: PrimIndex, x: number, z: number): number[] {
  const out: number[] = [];
  for (const s of index.near(x, z)) {
    const lz = localZ(s, x, z, 0);
    if (Number.isNaN(lz)) continue;
    const top = surface(s, lz);
    if (!out.includes(top) && columnClear(index, x, z, top + SKIN, top + REACH.heroHeight)) out.push(top);
  }
  return out.sort((a, b) => b - a);
}

/** Is the point inside any solid prim (beyond the skin)? */
export function insideSolid(index: PrimIndex, p: Vec3): boolean {
  return !columnClear(index, p.x, p.z, p.y + SKIN, p.y + SKIN * 2);
}
