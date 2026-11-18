/**
 * Test harness for sim/abilities: real core services (store, bus, stats, router, spatial hash) and the abilities
 * system alone, on the flat arena with a fake physics service (flat ground at y = 0, optional walls). It records
 * every effect applied, so tests check combat's and physics' kinds without those systems, and it owns its router,
 * so registering fakes never collides with their real handlers. Used by the co-located tests only.
 */
import { IDLE_COMMAND } from '../core/contracts';
import type {
  Effect,
  EffectCause,
  EffectKind,
  EffectOfKind,
  EffectTarget,
  HeroEntity,
  HeroId,
  HeroModule,
  PhysicsService,
  PlayerCommand,
  PlayerTeam,
  RosterSlot,
  SimContext,
  SimEvent,
  System,
  Vec3,
} from '../core/contracts';
import { createEffectRouter } from '../core/effects';
import { createBus } from '../core/events';
import { createRngStreams } from '../core/rng';
import { createSpatialHash } from '../core/spatial';
import { createStatService } from '../core/stats';
import { createStore } from '../core/store';
import { SPATIAL_CELL_SIZE, TICK_RATE } from '../data/core';
import { HEROES } from '../heroes/registry';
import { loadMap } from '../world/map';
import { createAbilitySystem } from './index';

export interface Applied<K extends EffectKind = EffectKind> {
  readonly effect: EffectOfKind<K>;
  readonly target: EffectTarget;
  readonly cause: EffectCause;
  readonly tick: number;
}

/** A wall for the fake physics: blocks rays crossing the plane x = `x` between z0 and z1. */
export interface FakeWall {
  readonly x: number;
  readonly z0: number;
  readonly z1: number;
}

export interface Harness {
  readonly ctx: SimContext;
  readonly system: System;
  /** Every effect applied through the router, in order, nested ones included. */
  readonly applied: Applied[];
  /** Every event emitted since the harness was made. */
  readonly events: SimEvent[];
  readonly walls: FakeWall[];
  /** Spawn a hero (feet at `pos`, facing `yaw`). */
  hero(id: HeroId, team: PlayerTeam, pos: Vec3, yaw?: number): HeroEntity;
  /** Advance `n` ticks; `cmd` is the first tick's command for each listed hero (presses last one tick). */
  step(n?: number, cmd?: readonly (readonly [HeroEntity, Partial<PlayerCommand>])[]): void;
  /** Applied effects of one kind. */
  of<K extends EffectKind>(kind: K): Applied<K>[];
}

export interface HarnessOptions {
  /** Replace hero modules (fixture kits). */
  readonly heroes?: Partial<Record<HeroId, HeroModule>>;
  /** Heroes whose hooks get created; default: every overridden hero, on Dawn. */
  readonly roster?: readonly RosterSlot[];
  readonly unlockAbilities?: boolean;
}

export function createHarness(opts: HarnessOptions = {}): Harness {
  const bus = createBus<SimEvent>();
  const store = createStore(bus.emit);
  const clock = { tick: 0, seconds: 0 };
  const spatial = createSpatialHash(SPATIAL_CELL_SIZE);
  const effects = createEffectRouter();
  const applied: Applied[] = [];
  const events: SimEvent[] = [];
  const walls: FakeWall[] = [];
  const inner = effects.apply;
  effects.apply = (effect: Effect, target: EffectTarget, cause: EffectCause) => {
    applied.push({ effect, target, cause, tick: clock.tick } as Applied);
    inner(effect, target, cause);
  };
  const physics: PhysicsService = {
    raycast(origin, dir, max) {
      let best = Infinity;
      if (dir.y < 0) best = -origin.y / dir.y;
      for (const w of walls) {
        if (dir.x === 0) continue;
        const t = (w.x - origin.x) / dir.x;
        const z = origin.z + dir.z * t;
        if (t > 0 && t < best && z >= w.z0 && z <= w.z1) best = t;
      }
      if (best > max) return null;
      const point = { x: origin.x + dir.x * best, y: origin.y + dir.y * best, z: origin.z + dir.z * best };
      return { distance: best, point, normal: { x: 0, y: 1, z: 0 }, entity: null };
    },
    shapeCast: () => null,
    overlap: (_s, _c, _m, out) => {
      out.length = 0;
      return out;
    },
    moveCharacter: (id, d) => {
      const p = store.get(id)?.pos ?? { x: 0, y: 0, z: 0 };
      return { pos: { x: p.x + d.x, y: p.y + d.y, z: p.z + d.z }, grounded: true, wall: null };
    },
    groundHeight: () => 0,
  };
  const heroes = { ...HEROES, ...opts.heroes } as Record<HeroId, HeroModule>;
  const roster =
    opts.roster ?? (Object.keys(opts.heroes ?? {}) as HeroId[]).map((hero) => ({ team: 'dawn' as const, hero, controller: 'easy' as const }));
  const stats = createStatService(store);
  const ctx: SimContext = {
    config: {
      seed: 1,
      map: 'arena',
      roster,
      options: { waves: false, neutrals: false, unlockAbilities: opts.unlockAbilities ?? false, startSeeds: null },
    },
    map: loadMap('arena'),
    heroes,
    clock,
    store,
    bus,
    rng: createRngStreams(1),
    spatial,
    stats,
    effects,
    physics,
    teams: { dawn: { team: 'dawn', flexSlots: 0, emberUntil: 0 }, dusk: { team: 'dusk', flexSlots: 0, emberUntil: 0 } },
    objectives: { nextWaveAt: null, eggAt: null, runesAt: null, rocAt: null },
  };
  const system = createAbilitySystem(ctx);
  events.push(...bus.drain());
  const live: HeroEntity[] = [];

  return {
    ctx,
    system,
    applied,
    events,
    walls,
    hero(id, team, pos, yaw = 0) {
      const def = heroes[id].def;
      const s = stats.create(def.stats);
      const slot = (i: number) => {
        const a = def.abilities[i];
        if (!a) throw new Error(`${id} has no ability ${i}`);
        return { ability: a.id, unlocked: false, tier: 0, readyAt: 0, cooldownTicks: 0, charges: a.charges };
      };
      const h = store.spawn({
        kind: 'hero',
        team,
        pos: { ...pos },
        vel: { x: 0, y: 0, z: 0 },
        yaw,
        radius: def.body.radius,
        hero: { heroId: id, slot: live.length, controller: 'easy' },
        pitch: 0,
        shoulder: 1,
        command: { ...IDLE_COMMAND, yaw },
        health: { hp: s.final.maxHealth, talonShield: 0, songShield: 0, barrier: 0, dead: false, respawnAt: null, inCombatUntil: 0 },
        stats: s,
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
          stamina: s.final.stamina,
        },
        weapon: { ammo: s.final.magazine, reloading: false, firing: false },
        abilities: { slots: [slot(0), slot(1), slot(2), slot(3)], ap: 0, casting: null, channelling: false },
        progress: { level: 1, molts: 0, seeds: 0, netWorth: 0 },
        inventory: { items: [], actives: [null, null, null, null] },
      });
      live.push(h);
      events.push(...bus.drain());
      return h;
    },
    step(n = 1, cmd = []) {
      for (let i = 0; i < n; i++) {
        clock.tick++;
        clock.seconds = clock.tick / TICK_RATE;
        for (const h of live) h.command = { ...h.command, pressed: 0, upgrade: null };
        if (i === 0) {
          for (const [h, c] of cmd) {
            h.command = { ...IDLE_COMMAND, yaw: h.yaw, pitch: h.pitch, ...c };
            h.yaw = h.command.yaw;
            h.pitch = h.command.pitch;
          }
        }
        spatial.rebuild(store.all());
        system.phases.abilities?.();
        store.flush();
        events.push(...bus.drain());
      }
    },
    of<K extends EffectKind>(kind: K) {
      return applied.filter((a) => a.effect.kind === kind) as unknown as Applied<K>[];
    },
  };
}
