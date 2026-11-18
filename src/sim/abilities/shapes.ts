/**
 * Area shapes (AreaEffect.shape) resolved to numbers, and the membership test. An entity is a point at its feet
 * (`pos`) with its broad-phase `radius` as horizontal slack:
 * - sphere: 3D distance from the centre.
 * - cylinder, ring, box: vertically centred on the area centre (height/2 above and below).
 * - cone: apex at the centre, opening along the horizontal forward; reaches CONE_HALF_HEIGHT up and down.
 * - box: width across, length along the forward, both centred on the centre.
 * - ring: the band between inner and outer; onCross fires when an entity changes side of the mid radius.
 * A shape whose main size resolves to 0 or less is empty, so an upgrade can switch an area on by raising a value
 * that is 0 at base.
 */
import { CONE_HALF_HEIGHT, RAD_PER_DEG } from '../data/abilities';
import type { AreaShape, Magnitude, Vec3 } from '../core/contracts';

export type ResolvedShape =
  | { readonly kind: 'sphere'; readonly radius: number }
  | { readonly kind: 'cylinder'; readonly radius: number; readonly half: number }
  | { readonly kind: 'cone'; readonly length: number; readonly cosHalf: number }
  | { readonly kind: 'ring'; readonly inner: number; readonly outer: number; readonly half: number }
  | { readonly kind: 'box'; readonly halfX: number; readonly half: number; readonly halfZ: number };

export function resolveShape(s: AreaShape, mag: (m: Magnitude) => number): ResolvedShape {
  switch (s.kind) {
    case 'sphere':
      return { kind: 'sphere', radius: mag(s.radius) };
    case 'cylinder':
      return { kind: 'cylinder', radius: mag(s.radius), half: s.height / 2 };
    case 'cone':
      return { kind: 'cone', length: mag(s.length), cosHalf: Math.cos((s.angleDeg / 2) * RAD_PER_DEG) };
    case 'ring':
      return { kind: 'ring', inner: mag(s.inner), outer: mag(s.outer), half: s.height / 2 };
    case 'box':
      return { kind: 'box', halfX: s.size.x / 2, half: s.size.y / 2, halfZ: s.size.z / 2 };
  }
}

/** True when the shape can't contain anything. */
export function isEmpty(s: ResolvedShape): boolean {
  switch (s.kind) {
    case 'sphere':
    case 'cylinder':
      return s.radius <= 0;
    case 'cone':
      return s.length <= 0;
    case 'ring':
      return s.outer <= 0 || s.outer < s.inner;
    case 'box':
      return s.halfX <= 0 || s.halfZ <= 0;
  }
}

/** Radius of a sphere around the centre that holds the whole shape (spatial query and AreaEntity.radius). */
export function boundRadius(s: ResolvedShape): number {
  switch (s.kind) {
    case 'sphere':
      return s.radius;
    case 'cylinder':
      return Math.hypot(s.radius, s.half);
    case 'cone':
      return Math.hypot(s.length, CONE_HALF_HEIGHT);
    case 'ring':
      return Math.hypot(s.outer, s.half);
    case 'box':
      return Math.hypot(s.halfX, s.half, s.halfZ);
  }
}

/**
 * Is a body at `p` with horizontal radius `r` inside the shape at `c`? (fx, fz) is the unit horizontal forward.
 */
export function inside(s: ResolvedShape, c: Vec3, fx: number, fz: number, p: Vec3, r: number): boolean {
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  const dz = p.z - c.z;
  switch (s.kind) {
    case 'sphere': {
      const reach = s.radius + r;
      return dx * dx + dy * dy + dz * dz <= reach * reach;
    }
    case 'cylinder': {
      const reach = s.radius + r;
      return Math.abs(dy) <= s.half && dx * dx + dz * dz <= reach * reach;
    }
    case 'ring': {
      if (Math.abs(dy) > s.half) return false;
      const d = Math.hypot(dx, dz);
      return d >= s.inner - r && d <= s.outer + r;
    }
    case 'cone': {
      if (Math.abs(dy) > CONE_HALF_HEIGHT) return false;
      const d = Math.hypot(dx, dz);
      if (d > s.length + r) return false;
      return d <= r || dx * fx + dz * fz >= d * s.cosHalf;
    }
    case 'box': {
      const along = dx * fx + dz * fz;
      const side = dz * fx - dx * fz;
      return Math.abs(dy) <= s.half && Math.abs(along) <= s.halfZ + r && Math.abs(side) <= s.halfX + r;
    }
  }
}

/**
 * For onCross. Rings: which side of the mid radius `p` is on (true = inside), or null above or below the ring.
 * Other shapes: whether it is inside, so crossing the edge is entering or leaving.
 */
export function sideOf(s: ResolvedShape, c: Vec3, fx: number, fz: number, p: Vec3, r: number): boolean | null {
  if (s.kind !== 'ring') return inside(s, c, fx, fz, p, r);
  if (Math.abs(p.y - c.y) > s.half) return null;
  return Math.hypot(p.x - c.x, p.z - c.z) < (s.inner + s.outer) / 2;
}
