/**
 * Three real GDD kits with very different shapes, written as data only (GDD §9.1 Shrike: traps, zones, a ring
 * wall; §9.4 Lyrebird: ally targeting, a decoy, a channelled aura; §9.3 Kingfisher: charged dashes, invisibility,
 * a wind-up unit strike), proving the framework expresses them. Each `// gap:` names a tier the contracts can't
 * say yet (listed in the W2 Ability Systems report). Also the performance check.
 */
import { describe, expect, it } from 'vitest';
import { validateKit } from './kit';
import { createHarness } from './testkit';
import { SLOW, FIXTURES, O, press } from './fixtures.testkit';

function setup() {
  const t = createHarness({ heroes: FIXTURES, unlockAbilities: true });
  return t;
}

describe('fixture kits', () => {
  it.each(Object.entries(FIXTURES))('%s validates', (_id, m) => {
    expect(validateKit(m)).toEqual([]);
  });

  it('Shrike: Thorn Larder arms after 0.75 s, then roots, reveals and damages the hero who steps in', () => {
    const t = setup();
    const me = t.hero('shrike', 'dawn', O);
    const foe = t.hero('owl', 'dusk', { x: 0, y: 0, z: 30 });
    t.ctx.stats.setBase(me.id, { ...me.stats.base, songPower: 10 });
    t.step(1, [[me, press(0)]]);
    t.step(24);
    t.step(1, [[me, { ...press(0), yaw: 1 }]]);
    expect(me.abilities.slots[0]?.charges).toBe(0);
    t.step(44);
    expect(t.ctx.store.list('unit')).toHaveLength(1);
    t.step(24);
    const traps = t.ctx.store.list('unit');
    expect(traps.map((u) => u.unit.summon)).toEqual(['trap', 'trap']);
    foe.pos = { x: traps[0]?.pos.x ?? 0, y: 0, z: (traps[0]?.pos.z ?? 0) + 1 };
    t.step(1);
    const [d] = t.of('damage');
    expect(d?.target.entity).toBe(foe.id);
    expect(d && t.ctx.effects.magnitude(d.effect.amount, d.cause)).toBe(89);
    expect(t.of('applyStatus').map((a) => [a.effect.status.id, t.ctx.effects.magnitude(a.effect.durationS ?? 0, a.cause)])).toEqual([['root', 1], ['reveal', 4]]);
    expect(t.ctx.store.list('unit')).toHaveLength(1);
  });

  it("Shrike: Butcher's Ring at T3 — heal cut and damage inside, damage and root on crossing", () => {
    const t = setup();
    const me = t.hero('shrike', 'dawn', O);
    const foe = t.hero('owl', 'dusk', { x: 0, y: 0, z: 20 });
    me.abilities.ap = 8;
    for (let i = 0; i < 3; i++) t.step(1, [[me, { upgrade: 3 }]]);
    expect(me.abilities.slots[3]?.tier).toBe(3);
    t.step(1, [[me, { ...press(3), pitch: -0.3 }]]);
    const centre = t.of('delay')[0]?.target.point ?? O;
    foe.pos = { x: centre.x, y: 0, z: centre.z + 5 };
    t.step(48);
    expect(t.ctx.store.list('area').map((a) => [a.area.shape, a.area.expiresAt])).toEqual([['ring', 52 + 480], ['cylinder', 52 + 480], ['cylinder', 52 + 480]]);
    t.step(30);
    expect(t.of('applyStatus').map((a) => a.effect.status.id)).toEqual(['healReduction']);
    expect(t.of('damage')).toHaveLength(1);
    for (const z of [8.8, 9.2]) {
      foe.pos.z = centre.z + z;
      t.step(1);
    }
    const crossed = t.of('damage').at(-1);
    expect(crossed && t.ctx.effects.magnitude(crossed.effect.amount, crossed.cause)).toBe(150);
    expect(t.of('applyStatus').at(-1)?.effect.status.id).toBe('root');
  });

  it('Lyrebird: Mended Song heals the ally in the crosshair, else the caster', () => {
    const t = setup();
    const me = t.hero('lyrebird', 'dawn', O);
    const ally = t.hero('swan', 'dawn', { x: -0.75, y: 0, z: 20 });
    t.step(1, [[me, press(0)]]);
    t.step(24, [[me, { yaw: Math.PI }]]);
    t.step(1, [[me, press(0)]]);
    expect(t.of('heal').map((a) => [a.target.entity, a.effect.overS ?? 0])).toEqual([[ally.id, 0], [ally.id, 4], [me.id, 0], [me.id, 4]]);
  });

  it('Lyrebird: Grand Chorus pulses each second for 5 s; T3 lifts the channel penalty', () => {
    const t = setup();
    const me = t.hero('lyrebird', 'dawn', O);
    const ally = t.hero('swan', 'dawn', { x: 5, y: 0, z: 0 });
    const foe = t.hero('owl', 'dusk', { x: 0, y: 0, z: 10 });
    t.hero('pelican', 'dusk', { x: 0, y: 0, z: 30 });
    t.step(1, [[me, press(3)]]);
    t.step(300);
    expect(t.of('heal').map((a) => a.target.entity)).toEqual([me.id, ally.id, me.id, ally.id, me.id, ally.id, me.id, ally.id, me.id, ally.id]);
    expect(t.of('applyStatus').filter((a) => a.effect.status === SLOW).map((a) => a.target.entity)).toEqual([foe.id, foe.id, foe.id, foe.id, foe.id]);
    expect(t.events.flatMap((e) => (e.type === 'ability' ? [e.stage] : []))).toEqual(['start', 'land', 'end']);

    const t3 = setup();
    const me3 = t3.hero('lyrebird', 'dawn', O);
    me3.abilities.ap = 8;
    for (let i = 0; i < 3; i++) t3.step(1, [[me3, { upgrade: 3 }]]);
    t3.step(1, [[me3, press(3)]]);
    expect(t3.applied.map((a) => a.effect.kind).slice(0, 3)).toEqual(['applyStatus', 'area', 'cleanse']);
  });

  it('Lyrebird: Echo Double sends a decoy along the aim and hides the caster', () => {
    const t = setup();
    const me = t.hero('lyrebird', 'dawn', O);
    t.step(1, [[me, press(1)]]);
    const [decoy] = t.ctx.store.list('unit');
    expect(decoy?.unit).toMatchObject({ summon: 'decoy', owner: me.id });
    expect(t.of('applyStatus').map((a) => [a.effect.status.id, a.target.entity])).toEqual([['invisible', me.id]]);
    t.step(60);
    expect(decoy?.pos.z).toBeGreaterThan(6);
  });

  it('Kingfisher: Riverstrike winds up 0.5 s, then teleports and strikes; its refund trigger goes to the caster', () => {
    const t = setup();
    const me = t.hero('kingfisher', 'dawn', O);
    const foe = t.hero('owl', 'dusk', { x: -0.75, y: 0, z: 20 });
    t.step(1, [[me, press(3)]]);
    expect(t.ctx.stats.has(me.id, 'rooted')).toBe(true);
    t.step(29);
    expect(t.of('teleport')).toHaveLength(0);
    t.step(1);
    expect(t.of('teleport')[0]?.target.entity).toBe(foe.id);
    expect(t.of('damage')[0]).toMatchObject({ target: { entity: foe.id }, effect: { missingHpPct: 0.12 } });
    expect(t.of('trigger')[0]?.target.entity).toBe(me.id);
  });

  it('Kingfisher: Plunge T3 refunds its own charge from the dash onHit, though the target is the enemy', () => {
    const t = setup();
    const me = t.hero('kingfisher', 'dawn', O);
    const foe = t.hero('owl', 'dusk', { x: 0, y: 0, z: 10 });
    me.abilities.ap = 8;
    for (let i = 0; i < 3; i++) t.step(1, [[me, { upgrade: 0 }]]);
    t.step(1, [[me, press(0)]]);
    t.step(24);
    t.step(1, [[me, press(0)]]);
    const slot = me.abilities.slots[0];
    expect(slot?.charges).toBe(0);
    const [dash] = t.of('dash');
    if (!dash) throw new Error('no dash');
    // Physics would apply onHit on contact; do it here.
    t.ctx.effects.applyAll(dash.effect.onHit ?? [], { entity: foe.id, point: foe.pos, dir: dash.target.dir }, dash.cause);
    expect(slot?.charges).toBe(1);
    const slow = t.of('applyStatus')[0];
    expect(slow && t.ctx.effects.magnitude(slow.effect.durationS ?? 0, slow.cause)).toBe(2);
  });
});
