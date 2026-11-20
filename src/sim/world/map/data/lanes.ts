/**
 * Lane-side content of the Dawn half (GDD §6.4, §6.8–6.10, feel gaps G19 and G20): Hedgerow's terraces (four
 * enterable houses west, three east) and the Seed Exchange, the façades on its first leg; Pinewood's stilt houses,
 * platforms and sawmill; Riverbank's river, boardwalks and market square. Each lane edge is a façade 8–16 m tall
 * with doors and windows (as facade marks on solid houses), a prop or cover piece every 6–10 m, a raised route every
 * 30 m and stairs to a balcony at least every 40 m.
 */
import type { BlockoutPrim, BoxVolume, MaterialTag, NestAnchor, Vec3 } from '../../../core/contracts';
import type { FacadeStyle } from '../dressing';
import type { Side, SpecPart } from './kit';
import { at, block, column, extend, flipPart, joinParts, part, ramp, slab, stilts, tree, v, vine } from './kit';
import type { Rect } from './interiors';
import { fill, marksOn, rect, shell, SLAB, volumeOf, WALL } from './interiors';
import { props, type PropSpec } from './jungle';
import * as dmath from '../../../core/dmath';

const PI = Math.PI;

const deco = (kind: PropSpec['kind'], x: number, z: number, w: number, d: number, h: number, y = 0, yaw = 0): PropSpec =>
  ({ kind, x, z, w, d, h, y, yaw });
const cover = (kind: PropSpec['kind'], x: number, z: number, w = 1.5, d = 1.5, h = 1.2, yaw = 0): PropSpec =>
  ({ kind, x, z, w, d, h, yaw, solid: true });

// ---------------------------------------------------------------------------------------------------------------
// Terrace houses (GDD §6.8): two storeys, a lane door, a back door, an upper door onto the 4 m lane balcony
// ---------------------------------------------------------------------------------------------------------------

interface Terrace {
  readonly id: string;
  readonly r: Rect;
  /** Flat: the roof's walkable top. Steep: the eaves. */
  readonly h: number;
  readonly roof: 'flat' | 'steep';
  /** The lane face and the back face. */
  readonly lane: 'e' | 'w';
  /** Does the 4 m lane balcony run past the upper door? */
  readonly balcony: boolean;
  /** Which way the lane door is staggered: -1 south (default), 1 north (clear of a balcony stair). */
  readonly door?: -1 | 1;
  readonly material: MaterialTag;
  readonly style: FacadeStyle;
}

const opposite = (s: 'e' | 'w'): 'e' | 'w' => (s === 'e' ? 'w' : 'e');
/** Each terrace door sits this far off the house's middle, lane door one way, back door the other. */
const DOOR_STAGGER = 1.5;

function terrace(t: Terrace): SpecPart {
  const mid = (t.r.z0 + t.r.z1) / 2;
  const stagger = -DOOR_STAGGER * (t.door ?? -1);
  const back = opposite(t.lane);
  // A 7 m stair along the south wall rises toward the lane, leaving landings at both ends; the roof ladder stands
  // against the north wall.
  const sx0 = t.lane === 'e' ? t.r.x1 - 9 : t.r.x0 + 2;
  const stair = rect(sx0, sx0 + 7, t.r.z0 + WALL, t.r.z0 + WALL + 2);
  const ladderX = t.lane === 'e' ? t.r.x0 + 4 : t.r.x1 - 3;
  return shell({
    id: t.id, archetype: 'terrace-house', zone: 'hedgerow', style: t.style, nestCrown: t.roof === 'steep',
    x0: t.r.x0, x1: t.r.x1, z0: t.r.z0, z1: t.r.z1, floors: [0, 4], top: t.h, roof: t.roof, material: t.material,
    // The lane door and the back door are 3 m apart along the house, so no straight sightline runs through it from the
    // lane to the jungle (D-EP-053). Upper openings sit over the doors at their width, so the piers stay whole.
    gaps: [
      { face: t.lane, storey: 0, at: mid - stagger, kind: 'door' },
      t.balcony
        ? { face: t.lane, storey: 1, at: mid - stagger, kind: 'balcony' }
        : { face: t.lane, storey: 1, at: mid - stagger, kind: 'window', w: 2.4 },
      { face: back, storey: 0, at: mid + stagger, kind: 'door' },
      { face: back, storey: 1, at: mid + stagger, kind: 'window', w: 2.4 },
    ],
    // Flat roofs keep their parapet on the lane face only (prim budget).
    parapet: [t.lane],
    stairs: [{ r: stair, storey: 0, up: t.lane }],
    ladders: t.roof === 'flat' ? [{ storey: 1, x: ladderX, z: t.r.z1 - WALL - 2, in: 's' }] : [],
  });
}

const hedgeFill = (id: string, r: Rect, h: number, roof: 'flat' | 'steep', material: MaterialTag, faces: Side[], style: FacadeStyle): SpecPart =>
  fill({ id, archetype: 'terrace-house', zone: 'hedgerow', r, h, roof, material, style, faces, nestCrown: roof === 'steep' });

/** Half the lane widths (GDD §6.4); main.ts's lane records use the same. */
export const HEDGEROW_HALF = 7;
export const RIVERBANK_HALF = 9;
export const PINEWOOD_HALF = 8;

const WEST = { x0: -116, x1: -103 } as const;
const EAST = { x0: -87, x1: -76 } as const;

const westTerrace = joinParts(
  terrace({ id: 'terrace-w1', r: rect(WEST.x0, WEST.x1, -78, -70), h: 9, roof: 'flat', lane: 'e', balcony: false, material: 'brick', style: 'hedgerow-brick' }),
  terrace({ id: 'terrace-w2', r: rect(WEST.x0, WEST.x1, -70, -62), h: 10, roof: 'steep', lane: 'e', balcony: true, material: 'brick', style: 'hedgerow-brick' }),
  terrace({ id: 'terrace-w3', r: rect(WEST.x0, WEST.x1, -54, -46), h: 11, roof: 'steep', lane: 'e', balcony: true, material: 'brick', style: 'hedgerow-brick' }),
  terrace({ id: 'terrace-w4', r: rect(WEST.x0, WEST.x1, -46, -38), h: 9, roof: 'flat', lane: 'e', balcony: true, material: 'brick', style: 'hedgerow-brick' }),
  hedgeFill('terrace-w5', rect(WEST.x0, WEST.x1, -38, -30), 10, 'steep', 'brick', ['e', 'w'], 'hedgerow-brick'),
  hedgeFill('terrace-w6', rect(WEST.x0, WEST.x1, -30, -22), 8, 'flat', 'brick', ['e', 'w'], 'hedgerow-brick'),
  hedgeFill('terrace-w7', rect(WEST.x0, WEST.x1, -22, -14), 11, 'steep', 'brick', ['e', 'w'], 'hedgerow-brick'),
  hedgeFill('terrace-w8', rect(WEST.x0, WEST.x1, -14, -6), 9, 'flat', 'brick', ['e', 'w'], 'hedgerow-brick'),
);

const eastTerrace = joinParts(
  terrace({ id: 'terrace-e1', r: rect(EAST.x0, EAST.x1, -74, -65.5), h: 8, roof: 'flat', lane: 'w', balcony: true, door: 1, material: 'stone', style: 'hedgerow-stone' }),
  hedgeFill('terrace-e2', rect(EAST.x0, EAST.x1, -65.5, -57), 10, 'steep', 'stone', ['w', 'e'], 'hedgerow-stone'),
  terrace({ id: 'terrace-e3', r: rect(EAST.x0, EAST.x1, -57, -48.5), h: 9, roof: 'flat', lane: 'w', balcony: true, material: 'stone', style: 'hedgerow-stone' }),
  terrace({ id: 'terrace-e4', r: rect(EAST.x0, EAST.x1, -48.5, -40), h: 11, roof: 'steep', lane: 'w', balcony: true, material: 'stone', style: 'hedgerow-stone' }),
  hedgeFill('terrace-e5', rect(EAST.x0, EAST.x1, -40, -31.5), 8, 'flat', 'stone', ['w', 'e'], 'hedgerow-stone'),
  backLaneAlcove(),
  hedgeFill('terrace-e7', rect(EAST.x0, EAST.x1, -23, -14.5), 9, 'flat', 'stone', ['w', 'e'], 'hedgerow-stone'),
  hedgeFill('terrace-e8', rect(EAST.x0, EAST.x1, -14.5, -6), 8, 'steep', 'stone', ['w', 'e'], 'hedgerow-stone'),
);

/** The east-terrace house at z −31.5…−23 with a 3 × 3 m juke alcove set into its back behind an ivy curtain. */
function backLaneAlcove(): SpecPart {
  const r = rect(EAST.x0, EAST.x1, -31.5, -23);
  const nook = rect(-79, EAST.x1, -31.5, -28.5);
  const solid = fill({ id: 'terrace-e6', archetype: 'terrace-house', zone: 'hedgerow', r, h: 10, roof: 'steep', material: 'stone', style: 'hedgerow-stone', faces: ['w', 'e'], nestCrown: true });
  const [, ...roof] = solid.prims;
  const curtain = v(EAST.x1 - WALL / 2, 1.8, -30);
  return {
    ...solid,
    prims: [
      block(r.x0, nook.x0, r.z0, r.z1, 0, 10, 'stone'),
      block(nook.x0, r.x1, nook.z1, r.z1, 0, 10, 'stone'),
      block(nook.x0, r.x1, nook.z0, nook.z1, 3.6, 10, 'stone'),
      ...roof,
    ],
    fabric: [{ shape: 'box', material: 'foliage', solid: true, blocks: 'sight', yaw: 0, centre: curtain, size: v(WALL, 3.6, 3) }],
    openings: [{ kind: 'arch', rooms: [-1, -1], centre: curtain, width: 3, height: 3.6, yaw: PI / 2, passable: true, curtain: true }],
  };
}

/** The Seed Exchange (GDD §6.8): an open shopfront onto the lane, a ladder to the Lookout roof at 10 m. */
const seedExchange = shell({
  id: 'seed-exchange', archetype: 'seed-exchange', zone: 'hedgerow', style: 'hedgerow-brick', nestCrown: false,
  x0: -116, x1: -109, z0: -62, z1: -54, floors: [0], top: 10, roof: 'flat', parapet: ['e'], material: 'brick',
  gaps: [
    { face: 'e', storey: 0, at: -60, kind: 'arch' }, { face: 'e', storey: 0, at: -56, kind: 'arch' },
    { face: 'w', storey: 0, at: -58, kind: 'door' },
  ],
  ladders: [{ storey: 0, x: -113, z: -59.5, in: 'n' }],
});

// ---------------------------------------------------------------------------------------------------------------
// Hedgerow's first leg: three façades on the outer side with a walkway at 4.5 m (G19, G20)
// ---------------------------------------------------------------------------------------------------------------

/** The first leg runs from the gate (−40, −114) toward the Heron corner (−95, −80). */
const GATE = { x: -40, z: -114 } as const;
const LEG_LENGTH = dmath.hypot(55, 34);
const LEG = { x: -55 / LEG_LENGTH, z: 34 / LEG_LENGTH } as const;
/** Away from the lane on the outer (south-west) side. */
const OUTER = { x: -LEG.z, z: LEG.x } as const;
const legAt = (s: number, off: number) => ({ x: GATE.x + LEG.x * s + OUTER.x * off, z: GATE.z + LEG.z * s + OUTER.z * off });
const LEG_YAW = dmath.atan2(LEG.x, LEG.z);
const OUTER_YAW = dmath.atan2(OUTER.x, OUTER.z);

/**
 * The first leg climbs onto a causeway (D-EP-053): up 3 m over s 14–26, along the top to s 46, down by s 58, so the
 * Heron and gate stations stay at the lane's base height.
 */
export const CAUSEWAY = { s0: 14, s1: 26, s2: 46, s3: 58, h: 3 } as const;
const SEAM = 0.05;

/** The leg's lane height at arc length s from the gate. */
export function causewayY(s: number): number {
  const c = CAUSEWAY;
  if (s <= c.s0 || s >= c.s3) return 0;
  if (s < c.s1) return ((s - c.s0) / (c.s1 - c.s0)) * c.h;
  if (s <= c.s2) return c.h;
  return ((c.s3 - s) / (c.s3 - c.s2)) * c.h;
}

/** The Hedgerow lane's path vertices on the first leg (Pinewood mirrors x): the causeway's breaks. */
export const LEG_PATH: readonly Vec3[] = [CAUSEWAY.s0, CAUSEWAY.s1, CAUSEWAY.s2, CAUSEWAY.s3].map((s) => {
  const p = legAt(s, 0);
  return v(p.x, causewayY(s), p.z);
});

/**
 * The leg's second level (D-EP-053): a 2 m wall-walk at 7.5 m along the causeway's inner edge (4.5 m over the lane, and
 * a wall that shuts the lane off from the Gatefields), its stair up from the gate end, and a bridge over the lane from
 * the outer walkway (stair 4.5 → 7.5 m) to the wall-walk.
 */
export const WALL_WALK = { y: 7.5, s0: 26, s1: 58, stair: 12, bridge: 36, deck: 3, width: 2 } as const;

/** A turned ramp of the leg, its rise along +s (`down` false) or toward the gate (`down` true). */
function legRamp(s0: number, s1: number, off: number, width: number, y0: number, y1: number, down: boolean, material: MaterialTag): BlockoutPrim {
  const p = legAt((s0 + s1) / 2, off);
  return { shape: 'ramp', material, solid: true, yaw: down ? LEG_YAW + PI : LEG_YAW, centre: v(p.x, (y0 + y1) / 2, p.z), size: v(width, y1 - y0, s1 - s0) };
}

/** The causeway's prims (a ramp up, the top, a ramp down, the lane's width across) and the second level over it. */
function legCauseway(halfWidth: number, material: MaterialTag): BlockoutPrim[] {
  const c = CAUSEWAY;
  const w = WALL_WALK;
  const top = legAt((c.s1 + c.s2) / 2, 0);
  const inner = -(halfWidth + w.width / 2);
  const wall = legAt((w.s0 + w.s1) / 2, inner);
  const outer = halfWidth + WALKWAY.width / 2;
  // The deck runs from the wall-walk's face across the lane and over the walkway: centre 1 m out from the path.
  const across = halfWidth * 2 + WALKWAY.width;
  const deckOff = WALKWAY.width / 2;
  const deck = legAt(w.bridge + w.deck / 2, deckOff);
  // Rails on both long edges; the gate-side one stops short of the stair head over the walkway.
  const rail = (ds: number, width: number, off: number) => {
    const p = legAt(w.bridge + ds, off);
    return slab(p.x, p.z, width, 0.5, w.y, w.y + 1, LEG_YAW, 'wood');
  };
  return [
    legRamp(c.s0, c.s1, 0, halfWidth * 2, 0, c.h, false, material),
    // The top overlaps the ramps' high ends by 5 cm, so no rounding seam opens between the turned prims.
    slab(top.x, top.z, halfWidth * 2, c.s2 - c.s1 + SEAM * 2, 0, c.h, LEG_YAW, material),
    legRamp(c.s2, c.s3, 0, halfWidth * 2, 0, c.h, true, material),
    slab(wall.x, wall.z, w.width, w.s1 - w.s0, 0, w.y, LEG_YAW, 'stone'),
    legRamp(w.stair, w.s0, inner, w.width, 0, w.y, false, 'stone'),
    legRamp(w.bridge - 6, w.bridge, outer, WALKWAY.width, WALKWAY.y, w.y, false, 'wood'),
    slab(deck.x, deck.z, across, w.deck, w.y - SLAB, w.y, LEG_YAW, 'wood'),
    rail(0.25, halfWidth * 2, 0), rail(w.deck - 0.25, across, deckOff),
  ];
}

/** Nav waypoints on the leg's second level: the wall-walk, its stair, the bridge and its stair. */
function legUpper(halfWidth: number): Vec3[] {
  const w = WALL_WALK;
  const inner = -(halfWidth + w.width / 2);
  const at = (s: number, off: number, y: number) => {
    const p = legAt(s, off);
    return v(p.x, y, p.z);
  };
  return [
    ...[28, 34, 40, 46, 52, 57].map((s) => at(s, inner, w.y)),
    at(w.stair - 1, inner, 0), at((w.stair + w.s0) / 2, inner, w.y / 2),
    at(w.bridge + w.deck / 2, 0, w.y), at(w.bridge + w.deck / 2, -halfWidth + 1, w.y), at(w.bridge - 3, halfWidth + 1, (WALKWAY.y + w.y) / 2),
  ];
}

/** A solid house turned to face the lane: local x along the lane, local z away from it. */
function legHouse(id: string, s: number, w: number, d: number, h: number, material: MaterialTag, style: FacadeStyle, halfWidth: number): SpecPart {
  const c = legAt(s, halfWidth + 2 + d / 2);
  const local = rect(-w / 2, w / 2, -d / 2, d / 2);
  const ca = dmath.cos(OUTER_YAW);
  const sa = dmath.sin(OUTER_YAW);
  const place = (p: Vec3): Vec3 => v(c.x + p.x * ca + p.z * sa, p.y, c.z - p.x * sa + p.z * ca);
  return part({
    prims: [slab(c.x, c.z, w, d, 0, h - SLAB, OUTER_YAW, material), slab(c.x, c.z, w, d, h - SLAB, h, OUTER_YAW, 'roof')],
    buildings: [{
      id, archetype: 'terrace-house', zone: 'hedgerow',
      footprint: { centre: v(c.x, h / 2, c.z), size: v(w, h, d), yaw: OUTER_YAW },
      storeys: [{ floorY: 0, height: 3.6 }, { floorY: 4, height: 3.6 }], roof: { y: h, walkable: true },
    }],
    dress: [{
      style, enterable: false, balconies: walkwayFront(s, w, halfWidth), landings: [], stairs: [],
      marks: marksOn(local, ['s'], 0, h - SLAB).map((m) => ({ ...m, centre: place(m.centre), yaw: m.yaw + OUTER_YAW })),
      roof: { style: 'flat', nestCrown: true, pitchDeg: 0, ridge: null, eaves: h - SLAB, top: h },
    }],
  });
}

/** The walkway at 4.5 m runs along the leg's outer edge from s 23 to 51, just outside the lane: a raised sidewalk
 * 1.5 m above the causeway, with stairs from the ground at both ends. */
const WALKWAY = { y: 4.5, s0: 23, s1: 51, width: 2 } as const;
const walkwayOff = (halfWidth: number) => halfWidth + WALKWAY.width / 2;

/** The stretch of walkway in front of a house at s, as that house's balcony. */
function walkwayFront(s: number, w: number, halfWidth: number): BoxVolume[] {
  const s0 = Math.max(WALKWAY.s0, s - w / 2);
  const s1 = Math.min(WALKWAY.s1, s + w / 2);
  if (s1 <= s0) return [];
  const c = legAt((s0 + s1) / 2, walkwayOff(halfWidth));
  return [{ centre: v(c.x, WALKWAY.y - SLAB / 2, c.z), size: v(WALKWAY.width, SLAB, s1 - s0), yaw: LEG_YAW }];
}

function legWalkway(halfWidth: number, material: MaterialTag): SpecPart {
  const y = WALKWAY.y;
  const off = walkwayOff(halfWidth);
  const deck = (s0: number, s1: number) => {
    const c = legAt((s0 + s1) / 2, off);
    return slab(c.x, c.z, WALKWAY.width, s1 - s0, y - SLAB, y, LEG_YAW, material);
  };
  const stair = (s0: number, s1: number, up: number) => {
    const c = legAt((s0 + s1) / 2, off);
    return { shape: 'ramp' as const, material, solid: true, yaw: up, centre: v(c.x, y / 2, c.z), size: v(WALKWAY.width, y, s1 - s0) };
  };
  const nav = [15, 23, 37, 51, 59].map((s) => {
    const c = legAt(s, off);
    return v(c.x, s === 15 || s === 59 ? 0 : y, c.z);
  });
  return part({
    prims: [stair(15, 23, LEG_YAW), deck(23, 51), stair(51, 59, LEG_YAW + PI), ...legCauseway(halfWidth, 'stone')],
    nav: [
      ...nav, v(legAt(14, off).x, 0, legAt(14, off).z), v(legAt(60, off).x, 0, legAt(60, off).z),
      ...[20, 30, 36, 42, 52].map((s) => v(legAt(s, 0).x, causewayY(s), legAt(s, 0).z)),
      ...legUpper(halfWidth),
    ],
  });
}

const legFacades = (halfWidth: number, material: MaterialTag, style: FacadeStyle): SpecPart => joinParts(
  legHouse('leg-house-1', 21, 11, 8, 11, material, style, halfWidth),
  legHouse('leg-house-2', 33, 11, 8, 13, material, style, halfWidth),
  legHouse('leg-house-3', 45, 11, 8, 10, material, style, halfWidth),
  legWalkway(halfWidth, 'wood'),
);

/** Cover along the first leg, alternating edges every 8 m (G19), standing on the causeway where it runs. A crate on
 * a ramp sits at the ramp's height at its downhill edge. */
const legCover = (kind: PropSpec['kind'], halfWidth: number): PropSpec[] => [
  ...[9, 17, 25, 33, 41, 49, 57].map((s, i) => {
    const c = legAt(s, (i % 2 ? -1 : 1) * (halfWidth - 1.5));
    return { ...cover(kind, c.x, c.z, 1.5, 1.5, 1.2, LEG_YAW), y: Math.min(causewayY(s - 0.75), causewayY(s + 0.75)) };
  }),
  // On the outside of the corner, where the lane turns toward the Hawk.
  cover(kind, -101, -86, 1.5, 1.5, 1.2),
];

// ---------------------------------------------------------------------------------------------------------------
// Hedgerow (west)
// ---------------------------------------------------------------------------------------------------------------

/** Bridge height over the side lanes (as the rune bridges): under the Updraft rider's 9 m clearance with a 1 m rail. */
export const BRIDGE_Y = 6;
const RAIL_H = 1;

/** Hedgerow's bridge between the Hawk and the rune bridge: a 3 m deck over the lane at z −22…−19, its rails, and a
 * 2 m stair up from each balcony (4 → 6 m). The rails leave the stair heads open. */
const HEDGEROW_BRIDGE: BlockoutPrim[] = [
  block(-101, -89, -22, -19, BRIDGE_Y - SLAB, BRIDGE_Y, 'wood'),
  block(-101, -89, -19.5, -19, BRIDGE_Y, BRIDGE_Y + RAIL_H, 'wood'),
  block(-99, -91, -22, -21.5, BRIDGE_Y, BRIDGE_Y + RAIL_H, 'wood'),
  ramp(-101, -99, -28, -22, 4, BRIDGE_Y, 'n', 'wood'),
  ramp(-91, -89, -28, -22, 4, BRIDGE_Y, 'n', 'wood'),
];

const hedgerowPrims: BlockoutPrim[] = [
  // Balconies at 4 m over both sides of the lane between Heron and Hawk, each with a stair.
  block(-103, -100, -70, -42, 3.6, 4, 'wood'),
  ramp(-103, -101, -42, -34, 0, 4, 's', 'wood'),
  block(-90, -87, -70, -42, 3.6, 4, 'wood'),
  ramp(-89, -87, -80, -70, 0, 4, 'n', 'wood'),
  // Between the Hawk and the rune bridge: a 4 m balcony on each side with a stair from the street, and a bridge at 6 m
  // across the lane between them, reached from each balcony by a short stair (D-EP-053).
  block(-103, -99, -30, -12, 3.6, 4, 'wood'),
  ramp(-103, -101, -12, -4, 0, 4, 's', 'wood'),
  block(-91, -87, -34, -16, 3.6, 4, 'wood'),
  ramp(-89, -87, -16, -8, 0, 4, 's', 'wood'),
  ...HEDGEROW_BRIDGE,
  // Hedge chicanes, alternating sides; the middle 6 m stays open for fledglings.
  block(-102, -98, -63, -61.5, 0, 2.5, 'foliage'),
  block(-92, -88, -49, -47.5, 0, 1.2, 'foliage'),
  block(-102, -98, -25, -23.5, 0, 1.2, 'foliage'),
  block(-92, -88, -14, -12.5, 0, 2.5, 'foliage'),
  // Hedge at the outside of the Heron corner.
  block(-106, -100, -100, -98.5, 0, 2.5, 'foliage'),
  // Magpie stall counter in the Seed Exchange's shopfront.
  block(-108.5, -107.5, -60, -56, 0, 1.2, 'wood'),
  // Walled kitchen gardens behind the west terrace.
  block(-130, -116, -60.5, -59.5, 0, 1.2, 'stone'),
  block(-130, -116, -34.5, -33.5, 0, 1.2, 'stone'),
  block(-130, -116, -12.5, -11.5, 0, 1.2, 'stone'),
  block(-126, -121, -75, -73, 0, 2.5, 'foliage'),
  block(-126, -121, -48, -46, 0, 1.2, 'foliage'),
  block(-126, -121, -24, -22, 0, 1.2, 'foliage'),
  block(-120, -116, -96, -86, 0, 1.2, 'stone'),
];

const hedgerowNests: NestAnchor[] = [
  { ...at(-110, 0, -74), variant: 'twig', building: 0, storey: 0 },
  { ...at(-81, 9, -53), variant: 'twig' },
  { ...at(-101.5, 4, -64), variant: 'twig' },
  { ...at(-89.5, 0, -56), variant: 'twig' },
];

/** West terrace w1 is building 0; the east terrace's e3 is the eleventh building of the part (index 10). */
const HEDGEROW_E3 = 10;

const hedgerow = joinParts(
  extend(joinParts(westTerrace, eastTerrace), {
    nests: [...hedgerowNests, { ...at(-81, 0, -52), variant: 'twig', building: HEDGEROW_E3, storey: 0 }],
  }),
  extend(seedExchange, {
    interactables: [{ ...at(-112.5, 10, -58), kind: 'lookout' }, { ...at(-101.5, 4, -46), kind: 'berry' }],
  }),
  legFacades(HEDGEROW_HALF, 'brick', 'hedgerow-brick'),
  part({
    prims: hedgerowPrims,
    climbs: [vine(-87, -36, 8, 1, 0), { kind: 'chimney', x: -76, z: -36, floor: 0, roof: 8, inX: -1, inZ: 0 }, vine(-116, -26, 8, 1, 0)],
    nav: [
      v(-101.5, 4, -56), v(-88.5, 4, -56), v(-102, 4, -16), v(-88, 4, -30), v(-102, 4, -26), v(-90, 4, -30),
      v(-100, 4, -29), v(-90, 4, -29), v(-95, BRIDGE_Y, -20.5), v(-100, BRIDGE_Y, -20.5), v(-90, BRIDGE_Y, -20.5),
    ],
  }),
  props('hedgerow', [
    ...[-76, -68, -54, -46, -30, -20, -15].map((z, i) => cover(i % 2 ? 'planter' : 'barrel', -100.75, z)),
    ...[-36, -28, -20, -4].map((z, i) => cover(i % 2 ? 'barrel' : 'planter', -89.25, z)),
    ...legCover('planter', HEDGEROW_HALF),
    deco('feather-banner', -103.1, -58, 0.1, 1.2, 3, 5, PI / 2), deco('feeder', -100, -50, 0.6, 0.6, 1.2, 4),
    deco('bird-bath', -123, -54, 1.4, 1.4, 0.9), deco('worm-bed', -123, -66, 4, 3, 0.3), deco('insect-hive', -128, -40, 1, 1, 1.4),
    deco('flowers', -123, -28, 6, 3, 0.6), deco('nest-pile', -125, -18, 2, 2, 0.8), deco('dovecote-boxes', -103.1, -74, 0.4, 6, 1.6, 5, PI / 2),
    deco('roost-rail', -103.2, -50, 0.15, 7, 0.15, 8, PI / 2), deco('roost-rail', -86.8, -52, 0.15, 7, 0.15, 7.6, PI / 2),
  ]),
);

// ---------------------------------------------------------------------------------------------------------------
// Pinewood (east): stilt houses on the 6 m platforms, a 10 m lookout, rope walkway, sawmill, pines
// ---------------------------------------------------------------------------------------------------------------

/** A Stilt House (GDD §6.8): a 6 × 5 m birdhouse hut on a platform, doors east and west, windows north and south,
 * a ladder to its walkable roof. */
function stiltHouse(id: string, x0: number, z0: number, y: number): SpecPart {
  const x1 = x0 + 6;
  const z1 = z0 + 5;
  const zm = z0 + 2.5;
  return shell({
    id, archetype: 'stilt-house', zone: 'pinewood', style: 'pinewood-birdhouse', nestCrown: true,
    x0, x1, z0, z1, floors: [y], top: y + 4, roof: 'flat', material: 'wood',
    gaps: [
      { face: 'w', storey: 0, at: zm, kind: 'door' }, { face: 'e', storey: 0, at: zm, kind: 'door' },
      { face: 'n', storey: 0, at: x0 + 3, kind: 'window' }, { face: 's', storey: 0, at: x0 + 3, kind: 'window' },
    ],
    ladders: [{ storey: 0, x: x0 + 2.5, z: zm, in: 'e' }],
  });
}

const pinewoodPrims: BlockoutPrim[] = [
  // East: stilt platform over the Magpie stall, rope stair up to a 10 m lookout.
  block(104, 116, -72, -60, 5.6, 6, 'wood'),
  ...stilts(104, 116, -72, -60, 5.6),
  ramp(110, 112, -80, -72, 0, 6, 'n', 'wood'),
  block(106, 118, -46, -34, 9.6, 10, 'wood'),
  ...stilts(106, 118, -46, -34, 9.6),
  ramp(110, 112, -60, -46, 6, 10, 'n', 'wood'),
  block(107, 108.5, -60, -56, 0, 1.2, 'wood'),
  // Pinewood's bridge: the rope walkway across the lane at 6 m between the two stilt platforms, with rope rails.
  block(86, 104, -67, -65, 5.7, 6, 'wood'),
  block(86, 104, -67.5, -67, 5.7, 7, 'wood'),
  block(86, 104, -65, -64.5, 5.7, 7, 'wood'),
  // West: platform at 6 m, ramp from the jungle, rope stair to a 10 m platform.
  block(76, 86, -72, -60, 5.6, 6, 'wood'),
  ...stilts(76, 86, -72, -60, 5.6),
  ramp(66, 76, -68, -66, 0, 6, 'e', 'wood'),
  block(76, 86, -46, -34, 9.6, 10, 'wood'),
  ...stilts(76, 86, -46, -34, 9.6),
  ramp(80, 82, -60, -46, 6, 10, 'n', 'wood'),
  // A stair from the lane edge up to the west 6 m platform (G20); the east one has its own from the south.
  ramp(84, 86, -60, -48, 0, 6, 's', 'wood'),
  // A roost stand on the east edge near the rune bridge: a 4.5 m deck on stilts with a stair.
  block(103, 106.5, -16, -12, 4.1, 4.5, 'wood'),
  ...stilts(103, 106.5, -16, -12, 4.1),
  ramp(104, 106, -24, -16, 0, 4.5, 'n', 'wood'),
  // Logs and timber piles.
  block(88, 92, -58, -56, 0, 1.2, 'wood'),
  block(98, 102, -22, -20, 0, 1.2, 'wood'),
  block(99, 103, -92, -89, 0, 1.5, 'wood'),
  ...tree(112, -98, 0.7, 18, 2.6, 5),
  // Pines: lane edges, the east band and the first leg.
  ...tree(104.5, -26, 0.7, 18, 2.6, 5),
  ...tree(104.5, -10, 0.7, 18, 2.6, 5),
  ...tree(122, -84, 0.8, 20, 3, 6),
  ...tree(124, -64, 0.8, 20, 3, 6),
  ...tree(124, -48, 0.8, 20, 3, 6),
  ...tree(122, -24, 0.8, 20, 3, 6),
  ...tree(120, -8, 0.8, 20, 3, 6),
  ...tree(77, -101, 0.7, 18, 2.6, 5),
  ...tree(70, -106, 0.7, 18, 2.6, 5),
  ...tree(84, -96, 0.7, 18, 2.6, 5),
];

/** The sawmill shed (flat roof at 8) with a juke alcove behind ivy in its jungle-side wall. */
function sawmill(): SpecPart {
  const r = rect(76, 86, -30, -16);
  const nook = rect(76, 79, -29, -26);
  const top = 8;
  const solid = fill({ id: 'sawmill', archetype: 'sawmill', zone: 'pinewood', r, h: top, roof: 'flat', material: 'wood', style: 'pinewood-birdhouse', faces: ['e', 'n'], nestCrown: true });
  const curtain = v(76 + WALL / 2, 1.8, -27.5);
  return {
    ...solid,
    prims: [
      block(nook.x1, r.x1, r.z0, r.z1, 0, top - SLAB, 'wood'),
      block(r.x0, nook.x1, nook.z1, r.z1, 0, top - SLAB, 'wood'),
      block(r.x0, nook.x1, r.z0, nook.z0, 0, top - SLAB, 'wood'),
      block(r.x0, nook.x1, nook.z0, nook.z1, 3.6, top - SLAB, 'wood'),
      block(r.x0, r.x1, r.z0, r.z1, top - SLAB, top, 'roof'),
    ],
    fabric: [{ shape: 'box', material: 'foliage', solid: true, blocks: 'sight', yaw: 0, centre: curtain, size: v(WALL, 3.6, 3) }],
    openings: [{ kind: 'arch', rooms: [-1, -1], centre: curtain, width: 3, height: 3.6, yaw: -PI / 2, passable: true, curtain: true }],
    climbs: [vine(86, -24, top, -1, 0)],
  };
}

const pinewood = joinParts(
  extend(joinParts(stiltHouse('stilthouse-far', 109, -70, 6), stiltHouse('stilthouse-near', 78, -71, 6)), {
    nests: [
      { ...at(113.5, 6, -68.5), variant: 'twig', building: 0, storey: 0 },
      { ...at(82.5, 6, -69.5), variant: 'twig', building: 1, storey: 0 },
      { ...at(113.5, 10, -67.5), variant: 'twig' }, { ...at(95, 6, -66), variant: 'twig' }, { ...at(89.5, 0, -52), variant: 'twig' },
    ],
    interactables: [{ ...at(112, 10, -40), kind: 'lookout' }, { ...at(81, 10, -40), kind: 'berry' }],
  }),
  sawmill(),
  mirrorLeg(),
  // Timber stores under and between the west platforms: Pinewood's west frontage, like Hedgerow's east terrace, so the
  // lane is walled off from the jungle from its Heron corner to Perch Road (D-EP-053). The platforms sit on them.
  ...([
    ['pine-store-corner', rect(76, 84, -76, -72), 6],
    ['pine-store-platform', rect(76, 86, -72, -60), 5.6],
    ['pine-store-stair', rect(76, 84, -60, -46), 5.6],
    ['pine-store-lookout', rect(76, 86, -46, -30), 6],
    ['pine-store-bridge', rect(76, 86, -16, -4), 7],
  ] as const).map(([id, r, h]) => fill({ id, archetype: 'block', zone: 'pinewood', r, h, roof: 'flat', material: 'wood', style: 'pinewood-birdhouse', faces: ['e'] })),
  part({
    prims: pinewoodPrims,
    climbs: [{ kind: 'chimney', x: 106, z: -40, floor: 0, roof: 10, inX: 1, inZ: 0 }],
    nav: [
      v(95, 6, -66), v(85, 6, -61), v(105, 6, -61), v(104.75, 4.5, -14), v(105, 0, -25),
      // Under the 10 m lookout and out into the pine band (its Hide).
      v(106, 0, -40), v(112, 0, -40), v(117, 0, -50), v(118, 0, -30),
    ],
  }),
  props('pinewood', [
    ...[-76, -64, -40, -32, -14, -6].map((z) => cover('logs', 89.75, z, 1.5, 3, 1.2)),
    ...[-80, -72, -52, -44, -26, -12, -2.5].map((z) => cover('crate', 100.25, z)),
    deco('pine', 104.5, -26, 6, 6, 18), deco('pine', 104.5, -10, 6, 6, 18), deco('reeds', 120, -30, 4, 8, 1.4),
    deco('feather-banner', 86.1, -66, 0.1, 1.4, 3, 7, PI / 2),
    deco('dovecote-boxes', 112, -60.2, 4, 0.4, 1.6, 7), deco('feeder', 107.75, -58, 0.6, 0.6, 1.4, 1.2),
    deco('branch-nest', 122, -84, 2, 2, 1, 14), deco('branch-nest', 124, -48, 2, 2, 1, 15), deco('insect-hive', 118, -90, 1, 1, 1.6),
  ]),
);

/** Pinewood's first leg: Hedgerow's façades and walkway mirrored in x, in timber. */
function mirrorLeg(): SpecPart {
  const leg = joinParts(legFacades(PINEWOOD_HALF, 'wood', 'pinewood-birdhouse'), props('hedgerow', legCover('logs', PINEWOOD_HALF)));
  return rezone(flipPart(leg, (m) => m, (id) => `pine-${id}`), 'pinewood');
}

/** Move a part's buildings and props to another lane zone. */
function rezone(p: SpecPart, zone: string): SpecPart {
  return { ...p, buildings: (p.buildings ?? []).map((b) => ({ ...b, zone })), props: (p.props ?? []).map((q) => ({ ...q, zone })) };
}

// ---------------------------------------------------------------------------------------------------------------
// Riverbank (middle): river, boardwalks, market square, the stall, bridge rails
// ---------------------------------------------------------------------------------------------------------------

/**
 * Between its gate and its Heron, Riverbank runs down into a 2.5 m stone cutting (D-EP-053): down over z −107…−101,
 * along the floor to −92, up by −86, clear of the Wardens, the Heron and both stations. A cutting, not a rise, so the
 * long view from the Heron line to the gate stays open over it; the Heron-to-Hawk stretch stays level (the market and
 * the lane fights). cellar.ts carves the ground for it.
 */
export const CUTTING = { z0: -107, z1: -101, z2: -92, z3: -86, depth: 2.5 } as const;

/** The west roost stand by the market square stands this high. */
const STAND_HIGH = 7.5;

/** Riverbank's lane height at z (Dawn half). */
export function cuttingY(z: number): number {
  const c = CUTTING;
  if (z <= c.z0 || z >= c.z3) return 0;
  if (z < c.z1) return -((z - c.z0) / (c.z1 - c.z0)) * c.depth;
  if (z <= c.z2) return -c.depth;
  return -((c.z3 - z) / (c.z3 - c.z2)) * c.depth;
}

/** Riverbank's path vertices at the cutting's breaks. */
export const RIVER_PATH: readonly Vec3[] = [CUTTING.z0, CUTTING.z1, CUTTING.z2, CUTTING.z3].map((z) => v(0, cuttingY(z), z));

/** A cover piece on the lane's surface: on a ramp it sits at the ramp's height at its downhill edge. */
const onRiver = (p: PropSpec): PropSpec => ({ ...p, y: Math.min(cuttingY(p.z - p.d / 2), cuttingY(p.z + p.d / 2)) });

const riverbankPrims: BlockoutPrim[] = [
  // The cutting's ramps, on its floor (the walls are the carved ground).
  ramp(-RIVERBANK_HALF, RIVERBANK_HALF, CUTTING.z0, CUTTING.z1, -CUTTING.depth, 0, 's', 'stone'),
  ramp(-RIVERBANK_HALF, RIVERBANK_HALF, CUTTING.z2, CUTTING.z3, -CUTTING.depth, 0, 'n', 'stone'),
  block(9, 14, -114, -22, 0, 0.05, 'water', false),
  block(9, 14.5, -92, -89, 0, 0.3, 'wood'),
  block(8.5, 14.5, -70, -67, 0, 0.3, 'wood'),
  // Market square at the Hawk.
  block(-14, 9, -54, -26, 0, 0.02, 'stone', false),
  block(-11.5, -9.5, -52, -49, 0, 1.5, 'wood'),
  block(6, 8.5, -33, -30, 0, 1.2, 'wood'),
  block(-8.5, -6, -50, -47, 0, 1.2, 'wood'),
  // Crates near the Heron, one down in the cutting.
  block(-8.5, -6, -95, -92, -CUTTING.depth, 1.5 - CUTTING.depth, 'wood'),
  block(6, 8.5, -80, -77, 0, 1.5, 'wood'),
  // Magpie stall counter on the bank.
  block(12, 13.5, -62, -58, 0, 1.2, 'wood'),
  // Waterwheel of the Water Mill (decoration).
  block(14, 14.6, -42, -35, 0, 6, 'wood', false),
  // Old Mill Bridge rails (the 4 m gaps let you drop into the Hollow; the 0.5 m ones split the rails into cover every
  // few metres) and piers.
  block(-5, -4.4, -20, -16.25, 0, 1.4, 'wood'),
  block(-5, -4.4, -15.75, -12, 0, 1.4, 'wood'),
  block(-5, -4.4, -8, -2, 0, 1.4, 'wood'),
  block(4.4, 5, -20, -16.25, 0, 1.4, 'wood'),
  block(4.4, 5, -15.75, -12, 0, 1.4, 'wood'),
  block(4.4, 5, -8, -2, 0, 1.4, 'wood'),
  column(-3, -11, 1.2, -10, -1, 'stone'),
  column(3, -11, 1.2, -10, -1, 'stone'),
];

const riverbank = joinParts(
  part({
    prims: [
      ...riverbankPrims,
      // A roost stand on the west edge by the Lantern Row mouth (the east bank has the stall there): a 7.5 m deck on
      // stilts, its 15 m stair rising south from the market square.
      block(-16, -12.5, -70, -66, STAND_HIGH - SLAB, STAND_HIGH, 'wood'),
      ...stilts(-16, -12.5, -70, -66, STAND_HIGH - SLAB),
      ramp(-16, -14, -66, -51, 0, STAND_HIGH, 's', 'wood'),
    ],
    nav: [v(-14.25, STAND_HIGH, -68), v(-15, STAND_HIGH / 2, -58.5), v(-15, 0, -50)],
  }),
  props('riverbank', [
    // 1.5 m tall, so the ones on the cutting's ramps stand a metre clear of the slope.
    ...[-104, -88, -64, -58, -38, -30, -20].map((z, i) => onRiver(cover(i % 2 ? 'crate' : 'barrel', -7, z, 1.5, 1.5, 1.5))),
    ...[-108, -100, -88, -72, -52, -44, -24].map((z, i) => onRiver(cover(i % 2 ? 'barrel' : 'crate', 7, z, 1.5, 1.5, 1.5))),
    deco('stall', 12.75, -60, 3, 5, 3), deco('reeds', 11.5, -100, 4, 10, 1.6), deco('reeds', 11.5, -48, 4, 6, 1.6),
    deco('reeds', 11.5, -28, 4, 6, 1.6), deco('bird-bath', -5.5, -36, 1.4, 1.4, 0.9), deco('fountain', -5, -30, 3, 3, 1.4),
    deco('seed-stall', -12, -40, 2.5, 1.5, 2.2), deco('feather-banner', 0, -112.5, 1.4, 0.1, 4, 6),
  ]),
);

/** Lane-side content of the Dawn half (west quarter: Hedgerow; east quarter: Pinewood; Riverbank between). */
export const LANES_HALF: SpecPart = joinParts(hedgerow, pinewood, riverbank);

// ---------------------------------------------------------------------------------------------------------------
// Centre (z = 0, its own mirror image): the Dovecotes beside the rune bridges
// ---------------------------------------------------------------------------------------------------------------

/** A Dovecote (GDD §6.8): an octagonal tower, r 3, 12 m, its door toward the lane, a ladder to the top. */
function dovecote(id: string, zone: string): SpecPart {
  const c = { x: -121, z: 0 };
  const top = 12;
  const deck = top - SLAB;
  const side = 2 * 3 * dmath.tan(PI / 8);
  const fabric: BlockoutPrim[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k * PI) / 4;
    const x = c.x + dmath.sin(a) * 2.75;
    const z = c.z + dmath.cos(a) * 2.75;
    // The door faces east, toward the lane (k = 2).
    fabric.push(slab(x, z, side, 0.5, k === 2 ? 3 : 0, deck, a, 'stone'));
  }
  // The deck, open over the ladder's 2 × 2 m hatch east of the centre; ladder and Vine both land on its west half.
  fabric.push(block(c.x - 3, c.x + 3, c.z + 1, c.z + 3, deck, top, 'wood'), block(c.x - 3, c.x + 3, c.z - 3, c.z - 1, deck, top, 'wood'));
  fabric.push(block(c.x - 3, c.x, c.z - 1, c.z + 1, deck, top, 'wood'), block(c.x + 2, c.x + 3, c.z - 1, c.z + 1, deck, top, 'wood'));
  const built = part({
    fabric,
    climbs: [{ kind: 'ladder', x: c.x, z: c.z, floor: 0, roof: top, inX: -1, inZ: 0 }, vine(c.x - 3, 0, top, 1, 0)],
    nav: [v(c.x, 0, c.z), v(c.x + 4.5, 0, c.z), v(c.x - 1.5, top, c.z), v(c.x, top, c.z + 2), v(c.x - 4, 0, c.z)],
    buildings: [{ id, archetype: 'dovecote', zone, footprint: volumeOf(rect(c.x - 3, c.x + 3, c.z - 3, c.z + 3), 0, top), storeys: [{ floorY: 0, height: deck }], roof: { y: top, walkable: true } }],
    rooms: [{ building: 0, storey: 0, volume: volumeOf(rect(c.x - 2.2, c.x + 2.2, c.z - 2.2, c.z + 2.2), 0, deck) }],
    openings: [
      { kind: 'door', rooms: [0, -1], centre: v(c.x + 2.75, 1.5, c.z), width: 2, height: 3, yaw: PI / 2, passable: true },
      { kind: 'hatch', rooms: [0, -1], centre: v(c.x + 1, deck + SLAB / 2, c.z), width: 2, height: SLAB, yaw: -PI / 2, passable: true },
    ],
    interactables: [{ ...at(c.x, top, c.z, PI / 2), kind: 'lookout' }, { ...at(c.x - 1.5, top, c.z, PI / 2), kind: 'berry' }],
    dress: [{
      style: 'dovecote', enterable: true, marks: [], balconies: [], landings: [], stairs: [],
      roof: { style: 'deck', nestCrown: true, pitchDeg: 0, ridge: null, eaves: deck, top },
    }],
    props: [{ kind: 'dovecote-boxes', pos: v(c.x, 4, c.z), yaw: 0, size: v(6.2, 6, 6.2), zone, solid: false }],
  });
  return built;
}

const westCote = dovecote('dovecote-hedgerow', 'hedgerow');
/** Both Dovecotes: the west one, and its x-mirror (in timber) beside Pinewood. */
export const DOVECOTES: SpecPart = joinParts(westCote, rezone(flipPart(westCote, () => 'wood', () => 'dovecote-pinewood'), 'pinewood'));
