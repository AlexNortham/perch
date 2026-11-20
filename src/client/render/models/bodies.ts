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
      ell(at(hc, a.hr, [0, 1.8, -0.3]), mulS([0.26, 0.62, 0.36], a.hr), 'head', 'casque', { k: 0.035, rot: [-0.7, 0, 0] }),
      // Its keel runs on down the back of the skull, so from behind the head is a helmet, not a ball.
      ell(at(hc, a.hr, [0, 0.62, -0.86]), mulS([0.2, 0.7, 0.3], a.hr), 'head', 'casque', { k: 0.05, rot: [0.75, 0, 0] }),
    ],
  };
}

export const CASSOWARY_HEAD: HeadShape = {
  skull: [1.06, 1.07, 1.12], face: [0.66, 0.66, 0.66], faceAt: [0, -0.1, 0.48], eye: [0.72, 0.12, 0.56], socket: 0.27,
  bill: [0, -0.12, 1.1], billW: 0.3, billH: 0.3, browTilt: 0.2,
};

// =================================================================================================================
// Shrike: a compact upright songbird, a big flat-crowned "loggerhead" on a thick neck, a full white breast, a grey
// mantle between pale scapulars, and a black bandit mask from the hooked bill back through the eye.

export function shrikeAnchors(plan: BodyPlan): Anchors {
  const s = plan.height / 1.75;
  const R = plan.radius;
  return {
    s, wing: [R * 0.7, 1.13 * s, -0.03 * s], hip: [R * 0.36, plan.height * 0.22, -0.03 * s], tail: [0, 0.6 * s, -0.25 * s],
    legLen: plan.height * 0.22, legThick: 0.024 * s,
    head: [-plan.head.centre.right, plan.head.centre.up, plan.head.centre.forward], hr: plan.head.radius,
  };
}

export function shrikeBody(plan: BodyPlan): Body {
  const a = shrikeAnchors(plan);
  const s = a.s;
  const hc = a.head;
  return {
    tris: [2600, 950, 300, 120],
    ops: [
      // Upright and a little forward: a full breast high under the head, a waist over the thighs, the rump over the tail.
      ell([0, 0.9 * s, -0.07 * s], [0.2 * s, 0.36 * s, 0.17 * s], 'body', 'back', { rot: [0.22, 0, 0], k: 0.05 }),
      ...pair(ell([0.08 * s, 1.02 * s, 0.08 * s], [0.16 * s, 0.24 * s, 0.18 * s], 'body', 'breast', { k: 0.06, rot: [0.2, 0.22, 0] })),
      ell([0, 0.97 * s, 0.17 * s], [0.07 * s, 0.22 * s, 0.1 * s], 'body', 'breast', { k: 0.05, rot: [0.25, 0, 0] }),
      ell([0, 0.66 * s, 0.04 * s], [0.14 * s, 0.2 * s, 0.13 * s], 'body', 'belly', { k: 0.07, rot: [0.15, 0, 0] }),
      ell([0, 1.06 * s, -0.13 * s], [0.17 * s, 0.24 * s, 0.075 * s], 'body', 'mantle', { k: 0.06, rot: [0.3, 0, 0] }),
      cone([0, 0.66 * s, -0.17 * s], [0, 0.58 * s, -0.33 * s], 0.11 * s, 0.05 * s, 'tail', 'coverts', { k: 0.05, boneSoft: 0.05 }),
      ...shoulders(a, { scapular: [0.14 * s, 1.1 * s, -0.08 * s], scapularR: [0.09 * s, 0.16 * s, 0.08 * s], root: 0.065 * s, inset: 0.07 }),
      ...thighs(a, { r: 0.058 * s, rKnee: 0.032 * s, reach: 0.35, root: [0.07 * s, 0.52 * s, -0.02 * s] }),
      // A thick neck: the big head sits down on the shoulders.
      ...neck([[0, 1.18 * s, 0.0], [0, 1.32 * s, 0.0], [0, hc[1] - 0.08 * s, -0.01 * s]], [0.18 * s, 0.17 * s, 0.17 * s], 'neck', 0.5),
      ...head(hc, a.hr, SHRIKE_HEAD),
      // The bandit mask: a band from ear to ear through both eyes, meeting over the bill base, sharp-edged.
      ell(at(hc, a.hr, [0, 0.06, 0.22]), mulS([1.55, 0.25, 0.98], a.hr), 'head', 'mask', { mark: true, rot: [-0.18, 0, 0], soft: 0.004 }),
      ell(at(hc, a.hr, [0, -0.06, 0.98]), mulS([0.46, 0.22, 0.26], a.hr), 'head', 'mask', { mark: true, soft: 0.004 }),
      // The white throat, soft-edged under the mask.
      ell(at(hc, a.hr, [0, -0.78, 0.35]), mulS([0.62, 0.42, 0.55], a.hr), 'head', 'pale', { mark: true, soft: 0.02 }),
    ],
  };
}

export const SHRIKE_HEAD: HeadShape = {
  skull: [1.26, 1.08, 1.22], skullAt: [0, -0.02, -0.06], face: [0.76, 0.62, 0.62], faceAt: [0, -0.12, 0.46],
  brow: [0.5, 0.18, 0.44], browAt: [0.5, 0.4, 0.5], browTilt: 0.4, nape: [1.0, 0.8, 0.7], napeAt: [0, -0.45, -0.48],
  eye: [0.8, 0.1, 0.56], socket: 0.27, bill: [0, -0.1, 1.0], billW: 0.3, billH: 0.25,
};

// =================================================================================================================
// Kingfisher: a crouched, forward-leaning sprinter with a big long head on almost no neck, a compact chest, a bright
// back stripe down the mantle to the rump, and the face marked in bands: orange cheek, blue moustache, white neck
// patch, white throat.

export function kingfisherAnchors(plan: BodyPlan): Anchors {
  const s = plan.height / 1.6;
  const R = plan.radius;
  return {
    s, wing: [R * 0.72, 1.0 * s, -0.12 * s], hip: [R * 0.36, plan.height * 0.14, -0.1 * s], tail: [0, 0.46 * s, -0.48 * s],
    legLen: plan.height * 0.14, legThick: 0.022 * s,
    head: [-plan.head.centre.right, plan.head.centre.up, plan.head.centre.forward], hr: plan.head.radius,
  };
}

export function kingfisherBody(plan: BodyPlan): Body {
  const a = kingfisherAnchors(plan);
  const s = a.s;
  const hc = a.head;
  return {
    tris: [2600, 950, 300, 120],
    ops: [
      // Crouched and leaning well forward: the chest high and full under the head, the rump low and back over the tail.
      ell([0, 0.74 * s, -0.2 * s], [0.2 * s, 0.38 * s, 0.19 * s], 'body', 'back', { rot: [0.85, 0, 0], k: 0.05 }),
      ...pair(ell([0.09 * s, 0.94 * s, 0.0], [0.16 * s, 0.22 * s, 0.17 * s], 'body', 'breast', { k: 0.06, rot: [0.6, 0.2, 0] })),
      ell([0, 0.88 * s, 0.08 * s], [0.06 * s, 0.18 * s, 0.09 * s], 'body', 'breast', { k: 0.05, rot: [0.65, 0, 0] }),
      // One full curve of underside from the breast to a round belly low over the legs, hiding the thighs: only the
      // short red shanks show.
      ell([0, 0.66 * s, -0.04 * s], [0.19 * s, 0.21 * s, 0.18 * s], 'body', 'belly', { k: 0.08, rot: [0.6, 0, 0] }),
      ell([0, 0.46 * s, -0.12 * s], [0.18 * s, 0.2 * s, 0.18 * s], 'body', 'belly', { k: 0.08, rot: [0.6, 0, 0] }),
      ell([0, 0.9 * s, -0.27 * s], [0.17 * s, 0.26 * s, 0.07 * s], 'body', 'mantle', { k: 0.06, rot: [0.9, 0, 0] }),
      cone([0, 0.5 * s, -0.4 * s], [0, 0.42 * s, -0.54 * s], 0.1 * s, 0.045 * s, 'tail', 'coverts', { k: 0.05, boneSoft: 0.05 }),
      ...shoulders(a, { scapular: [0.13 * s, 1.0 * s, -0.16 * s], scapularR: [0.08 * s, 0.14 * s, 0.07 * s], root: 0.058 * s, inset: 0.06 }),
      ...thighs(a, { r: 0.046 * s, rKnee: 0.03 * s, reach: 0.2, root: [0.06 * s, 0.32 * s, -0.1 * s] }),
      // Almost no neck: the big head sits down into the shoulders.
      ...neck([[0, 1.02 * s, -0.06 * s], [0, 1.18 * s, -0.03 * s], [0, hc[1] - 0.07 * s, 0]], [0.15 * s, 0.15 * s, 0.14 * s], 'neck', 0.5),
      ...head(hc, a.hr, KINGFISHER_HEAD),
      // The bright back stripe, from the mantle down to the rump.
      ell([0, 0.78 * s, -0.37 * s], [0.06 * s, 0.44 * s, 0.1 * s], 'body', 'stripe', { mark: true, rot: [0.85, 0, 0], soft: 0.01 }),
      // Face bands: orange lores and ear patch, the blue moustache under it, a white patch on the side of the neck, a
      // white throat.
      ...pair(ell(at(hc, a.hr, [0.55, 0.04, 0.86]), mulS([0.2, 0.13, 0.2], a.hr), 'head', 'rufous', { mark: true, soft: 0.006 })),
      ...pair(ell(at(hc, a.hr, [0.92, -0.1, -0.12]), mulS([0.34, 0.2, 0.62], a.hr), 'head', 'rufous', { mark: true, rot: [0.25, 0, 0], soft: 0.006 })),
      ...pair(ell(at(hc, a.hr, [0.82, -0.46, 0.42]), mulS([0.3, 0.11, 0.55], a.hr), 'head', 'moustache', { mark: true, rot: [0.25, 0.35, 0], soft: 0.006 })),
      ...pair(ell(at(hc, a.hr, [0.85, -0.6, -0.5]), mulS([0.32, 0.3, 0.3], a.hr), 'head', 'pale', { mark: true, soft: 0.008 })),
      ell(at(hc, a.hr, [0, -0.8, 0.42]), mulS([0.52, 0.4, 0.5], a.hr), 'head', 'pale', { mark: true, soft: 0.012 }),
    ],
  };
}

export const KINGFISHER_HEAD: HeadShape = {
  skull: [1.22, 1.08, 1.28], skullAt: [0, 0.02, -0.08], face: [0.74, 0.58, 0.66], faceAt: [0, -0.08, 0.5],
  brow: [0.48, 0.18, 0.44], browAt: [0.5, 0.42, 0.52], browTilt: 0.35, nape: [0.82, 0.72, 0.66], napeAt: [0, -0.45, -0.52],
  eye: [0.84, 0.16, 0.56], socket: 0.26, bill: [0, -0.06, 1.08], billW: 0.3, billH: 0.26,
};

// =================================================================================================================
// Batch C (heroes' builders in birds-c.ts).
// Owl: an upright barrel with no neck to speak of, a broad flat-topped head carrying a facial disc of two concave
// dishes ringed by a raised ruff, a stern V brow, ear tufts, and fluffy feathered legs.

export function owlAnchors(plan: BodyPlan): Anchors {
  const s = plan.height / 1.7;
  const R = plan.radius;
  return {
    s, wing: [R * 0.8, 1.1 * s, 0.02 * s], hip: [R * 0.36, plan.height * 0.12, 0.02 * s], tail: [0, 0.5 * s, -0.3 * s],
    legLen: plan.height * 0.12, legThick: 0.03 * s,
    head: [-plan.head.centre.right, plan.head.centre.up, plan.head.centre.forward], hr: plan.head.radius,
  };
}

export const OWL_HEAD: HeadShape = {
  skull: [1.24, 1.06, 1.06], skullAt: [0, 0.06, -0.1], face: [0.98, 0.9, 0.42], faceAt: [0, -0.06, 0.5],
  cheek: [0.55, 0.5, 0.45], cheekAt: [0.6, -0.38, 0.28], brow: [0.42, 0.15, 0.34], browAt: [0.36, 0.36, 0.8], browTilt: 0.55,
  nape: [1.0, 0.75, 0.7], napeAt: [0, -0.45, -0.45], throat: [0.75, 0.45, 0.5], throatAt: [0, -0.78, 0.22],
  eye: [0.4, 0.06, 0.8], socket: 0.31, bill: [0, -0.26, 0.98], billW: 0.15, billH: 0.15,
};

export function owlBody(plan: BodyPlan): Body {
  const a = owlAnchors(plan);
  const s = a.s;
  const hc = a.head;
  const hr = a.hr;
  // The ruff: a raised rim round the facial disc, a ring of small masses (shares of hr about the head centre).
  const ruff: Op[] = [];
  for (let i = 0; i < 22; i++) {
    const th = (i / 22) * Math.PI * 2;
    // Open at the bottom where the disc gives way to the white throat bib.
    if (Math.abs(th - Math.PI) < 0.5) continue;
    const c: V3 = [Math.sin(th) * 1.0, -0.06 + Math.cos(th) * 0.86, 0.66 - 0.12 * Math.abs(Math.sin(th))];
    ruff.push(ell(at(hc, hr, c), mulS([0.16, 0.16, 0.14], hr), 'head', 'ruff', { k: 0.08 * hr, rot: [0, 0, th] }));
  }
  return {
    tris: [2150, 800, 225, 110],
    ops: [
      // The barrel: upright and round, broadest at the belly, with no waist.
      ell([0, 0.8 * s, -0.04 * s], [0.33 * s, 0.44 * s, 0.3 * s], 'body', 'back', { rot: [0.08, 0, 0], k: 0.05 }),
      ...pair(ell([0.1 * s, 0.88 * s, 0.11 * s], [0.2 * s, 0.3 * s, 0.19 * s], 'body', 'breast', { k: 0.07, rot: [-0.1, 0.25, 0] })),
      ell([0, 0.82 * s, 0.18 * s], [0.08 * s, 0.3 * s, 0.12 * s], 'body', 'breast', { k: 0.05 }),
      ell([0, 0.52 * s, 0.02 * s], [0.29 * s, 0.25 * s, 0.27 * s], 'body', 'belly', { k: 0.08 }),
      ell([0, 1.1 * s, -0.12 * s], [0.26 * s, 0.13 * s, 0.2 * s], 'body', 'mantle', { k: 0.06, rot: [-0.2, 0, 0] }),
      cone([0, 0.62 * s, -0.25 * s], [0, 0.46 * s, -0.34 * s], 0.12 * s, 0.07 * s, 'tail', 'coverts', { k: 0.06, boneSoft: 0.05 }),
      ...shoulders(a, { scapular: [0.2 * s, 1.08 * s, -0.08 * s], scapularR: [0.11 * s, 0.09 * s, 0.2 * s], root: 0.08 * s }),
      // Feathered legs: fluffy drumsticks right down to the feet.
      ...thighs(a, { r: 0.1 * s, rKnee: 0.07 * s, reach: 0.95, root: [0.12 * s, 0.34 * s, 0.02 * s] }),
      // No visible neck: a thick column the head sits straight onto.
      ...neck([[0, 1.08 * s, 0], [0, 1.22 * s, 0], [0, hc[1] - 0.12 * s, -0.01 * s]], [0.27 * s, 0.25 * s, 0.22 * s], 'neck', 0.5),
      ...head(hc, hr, OWL_HEAD),
      // The facial disc: two shallow dishes round the eyes, the ridge between them running down to the bill.
      ...pair(ell(at(hc, hr, [0.42, 0.04, 1.26]), mulS([0.5, 0.56, 0.42], hr), 'head', 'disc', { sub: true, k: 0.12 * hr, soft: 0.01 })),
      ...ruff,
      // Markings: the disc's paint fills the whole face inside the ruff, and a white bib under the bill.
      ell(at(hc, hr, [0, -0.08, 0.7]), mulS([0.98, 0.86, 0.6], hr), 'head', 'disc', { mark: true, soft: 0.006 }),
      ell(at(hc, hr, [0, -0.86, 0.6]), mulS([0.5, 0.26, 0.4], hr), 'head', 'bib', { mark: true, soft: 0.012 }),
      // Ear tufts: two upright horns of feathers off the top corners of the head.
      ...pair(cone(at(hc, hr, [0.5, 0.72, 0.0]), at(hc, hr, [0.78, 1.42, -0.18]), 0.22 * hr, 0.05 * hr, 'head', 'tuft', { k: 0.12 * hr, flow: [0.3, 1, -0.2] })),
    ],
  };
}

// =================================================================================================================
// Pelican: a bottom-heavy pear carried upright, a deep keel under a thick S-neck, a broad silver mantle, a small flat
// head with a shaggy nape crest and bare skin round the eye, and a wide bill base (the bill and pouch are lofts).

export function pelicanAnchors(plan: BodyPlan): Anchors {
  const s = plan.height / 2.1;
  const R = plan.radius;
  return {
    s, wing: [R * 0.75, 1.2 * s, 0.0], hip: [R * 0.36, plan.height * 0.12, 0.04 * s], tail: [0, 0.72 * s, -0.58 * s],
    legLen: plan.height * 0.12, legThick: 0.04 * s,
    head: [-plan.head.centre.right, plan.head.centre.up, plan.head.centre.forward], hr: plan.head.radius,
  };
}

export const PELICAN_HEAD: HeadShape = {
  skull: [1.06, 1.06, 1.18], skullAt: [0, 0.02, -0.12], face: [0.72, 0.62, 0.7], faceAt: [0, -0.1, 0.45],
  cheek: [0.5, 0.45, 0.55], cheekAt: [0.5, -0.32, 0.32], brow: [0.42, 0.16, 0.4], browAt: [0.5, 0.4, 0.42], browTilt: 0.3,
  nape: [0.8, 0.7, 0.66], napeAt: [0, -0.5, -0.45], throat: [0.62, 0.5, 0.6], throatAt: [0, -0.7, 0.3],
  eye: [0.62, 0.16, 0.5], socket: 0.24, bill: [0, -0.12, 1.0], billW: 0.36, billH: 0.24,
};

export function pelicanBody(plan: BodyPlan): Body {
  const a = pelicanAnchors(plan);
  const s = a.s;
  const hc = a.head;
  const hr = a.hr;
  return {
    tris: [2300, 820, 260, 100],
    ops: [
      // The pear: broadest low down, a heavy round belly, narrowing up to the shoulders.
      ell([0, 0.86 * s, -0.08 * s], [0.4 * s, 0.48 * s, 0.46 * s], 'body', 'back', { rot: [0.1, 0, 0], k: 0.06 }),
      ell([0, 0.62 * s, 0.06 * s], [0.44 * s, 0.34 * s, 0.44 * s], 'body', 'belly', { k: 0.1 }),
      ...pair(ell([0.12 * s, 1.0 * s, 0.22 * s], [0.24 * s, 0.3 * s, 0.22 * s], 'body', 'breast', { k: 0.08, rot: [-0.15, 0.25, 0] })),
      ell([0, 0.98 * s, 0.32 * s], [0.1 * s, 0.3 * s, 0.14 * s], 'body', 'breast', { k: 0.06, rot: [-0.2, 0, 0] }),
      ell([0, 1.2 * s, -0.14 * s], [0.3 * s, 0.14 * s, 0.32 * s], 'body', 'mantle', { k: 0.07, rot: [-0.2, 0, 0] }),
      cone([0, 0.84 * s, -0.48 * s], [0, 0.7 * s, -0.62 * s], 0.16 * s, 0.08 * s, 'tail', 'coverts', { k: 0.07, boneSoft: 0.06 }),
      ...shoulders(a, { scapular: [0.24 * s, 1.18 * s, -0.12 * s], scapularR: [0.14 * s, 0.1 * s, 0.28 * s], root: 0.1 * s, inset: 0.1 }),
      ...thighs(a, { r: 0.12 * s, rKnee: 0.08 * s, reach: 0.6, root: [0.16 * s, 0.46 * s, 0.02 * s] }),
      // A thick S-neck: forward off the breast, back under the head.
      ...neck([[0, 1.2 * s, 0.18 * s], [0, 1.42 * s, 0.25 * s], [0, 1.6 * s, 0.16 * s], [0, hc[1] - 0.1 * s, 0.02 * s]], [0.2 * s, 0.13 * s, 0.11 * s, 0.115 * s], 'neck', 0.6),
      ...head(hc, hr, PELICAN_HEAD),
      // The shaggy crest's root: a short ridge off the back of the crown (its plumes are blades).
      cone(at(hc, hr, [0, 0.5, -0.5]), at(hc, hr, [0, 0.1, -1.35]), 0.42 * hr, 0.18 * hr, 'head', 'crest', { k: 0.2 * hr, flow: [0, -0.3, -1] }),
      // Markings: bare peach skin round each eye to the bill, and the buff-yellow patch at the base of the neck.
      ...pair(ell(at(hc, hr, [0.62, 0.05, 0.68]), mulS([0.32, 0.36, 0.55], hr), 'head', 'facial', { mark: true, rot: [0, 0.4, 0], soft: 0.006 })),
      ell([0, 1.22 * s, 0.3 * s], [0.16 * s, 0.12 * s, 0.1 * s], 'body', 'patch', { mark: true, soft: 0.03 }),
    ],
  };
}

// =================================================================================================================
// Penguin: an upright skittle, broadest low at the belly, a deep keel, a thick neck into a smooth head, a sharp white
// bib marked on the front, gold ear patches and throat, and stubby legs under the belly.

export function penguinAnchors(plan: BodyPlan): Anchors {
  const s = plan.height / 1.6;
  const R = plan.radius;
  return {
    s, wing: [R * 0.74, 1.06 * s, 0.0], hip: [R * 0.36, plan.height * 0.08, 0.04 * s], tail: [0, 0.3 * s, -0.3 * s],
    legLen: plan.height * 0.08, legThick: 0.035 * s,
    head: [-plan.head.centre.right, plan.head.centre.up, plan.head.centre.forward], hr: plan.head.radius,
  };
}

export const PENGUIN_HEAD: HeadShape = {
  skull: [1.06, 1.06, 1.16], skullAt: [0, 0.02, -0.08], face: [0.68, 0.6, 0.62], faceAt: [0, -0.1, 0.45],
  cheek: [0.5, 0.48, 0.55], cheekAt: [0.5, -0.32, 0.3], brow: [0.44, 0.17, 0.4], browAt: [0.5, 0.4, 0.5], browTilt: 0.35,
  nape: [0.85, 0.72, 0.66], napeAt: [0, -0.5, -0.42], throat: [0.66, 0.5, 0.6], throatAt: [0, -0.72, 0.25],
  eye: [0.6, 0.18, 0.58], socket: 0.22, bill: [0, -0.1, 1.0], billW: 0.24, billH: 0.2,
};

export function penguinBody(plan: BodyPlan): Body {
  const a = penguinAnchors(plan);
  const s = a.s;
  const hc = a.head;
  const hr = a.hr;
  return {
    tris: [2300, 820, 260, 110],
    ops: [
      // The skittle: a tall egg, its belly low and full, tapering up through the shoulders into the neck.
      ell([0, 0.78 * s, -0.04 * s], [0.35 * s, 0.56 * s, 0.31 * s], 'body', 'back', { k: 0.06 }),
      ell([0, 0.48 * s, 0.04 * s], [0.38 * s, 0.32 * s, 0.36 * s], 'body', 'belly', { k: 0.1 }),
      ...pair(ell([0.1 * s, 0.9 * s, 0.13 * s], [0.21 * s, 0.32 * s, 0.2 * s], 'body', 'breast', { k: 0.08, rot: [-0.08, 0.25, 0] })),
      ell([0, 0.86 * s, 0.21 * s], [0.09 * s, 0.32 * s, 0.12 * s], 'body', 'breast', { k: 0.06 }),
      ell([0, 1.12 * s, -0.1 * s], [0.25 * s, 0.14 * s, 0.2 * s], 'body', 'mantle', { k: 0.07, rot: [-0.15, 0, 0] }),
      cone([0, 0.42 * s, -0.25 * s], [0, 0.26 * s, -0.33 * s], 0.12 * s, 0.06 * s, 'tail', 'coverts', { k: 0.06, boneSoft: 0.05 }),
      ...shoulders(a, { scapular: [0.18 * s, 1.07 * s, -0.06 * s], scapularR: [0.1 * s, 0.1 * s, 0.18 * s], root: 0.065 * s, inset: 0.08, drop: 0.05 }),
      ...thighs(a, { r: 0.09 * s, rKnee: 0.06 * s, reach: 0.5, root: [0.14 * s, 0.3 * s, 0.03 * s] }),
      // The head bone takes the neck from just above the shoulders, so the head owns the skin round its hitbox.
      ...neck([[0, 1.08 * s, 0.02 * s], [0, 1.18 * s, 0.03 * s], [0, 1.27 * s, 0.03 * s], [0, hc[1] - 0.1 * s, 0.02 * s]], [0.26 * s, 0.22 * s, 0.19 * s, 0.16 * s], 'neck', 0.4),
      ...head(hc, hr, PENGUIN_HEAD),
      // Markings: the sharp white bib down the front, the gold throat above it, and a gold ear patch behind each eye
      // that sweeps down the side of the neck.
      ell([0, 0.7 * s, 0.22 * s], [0.29 * s, 0.6 * s, 0.3 * s], 'body', 'bib', { mark: true, soft: 0.006 }),
      ell([0, 1.24 * s, 0.17 * s], [0.17 * s, 0.13 * s, 0.13 * s], 'body', 'gold', { mark: true, soft: 0.025 }),
      ...pair(ell(at(hc, hr, [0.82, -0.55, -0.25]), mulS([0.36, 0.75, 0.42], hr), 'head', 'ear', { mark: true, rot: [0.5, 0, 0.15], soft: 0.01 })),
    ],
  };
}

/** The birds with implicit bodies, by hero id. */
export const BODIES = {
  peacock: peacockBody,
  swift: swiftBody,
  cassowary: cassowaryBody,
  shrike: shrikeBody,
  kingfisher: kingfisherBody,
  owl: owlBody,
  pelican: pelicanBody,
  penguin: penguinBody,
  vulture: vultureBody,
  hummingbird: hummingbirdBody,
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

// =================================================================================================================
// Batch D (W7). Vulture: hunched. Broad sloping shoulders (the folded wings' wrists) flank a sunken neck, a cream
// ruff collars it, and the bald head hangs low and forward on a bare, folded neck; the body falls away behind and
// below to a dark breast, feathered trousers and a short tail.

export function vultureAnchors(plan: BodyPlan): Anchors {
  const s = plan.height / 2;
  const R = plan.radius;
  return {
    s, wing: [R * 0.62, 1.46 * s, -0.2 * s], hip: [R * 0.36, plan.height * 0.29, -0.1 * s], tail: [0, 0.98 * s, -0.56 * s],
    legLen: plan.height * 0.29, legThick: 0.034 * s,
    head: [-plan.head.centre.right, plan.head.centre.up, plan.head.centre.forward], hr: plan.head.radius,
  };
}

/** The ruff: a collar of down puffs round the base of the neck, interleaved in two tiers. */
function ruff(c: V3, r: number, s: number): Op[] {
  const ops: Op[] = [ell(c, [r * 1.05, 0.07 * s, r * 1.05], 'body', 'ruff', { k: 0.03 })];
  for (let tier = 0; tier < 2; tier++) {
    const n = 11;
    for (let i = 0; i < n; i++) {
      const phi = ((i + 0.5 * tier) / n) * Math.PI * 2;
      const j = 0.85 + 0.3 * (((i * 5 + tier * 3) % 7) / 6);
      const rr = r * (tier ? 0.82 : 1);
      const p: V3 = [c[0] + Math.sin(phi) * rr, c[1] + (tier ? 0.06 : -0.01) * s, c[2] + Math.cos(phi) * rr];
      ops.push(ell(p, [0.07 * s * j, 0.06 * s, 0.07 * s * j], 'body', 'ruff', { k: 0.03, flow: [Math.sin(phi), -0.8, Math.cos(phi)] }));
    }
  }
  return ops;
}

export function vultureBody(plan: BodyPlan): Body {
  const a = vultureAnchors(plan);
  const s = a.s;
  const hc = a.head;
  return {
    tris: [2600, 880, 300, 120], cell: 0.009,
    ops: [
      // The hunched trunk: carried upright, its top rolled forward over the breast.
      ell([0, 1.16 * s, -0.24 * s], [0.32 * s, 0.4 * s, 0.32 * s], 'body', 'back', { rot: [0.32, 0, 0], k: 0.06 }),
      ...pair(ell([0.1 * s, 1.18 * s, 0.0], [0.17 * s, 0.24 * s, 0.17 * s], 'body', 'breast', { k: 0.07, rot: [-0.1, 0.25, 0] })),
      ell([0, 1.08 * s, 0.1 * s], [0.07 * s, 0.22 * s, 0.1 * s], 'body', 'breast', { k: 0.05, rot: [-0.25, 0, 0] }),
      ell([0, 0.86 * s, -0.16 * s], [0.25 * s, 0.2 * s, 0.27 * s], 'body', 'belly', { k: 0.08 }),
      // The hunched back: a broad mantle sloping up to the shoulders, below the neck so the head shows over it.
      ell([0, 1.3 * s, -0.36 * s], [0.27 * s, 0.15 * s, 0.26 * s], 'body', 'mantle', { k: 0.07, rot: [0.6, 0, 0] }),
      cone([0, 1.0 * s, -0.46 * s], [0, 0.9 * s, -0.64 * s], 0.17 * s, 0.08 * s, 'tail', 'coverts', { k: 0.07, boneSoft: 0.06 }),
      // Broad sloping shoulders: the folded wings' wrists, wide and flat like a coat's padding, not balls.
      ...shoulders(a, { scapular: [0.22 * s, 1.4 * s, -0.27 * s], scapularR: [0.15 * s, 0.09 * s, 0.22 * s], root: 0.085 * s, inset: 0.08 }),
      ...thighs(a, { r: 0.1 * s, rKnee: 0.06 * s, reach: 0.55 }),
      ...ruff([0, 1.48 * s, -0.13 * s], 0.18 * s, s),
      // The bare neck rising forward out of the ruff, with folds of skin down its back.
      ...neck([[0, 1.38 * s, -0.15 * s], [0, 1.5 * s, -0.12 * s], [0, 1.58 * s, -0.07 * s], [0, hc[1] - 0.06 * s, -0.02 * s]], [0.085 * s, 0.07 * s, 0.064 * s, 0.07 * s], 'neck', 0.5),
      ...([[1.52, -0.135], [1.57, -0.105], [1.62, -0.075]] as const).map(([y, z], i) => ell([0, y * s, z * s], [0.068 * s, 0.015 * s, 0.05 * s], i === 0 ? 'body' : 'head', 'folds', { k: 0.014, rot: [-0.5, 0, 0], flow: [0, -1, 0] })),
      ...head(hc, a.hr, VULTURE_HEAD),
      // Caruncles: fleshy lumps across the crown and down the back of the skull, so the bald head is never a ball.
      ...([[0, 1.0, 0.15, 0.16], [0.2, 0.92, -0.12, 0.18], [-0.2, 0.92, -0.12, 0.18], [0, 0.86, -0.42, 0.2], [0, 0.55, -0.8, 0.19]] as const).map(([x, y, z, r]) => ell(at(hc, a.hr, [x, y, z]), mulS([r, r * 0.8, r], a.hr), 'head', 'caruncle', { k: 0.05 * a.hr })),
      // Wrinkles: thick folds of skin across the back of the skull, so the player camera sees creased hide, not a ball.
      ...([[0.5, -0.9, -0.45, 0.62], [0.1, -1.04, -0.1, 0.78], [-0.32, -0.98, 0.35, 0.7]] as const).map(([y, z, tilt, w]) => ell(at(hc, a.hr, [0, y, z]), mulS([w, 0.075, 0.2], a.hr), 'head', 'folds', { k: 0.09 * a.hr, rot: [tilt, 0, 0], flow: [0, -1, 0] })),
      // A dark mask round each eye.
      ...pair(ell(at(hc, a.hr, [0.66, 0.22, 0.5]), mulS([0.24, 0.2, 0.26], a.hr), 'head', 'mask', { mark: true, soft: 0.008 })),
    ],
  };
}

export const VULTURE_HEAD: HeadShape = {
  skull: [1.06, 1.0, 1.1], skullAt: [0, 0, -0.04], face: [0.7, 0.66, 0.66], faceAt: [0, -0.1, 0.46],
  brow: [0.52, 0.22, 0.44], browAt: [0.48, 0.46, 0.5], browTilt: 0.45,
  nape: [0.7, 0.66, 0.6], napeAt: [0, -0.5, -0.46], throat: [0.55, 0.5, 0.55], throatAt: [0, -0.75, 0.15],
  eye: [0.72, 0.2, 0.56], socket: 0.26, bill: [0, -0.06, 1.08], billW: 0.34, billH: 0.3,
};

// =================================================================================================================
// Batch D (W7). Hummingbird: the smallest hero, an iridescent drop. A deep flight-muscle breast under a ruby gorget,
// a short neck into a big round head with large eyes and a crest at the back of the crown, the body tapering to the
// tail; tiny feathered legs.

export function hummingbirdAnchors(plan: BodyPlan): Anchors {
  const s = plan.height / 1.3;
  const R = plan.radius;
  return {
    s, wing: [R * 0.62, 0.86 * s, -0.04 * s], hip: [R * 0.32, plan.height * 0.13, -0.02 * s], tail: [0, 0.24 * s, -0.12 * s],
    legLen: plan.height * 0.13, legThick: 0.016 * s,
    head: [-plan.head.centre.right, plan.head.centre.up, plan.head.centre.forward], hr: plan.head.radius,
  };
}

export function hummingbirdBody(plan: BodyPlan): Body {
  const a = hummingbirdAnchors(plan);
  const s = a.s;
  const hc = a.head;
  return {
    tris: [2300, 850, 280, 110], cell: 0.007,
    ops: [
      // The drop: deepest at the breast (the flight muscles), tapering down and back to the tail.
      ell([0, 0.6 * s, -0.05 * s], [0.19 * s, 0.34 * s, 0.18 * s], 'body', 'back', { rot: [0.12, 0, 0], k: 0.05 }),
      ...pair(ell([0.07 * s, 0.76 * s, 0.06 * s], [0.13 * s, 0.19 * s, 0.13 * s], 'body', 'breast', { k: 0.06, rot: [-0.15, 0.25, 0] })),
      ell([0, 0.7 * s, 0.12 * s], [0.05 * s, 0.17 * s, 0.08 * s], 'body', 'breast', { k: 0.04, rot: [-0.2, 0, 0] }),
      ell([0, 0.4 * s, -0.03 * s], [0.14 * s, 0.17 * s, 0.14 * s], 'body', 'belly', { k: 0.06 }),
      ell([0, 0.8 * s, -0.11 * s], [0.14 * s, 0.17 * s, 0.07 * s], 'body', 'mantle', { k: 0.05, rot: [0.2, 0, 0] }),
      cone([0, 0.32 * s, -0.1 * s], [0, 0.2 * s, -0.16 * s], 0.09 * s, 0.04 * s, 'tail', 'coverts', { k: 0.04, boneSoft: 0.04 }),
      ...shoulders(a, { scapular: [0.1 * s, 0.84 * s, -0.08 * s], scapularR: [0.07 * s, 0.1 * s, 0.07 * s], root: 0.045 * s, inset: 0.05, drop: 0.05 }),
      ...thighs(a, { r: 0.045 * s, rKnee: 0.03 * s, reach: 0.45, root: [0.05 * s, 0.24 * s, -0.02 * s] }),
      ...neck([[0, 0.9 * s, 0.0], [0, 0.98 * s, 0.0], [0, hc[1] - 0.06 * s, 0]], [0.13 * s, 0.115 * s, 0.1 * s], 'neck', 0.5),
      ...head(hc, a.hr, HUMMINGBIRD_HEAD),
      // The crest: a short swept fan of crown feathers lifting off the back of the skull.
      ell(at(hc, a.hr, [0, 0.82, -0.62]), mulS([0.34, 0.2, 0.48], a.hr), 'head', 'crest', { k: 0.08 * a.hr, rot: [0.55, 0, 0], flow: [0, 0.3, -1] }),
      // Markings: the ruby gorget over the throat and upper breast, and a white spot behind each eye.
      ell([0, 0.98 * s, 0.1 * s], [0.14 * s, 0.13 * s, 0.11 * s], 'body', 'gorget', { mark: true, soft: 0.01 }),
      ...pair(ell(at(hc, a.hr, [0.66, 0.22, -0.12]), mulS([0.14, 0.1, 0.14], a.hr), 'head', 'spot', { mark: true, soft: 0.004 })),
    ],
  };
}

export const HUMMINGBIRD_HEAD: HeadShape = {
  skull: [1.12, 1.08, 1.1], skullAt: [0, 0.02, -0.04], face: [0.62, 0.55, 0.6], faceAt: [0, -0.1, 0.48],
  brow: [0.46, 0.16, 0.38], browAt: [0.5, 0.42, 0.52], browTilt: 0.2,
  throat: [0.55, 0.45, 0.55], throatAt: [0, -0.7, 0.25],
  eye: [0.66, 0.14, 0.62], socket: 0.3, bill: [0, -0.1, 1.0], billW: 0.14, billH: 0.12,
};
