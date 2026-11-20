/**
 * Helpers the Stage 4 objectives share (GDD §§7.8–7.15): world causes, effect targets, pickups, the hero a hit is
 * credited to, match minutes, and box volumes (rooms, footprints, sight prims) in the map's yaw convention.
 */
import type {
  BoxVolume, EffectCause, EffectTarget, EffectVia, Entity, EntityId, HeroEntity, PickupEntity, PickupInfo, PickupType,
  SimContext, StatusDef, Team, Vec3,
} from '../core/contracts';
import { TICK_RATE } from '../data/core';
import * as dmath from '../core/dmath';

const SECONDS_PER_MINUTE = 60;
export const MINUTE_TICKS = SECONDS_PER_MINUTE * TICK_RATE;
/** Feet may sit this far below a box floor and still count as inside it. */
const FLOOR_SLACK = 0.05;
const UP: Vec3 = { x: 0, y: 0, z: 1 };

/** Match minutes now (fractional). */
export const minutes = (ctx: SimContext): number => ctx.clock.tick / TICK_RATE / SECONDS_PER_MINUTE;

export function worldCause(source: EntityId | null, team: Team, origin: Vec3, via: EffectVia): EffectCause {
  return { source, team, via, ability: null, item: null, values: null, songPower: 0, proc: false, origin: { ...origin } };
}

export const targetOf = (e: Entity): EffectTarget => ({ entity: e.id, point: { ...e.pos }, dir: UP });

/** The hero credited for an entity's hits: a hero itself, or a summon's owner. */
export function creditedHero(ctx: SimContext, id: EntityId | null): HeroEntity | undefined {
  let e = id === null ? undefined : ctx.store.get(id);
  if (e?.kind === 'unit' && e.unit.owner !== null) e = ctx.store.get(e.unit.owner);
  return e?.kind === 'hero' ? e : undefined;
}

export function spawnPickup(
  ctx: SimContext,
  type: PickupType,
  pos: Vec3,
  radius: number,
  extra: Partial<Pick<PickupInfo, 'variant' | 'value' | 'expiresAt' | 'melee' | 'claimableAt'>> = {},
): PickupEntity {
  return ctx.store.spawn({
    kind: 'pickup',
    team: 'neutral',
    pos: { ...pos },
    vel: { x: 0, y: 0, z: 0 },
    yaw: 0,
    radius,
    pickup: { type, variant: extra.variant ?? '', value: extra.value ?? 0, expiresAt: extra.expiresAt ?? null, carrier: null,
      ...(extra.melee && { melee: extra.melee }), ...(extra.claimableAt !== undefined && { claimableAt: extra.claimableAt }) },
  });
}

/** Apply a status from the world (cleansing any status with the same id first, so a new one replaces the old). */
export function giveStatus(ctx: SimContext, h: HeroEntity, status: StatusDef, cause: EffectCause, durationS?: number): void {
  const target = targetOf(h);
  ctx.effects.apply({ kind: 'cleanse', remove: [status.id] }, target, cause);
  ctx.effects.apply({ kind: 'applyStatus', status, ...(durationS !== undefined && { durationS }) }, target, cause);
}

/** A box volume's frame: local x = dx·cos − dz·sin, local z = dx·sin + dz·cos (map/geometry.ts convention). */
export interface BoxFrame {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly cos: number;
  readonly sin: number;
  readonly hx: number;
  readonly hy: number;
  readonly hz: number;
}

export const frameOf = (v: BoxVolume): BoxFrame => ({
  cx: v.centre.x, cy: v.centre.y, cz: v.centre.z, cos: dmath.cos(v.yaw), sin: dmath.sin(v.yaw),
  hx: v.size.x / 2, hy: v.size.y / 2, hz: v.size.z / 2,
});

/** Feet at `p` inside the box, `inset` metres clear of its sides, from its floor to its ceiling. */
export function inBox(f: BoxFrame, p: Vec3, inset: number): boolean {
  const dx = p.x - f.cx;
  const dz = p.z - f.cz;
  const lx = dx * f.cos - dz * f.sin;
  const lz = dx * f.sin + dz * f.cos;
  const dy = p.y - f.cy;
  return Math.abs(lx) <= f.hx - inset && Math.abs(lz) <= f.hz - inset && dy >= -f.hy - FLOOR_SLACK && dy <= f.hy;
}

/** Move `p` (x, z) to the nearest point at least `inset` inside the box's sides. */
export function clampToBox(f: BoxFrame, p: Vec3, inset: number): void {
  const dx = p.x - f.cx;
  const dz = p.z - f.cz;
  const ex = Math.max(0, f.hx - inset);
  const ez = Math.max(0, f.hz - inset);
  const lx = Math.min(ex, Math.max(-ex, dx * f.cos - dz * f.sin));
  const lz = Math.min(ez, Math.max(-ez, dx * f.sin + dz * f.cos));
  p.x = f.cx + lx * f.cos + lz * f.sin;
  p.z = f.cz - lx * f.sin + lz * f.cos;
}

export const flatDistSq = (a: Vec3, b: Vec3): number => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
