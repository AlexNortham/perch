import { describe, expect, it } from 'vitest';
import type { SimEvent } from './contracts';
import { createBus } from './events';
import { createStatService } from './stats';
import { createStore } from './store';

function setup() {
  const store = createStore(createBus<SimEvent>().emit);
  const stats = createStatService(store);
  const unit = store.spawn({
    kind: 'unit',
    team: 'dawn',
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    yaw: 0,
    radius: 0.5,
    unit: {
      type: 'scrapper',
      lane: 'riverbank',
      height: 0.9,
      owner: null,
      summon: null,
      target: null,
      attacking: false,
    },
    health: { hp: 100, talonShield: 0, songShield: 0, barrier: 0, dead: false, respawnAt: null, inCombatUntil: 0 },
    stats: stats.create({ maxHealth: 100, talonResist: 0.2 }),
    statuses: [],
  });
  return { stats, unit };
}

describe('stat model', () => {
  it('uses base values and defaults', () => {
    const { stats, unit } = setup();
    expect(stats.get(unit.id, 'maxHealth')).toBe(100);
    expect(stats.get(unit.id, 'damageTaken')).toBe(1);
    expect(stats.get(unit.id, 'songPower')).toBe(0);
    expect(stats.get(999, 'damageTaken')).toBe(1);
  });

  it('stacks add, then pct, then mul, then strongest-only max, then diminishing stack', () => {
    const { stats, unit } = setup();
    stats.set(unit.id, 'items:1', { stats: [{ stat: 'maxHealth', op: 'add', value: 50 }] });
    stats.set(unit.id, 'items:2', { stats: [{ stat: 'maxHealth', op: 'pct', value: 0.1 }] });
    stats.set(unit.id, 'status:x', { stats: [{ stat: 'maxHealth', op: 'pct', value: 0.1 }] });
    stats.set(unit.id, 'status:y', { stats: [{ stat: 'maxHealth', op: 'mul', value: 0.5 }] });
    expect(stats.get(unit.id, 'maxHealth')).toBeCloseTo(150 * 1.2 * 0.5);
    stats.set(unit.id, 'items:3', { stats: [{ stat: 'talonResist', op: 'stack', value: 0.5 }] });
    expect(stats.get(unit.id, 'talonResist')).toBeCloseTo(1 - 0.8 * 0.5);
    stats.set(unit.id, 'status:slow1', { stats: [{ stat: 'slow', op: 'max', value: 0.3 }] });
    stats.set(unit.id, 'status:slow2', { stats: [{ stat: 'slow', op: 'max', value: 0.2 }] });
    expect(stats.get(unit.id, 'slow')).toBe(0.3);
  });

  it('replaces and removes a source at once, conditions included', () => {
    const { stats, unit } = setup();
    stats.set(unit.id, 'status:stun', {
      conditions: ['stunned'],
      stats: [{ stat: 'moveSpeed', op: 'add', value: 1 }],
    });
    expect(stats.has(unit.id, 'stunned')).toBe(true);
    stats.set(unit.id, 'status:stun', { stats: [{ stat: 'moveSpeed', op: 'add', value: 2 }] });
    expect(stats.has(unit.id, 'stunned')).toBe(false);
    expect(stats.get(unit.id, 'moveSpeed')).toBe(2);
    stats.set(unit.id, 'status:stun', null);
    expect(stats.get(unit.id, 'moveSpeed')).toBe(0);
    expect(unit.stats.sources.size).toBe(0);
  });
});
