/* eslint-disable @typescript-eslint/no-magic-numbers -- authored anatomy: the numbers are the sculpture */
/**
 * Implicit bird bodies (D-ART-008): each bird's skin as signed-distance masses in the model frame at the bind pose,
 * plus the anchors its rig hangs from. A body is one continuous surface from the tail coverts over the back, breast
 * and thighs, up the neck and through the head to the bill base; bones and paint regions blend across every join.
 *
 * Writing a bird: copy the closest one and move its masses. The shared helpers give every bird the same anatomy —
 * `trunk` (back, breast keel, belly, mantle, tail coverts), `shoulders` (scapulars and wing roots that grow out of the
 * body into the wing bones), `thighs` (feathered drumsticks into the leg bones), `neck` (a chain of capsules handing
 * from the body bone to the head bone) and `head` (cranium, brow, cheeks, nape, throat, bill base and eye sockets).
 * Extras (casques, wattles, ruffs) are plain `ell`/`cone` ops. Bake with `npx tsx tests/anim/bake-skins.ts`.
 */
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import { LEG_IK } from './constants';
import { cone, ell, Field, pair } from './sdf';
import type { Body, Op } from './sdf';
import type { V3 } from './sculpt';
import { decodeSkin, paintSkin } from './skin';
import type { PaintedSkin, RegionStyle } from './skin';

/** Where a bird's rig hangs from its body (left side; the right mirrors it), in the model frame. */
export interface Anchors {
  /** Scale: the bird's height over its reference height. */
  readonly s: number;
  readonly wing: V3;
  readonly hip: V3;
  readonly tail: V3;
  /** Hip height and leg thickness (they set the knee and the ankle). */
  readonly legLen: number;
  readonly legThick: number;
  readonly head: V3;
  readonly hr: number;
}

/** The thigh's length at the bind pose (sculpted.ts: hip to knee). */
export const thighLen = (a: Anchors): number => (a.legLen - a.legThick * LEG_IK.ankle) * LEG_IK.bend;

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
/** The right side's anchor from the left's. */
export const flipX = (v: V3): V3 => [-v[0], v[1], v[2]];
const at = (o: V3, s: number, p: V3): V3 => [o[0] + p[0] * s, o[1] + p[1] * s, o[2] + p[2] * s];

export interface HeadShape {
  /** Cranium semi-axes and offset, as shares of the head radius (floored to hold the hitbox sphere). */
  readonly skull?: V3;
  readonly skullAt?: V3;
  /** The face: the mass that narrows from the eyes to the bill base. */
  readonly face?: V3;
  readonly faceAt?: V3;
  readonly cheek?: V3;
  readonly cheekAt?: V3;
  /** Brow ridges over the eyes (a stern or a soft look) and their tilt (rad, + frowns). */
  readonly brow?: V3;
  readonly browAt?: V3;
  readonly browTilt?: number;
  readonly nape?: V3;
  readonly napeAt?: V3;
  readonly throat?: V3;
  readonly throatAt?: V3;
  /** Eye centre (left) and socket radius, shares of hr. */
  readonly eye: V3;
  readonly socket: number;
  /** Bill base: centre (shares), and half-width and half-height (shares). */
  readonly bill: V3;
  readonly billW: number;
  readonly billH: number;
}

/** The head's masses about its centre `c` with radius `hr`. Regions: crown, face, cheek, brow, nape, throat, bill, socket. */
export function head(c: V3, hr: number, h: HeadShape): Op[] {
  const skull = h.skull ?? [1.06, 1.08, 1.12];
  const floor = (r: V3): V3 => [Math.max(1.06, r[0]) * hr, Math.max(1.06, r[1]) * hr, Math.max(1.06, r[2]) * hr];
  return [
    ell(at(c, hr, h.skullAt ?? [0, 0.02, -0.04]), floor(skull), 'head', 'crown', { k: 0.2 * hr, boneSoft: 0.05 }),
    ell(at(c, hr, h.faceAt ?? [0, -0.12, 0.42]), mulS(h.face ?? [0.7, 0.62, 0.62], hr), 'head', 'face', { k: 0.08 * hr }),
    ...pair(ell(at(c, hr, h.cheekAt ?? [0.48, -0.32, 0.3]), mulS(h.cheek ?? [0.5, 0.48, 0.55], hr), 'head', 'cheek', { k: 0.12 * hr })),
    ...pair(ell(at(c, hr, h.browAt ?? [0.48, 0.42, 0.45]), mulS(h.brow ?? [0.5, 0.2, 0.42], hr), 'head', 'brow', { k: 0.1 * hr, rot: [-(h.browTilt ?? 0.25), 0.35, -0.25] })),
    ell(at(c, hr, h.napeAt ?? [0, -0.45, -0.55]), mulS(h.nape ?? [0.78, 0.7, 0.65], hr), 'head', 'nape', { k: 0.32 * hr, boneSoft: 0.06, soft: 0.025 }),
    ell(at(c, hr, h.throatAt ?? [0, -0.72, 0.2]), mulS(h.throat ?? [0.58, 0.45, 0.55], hr), 'head', 'throat', { k: 0.18 * hr }),
    cone(at(c, hr, [h.bill[0], h.bill[1], h.bill[2] - 0.45]), at(c, hr, h.bill), h.billH * 1.5 * hr, h.billH * hr, 'head', 'bill', { k: 0.12 * hr }),
    ell(at(c, hr, [h.bill[0], h.bill[1], h.bill[2] - 0.1]), [h.billW * hr, h.billH * hr, 0.16 * hr], 'head', 'bill', { k: 0.1 * hr }),
    ...pair(ell(at(c, hr, h.eye), [h.socket * hr, h.socket * hr, h.socket * hr], 'head', 'socket', { sub: true, k: 0.06 * hr, soft: 0.006 })),
  ];
}

const mulS = (v: V3, s: number): V3 => [v[0] * s, v[1] * s, v[2] * s];

/** A neck from the body into the head: capsules through `pts` (radii `r`), handing from the body bone to the head. */
export function neck(pts: readonly V3[], r: readonly number[], region = 'neck', split = 0.5): Op[] {
  const ops: Op[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const u = (i + 0.5) / (pts.length - 1);
    // Neck feathers point down the neck, toward the body.
    const down: V3 = [pts[i]![0] - pts[i + 1]![0], pts[i]![1] - pts[i + 1]![1], pts[i]![2] - pts[i + 1]![2]];
    ops.push(cone(pts[i]!, pts[i + 1]!, r[i]!, r[i + 1]!, u < split ? 'body' : 'head', region, { k: 0.04, boneSoft: 0.09, flow: down }));
  }
  return ops;
}

/**
 * Shoulders (left, mirrored): a scapular mass on the back edge, and a wing root growing from inside the body out to
 * the wing's pivot and a little down the arm, where the wing bone takes it over.
 */
export function shoulders(a: Anchors, o: { scapular: V3; scapularR: V3; root: number; inset?: number; drop?: number }): Op[] {
  const w = a.wing;
  const inner: V3 = [w[0] - (o.inset ?? 0.08) * a.s, w[1] + 0.01 * a.s, w[2]];
  return [
    ...pair(ell(o.scapular, o.scapularR, 'body', 'scapular', { k: 0.05 * a.s, rot: [0.1, 0.2, -0.25] })),
    ...pair(cone(inner, w, o.root * 1.1, o.root, 'body', 'shoulder', { k: 0.05 * a.s })),
    ...pair(cone(w, add(w, [0.01 * a.s, -(o.drop ?? 0.07) * a.s, -0.01 * a.s]), o.root, o.root * 0.82, 'wingL1', 'shoulder', { k: 0.04 * a.s, boneSoft: 0.03 })),
  ];
}

/** Feathered thighs (left, mirrored): from inside the belly down the thigh bone, where the leg takes them over. */
export function thighs(a: Anchors, o: { r: number; rKnee: number; reach?: number; root?: V3 }): Op[] {
  const hip = a.hip;
  const knee = add(hip, [0, -thighLen(a) * (o.reach ?? 0.55), 0]);
  const root = o.root ?? add(hip, [-0.02 * a.s, 0.08 * a.s, 0]);
  return [
    ...pair(cone(root, hip, o.r * 1.05, o.r, 'body', 'thigh', { k: 0.06 * a.s, boneSoft: 0.05, flow: [0, -1, 0.1] })),
    ...pair(cone(hip, knee, o.r, o.rKnee, 'legL1', 'thigh', { k: 0.05 * a.s, boneSoft: 0.04, flow: [0, -1, 0.1] })),
  ];
}

// =================================================================================================================
// Peacock: a pear-shaped body carried level, a deep rounded breast under a tall S-curved neck, a bronze-green mantle
// and scapulars over folded wings, the train springing from raised tail coverts, and a small head with a stern brow.

export function peacockAnchors(plan: BodyPlan): Anchors {
  const s = plan.height / 1.9;
  const R = plan.radius;
  const bodyY = 0.79 * s;
  return {
    s, wing: [R * 0.75, bodyY + 0.13 * s, 0.05 * s], hip: [R * 0.4, plan.height * 0.27, 0], tail: [0, bodyY + 0.03 * s, -0.4 * s],
    legLen: plan.height * 0.27, legThick: 0.027 * s,
    head: [-plan.head.centre.right, plan.head.centre.up, plan.head.centre.forward], hr: plan.head.radius,
  };
}

export function peacockBody(plan: BodyPlan): Body {
  const a = peacockAnchors(plan);
  const s = a.s;
  const y = 0.79 * s;
  const hc = a.head;
  return {
    tris: [2000, 800, 280, 120],
    ops: [
      // Trunk: carried level, deepest at the breast, tapering back to the tail coverts.
      ell([0, y, -0.06 * s], [0.24 * s, 0.21 * s, 0.36 * s], 'body', 'back', { rot: [-0.08, 0, 0], k: 0.05 }),
      // The breast: two pectoral masses either side of a keel ridge, under a broad neck base.
      ...pair(ell([0.08 * s, y + 0.01 * s, 0.15 * s], [0.15 * s, 0.22 * s, 0.17 * s], 'body', 'breast', { k: 0.07, rot: [-0.2, 0.25, 0] })),
      ell([0, y - 0.04 * s, 0.22 * s], [0.07 * s, 0.2 * s, 0.12 * s], 'body', 'breast', { k: 0.05, rot: [-0.3, 0, 0] }),
      ell([0, y - 0.13 * s, -0.04 * s], [0.17 * s, 0.13 * s, 0.24 * s], 'body', 'belly', { k: 0.08 }),
      // The back: a flat mantle between raised scapulars, falling to broad tail coverts that spread into the train.
      ell([0, y + 0.13 * s, -0.1 * s], [0.17 * s, 0.07 * s, 0.27 * s], 'body', 'mantle', { k: 0.06, rot: [-0.14, 0, 0] }),
      ell([0, y + 0.06 * s, -0.36 * s], [0.17 * s, 0.08 * s, 0.17 * s], 'tail', 'coverts', { k: 0.07, boneSoft: 0.06, rot: [0.2, 0, 0] }),
      ...shoulders(a, { scapular: [0.16 * s, y + 0.12 * s, -0.08 * s], scapularR: [0.09 * s, 0.07 * s, 0.24 * s], root: 0.065 * s }),
      ...thighs(a, { r: 0.075 * s, rKnee: 0.045 * s }),
      // The neck: broad off the breast, a gentle S up into the head, full under the nape.
      ...neck([[0, y + 0.02 * s, 0.13 * s], [0, y + 0.28 * s, 0.19 * s], [0, y + 0.52 * s, 0.14 * s], [0, hc[1] - 0.2 * s, 0.04 * s], [0, hc[1] - 0.06 * s, -0.03 * s]], [0.18 * s, 0.125 * s, 0.105 * s, 0.1 * s, 0.12 * s], 'neck', 0.6),
      // Hackles: the back of the upper neck swells into the nape, so the head flows down into the neck from behind.
      ell([0, hc[1] - 0.14 * s, -0.06 * s], [0.1 * s, 0.15 * s, 0.075 * s], 'head', 'nape', { k: 0.05, rot: [0.15, 0, 0], boneSoft: 0.08 }),
      ...head(hc, a.hr, PEACOCK_HEAD),
      // Markings: the white brow stripe and the white crescent under each eye.
      ...pair(ell(at(hc, a.hr, [0.6, 0.36, 0.42]), mulS([0.2, 0.07, 0.42], a.hr), 'head', 'stripe', { mark: true, rot: [0.25, 0.5, 0], soft: 0.004 })),
      ...pair(ell(at(hc, a.hr, [0.62, -0.2, 0.5]), mulS([0.2, 0.08, 0.3], a.hr), 'head', 'stripe', { mark: true, rot: [-0.2, 0.5, 0], soft: 0.004 })),
    ],
  };
}

/** The trunk's regions: the surface gear and body feathers are laid on (no neck, head or limbs in the way). */
export const TRUNK = ['back', 'breast', 'belly', 'mantle', 'scapular', 'coverts'] as const;

export const PEACOCK_HEAD: HeadShape = {
  skull: [1.06, 1.02, 1.16], skullAt: [0, 0.02, -0.08], nape: [0.82, 0.72, 0.62], napeAt: [0, -0.55, -0.42], eye: [0.74, 0.12, 0.5], socket: 0.27,
  bill: [0, -0.12, 0.98], billW: 0.27, billH: 0.22, browTilt: 0.35,
};

// =================================================================================================================
// Swift: a sleek forward-leaning torpedo, broad flat head with a deep scowling brow over big eyes, almost no neck, a
// tight mantle between high shoulders where the sickle wings spring, and a short tail base into the fork.

export function swiftAnchors(plan: BodyPlan): Anchors {
  const s = plan.height / 1.5;
  const R = plan.radius;
  return {
    s, wing: [R * 0.7, 1.0 * s, 0], hip: [R * 0.38, plan.height * 0.23, -0.05 * s], tail: [0, 0.4 * s, -0.22 * s],
    legLen: plan.height * 0.23, legThick: 0.02 * s,
    head: [-plan.head.centre.right, plan.head.centre.up, plan.head.centre.forward], hr: plan.head.radius,
  };
}

export function swiftBody(plan: BodyPlan): Body {
  const a = swiftAnchors(plan);
  const s = a.s;
  const hc = a.head;
  return {
    tris: [2650, 950, 270, 110],
    ops: [
      // A torpedo leaning forward: a broad, full chest high under the head, a narrow waist, tapering to the tail.
      ell([0, 0.74 * s, -0.07 * s], [0.17 * s, 0.37 * s, 0.15 * s], 'body', 'back', { rot: [0.42, 0, 0], k: 0.05 }),
      ...pair(ell([0.07 * s, 0.96 * s, 0.05 * s], [0.13 * s, 0.19 * s, 0.15 * s], 'body', 'breast', { k: 0.06, rot: [0.35, 0.2, 0] })),
      ell([0, 0.9 * s, 0.13 * s], [0.05 * s, 0.17 * s, 0.08 * s], 'body', 'breast', { k: 0.05, rot: [0.35, 0, 0] }),
      ell([0, 0.56 * s, -0.01 * s], [0.135 * s, 0.2 * s, 0.12 * s], 'body', 'belly', { k: 0.07, rot: [0.35, 0, 0] }),
      ell([0, 0.92 * s, -0.12 * s], [0.15 * s, 0.24 * s, 0.065 * s], 'body', 'mantle', { k: 0.06, rot: [0.45, 0, 0] }),
      cone([0, 0.5 * s, -0.15 * s], [0, 0.33 * s, -0.27 * s], 0.1 * s, 0.035 * s, 'tail', 'coverts', { k: 0.05, boneSoft: 0.05 }),
      ...shoulders(a, { scapular: [0.12 * s, 1.0 * s, -0.07 * s], scapularR: [0.08 * s, 0.13 * s, 0.07 * s], root: 0.055 * s, inset: 0.06 }),
      ...thighs(a, { r: 0.045 * s, rKnee: 0.026 * s, reach: 0.3, root: [0.06 * s, 0.43 * s, -0.03 * s] }),
      ...neck([[0, 1.04 * s, 0.01 * s], [0, 1.16 * s, 0.01 * s], [0, hc[1] - 0.06 * s, 0]], [0.14 * s, 0.13 * s, 0.12 * s], 'neck', 0.5),
      ...head(hc, a.hr, SWIFT_HEAD),
      // The pale throat patch, soft-edged under the gape.
      ell(at(hc, a.hr, [0, -0.88, 0.32]), mulS([0.55, 0.36, 0.5], a.hr), 'head', 'pale', { mark: true, soft: 0.016 }),
    ],
  };
}

export const SWIFT_HEAD: HeadShape = {
  skull: [1.22, 1.06, 1.1], skullAt: [0, 0, -0.06], face: [0.8, 0.55, 0.6], faceAt: [0, -0.15, 0.45],
  cheek: [0.55, 0.45, 0.5], cheekAt: [0.55, -0.3, 0.3], brow: [0.52, 0.2, 0.42], browAt: [0.55, 0.42, 0.64], browTilt: 0.5,
  eye: [0.66, 0.06, 0.68], socket: 0.33, bill: [0, -0.12, 1.0], billW: 0.32, billH: 0.14,
};

// =================================================================================================================
// Cassowary: a huge domed haystack rising to the shoulders and sloping to a drooping rump, a deep breast, heavy
// drumstick thighs, a long bare neck with a fold at its base and two wattles, and a narrow head under the casque.

export function cassowaryAnchors(plan: BodyPlan): Anchors {
  const s = plan.height / 2.4;
  const R = plan.radius;
  return {
    s, wing: [R * 0.8, 1.66 * s, 0.05 * s], hip: [R * 0.36, plan.height * 0.37, -0.02 * s], tail: [0, 1.26 * s, -0.56 * s],
    legLen: plan.height * 0.37, legThick: 0.05 * s,
    head: [-plan.head.centre.right, plan.head.centre.up, plan.head.centre.forward], hr: plan.head.radius,
  };
}

/**
 * The haystack's shag, sculpted: two tiers of hanging locks round the lower body, each tilted out from the body and
 * varied a little in size, so the silhouette is ragged hair, not an egg, before any hair blade is added.
 */
function shag(s: number): Op[] {
  const ops: Op[] = [];
  const tiers = [{ n: 18, y: 1.02, rx: 0.4, rz: 0.48, len: 0.22, w: 0.058, tilt: 0.3 }, { n: 14, y: 1.26, rx: 0.42, rz: 0.5, len: 0.16, w: 0.055, tilt: 0.45 }];
  tiers.forEach((t, tier) => {
    for (let i = 0; i < t.n; i++) {
      // Round the body from the front (φ = 0, +z), offset half a step per tier so the locks interleave.
      const phi = ((i + 0.5 * tier) / t.n) * Math.PI * 2;
      const j = 0.85 + 0.3 * (((i * 7 + tier * 3) % 5) / 4);
      const c: V3 = [Math.sin(phi) * t.rx * s, (t.y - t.len * 0.5) * s, (-0.1 + Math.cos(phi) * t.rz) * s];
      ops.push(ell(c, [t.w * s, t.len * j * s, t.w * 0.7 * s], 'body', 'shag', { k: 0.035, rot: [0, phi + Math.PI / 2, -t.tilt] }));
    }
  });
  return ops;
}

export function cassowaryBody(plan: BodyPlan): Body {
  const a = cassowaryAnchors(plan);
  const s = a.s;
  const hc = a.head;
  return {
    tris: [2500, 850, 280, 120], cell: 0.009,
    ops: [
      ...shag(s),
      // The dome: high over the shoulders, sloping back and down to the rump.
      ell([0, 1.34 * s, -0.1 * s], [0.42 * s, 0.4 * s, 0.5 * s], 'body', 'back', { rot: [0.12, 0, 0], k: 0.08 }),
      ell([0, 1.42 * s, 0.14 * s], [0.36 * s, 0.36 * s, 0.26 * s], 'body', 'breast', { k: 0.12 }),
      ell([0, 1.36 * s, 0.27 * s], [0.1 * s, 0.26 * s, 0.14 * s], 'body', 'breast', { k: 0.08, rot: [-0.2, 0, 0] }),
      ell([0, 1.12 * s, -0.08 * s], [0.32 * s, 0.2 * s, 0.36 * s], 'body', 'belly', { k: 0.1 }),
      ell([0, 1.6 * s, -0.12 * s], [0.34 * s, 0.14 * s, 0.38 * s], 'body', 'mantle', { k: 0.1, rot: [0.25, 0, 0] }),
      cone([0, 1.28 * s, -0.48 * s], [0, 1.12 * s, -0.68 * s], 0.24 * s, 0.12 * s, 'tail', 'coverts', { k: 0.1, boneSoft: 0.08 }),
      ...shoulders(a, { scapular: [0.26 * s, 1.62 * s, -0.04 * s], scapularR: [0.14 * s, 0.11 * s, 0.26 * s], root: 0.08 * s, inset: 0.1 }),
      ...thighs(a, { r: 0.14 * s, rKnee: 0.075 * s, reach: 0.62, root: [0.13 * s, 1.08 * s, -0.04 * s] }),
      // The bare neck, with a thick fold of skin at its base.
      ell([0, 1.66 * s, 0.17 * s], [0.17 * s, 0.1 * s, 0.15 * s], 'body', 'neckFold', { k: 0.06 }),
      ...neck([[0, 1.6 * s, 0.17 * s], [0, 1.86 * s, 0.14 * s], [0, 2.04 * s, 0.06 * s], [0, hc[1] - 0.06 * s, 0.01 * s]], [0.13 * s, 0.1 * s, 0.095 * s, 0.1 * s], 'neck', 0.55),
      // Folds of bare red skin down the back of the neck: the nape reads from the player camera as skin, not a tube.
      ...([[1.94, 0.03], [2.03, 0.0], [2.11, -0.045]] as const).map(([y, z], i) => ell([0, y * s, z * s], [0.085 * s, 0.018 * s, 0.05 * s], i === 0 ? 'body' : 'head', 'folds', { k: 0.018, rot: [-0.25, 0, 0], flow: [0, -1, 0] })),
      // Wattles: two lobes hanging from the front of the throat.
      ...pair(ell([0.045 * s, 1.84 * s, 0.24 * s], [0.03 * s, 0.075 * s, 0.035 * s], 'body', 'wattle', { k: 0.025, rot: [0.15, 0, 0.1] })),
      ...head(hc, a.hr, CASSOWARY_HEAD),
      // The casque: a tall, flattened horn helmet rising from the brow and sweeping back.
      ell(at(hc, a.hr, [0, 1.05, 0.1]), mulS([0.36, 0.72, 0.5], a.hr), 'head', 'casque', { k: 0.035, rot: [-0.4, 0, 0] }),
      ell(at(hc, a.hr, [0, 1.8, -0.3]), mulS([0.22, 0.62, 0.34], a.hr), 'head', 'casque', { k: 0.035, rot: [-0.7, 0, 0] }),
    ],
  };
}

export const CASSOWARY_HEAD: HeadShape = {
  skull: [1.06, 1.07, 1.12], face: [0.66, 0.66, 0.66], faceAt: [0, -0.1, 0.48], eye: [0.72, 0.12, 0.56], socket: 0.27,
  bill: [0, -0.12, 1.1], billW: 0.3, billH: 0.3, browTilt: 0.2,
};

/** The birds with implicit bodies, by hero id. */
export const BODIES = {
  peacock: peacockBody,
  swift: swiftBody,
  cassowary: cassowaryBody,
} as const satisfies Record<string, (plan: BodyPlan) => Body>;

/** A bird's baked skin at a level of detail, painted with its region styles. */
export function skinFor(id: keyof typeof BODIES, plan: BodyPlan, baked: string, level: number, style: Readonly<Record<string, RegionStyle>>): PaintedSkin {
  const levels = decodeSkin(baked);
  const l = levels[Math.min(level, levels.length - 1)];
  if (!l) throw new Error(`${id}: no baked skin`);
  return paintSkin(l, bodyField(id, plan).regions, style);
}

const fields = new Map<string, Field>();
/** A bird's body field at its plan (cached): the runtime probes it to seat eyes, bills, gear and feathers. */
export function bodyField(id: keyof typeof BODIES, plan: BodyPlan): Field {
  const key = `${id}:${JSON.stringify(plan)}`;
  let f = fields.get(key);
  if (!f) fields.set(key, (f = new Field(BODIES[id](plan))));
  return f;
}
