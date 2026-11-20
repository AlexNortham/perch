/**
 * Builders for authored map geometry, and the shape of an authored map. Authored coordinates live in this folder
 * (D-BUILD-009); src/sim/world/map/build.ts turns a MapSpec into MapData (mirroring, ledges, nav graph).
 */
import type {
  Anchor, BlockoutPrim, BoxPrim, BotSpot, BoxVolume, Building, CylinderPrim, InteractableAnchor, JungleZone, LaneId,
  MapId, MaterialTag, NavLinkKind, NestAnchor, Opening, RampPrim, Room, ShopAnchor, Spring, StructureAnchor, Team,
  ThicketAnchor, Vec3,
} from '../../../core/contracts';
import type { BuildingDress, PropAnchor } from '../dressing';
import * as dmath from '../../../core/dmath';

/** A climb as authored: the point on the wall face, and the horizontal unit direction from the climb into the
 * building it serves. `roof` is the height of the surface the climb tops out on. A ladder's "wall face" is the edge
 * of the hatch it climbs through; `in` points from the hatch onto the floor it lands on. */
export interface ClimbSpec {
  readonly kind: 'chimney' | 'vine' | 'ladder';
  readonly x: number;
  readonly z: number;
  readonly floor: number;
  readonly roof: number;
  readonly inX: number;
  readonly inZ: number;
}

/** An explicit nav link (hatch drops, Bough Springs); each end attaches to the nearest node. */
export interface LinkSpec {
  readonly from: Vec3;
  readonly to: Vec3;
  readonly kind: NavLinkKind;
  /** Index into the part's `springs`. */
  readonly spring?: number;
}

/** Content that is authored once. In `half` it is the Dawn half (z < 0) and is mirrored for Dusk; in `centre` it sits
 * on z = 0 and must be its own mirror image. Team-owned anchors in `half` belong to Dawn. Indices (`building`,
 * `rooms`, `camp`, `spring`) point into the part's own arrays; joinParts offsets them. */
export interface SpecPart {
  /** Geometry that also seeds the generated nav graph (corners, roofs, ramp ends). */
  readonly prims: readonly BlockoutPrim[];
  /** Building shells: geometry only; their nav comes from `nav` and `links`. */
  readonly fabric?: readonly BlockoutPrim[];
  readonly climbs: readonly ClimbSpec[];
  /** Extra nav waypoints; y is a height hint (the node snaps to the highest standable surface up to y + 0.5). */
  readonly nav: readonly Vec3[];
  readonly links?: readonly LinkSpec[];
  readonly nests: readonly NestAnchor[];
  readonly thickets: readonly ThicketAnchor[];
  /** Safe spots are Dawn's in `half`; ambush spots are neutral. */
  readonly botSpots: readonly Omit<BotSpot, 'team'>[];
  readonly buildings?: readonly Building[];
  readonly rooms?: readonly Room[];
  readonly openings?: readonly Opening[];
  readonly interactables?: readonly InteractableAnchor[];
  readonly springs?: readonly Spring[];
  readonly jungle?: readonly JungleZone[];
  /** Dressing descriptors (D-EP-047), parallel to `buildings`. */
  readonly dress?: readonly BuildingDress[];
  readonly props?: readonly PropAnchor[];
}

export const part = (p: Partial<SpecPart>): SpecPart => ({ prims: [], climbs: [], nav: [], nests: [], thickets: [], botSpots: [], ...p });

const shift = (i: number | undefined, by: number): number | undefined => (i === undefined || i < 0 ? i : i + by);

/** Concatenate parts, offsetting the indices of each part by the lengths of the ones before it. */
export function joinParts(...parts: readonly SpecPart[]): SpecPart {
  let out = part({});
  for (const p of parts) {
    const nb = out.buildings?.length ?? 0;
    const nr = out.rooms?.length ?? 0;
    const nt = out.thickets.length;
    const ns = out.springs?.length ?? 0;
    const inB = <T extends { building?: number }>(a: T): T => (a.building === undefined ? a : { ...a, building: shift(a.building, nb) });
    out = {
      prims: [...out.prims, ...p.prims],
      fabric: [...(out.fabric ?? []), ...(p.fabric ?? [])],
      climbs: [...out.climbs, ...p.climbs],
      nav: [...out.nav, ...p.nav],
      links: [...(out.links ?? []), ...(p.links ?? []).map((l) => (l.spring === undefined ? l : { ...l, spring: l.spring + ns }))],
      nests: [...out.nests, ...p.nests.map(inB)],
      thickets: [...out.thickets, ...p.thickets.map(inB)],
      botSpots: [...out.botSpots, ...p.botSpots],
      buildings: [...(out.buildings ?? []), ...(p.buildings ?? [])],
      rooms: [...(out.rooms ?? []), ...(p.rooms ?? []).map((r) => ({ ...r, building: shift(r.building, nb) ?? -1 }))],
      openings: [...(out.openings ?? []), ...(p.openings ?? []).map((o) => ({
        ...o, rooms: [shift(o.rooms[0], nr) ?? -1, shift(o.rooms[1], nr) ?? -1] as const,
      }))],
      interactables: [...(out.interactables ?? []), ...(p.interactables ?? []).map((a) => {
        const b = inB(a);
        return a.camp === undefined ? b : { ...b, camp: a.camp + nt };
      })],
      springs: [...(out.springs ?? []), ...(p.springs ?? [])],
      jungle: [...(out.jungle ?? []), ...(p.jungle ?? [])],
      dress: [...(out.dress ?? []), ...(p.dress ?? [])],
      props: [...(out.props ?? []), ...(p.props ?? [])],
    };
  }
  return out;
}

/** Add to a part in its own index space (`extra`'s indices already point into `base`): extras for a building. */
export function extend(base: SpecPart, extra: Partial<SpecPart>): SpecPart {
  const out: Record<string, unknown> = { ...base };
  for (const [k, list] of Object.entries(extra)) out[k] = [...((base as unknown as Record<string, readonly unknown[]>)[k] ?? []), ...(list as readonly unknown[])];
  return out as unknown as SpecPart;
}

/** Edit the dressing of the part's first building. */
export function patchDress(p: SpecPart, f: (d: BuildingDress) => BuildingDress): SpecPart {
  const [first, ...rest] = p.dress ?? [];
  return first ? { ...p, dress: [f(first), ...rest] } : p;
}

/** How a mirror moves things. `flips` is true for reflections (they reverse polygon winding). */
export interface PartMirror {
  readonly v: (p: Vec3) => Vec3;
  readonly yaw: (yaw: number) => number;
  /** Yaw of a box volume (boxes repeat every half turn); defaults to `yaw`. */
  readonly boxYaw?: (yaw: number) => number;
  readonly prim: (p: BlockoutPrim) => BlockoutPrim;
  readonly climb: (c: ClimbSpec) => ClimbSpec;
  /** Renames building, room-owner and jungle ids (lane ids and 'base' are kept). */
  readonly name: (id: string) => string;
  readonly team?: (t: Team) => Team;
  /** False for a pure rename: polygon winding is kept. Default true. */
  readonly flips?: boolean;
}

const LANE_ZONES: readonly string[] = ['hedgerow', 'riverbank', 'pinewood', 'base'];

/** A part's mirror image: geometry, anchors and records, indices unchanged. */
export function mirrorPart(p: SpecPart, m: PartMirror): SpecPart {
  const anchor = <T extends Anchor>(a: T): T => ({ ...a, pos: m.v(a.pos), yaw: m.yaw(a.yaw) });
  const box = (b: BoxVolume): BoxVolume => ({ ...b, centre: m.v(b.centre), yaw: (m.boxYaw ?? m.yaw)(b.yaw) });
  const zone = (z: string) => (LANE_ZONES.includes(z) ? z : m.name(z));
  return {
    prims: p.prims.map(m.prim),
    fabric: (p.fabric ?? []).map(m.prim),
    climbs: p.climbs.map(m.climb),
    nav: p.nav.map(m.v),
    links: (p.links ?? []).map((l) => ({ ...l, from: m.v(l.from), to: m.v(l.to) })),
    nests: p.nests.map(anchor),
    thickets: p.thickets.map(anchor),
    botSpots: p.botSpots.map((b) => ({ ...b, pos: m.v(b.pos) })),
    buildings: (p.buildings ?? []).map((b) => ({ ...b, id: m.name(b.id), zone: zone(b.zone), footprint: box(b.footprint) })),
    rooms: (p.rooms ?? []).map((r) => ({ ...r, volume: box(r.volume) })),
    openings: (p.openings ?? []).map((o) => ({ ...o, centre: m.v(o.centre), yaw: m.yaw(o.yaw) })),
    interactables: (p.interactables ?? []).map(anchor),
    springs: (p.springs ?? []).map((s) => ({ ...s, pad: m.v(s.pad), land: m.v(s.land) })),
    jungle: (p.jungle ?? []).map((j) => ({
      ...j, id: zone(j.id), half: m.team ? m.team(j.half) : j.half,
      outline: (m.flips ?? true) ? j.outline.map(m.v).reverse() : j.outline.map(m.v), paths: j.paths.map((path) => path.map(m.v)),
    })),
    dress: (p.dress ?? []).map((d) => ({
      ...d,
      marks: d.marks.map((k) => ({ ...k, centre: m.v(k.centre), yaw: m.yaw(k.yaw) })),
      balconies: d.balconies.map(box),
      landings: d.landings.map(box),
      stairs: d.stairs.map((st) => ({ ...st, from: m.v(st.from), to: m.v(st.to) })),
    })),
    props: (p.props ?? []).map((q) => ({ ...q, pos: m.v(q.pos), yaw: m.yaw(q.yaw), zone: zone(q.zone) })),
  };
}

/** −a without producing −0, so mirrored records compare equal to authored ones. */
export const neg = (a: number): number => (a === 0 ? 0 : -a);

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
  const centre = v(neg(p.centre.x), p.centre.y, p.centre.z);
  return p.shape === 'cylinder'
    ? { ...p, centre, material: material(p.material) }
    : { ...p, centre, yaw: neg(p.yaw), material: material(p.material) };
}

export const flipClimb = (c: ClimbSpec): ClimbSpec => ({ ...c, x: neg(c.x), inX: neg(c.inX) });
export const flipV = (p: Vec3): Vec3 => v(neg(p.x), p.y, p.z);

/** The same part with its building, room-owner and jungle ids renamed. */
export const renamePart = (p: SpecPart, name: (id: string) => string): SpecPart =>
  mirrorPart(p, { v: (q) => q, yaw: (y) => y, prim: (q) => q, climb: (c) => c, name, flips: false });

/** The east quarter: the west quarter mirrored in x, its brick and stone rebuilt in `material`. */
export const flipPart = (p: SpecPart, material: (m: MaterialTag) => MaterialTag, name: (id: string) => string): SpecPart =>
  mirrorPart(p, { v: flipV, yaw: neg, prim: (q) => flipX(q, material), climb: flipClimb, name });
