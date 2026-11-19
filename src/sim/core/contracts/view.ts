/**
 * The read-only view the client renders from. `sim.view` is a snapshot of one tick: plain copies, never live
 * references, so the client can keep the previous and current views and interpolate between them by entity id.
 * Built by core from the components (each flag's source is noted on ViewFlag).
 */
import type { Controller, EntityId, HeroId, ItemId, PlayerTeam, StatusId, Team, Tick, Vec3 } from './base';
import type { MovementModeKind } from './effects';
import type { WeaponState, AbilitySlotState, AreaInfo, EntityKind, Keepsakes, ObjectiveState, OwnedItem, ProjectileInfo, StructureInfo } from './entity';
import type { MapId } from './map';

/** Animation and state bits on EntityView.flags. */
export const ViewFlag = {
  /** Motor.grounded */
  Grounded: 0x1,
  /** Motor.crouching */
  Crouching: 0x2,
  /** Motor.sliding */
  Sliding: 0x4,
  /** Motor.dashing */
  Dashing: 0x8,
  /** Motor.mantling */
  Mantling: 0x10,
  /** Motor.updraft !== null */
  OnUpdraft: 0x20,
  /** Motor.climb !== null */
  Climbing: 0x40,
  /** AbilityState.casting !== null */
  Casting: 0x80,
  /** AbilityState.channelling */
  Channelling: 0x100,
  /** WeaponState.firing */
  Firing: 0x200,
  /** WeaponState.reloading */
  Reloading: 0x400,
  /** UnitInfo.attacking, or a structure with a target */
  Attacking: 0x800,
  /** Health.dead */
  Dead: 0x1000,
  /** Condition stunned */
  Stunned: 0x2000,
  /** Condition silenced */
  Silenced: 0x4000,
  /** Condition revealed */
  Revealed: 0x8000,
  /** Condition invisible */
  Invisible: 0x10000,
  /** Condition invulnerable */
  Invulnerable: 0x20000,
  /** Pickup carried (the Egg) */
  Carried: 0x40000,
  /** Motor.knockedUp */
  KnockedUp: 0x80000,
  /** Condition intangible */
  Intangible: 0x100000,
  /** Condition eggCarrier */
  EggCarrier: 0x200000,
  /** StructureInfo.weakPoint !== null */
  WeakPoint: 0x400000,
  Meleeing: 0x800000,
  Aiming: 0x1000000,
  /** UnitInfo.asleep: the Roc before it is woken, or after it resets (GDD §7.12). */
  Asleep: 0x2000000,
  /** UnitInfo.enraged: the Roc below its enrage threshold (GDD §7.12). */
  Enraged: 0x4000000,
  /** StructureInfo.lit: a Bell Feeder's chime lamp is lit (GDD §7.14). */
  Lit: 0x8000000,
} as const;

export interface EntityView {
  readonly id: EntityId;
  readonly kind: EntityKind;
  readonly team: Team;
  /** HeroId, UnitType (SummonKind for summons), StructureType or PickupType; the area shape for areas; '' for projectiles. */
  readonly type: string;
  readonly pos: Vec3;
  readonly vel: Vec3;
  readonly yaw: number;
  /** Heroes' look pitch; 0 otherwise. */
  readonly pitch: number;
  readonly radius: number;
  /** 0 for entities without health. */
  readonly hp: number;
  readonly maxHp: number;
  /** Talon shield + Song shield + barrier. */
  readonly shield: number;
  /** ViewFlag bits. */
  readonly flags: number;
  /** Heroes: Motor.mode (glide, flight, cling, toboggan, burrow) or null. */
  readonly mode: MovementModeKind | null;
  readonly meleePose?: WeaponState['meleePose'];
  /** Heroes: AbilityState.casting (slot 0–3) while casting or channelling, so the rig plays that slot's pose. */
  readonly castSlot?: number;
  /** Pickups: PickupInfo.variant (the rune). Structures: StructureInfo.variant (the Nest kind). Absent when ''. */
  readonly variant?: string;
  /** Thicket creatures: UnitInfo.camp, the index into MapData.thickets. */
  readonly camp?: number;
  /** SeenBy bits: which flocks can see it (minimap, outlines). */
  readonly seenBy: number;
  /** Full minimap visibility (world-visible bits plus map-only reveals). */
  readonly mapSeenBy?: number;
  readonly area?: Readonly<AreaInfo>;
  readonly projectile?: Readonly<ProjectileInfo>;
  readonly expiresAt?: Tick | null;
  readonly structure?: Readonly<StructureInfo>;
  readonly statuses?: readonly StatusView[];
}

export interface StatusView {
  readonly id: StatusId;
  readonly name: string;
  readonly negative: boolean;
  readonly stacks: number;
  readonly expiresAt: Tick;
}

/** Per-hero detail for the HUD and scoreboard. */
export interface HeroView {
  readonly id: EntityId;
  readonly heroId: HeroId;
  readonly team: PlayerTeam;
  readonly slot: number;
  readonly controller: Controller;
  readonly level: number;
  readonly seeds: number;
  readonly netWorth: number;
  readonly ap: number;
  readonly kills: number;
  readonly deaths: number;
  readonly assists: number;
  readonly lastHits: number;
  readonly denies: number;
  readonly ammo: number;
  readonly magazine: number;
  readonly shopZone?: number | null;
  /** Camera and input use the same sight scale. */
  readonly aimZoom?: number;
  readonly stamina: number;
  readonly staminaMax: number;
  readonly dashJumpReady?: boolean;
  /** Motor.updraftInReach !== null: the HUD shows the hold-Jump prompt (D-EP-039). */
  readonly updraftInReach?: boolean;
  /** Keepsake count and per-stat totals for the HUD (GDD §7.13); absent before the first. */
  readonly keepsakes?: Readonly<Keepsakes>;
  readonly respawnAt: Tick | null;
  readonly talonShield: number;
  readonly songShield: number;
  readonly barrier: number;
  readonly shoulder: 1 | -1;
  readonly abilities: readonly (Readonly<AbilitySlotState> & { readonly nextUpgradeCost?: number | null })[];
  readonly items: readonly Readonly<OwnedItem>[];
  readonly actives: readonly (ItemId | null)[];
  readonly statuses: readonly StatusView[];
}

export interface TeamView {
  readonly team: PlayerTeam;
  readonly kills: number;
  readonly netWorth: number;
  readonly flexSlots: number;
  readonly emberUntil: Tick;
  /** TeamState.rekindle (GDD §7.12), absent when the flock never held it. */
  readonly rekindle?: { readonly until: Tick; readonly charges: number };
}

export interface SimView {
  readonly tick: Tick;
  /** tick / TICK_RATE */
  readonly seconds: number;
  readonly map: MapId;
  /** The human's hero, or null in an all-bot match. */
  readonly localHero: EntityId | null;
  /** Every entity, ascending id. */
  readonly entities: readonly EntityView[];
  /** Every hero, in roster order. */
  readonly heroes: readonly HeroView[];
  readonly teams: { readonly dawn: TeamView; readonly dusk: TeamView };
  readonly objectives: Readonly<ObjectiveState>;
  readonly over: boolean;
  readonly winner: PlayerTeam | null;
}
