/**
 * sim/ai: utility-AI bot heroes (GDD §11). In the ai phase every bot writes its PlayerCommand from what its flock can
 * see (INTERFACES §14.1); bot.ts holds one bot. This module assigns lanes (2-2-2, frontline with backline, §11.3),
 * builds each bot's shop policy (§11.4, D-EP-036, `options.botShopping`), routes pings and defence calls, and owns
 * the bot hero pick rule (§11.6).
 */
import { HERO_IDS, PLAYER_TEAMS } from '../core/contracts';
import type {
  Archetype, EntityId, HeroEntity, HeroId, ItemId, LaneId, PlayerTeam, Rng, SimContext, StructureEntity, SystemFactory, Tick, Vec3,
} from '../core/contracts';
import * as dmath from '../core/dmath';
import { ticks } from '../core/math';
import { canSee } from '../core/vision';
import { CONDITIONS, DIFFICULTIES, FRONTLINE, LANE_ORDER, OBJECTIVE, PER_LANE, PICK_ORDER } from '../data/ai';
import { BUILDS } from '../data/builds';
import { ITEMS } from '../data/items';
import { HEROES } from '../heroes/registry';
import { createBot } from './bot';
import type { Bot, Shared, Siege } from './bot';
import { laneGeom } from './lanes';
import { navFor } from './nav';
import type { ShopPolicy } from './shop';

const isBot = (h: HeroEntity): boolean => h.hero.controller === 'easy' || h.hero.controller === 'normal' || h.hero.controller === 'hard';
const archetypeOf = (id: HeroId): Archetype => HEROES[id].def.archetype;
const NO_PICKS: ReadonlySet<ItemId> = new Set();

/** GDD §11.3 laning: the human first on Riverbank, then bots two by two, frontline paired with backline. */
export function assignLanes(heroes: readonly HeroEntity[]): Map<EntityId, { lane: LaneId; side: 1 | -1; roamer: boolean }> {
  const out = new Map<EntityId, { lane: LaneId; side: 1 | -1; roamer: boolean }>();
  for (const team of PLAYER_TEAMS) {
    const mine = heroes.filter((h) => h.team === team);
    const bots = mine.filter(isBot);
    const front = bots.filter((h) => FRONTLINE.includes(archetypeOf(h.hero.heroId)));
    const back = bots.filter((h) => !FRONTLINE.includes(archetypeOf(h.hero.heroId)));
    const queue: HeroEntity[] = [];
    for (let i = 0; i < Math.max(front.length, back.length); i++) {
      if (front[i]) queue.push(front[i]!);
      if (back[i]) queue.push(back[i]!);
    }
    const order = [...mine.filter((h) => h.hero.controller === 'human'), ...queue];
    order.forEach((h, i) => {
      const lane = LANE_ORDER[Math.floor(i / PER_LANE) % LANE_ORDER.length]!;
      out.set(h.id, { lane, side: i % PER_LANE === 0 ? 1 : -1, roamer: i % PER_LANE === 1 });
    });
  }
  return out;
}

/**
 * A bot's hero pick (GDD §11.6), used by the roster helpers in src/sim/index.ts. `flock` holds the heroes already on
 * the bot's flock. It fills the first archetype in PICK_ORDER the flock lacks, then any archetype it lacks, then any
 * hero, choosing among free implemented heroes (hero select offers only those) with the seeded stream.
 */
export const pickBotHero = (rng: Rng, taken: ReadonlySet<HeroId>, flock: readonly HeroId[]): HeroId => {
  const free = HERO_IDS.filter((id) => !taken.has(id));
  const ready = free.filter((id) => HEROES[id].implemented === true);
  const pool = ready.length > 0 ? ready : free;
  const has = new Set(flock.map(archetypeOf));
  for (const a of PICK_ORDER) {
    if (has.has(a)) continue;
    const of = pool.filter((id) => archetypeOf(id) === a);
    if (of.length > 0) return rng.pick(of);
  }
  const lacking = pool.filter((id) => !has.has(archetypeOf(id)));
  return rng.pick(lacking.length > 0 ? lacking : pool);
};

const registry = new WeakMap<SimContext, readonly Bot[]>();
/** A sim's bots (tests and tools): sim.ctx → the bots, created on the first ai phase. */
export const botsOf = (ctx: SimContext): readonly Bot[] => registry.get(ctx) ?? [];

export const createAiSystem: SystemFactory = (ctx: SimContext) => {
  const bots: Bot[] = [];
  registry.set(ctx, bots);
  const byId = new Map<EntityId, Bot>();
  const orders = new Map<EntityId, { pos: Vec3; until: Tick }>();
  const policies = new Map<string, ShopPolicy>();
  const catalogue = new Map(ITEMS.map((i) => [i.id, i]));
  let shared: Shared | null = null;
  const towers: StructureEntity[] = [];

  function policy(team: PlayerTeam, heroId: HeroId): ShopPolicy {
    const key = team + '/' + heroId;
    let p = policies.get(key);
    if (p) return p;
    const o = ctx.config.options.botShopping?.[team];
    const h = ctx.store.list('hero').find((e) => e.team === team && e.hero.heroId === heroId);
    const difficulty = h && isBot(h) ? DIFFICULTIES[h.hero.controller as keyof typeof DIFFICULTIES] : DIFFICULTIES.normal;
    if (o?.random) p = { scores: null, temperature: 0, random: true, situational: NO_PICKS };
    else {
      // Situational picks whose condition holds: the enemy flock fields one of the condition's archetypes (data/ai).
      const enemy = new Set(ctx.store.list('hero').filter((e) => e.team !== team).map((e) => archetypeOf(e.hero.heroId)));
      const picks = (BUILDS.builds[heroId]?.situational ?? []).filter((s) => s.condition && (CONDITIONS[s.condition] ?? []).some((a) => enemy.has(a)));
      p = {
        scores: o?.scores?.[heroId] ?? BUILDS.scores[heroId] ?? null,
        temperature: o?.temperature ?? difficulty.temperature,
        random: false,
        situational: new Set(picks.map((s) => s.item)),
      };
    }
    policies.set(key, p);
    return p;
  }

  /**
   * The flock's siege lane: fewest enemy lane towers left, then the weakest of them (summed HP fraction); ties go to
   * LANE_ORDER. A lane with none left leads to the base, so it wins outright.
   */
  const pushLanes = new Map<PlayerTeam, { at: Tick; lane: LaneId }>();
  function pushLane(team: PlayerTeam): LaneId {
    const cached = pushLanes.get(team);
    if (cached && cached.at === ctx.clock.tick) return cached.lane;
    let best: LaneId = LANE_ORDER[0]!;
    let bestScore = Infinity;
    for (const lane of LANE_ORDER) {
      if (!ctx.map.lanes.some((l) => l.id === lane)) continue;
      let score = 0;
      for (const s of towers) {
        if (s.team !== team && s.structure.lane === lane) score += 1 + s.health.hp / Math.max(1, s.stats.final.maxHealth);
      }
      if (score < bestScore) {
        bestScore = score;
        best = lane;
      }
    }
    pushLanes.set(team, { at: ctx.clock.tick, lane: best });
    return best;
  }

  /** Last tick each flock killed the Roc (GDD §7.12): a push window. */
  const rocKilledAt: Record<PlayerTeam, Tick> = { dawn: -Infinity, dusk: -Infinity };
  ctx.bus.on('entity.died', (e) => {
    if (e.victimType !== 'roc' || e.creditHero === null) return;
    const killer = ctx.store.getKind(e.creditHero, 'hero');
    if (killer) rocKilledAt[killer.team] = ctx.clock.tick;
  });

  /**
   * GDD §11.3 Sieging, for the whole flock (D-AI-009). The flock commits every bot to its push lane after a team wipe,
   * a Roc kill, with Rekindle, with two more heroes up from 20:00, or with at least as many up from 30:00; it falls back
   * when it is down to two or outnumbered by two. The target is the lane's outermost enemy tower, then the open Shrine
   * nearest that lane's gate, then the Patron once both Shrines are down.
   */
  const committed: Record<PlayerTeam, boolean> = { dawn: false, dusk: false };
  const sieges = new Map<PlayerTeam, { at: Tick; siege: Siege }>();
  function siege(team: PlayerTeam): Siege {
    const cached = sieges.get(team);
    if (cached && cached.at === ctx.clock.tick) return cached.siege;
    const now = ctx.clock.tick;
    const heroes = ctx.store.list('hero');
    const mine = heroes.filter((h) => h.team === team && !h.health.dead).length;
    const theirs = heroes.filter((h) => h.team !== team && !h.health.dead).length;
    const s = ctx.clock.seconds;
    // The Roc awake comes first in the late game (GDD §15.3): no all-in push while it can be taken.
    const rocUp = ctx.store.list('unit').some((u) => u.unit.type === 'roc' && !u.removed && !u.health.dead && !u.unit.asleep);
    const start = mine >= OBJECTIVE.commitMinAllies && (theirs <= OBJECTIVE.wipeAlive ||
      now - rocKilledAt[team] <= ticks(OBJECTIVE.rocPushS) || (ctx.teams[team].rekindle?.until ?? 0) > now ||
      (s >= OBJECTIVE.pushFromS && mine - theirs >= OBJECTIVE.commitEdge) || (s >= OBJECTIVE.allInFromS && !rocUp && theirs - mine < OBJECTIVE.commitEdge));
    const stop = mine <= OBJECTIVE.fallBackAlive || theirs - mine >= OBJECTIVE.commitEdge;
    committed[team] = committed[team] ? !stop : start;
    const lane = pushLane(team);
    const geom = shared?.lanes.get(lane);
    let target: StructureEntity | null = null;
    let best = Infinity;
    for (const t of towers) {
      if (t.team === team || t.structure.lane !== lane || !geom) continue;
      const f = geom.forward(team, geom.project(t.pos).s);
      if (f < best) {
        best = f;
        target = t;
      }
    }
    if (!target && geom) {
      const gate = geom.at(geom.fromForward(team, geom.length));
      best = Infinity;
      for (const t of towers) {
        if (t.team === team || t.structure.type !== 'shrine' || t.stats.conditions.has('invulnerable')) continue;
        const d = dmath.hypot(t.pos.x - gate.x, t.pos.z - gate.z);
        if (d < best) {
          best = d;
          target = t;
        }
      }
      target ??= towers.find((t) => t.team !== team && t.structure.type === 'patron' && !t.stats.conditions.has('invulnerable')) ?? null;
    }
    const out: Siege = { commit: committed[team], target, lane };
    sieges.set(team, { at: now, siege: out });
    return out;
  }

  /**
   * "Defend at home" (GDD §11.3 Defend): an open Shrine or the Patron with a seen enemy hero within homeM, or
   * homeFledglings enemy fledglings within the Brood Ward's 30 m. Returns the structure under the most pressure and
   * how many bots answer: the 3 nearest (§11.3), or one more than the heroes inside.
   */
  function homeThreat(team: PlayerTeam): { structure: StructureEntity; defenders: number } | null {
    let worst: { structure: StructureEntity; defenders: number } | null = null;
    let most = 0;
    for (const s of towers) {
      if (s.team !== team || s.structure.lane !== null || s.stats.conditions.has('invulnerable')) continue;
      let heroes = 0;
      let units = 0;
      for (const h of ctx.store.list('hero')) {
        if (h.team !== team && !h.health.dead && canSee(team, h) && dmath.hypot(h.pos.x - s.pos.x, h.pos.z - s.pos.z) <= OBJECTIVE.homeM) heroes++;
      }
      for (const u of ctx.store.list('unit')) {
        if (u.team !== team && u.team !== 'neutral' && u.unit.lane && dmath.hypot(u.pos.x - s.pos.x, u.pos.z - s.pos.z) <= OBJECTIVE.homeWardM) units++;
      }
      const pressure = heroes * OBJECTIVE.homeFledglings + units;
      if ((heroes > 0 || units >= OBJECTIVE.homeFledglings) && pressure > most) {
        most = pressure;
        worst = { structure: s, defenders: Math.max(OBJECTIVE.defendBots, heroes + 1) };
      }
    }
    return worst;
  }

  /** Created on match start, once the heroes exist. */
  function start(): void {
    const heroes = ctx.store.list('hero');
    const lanes = assignLanes(heroes);
    const geoms = new Map(ctx.map.lanes.map((l) => [l.id, laneGeom(l)]));
    shared = {
      ctx,
      nav: navFor(ctx.map),
      lanes: geoms,
      updraftOf: new Map(ctx.map.updrafts.map((u, i) => [u.lane, i])),
      catalogue,
      bots: new Set(heroes.filter(isBot).map((h) => h.id)),
      towers,
      orders,
      policy,
      pushLane,
      siege,
      homeThreat,
    };
    // Bots play maps with lanes. On a lane-less test map (the arena) they stand still as the W1 stub did, so benches
    // that place a bot as a target keep working (D-AI-007).
    if (ctx.map.lanes.length === 0) return;
    for (const h of heroes) {
      if (!isBot(h)) continue;
      const a = lanes.get(h.id) ?? { lane: LANE_ORDER[0]!, side: 1 as const, roamer: false };
      const bot = createBot(shared, h, a.lane, a.side, a.roamer);
      bots.push(bot);
      byId.set(h.id, bot);
    }
  }

  /** The `n` living bots of `team` nearest to p within `range`, not counting `except`. */
  function nearestBots(team: PlayerTeam, p: Vec3, n: number, range: number, except?: EntityId): Bot[] {
    return bots
      .map((b) => ({ b, h: ctx.store.getKind(b.id, 'hero') }))
      .filter(({ b, h }) => b.team === team && b.id !== except && h && !h.health.dead && dmath.hypot(h.pos.x - p.x, h.pos.z - p.z) <= range)
      .sort((x, y) => dmath.hypot(x.h!.pos.x - p.x, x.h!.pos.z - p.z) - dmath.hypot(y.h!.pos.x - p.x, y.h!.pos.z - p.z) || x.b.id - y.b.id)
      .slice(0, n)
      .map(({ b }) => b);
  }

  // Pings from a flock's human: the nearest bots answer by going there (GDD §11, §12.5).
  ctx.bus.on('ping', (e) => {
    if (byId.has(e.by) || e.kind === 'onMyWay' || e.kind === 'retreat' || e.kind === 'danger') return;
    for (const b of nearestBots(e.team, e.pos, OBJECTIVE.pingBots, OBJECTIVE.pingM, e.by)) {
      orders.set(b.id, { pos: { ...e.pos }, until: ctx.clock.tick + ticks(OBJECTIVE.pingS) });
    }
  });
  ctx.bus.on('hero.respawned', (e) => byId.get(e.hero)?.moved());
  ctx.bus.on('movement', (e) => {
    if (e.yaw !== undefined) byId.get(e.hero)?.moved(e.yaw);
  });
  ctx.bus.on('weapon.fired', (e) => byId.get(e.shooter)?.fired());
  /** Allied structures hit by an enemy hero, and when (the Defend trigger). */
  const struck = new Map<EntityId, Tick>();
  ctx.bus.on('damage.applied', (e) => {
    if (e.targetKind === 'structure' && e.source !== null && ctx.store.get(e.source)?.kind === 'hero') struck.set(e.target, ctx.clock.tick);
  });

  /**
   * GDD §11.3 Defend: 2+ enemy heroes attacking an allied structure → the 3 nearest bots go. Checked once a second;
   * "attacking" = within OBJECTIVE.defendM of it and the structure hit by a hero in the last defendS.
   */
  const defendEvery = ticks(1);
  function defend(): void {
    for (const team of PLAYER_TEAMS) {
      const foes = ctx.store.list('hero').filter((h) => h.team !== team && !h.health.dead && canSee(team, h));
      if (foes.length < OBJECTIVE.defendHeroes) continue;
      for (const s of ctx.store.list('structure')) {
        if (s.team !== team || s.structure.type === 'nest' || s.removed) continue;
        if (ctx.clock.tick - (struck.get(s.id) ?? -Infinity) > ticks(OBJECTIVE.defendS)) continue;
        const attackers = foes.filter((f) => dmath.hypot(f.pos.x - s.pos.x, f.pos.z - s.pos.z) <= OBJECTIVE.defendM).length;
        if (attackers < OBJECTIVE.defendHeroes) continue;
        for (const b of nearestBots(team, s.pos, OBJECTIVE.defendBots, OBJECTIVE.defendRangeM)) {
          if ((orders.get(b.id)?.until ?? 0) <= ctx.clock.tick) orders.set(b.id, { pos: { ...s.pos }, until: ctx.clock.tick + ticks(OBJECTIVE.pingS) });
        }
      }
    }
  }

  return {
    name: 'ai',
    phases: {
      ai: () => {
        if (!shared) start();
        towers.length = 0;
        for (const s of ctx.store.list('structure')) if (s.structure.type !== 'nest' && !s.health.dead) towers.push(s);
        if (ctx.clock.tick % defendEvery === 0) defend();
        for (const b of bots) b.tick();
      },
    },
    hash(h) {
      for (const b of bots) b.hash(h);
      h.value(orders);
      h.value([committed, rocKilledAt]);
    },
  };
};
