/** Rendering presentation constants (D-EP-009). Colours live in palette.ts. */
import type { Quality } from '../app/contracts';

export interface QualityPreset {
  /** Cap on devicePixelRatio, times the render scale. */
  readonly maxPixelRatio: number;
  readonly renderScale: number;
  readonly antialias: boolean;
  /** Shadow-map size in texels; 0 = no shadows. */
  readonly shadowMapSize: number;
  /** Exponential-squared fog density at ground level (GDD §14.5: 0.0055 on Medium). */
  readonly fogDensity: number;
}

/** GDD §12.9 / §14.5. Switching preset rebuilds the WebGL context (antialiasing is fixed at context creation). */
export const QUALITY_PRESETS: Readonly<Record<Quality, QualityPreset>> = {
  low: { maxPixelRatio: 1, renderScale: 0.75, antialias: false, shadowMapSize: 0, fogDensity: 0.007 },
  medium: { maxPixelRatio: 1, renderScale: 1, antialias: true, shadowMapSize: 1024, fogDensity: 0.0055 },
  high: { maxPixelRatio: 2, renderScale: 1, antialias: true, shadowMapSize: 2048, fogDensity: 0.0045 },
};

/** Sun (GDD §14.5): elevation 28°, from the south-west. */
export const SUN = {
  elevationDeg: 28,
  /** Horizontal direction toward the sun: south-west is −x (west) and −z (south). */
  azimuth: { x: -Math.SQRT1_2, z: -Math.SQRT1_2 },
  /** GDD §14.5 values, read as multiples of the surface colour (see LIGHT_UNIT). */
  intensity: 2.2,
  /** GDD says 0.6; 1.0 keeps faces turned from the sun readable (D-RENDER-002). */
  hemiIntensity: 1,
} as const;
/**
 * Three's lights are physical (a directional light of intensity π lights a facing surface at its full colour); the
 * GDD's numbers are art values, so they are scaled by this, then tone-mapped.
 */
export const LIGHT_UNIT = Math.PI;
export const TONE_EXPOSURE = 1;

/** Soft PCF filter radius in shadow-map texels. */
export const SHADOW_RADIUS = 1.2;
export const SHADOW_BIAS = -0.0004;
export const SHADOW_NORMAL_BIAS = 0.08;
/** How much of the sun a shadow removes (1 = all): softer shadows keep shaded lanes readable. */
export const SHADOW_INTENSITY = 0.8;
/** The shadow box follows the camera's target: half-size = camera-to-target distance × this, clamped. */
export const SHADOW_FIT = 1.1;
export const SHADOW_MIN_HALF = 45;
export const SHADOW_MAX_HALF = 240;
/** How far up the sun direction the shadow camera sits, and its depth range. */
export const SHADOW_DISTANCE = 400;

/**
 * Fog thins with camera height, like aerial haze: density × min(1, FOG_HEIGHT_REF / camera height). The player camera
 * gets the GDD density; the overview and top cameras see the whole map through light haze.
 */
export const FOG_HEIGHT_REF = 30;
/** exp2 fog is ~99% at density × distance = this: the far plane sits there. */
export const FOG_OPAQUE = 2.15;
export const NEAR = 0.1;
/** High cameras push the near plane out (depth precision for the overview): near = max(NEAR, height × this). */
export const NEAR_PER_HEIGHT = 0.005;
export const FAR_MIN = 300;
export const FAR_MAX = 3000;

/** Sky texture (equirectangular, canvas-drawn). */
export const SKY_SIZE = { width: 128, height: 64 } as const;
/** Fraction of fog colour mixed into the horizon so distant ground meets the sky without a seam. */
export const SKY_HORIZON_HAZE = 0.45;
/** Sky gradient exponent: >1 keeps the horizon colour lower. */
export const SKY_CURVE = 0.6;

/** Blockout shading: per-prim colour jitter (±) and the darkening at the foot of a prim (fake ambient occlusion). */
export const PRIM_JITTER = 0.06;
export const PRIM_FOOT_SHADE = 0.72;
/** Prims shorter than this get no foot shading (slabs, roads). */
export const PRIM_FOOT_MIN_HEIGHT = 1.5;
export const CYLINDER_SEGMENTS = 10;
/** Water sits a little brighter and never casts shadows. */
export const WATER_EMISSIVE = 0.12;
/** Team-coloured prims glow a little (GDD §14.3: structure glow). */
export const TEAM_EMISSIVE = 0.25;

/** Lane ribbons: lifted above the path, translucent so the ground reads through. */
export const LANE_LIFT = 0.12;
export const LANE_OPACITY = 0.35;
/** Updraft cables (GDD §3.7: 12 m above the lane) and station posts. */
export const CABLE_RADIUS = 0.12;
export const CABLE_SEGMENTS_PER_POINT = 6;
export const STATION_POST_RADIUS = 0.35;
export const STATION_RING_RADIUS = 1.6;
export const STATION_RING_TUBE = 0.18;
export const UPDRAFT_HEIGHT = 12;
/** Chimneys (GDD §3.8: 1.5 m warm-air shafts) and Vines. */
export const CHIMNEY_RADIUS = 1.5;
export const CHIMNEY_OPACITY = 0.28;
export const VINE_WIDTH = 1.4;
export const VINE_DEPTH = 0.25;
/** Shops: a ground ring of the zone's radius plus a team-coloured canopy. */
export const SHOP_RING_WIDTH = 0.6;
export const SHOP_RING_LIFT = 0.15;
export const SHOP_CANOPY = { radius: 2.4, height: 2, post: 3 } as const;
/** Structure anchor placeholders (hidden once the world spawns structure entities): footprint radius and height. */
export const STRUCTURE_MARKERS = {
  hawk: { radius: 2, height: 9 },
  heron: { radius: 2.5, height: 14 },
  warden: { radius: 1.5, height: 5 },
  shrine: { radius: 2, height: 7 },
  patron: { radius: 8, height: 14 },
} as const;
export const MARKER_PLINTH_HEIGHT = 0.6;
export const MARKER_PLINTH_SCALE = 1.4;

/** The decorative forest and floor beyond the map (never collides). */
export const BACKDROP = {
  /** Floor plane: size and depth under y = 0 (inside the map's ground slab, so it never z-fights). */
  floorSize: 6000,
  floorY: -0.3,
  /** Maps shallower than refDepth (z extent) get a proportionally smaller forest, down to minScale. */
  refDepth: 300,
  minScale: 0.4,
  /** Rings of giant trees starting this far outside the bounds (the Level Designer owns the first 20 m band). */
  margin: 28,
  rings: 3,
  ringSpacing: 22,
  treeSpacing: 20,
  trunkRadius: { min: 2.5, max: 5 },
  trunkHeight: { min: 26, max: 40 },
  canopyRadius: { min: 10, max: 17 },
  /** Canopy squash (y scale) and how far it sinks over the trunk top. */
  canopySquash: 0.6,
  canopySink: 0.3,
  /** Random offset of each tree, as a fraction of the spacing. */
  scatter: 0.4,
} as const;

/** Shared geometry detail. */
export const TRUNK_SEGMENTS = 7;
export const TORUS_SEGMENTS = { radial: 4, tubular: 16 } as const;
