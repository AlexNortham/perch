import { describe, expect, it } from 'vitest';
import type { EntityView, HeroView, ItemDef, SimView } from '../../sim/core/contracts';
import { clock, createGhosts, damageNumberStyle, dummies, mapPoint, mapVisible, mapWorld, quoteItem, upgradeDisplay } from './model';
import { NUMBER_CSS } from './constants';

const slot = (over = {}) => ({ ability: 'a', unlocked: true, tier: 0, readyAt: 0, cooldownTicks: 0, charges: 1, ...over });
const item = (id: string, cost: number, component: string | null = null): ItemDef => ({
  id, name: id, description: '', category: 'talon', tier: 1, cost, component, passive: {} as ItemDef['passive'], procs: [], active: null,
});
const hero = (items: HeroView['items'], seeds: number, shopZone: number | null) => ({ items, seeds, shopZone });

describe('upgrade display', () => {
  it('names the reason an upgrade is unavailable', () => {
    expect(upgradeDisplay(slot(), 0, 32).reason).toBeNull();
    expect(upgradeDisplay(slot(), 0, 32).cost).toBe(1);
    expect(upgradeDisplay(slot({ tier: 1 }), 0, 32).cost).toBe(2);
    expect(upgradeDisplay(slot(), 0, 0).reason).toMatch(/not enough AP/i);
    expect(upgradeDisplay(slot({ unlocked: false }), 3, 5).reason).toMatch(/level 6/);
    expect(upgradeDisplay(slot({ tier: 3 }), 0, 9)).toMatchObject({ maxed: true, cost: null, reason: 'Fully upgraded' });
  });
});

describe('shop quotes', () => {
  const cat = [item('a', 800), item('b', 1600, 'a'), item('c', 800)];
  it('credits an owned component and replaces it in place', () => {
    const q = quoteItem(cat[1] as ItemDef, cat, hero([{ item: 'a', readyAt: 0 }], 900, 0), 0, 0);
    expect(q).toMatchObject({ linked: true, net: 800, canBuy: true });
  });
  it('explains why it cannot be bought', () => {
    expect(quoteItem(cat[0] as ItemDef, cat, hero([], 5000, null), 0, 0).reason).toMatch(/Visit a Magpie stall/);
    expect(quoteItem(cat[0] as ItemDef, cat, hero([], 100, 0), 0, 0).reason).toMatch(/Need 700 more/);
    const full = Array.from({ length: 12 }, (_, i) => ({ item: `x${i}`, readyAt: 0 }));
    expect(quoteItem(cat[0] as ItemDef, cat, hero(full, 5000, 0), 0, 0).reason).toMatch(/slot/);
    expect(quoteItem(cat[0] as ItemDef, cat, hero(full, 5000, 0), 0, 1).canBuy).toBe(true);
  });
  it('refunds in full during the visit window and half after', () => {
    const own = (until?: number) => hero([{ item: 'a', readyAt: 0, ...(until !== undefined && { fullRefundUntil: until }) }], 0, 0);
    expect(quoteItem(cat[0] as ItemDef, cat, own(100), 50, 0)).toMatchObject({ owned: true, refund: 800, fullRefund: true });
    expect(quoteItem(cat[0] as ItemDef, cat, own(), 50, 0)).toMatchObject({ refund: 400, fullRefund: false });
  });
});

describe('map', () => {
  const b = { min: { x: -50, y: 0, z: -100 }, max: { x: 50, y: 0, z: 100 } };
  it('is north-up with east at the left', () => {
    const north = mapPoint({ x: 0, y: 0, z: 100 }, b, 100, 200);
    const south = mapPoint({ x: 0, y: 0, z: -100 }, b, 100, 200);
    expect(north.y).toBe(0);
    expect(south.y).toBe(200);
    expect(mapPoint({ x: 50, y: 0, z: 0 }, b, 100, 200).x).toBe(0);
    expect(mapPoint({ x: -50, y: 0, z: 0 }, b, 100, 200).x).toBe(100);
  });
  it('inverts back to the ground point', () => {
    expect(mapWorld(25, 50, b, 100, 200)).toEqual({ x: 25, y: 0, z: 50 });
  });
  it('shows enemies only through mapSeenBy, allies always', () => {
    expect(mapVisible({ team: 'dusk', seenBy: 0, mapSeenBy: 1 }, 'dawn')).toBe(true);
    expect(mapVisible({ team: 'dusk', seenBy: 1 }, 'dawn')).toBe(true);
    expect(mapVisible({ team: 'dusk', seenBy: 2, mapSeenBy: 2 }, 'dawn')).toBe(false);
    expect(mapVisible({ team: 'dawn', seenBy: 0 }, 'dawn')).toBe(true);
  });
  it('fades a ghost over six seconds after an enemy hero is lost', () => {
    const g = createGhosts();
    const enemy = (seenBy: number): EntityView => ({ id: 7, kind: 'hero', team: 'dusk', type: 'shrike', pos: { x: 1, y: 0, z: 2 }, seenBy }) as EntityView;
    const view = (seconds: number, seenBy: number) => ({ seconds, entities: [enemy(seenBy)] }) as unknown as SimView;
    expect(g.update(view(10, 1), 'dawn')).toEqual([]);
    expect(g.update(view(11, 2), 'dawn')[0]?.alpha).toBe(1);
    expect(g.update(view(14, 2), 'dawn')[0]?.alpha).toBeCloseTo(0.5);
    expect(g.update(view(18, 2), 'dawn')).toEqual([]);
  });
});

describe('numbers, clock and dummies', () => {
  const hit = { amount: 10, absorbed: 0, damageType: 'talon' as const, beakShot: false, weakPoint: false };
  it('colours damage numbers by kind', () => {
    expect(damageNumberStyle(hit, NUMBER_CSS).colour).toBe(NUMBER_CSS.talon);
    expect(damageNumberStyle({ ...hit, damageType: 'song' }, NUMBER_CSS).colour).toBe(NUMBER_CSS.song);
    expect(damageNumberStyle({ ...hit, beakShot: true }, NUMBER_CSS)).toEqual({ colour: NUMBER_CSS.beak, scale: 1.3 });
    expect(damageNumberStyle({ ...hit, weakPoint: true }, NUMBER_CSS).colour).toBe(NUMBER_CSS.weak);
    expect(damageNumberStyle({ ...hit, absorbed: 10 }, NUMBER_CSS).colour).toBe(NUMBER_CSS.shield);
  });
  it('formats the clock', () => expect(clock(125)).toBe('2:05'));
  it('labels dummies ally or enemy of the local hero with live hp', () => {
    const h = (id: number, team: 'dawn' | 'dusk', controller: string) => ({ id, team, controller, heroId: 'shrike' }) as unknown as HeroView;
    const view = {
      localHero: 1,
      heroes: [h(1, 'dawn', 'human'), h(2, 'dawn', 'dummy'), h(3, 'dusk', 'dummy')],
      entities: [{ id: 2, hp: 232, maxHp: 580 }, { id: 3, hp: 720, maxHp: 720 }],
    } as unknown as SimView;
    expect(dummies(view).map((d) => [d.label, d.hp, d.maxHp])).toEqual([['Ally dummy', 232, 580], ['Enemy dummy', 720, 720]]);
  });
});
