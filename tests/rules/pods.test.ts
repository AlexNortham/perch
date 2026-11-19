// Seed pod rules suite, written test-first from GDD §8.1–§8.2 and the pickup/pod contracts (entity.ts PickupInfo,
// events.ts projectile.impact, melee, pod.resolved, seeds.gained) (D-EP-006). Always on since
// the wave 3 integration.
//
// Fledglings are sandbox dummies on the Riverbank lane, killed with a `damage` effect from a hero. Pod hits are fake
// combat events (`projectile.impact` / `melee` with the pod as target, exactly what sim/combat reports) so the rules
// are tested on their own; one test shoots a pod for real.
import { describe, expect, it } from 'vitest';
import type { EntityId, PickupEntity, PlayerTeam, SeedReason, Vec3 } from '../../src/sim/core/contracts';
import { TICK_RATE } from '../../src/sim/data/core';
import { laneLength, laneOf, offset, pointAt } from '../helpers/lanes';
import { createSandbox } from '../helpers/sandbox';
import type { Sandbox } from '../helpers/sandbox';

const TIMEOUT_MS = 120_000;

/** GDD §8.2: fledgling base values and growth. */
const BASE = { scrapper: 40, slinger: 50 } as const;
const GROWTH_PER_MIN = 0.035;
const GROWTH_CAP = 2.4;
/** GDD §8.2 pod timing. */
const RISE_S = 0.6;
const RISE_M = 1.6;
const RIPE_S = 1.4;
/** GDD §8.2: no-hero kills share the instant half among enemy heroes within this range. */
const SHARE_RANGE = 25;
/** GDD §7.1: model heights (the pod appears at the chest). */
const HEIGHT = { scrapper: 0.9, slinger: 0.8 } as const;
const PAYOUT_REASONS: readonly SeedReason[] = ['lastHit', 'pod', 'share'];

/** V = base × min(2.4, 1 + 0.035 × minutes) at the death tick (GDD §8.2). */
function value(type: keyof typeof BASE, tick: number): number {
  return BASE[type] * Math.min(GROWTH_CAP, 1 + (GROWTH_PER_MIN * tick) / TICK_RATE / 60);
}

interface Lane {
  sb: Sandbox;
  /** Dusk heroes: the killer, a second one in share range and one out of it. Dawn: the denier. */
  killer: EntityId;
  second: EntityId;
  far: EntityId;
  denier: EntityId;
  at: Vec3;
  /** Dawn → Dusk along the lane. */
  dir: Vec3;
}

/** Four heroes around the middle of the Riverbank lane on the real map, waves off. */
async function riverbank(): Promise<Lane> {
  const sb = await createSandbox({
    map: 'main',
    heroes: [
      { hero: 'shrike', team: 'dusk' },
      { hero: 'albatross', team: 'dusk' },
      { hero: 'kingfisher', team: 'dusk' },
      { hero: 'lyrebird', team: 'dawn' },
    ],
  });
  const lane = laneOf(sb.ctx.map, 'riverbank');
  const { point, dir } = pointAt(lane, laneLength(lane) / 2);
  const [killer, second, far, denier] = sb.heroes as [EntityId, EntityId, EntityId, EntityId];
  sb.place(killer, offset(point, dir, 6), Math.PI);
  sb.place(second, offset(point, dir, 10, 3), Math.PI);
  sb.place(far, offset(point, dir, SHARE_RANGE + 8), Math.PI);
  sb.place(denier, offset(point, dir, -6), 0);
  sb.step();
  return { sb, killer, second, far, denier, at: point, dir };
}

/** Spawn a Dawn fledgling dummy at the lane point and kill it with a hit credited to `by` (null: no hero). */
function killFledgling(
  l: Lane,
  type: keyof typeof BASE,
  by: EntityId | null,
  team: PlayerTeam = 'dawn',
): { unit: EntityId; diedAt: number; pod: PickupEntity | undefined } {
  const { sb } = l;
  const unit = sb.dummy({ kind: 'unit', type, lane: 'riverbank', team, at: l.at, hp: 300, height: HEIGHT[type] });
  sb.clearEvents();
  const killerUnit =
    by === null ? sb.dummy({ kind: 'unit', type: 'scrapper', lane: 'riverbank', team: 'dusk', at: offset(l.at, l.dir, 40), hp: 300 }) : null;
  sb.apply({ kind: 'damage', amount: 10_000, type: 'talon' }, unit, sb.cause(by ?? killerUnit, { via: by === null ? 'unit' : 'weapon' }));
  sb.step();
  const diedAt = sb.sim.tick;
  const pod = sb.ctx.store.list('pickup').find((p) => p.pickup.type === 'pod');
  return { unit, diedAt, pod };
}

/** Seeds paid to a hero for these reasons since the last clearEvents. */
function paid(sb: Sandbox, hero: EntityId, reasons: readonly SeedReason[] = PAYOUT_REASONS): number {
  return sb
    .eventsOf('seeds.gained')
    .filter((e) => e.hero === hero && reasons.includes(e.reason))
    .reduce((sum, e) => sum + e.amount, 0);
}

/**
 * What sim/combat reports when a bullet passes through a pod (entity.ts PickupInfo, events.ts). `pos` is where the pod
 * was: a resolved pod despawns, so a shot at it afterwards can't read its position and must be given the old one.
 */
function shootPod(sb: Sandbox, by: EntityId, pod: EntityId, pos: Vec3 = sb.entity(pod).pos): void {
  sb.ctx.bus.emit({ type: 'projectile.impact', owner: by, pos: { ...pos }, normal: { x: 0, y: 1, z: 0 }, target: pod, beakShot: false });
}

const ticks = (s: number): number => Math.round(s * TICK_RATE);

describe('seed pods (GDD §8.2)', () => {
  it('§8.2: a last hit pays the killer the instant share, 50% of V, rounded down (§8.1)', async () => {
    const l = await riverbank();
    const { diedAt } = killFledgling(l, 'scrapper', l.killer);
    const share = Math.floor(value('scrapper', diedAt) / 2);
    expect(paid(l.sb, l.killer, ['lastHit'])).toBe(share);
    expect(l.sb.hero(l.killer).progress.seeds).toBeGreaterThanOrEqual(share);
    expect(paid(l.sb, l.second) + paid(l.sb, l.denier)).toBe(0);
  }, TIMEOUT_MS);

  it('§8.2 rule 1: the pod appears at the chest, belongs to the fledgling’s side, holds 50% V and rises 1.6 m in 0.6 s', async () => {
    const l = await riverbank();
    const { pod, diedAt } = killFledgling(l, 'scrapper', l.killer);
    expect(pod, 'a pod pickup after the kill').toBeDefined();
    const p = pod as PickupEntity;
    expect(p.team).toBe('dawn');
    expect(Math.floor(p.pickup.value)).toBe(Math.floor(value('scrapper', diedAt) / 2));
    const y0 = p.pos.y;
    expect(y0).toBeGreaterThanOrEqual(l.at.y);
    expect(y0).toBeLessThanOrEqual(l.at.y + HEIGHT.scrapper + 0.05);
    l.sb.step(ticks(RISE_S));
    expect(p.pos.y - y0).toBeCloseTo(RISE_M, 1);
    l.sb.step(ticks(RIPE_S / 2));
    expect(p.pos.y - y0, 'it hangs while ripe').toBeCloseTo(RISE_M, 1);
  }, TIMEOUT_MS);

  it('§8.2 rule 3: an enemy hero’s bullet on the ripe pod secures it for 50% V', async () => {
    const l = await riverbank();
    const { pod, diedAt } = killFledgling(l, 'scrapper', l.second);
    expect(pod).toBeDefined();
    const id = (pod as PickupEntity).id;
    l.sb.step(ticks(RISE_S) + 1);
    l.sb.clearEvents();
    shootPod(l.sb, l.killer, id);
    l.sb.step();
    expect(l.sb.eventsOf('pod.resolved')).toMatchObject([{ pod: id, by: l.killer, outcome: 'secured' }]);
    expect(paid(l.sb, l.killer, ['pod'])).toBe(Math.floor(value('scrapper', diedAt) / 2));
    expect(l.sb.ctx.store.get(id)).toBeUndefined();
    expect(l.sb.sim.telemetry().heroes[0]?.podsSecured).toBe(1);
  }, TIMEOUT_MS);

  it('§8.2 rule 4: a hero of the fledgling’s own side denies it for 25% V and the pod share is gone', async () => {
    const l = await riverbank();
    const { pod, diedAt } = killFledgling(l, 'scrapper', l.killer);
    expect(pod).toBeDefined();
    const id = (pod as PickupEntity).id;
    l.sb.step(ticks(RISE_S) + 1);
    l.sb.clearEvents();
    const at = { ...l.sb.entity(id).pos };
    shootPod(l.sb, l.denier, id, at);
    l.sb.step();
    expect(l.sb.eventsOf('pod.resolved')).toMatchObject([{ pod: id, by: l.denier, outcome: 'denied' }]);
    expect(paid(l.sb, l.denier)).toBe(Math.floor(value('scrapper', diedAt) / 4));
    l.sb.clearEvents();
    shootPod(l.sb, l.killer, id, at);
    l.sb.step();
    expect(l.sb.eventsOf('pod.resolved')).toHaveLength(0);
    expect(paid(l.sb, l.killer)).toBe(0);
    expect(l.sb.sim.telemetry().heroes[3]?.denies).toBe(1);
  }, TIMEOUT_MS);

  it('§8.2 rules 1–2: a rising pod can’t be hit; melee resolves a ripe one', async () => {
    const l = await riverbank();
    const { pod } = killFledgling(l, 'slinger', l.second);
    expect(pod).toBeDefined();
    const id = (pod as PickupEntity).id;
    l.sb.step(ticks(RISE_S / 2));
    l.sb.clearEvents();
    shootPod(l.sb, l.killer, id);
    l.sb.step();
    expect(l.sb.eventsOf('pod.resolved'), 'no resolve while rising').toHaveLength(0);
    expect(l.sb.ctx.store.get(id)).toBeDefined();
    l.sb.step(ticks(RISE_S / 2) + 1);
    l.sb.ctx.bus.emit({ type: 'melee', attacker: l.killer, heavy: false, target: id, parried: false });
    l.sb.step();
    expect(l.sb.eventsOf('pod.resolved')).toMatchObject([{ pod: id, by: l.killer, outcome: 'secured' }]);
  }, TIMEOUT_MS);

  it('§8.2 rule 5: a pod nobody hits withers when its 1.4 s ripe window ends', async () => {
    const l = await riverbank();
    const { pod } = killFledgling(l, 'scrapper', l.killer);
    expect(pod).toBeDefined();
    const id = (pod as PickupEntity).id;
    l.sb.clearEvents();
    l.sb.step(ticks(RISE_S + RIPE_S) - 3);
    expect(l.sb.ctx.store.get(id), 'still there just before the window ends').toBeDefined();
    l.sb.step(6);
    expect(l.sb.ctx.store.get(id)).toBeUndefined();
    expect(l.sb.eventsOf('pod.resolved')).toHaveLength(0);
    expect(l.sb.heroes.reduce((sum, h) => sum + paid(l.sb, h, ['pod']), 0)).toBe(0);
  }, TIMEOUT_MS);

  it('§8.2: a Slinger is worth 50, so its last hit pays 25', async () => {
    const l = await riverbank();
    const { diedAt } = killFledgling(l, 'slinger', l.killer);
    expect(paid(l.sb, l.killer, ['lastHit'])).toBe(Math.floor(value('slinger', diedAt) / 2));
  }, TIMEOUT_MS);

  it('§8.2: with no hero last hit, the instant share splits evenly among enemy heroes within 25 m', async () => {
    const l = await riverbank();
    const { diedAt } = killFledgling(l, 'scrapper', null);
    const each = Math.floor(value('scrapper', diedAt) / 2 / 2);
    expect(paid(l.sb, l.killer)).toBe(each);
    expect(paid(l.sb, l.second)).toBe(each);
    expect(paid(l.sb, l.far), 'out of range').toBe(0);
    expect(paid(l.sb, l.denier), 'not an enemy of the fledgling').toBe(0);
  }, TIMEOUT_MS);

  it('§8.2: with no hero last hit and no enemy hero within 25 m, the instant share is lost', async () => {
    const l = await riverbank();
    for (const h of [l.killer, l.second]) l.sb.place(h, offset(l.at, l.dir, SHARE_RANGE + 10));
    l.sb.step();
    killFledgling(l, 'scrapper', null);
    expect(l.sb.eventsOf('entity.died'), 'the fledgling died').toHaveLength(1);
    expect(l.sb.heroes.reduce((sum, h) => sum + paid(l.sb, h), 0)).toBe(0);
  }, TIMEOUT_MS);

  it('§8.2: V grows 3.5% per minute (a Scrapper is worth 54 at 10:00)', async () => {
    const l = await riverbank();
    l.sb.step(ticks(10 * 60) - l.sb.sim.tick);
    for (const [h, at] of [[l.killer, 6], [l.denier, -6]] as const) l.sb.place(h, offset(l.at, l.dir, at));
    const { diedAt } = killFledgling(l, 'scrapper', l.killer);
    expect(value('scrapper', diedAt)).toBeCloseTo(54, 2);
    expect(paid(l.sb, l.killer, ['lastHit'])).toBe(27);
  }, TIMEOUT_MS);

  it('§8.2 rule 6 with §5.6: a real bullet passes through the ripe pod and secures it', async () => {
    const l = await riverbank();
    const { pod } = killFledgling(l, 'scrapper', l.second);
    expect(pod).toBeDefined();
    const id = (pod as PickupEntity).id;
    l.sb.step(ticks(RISE_S) + 1);
    l.sb.clearEvents();
    l.sb.aimAt(l.killer, id);
    l.sb.fire(l.killer);
    l.sb.stepUntil(() => l.sb.eventsOf('pod.resolved').length > 0, ticks(RIPE_S) - 2);
    expect(l.sb.eventsOf('pod.resolved')).toMatchObject([{ pod: id, by: l.killer, outcome: 'secured' }]);
  }, TIMEOUT_MS);
});
