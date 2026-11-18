import { describe, expect, it } from 'vitest';
import { CAMERA, CROUCH_SCALE } from '../data/core';
import { aimRay, boomLength, lookDir, muzzlePoint, pivotHeight, rightDir, toWorld } from './aim';
import type { BodyPlan } from './contracts';

const body: BodyPlan = {
  height: 1.8,
  radius: 0.4,
  head: { centre: { right: 0, up: 1.6, forward: 0 }, radius: 0.18 },
  muzzle: { right: 0.25, up: 1.25, forward: 0.35 },
};

describe('aim model (GDD §4)', () => {
  it('uses the documented axes: yaw 0 faces +z, right is -x', () => {
    const f = lookDir(0, 0);
    expect([f.x, f.y, f.z]).toEqual([0, 0, 1]);
    const r = rightDir(0);
    expect(r.x).toBe(-1);
    expect(r.z).toBeCloseTo(0);
    const p = toWorld({ x: 0, y: 0, z: 0 }, Math.PI / 2, { right: 1, up: 2, forward: 3 });
    expect(p.x).toBeCloseTo(3);
    expect(p.y).toBeCloseTo(2);
    expect(p.z).toBeCloseTo(1);
  });

  it('puts the camera behind the pivot and over the shoulder; hits start past the pivot', () => {
    const pos = { x: 10, y: 0, z: 10 };
    const ray = aimRay(pos, 0, 0, 1, body, false);
    const pivotY = body.head.centre.up - CAMERA.pivotBelowHead;
    expect(ray.origin.z).toBeCloseTo(10 - CAMERA.boom);
    expect(ray.origin.x).toBeCloseTo(10 - CAMERA.shoulderRight);
    expect(ray.origin.y).toBeCloseTo(pivotY + CAMERA.shoulderUp);
    const toPivot = Math.hypot(CAMERA.boom, CAMERA.shoulderRight, CAMERA.shoulderUp);
    expect(ray.start).toBeCloseTo(toPivot + CAMERA.aimStartPad);
    expect(aimRay(pos, 0, 0, -1, body, false).origin.x).toBeCloseTo(10 + CAMERA.shoulderRight);
  });

  it('scales the boom with hero height within limits', () => {
    expect(boomLength(body)).toBeCloseTo(CAMERA.boom);
    expect(boomLength({ ...body, height: 3 })).toBe(CAMERA.boomMax);
    expect(boomLength({ ...body, height: 1 })).toBe(CAMERA.boomMin);
  });

  it('clamps pitch and lowers pivot and muzzle when crouched', () => {
    const ray = aimRay({ x: 0, y: 0, z: 0 }, 0, 10, 1, body, false);
    expect(Math.asin(ray.dir.y)).toBeCloseTo(CAMERA.pitchMax);
    expect(pivotHeight(body, true)).toBeCloseTo((body.head.centre.up - CAMERA.pivotBelowHead) * CROUCH_SCALE);
    expect(muzzlePoint({ x: 0, y: 0, z: 0 }, 0, body, true).y).toBeCloseTo(body.muzzle.up * CROUCH_SCALE);
  });
});
