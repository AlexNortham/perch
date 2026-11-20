/**
 * Ability sandbox (QA): a small match on a test map with helpers to place heroes and dummies, drive them with
 * commands, step, and read what happened. Hero Engineers use it for ability smoke tests; QA's rules suites use it
 * too. See tests/README.md for a worked example.
 *
 * Every step sends a command for every hero, so bots never act: a sandbox hero does only what the test tells it.
 * Tests may reach into `sim.ctx` (the client may not); this helper only writes positions and test-only stat sources.
 */
import { ABILITY_BUTTONS, Button, IDLE_COMMAND } from '../../src/sim/core/contracts';
import type {
  Controller,
  Effect,
  EffectCause,
  EffectTarget,
  Entity,
  EntityId,
  EventOf,
  Health,
  HeroCommand,
  HeroEntity,
  HeroId,
  ItemId,
  LaneId,
  MapId,
  ModifierSet,
  PlayerTeam,
  Sim,
  SimContext,
  SimEvent,
  SimEventType,
  SimOptions,
  SimView,
  StatusId,
  StructureType,
  Team,
  UnitType,
  Vec3,
} from '../../src/sim/core/contracts';
import { aimRay, lookDir, toWorld } from '../../src/sim/core/aim';
import { copy, normalize, sub, vec3 } from '../../src/sim/core/math';
import { CROUCH_SCALE } from '../../src/sim/data/core';
import { createSim } from '../../src/sim/index';

export interface SandboxHero {
  readonly hero: HeroId;
  /** Default: the first hero is Dawn, the rest Dusk. */
  readonly team?: PlayerTeam;
  readonly controller?: Controller;
  /** Feet position; default: the map's spawn. */
  readonly at?: Vec3;
  readonly yaw?: number;
}

export interface SandboxConfig {
  readonly heroes: readonly (HeroId | SandboxHero)[];
  /** Default 'arena' (flat 80 m square, ground at y = 0). */
  readonly map?: MapId;
  /** Merged over { unlockAbilities: true, waves: false, neutrals: false }. */
  readonly options?: SimOptions;
  readonly seed?: number;
  /** Keep the heroes' base health regeneration. Default false, so hp changes are exactly what the test did. */
  readonly regen?: boolean;
}

/** A target that isn't a hero: a unit (fledgling, creature, summon) or a structure. No regeneration. */
export type DummySpec = {
  readonly team: Team;
  readonly at: Vec3;
  readonly hp: number;
  readonly yaw?: number;
} & (
  | {
      readonly kind: 'unit';
      readonly type: UnitType;
      readonly lane?: LaneId;
      /** For type 'summon': the hero that made it (kill credit goes to it). */
      readonly owner?: EntityId;
      readonly height?: number;
      readonly radius?: number;
    }
  | { readonly kind: 'structure'; readonly type: StructureType; readonly height?: number; readonly radius?: number }
);

export type AimPart = 'head' | 'body';
type Target = EntityId | Vec3;

interface Controls {
  forward: number;
  right: number;
  yaw: number;
  pitch: number;
  held: number;
  pressed: number;
  upgrade: number | null;
  buy?: ItemId;
  sell?: ItemId;
}

export interface Sandbox {
  readonly sim: Sim;
  readonly ctx: SimContext;
  /** Hero entity ids, in the order given to createSandbox. */
  readonly heroes: readonly EntityId[];
  readonly view: SimView;
  /** Every event since creation (or the last clearEvents), in order. */
  readonly events: readonly SimEvent[];
  eventsOf<T extends SimEventType>(type: T): EventOf<T>[];
  clearEvents(): void;

  entity(id: EntityId): Entity;
  hero(id: EntityId): HeroEntity;
  health(id: EntityId): Health;
  statuses(id: EntityId): StatusId[];
  /** Where to aim at an entity: its head (heroes) or the middle of its body. */
  pointOf(id: EntityId, part?: AimPart): Vec3;

  /** Put an entity at a feet position (heroes also get a physics teleport) and optionally turn it. */
  place(id: EntityId, at: Vec3, yaw?: number): void;
  /** Spawn a unit or structure dummy and return its id. */
  dummy(spec: DummySpec): EntityId;
  /** Add (or with null remove) a test-only stat/condition source on an entity, under the key 'sandbox:<key>'. */
  modify(id: EntityId, key: string, mods: ModifierSet | null): void;

  /** Movement axes held until changed. */
  move(id: EntityId, forward: number, right?: number): void;
  look(id: EntityId, yaw: number, pitch?: number): void;
  /** Turn so the camera ray (the crosshair) passes through the point or the entity's head or body. */
  aimAt(id: EntityId, target: Target, part?: AimPart): void;
  /** Buttons held until released. */
  hold(id: EntityId, buttons: number): void;
  release(id: EntityId, buttons: number): void;
  /** Buttons pressed for the next step only. */
  press(id: EntityId, buttons: number): void;
  fire(id: EntityId, on?: boolean): void;
  /** Aim at the target (if given) and press ability slot 0–3 on the next step. */
  cast(id: EntityId, slot: number, target?: Target, part?: AimPart): void;
  /** Spend AP on ability slot 0–3 on the next step. */
  upgrade(id: EntityId, slot: number): void;
  trade(id: EntityId, request: { buy: ItemId } | { sell: ItemId }): void;

  step(ticks?: number): void;
  /** Step until `done()` holds (checked after each step); returns the ticks taken, or null after maxTicks. */
  stepUntil(done: () => boolean, maxTicks?: number): number | null;

  /** An EffectCause credited to `source` (team, Song power and origin from the entity), with overrides. */
  cause(source: EntityId | null, over?: Partial<EffectCause>): EffectCause;
  /** Apply effects now, as another system would, to an entity (aimed at its body) or a point. */
  apply(effects: Effect | readonly Effect[], target: Target, cause: EffectCause): void;
}

const DEFAULT_OPTIONS: SimOptions = { unlockAbilities: true, waves: false, neutrals: false };
const DEFAULT_MAX_TICKS = 600;
const AIM_ITERATIONS = 8;
const DUMMY_RADIUS = 0.5;
const DUMMY_UNIT_HEIGHT = 1;
const DUMMY_STRUCTURE_HEIGHT = 6;
const DUMMY_STRUCTURE_RADIUS = 2;

export async function createSandbox(config: SandboxConfig): Promise<Sandbox> {
  const specs = config.heroes.map((h, i): SandboxHero => {
    const s = typeof h === 'string' ? { hero: h } : h;
    return { ...s, team: s.team ?? (i === 0 ? 'dawn' : 'dusk') };
  });
  const seed = config.seed ?? 1;
  const sim = await createSim({
    seed,
    map: config.map ?? 'arena',
    // The rest are 'dummy' targets: no bot AI drives them on any map (D-AI-007's interface request).
    roster: specs.map((s, i) => ({ team: s.team ?? 'dawn', hero: s.hero, controller: s.controller ?? (i === 0 ? 'human' : 'dummy') })),
    options: { ...DEFAULT_OPTIONS, ...config.options },
  });
  const ctx = sim.ctx;
  const log: SimEvent[] = [...sim.drainEvents()];
  // createSim spawns the roster first, in order, so the heroes are the first entities.
  const heroes = ctx.store.list('hero').map((h) => h.id);
  const controls = new Map<EntityId, Controls>();
  for (const id of heroes) {
    const h = ctx.store.getKind(id, 'hero') as HeroEntity;
    controls.set(id, { forward: 0, right: 0, yaw: h.yaw, pitch: 0, held: 0, pressed: 0, upgrade: null });
  }

  const entity = (id: EntityId): Entity => {
    const e = ctx.store.get(id);
    if (!e) throw new Error(`sandbox: no entity ${id}`);
    return e;
  };
  const hero = (id: EntityId): HeroEntity => {
    const e = ctx.store.getKind(id, 'hero');
    if (!e) throw new Error(`sandbox: entity ${id} is not a hero`);
    return e;
  };
  const control = (id: EntityId): Controls => {
    const c = controls.get(id);
    if (!c) throw new Error(`sandbox: entity ${id} is not a sandbox hero`);
    return c;
  };

  const pointOf = (id: EntityId, part: AimPart = 'body'): Vec3 => {
    const e = entity(id);
    switch (e.kind) {
      case 'hero': {
        const body = ctx.heroes[e.hero.heroId].def.body;
        const k = e.motor.crouching ? CROUCH_SCALE : 1;
        const head = toWorld(e.pos, e.yaw, body.head.centre);
        if (part === 'head') return { ...head, y: e.pos.y + body.head.centre.up * k };
        return { x: e.pos.x, y: e.pos.y + ((body.head.centre.up - body.head.radius) * k) / 2, z: e.pos.z };
      }
      case 'unit':
        return { x: e.pos.x, y: e.pos.y + e.unit.height / 2, z: e.pos.z };
      case 'structure':
        return { x: e.pos.x, y: e.pos.y + e.structure.body.height / 2, z: e.pos.z };
      default:
        return copy(e.pos);
    }
  };
  const resolve = (t: Target, part?: AimPart): Vec3 => (typeof t === 'number' ? pointOf(t, part) : t);

  const cause = (source: EntityId | null, over: Partial<EffectCause> = {}): EffectCause => {
    const e = source === null ? undefined : ctx.store.get(source);
    return {
      source,
      team: e?.team ?? 'neutral',
      via: 'ability',
      ability: null,
      item: null,
      values: null,
      songPower: source === null ? 0 : ctx.stats.get(source, 'songPower'),
      proc: false,
      origin: e ? copy(e.pos) : vec3(),
      ...over,
    };
  };

  const look = (id: EntityId, yaw: number, pitch = 0): void => {
    const c = control(id);
    c.yaw = yaw;
    c.pitch = pitch;
  };

  const sandbox: Sandbox = {
    sim,
    ctx,
    heroes,
    get view() {
      return sim.view;
    },
    get events() {
      return log;
    },
    eventsOf: <T extends SimEventType>(type: T) => log.filter((e): e is EventOf<T> => e.type === type),
    clearEvents: () => {
      log.length = 0;
    },

    entity,
    hero,
    health(id) {
      const e = entity(id);
      if (!('health' in e)) throw new Error(`sandbox: entity ${id} (${e.kind}) has no health`);
      return e.health;
    },
    statuses(id) {
      const e = entity(id);
      return 'statuses' in e ? e.statuses.map((s) => s.def.id) : [];
    },
    pointOf,

    place(id, at, yaw) {
      const e = entity(id);
      e.pos = copy(at);
      e.vel = vec3();
      if (yaw !== undefined) e.yaw = yaw;
      if (e.kind !== 'hero') return;
      if (yaw !== undefined) control(id).yaw = yaw;
      const target: EffectTarget = { entity: id, point: copy(at), dir: lookDir(e.yaw, 0) };
      ctx.effects.apply({ kind: 'teleport', to: 'point', face: 'keep' }, target, cause(id));
    },
    dummy(spec) {
      const base = {
        team: spec.team,
        pos: copy(spec.at),
        vel: vec3(),
        yaw: spec.yaw ?? 0,
        radius: spec.radius ?? (spec.kind === 'structure' ? DUMMY_STRUCTURE_RADIUS : DUMMY_RADIUS),
        health: { hp: spec.hp, talonShield: 0, songShield: 0, barrier: 0, dead: false, respawnAt: null, inCombatUntil: 0 },
        stats: ctx.stats.create({ maxHealth: spec.hp }),
        statuses: [],
      };
      if (spec.kind === 'unit') {
        return ctx.store.spawn({
          ...base,
          kind: 'unit',
          unit: {
            type: spec.type,
            lane: spec.lane ?? null,
            height: spec.height ?? DUMMY_UNIT_HEIGHT,
            owner: spec.owner ?? null,
            summon: spec.type === 'summon' ? 'turret' : null,
            target: null,
            attacking: false,
          },
        }).id;
      }
      const radius = spec.radius ?? DUMMY_STRUCTURE_RADIUS;
      return ctx.store.spawn({
        ...base,
        kind: 'structure',
        structure: {
          type: spec.type,
          lane: null,
          phase: 1,
          target: null,
          body: { radius, height: spec.height ?? DUMMY_STRUCTURE_HEIGHT },
          weakPoint: null,
        },
      }).id;
    },
    modify(id, key, mods) {
      ctx.stats.set(id, `sandbox:${key}`, mods);
    },

    move(id, forward, right = 0) {
      const c = control(id);
      c.forward = forward;
      c.right = right;
    },
    look,
    aimAt(id, target, part = 'body') {
      const p = resolve(target, part);
      const h = hero(id);
      const body = ctx.heroes[h.hero.heroId].def.body;
      // The camera sits behind and beside the pivot, so turning moves it: iterate until the ray passes through p.
      let { yaw, pitch } = control(id);
      for (let i = 0; i < AIM_ITERATIONS; i++) {
        const ray = aimRay(h.pos, yaw, pitch, h.shoulder, body, h.motor.crouching);
        const d = sub(p, ray.origin);
        yaw = Math.atan2(d.x, d.z);
        pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      }
      look(id, yaw, pitch);
    },
    hold(id, buttons) {
      control(id).held |= buttons;
    },
    release(id, buttons) {
      control(id).held &= ~buttons;
    },
    press(id, buttons) {
      control(id).pressed |= buttons;
    },
    fire(id, on = true) {
      if (on) sandbox.hold(id, Button.Fire);
      else sandbox.release(id, Button.Fire);
    },
    cast(id, slot, target, part) {
      const button = ABILITY_BUTTONS[slot];
      if (button === undefined) throw new Error(`sandbox: ability slot ${slot} is not 0–3`);
      if (target !== undefined) sandbox.aimAt(id, target, part);
      sandbox.press(id, button);
    },
    upgrade(id, slot) {
      control(id).upgrade = slot;
    },

    trade(id, request) {
      Object.assign(control(id), request);
    },

    step(n = 1) {
      for (let i = 0; i < n; i++) {
        const commands: HeroCommand[] = heroes.map((id) => {
          const c = control(id);
          return {
            hero: id,
            command: {
              ...IDLE_COMMAND,
              forward: c.forward,
              right: c.right,
              yaw: c.yaw,
              pitch: c.pitch,
              held: c.held | c.pressed,
              pressed: c.pressed,
              upgrade: c.upgrade,
              buy: c.buy ?? null,
              sell: c.sell ?? null,
            },
          };
        });
        for (const c of controls.values()) {
          c.pressed = 0;
          c.upgrade = null;
          delete c.buy;
          delete c.sell;
        }
        sim.step(commands);
        log.push(...sim.drainEvents());
      }
    },
    stepUntil(done, maxTicks = DEFAULT_MAX_TICKS) {
      for (let i = 1; i <= maxTicks; i++) {
        sandbox.step();
        if (done()) return i;
      }
      return null;
    },

    cause,
    apply(effects, target, c) {
      const point = resolve(target);
      const t: EffectTarget = {
        entity: typeof target === 'number' ? target : null,
        point,
        dir: normalize(sub(point, c.origin)),
      };
      ctx.effects.applyAll('kind' in effects ? [effects] : effects, t, c);
    },
  };

  if (!config.regen) for (const id of heroes) sandbox.modify(id, 'regen', { stats: [{ stat: 'healthRegen', op: 'mul', value: 0 }] });
  specs.forEach((s, i) => {
    const id = heroes[i] as EntityId;
    if (s.at) sandbox.place(id, s.at, s.yaw);
    else if (s.yaw !== undefined) look(id, s.yaw);
  });
  return sandbox;
}
