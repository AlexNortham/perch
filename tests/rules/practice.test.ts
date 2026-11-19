import { describe, expect, it } from 'vitest';
import { TICK_RATE } from '../../src/sim/data/core';
import { createSandbox } from '../helpers/sandbox';

const MAX_RESET_TICKS = 15 * TICK_RATE;

const practice = () => createSandbox({
  heroes: ['lyrebird', { hero: 'shrike', team: 'dawn', controller: 'dummy' }, { hero: 'albatross', controller: 'dummy' }],
  options: { practiceHub: true, unlockAbilities: true },
});

it('§12.12 Practice starts with four base skills and 32 AP, and a fresh siege has earned progression', async () => {
  const sb = await practice();
  const user = sb.heroes[0]!;
  expect(sb.hero(user).abilities.ap).toBe(32);
  expect(sb.hero(user).abilities.slots.map((s) => [s.unlocked, s.tier])).toEqual(Array(4).fill([true, 0]));
  sb.upgrade(user, 0);
  sb.step(2);
  expect(sb.hero(user).abilities.ap).toBe(31);
  expect(sb.eventsOf('ability.upgraded').filter((e) => e.hero === user && e.slot === 0 && e.tier === 1)).toHaveLength(1);

  const match = await createSandbox({
    map: 'main', heroes: ['lyrebird'], options: { structures: true, unlockAbilities: false },
  });
  const fresh = match.hero(match.heroes[0]!);
  expect(fresh.progress).toMatchObject({ level: 1, netWorth: 0 });
  expect(fresh.abilities.ap).toBe(0);
  expect(fresh.abilities.slots.map((s) => s.unlocked)).toEqual([true, true, true, false]);
});

describe('W4 Practice target reset', () => {
  it('§12.12 the enemy takes real weapon damage again after returning to its mark at full health', async () => {
    const sb = await practice();
    const [user, , enemy] = sb.heroes as [number, number, number];
    const start = sb.hero(enemy).hero.training!;
    expect(sb.health(enemy).hp).toBe(sb.hero(enemy).stats.final.maxHealth);
    for (let attempt = 0; attempt < 2; attempt++) {
      sb.clearEvents();
      sb.place(enemy, { ...start.pos, x: start.pos.x + 2 });
      sb.aimAt(user, enemy);
      sb.fire(user);
      expect(sb.stepUntil(() => sb.health(enemy).hp < start.hp, TICK_RATE)).not.toBeNull();
      sb.fire(user, false);
      expect(sb.eventsOf('damage.applied')).toContainEqual(expect.objectContaining({ source: user, target: enemy, via: 'weapon' }));
      expect(sb.stepUntil(() => Math.abs(sb.health(enemy).hp - start.hp) < 0.01, MAX_RESET_TICKS), 'damaged enemy resets').not.toBeNull();
      expect(sb.hero(enemy).pos.x).toBeCloseTo(start.pos.x, 1);
    }
  });

  it('§12.12 the ally takes a real Mended Song heal again after returning to its mark at 40% HP', async () => {
    const sb = await practice();
    const [user, ally] = sb.heroes as [number, number];
    const start = sb.hero(ally).hero.training!;
    expect(sb.health(ally).hp).toBeCloseTo(sb.hero(ally).stats.final.maxHealth * 0.4);
    for (let attempt = 0; attempt < 2; attempt++) {
      sb.clearEvents();
      sb.place(ally, { ...start.pos, x: start.pos.x - 2 });
      sb.cast(user, 0, ally);
      expect(sb.stepUntil(() => sb.health(ally).hp > start.hp, TICK_RATE)).not.toBeNull();
      expect(sb.eventsOf('heal.applied')).toContainEqual(expect.objectContaining({ source: user, target: ally }));
      expect(sb.stepUntil(() => Math.abs(sb.health(ally).hp - start.hp) < 0.01, MAX_RESET_TICKS), 'healed ally resets').not.toBeNull();
      expect(sb.hero(ally).pos.x).toBeCloseTo(start.pos.x, 1);
    }
  });
});
