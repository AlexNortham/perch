/* eslint-disable @typescript-eslint/no-magic-numbers -- the bake format: the numbers are the byte layout */
/**
 * Baked implicit bodies at runtime (D-ART-008): decode a skin baked by `mesher.ts` and paint it.
 *
 * Format (little-endian, 4-byte aligned): a header of float32 [version, levels, min xyz, max xyz, vertices V]; V × 3
 * uint16 positions quantised to the box, V × 2 int16 octahedral normals, V × 2 int16 octahedral feather flows (the way
 * the feathers point, in the surface), V × 8 bytes of bones (4 ids into BONE_NAMES, then 4 weights summing to 255),
 * V × 8 bytes of paint regions (4 ids into the body's region list, then 4 weights), padded to 4 bytes; then per level
 * uint32 [vertices used n, indices I] and I uint16 indices into the first n vertices (the coarsest level's come
 * first), padded.
 *
 * Positions are in the model frame at the bind pose. Colour is painted here, per region, from the bird's palette and
 * flock colours: the bake holds only shape and ownership.
 */
import { Color, Vector3 } from 'three';
import { TILE } from './feathers';
import { mix, PATTERN_FADE } from './sculpt';
import type { Finish } from './sculpt';

export const SKIN_FORMAT = { version: 2 } as const;

export interface SkinLevel {
  readonly pos: Float32Array;
  readonly nrm: Float32Array;
  /** Unit feather flow in the surface (bind pose). */
  readonly flow: Float32Array;
  readonly bones: Uint8Array;
  readonly boneW: Float32Array;
  readonly regions: Uint8Array;
  readonly regionW: Float32Array;
  readonly index: Uint16Array;
}

const decoded = new Map<string, readonly SkinLevel[]>();

/** Decode a baked skin (base64, whitespace ignored); cached per string. */
export function decodeSkin(b64: string): readonly SkinLevel[] {
  const hit = decoded.get(b64);
  if (hit) return hit;
  const bin = atob(b64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const buf = bytes.buffer;
  const head = new Float32Array(buf, 0, 9);
  if (head[0] !== SKIN_FORMAT.version) throw new Error(`skin: format ${head[0]}, expected ${SKIN_FORMAT.version}`);
  const lo = [head[2]!, head[3]!, head[4]!];
  const span = [head[5]! - lo[0]!, head[6]! - lo[1]!, head[7]! - lo[2]!];
  const V = head[8]!;
  let o = 36;
  const q = new Uint16Array(buf, o, V * 3);
  o += V * 6;
  const oct = new Int16Array(buf, o, V * 2);
  o += V * 4;
  const octFlow = new Int16Array(buf, o, V * 2);
  o += V * 4;
  const bw = new Uint8Array(buf, o, V * 8);
  o += V * 8;
  const rw = new Uint8Array(buf, o, V * 8);
  o += V * 8 + ((V * 30) % 4 ? 2 : 0);
  const pos = new Float32Array(V * 3);
  const nrm = new Float32Array(V * 3);
  const flow = new Float32Array(V * 3);
  const bones = new Uint8Array(V * 4);
  const boneW = new Float32Array(V * 4);
  const regions = new Uint8Array(V * 4);
  const regionW = new Float32Array(V * 4);
  for (let i = 0; i < V; i++) {
    for (let c = 0; c < 3; c++) pos[i * 3 + c] = lo[c]! + (q[i * 3 + c]! / 65535) * span[c]!;
    nrm.set(octDecode(oct[i * 2]! / 32767, oct[i * 2 + 1]! / 32767), i * 3);
    flow.set(octDecode(octFlow[i * 2]! / 32767, octFlow[i * 2 + 1]! / 32767), i * 3);
    for (let k = 0; k < 4; k++) {
      bones[i * 4 + k] = bw[i * 8 + k]!;
      boneW[i * 4 + k] = bw[i * 8 + 4 + k]! / 255;
      regions[i * 4 + k] = rw[i * 8 + k]!;
      regionW[i * 4 + k] = rw[i * 8 + 4 + k]! / 255;
    }
  }
  // Each level uses the first n of the vertices (coarsest first).
  const levels: SkinLevel[] = [];
  for (let l = 0; l < head[1]!; l++) {
    const [n, I] = new Uint32Array(buf, o, 2) as unknown as [number, number];
    o += 8;
    const index = new Uint16Array(buf.slice(o, o + I * 2));
    o += I * 2 + (I % 2 ? 2 : 0);
    levels.push({
      pos: pos.slice(0, n * 3), nrm: nrm.slice(0, n * 3), flow: flow.slice(0, n * 3), bones: bones.slice(0, n * 4), boneW: boneW.slice(0, n * 4),
      regions: regions.slice(0, n * 4), regionW: regionW.slice(0, n * 4), index,
    });
  }
  decoded.set(b64, levels);
  return levels;
}

function octDecode(x: number, y: number): [number, number, number] {
  let z = 1 - Math.abs(x) - Math.abs(y);
  if (z < 0) {
    const ox = x;
    x = (1 - Math.abs(y)) * (ox >= 0 ? 1 : -1);
    y = (1 - Math.abs(ox)) * (y >= 0 ? 1 : -1);
  }
  const l = Math.hypot(x, y, z) || 1;
  z /= l;
  return [x / l, y / l, z];
}

/** How a paint region looks: a colour (or a painter by model-frame position) and a finish. */
export interface RegionStyle {
  readonly paint: number | ((p: Vector3) => number);
  readonly finish?: Finish;
}

/** A painted skin level, ready to merge into the opaque layer (`sculpt.bake`). */
export interface PaintedSkin {
  readonly level: SkinLevel;
  readonly c: Float32Array;
  readonly fx: Float32Array;
  readonly uv: Float32Array;
}

const colour = new Color();

/**
 * Paint a skin level: colours blend across region borders as a painter mixes (in sRGB); iridescence, glow and gloss
 * blend too; the surface pattern is the strongest region's, fading where it gives way to a region without it. A
 * patterned skin vertex is marked for world-aligned (triplanar) texturing by a negative u (−repeats per metre).
 */
export function paintSkin(level: SkinLevel, regionNames: readonly string[], style: Readonly<Record<string, RegionStyle>>): PaintedSkin {
  const V = level.pos.length / 3;
  const c = new Float32Array(V * 3);
  const fx = new Float32Array(V * 4);
  const uv = new Float32Array(V * 2);
  const p = new Vector3();
  for (let i = 0; i < V; i++) {
    p.fromArray(level.pos, i * 3);
    let hex = -1;
    let acc = 0;
    let iri = 0, glow = 0, gloss = 0;
    const styles: (RegionStyle | undefined)[] = [];
    for (let k = 0; k < 4; k++) {
      const w = level.regionW[i * 4 + k]!;
      const s = style[regionNames[level.regions[i * 4 + k]!] ?? ''];
      styles.push(s);
      if (w <= 0 || !s) continue;
      const h = typeof s.paint === 'number' ? s.paint : s.paint(p);
      acc += w;
      hex = hex < 0 ? h : mix(hex, h, w / acc);
      const f = s.finish ?? {};
      iri += (f.iri ?? 0) * w;
      glow += (f.glow ?? 0) * w;
      gloss += (f.gloss ?? 0) * w;
    }
    // The pattern: the patterned tile with the most weight here, at the strength of its weight. A plain region next to
    // a patterned one carries that tile at low strength, so a triangle never mixes tile indices (which would speckle)
    // and the pattern fades out across the border.
    const byTile = new Map<number, { w: number; size: number }>();
    for (let k = 0; k < 4; k++) {
      const f = styles[k]?.finish;
      const t = f?.tile ?? TILE.flat;
      if (t === TILE.flat) continue;
      const e = byTile.get(t) ?? { w: 0, size: f?.size ?? 0.1 };
      e.w += level.regionW[i * 4 + k]!;
      byTile.set(t, e);
    }
    let tile: number = TILE.flat;
    let size = 0.1;
    let same = 0;
    for (const [t, e] of byTile) if (e.w > same) [tile, size, same] = [t, e.size, e.w];
    colour.setHex(Math.max(0, hex));
    c[i * 3] = colour.r;
    c[i * 3 + 1] = colour.g;
    c[i * 3 + 2] = colour.b;
    const norm = acc || 1;
    fx[i * 4] = iri / norm;
    fx[i * 4 + 1] = glow / norm;
    fx[i * 4 + 2] = gloss / norm;
    fx[i * 4 + 3] = tile + PATTERN_FADE * Math.min(1, Math.max(0, 1 - same));
    uv[i * 2] = tile === TILE.flat ? 0.5 : -1 / size;
    uv[i * 2 + 1] = 0.5;
  }
  return { level, c, fx, uv };
}
