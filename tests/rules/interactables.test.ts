// The Stage 4 interactables (GDD §§7.13–7.15, §6.8, §8.8): Keepsakes, Bell Feeders, Berries, Hides, Bough Springs,
// Lookouts, ivy curtains, the Cellar Run and the Magpie Den. Written test-first (D-EP-006, W4.5 QA): gated until
// sim/world, physics, combat and items land them in wave 5.
// Run with PERCH_PENDING=1 npx vitest run tests/rules/interactables.test.ts
import { describe, expect, it } from 'vitest';
import { canSee, canSeeOnMap } from '../../src/sim/core/vision';
import { type EntityId, type BoxPrim, type InteractableAnchor, type RampPrim, type PickupEntity, type StatId, type StructureEntity, type Vec3 } from '../../src/sim/core/contracts';
import { TICK_RATE } from '../../src/sim/data/core';
import { COMBAT } from '../../src/sim/data/combat';
import type { Sandbox } from '../helpers/sandbox';
import { advanceTo, dist, earned, flat, heavyMelee, lightMelee, minutes, mmss, pickupsOf, seconds, standBeside, world } from '../helpers/world';

const TIMEOUT_MS = 300_000;
const BIG_HP = { stats: [{ stat: 'maxHealth', op: 'add', value: 1_000_000 }] } as const;

// ---- Keepsakes (§7.13) ----------------------------------------------------------------------------------------------

/** Spawn `n` keepsake pickups on the hero and let it collect them (reach 1.5 m, §7.9). */
function grantKeepsakes(sb: Sandbox, hero: EntityId, n: number): void {
  const at = { ...sb.hero(hero).pos };
  for (let i = 0; i < n; i++) {
    sb.ctx.store.spawn({ kind: 'pickup', team: 'neutral', pos: { ...at }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, radius: 0.5,
      pickup: { type: 'keepsake', variant: '', value: 0, expiresAt: null, carrier: null } });
    sb.step(2);
  }
}

describe.runIf(process.env.PERCH_PENDING === '1')('W5 Keepsakes (§7.13)', { timeout: TIMEOUT_MS }, () => {
  it('§7.13 each keepsake is one type drawn by weight; the strength is the time bucket\'s value (0–9:59, 10:00–29:59, 30:00+)', async () => {
    /** [stat, value in each bucket]. */
    const TABLE: readonly (readonly [StatId, readonly [number, number, number]])[] = [
      ['gunDamage', [0.025, 0.035, 0.05]], ['fireRate', [0.015, 0.02, 0.03]], ['magazine', [0.04, 0.06, 0.08]],
      ['maxHealth', [15, 25, 35]], ['songPower', [2, 3, 4]], ['talonResist', [0.0075, 0.01, 0.015]],
      ['songResist', [0.0075, 0.01, 0.015]], ['cooldownReduction', [0.005, 0.0075, 0.01]],
      ['moveSpeed', [0.1, 0.15, 0.2]], ['staminaRecharge', [0.02, 0.03, 0.04]],
    ];
    for (const [bucket, at] of [[0, mmss(5)], [1, mmss(15)], [2, mmss(35)]] as const) {
      const sb = await world({ heroes: ['shrike', 'lyrebird'] });
      const hero = sb.heroes[0]!;
      advanceTo(sb, at);
      grantKeepsakes(sb, hero, 12);
      const k = sb.hero(hero).keepsakes!;
      expect(k.count).toBe(12);
      for (const [stat, value] of Object.entries(k.totals) as [StatId, number][]) {
        const row = TABLE.find(([s]) => s === stat);
        expect(row, `${stat} is a keepsake stat`).toBeDefined();
        const n = value / row![1][bucket];
        expect(Math.abs(n - Math.round(n)), `${stat} total is a whole number of keepsakes at bucket ${bucket}`).toBeLessThan(0.01);
      }
      const sum = (Object.entries(k.totals) as [StatId, number][]).reduce((t, [s, v]) => t + Math.round(v / TABLE.find(([n]) => n === s)![1][bucket]), 0);
      expect(sum, 'twelve keepsakes, twelve draws').toBe(12);
    }
  });

  it('§7.13 the type received last has its weight halved for the next draw (repeats are rarer than independent draws)', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const hero = sb.heroes[0]!;
    advanceTo(sb, mmss(5));
    const seq: string[] = [];
    for (let i = 0; i < 1000; i++) {
      sb.clearEvents();
      grantKeepsakes(sb, hero, 1);
      const e = sb.eventsOf('objective').find((x) => x.action === 'keepsakeGained');
      seq.push(e?.variant ?? '?');
    }
    expect(seq.includes('?'), 'every pickup fires keepsakeGained with its variant').toBe(false);
    const repeats = seq.slice(1).filter((v, i) => v === seq[i]).length / (seq.length - 1);
    // Independent draws repeat 11.5% of the time (Σw² / (Σw)² for the §7.13 weights); with the halving, about 7%.
    expect(repeats).toBeLessThan(0.095);
    expect(new Set(seq).size, 'all ten types appear').toBe(10);
  });

  it('§7.13 keepsakes of one type add together and count as ONE source in the resist and CDR stacks (world:keepsakes)', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const hero = sb.heroes[0]!;
    advanceTo(sb, mmss(5));
    sb.modify(hero, 'qa-resist', { stats: [{ stat: 'talonResist', op: 'stack', value: 0.12 }, { stat: 'cooldownReduction', op: 'stack', value: 0.08 }] });
    grantKeepsakes(sb, hero, 60);
    expect(sb.hero(hero).stats.sources.has('world:keepsakes'), 'D-ARCH-024: one source').toBe(true);
    const { totals } = sb.hero(hero).keepsakes!;
    const f = sb.hero(hero).stats.final;
    expect(f.talonResist).toBeCloseTo(1 - (1 - 0.12) * (1 - (totals.talonResist ?? 0)), 3);
    expect(f.cooldownReduction).toBeCloseTo(1 - (1 - 0.08) * (1 - (totals.cooldownReduction ?? 0)), 3);
  });

  it('§7.13 caps from keepsakes alone: 15% per resist, 10% CDR, +2.0 m/s move speed', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const hero = sb.heroes[0]!;
    advanceTo(sb, mmss(35));
    grantKeepsakes(sb, hero, 600);
    const t = sb.hero(hero).keepsakes!.totals;
    expect(t.talonResist).toBeCloseTo(0.15, 3);
    expect(t.songResist).toBeCloseTo(0.15, 3);
    expect(t.cooldownReduction).toBeCloseTo(0.1, 3);
    expect(t.moveSpeed).toBeCloseTo(2, 2);
  });

  it('§7.13 keepsakes survive death and last the match; the hero view carries the count for the HUD', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const [hero, foe] = sb.heroes as [EntityId, EntityId];
    advanceTo(sb, mmss(5));
    grantKeepsakes(sb, hero, 5);
    sb.apply({ kind: 'damage', amount: 1_000_000, type: 'talon' }, hero, sb.cause(foe, { via: 'weapon' }));
    sb.step(2);
    expect(sb.hero(hero).keepsakes!.count).toBe(5);
    expect(sb.view.heroes.find((h) => h.id === hero)?.keepsakes?.count, 'HeroView.keepsakes').toBe(5);
  });
});

// ---- Bell Feeders (§7.14) -------------------------------------------------------------------------------------------

const feederAnchors = (sb: Sandbox): InteractableAnchor[] => (sb.ctx.map.interactables ?? []).filter((i) => i.kind === 'feeder');
const feeders = (sb: Sandbox): StructureEntity[] =>
  sb.ctx.store.list('structure').filter((s) => s.structure.variant === 'feeder' && !s.removed);
const FEEDER_QUARTER = [[58, 13.5, 38], [21, 5.2, 101]] as const;

async function feederWorld() {
  const sb = await world({ heroes: ['shrike', { hero: 'kingfisher', team: 'dawn' }, 'lyrebird'] });
  advanceTo(sb, mmss(8, 1));
  const [hero, ally, foe] = sb.heroes as [EntityId, EntityId, EntityId];
  const feeder = feeders(sb)[0]!;
  sb.modify(hero, 'qa-hp', BIG_HP);
  sb.modify(ally, 'qa-hp', BIG_HP);
  standBeside(sb, hero, feeder.pos);
  return { sb, hero, ally, foe, feeder, F: 300 + 3 * minutes(sb) };
}

describe.runIf(process.env.PERCH_PENDING === '1')('W5 Bell Feeders (§7.14)', { timeout: TIMEOUT_MS }, () => {
  it('§7.14 where: 8 on the map, at each Bell Tower belfry and Granary loft (mirrored), the Granary ones tied to the Rat camp', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const anchors = feederAnchors(sb);
    expect(anchors).toHaveLength(8);
    for (const [x, y, z] of FEEDER_QUARTER) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        expect(anchors.some((a) => Math.abs(a.pos.x - sx * x) < 1.5 && Math.abs(a.pos.y - y) < 1 && Math.abs(a.pos.z - sz * z) < 1.5), `(${sx * x}, ${y}, ${sz * z})`).toBe(true);
      }
    }
    expect(anchors.filter((a) => a.camp !== undefined), 'Granary hybrids').toHaveLength(4);
  });

  it('§7.14 spawn at 8:00 with 480 HP; only melee damages it (a light hit 60, a heavy hit 120); bullets and abilities do nothing', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    advanceTo(sb, mmss(7, 59));
    expect(feeders(sb)).toHaveLength(0);
    advanceTo(sb, mmss(8, 1));
    expect(feeders(sb)).toHaveLength(8);
    const [hero] = sb.heroes as [EntityId];
    const f = feeders(sb)[0]!;
    expect(f.stats.final.maxHealth).toBe(480);
    sb.apply({ kind: 'damage', amount: 500, type: 'talon' }, f.id, sb.cause(hero, { via: 'weapon' }));
    sb.apply({ kind: 'damage', amount: 500, type: 'song' }, f.id, sb.cause(hero, { via: 'ability' }));
    sb.step();
    expect(f.health.hp, 'not by bullets or abilities').toBe(480);
    sb.modify(hero, 'qa-hp', BIG_HP);
    standBeside(sb, hero, f.pos);
    lightMelee(sb, hero);
    expect(f.health.hp, 'light hit: 60, whatever the level or items').toBe(420);
    heavyMelee(sb, hero);
    expect(f.health.hp, 'heavy hit: 120').toBe(300);
  });

  it('§7.14 swing-back: each melee hit costs the hitter 70 Song damage (resists apply), except while the Feeder chimes', async () => {
    const { sb, hero, feeder } = await feederWorld();
    sb.clearEvents();
    lightMelee(sb, hero);
    const swing = sb.eventsOf('damage.applied').find((e) => e.target === hero && e.damageType === 'song')!;
    expect(swing.amount).toBeCloseTo(70 * (1 - sb.hero(hero).stats.final.songResist), 0);
    while (feeder.health.hp > 180 + 1) lightMelee(sb, hero);
    lightMelee(sb, hero);
    expect(feeder.health.hp).toBeLessThanOrEqual(180);
    sb.clearEvents();
    lightMelee(sb, hero);
    expect(sb.eventsOf('damage.applied').filter((e) => e.target === hero && e.damageType === 'song'), 'no swing-back while it chimes').toHaveLength(0);
  });

  it('§7.14 seeds: F = 300 + 3 × minutes set at the first hit; a light hit pays F/16, a heavy hit F/8', async () => {
    const { sb, hero, F } = await feederWorld();
    sb.clearEvents();
    lightMelee(sb, hero);
    expect(earned(sb, hero, 'objective')).toBe(Math.floor(F / 16));
    sb.clearEvents();
    heavyMelee(sb, hero);
    expect(earned(sb, hero, 'objective')).toBe(Math.floor(F / 8));
  });

  it('§7.14 chime: at 180 HP the lamp is lit 0.5 s in every 1.5 s (60%) or 0.3 s in every 1.0 s (40%); no swing-back while it chimes', async () => {
    const { sb, hero, feeder } = await feederWorld();
    while (feeder.health.hp > 180) heavyMelee(sb, hero);
    const samples: boolean[] = [];
    for (let i = 0; i < 6 * TICK_RATE; i++) {
      sb.step();
      samples.push(feeder.structure.lit === true);
    }
    const lit = samples.filter(Boolean).length / samples.length;
    const shortLit = Math.abs(lit - 0.5 / 1.5) < 0.06;
    const longLit = Math.abs(lit - 0.3 / 1.0) < 0.06;
    expect(shortLit || longLit, `lit fraction ${lit.toFixed(2)} is 1/3 or 3/10`).toBe(true);
  });

  it('§7.14 the breaking hit also pays F/2, split evenly among the heroes who hit it in the last 5 s', async () => {
    const { sb, hero, ally, feeder, F } = await feederWorld();
    standBeside(sb, ally, feeder.pos, 1.2);
    while (feeder.health.hp > 120) lightMelee(sb, hero);
    lightMelee(sb, ally);
    sb.clearEvents();
    while (!feeder.health.dead && !feeder.removed) heavyMelee(sb, hero);
    const half = Math.floor(F / 2 / 2);
    expect(earned(sb, ally, 'objective'), 'the ally who hit in the last 5 s shares the F/2').toBeGreaterThanOrEqual(half);
  });

  it('§7.14 full chime: a breaking hit while the lamp is lit gives 1 keepsake for a light hit, 3 for a heavy hit; off the beat, seeds only', async () => {
    for (const heavy of [false, true]) {
      const { sb, hero, feeder } = await feederWorld();
      while (feeder.health.hp > 180) heavyMelee(sb, hero);
      // Reduce to the last hit, then wait for a lit moment.
      while (feeder.health.hp > (heavy ? 120 : 60)) lightMelee(sb, hero);
      expect(sb.stepUntil(() => feeder.structure.lit === true, 3 * TICK_RATE), 'the lamp lights').not.toBeNull();
      if (heavy) {
        // A heavy hit lands 0.6 s after its press, longer than either lit window (D-OBJ-013): press ahead of the beat
        // so it lands just after the lamp next lights.
        const start = sb.sim.tick;
        sb.stepUntil(() => feeder.structure.lit === false, 3 * TICK_RATE);
        sb.stepUntil(() => feeder.structure.lit === true, 3 * TICK_RATE);
        const period = sb.sim.tick - start;
        sb.step(period - Math.round(COMBAT.melee.heavyWindupS * TICK_RATE) + 2);
        heavyMelee(sb, hero);
      } else lightMelee(sb, hero);
      expect(sb.hero(hero).keepsakes?.count ?? 0, heavy ? 'heavy on the beat: 3' : 'light on the beat: 1').toBe(heavy ? 3 : 1);
    }
    const { sb, hero, feeder } = await feederWorld();
    while (feeder.health.hp > 180) heavyMelee(sb, hero);
    while (feeder.health.hp > 60) lightMelee(sb, hero);
    expect(sb.stepUntil(() => feeder.structure.lit === false, 3 * TICK_RATE)).not.toBeNull();
    lightMelee(sb, hero);
    expect(sb.hero(hero).keepsakes?.count ?? 0, 'off the beat: seeds only').toBe(0);
  });

  it('§7.14 respawn: 5:00 after it breaks (Granary: 5:00 after both the Feeder and its Rat camp are cleared)', async () => {
    const { sb, hero, feeder } = await feederWorld();
    const idx = feeder.structure.anchor!;
    while (!feeder.health.dead && !feeder.removed) heavyMelee(sb, hero);
    const at = seconds(sb);
    advanceTo(sb, at + mmss(5) - 3);
    expect(sb.ctx.objectives.interactableAt?.[idx], 'scheduled').not.toBeNull();
    advanceTo(sb, at + mmss(5) + 3);
    expect(feeders(sb).some((f) => f.structure.anchor === idx), 'back after 5:00').toBe(true);
  });
});

// ---- Berries, Hides, Springs, Lookouts, ivy, Cellar Run, Magpie Den (§7.15) -----------------------------------------

const berries = (sb: Sandbox): PickupEntity[] => pickupsOf(sb, 'berry');
const hides = (sb: Sandbox) => (sb.ctx.map.rooms ?? []).filter((r) => r.tag === 'hide');
const tunnels = (sb: Sandbox) => (sb.ctx.map.rooms ?? []).filter((r) => r.tag === 'tunnel');
const floorOf = (r: { volume: { centre: Vec3; size: Vec3 } }): Vec3 => ({ x: r.volume.centre.x, y: r.volume.centre.y - r.volume.size.y / 2, z: r.volume.centre.z });

describe.runIf(process.env.PERCH_PENDING === '1')('W5 Berries (§7.15)', { timeout: TIMEOUT_MS }, () => {
  it('§7.15 Berries: 22 on the map, first at 2:30; eating (within 1.2 m) heals 15% of max HP over 4 s; respawns 3:00 after eaten', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const [hero, foe] = sb.heroes as [EntityId, EntityId];
    advanceTo(sb, mmss(2, 29));
    expect(berries(sb)).toHaveLength(0);
    advanceTo(sb, mmss(2, 31));
    expect(berries(sb)).toHaveLength(22);
    const b = berries(sb)[0]!;
    const max = sb.hero(hero).stats.final.maxHealth;
    sb.apply({ kind: 'damage', amount: max * 0.6, type: 'talon' }, hero, sb.cause(foe, { via: 'weapon' }));
    sb.step();
    const hurt = sb.health(hero).hp;
    sb.place(hero, { x: b.pos.x - 2, y: b.pos.y, z: b.pos.z });
    sb.step(TICK_RATE);
    expect(b.removed, 'not eaten from 2 m').toBeFalsy();
    sb.place(hero, { x: b.pos.x - 1.1, y: b.pos.y, z: b.pos.z });
    sb.step(2);
    expect(sb.eventsOf('objective').filter((e) => e.action === 'berryEaten' && e.hero === hero)).toHaveLength(1);
    sb.step(2 * TICK_RATE);
    expect(sb.health(hero).hp - hurt, 'half the heal after 2 s').toBeCloseTo(max * 0.15 / 2, -1);
    sb.step(2 * TICK_RATE + 6);
    expect(sb.health(hero).hp - hurt, '15% of max HP in all').toBeCloseTo(max * 0.15, 0);
    const eaten = seconds(sb);
    advanceTo(sb, eaten + mmss(3) - 6);
    expect(berries(sb)).toHaveLength(21);
    advanceTo(sb, eaten + mmss(3) + 6);
    expect(berries(sb)).toHaveLength(22);
  });
});

describe.runIf(process.env.PERCH_PENDING === '1')('W5 Hides (§7.15)', { timeout: TIMEOUT_MS }, () => {
  async function hide() {
    const sb = await world({ heroes: ['shrike', { hero: 'kingfisher', team: 'dawn' }, 'lyrebird'] });
    const [hero, ally, foe] = sb.heroes as [EntityId, EntityId, EntityId];
    const room = hides(sb)[0]!;
    const inside = floorOf(room);
    sb.place(foe, { x: 0, y: 0, z: 0 });
    sb.place(ally, { x: inside.x + 40, y: 0, z: inside.z });
    sb.place(hero, inside);
    sb.step(3);
    return { sb, hero, ally, foe, room, inside };
  }

  it('§7.15 map: 8 Hides', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    expect(hides(sb)).toHaveLength(8);
  });

  it('§7.15 hidden: a hero wholly inside has the hidden condition, enemies outside cannot see it and it leaves their minimap; allies see it', async () => {
    const { sb, hero, ally, foe } = await hide();
    expect(sb.hero(hero).stats.conditions.has('hidden')).toBe(true);
    expect(canSee('dusk', sb.hero(hero)), 'enemy outside').toBe(false);
    expect(canSeeOnMap('dusk', sb.hero(hero)), 'enemy minimap').toBe(false);
    expect(canSee('dawn', sb.hero(hero)), 'allies see each other').toBe(true);
    expect(sb.hero(ally).stats.conditions.has('hidden')).toBe(false);
    expect(foe).toBeDefined();
  });

  it('§7.15 inside a Hide: regenerates 3 HP/s + 0.25% of max HP per second and stamina 100% faster', async () => {
    const { sb, hero, foe } = await hide();
    sb.apply({ kind: 'damage', amount: 400, type: 'talon' }, hero, sb.cause(foe, { via: 'weapon' }));
    sb.step();
    const hp = sb.health(hero).hp;
    sb.step(10 * TICK_RATE);
    const max = sb.hero(hero).stats.final.maxHealth;
    expect(sb.health(hero).hp - hp, '10 s').toBeCloseTo(10 * (3 + 0.0025 * max), 0);
    expect(sb.hero(hero).stats.final.staminaRecharge, '+100% stamina regeneration').toBeGreaterThan(0);
  });

  it('§7.15 it shows for 2 s after it deals damage or applies a status to an enemy; true sight reveals it; an enemy in the same Hide sees it', async () => {
    const { sb, hero, foe, inside } = await hide();
    sb.apply({ kind: 'damage', amount: 10, type: 'talon' }, foe, sb.cause(hero, { via: 'weapon' }));
    sb.step();
    expect(canSee('dusk', sb.hero(hero)), 'seen right after dealing damage').toBe(true);
    sb.step(Math.ceil(2.2 * TICK_RATE));
    expect(canSee('dusk', sb.hero(hero)), 'hidden again after 2 s').toBe(false);
    sb.modify(foe, 'qa-sight', { conditions: ['trueSight'], stats: [{ stat: 'trueSightRadius', op: 'add', value: 60 }] });
    sb.place(foe, { x: inside.x + 20, y: 0, z: inside.z });
    sb.step(2);
    expect(canSee('dusk', sb.hero(hero)), 'true sight reveals').toBe(true);
    sb.modify(foe, 'qa-sight', null);
    sb.place(foe, { x: inside.x + 0.5, y: inside.y, z: inside.z + 0.5 });
    sb.step(2);
    expect(canSee('dusk', sb.hero(hero)), 'an enemy in the same Hide sees it').toBe(true);
  });
});

describe.runIf(process.env.PERCH_PENDING === '1')('W5 Bough Springs (§7.15)', { timeout: TIMEOUT_MS }, () => {
  it('§7.15 map: 8 Springs; the first pad (−68, 0, −44) lands at (−63, 9, −38) with apex 11 m', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const springs = sb.ctx.map.springs ?? [];
    expect(springs).toHaveLength(8);
    const s = springs.find((p) => Math.abs(Math.abs(p.pad.x) - 68) < 1 && Math.abs(Math.abs(p.pad.z) - 44) < 1)!;
    expect(s.radius).toBeCloseTo(1.2, 1);
    expect(s.apexY).toBeCloseTo(11, 0);
    expect(Math.abs(s.land.x)).toBeCloseTo(63, 0);
    expect(s.land.y).toBeCloseTo(9, 0);
  });

  it('§7.15 launch: stepping onto the pad flies the hero to its landing point over the authored apex', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const [hero] = sb.heroes as [EntityId];
    const s = sb.ctx.map.springs![0]!;
    sb.place(hero, { x: s.pad.x - 3, y: s.pad.y, z: s.pad.z });
    sb.step(2);
    sb.move(hero, 1);
    let top = -Infinity;
    for (let i = 0; i < 4 * TICK_RATE; i++) {
      sb.step();
      top = Math.max(top, sb.hero(hero).pos.y);
    }
    expect(top, 'the arc peaks near its apex').toBeGreaterThan(s.apexY - 1.5);
    expect(dist(sb.hero(hero).pos, s.land), 'lands within a few metres of the landing point').toBeLessThan(4);
  });

  it('§7.15 once per hero per 1.0 s; grounded heroes and the Egg carrier cannot use it', async () => {
    const sb = await world({ heroes: ['shrike', { hero: 'kingfisher', team: 'dawn' }, 'lyrebird'] });
    const [a, b] = sb.heroes as [EntityId, EntityId];
    const s = sb.ctx.map.springs![0]!;
    sb.modify(a, 'qa-grounded', { conditions: ['grounded'] });
    sb.modify(b, 'qa-egg', { conditions: ['eggCarrier'] });
    for (const h of [a, b]) sb.place(h, s.pad);
    sb.step(TICK_RATE);
    expect(sb.hero(a).pos.y, 'grounded: no launch').toBeLessThan(s.pad.y + 1);
    expect(sb.hero(b).pos.y, 'Egg carrier: no launch').toBeLessThan(s.pad.y + 1);
  });

  it('§7.15 clipped launch: an enemy hero\'s damage in the first 0.6 s zeroes vertical speed and slows the rider 30% for 1.5 s', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const [hero, foe] = sb.heroes as [EntityId, EntityId];
    const s = sb.ctx.map.springs![0]!;
    sb.modify(hero, 'qa-hp', BIG_HP);
    sb.place(hero, s.pad);
    sb.step(Math.ceil(0.3 * TICK_RATE));
    sb.apply({ kind: 'damage', amount: 20, type: 'talon' }, hero, sb.cause(foe, { via: 'weapon' }));
    sb.step();
    expect(sb.hero(hero).vel.y, 'vertical speed dropped to 0 or below').toBeLessThanOrEqual(0.5);
    expect(sb.hero(hero).stats.final.slow, '30% slow').toBeCloseTo(0.3, 2);
    sb.step(Math.ceil(1.7 * TICK_RATE));
    expect(sb.hero(hero).stats.final.slow, 'over after 1.5 s').toBeCloseTo(0, 2);
  });
});

describe.runIf(process.env.PERCH_PENDING === '1')('W5 Lookouts (§7.15)', { timeout: TIMEOUT_MS }, () => {
  it('§7.15 map: 14 Lookouts', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    expect((sb.ctx.map.interactables ?? []).filter((i) => i.kind === 'lookout')).toHaveLength(14);
  });

  it('§7.15 within 3 m of a Lookout the sight radius is 60 m instead of 40 m: an enemy 50 m away is seen only from the Lookout', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const [hero, foe] = sb.heroes as [EntityId, EntityId];
    const lookout = (sb.ctx.map.interactables ?? []).find((i) => i.kind === 'lookout')!;
    const far = { x: lookout.pos.x, y: lookout.pos.y, z: lookout.pos.z + (lookout.pos.z > 0 ? -50 : 50) };
    sb.place(foe, far);
    sb.place(hero, { x: lookout.pos.x + 20, y: 0, z: lookout.pos.z });
    sb.step(3);
    expect(canSee('dawn', sb.hero(foe)), 'beyond the 40 m default').toBe(false);
    sb.place(hero, { x: lookout.pos.x + 1, y: lookout.pos.y, z: lookout.pos.z });
    sb.step(3);
    expect(canSee('dawn', sb.hero(foe)), 'inside 60 m from the Lookout').toBe(true);
  });
});

describe.runIf(process.env.PERCH_PENDING === '1')('W5 ivy curtains (§6.8, §7.15)', { timeout: TIMEOUT_MS }, () => {
  async function curtain() {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const [hero, foe] = sb.heroes as [EntityId, EntityId];
    const opening = (sb.ctx.map.openings ?? []).find((o) => o.curtain)!;
    const prim = (sb.ctx.map.prims.filter((p) => p.shape !== 'cylinder' && p.blocks === 'sight') as (BoxPrim | RampPrim)[]).sort((x, y) => dist(x.centre, opening.centre) - dist(y.centre, opening.centre))[0]!;
    const alongX = prim.size.x < prim.size.z;
    const at = (d: number): Vec3 => ({ x: opening.centre.x + (alongX ? d : 0), y: opening.centre.y - opening.height / 2, z: opening.centre.z + (alongX ? 0 : d) });
    return { sb, hero, foe, opening, at, alongX };
  }

  it('§6.8 map: 32 ivy curtains, each a curtain Opening with a sight-blocking prim', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    expect((sb.ctx.map.openings ?? []).filter((o) => o.curtain)).toHaveLength(32);
    expect(sb.ctx.map.prims.filter((p) => p.blocks === 'sight').length).toBeGreaterThanOrEqual(32);
  });

  it('§6.8 a curtain blocks sight both ways beyond 3 m, and not within 3 m', async () => {
    const { sb, hero, foe, at } = await curtain();
    sb.place(hero, at(-6));
    sb.place(foe, at(6));
    sb.step(3);
    expect(canSee('dusk', sb.hero(hero)), 'foe cannot see through').toBe(false);
    expect(canSee('dawn', sb.hero(foe)), 'hero cannot see through').toBe(false);
    sb.place(hero, at(-2.5));
    sb.place(foe, at(2.5));
    sb.step(3);
    expect(canSee('dawn', sb.hero(foe)), 'within 3 m sees through').toBe(true);
  });

  it('§6.8 a curtain never blocks movement or shots', async () => {
    const { sb, hero, foe, at, alongX, opening } = await curtain();
    sb.place(foe, at(4));
    sb.place(hero, at(-4));
    sb.step(3);
    const hp = sb.health(foe).hp;
    sb.aimAt(hero, sb.pointOf(foe));
    sb.fire(hero);
    sb.step(TICK_RATE);
    sb.fire(hero, false);
    expect(sb.health(foe).hp, 'bullets pass').toBeLessThan(hp);
    sb.place(hero, at(-3));
    sb.aimAt(hero, { ...at(4), y: at(4).y + 1.5 });
    sb.move(hero, 1);
    sb.step(TICK_RATE);
    const crossed = alongX ? sb.hero(hero).pos.x - opening.centre.x : sb.hero(hero).pos.z - opening.centre.z;
    expect(crossed, 'walked through the curtain').toBeGreaterThan(0.5);
  });
});

describe.runIf(process.env.PERCH_PENDING === '1')('W5 the Cellar Run and the Magpie Den (§7.15, §8.8)', { timeout: TIMEOUT_MS }, () => {
  it('§7.15 map: 2 Cellar Run tunnels', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    expect(tunnels(sb)).toHaveLength(2);
  });

  it('§7.15 inside the tunnel a hero runs 30% faster than outside', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    const hero = sb.heroes[0]!;
    const room = tunnels(sb)[0]!;
    const run = (from: Vec3): number => {
      sb.place(hero, from);
      sb.look(hero, Math.PI / 2);
      sb.step(10);
      const x0 = sb.hero(hero).pos.x;
      sb.move(hero, 1);
      sb.step(TICK_RATE);
      sb.move(hero, 0);
      return Math.abs(sb.hero(hero).pos.x - x0);
    };
    const f = floorOf(room);
    const inside = run({ x: f.x - 10, y: f.y, z: f.z });
    const outside = run({ x: 0, y: 0, z: -20 });
    expect(inside / outside).toBeCloseTo(1.3, 1);
  });

  it('§7.15 the Egg carrier cannot enter: the stair heads block the carrier only', async () => {
    const sb = await world({ heroes: ['shrike', { hero: 'kingfisher', team: 'dawn' }, 'lyrebird'] });
    const [carrier, other] = sb.heroes as [EntityId, EntityId];
    const stair = (sb.ctx.map.openings ?? []).find((o) => o.blocksEggCarrier)!;
    expect(stair, 'a stair-head opening blocks the Egg carrier').toBeDefined();
    sb.modify(carrier, 'qa-egg', { conditions: ['eggCarrier'] });
    for (const h of [carrier, other]) {
      sb.place(h, { x: stair.centre.x, y: stair.centre.y - stair.height / 2 + 0.05, z: stair.centre.z - 3 });
      sb.look(h, 0);
      sb.move(h, 1);
    }
    sb.step(3 * TICK_RATE);
    expect(sb.hero(other).pos.y, 'an ordinary hero goes down the stairs').toBeLessThan(stair.centre.y - stair.height / 2 - 1);
    expect(sb.hero(carrier).pos.y, 'the carrier stays above').toBeGreaterThan(stair.centre.y - stair.height / 2 - 1);
  });

  it('§7.15 Magpie Den: 2 neutral shops with a 5 m zone; either flock can buy there (§8.8), and not from outside the zone', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'], startSeeds: 5_000 });
    const [dawn, dusk] = sb.heroes as [EntityId, EntityId];
    const dens = sb.ctx.map.shops.filter((s) => s.neutral);
    expect(dens).toHaveLength(2);
    for (const d of dens) expect(d.radius).toBeCloseTo(5, 1);
    const den = dens[0]!;
    sb.place(dawn, { x: den.pos.x + 7, y: den.pos.y, z: den.pos.z });
    sb.trade(dawn, { buy: 'quick-refrain' });
    sb.step(2);
    expect(sb.hero(dawn).inventory.items.some((i) => i.item === 'quick-refrain'), 'outside the 5 m zone').toBe(false);
    for (const h of [dawn, dusk]) {
      sb.place(h, { x: den.pos.x + 1, y: den.pos.y, z: den.pos.z });
      sb.trade(h, { buy: 'quick-refrain' });
      sb.step(2);
      expect(sb.hero(h).inventory.items.some((i) => i.item === 'quick-refrain'), `${sb.hero(h).team} buys at the Den`).toBe(true);
    }
    expect(flat(den.pos, sb.ctx.map.shops.find((s) => s.neutral && s !== den)!.pos)).toBeGreaterThan(20);
  });
});
