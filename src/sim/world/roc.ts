/**
 * The Roc, the Phoenix Embers and Rekindle (GDD §7.12).
 *
 * The Roc sleeps in the Hollow (invulnerable) until 20:00, then wakes with 24,000 HP, +300 max HP per whole minute it
 * lives (current HP rising with it), 15 HP/s regeneration and 15% Talon resist. Only heroes standing in the Hollow
 * (y ≤ −2) hurt it (combat honours `damageFrom`) or draw its aggro: the nearest, re-chosen every second. It Rakes its
 * target every 2.5 s (an 8 m, 90° cone, 140 Talon) and Gale Flaps every 10 s (15 m, 80 Song, 10 m knockback); below
 * 25% HP it enrages (a map-wide roar, +30% attack speed, a 20 m Sky Shriek silencing for 1.5 s every 8 s). With no
 * hero in the Hollow for 8 s it heals to full. On its death every hero of the killing flock gets 2 keepsakes (economy
 * pays the Seeds) and three Embers fall over 6 s; a heavy melee hit by either flock claims one: full heal, Seeds from
 * economy, and a Rekindle charge for the claimer's flock (3 at most per kill, 180 s from the first claim). Each revive
 * (combat) spends a charge. It returns 7:00, 6:00, then 5:00 after each kill.
 */
import type { EntityId, Hasher, HeroEntity, PickupEntity, PlayerTeam, SimContext, Tick, UnitEntity, Vec3 } from '../core/contracts';
import { ticks } from '../core/math';
import { SILENCE } from '../data/combat';
import { EMBERS, ROC } from '../data/world';
import type { Keepsakes } from './keepsakes';
import { MINUTE_TICKS, flatDistSq, spawnPickup, targetOf, worldCause } from './neutral';
import * as dmath from '../core/dmath';

type RocAttack = 'rake' | 'flap' | 'shriek';
const TEAMS: readonly PlayerTeam[] = ['dawn', 'dusk'];


interface Impact {
  readonly at: Tick;
  readonly attack: RocAttack;
  /** Rake: the cone's horizontal unit direction. */
  readonly dx: number;
  readonly dz: number;
}

interface Ember {
  readonly e: PickupEntity;
  readonly landAt: Tick;
  landed: boolean;
}

export interface Roc {
  update(): void;
  hash(h: Hasher): void;
}

export function createRoc(ctx: SimContext, keepsakes: Keepsakes): Roc {
  const hollow = ctx.map.hollow;
  const home: Vec3 = hollow ? { x: hollow.centre.x, y: hollow.floorY, z: hollow.centre.z } : { x: 0, y: 0, z: 0 };
  const reach = hollow ? hollow.radius + ROC.hollowPadM : 0;
  let roc: UnitEntity | null = null;
  let kills = 0;
  let bornAt: Tick = 0;
  let grown = 0;
  let target: HeroEntity | null = null;
  let nextPick: Tick = 0;
  let nextRake: Tick = 0;
  let nextFlap: Tick = 0;
  let nextShriek: Tick = 0;
  let emptySince: Tick | null = null;
  let reset = true;
  const pending: Impact[] = [];
  const embers: Ember[] = [];
  /** The Roc kill each flock's Rekindle came from. */
  const rekindleKill: Record<PlayerTeam, number> = { dawn: -1, dusk: -1 };
  const inside: HeroEntity[] = [];
  if (hollow) ctx.objectives.rocAt = ticks(ROC.wakeS);

  const isInside = (h: HeroEntity): boolean => !h.health.dead && h.pos.y <= ROC.hollowMaxY && flatDistSq(h.pos, home) <= reach * reach;
  const cause = () => worldCause(roc!.id, 'neutral', roc!.pos, 'unit');
  const speed = (): number => (roc?.unit.enraged ? 1 + ROC.enrage.attackSpeed : 1);

  const spawn = (asleep: boolean): void => {
    roc = ctx.store.spawn({
      kind: 'unit', team: 'neutral', pos: { ...home }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, radius: ROC.radius,
      unit: { type: 'roc', lane: null, height: ROC.height, owner: null, summon: null, target: null, attacking: false, camp: null,
        asleep, enraged: false, damageFrom: { centre: { ...home }, radius: reach, maxY: ROC.hollowMaxY } },
      health: { hp: ROC.hp, talonShield: 0, songShield: 0, barrier: 0, dead: false, respawnAt: null, inCombatUntil: 0 },
      stats: ctx.stats.create({ maxHealth: ROC.hp, healthRegen: ROC.regen, talonResist: ROC.resists.talon, songResist: ROC.resists.song }),
      statuses: [],
    });
    // A boss: no crowd control or displacement (assumed, D-OBJ-011).
    ctx.stats.set(roc.id, 'world:roc', { conditions: ['unstoppable'] });
    if (asleep) ctx.stats.set(roc.id, 'world:asleep', { conditions: ['invulnerable'] });
    else wake();
  };

  const wake = (): void => {
    const r = roc!;
    r.unit.asleep = false;
    ctx.stats.set(r.id, 'world:asleep', null);
    bornAt = ctx.clock.tick;
    grown = 0;
    target = null;
    emptySince = null;
    reset = true;
    ctx.objectives.rocAt = null;
    ctx.bus.emit({ type: 'unit.state', unit: r.id, state: 'awake' });
    ctx.bus.emit({ type: 'objective', action: 'rocSpawned', hero: null, team: 'neutral', pickup: null, pickupType: null, pos: { ...r.pos } });
  };

  const cue = (attack: RocAttack, point: Vec3, windupS: number): Tick => {
    const r = roc!;
    const at = ctx.clock.tick + ticks(windupS);
    ctx.bus.emit({ type: 'unit.attack', unit: r.id, attack, origin: { x: r.pos.x, y: r.pos.y + ROC.height / 2, z: r.pos.z },
      point: { ...point }, impactAt: at });
    return at;
  };

  const attack = (now: Tick, t: HeroEntity): void => {
    const r = roc!;
    const k = speed();
    if (now >= nextRake) {
      const dx = t.pos.x - r.pos.x;
      const dz = t.pos.z - r.pos.z;
      const len = dmath.hypot(dx, dz) || 1;
      r.yaw = dmath.atan2(dx, dz);
      pending.push({ at: cue('rake', t.pos, ROC.rake.windupS), attack: 'rake', dx: dx / len, dz: dz / len });
      nextRake = now + Math.round(ticks(ROC.rake.everyS) / k);
    }
    if (now >= nextFlap) {
      pending.push({ at: cue('flap', r.pos, ROC.flap.windupS), attack: 'flap', dx: 0, dz: 0 });
      nextFlap = now + Math.round(ticks(ROC.flap.everyS) / k);
    }
    if (r.unit.enraged && now >= nextShriek) {
      pending.push({ at: cue('shriek', r.pos, ROC.shriek.windupS), attack: 'shriek', dx: 0, dz: 0 });
      nextShriek = now + ticks(ROC.shriek.everyS);
    }
  };

  const impact = (p: Impact): void => {
    const r = roc!;
    const c = cause();
    for (const h of ctx.store.list('hero')) {
      if (h.health.dead) continue;
      const x = h.pos.x - r.pos.x;
      const z = h.pos.z - r.pos.z;
      const d2 = x * x + z * z;
      if (p.attack === 'rake') {
        const len = ROC.rake.lengthM + ROC.radius;
        if (d2 > len * len || x * p.dx + z * p.dz < Math.sqrt(d2) * ROC.rake.cosHalf) continue;
        ctx.effects.apply({ kind: 'damage', amount: ROC.rake.damage, type: 'talon' }, targetOf(h), c);
      } else if (p.attack === 'flap') {
        if (d2 > ROC.flap.radius ** 2) continue;
        ctx.effects.apply({ kind: 'damage', amount: ROC.flap.damage, type: 'song' }, targetOf(h), c);
        ctx.effects.apply({ kind: 'displace', mode: 'push', distance: ROC.flap.push }, targetOf(h), c);
      } else if (d2 <= ROC.shriek.radius ** 2) {
        ctx.effects.apply({ kind: 'applyStatus', status: SILENCE, durationS: ROC.shriek.silenceS }, targetOf(h), c);
      }
    }
  };

  const fight = (now: Tick): void => {
    const r = roc!;
    const m = Math.floor((now - bornAt) / MINUTE_TICKS);
    if (m > grown) {
      const gain = (m - grown) * ROC.hpPerMinute;
      grown = m;
      ctx.stats.setBase(r.id, { ...r.stats.base, maxHealth: ROC.hp + grown * ROC.hpPerMinute });
      ctx.effects.apply({ kind: 'heal', amount: gain }, targetOf(r), cause());
    }
    if (!r.unit.enraged && r.health.hp <= r.stats.final.maxHealth * ROC.enrage.atFraction) {
      r.unit.enraged = true;
      nextShriek = now;
      ctx.bus.emit({ type: 'unit.state', unit: r.id, state: 'enraged' });
    }
    let k = 0;
    for (const p of pending) {
      if (p.at <= now) impact(p);
      else pending[k++] = p;
    }
    pending.length = k;

    inside.length = 0;
    for (const h of ctx.store.list('hero')) if (isInside(h)) inside.push(h);
    if (inside.length === 0) {
      emptySince ??= now;
      target = null;
      r.unit.target = null;
      r.unit.attacking = false;
      if (!reset && now - emptySince >= ticks(ROC.resetS)) {
        reset = true;
        r.unit.enraged = false;
        ctx.effects.apply({ kind: 'heal', amount: r.stats.final.maxHealth }, targetOf(r), cause());
      }
      return;
    }
    emptySince = null;
    reset = false;
    if (!target || !isInside(target) || now >= nextPick) {
      target = inside.reduce((a, b) => (flatDistSq(b.pos, r.pos) < flatDistSq(a.pos, r.pos) ? b : a));
      r.unit.target = target.id;
      nextPick = now + ticks(ROC.aggroEveryS);
    }
    r.unit.attacking = true;
    attack(now, target);
  };

  const claim = (e: Ember, h: HeroEntity): void => {
    const now = ctx.clock.tick;
    ctx.store.despawn(e.e.id);
    ctx.effects.apply({ kind: 'heal', amount: h.stats.final.maxHealth }, targetOf(h), worldCause(null, 'neutral', e.e.pos, 'objective'));
    const team = ctx.teams[h.team];
    if (!team.rekindle || rekindleKill[h.team] !== kills) {
      team.rekindle = { until: now + ticks(EMBERS.rekindleS), charges: 1 };
      rekindleKill[h.team] = kills;
    } else team.rekindle.charges = Math.min(EMBERS.maxCharges, team.rekindle.charges + 1);
    ctx.bus.emit({ type: 'objective', action: 'emberClaimed', hero: h.id, team: h.team, pickup: e.e.id, pickupType: 'ember', pos: { ...e.e.pos } });
  };

  ctx.bus.on('match.started', () => {
    if (hollow) spawn(true);
  });

  ctx.bus.on('entity.died', (ev) => {
    if (ev.revives && ev.victimKind === 'hero' && ev.victimTeam !== 'neutral') {
      const rk = ctx.teams[ev.victimTeam].rekindle;
      if (rk) rk.charges = Math.max(0, rk.charges - 1);
      return;
    }
    if (!roc || ev.victim !== roc.id) return;
    const now = ctx.clock.tick;
    kills++;
    ctx.objectives.rocAt = now + ticks(ROC.respawnS[Math.min(kills, ROC.respawnS.length) - 1]!);
    roc = null;
    target = null;
    pending.length = 0;
    const killer = ctx.store.get(ev.creditHero ?? -1);
    if (killer?.kind === 'hero') {
      for (const h of ctx.store.list('hero')) if (h.team === killer.team) keepsakes.grant(h, ROC.reward.keepsakes);
    }
    // Each lies on its landing spot from the start; the client drops it from the sky until `claimableAt` (D-OBJ-010).
    // It lands on whatever is there: (10, −10, 0) is under the east ramp, so a floor-height Ember sat inside it.
    for (const spot of EMBERS.spots) {
      const x = home.x + spot.x;
      const z = home.z + spot.z;
      const y = ctx.physics.groundHeight(x, z, home.y + spot.y + EMBERS.fallFromM) ?? home.y + spot.y;
      const e = spawnPickup(ctx, 'ember', { x, y: y + EMBERS.radius, z }, EMBERS.radius,
        { melee: 'heavy', claimableAt: now + ticks(EMBERS.fallS), expiresAt: now + ticks(EMBERS.fallS + EMBERS.burnS) });
      embers.push({ e, landAt: now + ticks(EMBERS.fallS), landed: false });
    }
  });

  ctx.bus.on('melee', (ev) => {
    if (!ev.heavy || ev.parried || ev.target === null) return;
    const e = embers.find((m) => m.e.id === ev.target);
    const h = ctx.store.getKind(ev.attacker, 'hero');
    if (e && h && !e.e.removed && !h.health.dead && ctx.clock.tick >= e.landAt) claim(e, h);
  });

  return {
    update() {
      const now = ctx.clock.tick;
      const at = ctx.objectives.rocAt;
      if (hollow && at !== null && now >= at) {
        if (roc) wake();
        else spawn(false);
      }
      if (roc && !roc.unit.asleep && !roc.removed) fight(now);
      if (embers.length > 0) {
        let k = 0;
        for (const m of embers) {
          if (m.e.removed) continue;
          if (now >= (m.e.pickup.expiresAt ?? Infinity)) {
            ctx.store.despawn(m.e.id);
            continue;
          }
          if (!m.landed && now >= m.landAt) {
            m.landed = true;
            ctx.bus.emit({ type: 'objective', action: 'emberDropped', hero: null, team: 'neutral', pickup: m.e.id, pickupType: 'ember', pos: { ...m.e.pos } });
          }
          embers[k++] = m;
        }
        embers.length = k;
      }
      for (const t of TEAMS) {
        const rk = ctx.teams[t].rekindle;
        if (rk && (now >= rk.until || rk.charges <= 0)) delete ctx.teams[t].rekindle;
      }
    },
    hash(h) {
      h.value([roc?.id ?? -1, kills, bornAt, grown, target?.id ?? -1, nextPick, nextRake, nextFlap, nextShriek, emptySince, reset]);
      h.value(pending);
      h.value(embers.map((m): [EntityId, Tick, boolean] => [m.e.id, m.landAt, m.landed]));
      h.value(rekindleKill);
    },
  };
}
