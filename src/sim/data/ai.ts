/**
 * Bot AI numbers (GDD §11). Owner: Bot AI (Balance & Data from W7). Units: seconds, metres, degrees where the name
 * says Deg, fractions of max health for HP thresholds.
 */
import type { Archetype, BotDifficulty, HeroId, LaneId, NavLinkKind, Vec3 } from '../core/contracts';

/** One difficulty's parameters (GDD §11.2, §11.7). */
export interface Difficulty {
  /** Enemy first seen → first shot, with ±reactionJitter seeded jitter. */
  readonly reactionS: number;
  /** Std. dev. of the aim error angle against a still target. */
  readonly aimErrorDeg: number;
  /** Extra error per m/s of the target's speed across the line of sight. */
  readonly errorPerMpsDeg: number;
  /** Tracking smoothing time constant. */
  readonly trackingS: number;
  /** Share of engagements aimed at the head. */
  readonly headRate: number;
  readonly lastHitRate: number;
  /** ± error on the moment a ripe pod is shot. */
  readonly podTimingS: number;
  readonly denyRate: number;
  readonly decisionS: number;
  /** Chance to parry a visible enemy heavy melee aimed at it. */
  readonly parryRate: number;
  readonly retreatHp: number;
  /** Softmax temperature for purchases (§11.4). */
  readonly temperature: number;
  /** 'roost': shops only at the Home Roost; 'own': any own stall, plus the Magpie Den when nearest. */
  readonly shops: 'roost' | 'own';
  /** Leaves the lane to shop with this many unspent Seeds (Raptor), else null. */
  readonly leaveLaneSeeds: number | null;
  /** Strafes and dashes between shots in a fight (Hunter+). */
  readonly strafe: boolean;
  /** Ability use (§11.2): cast in range; cast on a likely hit; also chain disables and hold ultimates. */
  readonly abilities: 'inRange' | 'predict' | 'chain';
  /** Fraction of a projectile's travel time the aim leads a moving target by. */
  readonly lead: number;
  /** Nav links it takes (§11.2 Movement). */
  readonly links: readonly NavLinkKind[];
  /** Remembers where an unseen enemy hero was last seen and chases it (Raptor, §11.2 map awareness). */
  readonly lastSeen: boolean;
  /** Leaves its lane after 10:00 to farm and take objectives while its partner holds (§11.3 rotations). */
  readonly rotates: boolean;
}

const WALK_LINKS: readonly NavLinkKind[] = ['walk', 'drop', 'jump', 'mantle'];

export const DIFFICULTIES: Readonly<Record<BotDifficulty, Difficulty>> = {
  easy: {
    reactionS: 0.6, aimErrorDeg: 4, errorPerMpsDeg: 0.5, trackingS: 0.25, headRate: 0, lastHitRate: 0.5, podTimingS: 0.4,
    denyRate: 0, decisionS: 0.5, parryRate: 0, retreatHp: 0.25, temperature: 1, shops: 'roost', leaveLaneSeeds: null,
    strafe: false, abilities: 'inRange', lead: 0.5, links: WALK_LINKS, lastSeen: false, rotates: false,
  },
  normal: {
    reactionS: 0.35, aimErrorDeg: 2.2, errorPerMpsDeg: 0.3, trackingS: 0.15, headRate: 0.25, lastHitRate: 0.8, podTimingS: 0.2,
    denyRate: 0.5, decisionS: 0.33, parryRate: 0.2, retreatHp: 0.35, temperature: 0.5, shops: 'own', leaveLaneSeeds: null,
    strafe: true, abilities: 'predict', lead: 0.8, links: WALK_LINKS, lastSeen: false, rotates: true,
  },
  hard: {
    reactionS: 0.2, aimErrorDeg: 1, errorPerMpsDeg: 0.15, trackingS: 0.08, headRate: 0.6, lastHitRate: 0.95, podTimingS: 0.05,
    denyRate: 0.9, decisionS: 0.2, parryRate: 0.6, retreatHp: 0.4, temperature: 0.2, shops: 'own', leaveLaneSeeds: 3000,
    strafe: true, abilities: 'chain', lead: 1, links: [...WALK_LINKS, 'dashJump'], lastSeen: true, rotates: true,
  },
};

/** Human-like aim (GDD §11.2): flicks to a new target, then tracking with a wandering error and per-shot kick. */
export const AIM = {
  /** ± fraction of the reaction time (seeded). */
  reactionJitter: 0.25,
  /** The wandering error is redrawn this often and eased toward over the same time. */
  errorEveryS: 0.45,
  /** A flick overshoots by this many aim-error deviations, then settles at the tracking rate. */
  flickOvershoot: 1.5,
  /** Flicks move this many times faster than tracking. */
  flickSpeed: 2.5,
  /** Look pitch climbs this much per shot (the hand riding the gun's kick); tracking pulls it back. */
  recoilDeg: 0.25,
  /** Fires only while the crosshair is within this many degrees of the target point, plus its angular size. */
  fireConeDeg: 3,
  /** Solves the camera offset (the crosshair isn't the pivot) with this many refinement passes. */
  solvePasses: 3,
  /** A target not seen for this long is dropped. */
  forgetS: 2.5,
  /** Body aim point as a fraction of the target's height. */
  bodyFraction: 0.55,
  /** Vertical error is this share of the horizontal (people track sideways worse than up and down). */
  pitchShare: 0.6,
  /** Reaction to a fledgling, pod or structure is this share of the hero reaction time. */
  unitReaction: 0.5,
  /** Aims at most this high on a tall structure (towers are 7–11 m). */
  structureAimM: 3,
  /** Scales a sum of two uniform differences (variance 1/3) to unit deviation: √3. */
  unitScale: Math.sqrt(3),
} as const;

/** GDD §11.3 laning. */
export const LANE = {
  /** Stand this far behind the own wave's front fledgling. */
  behindWaveM: 5,
  /** "Within 25 m of its fledglings". */
  waveLeashM: 25,
  /** With no own wave, hold this far in front of the outermost own tower … */
  aheadOfTowerM: 6,
  /** … and at least this far short of the enemy wave front. */
  shortOfEnemyM: 14,
  /** Stay this far outside an enemy tower's reach unless it is hitting the own wave. */
  towerMarginM: 4,
  /** How close to an enemy tower a bot goes to shoot it while the tower hits the own wave. */
  towerStandM: 14,
  /** Lane partners stand this far either side of the lane line (clamped inside the lane). */
  sideM: 2.5,
  /** Distance from the lane line that still counts as being in the lane corridor. */
  corridorM: 6,
  /** Fledglings this far forward of the gate count as on the lane. */
  gateM: 3,
} as const;

/** Targets and fights (GDD §11.3). */
export const FIGHT = {
  /** Fight state: an enemy hero visible within this … */
  engageM: 35,
  /** … and the local fight score (radius below) at least this. */
  scoreRadiusM: 30,
  engageScore: 0.9,
  retreatScore: 0.6,
  /** Retreat when this many more enemies than allies stand within scoreRadiusM. */
  outnumberedBy: 2,
  /** Pokes the enemy laner only while its own HP fraction is at least the enemy's times this. */
  pokeHpRatio: 1,
  /** Prefers these archetypes as targets: effective HP is multiplied by this before picking the lowest. */
  preferredWeight: 0.75,
  preferred: ['support', 'gunCarry'] as readonly Archetype[],
  /** Keeps the current target unless another scores below this fraction of it. */
  switchRatio: 0.7,
  /** A last hit is due when the fledgling's HP is at most one trigger pull times this. */
  lastHitMargin: 1.05,
  /** Strafe changes direction every min..max seconds. */
  strafeMinS: 0.45,
  strafeMaxS: 1.2,
  /** Dashes sideways at most this often in a fight, with at least dashStamina pips left. */
  dashEveryS: 4,
  dashStamina: 2,
  /** Backs off inside this fraction of the gun's falloff start; closes in beyond it. */
  tooCloseFraction: 0.35,
  /** With no falloff data a gun is treated as effective to here. */
  defaultRangeM: 25,
  /** Light melee an enemy this close while reloading. */
  meleeM: 2.5,
  /** Committed to an open enemy base, a bot stops to fight only an enemy hero this close (D-AI-009). */
  siegeEngageM: 15,
  /** Parries a heavy wind-up from this close (the heavy lunge plus melee reach). */
  parryM: 6.5,
  meleeEveryS: 0.7,
  /** Back to fighting after a tactical retreat once the fight score recovers to this. */
  regroupScore: 1.1,
  /** Chases a lost target to its last-seen point for this long. */
  chaseS: 3,
  /** Shoots this far past the gun's falloff end (but never beyond its range). */
  pastFalloffM: 10,
  /** Fights from at least this far, or the gun's falloff start. */
  minSweetM: 8,
  /** A tower's (HP × hits per second) counts this much against a hero's (effective HP × DPS) in the fight score. */
  towerWeight: 0.02,
  /** Falls back this far along the lane when outnumbered. */
  fallBackM: 25,
  /** Steps back this far when too close. */
  backOffM: 6,
  /** Chance to flip strafe direction at each change. */
  strafeFlip: 0.7,
  /** Chance per tick, once a dash is allowed, to take it. */
  dashChance: 0.02,
  /** Tops up the magazine below this fraction with nothing to shoot. */
  reloadBelow: 0.5,
} as const;

/** Lane-time target priorities (higher first; each loses up to 1 with distance) and line-of-sight checks. */
export const TARGET = {
  pod: 6,
  /** An enemy tower busy with the own wave (the window to siege it). */
  siege: 5.5,
  lastHit: 5,
  poke: 4,
  structure: 3,
  wave: 2,
  nest: 1,
  /** A ray that stops this close to the target still counts as clear. */
  losSlackM: 0.6,
  /** Line of sight to the current target is re-checked this often (ticks). */
  losEveryTicks: 6,
  /** Once-per-entity draws are pruned of despawned entities past this many. */
  forgetAfter: 256,
} as const;

/** Retreat, healing and the Home Roost (GDD §11.3). */
export const RETREAT = {
  /** Below this HP fraction it goes all the way to the Home Roost. */
  roostHp: 0.3,
  /** Stays at the Roost until this healthy. */
  healedHp: 0.9,
  /** Committed to an open enemy base, a bot goes home only below this HP fraction (D-AI-009). */
  committedHp: 0.15,
  /** Uses an escape ability when an enemy hero is this close. */
  escapeM: 15,
} as const;

/** Buying (GDD §11.4) and shop trips (§11.3). */
export const SHOP = {
  /** GDD §11.4 phases: mid from 10:00, late from 22:00 (BuildData.phases carries the same numbers). */
  midFromS: 600,
  lateFromS: 1320,
  /** Situational picks score this much more while their condition holds. */
  situational: 0.15,
  /** A Hunter walks to a lane stall with this many unspent Seeds when one is this close and the lane is quiet. */
  tripSeeds: 1600,
  tripM: 60,
  /** Buys at most one item every this many ticks (lets the shop UI and telemetry keep up). */
  buyEveryTicks: 2,
  /** With every slot full, replaces an item only with one of a higher tier that scores at least this much more. */
  replaceMargin: 0.2,
  /** GDD §8.7: at most four item actives (sim/items enforces it; bots don't ask for a fifth). */
  maxActives: 4,
} as const;

/** Navigation on MapData.nav (GDD §6.7). */
export const NAV = {
  /** Cost multiplier per link kind (Infinity = never taken). */
  cost: { walk: 1, drop: 1.5, jump: 4, mantle: 4, dashJump: 6, vine: Infinity, chimney: Infinity, updraft: Infinity } as Readonly<Record<NavLinkKind, number>>,
  /** Bucket size for the nearest-node lookup, and the stride that packs a bucket's (x, z) into one key. */
  cellM: 8,
  keyStride: 4096,
  /** A node counts as reached this close (horizontal) and this close in height. */
  arriveM: 1.1,
  arriveDy: 1.6,
  /** Nearest-node search: height difference counts this much more than horizontal distance. */
  heightWeight: 3,
  /** Within this distance of the goal it walks straight at it. */
  directM: 6,
  /** Replans this often, or when the goal moves this far. */
  replanS: 3,
  goalMovedM: 4,
  /** Jump links: jump this close to the link's far node; mantle links hold Jump this close (horizontal). */
  jumpM: 3,
  /** Jump is held at most this long so it never latches an Updraft by accident (latch: 0.2 s). */
  jumpHoldS: 0.12,
  /** No progress for this long: jump; for twice as long: replan from the nearest node. */
  stuckS: 1.2,
  stuckProgressM: 0.4,
  /** Nearest-node search rings beyond the first. */
  searchRings: 3,
  /** Start and goal nodes: the first of this many nearest that a ray from eyeM above the point reaches. */
  candidates: 6,
  eyeM: 1,
  /** Start nodes a bot has given up on are forgotten past this many. */
  forgetBad: 16,
  /** Off-route moves probe the ground this far ahead every ledgeEveryTicks; a drop deeper than ledgeDropM stops them. */
  ledgeProbeM: 1.5,
  ledgeEveryTicks: 3,
  ledgeDropM: 1.5,
  /** Steering looks this far past a tower's margin for one in the way, and pushes out this hard inside it. */
  avoidAheadM: 6,
  avoidPush: 2,
  /** Routes keep this far (plus the tower's radius) from every tower's centre: the graph doesn't know their colliders. */
  structureClearM: 1.2,
  /** Towers at least this wide are routed round on the graph; narrower ones are steered round on the way. */
  bigStructureM: 5,
  /**
   * Walk links the graph lacks once the Patron's dais is closed (Dawn half; the mirror is added too): the Home
   * Roost's ramps round the dais to the Riverbank gate, the route the siege proof walks (tests/siege-proof).
   */
  extraLinks: [
    [{ x: -12.5, y: 0, z: -132 }, { x: -4, y: 0, z: -118 }],
    [{ x: 12.5, y: 0, z: -132 }, { x: 4, y: 0, z: -118 }],
  ] as readonly (readonly [Vec3, Vec3])[],
} as const;

/** Updrafts by held Jump (GDD §3.7, D-EP-039). */
export const RIDE = {
  /** Rides when the goal is at least this far along the lane. */
  minM: 45,
  /** Gets off this far short of the goal. */
  offM: 8,
  /** Holds Jump this long to latch (the latch needs 0.2 s). */
  holdS: 0.3,
  /** Gets off at once with an enemy hero visible this close. */
  dangerM: 30,
  /** Gives up latching after this long, and tries again after retryS. */
  giveUpS: 1.5,
  retryS: 6,
} as const;

/** Objectives (GDD §11.3, §11.7). */
export const OBJECTIVE = {
  /** A rune within this distance that is up or spawns within runeSoonS draws a bot. */
  runeM: 50,
  runeSoonS: 20,
  /** The Egg draws the nearest eggBots of each flock while it waits or lies on the ground. */
  eggBots: 3,
  /** Bots go for the Egg from this far. */
  eggM: 90,
  /** Escorts keep within this distance of the carrier. */
  escortM: 10,
  /** Swings at a melee pickup this close (horizontal). */
  meleeReachM: 2.2,
  /** Heavy melee: holds Melee this long (heavy commits at 0.35 s). */
  heavyHoldS: 0.45,
  /** Starts the Roc with at least this many allies alive; the rocBots bots nearest the Hollow go, and fight it from rocRingM. */
  rocAllies: 4,
  rocNearM: 40,
  rocBots: 5,
  rocRingM: 10,
  /** … and either this many enemies dead or no enemy hero seen within rocClearM for rocClearS. */
  rocDeadEnemies: 2,
  rocClearM: 80,
  rocClearS: 10,
  /** The three healthiest within this distance claim the Embers. */
  emberM: 25,
  emberBots: 3,
  /** A Thicket or Nest this close draws a farming bot. */
  farmM: 60,
  /** Fights a camp from this far (outside a dormant camp's 35 m nothing lands). */
  farmStandM: 12,
  /** Thicket tiers by level (GDD §11.3): tier 2 from level 5, tier 3 from 12 (9 with an ally near). */
  tier2Level: 5,
  tier3Level: 12,
  tier3WithAllyLevel: 9,
  /** Twig Nests this close to a laning bot are shot when nothing better is in range; drops this close are walked to. */
  nestShootM: 18,
  dropM: 10,
  /** Answers an ally's ping with this many bots within pingM, for pingS. */
  pingBots: 2,
  pingM: 120,
  pingS: 20,
  /** Defends an allied structure under attack by this many enemy heroes with the defendBots nearest bots. */
  defendHeroes: 2,
  defendBots: 3,
  defendM: 30,
  /** … that hit it in the last defendS, answered by bots within defendRangeM. */
  defendS: 3,
  defendRangeM: 120,
  /** Pushes after this match time, with Rekindle up, or with this many enemies dead (GDD §11.3). */
  pushFromS: 1200,
  pushDeadEnemies: 2,
  /** Rotations: free roamers leave the lane after this match time (Hunter+). */
  rotateFromS: 600,
  /**
   * The flock commits to a siege (D-AI-009) with at least commitMinAllies up, when the enemy is down to wipeAlive, for
   * rocPushS after a Roc kill, with Rekindle, from 20:00 when commitEdge more heroes are up, or from allInFromS when at
   * least as many are up. It falls back at fallBackAlive up, or when outnumbered by commitEdge.
   */
  commitMinAllies: 3,
  wipeAlive: 2,
  rocPushS: 90,
  commitEdge: 2,
  allInFromS: 1800,
  fallBackAlive: 2,
  /** Defend at home: a seen enemy hero within homeM of an open Shrine or Patron, or homeFledglings enemy fledglings in its 30 m Ward radius; defenders stand homeStandM out from it. */
  homeM: 40,
  homeWardM: 30,
  homeFledglings: 3,
  homeStandM: 8,
} as const;

/**
 * Sieging the base (GDD §11.3): where to shoot each Shrine and the Patron from, on the main map (the stands the siege
 * proof uses, src/sim/ai/siege-proof.testkit.ts; Dawn's attacking side, mirrored for the other flock): a Shrine through
 * the far side of the Riverbank gate, x away from it; the Patron down the Riverbank line. Bots close in along that
 * line to their gun's range, less slackM, but no nearer than minM from the body.
 */
export const SIEGE = {
  shrine: { x: 11.6, z: 100.4 },
  patronZ: 92,
  slackM: 4,
  /** Stands at least this far from a base structure's body (the Shrine pulse reaches 12 m) and at most maxM. */
  minM: 16,
  maxM: 30,
  /** Candidate stands: these angles (radians) either side of the gate's direction, at these fractions of the range. */
  fan: [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6],
  rings: [1, 0.8],
  /** Ground under a candidate is probed from this far above the structure's base. */
  probeUpM: 3,
} as const;

/** Ability and item-active use (GDD §11.2). */
export const CAST = {
  /** At most one cast this often. */
  everyS: 0.6,
  /** Abilities with no range work within this distance. */
  defaultRangeM: 15,
  /** 'predict': casts only when the target is within this fraction of the range. */
  predictRange: 0.8,
  /** Self-centred damage fires with the target this close. */
  novaM: 7,
  /** Ally heals and shields go to the ally in combat with the lowest HP fraction under allyHp. */
  allyHp: 0.7,
  /** An ally cast waits this long for the crosshair to reach its ally, then gives up. */
  assistS: 0.8,
  /** Self heals and shields fire below this HP fraction in combat. */
  healHp: 0.6,
  /** Raptor holds its ultimate for this many enemy heroes within holdRadiusM of the target, or a target this low. */
  holdHeroes: 2,
  holdRadiusM: 10,
  holdKillHp: 0.4,
} as const;

/** GDD §11.6: the archetypes a flock fills first, in order; then any archetype it lacks. */
export const PICK_ORDER: readonly Archetype[] = ['support', 'tank', 'gunCarry', 'areaControl'];
/** GDD §11.3 lane pairs: a frontline hero with a backline one where possible. */
export const FRONTLINE: readonly Archetype[] = ['tank', 'skirmisher', 'assassin'];
/** Lanes filled two by two in this order (the human counts as the first laner on its flock). */
export const LANE_ORDER: readonly LaneId[] = ['riverbank', 'hedgerow', 'pinewood'];
export const PER_LANE = 2;

/** GDD §11.5 AP priority after the ultimate: ability slots (0-based) in order. */
const ap = (s: string): readonly number[] => s.split(' > ').map((n) => Number(n) - 1);
export const AP_PRIORITY: Readonly<Record<HeroId, readonly number[]>> = {
  shrike: ap('1 > 3 > 2'), albatross: ap('2 > 1 > 3'), kingfisher: ap('3 > 1 > 2'), lyrebird: ap('1 > 3 > 2'),
  owl: ap('1 > 2 > 3'), pelican: ap('2 > 3 > 1'), secretarybird: ap('1 > 2 > 3'), starling: ap('1 > 2 > 3'),
  hornbill: ap('1 > 2 > 3'), flamingo: ap('1 > 2 > 3'), penguin: ap('1 > 2 > 3'), puffin: ap('1 > 2 > 3'),
  peacock: ap('1 > 2 > 3'), vulture: ap('1 > 2 > 3'), swift: ap('3 > 1 > 2'), hummingbird: ap('1 > 2 > 3'),
  cassowary: ap('1 > 2 > 3'), toucan: ap('1 > 2 > 3'), woodpecker: ap('1 > 2 > 3'), nightjar: ap('1 > 2 > 3'),
  frigatebird: ap('1 > 3 > 2'), cockatoo: ap('1 > 3 > 2'), swan: ap('1 > 2 > 3'), kiwi: ap('1 > 2 > 3'),
};

/**
 * Situational-pick conditions (GDD §11.8, BuildData situational `condition` ids): each holds while the enemy flock
 * fields one of these archetypes. Bots add SHOP.situational to the item's score while it holds.
 */
export const CONDITIONS: Readonly<Record<string, readonly Archetype[]>> = {
  enemyHealers: ['support'],
  enemySongBurst: ['songBurst'],
  enemyPoke: ['poke'],
  enemyDisables: ['tank', 'areaControl'],
  enemyDivers: ['assassin', 'skirmisher'],
  enemyGunCarries: ['gunCarry'],
  enemyTanks: ['tank'],
  enemyGrouped: ['tank', 'support', 'areaControl'],
};
