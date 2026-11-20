/** Environment presentation constants (style guide §4.3, §5.8, §7.4, §11.3–§11.6). Model dimensions are art data. */
import type { Quality } from '../../app/contracts';

/** Baked vertex shading (§5.8 weathering, §7.4 AO) and §4.4 per-piece variation. */
export const SHADE = {
  /** Ground contact: 35 % darker at the foot of a wall, gone by 0.3 m. */
  contact: 0.35,
  contactBand: 0.3,
  /** Ground damp: 20 % darker at the foot, gone by 0.8 m. */
  damp: 0.2,
  dampBand: 0.8,
  /** Faces pointing down (under eaves, sills, balconies) are this much darker. */
  underside: 0.3,
  downFacing: -0.5,
  /** Interiors are darker in ambient (§10.3). */
  interior: 0.72,
  /** §4.4: value ±5 %, and a warm/cool tilt standing in for hue ±3°. */
  pieceValue: 0.05,
  pieceTilt: 0.03,
  hashA: 12.9898,
  hashB: 43758.5453,
  /** A chamfer never takes more than this share of a half-extent. */
  maxBevelShare: 0.45,
  /** uv wrap of very thin tubes uses at least this radius (keeps rope texel density sane). */
  minTubeRadius: 0.02,
} as const;

/**
 * Detail bands (§11.4): band 0 is LOD0-only detail (trims, chamfered small pieces, small props, interiors), band 1
 * reaches LOD1 (frames, shutters, rails, medium props), band 2 is always drawn (skins, roofs, trees, landmarks).
 * Visibility is the distance from the camera to the cell's bounds.
 */
export type Band = 0 | 1 | 2;
export const BANDS: readonly Band[] = [0, 1, 2];

/** Show distances (m) of bands 0 and 1 per quality; band 2 is always drawn, but at Low its cards (canopy, ivy) stop at `cards` m. Low draws band 2 only (§11.6: no trims). */
export const BAND_REACH: Readonly<Record<Quality, { readonly near: number; readonly mid: number; readonly cards: number }>> = {
  low: { near: 0, mid: 0, cards: 60 },
  medium: { near: 30, mid: 70, cards: Infinity },
  high: { near: 45, mid: 100, cards: Infinity },
};
/** §11.4: 10 % hysteresis on every switch. */
export const LOD_HYSTERESIS = 0.1;
/** Geometry is bucketed in square cells of this size (m), so distant detail drops out cell by cell. */
export const CELL = 32;

/** Visual pieces may project this far beyond a collision face (§5 intro); skins sit just proud of the prims. */
export const PROUD = { skin: 0.03, max: 0.25 } as const;

/**
 * Camera clearance (the player's first sight): visual-only dressing stays out of a cylinder round every spawn and shop
 * (boom plus shoulder plus `margin` wide, `height` tall), and fades within `fade` of the camera-to-hero line at runtime.
 */
export const CAMERA_CLEAR = { margin: 2.5, height: 9, fade: { near: 1.0, far: 1.4, dither: 0.25 } } as const;
