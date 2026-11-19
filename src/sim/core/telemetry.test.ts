import { describe, expect, it } from 'vitest';
import { TELEMETRY_SAMPLE_SECONDS, TICK_RATE } from '../data/core';
import { createSim } from '../index';

describe('telemetry', () => {
  it('records picks, kills, assists, items and objectives from events', async () => {
    const sim = await createSim({
      seed: 5,
      map: 'arena',
      roster: [
        { team: 'dawn', hero: 'shrike', controller: 'normal' },
        { team: 'dusk', hero: 'owl', controller: 'normal' },
        { team: 'dawn', hero: 'kiwi', controller: 'normal' },
      ],
    });
    const [shrike, owl, kiwi] = sim.view.heroes.map((h) => h.id) as [number, number, number];
    const bus = sim.ctx.bus;
    const pos = { x: 0, y: 0, z: 0 };
    bus.emit({
      type: 'entity.died',
      victim: owl,
      victimKind: 'hero',
      victimTeam: 'dusk',
      victimType: 'owl',
      killer: shrike,
      creditHero: shrike,
      assisters: [kiwi],
      via: 'weapon',
      pos,
    });
    bus.emit({ type: 'item.bought', hero: kiwi, item: 'talon.1', cost: 800 });
    bus.emit({
      type: 'entity.died',
      victim: 99,
      victimKind: 'structure',
      victimTeam: 'dusk',
      victimType: 'hawk',
      killer: shrike,
      creditHero: shrike,
      assisters: [],
      via: 'weapon',
      pos,
    });
    for (let i = 0; i < TELEMETRY_SAMPLE_SECONDS * TICK_RATE; i++) sim.step();

    const t = sim.telemetry();
    expect(t.heroes.map((h) => h.heroId)).toEqual(['shrike', 'owl', 'kiwi']);
    expect(t.heroes[0]).toMatchObject({ kills: 1, deaths: 0 });
    expect(t.heroes[1]).toMatchObject({ deaths: 1 });
    expect(t.heroes[2]).toMatchObject({ assists: 1, itemsBought: [{ s: 0, item: 'talon.1' }] });
    expect(t.teams.dawn.kills).toBe(1);
    expect(t.objectives).toEqual([{ s: 0, what: 'hawk', team: 'dusk', hero: 'shrike' }]);
    expect(t.heroes[0]?.netWorthCurve.length).toBe(2);
    expect(sim.view.heroes[0]?.kills).toBe(1);
  });

  it('counts beak shots only among gun hits on heroes', async () => {
    const sim = await createSim({
      seed: 5,
      map: 'arena',
      roster: [
        { team: 'dawn', hero: 'shrike', controller: 'normal' },
        { team: 'dusk', hero: 'owl', controller: 'normal' },
      ],
    });
    const [shrike, owl] = sim.view.heroes.map((h) => h.id) as [number, number];
    const hit = { type: 'damage.applied', source: shrike, sourceTeam: 'dawn', target: owl, targetKind: 'hero',
      amount: 10, absorbed: 0, damageType: 'talon', via: 'weapon', ability: null, item: null, beakShot: true,
      weakPoint: false, proc: false, lethal: false, pos: { x: 0, y: 0, z: 0 } } as const;
    sim.ctx.bus.emit(hit);
    sim.ctx.bus.emit({ ...hit, beakShot: false });
    sim.ctx.bus.emit({ ...hit, target: 99, targetKind: 'unit' });
    sim.ctx.bus.emit({ ...hit, via: 'ability', damageType: 'song' });
    expect(sim.telemetry().heroes[0]).toMatchObject({ gunHits: 2, beakShots: 1 });
  });
});
