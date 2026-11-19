/**
 * Shared bits of every bird build: the part list a rig animates, plus eyes, legs, wings and guns. Each part's
 * geometry is authored around its own pivot (hip, shoulder, head centre, muzzle), so the rig only rotates it.
 */
import type { BufferGeometry } from 'three';
import { Vector3 } from 'three';
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import { PLUMAGE } from './constants';
import { Parts } from './parts';

export const PART_NAMES = ['body', 'head', 'wingL', 'wingR', 'legL', 'legR', 'tail', 'gun'] as const;
export type PartName = (typeof PART_NAMES)[number];

/** What a rig needs from a finished bird. */
export interface BirdBuild {
  readonly geo: Record<PartName, BufferGeometry>;
  /** Where each part's origin sits in the model frame (feet at the origin). */
  readonly pivot: Record<PartName, Vector3>;
  /** Roll amplitude while running (a sailor's gait is 0.12; most birds 0). */
  readonly sway: number;
  /** How far the tail lifts when casting (radians, negative lifts). */
  readonly castTail: number;
  /** Resting wing flare (radians): 0 tucked, more for a cloak. */
  readonly wingRest: number;
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

/** A leg hanging from the hip pivot: thigh, shin and a forward foot. */
export function leg(hex: number, len: number, thick: number, foot: number): Parts {
  return new Parts()
    .cyl(hex, thick, thick * 0.8, len, [0, -len / 2, 0])
    .box(hex, [foot * 0.6, thick * 1.2, foot], [0, -len + thick * 0.6, foot * 0.3]);
}

/**
 * A wing hanging from the shoulder pivot on side `s` (+1 the model's left, -1 its right): a flat ellipsoid `len`
 * long and `chord` deep, thin in x. Flaring the pivot about z swings the tip out to a horizontal span.
 */
export function wing(s: 1 | -1, hex: number, len: number, chord: number, thick: number, trim: number, trimAt = 0.72): Parts {
  // A flat cone hanging from the shoulder: wide at the top, pointed at the tip, swept back a little.
  const sweep = 0.12;
  const p = new Parts().cone(hex, 1, len, [s * thick, 0, 0], [Math.PI / 2 + sweep, 0, 0], 6, [thick, chord / 2, 1]);
  const w = (1 - trimAt) * chord * 0.5;
  p.ell(trim, [thick * 1.3, len * 0.06, w * 1.05], [s * thick, -len * trimAt, -len * trimAt * Math.sin(sweep) - w * 0.1], [sweep, 0, 0]);
  return p;
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
}

/** A gun with the muzzle tip at the pivot and the barrel running back along -z. */
export function gun(g: GunStyle): Parts {
  const metal = g.metal ?? PLUMAGE.gunMetal;
  const wood = g.wood ?? PLUMAGE.gunWood;
  const p = new Parts();
  p.box(metal, [g.thick, g.thick, g.length], [0, 0, -g.length / 2]);
  p.box(wood, [g.thick * 1.6, g.thick * 2.2, g.length * 0.3], [0, -g.thick * 0.9, -g.length * 0.78]);
  if (g.bell) p.cone(metal, g.bell, g.length * 0.25, [0, 0, 0], [0, Math.PI, 0]);
  if (g.thorns) for (let i = 0; i < 5; i++) p.cone(PLUMAGE.thorn, g.thick * 0.5, g.thick * 2, [0, g.thick * 0.5, -g.length * (0.15 + i * 0.16)], [-Math.PI / 2, 0, 0]);
  if (g.lute) p.ell(wood, [g.lute, g.lute * 0.5, g.lute * 1.1], [0, -g.thick * 0.5 - g.lute * 0.3, -g.length * 0.62]);
  return p;
}

/** Assemble a build. `world` is the model-frame position of each pivot. */
export function assemble(
  plan: BodyPlan,
  parts: Record<PartName, Parts>,
  pivot: Record<PartName, readonly [number, number, number]>,
  extra: Pick<BirdBuild, 'sway' | 'castTail' | 'wingRest'>,
): BirdBuild {
  const geo = {} as Record<PartName, BufferGeometry>;
  const at = {} as Record<PartName, Vector3>;
  for (const n of PART_NAMES) {
    geo[n] = parts[n].build();
    at[n] = new Vector3(pivot[n][0], pivot[n][1], pivot[n][2]);
  }
  // The head pivot is the hitbox centre by definition.
  at.head.set(-plan.head.centre.right, plan.head.centre.up, plan.head.centre.forward);
  at.gun.set(-plan.muzzle.right, plan.muzzle.up, plan.muzzle.forward);
  return { geo, pivot: at, ...extra };
}
