/**
 * The dressing descriptor (D-EP-047): what the Environment Artist needs to generate the visuals over the collision
 * prims, deterministically. MapData stays the collision and nav truth; this says what each building and street
 * should look like. `buildings` runs parallel to MapData.buildings (same index). Owner: Level Designer. Until the
 * Architect folds these fields into MapData (interface request, W5 Level report), read it with loadDressing(id).
 */
import type { BoxVolume, Vec3 } from '../../core/contracts';

/** District facade styles, for variety: walls, trims, roof tiles and window shapes key on these. */
export type FacadeStyle =
  | 'base-stone' | 'hedgerow-brick' | 'hedgerow-stone' | 'market-stone' | 'jungle-brick' | 'jungle-timber'
  | 'pinewood-birdhouse' | 'woven-reed' | 'hollow-trunk' | 'dovecote' | 'belfry';

export interface RoofDress {
  /** flat (parapet), gable (30°, walkable), steep (50°), spire (Bell Tower), deck (tree crown, dovecote top). */
  readonly style: 'flat' | 'gable' | 'steep' | 'spire' | 'deck';
  /** A woven nest crowns the roof (D-EP-048); on walkable roofs it sits clear of the walking area's middle. */
  readonly nestCrown: boolean;
  readonly pitchDeg: number;
  /** Ridge direction for gables; null otherwise. */
  readonly ridge: 'x' | 'z' | null;
  /** Top of the walls. */
  readonly eaves: number;
  /** Highest point (ridge, spire tip or walkable top). */
  readonly top: number;
}

/** A door, window or shopfront drawn on a wall that has no gameplay opening there (solid fill buildings). */
export interface FacadeMark {
  readonly kind: 'door' | 'window' | 'shopfront';
  /** Centre of the mark on the wall's outer face. */
  readonly centre: Vec3;
  readonly width: number;
  readonly height: number;
  /** Outward normal of the wall. */
  readonly yaw: number;
}

export interface StairDress {
  readonly from: Vec3;
  readonly to: Vec3;
  readonly width: number;
}

export interface BuildingDress {
  readonly style: FacadeStyle;
  /** False for solid fill blocks (no interior); their walls get `marks` instead of Openings. */
  readonly enterable: boolean;
  readonly roof: RoofDress;
  readonly marks: readonly FacadeMark[];
  /** Balcony decks (rail on the outer edge). */
  readonly balconies: readonly BoxVolume[];
  /** Landing boards under upper openings (style guide §1.1): each matches a collision prim, so dress them as
   * standable. Any other ledge, sill or rail must stay ≤ 0.25 m deep (decoration only). */
  readonly landings: readonly BoxVolume[];
  readonly stairs: readonly StairDress[];
}

/**
 * Street, jungle and interior props. `solid` ones skin a collision prim of the same box; the rest are dressing only
 * (no collision) and must not block a lane, door or stair. Old Mossmarket is built by and for birds (D-EP-048):
 * - street life: seed stalls and feeders, bird baths and fountains, worm beds, insect hives, nesting-material piles
 *   (twigs, moss, wool), feather banners, seed sacks and crates;
 * - perching: roost rails and perch poles (solid ones are mantle ledges), nest crowns on roofs, wires strung between
 *   buildings (dressing only; the walkable versions are rope walkways in the prims);
 * - the layered jungle: canopy, roots, hollows, nests in branches, reed beds, bramble, moss, ivy, mushrooms.
 */
export type PropKind =
  | 'crate' | 'barrel' | 'cart' | 'planter' | 'hedge' | 'lantern' | 'bench' | 'sacks' | 'counter' | 'logs'
  | 'well' | 'stall' | 'table' | 'shelf' | 'signpost'
  | 'seed-stall' | 'feeder' | 'bird-bath' | 'fountain' | 'worm-bed' | 'insect-hive' | 'nest-pile' | 'feather-banner'
  | 'roost-rail' | 'perch-pole' | 'nest-crown' | 'wire' | 'rope-walkway' | 'dovecote-boxes'
  | 'tree' | 'pine' | 'canopy' | 'roots' | 'hollow' | 'branch-nest' | 'reeds' | 'bramble' | 'bush' | 'flowers' | 'ivy'
  | 'moss' | 'mushrooms';

export interface PropAnchor {
  readonly kind: PropKind;
  /** Centre of the prop's base. */
  readonly pos: Vec3;
  readonly yaw: number;
  /** Full extent (x across, y up, z along the yaw). */
  readonly size: Vec3;
  /** A LaneId, a JungleZone id, a building id (furnishing) or 'base'. */
  readonly zone: string;
  readonly solid: boolean;
}

export interface MapDressing {
  readonly buildings: readonly BuildingDress[];
  readonly props: readonly PropAnchor[];
}
