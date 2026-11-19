/**
 * World tuning: fledgling waves, marching, fighting (GDD §7.1) and the vision rule (GDD §11.1, §5.9).
 * Owner: Objectives (Balance & Data from W7). Units: metres, seconds; fractions where 0.015 means 1.5%.
 */
import type { StructureType } from '../core/contracts';

const DEG = Math.PI / 180;

export type FledglingType = 'scrapper' | 'slinger';

export interface FledglingDef {
  readonly hp: number;
  /** Talon damage per hit at 0:00. */
  readonly damage: number;
  readonly intervalS: number;
  /** Attack reach (m), measured from the attacker's centre to the target's surface. */
  readonly range: number;
  /** Projectile speed (m/s); 0 for a melee hit. */
  readonly projectileSpeed: number;
  /** Model height and radius (GDD §7.1 model sizes). */
  readonly height: number;
  readonly radius: number;
}

/** GDD §7.1 table. */
export const FLEDGLINGS: Readonly<Record<FledglingType, FledglingDef>> = {
  scrapper: { hp: 260, damage: 20, intervalS: 1.0, range: 2.5, projectileSpeed: 0, height: 0.9, radius: 0.45 },
  slinger: { hp: 200, damage: 14, intervalS: 1.2, range: 18, projectileSpeed: 30, height: 0.8, radius: 0.4 },
};

/** GDD §7.1 waves. */
export const WAVES = {
  firstS: 30,
  everyS: 30,
  /** Composition per lane per flock from these match times. */
  bands: [
    { fromS: 0, scrapper: 3, slinger: 1 },
    { fromS: 10 * 60, scrapper: 3, slinger: 2 },
    { fromS: 20 * 60, scrapper: 4, slinger: 2 },
  ],
  /** A column two wide; files and rows this far apart. */
  files: 2,
  gap: 1.5,
  /** HP and damage grow by this per minute of match time, fixed at spawn. */
  scalingPerMinute: 0.015,
  /** Damage against structures. */
  vsStructures: 1.5,
} as const;

/** GDD §7.1 marching and targeting. */
export const FLEDGLING_AI = {
  marchSpeed: 5.0,
  /** Sideways speed while changing file or stepping round a structure (assumed). */
  lateralSpeed: 2.5,
  /** A step may run this much faster than the march speed while the column turns a corner or sidesteps. */
  catchUp: 1.2,
  /** Sidestepping starts this far before a structure's footprint (assumed). */
  avoidLead: 6,
  /** Room kept between a fledgling and a structure's footprint (assumed). */
  avoidMargin: 0.3,
  /** Returning to the path, a fledgling heads for the point this far ahead on it. */
  returnLookahead: 3,
  /** Holding at the enemy base: this far short of the last structure's footprint (assumed). */
  holdStandoff: 1,
  /**
   * Scrappers on one target stand this far from its surface on its gate side, at an arc slot (centre, then alternate
   * sides) picked by id, slots meleeArc apart, so they don't stack (assumed).
   */
  meleeStandoff: 2,
  meleeArc: 35 * DEG,
  meleeSlots: [0, 1, -1, 2, -2],
  retargetS: 0.5,
  /** Rule 1: nearest enemy fledgling within. */
  fledglingAggro: 14,
  /** Rule 2: an enemy hero within this who damaged an allied hero in the last hurtWindowS. */
  hurtAggro: 14,
  hurtWindowS: 2,
  /** Rule 4: nearest enemy hero within. */
  heroAggro: 10,
  /** A target further than this is dropped. */
  leash: 18,
  /** A fledgling further than this from its lane path drops its target and walks back. */
  pathLeash: 18,
  /** Slinger shots fly this much past the attack range before expiring, and this wide. */
  shotRangePad: 4,
  shotRadius: 0.1,
  /** Launch height of a slinger shot as a fraction of the slinger's height. */
  shotHeight: 0.6,
} as const;

/**
 * Structure footprint radii (the anchors' placeholder bodies; StructureInfo.body.radius from W4). Fledglings step
 * round them (Level Designer: Hawks, Herons and Wardens stand on the lane path).
 */
export const STRUCTURE_RADIUS: Readonly<Record<Exclude<StructureType, 'nest'>, number>> = {
  hawk: 2,
  heron: 2.5,
  warden: 1.5,
  shrine: 2,
  patron: 8,
};

/** GDD §11.1 vision rule and the §5.9 visibility statuses. */
export const VISION = {
  hero: 40,
  fledgling: 20,
  structure: 30,
  /** Invisible enemies are seen within this of an eye. */
  invisible: 8,
  /**
   * True sight radius. The GDD gives it per ability (Night Eyes 30 m, Night Sense 20–30 m) but the status carries no
   * radius yet: TODO(interface request) a radius on the true-sight status.
   */
  trueSight: 30,
  /** Non-hero entities are re-evaluated every this many ticks (heroes every tick); ARCHITECTURE §11 allows 0.25 s. */
  staggerTicks: 6,
} as const;
