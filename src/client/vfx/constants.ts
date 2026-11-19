/** VFX presentation constants (D-EP-009). Colours are 0xRRGGBB sRGB; sizes in metres, times in seconds. */
import { ALLY_TEAL, ENEMY_RED } from '../app/palette';

export type Shape = 'box' | 'sphere' | 'cylinder' | 'cone' | 'ring';

/** Instance capacity per shape: a full instanced mesh drops new effects instead of growing. */
export const CAPACITY: Readonly<Record<Shape, number>> = { box: 1024, sphere: 1024, cylinder: 128, cone: 64, ring: 256 };
/** Transient effect records (tracers, sparks, puffs, rings); the oldest is overwritten when all are live. */
export const TRANSIENT_CAPACITY = 1024;
export const HIT_FLASH_CAPACITY = 16;
export const MAX_TETHERS = 16;

/** Weapons (GDD §14.4, §14.7): talon tracers are white-gold; enemy shots carry a red tint. */
export const TRACER = {
  ally: 0xfff0b8,
  enemy: 0xff8a7a,
  width: 0.07,
  life: 0.09,
  /** Length of a hitscan shot that hit nothing. */
  missLength: 60,
  /** Fledglings and structures: wider, in the team's light colour. */
  unitWidth: 0.09,
  structureWidth: 0.22,
} as const;
/** A unit or structure shot from further than this is drawn as a tracer, nearer as a melee swipe. */
export const RANGED_DISTANCE = 5;
export const RANGED_TYPES: readonly string[] = ['slinger', 'turret'];
/** Where on a unit a shot or swipe starts, above its feet. */
export const CHEST = { hero: 1.2, unit: 0.8, structure: 3 } as const;
export const HEAD = { hero: 2.2, unit: 1.4 } as const;

export const PROJECTILE = {
  /** Visual size multiplier on the sim radius, and a floor so bullets stay visible at range. */
  scale: 1.4,
  minRadius: 0.1,
  /** Radius from which a projectile also gets a soft glow shell (ability projectiles). */
  glowFrom: 0.3,
  glowScale: 1.5,
  trailPerSpeed: 0.035,
  trailMax: 4,
  coreAlly: 0xffffff,
  coreEnemy: 0xffb0a0,
} as const;

export const HIT_FLASH = { life: 0.1, colour: 0xffffff, scale: 1.6, minRadius: 0.5, lift: 0.9 } as const;

/** Seed pods (GDD §8.2): rise 0.6 s, ripe 1.4 s, then wither. */
export const POD = {
  riseS: 0.6,
  ripeS: 1.4,
  witherS: 0.4,
  radius: 0.24,
  halo: 2.1,
  pulseHz: 2.2,
  pulseDepth: 0.18,
  /** Gold for the side that can secure it, grey-blue for the side that can deny it. */
  secure: 0xffc83a,
  deny: 0x7a8cd8,
  risingDim: 0.5,
} as const;

/** Areas: the sim view gives a radius and a shape only (interface request), so sizes derive from the radius. */
export const AREA = {
  fill: 0.16,
  rim: 0.9,
  rimAllyDim: 0.7,
  cylinderHeight: 3,
  coneHalfAngleDeg: 30,
  boxWidthPerRadius: 0.7,
  boxLengthPerRadius: 1.7,
  boxHeight: 3,
  ringLift: 0.12,
  pulseHz: 1.2,
  pulseDepth: 0.2,
} as const;

/** Summon placeholders (until the Technical Artist models them). */
export const SUMMON = {
  trap: { radiusScale: 1.4, height: 0.25, colourDim: 0.6 },
  turret: { height: 1.4, radiusScale: 0.9 },
  wall: { width: 4, height: 3, depth: 0.5 },
  fill: 0.35,
} as const;

export const TETHER = { width: 0.09, pulseHz: 6, pulseDepth: 0.4, ally: ALLY_TEAL, enemy: ENEMY_RED } as const;

/** Status markers, from ViewFlag.Stunned/Silenced and the hero's StatusView ids. */
export const MARKER = {
  stun: 0xffe14a,
  silence: 0xb070ff,
  disarm: 0xff9a3a,
  root: 0x66d06a,
  slow: 0x5ad2ff,
  grounded: 0xb08a5a,
  orbitRadius: 0.45,
  orbitHz: 1.6,
  dot: 0.1,
  ringScale: 1.8,
  ringLift: 0.08,
} as const;
/** Hero status ids (src/sim/data/combat.ts) that get a marker. */
export const STATUS_MARKERS: Readonly<Record<string, keyof typeof MARKER_BITS>> = {
  stun: 'stun',
  silence: 'silence',
  disarm: 'disarm',
  root: 'root',
  slow: 'slow',
  grounded: 'grounded',
};
export const MARKER_BITS = { stun: 1, silence: 2, disarm: 4, root: 8, slow: 16, grounded: 32 } as const;

/** Movement: slide sparks and Updraft wind are spawned every so often while the flag is up. */
export const SLIDE_SPARK_EVERY = 0.04;
export const WIND_EVERY = 0.05;
export const WIND_RADIUS = 1.2;

export const SELF_TEST = {
  /** Effects age at this fraction of real time in the self-test so a screenshot catches them alive. */
  timeScale: 0.04,
  /** Seconds between repeats of the synthetic events. */
  repeatS: 2,
  fakeBase: 900000,
} as const;

/**
 * One burst is a few parts. `tint` parts take the caller's colour (team colour for casts). A part spawns `count`
 * records: spheres and boxes fly along a direction blended between the burst axis and a random one (`spread` 0..1),
 * rings expand about the axis. Boxes are streaks of length `len` along that direction.
 */
export interface Part {
  readonly shape: 'box' | 'sphere' | 'ring';
  readonly count: number;
  readonly speed: number;
  readonly spread: number;
  readonly s0: number;
  readonly s1: number;
  readonly len?: number;
  readonly life: number;
  readonly colour: number;
  readonly tint?: boolean;
  readonly gravity?: number;
  readonly scatter?: number;
}

export const BURSTS = {
  muzzle: [
    { shape: 'sphere', count: 1, speed: 0, spread: 0, s0: 0.3, s1: 0.05, life: 0.06, colour: 0xfff1c0 },
    { shape: 'box', count: 3, speed: 5, spread: 0.3, s0: 0.05, s1: 0.01, len: 0.5, life: 0.07, colour: 0xffe08a },
  ],
  impactWorld: [
    { shape: 'sphere', count: 5, speed: 5, spread: 0.6, s0: 0.07, s1: 0.01, life: 0.22, colour: 0xffe9b0, gravity: 12 },
    { shape: 'sphere', count: 2, speed: 1.2, spread: 0.5, s0: 0.3, s1: 0.65, life: 0.3, colour: 0x6e6a58 },
  ],
  impactBody: [
    { shape: 'sphere', count: 6, speed: 4, spread: 0.8, s0: 0.09, s1: 0.01, life: 0.25, colour: 0xfff2e0, gravity: 8 },
    { shape: 'sphere', count: 4, speed: 1.5, spread: 1, s0: 0.12, s1: 0.32, life: 0.5, colour: 0xa09680, gravity: 1.5 },
  ],
  impactStructure: [
    { shape: 'box', count: 5, speed: 6, spread: 0.9, s0: 0.08, s1: 0.04, len: 0.2, life: 0.4, colour: 0xc8b890, gravity: 14 },
    { shape: 'sphere', count: 2, speed: 1, spread: 0.6, s0: 0.35, s1: 0.8, life: 0.4, colour: 0x6e6a58 },
  ],
  /** The beak-shot flash (GDD §14.4): a small gold spark on the head, bigger and goldener than any body hit. */
  beakFlash: [
    { shape: 'sphere', count: 1, speed: 0, spread: 0, s0: 0.7, s1: 0.1, life: 0.14, colour: 0xffd23a },
    { shape: 'ring', count: 1, speed: 0, spread: 0, s0: 0.2, s1: 1.4, life: 0.2, colour: 0xffc21f },
    { shape: 'box', count: 6, speed: 8, spread: 1, s0: 0.06, s1: 0.01, len: 0.5, life: 0.18, colour: 0xffe27a },
  ],
  podSecured: [
    { shape: 'sphere', count: 1, speed: 0, spread: 0, s0: 0.5, s1: 1.8, life: 0.25, colour: 0xffd75a },
    { shape: 'ring', count: 1, speed: 0, spread: 0, s0: 0.3, s1: 2.6, life: 0.35, colour: 0xffe9a0 },
    { shape: 'sphere', count: 10, speed: 4, spread: 1, s0: 0.12, s1: 0.02, life: 0.6, colour: 0xffd23a, gravity: -3 },
  ],
  podDenied: [
    { shape: 'sphere', count: 6, speed: 2, spread: 1, s0: 0.3, s1: 0.7, life: 0.5, colour: 0x6a7488 },
    { shape: 'ring', count: 1, speed: 0, spread: 0, s0: 1.4, s1: 0.2, life: 0.22, colour: 0x7d8aa5 },
  ],
  dust: [
    { shape: 'ring', count: 1, speed: 0, spread: 0, s0: 0.3, s1: 2.2, life: 0.35, colour: 0x8a826c },
    { shape: 'sphere', count: 6, speed: 2.5, spread: 1, s0: 0.25, s1: 0.6, life: 0.4, colour: 0x7a7260 },
  ],
  jump: [
    { shape: 'ring', count: 1, speed: 0, spread: 0, s0: 0.2, s1: 1.1, life: 0.25, colour: 0x8a826c },
    { shape: 'sphere', count: 3, speed: 1.5, spread: 1, s0: 0.15, s1: 0.4, life: 0.3, colour: 0x7a7260 },
  ],
  teleport: [
    { shape: 'sphere', count: 1, speed: 0, spread: 0, s0: 1.2, s1: 0.1, life: 0.2, colour: 0xd8c8ff },
    { shape: 'ring', count: 1, speed: 0, spread: 0, s0: 0.3, s1: 2, life: 0.3, colour: 0xb89aff },
  ],
  death: [{ shape: 'sphere', count: 8, speed: 3, spread: 1, s0: 0.3, s1: 0.8, life: 0.6, colour: 0xa8a090, gravity: 1 }],
  castFlash: [
    { shape: 'sphere', count: 1, speed: 0, spread: 0, s0: 0.8, s1: 0.1, life: 0.15, colour: 0xffffff, tint: true },
    { shape: 'ring', count: 1, speed: 0, spread: 0, s0: 0.2, s1: 1.6, life: 0.25, colour: 0xffffff, tint: true },
  ],
  abilityLand: [
    { shape: 'ring', count: 1, speed: 0, spread: 0, s0: 0.5, s1: 4, life: 0.35, colour: 0xffffff, tint: true },
    { shape: 'sphere', count: 1, speed: 0, spread: 0, s0: 1, s1: 0.2, life: 0.2, colour: 0xffffff, tint: true },
  ],
  swipe: [
    { shape: 'box', count: 3, speed: 0, spread: 0.45, s0: 0.1, s1: 0.02, len: 1.4, life: 0.12, colour: 0xffffff, tint: true, scatter: 0.35 },
  ],
  swipeHeavy: [
    { shape: 'box', count: 5, speed: 0, spread: 0.5, s0: 0.16, s1: 0.03, len: 2.2, life: 0.18, colour: 0xffffff, tint: true, scatter: 0.5 },
    { shape: 'ring', count: 1, speed: 0, spread: 0, s0: 0.3, s1: 1.8, life: 0.2, colour: 0xffe9a0 },
  ],
  parry: [
    { shape: 'ring', count: 1, speed: 0, spread: 0, s0: 0.2, s1: 1.8, life: 0.25, colour: 0xbfeaff },
    { shape: 'box', count: 5, speed: 7, spread: 1, s0: 0.05, s1: 0.01, len: 0.4, life: 0.2, colour: 0xe8f8ff },
  ],
  /** Axis = the direction of travel; the streak trails behind. */
  dash: [
    { shape: 'box', count: 6, speed: 0, spread: 0.1, s0: 0.09, s1: 0.02, len: 2.6, life: 0.24, colour: 0xdff6ff, scatter: 0.55 },
    { shape: 'sphere', count: 1, speed: 0, spread: 0, s0: 0.6, s1: 0.1, life: 0.12, colour: 0xbfe6ff },
  ],
  slideSpark: [{ shape: 'sphere', count: 2, speed: 3, spread: 0.7, s0: 0.07, s1: 0.01, life: 0.18, colour: 0xffd27a, gravity: 10 }],
  /** Axis = up: rising streaks. */
  wind: [{ shape: 'box', count: 2, speed: 7, spread: 0, s0: 0.05, s1: 0.02, len: 1.8, life: 0.5, colour: 0xdfeeff, scatter: WIND_RADIUS }],
  updraftBoost: [
    { shape: 'ring', count: 1, speed: 0, spread: 0, s0: 0.3, s1: 2.4, life: 0.3, colour: 0xdfeeff },
    { shape: 'box', count: 8, speed: 9, spread: 0.1, s0: 0.06, s1: 0.02, len: 2, life: 0.4, colour: 0xdfeeff, scatter: 1 },
  ],
  wallSlam: [
    { shape: 'sphere', count: 6, speed: 4, spread: 1, s0: 0.3, s1: 0.8, life: 0.4, colour: 0x8a826c },
    { shape: 'ring', count: 1, speed: 0, spread: 0, s0: 0.3, s1: 2.5, life: 0.25, colour: 0xffe9a0 },
  ],
} as const satisfies Record<string, readonly Part[]>;
export type BurstKind = keyof typeof BURSTS;
