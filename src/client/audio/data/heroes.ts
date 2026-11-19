// Per-hero gun and call recipes (GDD §13.3): tables of tuning numbers, so data under the lint exemption for data/.
import type { HeroId } from '../../../sim/core/contracts';
import { hiss, tone, type Voice } from '../synth';

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


/** An ability cast cue (0.1-0.3 s; ultimates longer) coloured by the hero's call. */
export const cast = (hero: string, ultimate: boolean): Voice => {
  const [type, f0, f1] = CALLS[hero as HeroId] ?? CALLS.owl;
  return (c, o, t) => {
    tone(c, o, t, { f: Math.min(f0, 1500), f2: Math.min(f1, 1500), dur: ultimate ? 0.5 : 0.2, type, g: ultimate ? 0.4 : 0.2 });
    hiss(c, o, t, { f: 600, f2: 2400, dur: ultimate ? 0.45 : 0.18, g: 0.2 });
  };
};
