import { TICK_SECONDS } from '../../sim/data/core';
import { lerpAngle, lerpVec } from '../../sim/core/math';
import type { EntityId, EntityView, SimView, Vec3 } from '../../sim/core/contracts';
import type { Frame } from './contracts';

/** At most this many sim steps per rendered frame; a longer stall drops time instead of spiralling. */
export const MAX_STEPS_PER_FRAME = 5;
/** Rounding slack so float error in the accumulator never delays a step by a frame. */
const STEP_EPSILON = 1e-9;

/**
 * Fixed-step accumulator: real time in, whole 60 Hz sim steps out, plus the blend (alpha) for interpolation.
 */
export interface FixedStep {
  /** Add elapsed wall-clock seconds; returns how many sim steps to run now. */
  advance(seconds: number): number;
  /** 0..1: how far real time is past the last step, toward the next. */
  readonly alpha: number;
  reset(): void;
}

export function createFixedStep(step = TICK_SECONDS, maxSteps = MAX_STEPS_PER_FRAME): FixedStep {
  let acc = 0;
  return {
    advance(seconds) {
      acc += Math.max(0, seconds);
      const steps = Math.min(maxSteps, Math.floor(acc / step + STEP_EPSILON));
      acc = Math.max(0, acc - steps * step);
      if (steps === maxSteps && acc >= step) acc = 0;
      return steps;
    },
    get alpha() {
      return Math.min(1, acc / step);
    },
    reset() {
      acc = 0;
    },
  };
}

const index = new WeakMap<SimView, Map<EntityId, EntityView>>();

/** Entity lookup by id in a view (cached per view). */
export function entityById(view: SimView, id: EntityId): EntityView | undefined {
  let map = index.get(view);
  if (!map) {
    map = new Map(view.entities.map((e) => [e.id, e]));
    index.set(view, map);
  }
  return map.get(id);
}

export interface Interpolated {
  readonly pos: Vec3;
  readonly yaw: number;
  readonly pitch: number;
}

/** An entity's transform between frame.prev and frame.curr. New entities sit at their current transform. */
export function interpolate(frame: Frame, entity: EntityView): Interpolated {
  const before = entityById(frame.prev, entity.id) ?? entity;
  return {
    pos: lerpVec(before.pos, entity.pos, frame.alpha),
    yaw: lerpAngle(before.yaw, entity.yaw, frame.alpha),
    pitch: before.pitch + (entity.pitch - before.pitch) * frame.alpha,
  };
}
