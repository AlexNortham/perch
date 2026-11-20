// The Roc and the Phoenix Embers (GDD §7.12). Written test-first (D-EP-006, W4.5 QA): gated until sim/world, combat
// and economy land them in wave 5. Run with PERCH_PENDING=1 npx vitest run tests/rules/roc-embers.test.ts
import { describe, expect, it } from 'vitest';
import type { EntityId, UnitEntity, Vec3 } from '../../src/sim/core/contracts';
import { TICK_RATE } from '../../src/sim/data/core';
import type { Sandbox } from '../helpers/sandbox';
import { advanceBy, advanceTo, earned, flat, heavyMelee, lethal, lightMelee, minutes, mmss, objectiveEvents, pickupsOf, seconds, standBeside, world } from '../helpers/world';

const TIMEOUT_MS = 300_000;
const WAKE_S = mmss(20);
const BASE_HP = 24_000;
const HP_PER_MIN = 300;
const EMBER_SPOTS: readonly Vec3[] = [{ x: 10, y: -10, z: 0 }, { x: -5, y: -10, z: 8.66 }, { x: -5, y: -10, z: -8.66 }];
const EMBER_FALL_S = 6;
const EMBER_BURN_S = 60;
const REKINDLE_S = 180;
const REVIVE_S = 3;
/** Open Hollow floor away from the Embers; the west ramp covers x −22…−6 at z −2…2 (a hero placed in it falls through). */
const FLOOR: Vec3 = { x: -8, y: -10, z: 4 };
const BRIDGE: Vec3 = { x: 0, y: 0, z: 10 };

const roc = (sb: Sandbox): UnitEntity => sb.ctx.store.list('unit').find((u) => u.unit.type === 'roc')!;
const hit = (sb: Sandbox, source: EntityId, target: EntityId, amount: number, type: 'talon' | 'song' = 'talon') =>
  sb.apply({ kind: 'damage', amount, type }, target, sb.cause(source, { via: 'weapon' }));

async function woken() {
  const sb = await world({ heroes: ['shrike', { hero: 'kingfisher', team: 'dawn' }, 'lyrebird'] });
  const [a, b, foe] = sb.heroes as [EntityId, EntityId, EntityId];
  // Woken at 0:30 through objectives.rocAt, the same code path as 20:00 (the wake test checks 20:00 itself): eighteen
  // tests each simulating twenty minutes first took over six minutes (W5a integration).
  advanceTo(sb, 30);
  sb.ctx.objectives.rocAt = sb.sim.tick + 1;
  sb.step(2);
  expect(roc(sb)?.unit.asleep, '§7.12 the Roc is awake').toBe(false);
  return { sb, a, b, foe, r: roc(sb) };
}

/** Kill the Roc with Dawn hero `a` standing in the Hollow; returns the sandbox positioned after the death. */
async function slain() {
  const w = await woken();
  w.sb.place(w.a, FLOOR);
  w.sb.step();
  w.sb.clearEvents();
  hit(w.sb, w.a, w.r.id, 1_000_000);
  w.sb.step(2);
  return w;
}

describe('W5 the Roc (§7.12)', { timeout: TIMEOUT_MS }, () => {
  it('§7.12 wake: asleep before 20:00 (countdown on objectives.rocAt), 24,000 HP when it wakes, rocSpawned fires', async () => {
    const sb = await world({ heroes: ['shrike', 'lyrebird'] });
    advanceTo(sb, WAKE_S - 5);
    expect(sb.ctx.objectives.rocAt, 'HUD countdown source').toBe(WAKE_S * TICK_RATE);
    expect(roc(sb)?.unit.asleep ?? true, 'asleep before the wake').toBe(true);
    advanceTo(sb, WAKE_S + 1);
    expect(objectiveEvents(sb, 'rocSpawned')).toHaveLength(1);
    expect(roc(sb).unit.asleep).toBeFalsy();
    expect(roc(sb).stats.final.maxHealth).toBeCloseTo(BASE_HP, -2);
  });

  it('§7.12 HP: +300 max HP per minute it lives, current HP rising with it', async () => {
    const { sb, r } = await woken();
    const start = r.stats.final.maxHealth;
    advanceBy(sb, 120);
    expect(r.stats.final.maxHealth - start).toBeCloseTo(2 * HP_PER_MIN, -1);
    expect(r.health.hp, 'current HP rises with it').toBeCloseTo(r.stats.final.maxHealth, -1);
  });

  it('§7.12 regeneration: 15 HP/s', async () => {
    const { sb, a, r } = await woken();
    sb.place(a, FLOOR);
    sb.step();
    hit(sb, a, r.id, 5_000);
    sb.step();
    const low = r.health.hp;
    sb.step(5 * TICK_RATE);
    expect(r.health.hp - low, '5 s of regeneration').toBeCloseTo(75, -1);
  });

  it('§7.12 resists: 15% Talon, 0% Song', async () => {
    const { sb, a, r } = await woken();
    sb.place(a, FLOOR);
    sb.step();
    sb.clearEvents();
    hit(sb, a, r.id, 1_000, 'talon');
    hit(sb, a, r.id, 1_000, 'song');
    sb.step();
    const [t, s] = sb.eventsOf('damage.applied').filter((e) => e.target === r.id);
    expect(t!.amount).toBeCloseTo(850, 0);
    expect(s!.amount).toBeCloseTo(1_000, 0);
  });

  it('§7.12 who can hurt it: only heroes inside the Hollow (y ≤ −2); the bridge and the rim do nothing', async () => {
    const { sb, a, b, r } = await woken();
    sb.place(a, BRIDGE);
    sb.place(b, FLOOR);
    sb.step();
    const full = r.health.hp;
    hit(sb, a, r.id, 2_000);
    sb.step();
    expect(r.health.hp, 'from the bridge: nothing').toBeGreaterThanOrEqual(full - 1);
    hit(sb, b, r.id, 2_000);
    sb.step();
    expect(r.health.hp, 'from the floor: damage').toBeLessThan(full - 1_000);
  });

  it('§7.12 aggro: with nobody inside the Hollow it never attacks', async () => {
    const { sb, a } = await woken();
    sb.place(a, BRIDGE);
    sb.clearEvents();
    advanceBy(sb, 12);
    expect(sb.eventsOf('unit.attack').filter((e) => e.attack === 'rake' || e.attack === 'flap')).toHaveLength(0);
  });

  it('§7.12 Talon Rake: every 2.5 s an 8 m cone at its target for 140 Talon', async () => {
    const { sb, a, r } = await woken();
    sb.modify(a, 'qa-hp', { stats: [{ stat: 'maxHealth', op: 'add', value: 50_000 }] });
    sb.place(a, { x: r.pos.x - 6, y: -10, z: r.pos.z + 4 }); // off the west ramp
    sb.step(2);
    sb.clearEvents();
    advanceBy(sb, 7);
    const rakes = sb.eventsOf('unit.attack').filter((e) => e.attack === 'rake');
    expect(rakes.length, '7 s holds two or three rakes').toBeGreaterThanOrEqual(2);
    const gap = (rakes[1]!.impactAt - rakes[0]!.impactAt) / TICK_RATE;
    expect(gap).toBeCloseTo(2.5, 1);
    const dmg = sb.eventsOf('damage.applied').find((e) => e.source === r.id && e.target === a && e.damageType === 'talon');
    expect(dmg!.amount * 1, 'before the hero resist').toBeCloseTo(140 * (1 - sb.hero(a).stats.final.talonResist), 0);
  });

  it('§7.12 Gale Flap: every 10 s, 15 m radius, 80 Song, 10 m knockback outward', async () => {
    const { sb, a, r } = await woken();
    sb.modify(a, 'qa-hp', { stats: [{ stat: 'maxHealth', op: 'add', value: 50_000 }] });
    sb.place(a, { x: r.pos.x - 8, y: -10, z: r.pos.z });
    sb.step(2);
    sb.clearEvents();
    advanceBy(sb, 21);
    const flaps = sb.eventsOf('unit.attack').filter((e) => e.attack === 'flap');
    expect(flaps.length).toBeGreaterThanOrEqual(2);
    expect((flaps[1]!.impactAt - flaps[0]!.impactAt) / TICK_RATE).toBeCloseTo(10, 0);
    const song = sb.eventsOf('damage.applied').find((e) => e.source === r.id && e.target === a && e.damageType === 'song');
    expect(song!.amount).toBeCloseTo(80 * (1 - sb.hero(a).stats.final.songResist), 0);
  });

  it('§7.12 enrage: at 25% HP a map-wide roar, +30% attack speed, and a Sky Shriek every 8 s silencing heroes within 20 m for 1.5 s', async () => {
    const { sb, a, r } = await woken();
    sb.modify(a, 'qa-hp', { stats: [{ stat: 'maxHealth', op: 'add', value: 500_000 }] });
    sb.apply({ kind: 'heal', amount: 500_000 }, a, sb.cause(null)); // max HP alone leaves current HP at its base
    sb.place(a, { x: r.pos.x - 6, y: -10, z: r.pos.z + 4 }); // off the west ramp
    sb.step(2);
    sb.clearEvents();
    hit(sb, a, r.id, r.stats.final.maxHealth * 0.76, 'song'); // Song: the Roc resists 15% Talon, which would leave it above 25%
    sb.step(2);
    expect(sb.eventsOf('unit.state').filter((e) => e.unit === r.id && e.state === 'enraged')).toHaveLength(1);
    expect(r.unit.enraged).toBe(true);
    sb.clearEvents();
    advanceBy(sb, 17);
    const rakes = sb.eventsOf('unit.attack').filter((e) => e.attack === 'rake');
    expect((rakes[1]!.impactAt - rakes[0]!.impactAt) / TICK_RATE, '2.5 s / 1.3').toBeCloseTo(2.5 / 1.3, 1);
    const shrieks = sb.eventsOf('unit.attack').filter((e) => e.attack === 'shriek');
    expect(shrieks.length, 'one every 8 s').toBeGreaterThanOrEqual(2);
    const silenced = sb.eventsOf('status.applied').find((e) => e.target === a && e.source === r.id);
    expect(silenced, 'the Shriek applied a status to the hero').toBeDefined();
    expect((silenced!.expiresAt - sb.sim.tick) / TICK_RATE, 'lasts at most 1.5 s').toBeLessThanOrEqual(1.5);
  });

  it('§7.12 reset: with no hero in the Hollow for 8 s it heals to full', async () => {
    const { sb, a, r } = await woken();
    sb.place(a, FLOOR);
    sb.step();
    hit(sb, a, r.id, 10_000);
    sb.step();
    expect(r.health.hp).toBeLessThan(r.stats.final.maxHealth - 5_000);
    sb.place(a, BRIDGE);
    advanceBy(sb, 7);
    expect(r.health.hp, 'not yet at 7 s').toBeLessThan(r.stats.final.maxHealth - 1_000);
    advanceBy(sb, 2);
    expect(r.health.hp).toBeCloseTo(r.stats.final.maxHealth, -1);
  });

  it('§7.12 kill reward: every hero of the killing flock gets 300 + 5 × match minutes seeds and 2 keepsakes; the other flock gets none', async () => {
    const { sb, a, b, foe } = await slain();
    const pay = Math.floor(300 + 5 * minutes(sb));
    expect(earned(sb, a, 'objective')).toBeGreaterThanOrEqual(pay - 6);
    expect(earned(sb, b, 'objective')).toBeGreaterThanOrEqual(pay - 6);
    expect(earned(sb, foe, 'objective')).toBe(0);
    expect(sb.hero(a).keepsakes?.count).toBe(2);
    expect(sb.hero(b).keepsakes?.count).toBe(2);
    expect(sb.hero(foe).keepsakes?.count ?? 0).toBe(0);
  });

  it('§7.12 respawn: 7:00 after the first kill, 6:00 after the second, 5:00 after each later kill', async () => {
    const { sb, a, r } = await woken();
    const waits = [7, 6, 5, 5];
    for (const [n, wait] of waits.entries()) {
      const target = n === 0 ? r : roc(sb);
      sb.place(a, FLOOR);
      sb.step();
      hit(sb, a, target.id, 10_000_000);
      sb.step(2);
      const diedAt = sb.sim.tick;
      expect(sb.ctx.objectives.rocAt, `kill ${n + 1}`).toBeGreaterThanOrEqual(diedAt + wait * 60 * TICK_RATE - 3);
      expect(sb.ctx.objectives.rocAt).toBeLessThanOrEqual(diedAt + wait * 60 * TICK_RATE + 3);
      advanceTo(sb, seconds(sb) + wait * 60 + 1);
      expect(roc(sb), `back after ${wait}:00`).toBeDefined();
    }
  });
});

describe('W5 the Phoenix Embers and Rekindle (§7.12)', { timeout: TIMEOUT_MS }, () => {
  it('§7.12 Embers: three fall to (10,−10,0), (−5,−10,8.66), (−5,−10,−8.66) over 6 s, and cannot be claimed until they land', async () => {
    const { sb, a } = await slain();
    const embers = pickupsOf(sb, 'ember');
    expect(embers).toHaveLength(3);
    for (const spot of EMBER_SPOTS) expect(embers.some((e) => flat(e.pos, spot) < 1), `Ember near (${spot.x}, ${spot.z})`).toBe(true);
    const first = embers[0]!;
    expect(first.pickup.claimableAt, 'lands after 6 s').toBeGreaterThanOrEqual(sb.sim.tick + (EMBER_FALL_S - 1) * TICK_RATE);
    expect(first.pickup.melee).toBe('heavy');
    standBeside(sb, a, first.pos);
    heavyMelee(sb, a);
    expect(objectiveEvents(sb, 'emberClaimed'), 'a hit while it falls does nothing').toHaveLength(0);
  });

  it('§7.12 claim: one heavy melee hit by either flock claims an Ember; a light hit does not; the claimer heals to full and gets 200 + 5 × minutes seeds', async () => {
    const { sb, a, foe } = await slain();
    advanceBy(sb, EMBER_FALL_S + 0.5);
    const [first, second] = pickupsOf(sb, 'ember') as [ReturnType<typeof pickupsOf>[number], ReturnType<typeof pickupsOf>[number]];
    hit(sb, foe, a, 300);
    sb.step();
    standBeside(sb, a, first.pos);
    lightMelee(sb, a);
    expect(objectiveEvents(sb, 'emberClaimed'), 'light hit: no claim').toHaveLength(0);
    sb.clearEvents();
    heavyMelee(sb, a);
    expect(objectiveEvents(sb, 'emberClaimed')).toHaveLength(1);
    expect(sb.health(a).hp, 'full HP').toBe(sb.hero(a).stats.final.maxHealth);
    expect(earned(sb, a, 'objective')).toBeGreaterThanOrEqual(Math.floor(200 + 5 * minutes(sb)) - 1);
    sb.place(foe, { x: second.pos.x - 1, y: second.pos.y, z: second.pos.z }, Math.PI / 2);
    sb.aimAt(foe, second.pos);
    sb.step();
    heavyMelee(sb, foe);
    expect(objectiveEvents(sb, 'emberClaimed'), 'either flock may claim').toHaveLength(2);
  });

  it('§7.12 Rekindle: each claim gives the claimer\'s flock one charge, at most 3 per Roc kill, lasting 180 s from the first claim', async () => {
    const { sb, a, b } = await slain();
    advanceBy(sb, EMBER_FALL_S + 0.5);
    const firstClaimAt = sb.sim.tick;
    for (const [i, ember] of pickupsOf(sb, 'ember').entries()) {
      const who = i % 2 === 0 ? a : b;
      standBeside(sb, who, ember.pos);
      heavyMelee(sb, who);
    }
    const rk = sb.ctx.teams.dawn.rekindle!;
    expect(rk.charges).toBe(3);
    expect(rk.until - firstClaimAt, '180 s from the first claim').toBeCloseTo(REKINDLE_S * TICK_RATE, -2);
  });

  it('§7.12 unclaimed Embers burn out 60 s after landing', async () => {
    const { sb } = await slain();
    advanceBy(sb, EMBER_FALL_S + EMBER_BURN_S - 2);
    expect(pickupsOf(sb, 'ember')).toHaveLength(3);
    advanceBy(sb, 4);
    expect(pickupsOf(sb, 'ember')).toHaveLength(0);
  });

  it('§7.12 Rekindle revive: a hero who dies while it holds revives where they fell 3 s later at full HP, spending a charge; no bounty', async () => {
    const { sb, a, b, foe } = await woken();
    sb.ctx.teams.dawn.rekindle = { until: sb.sim.tick + REKINDLE_S * TICK_RATE, charges: 2 };
    sb.place(b, { x: 40, y: 0, z: 40 });
    sb.step();
    const fell = { ...sb.hero(b).pos };
    sb.clearEvents();
    lethal(sb, foe, b);
    sb.step();
    const died = sb.eventsOf('entity.died').find((e) => e.victim === b)!;
    expect(died.revives, 'combat flags the revive').toBe(true);
    expect(earned(sb, foe, 'heroKill'), 'no bounty on a kill that revives').toBe(0);
    advanceBy(sb, REVIVE_S + 0.2);
    const back = sb.eventsOf('hero.respawned').find((e) => e.hero === b)!;
    expect(back.revived).toBe(true);
    expect(flat(back.pos, fell)).toBeLessThan(1);
    expect(sb.health(b).hp).toBe(sb.hero(b).stats.final.maxHealth);
    expect(sb.ctx.teams.dawn.rekindle!.charges, 'one charge spent').toBe(1);
    sb.clearEvents();
    lethal(sb, foe, b);
    sb.step();
    expect(sb.eventsOf('entity.died').find((e) => e.victim === b)!.revives, 'each hero can revive once').toBeFalsy();
    expect(a).toBeDefined();
  });

  it('§7.12 Rekindle ends when its time runs out: a later death is an ordinary death with a bounty', async () => {
    const { sb, b, foe } = await woken();
    sb.ctx.teams.dawn.rekindle = { until: sb.sim.tick + 10 * TICK_RATE, charges: 3 };
    advanceBy(sb, 11);
    sb.clearEvents();
    lethal(sb, foe, b);
    sb.step();
    expect(sb.eventsOf('entity.died').find((e) => e.victim === b)!.revives).toBeFalsy();
    expect(earned(sb, foe, 'heroKill')).toBeGreaterThan(0);
  });
});
