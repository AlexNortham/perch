/**
 * The map blockout: every MapData prim merged into one mesh per material group, plus readable overlays for the map's
 * features (lane ribbons, Updraft cables and stations, Chimney shafts, Vines, shop zones, structure placeholders)
 * and a decorative forest beyond the bounds. Pure Three.js (no DOM), so it builds in unit tests too.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import type { Material } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BlockoutPrim, MapData, MaterialTag, Vec3 } from '../../sim/core/contracts';
import {
  BACKDROP,
  CABLE_RADIUS,
  CABLE_SEGMENTS_PER_POINT,
  CHIMNEY_OPACITY,
  CHIMNEY_RADIUS,
  CYLINDER_SEGMENTS,
  LANE_LIFT,
  LANE_OPACITY,
  MARKER_PLINTH_HEIGHT,
  MARKER_PLINTH_SCALE,
  PRIM_FOOT_MIN_HEIGHT,
  PRIM_FOOT_SHADE,
  PRIM_JITTER,
  SHOP_CANOPY,
  SHOP_RING_LIFT,
  SHOP_RING_WIDTH,
  STATION_POST_RADIUS,
  STATION_RING_RADIUS,
  STATION_RING_TUBE,
  STRUCTURE_MARKERS,
  TEAM_EMISSIVE,
  TORUS_SEGMENTS,
  TRUNK_SEGMENTS,
  UPDRAFT_HEIGHT,
  VINE_DEPTH,
  VINE_WIDTH,
  WATER_EMISSIVE,
} from './constants';
import { ENV_COLOURS, LANE_COLOURS, MATERIAL_COLOURS, TEAM_COLOURS } from './palette';

export interface Blockout {
  /** Everything built from the map; add it to the scene. */
  readonly root: Group;
  /** Structure-anchor placeholders; hide them once the world spawns real structures. */
  readonly markers: Object3D;
  dispose(): void;
}

/** Prims merge into one mesh per group: most tags share a matte material; water and team colours have their own. */
type PrimGroup = 'matte' | 'water' | 'dawn' | 'dusk';
const groupOf = (tag: MaterialTag): PrimGroup => (tag === 'water' || tag === 'dawn' || tag === 'dusk' ? tag : 'matte');

const UP = new Vector3(0, 1, 0);
const HALF = 0.5;
const SEGMENTS_ROUND = 48;
const ROOST_SCALE = 1.5;
const PILLAR_SIDES = 6;
const CAP_HEIGHT_RATIO = 0.25;
const HASH_A = 12.9898;
const HASH_B = 43758.5453;
const XYZ = 3;
const WHITE = 0xffffff;
const WHITE_COLOUR = new Color(WHITE);
const SHOP_CANOPY_SIDES = 4;
/** Ramps in local unit space (see RampPrim): floor at y −½, slope rising from local −z to the top edge at +z. */
const WEDGE = (() => {
  const [l, h] = [-HALF, HALF];
  const A = [l, l, l], B = [h, l, l], C = [h, l, h], D = [l, l, h], E = [l, h, h], F = [h, h, h];
  const tris = [A, B, C, A, C, D, D, C, F, D, F, E, A, F, B, A, E, F, A, D, E, B, F, C];
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(tris.flat()), XYZ));
  return g;
})();
const BOX = new BoxGeometry(1, 1, 1);
const CYLINDER = new CylinderGeometry(1, 1, 1, CYLINDER_SEGMENTS);

/** Deterministic 0..1 noise from an integer (stable colours and tree placement between runs). */
const hash = (n: number): number => {
  const s = Math.sin(n * HASH_A) * HASH_B;
  return s - Math.floor(s);
};
const v3 = (p: Vec3): Vector3 => new Vector3(p.x, p.y, p.z);
const yawQuat = (yaw: number): Quaternion => new Quaternion().setFromAxisAngle(UP, yaw);
const trs = (pos: Vector3, q: Quaternion, scale: Vector3): Matrix4 => new Matrix4().compose(pos, q, scale);

/**
 * A flat-shaded, vertex-coloured copy of `template` placed by `m`: non-indexed with face normals (faceted look, no
 * derivative shading) and a darker foot on tall pieces (cheap ambient occlusion).
 */
function piece(template: BufferGeometry, m: Matrix4, hex: number, shade = 1, foot = false): BufferGeometry {
  const g = template.index ? template.toNonIndexed() : template.clone();
  for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
  g.applyMatrix4(m);
  g.computeVertexNormals();
  const pos = g.getAttribute('position');
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    minY = Math.min(minY, pos.getY(i));
    maxY = Math.max(maxY, pos.getY(i));
  }
  const height = maxY - minY;
  const footShade = foot && height >= PRIM_FOOT_MIN_HEIGHT;
  const c = new Color(hex).multiplyScalar(shade);
  const colours = new Float32Array(pos.count * XYZ);
  for (let i = 0; i < pos.count; i++) {
    const f = footShade ? PRIM_FOOT_SHADE + (1 - PRIM_FOOT_SHADE) * ((pos.getY(i) - minY) / height) : 1;
    colours.set([c.r * f, c.g * f, c.b * f], i * XYZ);
  }
  g.setAttribute('color', new BufferAttribute(colours, XYZ));
  return g;
}

function primPiece(p: BlockoutPrim, index: number): BufferGeometry {
  const shade = 1 + (hash(index) * 2 - 1) * PRIM_JITTER;
  const colour = MATERIAL_COLOURS[p.material];
  if (p.shape === 'cylinder') {
    const m = trs(v3(p.centre), new Quaternion(), new Vector3(p.radius, p.height, p.radius));
    return piece(CYLINDER, m, colour, shade, true);
  }
  const m = trs(v3(p.centre), yawQuat(p.yaw), v3(p.size));
  return piece(p.shape === 'box' ? BOX : WEDGE, m, colour, shade, true);
}

/** A straight cylinder from a to b. */
function strut(a: Vector3, b: Vector3, radius: number, hex: number, sides = CABLE_SEGMENTS_PER_POINT): BufferGeometry {
  const dir = b.clone().sub(a);
  const q = new Quaternion().setFromUnitVectors(UP, dir.clone().normalize());
  const mid = a.clone().add(b).multiplyScalar(HALF);
  return piece(new CylinderGeometry(1, 1, 1, sides, 1, true), trs(mid, q, new Vector3(radius, dir.length(), radius)), hex);
}

/** A flat ribbon of half-width `hw` along a polyline, mitred at the joints, facing up. */
function ribbon(path: readonly Vec3[], hw: number, lift: number, hex: number): BufferGeometry | null {
  if (path.length < 2) return null;
  const dir = (a: Vec3, b: Vec3): Vector3 => new Vector3(b.x - a.x, 0, b.z - a.z).normalize();
  const perp = (v: Vector3): Vector3 => new Vector3(v.z, 0, -v.x);
  // Mitred offsets: along the bisector of the two segments, lengthened so the width stays hw on both.
  const side = path.map((p, k) => {
    const prev = path[k - 1];
    const next = path[k + 1];
    const seg = next ? dir(p, next) : prev ? dir(prev, p) : new Vector3(0, 0, 1);
    const along = (prev ? dir(prev, p) : seg.clone()).add(next ? seg : dir(prev ?? p, p)).normalize();
    const n = perp(along);
    return n.multiplyScalar(hw / Math.max(HALF, n.dot(perp(seg))));
  });
  const verts: number[] = [];
  for (let k = 0; k + 1 < path.length; k++) {
    const [p, q, sp, sq] = [path[k], path[k + 1], side[k], side[k + 1]];
    if (!p || !q || !sp || !sq) continue;
    const L = (o: Vec3, s: Vector3, sign: number): number[] => [o.x + s.x * sign, o.y + lift, o.z + s.z * sign];
    const [pl, pr, ql, qr] = [L(p, sp, 1), L(p, sp, -1), L(q, sq, 1), L(q, sq, -1)];
    verts.push(...pl, ...pr, ...qr, ...pl, ...qr, ...ql);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(verts), XYZ));
  // Winding follows the path direction, so the material is double-sided.
  return piece(g, new Matrix4(), hex);
}

function updraftPieces(map: MapData): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  for (const u of map.updrafts) {
    for (let k = 0; k + 1 < u.points.length; k++) {
      const a = u.points[k];
      const b = u.points[k + 1];
      if (a && b) out.push(strut(v3(a), v3(b), CABLE_RADIUS, ENV_COLOURS.rope));
    }
    for (const s of u.stations) {
      const top = v3(s);
      out.push(strut(top.clone().setY(s.y - UPDRAFT_HEIGHT), top, STATION_POST_RADIUS, ENV_COLOURS.timberDark));
      const ring = new TorusGeometry(STATION_RING_RADIUS, STATION_RING_TUBE, TORUS_SEGMENTS.radial, TORUS_SEGMENTS.tubular);
      out.push(piece(ring, trs(top, new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2), new Vector3(1, 1, 1)), ENV_COLOURS.rope));
    }
  }
  return out;
}

function vinePieces(map: MapData): BufferGeometry[] {
  return map.climbs
    .filter((c) => c.kind === 'vine')
    .map((c) => {
      const height = Math.max(0, c.top.y - c.bottom.y);
      const centre = v3(c.bottom).add(v3(c.top)).multiplyScalar(HALF).addScaledVector(v3(c.out), VINE_DEPTH * HALF);
      const yaw = Math.atan2(c.out.x, c.out.z);
      return piece(BOX, trs(centre, yawQuat(yaw), new Vector3(VINE_WIDTH, height, VINE_DEPTH)), ENV_COLOURS.hedge, 1, true);
    });
}

function shopPieces(map: MapData): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  const flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
  for (const s of map.shops) {
    const colours = TEAM_COLOURS[s.team];
    const at = v3(s.pos);
    const ring = new RingGeometry(s.radius - SHOP_RING_WIDTH, s.radius, SEGMENTS_ROUND);
    out.push(piece(ring, trs(at.clone().setY(s.pos.y + SHOP_RING_LIFT), flat, new Vector3(1, 1, 1)), colours.primary));
    const k = s.kind === 'roost' ? ROOST_SCALE : 1;
    const postTop = at.clone().setY(s.pos.y + SHOP_CANOPY.post * k);
    out.push(strut(at, postTop, STATION_POST_RADIUS * k, ENV_COLOURS.timber));
    const cone = new ConeGeometry(SHOP_CANOPY.radius * k, SHOP_CANOPY.height * k, SHOP_CANOPY_SIDES);
    const conePos = postTop.clone().setY(postTop.y + (SHOP_CANOPY.height * k) / 2);
    out.push(piece(cone, trs(conePos, yawQuat(s.yaw + Math.PI / SHOP_CANOPY_SIDES), new Vector3(1, 1, 1)), colours.light));
  }
  return out;
}

function markerPieces(map: MapData): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  for (const s of map.structures) {
    const { radius, height } = STRUCTURE_MARKERS[s.type];
    const colours = TEAM_COLOURS[s.team];
    const base = v3(s.pos);
    const plinth = trs(base.clone().setY(s.pos.y + MARKER_PLINTH_HEIGHT / 2), new Quaternion(), new Vector3(radius * MARKER_PLINTH_SCALE, MARKER_PLINTH_HEIGHT, radius * MARKER_PLINTH_SCALE));
    out.push(piece(CYLINDER, plinth, MATERIAL_COLOURS.stone, 1));
    const pillarH = height * (1 - CAP_HEIGHT_RATIO);
    const pillar = new CylinderGeometry(radius * (1 - CAP_HEIGHT_RATIO), radius, 1, PILLAR_SIDES);
    out.push(piece(pillar, trs(base.clone().setY(s.pos.y + MARKER_PLINTH_HEIGHT + pillarH / 2), yawQuat(s.yaw), new Vector3(1, pillarH, 1)), colours.primary, 1, true));
    const capH = height * CAP_HEIGHT_RATIO;
    const cap = new ConeGeometry(radius, capH, PILLAR_SIDES);
    out.push(piece(cap, trs(base.clone().setY(s.pos.y + MARKER_PLINTH_HEIGHT + pillarH + capH / 2), yawQuat(s.yaw), new Vector3(1, 1, 1)), colours.light));
  }
  return out;
}

function lambert(opts: ConstructorParameters<typeof MeshLambertMaterial>[0]): MeshLambertMaterial {
  return new MeshLambertMaterial({ vertexColors: true, ...opts });
}

/** Merge pieces into one mesh, or nothing if there are none. */
function merged(parts: BufferGeometry[], material: Material, name: string, cast = true): Mesh | null {
  if (parts.length === 0) {
    material.dispose();
    return null;
  }
  const geometry = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

/** Per-tree random draws (see hash): salts for each property. */
const TREE = { place: 0, jitter: 1, height: 2, radius: 3, canopy: 4, spin: 5, green: 6, stride: 7 } as const;

/**
 * Rings of giant trees around the bounds and a floor to the horizon (decoration only). Tree size and spacing scale with the
 * map's depth up to BACKDROP.refDepth, so a small test map sits in a clearing rather than a wall of trunks.
 */
function backdrop(map: MapData): Object3D[] {
  const { min, max } = map.bounds;
  const floorMat = new MeshLambertMaterial({ color: ENV_COLOURS.moss });
  const floor = new Mesh(new PlaneGeometry(BACKDROP.floorSize, BACKDROP.floorSize), floorMat);
  floor.name = 'backdrop-floor';
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((min.x + max.x) / 2, BACKDROP.floorY, (min.z + max.z) / 2);
  floor.receiveShadow = true;

  const k = Math.min(1, Math.max(BACKDROP.minScale, (max.z - min.z) / BACKDROP.refDepth));
  const spacing = BACKDROP.treeSpacing * k;
  const spots: { x: number; z: number }[] = [];
  for (let r = 0; r < BACKDROP.rings; r++) {
    const o = BACKDROP.margin + r * BACKDROP.ringSpacing * k;
    const [x0, x1, z0, z1] = [min.x - o, max.x + o, min.z - o, max.z + o];
    const sides = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]] as const;
    for (const [ax, az, bx, bz] of sides) {
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / spacing));
      for (let i = 0; i < n; i++) {
        const id = spots.length * TREE.stride;
        const t = (i + hash(id + TREE.place) * BACKDROP.scatter) / n;
        const j = (hash(id + TREE.jitter) - HALF) * BACKDROP.scatter * spacing;
        spots.push({ x: ax + (bx - ax) * t + j, z: az + (bz - az) * t + j });
      }
    }
  }
  const pick = (range: { min: number; max: number }, id: number): number => (range.min + (range.max - range.min) * hash(id)) * k;
  const trunks = new InstancedMesh(piece(new CylinderGeometry(1, 1, 1, TRUNK_SEGMENTS), new Matrix4(), WHITE), lambert({}), spots.length);
  const canopies = new InstancedMesh(piece(new IcosahedronGeometry(1, 0), new Matrix4(), WHITE), lambert({}), spots.length);
  const greens = [ENV_COLOURS.canopy, ENV_COLOURS.pine, ENV_COLOURS.hedge].map((h) => new Color(h));
  const bark = [ENV_COLOURS.timberDark, MATERIAL_COLOURS.trunk].map((h) => new Color(h));
  const still = new Quaternion();
  spots.forEach((s, i) => {
    const id = i * TREE.stride;
    const h = pick(BACKDROP.trunkHeight, id + TREE.height);
    const r = pick(BACKDROP.trunkRadius, id + TREE.radius);
    const cr = pick(BACKDROP.canopyRadius, id + TREE.canopy);
    trunks.setMatrixAt(i, trs(new Vector3(s.x, h / 2, s.z), still, new Vector3(r, h, r)));
    const cy = h + cr * BACKDROP.canopySquash * (HALF - BACKDROP.canopySink);
    const spin = yawQuat(hash(id + TREE.spin) * Math.PI);
    canopies.setMatrixAt(i, trs(new Vector3(s.x, cy, s.z), spin, new Vector3(cr, cr * BACKDROP.canopySquash, cr)));
    canopies.setColorAt(i, greens[Math.floor(hash(id + TREE.green) * greens.length)] ?? WHITE_COLOUR);
    trunks.setColorAt(i, bark[i % bark.length] ?? WHITE_COLOUR);
  });
  // Receive only: their long evening shadows would darken both bases.
  trunks.receiveShadow = true;
  canopies.receiveShadow = true;
  trunks.name = 'backdrop-trunks';
  canopies.name = 'backdrop-canopies';
  return [floor, trunks, canopies];
}

export function buildBlockout(map: MapData): Blockout {
  const root = new Group();
  root.name = 'blockout';

  const byGroup: Record<PrimGroup, BufferGeometry[]> = { matte: [], water: [], dawn: [], dusk: [] };
  map.prims.forEach((p, i) => byGroup[groupOf(p.material)].push(primPiece(p, i)));
  const emissive = (hex: number, k: number) => ({ emissive: hex, emissiveIntensity: k });
  const meshes = [
    merged(byGroup.matte, lambert({}), 'prims'),
    merged(byGroup.water, lambert(emissive(MATERIAL_COLOURS.water, WATER_EMISSIVE)), 'prims-water', false),
    merged(byGroup.dawn, lambert(emissive(TEAM_COLOURS.dawn.primary, TEAM_EMISSIVE)), 'prims-dawn'),
    merged(byGroup.dusk, lambert(emissive(TEAM_COLOURS.dusk.primary, TEAM_EMISSIVE)), 'prims-dusk'),
    merged([...updraftPieces(map), ...vinePieces(map), ...shopPieces(map)], lambert({}), 'features'),
  ];

  const lanes = map.lanes.flatMap((l) => ribbon(l.path, l.halfWidth, LANE_LIFT, LANE_COLOURS[l.id]) ?? []);
  const laneMat = lambert({ transparent: true, opacity: LANE_OPACITY, depthWrite: false, side: DoubleSide, forceSinglePass: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  meshes.push(merged(lanes, laneMat, 'lanes', false));

  const chimneys = map.climbs
    .filter((c) => c.kind === 'chimney')
    .map((c) => strut(v3(c.bottom), v3(c.top), CHIMNEY_RADIUS, ENV_COLOURS.warmAir, CYLINDER_SEGMENTS));
  const airMat = lambert({ transparent: true, opacity: CHIMNEY_OPACITY, depthWrite: false, side: DoubleSide, forceSinglePass: true, emissive: ENV_COLOURS.warmAir, emissiveIntensity: HALF });
  meshes.push(merged(chimneys, airMat, 'chimneys', false));

  const markerMesh = merged(markerPieces(map), lambert({}), 'structure-markers');
  const markers = markerMesh ?? new Object3D();
  for (const m of meshes) if (m) root.add(m);
  root.add(markers, ...backdrop(map));

  return {
    root,
    markers,
    dispose() {
      root.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          (o.material as Material).dispose();
        }
      });
    },
  };
}
