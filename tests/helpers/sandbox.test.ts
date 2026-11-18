// The sandbox helper's own checks: these hold on any branch, stubs included.
import { describe, expect, it } from 'vitest';
import { Button } from '../../src/sim/core/contracts';
import type { Vec3 } from '../../src/sim/core/contracts';
import { aimRay } from '../../src/sim/core/aim';
import { createSandbox } from './sandbox';

/** Distance from point p to the ray (origin, unit dir). */
function rayDistance(origin: Vec3, dir: Vec3, p: Vec3): number {
  const d = { x: p.x - origin.x, y: p.y - origin.y, z: p.z - origin.z };
  const t = d.x * dir.x + d.y * dir.y + d.z * dir.z;
  return Math.hypot(d.x - dir.x * t, d.y - dir.y * t, d.z - dir.z * t);
}

describe('sandbox helper', () => {
  it('builds the roster in order: first hero Dawn (human), the rest Dusk, no regeneration', async () => {
    const sb = await createSandbox({ heroes: ['owl', 'pelican', { hero: 'swan', team: 'dawn' }] });
    expect(sb.heroes).toHaveLength(3);
    expect(sb.heroes.map((id) => sb.hero(id).team)).toEqual(['dawn', 'dusk', 'dawn']);
    expect(sb.hero(sb.heroes[0] as number).hero.controller).toBe('human');
    expect(sb.view.localHero).toBe(sb.heroes[0]);
    expect(sb.heroes.every((id) => sb.ctx.stats.get(id, 'healthRegen') === 0)).toBe(true);
    expect(sb.eventsOf('match.started')).toHaveLength(1);
    expect(sb.ctx.config.options.unlockAbilities).toBe(true);
    expect(sb.ctx.config.map).toBe('arena');
  });

  it('places, aims through a point and an entity, and latches commands', async () => {
    const sb = await createSandbox({ heroes: [{ hero: 'owl', at: { x: 0, y: 0, z: -10 }, yaw: 0 }, 'pelican'] });
    const [me, other] = sb.heroes as [number, number];
    sb.place(other, { x: 3, y: 0, z: 12 });
    expect(sb.entity(other).pos).toEqual({ x: 3, y: 0, z: 12 });

    for (const target of [{ x: -6, y: 4, z: 20 }, sb.pointOf(other, 'head'), sb.pointOf(other, 'body')]) {
      sb.aimAt(me, target);
      sb.step();
      const h = sb.hero(me);
      const ray = aimRay(h.pos, h.yaw, h.pitch, h.shoulder, sb.ctx.heroes.owl.def.body, false);
      expect(rayDistance(ray.origin, ray.dir, target)).toBeLessThan(1e-6);
    }

    sb.cast(me, 2, other);
    sb.upgrade(me, 1);
    sb.fire(me);
    sb.move(me, 1, -0.5);
    sb.step();
    let cmd = sb.hero(me).command;
    expect(cmd.pressed & Button.Ability3).not.toBe(0);
    expect(cmd.held & (Button.Ability3 | Button.Fire)).toBe(Button.Ability3 | Button.Fire);
    expect(cmd.upgrade).toBe(1);
    expect([cmd.forward, cmd.right]).toEqual([1, -0.5]);
    sb.fire(me, false);
    sb.step();
    cmd = sb.hero(me).command;
    expect([cmd.pressed, cmd.held, cmd.upgrade]).toEqual([0, 0, null]);
    expect(sb.hero(other).command.pressed).toBe(0);
  });

  it('spawns dummies, modifies stats, applies effects and steps until a predicate', async () => {
    const sb = await createSandbox({ heroes: ['kiwi'] });
    const unit = sb.dummy({ kind: 'unit', type: 'scrapper', team: 'dusk', at: { x: 0, y: 0, z: 5 }, hp: 260 });
    const tower = sb.dummy({ kind: 'structure', type: 'hawk', team: 'dusk', at: { x: 10, y: 0, z: 5 }, hp: 4500 });
    expect(sb.health(unit).hp).toBe(260);
    expect(sb.entity(unit).kind).toBe('unit');
    expect(sb.pointOf(tower).y).toBeGreaterThan(0);
    expect(sb.ctx.stats.get(tower, 'maxHealth')).toBe(4500);
    sb.modify(unit, 'armour', { stats: [{ stat: 'talonResist', op: 'stack', value: 0.2 }] });
    expect(sb.ctx.stats.get(unit, 'talonResist')).toBeCloseTo(0.2);
    sb.modify(unit, 'armour', null);
    expect(sb.ctx.stats.get(unit, 'talonResist')).toBe(0);

    const me = sb.heroes[0] as number;
    const c = sb.cause(me, { via: 'weapon' });
    expect([c.source, c.team, c.via]).toEqual([me, 'dawn', 'weapon']);
    expect(() => sb.apply({ kind: 'damage', amount: 10, type: 'talon' }, unit, c)).not.toThrow();

    expect(sb.stepUntil(() => sb.sim.tick >= 5)).toBe(5);
    expect(sb.stepUntil(() => false, 3)).toBeNull();
    sb.clearEvents();
    expect(sb.events).toEqual([]);
  });
});
