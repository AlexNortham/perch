// Stage 4 cues (GDD §13, §§7.8-7.15): the Egg, the Roc and its Embers, Thickets, Nests, Feeders, interactables, the
// Updraft latch. Synth recipes only, so data under the lint exemption for data/. Each id is tuned to a distinct signal.
import { hiss, later, notes, seq, tone, type Voice } from '../synth';

// ---- The Golden Egg ----
export const eggCarryPulse: Voice = notes([1319, 1976], 0.16, { dur: 0.35, g: 0.05, a: 0.1, type: 'triangle' });
export const eggDrop: Voice = seq(
  (c, o, t) => tone(c, o, t, { f: 700, f2: 180, dur: 0.3, g: 0.3, type: 'triangle' }),
  (c, o, t) => hiss(c, o, t, { f: 2400, dur: 0.06, g: 0.25, q: 4 }));
export const eggSpoil: Voice = seq(
  (c, o, t) => hiss(c, o, t, { f: 3200, dur: 0.12, g: 0.4, type: 'highpass' }),
  later(0.05, (c, o, t) => tone(c, o, t, { f: 900, f2: 120, dur: 0.5, g: 0.25, type: 'sawtooth' })));

// ---- The Roc ----
export const rocWake: Voice = seq(
  (c, o, t) => tone(c, o, t, { f: 55, f2: 110, dur: 1.4, g: 0.45, type: 'sawtooth', a: 0.5 }),
  (c, o, t) => hiss(c, o, t, { f: 120, f2: 400, dur: 1.4, g: 0.3, type: 'lowpass', a: 0.6 }));
export const rocAttack = (attack: string): Voice => {
  switch (attack) {
    case 'flap': return seq((c, o, t) => hiss(c, o, t, { f: 200, f2: 700, dur: 0.5, g: 0.5, type: 'lowpass', a: 0.15 }), later(0.35, (c, o, t) => tone(c, o, t, { f: 60, f2: 40, dur: 0.3, g: 0.5 })));
    case 'shriek': return seq((c, o, t) => tone(c, o, t, { f: 900, f2: 2400, dur: 0.9, g: 0.3, type: 'sawtooth', a: 0.2 }), (c, o, t) => tone(c, o, t, { f: 1350, f2: 3000, dur: 0.9, g: 0.15, type: 'square', a: 0.2 }));
    default: return seq((c, o, t) => hiss(c, o, t, { f: 600, f2: 2800, dur: 0.3, g: 0.4, q: 2 }), later(0.25, (c, o, t) => tone(c, o, t, { f: 110, f2: 50, dur: 0.25, g: 0.5, type: 'triangle' })));
  }
};
export const rocEnrage: Voice = seq(
  (c, o, t) => [70, 105, 140].forEach((f, i) => tone(c, o, t, { f, f2: f * 2.2, dur: 2.2, g: 0.35, type: 'sawtooth', detune: i * 11, a: 0.3 })),
  (c, o, t) => tone(c, o, t, { f: 1800, f2: 800, dur: 2, g: 0.12, type: 'square', a: 0.3 }),
  later(0.3, (c, o, t) => hiss(c, o, t, { f: 3000, f2: 300, dur: 1.5, g: 0.35 })));
export const rocDeath: Voice = seq(
  (c, o, t) => tone(c, o, t, { f: 260, f2: 35, dur: 2.8, g: 0.5, type: 'sawtooth', a: 0.1 }),
  (c, o, t) => hiss(c, o, t, { f: 1500, f2: 100, dur: 2.2, g: 0.35, type: 'lowpass' }),
  later(1.2, (c, o, t) => tone(c, o, t, { f: 45, f2: 28, dur: 1, g: 0.8 })));
export const emberDrop: Voice = seq(
  (c, o, t) => hiss(c, o, t, { f: 3000, f2: 400, dur: 0.7, g: 0.2 }),
  later(0.6, (c, o, t) => [660, 990].forEach((f) => tone(c, o, t, { f, dur: 0.6, g: 0.12, type: 'triangle' }))));
export const rekindle: Voice = seq(
  (c, o, t) => hiss(c, o, t, { f: 400, f2: 5000, dur: 0.8, g: 0.3 }),
  later(0.1, notes([392, 523, 659, 784, 1047], 0.09, { dur: 0.9, g: 0.16, a: 0.1, type: 'triangle' })));

// ---- Thickets ----
const WAKE_HZ: Record<string, number> = { beetle: 180, weasel: 700, rat: 1100, toad: 110, badger: 70 };
const DIE_HZ: Record<string, number> = { beetle: 220, weasel: 800, rat: 1200, toad: 130, badger: 80 };
const DEFAULT_HZ = 300;
export const creatureWake = (type: string): Voice => {
  const f = WAKE_HZ[type] ?? DEFAULT_HZ;
  return seq((c, o, t) => tone(c, o, t, { f, f2: f * 1.5, dur: 0.35, g: 0.25, type: 'sawtooth', a: 0.1 }), (c, o, t) => hiss(c, o, t, { f: f * 4, dur: 0.2, g: 0.15, q: 2 }));
};
export const creatureAttack = (attack: string): Voice => {
  switch (attack) {
    case 'dashBite': return seq((c, o, t) => hiss(c, o, t, { f: 500, f2: 3500, dur: 0.2, g: 0.35, q: 2 }), later(0.15, (c, o, t) => hiss(c, o, t, { f: 3500, dur: 0.04, g: 0.4, type: 'highpass' })));
    case 'lash': return (c, o, t) => hiss(c, o, t, { f: 300, f2: 1800, dur: 0.25, g: 0.4, q: 3 });
    case 'spit': return seq((c, o, t) => tone(c, o, t, { f: 300, f2: 700, dur: 0.12, g: 0.3 }), later(0.12, (c, o, t) => hiss(c, o, t, { f: 900, dur: 0.1, g: 0.3, q: 4 })));
    case 'slam': return seq((c, o, t) => hiss(c, o, t, { f: 200, f2: 500, dur: 0.5, g: 0.3, type: 'lowpass', a: 0.2 }), later(0.55, (c, o, t) => tone(c, o, t, { f: 55, f2: 30, dur: 0.4, g: 0.7 })));
    default: return seq((c, o, t) => hiss(c, o, t, { f: 1800, dur: 0.05, g: 0.4, type: 'highpass' }), (c, o, t) => tone(c, o, t, { f: 240, f2: 120, dur: 0.1, g: 0.3, type: 'square' }));
  }
};
export const creatureDie = (type: string): Voice => {
  const f = DIE_HZ[type] ?? DEFAULT_HZ;
  return seq((c, o, t) => tone(c, o, t, { f, f2: f * 0.3, dur: 0.4, g: 0.3, type: 'sawtooth' }), (c, o, t) => hiss(c, o, t, { f: f * 3, f2: f, dur: 0.25, g: 0.2, type: 'lowpass' }));
};
export const campCleared: Voice = notes([523, 659, 784, 1047], 0.09, { dur: 0.35, g: 0.2, type: 'triangle' });

// ---- Nests, Feeders, runes ----
export const nestBreak = (variant: string): Voice => {
  if (variant === 'keepsake') return seq((c, o, t) => hiss(c, o, t, { f: 2000, dur: 0.25, g: 0.3, q: 2 }), later(0.05, notes([1760, 2349, 2794], 0.06, { dur: 0.3, g: 0.12 })));
  if (variant === 'woven') return seq((c, o, t) => hiss(c, o, t, { f: 700, f2: 300, dur: 0.4, g: 0.45, type: 'lowpass' }), (c, o, t) => tone(c, o, t, { f: 140, f2: 70, dur: 0.2, g: 0.35 }));
  return seq((c, o, t) => hiss(c, o, t, { f: 2500, dur: 0.12, g: 0.4, q: 1.5 }), later(0.07, (c, o, t) => hiss(c, o, t, { f: 1500, dur: 0.1, g: 0.3, q: 1.5 })));
};
export const feederBreak: Voice = seq(nestBreak('woven'), later(0.05, notes([1319, 988], 0.09, { dur: 0.5, g: 0.2 })));
export const feederChime = (full: boolean): Voice => (c, o, t) => [1, 2.76, 5.4].forEach((r, i) => tone(c, o, t, { f: (full ? 880 : 660) * r, dur: (full ? 1.4 : 0.9) / (i + 1), g: 0.2 / (i + 1), a: 0.002 }));
export const feederBlink: Voice = (c, o, t) => tone(c, o, t, { f: 1760, dur: 0.12, g: 0.2, type: 'triangle' });

// ---- Pickups and interactables ----
export const keepsake: Voice = notes([1175, 1568, 1976], 0.07, { dur: 0.5, g: 0.16 });
export const berry: Voice = seq((c, o, t) => tone(c, o, t, { f: 300, f2: 600, dur: 0.1, g: 0.3 }), later(0.1, (c, o, t) => hiss(c, o, t, { f: 1200, dur: 0.12, g: 0.2, q: 3 })));
export const hide = (enter: boolean): Voice => (c, o, t) => hiss(c, o, t, enter ? { f: 2500, f2: 600, dur: 0.35, g: 0.3 } : { f: 600, f2: 2500, dur: 0.3, g: 0.3 });
export const spring: Voice = seq((c, o, t) => tone(c, o, t, { f: 180, f2: 90, dur: 0.1, g: 0.4 }), (c, o, t) => tone(c, o, t, { f: 300, f2: 1400, dur: 0.35, g: 0.25, type: 'triangle' }));
export const lookout: Voice = notes([784, 1175], 0.12, { dur: 0.5, g: 0.1, a: 0.08 });
export const ivy: Voice = (c, o, t) => hiss(c, o, t, { f: 1800, f2: 900, dur: 0.3, g: 0.3, q: 0.8, a: 0.08 });
export const cellar: Voice = seq((c, o, t) => tone(c, o, t, { f: 90, f2: 60, dur: 0.5, g: 0.3, a: 0.1 }), (c, o, t) => hiss(c, o, t, { f: 300, dur: 0.5, g: 0.15, type: 'lowpass', a: 0.15 }));
export const den: Voice = notes([1047, 1397, 1760, 2093], 0.06, { dur: 0.25, g: 0.14, type: 'triangle' });
export const latch: Voice = seq((c, o, t) => hiss(c, o, t, { f: 300, f2: 1500, dur: 0.4, g: 0.3, a: 0.1 }), later(0.05, (c, o, t) => tone(c, o, t, { f: 520, dur: 0.08, g: 0.3, type: 'square' })));
export const dismount: Voice = seq((c, o, t) => hiss(c, o, t, { f: 1500, f2: 300, dur: 0.25, g: 0.25 }), (c, o, t) => tone(c, o, t, { f: 400, f2: 250, dur: 0.1, g: 0.2 }));

// ---- Indoors and occlusion ----
export const ROOM_TONE = { lowpassHz: 320, gain: 0.05, windScale: 0.3, smooth: 0.15 } as const;
export const OCCLUSION = { gain: 0.5, lowpassHz: 2000 } as const; // -6 dB and 2 kHz (INTERFACES §13 row 3)
