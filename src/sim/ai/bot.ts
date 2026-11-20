/**
 * One bot hero (GDD §11): a utility choice of what to do every decision interval (§11.3) and, every tick, the
 * PlayerCommand that does it: walk the nav graph or ride an Updraft, aim like a person, shoot, cast, melee pickups,
 * buy and spend AP. Bots read only what their flock can see (`canSee`, GDD §11.1) plus public timers, and act only
 * through the command, like the human (INTERFACES §14.1).
 */
import { ABILITY_BUTTONS, Button, IDLE_COMMAND, ITEM_BUTTONS, LAYERS_SOLID } from '../core/contracts';
import type {
  AbilityDef, BotDifficulty, Entity, EntityId, HeroEntity, HeroId, Hasher, ItemDef, ItemId, LaneId, NavLinkKind, PickupEntity,
  PlayerCommand, PlayerTeam, ShopAnchor, SimContext, StructureEntity, Tick, UnitEntity, Vec3,
} from '../core/contracts';
import { muzzlePoint, toWorld } from '../core/aim';
import * as dmath from '../core/dmath';
import { ticks } from '../core/math';
import { canSee } from '../core/vision';
import { AIM, AP_PRIORITY, CAST, DIFFICULTIES, FIGHT, LANE, NAV, OBJECTIVE, RETREAT, RIDE, SHOP, SIEGE, TARGET } from '../data/ai';
import { BUILDS } from '../data/builds';
import { ECONOMY } from '../data/economy';
import { SHOP as STORE } from '../data/items';
import { DEFENCE, STRUCTURE_RADIUS } from '../data/world';
import { acquire, createAim, kick, lookAlong, track } from './aim';
import type { LaneGeom } from './lanes';
import type { Nav, Route } from './nav';
import { choosePurchase, nextUpgrade, phaseOf } from './shop';
import type { Purchase, ShopPolicy } from './shop';

export type Mode = 'lane' | 'fight' | 'retreat' | 'shop' | 'farm' | 'objective' | 'push' | 'defend';

/** What every bot of a sim shares. */
export interface Shared {
  readonly ctx: SimContext;
  readonly nav: Nav;
  readonly lanes: ReadonlyMap<LaneId, LaneGeom>;
  /** MapData.updrafts index per lane. */
  readonly updraftOf: ReadonlyMap<LaneId, number>;
  readonly catalogue: ReadonlyMap<ItemId, ItemDef>;
  /** Every bot's hero id. */
  readonly bots: ReadonlySet<EntityId>;
  /** Living towers (every structure but Nests and Feeders), refreshed at the start of each ai phase. */
  readonly towers: readonly StructureEntity[];
  /** Orders from pings and defence calls, by bot hero id. */
  readonly orders: Map<EntityId, { pos: Vec3; until: Tick }>;
  readonly policy: (team: PlayerTeam, heroId: HeroId) => ShopPolicy;
  /** The lane a flock groups on to siege: the one whose enemy defences are furthest down (GDD §11.3 Sieging). */
  readonly pushLane: (team: PlayerTeam) => LaneId;
  /** The flock's siege: committed or not, and what it is taking (D-AI-009). */
  readonly siege: (team: PlayerTeam) => Siege;
  /** An open Shrine or Patron of the flock with enemies inside the base, or null. */
  readonly homeThreat: (team: PlayerTeam) => StructureEntity | null;
}

/** A flock's siege (index.ts `siege`). */
export interface Siege {
  /** Every bot goes (GDD §11.3 Sieging); else only pushes by the ordinary rules. */
  readonly commit: boolean;
  /** The push lane's outermost enemy tower, then the open Shrine nearest its gate, then the open Patron. */
  readonly target: StructureEntity | null;
  readonly lane: LaneId;
}

export interface Bot {
  readonly id: EntityId;
  readonly team: PlayerTeam;
  readonly lane: LaneId;
  /** Write this tick's command (the ai phase). */
  tick(): void;
  /** Respawned or teleported: drop the route; adopt a yaw the move set. */
  moved(yaw?: number): void;
  /** The gun fired (weapon.fired): the look rides up. */
  fired(): void;
  mode(): Mode;
  /** Internal state for tests and tools. */
  debug(): Readonly<Record<string, unknown>>;
  hash(h: Hasher): void;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Use = 'enemy' | 'ally' | 'heal' | 'mobility' | 'buff' | 'nova';
type Step = { x: number; z: number; kind: NavLinkKind };

const alive = (e: Entity | undefined): e is Entity => !!e && !e.removed && !('health' in e && e.health.dead);
const flat = (a: Vec3, b: Vec3): number => dmath.hypot(a.x - b.x, a.z - b.z);
const dist3 = (a: Vec3, b: Vec3): number => dmath.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const ehp = (e: HeroEntity): number => e.health.hp + e.health.talonShield + e.health.songShield + e.health.barrier;
const fraction = (e: { health: { hp: number }; stats: { final: { maxHealth: number } } }): number => e.health.hp / Math.max(1, e.stats.final.maxHealth);
const defence = (s: StructureEntity): { range: number; heroHit: number; interval: number } | undefined =>
  s.structure.type === 'nest' ? undefined : DEFENCE[s.structure.type as keyof typeof DEFENCE] as { range: number; heroHit: number; interval: number } | undefined;

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
export function useOf(targeting: AbilityDef['targeting'], effects: unknown, allies: boolean): Use {
  const k = kindsIn(effects, new Set());
  const harms = k.has('damage') || k.has('projectile') || k.has('displace') || k.has('tether');
  const moves = k.has('dash') || k.has('teleport') || k.has('movementMode');
  if (targeting === 'unit') return allies ? 'ally' : 'enemy';
  if (targeting === 'self') return k.has('heal') || k.has('shield') ? 'heal' : harms ? 'nova' : moves ? 'mobility' : 'buff';
  return moves && !harms ? 'mobility' : allies && !harms ? 'ally' : 'enemy';
}

export function createBot(w: Shared, h: HeroEntity, homeLane: LaneId, side: 1 | -1, roamer: boolean): Bot {
  const ctx = w.ctx;
  const clock = ctx.clock;
  const def = ctx.heroes[h.hero.heroId].def;
  const body = def.body;
  const d = DIFFICULTIES[h.hero.controller as BotDifficulty];
  const rng = ctx.rng.stream('ai/' + h.hero.heroId);
  const shopRng = ctx.rng.stream('ai/' + h.hero.heroId + '/shop');
  const team = h.team;
  /** The lane it plays: its own, or the flock's push lane once pushing (GDD §11.3 sieging). */
  let lane = homeLane;
  let geom = w.lanes.get(lane);
  const roost = ctx.map.shops.find((s) => s.team === team && s.kind === 'roost');
  const home = roost?.pos ?? ctx.map.spawns.find((s) => s.team === team)?.pos ?? { ...h.pos };
  const costs = Object.fromEntries(Object.entries(NAV.cost).map(([k, c]) => [k, d.links.includes(k as NavLinkKind) ? c : Infinity])) as
    Record<NavLinkKind, number>;
  const decisionTicks = Math.max(1, ticks(d.decisionS));
  const gunRange = Math.min(def.weapon.range, def.weapon.falloff.end + FIGHT.pastFalloffM);
  const sweet = Math.min(gunRange, Math.max(FIGHT.minSweetM, def.weapon.falloff.start || FIGHT.defaultRangeM));
  const uses = def.abilities.map((a) => useOf(a.targeting, [a.effects, a.selfEffects ?? []], a.affects?.teams === 'allies'));
  const apOrder = AP_PRIORITY[h.hero.heroId];
  const minCost = Math.min(...[...w.catalogue.values()].map((i) => i.cost));
  /** Tower anchors on the nav graph: a waypoint there counts as reached at the tower's edge. */
  const anchors = ctx.map.structures.map((s) => ({ pos: s.pos, r: STRUCTURE_RADIUS[s.type] + NAV.structureClearM }));
  const ripeTicks = ticks(ECONOMY.pod.ripeS);

  const aim = createAim(h.yaw);
  const cmd: Mutable<PlayerCommand> = { ...IDLE_COMMAND, yaw: h.yaw };
  let next: Tick = clock.tick + 1 + (h.hero.slot % decisionTicks);
  let mode: Mode = 'lane';
  let goal: Vec3 | null = null;
  let target: EntityId | null = null;
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
  /** Links and start nodes this bot got stuck on (cleared on respawn). */
  const blocked = new Set<number>();
  const badStart = new Set<number>();
  // Line of sight to the target, refreshed every TARGET.losEveryTicks.
  let losFor: EntityId | null = null;
  let losOk = false;
  let losAt: Tick = 0;
  // Buttons spanning several ticks.
  let jumpUntil: Tick = 0;
  let meleeUntil: Tick = 0;
  let meleeAt: Tick = 0;
  let castAt: Tick = 0;
  let dashAt: Tick = 0;
  let strafeDir: 1 | -1 = side;
  let strafeUntil: Tick = 0;
  let ledgeAt: Tick = 0;
  let ledge = false;
  let buyAt: Tick = 0;
  let plan: Purchase | null = null;
  // Updraft riding.
  let latchFrom: Tick | null = null;
  let rideCooldown: Tick = 0;
  let jumpReleased = false;
  /** Seeded once-per-entity draws (last hits, pods, denies), and enemy last-seen points. */
  const decided = new Map<EntityId, number>();
  const lastSeen = new Map<EntityId, { pos: Vec3; at: Tick }>();
  /** Enemy heavy swings already judged for a parry. */
  const swings = new Set<EntityId>();
  /** The stand chosen for the current base siege target (siegeStand). */
  let stand: { id: EntityId; p: Vec3 } | null = null;
  let lastEnemyNearAt: Tick = 0;
  /** Enemy heroes seen at the last decision (positions stay live). */
  let seen: HeroEntity[] = [];

  const hpFrac = (): number => fraction(h);
  const shot = (): number => h.stats.final.weaponDamage * def.weapon.pellets;
  const dps = (e: HeroEntity): number => {
    const w0 = ctx.heroes[e.hero.heroId].def.weapon;
    return e.stats.final.weaponDamage * w0.pellets * w0.fireRate;
  };
  const myProgress = (): number => (geom ? geom.forward(team, geom.project(h.pos).s) : 0);
  const policy = (): ShopPolicy => w.policy(team, h.hero.heroId);
  const slots = (): number => STORE.baseSlots + ctx.teams[team].flexSlots;

  // ── Perception ────────────────────────────────────────────────────────────────────────────────────────────
  const enemyHeroes = (): HeroEntity[] => ctx.store.list('hero').filter((e) => e.team !== team && alive(e) && canSee(team, e));
  const allyHeroes = (): HeroEntity[] => ctx.store.list('hero').filter((e) => e.team === team && alive(e));

  /** GDD §11.3 local fight score: allied vs enemy (effective HP × DPS) within FIGHT.scoreRadiusM, towers included. */
  function fightScore(foes: readonly HeroEntity[], friends: readonly HeroEntity[]): number {
    let ours = 0;
    let theirs = 0;
    for (const a of friends) if (flat(a.pos, h.pos) <= FIGHT.scoreRadiusM) ours += ehp(a) * dps(a);
    for (const e of foes) if (flat(e.pos, h.pos) <= FIGHT.scoreRadiusM) theirs += ehp(e) * dps(e);
    for (const s of w.towers) {
      const def0 = defence(s);
      if (!def0 || !alive(s) || flat(s.pos, h.pos) > def0.range + s.structure.body.radius) continue;
      // An enemy tower busy with this flock's fledglings isn't shooting heroes.
      const t = s.structure.target === null ? undefined : ctx.store.get(s.structure.target);
      if (s.team !== team && t?.kind === 'unit' && t.team === team) continue;
      const v = ((s.health.hp * def0.heroHit) / def0.interval) * FIGHT.towerWeight;
      if (s.team === team) ours += v;
      else theirs += v;
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
  /** Horizontal distance to the target's surface. */
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
    return !hit || hit.entity === e.id || hit.distance > len - TARGET.losSlackM;
  }
  /** A seeded draw made once per entity, in [0, 1). */
  function draw(id: EntityId): number {
    let v = decided.get(id);
    if (v === undefined) {
      v = rng.next();
      decided.set(id, v);
    }
    return v;
  }
  /** The enemy tower whose reach covers p, unless it is busy with this flock's fledglings. */
  function towerThreat(p: Vec3): StructureEntity | null {
    for (const s of w.towers) {
      const def0 = defence(s);
      if (s.team === team || !def0 || !alive(s)) continue;
      if (flat(s.pos, p) > def0.range + s.structure.body.radius + LANE.towerMarginM) continue;
      const t = s.structure.target === null ? undefined : ctx.store.get(s.structure.target);
      if (t && t.kind === 'unit' && t.team === team) continue;
      return s;
    }
    return null;
  }
  /** Lane-time target (GDD §11.3 Lane): pods, last hits, a poke, the tower on the wave, the enemy wave, Nests. */
  function laneTarget(foes: readonly HeroEntity[], poke: boolean): Entity | null {
    const now = clock.tick;
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
      const v = draw(p.id);
      const secure = p.team !== team;
      if (v >= (secure ? d.lastHitRate : d.denyRate)) continue;
      // Shot at the ripe moment ± the difficulty's timing error (a shot while it rises passes through it).
      const err = ((v / (secure ? d.lastHitRate : d.denyRate)) * 2 - 1) * d.podTimingS;
      if (now < p.pickup.expiresAt - ripeTicks + ticks(err)) continue;
      offer(p, TARGET.pod - reach(p) / gunRange);
    }
    const lastHit = shot() * FIGHT.lastHitMargin;
    for (const u of ctx.store.list('unit')) {
      if (u.team === team || u.team === 'neutral' || !alive(u) || !canSee(team, u) || reach(u) > gunRange) continue;
      const near = reach(u) / gunRange;
      if (u.health.hp <= lastHit && draw(u.id) < d.lastHitRate) offer(u, TARGET.lastHit - near);
      else offer(u, TARGET.wave - near - fraction(u));
    }
    const exposed = towerThreat(h.pos) !== null;
    if (poke && !exposed) {
      for (const e of foes) {
        if (reach(e) <= gunRange && hpFrac() >= fraction(e) * FIGHT.pokeHpRatio) offer(e, TARGET.poke - reach(e) / gunRange);
      }
    }
    for (const s of ctx.store.list('structure')) {
      if (s.team === team || !alive(s) || reach(s) > gunRange || !canSee(team, s)) continue;
      if (s.structure.type === 'nest') {
        if (s.structure.breakable?.by === 'any' && reach(s) <= OBJECTIVE.nestShootM) offer(s, TARGET.nest - reach(s) / gunRange);
        continue;
      }
      if (s.stats.conditions.has('invulnerable') && !s.structure.weakPoint) continue;
      if (s.structure.broodWard && foes.length > 0) continue;
      const t = s.structure.target === null ? undefined : ctx.store.get(s.structure.target);
      const onWave = !!t && t.kind === 'unit' && t.team === team;
      // A tower busy with our wave is the siege moment: it outranks pokes and the enemy wave.
      if (onWave) offer(s, TARGET.siege - reach(s) / gunRange);
      else if (!exposed) offer(s, TARGET.structure - reach(s) / gunRange);
    }
    return best;
  }

  /** An enemy tower shooting this bot, and the point just outside its reach to step back to (§11.3 Lane). */
  function towerOnMe(): Vec3 | null {
    for (const s of w.towers) {
      const def0 = defence(s);
      if (s.team === team || !def0 || s.structure.target !== h.id) continue;
      const out = def0.range + s.structure.body.radius + LANE.towerMarginM;
      if (geom) {
        const f = geom.forward(team, geom.project(s.pos).s);
        if (geom.project(s.pos).off <= LANE.corridorM) return lanePoint(Math.max(0, Math.min(myProgress(), f - out)));
      }
      const dx = h.pos.x - s.pos.x;
      const dz = h.pos.z - s.pos.z;
      const len = dmath.hypot(dx, dz) || 1;
      return { x: s.pos.x + (dx / len) * out, y: h.pos.y, z: s.pos.z + (dz / len) * out };
    }
    return null;
  }

  /** GDD §11.3 Fight: the visible enemy hero with the lowest effective HP in range, supports and carries first. */
  function fightTarget(foes: readonly HeroEntity[]): HeroEntity | null {
    let best: HeroEntity | null = null;
    let bestV = Infinity;
    // No fights inside an idle enemy tower's reach (it would shoot us anyway), except to finish a nearly dead hero
    // (Raptor) or the Egg carrier. A tower busy with our wave is fair game; if it turns on us, towerOnMe backs off.
    const exposed = towerThreat(h.pos) !== null;
    for (const e of foes) {
      if (flat(e.pos, h.pos) > FIGHT.engageM) continue;
      const carrier = e.stats.conditions.has('eggCarrier');
      if (exposed && !carrier && !(d.lastSeen && fraction(e) <= CAST.holdKillHp)) continue;
      const arche = ctx.heroes[e.hero.heroId].def.archetype;
      let v = ehp(e) * (FIGHT.preferred.includes(arche) ? FIGHT.preferredWeight : 1);
      if (e.id === target) v *= FIGHT.switchRatio;
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
    const off = Math.min(LANE.sideM, Math.max(0, geom.halfWidth - 1)) * side * (team === 'dawn' ? 1 : -1);
    return geom.at(geom.fromForward(team, f), off);
  }
  /** Where to stand in the lane: behind the own wave, short of the enemy wave and outside enemy tower reach. */
  function laneStand(): Vec3 {
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
    for (const s of w.towers) {
      const def0 = defence(s);
      if (s.structure.lane !== lane || !alive(s) || !def0) continue;
      const f = geom.forward(team, geom.project(s.pos).s);
      if (s.team === team) towerF = Math.max(towerF, f);
      else if (f < enemyTowerF) {
        enemyTowerF = f;
        enemyTowerReach = def0.range + s.structure.body.radius;
        const t = s.structure.target === null ? undefined : ctx.store.get(s.structure.target);
        busy = !!t && t.kind === 'unit' && t.team === team;
      }
    }
    // Wait by the outermost own tower for a wave still behind it, then keep behind its front.
    let f = Math.max(Number.isFinite(ownFront) ? ownFront - LANE.behindWaveM : -Infinity, towerF + LANE.aheadOfTowerM);
    if (Number.isFinite(enemyFront)) f = Math.min(f, enemyFront - LANE.shortOfEnemyM);
    f = Math.min(f, busy ? enemyTowerF - LANE.towerStandM : enemyTowerF - enemyTowerReach - LANE.towerMarginM);
    return lanePoint(Math.max(0, f));
  }

  function decide(): void {
    const now = clock.tick;
    // From 20:00, with Rekindle, or when the flock commits to a siege, it groups on one lane (GDD §11.3 Sieging).
    const rekindle = (ctx.teams[team].rekindle?.until ?? 0) > now;
    const sg = w.siege(team);
    const group = sg.commit || clock.seconds >= OBJECTIVE.pushFromS || rekindle;
    const played = group ? sg.lane : homeLane;
    if (played !== lane) {
      lane = played;
      geom = w.lanes.get(lane);
      route = null;
    }
    const foes = enemyHeroes();
    seen = foes;
    const friends = allyHeroes();
    for (const e of foes) lastSeen.set(e.id, { pos: { ...e.pos }, at: now });
    const near = foes.filter((e) => flat(e.pos, h.pos) <= FIGHT.scoreRadiusM);
    if (near.length > 0) lastEnemyNearAt = now;
    const alliesNear = friends.filter((a) => flat(a.pos, h.pos) <= FIGHT.scoreRadiusM);
    const score = near.length > 0 ? fightScore(foes, friends) : Infinity;
    const hp = hpFrac();
    const was = mode;
    target = null;
    claim = null;
    strafe = false;
    rideOk = false;
    if (decided.size > TARGET.forgetAfter) for (const id of [...decided.keys()]) if (!ctx.store.get(id)) decided.delete(id);
    const egg = ctx.objectives.egg;
    const eggEntity = egg?.pickup == null ? undefined : ctx.store.getKind(egg.pickup, 'pickup');

    // Carrying the Golden Egg: straight to the Hatching Stone (the other perch), whatever else happens.
    if (egg && eggEntity?.pickup.carrier === h.id) {
      mode = 'objective';
      goal = { ...(ctx.map.eggPerches[1 - egg.perch]?.pos ?? home) };
      return;
    }
    // A tower turned on us: step out of its reach first (GDD §11.3 "never stands in enemy tower range").
    const out = towerOnMe();
    if (out) {
      mode = 'retreat';
      goal = out;
      return;
    }
    // Retreat (GDD §11.3): HP under the threshold → the Home Roost until healed; outnumbered or losing → fall back.
    if ((homeRetreat && hp < RETREAT.healedHp) || hp < d.retreatHp) {
      homeRetreat = true;
      mode = 'retreat';
      goal = { ...home };
      return;
    }
    homeRetreat = false;
    // Defend at home: the base entered, everyone not committed elsewhere (and committed bots nearer home) go back.
    const threat = w.homeThreat(team);
    if (threat && (!sg.commit || !sg.target || flat(h.pos, threat.pos) < flat(h.pos, sg.target.pos))) {
      mode = 'defend';
      const dx = h.pos.x - threat.pos.x;
      const dz = h.pos.z - threat.pos.z;
      const len = dmath.hypot(dx, dz) || 1;
      const back = threat.structure.body.radius + OBJECTIVE.homeStandM;
      goal = len > back ? { x: threat.pos.x + (dx / len) * back, y: threat.pos.y, z: threat.pos.z + (dz / len) * back } : null;
      const prey = fightTarget(foes);
      target = prey?.id ?? laneTarget(foes, true)?.id ?? null;
      strafe = d.strafe && prey !== null;
      return;
    }
    // A committed flock only falls back from a fight it is clearly losing; the flock-level rule pulls it out.
    const outnumbered = near.length - alliesNear.length >= FIGHT.outnumberedBy + (sg.commit ? 1 : 0);
    if (outnumbered || (!sg.commit && (score < FIGHT.retreatScore || (was === 'retreat' && near.length > 0 && score < FIGHT.regroupScore)))) {
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
    if (d.lastSeen && was === 'fight') {
      for (const seen of lastSeen.values()) {
        if (now - seen.at <= ticks(FIGHT.chaseS) && flat(seen.pos, h.pos) <= FIGHT.engageM) {
          mode = 'fight';
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
      target = laneTarget(foes, true)?.id ?? null;
      return;
    }
    if (order) w.orders.delete(h.id);
    // Committed to a siege: everyone to the target, nothing else on the way but Embers (GDD §11.3 Sieging).
    if (sg.commit && sg.target) {
      if (objectives(foes, friends, eggEntity, true)) return;
      mode = 'push';
      goal = siegeStand(sg.target);
      const t = sg.target;
      const shootable = reach(t) <= gunRange && !(t.structure.broodWard && foes.length > 0);
      target = shootable ? t.id : (laneTarget(foes, true)?.id ?? null);
      rideOk = true;
      return;
    }
    // Objectives: the Egg, runes, Embers and the Roc.
    if (objectives(foes, friends, eggEntity, false)) return;
    // Shop trips (GDD §11.3 Shop; §11.2 shopping by difficulty).
    const stall = shopTrip(near.length > 0);
    if (stall) {
      mode = 'shop';
      goal = { ...stall.pos };
      return;
    }
    // Push and siege after 20:00, with Rekindle, or with enemies dead (GDD §11.3).
    const deadEnemies = ctx.store.list('hero').filter((e) => e.team !== team && e.health.dead).length;
    const push = group || deadEnemies >= OBJECTIVE.pushDeadEnemies;
    if (!push && foes.length === 0 && farm()) return;
    mode = push ? 'push' : 'lane';
    goal = push && sg.target && sg.target.structure.lane === null ? siegeStand(sg.target) : laneStand();
    target = laneTarget(foes, true)?.id ?? null;
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
    let best: ShopAnchor | null = null;
    for (const s of ctx.map.shops) {
      if (!(s.team === team || s.neutral) || (d.shops === 'roost' && s.kind !== 'roost')) continue;
      if (!best || flat(s.pos, h.pos) < flat(best.pos, h.pos)) best = s;
    }
    if (!best) return null;
    if (d.leaveLaneSeeds !== null && seeds >= d.leaveLaneSeeds) return best;
    return d.shops === 'own' && seeds >= SHOP.tripSeeds && flat(best.pos, h.pos) <= SHOP.tripM ? best : null;
  }

  /**
   * Where to stand to shoot a siege target (GDD §11.3 Sieging, D-AI-009). A lane tower: on the lane, within gun range
   * (a committed flock takes the tower's attention in turns; towerOnMe steps each one out). A Shrine or the Patron: the
   * first of a fan of points round it, facing the push lane's gate, at gun range but outside the Shrine pulse, from
   * which a chest-high ray reaches its aim point (the base walls hide most of it); else the siege proof's sightline
   * through the Riverbank gate. Cached per target.
   */
  function siegeStand(t: StructureEntity): Vec3 {
    const r = Math.min(SIEGE.maxM, Math.max(SIEGE.minM, gunRange - SIEGE.slackM)) + t.structure.body.radius;
    if (t.structure.lane !== null && geom) return lanePoint(Math.max(0, geom.forward(team, geom.project(t.pos).s) - r));
    if (stand && stand.id === t.id) return stand.p;
    const gate = geom ? lanePoint(geom.length) : home;
    const base = dmath.atan2(gate.x - t.pos.x, gate.z - t.pos.z);
    const aimAt = aimPoint(t, false);
    let pick: Vec3 | null = null;
    for (const k of SIEGE.fan) {
      for (const ring of SIEGE.rings) {
        const x = t.pos.x + dmath.sin(base + k) * r * ring;
        const z = t.pos.z + dmath.cos(base + k) * r * ring;
        const y = ctx.physics.groundHeight(x, z, t.pos.y + SIEGE.probeUpM);
        if (y === null || r * ring < SIEGE.minM) continue;
        const from = { x, y: y + body.muzzle.up, z };
        const dx = aimAt.x - from.x;
        const dy = aimAt.y - from.y;
        const dz = aimAt.z - from.z;
        const len = dmath.hypot(dx, dy, dz);
        const hit = ctx.physics.raycast(from, { x: dx / len, y: dy / len, z: dz / len }, len, LAYERS_SOLID, h.id);
        if (!hit || hit.entity === t.id || hit.distance > len - TARGET.losSlackM) {
          pick = { x, y, z };
          break;
        }
      }
      if (pick) break;
    }
    if (!pick) {
      const line = t.structure.type === 'shrine'
        ? { x: -Math.sign(t.pos.x) * SIEGE.shrine.x, z: Math.sign(t.pos.z) * SIEGE.shrine.z }
        : { x: 0, z: Math.sign(t.pos.z) * SIEGE.patronZ };
      const dx = line.x - t.pos.x;
      const dz = line.z - t.pos.z;
      const len = dmath.hypot(dx, dz) || 1;
      const back = Math.min(len, r);
      pick = { x: t.pos.x + (dx / len) * back, y: 0, z: t.pos.z + (dz / len) * back };
    }
    stand = { id: t.id, p: pick };
    return pick;
  }

  /** Is this bot among the n bots of its flock nearest to p? */
  function among(friends: readonly HeroEntity[], p: Vec3, n: number): boolean {
    let closer = 0;
    const mine = flat(h.pos, p);
    for (const a of friends) {
      if (a.id === h.id || !w.bots.has(a.id)) continue;
      const da = flat(a.pos, p);
      if (da < mine || (da === mine && a.id < h.id)) closer++;
    }
    return closer < n;
  }

  /** GDD §11.3 Objective and §11.7: the Egg, runes, Embers and the Roc. Sets the mode and returns true when one applies. */
  function objectives(foes: readonly HeroEntity[], friends: readonly HeroEntity[], egg: PickupEntity | undefined, embersOnly: boolean): boolean {
    const now = clock.tick;
    // The Golden Egg: the nearest bots go; the poorest of them takes it with a light melee, the rest escort.
    if (!embersOnly && egg && alive(egg)) {
      const carrier = egg.pickup.carrier === null ? undefined : ctx.store.getKind(egg.pickup.carrier, 'hero');
      if (carrier && carrier.team === team) {
        if (among(friends, carrier.pos, OBJECTIVE.eggBots)) {
          mode = 'objective';
          goal = flat(carrier.pos, h.pos) > OBJECTIVE.escortM ? { ...carrier.pos } : null;
          target = laneTarget(foes, true)?.id ?? null;
          return true;
        }
      } else if (carrier) {
        // The enemy carrier is every bot's top target once seen (GDD §11.3).
        if (canSee(team, carrier) && flat(carrier.pos, h.pos) <= FIGHT.engageM) {
          mode = 'fight';
          target = carrier.id;
          goal = { ...carrier.pos };
          return true;
        }
      } else if (among(friends, egg.pos, OBJECTIVE.eggBots) && flat(egg.pos, h.pos) <= OBJECTIVE.eggM) {
        mode = 'objective';
        goal = { ...egg.pos };
        let poorest = h;
        for (const a of friends) {
          if (!w.bots.has(a.id) || flat(a.pos, egg.pos) > OBJECTIVE.eggM || !among(friends, egg.pos, OBJECTIVE.eggBots)) continue;
          if (a.progress.netWorth < poorest.progress.netWorth || (a.progress.netWorth === poorest.progress.netWorth && a.id < poorest.id)) poorest = a;
        }
        if (poorest === h && (egg.pickup.claimableAt ?? 0) <= now) claim = { id: egg.id, heavy: false };
        else target = laneTarget(foes, true)?.id ?? null;
        return true;
      }
    }
    // Feather runes and Phoenix Embers: heavy melee claims.
    for (const p of ctx.store.list('pickup')) {
      if ((p.pickup.type !== 'rune' || embersOnly) && p.pickup.type !== 'ember') continue;
      const range = p.pickup.type === 'rune' ? OBJECTIVE.runeM : OBJECTIVE.emberM;
      if (flat(p.pos, h.pos) > range || !among(friends, p.pos, p.pickup.type === 'rune' ? 1 : OBJECTIVE.emberBots)) continue;
      mode = 'objective';
      goal = { ...p.pos };
      if ((p.pickup.claimableAt ?? 0) <= now) claim = { id: p.id, heavy: true };
      return true;
    }
    if (embersOnly) return false;
    // A rune due soon at a spot within reach: wait there.
    for (const [i, at] of (ctx.objectives.runeAt ?? []).entries()) {
      const spot = ctx.map.runeSpots[i];
      if (at === null || !spot || at < now || at - now > ticks(OBJECTIVE.runeSoonS) || flat(spot.pos, h.pos) > OBJECTIVE.runeM) continue;
      if (!among(friends, spot.pos, 1)) continue;
      mode = 'objective';
      goal = { ...spot.pos };
      target = laneTarget(foes, true)?.id ?? null;
      return true;
    }
    // The Roc (GDD §11.3): awake, at least four allies alive, and the enemy thinned or out of sight: the bots nearest
    // the Hollow gather on its floor (the only place it can be hurt) and fight it from a ring round it.
    const hollow = ctx.map.hollow;
    const roc = hollow ? ctx.store.list('unit').find((u) => u.unit.type === 'roc' && alive(u) && !u.unit.asleep) : undefined;
    if (hollow && roc && friends.length >= OBJECTIVE.rocAllies && hpFrac() > CAST.healHp && among(friends, hollow.centre, OBJECTIVE.rocBots)) {
      const dead = ctx.store.list('hero').filter((e) => e.team !== team && e.health.dead).length;
      const quiet = now - lastEnemyNearAt > ticks(OBJECTIVE.rocClearS) && !foes.some((e) => flat(e.pos, hollow.centre) <= OBJECTIVE.rocClearM);
      if (dead >= OBJECTIVE.rocDeadEnemies || quiet) {
        mode = 'objective';
        const dx = h.pos.x - roc.pos.x;
        const dz = h.pos.z - roc.pos.z;
        const len = dmath.hypot(dx, dz) || 1;
        goal = { x: roc.pos.x + (dx / len) * OBJECTIVE.rocRingM, y: hollow.floorY, z: roc.pos.z + (dz / len) * OBJECTIVE.rocRingM };
        target = reach(roc) <= gunRange && h.pos.y < hollow.floorY + NAV.arriveDy ? roc.id : null;
        return true;
      }
    }
    return false;
  }

  /** GDD §11.3 Farm: Thickets by tier and level; the roamer from 10:00, anyone with no wave to escort. */
  function farm(): boolean {
    const escort = geom ? ctx.store.list('unit').some((u) => u.team === team && u.unit.lane === lane && alive(u)) : false;
    const rotating = roamer && d.rotates && clock.seconds >= OBJECTIVE.rotateFromS;
    if (!rotating && escort) return false;
    const level = h.progress.level;
    let best: UnitEntity | null = null;
    for (const u of ctx.store.list('unit')) {
      if (u.team !== 'neutral' || u.unit.camp == null || !alive(u) || !canSee(team, u)) continue;
      const anchor = ctx.map.thickets[u.unit.camp];
      if (!anchor || flat(anchor.pos, h.pos) > OBJECTIVE.farmM) continue;
      const ok = anchor.tier === 1 || (d.shops === 'own' && (anchor.tier === 2 ? level >= OBJECTIVE.tier2Level : level >= OBJECTIVE.tier3Level));
      if (ok && (!best || flat(u.pos, h.pos) < flat(best.pos, h.pos))) best = u;
    }
    if (!best) return false;
    mode = 'farm';
    goal = flat(best.pos, h.pos) > OBJECTIVE.farmStandM ? { ...best.pos } : null;
    target = best.id;
    return true;
  }

  // ── Movement ──────────────────────────────────────────────────────────────────────────────────────────────
  /** Steer round the towers the nav graph runs through (nav.ts). */
  function avoid(dx: number, dz: number): { x: number; z: number } {
    let x = dx;
    let z = dz;
    for (const s of w.towers) {
      if (s.structure.solid === false) continue;
      const r = s.structure.body.radius + NAV.structureClearM;
      const cx = s.pos.x - h.pos.x;
      const cz = s.pos.z - h.pos.z;
      const c = dmath.hypot(cx, cz);
      if (c > r + NAV.avoidAheadM || c === 0 || s.pos.y > h.pos.y + body.height || s.pos.y + s.structure.body.height < h.pos.y) continue;
      if (c < r) {
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
      const sx = miss > 0 ? -perpX / miss : -cz / c;
      const sz = miss > 0 ? -perpZ / miss : cx / c;
      x += (sx * (r - miss)) / r;
      z += (sz * (r - miss)) / r;
    }
    const len = dmath.hypot(x, z) || 1;
    return { x: x / len, z: z / len };
  }

  /** A waypoint at a tower's anchor counts as reached at the tower's edge. */
  function arriveRadius(p: Vec3): number {
    for (const a of anchors) if (flat(a.pos, p) < NAV.arriveM) return NAV.arriveM + a.r;
    return NAV.arriveM;
  }

  /** The nearest node to p that can be seen from p at chest height (walls between are what strand bots). */
  function nodeNear(p: Vec3, skip?: ReadonlySet<number>): number {
    const cands = w.nav.near(p, NAV.candidates);
    for (const id of cands) {
      if (skip?.has(id)) continue;
      const q = w.nav.node(id);
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const dz = q.z - p.z;
      const len = dmath.hypot(dx, dy, dz);
      if (len < NAV.arriveM) return id;
      const from = { x: p.x, y: p.y + NAV.eyeM, z: p.z };
      const hit = ctx.physics.raycast(from, { x: dx / len, y: dy / len, z: dz / len }, len, LAYERS_SOLID, h.id);
      if (!hit) return id;
    }
    return cands.find((id) => !skip?.has(id)) ?? cands[0] ?? -1;
  }

  /** World direction toward `to` along the nav graph, and the link being crossed. */
  function steer(to: Vec3): Step | null {
    const now = clock.tick;
    const straight = (p: Vec3): Step | null => {
      const dx = p.x - h.pos.x;
      const dz = p.z - h.pos.z;
      const len = dmath.hypot(dx, dz);
      return len < NAV.arriveM ? null : { x: dx / len, z: dz / len, kind: 'walk' };
    };
    if (w.nav.size === 0 || (flat(to, h.pos) <= NAV.directM && Math.abs(to.y - h.pos.y) < NAV.arriveDy)) return straight(to);
    if (!route || !routeGoal || flat(routeGoal, to) > NAV.goalMovedM || now - routeAt > ticks(NAV.replanS)) {
      route = w.nav.route(nodeNear(h.pos, badStart), nodeNear(to), costs, blocked);
      routeGoal = { ...to };
      routeAt = now;
      step = 0;
      bestD = Infinity;
      bestAt = now;
      // Skip a start node behind us.
      if (route && route.nodes.length > 1 && route.kinds[1] === 'walk') {
        const a = w.nav.node(route.nodes[0]!);
        const b = w.nav.node(route.nodes[1]!);
        if (flat(h.pos, b) < flat(a, b)) step = 1;
      }
    }
    if (!route) return straight(to);
    while (step < route.nodes.length) {
      const p = w.nav.node(route.nodes[step]!);
      if (flat(p, h.pos) >= arriveRadius(p) || Math.abs(p.y - h.pos.y) >= NAV.arriveDy) break;
      step++;
      bestD = Infinity;
      bestAt = now;
    }
    if (step >= route.nodes.length) return straight(to);
    const p = w.nav.node(route.nodes[step]!);
    const dd = dist3(p, h.pos);
    if (dd < bestD - NAV.stuckProgressM) {
      bestD = dd;
      bestAt = now;
    } else if (now - bestAt > ticks(NAV.stuckS) * 2) {
      // Stuck: this bot stops trusting that link (or start node) until it respawns, and plans afresh.
      const k = step > 0 ? w.nav.link(route.nodes[step - 1]!, route.nodes[step]!) : -1;
      if (k >= 0) blocked.add(k);
      else badStart.add(route.nodes[step]!);
      if (badStart.size > NAV.forgetBad) badStart.clear();
      route = null;
    } else if (now - bestAt > ticks(NAV.stuckS) && h.motor.grounded && jumpUntil < now) {
      jumpUntil = now + ticks(NAV.jumpHoldS);
    }
    const dir = straight(p);
    return dir ? { x: dir.x, z: dir.z, kind: route?.kinds[step] ?? 'walk' } : null;
  }

  /** GDD §3.7: latch the lane's Updraft by holding Jump, ride, and jump off near the goal. True while handling it. */
  function ride(now: Tick, danger: boolean): boolean {
    const updraft = w.updraftOf.get(lane);
    if (!geom || updraft === undefined || !goal) return false;
    const me = geom.project(h.pos);
    const left = geom.project(goal).s - me.s;
    const sign = Math.sign(left) || 1;
    const d0 = geom.dir(me.s);
    const along = dmath.atan2(d0.x * sign, d0.z * sign);
    const wanted = rideOk && (mode === 'lane' || mode === 'push');
    if (h.motor.updraft !== null) {
      latchFrom = null;
      lookAlong(aim, along, 0, d);
      if (!jumpReleased) {
        // Let go of Jump once: the dismount needs a fresh press.
        jumpReleased = true;
        return true;
      }
      if (Math.abs(left) <= RIDE.offM || danger || !wanted) {
        cmd.held |= Button.Jump;
        cmd.pressed |= Button.Jump;
        rideCooldown = now + ticks(RIDE.giveUpS);
        route = null;
      }
      return true;
    }
    if (!wanted || danger || now < rideCooldown || Math.abs(left) < RIDE.minM || me.off > LANE.corridorM ||
      h.stats.conditions.has('eggCarrier')) {
      latchFrom = null;
      return false;
    }
    const inReach = h.motor.updraftInReach === updraft;
    if (!inReach && latchFrom === null) return false;
    latchFrom ??= now;
    if (now - latchFrom > ticks(RIDE.giveUpS)) {
      latchFrom = null;
      rideCooldown = now + ticks(RIDE.retryS);
      return false;
    }
    // Face the end to ride toward (the ride goes the way the camera faces at the latch), hold Jump, stand still.
    aim.yaw = along;
    aim.pitch = 0;
    cmd.held |= Button.Jump;
    if ((h.command.held & Button.Jump) === 0) cmd.pressed |= Button.Jump;
    jumpReleased = false;
    return true;
  }

  // ── Abilities and item actives (GDD §11.2) ────────────────────────────────────────────────────────────────
  function wants(use: Use, range: number, foe: HeroEntity | null, onTarget: boolean, selfFallback: boolean): boolean {
    const now = clock.tick;
    const gap = foe ? flat(foe.pos, h.pos) : Infinity;
    switch (use) {
      case 'enemy':
        return onTarget && gap <= range * (d.abilities === 'inRange' ? 1 : CAST.predictRange);
      case 'nova':
        return foe !== null && gap <= CAST.novaM;
      case 'heal':
      case 'ally':
        return hpFrac() < CAST.healHp && h.health.inCombatUntil > now && (use === 'heal' || selfFallback);
      case 'mobility':
        return (mode === 'retreat' && foe !== null && gap <= RETREAT.escapeM) ||
          (mode === 'fight' && gap > sweet && gap <= range + sweet && hpFrac() > CAST.healHp);
      case 'buff':
        return mode === 'fight' && foe !== null && gap <= gunRange;
    }
  }
  function cast(now: Tick, foe: HeroEntity | null): void {
    if (now < castAt || h.abilities.casting !== null || h.stats.conditions.has('silenced') || h.motor.updraft !== null) return;
    const onTarget = foe !== null && aim.target === foe.id && now >= aim.fireFrom;
    const last = ABILITY_BUTTONS.length - 1;
    for (let i = 0; i < ABILITY_BUTTONS.length; i++) {
      const s = h.abilities.slots[i]!;
      const a = def.abilities[i]!;
      if (!s.unlocked || s.readyAt > now || s.charges <= 0) continue;
      const use = uses[i]!;
      let go = wants(use, a.range > 0 ? a.range : CAST.defaultRangeM, foe, onTarget, a.selfFallback === true);
      // Raptor holds its ultimate for two or more heroes or a likely kill (GDD §11.2).
      if (go && i === last && d.abilities === 'chain' && foe && (use === 'enemy' || use === 'nova')) {
        const grouped = enemyHeroes().filter((e) => flat(e.pos, foe.pos) <= CAST.holdRadiusM).length;
        go = grouped >= CAST.holdHeroes || fraction(foe) <= CAST.holdKillHp;
      }
      if (!go) continue;
      cmd.held |= ABILITY_BUTTONS[i]!;
      cmd.pressed |= ABILITY_BUTTONS[i]!;
      castAt = now + ticks(CAST.everyS);
      return;
    }
    // Item actives, on Z, X, C, V, by the same rules.
    for (let i = 0; i < ITEM_BUTTONS.length; i++) {
      const id = h.inventory.actives[i];
      const owned = id ? h.inventory.items.find((o) => o.item === id) : undefined;
      const active = id ? w.catalogue.get(id)?.active : null;
      if (!active || !owned || owned.readyAt > now) continue;
      const use = useOf(active.targeting, active.effects, active.affects?.teams === 'allies');
      if (!wants(use, active.range || CAST.defaultRangeM, foe, onTarget, active.selfFallback === true)) continue;
      cmd.held |= ITEM_BUTTONS[i]!;
      cmd.pressed |= ITEM_BUTTONS[i]!;
      castAt = now + ticks(CAST.everyS);
      return;
    }
  }

  // ── The command ───────────────────────────────────────────────────────────────────────────────────────────
  function shop(now: Tick): void {
    if (h.inventory.shopZone == null || now < buyAt) return;
    plan ??= choosePurchase(h, w.catalogue, policy(), phaseOf(clock.seconds, BUILDS.phases), slots(), shopRng);
    if (!plan) {
      // Nothing to buy: look again at the next decision.
      buyAt = next;
      return;
    }
    buyAt = now + SHOP.buyEveryTicks;
    const sell = plan.sell;
    if (sell && h.inventory.items.some((o) => o.item === sell)) {
      cmd.sell = sell;
      return;
    }
    cmd.buy = plan.buy;
    plan = null;
  }

  /**
   * GDD §11.2 Parry: a seen enemy close enough to land a heavy melee, in its heavy wind-up and in front of us, is parried
   * at the difficulty's rate, decided once per swing.
   */
  function parry(): void {
    if (d.parryRate <= 0) return;
    for (const e of seen) {
      if (e.weapon.meleePose !== 'heavy' || !alive(e) || flat(e.pos, h.pos) > FIGHT.parryM) {
        swings.delete(e.id);
        continue;
      }
      if (swings.has(e.id)) continue;
      const go = rng.chance(d.parryRate);
      swings.add(e.id);
      const ahead = (e.pos.x - h.pos.x) * dmath.sin(h.yaw) + (e.pos.z - h.pos.z) * dmath.cos(h.yaw);
      if (go && ahead >= 0) {
        cmd.pressed |= Button.Parry;
        cmd.held |= Button.Parry;
        return;
      }
    }
  }

  function lineOfSight(t: Entity, p: Vec3, now: Tick): boolean {
    if (losFor !== t.id || now - losAt >= TARGET.losEveryTicks) {
      losFor = t.id;
      losAt = now;
      losOk = clear(t, p);
    }
    return losOk;
  }

  function tick(): void {
    const now = clock.tick;
    cmd.held = 0;
    cmd.pressed = 0;
    cmd.buy = null;
    cmd.sell = null;
    cmd.ping = null;
    cmd.forward = 0;
    cmd.right = 0;
    cmd.upgrade = apOrder ? nextUpgrade(h, apOrder) : null;
    if (h.health.dead) {
      route = null;
      target = null;
      claim = null;
      latchFrom = null;
      homeRetreat = false;
      mode = 'lane';
      cmd.yaw = aim.yaw;
      cmd.pitch = aim.pitch;
      h.command = cmd;
      return;
    }
    // A tower turning on us is noticed at once, not at the next decision.
    if (mode !== 'retreat' && w.towers.some((s) => s.team !== team && s.structure.target === h.id)) next = now;
    if (now >= next) {
      next = now + decisionTicks;
      decide();
      // The next purchase, planned when there is money for one (the shop-trip rule reads it).
      if (!plan && h.progress.seeds >= minCost) plan = choosePurchase(h, w.catalogue, policy(), phaseOf(clock.seconds, BUILDS.phases), slots(), shopRng);
    }
    shop(now);

    // Aim: a claim, else the target, else along the way.
    let t = target === null ? undefined : ctx.store.get(target);
    if (target !== null && (!alive(t) || !canSee(team, t))) {
      target = null;
      t = undefined;
    }
    const c = claim === null ? undefined : ctx.store.get(claim.id);
    if (claim && !alive(c)) claim = null;
    const foe = t && t.kind === 'hero' ? t : null;
    let moveTo = goal;
    if (claim && c) {
      // Melee pickups: walk onto it, look at it, swing (tap for light, hold for heavy).
      moveTo = { ...c.pos };
      if (aim.target !== c.id) acquire(aim, c.id, false, now, d, rng);
      track(aim, h, body, c.pos, 0, 0, now, d, rng);
      if (flat(c.pos, h.pos) <= OBJECTIVE.meleeReachM && now >= meleeAt && now >= aim.fireFrom) {
        meleeUntil = now + ticks(claim.heavy ? OBJECTIVE.heavyHoldS : 0);
        meleeAt = now + ticks(FIGHT.meleeEveryS + (claim.heavy ? OBJECTIVE.heavyHoldS : 0));
        cmd.pressed |= Button.Melee;
      }
    } else if (t) {
      if (aim.target !== t.id) acquire(aim, t.id, t.kind === 'hero', now, d, rng);
      const p = aimPoint(t, aim.head);
      // Lead a moving target by the bullet's flight time (projectile guns).
      const speed = def.weapon.hitscan ? 0 : def.weapon.projectileSpeed;
      const tt = speed > 0 ? (dist3(p, h.pos) / speed) * d.lead : 0;
      const led = { x: p.x + t.vel.x * tt, y: p.y + t.vel.y * tt, z: p.z + t.vel.z * tt };
      const span = flat(p, h.pos) || 1;
      const lateral = Math.abs((t.vel.x * (p.z - h.pos.z) - t.vel.z * (p.x - h.pos.x)) / span);
      const size = (t.kind === 'structure' ? t.structure.body.radius : t.radius) / Math.max(1, dist3(p, h.pos));
      const ready = track(aim, h, body, led, lateral, size, now, d, rng);
      if (ready && reach(t) <= gunRange && !h.weapon.reloading && lineOfSight(t, p, now)) cmd.held |= Button.Fire;
      cast(now, foe);
      // Light melee anything right on top of us while reloading.
      if (h.weapon.reloading && reach(t) <= FIGHT.meleeM && now >= meleeAt && t.kind !== 'pickup') {
        cmd.pressed |= Button.Melee;
        meleeAt = now + ticks(FIGHT.meleeEveryS);
      }
    } else {
      aim.target = null;
      if (mode === 'retreat') cast(now, null);
      // Top up the magazine between fights.
      if (h.weapon.ammo < h.stats.final.magazine * FIGHT.reloadBelow && !h.weapon.reloading) cmd.pressed |= Button.Reload;
    }
    if (meleeUntil > now) cmd.held |= Button.Melee;
    parry();
    if ((cmd.pressed & Button.Melee) !== 0) cmd.held |= Button.Melee;

    // Movement: ride, or walk the route; strafe in fights.
    const danger = seen.some((e) => alive(e) && flat(e.pos, h.pos) <= RIDE.dangerM);
    const riding = !claim && ride(now, danger);
    const walk = !riding && moveTo ? steer(moveTo) : null;
    let wx = walk?.x ?? 0;
    let wz = walk?.z ?? 0;
    if (!riding && strafe && t) {
      if (now >= strafeUntil) {
        if (rng.chance(FIGHT.strafeFlip)) strafeDir = strafeDir === 1 ? -1 : 1;
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
    // Off-route moves (strafing, backing off, walking straight at a goal) never step off a ledge: bridges and the
    // Hollow's rim drop a fighter out of the fight.
    if (!riding && (wx !== 0 || wz !== 0) && (strafe || !walk || !route) && h.motor.grounded) {
      if (now >= ledgeAt) {
        ledgeAt = now + NAV.ledgeEveryTicks;
        const len = dmath.hypot(wx, wz) || 1;
        const px = h.pos.x + (wx / len) * NAV.ledgeProbeM;
        const pz = h.pos.z + (wz / len) * NAV.ledgeProbeM;
        const ground = ctx.physics.groundHeight(px, pz, h.pos.y + NAV.eyeM);
        ledge = ground === null || ground < h.pos.y - NAV.ledgeDropM;
      }
      if (ledge) {
        strafeDir = strafeDir === 1 ? -1 : 1;
        wx = walk && !strafe ? 0 : (walk?.x ?? 0);
        wz = walk && !strafe ? 0 : (walk?.z ?? 0);
      }
    }
    if (!riding) {
      if (wx !== 0 || wz !== 0) {
        const a = avoid(wx, wz);
        wx = a.x;
        wz = a.z;
        if (!t && !claim) lookAlong(aim, dmath.atan2(wx, wz), 0, d);
      }
      // Links: jump gaps and climbs, hold Jump into mantles (never long enough to latch an Updraft).
      if (walk && route && walk.kind !== 'walk' && walk.kind !== 'drop' && h.motor.grounded && jumpUntil < now) {
        if (flat(w.nav.node(route.nodes[step] ?? 0), h.pos) <= NAV.jumpM) jumpUntil = now + ticks(NAV.jumpHoldS);
      }
      if (jumpUntil > now) {
        cmd.held |= Button.Jump;
        if ((h.command.held & Button.Jump) === 0) cmd.pressed |= Button.Jump;
      }
      // World direction → the command's camera-relative axes (forward = (sin, cos), right = (−cos, sin)).
      const s = dmath.sin(aim.yaw);
      const co = dmath.cos(aim.yaw);
      cmd.forward = wx * s + wz * co;
      cmd.right = -wx * co + wz * s;
    }
    cmd.yaw = aim.yaw;
    cmd.pitch = aim.pitch;
    h.command = cmd;
  }

  return {
    id: h.id,
    team,
    lane: homeLane,
    tick,
    moved(yaw) {
      route = null;
      blocked.clear();
      badStart.clear();
      latchFrom = null;
      if (yaw !== undefined) aim.yaw = yaw;
    },
    fired: () => kick(aim),
    mode: () => mode,
    debug: () => ({ mode, goal, target, claim, step, route: route?.nodes.length ?? null, latchFrom, riding: h.motor.updraft !== null }),
    hash(hh) {
      hh.value([mode, goal, target, claim, step, aim.yaw, aim.pitch, aim.errYaw, aim.errPitch, aim.target, aim.fireFrom, next, plan,
        latchFrom, strafeDir, homeRetreat, jumpUntil, meleeUntil, castAt]);
    },
  };
}
