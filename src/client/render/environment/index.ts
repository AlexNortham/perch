/**
 * The environment layer (style guide §1, §4–§7, §11; D-EP-047, D-EP-048). Owner: Environment Artist. Builds the
 * visual town over the Level Designer's collision: facades, roofs, interiors, bird street life, the jungle and the
 * dressing around objectives, all painted with the shared material library (../materials).
 *
 * Everything is merged per 32 m cell and detail band, then drawn through three BatchedMeshes (opaque, opaque that
 * casts shadows, alpha-tested cards): three draw calls for the whole layer with WEBGL_multi_draw, per-cell frustum
 * culling, and per-cell LOD by distance (bands, constants.ts). Adds no collision (D-EP-047).
 *
 *   const env = buildEnvironment(map, 'medium');
 *   scene.add(env.root);
 *   const blockout = buildBlockout(env.blockoutMap);   // the map without the prims the environment re-skins
 */
import { BatchedMesh, Box3, BufferAttribute, BufferGeometry, DataUtils, Group, Matrix4, Quaternion, Vector3 } from 'three';
import type { Camera, Material } from 'three';
import type { MapData } from '../../../sim/core/contracts';
import type { Quality } from '../../app/contracts';
import { getMaterialLibrary } from '../materials';
import type { MaterialLibrary } from '../materials';
import { CAMERA } from '../../../sim/data/core';
import { BAND_REACH, CAMERA_CLEAR, LOD_HYSTERESIS } from './constants';
import type { Band } from './constants';
import { PASSES, World } from './world';
import type { Pass } from './world';
import { dressBuildings } from './data/buildings';
import { dressProps } from './data/props';
import { dressNature } from './data/nature';
import { dressObjectives } from './data/objectives';
import { dressInteriors } from './data/interiors';
import { dressWalls } from './data/walls';
import { dressLife } from './data/life';

export interface EnvironmentStats {
  /** Triangles per band (all cells), and in total. */
  readonly triangles: readonly [number, number, number];
  readonly total: number;
  readonly cells: number;
}

export interface Environment {
  readonly root: Group;
  /** The map for the blockout: without the prims and climbs the environment draws itself. */
  readonly blockoutMap: MapData;
  readonly stats: EnvironmentStats;
  setQuality(q: Quality): void;
  dispose(): void;
}

interface Entry {
  readonly id: number;
  readonly band: Band;
  readonly box: Box3;
  shown: boolean;
}

const EMPTY_DRESSING = { buildings: [], props: [] } as const;

/** Build every generator's geometry for the map (pure: no GL, runs in unit tests). */
export function generate(map: MapData): World {
  // The dressing descriptor (MapData.dressing, D-ARCH-028); a map without one gets bare generators.
  const world = new World(map, map.dressing ?? EMPTY_DRESSING);
  dressBuildings(world);
  dressInteriors(world);
  dressProps(world);
  dressNature(world);
  dressObjectives(world);
  dressWalls(world);
  dressLife(world);
  return world;
}

// ── Camera fade (visual-only dressing never sits between the camera and the hero) ───────────────────────────────

/**
 * The third-person camera looks along its boom past the hero: everything of this layer within `fade.near` m of the
 * camera, widening to `fade.far` m at the boom's far end (the hero, beside the view line by the shoulder offset),
 * is discarded, with a dithered rim so it fades rather than pops. The layer adds no collision, so anything there is
 * dressing the camera can pass through; the camera's own collision keeps walls out of that space.
 */
const FADE_UNIFORMS = {
  uFadeCam: { value: new Vector3() },
  uFadeDir: { value: new Vector3(0, 0, -1) },
  uFadeLen: { value: CAMERA.boomMax + 1 },
};
const FADE_DECL = /* glsl */ `
uniform vec3 uFadeCam;
uniform vec3 uFadeDir;
uniform float uFadeLen;
`;
const FADE_FRAG = /* glsl */ `
{
  vec3 fd = vMatWorld - uFadeCam;
  float ft = clamp( dot( fd, uFadeDir ), 0.0, uFadeLen );
  float fr = length( fd - uFadeDir * ft );
  float fR = mix( ${CAMERA_CLEAR.fade.near.toFixed(2)}, ${CAMERA_CLEAR.fade.far.toFixed(2)}, ft / uFadeLen );
  if ( dot( fd, uFadeDir ) < uFadeLen && fr < fR ) {
    float edge = clamp( ( fR - fr ) / ${CAMERA_CLEAR.fade.dither.toFixed(2)}, 0.0, 1.0 );
    float n = fract( sin( dot( floor( gl_FragCoord.xy ), vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
    if ( n < edge ) discard;
  }
}
#include <alphatest_fragment>
`;
const fadeCache = new WeakMap<Material, Material>();

/** The library material with the camera fade added (one clone per library material, shared by every batch). */
function fading(base: Material): Material {
  const hit = fadeCache.get(base);
  if (hit) return hit;
  const m = base.clone();
  m.defines = { ...base.defines };
  m.userData = { ...base.userData };
  const inner = base.onBeforeCompile.bind(base);
  m.onBeforeCompile = (shader, renderer) => {
    inner(shader, renderer);
    Object.assign(shader.uniforms, FADE_UNIFORMS);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FADE_DECL}`)
      .replace('#include <alphatest_fragment>', FADE_FRAG);
  };
  m.customProgramCacheKey = () => `${base.customProgramCacheKey()}:fade`;
  fadeCache.set(base, m);
  baseOf.set(m, base);
  return m;
}

/** Aim the fade along this frame's camera; keep the clone's environment map in step with the library's. */
function aimFade(camera: Camera, material: Material): void {
  FADE_UNIFORMS.uFadeCam.value.setFromMatrixPosition(camera.matrixWorld);
  FADE_UNIFORMS.uFadeDir.value.set(0, 0, -1).transformDirection(camera.matrixWorld);
  const base = baseOf.get(material);
  if (base && 'envMap' in base && 'envMap' in material && material.envMap !== base.envMap) {
    material.envMap = base.envMap;
    material.needsUpdate = true;
  }
}
const baseOf = new WeakMap<Material, Material>();

function batch(pass: Pass,geos: readonly { g: BufferGeometry; band: Band }[], lib: MaterialLibrary): { mesh: BatchedMesh; entries: Entry[] } {
  const verts = geos.reduce((s, { g }) => s + g.getAttribute('position').count, 0);
  const index = geos.reduce((s, { g }) => s + (g.index?.count ?? 0), 0);
  const mesh = new BatchedMesh(Math.max(1, geos.length), Math.max(1, verts), Math.max(1, index), fading(pass === 'cutout' ? lib.cutout : lib.opaque));
  mesh.name = `environment-${pass}`;
  mesh.castShadow = pass === 'cast';
  mesh.receiveShadow = true;
  if (pass === 'cutout') mesh.customDepthMaterial = lib.cutoutDepth;
  // The batch spans the map; cells are culled one by one.
  mesh.frustumCulled = false;
  const entries = geos.map(({ g, band }) => {
    g.computeBoundingBox();
    const box = g.boundingBox?.clone() ?? new Box3();
    const { geometry, matrix } = pack(g, box);
    const id = mesh.addInstance(mesh.addGeometry(geometry));
    mesh.setMatrixAt(id, matrix);
    geometry.dispose();
    g.dispose();
    return { id, band, box, shown: true };
  });
  // The batch copies the half-float uv bits as they are; tell WebGL what they are.
  const uv = mesh.geometry.getAttribute('uv') as unknown as { isFloat16BufferAttribute?: boolean } | undefined;
  if (uv) uv.isFloat16BufferAttribute = true;
  return { mesh, entries };
}

const INT16 = 32767;
const XYZ = 3;
/** An entry never packs to a smaller half-extent than this (m). */
const MIN_EXTENT = 0.01;
const _c = new Vector3();
const _s = new Vector3();

/**
 * Geometry memory (W7): each cell entry stores positions as Int16 normalised to its own bounds (the entry's batch
 * matrix scales them back; ≤ 6 mm steps on the longest entry) and uv as half floats, rebased by whole tiles per entry
 * so they stay small and exact (textures repeat by the tile). With Int8 normals and byte colour and layer: 17 bytes a
 * vertex, from 27.
 */
function pack(g: BufferGeometry, box: Box3): { geometry: BufferGeometry; matrix: Matrix4 } {
  box.getCenter(_c);
  box.getSize(_s);
  const e = Math.max(_s.x, _s.y, _s.z, MIN_EXTENT) / 2;
  const src = g.getAttribute('position');
  const pos = new Int16Array(src.count * XYZ);
  for (let i = 0; i < src.count; i++) {
    pos[i * XYZ] = Math.round(((src.getX(i) - _c.x) / e) * INT16);
    pos[i * XYZ + 1] = Math.round(((src.getY(i) - _c.y) / e) * INT16);
    pos[i * XYZ + 2] = Math.round(((src.getZ(i) - _c.z) / e) * INT16);
  }
  const uvSrc = g.getAttribute('uv');
  let du = 0;
  let dv = 0;
  for (let i = 0; i < uvSrc.count; i++) {
    du += uvSrc.getX(i);
    dv += uvSrc.getY(i);
  }
  du = Math.round(du / Math.max(1, uvSrc.count));
  dv = Math.round(dv / Math.max(1, uvSrc.count));
  const uv = new Uint16Array(uvSrc.count * 2);
  for (let i = 0; i < uvSrc.count; i++) {
    uv[i * 2] = DataUtils.toHalfFloat(uvSrc.getX(i) - du);
    uv[i * 2 + 1] = DataUtils.toHalfFloat(uvSrc.getY(i) - dv);
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute(pos, XYZ, true));
  out.setAttribute('normal', g.getAttribute('normal'));
  out.setAttribute('uv', new BufferAttribute(uv, 2));
  out.setAttribute('color', g.getAttribute('color'));
  out.setAttribute('matLayer', g.getAttribute('matLayer'));
  if (g.index) out.setIndex(g.index);
  return { geometry: out, matrix: new Matrix4().compose(_c, new Quaternion(), new Vector3(e, e, e)) };
}

export function buildEnvironment(map: MapData, quality: Quality): Environment {
  const world = generate(map);
  let lib = getMaterialLibrary(quality);
  let reach = BAND_REACH[quality];
  const root = new Group();
  root.name = 'environment';
  // Its own §11.3 category: the batch geometry holds every cell and band, so mesh-level counts are capacity, not drawn.
  root.userData['budget'] = 'environment';
  const triangles: [number, number, number] = [0, 0, 0];
  const meshes: BatchedMesh[] = [];
  for (const pass of PASSES) {
    const geos: { g: BufferGeometry; band: Band }[] = [];
    for (const b of world.buckets.values()) {
      if (b.pass !== pass) continue;
      triangles[b.band] += b.mesher.triangles;
      const g = b.mesher.build();
      if (g) geos.push({ g, band: b.band });
    }
    if (geos.length === 0) continue;
    const { mesh, entries } = batch(pass, geos, lib);
    const cam = new Vector3();
    const cull = mesh.onBeforeRender.bind(mesh);
    // Per-cell LOD before the batch's own culling (the shadow pass reuses the last frame's choice).
    mesh.onBeforeRender = (renderer, scene, camera: Camera, geometry, material: Material, group) => {
      cam.setFromMatrixPosition(camera.matrixWorld);
      aimFade(camera, mesh.material as Material);
      for (const e of entries) {
        if (e.band === 2 && (pass !== 'cutout' || reach.cards === Infinity)) continue;
        const d = e.box.distanceToPoint(cam);
        const r = e.band === 0 ? reach.near : e.band === 1 ? reach.mid : reach.cards;
        const show = e.shown ? d < r * (1 + LOD_HYSTERESIS) : d < r * (1 - LOD_HYSTERESIS);
        if (show !== e.shown) {
          e.shown = show;
          mesh.setVisibleAt(e.id, show);
        }
      }
      cull(renderer, scene, camera, geometry, material, group);
    };
    meshes.push(mesh);
    root.add(mesh);
  }
  world.buckets.clear();

  const covered = world.covered;
  const blockoutMap: MapData = {
    ...map,
    prims: map.prims.filter((_, i) => !covered.has(i)),
    // Vines are drawn as flowering vines in rope frames (§1.4).
    climbs: map.climbs.filter((c) => c.kind !== 'vine'),
    // Updraft stations are the environment's woven masts; the blockout keeps the cables.
    updrafts: map.updrafts.map((u) => ({ ...u, stations: [] })),
  };

  return {
    root,
    blockoutMap,
    stats: { triangles, total: triangles[0] + triangles[1] + triangles[2], cells: meshes.reduce((s, m) => s + m.instanceCount, 0) },
    setQuality(q) {
      lib = getMaterialLibrary(q);
      reach = BAND_REACH[q];
      for (const m of meshes) {
        m.material = fading(m.name.endsWith('cutout') ? lib.cutout : lib.opaque);
        if (m.customDepthMaterial) m.customDepthMaterial = lib.cutoutDepth;
      }
    },
    dispose() {
      for (const m of meshes) m.dispose();
    },
  };
}
