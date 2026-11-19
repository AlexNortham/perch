import { describe, expect, it } from 'vitest';
import { Button, HERO_IDS, IDLE_COMMAND, ViewFlag } from './core/contracts';
import type { HeroCommand, Sim } from './core/contracts';
import { allBotRoster, createSim, humanRoster } from './index';

async function run(seed: number, ticks: number, drive?: (sim: Sim) => HeroCommand[]): Promise<Sim> {
  const sim = await createSim({ seed, roster: allBotRoster(seed) });
  for (let i = 0; i < ticks; i++) sim.step(drive?.(sim) ?? []);
  return sim;
}

describe('createSim', () => {
  // Three 12-bot sims of 600 ticks: 0.8 s alone, but 5.5 s in a parallel `npm test` beside browser work, so 20 s.
  it('is deterministic: same seed and commands give the same hash', { timeout: 20_000 }, async () => {
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

  it('keeps presses from a command object reused every tick, and repeats no presses when not refreshed', async () => {
    const sim = await createSim({ seed: 3, map: 'arena', roster: humanRoster(3, 'swan', { bots: 0 }) });
    const id = sim.view.localHero as number;
    const reused = { ...IDLE_COMMAND, pressed: Button.ShoulderSwap };
    sim.step([{ hero: id, command: reused }]);
    sim.step([{ hero: id, command: reused }]);
    expect(sim.view.heroes[0]?.shoulder).toBe(1);
    // A bot that assigns its own reused object during the ai phase is the same case as above: not core's latch.
    const h = sim.ctx.store.getKind(id, 'hero');
    if (!h) throw new Error('no hero');
    h.command = reused;
    sim.step();
    expect(sim.view.heroes[0]?.shoulder).toBe(-1);
    sim.step();
    expect(h.command.pressed).toBe(0);
    expect(sim.view.heroes[0]?.shoulder).toBe(-1);
  });

  it('sanitises commands: NaN and out-of-range look and axes never reach the sim', async () => {
    const sim = await createSim({ seed: 3, map: 'arena', roster: humanRoster(3, 'swan', { bots: 0 }) });
    const id = sim.view.localHero as number;
    const h = sim.ctx.store.getKind(id, 'hero');
    if (!h) throw new Error('no hero');
    sim.step([{ hero: id, command: { ...IDLE_COMMAND, yaw: 0.5, pitch: 0.25 } }]);
    const bad = { ...IDLE_COMMAND, yaw: Number.NaN, pitch: Infinity, right: 7, forward: Number.NaN, upgrade: 9 };
    sim.step([{ hero: id, command: bad }]);
    expect([h.yaw, h.pitch, h.command.right, h.command.forward, h.command.upgrade]).toEqual([0.5, 0.25, 1, 0, null]);
    sim.step([{ hero: id, command: { ...IDLE_COMMAND, yaw: 4.5 * Math.PI, pitch: -9 } }]);
    expect(h.yaw).toBeCloseTo(0.5 * Math.PI);
    expect(h.pitch).toBeCloseTo((-80 * Math.PI) / 180);
    const ping = { kind: 'danger' as const, pos: { x: Number.NaN, y: 0, z: 0 }, target: null };
    sim.drainEvents();
    sim.step([{ hero: id, command: { ...IDLE_COMMAND, ping } }]);
    expect(sim.drainEvents().filter((e) => e.type === 'ping')).toEqual([]);
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

  it('projects castSlot, variants, camps, the Roc flags and detached objective timers (W4.5)', async () => {
    const sim = await createSim({ seed: 4, map: 'arena', roster: humanRoster(4, 'owl', { bots: 0 }) });
    const h = sim.ctx.store.getKind(1, 'hero');
    if (!h) throw new Error('no hero');
    h.abilities.casting = 2;
    h.motor.updraftInReach = 0;
    h.keepsakes = { count: 2, totals: { maxHealth: 30 } };
    const roc = sim.ctx.store.spawn({
      kind: 'unit', team: 'neutral', pos: { x: 0, y: 0, z: 9 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, radius: 2,
      unit: { type: 'roc', lane: null, height: 9, owner: null, summon: null, target: null, attacking: false, camp: 3, asleep: true, enraged: true },
      health: { hp: 1, talonShield: 0, songShield: 0, barrier: 0, dead: false, respawnAt: null, inCombatUntil: 0 },
      stats: sim.ctx.stats.create({}), statuses: [],
    });
    sim.ctx.objectives.campAt = [null, 600];
    sim.step();
    const v = sim.view;
    const rocView = v.entities.find((e) => e.id === roc.id);
    expect(v.entities.find((e) => e.id === 1)?.castSlot).toBe(2);
    expect(rocView?.camp).toBe(3);
    expect((rocView?.flags ?? 0) & (ViewFlag.Asleep | ViewFlag.Enraged)).toBe(ViewFlag.Asleep | ViewFlag.Enraged);
    expect(v.objectives.campAt).toEqual([null, 600]);
    sim.ctx.objectives.campAt[0] = 900;
    expect(v.objectives.campAt).toEqual([null, 600]);
    expect(v.heroes[0]).toMatchObject({ updraftInReach: true, keepsakes: { count: 2, totals: { maxHealth: 30 } } });
    h.keepsakes.totals.maxHealth = 45;
    expect(v.heroes[0]?.keepsakes?.totals.maxHealth).toBe(30);
  });
});

describe('concession', () => {
  it('ends the match for the other flock only from 15:00', async () => {
    // The human alone: concession needs no opponent, and a bot's 15 minutes of AI quadrupled the run (it hit 5 s under load).
    const sim = await createSim({ seed: 9, map: 'arena', roster: humanRoster(9, 'owl', { bots: 0 }) });
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
