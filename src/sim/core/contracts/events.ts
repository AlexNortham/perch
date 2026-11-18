/**
 * Every sim event. Events are facts (past tense, already true when emitted). Requests to another system go through
 * ctx.effects or a service, never through an event. Each event names its single emitter and its known consumers;
 * the client (vfx, ui, audio) may read any of them from `sim.drainEvents()`.
 *
 * Positions in events are copies taken at emission, so they stay valid after the entity moves or is gone.
 */
import type {
  AbilityId,
  EntityId,
  HeroId,
  ItemId,
  PlayerTeam,
  StatusId,
  Team,
  Tick,
  Vec3,
} from './base';
import type { PingKind } from './command';
import type { DamageType, EffectVia } from './effects';
import type { EntityKind, PickupType, StructureType, UnitType } from './entity';
import type { MapId } from './map';

/** Emitter: core (createSim). Consumers: telemetry, client. */
export interface MatchStartedEvent {
  readonly type: 'match.started';
  readonly seed: number;
  readonly map: MapId;
}

/**
 * Emitter: sim/world when a Patron dies in phase 2, or core when the human concedes. Consumers: core (ends the match:
 * `isOver`, no more steps), telemetry, client.
 */
export interface MatchEndedEvent {
  readonly type: 'match.ended';
  readonly winner: PlayerTeam;
  readonly reason: 'patron' | 'concede';
}

/**
 * Emitter: core store, on spawn (components are in place). Consumers: every system that attaches state or colliders
 * (physics creates colliders; owners initialise their components), client.
 */
export interface EntitySpawnedEvent {
  readonly type: 'entity.spawned';
  readonly id: EntityId;
  readonly kind: EntityKind;
  readonly team: Team;
}

/** Emitter: core store, at the end of the tick the entity was despawned. Consumers: systems with private state. */
export interface EntityDespawnedEvent {
  readonly type: 'entity.despawned';
  readonly id: EntityId;
  readonly kind: EntityKind;
}

/** Emitter: sim/combat. Consumers: client (tracers, muzzle flash, gun audio), sim/ai (threat). */
export interface WeaponFiredEvent {
  readonly type: 'weapon.fired';
  readonly shooter: EntityId;
  readonly muzzle: Vec3;
  /** Unit direction toward the aim point (before per-pellet spread). */
  readonly dir: Vec3;
}

/** Emitter: sim/combat. Consumers: client (animation, audio). `done` false = started, true = finished. */
export interface WeaponReloadEvent {
  readonly type: 'weapon.reload';
  readonly hero: EntityId;
  readonly done: boolean;
}

/**
 * A bullet or projectile hit something, including a pod it passed through (target = the pod; bullets never stop on
 * pods). Emitter: sim/combat. Consumers: sim/economy (pod secure or deny), client (impacts, beak-shot tick).
 */
export interface ProjectileImpactEvent {
  readonly type: 'projectile.impact';
  readonly owner: EntityId | null;
  readonly pos: Vec3;
  readonly normal: Vec3;
  /** Entity hit, or null for the world. */
  readonly target: EntityId | null;
  readonly beakShot: boolean;
}

/**
 * A light or heavy melee swing and what it struck: a hero, unit, structure, Nest, pod or the Phoenix Ember.
 * Emitter: sim/combat. Consumers: sim/economy (melee on a pod), sim/world (heavy melee on the Ember claims it),
 * sim/items (meleeHit triggers), client.
 */
export interface MeleeEvent {
  readonly type: 'melee';
  readonly attacker: EntityId;
  readonly heavy: boolean;
  /** Entity struck, or null for a whiff. */
  readonly target: EntityId | null;
  /** The target parried it (the attacker is stunned by combat rules). */
  readonly parried: boolean;
}

/** Emitter: sim/combat. Consumers: client (the "clink" and flash on success, a whoosh on a whiff), sim/ai. */
export interface ParryEvent {
  readonly type: 'parry';
  readonly hero: EntityId;
  readonly outcome: 'start' | 'success' | 'whiff';
  /** The parried attacker (success only). */
  readonly attacker: EntityId | null;
}

/**
 * The end of the damage pipeline (GDD §5.2 step 9): shields and hp changed. Emitter: sim/combat (damage phase).
 * Consumers: sim/combat (assist ledger), sim/items (procs), sim/world (Hawk aggro), sim/ai (threat), telemetry,
 * client (damage numbers, hit markers, beak-shot tick).
 */
export interface DamageAppliedEvent {
  readonly type: 'damage.applied';
  readonly source: EntityId | null;
  readonly sourceTeam: Team;
  readonly target: EntityId;
  readonly targetKind: EntityKind;
  /** Damage after step 7, including what shields absorbed (lifesteal and damage numbers use it). */
  readonly amount: number;
  /** Part of `amount` absorbed by shields. */
  readonly absorbed: number;
  readonly damageType: DamageType;
  readonly via: EffectVia;
  readonly ability: AbilityId | null;
  readonly item: ItemId | null;
  readonly beakShot: boolean;
  /** A gun hit on the Patron's weak point (orange hit marker). */
  readonly weakPoint: boolean;
  /** Came from a trigger (never fires triggers). */
  readonly proc: boolean;
  /** This hit killed the target (an `entity.died` follows). */
  readonly lethal: boolean;
  readonly pos: Vec3;
}

/** Emitter: sim/combat. Consumers: telemetry, client (heal numbers). */
export interface HealAppliedEvent {
  readonly type: 'heal.applied';
  readonly source: EntityId | null;
  readonly target: EntityId;
  readonly amount: number;
}

/** Emitter: sim/combat. Consumers: client (status icons, VFX), sim/ai. */
export interface StatusAppliedEvent {
  readonly type: 'status.applied';
  readonly target: EntityId;
  readonly status: StatusId;
  readonly source: EntityId | null;
  readonly stacks: number;
  readonly expiresAt: Tick;
}

/** Emitter: sim/combat. Consumers: client. */
export interface StatusEndedEvent {
  readonly type: 'status.ended';
  readonly target: EntityId;
  readonly status: StatusId;
  readonly reason: 'expired' | 'cleansed' | 'death';
}

/**
 * Something with health died. Kill credit lives here. Emitter: sim/combat (damage phase).
 * Consumers: sim/economy (bounties, comeback bounty, pods, last hits, Seed shares), sim/world (structure falls, Roc,
 * Patron), sim/abilities and sim/items (on-kill effects), sim/ai, telemetry, client (kill feed, audio).
 */
export interface EntityDiedEvent {
  readonly type: 'entity.died';
  readonly victim: EntityId;
  readonly victimKind: EntityKind;
  readonly victimTeam: Team;
  /** HeroId, UnitType or StructureType of the victim. */
  readonly victimType: HeroId | UnitType | StructureType;
  /** The entity that dealt the killing blow, or null for the world. */
  readonly killer: EntityId | null;
  /** The hero credited with the kill: the killer if a hero, else the owner of the killing summon or projectile. */
  readonly creditHero: EntityId | null;
  /** Other heroes on the credited side who damaged a hero victim within the assist window (ascending ids). */
  readonly assisters: readonly EntityId[];
  readonly via: EffectVia;
  readonly pos: Vec3;
}

/** Emitter: sim/combat. Consumers: sim/physics (re-seat the controller), client, sim/ai. */
export interface HeroRespawnedEvent {
  readonly type: 'hero.respawned';
  readonly hero: EntityId;
  readonly pos: Vec3;
}

export type MovementAction =
  | 'jump'
  | 'dashJump'
  | 'dash'
  | 'land'
  | 'slide'
  | 'mantle'
  | 'updraftOn'
  | 'updraftOff'
  | 'updraftBoost'
  | 'climbOn'
  | 'climbOff';

/** Emitter: sim/physics. Consumers: client (FOV kick on dash, footstep and whoosh audio, dust VFX). */
export interface MovementEvent {
  readonly type: 'movement';
  readonly hero: EntityId;
  readonly action: MovementAction;
}

/** Emitter: sim/abilities. `stage` start = wind-up began, land = effects applied, end = channel finished or cancelled. */
export interface AbilityEvent {
  readonly type: 'ability';
  readonly caster: EntityId;
  readonly slot: number;
  readonly ability: AbilityId;
  readonly stage: 'start' | 'land' | 'end' | 'interrupted';
  readonly point: Vec3;
}

/** Emitter: sim/abilities. Consumers: client (HUD), telemetry. */
export interface AbilityUpgradedEvent {
  readonly type: 'ability.upgraded';
  readonly hero: EntityId;
  readonly slot: number;
  /** New tier 1–3, or 0 when the slot was just unlocked. */
  readonly tier: number;
}

/** Emitter: sim/items. Consumers: telemetry, client (shop, audio), sim/ai. */
export interface ItemBoughtEvent {
  readonly type: 'item.bought';
  readonly hero: EntityId;
  readonly item: ItemId;
  readonly cost: number;
}

/** Emitter: sim/items. Consumers: telemetry, client. */
export interface ItemSoldEvent {
  readonly type: 'item.sold';
  readonly hero: EntityId;
  readonly item: ItemId;
  readonly refund: number;
}

/** Emitter: sim/items. Consumers: client (VFX, audio). */
export interface ItemActivatedEvent {
  readonly type: 'item.activated';
  readonly hero: EntityId;
  readonly item: ItemId;
}

export type SeedReason =
  | 'lastHit'
  | 'pod'
  | 'share'
  | 'heroKill'
  | 'assist'
  | 'objective'
  | 'egg'
  | 'nest'
  | 'thicket'
  | 'passive'
  | 'effect';

/** Emitter: sim/economy. Consumers: client (Seed counter, pop audio), telemetry. */
export interface SeedsGainedEvent {
  readonly type: 'seeds.gained';
  readonly hero: EntityId;
  readonly amount: number;
  readonly reason: SeedReason;
}

/** Emitter: sim/economy. Consumers: client ("secured" pop or deny), telemetry (last hits, denies). */
export interface PodResolvedEvent {
  readonly type: 'pod.resolved';
  readonly pod: EntityId;
  readonly by: EntityId;
  readonly outcome: 'secured' | 'denied';
  readonly pos: Vec3;
}

/**
 * Emitter: sim/economy. Consumers: sim/abilities (adds `ap`, unlocks `unlockSlot`), client, telemetry.
 */
export interface HeroLevelEvent {
  readonly type: 'hero.level';
  readonly hero: EntityId;
  readonly level: number;
  /** Ability Points granted at this level. */
  readonly ap: number;
  /** Ability slot unlocked at this level, or null. */
  readonly unlockSlot: number | null;
}

/** Emitter: sim/economy. Consumers: sim/items, client. */
export interface FlexSlotsEvent {
  readonly type: 'flexSlots';
  readonly team: PlayerTeam;
  readonly slots: number;
}

/** Emitter: sim/world. Consumers: client (audio cue), telemetry. */
export interface WaveSpawnedEvent {
  readonly type: 'wave.spawned';
  readonly wave: number;
}

/** Emitter: sim/world (Patron phase 2, Brood Ward up/down). Consumers: client, sim/ai. */
export interface StructureStateEvent {
  readonly type: 'structure.state';
  readonly structure: EntityId;
  readonly state: 'phase2' | 'wardUp' | 'wardDown' | 'vulnerable';
}

export type ObjectiveAction =
  | 'eggSpawned'
  | 'eggTaken'
  | 'eggDropped'
  | 'eggDelivered'
  | 'rocSpawned'
  | 'emberClaimed'
  | 'runeSpawned'
  | 'runeTaken';

/**
 * Emitter: sim/world. Consumers: sim/economy (Egg payout), sim/ai, telemetry, client (announcer, minimap).
 * Structure falls and Roc/Nest/Thicket deaths are `entity.died`, not this.
 */
export interface ObjectiveEvent {
  readonly type: 'objective';
  readonly action: ObjectiveAction;
  /** The hero involved (taker, carrier, deliverer, claimer), or null. */
  readonly hero: EntityId | null;
  readonly team: Team;
  /** The pickup entity involved (Egg, Ember, rune), or null. */
  readonly pickup: EntityId | null;
  readonly pickupType: PickupType | null;
  readonly pos: Vec3;
}

/** Emitter: core (from PlayerCommand.ping). Consumers: client (minimap, audio), sim/ai. */
export interface PingEvent {
  readonly type: 'ping';
  readonly by: EntityId;
  readonly team: PlayerTeam;
  readonly kind: PingKind;
  readonly pos: Vec3;
  readonly target: EntityId | null;
}

export type SimEvent =
  | MatchStartedEvent
  | MatchEndedEvent
  | EntitySpawnedEvent
  | EntityDespawnedEvent
  | WeaponFiredEvent
  | WeaponReloadEvent
  | ProjectileImpactEvent
  | MeleeEvent
  | ParryEvent
  | DamageAppliedEvent
  | HealAppliedEvent
  | StatusAppliedEvent
  | StatusEndedEvent
  | EntityDiedEvent
  | HeroRespawnedEvent
  | MovementEvent
  | AbilityEvent
  | AbilityUpgradedEvent
  | ItemBoughtEvent
  | ItemSoldEvent
  | ItemActivatedEvent
  | SeedsGainedEvent
  | PodResolvedEvent
  | HeroLevelEvent
  | FlexSlotsEvent
  | WaveSpawnedEvent
  | StructureStateEvent
  | ObjectiveEvent
  | PingEvent;

export type SimEventType = SimEvent['type'];
export type EventOf<T extends SimEventType> = Extract<SimEvent, { type: T }>;
