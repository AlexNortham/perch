/**
 * Economy tuning (GDD §8). Owner: Economy & Items (Balance & Data from W7).
 * Units: metres, seconds; fractions where 0.5 means 50%.
 */
export const ECONOMY = {
  /** GDD §8.1: Seeds a hero starts with (SimOptions.startSeeds overrides it); 600 per the feel reference (G23). */
  startSeeds: 600,
  /** GDD §8.4: passive income, Seeds per second per hero from `passiveFromS` (assumed in the GDD). */
  passivePerSecond: 1,
  passiveFromS: 30,
  secondsPerMinute: 60,
  levels: { max: 30, baseCost: 400, costGrowth: 50, doubleApEvery: 10, ultimate: 6, ultimateSlot: 3 },
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
  /** GDD §7.8: seeds per creature at the base, × (1 + perMinute × minutes), split with allies who hit it in the last windowS. */
  thicket: { perCreature: { beetle: 45, weasel: 100, rat: 60, toad: 150, badger: 560, cub: 120 } as Readonly<Record<string, number>>, perMinute: 0.015, windowS: 5 },
  /** GDD §7.9: seed sprigs from a broken Nest (twig: a chance of a small one; woven: always a bigger one). */
  nest: { twig: { chance: 0.6, base: 24, perMinute: 1.8 }, woven: { chance: 1, base: 48, perMinute: 3.6 }, pickupRadius: 1.5, sprigLifeS: 60 },
  /** GDD §7.14: F = base + perMinute × minutes, set at the first hit. */
  feeder: { base: 300, perMinute: 3, lightShare: 1 / 16, heavyShare: 1 / 8, breakShare: 1 / 2, windowS: 5 },
  /** GDD §7.11: the Egg hatches into this many golden pods; the courier splits a securer's pod; a denier gets denyFraction. */
  egg: { pods: 6, courierSplit: 0.5, denyFraction: 0.25, ringM: 2.5 },
  /** GDD §7.12: the Roc's kill reward (every hero of the killing flock) and each Ember claim (the claimer). */
  roc: { base: 300, perMinute: 5 },
  ember: { base: 200, perMinute: 5 },
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
