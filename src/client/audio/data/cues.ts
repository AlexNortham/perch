// Combat, movement, structure, objective and ping cues (GDD §13.2, §13.4): synth recipes, so data under the lint
// exemption for data/.
import { envelope, hiss, later, notes, seq, tone, type Voice } from '../synth';

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
