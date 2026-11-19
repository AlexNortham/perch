// Adaptive music tables (GDD §13.5): tempo, stem mixes per state, chords, motif and stem recipes. Data under the lint
// exemption for data/; the scheduler in ../music.ts is logic.
export type MusicState = 'menu' | 'heroSelect' | 'laning' | 'roaming' | 'skirmish' | 'objective' | 'siege' | 'victory' | 'defeat';

export const BPM = 96;
export const SECONDS_PER_MINUTE = 60;
export const STEPS_PER_BEAT = 4;
export const STEPS_PER_BAR = 16;
export const FADE_TIME_CONSTANT = 0.4; // ~2 s to settle fully, audibly crossed within a second
export const STALL = 0.5; // a gap longer than this (tab was hidden) restarts the grid at "now"
export const STEM_GAIN = 0.5; // scales every stem mix value

export type Stems = readonly [pad: number, bass: number, perc: number, lead: number];
export interface StateDef { readonly stems: Stems; readonly minor: boolean; readonly perc: 'none' | 'light' | 'full' | 'double' }
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
export const ROOTS = [110, 87.31, 130.81, 98];
export const THIRD_MAJOR = 5 / 4, THIRD_MINOR = 6 / 5, FIFTH = 3 / 2;
export const LEAD_PATTERN = [0, 2, 4, 2, 5, 4, 2, 0]; // scale degrees of a pentatonic motif, one per 2 steps
export const PENTATONIC_RATIOS = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2];
export const LOWERED_FIFTH = 5 / 6; // flattens every third lead degree in minor states
export const LEAD_FLAT_EVERY = 3;
export const LEAD_FLAT_AT = 2;

// Stem recipes. Steps are 16ths: pad once a bar, bass every beat, kick every half bar, lead every other step.
export const PAD = { octave: 2, g: 0.12, a: 0.5 } as const;
export const BASS = { everySteps: 4, lengthSteps: 3, g: 0.4 } as const;
export const KICK = { everySteps: 8, f: 100, f2: 45, dur: 0.12, g: 0.5 } as const;
export const HAT = { f: 7000, dur: 0.03, g: 0.12, offBeatStep: 2, offBeatEvery: 4 } as const;
export const LEAD = { octave: 8, lengthSteps: 3, g: 0.12 } as const;
export const PERC_DOUBLE_EVERY = 1, PERC_EVERY = 2;
