import { describe, expect, it } from 'vitest';
import { ViewFlag } from '../../sim/core/contracts';
import type { EntityView, SimEvent, SimView } from '../../sim/core/contracts';
import { TICK_RATE } from '../../sim/data/core';
import { entityName, leadPercent, meleeTargetNear, nextObjective, objectiveBars, OBJECTIVE_HIT_S, OBJECTIVE_NEAR_M, statusWord, stepChunk, CHUNK_DRAIN_S, CHUNK_HOLD_S, FULL_CHUNK } from './hud-model';
import { createStreaks } from './streaks';

const ent = (over: Partial<EntityView> & Pick<EntityView, 'id' | 'kind' | 'type'>): EntityView =>
  ({ team: 'dusk', pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, radius: 1, hp: 100, maxHp: 100, shield: 0, flags: 0, mode: null, seenBy: 0, ...over }) as EntityView;
const view = (entities: EntityView[], seconds = 100): SimView =>
  ({ tick: seconds * TICK_RATE, seconds, localHero: 1, entities, heroes: [{ id: 1, team: 'dawn' }], objectives: {} }) as unknown as SimView;
const me = ent({ id: 1, kind: 'hero', type: 'kingfisher', team: 'dawn' });
const tower = (id: number, x: number, type = 'heron'): EntityView =>
  ent({ id, kind: 'structure', type, pos: { x, y: 0, z: 0 }, structure: { type, lane: 'hedgerow', phase: 1 } as EntityView['structure'] });

describe('names', () => {
  it('structures read as flock plus kind, the Patrons and the Roc by name', () => {
    expect(entityName(tower(2, 0))).toBe('Dusk Heron');
    expect(entityName({ kind: 'structure', team: 'dawn', type: 'patron' })).toBe('Elder Raven');
    expect(entityName({ kind: 'unit', team: 'neutral', type: 'roc' })).toBe('The Roc');
  });
});

describe('scoreboard centre', () => {
  it('the lead is a whole percent of the trailing flock, on the leader\'s side', () => {
    expect(leadPercent(1250, 1000)).toEqual({ side: 'own', pct: 25 });
    expect(leadPercent(900, 1000)).toEqual({ side: 'enemy', pct: 11 });
    expect(leadPercent(500, 500)).toEqual({ side: null, pct: 0 });
    expect(leadPercent(10, 0).pct).toBe(1000);
  });

  it('names the soonest upcoming Egg or Roc as a clock window', () => {
    expect(nextObjective({ eggAt: 750 * TICK_RATE, rocAt: 600 * TICK_RATE }, 0)).toBe('Roc 10:00–10:30');
    expect(nextObjective({ eggAt: 750 * TICK_RATE, rocAt: 600 * TICK_RATE }, 700 * TICK_RATE)).toBe('Egg 12:30–13:00');
    expect(nextObjective({ eggAt: null, rocAt: 10 }, 20)).toBeNull();
  });
});

describe('contextual objective bars (G02)', () => {
  it('shows a structure only within 40 m, or for 5 s after the local bird hit it', () => {
    const near = tower(2, OBJECTIVE_NEAR_M - 1);
    const far = tower(3, OBJECTIVE_NEAR_M + 1);
    expect(objectiveBars(view([me, near, far]), new Map()).map((b) => b.id)).toEqual([2]);
    expect(objectiveBars(view([me, far], 100), new Map([[3, 100 - OBJECTIVE_HIT_S]])).map((b) => b.id)).toEqual([3]);
    expect(objectiveBars(view([me, far], 100), new Map([[3, 100 - OBJECTIVE_HIT_S - 1]]))).toEqual([]);
  });

  it('keeps at most two, recent hits first then nearest, and gives the Patron and the Roc the wide bar', () => {
    const list = [tower(2, 10), tower(3, 20), tower(4, 30)];
    expect(objectiveBars(view([me, ...list]), new Map()).map((b) => b.id)).toEqual([2, 3]);
    expect(objectiveBars(view([me, ...list], 100), new Map([[4, 99]])).map((b) => b.id)).toEqual([4, 2]);
    const wide = objectiveBars(view([me, tower(5, 5, 'patron'), ent({ id: 6, kind: 'unit', type: 'roc', pos: { x: 6, y: 0, z: 0 } })]), new Map());
    expect(wide.every((b) => b.wide)).toBe(true);
  });

  it('skips Nests and the dead, and flags a Brood Ward and the local flock\'s own structures', () => {
    const ward = ent({ ...tower(7, 5, 'warden'), team: 'dawn', structure: { type: 'warden', lane: null, phase: 1, broodWard: true } as EntityView['structure'] });
    const nest = ent({ id: 8, kind: 'structure', type: 'nest', structure: { type: 'nest', lane: null, phase: 1 } as EntityView['structure'] });
    const dead = ent({ ...tower(9, 5), hp: 0 });
    const bars = objectiveBars(view([me, ward, nest, dead]), new Map());
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({ ward: true, own: true });
  });
});

describe('contextual prompts', () => {
  it('a strong effect names itself (G10), stun before silence before root and disarm', () => {
    expect(statusWord(ViewFlag.Stunned | ViewFlag.Silenced, [])).toBe('STUNNED');
    expect(statusWord(ViewFlag.Silenced, [])).toBe('SILENCED');
    expect(statusWord(0, [{ id: 'rooted' }])).toBe('ROOTED');
    expect(statusWord(0, [{ id: 'disarm' }])).toBe('DISARMED');
    expect(statusWord(0, [{ id: 'slow' }])).toBeNull();
  });

  it('the melee hint wants a claimable pickup or Woven Nest within 3.5 m', () => {
    const egg = (x: number) => ent({ id: 20, kind: 'pickup', type: 'egg', team: 'neutral', pos: { x, y: 0, z: 0 } });
    expect(meleeTargetNear(view([me, egg(3)]))).toBe(true);
    expect(meleeTargetNear(view([me, egg(4)]))).toBe(false);
    expect(meleeTargetNear(view([me, ent({ id: 21, kind: 'pickup', type: 'pod', pos: { x: 1, y: 0, z: 0 } })]))).toBe(false);
    expect(meleeTargetNear(view([me, ent({ id: 22, kind: 'structure', type: 'nest', variant: 'woven', pos: { x: 1, y: 0, z: 0 } })]))).toBe(true);
  });
});

describe('health gauge chunk (G03)', () => {
  it('holds for 0.5 s after a hit, drains over 0.4 s, and jumps up with healing', () => {
    let c = stepChunk(FULL_CHUNK, 0.6, 0);
    expect(c.shown).toBe(1);
    c = stepChunk(c, 0.6, CHUNK_HOLD_S);
    expect(c.shown).toBe(1);
    c = stepChunk(c, 0.6, CHUNK_DRAIN_S / 2);
    expect(c.shown).toBeCloseTo(0.8);
    c = stepChunk(c, 0.6, CHUNK_DRAIN_S);
    expect(c.shown).toBeCloseTo(0.6);
    expect(stepChunk(c, 0.9, 0.1).shown).toBe(0.9);
  });

  it('a second hit while draining restarts the hold from where the chunk is', () => {
    let c = stepChunk(FULL_CHUNK, 0.8, 0);
    c = stepChunk(c, 0.8, CHUNK_HOLD_S + CHUNK_DRAIN_S / 2);
    const mid = c.shown;
    c = stepChunk(c, 0.5, 0);
    expect(c.shown).toBeCloseTo(mid);
    expect(stepChunk(c, 0.5, CHUNK_HOLD_S).shown).toBeCloseTo(mid);
  });
});

describe('kill callouts', () => {
  const died = (victim: number, credit: number | null, revives = false): SimEvent => ({ type: 'entity.died', victim, victimKind: 'hero', creditHero: credit, revives }) as unknown as SimEvent;

  it('First Blood once, then streak names; a death ends the streak', () => {
    const s = createStreaks();
    expect(s.onEvents([died(7, 1)]).map((c) => c.text)).toEqual(['First Blood']);
    expect(s.onEvents([died(8, 1)]).map((c) => c.text)).toEqual(['Twin Strike']);
    expect(s.onEvents([died(9, 1)]).map((c) => c.text)).toEqual(['Hat Trick']);
    expect(s.of(1)).toBe(3);
    s.onEvents([died(1, 7)]);
    expect(s.of(1)).toBe(0);
    expect(s.onEvents([died(8, 1)])).toEqual([]);
  });

  it('a Rekindle revive is no kill and no streak change, and the world or a structure earns no callout', () => {
    const s = createStreaks();
    expect(s.onEvents([died(7, 1, true), died(8, null)])).toEqual([]);
    expect(s.of(1)).toBe(0);
  });
});
