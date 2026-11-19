/**
 * Primitive types shared by every contract.
 *
 * World frame: right-handed, +Y up, metres. Dawn's base is at −Z, Dusk's at +Z, the mirror plane is z = 0.
 * Yaw rotates about +Y; yaw 0 faces +Z and yaw increases counter-clockwise seen from above, so
 * forward = (sin yaw, 0, cos yaw) and right = (−cos yaw, 0, sin yaw). Pitch is positive looking up.
 */

/** A point or direction. Plain records; the sim never shares a Vec3 between two owners (copy, don't alias). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** An offset in an entity's own frame (forward follows its yaw). Avoids sign mistakes with raw local axes. */
export interface LocalOffset {
  readonly right: number;
  readonly up: number;
  readonly forward: number;
}

/** Stable entity id. Assigned from 1 upward in spawn order and never reused within a match. */
export type EntityId = number;

/** Simulation tick (60 per second, see TICK_RATE). Tick 0 is the state createSim returns. */
export type Tick = number;

/** The two playable teams. */
export type PlayerTeam = 'dawn' | 'dusk';
/** Every entity has a team; neutral covers Thickets, Nests, the Roc and free pickups. */
export type Team = PlayerTeam | 'neutral';
/** Iteration order for anything per team. Dawn first, always. */
export const PLAYER_TEAMS: readonly PlayerTeam[] = ['dawn', 'dusk'];

/**
 * The 24 fixed hero ids (D-EP-011, D-EP-015). Ids are folder names and registry keys; display names live in hero
 * data. Hero Engineer A owns the first twelve, Hero Engineer B the last twelve.
 */
export const HERO_IDS = [
  'shrike', 'albatross', 'kingfisher', 'lyrebird',
  'hornbill', 'flamingo', 'penguin', 'puffin',
  'peacock', 'vulture', 'swift', 'hummingbird',
  'owl', 'pelican', 'secretarybird', 'starling',
  'cassowary', 'toucan', 'woodpecker', 'nightjar',
  'frigatebird', 'cockatoo', 'swan', 'kiwi',
] as const;
export type HeroId = (typeof HERO_IDS)[number];

/** Who drives a hero: the local player or a bot at a difficulty. */
export type BotDifficulty = 'easy' | 'normal' | 'hard';
export type Controller = 'human' | 'dummy' | BotDifficulty;

/** The three lanes, west to east. */
export type LaneId = 'hedgerow' | 'riverbank' | 'pinewood';
export const LANE_IDS: readonly LaneId[] = ['hedgerow', 'riverbank', 'pinewood'];

/** Data ids. Plain strings, validated by each owner's data tests (e.g. every ability's effect refers to real values). */
export type AbilityId = string;
export type ItemId = string;
export type StatusId = string;
