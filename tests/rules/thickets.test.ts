// Thickets, the neutral camps (GDD §7.8). Written test-first (D-EP-006, W4.5 QA): gated until sim/world, combat and
// economy land them in wave 5. Run with PERCH_PENDING=1 npx vitest run tests/rules/thickets.test.ts
import { describe, expect, it } from 'vitest';
import type { EntityId, ThicketAnchor, ThicketFamily, UnitEntity, UnitType } from '../../src/sim/core/contracts';
import { TICK_RATE } from '../../src/sim/data/core';
import type { Sandbox } from '../helpers/sandbox';
import { advanceBy, advanceTo, earned, flat, minutes, mmss, objectiveEvents, pickupsOf, seconds, world } from '../helpers/world';

const TIMEOUT_MS = 300_000;

interface Family {
  readonly family: ThicketFamily;
  readonly tier: 1 | 2 | 3;
  readonly units: readonly { readonly type: UnitType; readonly n: number; readonly hp: number; readonly seeds: number }[];
  readonly firstS: number;
  readonly respawnS: number;
  readonly indoor: boolean;
  readonly camps: number;
  readonly resists: { readonly talon: number; readonly song: number };
}
/** GDD §7.8 table. */
const FAMILIES: readonly Family[] = [
  { family: 'beetles', tier: 1, units: [{ type: 'beetle', n: 3, hp: 200, seeds: 45 }], firstS: mmss(2), respawnS: mmss(1, 30), indoor: false, camps: 8, resists: { talon: 0.3, song: 0.25 } },
  { family: 'weasels', tier: 2, units: [{ type: 'weasel', n: 3, hp: 480, seeds: 100 }], firstS: mmss(5), respawnS: mmss(4, 45), indoor: false, camps: 4, resists: { talon: 0.3, song: 0.25 } },
  { family: 'rats', tier: 2, units: [{ type: 'rat', n: 5, hp: 220, seeds: 60 }], firstS: mmss(5), respawnS: mmss(4, 45), indoor: true, camps: 4, resists: { talon: 0.3, song: 0.25 } },
  { family: 'toads', tier: 2, units: [{ type: 'toad', n: 2, hp: 720, seeds: 150 }], firstS: mmss(5), respawnS: mmss(4, 45), indoor: true, camps: 4, resists: { talon: 0.3, song: 0.25 } },
  { family: 'badgers', tier: 3, units: [{ type: 'badger', n: 1, hp: 2000, seeds: 560 }, { type: 'cub', n: 2, hp: 420, seeds: 120 }], firstS: mmss(8), respawnS: mmss(5, 30), indoor: false, camps: 4, resists: { talon: 0.4, song: 0.35 } },
];
const HP_PER_MIN = 0.02;
const DMG_PER_MIN = 0.005;
const SEEDS_PER_MIN = 0.015;
const WAKE_M = 30;
const SNIPE_M = 35;
const LEASH_M = 18;

const familyOf = (a: ThicketAnchor): ThicketFamily => a.family ?? (a.tier === 1 ? 'beetles' : a.tier === 2 ? 'weasels' : 'badgers');
const campsOf = (sb: Sandbox, f: ThicketFamily) => sb.ctx.map.thickets.map((a, i) => [a, i] as const).filter(([a]) => familyOf(a) === f);
const unitsOf = (sb: Sandbox, camp: number): UnitEntity[] => sb.ctx.store.list('unit').filter((u) => u.unit.camp === camp && !u.removed);
const hit = (sb: Sandbox, source: EntityId, target: EntityId, amount: number) =>
  sb.apply({ kind: 'damage', amount, type: 'talon' }, target, sb.cause(source, { via: 'weapon' }));

async function at(f: Family, extra: readonly ('shrike' | 'kingfisher')[] = []) {
  const sb = await world({ heroes: ['shrike', ...extra.map((hero) => ({ hero, team: 'dawn' as const })), 'lyrebird'] });
  expect(campsOf(sb, f.family).length, '§7.8 the detailed map has ' + f.family + ' camps').toBeGreaterThan(0);
  const [anchor, index] = campsOf(sb, f.family)[0]!;
  advanceTo(sb, f.firstS + 1);
  const hero = sb.heroes[0]!;
  return { sb, anchor, index, hero, ally: sb.heroes[1] !== undefined && extra.length > 0 ? sb.heroes[1] : undefined };
}

describe.runIf(process.env.PERCH_PENDING === '1')('W5 Thickets (§7.8)', { timeout: TIMEOUT_MS }, () => {
  it('§7.8 map: 24 camps; 8 of tier 1, 12 of tier 2 (8 of them indoors), 4 of tier 3', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const camps = sb.ctx.map.thickets;
    expect(camps).toHaveLength(24);
    expect(camps.filter((c) => c.tier === 1)).toHaveLength(8);
    expect(camps.filter((c) => c.tier === 2)).toHaveLength(12);
    expect(camps.filter((c) => c.tier === 2 && c.building !== undefined)).toHaveLength(8);
    expect(camps.filter((c) => c.tier === 3)).toHaveLength(4);
    for (const f of FAMILIES) expect(campsOf(sb, f.family), f.family).toHaveLength(f.camps);
  });

  describe.each(FAMILIES)('$family', (f) => {
    it('§7.8 spawns at its first-spawn time with the table\'s creatures, HP scaled +2% per minute at spawn, and the table\'s resists', async () => {
      const sb = await world({ heroes: ['shrike', 'lyrebird'] });
      expect(campsOf(sb, f.family).length, '§7.8 the detailed map has ' + f.family + ' camps').toBeGreaterThan(0);
      const [, index] = campsOf(sb, f.family)[0]!;
      advanceTo(sb, f.firstS - 2);
      expect(unitsOf(sb, index), 'nothing before the first spawn').toHaveLength(0);
      expect(sb.ctx.objectives.campAt?.[index]).toBe(f.firstS * TICK_RATE);
      advanceTo(sb, f.firstS + 1);
      expect(objectiveEvents(sb, 'campSpawned').some((e) => e.camp === index)).toBe(true);
      const units = unitsOf(sb, index);
      expect(units).toHaveLength(f.units.reduce((n, u) => n + u.n, 0));
      for (const spec of f.units) {
        const these = units.filter((u) => u.unit.type === spec.type);
        expect(these, spec.type).toHaveLength(spec.n);
        for (const u of these) {
          expect(u.stats.final.maxHealth).toBeCloseTo(spec.hp * (1 + HP_PER_MIN * (f.firstS / 60)), 0);
          expect(u.stats.final.talonResist).toBeCloseTo(f.resists.talon, 2);
          expect(u.stats.final.songResist).toBeCloseTo(f.resists.song, 2);
        }
      }
    });

    it('§7.8 payout: each creature pays base × (1 + 0.015 × minutes) at death, rounded down, split between the killer and allied heroes who hit it in the last 5 s; no pods', async () => {
      const { sb, anchor, index, hero, ally } = await at(f, ['kingfisher']);
      sb.place(hero, anchor.pos);
      sb.place(ally!, anchor.pos);
      sb.step();
      sb.clearEvents();
      const unit = unitsOf(sb, index).find((u) => u.unit.type === f.units[0]!.type)!;
      hit(sb, ally!, unit.id, 1);
      sb.step();
      hit(sb, hero, unit.id, 10_000_000);
      sb.step(2);
      const m = minutes(sb);
      const total = f.units[0]!.seeds * (1 + SEEDS_PER_MIN * m);
      expect(earned(sb, hero, 'thicket')).toBe(Math.floor(total / 2));
      expect(earned(sb, ally!, 'thicket')).toBe(Math.floor(total / 2));
      expect(pickupsOf(sb, 'pod'), 'no pods from neutrals').toHaveLength(0);
    });

    it('§7.8 respawn: all at once, the table\'s time after the last creature dies; one survivor stops it', async () => {
      const { sb, anchor, index, hero } = await at(f);
      sb.place(hero, anchor.pos);
      sb.step();
      const all = unitsOf(sb, index);
      const spare = all[0]!;
      for (const u of all.slice(1)) hit(sb, hero, u.id, 10_000_000);
      sb.step(2);
      advanceBy(sb, f.respawnS + 5);
      expect(unitsOf(sb, index).filter((u) => !u.removed), 'one alive: no respawn').toHaveLength(1);
      expect(unitsOf(sb, index)[0]!.id).toBe(spare.id);
      hit(sb, hero, spare.id, 10_000_000);
      sb.step(2);
      expect(objectiveEvents(sb, 'campCleared').some((e) => e.camp === index)).toBe(true);
      const clearedAt = seconds(sb);
      if (f.family !== 'rats') {
        advanceTo(sb, clearedAt + f.respawnS - 3);
        expect(unitsOf(sb, index)).toHaveLength(0);
        advanceTo(sb, clearedAt + f.respawnS + 2);
        expect(unitsOf(sb, index), 'all together').toHaveLength(f.units.reduce((n, u) => n + u.n, 0));
      } else {
        advanceTo(sb, clearedAt + f.respawnS + 2);
        const feeder = sb.ctx.map.interactables?.findIndex((i) => i.kind === 'feeder' && i.camp === index) ?? -1;
        expect(feeder, 'every rat camp is a Granary hybrid with a Feeder (§7.14)').toBeGreaterThanOrEqual(0);
        expect(unitsOf(sb, index), 'rats wait for the Feeder to be broken too').toHaveLength(0);
      }
    });
  });

  it('§7.8 dormant: a camp sleeps until a hero is within 30 m; damage from a hero more than 35 m away does nothing and does not wake it', async () => {
    const f = FAMILIES[0]!;
    const { sb, anchor, index, hero } = await at(f);
    const unit = unitsOf(sb, index)[0]!;
    expect(unit.unit.asleep, 'asleep at spawn').toBe(true);
    sb.place(hero, { x: anchor.pos.x + SNIPE_M + 5, y: anchor.pos.y, z: anchor.pos.z });
    sb.step(2);
    const hp = unit.health.hp;
    hit(sb, hero, unit.id, 50);
    sb.step();
    expect(unit.health.hp, 'no sniping from a lane').toBe(hp);
    expect(unit.unit.asleep).toBe(true);
    sb.place(hero, { x: anchor.pos.x + WAKE_M - 5, y: anchor.pos.y, z: anchor.pos.z });
    sb.step(2);
    expect(unit.unit.asleep, 'a hero inside 30 m wakes it').toBeFalsy();
  });

  it('§7.8 aggro: the first damage to any creature wakes the whole camp', async () => {
    const f = FAMILIES[0]!;
    const { sb, anchor, index, hero } = await at(f);
    sb.place(hero, { x: anchor.pos.x + 20, y: anchor.pos.y, z: anchor.pos.z });
    sb.step();
    const units = unitsOf(sb, index);
    hit(sb, hero, units[0]!.id, 5);
    sb.step(2);
    for (const u of units) expect(u.unit.asleep, 'every creature awake').toBeFalsy();
    expect(sb.eventsOf('unit.state').filter((e) => e.state === 'awake').length).toBeGreaterThanOrEqual(units.length);
  });

  it('§7.8 beetle: 12 Talon bite every 1.0 s at 2.0 m reach, +0.5% damage per minute at spawn', async () => {
    const f = FAMILIES[0]!;
    const { sb, anchor, index, hero } = await at(f);
    sb.modify(hero, 'qa-hp', { stats: [{ stat: 'maxHealth', op: 'add', value: 100_000 }] });
    sb.place(hero, { x: anchor.pos.x + 1.5, y: anchor.pos.y, z: anchor.pos.z });
    const units = unitsOf(sb, index);
    sb.step();
    hit(sb, hero, units[0]!.id, 1);
    sb.clearEvents();
    advanceBy(sb, 5);
    const bites = sb.eventsOf('damage.applied').filter((e) => e.target === hero && units.some((u) => u.id === e.source));
    expect(bites.length, 'about one bite per beetle per second').toBeGreaterThanOrEqual(5);
    expect(bites[0]!.amount).toBeCloseTo(12 * (1 + DMG_PER_MIN * 2) * (1 - sb.hero(hero).stats.final.talonResist), 0);
  });

  it('§7.8 weasel: 22 Talon bite every 1.0 s; every 6 s a dash-bite, a 6 m lunge for 40 Talon', async () => {
    const f = FAMILIES[1]!;
    const { sb, anchor, index, hero } = await at(f);
    sb.modify(hero, 'qa-hp', { stats: [{ stat: 'maxHealth', op: 'add', value: 100_000 }] });
    sb.place(hero, { x: anchor.pos.x + 5, y: anchor.pos.y, z: anchor.pos.z });
    sb.step();
    hit(sb, hero, unitsOf(sb, index)[0]!.id, 1);
    sb.clearEvents();
    advanceBy(sb, 13);
    const dash = sb.eventsOf('unit.attack').filter((e) => e.attack === 'dashBite');
    expect(dash.length, 'a dash-bite roughly every 6 s').toBeGreaterThanOrEqual(2);
    const amounts = sb.eventsOf('damage.applied').filter((e) => e.target === hero).map((e) => Math.round(e.amount));
    expect(amounts.some((a) => a >= 40 * 0.9), 'a 40 Talon dash-bite').toBe(true);
    expect(amounts.some((a) => a >= 20 && a <= 24), 'a 22 Talon bite').toBe(true);
  });

  it('§7.8 rat (indoor): 10 Talon bite every 0.7 s; each bite applies 20% heal reduction for 2 s', async () => {
    const f = FAMILIES[2]!;
    const { sb, anchor, index, hero } = await at(f);
    sb.modify(hero, 'qa-hp', { stats: [{ stat: 'maxHealth', op: 'add', value: 100_000 }] });
    sb.place(hero, { x: anchor.pos.x + 1, y: anchor.pos.y, z: anchor.pos.z });
    sb.step();
    hit(sb, hero, unitsOf(sb, index)[0]!.id, 1);
    sb.clearEvents();
    advanceBy(sb, 3);
    expect(sb.hero(hero).stats.final.healReduction, '20% heal reduction while bitten').toBeCloseTo(0.2, 2);
    const bites = sb.eventsOf('damage.applied').filter((e) => e.target === hero && e.damageType === 'talon');
    expect(bites[0]!.amount).toBeCloseTo(10 * (1 + DMG_PER_MIN * 5) * (1 - sb.hero(hero).stats.final.talonResist), 0);
  });

  it('§7.8 toad (indoor): 30 Song tongue lash every 1.5 s at 16 m; every 8 s a slime spit makes a 3 m puddle for 4 s (20 Song per second, 30% slow)', async () => {
    const f = FAMILIES[3]!;
    const { sb, anchor, index, hero } = await at(f);
    sb.modify(hero, 'qa-hp', { stats: [{ stat: 'maxHealth', op: 'add', value: 100_000 }] });
    sb.place(hero, { x: anchor.pos.x + 12, y: anchor.pos.y, z: anchor.pos.z });
    sb.step();
    hit(sb, hero, unitsOf(sb, index)[0]!.id, 1);
    sb.clearEvents();
    advanceBy(sb, 10);
    const lashes = sb.eventsOf('unit.attack').filter((e) => e.attack === 'lash');
    expect(lashes.length, '12 m is inside the 16 m range').toBeGreaterThanOrEqual(4);
    expect(sb.eventsOf('unit.attack').filter((e) => e.attack === 'spit').length).toBeGreaterThanOrEqual(1);
    const song = sb.eventsOf('damage.applied').filter((e) => e.target === hero && e.damageType === 'song');
    expect(song[0]!.amount).toBeCloseTo(30 * (1 + DMG_PER_MIN * 5) * (1 - sb.hero(hero).stats.final.songResist), 0);
  });

  it('§7.8 badger: 50 Talon every 1.0 s; every 6 s a Slam (0.6 s telegraph, 6 m radius, 110 Song, 4 m knockback); cubs bite for 20 Talon', async () => {
    const f = FAMILIES[4]!;
    const { sb, anchor, index, hero } = await at(f);
    sb.modify(hero, 'qa-hp', { stats: [{ stat: 'maxHealth', op: 'add', value: 100_000 }] });
    sb.place(hero, { x: anchor.pos.x + 2, y: anchor.pos.y, z: anchor.pos.z });
    sb.step();
    const badger = unitsOf(sb, index).find((u) => u.unit.type === 'badger')!;
    hit(sb, hero, badger.id, 1);
    sb.clearEvents();
    const isSlam = () => sb.eventsOf('unit.attack').some((e) => e.attack === 'slam');
    expect(sb.stepUntil(isSlam, 8 * TICK_RATE), 'a Slam starts').not.toBeNull();
    const telegraph = sb.eventsOf('unit.attack').find((e) => e.attack === 'slam')!;
    expect((telegraph.impactAt - sb.sim.tick) / TICK_RATE, '0.6 s telegraph').toBeCloseTo(0.6, 1);
    advanceBy(sb, 13);
    const slams = sb.eventsOf('unit.attack').filter((e) => e.attack === 'slam');
    expect(slams.length).toBeGreaterThanOrEqual(2);
    const song = sb.eventsOf('damage.applied').find((e) => e.target === hero && e.damageType === 'song');
    expect(song!.amount).toBeCloseTo(110 * (1 + DMG_PER_MIN * 8) * (1 - sb.hero(hero).stats.final.songResist), 0);
    const bites = sb.eventsOf('damage.applied').filter((e) => e.target === hero && e.damageType === 'talon').map((e) => e.amount);
    expect(bites.some((a) => Math.abs(a - 50 * (1 + DMG_PER_MIN * 8)) < 2), 'the badger bite').toBe(true);
    expect(bites.some((a) => Math.abs(a - 20 * (1 + DMG_PER_MIN * 8)) < 1), 'a cub bite').toBe(true);
  });

  it('§7.8 leash: 18 m from the anchor; past it (or 6 s without damage) a creature walks home, heals to full, and the camp sleeps 5 s later', async () => {
    const f = FAMILIES[0]!;
    const { sb, anchor, index, hero } = await at(f);
    sb.modify(hero, 'qa-hp', { stats: [{ stat: 'maxHealth', op: 'add', value: 100_000 }] });
    sb.place(hero, { x: anchor.pos.x + 5, y: anchor.pos.y, z: anchor.pos.z });
    sb.step();
    const unit = unitsOf(sb, index)[0]!;
    hit(sb, hero, unit.id, 100);
    sb.step(10);
    sb.place(hero, { x: anchor.pos.x + LEASH_M + 25, y: anchor.pos.y, z: anchor.pos.z });
    advanceBy(sb, 8);
    expect(flat(unit.pos, anchor.pos), 'it did not follow past the leash plus 3 m').toBeLessThan(LEASH_M + 3 + 1);
    advanceBy(sb, 10);
    expect(unit.health.hp, 'healed to full').toBe(unit.stats.final.maxHealth);
    advanceBy(sb, 6);
    expect(unit.unit.asleep, 'asleep again').toBe(true);
  });

  it('§7.8 indoor camps stop at their room\'s doors: a hero outside never drags rats or toads out of the building', async () => {
    const f = FAMILIES[3]!;
    const { sb, anchor, index, hero } = await at(f);
    const building = sb.ctx.map.buildings![anchor.building!]!;
    sb.modify(hero, 'qa-hp', { stats: [{ stat: 'maxHealth', op: 'add', value: 100_000 }] });
    sb.place(hero, anchor.pos);
    sb.step();
    hit(sb, hero, unitsOf(sb, index)[0]!.id, 1);
    const door = building.footprint.centre;
    sb.place(hero, { x: door.x + building.footprint.size.x / 2 + 6, y: 0, z: door.z });
    advanceBy(sb, 12);
    for (const u of unitsOf(sb, index)) {
      expect(Math.abs(u.pos.x - door.x), 'inside the footprint in x').toBeLessThanOrEqual(building.footprint.size.x / 2 + 0.5);
      expect(Math.abs(u.pos.z - door.z), 'inside the footprint in z').toBeLessThanOrEqual(building.footprint.size.z / 2 + 0.5);
    }
  });
});
