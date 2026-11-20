/**
 * Ability framework numbers. Owner: Ability Systems (Balance & Data from W7). Hero kits live in data/heroes/<id>.ts.
 * Units: seconds, metres, degrees where the name says Deg.
 */

/** Degrees to radians, for the `Deg` numbers in ability data. */
export const RAD_PER_DEG = Math.PI / 180;

/** AP cost of upgrade tiers 1, 2 and 3, bought in order (GDD §8.5). */
export const AP_COSTS = [1, 2, 5] as const;

/** Hero level at which each slot unlocks: abilities 1–3 at level 1, the ultimate at 6 (GDD §8.5, D-DIR-003). */
export const UNLOCK_LEVELS = [1, 1, 1, 6] as const;

/** Lockout between two uses of the same ability when it has more than one charge (GDD §9.0.1). */
export const CHARGE_LOCKOUT_S = 0.4;

/** Cooldown reduction cap (D-DIR-005). */
export const COOLDOWN_REDUCTION_CAP = 0.5;

/** 'unit' targeting: the target must lie within this angle of the crosshair (GDD §9.0.1). */
export const UNIT_TARGET_CONE_DEG = 6;

/** Ground probes for summons (and sim/items' point targeting) start this far above the point. */
export const GROUND_PROBE_UP = 2;

/**
 * 'point' targeting (GDD §6.11): the aim point is pulled back this far toward the camera along the crosshair ray, then
 * dropped to the floor under it, so placement never goes through a wall or ceiling.
 */
export const POINT_PULL_BACK = 0.05;

/**
 * An AbilityDef.values name the framework reads (D-SYS-012): a 'point' cast whose values hold `surface` ≥ 1 lands on
 * the surface under the crosshair (wall, tree or floor) within range, not on the floor below it; a 'target' dash from
 * such a cast flies straight to that point. Beyond range it falls back to the ordinary floor point.
 */
export const SURFACE_VALUE = 'surface';

/** GDD §6.11: a cylinder area with no height of its own (≤ 0) is this tall, so a ground area stays on its storey. */
export const CYLINDER_DEFAULT_HEIGHT = 3;

/**
 * GDD §6.11: an entity whose feet are more than this far above or below an area's centre is inside it only with a
 * clear line from the centre (both ends lifted AREA_FLOOR_LIFT), so an area never reaches through a floor.
 */
export const AREA_STOREY_DY = 1.5;
export const AREA_FLOOR_LIFT = 0.5;

/**
 * GDD §6.8: an ivy curtain (a 'sight' prim) blocks `unit` targeting both ways, except for a caster or target within
 * this distance of it.
 */
export const CURTAIN_SEE_THROUGH_M = 3;

/** Areas with onCross watch this much beyond their edge, so a fast mover (a dash) can't skip the line. */
export const CROSS_MARGIN = 1;

/** Cones have no height in data: they reach this far above and below their apex. */
export const CONE_HALF_HEIGHT = 3;

/** Summons (GDD §9.25). */
export const SUMMON = {
  /** Body radius and hitbox height of traps, turrets and decoys (walls use their size). */
  radius: 0.4,
  height: 1,
  /** Turrets and decoys attack this often. */
  attackS: 0.5,
  /** Turrets and decoys without a `trigger` attack enemies within this range. */
  attackRange: 25,
  /** Traps without a `trigger` fire on enemy heroes within this range. */
  trapRadius: 1.5,
} as const;
