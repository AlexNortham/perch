// Feather runes (GDD §7.10). Written test-first (D-EP-006, W4.5 QA): gated until sim/world lands them in wave 5.
// Run with PERCH_PENDING=1 npx vitest run tests/rules/runes.test.ts
import { describe, expect, it } from 'vitest';
import type { EntityId, PickupEntity, StatId } from '../../src/sim/core/contracts';
import { TICK_RATE } from '../../src/sim/data/core';
import type { Sandbox } from '../helpers/sandbox';
import { advanceBy, advanceTo, heavyMelee, lethal, lightMelee, mmss, objectiveEvents, pickupsOf, seconds, standBeside, world } from '../helpers/world';

const TIMEOUT_MS = 300_000;
const SPOTS = [{ x: -95, y: 6, z: 0 }, { x: 95, y: 6, z: 0 }] as const;
const DURATION_S = 150;
const T_FIRST = mmss(5);
const T_LAST = mmss(40);
const TYPES = ['swift', 'fierce', 'sage', 'stout'] as const;
type RuneType = (typeof TYPES)[number];

/** GDD §7.10 strength table: [stat, value at 5:00, value at 40:00]. */
const STRENGTH: Record<RuneType, readonly (readonly [StatId, number, number])[]> = {
  swift: [['sprintSpeed', 1.5, 3.0], ['stamina', 1, 2]],
  fierce: [['fireRate', 0.12, 0.3], ['magazine', 0.3, 0.6]],
  sage: [['songPower', 15, 60], ['cooldownReduction', 0.1, 0.2]],
  stout: [['maxHealth', 200, 700], ['healthRegen', 5, 35]],
};

const typeOf = (p: PickupEntity): RuneType => TYPES.find((t) => p.pickup.variant.includes(t))!;
const runes = (sb: Sandbox) => pickupsOf(sb, 'rune');
const pair = (sb: Sandbox) => runes(sb).map(typeOf).sort();
const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));

async function claimAt(timeS: number, seed = 1) {
  const sb = await world({ heroes: ['shrike', 'lyrebird'], seed });
  const hero = sb.heroes[0]!;
  advanceTo(sb, timeS + 0.5);
  const base = { ...sb.hero(hero).stats.final };
  const rune = runes(sb)[0]!;
  standBeside(sb, hero, rune.pos);
  heavyMelee(sb, hero);
  return { sb, hero, rune, base, type: typeOf(rune) };
}

describe.runIf(process.env.PERCH_PENDING === '1')('W5 Feather runes (§7.10)', { timeout: TIMEOUT_MS }, () => {
  it('§7.10 spots: one on each rune bridge, at (−95, 6, 0) and (95, 6, 0)', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    expect(sb.ctx.map.runeSpots.map((s) => [s.pos.x, s.pos.y, s.pos.z])).toEqual(SPOTS.map((s) => [s.x, s.y, s.z]));
  });

  it('§7.10 spawn: nothing before 5:00; at 5:00 a rune on both bridges at once with runeSpawned for each', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    advanceTo(sb, T_FIRST - 2);
    expect(runes(sb)).toHaveLength(0);
    expect(sb.ctx.objectives.runesAt).toBe(T_FIRST * TICK_RATE);
    advanceTo(sb, T_FIRST + 1);
    expect(runes(sb)).toHaveLength(2);
    expect(objectiveEvents(sb, 'runeSpawned')).toHaveLength(2);
    expect(runes(sb).map((r) => Math.round(r.pos.x)).sort((a, b) => a - b)).toEqual([-95, 95]);
  });

  it('§7.10 types: each spawn offers two different types; 10:00 offers the two the 5:00 spawn did not; later pairs differ from the pair before', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const pairs: string[][] = [];
    for (let t = T_FIRST; t <= T_LAST; t += mmss(5)) {
      advanceTo(sb, t + 1);
      const p = pair(sb);
      expect(new Set(p).size, `${t / 60}:00 offers two different types`).toBe(2);
      pairs.push(p);
    }
    expect(pairs[1], '10:00 is the complement of 5:00').toEqual(TYPES.filter((t) => !pairs[0]!.includes(t)).sort());
    for (let i = 1; i < pairs.length; i++) expect(pairs[i], `pair ${i} differs from pair ${i - 1}`).not.toEqual(pairs[i - 1]);
  });

  it('§7.10 an unclaimed rune is replaced by the next spawn', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    advanceTo(sb, T_FIRST + 1);
    const old = runes(sb).map((r) => r.id);
    advanceTo(sb, mmss(10, 1));
    expect(runes(sb)).toHaveLength(2);
    for (const r of runes(sb)) expect(old).not.toContain(r.id);
  });

  it('§7.10 claim: walking through does nothing and a light hit does nothing; a heavy melee hit on the 1.0 m sphere claims it', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const hero = sb.heroes[0]!;
    advanceTo(sb, T_FIRST + 1);
    const rune = runes(sb)[0]!;
    sb.place(hero, rune.pos);
    sb.step(2 * TICK_RATE);
    expect(objectiveEvents(sb, 'runeTaken'), 'walking through').toHaveLength(0);
    standBeside(sb, hero, rune.pos);
    lightMelee(sb, hero);
    expect(objectiveEvents(sb, 'runeTaken'), 'light melee').toHaveLength(0);
    heavyMelee(sb, hero);
    expect(objectiveEvents(sb, 'runeTaken')).toHaveLength(1);
    expect(objectiveEvents(sb, 'runeTaken')[0]!.hero).toBe(hero);
    expect(runes(sb), 'the other bridge keeps its rune').toHaveLength(1);
  });

  describe.each(TYPES)('%s feather strength', (type) => {
    for (const [label, at] of [['5:00', T_FIRST], ['22:30', mmss(22, 30)], ['40:00', T_LAST], ['45:00', mmss(45)]] as const) {
      it(`§7.10 claimed at ${label}: strength is linear from the 5:00 value to the 40:00 value and held after`, async () => {
        // Seeds 1–4 until the wanted type is on offer at this time.
        for (const seed of [1, 2, 3, 4, 5, 6]) {
          const sb = await world({ heroes: ['shrike', 'lyrebird'], seed });
          const hero = sb.heroes[0]!;
          advanceTo(sb, at + 0.5);
          const rune = runes(sb).find((r) => typeOf(r) === type);
          if (!rune) continue;
          const base = { ...sb.hero(hero).stats.final };
          standBeside(sb, hero, rune.pos);
          heavyMelee(sb, hero);
          const f = (seconds(sb) - T_FIRST) / (T_LAST - T_FIRST);
          for (const [stat, lo, hi] of STRENGTH[type]) {
            expect(sb.hero(hero).stats.final[stat] - base[stat], `${type} ${stat}`).toBeCloseTo(lerp(lo, hi, f), 1);
          }
          return;
        }
        throw new Error(`no ${type} rune on offer at ${label} in six seeded matches`);
      });
    }
  });

  it('§7.10 duration: 150 s, then gone; lost on death; a new rune replaces the one a hero holds', async () => {
    const { sb, hero, base, type } = await claimAt(T_FIRST);
    const [stat] = STRENGTH[type][0]!;
    const on = sb.hero(hero).stats.final[stat] - base[stat];
    expect(on).toBeGreaterThan(0);
    advanceBy(sb, DURATION_S - 5);
    expect(sb.hero(hero).stats.final[stat] - base[stat], 'still on at 145 s').toBeGreaterThan(0);
    advanceBy(sb, 8);
    expect(sb.hero(hero).stats.final[stat] - base[stat], 'off after 150 s').toBeCloseTo(0, 2);

    const second = await claimAt(T_FIRST, 2);
    const foe = second.sb.heroes[1] as EntityId;
    lethal(second.sb, foe, second.hero);
    second.sb.step(2);
    const [s2] = STRENGTH[second.type][0]!;
    expect(second.sb.hero(second.hero).stats.final[s2] - second.base[s2], 'lost on death').toBeCloseTo(0, 2);
  });

  it('§7.10 a new rune replaces the one a hero holds (they do not stack)', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const hero = sb.heroes[0]!;
    advanceTo(sb, T_FIRST + 1);
    const base = { ...sb.hero(hero).stats.final };
    const [a, b] = runes(sb) as [PickupEntity, PickupEntity];
    standBeside(sb, hero, a.pos);
    heavyMelee(sb, hero);
    standBeside(sb, hero, b.pos);
    heavyMelee(sb, hero);
    const statsOfB = STRENGTH[typeOf(b)].map(([s]) => s);
    const statsOfA = STRENGTH[typeOf(a)].map(([s]) => s);
    for (const s of statsOfA) expect(sb.hero(hero).stats.final[s], `A's ${s} is gone`).toBeCloseTo(base[s], 2);
    for (const s of statsOfB) expect(sb.hero(hero).stats.final[s]).not.toBeCloseTo(base[s], 2);
  });
});
