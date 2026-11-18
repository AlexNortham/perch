/* eslint-disable @typescript-eslint/no-magic-numbers -- test fixtures: GDD §9 hero numbers and test positions */
/**
 * Test kit for sim/combat's co-located tests (not imported by the sim). Builds a SimContext from core with fixture
 * heroes that carry real GDD §9 guns and body plans, a fake PhysicsService with an AABB world, and steps only the
 * phases combat runs in, in core's order.
 */
import { IDLE_COMMAND, Layer } from '../core/contracts';
import type {
  BodyPlan,
  EntityId,
  HeroDef,
  HeroEntity,
  HeroId,
  HeroModule,
  PhysicsService,
  PickupEntity,
  PlayerTeam,
  RayHit,
  SimContext,
  SimEvent,
  StatId,
  StructureEntity,
  StructureType,
  System,
  Team,
  UnitEntity,
  Vec3,
  WeaponDef,
} from '../core/contracts';
import { aimRay } from '../core/aim';
import { createEffectRouter } from '../core/effects';
import { createBus } from '../core/events';
import { createRngStreams } from '../core/rng';
import { createSpatialHash } from '../core/spatial';
import { createStatService } from '../core/stats';
import { createStore } from '../core/store';
import { SPATIAL_CELL_SIZE, TICK_RATE } from '../data/core';
import { HEROES } from '../heroes/registry';
import { ARENA } from '../world/map';
import { createCombatSystem } from './index';

const body = (height: number, headR: number, headUp: number, radius: number): BodyPlan => ({
  height,
  radius,
  head: { centre: { right: 0, up: headUp, forward: 0 }, radius: headR },
  muzzle: { right: 0.25, up: headUp - 0.4, forward: 0.35 },
});

const gun = (w: Partial<WeaponDef> & Pick<WeaponDef, 'name' | 'fireRate' | 'falloff'>): WeaponDef => ({
  pellets: 1,
  spreadDeg: 0,
  hitscan: true,
  projectileSpeed: 0,
  reloadS: 2,
  reload: 'magazine',
  range: 120,
  ...w,
});

const fixture = (
  id: HeroId,
  b: BodyPlan,
  hp: number,
  weaponDamage: number,
  magazine: number,
  weapon: WeaponDef,
): HeroModule => ({
  def: {
    ...HEROES[id].def,
    body: b,
    stats: { maxHealth: hp, healthRegen: 2, moveSpeed: 7, sprintSpeed: 2, stamina: 3, weaponDamage, magazine },
    growth: [
      { stat: 'maxHealth', op: 'add', value: 30 },
      { stat: 'weaponDamage', op: 'pct', value: 0.03 },
      { stat: 'meleeDamage', op: 'add', value: 3 },
    ],
    weapon,
  },
});

/** GDD §9.3 Kingfisher: fast hitscan pistol. */
export const KINGFISHER = fixture('kingfisher', body(1.6, 0.16, 1.42, 0.28), 520, 22, 12,
  gun({ name: 'Dart Pistol', spreadDeg: 0.4, fireRate: 4, reloadS: 1.6, falloff: { start: 18, end: 40 } }));
/** GDD §9.2 Albatross: hitscan shotgun, 8 pellets, shell-loader. */
export const ALBATROSS = fixture('albatross', body(2.3, 0.2, 2.05, 0.5), 720, 6, 6,
  gun({ name: 'Gale Blunderbuss', pellets: 8, spreadDeg: 5, fireRate: 1.4, reloadS: 0.45, reload: 'perRound', falloff: { start: 8, end: 22 } }));
/** GDD §9.1 Shrike: projectile rifle at 180 m/s. */
export const SHRIKE = fixture('shrike', body(1.75, 0.17, 1.55, 0.32), 580, 14, 24,
  gun({ name: 'Barb Rifle', spreadDeg: 0.6, fireRate: 6, hitscan: false, projectileSpeed: 180, reloadS: 2.2, falloff: { start: 20, end: 45 } }));
/** GDD §9.5 Owl: slow sniper, ×2.0 beak shots, 200 m range. */
export const OWL = fixture('owl', body(1.7, 0.24, 1.45, 0.36), 520, 52, 6,
  gun({ name: 'Hush Rifle', spreadDeg: 0.1, fireRate: 1.25, reloadS: 2.6, falloff: { start: 40, end: 90 }, range: 200, beakShotMult: 2, aimRange: 400 }));
/** GDD §9.6 Pelican: gatling at 11 shots/s. */
export const PELICAN = fixture('pelican', body(2.1, 0.19, 1.85, 0.48), 640, 8, 50,
  gun({ name: 'Gullet Gatling', spreadDeg: 1.6, fireRate: 11, reloadS: 2.8, falloff: { start: 18, end: 40 } }));
/** GDD §9.4 Lyrebird: slow projectile lute at 90 m/s. */
export const LYREBIRD = fixture('lyrebird', body(1.8, 0.15, 1.62, 0.3), 560, 16, 20,
  gun({ name: 'Echo Lute', spreadDeg: 0.8, fireRate: 4.5, hitscan: false, projectileSpeed: 90, reloadS: 2, falloff: { start: 15, end: 35 } }));

const FIXTURES: Partial<Record<HeroId, HeroModule>> = {
  kingfisher: KINGFISHER,
  albatross: ALBATROSS,
  shrike: SHRIKE,
  owl: OWL,
  pelican: PELICAN,
  lyrebird: LYREBIRD,
};

export interface Box {
  readonly min: Vec3;
  readonly max: Vec3;
}

/** Fake physics: solid AABBs on Layer.World; every other query misses. */
export function fakePhysics(boxes: Box[]): PhysicsService {
  return {
    raycast(o, d, maxDistance, mask): RayHit | null {
      if ((mask & Layer.World) === 0) return null;
      let best: RayHit | null = null;
      for (const b of boxes) {
        let tmin = 0;
        let tmax = maxDistance;
        let axis = -1;
        let sign = 0;
        const axes = ['x', 'y', 'z'] as const;
        let miss = false;
        for (let a = 0; a < 3; a++) {
          const k = axes[a] as 'x' | 'y' | 'z';
          if (Math.abs(d[k]) < 1e-12) {
            if (o[k] < b.min[k] || o[k] > b.max[k]) miss = true;
            continue;
          }
          let t1 = (b.min[k] - o[k]) / d[k];
          let t2 = (b.max[k] - o[k]) / d[k];
          let s = -1;
          if (t1 > t2) {
            [t1, t2] = [t2, t1];
            s = 1;
          }
          if (t1 > tmin) {
            tmin = t1;
            axis = a;
            sign = s;
          }
          tmax = Math.min(tmax, t2);
          if (tmin > tmax) miss = true;
        }
        if (miss || (best && best.distance <= tmin)) continue;
        const normal = { x: 0, y: 0, z: 0 };
        if (axis >= 0) normal[axes[axis] as 'x' | 'y' | 'z'] = sign;
        best = { distance: tmin, point: { x: o.x + d.x * tmin, y: o.y + d.y * tmin, z: o.z + d.z * tmin }, normal, entity: null };
      }
      return best;
    },
    shapeCast: () => null,
    overlap: (_s, _c, _m, out) => {
      out.length = 0;
      return out;
    },
    moveCharacter: () => ({ pos: { x: 0, y: 0, z: 0 }, grounded: true, wall: null }),
    groundHeight: () => 0,
  };
}

export interface Kit {
  readonly ctx: SimContext;
  readonly system: System;
  /** Every event since the kit was made (or the last `clear`), unless created with keepEvents false. */
  readonly events: SimEvent[];
  readonly boxes: Box[];
  /** Run `n` ticks: spatial rebuild, then combat's phases (combat, damage, statuses), then the despawn flush. */
  step(n?: number): void;
  /** Events of one type from `events`. */
  of<T extends SimEvent['type']>(type: T): Extract<SimEvent, { type: T }>[];
  clear(): void;
  hero(id: HeroId, team: PlayerTeam, pos: Vec3, yaw?: number): HeroEntity;
  unit(team: Team, pos: Vec3, hp?: number, height?: number): UnitEntity;
  structure(team: Team, type: StructureType, pos: Vec3, hp: number, radius: number, height: number): StructureEntity;
  pod(team: Team, pos: Vec3): PickupEntity;
  /** Point the hero's camera ray through `point` (yaw and pitch, solved iteratively). */
  aimAt(h: HeroEntity, point: Vec3): void;
  /** Buttons held from now on, and buttons pressed this coming tick only. */
  input(h: HeroEntity, held: number, pressed?: number): void;
  /** Set a stat source on an entity (stands in for items, Molts, world rules). */
  mod(e: { id: EntityId }, key: string, stats: readonly [StatId, 'add' | 'pct' | 'mul' | 'max' | 'stack', number][]): void;
}

export function createKit(opts: { seed?: number; boxes?: Box[]; keepEvents?: boolean } = {}): Kit {
  const seed = opts.seed ?? 1;
  const boxes = opts.boxes ?? [];
  const keep = opts.keepEvents ?? true;
  const bus = createBus<SimEvent>();
  const store = createStore(bus.emit);
  const clock = { tick: 0, seconds: 0 };
  const spatial = createSpatialHash(SPATIAL_CELL_SIZE);
  const ctx: SimContext = {
    config: {
      seed,
      map: 'arena',
      roster: [],
      options: { waves: false, neutrals: false, unlockAbilities: false, startSeeds: null },
    },
    map: ARENA,
    heroes: { ...HEROES, ...FIXTURES },
    clock,
    store,
    bus,
    rng: createRngStreams(seed),
    spatial,
    stats: createStatService(store),
    effects: createEffectRouter(),
    physics: fakePhysics(boxes),
    teams: { dawn: { team: 'dawn', flexSlots: 0, emberUntil: 0 }, dusk: { team: 'dusk', flexSlots: 0, emberUntil: 0 } },
    objectives: { nextWaveAt: null, eggAt: null, runesAt: null, rocAt: null },
  };
  const system = createCombatSystem(ctx);
  const events: SimEvent[] = [];
  const collect = (): void => {
    const got = bus.drain();
    if (keep) for (const e of got) events.push(e);
  };
  const oneShots = new Set<HeroEntity>();
  let slot = 0;

  const kit: Kit = {
    ctx,
    system,
    events,
    boxes,
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        collect();
        bus.clearLog();
        clock.tick++;
        clock.seconds = clock.tick / TICK_RATE;
        spatial.rebuild(store.all());
        system.phases.combat?.();
        system.phases.damage?.();
        system.phases.statuses?.();
        store.flush();
        collect();
        for (const h of oneShots) h.command = { ...h.command, pressed: 0 };
        oneShots.clear();
      }
    },
    of(type) {
      collect();
      return events.filter((e): e is Extract<SimEvent, { type: typeof type }> => e.type === type);
    },
    clear() {
      collect();
      events.length = 0;
    },
    hero(id, team, pos, yaw = 0) {
      const def: HeroDef = ctx.heroes[id].def;
      const stats = ctx.stats.create(def.stats);
      const slotOf = (a: HeroDef['abilities'][number]) => ({
        ability: a.id,
        unlocked: false,
        tier: 0,
        readyAt: 0,
        cooldownTicks: 0,
        charges: a.charges,
      });
      const [a1, a2, a3, a4] = def.abilities;
      return store.spawn({
        kind: 'hero',
        team,
        pos: { ...pos },
        vel: { x: 0, y: 0, z: 0 },
        yaw,
        radius: def.body.radius,
        hero: { heroId: id, slot: slot++, controller: 'easy' },
        pitch: 0,
        shoulder: 1,
        command: { ...IDLE_COMMAND, yaw },
        health: { hp: stats.final.maxHealth, talonShield: 0, songShield: 0, barrier: 0, dead: false, respawnAt: null, inCombatUntil: 0 },
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
          stamina: 3,
        },
        weapon: { ammo: stats.final.magazine, reloading: false, firing: false },
        abilities: { slots: [slotOf(a1), slotOf(a2), slotOf(a3), slotOf(a4)], ap: 0, casting: null, channelling: false },
        progress: { level: 1, molts: 0, seeds: 0, netWorth: 0 },
        inventory: { items: [], actives: [null, null, null, null] },
      });
    },
    unit(team, pos, hp = 260, height = 0.9) {
      const stats = ctx.stats.create({ maxHealth: hp });
      return store.spawn({
        kind: 'unit',
        team,
        pos: { ...pos },
        vel: { x: 0, y: 0, z: 0 },
        yaw: 0,
        radius: 0.45,
        unit: { type: 'scrapper', lane: null, height, owner: null, summon: null, target: null, attacking: false },
        health: { hp, talonShield: 0, songShield: 0, barrier: 0, dead: false, respawnAt: null, inCombatUntil: 0 },
        stats,
        statuses: [],
      });
    },
    structure(team, type, pos, hp, radius, height) {
      const stats = ctx.stats.create({ maxHealth: hp });
      return store.spawn({
        kind: 'structure',
        team,
        pos: { ...pos },
        vel: { x: 0, y: 0, z: 0 },
        yaw: 0,
        radius,
        structure: { type, lane: null, phase: 1, target: null, body: { radius, height }, weakPoint: null },
        health: { hp, talonShield: 0, songShield: 0, barrier: 0, dead: false, respawnAt: null, inCombatUntil: 0 },
        stats,
        statuses: [],
      });
    },
    pod(team, pos) {
      return store.spawn({
        kind: 'pickup',
        team,
        pos: { ...pos },
        vel: { x: 0, y: 0, z: 0 },
        yaw: 0,
        radius: 0.3,
        pickup: { type: 'pod', variant: '', value: 40, expiresAt: null, carrier: null },
      });
    },
    aimAt(h, point) {
      const b = ctx.heroes[h.hero.heroId].def.body;
      for (let i = 0; i < 8; i++) {
        const ray = aimRay(h.pos, h.yaw, h.pitch, h.shoulder, b, false);
        const dx = point.x - ray.origin.x;
        const dy = point.y - ray.origin.y;
        const dz = point.z - ray.origin.z;
        h.yaw = Math.atan2(dx, dz);
        h.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      }
      h.command = { ...h.command, yaw: h.yaw, pitch: h.pitch };
    },
    input(h, held, pressed = 0) {
      h.command = { ...h.command, held, pressed };
      if (pressed) oneShots.add(h);
    },
    mod(e, key, stats) {
      ctx.stats.set(e.id, key, { stats: stats.map(([stat, op, value]) => ({ stat, op, value })) });
    },
  };
  return kit;
}

