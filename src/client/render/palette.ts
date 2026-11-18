/**
 * PERCH colours (GDD §14.2, §14.3, §14.5) as 0xRRGGBB sRGB. Owner: Rendering & VFX. Anyone in src/client may import
 * these: team colours for models, UI and VFX; environment colours for anything drawn in the world.
 */
import type { LaneId, MaterialTag, PlayerTeam } from '../../sim/core/contracts';

export interface TeamColours {
  readonly primary: number;
  readonly light: number;
  readonly dark: number;
}

/** Dawn Flock: amber. */
export const DAWN_COLOURS: TeamColours = { primary: 0xf5a623, light: 0xffd27a, dark: 0xa86a0c };
/** Dusk Flock: violet-blue. */
export const DUSK_COLOURS: TeamColours = { primary: 0x6b6bff, light: 0xb0b0ff, dark: 0x3a3aa8 };
export const TEAM_COLOURS: Readonly<Record<PlayerTeam, TeamColours>> = { dawn: DAWN_COLOURS, dusk: DUSK_COLOURS };
/** Neutral units and structures (Thickets, the Roc). */
export const NEUTRAL_COLOUR = 0x9a9a8a;

/** Friend-or-foe outlines and tints (GDD §14.4), independent of flock colour. */
export const ENEMY_RED = 0xff4a4a;
export const ALLY_TEAL = 0x3ddcb4;

/** Blockout colour per map material tag. Lane-side colours stay below 50% saturation (GDD §14.2 rule). */
export const MATERIAL_COLOURS: Readonly<Record<MaterialTag, number>> = {
  ground: 0xb9a98a,
  grass: 0x5f7f4a,
  road: 0x9c8b6e,
  stone: 0xb9a98a,
  brick: 0xa4573f,
  wood: 0x7a5236,
  roof: 0x6b7680,
  metal: 0x6b7680,
  water: 0x3f8c8a,
  foliage: 0x3e6b3a,
  trunk: 0x4e3424,
  dawn: DAWN_COLOURS.primary,
  dusk: DUSK_COLOURS.primary,
};

/** Lane accents (GDD §14.2), used to tint each lane's ribbon. */
export const LANE_COLOURS: Readonly<Record<LaneId, number>> = {
  hedgerow: 0xa4573f,
  riverbank: 0xe8e2d2,
  pinewood: 0x8a4b32,
};

export const ENV_COLOURS = {
  /** Forest floor beyond the map. */
  moss: 0x5f7f4a,
  pine: 0x2e4f3a,
  canopy: 0x3e6b3a,
  hedge: 0x4f7d3b,
  timber: 0x7a5236,
  timberDark: 0x4e3424,
  /** Updraft cables and station posts. */
  rope: 0xc9ae7c,
  /** Chimney warm-air shafts. */
  warmAir: 0xffd9a0,
  foam: 0xcde7e0,
} as const;

/** Sky gradient (GDD §14.2): Dawn's side (south, −z) is peach, Dusk's side (north, +z) violet. */
export const SKY_COLOURS = {
  southHorizon: 0xf6c9a0,
  southZenith: 0x9cc3d9,
  northHorizon: 0x8c86c9,
  northZenith: 0x5e6fa8,
} as const;

/** Lighting and fog (GDD §14.5). */
export const LIGHT_COLOURS = {
  sun: 0xffe3b5,
  hemiSky: 0x9cb8d9,
  hemiGround: 0x5f6e4a,
  fog: 0xb8c9be,
} as const;
