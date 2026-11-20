/**
 * The build context every environment generator writes into: meshers bucketed by pass, detail band and 32 m cell,
 * the map and its dressing descriptor, a seeded hash, and the set of blockout prims the environment re-skins.
 */
import { Vector3 } from 'three';
import type { Matrix4 } from 'three';
import type { MapData } from '../../../sim/core/contracts';
import type { MapDressing } from '../../../sim/core/contracts';
import { CAMERA } from '../../../sim/data/core';
import { CAMERA_CLEAR, CELL } from './constants';
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
const MIN_BEVEL_MID = 0.025;
/** Always-drawn geometry keeps only big chamfers (hedges, chimney caps); long trims read their edge from texture. */
const MIN_BEVEL_FAR = 0.05;
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
  /** Prims another generator has already dressed (left to the blockout, skipped by walls.ts). */
  readonly dressed = new Set<number>();
  /** Spots where a small ambient bird could sit (ridges, rails, sills, wires, rims), in world space; life.ts picks. */
  readonly perches: { x: number; y: number; z: number; yaw: number }[] = [];

  /**
   * Camera space kept clear of visual-only dressing: a vertical cylinder round every spawn (every respawn point) and
   * every shop, as wide as the longest boom plus the shoulder and a margin, from the floor to above the highest
   * camera. Cards and leaf clumps never grow into it.
   */
  readonly keepOut: { readonly x: number; readonly z: number; readonly r: number; readonly y0: number; readonly y1: number }[];

  constructor(readonly map: MapData, readonly dressing: MapDressing) {
    const reach = CAMERA.boomMax + CAMERA.shoulderRight + CAMERA_CLEAR.margin;
    this.keepOut = [
      ...map.spawns.map((s) => ({ x: s.pos.x, z: s.pos.z, r: reach, y0: s.pos.y - 1, y1: s.pos.y + CAMERA_CLEAR.height })),
      ...map.shops.map((s) => ({ x: s.pos.x, z: s.pos.z, r: s.radius + reach, y0: s.pos.y - 1, y1: s.pos.y + CAMERA_CLEAR.height })),
    ];
  }

  /** Does a sphere (centre p, radius r) reach into the camera space? */
  readonly inKeepOut = (p: Vector3, r: number): boolean =>
    this.keepOut.some((k) => p.y + r > k.y0 && p.y - r < k.y1 && Math.hypot(p.x - k.x, p.z - k.z) < k.r + r);

  /** Register a perch at a local point of a rigid `frame`, the bird facing local `yaw`. */
  perch(frame: Matrix4, x: number, y: number, z: number, yaw = 0): void {
    const p = new Vector3(x, y, z).applyMatrix4(frame);
    const d = new Vector3(Math.sin(yaw), 0, Math.cos(yaw)).transformDirection(frame);
    this.perches.push({ x: p.x, y: p.y, z: p.z, yaw: Math.atan2(d.x, d.z) });
  }

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
    b.mesher.minBevel = band === 0 ? 0 : band === 1 ? MIN_BEVEL_MID : MIN_BEVEL_FAR;
    b.mesher.frame.identity();
    b.mesher.keepOut = pass === 'cutout' ? this.inKeepOut : null;
    return b.mesher;
  }
}
