// WebAudio engine (GDD §13). Graph: voice -> [HRTF panner] -> sfx bus -> master -> compressor -> destination, with
// music stems -> music bus -> duck -> master. Starts on the first user gesture (`resume`); sounds are driven by the
// drained sim events plus the view and the camera pose. No samples: every sound comes from ./synth and ./music.
import { SeenBy, ViewFlag, type EntityView, type HeroId, type MapData, type MapId, type SimEvent, type SimView, type Vec3 } from '../../sim/core/contracts';
import { loadMap } from '../../sim/world/map';
import type { AudioOut, CameraPose, Frame, Screen, Settings } from '../app/contracts';
import { createMusic, type Music, type MusicState } from './music';
import * as S from './synth';
import * as C from './data/cues';
import * as H from './data/heroes';
import * as N from './data/stage4';

export const MAX_VOICES = 48;
export const MAX_DISTANCE = 60; // m (§13.1)
const REF_DISTANCE = 5;
const FIGHT_RANGE = 40;
const FIGHT_HOLD = 4; // seconds a fight keeps the skirmish state
const ROAM_AFTER = 600; // 10:00
const DUCK_GAIN = 0.5; // -6 dB
const LOW_HP = 0.25;
const HEARTBEAT_PERIOD = 1.1;
const ALARM_PERIOD = 4;
const CALL_COOLDOWN = 2;
const VOLUME_SMOOTH = 0.02; // seconds, so live slider drags don't click
const DEFAULT_LOOKAHEAD = 0.25;
const MUTED_TICK_GAIN = 0.0001;
const FEEDER_RANGE = 70; // m (§7.14)
const BELL_TOWER_RANGE = 120; // m
const EGG_PULSE_PERIOD = 0.9;
const MUSIC_TICK_MS = 100; // keeps menu music running while no match frames arrive
const NEAR_PAD = 1.2; // m: a Spring pad or ivy curtain crossing
const NEAR_LOOKOUT = 2.5; // m
const VERTICAL_REACH = 2.5; // m of vertical slack for pad, curtain and lookout proximity
const CREATURES = new Set(['beetle', 'weasel', 'rat', 'toad', 'badger']);

/** Cue lengths in seconds, for voice-stealing bookkeeping. */
const Len = { Blip: 0.1, Tick: 0.2, Brief: 0.25, Short: 0.3, Swish: 0.35, Cue: 0.4, Half: 0.5, Phrase: 0.6, Alert: 0.7, Long: 1.5, Sting: 2.5 } as const;
const ULT_SLOT = 3;
const WIND_BAND_HZ = 450; // Hz, band-pass centre of the wind bed
const WIND_GAIN = 0.05;
const DUCK_SMOOTH_FACTOR = 10;

/** Lower number = ducks the rest (§13.1). */
const Prio = { Tick: 0, Heartbeat: 1, EnemyUlt: 2, OwnGun: 3, Alarm: 4, Combat: 5, Ambient: 6 } as const;

export interface AudioOptions {
  /** Test seam: render into this context (e.g. an OfflineAudioContext) instead of a live one. */
  readonly ctx?: BaseAudioContext;
  /** Seconds of music scheduled ahead of the clock. */
  readonly lookahead?: number;
}

interface Active { end: number; prio: number; dist: number; bus: GainNode }
interface PlayOpts {
  /** Audible range in metres (default 60). */
  range?: number;
  /** Apply the occlusion filter even in the open (an enemy hero you cannot see). */
  muffle?: boolean;
}
type Room = NonNullable<MapData['rooms']>[number];

const dist3 = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const inBox = (r: Room, p: Vec3): boolean => {
  const { centre, size, yaw } = r.volume;
  const dx = p.x - centre.x, dz = p.z - centre.z, cs = Math.cos(yaw), sn = Math.sin(yaw);
  return Math.abs(dx * cs - dz * sn) <= size.x / 2 && Math.abs(dx * sn + dz * cs) <= size.z / 2 && Math.abs(p.y - centre.y) <= size.y / 2;
};

export const createAudio = (settings: Settings, opts: AudioOptions = {}): AudioOut => {
  let cur = settings;
  let c: BaseAudioContext | null = null;
  let owned = false;
  let sfx: GainNode, musicBus: GainNode, duck: GainNode, master: GainNode, windGain: GainNode, roomGain: GainNode;
  let music: Music | null = null;
  let wind: AudioBufferSourceNode | null = null;
  let roomNoise: AudioBufferSourceNode | null = null;
  let ticker: ReturnType<typeof setInterval> | undefined;
  let active: Active[] = [];
  let listener: CameraPose | null = null;
  let view: SimView | null = null;
  let screen: Screen = 'menu';
  let lastFight = -Infinity;
  let lastCall = new Map<number, number>();
  let lastAlarm = -Infinity;
  let lastBeat = -Infinity;
  let lastPulse = -Infinity;
  let shots = new Map<number, number>();
  let eggCarried = false;
  let seconds = 0;
  // Stage 4 view tracking
  let map: MapData | null = null;
  let mapId: MapId | null = null;
  let myRoom = -1;
  let lit = new Set<number>();
  let nestVariant = new Map<number, string>();
  let near = new Map<string, number>(); // proximity key -> last sounded second

  const applyVolumes = (): void => {
    if (!c) return;
    const t = c.currentTime;
    master.gain.setTargetAtTime(cur.mute ? 0 : cur.volume.master, t, VOLUME_SMOOTH);
    sfx.gain.setTargetAtTime(cur.volume.sfx, t, VOLUME_SMOOTH);
    musicBus.gain.setTargetAtTime(cur.volume.music, t, VOLUME_SMOOTH);
  };

  const build = (ctx: BaseAudioContext): void => {
    c = ctx;
    master = ctx.createGain();
    sfx = ctx.createGain();
    musicBus = ctx.createGain();
    duck = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    sfx.connect(master);
    musicBus.connect(duck);
    duck.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);
    for (const g of [master, sfx, musicBus]) g.gain.value = 0;
    applyVolumes();
    music = createMusic(ctx, musicBus, opts.lookahead ?? DEFAULT_LOOKAHEAD);
    // Ambience: a quiet wind bed under everything.
    wind = S.noiseLoop(ctx);
    const f = ctx.createBiquadFilter();
    windGain = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = WIND_BAND_HZ;
    windGain.gain.value = WIND_GAIN;
    wind.connect(f); f.connect(windGain); windGain.connect(sfx);
    wind.start();
    // Room tone: a low hum that fades in indoors while the wind fades back.
    roomNoise = S.noiseLoop(ctx);
    const lp = ctx.createBiquadFilter();
    roomGain = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = N.ROOM_TONE.lowpassHz;
    roomGain.gain.value = 0;
    roomNoise.connect(lp); lp.connect(roomGain); roomGain.connect(sfx);
    roomNoise.start();
    if (!opts.ctx) ticker = setInterval(() => { if (c && music && screen !== 'match') music.tick(c.currentTime); }, MUSIC_TICK_MS);
  };

  const pose = (): void => {
    if (!c || !listener) return;
    const l = c.listener, p = listener.position, t = listener.target;
    const fx = t.x - p.x, fy = t.y - p.y, fz = t.z - p.z;
    const len = Math.hypot(fx, fy, fz) || 1;
    if (l.positionX) {
      l.positionX.value = p.x; l.positionY.value = p.y; l.positionZ.value = p.z;
      l.forwardX.value = fx / len; l.forwardY.value = fy / len; l.forwardZ.value = fz / len;
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    }
  };

  const roomAt = (p: Vec3): number => map?.rooms?.findIndex((r) => inBox(r, p)) ?? -1;
  const loadRooms = (v: SimView): void => {
    if (!v.map || v.map === mapId) return;
    mapId = v.map;
    try { map = loadMap(v.map); } catch { map = null; }
  };

  /** Play a voice. `at` makes it positional (skipped beyond its range); null plays it flat (UI, own feedback, map-wide). */
  const play = (voice: S.Voice, prio: number, at: Vec3 | null, dur: number, o: PlayOpts = {}): void => {
    if (!c) return;
    const now = c.currentTime;
    const range = o.range ?? MAX_DISTANCE;
    const d = at && listener ? dist3(at, listener.position) : 0;
    if (at && listener && d > range) return;
    active = active.filter((v) => v.end > now);
    if (active.length >= MAX_VOICES) {
      // Steal the lowest-priority, then farthest, voice unless the new one is worse still.
      let worst = active[0]!;
      for (const v of active) if (v.prio > worst.prio || (v.prio === worst.prio && v.dist > worst.dist)) worst = v;
      if (worst.prio < prio || (worst.prio === prio && worst.dist <= d)) return;
      worst.bus.gain.setTargetAtTime(0, now, MUTED_TICK_GAIN);
      worst.bus.disconnect();
      active.splice(active.indexOf(worst), 1);
    }
    const bus = c.createGain();
    let tail: AudioNode = bus;
    if (at && (o.muffle || (map?.rooms && roomAt(at) !== myRoom))) { // occlusion: -6 dB and a 2 kHz low-pass
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = N.OCCLUSION.lowpassHz;
      bus.gain.value = N.OCCLUSION.gain;
      bus.connect(lp);
      tail = lp;
    }
    if (at && listener) {
      const p = c.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = REF_DISTANCE;
      p.rolloffFactor = 1;
      p.maxDistance = range;
      p.positionX.value = at.x; p.positionY.value = at.y; p.positionZ.value = at.z;
      tail.connect(p);
      p.connect(sfx);
    } else tail.connect(sfx);
    voice(c, bus, now);
    active.push({ end: now + dur, prio, dist: d, bus });
  };

  const reset = (): void => {
    for (const v of active) v.bus.disconnect();
    active = [];
    lastCall = new Map(); shots = new Map(); near = new Map(); lit = new Set(); nestVariant = new Map();
    lastFight = lastAlarm = lastBeat = lastPulse = -Infinity;
    eggCarried = false;
    myRoom = -1;
    view = null;
    music?.setState('menu');
  };

  const ent = (id: number | null): EntityView | undefined => (id === null ? undefined : view?.entities.find((e) => e.id === id));
  const heroOf = (id: number | null): string | undefined => (id === null ? undefined : view?.heroes.find((h) => h.id === id)?.heroId);
  const posOf = (id: number | null): Vec3 | null => ent(id)?.pos ?? null;
  /** An enemy hero the local flock cannot see: its sounds are muffled (INTERFACES §13 row 3). */
  const unseen = (id: number | null): boolean => {
    const mine = view?.heroes.find((h) => h.id === view?.localHero)?.team;
    const h = view?.heroes.find((x) => x.id === id);
    const e = ent(id);
    return !!mine && !!h && !!e && h.team !== mine && e.seenBy !== undefined && (e.seenBy & SeenBy[mine]) === 0;
  };
  const feederRange = (e: EntityView | undefined): number => {
    const i = e?.structure?.anchor, b = i === undefined ? undefined : map?.interactables?.[i]?.building;
    return b !== undefined && /bell/i.test(map?.buildings?.[b]?.archetype ?? '') ? BELL_TOWER_RANGE : FEEDER_RANGE;
  };

  const heroCall = (id: number, loud: boolean): void => {
    const hero = heroOf(id);
    if (!hero || !c || c.currentTime - (lastCall.get(id) ?? -Infinity) < CALL_COOLDOWN) return;
    lastCall.set(id, c.currentTime);
    play(H.call(hero), Prio.Combat, posOf(id), loud ? Len.Long : 1, { muffle: unseen(id) });
  };

  /** Own-hero feedback plays flat; anyone else's positionally. */
  const mineOrAt = (hero: number | null, at: Vec3 | null): Vec3 | null => (hero !== null && hero === view?.localHero ? null : at);

  const onObjective = (e: Extract<SimEvent, { type: 'objective' }>): void => {
    switch (e.action) {
      case 'eggSpawned': play(C.eggSpawn, Prio.Alarm, null, Len.Sting); break;
      case 'eggTaken': eggCarried = true; lastPulse = -Infinity; play(C.eggTaken, Prio.Alarm, mineOrAt(e.hero, e.pos), Len.Sting); break;
      case 'eggDropped': eggCarried = false; play(N.eggDrop, Prio.Alarm, e.pos, Len.Long); break;
      case 'eggSpoiled': eggCarried = false; play(N.eggSpoil, Prio.Alarm, e.pos, Len.Long); break;
      case 'eggDelivered': eggCarried = false; play(C.eggDelivered, Prio.Alarm, null, Len.Sting); break;
      case 'rocSpawned': play(N.rocWake, Prio.Alarm, null, Len.Sting); break;
      case 'emberDropped': play(N.emberDrop, Prio.Combat, e.pos, Len.Long); break;
      case 'emberClaimed': play(C.emberClaim, Prio.Alarm, e.pos, Len.Sting); break;
      case 'runeSpawned': play(C.runeSpawn, Prio.Alarm, e.pos, Len.Sting); break;
      case 'runeTaken': play(C.runeTake, Prio.Alarm, mineOrAt(e.hero, e.pos), Len.Sting); break;
      case 'campCleared': play(N.campCleared, Prio.Combat, mineOrAt(e.hero, e.pos), Len.Cue); break;
      case 'keepsakeGained': play(N.keepsake, Prio.Combat, mineOrAt(e.hero, e.pos), Len.Half); break;
      case 'berryEaten': play(N.berry, Prio.Combat, mineOrAt(e.hero, e.pos), Len.Short); break;
      default: break;
    }
  };

  const onDied = (e: Extract<SimEvent, { type: 'entity.died' }>, me: number | null, myTeam: string | undefined): void => {
    if (e.victimKind === 'structure') {
      if (e.victimType === 'nest') {
        const variant = nestVariant.get(e.victim) ?? 'twig';
        play(variant === 'feeder' ? N.feederBreak : N.nestBreak(variant), Prio.Combat, e.pos, Len.Half, variant === 'feeder' ? { range: feederRange(ent(e.victim)) } : {});
      } else play(C.structureDown(e.victimTeam === myTeam), Prio.Alarm, e.pos, Len.Long);
    } else if (e.victimKind === 'unit') {
      if (e.victimType === 'roc') play(N.rocDeath, Prio.Alarm, null, Len.Sting);
      else if (CREATURES.has(e.victimType)) play(N.creatureDie(e.victimType), Prio.Combat, e.pos, Len.Cue);
    } else if (e.victimKind === 'hero' && e.creditHero === me && e.victim !== me) {
      play(C.killConfirm, Prio.Tick, null, Len.Short);
      if (me !== null) heroCall(me, false);
    }
  };

  const onEvent = (e: SimEvent, v: SimView): void => {
    const me = v.localHero;
    const myTeam = v.heroes.find((h) => h.id === me)?.team;
    switch (e.type) {
      case 'weapon.fired': {
        const n = (shots.get(e.shooter) ?? 0) + 1;
        shots.set(e.shooter, n);
        play(H.gun(heroOf(e.shooter) ?? 'kingfisher', n), e.shooter === me ? Prio.OwnGun : Prio.Combat, e.muzzle, Len.Cue, { muffle: unseen(e.shooter) });
        break;
      }
      case 'weapon.reload': if (!e.done) play(C.reload, Prio.Combat, posOf(e.hero), Len.Half); break;
      case 'damage.applied': {
        const mine = e.source === me, taken = e.target === me;
        if (mine || (e.sourceTeam === myTeam && e.targetKind === 'hero')) lastFight = seconds;
        if (taken) { lastFight = seconds; play(C.hitTaken, Prio.Combat, e.pos, Len.Short); }
        if (mine && e.target !== me) play(e.weakPoint ? C.weakPointHit : e.beakShot ? C.beakTick : C.hit, Prio.Tick, null, Len.Tick);
        else if (!mine && !taken) play(C.hit, Prio.Combat, e.pos, Len.Blip);
        if (e.absorbed > 0 && (mine || taken)) play(C.shieldHit, Prio.Combat, e.pos, Len.Blip);
        if (e.targetKind === 'structure') {
          const st = v.entities.find((x) => x.id === e.target);
          if (st?.structure?.variant === 'feeder') play(N.feederChime((st.flags & ViewFlag.Lit) !== 0), Prio.Combat, st.pos, Len.Long, { range: feederRange(st) });
          else if (e.sourceTeam !== 'neutral' && myTeam && e.sourceTeam !== myTeam && seconds - lastAlarm >= ALARM_PERIOD && st && st.team === myTeam && v.heroes.some((h) => h.id === e.source)) {
            lastAlarm = seconds;
            play(C.alarm, Prio.Alarm, null, Len.Alert);
          }
        }
        break;
      }
      case 'entity.died': onDied(e, me, myTeam); break;
      case 'melee':
        play(C.swish(e.heavy), Prio.Combat, posOf(e.attacker), Len.Swish);
        if (e.target !== null && !e.parried) play(e.heavy ? C.crack : C.hit, Prio.Combat, posOf(e.target), Len.Blip);
        break;
      case 'parry':
        if (e.outcome === 'success') play(C.clink, Prio.Combat, posOf(e.hero), Len.Half);
        else if (e.outcome === 'whiff') play(C.dullWhoosh, Prio.Combat, posOf(e.hero), Len.Brief);
        break;
      case 'movement': {
        const at = posOf(e.hero);
        const voice = { dash: C.dash, dashJump: C.dash, downDash: C.dash, jump: C.jump, airJump: C.jump, wallJump: C.jump, land: C.land, slide: C.slide, updraftBoost: C.dash, mantle: C.jump, updraftOn: N.latch, updraftOff: N.dismount }[e.action as string];
        if (voice) play(voice, Prio.Combat, at, Len.Cue);
        break;
      }
      case 'pod.resolved': play(e.outcome === 'secured' ? C.podSecured : C.podDenied, Prio.Combat, e.pos, Len.Half); break;
      case 'seeds.gained': if (e.hero === me) play(C.seeds(e.amount), Prio.Combat, null, Len.Cue); break;
      case 'hero.level': if (e.hero === me) play(C.molt, Prio.Tick, null, Len.Long); break;
      case 'hero.respawned':
        if (e.revived) play(N.rekindle, Prio.Alarm, e.pos, Len.Sting);
        else heroCall(e.hero, false);
        break;
      case 'ability': {
        const hero = heroOf(e.caster);
        if (e.stage !== 'start' || !hero) break;
        const ult = e.slot === ULT_SLOT;
        play(H.cast(hero, ult), ult && e.caster !== me ? Prio.EnemyUlt : Prio.Combat, e.point, ult ? Len.Phrase : Len.Brief, { muffle: unseen(e.caster) });
        if (ult) heroCall(e.caster, true);
        break;
      }
      case 'status.applied': if (e.target === me) play(C.status(e.status), Prio.Combat, null, Len.Alert); break;
      case 'item.bought': if (e.hero === me) play(C.buy, Prio.Combat, null, Len.Cue); break;
      case 'item.sold': if (e.hero === me) play(C.sellRattle, Prio.Combat, null, Len.Short); break;
      case 'structure.attack': play(C.structureAttack(e.attack), Prio.Combat, e.origin, 1); break;
      case 'structure.state':
        if (e.state === 'phase2') play(C.phase2Cry, Prio.Alarm, null, 2);
        else if (e.state === 'wardUp') play(C.wardUp, Prio.Ambient, posOf(e.structure), Len.Alert);
        else if (e.state === 'wardDown') play(C.wardCrack, Prio.Combat, posOf(e.structure), Len.Cue);
        break;
      case 'patron.depleted': play(C.phase2Cry, Prio.Alarm, null, 2); break;
      case 'unit.attack': {
        const type = ent(e.unit)?.type;
        if (type === 'roc') play(N.rocAttack(e.attack), Prio.Combat, e.origin, Len.Long);
        else if (type && CREATURES.has(type)) play(N.creatureAttack(e.attack), Prio.Combat, e.origin, Len.Half);
        break;
      }
      case 'unit.state': {
        const type = ent(e.unit)?.type;
        if (e.state === 'enraged') play(N.rocEnrage, Prio.Alarm, null, Len.Sting);
        else if (e.state === 'awake' && type && CREATURES.has(type)) play(N.creatureWake(type), Prio.Combat, posOf(e.unit), Len.Cue);
        break;
      }
      case 'objective': onObjective(e); break;
      case 'ping': play(C.ping(e.kind), Prio.Combat, null, Len.Cue); break;
      default: break;
    }
  };

  /** Edge-triggered cues from where the local hero stands: rooms, Springs, Lookouts, ivy curtains, Feeder blinks. */
  const track = (v: SimView, me: EntityView | undefined): void => {
    nestVariant = new Map(v.entities.filter((e) => e.type === 'nest' && e.structure?.variant).map((e) => [e.id, e.structure!.variant!]));
    const nowLit = new Set<number>();
    for (const e of v.entities) {
      if (e.kind !== 'structure' || (e.flags & ViewFlag.Lit) === 0) continue;
      nowLit.add(e.id);
      if (!lit.has(e.id)) play(N.feederBlink, Prio.Ambient, e.pos, Len.Blip, { range: feederRange(e) });
    }
    lit = nowLit;
    if (!me || me.hp <= 0) return;
    const p = me.pos;
    const room = roomAt(p);
    if (room !== myRoom) {
      const was = map?.rooms?.[myRoom], now = map?.rooms?.[room];
      if (now?.tag === 'hide') play(N.hide(true), Prio.Combat, null, Len.Short);
      else if (was?.tag === 'hide') play(N.hide(false), Prio.Combat, null, Len.Short);
      else if (now?.tag === 'tunnel') play(N.cellar, Prio.Combat, null, Len.Half);
      else if (now && now.building < 0) play(N.den, Prio.Combat, null, Len.Cue);
      myRoom = room;
    }
    const touch = (key: string, at: Vec3, reach: number, voice: S.Voice, dur: number): void => {
      if (Math.abs(at.y - p.y) > VERTICAL_REACH || Math.hypot(at.x - p.x, at.z - p.z) > reach) { near.delete(key); return; }
      if (near.has(key)) return;
      near.set(key, seconds);
      play(voice, Prio.Combat, at, dur);
    };
    map?.springs?.forEach((s, i) => touch(`s${i}`, s.pad, Math.max(s.radius, NEAR_PAD), N.spring, Len.Cue));
    map?.openings?.forEach((o, i) => { if (o.curtain) touch(`o${i}`, o.centre, NEAR_PAD, N.ivy, Len.Short); });
    map?.interactables?.forEach((a, i) => { if (a.kind === 'lookout') touch(`l${i}`, a.pos, NEAR_LOOKOUT, N.lookout, Len.Half); });
  };

  const eggCarrier = (v: SimView): EntityView | undefined => v.entities.find((e) => e.kind === 'hero' && (e.flags & ViewFlag.EggCarrier) !== 0);

  const musicState = (v: SimView): MusicState => {
    if (v.localHero === null) return 'menu';
    const mine = v.heroes.find((h) => h.id === v.localHero);
    if (v.over) return v.winner === mine?.team ? 'victory' : 'defeat';
    const heroes = new Map(v.entities.filter((e) => e.kind === 'hero').map((e) => [e.id, e] as const));
    const myPos = heroes.get(v.localHero)?.pos;
    const base = (v.entities.filter((e) => e.kind === 'structure' && e.type === 'patron'));
    if (myPos && v.heroes.some((h) => {
      const p = heroes.get(h.id)?.pos;
      return h.team !== mine?.team && p !== undefined && base.some((b) => b.team === mine?.team && dist3(p, b.pos) < FIGHT_RANGE);
    })) return 'siege';
    const rocUp = v.entities.some((e) => e.kind === 'unit' && e.type === 'roc' && e.hp > 0 && ((e.flags & ViewFlag.Asleep) === 0 || e.hp < e.maxHp));
    if (eggCarried || eggCarrier(v) || rocUp) return 'objective';
    if (seconds - lastFight < FIGHT_HOLD) return 'skirmish';
    return v.seconds < ROAM_AFTER ? 'laning' : 'roaming';
  };

  if (opts.ctx) build(opts.ctx);

  return {
    onEvents(events, v) {
      view = v;
      seconds = v.seconds;
      loadRooms(v);
      for (const e of events) onEvent(e, v);
    },
    reset,
    update(f: Frame, l: CameraPose) {
      listener = l;
      view = f.curr;
      seconds = f.curr.seconds;
      if (!c || !music) return;
      loadRooms(f.curr);
      pose();
      const me = f.curr.localHero === null ? undefined : f.curr.entities.find((e) => e.id === f.curr.localHero);
      track(f.curr, me);
      const indoors = myRoom >= 0;
      roomGain.gain.setTargetAtTime(indoors ? N.ROOM_TONE.gain : 0, c.currentTime, N.ROOM_TONE.smooth);
      windGain.gain.setTargetAtTime(indoors ? WIND_GAIN * N.ROOM_TONE.windScale : WIND_GAIN, c.currentTime, N.ROOM_TONE.smooth);
      const carrier = eggCarrier(f.curr);
      if (carrier && seconds - lastPulse >= EGG_PULSE_PERIOD) {
        lastPulse = seconds;
        play(N.eggCarryPulse, Prio.Ambient, carrier.id === f.curr.localHero ? null : carrier.pos, Len.Cue);
      }
      music.setState(musicState(f.curr));
      music.tick(c.currentTime);
      duck.gain.setTargetAtTime(seconds - lastFight < FIGHT_HOLD ? DUCK_GAIN : 1, c.currentTime, VOLUME_SMOOTH * DUCK_SMOOTH_FACTOR);
      if (me && me.hp > 0 && me.hp / me.maxHp < LOW_HP && seconds - lastBeat >= HEARTBEAT_PERIOD) { lastBeat = seconds; play(C.heartbeat, Prio.Heartbeat, null, Len.Cue); }
    },
    resume() {
      if (!c) {
        const Ctor = globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        owned = true;
        build(new Ctor());
      }
      if (c && 'resume' in c && c.state === 'suspended') void (c as AudioContext).resume().catch(() => undefined);
    },
    setSettings(next) { cur = next; applyVolumes(); },
    onScreen(next) {
      screen = next;
      if (next === 'menu') music?.setState('menu');
      else if (next === 'heroSelect') music?.setState('heroSelect');
    },
    previewHero(hero: HeroId) { play(H.call(hero), Prio.Tick, null, Len.Long); },
    dispose() {
      reset();
      music?.dispose();
      clearInterval(ticker);
      for (const n of [wind, roomNoise]) { try { n?.stop(); } catch { /* already stopped */ } n?.disconnect(); }
      if (c && owned) void (c as AudioContext).close().catch(() => undefined);
      c = null; music = null;
    },
  };
};
