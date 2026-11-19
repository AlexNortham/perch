/**
 * The wave 5a framework gaps, end to end in a real sim (items' triggers, combat, physics): the data shapes the hero
 * and item owners switch their stand-ins to. Each test applies the shape as the kit's data would.
 */
import { describe, expect, it } from 'vitest';
import { createSandbox } from '../../../tests/helpers/sandbox';
import { Button } from '../core/contracts';
import type { EntityId, StatusDef } from '../core/contracts';
import { COMBAT } from '../data/combat';
import { TICK_RATE } from '../data/core';

describe('wave 5a framework gaps (data shapes)', () => {
  it("Bristle: a 'damaged' trigger within 15 m returning triggerPct 0.2 as Song (before the holder's resists)", async () => {
    const sb = await createSandbox({ heroes: [{ hero: 'cassowary', at: { x: 0, y: 0, z: 0 } }, { hero: 'pelican', at: { x: 0, y: 0, z: 10 } }] });
    const [me, foe] = sb.heroes as [EntityId, EntityId];
    sb.modify(me, 'armour', { stats: [{ stat: 'talonResist', op: 'stack', value: 0.5 }] });
    sb.apply(
      {
        kind: 'trigger',
        durationS: 5,
        trigger: {
          on: 'damaged', heroesOnly: true, withinM: 15, chance: 1, cooldownS: 0, target: 'other',
          effects: [{ kind: 'damage', amount: 0, type: 'song', triggerPct: 0.2 }],
        },
      },
      me,
      sb.cause(me, { ability: 'cassowary.bristle' }),
    );
    sb.step();
    sb.clearEvents();
    sb.apply({ kind: 'damage', amount: 100, type: 'talon' }, me, sb.cause(foe, { via: 'weapon' }));
    sb.step(2);
    const back = sb.eventsOf('damage.applied').filter((e) => e.target === foe);
    expect(back).toHaveLength(1);
    expect(back[0]?.amount).toBeCloseTo(20 * (1 - sb.hero(foe).stats.final.songResist), 6);
  });

  it('Crescendo and Echo Chamber: a repeat of the hit is resisted once, at once or 1 s later through a status', async () => {
    const sb = await createSandbox({ heroes: [{ hero: 'shrike', at: { x: 0, y: 0, z: 0 } }, { hero: 'pelican', at: { x: 0, y: 0, z: 10 } }] });
    const [me, foe] = sb.heroes as [EntityId, EntityId];
    sb.modify(foe, 'resist', { stats: [{ stat: 'songResist', op: 'stack', value: 0.4 }] });
    const echo: StatusDef = {
      id: 'echo-chamber.echo', name: 'Echo', negative: false, stacking: 'independent', maxStacks: 1, durationS: 1,
      onExpire: [{ kind: 'damage', amount: 0, type: 'song', triggerPct: 0.25 }],
    };
    sb.ctx.bus.on('damage.applied', (e) => {
      if (e.proc || e.target !== foe) return;
      const target = { entity: foe, point: { ...e.pos }, dir: { x: 0, y: 0, z: 1 } };
      const cause = sb.cause(me, { via: 'item', proc: true });
      sb.ctx.effects.apply({ kind: 'damage', amount: 0, type: 'song', triggerPct: 0.2 }, target, cause);
      sb.ctx.effects.apply({ kind: 'applyStatus', status: echo }, target, cause);
    });
    sb.apply({ kind: 'damage', amount: 200, type: 'song' }, foe, sb.cause(me));
    sb.step(TICK_RATE + 2);
    const dealt = sb.eventsOf('damage.applied').filter((e) => e.target === foe).map((e) => e.amount);
    const first = 200 * (1 - sb.hero(foe).stats.final.songResist);
    expect(dealt).toHaveLength(3);
    expect(dealt[0]).toBeCloseTo(first, 6);
    expect(dealt[1]).toBeCloseTo(first * 0.2, 6);
    expect(dealt[2]).toBeCloseTo(first * 0.25, 6);
  });

  it("Drumroll: a statMod with id COMBAT.fullSpinStatus fires at the full 14/s from the first shot", async () => {
    const count = async (spun: boolean): Promise<number> => {
      const sb = await createSandbox({ heroes: [{ hero: 'woodpecker', at: { x: 0, y: 0, z: 0 } }] });
      const me = sb.heroes[0] as EntityId;
      if (spun) {
        sb.apply({ kind: 'statMod', id: COMBAT.fullSpinStatus, name: 'Drumroll', stats: [{ stat: 'fireRate', op: 'add', value: 0.2 }], durationS: 6 }, me, sb.cause(me));
        sb.step();
      }
      sb.hold(me, Button.Fire);
      sb.step(TICK_RATE / 2);
      return sb.eventsOf('weapon.fired').filter((e) => e.shooter === me).length;
    };
    expect(await count(false), 'spinning up from 6/s').toBeLessThanOrEqual(5);
    expect(Math.abs((await count(true)) - 14 * 1.2 * 0.5)).toBeLessThanOrEqual(1);
  });
});
