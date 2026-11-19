/**
 * Economy tuning (GDD §8). Owner: Economy & Items (Balance & Data from W7).
 * Units: metres, seconds; fractions where 0.5 means 50%.
 */
export const ECONOMY = {
  /** GDD §8.1: Seeds a hero starts with (SimOptions.startSeeds overrides it). */
  startSeeds: 0,
  /** GDD §8.4: passive income, Seeds per second per hero from `passiveFromS` (assumed in the GDD). */
  passivePerSecond: 1,
  passiveFromS: 30,
  secondsPerMinute: 60,
  levels: { max: 30, baseCost: 400, costGrowth: 50, doubleApEvery: 10, ultimate: 6 },
  bounty: {
    base: 120, worthFraction: 0.03, freeKills: 2, perStreakKill: 60, streakCap: 360,
    comebackRate: 2, comebackCap: 0.5, shareRange: 40,
  },
  objective: { hawk: 300, heron: 600, warden: 250, shrine: 500 },
  flexAwards: { hawk: 2, heron: 1, warden: 0, shrine: 1 },
  fledgling: {
    /** GDD §8.2: base value by type; V = base × min(growthCap, 1 + growthPerMin × minutes). */
    base: { scrapper: 40, slinger: 50 },
    growthPerMin: 0.035,
    growthCap: 2.4,
    /** Fraction of V paid at once to the last hitter (or split among enemy heroes in range). */
    instantShare: 0.5,
    /** Enemy heroes within this range share a kill no hero landed. */
    shareRange: 25,
  },
  pod: {
    /** Fraction of V held by the pod; the securer gets all of it. */
    shareOfValue: 0.5,
    /** The denier gets this fraction of the pod's value (25% V). */
    denyFraction: 0.5,
    /** Rises this far over `riseS`, unhittable meanwhile; then hangs ripe for `ripeS`. */
    riseM: 1.6,
    riseS: 0.6,
    ripeS: 1.4,
    /**
     * Hit sphere radius (m; the GDD gives none): the drawn orb's size (the VFX POD.radius is 0.24). Combat's aim ray
     * stops on pods (D-SYS-005), so the bullet converges on the orb under the crosshair and needs no extra reach.
     * Spawn height is a fraction of the dead unit's height (the chest).
     */
    radius: 0.25,
    chestFraction: 0.75,
  },
} as const;
