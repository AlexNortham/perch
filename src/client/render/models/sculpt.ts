/* eslint-disable @typescript-eslint/no-magic-numbers -- authored geometry: the numbers are the shapes */
/**
 * Sculpted geometry for production birds (style guide §4.3, §8; D-ART-004). A Sculpt collects one rig bone's
 * geometry in that bone's frame, in two layers: SOLID (smooth lofts, three.js solids, bevelled hard pieces) and CARDS
 * (alpha-tested feather cards, double-sided). Every vertex carries a vertex colour (painted in sRGB, mixed by the
 * helpers below), a uv into its pattern, and a finish `fx` = (iridescence, glow, gloss, tile) read by the bird
 * material. Any primitive may carry a transform per morph target (display, jaw, blink), applied in the bone frame.
 *
 * Axes are the model's: +z forward, +y up, +x the bird's left.
 */
import { BufferGeometry, Color, Euler, Float32BufferAttribute, Matrix3, Matrix4, Quaternion, Uint16BufferAttribute, Uint32BufferAttribute, Vector3 } from 'three';
import type { BufferAttribute } from 'three';
import { cardUv, outline, rachisTip, SHAPE, TILE } from './feathers';
import type { Feather } from './feathers';

export type V3 = readonly [number, number, number];
export const MORPHS = ['display', 'jaw', 'blink'] as const;
/** fx.w carries the pattern tile plus up to this much fade (bird-material.ts reads it back). */
export const PATTERN_FADE = 0.45;
export type Morph = (typeof MORPHS)[number];
export type Morphs = Partial<Record<Morph, Matrix4>>;

/** Surface finish: the solid atlas tile and its size (m per repeat), iridescence (0–1), emissive glow, gloss (0–1). */
export interface Finish {
  readonly tile?: number;
  readonly size?: number;
  readonly iri?: number;
  readonly glow?: number;
  readonly gloss?: number;
}

/** Where a primitive goes in its bone's frame, and how each morph target moves it. */
export interface Place {
  readonly at?: V3;
  readonly rot?: V3;
  readonly scale?: V3;
  /** A frame the placement is nested in (applied after at, rot and scale). */
  readonly frame?: Matrix4;
  readonly morph?: Morphs;
}

/** A colour (0xRRGGBB, sRGB) or a painter by position along (t, 0–1) and around (a, radians) a loft. */
export type Paint = number | ((t: number, a: number, p: Vector3) => number);

/** A loft control ring: centre, half-width (x side), top and bottom radii, optional cross-section up direction. */
export interface Ring {
  readonly c: V3;
  readonly w: number;
  readonly up: number;
  readonly dn?: number;
  readonly n?: V3;
}

export interface LoftOptions extends Place {
  /** Interpolated rings (Catmull-Rom through the control rings); default: the control rings as given. */
  readonly n?: number;
  /** Segments round the cross-section. */
  readonly seg?: number;
  /** Reference "up" for cross-sections (default +y; +z suits lofts that run down, such as legs). */
  readonly ref?: V3;
  /** Squareness of the cross-section: 2 an ellipse, higher boxier (straps, gun stocks). */
  readonly sq?: number;
  readonly paint?: Paint;
  readonly finish?: Finish;
  /** Close open ends with flat caps (rings of zero radius close themselves). */
  readonly caps?: boolean;
  /** Run the surface pattern round the loft instead of along it (hair falling down a horizontal body). */
  readonly uvSwap?: boolean;
}

export interface CardOptions {
  /** Root of the feather, its direction root → tip, and the face normal (orthogonalised against `dir`). */
  readonly at: V3;
  readonly dir: V3;
  readonly face: V3;
  readonly len: number;
  readonly wid: number;
  /** The feather: its outline shape and painted pattern (feathers.ts CARD). */
  readonly cell: Feather;
  /** Bend out of the plane toward the face normal over the length (rad, + curls toward the face). */
  readonly curl?: number;
  /** In-plane curve over the length (rad, + toward the card's +x = dir × face). */
  readonly sweep?: number;
  /** Rows along the length (default 4; the outline needs at least 2) and a raised rachis (cupped vane) when > 0. */
  readonly segs?: number;
  readonly cup?: number;
  /** Root and tip colours. */
  readonly root: number;
  readonly tip?: number;
  readonly finish?: Finish;
  readonly morph?: Morphs;
}

/** A point on a loft's surface: position, outward normal and the loft's direction there. */
export interface SurfacePoint {
  readonly p: Vector3;
  readonly n: Vector3;
  readonly t: Vector3;
}

export interface Surface {
  /** Point at t (0 start, 1 end) and angle a (0 the +side, π/2 up), lifted `off` metres off the surface. */
  at(t: number, a: number, off?: number): SurfacePoint;
}

// ---------------------------------------------------------------------------------------------------------------
// Colour helpers (sRGB hex in, hex out): painting is done the way a painter mixes, not in linear light.

const ch = (hex: number, s: number): number => (hex >> s) & 0xff;
export function mix(a: number, b: number, k: number): number {
  const t = Math.min(1, Math.max(0, k));
  const m = (s: number): number => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t) << s;
  return m(16) | m(8) | m(0);
}
export const shade = (hex: number, k: number): number => (k < 1 ? mix(0, hex, k) : mix(hex, 0xffffff, k - 1));
/** Seeded 0–1 jitter for authored variation. */
export function jitter(i: number, seed = 0): number {
  let h = Math.imul(i + 0x9e3779b9 * (seed + 1), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------------------------------------------

class Layer {
  readonly p: number[] = [];
  readonly n: number[] = [];
  readonly uv: number[] = [];
  readonly c: number[] = [];
  readonly fx: number[] = [];
  readonly m: number[][] = MORPHS.map(() => []);
  readonly mn: number[][] = MORPHS.map(() => []);
  readonly i: number[] = [];
  get count(): number {
    return this.p.length / 3;
  }
}

const colour = new Color();
const linear = new Map<number, readonly [number, number, number]>();
function toLinear(hex: number): readonly [number, number, number] {
  let c = linear.get(hex);
  if (!c) {
    colour.setHex(hex);
    c = [colour.r, colour.g, colour.b];
    linear.set(hex, c);
  }
  return c;
}

const tmpP = new Vector3();
const tmpN = new Vector3();
const tmpM = new Vector3();
const eul = new Euler();
const qt = new Quaternion();
const sc = new Vector3();
const ps = new Vector3();

export function placement(o: Place): Matrix4 {
  const at = o.at ?? [0, 0, 0];
  const rot = o.rot ?? [0, 0, 0];
  const s = o.scale ?? [1, 1, 1];
  const m = new Matrix4().compose(ps.set(at[0], at[1], at[2]), qt.setFromEuler(eul.set(rot[0], rot[1], rot[2])), sc.set(s[0], s[1], s[2]));
  return o.frame ? o.frame.clone().multiply(m) : m;
}

/** A frame at `at` whose +z looks along `look`, +y as near `up` as it can be. */
export function frameAt(at: V3, look: V3, up: V3 = [0, 1, 0]): Matrix4 {
  const z = new Vector3(...look).normalize();
  let x = new Vector3(...up).cross(z);
  if (x.lengthSq() < 1e-8) x = new Vector3(1, 0, 0).cross(z);
  x.normalize();
  const y = new Vector3().crossVectors(z, x);
  return new Matrix4().makeBasis(x, y, z).setPosition(at[0], at[1], at[2]);
}

/** A morph matrix given in a frame, expressed in the frame's parent (the bone). */
export function inFrame(frame: Matrix4, m: Matrix4): Matrix4 {
  return frame.clone().multiply(m).multiply(frame.clone().invert());
}

/** A rotation by `angle` about the axis through `pivot` along `axis` (morph targets: jaws, lids, fans). */
export function hinge(pivot: V3, axis: V3, angle: number): Matrix4 {
  const ax = new Vector3(axis[0], axis[1], axis[2]).normalize();
  const t = new Matrix4().makeTranslation(pivot[0], pivot[1], pivot[2]);
  const r = new Matrix4().makeRotationAxis(ax, angle);
  const back = new Matrix4().makeTranslation(-pivot[0], -pivot[1], -pivot[2]);
  return t.multiply(r).multiply(back);
}

/** Catmull-Rom on a list of numbers or points: value at u in [0, count-1]. */
function cr(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
}

interface FullRing {
  c: Vector3;
  w: number;
  up: number;
  dn: number;
  n: Vector3 | null;
}

function resample(rings: readonly Ring[], count: number): FullRing[] {
  const full = (r: Ring): FullRing => ({ c: new Vector3(r.c[0], r.c[1], r.c[2]), w: r.w, up: r.up, dn: r.dn ?? r.up, n: r.n ? new Vector3(r.n[0], r.n[1], r.n[2]) : null });
  if (count === rings.length) return rings.map(full);
  // Fewer rings than given (lower detail): keep the ends and every ring nearest an even step between them.
  if (count < rings.length) {
    const keep = Math.max(2, count);
    return Array.from({ length: keep }, (_, k) => full(rings[Math.round((k / (keep - 1)) * (rings.length - 1))] as Ring));
  }
  const src = rings.map(full);
  const at = (i: number): FullRing => src[Math.max(0, Math.min(src.length - 1, i))] as FullRing;
  const out: FullRing[] = [];
  for (let k = 0; k < count; k++) {
    const u = (k / (count - 1)) * (src.length - 1);
    const i = Math.min(src.length - 2, Math.floor(u));
    const t = u - i;
    const [a, b, c, d] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const v = (f: (r: FullRing) => number): number => cr(f(a), f(b), f(c), f(d), t);
    const nA = b.n;
    const nB = c.n;
    out.push({
      c: new Vector3(v((r) => r.c.x), v((r) => r.c.y), v((r) => r.c.z)),
      w: Math.max(0, v((r) => r.w)),
      up: Math.max(0, v((r) => r.up)),
      dn: Math.max(0, v((r) => r.dn)),
      n: nA && nB ? nA.clone().lerp(nB, t).normalize() : (nA ?? nB)?.clone() ?? null,
    });
  }
  return out;
}

/** Superellipse cross-section point at angle a: x along side, y along up. */
function section(a: number, w: number, up: number, dn: number, sq: number): [number, number] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const e = 2 / sq;
  const x = Math.sign(c) * Math.abs(c) ** e * w;
  const y = Math.sign(s) * Math.abs(s) ** e * (s >= 0 ? up : dn);
  return [x, y];
}

export class Sculpt {
  readonly solid = new Layer();
  readonly cards = new Layer();

  // The transform of the primitive being added, its normal matrix, and each morph's matrix and normal matrix.
  private M = new Matrix4();
  private readonly NM = new Matrix3();
  private morph: (Matrix4 | undefined)[] = [];
  private readonly morphN: Matrix3[] = MORPHS.map(() => new Matrix3());

  private begin(M: Matrix4, morph: Morphs | undefined): void {
    this.M = M;
    this.NM.getNormalMatrix(M);
    this.morph = MORPHS.map((k) => morph?.[k]);
    this.morph.forEach((m, i) => m && (this.morphN[i] as Matrix3).getNormalMatrix(m));
  }

  /** Push one vertex: local position and normal through the primitive's transform, then each morph's. */
  private put(L: Layer, x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, v: number, hex: number, f: Finish, fade = 0): void {
    tmpP.set(x, y, z).applyMatrix4(this.M);
    tmpN.set(nx, ny, nz).applyMatrix3(this.NM).normalize();
    L.p.push(tmpP.x, tmpP.y, tmpP.z);
    L.n.push(tmpN.x, tmpN.y, tmpN.z);
    L.uv.push(u, v);
    const c = toLinear(hex);
    L.c.push(c[0], c[1], c[2]);
    // The tile index, plus up to PATTERN_FADE of fade: the pattern weakens toward a loft's closed ends.
    L.fx.push(f.iri ?? 0, f.glow ?? 0, f.gloss ?? 0, (f.tile ?? TILE.flat) + PATTERN_FADE * Math.min(1, Math.max(0, fade)));
    for (let i = 0; i < MORPHS.length; i++) {
      const mm = this.morph[i];
      const mp = L.m[i] as number[];
      const mn = L.mn[i] as number[];
      if (!mm) {
        mp.push(0, 0, 0);
        mn.push(0, 0, 0);
        continue;
      }
      tmpM.copy(tmpP).applyMatrix4(mm);
      mp.push(tmpM.x - tmpP.x, tmpM.y - tmpP.y, tmpM.z - tmpP.z);
      tmpM.copy(tmpN).applyMatrix3(this.morphN[i] as Matrix3).normalize();
      mn.push(tmpM.x - tmpN.x, tmpM.y - tmpN.y, tmpM.z - tmpN.z);
    }
  }

  /**
   * A smooth lofted form through control rings (bodies, necks, heads, bills, legs, toes, straps, barrels). Returns
   * its surface, for placing feathers and gear on it.
   */
  loft(rings: readonly Ring[], o: LoftOptions = {}): Surface {
    const R = resample(rings, o.n ?? rings.length);
    const seg = o.seg ?? 16;
    const sq = o.sq ?? 2;
    const ref = new Vector3(...(o.ref ?? [0, 1, 0]));
    const f = o.finish ?? {};
    const tileSize = f.size ?? 0.08;
    const M = placement(o);
    this.begin(M, o.morph);
    const nR = R.length;
    // Frames: tangent from neighbours, side = up-ref × tangent, up = tangent × side.
    const T: Vector3[] = [];
    const S: Vector3[] = [];
    const U: Vector3[] = [];
    for (let i = 0; i < nR; i++) {
      const a = (R[Math.max(0, i - 1)] as FullRing).c;
      const b = (R[Math.min(nR - 1, i + 1)] as FullRing).c;
      const t = b.clone().sub(a).normalize();
      const r = (R[i] as FullRing).n ?? ref;
      let s = r.clone().cross(t);
      if (s.lengthSq() < 1e-8) s = new Vector3(1, 0, 0).cross(t);
      s.normalize();
      T.push(t);
      S.push(s);
      U.push(t.clone().cross(s).normalize());
    }
    // Positions on the grid (seg + 1 columns: the seam repeats for the uv).
    const P: Vector3[][] = [];
    for (let i = 0; i < nR; i++) {
      const r = R[i] as FullRing;
      const row: Vector3[] = [];
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * Math.PI * 2;
        const [x, y] = section(a, r.w, r.up, r.dn, sq);
        row.push(r.c.clone().addScaledVector(S[i] as Vector3, x).addScaledVector(U[i] as Vector3, y));
      }
      P.push(row);
    }
    // Distance along the loft measured over its surface (the mean of each column's step), so patterns keep their size
    // where a closed end turns to face along the loft.
    let len = 0;
    const along: number[] = [0];
    for (let i = 1; i < nR; i++) {
      let step = 0;
      for (let j = 0; j < seg; j++) step += ((P[i] as Vector3[])[j] as Vector3).distanceTo((P[i - 1] as Vector3[])[j] as Vector3);
      len += step / seg;
      along.push(len);
    }
    const L = this.solid;
    const base = L.count;
    const paint = o.paint ?? 0xffffff;
    const dj = new Vector3();
    const di = new Vector3();
    const nrm = new Vector3();
    const big = Math.max(...R.map((r) => r.w + (r.up + r.dn) / 2), 1e-6);
    for (let i = 0; i < nR; i++) {
      const r = R[i] as FullRing;
      const row = P[i] as Vector3[];
      const circ = Math.PI * (r.w + (r.up + r.dn) / 2);
      // Rings squeeze toward a closed end; the pattern fades there rather than pinching into concentric rings.
      const fade = 1 - Math.min(1, (r.w + (r.up + r.dn) / 2) / (big * 0.7));
      for (let j = 0; j <= seg; j++) {
        const jp = j === seg ? 1 : j + 1;
        const jm = j === 0 ? seg - 1 : j - 1;
        dj.subVectors(row[jp] as Vector3, row[jm] as Vector3);
        di.subVectors((P[Math.min(nR - 1, i + 1)] as Vector3[])[j] as Vector3, (P[Math.max(0, i - 1)] as Vector3[])[j] as Vector3);
        nrm.crossVectors(dj, di);
        if (nrm.lengthSq() < 1e-12 || r.w + r.up + r.dn < 1e-5) nrm.copy(T[i] as Vector3).multiplyScalar(i < nR / 2 ? -1 : 1);
        nrm.normalize();
        const p = row[j] as Vector3;
        const t = len > 0 ? (along[i] as number) / len : 0;
        const a = (j / seg) * Math.PI * 2;
        const hex = typeof paint === 'number' ? paint : paint(t, a, p);
        const u = f.tile === undefined || f.tile === TILE.flat ? 0.5 : ((j / seg) * Math.max(circ, 1e-3)) / tileSize;
        const v = f.tile === undefined || f.tile === TILE.flat ? 0.5 : (along[i] as number) / tileSize;
        if (o.uvSwap) this.put(L, p.x, p.y, p.z, nrm.x, nrm.y, nrm.z, v, u, hex, f, fade);
        else this.put(L, p.x, p.y, p.z, nrm.x, nrm.y, nrm.z, u, v, hex, f, fade);
      }
    }
    const w = seg + 1;
    for (let i = 0; i < nR - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const a = base + i * w + j;
        const b = a + 1;
        const c = a + w;
        const d = c + 1;
        L.i.push(a, b, c, b, d, c);
      }
    }
    if (o.caps) {
      for (const end of [0, nR - 1]) {
        const r = R[end] as FullRing;
        if (r.w + r.up + r.dn < 1e-5) continue;
        const t = (T[end] as Vector3).clone().multiplyScalar(end === 0 ? -1 : 1);
        const centre = L.count;
        const hex = typeof paint === 'number' ? paint : paint(end === 0 ? 0 : 1, 0, r.c);
        this.put(L, r.c.x, r.c.y, r.c.z, t.x, t.y, t.z, 0.5, 0.5, hex, f);
        const first = L.count;
        for (let j = 0; j < seg; j++) {
          const p = (P[end] as Vector3[])[j] as Vector3;
          this.put(L, p.x, p.y, p.z, t.x, t.y, t.z, 0.5, 0.5, typeof paint === 'number' ? paint : paint(end === 0 ? 0 : 1, (j / seg) * Math.PI * 2, p), f);
        }
        for (let j = 0; j < seg; j++) {
          const a = first + j;
          const b = first + ((j + 1) % seg);
          if (end === 0) L.i.push(centre, b, a);
          else L.i.push(centre, a, b);
        }
      }
    }
    return {
      at: (t: number, a: number, off = 0): SurfacePoint => {
        const u = Math.min(nR - 1.0001, Math.max(0, t * (nR - 1)));
        const i = Math.floor(u);
        const k = u - i;
        const r0 = R[i] as FullRing;
        const r1 = R[i + 1] as FullRing;
        const lerp = (x: number, y: number): number => x + (y - x) * k;
        const w2 = lerp(r0.w, r1.w);
        const up = lerp(r0.up, r1.up);
        const dn = lerp(r0.dn, r1.dn);
        const s = (S[i] as Vector3).clone().lerp(S[i + 1] as Vector3, k).normalize();
        const uu = (U[i] as Vector3).clone().lerp(U[i + 1] as Vector3, k).normalize();
        const tt = (T[i] as Vector3).clone().lerp(T[i + 1] as Vector3, k).normalize();
        const [x, y] = section(a, w2, up, dn, sq);
        const ry = Math.sin(a) >= 0 ? up : dn;
        const n = s.clone().multiplyScalar(Math.cos(a) / Math.max(w2, 1e-4)).addScaledVector(uu, Math.sin(a) / Math.max(ry, 1e-4)).normalize();
        const p = r0.c.clone().lerp(r1.c, k).addScaledVector(s, x).addScaledVector(uu, y).addScaledVector(n, off);
        return { p: p.applyMatrix4(M), n: n.transformDirection(M), t: tt.transformDirection(M) };
      },
    };
  }

  /** Any three.js geometry (spheres, tori, lathes, extrusions, rounded boxes), painted and finished. */
  mesh(g: BufferGeometry, o: Place & { paint?: number | ((p: Vector3) => number); finish?: Finish; uv?: readonly [number, number] } = {}): this {
    const M = placement(o);
    this.begin(M, o.morph);
    const pos = g.getAttribute('position') as BufferAttribute;
    if (!g.getAttribute('normal')) g.computeVertexNormals();
    const nor = g.getAttribute('normal') as BufferAttribute;
    const uv = g.getAttribute('uv') as BufferAttribute | undefined;
    const f = o.finish ?? {};
    const flat = f.tile === undefined || f.tile === TILE.flat;
    const [su, sv] = o.uv ?? [1, 1];
    const L = this.solid;
    const base = L.count;
    const p = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      const hex = typeof o.paint === 'function' ? o.paint(p) : (o.paint ?? 0xffffff);
      const u = flat || !uv ? 0.5 : uv.getX(i) * su;
      const v = flat || !uv ? 0.5 : uv.getY(i) * sv;
      this.put(L, p.x, p.y, p.z, nor.getX(i), nor.getY(i), nor.getZ(i), u, v, hex, f);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) L.i.push(base + g.index.getX(i));
    else for (let i = 0; i < pos.count; i++) L.i.push(base + i);
    g.dispose();
    return this;
  }

  /**
   * A feather: solid tapered geometry root → tip whose outline is the feather's shape (so its edge is clean at every
   * distance), optionally curled, swept and cupped, its vane painted by an opaque pattern and a root-to-tip gradient.
   * Drawn double-sided in the feather layer.
   */
  card(o: CardOptions): this {
    if (o.len <= 0 || o.wid <= 0) return this;
    const [shape, pat] = o.cell;
    const dir = new Vector3(...o.dir).normalize();
    const face = new Vector3(...o.face);
    face.addScaledVector(dir, -face.dot(dir)).normalize();
    if (face.lengthSq() < 1e-8) face.set(0, 1, 0);
    const across = new Vector3().crossVectors(dir, face).normalize();
    const M = new Matrix4().makeBasis(across, dir, face).setPosition(o.at[0], o.at[1], o.at[2]);
    this.begin(M, o.morph);
    const [u0, v0, u1, v1] = cardUv(pat);
    const L = this.cards;
    const base = L.count;
    const f = o.finish ?? {};
    if (shape === SHAPE.blur) {
      // A wing beat: a fan of wedges from the root, ±1.2 rad about the card's direction.
      const wedges = Math.max(4, o.segs ?? 8);
      const r = o.len;
      this.put(L, 0, 0, 0, 0, 0, 1, (u0 + u1) / 2, v0, o.root, f);
      for (let i = 0; i <= wedges; i++) {
        const ang = -1.2 + (2.4 * i) / wedges;
        const x = Math.sin(ang) * r;
        const y = Math.cos(ang) * r;
        this.put(L, x, y, 0, 0, 0, 1, u0 + (u1 - u0) * (0.5 + x / (2 * r)), v0 + (v1 - v0) * (y / r), o.tip ?? o.root, f);
      }
      for (let i = 0; i < wedges; i++) L.i.push(base, base + 1 + i, base + 2 + i);
      return this;
    }
    const segs = Math.max(2, o.segs ?? 4);
    const curl = o.curl ?? 0;
    const sweep = o.sweep ?? 0;
    const cup = (o.cup ?? 0) * o.wid;
    const tipRachis = rachisTip(shape);
    // Walk the centreline in card space (x across, y along, z out of the face), rows closer together near the tip.
    let x = 0;
    let y = 0;
    let z = 0;
    let pitch = 0;
    let yaw = 0;
    let prevS = 0;
    for (let k = 0; k <= segs; k++) {
      const s = 1 - (1 - k / segs) ** 1.8;
      const step = (s - prevS) * o.len;
      prevS = s;
      if (k > 0) {
        pitch += (curl * step) / o.len;
        yaw += (sweep * step) / o.len;
        x += Math.sin(yaw) * Math.cos(pitch) * step;
        y += Math.cos(yaw) * Math.cos(pitch) * step;
        z += Math.sin(pitch) * step;
      }
      const hex = o.tip === undefined ? o.root : mix(o.root, o.tip, s);
      const ax = Math.cos(yaw);
      const ay = -Math.sin(yaw);
      const nz = Math.cos(pitch);
      const ny = -Math.sin(pitch) * Math.cos(yaw);
      const nx = -Math.sin(pitch) * Math.sin(yaw);
      const [wl, wr] = outline(shape, s);
      // The rachis ends short of the edges on a notched (ragged) tip.
      const back = k === segs ? (1 - tipRachis) * o.len : 0;
      const columns: [number, number, number][] = [
        [-wl * (o.wid / 2), 0, 0],
        [0, cup * Math.min(1, s * 4) * (1 - s), back],
        [wr * (o.wid / 2), 0, 0],
      ];
      const v = v0 + (v1 - v0) * s;
      columns.forEach(([cx, lift, shorten], c) => {
        const px = x + ax * cx + nx * lift - Math.sin(yaw) * shorten;
        const py = y + ay * cx + ny * lift - Math.cos(yaw) * shorten;
        const pz = z + nz * lift;
        const u = u0 + (u1 - u0) * (0.5 + cx / o.wid);
        this.put(L, px, py, pz, nx, ny, nz, u, v, c === 1 ? shade(hex, 1.06) : hex, f);
      });
    }
    for (let k = 0; k < segs; k++) {
      for (let c = 0; c < 2; c++) {
        const a = base + k * 3 + c;
        const b = a + 1;
        const d = a + 3;
        const e = d + 1;
        L.i.push(a, b, d, b, e, d);
      }
    }
    return this;
  }


  /** Triangles in each layer. */
  triangles(): { solid: number; cards: number } {
    return { solid: this.solid.i.length / 3, cards: this.cards.i.length / 3 };
  }
}

/** Merge the same layer of several Sculpts (one per bone, in bone order) into one skinned geometry. */
export function bake(parts: readonly (Sculpt | undefined)[], layer: 'solid' | 'cards'): { geo: BufferGeometry; ranges: [number, number][] } {
  const p: number[] = [];
  const n: number[] = [];
  const uv: number[] = [];
  const c: number[] = [];
  const fx: number[] = [];
  const m: number[][] = MORPHS.map(() => []);
  const mn: number[][] = MORPHS.map(() => []);
  const idx: number[] = [];
  const skin: number[] = [];
  const ranges: [number, number][] = [];
  parts.forEach((s, bone) => {
    const L = s?.[layer];
    const first = p.length / 3;
    const count = L?.count ?? 0;
    ranges.push([first, count]);
    if (!L || count === 0) return;
    for (const v of L.i) idx.push(v + first);
    const append = (dst: number[], src: readonly number[]): void => {
      for (const x of src) dst.push(x);
    };
    append(p, L.p);
    append(n, L.n);
    append(uv, L.uv);
    append(c, L.c);
    append(fx, L.fx);
    MORPHS.forEach((_, i) => {
      append(m[i] as number[], L.m[i] as number[]);
      append(mn[i] as number[], L.mn[i] as number[]);
    });
    for (let k = 0; k < count; k++) skin.push(bone);
  });
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(p, 3));
  geo.setAttribute('normal', new Float32BufferAttribute(n, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new Float32BufferAttribute(c, 3));
  geo.setAttribute('fx', new Float32BufferAttribute(fx, 4));
  geo.morphAttributes['position'] = m.map((a) => new Float32BufferAttribute(a, 3));
  geo.morphAttributes['normal'] = mn.map((a) => new Float32BufferAttribute(a, 3));
  geo.morphTargetsRelative = true;
  const count = p.length / 3;
  const si = new Uint16Array(count * 4);
  const sw = new Float32Array(count * 4);
  skin.forEach((b, k) => {
    si[k * 4] = b;
    sw[k * 4] = 1;
  });
  geo.setAttribute('skinIndex', new Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new Float32BufferAttribute(sw, 4));
  geo.setIndex(new Uint32BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return { geo, ranges };
}
