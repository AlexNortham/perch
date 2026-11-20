/**
 * Stage 4 world helpers (QA, W4.5): a neutrals-on match on the real 'main' map, a clock fast-forward, and the melee
 * and pickup helpers the objective suites share. Heroes only do what a test tells them (see sandbox.ts).
 */
import { Button } from '../../src/sim/core/contracts';
import type { EntityId, EventOf, HeroId, PickupEntity, PickupType, PlayerTeam, SimEventType, Vec3 } from '../../src/sim/core/contracts';
import { TICK_RATE } from '../../src/sim/data/core';
import { createSandbox, type Sandbox } from './sandbox';

/** GDD §3 table: a hold of 0.35 s of Melee commits a heavy hit; a shorter press is light. */
const HEAVY_HOLD_TICKS = Math.ceil(0.4 * TICK_RATE);
const ADVANCE_CHUNK_TICKS = 600;

export const mmss = (m: number, s = 0): number => m * 60 + s;
export const seconds = (sb: Sandbox): number => sb.sim.tick / TICK_RATE;
export const minutes = (sb: Sandbox): number => seconds(sb) / 60;

export interface WorldSpec {
  readonly heroes: readonly (HeroId | { readonly hero: HeroId; readonly team?: PlayerTeam })[];
  readonly seed?: number;
  readonly startSeeds?: number;
  /** Keep base health regeneration (the sandbox's default zeroes it, and with it any +HP/s buff). */
  readonly regen?: boolean;
}

/** The detailed main map with Thickets, Nests, runes, the Egg and the Roc on; no waves, no structures. */
export function world(spec: WorldSpec): Promise<Sandbox> {
  return createSandbox({
    map: 'main',
    seed: spec.seed ?? 1,
    heroes: spec.heroes,
    regen: spec.regen ?? false,
    options: { neutrals: true, waves: false, structures: false, unlockAbilities: false, startSeeds: spec.startSeeds ?? 0 },
  });
}

/** Step until the match clock reaches `s` seconds (never goes backwards). */
export function advanceTo(sb: Sandbox, s: number): void {
  const target = Math.round(s * TICK_RATE);
  while (sb.sim.tick < target) sb.step(Math.min(ADVANCE_CHUNK_TICKS, target - sb.sim.tick));
}

export function advanceBy(sb: Sandbox, s: number): void {
  advanceTo(sb, seconds(sb) + s);
}

export const pickupsOf = (sb: Sandbox, type: PickupType): PickupEntity[] =>
  sb.ctx.store.list('pickup').filter((p) => p.pickup.type === type && !p.removed);

/** Objective events of one action since the last clear. */
export const objectiveEvents = (sb: Sandbox, action: EventOf<'objective'>['action']): EventOf<'objective'>[] =>
  sb.eventsOf('objective').filter((e) => e.action === action);

export const count = (sb: Sandbox, type: SimEventType): number => sb.events.filter((e) => e.type === type).length;

/** Put `hero` 1 m from `at` on the ground side, facing it, with the camera level on the target. */
export function standBeside(sb: Sandbox, hero: EntityId, at: Vec3, reach = 1.0): void {
  sb.place(hero, { x: at.x - reach, y: at.y, z: at.z }, Math.PI / 2);
  sb.aimAt(hero, { x: at.x, y: at.y + 1, z: at.z });
  sb.step();
}

/** A light melee hit: one tap, then let the swing finish. */
export function lightMelee(sb: Sandbox, hero: EntityId): void {
  sb.press(hero, Button.Melee);
  sb.step(Math.ceil(0.6 * TICK_RATE));
}

/** A heavy melee hit: press, hold past the 0.35 s commitment, release, let the swing finish. */
export function heavyMelee(sb: Sandbox, hero: EntityId): void {
  // A swing starts on the press edge; a hold alone never swings.
  sb.press(hero, Button.Melee);
  sb.hold(hero, Button.Melee);
  sb.step(HEAVY_HOLD_TICKS);
  sb.release(hero, Button.Melee);
  sb.step(Math.ceil(1.2 * TICK_RATE));
}

/** Melee events by `hero` that struck `target`, light or heavy. */
export const meleeHits = (sb: Sandbox, hero: EntityId, target: EntityId, heavy?: boolean): EventOf<'melee'>[] =>
  sb.eventsOf('melee').filter((e) => e.attacker === hero && e.target === target && (heavy === undefined || e.heavy === heavy));

export const lethal = (sb: Sandbox, source: EntityId, target: EntityId): void =>
  sb.apply({ kind: 'damage', amount: 1_000_000, type: 'talon' }, target, sb.cause(source, { via: 'weapon' }));

/** Seeds a hero gained for one reason since the last clear. */
export const earned = (sb: Sandbox, hero: EntityId, reason: EventOf<'seeds.gained'>['reason']): number =>
  sb.eventsOf('seeds.gained').filter((e) => e.hero === hero && e.reason === reason).reduce((sum, e) => sum + e.amount, 0);

export const dist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const flat = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);
