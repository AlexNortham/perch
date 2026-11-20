/**
 * District style kits (style guide §5, §7.2, §7.6): which library material and tint each part of a facade uses, per
 * FacadeStyle. Authored art data (magic numbers allowed, like the material recipes, D-RENDER-010).
 */
import type { FacadeStyle } from '../../../../sim/world/map';
import type { Paint } from '../mesher';

export interface StyleKit {
  readonly wall: Paint;
  readonly plinth: Paint;
  /** String courses, sills, lintels, copings, cornices. */
  readonly trim: Paint;
  readonly corner: 'quoin' | 'post' | 'none';
  readonly quoin: Paint;
  /** Structural timber: posts, beams, brackets, bargeboards, rafters. */
  readonly timber: Paint;
  /** Window and door frames (painted timber in a muted district colour). */
  readonly frame: Paint;
  readonly shutter: Paint;
  readonly door: Paint;
  readonly roof: Paint;
  readonly ridge: Paint;
  /** Dark timber posts, rails and braces over plaster (Lantern Row, §7.6). */
  readonly halfTimber: boolean;
  /** Heads of windows: a stone lintel with keystone, a timber lintel, or a brick soldier arch (§5.2). */
  readonly head: 'keystone' | 'timber' | 'soldier';
  /** Stone cornice with steps, or timber eaves with rafter tails. */
  readonly eaves: 'stone' | 'timber';
  /** Awning stripe tint (muted district colour, never a flock primary, §5.6). */
  readonly awning: number;
}

const iron: Paint = { mat: 'iron' };
export const IRON = iron;
export const BRASS: Paint = { mat: 'brass' };
export const GLASS: Paint = { mat: 'glass' };
export const LIT: Paint = { mat: 'windowLit' };
export const LANTERN: Paint = { mat: 'lantern' };
export const TWIG: Paint = { mat: 'twig' };
export const ROPE: Paint = { mat: 'rope' };
export const BARK: Paint = { mat: 'bark' };
export const MOSS: Paint = { mat: 'moss' };
export const LEAF: Paint = { mat: 'leafCard' };
export const IVY: Paint = { mat: 'leafCard', tint: 0x6f8f62 };
export const IVY_DARK: Paint = { mat: 'leafCard', tint: 0x4f6a48 };
export const FEATHER: Paint = { mat: 'featherCard' };
export const BOARDS: Paint = { mat: 'boards' };
/** Landing boards: pale worn timber (§1.4 affordance language). */
export const LANDING: Paint = { mat: 'boards', tint: 0xf2e8d6 };
export const STRAW: Paint = { mat: 'thatch' };
export const CANVAS: Paint = { mat: 'canvas' };
export const SOOT: Paint = { mat: 'brickBurnt', shade: 0.45 };
export const EGG_BLUE: Paint = { mat: 'plaster', tint: 0xcfe0e6, shade: 1.25 };
export const EGG_CREAM: Paint = { mat: 'plaster', tint: 0xf2e6cf, shade: 1.25 };
export const EARTH: Paint = { mat: 'earth' };
export const STONE: Paint = { mat: 'granite' };
export const FLAGS: Paint = { mat: 'flagstone' };
export const WATER: Paint = { mat: 'water' };
export const HEDGE: Paint = { mat: 'hedge' };
export const POT: Paint = { mat: 'roofClay', tint: 0xd8b0a0 };
/** Faded flock tints for environment dressing (§7.6): never the pure flock colours. */
export const FADED = { dawn: 0xb48a4e, dusk: 0x6e6aa8, neutral: 0xc9bc9c } as const;

const timber: Paint = { mat: 'timber' };
const timberDark: Paint = { mat: 'timberDark' };

export const STYLES: Readonly<Record<FacadeStyle, StyleKit>> = {
  'hedgerow-brick': {
    wall: { mat: 'brick' }, plinth: { mat: 'granite', shade: 0.85 }, trim: { mat: 'ashlar' }, corner: 'quoin', quoin: { mat: 'ashlar' },
    timber, frame: { mat: 'boards', tint: 0xd9cdb2 }, shutter: { mat: 'timber', tint: 0x9db08f }, door: { mat: 'timber', tint: 0x7e9a7a },
    roof: { mat: 'roofClay' }, ridge: { mat: 'roofClay', shade: 0.9 }, halfTimber: false, head: 'soldier', eaves: 'timber', awning: 0x8c9a74,
  },
  'hedgerow-stone': {
    wall: { mat: 'ashlar' }, plinth: { mat: 'granite', shade: 0.8 }, trim: { mat: 'sandstone' }, corner: 'quoin', quoin: { mat: 'granite' },
    timber, frame: { mat: 'boards', tint: 0xcfc6b4 }, shutter: { mat: 'timber', tint: 0x93a3b5 }, door: { mat: 'timber', tint: 0x8f6a52 },
    roof: { mat: 'roofClay', tint: 0xe6d0c4 }, ridge: { mat: 'roofClay', shade: 0.85 }, halfTimber: false, head: 'keystone', eaves: 'stone', awning: 0x9a7e66,
  },
  'market-stone': {
    wall: { mat: 'ashlar', tint: 0xe6dccb }, plinth: { mat: 'granite', shade: 0.85 }, trim: { mat: 'sandstone', tint: 0xf0e4d0 }, corner: 'quoin', quoin: { mat: 'brick', tint: 0xd8b8b0 },
    timber: timberDark, frame: { mat: 'boards', tint: 0xb9b2a0 }, shutter: { mat: 'timber', tint: 0x8b9a86 }, door: { mat: 'timberDark' },
    roof: { mat: 'roofSlate' }, ridge: { mat: 'verdigris' }, halfTimber: false, head: 'keystone', eaves: 'stone', awning: 0x7d8a8c,
  },
  'jungle-brick': {
    wall: { mat: 'brickBurnt' }, plinth: { mat: 'granite', shade: 0.8 }, trim: { mat: 'granite', tint: 0xe0d8cc }, corner: 'quoin', quoin: { mat: 'granite' },
    timber: timberDark, frame: { mat: 'boards', tint: 0xc7b89a }, shutter: { mat: 'timber', tint: 0x8a9a78 }, door: { mat: 'timberRed' },
    roof: { mat: 'roofClay', tint: 0xe0c4b8 }, ridge: { mat: 'roofClay', shade: 0.8 }, halfTimber: false, head: 'soldier', eaves: 'timber', awning: 0xa08060,
  },
  'jungle-timber': {
    wall: { mat: 'plasterOchre' }, plinth: { mat: 'cobble', shade: 0.9 }, trim: { mat: 'timberDark' }, corner: 'post', quoin: timberDark,
    timber: timberDark, frame: { mat: 'timberDark' }, shutter: { mat: 'timber', tint: 0xb59a7a }, door: { mat: 'timberDark' },
    roof: { mat: 'roofShingle' }, ridge: { mat: 'timberDark' }, halfTimber: true, head: 'timber', eaves: 'timber', awning: 0x8f7a5a,
  },
  'pinewood-birdhouse': {
    wall: { mat: 'timberRed' }, plinth: { mat: 'granite', shade: 0.75 }, trim: { mat: 'timber', tint: 0xd9c4a8 }, corner: 'post', quoin: timberDark,
    timber, frame: { mat: 'boards', tint: 0xe0d2b8 }, shutter: { mat: 'timber', tint: 0x7f8f74 }, door: { mat: 'timberDark' },
    roof: { mat: 'roofShingle' }, ridge: { mat: 'timberDark' }, halfTimber: false, head: 'timber', eaves: 'timber', awning: 0x7e8a64,
  },
  'woven-reed': {
    wall: TWIG, plinth: { mat: 'earth' }, trim: timber, corner: 'post', quoin: timber,
    timber, frame: timber, shutter: TWIG, door: TWIG,
    roof: STRAW, ridge: STRAW, halfTimber: false, head: 'timber', eaves: 'timber', awning: 0x8f8a64,
  },
  'hollow-trunk': {
    wall: BARK, plinth: BARK, trim: { mat: 'timber', tint: 0xcdb89a }, corner: 'none', quoin: BARK,
    timber, frame: { mat: 'timber', tint: 0xcdb89a }, shutter: { mat: 'timber', tint: 0xa8b28f }, door: { mat: 'timberRed' },
    roof: { mat: 'roofShingle' }, ridge: { mat: 'timberDark' }, halfTimber: false, head: 'timber', eaves: 'timber', awning: 0x7e8a64,
  },
  dovecote: {
    wall: { mat: 'plaster', tint: 0xf4efe6 }, plinth: { mat: 'granite', shade: 0.85 }, trim: { mat: 'ashlar' }, corner: 'quoin', quoin: { mat: 'ashlar' },
    timber, frame: { mat: 'boards', tint: 0xd0c4aa }, shutter: { mat: 'timber', tint: 0x9db08f }, door: { mat: 'timberDark' },
    roof: { mat: 'roofSlate' }, ridge: { mat: 'verdigris' }, halfTimber: false, head: 'keystone', eaves: 'stone', awning: 0x8c9a74,
  },
  belfry: {
    wall: { mat: 'ashlar', tint: 0xe0d6c4 }, plinth: { mat: 'granite', shade: 0.8 }, trim: { mat: 'sandstone', tint: 0xf0e4d0 }, corner: 'quoin', quoin: { mat: 'brick' },
    timber: timberDark, frame: { mat: 'boards', tint: 0xb9b2a0 }, shutter: { mat: 'timber', tint: 0x8b9a86 }, door: { mat: 'timberDark' },
    roof: { mat: 'roofSlate' }, ridge: { mat: 'verdigris' }, halfTimber: false, head: 'keystone', eaves: 'stone', awning: 0x7d8a8c,
  },
  'base-stone': {
    wall: { mat: 'sandstone' }, plinth: { mat: 'granite', shade: 0.8 }, trim: { mat: 'ashlar' }, corner: 'quoin', quoin: { mat: 'ashlar' },
    timber, frame: { mat: 'boards', tint: 0xd0c4aa }, shutter: { mat: 'timber', tint: 0xa89070 }, door: { mat: 'timberDark' },
    roof: { mat: 'roofClay' }, ridge: { mat: 'brass' }, halfTimber: false, head: 'keystone', eaves: 'stone', awning: 0x9a8a6a,
  },
};
