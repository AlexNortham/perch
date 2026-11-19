import { Button, ViewFlag } from './contracts';
import type {
  Entity,
  EntityId,
  EntityView,
  HeroEntity,
  HeroView,
  PlayerTeam,
  SimContext,
  SimView,
  TeamView,
  StatusInstance,
  StatusView,
} from './contracts';
import { AP_COSTS } from '../data/abilities';
import { DEFAULT_AIM_ZOOM } from '../data/core';
import { copy } from './math';
import type { TelemetryCollector } from './telemetry';

function flagsOf(e: Entity): number {
  let f = 0;
  if ('stats' in e) {
    const c = e.stats.conditions;
    if (c.has('stunned')) f |= ViewFlag.Stunned;
    if (c.has('silenced')) f |= ViewFlag.Silenced;
    if (c.has('revealed')) f |= ViewFlag.Revealed;
    if (c.has('invisible')) f |= ViewFlag.Invisible;
    if (c.has('invulnerable')) f |= ViewFlag.Invulnerable;
    if (c.has('intangible')) f |= ViewFlag.Intangible;
    if (c.has('eggCarrier')) f |= ViewFlag.EggCarrier;
    if (e.health.dead) f |= ViewFlag.Dead;
  }
  switch (e.kind) {
    case 'hero': {
      const m = e.motor;
      if (m.grounded) f |= ViewFlag.Grounded;
      if (m.crouching) f |= ViewFlag.Crouching;
      if (m.sliding) f |= ViewFlag.Sliding;
      if (m.dashing) f |= ViewFlag.Dashing;
      if (m.mantling) f |= ViewFlag.Mantling;
      if (m.updraft !== null) f |= ViewFlag.OnUpdraft;
      if (m.climb !== null) f |= ViewFlag.Climbing;
      if (m.knockedUp) f |= ViewFlag.KnockedUp;
      if (e.abilities.casting !== null) f |= ViewFlag.Casting;
      if (e.abilities.channelling) f |= ViewFlag.Channelling;
      if (e.weapon.meleePose && e.weapon.meleePose !== 'parry') f |= ViewFlag.Meleeing;
      if (e.command.held & Button.Aim) f |= ViewFlag.Aiming;
      if (e.weapon.firing) f |= ViewFlag.Firing;
      if (e.weapon.reloading) f |= ViewFlag.Reloading;
      break;
    }
    case 'unit':
      if (e.unit.attacking) f |= ViewFlag.Attacking;
      break;
    case 'structure':
      if (e.structure.target !== null) f |= ViewFlag.Attacking;
      if (e.structure.weakPoint !== null) f |= ViewFlag.WeakPoint;
      break;
    case 'pickup':
      if (e.pickup.carrier !== null) f |= ViewFlag.Carried;
      break;
    default:
      break;
  }
  return f;
}

function typeOf(e: Entity): string {
  switch (e.kind) {
    case 'hero':
      return e.hero.heroId;
    case 'unit':
      return e.unit.summon ?? e.unit.type;
    case 'structure':
      return e.structure.type;
    case 'pickup':
      return e.pickup.type;
    case 'area':
      return e.area.shape;
    default:
      return '';
  }
}

function statusView(st: StatusInstance): StatusView {
  return { id: st.def.id, name: st.def.name, negative: st.def.negative, stacks: st.stacks, expiresAt: st.expiresAt };
}

function entityView(e: Entity): EntityView {
  const health = 'health' in e ? e.health : null;
  return {
    id: e.id,
    kind: e.kind,
    team: e.team,
    type: typeOf(e),
    pos: copy(e.pos),
    vel: copy(e.vel),
    yaw: e.yaw,
    pitch: e.kind === 'hero' ? e.pitch : 0,
    radius: e.radius,
    hp: health?.hp ?? 0,
    maxHp: 'stats' in e ? e.stats.final.maxHealth : 0,
    shield: health ? health.talonShield + health.songShield + health.barrier : 0,
    flags: flagsOf(e),
    ...(e.kind === 'hero' && e.weapon.meleePose && { meleePose: e.weapon.meleePose }),
    mode: e.kind === 'hero' ? e.motor.mode : null,
    seenBy: e.seenBy,
    mapSeenBy: e.seenBy | (e.mapOnlySeenBy ?? 0),
    ...(e.kind === 'unit' && { statuses: e.statuses.map(statusView) }),
    ...(e.kind === 'pickup' && { expiresAt: e.pickup.expiresAt }),
    ...(e.kind === 'projectile' && { projectile: { ...e.projectile } }),
    ...(e.kind === 'area' && { area: { ...e.area, ...(e.area.dimensions && { dimensions: { ...e.area.dimensions } }) } }),
    ...(e.kind === 'structure' && { structure: { ...e.structure, body: { ...e.structure.body },
      weakPoint: e.structure.weakPoint && { centre: copy(e.structure.weakPoint.centre), radius: e.structure.weakPoint.radius } } }),
  };
}

function heroView(ctx: SimContext, h: HeroEntity, scores: TelemetryCollector): HeroView {
  const s = scores.score(h.id);
  return {
    id: h.id,
    heroId: h.hero.heroId,
    team: h.team,
    slot: h.hero.slot,
    controller: h.hero.controller,
    level: h.progress.level,
    seeds: h.progress.seeds,
    netWorth: h.progress.netWorth,
    ap: h.abilities.ap,
    kills: s?.kills ?? 0,
    deaths: s?.deaths ?? 0,
    assists: s?.assists ?? 0,
    lastHits: s?.lastHits ?? 0,
    denies: s?.denies ?? 0,
    ammo: h.weapon.ammo,
    magazine: h.stats.final.magazine,
    stamina: h.motor.stamina,
    staminaMax: h.stats.final.stamina,
    dashJumpReady: h.motor.dashJumpReady ?? false,
    respawnAt: h.health.respawnAt,
    talonShield: h.health.talonShield,
    songShield: h.health.songShield,
    barrier: h.health.barrier,
    shoulder: h.shoulder,
    shopZone: h.inventory.shopZone ?? null,
    aimZoom: ctx.heroes[h.hero.heroId].def.weapon.aimZoom ?? DEFAULT_AIM_ZOOM,
    abilities: h.abilities.slots.map((slot) => ({ ...slot, nextUpgradeCost: AP_COSTS[slot.tier] ?? null })),
    items: h.inventory.items.map((item) => ({ ...item })),
    actives: [...h.inventory.actives],
    statuses: h.statuses.map(statusView),
  };
}

function teamView(ctx: SimContext, team: PlayerTeam, heroes: readonly HeroView[], scores: TelemetryCollector): TeamView {
  const t = ctx.teams[team];
  let netWorth = 0;
  for (const h of heroes) if (h.team === team) netWorth += h.netWorth;
  return { team, kills: scores.teamKills(team), netWorth, flexSlots: t.flexSlots, emberUntil: t.emberUntil };
}

/** Snapshot the sim for the client. `heroIds` is the roster order. */
export function buildView(
  ctx: SimContext,
  scores: TelemetryCollector,
  heroIds: readonly EntityId[],
  localHero: EntityId | null,
  winner: PlayerTeam | null,
): SimView {
  const heroes: HeroView[] = [];
  for (const id of heroIds) {
    const h = ctx.store.getKind(id, 'hero');
    if (h) heroes.push(heroView(ctx, h, scores));
  }
  return {
    tick: ctx.clock.tick,
    seconds: ctx.clock.seconds,
    map: ctx.config.map,
    localHero,
    entities: ctx.store.all().map(entityView),
    heroes,
    teams: { dawn: teamView(ctx, 'dawn', heroes, scores), dusk: teamView(ctx, 'dusk', heroes, scores) },
    objectives: { ...ctx.objectives },
    over: winner !== null,
    winner,
  };
}
