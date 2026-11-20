/**
 * The GDD §6.8 building kit: one shell builder that every enterable building uses, so heroes, the camera and bots
 * meet the same sizes everywhere. A shell is walls with door and window gaps, floor slabs with stair and hatch
 * holes, stairs (ramps), ladders, balconies and a roof; it returns a SpecPart holding the geometry (as `fabric`) and
 * what it means (the Building, one Room per storey, the Openings, ladder climbs and nav waypoints).
 *
 * Kit sizes (GDD §6.8): storey 4.0 m floor to floor with a 0.4 m slab; walls 0.5 m; doors 2.4 × 3.0; loading doors
 * 4.0 × 3.6; arches 3.0 × 3.6; shot windows 1.6 × 1.0 at a 1.2 m sill (with a movement-only filler); leap windows
 * 2.0 × 2.4 at a 0.9 m sill; stairs 2 m wide rising 4 m over 8 m; balconies 2 m deep with a 1 m rail; flat roofs with
 * a 0.8 m parapet and a 2 × 2 m hatch; ladders through 2 × 2 m hatches.
 */
import type { BlockoutPrim, BoxPrim, BoxVolume, MaterialTag, Opening, Room, Vec3 } from '../../../core/contracts';
import type { FacadeMark, FacadeStyle, StairDress } from '../dressing';
import type { ClimbSpec, LinkSpec, Side, SpecPart } from './kit';
import { block, part, ramp, v } from './kit';
import * as dmath from '../../../core/dmath';

export const WALL = 0.5;
export const SLAB = 0.4;
export const RAIL = 1.0;
export const PARAPET = 0.8;
/** Hatches and ladder holes are this square. */
export const HATCH = 2;
/** Landing boards (style guide §1.1): 0.8 m deep, 0.3 m thick, a little wider than the opening, top at its sill.
 * Openings this far above the ground floor count as upper ones. */
const LANDING = { depth: 0.8, thick: 0.3, wider: 0.4, minSill: 2 } as const;
/** Nav waypoints sit this far in front of an opening on each side, measured from the wall face. */
const DOOR_STEP = 1.2;
/** Rooms get a waypoint grid at about this spacing (one at the centre for small rooms). */
const ROOM_GRID = 7;
const ROOM_INSET = 1.5;
/** Slivers thinner than this are not emitted. */
const MIN_RUN = 0.05;
const SNAP_EPS = 0.01;

export interface Rect {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
}

export const rect = (x0: number, x1: number, z0: number, z1: number): Rect => ({ x0, x1, z0, z1 });

/**
 * `r` minus the `holes`, as few axis-aligned rectangles as a grid sweep gives: cells between every hole edge, merged
 * along x into strips, then strips with the same x span merged along z.
 */
export function carve(r: Rect, holes: readonly Rect[]): Rect[] {
  const clip = holes
    .map((h) => rect(Math.max(r.x0, h.x0), Math.min(r.x1, h.x1), Math.max(r.z0, h.z0), Math.min(r.z1, h.z1)))
    .filter((h) => h.x1 > h.x0 && h.z1 > h.z0);
  const xs = [...new Set([r.x0, r.x1, ...clip.flatMap((h) => [h.x0, h.x1])])].sort((a, b) => a - b);
  const zs = [...new Set([r.z0, r.z1, ...clip.flatMap((h) => [h.z0, h.z1])])].sort((a, b) => a - b);
  const open = (x0: number, x1: number, z0: number, z1: number) =>
    !clip.some((h) => h.x0 < x1 && h.x1 > x0 && h.z0 < z1 && h.z1 > z0);
  const out: Rect[] = [];
  let prev: Rect[] = [];
  for (let k = 0; k + 1 < zs.length; k++) {
    const z0 = zs[k] ?? 0;
    const z1 = zs[k + 1] ?? 0;
    const row: Rect[] = [];
    for (let i = 0; i + 1 < xs.length; i++) {
      const x0 = xs[i] ?? 0;
      const x1 = xs[i + 1] ?? 0;
      if (!open(x0, x1, z0, z1)) continue;
      const last = row[row.length - 1];
      if (last && last.x1 === x0) row[row.length - 1] = { ...last, x1 };
      else row.push(rect(x0, x1, z0, z1));
    }
    const next: Rect[] = [];
    for (const s of row) {
      const above = prev.find((p) => p.x0 === s.x0 && p.x1 === s.x1 && p.z1 === s.z0);
      if (above) {
        out.splice(out.indexOf(above), 1);
        const merged = { ...above, z1: s.z1 };
        out.push(merged);
        next.push(merged);
      } else {
        out.push(s);
        next.push(s);
      }
    }
    prev = next;
  }
  return out;
}

export const slabOf = (r: Rect, y0: number, y1: number, material: MaterialTag): BoxPrim => block(r.x0, r.x1, r.z0, r.z1, y0, y1, material);

// ---------------------------------------------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------------------------------------------

export type GapKind = 'door' | 'loading' | 'arch' | 'window' | 'leap' | 'balcony' | 'slit';

const GAP: Record<GapKind, { readonly w: number; readonly h: number; readonly sill: number; readonly kind: Opening['kind'] }> = {
  door: { w: 2.4, h: 3.0, sill: 0, kind: 'door' },
  loading: { w: 4.0, h: 3.6, sill: 0, kind: 'door' },
  arch: { w: 3.0, h: 3.6, sill: 0, kind: 'arch' },
  window: { w: 1.6, h: 1.0, sill: 1.2, kind: 'window' },
  leap: { w: 2.0, h: 2.4, sill: 0.9, kind: 'leap' },
  balcony: { w: 2.4, h: 3.0, sill: 0, kind: 'balcony' },
  // A Hide's slit band: sight passes, nothing else fits.
  slit: { w: 4, h: 0.4, sill: 1.4, kind: 'window' },
};

/** A hole in an outside wall. `at` is the gap's centre along the face (x on n/s faces, z on e/w faces). */
export interface Gap {
  readonly face: Side;
  readonly storey: number;
  readonly at: number;
  readonly kind: GapKind;
  readonly w?: number;
  readonly h?: number;
  readonly sill?: number;
  /** An ivy curtain hangs in it (GDD §6.8). */
  readonly curtain?: boolean;
  /** Upper doors and leap windows get a standable landing board unless a balcony serves them (default true). */
  readonly board?: boolean;
}

/** A straight stair (ramp) from storey `storey` up to the next one, rising toward `up`; the slab above gets a hole. */
export interface Stair {
  readonly r: Rect;
  readonly storey: number;
  readonly up: Side;
}

/** A ladder up from storey `storey` through a 2 × 2 m hatch to the next storey (or the roof). (x, z) is the middle of
 * the hatch edge the climber steps off onto; `in` points from the hatch onto that floor. */
export interface Ladder {
  readonly storey: number;
  readonly x: number;
  readonly z: number;
  readonly in: Side;
}

/** A balcony outside face `face` at storey `storey`'s floor, from `from` to `to` along the face. */
export interface Balcony {
  readonly face: Side;
  readonly storey: number;
  readonly from: number;
  readonly to: number;
  readonly depth?: number;
  /** Default true; false where a walkway arrives over the outer edge. */
  readonly rail?: boolean;
}

/** An extra hole in a slab (hay hatch, skylight, chimney opening, gallery void). `storey` is the slab's storey, or
 * 'roof'. Hatches and skylights get a drop link and an Opening; voids get neither. */
export interface Hole {
  readonly storey: number | 'roof';
  readonly r: Rect;
  readonly kind: 'hatch' | 'skylight' | 'void';
}

export interface ShellSpec {
  readonly id: string;
  readonly archetype: string;
  readonly zone: string;
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  /** Floor top of each storey, storey 0 first. */
  readonly floors: readonly number[];
  /** Flat roof: the walkable top of the roof slab. Gables: the eaves. */
  readonly top: number;
  /** 'flat' (walkable, parapet), 'gable' (30°, walkable), 'steep' (50°, not walkable). */
  readonly roof: 'flat' | 'gable' | 'steep';
  readonly parapet?: readonly Side[];
  readonly gaps: readonly Gap[];
  readonly stairs?: readonly Stair[];
  readonly ladders?: readonly Ladder[];
  readonly balconies?: readonly Balcony[];
  readonly holes?: readonly Hole[];
  /** A cellar under the ground floor (its geometry is carved from the ground): floor and ceiling heights, and its
   * rect if it is not the whole interior. */
  readonly cellar?: { readonly floor: number; readonly ceiling: number; readonly r?: Rect };
  readonly material: MaterialTag;
  readonly style: FacadeStyle;
  /** A woven nest crowns the roof (D-EP-048). */
  readonly nestCrown?: boolean;
  /** Visual doors and windows on wall stretches with no gameplay opening. */
  readonly marks?: readonly FacadeMark[];
}

const YAW: Record<Side, number> = { n: 0, s: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };
const OUT: Record<Side, { readonly x: number; readonly z: number }> = { n: { x: 0, z: 1 }, s: { x: 0, z: -1 }, e: { x: 1, z: 0 }, w: { x: -1, z: 0 } };
const PITCH_DEG: Record<'gable' | 'steep', number> = { gable: 30, steep: 50 };
const PITCH: Record<'gable' | 'steep', number> ={ gable: dmath.tan((30 * Math.PI) / 180), steep: dmath.tan((50 * Math.PI) / 180) };

/** The ladder's hatch: 2 × 2 m on the far side of its edge from `in`. */
export function ladderHole(l: Ladder): Rect {
  const h = HATCH / 2;
  switch (l.in) {
    case 'n': return rect(l.x - h, l.x + h, l.z - HATCH, l.z);
    case 's': return rect(l.x - h, l.x + h, l.z, l.z + HATCH);
    case 'e': return rect(l.x - HATCH, l.x, l.z - h, l.z + h);
    case 'w': return rect(l.x, l.x + HATCH, l.z - h, l.z + h);
  }
}

export const ladderClimb = (l: Ladder, floor: number, roof: number): ClimbSpec =>
  ({ kind: 'ladder', x: l.x, z: l.z, floor, roof, inX: OUT[l.in].x, inZ: OUT[l.in].z });

/** Nav points on a grid over the rect at height y (one at the centre if it is small). */
function grid(r: Rect, y: number): Vec3[] {
  const w = r.x1 - r.x0 - ROOM_INSET * 2;
  const d = r.z1 - r.z0 - ROOM_INSET * 2;
  const nx = Math.max(1, Math.round(w / ROOM_GRID) + 1);
  const nz = Math.max(1, Math.round(d / ROOM_GRID) + 1);
  const out: Vec3[] = [];
  for (let i = 0; i < nx; i++) {
    for (let k = 0; k < nz; k++) {
      const x = nx === 1 ? (r.x0 + r.x1) / 2 : r.x0 + ROOM_INSET + (w * i) / (nx - 1);
      const z = nz === 1 ? (r.z0 + r.z1) / 2 : r.z0 + ROOM_INSET + (d * k) / (nz - 1);
      out.push(v(x, y, z));
    }
  }
  return out;
}

/** The ramp's ends, one metre out: [bottom, top]. */
function rampEnds(r: Rect, up: Side, y0: number, y1: number): [Vec3, Vec3] {
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const o = OUT[up];
  const half = o.x !== 0 ? (r.x1 - r.x0) / 2 : (r.z1 - r.z0) / 2;
  return [v(cx - o.x * (half + 1), y0, cz - o.z * (half + 1)), v(cx + o.x * (half + 1), y1, cz + o.z * (half + 1))];
}

export function stairPrim(r: Rect, up: Side, y0: number, y1: number, material: MaterialTag): BlockoutPrim {
  return ramp(r.x0, r.x1, r.z0, r.z1, y0, y1, up, material);
}

/** A gable over the rect from the eaves at h, ridge along the longer side. */
export function gable(r: Rect, h: number, pitch: 'gable' | 'steep'): BlockoutPrim[] {
  const k = PITCH[pitch];
  if (r.x1 - r.x0 <= r.z1 - r.z0) {
    const xm = (r.x0 + r.x1) / 2;
    const rise = (xm - r.x0) * k;
    return [ramp(r.x0, xm, r.z0, r.z1, h, h + rise, 'e', 'roof'), ramp(xm, r.x1, r.z0, r.z1, h, h + rise, 'w', 'roof')];
  }
  const zm = (r.z0 + r.z1) / 2;
  const rise = (zm - r.z0) * k;
  return [ramp(r.x0, r.x1, r.z0, zm, h, h + rise, 'n', 'roof'), ramp(r.x0, r.x1, zm, r.z1, h, h + rise, 's', 'roof')];
}

export function ridgeHeight(r: Rect, h: number, pitch: 'gable' | 'steep'): number {
  return h + (Math.min(r.x1 - r.x0, r.z1 - r.z0) / 2) * PITCH[pitch];
}

interface Span { readonly a: number; readonly b: number; readonly y0: number; readonly y1: number }

/** Wall boxes along one face: columns split at every gap edge, solid runs between the gaps, equal columns merged. */
function face(s: ShellSpec, f: Side, gaps: readonly Span[], y0: number, y1: number): BoxPrim[] {
  const alongX = f === 'n' || f === 's';
  const a0 = alongX ? s.x0 : s.z0 + WALL;
  const a1 = alongX ? s.x1 : s.z1 - WALL;
  const cuts = [...new Set([a0, a1, ...gaps.flatMap((g) => [g.a, g.b])])].filter((c) => c >= a0 && c <= a1).sort((p, q) => p - q);
  const cols: { a: number; b: number; runs: [number, number][] }[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i] ?? 0;
    const b = cuts[i + 1] ?? 0;
    const holes = gaps.filter((g) => g.a < b && g.b > a).sort((p, q) => p.y0 - q.y0);
    const runs: [number, number][] = [];
    let y = y0;
    for (const g of holes) {
      if (g.y0 - y > MIN_RUN) runs.push([y, g.y0]);
      y = Math.max(y, g.y1);
    }
    if (y1 - y > MIN_RUN) runs.push([y, y1]);
    const last = cols[cols.length - 1];
    if (last && JSON.stringify(last.runs) === JSON.stringify(runs)) last.b = b;
    else cols.push({ a, b, runs });
  }
  const out: BoxPrim[] = [];
  for (const c of cols) {
    for (const [ya, yb] of c.runs) {
      if (f === 'n') out.push(block(c.a, c.b, s.z1 - WALL, s.z1, ya, yb, s.material));
      else if (f === 's') out.push(block(c.a, c.b, s.z0, s.z0 + WALL, ya, yb, s.material));
      else if (f === 'e') out.push(block(s.x1 - WALL, s.x1, c.a, c.b, ya, yb, s.material));
      else out.push(block(s.x0, s.x0 + WALL, c.a, c.b, ya, yb, s.material));
    }
  }
  return out;
}

/** The point on the face's centre plane at `at` along it. */
function facePoint(s: ShellSpec, f: Side, at: number, y: number): Vec3 {
  if (f === 'n') return v(at, y, s.z1 - WALL / 2);
  if (f === 's') return v(at, y, s.z0 + WALL / 2);
  if (f === 'e') return v(s.x1 - WALL / 2, y, at);
  return v(s.x0 + WALL / 2, y, at);
}

const step = (p: Vec3, f: Side, d: number, y = p.y): Vec3 => v(p.x + OUT[f].x * d, y, p.z + OUT[f].z * d);

/** Build one enterable building (GDD §6.8). Room i is storey i; the cellar, if any, is the last room. */
export function shell(s: ShellSpec): SpecPart {
  const n = s.floors.length;
  const flat = s.roof === 'flat';
  const wallTop = flat ? s.top - SLAB : s.top;
  const ceiling = (k: number) => (k + 1 < n ? (s.floors[k + 1] ?? 0) - SLAB : wallTop);
  const floor = (k: number) => s.floors[k] ?? 0;
  const inner = rect(s.x0 + WALL, s.x1 - WALL, s.z0 + WALL, s.z1 - WALL);
  const outer = rect(s.x0, s.x1, s.z0, s.z1);
  const fabric: BlockoutPrim[] = [];
  const openings: Opening[] = [];
  const nav: Vec3[] = [];
  const links: LinkSpec[] = [];
  const climbs: ClimbSpec[] = [];
  const stairs: StairDress[] = [];
  const balconies: BoxVolume[] = [];
  const landings: BoxVolume[] = [];

  // Walls with their gaps.
  const spans: Record<Side, Span[]> = { n: [], s: [], e: [], w: [] };
  for (const g of s.gaps) {
    const d = GAP[g.kind];
    const w = g.w ?? d.w;
    const y0 = floor(g.storey) + (g.sill ?? d.sill);
    const y1 = Math.min(y0 + (g.h ?? d.h), ceiling(g.storey));
    spans[g.face].push({ a: g.at - w / 2, b: g.at + w / 2, y0, y1 });
    const centre = facePoint(s, g.face, g.at, (y0 + y1) / 2);
    const passable = d.kind !== 'window';
    openings.push({
      kind: d.kind, rooms: [g.storey, -1], centre, width: w, height: y1 - y0, yaw: YAW[g.face], passable,
      ...(g.curtain ? { curtain: true } : {}),
    });
    const alongX = g.face === 'n' || g.face === 's';
    const gapBox = (material: MaterialTag, blocks: 'movement' | 'sight'): BoxPrim => ({
      shape: 'box', material, solid: true, blocks, yaw: 0, centre,
      size: alongX ? v(w, y1 - y0, WALL) : v(WALL, y1 - y0, w),
    });
    if (d.kind === 'window' && y1 - y0 > HERO_SQUEEZE) fabric.push(gapBox('metal', 'movement'));
    if (g.curtain) fabric.push(gapBox('foliage', 'sight'));
    const upper = g.storey > 0 || y0 - floor(0) >= LANDING.minSill;
    if ((g.kind === 'leap' || g.kind === 'door') && upper && (g.board ?? true)) {
      const c = step(centre, g.face, WALL / 2 + LANDING.depth / 2, y0 - LANDING.thick / 2);
      const size = alongX ? v(w + LANDING.wider, LANDING.thick, LANDING.depth) : v(LANDING.depth, LANDING.thick, w + LANDING.wider);
      fabric.push({ shape: 'box', material: 'wood', solid: true, yaw: 0, centre: c, size });
      landings.push({ centre: c, size, yaw: 0 });
    }
    if (passable) {
      nav.push(step(centre, g.face, -(WALL / 2 + DOOR_STEP), floor(g.storey)));
      nav.push(step(centre, g.face, WALL / 2 + DOOR_STEP, floor(g.storey)));
    }
  }
  for (const f of ['n', 's', 'e', 'w'] as const) fabric.push(...face(s, f, spans[f], floor(0), wallTop));

  // Slabs with stair, ladder and hatch holes; the roof. A hole against a wall runs on under it (the walls stand full
  // height), which saves a slab strip.
  const snap = (r: Rect): Rect => rect(
    r.x0 - s.x0 <= WALL + SNAP_EPS ? s.x0 : r.x0, s.x1 - r.x1 <= WALL + SNAP_EPS ? s.x1 : r.x1,
    r.z0 - s.z0 <= WALL + SNAP_EPS ? s.z0 : r.z0, s.z1 - r.z1 <= WALL + SNAP_EPS ? s.z1 : r.z1,
  );
  const holesAt = (k: number | 'roof'): Rect[] => [
    ...(s.stairs ?? []).filter((st) => st.storey + 1 === k).map((st) => st.r),
    ...(s.ladders ?? []).filter((l) => (l.storey + 1 < n ? l.storey + 1 : 'roof') === k).map(ladderHole),
    ...(s.holes ?? []).filter((h) => h.storey === k).map((h) => h.r),
  ].map(snap);
  for (let k = 1; k < n; k++) {
    for (const r of carve(outer, holesAt(k))) fabric.push(slabOf(r, floor(k) - SLAB, floor(k), s.material));
  }
  if (flat) {
    for (const r of carve(outer, holesAt('roof'))) fabric.push(slabOf(r, s.top - SLAB, s.top, 'roof'));
    for (const f of s.parapet ?? ['n', 's', 'e', 'w']) {
      if (f === 'n') fabric.push(block(s.x0, s.x1, s.z1 - WALL, s.z1, s.top, s.top + PARAPET, s.material));
      if (f === 's') fabric.push(block(s.x0, s.x1, s.z0, s.z0 + WALL, s.top, s.top + PARAPET, s.material));
      if (f === 'e') fabric.push(block(s.x1 - WALL, s.x1, s.z0 + WALL, s.z1 - WALL, s.top, s.top + PARAPET, s.material));
      if (f === 'w') fabric.push(block(s.x0, s.x0 + WALL, s.z0 + WALL, s.z1 - WALL, s.top, s.top + PARAPET, s.material));
    }
    nav.push(...grid(inner, s.top));
  } else {
    fabric.push(...gable(outer, s.top, s.roof));
  }

  // Stairs, ladders, hatches.
  for (const st of s.stairs ?? []) {
    const y0 = floor(st.storey);
    const y1 = floor(st.storey + 1);
    fabric.push(stairPrim(st.r, st.up, y0, y1, 'wood'));
    nav.push(...rampEnds(st.r, st.up, y0, y1));
    stairs.push(stairDress(st.r, st.up, y0, y1));
  }
  for (const l of s.ladders ?? []) {
    const top = l.storey + 1 < n ? floor(l.storey + 1) : s.top;
    climbs.push(ladderClimb(l, floor(l.storey), top));
    const h = ladderHole(l);
    openings.push({
      kind: 'hatch', rooms: [l.storey, l.storey + 1 < n ? l.storey + 1 : -1], centre: v((h.x0 + h.x1) / 2, top - SLAB / 2, (h.z0 + h.z1) / 2),
      width: HATCH, height: SLAB, yaw: YAW[l.in], passable: true,
    });
  }
  for (const h of s.holes ?? []) {
    if (h.kind === 'void') continue;
    const k = h.storey === 'roof' ? n : h.storey;
    const top = h.storey === 'roof' ? s.top : floor(k);
    const c = v((h.r.x0 + h.r.x1) / 2, top - SLAB / 2, (h.r.z0 + h.r.z1) / 2);
    openings.push({
      kind: h.kind, rooms: [k - 1, k < n ? k : -1], centre: c, width: h.r.x1 - h.r.x0, height: SLAB, yaw: 0, passable: true,
    });
    // Drop from beside the hole (south edge, on the slab) to the floor under it.
    const above = v(c.x, top, h.r.z0 - DOOR_STEP);
    const below = v(c.x, floor(k - 1), c.z);
    nav.push(above, below);
    links.push({ from: above, to: below, kind: 'drop' });
  }

  // Balconies.
  for (const b of s.balconies ?? []) {
    const y = floor(b.storey);
    const d = b.depth ?? 2;
    const r = b.face === 'n' ? rect(b.from, b.to, s.z1, s.z1 + d)
      : b.face === 's' ? rect(b.from, b.to, s.z0 - d, s.z0)
        : b.face === 'e' ? rect(s.x1, s.x1 + d, b.from, b.to) : rect(s.x0 - d, s.x0, b.from, b.to);
    fabric.push(slabOf(r, y - SLAB, y, 'wood'));
    balconies.push(volumeOf(r, y - SLAB, y + RAIL));
    const rail = b.face === 'n' ? rect(r.x0, r.x1, r.z1 - WALL, r.z1)
      : b.face === 's' ? rect(r.x0, r.x1, r.z0, r.z0 + WALL)
        : b.face === 'e' ? rect(r.x1 - WALL, r.x1, r.z0, r.z1) : rect(r.x0, r.x0 + WALL, r.z0, r.z1);
    if (b.rail ?? true) fabric.push(slabOf(rail, y, y + RAIL, 'wood'));
    nav.push(v((r.x0 + r.x1) / 2, y, (r.z0 + r.z1) / 2));
  }

  // Rooms: one per storey, then the cellar.
  const rooms: Room[] = s.floors.map((_, k) => ({
    building: 0, storey: k,
    volume: { centre: v((inner.x0 + inner.x1) / 2, (floor(k) + ceiling(k)) / 2, (inner.z0 + inner.z1) / 2), size: v(inner.x1 - inner.x0, ceiling(k) - floor(k), inner.z1 - inner.z0), yaw: 0 },
  }));
  if (s.cellar) {
    const c = s.cellar.r ?? inner;
    rooms.push({ building: 0, storey: -1, volume: volumeOf(c, s.cellar.floor, s.cellar.ceiling) });
    nav.push(...grid(c, s.cellar.floor));
  }
  s.floors.forEach((_, k) => nav.push(...grid(inner, floor(k))));
  // Outside corners, so routes find their way round the building.
  for (const [x, z] of [[s.x0 - 2, s.z0 - 2], [s.x1 + 2, s.z0 - 2], [s.x0 - 2, s.z1 + 2], [s.x1 + 2, s.z1 + 2]] as const) nav.push(v(x, floor(0), z));

  const bottom = s.cellar ? s.cellar.floor : floor(0);
  const roofY = flat ? s.top : ridgeHeight(outer, s.top, s.roof);
  return part({
    fabric, climbs, nav, links, openings, rooms,
    dress: [{
      style: s.style, enterable: true, marks: s.marks ?? [], balconies, landings, stairs,
      roof: s.roof === 'flat'
        ? { style: 'flat', nestCrown: s.nestCrown ?? false, pitchDeg: 0, ridge: null, eaves: wallTop, top: s.top }
        : { style: s.roof, nestCrown: s.nestCrown ?? false, pitchDeg: PITCH_DEG[s.roof], ridge: ridgeAxis(outer), eaves: s.top, top: roofY },
    }],
    buildings: [{
      id: s.id, archetype: s.archetype, zone: s.zone,
      footprint: { centre: v((s.x0 + s.x1) / 2, (bottom + roofY) / 2, (s.z0 + s.z1) / 2), size: v(s.x1 - s.x0, roofY - bottom, s.z1 - s.z0), yaw: 0 },
      storeys: s.floors.map((f, k) => ({ floorY: f, height: ceiling(k) - f })),
      roof: { y: roofY, walkable: s.roof !== 'steep' },
    }],
  });
}

/** Facade mark sizes and spacing on solid fill buildings (visual only). */
const MARK = { window: { w: 1.2, h: 1.4, sill: 1.2 }, door: { w: 1.6, h: 2.6 }, pitch: 3.5, storey: 4, proud: 0.02 } as const;

export interface FillSpec {
  readonly id: string;
  readonly archetype: string;
  readonly zone: string;
  readonly r: Rect;
  /** Flat: walkable top. Steep: eaves. */
  readonly h: number;
  readonly roof: 'flat' | 'steep';
  readonly material: MaterialTag;
  readonly style: FacadeStyle;
  /** Faces seen from a street or lane: they get a door and rows of windows. */
  readonly faces: readonly Side[];
  readonly nestCrown?: boolean;
  readonly y0?: number;
}

/** Doors and window rows on the given faces of a solid block. */
export function marksOn(r: Rect, faces: readonly Side[], y0: number, eaves: number): FacadeMark[] {
  const out: FacadeMark[] = [];
  const storeys = Math.max(1, Math.floor((eaves - y0) / MARK.storey));
  for (const f of faces) {
    const alongX = f === 'n' || f === 's';
    const a0 = alongX ? r.x0 : r.z0;
    const a1 = alongX ? r.x1 : r.z1;
    const n = Math.max(1, Math.floor((a1 - a0) / MARK.pitch));
    const at = (a: number, y: number): Vec3 => {
      const o = OUT[f];
      const cx = (r.x0 + r.x1) / 2 + o.x * ((r.x1 - r.x0) / 2 + MARK.proud);
      const cz = (r.z0 + r.z1) / 2 + o.z * ((r.z1 - r.z0) / 2 + MARK.proud);
      return alongX ? v(a, y, cz) : v(cx, y, a);
    };
    const mid = (a0 + a1) / 2;
    out.push({ kind: 'door', centre: at(mid, y0 + MARK.door.h / 2), width: MARK.door.w, height: MARK.door.h, yaw: YAW[f] });
    for (let k = 0; k < storeys; k++) {
      for (let i = 0; i < n; i++) {
        const a = a0 + ((a1 - a0) * (i + 0.5)) / n;
        if (k === 0 && Math.abs(a - mid) < MARK.pitch / 2) continue;
        out.push({ kind: 'window', centre: at(a, y0 + k * MARK.storey + MARK.window.sill + MARK.window.h / 2), width: MARK.window.w, height: MARK.window.h, yaw: YAW[f] });
      }
    }
  }
  return out;
}

/** A solid fill building: collision prims (with generated nav), a Building record with no rooms, and facade marks. */
export function fill(s: FillSpec): SpecPart {
  const { r } = s;
  const y0 = s.y0 ?? 0;
  const flat = s.roof === 'flat';
  const prims: BlockoutPrim[] = flat
    ? [block(r.x0, r.x1, r.z0, r.z1, y0, s.h - SLAB, s.material), block(r.x0, r.x1, r.z0, r.z1, s.h - SLAB, s.h, 'roof')]
    : [block(r.x0, r.x1, r.z0, r.z1, y0, s.h, s.material), ...gable(r, s.h, 'steep')];
  const top = flat ? s.h : ridgeHeight(r, s.h, 'steep');
  const eaves = flat ? s.h - SLAB : s.h;
  const storeys = Math.max(1, Math.floor((eaves - y0) / MARK.storey));
  return part({
    prims,
    buildings: [{
      id: s.id, archetype: s.archetype, zone: s.zone,
      footprint: volumeOf(r, y0, top),
      storeys: Array.from({ length: storeys }, (_, k) => ({ floorY: y0 + k * MARK.storey, height: MARK.storey - SLAB })),
      roof: { y: top, walkable: flat },
    }],
    dress: [{
      style: s.style, enterable: false, marks: marksOn(r, s.faces, y0, eaves), balconies: [], landings: [], stairs: [],
      roof: flat
        ? { style: 'flat', nestCrown: s.nestCrown ?? false, pitchDeg: 0, ridge: null, eaves, top }
        : { style: 'steep', nestCrown: s.nestCrown ?? false, pitchDeg: PITCH_DEG.steep, ridge: ridgeAxis(r), eaves, top },
    }],
  });
}

/** A box volume over the rect between two heights. */
export const volumeOf = (r: Rect, y0: number, y1: number): BoxVolume =>
  ({ centre: v((r.x0 + r.x1) / 2, (y0 + y1) / 2, (r.z0 + r.z1) / 2), size: v(r.x1 - r.x0, y1 - y0, r.z1 - r.z0), yaw: 0 });

/** Gables ridge along the longer side (as gable() builds them). */
export const ridgeAxis = (r: Rect): 'x' | 'z' => (r.x1 - r.x0 <= r.z1 - r.z0 ? 'z' : 'x');

export function stairDress(r: Rect, up: Side, y0: number, y1: number): StairDress {
  const [a, b] = rampEnds(r, up, y0, y1);
  const o = OUT[up];
  return { from: v(a.x + o.x, y0, a.z + o.z), to: v(b.x - o.x, y1, b.z - o.z), width: o.x !== 0 ? r.z1 - r.z0 : r.x1 - r.x0 };
}

/** Gaps shorter than this need no movement filler: no hero fits through. */
const HERO_SQUEEZE = 1.0;

/** The hole rects a shell carves into the ground under it (a cellar), for the ground carve. */
export const innerRect = (s: Pick<ShellSpec, 'x0' | 'x1' | 'z0' | 'z1'>): Rect => rect(s.x0 + WALL, s.x1 - WALL, s.z0 + WALL, s.z1 - WALL);
