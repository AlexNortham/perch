/**
 * Primitive-building helpers: faceted shapes with a baked vertex colour, merged into one BufferGeometry per rig part
 * so a whole hero costs a handful of draw calls. Axes are the model's own: +z forward, +y up, +x the model's left
 * (a hero's `right` offset is -x). Cones point down +z, so a bill is `cone(…)` with no rotation.
 */
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type V3 = readonly [number, number, number];
const ZERO: V3 = [0, 0, 0];
const SPHERE_W = 8;
const SPHERE_H = 6;
const CYL_SIDES = 5;

const matrix = new Matrix4();
const quat = new Quaternion();
const euler = new Euler();
const scale = new Vector3();
const pos = new Vector3();
const colour = new Color();
const UP = new Vector3(0, 1, 0);
const dir = new Vector3();

/** Triangle count of a geometry. */
export function triangles(g: BufferGeometry): number {
  return (g.index ? g.index.count : (g.getAttribute('position')?.count ?? 0)) / 3;
}

export class Parts {
  private readonly list: BufferGeometry[] = [];

  private push(g: BufferGeometry, hex: number, at: V3, rot: V3, size: V3): this {
    g.deleteAttribute('uv');
    euler.set(rot[0], rot[1], rot[2]);
    quat.setFromEuler(euler);
    matrix.compose(pos.set(at[0], at[1], at[2]), quat, scale.set(size[0], size[1], size[2]));
    g.applyMatrix4(matrix);
    colour.setHex(hex);
    const n = g.getAttribute('position').count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      c[i * 3] = colour.r;
      c[i * 3 + 1] = colour.g;
      c[i * 3 + 2] = colour.b;
    }
    g.setAttribute('color', new Float32BufferAttribute(c, 3));
    this.list.push(g);
    return this;
  }

  /** Ellipsoid with semi-axes (rx, ry, rz) centred at `at`. */
  ell(hex: number, r: V3, at: V3 = ZERO, rot: V3 = ZERO, seg: readonly [number, number] = [SPHERE_W, SPHERE_H]): this {
    return this.push(new SphereGeometry(1, seg[0], seg[1]), hex, at, rot, r);
  }

  box(hex: number, size: V3, at: V3 = ZERO, rot: V3 = ZERO): this {
    return this.push(new BoxGeometry(1, 1, 1), hex, at, rot, size);
  }

  /** Cone with its base at `at` and its apex `length` away along +z (before `rot`). */
  cone(hex: number, radius: number, length: number, at: V3 = ZERO, rot: V3 = ZERO, sides = CYL_SIDES): this {
    const g = new ConeGeometry(radius, length, sides);
    g.translate(0, length / 2, 0);
    g.rotateX(Math.PI / 2);
    return this.push(g, hex, at, rot, [1, 1, 1]);
  }

  /** Vertical cylinder centred at `at`. */
  cyl(hex: number, rTop: number, rBottom: number, height: number, at: V3 = ZERO, rot: V3 = ZERO): this {
    return this.push(new CylinderGeometry(rTop, rBottom, height, CYL_SIDES), hex, at, rot, [1, 1, 1]);
  }

  /** A thin cylinder from a to b. */
  rod(hex: number, a: V3, b: V3, radius: number): this {
    dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length();
    const g = new CylinderGeometry(radius, radius, len, 4);
    g.applyQuaternion(quat.setFromUnitVectors(UP, dir.normalize()));
    return this.push(g, hex, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], ZERO, [1, 1, 1]);
  }

  build(): BufferGeometry {
    const merged = this.list.length > 0 ? mergeGeometries(this.list) : null;
    for (const g of this.list) g.dispose();
    const out = merged ?? new BufferGeometry();
    out.computeBoundingSphere();
    return out;
  }
}
