/** Material library presentation constants (style guide §7, §11.5, §11.6). */
import type { Quality } from '../../app/contracts';

export interface MaterialTier {
  /** Albedo (and normal) layer size in texels; a 2 m tile at 256 is 128 px/m. */
  readonly size: number;
  /** Packed AO/roughness/metalness layer size. */
  readonly ormSize: number;
  /** PBR (albedo + ORM) or Lambert with albedo only. */
  readonly pbr: boolean;
  readonly normal: boolean;
  readonly anisotropy: number;
  /** Cards use alpha-to-coverage where the frame has MSAA. */
  readonly alphaToCoverage: boolean;
}

/**
 * §11.6 tiers. Medium generates 256² layers (128 px/m on a 2 m tile) so all 37 layers generate in about a second;
 * High generates 512² (the guide's 256 px/m) with normal maps (D-RENDER-011).
 */
export const MATERIAL_TIERS: Readonly<Record<Quality, MaterialTier>> = {
  low: { size: 128, ormSize: 128, pbr: false, normal: false, anisotropy: 1, alphaToCoverage: false },
  medium: { size: 256, ormSize: 128, pbr: true, normal: false, anisotropy: 4, alphaToCoverage: true },
  high: { size: 512, ormSize: 256, pbr: true, normal: true, anisotropy: 8, alphaToCoverage: true },
};

/** §7.1 anti-tiling: world-space value variation, two octaves (wavelengths in metres), ± strength. */
export const MACRO_VARIATION = { strength: 0.07, far: 7, near: 2.3 } as const;
/** §7.3: the sky environment map's strength on metal and glass. */
export const ENV_INTENSITY = 0.4;
/** Water scrolls this many tiles per second along u and v. */
export const WATER_FLOW = { u: 0.02, v: 0.013 } as const;
/** Cards: the alpha cut-out (§8.2). */
export const ALPHA_CUTOFF = 0.5;
/** §4.4 per-piece colour: value ±5 %, hue ±3° (applied as a warm/cool tilt); hash constants for the seed. */
export const PIECE_VARIATION = { value: 0.05, hueDeg: 3, fullTurnDeg: 360, hueTilt: 6, hashA: 12.9898, hashB: 43758.5453 } as const;

/**
 * Baked AO (§7.4): concave edges 25–35 % darker (concave × occluded share), faces under overhangs 30 %, the 0.3 m
 * ground-contact band 35 %, and the §5.8 damp gradient (20 % at the foot, gone by 0.8 m) on walls.
 */
export const AO = {
  voxel: 0.25,
  reach: 1.5,
  rays: 10,
  /** π(3 − √5): spreads the ray directions evenly. */
  goldenAngle: 2.399963229728653,
  /** Start rays this many voxels off the surface so a face doesn't occlude itself. */
  lift: 1.2,
  maxVoxels: 6_000_000,
  voxelGrowth: 1.25,
  maxSamplesPerEdge: 2000,
  concave: 0.75,
  downFacing: -0.5,
  underside: 0.3,
  wallNormalY: 0.7,
  contact: 0.35,
  contactBand: 0.3,
  damp: 0.2,
  dampBand: 0.8,
  /** Cylinder mapping never uses a radius below this (thin posts). */
  minRadius: 0.05,
} as const;
