import type {
  Damageable, DamageType, Effect, EffectCause, EntityId, Hasher, HeroEntity, PlayerTeam,
  SimContext, StructureAttackEvent, StructureEntity, UnitEntity, Vec3,
} from '../core/contracts';
import { LANE_IDS } from '../core/contracts';
import { ticks } from '../core/math';
import { canSee } from '../core/vision';
import { DEFENCE as D, FLEDGLING_AI, STRUCTURE_BODY, STRUCTURE_RADIUS } from '../data/world';
import { isFledgling } from './fledglings';
import { aimHeight } from './vision';

type Actor = HeroEntity | UnitEntity;
type Attack = StructureAttackEvent['attack'];
interface Tower {
  e: StructureEntity;
  next: number;
  special: number;
  gale: number;
  consecutive: number;
}
interface Impact {
  tower: StructureEntity;
  at: number;
  target: EntityId | null;
  point: Vec3;
  attack: 'bolt' | 'volley' | 'stomp' | 'rain';
  damage: number;
}

export interface HeroThreat { tick: number; victimPos: Vec3 }

const distance2 = (a: Vec3, b: Vec3): number => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
const enemyTeam = (s: StructureEntity): PlayerTeam => s.team === 'dawn' ? 'dusk' : 'dawn';

export function createStructures(ctx: SimContext, hurtAt: ReadonlyMap<EntityId, HeroThreat>) {
  const towers: Tower[] = [];
  const pending: Impact[] = [];
  const roosts = ctx.map.shops.filter((s) => s.kind === 'roost');
  const nearby: EntityId[] = [];
  const actors: Actor[] = [];
  const threatWindow = ticks(FLEDGLING_AI.hurtWindowS);
  let ended = false;

  function apply(source: StructureEntity | null, team: PlayerTeam, origin: Vec3, e: Damageable, effect: Effect): void {
    const cause: EffectCause = { source: source?.id ?? null, team, origin, via: 'structure', ability: null,
      item: null, songPower: 0, values: null, proc: false };
    ctx.effects.apply(effect, { entity: e.id, point: e.pos, dir: { x: 0, y: 0, z: 1 } }, cause);
  }

  function hit(s: StructureEntity, a: Actor, type: DamageType, amount: number, push = 0): void {
    const team = s.team as PlayerTeam;
    if (amount) apply(s, team, s.pos, a, { kind: 'damage', amount, type });
    if (push) apply(s, team, s.pos, a, { kind: 'displace', mode: 'push', distance: push });
  }

  function cue(s: StructureEntity, attack: Attack, point: Vec3, at: number): void {
    ctx.bus.emit({ type: 'structure.attack', structure: s.id, attack, origin: {
      ...s.pos, y: s.pos.y + s.structure.body.height * D.muzzleHeightFraction,
    }, point: { ...point }, impactAt: at });
  }

  function enemies(s: StructureEntity, centre: Vec3, range: number): Actor[] {
    ctx.spatial.query(centre, range, nearby);
    actors.length = 0;
    for (const id of nearby) {
      const a = ctx.store.get(id);
      if ((a?.kind === 'hero' || a?.kind === 'unit') && a.team === enemyTeam(s) && !a.health.dead &&
          !a.removed && !a.stats.conditions.has('intangible') && distance2(centre, a.pos) <= range * range) actors.push(a);
    }
    return actors;
  }

  function shoot(s: StructureEntity, a: Actor, attack: 'bolt' | 'volley', damage: number): void {
    const point = { ...a.pos, y: a.pos.y + aimHeight(ctx, a) };
    const dy = point.y - (s.pos.y + s.structure.body.height * D.muzzleHeightFraction);
    const travel = Math.hypot(point.x - s.pos.x, dy, point.z - s.pos.z) / D.boltSpeed;
    const at = ctx.clock.tick + Math.max(1, ticks(travel));
    pending.push({ tower: s, at, target: a.id, point, attack, damage });
    cue(s, attack, point, at);
  }

  function impact(p: Impact): void {
    const s = p.tower;
    if (p.target !== null) {
      const a = ctx.store.get(p.target);
      if (a?.kind === 'unit' || a?.kind === 'hero') hit(s, a, p.attack === 'bolt' ? 'talon' : 'song', p.damage);
    } else if (!s.removed) {
      const stomp = p.attack === 'stomp';
      for (const a of enemies(s, p.point, stomp ? D.stomp.range : D.rain.radius)) {
        hit(s, a, 'song', p.damage, stomp ? D.stomp.push : 0);
      }
    }
  }

  function schedule(s: StructureEntity, attack: 'stomp' | 'rain', point: Vec3, warning: number, damage: number): void {
    const at = ctx.clock.tick + ticks(warning);
    pending.push({ tower: s, at, target: null, point: { ...point }, attack, damage });
    cue(s, attack, point, at);
  }

  function defend(t: Tower, type: 'hawk' | 'heron' | 'warden'): void {
    const s = t.e;
    const def = D[type];
    let preferred: Actor | undefined;
    let bestRank = Infinity;
    let bestD = Infinity;
    let close = false;
    for (const a of enemies(s, s.pos, def.range)) {
      const dist = distance2(a.pos, s.pos);
      if (dist <= D.stomp.range ** 2) close = true;
      if (!canSee(s.team as PlayerTeam, a) || (a.kind === 'unit' && !isFledgling(a))) continue;
      const threat = a.kind === 'hero' ? hurtAt.get(a.id) : undefined;
      const hostile = threat && ctx.clock.tick - threat.tick <= threatWindow && distance2(s.pos, threat.victimPos) <= def.range ** 2;
      const rank = hostile ? 0 : s.structure.target === a.id ? 1 : a.kind === 'unit' ? 2 : 3;
      if (rank < bestRank || (rank === bestRank && dist < bestD)) {
        preferred = a;
        bestRank = rank;
        bestD = dist;
      }
    }
    if (type === 'heron' && close && ctx.clock.tick >= t.special) {
      schedule(s, 'stomp', s.pos, D.stomp.warning, D.stomp.damage);
      t.special = ctx.clock.tick + ticks(D.stomp.interval);
    }
    if ((preferred?.id ?? null) !== s.structure.target) t.consecutive = 0;
    s.structure.target = preferred?.id ?? null;
    if (!preferred || ctx.clock.tick < t.next) return;
    const damage = preferred.kind === 'hero' ? def.heroHit * (1 + Math.min(def.cap, t.consecutive * def.ramp)) : def.unitHit;
    if (type === 'heron') {
      cue(s, 'beam', { ...preferred.pos, y: preferred.pos.y + aimHeight(ctx, preferred) }, ctx.clock.tick);
      hit(s, preferred, 'talon', damage);
    } else shoot(s, preferred, 'bolt', damage);
    t.consecutive++;
    t.next = ctx.clock.tick + ticks(def.interval);
  }

  function baseAttack(t: Tower, shrine: boolean): void {
    const s = t.e;
    const now = ctx.clock.tick;
    if (now < t.next && (shrine || (now < t.special && now < t.gale))) return;
    const targets = enemies(s, s.pos, shrine ? D.pulse.range : D.volley.range)
      .filter((a): a is HeroEntity => a.kind === 'hero' && canSee(s.team as PlayerTeam, a))
      .sort((a, b) => distance2(a.pos, s.pos) - distance2(b.pos, s.pos));
    s.structure.target = targets[0]?.id ?? null;
    if (targets.length === 0) return;
    if (shrine) {
      cue(s, 'pulse', s.pos, now);
      for (const a of targets) hit(s, a, 'song', D.pulse.damage);
      t.next = now + ticks(D.pulse.interval);
      return;
    }
    const first = s.structure.phase === 1;
    if (now >= t.next) {
      for (let i = 0; i < D.volley.feathers; i++) {
        const a = targets[i % Math.min(D.volley.targets, targets.length)]!;
        shoot(s, a, 'volley', D.volley.damage);
      }
      t.next = now + ticks(first ? D.volley.phase1 : D.volley.phase2);
    }
    if (now >= t.special) {
      if (first && distance2(targets[0]!.pos, s.pos) <= D.screech.range ** 2) {
        cue(s, 'screech', s.pos, now);
        for (const a of enemies(s, s.pos, D.screech.range)) hit(s, a, 'song', D.screech.damage, D.screech.push);
        t.special = now + ticks(D.screech.interval);
      } else if (!first) {
        for (const a of targets.slice(0, D.rain.targets)) schedule(s, 'rain', a.pos, D.rain.warning, D.rain.damage);
        t.special = now + ticks(D.rain.interval);
      }
    }
    if (!first && now >= t.gale && distance2(s.pos, targets[0]!.pos) <= D.gale.range ** 2) {
      const facing = targets[0]!.pos;
      const dx = facing.x - s.pos.x;
      const dz = facing.z - s.pos.z;
      cue(s, 'gale', facing, now);
      for (const a of enemies(s, s.pos, D.gale.range)) {
        const x = a.pos.x - s.pos.x;
        const z = a.pos.z - s.pos.z;
        if (x * dx + z * dz >= Math.hypot(x, z) * Math.hypot(dx, dz) * D.gale.cosHalf) hit(s, a, 'song', D.gale.damage, D.gale.push);
      }
      t.gale = now + ticks(D.gale.interval);
    }
  }

  function refreshGates(): void {
    for (const { e: s } of towers) {
      if (s.removed) continue;
      const info = s.structure;
      const standing = (type: string, lane = info.lane) => towers.some(({ e }) =>
        !e.removed && e.team === s.team && e.structure.type === type && e.structure.lane === lane);
      const gated = info.type === 'heron' ? standing('hawk') : info.type === 'warden' ? standing('heron') :
        info.type === 'shrine' ? LANE_IDS.every((lane) => standing('warden', lane)) : info.type === 'patron' && standing('shrine');
      if (s.stats.sources.has('world:gate') === gated) continue;
      ctx.stats.set(s.id, 'world:gate', gated ? { conditions: ['invulnerable'] } : null);
      if (!gated) ctx.bus.emit({ type: 'structure.state', structure: s.id, state: 'vulnerable' });
    }
  }

  function ward(s: StructureEntity): void {
    const active = !enemies(s, s.pos, D.ward.range).some((a) => a.kind === 'unit' && isFledgling(a));
    const factor = ctx.clock.seconds >= D.ward.lateAtS ? D.ward.late : D.ward.early;
    if (active === s.structure.broodWard && (!active || s.stats.final.damageTaken === factor)) return;
    ctx.stats.set(s.id, 'world:ward', active ? { stats: [{ stat: 'damageTaken', op: 'mul', value: factor }] } : null);
    if (active !== s.structure.broodWard) {
      s.structure.broodWard = active;
      ctx.bus.emit({ type: 'structure.state', structure: s.id, state: active ? 'wardUp' : 'wardDown' });
    }
  }

  ctx.bus.on('match.started', () => {
    for (const a of ctx.map.structures) {
      const def = STRUCTURE_BODY[a.type];
      const radius = STRUCTURE_RADIUS[a.type];
      const e = ctx.store.spawn({ kind: 'structure', team: a.team, pos: { ...a.pos }, vel: { x: 0, y: 0, z: 0 }, yaw: a.yaw, radius,
        structure: { type: a.type, lane: a.lane, phase: 1, target: null, body: { radius, height: def.height }, weakPoint: null },
        stats: ctx.stats.create({ maxHealth: def.hp }), statuses: [],
        health: { hp: def.hp, dead: false, respawnAt: null, talonShield: 0, songShield: 0, barrier: 0, inCombatUntil: 0 },
      });
      towers.push({ e, next: 0, special: 0, gale: 0, consecutive: 0 });
      ward(e);
    }
    refreshGates();
  });
  ctx.bus.on('entity.died', (event) => {
    if (event.victimKind !== 'structure') return;
    const s = ctx.store.getKind(event.victim, 'structure');
    if (!s) return;
    if (s.structure.type === 'patron' && s.structure.phase === 2 && !ended) {
      ended = true;
      ctx.bus.emit({ type: 'match.ended', reason: 'patron', winner: enemyTeam(s) });
    } else refreshGates();
  });

  ctx.bus.on('patron.depleted', ({ structure }) => {
    const s = ctx.store.getKind(structure, 'structure');
    if (!s || s.structure.phase !== 1 || s.structure.transitionUntil !== undefined) return;
    s.structure.transitionUntil = ctx.clock.tick + ticks(D.transition.duration);
    s.structure.target = null;
    ctx.stats.set(s.id, 'world:transition', { conditions: ['invulnerable'] });
    cue(s, 'transition', s.pos, ctx.clock.tick);
    for (const a of enemies(s, s.pos, D.transition.range)) hit(s, a, 'song', 0, D.transition.push);
  });

  function phaseTwo(t: Tower): void {
    const s = t.e;
    const info = s.structure;
    info.phase = 2;
    delete info.transitionUntil;
    info.weakPoint = { centre: { x: s.pos.x + Math.sin(s.yaw) * s.radius, y: s.pos.y + D.transition.heartHeight,
      z: s.pos.z + Math.cos(s.yaw) * s.radius }, radius: D.transition.heartRadius };
    ctx.stats.setBase(s.id, { ...s.stats.base, maxHealth: D.transition.hp });
    apply(s, s.team as PlayerTeam, s.pos, s, { kind: 'heal', amount: D.transition.hp });
    ctx.stats.set(s.id, 'world:transition', null);
    t.next = t.special = t.gale = ctx.clock.tick;
    ctx.bus.emit({ type: 'structure.state', structure: s.id, state: 'phase2' });
  }

  function homeRoost(): void {
    for (const zone of roosts) {
      for (const h of ctx.store.list('hero')) {
        if (h.health.dead || distance2(h.pos, zone.pos) > zone.radius ** 2) continue;
        if (h.team === zone.team) {
          if (h.health.hp < h.stats.final.maxHealth) apply(null, zone.team, zone.pos, h, { kind: 'heal', amount: h.stats.final.maxHealth * D.roost.healFraction });
        } else apply(null, zone.team, zone.pos, h, { kind: 'damage', type: 'song', amount: D.roost.damage });
      }
    }
  }

  return {
    update() {
      const now = ctx.clock.tick;
      let n = 0;
      for (const p of pending) {
        if (p.at <= now) impact(p);
        else pending[n++] = p;
      }
      pending.length = n;
      if (now % ticks(D.roost.interval) === 0) homeRoost();
      for (const t of towers) {
        const s = t.e;
        if (s.removed) continue;
        if ((now + s.id) % D.scanTicks === 0) ward(s);
        const info = s.structure;
        if (info.transitionUntil !== undefined) {
          if (now >= info.transitionUntil) phaseTwo(t);
          else continue;
        }
        if (info.type === 'hawk' || info.type === 'warden' || info.type === 'heron') {
          if ((now + s.id) % D.scanTicks === 0 || (info.target !== null && now >= t.next)) defend(t, info.type);
        } else if (!s.stats.conditions.has('invulnerable')) baseAttack(t, info.type === 'shrine');
      }
    },
    hash(h: Hasher) {
      h.num(ended ? 1 : 0);
      for (const t of towers) h.value([t.e.id, t.next, t.special, t.gale, t.consecutive]);
      for (const p of pending) h.value([p.tower.id, p.target, p.at, p.point, p.attack, p.damage]);
    },
  };
}

