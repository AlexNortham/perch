/**
 * Buildings (style guide §5): every building in MapData.buildings dressed from its BuildingDress. Facades get a skin
 * in the district material with real openings, a plinth, string courses carrying perch rails, a cornice or eaves,
 * quoins or corner posts, half-timbering in Lantern Row, framed openings (doors swung open, shot and leap windows
 * open, decorative windows glazed, shuttered and some lit), and bay fillers so no wall over 3 × 3 m goes unbroken.
 * Roofs get tile courses, ridges, gutters and downpipes, chimneys, parapet copings and nest crowns; balconies and
 * landing boards are dressed over their collision. Archetype extras live in archetypes.ts.
 *
 * Faces are worked in a wall frame: x along the face (to the right seen from outside), y up (world), z out of the
 * wall from its outer face. Authored art data (magic numbers allowed, D-RENDER-010).
 */
import { Matrix4, Vector3 } from 'three';
import type { BlockoutPrim, Building, BoxVolume, Opening, Vec3 } from '../../../../sim/core/contracts';
import type { BuildingDress, FacadeMark } from '../../../../sim/core/contracts';
import { carve, rect } from '../../../../sim/world/map/data/interiors';
import type { Band } from '../constants';
import { PROUD } from '../constants';
import { oriented, placed } from '../mesher';
import type { Mesher, Paint } from '../mesher';
import { hash2 } from '../world';
import type { Pass, World } from '../world';
import { dressArchetype } from './archetypes';
import { nest, perchRail, wallBracket } from './nest';
import { distToPath } from './nature';
import { GLASS, IRON, LANDING, LIT, POT, ROPE, SOOT, STYLES, TWIG } from './styles';
import type { StyleKit } from './styles';

/** 'covered': the stretch of a face a neighbouring building stands against (never dressed). */
export type HoleKind = Opening['kind'] | 'mark-window' | 'mark-door' | 'shopfront' | 'covered';

export interface Hole {
  readonly u: number;
  readonly w: number;
  readonly y0: number;
  readonly y1: number;
  readonly kind: HoleKind;
  readonly curtain: boolean;
  readonly storey: number;
}

export interface Face {
  readonly side: number;
  /** Outward normal yaw. */
  readonly yaw: number;
  readonly cx: number;
  readonly cz: number;
  readonly width: number;
  readonly frame: Matrix4;
  readonly holes: Hole[];
  readonly hidden: boolean;
  /** A gable end (pitched roofs): the wall continues as a triangle to the ridge. */
  readonly gable: boolean;
  readonly parapet: boolean;
  readonly top: number;
}

export interface Ctx {
  readonly w: World;
  readonly i: number;
  readonly b: Building;
  readonly d: BuildingDress;
  readonly kit: StyleKit;
  readonly cx: number;
  readonly cz: number;
  readonly yaw: number;
  readonly sx: number;
  readonly sz: number;
  /** Ground-floor level (walls start here). */
  readonly base: number;
  readonly faces: readonly Face[];
  readonly seed: number;
  /** Floor lines of every storey above the ground floor. */
  readonly floors: readonly number[];
  /** Mesher in this building's cell for a band and pass, its frame set to `frame`. */
  M(band: Band, frame?: Matrix4, pass?: Pass): Mesher;
}

const WALL = 0.5;
const PLINTH = 0.8;
const PARAPET = 0.8;
const UP = new Vector3(0, 1, 0);

const angleDiff = (a: number, b: number): number => {
  const d = (((a - b) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  return Math.abs(d);
};

/** Is `p` inside a box volume (turned by yaw)? */
export function inVolume(v: BoxVolume, p: Vec3, pad = 0): boolean {
  const dx = p.x - v.centre.x;
  const dz = p.z - v.centre.z;
  const c = Math.cos(v.yaw);
  const s = Math.sin(v.yaw);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) <= v.size.x / 2 + pad && Math.abs(lz) <= v.size.z / 2 + pad && Math.abs(p.y - v.centre.y) <= v.size.y / 2 + pad;
}

/** Is `p` inside a solid prim? */
export function inPrim(q: BlockoutPrim, p: Vec3, pad = 0): boolean {
  if (q.shape === 'cylinder') return Math.hypot(p.x - q.centre.x, p.z - q.centre.z) <= q.radius + pad && Math.abs(p.y - q.centre.y) <= q.height / 2 + pad;
  return inVolume({ centre: q.centre, size: q.size, yaw: q.yaw }, p, pad);
}

/** Free runs of [a, b] once the given intervals are removed (each grown by `pad`). */
export function runs(a: number, b: number, cuts: readonly (readonly [number, number])[], pad = 0, min = 0.3): [number, number][] {
  const sorted = cuts.map(([x, y]) => [x - pad, y + pad] as const).sort((p, q) => p[0] - q[0]);
  const out: [number, number][] = [];
  let at = a;
  for (const [x, y] of sorted) {
    if (x > at && Math.min(x, b) - at >= min) out.push([at, Math.min(x, b)]);
    at = Math.max(at, y);
  }
  if (b - at >= min) out.push([at, b]);
  return out;
}

export const isOctagon = (b: Building): boolean => b.archetype === 'dovecote' || b.archetype === 'hollow-tree';

function facesOf(w: World, i: number, b: Building, d: BuildingDress): Face[] {
  const { centre: c, size, yaw: psi } = b.footprint;
  const X = new Vector3(Math.cos(psi), 0, -Math.sin(psi));
  const Z = new Vector3(Math.sin(psi), 0, Math.cos(psi));
  // Octagonal towers (Dovecote, Hollow-tree House): eight faces on the octagon whose apothem is the footprint's half.
  const octagon = isOctagon(b);
  const sides = octagon
    ? Array.from({ length: 8 }, (_, k) => {
      const yaw = psi + (k * Math.PI) / 4;
      return { n: new Vector3(Math.sin(yaw), 0, Math.cos(yaw)), yaw, half: size.x / 2, width: size.x * Math.tan(Math.PI / 8) };
    })
    : [
      { n: Z, yaw: psi, half: size.z / 2, width: size.x },
      { n: X, yaw: psi + Math.PI / 2, half: size.x / 2, width: size.z },
      { n: Z.clone().negate(), yaw: psi + Math.PI, half: size.z / 2, width: size.x },
      { n: X.clone().negate(), yaw: psi - Math.PI / 2, half: size.x / 2, width: size.z },
    ];
  const base = b.storeys[0]?.floorY ?? 0;
  const roomsOf = w.map.rooms ?? [];
  const openings = (w.map.openings ?? []).filter((o) => o.rooms[1] === -1 && o.rooms[0] >= 0 && roomsOf[o.rooms[0]]?.building === i);
  const others = [...(w.map.buildings ?? []).entries()].filter(([k, o]) => k !== i && Math.hypot(o.footprint.centre.x - c.x, o.footprint.centre.z - c.z) < 40);
  const pitched = d.roof.style === 'gable' || d.roof.style === 'steep';
  const near = w.map.prims.filter((q) => q.solid && Math.hypot(q.centre.x - c.x, q.centre.z - c.z) < Math.max(size.x, size.z) + 2);
  return sides.map((s, side) => {
    const cx = c.x + s.n.x * s.half;
    const cz = c.z + s.n.z * s.half;
    const along = new Vector3(Math.cos(s.yaw), 0, -Math.sin(s.yaw));
    const local = (p: Vec3): { u: number; z: number } => ({ u: (p.x - cx) * along.x + (p.z - cz) * along.z, z: (p.x - cx) * s.n.x + (p.z - cz) * s.n.z });
    const holes: Hole[] = [];
    for (const o of openings) {
      if (angleDiff(o.yaw, s.yaw) > 0.1) continue;
      const l = local(o.centre);
      if (Math.abs(l.z + WALL / 2) > 0.35 || Math.abs(l.u) > s.width / 2) continue;
      const storey = Math.max(0, b.storeys.findIndex((st) => o.centre.y >= st.floorY - 0.5 && o.centre.y < st.floorY + st.height + 0.5));
      holes.push({ u: l.u, w: o.width, y0: o.centre.y - o.height / 2, y1: o.centre.y + o.height / 2, kind: o.kind, curtain: o.curtain === true, storey });
    }
    for (const m of d.marks) {
      if (angleDiff(m.yaw, s.yaw) > 0.1) continue;
      const l = local(m.centre);
      if (Math.abs(l.z) > 0.35 || Math.abs(l.u) > s.width / 2) continue;
      const storey = Math.max(0, Math.floor((m.centre.y - base) / 4));
      const kind: HoleKind = m.kind === 'door' ? 'mark-door' : m.kind === 'window' ? 'mark-window' : 'shopfront';
      holes.push({ u: l.u, w: m.width, y0: m.centre.y - m.height / 2, y1: m.centre.y + m.height / 2, kind, curtain: false, storey });
    }
    const inner = { x: cx - s.n.x * 0.25, y: d.roof.top + 0.4, z: cz - s.n.z * 0.25 };
    const parapet = d.roof.style === 'flat' && near.some((q) => inPrim(q, inner, 0.02));
    const gable = pitched && (d.roof.ridge === 'x' ? Math.abs(s.n.x) > 0.7 : Math.abs(s.n.z) > 0.7);
    // Spires stand on a flat roof slab (0.4 m) over the eaves; octagons stop under their crown deck.
    const top = pitched || octagon ? d.roof.eaves : d.roof.style === 'spire' ? d.roof.eaves + 0.4 : d.roof.top + (parapet ? PARAPET : 0);
    // Where a neighbour stands against this face, the face is covered up to the neighbour's eaves.
    let hidden = false;
    for (const [k, o] of others) {
      const od = w.dressing.buildings[k];
      const oTop = od ? (od.roof.style === 'flat' ? od.roof.top : od.roof.eaves) : o.footprint.centre.y + o.footprint.size.y / 2;
      let from: number | null = null;
      const step = 0.5;
      for (let u = -s.width / 2; u <= s.width / 2 + step / 2; u += step) {
        const at = Math.min(u, s.width / 2);
        const p = { x: cx + s.n.x * 0.7 + along.x * at, y: base + 1, z: cz + s.n.z * 0.7 + along.z * at };
        const inside = inVolume(o.footprint, p);
        if (inside && from === null) from = at - step / 2;
        if ((!inside || at >= s.width / 2) && from !== null) {
          const to = inside ? s.width / 2 + 0.1 : at - step / 2;
          holes.push({ u: (from + to) / 2, w: to - from, y0: base - 1, y1: oTop, kind: 'covered', curtain: false, storey: 0 });
          if (to - from >= s.width && oTop >= top - 0.3) hidden = true;
          from = null;
        }
      }
    }
    return { side, yaw: s.yaw, cx, cz, width: s.width, frame: placed(cx, 0, cz, s.yaw), holes, hidden, gable, parapet, top };
  });
}

/** Dress every building of the map. */
export function dressBuildings(w: World): void {
  const list = w.map.buildings ?? [];
  list.forEach((b, i) => {
    const d = w.dressing.buildings[i];
    if (!d) return;
    const kit = STYLES[d.style];
    const faces = facesOf(w, i, b, d);
    const base = b.storeys[0]?.floorY ?? 0;
    const { centre, size, yaw } = b.footprint;
    const floors = b.storeys.slice(1).map((s) => s.floorY);
    const ctx: Ctx = {
      w, i, b, d, kit, cx: centre.x, cz: centre.z, yaw, sx: size.x, sz: size.z, base, faces, seed: i * 1009 + 17, floors,
      M(band, frame, pass = 'opaque') {
        const g = w.m(pass, band, centre.x, centre.z, Math.min(base, 0));
        if (frame) g.frame.copy(frame);
        return g;
      },
    };
    for (const f of faces) {
      if (!f.hidden) facade(ctx, f);
    }
    if (!isOctagon(b)) {
      roof(ctx);
      roofLife(ctx);
    }
    for (const v of d.balconies) balcony(ctx, v);
    for (const v of d.landings) landing(ctx, v);
    dressArchetype(ctx);
  });
}

// ── Facades ──────────────────────────────────────────────────────────────────────────────────────────────────────

function facade(c: Ctx, f: Face): void {
  const { kit } = c;
  const W = f.width / 2;
  const seed = c.seed + f.side * 131;
  const plinthTop = c.base + PLINTH;
  // Skin: the district material over the collision face, with every opening and mark left open.
  const holes = f.holes.map((h) => rect(h.u - h.w / 2, h.u + h.w / 2, h.y0, h.y1));
  const skin = c.M(2, f.frame);
  skin.paint(kit.wall, seed);
  for (const r of carve(rect(-W, W, plinthTop - 0.1, f.top), holes)) {
    skin.poly([new Vector3(r.x0, r.z0, PROUD.skin), new Vector3(r.x1, r.z0, PROUD.skin), new Vector3(r.x1, r.z1, PROUD.skin), new Vector3(r.x0, r.z1, PROUD.skin)], new Vector3(0, 0, 1));
  }
  if (f.gable) {
    const ridge = c.d.roof.top;
    skin.poly([new Vector3(-W, f.top, PROUD.skin), new Vector3(W, f.top, PROUD.skin), new Vector3(0, ridge, PROUD.skin)], new Vector3(0, 0, 1));
  }
  if (f.parapet) {
    // The roof side of the parapet is a place players stand next to.
    skin.poly([new Vector3(-W + WALL, c.d.roof.top, -WALL - PROUD.skin), new Vector3(W - WALL, c.d.roof.top, -WALL - PROUD.skin),
      new Vector3(W - WALL, f.top, -WALL - PROUD.skin), new Vector3(-W + WALL, f.top, -WALL - PROUD.skin)], new Vector3(0, 0, -1));
  }

  // Plinth: heavier, darker, broken by doorways.
  const doors = f.holes.filter((h) => h.y0 < plinthTop).map((h) => [h.u - h.w / 2, h.u + h.w / 2] as const);
  const g2 = c.M(2, f.frame);
  g2.paint(kit.plinth, seed + 1);
  for (const [a, b] of runs(-W - 0.09, W + 0.09, doors, 0, 0.1)) g2.span(a, b, c.base - 0.05, plinthTop, -0.02, 0.09, 0.03, '-z');

  // String courses at every floor line, each carrying a perch rail (§1.1, §5.1).
  const g1 = c.M(1, f.frame);
  const lines = c.floors.filter((y) => y < f.top - 0.6 && y > c.base + 1);
  for (const y of lines) {
    const cut = f.holes.filter((h) => h.y1 > y - 0.45 && h.y0 < y + 0.3).map((h) => [h.u - h.w / 2, h.u + h.w / 2] as const);
    g2.paint(kit.trim, seed + 2);
    for (const [a, b] of runs(-W - 0.15, W + 0.15, cut, 0.18, 0.2)) g2.span(a, b, y - 0.38, y - 0.08, -0.02, 0.15, 0.03, '-z');
    for (const [a, b] of runs(-W + 0.4, W - 0.4, cut, 0.3, 0.8)) perchRail(g1, a, b, y + 0.06, kit.timber, seed + Math.round(y), c.M(0, f.frame));
  }

  corners(c, f, g1, g2);
  if (kit.halfTimber) halfTimber(c, f);
  cornice(c, f);
  for (const h of f.holes) opening(c, f, h);
  bays(c, f);
  birdLife(c, f);
  // The jungle grows over its streets: ivy climbs most jungle faces (§6.2: at least 30 %).
  if (c.d.style.startsWith('jungle') && hash2(c.seed, f.side + 70) < 0.65 && f.width > 3) ivyPatch(c, f, (hash2(c.seed, f.side + 71) - 0.5) * f.width * 0.5, Math.min(3.2, f.width * 0.5), c.base + 0.4, Math.min(f.top, c.base + 8), c.seed + f.side + 72);
}

function corners(c: Ctx, f: Face, near: Mesher, g2: Mesher): void {
  let g1 = near;
  const W = f.width / 2;
  const { kit } = c;
  // A corner hidden by a neighbour keeps its quoins only above the neighbour.
  const from = (u: number): number => Math.max(c.base + PLINTH + 0.02, ...f.holes.filter((h) => h.kind === 'covered' && Math.abs(h.u - u) <= h.w / 2 + 0.3).map((h) => h.y1));
  if (kit.corner === 'quoin') {
    // Far: a quoin-coloured corner strip; near (band 0): the alternating blocks over it.
    g2.paint(kit.quoin, c.seed + 4);
    for (const s of [-1, 1]) g2.span(s > 0 ? W - 0.34 : -W - 0.02, s > 0 ? W + 0.02 : -W + 0.34, from(s * W), f.top - 0.1, 0, 0.02, 0, '-z');
    g1 = c.M(0, f.frame);
    g1.paint(kit.quoin, c.seed + 5);
    for (const s of [-1, 1]) {
      let k = 0;
      for (let y = c.base + PLINTH + 0.02; y + 0.3 < f.top - 0.1; y += 0.33, k++) {
        if (y < from(s * W)) continue;
        const len = k % 2 ? 0.26 : 0.42;
        if (s > 0) g1.relief(W - len, W + 0.035, y, y + 0.3, -0.035, 0.035, 1);
        else g1.relief(-W - 0.035, -W + len, y, y + 0.3, -0.035, 0.035, -1);
      }
    }
  } else if (kit.corner === 'post') {
    g2.paint(kit.timber, c.seed + 5);
    g2.span(W - 0.24, W + 0.08, Math.max(c.base, from(W)), f.top, 0, 0.08, 0.02, '-z');
    g2.span(-W - 0.08, -W + 0.24, Math.max(c.base, from(-W)), f.top, 0, 0.08, 0.02, '-z');
  }
}

/** Lantern Row: dark posts, rails and braces over ochre plaster (§7.6). */
function halfTimber(c: Ctx, f: Face): void {
  const W = f.width / 2;
  const g = c.M(2, f.frame);
  g.paint(c.kit.timber, c.seed + 7);
  const storeys = [c.base, ...c.floors].filter((y) => y < f.top - 1);
  storeys.forEach((fy, k) => {
    const ceil = k + 1 < storeys.length ? (storeys[k + 1] ?? f.top) : f.top;
    const inBand = f.holes.filter((h) => h.y1 > fy + 0.2 && h.y0 < ceil - 0.2);
    for (const ry of [fy + 0.95, fy + 3.05]) {
      if (ry > ceil - 0.2) continue;
      const cut = inBand.filter((h) => h.y1 > ry - 0.1 && h.y0 < ry + 0.1).map((h) => [h.u - h.w / 2, h.u + h.w / 2] as const);
      for (const [a, b] of runs(-W, W, cut, 0.12, 0.3)) g.span(a, b, ry - 0.08, ry + 0.08, 0, 0.06, 0, '-z');
    }
    // Posts beside every opening, and between them at ≤ 2.4 m.
    const posts: number[] = [];
    for (const h of inBand) posts.push(h.u - h.w / 2 - 0.12, h.u + h.w / 2 + 0.12);
    const free = runs(-W + 0.3, W - 0.3, inBand.map((h) => [h.u - h.w / 2, h.u + h.w / 2] as const), 0.25, 0.5);
    for (const [a, b] of free) {
      const n = Math.ceil((b - a) / 2.4);
      for (let j = 1; j < n; j++) posts.push(a + ((b - a) * j) / n);
      // A brace in the first panel of each free run, alternating direction.
      if (b - a > 1.2) {
        const span = Math.min(2.2, (b - a) / n);
        const x0 = a + 0.1;
        const dir = (k + Math.round(a)) % 2 ? 1 : -1;
        const len = Math.hypot(span, 0.85);
        g.within(oriented(x0 + span / 2, fy + 0.95 - 0.43 + 0.0, 0.03, 0, 0, dir * Math.atan2(0.85, span)), () => g.box(0, 0, 0, len, 0.14, 0.06, 0, '-z'));
      }
    }
    for (const u of posts) {
      if (Math.abs(u) > W - 0.2) continue;
      const cut = f.holes.filter((h) => Math.abs(h.u - u) < h.w / 2 + 0.05).map((h) => [h.y0, h.y1] as const);
      for (const [a, b] of runs(fy, ceil, cut, 0, 0.2)) g.span(u - 0.09, u + 0.09, a, b, 0, 0.065, 0, '-z');
    }
  });
}

function cornice(c: Ctx, f: Face): void {
  const W = f.width / 2;
  const { kit, d } = c;
  const g2 = c.M(2, f.frame);
  if (d.roof.style === 'flat' || d.roof.style === 'deck') {
    const top = d.roof.top;
    g2.paint(kit.trim, c.seed + 9);
    if (kit.eaves === 'stone') {
      g2.span(-W - 0.07, W + 0.07, top - 0.62, top - 0.44, -0.02, 0.07, 0.02, '-z');
      g2.span(-W - 0.14, W + 0.14, top - 0.44, top - 0.24, -0.02, 0.14, 0.03, '-z');
      g2.span(-W - 0.22, W + 0.22, top - 0.24, top, -0.02, 0.22, 0.04, '-z');
    } else {
      g2.paint(kit.timber, c.seed + 9).span(-W - 0.12, W + 0.12, top - 0.36, top, -0.02, 0.12, 0.02, '-z');
      const g1 = c.M(1, f.frame);
      g1.paint(kit.timber, c.seed + 10);
      const n = Math.max(2, Math.round(f.width / 1.4));
      for (let k = 0; k <= n; k++) {
        const u = -W + 0.2 + ((f.width - 0.4) * k) / n;
        g1.span(u - 0.05, u + 0.05, top - 0.62, top - 0.36, 0, 0.11, 0, '-z');
      }
    }
    if (f.parapet) {
      g2.paint(kit.trim, c.seed + 11).span(-W - 0.04, W + 0.04, top + PARAPET, top + PARAPET + 0.12, -WALL - 0.06, 0.06, 0.03);
    }
    return;
  }
  if (f.gable) {
    bargeboards(c, f);
    return;
  }
  if (d.roof.style !== 'gable' && d.roof.style !== 'steep') return;
  // Eaves: overhang, fascia, half-round gutter, rafter tails, downpipes and the odd rain barrel (§5.4).
  const tan = Math.tan((d.roof.pitchDeg * Math.PI) / 180);
  const ov = overhang(d);
  const edgeY = d.roof.eaves - ov * tan;
  const go = gableOverhang(d);
  const g1 = c.M(1, f.frame);
  g2.paint(kit.timber, c.seed + 12).span(-W - go, W + go, edgeY - 0.24, edgeY + 0.02, ov - 0.05, ov + 0.02);
  g1.paint({ mat: 'verdigris', shade: 0.85 }, c.seed + 13).tube([new Vector3(-W - go, edgeY - 0.2, ov + 0.1), new Vector3(W + go, edgeY - 0.2, ov + 0.1)], 0.07, 6);
  if (kit.eaves === 'timber') {
    g1.paint(kit.timber, c.seed + 14);
    const n = Math.max(2, Math.round(f.width / 0.9));
    for (let k = 0; k <= n; k++) {
      const u = -W + (f.width * k) / n;
      g1.within(oriented(u, d.roof.eaves - (ov / 2) * tan - 0.12, ov / 2, 0, Math.atan(tan)), () => g1.box(0, 0, 0, 0.09, 0.14, ov / Math.cos(Math.atan(tan)) + 0.1, 0, ''));
    }
  }
  for (const side of [-1, 1]) {
    if (hash2(c.seed + f.side, side) > 0.6) continue;
    const u = side * (W - 0.35);
    g1.paint(IRON, c.seed + 15).tube([
      new Vector3(u, edgeY - 0.25, ov + 0.1), new Vector3(u, edgeY - 0.55, 0.3), new Vector3(u, edgeY - 0.75, 0.12), new Vector3(u, c.base + 0.25, 0.12),
    ], 0.05, 6);
    if (hash2(c.seed + f.side, side + 7) < 0.34) barrel(c.M(1, f.frame), u + side * 0.05, c.base, 0.55, 0.36, 0.9, c.seed + f.side);
  }
}

/** Bargeboards with carved feather curls at the feet and a finial perch at the apex (§5.4). */
function bargeboards(c: Ctx, f: Face): void {
  const { d, kit } = c;
  const W = f.width / 2;
  const go = gableOverhang(d);
  const ov = overhang(d);
  const tan = Math.tan((d.roof.pitchDeg * Math.PI) / 180);
  const ridge = d.roof.top;
  const g = c.M(1, f.frame);
  g.paint(kit.timber, c.seed + 20);
  for (const s of [-1, 1]) {
    const x0 = s * (W + ov);
    const y0 = d.roof.eaves - ov * tan;
    const len = Math.hypot(W + ov, ridge - y0);
    const ang = Math.atan2(ridge - y0, W + ov);
    g.within(oriented(x0 / 2, (y0 + ridge) / 2 - 0.08, go + 0.02, 0, 0, -s * ang), () => g.box(0, 0, 0, len + 0.1, 0.24, 0.06, 0.015));
    // Feather curl at the foot: three stepped tips.
    for (let k = 0; k < 3; k++) g.within(oriented(x0 + s * 0.05 * k, y0 - 0.18 - k * 0.1, go + 0.02, 0, 0, s * (0.6 + k * 0.35)), () => g.box(0, 0, 0, 0.3 - k * 0.06, 0.07, 0.05));
  }
  // Finial perch: a turned post with a crossbar.
  g.paint(kit.timber, c.seed + 21).within(placed(0, ridge + 0.05, go + 0.02, 0), () => {
    g.lathe([[0.07, 0], [0.09, 0.15], [0.05, 0.35], [0.08, 0.55], [0.001, 0.75]], 8);
    g.box(0, 0.45, 0, 0.5, 0.04, 0.04);
  });
}

export const overhang = (d: BuildingDress): number => (d.roof.style === 'steep' ? 0.5 : 0.25);
export const gableOverhang = (d: BuildingDress): number => (d.roof.style === 'steep' ? 0.35 : 0.2);

// ── Openings ─────────────────────────────────────────────────────────────────────────────────────────────────────

function head(c: Ctx, g: Mesher, u: number, w: number, y1: number, seed: number): void {
  const { kit } = c;
  if (kit.head === 'keystone') {
    g.paint(kit.trim, seed).span(u - w / 2 - 0.22, u + w / 2 + 0.22, y1, y1 + 0.26, 0, 0.1, 0.02, '-z');
    g.within(oriented(u, y1 + 0.2, 0.08, 0, 0, 0), () => g.box(0, 0, 0, 0.3, 0.42, 0.14, 0.02, '-z'));
  } else if (kit.head === 'timber') {
    g.paint(kit.timber, seed).span(u - w / 2 - 0.3, u + w / 2 + 0.3, y1, y1 + 0.26, 0, 0.14, 0.02, '-z');
  } else {
    // A flat brick arch: radial voussoirs fanning from the opening's centre.
    g.paint(kit.wall.mat === 'brick' ? { mat: 'brickBurnt' } : { mat: 'brick' }, seed);
    const n = 5;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n - 0.5;
      g.within(oriented(u + t * (w + 0.3), y1 + 0.16, 0.03, 0, 0, -t * 0.5), () => g.box(0, 0, 0, (w + 0.3) / n - 0.012, 0.32, 0.06, 0, '-z'));
    }
  }
}

function frameAround(g: Mesher, u: number, w: number, y0: number, y1: number, t: number, depth: number, paint: Paint, seed: number, sill = true): void {
  g.paint(paint, seed);
  g.relief(u - w / 2 - t, u - w / 2, y0, y1, -0.03, depth, 1);
  g.relief(u + w / 2, u + w / 2 + t, y0, y1, -0.03, depth, -1);
  g.relief(u - w / 2 - t, u + w / 2 + t, y1, y1 + t, -0.03, depth);
  g.poly([new Vector3(u - w / 2, y1, -0.03), new Vector3(u + w / 2, y1, -0.03), new Vector3(u + w / 2, y1, depth), new Vector3(u - w / 2, y1, depth)], new Vector3(0, -1, 0));
  if (sill) g.span(u - w / 2 - t, u + w / 2 + t, y0 - t, y0, -0.03, depth, 0.015, '-z');
}

function shutters(g: Mesher, u: number, w: number, y0: number, y1: number, paint: Paint, seed: number, closed: boolean): void {
  g.paint(paint, seed);
  const sw = w / 2;
  for (const s of [-1, 1]) {
    if (closed) {
      g.relief(u + (s < 0 ? -sw : 0) + 0.01, u + (s < 0 ? 0 : sw) - 0.01, y0, y1, 0.02, 0.07);
      continue;
    }
    const open = hash2(seed, s) < 0.6 ? 0.1 + hash2(seed, s + 5) * 0.42 : 0;
    const hinge = u + s * (w / 2 + 0.1);
    g.within(oriented(hinge, 0, 0.1, s * open, 0, 0), () => {
      g.relief(s < 0 ? -sw : 0, s < 0 ? 0 : sw, y0, y1, 0, 0.05, s < 0 ? -1 : 1);
      // A ledged back: one rail across the middle.
      g.relief(s < 0 ? -sw + 0.05 : 0.05, s < 0 ? -0.05 : sw - 0.05, (y0 + y1) / 2 - 0.04, (y0 + y1) / 2 + 0.04, 0.05, 0.075);
    });
  }
}

/** A glazed (decorative, solid) window: glass or a warm lit pane, glazing bars 3–4 cm with 25–40 cm panes (§5.2). */
function glazing(c: Ctx, f: Face, u: number, w: number, y0: number, y1: number, seed: number): void {
  const lit = hash2(seed, 2) < 0.38;
  const g2 = c.M(2, f.frame);
  g2.paint(lit ? LIT : GLASS, seed);
  const z = 0.015;
  g2.poly([new Vector3(u - w / 2, y0, z), new Vector3(u + w / 2, y0, z), new Vector3(u + w / 2, y1, z), new Vector3(u - w / 2, y1, z)], new Vector3(0, 0, 1),
    lit ? [[0, 0], [1, 0], [1, 1], [0, 1]] : undefined);
  // The middle mullion and transom reach LOD1; the finer bars are near detail.
  const g1 = c.M(1, f.frame);
  const g0 = c.M(0, f.frame);
  g1.paint(c.kit.frame, seed + 1);
  g0.paint(c.kit.frame, seed + 1);
  const nu = Math.max(1, Math.round(w / 0.36));
  const nv = Math.max(1, Math.round((y1 - y0) / 0.36));
  for (let k = 1; k < nu; k++) {
    const x = u - w / 2 + (w * k) / nu;
    (k === Math.floor(nu / 2) ? g1 : g0).relief(x - 0.018, x + 0.018, y0, y1, z, z + 0.03);
  }
  for (let k = 1; k < nv; k++) {
    const y = y0 + ((y1 - y0) * k) / nv;
    (k === Math.floor(nv / 2) ? g1 : g0).relief(u - w / 2, u + w / 2, y - 0.018, y + 0.018, z, z + 0.03);
  }
}

function sillBoard(c: Ctx, g: Mesher, u: number, w: number, y0: number, seed: number): void {
  g.paint(c.kit.trim, seed).span(u - w / 2 - 0.16, u + w / 2 + 0.16, y0 - 0.1, y0 - 0.005, -0.03, 0.15, 0.02, '-z');
}

/** A window box of flowers, herbs or a seed tray under an upper window (§5.2). */
function windowBox(c: Ctx, f: Face, u: number, w: number, y0: number, seed: number): void {
  const g1 = c.M(1, f.frame);
  g1.paint(hash2(seed, 1) < 0.5 ? POT : c.kit.timber, seed).span(u - w / 2, u + w / 2, y0 - 0.38, y0 - 0.12, 0.02, 0.24, 0.02);
  const g0 = c.M(0, f.frame, 'cutout');
  const n = Math.max(3, Math.round(w / 0.22));
  for (let k = 0; k < n; k++) {
    const x = u - w / 2 + ((k + 0.5) * w) / n;
    g0.paint({ mat: 'leafCard', tint: 0x8fb070 }, seed + k).card2(new Vector3(x, y0 - 0.02, 0.13), new Vector3(0.14, 0, 0), new Vector3(0, 0.12, 0.03));
  }
  const g0o = c.M(0, f.frame);
  const flower = hash2(seed, 3) < 0.5 ? { mat: 'plaster', tint: 0xe7a1b0, shade: 1.1 } as const : { mat: 'plaster', tint: 0xf2d46b, shade: 1.05 } as const;
  g0o.paint(flower, seed);
  for (let k = 0; k < n + 2; k++) {
    const x = u - w / 2 + 0.08 + hash2(seed, k + 9) * (w - 0.16);
    { const fx = x; const fy = y0 + 0.02 + hash2(seed, k + 19) * 0.1; g0o.relief(fx - 0.035, fx + 0.035, fy - 0.03, fy + 0.03, 0.1, 0.25); }
  }
}

function doorLeaves(c: Ctx, f: Face, h: Hole, seed: number): void {
  const g1 = c.M(1, f.frame);
  const g0 = c.M(0, f.frame);
  const lw = h.w / 2;
  for (const s of [-1, 1]) {
    // Swung open ~100° against the wall beside the frame.
    const hinge = h.u + s * (h.w / 2 + 0.18);
    const swing = s * (0.12 + hash2(seed, s) * 0.12);
    g1.paint(c.kit.door, seed + s).within(oriented(hinge, 0, 0.17, swing, 0, 0), () => {
      g1.span(s < 0 ? -lw : 0, s < 0 ? 0 : lw, h.y0 + 0.03, h.y1 - 0.04, 0, 0.07, 0.012);
      g1.paint({ mat: 'timberDark' }, seed).span(s < 0 ? -lw + 0.06 : 0.06, s < 0 ? -0.06 : lw - 0.06, h.y0 + 0.3, h.y0 + 0.42, 0.07, 0.09);
    });
    g0.paint(IRON, seed).within(oriented(hinge, 0, 0.17, swing, 0, 0), () => {
      for (const y of [h.y0 + 0.55, h.y1 - 0.55]) g0.span(s < 0 ? -lw * 0.7 : 0, s < 0 ? 0 : lw * 0.7, y - 0.035, y + 0.035, 0.07, 0.085);
      // Ring pull at bird height (1.0 m).
      const ring: Vector3[] = [];
      for (let k = 0; k <= 8; k++) ring.push(new Vector3(s * (lw - 0.18) + Math.cos((k / 8) * Math.PI * 2) * 0.07, h.y0 + 1 + Math.sin((k / 8) * Math.PI * 2) * 0.07, 0.1));
      g0.tube(ring, 0.012, 4);
    });
  }
}

function fanlight(c: Ctx, f: Face, u: number, w: number, y: number, seed: number): void {
  const r = Math.min(w / 2, 0.6);
  const g2 = c.M(2, f.frame);
  const pts = [new Vector3(u - r, y, 0.015)];
  for (let k = 0; k <= 8; k++) pts.push(new Vector3(u - Math.cos((k / 8) * Math.PI) * r, y + Math.sin((k / 8) * Math.PI) * r, 0.015));
  g2.paint(hash2(seed, 4) < 0.4 ? LIT : GLASS, seed).poly(pts, new Vector3(0, 0, 1));
  // Sun-ray glazing bars (Dawn's rising motif reads well on both halves at this size).
  const g1 = c.M(1, f.frame);
  g1.paint(c.kit.frame, seed);
  for (let k = 1; k < 6; k++) {
    const a = (k / 6) * Math.PI;
    g1.within(oriented(u - Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, 0.03, 0, 0, a), () => g1.box(0, 0, 0, r, 0.03, 0.03));
  }
  const rim: Vector3[] = [];
  for (let k = 0; k <= 6; k++) rim.push(new Vector3(u - Math.cos((k / 6) * Math.PI) * (r + 0.05), y + Math.sin((k / 6) * Math.PI) * (r + 0.05), 0.04));
  g1.paint(c.kit.trim, seed).tube(rim, 0.06, 5);
}

function hood(c: Ctx, f: Face, u: number, w: number, y: number, seed: number): void {
  const g1 = c.M(1, f.frame);
  g1.paint(c.kit.roof, seed).within(oriented(u, y + 0.2, 0.34, 0, -0.45), () => g1.box(0, 0, 0, w + 0.7, 0.07, 0.78, 0.02));
  g1.paint(c.kit.timber, seed + 1);
  for (const s of [-1, 1]) g1.within(oriented(u + s * (w / 2 + 0.2), y - 0.05, 0.2, 0, 0.7), () => g1.box(0, 0, 0, 0.07, 0.07, 0.5));
}

function opening(c: Ctx, f: Face, h: Hole): void {
  const seed = c.seed + Math.round(h.u * 37 + h.y0 * 101);
  const g1 = c.M(1, f.frame);
  const { kit } = c;
  const ceiling = [...c.floors, f.top].find((y) => y > h.y1 + 0.1) ?? f.top;
  switch (h.kind) {
    case 'door':
    case 'balcony':
    case 'mark-door': {
      frameAround(g1, h.u, h.w, h.y0, h.y1, 0.18, 0.15, kit.frame, seed, false);
      if (h.y1 + 0.5 < ceiling - 0.3) head(c, g1, h.u, h.w + 0.36, h.y1 + 0.18, seed + 1);
      g1.paint(kit.trim, seed + 2).span(h.u - h.w / 2 - 0.2, h.u + h.w / 2 + 0.2, h.y0 - 0.04, h.y0 + 0.1, h.kind === 'mark-door' ? 0 : -0.28, 0.34, 0.03);
      if (h.kind === 'mark-door') {
        const g2 = c.M(2, f.frame);
        g2.paint(kit.door, seed).span(h.u - h.w / 2, h.u + h.w / 2, h.y0 + 0.1, h.y1, 0, 0.04);
        const g0 = c.M(0, f.frame);
        g0.paint(IRON, seed);
        for (const y of [h.y0 + 0.6, h.y1 - 0.5]) g0.span(h.u - h.w / 2 + 0.05, h.u + h.w * 0.15, y - 0.035, y + 0.035, 0.04, 0.055);
        g0.span(h.u + h.w * 0.3, h.u + h.w * 0.3 + 0.06, h.y0 + 0.95, h.y0 + 1.05, 0.04, 0.09);
        if (hash2(seed, 9) < 0.5) potPlant(c, f, h.u + h.w / 2 + 0.45, h.y0, seed);
        else seedTrough(c, f, h.u - h.w / 2 - 0.5, h.y0, seed);
      } else if (!h.curtain) {
        doorLeaves(c, f, h, seed);
      }
      if (h.y1 + 0.85 < ceiling - 0.35 && h.w < 3) fanlight(c, f, h.u, h.w, h.y1 + 0.24, seed);
      if (h.storey === 0 && hash2(seed, 11) < 0.5 && h.y1 + 1.0 < ceiling) hood(c, f, h.u, h.w, h.y1 + 0.55, seed);
      if (h.w >= 3.9) hoist(c, f, h, seed);
      return;
    }
    case 'arch': {
      voussoirs(c, f, h, seed);
      return;
    }
    case 'window':
    case 'leap': {
      frameAround(g1, h.u, h.w, h.y0, h.y1, 0.1, 0.12, kit.frame, seed, false);
      if (h.y0 > c.base + 0.3) sillBoard(c, g1, h.u, h.w, h.y0, seed);
      if (h.y1 + 0.4 < ceiling) head(c, g1, h.u, h.w + 0.2, h.y1 + 0.1, seed + 1);
      if (h.kind === 'window' && h.y1 - h.y0 > 0.6 && hash2(seed, 3) < 0.5) shutters(g1, h.u, h.w, h.y0, h.y1, kit.shutter, seed, false);
      return;
    }
    case 'mark-window': {
      frameAround(g1, h.u, h.w, h.y0, h.y1, 0.1, 0.1, kit.frame, seed, false);
      sillBoard(c, g1, h.u, h.w, h.y0, seed);
      if (h.y1 + 0.4 < ceiling) head(c, g1, h.u, h.w + 0.2, h.y1 + 0.1, seed + 1);
      glazing(c, f, h.u, h.w, h.y0, h.y1, seed);
      if (hash2(seed, 3) < 0.5) shutters(g1, h.u, h.w, h.y0, h.y1, kit.shutter, seed, false);
      if (h.storey > 0 && hash2(seed, 5) < 0.3) windowBox(c, f, h.u, h.w, h.y0, seed);
      return;
    }
    case 'shopfront': {
      shopfront(c, f, h, seed);
      return;
    }
    default:
      return;
  }
}

/** A flat arch of wedge stones over an arch opening, keystone 20 % larger, with imposts (§5.3). */
function voussoirs(c: Ctx, f: Face, h: Hole, seed: number): void {
  const g = c.M(1, f.frame);
  g.paint(c.kit.trim, seed);
  const n = 9;
  const span = h.w + 0.5;
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n - 0.5;
    const key = k === (n - 1) / 2;
    g.within(oriented(h.u + t * span, h.y1 + (key ? 0.24 : 0.2), key ? 0.06 : 0.03, 0, 0, -t * 0.7), () =>
      g.box(0, 0, 0, span / n - 0.02, key ? 0.48 : 0.4, key ? 0.12 : 0.07, 0.015, '-z'));
  }
  for (const s of [-1, 1]) {
    g.span(h.u + s * (h.w / 2) - (s > 0 ? 0 : 0.3), h.u + s * (h.w / 2) + (s > 0 ? 0.3 : 0), h.y0, h.y1 - 0.25, -0.03, 0.06, 0.015, '-z');
    g.span(h.u + s * (h.w / 2) - (s > 0 ? 0.02 : 0.4), h.u + s * (h.w / 2) + (s > 0 ? 0.4 : 0.02), h.y1 - 0.25, h.y1, -0.03, 0.12, 0.02, '-z');
  }
}

/** Loading doors: a hoist beam with a pulley, rope and hook above (§5.3). */
function hoist(c: Ctx, f: Face, h: Hole, seed: number): void {
  const g = c.M(1, f.frame);
  const y = h.y1 + 0.75;
  g.paint(c.kit.timber, seed).span(h.u - 0.12, h.u + 0.12, y - 0.12, y + 0.12, -0.2, 1.1, 0.02);
  g.paint(IRON, seed).within(placed(h.u, y - 0.32, 0.95, Math.PI / 2), () => {
    g.within(oriented(0, 0, 0, 0, Math.PI / 2), () => g.lathe([[0.18, -0.04], [0.2, 0], [0.18, 0.04]], 10));
  });
  g.paint(ROPE, seed).tube([new Vector3(h.u, y - 0.3, 1.13), new Vector3(h.u + 0.01, h.y1 - 0.6, 1.12)], 0.025, 4);
  g.paint(IRON, seed).tube([new Vector3(h.u, h.y1 - 0.6, 1.12), new Vector3(h.u, h.y1 - 0.8, 1.12), new Vector3(h.u + 0.1, h.y1 - 0.86, 1.12), new Vector3(h.u + 0.12, h.y1 - 0.74, 1.12)], 0.025, 4);
}

/** Storefront (§5.6): wide glazing grid, stall riser, fascia, striped awning on iron arms, a carved emblem. */
function shopfront(c: Ctx, f: Face, h: Hole, seed: number): void {
  const g1 = c.M(1, f.frame);
  glazing(c, f, h.u, h.w, h.y0 + 0.6, h.y1, seed);
  g1.paint(c.kit.door, seed).span(h.u - h.w / 2, h.u + h.w / 2, h.y0, h.y0 + 0.6, 0, 0.08);
  frameAround(g1, h.u, h.w, h.y0, h.y1, 0.16, 0.14, c.kit.frame, seed, false);
  g1.paint(c.kit.timber, seed).span(h.u - h.w / 2 - 0.3, h.u + h.w / 2 + 0.3, h.y1 + 0.16, h.y1 + 0.55, 0, 0.16, 0.02);
  awning(c, f, h.u, h.w + 0.4, h.y1 + 0.6, 1.6, seed);
}

/** A canvas awning 1.5–2.5 m deep with a scalloped (feather-cut) edge on iron arms (§5.6). */
export function awning(c: Ctx, f: Face, u: number, w: number, y: number, depth: number, seed: number): void {
  const g = c.M(1, f.frame);
  const drop = depth * 0.45;
  g.paint({ mat: 'canvas', tint: c.kit.awning }, seed);
  const a = new Vector3(u - w / 2, y, 0.05);
  const b = new Vector3(u + w / 2, y, 0.05);
  const cc = new Vector3(u + w / 2, y - drop, depth);
  const d = new Vector3(u - w / 2, y - drop, depth);
  g.quad(a, b, cc, d);
  g.quad(d, cc, b, a);
  const n = Math.max(4, Math.round(w / 0.4));
  for (let k = 0; k < n; k++) {
    const x0 = u - w / 2 + (w * k) / n;
    const x1 = x0 + w / n;
    const tip = new Vector3((x0 + x1) / 2, y - drop - 0.22, depth + 0.02);
    g.poly([new Vector3(x0, y - drop, depth), new Vector3(x1, y - drop, depth), tip], new Vector3(0, 0, 1));
    g.poly([new Vector3(x0, y - drop, depth), new Vector3(x1, y - drop, depth), tip], new Vector3(0, 0, -1));
  }
  g.paint(IRON, seed);
  for (const s of [-1, 1]) g.tube([new Vector3(u + s * (w / 2 - 0.1), y - drop - 0.7, 0.03), new Vector3(u + s * (w / 2 - 0.1), y - drop - 0.02, depth - 0.05)], 0.025, 4);
}

function potPlant(c: Ctx, f: Face, u: number, y: number, seed: number): void {
  const g = c.M(0, f.frame);
  g.paint(POT, seed).within(placed(u, y, 0.45, 0), () => g.lathe([[0.18, 0], [0.24, 0.35], [0.27, 0.42], [0.22, 0.42]], 10));
  const gc = c.M(0, f.frame, 'cutout');
  gc.paint({ mat: 'leafCard', tint: 0x9cbf7a }, seed);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI;
    gc.card2(new Vector3(u, y + 0.62, 0.45), new Vector3(Math.cos(a) * 0.28, 0, Math.sin(a) * 0.28), new Vector3(0, 0.26, 0));
  }
}

function seedTrough(c: Ctx, f: Face, u: number, y: number, seed: number): void {
  const g = c.M(0, f.frame);
  g.paint(c.kit.timber, seed).span(u - 0.35, u + 0.35, y, y + 0.28, 0.1, 0.5, 0.02);
  g.paint({ mat: 'gravel', tint: 0xd8c08a }, seed).span(u - 0.3, u + 0.3, y + 0.28, y + 0.31, 0.14, 0.46);
}

export function barrel(g: Mesher, u: number, y: number, z: number, r: number, h: number, seed: number): void {
  g.paint({ mat: 'timber' }, seed).within(placed(u, y, z, 0), () => {
    g.lathe([[r * 0.86, 0], [r, h * 0.25], [r * 1.04, h * 0.5], [r, h * 0.75], [r * 0.86, h]], 10);
    g.disc(0, h - 0.02, 0, r * 0.84, 10, 1);
  });
  g.paint(IRON, seed);
  for (const t of [0.18, 0.82]) g.within(placed(u, y + h * t, z, 0), () => g.lathe([[r * 0.97 + 0.012, -0.03], [r * 0.97 + 0.012, 0.03]], 10));
}

// ── Bays: no unbroken wall over 3 × 3 m (§2.1) ──────────────────────────────────────────────────────────────────

function bays(c: Ctx, f: Face): void {
  const W = f.width / 2;
  const levels = [c.base, ...c.floors].filter((y) => y < f.top - 1.5);
  levels.forEach((fy, k) => {
    const ceil = levels[k + 1] ?? f.top;
    if (ceil - fy < 1.8) return;
    const cut = f.holes.filter((h) => h.y1 > fy + 0.3 && h.y0 < ceil - 0.3).map((h) => [h.u - h.w / 2, h.u + h.w / 2] as const);
    for (const [a, b] of runs(-W + 0.45, W - 0.45, cut, 0.3, 2.2)) {
      const n = Math.max(1, Math.round((b - a) / 3));
      const bw = (b - a) / n;
      for (let j = 0; j < n; j++) {
        const u = a + bw * (j + 0.5);
        if (j > 0 && !c.kit.halfTimber && c.kit.corner !== 'none') pilaster(c, f, a + bw * j, fy, ceil);
        bayFiller(c, f, u, bw, fy, ceil, c.seed + Math.round(u * 13 + fy * 7) + f.side);
      }
    }
  });
}

function pilaster(c: Ctx, f: Face, u: number, y0: number, y1: number): void {
  const g = c.M(2, f.frame);
  g.paint(c.kit.corner === 'quoin' ? c.kit.quoin : c.kit.timber, c.seed + 31).span(u - 0.22, u + 0.22, y0, y1 - 0.02, 0, 0.09, 0.02, '-z');
}

function bayFiller(c: Ctx, f: Face, u: number, bw: number, fy: number, ceil: number, seed: number): void {
  const r = hash2(seed, 1);
  const low = fy - c.base < 0.5;
  const g1 = c.M(1, f.frame);
  if (c.d.style === 'hollow-trunk') {
    if (r < 0.5) ivyPatch(c, f, u, bw, fy, Math.min(ceil, fy + 6), seed);
    else if (!low) nestBoxes(c, f, u, fy + 1.4, seed);
    return;
  }
  if (r < 0.34) {
    // A blind window, shutters closed, with its sill (§5.2 rhythm).
    const w = Math.min(1.1, bw - 0.8);
    const y0 = fy + 1.25;
    const y1 = Math.min(ceil - 0.5, y0 + 1.5);
    frameAround(g1, u, w, y0, y1, 0.1, 0.1, c.kit.frame, seed, false);
    shutters(g1, u, w, y0, y1, c.kit.shutter, seed, true);
    sillBoard(c, g1, u, w, y0, seed);
    head(c, g1, u, w + 0.2, y1 + 0.1, seed);
  } else if (r < 0.55) {
    ivyPatch(c, f, u, bw, fy, Math.min(ceil, fy + 6), seed);
  } else if (r < 0.72 && !low) {
    nestBoxes(c, f, u, fy + 1.4, seed);
  } else if (r < 0.86) {
    wallBracket(g1, u, fy + 2.6, 0.55, seed);
    hangingFeeder(c.M(1, f.frame), u, fy + 2.55, 0.5, seed);
  } else {
    medallion(c, f, u, fy + (ceil - fy) * 0.55, seed);
  }
}

/** Decorative ivy: thin stems with 10–15 cm leaves, climbing from the plinth or hanging from above (§6.2). */
export function ivyPatch(c: Ctx, f: Face, u: number, bw: number, y0: number, y1: number, seed: number): void {
  // Wandering stems climbing from one root, fanning out as they rise; leaves (10–15 cm, in clusters) along them,
  // thinning toward the tips so the patch has a ragged, grown edge.
  const g = c.M(2, f.frame, 'cutout');
  const gs = c.M(1, f.frame);
  gs.paint({ mat: 'bark', tint: 0x8a8060 }, seed);
  const stems = Math.max(3, Math.round(bw / 0.6));
  const root = new Vector3(u + (hash2(seed, 1) - 0.5) * bw * 0.3, y0 + 0.1, 0.04);
  for (let k = 0; k < stems; k++) {
    const spread = ((k + 0.5) / stems - 0.5) * bw * 0.9;
    const top = y0 + (y1 - y0) * (0.5 + hash2(seed, k) * 0.5);
    const pts: Vector3[] = [];
    for (let y = root.y; y <= top; y += 0.5) {
      const t = (y - root.y) / Math.max(0.5, top - root.y);
      pts.push(new Vector3(root.x + spread * Math.sqrt(t) + Math.sin(y * 2.3 + k) * 0.12, y, 0.045));
    }
    if (pts.length > 1) gs.tube(pts, 0.012, 3);
    pts.forEach((p, j) => {
      const t = j / Math.max(1, pts.length - 1);
      const n = t > 0.8 ? 1 : 2;
      for (let q = 0; q < n; q++) {
        const s = 0.13 + hash2(seed, k * 40 + j * 3 + q) * 0.06;
        const a = (hash2(seed, k * 50 + j + q) - 0.5) * 2.2;
        g.paint({ mat: 'leafCard', tint: hash2(seed, k + j * 7 + q) < 0.5 ? 0x6f8f62 : 0x82a070 }, seed + k * 13 + j);
        g.card2(new Vector3(p.x + (q ? 0.14 : -0.12), p.y + 0.15 * q, 0.07 + q * 0.02), new Vector3(Math.cos(a) * s, Math.sin(a) * s, 0.02), new Vector3(-Math.sin(a) * s, Math.cos(a) * s, 0.04));
      }
    });
  }
}

/** Nest boxes: little birdhouses with round holes and perch pegs, clustered on a wall. */
function nestBoxes(c: Ctx, f: Face, u: number, y: number, seed: number): void {
  const g = c.M(1, f.frame);
  const n = 2 + Math.floor(hash2(seed, 4) * 3);
  for (let k = 0; k < n; k++) {
    const x = u + (k - (n - 1) / 2) * 0.55 + (hash2(seed, k) - 0.5) * 0.1;
    const yy = y + (k % 2) * 0.55 + hash2(seed, k + 3) * 0.15;
    g.paint({ mat: 'timber', tint: [0xd8c8a8, 0xa8b89a, 0xc8a890][k % 3] }, seed + k);
    g.span(x - 0.17, x + 0.17, yy, yy + 0.4, 0, 0.26, 0.015);
    g.paint({ mat: 'roofShingle' }, seed + k).within(oriented(x, yy + 0.45, 0.14, 0, -0.25), () => g.box(0, 0, 0, 0.44, 0.04, 0.38));
    g.paint({ mat: 'timberDark', shade: 0.25 }, seed).within(oriented(x, yy + 0.26, 0.265, 0, Math.PI / 2), () => g.lathe([[0.06, 0], [0.06, 0.005]], 8));
    g.paint({ mat: 'timber' }, seed).tube([new Vector3(x, yy + 0.13, 0.26), new Vector3(x, yy + 0.13, 0.4)], 0.015, 4);
  }
}

/** A tray feeder hanging from a bracket: a roofed tray with seed heaped in it (§1.2). */
export function hangingFeeder(g: Mesher, u: number, y: number, z: number, seed: number): void {
  g.paint(ROPE, seed).tube([new Vector3(u, y, z), new Vector3(u, y - 0.35, z)], 0.012, 3);
  g.paint({ mat: 'timber' }, seed).span(u - 0.22, u + 0.22, y - 0.62, y - 0.56, z - 0.16, z + 0.16, 0.01);
  for (const s of [-1, 1]) g.span(u + s * 0.2 - 0.015, u + s * 0.2 + 0.015, y - 0.56, y - 0.38, z - 0.015, z + 0.015);
  g.paint({ mat: 'roofShingle' }, seed).within(oriented(u, y - 0.35, z, 0, 0, 0.35), () => g.box(-0.13, 0, 0, 0.3, 0.03, 0.4));
  g.within(oriented(u, y - 0.35, z, 0, 0, -0.35), () => g.box(0.13, 0, 0, 0.3, 0.03, 0.4));
  g.paint({ mat: 'gravel', tint: 0xe0c890 }, seed).span(u - 0.18, u + 0.18, y - 0.56, y - 0.52, z - 0.13, z + 0.13);
}

/** A carved stone roundel of a bird in flight. */
function medallion(c: Ctx, f: Face, u: number, y: number, seed: number): void {
  const g = c.M(1, f.frame);
  g.paint(c.kit.trim, seed).within(oriented(u, y, 0, 0, Math.PI / 2), () => {
    g.lathe([[0.001, 0.08], [0.5, 0.08], [0.55, 0.04], [0.55, 0]], 10);
  });
  // Body and two swept wings in relief.
  g.within(oriented(u, y, 0.1, 0, 0, 0), () => g.box(0, 0, 0, 0.16, 0.34, 0.06, 0.02));
  for (const s of [-1, 1]) g.within(oriented(u + s * 0.17, y + 0.06, 0.1, 0, 0, s * 0.45), () => g.box(0, 0, 0, 0.34, 0.09, 0.05, 0.015));
}

// ── Roofs ────────────────────────────────────────────────────────────────────────────────────────────────────────

function roof(c: Ctx): void {
  const { d } = c;
  if (d.roof.style === 'gable' || d.roof.style === 'steep') pitched(c);
  else if (d.roof.style === 'flat' || d.roof.style === 'deck') flatRoof(c);
}

/** The building's own frame: origin at the footprint centre on y = 0, x and z along the footprint. */
export const bframe = (c: Ctx): Matrix4 => placed(c.cx, 0, c.cz, c.yaw);

/** Tile courses laid as real overlapping slabs, a capped ridge with sag, chimneys and a nest crown (§5.4). */
function pitched(c: Ctx): void {
  const { d, kit } = c;
  const alongX = d.roof.ridge === 'x';
  const len = alongX ? c.sx : c.sz;
  const run = (alongX ? c.sz : c.sx) / 2;
  const pitch = (d.roof.pitchDeg * Math.PI) / 180;
  const rise = d.roof.top - d.roof.eaves;
  const ov = overhang(d);
  const go = gableOverhang(d);
  const L = run / Math.cos(pitch) + ov / Math.cos(pitch);
  const course = 0.3;
  const n = Math.ceil(L / course);
  // Work in a frame whose x runs along the ridge.
  const rf = bframe(c).multiply(placed(0, 0, 0, alongX ? 0 : Math.PI / 2));
  const g2 = c.M(2, rf);
  for (const side of [-1, 1]) {
    const north = side > 0;
    for (let k = 0; k < n; k++) {
      const s = L - (k + 0.5) * course;
      // Point on the roof plane `s` metres down-slope from the ridge.
      const y = d.roof.top - s * Math.sin(pitch) + 0.035;
      const z = side * s * Math.cos(pitch);
      const moss = north && k < 3 ? 0x9fb08a : 0xffffff;
      const odd = hash2(c.seed + side, k) < 0.06 ? 0.8 : 1;
      g2.paint({ mat: kit.roof.mat, tint: mixTint(kit.roof.tint ?? 0xffffff, moss), shade: odd }, c.seed + k * 3 + side);
      // A touch shallower than the roof, so each course's lower edge stands proud of the next.
      g2.within(oriented(0, y, z, 0, side * (pitch - 0.045)), () => g2.box(0, 0, 0, len + go * 2, 0.05, course + 0.1, 0, ''));
    }
  }
  // Ridge: round cap tiles with a slight sag (§4.4).
  const g1 = c.M(2, rf);
  g1.paint(kit.ridge, c.seed + 40);
  const pts = [-1, -0.5, 0, 0.5, 1].map((t) => new Vector3(t * (len / 2 + go), d.roof.top + 0.08 - (1 - t * t) * 0.04 * (len / 10), 0));
  g1.tube(pts, 0.15, 8);
  // Chimneys on the ridge near the ends (not walkable roofs' middles).
  const chimneys = d.roof.style === 'steep' ? (hash2(c.seed, 41) < 0.5 ? 2 : 1) : 1;
  for (let k = 0; k < chimneys; k++) {
    const x = (k === 0 ? -1 : 1) * (len / 2 - 1.1);
    chimney(c, rf, x, 0, d.roof.eaves, d.roof.top + 1.3 + hash2(c.seed, k) * 0.5, c.seed + 50 + k);
  }
  if (d.roof.nestCrown) {
    const x = (hash2(c.seed, 60) - 0.5) * len * 0.4;
    nest(c.M(2, rf), x, d.roof.top - 0.45, 0, 1.0 + hash2(c.seed, 61) * 0.6, 0.85, c.seed + 62, Math.floor(hash2(c.seed, 63) * 3));
  }
  void rise;
}

function mixTint(a: number, b: number): number {
  const r = (((a >> 16) & 255) * ((b >> 16) & 255)) / 255;
  const g = (((a >> 8) & 255) * ((b >> 8) & 255)) / 255;
  const bl = ((a & 255) * (b & 255)) / 255;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

/** A stack 0.8–1.2 m square with a cap stone, pots, soot on the top 0.5 m, a nest on 1 in 4 (§5.4). */
function chimney(c: Ctx, frame: Matrix4, x: number, z: number, y0: number, y1: number, seed: number): void {
  const g = c.M(2, frame, 'cast');
  const brick = c.kit.wall.mat === 'brick' || c.kit.wall.mat === 'brickBurnt' ? c.kit.wall : { mat: 'brick' as const };
  g.paint(brick, seed).span(x - 0.48, x + 0.48, y0, y1 - 0.5, z - 0.48, z + 0.48, 0.03);
  g.paint(SOOT, seed).span(x - 0.48, x + 0.48, y1 - 0.5, y1, z - 0.48, z + 0.48, 0.03);
  g.paint(c.kit.trim, seed).span(x - 0.6, x + 0.6, y1, y1 + 0.14, z - 0.6, z + 0.6, 0.03);
  const pots = 1 + Math.floor(hash2(seed, 1) * 3);
  g.paint(POT, seed);
  for (let k = 0; k < pots; k++) {
    const px = x + (k - (pots - 1) / 2) * 0.32;
    g.within(placed(px, y1 + 0.14, z, 0), () => {
      g.lathe([[0.13, 0], [0.11, 0.28], [0.14, 0.38], [0.1, 0.4]], 8);
    });
  }
  if (hash2(seed, 2) < 0.25) nest(c.M(1, frame), x, y1 + 0.14, z, 0.55, 0.4, seed + 3, 1, 10);
}

/** Flat roofs: dressing kept to the parapet edge (§5.7), a chimney stack, a nest crown in a corner. */
function flatRoof(c: Ctx): void {
  const { d } = c;
  const top = d.roof.top;
  const f = bframe(c);
  const hx = c.sx / 2 - 0.9;
  const hz = c.sz / 2 - 0.9;
  if (hx < 0.6 || hz < 0.6) return;
  const corners: [number, number][] = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
  const start = Math.floor(hash2(c.seed, 70) * 4);
  const pick = (k: number): [number, number] => corners[(start + k) % 4]!;
  const [nx, nz] = pick(0);
  if (d.roof.nestCrown) nest(c.M(2, f), nx * 0.92, top, nz * 0.92, 0.9 + hash2(c.seed, 71) * 0.5, 0.75, c.seed + 72, 1 + Math.floor(hash2(c.seed, 73) * 2));
  const [cx, cz] = pick(1);
  if (d.style !== 'woven-reed' && d.style !== 'hollow-trunk' && hash2(c.seed, 74) < 0.7) chimney(c, f, cx + Math.sign(cx) * 0.4, cz + Math.sign(cz) * 0.4, top, top + 2 + hash2(c.seed, 75) * 0.6, c.seed + 76);
  const area = c.sx * c.sz;
  const items = Math.max(2, Math.ceil((area / 50) * 3) - 2);
  const g = c.M(1, f);
  for (let k = 0; k < items; k++) {
    // Along the edges, between the corners.
    const t = (k + 0.5) / items;
    const per = 2 * (hx * 2 + hz * 2);
    let p = t * per;
    let x: number;
    let z: number;
    let yaw: number;
    if (p < 2 * hx) { x = -hx + p; z = -hz; yaw = 0; } else if ((p -= 2 * hx) < 2 * hz) { x = hx; z = -hz + p; yaw = -Math.PI / 2; } else if ((p -= 2 * hz) < 2 * hx) { x = hx - p; z = hz; yaw = Math.PI; } else { p -= 2 * hx; x = -hx; z = hz - p; yaw = Math.PI / 2; }
    if (corners.some(([a, b]) => Math.hypot(a - x, b - z) < 1.6)) continue;
    roofItem(c, g, x, top, z, yaw, c.seed + 80 + k);
  }
}

/** One rooftop dressing piece: water butt, seed store, perch frame, garden box, washing line of feathers, lantern. */
function roofItem(c: Ctx, g: Mesher, x: number, y: number, z: number, yaw: number, seed: number): void {
  const r = hash2(seed, 1);
  g.at(x, y, z, yaw, () => {
    if (r < 0.2) {
      barrel(g, 0, 0, 0, 0.42, 1.0, seed);
    } else if (r < 0.4) {
      // Seed store: a lidded bin with a scoop.
      g.paint({ mat: 'timber' }, seed).span(-0.5, 0.5, 0, 0.9, -0.35, 0.35, 0.03);
      g.within(oriented(0, 0.95, 0, 0, 0.08), () => g.paint({ mat: 'timberDark' }, seed).box(0, 0, 0, 1.1, 0.08, 0.8, 0.02));
      g.paint(IRON, seed).span(-0.06, 0.06, 0.6, 0.75, 0.35, 0.38);
    } else if (r < 0.6) {
      // Perch frame: two posts and three dowels.
      g.paint({ mat: 'timber' }, seed);
      for (const s of [-1, 1]) g.span(s * 0.8 - 0.05, s * 0.8 + 0.05, 0, 1.6, -0.05, 0.05);
      for (const h of [0.7, 1.1, 1.5]) g.tube([new Vector3(-0.85, h, 0), new Vector3(0.85, h, 0)], 0.03, 5);
    } else if (r < 0.75) {
      // Garden box with herbs.
      g.paint({ mat: 'timber' }, seed).span(-0.7, 0.7, 0, 0.45, -0.3, 0.3, 0.02);
      g.paint({ mat: 'earth' }, seed).span(-0.65, 0.65, 0.45, 0.47, -0.25, 0.25);
      const gc = c.M(1, g.frame.clone(), 'cutout');
      gc.paint({ mat: 'leafCard', tint: 0x9cbf7a }, seed);
      for (let k = 0; k < 4; k++) gc.card2(new Vector3(-0.5 + k * 0.33, 0.68, 0), new Vector3(0.22, 0, 0.1 * (k % 2 ? 1 : -1)), new Vector3(0, 0.22, 0));
    } else if (r < 0.9) {
      // Washing line strung with feathers.
      g.paint({ mat: 'timber' }, seed);
      for (const s of [-1, 1]) g.span(s * 1.2 - 0.04, s * 1.2 + 0.04, 0, 1.7, -0.04, 0.04);
      const pts: Vector3[] = [];
      for (let k = 0; k <= 6; k++) pts.push(new Vector3(-1.2 + (2.4 * k) / 6, 1.62 - Math.sin((k / 6) * Math.PI) * 0.12, 0));
      g.paint(ROPE, seed).tube(pts, 0.012, 3);
      const gc = c.M(1, g.frame.clone(), 'cutout');
      for (let k = 1; k < 6; k++) {
        gc.paint({ mat: 'featherCard', tint: [0xf0e8d8, 0xc9bc9c, 0xb8c4c8][k % 3] }, seed + k);
        gc.card2(new Vector3(-1.2 + (2.4 * k) / 6, 1.38 - Math.sin((k / 6) * Math.PI) * 0.12, 0), new Vector3(0.07, 0, 0), new Vector3(0, 0.22, 0));
      }
    } else {
      lanternPost(g, 0, 0, 0, 2.1, seed);
    }
  });
}

/** A lantern on a post with a curled bracket (emissive glass, §10.3). */
export function lanternPost(g: Mesher, x: number, y: number, z: number, h: number, seed: number): void {
  g.paint({ mat: 'timberDark' }, seed).span(x - 0.06, x + 0.06, y, y + h, z - 0.06, z + 0.06, 0.015);
  g.paint(IRON, seed).tube([new Vector3(x, y + h - 0.1, z), new Vector3(x + 0.18, y + h + 0.05, z), new Vector3(x + 0.38, y + h - 0.02, z)], 0.02, 4);
  lantern(g, x + 0.38, y + h - 0.12, z, seed);
}

/** A hanging lantern: iron cage, warm glass (emissive), small roof. */
export function lantern(g: Mesher, x: number, y: number, z: number, seed: number): void {
  g.paint({ mat: 'lantern' }, seed).span(x - 0.09, x + 0.09, y - 0.32, y - 0.06, z - 0.09, z + 0.09);
  g.paint(IRON, seed);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) g.span(x + sx * 0.1 - 0.012, x + sx * 0.1 + 0.012, y - 0.34, y - 0.04, z + sz * 0.1 - 0.012, z + sz * 0.1 + 0.012);
  g.span(x - 0.12, x + 0.12, y - 0.38, y - 0.33, z - 0.12, z + 0.12);
  g.within(placed(x, y - 0.06, z, Math.PI / 4), () => g.lathe([[0.17, 0], [0.001, 0.14]], 4));
}

// ── Balconies and landing boards ────────────────────────────────────────────────────────────────────────────────

/** The face of the building a volume stands out from, as a wall frame at that face, and the volume in it. */
function frameFor(c: Ctx, v: BoxVolume): { f: Matrix4; u0: number; u1: number; depth: number; y: number; top: number } | null {
  const best = c.faces.map((f) => {
    const n = new Vector3(Math.sin(f.yaw), 0, Math.cos(f.yaw));
    const d = (v.centre.x - f.cx) * n.x + (v.centre.z - f.cz) * n.z;
    return { f, d };
  }).sort((a, b) => b.d - a.d)[0];
  if (!best || best.d <= 0) return null;
  const f = best.f;
  const along = new Vector3(Math.cos(f.yaw), 0, -Math.sin(f.yaw));
  const u = (v.centre.x - f.cx) * along.x + (v.centre.z - f.cz) * along.z;
  // Size along the face: whichever of the volume's horizontal axes lines up with `along`.
  const alongIsX = Math.abs(along.x * Math.cos(v.yaw) - along.z * Math.sin(v.yaw)) > 0.7;
  const wAlong = alongIsX ? v.size.x : v.size.z;
  const depth = alongIsX ? v.size.z : v.size.x;
  return { f: f.frame, u0: u - wAlong / 2, u1: u + wAlong / 2, depth, y: v.centre.y - v.size.y / 2, top: v.centre.y + v.size.y / 2 };
}

/** Balconies (§5.5): slab fascia, knee braces every 1.5–2 m, a woven or fretwork rail panel, a seed box on some. */
function balcony(c: Ctx, v: BoxVolume): void {
  const at = frameFor(c, v);
  if (!at) return;
  const { f, u0, u1, depth, y } = at;
  const floor = y + 0.4;
  const seed = c.seed + Math.round(u0 * 17 + y * 3);
  const g2 = c.M(2, f);
  const g1 = c.M(1, f);
  g2.paint(c.kit.timber, seed).span(u0 - 0.03, u1 + 0.03, y - 0.03, floor + 0.02, depth - 0.04, depth + 0.04, 0.015);
  const n = Math.max(2, Math.round((u1 - u0) / 1.7) + 1);
  for (let k = 0; k < n; k++) {
    const u = u0 + 0.15 + ((u1 - u0 - 0.3) * k) / (n - 1);
    g1.paint(c.kit.timber, seed + k).within(oriented(u, y - 0.55, 0.62, 0, -0.75), () => g1.box(0, 0, 0, 0.12, 0.12, 1.5, 0.02));
    g1.span(u - 0.07, u + 0.07, y - 1.15, y, 0, 0.12, 0.015, '-z');
  }
  // The rail is a solid 0.5 m-thick prim on the outer edge: cap it and face both sides with a woven panel.
  const style = hash2(seed, 1);
  const rail = { z0: depth - 0.5, z1: depth };
  g2.paint(c.kit.timber, seed + 2).span(u0 - 0.05, u1 + 0.05, floor + 1.0, floor + 1.09, rail.z0 - 0.05, rail.z1 + 0.05, 0.02);
  const panel: Paint = style < 0.5 ? TWIG : c.kit.frame;
  const posts = Math.max(2, Math.round((u1 - u0) / 1.5) + 1);
  for (const zf of [rail.z1 + PROUD.skin, rail.z0 - PROUD.skin]) {
    const out = zf > rail.z0 ? 1 : -1;
    g2.paint(panel, seed + 3).poly([new Vector3(u0, floor, zf), new Vector3(u1, floor, zf), new Vector3(u1, floor + 1, zf), new Vector3(u0, floor + 1, zf)], new Vector3(0, 0, out));
    g1.paint(c.kit.timber, seed + 4);
    for (let k = 0; k < posts; k++) {
      const u = u0 + 0.06 + ((u1 - u0 - 0.12) * k) / (posts - 1);
      g1.span(u - 0.06, u + 0.06, floor, floor + 1.0, zf - (out > 0 ? 0 : 0.05), zf + (out > 0 ? 0.05 : 0), 0.01);
    }
    if (style >= 0.5) {
      // Fretwork: a row of carved feather leaves between the posts.
      g1.paint(c.kit.frame, seed + 5);
      for (let u = u0 + 0.25; u < u1 - 0.2; u += 0.5) {
        g1.within(oriented(u, floor + 0.5, zf, 0, 0, 0.5), () => g1.box(0, 0, 0, 0.08, 0.5, 0.06));
      }
    }
  }
  // A perch peg row and, on some, a seed box on the rail.
  g1.paint({ mat: 'timber' }, seed + 6);
  for (let u = u0 + 0.4; u < u1 - 0.3; u += 0.7) g1.tube([new Vector3(u, floor + 0.85, depth), new Vector3(u, floor + 0.85, depth + 0.2)], 0.025, 4);
  if (hash2(seed, 7) < 0.4) windowBoxOn(c, f, (u0 + u1) / 2, Math.min(1.4, u1 - u0 - 0.4), floor + 1.09, depth - 0.25, seed);
}

function windowBoxOn(c: Ctx, f: Matrix4, u: number, w: number, y: number, z: number, seed: number): void {
  const g = c.M(1, f);
  g.paint(POT, seed).span(u - w / 2, u + w / 2, y, y + 0.22, z - 0.18, z + 0.18, 0.02);
  const gc = c.M(0, f, 'cutout');
  gc.paint({ mat: 'leafCard', tint: 0x9cbf7a }, seed);
  for (let k = 0; k < Math.round(w / 0.25); k++) gc.card2(new Vector3(u - w / 2 + 0.12 + k * 0.25, y + 0.38, z), new Vector3(0.16, 0, 0.04), new Vector3(0, 0.16, 0));
}

/** Landing boards (§1.4): pale worn planks with a lighter front edge, brackets under, a woven mat on some. */
function landing(c: Ctx, v: BoxVolume): void {
  const at = frameFor(c, v);
  if (!at) return;
  const { f, u0, u1, depth, top, y } = at;
  const seed = c.seed + Math.round(u0 * 7 + top * 11);
  const g2 = c.M(2, f);
  const n = Math.max(3, Math.round((u1 - u0) / 0.42));
  for (let k = 0; k < n; k++) {
    const a = u0 + ((u1 - u0) * k) / n + 0.01;
    const b = u0 + ((u1 - u0) * (k + 1)) / n - 0.01;
    g2.paint(LANDING, seed + k).span(a, b, top - 0.06, top + 0.015, 0.02, depth + 0.04, 0.012);
  }
  g2.paint({ mat: 'boards', tint: 0xfff6e8, shade: 1.08 }, seed).span(u0, u1, top - 0.09, top + 0.02, depth + 0.02, depth + 0.07, 0.015);
  const g1 = c.M(1, f);
  g1.paint(c.kit.timber, seed);
  for (const u of [u0 + 0.3, u1 - 0.3]) g1.within(oriented(u, y - 0.25, depth * 0.45, 0, -0.8), () => g1.box(0, 0, 0, 0.1, 0.1, depth * 1.1, 0.015));
  if (hash2(seed, 2) < 0.5) {
    g1.paint(TWIG, seed).span(u0 + 0.25, u1 - 0.25, top + 0.015, top + 0.04, 0.12, depth - 0.1);
  }
}

// ── Birds' use of the town (§1, D-EP-048) ────────────────────────────────────────────────────────────────────────

const DROPPINGS = { mat: 'plaster', tint: 0xf4f0e8, shade: 1.05 } as const;
const STRAW_TUFT = { mat: 'thatch', tint: 0xf0dca8 } as const;

/** A tuft of straw and twigs poking out of a gap: nest material showing (gutters, holes, eaves). */
export function tuft(g: Mesher, x: number, y: number, z: number, out: number, seed: number): void {
  for (let k = 0; k < 4; k++) {
    const a = (hash2(seed, k) - 0.5) * 1.6;
    const l = 0.18 + hash2(seed, k + 4) * 0.22;
    g.paint(k % 2 ? TWIG : STRAW_TUFT, seed + k).tube([new Vector3(x, y, z), new Vector3(x + Math.sin(a) * l, y + 0.04 + hash2(seed, k + 8) * 0.12, z + out * Math.cos(a) * l)], [0.014, 0.004], 3);
  }
}

/** A faint pale streak under a ledge (§1.4: at most a speckle, never on floors). */
function streak(g: Mesher, u: number, y: number, seed: number): void {
  const l = 0.25 + hash2(seed, 1) * 0.35;
  g.paint(DROPPINGS, seed).poly([new Vector3(u - 0.025, y - l, PROUD.skin + 0.004), new Vector3(u + 0.025, y - l * 0.7, PROUD.skin + 0.004), new Vector3(u + 0.035, y, PROUD.skin + 0.004), new Vector3(u - 0.035, y, PROUD.skin + 0.004)], new Vector3(0, 0, 1));
}

/**
 * On every street face: nest holes with straw under the eaves, a cluster of nest boxes, twigs poking out of the
 * gutters, perch dowels and the odd streak under sills, a feeder on a bracket and seed by some doors, and the
 * perches ambient birds sit on.
 */
function birdLife(c: Ctx, f: Face): void {
  const W = f.width / 2;
  const { d } = c;
  const pitched = (d.roof.style === 'gable' || d.roof.style === 'steep') && !f.gable;
  const busy = (u: number, y0: number, y1: number): boolean => f.holes.some((h) => Math.abs(h.u - u) < h.w / 2 + 0.4 && h.y1 > y0 && h.y0 < y1);
  const g1 = c.M(1, f.frame);
  const g0 = c.M(0, f.frame);
  const seed = c.seed + f.side * 977;
  // Street faces (looking onto a lane or a jungle path) get the full set; back faces only the eaves holes.
  const px = f.cx + Math.sin(f.yaw) * 6;
  const pz = f.cz + Math.cos(f.yaw) * 6;
  const street = c.w.map.lanes.some((l) => distToPath(l.path, px, pz) < l.halfWidth + 12) || (c.w.map.jungle ?? []).some((j) => j.paths.some((p) => distToPath(p, px, pz) < 9));
  // Nest holes in a row under the eaves; a straw tuft from one in three.
  const ey = (f.gable ? d.roof.eaves : f.top) - (pitched ? 0.45 : 0.8);
  for (let u = -W + 1.1; u < W - 0.9; u += street ? 2.4 : 3.6) {
    if (busy(u, ey - 0.4, ey + 0.3) || ey < c.base + 2.5) continue;
    g1.paint({ mat: 'timberDark', shade: 0.12 }, seed);
    const pts: Vector3[] = [];
    for (let k = 0; k < 8; k++) pts.push(new Vector3(u + Math.cos((k / 8) * Math.PI * 2) * 0.075, ey + Math.sin((k / 8) * Math.PI * 2) * 0.075, PROUD.skin + 0.006));
    g1.poly(pts, new Vector3(0, 0, 1));
    g1.paint({ mat: 'timber' }, seed).tube([new Vector3(u, ey - 0.16, 0.02), new Vector3(u, ey - 0.16, 0.2)], 0.015, 4);
    if (hash2(seed, u) < 0.34) tuft(g0, u, ey - 0.03, 0.05, 1, seed + Math.round(u * 10));
    if (hash2(seed, u + 1) < 0.5) streak(g0, u, ey - 0.2, seed + Math.round(u));
    c.w.perch(f.frame, u, ey - 0.14, 0.17, 0);
  }
  // A cluster of nest boxes high on wide faces.
  if (street && f.width > 5 && ey > c.base + 3.5) {
    const u = (hash2(seed, 2) - 0.5) * (f.width - 3);
    if (!busy(u, ey - 1.6, ey - 0.3)) nestBoxCluster(c, f, u, ey - 1.5, seed);
  }
  // Twigs and straw out of the gutters (pitched eaves).
  if (pitched) {
    const tan = Math.tan((d.roof.pitchDeg * Math.PI) / 180);
    const ov = overhang(d);
    const gy = d.roof.eaves - ov * tan - 0.15;
    for (let u = -W + 0.8; u < W; u += (street ? 2.6 : 4.5) + hash2(seed, u) * 1.2) {
      tuft(g1, u, gy, ov + 0.1, 1, seed + Math.round(u * 7));
      if (hash2(seed, u + 3) < 0.5) c.w.perch(f.frame, u + 0.3, gy + 0.08, ov + 0.12, 0);
    }
  }
  for (const h of street ? f.holes : []) {
    const hs = seed + Math.round(h.u * 31 + h.y0 * 7);
    if (h.kind === 'mark-window' || h.kind === 'window') {
      // A perch dowel under the sill, the odd streak below it; birds sit on sills.
      g1.paint({ mat: 'timber' }, hs).tube([new Vector3(h.u - h.w / 2, h.y0 - 0.2, 0.18), new Vector3(h.u + h.w / 2, h.y0 - 0.2, 0.18)], 0.02, 4);
      if (hash2(hs, 1) < 0.4) streak(g0, h.u + (hash2(hs, 2) - 0.5) * h.w * 0.6, h.y0 - 0.26, hs);
      if (hash2(hs, 3) < 0.6) c.w.perch(f.frame, h.u + (hash2(hs, 4) - 0.5) * h.w * 0.7, h.y0 + 0.0, 0.08, 0);
    } else if ((h.kind === 'door' || h.kind === 'mark-door') && h.storey === 0) {
      const side = hash2(hs, 5) < 0.5 ? 1 : -1;
      const u = h.u + side * (h.w / 2 + 0.75);
      if (hash2(hs, 6) < 0.6 && !busy(u, h.y0 + 2, h.y0 + 2.8)) {
        wallBracket(g1, u, h.y0 + 2.7, 0.55, hs);
        hangingFeeder(g1, u, h.y0 + 2.65, 0.5, hs);
        c.w.perch(f.frame, u + 0.2, h.y0 + 2.08, 0.5, Math.PI / 2);
      }
      if (hash2(hs, 7) < 0.45) {
        const su = h.u - side * (h.w / 2 + 0.6);
        doorSacks(g1, su, h.y0, hs);
      }
    }
  }
}

function doorSacks(g: Mesher, u: number, y: number, seed: number): void {
  g.paint({ mat: 'canvas', tint: 0xc8b48c }, seed).within(placed(u, y, 0.42, hash2(seed, 1) * 3), () => {
    g.lathe([[0.2, 0], [0.26, 0.15], [0.25, 0.42], [0.2, 0.55], [0.22, 0.58], [0.19, 0.56]], 8);
  });
  g.paint({ mat: 'gravel', tint: 0xe0c890 }, seed).within(placed(u, y + 0.5, 0.42, 0), () => g.lathe([[0.18, 0], [0.001, 0.06]], 8));
  g.paint({ mat: 'gravel', tint: 0xe0c890 }, seed + 1).within(placed(u + 0.35, y, 0.6, 0), () => g.lathe([[0.32, 0], [0.18, 0.03], [0.001, 0.04]], 8));
}

function nestBoxCluster(c: Ctx, f: Face, u: number, y: number, seed: number): void {
  const g = c.M(1, f.frame);
  const n = 2 + Math.floor(hash2(seed, 4) * 2);
  for (let k = 0; k < n; k++) {
    const x = u + (k - (n - 1) / 2) * 0.55;
    const yy = y + (k % 2) * 0.35;
    g.paint({ mat: 'timber', tint: [0xd8c8a8, 0xa8b89a, 0xc8a890][k % 3] }, seed + k).span(x - 0.17, x + 0.17, yy, yy + 0.4, 0, 0.26);
    g.paint({ mat: 'roofShingle' }, seed + k).within(oriented(x, yy + 0.45, 0.14, 0, -0.25), () => g.box(0, 0, 0, 0.44, 0.04, 0.38));
    g.paint({ mat: 'timberDark', shade: 0.12 }, seed).poly(Array.from({ length: 8 }, (_, j) => new Vector3(x + Math.cos((j / 8) * Math.PI * 2) * 0.06, yy + 0.26 + Math.sin((j / 8) * Math.PI * 2) * 0.06, 0.265)), new Vector3(0, 0, 1));
    g.paint({ mat: 'timber' }, seed).tube([new Vector3(x, yy + 0.13, 0.26), new Vector3(x, yy + 0.13, 0.4)], 0.015, 4);
    c.w.perch(f.frame, x, yy + 0.49, 0.14, 0);
  }
}

/** Roofs as places birds live: perches along ridges and copings, woven rooftop rooms and ridge turrets. */
function roofLife(c: Ctx): void {
  const { d } = c;
  const f = bframe(c);
  const seed = c.seed + 4441;
  if (d.roof.style === 'gable' || d.roof.style === 'steep') {
    const alongX = d.roof.ridge === 'x';
    const len = alongX ? c.sx : c.sz;
    for (let k = 0; k < 4; k++) {
      const t = (hash2(seed, k) - 0.5) * len * 0.8;
      c.w.perch(f, alongX ? t : 0, d.roof.top + 0.22, alongX ? 0 : t, alongX ? Math.PI / 2 : 0);
    }
    if (hash2(seed, 9) < 0.4) {
      // A woven turret astride the ridge near one end: a bird-built room with its round door and landing mat.
      const t = (hash2(seed, 10) < 0.5 ? -1 : 1) * (len / 2 - 2.2);
      wovenRoom(c.M(2, f), alongX ? t : 0, d.roof.top - 0.5, alongX ? 0 : t, 0.85, 1.4, seed);
    }
    return;
  }
  if (d.roof.style !== 'flat') return;
  const top = d.roof.top;
  const hx = c.sx / 2 - 1.4;
  const hz = c.sz / 2 - 1.4;
  if (hx < 1 || hz < 1) return;
  for (let k = 0; k < 4; k++) {
    const a = hash2(seed, k + 20) * Math.PI * 2;
    c.w.perch(f, Math.cos(a) * (c.sx / 2 - 0.25), top + 0.95, Math.sin(a) * (c.sz / 2 - 0.25), a);
  }
  if (hash2(seed, 11) < 0.55) {
    // A woven rooftop room in the corner opposite the nest crown.
    const corners: [number, number][] = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
    const [x, z] = corners[(Math.floor(hash2(c.seed, 70) * 4) + 2) % 4]!;
    wovenRoom(c.M(2, f), x * 0.9, top, z * 0.9, 1.1, 1.6, seed);
  }
}

/** A woven dome room (§1.1 bird-built additions): a twig dome with a round door, a lip and a landing mat. */
export function wovenRoom(g: Mesher, x: number, y: number, z: number, r: number, h: number, seed: number): void {
  const yaw = hash2(seed, 1) * Math.PI * 2;
  g.within(placed(x, y, z, yaw), () => {
    g.paint(TWIG, seed).lathe([[r, 0], [r * 1.05, h * 0.3], [r * 0.9, h * 0.7], [r * 0.5, h * 0.95], [0.001, h]], 10);
    // Woven bands round it.
    g.paint({ mat: 'twig', shade: 0.8 }, seed).lathe([[r * 1.07, h * 0.28], [r * 1.09, h * 0.33], [r * 1.07, h * 0.38]], 10);
    g.paint({ mat: 'timberDark', shade: 0.1 }, seed).poly(Array.from({ length: 10 }, (_, j) => new Vector3(Math.cos((j / 10) * Math.PI * 2) * r * 0.32, h * 0.42 + Math.sin((j / 10) * Math.PI * 2) * r * 0.32, r * 1.02 + 0.01)), new Vector3(0, 0, 1));
    g.paint(TWIG, seed + 1).tube(Array.from({ length: 11 }, (_, j) => new Vector3(Math.cos((j / 10) * Math.PI * 2) * r * 0.36, h * 0.42 + Math.sin((j / 10) * Math.PI * 2) * r * 0.36, r * 1.02)), 0.05, 4);
    g.paint(LANDING, seed).span(-r * 0.4, r * 0.4, h * 0.42 - r * 0.36 - 0.06, h * 0.42 - r * 0.36, r, r + 0.24);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2;
      g.paint(TWIG, seed + k).tube([new Vector3(Math.cos(a) * r * 0.5, h * 0.92, Math.sin(a) * r * 0.5), new Vector3(Math.cos(a) * r * 0.9, h * 1.15, Math.sin(a) * r * 0.9)], [0.025, 0.006], 3);
    }
  });
}

export { UP, WALL, PLINTH };
export type { FacadeMark };
