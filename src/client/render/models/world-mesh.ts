/* eslint-disable @typescript-eslint/no-magic-numbers -- shader text and authored profiles: the numbers are the data */
/**
 * Shared pieces for the world's models (style guide §8.8, §9; D-ART-014): structures, Patrons, fledglings, Thicket
 * creatures and the Roc. Owner: Technical Artist (ART-W).
 * - `StaticMesh` merges Sculpt layers and baked implicit skins (the bird pipeline's forms, eyes, bills and feathers)
 *   into ONE static geometry for the bird solid material. Feather blades are doubled back to back, so the one
 *   single-sided material draws them from both sides and a statue or creature stays a single draw call.
 * - `Masonry` collects architecture painted with Rendering's material library (stone, timber, brass, pewter, rope,
 *   canvas…) into one geometry for the library's opaque material: one more draw call per structure.
 * - `glowMaterial` is the bird solid material with a state glow: vertices whose finish glow is above 1 glow at
 *   (glow − 1) × a per-material uniform (structures: idle 30 %, targeting 100 %, dying) or a per-instance attribute
 *   (creatures: their tell when aggroed). Ordinary glow (catchlights, below 1) is untouched.
 */
import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, Int8BufferAttribute, LatheGeometry, Matrix3, Matrix4, MeshLambertMaterial, Quaternion, SphereGeometry, Uint32BufferAttribute, Vector2, Vector3 } from 'three';
import type { Material, MeshStandardMaterial, WebGLProgramParametersWithUniforms } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { paint } from '../materials';
import type { MaterialId, MaterialLibrary, PaintOptions } from '../materials';
import { birdMaterials } from './bird-material';
import { CARD } from './feathers';
import { frameAt, jitter, mix } from './sculpt';
import type { Finish, Ring, Sculpt, V3 } from './sculpt';
import type { PaintedSkin } from './skin';

/** Glow above this value in a vertex's finish is a state glow, scaled by the material's or instance's glow. */
export const STATE_GLOW = 1;

const tmp = new Vector3();
const nm = new Matrix3();
const quat = new Quaternion();
const UP = new Vector3(0, 1, 0);

/** One static geometry for the bird solid material, from Sculpts and painted skins, each under its own transform. */
export class StaticMesh {
  private readonly p: number[] = [];
  private readonly n: number[] = [];
  private readonly uv: number[] = [];
  private readonly c: number[] = [];
  private readonly fx: number[] = [];
  private readonly fl: number[] = [];
  private readonly i: number[] = [];

  private vert(m: Matrix4, x: number, y: number, z: number, nx: number, ny: number, nz: number, flip: boolean): void {
    tmp.set(x, y, z).applyMatrix4(m);
    this.p.push(tmp.x, tmp.y, tmp.z);
    tmp.set(nx, ny, nz).applyMatrix3(nm).normalize();
    if (flip) tmp.negate();
    this.n.push(tmp.x, tmp.y, tmp.z);
  }

  /** A Sculpt's solid layer, and its feather blades both ways round. */
  sculpt(k: Sculpt, m: Matrix4 = new Matrix4()): this {
    nm.getNormalMatrix(m);
    const mirrored = m.determinant() < 0;
    for (const [L, sides] of [[k.solid, [false]], [k.cards, [false, true]]] as const) {
      for (const flip of sides) {
        const base = this.p.length / 3;
        for (let v = 0; v < L.count; v++) {
          this.vert(m, L.p[v * 3]!, L.p[v * 3 + 1]!, L.p[v * 3 + 2]!, L.n[v * 3]!, L.n[v * 3 + 1]!, L.n[v * 3 + 2]!, flip);
          this.uv.push(L.uv[v * 2]!, L.uv[v * 2 + 1]!);
          this.c.push(L.c[v * 3]!, L.c[v * 3 + 1]!, L.c[v * 3 + 2]!);
          this.fx.push(L.fx[v * 4]!, L.fx[v * 4 + 1]!, L.fx[v * 4 + 2]!, L.fx[v * 4 + 3]!);
          this.fl.push(0, 0, 0);
        }
        // Feather blades carry the card atlas's uv; drawn by the solid material they take its plain tile instead.
        if (L === k.cards) for (let v = this.fx.length - L.count * 4; v < this.fx.length; v += 4) this.fx[v + 3] = 0;
        const turn = flip !== mirrored;
        for (let t = 0; t < L.i.length; t += 3) {
          const a = L.i[t]! + base, b = L.i[t + 1]! + base, c = L.i[t + 2]! + base;
          if (turn) this.i.push(a, c, b);
          else this.i.push(a, b, c);
        }
      }
    }
    return this;
  }

  /** A painted skin level (positions in its bake frame) under `m`. */
  skin(s: PaintedSkin, m: Matrix4 = new Matrix4()): this {
    nm.getNormalMatrix(m);
    const L = s.level;
    const V = L.pos.length / 3;
    const base = this.p.length / 3;
    const scale = Math.cbrt(Math.abs(m.determinant())) || 1;
    for (let v = 0; v < V; v++) {
      this.vert(m, L.pos[v * 3]!, L.pos[v * 3 + 1]!, L.pos[v * 3 + 2]!, L.nrm[v * 3]!, L.nrm[v * 3 + 1]!, L.nrm[v * 3 + 2]!, false);
      // A skin's pattern repeats per metre of its bind frame: scaled up, it keeps its size on the statue's surface.
      const u = s.uv[v * 2]!;
      this.uv.push(u < 0 ? u / scale : u, s.uv[v * 2 + 1]!);
      this.c.push(s.c[v * 3]!, s.c[v * 3 + 1]!, s.c[v * 3 + 2]!);
      this.fx.push(s.fx[v * 4]!, s.fx[v * 4 + 1]!, s.fx[v * 4 + 2]!, s.fx[v * 4 + 3]!);
      tmp.set(L.flow[v * 3]!, L.flow[v * 3 + 1]!, L.flow[v * 3 + 2]!).transformDirection(m);
      this.fl.push(tmp.x, tmp.y, tmp.z);
    }
    for (const v of L.index) this.i.push(v + base);
    return this;
  }

  get triangles(): number {
    return this.i.length / 3;
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new Float32BufferAttribute(this.c, 3));
    g.setAttribute('fx', new Float32BufferAttribute(this.fx, 4));
    g.setAttribute('flow', new Int8BufferAttribute(Int8Array.from(this.fl, (x) => Math.round(x * 127)), 3, true));
    g.setIndex(new Uint32BufferAttribute(this.i, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** Architecture painted with the material library, merged into one geometry for `library.opaque`. */
export class Masonry {
  private readonly parts: BufferGeometry[] = [];

  /** Add a geometry, placed by `m`, painted with library material `id`. */
  add(g: BufferGeometry, id: MaterialId, m?: Matrix4, o: PaintOptions = {}): this {
    if (m) g.applyMatrix4(m);
    const painted = paint(g, id, o);
    for (const k of Object.keys(painted.attributes)) if (!['position', 'normal', 'uv', 'matLayer', 'color'].includes(k)) painted.deleteAttribute(k);
    this.parts.push(painted.index ? painted.toNonIndexed() : painted);
    return this;
  }

  /** A lathe through (radius, height) points about the y axis, placed at `at`. */
  lathe(profile: readonly (readonly [number, number])[], id: MaterialId, at: Vector3, seg: number, o: PaintOptions = {}): this {
    return this.add(new LatheGeometry(profile.map(([r, y]) => new Vector2(r, y)), seg), id, new Matrix4().makeTranslation(at.x, at.y, at.z), { uv: 'cylinder', ...o });
  }

  /** A post or rod from a (radius r) to b (radius r2), n sides. */
  rod(a: Vector3, b: Vector3, r: number, id: MaterialId, n: number, o: PaintOptions = {}, r2 = r): this {
    const len = a.distanceTo(b);
    const g = new CylinderGeometry(r2, r, len, n, 1, false);
    g.translate(0, len / 2, 0);
    g.applyQuaternion(quat.setFromUnitVectors(UP, tmp.copy(b).sub(a).normalize()));
    g.translate(a.x, a.y, a.z);
    return this.add(g, id, undefined, { turn: true, ...o });
  }

  get triangles(): number {
    return this.parts.reduce((s, g) => s + g.getAttribute('position').count / 3, 0);
  }

  build(): BufferGeometry {
    const g = this.parts.length > 0 ? (mergeGeometries(this.parts) ?? new BufferGeometry()) : new BufferGeometry();
    for (const p of this.parts) p.dispose();
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

/** The library's opaque material, or (no library: unit tests) a plain stand-in tagged so `retarget` still finds it. */
export function libraryOpaque(lib: MaterialLibrary | null): Material {
  if (lib) return lib.opaque;
  fallback ??= new MeshLambertMaterial({ vertexColors: true });
  fallback.userData['perchKind'] = 'opaque';
  return fallback;
}
let fallback: MeshLambertMaterial | null = null;

// ---------------------------------------------------------------------------------------------------------------
// Statue and creature parts built into Sculpts (model frame: +z forward, +y up, +x left).

const v3 = (v: Vector3): V3 => [v.x, v.y, v.z];

export interface WingOptions {
  readonly side: 1 | -1;
  readonly shoulder: V3;
  /** Shoulder to wing tip (m), and the secondaries' length (the wing's depth). */
  readonly span: number;
  readonly chord: number;
  /** Arm raised above level (rad), swept back (rad), and the feathers' spread: 0 folded along the back, 1 fully open. */
  readonly raise: number;
  readonly sweep: number;
  readonly open: number;
  /** The wing plane's roll about the arm (rad, + tips the trailing edge down). */
  readonly roll?: number;
  readonly root: number;
  readonly tip: number;
  /** Covert colour (default: the root colour lightened a little). */
  readonly covert?: number;
  readonly finish?: Finish;
  /** State glow on the primaries' tips (the Roc's flames): a tip colour and its glow (above STATE_GLOW). */
  readonly flame?: { readonly hex: number; readonly glow: number };
  readonly primaries?: number;
  readonly secondaries?: number;
  /** Ragged, notched feather tips (a Patron in phase two). */
  readonly ragged?: boolean;
  readonly rows: number;
}

/**
 * A feathered wing for a statue or a creature: a rounded leading edge from the shoulder to the wrist, secondaries and
 * tertials hanging back from the arm, primaries fanned from the hand by `open`, and two rows of coverts over the
 * roots. Feathers are stacked a little apart along the wing's normal so none lie in the same plane.
 */
export function featherWing(k: Sculpt, o: WingOptions): void {
  const s = o.side;
  const arm = new Vector3(s, 0, 0).applyAxisAngle(new Vector3(0, 0, 1), s * o.raise).applyAxisAngle(new Vector3(0, 1, 0), s * o.sweep);
  const up = new Vector3(0, 1, 0).applyAxisAngle(new Vector3(0, 0, 1), s * o.raise).applyAxisAngle(arm, -s * (o.roll ?? 0));
  // The trailing edge: straight back on a level wing; rolled (supinated), it hangs down and shows the underside.
  const back = new Vector3().crossVectors(arm, up).multiplyScalar(-s).normalize();
  const sh = new Vector3(...o.shoulder);
  const along = (u: number): Vector3 => sh.clone().addScaledVector(arm, o.span * u).addScaledVector(up, o.span * 0.04 * Math.sin(Math.PI * Math.min(1, u / 0.62)));
  const lift = (p: Vector3, i: number): V3 => v3(p.clone().addScaledVector(up, o.chord * 0.012 * i));
  const covert = o.covert ?? mix(o.root, 0xffffff, 0.08);
  const cell = o.ragged ? CARD.ragged : CARD.primary;
  // Leading edge: the arm's rounded bar, thick at the shoulder; behind it a flat panel the coverts lie on.
  const rings: Ring[] = [0, 0.2, 0.4, 0.62, 0.7].map((u) => ({ c: v3(along(u)), w: o.chord * (0.14 - 0.1 * u), up: o.chord * (0.12 - 0.08 * u), n: v3(up) }));
  k.loft(rings, { n: 9, seg: 8, paint: (t) => mix(covert, o.root, t), finish: o.finish ?? {} });
  const panel: Ring[] = [0.02, 0.25, 0.5, 0.7].map((u) => ({ c: v3(along(u).addScaledVector(back, o.chord * 0.3 * (1 - 0.3 * u))), w: o.chord * 0.33 * (1 - 0.35 * u), up: o.chord * 0.05, n: v3(up) }));
  k.loft(panel, { n: 6, seg: 8, sq: 4, paint: covert, finish: o.finish ?? {} });
  // Secondaries and tertials from the arm, turning outward toward the hand, overlapping by about half.
  const nSec = o.secondaries ?? 10;
  for (let i = 0; i < nSec; i++) {
    const u = 0.06 + (0.6 * i) / (nSec - 1);
    const dir = back.clone().applyAxisAngle(up, s * (-0.12 + 0.45 * u * o.open)).addScaledVector(up, -0.1).normalize();
    k.card({ at: lift(along(u), i), dir: v3(dir), face: v3(up), len: o.chord * (0.95 + 0.1 * jitter(i, 3)), wid: o.chord * 0.42, cell: o.ragged && i % 3 === 1 ? CARD.ragged : CARD.tail, root: o.root, tip: o.tip, curl: -0.12, segs: o.rows, cup: 0.12, ...(o.finish && { finish: o.finish }) });
  }
  // Primaries from the hand: fanned from the trailing edge to the tip as the wing opens.
  const nPri = o.primaries ?? 8;
  for (let i = 0; i < nPri; i++) {
    const f = i / (nPri - 1);
    const u = 0.62 + 0.22 * f;
    const turn = (0.1 + 0.9 * f) * (0.25 + 0.75 * o.open) * 1.55;
    const dir = back.clone().applyAxisAngle(up, s * turn).addScaledVector(up, -0.06).normalize();
    const len = (o.span * (0.3 + 0.16 * Math.sin(Math.PI * (0.25 + 0.6 * f))) * (0.6 + 0.4 * o.open) + o.chord * 0.4) * 1.15;
    const at = lift(along(u), nSec + i);
    const finish = o.flame ? { ...(o.finish ?? {}), glow: STATE_GLOW + o.flame.glow } : o.finish;
    // A flame-tipped primary: its outer third is a second blade in the flame colour, glowing.
    k.card({ at, dir: v3(dir), face: v3(up), len, wid: o.chord * 0.26, cell, root: o.root, tip: o.tip, curl: -0.18, sweep: s * 0.1, segs: o.rows + 1, cup: 0.1, ...(o.finish && { finish: o.finish }) });
    if (o.flame && finish) {
      const tipAt = new Vector3(...at).addScaledVector(dir, len * 0.62).addScaledVector(up, o.chord * 0.01);
      k.card({ at: v3(tipAt), dir: v3(dir), face: v3(up), len: len * 0.5, wid: o.chord * 0.2, cell: CARD.ragged, root: mix(o.tip, o.flame.hex, 0.6), tip: o.flame.hex, curl: -0.25, segs: 2, finish });
    }
  }
  // Coverts: a greater row over the secondaries' roots, a lesser row at the leading edge, and primary coverts.
  for (let i = 0; i < nSec - 1; i++) {
    const u = 0.1 + (0.55 * i) / (nSec - 2);
    const dir = back.clone().applyAxisAngle(up, s * (-0.1 + 0.4 * u * o.open)).normalize();
    k.card({ at: lift(along(u).addScaledVector(back, o.chord * 0.04), nSec + nPri + i), dir: v3(dir), face: v3(up), len: o.chord * 0.55, wid: o.chord * 0.36, cell: CARD.contour, root: covert, tip: mix(covert, o.tip, 0.4), curl: -0.1, segs: Math.max(2, o.rows - 1), cup: 0.1, ...(o.finish && { finish: o.finish }) });
    k.card({ at: lift(along(u + 0.03), 2 * nSec + nPri + i), dir: v3(dir), face: v3(up), len: o.chord * 0.32, wid: o.chord * 0.28, cell: CARD.contour, root: mix(covert, 0xffffff, 0.05), tip: covert, curl: -0.08, segs: 2, ...(o.finish && { finish: o.finish }) });
  }
  for (let i = 0; i < 4; i++) {
    const f = i / 3;
    const dir = back.clone().applyAxisAngle(up, s * (0.3 + 0.7 * f) * (0.2 + 0.8 * o.open)).normalize();
    k.card({ at: lift(along(0.64 + 0.12 * f), 3 * nSec + nPri + i), dir: v3(dir), face: v3(up), len: o.span * 0.2, wid: o.chord * 0.3, cell: CARD.contour, root: covert, tip: mix(covert, o.tip, 0.5), curl: -0.1, segs: 2, ...(o.finish && { finish: o.finish }) });
  }
}

/** A fanned tail: `n` feathers from `root` along `dir`, spread over `spread` rad in the plane with normal `face`. */
export function featherFan(k: Sculpt, root: V3, dir: V3, face: V3, o: { n: number; len: number; wid: number; spread: number; root: number; tip: number; rows: number; finish?: Finish; cell?: readonly [number, number] }): void {
  const d = new Vector3(...dir).normalize();
  const f = new Vector3(...face).normalize();
  for (let i = 0; i < o.n; i++) {
    const t = o.n === 1 ? 0 : i / (o.n - 1) - 0.5;
    // Middle feathers on top and longest; the outer pairs a little shorter.
    const di = d.clone().applyAxisAngle(f, t * o.spread);
    const at = new Vector3(...root).addScaledVector(f, (0.5 - Math.abs(t)) * o.wid * 0.12);
    k.card({ at: v3(at), dir: v3(di), face: v3(f), len: o.len * (1 - 0.18 * Math.abs(t) * 2), wid: o.wid, cell: o.cell ?? CARD.tail, root: o.root, tip: o.tip, curl: -0.1, segs: o.rows, cup: 0.1, ...(o.finish && { finish: o.finish }) });
  }
}

/** A statue's or creature's eye: a dark glossy ball, an iris with a state glow (`glow` above STATE_GLOW), a catchlight. */
export function glowEye(k: Sculpt, at: V3, look: V3, r: number, iris: number, glow: number, segs = 10): void {
  const F = frameAt(at, look);
  k.mesh(new SphereGeometry(r, segs, Math.max(4, Math.round(segs * 0.7))), { frame: F, paint: 0x0c0a0c, finish: { gloss: 1 } });
  const ring = new SphereGeometry(r * 1.004, segs, 3, 0, Math.PI * 2, 0, 0.75);
  ring.rotateX(Math.PI / 2);
  k.mesh(ring, { frame: F, paint: (p) => (Math.hypot(p.x, p.y) < r * 0.3 ? 0x050406 : iris), finish: { gloss: 1, glow } });
  k.mesh(new SphereGeometry(r * 0.17, 5, 3), { frame: F, at: [r * 0.22, r * 0.4, r * 0.9], scale: [1, 1, 0.45], paint: 0xffffff, finish: { glow: 0.85, gloss: 1 } });
}

/** A per-material state glow (structures). */
export interface GlowMaterial {
  readonly material: MeshStandardMaterial;
  readonly glow: { value: number };
}

/**
 * The bird solid material with a state glow from a uniform (`per: 'material'`, one material per structure, all on one
 * program) or from a per-instance float attribute `instanceGlow` (`per: 'instance'`, creatures).
 */
export function glowMaterial(per: 'material' | 'instance'): GlowMaterial {
  const { solid, cards } = birdMaterials();
  cards.dispose();
  const glow = { value: 0.3 };
  const base = solid.onBeforeCompile.bind(solid);
  solid.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    base(shader, renderer);
    const k = per === 'material' ? 'uGlow' : 'instanceGlow';
    if (per === 'material') shader.uniforms['uGlow'] = glow;
    const head = per === 'material' ? 'uniform float uGlow;\n' : 'attribute float instanceGlow;\n';
    shader.vertexShader = head + shader.vertexShader.replace('vFx = fx;', `vFx = fx;\n  if (vFx.y > ${STATE_GLOW.toFixed(1)}) vFx.y = (vFx.y - ${STATE_GLOW.toFixed(1)}) * ${k};`);
  };
  solid.customProgramCacheKey = () => `perch-world-${per}`;
  solid.name = `world-${per}`;
  return { material: solid, glow };
}
