/**
 * The build context every environment generator writes into: meshers bucketed by pass, detail band and 32 m cell,
 * the map and its dressing descriptor, a seeded hash, and the set of blockout prims the environment re-skins.
 */
import type { MapData } from '../../../sim/core/contracts';
import type { MapDressing } from '../../../sim/core/contracts';
import { CELL } from './constants';
import type { Band } from './constants';
import { Mesher, groundOcclusion } from './mesher';

/** opaque: receives shadows only; cast: also casts (≥ 0.5 m pieces, §11.4); cutout: alpha-tested cards. */
export type Pass = 'opaque' | 'cast' | 'cutout';
export const PASSES: readonly Pass[] = ['opaque', 'cast', 'cutout'];

export interface Bucket {
  readonly pass: Pass;
  readonly band: Band;
  readonly mesher: Mesher;
}

const HASH_A = 12.9898;
/** Outside band 0 only chamfers at least this big are modelled (plinths, courses, cornices). */
const MIN_BEVEL_FAR = 0.025;
const HASH_B = 78.233;
const HASH_C = 43758.5453;

/** Deterministic 0..1 from two numbers (stable dressing between runs, §4.4). */
export function hash2(a: number, b: number): number {
  const s = Math.sin(a * HASH_A + b * HASH_B) * HASH_C;
  return s - Math.floor(s);
}

export class World {
  readonly buckets = new Map<string, Bucket>();
  /** Indices into map.prims that the environment re-skins completely; the blockout leaves them out. */
  readonly covered = new Set<number>();

  constructor(readonly map: MapData, readonly dressing: MapDressing) {}

  /** The mesher for geometry anchored at (x, z). Ground-contact shading is set for `ground`. */
  m(pass: Pass, band: Band, x: number, z: number, ground = 0): Mesher {
    const ix = Math.floor(x / CELL);
    const iz = Math.floor(z / CELL);
    const key = `${pass}:${band}:${ix}:${iz}`;
    let b = this.buckets.get(key);
    if (!b) {
      b = { pass, band, mesher: new Mesher() };
      this.buckets.set(key, b);
    }
    b.mesher.occlusion = groundOcclusion(ground);
    b.mesher.ambient = 1;
    b.mesher.minBevel = band === 0 ? 0 : MIN_BEVEL_FAR;
    b.mesher.frame.identity();
    return b.mesher;
  }
}
