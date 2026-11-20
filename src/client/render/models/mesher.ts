/* eslint-disable @typescript-eslint/no-magic-numbers -- meshing maths and the bake format: the numbers are the algorithm */
/**
 * The offline half of the implicit body pipeline (D-ART-008): a body's field becomes four levels of a baked mesh.
 *  1. Surface nets on a fine grid (6 mm by default), sampled only in blocks near the surface;
 *  2. every vertex pulled exactly onto the surface along the field's gradient;
 *  3. meshoptimizer's attribute-aware simplifier (never moves a vertex) cuts each level from the one above to its
 *     triangle target, keeping normals, paint regions and skin weights from smearing across their borders;
 *  4. each kept vertex takes its normal, bone weights and paint regions straight from the field.
 * The result is packed into a small binary (see `skin.ts` for the format) that is committed and decoded at runtime.
 * Bake-time only: nothing in the game imports this module.
 */
import { MeshoptSimplifier } from 'meshoptimizer';
import { BONE_NAMES } from './bird';
import { Field } from './sdf';
import type { Body } from './sdf';
import { SKIN_FORMAT } from './skin';

export interface MeshOptions {
  /** Grid cell (m). */
  readonly cell?: number;
}

interface Raw {
  readonly pos: Float32Array;
  readonly index: Uint32Array;
}

/** Surface nets over the field, with vertices projected onto the surface. */
export function surfaceNets(field: Field, cell: number): Raw {
  const h = cell;
  const lo = field.min.map((v) => v - 2 * h);
  const hi = field.max.map((v) => v + 2 * h);
  const nx = Math.ceil((hi[0]! - lo[0]!) / h) + 1;
  const ny = Math.ceil((hi[1]! - lo[1]!) / h) + 1;
  const nz = Math.ceil((hi[2]! - lo[2]!) / h) + 1;
  const at = (i: number, j: number, k: number): number => i + nx * (j + ny * k);
  const val = new Float32Array(nx * ny * nz);
  // Narrow band: a block whose centre is further from the surface than its half-diagonal (with margin) is all one side.
  const B = 4;
  const bx = Math.ceil(nx / B), by = Math.ceil(ny / B), bz = Math.ceil(nz / B);
  const reach = 1.6 * Math.sqrt(3) * (B / 2) * h + 2 * h;
  const centre = new Float32Array(bx * by * bz);
  const active = new Uint8Array(bx * by * bz);
  for (let K = 0; K < bz; K++) for (let J = 0; J < by; J++) for (let I = 0; I < bx; I++) {
    const d = field.d(lo[0]! + (I * B + B / 2) * h, lo[1]! + (J * B + B / 2) * h, lo[2]! + (K * B + B / 2) * h);
    centre[I + bx * (J + by * K)] = d;
    if (Math.abs(d) < reach) active[I + bx * (J + by * K)] = 1;
  }
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    // A point is exact if any block touching it is active.
    let near = false;
    const I0 = Math.floor(i / B), J0 = Math.floor(j / B), K0 = Math.floor(k / B);
    for (let dk = (k % B === 0 ? -1 : 0); dk <= 0 && !near; dk++) for (let dj = (j % B === 0 ? -1 : 0); dj <= 0 && !near; dj++) for (let di = (i % B === 0 ? -1 : 0); di <= 0 && !near; di++) {
      const I = I0 + di, J = J0 + dj, K = K0 + dk;
      if (I >= 0 && J >= 0 && K >= 0 && I < bx && J < by && K < bz && active[I + bx * (J + by * K)]) near = true;
    }
    val[at(i, j, k)] = near ? field.d(lo[0]! + i * h, lo[1]! + j * h, lo[2]! + k * h) : Math.sign(centre[Math.min(bx - 1, I0) + bx * (Math.min(by - 1, J0) + by * Math.min(bz - 1, K0))]!) * reach;
  }
  // One vertex per cell that the surface crosses: the mean of its edge crossings.
  const cellId = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cid = (i: number, j: number, k: number): number => i + (nx - 1) * (j + (ny - 1) * k);
  const pos: number[] = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]] as const;
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]] as const;
  const v = new Float64Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let inside = 0;
    for (let c = 0; c < 8; c++) {
      const [ci, cj, ck] = corner[c]!;
      v[c] = val[at(i + ci, j + cj, k + ck)]!;
      if (v[c]! < 0) inside++;
    }
    if (inside === 0 || inside === 8) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      const va = v[a]!, vb = v[b]!;
      if (va < 0 === vb < 0) continue;
      const t = va / (va - vb);
      const [ai, aj, ak] = corner[a]!;
      const [bi, bj, bk] = corner[b]!;
      sx += ai + (bi - ai) * t;
      sy += aj + (bj - aj) * t;
      sz += ak + (bk - ak) * t;
      n++;
    }
    cellId[cid(i, j, k)] = pos.length / 3;
    pos.push(lo[0]! + (i + sx / n) * h, lo[1]! + (j + sy / n) * h, lo[2]! + (k + sz / n) * h);
  }
  // A quad round every grid edge the surface crosses, wound so it faces out.
  const index: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean): void => {
    if (flip) [b, d] = [d, b];
    const P = (q: number, o: number): number => pos[q * 3 + o]!;
    const dist = (p: number, q: number): number => (P(p, 0) - P(q, 0)) ** 2 + (P(p, 1) - P(q, 1)) ** 2 + (P(p, 2) - P(q, 2)) ** 2;
    if (dist(a, c) <= dist(b, d)) index.push(a, b, c, a, c, d);
    else index.push(a, b, d, b, c, d);
  };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = val[at(i, j, k)]!, b = val[at(i + 1, j, k)]!;
    if (a < 0 === b < 0) continue;
    quad(cellId[cid(i, j - 1, k - 1)]!, cellId[cid(i, j, k - 1)]!, cellId[cid(i, j, k)]!, cellId[cid(i, j - 1, k)]!, a >= 0);
  }
  for (let k = 1; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = val[at(i, j, k)]!, b = val[at(i, j + 1, k)]!;
    if (a < 0 === b < 0) continue;
    quad(cellId[cid(i - 1, j, k - 1)]!, cellId[cid(i - 1, j, k)]!, cellId[cid(i, j, k)]!, cellId[cid(i, j, k - 1)]!, a >= 0);
  }
  for (let k = 0; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const a = val[at(i, j, k)]!, b = val[at(i, j, k + 1)]!;
    if (a < 0 === b < 0) continue;
    quad(cellId[cid(i - 1, j - 1, k)]!, cellId[cid(i, j - 1, k)]!, cellId[cid(i, j, k)]!, cellId[cid(i - 1, j, k)]!, a >= 0);
  }
  const out = new Float32Array(pos.length);
  for (let q = 0; q < pos.length; q += 3) {
    const p = field.project([pos[q]!, pos[q + 1]!, pos[q + 2]!], 3);
    out[q] = p[0];
    out[q + 1] = p[1];
    out[q + 2] = p[2];
  }
  return { pos: out, index: new Uint32Array(index) };
}

/** A fixed, well-spread direction per integer (for embedding region and bone ids as simplifier attributes). */
function spread(i: number): [number, number, number] {
  const g = 2.399963229728653;
  const y = 1 - ((i * 0.618034) % 1) * 2;
  const r = Math.sqrt(1 - y * y);
  return [Math.cos(g * i) * r, y, Math.sin(g * i) * r];
}

/** Bake a body: four levels, each simplified from the one above, packed for `skin.ts`. */
export async function bakeBody(body: Body, o: MeshOptions = {}): Promise<Uint8Array> {
  await MeshoptSimplifier.ready;
  const field = new Field(body);
  const raw = surfaceNets(field, o.cell ?? 0.006);
  const nv = raw.pos.length / 3;
  // Attributes the simplifier keeps from smearing: the normal, and embeddings of the paint regions and the bones.
  const ATTR = 9;
  const attr = new Float32Array(nv * ATTR);
  const owners = [];
  for (let i = 0; i < nv; i++) {
    const x = raw.pos[i * 3]!, y = raw.pos[i * 3 + 1]!, z = raw.pos[i * 3 + 2]!;
    const n = field.normal(x, y, z);
    const w = field.owners(x, y, z);
    owners.push(w);
    attr.set(n, i * ATTR);
    for (const [r, wr] of w.regions) {
      const e = spread(field.regions.indexOf(r) + 1);
      for (let c = 0; c < 3; c++) attr[i * ATTR + 3 + c]! += e[c]! * wr;
    }
    for (const [b, wb] of w.bones) {
      const e = spread(BONE_NAMES.indexOf(b) + 40);
      for (let c = 0; c < 3; c++) attr[i * ATTR + 6 + c]! += e[c]! * wb;
    }
  }
  const weights = [0.35, 0.35, 0.35, 0.6, 0.6, 0.6, 0.4, 0.4, 0.4];
  const levels: Uint32Array[] = [];
  let index = raw.index;
  for (const target of body.tris) {
    [index] = MeshoptSimplifier.simplifyWithAttributes(index, raw.pos, 3, attr, ATTR, weights, null, target * 3, 1, ['Regularize']);
    levels.push(index);
  }
  return pack(field, raw.pos, owners, levels);
}

/**
 * Pack the levels (see SKIN_FORMAT). Every level keeps a subset of the vertices of the level above, so the vertices
 * are stored once, coarsest first: each level uses a prefix of them.
 */
function pack(field: Field, pos: Float32Array, owners: ReturnType<Field['owners']>[], levels: readonly Uint32Array[]): Uint8Array {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i++) {
    lo[i % 3] = Math.min(lo[i % 3]!, pos[i]!);
    hi[i % 3] = Math.max(hi[i % 3]!, pos[i]!);
  }
  const remap = new Map<number, number>();
  const order: number[] = [];
  const prefix: number[] = [];
  for (const idx of [...levels].reverse()) {
    for (const v of idx) {
      if (remap.has(v)) continue;
      remap.set(v, order.length);
      order.push(v);
    }
    prefix.unshift(order.length);
  }
  const V = order.length;
  const q = new Uint16Array(V * 3);
  const nrm = new Int16Array(V * 2);
  const bones = new Uint8Array(V * 8);
  const regions = new Uint8Array(V * 8);
  order.forEach((src, i) => {
    for (let c = 0; c < 3; c++) q[i * 3 + c] = Math.round(((pos[src * 3 + c]! - lo[c]!) / Math.max(1e-6, hi[c]! - lo[c]!)) * 65535);
    const [ox, oy] = octEncode(field.normal(pos[src * 3]!, pos[src * 3 + 1]!, pos[src * 3 + 2]!));
    nrm[i * 2] = Math.round(ox * 32767);
    nrm[i * 2 + 1] = Math.round(oy * 32767);
    const w = owners[src]!;
    quantise(w.bones.map(([b, x]) => [BONE_NAMES.indexOf(b), x]), bones, i * 8);
    quantise(w.regions.map(([r, x]) => [field.regions.indexOf(r), x]), regions, i * 8);
  });
  const chunks: Uint8Array[] = [new Uint8Array(new Float32Array([SKIN_FORMAT.version, levels.length, ...lo, ...hi, V]).buffer)];
  chunks.push(new Uint8Array(q.buffer), new Uint8Array(nrm.buffer), bones, regions);
  if ((V * 26) % 4) chunks.push(new Uint8Array(2));
  levels.forEach((idx, l) => {
    const tri = Uint16Array.from(idx, (v) => remap.get(v)!);
    chunks.push(new Uint8Array(new Uint32Array([prefix[l]!, idx.length]).buffer), new Uint8Array(tri.buffer));
    if (idx.length % 2) chunks.push(new Uint8Array(2));
  });
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/** Up to four [id, weight] pairs as bytes: ids, then weights summing to 255. */
function quantise(w: readonly (readonly [number, number])[], dst: Uint8Array, at: number): void {
  const n = Math.min(4, w.length);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    dst[at + i] = w[i]![0];
    const q = i === n - 1 ? 255 - sum : Math.round(w[i]![1] * 255);
    dst[at + 4 + i] = q;
    sum += q;
  }
}

function octEncode(n: readonly [number, number, number]): [number, number] {
  const l = Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]) || 1;
  let x = n[0] / l;
  let y = n[1] / l;
  if (n[2] < 0) {
    const ox = x;
    x = (1 - Math.abs(y)) * (ox >= 0 ? 1 : -1);
    y = (1 - Math.abs(ox)) * (y >= 0 ? 1 : -1);
  }
  return [x, y];
}
