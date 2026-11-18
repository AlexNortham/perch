import { describe, expect, it } from 'vitest';
import { Button, HERO_IDS, IDLE_COMMAND } from './core/contracts';
import type { HeroCommand, Sim } from './core/contracts';
import { allBotRoster, createSim, humanRoster } from './index';

async function run(seed: number, ticks: number, drive?: (sim: Sim) => HeroCommand[]): Promise<Sim> {
  const sim = await createSim({ seed, roster: allBotRoster(seed) });
  for (let i = 0; i < ticks; i++) sim.step(drive?.(sim) ?? []);
  return sim;
}

describe('createSim', () => {
  it('is deterministic: same seed and commands give the same hash', async () => {
    const drive = (sim: Sim): HeroCommand[] => [
      { hero: 1, command: { ...IDLE_COMMAND, yaw: sim.tick * 0.01, pressed: sim.tick % 50 === 0 ? Button.ShoulderSwap : 0 } },
    ];
    const a = await run(1, 600, drive);
    const b = await run(1, 600, drive);
    expect(a.hash()).toBe(b.hash());
    expect(a.hash()).not.toBe((await run(2, 600, drive)).hash());
  });

  it('picks 12 distinct heroes, six per team, seeded', () => {
    const roster = allBotRoster(7);
    expect(new Set(roster.map((r) => r.hero)).size).toBe(12);
    expect(roster.filter((r) => r.team === 'dawn').length).toBe(6);
    expect(roster.every((r) => HERO_IDS.includes(r.hero) && r.controller === 'normal')).toBe(true);
    expect(allBotRoster(7)).toEqual(roster);
    expect(allBotRoster(8)).not.toEqual(roster);
    const withHuman = humanRoster(7, 'kiwi');
    expect(withHuman[0]).toEqual({ team: 'dawn', hero: 'kiwi', controller: 'human' });
    expect(new Set(withHuman.map((r) => r.hero)).size).toBe(12);
    expect(() => allBotRoster(1, 13)).toThrow();
    const dusk = humanRoster(7, 'kiwi', { team: 'dusk', difficulty: 'mixed' });
    expect(dusk.filter((r) => r.team === 'dusk').length).toBe(6);
    const allies = dusk.filter((r) => r.team === 'dusk' && r.controller !== 'human');
    expect(allies.every((r) => r.controller === 'normal')).toBe(true);
  });

  it('rejects bad rosters', async () => {
    await expect(
      createSim({
        seed: 1,
        roster: [
          { team: 'dawn', hero: 'owl', controller: 'easy' },
          { team: 'dusk', hero: 'owl', controller: 'easy' },
        ],
      }),
    ).rejects.toThrow(/twice/);
    await expect(createSim({ seed: 1.5, roster: [] })).rejects.toThrow(/integer/);
  });

  it('latches commands: look, shoulder swap, one-shot fields cleared when not refreshed', async () => {
    const sim = await createSim({ seed: 3, map: 'arena', roster: humanRoster(3, 'swan', { bots: 1 }) });
    const me = sim.view.localHero;
    expect(me).not.toBeNull();
    const id = me as number;
    const cmd = { ...IDLE_COMMAND, yaw: 1, pitch: 99, pressed: Button.ShoulderSwap | Button.Fire };
    sim.step([{ hero: id, command: cmd }]);
    const h = sim.view.heroes[0];
    expect(h?.shoulder).toBe(-1);
    expect(sim.view.entities.find((e) => e.id === id)?.yaw).toBe(1);
    sim.step();
    const hero = sim.ctx.store.getKind(id, 'hero');
    expect(hero?.command.pressed).toBe(0);
    expect(hero?.command.yaw).toBe(1);
    expect(sim.view.heroes[0]?.shoulder).toBe(-1);
  });

  it('gives the client a snapshot view and the last step\'s events', async () => {
    const sim = await createSim({ seed: 4, map: 'arena', roster: humanRoster(4, 'owl', { bots: 0 }) });
    expect(sim.drainEvents().map((e) => e.type)).toEqual(['entity.spawned', 'match.started']);
    const before = sim.view;
    const pos = { x: 5, y: 0, z: 5 };
    const ping = { kind: 'danger' as const, pos, target: null };
    sim.step([{ hero: 1, command: { ...IDLE_COMMAND, ping } }]);
    expect(sim.drainEvents()).toEqual([{ type: 'ping', by: 1, team: 'dawn', ...ping }]);
    expect(sim.drainEvents()).toEqual([]);
    let pings = 1;
    for (let i = 0; i < 10; i++) {
      sim.step([{ hero: 1, command: { ...IDLE_COMMAND, ping } }]);
      pings += sim.drainEvents().length;
    }
    expect(pings).toBe(3);
    expect(before.tick).toBe(0);
    expect(sim.view.tick).toBe(11);
    expect(sim.view).toBe(sim.view);
  });
});

describe('concession', () => {
  it('ends the match for the other flock only from 15:00', async () => {
    const sim = await createSim({ seed: 9, map: 'arena', roster: humanRoster(9, 'owl', { bots: 1 }) });
    const hero = sim.view.localHero as number;
    sim.step([{ hero, command: { ...IDLE_COMMAND, concede: true } }]);
    expect(sim.isOver).toBe(false);
    while (sim.view.seconds < 15 * 60) sim.step();
    sim.step([{ hero, command: { ...IDLE_COMMAND, concede: true } }]);
    expect(sim.winner).toBe('dusk');
    const tick = sim.tick;
    sim.step();
    expect(sim.tick).toBe(tick);
    expect(sim.telemetry().winner).toBe('dusk');
  });
});
