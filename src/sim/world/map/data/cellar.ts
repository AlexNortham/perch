/**
 * Below ground in the Dawn half (GDD §6.9, §6.10, §7.15): the Cellar Run, a 4 m tunnel at y −4.5 from the west
 * Tavern's cellar to the east one under the Riverbank lane, the Magpie Den halfway (a neutral shop), the lane stairs
 * on each bank, the Tavern cellars and the Market Hall / Water Mill undercrofts with their passages to a street grate.
 * The ground of the half is carved around all of them.
 */
import type { BlockoutPrim, Opening, Room } from '../../../core/contracts';
import type { SpecPart } from './kit';
import { block, part, ramp, v } from './kit';
import type { Rect } from './interiors';
import { carve, innerRect, rect, slabOf, stairDress, volumeOf, WALL } from './interiors';
import { CELLAR_STAIR, GRATE, PASSAGE, TAVERN, UNDER_STAIR, UNDERCROFT } from './jungle';

const PI = Math.PI;
const FLOOR = -4.5;
/** The tunnel and the Den: 3.5 m clear under a 1 m roof. */
const TUNNEL_CEILING = -1;
/** Cellars and undercrofts: under the 0.4 m floor slab of the building above. */
const CELLAR_CEILING = -0.4;
const UNDER_FLOOR = -4;
const BEDROCK = -10.5;
const TUNNEL = { z0: -66, z1: -62, x: 46 } as const;
export const DEN = rect(-8, 8, -70, -58);
/** The lane stairs (GDD §6.10): west of the lane, and on the river's far bank, descending north to the tunnel. */
const LANE_STAIRS = [rect(-12, -10, -74, -66), rect(14, 16, -74, -66)] as const;

const flipRect = (r: Rect): Rect => rect(-r.x1, -r.x0, r.z0, r.z1);

interface Space {
  readonly r: Rect;
  readonly floor: number;
  /** null: open to the sky (the lane stairs). */
  readonly ceiling: number | null;
  readonly holes: readonly Rect[];
}

const tavernCellar = innerRect(TAVERN);
const SPACES: readonly Space[] = [
  ...[false, true].flatMap((east): Space[] => {
    const f = (r: Rect) => (east ? flipRect(r) : r);
    return [
      { r: f(tavernCellar), floor: FLOOR, ceiling: CELLAR_CEILING, holes: [f(CELLAR_STAIR)] },
      { r: f(rect(tavernCellar.x1, DEN.x0, TUNNEL.z0, TUNNEL.z1)), floor: FLOOR, ceiling: TUNNEL_CEILING, holes: [] },
      { r: f(UNDERCROFT), floor: UNDER_FLOOR, ceiling: CELLAR_CEILING, holes: [f(UNDER_STAIR)] },
      { r: f(PASSAGE), floor: UNDER_FLOOR, ceiling: CELLAR_CEILING, holes: [f(GRATE)] },
    ];
  }),
  { r: DEN, floor: FLOOR, ceiling: TUNNEL_CEILING, holes: [] },
  ...LANE_STAIRS.map((r) => ({ r, floor: FLOOR, ceiling: null, holes: [] })),
];

/** The carved region: every space lies inside it; the rest of the half is solid ground. */
const REGION = rect(-56, 56, -80, -26);
const HALF = rect(-130, 130, -150, -22);

/** The Dawn half's ground: solid outside the carve, floors and roofs over every space inside it. */
export const GROUND_HALF: BlockoutPrim[] = [
  ...carve(HALF, [REGION]).map((r) => slabOf(r, BEDROCK, 0, 'grass')),
  ...carve(REGION, SPACES.map((s) => s.r)).map((r) => slabOf(r, BEDROCK, 0, 'grass')),
  ...SPACES.flatMap((s) => [
    slabOf(s.r, BEDROCK, s.floor, 'ground'),
    ...(s.ceiling === null ? [] : carve(s.r, s.holes).map((r) => slabOf(r, s.ceiling ?? 0, 0, 'grass'))),
  ]),
];

/** Rooms: the Den first (so points in both resolve to it), then the tunnel. */
const ROOMS: Room[] = [
  { building: -1, storey: -1, volume: volumeOf(DEN, FLOOR, TUNNEL_CEILING) },
  { building: -1, storey: -1, tag: 'tunnel', volume: volumeOf(rect(-TUNNEL.x, TUNNEL.x, TUNNEL.z0, TUNNEL.z1), FLOOR, TUNNEL_CEILING) },
];
const R_DEN = 0;
const R_TUNNEL = 1;

const archCurtain = (x: number): BlockoutPrim => ({
  shape: 'box', material: 'foliage', solid: true, blocks: 'sight', yaw: 0,
  centre: v(x, (FLOOR + TUNNEL_CEILING) / 2, (TUNNEL.z0 + TUNNEL.z1) / 2), size: v(WALL, TUNNEL_CEILING - FLOOR, TUNNEL.z1 - TUNNEL.z0),
});

const OPENINGS: Opening[] = [
  // The lane stair heads come first: the Egg carrier is stopped at them (GDD §7.15).
  ...LANE_STAIRS.map((r): Opening => ({
    kind: 'door', rooms: [R_TUNNEL, -1], centre: v((r.x0 + r.x1) / 2, 1.5, r.z0), width: r.x1 - r.x0, height: 3, yaw: PI,
    passable: true, blocksEggCarrier: true,
  })),
  // The Den's arches, each behind ivy.
  ...[DEN.x0, DEN.x1].map((x): Opening => ({
    kind: 'arch', rooms: [R_TUNNEL, R_DEN], centre: v(x, (FLOOR + TUNNEL_CEILING) / 2, (TUNNEL.z0 + TUNNEL.z1) / 2),
    width: TUNNEL.z1 - TUNNEL.z0, height: TUNNEL_CEILING - FLOOR, yaw: x < 0 ? PI / 2 : -PI / 2, passable: true, curtain: true,
  })),
];

const RAIL_H = 1;

/** The Cellar Run of the Dawn half: rooms, stairs, the Den and its counter. */
export const CELLAR_RUN: SpecPart = part({
  fabric: [
    ...LANE_STAIRS.flatMap((r) => [
      ramp(r.x0, r.x1, r.z0, r.z1, FLOOR, 0, 's', 'stone'),
      block(r.x0 - WALL, r.x0, r.z0, r.z1, 0, RAIL_H, 'wood'),
      block(r.x1, r.x1 + WALL, r.z0, r.z1, 0, RAIL_H, 'wood'),
    ]),
    archCurtain(DEN.x0), archCurtain(DEN.x1),
    // The Den's counter along its north wall.
    block(-3, 3, DEN.z1 - 1.5, DEN.z1 - 1, FLOOR, FLOOR + 1.2, 'wood'),
  ],
  rooms: ROOMS,
  openings: OPENINGS,
  nav: [
    ...[-44, -36, -28, -20, -12, 12, 20, 28, 36, 44].map((x) => v(x, FLOOR, -64)),
    v(-4, FLOOR, -66), v(4, FLOOR, -66), v(0, FLOOR, -61), v(-5, FLOOR, -68.5), v(5, FLOOR, -68.5),
    ...LANE_STAIRS.flatMap((r) => [v((r.x0 + r.x1) / 2, 0, r.z0 - 1.5), v((r.x0 + r.x1) / 2, -2.25, (r.z0 + r.z1) / 2)]),
  ],
  props: [
    ...[-40, -30, -20, 20, 30, 40].map((x) => ({ kind: 'lantern' as const, pos: v(x, TUNNEL_CEILING - 0.6, TUNNEL.z1 - 0.2), yaw: PI, size: v(0.4, 0.6, 0.4), zone: 'cellar-run', solid: false })),
    { kind: 'seed-stall', pos: v(0, FLOOR, DEN.z1 - 1.25), yaw: PI, size: v(6, 2.4, 1.5), zone: 'cellar-run', solid: false },
    { kind: 'nest-pile', pos: v(-6, FLOOR, -59.5), yaw: 0, size: v(2, 1, 2), zone: 'cellar-run', solid: false },
    { kind: 'insect-hive', pos: v(6.5, FLOOR, -69), yaw: 0, size: v(1, 1.4, 1), zone: 'cellar-run', solid: false },
    { kind: 'worm-bed', pos: v(-24, FLOOR, -62.5), yaw: 0, size: v(3, 0.3, 0.8), zone: 'cellar-run', solid: false },
    // The lane stairs, for the dressing.
    ...LANE_STAIRS.map((r) => {
      const s = stairDress(r, 's', FLOOR, 0);
      return { kind: 'signpost' as const, pos: v(s.to.x, 0, s.to.z - 1), yaw: PI, size: v(0.3, 2.4, 0.3), zone: 'cellar-run', solid: false };
    }),
  ],
});

/** The neutral Magpie Den shop (GDD §7.15, §8.8): a 5 m zone at the Den's middle. */
export const DEN_SHOP = { kind: 'stall' as const, pos: v(0, FLOOR, -64), yaw: 0, radius: 5, neutral: true };
