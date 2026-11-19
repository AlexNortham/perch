import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as dmath from './dmath';
import { createRng } from './rng';

// Node 22 ships fdlibm and V8's hypot, which dmath ports, so in Node the two agree bit for bit (saved hashes stay
// valid). The browser half of the promise is e2e/determinism.spec.ts.
describe('dmath', () => {
  const rng = createRng(7, 'dmath');
  const sample = (scale: number) => Array.from({ length: 20_000 }, () => (rng.next() - 0.5) * scale);

  it.each(['sin', 'cos', 'tan', 'atan'] as const)('%s equals Node Math bit for bit', (f) => {
    for (const scale of [1e-6, 2, 20, 2e5]) for (const x of sample(scale)) expect(Object.is(dmath[f](x), Math[f](x)), `${f}(${x})`).toBe(true);
  });

  it.each(['asin', 'acos'] as const)('%s equals Node Math bit for bit', (f) => {
    for (const x of [...sample(2), -1, 1, 0, -0, 1.5, NaN]) expect(Object.is(dmath[f](x), Math[f](x)), `${f}(${x})`).toBe(true);
  });

  it('atan2 and hypot equal Node Math bit for bit, including zeros, infinities and NaN', () => {
    const xs = [...sample(10), 0, -0, 1, -1, Infinity, -Infinity, NaN];
    for (let i = 0; i < xs.length - 2; i++) {
      const [a, b, c] = [xs[i] as number, xs[(i * 7) % xs.length] as number, xs[i + 2] as number];
      expect(Object.is(dmath.atan2(a, b), Math.atan2(a, b)), `atan2(${a}, ${b})`).toBe(true);
      expect(Object.is(dmath.hypot(a, b), Math.hypot(a, b)), `hypot(${a}, ${b})`).toBe(true);
      expect(Object.is(dmath.hypot(a, b, c), Math.hypot(a, b, c)), `hypot(${a}, ${b}, ${c})`).toBe(true);
    }
  });

  it('the sim calls no engine-approximated Math function outside tests', () => {
    // `x ** 2` stays: fdlibm returns x·x for it, and so must any correctly rounded pow. Other powers need a dmath port.
    const banned = /\bMath\.(sin|cos|tan|asin|acos|atan2?|sinh|cosh|tanh|asinh|acosh|atanh|exp|expm1|log|log1p|log2|log10|pow|cbrt|hypot|random)\b|[\w)\]]\s*\*\*(?!\s*2\b)/;
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
    const offenders = walk('src/sim')
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('dmath.ts'))
      .flatMap((f) => readFileSync(f, 'utf8').split('\n').map((line, i) => [f, i + 1, line] as const))
      .filter(([, , line]) => banned.test(line.replace(/\/\/.*|\/\*.*|^\s*\*.*/g, '')))
      .map(([f, n, line]) => `${f}:${n}: ${line.trim()}`);
    expect(offenders, 'use core/dmath (D-ARCH-021)').toEqual([]);
  });
});
