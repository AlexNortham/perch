import { describe, expect, it } from 'vitest';
import { createRng, createRngStreams } from './rng';

describe('rng', () => {
  it('repeats a sequence for the same seed and name', () => {
    const a = createRng(42, 'combat');
    const b = createRng(42, 'combat');
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('differs between names and seeds', () => {
    expect(createRng(42, 'combat').next()).not.toBe(createRng(42, 'ai').next());
    expect(createRng(42, 'combat').next()).not.toBe(createRng(43, 'combat').next());
  });

  it('keeps streams independent of each other', () => {
    const quiet = createRngStreams(7);
    const busy = createRngStreams(7);
    for (let i = 0; i < 1000; i++) busy.stream('ai').next();
    expect(busy.stream('combat').next()).toBe(quiet.stream('combat').next());
  });

  it('stays in range and is roughly uniform', () => {
    const r = createRng(1, 'test');
    const buckets = [0, 0, 0, 0];
    for (let i = 0; i < 40_000; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const b = Math.floor(x * 4);
      buckets[b] = (buckets[b] ?? 0) + 1;
    }
    for (const b of buckets) expect(Math.abs(b - 10_000)).toBeLessThan(500);
    for (let i = 0; i < 1000; i++) expect([3, 4, 5]).toContain(r.int(3, 5));
  });

  it('shuffles to a permutation and lists stream states sorted by name', () => {
    const s = createRngStreams(3);
    expect([...s.stream('z').shuffle([1, 2, 3, 4, 5])].sort()).toEqual([1, 2, 3, 4, 5]);
    s.stream('a');
    expect(s.states().map(([name]) => name)).toEqual(['a', 'z']);
  });
});
