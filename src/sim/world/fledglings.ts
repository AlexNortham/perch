/**
 * Fledgling waves (GDD §7.1): spawning at each gate, marching along the lane paths, target choice and attacks.
 *
 * Marching: each lane is walked as a track (the lane polyline in the flock's walking order). A fledgling in its lane
 * advances its arc length at the march speed and slides sideways toward its file, stepping round structure footprints
 * on the way, so a wave advances at exactly the march speed along the lane however it sidesteps. Off the lane (after
 * a chase) it heads back for a point a little ahead on the path. Units ignore walls (D-CTRL-002); moves go through
 * `ctx.physics.moveCharacter` for ground height. At enemy gates a siege wave pursues vulnerable base objectives.
 * Waves-only fixtures hold there, queued behind earlier arrivals in the same file.
 *
 * Fighting: every 0.5 s (staggered by id) a fledgling picks a target by the §7.1 rules, keeping its current one unless
 * a higher-priority one appears; a target that dies, goes out of sight or leaves 18 m is dropped at once. In reach it
 * stands and attacks: Scrappers apply a melee `damage` effect, Slingers fire a combat `projectile`, both `via: 'unit'`.
 */
import type {
  CharacterMove,
  Damageable,
  DamageBonus,
  DamageEffect,
  Effect,
  EffectCause,
  EntityId,
  Hasher,
  Lane,
  PlayerTeam,
  SimContext,
  StatBlock,
  Tick,
  UnitEntity,
  Vec3,
} from '../core/contracts';
import { distSq, ticks } from '../core/math';
import { canSee } from '../core/vision';
import { TICK_RATE, TICK_SECONDS } from '../data/core';
import { AIR, GROUND } from '../data/movement';
import type { HeroThreat } from './structures';
import { DEFENCE, FLEDGLING_AI as AI, FLEDGLINGS, STRUCTURE_RADIUS, WAVES } from '../data/world';
import type { FledglingDef, FledglingType } from '../data/world';
import { aimHeight } from './vision';

const SECONDS_PER_MINUTE = 60;
const EPS = 1e-6;
const VS_STRUCTURES: readonly DamageBonus[] = [{ mult: WAVES.vsStructures, targetKinds: ['structure'] }];
/** GDD §15.2 35:00 lever: a second target-kind bonus, so step 4 adds it (×1.75 in all, §5.2). */
const LATE_VS_STRUCTURES: readonly DamageBonus[] = [...VS_STRUCTURES, { mult: DEFENCE.ward.lateFledglingMult, targetKinds: ['structure'] }];
const SHOT_AFFECTS = { teams: 'enemies', kinds: ['hero', 'unit', 'structure'] } as const;
/** Target priorities (GDD §7.1), lower wins; NONE when there is no target. */
const NONE = 9;
const RULE = { fledgling: 1, hurtHero: 2, structure: 3, hero: 4 } as const;
const UNIT_RADIUS = Math.max(FLEDGLINGS.scrapper.radius, FLEDGLINGS.slinger.radius);
/** A melee attacker this close to its slot stands still. */
const SLOT_EPS = 0.01;

export const isFledgling = (u: UnitEntity): boolean => u.unit.type === 'scrapper' || u.unit.type === 'slinger';

/** A lane in one flock's walking order, with the structures to step round and where to hold. */
export interface Track {
  readonly lane: Lane;
  readonly team: PlayerTeam;
  readonly x: readonly number[];
  readonly y: readonly number[];
  readonly z: readonly number[];
  /** Per segment: arc length at its start, its length and unit direction. */
  readonly cum: readonly number[];
  readonly len: readonly number[];
  readonly dx: readonly number[];
  readonly dz: readonly number[];
  readonly length: number;
  /** Structure footprints near the path: arc, signed lateral offset (+ right of the walker) and clearance. */
  readonly obstacles: readonly { readonly s: number; readonly l: number; readonly c: number }[];
  /** Arc of the hold line in front of the enemy Wardens. */
  readonly holdS: number;
  /** Next free hold slot per file. */
  readonly holding: [number, number];
}

/** Nearest point of the track: arc `s`, signed lateral `lat` and distance `off`. */
export interface Projection {
  s: number;
  lat: number;
  off: number;
}

export function project(t: Track, x: number, z: number, out: Projection): Projection {
  let best = Infinity;
  for (let i = 0; i < t.len.length; i++) {
    const ax = t.x[i] as number;
    const az = t.z[i] as number;
    const dx = t.dx[i] as number;
    const dz = t.dz[i] as number;
    const along = Math.min(t.len[i] as number, Math.max(0, (x - ax) * dx + (z - az) * dz));
    const ex = x - (ax + dx * along);
    const ez = z - (az + dz * along);
    const d2 = ex * ex + ez * ez;
    if (d2 < best) {
      best = d2;
      out.s = (t.cum[i] as number) + along;
      out.lat = -ex * dz + ez * dx;
    }
  }
  out.off = Math.sqrt(best);
  return out;
}

/** The point at arc `s` (clamped to the track), `lat` metres to the walker's right. */
export function pointAt(t: Track, s: number, lat: number, out: Vec3): Vec3 {
  const n = t.len.length;
  const at = Math.min(t.length, Math.max(0, s));
  let i = 0;
  while (i < n - 1 && at > (t.cum[i] as number) + (t.len[i] as number)) i++;
  const a = at - (t.cum[i] as number);
  const dx = t.dx[i] as number;
  const dz = t.dz[i] as number;
  const y0 = t.y[i] as number;
  out.x = (t.x[i] as number) + dx * a - dz * lat;
  out.z = (t.z[i] as number) + dz * a + dx * lat;
  out.y = y0 + (((t.y[i + 1] as number) - y0) * a) / (t.len[i] as number);
  return out;
}

export function buildTrack(ctx: SimContext, lane: Lane, team: PlayerTeam): Track {
  const pts = team === 'dawn' ? lane.path : [...lane.path].reverse();
  const cum: number[] = [];
  const len: number[] = [];
  const dx: number[] = [];
  const dz: number[] = [];
  let length = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Vec3;
    const b = pts[i] as Vec3;
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    cum.push(length);
    len.push(Math.max(l, EPS));
    dx.push(l > EPS ? (b.x - a.x) / l : 0);
    dz.push(l > EPS ? (b.z - a.z) / l : 1);
    length += l;
  }
  const t: Track = {
    lane,
    team,
    x: pts.map((p) => p.x),
    y: pts.map((p) => p.y),
    z: pts.map((p) => p.z),
    cum,
    len,
    dx,
    dz,
    length,
    obstacles: [],
    holdS: length,
    holding: [0, 0],
  };
  const obstacles: { s: number; l: number; c: number }[] = [];
  let holdS = length;
  const p: Projection = { s: 0, lat: 0, off: 0 };
  for (const a of ctx.map.structures) {
    const r = STRUCTURE_RADIUS[a.type];
    const c = r + UNIT_RADIUS + AI.avoidMargin;
    project(t, a.pos.x, a.pos.z, p);
    if (p.off <= lane.halfWidth + c) obstacles.push({ s: p.s, l: p.lat, c });
    if (a.type === 'warden' && a.lane === lane.id && a.team !== team) holdS = Math.min(holdS, p.s - r - AI.holdStandoff);
  }
  obstacles.sort((a, b) => a.s - b.s);
  return { ...t, obstacles, holdS: Math.max(0, holdS) };
}

/** Lateral offset to walk at arc `s`: the file's, or beside a structure footprint in the way. */
function avoid(t: Track, s: number, file: number): number {
  let want = file;
  for (const o of t.obstacles) {
    if (s < o.s - o.c - AI.avoidLead || s > o.s + o.c) continue;
    if (Math.abs(want - o.l) < o.c) want = file >= o.l ? o.l + o.c : o.l - o.c;
  }
  return want;
}

interface Fledgling {
  readonly e: UnitEntity;
  readonly def: FledglingDef;
  readonly track: Track;
  readonly file: number;
  readonly fileIndex: 0 | 1;
  /** The attack, scaled at spawn: a melee damage effect or a projectile carrying it. */
  readonly attack: Effect;
  readonly lateAttack: Effect;
  assault: boolean;
  target: Damageable | null;
  rank: number;
  nextPick: Tick;
  nextAttack: Tick;
  /** Walking back to the lane after the path leash; picks no targets meanwhile. */
  returning: boolean;
  /** Hold slot at the enemy base, or −1. */
  hold: number;
  /** This tick's projection on the track (movement phase). */
  readonly at: Projection;
  projectedX: number;
  projectedZ: number;
}

export interface Fledglings {
  readonly hurtAt: ReadonlyMap<EntityId, HeroThreat>;
  /** Movement phase: steer every fledgling that isn't rooted or stunned. */
  steer(): void;
  /** World phase: waves, targets and attacks. */
  update(): void;
  hash(h: Hasher): void;
}

export function createFledglings(ctx: SimContext): Fledglings {
  const tracks = ctx.map.lanes.flatMap((l) => [buildTrack(ctx, l, 'dawn'), buildTrack(ctx, l, 'dusk')]);
  const live: Fledgling[] = [];
  /** Hero aggression for fledgling rule 2 and the tower interrupt. */
  const hurtAt = new Map<EntityId, HeroThreat>();
  const near: EntityId[] = [];
  const dest = { x: 0, y: 0, z: 0 };
  const delta = { x: 0, y: 0, z: 0 };
  const movement: CharacterMove = { pos: { x: 0, y: 0, z: 0 }, grounded: false, wall: null };
  const retarget = ticks(AI.retargetS);
  const hurtWindow = ticks(AI.hurtWindowS);
  const everyWave = ticks(WAVES.everyS);
  let wave = 0;
  if (ctx.config.options.waves) ctx.objectives.nextWaveAt = ticks(WAVES.firstS);

  ctx.bus.on('damage.applied', (ev) => {
    if (ev.targetKind !== 'hero' || ev.source === null) return;
    let by = ctx.store.get(ev.source);
    if (by?.kind === 'unit' && by.unit.owner !== null) by = ctx.store.get(by.unit.owner);
    const victim = ctx.store.get(ev.target);
    if (by?.kind === 'hero' && victim && by.team !== victim.team) hurtAt.set(by.id, { tick: ctx.clock.tick, victimPos: { ...victim.pos } });
  });

  function attackOf(type: FledglingType, scale: number, late: boolean): Effect {
    const def = FLEDGLINGS[type];
    const bonus = late ? LATE_VS_STRUCTURES : VS_STRUCTURES;
    const hit: DamageEffect = { kind: 'damage', amount: def.damage * scale, type: 'talon', bonus };
    return def.projectileSpeed === 0 ? hit : { kind: 'projectile', speed: def.projectileSpeed, radius: AI.shotRadius,
      range: def.range + AI.shotRangePad, gravity: 0, pierce: 'none', affects: SHOT_AFFECTS, onHit: [hit] };
  }

  // Each stat block is private to its fledgling. Prepare one per preceding tick so the whole formation
  // can enter on the authored tick without paying the stat service's setup cost 24–36 times in that tick.
  const prepared: Record<FledglingType, StatBlock[]> = { scrapper: [], slinger: [] };
  let preparedFor = -1;
  const largest = WAVES.bands[WAVES.bands.length - 1]!;
  const lead = tracks.length * (largest.scrapper + largest.slinger);
  const scaleAt = (at: Tick) => 1 + WAVES.scalingPerMinute * at / TICK_RATE / SECONDS_PER_MINUTE;
  const bandAt = (at: Tick) => WAVES.bands.reduce((b, x) => (at >= ticks(x.fromS) ? x : b));
  const statsFor = (type: FledglingType, at: Tick) => ctx.stats.create({ maxHealth: FLEDGLINGS[type].hp * scaleAt(at), moveSpeed: AI.marchSpeed });

  function prepareWave(at: Tick): void {
    if (at !== preparedFor) {
      preparedFor = at;
      prepared.scrapper.length = prepared.slinger.length = 0;
    }
    const band = bandAt(at);
    if (prepared.scrapper.length < tracks.length * band.scrapper) prepared.scrapper.push(statsFor('scrapper', at));
    else if (prepared.slinger.length < tracks.length * band.slinger) prepared.slinger.push(statsFor('slinger', at));
  }

  const spawnWave = (): void => {
    const now = ctx.clock.tick;
    const band = bandAt(now);
    const scale = scaleAt(now);
    const types: FledglingType[] = [
      ...Array<FledglingType>(band.scrapper).fill('scrapper'),
      ...Array<FledglingType>(band.slinger).fill('slinger'),
    ];
    const rows = Math.ceil(types.length / WAVES.files);
    const attacks = {
      scrapper: [attackOf('scrapper', scale, false), attackOf('scrapper', scale, true)],
      slinger: [attackOf('slinger', scale, false), attackOf('slinger', scale, true)],
    } as const;
    for (const track of tracks) {
      types.forEach((type, i) => {
        const fileIndex = (i % WAVES.files) as 0 | 1;
        const file = (fileIndex - (WAVES.files - 1) / 2) * WAVES.gap;
        const s = (rows - 1 - Math.floor(i / WAVES.files)) * WAVES.gap;
        spawn(track, type, s, file, fileIndex, scale, now, attacks[type]);
      });
    }
  };

  const spawn = (track: Track, type: FledglingType, s: number, file: number, fileIndex: 0 | 1, scale: number, now: Tick, attacks: readonly [Effect, Effect]): void => {
    const def = FLEDGLINGS[type];
    const hp = def.hp * scale;
    const pos = pointAt(track, s, file, { x: 0, y: 0, z: 0 });
    const d = track.dx[0] as number;
    const e = ctx.store.spawn({
      kind: 'unit',
      team: track.team,
      pos,
      vel: { x: 0, y: 0, z: 0 },
      yaw: Math.atan2(d, track.dz[0] as number),
      radius: def.radius,
      unit: { type, lane: track.lane.id, height: def.height, owner: null, summon: null, target: null, attacking: false },
      health: { hp, talonShield: 0, songShield: 0, barrier: 0, dead: false, respawnAt: null, inCombatUntil: 0 },
      stats: (now === preparedFor ? prepared[type].pop() : undefined) ?? statsFor(type, now),
      statuses: [],
    });
    live.push({
      e,
      def,
      track,
      file,
      fileIndex,
      attack: attacks[0],
      lateAttack: attacks[1],
      assault: false,
      target: null,
      rank: NONE,
      nextPick: now + 1 + (e.id % retarget),
      nextAttack: now,
      returning: false,
      hold: -1,
      at: { s, lat: file, off: Math.abs(file) },
      projectedX: pos.x,
      projectedZ: pos.z,
    });
  };

  /** Centre-to-surface distance from the fledgling to a target. */
  const reach = (f: Fledgling, t: Damageable): number => Math.sqrt(distSq(f.e.pos, t.pos)) - t.radius;
  const inReach = (f: Fledgling, t: Damageable, range = f.def.range): boolean => distSq(f.e.pos, t.pos) <= (range + t.radius) ** 2;

  const valid = (f: Fledgling, t: Damageable): boolean =>
    !t.removed &&
    !t.health.dead &&
    (t.kind === 'structure' && f.assault || canSee(f.e.team as PlayerTeam, t)) &&
    !t.stats.conditions.has('intangible') &&
    (t.kind === 'structure' ? !t.stats.conditions.has('invulnerable') && (f.assault || inReach(f, t, AI.leash)) : distSq(f.e.pos, t.pos) <= AI.leash ** 2);

  /** GDD §7.1 target rules; keeps the current target unless a higher-priority one appears. */
  const pick = (f: Fledgling): void => {
    const me = f.e;
    const team = me.team as PlayerTeam;
    const now = ctx.clock.tick;
    let best: Damageable | null = null;
    let rank = NONE;
    let bestD = Infinity;
    ctx.spatial.query(me.pos, Math.max(AI.fledglingAggro, AI.hurtAggro, f.def.range), near);
    for (const id of near) {
      const t = ctx.store.get(id);
      if (!t || t.removed || t.team === team || t.team === 'neutral') continue;
      let r = NONE;
      let d = 0;
      if (t.kind === 'unit') {
        d = Math.sqrt(distSq(me.pos, t.pos));
        if (isFledgling(t) && d <= AI.fledglingAggro) r = RULE.fledgling;
      } else if (t.kind === 'hero') {
        d = Math.sqrt(distSq(me.pos, t.pos));
        const hurt = hurtAt.get(t.id);
        if (hurt !== undefined && now - hurt.tick <= hurtWindow && d <= AI.hurtAggro) r = RULE.hurtHero;
        else if (d <= AI.heroAggro) r = RULE.hero;
      } else if (t.kind === 'structure') {
        d = reach(f, t);
        if (d <= f.def.range) r = RULE.structure;
      } else {
        continue;
      }
      if (r === NONE || (r === rank && d >= bestD) || r > rank || !valid(f, t)) continue;
      best = t;
      rank = r;
      bestD = d;
    }
    if (!best && f.assault && !f.target) {
      // From the breached gate march to the closest open objective, even beyond normal aggro range.
      for (const s of ctx.store.list('structure')) {
        if (s.team === team || s.stats.conditions.has('invulnerable')) continue;
        if (s.structure.lane !== null && (s.structure.lane !== f.track.lane.id || s.structure.type !== 'warden')) continue;
        const d = reach(f, s);
        if (d < bestD) {
          bestD = d;
          best = s;
          rank = RULE.structure;
        }
      }
    }
    if (best && rank < f.rank) setTarget(f, best, rank);
  };

  const setTarget = (f: Fledgling, t: Damageable | null, rank: number): void => {
    f.target = t;
    f.rank = t ? rank : NONE;
    f.e.unit.target = t ? t.id : null;
  };

  const strike = (f: Fledgling, t: Damageable): void => {
    const me = f.e;
    const origin = { x: me.pos.x, y: me.pos.y + me.unit.height * AI.shotHeight, z: me.pos.z };
    const point = { x: t.pos.x, y: t.pos.y + aimHeight(ctx, t), z: t.pos.z };
    const d = Math.hypot(point.x - origin.x, point.y - origin.y, point.z - origin.z) || 1;
    const dir = { x: (point.x - origin.x) / d, y: (point.y - origin.y) / d, z: (point.z - origin.z) / d };
    const cause: EffectCause = {
      source: me.id,
      team: me.team,
      via: 'unit',
      ability: null,
      item: null,
      values: null,
      songPower: 0,
      proc: false,
      origin,
    };
    ctx.effects.apply(ctx.clock.seconds >= DEFENCE.ward.lateAtS ? f.lateAttack : f.attack, { entity: t.id, point, dir }, cause);
  };

  const face = (e: UnitEntity, x: number, z: number): void => {
    if (Math.abs(x) + Math.abs(z) > EPS) e.yaw = Math.atan2(x, z);
  };

  const stand = (e: UnitEntity): void => {
    e.vel.x = 0;
    e.vel.z = 0;
  };

  const moveBy = (e: UnitEntity, mx: number, mz: number, max: number): void => {
    const l = Math.hypot(mx, mz);
    if (l > max) {
      mx *= max / l;
      mz *= max / l;
    }
    e.vel.y = e.vel.y - AIR.gravity * TICK_SECONDS;
    delta.x = mx;
    delta.y = e.vel.y * TICK_SECONDS;
    delta.z = mz;
    const r = ctx.physics.moveCharacter(e.id, delta, movement);
    if (r.grounded) e.vel.y = 0;
    e.pos.x = r.pos.x;
    e.pos.y = r.pos.y;
    e.pos.z = r.pos.z;
    e.vel.x = mx / TICK_SECONDS;
    e.vel.z = mz / TICK_SECONDS;
    face(e, mx, mz);
  };

  /** March along the track: arc at the march speed, sideways toward the file, round footprints, up to the hold line. */
  const march = (f: Fledgling, step: number): void => {
    const e = f.e;
    const t = f.track;
    const { s, lat } = f.at;
    const holdAt = t.holdS - WAVES.gap * (f.hold >= 0 ? f.hold : t.holding[f.fileIndex]);
    const ns = s < holdAt ? Math.min(s + step, holdAt) : Math.max(s - step, holdAt);
    if (f.hold < 0 && ns >= holdAt) f.hold = t.holding[f.fileIndex]++;
    const want = avoid(t, ns, f.file);
    const lateral = AI.lateralSpeed * TICK_SECONDS;
    const nl = lat + Math.max(-lateral, Math.min(lateral, want - lat));
    if (Math.abs(ns - s) < EPS && Math.abs(nl - lat) < EPS) return stand(e);
    pointAt(t, ns, nl, dest);
    moveBy(e, dest.x - e.pos.x, dest.z - e.pos.z, step * AI.catchUp);
  };

  /**
   * Melee attackers close in on a slot on an arc round the target, on their own gate's side, picked by id, so several
   * Scrappers on one target stop at different points of its reach circle instead of stacking. They stop as soon as
   * they are in reach: two Scrappers chasing slots round each other would otherwise circle. Writes `dest`.
   */
  const slot = (f: Fledgling, t: Damageable): void => {
    const tr = f.track;
    let i = 0;
    while (i < tr.len.length - 1 && f.at.s > (tr.cum[i] as number) + (tr.len[i] as number)) i++;
    const a = (AI.meleeSlots[f.e.id % AI.meleeSlots.length] as number) * AI.meleeArc;
    const bx = -(tr.dx[i] as number);
    const bz = -(tr.dz[i] as number);
    const d = t.radius + AI.meleeStandoff;
    dest.x = t.pos.x + (bx * Math.cos(a) + bz * Math.sin(a)) * d;
    dest.z = t.pos.z + (bz * Math.cos(a) - bx * Math.sin(a)) * d;
  };

  const dropHolder = (f: Fledgling): void => {
    if (f.hold < 0) return;
    let next = 0;
    for (const g of live) {
      if (g !== f && !g.e.removed && g.track === f.track && g.fileIndex === f.fileIndex && g.hold >= 0) next = Math.max(next, g.hold + 1);
    }
    f.track.holding[f.fileIndex] = next;
  };

  return {
    hurtAt,
    steer() {
      let k = 0;
      for (const f of live) {
        if (f.e.removed) dropHolder(f);
        else live[k++] = f;
      }
      live.length = k;
      for (const f of live) {
        const e = f.e;
        if (e.pos.x !== f.projectedX || e.pos.z !== f.projectedZ) {
          project(f.track, e.pos.x, e.pos.z, f.at);
          f.projectedX = e.pos.x;
          f.projectedZ = e.pos.z;
        }
        const cond = e.stats.conditions;
        if (cond.has('stunned') || cond.has('rooted')) continue;
        const st = e.stats.final;
        const step = Math.max(GROUND.minSlowedSpeed, st.moveSpeed * (1 - Math.min(1, st.slow))) * TICK_SECONDS;
        const t = f.target;
        if (t && !t.removed && !t.health.dead) {
          if (inReach(f, t)) {
            stand(e);
          } else if (f.def.projectileSpeed > 0) {
            moveBy(e, t.pos.x - e.pos.x, t.pos.z - e.pos.z, step);
          } else {
            slot(f, t);
            if (Math.hypot(dest.x - e.pos.x, dest.z - e.pos.z) < SLOT_EPS) stand(e);
            else moveBy(e, dest.x - e.pos.x, dest.z - e.pos.z, step);
          }
        } else if (f.returning || f.at.off > f.track.lane.halfWidth) {
          pointAt(f.track, f.at.s + AI.returnLookahead, f.file, dest);
          moveBy(e, dest.x - e.pos.x, dest.z - e.pos.z, step);
        } else {
          march(f, step);
        }
      }
    },

    update() {
      const now = ctx.clock.tick;
      const waveAt = ctx.objectives.nextWaveAt;
      if (ctx.config.options.waves && waveAt !== null) {
        if (now >= waveAt) {
          spawnWave();
          ctx.objectives.nextWaveAt = waveAt + everyWave;
          ctx.bus.emit({ type: 'wave.spawned', wave: ++wave });
        } else if (waveAt - now <= lead) prepareWave(waveAt);
      }
      for (const f of live) {
        const e = f.e;
        if (e.removed) continue;
        if (ctx.config.options.structures && f.at.s >= f.track.holdS - AI.avoidLead) f.assault = true;
        if (!f.assault && f.at.off > AI.pathLeash) {
          f.returning = true;
          setTarget(f, null, NONE);
        } else if (f.returning && f.at.off <= f.track.lane.halfWidth) {
          f.returning = false;
        }
        if (f.target && !valid(f, f.target)) {
          setTarget(f, null, NONE);
          f.nextPick = now;
        }
        if (!f.returning && now >= f.nextPick) {
          f.nextPick = now + retarget;
          pick(f);
        }
        const t = f.target;
        const cond = e.stats.conditions;
        e.unit.attacking = false;
        if (!t || !inReach(f, t) || cond.has('stunned')) continue;
        if (f.def.projectileSpeed > 0 && cond.has('disarmed')) continue;
        e.unit.attacking = true;
        face(e, t.pos.x - e.pos.x, t.pos.z - e.pos.z);
        if (now < f.nextAttack) continue;
        const rate = 1 - Math.min(1, e.stats.final.fireRateSlow);
        if (rate <= 0) continue;
        f.nextAttack = now + Math.round(ticks(f.def.intervalS) / rate);
        strike(f, t);
      }
    },

    hash(h) {
      h.num(wave);
      for (const f of live) {
        h.num(f.e.id);
        h.num(f.rank);
        h.num(f.nextPick);
        h.num(f.nextAttack);
        h.num(f.returning ? 1 : 0);
        h.num(f.hold);
        h.num(f.assault ? 1 : 0);
      }
      for (const t of tracks) h.value(t.holding);
      h.value(hurtAt);
    },
  };
}
