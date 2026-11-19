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
import type { StatBlock } from './stats';
import type { StatusInstance } from './statuses';

export type EntityKind = 'hero' | 'unit' | 'structure' | 'projectile' | 'pickup' | 'area';

/**
 * Non-hero units (GDD §7): fledglings (Scrappers, Slingers) march the lanes; Thicket creatures (beetles, weasels,
 * badgers and cubs) and the Roc are neutral; summons belong to a hero.
 */
export type UnitType = 'scrapper' | 'slinger' | 'beetle' | 'weasel' | 'badger' | 'cub' | 'roc' | 'summon';
/** Thicket (neutral camp) tiers (GDD §7.8). */
export type ThicketTier = 1 | 2 | 3;

/** Bits for EntityBase.seenBy. */
export const SeenBy = { dawn: 0x1, dusk: 0x2, all: 0x3 } as const;
/** Sentinel Hawk, Stilt Heron, Nest Warden, Roost Shrine, Patron (Great Owl / Elder Raven), and neutral Nests. */
export type StructureType = 'hawk' | 'heron' | 'warden' | 'shrine' | 'patron' | 'nest';
/** Seed pod (last-hit orb), Feather rune, the Golden Egg, the Phoenix Ember. */
export type PickupType = 'pod' | 'rune' | 'egg' | 'ember';

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
}

/**
 * Gun state. Writer: sim/combat. Magazine size is the `magazine` stat; the gun itself is HeroDef.weapon.
 */
export interface WeaponState {
  ammo: number;
  reloading: boolean;
  /** True on ticks the gun is in its fire cycle (for animation and audio). */
  firing: boolean;
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
  /** Tick at which the item's active is ready again (0 = ready). */
  readyAt: Tick;
}

/**
 * Items. Writer: sim/items. Slots are counted per category; flex slots come from TeamState.flexSlots.
 */
export interface Inventory {
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
  /** Current attack target, or null. */
  target: EntityId | null;
  /** Collider and hitbox: a vertical cylinder of this radius and height standing on `pos`. Physics builds it at spawn. */
  readonly body: { readonly radius: number; readonly height: number };
  /** Patron phase 2: the heart-feather weak point (GDD §7.7), world position; null otherwise. */
  weakPoint: { readonly centre: Vec3; readonly radius: number } | null;
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
 * Pickups. Writer: sim/economy for pods; sim/world for runes, the Egg and the Ember.
 * A pod's team is the dead unit's team: an enemy of that team secures it by shooting it, its own team denies it.
 * sim/combat reports bullets that pass through a pod as `projectile.impact` with target = the pod (bullets never stop).
 * The Ember is a valid heavy-melee target; sim/world claims it from the `melee` event.
 */
export interface PickupInfo {
  readonly type: PickupType;
  /** Runes: which rune (data id). Everything else: ''. */
  readonly variant: string;
  /** Pods: Seed value. Others: 0. */
  readonly value: number;
  /** Tick at which it vanishes, or null for never. */
  readonly expiresAt: Tick | null;
  /** The Egg: hero carrying it, or null when on the ground. */
  carrier: EntityId | null;
}

export interface PickupEntity extends EntityBase {
  readonly kind: 'pickup';
  readonly pickup: PickupInfo;
}

/**
 * A lasting area (an AreaEffect with a duration). Writer: sim/abilities. Its shape and effects stay private to
 * sim/abilities; `radius` on the entity bounds it for the spatial hash and the renderer.
 */
export interface AreaInfo {
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
  /** Tick until which the team holds the Phoenix Ember's buff (0 = none). Writer: sim/world. */
  emberUntil: Tick;
}

/** Objective timers for the HUD and bots, on SimContext.objectives. Writer: sim/world. null = not scheduled. */
export interface ObjectiveState {
  nextWaveAt: Tick | null;
  eggAt: Tick | null;
  runesAt: Tick | null;
  rocAt: Tick | null;
}
