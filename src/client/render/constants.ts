/** Rendering presentation constants (D-EP-009), to the art style guide (docs/art/style-guide.md, D-DIR-015). */
import type { Quality } from '../app/contracts';

export interface QualityPreset {
  /** Cap on devicePixelRatio, times the render scale. */
  readonly maxPixelRatio: number;
  readonly renderScale: number;
  readonly antialias: boolean;
  /** Shadow-map size in texels; 0 = no shadows (§11.6: none, 1024 PCF, 2048 soft PCF). */
  readonly shadowMapSize: number;
  /** Exponential-squared fog density at ground level (§10.2: 0.0060 at Medium). */
  readonly fogDensity: number;
  /** Post-processing (§10.4): bloom on emissive, split tone and vignette; 'half' renders bloom at half size. */
  readonly post: 'none' | 'half' | 'full';
}

/** §11.6. Switching preset rebuilds the WebGL context (antialiasing is fixed at context creation). */
export const QUALITY_PRESETS: Readonly<Record<Quality, QualityPreset>> = {
  low: { maxPixelRatio: 1, renderScale: 0.75, antialias: false, shadowMapSize: 0, fogDensity: 0.0068, post: 'none' },
  medium: { maxPixelRatio: 1, renderScale: 1, antialias: true, shadowMapSize: 1024, fogDensity: 0.006, post: 'half' },
  high: { maxPixelRatio: 2, renderScale: 1, antialias: true, shadowMapSize: 2048, fogDensity: 0.0052, post: 'full' },
};

/** Late golden hour (§10.1): the sun 24° up from the south-west. */
export const SUN = {
  elevationDeg: 24,
  /** Horizontal direction toward the sun: south-west is −x (west) and −z (south). */
  azimuth: { x: -Math.SQRT1_2, z: -Math.SQRT1_2 },
  /** Key to fill about 3 : 1 outdoors (§10.1), in multiples of the surface colour (see LIGHT_UNIT). */
  intensity: 2.4,
  hemiIntensity: 0.8,
} as const;

/** §10.1–§10.2 colours (sRGB). They replace GDD §14.5's, so the renderer keeps its own copy. */
export const LIGHT = {
  sun: 0xffd9a0,
  hemiSky: 0x8fa6c9,
  hemiGround: 0x4a4a3a,
  /** Warm lavender haze. */
  fog: 0xa99bb0,
} as const;

/** §10.2 sky: the GDD gradient, a soft sun glow and thin cloud bands. */
export const SKY = {
  southHorizon: 0xf6c9a0,
  southZenith: 0x9cc3d9,
  northHorizon: 0x8c86c9,
  northZenith: 0x5e6fa8,
  sunGlow: 0xffe2b0,
  /** Glow falloff (higher = tighter) and strength around the sun's direction. */
  glowPower: 24,
  glowStrength: 0.55,
  /** A wide halo under the glow. */
  haloPower: 4,
  haloStrength: 0.18,
  cloud: 0xf4e6dc,
  /** Cloud bands: count, their elevation band (sine of altitude), strength. */
  cloudBands: 4,
  cloudLow: 0.06,
  cloudHigh: 0.38,
  cloudStrength: 0.22,
  cloudWidth: 0.025,
  /** Streaks around the sky per band, and a phase per band so bands don't line up. */
  cloudWaves: 5,
  cloudPhase: 1.7,
  /** Fraction of fog colour mixed into the horizon so distant ground meets the sky without a seam. */
  horizonHaze: 0.45,
  /** Gradient exponent: >1 keeps the horizon colour lower. */
  curve: 0.6,
  width: 512,
  height: 256,
} as const;

/**
 * Three's lights are physical (a directional light of intensity π lights a facing surface at its full colour); the
 * guide's numbers are art values, so they are scaled by this, then tone-mapped.
 */
export const LIGHT_UNIT = Math.PI;
export const TONE_EXPOSURE = 1.05;

/** Soft PCF filter radius in shadow-map texels. */
export const SHADOW_RADIUS = 1.2;
export const SHADOW_BIAS = -0.0004;
export const SHADOW_NORMAL_BIAS = 0.08;
/** How much of the sun a shadow removes (1 = all): shadow faces stay cool blue-violet at 25–35 % value (§10.1). */
export const SHADOW_INTENSITY = 0.85;
/** The shadow box follows the camera's target: half-size = camera-to-target distance × this, clamped. */
export const SHADOW_FIT = 1.1;
export const SHADOW_MIN_HALF = 45;
export const SHADOW_MAX_HALF = 240;
/** How far up the sun direction the shadow camera sits, and its depth range. */
export const SHADOW_DISTANCE = 400;

/**
 * Fog thins with camera height, like aerial haze: density × min(1, FOG_HEIGHT_REF / camera height). The player camera
 * gets the full density; the overview and top cameras see the whole map through light haze.
 */
export const FOG_HEIGHT_REF = 30;
/** exp2 fog is ~99% at density × distance = this: the far plane sits there. */
export const FOG_OPAQUE = 2.15;
export const NEAR = 0.1;
/** High cameras push the near plane out (depth precision for the overview): near = max(NEAR, height × this). */
export const NEAR_PER_HEIGHT = 0.005;
export const FAR_MIN = 300;
export const FAR_MAX = 3000;

/** Post-processing (§10.4): bloom picks up emissive only; a gentle warm/cool split tone and a 10 % vignette. */
export const POST = {
  /**
   * In scene-linear units before tone mapping: above the brightest sunlit surface (a white bird, about 2.6), below emissive layers
   * (scaled by EMISSIVE_HDR), so only lights bloom. The guide's 0.9 is display-referred.
   */
  bloomThreshold: 2.8,
  bloomStrength: 0.35,
  bloomRadius: 0.4,
  /** Split tone: highlights lean warm, shadows cool, by this much. */
  warm: { r: 1.02, g: 1.0, b: 0.97 },
  cool: { r: 0.97, g: 0.99, b: 1.04 },
  vignette: 0.1,
  /** MSAA samples on the HDR scene target. */
  samples: 4,
} as const;

/** §11.4: static architecture merges per 64 × 64 m cell; AO bakes across neighbouring cells. */
export const CELL = { size: 64, aoReach: 1.5, aoVoxel: 0.5 } as const;
/** §11.4 distance bands and the 10 % hysteresis on every LOD switch. */
export const LOD = { near: 40, mid: 90, hysteresis: 0.1 } as const;

/** Shape builders (shapes.ts). */
export const SHAPE = {
  /** Faces subdivide to at most this many metres (vertex AO resolution), and at most maxSegments per axis. */
  segment: 4,
  maxSegments: 24,
  minGap: 1e-3,
  /** A chamfer never takes more than this share of the smallest dimension. */
  maxChamferShare: 0.3,
  riser: 0.2,
  stepChamfer: 0.02,
  columnChamfer: 0.04,
  wideColumn: 1.5,
  columnSides: 16,
  columnSidesWide: 24,
  /** Trunks (§6.1): buttress flare at the base, ridged girth, a little taper. */
  flare: 1.4,
  flareHeight: 1.6,
  /** Extra rings through the flare (fractions of its height), then rings every 2 segments from flareAbove × it. */
  flareRingLow: 0.25,
  flareRingMid: 0.6,
  flareAbove: 1.5,
  taper: 0.25,
  rootLobes: 5,
  rootDepth: 0.3,
  barkLobe: 0.03,
  barkLobes: 11,
  trunkSides: 16,
  /** Leaf clumps: an LCG for card placement, shell bias, y squash, how far cards lean up, size spread. */
  lcgMul: 1664525,
  lcgAdd: 1013904223,
  lcgRange: 4294967296,
  shellBias: 0.35,
  clumpSquash: 0.75,
  cardUp: 0.6,
  cardSizeRange: 0.5,
  /** Clumps are dark inside, up to +15 % on the sun side (§6.1). */
  innerShade: 0.5,
  sunLift: 0.15,
  coreShare: 0.6,
  /** Icosphere subdivisions of a clump's opaque core (0: 20 triangles; the cards carry the silhouette). */
  coreDetail: 0,
  tubeSides: 6,
} as const;

/** How the map layer turns prims into architecture (blockout.ts). Sizes in metres. */
export const ART = {
  deg: 0.017453292519943295,
  hashA: 12.9898,
  hashB: 43758.5453,
  epsilon: 1e-9,
  seedStride: 31,
  /** Within this of a team's spawn centroid is its Home Roost. */
  baseRadius: 46,
  /** §4.3: chamfer 4 % of the smallest dimension, 2–15 cm. */
  chamferShare: 0.04,
  chamferMin: 0.02,
  chamferMax: 0.15,
  trimChamfer: 0.025,
  hedgeChamfer: 0.2,
  /** Pieces longer than this skip ray AO (ground slabs, perimeter walls). */
  hugePiece: 70,
  groundEps: 0.05,
  contactLoop: 0.3,
  dampLoop: 0.8,
  topNormalY: 0.7,
  roofNormalY: 0.2,
  slabHeight: 0.8,
  slabFootprint: 3,
  thinWall: 1.2,
  mossAbove: 1,
  /** §5.1 trims on stone and brick masses at least this tall and this deep. */
  trimMinHeight: 3,
  trimMinFootprint: 0.4,
  storey: 4,
  minTrimGap: 0.5,
  plinth: { height: 0.8, out: 0.07 },
  string: { height: 0.28, out: 0.14 },
  cornice: { height: 0.4, out: 0.18 },
  corniceSeed: 97,
  postRatio: 2.5,
  boardHeight: 0.5,
  stairMin: 0.26,
  stairMax: 0.87,
  fringeSpacing: 0.6,
  fringeMax: 120,
  fringeSize: 0.35,
  hedgeLeafTint: 0xa6bf8c,
  /** Canopy clumps from a foliage cylinder. */
  canopyMinClumps: 2,
  canopyMaxClumps: 6,
  canopyAreaPerClump: 18,
  clumpOfRadius: 0.55,
  clumpOfHeight: 0.6,
  cardsPerM2: 3.2,
  canopyCard: 1.4,
  canopyTint: 0x8fae80,
  canopyTintAlt: 0x9fb784,
  canopyTintSalt: 3,
  coreTint: 0x5a6e4c,
  /** A bare trunk prim gets a crown: radius × this, height × crownHeight, centred crownLift radii above the top. */
  crownOfTrunk: 4.5,
  crownHeight: 0.9,
  crownLift: 0.15,
  /** §7.6 faded flock tints for base dressing (saturation ≤ 45 %, value ≤ 60 % after the albedo). */
  dawnFaded: 0xe8cfa6,
  duskFaded: 0xb6b4d8,
  /** Blue slate walls of the Dusk base from granite. */
  duskStoneTint: 0xa4b4e0,
} as const;

/** Lanes (§2.5, `IXU64ax4IAY t0030`): calm paving with a kerb band of setts each side. */
export const LANE_ART = {
  segment: 4,
  kerb: 0.6,
  lift: 0.03,
  kerbLift: 0.01,
  tint: 0xe8e2d8,
  kerbTint: 0xf4efe6,
  paving: { hedgerow: 'flagstone', riverbank: 'flagstone', pinewood: 'earth' },
} as const;

/** Updraft stations (§1.4): mast, crossarm, pulley wheel and feather pennant. */
export const STATION_ART = {
  cable: 0.05,
  mast: 0.22,
  above: 1.6,
  arm: 1.8,
  armSection: 0.16,
  armAt: 0.55,
  wheel: 0.42,
  wheelTube: 0.07,
  wheelSides: 6,
  wheelSegments: 16,
  wheelUp: 0.1,
  pennant: { w: 0.5, h: 1.4 },
  pennantTint: 0xf3e3c3,
} as const;

/** Vines (§1.4): rope-wrapped frame posts, thick wavy stems, leaves and cream blossom. */
export const VINE_ART = {
  width: 1.2,
  off: 0.12,
  post: 0.08,
  stems: 3,
  stemSpread: 0.7,
  step: 0.6,
  waveFreq: 1.7,
  wave: 0.12,
  stem: 0.05,
  stemTint: 0x9a8a6a,
  clump: 0.3,
  cardsPerClump: 3,
  leafCard: 0.55,
  leafTint: 0x7f9a6a,
  blossomChance: 0.45,
  blossom: 0.14,
  blossomCards: 2,
  blossomOut: 0.1,
  blossomTint: 0xfff4dc,
} as const;

/** Seed stalls at shops (§5.6). */
export const SHOP_ART = {
  width: 3,
  roostScale: 1.5,
  post: 0.1,
  height: 2.6,
  rise: 1.1,
  overhang: 1.15,
  ringWidth: 0.6,
  ringLift: 0.025,
  ringSides: 48,
  awningSides: 4,
} as const;

/** Updraft cables run 12 m above the lane (GDD §3.7). */
export const UPDRAFT_HEIGHT = 12;
/** Chimneys: 1.5 m warm-air shafts (GDD §3.8). */
export const CHIMNEY_RADIUS = 1.5;

/** The forest and floor beyond the map (never collides). */
export const BACKDROP = {
  floorSize: 6000,
  floorY: -0.3,
  floorTint: 0x9aa58c,
  refDepth: 300,
  minScale: 0.4,
  margin: 28,
  rings: 3,
  ringSpacing: 22,
  treeSpacing: 20,
  stride: 7,
  scatter: 0.4,
  trunkRadius: 3.6,
  trunkHeight: 34,
  scaleMin: 0.75,
  scaleMax: 1.2,
  /** Canopy clumps as [x, y, z, radius] around the trunk top. */
  clumps: [
    { x: 0, y: 33, z: 0, r: 10 },
    { x: 7, y: 29, z: 4, r: 7 },
    { x: -6, y: 30, z: -5, r: 7.5 },
    { x: 3, y: 37, z: -6, r: 6.5 },
    { x: -4, y: 27, z: 7, r: 6 },
  ],
  cardsPerClump: 34,
  cardOfClump: 0.55,
  canopySeed: 4242,
  leafTint: 0x86a477,
  shadeMin: 0.75,
  trunkSeed: 3,
  /** Hash salts for per-tree yaw and canopy shade. */
  yawSalt: 3,
  shadeSalt: 4,
  shimmerSides: 16,
  shimmerColour: 0xffc890,
  shimmerStrength: 0.22,
} as const;

/**
 * The local Updraft ride (G16): screen-space speed lines. Feel gap limits: lines at most 3 px wide, 25 % strength,
 * 15 % of the screen height long, never inside the central 50 % of the screen. Speeds are in box-edge lengths per
 * second; a line runs from the central box edge out to (1 + reach) × it, then respawns.
 */
export const RIDE = {
  /** m/s: riding is 11, boosting 18 (sim UPDRAFT); above this the line counts as boosted. */
  boostSpeed: 14.5,
  colour: 0xdfeeff,
  boostColour: 0xffe2b8,
  count: 22,
  max: 44,
  width: 3,
  length: 0.15,
  alpha: 0.25,
  speedMin: 0.6,
  speedMax: 1.4,
  reach: 1.2,
  lengthMin: 0.4,
  stretch: 0.5,
  boostSpeedUp: 1.2,
  fadeIn: 0.25,
  fadeOut: 0.4,
  maxDt: 0.1,
  flicker: 0.5,
  /** The central 50 %: a box of half the width and height, so its half-size is a quarter of each. */
  boxDiv: 4,
  eps: 1e-3,
  segments: 8,
  rgb: 3,
  seed: 4711,
  lcgMul: 1664525,
  lcgAdd: 1013904223,
  lcgRange: 4294967296,
} as const;

/** Friend-or-foe overlays and the bird rim (GDD §14.4, style guide §8.7). */
export const IDENTITY = {
  outlinePx: 2,
  /** X-ray silhouettes: this much flat fill under a fresnel rim. */
  xrayFill: 0.06,
  rim: 0.25,
  rimLow: 0.15,
  rimColour: 0xffe6c0,
  /** Draw order: x-rays after the world and before bodies, so only pixels walls hide pass the greater test. */
  xrayOrder: 1,
  bodyOrder: 2,
} as const;

/** Scoreboard portraits (D-EP-041): framing, light and size. */
export const PORTRAIT = {
  size: 128,
  samples: 4,
  rgba: 4,
  entityId: -100,
  settleFrames: 12,
  settleDt: 0.1,
  fovDeg: 24,
  near: 0.05,
  far: 50,
  halfTurnDeg: 180,
  /** Three-quarter view from the bird's right, a little above the eyes. */
  yawDeg: 28,
  rise: 0.12,
  /** Aim this many head radii below the head centre; frame this many head radii plus body radii. */
  aimDrop: 0.8,
  frameRadii: 2.2,
  frameBody: 0.35,
  sky: 0xc8d4ea,
  ground: 0x5a5040,
  hemi: 1.6,
  ambientColour: 0xffffff,
  ambient: 0.35,
  key: 0xffe2b8,
  keyIntensity: 3.2,
  keyDir: { x: 1.5, y: 2, z: 2.5 },
  rim: 0xffe6c0,
  rimIntensity: 2.6,
  rimDir: { x: -2, y: 1.5, z: -2.5 },
} as const;

/** Allied invisible heroes (ghosts) draw at this opacity; the local hero fades out as the camera comes within LOCAL_FADE_M of its head. */
export const GHOST_OPACITY = 0.35;
export const LOCAL_FADE_M = 1;
/** Height of the local hero's head above its feet for the fade distance. */
export const LOCAL_HEAD_M = 1.6;
