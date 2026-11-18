import { describe, expect, it } from 'vitest';
import type { EffectCause, EffectTarget } from './contracts';
import { createEffectRouter } from './effects';

const cause: EffectCause = {
  source: 1,
  team: 'dawn',
  via: 'ability',
  ability: 'test.1',
  item: null,
  values: { damage: 80 },
  songPower: 10,
  proc: false,
  origin: { x: 0, y: 0, z: 0 },
};
const target: EffectTarget = { entity: 2, point: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: 0, z: 1 } };

describe('effect router', () => {
  it('routes a kind to its one owner and ignores unhandled kinds', () => {
    const fx = createEffectRouter();
    const got: number[] = [];
    fx.handle('damage', 'combat', (e, _t, c) => got.push(fx.magnitude(e.amount, c)));
    fx.applyAll(
      [
        { kind: 'damage', amount: 'damage', type: 'song' },
        { kind: 'heal', amount: 5 },
        { kind: 'damage', amount: { of: 20, song: 0.5 }, type: 'song' },
      ],
      target,
      cause,
    );
    expect(got).toEqual([80, 25]);
  });

  it('rejects the wrong owner, a second handler and unknown value names', () => {
    const fx = createEffectRouter();
    expect(() => fx.handle('damage', 'world', () => undefined)).toThrow(/belongs to combat/);
    fx.handle('heal', 'combat', () => undefined);
    expect(() => fx.handle('heal', 'combat', () => undefined)).toThrow(/already/);
    expect(() => fx.magnitude('missing', cause)).toThrow(/unknown value/);
  });
});
