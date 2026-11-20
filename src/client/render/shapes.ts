/**
 * Procedural shapes for the renderer's map layer and for artists: chamfered boxes (§4.3), wedges, stairs, columns,
 * trunks with flared roots (§6.1) and leaf-card clumps. Each returns a geometry centred on its local origin (boxes
 * and wedges on their centre, columns and trunks on their base), with normals, ready for `paint()`.
 * Faces are subdivided to at most SHAPE.segment metres so baked vertex AO has somewhere to live.
 */
import { BufferAttribute, BufferGeometry, IcosahedronGeometry, Quaternion, Vector3 } from 'three';
import { SHAPE } from './constants';

const XYZ = 3;

/** A triangle soup built in local space; triangles are wound outward from `centre`. */
class Soup {
  readonly p: number[] = [];
  readonly uv: number[] = [];
  private readonly a = new Vector3();
  private readonly b = new Vector3();
  private readonly c = new Vector3();
  constructor(private readonly centre = new Vector3()) {}

  tri(a: readonly number[], b: readonly number[], c: readonly number[], outward?: Vector3): void {
    this.a.fromArray(a);
    this.b.fromArray(b);
    this.c.fromArray(c);
    const n = new Vector3().subVectors(this.b, this.a).cross(new Vector3().subVectors(this.c, this.a));
    const out = outward ?? this.a.clone().add(this.b).add(this.c).divideScalar(XYZ).sub(this.centre);
    if (n.dot(out) < 0) this.p.push(...a, ...c, ...b);
    else this.p.push(...a, ...b, ...c);
  }

  quad(a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[], outward?: Vector3): void {
    this.tri(a, b, c, outward);
    this.tri(a, c, d, outward);
  }

  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.p), XYZ));
    if (this.uv.length > 0) g.setAttribute('uv', new BufferAttribute(new Float32Array(this.uv), 2));
    g.computeVertexNormals();
    return g;
  }
}

/** Evenly spaced stops from a to b, at most `max` apart, plus any `extra` stops inside (a, b). */
function stops(a: number, b: number, max: number, extra: readonly number[] = []): number[] {
  const n = Math.min(SHAPE.maxSegments, Math.max(1, Math.ceil((b - a) / max)));
  const out = Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
  for (const e of extra) if (e > a + SHAPE.minGap && e < b - SHAPE.minGap) out.push(e);
  return [...new Set(out)].sort((x, y) => x - y);
}

export interface BoxOptions {
  /** Chamfer width in metres (§4.3); 0 for none. */
  readonly chamfer?: number;
  /** Leave out the bottom face (pieces standing on the ground). */
  readonly bottom?: boolean;
  /** Extra horizontal loops (metres above the bottom) for the damp and contact gradients. */
  readonly loops?: readonly number[];
  /** Subdivide faces to at most this many metres (default SHAPE.segment). */
  readonly segment?: number;
}

/** A box sx × sy × sz centred on the origin with chamfered edges and subdivided faces (non-indexed, flat normals). */
export function chamferBox(sx: number, sy: number, sz: number, opts: BoxOptions = {}): BufferGeometry {
  const c = Math.max(0, Math.min(opts.chamfer ?? 0, Math.min(sx, sy, sz) * SHAPE.maxChamferShare));
  const [hx, hy, hz] = [sx / 2, sy / 2, sz / 2];
  const loops = (opts.loops ?? []).map((l) => -hy + l);
  const seg = opts.segment ?? SHAPE.segment;
  const xs = stops(-hx + c, hx - c, seg);
  const ys = stops(-hy + c, hy - c, seg, loops);
  const zs = stops(-hz + c, hz - c, seg);
  const s = new Soup();
  const grid = (us: number[], vs: number[], at: (u: number, v: number) => number[], out: Vector3): void => {
    for (let i = 0; i + 1 < us.length; i++) {
      for (let j = 0; j + 1 < vs.length; j++) {
        const [u0, u1, v0, v1] = [us[i] ?? 0, us[i + 1] ?? 0, vs[j] ?? 0, vs[j + 1] ?? 0];
        s.quad(at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1), out);
      }
    }
  };
  for (const sg of [1, -1]) {
    grid(ys, zs, (y, z) => [sg * hx, y, z], new Vector3(sg, 0, 0));
    if (sg > 0 || opts.bottom !== false) grid(xs, zs, (x, z) => [x, sg * hy, z], new Vector3(0, sg, 0));
    grid(xs, ys, (x, y) => [x, y, sg * hz], new Vector3(0, 0, sg));
  }
  if (c > 0) {
    for (const a of [1, -1]) {
      for (const b of [1, -1]) {
        // Edges along z (x/y faces), along x (y/z faces), along y (x/z faces).
        for (let k = 0; k + 1 < zs.length; k++) {
          const [z0, z1] = [zs[k] ?? 0, zs[k + 1] ?? 0];
          if (b < 0 && opts.bottom === false) continue;
          s.quad([a * hx, b * (hy - c), z0], [a * (hx - c), b * hy, z0], [a * (hx - c), b * hy, z1], [a * hx, b * (hy - c), z1], new Vector3(a, b, 0));
        }
        for (let k = 0; k + 1 < xs.length; k++) {
          const [x0, x1] = [xs[k] ?? 0, xs[k + 1] ?? 0];
          if (a < 0 && opts.bottom === false) continue;
          s.quad([x0, a * hy, b * (hz - c)], [x0, a * (hy - c), b * hz], [x1, a * (hy - c), b * hz], [x1, a * hy, b * (hz - c)], new Vector3(0, a, b));
        }
        for (let k = 0; k + 1 < ys.length; k++) {
          const [y0, y1] = [ys[k] ?? 0, ys[k + 1] ?? 0];
          s.quad([a * hx, y0, b * (hz - c)], [a * (hx - c), y0, b * hz], [a * (hx - c), y1, b * hz], [a * hx, y1, b * (hz - c)], new Vector3(a, 0, b));
        }
        for (const d of [1, -1]) {
          if (b < 0 && opts.bottom === false) continue;
          s.tri([a * hx, b * (hy - c), d * (hz - c)], [a * (hx - c), b * hy, d * (hz - c)], [a * (hx - c), b * (hy - c), d * hz], new Vector3(a, b, d));
        }
      }
    }
  }
  // Non-indexed, so each face keeps its own flat normal: crisp chamfer highlights.
  return s.geometry();
}

/**
 * The map's ramp wedge in a box sx × sy × sz centred on the origin: floor at −sy/2, the slope rising from −z to the
 * top edge at +z (RampPrim). The slope is subdivided; no bottom face.
 */
export function wedge(sx: number, sy: number, sz: number): BufferGeometry {
  const [hx, hy, hz] = [sx / 2, sy / 2, sz / 2];
  const s = new Soup(new Vector3(0, -hy / 2, hz / 2));
  const xs = stops(-hx, hx, SHAPE.segment);
  const zs = stops(-hz, hz, SHAPE.segment);
  const y = (z: number): number => -hy + (sy * (z + hz)) / sz;
  const up = new Vector3(0, sz, -sy);
  for (let i = 0; i + 1 < xs.length; i++) {
    for (let j = 0; j + 1 < zs.length; j++) {
      const [x0, x1, z0, z1] = [xs[i] ?? 0, xs[i + 1] ?? 0, zs[j] ?? 0, zs[j + 1] ?? 0];
      s.quad([x0, y(z0), z0], [x1, y(z0), z0], [x1, y(z1), z1], [x0, y(z1), z1], up);
    }
  }
  for (let i = 0; i + 1 < xs.length; i++) {
    const [x0, x1] = [xs[i] ?? 0, xs[i + 1] ?? 0];
    s.quad([x0, -hy, hz], [x1, -hy, hz], [x1, hy, hz], [x0, hy, hz], new Vector3(0, 0, 1));
  }
  for (const sg of [1, -1]) s.tri([sg * hx, -hy, -hz], [sg * hx, -hy, hz], [sg * hx, hy, hz], new Vector3(sg, 0, 0));
  return s.geometry();
}

/**
 * Stairs filling a ramp's box: risers of about SHAPE.riser, each step a plain block one tread deep (the nosing is
 * painted), set
 * half a riser down so the collision slope cuts through the middle of every riser (feet never float more than half
 * a riser). Same frame as wedge().
 */
export function stairs(sx: number, sy: number, sz: number): BufferGeometry[] {
  const n = Math.max(1, Math.round(sy / SHAPE.riser));
  const rise = sy / n;
  const run = sz / n;
  const out: BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const top = -sy / 2 + (i + 1) * rise - rise / 2;
    const h = top + sy / 2;
    if (h <= 0) continue;
    const g = chamferBox(sx, h, run, { bottom: false, segment: Math.max(sx, h, run) });
    g.translate(0, -sy / 2 + h / 2, -sz / 2 + (i + 1 / 2) * run);
    out.push(g);
  }
  return out;
}

/** Rings of `sides` vertices at each [height, radius] of `profile` (bottom up), capped at the top. Base at y = 0. */
function rings(profile: readonly (readonly [number, number])[], sides: number, lobe: (angle: number, y: number) => number, cap = true): BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const [y, r] of profile) {
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const rr = r * lobe(a, y);
      pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr);
    }
  }
  for (let j = 0; j + 1 < profile.length; j++) {
    for (let k = 0; k < sides; k++) {
      const a = j * sides + k;
      const b = j * sides + ((k + 1) % sides);
      idx.push(a, a + sides, b, b, a + sides, b + sides);
    }
  }
  const last = profile[profile.length - 1];
  if (cap && last) {
    const centre = pos.length / XYZ;
    pos.push(0, last[0], 0);
    const base = (profile.length - 1) * sides;
    for (let k = 0; k < sides; k++) idx.push(base + k, centre, base + ((k + 1) % sides));
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), XYZ));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A column or post of radius r and height h with chamfered top and bottom edges, base at y = 0. */
export function column(r: number, h: number, chamfer = SHAPE.columnChamfer): BufferGeometry {
  const c = Math.min(chamfer, r * SHAPE.maxChamferShare, h * SHAPE.maxChamferShare);
  const sides = r > SHAPE.wideColumn ? SHAPE.columnSidesWide : SHAPE.columnSides;
  const ys = stops(c, h - c, SHAPE.segment);
  const profile: [number, number][] = [[0, r - c], ...ys.map((y): [number, number] => [y, r]), [h, r - c]];
  return rings(profile, sides, () => 1);
}

/**
 * A tree trunk (§6.1): bark ridges as lobes around the girth and buttress roots flaring the base to SHAPE.flare × r
 * over SHAPE.flareHeight, tapering a little toward the top. Base at y = 0.
 */
export function trunk(r: number, h: number, seed: number): BufferGeometry {
  const ys = [0, SHAPE.flareHeight * SHAPE.flareRingLow, SHAPE.flareHeight * SHAPE.flareRingMid, SHAPE.flareHeight, ...stops(SHAPE.flareHeight * SHAPE.flareAbove, h, SHAPE.segment * 2)];
  const profile = ys.filter((y) => y <= h).map((y): [number, number] => [y, r * (1 - SHAPE.taper * (y / h)) * (1 + (SHAPE.flare - 1) * Math.exp(-y / (SHAPE.flareHeight / 2)))]);
  const roots = SHAPE.rootLobes + (seed % 2);
  return rings(profile, SHAPE.trunkSides, (a, y) => 1 + SHAPE.rootDepth * Math.max(0, Math.sin(a * roots + seed)) * Math.exp(-y / SHAPE.flareHeight) + SHAPE.barkLobe * Math.sin(a * SHAPE.barkLobes + seed * 2));
}

/**
 * A leaf clump (§6.1): `count` alpha-tested cards scattered through an ellipsoid of radius r (squashed in y), with
 * an opaque dark core so the clump never reads hollow. Vertex colours carry the shading: dark inside, up to +15 %
 * on the sun side. uv spans each card (paint with { uv: 'keep' }).
 */
export function leafClump(r: number, count: number, seed: number, toSun: Vector3, cardSize: number): { cards: BufferGeometry; core: BufferGeometry } {
  let s = seed >>> 0 || 1;
  const rnd = (): number => {
    s = (Math.imul(s, SHAPE.lcgMul) + SHAPE.lcgAdd) >>> 0;
    return s / SHAPE.lcgRange;
  };
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const p = new Vector3();
  const n = new Vector3();
  const t = new Vector3();
  const b = new Vector3();
  for (let i = 0; i < count; i++) {
    // A point in the ellipsoid, biased to the shell so the outline is leafy.
    p.set(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(r * Math.pow(rnd(), SHAPE.shellBias));
    p.y *= SHAPE.clumpSquash;
    n.set(rnd() * 2 - 1, rnd() * 2 - 1 + SHAPE.cardUp, rnd() * 2 - 1).normalize();
    t.set(n.z, 0, -n.x);
    if (t.lengthSq() < SHAPE.minGap) t.set(1, 0, 0);
    t.normalize();
    b.crossVectors(n, t);
    const size = cardSize * (1 + SHAPE.cardSizeRange * (rnd() - 1 / 2));
    const depth = p.length() / r;
    const sun = Math.max(0, p.clone().normalize().dot(toSun));
    const shade = (SHAPE.innerShade + (1 - SHAPE.innerShade) * depth) * (1 + SHAPE.sunLift * sun);
    const corners = [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]] as const;
    const v = corners.map(([cx, cy, u, w]) => ({ x: p.x + (t.x * cx + b.x * cy) * size / 2, y: p.y + (t.y * cx + b.y * cy) * size / 2, z: p.z + (t.z * cx + b.z * cy) * size / 2, u, w }));
    // Two triangles over the four corners.
    for (const q of [v[0], v[1], v[2], v[0], v[2], v[v.length - 1]]) {
      if (!q) continue;
      pos.push(q.x, q.y, q.z);
      uv.push(q.u, q.w);
      col.push(shade, shade, shade);
    }
  }
  const cards = new BufferGeometry();
  cards.setAttribute('position', new BufferAttribute(new Float32Array(pos), XYZ));
  cards.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  cards.setAttribute('color', new BufferAttribute(new Float32Array(col), XYZ));
  // Card normals point away from the clump centre, so the clump is lit like a soft ball, not like flat cards.
  const nor: number[] = [];
  for (let i = 0; i < pos.length; i += XYZ) {
    n.set(pos[i] ?? 0, (pos[i + 1] ?? 0) / SHAPE.clumpSquash, pos[i + 2] ?? 0).normalize();
    nor.push(n.x, n.y, n.z);
  }
  cards.setAttribute('normal', new BufferAttribute(new Float32Array(nor), XYZ));
  const core = new IcosahedronGeometry(r * SHAPE.coreShare, SHAPE.coreDetail);
  core.scale(1, SHAPE.clumpSquash, 1);
  core.setAttribute('color', new BufferAttribute(new Float32Array(core.getAttribute('position').count * XYZ).fill(SHAPE.innerShade), XYZ));
  return { cards, core };
}

/** A straight tube of radius r from a to b (cables, rails, perches), open-ended. */
export function tube(a: Vector3, b: Vector3, r: number, sides = SHAPE.tubeSides): BufferGeometry {
  const g = rings([[0, r], [a.distanceTo(b), r]], sides, () => 1, false);
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3().subVectors(b, a).normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}
