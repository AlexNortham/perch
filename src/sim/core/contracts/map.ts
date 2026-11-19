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
  /**
   * Solid prims only: what it blocks. Absent = everything (today's prims). 'movement': heroes and units, but not
   * sight, bullets, projectiles or areas (a shot window's invisible filler, GDD §6.8). 'sight': vision and `unit`
   * targeting only (an ivy curtain; sim/world ignores it within 3 m of the viewer).
   */
  readonly blocks?: 'movement' | 'sight';
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
 * Link types bots path over (GDD §6.7). Doors and stairs use 'walk', ladders 'vine', hatches and skylights 'drop',
 * leap windows 'mantle'. A Bough Spring is a 'walk' link onto its pad that carries `spring` (GDD §6.7 calls it a
 * spring link; a field keeps the union closed so existing exhaustive tables compile).
 */
export type NavLinkKind = 'walk' | 'jump' | 'dashJump' | 'mantle' | 'chimney' | 'vine' | 'updraft' | 'drop';

export interface NavLink {
  readonly from: number;
  readonly to: number;
  readonly kind: NavLinkKind;
  /** Index into MapData.springs: walking onto that pad launches the bot to `to`. */
  readonly spring?: number;
}

/** Navigation graph for bots. Links are one-way; add both for two-way. */
export interface NavGraph {
  readonly nodes: readonly Vec3[];
  readonly links: readonly NavLink[];
  /** Per node: index into MapData.rooms, −1 outdoors (GDD §6.7). Absent on maps without interiors. */
  readonly nodeRoom?: readonly number[];
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
  /** Both flocks may use it (the Magpie Den, GDD §7.15); `team` is then the half it stands in. Default false. */
  readonly neutral?: boolean;
}

/** Thicket families (GDD §7.8); the tier no longer implies the family. */
export type ThicketFamily = 'beetles' | 'weasels' | 'rats' | 'toads' | 'badgers';

export interface ThicketAnchor extends Anchor {
  readonly tier: ThicketTier;
  /** Default by tier, as in Stage 3: 1 beetles, 2 weasels, 3 badgers. */
  readonly family?: ThicketFamily;
  /** Indoor camps: index into MapData.buildings and the storey it sits on. Absent outdoors. */
  readonly building?: number;
  readonly storey?: number;
}

/** A Nest (breakable, GDD §7.9). Plain Anchors are fine: the variant defaults to 'twig'. */
export interface NestAnchor extends Anchor {
  /** 'twig', 'woven' or 'keepsake'; world data maps it to HP, drops and model. */
  readonly variant?: 'twig' | 'woven' | 'keepsake';
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

/**
 * An interior volume (GDD §6.11): one storey, cellar or the Cellar Run. Vision and shots still use the prims; rooms
 * drive sound (−6 dB and a 2 kHz low-pass heard from outside), bots, the minimap's ▲/▼ and the room rules below.
 */
export interface Room {
  /** Index into MapData.buildings, or −1 for the Cellar Run and the Magpie Den. */
  readonly building: number;
  /** Storey index; −1 for cellars and the Cellar Run. */
  readonly storey: number;
  readonly volume: BoxVolume;
  /** 'hide': a bird hide (hidden while wholly inside, GDD §7.15); 'tunnel': the Cellar Run (+30% run speed). */
  readonly tag?: 'hide' | 'tunnel';
}

/**
 * A hole in a building's shell or between rooms (GDD §6.8 kit). The prims leave the gap (a shot window also gets a
 * `blocks: 'movement'` filler prim); this records what passes through it. `rooms` are the two sides as indices into
 * MapData.rooms, −1 for outdoors.
 */
export interface Opening {
  /** door, shot window, leap window, hatch, skylight, arch, balcony door, street grate. */
  readonly kind: 'door' | 'window' | 'leap' | 'hatch' | 'skylight' | 'arch' | 'balcony' | 'grate';
  readonly rooms: readonly [number, number];
  /** Centre of the gap. */
  readonly centre: Vec3;
  readonly width: number;
  readonly height: number;
  /** Facing of the gap's outward normal (radians), toward `rooms[1]`. */
  readonly yaw: number;
  /** A hero can walk, mantle or drop through (everything but shot windows). */
  readonly passable: boolean;
  /** An ivy curtain hangs in it (GDD §6.8): its `blocks: 'sight'` prim is in `prims`. */
  readonly curtain?: boolean;
  /** Physics stops the Egg carrier here (the Cellar Run's stair heads, GDD §7.15). */
  readonly blocksEggCarrier?: boolean;
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
 * Jungle and interior interactables with a single anchor (GDD §§7.14, 7.15). None needs a key (D-EP-039): Berries are
 * eaten by walking within reach, Bell Feeders broken by melee, Lookouts work by standing near. sim/world spawns the
 * Berries (pickups) and Feeders (structures) and reads the rest. Ivy curtains are Openings; Hides and the Cellar Run
 * are Rooms; Bough Springs are MapData.springs.
 */
export interface InteractableAnchor extends Anchor {
  readonly kind: 'berry' | 'feeder' | 'lookout';
  readonly building?: number;
  readonly storey?: number;
  /** A Feeder that forms one hybrid camp with a Thicket (the Granary's Rats): index into MapData.thickets. */
  readonly camp?: number;
}

/** A Bough Spring (GDD §7.15): stepping onto the pad launches a hero along an authored arc to `land`. */
export interface Spring {
  readonly pad: Vec3;
  /** Pad radius (m). */
  readonly radius: number;
  readonly land: Vec3;
  /** Height of the arc's apex (m, world y). */
  readonly apexY: number;
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
  readonly springs?: readonly Spring[];
}
