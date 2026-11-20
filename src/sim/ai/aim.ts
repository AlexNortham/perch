/**
 * Human-like aim for bots (GDD §11.2): bots turn the same camera as the player (core/aim.ts) and only ever set look
 * yaw and pitch. On a new target they react after a seeded delay and flick with an overshoot; then they track it
 * through a smoothing filter, carrying a wandering error that grows with the target's speed across the line of
 * sight, and their pitch rides up a little with every shot (the hand on the gun's kick) for tracking to pull back.
 */
import type { BodyPlan, EntityId, HeroEntity, Rng, Tick, Vec3 } from '../core/contracts';
import { aimRay } from '../core/aim';
import * as dmath from '../core/dmath';
import { RAD_PER_DEG } from '../data/abilities';
import { AIM } from '../data/ai';
import type { Difficulty } from '../data/ai';
import { TICK_SECONDS } from '../data/core';

export interface AimState {
  yaw: number;
  pitch: number;
  /** The wandering error now and the one it eases toward (radians). */
  errYaw: number;
  errPitch: number;
  goalYaw: number;
  goalPitch: number;
  errAt: Tick;
  target: EntityId | null;
  /** Earliest tick to fire at the current target (reaction time). */
  fireFrom: Tick;
  /** Flicking toward a new target until this tick. */
  flickUntil: Tick;
  /** Aim at the head this engagement. */
  head: boolean;
}

export function createAim(yaw: number): AimState {
  return { yaw, pitch: 0, errYaw: 0, errPitch: 0, goalYaw: 0, goalPitch: 0, errAt: 0, target: null, fireFrom: 0, flickUntil: 0, head: false };
}

/** Wrap an angle to (−π, π]. */
export function wrap(a: number): number {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x <= -Math.PI) x += Math.PI * 2;
  return x;
}

/** About N(0, 1) from four uniforms (two differences, scaled to unit deviation): no transcendental functions. */
function normal(rng: Rng): number {
  return (rng.next() - rng.next() + rng.next() - rng.next()) * AIM.unitScale;
}

/** Look yaw and pitch that put the crosshair (the camera ray, not the pivot) through p. */
export function solveLook(h: HeroEntity, body: BodyPlan, p: Vec3, yaw: number, pitch: number): { yaw: number; pitch: number } {
  let y = yaw;
  let q = pitch;
  for (let i = 0; i < AIM.solvePasses; i++) {
    const ray = aimRay(h.pos, y, q, h.shoulder, body, h.motor.crouching || h.motor.sliding);
    y = dmath.atan2(p.x - ray.origin.x, p.z - ray.origin.z);
    q = dmath.atan2(p.y - ray.origin.y, dmath.hypot(p.x - ray.origin.x, p.z - ray.origin.z));
  }
  return { yaw: y, pitch: q };
}

/** Start an engagement with a new target: reaction delay, head or body, and a flick that overshoots. */
export function acquire(a: AimState, target: EntityId, isHero: boolean, now: Tick, d: Difficulty, rng: Rng): void {
  a.target = target;
  const jitter = 1 + (rng.next() * 2 - 1) * AIM.reactionJitter;
  const reaction = d.reactionS * jitter * (isHero ? 1 : AIM.unitReaction);
  a.fireFrom = now + Math.round(reaction / TICK_SECONDS);
  a.flickUntil = a.fireFrom;
  a.head = isHero && rng.chance(d.headRate);
  const sigma = d.aimErrorDeg * RAD_PER_DEG * AIM.flickOvershoot;
  a.errYaw = normal(rng) * sigma;
  a.errPitch = normal(rng) * sigma * AIM.pitchShare;
  a.errAt = now;
}

/**
 * One tick of aiming at `point` (already led) for a target moving `lateral` m/s across the line of sight. Returns
 * whether the crosshair is close enough to its intended point to pull the trigger (the bot's own belief: its error
 * is invisible to it).
 */
export function track(
  a: AimState, h: HeroEntity, body: BodyPlan, point: Vec3, lateral: number, sizeRad: number, now: Tick, d: Difficulty, rng: Rng,
): boolean {
  if (now >= a.errAt) {
    const sigma = (d.aimErrorDeg + d.errorPerMpsDeg * lateral) * RAD_PER_DEG;
    a.goalYaw = normal(rng) * sigma;
    a.goalPitch = normal(rng) * sigma * AIM.pitchShare;
    a.errAt = now + Math.round(AIM.errorEveryS / TICK_SECONDS);
  }
  const ease = TICK_SECONDS / AIM.errorEveryS;
  a.errYaw += (a.goalYaw - a.errYaw) * ease;
  a.errPitch += (a.goalPitch - a.errPitch) * ease;
  const want = solveLook(h, body, point, a.yaw, a.pitch);
  const wantYaw = want.yaw + a.errYaw;
  const wantPitch = want.pitch + a.errPitch;
  const tau = now < a.flickUntil ? d.trackingS / AIM.flickSpeed : d.trackingS;
  const k = TICK_SECONDS / (tau + TICK_SECONDS);
  a.yaw = wrap(a.yaw + wrap(wantYaw - a.yaw) * k);
  a.pitch += (wantPitch - a.pitch) * k;
  const off = dmath.hypot(wrap(wantYaw - a.yaw), wantPitch - a.pitch);
  return now >= a.fireFrom && off <= AIM.fireConeDeg * RAD_PER_DEG + sizeRad;
}

/** The gun fired this tick: the look climbs a little. */
export function kick(a: AimState): void {
  a.pitch += AIM.recoilDeg * RAD_PER_DEG;
}

/** Turn toward a yaw (and level pitch) at the tracking rate, for walking. */
export function lookAlong(a: AimState, yaw: number, pitch: number, d: Difficulty): void {
  const k = TICK_SECONDS / (d.trackingS + TICK_SECONDS);
  a.yaw = wrap(a.yaw + wrap(yaw - a.yaw) * k);
  a.pitch += (pitch - a.pitch) * k;
}
