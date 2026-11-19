/**
 * Composition root of the sim. Owner: Technical Architect. Wires every system's entry module in phase order; system
 * owners never need to edit this file. See docs/ARCHITECTURE.md.
 */
import {
  CONCEDE_AFTER_SECONDS,
  PING_LIMIT,
  PING_WINDOW_SECONDS,
  SPATIAL_CELL_SIZE,
  TEAM_SIZE,
  TRAINING_TARGET,
  TICK_RATE,
} from './data/core';
import { Button, HERO_IDS, IDLE_COMMAND, PHASES } from './core/contracts';
import type {
  AbilityDef,
  AbilitySlotState,
  BotDifficulty,
  CoreContext,
  EntityId,
  HeroEntity,
  HeroId,
  Phase,
  PlayerCommand,
  PlayerTeam,
  ResolvedSimConfig,
  RosterSlot,
  Sim,
  SimConfig,
  SimContext,
  SimEvent,
  SimView,
  System,
  Tick,
} from './core/contracts';
import { clampPitch } from './core/aim';
import { createEffectRouter } from './core/effects';
import { createBus } from './core/events';
import { createHasher } from './core/hash';
import { clamp, copy, ticks, vec3 } from './core/math';
import { createRng, createRngStreams } from './core/rng';
import { createSpatialHash } from './core/spatial';
import { createStatService } from './core/stats';
import { createStore } from './core/store';
import { createTelemetry } from './core/telemetry';
import { buildView } from './core/view';
import { createAbilitySystem } from './abilities';
import { createAiSystem, pickBotHero } from './ai';
import { createCombatSystem } from './combat';
import { createEconomySystem } from './economy';
import { HEROES } from './heroes/registry';
import { createItemSystem } from './items';
import { createPhysics } from './physics';
import { createWorldSystem } from './world';
import { loadMap } from './world/map';

const MAX_HEROES = TEAM_SIZE * 2;
const TURN = Math.PI * 2;
const ABILITY_SLOTS = 4;

type LatchedCommand = { -readonly [K in keyof PlayerCommand]: PlayerCommand[K] };

const finite = (v: number, fallback: number): number => (Number.isFinite(v) ? v : fallback);
const isFiniteVec = (v: { x: number; y: number; z: number }): boolean =>
  Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

/**
 * Copy `src` into the hero's latch with every field made safe (D-ARCH-011): axes finite and within ±1; look angles
 * finite (else the previous ones are kept), yaw wrapped to ±π, pitch clamped; button bits integral; an upgrade slot
 * outside 0–3 and a ping at a non-finite point dropped.
 */
function latchCommand(into: LatchedCommand, src: PlayerCommand): void {
  const yaw = finite(src.yaw, into.yaw);
  const up = src.upgrade;
  into.right = clamp(finite(src.right, 0), -1, 1);
  into.forward = clamp(finite(src.forward, 0), -1, 1);
  into.yaw = Math.abs(yaw) > Math.PI ? yaw - TURN * Math.round(yaw / TURN) : yaw;
  into.pitch = clampPitch(finite(src.pitch, into.pitch));
  into.held = src.held | 0;
  into.pressed = src.pressed | 0;
  into.upgrade = typeof up === 'number' && Number.isInteger(up) && up >= 0 && up < ABILITY_SLOTS ? up : null;
  into.buy = src.buy;
  into.sell = src.sell;
  into.ping = src.ping && isFiniteVec(src.ping.pos) ? src.ping : null;
  into.concede = src.concede === true;
  if (src.sight && isFiniteVec(src.sight.origin) && isFiniteVec(src.sight.dir)) {
    into.sight = { origin: copy(src.sight.origin), dir: copy(src.sight.dir) };
  } else delete into.sight;
}

/** A hero with no fresh command repeats its last one with the one-shot fields cleared. */
function clearOneShots(c: LatchedCommand): void {
  delete c.sight;
  c.pressed = 0;
  c.upgrade = null;
  c.buy = null;
  c.sell = null;
  c.ping = null;
  c.concede = false;
}

function resolveConfig(c: SimConfig): ResolvedSimConfig {
  if (!Number.isSafeInteger(c.seed)) throw new Error(`createSim: seed must be an integer, got ${c.seed}`);
  const map = c.map ?? 'main';
  const perTeam: Record<PlayerTeam, number> = { dawn: 0, dusk: 0 };
  const seen = new Set<HeroId>();
  let humans = 0;
  for (const r of c.roster) {
    if (!HERO_IDS.includes(r.hero)) throw new Error(`createSim: unknown hero '${r.hero}'`);
    if (seen.has(r.hero)) throw new Error(`createSim: hero '${r.hero}' is picked twice; a match uses distinct heroes`);
    seen.add(r.hero);
    if (++perTeam[r.team] > TEAM_SIZE) throw new Error(`createSim: more than ${TEAM_SIZE} heroes on ${r.team}`);
    if (r.controller === 'human' && ++humans > 1) throw new Error('createSim: more than one human');
  }
  const waves = c.options?.waves ?? map === 'main';
  return {
    seed: c.seed,
    map,
    roster: [...c.roster],
    options: {
      waves,
      practiceHub: c.options?.practiceHub ?? false,
      structures: c.options?.structures ?? (map === 'main' && c.options?.waves === undefined && c.roster.length > 0),
      neutrals: c.options?.neutrals ?? waves,
      unlockAbilities: c.options?.unlockAbilities ?? false,
      startSeeds: c.options?.startSeeds ?? null,
    },
  };
}

function slotState(a: AbilityDef): AbilitySlotState {
  return { ability: a.id, unlocked: false, tier: 0, readyAt: 0, cooldownTicks: 0, charges: a.charges };
}

/** Spawn a roster slot's hero with every component at its neutral starting value (owners adjust on spawn). */
function spawnHero(ctx: SimContext, slot: number, r: RosterSlot, indexInTeam: number): HeroEntity {
  const def = ctx.heroes[r.hero].def;
  const spawns = ctx.map.spawns.filter((s) => s.team === r.team);
  const anchor = spawns[indexInTeam % spawns.length];
  if (!anchor) throw new Error(`createSim: map '${ctx.map.id}' has no ${r.team} spawn`);
  const stats = ctx.stats.create(def.stats);
  const humanSpawn = ctx.map.spawns.find((s) => s.team === 'dawn');
  const training = r.controller === 'dummy' && ctx.config.options.practiceHub && humanSpawn ? {
    pos: { x: humanSpawn.pos.x + (r.team === 'dawn' ? -1 : 1) * TRAINING_TARGET.side, y: humanSpawn.pos.y, z: humanSpawn.pos.z + TRAINING_TARGET.ahead },
    hp: stats.final.maxHealth * (r.team === 'dawn' ? TRAINING_TARGET.alliedHpFraction : 1),
  } : undefined;
  const [a1, a2, a3, a4] = def.abilities;
  return ctx.store.spawn({
    kind: 'hero',
    team: r.team,
    pos: copy(training?.pos ?? anchor.pos),
    vel: vec3(),
    yaw: anchor.yaw,
    radius: def.body.radius,
    hero: { heroId: r.hero, slot, controller: r.controller, ...(training && { training }) },
    pitch: 0,
    shoulder: 1,
    command: { ...IDLE_COMMAND, yaw: anchor.yaw },
    health: {
      hp: training?.hp ?? stats.final.maxHealth,
      talonShield: 0,
      songShield: 0,
      barrier: 0,
      dead: false,
      respawnAt: null,
      inCombatUntil: 0,
    },
    stats,
    statuses: [],
    motor: {
      grounded: true,
      crouching: false,
      sliding: false,
      dashing: false,
      mantling: false,
      updraft: null,
      climb: null,
      knockedUp: false,
      mode: null,
      attachedTo: null,
      stamina: stats.final.stamina,
    },
    weapon: { ammo: stats.final.magazine, reloading: false, firing: false },
    abilities: {
      slots: [slotState(a1), slotState(a2), slotState(a3), slotState(a4)],
      ap: ctx.config.options.practiceHub && r.controller === 'human' ? TRAINING_TARGET.practiceAp : 0,
      casting: null,
      channelling: false,
    },
    progress: { level: 1, molts: 0, seeds: 0, netWorth: 0 },
    inventory: { items: [], actives: [null, null, null, null] },
  });
}

/** Create a match. Async because physics (Rapier) initialises asynchronously. */
export async function createSim(config: SimConfig): Promise<Sim> {
  const cfg = resolveConfig(config);
  const bus = createBus<SimEvent>();
  const store = createStore(bus.emit);
  const clock = { tick: 0, seconds: 0 };
  const spatial = createSpatialHash(SPATIAL_CELL_SIZE);
  const core: CoreContext = {
    config: cfg,
    map: loadMap(cfg.map),
    heroes: HEROES,
    clock,
    store,
    bus,
    rng: createRngStreams(cfg.seed),
    spatial,
    stats: createStatService(store),
    effects: createEffectRouter(),
    teams: { dawn: { team: 'dawn', flexSlots: 0, emberUntil: 0 }, dusk: { team: 'dusk', flexSlots: 0, emberUntil: 0 } },
    itemCatalogue: [],
    objectives: { nextWaveAt: null, eggAt: null, runesAt: null, rocAt: null },
  };

  // Creation order is event-subscription order: physics, ai, world, abilities, combat, economy, items, then core.
  const physics = await createPhysics(core);
  const ctx: SimContext = { ...core, physics: physics.service };
  const ai = createAiSystem(ctx);
  const world = createWorldSystem(ctx);
  const abilities = createAbilitySystem(ctx);
  const combat = createCombatSystem(ctx);
  const economy = createEconomySystem(ctx);
  const items = createItemSystem(ctx);
  // Order within each phase.
  const systems: readonly System[] = [ai, physics.system, world, abilities, combat, economy, items];
  const run = Object.fromEntries(
    PHASES.map((p) => [p, systems.flatMap((s) => s.phases[p] ?? [])]),
  ) as Record<Phase, (() => void)[]>;

  const heroes: HeroEntity[] = [];
  const perTeam: Record<PlayerTeam, number> = { dawn: 0, dusk: 0 };
  cfg.roster.forEach((r, slot) => heroes.push(spawnHero(ctx, slot, r, perTeam[r.team]++)));
  const heroIds = heroes.map((h) => h.id);
  const localHero = heroes.find((h) => h.hero.controller === 'human')?.id ?? null;

  let winner: PlayerTeam | null = null;
  bus.on('match.ended', (e) => {
    winner ??= e.winner;
  });
  const telemetry = createTelemetry(cfg, bus, store, clock, heroIds);
  bus.emit({ type: 'match.started', seed: cfg.seed, map: cfg.map });
  telemetry.endTick();
  let view: SimView | null = null;

  const runPhase = (p: Phase): void => {
    for (const handler of run[p]) handler();
  };

  /** Recent ping ticks per hero, for the rate limit. */
  const recentPings: Tick[][] = heroIds.map(() => []);
  const pings = new Map<EntityId, Tick[]>(heroIds.map((id, i) => [id, recentPings[i] as Tick[]]));
  const pingWindow = ticks(PING_WINDOW_SECONDS);
  /** Core's own command object per hero (the one spawnHero made); h.command points at it after every latch. */
  const latched = heroes.map((h) => h.command as LatchedCommand);
  const slotOf = new Map(heroIds.map((id, i) => [id, i]));
  /** This step's external commands by hero slot (reused; null = none). */
  const given: (PlayerCommand | null)[] = heroIds.map(() => null);

  /**
   * Core step after 'ai': a command passed to step() wins, else one a bot assigned to `h.command` this tick, else the
   * last one repeats without its one-shot fields. Freshness is "h.command is not core's latch object", so a bot may
   * reuse one command object of its own every tick. Then look and shoulder are set, pings and concession handled.
   */
  const latchCommands = (): void => {
    heroes.forEach((h, i) => {
      const cmd = latched[i] as LatchedCommand;
      const src = given[i] ?? (h.command !== cmd ? h.command : null);
      given[i] = null;
      if (src) latchCommand(cmd, src);
      else clearOneShots(cmd);
      h.command = cmd;
      h.yaw = cmd.yaw;
      h.pitch = cmd.pitch;
      if ((cmd.pressed & Button.ShoulderSwap) !== 0) h.shoulder = h.shoulder === 1 ? -1 : 1;
      const recent = recentPings[i] as Tick[];
      while (recent.length > 0 && clock.tick - (recent[0] as Tick) >= pingWindow) recent.shift();
      if (cmd.ping && recent.length < PING_LIMIT) {
        recent.push(clock.tick);
        const { kind, pos, target } = cmd.ping;
        bus.emit({ type: 'ping', by: h.id, team: h.team, kind, pos: copy(pos), target });
      }
      if (cmd.concede && h.hero.controller === 'human' && clock.seconds >= CONCEDE_AFTER_SECONDS) {
        bus.emit({ type: 'match.ended', winner: h.team === 'dawn' ? 'dusk' : 'dawn', reason: 'concede' });
      }
    });
  };

  return {
    get tick() {
      return clock.tick;
    },
    get view() {
      view ??= buildView(ctx, telemetry, heroIds, localHero, winner);
      return view;
    },
    itemCatalogue: core.itemCatalogue ?? [],
    get isOver() {
      return winner !== null;
    },
    get winner() {
      return winner;
    },
    step(commands = []) {
      if (winner !== null) return;
      bus.clearLog();
      view = null;
      clock.tick++;
      clock.seconds = clock.tick / TICK_RATE;
      for (const c of commands) {
        const i = slotOf.get(c.hero);
        if (i !== undefined) given[i] = c.command;
      }
      runPhase('ai');
      latchCommands();
      runPhase('movement');
      spatial.rebuild(store.all());
      for (const p of PHASES) if (p !== 'ai' && p !== 'movement') runPhase(p);
      store.flush();
      telemetry.endTick();
    },
    drainEvents: () => bus.drain(),
    hash() {
      const h = createHasher();
      h.num(clock.tick);
      for (const [name, state] of ctx.rng.states()) {
        h.str(name);
        h.value(state);
      }
      for (const e of store.all()) h.value(e);
      h.value(ctx.teams);
      h.value(ctx.objectives);
      h.value(pings);
      for (const s of systems) {
        if (!s.hash) continue;
        h.str(s.name);
        s.hash(h);
      }
      return h.digest();
    },
    telemetry: () => telemetry.build(winner),
    ctx,
  };
}

/** Options for the roster helpers. */
export interface RosterOptions {
  /** Bot count (default: fill the match to 12). */
  readonly bots?: number;
  /** The human's flock (default Dawn). */
  readonly team?: PlayerTeam;
  /** One difficulty for every bot, or 'mixed': allies Hunter (normal), enemies seeded per slot (GDD §11.2). */
  readonly difficulty?: BotDifficulty | 'mixed';
}

const DIFFICULTIES: readonly BotDifficulty[] = ['easy', 'normal', 'hard'];

function makeRoster(seed: number, human: HeroId | null, opts: RosterOptions): RosterSlot[] {
  const humanTeam = opts.team ?? 'dawn';
  const bots = opts.bots ?? MAX_HEROES - (human ? 1 : 0);
  const difficulty = opts.difficulty ?? 'normal';
  if (!Number.isInteger(bots) || bots < 0 || bots + (human ? 1 : 0) > MAX_HEROES) {
    throw new Error(`roster: ${bots} bots${human ? ' plus a human' : ''} doesn't fit ${MAX_HEROES} slots`);
  }
  const rng = createRng(seed, 'roster');
  const slots: RosterSlot[] = human ? [{ team: humanTeam, hero: human, controller: 'human' }] : [];
  const count = (t: PlayerTeam): number => slots.filter((s) => s.team === t).length;
  for (let i = 0; i < bots; i++) {
    // Each bot joins the smaller flock (Dawn on a tie), so picks alternate flocks (GDD §11.6).
    const team: PlayerTeam = count('dawn') <= count('dusk') ? 'dawn' : 'dusk';
    const taken = new Set(slots.map((s) => s.hero));
    const hero = pickBotHero(rng, taken, slots.filter((s) => s.team === team).map((s) => s.hero));
    const controller =
      difficulty !== 'mixed' ? difficulty : human && team === humanTeam ? 'normal' : rng.pick(DIFFICULTIES);
    slots.push({ team, hero, controller });
  }
  return slots;
}

/**
 * A seeded all-bot roster for headless runs: `bots` distinct heroes from the 24 (default 12) split evenly between
 * the flocks, chosen by the bot pick rule (sim/ai `pickBotHero`). The picks are recorded in the telemetry.
 */
export function allBotRoster(seed: number, bots = MAX_HEROES, difficulty: BotDifficulty = 'normal'): RosterSlot[] {
  return makeRoster(seed, null, { bots, difficulty });
}

/** The human's hero (slot 0) plus seeded bots: by default 11 Hunter bots, with the human on Dawn. */
export function humanRoster(seed: number, hero: HeroId, opts: RosterOptions = {}): RosterSlot[] {
  return makeRoster(seed, hero, opts);
}
