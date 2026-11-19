// Original WebAudio synth voices (GDD §13): oscillators, noise, filters and envelopes only, no samples.
// Every voice is `(c, out, t) => void`: it builds nodes that start at time `t`, feed `out` and end by themselves.
import type { HeroId } from '../../sim/core/contracts';

export type Ctx = BaseAudioContext;
export type Voice = (c: Ctx, out: AudioNode, t: number) => void;

const SILENT = 0.0001;
const ATTACK = 0.004;
const NOISE_SECONDS = 2;
const noiseBuffers = new WeakMap<Ctx, AudioBuffer>();

/** Deterministic white noise (LCG), cached per context. */
function noiseBuffer(c: Ctx): AudioBuffer {
  let b = noiseBuffers.get(c);
  if (!b) {
    b = c.createBuffer(1, Math.floor(c.sampleRate * NOISE_SECONDS), c.sampleRate);
    const d = b.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < d.length; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      d[i] = s / 2147483648 - 1;
    }
    noiseBuffers.set(c, b);
  }
  return b;
}

/** A looping noise source for wind loops. The caller stops it. */
export function noiseLoop(c: Ctx): AudioBufferSourceNode {
  const n = c.createBufferSource();
  n.buffer = noiseBuffer(c);
  n.loop = true;
  return n;
}

function envelope(c: Ctx, out: AudioNode, t: number, dur: number, g: number, a = ATTACK): GainNode {
  const e = c.createGain();
  e.gain.setValueAtTime(SILENT, t);
  e.gain.linearRampToValueAtTime(g, t + Math.min(a, dur / 2));
  e.gain.exponentialRampToValueAtTime(SILENT, t + dur);
  e.connect(out);
  return e;
}

interface ToneOpts { f: number; f2?: number; dur: number; g?: number; type?: OscillatorType; a?: number; detune?: number }
export function tone(c: Ctx, out: AudioNode, t: number, o: ToneOpts): void {
  const osc = c.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(o.f2, 1), t + o.dur);
  if (o.detune) osc.detune.value = o.detune;
  osc.connect(envelope(c, out, t, o.dur, o.g ?? 0.3, o.a));
  osc.start(t);
  osc.stop(t + o.dur + 0.02);
}

interface HissOpts { f: number; f2?: number; dur: number; g?: number; type?: BiquadFilterType; q?: number; a?: number }
export function hiss(c: Ctx, out: AudioNode, t: number, o: HissOpts): void {
  const n = c.createBufferSource();
  n.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.f, t);
  if (o.f2 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(o.f2, 1), t + o.dur);
  n.connect(f);
  f.connect(envelope(c, out, t, o.dur, o.g ?? 0.3, o.a));
  n.start(t, (t * 7.3) % 1);
  n.stop(t + o.dur + 0.02);
}

/** Notes in sequence. */
export const notes = (fs: readonly number[], gap: number, o: Omit<ToneOpts, 'f'>): Voice => (c, out, t) =>
  fs.forEach((f, i) => tone(c, out, t + i * gap, { ...o, f }));

const seq = (...vs: Voice[]): Voice => (c, o, t) => vs.forEach((v) => v(c, o, t));
const later = (dt: number, v: Voice): Voice => (c, o, t) => v(c, o, t + dt);

// ---- Guns: five base recipes tuned per hero (§13.3) ----
export type Recipe = 'reed' | 'blunder' | 'rattle' | 'sling' | 'bone';
/** [recipe, pitch multiplier, tail seconds (extra body length)] */
const GUNS: Record<HeroId, readonly [Recipe, number, number]> = {
  shrike: ['sling', 1.2, 0.08], albatross: ['blunder', 0.8, 0.2], kingfisher: ['reed', 1.3, 0], lyrebird: ['sling', 1, 0.1],
  owl: ['reed', 0.6, 0.25], pelican: ['rattle', 0.7, 0], secretarybird: ['bone', 1, 0], starling: ['sling', 1.1, 0.04],
  hornbill: ['reed', 0.8, 0.05], flamingo: ['rattle', 1.2, 0], penguin: ['sling', 1.5, 0.02], puffin: ['sling', 0.7, 0],
  peacock: ['sling', 1.4, 0.2], vulture: ['bone', 1.3, 0], swift: ['rattle', 1.8, 0], hummingbird: ['rattle', 2.2, 0.05],
  cassowary: ['bone', 0.5, 0.15], toucan: ['reed', 1, 0], woodpecker: ['rattle', 0.9, 0], nightjar: ['bone', 0.7, 0],
  frigatebird: ['reed', 1.1, 0.2], cockatoo: ['sling', 1.6, 0], swan: ['reed', 1.5, 0.15], kiwi: ['blunder', 1.1, 0],
};
const PENTATONIC = [523, 587, 659, 784, 880];

export function gun(hero: string, n = 0): Voice {
  const [recipe, p, tail] = GUNS[hero as HeroId] ?? GUNS.kingfisher;
  return (c, out, t) => {
    switch (recipe) {
      case 'reed':
        hiss(c, out, t, { f: 3000 * p, dur: 0.03, g: 0.5, type: 'highpass' });
        tone(c, out, t, { f: 1500 * p, f2: 900 * p, dur: 0.1 + tail, type: 'triangle', g: 0.35 });
        break;
      case 'blunder':
        hiss(c, out, t, { f: 1800 * p, f2: 300, dur: 0.14 + tail, g: 0.6, type: 'lowpass' });
        tone(c, out, t, { f: 90 * p, f2: 40, dur: 0.25 + tail, g: 0.6 });
        break;
      case 'rattle':
        for (let i = 0; i < 3; i++) hiss(c, out, t + i * 0.022, { f: (2200 + ((n + i) % 3) * 400) * p, dur: 0.02, g: 0.35, q: 4 });
        break;
      case 'sling': {
        hiss(c, out, t, { f: 600 * p, f2: 3500 * p, dur: 0.12 + tail, g: 0.35, q: 2 });
        const f = hero === 'lyrebird' ? PENTATONIC[n % PENTATONIC.length]! : 1100 * p;
        tone(c, out, t, { f, f2: f * 0.6, dur: 0.1, type: 'triangle', g: 0.25 });
        break;
      }
      case 'bone':
        hiss(c, out, t, { f: 2500 * p, dur: 0.015, g: 0.5, type: 'highpass' });
        tone(c, out, t + 0.005, { f: 260 * p * (n % 2 ? 1.12 : 1), f2: 120 * p, dur: 0.09 + tail, type: 'square', g: 0.2 });
        break;
    }
  };
}

// ---- Hero calls: [wave, f0, f1, repeats, gap, dur, gain] ----
const CALLS: Record<HeroId, readonly [OscillatorType, number, number, number, number, number, number]> = {
  shrike: ['sawtooth', 2200, 1500, 2, 0.12, 0.09, 0.2], albatross: ['sawtooth', 160, 320, 1, 0, 0.9, 0.25],
  kingfisher: ['square', 3200, 3000, 8, 0.04, 0.03, 0.15], lyrebird: ['triangle', 1800, 900, 3, 0.16, 0.14, 0.25],
  owl: ['sine', 330, 280, 2, 0.35, 0.3, 0.35], pelican: ['sawtooth', 180, 130, 3, 0.14, 0.1, 0.25],
  secretarybird: ['sawtooth', 110, 80, 1, 0, 0.6, 0.3], starling: ['triangle', 1400, 2400, 4, 0.08, 0.07, 0.25],
  hornbill: ['square', 600, 500, 2, 0.2, 0.12, 0.25], flamingo: ['sawtooth', 700, 550, 5, 0.07, 0.06, 0.2],
  penguin: ['sawtooth', 450, 700, 1, 0, 0.6, 0.25], puffin: ['sawtooth', 90, 70, 1, 0, 0.8, 0.25],
  peacock: ['sawtooth', 900, 1500, 2, 0.35, 0.3, 0.25], vulture: ['sawtooth', 300, 200, 1, 0, 0.5, 0.2],
  swift: ['sine', 4000, 3500, 1, 0, 0.7, 0.2], hummingbird: ['square', 3600, 4200, 6, 0.05, 0.03, 0.15],
  cassowary: ['sine', 50, 45, 1, 0, 1.1, 0.7], toucan: ['sawtooth', 200, 160, 3, 0.15, 0.1, 0.25],
  woodpecker: ['square', 1800, 1700, 3, 0.1, 0.06, 0.2], nightjar: ['sawtooth', 140, 140, 12, 0.03, 0.03, 0.2],
  frigatebird: ['sine', 120, 100, 8, 0.05, 0.04, 0.4], cockatoo: ['sawtooth', 2600, 3200, 1, 0, 0.7, 0.2],
  swan: ['triangle', 380, 520, 2, 0.25, 0.25, 0.3], kiwi: ['sine', 900, 2200, 1, 0, 0.6, 0.25],
};
export function call(hero: string): Voice {
  const [type, f0, f1, n, gap, dur, g] = CALLS[hero as HeroId] ?? CALLS.owl;
  return (c, out, t) => {
    for (let i = 0; i < n; i++) tone(c, out, t + i * gap, { f: f0, f2: f1, dur, type, g, a: 0.01 });
  };
}

// ---- Combat and movement (§13.2) ----
export const hit: Voice = seq((c, o, t) => tone(c, o, t, { f: 120, dur: 0.06, g: 0.5 }), (c, o, t) => hiss(c, o, t, { f: 1500, dur: 0.02, g: 0.3 }));
export const beakTick: Voice = seq(hit, (c, o, t) => tone(c, o, t, { f: 2800, dur: 0.04, g: 0.45 }));
export const weakPointHit: Voice = seq(beakTick, (c, o, t) => tone(c, o, t, { f: 1900, f2: 1200, dur: 0.12, type: 'triangle', g: 0.3 }));
export const killConfirm: Voice = notes([880, 1318], 0.08, { dur: 0.12, g: 0.4 });
export const hitTaken: Voice = seq((c, o, t) => tone(c, o, t, { f: 80, f2: 50, dur: 0.12, g: 0.55 }), (c, o, t) => hiss(c, o, t, { f: 900, dur: 0.15, g: 0.2, type: 'lowpass' }));
export const shieldHit: Voice = (c, o, t) => [3000, 3040].forEach((f) => tone(c, o, t, { f, dur: 0.08, g: 0.2 }));
export const swish = (heavy: boolean): Voice => (c, o, t) => hiss(c, o, t, { f: 500, f2: 3000, dur: heavy ? 0.28 : 0.15, g: 0.35, q: 1.5 });
export const crack: Voice = (c, o, t) => hiss(c, o, t, { f: 1200, dur: 0.05, g: 0.5, type: 'highpass' });
export const clink: Voice = (c, o, t) => { // FM bell
  const m = c.createOscillator(), mg = c.createGain();
  m.frequency.value = 1400; mg.gain.value = 900;
  m.connect(mg);
  const car = c.createOscillator();
  car.frequency.value = 1000;
  mg.connect(car.frequency);
  car.connect(envelope(c, o, t, 0.4, 0.35));
  for (const n of [m, car]) { n.start(t); n.stop(t + 0.42); }
};
export const dullWhoosh: Voice = (c, o, t) => hiss(c, o, t, { f: 300, f2: 150, dur: 0.2, g: 0.25, type: 'lowpass' });
export const reload: Voice = (c, o, t) => [0, 0.14, 0.3].forEach((d) => hiss(c, o, t + d, { f: 1100, dur: 0.03, g: 0.3, q: 6 }));
export const dash: Voice = seq((c, o, t) => hiss(c, o, t, { f: 400, f2: 2000, dur: 0.3, g: 0.35 }), (c, o, t) => tone(c, o, t, { f: 200, f2: 120, dur: 0.06, g: 0.2 }));
export const jump: Voice = (c, o, t) => hiss(c, o, t, { f: 800, f2: 1800, dur: 0.1, g: 0.2 });
export const land: Voice = (c, o, t) => tone(c, o, t, { f: 90, f2: 50, dur: 0.1, g: 0.3 });
export const slide: Voice = (c, o, t) => hiss(c, o, t, { f: 400, dur: 0.35, g: 0.25, type: 'lowpass' });
export const podSecured: Voice = seq((c, o, t) => hiss(c, o, t, { f: 2000, dur: 0.04, g: 0.35 }), later(0.05, notes([784, 988, 1175], 0.07, { dur: 0.12, g: 0.3 })));
export const podDenied: Voice = seq((c, o, t) => hiss(c, o, t, { f: 400, dur: 0.1, g: 0.3, type: 'lowpass' }), later(0.05, (c, o, t) => tone(c, o, t, { f: 400, f2: 200, dur: 0.25, g: 0.25 })));
export const seeds = (amount: number): Voice => (c, o, t) => {
  const n = Math.min(6, 2 + Math.floor(amount / 40));
  for (let i = 0; i < n; i++) hiss(c, o, t + i * 0.035, { f: 4500, dur: 0.025, g: 0.12 + Math.min(0.2, amount / 800), q: 5 });
};
export const sellRattle: Voice = (c, o, t) => { for (let i = 0; i < 4; i++) hiss(c, o, t + i * 0.04, { f: 4000 - i * 500, dur: 0.025, g: 0.15, q: 5 }); };
export const buy: Voice = seq(seeds(120), later(0.12, notes([1047, 1568], 0.07, { dur: 0.15, g: 0.25 })));
export const molt: Voice = (c, o, t) => {
  [440, 554, 659, 880].forEach((f) => tone(c, o, t, { f, dur: 0.9, g: 0.12, a: 0.3, type: 'triangle' }));
  for (let i = 0; i < 6; i++) hiss(c, o, t + 0.1 + i * 0.07, { f: 3500, dur: 0.05, g: 0.08, q: 3 });
};
export const heartbeat: Voice = (c, o, t) => [0, 0.2].forEach((d) => tone(c, o, t + d, { f: 55, dur: 0.14, g: d ? 0.35 : 0.5 }));
export const status = (id: string): Voice => {
  if (id.includes('stun')) return (c, o, t) => tone(c, o, t, { f: 1800, dur: 0.6, g: 0.2 });
  if (id.includes('silence')) return (c, o, t) => hiss(c, o, t, { f: 700, dur: 0.3, g: 0.2, type: 'lowpass' });
  if (id.includes('root')) return (c, o, t) => tone(c, o, t, { f: 90, f2: 70, dur: 0.4, g: 0.25, type: 'sawtooth' });
  return (c, o, t) => tone(c, o, t, { f: 150, f2: 70, dur: 0.4, g: 0.25 });
};
/** An ability cast cue (0.1-0.3 s; ultimates longer) coloured by the hero's call. */
export const cast = (hero: string, ultimate: boolean): Voice => {
  const [type, f0, f1] = CALLS[hero as HeroId] ?? CALLS.owl;
  return (c, o, t) => {
    tone(c, o, t, { f: Math.min(f0, 1500), f2: Math.min(f1, 1500), dur: ultimate ? 0.5 : 0.2, type, g: ultimate ? 0.4 : 0.2 });
    hiss(c, o, t, { f: 600, f2: 2400, dur: ultimate ? 0.45 : 0.18, g: 0.2 });
  };
};

// ---- Structures, objectives, pings (§13.4) ----
export const phase2Cry: Voice = seq(
  (c, o, t) => [220, 330, 440].forEach((f, i) => tone(c, o, t, { f, f2: f * 0.7, dur: 1.6, g: 0.18, type: 'sawtooth', detune: i * 7, a: 0.2 })),
  later(0.1, (c, o, t) => tone(c, o, t, { f: 70, f2: 40, dur: 0.5, g: 0.8 })));
export const structureAttack = (attack: string): Voice => {
  switch (attack) {
    case 'bolt': return seq((c, o, t) => hiss(c, o, t, { f: 2500, f2: 1200, dur: 0.3, g: 0.3 }), (c, o, t) => tone(c, o, t, { f: 900, dur: 0.15, type: 'square', g: 0.2 }));
    case 'beam': return (c, o, t) => tone(c, o, t, { f: 120, f2: 300, dur: 0.8, type: 'sawtooth', g: 0.2, a: 0.5 });
    case 'stomp': return seq((c, o, t) => hiss(c, o, t, { f: 300, f2: 500, dur: 0.5, g: 0.15 }), later(0.5, (c, o, t) => tone(c, o, t, { f: 60, f2: 35, dur: 0.35, g: 0.7 })));
    case 'pulse': return (c, o, t) => [196, 247, 294].forEach((f) => tone(c, o, t, { f, dur: 0.7, g: 0.15, a: 0.2, type: 'triangle' }));
    case 'transition': return phase2Cry;
    default: return seq((c, o, t) => tone(c, o, t, { f: 700, f2: 300, dur: 0.35, type: 'sawtooth', g: 0.25 }), (c, o, t) => hiss(c, o, t, { f: 1500, dur: 0.1, g: 0.2 }));
  }
};
export const alarm: Voice = notes([294, 440], 0.35, { dur: 0.32, g: 0.3, type: 'square' });
export const structureDown = (allied: boolean): Voice => seq(
  (c, o, t) => hiss(c, o, t, { f: 600, f2: 120, dur: 1.2, g: 0.5, type: 'lowpass' }),
  later(0.2, notes(allied ? [440, 370, 311] : [311, 392, 466], 0.2, { dur: 0.5, g: 0.25, type: 'triangle' })));
export const wardUp: Voice = (c, o, t) => [1800, 1810].forEach((f) => tone(c, o, t, { f, dur: 0.6, g: 0.08, a: 0.3 }));
export const wardCrack: Voice = seq(crack, (c, o, t) => tone(c, o, t, { f: 2200, f2: 400, dur: 0.3, g: 0.3 }));
export const eggSpawn: Voice = notes([1047, 1319, 1568, 2093, 2637], 0.1, { dur: 0.3, g: 0.22, type: 'triangle' });
export const eggTaken: Voice = notes([1568, 2093], 0.1, { dur: 0.25, g: 0.15, type: 'triangle' });
export const eggDelivered: Voice = notes([523, 659, 784, 1047, 784, 1047, 1319], 0.11, { dur: 0.4, g: 0.25, type: 'triangle' });
export const rocRoar: Voice = (c, o, t) => {
  tone(c, o, t, { f: 80, f2: 200, dur: 2.5, g: 0.5, type: 'sawtooth', a: 0.4 });
  tone(c, o, t, { f: 1500, f2: 1100, dur: 2.5, g: 0.15, type: 'square', a: 0.4 });
  hiss(c, o, t, { f: 150, dur: 2.5, g: 0.4, type: 'lowpass', a: 0.5 });
};
export const emberClaim: Voice = seq((c, o, t) => hiss(c, o, t, { f: 300, f2: 3000, dur: 0.6, g: 0.3 }), later(0.2, (c, o, t) => [523, 659, 784].forEach((f) => tone(c, o, t, { f, dur: 1, g: 0.15, a: 0.2, type: 'triangle' }))));
export const runeSpawn: Voice = notes([2093, 2349, 2637], 0.12, { dur: 0.6, g: 0.1 });
export const runeTake: Voice = seq(notes([1568, 2093], 0.06, { dur: 0.4, g: 0.15 }), (c, o, t) => hiss(c, o, t, { f: 500, f2: 3000, dur: 0.3, g: 0.15 }));
export const ping = (kind: string): Voice => {
  switch (kind) {
    case 'attack': return (c, o, t) => hiss(c, o, t, { f: 3000, dur: 0.04, g: 0.4, q: 6 });
    case 'take': return notes([660, 880], 0.09, { dur: 0.12, g: 0.3 });
    case 'defend': return (c, o, t) => tone(c, o, t, { f: 220, dur: 0.6, g: 0.3 });
    case 'danger': return notes([200, 200], 0.14, { dur: 0.1, g: 0.35, type: 'square' });
    case 'needHelp': return notes([660, 784, 988], 0.08, { dur: 0.1, g: 0.3 });
    default: return (c, o, t) => tone(c, o, t, { f: 500, f2: 300, dur: 0.1, g: 0.3 });
  }
};
