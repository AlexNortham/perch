/**
 * The sim's shape: phases, systems, the context every system receives, the config, and the public Sim API.
 */
import type { Controller, EntityId, HeroId, PlayerTeam, Tick, Vec3 } from './base';
import type { HeroCommand } from './command';
import type { EffectRouter } from './effects';
import type { Entity, EntityInit, EntityKind, EntityOf, ObjectiveState, TeamState } from './entity';
import type { EventOf, SimEvent, SimEventType } from './events';
import type { HeroModule } from './heroes';
import type { ItemDef, ItemScores } from './items';
import type { MapData, MapId } from './map';
import type { PhysicsService } from './physics';
import type { StatService } from './stats';
import type { MatchTelemetry } from './telemetry';
import type { SimView } from './view';

/**
 * Tick phases, in order. Each tick: core starts the tick, then for each phase every system that has a handler for it
 * runs, in SYSTEM_ORDER (src/sim/index.ts). Core's own steps sit between phases (see ARCHITECTURE.md):
 *
 *  1. ai         sim/ai: bots write their PlayerCommand from the state the last tick left.
 *     [core]     external commands override; commands latched on heroes; look and shoulder set; pings emitted.
 *  2. movement   sim/physics: hero controllers, displacements, updrafts, climbs. sim/world: unit steering.
 *     [core]     spatial hash rebuilt.
 *  3. abilities  sim/abilities: upgrades, casts, channels, areas, summons, delays, hero hooks. sim/items: item actives.
 *  4. combat     sim/combat: guns (aim ray, fire, reload), melee, parry, projectiles → damage requests.
 *  5. world      sim/world: units and structures pick targets and attack; waves, Egg, runes, Roc, Brood Ward, Patron.
 *  6. damage     sim/combat: resolve this tick's damage requests in order → damage.applied → entity.died.
 *  7. statuses   sim/combat: status timers, periodic effects, expiry; respawns.
 *  8. economy    sim/economy: Seeds, pods, bounties, levels, Molts, flex slots. sim/items: shop, inventory.
 *     [core]     despawns flushed, telemetry sampled, match end checked.
 */
export const PHASES = ['ai', 'movement', 'abilities', 'combat', 'world', 'damage', 'statuses', 'economy'] as const;
export type Phase = (typeof PHASES)[number];

export type SystemName = 'ai' | 'physics' | 'world' | 'abilities' | 'items' | 'combat' | 'economy';

/** A system: handlers for the phases it runs in. Created once per sim by its entry module's factory. */
export interface System {
  readonly name: SystemName;
  readonly phases: { readonly [P in Phase]?: () => void };
  /** Fold private (closure) state into the determinism hash. Optional but encouraged. */
  hash?(h: Hasher): void;
}

/** A system entry module's factory: `export const createXSystem: SystemFactory`. */
export type SystemFactory = (ctx: SimContext) => System;

/** Seeded random numbers. */
export interface Rng {
  readonly name: string;
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  range(min: number, max: number): number;
  /** Uniform integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Shuffles in place and returns the same array. */
  shuffle<T>(items: T[]): T[];
  /** Internal state, for the hash. */
  state(): readonly number[];
}

/**
 * `ctx.rng`. Each system draws only from its own streams: `ctx.rng.stream('combat')`, or per entity
 * `ctx.rng.stream('ai/' + id)`. A stream's sequence depends only on the match seed and its name.
 */
export interface RngStreams {
  readonly seed: number;
  stream(name: string): Rng;
  /** Every created stream's state, sorted by name (for the hash). */
  states(): readonly (readonly [string, readonly number[]])[];
}

/** `ctx.bus`. Synchronous, FIFO, deterministic; see src/sim/core/events.ts. */
export interface EventBus {
  on<T extends SimEventType>(type: T, handler: (event: EventOf<T>) => void): () => void;
  emit(event: SimEvent): void;
}

/** `ctx.store`. */
export interface EntityStore {
  /** Add an entity (id assigned) and emit `entity.spawned`. */
  spawn<K extends EntityKind>(init: Extract<EntityInit, { kind: K }>): EntityOf<K>;
  /** The entity, including one despawned this tick; undefined once it has left the store. */
  get(id: EntityId): Entity | undefined;
  /** The entity if it exists and is of this kind. */
  getKind<K extends EntityKind>(id: EntityId, kind: K): EntityOf<K> | undefined;
  /** Mark for removal; it leaves the store (and `entity.despawned` is emitted) at the end of the tick. */
  despawn(id: EntityId): void;
  /** Live entities (not despawned), ascending id. The array is a snapshot: spawning doesn't change it. */
  all(): readonly Entity[];
  /** Live entities of one kind, ascending id. */
  list<K extends EntityKind>(kind: K): readonly EntityOf<K>[];
}

/** `ctx.spatial`: a uniform XZ grid over live entities, rebuilt after the movement phase. */
export interface SpatialIndex {
  /**
   * Entities whose sphere (pos, radius) overlaps the query sphere, ascending id, written into `out` (cleared first).
   * Positions are as of the last rebuild; entities spawned since are not included.
   */
  query(centre: Vec3, radius: number, out: EntityId[]): EntityId[];
}

/** Streams values into the state hash. */
export interface Hasher {
  num(n: number): void;
  str(s: string): void;
  /** Any plain data: numbers, strings, booleans, null, arrays, Maps, Sets and plain objects (keys sorted). */
  value(v: unknown): void;
}

export interface Clock {
  readonly tick: Tick;
  /** tick / TICK_RATE */
  readonly seconds: number;
}

/** One roster slot. */
export interface RosterSlot {
  readonly team: PlayerTeam;
  readonly hero: HeroId;
  readonly controller: Controller;
}

/** Switches tests and sandboxes need. Each names the system that honours it. */
export interface SimOptions {
  /** Fledgling waves. Default: on for 'main', off for 'arena'. Honoured by sim/world. */
  readonly waves?: boolean;
  /** Both bases, towers and Home Roost; on for standard main-map matches and off for isolated wave/arena fixtures. */
  readonly structures?: boolean;
  /** Menu Practice Hub, distinct from the test sandbox. Enables resettable training targets. */
  readonly practiceHub?: boolean;
  /**
   * Practice Hub only: the human hero's first spawn (feet) and facing, instead of its team spawn; the training
   * targets stay where they are. Swap bird (D-EP-040) starts the new bird where the old one stood. Later respawns use
   * the team spawn. createSim throws if it is set without `practiceHub` or is not finite. Honoured by core.
   */
  readonly practiceStart?: { readonly pos: Vec3; readonly yaw: number };
  /**
   * The zipline start (GDD §3.7, §6.2, D-EP-053, D-ARCH-035): at match start every hero but dummies is already riding
   * its assigned lane's Updraft out from the base-end station. Respawns are unchanged. Default: as `structures`.
   * Honoured by sim/physics.
   */
  readonly laneStart?: boolean;
  /** Thickets, Nests, runes, the Egg and the Roc. Default: as `waves`. Honoured by sim/world. */
  readonly neutrals?: boolean;
  /** Every ability unlocked from the start (ability sandboxes). Default false. Honoured by sim/abilities. */
  readonly unlockAbilities?: boolean;
  /** Seeds each hero starts with; null uses economy data. Honoured by sim/economy. */
  readonly startSeeds?: number | null;
  /**
   * Per-flock bot shopping override for the Build Lab (D-EP-036/037): play round N's scores against round N−1's, or
   * against random buying, in one seeded match. Absent: both flocks use src/sim/data/builds.ts at the difficulty's
   * temperature. Honoured by sim/ai. Not for player-facing matches.
   */
  readonly botShopping?: Partial<Record<PlayerTeam, BotShopping>>;
}

/** How one flock's bots choose purchases (sim/ai). */
export interface BotShopping {
  /** Replaces the data's scores for the heroes listed; others keep the data's. */
  readonly scores?: Readonly<Partial<Record<HeroId, ItemScores>>>;
  /** Softmax temperature; replaces the difficulty's (0 = always the best-scoring item). */
  readonly temperature?: number;
  /** Uniform choice among affordable, buyable items: the random baseline. Ignores scores and temperature. */
  readonly random?: boolean;
}

export interface SimConfig {
  readonly seed: number;
  /** Default 'main'. */
  readonly map?: MapId;
  /** Up to TEAM_SIZE heroes per team, at most one 'human', no hero id twice. */
  readonly roster: readonly RosterSlot[];
  readonly options?: SimOptions;
}

export interface ResolvedSimConfig {
  readonly seed: number;
  readonly map: MapId;
  readonly roster: readonly RosterSlot[];
  readonly options: Required<Omit<SimOptions, 'structures' | 'practiceHub' | 'practiceStart' | 'botShopping'>> &
    Pick<SimOptions, 'structures' | 'practiceHub' | 'practiceStart' | 'botShopping'>;
}

/** What every system receives. Everything a system may touch outside its own state is here. */
export interface SimContext {
  readonly config: ResolvedSimConfig;
  readonly map: MapData;
  /** Every hero module by id (not only those in the match). */
  readonly heroes: Readonly<Record<HeroId, HeroModule>>;
  readonly clock: Clock;
  readonly store: EntityStore;
  readonly bus: EventBus;
  readonly rng: RngStreams;
  readonly spatial: SpatialIndex;
  readonly stats: StatService;
  readonly effects: EffectRouter;
  readonly physics: PhysicsService;
  readonly teams: { readonly [T in PlayerTeam]: TeamState };
  readonly objectives: ObjectiveState;
  /** Items supplies its stable catalogue to the composition root during system creation. */
  readonly itemCatalogue?: ItemDef[];
}

/** The context before physics exists; what `createPhysics` receives. */
export type CoreContext = Omit<SimContext, 'physics'>;

/** The public sim API (src/sim/index.ts `createSim`). */
export interface Sim {
  /** Ticks stepped so far. */
  readonly tick: Tick;
  /** Snapshot of the current tick (built on first read per tick). */
  readonly view: SimView;
  readonly isOver: boolean;
  readonly itemCatalogue: readonly ItemDef[];
  readonly winner: PlayerTeam | null;
  /**
   * Advance one tick. `commands` drive heroes and override bots for that tick (later entries win); a hero with
   * neither a command nor a bot that wrote one repeats its previous command with no presses. Does nothing once the
   * match is over.
   */
  step(commands?: readonly HeroCommand[]): void;
  /** Events emitted during the last step (empties the log). Call after every step. */
  drainEvents(): SimEvent[];
  /** Hex digest of the whole sim state (determinism test). */
  hash(): string;
  telemetry(): MatchTelemetry;
  /** Tests and tools only. The client reads `view` and `drainEvents()` and never touches the context. */
  readonly ctx: SimContext;
}
