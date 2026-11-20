/**
 * The environment's geometry builder. Every model is written straight into growable typed arrays in world space,
 * already in the material library's geometry contract (position, normal, `uv` in tiles, `color`, `matLayer`; see
 * ../materials), so a whole cell merges into one batch entry without per-piece BufferGeometry objects.
 *
 * Coordinates go through a local frame (`frame`, a rigid Matrix4): models are written in their own space (x across,
 * y up, z out of a wall or along a prop's yaw) and land in the world. Surfaces get planar uv from their world normal
 * (walls keep courses level), cylinders and tubes wrap uv around, and cards keep 0..1.
 */
import { BufferAttribute, BufferGeometry, Color, Matrix4, Quaternion, Vector3 } from 'three';
import { RECIPES, layerOf } from '../materials';
import type { MaterialId } from '../materials';
import { SHADE } from './constants';

const XYZ = 3;
const UV = 2;
const FLOOR_NORMAL_Y = 0.9;
const GROW = 2;
const START = 1024;
const UP = new Vector3(0, 1, 0);
const WHITE = 0xffffff;

class Floats {
  a = new Float32Array(START);
  n = 0;
  push3(x: number, y: number, z: number): void {
    if (this.n + XYZ > this.a.length) this.grow();
    this.a[this.n++] = x;
    this.a[this.n++] = y;
    this.a[this.n++] = z;
  }
  push2(x: number, y: number): void {
    if (this.n + UV > this.a.length) this.grow();
    this.a[this.n++] = x;
    this.a[this.n++] = y;
  }
  push1(x: number): void {
    if (this.n + 1 > this.a.length) this.grow();
    this.a[this.n++] = x;
  }
  private grow(): void {
    const b = new Float32Array(this.a.length * GROW);
    b.set(this.a);
    this.a = b;
  }
  view(): Float32Array {
    return this.a.slice(0, this.n);
  }
}

class Ints {
  a = new Uint32Array(START);
  n = 0;
  push3(x: number, y: number, z: number): void {
    if (this.n + XYZ > this.a.length) {
      const b = new Uint32Array(this.a.length * GROW);
      b.set(this.a);
      this.a = b;
    }
    this.a[this.n++] = x;
    this.a[this.n++] = y;
    this.a[this.n++] = z;
  }
}

/** How a surface is painted: a library material, an sRGB tint, and a value multiplier (baked shade). */
export interface Paint {
  readonly mat: MaterialId;
  readonly tint?: number;
  readonly shade?: number;
}

/** Per-vertex light baked into colour: contact darkening, damp feet, undersides (style guide §5.8, §7.4). */
export type Occlusion = (p: Vector3, n: Vector3) => number;

const _p = new Vector3();
const _n = new Vector3();
const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _d = new Vector3();
const _u = new Vector3();
const _v = new Vector3();
const _col = new Color();

/** Ground-contact and damp darkening on walls, a darker underside, all from height above `ground`. */
export function groundOcclusion(ground: number): Occlusion {
  return (p, n) => {
    const h = p.y - ground;
    let f = 1;
    if (h < SHADE.dampBand) f *= 1 - SHADE.damp * (1 - Math.max(0, h) / SHADE.dampBand);
    if (h < SHADE.contactBand && Math.abs(n.y) < FLOOR_NORMAL_Y) f *= 1 - SHADE.contact * (1 - Math.max(0, h) / SHADE.contactBand);
    if (n.y < SHADE.downFacing) f *= 1 - SHADE.underside;
    return f;
  };
}

export class Mesher {
  private readonly pos = new Floats();
  private readonly nrm = new Floats();
  private readonly uvs = new Floats();
  private readonly col = new Floats();
  private readonly lay = new Floats();
  private readonly idx = new Ints();
  private verts = 0;
  /** Local → world (rigid). */
  readonly frame = new Matrix4();
  private readonly stack: Matrix4[] = [];
  /** Current paint. */
  private layer = 0;
  private tile: readonly [number, number] = [1, 1];
  private card = false;
  private readonly tint = new Color(1, 1, 1);
  occlusion: Occlusion | null = null;
  /** Extra value multiplier for everything written (interiors are darker, §10.3). */
  ambient = 1;
  /** Chamfers smaller than this are left to the texture (§4.3: LOD1 paints the edge instead). */
  minBevel = 0;

  get triangles(): number {
    return this.idx.n / XYZ;
  }

  /** Paint what follows with `p` (seed: §4.4 per-piece hue ±3°, value ±5 %). */
  paint(p: Paint, seed?: number): this {
    const r = RECIPES[p.mat];
    this.layer = layerOf(p.mat);
    this.tile = r.tile;
    this.card = r.card === true;
    this.tint.setHex(p.tint ?? WHITE).multiplyScalar(p.shade ?? 1);
    if (seed !== undefined) {
      const h = (k: number): number => {
        const s = Math.sin((seed + k) * SHADE.hashA) * SHADE.hashB;
        return s - Math.floor(s);
      };
      const value = 1 + (h(1) * 2 - 1) * SHADE.pieceValue;
      const tilt = (h(2) * 2 - 1) * SHADE.pieceTilt;
      this.tint.setRGB(this.tint.r * value * (1 + tilt), this.tint.g * value, this.tint.b * value * (1 - tilt));
    }
    return this;
  }

  /** Run `f` with the frame moved by `m` (local), then restore it. */
  within(m: Matrix4, f: () => void): void {
    this.stack.push(this.frame.clone());
    this.frame.multiply(m);
    f();
    const prev = this.stack.pop();
    if (prev) this.frame.copy(prev);
  }

  /** Run `f` in a frame at (x, y, z) turned by yaw (local). */
  at(x: number, y: number, z: number, yaw: number, f: () => void): void {
    this.within(placed(x, y, z, yaw), f);
  }

  private emit(px: number, py: number, pz: number, nx: number, ny: number, nz: number, u: number | null, v: number | null): number {
    _p.set(px, py, pz).applyMatrix4(this.frame);
    // Frames are rigid, so their rotation carries normals.
    _n.set(nx, ny, nz).transformDirection(this.frame);
    this.pos.push3(_p.x, _p.y, _p.z);
    this.nrm.push3(_n.x, _n.y, _n.z);
    let uu: number;
    let vv: number;
    if (u !== null && v !== null) {
      [uu, vv] = this.card ? [u, v] : [u / this.tile[0], v / this.tile[1]];
    } else if (Math.abs(_n.y) > FLOOR_NORMAL_Y) {
      uu = _p.x / this.tile[0];
      vv = _p.z / this.tile[1];
    } else {
      _u.crossVectors(UP, _n).normalize();
      uu = _p.dot(_u) / this.tile[0];
      // Slopes (roofs) run courses along the eaves: v up the slope.
      _v.crossVectors(_n, _u).normalize();
      vv = _p.dot(_v) / this.tile[1];
    }
    this.uvs.push2(uu, vv);
    const k = this.ambient * (this.occlusion ? this.occlusion(_p, _n) : 1);
    _col.copy(this.tint).multiplyScalar(k);
    this.col.push3(_col.r, _col.g, _col.b);
    this.lay.push1(this.layer);
    return this.verts++;
  }

  /** A flat polygon (convex, in order) with planar uv; the winding is fixed to face `normal` (local). */
  poly(pts: readonly Vector3[], normal: Vector3, uvs?: readonly (readonly [number, number])[]): void {
    if (pts.length < XYZ) return;
    const [p0, p1, p2] = pts as [Vector3, Vector3, Vector3];
    _a.subVectors(p1, p0).cross(_b.subVectors(p2, p0));
    const flip = _a.dot(normal) < 0;
    const first = this.verts;
    pts.forEach((p, i) => {
      const t = uvs?.[i];
      this.emit(p.x, p.y, p.z, normal.x, normal.y, normal.z, t ? t[0] : null, t ? t[1] : null);
    });
    for (let i = 1; i + 1 < pts.length; i++) {
      if (flip) this.idx.push3(first, first + i + 1, first + i);
      else this.idx.push3(first, first + i, first + i + 1);
    }
  }

  /** A quad from its four corners in order; normal from the corners. */
  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, uvs?: readonly (readonly [number, number])[]): void {
    const n = _c.subVectors(b, a).cross(_d.subVectors(d, a)).normalize().clone();
    this.poly([a, b, c, d], n, uvs);
  }

  /**
   * A box centred on (x, y, z) with full size (sx, sy, sz), optionally chamfered by `bevel` (style guide §4.3: one
   * chamfer segment). `skip` drops faces nobody sees ('-y' under a sill, '-z' against a wall).
   */
  box(x: number, y: number, z: number, sx: number, sy: number, sz: number, bevel = 0, skip = ''): void {
    const h = [sx / 2, sy / 2, sz / 2] as const;
    const b = bevel < this.minBevel ? 0 : Math.min(bevel, h[0] * SHADE.maxBevelShare, h[1] * SHADE.maxBevelShare, h[2] * SHADE.maxBevelShare);
    const c = [x, y, z] as const;
    // P(corner signs, axis): the point on the face perpendicular to `axis`, next to that corner.
    const P = (s: readonly number[], axis: number): Vector3 => {
      const q = [0, 1, 2].map((k) => c[k]! + (s[k]! * (h[k]! - b)) + (k === axis ? s[k]! * b : 0));
      return new Vector3(q[0], q[1], q[2]);
    };
    const AX = ['x', 'y', 'z'];
    for (let axis = 0; axis < XYZ; axis++) {
      for (const sg of [-1, 1]) {
        if (skip.includes(`${sg < 0 ? '-' : '+'}${AX[axis]}`)) continue;
        const [i, j] = [(axis + 1) % XYZ, (axis + 2) % XYZ];
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([si, sj]) => {
          const s = [0, 0, 0];
          s[axis] = sg;
          s[i] = si!;
          s[j] = sj!;
          return P(s, axis);
        });
        const n = new Vector3();
        n.setComponent(axis, sg);
        this.poly(corners, n);
      }
    }
    if (b <= 0) return;
    // Edges: between faces (a, sa) and (b2, sb), running along the third axis.
    for (let a = 0; a < XYZ; a++) {
      for (let a2 = a + 1; a2 < XYZ; a2++) {
        const k = XYZ - a - a2;
        for (const sa of [-1, 1]) {
          for (const sb of [-1, 1]) {
            const s = (sk: number): number[] => {
              const v = [0, 0, 0];
              v[a] = sa;
              v[a2] = sb;
              v[k] = sk;
              return v;
            };
            const n = new Vector3();
            n.setComponent(a, sa);
            n.setComponent(a2, sb);
            n.normalize();
            this.poly([P(s(-1), a), P(s(1), a), P(s(1), a2), P(s(-1), a2)], n);
          }
        }
      }
    }
    for (const sx2 of [-1, 1]) {
      for (const sy2 of [-1, 1]) {
        for (const sz2 of [-1, 1]) {
          const s = [sx2, sy2, sz2];
          this.poly([P(s, 0), P(s, 1), P(s, 2)], new Vector3(sx2, sy2, sz2).normalize());
        }
      }
    }
  }

  /** Box from min/max corners (local). */
  span(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, bevel = 0, skip = ''): void {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) return;
    this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, bevel, skip);
  }

  /**
   * A surface of revolution about the local y axis: `profile` is [radius, y] from bottom to top, `sides` around,
   * optionally only from angle a0 to a1. Smooth normals; uv wraps (u = arc length, v = height). Closed caps where the
   * profile starts or ends off-axis are not added (callers add discs).
   */
  lathe(profile: readonly (readonly [number, number])[], sides: number, a0 = 0, a1 = Math.PI * 2): void {
    const first = this.verts;
    const rows = profile.length;
    const meanR = profile.reduce((s, [r]) => s + r, 0) / Math.max(rows, 1);
    for (let i = 0; i <= sides; i++) {
      const t = a0 + ((a1 - a0) * i) / sides;
      const cx = Math.cos(t);
      const sz = Math.sin(t);
      for (let j = 0; j < rows; j++) {
        const [r, y] = profile[j]!;
        const prev = profile[Math.max(0, j - 1)]!;
        const next = profile[Math.min(rows - 1, j + 1)]!;
        // Profile normal: perpendicular to the profile's local slope.
        const dr = next[0] - prev[0];
        const dy = next[1] - prev[1];
        const len = Math.hypot(dr, dy) || 1;
        const nr = dy / len;
        const ny = -dr / len;
        this.emit(r * cx, y, r * sz, nr * cx, ny, nr * sz, t * meanR, y);
      }
    }
    for (let i = 0; i < sides; i++) {
      for (let j = 0; j + 1 < rows; j++) {
        const a = first + i * rows + j;
        const b = first + (i + 1) * rows + j;
        this.idx.push3(a, a + 1, b);
        this.idx.push3(b, a + 1, b + 1);
      }
    }
  }

  /**
   * A closed surface around the local y axis whose radius varies with angle and height, `r(angle, y)`: bark ridges,
   * buttress roots, bulging trunks. Rings at the heights `ys`; normals from the surface's own slopes; uv wraps.
   */
  radial(ys: readonly number[], sides: number, r: (a: number, y: number) => number): void {
    const first = this.verts;
    const rows = ys.length;
    const at = (i: number, j: number): Vector3 => {
      const a = (i / sides) * Math.PI * 2;
      const y = ys[Math.max(0, Math.min(rows - 1, j))]!;
      const rr = r(a, y);
      return new Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr);
    };
    const meanR = r(0, ys[0] ?? 0);
    const du = new Vector3();
    const dv = new Vector3();
    for (let i = 0; i <= sides; i++) {
      for (let j = 0; j < rows; j++) {
        const p = at(i, j);
        du.subVectors(at(i + 1, j), at(i - 1, j));
        dv.subVectors(at(i, j + 1), at(i, j - 1));
        const n = new Vector3().crossVectors(dv, du).normalize();
        this.emit(p.x, p.y, p.z, n.x, n.y, n.z, (i / sides) * Math.PI * 2 * meanR, p.y);
      }
    }
    for (let i = 0; i < sides; i++) {
      for (let j = 0; j + 1 < rows; j++) {
        const a = first + i * rows + j;
        const b = first + (i + 1) * rows + j;
        this.idx.push3(a, a + 1, b);
        this.idx.push3(b, a + 1, b + 1);
      }
    }
  }

  /** A vertical cylinder (or frustum) from y0 to y1, with a top cap. */
  cylinder(x: number, z: number, y0: number, y1: number, r0: number, r1: number, sides: number, caps = true): void {
    this.within(placed(x, 0, z, 0), () => {
      this.lathe([[r0, y0], [r1, y1]], sides);
      if (caps && r1 > 0) this.disc(0, y1, 0, r1, sides, 1);
    });
  }

  /** A flat disc facing up (dir 1) or down (dir −1). */
  disc(x: number, y: number, z: number, r: number, sides: number, dir: 1 | -1): void {
    const pts: Vector3[] = [];
    for (let i = 0; i < sides; i++) {
      const t = (i / sides) * Math.PI * 2;
      pts.push(new Vector3(x + Math.cos(t) * r, y, z + Math.sin(t) * r));
    }
    this.poly(pts, new Vector3(0, dir, 0));
  }

  /**
   * A tube along a polyline (local), radius per point, `sides` around; uv wraps. Good for ropes, wires, stems,
   * branches and roots. Ends are left open (they meet something or taper to a point).
   */
  tube(path: readonly Vector3[], radius: number | readonly number[], sides: number): void {
    if (path.length < 2) return;
    const first = this.verts;
    const ring = sides + 1;
    let along = 0;
    const t = new Vector3();
    const side = new Vector3();
    const up = new Vector3();
    for (let i = 0; i < path.length; i++) {
      const p = path[i]!;
      const prev = path[Math.max(0, i - 1)]!;
      const next = path[Math.min(path.length - 1, i + 1)]!;
      t.subVectors(next, prev).normalize();
      side.crossVectors(Math.abs(t.y) > FLOOR_NORMAL_Y ? new Vector3(1, 0, 0) : UP, t).normalize();
      up.crossVectors(t, side).normalize();
      if (i > 0) along += p.distanceTo(prev);
      const r = typeof radius === 'number' ? radius : (radius[i] ?? radius[radius.length - 1] ?? 0);
      for (let k = 0; k <= sides; k++) {
        const a = (k / sides) * Math.PI * 2;
        const nx = side.x * Math.cos(a) + up.x * Math.sin(a);
        const ny = side.y * Math.cos(a) + up.y * Math.sin(a);
        const nz = side.z * Math.cos(a) + up.z * Math.sin(a);
        this.emit(p.x + nx * r, p.y + ny * r, p.z + nz * r, nx, ny, nz, (a / (Math.PI * 2)) * Math.max(r, SHADE.minTubeRadius) * Math.PI * 2, along);
      }
    }
    for (let i = 0; i + 1 < path.length; i++) {
      for (let k = 0; k < sides; k++) {
        const a = first + i * ring + k;
        const b = a + ring;
        this.idx.push3(a, b, a + 1);
        this.idx.push3(a + 1, b, b + 1);
      }
    }
  }

  /** A card (alpha-tested in the cutout material): centre c, half-axes u and v (local), uv 0..1. */
  card2(c: Vector3, u: Vector3, v: Vector3): void {
    const a = c.clone().sub(u).sub(v);
    const b = c.clone().add(u).sub(v);
    const d = c.clone().add(u).add(v);
    const e = c.clone().sub(u).add(v);
    // Leaf cards light like the clump they belong to: normal points away from the card's bottom edge and up a bit.
    const n = new Vector3().crossVectors(u, v).normalize();
    if (n.y < 0) n.negate();
    this.poly([a, b, d, e], n, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }

  /** The built geometry (indexed), or null when empty. */
  build(): BufferGeometry | null {
    if (this.idx.n === 0) return null;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.pos.view(), XYZ));
    // Compact vertex data (27 bytes, not 48): normals as normalised bytes, colour as normalised unsigned bytes (baked
    // light only darkens or lifts a little, clamped at 1), the material layer as a byte the shader reads as a float.
    g.setAttribute('normal', new BufferAttribute(packed(this.nrm, Int8Array, BYTE_SIGNED), XYZ, true));
    g.setAttribute('uv', new BufferAttribute(this.uvs.view(), UV));
    g.setAttribute('color', new BufferAttribute(packed(this.col, Uint8Array, BYTE), XYZ, true));
    g.setAttribute('matLayer', new BufferAttribute(Uint8Array.from(this.lay.view()), 1));
    g.setIndex(new BufferAttribute(this.idx.a.slice(0, this.idx.n), 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

const BYTE = 255;
const BYTE_SIGNED = 127;

/** Floats scaled to a normalised integer array, rounded and clamped. */
function packed<T extends Int8Array | Uint8Array>(src: Floats, Type: new (n: number) => T, scale: number, signed = scale === BYTE_SIGNED): T {
  const v = src.view();
  const out = new Type(v.length);
  const lo = signed ? -scale : 0;
  for (let i = 0; i < v.length; i++) out[i] = Math.max(lo, Math.min(scale, Math.round((v[i] ?? 0) * scale)));
  return out;
}

/** A rigid frame: translate to (x, y, z), then turn by yaw about y. */
export function placed(x: number, y: number, z: number, yaw: number): Matrix4 {
  return new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromAxisAngle(UP, yaw), new Vector3(1, 1, 1));
}

/** A rigid frame with a full rotation (yaw, then pitch about local x, then roll about local z). */
export function oriented(x: number, y: number, z: number, yaw: number, pitch: number, roll = 0): Matrix4 {
  const q = new Quaternion().setFromAxisAngle(UP, yaw)
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), pitch))
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), roll));
  return new Matrix4().compose(new Vector3(x, y, z), q, new Vector3(1, 1, 1));
}
