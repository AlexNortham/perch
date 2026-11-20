/* eslint-disable @typescript-eslint/no-magic-numbers -- authored proportions: the numbers are the sculpture */
/**
 * Structure models (GDD §7.2–§7.7, style guide §9; D-ART-014): monuments the town built for its flock.
 * - Sentinel Hawk: a bronze hawk, wings half open, on a feather-fluted column with a capital of wing plates, a
 *   stepped base with offerings, lanterns and banners.
 * - Stilt Heron: a pale stone heron with jointed timber legs in a braced timber frame with rope lashings and metal caps,
 *   a hanging lantern and banners.
 * - Nest Wardens: paired gate posts of living branches wound round a core, mossy, leafy, crowned with carved owl faces
 *   whose eyes glow; a woven arch with the flock's banner between them.
 * - Roost Shrine: a ringed stone pillar with a glowing core, metal rings that turn, a crown, and a floor circle 12 m
 *   across (the pulse radius).
 * - Patron: the Elder Raven (Dawn) or the Great Owl (Dusk), a sculpted bird on a carved perch and a stepped dais, with
 *   crowned posts, pillars with banners and lanterns; phase two darkens it, splits glowing seams and rags its plumes.
 * Team identity: Dawn sandstone, brass, amber glow, sun discs and rays; Dusk granite, pewter, violet glow, crescents and
 * stars (§9.2). Each level of detail is two geometries: the architecture (the material library: one draw call) and the
 * statue (the bird solid material with a state glow: one draw call); a Shrine adds its turning rings. Damage stages (66 %
 * and 33 % HP) add cracks and chips and tear the banners; destroyed, the architecture is rubble and the statue falls
 * (rigs/structure-rig.ts). Towers stay at or below STRUCTURE.towerMaxHeight (the 12 m Updraft passes above).
 */
import { BufferGeometry, CatmullRomCurve3, CylinderGeometry, DodecahedronGeometry, Euler, ExtrudeGeometry, Float32BufferAttribute, IcosahedronGeometry, Matrix4, Quaternion, RingGeometry, Shape, SphereGeometry, TorusGeometry, TubeGeometry, Vector3 } from 'three';
import type { StructureType } from '../../../sim/core/contracts';
import { bakeAO } from '../materials';
import type { MaterialId } from '../materials';
import type { TeamColours } from '../palette';
import { beak, foot } from './anatomy';
import type { LegStyle } from './anatomy';
import { STRUCTURE as S } from './constants';
import { CARD, TILE } from './feathers';
import { Parts } from './parts';
import { jitter, mix, Sculpt, shade } from './sculpt';
import type { Finish, Surface, V3 } from './sculpt';
import { detail } from './sculpted';
import type { Level } from './sculpted';
import { Field } from './sdf';
import { paintSkin } from './skin';
import type { RegionStyle } from './skin';
import { WORLD_BODIES } from './world-bodies';
import type { WorldBody } from './world-bodies';
import { featherFan, featherWing, glowEye, Masonry, STATE_GLOW, StaticMesh } from './world-mesh';
import { worldSkin } from './world-skins';

/** Levels of detail: full from 0 m, 40 % of it from 40 m, 15 % from 90 m (style guide §11.3), 10 % hysteresis. */
export const STRUCTURE_LOD = { from: [0, 40, 90], hysteresis: 0.1 } as const;
export type Lod = 0 | 1 | 2;
/** Whole, cracked (below 66 % HP), broken (below 33 %), and the rubble left when it falls. */
export type Damage = 0 | 1 | 2 | 3;
export const DAMAGE_AT = [0.66, 0.33] as const;

/** Heron leg poses: standing, left leg raised, right leg raised. Patron variants: phase one, phase two. */
export const HERON_POSES = 3;

/** How the statue falls when the structure is destroyed: where it comes to rest (rig frame) and how long it takes. */
export interface Fall {
  readonly to: V3;
  readonly rot: V3;
  /** The point it pivots about while it tips (rig frame). */
  readonly pivot: V3;
  readonly time: number;
}

export interface StructureBuild {
  /** The architecture at a level of detail and damage stage (3: rubble), for the library's opaque material. */
  arch(lod: Lod, damage: Damage): BufferGeometry;
  /** The statue at a level of detail: a Heron pose (0–2), or a Patron phase (0, 1). */
  statue(lod: Lod, variant: number): BufferGeometry;
  /** A Shrine's turning rings (library material). */
  readonly rings?: (lod: Lod) => BufferGeometry;
  /** Patron heart-feather (centred on its own origin, fits a sphere of radius 1), drawn unlit. */
  readonly heart?: BufferGeometry;
  readonly fall: Fall;
  /** Topmost point of the visible geometry (m above the base). */
  readonly height: number;
  /** Brood Ward dome: radius and centre height. */
  readonly dome: { readonly radius: number; readonly y: number };
}

export interface StructureBody {
  readonly radius: number;
  readonly height: number;
}

const dome = (b: StructureBody, height: number): StructureBuild['dome'] => ({ radius: Math.hypot(b.radius, height / 2) * 1.05, y: height / 2 });

// ---------------------------------------------------------------------------------------------------------------
// Flock identity (§9.2).

interface Flock {
  readonly dawn: boolean;
  readonly glow: number;
  readonly light: number;
  readonly metal: MaterialId;
  /** Gold leaf or silver on the statues (bills, talons, crowns). */
  readonly gild: number;
  /** Library tints: banner canvas (faded flock) and the floor circle. */
  readonly banner: number;
  readonly floor: number;
  readonly stone: MaterialId;
}

const flockOf = (team: TeamColours, dusk: boolean): Flock => ({
  dawn: !dusk,
  glow: team.primary,
  light: team.light,
  metal: dusk ? 'pewter' : 'brass',
  gild: dusk ? 0xb4b9c8 : 0xd0a447,
  banner: dusk ? 0x8282d4 : 0xcf9e5e,
  floor: dusk ? 0x9a98d0 : 0xe2bf8a,
  stone: dusk ? 'granite' : 'sandstone',
});

/** Segments scaled to a level of detail. */
const LOD_SEGMENTS = [1, 0.5, 0.26] as const;
const seg = (base: number, lod: Lod, min = 3): number => Math.max(min, Math.round(base * LOD_SEGMENTS[lod]));
const at = (x: number, y: number, z: number): Matrix4 => new Matrix4().makeTranslation(x, y, z);
const place = (p: V3, rot: V3 = [0, 0, 0], s: V3 = [1, 1, 1]): Matrix4 => new Matrix4().compose(new Vector3(...p), new Quaternion().setFromEuler(new Euler(...rot)), new Vector3(...s));
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------------------------------------------
// Architecture pieces (the material library).

/** A stepped, chamfered base: steps of (radius, rise) from the ground up, `sides` round (8: octagonal). */
function steps(m: Masonry, list: readonly (readonly [number, number])[], id: MaterialId, sides: number, seed: number, y0 = 0): number {
  const c = 0.03;
  const prof: [number, number][] = [[0, y0]];
  let y = y0;
  for (const [r, h] of list) {
    prof.push([r, y], [r, y + h - c], [r - c, y + h]);
    y += h;
  }
  prof.push([0, y]);
  m.lathe(prof, id, new Vector3(0, 0, 0), sides, { seed, scale: 0.8 });
  return y;
}

/** A column shaft from y0 to y1, radius r0 → r1, with `flutes` feather flutes: a groove with a raised rachis each,
 * closing to a rounded feather tip near the top and a round end at the foot. */
function featherShaft(r0: number, r1: number, y0: number, y1: number, flutes: number, lod: Lod): BufferGeometry {
  const sub = lod === 0 ? 6 : lod === 1 ? 2 : 1;
  const cols = flutes * sub;
  const rows = lod === 0 ? 16 : lod === 1 ? 8 : 2;
  const h = y1 - y0;
  const depth = lod === 2 ? 0 : 0.11 * r0;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= rows; j++) {
    const v = j / rows;
    const R = r0 + (r1 - r0) * v + 0.025 * r0 * Math.sin(Math.PI * v);
    const tip = smooth(0.82, 0.95, v);
    const foot = 1 - smooth(0.02, 0.07, v);
    for (let i = 0; i <= cols; i++) {
      const u = (i % sub) / sub;
      const w = Math.abs(u - 0.5) * 2;
      const groove = Math.pow(Math.sin(Math.PI * u), 0.6) - 0.6 * Math.exp(-(((u - 0.5) / 0.09) ** 2));
      const open = smooth(0, 0.25, 1 - w - tip) * smooth(0, 0.25, 1 - w - foot);
      const r = R - depth * groove * open;
      const a = (i / cols) * Math.PI * 2;
      pos.push(Math.sin(a) * r, y0 + v * h, Math.cos(a) * r);
      // The grooves are shaded darker (baked occlusion), the rachis and arrises catch the light.
      const k = 1 - (lod === 2 ? 0 : 0.4 * Math.max(0, groove) * open);
      col.push(k, k, k);
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i;
    const b = a + cols + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A feather-shaped plate (outline in x–y, root at 0, tip at +y), extruded with a bevel. */
function featherPlate(len: number, wid: number, thick: number, lod: Lod): BufferGeometry {
  const s = new Shape();
  s.moveTo(-wid / 2, 0);
  s.quadraticCurveTo(-wid * 0.62, len * 0.6, 0, len);
  s.quadraticCurveTo(wid * 0.62, len * 0.6, wid / 2, 0);
  s.lineTo(-wid / 2, 0);
  const g = new ExtrudeGeometry(s, { depth: thick, bevelEnabled: lod < 2, bevelThickness: thick * 0.35, bevelSize: thick * 0.3, bevelSegments: 1, curveSegments: seg(5, lod, 2) });
  g.translate(0, 0, -thick / 2);
  return g;
}

/** The flock emblem facing +z, `r` across its widest: a rayed sun disc (Dawn) or a crescent moon with stars (Dusk). */
function emblem(f: Flock, r: number, thick: number, lod: Lod): BufferGeometry[] {
  const bevel = { bevelEnabled: lod < 2, bevelThickness: thick * 0.3, bevelSize: thick * 0.3, bevelSegments: 1 };
  if (f.dawn) {
    const rays = new Shape();
    const n = 12;
    for (let i = 0; i <= n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : r * 0.58;
      if (i === 0) rays.moveTo(Math.sin(a) * rr, Math.cos(a) * rr);
      else rays.lineTo(Math.sin(a) * rr, Math.cos(a) * rr);
    }
    const disc = new Shape().absarc(0, 0, r * 0.48, 0, Math.PI * 2, false);
    const g1 = new ExtrudeGeometry(rays, { depth: thick, ...bevel, curveSegments: 2 });
    const g2 = new ExtrudeGeometry(disc, { depth: thick * 1.6, ...bevel, curveSegments: seg(9, lod, 4) });
    return [g1, g2];
  }
  // Crescent: the outer circle's arc round the left, back along an inner circle offset right.
  const moon = new Shape();
  const beta = 0.75;
  const d = r * 0.42;
  const px = r * Math.cos(beta);
  const py = r * Math.sin(beta);
  const r2 = Math.hypot(px - d, py);
  const g0 = Math.atan2(py, px - d);
  const n = seg(14, lod, 6);
  for (let i = 0; i <= n; i++) {
    const a = beta + ((2 * Math.PI - 2 * beta) * i) / n;
    if (i === 0) moon.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else moon.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  for (let i = 0; i <= n; i++) {
    const a = -g0 + ((2 * g0 - 2 * Math.PI) * i) / n;
    moon.lineTo(d + Math.cos(a) * r2, Math.sin(a) * r2);
  }
  const out = [new ExtrudeGeometry(moon, { depth: thick, ...bevel, curveSegments: 2 })];
  for (const [sx, sy, sr] of [[0.55, 0.55, 0.22], [0.75, -0.1, 0.16], [0.42, -0.62, 0.13]] as const) {
    const star = new Shape();
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rr = (i % 2 === 0 ? 1 : 0.35) * sr * r;
      const x = sx * r + Math.sin(a) * rr;
      const y = sy * r + Math.cos(a) * rr;
      if (i === 0) star.moveTo(x, y);
      else star.lineTo(x, y);
    }
    out.push(new ExtrudeGeometry(star, { depth: thick, ...bevel, curveSegments: 2 }));
  }
  return out;
}

/** Add the emblem's pieces in the flock's metal under `m`. */
function addEmblem(ms: Masonry, f: Flock, r: number, m: Matrix4, lod: Lod): void {
  for (const g of emblem(f, r, Math.max(0.03, r * 0.08), lod)) ms.add(g, f.metal, m.clone(), { scale: 0.5 });
}

/** A geometry and its back face (flipped winding and normals): cloth seen from both sides by a single-sided material. */
function bothSides(g: BufferGeometry): BufferGeometry {
  const a = g.index ? g.toNonIndexed() : g;
  a.computeVertexNormals();
  const p = a.getAttribute('position');
  const n = a.getAttribute('normal');
  const pos: number[] = [];
  const nor: number[] = [];
  for (let side = 0; side < 2; side++) {
    for (let t = 0; t < p.count; t += 3) {
      const order = side === 0 ? [0, 1, 2] : [0, 2, 1];
      for (const k of order) {
        const s = side === 0 ? 1 : -1;
        pos.push(p.getX(t + k) + n.getX(t + k) * 0.004 * s, p.getY(t + k) + n.getY(t + k) * 0.004 * s, p.getZ(t + k) + n.getZ(t + k) * 0.004 * s);
        nor.push(n.getX(t + k) * s, n.getY(t + k) * s, n.getZ(t + k) * s);
      }
    }
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  return out;
}

/** A hanging banner (w × h, top edge at 0, hanging down -y, facing +z) with a feather-cut hem; `torn` rips it. */
function bannerCloth(w: number, h: number, lod: Lod, torn: boolean, seed: number): BufferGeometry {
  const nx = seg(8, lod, 2);
  const ny = seg(10, lod, 2);
  const pos: number[] = [];
  const idx: number[] = [];
  const points = 4;
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const u = i / nx;
      // Feather-cut hem: rounded points along the bottom edge.
      const hem = j === ny ? 0.16 * h * Math.pow(Math.abs(Math.cos(u * Math.PI * points)), 0.6) : 0;
      let y = -(j / ny) * h * 0.86 - (j === ny ? 0.14 * h - hem + 0.14 * h : 0);
      if (torn && j > 0) {
        // A diagonal rip across the lower half: the cloth ends at a ragged line.
        const cut = h * (0.35 + 0.4 * u) + 0.08 * h * Math.sin(u * 29 + seed);
        y = Math.max(y, -cut);
      }
      const z = 0.05 * Math.sin(u * Math.PI * 3 + j * 0.2) * Math.min(1, j / 2);
      pos.push((u - 0.5) * w, y, z);
    }
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i;
    idx.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return bothSides(g);
}

/** A banner on a metal rod at `m` (rod centre, banner facing +z), with the emblem, finials and ribbon tails. */
function banner(ms: Masonry, f: Flock, m: Matrix4, w: number, h: number, lod: Lod, torn: boolean, seed: number): void {
  ms.add(bannerCloth(w, h, lod, torn, seed), 'canvas', m.clone().multiply(at(0, -0.04, 0)), { tint: f.banner, scale: 0.6 });
  ms.add(new CylinderGeometry(0.035, 0.035, w + 0.2, seg(8, lod)), f.metal, m.clone().multiply(place([0, 0, 0], [0, 0, Math.PI / 2])));
  if (lod < 2) for (const sx of [1, -1]) ms.add(new SphereGeometry(0.07, 8, 5), f.metal, m.clone().multiply(at(sx * (w / 2 + 0.12), 0, 0)));
  if (lod === 0) addEmblem(ms, f, Math.min(w, h) * 0.3, m.clone().multiply(at(0, -h * 0.42, 0.06)), lod);
}

/** A small lantern standing at `m`: a metal frame and cap round a glowing pane (emissive), on a short foot. */
function lantern(ms: Masonry, f: Flock, m: Matrix4, s: number, lod: Lod): void {
  ms.add(new CylinderGeometry(0.11 * s, 0.13 * s, 0.05 * s, seg(6, lod)), f.metal, m.clone().multiply(at(0, 0.025 * s, 0)));
  ms.add(new CylinderGeometry(0.085 * s, 0.085 * s, 0.26 * s, 6), 'lantern', m.clone().multiply(at(0, 0.18 * s, 0)));
  if (lod < 2) for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    ms.add(new CylinderGeometry(0.012 * s, 0.012 * s, 0.3 * s, 4), f.metal, m.clone().multiply(at(Math.sin(a) * 0.1 * s, 0.18 * s, Math.cos(a) * 0.1 * s)));
  }
  ms.add(new CylinderGeometry(0.02 * s, 0.14 * s, 0.12 * s, seg(6, lod)), f.metal, m.clone().multiply(at(0, 0.37 * s, 0)));
  if (lod < 2) ms.add(new TorusGeometry(0.05 * s, 0.012 * s, 4, 8), f.metal, m.clone().multiply(at(0, 0.47 * s, 0)));
}

/** Offerings on a step: seed bowls heaped with seed, candles with flames, a tied ribbon bundle. */
function offerings(ms: Masonry, f: Flock, spots: readonly Matrix4[], lod: Lod, seed: number): void {
  if (lod > 0) return;
  spots.forEach((m, i) => {
    const kind = Math.floor(jitter(i, seed) * 3);
    if (kind === 0) {
      ms.lathe([[0, 0], [0.15, 0], [0.2, 0.06], [0.22, 0.1], [0.19, 0.1], [0.15, 0.05], [0, 0.05]], 'timberRed', new Vector3().setFromMatrixPosition(m), seg(12, lod), { seed: seed + i });
      ms.add(new SphereGeometry(0.18, seg(10, lod), 4, 0, Math.PI * 2, 0, Math.PI / 2), 'gravel', m.clone().multiply(place([0, 0.07, 0], [0, 0, 0], [1, 0.45, 1])), { tint: 0xf0d080, scale: 0.15 });
    } else if (kind === 1) {
      for (let c = 0; c < 3; c++) {
        const h = 0.12 + 0.1 * jitter(c, seed + i);
        const x = (c - 1) * 0.11;
        ms.add(new CylinderGeometry(0.035, 0.038, h, seg(6, lod)), 'canvas', m.clone().multiply(at(x, h / 2, (c % 2) * 0.06)), { tint: 0xfff4dc });
        ms.add(new CylinderGeometry(0, 0.018, 0.06, 4), 'lantern', m.clone().multiply(at(x, h + 0.03, (c % 2) * 0.06)));
      }
    } else {
      // A bundle of feathers and ribbon: a few dyed ribbons in faded flock colours, leaning.
      for (let c = 0; c < 3; c++) {
        ms.add(new CylinderGeometry(0.012, 0.02, 0.5, 4), 'timberDark', m.clone().multiply(place([c * 0.05 - 0.05, 0.22, 0], [0.2 * (c - 1), 0, 0.15 * (c - 1)])));
      }
      ms.add(bothSides(new RingGeometry(0.03, 0.09, 6, 1)), 'canvas', m.clone().multiply(place([0, 0.4, 0.03], [0, 0, 0])), { tint: f.banner });
    }
  });
}

/** A painted ring on the ground (a decal) from r0 to r1, with a metal inlay at its inner edge. */
function floorRing(ms: Masonry, f: Flock, r0: number, r1: number, lod: Lod): void {
  const n = seg(64, lod, 16);
  ms.add(new RingGeometry(r0, r1, n, 1).rotateX(-Math.PI / 2), 'flagstone', at(0, 0.018, 0), { tint: f.floor, uv: 'planar' });
  if (lod < 2) ms.add(new RingGeometry(r0 - 0.06, r0, n, 1).rotateX(-Math.PI / 2), f.metal, at(0, 0.022, 0));
}

/** Dark cracks climbing a round surface (centre x/z, radius r) from y0, as thin strips just off it. */
function cracks(ms: Masonry, id: MaterialId, r: number, y0: number, y1: number, count: number, seed: number): void {
  for (let c = 0; c < count; c++) {
    let a = jitter(c, seed) * Math.PI * 2;
    let y = y0 + (y1 - y0) * jitter(c, seed + 1) * 0.6;
    const steps = 9;
    const len = (y1 - y0) * (0.3 + 0.4 * jitter(c, seed + 2));
    const pos: number[] = [];
    for (let k = 0; k <= steps; k++) {
      const w = 0.045 * (1 - k / steps) + 0.01;
      const rr = r + 0.012;
      const p = new Vector3(Math.sin(a) * rr, y, Math.cos(a) * rr);
      const t = new Vector3(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(w / 2);
      pos.push(p.x - t.x, p.y, p.z - t.z, p.x + t.x, p.y, p.z + t.z);
      y += len / steps;
      a += (jitter(k, seed + c * 7) - 0.5) * 0.25;
    }
    const idx: number[] = [];
    for (let k = 0; k < steps; k++) idx.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    ms.add(bothSides(g), id, undefined, { tint: 0x2c241e });
  }
}

/** Stone chips and chunks scattered within `r` of the centre, on the ground or a step at `y`. */
function chips(ms: Masonry, id: MaterialId, count: number, r0: number, r1: number, y: number, size: number, seed: number): void {
  for (let i = 0; i < count; i++) {
    const a = jitter(i, seed) * Math.PI * 2;
    const r = r0 + (r1 - r0) * jitter(i, seed + 1);
    const s = size * (0.5 + jitter(i, seed + 2));
    ms.add(new DodecahedronGeometry(s, 0), id, place([Math.sin(a) * r, y + s * 0.5, Math.cos(a) * r], [jitter(i, seed + 3) * 3, jitter(i, seed + 4) * 3, 0], [1, 0.7, 1.1]), { seed: seed + i });
  }
}

/** A broken stump: a cylinder whose top is jagged. */
function stump(r: number, h: number, sides: number, seed: number): BufferGeometry {
  const g = new CylinderGeometry(r * 0.96, r, h, sides, 1, false);
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setY(i, p.getY(i) - h * 0.35 * jitter(Math.round(Math.atan2(p.getZ(i), p.getX(i)) * 10), seed));
  g.translate(0, h / 2, 0);
  g.computeVertexNormals();
  return g;
}

/** A living branch wound round an axis: a tube along a helix (radius rr, turns, from y0 to y1), tapering. */
function helixBranch(rr: number, y0: number, y1: number, turns: number, phase: number, r: number, lod: Lod, wobble: number, seed: number): BufferGeometry {
  const pts: Vector3[] = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = phase + t * turns * Math.PI * 2;
    const rad = rr * (1 + wobble * Math.sin(t * 9 + seed));
    pts.push(new Vector3(Math.sin(a) * rad, y0 + (y1 - y0) * t, Math.cos(a) * rad));
  }
  const g = new TubeGeometry(new CatmullRomCurve3(pts), seg(28, lod, 6), r, seg(6, lod, 3), false);
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
// Statue pieces (the bird solid material).

const STATE = (k: number): number => STATE_GLOW + k;

/** Paint a world skin's level with region styles, placed by `m`, into a StaticMesh. */
function skinInto(sm: StaticMesh, name: WorldBody, lod: Lod, style: Readonly<Record<string, RegionStyle>>, m: Matrix4): void {
  const level = worldSkin(name)[lod];
  if (!level) return;
  const regions = new Field(WORLD_BODIES[name]()).regions;
  sm.skin(paintSkin(level, regions, style), m);
}

/** Bronze with streaks of verdigris (style guide §7.2), by position. */
const bronze = (base: number, k = 1): ((p: Vector3) => number) => (p) => {
  const n = Math.sin(p.x * 23 + p.y * 7.3) * Math.sin(p.z * 19.1 - p.y * 11.7) + 0.5 * Math.sin(p.y * 31 + p.x * 5);
  return mix(base, 0x5e7d6b, Math.min(0.5, Math.max(0, n * 0.9 - 0.45) * k));
};

/** Talons: a foot (anatomy.foot: jointed toes and glossy claws, sole at y = 0) under `ankle` in the statue frame `m`. */
function talons(sm: StaticMesh, m: Matrix4, ankle: V3, s: number, skin: number, claw: number, lod: Lod, side: 1 | -1): void {
  const style: LegStyle = {
    skin, claw, thick: 0.022 * s, clawLen: 0.05 * s,
    toes: [{ yaw: -0.45, len: 0.1 * s }, { yaw: 0, len: 0.12 * s }, { yaw: 0.45, len: 0.1 * s }, { yaw: Math.PI, len: 0.06 * s }],
  };
  const f = new Sculpt();
  foot(f, ankle[1], style, detail(lod as Level), side);
  sm.sculpt(f, m.clone().multiply(at(ankle[0], ankle[1], ankle[2])));
}

/** A tapered leg segment from a to b (radii ra, rb) as a loft. */
function limb(k: Sculpt, a: V3, b: V3, ra: number, rb: number, paint: number, finish: Finish, lod: Lod): void {
  const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  k.loft([{ c: a, w: ra, up: ra }, { c: mid, w: (ra + rb) / 2 * 0.95, up: (ra + rb) / 2 * 0.95 }, { c: b, w: rb, up: rb }], { seg: seg(10, lod, 4), paint, finish, ref: [0, 0, 1] });
}

// ---------------------------------------------------------------------------------------------------------------
// The Sentinel Hawk.

const HAWK = { steps: [[2.5, 0.25], [2.1, 0.25], [1.72, 0.25]] as const, pedestal: 1.65, shaftFrom: 1.95, shaftTo: 6.6, capTop: 7.45, statue: 1.3 } as const;

function hawkArch(f: Flock, lod: Lod, damage: Damage): BufferGeometry {
  const ms = new Masonry();
  floorRing(ms, f, 2.75, 3.8, lod);
  const y0 = steps(ms, HAWK.steps, f.stone, 8, 11);
  // Pedestal: a square block with a cap and a foot moulding.
  ms.lathe([[0, y0], [1.25, y0], [1.25, y0 + 0.08], [1.18, y0 + 0.14], [1.15, HAWK.pedestal - 0.16], [1.24, HAWK.pedestal - 0.1], [1.24, HAWK.pedestal], [0, HAWK.pedestal]], f.stone, new Vector3(), 4, { seed: 12 });
  for (const z of [1, -1]) addEmblem(ms, f, 0.5, at(0, (y0 + HAWK.pedestal) / 2, z * 1.16).multiply(place([0, 0, 0], [0, z < 0 ? Math.PI : 0, 0])), lod);
  offerings(ms, f, [0, 1, 2, 3, 4, 5].map((i) => {
    const a = Math.PI / 4 + (i * Math.PI) / 3 + 0.3;
    return at(Math.sin(a) * 1.95, HAWK.steps[0][1], Math.cos(a) * 1.95);
  }), lod, 13);
  for (const sx of [1, -1]) lantern(ms, f, at(sx * 1.45, y0, 1.45), 1.4, lod);
  if (damage === 3) {
    ms.add(stump(0.62, 2.4, seg(16, lod, 8), 3), f.stone, at(0, HAWK.pedestal, 0), { uv: 'cylinder', seed: 14 });
    for (const [x, z, yaw, len] of [[2.6, 1.2, 0.6, 1.3], [-2.4, 2.4, -0.4, 1.0], [3.4, -1.4, 1.7, 1.2]] as const) {
      ms.add(new CylinderGeometry(0.58, 0.58, len, seg(14, lod, 6)), f.stone, place([x, 0.58, z], [0, yaw, Math.PI / 2]), { uv: 'cylinder', seed: 15 });
    }
    ms.lathe([[0, 0], [0.75, 0], [0.95, 0.3], [1.05, 0.5], [0, 0.5]], f.stone, new Vector3(-1.8, 0, -2.6), seg(16, lod, 6), { seed: 16 });
    chips(ms, f.stone, 18, 1.0, 4.2, 0, 0.22, 17);
    return ms.build();
  }
  // Column foot: a torus and scotia moulding.
  ms.lathe([[0, HAWK.pedestal], [0.95, HAWK.pedestal], [0.95, HAWK.pedestal + 0.06], [0.88, HAWK.pedestal + 0.14], [0.8, HAWK.pedestal + 0.18], [0.74, HAWK.pedestal + 0.24], [0.7, HAWK.shaftFrom], [0, HAWK.shaftFrom]], f.stone, new Vector3(), seg(28, lod, 8), { seed: 18 });
  ms.add(featherShaft(0.64, 0.56, HAWK.shaftFrom, HAWK.shaftTo, 12, lod), f.stone, undefined, { uv: 'cylinder', seed: 19 });
  // Metal bands with a ribbon tied below the upper one.
  for (const y of [3.3, 5.5]) ms.lathe([[0.6, y - 0.08], [0.67, y - 0.06], [0.68, y + 0.06], [0.6, y + 0.08]], f.metal, new Vector3(), seg(28, lod, 8));
  // Capital: echinus, two tiers of wing plates flaring out, and the abacus slab.
  ms.lathe([[0.55, HAWK.shaftTo], [0.62, HAWK.shaftTo + 0.06], [0.78, HAWK.shaftTo + 0.3], [0.9, HAWK.shaftTo + 0.55], [0, HAWK.shaftTo + 0.55]], f.stone, new Vector3(), seg(28, lod, 8), { seed: 20 });
  const plates = lod === 2 ? 0 : 12;
  for (let tier = 0; tier < 2; tier++) for (let i = 0; i < plates; i++) {
    const a = ((i + tier * 0.5) / plates) * Math.PI * 2;
    const g = featherPlate(0.62 - tier * 0.12, 0.34, 0.06, lod);
    const m = place([Math.sin(a) * (0.55 + tier * 0.05), HAWK.shaftTo + 0.05 + tier * 0.22, Math.cos(a) * (0.55 + tier * 0.05)], [0, a, 0]).multiply(place([0, 0, 0], [0.85 - tier * 0.2, 0, 0]));
    ms.add(g, f.stone, m, { seed: 21 + i });
  }
  ms.lathe([[0, HAWK.shaftTo + 0.5], [1.02, HAWK.shaftTo + 0.5], [1.06, HAWK.shaftTo + 0.56], [1.06, HAWK.capTop - 0.05], [1.0, HAWK.capTop], [0, HAWK.capTop]], f.stone, new Vector3(), 4, { seed: 22 });
  // Banners front and back, hung from a metal bar on brackets.
  for (const z of [1, -1]) {
    const m = place([0, 5.95, z * 0.78], [0, z < 0 ? Math.PI : 0, 0]);
    banner(ms, f, m, 0.95, 1.9, lod, damage === 2, 23 + z);
  }
  if (damage >= 1) {
    cracks(ms, f.stone, 0.62, HAWK.shaftFrom, HAWK.shaftTo, damage === 1 ? 3 : 7, 31);
    chips(ms, f.stone, damage === 1 ? 5 : 12, 1.0, 2.3, damage === 1 ? HAWK.steps[0][1] : 0, 0.12, 32);
  }
  return ms.build();
}

function hawkStatue(f: Flock, lod: Lod): BufferGeometry {
  const k = new Sculpt();
  const d = detail(lod as Level);
  const base = 0x6b4f2f;
  const fin: Finish = { tile: TILE.scales, size: 0.05, gloss: 0.5 };
  const style: Record<string, RegionStyle> = {
    back: { paint: bronze(base), finish: fin }, breast: { paint: bronze(0x7e5f3b, 0.6), finish: { ...fin, size: 0.04 } }, thigh: { paint: bronze(0x735535), finish: fin },
    neck: { paint: bronze(base), finish: fin }, crown: { paint: bronze(0x5e452a, 1.4), finish: fin }, face: { paint: 0x846443, finish: { gloss: 0.5 } },
    cheek: { paint: 0x7a5a3a, finish: { gloss: 0.5 } }, brow: { paint: 0x4e3a24, finish: { gloss: 0.5 } }, nape: { paint: bronze(base), finish: fin },
    throat: { paint: 0x8a6a44, finish: fin }, bill: { paint: f.gild, finish: { gloss: 0.8 } }, socket: { paint: 0x2a2018 },
    wing: { paint: bronze(0x654a2c), finish: { ...fin, size: 0.07 } },
  };
  const s = HAWK.statue;
  const m = place([0, HAWK.capTop, 0], [0, 0, 0], [s, s, s]);
  const sm = new StaticMesh();
  beak(k, { at: [0, 1.25, 0.28], len: 0.1, w: 0.034, up: 0.04, dn: 0.022, curve: 0.028, hook: 0.03, base: f.gild, tip: shade(f.gild, 0.6) }, d);
  for (const side of [1, -1] as const) {
    glowEye(k, [side * 0.054, 1.279, 0.238], [side * 0.55, 0.05, 0.85], 0.04, f.glow, STATE(1.9), seg(10, lod, 5));
    featherWing(k, { side, shoulder: [side * 0.24, 0.98, -0.1], span: 1.05, chord: 0.48, raise: 0.95, sweep: 0.35, open: 0.75, roll: 1.0, root: 0x6b4f2f, tip: 0x9a7a50, covert: 0x7a5c38, finish: { gloss: 0.5 }, rows: d.rows, primaries: [8, 5, 4][lod], secondaries: [10, 6, 4][lod] });
    limb(k, [side * 0.11, 0.24, 0.08], [side * 0.11, 0.07, 0.1], 0.03, 0.024, f.gild, { tile: TILE.rings, size: 0.04, gloss: 0.6 }, lod);
    if (lod < 2) talons(sm, m, [side * 0.11, 0.06, 0.11], 1, f.gild, 0x1a1410, lod, side);
  }
  featherFan(k, [0, 0.36, -0.3], [0, -0.55, -1], [0, 0.88, -0.47], { n: [8, 6, 4][lod], len: 0.5, wid: 0.13, spread: 0.7, root: 0x6b4f2f, tip: 0x9a7a50, rows: d.rows, finish: { gloss: 0.5 } });
  skinInto(sm, 'hawk', lod, style, m);
  sm.sculpt(k, m);
  return sm.build();
}

// ---------------------------------------------------------------------------------------------------------------
// The Stilt Heron.

const HERON = { frame: 2.15, top: 7.6, hip: 4.5, plinth: 0.4, scale: 1.25 } as const;

function heronArch(f: Flock, lod: Lod, damage: Damage): BufferGeometry {
  const ms = new Masonry();
  const F = HERON.frame;
  floorRing(ms, f, 3.2, 4.2, lod);
  // Plinth the heron stands on, and stone footings under the posts.
  ms.lathe([[0, 0], [2.9, 0], [2.9, HERON.plinth - 0.04], [2.86, HERON.plinth], [0, HERON.plinth]], f.stone, new Vector3(), 4, { seed: 41 });
  const corners: V3[] = [[F, 0, F], [-F, 0, F], [F, 0, -F], [-F, 0, -F]];
  offerings(ms, f, ([[1.3, 2.55], [-1.4, 2.5], [2.55, -0.6], [-2.55, 0.9]] as const).map(([x, z]) => at(x, HERON.plinth, z)), lod, 42);
  if (damage === 3) {
    corners.forEach(([x, , z], i) => ms.add(stump(0.17, 1.2 + 1.6 * jitter(i, 5), 4, 44 + i), 'timber', at(x, HERON.plinth, z), { turn: true, seed: 45 + i }));
    for (const [x, z, yaw] of [[3.2, 1.6, 0.3], [-2.8, -2.6, 1.2], [1.0, -3.4, 2.0]] as const) ms.add(new CylinderGeometry(0.15, 0.15, 5.5, 4), 'timber', place([x, 0.16, z], [0, yaw, Math.PI / 2]), { seed: 46 });
    chips(ms, f.stone, 14, 1.0, 4.0, 0, 0.2, 47);
    return ms.build();
  }
  const post = (a: Vector3, b: Vector3, r: number): Masonry => ms.rod(a, b, r, 'timber', 4, { seed: 48 });
  for (const [x, , z] of corners) {
    ms.lathe([[0, HERON.plinth], [0.36, HERON.plinth], [0.36, HERON.plinth + 0.36], [0.3, HERON.plinth + 0.42], [0, HERON.plinth + 0.42]], f.stone, new Vector3(x, 0, z), 4, { seed: 49 });
    post(new Vector3(x, HERON.plinth + 0.4, z), new Vector3(x, HERON.top, z), 0.2);
    // Metal cap: a pyramid and a ball finial.
    ms.add(new CylinderGeometry(0.02, 0.25, 0.3, 4), f.metal, place([x, HERON.top + 0.15, z], [0, Math.PI / 4, 0]));
    if (lod < 2) ms.add(new SphereGeometry(0.09, 8, 5), f.metal, at(x, HERON.top + 0.34, z));
  }
  // Ring beams at the top and mid height, braces on the side faces, rope lashings at the joints.
  for (const y of [HERON.top - 0.3, 3.1]) {
    for (const [a, b] of [[0, 1], [2, 3], [0, 2], [1, 3]] as const) {
      const p = corners[a]!;
      const q = corners[b]!;
      ms.rod(new Vector3(p[0], y, p[2]), new Vector3(q[0], y, q[2]), 0.14, 'timberDark', 4, { seed: 50 });
      if (lod < 2) for (const c of [p, q]) ms.add(new TorusGeometry(0.22, 0.035, 4, 8), 'rope', place([c[0], y, c[2]], [Math.PI / 2, 0, 0]), { scale: 0.5 });
    }
  }
  for (const sx of [1, -1]) {
    ms.rod(new Vector3(sx * F, 3.1, F), new Vector3(sx * F, HERON.top - 0.3, -F), 0.1, 'timberDark', 4, { seed: 51 });
    ms.rod(new Vector3(sx * F, 3.1, -F), new Vector3(sx * F, HERON.top - 0.3, F), 0.1, 'timberDark', 4, { seed: 52 });
    // Banners on the side faces, hanging from the top beam.
    const m = place([sx * (F + 0.2), HERON.top - 0.45, 0], [0, sx * Math.PI / 2, 0]);
    banner(ms, f, m, 1.2, 2.3, lod, damage === 2, 53 + sx);
  }
  // Reed clumps at the plinth's corners (the heron's river).
  if (lod < 2) for (const [x, z] of [[2.5, 2.5], [-2.5, 2.5], [2.5, -2.5], [-2.5, -2.5]] as const) {
    for (let i = 0; i < (lod === 0 ? 12 : 4); i++) {
      const a = jitter(i, x * 7 + z) * Math.PI * 2;
      const h = 1.1 + 0.6 * jitter(i, x + z * 3);
      ms.add(new CylinderGeometry(0.0, 0.03, h, 3), 'grass', place([x + Math.sin(a) * 0.25, HERON.plinth + h / 2, z + Math.cos(a) * 0.25], [Math.cos(a) * 0.18, 0, -Math.sin(a) * 0.18]), { tint: 0xb0b878 });
    }
  }
  // A woven nest crowning the frame, its twigs straggling past the rim (style guide §1.1).
  if (lod < 2) {
    ms.add(new TorusGeometry(1.15, 0.32, seg(6, lod, 4), seg(20, lod, 10)), 'twig', place([0, HERON.top + 0.12, 0], [Math.PI / 2, 0, 0], [1, 1, 0.8]), { seed: 56 });
    ms.lathe([[0, HERON.top - 0.05], [0.9, HERON.top - 0.05], [1.0, HERON.top + 0.2], [0, HERON.top + 0.18]], 'twig', new Vector3(), seg(16, lod, 8), { seed: 57 });
    for (let i = 0; i < (lod === 0 ? 14 : 6); i++) {
      const a = (i / 14) * Math.PI * 2 + jitter(i, 58);
      ms.add(new CylinderGeometry(0.012, 0.03, 0.9, 3), 'twig', place([Math.sin(a) * 1.25, HERON.top + 0.15, Math.cos(a) * 1.25], [Math.cos(a) * (1.1 + 0.3 * jitter(i, 59)), 0, -Math.sin(a) * (1.1 + 0.3 * jitter(i, 59))]));
    }
  }
  // A lantern hung in the frame's front from the top beam, on a chain.
  ms.add(new CylinderGeometry(0.015, 0.015, 1.0, 4), 'iron', at(0, HERON.top - 0.8, F));
  lantern(ms, f, at(0, HERON.top - 1.75, F), 1.5, lod);
  if (damage >= 1) {
    for (const [x, , z] of corners) {
      const seed = 60 + x * 3 + z;
      ms.add(new DodecahedronGeometry(0.12, 0), 'timberDark', place([x * 1.1, HERON.plinth + 0.1, z * 1.1], [seed, seed * 2, 0]));
    }
    cracks(ms, f.stone, 2.92, 0.02, HERON.plinth, damage === 1 ? 3 : 6, 61);
    chips(ms, f.stone, damage === 1 ? 4 : 10, 2.0, 3.4, damage === 1 ? HERON.plinth : 0, 0.12, 62);
  }
  return ms.build();
}

function heronStatue(f: Flock, lod: Lod, pose: number): BufferGeometry {
  const k = new Sculpt();
  const legs = new Sculpt();
  const d = detail(lod as Level);
  const stone = 0xcfc8b8;
  const fin: Finish = { tile: TILE.scales, size: 0.14, gloss: 0.15 };
  const style: Record<string, RegionStyle> = {
    back: { paint: 0xb9b6ae, finish: fin }, breast: { paint: stone, finish: { ...fin, size: 0.1 } }, wing: { paint: 0xa9a8a2, finish: { ...fin, size: 0.2 } },
    neck: { paint: 0xd9d3c4, finish: { ...fin, size: 0.09 } }, crown: { paint: 0x6e6a66, finish: fin }, face: { paint: 0xe2dccc }, cheek: { paint: 0xd8d2c2 },
    brow: { paint: 0x5e5a56 }, nape: { paint: 0x7a7672, finish: fin }, throat: { paint: 0xe8e2d4, finish: fin }, bill: { paint: f.gild, finish: { gloss: 0.7 } }, socket: { paint: 0x2a2620 },
  };
  // The bird in its own frame (hips at 0), scaled up into the frame; the legs in the rig frame down to the plinth.
  const sc = HERON.scale;
  const M = place([0, HERON.hip, 0], [0, 0, 0], [sc, sc, sc]);
  const headC: V3 = [0, 2.74, 1.0];
  beak(k, { at: [0, headC[1] - 0.02, headC[2] + 0.16], len: 0.8, w: 0.06, up: 0.07, dn: 0.05, curve: 0.01, base: f.gild, tip: shade(f.gild, 0.7) }, d);
  const wood = 0x7a5236;
  for (const side of [1, -1] as const) {
    glowEye(k, [side * 0.09, headC[1] + 0.045, headC[2] + 0.1], [side * 0.6, 0.05, 0.8], 0.05, f.glow, STATE(1.9), seg(10, lod, 5));
    // Legs: hip → knee → ankle → toes. A raised leg swings forward and up from the hip, the lower leg folding back.
    const raised = (side === 1 && pose === 1) || (side === -1 && pose === 2);
    const lift = raised ? S.stompLift : 0;
    const h: V3 = [side * 0.4, HERON.hip + 0.06, 0.12];
    const kneeLen = 1.9;
    const shinLen = 2.25;
    const knee: V3 = [h[0], h[1] - Math.cos(lift * 0.9) * kneeLen, h[2] + Math.sin(lift * 0.9) * kneeLen + 0.12];
    const back = raised ? 1.6 : 0;
    const ankle: V3 = [h[0], raised ? knee[1] - Math.cos(back * 0.6) * shinLen : HERON.plinth + 0.12, knee[2] - Math.sin(back * 0.6) * shinLen * 0.7];
    limb(legs, h, knee, 0.15, 0.11, wood, { tile: TILE.wood, size: 0.25 }, lod);
    limb(legs, knee, ankle, 0.1, 0.08, wood, { tile: TILE.wood, size: 0.25 }, lod);
    legs.mesh(new SphereGeometry(0.16, seg(10, lod), seg(6, lod)), { at: knee, paint: f.gild, finish: { gloss: 0.8 } });
    legs.mesh(new SphereGeometry(0.12, seg(8, lod), seg(5, lod)), { at: ankle, paint: f.gild, finish: { gloss: 0.8 } });
    // Long toes splayed on the plinth (or curled under while raised).
    for (const [yaw, len] of [[-0.55, 0.7], [0, 0.82], [0.55, 0.7], [Math.PI, 0.4]] as const) {
      const dir: V3 = [Math.sin(yaw * side), 0, Math.cos(yaw)];
      const tip: V3 = [ankle[0] + dir[0] * len, raised ? ankle[1] - 0.25 : HERON.plinth + 0.03, ankle[2] + dir[2] * len];
      limb(legs, ankle, tip, 0.06, 0.03, wood, { tile: TILE.wood, size: 0.2 }, lod);
    }
  }
  // Plumes: a trailing crest, breast plumes and the aigrettes over the tail.
  for (let i = 0; i < 2; i++) k.card({ at: [0, headC[1] + 0.12, headC[2] - 0.12], dir: [0.06 * (i - 0.5), -0.25, -1], face: [0, 1, 0], len: 0.9 - i * 0.2, wid: 0.06, cell: CARD.quill, root: 0x4e4a46, tip: 0x3a3634, curl: -0.4, segs: d.rows });
  for (let i = 0; i < d.keep(7, 3); i++) {
    const a = (i / 6 - 0.5) * 1.2;
    k.card({ at: [Math.sin(a) * 0.2, 0.95, 0.78 + Math.cos(a) * 0.1], dir: [Math.sin(a) * 0.3, -1, 0.25], face: [Math.sin(a), 0, Math.cos(a)], len: 0.85, wid: 0.1, cell: CARD.ragged, root: 0xe8e2d4, tip: 0xd0cabc, curl: 0.2, segs: d.rows });
  }
  for (let i = 0; i < d.keep(5, 2); i++) {
    const x = (i / 4 - 0.5) * 0.5;
    k.card({ at: [x, 0.75, -0.6], dir: [x * 0.5, -0.35, -1], face: [0, 1, 0], len: 1.3, wid: 0.14, cell: CARD.ragged, root: 0xd4cec0, tip: 0xece6d8, curl: -0.5, segs: d.rows });
  }
  const sm = new StaticMesh();
  skinInto(sm, 'heron', lod, style, M);
  sm.sculpt(k, M);
  sm.sculpt(legs);
  return sm.build();
}

// ---------------------------------------------------------------------------------------------------------------
// Nest Wardens.

const WARDEN = { postTop: 5.75, head: 6.25 } as const;

function wardenArch(f: Flock, body: StructureBody, lod: Lod, damage: Damage): BufferGeometry {
  const ms = new Masonry();
  const gap = Math.max(0.6, body.radius * 0.62);
  floorRing(ms, f, 2.2, 2.9, lod);
  for (const s of [1, -1]) {
    const x = s * gap;
    ms.lathe([[0, 0], [0.7, 0], [0.7, 0.3], [0.62, 0.38], [0, 0.38]], f.stone, new Vector3(x, 0, 0), seg(10, lod, 6), { seed: 70 + s });
    const top = damage === 3 ? 1.6 + jitter(s + 2, 71) * 1.2 : WARDEN.postTop;
    // The core trunk, living branches wound both ways round it, and roots flaring into the plinth.
    ms.add(new CylinderGeometry(0.26, 0.36, top - 0.3, seg(10, lod, 5)), 'bark', at(x, 0.3 + (top - 0.3) / 2, 0), { uv: 'cylinder', seed: 72 });
    const branches = lod === 2 ? 2 : 5;
    for (let i = 0; i < branches; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      ms.add(helixBranch(0.33 + 0.04 * (i % 3), 0.35, top - 0.05 * i, 0.9 + 0.25 * (i % 2), (i * Math.PI * 2) / branches, 0.075 + 0.01 * (i % 2), lod, 0.12, i), i % 3 === 2 ? 'twig' : 'bark', at(x, 0, 0).multiply(place([0, 0, 0], [0, 0, 0], [dir, 1, 1])), { seed: 73 + i });
    }
    if (lod < 2) for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      ms.add(new CylinderGeometry(0.03, 0.12, 0.9, 5), 'bark', at(x, 0, 0).multiply(place([Math.sin(a) * 0.45, 0.42, Math.cos(a) * 0.45], [Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9])), { seed: 74 });
    }
    // Moss clumps on the branches.
    if (lod < 2) for (let i = 0; i < 6; i++) {
      const a = jitter(i, 75 + s) * Math.PI * 2;
      const y = 0.8 + jitter(i, 76 + s) * (top - 1.2);
      ms.add(new IcosahedronGeometry(0.16 + 0.08 * jitter(i, 77), 0), 'moss', place([x + Math.sin(a) * 0.38, y, Math.cos(a) * 0.38], [0, a, 0], [1.2, 0.55, 1]), { seed: 78 });
    }
    // Twigs bristling out of the weave.
    if (lod === 0) for (let i = 0; i < 6; i++) {
      const a = jitter(i, 79 + s) * Math.PI * 2;
      const y = 1.2 + jitter(i, 80 + s) * (top - 1.6);
      ms.add(new CylinderGeometry(0.005, 0.025, 0.55, 3), 'twig', at(x, 0, 0).multiply(place([Math.sin(a) * 0.5, y, Math.cos(a) * 0.5], [Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2])));
    }
  }
  if (damage === 3) {
    chips(ms, 'bark', 12, 0.4, 3.0, 0, 0.18, 81);
    return ms.build();
  }
  // The woven arch between the posts, and the flock's banner hung from it.
  const span = gap * 2;
  for (let i = 0; i < (lod === 2 ? 1 : 3); i++) {
    const pts: Vector3[] = [];
    for (let j = 0; j <= 8; j++) {
      const t = j / 8;
      pts.push(new Vector3(-gap + span * t, 5.05 + 0.5 * Math.sin(Math.PI * t) + 0.09 * i, 0.08 * Math.sin(t * Math.PI * 4 + i * 2)));
    }
    ms.add(new TubeGeometry(new CatmullRomCurve3(pts), seg(18, lod, 6), 0.06, seg(5, lod, 3), false), 'twig', undefined, { seed: 82 + i });
  }
  banner(ms, f, at(0, 5.0, 0.12), Math.min(1.1, span - 0.5), 1.4, lod, damage === 2, 85);
  if (damage >= 1) {
    for (const s of [1, -1]) {
      for (let i = 0; i < (damage === 1 ? 2 : 4); i++) ms.add(new CylinderGeometry(0.03, 0.05, 0.9, 4), 'bark', place([s * gap + (jitter(i, 86) - 0.5) * 1.6, 0.06, 0.9 + jitter(i, 87)], [Math.PI / 2, jitter(i, 88) * 3, 0]));
    }
    chips(ms, 'bark', damage === 1 ? 4 : 9, 0.6, 2.2, 0, 0.1, 89);
  }
  return ms.build();
}

function wardenStatue(f: Flock, body: StructureBody, lod: Lod): BufferGeometry {
  const gap = Math.max(0.6, body.radius * 0.62);
  const sm = new StaticMesh();
  const d = detail(lod as Level);
  const wood: Finish = { tile: TILE.wood, size: 0.08, gloss: 0.1 };
  const style: Record<string, RegionStyle> = {
    crown: { paint: 0x5a4030, finish: wood }, disc: { paint: 0xb89a74, finish: { ...wood, size: 0.06 } }, ridge: { paint: 0x7a5a40, finish: wood },
    brow: { paint: 0x3e2c20, finish: wood }, ruff: { paint: 0x4a3426, finish: wood },
  };
  for (const s of [1, -1]) {
    const k = new Sculpt();
    const x = s * gap;
    const y = WARDEN.head;
    for (const side of [1, -1] as const) {
      glowEye(k, [x + side * 0.19, y + 0.03, 0.4], [side * 0.12, 0, 1], 0.11, f.glow, STATE(2.2), seg(12, lod, 6));
      // Ear tufts: carved feathers springing up and out from the brows' ends.
      for (let i = 0; i < (lod === 2 ? 1 : 3); i++) k.card({ at: [x + side * (0.34 + 0.04 * i), y + 0.36, 0.05 - 0.07 * i], dir: [side * 0.85, 0.75, -0.3], face: [0, 0.3, 1], len: 0.42 - 0.07 * i, wid: 0.15, cell: CARD.contour, root: 0x4a3426, tip: 0x2e2018, curl: -0.25, segs: d.rows });
    }
    // A collar of leaves under the face, where the living branches meet the carving.
    for (let i = 0; i < d.keep(10, 3); i++) {
      const a = (i / 10) * Math.PI * 2;
      k.card({ at: [x + Math.sin(a) * 0.38, y - 0.42, Math.cos(a) * 0.32], dir: [Math.sin(a) * 0.8, -0.5, Math.cos(a) * 0.8], face: [Math.sin(a) * 0.5, 0.85, Math.cos(a) * 0.5], len: 0.34 + 0.08 * jitter(i, s + 5), wid: 0.18, cell: CARD.contour, root: 0x3e6b3a, tip: 0x6a9a48, curl: 0.35, segs: 2 });
    }
    beak(k, { at: [x, y - 0.06, 0.4], len: 0.2, w: 0.06, up: 0.07, dn: 0.03, curve: 0.11, hook: 0.05, base: 0x5a4632, tip: 0x241a12 }, d);
    skinInto(sm, 'owlHead', lod, style, at(x, y, 0.05));
    sm.sculpt(k);
  }
  return sm.build();
}

// ---------------------------------------------------------------------------------------------------------------
// The Roost Shrine.

const SHRINE = { base: 0.95, top: 5.6, floor: 6 } as const;

function shrineArch(f: Flock, lod: Lod, damage: Damage): BufferGeometry {
  const ms = new Masonry();
  // The floor circle, 12 m across: outer and inner bands and the flock's motifs between them.
  floorRing(ms, f, SHRINE.floor - 0.45, SHRINE.floor, lod);
  floorRing(ms, f, 3.6, 3.85, lod);
  const marks = lod === 2 ? 0 : 12;
  for (let i = 0; i < marks; i++) {
    const a = (i / marks) * Math.PI * 2;
    const g = f.dawn ? new CylinderGeometry(0.02, 0.32, 1.2, 3).rotateX(Math.PI / 2) : new RingGeometry(0.22, 0.36, 10, 1, 0, Math.PI * 1.25).rotateX(-Math.PI / 2);
    ms.add(g, 'flagstone', place([Math.sin(a) * 4.7, 0.02, Math.cos(a) * 4.7], [f.dawn ? 0 : 0, a, 0], [1, f.dawn ? 0.02 : 1, 1]), { tint: f.floor, uv: 'planar' });
  }
  // The drum base, in two tiers, with a metal band, lanterns and offerings.
  const y0 = steps(ms, [[2.0, 0.45], [1.6, 0.5]], f.stone, seg(20, lod, 8), 90);
  ms.lathe([[1.62, 0.6], [1.66, 0.64], [1.66, 0.76], [1.62, 0.8]], f.metal, new Vector3(), seg(28, lod, 8));
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    lantern(ms, f, at(Math.sin(a) * 1.78, 0.45, Math.cos(a) * 1.78), 1.3, lod);
  }
  offerings(ms, f, [0, 1, 2, 3].map((i) => {
    const a = (i * Math.PI) / 2 + 0.2;
    return at(Math.sin(a) * 1.8, 0.45, Math.cos(a) * 1.8);
  }), lod, 91);
  const ribTop = damage === 3 ? 2.2 : SHRINE.top;
  // Four stone piers round the core, each with a metal cap, leaning in a little as they rise.
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const p = new Vector3(Math.sin(a) * 0.62, y0, Math.cos(a) * 0.62);
    const q = new Vector3(Math.sin(a) * 0.5, damage === 3 ? ribTop - 0.4 * jitter(i, 92) : ribTop, Math.cos(a) * 0.5);
    if (damage === 3) ms.add(stump(0.2, q.y - y0, 5, 93 + i), f.stone, at(p.x, y0, p.z), { seed: 94 });
    else ms.rod(p, q, 0.22, f.stone, seg(8, lod, 4), { seed: 95 + i }, 0.17);
  }
  if (damage === 3) {
    for (const [x, z, yaw] of [[2.6, 1.0, 0.7], [-2.2, -2.0, 2.1]] as const) ms.add(new CylinderGeometry(0.2, 0.2, 2.6, 6), f.stone, place([x, 0.2, z], [0, yaw, Math.PI / 2]), { seed: 96 });
    chips(ms, f.stone, 16, 1.0, 4.0, 0, 0.2, 97);
    return ms.build();
  }
  // Crown: a capital ring, then sun rays fanning up (Dawn) or a crescent cradle with star points (Dusk).
  ms.lathe([[0, SHRINE.top], [0.85, SHRINE.top], [0.9, SHRINE.top + 0.12], [0.7, SHRINE.top + 0.24], [0, SHRINE.top + 0.24]], f.stone, new Vector3(), seg(20, lod, 8), { seed: 98 });
  const tips = lod === 2 ? 6 : 12;
  for (let i = 0; i < tips; i++) {
    const a = (i / tips) * Math.PI * 2;
    if (f.dawn) ms.add(new CylinderGeometry(0.0, 0.07, 0.9, 4), f.metal, place([Math.sin(a) * 0.62, SHRINE.top + 0.62, Math.cos(a) * 0.62], [Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45]));
    else if (i % 2 === 0) ms.add(new CylinderGeometry(0.0, 0.06, 0.5, 4), f.metal, place([Math.sin(a) * 0.7, SHRINE.top + 0.42, Math.cos(a) * 0.7], [Math.cos(a) * 0.7, 0, -Math.sin(a) * 0.7]));
  }
  addEmblem(ms, f, 0.55, at(0, SHRINE.top + 0.95, 0), lod);
  addEmblem(ms, f, 0.55, at(0, SHRINE.top + 0.95, 0).multiply(place([0, 0, 0], [0, Math.PI, 0])), lod);
  if (damage >= 1) {
    cracks(ms, f.stone, 1.62, 0.5, 0.95, damage === 1 ? 3 : 6, 99);
    chips(ms, f.stone, damage === 1 ? 5 : 12, 2.1, 3.2, 0, 0.12, 100);
  }
  return ms.build();
}

/** The Shrine's turning rings: three metal rings with emblem tabs, round the core. */
function shrineRings(f: Flock, lod: Lod): BufferGeometry {
  const ms = new Masonry();
  for (const [i, y] of [2.2, 3.3, 4.4].entries()) {
    const r = 1.0 - i * 0.08;
    ms.lathe([[r - 0.04, y - 0.07], [r + 0.04, y - 0.05], [r + 0.05, y + 0.05], [r - 0.04, y + 0.07]], f.metal, new Vector3(), seg(40, lod, 10));
    if (lod < 2) for (let j = 0; j < 6; j++) {
      const a = (j / 6) * Math.PI * 2 + i * 0.5;
      ms.add(new CylinderGeometry(0.1, 0.12, 0.06, seg(10, lod, 6)), f.metal, place([Math.sin(a) * (r + 0.07), y, Math.cos(a) * (r + 0.07)], [Math.PI / 2, a, 0]));
    }
  }
  return ms.build();
}

function shrineStatue(f: Flock, lod: Lod): BufferGeometry {
  const k = new Sculpt();
  const glow = STATE(2.4);
  // The core: a faceted crystal column in the flock colour, in a cage of metal straps, a cap and a bright heart.
  const core = new CylinderGeometry(0.3, 0.36, SHRINE.top - 1.1, 6, seg(4, lod, 1));
  k.mesh(core, { at: [0, 0.95 + (SHRINE.top - 1.1) / 2, 0], paint: (p) => mix(f.glow, f.light, 0.5 + 0.5 * Math.sin(p.y * 2.5)), finish: { glow, gloss: 1 } });
  k.mesh(new SphereGeometry(0.42, seg(12, lod), seg(8, lod)), { at: [0, 3.4, 0], scale: [1, 1.3, 1], paint: f.light, finish: { glow: STATE(3), gloss: 1 } });
  k.mesh(new IcosahedronGeometry(0.34, lod === 0 ? 1 : 0), { at: [0, SHRINE.top + 0.95, 0], paint: f.light, finish: { glow: STATE(3), gloss: 1 } });
  const sm = new StaticMesh();
  sm.sculpt(k);
  // Four small bronze hawks perched on the crown ring, looking out over the floor circle.
  if (lod === 0) for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const m = place([Math.sin(a) * 0.78, SHRINE.top + 0.22, Math.cos(a) * 0.78], [0, a, 0], [0.42, 0.42, 0.42]);
    const bird = new Sculpt();
    for (const side of [1, -1] as const) glowEye(bird, [side * 0.056, 1.279, 0.24], [side * 0.5, 0, 0.86], 0.05, f.glow, STATE(2), 6);
    beak(bird, { at: [0, 1.25, 0.28], len: 0.1, w: 0.034, up: 0.04, dn: 0.022, curve: 0.028, hook: 0.03, base: f.gild, tip: shade(f.gild, 0.6) }, detail(2));
    skinInto(sm, 'hawk', 2, { back: { paint: bronze(0x6b4f2f), finish: { gloss: 0.5 } }, breast: { paint: 0x7e5f3b, finish: { gloss: 0.5 } }, wing: { paint: 0x654a2c }, thigh: { paint: 0x735535 }, neck: { paint: 0x6b4f2f }, crown: { paint: 0x5e452a }, face: { paint: 0x846443 }, cheek: { paint: 0x7a5a3a }, brow: { paint: 0x4e3a24 }, nape: { paint: 0x6b4f2f }, throat: { paint: 0x8a6a44 }, bill: { paint: f.gild }, socket: { paint: 0x2a2018 } }, m);
    sm.sculpt(bird, m);
  }
  return sm.build();
}

// ---------------------------------------------------------------------------------------------------------------
// Patrons.

/** Where the Patron's bird sits (rig frame): its feet on the perch, scaled; the breast reaches the weak point. */
const PATRON = { dais: [[7.6, 0.5], [7.0, 0.5], [6.4, 0.45]] as const, perchY: 1.95, perchZ: 6.1, perchR: 0.48, feet: 2.38, z: 5.55, s: 7.6 } as const;

function patronArch(f: Flock, owl: boolean, lod: Lod, damage: Damage): BufferGeometry {
  const ms = new Masonry();
  floorRing(ms, f, 7.7, 8.6, lod);
  const top = steps(ms, PATRON.dais, f.stone, seg(28, lod, 8), 110);
  // The perch: a carved timber beam across the dais front on two stone blocks, bound with metal straps.
  for (const sx of [1, -1]) ms.lathe([[0, top], [0.7, top], [0.7, PATRON.perchY - 0.2], [0.6, PATRON.perchY], [0, PATRON.perchY]], f.stone, new Vector3(sx * 3.1, 0, PATRON.perchZ), 4, { seed: 111 });
  ms.add(new CylinderGeometry(PATRON.perchR, PATRON.perchR * 1.08, 8.2, seg(16, lod, 6)), 'timberDark', place([0, PATRON.perchY + PATRON.perchR * 0.6, PATRON.perchZ], [0, 0, Math.PI / 2]), { uv: 'cylinder', turn: true, seed: 112 });
  if (lod < 2) for (const x of [-3.4, -1.6, 1.6, 3.4]) ms.add(new TorusGeometry(PATRON.perchR * 1.05, 0.06, 5, seg(14, lod, 6)), f.metal, place([x, PATRON.perchY + PATRON.perchR * 0.6, PATRON.perchZ], [0, Math.PI / 2, 0]));
  // Crowned posts at the perch ends: a sun disc (Elder Raven, Dawn) or a crescent (Great Owl, Dusk).
  for (const sx of [1, -1]) {
    const x = sx * 3.9;
    ms.add(featherShaft(0.34, 0.28, top, 8.4, 8, lod), f.stone, at(x, 0, PATRON.perchZ - 0.4), { uv: 'cylinder', seed: 113 });
    ms.lathe([[0, 8.4], [0.5, 8.4], [0.55, 8.6], [0.4, 8.7], [0, 8.7]], f.metal, new Vector3(x, 0, PATRON.perchZ - 0.4), seg(14, lod, 6));
    addEmblem(ms, f, 1.0, at(x, 9.75, PATRON.perchZ - 0.4), lod);
    addEmblem(ms, f, 1.0, at(x, 9.75, PATRON.perchZ - 0.4).multiply(place([0, 0, 0], [0, Math.PI, 0])), lod);
  }
  // Pillars with banners round the back of the dais, and lanterns along its edge.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * (0.62 + (i / 3) * 0.76);
    const x = Math.sin(a) * 7.0;
    const z = Math.cos(a) * 7.0;
    const h = damage === 3 && i % 2 === 0 ? 3.5 : 10.5;
    if (h < 10) ms.add(stump(0.55, h, seg(12, lod, 6), 114 + i), f.stone, at(x, top, z), { seed: 115 });
    else {
      ms.add(featherShaft(0.55, 0.48, top, h, 12, lod), f.stone, at(x, 0, z), { uv: 'cylinder', seed: 116 + i });
      ms.lathe([[0, h], [0.75, h], [0.8, h + 0.2], [0.8, h + 0.35], [0, h + 0.35]], f.stone, new Vector3(x, 0, z), 4, { seed: 117 });
      banner(ms, f, place([x * 0.92, h - 0.6, z * 0.92], [0, a + Math.PI, 0]), 1.6, 4.2, lod, damage === 2, 118 + i);
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    lantern(ms, f, at(Math.sin(a) * 6.95, top - 0.45, Math.cos(a) * 6.95), 1.8, lod);
  }
  offerings(ms, f, [-5, -3.6, -2.2, 2.2, 3.6, 5].map((x) => at(x, PATRON.dais[0][1], 7.25)), lod, 120);
  if (damage >= 1) {
    cracks(ms, f.stone, 6.4, top - 0.45, top, damage === 1 ? 4 : 9, 121);
    chips(ms, f.stone, damage === 1 ? 8 : 20, 7.0, 8.4, 0, 0.25, 122);
  }
  void owl;
  return ms.build();
}

/** Large carved feather plates laid over a body's surface in offset rows, tips down, root and tip colours apart. */
function plates(k: Sculpt, surf: Surface, o: { t: readonly [number, number]; a: readonly [number, number]; rows: number; cols: number; len: number; wid: number; root: number; tip: number; finish: Finish; cell?: readonly [number, number]; rowsPer: number; seed: number }): void {
  for (let r = 0; r < o.rows; r++) for (let c = 0; c < o.cols; c++) {
    const j = r * o.cols + c;
    const t = o.t[1] - (o.t[1] - o.t[0]) * (o.rows === 1 ? 0.5 : r / (o.rows - 1));
    const a = o.a[0] + (o.a[1] - o.a[0]) * ((c + 0.5 + (r % 2) * 0.5) / (o.cols + 0.5)) + (jitter(j, o.seed) - 0.5) * 0.05;
    const sp = surf.at(t, a, 0.002);
    const down = sp.t.clone().negate();
    const dir = down.multiplyScalar(Math.cos(0.22)).addScaledVector(sp.n, Math.sin(0.22)).normalize();
    k.card({ at: [sp.p.x, sp.p.y, sp.p.z], dir: [dir.x, dir.y, dir.z], face: [sp.n.x, sp.n.y, sp.n.z], len: o.len * (0.92 + 0.16 * jitter(j, o.seed + 3)), wid: o.wid, cell: o.cell ?? CARD.contour, root: o.root, tip: o.tip, curl: -0.25, segs: o.rowsPer, cup: 0.08, finish: o.finish });
  }
}

function patronStatue(f: Flock, owl: boolean, lod: Lod, phase2: boolean): BufferGeometry {
  const k = new Sculpt();
  const d = detail(lod as Level);
  const s = PATRON.s;
  const dark = (hex: number): number => (phase2 ? shade(hex, 0.62) : hex);
  const seamGlow = STATE(phase2 ? 2.2 : 1.1);
  const iri = owl ? 0 : 0.4;
  const fin: Finish = { tile: TILE.scales, size: owl ? 0.045 : 0.04, gloss: owl ? 0.15 : 0.55, iri };
  const body = dark(owl ? 0x5c6070 : 0x1c1c26);
  const breast = dark(owl ? 0xa8acb8 : 0x23232f);
  const style: Record<string, RegionStyle> = owl
    ? {
      back: { paint: body, finish: { ...fin, tile: TILE.mottle } }, breast: { paint: (p) => mix(breast, dark(0x6a6e7c), Math.max(0, Math.sin(p.x * 60) * Math.sin(p.y * 9 + p.x * 20) - 0.55) * 1.6), finish: { ...fin, size: 0.04 } }, thigh: { paint: dark(0xb8bcc6), finish: { tile: TILE.wood, size: 0.03 } },
      crown: { paint: dark(0x6a6e7e), finish: { ...fin, tile: TILE.mottle } }, disc: { paint: dark(0xc8ccd4), finish: { tile: TILE.wood, size: 0.03 } }, ruff: { paint: dark(0x4a4e5c), finish: fin },
      ridge: { paint: dark(0xd8dce4) }, brow: { paint: dark(0xe4e6ec), finish: { tile: TILE.wood, size: 0.025 } },
    }
    : {
      back: { paint: body, finish: fin }, breast: { paint: breast, finish: fin }, thigh: { paint: body, finish: fin }, neck: { paint: body, finish: fin },
      hackle: { paint: dark(0x262634), finish: { ...fin, tile: TILE.wood, size: 0.03 } }, crown: { paint: dark(0x15151d), finish: fin }, face: { paint: dark(0x202028), finish: { iri } },
      cheek: { paint: dark(0x1e1e28), finish: fin }, brow: { paint: dark(0x121218), finish: fin }, nape: { paint: body, finish: fin }, throat: { paint: dark(0x262634), finish: fin },
      bill: { paint: dark(0x22222a), finish: { gloss: 0.8 } }, socket: { paint: 0x0c0c10 },
    };
  // Feather tips catch the flock colour: amber edges on the Raven always, glowing seams and rags in phase two.
  const tip = owl ? dark(0xd0d4dc) : phase2 ? mix(0x2a2a36, f.glow, 0.7) : mix(0x2a2a36, f.glow, 0.35);
  const plateFin: Finish = owl && !phase2 ? { gloss: 0.15 } : { gloss: owl ? 0.2 : 0.6, iri, glow: owl ? STATE(phase2 ? 2 : 0) : seamGlow };
  const root = owl ? dark(0x4a4e5c) : dark(0x15151d);
  const glowK = STATE(phase2 ? 2.6 : 1.9);
  const sm = new StaticMesh();
  const m = place([0, PATRON.feet, PATRON.z], [0, 0, 0], [s, s, s]);
  if (owl) {
    for (const side of [1, -1] as const) {
      glowEye(k, [side * 0.112, 1.04, 0.3], [side * 0.18, 0, 1], 0.036, f.glow, glowK, seg(14, lod, 6));
      // Ear tufts and the facial disc's rim feathers.
      for (let i = 0; i < (lod === 2 ? 1 : 3); i++) k.card({ at: [side * (0.15 + 0.03 * i), 1.22, 0.16 - 0.04 * i], dir: [side * 0.5, 1, -0.15], face: [0, 0, 1], len: 0.2 - 0.03 * i, wid: 0.07, cell: phase2 ? CARD.ragged : CARD.contour, root, tip, curl: -0.3, segs: d.rows, finish: plateFin });
      for (let i = 0; i < d.keep(9, 3); i++) {
        const a = -1.3 + (i / 8) * 2.6;
        k.card({ at: [side * (0.12 + Math.cos(a) * 0.17), 1.0 + Math.sin(a) * 0.17, 0.26], dir: [side * Math.cos(a), Math.sin(a), 0.15], face: [0, 0, 1], len: 0.06, wid: 0.05, cell: CARD.down, root: dark(0x3e4250), tip: dark(0x6a6e7e), segs: 2 });
      }
      featherWing(k, { side, shoulder: [side * 0.27, 0.86, -0.04], span: 0.62, chord: 0.36, raise: -0.9, sweep: 0.15, open: 0.12, roll: 1.25, root, tip, covert: dark(0x666a7a), finish: plateFin, rows: d.rows, ragged: phase2, primaries: lod === 2 ? 4 : 7, secondaries: lod === 2 ? 4 : 8 });
      limb(k, [side * 0.12, 0.12, 0.12], [side * 0.12, 0.05, 0.1], 0.04, 0.034, dark(0xb8bcc6), { tile: TILE.wood, size: 0.02 }, lod);
      if (lod < 2) talons(sm, m, [side * 0.12, 0.045, 0.11], 0.95, dark(0x8a8a90), f.gild, lod, side);
    }
    beak(k, { at: [0, 0.99, 0.33], len: 0.06, w: 0.026, up: 0.03, dn: 0.015, curve: 0.04, hook: 0.025, base: dark(0x3a3a44), tip: 0x1a1a20 }, d);
    featherFan(k, [0, 0.2, -0.26], [0, -0.7, -1], [0, 0.8, -0.56], { n: lod === 2 ? 4 : 8, len: 0.3, wid: 0.09, spread: 0.6, root, tip, rows: d.rows, finish: plateFin, cell: phase2 ? CARD.ragged : CARD.barredTail });
  } else {
    for (const side of [1, -1] as const) {
      glowEye(k, [side * 0.064, 1.115, 0.414], [side * 0.6, 0.05, 0.8], 0.034, f.glow, glowK, seg(14, lod, 6));
      featherWing(k, { side, shoulder: [side * 0.24, 0.9, -0.02], span: 0.95, chord: 0.46, raise: 0.38, sweep: -0.15, open: 0.62, roll: 0.55, root, tip: phase2 ? tip : mix(0x2a2a36, f.glow, 0.18), covert: dark(0x22222e), finish: phase2 ? plateFin : { gloss: 0.6, iri }, rows: d.rows, ragged: phase2, primaries: lod === 2 ? 5 : 9, secondaries: lod === 2 ? 5 : 10 });
      limb(k, [side * 0.12, 0.18, 0.1], [side * 0.12, 0.05, 0.1], 0.032, 0.026, dark(0x22222a), { tile: TILE.rings, size: 0.02, gloss: 0.4 }, lod);
      if (lod < 2) talons(sm, m, [side * 0.12, 0.045, 0.11], 1.0, dark(0x2a2a32), f.gild, lod, side);
    }
    // The heavy bill and the shaggy throat hackles.
    beak(k, { at: [0, 1.095, 0.47], len: 0.19, w: 0.045, up: 0.055, dn: 0.035, curve: 0.05, hook: 0.03, base: dark(0x22222a), tip: 0x111116 }, d);
    for (let i = 0; i < d.keep(10, 3); i++) {
      const a = (i / 9 - 0.5) * 1.7;
      k.card({ at: [Math.sin(a) * 0.1, 0.99, 0.38 + Math.cos(a) * 0.04], dir: [Math.sin(a) * 0.35, -1, 0.35], face: [Math.sin(a), 0, Math.cos(a)], len: 0.15, wid: 0.05, cell: CARD.ragged, root: dark(0x22222e), tip: phase2 ? tip : dark(0x2e2e3c), curl: 0.2, segs: d.rows, finish: plateFin });
    }
    featherFan(k, [0, 0.32, -0.3], [0, -0.75, -1], [0, 0.8, -0.6], { n: lod === 2 ? 5 : 10, len: 0.5, wid: 0.1, spread: 0.55, root, tip, rows: d.rows, finish: plateFin, cell: phase2 ? CARD.ragged : CARD.tail });
  }
  // Carved plates over the breast and back: the Raven's tips lit amber, the Owl's silvered; in phase two the plates
  // split along glowing seams in the flock colour.
  if (lod < 2) {
    const surf = new Field(WORLD_BODIES[owl ? 'greatOwl' : 'raven']()).only('back', 'breast').surface([0, 0.15, 0.02], [0, 1.0, 0.08]);
    const plateTip = phase2 ? f.light : owl ? dark(0xc8ccd6) : mix(0x2a2a36, f.glow, 0.55);
    const plateRoot = owl ? dark(0x4e5262) : dark(0x16161e);
    const plateFinish: Finish = { gloss: owl ? 0.2 : 0.6, iri, ...((phase2 || !owl) && { glow: phase2 ? STATE(2.2) : STATE(0.8) }) };
    const n = lod === 0 ? 1 : 0.6;
    plates(k, surf, { t: [0.3, 0.82], a: [-1.15, 1.15], rows: Math.round(6 * n), cols: Math.round(7 * n), len: 0.13 / Math.sqrt(n), wid: 0.1 / Math.sqrt(n), root: plateRoot, tip: plateTip, finish: plateFinish, rowsPer: d.rows, seed: 7, ...(phase2 && { cell: CARD.ragged }) });
    plates(k, surf, { t: [0.4, 0.88], a: [2.0, 4.3], rows: Math.round(5 * n), cols: Math.round(7 * n), len: 0.14 / Math.sqrt(n), wid: 0.11 / Math.sqrt(n), root: plateRoot, tip: plateTip, finish: plateFinish, rowsPer: d.rows, seed: 9, ...(phase2 && { cell: CARD.ragged }) });
  }
  skinInto(sm, owl ? 'greatOwl' : 'raven', lod, style, m);
  sm.sculpt(k, m);
  return sm.build();
}

/** The heart-feather: a bright feather with a white rachis inside a glowing halo (drawn unlit, the brightest thing). */
function heartFeather(): BufferGeometry {
  return new Parts()
    .ell(S.heartColour, [0.34, 0.92, 0.14], [0, 0, 0], [0, 0, 0], [12, 8])
    .rod(0xffffff, [0, -1, 0], [0, 0.92, 0], 0.05)
    .ell(0xfff6c8, [0.2, 0.6, 0.16], [0, 0.08, 0.04], [0, 0, 0], [10, 6])
    .build();
}

// ---------------------------------------------------------------------------------------------------------------

interface Design {
  arch(lod: Lod, damage: Damage): BufferGeometry;
  statue(lod: Lod, variant: number): BufferGeometry;
  rings?: (lod: Lod) => BufferGeometry;
  heart?: BufferGeometry;
  fall: Fall;
  height: number;
}

function design(type: StructureType, f: Flock, body: StructureBody, owl: boolean): Design {
  switch (type) {
    case 'hawk':
      return { arch: (l, d) => hawkArch(f, l, d), statue: (l) => hawkStatue(f, l), height: HAWK.capTop + 1.95, fall: { to: [3.1, 0.35, 1.2], rot: [0.2, 0.9, -1.45], pivot: [0.9, HAWK.capTop, 0], time: 1.6 } };
    case 'heron':
      return { arch: (l, d) => heronArch(f, l, d), statue: (l, v) => heronStatue(f, l, v), height: HERON.top + 0.45, fall: { to: [0.3, -2.9, 3.4], rot: [1.35, 0.2, 0.1], pivot: [0, HERON.plinth, 1.6], time: 1.8 } };
    case 'warden':
      return { arch: (l, d) => wardenArch(f, body, l, d), statue: (l) => wardenStatue(f, body, l), height: S.wardenHeight, fall: { to: [0, -5.6, 1.4], rot: [0.5, 0, 0], pivot: [0, 1.8, 0.5], time: 1.3 } };
    case 'shrine':
    case 'nest':
      return { arch: (l, d) => shrineArch(f, l, d), statue: (l) => shrineStatue(f, l), rings: (l) => shrineRings(f, l), height: SHRINE.top + 1.6, fall: { to: [0, -3.4, 0], rot: [0, 0, 0], pivot: [0, 0, 0], time: 1.0 } };
    case 'patron':
      return { arch: (l, d) => patronArch(f, owl, l, d), statue: (l, v) => patronStatue(f, owl, l, v === 1), heart: heartFeather(), height: PATRON.feet + 1.3 * PATRON.s, fall: { to: [0, -1.2, 1.6], rot: [0.45, 0, 0.12], pivot: [0, PATRON.feet, PATRON.perchZ], time: 2.2 } };
  }
}

/** A structure model for a flock; the body is StructureInfo.body. Geometry variants are built on first use and cached. */
export function buildStructure(type: StructureType, team: 'dawn' | 'dusk', colours: TeamColours, body: StructureBody): StructureBuild {
  const owl = team === 'dusk';
  const d = design(type, flockOf(colours, owl), body, owl);
  const arches = new Map<number, BufferGeometry>();
  const statues = new Map<number, BufferGeometry>();
  const rings = new Map<number, BufferGeometry>();
  const cached = (m: Map<number, BufferGeometry>, key: number, make: () => BufferGeometry): BufferGeometry => {
    let g = m.get(key);
    if (!g) {
      g = make();
      m.set(key, g);
    }
    return g;
  };
  const ringsOf = d.rings;
  return {
    arch: (lod, damage) => cached(arches, lod * 4 + damage, () => {
      const g = d.arch(lod, damage);
      // Baked shading (§7.4): faces under overhangs and the ground-contact band darker.
      bakeAO(g, { rays: false, ground: () => 0 });
      return g;
    }),
    statue: (lod, variant) => cached(statues, lod * 4 + variant, () => d.statue(lod, variant)),
    ...(ringsOf && { rings: (lod: Lod) => cached(rings, lod, () => ringsOf(lod)) }),
    ...(d.heart && { heart: d.heart }),
    fall: d.fall,
    height: d.height,
    dome: dome(body, Math.min(d.height, type === 'patron' ? 11 : d.height)),
  };
}
