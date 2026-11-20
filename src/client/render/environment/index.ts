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
import { BatchedMesh, Box3, Group, Vector3 } from 'three';
import type { BufferGeometry, Camera, Material } from 'three';
import type { MapData } from '../../../sim/core/contracts';
import type { Quality } from '../../app/contracts';
import { getMaterialLibrary } from '../materials';
import type { MaterialLibrary } from '../materials';
import { BAND_REACH, LOD_HYSTERESIS } from './constants';
import type { Band } from './constants';
import { PASSES, World } from './world';
import type { Pass } from './world';
import { dressBuildings } from './data/buildings';
import { dressProps } from './data/props';
import { dressNature } from './data/nature';
import { dressObjectives } from './data/objectives';
import { dressInteriors } from './data/interiors';
import { dressWalls } from './data/walls';

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
  return world;
}

function batch(pass: Pass, geos: readonly { g: BufferGeometry; band: Band }[], lib: MaterialLibrary): { mesh: BatchedMesh; entries: Entry[] } {
  const verts = geos.reduce((s, { g }) => s + g.getAttribute('position').count, 0);
  const index = geos.reduce((s, { g }) => s + (g.index?.count ?? 0), 0);
  const mesh = new BatchedMesh(Math.max(1, geos.length), Math.max(1, verts), Math.max(1, index), pass === 'cutout' ? lib.cutout : lib.opaque);
  mesh.name = `environment-${pass}`;
  mesh.castShadow = pass === 'cast';
  mesh.receiveShadow = true;
  if (pass === 'cutout') mesh.customDepthMaterial = lib.cutoutDepth;
  // The batch spans the map; cells are culled one by one.
  mesh.frustumCulled = false;
  const entries = geos.map(({ g, band }) => {
    const id = mesh.addInstance(mesh.addGeometry(g));
    g.computeBoundingBox();
    const box = g.boundingBox?.clone() ?? new Box3();
    g.dispose();
    return { id, band, box, shown: true };
  });
  return { mesh, entries };
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
      for (const e of entries) {
        if (e.band === 2) continue;
        const d = e.box.distanceToPoint(cam);
        const r = e.band === 0 ? reach.near : reach.mid;
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
  };

  return {
    root,
    blockoutMap,
    stats: { triangles, total: triangles[0] + triangles[1] + triangles[2], cells: meshes.reduce((s, m) => s + m.instanceCount, 0) },
    setQuality(q) {
      lib = getMaterialLibrary(q);
      reach = BAND_REACH[q];
      for (const m of meshes) {
        m.material = m.name.endsWith('cutout') ? lib.cutout : lib.opaque;
        if (m.customDepthMaterial) m.customDepthMaterial = lib.cutoutDepth;
      }
    },
    dispose() {
      for (const m of meshes) m.dispose();
    },
  };
}
