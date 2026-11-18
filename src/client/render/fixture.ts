/* eslint-disable @typescript-eslint/no-magic-numbers -- authored test-map data, like src/sim/world/map/data (D-BUILD-009) */
/**
 * The renderer's own test map: a small slice of the GDD §6 layout with every feature the blockout draws (buildings
 * with flat and gabled roofs, ramps, giant trunks, hedges, stilt houses, a river, base walls, lanes, Updrafts with
 * stations, Chimneys, Vines, shops and every structure anchor). Authored for the Dawn half and mirrored like the
 * real map. Used by blockout.test.ts and, in dev builds, by `?scene=blockout&renderFixture` in place of 'main'.
 * Not the real map: that is the Level Designer's (src/sim/world/map).
 */
import type {
  BlockoutPrim,
  Climb,
  Lane,
  LaneId,
  MapData,
  MaterialTag,
  ShopAnchor,
  StructureAnchor,
  Updraft,
  Vec3,
} from '../../sim/core/contracts';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const box = (c: Vec3, s: Vec3, material: MaterialTag, yaw = 0, solid = true): BlockoutPrim => ({ shape: 'box', centre: c, size: s, yaw, material, solid });
const ramp = (c: Vec3, s: Vec3, material: MaterialTag, yaw = 0): BlockoutPrim => ({ shape: 'ramp', centre: c, size: s, yaw, material, solid: true });
const cyl = (c: Vec3, radius: number, height: number, material: MaterialTag, solid = true): BlockoutPrim => ({ shape: 'cylinder', centre: c, radius, height, material, solid });

/** A building: walls plus a flat walkable roof slab or a gable of two ramps, turned by yaw. */
function house(x: number, z: number, w: number, d: number, h: number, wall: MaterialTag, roof: 'flat' | 'gable', yaw = 0, y0 = 0): BlockoutPrim[] {
  const out = [box(v(x, y0 + h / 2, z), v(w, h, d), wall, yaw)];
  const top = y0 + h;
  if (roof === 'flat') return [...out, box(v(x, top + 0.2, z), v(w + 0.6, 0.4, d + 0.6), 'roof', yaw)];
  const rh = Math.min(w, d) * 0.35;
  const off = d / 4;
  const [s, c] = [Math.sin(yaw), Math.cos(yaw)];
  return [
    ...out,
    ramp(v(x - off * s, top + rh / 2, z - off * c), v(w + 0.6, rh, d / 2 + 0.3), 'roof', yaw),
    ramp(v(x + off * s, top + rh / 2, z + off * c), v(w + 0.6, rh, d / 2 + 0.3), 'roof', yaw + Math.PI),
  ];
}

/** A giant trunk rising into a canopy disc (GDD §14.1). */
const tree = (x: number, z: number, r: number, h: number): BlockoutPrim[] => [
  cyl(v(x, h / 2, z), r, h, 'trunk'),
  cyl(v(x, h + 1, z), r * 3.2, 5, 'foliage', false),
  cyl(v(x, h + 4.5, z), r * 2.2, 3, 'foliage', false),
];

/** A pine: trunk and three shrinking foliage tiers. */
const pine = (x: number, z: number): BlockoutPrim[] => [
  cyl(v(x, 7, z), 0.8, 14, 'trunk'),
  cyl(v(x, 9, z), 4, 3, 'foliage', false),
  cyl(v(x, 12.5, z), 3, 3, 'foliage', false),
  cyl(v(x, 16, z), 1.8, 3, 'foliage', false),
];

/** A timber house on four stilts with a platform 6 m up. */
function stilts(x: number, z: number): BlockoutPrim[] {
  const legs = [-1, 1].flatMap((i) => [-1, 1].map((k) => cyl(v(x + i * 4, 3, z + k * 4), 0.4, 6, 'wood')));
  return [...legs, box(v(x, 6.25, z), v(11, 0.5, 11), 'wood'), ...house(x, z, 7, 7, 4, 'wood', 'gable', 0, 6.5)];
}

/** A lane road strip along a straight segment, turned to face along it. */
function road(a: Vec3, b: Vec3, width: number, material: MaterialTag = 'road'): BlockoutPrim {
  const [dx, dz] = [b.x - a.x, b.z - a.z];
  return box(v((a.x + b.x) / 2, 0.05, (a.z + b.z) / 2), v(width, 0.1, Math.hypot(dx, dz) + width / 2), material, Math.atan2(dx, dz));
}

// Lane paths, Dawn half (GDD §6.3); Pinewood mirrors Hedgerow in x.
const HEDGEROW = [v(-40, 0, -114), v(-95, 0, -80), v(-95, 0, 0)];
const RIVERBANK = [v(0, 0, -112), v(0, 0, 0)];
const PINEWOOD = HEDGEROW.map((p) => v(-p.x, p.y, p.z));

const DAWN_PRIMS: BlockoutPrim[] = [
  // Lanes
  road(HEDGEROW[0]!, HEDGEROW[1]!, 14), road(HEDGEROW[1]!, HEDGEROW[2]!, 14),
  road(PINEWOOD[0]!, PINEWOOD[1]!, 16), road(PINEWOOD[1]!, PINEWOOD[2]!, 16),
  road(RIVERBANK[0]!, RIVERBANK[1]!, 18, 'stone'),
  box(v(12, -0.05, -75), v(6, 0.3, 150), 'water'),
  // Base: walls with three 12 m gates, the Home Roost platform, the Patron's dais, ramps down from the roost
  box(v(-53, 4, -114), v(14, 8, 2), 'stone'), box(v(-20, 4, -114), v(28, 8, 2), 'stone'),
  box(v(20, 4, -114), v(28, 8, 2), 'stone'), box(v(53, 4, -114), v(14, 8, 2), 'stone'),
  box(v(-60, 4, -132), v(2, 8, 36), 'stone'), box(v(60, 4, -132), v(2, 8, 36), 'stone'),
  box(v(0, 4, -150), v(122, 8, 2), 'stone'),
  cyl(v(0, 1, -146), 10, 2, 'dawn'),
  cyl(v(0, 1.5, -136), 9, 3, 'stone'),
  ramp(v(-14, 1, -146), v(6, 2, 8), 'stone', Math.PI / 2), ramp(v(14, 1, -146), v(6, 2, 8), 'stone', -Math.PI / 2),
  // Hedgerow: kitchen-garden hedges and narrow terraced houses with balconies
  ...[-70, -50, -30].flatMap((z) => [box(v(-103, 0.6, z), v(1.2, 1.2, 10), 'foliage'), box(v(-87, 1.25, z - 12), v(1.2, 2.5, 8), 'foliage')]),
  ...[-60, -48, -36, -24].flatMap((z) => house(-110, z, 8, 11, 9, 'brick', 'gable', Math.PI / 2)),
  box(v(-105, 4, -42), v(2, 0.3, 30), 'wood'),
  // West jungle: a city block with walkable roofs, a ramp up and a courtyard trunk
  ...house(-60, -40, 12, 10, 8, 'stone', 'flat'), ...house(-45, -42, 10, 12, 12, 'brick', 'flat'),
  ...house(-58, -64, 14, 10, 6, 'wood', 'gable'), ...house(-40, -70, 10, 10, 10, 'stone', 'gable', 0.3),
  ramp(v(-60, 4, -50), v(6, 8, 10), 'wood', 0),
  ...tree(-30, -20, 3.5, 30),
  ...tree(-72, -100, 4, 34),
  // Riverbank: market square, mill and boardwalk
  box(v(-16, 0.08, -40), v(20, 0.16, 24), 'stone'),
  ...house(22, -40, 12, 10, 8, 'stone', 'gable'), cyl(v(16, 4, -32), 3, 0.6, 'wood'),
  box(v(-12, 0.3, -90), v(4, 0.6, 30), 'wood'),
  // East jungle and Pinewood: pines, stilt houses and a sawmill yard
  ...house(45, -42, 12, 12, 9, 'wood', 'flat'), ...house(60, -60, 10, 14, 7, 'brick', 'gable', Math.PI / 2),
  ...stilts(110, -50), ...stilts(110, -20),
  ...[[82, -60], [84, -30], [108, -85], [120, -70], [78, -95], [118, -5]].flatMap(([x, z]) => pine(x!, z!)),
  ...tree(30, -20, 3.5, 32),
  // Chimney stack beside the west block
  box(v(-30, 6, -42), v(3, 12, 3), 'brick'),
];

/** On z = 0: the Egg Perch plazas and the rune bridges over the side lanes (their own mirror images). */
const CENTRE_PRIMS: BlockoutPrim[] = [
  box(v(0, -0.5, 0), v(260, 1, 300), 'grass'),
  cyl(v(-50, 0.5, 0), 8, 1, 'stone'), cyl(v(50, 0.5, 0), 8, 1, 'stone'),
  box(v(-95, 6, 0), v(22, 0.6, 4), 'wood'), box(v(95, 6, 0), v(22, 0.6, 4), 'wood'),
  cyl(v(-107, 4, 0), 1, 8, 'stone'), cyl(v(-83, 4, 0), 1, 8, 'stone'),
  cyl(v(107, 4, 0), 1, 8, 'stone'), cyl(v(83, 4, 0), 1, 8, 'stone'),
];

const DAWN_CLIMBS: Climb[] = [
  { kind: 'chimney', bottom: v(-30, 0, -46), top: v(-30, 13, -46), out: v(0, 0, 0) },
  { kind: 'chimney', bottom: v(60, 0, -82), top: v(60, 12, -82), out: v(0, 0, 0) },
  { kind: 'vine', bottom: v(-45, 0, -48.1), top: v(-45, 12, -48.1), out: v(0, 0, -1) },
  { kind: 'vine', bottom: v(28.1, 0, -40), top: v(28.1, 8, -40), out: v(1, 0, 0) },
  { kind: 'vine', bottom: v(-66.1, 0, -40), top: v(-66.1, 8, -40), out: v(-1, 0, 0) },
];

const DAWN_SHOPS: ShopAnchor[] = [
  { team: 'dawn', kind: 'roost', pos: v(0, 2, -146), yaw: 0, radius: 10 },
  { team: 'dawn', kind: 'stall', pos: v(-105, 0, -58), yaw: 0, radius: 6 },
  { team: 'dawn', kind: 'stall', pos: v(10, 0, -60), yaw: 0, radius: 6 },
  { team: 'dawn', kind: 'stall', pos: v(105, 0, -58), yaw: 0, radius: 6 },
];

const anchor = (type: StructureAnchor['type'], lane: LaneId | null, x: number, z: number, y = 0): StructureAnchor => ({ team: 'dawn', type, lane, pos: v(x, y, z), yaw: 0 });
const DAWN_STRUCTURES: StructureAnchor[] = [
  anchor('patron', null, 0, -136, 3),
  anchor('shrine', null, -16, -126), anchor('shrine', null, 16, -126),
  ...([['hedgerow', -40, -114], ['riverbank', 0, -112], ['pinewood', 40, -114]] as const).flatMap(([lane, x, z]) => [
    anchor('warden', lane, x - 6, z + 4), anchor('warden', lane, x + 6, z + 4),
  ]),
  anchor('heron', 'hedgerow', -95, -75), anchor('heron', 'riverbank', 0, -80), anchor('heron', 'pinewood', 95, -75),
  anchor('hawk', 'hedgerow', -95, -35), anchor('hawk', 'riverbank', 0, -40), anchor('hawk', 'pinewood', 95, -35),
];

// Mirror rule (MapData docs): z → −z, yaw → π − yaw, Dawn ↔ Dusk.
const mz = (p: Vec3): Vec3 => v(p.x, p.y, -p.z);
const swapTag = (m: MaterialTag): MaterialTag => (m === 'dawn' ? 'dusk' : m === 'dusk' ? 'dawn' : m);
const mirrorPrim = (p: BlockoutPrim): BlockoutPrim =>
  p.shape === 'cylinder' ? { ...p, centre: mz(p.centre), material: swapTag(p.material) } : { ...p, centre: mz(p.centre), yaw: Math.PI - p.yaw, material: swapTag(p.material) };
const mirrorTeam = <T extends { team: 'dawn' | 'dusk'; pos: Vec3; yaw: number }>(a: T): T => ({ ...a, team: a.team === 'dawn' ? 'dusk' : 'dawn', pos: mz(a.pos), yaw: Math.PI - a.yaw });
/** A Dawn-half polyline continued through its mirror image to Dusk's end. */
const throughMirror = (half: readonly Vec3[]): Vec3[] => [...half, ...half.slice(0, -1).reverse().map(mz)];

const lane = (id: LaneId, half: Vec3[], halfWidth: number): Lane => ({ id, path: throughMirror(half), halfWidth });
const LANES: Lane[] = [lane('hedgerow', HEDGEROW, 7), lane('riverbank', RIVERBANK, 9), lane('pinewood', PINEWOOD, 8)];

const lift = (p: Vec3): Vec3 => v(p.x, p.y + 12, p.z);
const updraft = (l: Lane, stations: Vec3[]): Updraft => ({
  lane: l.id,
  points: l.path.map(lift),
  stations: [...stations, ...stations.filter((s) => s.z !== 0).map(mz)].map(lift),
});

export const FIXTURE_MAP: MapData = {
  id: 'main',
  name: 'Render fixture',
  bounds: { min: v(-130, -20, -150), max: v(130, 80, 150) },
  killY: -20,
  prims: [...CENTRE_PRIMS, ...DAWN_PRIMS, ...DAWN_PRIMS.map(mirrorPrim)],
  lanes: LANES,
  nav: { nodes: [], links: [] },
  updrafts: [
    updraft(LANES[0]!, [v(-40, 0, -114), v(-95, 0, -75), v(-95, 0, -35), v(-95, 0, 0)]),
    updraft(LANES[1]!, [v(0, 0, -112), v(0, 0, -80), v(0, 0, -40), v(0, 0, 0)]),
    updraft(LANES[2]!, [v(40, 0, -114), v(95, 0, -75), v(95, 0, -35), v(95, 0, 0)]),
  ],
  climbs: [...DAWN_CLIMBS, ...DAWN_CLIMBS.map((c) => ({ ...c, bottom: mz(c.bottom), top: mz(c.top), out: mz(c.out) }))],
  ledges: [],
  spawns: [],
  shops: [...DAWN_SHOPS, ...DAWN_SHOPS.map(mirrorTeam)],
  structures: [...DAWN_STRUCTURES, ...DAWN_STRUCTURES.map(mirrorTeam)],
  thickets: [],
  nests: [],
  runeSpots: [],
  eggPerches: [],
  hollow: null,
  botSpots: [],
};
