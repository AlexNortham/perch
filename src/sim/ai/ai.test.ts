// Bot AI (GDD §11): the pure pieces (scored buying, AP, picks, lanes, nav, aim) and the G22 proof that a Play match
// (1 human + 11 bots) has every lane fighting within the first minute.
import { describe, expect, it } from 'vitest';
import { HERO_IDS, IDLE_COMMAND } from '../core/contracts';
import type { HeroEntity, HeroId, ItemScores, RosterSlot } from '../core/contracts';
import { createRng } from '../core/rng';
import { AP_COSTS } from '../data/abilities';
import { DIFFICULTIES, PICK_ORDER } from '../data/ai';
import { BUILDS } from '../data/builds';
import { ITEMS } from '../data/items';
import { STRUCTURE_RADIUS } from '../data/world';
import { HEROES } from '../heroes/registry';
import { createSim, humanRoster } from '../index';
import { loadMap } from '../world/map';
import { acquire, createAim, track } from './aim';
import { assignLanes, botsOf, pickBotHero } from './index';
import { laneGeom } from './lanes';
import { navFor } from './nav';
import { choosePurchase, exp, nextUpgrade, softmaxPick } from './shop';

const catalogue = new Map(ITEMS.map((i) => [i.id, i]));
const stub = (seeds: number, items: string[] = [], ap = 0): HeroEntity =>
  ({
    progress: { level: 1, molts: 0, seeds, netWorth: seeds },
    inventory: { items: items.map((item) => ({ item, readyAt: 0 })), actives: [null, null, null, null] },
    abilities: {
      ap,
      casting: null,
      channelling: false,
      slots: [0, 1, 2, 3].map((i) => ({ ability: String(i), unlocked: i < 3, tier: 0, readyAt: 0, cooldownTicks: 0, charges: 1 })),
    },
  }) as unknown as HeroEntity;
const policy = (scores: ItemScores | null, temperature = 0.5) => ({ scores, temperature, random: scores === null, situational: new Set<string>() });

describe('§11.4 scored buying (D-EP-036)', () => {
  it('exp is plain arithmetic and matches Math.exp', () => {
    for (const x of [-30, -5.5, -1, -0.3, 0, 0.7, 2, 9]) expect(Math.abs(exp(x) / Math.exp(x) - 1)).toBeLessThan(1e-12);
  });

  it('softmax: a one-logit lead at T = 1 wins about e / (1 + e); T = 0 is the argmax', () => {
    const rng = createRng(1, 'test');
    let wins = 0;
    for (let i = 0; i < 4000; i++) if (softmaxPick([1, 0], 1, rng) === 0) wins++;
    expect(wins / 4000).toBeGreaterThan(0.70);
    expect(wins / 4000).toBeLessThan(0.76);
    expect(softmaxPick([0.2, 0.9, 0.5], 0, rng)).toBe(1);
  });

  it('buys only affordable listed items, upgrades in place, and with full slots only trades up a tier', () => {
    const scores = BUILDS.scores.pelican!;
    const rng = createRng(2, 'shop');
    expect(choosePurchase(stub(799), catalogue, policy(scores), 'early', 12, rng)).toBeNull();
    const first = choosePurchase(stub(800), catalogue, policy(scores), 'early', 12, rng)!;
    expect(catalogue.get(first.buy)!.cost).toBe(800);
    // Owning Quick Preen: Flurry Feathers costs the difference and needs no slot.
    const up = choosePurchase(stub(800, ['quick-preen']), catalogue, policy({ base: { 'flurry-feathers': 5 }, synergy: {}, phase: {} }), 'early', 1, rng);
    expect(up).toEqual({ buy: 'flurry-feathers', sell: null });
    // One slot, full of a tier 1: a tier 2 that scores well enough replaces it (the sale's refund counts); a tier 1
    // never does.
    const t2 = ITEMS.find((i) => i.tier === 2 && i.component === null && !i.active)!;
    const trade = choosePurchase(stub(t2.cost - 400, ['lilt-seed']), catalogue,
      policy({ base: { 'lilt-seed': 0, 'quill-clip': 3, [t2.id]: 3 }, synergy: {}, phase: {} }, 0), 'early', 1, rng);
    expect(trade).toEqual({ buy: t2.id, sell: 'lilt-seed' });
  });

  it('never asks for a fifth active', () => {
    const actives = ITEMS.filter((i) => i.active && i.component === null).map((i) => i.id);
    const more = ITEMS.filter((i) => i.active && !actives.slice(0, 4).includes(i.id) && i.component === null);
    const scores: ItemScores = { base: Object.fromEntries(more.map((i) => [i.id, 9])), synergy: {}, phase: {} };
    expect(actives.length).toBeGreaterThanOrEqual(4);
    expect(more.length).toBeGreaterThan(0);
    expect(choosePurchase(stub(99_999, actives.slice(0, 4)), catalogue, policy(scores, 0), 'early', 12, createRng(3, 'x'))).toBeNull();
  });

  it('AP: the ultimate tier whenever affordable, else T1s in priority order, then T2s', () => {
    const h = stub(0, [], 1);
    expect(nextUpgrade(h, [2, 0, 1])).toBe(2);
    h.abilities.slots[3].unlocked = true;
    expect(nextUpgrade(h, [2, 0, 1])).toBe(3);
    h.abilities.slots[3].tier = 1;
    for (const s of h.abilities.slots.slice(0, 3)) s.tier = 1;
    h.abilities.ap = AP_COSTS[1];
    expect(nextUpgrade(h, [1, 0, 2])).toBe(3);
    h.abilities.slots[3].tier = 2;
    expect(nextUpgrade(h, [1, 0, 2])).toBe(1);
  });

  it('round 0 BUILDS: scores and a three-core build for every hero, GDD §11.4 phases', () => {
    expect(BUILDS.phases).toEqual({ midFromS: 600, lateFromS: 1320 });
    for (const id of HERO_IDS) {
      expect(BUILDS.scores[id], id).toBeDefined();
      const b = BUILDS.builds[id]!;
      expect(b.early.length + b.mid.length + b.late.length).toBeGreaterThanOrEqual(9);
      expect(b.situational.length).toBeGreaterThanOrEqual(3);
      for (const id2 of [...b.early, ...b.mid, ...b.late, ...b.situational.map((s) => s.item)]) expect(catalogue.has(id2), id2).toBe(true);
    }
  });
});

describe('§11.6 picks and §11.3 lanes', () => {
  it('fills support, tank, gun carry and area control first, from implemented heroes, never doubling an archetype', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = createRng(seed, 'roster');
      const flock: HeroId[] = [];
      const taken = new Set<HeroId>();
      for (let i = 0; i < 6; i++) {
        const id = pickBotHero(rng, taken, flock);
        expect(HEROES[id].implemented).toBe(true);
        if (i < PICK_ORDER.length) expect(HEROES[id].def.archetype).toBe(PICK_ORDER[i]);
        flock.push(id);
        taken.add(id);
      }
      expect(new Set(flock.map((id) => HEROES[id].def.archetype)).size).toBe(6);
    }
  });

  it('lanes 2-2-2 on the lanes core assigned (D-ARCH-034): one near side and one roamer per lane', async () => {
    const sim = await createSim({ seed: 1, roster: humanRoster(1, 'owl') });
    const heroes = sim.ctx.store.list('hero');
    const lanes = assignLanes(heroes);
    for (const team of ['dawn', 'dusk'] as const) {
      const mine = heroes.filter((h) => h.team === team);
      const count = (l: string) => mine.filter((h) => lanes.get(h.id)?.lane === l).length;
      expect([count('hedgerow'), count('riverbank'), count('pinewood')]).toEqual([2, 2, 2]);
      for (const l of ['hedgerow', 'riverbank', 'pinewood']) {
        expect(mine.filter((h) => lanes.get(h.id)?.lane === l).map((h) => lanes.get(h.id)?.roamer).sort()).toEqual([false, true]);
      }
    }
    for (const h of heroes) expect(lanes.get(h.id)?.lane, h.hero.heroId).toBe(h.hero.lane);
    expect(lanes.get(sim.view.localHero!)?.roamer, 'the human holds its lane, its partner roams').toBe(false);
  });
});

describe('nav and lanes', () => {
  const map = loadMap('main');
  const nav = navFor(map);

  it('routes from both Home Roosts to every lane gate on walk-class links, never across the Patron', () => {
    for (const team of ['dawn', 'dusk'] as const) {
      const start = nav.nearest(map.spawns.find((s) => s.team === team)!.pos);
      const patron = map.structures.find((s) => s.team === team && s.type === 'patron')!;
      for (const lane of map.lanes) {
        const route = nav.route(start, nav.nearest(lane.path[team === 'dawn' ? 0 : lane.path.length - 1]!), DIFFICULTIES.easy.links.reduce(
          (c, k) => ({ ...c, [k]: 1 }), { walk: Infinity, jump: Infinity, dashJump: Infinity, mantle: Infinity, chimney: Infinity, vine: Infinity, updraft: Infinity, drop: Infinity }));
        expect(route, `${team} → ${lane.id}`).not.toBeNull();
        for (const id of route!.nodes) {
          const p = nav.node(id);
          expect(Math.hypot(p.x - patron.pos.x, p.z - patron.pos.z), `${team} ${lane.id}`).toBeGreaterThan(STRUCTURE_RADIUS.patron);
        }
      }
    }
  });

  it('lane geometry: arc length, forward per flock, and the side offset to the right of Dawn', () => {
    const g = laneGeom(map.lanes.find((l) => l.id === 'riverbank')!);
    expect(g.project({ x: 3, y: 0, z: 0 })).toEqual({ s: g.length / 2, off: 3 });
    expect(g.forward('dusk', 10)).toBe(g.length - 10);
    // Dawn walks +z; its right is −x (base.ts).
    expect(g.at(g.length / 2, 2).x).toBeCloseTo(-2);
  });
});

describe('§11.2 ally casts (D-AI-011)', () => {
  it('a hard Flamingo bot casts Poise (affects.self, no selfFallback) on a wounded ally in combat', async () => {
    const sim = await createSim({ seed: 2, map: 'arena', options: { unlockAbilities: true }, roster: [
      { team: 'dawn', hero: 'flamingo', controller: 'hard' },
      { team: 'dawn', hero: 'owl', controller: 'dummy' },
    ] });
    const [flamingo, owl] = sim.ctx.store.list('hero');
    sim.ctx.effects.apply({ kind: 'teleport', to: 'point', face: 'keep' }, { entity: owl!.id, point: { x: 6, y: 0, z: 8 }, dir: { x: 0, y: 0, z: 1 } },
      { source: owl!.id, team: 'dawn', via: 'weapon', ability: null, item: null, values: null, songPower: 0, proc: false, origin: { ...owl!.pos } });
    const casts: string[] = [];
    for (let i = 0; i < 4 * 60; i++) {
      owl!.health.hp = owl!.stats.final.maxHealth * 0.3;
      owl!.health.inCombatUntil = sim.tick + 60;
      sim.step();
      for (const e of sim.drainEvents()) if (e.type === 'ability' && e.caster === flamingo!.id && e.stage === 'land') casts.push(e.ability);
    }
    expect(casts).toContain('flamingo.poise');
  });
});

describe('§11.2 aim', () => {
  it('waits out the reaction time, then tracks to within the difficulty error', async () => {
    const sim = await createSim({ seed: 1, map: 'arena', roster: [{ team: 'dawn', hero: 'owl', controller: 'human' }] });
    const h = sim.ctx.store.list('hero')[0]!;
    const body = HEROES.owl.def.body;
    const d = DIFFICULTIES.hard;
    const rng = createRng(5, 'aim');
    const a = createAim(0);
    const point = { x: h.pos.x + 20, y: h.pos.y + 1, z: h.pos.z + 20 };
    acquire(a, 99, true, 0, d, rng);
    let firstReady = -1;
    for (let t = 0; t < 120; t++) if (track(a, h, body, point, 0, 0, t, d, rng) && firstReady < 0) firstReady = t;
    expect(firstReady).toBeGreaterThanOrEqual(Math.round(d.reactionS * 0.75 * 60));
    expect(Math.abs(a.yaw - Math.PI / 4)).toBeLessThan((4 * d.aimErrorDeg * Math.PI) / 180 + 0.05);
  });
});

describe('G22: Play (1 human + 11 bots) fights in every lane within the first minute', () => {
  it('bots reach all three lanes and trade shots with fledglings and heroes by 1:05', async () => {
    const seed = 1;
    const roster: RosterSlot[] = humanRoster(seed, 'owl', { bots: 11 });
    const sim = await createSim({ seed, map: 'main', roster, options: { structures: true, waves: true, neutrals: false } });
    const me = sim.view.localHero!;
    const lanesHit = new Set<string>();
    let heroOnHero = 0;
    for (let i = 0; i < 65 * 60; i++) {
      sim.step([{ hero: me, command: IDLE_COMMAND }]);
      for (const e of sim.drainEvents()) {
        if (e.type !== 'damage.applied' || e.source === null || !botsOf(sim.ctx).some((b) => b.id === e.source)) continue;
        const t = sim.ctx.store.get(e.target);
        if (t?.kind === 'unit' && t.unit.lane) lanesHit.add(t.unit.lane);
        if (t?.kind === 'hero') heroOnHero++;
      }
    }
    expect([...lanesHit].sort()).toEqual(['hedgerow', 'pinewood', 'riverbank']);
    expect(heroOnHero).toBeGreaterThan(0);
  }, 60_000);
});
