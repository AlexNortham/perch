/**
 * World tuning: fledgling waves, marching, fighting (GDD §7.1), the vision rule (GDD §11.1, §5.9) and the Stage 4
 * neutral objectives (GDD §§7.8–7.15). Owner: Objectives (Balance & Data from W7). Units: metres, seconds; fractions
 * where 0.015 means 1.5%.
 */
import type { StatId, StatOp, StructureType, ThicketFamily } from '../core/contracts';

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
 * Structure cylinder radii at the authored anchors. Fledglings step
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
  /** Default for true-sight holders whose effect supplies no radius. */
  trueSight: 30,
  /** Non-hero entities are re-evaluated every this many ticks (heroes every tick); ARCHITECTURE §11 allows 0.25 s. */
  staggerTicks: 6,
} as const;

/** GDD §§5.11, 7.2–7.7 and 15.3. Heights include the complete collider. */
export const STRUCTURE_BODY = {
  hawk: { hp: 4500, height: 10 }, heron: { hp: 9000, height: 10 },
  warden: { hp: 4000, height: 7 }, shrine: { hp: 8000, height: 4 }, patron: { hp: 15_000, height: 11 },
} as const;

export const DEFENCE = {
  hawk: { range: 22, heroHit: 70, unitHit: 50, interval: 1, ramp: 0.15, cap: 0.75 },
  warden: { range: 24, heroHit: 80, unitHit: 60, interval: 1, ramp: 0.15, cap: 0.75 },
  heron: { range: 30, heroHit: 25, unitHit: 12.5, interval: 0.25, ramp: 0.025, cap: 0.5 },
  boltSpeed: 60,
  muzzleHeightFraction: 0.8,
  scanTicks: 6,
  priority: { aggressor: 0, current: 1, fledgling: 2, hero: 3 },
  stomp: { range: 7, damage: 120, push: 5, interval: 4, warning: 0.5 },
  pulse: { range: 12, damage: 120, interval: 3 },
  volley: { range: 35, damage: 50, feathers: 6, targets: 3, phase1: 3, phase2: 2 },
  screech: { range: 14, damage: 100, push: 8, interval: 10 },
  rain: { range: 35, radius: 3, targets: 4, damage: 180, warning: 1, interval: 6 },
  gale: { range: 30, cosHalf: Math.SQRT1_2, damage: 60, push: 10, interval: 12 },
  transition: { duration: 3, range: 20, push: 8, hp: 20_000, heartHeight: 6, heartRadius: 1 },
  ward: { range: 30, early: 0.35, late: 0.6, lateAtS: 35 * 60, lateFledglingMult: 1.25 },
  roost: { interval: 1, healFraction: 0.2, damage: 300 },
} as const;

// ---- Stage 4 neutral objectives (GDD §§7.8–7.15). Economy reads the Seed numbers below for its payouts. ----------

const MINUTE = 60;

export type CreatureType = 'beetle' | 'weasel' | 'rat' | 'toad' | 'badger' | 'cub';
export type CreatureSpecial = 'dashBite' | 'spit' | 'slam';

export interface CreatureDef {
  readonly hp: number;
  /** Damage per basic attack at 0:00. */
  readonly damage: number;
  readonly damageType: 'talon' | 'song';
  readonly attack: 'bite' | 'lash';
  readonly intervalS: number;
  /** Attack reach (m), centre to the target's surface. */
  readonly reach: number;
  /** Seeds per creature at 0:00 (GDD §7.8 "base"); economy pays base × (1 + seedsPerMinute × minutes). */
  readonly seeds: number;
  /** Chase speed (m/s) (assumed: the GDD gives none). */
  readonly speed: number;
  readonly radius: number;
  readonly height: number;
  readonly special?: CreatureSpecial;
  /** Rats: every bite applies this heal reduction. */
  readonly healReduction?: { readonly value: number; readonly durationS: number };
}

/** GDD §7.8 creatures. Speeds and body sizes are assumed. */
export const CREATURES: Readonly<Record<CreatureType, CreatureDef>> = {
  beetle: { hp: 200, damage: 12, damageType: 'talon', attack: 'bite', intervalS: 1.0, reach: 2.0, seeds: 45, speed: 5, radius: 0.5, height: 0.6 },
  weasel: { hp: 480, damage: 22, damageType: 'talon', attack: 'bite', intervalS: 1.0, reach: 2.0, seeds: 100, speed: 6, radius: 0.45, height: 0.6, special: 'dashBite' },
  rat: { hp: 220, damage: 10, damageType: 'talon', attack: 'bite', intervalS: 0.7, reach: 1.6, seeds: 60, speed: 5.5, radius: 0.3, height: 0.35,
    healReduction: { value: 0.2, durationS: 2 } },
  toad: { hp: 720, damage: 30, damageType: 'song', attack: 'lash', intervalS: 1.5, reach: 16, seeds: 150, speed: 3, radius: 0.6, height: 0.8, special: 'spit' },
  badger: { hp: 2000, damage: 50, damageType: 'talon', attack: 'bite', intervalS: 1.0, reach: 2.5, seeds: 560, speed: 5, radius: 0.9, height: 1.1, special: 'slam' },
  cub: { hp: 420, damage: 20, damageType: 'talon', attack: 'bite', intervalS: 1.0, reach: 2.0, seeds: 120, speed: 5.5, radius: 0.5, height: 0.6 },
};

/** GDD §7.8 special attacks. The first comes half an interval after the camp aggroes (assumed). */
export const CREATURE_SPECIALS = {
  dashBite: { everyS: 6, lungeM: 6, damage: 40, speed: 24 },
  spit: { everyS: 8, range: 16, radius: 3, durationS: 4, dps: 20, slow: 0.3, tickS: 0.5 },
  slam: { everyS: 6, telegraphS: 0.6, radius: 6, damage: 110, push: 4 },
} as const;

export interface ThicketFamilyDef {
  readonly units: readonly { readonly type: CreatureType; readonly n: number }[];
  readonly firstS: number;
  /** After the camp's last creature dies. */
  readonly respawnS: number;
  readonly resists: { readonly talon: number; readonly song: number };
}

/** GDD §7.8 families: creatures, first spawn, respawn after a full clear, resists. */
export const THICKET_FAMILIES: Readonly<Record<ThicketFamily, ThicketFamilyDef>> = {
  beetles: { units: [{ type: 'beetle', n: 3 }], firstS: 2 * MINUTE, respawnS: 90, resists: { talon: 0.3, song: 0.25 } },
  weasels: { units: [{ type: 'weasel', n: 3 }], firstS: 5 * MINUTE, respawnS: 285, resists: { talon: 0.3, song: 0.25 } },
  rats: { units: [{ type: 'rat', n: 5 }], firstS: 5 * MINUTE, respawnS: 285, resists: { talon: 0.3, song: 0.25 } },
  toads: { units: [{ type: 'toad', n: 2 }], firstS: 5 * MINUTE, respawnS: 285, resists: { talon: 0.3, song: 0.25 } },
  badgers: { units: [{ type: 'badger', n: 1 }, { type: 'cub', n: 2 }], firstS: 8 * MINUTE, respawnS: 330, resists: { talon: 0.4, song: 0.35 } },
};

/** GDD §7.8 camp rules. */
export const THICKETS = {
  /** HP and damage grow by these per minute of match time, fixed when the camp spawns; Seeds at the death. */
  hpPerMinute: 0.02,
  damagePerMinute: 0.005,
  seedsPerMinute: 0.015,
  /** A camp sleeps with no hero this close; while asleep, damage from a hero further than snipeM does nothing. */
  wakeM: 30,
  snipeM: 35,
  /** Asleep and idle camps check for heroes this often (staggered by camp). */
  checkS: 0.5,
  leashM: 18,
  /** A creature may chase this far past the leash while it still sees its target. */
  chaseM: 3,
  /** Without the camp taking damage this long, it walks home. */
  calmS: 6,
  /** Home and idle with no hero near, the camp sleeps this long later. */
  sleepS: 5,
  /** Each creature attacks the hero who dealt the camp the most damage in this window. */
  aggroWindowS: 3,
  /** Economy: a creature's Seeds go to the killer and allies who hit it in this window. */
  payoutWindowS: 5,
  retargetS: 0.5,
  /** Creatures stand on a ring this far from the anchor (assumed). */
  spreadM: 1.8,
  /** A creature this close to its home spot is home. */
  homeM: 0.3,
  /** Indoor creatures keep this far inside their room's walls. */
  wallMarginM: 0.4,
} as const;

export type NestVariant = 'twig' | 'woven' | 'keepsake';

/** GDD §7.9 Nests. Sprig odds and values are for economy, which drops the sprig on the Nest's death. */
export const NESTS = {
  twig: { radius: 0.5, height: 0.6, solid: false, by: 'any', sprig: { chance: 0.6, base: 24, perMinute: 1.8 }, crumb: 0.15, keepsake: 0 },
  woven: { radius: 0.6, height: 1.0, solid: true, by: 'heavyMelee', sprig: { chance: 1, base: 48, perMinute: 3.6 }, crumb: 0.25, keepsake: 0 },
  keepsake: { radius: 0.5, height: 0.6, solid: false, by: 'any', sprig: { chance: 0, base: 0, perMinute: 0 }, crumb: 0, keepsake: 0.5 },
} as const satisfies Record<NestVariant, unknown>;

export const NEST_RULES = {
  /** One hit of anything the Nest accepts breaks it. */
  hp: 1,
  spawnS: { surface: 3 * MINUTE, below: 5 * MINUTE, hollow: 10 * MINUTE },
  respawnS: { surface: 3 * MINUTE, below: 5 * MINUTE },
  /** Below this height a Nest counts as below ground; Hollow Nests are at or below hollowMaxY inside its radius. */
  belowY: -1,
  hollowMaxY: -2,
  /** A hero passing through a Twig or Keepsake Nest at this horizontal speed or faster breaks it. */
  breakSpeed: 8.5,
  /** Drops lie this far above the Nest's base. */
  dropLift: 0.3,
} as const;

/** GDD §§7.9, 7.13, 7.15: walk-in pickups (crumbs and keepsakes 1.5 m, Berries 1.2 m, measured flat). */
export const PICKUPS = {
  reachM: 1.5,
  berryReachM: 1.2,
  /** The pickup may sit this far below the feet or above them and still be collected. */
  below: 1.0,
  above: 2.0,
  radius: 0.4,
} as const;

export type CrumbType = 'quick' | 'light' | 'sweet';

/** GDD §7.9 crumbs: 60 s, lost on death, a new one replaces the old. Equal chances. */
export const CRUMBS: {
  readonly durationS: number;
  readonly types: Readonly<Record<CrumbType, { readonly name: string; readonly stat: StatId; readonly op: StatOp; readonly value: number }>>;
} = {
  durationS: 60,
  types: {
    quick: { name: 'Quick crumb', stat: 'fireRate', op: 'add', value: 0.15 },
    light: { name: 'Light crumb', stat: 'moveSpeed', op: 'add', value: 1 },
    sweet: { name: 'Sweet crumb', stat: 'songPower', op: 'add', value: 15 },
  },
};

export type RuneType = 'swift' | 'fierce' | 'sage' | 'stout';
/** [stat, op, value at 5:00, value at 40:00]; 'mul' rows hold a regeneration bonus (seconds per pip ÷ (1 + v)). */
type Scaled = readonly [StatId, StatOp, number, number];

/** GDD §7.10. */
export const RUNES = {
  firstS: 5 * MINUTE,
  everyS: 5 * MINUTE,
  durationS: 150,
  /** Strength is linear in match time between these, held after. */
  fromS: 5 * MINUTE,
  toS: 40 * MINUTE,
  radius: 0.5,
  types: {
    // ponytail: Updraft speed (+30% to +60%) needs a stat physics doesn't have; add it when Physics exposes one.
    swift: { name: 'Swift feather', stats: [['sprintSpeed', 'add', 1.5, 3.0], ['stamina', 'add', 1, 2], ['staminaRecharge', 'mul', 0.25, 0.6]] },
    fierce: { name: 'Fierce feather', stats: [['fireRate', 'add', 0.12, 0.3], ['magazine', 'pct', 0.3, 0.6]] },
    sage: { name: 'Sage feather', stats: [['songPower', 'add', 15, 60], ['cooldownReduction', 'stack', 0.1, 0.2]] },
    stout: { name: 'Stout feather', stats: [['maxHealth', 'add', 200, 700], ['healthRegen', 'add', 5, 35]] },
  } satisfies Record<RuneType, { readonly name: string; readonly stats: readonly Scaled[] }>,
} as const;

/** GDD §7.11 the Golden Egg. */
export const EGG = {
  firstS: 10 * MINUTE,
  everyS: 5 * MINUTE,
  lowerS: 10,
  /** Lowered from this far above its perch (assumed). */
  lowerFromM: 12,
  radius: 0.5,
  dropLockoutS: 1,
  unattendedS: 180,
  rollSpeed: 2,
  coolAfterS: 45,
  coolForS: 45,
  stoneM: 3,
  /** The Stone's circle reaches this far above and below the perch (assumed). */
  stoneHeightM: 3,
  setDownM: 1,
  /** E = base + perMinute × minutes when it lands; × trailingMult when the delivering flock trails in net worth. */
  value: { base: 400, perMinute: 70, trailingMult: 1.25 },
  carrier: { moveSpeed: 1.5, stamina: 1 },
  /** Per 1% net-worth deficit, up to capPct. */
  trailing: { resistPerPct: 0.02, sprintPerPct: 0.2, capPct: 15 },
  keepsakes: { courier: 3, escort: 1, escortM: 30 },
} as const;

/** GDD §7.12 the Roc. Wind-ups and body size are assumed. */
export const ROC = {
  wakeS: 20 * MINUTE,
  hp: 24_000,
  /** Max HP added per whole minute it lives; current HP rises with it. */
  hpPerMinute: 300,
  regen: 15,
  resists: { talon: 0.15, song: 0 },
  radius: 3,
  height: 9,
  /** Only heroes in the Hollow at or below this height hurt it or draw its aggro. */
  hollowMaxY: -2,
  /** The damage sphere reaches this far past the Hollow's radius (its ramps). */
  hollowPadM: 4,
  aggroEveryS: 1,
  /** Rake: a cone from the body's edge; cosHalf of the 90° cone. */
  rake: { everyS: 2.5, windupS: 0.5, lengthM: 8, cosHalf: Math.SQRT1_2, damage: 140 },
  flap: { everyS: 10, windupS: 0.6, radius: 15, damage: 80, push: 10 },
  enrage: { atFraction: 0.25, attackSpeed: 0.3 },
  shriek: { everyS: 8, windupS: 0.4, radius: 20, silenceS: 1.5 },
  resetS: 8,
  /** After the 1st, 2nd and each later kill. */
  respawnS: [7 * MINUTE, 6 * MINUTE, 5 * MINUTE],
  /** Economy pays the Seeds to each hero of the killing flock; world grants the keepsakes. */
  reward: { base: 300, perMinute: 5, keepsakes: 2 },
} as const;

/** GDD §7.12 Phoenix Embers and Rekindle. Spots are offsets from the Hollow's floor centre. */
export const EMBERS = {
  spots: [{ x: 10, y: 0, z: 0 }, { x: -5, y: 0, z: 8.66 }, { x: -5, y: 0, z: -8.66 }],
  fallS: 6,
  fallFromM: 9,
  burnS: 60,
  radius: 0.5,
  /** Economy: the claimer's Seeds. */
  claim: { base: 200, perMinute: 5 },
  maxCharges: 3,
  rekindleS: 180,
  /** Siege flight: fledglings spawning while their flock holds Rekindle. */
  siegeFlight: { hp: 0.4, vsStructures: 0.3 },
} as const;

/** GDD §7.13 keepsakes: [stat, op, weight, 0:00–9:59, 10:00–29:59, 30:00+]; the 'mul' row is a regeneration bonus. */
export const KEEPSAKES = {
  bucketsS: [0, 10 * MINUTE, 30 * MINUTE],
  types: [
    ['gunDamage', 'add', 1, [0.025, 0.035, 0.05]],
    ['fireRate', 'add', 1, [0.015, 0.02, 0.03]],
    ['magazine', 'pct', 1, [0.04, 0.06, 0.08]],
    ['maxHealth', 'add', 2, [15, 25, 35]],
    ['songPower', 'add', 1, [2, 3, 4]],
    ['talonResist', 'stack', 1, [0.0075, 0.01, 0.015]],
    ['songResist', 'stack', 1, [0.0075, 0.01, 0.015]],
    ['cooldownReduction', 'stack', 1, [0.005, 0.0075, 0.01]],
    ['moveSpeed', 'add', 0.5, [0.1, 0.15, 0.2]],
    ['staminaRecharge', 'mul', 0.5, [0.02, 0.03, 0.04]],
  ] as const satisfies readonly (readonly [StatId, StatOp, number, readonly [number, number, number]])[],
  /** The last type's weight is multiplied by this for the next draw. */
  repeatWeight: 0.5,
  caps: { talonResist: 0.15, songResist: 0.15, cooldownReduction: 0.1, moveSpeed: 2 } as Readonly<Partial<Record<StatId, number>>>,
} as const;

/** GDD §7.14 Bell Feeders. Economy reads `seeds`. */
export const FEEDERS = {
  firstS: 8 * MINUTE,
  respawnS: 5 * MINUTE,
  hp: 480,
  light: 60,
  heavy: 120,
  swingBack: 70,
  chimeHp: 180,
  /** F = base + perMinute × minutes at the first hit; a light hit pays F × light, heavy F × heavy, the break F × share. */
  seeds: { base: 300, perMinute: 3, light: 1 / 16, heavy: 1 / 8, share: 1 / 2, shareWindowS: 5 },
  /** Chime rhythms, one chosen by seeded RNG when it starts; lit for litS at the start of each period. */
  beats: [{ chance: 0.6, litS: 0.5, everyS: 1.5 }, { chance: 0.4, litS: 0.3, everyS: 1.0 }],
  keepsakes: { light: 1, heavy: 3 },
  radius: 0.5,
  height: 0.8,
} as const;

/** GDD §7.15 Berries, Hides and Lookouts; §6.8 ivy curtains. */
export const INTERACTABLES = {
  berry: { firstS: 150, respawnS: 3 * MINUTE, healFraction: 0.15, healS: 4 },
  /** Hides: regen per second (flat + fraction of max HP), staminaRecharge × 0.5 (100% faster), shown 2 s after hostility. */
  hide: { regen: 3, regenMaxHp: 0.0025, staminaRecharge: 0.5, showS: 2, tickS: 0.5, insetM: 0.3 },
  lookout: { radiusM: 3, sight: 60 },
  ivy: { ignoreWithinM: 3 },
} as const;
