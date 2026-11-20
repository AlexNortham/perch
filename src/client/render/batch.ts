/**
 * The instancing and level-of-detail framework (style guide §11.3, §11.4). Owner: Rendering & VFX.
 *
 * - `CellBatch`: static unique geometry merged per material kind per 64 × 64 m cell, in distance bands (`near`
 *   pieces such as props and trims under 0.5 m hide beyond 40 m, `mid` beyond 90 m, `far` always draw), with baked
 *   vertex AO across neighbouring cells. One draw call per cell, kind and band; frustum culling per cell.
 * - `LodInstances`: any mesh repeated 8 or more times becomes instances, bucketed every frame by frustum and camera
 *   distance into one InstancedMesh per LOD level (one draw call per level, however many instances).
 * - `updateBands` / `LodInstances.update` run each frame from the renderer, with 10 % hysteresis on every switch.
 *
 *   const batch = new CellBatch();
 *   batch.add(paint(wallGeometry, 'brick'), { band: 'far' });
 *   batch.add(paint(sillGeometry, 'ashlar'), { band: 'near' });
 *   const root = batch.build(lib, 'terrace-row');           // then each frame: updateBands(root, cameraPosition)
 */
import { BufferAttribute, Frustum, Group, InstancedMesh, Matrix4, Mesh, Sphere, Vector3 } from 'three';
import type { BufferGeometry, Camera, Color, Material, Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bakeAOAll, compactGeometry } from './materials';
import type { MaterialKind, MaterialLibrary } from './materials';
import { CELL, LOD, SHADOW_LAYER } from './constants';

export type Band = 'near' | 'mid' | 'far';
export const BAND_DISTANCE: Readonly<Record<Band, number>> = { near: LOD.near, mid: LOD.mid, far: Infinity };

export interface PieceOptions {
  /** 'shadow': a plain shadow-casting proxy, drawn only in the sun's shadow pass (layer SHADOW_LAYER). */
  readonly kind?: MaterialKind | 'shadow';
  readonly band?: Band;
  /** Casts shadows (§11.4: only geometry ≥ 0.5 m; cards at High only). Default: opaque yes, cutout no. */
  readonly cast?: boolean;
  /** Take part in the ray-traced AO bake (default: opaque primary forms, band 'far'). Huge pieces opt out. */
  readonly rays?: boolean;
}

/** One mesh per cell, kind and band; inside it, the pieces that take the ray AO bake and those that don't. */
interface Bucket {
  readonly baked: BufferGeometry[];
  readonly plain: BufferGeometry[];
  readonly kind: MaterialKind | 'shadow';
  readonly band: Band;
  cast: boolean;
  readonly cell: string;
}

const ATTRS = ['position', 'normal', 'uv', 'matLayer', 'color'] as const;
const SIZES: Readonly<Record<(typeof ATTRS)[number], number>> = { position: 3, normal: 3, uv: 2, matLayer: 1, color: 3 };

/** Give a painted geometry exactly the library's attributes (non-indexed) so any two merge. */
function normalise(g: BufferGeometry): BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  for (const name of Object.keys(out.attributes)) if (!(ATTRS as readonly string[]).includes(name)) out.deleteAttribute(name);
  if (!out.getAttribute('normal')) out.computeVertexNormals();
  const n = out.getAttribute('position').count;
  for (const name of ATTRS) {
    if (!out.getAttribute(name)) out.setAttribute(name, new BufferAttribute(new Float32Array(n * SIZES[name]).fill(name === 'color' ? 1 : 0), SIZES[name]));
  }
  return out;
}

export class CellBatch {
  private readonly buckets = new Map<string, Bucket>();
  private readonly centre = new Vector3();
  /**
   * With `shadowProxies`, painted meshes cast no shadows; pieces added with kind 'shadow' (plain collision-sized
   * shapes) cast instead, a fraction of the triangles in the shadow pass (§11.3: at most half the main pass).
   */
  constructor(private readonly cellSize: number = CELL.size, private readonly opts: { readonly shadowProxies?: boolean } = {}) {}

  /** Queue a painted geometry (world space). The batch owns it from here. */
  add(geometry: BufferGeometry, opts: PieceOptions = {}): void {
    const kind = opts.kind ?? 'opaque';
    const band = opts.band ?? 'far';
    const cast = opts.cast ?? kind === 'opaque';
    const rays = opts.rays ?? (kind === 'opaque' && band === 'far');
    geometry.computeBoundingBox();
    geometry.boundingBox?.getCenter(this.centre);
    const cell = `${Math.floor(this.centre.x / this.cellSize)},${Math.floor(this.centre.z / this.cellSize)}`;
    const key = `${cell}:${kind}:${band}`;
    let b = this.buckets.get(key);
    if (!b) {
      b = { baked: [], plain: [], kind, band, cast, cell };
      this.buckets.set(key, b);
    }
    // A mesh casts if any of its pieces does (pieces that shouldn't, such as small trims, go in their own band).
    b.cast ||= cast;
    if (kind === 'shadow') {
      const g = geometry.index ? geometry.toNonIndexed() : geometry;
      for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
      b.plain.push(g);
      return;
    }
    (rays ? b.baked : b.plain).push(normalise(geometry));
  }

  /**
   * Merge every bucket into a mesh, bake ray AO into opaque cells (neighbouring cells occlude), and return them in
   * a group. `ground` adds nothing here: bake contact gradients per piece with bakeAO before adding.
   */
  build(lib: MaterialLibrary, name: string): Group {
    const root = new Group();
    root.name = name;
    const merge = (list: BufferGeometry[]): BufferGeometry | null => {
      const g = list.length === 1 ? list[0] : list.length > 1 ? mergeGeometries(list) : null;
      if (list.length > 1) for (const p of list) p.dispose();
      g?.computeBoundingBox();
      return g ?? null;
    };
    const merged = [...this.buckets.values()].map((b) => ({ b, baked: merge(b.baked), plain: merge(b.plain) }));
    const occluders = merged.filter(({ b }) => b.kind === 'opaque' && b.band === 'far').flatMap(({ baked, plain }) => [baked, plain]).filter((g): g is BufferGeometry => g !== null);
    // One bake for every cell: a shared voxel grid, each occluder voxelised once.
    const baked = merged.map((m) => m.baked).filter((g): g is BufferGeometry => g !== null);
    bakeAOAll(baked, { occluders, reach: CELL.aoReach, voxel: CELL.aoVoxel, underside: false });
    for (const { b, baked, plain } of merged) {
      const mergedG = baked && plain ? mergeGeometries([baked, plain]) : (baked ?? plain);
      if (baked && plain) {
        baked.dispose();
        plain.dispose();
      }
      if (!mergedG) continue;
      // Weld and pack: indexed, small attribute types (vertex memory, W5b joint pass with the Environment Artist).
      const g = compactGeometry(mergedG);
      const mesh = new Mesh(g, b.kind === 'cutout' ? lib.cutout : lib.opaque);
      mesh.name = `${name}:${b.cell}:${b.kind}:${b.band}`;
      if (b.kind === 'shadow') {
        mesh.layers.set(SHADOW_LAYER);
        mesh.castShadow = true;
        mesh.userData['budget'] = 'shadow';
        root.add(mesh);
        continue;
      }
      mesh.castShadow = b.cast && !this.opts.shadowProxies;
      mesh.receiveShadow = true;
      if (b.kind === 'cutout') mesh.customDepthMaterial = lib.cutoutDepth;
      mesh.userData['band'] = BAND_DISTANCE[b.band];
      mesh.userData['budget'] = 'map';
      root.add(mesh);
    }
    this.buckets.clear();
    return root;
  }
}

const eyeBox = new Vector3();
/** Show or hide band meshes under `root` by the eye's distance to each mesh's bounds, with LOD.hysteresis. */
export function updateBands(root: Object3D, eye: Vector3): void {
  for (const o of root.children) {
    const max = o.userData['band'] as number | undefined;
    if (max === undefined || max === Infinity || !(o instanceof Mesh)) continue;
    const box = o.geometry.boundingBox;
    if (!box) continue;
    const d = box.clampPoint(eye, eyeBox).distanceTo(eye);
    o.visible = d < max * (o.visible ? 1 + LOD.hysteresis : 1);
  }
}

export interface LodLevel {
  readonly geometry: BufferGeometry;
  /** Instances up to this camera distance use this level; the last level's distance caps drawing. */
  readonly maxDistance: number;
}

/**
 * Instances of one kind of thing with LOD levels: each frame (when the camera moved), instances are frustum-tested
 * and bucketed by distance into the InstancedMesh of their level.
 */
export class LodInstances {
  readonly root = new Group();
  private readonly meshes: InstancedMesh[];
  private readonly matrices: Matrix4[] = [];
  private readonly colours: (Color | null)[] = [];
  private readonly spheres: Sphere[] = [];
  private readonly level: number[] = [];
  private readonly radius: number;
  private readonly frustum = new Frustum();
  private readonly pv = new Matrix4();
  private readonly last = new Matrix4();
  private readonly pos = new Vector3();
  private dirty = true;

  constructor(private readonly levels: readonly LodLevel[], material: Material, private readonly capacity: number, opts: { name: string; cast?: boolean; depth?: Material }) {
    this.meshes = levels.map((l, i) => {
      const m = new InstancedMesh(l.geometry, material, capacity);
      m.count = 0;
      m.name = `${opts.name}:lod${i}`;
      m.castShadow = opts.cast ?? false;
      m.receiveShadow = true;
      // Culling is done here per instance; the mesh's own bounds would be one instance's.
      m.frustumCulled = false;
      if (opts.depth) m.customDepthMaterial = opts.depth;
      m.userData['budget'] = 'map';
      this.root.add(m);
      return m;
    });
    this.root.name = opts.name;
    const s = levels[0]?.geometry;
    s?.computeBoundingSphere();
    this.radius = s?.boundingSphere?.radius ?? 1;
  }

  get count(): number {
    return this.matrices.length;
  }

  add(matrix: Matrix4, colour: Color | null = null): void {
    if (this.matrices.length >= this.capacity) return;
    this.matrices.push(matrix.clone());
    this.colours.push(colour);
    this.pos.setFromMatrixPosition(matrix);
    this.spheres.push(new Sphere(this.pos.clone(), this.radius * matrix.getMaxScaleOnAxis()));
    this.level.push(-1);
    this.dirty = true;
  }

  update(camera: Camera): void {
    this.pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (!this.dirty && this.pv.equals(this.last)) return;
    this.last.copy(this.pv);
    this.dirty = false;
    this.frustum.setFromProjectionMatrix(this.pv);
    camera.getWorldPosition(this.pos);
    const counts = this.meshes.map(() => 0);
    for (let i = 0; i < this.matrices.length; i++) {
      const s = this.spheres[i];
      const m = this.matrices[i];
      if (!s || !m || !this.frustum.intersectsSphere(s)) continue;
      const d = Math.max(0, s.center.distanceTo(this.pos) - s.radius);
      const prev = this.level[i] ?? -1;
      let lv = this.levels.findIndex((l) => d < l.maxDistance * (prev >= 0 ? 1 + LOD.hysteresis : 1));
      if (prev >= 0 && lv > prev && d < (this.levels[prev]?.maxDistance ?? 0) * (1 + LOD.hysteresis)) lv = prev;
      this.level[i] = lv;
      const mesh = lv >= 0 ? this.meshes[lv] : undefined;
      if (!mesh) continue;
      const k = counts[lv] ?? 0;
      mesh.setMatrixAt(k, m);
      const c = this.colours[i];
      if (c) mesh.setColorAt(k, c);
      counts[lv] = k + 1;
    }
    this.meshes.forEach((m, i) => {
      m.count = counts[i] ?? 0;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });
  }

  dispose(): void {
    for (const m of this.meshes) {
      m.geometry.dispose();
      m.dispose();
    }
  }
}
