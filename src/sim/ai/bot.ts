/**
 * One bot hero (GDD §11): a utility choice of what to do every decision interval (§11.3) and, every tick, the
 * PlayerCommand that does it: walk the nav graph or ride an Updraft, aim like a person, shoot, cast, melee pickups,
 * buy and spend AP. Bots read only what their flock can see (`canSee`, GDD §11.1) plus public timers, and act only
 * through the command, like the human (INTERFACES §14.1).
 */
import { ABILITY_BUTTONS, Button, IDLE_COMMAND, ITEM_BUTTONS, LAYERS_SOLID } from '../core/contracts';
import type {
  AbilityDef, BotDifficulty, Entity, EntityId, HeroEntity, Hasher, ItemDef, ItemId, LaneId, NavLinkKind, PickupEntity,
  PlayerCommand, PlayerTeam, ShopAnchor, SimContext, StructureEntity, Tick, UnitEntity, Vec3,
} from '../core/contracts';
import { muzzlePoint, toWorld } from '../core/aim';
import * as dmath from '../core/dmath';
import { ticks } from '../core/math';
import { canSee } from '../core/vision';
import { AIM, AP_PRIORITY, CAST, DIFFICULTIES, FIGHT, LANE, NAV, OBJECTIVE, RETREAT, RIDE, SHOP } from '../data/ai';
import { BUILDS } from '../data/builds';
import { DEFENCE } from '../data/world';
import { acquire, createAim, kick, lookAlong, track, wrap } from './aim';
import type { LaneGeom } from './lanes';
import type { Nav, Route } from './nav';
import { choosePurchase, nextUpgrade, phaseOf } from './shop';
import type { ShopPolicy } from './shop';

export type Mode = 'lane' | 'fight' | 'retreat' | 'shop' | 'farm' | 'objective' | 'push' | 'defend';

/** What every bot of a sim shares. */
export interface Shared {
  readonly ctx: SimContext;
  readonly nav: Nav;
  readonly lanes: ReadonlyMap<LaneId, LaneGeom>;
  /** MapData.updrafts index per lane. */
  readonly updraftOf: ReadonlyMap<LaneId, number>;
  readonly catalogue: ReadonlyMap<ItemId, ItemDef>;
  /** Orders from pings and defence calls, by bot hero id. */
  readonly orders: Map<EntityId, { pos: Vec3; until: Tick }>;
  readonly policy: (team: PlayerTeam, heroId: HeroEntity['hero']['heroId']) => ShopPolicy;
}

export interface Bot {
  readonly id: EntityId;
  readonly team: PlayerTeam;
  readonly lane: LaneId;
  /** Write this tick's command (the ai phase). */
  tick(): void;
  /** Respawned or teleported: drop the route; adopt a yaw the move set. */
  moved(yaw?: number): void;
  mode(): Mode;
  hash(h: Hasher): void;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Use = 'enemy' | 'ally' | 'heal' | 'mobility' | 'buff' | 'nova';

const alive = (e: Entity | undefined): e is Entity => !!e && !e.removed && !('health' in e && e.health.dead);
const flat = (a: Vec3, b: Vec3): number => dmath.hypot(a.x - b.x, a.z - b.z);
const dist3 = (a: Vec3, b: Vec3): number => dmath.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const ehp = (e: HeroEntity): number => e.health.hp + e.health.talonShield + e.health.songShield + e.health.barrier;

/** Every `kind` named anywhere in an effect tree. */
function kindsIn(value: unknown, out: Set<string>): Set<string> {
  if (Array.isArray(value)) for (const v of value) kindsIn(v, out);
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'kind' && typeof v === 'string') out.add(v);
      else kindsIn(v, out);
    }
  }
  return out;
}

/** How a bot uses an ability or item active (GDD §11.2 ability use). */
function useOf(targeting: AbilityDef['targeting'], effects: unknown, allies: boolean): Use {
  const k = kindsIn(effects, new Set());
  const harms = k.has('damage') || k.has('projectile') || k.has('displace') || k.has('tether');
  const moves = k.has('dash') || k.has('teleport') || k.has('movementMode');
  if (targeting === 'unit') return allies ? 'ally' : 'enemy';
  if (targeting === 'self') return k.has('heal') || k.has('shield') ? 'heal' : harms ? 'nova' : moves ? 'mobility' : 'buff';
  return moves && !harms ? 'mobility' : allies && !harms ? 'ally' : 'enemy';
}

export function createBot(w: Shared, h: HeroEntity, lane: LaneId, side: 1 | -1, roamer: boolean): Bot {
  const ctx = w.ctx;
  const clock = ctx.clock;
  const def = ctx.heroes[h.hero.heroId].def;
  const body = def.body;
  const d = DIFFICULTIES[h.hero.controller as BotDifficulty];
  const rng = ctx.rng.stream('ai/' + h.hero.heroId);
  const shopRng = ctx.rng.stream('ai/' + h.hero.heroId + '/shop');
  const team = h.team;
  const geom = w.lanes.get(lane);
  const roost = ctx.map.shops.find((s) => s.team === team && s.kind === 'roost');
  const home = roost?.pos ?? ctx.map.spawns.find((s) => s.team === team)?.pos ?? { ...h.pos };
  const costs = Object.fromEntries(Object.entries(NAV.cost).map(([k, c]) => [k, d.links.includes(k as NavLinkKind) ? c : Infinity])) as
    Record<NavLinkKind, number>;
  const decisionTicks = Math.max(1, ticks(d.decisionS));
  const gunRange = Math.min(def.weapon.range, def.weapon.falloff.end + FIGHT.pastFalloffM);
  const sweet = Math.min(gunRange, Math.max(FIGHT.minSweetM, def.weapon.falloff.start || FIGHT.defaultRangeM));
  const uses = def.abilities.map((a) => useOf(a.targeting, [a.effects, a.selfEffects ?? []], a.affects?.teams === 'allies'));
  const apOrder = AP_PRIORITY[h.hero.heroId];

  const aim = createAim(h.yaw);
  const cmd: Mutable<PlayerCommand> = { ...IDLE_COMMAND, yaw: h.yaw };
  let next: Tick = clock.tick + 1 + (h.hero.slot % decisionTicks);
  let mode: Mode = 'lane';
  let goal: Vec3 | null = null;
  let target: EntityId | null = null;
  let targetPoint: Vec3 | null = null;
  /** Melee a pickup: its id and light or heavy. */
  let claim: { id: EntityId; heavy: boolean } | null = null;
  let strafe = false;
  let rideOk = false;
  let homeRetreat = false;
  // Route following.
  let route: Route | null = null;
  let step = 0;
  let routeGoal: Vec3 | null = null;
  let routeAt: Tick = 0;
  let bestD = Infinity;
  let bestAt: Tick = 0;
  // Buttons spanning several ticks.
  let jumpUntil: Tick = 0;
  let meleeUntil: Tick = 0;
  let meleeAt: Tick = 0;
  let castAt: Tick = 0;
  let dashAt: Tick = 0;
  let strafeDir: 1 | -1 = side;
  let strafeUntil: Tick = 0;
  let buyAt: Tick = 0;
  let plan: { buy: ItemId; sell: ItemId | null } | null = null;
  // Updraft riding: latching since, or riding.
  let latchFrom: Tick | null = null;
  let rideCooldown: Tick = 0;
  let jumpReleased = false;
  /** Decisions made once per entity (last hits, pods, denies) and enemy last-seen points. */
  const decided = new Map<EntityId, number>();
  const lastSeen = new Map<EntityId, { pos: Vec3; at: Tick }>();
  let lastEnemyNearAt: Tick = 0;

  const hpFrac = (): number => h.health.hp / Math.max(1, h.stats.final.maxHealth);
  const shot = (): number => h.stats.final.weaponDamage * def.weapon.pellets;
  const dps = (e: HeroEntity): number => {
    const w0 = ctx.heroes[e.hero.heroId].def.weapon;
    return e.stats.final.weaponDamage * w0.pellets * w0.fireRate;
  };
  const myProgress = (): number => (geom ? geom.forward(team, geom.project(h.pos).s) : 0);

  // ── Perception ────────────────────────────────────────────────────────────────────────────────────────────
  const enemyHeroes = (): HeroEntity[] => ctx.store.list('hero').filter((e) => e.team !== team && alive(e) && canSee(team, e));
  const allyHeroes = (): HeroEntity[] => ctx.store.list('hero').filter((e) => e.team === team && alive(e));

  /** GDD §11.3 local fight score: allied vs enemy (effective HP × DPS) within FIGHT.scoreRadiusM, towers included. */
  function fightScore(foes: readonly HeroEntity[], friends: readonly HeroEntity[]): number {
    let ours = 0;
    let theirs = 0;
    for (const a of friends) if (flat(a.pos, h.pos) <= FIGHT.scoreRadiusM) ours += ehp(a) * dps(a);
    for (const e of foes) if (flat(e.pos, h.pos) <= FIGHT.scoreRadiusM) theirs += ehp(e) * dps(e);
    for (const s of ctx.store.list('structure')) {
      if (s.structure.type === 'nest' || !alive(s)) continue;
      const def0 = DEFENCE[s.structure.type as keyof typeof DEFENCE] as { range: number; heroHit: number; interval: number } | undefined;
      if (!def0 || flat(s.pos, h.pos) > def0.range) continue;
      const v = (s.health.hp * def0.heroHit) / def0.interval;
      if (s.team === team) ours += v * FIGHT.towerWeight;
      else theirs += v * FIGHT.towerWeight;
    }
    return theirs === 0 ? Infinity : ours / theirs;
  }

  // ── Targets ───────────────────────────────────────────────────────────────────────────────────────────────
  function aimPoint(e: Entity, head: boolean): Vec3 {
    switch (e.kind) {
      case 'hero': {
        const b = ctx.heroes[e.hero.heroId].def.body;
        return head ? toWorld(e.pos, e.yaw, b.head.centre) : { x: e.pos.x, y: e.pos.y + b.height * AIM.bodyFraction, z: e.pos.z };
      }
      case 'unit':
        return { x: e.pos.x, y: e.pos.y + e.unit.height * AIM.bodyFraction, z: e.pos.z };
      case 'structure':
        return e.structure.weakPoint
          ? { ...e.structure.weakPoint.centre }
          : { x: e.pos.x, y: e.pos.y + Math.min(AIM.structureAimM, e.structure.body.height * AIM.bodyFraction), z: e.pos.z };
      default:
        return { ...e.pos };
    }
  }
  /** Distance from the muzzle to a point (the structure's surface for towers). */
  function reach(e: Entity): number {
    const r = e.kind === 'structure' ? e.structure.body.radius : 0;
    return Math.max(0, flat(e.pos, h.pos) - r);
  }
  /** Nothing solid between the muzzle and the point. */
  function clear(e: Entity, p: Vec3): boolean {
    const from = muzzlePoint(h.pos, h.yaw, body, h.motor.crouching);
    const dx = p.x - from.x;
    const dy = p.y - from.y;
    const dz = p.z - from.z;
    const len = dmath.hypot(dx, dy, dz);
    if (len < FIGHT.meleeM) return true;
    const hit = ctx.physics.raycast(from, { x: dx / len, y: dy / len, z: dz / len }, len, LAYERS_SOLID, h.id);
    return !hit || hit.entity === e.id || hit.distance > len - FIGHT.losSlackM;
  }
  /** A once-per-entity seeded decision ("does this bot try for this last hit / pod"). */
  function once(id: EntityId, p: number): boolean {
    let v = decided.get(id);
    if (v === undefined) {
      v = rng.next();
      decided.set(id, v);
    }
    return v < p;
  }
  /** Enemy tower whose reach covers p, unless it is busy with this flock's fledglings. */
  function towerThreat(p: Vec3): StructureEntity | null {
    for (const s of ctx.store.list('structure')) {
      if (s.team === team || s.structure.type === 'nest' || !alive(s)) continue;
      const def0 = DEFENCE[s.structure.type as keyof typeof DEFENCE] as { range: number } | undefined;
      if (!def0 || flat(s.pos, p) > def0.range + s.structure.body.radius + LANE.towerMarginM) continue;
      const t = s.structure.target === null ? undefined : ctx.store.get(s.structure.target);
      if (t && t.kind === 'unit' && t.team === team) continue;
      return s;
    }
    return null;
  }
  /** Lane-time target (GDD §11.3 Lane): pods, last hits, a poke, the tower on the wave, the enemy wave, Nests. */
  function laneTarget(foes: readonly HeroEntity[], poke: boolean): Entity | null {
    const now = clock.tick;
    const ripeTicks = ticks(POD_RIPE_S);
    let best: Entity | null = null;
    let bestScore = -Infinity;
    const offer = (e: Entity, score: number): void => {
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    };
    for (const p of ctx.store.list('pickup')) {
      if (p.pickup.type !== 'pod' || p.team === 'neutral' || !canSee(team, p) || p.pickup.expiresAt === null) continue;
      if (reach(p) > gunRange) continue;
      const mine = p.team !== team;
      if (!once(p.id, mine ? d.lastHitRate : d.denyRate)) continue;
      // Shot at the ripe moment ± the difficulty's timing error (early shots pass through the rising pod).
      const err = ((decided.get(p.id) ?? 0) * 2 - 1) * d.podTimingS;
      if (now < p.pickup.expiresAt - ripeTicks + ticks(Math.max(0, err))) continue;
      offer(p, PRIORITY.pod - reach(p) / gunRange);
    }
    const lastHit = shot() * FIGHT.lastHitMargin;
    for (const u of ctx.store.list('unit')) {
      if (u.team === team || !alive(u) || !canSee(team, u) || reach(u) > gunRange) continue;
      if (u.team === 'neutral') continue;
      const frac = reach(u) / gunRange;
      if (u.health.hp <= lastHit && once(u.id, d.lastHitRate)) offer(u, PRIORITY.lastHit - frac);
      else offer(u, PRIORITY.wave - frac - u.health.hp / u.stats.final.maxHealth);
    }
    if (poke) {
      for (const e of foes) {
        if (reach(e) > gunRange || towerThreat(h.pos)) continue;
        if (hpFrac() >= (e.health.hp / Math.max(1, e.stats.final.maxHealth)) * FIGHT.pokeHpRatio) offer(e, PRIORITY.poke - reach(e) / gunRange);
      }
    }
    for (const s of ctx.store.list('structure')) {
      if (s.team === team || !alive(s) || reach(s) > gunRange || s.stats.conditions.has('invulnerable')) continue;
      if (s.structure.type === 'nest') {
        if (s.structure.breakable?.by === 'any' && reach(s) <= OBJECTIVE.nestShootM) offer(s, PRIORITY.nest - reach(s) / gunRange);
        continue;
      }
      if (s.structure.broodWard && foes.length > 0) continue;
      const t = s.structure.target === null ? undefined : ctx.store.get(s.structure.target);
      const onWave = !!t && t.kind === 'unit' && t.team === team;
      if (onWave || towerThreat(h.pos) === null) offer(s, PRIORITY.structure - reach(s) / gunRange);
    }
    return best;
  }

  /** GDD §11.3 Fight: the visible enemy hero with the lowest effective HP in range, supports and carries first. */
  function fightTarget(foes: readonly HeroEntity[]): HeroEntity | null {
    let best: HeroEntity | null = null;
    let bestV = Infinity;
    const current = target === null ? undefined : ctx.store.get(target);
    for (const e of foes) {
      if (flat(e.pos, h.pos) > FIGHT.engageM) continue;
      const arche = ctx.heroes[e.hero.heroId].def.archetype;
      let v = ehp(e) * (FIGHT.preferred.includes(arche) ? FIGHT.preferredWeight : 1);
      if (e === current) v *= FIGHT.switchRatio;
      if (v < bestV) {
        bestV = v;
        best = e;
      }
    }
    return best;
  }

  // ── Decisions (GDD §11.3) ─────────────────────────────────────────────────────────────────────────────────
  function lanePoint(f: number): Vec3 {
    if (!geom) return { ...home };
    const s = geom.fromForward(team, f);
    const off = Math.min(LANE.sideM, Math.max(0, geom.halfWidth - 1)) * side * (team === 'dawn' ? 1 : -1);
    return geom.at(s, off);
  }
  /** Where to stand in the lane: behind the own wave, short of the enemy wave and outside enemy tower reach. */
  function laneStand(push: boolean): Vec3 {
    if (!geom) return { ...home };
    let ownFront = -Infinity;
    let enemyFront = Infinity;
    for (const u of ctx.store.list('unit')) {
      if (u.unit.lane !== lane || !alive(u)) continue;
      const f = geom.forward(team, geom.project(u.pos).s);
      if (f < LANE.gateM || f > geom.length - LANE.gateM) continue;
      if (u.team === team) ownFront = Math.max(ownFront, f);
      else if (canSee(team, u)) enemyFront = Math.min(enemyFront, f);
    }
    let towerF = 0;
    let enemyTowerF = geom.length;
    let enemyTowerReach = 0;
    let busy = false;
    for (const s of ctx.store.list('structure')) {
      if (s.structure.lane !== lane || !alive(s) || s.structure.type === 'nest') continue;
      const f = geom.forward(team, geom.project(s.pos).s);
      if (s.team === team) towerF = Math.max(towerF, f);
      else if (f < enemyTowerF) {
        enemyTowerF = f;
        const def0 = DEFENCE[s.structure.type as keyof typeof DEFENCE] as { range: number } | undefined;
        enemyTowerReach = (def0?.range ?? 0) + s.structure.body.radius;
        const t = s.structure.target === null ? undefined : ctx.store.get(s.structure.target);
        busy = !!t && t.kind === 'unit' && t.team === team;
      }
    }
    let f = Number.isFinite(ownFront) ? ownFront - LANE.behindWaveM : towerF + LANE.aheadOfTowerM;
    if (Number.isFinite(enemyFront)) f = Math.min(f, enemyFront - LANE.shortOfEnemyM);
    const safe = busy || push ? enemyTowerF - LANE.towerStandM : enemyTowerF - enemyTowerReach - LANE.towerMarginM;
    f = Math.min(f, safe);
    if (!Number.isFinite(ownFront)) f = Math.max(Math.min(f, towerF + LANE.aheadOfTowerM), Math.min(towerF, f));
    return lanePoint(Math.max(0, f));
  }

  function decide(): void {
    const now = clock.tick;
    const foes = enemyHeroes();
    const friends = allyHeroes();
    for (const e of foes) lastSeen.set(e.id, { pos: { ...e.pos }, at: now });
    const near = foes.filter((e) => flat(e.pos, h.pos) <= FIGHT.scoreRadiusM);
    if (near.length > 0) lastEnemyNearAt = now;
    const alliesNear = friends.filter((a) => flat(a.pos, h.pos) <= FIGHT.scoreRadiusM);
    const score = near.length > 0 ? fightScore(foes, friends) : Infinity;
    const hp = hpFrac();
    target = null;
    claim = null;
    strafe = false;
    rideOk = false;
    const egg = ctx.objectives.egg;
    const eggEntity = egg?.pickup == null ? undefined : ctx.store.getKind(egg.pickup, 'pickup');
    const carrying = eggEntity?.pickup.carrier === h.id;

    // Carrying the Golden Egg: straight to the Hatching Stone (the other perch), whatever else happens.
    if (carrying && egg) {
      mode = 'objective';
      goal = { ...(ctx.map.eggPerches[1 - egg.perch]?.pos ?? home) };
      return;
    }
    // Retreat (GDD §11.3): HP under the threshold → the Home Roost until healed; outnumbered or losing → fall back.
    if (homeRetreat && hp < RETREAT.healedHp) {
      mode = 'retreat';
      goal = { ...home };
      return;
    }
    homeRetreat = false;
    if (hp < d.retreatHp) {
      homeRetreat = true;
      mode = 'retreat';
      goal = { ...home };
      return;
    }
    if (near.length - alliesNear.length >= FIGHT.outnumberedBy || score < FIGHT.retreatScore ||
      (mode === 'retreat' && near.length > 0 && score < FIGHT.regroupScore)) {
      mode = 'retreat';
      goal = geom ? lanePoint(Math.max(0, myProgress() - FIGHT.fallBackM)) : { ...home };
      const e = fightTarget(near);
      if (e && reach(e) <= gunRange) target = e.id;
      return;
    }
    // Fight: an enemy hero within 35 m and the fight score at least 0.9.
    const prey = fightTarget(foes);
    if (prey && score >= FIGHT.engageScore) {
      mode = 'fight';
      target = prey.id;
      strafe = d.strafe;
      const gap = flat(prey.pos, h.pos);
      goal = gap > sweet ? { ...prey.pos } : gap < sweet * FIGHT.tooCloseFraction ? away(prey.pos) : null;
      return;
    }
    // Chase a lost fight target to where it was last seen (Raptor).
    if (d.lastSeen && mode === 'fight') {
      for (const [, seen] of lastSeen) {
        if (now - seen.at <= ticks(FIGHT.chaseS) && flat(seen.pos, h.pos) <= FIGHT.engageM) {
          goal = { ...seen.pos };
          return;
        }
      }
    }
    // Orders: a ping to answer, or an allied structure to defend.
    const order = w.orders.get(h.id);
    if (order && order.until > now) {
      mode = 'defend';
      goal = { ...order.pos };
      const t = laneTarget(foes, true);
      target = t?.id ?? null;
      return;
    }
    if (order) w.orders.delete(h.id);
    // Objectives: the Egg, runes, Embers and the Roc.
    if (objectives(foes, friends, eggEntity)) return;
    // Shop trips (GDD §11.3 Shop; §11.2 shopping by difficulty).
    const stall = shopTrip(near.length > 0);
    if (stall) {
      mode = 'shop';
      goal = { ...stall.pos };
      return;
    }
    // Push and siege after 20:00, with Rekindle, or with enemies dead (GDD §11.3).
    const deadEnemies = ctx.store.list('hero').filter((e) => e.team !== team && e.health.dead).length;
    const rekindle = (ctx.teams[team].rekindle?.until ?? 0) > now;
    const push = clock.seconds >= OBJECTIVE.pushFromS || rekindle || deadEnemies >= OBJECTIVE.pushDeadEnemies;
    // Farming: the roamer after 10:00, or anyone whose lane has no own wave to escort and nothing visible.
    if (!push && foes.length === 0 && farm()) return;
    mode = push ? 'push' : 'lane';
    goal = siegeGoal(push) ?? laneStand(push);
    const t = laneTarget(foes, true);
    target = t?.id ?? null;
    rideOk = true;
  }

  /** A point straight away from p, for backing off. */
  function away(p: Vec3): Vec3 {
    const dx = h.pos.x - p.x;
    const dz = h.pos.z - p.z;
    const len = dmath.hypot(dx, dz) || 1;
    return { x: h.pos.x + (dx / len) * FIGHT.backOffM, y: h.pos.y, z: h.pos.z + (dz / len) * FIGHT.backOffM };
  }

  /** The shop to walk to, if a trip is due (§11.3 Shop, §11.2 shopping). */
  function shopTrip(threatened: boolean): ShopAnchor | null {
    if (threatened || !plan) return null;
    const seeds = h.progress.seeds;
    const usable = ctx.map.shops.filter((s) => (s.team === team || s.neutral) && (d.shops === 'own' || s.kind === 'roost'));
    let best: ShopAnchor | null = null;
    for (const s of usable) if (!best || flat(s.pos, h.pos) < flat(best.pos, h.pos)) best = s;
    if (!best) return null;
    if (d.leaveLaneSeeds !== null && seeds >= d.leaveLaneSeeds) return best;
    return d.shops === 'own' && seeds >= SHOP.tripSeeds && flat(best.pos, h.pos) <= SHOP.tripM ? best : null;
  }

  /** The next enemy structure to besiege in order (Hawk → Heron → Wardens → Shrines → Patron) once the lane is open. */
  function siegeGoal(push: boolean): Vec3 | null {
    if (!push || !geom) return null;
    const open = ctx.store.list('structure').filter((s) => s.team !== team && s.structure.type !== 'nest' && alive(s));
    if (open.some((s) => s.structure.lane === lane)) return null;
    const inner = open.filter((s) => s.structure.lane === null);
    let best: StructureEntity | null = null;
    for (const s of inner) if (!best || flat(s.pos, h.pos) < flat(best.pos, h.pos)) best = s;
    if (!best) return null;
    // Stand short of it on the line from the lane's enemy gate.
    const gate = lanePoint(geom.length);
    const dx = gate.x - best.pos.x;
    const dz = gate.z - best.pos.z;
    const len = dmath.hypot(dx, dz) || 1;
    const back = best.structure.body.radius + LANE.towerStandM;
    return { x: best.pos.x + (dx / len) * back, y: gate.y, z: best.pos.z + (dz / len) * back };
  }

  /** GDD §11.3 Objective and §11.7: the Egg, runes, Embers and the Roc. Sets mode and returns true when one applies. */
  function objectives(foes: readonly HeroEntity[], friends: readonly HeroEntity[], egg: PickupEntity | undefined): boolean {
    const now = clock.tick;
    const nearest = (p: Vec3, n: number): boolean => {
      const order = friends.filter((a) => w.bots.has(a.id) || a.id === h.id).sort((a, b) => flat(a.pos, p) - flat(b.pos, p) || a.id - b.id);
      return order.slice(0, n).some((a) => a.id === h.id);
    };
    // The Golden Egg: the nearest bots go; the poorest of them takes it with a light melee, the rest escort.
    if (egg && alive(egg)) {
      const carrier = egg.pickup.carrier === null ? undefined : ctx.store.getKind(egg.pickup.carrier, 'hero');
      if (carrier && carrier.team === team) {
        if (nearest(carrier.pos, OBJECTIVE.eggBots)) {
          mode = 'objective';
          goal = { ...carrier.pos };
          target = laneTarget(foes, true)?.id ?? null;
          return true;
        }
      } else if (carrier) {
        // Enemy carrier: top target for whoever sees it.
        if (canSee(team, carrier) && flat(carrier.pos, h.pos) <= OBJECTIVE.runeM) {
          mode = 'fight';
          target = carrier.id;
          goal = { ...carrier.pos };
          return true;
        }
      } else if (nearest(egg.pos, OBJECTIVE.eggBots)) {
        mode = 'objective';
        goal = { ...egg.pos };
        const group = friends.filter((a) => flat(a.pos, egg.pos) <= OBJECTIVE.rocNearM).sort((a, b) =>
          a.progress.netWorth - b.progress.netWorth || a.id - b.id);
        if ((group[0]?.id ?? h.id) === h.id && (egg.pickup.claimableAt ?? 0) <= now) claim = { id: egg.id, heavy: false };
        else target = laneTarget(foes, true)?.id ?? null;
        return true;
      }
    }
    // Feather runes and Phoenix Embers: heavy melee claims.
    for (const p of ctx.store.list('pickup')) {
      if (p.pickup.type !== 'rune' && p.pickup.type !== 'ember') continue;
      const range = p.pickup.type === 'rune' ? OBJECTIVE.runeM : OBJECTIVE.emberM;
      if (flat(p.pos, h.pos) > range || (p.pickup.claimableAt ?? 0) > now + ticks(OBJECTIVE.runeSoonS)) continue;
      if (!nearest(p.pos, p.pickup.type === 'rune' ? 1 : OBJECTIVE.emberBots)) continue;
      mode = 'objective';
      goal = { ...p.pos };
      if ((p.pickup.claimableAt ?? 0) <= now) claim = { id: p.id, heavy: true };
      return true;
    }
    // A rune due soon at a spot within reach: wait there.
    const runeAt = ctx.objectives.runeAt;
    if (runeAt) {
      for (const [i, at] of runeAt.entries()) {
        const spot = ctx.map.runeSpots[i];
        if (at === null || !spot || at - now > ticks(OBJECTIVE.runeSoonS) || flat(spot.pos, h.pos) > OBJECTIVE.runeM) continue;
        if (!nearest(spot.pos, 1)) continue;
        mode = 'objective';
        goal = { ...spot.pos };
        target = laneTarget(foes, true)?.id ?? null;
        return true;
      }
    }
    // The Roc (GDD §11.3): enough allies near the Hollow and the enemy thinned or out of sight → fight it from the floor.
    const hollow = ctx.map.hollow;
    const roc = hollow ? ctx.store.list('unit').find((u) => u.unit.type === 'roc' && alive(u)) : undefined;
    if (hollow && roc && !roc.unit.asleep === false) {
      // Asleep before 20:00: nothing to do.
    } else if (hollow && roc) {
      const nearHollow = friends.filter((a) => flat(a.pos, hollow.centre) <= hollow.radius + OBJECTIVE.rocNearM);
      const dead = ctx.store.list('hero').filter((e) => e.team !== team && e.health.dead).length;
      const quiet = now - lastEnemyNearAt > ticks(OBJECTIVE.rocClearS) && !foes.some((e) => flat(e.pos, hollow.centre) <= OBJECTIVE.rocClearM);
      if (nearHollow.length >= OBJECTIVE.rocAllies && (dead >= OBJECTIVE.rocDeadEnemies || quiet) && flat(h.pos, hollow.centre) <= hollow.radius + OBJECTIVE.rocNearM) {
        mode = 'objective';
        goal = { x: hollow.centre.x, y: hollow.floorY, z: hollow.centre.z };
        target = flat(roc.pos, h.pos) <= gunRange ? roc.id : null;
        return true;
      }
    }
    return false;
  }

  /** GDD §11.3 Farm: Thickets by tier and level, the roamer from 10:00. */
  function farm(): boolean {
    const own = geom ? ctx.store.list('unit').some((u) => u.team === team && u.unit.lane === lane && alive(u)) : false;
    const rotating = roamer && d.rotates && clock.seconds >= OBJECTIVE.rotateFromS;
    if (!rotating && own) return false;
    const level = h.progress.level;
    let best: UnitEntity | null = null;
    for (const u of ctx.store.list('unit')) {
      if (u.team !== 'neutral' || u.unit.camp == null || !alive(u) || !canSee(team, u)) continue;
      const anchor = ctx.map.thickets[u.unit.camp];
      if (!anchor || flat(anchor.pos, h.pos) > OBJECTIVE.farmM) continue;
      const tier = anchor.tier;
      const ok = tier === 1 || (tier === 2 && level >= OBJECTIVE.tier2Level && d.shops === 'own') ||
        (tier === 3 && level >= OBJECTIVE.tier3Level && d.shops === 'own');
      if (!ok) continue;
      if (!best || flat(u.pos, h.pos) < flat(best.pos, h.pos)) best = u;
    }
    if (!best) return false;
    mode = 'farm';
    const gap = flat(best.pos, h.pos);
    goal = gap > OBJECTIVE.farmStandM ? { ...best.pos } : null;
    target = best.id;
    return true;
  }

  // ── Movement ──────────────────────────────────────────────────────────────────────────────────────────────
  /** Steer round small towers the nav graph runs through (nav.ts). */
  function avoid(dx: number, dz: number): { x: number; z: number } {
    let x = dx;
    let z = dz;
    for (const s of ctx.store.list('structure')) {
      if (s.structure.type === 'nest' || s.structure.solid === false) continue;
      const r = s.structure.body.radius + NAV.structureClearM;
      const cx = s.pos.x - h.pos.x;
      const cz = s.pos.z - h.pos.z;
      const c = dmath.hypot(cx, cz);
      if (c > r + NAV.avoidAheadM || s.pos.y > h.pos.y + body.height || s.pos.y + s.structure.body.height < h.pos.y) continue;
      if (c < r) {
        // Inside the margin: push straight out, still heading on.
        x -= (cx / c) * NAV.avoidPush;
        z -= (cz / c) * NAV.avoidPush;
        continue;
      }
      const along = cx * x + cz * z;
      if (along <= 0) continue;
      const perpX = cx - along * x;
      const perpZ = cz - along * z;
      const miss = dmath.hypot(perpX, perpZ);
      if (miss >= r) continue;
      // Slide past on the side the heading already leans to.
      const pl = miss || 1;
      const sx = miss > 0 ? -perpX / pl : -cz / c;
      const sz = miss > 0 ? -perpZ / pl : cx / c;
      x += sx * (r - miss) / r;
      z += sz * (r - miss) / r;
    }
    const len = dmath.hypot(x, z) || 1;
    return { x: x / len, z: z / len };
  }

  /** World direction toward `to` along the nav graph, and the link being crossed. */
  function steer(to: Vec3): { x: number; z: number; kind: NavLinkKind } | null {
    const now = clock.tick;
    const straight = (p: Vec3): { x: number; z: number; kind: NavLinkKind } | null => {
      const dx = p.x - h.pos.x;
      const dz = p.z - h.pos.z;
      const len = dmath.hypot(dx, dz);
      return len < NAV.arriveM ? null : { x: dx / len, z: dz / len, kind: 'walk' };
    };
    if (w.nav.size === 0 || (flat(to, h.pos) <= NAV.directM && Math.abs(to.y - h.pos.y) < NAV.arriveDy)) return straight(to);
    if (!route || !routeGoal || flat(routeGoal, to) > NAV.goalMovedM || now - routeAt > ticks(NAV.replanS)) {
      const start = w.nav.nearest(h.pos);
      route = w.nav.route(start, w.nav.nearest(to), costs);
      routeGoal = { ...to };
      routeAt = now;
      step = 0;
      bestD = Infinity;
      bestAt = now;
      // Skip a start node behind us.
      if (route && route.nodes.length > 1) {
        const a = w.nav.node(route.nodes[0]!);
        const b = w.nav.node(route.nodes[1]!);
        if (flat(h.pos, b) < flat(a, b) && route.kinds[1] === 'walk') step = 1;
      }
    }
    if (!route) return straight(to);
    while (step < route.nodes.length) {
      const p = w.nav.node(route.nodes[step]!);
      if (flat(p, h.pos) < arriveRadius(p) && Math.abs(p.y - h.pos.y) < NAV.arriveDy) {
        step++;
        bestD = Infinity;
        bestAt = now;
      } else break;
    }
    if (step >= route.nodes.length) return straight(to);
    const p = w.nav.node(route.nodes[step]!);
    const dd = dist3(p, h.pos);
    if (dd < bestD - NAV.stuckProgressM) {
      bestD = dd;
      bestAt = now;
    } else if (now - bestAt > ticks(NAV.stuckS) * 2) {
      // Stuck: replan from where we are next decision, and try the next node meanwhile.
      route = null;
      return straight(p);
    } else if (now - bestAt > ticks(NAV.stuckS) && h.motor.grounded) jumpUntil = now + ticks(NAV.jumpHoldS);
    const dir = straight(p) ?? { x: 0, z: 0, kind: 'walk' as NavLinkKind };
    return { x: dir.x, z: dir.z, kind: route.kinds[step] ?? 'walk' };
  }
  /** A waypoint at a tower's anchor counts as reached at the tower's edge. */
  function arriveRadius(p: Vec3): number {
    for (const s of ctx.map.structures) {
      if (flat(s.pos, p) < NAV.arriveM) return NAV.arriveM + NAV.structureClearM + (ctx.store.list('structure').find((e) => flat(e.pos, s.pos) < NAV.arriveM)?.structure.body.radius ?? 0);
    }
    return NAV.arriveM;
  }

  /** GDD §3.7: latch the lane's Updraft by holding Jump, ride, and jump off near the goal. Returns true while handling it. */
  function ride(now: Tick, foesNear: boolean): boolean {
    const updraft = w.updraftOf.get(lane);
    if (!geom || updraft === undefined || !goal) return false;
    const me = geom.project(h.pos);
    const g = geom.project(goal);
    const left = g.s - me.s;
    if (h.motor.updraft !== null) {
      latchFrom = null;
      cmd.forward = 0;
      cmd.right = 0;
      const d0 = geom.dir(me.s);
      lookAlong(aim, dmath.atan2(d0.x * Math.sign(left || 1), d0.z * Math.sign(left || 1)), 0, d);
      if (!jumpReleased) {
        jumpReleased = true;
        return true;
      }
      // Off near the goal, past it, with danger near, or when no longer wanted.
      if (Math.abs(left) <= RIDE.offM || foesNear || !rideOk || mode !== 'lane') {
        cmd.held |= Button.Jump;
        cmd.pressed |= Button.Jump;
        rideCooldown = now + ticks(RIDE.giveUpS);
      }
      return true;
    }
    if (!rideOk || foesNear || now < rideCooldown || Math.abs(left) < RIDE.minM || me.off > LANE.corridorM) {
      latchFrom = null;
      return false;
    }
    if (h.motor.updraftInReach !== updraft || h.stats.conditions.has('eggCarrier')) return latchFrom !== null && now - latchFrom < ticks(RIDE.giveUpS) ? holdLatch(me.s, left) : false;
    latchFrom ??= now;
    if (now - latchFrom > ticks(RIDE.giveUpS)) {
      latchFrom = null;
      rideCooldown = now + ticks(RIDE.giveUpS) * 2;
      return false;
    }
    return holdLatch(me.s, left);
  }
  function holdLatch(s: number, left: number): boolean {
    const d0 = geom!.dir(s);
    const sign = Math.sign(left) || 1;
    // Face the end to ride toward (the ride goes the way the camera faces at the latch), hold Jump, stand still.
    aim.yaw = dmath.atan2(d0.x * sign, d0.z * sign);
    aim.pitch = 0;
    cmd.forward = 0;
    cmd.right = 0;
    cmd.held |= Button.Jump;
    if ((h.command.held & Button.Jump) === 0) cmd.pressed |= Button.Jump;
    jumpReleased = false;
    return true;
  }

  // ── Abilities and item actives (GDD §11.2) ────────────────────────────────────────────────────────────────
  function cast(now: Tick, foe: HeroEntity | null, foesNear: number): void {
    if (now < castAt || h.abilities.casting !== null || h.stats.conditions.has('silenced') || h.motor.updraft !== null) return;
    const hp = hpFrac();
    const gap = foe ? flat(foe.pos, h.pos) : Infinity;
    const onTarget = foe !== null && aim.target === foe.id && now >= aim.fireFrom;
    for (let i = 0; i < ABILITY_BUTTONS.length; i++) {
      const s = h.abilities.slots[i]!;
      if (!s.unlocked || s.readyAt > now || s.charges <= 0) continue;
      const a = def.abilities[i]!;
      const range = a.range > 0 ? a.range : CAST.defaultRangeM;
      const use = uses[i]!;
      let go = false;
      switch (use) {
        case 'enemy':
          go = onTarget && gap <= range * (d.abilities === 'inRange' ? 1 : CAST.predictRange);
          break;
        case 'nova':
          go = foe !== null && gap <= CAST.novaM;
          break;
        case 'heal':
        case 'ally':
          go = hp < CAST.healHp && h.health.inCombatUntil > now && (use === 'heal' || a.selfFallback === true);
          break;
        case 'mobility':
          go = (mode === 'retreat' && foe !== null && gap <= RETREAT.escapeM) || (mode === 'fight' && gap > sweet && gap <= range + sweet && hp > CAST.healHp);
          break;
        case 'buff':
          go = mode === 'fight' && foe !== null && gap <= gunRange;
          break;
      }
      // Raptor holds its ultimate for 2+ heroes or a likely kill (GDD §11.2).
      if (go && i === ABILITY_BUTTONS.length - 1 && d.abilities === 'chain' && foe && (use === 'enemy' || use === 'nova')) {
        go = foesNear >= CAST.holdHeroes || foe.health.hp / Math.max(1, foe.stats.final.maxHealth) <= CAST.holdKillHp;
      }
      if (!go) continue;
      cmd.held |= ABILITY_BUTTONS[i]!;
      cmd.pressed |= ABILITY_BUTTONS[i]!;
      castAt = now + ticks(CAST.everyS);
      return;
    }
    // Item actives: the same rules, on Z, X, C, V.
    for (let i = 0; i < ITEM_BUTTONS.length; i++) {
      const id = h.inventory.actives[i];
      const owned = id ? h.inventory.items.find((o) => o.item === id) : undefined;
      const active = id ? w.catalogue.get(id)?.active : null;
      if (!active || !owned || owned.readyAt > now) continue;
      const use = useOf(active.targeting, active.effects, active.affects?.teams === 'allies');
      const go = use === 'enemy' ? onTarget && gap <= (active.range || CAST.defaultRangeM)
        : use === 'heal' || use === 'ally' ? hp < CAST.healHp && h.health.inCombatUntil > now
          : use === 'mobility' ? mode === 'retreat' && foe !== null && gap <= RETREAT.escapeM
            : foe !== null && gap <= gunRange && mode === 'fight';
      if (!go) continue;
      cmd.held |= ITEM_BUTTONS[i]!;
      cmd.pressed |= ITEM_BUTTONS[i]!;
      castAt = now + ticks(CAST.everyS);
      return;
    }
  }

  // ── The command ───────────────────────────────────────────────────────────────────────────────────────────
  function shop(now: Tick): void {
    if (h.inventory.shopZone == null || now < buyAt) return;
    const phase = phaseOf(clock.seconds, BUILDS.phases);
    const slots = ITEM_SLOTS + ctx.teams[team].flexSlots;
    plan ??= choosePurchase(h, w.catalogue, w.policy(team, h.hero.heroId), phase, slots, shopRng);
    if (!plan) return;
    buyAt = now + SHOP.buyEveryTicks;
    if (plan.sell && h.inventory.items.some((o) => o.item === plan!.sell)) {
      cmd.sell = plan.sell;
      return;
    }
    cmd.buy = plan.buy;
    plan = null;
  }

  function tick(): void {
    const now = clock.tick;
    cmd.held = 0;
    cmd.pressed = 0;
    cmd.buy = null;
    cmd.sell = null;
    cmd.upgrade = null;
    cmd.ping = null;
    cmd.forward = 0;
    cmd.right = 0;
    const slot = apOrder ? nextUpgrade(h, apOrder) : null;
    if (slot !== null) cmd.upgrade = slot;
    if (h.health.dead) {
      route = null;
      target = null;
      latchFrom = null;
      homeRetreat = false;
      mode = 'lane';
      plan = null;
      cmd.yaw = aim.yaw;
      cmd.pitch = aim.pitch;
      h.command = cmd;
      return;
    }
    if (now >= next) {
      next = now + decisionTicks;
      decide();
      // Plan the next purchase once per decision when there is money to spend (the shop-trip rule reads it).
      if (!plan && h.progress.seeds >= MIN_ITEM_COST) {
        plan = choosePurchase(h, w.catalogue, w.policy(team, h.hero.heroId), phaseOf(clock.seconds, BUILDS.phases),
          ITEM_SLOTS + ctx.teams[team].flexSlots, shopRng);
      }
    }
    shop(now);

    // Aim: the target, else the claim, else along the way.
    const t = target === null ? undefined : ctx.store.get(target);
    if (target !== null && (!alive(t) || !canSee(team, t))) target = null;
    const foe = t && t.kind === 'hero' && target !== null ? t : null;
    const foesNear = foe ? enemyHeroes().filter((e) => flat(e.pos, foe.pos) <= CAST.holdRadiusM).length : 0;
    let firing = false;
    const c = claim === null ? undefined : ctx.store.get(claim.id);
    if (claim && !alive(c)) claim = null;
    let moveTo = goal;
    if (claim && c) {
      // Melee pickups: walk onto it, look at it, swing (tap for light, hold for heavy).
      const p = { x: c.pos.x, y: c.pos.y, z: c.pos.z };
      moveTo = p;
      if (aim.target !== c.id) acquire(aim, c.id, false, now, d, rng);
      track(aim, h, body, p, 0, 0, now, d, rng);
      if (flat(p, h.pos) <= OBJECTIVE.meleeReachM && now >= meleeAt) {
        meleeUntil = now + ticks(claim.heavy ? OBJECTIVE.heavyHoldS : 0);
        meleeAt = now + ticks(FIGHT.meleeEveryS + (claim.heavy ? OBJECTIVE.heavyHoldS : 0));
        cmd.pressed |= Button.Melee;
      }
    } else if (target !== null && t) {
      if (aim.target !== t.id) acquire(aim, t.id, t.kind === 'hero', now, d, rng);
      const p = aimPoint(t, aim.head);
      targetPoint = p;
      // Lead a moving target by the bullet's flight time (projectile guns).
      const speed = def.weapon.hitscan ? 0 : def.weapon.projectileSpeed;
      const tt = speed > 0 ? dist3(p, h.pos) / speed : 0;
      const led = { x: p.x + t.vel.x * tt * d.lead, y: p.y + t.vel.y * tt * d.lead, z: p.z + t.vel.z * tt * d.lead };
      const los = dmath.hypot(p.x - h.pos.x, p.z - h.pos.z) || 1;
      const lateral = Math.abs((t.vel.x * (p.z - h.pos.z) - t.vel.z * (p.x - h.pos.x)) / los);
      const size = (t.kind === 'structure' ? t.structure.body.radius : t.radius) / Math.max(1, dist3(p, h.pos));
      const ready = track(aim, h, body, led, lateral, size, now, d, rng);
      const tooFar = reach(t) > gunRange;
      firing = ready && !tooFar && !h.weapon.reloading && (t.kind !== 'structure' || !t.stats.conditions.has('invulnerable') || !!t.structure.weakPoint) &&
        (now % LOS_EVERY !== 0 || clear(t, p));
      if (firing && clear(t, p)) {
        cmd.held |= Button.Fire;
        if (h.weapon.firing) kick(aim);
      }
      cast(now, foe, foesNear);
      // Light melee anything right on top of us while reloading.
      if (h.weapon.reloading && reach(t) <= FIGHT.meleeM && now >= meleeAt) {
        cmd.pressed |= Button.Melee;
        meleeAt = now + ticks(FIGHT.meleeEveryS);
      }
    } else {
      aim.target = null;
      targetPoint = null;
      if (mode === 'retreat') cast(now, null, 0);
      // Top up the magazine between fights.
      if (h.weapon.ammo < h.stats.final.magazine * FIGHT.reloadBelow && !h.weapon.reloading) cmd.pressed |= Button.Reload;
    }
    if (meleeUntil > now) cmd.held |= Button.Melee;

    // Movement.
    const foesClose = enemyHeroes().some((e) => flat(e.pos, h.pos) <= RIDE.dangerM);
    let walk: { x: number; z: number; kind: NavLinkKind } | null = null;
    const riding = !claim && ride(now, foesClose);
    if (!riding && moveTo) walk = steer(moveTo);
    let wx = walk?.x ?? 0;
    let wz = walk?.z ?? 0;
    if (!riding && strafe && t) {
      if (now >= strafeUntil) {
        strafeDir = rng.chance(FIGHT.strafeFlip) ? (strafeDir === 1 ? -1 : 1) : strafeDir;
        strafeUntil = now + ticks(FIGHT.strafeMinS + rng.next() * (FIGHT.strafeMaxS - FIGHT.strafeMinS));
      }
      const tx = t.pos.x - h.pos.x;
      const tz = t.pos.z - h.pos.z;
      const tl = dmath.hypot(tx, tz) || 1;
      wx += (-tz / tl) * strafeDir;
      wz += (tx / tl) * strafeDir;
      if (now - dashAt > ticks(FIGHT.dashEveryS) && h.motor.stamina >= FIGHT.dashStamina && h.motor.grounded && rng.chance(FIGHT.dashChance)) {
        cmd.pressed |= Button.Dash;
        cmd.held |= Button.Dash;
        dashAt = now;
      }
    }
    if (wx !== 0 || wz !== 0) {
      const a = avoid(wx, wz);
      wx = a.x;
      wz = a.z;
    }
    if (!riding) {
      if (!t && !claim && walk) lookAlong(aim, dmath.atan2(walk.x, walk.z), 0, d);
      // Links: jump the gaps and climbs, hold Jump into mantles (never long enough to latch an Updraft).
      if (walk && route && (walk.kind === 'jump' || walk.kind === 'mantle' || walk.kind === 'dashJump')) {
        const p = w.nav.node(route.nodes[step] ?? 0);
        if (flat(p, h.pos) <= NAV.jumpM && h.motor.grounded && jumpUntil <= now) jumpUntil = now + ticks(NAV.jumpHoldS);
      }
      if (jumpUntil > now) {
        cmd.held |= Button.Jump;
        if ((h.command.held & Button.Jump) === 0) cmd.pressed |= Button.Jump;
      }
    }
    cmd.yaw = aim.yaw;
    cmd.pitch = aim.pitch;
    const s = dmath.sin(aim.yaw);
    const co = dmath.cos(aim.yaw);
    // World direction → the command's camera-relative axes (right = (−cos, sin)).
    if (!riding) {
      cmd.forward = wx * s + wz * co;
      cmd.right = -wx * co + wz * s;
    }
    h.command = cmd;
  }

  return {
    id: h.id,
    team,
    lane,
    tick,
    moved(yaw) {
      route = null;
      latchFrom = null;
      if (yaw !== undefined) aim.yaw = yaw;
    },
    mode: () => mode,
    hash(hh) {
      hh.value([mode, goal, target, targetPoint, claim, step, aim.yaw, aim.pitch, aim.errYaw, aim.errPitch, aim.target, aim.fireFrom, next, plan,
        latchFrom, strafeDir, homeRetreat]);
    },
  };
}

/** Sentinel timing for pods (GDD §8.2): the ripe window is the last POD_RIPE_S of a pod's life. */
const POD_RIPE_S = 1.4;
