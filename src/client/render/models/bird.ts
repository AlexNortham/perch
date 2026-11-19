/* eslint-disable @typescript-eslint/no-magic-numbers -- authored proportions and sample poses: the numbers are the data */
/**
 * Shared bits of every bird build. A bird is ONE skinned mesh (one draw call) over a small skeleton: body, head,
 * tail, two-segment wings ending in a hand, two-segment legs with a foot, and the gun with its sliding fore-end.
 * Weights are rigid (each vertex follows one bone), so every part is authored around its own pivot exactly as a
 * separate mesh would be, and the rig only moves bones (D-ART-003).
 *
 * The gun is built around its sockets: the muzzle tip at the gun bone's origin with the barrel along -z, a main grip
 * (trigger wing) on the gun and a support grip on the fore-end. The rig puts the muzzle where the sim fires from
 * and solves both wings onto the grips.
 */
import type { BufferGeometry } from 'three';
import { Float32BufferAttribute, Quaternion, Euler, Uint16BufferAttribute, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import { HOLD, LEG_IK, PLUMAGE } from './constants';
import { Parts } from './parts';

type V3 = readonly [number, number, number];
/** Sphere segments for limb parts: low, and tiny for joints and trim bands. */
const LOW = [6, 4] as const;
const TINY = [5, 3] as const;

export const BONE_NAMES = [
  'body', 'head', 'tail', 'halo',
  'wingL1', 'wingL2', 'wingR1', 'wingR2',
  'legL1', 'legL2', 'footL', 'legR1', 'legR2', 'footR',
  'gun', 'slide',
] as const;
export type BoneName = (typeof BONE_NAMES)[number];

/** Chained bones; every other bone hangs from the rig's body frame. */
export const BONE_PARENT: Readonly<Partial<Record<BoneName, BoneName>>> = {
  wingL2: 'wingL1', wingR2: 'wingR1', legL2: 'legL1', footL: 'legL2', legR2: 'legR1', footR: 'legR2', slide: 'gun',
};

/** What a cast looks like (per ability slot, from the kit): see CAST_POSE in constants.ts. */
export type CastKind = 'raise' | 'throw' | 'sweep' | 'stomp' | 'leap' | 'aim';

/** What a rig needs from a finished bird. */
export interface BirdBuild {
  /** Every part merged, with `skinIndex` = the part's index in BONE_NAMES and weight 1. */
  readonly geo: BufferGeometry;
  /** Bind position of each bone: in its parent bone's frame, else in the model frame (feet at the origin). */
  readonly at: Record<BoneName, Vector3>;
  /** Each bone's vertices in `geo` as [first, count]. */
  readonly ranges: Record<BoneName, readonly [number, number]>;
  /** Wing segment lengths: shoulder to wrist, wrist to the hand at the wingtip. */
  readonly wing: { readonly upper: number; readonly lower: number };
  /** Leg segment lengths (hip to knee, knee to ankle) and the ankle's height above the sole. */
  readonly leg: { readonly upper: number; readonly lower: number; readonly ankle: number };
  /** Grip sockets: `main` in the gun bone's frame, `support` in the slide bone's frame. */
  readonly grip: { readonly main: Vector3; readonly support: Vector3 };
  /** How far the fore-end racks back on a reload (m). */
  readonly slideTravel: number;
  /** Hold style: barrel turned in toward the centre line (rad, about up) and canted (rad, about the barrel). */
  readonly hold: { readonly toe: number; readonly cant: number };
  /** Cast pose per ability slot 1 to 4. */
  readonly casts: readonly [CastKind, CastKind, CastKind, CastKind];
  /** Roll amplitude while running (a sailor's gait is 0.12; most birds 0). */
  readonly sway: number;
  /** How far the tail lifts when casting (radians, negative lifts). */
  readonly castTail: number;
  /** Flamingo: how far the right leg lifts when standing still (0 none, 1 fully). */
  readonly idleLeg?: number;
}

export interface Dims {
  readonly H: number;
  readonly R: number;
  /** Head centre height and radius. */
  readonly hc: number;
  readonly hr: number;
  /** Top of the body capsule: head centre − head radius. */
  readonly top: number;
}

export function dims(p: BodyPlan): Dims {
  return { H: p.height, R: p.radius, hc: p.head.centre.up, hr: p.head.radius, top: p.head.centre.up - p.head.radius };
}

/** Head ellipsoid, a touch larger than the hitbox sphere on every axis so the hitbox sits inside it. */
export function headShell(parts: Parts, hex: number, hr: number): Parts {
  return parts.ell(hex, [hr * 1.05, hr * 1.05, hr * 1.12]);
}

export function eyes(parts: Parts, hr: number, y = 0.15, z = 0.62): Parts {
  for (const s of [1, -1]) {
    parts.ell(PLUMAGE.eye, [hr * 0.2, hr * 0.2, hr * 0.2], [s * hr * 0.68, hr * y, hr * z], [0, 0, 0], [6, 4]);
    parts.ell(PLUMAGE.eyeGlint, [hr * 0.07, hr * 0.07, hr * 0.07], [s * hr * 0.76, hr * (y + 0.08), hr * (z + 0.12)], [0, 0, 0], [4, 2]);
  }
  return parts;
}

/** Legs: `len` is the hip height (pivot y); `thigh` dresses the upper segment (breeches, feathered thighs). */
export interface LegStyle {
  readonly hex: number;
  readonly len: number;
  readonly thick: number;
  readonly foot: number;
  readonly thigh?: number;
  readonly thighThick?: number;
}

/** Wings: `len` is the folded wing's length from the shoulder; the build lengthens it if the grips need more reach. */
export interface WingStyle {
  readonly hex: number;
  readonly len: number;
  readonly chord: number;
  readonly thick: number;
  readonly trim: number;
}

export interface GunStyle {
  readonly length: number;
  readonly thick: number;
  readonly metal?: number;
  readonly wood?: number;
  /** Blunderbuss bell at the muzzle: its radius. */
  readonly bell?: number;
  /** A row of thorns along the barrel. */
  readonly thorns?: boolean;
  /** A lute body under the barrel: its radius. */
  readonly lute?: number;
  /** Barrels side by side (a gatling cluster, a pistol pair): total count. */
  readonly barrels?: number;
  /** A scope on top. */
  readonly scope?: boolean;
  /** Main (trigger) grip and fore-end distance behind the muzzle, as fractions of `length`. */
  readonly main?: number;
  readonly support?: number;
}

/** Leg segments in their own bone frames: thigh and shin hang along -y, the foot points +z with the sole below. */
function legParts(l: LegStyle, upper: number, lower: number, ankle: number): { legA: Parts; legB: Parts; foot: Parts } {
  const t = l.thick;
  const tt = l.thighThick ?? t * 1.5;
  const legA = new Parts().ell(l.thigh ?? l.hex, [tt, upper * 0.6, tt], [0, -upper * 0.5, 0], [0, 0, 0], LOW);
  // The shin is a touch thicker at the knee, so the joint reads without a ball.
  const legB = new Parts().cyl(l.hex, t * 1.05, t * 0.75, lower, [0, -lower / 2, 0]);
  const foot = new Parts()
    .box(l.hex, [l.foot * 0.25, ankle, l.foot * 0.85], [0, -ankle / 2, l.foot * 0.25])
    .box(l.hex, [l.foot * 0.2, ankle * 0.8, l.foot * 0.55], [l.foot * 0.2, -ankle * 0.6, l.foot * 0.22], [0, 0.45, 0])
    .box(l.hex, [l.foot * 0.2, ankle * 0.8, l.foot * 0.55], [-l.foot * 0.2, -ankle * 0.6, l.foot * 0.22], [0, -0.45, 0]);
  return { legA, legB, foot };
}

/**
 * Wing segments along -y, flat in the plane the wing folds in: the arm tapering from the shoulder, then the forearm
 * ending in a feathered hand that closes on a grip, with the primaries swept back from the hand past the wrist, as
 * a folded wing's are.
 */
function wingParts(w: WingStyle, upper: number, lower: number): { a: Parts; b: Parts } {
  const half = w.chord * 0.2;
  const a = new Parts().cone(w.hex, 1, upper * 1.08, [0, 0, 0], [Math.PI / 2, 0, 0], 6, [w.thick * 1.2, half * 1.1, 1]);
  const b = new Parts()
    .ell(w.hex, [w.thick, lower * 0.55, half * 0.75], [0, -lower * 0.48, 0], [0, 0, 0], TINY)
    .ell(w.trim, [w.thick * 1.15, lower * 0.07, half * 0.8], [0, -lower * 0.66, 0], [0, 0, 0], TINY)
    // The hand round the grip.
    .ell(w.hex, [w.thick * 2, w.thick * 2, w.thick * 2.2], [0, -lower, 0], [0, 0, 0], TINY)
    // Primaries: from the hand back along the forearm and on past the wrist, fanned a little to the outside of the
    // fold (the IK keeps -z on the side the wrist bends toward).
    .cone(w.hex, 1, (upper + lower) * 0.62, [0, -lower * 0.92, -half * 0.5], [-Math.PI / 2 - 0.12, 0, 0], 4, [w.thick * 0.7, half * 0.9, 1])
    .cone(w.trim, 1, (upper + lower) * 0.5, [0, -lower * 0.9, -half * 0.9], [-Math.PI / 2 - 0.28, 0, 0], 4, [w.thick * 0.6, half * 0.6, 1]);
  return { a, b };
}

interface GunParts {
  readonly gun: Parts;
  readonly slide: Parts;
  readonly slideAt: V3;
  readonly main: V3;
  readonly support: V3;
  readonly travel: number;
}

/** A gun with the muzzle tip at the pivot and the barrel running back along -z, built around its two grips. */
export function gun(g: GunStyle): GunParts {
  const metal = g.metal ?? PLUMAGE.gunMetal;
  const wood = g.wood ?? PLUMAGE.gunWood;
  const L = g.length;
  const t = g.thick;
  const main = L * (g.main ?? 0.55);
  const fore = L * (g.support ?? 0.24);
  const p = new Parts();
  const n = g.barrels ?? 1;
  const barrelLen = L - main * 0.25;
  for (let i = 0; i < n; i++) p.box(metal, [t, t, barrelLen], [(i - (n - 1) / 2) * t * 1.5, 0, -barrelLen / 2]);
  const width = Math.max(t * 1.6, n * t * 1.5);
  // Receiver over the grip, a pistol grip, and a stock running back to the butt.
  p.box(metal, [width, t * 1.8, L * 0.22], [0, -t * 0.4, -main + L * 0.04]);
  p.box(wood, [t * 0.9, t * 2.4, t * 1.1], [0, -t * 1.6, -main - t * 0.2], [-0.3, 0, 0]);
  const stock = L - main - t * 0.6;
  if (stock > t) p.box(wood, [t * 1.3, t * 1.8, stock], [0, -t * 0.9, -main - t * 0.6 - stock / 2], [0.12, 0, 0]);
  if (g.scope) p.cyl(metal, t * 0.55, t * 0.55, L * 0.3, [0, t * 1.4, -main + L * 0.08], [Math.PI / 2, 0, 0]);
  if (g.bell) p.cone(metal, g.bell, L * 0.25, [0, 0, 0], [0, Math.PI, 0]);
  if (g.thorns) for (let i = 0; i < 5; i++) p.cone(PLUMAGE.thorn, t * 0.5, t * 2, [0, t * 0.5, -L * (0.06 + i * 0.1)], [-Math.PI / 2, 0, 0]);
  if (g.lute) p.ell(wood, [g.lute, g.lute * 0.5, g.lute * 1.1], [0, -t * 0.4 - g.lute * 0.3, -main - g.lute * 0.6]);
  // The fore-end slides back to reload; the support wing rides it.
  const slide = new Parts().box(wood, [width * 1.1, t * 1.3, L * 0.16], [0, 0, 0]);
  return { gun: p, slide, slideAt: [0, -t * 1.1, -fore], main: [0, -t * 2.1, -main - t * 0.35], support: [0, -t * 0.75, 0], travel: L * 0.1 };
}

/** The pieces of a bird before assembly. Pivots are model-frame positions (feet at the origin, +x the bird's left). */
export interface BirdSpec {
  readonly body: Parts;
  readonly head: Parts;
  readonly tail: Parts;
  readonly halo?: Parts;
  readonly wing: WingStyle;
  readonly leg: LegStyle;
  readonly gun: GunStyle;
  readonly pivot: { readonly wingL: V3; readonly wingR: V3; readonly legL: V3; readonly legR: V3; readonly tail: V3 };
  readonly casts: BirdBuild['casts'];
  readonly sway: number;
  readonly castTail: number;
  readonly idleLeg?: number;
  readonly toe?: number;
  readonly cant?: number;
}

const v = (a: V3): Vector3 => new Vector3(a[0], a[1], a[2]);

/** Assemble a build: one skinned geometry, the bone layout, and wing lengths that can reach the grips. */
export function assemble(plan: BodyPlan, s: BirdSpec): BirdBuild {
  const toe = s.toe ?? HOLD.toe;
  const cant = s.cant ?? 0;
  const g = gun(s.gun);
  const muzzle = new Vector3(-plan.muzzle.right, plan.muzzle.up, plan.muzzle.forward);
  const q = new Quaternion().setFromEuler(new Euler(0, toe, cant, 'YXZ'));
  const mainAt = v(g.main).applyQuaternion(q).add(muzzle);
  const supportAt = v(g.slideAt).add(v(g.support)).applyQuaternion(q).add(muzzle);
  // The main grip is the right (trigger) wing's, the fore-end the left wing's.
  const reach = Math.max(mainAt.distanceTo(v(s.pivot.wingR)), supportAt.distanceTo(v(s.pivot.wingL)));
  const wingLen = Math.max(s.wing.len, reach * HOLD.reach);
  const upper = wingLen * HOLD.upperShare;
  const lower = wingLen - upper;
  const ankle = s.leg.thick * LEG_IK.ankle;
  const legSeg = (s.leg.len - ankle) * LEG_IK.bend;
  // Each side gets its own Parts: building one consumes it.
  const [wl, wr] = [wingParts(s.wing, upper, lower), wingParts(s.wing, upper, lower)];
  const [ll, lr] = [legParts(s.leg, legSeg, legSeg, ankle), legParts(s.leg, legSeg, legSeg, ankle)];
  const parts: Record<BoneName, Parts | undefined> = {
    body: s.body, head: s.head, tail: s.tail, halo: s.halo,
    wingL1: wl.a, wingL2: wl.b, wingR1: wr.a, wingR2: wr.b,
    legL1: ll.legA, legL2: ll.legB, footL: ll.foot, legR1: lr.legA, legR2: lr.legB, footR: lr.foot,
    gun: g.gun, slide: g.slide,
  };
  const at: Record<BoneName, Vector3> = {
    body: new Vector3(),
    head: new Vector3(-plan.head.centre.right, plan.head.centre.up, plan.head.centre.forward),
    tail: v(s.pivot.tail),
    halo: new Vector3(-plan.head.centre.right, plan.head.centre.up, plan.head.centre.forward),
    wingL1: v(s.pivot.wingL), wingL2: new Vector3(0, -upper, 0),
    wingR1: v(s.pivot.wingR), wingR2: new Vector3(0, -upper, 0),
    legL1: v(s.pivot.legL), legL2: new Vector3(0, -legSeg, 0), footL: new Vector3(0, -legSeg, 0),
    legR1: v(s.pivot.legR), legR2: new Vector3(0, -legSeg, 0), footR: new Vector3(0, -legSeg, 0),
    gun: muzzle, slide: v(g.slideAt),
  };
  const geos: BufferGeometry[] = [];
  const index: number[] = [];
  const ranges = {} as Record<BoneName, readonly [number, number]>;
  let first = 0;
  BONE_NAMES.forEach((name, i) => {
    const p = parts[name];
    const geo = p?.build();
    const count = geo?.getAttribute('position')?.count ?? 0;
    ranges[name] = [first, count];
    if (!geo || count === 0) return;
    geos.push(geo);
    for (let k = 0; k < count; k++) index.push(i);
    first += count;
  });
  const geo = mergeGeometries(geos);
  for (const g2 of geos) g2.dispose();
  if (!geo) throw new Error('bird: empty build');
  const skinIndex = new Uint16Array(first * 4);
  const skinWeight = new Float32Array(first * 4);
  index.forEach((b, k) => {
    skinIndex[k * 4] = b;
    skinWeight[k * 4] = 1;
  });
  geo.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new Float32BufferAttribute(skinWeight, 4));
  return {
    geo, at, ranges,
    wing: { upper, lower },
    leg: { upper: legSeg, lower: legSeg, ankle },
    grip: { main: v(g.main), support: v(g.support) },
    slideTravel: g.travel,
    hold: { toe, cant },
    casts: s.casts,
    sway: s.sway,
    castTail: s.castTail,
    ...(s.idleLeg !== undefined && { idleLeg: s.idleLeg }),
  };
}
