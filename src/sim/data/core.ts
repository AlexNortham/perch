/**
 * Sim-wide constants. Owner: Technical Architect (Balance & Data from W7).
 * Units: metres, seconds and radians unless the name says otherwise. Gameplay numbers that belong to one system
 * live in that system's own data file (movement.ts, combat.ts, abilities.ts, economy.ts, items.ts, world.ts, ai.ts).
 */

/** Menu Practice Hub target placement, wound fraction and spendable practice points. */
export const TRAINING_TARGET = { ahead: 9, side: 3, alliedHpFraction: 0.4, practiceAp: 32 } as const;
export const DEFAULT_AIM_ZOOM = 0.8;
export const OWL_AIM_ZOOM = 0.5;
/** Fixed simulation rate. */
export const TICK_RATE = 60;
/** Length of one tick in seconds. */
export const TICK_SECONDS = 1 / TICK_RATE;

/** Heroes per team in a full match. */
export const TEAM_SIZE = 6;

/** Cell edge of the XZ spatial hash. About two fledgling aggro radii; queries touch few cells. */
export const SPATIAL_CELL_SIZE = 8;

/** Seed curves in telemetry are sampled this often. */
export const TELEMETRY_SAMPLE_SECONDS = 10;

/**
 * The shared effect tick (GDD §5.12): DoTs, lasting areas and tethers apply every this many seconds unless their
 * data says otherwise. sim/combat and sim/abilities both read it.
 */
export const EFFECT_TICK_SECONDS = 0.5;

/** Guard against event loops: more events than this in one tick throws. */
export const MAX_EVENTS_PER_TICK = 50_000;

/** Crouching and sliding scale the body capsule height and head height by this (GDD §3.2, §9.0.1). */
export const CROUCH_SCALE = 0.65;

const DEG = Math.PI / 180;

/**
 * Third-person camera rig (GDD §4.1, §4.5), shared by the sim's aim ray and the client camera so the crosshair is
 * honest. See src/sim/core/aim.ts.
 */
export const CAMERA = {
  /** The pivot sits this far below the head hitbox centre. */
  pivotBelowHead: 0.05,
  /** Boom length behind the pivot for a hero of `referenceHeight`; scaled by height, clamped to boomMin..boomMax. */
  boom: 3.2,
  referenceHeight: 1.8,
  boomMin: 2.6,
  boomMax: 4.0,
  /** Shoulder offset applied at the pivot: right (left after a swap) and up. */
  shoulderRight: 0.75,
  shoulderUp: 0.15,
  /** Look pitch limits (positive looks up). */
  pitchMin: -80 * DEG,
  pitchMax: 80 * DEG,
  /** Aim hits closer to the camera than camera-to-pivot distance plus this are ignored. */
  aimStartPad: 0.3,
  /** Aim ray length from the camera; WeaponDef.aimRange overrides it per hero (Owl). */
  aimRange: 300,
} as const;

/** Pings: at most PING_LIMIT per hero in any PING_WINDOW_SECONDS (GDD §12.5). */
export const PING_LIMIT = 3;
export const PING_WINDOW_SECONDS = 4;

/** The human may concede from this match time (GDD §15.1). */
export const CONCEDE_AFTER_SECONDS = 15 * 60;
