import { describe, expect, it } from 'vitest';
import { Button } from '../core/contracts';
import type { Effect, EffectTarget, EntityId } from '../core/contracts';
import { createKit } from './testkit';

/** Kingfisher at the origin facing +z; an enemy Albatross 2 m ahead (facing back unless `yaw` says otherwise). */
function setup(yaw = Math.PI) {
  const k = createKit();
  const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
  const foe = k.hero('albatross', 'dusk', { x: 0, y: 0, z: 2 }, yaw);
  const physics: [Effect['kind'], EntityId | null][] = [];
  const spy = (kind: Effect['kind']) => (_fx: unknown, t: EffectTarget) => physics.push([kind, t.entity]);
  k.ctx.effects.handle('dash', 'physics', spy('dash'));
  k.ctx.effects.handle('displace', 'physics', spy('displace'));
  const meleeAt: number[] = [];
  k.ctx.bus.on('melee', () => meleeAt.push(k.ctx.clock.tick));
  return { k, me, foe, physics, meleeAt };
}

describe('melee (GDD §5.7)', () => {
  it('a tap is a light melee: hits 0.25 s later for 50 Talon, no beak shot', () => {
    const { k, me, foe, physics, meleeAt } = setup();
    k.input(me, 0, Button.Melee);
    k.step(40);
    expect(meleeAt).toEqual([1 + 15]);
    expect(k.of('melee')).toEqual([{ type: 'melee', attacker: me.id, heavy: false, target: foe.id, parried: false }]);
    expect(k.of('damage.applied')).toMatchObject([{ amount: 50, via: 'melee', damageType: 'talon', beakShot: false }]);
    expect(physics).toEqual([]);
  });

  it('holding 0.35 s commits a heavy melee: lunge, hit 0.6 s after the press for 115, knockback', () => {
    const { k, me, foe, physics, meleeAt } = setup();
    k.input(me, Button.Melee, Button.Melee);
    k.step(21);
    expect(physics).toEqual([]);
    k.step(1);
    expect(physics).toEqual([['dash', me.id]]);
    k.input(me, 0);
    k.step(40);
    expect(meleeAt).toEqual([1 + 36]);
    expect(k.of('melee')[0]).toMatchObject({ heavy: true, target: foe.id });
    expect(k.of('damage.applied')[0]?.amount).toBe(115);
    expect(physics).toEqual([['dash', me.id], ['displace', foe.id]]);
  });

  it('whiffs on empty air, hits pods without damage, halves on structures, claims the Ember only when heavy', () => {
    const k = createKit();
    const me = k.hero('kingfisher', 'dawn', { x: 0, y: 0, z: 0 });
    k.input(me, 0, Button.Melee);
    k.step(40);
    expect(k.of('melee')[0]).toMatchObject({ target: null });

    const pod = k.pod('dusk', { x: 0, y: 1.3, z: 2 });
    k.clear();
    k.input(me, 0, Button.Melee);
    k.step(40);
    expect(k.of('melee')[0]).toMatchObject({ target: pod.id });
    expect(k.of('damage.applied')).toHaveLength(0);
    k.ctx.store.despawn(pod.id);

    const ember = k.ctx.store.spawn({
      kind: 'pickup',
      team: 'neutral',
      pos: { x: 0, y: 1.3, z: 2 },
      vel: { x: 0, y: 0, z: 0 },
      yaw: 0,
      radius: 0.5,
      pickup: { type: 'ember', variant: '', value: 0, expiresAt: null, carrier: null },
    });
    k.step();
    k.clear();
    k.input(me, 0, Button.Melee);
    k.step(40);
    expect(k.of('melee')[0]).toMatchObject({ heavy: false, target: null });
    k.clear();
    k.input(me, Button.Melee, Button.Melee);
    k.step(60);
    expect(k.of('melee')[0]).toMatchObject({ heavy: true, target: ember.id });
    k.ctx.store.despawn(ember.id);

    const s = k.structure('dusk', 'hawk', { x: 0, y: 0, z: 3 }, 4500, 1, 10);
    k.input(me, 0);
    k.step(30);
    k.clear();
    k.input(me, 0, Button.Melee);
    k.step(40);
    expect(k.of('damage.applied')[0]).toMatchObject({ target: s.id, amount: 25 });
  });

  it('cancels a reload', () => {
    const { k, me } = setup();
    me.weapon.ammo = 3;
    k.input(me, 0, Button.Reload);
    k.step(5);
    expect(me.weapon.reloading).toBe(true);
    k.input(me, 0, Button.Melee);
    k.step();
    expect(me.weapon.reloading).toBe(false);
  });
});

describe('parry (GDD §5.8)', () => {
  it('a melee into an open window from the front deals nothing, stuns the attacker 2 s and resets the parry', () => {
    const { k, me, foe } = setup();
    k.input(foe, 0, Button.Parry);
    k.input(me, 0, Button.Melee);
    k.step(20);
    expect(k.of('parry')).toEqual([
      { type: 'parry', hero: foe.id, outcome: 'start', attacker: null },
      { type: 'parry', hero: foe.id, outcome: 'success', attacker: me.id },
    ]);
    expect(k.of('melee')).toEqual([{ type: 'melee', attacker: me.id, heavy: false, target: foe.id, parried: true }]);
    expect(k.of('damage.applied')).toHaveLength(0);
    expect(me.stats.conditions.has('stunned')).toBe(true);
    expect(me.statuses[0]).toMatchObject({ def: { id: 'stun' }, expiresAt: 16 + 120 });
    // Cooldown reset: a second parry starts at once.
    k.input(foe, 0, Button.Parry);
    k.step();
    expect(k.of('parry').at(-1)).toMatchObject({ outcome: 'start' });
  });

  it('does not parry from behind', () => {
    const { k, me, foe } = setup(0);
    k.input(foe, 0, Button.Parry);
    k.input(me, 0, Button.Melee);
    k.step(20);
    expect(k.of('melee')[0]).toMatchObject({ parried: false, target: foe.id });
    expect(k.of('damage.applied')).toHaveLength(1);
  });

  it('a whiff locks fire and melee for 0.4 s and puts parry on a 5 s cooldown', () => {
    const { k, foe } = setup();
    const fired: number[] = [];
    k.ctx.bus.on('weapon.fired', () => fired.push(k.ctx.clock.tick));
    k.input(foe, 0, Button.Parry);
    k.step(1);
    // Window opens 0.05 s after the press (tick 4) and lasts 0.6 s: closes at tick 40.
    k.input(foe, Button.Fire);
    k.step(39);
    expect(k.of('parry').at(-1)).toMatchObject({ outcome: 'whiff' });
    expect(fired).toEqual([]);
    k.step(30);
    expect(fired[0]).toBe(40 + 24);
    k.clear();
    k.input(foe, 0, Button.Parry);
    k.step();
    expect(k.of('parry')).toHaveLength(0);
    k.at((40 + 300) / 60);
    k.input(foe, 0, Button.Parry);
    k.step();
    expect(k.of('parry')[0]).toMatchObject({ outcome: 'start' });
  });
});
