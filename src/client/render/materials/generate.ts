/**
 * Seeded, tileable procedural texture machinery (style guide §7.1). Pure typed-array code with integer hashing, so a
 * layer is byte-identical in every browser and in Node tests, and every pattern wraps exactly at its tile edges.
 * The per-material recipes that use it live in data/recipes.ts.
 */

/** One pixel as a recipe writes it: sRGB albedo 0..1, alpha (cards), height 0..1, roughness, metalness. */
export interface Px {
  r: number;
  g: number;
  b: number;
  a: number;
  h: number;
  rough: number;
  metal: number;
}

/** Writes the pixel at (X, Y) metres inside the tile (Y up). */
export type Sampler = (X: number, Y: number, px: Px) => void;

const U32 = 4294967296;
const H1 = 0x27d4eb2d;
const H2 = 0x165667b1;
const H3 = 0x9e3779b9;
const SHIFT_A = 15;
const SHIFT_B = 13;
const SHIFT_C = 16;

/** Deterministic 0..1 from two integers and a seed. */
export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, H1) ^ Math.imul(y | 0, H2) ^ Math.imul(seed | 0, H3);
  h = Math.imul(h ^ (h >>> SHIFT_A), H1);
  h = Math.imul(h ^ (h >>> SHIFT_B), H2);
  h ^= h >>> SHIFT_C;
  return (h >>> 0) / U32;
}

/** mulberry32: a small seeded generator for tables built once per layer. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    const MUL_A = 0x6d2b79f5;
    const S1 = 15;
    const S2 = 7;
    const S3 = 61;
    const S4 = 14;
    this.s = (this.s + MUL_A) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> S1), t | 1);
    t ^= t + Math.imul(t ^ (t >>> S2), t | S3);
    return ((t ^ (t >>> S4)) >>> 0) / U32;
  }
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }
}

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
export function smooth(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  const THREE = 3;
  return t * t * (THREE - 2 * t);
}
const wrap = (i: number, n: number): number => ((i % n) + n) % n;

/** A noise function of a point (lattice units, or metres for fbm). */
export type Field = (x: number, y: number) => number;

/**
 * Value noise on a lattice wrapping every (px, py) cells; x, y in lattice units. The lattice is hashed once into a
 * table, so sampling is four lookups (generation time is the §11.5 budget's main cost).
 */
export function lattice(px: number, py: number, seed: number): Field {
  const t = new Float32Array(px * py);
  for (let j = 0; j < py; j++) for (let i = 0; i < px; i++) t[j * px + i] = hash2(i, j, seed);
  return (x, y) => {
    const xi = x >= 0 ? x | 0 : Math.floor(x);
    const yi = y >= 0 ? y | 0 : Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (THREE_F - 2 * fx);
    const sy = fy * fy * (THREE_F - 2 * fy);
    const x0 = ((xi % px) + px) % px;
    const y0 = (((yi % py) + py) % py) * px;
    const x1 = x0 + 1 === px ? 0 : x0 + 1;
    const y1 = y0 + px === px * py ? 0 : y0 + px;
    const a = t[y0 + x0] ?? 0;
    const b = t[y0 + x1] ?? 0;
    const c = t[y1 + x0] ?? 0;
    const d = t[y1 + x1] ?? 0;
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}
const THREE_F = 3;

/**
 * Tileable fractal noise over a w × h tile: base cells of about `cellX` × `cellY` metres (rounded so a whole number
 * fits the tile), `octaves` octaves each half the size and half the weight. The field takes metres; returns 0..1.
 */
export function fbm(w: number, h: number, cellX: number, cellY: number, octaves: number, seed: number): Field {
  const px = Math.max(1, Math.round(w / cellX));
  const py = Math.max(1, Math.round(h / cellY));
  const layers = Array.from({ length: octaves }, (_, o) => ({ f: lattice(px << o, py << o, seed + o), sx: (px << o) / w, sy: (py << o) / h, amp: 1 / (1 << o) }));
  const norm = layers.reduce((s, l) => s + l.amp, 0);
  return (X, Y) => {
    let sum = 0;
    for (const l of layers) sum += l.amp * l.f(X * l.sx, Y * l.sy);
    return sum / norm;
  };
}

/** A cell of a course pattern under a pixel. */
export interface CellHit {
  /** Distance in metres from the pixel to the nearest cell edge (joint centre lines). */
  d: number;
  /** Position inside the cell, metres from its left and bottom edges, and the cell's size. */
  lx: number;
  ly: number;
  len: number;
  rowH: number;
  row: number;
  /** Three stable random numbers for the cell. */
  r1: number;
  r2: number;
  r3: number;
}

export interface CourseSpec {
  readonly w: number;
  readonly h: number;
  /** Row heights, bottom up; they are scaled to fill h exactly. */
  readonly rows: readonly number[];
  /** Per row: cell lengths in [lo, hi] (scaled to fill w exactly), or a fixed length that divides w. */
  readonly cell: (row: number) => { lo: number; hi: number };
  /** Per row: offset of the first joint as a fraction of the first cell (running bond = 0.5 on odd rows). */
  readonly offset: (row: number, rng: Rng) => number;
}

/** Rows of cells (bricks, blocks, slabs, planks, tiles) that tile a w × h rectangle. */
export class Courses {
  private readonly y0: number[] = [];
  private readonly hs: number[] = [];
  private readonly starts: number[][] = [];
  private readonly lens: number[][] = [];
  private readonly rand: number[][] = [];
  private readonly offs: number[] = [];
  constructor(private readonly spec: CourseSpec, rng: Rng) {
    const total = spec.rows.reduce((a, b) => a + b, 0);
    let y = 0;
    spec.rows.forEach((rh, row) => {
      const hgt = (rh * spec.h) / total;
      this.y0.push(y);
      this.hs.push(hgt);
      y += hgt;
      const { lo, hi } = spec.cell(row);
      const raw: number[] = [];
      let sum = 0;
      while (sum < spec.w - lo / 2 || raw.length === 0) {
        const l = lo === hi ? lo : rng.range(lo, hi);
        raw.push(l);
        sum += l;
      }
      const k = spec.w / sum;
      const lens = raw.map((l) => l * k);
      const starts: number[] = [];
      let x = 0;
      for (const l of lens) {
        starts.push(x);
        x += l;
      }
      this.starts.push(starts);
      this.lens.push(lens);
      this.rand.push(lens.flatMap(() => [rng.next(), rng.next(), rng.next()]));
      this.offs.push(spec.offset(row, rng) * (lens[0] ?? 0));
    });
  }

  at(X: number, Y: number, out: CellHit): void {
    const { w, h } = this.spec;
    const yy = ((Y % h) + h) % h;
    let row = this.y0.length - 1;
    for (let i = 1; i < this.y0.length; i++) {
      if ((this.y0[i] ?? 0) > yy) {
        row = i - 1;
        break;
      }
    }
    const y0 = this.y0[row] ?? 0;
    const rh = this.hs[row] ?? 1;
    const starts = this.starts[row] ?? [0];
    const lens = this.lens[row] ?? [w];
    const xx = (((X - (this.offs[row] ?? 0)) % w) + w) % w;
    let k = starts.length - 1;
    for (let i = 1; i < starts.length; i++) {
      if ((starts[i] ?? 0) > xx) {
        k = i - 1;
        break;
      }
    }
    const s = starts[k] ?? 0;
    const len = lens[k] ?? w;
    out.lx = xx - s;
    out.ly = yy - y0;
    out.len = len;
    out.rowH = rh;
    out.row = row;
    out.d = Math.min(out.lx, len - out.lx, out.ly, rh - out.ly);
    const r = this.rand[row] ?? [];
    out.r1 = r[k * RGB] ?? 0;
    out.r2 = r[k * RGB + 1] ?? 0;
    out.r3 = r[k * RGB + 2] ?? 0;
  }
}

/** Nearest and second-nearest feature points of a tileable jittered grid. */
export interface VHit {
  d1: number;
  d2: number;
  /** Offset from the pixel to the nearest point, metres. */
  dx: number;
  dy: number;
  r1: number;
  r2: number;
}

export class Voronoi {
  private readonly cw: number;
  private readonly ch: number;
  private readonly px: Float64Array;
  private readonly py: Float64Array;
  private readonly rs: Float64Array;
  constructor(private readonly nx: number, private readonly ny: number, private readonly w: number, private readonly h: number, jitter: number, rng: Rng) {
    this.cw = w / nx;
    this.ch = h / ny;
    const n = nx * ny;
    this.px = new Float64Array(n);
    this.py = new Float64Array(n);
    this.rs = new Float64Array(n * 2);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i;
        this.px[c] = (i + 1 / 2 + (rng.next() - 1 / 2) * jitter) * this.cw;
        this.py[c] = (j + 1 / 2 + (rng.next() - 1 / 2) * jitter) * this.ch;
        this.rs[c * 2] = rng.next();
        this.rs[c * 2 + 1] = rng.next();
      }
    }
  }

  at(X: number, Y: number, out: VHit): void {
    const x = ((X % this.w) + this.w) % this.w;
    const y = ((Y % this.h) + this.h) % this.h;
    const ci = Math.floor(x / this.cw);
    const cj = Math.floor(y / this.ch);
    let d1 = Infinity;
    let d2 = Infinity;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        let i = ci + di;
        let j = cj + dj;
        let ox = 0;
        let oy = 0;
        if (i < 0) {
          i += this.nx;
          ox = -this.w;
        } else if (i >= this.nx) {
          i -= this.nx;
          ox = this.w;
        }
        if (j < 0) {
          j += this.ny;
          oy = -this.h;
        } else if (j >= this.ny) {
          j -= this.ny;
          oy = this.h;
        }
        const c = j * this.nx + i;
        const dx = (this.px[c] ?? 0) + ox - x;
        const dy = (this.py[c] ?? 0) + oy - y;
        const d = dx * dx + dy * dy;
        if (d < d1) {
          d2 = d1;
          d1 = d;
          out.dx = dx;
          out.dy = dy;
          out.r1 = this.rs[c * 2] ?? 0;
          out.r2 = this.rs[c * 2 + 1] ?? 0;
        } else if (d < d2) d2 = d;
      }
    }
    out.d1 = Math.sqrt(d1);
    out.d2 = Math.sqrt(d2);
  }
}

/** sRGB 0..1 components of a 0xRRGGBB colour. */
export function rgb(hex: number): readonly [number, number, number] {
  const BYTE = 255;
  const R = 16;
  const G = 8;
  return [((hex >> R) & BYTE) / BYTE, ((hex >> G) & BYTE) / BYTE, (hex & BYTE) / BYTE];
}

/** px.rgb = mix(a, b, t) × k. */
export function paintPx(px: Px, a: readonly number[], b: readonly number[], t: number, k: number): void {
  px.r = ((a[0] ?? 0) + ((b[0] ?? 0) - (a[0] ?? 0)) * t) * k;
  px.g = ((a[1] ?? 0) + ((b[1] ?? 0) - (a[1] ?? 0)) * t) * k;
  px.b = ((a[2] ?? 0) + ((b[2] ?? 0) - (a[2] ?? 0)) * t) * k;
}

/** How a recipe's pixels become texture bytes. */
export interface LayerSpec {
  readonly tile: readonly [number, number];
  /** Strength of the height-derived normal map (0: flat). */
  readonly normal: number;
  /** Strength of the cavity darkening derived from height (0..1). */
  readonly cavity: number;
  /** Alpha-tested card: transparent pixels take the card's mean colour so mips don't fringe. */
  readonly card?: boolean;
  readonly make: (seed: number) => Sampler;
}

export interface LayerPixels {
  readonly albedo: Uint8Array;
  /** Ambient occlusion, roughness, metalness (three.js ORM order). */
  readonly orm: Uint8Array;
  readonly normal: Uint8Array | null;
}

const RGBA = 4;
const RGB = 3;
const ALPHA = 3;
/** Normal strengths are tuned at this texture size. */
const NORMAL_REF_SIZE = 64;
const BYTE_MAX = 255;
/** Cavity: the blur radius as a fraction of the texture, and how much a pit below its surroundings darkens. */
const CAVITY_BLUR = 0.0104;
const CAVITY_GAIN = 4;
/** Albedo keeps this share of the cavity term (the painted dark crevices); ORM red keeps all of it. */
const CAVITY_IN_ALBEDO = 0.7;

/** Separable wrap-around box blur with running sums (cost independent of the radius). */
function boxBlurWrap(src: Float32Array, size: number, r: number): Float32Array {
  const pass = (from: Float32Array, at: (line: number, k: number) => number): Float32Array => {
    const to = new Float32Array(from.length);
    const n = 2 * r + 1;
    for (let line = 0; line < size; line++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += from[at(line, wrap(k, size))] ?? 0;
      for (let k = 0; k < size; k++) {
        to[at(line, k)] = s / n;
        s += (from[at(line, wrap(k + r + 1, size))] ?? 0) - (from[at(line, wrap(k - r, size))] ?? 0);
      }
    }
    return to;
  };
  return pass(pass(src, (row, k) => row * size + k), (col, k) => k * size + col);
}

/** Render one layer at size × size (rows bottom-up, matching v). */
export function renderLayer(spec: LayerSpec, size: number, seed: number, withNormal: boolean): LayerPixels {
  const [tw, th] = spec.tile;
  const sample = spec.make(seed);
  const n = size * size;
  const col = new Float32Array(n * RGB);
  const height = new Float32Array(n);
  const alpha = new Float32Array(n);
  const rough = new Float32Array(n);
  const metal = new Float32Array(n);
  const px: Px = { r: 0, g: 0, b: 0, a: 1, h: 0, rough: 1, metal: 0 };
  for (let j = 0; j < size; j++) {
    const Y = ((j + 1 / 2) / size) * th;
    for (let i = 0; i < size; i++) {
      px.a = 1;
      px.metal = 0;
      sample(((i + 1 / 2) / size) * tw, Y, px);
      const p = j * size + i;
      col[p * RGB] = px.r;
      col[p * RGB + 1] = px.g;
      col[p * RGB + 2] = px.b;
      height[p] = px.h;
      alpha[p] = px.a;
      rough[p] = px.rough;
      metal[p] = px.metal;
    }
  }
  const blur = boxBlurWrap(height, size, Math.max(1, Math.round(size * CAVITY_BLUR)));
  const albedo = new Uint8Array(n * RGBA);
  const orm = new Uint8Array(n * RGBA);
  let mean: readonly [number, number, number] = [0, 0, 0];
  if (spec.card) {
    let w = 0;
    const m = [0, 0, 0];
    for (let p = 0; p < n; p++) {
      const a = alpha[p] ?? 0;
      w += a;
      for (let c = 0; c < RGB; c++) m[c] = (m[c] ?? 0) + (col[p * RGB + c] ?? 0) * a;
    }
    mean = [(m[0] ?? 0) / Math.max(w, 1), (m[1] ?? 0) / Math.max(w, 1), (m[2] ?? 0) / Math.max(w, 1)];
  }
  for (let p = 0; p < n; p++) {
    const pit = Math.max(0, (blur[p] ?? 0) - (height[p] ?? 0));
    const ao = clamp01(1 - spec.cavity * pit * CAVITY_GAIN);
    const shade = 1 - (1 - ao) * CAVITY_IN_ALBEDO;
    const a = alpha[p] ?? 1;
    for (let c = 0; c < RGB; c++) {
      const v = spec.card && a < 1 / 2 ? (mean[c] ?? 0) : (col[p * RGB + c] ?? 0) * shade;
      albedo[p * RGBA + c] = Math.round(clamp01(v) * BYTE_MAX);
    }
    albedo[p * RGBA + ALPHA] = Math.round(clamp01(a) * BYTE_MAX);
    orm[p * RGBA] = Math.round(ao * BYTE_MAX);
    orm[p * RGBA + 1] = Math.round(clamp01(rough[p] ?? 1) * BYTE_MAX);
    orm[p * RGBA + 2] = Math.round(clamp01(metal[p] ?? 0) * BYTE_MAX);
    orm[p * RGBA + ALPHA] = BYTE_MAX;
  }
  let normal: Uint8Array | null = null;
  if (withNormal) {
    normal = new Uint8Array(n * RGBA);
    // Height differences per texel, scaled so the strength reads the same at every texture size.
    const k = (spec.normal * size) / NORMAL_REF_SIZE;
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const hx = (height[j * size + wrap(i + 1, size)] ?? 0) - (height[j * size + wrap(i - 1, size)] ?? 0);
        const hy = (height[wrap(j + 1, size) * size + i] ?? 0) - (height[wrap(j - 1, size) * size + i] ?? 0);
        const nx = -hx * k;
        const ny = -hy * k;
        const l = Math.hypot(nx, ny, 1);
        const p = (j * size + i) * RGBA;
        normal[p] = Math.round(((nx / l + 1) / 2) * BYTE_MAX);
        normal[p + 1] = Math.round(((ny / l + 1) / 2) * BYTE_MAX);
        normal[p + 2] = Math.round(((1 / l + 1) / 2) * BYTE_MAX);
        normal[p + ALPHA] = BYTE_MAX;
      }
    }
  }
  return { albedo, orm, normal };
}

/** Halve an RGBA image (2 × 2 box filter). */
export function halve(src: Uint8Array, size: number): Uint8Array {
  const h = size / 2;
  const out = new Uint8Array(h * h * RGBA);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < h; i++) {
      for (let c = 0; c < RGBA; c++) {
        const at = (x: number, y: number): number => src[(y * size + x) * RGBA + c] ?? 0;
        out[(j * h + i) * RGBA + c] = Math.round((at(2 * i, 2 * j) + at(2 * i + 1, 2 * j) + at(2 * i, 2 * j + 1) + at(2 * i + 1, 2 * j + 1)) / RGBA);
      }
    }
  }
  return out;
}
