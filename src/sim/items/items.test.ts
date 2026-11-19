import { expect, it } from 'vitest';
import { Button, type EntityId, type HeroId } from '../core/contracts';
import { ticks } from '../core/math';
import { createSandbox, type Sandbox } from '../../../tests/helpers/sandbox';

async function shop(hero: HeroId = 'shrike', regen = false) {
  const sb = await createSandbox({ map: 'main', heroes: [hero, 'kingfisher'], regen,
    options: { structures: false, startSeeds: 24_000, unlockAbilities: false } });
  const [buyer, foe] = sb.heroes as [EntityId, EntityId];
  const h = sb.hero(buyer);
  const roost = sb.ctx.map.shops.find((s) => s.kind === 'roost' && s.team === 'dawn')!;
  function buy(...items: string[]) {
    sb.place(buyer, roost.pos);
    for (const id of items) {
      sb.trade(buyer, { buy: id });
      sb.step();
      expect(h.inventory.items.some((i) => i.item === id)).toBe(true);
    }
  }
  function sell(id: string) {
    sb.place(buyer, roost.pos);
    sb.trade(buyer, { sell: id });
    sb.step();
    expect(h.inventory.items.some((i) => i.item === id)).toBe(false);
  }
  function lane(distance = 8) {
    sb.place(buyer, { x: 0, y: 0, z: -65 });
    sb.place(foe, { x: 0, y: 0, z: -65 + distance });
    sb.step(2);
  }
  return { sb, buyer, foe, h, buy, sell, lane };
}

function hit(sb: Sandbox, source: EntityId, target: EntityId, amount = 100) {
  sb.apply({ kind: 'damage', type: 'talon', amount }, target, sb.cause(source));
  sb.step();
}

it('Quill Clip, Quick Preen and Flurry change real shots, reloads and active cooldown', async () => {
  const { sb, h, buyer, foe, buy, lane } = await shop();
  buy('quill-clip', 'quick-preen', 'quick-refrain');
  lane();
  sb.aimAt(buyer, foe);
  sb.fire(buyer);
  sb.step(50);
  sb.fire(buyer, false);
  expect(sb.eventsOf('weapon.fired')).toHaveLength(6);
  const shots = sb.eventsOf('damage.applied').filter((e) => e.via === 'weapon' && e.target === foe);
  expect(shots.length).toBeGreaterThan(0);
  expect(shots[0]!.amount).toBeCloseTo(h.stats.final.weaponDamage * 1.06);
  sb.press(buyer, Button.Reload);
  sb.step();
  expect(sb.stepUntil(() => !h.weapon.reloading, ticks(3))).toBe(Math.ceil(2.2 * 60 / 1.15));
  expect(h.weapon.ammo).toBe(30);
  buy('flurry-feathers');
  expect(h.inventory.actives).toEqual(['flurry-feathers', null, null, null]);
  sb.press(buyer, Button.Fire);
  sb.step();
  expect(h.weapon.ammo).toBe(29);
  sb.press(buyer, Button.Item1);
  sb.step();
  expect(h.weapon.ammo).toBe(30);
  expect(h.stats.final.fireRate).toBeCloseTo(0.52);
  const ready = h.inventory.items.find((i) => i.item === 'flurry-feathers')!.readyAt;
  expect(ready).toBe(sb.sim.tick + ticks(30));
  sb.step(ticks(5));
  expect(h.stats.final.fireRate).toBeCloseTo(0.12);
  sb.press(buyer, Button.Item1);
  sb.step();
  expect(sb.eventsOf('item.activated')).toHaveLength(1);
});

it('Whetstone adds 35 to an aimed rifle beak shot', async () => {
  const { sb, buyer, foe, h, buy, lane } = await shop();
  buy('beak-whetstone');
  lane();
  sb.hold(buyer, Button.Aim);
  sb.aimAt(buyer, foe, 'head');
  sb.fire(buyer);
  sb.step(6);
  const e = sb.eventsOf('damage.applied').find((d) => d.target === foe && d.beakShot);
  expect(e?.amount).toBeCloseTo(h.stats.final.weaponDamage * 1.65 + 35);
});

it('Flurry keeps its current cooldown across a sale, including an explicit item cooldown reset', async () => {
  const { sb, buyer, h, buy, sell } = await shop();
  buy('flurry-feathers');
  sb.press(buyer, Button.Item1);
  sb.step();
  const ready = h.inventory.items[0]!.readyAt;
  sell('flurry-feathers');
  buy('flurry-feathers');
  expect(h.inventory.items[0]!.readyAt).toBe(ready);
  sb.apply({ kind: 'cooldownMod', scope: 'items', mode: 'reset' }, buyer, sb.cause(buyer));
  sell('flurry-feathers');
  buy('flurry-feathers');
  expect(h.inventory.items[0]!.readyAt).toBe(0);
});

it.runIf(process.env.PERCH_PENDING === '1')('Close Talons boosts a real gun hit only within 15 m', async () => {
  const { sb, buyer, foe, h, buy, lane } = await shop();
  buy('close-talons');
  for (const range of [8, 18]) {
    lane(range);
    sb.aimAt(buyer, foe);
    sb.fire(buyer);
    expect(sb.stepUntil(() => sb.eventsOf('damage.applied').some((e) => e.target === foe), 20)).not.toBeNull();
    expect(sb.eventsOf('damage.applied')[0]!.amount).toBeCloseTo(h.stats.final.weaponDamage * (range < 15 ? 1.2 : 1));
    sb.fire(buyer, false);
    sb.step(15);
    sb.clearEvents();
  }
});

it.runIf(process.env.PERCH_PENDING === '1')('Whetstone adds its flat damage once across a mixed shotgun volley', async () => {
  const { sb, buyer, foe, h, buy, lane } = await shop('albatross');
  buy('beak-whetstone');
  lane(2.5);
  sb.aimAt(buyer, foe, 'head');
  sb.hold(buyer, Button.Aim);
  sb.press(buyer, Button.Fire);
  sb.step();
  const hits = sb.eventsOf('damage.applied').filter((e) => e.target === foe && e.via === 'weapon');
  const heads = hits.filter((e) => e.beakShot).length;
  expect(heads).toBeGreaterThan(1);
  const base = h.stats.final.weaponDamage;
  const total = hits.reduce((sum, hit) => sum + hit.amount, 0);
  expect(total).toBeCloseTo(base * (hits.length - heads + heads * 1.65) + 35);
});

it('Dew Drinker restarts its eight-second timer on each health hit and removes both regen bonuses on sale', async () => {
  const { sb, buyer, foe, h, buy, sell } = await shop('shrike', true);
  buy('dew-drinker');
  hit(sb, foe, buyer, 400);
  sb.step(ticks(7));
  hit(sb, foe, buyer);
  const wounded = h.health.hp;
  sb.step(ticks(8) - 1);
  expect(h.stats.final.healthRegen).toBe(4.5);
  expect(h.health.hp - wounded).toBeCloseTo((ticks(8) - 1) * 4.5 / 60);
  sb.step(60);
  expect(h.health.hp - wounded).toBeCloseTo((ticks(8) - 1) * 4.5 / 60 + 14.5);
  sell('dew-drinker');
  expect(h.stats.final.healthRegen).toBe(2);
});

it('Plumage component replacements apply full HP, resistance, regeneration and healing received', async () => {
  const { sb, buyer, foe, h, buy } = await shop('shrike', true);
  const max = h.stats.final.maxHealth;
  buy('thick-quills', 'down-padding');
  expect(h.stats.final.maxHealth).toBe(max + 210);
  buy('stout-breast');
  const before = h.health.hp;
  hit(sb, foe, buyer);
  expect(before - h.health.hp).toBeCloseTo(100 * 0.88 * 0.94 - 2 / 60);
  buy('thunderbird-heart');
  expect(h.stats.final.maxHealth).toBe(max + 800);
  expect(h.stats.final.healthRegen).toBe(10);
  const hp = h.health.hp;
  sb.apply({ kind: 'heal', amount: 40 }, buyer, sb.cause(buyer));
  expect(h.health.hp - hp).toBeCloseTo(44);
});

it('Featherlight accelerates actual stamina recovery and sprinting', async () => {
  const { sb, buyer, h, buy, lane } = await shop();
  buy('featherlight');
  lane();
  sb.press(buyer, Button.Dash);
  sb.step();
  expect(h.motor.stamina).toBeCloseTo(2, 1);
  sb.step(ticks(2));
  expect(h.motor.stamina).toBeCloseTo(2.48, 1);
  sb.move(buyer, 1);
  sb.step(ticks(2));
  expect(Math.hypot(h.vel.x, h.vel.z)).toBeCloseTo(10, 1);
});

it('Song items extend a real Briar Patch cast, scale its damage, reduce cooldown and shred only heroes', async () => {
  const { sb, buyer, foe, h, buy, sell, lane } = await shop();
  const baseSp = h.stats.final.songPower;
  buy('lilt-seed');
  expect(h.stats.final.songPower).toBe(baseSp + 8);
  buy('rising-song', 'carrying-voice', 'quick-refrain', 'mocking-note');
  expect(h.stats.final.songPower).toBe(baseSp + 34);
  lane(28);
  const target = { ...sb.hero(foe).pos };
  const unit = sb.dummy({ kind: 'unit', type: 'scrapper', team: 'dusk', at: { ...target, x: 0.8 }, hp: 1500 });
  sb.cast(buyer, 1, target);
  sb.step();
  const cast = sb.eventsOf('ability').find((e) => e.stage === 'land');
  expect(cast?.point.z).toBeCloseTo(target.z, 0);
  expect(h.abilities.slots[1].cooldownTicks).toBe(ticks(18 * 0.92));
  sb.step(ticks(1));
  const hits = sb.eventsOf('damage.applied').filter((e) => e.ability === 'shrike.briarPatch');
  expect(hits.find((e) => e.target === foe)?.amount).toBeCloseTo(12.5 + 0.15 * h.stats.final.songPower);
  expect(hits.some((e) => e.target === unit)).toBe(true);
  expect(sb.ctx.stats.get(foe, 'songShred')).toBeCloseTo(0.08);
  expect(sb.ctx.stats.get(unit, 'songShred')).toBe(0);
  sell('mocking-note');
  sb.step(ticks(6));
  expect(sb.ctx.stats.get(foe, 'songShred')).toBe(0);
  buy('mocking-note');
  sb.apply({ kind: 'damage', type: 'song', amount: 10 }, foe, sb.cause(buyer, { proc: true, via: 'ability' }));
  sb.step();
  expect(sb.ctx.stats.get(foe, 'songShred')).toBe(0);
});
