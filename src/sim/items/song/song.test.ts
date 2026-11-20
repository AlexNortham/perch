import { expect, it } from 'vitest';
import { ITEM_BUTTONS, type EntityId, type ItemId } from '../../core/contracts';
import { ticks } from '../../core/math';
import { SONG_ITEMS } from '../../data/items-song';
import { createSandbox } from '../../../../tests/helpers/sandbox';

async function setup() {
  const sb = await createSandbox({ map: 'main', heroes: ['shrike', 'kingfisher'],
    options: { structures: false, startSeeds: 200_000, unlockAbilities: true } });
  const [buyer, foe] = sb.heroes as [EntityId, EntityId];
  const roost = sb.ctx.map.shops.find((s) => s.kind === 'roost' && s.team === 'dawn')!;
  const buy = (...ids: ItemId[]) => {
    sb.place(buyer, roost.pos);
    for (const id of ids) { sb.trade(buyer, { buy: id }); sb.step(2); }
  };
  const lane = (d = 8) => {
    sb.place(buyer, { x: 0, y: 0, z: -65 }, 0);
    sb.place(foe, { x: 0, y: 0, z: -65 + d }, Math.PI);
    sb.step(3);
  };
  const hit = (amount: number) => {
    sb.apply({ kind: 'damage', amount, type: 'song' }, foe, sb.cause(buyer, { via: 'ability' }));
    sb.step();
  };
  const songHits = () => sb.eventsOf('damage.applied').filter((e) => e.source === buyer && e.target === foe && e.damageType === 'song');
  return { sb, buyer, foe, buy, lane, hit, songHits };
}

it('the 17 Song items are all in the catalogue with a Song category', () => {
  expect(SONG_ITEMS).toHaveLength(17);
  expect(SONG_ITEMS.every((i) => i.category === 'song')).toBe(true);
});

it('Crescendo: an ability hit of 100 or more Song damage deals +20%; a smaller one does not', async () => {
  const s = await setup();
  s.buy('crescendo');
  s.lane();
  s.hit(50);
  expect(s.songHits(), 'small hit: no extra').toHaveLength(1);
  s.sb.clearEvents();
  s.hit(400);
  const [main, extra] = s.songHits();
  expect(extra, 'an extra Song hit').toBeDefined();
  expect(extra!.amount).toBeCloseTo(main!.amount * 0.2, 0);
});

it('Echo Chamber: ability damage to a hero repeats 1 s later at 25%, and shreds Song resist 14%', async () => {
  const s = await setup();
  s.buy('mocking-note', 'echo-chamber');
  s.lane();
  s.hit(200);
  expect(s.songHits()).toHaveLength(1);
  expect(s.sb.hero(s.foe).stats.final.songShred).toBeCloseTo(0.14, 2);
  s.sb.step(ticks(1.1));
  const [first, echo] = s.songHits();
  expect(echo, 'the repeat').toBeDefined();
  expect(echo!.amount / first!.amount, 'a repeat of the hit, resisted once (D-SYS-014)').toBeCloseTo(0.25, 6);
});

it('Boundless Song: the ultimate comes off cooldown 20% sooner', async () => {
  const plain = await setup();
  const boosted = await setup();
  boosted.buy('carrying-voice', 'boundless-song');
  const left = async (s: Awaited<ReturnType<typeof setup>>) => {
    s.lane();
    s.sb.cast(s.buyer, 3);
    s.sb.step(ticks(1));
    const slot = s.sb.hero(s.buyer).abilities.slots[3];
    return slot.readyAt - s.sb.ctx.clock.tick;
  };
  const a = await left(plain);
  const b = await left(boosted);
  expect(a).toBeGreaterThan(0);
  expect(b / a).toBeCloseTo(0.8, 1);
});

it('Encore: pressing it resets the cooldowns of abilities 1 to 4', async () => {
  const s = await setup();
  s.buy('encore');
  s.lane();
  s.sb.cast(s.buyer, 0);
  s.sb.step(ticks(1));
  expect(s.sb.hero(s.buyer).abilities.slots[0].readyAt).toBeGreaterThan(s.sb.ctx.clock.tick);
  s.sb.press(s.buyer, ITEM_BUTTONS[0]!);
  s.sb.step(2);
  expect(s.sb.hero(s.buyer).abilities.slots[0].readyAt).toBeLessThanOrEqual(s.sb.ctx.clock.tick);
});

it('Whirlwind Knot: enemies within 6 m take 90 + 0.6×SP Song damage and are knocked up; 35 s cooldown', async () => {
  const s = await setup();
  s.buy('whirlwind-knot');
  s.lane(4);
  const sp = s.sb.hero(s.buyer).stats.final.songPower;
  s.sb.press(s.buyer, ITEM_BUTTONS[0]!);
  s.sb.step(3);
  const [h] = s.songHits();
  expect(h, 'the whirl hit').toBeDefined();
  expect(h!.amount).toBeCloseTo((90 + 0.6 * sp) * (1 - s.sb.hero(s.foe).stats.final.songResist), 0);
  expect(s.sb.hero(s.buyer).inventory.items[0]!.readyAt - s.sb.ctx.clock.tick).toBeGreaterThan(ticks(34));
});
