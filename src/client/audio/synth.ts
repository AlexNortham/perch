// Synth primitives (GDD §13): oscillators, noise, filters and envelopes only, no samples; the recipes live in ./data.
// Every voice is `(c, out, t) => void`: it builds nodes that start at time `t`, feed `out` and end by themselves.

export type Ctx = BaseAudioContext;
export type Voice = (c: Ctx, out: AudioNode, t: number) => void;

const SILENT = 0.0001;
const ATTACK = 0.004;
const NOISE_SECONDS = 2;
const LCG_SEED = 12345, LCG_MUL = 1664525, LCG_ADD = 1013904223, LCG_HALF_RANGE = 2147483648; // Numerical Recipes LCG, 2^31 maps to [-1, 1)
const DEFAULT_GAIN = 0.3;
const STOP_TAIL = 0.02; // seconds after the envelope ends before the source is stopped
const NOISE_OFFSET_STRIDE = 7.3; // varies where each hiss starts in the shared buffer
const noiseBuffers = new WeakMap<Ctx, AudioBuffer>();

/** Deterministic white noise (LCG), cached per context. */
function noiseBuffer(c: Ctx): AudioBuffer {
  let b = noiseBuffers.get(c);
  if (!b) {
    b = c.createBuffer(1, Math.floor(c.sampleRate * NOISE_SECONDS), c.sampleRate);
    const d = b.getChannelData(0);
    let s = LCG_SEED;
    for (let i = 0; i < d.length; i++) {
      s = (Math.imul(s, LCG_MUL) + LCG_ADD) >>> 0;
      d[i] = s / LCG_HALF_RANGE - 1;
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

export function envelope(c: Ctx, out: AudioNode, t: number, dur: number, g: number, a = ATTACK): GainNode {
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
  osc.connect(envelope(c, out, t, o.dur, o.g ?? DEFAULT_GAIN, o.a));
  osc.start(t);
  osc.stop(t + o.dur + STOP_TAIL);
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
  f.connect(envelope(c, out, t, o.dur, o.g ?? DEFAULT_GAIN, o.a));
  n.start(t, (t * NOISE_OFFSET_STRIDE) % 1);
  n.stop(t + o.dur + STOP_TAIL);
}

/** Notes in sequence. */
export const notes = (fs: readonly number[], gap: number, o: Omit<ToneOpts, 'f'>): Voice => (c, out, t) =>
  fs.forEach((f, i) => tone(c, out, t + i * gap, { ...o, f }));

export const seq = (...vs: Voice[]): Voice => (c, o, t) => vs.forEach((v) => v(c, o, t));
export const later = (dt: number, v: Voice): Voice => (c, o, t) => v(c, o, t + dt);

