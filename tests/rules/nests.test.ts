// Nests, the breakables, and their drops (GDD §7.9, §7.13). Written test-first (D-EP-006, W4.5 QA): gated until
// sim/world, combat and economy land them in wave 5. Run with PERCH_PENDING=1 npx vitest run tests/rules/nests.test.ts
import { describe, expect, it } from 'vitest';
import type { EntityId, StructureEntity } from '../../src/sim/core/contracts';
import { TICK_RATE } from '../../src/sim/data/core';
import type { Sandbox } from '../helpers/sandbox';
import { advanceBy, advanceTo, earned, flat, heavyMelee, lightMelee, minutes, mmss, pickupsOf, seconds, standBeside, world } from '../helpers/world';

const TIMEOUT_MS = 300_000;
const TWIG_SPRIG = { base: 24, perMin: 1.8 };
const WOVEN_SPRIG = { base: 48, perMin: 3.6 };
const PICKUP_M = 1.5;
const SPRINT_BREAK_MS = 8.5;
const CRUMB_S = 60;
/** GDD §7.9 spawn times. */
const SPAWN_S = { surface: mmss(3), below: mmss(5), hollow: mmss(10) };

const nests = (sb: Sandbox, variant?: 'twig' | 'woven' | 'keepsake'): StructureEntity[] =>
  sb.ctx.store.list('structure').filter((s) => s.structure.type === 'nest' && s.structure.variant !== 'feeder' && !s.removed &&
    (variant === undefined || s.structure.variant === variant));
const hit = (sb: Sandbox, source: EntityId, nest: StructureEntity, via: 'weapon' | 'melee' | 'ability' = 'weapon') =>
  sb.apply({ kind: 'damage', amount: 5_000, type: 'talon' }, nest.id, sb.cause(source, { via }));

async function standing() {
  const sb = await world({ heroes: ['shrike', 'lyrebird'] });
  advanceTo(sb, mmss(10, 5));
  return { sb, hero: sb.heroes[0]!, foe: sb.heroes[1]! };
}

describe('W5 Nests (§7.9)', { timeout: TIMEOUT_MS }, () => {
  it('§7.9 map: 100 Nests: 72 Twig (4 in the Hollow), 16 Woven, 12 Keepsake', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const anchors = sb.ctx.map.nests;
    expect(anchors).toHaveLength(100);
    const of = (v: string) => anchors.filter((a) => (a.variant ?? 'twig') === v);
    expect(of('twig')).toHaveLength(72);
    expect(of('woven')).toHaveLength(16);
    expect(of('keepsake')).toHaveLength(12);
    expect(of('twig').filter((a) => a.pos.y <= -2), 'four in the Hollow').toHaveLength(4);
  });

  it('§7.9 spawn: surface Nests at 3:00, below-ground ones at 5:00, the four in the Hollow at 10:00', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const cellar = (a: { storey?: number; pos: { y: number } }) => (a.storey ?? 0) < 0;
    const hollow = (a: { storey?: number; pos: { y: number } }) => !cellar(a) && a.pos.y <= -2; // cellars lie below −2 too
    const count = (pick: (a: StructureEntity) => boolean) => nests(sb).filter(pick).length;
    const anchorOf = (s: StructureEntity) => sb.ctx.map.nests[s.structure.anchor!]!;
    advanceTo(sb, SPAWN_S.surface - 2);
    expect(nests(sb), 'none before 3:00').toHaveLength(0);
    advanceTo(sb, SPAWN_S.surface + 2);
    expect(count((s) => !cellar(anchorOf(s)) && !hollow(anchorOf(s)))).toBeGreaterThan(0);
    expect(count((s) => cellar(anchorOf(s)) || hollow(anchorOf(s))), 'cellars and the Hollow wait').toBe(0);
    advanceTo(sb, SPAWN_S.below + 2);
    expect(count((s) => cellar(anchorOf(s)))).toBeGreaterThan(0);
    expect(count((s) => hollow(anchorOf(s)))).toBe(0);
    advanceTo(sb, SPAWN_S.hollow + 2);
    expect(count((s) => hollow(anchorOf(s)))).toBe(4);
  });

  it('§7.9 solidity: Twig and Keepsake Nests never block movement; Woven Nests are solid, 1.2 m wide and 1.0 m tall', async () => {
    const { sb } = await standing();
    expect(nests(sb, 'twig').length + nests(sb, 'keepsake').length + nests(sb, 'woven').length, 'the Nests exist').toBe(100);
    for (const n of [...nests(sb, 'twig'), ...nests(sb, 'keepsake')]) expect(n.structure.solid, n.structure.variant).toBe(false);
    for (const n of nests(sb, 'woven')) {
      expect(n.structure.solid).not.toBe(false);
      expect(n.structure.body.radius * 2).toBeCloseTo(1.2, 1);
      expect(n.structure.body.height).toBeCloseTo(1.0, 1);
    }
  });

  it('§7.9 Twig breaks on a bullet, a melee hit or an ability hit', async () => {
    const { sb, hero } = await standing();
    const [a, b, c] = nests(sb, 'twig').slice(0, 3) as [StructureEntity, StructureEntity, StructureEntity];
    hit(sb, hero, a, 'weapon');
    hit(sb, hero, b, 'melee');
    hit(sb, hero, c, 'ability');
    sb.step(2);
    for (const n of [a, b, c]) expect(n.health.dead || n.removed, `${n.id}`).toBe(true);
  });

  it('§7.9 Twig breaks when a hero passes through at ≥ 8.5 m/s (a sprint), not at a walk', async () => {
    const { sb, hero } = await standing();
    const [slow, fast] = nests(sb, 'twig').slice(0, 2) as [StructureEntity, StructureEntity];
    // A hero running forward sprints (run 7 m/s + sprint 2 m/s ≥ 8.5), so the walk takes its speed down to 3 m/s.
    // Each judged straight after its own run: the sprint's 30 m path may cross the other Nest.
    for (const [nest, speed, sprint] of [[slow, -4, -2], [fast, SPRINT_BREAK_MS + 1, SPRINT_BREAK_MS + 1]] as const) {
      sb.place(hero, { x: nest.pos.x - 3, y: nest.pos.y, z: nest.pos.z }, Math.PI / 2);
      sb.modify(hero, 'qa-speed', { stats: [{ stat: 'sprintSpeed', op: 'add', value: sprint }, { stat: 'moveSpeed', op: 'add', value: speed }] });
      sb.move(hero, 1);
      sb.step(2 * TICK_RATE);
      sb.move(hero, 0);
      if (nest === slow) expect(slow.health.dead || slow.removed, 'a walk does not break it').toBeFalsy();
    }
    expect(fast.health.dead || fast.removed, 'a sprint does').toBe(true);
  });

  it('§7.9 Woven breaks only on one heavy melee hit: a bullet, a light hit and an ability do nothing', async () => {
    const { sb, hero } = await standing();
    const woven = nests(sb, 'woven')[0]!;
    hit(sb, hero, woven, 'weapon');
    hit(sb, hero, woven, 'ability');
    sb.step();
    standBeside(sb, hero, woven.pos);
    lightMelee(sb, hero);
    expect(woven.health.dead || woven.removed, 'bullet, ability and light melee leave it standing').toBeFalsy();
    heavyMelee(sb, hero);
    expect(woven.health.dead || woven.removed, 'one heavy hit').toBe(true);
  });

  it('§7.9 Twig drops: about 60% a seed sprig worth 24 + 1.8 per minute (fixed at the drop), an independent 15% crumb', async () => {
    const { sb, hero } = await standing();
    const all = nests(sb, 'twig');
    for (const n of all) hit(sb, hero, n);
    sb.step(2);
    const sprigs = pickupsOf(sb, 'sprig');
    expect(sprigs.length, '60% of 72, within sampling error').toBeGreaterThan(all.length * 0.4);
    expect(sprigs.length).toBeLessThan(all.length * 0.8);
    const value = TWIG_SPRIG.base + TWIG_SPRIG.perMin * minutes(sb);
    for (const s of sprigs) expect(s.pickup.value).toBeCloseTo(value, 0);
    const crumbs = pickupsOf(sb, 'crumb').length;
    expect(crumbs, '15% of 72').toBeGreaterThan(0);
    expect(crumbs).toBeLessThan(all.length * 0.35);
  });

  it('§7.9 Woven drops always: a seed sprig worth 48 + 3.6 per minute, plus a 25% crumb roll', async () => {
    const { sb, hero } = await standing();
    const all = nests(sb, 'woven');
    expect(all, '16 Woven Nests stand').toHaveLength(16);
    for (const n of all) {
      standBeside(sb, hero, n.pos);
      sb.clearEvents();
      heavyMelee(sb, hero);
      // The melee hit leaves the hero within 1.5 m, so it collects the sprig at once (seeds paid for 'nest').
      const paid = sb.eventsOf('seeds.gained').filter((e) => e.hero === hero && e.reason === 'nest');
      expect(paid, 'every Woven Nest drops a sprig').toHaveLength(1);
      expect(Math.abs(paid[0]!.amount - (WOVEN_SPRIG.base + WOVEN_SPRIG.perMin * minutes(sb)))).toBeLessThan(1);
    }
  });

  it('§7.9 Keepsake Nest: 50% to drop one keepsake pickup; collecting it adds a keepsake and fires keepsakeGained', async () => {
    const { sb, hero } = await standing();
    const all = nests(sb, 'keepsake');
    for (const n of all) hit(sb, hero, n);
    sb.step(2);
    const drops = pickupsOf(sb, 'keepsake');
    expect(drops.length, '50% of 12').toBeGreaterThan(0);
    expect(drops.length).toBeLessThan(all.length);
    sb.clearEvents();
    sb.place(hero, drops[0]!.pos);
    sb.step(3);
    expect(sb.hero(hero).keepsakes?.count).toBe(1);
    expect(sb.eventsOf('objective').filter((e) => e.action === 'keepsakeGained' && e.hero === hero)).toHaveLength(1);
  });

  it('§7.9 pickups: any hero of either flock collects a drop within 1.5 m (not at 2 m); a sprig pays its value; it stays until collected', async () => {
    const { sb, hero, foe } = await standing();
    for (const n of nests(sb, 'twig')) hit(sb, hero, n);
    sb.step(2);
    const sprig = pickupsOf(sb, 'sprig')[0]!;
    const value = sprig.pickup.value;
    sb.place(hero, { x: sprig.pos.x - 2, y: sprig.pos.y, z: sprig.pos.z });
    advanceBy(sb, 30);
    expect(sprig.removed, 'a pickup stays until collected').toBeFalsy();
    sb.clearEvents();
    sb.place(foe, { x: sprig.pos.x - (PICKUP_M - 0.3), y: sprig.pos.y, z: sprig.pos.z });
    sb.step(3);
    expect(sprig.removed || pickupsOf(sb, 'sprig').every((s) => s.id !== sprig.id), 'the other flock collected it').toBe(true);
    expect(earned(sb, foe, 'nest')).toBe(Math.floor(value));
  });

  it('§7.9 respawn: 3:00 after the Nest breaks (5:00 below ground), or after its drop is collected, whichever is later', async () => {
    const { sb, hero } = await standing();
    const nest = nests(sb, 'twig').find((n) => (sb.ctx.map.nests[n.structure.anchor!]!.storey ?? 0) >= 0 && n.pos.y > -2)!;
    const anchor = nest.structure.anchor!;
    hit(sb, hero, nest);
    sb.step(2);
    const brokeAt = seconds(sb);
    expect(sb.ctx.objectives.nestAt?.[anchor], 'respawn scheduled').toBeGreaterThanOrEqual((brokeAt + 178) * TICK_RATE);
    advanceTo(sb, brokeAt + 175);
    expect(nests(sb).some((n) => n.structure.anchor === anchor), 'still broken at 2:55').toBe(false);
    const dropped = pickupsOf(sb, 'sprig').find((s) => flat(s.pos, nest.pos) < 2);
    if (dropped) {
      sb.place(hero, dropped.pos);
      sb.step(3);
    }
    advanceTo(sb, Math.max(brokeAt + 185, seconds(sb) + 185 * (dropped ? 1 : 0)));
    expect(nests(sb).some((n) => n.structure.anchor === anchor), 'back').toBe(true);
  });

  it('§7.9 crumbs: Quick +15% fire rate, Light +1 m/s move speed, Sweet +15 SP, for 60 s; lost on death; a new crumb replaces an older one', async () => {
    const seen = new Map<string, number>();
    const effects: Record<string, { stat: 'fireRate' | 'moveSpeed' | 'songPower'; value: number }> = {
      quick: { stat: 'fireRate', value: 0.15 }, light: { stat: 'moveSpeed', value: 1 }, sweet: { stat: 'songPower', value: 15 },
    };
    for (const seed of [1, 2, 3]) {
      const sb = await world({ heroes: ['shrike', 'lyrebird'], seed });
      advanceTo(sb, mmss(10, 5));
      const hero = sb.heroes[0]!;
      for (const n of nests(sb, 'twig')) hit(sb, hero, n);
      for (const n of nests(sb, 'woven')) {
        standBeside(sb, hero, n.pos);
        heavyMelee(sb, hero);
      }
      sb.step(2);
      for (const crumb of pickupsOf(sb, 'crumb')) {
        const variant = Object.keys(effects).find((v) => crumb.pickup.variant.includes(v)) ?? '';
        const spec = effects[variant];
        expect(spec, `crumb variant ${crumb.pickup.variant} is one of quick, light, sweet`).toBeDefined();
        if (seen.has(variant)) continue;
        seen.set(variant, seed);
        const before = sb.hero(hero).stats.final[spec!.stat];
        sb.place(hero, crumb.pos);
        sb.step(3);
        expect(sb.hero(hero).stats.final[spec!.stat] - before, `${variant} crumb`).toBeCloseTo(spec!.value, 2);
        advanceBy(sb, CRUMB_S - 3);
        expect(sb.hero(hero).stats.final[spec!.stat] - before, 'still on at 57 s').toBeCloseTo(spec!.value, 2);
        advanceBy(sb, 5);
        expect(sb.hero(hero).stats.final[spec!.stat] - before, 'gone after 60 s').toBeCloseTo(0, 2);
        sb.place(hero, crumb.pos);
      }
      if (seen.size === 3) break;
    }
    expect([...seen.keys()].sort(), 'all three crumbs drop within three seeded matches').toEqual(['light', 'quick', 'sweet']);
  });

  it('§7.9 crumbs are lost on death, and a new crumb replaces the older one', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    advanceTo(sb, mmss(10, 5));
    const [hero, foe] = sb.heroes as [EntityId, EntityId];
    for (const n of nests(sb, 'twig')) hit(sb, hero, n);
    sb.step(2);
    const [first, second] = pickupsOf(sb, 'crumb').filter((c, i, all) => c.pickup.variant !== all[0]!.pickup.variant || i === 0) as [ReturnType<typeof pickupsOf>[number], ReturnType<typeof pickupsOf>[number]];
    expect(second, 'two crumbs of different kinds drop from 72 Twig Nests').toBeDefined();
    const base = { ...sb.hero(hero).stats.final };
    const changed = (): string[] => (['fireRate', 'moveSpeed', 'songPower'] as const).filter((k) => sb.hero(hero).stats.final[k] !== base[k]);
    sb.place(hero, first.pos);
    sb.step(3);
    const one = changed();
    expect(one, 'one crumb active').toHaveLength(1);
    sb.place(hero, second.pos);
    sb.step(3);
    expect(changed(), 'the new crumb replaces the old one: still one buff, a different one').toHaveLength(1);
    expect(changed()).not.toEqual(one);
    sb.apply({ kind: 'damage', amount: 1_000_000, type: 'talon' }, hero, sb.cause(foe, { via: 'weapon' }));
    sb.step(2);
    sb.place(hero, { x: 0, y: 0, z: 40 });
    expect(changed(), 'lost on death').toHaveLength(0);
  });
});
