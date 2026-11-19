import { describe, expect, it } from 'vitest';
import { type EntityId, type ItemId, type PlayerTeam, type SeedReason, type StructureType } from '../../src/sim/core/contracts';
import { TICK_RATE } from '../../src/sim/data/core';
import { createSandbox, type Sandbox } from '../helpers/sandbox';

const LETHAL = 100_000;
const NOW = 20 * TICK_RATE;
const ITEM_COST = 800;
const ITEMS = [
  'thunderbird-heart', 'stout-breast', 'rising-song', 'flurry-feathers',
  'quill-clip', 'close-talons', 'beak-whetstone', 'quick-preen', 'down-padding', 'thick-quills', 'dew-drinker',
  'featherlight', 'lilt-seed', 'quick-refrain', 'carrying-voice', 'mocking-note',
] as const;

async function market(startSeeds = 0, structures = false) {
  const sb = await createSandbox({
    map: 'main', options: { unlockAbilities: false, structures, startSeeds },
    heroes: [{ hero: 'shrike', team: 'dawn' }, { hero: 'kingfisher', team: 'dawn' }, { hero: 'lyrebird', team: 'dusk' }],
  });
  const [buyer, ally, enemy] = sb.heroes as [EntityId, EntityId, EntityId];
  return { sb, buyer, ally, enemy };
}

function trade(sb: Sandbox, hero: EntityId, request: { buy: ItemId } | { sell: ItemId }): void {
  sb.trade(hero, request);
  sb.step();
}

function damage(sb: Sandbox, source: EntityId, target: EntityId, amount = LETHAL): void {
  sb.apply({ kind: 'damage', amount, type: 'talon' }, target, sb.cause(source, { via: 'weapon' }));
}

function fall(sb: Sandbox, credit: EntityId, target: EntityId): void {
  damage(sb, credit, target);
  sb.step();
  const died = sb.eventsOf('entity.died').find((e) => e.victim === target && e.killer === credit);
  expect(died, `real Combat death for ${target}`).toBeDefined();
}

function objective(sb: Sandbox, credit: EntityId, type: StructureType, lane = 'riverbank'): void {
  const enemy = sb.hero(credit).team === 'dawn' ? 'dusk' : 'dawn';
  const targets = sb.ctx.store.list('structure').filter((s) => !s.health.dead && s.team === enemy && s.structure.type === type &&
    (type === 'shrine' || s.structure.lane === lane));
  expect(targets.length, `§7 real ${enemy} ${type} on ${lane}`).toBeGreaterThan(0);
  fall(sb, credit, targets[0]!.id);
}

function earnings(sb: Sandbox, hero: EntityId, reason: SeedReason): number {
  return sb.eventsOf('seeds.gained').filter((e) => e.hero === hero && e.reason === reason).reduce((sum, e) => sum + e.amount, 0);
}

function ids(sb: Sandbox, hero: EntityId): ItemId[] {
  return sb.hero(hero).inventory.items.map((owned) => owned.item);
}

function ownShop(sb: Sandbox, team: PlayerTeam, kind: 'roost' | 'stall') {
  return sb.ctx.map.shops.find((s) => s.team === team && s.kind === kind)!;
}

describe('W4 earnings and AP', () => {
  it('§§8.4–8.6 a Heron bounty crosses two thresholds, applies both Molts and heals the gained max HP', async () => {
    const { sb, buyer, ally, enemy } = await market(50, true);
    const h = sb.hero(buyer);
    const start = { ...h.stats.final };
    sb.place(buyer, { x: 0, y: 0, z: 0 });
    damage(sb, enemy, buyer, 200);
    sb.step();
    const wounded = h.health.hp;
    objective(sb, buyer, 'hawk');
    expect(h.progress).toMatchObject({ netWorth: 350, seeds: 350, level: 1, molts: 0 });
    sb.clearEvents();
    objective(sb, buyer, 'heron');
    sb.step();
    expect(sb.eventsOf('hero.level').filter((e) => e.hero === buyer)).toMatchObject([
      { level: 2, ap: 1, unlockSlot: null }, { level: 3, ap: 1, unlockSlot: null },
    ]);
    expect(earnings(sb, buyer, 'objective')).toBe(600);
    expect(earnings(sb, ally, 'objective')).toBe(600);
    expect(earnings(sb, enemy, 'objective')).toBe(0);
    expect(h.progress).toMatchObject({ netWorth: 950, seeds: 950, level: 3, molts: 2 });
    expect(h.abilities.ap).toBe(2);
    expect(h.stats.final.maxHealth - start.maxHealth).toBe(68);
    expect(h.health.hp - wounded).toBeCloseTo(68);
    expect(h.stats.final.weaponDamage / start.weaponDamage).toBeCloseTo(1.06);
    expect(h.stats.final.songPower - start.songPower).toBe(2);
    expect(h.stats.final.meleeDamage - start.meleeDamage).toBe(6);
  });

  it('§§8.1/8.5 spending leaves lifetime earnings intact and crossing 3,000 grants the ultimate and one AP', async () => {
    const { sb, buyer } = await market(2980);
    const h = sb.hero(buyer);
    sb.step();
    expect(h.progress.level).toBe(5);
    expect(h.abilities.slots[3].unlocked).toBe(false);
    sb.upgrade(buyer, 3);
    sb.step();
    expect(h.abilities.slots[3].tier).toBe(0);
    expect(h.abilities.ap).toBe(4);
    trade(sb, buyer, { buy: 'quill-clip' });
    expect(h.progress).toMatchObject({ seeds: 2180, netWorth: 2980, level: 5 });
    const fed = sb.dummy({ kind: 'unit', type: 'scrapper', team: 'dusk', lane: 'riverbank', at: { x: 0, y: 0, z: 0 }, hp: 260 });
    sb.clearEvents();
    fall(sb, buyer, fed);
    expect(h.progress).toMatchObject({ seeds: 2200, netWorth: 3000, level: 6, molts: 5 });
    expect(sb.eventsOf('hero.level')).toContainEqual({ type: 'hero.level', hero: buyer, level: 6, ap: 1, unlockSlot: 3 });
    expect(h.abilities.slots[3]).toMatchObject({ unlocked: true, tier: 0 });
    expect(h.abilities.ap).toBe(5);
    for (const [tier, ap] of [[1, 4], [2, 2], [2, 2]] as const) {
      sb.upgrade(buyer, 3);
      sb.step();
      expect(h.abilities.slots[3].tier).toBe(tier);
      expect(h.abilities.ap).toBe(ap);
    }
  });

  it.each([
    { killerWorth: 9000, victimWorth: 10_000, perPlayer: 252 },
    { killerWorth: 500, victimWorth: 10_000, perPlayer: 315 },
    { killerWorth: 12_000, victimWorth: 10_000, perPlayer: 210 },
  ])('§8.3 splits a real hero bounty equally and applies the capped comeback multiplier ($perPlayer each)', async ({ killerWorth, victimWorth, perPlayer }) => {
    const { sb, buyer, ally, enemy } = await market();
    // The fixture controls lifetime earnings so the actual death exercises the bounty and assist systems together.
    Object.assign(sb.hero(buyer).progress, { netWorth: killerWorth, seeds: 0 });
    Object.assign(sb.hero(enemy).progress, { netWorth: victimWorth, seeds: 0 });
    damage(sb, ally, enemy, 10);
    sb.step();
    fall(sb, buyer, enemy);
    expect(sb.eventsOf('entity.died')).toContainEqual(expect.objectContaining({ victim: enemy, creditHero: buyer, assisters: [ally] }));
    expect(earnings(sb, buyer, 'heroKill')).toBe(perPlayer);
    expect(earnings(sb, ally, 'assist')).toBe(perPlayer);
    expect(sb.hero(buyer).progress).toMatchObject({ seeds: perPlayer, netWorth: killerWorth + perPlayer });
    expect(sb.hero(enemy).progress.seeds).toBe(0);
  });

  it('§8.3 a third consecutive kill adds 60 Seeds to the shutdown and death clears the streak', async () => {
    const sb = await createSandbox({
      heroes: [{ hero: 'shrike', team: 'dawn' }, { hero: 'kingfisher', team: 'dawn' },
        { hero: 'albatross', team: 'dawn' }, { hero: 'lyrebird', team: 'dusk' }], options: { unlockAbilities: false },
    });
    const [killer, second, third, victim] = sb.heroes as [EntityId, EntityId, EntityId, EntityId];
    for (const id of [killer, second, third]) fall(sb, victim, id);
    expect(sb.stepUntil(() => !sb.health(killer).dead, 10 * TICK_RATE)).not.toBeNull();
    const rich = 10_000;
    sb.hero(killer).progress.netWorth = rich;
    sb.hero(victim).progress.netWorth = rich;
    sb.clearEvents();
    fall(sb, killer, victim);
    expect(earnings(sb, killer, 'heroKill')).toBe(480);
    expect(sb.stepUntil(() => !sb.health(victim).dead, 10 * TICK_RATE)).not.toBeNull();
    sb.hero(killer).progress.netWorth = rich;
    sb.hero(victim).progress.netWorth = rich;
    sb.clearEvents();
    fall(sb, killer, victim);
    expect(earnings(sb, killer, 'heroKill')).toBe(420);
  });
});

describe('W4 shop transactions', () => {
  it('§§8.7–8.8 the 16-item catalogue spans four tiers and trades validate own zone, funds, ownership and uniqueness', async () => {
    const { sb, buyer, enemy } = await market(2 * ITEM_COST);
    expect(sb.sim.itemCatalogue.map((item) => item.id).sort()).toEqual([...ITEMS].sort());
    expect(new Set(sb.sim.itemCatalogue.map((item) => item.tier))).toEqual(new Set([1, 2, 3, 4]));
    const h = sb.hero(buyer);
    const stall = ownShop(sb, 'dawn', 'stall');
    sb.place(buyer, ownShop(sb, 'dusk', 'stall').pos);
    trade(sb, buyer, { buy: 'quill-clip' });
    expect(h.inventory.shopZone ?? null).toBeNull();
    expect(ids(sb, buyer)).toEqual([]);
    sb.place(buyer, stall.pos);
    trade(sb, buyer, { buy: 'unlisted-item' });
    trade(sb, buyer, { sell: 'quill-clip' });
    expect(h.progress.seeds).toBe(1600);
    trade(sb, buyer, { buy: 'quill-clip' });
    expect(h.inventory.shopZone).toBe(sb.ctx.map.shops.indexOf(stall));
    expect(ids(sb, buyer)).toEqual(['quill-clip']);
    trade(sb, buyer, { buy: 'quill-clip' });
    expect(h.progress.seeds, 'a duplicate is rejected even while affordable').toBe(800);
    trade(sb, buyer, { buy: 'down-padding' });
    trade(sb, buyer, { buy: 'lilt-seed' });
    expect(ids(sb, buyer)).toEqual(['quill-clip', 'down-padding']);
    expect(h.progress).toMatchObject({ seeds: 0, netWorth: 1600 });
    sb.place(buyer, { ...stall.pos, x: stall.pos.x + stall.radius + 2 });
    trade(sb, buyer, { sell: 'quill-clip' });
    expect(ids(sb, buyer)).toEqual(['quill-clip', 'down-padding']);
    expect(sb.eventsOf('item.bought').filter((e) => e.hero === buyer)).toMatchObject([
      { item: 'quill-clip', cost: 800 }, { item: 'down-padding', cost: 800 },
    ]);
    expect(sb.eventsOf('item.sold')).toHaveLength(0);
    trade(sb, enemy, { buy: 'down-padding' });
    expect(ids(sb, enemy)).toEqual(['down-padding']);
  });

  it('§8.8 replaces existing items in place at their net price and removes every component stat', async () => {
    const { sb, buyer } = await market(10_800);
    const h = sb.hero(buyer);
    sb.step();
    const start = { ...h.stats.final };
    const earned = h.progress.netWorth;
    trade(sb, buyer, { buy: 'quill-clip' });
    trade(sb, buyer, { buy: 'down-padding' });
    trade(sb, buyer, { buy: 'lilt-seed' });
    expect(ids(sb, buyer)).toEqual(['quill-clip', 'down-padding', 'lilt-seed']);
    expect(h.stats.final.maxHealth - start.maxHealth).toBe(210);
    trade(sb, buyer, { buy: 'stout-breast' });
    expect(h.progress.seeds).toBe(6000);
    expect(ids(sb, buyer)).toEqual(['quill-clip', 'stout-breast', 'lilt-seed']);
    expect(h.stats.final.maxHealth - start.maxHealth).toBe(500);
    trade(sb, buyer, { buy: 'thunderbird-heart' });
    trade(sb, buyer, { buy: 'rising-song' });
    expect(h.progress.seeds).toBe(400);
    expect(ids(sb, buyer)).toEqual(['quill-clip', 'thunderbird-heart', 'rising-song']);
    expect(h.stats.final.maxHealth - start.maxHealth).toBe(900);
    expect(h.stats.final.songPower - start.songPower).toBe(24);
    expect(h.stats.final.talonResist).toBe(start.talonResist);
    expect(h.stats.final.songResist).toBe(start.songResist);
    trade(sb, buyer, { sell: 'thunderbird-heart' });
    expect(h.progress).toMatchObject({ seeds: 6800, netWorth: earned });
    expect(h.stats.final.maxHealth - start.maxHealth).toBe(150);
  });

  it.each(['same visit', 'expired', 'walk out and return', 'switch anchor in one tick', 'death'] as const)('§8.8 refunds after %s', async (change) => {
    const { sb, buyer, enemy } = await market(ITEM_COST);
    const h = sb.hero(buyer);
    const roost = ownShop(sb, 'dawn', 'roost');
    trade(sb, buyer, { buy: 'down-padding' });
    expect(ids(sb, buyer)).toEqual(['down-padding']);
    expect(h.inventory.items[0]?.fullRefundUntil).toBe(sb.sim.tick + NOW);
    if (change === 'expired') sb.step(NOW + 1);
    if (change === 'walk out and return') {
      sb.place(buyer, { ...roost.pos, x: roost.pos.x + roost.radius + 3 });
      sb.step();
      expect(h.inventory.shopZone ?? null).toBeNull();
      sb.place(buyer, roost.pos);
    }
    if (change === 'switch anchor in one tick') sb.place(buyer, ownShop(sb, 'dawn', 'stall').pos);
    if (change === 'death') {
      fall(sb, enemy, buyer);
      expect(sb.stepUntil(() => !h.health.dead, 10 * TICK_RATE)).not.toBeNull();
      expect(ids(sb, buyer)).toEqual(['down-padding']);
    }
    const wallet = h.progress.seeds;
    const worth = h.progress.netWorth;
    trade(sb, buyer, { sell: 'down-padding' });
    expect(ids(sb, buyer)).toEqual([]);
    expect(h.progress).toMatchObject({ seeds: wallet + (change === 'same visit' ? 800 : 400), netWorth: worth });
  });

  it.each(['dawn', 'dusk'] as const)('§§8.4/8.7 %s gets one flex slot for each agreed fall, with capacity 12 through 16', async (team) => {
    const { sb, buyer, ally, enemy } = await market(30_000, true);
    const player = team === 'dawn' ? buyer : enemy;
    const rival = team === 'dawn' ? 'dusk' : 'dawn';
    const victors = team === 'dawn' ? [buyer, ally] : [enemy];
    for (const item of ITEMS.slice(0, 12)) trade(sb, player, { buy: item });
    expect(ids(sb, player)).toEqual(ITEMS.slice(0, 12));
    for (const [index, type, lane, bounty] of [
      [0, 'hawk', 'riverbank', 300], [1, 'hawk', 'hedgerow', 300], [2, 'heron', 'riverbank', 600], [3, 'shrine', 'riverbank', 500],
    ] as const) {
      const item = ITEMS[12 + index]!;
      trade(sb, player, { buy: item });
      expect(ids(sb, player)).toHaveLength(12 + index);
      if (type === 'shrine') {
        objective(sb, player, 'warden');
        objective(sb, player, 'warden');
        expect(sb.ctx.teams[team].flexSlots).toBe(3);
      }
      sb.clearEvents();
      objective(sb, player, type, lane);
      expect(sb.eventsOf('flexSlots')).toEqual([{ type: 'flexSlots', team, slots: index + 1 }]);
      expect(sb.ctx.teams[team].flexSlots).toBe(index + 1);
      expect(sb.ctx.teams[rival].flexSlots).toBe(0);
      for (const hero of victors) expect(earnings(sb, hero, 'objective')).toBe(bounty);
      trade(sb, player, { buy: item });
      expect(ids(sb, player)).toEqual(ITEMS.slice(0, 13 + index));
    }
  });
});
