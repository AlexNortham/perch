/** Timing tests (`*.perf.test.ts`, run serially by `npm run perf`, D-EP-022): take the median of several runs. */

/** Runs per timing test. */
export const PERF_RUNS = 5;

/** Run `fn` `runs` times and return the run whose `ms` is the median (an odd `runs` gives an actual run). */
export function medianRun<T>(runs: number, fn: () => T, ms: (r: T) => number): T {
  const all = Array.from({ length: runs }, fn).sort((a, b) => ms(a) - ms(b));
  return all[Math.floor(runs / 2)] as T;
}
