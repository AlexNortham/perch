import { describe, expect, it } from 'vitest';
import { createHasher } from './hash';

const digest = (v: unknown): string => {
  const h = createHasher();
  h.value(v);
  return h.digest();
};

describe('state hash', () => {
  it('is stable and ignores object key order', () => {
    expect(digest({ a: 1, b: [2, 3] })).toBe(digest({ b: [2, 3], a: 1 }));
    expect(digest({ a: 1, b: [2, 3] })).toMatch(/^[0-9a-f]{16}$/);
  });

  it('sees the smallest float change and structural differences', () => {
    expect(digest({ x: 0.1 + 0.2 })).not.toBe(digest({ x: 0.3 }));
    expect(digest([1, 2])).not.toBe(digest({ 0: 1, 1: 2 }));
    expect(digest(new Map([['a', 1]]))).not.toBe(digest(new Set(['a', 1])));
    expect(digest({ a: undefined })).not.toBe(digest({ a: null }));
  });
});
