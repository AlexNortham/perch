// The animation states every playable bird must hold its gun through (W4 animation brief, D-EP-035), shared by the
// attachment tests and the pose sheets. Names are keys of STATES in src/client/render/models/debug.ts.
import { HIT_CYCLE, LAND_CYCLE, MELEE_CYCLE } from '../../src/client/render/models/debug';
import { MELEE } from '../../src/client/render/models/constants';
import type { HeroId } from '../../src/sim/core/contracts';

/** A1, B1, A2 and the sculpted A3 and B2 birds: every playable bird. */
export const PLAYABLE: readonly HeroId[] = [
  'shrike', 'albatross', 'kingfisher', 'lyrebird', 'owl', 'pelican', 'secretarybird', 'starling', 'hornbill', 'flamingo', 'penguin', 'puffin',
  'peacock', 'vulture', 'swift', 'hummingbird',
];

export const SHEET_STATES: readonly string[] = [
  'idle', 'aim', 'run', 'sprint', 'jump', 'fall', 'land', 'dash',
  'slide', 'mantle', 'climb', 'updraft', 'shoot', 'reload', 'light', 'charge',
  'heavy', 'parry', 'cast1', 'cast2', 'cast3', 'cast4', 'hit', 'dead',
];

/** Grounded states whose feet must be on the ground (one foot may lift in a stride, a stomp or the Flamingo's idle). */
export const PLANTED: readonly string[] = ['idle', 'aim', 'run', 'sprint', 'land', 'shoot', 'reload', 'light', 'charge', 'heavy', 'parry', 'cast1', 'cast2', 'cast3', 'cast4', 'hit'];

const SETTLE = 1.5;
/** Seconds into a light or heavy swing at its lunge peak. */
const peak = (s: { dur: number; windup: number }): number => s.dur * (s.windup + (1 - s.windup) * MELEE.peak);

/** When the pose sheet samples each state (s from a fresh rig): settled, or at the telling moment of a swing. */
export function sampleTime(state: string): number {
  if (state === 'light') return MELEE_CYCLE + peak(MELEE.light);
  if (state === 'heavy') return MELEE_CYCLE + peak(MELEE.heavy);
  if (state === 'land') return LAND_CYCLE + LAND_CYCLE / 2 + 0.08;
  if (state === 'hit') return HIT_CYCLE * 2 + 0.05;
  if (state === 'run' || state === 'sprint') return SETTLE + 0.04;
  return SETTLE;
}
