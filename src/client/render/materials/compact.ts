/**
 * Vertex memory for painted geometry: weld identical vertices into an indexed mesh and pack the library's attributes
 * into small types the shader reads as before (normals Int8×4 normalised, colours Uint8×4 normalised, the layer
 * Uint8; position and uv stay Float32). A painted triangle soup drops from 144 to about 30 bytes a triangle.
 * Call it last, after painting and baking AO (both work on float attributes).
 */
import { BufferAttribute, BufferGeometry } from 'three';
import { COMPACT } from './constants';

const XYZ = 3;
const RGBA = 4;

/** Quantised vertex keys in an open-addressing table: no strings, so welding a whole map stays fast. */
function weld(g: BufferGeometry, names: readonly string[]): { index: Uint32Array; first: Int32Array; count: number } {
  const attrs = names.map((n) => g.getAttribute(n)).filter((a) => a !== undefined);
  const n = attrs[0]?.count ?? 0;
  const width = attrs.reduce((s, a) => s + a.itemSize, 0);
  const keys = new Int32Array(n * width);
  for (let v = 0; v < n; v++) {
    let o = v * width;
    for (const a of attrs) {
      const q = a === attrs[0] ? COMPACT.positionSteps : COMPACT.attributeSteps;
      for (let c = 0; c < a.itemSize; c++) keys[o++] = Math.round(a.getComponent(v, c) * q);
    }
  }
  let size = 1;
  while (size < n * 2) size <<= 1;
  const table = new Int32Array(size).fill(-1);
  const index = new Uint32Array(n);
  const first = new Int32Array(n);
  let count = 0;
  for (let v = 0; v < n; v++) {
    let h: number = COMPACT.hashSeed;
    for (let c = 0; c < width; c++) h = Math.imul(h ^ (keys[v * width + c] ?? 0), COMPACT.hashPrime);
    let slot = (h >>> 0) & (size - 1);
    for (;;) {
      const u = table[slot] ?? -1;
      if (u < 0) {
        table[slot] = count;
        first[count] = v;
        index[v] = count++;
        break;
      }
      const w = first[u] ?? 0;
      let same = true;
      for (let c = 0; c < width && same; c++) same = keys[w * width + c] === keys[v * width + c];
      if (same) {
        index[v] = u;
        break;
      }
      slot = (slot + 1) & (size - 1);
    }
  }
  return { index, first, count };
}

/**
 * Welded, packed copy of `g` (the original is disposed). Works on soups and indexed meshes (welded in place, the index
 * remapped), painted geometry and position-only proxies.
 */
export function compactGeometry(g: BufferGeometry): BufferGeometry {
  const soup = g;
  const names = ['position', 'normal', 'uv', 'matLayer', 'color'].filter((n) => soup.getAttribute(n));
  const { index, first, count } = weld(soup, names);
  const out = new BufferGeometry();
  const pick = (name: string, make: (v: number, c: number) => number, Arr: Float32ArrayConstructor | Int8ArrayConstructor | Uint8ArrayConstructor, size: number, normalized: boolean): void => {
    const data = new Arr(count * size);
    for (let u = 0; u < count; u++) for (let c = 0; c < size; c++) data[u * size + c] = make(first[u] ?? 0, c);
    out.setAttribute(name, new BufferAttribute(data, size, normalized));
  };
  const pos = soup.getAttribute('position');
  pick('position', (v, c) => pos.getComponent(v, c), Float32Array, XYZ, false);
  const nor = soup.getAttribute('normal');
  if (nor) pick('normal', (v, c) => (c < XYZ ? Math.round(nor.getComponent(v, c) * COMPACT.int8) : 0), Int8Array, RGBA, true);
  const uv = soup.getAttribute('uv');
  if (uv) pick('uv', (v, c) => uv.getComponent(v, c), Float32Array, 2, false);
  const layer = soup.getAttribute('matLayer');
  if (layer) pick('matLayer', (v) => layer.getX(v), Uint8Array, 1, false);
  const col = soup.getAttribute('color');
  if (col) pick('color', (v, c) => (c < XYZ ? Math.round(Math.min(1, Math.max(0, col.getComponent(v, c))) * COMPACT.uint8) : COMPACT.uint8), Uint8Array, RGBA, true);
  // An indexed input keeps its triangles: map each old vertex id through the weld.
  const tris = g.index ? Uint32Array.from(g.index.array as ArrayLike<number>, (v) => index[v] ?? 0) : index;
  out.setIndex(new BufferAttribute(count > COMPACT.uint16Max ? tris : Uint16Array.from(tris), 1));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  g.dispose();
  return out;
}

/** Bytes of vertex and index data in a geometry (for the memory budget). */
export function geometryBytes(g: BufferGeometry): number {
  let b = g.index ? g.index.array.byteLength : 0;
  for (const a of Object.values(g.attributes)) b += (a.array as ArrayLike<number> & { byteLength: number }).byteLength;
  return b;
}
