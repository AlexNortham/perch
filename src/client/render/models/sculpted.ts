/* eslint-disable @typescript-eslint/no-magic-numbers -- the style guide's level-of-detail table: the numbers are the budgets */
/**
 * Assembly for sculpted birds (style guide §8, §11.3; D-ART-004). A sculpted bird is a function of its BodyPlan, its
 * flock colours and a level of detail; it is built once per level, and every level is skinned to the same bones,
 * whose bind positions come from the plan and never from the level. Each level is two geometries: the opaque solid
 * (body, gear, gun) and the cut-out feather cards. Sizes are read from the plan at runtime, so the head stays on its
 * hitbox and the muzzle on the sim's muzzle point.
 */
import { Euler, Quaternion, Vector3 } from 'three';
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import type { TeamColours } from '../palette';
import { BONE_NAMES, BONE_PARENT } from './bird';
import type { BirdBuild, BoneName, CastKind } from './bird';
import { HOLD, LEG_IK } from './constants';
import { bake, Sculpt } from './sculpt';
import type { V3 } from './sculpt';
import type { PaintedSkin } from './skin';

/** Style guide §11.3: where each level starts (m from the camera) and its triangle budget, gun included. */
export const BIRD_LOD = {
  from: [0, 15, 40, 80],
  budget: [9000, 3500, 1200, 400],
  /** Share of each switch distance used as hysteresis (style guide §11.4). */
  hysteresis: 0.1,
  /** Segment and card multipliers per level. */
  segments: [0.85, 0.52, 0.33, 0.18],
  cards: [1, 0.5, 0.25, 0.1],
} as const;
export type Level = 0 | 1 | 2 | 3;

/** What a builder needs to scale its detail to a level. */
export interface Detail {
  readonly level: Level;
  /** A segment count scaled to the level, never below `min`. */
  n(base: number, min?: number): number;
  /** How many of `count` repeated cards to keep at this level, never below `min`. */
  keep(count: number, min?: number): number;
  /** Rows along a feather at this level (5 near, 2 far). */
  readonly rows: number;
}

export function detail(level: Level): Detail {
  return {
    level,
    n: (base, min = 3) => Math.max(min, Math.round(base * BIRD_LOD.segments[level])),
    keep: (count, min = 1) => Math.min(count, Math.max(min, Math.round(count * BIRD_LOD.cards[level]))),
    rows: level === 0 ? 4 : level === 1 ? 3 : 2,
  };
}

/** The gun, built around its sockets: muzzle tip at the gun bone's origin, barrel along -z. */
export interface SculptedGun {
  build(k: Sculpt, part: 'gun' | 'slide' | 'spin'): void;
  /** Main (trigger) grip in the gun frame, support grip in the slide frame, the slide's and spinner's place on the gun. */
  readonly main: V3;
  readonly support: V3;
  readonly slideAt: V3;
  readonly travel: number;
  readonly spinAt?: V3;
}

export interface SculptedSpec {
  /** Parts in their bones' frames: body in the model frame, head about the head hitbox centre, tail about its pivot. */
  body(k: Sculpt): void;
  head(k: Sculpt): void;
  tail(k: Sculpt): void;
  /** Anything orbiting the head on the halo bone (about the head hitbox centre; the Starling's flock). */
  halo?(k: Sculpt): void;
  /** A wing segment along -y: the arm (shoulder → joint) or the hand (joint → grip). `side` +1 left, -1 right. */
  wing(k: Sculpt, seg: 'arm' | 'hand', side: 1 | -1, upper: number, lower: number): void;
  /** A leg segment along -y (thigh hip → knee, shin knee → ankle), or the foot (ankle at the origin, sole below). */
  leg(k: Sculpt, seg: 'thigh' | 'shin' | 'foot', side: 1 | -1, upper: number, lower: number, ankle: number): void;
  readonly gun: SculptedGun;
  readonly pivot: { readonly wingL: V3; readonly wingR: V3; readonly legL: V3; readonly legR: V3; readonly tail: V3 };
  /** Hip height, and the leg's thickness (sets the ankle height). */
  readonly legLen: number;
  readonly legThick: number;
  /** Folded wing length from the shoulder (lengthened if the grips need more reach). */
  readonly wingLen: number;
  readonly casts: readonly [CastKind, CastKind, CastKind, CastKind];
  readonly sway: number;
  readonly castTail: number;
  readonly castWiden?: number;
  readonly idleLeg?: number;
  readonly toe?: number;
  readonly cant?: number;
  /** Spinner turn rate while firing (rad/s). */
  readonly spinRate?: number;
  /** The implicit body's skin at this level, painted (D-ART-008): breast, back, shoulders, thighs, neck and head. */
  readonly skin?: PaintedSkin;
}

export type SculptedBird = (plan: BodyPlan, team: TeamColours, d: Detail) => SculptedSpec;

/** Each bone's bind position: in its parent bone's frame, else in the model frame (feet at the origin). */
function bindAt(plan: BodyPlan, s: SculptedSpec, upper: number, legSeg: number, muzzle: Vector3): Record<BoneName, Vector3> {
  const headAt = new Vector3(-plan.head.centre.right, plan.head.centre.up, plan.head.centre.forward);
  return {
    body: new Vector3(),
    head: headAt.clone(),
    tail: v(s.pivot.tail),
    halo: headAt.clone(),
    wingL1: v(s.pivot.wingL), wingL2: new Vector3(0, -upper, 0),
    wingR1: v(s.pivot.wingR), wingR2: new Vector3(0, -upper, 0),
    legL1: v(s.pivot.legL), legL2: new Vector3(0, -legSeg, 0), footL: new Vector3(0, -legSeg, 0),
    legR1: v(s.pivot.legR), legR2: new Vector3(0, -legSeg, 0), footR: new Vector3(0, -legSeg, 0),
    gun: muzzle.clone(), slide: v(s.gun.slideAt), spin: v(s.gun.spinAt ?? [0, 0, 0]),
  };
}

/** A bone's rest position in the model frame: its bind position plus its parents'. */
export function restOf(at: Readonly<Record<BoneName, Vector3>>, n: BoneName): V3 {
  const p = at[n].clone();
  for (let b = BONE_PARENT[n]; b; b = BONE_PARENT[b]) p.add(at[b]);
  return [p.x, p.y, p.z];
}

const v = (a: V3): Vector3 => new Vector3(a[0], a[1], a[2]);

/** Build every level of a sculpted bird and skin each to the shared bones. */
export function sculptedBuild(plan: BodyPlan, team: TeamColours, bird: SculptedBird): BirdBuild {
  const levels = ([0, 1, 2, 3] as const).map((level) => {
    const s = bird(plan, team, detail(level));
    const toe = s.toe ?? HOLD.toe;
    const cant = s.cant ?? 0;
    const g = s.gun;
    const muzzle = new Vector3(-plan.muzzle.right, plan.muzzle.up, plan.muzzle.forward);
    const q = new Quaternion().setFromEuler(new Euler(0, toe, cant, 'YXZ'));
    const mainAt = v(g.main).applyQuaternion(q).add(muzzle);
    const supportAt = v(g.slideAt).add(v(g.support)).applyQuaternion(q).add(muzzle);
    const reach = Math.max(mainAt.distanceTo(v(s.pivot.wingR)), supportAt.distanceTo(v(s.pivot.wingL)));
    const wingLen = Math.max(s.wingLen, reach * HOLD.reach);
    const upper = wingLen * HOLD.upperShare;
    const lower = wingLen - upper;
    const ankle = s.legThick * LEG_IK.ankle;
    const legSeg = (s.legLen - ankle) * LEG_IK.bend;
    const parts = {} as Record<BoneName, Sculpt>;
    for (const name of BONE_NAMES) parts[name] = new Sculpt();
    s.body(parts.body);
    s.head(parts.head);
    s.tail(parts.tail);
    s.halo?.(parts.halo);
    s.wing(parts.wingL1, 'arm', 1, upper, lower);
    s.wing(parts.wingL2, 'hand', 1, upper, lower);
    s.wing(parts.wingR1, 'arm', -1, upper, lower);
    s.wing(parts.wingR2, 'hand', -1, upper, lower);
    for (const [side, a, b, f] of [[1, 'legL1', 'legL2', 'footL'], [-1, 'legR1', 'legR2', 'footR']] as const) {
      s.leg(parts[a], 'thigh', side, legSeg, legSeg, ankle);
      s.leg(parts[b], 'shin', side, legSeg, legSeg, ankle);
      s.leg(parts[f], 'foot', side, legSeg, legSeg, ankle);
    }
    g.build(parts.gun, 'gun');
    g.build(parts.slide, 'slide');
    g.build(parts.spin, 'spin');
    const order = BONE_NAMES.map((n) => parts[n]);
    const at = bindAt(plan, s, upper, legSeg, muzzle);
    // Everything in the model frame at the bind pose, so the skin's blended weights and the rigid parts share bind
    // matrices (D-ART-008).
    const rest = BONE_NAMES.map((n) => restOf(at, n));
    const solid = bake(order, 'solid', { rest, ...(s.skin && { skin: s.skin }) });
    const cards = bake(order, 'cards', { rest });
    return { s, solid, cards, upper, lower, ankle, legSeg, toe, cant, at };
  });
  const top = levels[0];
  if (!top) throw new Error('sculpted bird: no levels');
  const { s, upper, lower, ankle, legSeg, toe, cant, solid, cards, at } = top;
  const ranges = {} as Record<BoneName, readonly [number, number]>;
  BONE_NAMES.forEach((n, i) => (ranges[n] = solid.ranges[i] ?? [0, 0]));
  const hasCards = (g: { geo: { getAttribute(n: string): { count: number } | undefined } }): boolean => (g.geo.getAttribute('position')?.count ?? 0) > 0;
  return {
    geo: solid.geo,
    ...(hasCards(cards) && { cards: cards.geo }),
    lods: levels.slice(1).map((l, i) => ({ geo: l.solid.geo, cards: hasCards(l.cards) ? l.cards.geo : null, from: BIRD_LOD.from[i + 1] ?? 0 })),
    sculpted: true,
    modelSpace: true,
    at,
    ranges,
    wing: { upper, lower },
    leg: { upper: legSeg, lower: legSeg, ankle },
    grip: { main: v(s.gun.main), support: v(s.gun.support) },
    slideTravel: s.gun.travel,
    hold: { toe, cant },
    casts: s.casts,
    sway: s.sway,
    castTail: s.castTail,
    ...(s.castWiden !== undefined && { castWiden: s.castWiden }),
    ...(s.idleLeg !== undefined && { idleLeg: s.idleLeg }),
    ...(s.spinRate !== undefined && { spinRate: s.spinRate }),
  };
}
