/* eslint-disable @typescript-eslint/no-magic-numbers -- authored proportions: the numbers are the data */
/**
 * Practice Hub target markers (controller 'dummy' heroes). Drawn from the hero's own BodyPlan so the rings sit on the
 * real hitboxes: a ring round the head sphere, rings round the body capsule, a floor ring, and a floating symbol.
 * Enemy damage dummy: red, X and bullseye. Friendly healing dummy: teal, plus sign. Colours are the friend-or-foe
 * outline colours (GDD §14.4), so the two can never be mistaken for each other.
 */
import type { BufferGeometry } from 'three';
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import { ALLY_TEAL, ENEMY_RED } from '../palette';
import { Parts } from './parts';

export type DummyKind = 'enemy' | 'ally';

const TUBE = 0.03;
const HALF_PI = Math.PI / 2;

export function dummyMarker(plan: BodyPlan, kind: DummyKind): BufferGeometry {
  const hex = kind === 'enemy' ? ENEMY_RED : ALLY_TEAL;
  const c = plan.head.centre;
  const hr = plan.head.radius;
  const head: [number, number, number] = [-c.right, c.up, c.forward];
  const top = c.up - hr;
  const p = new Parts();
  // Head hitbox: a horizontal and two vertical rings on the sphere.
  p.ring(hex, hr * 1.08, TUBE, head, [HALF_PI, 0, 0], 18);
  p.ring(hex, hr * 1.08, TUBE, head, [0, 0, 0], 18);
  p.ring(hex, hr * 1.08, TUBE, head, [0, HALF_PI, 0], 18);
  // Body hitbox: rings at chest and belly at the capsule radius, and a floor ring.
  const R = plan.radius;
  p.ring(hex, R * 1.06, TUBE, [0, top * 0.8, 0], [HALF_PI, 0, 0], 18);
  p.ring(hex, R * 1.06, TUBE, [0, top * 0.45, 0], [HALF_PI, 0, 0], 18);
  p.ring(hex, R * 1.7, TUBE * 1.4, [0, 0.04, 0], [HALF_PI, 0, 0], 24);
  const sy = c.up + hr + 0.55;
  if (kind === 'enemy') {
    // Bullseye on the chest (front and back) and an X above the head.
    for (const z of [1, -1]) {
      p.ring(hex, R * 0.5, TUBE, [0, top * 0.62, z * R * 1.02], [0, 0, 0], 14);
      p.ring(hex, R * 0.25, TUBE, [0, top * 0.62, z * R * 1.02], [0, 0, 0], 12);
    }
    p.box(hex, [0.5, 0.09, 0.09], [0, sy, 0], [0, 0, Math.PI / 4]);
    p.box(hex, [0.5, 0.09, 0.09], [0, sy, 0], [0, 0, -Math.PI / 4]);
  } else {
    // A plus sign above the head and a heart-ish ring pair on the chest.
    p.box(hex, [0.5, 0.12, 0.12], [0, sy, 0]);
    p.box(hex, [0.12, 0.5, 0.12], [0, sy, 0]);
    for (const z of [1, -1]) p.ring(hex, R * 0.4, TUBE * 1.4, [0, top * 0.62, z * R * 1.02], [0, 0, 0], 14);
  }
  return p.build();
}
