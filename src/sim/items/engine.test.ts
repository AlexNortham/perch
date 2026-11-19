// Wave 5 item engine (ECON-A): four-active cap, targeting, auras, shields, Second Clutch, riders, trigger limits.
import { expect, it } from 'vitest';
import { Button, ITEM_BUTTONS, type EntityId, type HeroId, type ItemId } from '../core/contracts';
import { ticks } from '../core/math';
import { createSandbox } from '../../../tests/helpers/sandbox';

async function shop(hero: HeroId = 'shrike', extra: readonly HeroId[] = []) {
  const sb = await createSandbox({ map: 'main', heroes: [hero, { hero: 'lyrebird', team: 'dusk' }, ...extra.map((h) => ({ hero: h, team: 'dawn' as const }))],
    options: { structures: false, startSeeds: 400_000, unlockAbilities: true } });
  const [buyer, foe, ally] = sb.heroes as [EntityId, EntityId, EntityId];
  const roost = sb.ctx.map.shops.find((s) => s.kind === 'roost' && s.team === 'dawn')!;
  const buy = (...ids: ItemId[]) => {
    for (const id of ids) {
      sb.place(buyer, roost.pos);
      sb.trade(buyer, { buy: id });
      sb.step(2);
    }
  };
  const lane = (distance = 10) => {
    sb.place(buyer, { x: 0, y: 0, z: -65 }, 0);
    sb.place(foe, { x: 0, y: 0, z: -65 + distance }, Math.PI);
    if (ally) sb.place(ally, { x: 4, y: 0, z: -59 }, Math.PI);
    sb.step(3);
  };
  const key = (id: ItemId) => ITEM_BUTTONS[sb.hero(buyer).inventory.actives.indexOf(id)]!;
  return { sb, buyer, foe, ally: ally as EntityId, buy, lane, key, h: () => sb.hero(buyer) };
}
const owned = (s: Awaited<ReturnType<typeof shop>>, id: ItemId) => s.h().inventory.items.some((i) => i.item === id);

it('a fifth active is refused, but an upgrade that replaces an active keeps the count', async () => {
  const s = await shop();
  s.buy('flurry-feathers', 'healing-dew', 'preening-rite', 'covey-ward', 'rescue-call');
  expect(s.h().inventory.actives.filter(Boolean)).toHaveLength(4);
  expect(owned(s, 'rescue-call')).toBe(false);
  s.buy('talon-tempest');
  expect(owned(s, 'talon-tempest')).toBe(true);
  expect(owned(s, 'flurry-feathers')).toBe(false);
});

it('unit targeting picks the enemy near the crosshair; with none in range nothing is spent', async () => {
  const s = await shop();
  s.buy('stoop-dive');
  s.lane(30);
  s.sb.aimAt(s.buyer, s.foe, 'body');
  s.sb.press(s.buyer, s.key('stoop-dive'));
  s.sb.step(4);
  expect(s.sb.eventsOf('item.activated')).toHaveLength(0);
  expect(s.h().inventory.items.find((i) => i.item === 'stoop-dive')!.readyAt).toBe(0);
});

it('selfFallback: Rescue Call heals the holder when no ally is in the cone', async () => {
  const s = await shop('shrike', ['kingfisher']);
  s.buy('rescue-call');
  s.lane();
  s.sb.apply({ kind: 'damage', amount: 600, type: 'talon' }, s.buyer, s.sb.cause(s.foe, { via: 'weapon' }));
  s.sb.step();
  const hp0 = s.sb.health(s.buyer).hp;
  s.sb.aimAt(s.buyer, { x: 0, y: 1, z: -200 });
  s.sb.press(s.buyer, s.key('rescue-call'));
  s.sb.step(ticks(3.3));
  expect(s.sb.health(s.buyer).hp - hp0).toBeGreaterThan(100);
});

it('point targeting: Tangle Pod bursts on the enemy under the crosshair', async () => {
  const s = await shop();
  s.buy('tangle-pod');
  s.lane(15);
  s.sb.aimAt(s.buyer, s.foe, 'body');
  s.sb.press(s.buyer, s.key('tangle-pod'));
  s.sb.step(ticks(1.2));
  expect(s.sb.eventsOf('damage.applied').some((e) => e.target === s.foe && e.damageType === 'song')).toBe(true);
});

it('auras: Nestmother’s Mantle covers allies, ends on sale, and returns after respawn', async () => {
  const s = await shop('shrike', ['kingfisher']);
  s.buy('nestmother-mantle');
  s.lane(10);
  s.sb.step(ticks(1));
  expect(s.sb.hero(s.ally).stats.final.talonResist).toBeCloseTo(0.1, 2);
  s.sb.place(s.buyer, s.sb.ctx.map.shops.find((x) => x.kind === 'roost' && x.team === 'dawn')!.pos);
  s.sb.trade(s.buyer, { sell: 'nestmother-mantle' });
  s.sb.step(ticks(2));
  expect(s.sb.hero(s.ally).stats.final.talonResist).toBeCloseTo(0, 2);
});

it('shields: Heartwood Bark after Talon Bulwark adds only the difference', async () => {
  const s = await shop();
  s.buy('thick-quills', 'talon-bulwark');
  s.sb.step(2);
  expect(s.sb.health(s.buyer).talonShield).toBe(250);
  s.buy('heartwood-bark');
  s.sb.step(2);
  expect(s.sb.health(s.buyer).talonShield).toBe(500);
});

it('Second Clutch saves once, then needs its 150 s cooldown', async () => {
  const s = await shop();
  s.buy('second-clutch');
  s.sb.step(2);
  const kill = () => s.sb.apply({ kind: 'damage', amount: 1_000_000, type: 'talon' }, s.buyer, s.sb.cause(s.foe, { via: 'weapon' }));
  kill();
  s.sb.step(3);
  expect(s.sb.health(s.buyer).dead).toBe(false);
  s.sb.step(ticks(2));
  kill();
  s.sb.step(3);
  expect(s.sb.health(s.buyer).dead).toBe(true);
});

it('trigger uses, via and withinM: a one-use rider ends after one hit; a gun-only reflection ignores far and non-gun hits', async () => {
  const s = await shop();
  s.lane(10);
  const trig = { on: 'weaponHit', heroesOnly: true, chance: 1, cooldownS: 0, target: 'other', uses: 2, effects: [{ kind: 'damage', amount: 7, type: 'song' }] } as const;
  s.sb.apply({ kind: 'trigger', trigger: trig, durationS: 30 }, s.buyer, s.sb.cause(s.buyer, { via: 'ability' }));
  s.sb.aimAt(s.buyer, s.foe, 'body');
  s.sb.fire(s.buyer);
  s.sb.step(ticks(1.5));
  s.sb.fire(s.buyer, false);
  const riders = s.sb.eventsOf('damage.applied').filter((e) => e.proc && e.damageType === 'song' && e.target === s.foe);
  expect(riders).toHaveLength(2);
});

it('riders: Hooked Spur slows on a heavy hit, Forager’s Talon and Skipping Stone add damage, Carrion Feast heals on a kill', async () => {
  const s = await shop();
  s.buy('hooked-spur');
  s.sb.place(s.buyer, { x: 0, y: 0, z: -65 }, 0);
  s.sb.place(s.foe, { x: 0, y: 0, z: -62.5 }, Math.PI);
  s.sb.step(3);
  s.sb.press(s.buyer, Button.Melee);
  s.sb.hold(s.buyer, Button.Melee);
  s.sb.step(30);
  s.sb.release(s.buyer, Button.Melee);
  s.sb.step(80);
  expect(s.sb.eventsOf('melee').some((e) => e.heavy && e.target === s.foe)).toBe(true);
  expect(s.sb.hero(s.foe).statuses.some((st) => st.def.id === 'slow')).toBe(true);

  const f = await shop();
  f.buy('foragers-talon', 'carrion-feast');
  f.sb.place(f.buyer, { x: 0, y: 0, z: -65 }, 0);
  f.sb.step(2);
  f.sb.apply({ kind: 'damage', amount: 300, type: 'talon' }, f.buyer, f.sb.cause(f.foe, { via: 'weapon' }));
  f.sb.step();
  const hp0 = f.sb.health(f.buyer).hp;
  f.sb.apply({ kind: 'damage', amount: 1_000_000, type: 'talon' }, f.foe, f.sb.cause(f.buyer, { via: 'weapon' }));
  f.sb.step(2);
  expect(f.sb.health(f.buyer).hp - hp0).toBeGreaterThan(0.1 * f.sb.hero(f.buyer).stats.final.maxHealth);
});
