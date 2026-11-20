/* eslint-disable @typescript-eslint/no-magic-numbers -- signed-distance maths: the numbers are the formulas */
/**
 * Implicit bird bodies (D-ART-008): a body is a list of signed-distance primitives (ellipsoids and round cones, a
 * capsule being a round cone with equal radii) joined by smooth union and carved by smooth subtraction, each with its
 * own blend radius. Every primitive is bound to a rig bone and a paint region, so the field also says, at any point,
 * how much each bone and each region owns it: skin weights and colour blend softly across the joins.
 *
 * Primitives are written in the model frame at the bind pose (+z forward, +y up, +x the bird's left, feet at the
 * origin), the frame the rig's bones rest in. This module is the runtime half (field, gradient, surface probes for
 * gear and feathers); `mesher.ts` turns a field into baked meshes offline.
 */
import type { BoneName } from './bird';
import type { V3 } from './sculpt';
import type { Surface, SurfacePoint } from './sculpt';
import { Vector3 } from 'three';

/** An ellipsoid: centre, semi-axes, and an XYZ Euler rotation (rad). */
export interface Ellipsoid {
  readonly c: V3;
  readonly r: V3;
  readonly rot?: V3;
}
/** A round cone from a (radius ra) to b (radius rb); a capsule when they match. */
export interface RoundCone {
  readonly a: V3;
  readonly b: V3;
  readonly ra: number;
  readonly rb: number;
}
export type Shape = Ellipsoid | RoundCone;

export interface Op {
  readonly shape: Shape;
  /** Blend radius of the smooth union (or subtraction), m. */
  readonly k?: number;
  /** Carve the shape away instead of adding it (eye sockets, the gape). */
  readonly sub?: boolean;
  /** Paint only: a marking volume that recolours the surface inside it and leaves the form alone. */
  readonly mark?: boolean;
  readonly bone: BoneName;
  readonly region: string;
  /** How wide this primitive's paint blends into its neighbours (m). */
  readonly soft?: number;
  /** How wide its skin weight blends into its neighbours (m). */
  readonly boneSoft?: number;
}

export interface Body {
  readonly ops: readonly Op[];
  /** Triangle targets for the four levels of detail. */
  readonly tris: readonly [number, number, number, number];
  /** Grid cell for meshing (m); bigger birds can take a coarser grid. */
  readonly cell?: number;
}

export const SDF = {
  /** Default blend radius, paint blend and skin-weight blend (m). */
  k: 0.03,
  soft: 0.012,
  boneSoft: 0.035,
  /** A marking's weight inside its volume against an ordinary surface's 1. */
  mark: 24,
} as const;

/** One op, compiled for fast evaluation. */
interface Compiled {
  readonly op: Op;
  readonly kind: 0 | 1;
  /** Ellipsoid: centre, inverse rotation rows (m00…m22), radii. Cone: a, b - a, radii and derived terms. */
  readonly f: Float64Array;
  /** Bounding sphere centre and radius. */
  readonly bc: V3;
  readonly br: number;
  readonly k: number;
}

function compile(op: Op): Compiled {
  const s = op.shape;
  const k = op.k ?? SDF.k;
  if ('c' in s) {
    const [x, y, z] = s.rot ?? [0, 0, 0];
    // Rotation matrix R (rows), as three.js builds it from an XYZ Euler: its columns are the ellipsoid's axes.
    const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
    const m = [
      cy * cz, -cy * sz, sy,
      cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy,
      sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy,
    ];
    const f = new Float64Array([s.c[0], s.c[1], s.c[2], ...m, s.r[0], s.r[1], s.r[2]]);
    return { op, kind: 0, f, bc: s.c, br: Math.max(...s.r), k };
  }
  const ba: V3 = [s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]];
  const l2 = ba[0] * ba[0] + ba[1] * ba[1] + ba[2] * ba[2];
  const rr = s.ra - s.rb;
  const f = new Float64Array([s.a[0], s.a[1], s.a[2], ba[0], ba[1], ba[2], s.ra, s.rb, l2, rr, l2 - rr * rr, 1 / l2]);
  const bc: V3 = [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, (s.a[2] + s.b[2]) / 2];
  return { op, kind: 1, f, bc, br: Math.sqrt(l2) / 2 + Math.max(s.ra, s.rb), k };
}

/** Distance to one compiled shape (ellipsoid: the usual bound, exact at the surface; round cone: exact). */
function shapeDist(c: Compiled, px: number, py: number, pz: number): number {
  const f = c.f;
  if (c.kind === 0) {
    const dx = px - f[0]!, dy = py - f[1]!, dz = pz - f[2]!;
    // Local = Rᵀ·d.
    const lx = (f[3]! * dx + f[6]! * dy + f[9]! * dz) / f[12]!;
    const ly = (f[4]! * dx + f[7]! * dy + f[10]! * dz) / f[13]!;
    const lz = (f[5]! * dx + f[8]! * dy + f[11]! * dz) / f[14]!;
    const k0 = Math.sqrt(lx * lx + ly * ly + lz * lz);
    const k1 = Math.sqrt((lx * lx) / (f[12]! * f[12]!) + (ly * ly) / (f[13]! * f[13]!) + (lz * lz) / (f[14]! * f[14]!));
    return k1 < 1e-12 ? -Math.min(f[12]!, f[13]!, f[14]!) : (k0 * (k0 - 1)) / k1;
  }
  const pax = px - f[0]!, pay = py - f[1]!, paz = pz - f[2]!;
  const bax = f[3]!, bay = f[4]!, baz = f[5]!;
  const r1 = f[6]!, r2 = f[7]!, l2 = f[8]!, rr = f[9]!, a2 = f[10]!, il2 = f[11]!;
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const qx = pax * l2 - bax * y, qy = pay * l2 - bay * y, qz = paz * l2 - baz * y;
  const x2 = qx * qx + qy * qy + qz * qz;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

/** What the field says at a point: who owns it (bone and paint weights, normalised, largest first). */
export interface Owners {
  readonly bones: readonly (readonly [BoneName, number])[];
  readonly regions: readonly (readonly [string, number])[];
}

/** A body's field: distance, gradient and owners, plus probes that find the surface for gear and feathers. */
export class Field {
  private readonly ops: readonly Compiled[];
  readonly regions: readonly string[];
  /** Bounds of the solid (min, max), from the added shapes. */
  readonly min: V3;
  readonly max: V3;

  constructor(readonly body: Body) {
    this.ops = body.ops.map(compile);
    this.regions = [...new Set(body.ops.map((o) => o.region))];
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (const c of this.ops) {
      if (c.op.sub || c.op.mark) continue;
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i]!, c.bc[i]! - c.br - c.k);
        hi[i] = Math.max(hi[i]!, c.bc[i]! + c.br + c.k);
      }
    }
    this.min = lo as unknown as V3;
    this.max = hi as unknown as V3;
  }

  /** The field of only the named regions' masses (a trunk to lay a sash round, without the neck in the way). */
  only(...regions: readonly string[]): Field {
    return new Field({ ...this.body, ops: this.body.ops.filter((o) => regions.includes(o.region)) });
  }

  /** Signed distance (negative inside). */
  d(px: number, py: number, pz: number): number {
    let d = 1e9;
    for (const c of this.ops) {
      if (c.op.mark) continue;
      const bx = px - c.bc[0], by = py - c.bc[1], bz = pz - c.bc[2];
      const lb = Math.sqrt(bx * bx + by * by + bz * bz) - c.br;
      const k = c.k;
      if (c.op.sub) {
        // smax(d, -di, k): unchanged when di + d ≥ k.
        if (lb + d >= k) continue;
        const di = shapeDist(c, px, py, pz);
        const h = Math.min(1, Math.max(0, 0.5 + (0.5 * (di + d)) / k));
        d = -((di * (1 - h) - d * h) - k * h * (1 - h));
        continue;
      }
      // smin(d, di, k): unchanged when di - d ≥ k.
      if (lb - d >= k) continue;
      const di = shapeDist(c, px, py, pz);
      const h = Math.min(1, Math.max(0, 0.5 + (0.5 * (di - d)) / k));
      d = di * (1 - h) + d * h - k * h * (1 - h);
    }
    return d;
  }

  /** The outward unit normal (normalised central-difference gradient). */
  normal(px: number, py: number, pz: number, eps = 5e-4): V3 {
    const gx = this.d(px + eps, py, pz) - this.d(px - eps, py, pz);
    const gy = this.d(px, py + eps, pz) - this.d(px, py - eps, pz);
    const gz = this.d(px, py, pz + eps) - this.d(px, py, pz - eps);
    const l = Math.hypot(gx, gy, gz) || 1;
    return [gx / l, gy / l, gz / l];
  }

  /** Move a point onto the surface along the gradient (a few Newton steps). */
  project(p: V3, steps = 4): V3 {
    let [x, y, z] = p;
    for (let i = 0; i < steps; i++) {
      const d = this.d(x, y, z);
      const [nx, ny, nz] = this.normal(x, y, z);
      x -= d * nx;
      y -= d * ny;
      z -= d * nz;
    }
    return [x, y, z];
  }

  /** Bone and region weights at a point on (or near) the surface. */
  owners(px: number, py: number, pz: number, keep = 4): Owners {
    const bones = new Map<BoneName, number>();
    const regions = new Map<string, number>();
    for (const c of this.ops) {
      const di = shapeDist(c, px, py, pz);
      const soft = c.op.soft ?? SDF.soft;
      if (c.op.mark) {
        const w = SDF.mark * Math.min(1, Math.max(0, 0.5 - di / (2 * soft)));
        if (w > 0) regions.set(c.op.region, (regions.get(c.op.region) ?? 0) + w);
        continue;
      }
      const a = Math.abs(di);
      const wr = Math.exp(-a / soft);
      if (wr > 1e-4) regions.set(c.op.region, (regions.get(c.op.region) ?? 0) + wr);
      if (c.op.sub) continue;
      const wb = Math.exp(-a / (c.op.boneSoft ?? SDF.boneSoft));
      if (wb > 1e-4) bones.set(c.op.bone, (bones.get(c.op.bone) ?? 0) + wb);
    }
    return { bones: top(bones, keep), regions: top(regions, keep) };
  }

  /**
   * A Surface over the body for gear and feathers (the loft convention: t along the axis from `from` to `to`, a round
   * it, 0 at the side, π/2 up): the point where the ray from the axis at t, angle a, leaves the body.
   */
  surface(from: V3, to: V3, ref: V3 = [0, 1, 0]): Surface {
    const A = new Vector3(...from);
    const T = new Vector3(...to).sub(A);
    const len = T.length();
    T.normalize();
    let S = new Vector3(...ref).cross(T);
    if (S.lengthSq() < 1e-8) S = new Vector3(1, 0, 0).cross(T);
    S.normalize();
    const U = new Vector3().crossVectors(T, S).normalize();
    const reach = Math.hypot(this.max[0] - this.min[0], this.max[1] - this.min[1], this.max[2] - this.min[2]);
    return {
      at: (t: number, a: number, off = 0): SurfacePoint => {
        const o = A.clone().addScaledVector(T, t * len);
        const dir = S.clone().multiplyScalar(Math.cos(a)).addScaledVector(U, Math.sin(a));
        const p = this.leave(o, dir, reach);
        const n = new Vector3(...this.normal(p.x, p.y, p.z));
        return { p: p.addScaledVector(n, off), n, t: T.clone() };
      },
    };
  }

  /**
   * Where a ray from `o` (inside the solid) along unit `dir` first leaves it: inside, |d| never overshoots the exit,
   * so march by it, then bisect the crossing. From outside, the nearest surface point.
   */
  leave(o: Vector3, dir: Vector3, reach: number): Vector3 {
    const at = (s: number): number => this.d(o.x + dir.x * s, o.y + dir.y * s, o.z + dir.z * s);
    if (at(0) >= 0) return new Vector3(...this.project([o.x, o.y, o.z]));
    let lo = 0;
    let s = 0;
    for (let i = 0; i < 128 && s < reach; i++) {
      const d = at(s);
      if (d >= 0) break;
      lo = s;
      s += Math.max(-d, 1e-3);
    }
    let hi = s;
    for (let i = 0; i < 20; i++) {
      const m = (lo + hi) / 2;
      if (at(m) < 0) lo = m;
      else hi = m;
    }
    return o.clone().addScaledVector(dir, hi);
  }
}

function top<K>(m: Map<K, number>, keep: number): (readonly [K, number])[] {
  const all = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, keep);
  const sum = all.reduce((s, [, w]) => s + w, 0) || 1;
  return all.map(([k, w]) => [k, w / sum] as const);
}

// -----------------------------------------------------------------------------------------------------------------
// Shorthands for writing bodies.

/** An ellipsoid op. */
export const ell = (c: V3, r: V3, bone: BoneName, region: string, o: Partial<Op> & { rot?: V3 } = {}): Op => {
  const { rot, ...rest } = o;
  return { shape: { c, r, ...(rot && { rot }) }, bone, region, ...rest };
};
/** A round-cone op (a capsule when ra = rb). */
export const cone = (a: V3, b: V3, ra: number, rb: number, bone: BoneName, region: string, o: Partial<Op> = {}): Op => ({ shape: { a, b, ra, rb }, bone, region, ...o });
/** Mirror an op across the bird's midline (x → -x), swapping left and right bones. */
export function mirror(op: Op): Op {
  const swap = (b: BoneName): BoneName => (b.endsWith('L') || /L\d$/.test(b) ? b.replace('L', 'R') : b.replace('R', 'L')) as BoneName;
  const fx = (v: V3): V3 => [-v[0], v[1], v[2]];
  const s = op.shape;
  const shape: Shape = 'c' in s ? { c: fx(s.c), r: s.r, ...(s.rot && { rot: [s.rot[0], -s.rot[1], -s.rot[2]] as V3 }) } : { a: fx(s.a), b: fx(s.b), ra: s.ra, rb: s.rb };
  return { ...op, shape, bone: swap(op.bone) };
}
/** An op and its mirror image. */
export const pair = (op: Op): Op[] => [op, mirror(op)];
