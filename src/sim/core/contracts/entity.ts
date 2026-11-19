/**
 * Entities and components.
 *
 * An entity is a plain record: identity, transform and a few optional components. Each component has exactly one
 * writer (named in its TSDoc); everyone else reads it. A system keeps state nobody else needs in its own instance,
 * keyed by EntityId (see ARCHITECTURE.md, "Private state"), not in these components.
 *
 * Components that every entity of a kind has are required on that kind's interface, so code that narrowed on
 * `kind` never needs `?.`. createSim and the spawning system fill them with neutral values; the owner corrects its
 * own on `entity.spawned`.
 */
import type {
  AbilityId,
  Controller,
  EntityId,
  HeroId,
  ItemId,
  LaneId,
  PlayerTeam,
  Team,
  Tick,
  Vec3,
} from './base';
import type { PlayerCommand } from './command';
import type { AreaShape, MovementModeKind, SummonKind } from './effects';
import type { StatBlock, StatId } from './stats';
import type { StatusInstance } from './statuses';

export type EntityKind = 'hero' | 'unit' | 'structure' | 'projectile' | 'pickup' | 'area';

/**
 * Non-hero units (GDD §7): fledglings (Scrappers, Slingers) march the lanes; Thicket creatures (beetles, weasels,
 * rats, toads, badgers and cubs) and the Roc are neutral; summons belong to a hero.
 */
export type UnitType = 'scrapper' | 'slinger' | 'beetle' | 'weasel' | 'rat' | 'toad' | 'badger' | 'cub' | 'roc' | 'summon';
/** Thicket (neutral camp) tiers (GDD §7.8). */
export type ThicketTier = 1 | 2 | 3;

/** Bits for EntityBase.seenBy. */
export const SeenBy = { dawn: 0x1, dusk: 0x2, all: 0x3 } as const;
/**
 * Sentinel Hawk, Stilt Heron, Nest Warden, Roost Shrine, Patron (Great Owl / Elder Raven), and 'nest': every neutral
 * breakable, told apart by StructureInfo.variant ('twig', 'woven', 'keepsake' Nests and the 'feeder' Bell Feeder).
 * One type keeps the tower tables keyed on `Exclude<StructureType, 'nest'>` unchanged (D-ARCH-023).
 */
export type StructureType = 'hawk' | 'heron' | 'warden' | 'shrine' | 'patron' | 'nest';
/**
 * Seed pod (last-hit orb, also the Egg's golden pods), Feather rune, the Golden Egg, a Phoenix Ember; Stage 4: a
 * Nest's seed sprig, crumb or keepsake drop, and a Berry (GDD §§7.9, 7.13, 7.15).
 */
export type PickupType = 'pod' | 'rune' | 'egg' | 'ember' | 'sprig' | 'crumb' | 'keepsake' | 'berry';

/** Fields every entity has. */
export interface EntityBase {
  readonly id: EntityId;
  readonly kind: EntityKind;
  readonly team: Team;
  /**
   * Feet position for characters and units, centre for everything else. Writer: the owner of the kind's movement
   * (INTERFACES §3), with two exceptions: sim/combat places a respawning hero (D-COMBAT-002), and sim/physics moves a
   * unit while a displace, dash or attach effect acts on it (D-ARCH-014).
   */
  pos: Vec3;
  /** Velocity (m/s). Same writers as `pos`. */
  vel: Vec3;
  /** Facing (radians, see base.ts for the convention). Same writer as `pos`; for heroes it is the look yaw. */
  yaw: number;
  /** Broad-phase radius for the spatial hash and pickup reach. Set at spawn by the spawning system. */
  radius: number;
  /** Set by `store.despawn`. The entity leaves the store at the end of the tick; iteration already skips it. */
  removed: boolean;
  /**
   * Which flocks can see it (SeenBy bits): the shared visibility service (GDD §11.1 vision rule plus reveal,
   * invisibility and true sight). Writer: sim/world, every tick in the world phase. The store sets SeenBy.all at
   * spawn. Read it with core/vision.ts `canSee`.
   */
  seenBy: number;
  /** Extra map-only visibility bits, written by world. */
  mapOnlySeenBy?: number;
}

/**
 * Health. Writer: sim/combat (damage pipeline, heals, shields, death, respawn). Max health is the `maxHealth` stat.
 */
export interface Health {
  hp: number;
  /** Shield totals (GDD §5.10): typed shields absorb their type, the barrier absorbs both; hp comes last. */
  talonShield: number;
  songShield: number;
  barrier: number;
  /** Heroes stay in the store while dead; every other kind is despawned when it dies. */
  dead: boolean;
  /** Heroes only: tick at which the hero respawns, or null while alive. */
  respawnAt: Tick | null;
  /** Heroes only: in combat (GDD §5.13) until this tick; sprint and out-of-combat effects read it. */
  inCombatUntil: Tick;
}

/**
 * Hero identity. Writer: createSim (fixed for the match).
 */
export interface HeroInfo {
  readonly heroId: HeroId;
  /** Index into SimConfig.roster. */
  readonly slot: number;
  readonly controller: Controller;
  /** Practice target reset point and HP, set by core and honoured by Combat. */
  readonly training?: { readonly pos: Vec3; readonly hp: number };
}

/**
 * Movement state. Writer: sim/physics. The animation flags in the view come from here.
 */
export interface Motor {
  grounded: boolean;
  crouching: boolean;
  sliding: boolean;
  dashing: boolean;
  mantling: boolean;
  /** Index into MapData.updrafts while riding one, else null. */
  updraft: number | null;
  /**
   * Stage 4 (D-EP-039): the Updraft whose cable is within mounting reach (PhysicsService.updraftInReach) while not
   * riding, else null. Holding Jump mounts it. The HUD prompts from it; bots read it.
   */
  updraftInReach?: number | null;
  /** Index into MapData.climbs while climbing a Chimney or Vine, else null. */
  climb: number | null;
  /** Knocked up: airborne with no control until landing (GDD §5.9). */
  knockedUp: boolean;
  /** An ability movement mode (MovementModeEffect), or null. */
  mode: MovementModeKind | null;
  /** While `mode` is set, the mode's `allowGun`: false blocks the gun (sim/combat). Absent means true. */
  modeAllowsGun?: boolean;
  /** While `mode` is set, the mode's `allowAbilities`: false blocks casting (sim/abilities). Absent means true. */
  modeAllowsAbilities?: boolean;
  /** Attached to another entity's socket (Pelican's Gulp), or null. */
  attachedTo: EntityId | null;
  /** Current stamina (dash charges, fractional while regenerating). Max is the `stamina` stat. */
  stamina: number;
  /** True exactly while Jump can convert the current dash. */
  dashJumpReady?: boolean;
}

/**
 * Gun state. Writer: sim/combat. Magazine size is the `magazine` stat; the gun itself is HeroDef.weapon.
 */
export interface WeaponState {
  ammo: number;
  reloading: boolean;
  /** True on ticks the gun is in its fire cycle (for animation and audio). */
  firing: boolean;
  /** Combat keeps this set during the melee swing. */
  meleePose?: 'charging' | 'light' | 'heavy' | 'parry';
}

/** One ability slot's state. */
export interface AbilitySlotState {
  readonly ability: AbilityId;
  /** Unlocked for casting. */
  unlocked: boolean;
  /** Upgrade tier bought with AP: 0 (none) to 3. */
  tier: number;
  /** Tick at which the next charge is ready (0 = ready now). */
  readyAt: Tick;
  /** Length in ticks of the cooldown that ends at readyAt (for the HUD sweep). */
  cooldownTicks: number;
  /** Current charges; abilities without charges use 1. */
  charges: number;
}

/**
 * Ability state. Writer: sim/abilities. Slots 0–3 are abilities 1–4; slot 3 is the ultimate.
 */
export interface AbilityState {
  readonly slots: readonly [AbilitySlotState, AbilitySlotState, AbilitySlotState, AbilitySlotState];
  /** Unspent Ability Points. */
  ap: number;
  /** Slot index being cast or channelled, or null. */
  casting: number | null;
  /** True while that cast is a channel. */
  channelling: boolean;
}

/**
 * Level and Seeds. Writer: sim/economy.
 */
export interface Progress {
  level: number;
  /** Molts (boons) earned. */
  molts: number;
  /** Unspent Seeds. */
  seeds: number;
  /** Every Seed ever gained (net worth); used for bounties, scoreboard and telemetry. */
  netWorth: number;
}

/** An owned item. */
export interface OwnedItem {
  readonly item: ItemId;
  /** Last tick of full-price refund during this visit. Cleared on exit. */
  fullRefundUntil?: Tick;
  /** Tick at which the item's active is ready again (0 = ready). */
  readyAt: Tick;
}

/**
 * Items. Writer: sim/items. Twelve base slots accept any category. Extra slots come from TeamState.flexSlots.
 */
export interface Inventory {
  /** Current own shop index in MapData.shops, null outside. Writer: items. */
  shopZone?: number | null;
  readonly items: OwnedItem[];
  /** Item ids bound to item-active keys Z, X, C, V (null = empty). */
  readonly actives: [ItemId | null, ItemId | null, ItemId | null, ItemId | null];
}

/** A hero. Every component is always present. */
export interface HeroEntity extends EntityBase {
  readonly kind: 'hero';
  readonly team: PlayerTeam;
  readonly hero: HeroInfo;
  /** Look pitch (radians). Writer: core, from the command, clamped to CAMERA limits. Yaw is EntityBase.yaw. */
  pitch: number;
  /** Shoulder side of the camera: 1 right, −1 left. Writer: core, toggled by Button.ShoulderSwap. */
  shoulder: 1 | -1;
  /** This tick's command (bots: written by sim/ai; human: passed to step). Writer: core. */
  command: PlayerCommand;
  health: Health;
  stats: StatBlock;
  statuses: StatusInstance[];
  motor: Motor;
  weapon: WeaponState;
  abilities: AbilityState;
  progress: Progress;
  inventory: Inventory;
  /** Permanent boons gained this match (GDD §7.13). Writer: sim/world. Absent until the first one. */
  keepsakes?: Keepsakes;
}

/**
 * A hero's keepsakes. sim/world also sets their sum as the stat source 'world:keepsakes' (one source in the resist
 * and CDR stacks, capped per GDD §7.13).
 */
export interface Keepsakes {
  count: number;
  /** Summed value per stat, after the keepsake caps. */
  totals: Partial<Record<StatId, number>>;
}

/**
 * Unit state. Writer: sim/world (fledglings, Thicket creatures, the Roc) or sim/abilities (summons).
 */
export interface UnitInfo {
  readonly type: UnitType;
  /** Lane for fledglings, else null. */
  readonly lane: LaneId | null;
  /**
   * Hitbox: a capsule of the entity's radius from its feet to this height. Units have no head and can't be beak-shot,
   * except decoys, which use their owner's BodyPlan, head included (GDD §5.4, D-COMBAT-003).
   */
  readonly height: number;
  /**
   * Walls only (SummonEffect.size): a box of width (x), height (y) and depth (z, along `yaw`) standing on `pos`,
   * turned by `yaw`; sim/combat uses it as the hitbox instead of the capsule, so enemy shots stop on it. It blocks
   * shots, not movement: no physics collider (Gale Shield).
   */
  readonly size?: Vec3;
  /** Summons only: the hero that made it, and what kind of summon it is. */
  readonly owner: EntityId | null;
  readonly summon: SummonKind | null;
  /** Current attack target, or null. */
  target: EntityId | null;
  /** True on ticks the unit is attacking (animation). */
  attacking: boolean;
  /** Thicket creatures: index into MapData.thickets of the camp it belongs to and leashes to (GDD §7.8). */
  readonly camp?: number | null;
  /** Dormant: a Thicket camp with no hero within its wake radius, or the Roc before 20:00 (GDD §§7.8, 7.12). */
  asleep?: boolean;
  /** The Roc: below its enrage threshold (GDD §7.12). */
  enraged?: boolean;
}

export interface UnitEntity extends EntityBase {
  readonly kind: 'unit';
  readonly unit: UnitInfo;
  health: Health;
  stats: StatBlock;
  statuses: StatusInstance[];
}

/**
 * Structure state. Writer: sim/world.
 */
export interface StructureInfo {
  readonly type: StructureType;
  readonly lane: LaneId | null;
  /** Patron only: 1 or 2. Everything else stays 1. */
  phase: 1 | 2;
  broodWard?: boolean;
  /** End tick of the invulnerable phase transition. */
  transitionUntil?: Tick;
  /** Current attack target, or null. */
  target: EntityId | null;
  /** Collider and hitbox: a vertical cylinder of this radius and height standing on `pos`. Physics builds it at spawn. */
  readonly body: { readonly radius: number; readonly height: number };
  /** Patron phase 2: the heart-feather weak point (GDD §7.7), world position; null otherwise. */
  weakPoint: { readonly centre: Vec3; readonly radius: number } | null;
  /** Breakables: 'twig', 'woven', 'keepsake' (Nests, GDD §7.9) or 'feeder' (§7.14), for models and drops. Absent for towers. */
  readonly variant?: 'twig' | 'woven' | 'keepsake' | 'feeder';
  /** Placed from a map anchor: index into MapData.nests (Nests) or MapData.interactables (Bell Feeders). */
  readonly anchor?: number;
  /**
   * Breakables only (Nests, Bell Feeders). sim/combat ignores damage by anything `by` excludes, and a melee hit deals
   * `light`/`heavy` instead of the usual amount when set (Feeders: 60 and 120 whatever the hero's stats).
   */
  readonly breakable?: { readonly by: 'any' | 'melee' | 'heavyMelee'; readonly light?: number; readonly heavy?: number };
  /** False: physics builds no collider, so heroes pass through (Twig and Keepsake Nests). Default true. */
  readonly solid?: boolean;
  /** Bell Feeder: the chime lamp is lit this tick (the full-chime window, GDD §7.14). */
  lit?: boolean;
}

export interface StructureEntity extends EntityBase {
  readonly kind: 'structure';
  readonly structure: StructureInfo;
  health: Health;
  stats: StatBlock;
  statuses: StatusInstance[];
}

/**
 * A travelling projectile (bullets with travel time, ability projectiles). Writer: sim/combat.
 */
export interface ProjectileInfo {
  /** Entity credited with its hits. */
  readonly owner: EntityId | null;
  /** What fired it: the owner's gun or an ability/item (by id). */
  readonly source: 'weapon' | 'ability' | 'item' | 'unit' | 'structure';
  readonly ability: AbilityId | null;
  /** Tick at which it expires if it hits nothing. */
  readonly expiresAt: Tick;
}

export interface ProjectileEntity extends EntityBase {
  readonly kind: 'projectile';
  readonly projectile: ProjectileInfo;
}

/**
 * Pickups. Writer: sim/economy for pods; sim/world for everything else.
 * A pod's team is the dead unit's team: an enemy of that team secures it by shooting it, its own team denies it.
 * sim/combat reports bullets that pass through a pod as `projectile.impact` with target = the pod (bullets never stop).
 * Pickups with `melee` set are claimed by a melee hit (D-EP-039: no Interact key); the rest by walking within reach.
 */
export interface PickupInfo {
  readonly type: PickupType;
  /** Runes: which rune; crumbs: which crumb (data ids). Everything else: ''. */
  readonly variant: string;
  /** Pods and seed sprigs: Seed value, fixed at the drop. Others: 0 (the Egg's value is EggState.value). */
  readonly value: number;
  /** Tick at which it vanishes, or null for never. */
  readonly expiresAt: Tick | null;
  /** The Egg: hero carrying it, or null when on the ground. */
  carrier: EntityId | null;
  /**
   * Claimed by melee: 'any' (the Egg: light or heavy) or 'heavy' (runes, Embers). sim/combat includes the pickup in
   * its melee hit test as a sphere of the entity's `radius` and reports it as `melee.target`; it takes no damage and
   * doesn't stop the swing at heroes behind it. sim/world claims it from the event.
   */
  readonly melee?: 'any' | 'heavy';
  /** Not claimable before this tick (the Egg lowering for 10 s, falling Embers, 1 s after an Egg drop). */
  claimableAt?: Tick;
}

export interface PickupEntity extends EntityBase {
  readonly kind: 'pickup';
  readonly pickup: PickupInfo;
}

/**
 * A lasting area (an AreaEffect with a duration). Writer: sim/abilities. Its shape and effects stay private to
 * sim/abilities; `radius` on the entity bounds it for the spatial hash and the renderer.
 */
export type AreaDimensions =
  | { readonly kind: 'sphere'; readonly radius: number }
  | { readonly kind: 'cylinder'; readonly radius: number; readonly half: number }
  | { readonly kind: 'cone'; readonly length: number; readonly cosHalf: number }
  | { readonly kind: 'ring'; readonly inner: number; readonly outer: number; readonly half: number }
  | { readonly kind: 'box'; readonly halfX: number; readonly half: number; readonly halfZ: number };

export interface AreaInfo {
  /** Resolved geometry: half extents in metres, cosHalf is cosine of the cone half-angle. */
  readonly dimensions?: AreaDimensions;
  readonly concealsAlliesOutside?: boolean;
  readonly owner: EntityId | null;
  readonly ability: AbilityId | null;
  readonly shape: AreaShape['kind'];
  readonly expiresAt: Tick;
}

export interface AreaEntity extends EntityBase {
  readonly kind: 'area';
  readonly area: AreaInfo;
}

export type Entity = HeroEntity | UnitEntity | StructureEntity | ProjectileEntity | PickupEntity | AreaEntity;
/** The entity type for a kind, e.g. `EntityOf<'hero'>` is HeroEntity. */
export type EntityOf<K extends EntityKind> = Extract<Entity, { kind: K }>;
/** Entities that can take damage. */
export type Damageable = HeroEntity | UnitEntity | StructureEntity;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** What a spawner passes to `store.spawn`: an entity without the fields the store assigns. */
export type EntityInit = DistributiveOmit<Entity, 'id' | 'removed' | 'seenBy'>;

/**
 * Team-wide state. One record per playable team on SimContext.teams. Each field names its writer.
 */
export interface TeamState {
  readonly team: PlayerTeam;
  /** Flex item slots unlocked for every hero on the team. Writer: sim/economy (from objective events). */
  flexSlots: number;
  /** Tick until which the team holds the Phoenix Ember's buff (0 = none). Writer: sim/world. Stage 3 rule. */
  emberUntil: Tick;
  /**
   * Stage 4 (GDD §7.12): the Rekindle buff from claimed Embers, replacing `emberUntil`'s buff. Writer: sim/world (it
   * grants charges and spends one on each `entity.died` with `revives`). sim/combat reads it to revive in place.
   */
  rekindle?: { until: Tick; charges: number };
}

/** The Golden Egg's state (GDD §7.11). Writer: sim/world. */
export interface EggState {
  /** The Egg pickup while it exists (lowering, on a perch, carried, dropped or rolling), else null. */
  pickup: EntityId | null;
  /** Index into MapData.eggPerches it spawned on; the other perch is the Hatching Stone. */
  perch: number;
  /** Unattended: the tick it starts (or started) rolling toward its Stone, else null. */
  rollsAt: Tick | null;
  /** The tick it starts cooling (45 s after its first pickup), else null. */
  coolsAt: Tick | null;
  /** A delivery in progress (automatic in the Stone's circle, D-EP-039) completes at this tick, else null. */
  deliverUntil: Tick | null;
  /** Its value E now, after cooling (Seeds). */
  value: number;
}

/** Objective timers for the HUD and bots, on SimContext.objectives. Writer: sim/world. null = not scheduled. */
export interface ObjectiveState {
  nextWaveAt: Tick | null;
  eggAt: Tick | null;
  /** The earlier of the rune spots' next spawns (see `runeAt` for each spot). */
  runesAt: Tick | null;
  rocAt: Tick | null;
  /** Per MapData.runeSpots index: next spawn tick, or null while a rune waits there. */
  runeAt?: (Tick | null)[];
  /** Per MapData.thickets index: next spawn tick, or null while the camp is up. */
  campAt?: (Tick | null)[];
  /** Per MapData.nests index: respawn tick, or null while the Nest stands. */
  nestAt?: (Tick | null)[];
  /** Per MapData.interactables index (Berries, Bell Feeders): respawn tick, or null while it is up. */
  interactableAt?: (Tick | null)[];
  egg?: EggState;
}
