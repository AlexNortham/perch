import { describe, expect, it } from 'vitest';
import type { EntityId, PickupEntity } from '../core/contracts';
import { createSandbox } from '../../../tests/helpers/sandbox';

const at = { x: 0, y: 0, z: 0 };
const near = { x: 5, y: 0, z: 0 };
const far = { x: 60, y: 0, z: 0 };

it('a unit killing a hero shares the bounty only with living enemies within 40 m', async () => {
  const sb = await createSandbox({ heroes: [
    { hero: 'shrike', at: { ...at, x: -25 } }, { hero: 'kingfisher', team: 'dusk', at: near },
    { hero: 'albatross', team: 'dusk', at: { ...at, x: 30 } },
  ] });
  const [victim, paid, unpaid] = sb.heroes as [EntityId, EntityId, EntityId];
  const attacker = sb.dummy({ kind: 'unit', type: 'slinger', team: 'dusk', at: near, hp: 100 });
  sb.apply({ kind: 'damage', type: 'talon', amount: 2000 }, victim, sb.cause(attacker, { via: 'unit' }));
  sb.step();
  expect(sb.hero(paid).progress.seeds).toBe(120);
  expect(sb.hero(unpaid).progress.seeds).toBe(0);
});

it('real fixture structure deaths award both flock members, heal two crossed Molts and stop granting flex slots at four; a Patron pays nothing', async () => {
  const sb = await createSandbox({ heroes: ['shrike', { hero: 'kingfisher', team: 'dawn' }],
    options: { startSeeds: 50, unlockAbilities: false } });
  const [hero, ally] = sb.heroes as [EntityId, EntityId];
  const h = sb.hero(hero);
  const source = sb.dummy({ kind: 'unit', type: 'scrapper', at: near, team: 'dusk', hp: 100 });
  sb.apply({ kind: 'damage', type: 'talon', amount: 200 }, hero, sb.cause(source));
  sb.step();
  const wounded = h.health.hp;
  for (const type of ['hawk', 'heron', 'hawk', 'hawk', 'warden', 'shrine', 'shrine', 'patron'] as const) {
    const id = sb.dummy({ kind: 'structure', type, at, team: 'dusk', hp: 100 });
    sb.apply({ kind: 'damage', type: 'talon', amount: 1000 }, id, sb.cause(hero, { via: 'weapon' }));
    sb.step();
    if (type === 'heron') {
      expect(h.progress).toMatchObject({ level: 3, molts: 2, seeds: 950 });
      expect(h.abilities.ap).toBe(2);
      expect(h.health.hp - wounded).toBeCloseTo(68);
    }
  }
  expect(sb.ctx.teams.dawn.flexSlots).toBe(4);
  expect(sb.eventsOf('flexSlots').map((e) => e.slots)).toEqual([1, 2, 3, 4]);
  expect(h.progress.seeds).toBe(2800);
  expect(sb.hero(ally).progress.seeds).toBe(2800);
});

it('the last threshold caps growth at 29 Molts and grants a total of 32 AP', async () => {
  const sb = await createSandbox({ heroes: ['shrike'], options: { unlockAbilities: false, startSeeds: 60_000 } });
  const h = sb.hero(sb.heroes[0]!);
  expect(h.progress).toMatchObject({ level: 30, molts: 29 });
  expect(h.abilities.ap).toBe(32);
});

/** Dawn hero, two Dusk heroes (one near the fledgling, one far) and a Dawn Scrapper dummy that is then killed. */
async function setup(killedBy: 'hero' | 'unit') {
  const sb = await createSandbox({
    heroes: [
      { hero: 'shrike', team: 'dawn', at: far },
      { hero: 'albatross', team: 'dusk', at: near },
      { hero: 'kingfisher', team: 'dusk', at: far },
    ],
  });
  const [dawn, duskNear, duskFar] = sb.heroes as [EntityId, EntityId, EntityId];
  const unit = sb.dummy({ kind: 'unit', type: 'scrapper', team: 'dawn', at, hp: 100, height: 1 });
  const by = killedBy === 'hero' ? duskNear : sb.dummy({ kind: 'unit', type: 'scrapper', team: 'dusk', at: far, hp: 100 });
  sb.apply({ kind: 'damage', amount: 999, type: 'talon' }, unit, sb.cause(by, { via: 'weapon' }));
  sb.step();
  const pod = sb.ctx.store.list('pickup')[0] as PickupEntity;
  const gained = (hero: EntityId) =>
    sb.eventsOf('seeds.gained').filter((e) => e.hero === hero).map((e) => [e.reason, e.amount]);
  return { sb, dawn, duskNear, duskFar, pod, gained };
}

describe('economy (GDD §8.2)', () => {
  it('the last hit pays half of V, rounded down, and the pod holds the other half', async () => {
    const { duskNear, pod, gained, sb } = await setup('hero');
    expect(gained(duskNear)).toEqual([['lastHit', 20]]);
    expect(sb.hero(duskNear).progress).toMatchObject({ seeds: 20, netWorth: 20 });
    expect(pod.team).toBe('dawn');
    expect(pod.pickup.value).toBeCloseTo(20, 1);
  });

  it('a kill no hero landed splits the half among enemy heroes within 25 m', async () => {
    const { duskNear, duskFar, dawn, gained } = await setup('unit');
    expect(gained(duskNear)).toEqual([['share', 20]]);
    expect(gained(duskFar)).toEqual([]);
    expect(gained(dawn)).toEqual([]);
  });

  it('an enemy gun bullet secures a ripe pod; its own flock denies for half as much', async () => {
    for (const [by, outcome, seeds] of [['duskFar', 'secured', 20], ['dawn', 'denied', 10]] as const) {
      const s = await setup('hero');
      s.sb.step(40);
      s.sb.clearEvents();
      const who = s[by];
      s.sb.ctx.bus.emit({ type: 'projectile.impact', owner: who, pos: s.pod.pos, normal: at, target: s.pod.id, beakShot: false, via: 'weapon' });
      s.sb.step();
      expect(s.sb.eventsOf('pod.resolved')).toMatchObject([{ by: who, outcome }]);
      expect(s.gained(who)).toEqual([['pod', seeds]]);
    }
  });

  it('ability and item projectiles do not resolve a pod; a rising pod ignores everything', async () => {
    const { sb, duskFar, pod } = await setup('hero');
    const hit = (via: 'ability' | 'item' | 'weapon') =>
      sb.ctx.bus.emit({ type: 'projectile.impact', owner: duskFar, pos: pod.pos, normal: at, target: pod.id, beakShot: false, via });
    hit('weapon'); // still rising
    sb.step(40);
    hit('ability');
    hit('item');
    sb.step();
    expect(sb.eventsOf('pod.resolved')).toHaveLength(0);
    expect(sb.ctx.store.get(pod.id)).toBeDefined();
  });

  it('a pod nobody shoots withers after 0.6 s rising and 1.4 s ripe', async () => {
    const { sb, pod } = await setup('hero');
    sb.step(118);
    expect(sb.ctx.store.get(pod.id)).toBeDefined();
    sb.step(3);
    expect(sb.ctx.store.get(pod.id)).toBeUndefined();
    expect(sb.eventsOf('pod.resolved')).toHaveLength(0);
  });

  it('passive income pays every hero 1 Seed a second from 0:30', async () => {
    const sb = await createSandbox({ heroes: [{ hero: 'shrike', team: 'dawn' }, { hero: 'albatross', team: 'dusk' }] });
    sb.step(30 * 60 - 1);
    expect(sb.hero(sb.heroes[0] as EntityId).progress.seeds).toBe(0);
    sb.step(10 * 60);
    expect(sb.hero(sb.heroes[0] as EntityId).progress.seeds).toBe(10);
  });
});
