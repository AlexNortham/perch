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
  /** Combat sets this on instantaneous gun rays. */
  readonly hitscan?: boolean;
  readonly muzzle: Vec3;
  /** Unit direction toward the aim point (before per-pellet spread). */
  readonly dir: Vec3;
}

export interface HitscanTracesEvent {
  /** Resolved rays for this trigger pull, in pellet order. Even misses have their true range endpoint. */
  readonly type: 'weapon.traces';
  readonly shooter: EntityId;
  readonly muzzle: Vec3;
  readonly ends: readonly Vec3[];
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
  /**
   * How it was fired (the cause's via): 'weapon' for gun bullets, hitscan included; 'ability' or 'item' for those
   * projectiles. sim/economy counts only 'weapon' impacts on pods (GDD §8.2: abilities don't). Combat sets it from
   * W3; until then absent means 'weapon'.
   */
  readonly via?: EffectVia;
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
  /**
   * Where it landed: the hit point for gun and melee hits; otherwise the damage effect's `target.point` (for areas,
   * DoTs and most abilities, the target's feet).
   */
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
  /**
   * Hero victims only: the credited side's other heroes who, within the 12 s assist window, damaged the victim, or
   * healed, shielded or buffed one who did or the killer (GDD §8.3, D-COMBAT-007). Ascending ids. Empty for other
   * victims (economy shares those among heroes within 40 m).
   */
  readonly assisters: readonly EntityId[];
  /** Credited lethal hit was a beak shot; kill feed can retain this after despawn. */
  readonly beakShot?: boolean;
  readonly via: EffectVia;
  readonly pos: Vec3;
  /**
   * Hero victims: its flock's Rekindle will revive it in place (GDD §7.12). Combat sets it when TeamState.rekindle
   * has a charge and this hero hasn't revived under it; world spends the charge on this event; economy pays no
   * bounty and telemetry counts no kill. On-kill item and ability effects still trigger.
   */
  readonly revives?: boolean;
}

/** Emitter: sim/combat. Consumers: sim/physics (re-seat the controller), client, sim/ai. */
export interface HeroRespawnedEvent {
  readonly type: 'hero.respawned';
  readonly hero: EntityId;
  readonly pos: Vec3;
  /** Revived where it fell by Rekindle (GDD §7.12), not at the Home Roost. */
  readonly revived?: boolean;
}

export type MovementAction =
  | 'jump'
  | 'airJump'
  | 'wallJump'
  | 'downDash'
  | 'mantleGlide'
  | 'dashJump'
  | 'dash'
  | 'land'
  | 'slide'
  | 'mantle'
  | 'updraftOn'
  | 'updraftOff'
  | 'updraftBoost'
  | 'climbOn'
  | 'climbOff'
  /** A displacement (push, pull, knock-up, along) started; sim/abilities ends the hero's channel (GDD §3.9). */
  | 'displaced'
  /** A displaced hero hit a wall hard enough to slam (DisplaceEffect.onWall fired). */
  | 'wallSlam'
  /** A teleport moved the hero. */
  | 'teleport';

/**
 * Emitter: sim/physics. Consumers: client (FOV kick on dash, footstep and whoosh audio, dust VFX), sim/abilities
 * ('displaced').
 */
export interface MovementEvent {
  readonly type: 'movement';
  readonly hero: EntityId;
  readonly action: MovementAction;
  /**
   * Set when the move turned the hero (a teleport with face 'target'). Core re-latches yaw from the command every
   * tick, so the hero's controller adopts it: the client's input (src/client/app does this) and sim/ai for bots.
   */
  readonly yaw?: number;
}

/**
 * A tether (TetherEffect) linked two entities or broke. Emitter: sim/abilities. Consumers: client (draws the link
 * from 'start' to 'end').
 */
export interface TetherEvent {
  readonly type: 'tether';
  readonly source: EntityId;
  readonly target: EntityId;
  readonly ability: AbilityId | null;
  /** 'end' covers expiry, breaking beyond breakDistance and either end dying. */
  readonly stage: 'start' | 'end';
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

export interface PatronDepletedEvent {
  /** Combat floors phase-one Patron HP at one and emits once; world immediately gates and starts transition. */
  readonly type: 'patron.depleted';
  readonly structure: EntityId;
}

export interface StructureAttackEvent {
  readonly type: 'structure.attack';
  readonly structure: EntityId;
  readonly attack: 'bolt' | 'beam' | 'stomp' | 'pulse' | 'volley' | 'screech' | 'rain' | 'gale' | 'transition';
  readonly origin: Vec3;
  readonly point: Vec3;
  readonly impactAt: Tick;
}

/**
 * A Thicket creature's or the Roc's attack (GDD §§7.8, 7.12), emitted when its wind-up starts so the client can
 * telegraph it and bots can dodge. Damage still arrives through the pipeline at `impactAt`. Emitter: sim/world.
 * Consumers: client (VFX, audio), sim/ai.
 */
export interface UnitAttackEvent {
  readonly type: 'unit.attack';
  readonly unit: EntityId;
  /** bite (all biters), dashBite (weasel), lash and spit (toad), slam (badger), rake, flap, shriek (Roc). */
  readonly attack: 'bite' | 'dashBite' | 'lash' | 'spit' | 'slam' | 'rake' | 'flap' | 'shriek';
  readonly origin: Vec3;
  readonly point: Vec3;
  readonly impactAt: Tick;
}

/**
 * A dormant camp creature or the Roc woke, went back to sleep (leash reset), or the Roc enraged (the map-wide roar).
 * Emitter: sim/world. Consumers: client, sim/ai.
 */
export interface UnitStateEvent {
  readonly type: 'unit.state';
  readonly unit: EntityId;
  readonly state: 'awake' | 'asleep' | 'enraged';
}

export type ObjectiveAction =
  /** Starts lowering from the canopy (not claimable until EggState/PickupInfo.claimableAt). */
  | 'eggSpawned'
  /** Picked up by a melee hit (D-EP-039). */
  | 'eggTaken'
  | 'eggDropped'
  /** Unattended: starts rolling toward its Hatching Stone. */
  | 'eggRolling'
  /** Cooled to nothing and cracked. */
  | 'eggSpoiled'
  /** `value` is E after cooling and the comeback factor; economy hatches the golden pods from it. */
  | 'eggDelivered'
  /** The Roc wakes (20:00, then each respawn). */
  | 'rocSpawned'
  /** One Ember landed at `pos` (three per Roc kill). */
  | 'emberDropped'
  /** `hero` claimed one by heavy melee. */
  | 'emberClaimed'
  | 'runeSpawned'
  /** Claimed by heavy melee; `variant` is the rune. */
  | 'runeTaken'
  /** A Thicket camp (`camp`) spawned or respawned its creatures. */
  | 'campSpawned'
  /** Its last creature died; `hero` landed the blow. */
  | 'campCleared'
  /** `hero` gained `value` keepsakes; `variant` is the last one's stat. */
  | 'keepsakeGained'
  /** A Berry was eaten by `hero`. */
  | 'berryEaten';

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
  /** Camp actions: index into MapData.thickets. */
  readonly camp?: number;
  /** Runes: the rune id. Keepsakes: the stat. */
  readonly variant?: string;
  /** eggDelivered: the Egg's value E in Seeds. keepsakeGained: how many. */
  readonly value?: number;
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
  | HitscanTracesEvent
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
  | TetherEvent
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
  | PatronDepletedEvent
  | StructureAttackEvent
  | StructureStateEvent
  | UnitAttackEvent
  | UnitStateEvent
  | ObjectiveEvent
  | PingEvent;

export type SimEventType = SimEvent['type'];
export type EventOf<T extends SimEventType> = Extract<SimEvent, { type: T }>;
