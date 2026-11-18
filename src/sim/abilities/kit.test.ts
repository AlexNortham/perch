/**
 * The kit validator over every hero in the registry. Hero Engineers: `npx vitest run src/sim/abilities/kit.test.ts`
 * after editing src/sim/data/heroes/<id>.ts; a failure lists each problem as `<hero>/<ability>: <what>`.
 */
import { describe, expect, it } from 'vitest';
import { HERO_IDS } from '../core/contracts';
import type { Effect, HeroModule } from '../core/contracts';
import { HEROES } from '../heroes/registry';
import { resolveAbility, validateKit, walkEffects } from './kit';
import { ability, kit } from './testkit';

describe('validateKit', () => {
  it.each(HERO_IDS)('%s has a valid kit', (id) => {
    expect(validateKit(HEROES[id])).toEqual([]);
  });

  it('reports unknown kinds, unknown value names, bad tiers and missing hooks', () => {
    const nested: Effect = {
      kind: 'area',
      shape: { kind: 'sphere', radius: 'radius' },
      durationS: 0,
      attach: 'point',
      affects: { teams: 'enemies' },
      effects: [{ kind: 'damage', amount: { of: 'missing', song: 1 }, type: 'song' }, { kind: 'zap' } as unknown as Effect],
    };
    const bad: HeroModule = kit([
      ability({ id: 'a', values: { radius: 3 }, effects: [nested, { kind: 'hook', name: 'x' }] }),
      ability({ id: 'b', targeting: 'unit', cooldownS: 2, upgrades: [{ description: '', cooldownS: -3 }, { description: '', values: { nope: 1 } }, { description: '' }] }),
      ability({ id: 'c', channelEffects: [{ kind: 'heal', amount: 1 }], upgrades: [{ description: '' }, { description: '' }] as never }),
      ability({ id: 'c', effects: [{ kind: 'cooldownMod', scope: 'slot', slot: 4, mode: 'reset' }, { kind: 'tether', durationS: 1, breakDistance: 0 }] }),
    ]);
    expect(validateKit(bad)).toEqual([
      "shrike/a: damage uses unknown value 'missing'",
      "shrike/a: unknown effect kind 'zap'",
      'shrike/a: uses a hook but the hero module has no `hooks`',
      "shrike/b: 'unit' targeting needs `affects`",
      'shrike/b: cooldown -1 s at tier 1',
      'shrike/b: cooldown -1 s at tier 2',
      'shrike/b: cooldown -1 s at tier 3',
      "shrike/b: tier 2 adds to unknown value 'nope'",
      'shrike/c: 2 upgrade tiers, want 3',
      'shrike/c: channelEffects need channelS > 0 and channelIntervalS > 0',
      'shrike/c: duplicate ability id',
      'shrike/c: cooldownMod slot 4 is not 0–3',
      'shrike/c: tether breakDistance must be > 0',
    ]);
  });
});

describe('resolveAbility', () => {
  const a = ability({
    values: { dmg: 10, r: 0 },
    range: 20,
    charges: 1,
    upgrades: [
      { description: '', values: { dmg: 5 } },
      { description: '', cooldownS: -4, range: 5, values: { r: 4 } },
      { description: '', charges: 1, effects: [{ kind: 'heal', amount: 1 }] },
    ],
  });

  it('folds in the bought tiers', () => {
    expect(resolveAbility(a, 0)).toMatchObject({ values: { dmg: 10, r: 0 }, cooldownS: 10, range: 20, charges: 1 });
    expect(resolveAbility(a, 2)).toMatchObject({ values: { dmg: 15, r: 4 }, cooldownS: 6, range: 25, charges: 1 });
    const t3 = resolveAbility(a, 3);
    expect([t3.charges, t3.effects.map((e) => e.kind)]).toEqual([2, ['statMod', 'heal']]);
    expect(a.values).toEqual({ dmg: 10, r: 0 });
  });

  it('marks abilities that move the caster', () => {
    expect(resolveAbility(a, 3).movement).toBe(false);
    expect(resolveAbility(ability({ effects: [{ kind: 'teleport', to: 'point', face: 'keep' }] }), 0).movement).toBe(true);
  });

  it('walkEffects visits nested effects depth first', () => {
    const kinds: string[] = [];
    walkEffects(
      [{ kind: 'delay', seconds: 1, effects: [{ kind: 'projectile', speed: 1, radius: 1, range: 1, gravity: 0, pierce: 'none', affects: { teams: 'enemies' }, onHit: [{ kind: 'heal', amount: 1 }] }] }],
      (e) => kinds.push(e.kind),
    );
    expect(kinds).toEqual(['delay', 'projectile', 'heal']);
  });
});
