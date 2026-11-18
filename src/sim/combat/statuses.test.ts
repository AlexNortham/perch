import { describe, expect, it } from 'vitest';
import { Button } from '../core/contracts';
import type { Effect, EffectCause, Entity, StatusDef } from '../core/contracts';
import { BLEED, DAMAGE_AMP, INVISIBILITY, SLOW, STUN, UNSTOPPABLE, INTANGIBLE, SILENCE, TRUE_SIGHT } from '../data/combat';
import { createKit } from './testkit';
import type { Kit } from './testkit';

const cause = (source: Entity | null, ability: string | null = null): EffectCause => ({
  source: source?.id ?? null,
  team: source?.team ?? 'neutral',
  via: ability ? 'ability' : 'item',
  ability,
  item: null,
  values: null,
  songPower: 0,
  proc: false,
  origin: { x: 0, y: 0, z: 0 },
});

const apply = (k: Kit, e: Entity, fx: Effect, c: EffectCause): void =>
  k.ctx.effects.apply(fx, { entity: e.id, point: { ...e.pos }, dir: { x: 0, y: 0, z: 1 } }, c);

function setup() {
  const k = createKit();
  const a = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
  const b = k.hero('shrike', 'dawn', { x: 2, y: 0, z: 0 });
  const v = k.hero('albatross', 'dusk', { x: 0, y: 0, z: 10 });
  return { k, a, b, v };
}

describe('statuses (GDD §5.9)', () => {
  it('on/off statuses keep one instance: remaining = max(remaining, new); conditions go through ctx.stats', () => {
    const { k, a, v } = setup();
    apply(k, v, { kind: 'applyStatus', status: STUN, durationS: 1 }, cause(a));
    k.step(10);
    apply(k, v, { kind: 'applyStatus', status: STUN, durationS: 0.5 }, cause(a));
    expect(v.statuses).toHaveLength(1);
    expect(v.statuses[0]?.expiresAt).toBe(60);
    apply(k, v, { kind: 'applyStatus', status: STUN, durationS: 2 }, cause(a));
    expect(v.statuses[0]?.expiresAt).toBe(10 + 120);
    expect(v.stats.conditions.has('stunned')).toBe(true);
    k.step(119);
    expect(v.stats.conditions.has('stunned')).toBe(true);
    k.step(1);
    expect(v.stats.conditions.has('stunned')).toBe(false);
    expect(k.of('status.applied')).toHaveLength(3);
    expect(k.of('status.ended')).toEqual([{ type: 'status.ended', target: v.id, status: 'stun', reason: 'expired' }]);
  });

  it('graded slows are separate instances and only the strongest counts', () => {
    const { k, a, v } = setup();
    apply(k, v, { kind: 'applyStatus', status: SLOW, durationS: 2, magnitude: 0.3 }, cause(a));
    apply(k, v, { kind: 'applyStatus', status: SLOW, durationS: 1, magnitude: 0.5 }, cause(a));
    expect(v.statuses).toHaveLength(2);
    expect(v.stats.final.slow).toBe(0.5);
    k.step(60);
    expect(v.stats.final.slow).toBe(0.3);
    k.step(60);
    expect(v.stats.final.slow).toBe(0);
  });

  it('damage amp adds across instances', () => {
    const { k, a, v } = setup();
    apply(k, v, { kind: 'applyStatus', status: DAMAGE_AMP, magnitude: 0.2 }, cause(a));
    apply(k, v, { kind: 'applyStatus', status: DAMAGE_AMP, magnitude: 0.15 }, cause(a));
    expect(v.stats.final.talonAmp).toBeCloseTo(0.35);
    expect(v.stats.final.songAmp).toBeCloseTo(0.35);
  });

  it('DoTs: one instance per source, refreshed not stacked, ticking every 0.5 s (lands next tick)', () => {
    const { k, a, b, v } = setup();
    const bleed = (src: Entity) => apply(k, v, { kind: 'applyStatus', status: BLEED, durationS: 4, magnitude: 10 }, cause(src, 'test.bleed'));
    bleed(a);
    k.step(60);
    bleed(a);
    expect(v.statuses).toHaveLength(1);
    expect(v.statuses[0]?.expiresAt).toBe(60 + 240);
    bleed(b);
    expect(v.statuses).toHaveLength(2);
    k.step(300);
    const ticks = k.of('damage.applied');
    expect(ticks.every((e) => e.amount === 5 && e.via === 'status' && e.damageType === 'talon')).toBe(true);
    // A: ticks at 30, 60, …, 300 (10 ticks); B: 90, …, 300 (8 ticks).
    expect(ticks.filter((e) => e.source === a.id)).toHaveLength(10);
    expect(ticks.filter((e) => e.source === b.id)).toHaveLength(8);
    expect(v.statuses).toHaveLength(0);
  });

  it('stacking statuses add stacks up to the max and restart the timer', () => {
    const { k, a } = setup();
    const fx: Effect = { kind: 'statMod', id: 'test.frenzy', name: 'Frenzy', stats: [{ stat: 'fireRate', op: 'add', value: 0.1 }], durationS: 3, maxStacks: 3 };
    for (let i = 0; i < 5; i++) {
      apply(k, a, fx, cause(a, 'test.frenzy'));
      k.step(10);
    }
    expect(a.statuses).toHaveLength(1);
    expect(a.statuses[0]).toMatchObject({ stacks: 3, expiresAt: 40 + 180 });
    expect(a.stats.final.fireRate).toBeCloseTo(0.3);
  });

  it('status resist shortens negative statuses (capped at 60%); ability duration lengthens ability statuses', () => {
    const { k, a, v } = setup();
    k.mod(v, 'items:sr', [['statusResist', 'stack', 0.5]]);
    apply(k, v, { kind: 'applyStatus', status: STUN, durationS: 2 }, cause(a));
    expect(v.statuses[0]?.expiresAt).toBe(60);
    k.mod(v, 'items:sr', [['statusResist', 'stack', 0.9]]);
    apply(k, v, { kind: 'applyStatus', status: SILENCE, durationS: 2 }, cause(a));
    expect(v.statuses[1]?.expiresAt).toBe(48);
    k.mod(a, 'items:ad', [['abilityDuration', 'add', 0.5]]);
    apply(k, a, { kind: 'applyStatus', status: TRUE_SIGHT, durationS: 2 }, cause(a, 'test.sight'));
    expect(a.statuses[0]?.expiresAt).toBe(180);
  });

  it('unstoppable blocks and removes crowd control, not damage over time; intangible blocks negatives', () => {
    const { k, a, v } = setup();
    apply(k, v, { kind: 'applyStatus', status: STUN }, cause(a));
    apply(k, v, { kind: 'applyStatus', status: SLOW, magnitude: 0.4 }, cause(a));
    apply(k, v, { kind: 'applyStatus', status: BLEED, magnitude: 10 }, cause(a));
    apply(k, v, { kind: 'applyStatus', status: UNSTOPPABLE }, cause(v));
    expect(v.statuses.map((s) => s.def.id)).toEqual(['bleed', 'unstoppable']);
    expect(k.of('status.ended').map((e) => [e.status, e.reason])).toEqual([['stun', 'cleansed'], ['slow', 'cleansed']]);
    apply(k, v, { kind: 'applyStatus', status: STUN }, cause(a));
    expect(v.stats.conditions.has('stunned')).toBe(false);
    apply(k, v, { kind: 'applyStatus', status: INTANGIBLE }, cause(v));
    apply(k, v, { kind: 'applyStatus', status: DAMAGE_AMP, magnitude: 0.2 }, cause(a));
    expect(v.stats.final.talonAmp).toBe(0);
  });

  it('cleanse removes negative, positive or listed statuses', () => {
    const { k, a, v } = setup();
    apply(k, v, { kind: 'applyStatus', status: STUN }, cause(a));
    apply(k, v, { kind: 'applyStatus', status: SLOW, magnitude: 0.2 }, cause(a));
    apply(k, v, { kind: 'applyStatus', status: TRUE_SIGHT }, cause(v));
    apply(k, v, { kind: 'cleanse', remove: ['slow'] }, cause(v));
    expect(v.statuses.map((s) => s.def.id)).toEqual(['stun', 'trueSight']);
    apply(k, v, { kind: 'cleanse', remove: 'negative' }, cause(v));
    expect(v.statuses.map((s) => s.def.id)).toEqual(['trueSight']);
    apply(k, v, { kind: 'cleanse', remove: 'positive' }, cause(v));
    expect(v.statuses).toHaveLength(0);
    expect(v.stats.conditions.size).toBe(0);
  });

  it('invisibility ends when its holder fires or casts', () => {
    const { k, a } = setup();
    apply(k, a, { kind: 'applyStatus', status: INVISIBILITY }, cause(a));
    expect(a.stats.conditions.has('invisible')).toBe(true);
    k.input(a, Button.Fire);
    k.step();
    expect(a.stats.conditions.has('invisible')).toBe(false);
    k.input(a, 0);
    apply(k, a, { kind: 'applyStatus', status: INVISIBILITY }, cause(a));
    k.ctx.bus.emit({ type: 'ability', caster: a.id, slot: 0, ability: 'x', stage: 'start', point: a.pos });
    expect(a.statuses).toHaveLength(0);
  });

  it('applies onExpire effects to the holder on expiry only', () => {
    const { k, a, v } = setup();
    const fuse: StatusDef = {
      id: 'test.fuse',
      name: 'Fuse',
      negative: true,
      stacking: 'max',
      maxStacks: 1,
      durationS: 1,
      onExpire: [{ kind: 'damage', amount: 40, type: 'song' }],
    };
    apply(k, v, { kind: 'applyStatus', status: fuse }, cause(a, 'test.fuse'));
    k.step(62);
    expect(k.of('damage.applied')).toMatchObject([{ target: v.id, amount: 40, source: a.id }]);
    apply(k, v, { kind: 'applyStatus', status: fuse }, cause(a, 'test.fuse'));
    apply(k, v, { kind: 'cleanse', remove: 'negative' }, cause(v));
    k.step(62);
    expect(k.of('damage.applied')).toHaveLength(1);
  });

  it('regenerates 2 HP/s, reduced by the strongest heal reduction', () => {
    const { k, v } = setup();
    v.health.hp = 500;
    k.step(60);
    expect(v.health.hp).toBeCloseTo(502);
    k.mod(v, 'status:hr', [['healReduction', 'max', 0.5]]);
    k.step(60);
    expect(v.health.hp).toBeCloseTo(503);
  });
});
