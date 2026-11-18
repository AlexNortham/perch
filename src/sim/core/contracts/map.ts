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

/** A vertical traversal (GDD §3.8): Chimneys (warm-air shafts, 1.5 m radius) and Vines (on walls and trees). */
export interface Climb {
  readonly kind: 'chimney' | 'vine';
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

/** Link types bots path over (GDD §6.7). */
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
  readonly nests: readonly Anchor[];
  /** Feather rune spots (mid-span on the rune bridges). */
  readonly runeSpots: readonly Anchor[];
  /** The two Egg Perches; the Egg spawns on one and the other is the Hatching Stone (GDD §7.11). */
  readonly eggPerches: readonly Anchor[];
  /** The Hollow (Roc pit); null on maps without it. */
  readonly hollow: { readonly centre: Vec3; readonly radius: number; readonly floorY: number } | null;
  readonly botSpots: readonly BotSpot[];
}
