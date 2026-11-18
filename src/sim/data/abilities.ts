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

/** 'point' targeting probes for the ground from this far above the aim point. */
export const GROUND_PROBE_UP = 2;

/**
 * Default tick interval of lasting areas and tethers (GDD §5.12). Mirrors combat's DoT tick (0.5 s); kept here
 * because this branch can't import combat's data.
 */
export const AREA_TICK_S = 0.5;

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
