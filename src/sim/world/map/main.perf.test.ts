/** The main map's build time budget (D-EP-022): serial, in `npm run perf`, median of PERF_RUNS builds. */
import { describe, expect, it } from 'vitest';
import { PERF_RUNS } from '../../../../tests/helpers/perf';
import { buildMap } from './build';
import { MAIN_SPEC } from './data/main';
import { loadMap } from './index';

const map = loadMap('main');
const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] as number;

describe("loadMap('main')", () => {
  it('builds fast: 100 ms for the map, 250 ms for the nav graph', () => {
    // eslint-disable-next-line no-restricted-properties -- a test timing a load budget, not sim logic
    const now = () => performance.now();
    const build: number[] = [];
    const nav: number[] = [];
    for (let i = 0; i < PERF_RUNS; i++) {
      const t0 = now();
      const fresh = buildMap(MAIN_SPEC);
      const t1 = now();
      expect(fresh.nav.nodes.length).toBe(map.nav.nodes.length);
      const t2 = now();
      build.push(t1 - t0);
      nav.push(t2 - t1);
    }
    expect(median(build)).toBeLessThan(100);
    expect(median(nav)).toBeLessThan(250);
  });
});
