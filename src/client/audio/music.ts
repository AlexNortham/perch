// Adaptive music (GDD §13.5): four synthesised stems (pad, bass, percussion, lead) on a 96 BPM grid. A state change
// re-targets the stem gains on the next bar with a short cross-fade. The tables live in ./data/music.
import { hiss, tone, type Ctx } from './synth';
import {
  BASS, BPM, FADE_TIME_CONSTANT, FIFTH, HAT, KICK, LEAD, LEAD_FLAT_AT, LEAD_FLAT_EVERY, LEAD_PATTERN, LOWERED_FIFTH, PAD,
  PENTATONIC_RATIOS, PERC_DOUBLE_EVERY, PERC_EVERY, ROOTS, SECONDS_PER_MINUTE, STALL, STATES, STEM_GAIN, STEPS_PER_BAR,
  STEPS_PER_BEAT, THIRD_MAJOR, THIRD_MINOR, type MusicState,
} from './data/music';

export { STATES, type MusicState };
export const STEP = SECONDS_PER_MINUTE / BPM / STEPS_PER_BEAT; // a 16th note

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
    STATES[s].stems.forEach((v, i) => stems[i]!.gain.setTargetAtTime(v * STEM_GAIN, t, FADE_TIME_CONSTANT));
  };

  const schedule = (i: number, t: number): void => {
    const bar = Math.floor(i / STEPS_PER_BAR) % ROOTS.length;
    const root = ROOTS[bar]!;
    const s = STATES[applied ?? current];
    const third = s.minor ? THIRD_MINOR : THIRD_MAJOR;
    const inBar = i % STEPS_PER_BAR;
    if (inBar === 0) [1, third, FIFTH].forEach((r) => tone(c, stems[0]!, t, { f: root * PAD.octave * r, dur: STEP * STEPS_PER_BAR, g: PAD.g, a: PAD.a, type: 'triangle' }));
    if (inBar % BASS.everySteps === 0) tone(c, stems[1]!, t, { f: root, dur: STEP * BASS.lengthSteps, g: BASS.g, type: 'sine' });
    const percEvery = s.perc === 'double' ? PERC_DOUBLE_EVERY : PERC_EVERY;
    // Percussion is always scheduled; the stem gain is what silences it. 'light' keeps only off-beat hats.
    if (inBar % KICK.everySteps === 0) tone(c, stems[2]!, t, { f: KICK.f, f2: KICK.f2, dur: KICK.dur, g: KICK.g });
    if (inBar % percEvery === 0 && (s.perc !== 'light' || inBar % HAT.offBeatEvery === HAT.offBeatStep)) hiss(c, stems[2]!, t, { f: HAT.f, dur: HAT.dur, g: HAT.g, type: 'highpass' });
    if (inBar % 2 === 0) {
      const d = LEAD_PATTERN[(inBar / 2) % LEAD_PATTERN.length]!;
      const r = PENTATONIC_RATIOS[d % PENTATONIC_RATIOS.length]! * (s.minor && d % LEAD_FLAT_EVERY === LEAD_FLAT_AT ? LOWERED_FIFTH : 1);
      tone(c, stems[3]!, t, { f: root * LEAD.octave * r, dur: STEP * LEAD.lengthSteps, g: LEAD.g, type: 'triangle' });
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
