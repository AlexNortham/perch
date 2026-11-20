/**
 * Physics service. Implemented by src/sim/physics with Rapier (async init, hence async createSim). Core and every
 * other system use only this interface and never import Rapier.
 *
 * What has a collider: the map's solid prims (Layer.World), structures (Layer.Structure, static) and hero movement
 * capsules (Layer.Hero). Units may or may not have colliders (physics decides; fledglings are cheap to move without).
 * Head and body hitboxes are not physics colliders: sim/combat tests them analytically from each hero's BodyPlan,
 * using ctx.spatial for the broad phase and physics only for world occlusion.
 */
import type { EntityId, Vec3 } from './base';
import type { System } from './sim';

/**
 * Collision layer bits. Queries take a mask of layers to hit. LAYERS_SOLID alone (bullets, areas) hits none of the
 * last three, so a query that should honour them adds the bit (D-SYS-010, D-ARCH-027).
 */
export const Layer = {
  World: 0x1,
  Structure: 0x2,
  Hero: 0x4,
  Unit: 0x8,
  /** Prims with `blocks: 'sight'` (ivy curtains): vision and `unit` targeting add it to their mask. */
  Sight: 0x10,
  /** Prims with `blocks: 'movement'` (shot-window fillers): heroes and units collide with them. */
  Movement: 0x20,
  /** `Opening.blocksEggCarrier` gaps: only the Egg carrier's moves collide with them. */
  EggCarrier: 0x40,
} as const;
/** Everything that blocks bullets and sight. */
export const LAYERS_SOLID = Layer.World | Layer.Structure;

export interface RayHit {
  /** Distance along the ray (or sweep) to the hit. */
  readonly distance: number;
  readonly point: Vec3;
  readonly normal: Vec3;
  /** The entity owning the collider hit, or null for map geometry. */
  readonly entity: EntityId | null;
}

export type Shape =
  | { readonly kind: 'sphere'; readonly radius: number }
  /** Vertical capsule centred on the query position. */
  | { readonly kind: 'capsule'; readonly radius: number; readonly halfHeight: number }
  /** Box turned by yaw. */
  | { readonly kind: 'box'; readonly halfExtents: Vec3; readonly yaw: number };

export interface CharacterMove {
  /** Where the character ended up (feet). */
  readonly pos: Vec3;
  grounded: boolean;
  /** Normal of the steepest surface hit this move, or null. Mantling and wall checks use it. */
  wall: Vec3 | null;
}

/** `ctx.physics`. */
export interface PhysicsService {
  /** First hit along a ray (dir is a unit vector), or null. `ignore` skips that entity's collider. */
  raycast(origin: Vec3, dir: Vec3, maxDistance: number, mask: number, ignore?: EntityId): RayHit | null;
  /** First hit of a shape swept along a ray, or null. */
  shapeCast(shape: Shape, origin: Vec3, dir: Vec3, maxDistance: number, mask: number, ignore?: EntityId): RayHit | null;
  /** Entities whose colliders overlap the shape at `centre`, ascending by id, written into `out` (cleared first). */
  overlap(shape: Shape, centre: Vec3, mask: number, out: EntityId[]): EntityId[];
  /**
   * Move a hero (or any entity physics gave a character controller) by `delta` with collide-and-slide, step-up and
   * slope limits. When supplied, fill and return caller-owned out, reusing its position. The caller writes the entity.
   */
  moveCharacter(entity: EntityId, delta: Vec3, out?: CharacterMove): CharacterMove;
  /** Height of the walkable surface under (x, z) at or below `fromY`, or null if there is none. */
  groundHeight(x: number, z: number, fromY: number): number | null;
  /**
   * Stage 4 (D-EP-039, GDD §3.7): the nearest Updraft cable point within mounting reach of a hero standing at `pos`
   * (anywhere along the cable, reach from movement data), or null. `t` is the arc length along the cable from its
   * first point. Physics uses it to mount on held Jump; sim/ai to plan mounts. Required since W5.5 (D-ARCH-027).
   */
  updraftInReach(pos: Vec3): { readonly updraft: number; readonly point: Vec3; readonly t: number } | null;
}

/** What src/sim/physics's `createPhysics` resolves to. */
export interface Physics {
  readonly service: PhysicsService;
  /** Runs in the 'movement' phase: hero movement from commands, displacements (of units too), updrafts, climbs. No per-tick Rapier step (D-CTRL-001). */
  readonly system: System;
}
