// Wave 5 (ECON-A): neutral Seeds sources (GDD §7.8, §7.9, §7.11, §7.12, §7.14).
import { expect, it } from 'vitest';
import type { EntityId, PickupEntity } from '../core/contracts';
import { createSandbox } from '../../../tests/helpers/sandbox';

const at = { x: 0, y: 0, z: 0 };
const near = { x: 5, y: 0, z: 0 };

const kill = (sb: Awaited<ReturnType<typeof createSandbox>>, hero: EntityId, victim: EntityId) => {
  sb.apply({ kind: 'damage', type: 'talon', amount: 100_000 }, victim, sb.cause(hero, { via: 'weapon' }));
  sb.step();
};
const variant = (sb: Awaited<ReturnType<typeof createSandbox>>, id: EntityId, v: string) => {
  (sb.ctx.store.getKind(id, 'structure')!.structure as { variant?: string }).variant = v;
};

it('a Thicket creature pays base x (1 + 0.015 x minutes), split between the killer and allies who hit it in the last 5 s', async () => {
  const sb = await createSandbox({ heroes: [{ hero: 'shrike' }, { hero: 'kingfisher', team: 'dawn' }, { hero: 'albatross', team: 'dawn' }], options: { startSeeds: 0 } });
  const [killer, helper, bystander] = sb.heroes as [EntityId, EntityId, EntityId];
  const beetle = sb.dummy({ kind: 'unit', type: 'beetle', team: 'neutral', at: near, hp: 5000 });
  sb.apply({ kind: 'damage', type: 'talon', amount: 10 }, beetle, sb.cause(helper, { via: 'weapon' }));
  sb.step();
  kill(sb, killer, beetle);
  expect(sb.hero(killer).progress.seeds).toBe(22);
  expect(sb.hero(helper).progress.seeds).toBe(22);
  expect(sb.hero(bystander).progress.seeds).toBe(0);
});

it('a woven Nest always drops a sprig worth 48 + 3.6 per minute; any hero within 1.5 m collects it', async () => {
  const sb = await createSandbox({ heroes: [{ hero: 'shrike', at: { x: 30, y: 0, z: 0 } }, { hero: 'kingfisher', team: 'dusk', at: { x: -30, y: 0, z: 0 } }], options: { startSeeds: 0 } });
  const [a, b] = sb.heroes as [EntityId, EntityId];
  const nest = sb.dummy({ kind: 'structure', type: 'nest', team: 'neutral', at: near, hp: 100 });
  variant(sb, nest, 'woven');
  kill(sb, a, nest);
  sb.place(b, { x: 5.5, y: 0, z: 0 });
  sb.step(2);
  expect(sb.hero(b).progress.seeds).toBe(48);
  expect(sb.hero(a).progress.seeds).toBe(0);
});

it('Bell Feeder hits pay F/16 (light) and F/8 (heavy); the break pays F/2 to recent hitters', async () => {
  const sb = await createSandbox({ heroes: [{ hero: 'shrike' }], options: { startSeeds: 0 } });
  const [a] = sb.heroes as [EntityId];
  const feeder = sb.dummy({ kind: 'structure', type: 'nest', team: 'neutral', at: near, hp: 480 });
  variant(sb, feeder, 'feeder');
  sb.ctx.bus.emit({ type: 'melee', attacker: a, heavy: false, target: feeder, parried: false });
  sb.ctx.bus.emit({ type: 'melee', attacker: a, heavy: true, target: feeder, parried: false });
  sb.step();
  expect(sb.hero(a).progress.seeds).toBe(18 + 37);
  kill(sb, a, feeder);
  expect(sb.hero(a).progress.seeds).toBe(18 + 37 + 150);
});

it('the Egg hatches into six golden pods: the courier keeps a pod they secure, splits one a mate secures, and an enemy denies for 25%', async () => {
  const sb = await createSandbox({ heroes: [{ hero: 'shrike' }, { hero: 'kingfisher', team: 'dawn' }, { hero: 'albatross', team: 'dusk' }], options: { startSeeds: 0 } });
  const [courier, mate, foe] = sb.heroes as [EntityId, EntityId, EntityId];
  sb.ctx.bus.emit({ type: 'objective', action: 'eggDelivered', hero: courier, team: 'dawn', pickup: null, pickupType: null, pos: { ...at }, value: 1200 });
  sb.step(40);
  const pods = sb.ctx.store.list('pickup').filter((p: PickupEntity) => p.pickup.variant === 'golden');
  expect(pods).toHaveLength(6);
  const shoot = (by: EntityId, pod: PickupEntity) => {
    sb.ctx.bus.emit({ type: 'projectile.impact', owner: by, target: pod.id, via: 'weapon' } as never);
    sb.step();
  };
  shoot(courier, pods[0]!);
  shoot(mate, pods[1]!);
  shoot(foe, pods[2]!);
  expect(sb.hero(courier).progress.seeds).toBe(200 + 100);
  expect(sb.hero(mate).progress.seeds).toBe(100);
  expect(sb.hero(foe).progress.seeds).toBe(50);
  sb.step(120);
  expect(sb.hero(courier).progress.seeds, 'three unhit pods go to the courier').toBe(300 + 600);
});

it('the Roc pays every hero of the killing flock; an Ember claim pays its claimer; a revive pays no bounty', async () => {
  const sb = await createSandbox({ heroes: [{ hero: 'shrike' }, { hero: 'kingfisher', team: 'dawn' }, { hero: 'albatross', team: 'dusk' }], options: { startSeeds: 0 } });
  const [a, b, c] = sb.heroes as [EntityId, EntityId, EntityId];
  const roc = sb.dummy({ kind: 'unit', type: 'roc', team: 'neutral', at: near, hp: 100 });
  kill(sb, a, roc);
  expect(sb.hero(a).progress.seeds).toBe(300);
  expect(sb.hero(b).progress.seeds).toBe(300);
  expect(sb.hero(c).progress.seeds).toBe(0);
  sb.ctx.bus.emit({ type: 'objective', action: 'emberClaimed', hero: c, team: 'dusk', pickup: null, pickupType: 'ember', pos: { ...at } });
  sb.step();
  expect(sb.hero(c).progress.seeds).toBe(200);
  const before = sb.hero(a).progress.seeds;
  sb.ctx.bus.emit({ type: 'entity.died', victim: c, victimKind: 'hero', victimTeam: 'dusk', victimType: 'albatross', killer: a, creditHero: a,
    assisters: [], via: 'weapon', pos: { ...at }, revives: true });
  sb.step();
  expect(sb.hero(a).progress.seeds).toBe(before);
});
