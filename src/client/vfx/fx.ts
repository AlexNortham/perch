/**
 * The VFX drawing layer: one InstancedMesh per shape (five draw calls however busy the fight), written in immediate
 * mode every frame, plus a fixed ring of short-lived effect records. Nothing here allocates after construction.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  RingGeometry,
  Vector3,
} from 'three';
import type { BufferGeometry, Group } from 'three';
import type { Vec3 } from '../../sim/core/contracts';
import { BURSTS, CAPACITY, FX_DRAW, TRANSIENT_CAPACITY } from './constants';
import type { Part, Shape } from './constants';

const RING_INNER = 0.82;
const RING_SEGMENTS = 20;
const ROUND_SEGMENTS = 10;
const RNG_MUL = 1664525;
const RNG_ADD = 1013904223;
const RNG_RANGE = 4294967296;

/** Unit shapes, centred on the origin. Cones point along +z with the apex at the origin and the base at z = 1. */
function geometry(shape: Shape): BufferGeometry {
  switch (shape) {
    case 'box':
      return new BoxGeometry(1, 1, 1);
    case 'sphere':
      return new IcosahedronGeometry(1, 1);
    case 'cylinder':
      return new CylinderGeometry(1, 1, 1, ROUND_SEGMENTS, 1, false);
    case 'cone': {
      const g = new ConeGeometry(1, 1, ROUND_SEGMENTS, 1, true);
      g.rotateX(Math.PI / 2);
      g.translate(0, 0, FX_DRAW.coneBaseShift);
      return g;
    }
    case 'ring': {
      // Flat in the xz plane, facing +y, outer radius 1.
      const g = new RingGeometry(RING_INNER, 1, RING_SEGMENTS);
      g.rotateX(-Math.PI / 2);
      return g;
    }
  }
}

/** One instanced mesh: `push` this frame's instances between `reset` and `commit`. Full means dropped, not grown. */
export class Instances {
  readonly mesh: InstancedMesh;
  n = 0;
  private readonly capacity: number;
  private readonly m = new Matrix4();
  private readonly p = new Vector3();
  private readonly s = new Vector3();

  constructor(shape: Shape, material: MeshBasicMaterial) {
    this.capacity = CAPACITY[shape];
    this.mesh = new InstancedMesh(geometry(shape), material, this.capacity);
    this.mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(this.capacity * FX_DRAW.colourComponents), FX_DRAW.colourComponents);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.count = 0;
  }

  reset(): void {
    this.n = 0;
  }

  push(q: Quaternion, x: number, y: number, z: number, sx: number, sy: number, sz: number, r: number, g: number, b: number): void {
    if (this.n >= this.capacity) return;
    this.m.compose(this.p.set(x, y, z), q, this.s.set(sx, sy, sz));
    this.mesh.setMatrixAt(this.n, this.m);
    const c = this.mesh.instanceColor;
    if (c) c.setXYZ(this.n, r, g, b);
    this.n++;
  }

  commit(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export interface Draw {
  readonly layers: Readonly<Record<Shape, Instances>>;
  readonly root: Group;
  readonly material: MeshBasicMaterial;
}

const Z = new Vector3(0, 0, 1);
const Y = new Vector3(0, 1, 0);
const axisV = new Vector3();
const IDENTITY = new Quaternion();
const scratchColour = new Color();

/** Linear RGB of an sRGB hex, written into `out`. */
export function rgb(hex: number, out: { r: number; g: number; b: number }): void {
  scratchColour.setHex(hex);
  out.r = scratchColour.r;
  out.g = scratchColour.g;
  out.b = scratchColour.b;
}

/** A shared additive material: effects only ever add light, so fading is darkening and nothing needs alpha. */
export function createMaterial(): MeshBasicMaterial {
  return new MeshBasicMaterial({ blending: AdditiveBlending, transparent: true, depthWrite: false, fog: false, toneMapped: false });
}

/** Quaternion turning +z onto the unit vector (dx, dy, dz). */
export function faceZ(q: Quaternion, dx: number, dy: number, dz: number): Quaternion {
  return q.setFromUnitVectors(Z, axisV.set(dx, dy, dz));
}
/** Quaternion turning +y onto the unit vector (dx, dy, dz) (rings lie flat about it). */
export function faceY(q: Quaternion, dx: number, dy: number, dz: number): Quaternion {
  return q.setFromUnitVectors(Y, axisV.set(dx, dy, dz));
}
export const identity = (): Quaternion => IDENTITY;

/** A short-lived effect. `ax,ay,az` is the box direction or ring normal; `len` is the box length. */
interface Rec {
  live: boolean;
  shape: 'box' | 'sphere' | 'ring';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ax: number;
  ay: number;
  az: number;
  s0: number;
  s1: number;
  len: number;
  r: number;
  g: number;
  b: number;
  age: number;
  life: number;
  gravity: number;
}

export class Transients {
  readonly recs: Rec[] = [];
  private next = 0;
  private seed: number = FX_DRAW.seed;
  private readonly q = new Quaternion();
  private readonly c = { r: 0, g: 0, b: 0 };

  constructor() {
    for (let i = 0; i < TRANSIENT_CAPACITY; i++) {
      this.recs.push({ live: false, shape: 'sphere', x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, ax: 0, ay: 1, az: 0, s0: 0, s1: 0, len: 0, r: 0, g: 0, b: 0, age: 0, life: 1, gravity: 0 });
    }
  }

  /** Deterministic jitter in [0, 1): visuals only, and the same every run so screenshots repeat. */
  rand(): number {
    this.seed = (Math.imul(this.seed, RNG_MUL) + RNG_ADD) >>> 0;
    return this.seed / RNG_RANGE;
  }

  /** Drop every live effect (new session). */
  clear(): void {
    for (const r of this.recs) r.live = false;
  }

  get liveCount(): number {
    let n = 0;
    for (const r of this.recs) if (r.live) n++;
    return n;
  }

  /** The next record, overwriting the oldest slot when the ring is full. */
  private take(): Rec {
    const r = this.recs[this.next];
    this.next = (this.next + 1) % TRANSIENT_CAPACITY;
    if (!r) throw new Error('vfx: transient ring is empty');
    r.live = true;
    r.age = 0;
    return r;
  }

  tracer(from: Vec3, to: Vec3, colour: number, width: number, life: number): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < FX_DRAW.minLength) return;
    const r = this.take();
    r.shape = 'box';
    r.x = from.x;
    r.y = from.y;
    r.z = from.z;
    r.vx = r.vy = r.vz = 0;
    r.ax = dx / len;
    r.ay = dy / len;
    r.az = dz / len;
    r.s0 = width;
    r.s1 = width * FX_DRAW.tracerTail;
    r.len = len;
    r.life = life;
    r.gravity = 0;
    rgb(colour, r);
  }

  /** Spawn every part of a burst at `pos` around `axis` (null: up). */
  burst(kind: keyof typeof BURSTS, pos: Vec3, axis: Vec3 | null, tint: number): void {
    const parts: readonly Part[] = BURSTS[kind];
    const ax = axis?.x ?? 0;
    const ay = axis ? axis.y : 1;
    const az = axis?.z ?? 0;
    for (const p of parts) {
      for (let i = 0; i < p.count; i++) {
        const r = this.take();
        r.shape = p.shape;
        const sc = p.scatter ?? 0;
        r.x = pos.x + (this.rand() - FX_DRAW.jitterCentre) * 2 * sc;
        r.y = pos.y + (this.rand() - FX_DRAW.jitterCentre) * 2 * sc * (p.shape === 'box' ? FX_DRAW.boxFlatten : 0);
        r.z = pos.z + (this.rand() - FX_DRAW.jitterCentre) * 2 * sc;
        // Direction: the axis blended with a random one.
        let dx = ax * (1 - p.spread) + (this.rand() * 2 - 1) * p.spread;
        let dy = ay * (1 - p.spread) + (this.rand() * 2 - 1) * p.spread;
        let dz = az * (1 - p.spread) + (this.rand() * 2 - 1) * p.spread;
        const l = Math.hypot(dx, dy, dz) || 1;
        dx /= l;
        dy /= l;
        dz /= l;
        const speed = p.speed * (FX_DRAW.speedFloor + FX_DRAW.speedRange * this.rand());
        r.vx = dx * speed;
        r.vy = dy * speed;
        r.vz = dz * speed;
        if (p.shape === 'box') {
          // Streaks lie along the burst axis when it is not random, else along their own flight.
          r.ax = dx;
          r.ay = dy;
          r.az = dz;
        } else {
          r.ax = ax;
          r.ay = ay;
          r.az = az;
        }
        // Dashes trail behind: their axis is the travel direction, the streak extends backwards.
        if (kind === 'dash') {
          r.ax = -dx;
          r.ay = -dy;
          r.az = -dz;
        }
        r.s0 = p.s0;
        r.s1 = p.s1;
        r.len = p.len ?? 0;
        r.life = p.life * (FX_DRAW.lifeFloor + FX_DRAW.lifeRange * this.rand());
        r.gravity = p.gravity ?? 0;
        rgb(p.tint ? tint : p.colour, r);
      }
    }
  }

  /** Age every record by `dt` and draw the live ones. */
  update(dt: number, draw: Draw): void {
    const { box, sphere, ring } = draw.layers;
    const c = this.c;
    for (const r of this.recs) {
      if (!r.live) continue;
      r.age += dt;
      if (r.age >= r.life) {
        r.live = false;
        continue;
      }
      const t = r.age / r.life;
      const fade = 1 - t;
      const size = r.s0 + (r.s1 - r.s0) * t;
      const x = r.x + r.vx * r.age;
      const y = r.y + r.vy * r.age - FX_DRAW.half * r.gravity * r.age * r.age;
      const z = r.z + r.vz * r.age;
      c.r = r.r * fade;
      c.g = r.g * fade;
      c.b = r.b * fade;
      switch (r.shape) {
        case 'box': {
          const half = r.len / 2;
          box.push(faceZ(this.q, r.ax, r.ay, r.az), x + r.ax * half, y + r.ay * half, z + r.az * half, size, size, r.len, c.r, c.g, c.b);
          break;
        }
        case 'sphere':
          sphere.push(identity(), x, y, z, size, size, size, c.r, c.g, c.b);
          break;
        case 'ring':
          ring.push(faceY(this.q, r.ax, r.ay, r.az), x, y, z, size, size, size, c.r, c.g, c.b);
          break;
      }
    }
  }
}

/** Build the five instanced layers and the group that holds them. */
export function createDraw(root: Group): Draw {
  const material = createMaterial();
  const layers = {
    box: new Instances('box', material),
    sphere: new Instances('sphere', material),
    cylinder: new Instances('cylinder', material),
    cone: new Instances('cone', material),
    ring: new Instances('ring', material),
  };
  for (const l of Object.values(layers)) root.add(l.mesh);
  return { layers, root, material };
}
