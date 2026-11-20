/* eslint-disable @typescript-eslint/no-magic-numbers -- authored anatomy: the numbers are the proportions */
/**
 * Bird anatomy for sculpted birds (style guide §8.1–§8.3): egg forms, eyes with lids and catchlights, two-part beaks
 * with a working jaw, scaled legs, feet with jointed toes and glossy claws, layered folded wings that hold the gun,
 * fanned tails and feather shingles. Every helper works in the frame of the bone it is given and scales its detail
 * to the level (sculpted.ts).
 */
import { Matrix4, SphereGeometry, TorusGeometry } from 'three';
import { CARD, TILE } from './feathers';
import type { Feather } from './feathers';
import type { Detail } from './sculpted';
import { frameAt, hinge, inFrame, jitter, mix, shade } from './sculpt';
import type { Finish, Morphs, Paint, Ring, Sculpt, Surface, V3 } from './sculpt';

// ---------------------------------------------------------------------------------------------------------------
// Small vector helpers on tuples.

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export function norm(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** Rotate a vector about x (pitch), then y (yaw). */
export function turn(a: V3, pitch: number, yaw: number): V3 {
  const [x, y0, z0] = a;
  const y = y0 * Math.cos(pitch) - z0 * Math.sin(pitch);
  const z = y0 * Math.sin(pitch) + z0 * Math.cos(pitch);
  return [x * Math.cos(yaw) + z * Math.sin(yaw), y, -x * Math.sin(yaw) + z * Math.cos(yaw)];
}

/** Common finishes. */
export const FEATHER: Finish = { tile: TILE.scales, size: 0.13 };
export const GLOSSY: Finish = { gloss: 0.85 };
export const BILL: Finish = { gloss: 0.6 };
export const SKIN: Finish = { gloss: 0.25 };

// ---------------------------------------------------------------------------------------------------------------

export interface OvoidOptions {
  readonly n?: number;
  readonly seg?: number;
  readonly paint?: Paint;
  readonly finish?: Finish;
  /** Egg shape: > 0 fuller toward +z, < 0 toward -z. */
  readonly egg?: number;
  readonly rot?: V3;
  readonly morph?: Morphs;
}

/** An egg-shaped solid along z with semi-axes r (x, y, z), poles at ±z. */
export function ovoid(k: Sculpt, at: V3, r: V3, o: OvoidOptions = {}): Surface {
  const n = o.n ?? 12;
  const rings: Ring[] = [];
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * Math.PI;
    const z = -Math.cos(u);
    const s = Math.sin(u) * (1 + (o.egg ?? 0) * z);
    rings.push({ c: [0, 0, z * r[2]], w: r[0] * s, up: r[1] * s });
  }
  return k.loft(rings, { seg: o.seg ?? 16, at, ...(o.rot && { rot: o.rot }), ...(o.paint !== undefined && { paint: o.paint }), finish: o.finish ?? FEATHER, ...(o.morph && { morph: o.morph }) });
}

// ---------------------------------------------------------------------------------------------------------------

export interface EyeStyle {
  readonly r: number;
  readonly iris: number;
  /** Eye-ring or orbital skin colour, and its tube thickness (m, 1–2 cm). */
  readonly ring: number;
  readonly ringW?: number;
  /** Lid colour (feathers or skin round the eye). */
  readonly lid: number;
  /** Pupil share of the iris (style guide: 40–55 %). */
  readonly pupil?: number;
  readonly sclera?: number;
}

/**
 * An eye at `at` looking along `look` (head frame): a glossy eyeball painted with pupil, iris and limbal ring, a
 * bright catchlight upper front, an orbital ring and two lids that meet on the blink morph.
 */
export function eye(k: Sculpt, at: V3, look: V3, s: EyeStyle, d: Detail): void {
  if (d.level >= 3) return;
  const F = frameAt(at, look);
  const r = s.r;
  const pupil = s.pupil ?? 0.48;
  const irisAngle = 0.86;
  const sclera = s.sclera ?? 0x2a1d14;
  const ball = new SphereGeometry(r, d.n(10, 5), d.n(7, 3));
  ball.rotateX(Math.PI / 2);
  k.mesh(ball, {
    frame: F,
    finish: GLOSSY,
    paint: (p) => {
      const th = Math.acos(Math.max(-1, Math.min(1, p.z / r)));
      if (th < irisAngle * pupil) return 0x050506;
      if (th < irisAngle) return mix(shade(s.iris, 1.15), shade(s.iris, 0.62), th / irisAngle);
      return sclera;
    },
  });
  if (d.level < 2) {
    // Catchlight: a bright white glint in the upper front (emissive 0.85).
    k.mesh(new SphereGeometry(r * 0.16, 5, 3), { frame: F, at: [r * 0.12, r * 0.42, r * 0.9], scale: [1, 1, 0.45], paint: 0xffffff, finish: { glow: 0.85, gloss: 1 } });
  }
  if (d.level < 2) {
    const ringW = s.ringW ?? r * 0.2;
    k.mesh(new TorusGeometry(r * 0.94, ringW, 3, d.n(12, 8)), { frame: F, at: [0, 0, r * 0.4], paint: s.ring, finish: SKIN });
    // Lids: caps about +y and -y just outside the eye; they rotate to meet across the front on the blink.
    const lid = (upper: boolean): void => {
      const cap = new SphereGeometry(r * 1.16, d.n(8, 6), 3, 0, Math.PI * 2, 0, upper ? 0.62 : 0.78);
      if (!upper) cap.rotateX(Math.PI);
      const close = hinge([0, 0, 0], [1, 0, 0], upper ? 0.98 : -0.86);
      k.mesh(cap, { frame: F, paint: s.lid, finish: SKIN, morph: { blink: inFrame(F, close) } });
    };
    if (d.level === 0) {
      lid(true);
      lid(false);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------

export interface BeakStyle {
  /** Base centre on the face (head frame), length along +z, half-width and the two mandibles' depths at the base. */
  readonly at: V3;
  readonly len: number;
  readonly w: number;
  readonly up: number;
  readonly dn: number;
  /** Downward curve of the culmen at the tip (m), the hooked tip's length, and an upward lift (toucan, -). */
  readonly curve?: number;
  readonly hook?: number;
  readonly base: number;
  readonly tip: number;
  readonly lower?: number;
  /** Bands of colour along the upper mandible: [t, hex] (Toucan). */
  readonly bands?: readonly (readonly [number, number])[];
  /** Mouth-corner colour (rictus) and gape width multiplier (Nightjar: huge). */
  readonly gape?: number;
  /** Serrated cutting edge: teeth per side. */
  readonly teeth?: number;
  /** How far the lower mandible opens on the jaw morph (rad), and extra on the display morph. */
  readonly open?: number;
  readonly displayOpen?: number;
  /** Lower mandible length share. */
  readonly lowerLen?: number;
}

/** Two mandibles with a flat cutting edge, nostrils, a tip-to-base gradient and a jaw that opens on the morph. */
export function beak(k: Sculpt, s: BeakStyle, d: Detail): void {
  const n = d.n(9, 2);
  const seg = d.n(10, 3);
  const curve = s.curve ?? 0;
  const hook = s.hook ?? 0;
  const paintAlong = (t: number): number => {
    if (s.bands) {
      let c = s.base;
      for (const [bt, hex] of s.bands) if (t >= bt) c = hex;
      return c;
    }
    return mix(s.base, s.tip, t * t);
  };
  const upper: Ring[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const taper = Math.pow(1 - t, 0.85);
    const y = -curve * t * t - hook * Math.max(0, (t - 0.82) / 0.18) ** 2;
    const z = s.len * t - hook * 0.4 * Math.max(0, (t - 0.82) / 0.18) ** 2;
    upper.push({ c: [s.at[0], s.at[1] + y, s.at[2] + z], w: Math.max(0, s.w * taper), up: Math.max(0, s.up * taper), dn: Math.max(0, s.up * 0.18 * taper) });
  }
  k.loft(upper, { seg, paint: (t, a) => (Math.sin(a) < -0.2 ? shade(paintAlong(t), 0.7) : paintAlong(t)), finish: BILL });
  // Lower mandible, hinged at the base: opens on the jaw morph (and wider on the display morph).
  const ll = s.lowerLen ?? 0.9;
  const lower: Ring[] = [];
  const gapeW = s.gape ?? 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const taper = Math.pow(1 - t, 0.8);
    const y = -s.up * 0.12 - curve * (t * ll) * (t * ll);
    lower.push({ c: [s.at[0], s.at[1] + y, s.at[2] + s.len * ll * t - s.len * 0.04], w: Math.max(0, s.w * 0.94 * taper * (t < 0.2 ? gapeW : 1)), up: Math.max(0, s.dn * 0.15 * taper), dn: Math.max(0, s.dn * taper) });
  }
  const pivot: V3 = [s.at[0], s.at[1] - s.up * 0.05, s.at[2] - s.len * 0.04];
  const morph: Morphs = {
    jaw: hinge(pivot, [1, 0, 0], s.open ?? 0.3),
    ...(s.displayOpen !== undefined && { display: hinge(pivot, [1, 0, 0], s.displayOpen) }),
  };
  k.loft(lower, { seg, paint: (t) => shade(s.lower ?? paintAlong(t * ll), 0.9), finish: BILL, morph });
  // The gape's inside (dark) so an open bill shows a mouth, not a hole.
  if (d.level < 2) k.loft(
    [
      { c: [s.at[0], s.at[1] - s.up * 0.08, s.at[2] - s.len * 0.02], w: s.w * 0.85 * gapeW, up: 0.002, dn: s.up * 0.12 },
      { c: [s.at[0], s.at[1] - s.up * 0.08 - curve * 0.25, s.at[2] + s.len * 0.5], w: s.w * 0.4, up: 0.001, dn: s.up * 0.05 },
      { c: [s.at[0], s.at[1] - s.up * 0.08 - curve * 0.6, s.at[2] + s.len * 0.8], w: 0, up: 0, dn: 0 },
    ],
    { seg: d.n(6, 3), paint: 0x5a2630, finish: SKIN, morph: { jaw: hinge(pivot, [1, 0, 0], (s.open ?? 0.3) * 0.5), ...(s.displayOpen !== undefined && { display: hinge(pivot, [1, 0, 0], s.displayOpen * 0.5) }) } },
  );
  if (d.level < 2) {
    // Nostrils near the base, and serrations along the cutting edge.
    for (const side of [1, -1]) {
      const t = 0.14;
      k.mesh(new SphereGeometry(1, 5, 3), { at: [s.at[0] + side * s.w * 0.62, s.at[1] + s.up * 0.42, s.at[2] + s.len * t], scale: [s.w * 0.12, s.up * 0.08, s.len * 0.05], paint: 0x14100c, finish: SKIN });
      for (let i = 0; i < (d.level === 0 ? (s.teeth ?? 0) : 0); i++) {
        const t2 = 0.15 + (0.75 * i) / Math.max(1, (s.teeth ?? 1) - 1);
        const taper = Math.pow(1 - t2, 0.85);
        const y = s.at[1] - curve * t2 * t2 - s.up * 0.16 * taper;
        const z = s.at[2] + s.len * t2;
        k.loft(
          [
            { c: [s.at[0] + side * s.w * taper * 0.92, y, z], w: s.len * 0.012, up: s.up * 0.05 * taper, dn: 0 },
            { c: [s.at[0] + side * s.w * taper * 0.92, y - s.up * 0.12 * taper, z + s.len * 0.01], w: 0, up: 0, dn: 0 },
          ],
          { seg: 4, ref: [0, 0, 1], paint: shade(paintAlong(t2), 0.75), finish: BILL },
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------

export interface LegStyle {
  /** Bare tarsus and toe colour, claw colour, and the leg's thickness (m). */
  readonly skin: number;
  readonly claw: number;
  readonly thick: number;
  /** Feathered thigh colour (and the trouser fringe), or none for a bare leg. */
  readonly thigh?: number;
  /** Toes: yaw from forward (rad) and length (m); the back toe has yaw ≈ π. */
  readonly toes: readonly { readonly yaw: number; readonly len: number; readonly claw?: number; readonly r?: number }[];
  readonly clawLen: number;
  /** Thigh feather card cell and how far the fringe hangs (share of the thigh). */
  readonly fringe?: number;
  readonly fringeCell?: Feather;
  /**
   * The thigh is the implicit body's (D-ART-008): no loft, only the fringe, hung this far from the bone (m) at this
   * share of the thigh's length.
   */
  readonly skinned?: { readonly r: number; readonly at: number };
}

/** The feathered thigh along -y, hip (inside the body) to knee, with a fringe of feathers hanging over the knee. */
export function thigh(k: Sculpt, len: number, s: LegStyle, d: Detail, side: 1 | -1): void {
  const t = s.thick;
  const col = s.thigh ?? s.skin;
  if (!s.skinned) k.loft(
    [
      { c: [0, len * 0.2, 0], w: 0, up: 0 },
      { c: [0, len * 0.1, 0], w: t * 1.7, up: t * 1.8 },
      { c: [0, -len * 0.45, -t * 0.15], w: t * 1.55, up: t * 1.65 },
      { c: [0, -len * 0.85, 0], w: t * 1.2, up: t * 1.25 },
      { c: [0, -len * 1.02, 0], w: t * 1.05, up: t * 1.1 },
    ],
    { n: d.n(7, 3), seg: d.n(10, 3), ref: [0, 0, 1], paint: (u) => shade(col, 0.82 + 0.25 * u), finish: s.thigh !== undefined ? FEATHER : SKIN },
  );
  if (s.thigh !== undefined && d.level < 3) {
    const count = d.keep(6, 3);
    const ring = s.skinned?.r ?? t * 1.65;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + jitter(i, side + 3) * 0.3;
      const out: V3 = [Math.cos(a), 0, Math.sin(a)];
      const len2 = len * (s.fringe ?? 0.5) * (0.85 + 0.3 * jitter(i, 7));
      k.card({
        at: [out[0] * ring * 0.97, -len * (s.skinned?.at ?? 0.45), out[2] * ring * 1.03],
        dir: norm([out[0] * 0.35, -1, out[2] * 0.35]),
        face: out,
        len: len2,
        wid: Math.max(t * 3.2, ring * 1.9) * (6 / count) ** 0.5,
        cell: s.fringeCell ?? CARD.contour,
        root: shade(col, 0.9),
        tip: shade(col, 1.08),
        curl: -0.2,
        segs: d.rows,
        cup: 0.08,
      });
    }
  }
}

/** The bare, scaled tarsus along -y from the knee to the ankle. */
export function shin(k: Sculpt, len: number, s: LegStyle, d: Detail): void {
  const t = s.thick;
  k.loft(
    [
      { c: [0, t * 0.9, 0], w: 0, up: 0 },
      { c: [0, t * 0.3, 0], w: t * 1.25, up: t * 1.3 },
      { c: [0, -len * 0.15, 0], w: t * 1.0, up: t * 1.05 },
      { c: [0, -len * 0.8, 0], w: t * 0.85, up: t * 0.9 },
      { c: [0, -len, 0], w: t * 0.95, up: t * 1.0 },
    ],
    { n: d.n(6, 3), seg: d.n(8, 3), ref: [0, 0, 1], paint: s.skin, finish: { tile: TILE.rings, size: t * 2.6, gloss: 0.25 } },
  );
}

/**
 * A foot: ankle knuckle, jointed toes lying on the ground (sole at y = -ankle) and curved glossy claws whose tips
 * touch it.
 */
export function foot(k: Sculpt, ankle: number, s: LegStyle, d: Detail, side: 1 | -1 = 1): void {
  const t = s.thick;
  if (d.level < 3) ovoid(k, [0, -ankle * 0.35, 0], [t * 1.15, t * 1.25, t * 1.2], { n: d.n(5, 2), seg: d.n(8, 3), paint: s.skin, finish: SKIN });
  for (const toe of s.toes) {
    if (d.level >= 3 && Math.abs(toe.yaw) > 2) continue;
    const r = toe.r ?? t * 0.55;
    // Toes are authored for the left foot; the right foot mirrors them.
    const yaw = toe.yaw * side;
    const dir: V3 = [Math.sin(yaw), 0, Math.cos(yaw)];
    const y0 = -ankle + r;
    const start: V3 = [dir[0] * t * 0.3, -ankle * 0.55, dir[2] * t * 0.3];
    const ring = (u: number, rad: number, lift = 0): Ring => ({ c: [dir[0] * toe.len * u, y0 + lift, dir[2] * toe.len * u], w: rad, up: rad * 0.9, dn: rad * 0.75 });
    const rings: Ring[] = [
      { c: start, w: r * 1.3, up: r * 1.2 },
      ring(0.18, r * 1.05, r * 0.25),
      ring(0.36, r * 0.82, r * 0.2),
      ring(0.52, r * 0.95, r * 0.12),
      ring(0.7, r * 0.75, r * 0.08),
      ring(0.86, r * 0.82, r * 0.05),
      ring(1, r * 0.6, 0),
    ];
    k.loft(rings, { n: d.n(7, 2), seg: d.n(6, 3), ref: [0, 1, 0], paint: s.skin, finish: { tile: TILE.rings, size: r * 2.2, gloss: 0.25 } });
    if (d.level >= 2) continue;
    // The claw: from the toe tip, arching forward and down to a point on the ground.
    const cl = toe.claw ?? s.clawLen;
    const tip: V3 = [dir[0] * toe.len, y0, dir[2] * toe.len];
    const c = (u: number, dy: number): V3 => [tip[0] + dir[0] * cl * u, tip[1] + dy, tip[2] + dir[2] * cl * u];
    k.loft(
      [
        { c: c(-0.05, r * 0.05), w: r * 0.55, up: r * 0.6, dn: r * 0.35 },
        { c: c(0.35, r * 0.18), w: r * 0.38, up: r * 0.42, dn: r * 0.22 },
        { c: c(0.75, -r * 0.2), w: r * 0.2, up: r * 0.24, dn: r * 0.1 },
        { c: c(1, -r * 0.95), w: 0, up: 0, dn: 0 },
      ],
      { seg: d.n(5, 3), ref: [0, 1, 0], paint: (u) => mix(s.claw, shade(s.claw, 1.35), u), finish: GLOSSY },
    );
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The head and neck, one form.

export interface HeadStyle {
  /** The head hitbox radius (m); the form always contains the hitbox sphere. */
  readonly hr: number;
  /** Shares of hr: cranium half-width, crown height, chin depth, how far the skull runs behind the centre, where the
   * face meets the beak (z), forehead and cheek fullness. */
  readonly width?: number;
  readonly crown?: number;
  readonly chin?: number;
  readonly back?: number;
  readonly face?: number;
  readonly brow?: number;
  readonly cheek?: number;
  /** The neck below the head: its radius (m), how far below the head centre it reaches (m), and its lean (z, m). */
  readonly neck: { readonly r: number; readonly drop: number; readonly lean?: number };
  /** The beak's base on the face (head frame): centre height, half-width, upper and lower depths (m). */
  readonly beak: { readonly y: number; readonly w: number; readonly up: number; readonly dn: number };
  /** Paint by (t from the neck to the face, a round the section, position in the head frame). */
  readonly paint: Paint;
  readonly finish?: Finish;
}

/**
 * The head and the top of the neck as one lofted form: the neck rises, turns under the back of the skull into a
 * rounded cranium with a full crown, forehead and cheeks, then narrows over the face into the beak's base. The
 * cross-section's "up" runs throat → chin (so `up` radii are the throat and chin, `dn` radii the nape and crown).
 */
export function headForm(k: Sculpt, h: HeadStyle, d: Detail): Surface {
  const r = h.hr;
  // Floors keep the hitbox sphere inside the form even where the smoothing dips between control rings.
  const W = Math.max(1.07, h.width ?? 1.08);
  const crown = Math.max(1.06, h.crown ?? 1.06);
  const chin = Math.max(1.05, h.chin ?? 1.0);
  const back = h.back ?? 0.95;
  const face = (h.face ?? 1.0) * r;
  const brow = h.brow ?? 1.0;
  const cheek = h.cheek ?? 1.0;
  const nr = h.neck.r;
  const lean = h.neck.lean ?? 0;
  const b = h.beak;
  const rings: Ring[] = [
    // The bottom of the head's neck starts inside the body's neck and widens past it, so the two cross over smoothly.
    { c: [0, -h.neck.drop, lean - r * 0.15], w: nr * 0.8, up: nr * 0.8, dn: nr * 0.8, n: [0, 0, 1] },
    { c: [0, -h.neck.drop * 0.6, lean * 0.55 - r * 0.2], w: nr * 1.04, up: nr * 1.02, dn: nr * 1.06, n: [0, 0, 1] },
    { c: [0, -r * 0.5, -r * back * 0.42], w: r * W * 0.86, up: r * 0.7, dn: r * 0.86, n: [0, -0.55, 0.83] },
    { c: [0, -r * 0.02, -r * back * 0.12], w: r * W * cheek, up: r * Math.max(1.0, chin), dn: r * Math.max(1.02, crown), n: [0, -1, 0.1] },
    { c: [0, r * 0.02, r * 0.42], w: r * W * 0.9 * cheek, up: r * chin * 0.8, dn: r * crown * 0.92 * brow, n: [0, -1, 0] },
    { c: [0, (b.y + r * 0.02) / 2, face * 0.8], w: Math.min(r * W * 0.85, Math.max(b.w * 1.35, r * 0.6)), up: Math.min(r * chin * 0.9, Math.max(b.dn * 1.5, r * 0.48)), dn: Math.min(r * crown * 0.92, Math.max(b.up * 1.4, r * 0.58)), n: [0, -1, 0] },
    { c: [0, b.y, face - r * 0.02], w: b.w * 1.04, up: b.dn * 1.06, dn: b.up * 1.06, n: [0, -1, 0] },
    { c: [0, b.y, face + r * 0.04], w: 0, up: 0, dn: 0, n: [0, -1, 0] },
  ];
  return k.loft(rings, { n: d.n(17, 5), seg: d.n(22, 6), paint: h.paint, finish: h.finish ?? FEATHER });
}

// ---------------------------------------------------------------------------------------------------------------
// Wings that hold the gun: still wings, broad tapered surfaces of layered feathers.

export interface WingStyle {
  /** Feather colours: coverts, secondaries, primaries (root → tip), and the flock trim band. */
  readonly covert: number;
  readonly secondary: number;
  readonly primary: number;
  readonly primaryTip?: number;
  readonly trim: number;
  /** Arm thickness and chord (m), primary length as a share of the whole wing, and how many primaries. */
  readonly thick: number;
  readonly chord: number;
  readonly primaryLen?: number;
  readonly primaries?: number;
  readonly secondaries?: number;
  /** Fan of the primaries (rad between neighbours) and their in-plane curve (sickle wings). */
  readonly fan?: number;
  readonly sweep?: number;
  /** How far the primaries splay out from the body (share of their direction toward +x), and their pitch from the
   * forearm toward its trailing side (rad; -0.32 trails them back along the forearm, about -1 sweeps them back). */
  readonly splay?: number;
  readonly primaryPitch?: number;
  readonly cell?: Feather;
  readonly secondaryCell?: Feather;
  readonly finish?: Finish;
  /** Morph for the flight feathers on the display (wings flare): primaries, and secondaries swinging outward. */
  readonly displayFlare?: number;
  readonly secondaryFlare?: number;
  /** Secondary length as a share of the chord (default 1.25). */
  readonly secondaryLen?: number;
}

/** Is (t, a) on the flock-trim wing bar? A band across the outer face of the arm, a little past its middle. */
const onBar = (t: number, a: number): boolean => Math.abs(t - 0.6) < 0.12 && Math.cos(a) > -0.3;

/**
 * The arm segment (shoulder → joint along -y): a broad, thin wing panel, rounded at the leading edge (+z) and tapering
 * to a fine trailing edge (-z), painted in covert rows with the flock wing bar across it; two rows of flat coverts on
 * its outer face (+x, which the IK keeps outside the fold on both wings) and the broad secondaries fanned from the
 * trailing edge, staggered so they read as layers.
 */
export function wingArm(k: Sculpt, upper: number, s: WingStyle, d: Detail, side: 1 | -1): void {
  const t = s.thick;
  const c = s.chord;
  k.loft(
    [
      { c: [0, t * 1.3, -c * 0.1], w: 0, up: 0, dn: 0 },
      { c: [0, t * 0.2, -c * 0.12], w: t * 0.95, up: c * 0.2, dn: c * 0.85 },
      { c: [0, -upper * 0.5, -c * 0.1], w: t * 0.85, up: c * 0.17, dn: c * 0.8 },
      { c: [0, -upper * 0.92, -c * 0.04], w: t * 0.7, up: c * 0.12, dn: c * 0.5 },
      { c: [0, -upper - t * 0.5, 0], w: 0, up: 0, dn: 0 },
    ],
    {
      n: d.n(10, 3), seg: d.n(14, 4), ref: [0, 0, 1],
      paint: (u, a) => (onBar(u, a) ? s.trim : Math.sin(a) < -0.5 ? shade(s.secondary, 1.02) : shade(s.covert, 0.94 + 0.08 * Math.cos(a))),
      finish: s.finish ?? { tile: TILE.scales, size: c * 0.9 },
    },
  );
  if (d.level >= 3) return;
  // Secondaries: broad, round-tipped, overlapping, hanging from the trailing edge; alternate tones read as layers.
  const ns = d.keep(s.secondaries ?? 7, 2);
  const widen = Math.min(1.6, ((s.secondaries ?? 7) / ns) ** 0.6);
  for (let i = 0; i < ns; i++) {
    const u = (i + 0.5) / ns;
    // Longest by the body, shorter toward the joint, swinging back: a graduated, curved trailing edge.
    const at: V3 = [t * (0.12 + 0.06 * (i % 2)), -upper * (0.04 + 0.92 * u), -c * 0.72];
    k.card({
      at,
      ...(s.secondaryFlare && { morph: { display: hinge(at, [0, 1, 0], -s.secondaryFlare * (0.5 + u)) } }),
      dir: norm([0, 0.15 - 0.6 * u, -1]),
      face: [1, 0, 0],
      len: c * ((s.secondaryLen ?? 1.25) * (1.12 - 0.45 * u)) * (0.95 + 0.1 * jitter(i, 31 + side)),
      wid: (upper / ns) * 2.3 * widen,
      cell: s.secondaryCell ?? CARD.tail,
      root: shade(s.secondary, 0.82 + 0.1 * (i % 2)),
      tip: shade(s.secondary, 1.04 + 0.06 * (i % 2)),
      curl: -0.18,
      segs: d.rows,
      cup: d.level < 2 ? 0.1 : 0,
      finish: s.finish ?? {},
    });
  }
  // Coverts: two rows of rounded feathers lying on the outer face, the lower row carrying the flock bar.
  if (d.level < 2) {
    for (let row = 0; row < 2; row++) {
      const nc = d.keep(4, 2);
      for (let i = 0; i < nc; i++) {
        const u = (i + 0.5) / nc;
        const bar = row === 1;
        k.card({
          at: [t * (0.9 + 0.08 * row), -upper * (0.06 + 0.86 * u), c * (0.12 - 0.3 * row)],
          dir: norm([0.06, -0.45, -1]),
          face: [1, 0, 0],
          len: c * (0.42 + 0.1 * row),
          wid: (upper / nc) * (bar ? 1.0 : 1.45),
          cell: CARD.contour,
          root: bar ? shade(s.trim, 0.9) : shade(s.covert, 0.96),
          tip: bar ? shade(s.trim, 1.08) : shade(s.covert, 1.1),
          curl: -0.12,
          segs: d.rows,
          cup: 0.06,
          finish: s.finish ?? {},
        });
      }
    }
  }
}

/**
 * The hand segment (joint → grip along -y): a tapering feathered forearm, short "finger" feathers curling round the
 * grip like a closed hand, and the long primaries trailing back from the hand past the joint, fanned and layered.
 */
export function wingHand(k: Sculpt, upper: number, lower: number, s: WingStyle, d: Detail, side: 1 | -1): void {
  const t = s.thick;
  const c = s.chord;
  k.loft(
    [
      { c: [0, t * 0.8, -c * 0.1], w: 0, up: 0 },
      { c: [0, 0, -c * 0.1], w: t * 0.85, up: c * 0.14, dn: c * 0.5 },
      { c: [0, -lower * 0.6, -c * 0.06], w: t * 0.75, up: c * 0.11, dn: c * 0.32 },
      { c: [0, -lower, 0], w: t * 1.15, up: t * 1.45, dn: t * 1.35 },
      { c: [0, -lower - t * 1.5, 0], w: 0, up: 0, dn: 0 },
    ],
    { n: d.n(9, 3), seg: d.n(12, 4), ref: [0, 0, 1], paint: (u, a) => (Math.sin(a) < -0.5 ? s.secondary : shade(s.covert, 0.92 + 0.1 * u)), finish: s.finish ?? { tile: TILE.scales, size: c * 0.8 } },
  );
  if (d.level >= 3) {
    // One plank of primaries keeps the folded-wing read at 80 m.
    k.card({ at: [0, -lower, -c * 0.1], dir: norm([0, 1, -0.4]), face: [1, 0, 0], len: (upper + lower) * (s.primaryLen ?? 0.62), wid: c * 0.5, cell: s.cell ?? CARD.primary, root: s.primary, tip: s.primaryTip ?? s.primary, segs: 2 });
    return;
  }
  const np = d.keep(s.primaries ?? 7, 2);
  const L = (upper + lower) * (s.primaryLen ?? 0.62);
  const fan = (s.fan ?? 0.08) * ((s.primaries ?? 7) / np);
  const flare = s.displayFlare ?? 0;
  for (let i = 0; i < np; i++) {
    const u = np === 1 ? 0.5 : i / (np - 1);
    // Outermost first: longest, rooted at the hand; inner ones rooted further up the forearm.
    const pitch = (s.primaryPitch ?? -0.32) - fan * i;
    const dir = norm([(s.splay ?? 0) * (1 - 0.5 * u), Math.cos(pitch), Math.sin(pitch)]);
    const at: V3 = [t * (0.4 - 0.08 * i), -lower * (0.97 - 0.42 * u), -c * 0.12];
    const morph: Morphs | undefined = flare ? { display: hinge(at, [1, 0, 0], -flare * (0.3 + u)) } : undefined;
    k.card({
      at,
      dir,
      face: [1, 0, 0],
      len: L * (1 - 0.3 * u),
      wid: c * 0.42 * Math.min(1.7, ((s.primaries ?? 7) / np) ** 0.5),
      cell: s.cell ?? CARD.primary,
      root: shade(s.primary, 0.82 + 0.08 * (i % 2)),
      tip: s.primaryTip ?? shade(s.primary, 1.05),
      curl: -0.1,
      sweep: -(s.sweep ?? 0),
      segs: s.sweep ? d.rows + 2 : d.rows,
      cup: d.level < 2 ? 0.08 : 0,
      finish: s.finish ?? {},
      ...(morph && { morph }),
    });
  }
  // Fingers: short feathers from the hand curling round the grip, a feathered fist on the gun.
  if (d.level < 2) {
    const nf = d.level === 0 ? 4 : 3;
    for (let i = 0; i < nf; i++) {
      const ang = -1.1 + (2.2 * i) / (nf - 1);
      const dir = norm([Math.sin(ang) * 0.9, -0.55, Math.cos(ang) * 0.9]);
      k.card({
        at: [0, -lower * 0.94, 0],
        dir,
        face: norm([Math.sin(ang), 0.2, Math.cos(ang)]),
        len: c * 0.42,
        wid: c * 0.24,
        cell: CARD.contour,
        root: shade(s.covert, 0.9),
        tip: shade(s.primaryTip ?? s.primary, 1.0),
        curl: 1.3,
        segs: d.rows,
        cup: 0.06,
        finish: s.finish ?? {},
      });
    }
  }
  void side;
}

// ---------------------------------------------------------------------------------------------------------------

export interface FanStyle {
  readonly count: number;
  readonly len: number;
  readonly wid: number;
  /** Total spread (rad), droop (rad, + down) and per-feather lengthening toward the middle. */
  readonly spread: number;
  readonly droop?: number;
  readonly centreLonger?: number;
  /** Outer feathers this much longer (forked tails). */
  readonly fork?: number;
  readonly root: number;
  readonly tip: number;
  readonly cell?: Feather;
  readonly curl?: number;
  readonly finish?: Finish;
  /** Each feather's display transform by its place in the fan (u from -1 to 1). */
  readonly display?: (u: number, at: V3) => Matrix4;
  readonly at?: V3;
}

/** A fanned, layered tail of feathers pointing back (-z) from the tail bone, the middle pair on top. */
export function tailFan(k: Sculpt, s: FanStyle, d: Detail): void {
  const n = d.keep(s.count, 2);
  const widen = Math.min(1.8, (s.count / n) ** 0.7);
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
    const yaw = Math.PI + u * (s.spread / 2);
    const len = s.len * (1 + (s.centreLonger ?? 0) * (1 - Math.abs(u)) + (s.fork ?? 0) * u * u);
    const at: V3 = add(s.at ?? [0, 0, 0], [0, 0.006 * (1 - Math.abs(u)) * s.wid * 10, 0]);
    const dir = norm([Math.sin(yaw) * Math.cos(s.droop ?? 0), -Math.sin(s.droop ?? 0), Math.cos(yaw) * Math.cos(s.droop ?? 0)]);
    k.card({
      at, dir, face: [0, 1, 0], len, wid: s.wid * widen, cell: s.cell ?? CARD.tail,
      root: shade(s.root, 0.92 + 0.08 * (i % 2)), tip: s.tip, curl: s.curl ?? 0, segs: d.rows, cup: d.level < 2 ? 0.08 : 0, finish: s.finish ?? {},
      ...(s.display && { morph: { display: s.display(u, at) } }),
    });
  }
}

export interface ShingleStyle {
  /** Ranges along (t) and round (a, radians) the surface. */
  readonly t: readonly [number, number];
  readonly a: readonly [number, number];
  readonly rows: number;
  readonly cols: number;
  readonly len: number;
  readonly wid: number;
  readonly cell?: Feather;
  /** Colour by place (t, a). */
  readonly paint: number | ((t: number, a: number) => number);
  /** Tilt of the tips off the surface (rad) and which way along t they point (-1 toward the start). */
  readonly lift?: number;
  readonly flow?: 1 | -1;
  /** Instead of along t, point every feather toward this direction (bone frame), laid onto the surface. */
  readonly toward?: V3;
  readonly finish?: Finish;
  readonly seed?: number;
  /** A morph per feather, from its place, root, direction and the surface normal there. */
  readonly morph?: (t: number, a: number, at: V3, dir: V3, n: V3) => Morphs | undefined;
}

/**
 * Rows of large feathers laid over a surface like roof tiles, deliberately placed (offset rows, a little seeded
 * variation), their tips lifted just enough to break the silhouette and their curl settling them back on the body.
 */
export function shingle(k: Sculpt, surf: Surface, s: ShingleStyle, d: Detail): void {
  if (d.level >= 3) return;
  const rows = Math.max(1, d.keep(s.rows, 1));
  const cols = Math.max(1, d.keep(s.cols, 2));
  const grow = Math.min(1.6, Math.sqrt((s.rows * s.cols) / (rows * cols)));
  const lift = s.lift ?? 0.2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const j = r * cols + c;
      const t = s.t[0] + (s.t[1] - s.t[0]) * (rows === 1 ? 0.5 : r / (rows - 1));
      const a = s.a[0] + (s.a[1] - s.a[0]) * ((c + 0.5 + (r % 2) * 0.5) / (cols + 0.5)) + (jitter(j, s.seed ?? 1) - 0.5) * 0.04;
      const sp = surf.at(t, a, 0.003);
      const along = sp.t.clone().multiplyScalar(s.flow ?? -1);
      if (s.toward) {
        along.set(s.toward[0], s.toward[1], s.toward[2]);
        along.addScaledVector(sp.n, -sp.n.dot(along));
        if (along.lengthSq() < 1e-6) along.copy(sp.t).multiplyScalar(s.flow ?? -1);
        along.normalize();
      }
      const dir: V3 = norm([along.x * Math.cos(lift) + sp.n.x * Math.sin(lift), along.y * Math.cos(lift) + sp.n.y * Math.sin(lift), along.z * Math.cos(lift) + sp.n.z * Math.sin(lift)]);
      const hex = typeof s.paint === 'number' ? s.paint : s.paint(t, a);
      const at: V3 = [sp.p.x, sp.p.y, sp.p.z];
      const morph = s.morph?.(t, a, at, dir, [sp.n.x, sp.n.y, sp.n.z]);
      k.card({
        at, dir, face: [sp.n.x, sp.n.y, sp.n.z],
        len: s.len * grow * (0.94 + 0.12 * jitter(j, (s.seed ?? 1) + 5)), wid: s.wid * grow, cell: s.cell ?? CARD.contour,
        root: shade(hex, 0.9), tip: shade(hex, 1.06), curl: -Math.min(0.3, lift * 0.85), segs: d.rows, cup: d.level < 2 ? 0.06 : 0, finish: s.finish ?? {},
        ...(morph && { morph }),
      });
    }
  }
}

/** A feather's flare on the display: it swings its tip out along the surface normal by the angle about its root. */
export function flare(at: V3, dir: V3, n: V3, angle: number): Morphs {
  return { display: hinge(at, norm(cross(dir, n)), angle) };
}

/** The usual leg builder: feathered thigh, scaled shin, foot (toes mirrored on the right). */
export function legsOf(leg: LegStyle, d: Detail): (k: Sculpt, seg: 'thigh' | 'shin' | 'foot', side: 1 | -1, upper: number, lower: number, ankle: number) => void {
  return (k, seg, side, upper, _lower, ankle) => {
    if (seg === 'thigh') thigh(k, upper, leg, d, side);
    else if (seg === 'shin') shin(k, upper, leg, d);
    else foot(k, ankle, leg, d, side);
  };
}

/** The usual wing builder: the arm and the hand. */
export function wingsOf(w: WingStyle, d: Detail): (k: Sculpt, seg: 'arm' | 'hand', side: 1 | -1, upper: number, lower: number) => void {
  return (k, seg, side, upper, lower) => (seg === 'arm' ? wingArm(k, upper, w, d, side) : wingHand(k, upper, lower, w, d, side));
}
