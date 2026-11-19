import type { Rng, RngStreams } from './contracts/sim';

/**
 * Seeded RNG: sfc32 (small, fast, passes PractRand), one independent stream per name. A stream's sequence depends
 * only on (match seed, stream name), never on how many numbers another stream drew or when a stream was created.
 */

const UINT32 = 0x1_0000_0000;
const SPLITMIX_GAMMA = 0x9e3779b9;
const MIX_1 = 0x85ebca6b;
const MIX_2 = 0xc2b2ae35;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
/** sfc32 is weak for its first few outputs; discard them. */
const WARM_UP = 12;
const SHIFT_9 = 9;
const SHIFT_3 = 3;
const ROT_21 = 21;
const ROT_11 = 11;
const SHIFT_16 = 16;
const SHIFT_13 = 13;

/** FNV-1a over UTF-16 code units. Stable string → uint32 for stream names. */
export function hashString(s: string): number {
  let h = FNV_OFFSET;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  return h >>> 0;
}

/** splitmix32 step: spreads a seed into well-mixed state words. */
function splitmix(state: { s: number }): number {
  state.s = (state.s + SPLITMIX_GAMMA) | 0;
  let z = state.s;
  z = Math.imul(z ^ (z >>> SHIFT_16), MIX_1);
  z = Math.imul(z ^ (z >>> SHIFT_13), MIX_2);
  return (z ^ (z >>> SHIFT_16)) >>> 0;
}

/**
 * One stream. Most callers want `createRngStreams(seed).stream(name)` instead. Every bit of a safe-integer seed
 * counts: the low 32 bits seed the mixer and the high bits go into one state word, so seeds below 2^32 keep the
 * sequences they always had.
 */
export function createRng(seed: number, name: string): Rng {
  const high = Math.floor(seed / UINT32);
  const mix = { s: ((seed >>> 0) ^ hashString(name)) | 0 };
  let a = splitmix(mix);
  let b = splitmix(mix);
  let c = (splitmix(mix) ^ high) | 0;
  let d = splitmix(mix);

  const nextU32 = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> SHIFT_9);
    b = (c + (c << SHIFT_3)) | 0;
    c = (c << ROT_21) | (c >>> ROT_11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let i = 0; i < WARM_UP; i++) nextU32();

  const next = (): number => nextU32() / UINT32;
  return {
    name,
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error(`rng(${name}).pick on an empty list`);
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    shuffle: (items) => {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = items[i] as (typeof items)[number];
        items[i] = items[j] as (typeof items)[number];
        items[j] = tmp;
      }
      return items;
    },
    state: () => [a >>> 0, b >>> 0, c >>> 0, d >>> 0],
  };
}

/** Named streams for one match. Streams are created on first use and live for the match. */
export function createRngStreams(seed: number): RngStreams {
  const streams = new Map<string, Rng>();
  return {
    seed,
    stream(name) {
      let rng = streams.get(name);
      if (!rng) {
        rng = createRng(seed, name);
        streams.set(name, rng);
      }
      return rng;
    },
    states() {
      return [...streams.values()]
        .sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0))
        .map((r) => [r.name, r.state()] as const);
    },
  };
}
