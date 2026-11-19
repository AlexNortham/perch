/**
 * Map data schema (GDD §6). Owner of the data: Level Designer (src/sim/world/map). Readers: sim/physics (colliders,
 * Updrafts, Chimneys, Vines, ledges), sim/world (lanes, anchors), sim/ai (nav graph, bot spots), client/render
 * (blockout) and the client camera presets.
 *
 * MapData is the resolved, whole map: both halves present. Mirror rule (GDD §6.1): gameplay geometry is authored for
 * the Dawn half (z ≤ 0) and mirrored by z → −z (yaw → π − yaw) for Dusk; anything on z = 0 is its own mirror image.
 * Structure, camp and shop positions are also mirrored x → −x so both side lanes have the same distances. Lanes run
 * from Dawn's gate to Dusk's gate. The Level Designer may author one half and mirror it in code; QA checks symmetry.
 *
 * Handedness: the world is right-handed (+y up). Seen from above with Dusk (+z) at the top of the screen, +x is on
 * the LEFT. The GDD calls +x "east", so a top-down view with north up shows east on the left: minimaps and overview
 * cameras must map screen-right to −x (Dawn-at-bottom orientation) or mirror deliberately.
 */
import type { LaneId, PlayerTeam, Team, Vec3 } from './base';
import type { StructureType, ThicketTier } from './entity';

export type MapId = 'main' | 'arena';

/** Surface tags. Render picks colours; physics may use them for footing. */
export type MaterialTag =
  | 'ground'
  | 'grass'
  | 'road'
  | 'stone'
  | 'brick'
  | 'wood'
  | 'roof'
  | 'metal'
  | 'water'
  | 'foliage'
  | 'trunk'
  | 'dawn'
  | 'dusk';

interface PrimBase {
  readonly material: MaterialTag;
  /** False for decoration nothing collides with. */
  readonly solid: boolean;
}

/** A box turned by yaw about its centre. `size` is the full extent (not half). */
export interface BoxPrim extends PrimBase {
  readonly shape: 'box';
  readonly centre: Vec3;
  readonly size: Vec3;
  readonly yaw: number;
}

/**
 * A wedge inside the box (centre, size, yaw): its floor is the box bottom and its slope rises from the bottom edge
 * at local −z to the top edge at local +z (walked up facing the prim's yaw).
 */
export interface RampPrim extends PrimBase {
  readonly shape: 'ramp';
  readonly centre: Vec3;
  readonly size: Vec3;
  readonly yaw: number;
}

/** A vertical cylinder; `centre` is the middle of its axis. */
export interface CylinderPrim extends PrimBase {
  readonly shape: 'cylinder';
  readonly centre: Vec3;
  readonly radius: number;
  readonly height: number;
}

export type BlockoutPrim = BoxPrim | RampPrim | CylinderPrim;

export interface Anchor {
  readonly pos: Vec3;
  readonly yaw: number;
}

export interface TeamAnchor extends Anchor {
  readonly team: PlayerTeam;
}

/** Authored lane polyline: Dawn gate → Dusk gate. Fledglings follow it (Dusk walks it in reverse). */
export interface Lane {
  readonly id: LaneId;
  readonly path: readonly Vec3[];
  /** Half the lane's width (m). */
  readonly halfWidth: number;
}

/** A zipline 12 m above a lane (GDD §3.7): riders follow the polyline `points`; `stations` are its mount points. */
export interface Updraft {
  readonly lane: LaneId;
  readonly points: readonly Vec3[];
  readonly stations: readonly Vec3[];
}

/**
 * A vertical traversal (GDD §3.8): Chimneys (warm-air shafts, 1.5 m radius), Vines (on walls and trees) and Ladders
 * (inside and on buildings; physics climbs them like Vines).
 */
export interface Climb {
  readonly kind: 'chimney' | 'vine' | 'ladder';
  readonly bottom: Vec3;
  readonly top: Vec3;
  /** Horizontal unit direction from the wall out (vines); (0,0,0) for chimneys. */
  readonly out: Vec3;
}

/** A mantle ledge: the top edge from a to b; `out` is the horizontal unit direction from the wall onto the top. */
export interface Ledge {
  readonly a: Vec3;
  readonly b: Vec3;
  readonly out: Vec3;
}

/**
 * Link types bots path over (GDD §6.7). Stairs are ramps and use 'walk', as do doors; ladders use 'vine' (both are
 * Climbs that physics treats alike).
 */
export type NavLinkKind = 'walk' | 'jump' | 'dashJump' | 'mantle' | 'chimney' | 'vine' | 'updraft' | 'drop';

/** Navigation graph for bots. Links are one-way; add both for two-way. */
export interface NavGraph {
  readonly nodes: readonly Vec3[];
  readonly links: readonly { readonly from: number; readonly to: number; readonly kind: NavLinkKind }[];
}

export interface StructureAnchor extends TeamAnchor {
  readonly type: Exclude<StructureType, 'nest'>;
  /** Hawk, Heron and Warden lanes; null for Shrines and the Patron. */
  readonly lane: LaneId | null;
}

/** The Home Roost (spawn zone and shop; heals allies, hurts enemies) and the Magpie stalls; own flock only. */
export interface ShopAnchor extends TeamAnchor {
  readonly kind: 'roost' | 'stall';
  /** Zone radius (m): buying and selling work inside it. */
  readonly radius: number;
}

export interface ThicketAnchor extends Anchor {
  readonly tier: ThicketTier;
  /** Indoor camps: index into MapData.buildings and the storey it sits on. Absent outdoors. */
  readonly building?: number;
  readonly storey?: number;
}

/** A Nest (breakable, GDD §7.9). Plain Anchors are fine: variant defaults to world data's first. */
export interface NestAnchor extends Anchor {
  /** GDD variant id; world data maps it to HP, contents and model. */
  readonly variant?: string;
  /** Inside a building: index into MapData.buildings and the storey. Absent outdoors. */
  readonly building?: number;
  readonly storey?: number;
}

// ---- Stage 4 detail (D-EP-033): buildings with interiors, the jungle and interactables. All optional, so maps
// ---- without them load unchanged. Geometry stays in `prims` (walls, floors, stair ramps, roofs); these records
// ---- say what the geometry means, for nav, bots, vision, audio, the minimap and world spawns.

/** A box turned by yaw about its centre (`size` is the full extent), used for footprints and room volumes. */
export interface BoxVolume {
  readonly centre: Vec3;
  readonly size: Vec3;
  readonly yaw: number;
}

/** One floor of a building. Storey 0 is the ground floor; the roof is not a storey (Building.roof). */
export interface Storey {
  /** Walkable floor height (m). */
  readonly floorY: number;
  /** Clear height to the ceiling (m). */
  readonly height: number;
}

/** A room: an interior volume on one storey. Vision rays still use the prims; rooms are for audio, bots and the map. */
export interface Room {
  /** Index into MapData.buildings. */
  readonly building: number;
  readonly storey: number;
  readonly volume: BoxVolume;
}

/**
 * A hole in a building's shell or between rooms. The prims leave the gap; this records what passes through it.
 * `rooms` are the two sides as indices into MapData.rooms, −1 for outdoors.
 */
export interface Opening {
  readonly kind: 'door' | 'window' | 'hatch' | 'arch' | 'balcony';
  readonly rooms: readonly [number, number];
  /** Centre of the gap. */
  readonly centre: Vec3;
  readonly width: number;
  readonly height: number;
  /** Facing of the gap's outward normal (radians), toward `rooms[1]`. */
  readonly yaw: number;
  /** A hero can walk or mantle through (doors, arches, balconies; windows only if mantle-sized). */
  readonly passable: boolean;
}

/** A building (GDD §6 archetypes). Interiors are made of prims; this groups them. */
export interface Building {
  /** Stable name, unique on the map (e.g. 'hedgerow-belltower-dawn'). */
  readonly id: string;
  /** GDD archetype id (market hall, bell tower, …). Render and audio key their dressing on it. */
  readonly archetype: string;
  readonly footprint: BoxVolume;
  readonly storeys: readonly Storey[];
  /** Roof height; walkable roofs are reached by stairs, ladders, Vines or Chimneys. */
  readonly roof: { readonly y: number; readonly walkable: boolean };
  /** Where it stands: a LaneId (on that lane's edge), a JungleZone.id, or 'base'. */
  readonly zone: string;
}

/** A jungle area between lanes on one half (GDD §6.5): an outline on the ground plane and its main paths. */
export interface JungleZone {
  /** Stable name (e.g. 'west-dawn'). */
  readonly id: string;
  /** The half it lies in; zones on z = 0 belong to neither and use 'neutral'. */
  readonly half: Team;
  /** Polygon on the xz plane (y ignored), counter-clockwise seen from above. */
  readonly outline: readonly Vec3[];
  /** Main walking routes through it, as polylines; flank routes included. */
  readonly paths: readonly (readonly Vec3[])[];
}

/**
 * Something in the world a hero interacts with that is neither a shop nor an objective with its own field (GDD
 * §6/§7 Stage 4 list: e.g. a boon statue, a vantage point, a vent). sim/world spawns the ones that are entities.
 */
export interface InteractableAnchor extends Anchor {
  /** GDD kind id; world data maps it to behaviour. */
  readonly kind: string;
  readonly building?: number;
  readonly storey?: number;
}

/** Bot hints (GDD §6.7): safe spots behind towers and ambush spots near Thickets. */
export interface BotSpot {
  readonly kind: 'safe' | 'ambush';
  readonly team: Team;
  readonly pos: Vec3;
}

export interface MapData {
  readonly id: MapId;
  /** Player-facing name. */
  readonly name: string;
  /** Playable volume; heroes are kept inside. */
  readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
  /** Anything below this height has fallen out of the world. */
  readonly killY: number;
  readonly prims: readonly BlockoutPrim[];
  readonly lanes: readonly Lane[];
  readonly nav: NavGraph;
  readonly updrafts: readonly Updraft[];
  readonly climbs: readonly Climb[];
  readonly ledges: readonly Ledge[];
  /** Hero spawn points in each Home Roost, at least TEAM_SIZE per team; a team's n-th roster hero uses its n-th. */
  readonly spawns: readonly TeamAnchor[];
  readonly shops: readonly ShopAnchor[];
  /** Every Hawk, Heron, Warden, Shrine and Patron. */
  readonly structures: readonly StructureAnchor[];
  readonly thickets: readonly ThicketAnchor[];
  readonly nests: readonly NestAnchor[];
  /** Feather rune spots (mid-span on the rune bridges). */
  readonly runeSpots: readonly Anchor[];
  /** The two Egg Perches; the Egg spawns on one and the other is the Hatching Stone (GDD §7.11). */
  readonly eggPerches: readonly Anchor[];
  /** The Hollow (Roc pit); null on maps without it. */
  readonly hollow: { readonly centre: Vec3; readonly radius: number; readonly floorY: number } | null;
  readonly botSpots: readonly BotSpot[];
  /** Stage 4 detail; absent on maps without interiors. Rooms and openings index into these arrays. */
  readonly buildings?: readonly Building[];
  readonly rooms?: readonly Room[];
  readonly openings?: readonly Opening[];
  readonly jungle?: readonly JungleZone[];
  readonly interactables?: readonly InteractableAnchor[];
}
