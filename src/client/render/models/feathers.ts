/* eslint-disable @typescript-eslint/no-magic-numbers -- texture recipes: the numbers are the drawing */
/**
 * Procedural bird textures (style guide §7.1, §7.2 "Feathers", §8.2), generated once per session from seeded code, no
 * image files. Two atlases, both sRGB colour multipliers on the vertex colour:
 * - the SOLID atlas: 4 × 2 seamless tiles of surface pattern for the opaque body, gear and gun (feather scales, barred
 *   and mottled plumage, wood grain, leather, weave, tarsus scutes, and a flat white tile);
 * - the CARD atlas: 4 × 2 opaque feather patterns (plain vane, barred, mottled, spotted, the Peacock's eye, hair,
 *   cloth, wing blur) painted on solid feather geometry whose outline comes from `outline()`.
 * Painted, not photographic: flat blocks, soft gradients, dark crevices and light edges; detail in shape, not grain.
 */
import { ClampToEdgeWrapping, DataTexture, LinearFilter, LinearMipmapLinearFilter, RGBAFormat, SRGBColorSpace, UnsignedByteType } from 'three';

/** Solid atlas tiles (the `tile` of a Finish). */
export const TILE = { flat: 0, scales: 1, barred: 2, mottle: 3, wood: 4, leather: 5, weave: 6, rings: 7 } as const;
export const TILE_GRID = { cols: 4, rows: 2, px: 128 } as const;

/**
 * Feathers are solid tapered geometry (sculpt.ts `card`): an outline SHAPE gives the silhouette, so edges are clean at
 * every distance (no alpha test, no dither), and an opaque PATTERN cell paints the vane.
 */
export const SHAPE = { contour: 0, primary: 1, tail: 2, sickle: 3, ragged: 4, spoon: 5, eye: 6, hair: 7, quill: 8, down: 9, cloth: 10, blur: 11 } as const;
export const PATTERN = { plain: 0, barred: 1, mottled: 2, spotted: 3, eye: 4, hair: 5, cloth: 6, blur: 7 } as const;
/** A feather as an outline and a painted pattern. */
export type Feather = readonly [shape: number, pattern: number];
/** The feathers birds are dressed in. */
export const CARD = {
  contour: [SHAPE.contour, PATTERN.plain],
  primary: [SHAPE.primary, PATTERN.plain],
  tail: [SHAPE.tail, PATTERN.plain],
  sickle: [SHAPE.sickle, PATTERN.plain],
  ragged: [SHAPE.ragged, PATTERN.plain],
  spoon: [SHAPE.spoon, PATTERN.plain],
  eye: [SHAPE.eye, PATTERN.eye],
  hair: [SHAPE.hair, PATTERN.hair],
  quill: [SHAPE.quill, PATTERN.plain],
  down: [SHAPE.down, PATTERN.plain],
  ruff: [SHAPE.down, PATTERN.plain],
  cloth: [SHAPE.cloth, PATTERN.cloth],
  blur: [SHAPE.blur, PATTERN.blur],
  barred: [SHAPE.primary, PATTERN.barred],
  barredTail: [SHAPE.tail, PATTERN.barred],
  mottled: [SHAPE.contour, PATTERN.mottled],
  mottledTail: [SHAPE.tail, PATTERN.mottled],
  spotted: [SHAPE.primary, PATTERN.spotted],
  spottedTail: [SHAPE.tail, PATTERN.spotted],
} as const satisfies Record<string, Feather>;
export const CARD_GRID = { cols: 4, rows: 2, w: 128, h: 256 } as const;

/**
 * A feather outline: the left and right half-widths (shares of half the card's width) at s (0 root, 1 tip), and where
 * the rachis ends at the tip row (below 1 makes a notched, fishtail tip).
 */
export function outline(shape: number, s: number): readonly [number, number] {
  const sinp = (e: number, k: number): number => Math.max(0, Math.sin(Math.PI * Math.min(0.9999, s ** e))) ** k;
  switch (shape) {
    case SHAPE.contour:
      return [sinp(1.35, 0.5), sinp(1.35, 0.5)];
    case SHAPE.primary: {
      const w = sinp(1.6, 0.45);
      return [0.42 * w, 0.95 * w];
    }
    case SHAPE.tail: {
      const w = s < 0.86 ? 0.88 * Math.sqrt(clamp01(s * 6)) : 0.88 * Math.sqrt(Math.max(0, 1 - ((s - 0.86) / 0.14) ** 2));
      return [w, w];
    }
    case SHAPE.sickle: {
      const w = s < 0.16 ? Math.sqrt(s / 0.16) : (1 - (s - 0.16) / 0.84) ** 0.85;
      return [0.45 * w, 0.85 * w];
    }
    case SHAPE.ragged: {
      const w = Math.sqrt(clamp01(s * 4)) * (s > 0.85 ? 1 - 0.35 * (s - 0.85) / 0.15 : 1);
      return [0.95 * w, 0.95 * w];
    }
    case SHAPE.spoon: {
      const w = s < 0.6 ? 0.14 : 0.14 + 0.86 * Math.sqrt(Math.max(0, 1 - ((s - 0.8) / 0.2) ** 2));
      return [w, w];
    }
    case SHAPE.eye: {
      const w = s < 0.55 ? 0.12 + 0.5 * s : Math.max(0.12 + 0.5 * 0.55, 0.92 * Math.sqrt(Math.max(0, 1 - ((s - 0.78) / 0.22) ** 2)));
      return [s > 0.97 ? 0.92 * Math.sqrt(Math.max(0, 1 - ((s - 0.78) / 0.22) ** 2)) : w, s > 0.97 ? 0.92 * Math.sqrt(Math.max(0, 1 - ((s - 0.78) / 0.22) ** 2)) : w];
    }
    case SHAPE.hair:
      return [0.6 * sinp(1.1, 0.7), 0.6 * sinp(1.1, 0.7)];
    case SHAPE.quill:
      return [0.22 * (1 - s) ** 0.8, 0.22 * (1 - s) ** 0.8];
    case SHAPE.down:
      return [sinp(1.2, 0.35), sinp(1.2, 0.35)];
    case SHAPE.cloth:
      return [0.95, 0.95];
    default:
      return [1, 1];
  }
}

/** Where the rachis ends on the tip row (ragged feathers have a notched end). */
export const rachisTip = (shape: number): number => (shape === SHAPE.ragged ? 0.86 : 1);

type RGBA = [number, number, number, number];

const fract = (v: number): number => v - Math.floor(v);
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (e0: number, e1: number, v: number): number => {
  const t = clamp01((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** Integer hash → [0, 1). Deterministic: screenshots compare run to run. */
function hash(x: number, y: number, seed: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + seed * 2246822519;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** Smooth value noise on a lattice that wraps every `period` cells (so tiles stay seamless). */
function noise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const w = (i: number): number => ((i % period) + period) % period;
  const a = hash(w(xi), w(yi), seed);
  const b = hash(w(xi + 1), w(yi), seed);
  const c = hash(w(xi), w(yi + 1), seed);
  const d = hash(w(xi + 1), w(yi + 1), seed);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const fbm = (x: number, y: number, period: number, seed: number): number =>
  noise(x, y, period, seed) * 0.6 + noise(x * 2, y * 2, period * 2, seed + 7) * 0.3 + noise(x * 4, y * 4, period * 4, seed + 13) * 0.1;

// ---------------------------------------------------------------------------------------------------------------
// Solid tiles: (x, y) in pixels 0..127, v (y) runs along a loft from its start; feathers point toward the start.

const PX = TILE_GRID.px;

/**
 * Overlapping feather scales: round-tipped feathers in offset rows pointing toward low y, each row laid over the one
 * below it. A soft painted read: a lighter middle, a darker rim and a thin shadow under the edge of the row above.
 */
function scale(x: number, y: number, R = 16, sh = 16): number {
  const sw = R * 2;
  const centre = (row: number, px: number): number => {
    const off = ((row % 2) + 2) % 2 ? R : 0;
    return Math.round((px - off) / sw) * sw + off;
  };
  const top = Math.floor(y / sh);
  let own = -1;
  let t = 1;
  for (let row = top; row >= top - 2 && own < 0; row--) {
    for (const dx of [-sw, 0, sw]) {
      const cx = centre(row, x) + dx;
      const dist = Math.hypot(x - cx, y - (row * sh + R));
      if (dist < R * 1.12 && own < 0) {
        own = row;
        t = dist / (R * 1.12);
      }
    }
  }
  // Shadow cast by the row above's rim just below it.
  let shadow = 0;
  for (const dx of [-sw, 0, sw]) {
    const cx = centre(own + 1, x) + dx;
    const dist = Math.hypot(x - cx, y - ((own + 1) * sh + R));
    shadow = Math.max(shadow, 1 - smooth(R * 1.12, R * 1.12 + 3.5, dist));
  }
  // Soft: a hint of feathering under painted gradients, not fish scales.
  const body = 1 - 0.07 * smooth(0.55, 1, t) + 0.03 * (1 - t);
  return Math.min(1, body - 0.09 * shadow);
}

function solidTile(tile: number, x: number, y: number): number {
  switch (tile) {
    case TILE.scales:
      return scale(x, y);
    case TILE.barred: {
      // Black-and-white ladder bars over the scales (use with a pale vertex colour).
      const bar = smooth(0.38, 0.46, fract(y / 32)) * (1 - smooth(0.86, 0.94, fract(y / 32)));
      return scale(x, y) * (0.16 + 0.84 * bar);
    }
    case TILE.mottle: {
      // Bark mottling: dark vermiculation and pale speckles over soft scales.
      const n = fbm(x / 16, y / 16, 8, 3);
      const worm = Math.abs(Math.sin((x + 9 * fbm(x / 22, y / 22, 6, 5)) * 0.22 + y * 0.09));
      const speck = hash(x >> 2, y >> 2, 11) > 0.93 ? 1.18 : 1;
      // Blotches only: no feather rows, which would circle a loft end as concentric rings.
      return Math.min(1, (0.58 + 0.42 * smooth(0.25, 0.75, n)) * (0.92 + 0.08 * smooth(0.1, 0.5, worm)) * speck);
    }
    case TILE.wood: {
      // Grain along the length (y), soft growth lines, a darker knot now and then.
      const wob = 7 * fbm(x / 32, y / 64, 4, 21);
      const grain = 0.5 + 0.5 * Math.sin((x + wob) * 0.42);
      const streak = fbm(x / 6, y / 40, 21, 23);
      return 0.72 + 0.16 * grain * grain + 0.12 * streak;
    }
    case TILE.leather: {
      const peb = noise(x / 3, y / 3, 42, 31);
      const blot = fbm(x / 32, y / 32, 4, 37);
      return 0.8 + 0.1 * peb + 0.1 * blot;
    }
    case TILE.weave: {
      // Over-under basket weave of 16 px strands, each shaded across its width.
      const cx = Math.floor(x / 16);
      const cy = Math.floor(y / 16);
      const across = (cx + cy) % 2 === 0;
      const t = across ? fract(y / 16) : fract(x / 16);
      const along = across ? fract(x / 16) : fract(y / 16);
      return 0.62 + 0.38 * Math.sin(Math.PI * t) * (0.85 + 0.15 * Math.sin(Math.PI * along));
    }
    case TILE.rings: {
      // Tarsus scutes: bands every 16 px split by staggered seams, each scute domed.
      const band = Math.floor(y / 16);
      const yy = fract(y / 16);
      const xx = fract((x + (band % 2) * 16) / 32);
      const seam = Math.min(yy, 1 - yy) * 16;
      const side = Math.min(xx, 1 - xx) * 32;
      return 0.76 + 0.24 * smooth(0, 3, seam) * smooth(0, 2.5, side) * (0.9 + 0.1 * Math.sin(Math.PI * yy));
    }
    default:
      return 1;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Feather patterns, fully opaque: x in [-1, 1] across the card (0 is the rachis), y in [0, 1] root to tip. The
// geometry's outline cuts the shape; these paint a clean vane: a bright rachis with a soft shadow beside it, a
// darker root, a lighter tip, and barbs only as a whisper of shading.

const CW = CARD_GRID.w / 2;
const CH = CARD_GRID.h;
const GREY = (v: number): RGBA => [v, v, v, 1];

function vanePaint(x: number, y: number): number {
  const ax = Math.abs(x);
  const rachis = ax < 0.035 ? 0.14 : ax < 0.1 ? -0.07 * (1 - (ax - 0.035) / 0.065) : 0;
  const barbs = 0.025 * Math.sin((y * CH * 0.55 - ax * CW * 0.9) * 0.9);
  const along = 0.8 + 0.2 * smooth(0, 0.6, y);
  const edge = 0.05 * smooth(0.45, 0.95, ax);
  return Math.min(1, along + rachis + barbs + edge);
}

function pattern(cell: number, x: number, y: number): RGBA {
  const v = vanePaint(x, y);
  switch (cell) {
    case PATTERN.barred: {
      // Crisp black-and-white ladder bars (use with a pale vertex colour).
      const f = fract(y * 7 + 0.15);
      const bar = smooth(0.4, 0.46, f) * (1 - smooth(0.9, 0.96, f));
      return GREY(v * (0.12 + 0.88 * bar));
    }
    case PATTERN.mottled: {
      const m = smooth(0.32, 0.68, fbm(x * 3 + 5, y * 8, 64, 61));
      const fleck = hash(Math.floor((x + 1) * 20), Math.floor(y * 60), 67) > 0.93 ? 0.15 : 0;
      return GREY(Math.min(1, v * (0.62 + 0.38 * m) + fleck));
    }
    case PATTERN.spotted: {
      const spot = ((x - 0.12) / 0.5) ** 2 + ((y - 0.72) / 0.085) ** 2;
      const pale = 1 - smooth(0.85, 1, spot);
      return [v * 0.78 + pale * 0.3, v * 0.78 + pale * 0.28, v * 0.78 + pale * 0.25, 1];
    }
    case PATTERN.eye: {
      // The Peacock's train feather: bronze-green barbs below, the ocellus at the tip in crisp rings.
      const ey = 0.78;
      const r = Math.sqrt((x / 0.82) ** 2 + ((y - ey) / 0.2) ** 2);
      const heart = (x / 0.3) ** 2 + ((y - ey + 0.015) / 0.075) ** 2 - 0.3 * Math.max(0, (y - ey) / 0.075) * Math.abs(x / 0.3);
      const ring = (inner: number, outer: number): number => smooth(inner - 0.03, inner + 0.03, r) * (1 - smooth(outer - 0.03, outer + 0.03, r));
      if (heart < 1) return [0.08, 0.13, 0.48, 1];
      if (r < 0.52) return [0.06, 0.62, 0.72, 1];
      const bronze: RGBA = [0.78, 0.55, 0.18, 1];
      const green: RGBA = [0.18, 0.58, 0.3, 1];
      const gold: RGBA = [0.86, 0.78, 0.3, 1];
      if (r < 1.05) {
        const t1 = ring(0.52, 0.7);
        const t2 = ring(0.7, 0.88);
        const c = t1 > 0.5 ? bronze : t2 > 0.5 ? green : gold;
        return c;
      }
      const streak = 0.85 + 0.15 * Math.sin((y * CH * 0.7 - Math.abs(x) * CW) * 0.7);
      return [0.36 * streak, 0.62 * streak, 0.26 * streak, 1];
    }
    case PATTERN.hair: {
      // Strands painted along the plume.
      const strand = 0.5 + 0.5 * Math.sin((x * 9 + 0.6 * Math.sin(y * 9)) * Math.PI);
      return GREY(Math.min(1, (0.72 + 0.22 * strand) * (0.86 + 0.14 * y)));
    }
    case PATTERN.cloth: {
      const weave = 0.9 + 0.1 * Math.sin(x * CW * 1.6) * Math.sin(y * CH * 1.6);
      const stripe = Math.abs(Math.abs(x) - 0.74) < 0.06 ? 0.7 : 1;
      const hem = y > 0.9 ? 0.82 : 1;
      return GREY(weave * stripe * hem);
    }
    case PATTERN.blur: {
      // A wing beating: radial streaks fanning from the shoulder, densest at the ends of the stroke.
      const ang = Math.atan2(x, Math.max(y, 1e-3));
      const r = Math.hypot(x, y);
      const streak = 0.5 + 0.5 * Math.sin(ang * 26);
      const ends = smooth(0.6, 1.15, Math.abs(ang));
      return GREY(Math.min(1, 0.66 + 0.2 * streak + 0.2 * ends + 0.12 * smooth(0.6, 1, r)));
    }
    default:
      return GREY(v);
  }
}

// ---------------------------------------------------------------------------------------------------------------

function texture(width: number, height: number, fill: (px: number, py: number) => RGBA): DataTexture {
  const data = new Uint8Array(width * height * 4);
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const [r, g, b, a] = fill(px, py);
      const o = (py * width + px) * 4;
      data[o] = Math.round(clamp01(r) * 255);
      data[o + 1] = Math.round(clamp01(g) * 255);
      data[o + 2] = Math.round(clamp01(b) * 255);
      data[o + 3] = Math.round(clamp01(a) * 255);
    }
  }
  const t = new DataTexture(data, width, height, RGBAFormat, UnsignedByteType);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

let solid: DataTexture | null = null;
let cards: DataTexture | null = null;

/** The solid pattern atlas (shared by every sculpted bird). */
export function solidAtlas(): DataTexture {
  solid ??= texture(TILE_GRID.cols * PX, TILE_GRID.rows * PX, (px, py) => {
    const tile = Math.floor(py / PX) * TILE_GRID.cols + Math.floor(px / PX);
    const v = solidTile(tile, px % PX, py % PX);
    return [v, v, v, 1];
  });
  return solid;
}

/** The feather pattern atlas (opaque; shared by every sculpted bird). */
export function cardAtlas(): DataTexture {
  cards ??= texture(CARD_GRID.cols * CARD_GRID.w, CARD_GRID.rows * CARD_GRID.h, (px, py) => {
    const cell = Math.floor(py / CARD_GRID.h) * CARD_GRID.cols + Math.floor(px / CARD_GRID.w);
    const x = ((px % CARD_GRID.w) + 0.5) / CW - 1;
    const y = ((py % CARD_GRID.h) + 0.5) / CH;
    return pattern(cell, x, y);
  });
  return cards;
}

/** UV rectangle of a card cell: [u0, v0, u1, v1]. */
export function cardUv(cell: number): readonly [number, number, number, number] {
  const c = cell % CARD_GRID.cols;
  const r = Math.floor(cell / CARD_GRID.cols);
  return [c / CARD_GRID.cols, r / CARD_GRID.rows, (c + 1) / CARD_GRID.cols, (r + 1) / CARD_GRID.rows];
}
