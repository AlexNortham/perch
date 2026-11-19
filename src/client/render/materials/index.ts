/**
 * The shared procedural material library (style guide §7). Owner: Rendering & VFX. Artists import from here.
 *
 * Every material is one layer of three texture arrays (albedo, packed AO/roughness/metalness, normal), generated at
 * load from seeded code (data/recipes.ts) and identical every run. Two shared materials draw everything painted
 * with the library, so a whole 64 m cell of mixed brick, timber, roof and stone merges into one draw call:
 *
 *   const lib = getMaterialLibrary('medium');
 *   const wall = paint(new BoxGeometry(4, 3, 0.5).applyMatrix4(placed), 'brick', { seed: 7 });
 *   bakeAO(wall, { ground: () => 0 });
 *   scene.add(new Mesh(wall, lib.opaque));            // leaf, needle and feather cards: lib.cutout
 *
 * Geometry contract (paint() writes all three):
 * - `uv`: texture coordinates in tiles (paint converts metres; cards keep their 0..1 uv).
 * - `matLayer` (float): the layer, `lib.layer(id)` / `layerOf(id)`.
 * - `color`: albedo multiplier (baked AO, tint, per-piece variation); white when absent.
 * In the shader: world-space macro variation (2 octaves, 2–8 m, ±6 %) breaks up tiling (§7.1); emissive layers
 * glow (lit windows, lanterns); water scrolls. Low is Lambert with albedo only; Medium is PBR with albedo + ORM;
 * High adds normal maps (§11.6). Swap a built scene to another quality with `retarget(root, lib)`.
 */
import {
  BufferAttribute,
  Color,
  DataArrayTexture,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshDepthMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Mesh,
  NoColorSpace,
  RGBADepthPacking,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from 'three';
import type { BufferGeometry, Material, Object3D, Texture, WebGLProgramParametersWithUniforms } from 'three';
import type { Quality } from '../../app/contracts';
import { halve, renderLayer } from './generate';
import { MATERIAL_IDS, RECIPES } from './data/recipes';
import type { MaterialId, Recipe } from './data/recipes';
import { MATERIAL_TIERS, MACRO_VARIATION, ENV_INTENSITY, WATER_FLOW, PIECE_VARIATION, AO, ALPHA_CUTOFF } from './constants';

export { MATERIAL_IDS, RECIPES } from './data/recipes';
export type { MaterialId, Recipe } from './data/recipes';
export { MATERIAL_TIERS } from './constants';

/** Which shared material a mesh uses: opaque surfaces or alpha-tested, double-sided cards. */
export type MaterialKind = 'opaque' | 'cutout';

export interface MaterialLibrary {
  readonly quality: Quality;
  /** Painted opaque surfaces: PBR at Medium and High, Lambert at Low. */
  readonly opaque: Material;
  /** Alpha-tested, double-sided cards (leaves, needles, feathers). */
  readonly cutout: Material;
  /** Set as `mesh.customDepthMaterial` on cutout meshes that cast shadows. */
  readonly cutoutDepth: Material;
  /** Texture-array layer of a material. */
  layer(id: MaterialId): number;
  /** Advance animated layers (water); call once per frame with seconds. */
  tick(seconds: number): void;
  /** The sky-derived environment map metal and glass reflect (§7.3), or null. */
  setEnvironment(env: Texture | null): void;
  /** Texture bytes on the GPU (all mips), for the §11.5 budget. */
  readonly textureBytes: number;
  dispose(): void;
}

export const layerOf = (id: MaterialId): number => MATERIAL_IDS.indexOf(id);

const SEED_BASE = 7919;
const RGBA = 4;
/** A full mip chain adds a third. */
const MIP_FACTOR = 1.3334;

interface Pixels {
  readonly size: number;
  readonly albedo: Uint8Array;
  readonly orm: Uint8Array;
  readonly ormSize: number;
  readonly normal: Uint8Array | null;
}
const pixelCache = new Map<string, Pixels>();

/** Generate (or reuse) every layer at a tier's sizes. Deterministic: same bytes every run. */
export function generatePixels(size: number, ormSize: number, withNormal: boolean, ids: readonly MaterialId[] = MATERIAL_IDS): Pixels {
  const key = `${size}:${ormSize}:${withNormal}:${ids.join(',')}`;
  const cached = pixelCache.get(key);
  if (cached) return cached;
  const per = size * size * RGBA;
  const perOrm = ormSize * ormSize * RGBA;
  const albedo = new Uint8Array(per * ids.length);
  const orm = new Uint8Array(perOrm * ids.length);
  const normal = withNormal ? new Uint8Array(per * ids.length) : null;
  ids.forEach((id, k) => {
    const l = renderLayer(RECIPES[id], size, SEED_BASE + MATERIAL_IDS.indexOf(id), withNormal);
    albedo.set(l.albedo, per * k);
    let o = l.orm;
    for (let s = size; s > ormSize; s /= 2) o = halve(o, s);
    orm.set(o, perOrm * k);
    if (normal && l.normal) normal.set(l.normal, per * k);
  });
  const out = { size, albedo, orm, ormSize, normal };
  pixelCache.set(key, out);
  return out;
}

function arrayTexture(data: Uint8Array, size: number, layers: number, srgb: boolean, anisotropy: number): DataArrayTexture {
  const t = new DataArrayTexture(data, size, size, layers);
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  return t;
}

// ── Shader injection ──────────────────────────────────────────────────────────────────────────────────────────────

const VERT_DECL = /* glsl */ `
attribute float matLayer;
flat varying float vMatLayer;
varying vec2 vMatUv;
varying vec3 vMatWorld;
`;
const VERT_MAIN = /* glsl */ `
vMatLayer = matLayer;
vMatUv = uv;
{
  vec4 matWp = vec4( transformed, 1.0 );
  #ifdef USE_INSTANCING
    matWp = instanceMatrix * matWp;
  #endif
  vMatWorld = ( modelMatrix * matWp ).xyz;
}
`;
const FRAG_DECL = /* glsl */ `
uniform sampler2DArray tMatAlbedo;
uniform float uMatEmissive[ MAT_LAYERS ];
uniform float uMatMacro;
uniform float uMatTime;
uniform float uMatWater;
uniform vec2 uMatFlow;
#ifdef MAT_ORM
  uniform sampler2DArray tMatOrm;
#endif
#ifdef MAT_NORMAL
  uniform sampler2DArray tMatNormal;
#endif
flat varying float vMatLayer;
varying vec2 vMatUv;
varying vec3 vMatWorld;
float matHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
float matNoise( vec2 p ) {
  vec2 i = floor( p ); vec2 f = fract( p ); vec2 u = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( matHash( i ), matHash( i + vec2( 1.0, 0.0 ) ), u.x ), mix( matHash( i + vec2( 0.0, 1.0 ) ), matHash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
}
`;
const FRAG_MAP = /* glsl */ `
vec2 matUv = vMatUv + ( abs( vMatLayer - uMatWater ) < 0.5 ? uMatFlow * uMatTime : vec2( 0.0 ) );
vec3 matCoord = vec3( matUv, vMatLayer );
vec4 matTex = texture( tMatAlbedo, matCoord );
diffuseColor *= matTex;
{
  vec2 mp = vec2( vMatWorld.x + vMatWorld.y * 0.7, vMatWorld.z - vMatWorld.y * 0.5 );
  float macro = 0.6 * matNoise( mp / MAT_MACRO_FAR ) + 0.4 * matNoise( mp / MAT_MACRO_NEAR + 17.0 );
  diffuseColor.rgb *= 1.0 + uMatMacro * ( 2.0 * macro - 1.0 );
}
`;
const FRAG_DEPTH_MAP = /* glsl */ `
diffuseColor *= texture( tMatAlbedo, vec3( vMatUv, vMatLayer ) );
`;
const FRAG_ROUGHNESS = /* glsl */ `
float roughnessFactor = roughness;
#ifdef MAT_ORM
  vec4 matOrm = texture( tMatOrm, matCoord );
  roughnessFactor *= matOrm.g;
#endif
`;
const FRAG_METALNESS = /* glsl */ `
float metalnessFactor = metalness;
#ifdef MAT_ORM
  metalnessFactor *= matOrm.b;
#endif
`;
const FRAG_NORMAL = /* glsl */ `
#ifdef MAT_NORMAL
{
  vec3 mapN = texture( tMatNormal, matCoord ).xyz * 2.0 - 1.0;
  vec3 q0 = dFdx( - vViewPosition );
  vec3 q1 = dFdy( - vViewPosition );
  vec2 st0 = dFdx( matUv );
  vec2 st1 = dFdy( matUv );
  vec3 q1perp = cross( q1, normal );
  vec3 q0perp = cross( normal, q0 );
  vec3 T = q1perp * st0.x + q0perp * st1.x;
  vec3 B = q1perp * st0.y + q0perp * st1.y;
  float det = max( dot( T, T ), dot( B, B ) );
  float s = det == 0.0 ? 0.0 : inversesqrt( det );
  normal = normalize( mat3( T * s, B * s, normal ) * mapN );
}
#endif
`;
const FRAG_EMISSIVE = /* glsl */ `
#include <emissivemap_fragment>
totalEmissiveRadiance += matTex.rgb * uMatEmissive[ int( vMatLayer + 0.5 ) ];
`;
const FRAG_AO = /* glsl */ `
#include <aomap_fragment>
#ifdef MAT_ORM
  reflectedLight.indirectDiffuse *= matOrm.r;
#endif
`;

type Uniforms = Record<string, { value: unknown }>;

function inject(material: Material, uniforms: Uniforms, key: string, depth: boolean): void {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_DECL}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${VERT_MAIN}`);
    let f = shader.fragmentShader.replace('#include <common>', `#include <common>\n${FRAG_DECL}`);
    if (depth) {
      f = f.replace('#include <map_fragment>', FRAG_DEPTH_MAP);
    } else {
      f = f
        .replace('#include <map_fragment>', FRAG_MAP)
        .replace('#include <roughnessmap_fragment>', FRAG_ROUGHNESS)
        .replace('#include <metalnessmap_fragment>', FRAG_METALNESS)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${FRAG_NORMAL}`)
        .replace('#include <emissivemap_fragment>', FRAG_EMISSIVE)
        .replace('#include <aomap_fragment>', FRAG_AO);
    }
    shader.fragmentShader = f;
  };
  material.customProgramCacheKey = () => key;
}

const libraries = new Map<Quality, MaterialLibrary>();

/** The library for a quality tier, generated on first use and cached until disposed. */
export function getMaterialLibrary(quality: Quality): MaterialLibrary {
  const cached = libraries.get(quality);
  if (cached) return cached;
  const tier = MATERIAL_TIERS[quality];
  const px = generatePixels(tier.size, tier.ormSize, tier.normal);
  const layers = MATERIAL_IDS.length;
  const albedo = arrayTexture(px.albedo, px.size, layers, true, tier.anisotropy);
  const orm = tier.pbr ? arrayTexture(px.orm, px.ormSize, layers, false, tier.anisotropy) : null;
  const normal = px.normal ? arrayTexture(px.normal, px.size, layers, false, tier.anisotropy) : null;
  const uniforms: Uniforms = {
    tMatAlbedo: { value: albedo },
    tMatOrm: { value: orm },
    tMatNormal: { value: normal },
    uMatEmissive: { value: MATERIAL_IDS.map((id) => RECIPES[id].emissive ?? 0) },
    uMatMacro: { value: MACRO_VARIATION.strength },
    uMatTime: { value: 0 },
    uMatWater: { value: layerOf('water') },
    uMatFlow: { value: [WATER_FLOW.u, WATER_FLOW.v] },
  };
  const defines: Record<string, string | number> = {
    MAT_LAYERS: layers,
    MAT_MACRO_FAR: MACRO_VARIATION.far.toFixed(1),
    MAT_MACRO_NEAR: MACRO_VARIATION.near.toFixed(1),
  };
  if (tier.pbr) defines['MAT_ORM'] = '';
  if (normal) defines['MAT_NORMAL'] = '';
  const make = (kind: MaterialKind): Material => {
    const cut = kind === 'cutout';
    const common = { vertexColors: true, ...(cut && { alphaTest: ALPHA_CUTOFF, side: DoubleSide, alphaToCoverage: tier.alphaToCoverage }) };
    const m = tier.pbr ? new MeshStandardMaterial({ ...common, roughness: 1, metalness: 1, envMapIntensity: ENV_INTENSITY }) : new MeshLambertMaterial(common);
    m.defines = { ...defines };
    m.userData['perchKind'] = kind;
    inject(m, uniforms, `perch-mat:${quality}:${kind}`, false);
    return m;
  };
  const opaque = make('opaque');
  const cutout = make('cutout');
  const cutoutDepth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking, alphaTest: ALPHA_CUTOFF });
  cutoutDepth.defines = { ...defines };
  inject(cutoutDepth, uniforms, `perch-mat:${quality}:depth`, true);
  const bytes = (t: DataArrayTexture | null): number => (t ? t.image.width * t.image.height * layers * RGBA * MIP_FACTOR : 0);
  const lib: MaterialLibrary = {
    quality,
    opaque,
    cutout,
    cutoutDepth,
    textureBytes: Math.round(bytes(albedo) + bytes(orm) + bytes(normal)),
    layer: layerOf,
    tick(seconds) {
      (uniforms['uMatTime'] as { value: number }).value = seconds;
    },
    setEnvironment(env) {
      for (const m of [opaque, cutout]) {
        if (m instanceof MeshStandardMaterial && m.envMap !== env) {
          m.envMap = env;
          m.needsUpdate = true;
        }
      }
    },
    dispose() {
      libraries.delete(quality);
      for (const m of [opaque, cutout, cutoutDepth]) m.dispose();
      for (const t of [albedo, orm, normal]) t?.dispose();
    },
  };
  libraries.set(quality, lib);
  return lib;
}

/** Point every library-material mesh under `root` at `lib`'s materials (after a quality change). */
export function retarget(root: Object3D, lib: MaterialLibrary): void {
  root.traverse((o) => {
    if (!(o instanceof Mesh) || Array.isArray(o.material)) return;
    const kind = (o.material as Material).userData['perchKind'] as MaterialKind | undefined;
    if (kind === 'opaque') o.material = lib.opaque;
    else if (kind === 'cutout') {
      o.material = lib.cutout;
      if (o.customDepthMaterial) o.customDepthMaterial = lib.cutoutDepth;
    }
  });
}

// ── Painting geometry ─────────────────────────────────────────────────────────────────────────────────────────────

export interface PaintOptions {
  /** Albedo multiplier (sRGB hex): a district tint or a faded flock tint. Default white. */
  readonly tint?: number;
  /**
   * How uv is made. 'planar' (default): per triangle, a gravity-aligned frame in the triangle's plane, in metres from
   * the world origin (walls keep courses level, roofs run courses along the eaves). 'cylinder': around the vertical
   * axis through the geometry's centre (trunks, towers, posts). 'keep': the geometry's uv is already in metres (or
   * spans a card, 0..1).
   */
  readonly uv?: 'planar' | 'cylinder' | 'keep';
  /** Floors only (planar): turn the ground pattern to a piece's yaw so slabs line up with it. */
  readonly yaw?: number;
  /** Texture scale: 2 = pattern twice as big. */
  readonly scale?: number;
  /** Shift in metres, so neighbouring pieces don't line up. */
  readonly offset?: readonly [number, number];
  /** Per-piece §4.4 variation (hue ±3°, value ±5 %) from this stable seed; none when absent. */
  readonly seed?: number;
}

const UP = new Vector3(0, 1, 0);
const WHITE = 0xffffff;
const FLOOR_NORMAL_Y = 0.9;
const XYZ = 3;
const TRI = 3;

function variation(seed: number): Color {
  const h = (n: number): number => {
    const s = Math.sin((seed + n) * PIECE_VARIATION.hashA) * PIECE_VARIATION.hashB;
    return s - Math.floor(s);
  };
  const c = new Color(1, 1, 1);
  const k = 1 + (h(1) * 2 - 1) * PIECE_VARIATION.value;
  const hue = ((h(2) * 2 - 1) * PIECE_VARIATION.hueDeg) / PIECE_VARIATION.fullTurnDeg;
  // A hue shift as a gentle channel tilt around white (warm one way, cool the other).
  c.setRGB(k * (1 + hue * PIECE_VARIATION.hueTilt), k, k * (1 - hue * PIECE_VARIATION.hueTilt));
  return c;
}

/**
 * Paint `geometry` with material `id`: writes `uv` (tiles), `matLayer` and `color` (multiplying any existing
 * colours). Planar and cylinder mapping need a non-indexed geometry; an indexed one is converted and returned.
 * Position the geometry in the world (or in its kit piece's frame) before painting.
 */
export function paint(geometry: BufferGeometry, id: MaterialId, opts: PaintOptions = {}): BufferGeometry {
  const recipe: Recipe = RECIPES[id];
  const mode = opts.uv ?? 'planar';
  const g = mode !== 'keep' && geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.getAttribute('position');
  const n = pos.count;
  const scale = opts.scale ?? 1;
  const [ox, oy] = opts.offset ?? [0, 0];
  const [tw, th] = recipe.card ? [1, 1] : recipe.tile;
  const uv = new Float32Array(n * 2);
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const nrm = new Vector3();
  const uAxis = new Vector3();
  const vAxis = new Vector3();
  const p = new Vector3();
  if (mode === 'keep') {
    const src = g.getAttribute('uv');
    for (let i = 0; i < n; i++) {
      const u = src ? src.getX(i) : 0;
      const v = src ? src.getY(i) : 0;
      uv[i * 2] = recipe.card ? u : (u + ox) / (tw * scale);
      uv[i * 2 + 1] = recipe.card ? v : (v + oy) / (th * scale);
    }
  } else if (mode === 'planar') {
    const cy = Math.cos(opts.yaw ?? 0);
    const sy = Math.sin(opts.yaw ?? 0);
    for (let t = 0; t + TRI - 1 < n; t += TRI) {
      a.fromBufferAttribute(pos, t);
      b.fromBufferAttribute(pos, t + 1);
      c.fromBufferAttribute(pos, t + 2);
      nrm.subVectors(c, b).cross(a.clone().sub(b)).normalize();
      const floor = Math.abs(nrm.y) > FLOOR_NORMAL_Y;
      if (!floor) {
        uAxis.crossVectors(UP, nrm).normalize();
        vAxis.crossVectors(nrm, uAxis).normalize();
      }
      for (let k = 0; k < TRI; k++) {
        p.fromBufferAttribute(pos, t + k);
        const u = floor ? p.x * cy - p.z * sy : p.dot(uAxis);
        const v = floor ? p.x * sy + p.z * cy : p.dot(vAxis);
        uv[(t + k) * 2] = (u + ox) / (tw * scale);
        uv[(t + k) * 2 + 1] = (v + oy) / (th * scale);
      }
    }
  } else {
    g.computeBoundingBox();
    const box = g.boundingBox;
    const cx = box ? (box.min.x + box.max.x) / 2 : 0;
    const cz = box ? (box.min.z + box.max.z) / 2 : 0;
    let r = 0;
    for (let i = 0; i < n; i++) r += Math.hypot(pos.getX(i) - cx, pos.getZ(i) - cz);
    r = Math.max(r / Math.max(n, 1), AO.minRadius);
    const around = 2 * Math.PI * r;
    for (let t = 0; t + TRI - 1 < n; t += TRI) {
      const us = [0, 1, 2].map((k) => Math.atan2(pos.getZ(t + k) - cz, pos.getX(t + k) - cx) * r);
      const hi = Math.max(...us);
      for (let k = 0; k < TRI; k++) {
        const u = (us[k] ?? 0) < hi - around / 2 ? (us[k] ?? 0) + around : (us[k] ?? 0);
        uv[(t + k) * 2] = (u + ox) / (tw * scale);
        uv[(t + k) * 2 + 1] = (pos.getY(t + k) + oy) / (th * scale);
      }
    }
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  g.setAttribute('matLayer', new BufferAttribute(new Float32Array(n).fill(layerOf(id)), 1));
  const tint = new Color(opts.tint ?? WHITE);
  if (opts.seed !== undefined) tint.multiply(variation(opts.seed));
  const existing = g.getAttribute('color');
  const col = new Float32Array(n * XYZ);
  for (let i = 0; i < n; i++) {
    col[i * XYZ] = tint.r * (existing ? existing.getX(i) : 1);
    col[i * XYZ + 1] = tint.g * (existing ? existing.getY(i) : 1);
    col[i * XYZ + 2] = tint.b * (existing ? existing.getZ(i) : 1);
  }
  g.setAttribute('color', new BufferAttribute(col, XYZ));
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  return g;
}

// ── Baked ambient occlusion (§7.4) ────────────────────────────────────────────────────────────────────────────────

export interface AoOptions {
  /** Geometry that occludes but isn't darkened itself (neighbouring pieces, the ground). */
  readonly occluders?: readonly BufferGeometry[];
  /** Voxel size in metres (default AO.voxel); grows if the bounds would need too many voxels. */
  readonly voxel?: number;
  /** How far a vertex looks for occluders, metres (default AO.reach). */
  readonly reach?: number;
  /** Ground height under a point: walls get the 0.3 m contact band and the 0.8 m damp gradient (§5.8, §7.4). */
  readonly ground?: (x: number, z: number) => number;
  /** Overall strength 0..1 (default 1). */
  readonly strength?: number;
}

/** Hemisphere directions in tangent space (z = along the normal), cosine-weighted, fixed so bakes repeat. */
const RAYS: readonly (readonly [number, number, number])[] = Array.from({ length: AO.rays }, (_, i) => {
  const z = Math.sqrt(1 - (i + 1 / 2) / AO.rays);
  const r = Math.sqrt(1 - z * z);
  return [Math.cos(AO.goldenAngle * i) * r, Math.sin(AO.goldenAngle * i) * r, z] as const;
});

/**
 * Darken `geometry`'s vertex colours by baked ambient occlusion: concave edges 25–35 %, faces under overhangs,
 * the ground-contact band and damp gradient on walls. Rays march through a voxel grid of the geometry and its
 * occluders. Vertices need normals; bake after painting (colours are multiplied in place).
 */
export function bakeAO(geometry: BufferGeometry, opts: AoOptions = {}): void {
  const reach = opts.reach ?? AO.reach;
  const strength = opts.strength ?? 1;
  const sources = [geometry, ...(opts.occluders ?? [])];
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  geometry.computeBoundingBox();
  if (!geometry.boundingBox) return;
  min.copy(geometry.boundingBox.min).subScalar(reach);
  max.copy(geometry.boundingBox.max).addScalar(reach);
  const size = new Vector3().subVectors(max, min);
  let voxel = opts.voxel ?? AO.voxel;
  while ((size.x / voxel) * (size.y / voxel) * (size.z / voxel) > AO.maxVoxels) voxel *= AO.voxelGrowth;
  const nx = Math.max(1, Math.ceil(size.x / voxel));
  const ny = Math.max(1, Math.ceil(size.y / voxel));
  const nz = Math.max(1, Math.ceil(size.z / voxel));
  const grid = new Uint8Array(nx * ny * nz);
  const cell = (x: number, y: number, z: number): number => {
    const i = Math.floor((x - min.x) / voxel);
    const j = Math.floor((y - min.y) / voxel);
    const k = Math.floor((z - min.z) / voxel);
    return i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz ? -1 : (k * ny + j) * nx + i;
  };
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const e1 = new Vector3();
  const e2 = new Vector3();
  for (const src of sources) {
    const pos = src.getAttribute('position');
    const idx = src.index;
    const count = idx ? idx.count : pos.count;
    for (let t = 0; t + TRI - 1 < count; t += TRI) {
      a.fromBufferAttribute(pos, idx ? idx.getX(t) : t);
      b.fromBufferAttribute(pos, idx ? idx.getX(t + 1) : t + 1);
      c.fromBufferAttribute(pos, idx ? idx.getX(t + 2) : t + 2);
      // Skip triangles wholly outside the grid; sample the rest at half-voxel spacing, clipped to the grid.
      if (Math.max(a.x, b.x, c.x) < min.x || Math.min(a.x, b.x, c.x) > max.x || Math.max(a.y, b.y, c.y) < min.y || Math.min(a.y, b.y, c.y) > max.y || Math.max(a.z, b.z, c.z) < min.z || Math.min(a.z, b.z, c.z) > max.z) continue;
      e1.subVectors(b, a);
      e2.subVectors(c, a);
      const steps = Math.min(AO.maxSamplesPerEdge, Math.ceil((Math.max(e1.length(), e2.length()) * 2) / voxel));
      for (let i = 0; i <= steps; i++) {
        for (let j = 0; j <= steps - i; j++) {
          const s = i / steps;
          const r = j / steps;
          const at = cell(a.x + e1.x * s + e2.x * r, a.y + e1.y * s + e2.y * r, a.z + e1.z * s + e2.z * r);
          if (at >= 0) grid[at] = 1;
        }
      }
    }
  }
  const pos = geometry.getAttribute('position');
  const nor = geometry.getAttribute('normal');
  let col = geometry.getAttribute('color');
  if (!col) {
    col = new BufferAttribute(new Float32Array(pos.count * XYZ).fill(1), XYZ);
    geometry.setAttribute('color', col);
  }
  const n = new Vector3();
  const tx = new Vector3();
  const ty = new Vector3();
  const o = new Vector3();
  const steps = Math.max(1, Math.round(reach / voxel));
  for (let v = 0; v < pos.count; v++) {
    n.fromBufferAttribute(nor, v).normalize();
    tx.set(Math.abs(n.y) < FLOOR_NORMAL_Y ? 0 : 1, Math.abs(n.y) < FLOOR_NORMAL_Y ? 1 : 0, 0).cross(n).normalize();
    ty.crossVectors(n, tx);
    o.fromBufferAttribute(pos, v).addScaledVector(n, voxel * AO.lift);
    let occ = 0;
    for (const [rx, ry, rz] of RAYS) {
      const dx = tx.x * rx + ty.x * ry + n.x * rz;
      const dy = tx.y * rx + ty.y * ry + n.y * rz;
      const dz = tx.z * rx + ty.z * ry + n.z * rz;
      for (let s = 1; s <= steps; s++) {
        const d = s * voxel;
        const at = cell(o.x + dx * d, o.y + dy * d, o.z + dz * d);
        if (at >= 0 && grid[at]) {
          occ += 1 - (s - 1) / steps;
          break;
        }
      }
    }
    let f = 1 - AO.concave * (occ / RAYS.length) * strength;
    if (n.y < AO.downFacing) f *= 1 - AO.underside * strength;
    if (opts.ground && Math.abs(n.y) < AO.wallNormalY) {
      const h = pos.getY(v) - opts.ground(pos.getX(v), pos.getZ(v));
      if (h >= 0) {
        f *= 1 - AO.contact * strength * Math.max(0, 1 - h / AO.contactBand);
        f *= 1 - AO.damp * strength * Math.max(0, 1 - h / AO.dampBand);
      }
    }
    col.setXYZ(v, col.getX(v) * f, col.getY(v) * f, col.getZ(v) * f);
  }
  col.needsUpdate = true;
}
