/**
 * The map layer: every MapData prim drawn as bevelled, painted, AO-baked architecture from the material library
 * (style guide §4.3, §7), merged per 64 m cell (batch.ts), plus the map's features in the §1.4 affordance language
 * (paved lanes with kerbs, Updraft masts with pulley and pennant, flowering Vines in rope-wrapped frames, Chimney
 * shimmer, seed stalls at shops) and a forest of instanced giant trees beyond the bounds. Pure Three.js (no DOM),
 * so it builds in unit tests. The Environment Artist dresses over this; nothing here collides.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  TorusGeometry,
  Vector3,
} from 'three';
import type { Camera, Material } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BlockoutPrim, Climb, MapData, MaterialTag, PlayerTeam, Vec3 } from '../../sim/core/contracts';
import { CellBatch, LodInstances, updateBands } from './batch';
import { bakeAO, paint, retarget } from './materials';
import type { MaterialId, MaterialLibrary, PaintOptions } from './materials';
import { chamferBox, column, leafClump, stairs, trunk, tube, wedge } from './shapes';
import { ART, BACKDROP, CELL, SHADOW_PROXY_SIDES, CHIMNEY_RADIUS, LANE_ART, SHOP_ART, STATION_ART, SUN, UPDRAFT_HEIGHT, VINE_ART } from './constants';
import { SHIMMER_FRAGMENT, SHIMMER_VERTEX } from './shimmer';

export interface Blockout {
  /** Everything built from the map; add it to the scene. */
  readonly root: Group;
  /** Per frame: distance bands, instanced LOD and animated materials. */
  update(camera: Camera, seconds: number): void;
  /** Point every mesh at another quality's library (after a quality change). */
  setLibrary(lib: MaterialLibrary): void;
  dispose(): void;
}

type District = 'hedgerow' | 'riverbank' | 'pinewood' | 'dawn' | 'dusk';

/** What each district builds with (style guide §7.6). */
interface Palette {
  readonly stone: MaterialId;
  readonly stoneTint?: number;
  readonly brick: MaterialId;
  readonly wood: MaterialId;
  readonly roof: MaterialId;
  readonly gable: MaterialId;
  readonly paving: MaterialId;
}
const PALETTES: Readonly<Record<District, Palette>> = {
  hedgerow: { stone: 'ashlar', brick: 'brick', wood: 'timberDark', roof: 'roofClay', gable: 'brick', paving: 'flagstone' },
  riverbank: { stone: 'plaster', brick: 'brick', wood: 'timber', roof: 'roofSlate', gable: 'plaster', paving: 'flagstone' },
  pinewood: { stone: 'granite', brick: 'brickBurnt', wood: 'timberRed', roof: 'roofShingle', gable: 'timberRed', paving: 'cobble' },
  dawn: { stone: 'sandstone', brick: 'brick', wood: 'timber', roof: 'roofClay', gable: 'sandstone', paving: 'flagstone' },
  dusk: { stone: 'granite', stoneTint: ART.duskStoneTint, brick: 'brickBurnt', wood: 'timberDark', roof: 'roofSlate', gable: 'granite', paving: 'flagstone' },
};

const UP = new Vector3(0, 1, 0);
const XYZ = 3;
const TRI = 3;
const v3 = (p: Vec3): Vector3 => new Vector3(p.x, p.y, p.z);

/** Deterministic 0..1 from an integer (stable choices between runs). */
const hash = (n: number): number => {
  const s = Math.sin(n * ART.hashA) * ART.hashB;
  return s - Math.floor(s);
};

/** District of a point: inside a Home Roost, else the nearest lane. */
function districts(map: MapData): (x: number, z: number) => District {
  const roost = (team: PlayerTeam): Vector3 | null => {
    const s = map.spawns.filter((a) => a.team === team);
    if (s.length === 0) return null;
    return s.reduce((acc, a) => acc.add(v3(a.pos)), new Vector3()).divideScalar(s.length);
  };
  const bases = [['dawn', roost('dawn')], ['dusk', roost('dusk')]] as const;
  const segDist = (x: number, z: number, a: Vec3, b: Vec3): number => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / Math.max(dx * dx + dz * dz, ART.epsilon)));
    return Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
  };
  return (x, z) => {
    for (const [team, c] of bases) if (c && Math.hypot(x - c.x, z - c.z) < ART.baseRadius) return team;
    let best: District = 'riverbank';
    let bestD = Infinity;
    for (const l of map.lanes) {
      for (let k = 0; k + 1 < l.path.length; k++) {
        const a = l.path[k];
        const b = l.path[k + 1];
        if (!a || !b) continue;
        const d = segDist(x, z, a, b);
        if (d < bestD) {
          bestD = d;
          best = l.id;
        }
      }
    }
    return best;
  };
}

/** Whether a point lies inside any building's footprint (turned by its yaw), with ART.footprintMargin to spare. */
function footprints(map: MapData): (p: Vec3) => boolean {
  const boxes = (map.buildings ?? []).map((b) => b.footprint);
  return (p) =>
    boxes.some((f) => {
      const dx = p.x - f.centre.x;
      const dz = p.z - f.centre.z;
      const [c, s] = [Math.cos(f.yaw), Math.sin(f.yaw)];
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      const m = ART.footprintMargin;
      return Math.abs(lx) <= f.size.x / 2 + m && Math.abs(lz) <= f.size.z / 2 + m && p.y >= f.centre.y - f.size.y / 2 - m && p.y <= f.centre.y + f.size.y / 2 + m;
    });
}

/** Split a non-indexed geometry's triangles into those facing up (normal.y > minY) and the rest. */
function splitUp(g: BufferGeometry, minY: number): [BufferGeometry | null, BufferGeometry | null] {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const up: number[][] = [[], []];
  const side: number[][] = [[], []];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  for (let t = 0; t + TRI - 1 < pos.count; t += TRI) {
    a.fromBufferAttribute(pos, t);
    b.fromBufferAttribute(pos, t + 1);
    c.fromBufferAttribute(pos, t + 2);
    const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const into = n.y > minY ? up : side;
    for (let k = 0; k < TRI; k++) {
      into[0]?.push(pos.getX(t + k), pos.getY(t + k), pos.getZ(t + k));
      into[1]?.push(nor.getX(t + k), nor.getY(t + k), nor.getZ(t + k));
    }
  }
  const make = ([p, n]: number[][]): BufferGeometry | null => {
    if (!p || p.length === 0) return null;
    const out = new BufferGeometry();
    out.setAttribute('position', new BufferAttribute(new Float32Array(p), XYZ));
    out.setAttribute('normal', new BufferAttribute(new Float32Array(n ?? []), XYZ));
    return out;
  };
  g.dispose();
  return [make(up), make(side)];
}

interface Ctx {
  readonly batch: CellBatch;
  /** Trunk prims whose tops no foliage prim covers: they get a canopy. */
  readonly foliage: readonly BlockoutPrim[];
  readonly district: (x: number, z: number) => District;
  readonly toSun: Vector3;
  /** §11.6 Low: bevels in texture only, no trims or hedge fringes, sparser cards. */
  readonly low: boolean;
  /** Inside a building footprint: the environment layer's facades carry the trims there (its request, W5b). */
  readonly inBuilding: (p: Vec3) => boolean;
}

/** Paint and queue one piece; walls standing on something get the contact band and damp gradient. */
function put(ctx: Ctx, g: BufferGeometry | null, id: MaterialId, opts: PaintOptions & { ground?: number; band?: 'near' | 'mid' | 'far'; rays?: boolean; cast?: boolean } = {}): void {
  if (!g) return;
  const painted = paint(g, id, opts);
  if (opts.ground !== undefined) {
    const ground = opts.ground;
    bakeAO(painted, { rays: false, ground: () => ground });
  }
  ctx.batch.add(painted, { band: opts.band ?? 'far', ...(opts.rays !== undefined && { rays: opts.rays }), ...(opts.cast !== undefined && { cast: opts.cast }) });
}

/** A prim's transform: centre, yaw. */
const place = (g: BufferGeometry, centre: Vec3, yaw: number): BufferGeometry => g.rotateY(yaw).translate(centre.x, centre.y, centre.z);

/** Architectural trims (§5.1): plinth at the foot, string courses at each storey, a cornice at the top. */
function trims(ctx: Ctx, p: BlockoutPrim & { shape: 'box' }, seed: number, stone: MaterialId, tint: number | undefined): void {
  const { x: sx, y: sy, z: sz } = p.size;
  const bottom = p.centre.y - sy / 2;
  const band = (y0: number, h: number, out: number, id: MaterialId, k: number): void => {
    const g = chamferBox(sx + 2 * out, h, sz + 2 * out, { chamfer: ART.trimChamfer, segment: ART.hugeSegment });
    put(ctx, place(g, { x: p.centre.x, y: y0 + h / 2, z: p.centre.z }, p.yaw), id, { seed: seed + k, band: 'mid', ...(tint !== undefined && { tint }), cast: false, ground: y0 });
  };
  band(bottom, ART.plinth.height, ART.plinth.out, stone, 1);
  for (let y = ART.storey; y < sy - ART.cornice.height - ART.minTrimGap; y += ART.storey) band(bottom + y, ART.string.height, ART.string.out, stone, 2 + y);
  band(bottom + sy - ART.cornice.height, ART.cornice.height, ART.cornice.out, stone, ART.corniceSeed);
}

function boxPrim(ctx: Ctx, p: BlockoutPrim & { shape: 'box' }, i: number): void {
  const pal = PALETTES[ctx.district(p.centre.x, p.centre.z)];
  const { x: sx, y: sy, z: sz } = p.size;
  const minDim = Math.min(sx, sy, sz);
  const footprint = Math.min(sx, sz);
  const bottom = p.centre.y - sy / 2;
  const big = Math.max(sx, sz) > ART.hugePiece;
  const chamfer = ctx.low ? 0 : Math.max(ART.chamferMin, Math.min(ART.chamferMax, minDim * ART.chamferShare));
  const loops = sy >= ART.loopMinHeight ? [ART.contactLoop, ART.dampLoop] : [];
  const geo = (): BufferGeometry => place(chamferBox(sx, sy, sz, { chamfer, bottom: bottom > ART.groundEps, loops, ...(big && { segment: ART.hugeSegment }) }), p.centre, p.yaw);
  const tag: MaterialTag = p.material;
  const slab = sy < ART.slabHeight && footprint > ART.slabFootprint;
  const common = { seed: i, yaw: p.yaw, ground: bottom, ...(big && { rays: false }) } as const;
  switch (tag) {
    case 'grass': {
      const [top, side] = splitUp(geo(), ART.topNormalY);
      put(ctx, top, 'grass', { ...common, ground: undefined });
      put(ctx, side, 'earth', common);
      return;
    }
    case 'ground':
    case 'road': {
      const [top, side] = splitUp(geo(), ART.topNormalY);
      put(ctx, top, tag === 'road' ? pal.paving : 'earth', { ...common, ground: undefined });
      put(ctx, side, pal.stone, common);
      return;
    }
    case 'stone':
    case 'brick':
    case 'dawn':
    case 'dusk': {
      const id = tag === 'brick' ? pal.brick : pal.stone;
      const fade = tag === 'dawn' ? ART.dawnFaded : tag === 'dusk' ? ART.duskFaded : pal.stoneTint;
      const tint = fade;
      if (slab) {
        const [top, side] = splitUp(geo(), ART.topNormalY);
        put(ctx, top, 'flagstone', { ...common, ground: undefined, ...(tint !== undefined && { tint }) });
        put(ctx, side, id, { ...common, ...(tint !== undefined && { tint }) });
        return;
      }
      const thin = footprint < ART.thinWall;
      const [top, side] = splitUp(geo(), ART.topNormalY);
      // Wall tops grow moss (§5.8); broad tops are walkable flat roofs, paved.
      put(ctx, top, thin && p.centre.y + sy / 2 > ART.mossAbove ? 'moss' : 'flagstone', { ...common, ground: undefined });
      put(ctx, side, id, { ...common, ...(tint !== undefined && { tint }) });
      if (!ctx.low && !big && !ctx.inBuilding(p.centre) && sy >= ART.trimMinHeight && footprint >= ART.trimMinFootprint) trims(ctx, p, i * ART.seedStride, tag === 'brick' ? pal.stone : id, tint);
      return;
    }
    case 'wood': {
      const tall = sy > ART.postRatio * Math.max(sx, sz);
      if (sy < ART.boardHeight) {
        const [top, side] = splitUp(geo(), ART.topNormalY);
        put(ctx, top, 'boards', { ...common, ground: undefined });
        put(ctx, side, pal.wood, common);
        return;
      }
      put(ctx, geo(), pal.wood, { ...common, turn: tall });
      return;
    }
    case 'roof': {
      const [top, side] = splitUp(geo(), ART.topNormalY);
      put(ctx, top, pal.roof, { ...common, ground: undefined });
      put(ctx, side, pal.gable, common);
      return;
    }
    case 'metal':
      put(ctx, geo(), 'iron', common);
      return;
    case 'water':
      put(ctx, geo(), 'water', { ...common, ground: undefined, rays: false, cast: false });
      return;
    case 'foliage': {
      put(ctx, place(chamferBox(sx, sy, sz, { chamfer: Math.min(ART.hedgeChamfer, minDim / 2), bottom: false }), p.centre, p.yaw), 'hedge', { ...common, ground: bottom });
      if (!ctx.low) hedgeFringe(ctx, p, i);
      return;
    }
    case 'trunk':
      put(ctx, geo(), 'bark', common);
      return;
  }
}

/** A 10–15 cm fringe of leaf cards along a hedge's top edges (§6.2), so the box reads clipped, not solid. */
function hedgeFringe(ctx: Ctx, p: BlockoutPrim & { shape: 'box' }, seed: number): void {
  const { x: sx, y: sy, z: sz } = p.size;
  const parts: BufferGeometry[] = [];
  const perimeter = 2 * (sx + sz);
  const n = Math.min(ART.fringeMax, Math.ceil(perimeter / ART.fringeSpacing));
  for (let k = 0; k < n; k++) {
    const t = (k + hash(seed * ART.seedStride + k)) / n;
    let d = t * perimeter;
    let x = -sx / 2;
    let z = -sz / 2;
    if (d < sx) x += d;
    else if ((d -= sx) < sz) [x, z] = [sx / 2, z + d];
    else if ((d -= sz) < sx) [x, z] = [sx / 2 - d, sz / 2];
    else [x, z] = [-sx / 2, sz / 2 - (d - sx)];
    const { cards } = leafClump(ART.fringeSize, 2, seed * ART.seedStride + k, ctx.toSun, ART.fringeSize * 2);
    parts.push(cards.translate(x, sy / 2, z));
  }
  const merged = parts.length > 0 ? mergeGeometries(parts) : null;
  for (const g of parts) g.dispose();
  if (!merged) return;
  ctx.batch.add(paint(place(merged, p.centre, p.yaw), 'leafCard', { uv: 'keep', tint: ART.hedgeLeafTint }), { kind: 'cutout', cast: false });
}

function rampPrim(ctx: Ctx, p: BlockoutPrim & { shape: 'ramp' }, i: number): void {
  const pal = PALETTES[ctx.district(p.centre.x, p.centre.z)];
  const { x: sx, y: sy, z: sz } = p.size;
  const bottom = p.centre.y - sy / 2;
  if (p.material === 'roof') {
    const [top, side] = splitUp(place(wedge(sx, sy, sz), p.centre, p.yaw), ART.roofNormalY);
    put(ctx, top, pal.roof, { seed: i });
    put(ctx, side, pal.gable, { seed: i, ground: bottom });
    return;
  }
  const slope = Math.atan2(sy, sz);
  const id = p.material === 'wood' ? pal.wood : p.material === 'grass' ? 'earth' : pal.stone;
  if (slope > ART.stairMin && slope < ART.stairMax) {
    for (const s of stairs(sx, sy, sz)) put(ctx, place(s, p.centre, p.yaw), id, { seed: i, ground: bottom });
    return;
  }
  put(ctx, place(wedge(sx, sy, sz), p.centre, p.yaw), p.material === 'grass' ? 'grass' : id, { seed: i });
}

function cylinderPrim(ctx: Ctx, p: BlockoutPrim & { shape: 'cylinder' }, i: number): void {
  const pal = PALETTES[ctx.district(p.centre.x, p.centre.z)];
  const base = { x: p.centre.x, y: p.centre.y - p.height / 2, z: p.centre.z };
  if (p.material === 'trunk') {
    put(ctx, trunk(p.radius, p.height, i).translate(base.x, base.y, base.z), 'bark', { uv: 'cylinder', seed: i });
    const top = p.centre.y + p.height / 2;
    const covered = ctx.foliage.some((f) => f.shape === 'cylinder' && Math.hypot(f.centre.x - p.centre.x, f.centre.z - p.centre.z) < f.radius && f.centre.y + f.height / 2 > top);
    if (!covered) {
      const r = p.radius * ART.crownOfTrunk;
      canopy(ctx, { ...p, material: 'foliage', solid: false, radius: r, height: r * ART.crownHeight, centre: { x: p.centre.x, y: top + r * ART.crownLift, z: p.centre.z } }, i);
    }
    return;
  }
  if (p.material === 'foliage') {
    canopy(ctx, p, i);
    return;
  }
  const id: MaterialId = p.material === 'wood' ? pal.wood : p.material === 'water' ? 'water' : p.material === 'metal' ? 'iron' : pal.stone;
  put(ctx, column(p.radius, p.height).translate(base.x, base.y, base.z), id, { uv: 'cylinder', seed: i, ground: base.y, turn: p.material === 'wood' });
}

/** A decorative foliage cylinder becomes a canopy of leaf clumps (§6.1): cards with an opaque dark core each. */
function canopy(ctx: Ctx, p: BlockoutPrim & { shape: 'cylinder' }, i: number): void {
  const n = Math.max(ART.canopyMinClumps, Math.min(ART.canopyMaxClumps, Math.round((p.radius * p.height) / ART.canopyAreaPerClump)));
  const r = Math.min(p.radius * ART.clumpOfRadius, p.height * ART.clumpOfHeight);
  for (let k = 0; k < n; k++) {
    const s = i * ART.seedStride + k;
    const a = hash(s) * Math.PI * 2;
    const d = (p.radius - r) * Math.sqrt(hash(s + 1));
    const y = p.centre.y + (hash(s + 2) - 1 / 2) * Math.max(0, p.height - r);
    const count = Math.round(ART.cardsPerM2 * r * r * (ctx.low ? ART.lowCards : 1));
    const { cards, core } = leafClump(r, count, s, ctx.toSun, ART.canopyCard);
    const at = (g: BufferGeometry): BufferGeometry => g.translate(p.centre.x + Math.cos(a) * d, y, p.centre.z + Math.sin(a) * d);
    const tint = hash(s + ART.canopyTintSalt) < 1 / 2 ? ART.canopyTint : ART.canopyTintAlt;
    ctx.batch.add(paint(at(cards), 'leafCard', { uv: 'keep', tint }), { kind: 'cutout', cast: false });
    const placed = at(core);
    ctx.batch.add(placed.clone(), { kind: 'shadow' });
    put(ctx, placed, 'hedge', { tint: ART.coreTint, rays: false });
  }
}

/** The prim's plain shape for the shadow pass (floors, water and canopies cast nothing or cast through their cores). */
function shadowProxy(ctx: Ctx, p: BlockoutPrim): void {
  if (p.material === 'grass' || p.material === 'ground' || p.material === 'road' || p.material === 'water') return;
  if (p.shape === 'box') {
    ctx.batch.add(place(new BoxGeometry(p.size.x, p.size.y, p.size.z), p.centre, p.yaw), { kind: 'shadow' });
  } else if (p.shape === 'ramp') {
    const slope = Math.atan2(p.size.y, p.size.z);
    const steps = p.material !== 'roof' && slope > ART.stairMin && slope < ART.stairMax;
    for (const g of steps ? stairs(p.size.x, p.size.y, p.size.z) : [wedge(p.size.x, p.size.y, p.size.z)]) ctx.batch.add(place(g, p.centre, p.yaw), { kind: 'shadow' });
  } else if (p.material !== 'foliage') {
    ctx.batch.add(new CylinderGeometry(p.radius, p.radius, p.height, SHADOW_PROXY_SIDES).translate(p.centre.x, p.centre.y, p.centre.z), { kind: 'shadow' });
  }
}

/** Mitred side offsets of a lane path (half-width hw) at each point. */
function sides(path: readonly Vec3[], hw: number): Vector3[] {
  const dir = (a: Vec3, b: Vec3): Vector3 => new Vector3(b.x - a.x, 0, b.z - a.z).normalize();
  const perp = (v: Vector3): Vector3 => new Vector3(v.z, 0, -v.x);
  return path.map((p, k) => {
    const prev = path[k - 1];
    const next = path[k + 1];
    const seg = next ? dir(p, next) : prev ? dir(prev, p) : new Vector3(0, 0, 1);
    const along = (prev ? dir(prev, p) : seg.clone()).add(next ? seg : dir(prev ?? p, p)).normalize();
    const n = perp(along);
    return n.multiplyScalar(hw / Math.max(1 / 2, n.dot(perp(seg))));
  });
}

/** A paved strip across a lane from fraction `from` to `to` of its half-width (−1 left … 1 right), uv in metres. */
function laneStrip(path: readonly Vec3[], side: readonly Vector3[], hw: number, from: number, to: number, lift: number): BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  let along = 0;
  for (let k = 0; k + 1 < path.length; k++) {
    const [a, b, sa, sb] = [path[k], path[k + 1], side[k], side[k + 1]];
    if (!a || !b || !sa || !sb) continue;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(len / LANE_ART.segment));
    for (let j = 0; j < n; j++) {
      const pt = (t: number, f: number): number[] => {
        const s = sa.clone().lerp(sb, t);
        return [a.x + (b.x - a.x) * t + s.x * f, a.y + (b.y - a.y) * t + lift, a.z + (b.z - a.z) * t + s.z * f];
      };
      const [t0, t1] = [j / n, (j + 1) / n];
      const [v0, v1] = [along + len * t0, along + len * t1];
      const quad = [[t0, from, v0], [t1, from, v1], [t1, to, v1], [t0, from, v0], [t1, to, v1], [t0, to, v0]] as const;
      for (const [t, f, v] of quad) {
        pos.push(...pt(t, f));
        uv.push(f * hw, v);
      }
    }
    along += len;
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), XYZ));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  // Wound with the path, so face normals may point down: force them up (the strip is flat on the ground).
  g.setAttribute('normal', new BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % XYZ === 1 ? 1 : 0)), XYZ));
  return g;
}

/** Lanes (§2.5): calm paving down the middle, a kerb band of granite setts along both edges. */
function lanes(ctx: Ctx, map: MapData): void {
  for (const l of map.lanes) {
    // The Home Roosts have their own paving: the lane is paved only between them.
    const runs: Vec3[][] = [];
    let run: Vec3[] = [];
    for (let k = 0; k + 1 < l.path.length; k++) {
      const [a, b] = [l.path[k], l.path[k + 1]];
      if (!a || !b) continue;
      const d = ctx.district((a.x + b.x) / 2, (a.z + b.z) / 2);
      if (d === 'dawn' || d === 'dusk') {
        if (run.length > 1) runs.push(run);
        run = [];
        continue;
      }
      if (run.length === 0) run.push(a);
      run.push(b);
    }
    if (run.length > 1) runs.push(run);
    const kerb = 1 - LANE_ART.kerb / l.halfWidth;
    const paving = LANE_ART.paving[l.id] as MaterialId;
    for (const path of runs) {
      const side = sides(path, l.halfWidth);
      ctx.batch.add(paint(laneStrip(path, side, l.halfWidth, -kerb, kerb, LANE_ART.lift), paving, { uv: 'keep', tint: LANE_ART.tint }), { rays: false, cast: false });
      for (const [a, b] of [[-1, -kerb], [kerb, 1]] as const) {
        ctx.batch.add(paint(laneStrip(path, side, l.halfWidth, a, b, LANE_ART.lift + LANE_ART.kerbLift), 'cobble', { uv: 'keep', tint: LANE_ART.kerbTint }), { rays: false, cast: false });
      }
    }
  }
}

/** Updraft stations (§1.4): a tall timber mast with a crossarm, a brass pulley wheel and a feather pennant. */
function updrafts(ctx: Ctx, map: MapData): void {
  for (const u of map.updrafts) {
    for (let k = 0; k + 1 < u.points.length; k++) {
      const a = u.points[k];
      const b = u.points[k + 1];
      if (a && b) put(ctx, tube(v3(a), v3(b), STATION_ART.cable), 'rope', { uv: 'planar', rays: false, cast: false });
    }
    u.stations.forEach((s, k) => {
      const top = v3(s);
      const foot = top.y - UPDRAFT_HEIGHT;
      put(ctx, column(STATION_ART.mast, UPDRAFT_HEIGHT + STATION_ART.above).translate(top.x, foot, top.z), 'timberDark', { uv: 'cylinder', turn: true, ground: foot });
      put(ctx, chamferBox(STATION_ART.arm, STATION_ART.armSection, STATION_ART.armSection, { chamfer: ART.trimChamfer }).translate(top.x, top.y + STATION_ART.above * STATION_ART.armAt, top.z), 'timberDark', {});
      const wheel = new TorusGeometry(STATION_ART.wheel, STATION_ART.wheelTube, STATION_ART.wheelSides, STATION_ART.wheelSegments).toNonIndexed();
      put(ctx, wheel.rotateY(Math.PI / 2).translate(top.x, top.y + STATION_ART.wheelUp, top.z), 'brass', { uv: 'cylinder', cast: false });
      const pennant = new PlaneGeometry(STATION_ART.pennant.w, STATION_ART.pennant.h);
      pennant.rotateZ(-Math.PI / 2).translate(STATION_ART.pennant.h / 2, 0, 0);
      pennant.rotateY(hash(k + top.x) * Math.PI).translate(top.x, top.y + STATION_ART.above, top.z);
      ctx.batch.add(paint(pennant, 'featherCard', { uv: 'keep', tint: STATION_ART.pennantTint }), { kind: 'cutout', cast: false });
    });
  }
}

/** Vines (§1.4): a rope-wrapped frame with thick flowering stems (cream blossom), unmistakable at 40 m. */
function vines(ctx: Ctx, climbs: readonly Climb[]): void {
  climbs.filter((c) => c.kind === 'vine').forEach((c, i) => {
    const bottom = v3(c.bottom);
    const top = v3(c.top);
    const out = v3(c.out).setY(0).normalize();
    const across = new Vector3().crossVectors(UP, out).normalize();
    const h = top.y - bottom.y;
    for (const sg of [-1, 1]) {
      const at = bottom.clone().addScaledVector(across, (sg * VINE_ART.width) / 2).addScaledVector(out, VINE_ART.off);
      put(ctx, column(VINE_ART.post, h).translate(at.x, at.y, at.z), 'rope', { uv: 'cylinder', ground: bottom.y });
    }
    const leaves: BufferGeometry[] = [];
    const blossoms: BufferGeometry[] = [];
    for (let s = 0; s < VINE_ART.stems; s++) {
      const x0 = (s / (VINE_ART.stems - 1) - 1 / 2) * VINE_ART.width * VINE_ART.stemSpread;
      const n = Math.max(2, Math.ceil(h / VINE_ART.step));
      let prev = bottom.clone().addScaledVector(across, x0).addScaledVector(out, VINE_ART.off);
      for (let k = 1; k <= n; k++) {
        const y = (k / n) * h;
        const sway = Math.sin(y * VINE_ART.waveFreq + s * 2 + i) * VINE_ART.wave;
        const next = bottom.clone().addScaledVector(across, x0 + sway).addScaledVector(out, VINE_ART.off).setY(bottom.y + y);
        put(ctx, tube(prev, next, VINE_ART.stem), 'bark', { uv: 'cylinder', rays: false, cast: false, tint: VINE_ART.stemTint });
        const seed = (i * ART.seedStride + s) * ART.seedStride + k;
        const { cards } = leafClump(VINE_ART.clump, VINE_ART.cardsPerClump, seed, ctx.toSun, VINE_ART.leafCard);
        leaves.push(cards.translate(next.x, next.y, next.z));
        if (hash(seed) < VINE_ART.blossomChance) {
          const b = leafClump(VINE_ART.blossom, VINE_ART.blossomCards, seed + 1, ctx.toSun, VINE_ART.blossom * 2).cards;
          blossoms.push(b.translate(next.x, next.y, next.z).translate(out.x * VINE_ART.blossomOut, 0, out.z * VINE_ART.blossomOut));
        }
        prev = next;
      }
    }
    for (const [list, tint] of [[leaves, VINE_ART.leafTint], [blossoms, VINE_ART.blossomTint]] as const) {
      const g = list.length > 0 ? mergeGeometries(list) : null;
      for (const x of list) x.dispose();
      if (g) ctx.batch.add(paint(g, 'leafCard', { uv: 'keep', tint }), { kind: 'cutout', cast: false });
    }
  });
}

/** Seed stalls at shops (§5.6): four posts and a striped canvas awning in faded flock tint, a painted floor ring. */
function shops(ctx: Ctx, map: MapData): void {
  for (const s of map.shops) {
    const k = s.kind === 'roost' ? SHOP_ART.roostScale : 1;
    const at = v3(s.pos);
    const tint = s.team === 'dawn' ? ART.dawnFaded : ART.duskFaded;
    const half = (SHOP_ART.width * k) / 2;
    const q = new Quaternion().setFromAxisAngle(UP, s.yaw);
    for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const p = new Vector3(cx * half, 0, cz * half).applyQuaternion(q).add(at);
      put(ctx, column(SHOP_ART.post, SHOP_ART.height * k).translate(p.x, at.y, p.z), 'timber', { uv: 'cylinder', turn: true, ground: at.y });
    }
    const roofG = new CylinderGeometry(0, half * Math.SQRT2 * SHOP_ART.overhang, SHOP_ART.rise * k, SHOP_ART.awningSides, 1, true).toNonIndexed();
    roofG.rotateY(Math.PI / SHOP_ART.awningSides + s.yaw).translate(at.x, at.y + SHOP_ART.height * k + (SHOP_ART.rise * k) / 2, at.z);
    put(ctx, roofG, 'canvas', { tint, rays: false });
    put(ctx, flatRing(s.radius - SHOP_ART.ringWidth, s.radius).translate(at.x, at.y + SHOP_ART.ringLift, at.z), 'flagstone', { tint, rays: false, cast: false });
  }
}

/** A flat ring on the ground, facing up. */
function flatRing(inner: number, outer: number): BufferGeometry {
  const pos: number[] = [];
  const n = SHOP_ART.ringSides;
  for (let k = 0; k < n; k++) {
    const [a0, a1] = [(k / n) * Math.PI * 2, ((k + 1) / n) * Math.PI * 2];
    const p = (r: number, a: number): number[] => [Math.cos(a) * r, 0, -Math.sin(a) * r];
    pos.push(...p(inner, a0), ...p(outer, a0), ...p(outer, a1), ...p(inner, a0), ...p(outer, a1), ...p(inner, a1));
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), XYZ));
  g.computeVertexNormals();
  return g;
}

/** Chimneys (§1.4): a column of warm shimmer rising through the shaft (additive, never opaque). */
function chimneys(map: MapData): Mesh | null {
  const parts = map.climbs
    .filter((c) => c.kind === 'chimney')
    .map((c) => {
      const h = Math.max(0, c.top.y - c.bottom.y);
      const g = new CylinderGeometry(CHIMNEY_RADIUS, CHIMNEY_RADIUS, h, BACKDROP.shimmerSides, 1, true);
      return g.translate(c.bottom.x, c.bottom.y + h / 2, c.bottom.z);
    });
  if (parts.length === 0) return null;
  const g = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  const mat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColour: { value: new Color(BACKDROP.shimmerColour) }, uStrength: { value: BACKDROP.shimmerStrength } },
    vertexShader: SHIMMER_VERTEX,
    fragmentShader: SHIMMER_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: DoubleSide,
  });
  const mesh = new Mesh(g, mat);
  mesh.name = 'chimneys';
  mesh.renderOrder = 1;
  return mesh;
}

/**
 * The forest beyond the bounds (decoration only): a ground plane to the horizon and rings of giant trees, each an
 * instanced bark trunk and a canopy of leaf clumps. Sizes and spacing scale with the map's depth.
 */
function backdrop(map: MapData, lib: MaterialLibrary, toSun: Vector3, low: boolean): { objects: (Mesh | Group)[]; instances: LodInstances[] } {
  const { min, max } = map.bounds;
  const floorG = new PlaneGeometry(BACKDROP.floorSize, BACKDROP.floorSize).rotateX(-Math.PI / 2).toNonIndexed();
  floorG.translate((min.x + max.x) / 2, BACKDROP.floorY, (min.z + max.z) / 2);
  const floor = new Mesh(paint(floorG, 'grass', { tint: BACKDROP.floorTint }), lib.opaque);
  floor.name = 'backdrop-floor';
  floor.receiveShadow = true;
  floor.userData['budget'] = 'map';

  const k = Math.min(1, Math.max(BACKDROP.minScale, (max.z - min.z) / BACKDROP.refDepth));
  const spacing = BACKDROP.treeSpacing * k;
  const spots: { x: number; z: number }[] = [];
  for (let r = 0; r < BACKDROP.rings; r++) {
    const o = BACKDROP.margin + r * BACKDROP.ringSpacing * k;
    const [x0, x1, z0, z1] = [min.x - o, max.x + o, min.z - o, max.z + o];
    const edges = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]] as const;
    for (const [ax, az, bx, bz] of edges) {
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / spacing));
      for (let i = 0; i < n; i++) {
        const id = spots.length * BACKDROP.stride;
        const t = (i + hash(id) * BACKDROP.scatter) / n;
        const j = (hash(id + 1) - 1 / 2) * BACKDROP.scatter * spacing;
        spots.push({ x: ax + (bx - ax) * t + j, z: az + (bz - az) * t + j });
      }
    }
  }
  // Variants built at unit-ish size and instanced with a uniform scale (bark and leaves keep their proportions).
  const trunkG = paint(trunk(BACKDROP.trunkRadius, BACKDROP.trunkHeight, BACKDROP.trunkSeed), 'bark', { uv: 'cylinder' });
  const canopyParts = BACKDROP.clumps.map(({ x, y, z, r }, i) => {
    const { cards, core } = leafClump(r, Math.round(BACKDROP.cardsPerClump * (low ? ART.lowCards : 1)), BACKDROP.canopySeed + i, toSun, r * BACKDROP.cardOfClump * (low ? ART.lowCardGrow : 1));
    return { cards: cards.translate(x, y, z), core: core.translate(x, y, z) };
  });
  const cards = paint(mergeGeometries(canopyParts.map((c) => c.cards)), 'leafCard', { uv: 'keep', tint: BACKDROP.leafTint });
  const cores = paint(mergeGeometries(canopyParts.map((c) => c.core)), 'hedge', { tint: ART.coreTint });
  for (const c of canopyParts) {
    c.cards.dispose();
    c.core.dispose();
  }
  const trunks = new LodInstances([{ geometry: trunkG, maxDistance: Infinity }], lib.opaque, spots.length, { name: 'backdrop-trunks' });
  const leaves = new LodInstances([{ geometry: cards, maxDistance: Infinity }], lib.cutout, spots.length, { name: 'backdrop-canopy', depth: lib.cutoutDepth });
  const coreSet = new LodInstances([{ geometry: cores, maxDistance: Infinity }], lib.opaque, spots.length, { name: 'backdrop-cores' });
  const m = new Matrix4();
  const q = new Quaternion();
  const colour = new Color();
  spots.forEach((s, i) => {
    const id = i * BACKDROP.stride;
    const scale = k * (BACKDROP.scaleMin + (BACKDROP.scaleMax - BACKDROP.scaleMin) * hash(id + 2));
    q.setFromAxisAngle(UP, hash(id + BACKDROP.yawSalt) * Math.PI * 2);
    m.compose(new Vector3(s.x, 0, s.z), q, new Vector3(scale, scale, scale));
    trunks.add(m);
    colour.setScalar(BACKDROP.shadeMin + (1 - BACKDROP.shadeMin) * hash(id + BACKDROP.shadeSalt));
    leaves.add(m, colour.clone());
    coreSet.add(m);
  });
  return { objects: [floor], instances: [trunks, leaves, coreSet] };
}

export function buildBlockout(map: MapData, lib: MaterialLibrary): Blockout {
  const root = new Group();
  root.name = 'blockout';
  const toSun = new Vector3(SUN.azimuth.x * Math.cos(SUN.elevationDeg * ART.deg), Math.sin(SUN.elevationDeg * ART.deg), SUN.azimuth.z * Math.cos(SUN.elevationDeg * ART.deg)).normalize();
  const ctx: Ctx = { batch: new CellBatch(CELL.size, { shadowProxies: true }), foliage: map.prims.filter((p) => p.material === 'foliage' && p.shape === 'cylinder'), district: districts(map), toSun, low: lib.quality === 'low', inBuilding: footprints(map) };
  map.prims.forEach((p) => shadowProxy(ctx, p));
  map.prims.forEach((p, i) => {
    if (p.shape === 'box') boxPrim(ctx, p, i);
    else if (p.shape === 'ramp') rampPrim(ctx, p, i);
    else cylinderPrim(ctx, p, i);
  });
  lanes(ctx, map);
  updrafts(ctx, map);
  vines(ctx, map.climbs);
  shops(ctx, map);
  const mapRoot = ctx.batch.build(lib, 'map');
  root.add(mapRoot);
  const shimmer = chimneys(map);
  if (shimmer) root.add(shimmer);
  const back = backdrop(map, lib, toSun, ctx.low);
  root.add(...back.objects, ...back.instances.map((x) => x.root));
  return {
    root,
    update(camera, seconds) {
      updateBands(mapRoot, camera.position);
      for (const x of back.instances) x.update(camera);
      const time = shimmer ? (shimmer.material as ShaderMaterial).uniforms['uTime'] : undefined;
      if (time) time.value = seconds;
    },
    setLibrary(next) {
      retarget(root, next);
    },
    dispose() {
      root.traverse((o) => {
        if (o instanceof Mesh) {
          o.geometry.dispose();
          const m = o.material as Material;
          if (!m.userData['perchKind']) m.dispose();
        }
      });
      for (const x of back.instances) x.dispose();
    },
  };
}
