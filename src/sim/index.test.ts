import { describe, expect, it } from 'vitest';
import { Button, HERO_IDS, IDLE_COMMAND, Layer, RETIRED_BUTTONS, ViewFlag } from './core/contracts';
import { TICK_RATE } from './data/core';
import { PHYSICS_LAYERS } from './data/movement';
import type { HeroCommand, RosterSlot, Sim } from './core/contracts';
import { allBotRoster, createSim, humanRoster } from './index';
import { loadMap } from './world/map';

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

  it('practiceStart puts the Practice Hub player there, facing its yaw; the training targets stay (D-ARCH-026)', async () => {
    const roster: RosterSlot[] = [
      { team: 'dawn', hero: 'swan', controller: 'human' },
      { team: 'dusk', hero: 'shrike', controller: 'dummy' },
    ];
    const options = { practiceHub: true, waves: false, neutrals: false, structures: false };
    const practiceStart = { pos: { x: 5, y: 0, z: 7 }, yaw: 1 };
    const plain = await createSim({ seed: 1, map: 'arena', roster, options });
    const moved = await createSim({ seed: 1, map: 'arena', roster, options: { ...options, practiceStart } });
    moved.step([]);
    const [me, dummy] = moved.ctx.store.list('hero');
    expect([me?.pos.x, me?.pos.z, me?.yaw]).toEqual([5, 7, 1]);
    expect(dummy?.pos).toEqual(plain.ctx.store.list('hero')[1]?.pos);
    await expect(createSim({ seed: 1, map: 'arena', roster, options: { practiceStart } })).rejects.toThrow(/practiceHub/);
    const turned = await createSim({ seed: 1, map: 'arena', roster, options: { ...options, practiceStart: { ...practiceStart, yaw: 1 + 4 * Math.PI } } });
    expect(turned.ctx.store.list('hero')[0]?.yaw).toBeCloseTo(1);
    const nan = { ...practiceStart, yaw: Number.NaN };
    await expect(createSim({ seed: 1, map: 'arena', roster, options: { ...options, practiceStart: nan } })).rejects.toThrow(/finite/);
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
    // D-ARCH-025: retired and unknown bits never reach a system; live ones pass.
    const junk = RETIRED_BUTTONS.Interact | 0x4000_0000;
    sim.step([{ hero: id, command: { ...IDLE_COMMAND, held: junk | Button.Jump, pressed: junk | Button.Fire } }]);
    expect([h.command.held, h.command.pressed]).toEqual([Button.Jump, Button.Fire]);
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

  it('keeps the local hero in its own view every tick, dead or alive (W6 EP stability check)', async () => {
    const sim = await createSim({ seed: 5, map: 'arena', roster: humanRoster(5, 'kingfisher', { bots: 1 }) });
    const me = sim.view.localHero!;
    const inView = (): boolean => sim.view.entities.some((e) => e.id === me) && sim.view.heroes.some((h) => h.id === me);
    expect(inView()).toBe(true);
    const hero = sim.ctx.store.getKind(me, 'hero')!;
    const cause = { source: null, team: 'neutral' as const, via: 'objective' as const, ability: null, item: null, values: null, songPower: 0,
      proc: false, origin: { ...hero.pos } };
    sim.ctx.effects.apply({ kind: 'damage', amount: 1e6, type: 'talon' }, { entity: me, point: { ...hero.pos }, dir: { x: 0, y: 0, z: 1 } }, cause);
    let died = false;
    for (let i = 0; i < 60 * TICK_RATE && !(died && !hero.health.dead); i++) {
      sim.step();
      died ||= hero.health.dead;
      expect(inView(), `tick ${sim.tick}, dead ${hero.health.dead}`).toBe(true);
    }
    expect(died && !hero.health.dead, 'died and respawned').toBe(true);
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

describe('contracts', () => {
  it('Layer owns the physics-only bits; data/movement still mirrors them until Physics points at Layer (D-ARCH-027)', () => {
    expect(PHYSICS_LAYERS).toEqual({ sight: Layer.Sight, movement: Layer.Movement, eggCarrier: Layer.EggCarrier });
  });

  it('MapData carries the dressing, one BuildingDress per Building (D-ARCH-028)', () => {
    const main = loadMap('main');
    expect(main.dressing?.buildings.length).toBe(main.buildings?.length);
    expect(main.dressing?.props.length).toBeGreaterThan(0);
    expect(loadMap('arena').dressing).toBeUndefined();
  });
});

describe('concession', () => {
  it('ends the match for the other flock only from 15:00', async () => {
    // The human alone: concession needs no opponent, and a bot's 15 minutes of AI quadrupled the run (it hit 5 s under load).
    const sim = await createSim({ seed: 9, map: 'arena', roster: humanRoster(9, 'owl', { bots: 0 }) });
    const hero = sim.view.localHero as number;
    sim.step([{ hero, command: { ...IDLE_COMMAND, concede: true } }]);
    expect(sim.isOver).toBe(false);
    // sim.tick, not sim.view: a view is built on each read after a step, and 54,000 of them pushed this past 5 s.
    while (sim.tick < 15 * 60 * TICK_RATE) sim.step();
    sim.step([{ hero, command: { ...IDLE_COMMAND, concede: true } }]);
    expect(sim.winner).toBe('dusk');
    const tick = sim.tick;
    sim.step();
    expect(sim.tick).toBe(tick);
    expect(sim.telemetry().winner).toBe('dusk');
  });
});
