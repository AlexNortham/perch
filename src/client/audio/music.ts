// Adaptive music (GDD §13.5): four synthesised stems (pad, bass, percussion, lead) on a 96 BPM grid. A state change
// re-targets the stem gains on the next bar with a short cross-fade.
import { hiss, tone, type Ctx } from './synth';

export type MusicState = 'menu' | 'heroSelect' | 'laning' | 'roaming' | 'skirmish' | 'objective' | 'siege' | 'victory' | 'defeat';

const BPM = 96;
export const STEP = 60 / BPM / 4; // a 16th note
const STEPS_PER_BAR = 16;
const FADE_TIME_CONSTANT = 0.4; // ~2 s to settle fully, audibly crossed within a second
const STALL = 0.5; // a gap longer than this (tab was hidden) restarts the grid at "now"

type Stems = readonly [pad: number, bass: number, perc: number, lead: number];
interface StateDef { readonly stems: Stems; readonly minor: boolean; readonly perc: 'none' | 'light' | 'full' | 'double' }
export const STATES: Record<MusicState, StateDef> = {
  menu: { stems: [1, 0, 0, 0.7], minor: false, perc: 'none' },
  heroSelect: { stems: [1, 0, 0.6, 0.8], minor: false, perc: 'light' },
  laning: { stems: [1, 0.8, 0, 0], minor: false, perc: 'none' },
  roaming: { stems: [1, 0.8, 0.6, 0], minor: false, perc: 'light' },
  skirmish: { stems: [1, 0.8, 1, 0], minor: false, perc: 'full' },
  objective: { stems: [1, 0.8, 1, 0.9], minor: true, perc: 'full' },
  siege: { stems: [1, 1, 1, 0.9], minor: true, perc: 'double' },
  victory: { stems: [1, 0.5, 0, 1], minor: false, perc: 'none' },
  defeat: { stems: [1, 0, 0, 0], minor: true, perc: 'none' },
};
// Chord roots in Hz across a 4-bar loop (A, F, C, G).
const ROOTS = [110, 87.31, 130.81, 98];
const THIRD_MAJOR = 5 / 4, THIRD_MINOR = 6 / 5, FIFTH = 3 / 2;
const LEAD_PATTERN = [0, 2, 4, 2, 5, 4, 2, 0]; // scale degrees of a pentatonic motif, one per 2 steps
const PENTATONIC_RATIOS = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];

export interface Music {
  setState(s: MusicState): void;
  readonly state: MusicState;
  /** Schedule the steps due up to `now + lookahead`. */
  tick(now: number): void;
  dispose(): void;
}

export function createMusic(c: Ctx, out: AudioNode, lookahead: number): Music {
  const stems = (['pad', 'bass', 'perc', 'lead'] as const).map(() => {
    const g = c.createGain();
    g.gain.value = 0;
    g.connect(out);
    return g;
  });
  let current: MusicState = 'menu';
  let pending: MusicState | null = null;
  let applied: MusicState | null = null;
  let next = 0;
  let step = 0;
  let started = false;

  const apply = (s: MusicState, t: number): void => {
    applied = s;
    STATES[s].stems.forEach((v, i) => stems[i]!.gain.setTargetAtTime(v * 0.5, t, FADE_TIME_CONSTANT));
  };

  const schedule = (i: number, t: number): void => {
    const bar = Math.floor(i / STEPS_PER_BAR) % ROOTS.length;
    const root = ROOTS[bar]!;
    const s = STATES[applied ?? current];
    const third = s.minor ? THIRD_MINOR : THIRD_MAJOR;
    const inBar = i % STEPS_PER_BAR;
    if (inBar === 0) [1, third, FIFTH].forEach((r) => tone(c, stems[0]!, t, { f: root * 2 * r, dur: STEP * STEPS_PER_BAR, g: 0.12, a: 0.5, type: 'triangle' }));
    if (inBar % 4 === 0) tone(c, stems[1]!, t, { f: root, dur: STEP * 3, g: 0.4, type: 'sine' });
    const percEvery = s.perc === 'double' ? 1 : 2;
    // Percussion is always scheduled; the stem gain is what silences it. 'light' keeps only off-beat hats.
    if (inBar % 8 === 0) tone(c, stems[2]!, t, { f: 100, f2: 45, dur: 0.12, g: 0.5 }); // kick
    if (inBar % percEvery === 0 && (s.perc !== 'light' || inBar % 4 === 2)) hiss(c, stems[2]!, t, { f: 7000, dur: 0.03, g: 0.12, type: 'highpass' });
    if (inBar % 2 === 0) {
      const d = LEAD_PATTERN[(inBar / 2) % LEAD_PATTERN.length]!;
      const r = PENTATONIC_RATIOS[d % PENTATONIC_RATIOS.length]! * (s.minor && d % 3 === 2 ? 5 / 6 : 1);
      tone(c, stems[3]!, t, { f: root * 8 * r, dur: STEP * 3, g: 0.12, type: 'triangle' });
    }
  };

  return {
    get state() { return current; },
    setState(s) { current = s; pending = s !== applied ? s : null; },
    tick(now) {
      if (!started || now - next > STALL) { next = now; step = 0; started = true; }
      while (next < now + lookahead) {
        if (step % STEPS_PER_BAR === 0 && (pending || applied === null)) { apply(pending ?? current, next); pending = null; }
        schedule(step, next);
        next += STEP;
        step++;
      }
    },
    dispose() { stems.forEach((g) => g.disconnect()); },
  };
}
