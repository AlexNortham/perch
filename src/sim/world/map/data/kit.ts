/**
 * Builders for authored map geometry, and the shape of an authored map. Authored coordinates live in this folder
 * (D-BUILD-009); src/sim/world/map/build.ts turns a MapSpec into MapData (mirroring, ledges, nav graph).
 */
import type {
  Anchor, BlockoutPrim, BoxPrim, BotSpot, CylinderPrim, LaneId, MapId, MaterialTag, RampPrim, ShopAnchor,
  StructureAnchor, ThicketAnchor, Vec3,
} from '../../../core/contracts';
import * as dmath from '../../../core/dmath';

/** A climb as authored: the point on the wall face, and the horizontal unit direction from the climb into the
 * building it serves. `roof` is the height of the surface the climb tops out on. */
export interface ClimbSpec {
  readonly kind: 'chimney' | 'vine';
  readonly x: number;
  readonly z: number;
  readonly floor: number;
  readonly roof: number;
  readonly inX: number;
  readonly inZ: number;
}

/** Content that is authored once. In `half` it is the Dawn half (z < 0) and is mirrored for Dusk; in `centre` it sits
 * on z = 0 and must be its own mirror image. Team-owned anchors in `half` belong to Dawn. */
export interface SpecPart {
  readonly prims: readonly BlockoutPrim[];
  readonly climbs: readonly ClimbSpec[];
  /** Extra nav waypoints; y is a height hint (the node snaps to the highest standable surface up to y + 0.5). */
  readonly nav: readonly Vec3[];
  readonly nests: readonly Anchor[];
  readonly thickets: readonly ThicketAnchor[];
  /** Safe spots are Dawn's in `half`; ambush spots are neutral. */
  readonly botSpots: readonly Omit<BotSpot, 'team'>[];
}

export interface MapSpec {
  readonly id: MapId;
  readonly name: string;
  readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
  readonly killY: number;
  readonly half: SpecPart & {
    /** Each lane from Dawn's gate to its z = 0 crossing. */
    readonly lanes: readonly { readonly id: LaneId; readonly path: readonly Vec3[]; readonly halfWidth: number }[];
    readonly spawns: readonly Anchor[];
    readonly shops: readonly Omit<ShopAnchor, 'team'>[];
    readonly structures: readonly Omit<StructureAnchor, 'team'>[];
  };
  readonly centre: SpecPart & {
    readonly runeSpots: readonly Anchor[];
    readonly eggPerches: readonly Anchor[];
    readonly hollow: { readonly centre: Vec3; readonly radius: number; readonly floorY: number } | null;
  };
}

export type Side = 'n' | 's' | 'e' | 'w';

const YAW: Record<Side, number> = { n: 0, s: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 };

export const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const at = (x: number, y: number, z: number, yaw = 0): Anchor => ({ pos: v(x, y, z), yaw });

/** Axis-aligned box from its extents. */
export function block(
  x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, material: MaterialTag, solid = true,
): BoxPrim {
  return {
    shape: 'box', material, solid, yaw: 0,
    centre: v((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), size: v(x1 - x0, y1 - y0, z1 - z0),
  };
}

/** Box from a ground centre, footprint w × d (d along the yaw), turned by yaw. */
export function slab(
  x: number, z: number, w: number, d: number, y0: number, y1: number, yaw: number, material: MaterialTag, solid = true,
): BoxPrim {
  return { shape: 'box', material, solid, yaw, centre: v(x, (y0 + y1) / 2, z), size: v(w, y1 - y0, d) };
}

/** Axis-aligned ramp from its extents, rising from y0 to y1 toward `up`. */
export function ramp(
  x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, up: Side, material: MaterialTag,
): RampPrim {
  const alongX = up === 'e' || up === 'w';
  return {
    shape: 'ramp', material, solid: true, yaw: YAW[up],
    centre: v((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
    size: alongX ? v(z1 - z0, y1 - y0, x1 - x0) : v(x1 - x0, y1 - y0, z1 - z0),
  };
}

export function column(
  x: number, z: number, radius: number, y0: number, y1: number, material: MaterialTag, solid = true,
): CylinderPrim {
  return { shape: 'cylinder', material, solid, centre: v(x, (y0 + y1) / 2, z), radius, height: y1 - y0 };
}

/** Roof slab thickness on flat roofs; gables pitch at 50° (too steep to walk). */
const ROOF_SLAB = 0.4;
const GABLE_PITCH = dmath.tan((50 * Math.PI) / 180);

/** A building standing on y0 with its walkable top (flat) or eaves (gable) at h. */
export function house(
  x0: number, x1: number, z0: number, z1: number, y0: number, h: number, material: MaterialTag, roof: 'flat' | 'gable',
): BlockoutPrim[] {
  if (roof === 'flat') return [block(x0, x1, z0, z1, y0, h - ROOF_SLAB, material), block(x0, x1, z0, z1, h - ROOF_SLAB, h, 'roof')];
  const body = block(x0, x1, z0, z1, y0, h, material);
  if (x1 - x0 <= z1 - z0) {
    const xm = (x0 + x1) / 2;
    const rise = (xm - x0) * GABLE_PITCH;
    return [body, ramp(x0, xm, z0, z1, h, h + rise, 'e', 'roof'), ramp(xm, x1, z0, z1, h, h + rise, 'w', 'roof')];
  }
  const zm = (z0 + z1) / 2;
  const rise = (zm - z0) * GABLE_PITCH;
  return [body, ramp(x0, x1, z0, zm, h, h + rise, 'n', 'roof'), ramp(x0, x1, zm, z1, h, h + rise, 's', 'roof')];
}

const YARD_WALL = 1;
const YARD_GAP = 4;

/** A square walled yard (GDD §6.5 Thickets) centred on (cx, cz), with a 4 m entrance in the middle of each side in
 * `gaps`. */
export function yard(cx: number, cz: number, size: number, gaps: readonly Side[], material: MaterialTag, h = 3): BoxPrim[] {
  const r = size / 2;
  const [x0, x1, z0, z1] = [cx - r, cx + r, cz - r, cz + r];
  const t = YARD_WALL;
  const g = YARD_GAP / 2;
  const out: BoxPrim[] = [];
  const side = (s: Side, ax0: number, ax1: number, az0: number, az1: number, alongX: boolean) => {
    if (!gaps.includes(s)) {
      out.push(block(ax0, ax1, az0, az1, 0, h, material));
    } else if (alongX) {
      out.push(block(ax0, cx - g, az0, az1, 0, h, material), block(cx + g, ax1, az0, az1, 0, h, material));
    } else {
      out.push(block(ax0, ax1, az0, cz - g, 0, h, material), block(ax0, ax1, cz + g, az1, 0, h, material));
    }
  };
  side('n', x0, x1, z1 - t, z1, true);
  side('s', x0, x1, z0, z0 + t, true);
  side('w', x0, x0 + t, z0 + t, z1 - t, false);
  side('e', x1 - t, x1, z0 + t, z1 - t, false);
  return out;
}

/** A tree: solid trunk, crown the hero can stand under (not solid). */
export function tree(x: number, z: number, trunk: number, height: number, crown: number, crownFrom: number): BlockoutPrim[] {
  return [column(x, z, trunk, 0, height, 'trunk'), column(x, z, crown, crownFrom, height, 'foliage', false)];
}

/** Stilts under a platform x0..x1 × z0..z1 at height top, inset from the corners. */
export function stilts(x0: number, x1: number, z0: number, z1: number, top: number): CylinderPrim[] {
  const inset = 0.5;
  const r = 0.35;
  return [
    column(x0 + inset, z0 + inset, r, 0, top, 'trunk'), column(x1 - inset, z0 + inset, r, 0, top, 'trunk'),
    column(x0 + inset, z1 - inset, r, 0, top, 'trunk'), column(x1 - inset, z1 - inset, r, 0, top, 'trunk'),
  ];
}

export const vine = (x: number, z: number, roof: number, inX: number, inZ: number, floor = 0): ClimbSpec =>
  ({ kind: 'vine', x, z, floor, roof, inX, inZ });
export const chimney = (x: number, z: number, roof: number, inX: number, inZ: number, floor = 0): ClimbSpec =>
  ({ kind: 'chimney', x, z, floor, roof, inX, inZ });

/** x → −x copies (yaw → −yaw), for the east jungle, which reuses the west jungle's block plan. */
export function flipX(p: BlockoutPrim, material: (m: MaterialTag) => MaterialTag = (m) => m): BlockoutPrim {
  const centre = v(-p.centre.x, p.centre.y, p.centre.z);
  return p.shape === 'cylinder'
    ? { ...p, centre, material: material(p.material) }
    : { ...p, centre, yaw: p.yaw === 0 ? 0 : -p.yaw, material: material(p.material) };
}

export const flipClimb = (c: ClimbSpec): ClimbSpec => ({ ...c, x: -c.x, inX: -c.inX });
export const flipV = (p: Vec3): Vec3 => v(-p.x, p.y, p.z);
