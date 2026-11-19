// WebAudio engine (GDD §13). Graph: voice -> [HRTF panner] -> sfx bus -> master -> compressor -> destination, with
// music stems -> music bus -> duck -> master. Starts on the first user gesture (`resume`); sounds are driven by the
// drained sim events plus the view and the camera pose. No samples: every sound comes from ./synth and ./music.
import type { SimEvent, SimView, Vec3 } from '../../sim/core/contracts';
import type { AudioOut, CameraPose, Frame, Settings } from '../app/contracts';
import { createMusic, type Music, type MusicState } from './music';
import * as S from './synth';

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

/** Lower number = ducks the rest (§13.1). */
const Prio = { Tick: 0, Heartbeat: 1, EnemyUlt: 2, OwnGun: 3, Alarm: 4, Combat: 5, Ambient: 6 } as const;

export interface AudioOptions {
  /** Test seam: render into this context (e.g. an OfflineAudioContext) instead of a live one. */
  readonly ctx?: BaseAudioContext;
  /** Seconds of music scheduled ahead of the clock. */
  readonly lookahead?: number;
}

interface Active { end: number; prio: number; dist: number; bus: GainNode }

const dist3 = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export const createAudio = (settings: Settings, opts: AudioOptions = {}): AudioOut => {
  let cur = settings;
  let c: BaseAudioContext | null = null;
  let owned = false;
  let sfx: GainNode, musicBus: GainNode, duck: GainNode, master: GainNode;
  let music: Music | null = null;
  let wind: AudioBufferSourceNode | null = null;
  let active: Active[] = [];
  let listener: CameraPose | null = null;
  let view: SimView | null = null;
  let lastFight = -Infinity;
  let lastCall = new Map<number, number>();
  let lastAlarm = -Infinity;
  let lastBeat = -Infinity;
  let shots = new Map<number, number>();
  let eggCarried = false;
  let seconds = 0;

  const applyVolumes = (): void => {
    if (!c) return;
    const t = c.currentTime;
    master.gain.setTargetAtTime(cur.volume.master, t, VOLUME_SMOOTH);
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
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 450;
    g.gain.value = 0.05;
    wind.connect(f); f.connect(g); g.connect(sfx);
    wind.start();
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

  /** Play a voice. `at` makes it positional (skipped beyond 60 m); null plays it flat (UI, own feedback, map-wide). */
  const play = (voice: S.Voice, prio: number, at: Vec3 | null, dur: number): void => {
    if (!c) return;
    const now = c.currentTime;
    const d = at && listener ? dist3(at, listener.position) : 0;
    if (at && listener && d > MAX_DISTANCE) return;
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
    if (at && listener) {
      const p = c.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = REF_DISTANCE;
      p.rolloffFactor = 1;
      p.maxDistance = MAX_DISTANCE;
      p.positionX.value = at.x; p.positionY.value = at.y; p.positionZ.value = at.z;
      bus.connect(p);
      p.connect(sfx);
    } else bus.connect(sfx);
    voice(c, bus, now);
    active.push({ end: now + dur, prio, dist: d, bus });
  };

  const reset = (): void => {
    for (const v of active) v.bus.disconnect();
    active = [];
    lastCall = new Map(); shots = new Map();
    lastFight = lastAlarm = lastBeat = -Infinity;
    eggCarried = false;
    view = null;
    music?.setState('menu');
  };

  const heroOf = (id: number | null): string | undefined => (id === null ? undefined : view?.heroes.find((h) => h.id === id)?.heroId);
  const posOf = (id: number | null): Vec3 | null => (id === null ? null : view?.entities.find((e) => e.id === id)?.pos ?? null);

  const heroCall = (id: number, loud: boolean): void => {
    const hero = heroOf(id);
    if (!hero || !c || c.currentTime - (lastCall.get(id) ?? -Infinity) < CALL_COOLDOWN) return;
    lastCall.set(id, c.currentTime);
    play(S.call(hero), Prio.Combat, posOf(id), loud ? 1.5 : 1);
  };

  const onEvent = (e: SimEvent, v: SimView): void => {
    const me = v.localHero;
    const myTeam = v.heroes.find((h) => h.id === me)?.team;
    switch (e.type) {
      case 'weapon.fired': {
        const n = (shots.get(e.shooter) ?? 0) + 1;
        shots.set(e.shooter, n);
        play(S.gun(heroOf(e.shooter) ?? 'kingfisher', n), e.shooter === me ? Prio.OwnGun : Prio.Combat, e.muzzle, 0.4);
        break;
      }
      case 'weapon.reload': if (!e.done) play(S.reload, Prio.Combat, posOf(e.hero), 0.5); break;
      case 'damage.applied': {
        const mine = e.source === me, taken = e.target === me;
        if (mine || (e.sourceTeam === myTeam && e.targetKind === 'hero')) lastFight = seconds;
        if (taken) { lastFight = seconds; play(S.hitTaken, Prio.Combat, e.pos, 0.3); }
        if (mine && e.target !== me) play(e.weakPoint ? S.weakPointHit : e.beakShot ? S.beakTick : S.hit, Prio.Tick, null, 0.2);
        else if (!mine && !taken) play(S.hit, Prio.Combat, e.pos, 0.1);
        if (e.absorbed > 0 && (mine || taken)) play(S.shieldHit, Prio.Combat, e.pos, 0.1);
        if (e.targetKind === 'structure' && e.sourceTeam !== 'neutral' && myTeam && e.sourceTeam !== myTeam && seconds - lastAlarm >= ALARM_PERIOD) {
          const st = v.entities.find((x) => x.id === e.target);
          if (st && st.team === myTeam && v.heroes.some((h) => h.id === e.source)) { lastAlarm = seconds; play(S.alarm, Prio.Alarm, null, 0.7); }
        }
        break;
      }
      case 'entity.died':
        if (e.victimKind === 'structure') play(S.structureDown(e.victimTeam === myTeam), Prio.Alarm, e.pos, 1.5);
        else if (e.victimKind === 'hero' && e.creditHero === me && e.victim !== me) { play(S.killConfirm, Prio.Tick, null, 0.3); if (me !== null) heroCall(me, false); }
        break;
      case 'melee':
        play(S.swish(e.heavy), Prio.Combat, posOf(e.attacker), 0.35);
        if (e.target !== null && !e.parried) play(e.heavy ? S.crack : S.hit, Prio.Combat, posOf(e.target), 0.1);
        break;
      case 'parry':
        if (e.outcome === 'success') play(S.clink, Prio.Combat, posOf(e.hero), 0.5);
        else if (e.outcome === 'whiff') play(S.dullWhoosh, Prio.Combat, posOf(e.hero), 0.25);
        break;
      case 'movement': {
        const at = posOf(e.hero);
        const voice = { dash: S.dash, dashJump: S.dash, downDash: S.dash, jump: S.jump, airJump: S.jump, wallJump: S.jump, land: S.land, slide: S.slide, updraftBoost: S.dash, mantle: S.jump }[e.action as string];
        if (voice) play(voice, Prio.Combat, at, 0.4);
        break;
      }
      case 'pod.resolved': play(e.outcome === 'secured' ? S.podSecured : S.podDenied, Prio.Combat, e.pos, 0.5); break;
      case 'seeds.gained': if (e.hero === me) play(S.seeds(e.amount), Prio.Combat, null, 0.4); break;
      case 'hero.level': if (e.hero === me) play(S.molt, Prio.Tick, null, 1.5); break;
      case 'hero.respawned': heroCall(e.hero, false); break;
      case 'ability': {
        const hero = heroOf(e.caster);
        if (e.stage !== 'start' || !hero) break;
        const ult = e.slot === 3;
        play(S.cast(hero, ult), ult && e.caster !== me ? Prio.EnemyUlt : Prio.Combat, e.point, ult ? 0.6 : 0.25);
        if (ult) heroCall(e.caster, true);
        break;
      }
      case 'status.applied': if (e.target === me) play(S.status(e.status), Prio.Combat, null, 0.7); break;
      case 'item.bought': if (e.hero === me) play(S.buy, Prio.Combat, null, 0.4); break;
      case 'item.sold': if (e.hero === me) play(S.sellRattle, Prio.Combat, null, 0.3); break;
      case 'structure.attack': play(S.structureAttack(e.attack), Prio.Combat, e.origin, 1); break;
      case 'structure.state':
        if (e.state === 'phase2') play(S.phase2Cry, Prio.Alarm, null, 2);
        else if (e.state === 'wardUp') play(S.wardUp, Prio.Ambient, posOf(e.structure), 0.7);
        else if (e.state === 'wardDown') play(S.wardCrack, Prio.Combat, posOf(e.structure), 0.4);
        break;
      case 'patron.depleted': play(S.phase2Cry, Prio.Alarm, null, 2); break;
      case 'objective': {
        const m: Partial<Record<typeof e.action, [S.Voice, boolean]>> = {
          eggSpawned: [S.eggSpawn, false], eggTaken: [S.eggTaken, true], eggDelivered: [S.eggDelivered, false],
          rocSpawned: [S.rocRoar, false], emberClaimed: [S.emberClaim, true], runeSpawned: [S.runeSpawn, true], runeTaken: [S.runeTake, true],
        };
        const hit = m[e.action];
        if (hit) play(hit[0], Prio.Alarm, hit[1] ? e.pos : null, 2.5);
        if (e.action === 'eggTaken') eggCarried = true;
        if (e.action === 'eggDropped' || e.action === 'eggDelivered') eggCarried = false;
        break;
      }
      case 'ping': play(S.ping(e.kind), Prio.Combat, null, 0.4); break;
      default: break;
    }
  };

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
    if (eggCarried || v.entities.some((e) => e.kind === 'unit' && e.type === 'roc' && e.hp < e.maxHp)) return 'objective';
    if (seconds - lastFight < FIGHT_HOLD) return 'skirmish';
    return v.seconds < ROAM_AFTER ? 'laning' : 'roaming';
  };

  if (opts.ctx) build(opts.ctx);

  return {
    onEvents(events, v) {
      view = v;
      seconds = v.seconds;
      for (const e of events) onEvent(e, v);
    },
    reset,
    update(f: Frame, l: CameraPose) {
      listener = l;
      view = f.curr;
      seconds = f.curr.seconds;
      if (!c || !music) return;
      pose();
      music.setState(musicState(f.curr));
      music.tick(c.currentTime);
      duck.gain.setTargetAtTime(seconds - lastFight < FIGHT_HOLD ? DUCK_GAIN : 1, c.currentTime, VOLUME_SMOOTH * 10);
      const me = f.curr.localHero === null ? undefined : f.curr.entities.find((e) => e.id === f.curr.localHero);
      if (me && me.hp > 0 && me.hp / me.maxHp < LOW_HP && seconds - lastBeat >= HEARTBEAT_PERIOD) { lastBeat = seconds; play(S.heartbeat, Prio.Heartbeat, null, 0.4); }
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
    dispose() {
      reset();
      music?.dispose();
      try { wind?.stop(); } catch { /* already stopped */ }
      wind?.disconnect();
      if (c && owned) void (c as AudioContext).close().catch(() => undefined);
      c = null; music = null;
    },
  };
};
