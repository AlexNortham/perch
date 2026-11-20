/* eslint-disable @typescript-eslint/no-magic-numbers -- authored birds: the numbers are the sculpture */
/**
 * Batch C birds, sculpted to the style guide (§8; GDD §9.5 to §9.12): Owl, Pelican, Penguin, Puffin, Secretarybird and
 * Starling, on implicit bodies (D-ART-008, D-ART-010) with the v2.1 player-camera dress (D-ART-011). Every size comes
 * from the BodyPlan at runtime (head about the head hitbox centre, body inside the capsule, the gun's tip at the
 * muzzle); only fractions and authored offsets are written here.
 */
import type { Vector3 } from 'three';
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import type { TeamColours } from '../palette';
import { beak, eye, foldedWings, hackles, inBone, legsOf, norm, shingle, tailFan, wingsOf } from './anatomy';
import type { LegStyle, WingStyle } from './anatomy';
import { bodyField, flipX, OWL_HEAD, owlAnchors, PELICAN_HEAD, pelicanAnchors, PENGUIN_HEAD, penguinAnchors, skinFor, TRUNK } from './bodies';
import { SKIN as OWL_SKIN } from './data/skins/owl';
import { SKIN as PELICAN_SKIN } from './data/skins/pelican';
import { SKIN as PENGUIN_SKIN } from './data/skins/penguin';
import { CARD, TILE } from './feathers';
import { band, bead, block, BRASS, carve, GEAR, LEATHER, lathe, plume, pouch, ring, sash, scope, stud, WEAVE, WOOD } from './gear';
import type { Detail, SculptedBird, SculptedSpec } from './sculpted';
import { hinge, jitter, mix, shade } from './sculpt';
import type { Sculpt, V3 } from './sculpt';

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
/** Soft, deterministic blotches in [0, 1] by model-frame position (`f` cycles per metre): mottled plumage. */
const blotch = (p: Vector3, f: number, seed = 0): number =>
  0.5 + 0.25 * Math.sin(p.x * f * 1.3 + seed) * Math.sin(p.y * f + 1.7 * seed) + 0.25 * Math.sin(p.z * f * 1.1 - p.y * f * 0.6 + seed * 2.3);

// =================================================================================================================
// Owl: a round tawny barrel with no neck, a huge head with a pale facial disc of two dishes ringed by a dark ruff,
// a stern V brow over enormous orange eyes, two upright ear tufts that rise on a cast, a streaked cream breast,
// barred wings and fluffy feathered legs. Long-range poke: a long, slim scoped rifle with a felt-wrapped hush can.

const OWL = {
  tawny: 0xa86e38,
  dark: 0x5a381c,
  rufous: 0xb8783a,
  cream: 0xeadbb8,
  buff: 0xd6b07a,
  disc: 0xcf9658,
  rim: 0x3c2414,
  bill: 0x3a3532,
  iris: 0xf08a1a,
  claw: 0x221c18,
  felt: 0x9a8c74,
  moon: 0xd8e6ff,
} as const;

function owl(plan: BodyPlan, team: TeamColours, d: Detail): SculptedSpec {
  const H = plan.height;
  const hr = plan.head.radius;
  const A = owlAnchors(plan);
  const s = A.s;
  const O = OWL;
  const PLUME = { tile: TILE.scales, size: 0.09, gloss: 0.12 } as const;
  const SOFT = { tile: TILE.scales, size: 0.06, gloss: 0.08 } as const;
  const field = bodyField('owl', plan);
  // Tawny mottled with dark blotches and paler flecks; darkest toward the crown and mantle.
  const mottle = (p: Vector3, base: number, k = 1): number => {
    const b = blotch(p, 34, 1.3);
    return b > 0.62 ? mix(base, O.dark, (b - 0.62) * 2.2 * k) : b < 0.3 ? mix(base, O.buff, (0.3 - b) * 2 * k) : base;
  };
  const skin = skinFor('owl', plan, OWL_SKIN, d.level, {
    back: { paint: (p) => mottle(p, O.tawny), finish: PLUME },
    mantle: { paint: (p) => mottle(p, shade(O.tawny, 0.9)), finish: PLUME },
    scapular: { paint: (p) => mix(mottle(p, O.tawny), O.cream, 0.15), finish: PLUME },
    shoulder: { paint: O.tawny, finish: PLUME },
    coverts: { paint: shade(O.tawny, 0.85), finish: PLUME },
    // A pale buff breast, creamier down the keel, its streaks laid on by the breast feathers.
    breast: { paint: (p) => mix(O.cream, O.buff, clamp01(Math.abs(p.x) / (0.24 * s) + 0.1 * blotch(p, 40))), finish: PLUME },
    belly: { paint: (p) => mix(O.cream, O.buff, 0.3 * blotch(p, 30, 2)), finish: SOFT },
    thigh: { paint: mix(O.cream, O.buff, 0.35), finish: SOFT },
    neck: { paint: (p) => mottle(p, mix(O.tawny, O.rufous, 0.5)), finish: PLUME },
    // A dark, finely mottled crown over the tawny mantle: the head separates from the back from behind.
    crown: { paint: (p) => mottle(p, shade(O.tawny, 0.68), 0.7), finish: { ...PLUME, size: 0.06 } },
    nape: { paint: (p) => mottle(p, shade(O.tawny, 0.8), 0.7), finish: { ...PLUME, size: 0.06 } },
    tuft: { paint: (p) => mix(O.dark, shade(O.tawny, 0.8), clamp01((p.y - A.head[1] - 0.15 * s) / (0.12 * s))), finish: { ...PLUME, size: 0.05 } },
    // The facial disc: a smooth rufous dish round each eye in fine concentric rings, inside the dark ruff.
    face: { paint: O.disc, finish: { gloss: 0.08 } },
    disc: { paint: (p) => mix(O.disc, shade(O.disc, 1.18), 0.5 + 0.5 * Math.sin(Math.hypot(Math.abs(p.x) - OWL_HEAD.eye[0] * hr, p.y - A.head[1]) * 150)), finish: { gloss: 0.08 } },
    bib: { paint: 0xf4efe4, finish: { gloss: 0.06 } },
    ruff: { paint: (p) => mix(O.rim, O.dark, 0.4 * blotch(p, 60)), finish: { ...PLUME, size: 0.04 } },
    cheek: { paint: mix(O.disc, O.buff, 0.3), finish: { gloss: 0.08 } },
    // The stern brows: pale V over the eyes.
    brow: { paint: O.cream, finish: { gloss: 0.1 } },
    throat: { paint: O.cream, finish: SOFT },
    bill: { paint: O.bill, finish: { gloss: 0.5 } },
    socket: { paint: O.rim, finish: { gloss: 0.3 } },
  });

  const leg: LegStyle = {
    // Feathered to the toes: cream feathering, short grey toes, big dark talons.
    skin: mix(O.cream, O.buff, 0.5), claw: O.claw, thick: A.legThick, thigh: O.cream, fringe: 0.9, fringeCell: CARD.down, skinned: { r: 0.075 * s, at: 0.55 },
    toes: [{ yaw: -0.45, len: 0.08 * s, r: 0.022 * s }, { yaw: 0.05, len: 0.09 * s, r: 0.022 * s }, { yaw: 0.6, len: 0.075 * s, r: 0.02 * s }, { yaw: Math.PI - 0.3, len: 0.06 * s, r: 0.02 * s }],
    clawLen: 0.05 * s,
  };
  const wing: WingStyle = {
    covert: shade(O.tawny, 0.85), secondary: mix(O.tawny, O.buff, 0.3), primary: O.buff, primaryTip: O.dark, trim: team.primary,
    thick: 0.036 * s, chord: 0.25 * s, primaries: 6, secondaries: 5, primaryLen: 0.55, secondaryLen: 0.6,
    cell: CARD.primary, secondaryCell: CARD.mottledTail,
  };

  const body = (k: Sculpt): void => {
    const torso = field.only(...TRUNK).surface([0, 0.36 * s, -0.12 * s], [0, 1.2 * s, 0.05 * s], [0, 0, 1]);
    const collar = field.only(...TRUNK, 'neck').surface([0, 0.36 * s, -0.08 * s], [0, A.head[1] - 0.1 * s, 0], [0, 0, 1]);
    // The streaked breast: rows of cream feathers with dark shaft streaks, falling down the front.
    shingle(k, torso, {
      t: [0.3, 0.84], a: [Math.PI * 0.18, Math.PI * 0.82], rows: 3, cols: 4, len: 0.16 * s, wid: 0.12 * s, cell: CARD.mottled, lift: 0.12, seed: 41,
      paint: (t, a) => mix(O.cream, O.buff, 0.3 + 0.4 * jitter(Math.round(t * 10 + a * 7), 3)), finish: { gloss: 0.08 }, toward: [0, -1, 0.15],
    }, d);
    // The player-camera standard (D-ART-011): rows of mottled feathers down the nape and over the shoulders.
    hackles(k, collar, {
      t: [0.62, 0.84], a: [-Math.PI * 0.92, -Math.PI * 0.08], rows: 2, cols: 6, len: 0.15 * s, wid: 0.12 * s, lift: 0.14, cell: CARD.mottled,
      paint: (t) => mix(shade(O.tawny, 0.8), O.tawny, t), finish: PLUME,
    }, d);
    foldedWings(k, torso, wing, { t: [0.4, 0.82], a: 0.25, len: 0.4 * s, wid: 0.13 * s }, d);
    // Gear: a flock-colour cowl round the neck with tails down the back, a cartridge bandolier, a satchel on the hip.
    band(k, collar, 0.9, { width: 0.08 * s, thick: 0.016 * s, hex: team.primary, stitch: team.light, off: 0.006 * s, finish: WEAVE }, d);
    if (d.level < 3) {
      for (const x of [1, -1]) {
        const knot = collar.at(0.9,-Math.PI / 2 + x * 0.35, 0.05 * s);
        k.card({ at: [knot.p.x, knot.p.y, knot.p.z], dir: norm([x * 0.25, -1, -0.3]), face: [0, 0.2, -1], len: (x > 0 ? 0.36 : 0.3) * s, wid: 0.08 * s, cell: CARD.cloth, root: team.primary, tip: team.dark, curl: 0.25, sweep: x * 0.15, segs: d.level === 0 ? 4 : 2 });
      }
    }
    sash(k, torso, 0.6, 0.22, Math.PI * 0.35, { width: 0.06 * s, thick: 0.014 * s, hex: GEAR.leather, stitch: team.light, off: 0.02 * s, finish: LEATHER }, d);
    if (d.level < 2) {
      // Rifle rounds in loops along the bandolier across the breast.
      for (let i = 0; i < 5; i++) {
        const u = 0.2 + i * 0.07;
        const p = torso.at(0.6 + 0.22 * Math.cos(u * Math.PI * 2), Math.PI * 0.35 + u * Math.PI * 2, 0.045 * s);
        lathe(k, [[0.008 * s, 0.035 * s], [0.011 * s, 0.02 * s], [0.011 * s, -0.03 * s]], { at: [p.p.x, p.p.y, p.p.z], rot: [Math.PI / 2 - 0.3, 0, 0], seg: 6, paint: (t) => (t < 0.3 ? GEAR.brassDark : GEAR.brass), finish: BRASS });
      }
    }
    pouch(k, torso.at(0.35, Math.PI * 1.12, 0.01 * s), [0.12 * s, 0.13 * s, 0.07 * s], GEAR.leather, d);
  };

  const head = (k: Sculpt): void => {
    // The player-camera standard: a ruff of dark-tipped feathers round the back of the head, falling over the nape.
    const headAxis: [V3, V3] = [[A.head[0], A.head[1] - hr * 1.4, A.head[2] - hr * 0.1], [A.head[0], A.head[1] + hr * 0.9, A.head[2] - hr * 0.1]];
    hackles(k, inBone(field.only('crown', 'nape', 'neck').surface(...headAxis, [0, 0, 1]), A.head), {
      t: [0.22, 0.72], a: [-Math.PI * 0.88, -Math.PI * 0.12], rows: 3, cols: 4, len: 0.13 * s, wid: 0.11 * s, lift: 0.2, cell: CARD.mottled,
      paint: (t) => mix(shade(O.tawny, 0.72), shade(O.tawny, 0.88), t), finish: PLUME, seed: 43,
    }, d);
    // The disc, ruff, brows and tufts are the skin's; the eyes sit in the dishes, the bill under the ridge.
    const E = OWL_HEAD.eye;
    for (const x of [1, -1]) eye(k, [x * hr * E[0], hr * E[1], hr * E[2]], [x * 0.3, 0.02, 0.95], { r: hr * 0.3, iris: O.iris, ring: O.rim, lid: shade(O.tawny, 0.8), ringW: hr * 0.035, pupil: 0.5 }, d);
    const B = OWL_HEAD.bill;
    beak(k, { at: [0, hr * B[1], hr * (B[2] - 0.08)], len: hr * 0.42, w: hr * 0.13, up: hr * 0.2, dn: hr * 0.1, curve: hr * 0.2, hook: hr * 0.08, base: O.bill, tip: shade(O.bill, 1.5), open: 0.3 }, d);
    // Ear tufts: layered feathers up the two horns, spreading and rising on a cast (the display).
    if (d.level < 3) {
      for (const x of [1, -1]) {
        const n = d.keep(5, 2);
        for (let i = 0; i < n; i++) {
          const u = i / Math.max(1, n - 1);
          const at: V3 = [x * hr * (0.42 + 0.14 * u), hr * (0.62 + 0.3 * u), -hr * (0.02 + 0.06 * u)];
          const dir = norm([x * (0.32 + 0.12 * u), 1, -0.18 - 0.1 * u]);
          k.card({
            at, dir, face: [x * 0.2, 0.1, 1], len: hr * (1.1 - 0.35 * u), wid: hr * 0.34, cell: CARD.contour, root: shade(O.tawny, 0.75), tip: O.dark, curl: -0.15, segs: d.rows, finish: PLUME,
            morph: { display: hinge(at, [0, 0, 1], -x * 0.35) },
          });
        }
      }
    }
    // Bristles over the bill and a few pale lashes at the brow ridge, between the dishes.
    if (d.level < 2) {
      for (const x of [-1, 0, 1]) k.card({ at: [x * hr * 0.1, -hr * 0.05, hr * 0.98], dir: norm([x * 0.3, -1, 0.35]), face: [0, 0.3, 1], len: hr * 0.36, wid: hr * 0.12, cell: CARD.hair, root: O.cream, tip: O.disc, segs: 2 });
    }
  };

  const tail = (k: Sculpt): void => {
    tailFan(k, { count: 8, len: 0.24 * s, wid: 0.075 * s, spread: 1.0, droop: 1.0, root: O.tawny, tip: O.buff, cell: CARD.mottledTail, finish: { gloss: 0.1 } }, d);
  };

  return {
    body, head, tail, skin,
    wing: wingsOf(wing, d),
    leg: legsOf(leg, d),
    gun: owlGun(s, d),
    pivot: { wingL: A.wing, wingR: flipX(A.wing), legL: A.hip, legR: flipX(A.hip), tail: A.tail },
    legLen: A.legLen, legThick: leg.thick, wingLen: H * 0.36,
    // Hush, Night Eyes, Silent Wing, Moonlit Mark.
    casts: ['aim', 'raise', 'leap', 'aim'],
    sway: 0, castTail: -0.3,
  };
}

/** Hush Rifle: a long slim barrel under a moon-glass scope, a felt-wrapped hush can, a six-round brass box, a dark stock. */
function owlGun(s: number, d: Detail): SculptedSpec['gun'] {
  const O = OWL;
  const L = 0.72 * s;
  const r = 0.011 * s;
  return {
    main: [0, -0.055 * s, -L * 0.72],
    support: [0, -0.024 * s, 0],
    slideAt: [0, -0.012 * s, -L * 0.4],
    travel: 0.025 * s,
    build(k, part) {
      if (part === 'slide') {
        if (d.level >= 3) return;
        // The fore-end, bound in leather.
        lathe(k, [[r * 1.5, 0.07 * s], [r * 2.0, 0.05 * s], [r * 2.1, -0.05 * s], [r * 1.6, -0.07 * s]], { seg: d.n(10, 4), paint: (t) => (Math.sin(t * 22) > 0.5 ? GEAR.leatherDark : GEAR.woodDark), finish: WOOD, flat: 1.2 });
        return;
      }
      if (part !== 'gun') return;
      if (d.level >= 3) {
        lathe(k, [[0.022 * s, 0], [0.022 * s, -0.15 * s], [r * 1.2, -0.16 * s], [r, -L * 0.6], [0.025 * s, -L * 0.72], [0.02 * s, -L]], { seg: 4, paint: GEAR.woodDark });
        return;
      }
      // The hush can: a fat suppressor wrapped in felt between brass caps, the moon bead glowing at its mouth.
      lathe(k, [[0.014 * s, 0], [0.024 * s, -0.006 * s], [0.024 * s, -0.02 * s]], { seg: d.n(12, 5), paint: GEAR.brass, finish: BRASS });
      lathe(k, [[0.023 * s, -0.018 * s], [0.026 * s, -0.04 * s], [0.026 * s, -0.13 * s], [0.023 * s, -0.15 * s]], { seg: d.n(12, 5), paint: (t) => (Math.sin(t * 40) > 0.6 ? shade(O.felt, 0.8) : O.felt), finish: WEAVE });
      lathe(k, [[0.024 * s, -0.148 * s], [0.02 * s, -0.16 * s], [r * 1.2, -0.17 * s]], { seg: d.n(12, 5), paint: GEAR.brass, finish: BRASS });
      bead(k, [0, 0, -0.002 * s], 0.012 * s, O.moon, 0.85, d);
      // The barrel, banded, into the receiver.
      lathe(k, [[r * 1.1, -0.165 * s], [r, -L * 0.42], [r * 1.25, -L * 0.6], [r * 1.6, -L * 0.62]], { seg: d.n(10, 4), paint: GEAR.iron, finish: { gloss: 0.6 } });
      ring(k, [0, 0, -L * 0.4], r * 1.2, r * 0.3, d);
      // The moon-glass scope on two brass rings.
      scope(k, [0, 0.036 * s, -L * 0.62], 0.2 * s, 0.015 * s, d);
      if (d.level < 2) for (const z of [0.55, 0.69]) block(k, [0.01 * s, 0.024 * s, 0.012 * s], [0, 0.02 * s, -L * z], GEAR.brassDark, BRASS, d);
      block(k, [0.034 * s, 0.05 * s, 0.13 * s], [0, -0.004 * s, -L * 0.68], GEAR.woodDark, WOOD, d);
      // The six-round box magazine: brass, with the rounds' rims showing (the ammo read).
      block(k, [0.026 * s, 0.06 * s, 0.05 * s], [0, -0.05 * s, -L * 0.62], GEAR.brassDark, BRASS, d, [-0.15, 0, 0]);
      if (d.level < 2) for (let i = 0; i < 3; i++) stud(k, [0.014 * s, -0.035 * s - i * 0.014 * s, -L * 0.62], 0.005 * s, GEAR.brass);
      carve(k, [[-L * 0.7, -0.024 * s], [-L * 0.76, -0.024 * s], [-L * 0.82, -0.1 * s], [-L * 0.74, -0.104 * s]], 0.026 * s, GEAR.wood, WOOD, d);
      // A long thumbhole stock in dark wood, a moon inlay and an owl feather tied at the butt.
      carve(k, [[-L * 0.74, 0.02 * s], [-L * 0.9, 0.025 * s], [-L, 0.02 * s], [-L * 1.02, -0.075 * s], [-L * 0.95, -0.08 * s], [-L * 0.8, -0.035 * s]], 0.03 * s, GEAR.woodDark, WOOD, d);
      if (d.level < 2) {
        bead(k, [0.016 * s, -0.01 * s, -L * 0.9], 0.01 * s, O.moon, 0.5, d, [0.4, 1, 1]);
        plume(k, [0.016 * s, -0.04 * s, -L * 0.95], [0.1, -1, -0.3], 0.08 * s, 0.03 * s, O.buff, CARD.barred, [1, 0, 0], O.dark);
      }
    },
  };
}

// =================================================================================================================
// Pelican: a white pear under a thick S-neck, a silver mantle, black flight feathers folded down the flanks, a small
// head with a shaggy buff nape crest and peach skin round the eye, and the hero shape: a long hooked bill over a huge
// sagging yellow pouch that swings with the head and gapes on a cast. Big pink webbed feet. Gun carry: a gatling of
// spinning barrels fed from a woven creel drum.

const PELICAN = {
  white: 0xf3f1ec,
  cream: 0xeee6d2,
  silver: 0xa9b0b8,
  grey: 0x8f959c,
  black: 0x26262b,
  crest: 0xe2c06e,
  patch: 0xeed58a,
  facial: 0xf0c4a0,
  bill: 0xe2b49a,
  billMid: 0xe8c47a,
  nail: 0xd8502a,
  pouch: 0xf2a838,
  pouchDark: 0xd47e22,
  foot: 0xe8946a,
  claw: 0x3a2a24,
  iris: 0x5a1e14,
  creel: 0xb48a4e,
} as const;

/** Pitch a head-frame point down about x by `p` (rad) and move it to `o`. */
const pitched = (o: V3, p: number, y: number, z: number): V3 => [o[0], o[1] + y * Math.cos(p) - z * Math.sin(p), o[2] + y * Math.sin(p) + z * Math.cos(p)];

/** Webbing between the forward toes: a thin fan on the ground under them, for the left foot (mirrored on the right). */
function web(k: Sculpt, ankle: number, toes: LegStyle['toes'], hex: number, side: 1 | -1, d: Detail): void {
  if (d.level >= 2) return;
  const fwd = toes.filter((t) => Math.abs(t.yaw) < 1.2);
  const lo = Math.min(...fwd.map((t) => t.yaw));
  const hi = Math.max(...fwd.map((t) => t.yaw));
  const mid = ((lo + hi) / 2) * side;
  const len = Math.min(...fwd.map((t) => t.len)) * 0.92;
  const half = (hi - lo) / 2;
  const y = -ankle + 0.006;
  const rings = [0.12, 0.4, 0.7, 0.95].map((u) => ({ c: [Math.sin(mid) * len * u, y, Math.cos(mid) * len * u] as V3, w: Math.max(0.004, Math.sin(half) * len * u), up: 0.003, dn: 0.002 }));
  k.loft(rings, { seg: 6, ref: [0, 1, 0], paint: shade(hex, 0.88), finish: { gloss: 0.3 } });
}

function pelican(plan: BodyPlan, team: TeamColours, d: Detail): SculptedSpec {
  const H = plan.height;
  const hr = plan.head.radius;
  const A = pelicanAnchors(plan);
  const s = A.s;
  const P = PELICAN;
  const FEATHERS = { tile: TILE.scales, size: 0.11, gloss: 0.15 } as const;
  const field = bodyField('pelican', plan);
  const skin = skinFor('pelican', plan, PELICAN_SKIN, d.level, {
    back: { paint: (p) => mix(P.white, P.silver, clamp01((p.y - 0.95 * s) / (0.3 * s) - p.z / (0.6 * s))), finish: FEATHERS },
    // The silver mantle and scapulars: the back reads apart from the white neck from the player camera.
    mantle: { paint: P.silver, finish: FEATHERS },
    scapular: { paint: mix(P.silver, P.grey, 0.3), finish: FEATHERS },
    shoulder: { paint: P.silver, finish: FEATHERS },
    coverts: { paint: mix(P.white, P.silver, 0.5), finish: FEATHERS },
    breast: { paint: (p) => mix(P.white, P.cream, clamp01(Math.abs(p.x) / (0.3 * s))), finish: FEATHERS },
    belly: { paint: P.cream, finish: FEATHERS },
    thigh: { paint: P.cream, finish: { ...FEATHERS, size: 0.07 } },
    neck: { paint: P.white, finish: { ...FEATHERS, size: 0.08 } },
    patch: { paint: P.patch, finish: FEATHERS },
    crown: { paint: mix(P.white, P.crest, 0.25), finish: { ...FEATHERS, size: 0.06 } },
    crest: { paint: P.crest, finish: { ...FEATHERS, size: 0.05 } },
    nape: { paint: mix(P.white, P.crest, 0.15), finish: { ...FEATHERS, size: 0.06 } },
    face: { paint: P.white, finish: { gloss: 0.1 } },
    cheek: { paint: P.white, finish: { gloss: 0.1 } },
    brow: { paint: mix(P.white, P.grey, 0.25), finish: { gloss: 0.1 } },
    throat: { paint: P.white, finish: FEATHERS },
    facial: { paint: P.facial, finish: { gloss: 0.35 } },
    bill: { paint: P.bill, finish: { gloss: 0.5 } },
    socket: { paint: P.facial, finish: { gloss: 0.4 } },
  });
  const leg: LegStyle = {
    skin: P.foot, claw: P.claw, thick: A.legThick, thigh: P.cream, fringe: 0.6, skinned: { r: 0.11 * s, at: 0.35 },
    toes: [{ yaw: -0.6, len: 0.15 * s, r: 0.022 * s }, { yaw: -0.15, len: 0.18 * s, r: 0.024 * s }, { yaw: 0.35, len: 0.16 * s, r: 0.022 * s }, { yaw: 0.95, len: 0.09 * s, r: 0.018 * s }],
    clawLen: 0.03 * s,
  };
  const wing: WingStyle = {
    covert: P.white, secondary: P.grey, primary: P.black, primaryTip: shade(P.black, 0.8), trim: team.primary,
    thick: 0.045 * s, chord: 0.3 * s, primaries: 6, secondaries: 5, primaryLen: 0.6, secondaryLen: 0.7,
  };

  const body = (k: Sculpt): void => {
    const torso = field.only(...TRUNK).surface([0, 0.46 * s, -0.4 * s], [0, 1.3 * s, 0.12 * s], [0, 0, 1]);
    const neckAxis: [V3, V3] = [[0, 1.15 * s, 0.1 * s], [0, A.head[1] - 0.06 * s, 0]];
    const collar = field.only(...TRUNK, 'neck').surface(...neckAxis, [0, 0, 1]);
    // The player-camera standard: white hackles down the back of the neck onto the silver mantle.
    hackles(k, collar, { t: [0.14, 0.62], rows: 3, cols: 4, len: 0.14 * s, wid: 0.1 * s, lift: 0.14, paint: (t) => mix(P.silver, P.white, t), finish: FEATHERS }, d);
    // The black primaries and grey secondaries folded down each flank: the dark wing edge reads from every side.
    foldedWings(k, torso, wing, { t: [0.42, 0.8], a: 0.28, len: 0.5 * s, wid: 0.13 * s }, d);
    // Gear: a flock-colour neckerchief knotted at the back, a seed-shell bandolier, and a woven creel on the hip.
    band(k, collar, 0.1, { width: 0.09 * s, thick: 0.016 * s, hex: team.primary, stitch: team.light, off: 0.01 * s, finish: WEAVE }, d);
    if (d.level < 3) {
      const knot = collar.at(0.1, -Math.PI / 2, 0.03 * s);
      for (const x of [1, -1]) k.card({ at: [knot.p.x, knot.p.y, knot.p.z], dir: norm([x * 0.35, -1, -0.35]), face: [0, 0.2, -1], len: 0.26 * s, wid: 0.09 * s, cell: CARD.cloth, root: team.primary, tip: team.dark, curl: 0.3, sweep: x * 0.2, segs: d.level === 0 ? 4 : 2 });
    }
    if (d.level < 3) sash(k, torso, 0.58, 0.24, Math.PI * 0.32, { width: 0.075 * s, thick: 0.016 * s, hex: GEAR.leatherDark, stitch: team.light, off: 0.01 * s, finish: LEATHER }, d);
    if (d.level < 2) {
      for (let i = 0; i < 6; i++) {
        const u = 0.15 + i * 0.065;
        const p = torso.at(0.58 + 0.24 * Math.cos(u * Math.PI * 2), Math.PI * 0.32 + u * Math.PI * 2, 0.035 * s);
        lathe(k, [[0.012 * s, 0.03 * s], [0.016 * s, 0.015 * s], [0.016 * s, -0.025 * s]], { at: [p.p.x, p.p.y, p.p.z], rot: [Math.PI / 2 - 0.2, 0, 0], seg: 6, paint: (t) => (t < 0.35 ? GEAR.brassDark : GEAR.brass), finish: BRASS });
      }
    }
    const hip = torso.at(0.3, Math.PI * 1.1, 0.02 * s);
    if (d.level < 3) lathe(k, [[0.06 * s, 0.08 * s], [0.08 * s, 0.06 * s], [0.085 * s, -0.04 * s], [0.06 * s, -0.08 * s]], { at: [hip.p.x - 0.04 * s, hip.p.y, hip.p.z], rot: [Math.PI / 2, 0, 0], seg: d.n(12, 5), caps: true, paint: (t) => (Math.abs(t - 0.5) < 0.08 ? GEAR.leatherDark : P.creel), finish: WEAVE });
  };

  const head = (k: Sculpt): void => {
    // Hackles from the crest down the back of the head into the neck.
    const headAxis: [V3, V3] = [[A.head[0], A.head[1] - hr * 1.6, A.head[2] - hr * 0.1], [A.head[0], A.head[1] + hr * 0.9, A.head[2] - hr * 0.1]];
    hackles(k, inBone(field.only('crown', 'nape', 'neck', 'crest').surface(...headAxis, [0, 0, 1]), A.head), {
      t: [0.2, 0.55], rows: 2, cols: 4, len: 0.1 * s, wid: 0.08 * s, lift: 0.2, paint: (t) => mix(P.white, P.crest, 0.2 + 0.4 * t), finish: FEATHERS, seed: 47,
    }, d);
    // The shaggy crest: loose buff plumes off the back of the crown, lifting on a cast.
    if (d.level < 3) {
      const n = d.keep(9, 3);
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
        const at: V3 = [u * hr * 0.34, hr * (0.55 - 0.15 * Math.abs(u)), -hr * (0.55 + 0.12 * Math.abs(u))];
        const dir = norm([u * 0.5, -0.3 + 0.15 * jitter(i, 5), -1]);
        k.card({ at, dir, face: [0, 1, -0.2], len: hr * (1.5 + 0.4 * jitter(i, 9)), wid: hr * 0.34, cell: CARD.hair, root: P.crest, tip: shade(P.crest, 1.08), curl: -0.3, segs: d.rows, finish: { gloss: 0.15 }, morph: { display: hinge(at, [1, 0, 0], -0.6) } });
      }
    }
    const E = PELICAN_HEAD.eye;
    for (const x of [1, -1]) eye(k, [x * hr * E[0], hr * E[1], hr * E[2]], [x * 0.8, 0.05, 0.6], { r: hr * 0.2, iris: P.iris, ring: shade(P.facial, 0.9), lid: P.facial, ringW: hr * 0.05 }, d);
    pelicanBill(k, hr, d);
  };

  const tail = (k: Sculpt): void => {
    tailFan(k, { count: 8, len: 0.22 * s, wid: 0.08 * s, spread: 1.1, droop: 0.7, root: P.white, tip: P.silver, cell: CARD.tail, finish: { gloss: 0.15 } }, d);
  };

  return {
    body, head, tail, skin,
    wing: wingsOf(wing, d),
    leg: (k, seg, side, upper, lower, ankle) => {
      legsOf(leg, d)(k, seg, side, upper, lower, ankle);
      if (seg === 'foot') web(k, ankle, leg.toes, P.foot, side, d);
    },
    gun: pelicanGun(s, d),
    pivot: { wingL: A.wing, wingR: flipX(A.wing), legL: A.hip, legR: flipX(A.hip), tail: A.tail },
    legLen: A.legLen, legThick: leg.thick, wingLen: H * 0.36,
    // Gulp, Feeding Frenzy, Belly Flop, Bottomless Pouch.
    casts: ['throw', 'raise', 'leap', 'aim'],
    sway: 0.1, castTail: -0.3,
    spinRate: 28,
  };
}

/**
 * The pelican's bill, in the head frame: a long flat upper mandible with a central ridge and a red hooked nail, thin
 * lower rami, and the throat pouch slung between them, sagging deepest a third of the way out. The rami and pouch
 * hinge open together on each shot, and gape wide on a cast (Gulp).
 */
function pelicanBill(k: Sculpt, hr: number, d: Detail): void {
  const P = PELICAN;
  const o: V3 = [0, -hr * 0.12, hr * 0.9];
  const pitch = 0.3;
  const L = hr * 4.4;
  const bw = hr * 0.3;
  const n = d.n(12, 3);
  const seg = d.n(10, 3);
  const upper = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const nail = Math.max(0, (t - 0.88) / 0.12);
    upper.push({ c: pitched(o, pitch, -hr * 0.3 * nail * nail, L * t + hr * 0.1 * nail), w: Math.max(0.002, bw * (1 - 0.3 * t) * (1 - 0.7 * nail * nail)), up: hr * (0.17 - 0.08 * t) * (1 - 0.3 * nail), dn: hr * 0.04 * (1 + 2 * nail) });
  }
  upper.push({ c: pitched(o, pitch, -hr * 0.42, L + hr * 0.08), w: 0, up: 0, dn: 0 });
  k.loft(upper, { seg, paint: (t, a) => (t > 0.9 ? P.nail : Math.sin(a) < -0.2 ? shade(P.bill, 0.78) : Math.abs(Math.cos(a)) < 0.25 ? P.billMid : P.bill), finish: { gloss: 0.55 } });
  const pivot = pitched(o, pitch, -hr * 0.05, -hr * 0.05);
  const morph = { jaw: hinge(pivot, [1, 0, 0], 0.16), display: hinge(pivot, [1, 0, 0], 0.5) };
  // The lower rami: a thin U of bill under the upper's edge.
  const lower = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    lower.push({ c: pitched(o, pitch, -hr * 0.08, L * 0.95 * t), w: bw * 0.95 * (1 - 0.3 * t), up: hr * 0.025, dn: hr * 0.05 * (1 - 0.5 * t) });
  }
  lower.push({ c: pitched(o, pitch, -hr * 0.1, L * 0.97), w: 0, up: 0, dn: 0 });
  k.loft(lower, { seg, paint: shade(P.bill, 0.85), finish: { gloss: 0.5 }, morph });
  // The pouch: bare yellow skin hanging from the rami, veined, deepest a third of the way out.
  const pouch = [];
  const np = d.n(12, 3);
  for (let i = 0; i <= np; i++) {
    const t = i / np;
    const sag = Math.sin(Math.PI * Math.pow(t, 0.7)) * (1 - 0.15 * t);
    pouch.push({ c: pitched(o, pitch, -hr * 0.12, L * 0.88 * t - hr * 0.2), w: bw * 0.85 * (1 - 0.25 * t) * (0.95 + 0.45 * sag), up: hr * 0.02, dn: hr * (0.45 + 1.45 * sag) });
  }
  k.loft(pouch, { seg: d.n(12, 5), paint: (t, a) => mix(P.pouch, P.pouchDark, clamp01(0.5 * Math.sin(t * 30 + Math.cos(a) * 4) - 0.1 - 0.4 * Math.sin(a))), finish: { gloss: 0.45 }, morph, caps: true });
  // Nostril slits along the ridge.
  if (d.level < 2) for (const x of [1, -1]) k.loft([{ c: pitched(o, pitch, hr * 0.1, hr * 0.3), w: hr * 0.012, up: hr * 0.01 }, { c: pitched([x * bw * 0.35, o[1], o[2]], pitch, hr * 0.12, L * 0.35), w: hr * 0.01, up: hr * 0.008 }], { seg: 4, paint: shade(P.bill, 0.6), finish: { gloss: 0.3 } });
}

/** Gullet Gatling: five banded barrels that spin while it fires, a woven creel drum feeding seed shells, a crank, a stock. */
function pelicanGun(s: number, d: Detail): SculptedSpec['gun'] {
  const P = PELICAN;
  const L = 0.82 * s;
  const ringR = 0.026 * s;
  return {
    main: [0, -0.09 * s, -L * 0.72],
    support: [0, -0.06 * s, 0],
    slideAt: [0, -0.03 * s, -L * 0.3],
    travel: 0.02 * s,
    spinAt: [0, 0, 0],
    build(k, part) {
      if (part === 'spin') {
        // The barrel cluster, turning about the bore while it fires.
        const n = d.level >= 2 ? 3 : 5;
        for (let i = 0; i < (d.level >= 3 ? 1 : n); i++) {
          const a = (i / n) * Math.PI * 2;
          const at: V3 = d.level >= 3 ? [0, 0, 0] : [Math.cos(a) * ringR, Math.sin(a) * ringR, 0];
          lathe(k, [[0.006 * s, 0.004 * s], [0.008 * s, -0.01 * s], [0.008 * s, -L * 0.44]], { at, seg: d.n(6, 3), paint: GEAR.iron, finish: { gloss: 0.7 } });
        }
        if (d.level < 2) {
          for (const z of [-0.03, -0.24]) lathe(k, [[ringR * 1.5, z * L + 0.01 * s], [ringR * 1.6, z * L], [ringR * 1.5, z * L - 0.01 * s]], { seg: d.n(14, 6), paint: GEAR.brass, finish: BRASS });
          bead(k, [0, 0, -0.004 * s], 0.009 * s, 0xffb04a, 0.9, d);
        }
        return;
      }
      if (part === 'slide') {
        if (d.level >= 3) return;
        // A vertical foregrip under the barrels, bound in leather.
        lathe(k, [[0.016 * s, 0.0], [0.019 * s, -0.03 * s], [0.017 * s, -0.08 * s]], { at: [0, 0, 0.02 * s], rot: [Math.PI / 2, 0, 0], seg: d.n(8, 4), paint: (t) => (Math.sin(t * 18) > 0.4 ? GEAR.leatherDark : GEAR.woodDark), finish: WOOD });
        return;
      }
      if (part !== 'gun') return;
      if (d.level >= 3) {
        block(k, [0.08 * s, 0.09 * s, L * 0.6], [0, -0.01 * s, -L * 0.7], GEAR.woodDark, WOOD, d);
        return;
      }
      // The housing behind the cluster, a brass carrying handle, the creel drum on the left with its feed throat.
      lathe(k, [[0.045 * s, -L * 0.42], [0.055 * s, -L * 0.46], [0.055 * s, -L * 0.62], [0.042 * s, -L * 0.66]], { seg: d.n(14, 5), paint: GEAR.iron, finish: { gloss: 0.6 } });
      ring(k, [0, 0, -L * 0.46], 0.055 * s, 0.006 * s, d);
      lathe(k, [[0.075 * s, 0.045 * s], [0.085 * s, 0.035 * s], [0.085 * s, -0.035 * s], [0.075 * s, -0.045 * s]], { at: [0.085 * s, -0.01 * s, -L * 0.55], rot: [0, Math.PI / 2, 0], seg: d.n(16, 6), caps: true, paint: (t) => (Math.abs(t - 0.5) < 0.1 ? GEAR.leatherDark : P.creel), finish: WEAVE });
      if (d.level < 2) {
        ring(k, [0.13 * s, -0.01 * s, -L * 0.55], 0.075 * s, 0.006 * s, d, GEAR.brassDark, undefined, [0, Math.PI / 2, 0]);
        block(k, [0.04 * s, 0.03 * s, 0.06 * s], [0.035 * s, 0.03 * s, -L * 0.52], GEAR.brassDark, BRASS, d);
        // The crank on the right.
        block(k, [0.012 * s, 0.07 * s, 0.014 * s], [-0.06 * s, -0.03 * s, -L * 0.58], GEAR.brass, BRASS, d);
        lathe(k, [[0.008 * s, 0.025 * s], [0.008 * s, -0.025 * s]], { at: [-0.075 * s, -0.06 * s, -L * 0.58], rot: [0, Math.PI / 2, 0], seg: 6, paint: GEAR.woodRed, finish: WOOD });
        carve(k, [[-L * 0.4, 0.06 * s], [-L * 0.46, 0.1 * s], [-L * 0.6, 0.1 * s], [-L * 0.64, 0.06 * s], [-L * 0.6, 0.085 * s], [-L * 0.46, 0.085 * s]], 0.012 * s, GEAR.brass, BRASS, d);
      }
      carve(k, [[-L * 0.66, -0.04 * s], [-L * 0.72, -0.04 * s], [-L * 0.78, -0.14 * s], [-L * 0.7, -0.145 * s]], 0.03 * s, GEAR.wood, WOOD, d);
      carve(k, [[-L * 0.64, 0.03 * s], [-L * 0.96, 0.02 * s], [-L, -0.09 * s], [-L * 0.94, -0.11 * s], [-L * 0.68, -0.05 * s]], 0.045 * s, GEAR.woodDark, WOOD, d);
    },
  };
}

// =================================================================================================================
// Penguin: a black-and-white skittle, a sharp white bib under a black head with gold ear patches and throat, a slate
// back, stiff flat flippers that grip the gun, short legs and big dark feet. Snow goggles on the brow, a knitted flock
// scarf. Tank: a short, wide ice blunderbuss with a frosted bell and a glowing hopper of ice chips.

const PENGUIN = {
  black: 0x17181c,
  slate: 0x3d4656,
  white: 0xf4f4f0,
  cream: 0xece8dc,
  gold: 0xf2a72c,
  yellow: 0xf6d36a,
  bill: 0x1c1c20,
  billStripe: 0xe8784a,
  foot: 0x34343a,
  claw: 0x1a1a1c,
  iris: 0x3a2a20,
  ice: 0xbfe6f6,
  frost: 0x8fc8e0,
} as const;

/**
 * A penguin's flipper segment along -y (the IK still bends it at the elbow to hold the gun): a stiff, flat paddle,
 * black on the outer face (+x) and white beneath with a white trailing edge, tapering to a rounded tip at the grip.
 */
function flipper(k: Sculpt, seg: 'arm' | 'hand', upper: number, lower: number, chord: number, thick: number, d: Detail): void {
  const P = PENGUIN;
  const len = seg === 'arm' ? upper : lower;
  const rings = seg === 'arm'
    ? [
      { c: [0, thick * 1.5, -chord * 0.1] as V3, w: 0, up: 0, dn: 0 },
      { c: [0, thick * 0.3, -chord * 0.12] as V3, w: thick, up: chord * 0.22, dn: chord * 0.62 },
      { c: [0, -len * 0.55, -chord * 0.1] as V3, w: thick * 0.9, up: chord * 0.24, dn: chord * 0.62 },
      { c: [0, -len * 1.02, -chord * 0.06] as V3, w: thick * 0.85, up: chord * 0.22, dn: chord * 0.56 },
    ]
    : [
      { c: [0, thick * 0.6, -chord * 0.06] as V3, w: thick * 0.85, up: chord * 0.22, dn: chord * 0.56 },
      { c: [0, -len * 0.5, -chord * 0.04] as V3, w: thick * 0.75, up: chord * 0.18, dn: chord * 0.45 },
      { c: [0, -len * 0.92, 0] as V3, w: thick * 0.7, up: chord * 0.14, dn: chord * 0.3 },
      { c: [0, -len - chord * 0.2, -chord * 0.02] as V3, w: thick * 0.4, up: chord * 0.06, dn: chord * 0.12 },
      { c: [0, -len - chord * 0.3, -chord * 0.04] as V3, w: 0, up: 0, dn: 0 },
    ];
  k.loft(rings, {
    n: d.n(seg === 'arm' ? 7 : 8, 3), seg: d.n(14, 4), ref: [0, 0, 1],
    paint: (_t, a) => (Math.cos(a) < -0.35 || Math.sin(a) < -0.9 ? P.white : Math.cos(a) < 0 ? P.slate : P.black),
    finish: { tile: TILE.scales, size: 0.035, gloss: 0.3 },
  });
}

function penguin(plan: BodyPlan, team: TeamColours, d: Detail): SculptedSpec {
  const H = plan.height;
  const hr = plan.head.radius;
  const A = penguinAnchors(plan);
  const s = A.s;
  const P = PENGUIN;
  const SLEEK = { tile: TILE.scales, size: 0.06, gloss: 0.4 } as const;
  const field = bodyField('penguin', plan);
  const skin = skinFor('penguin', plan, PENGUIN_SKIN, d.level, {
    // A slate-blue back under the black head: the value break the player camera needs.
    back: { paint: (p) => mix(P.slate, P.black, clamp01((p.y - 0.95 * s) / (0.35 * s))), finish: SLEEK },
    mantle: { paint: mix(P.slate, P.black, 0.45), finish: SLEEK },
    scapular: { paint: P.slate, finish: SLEEK },
    shoulder: { paint: P.black, finish: SLEEK },
    coverts: { paint: P.slate, finish: SLEEK },
    breast: { paint: P.black, finish: SLEEK },
    belly: { paint: P.black, finish: SLEEK },
    thigh: { paint: P.black, finish: SLEEK },
    bib: { paint: (p) => mix(P.white, P.yellow, clamp01((p.y - 1.05 * s) / (0.25 * s))), finish: { tile: TILE.scales, size: 0.05, gloss: 0.2 } },
    gold: { paint: P.gold, finish: SLEEK },
    neck: { paint: P.black, finish: SLEEK },
    crown: { paint: P.black, finish: { ...SLEEK, size: 0.04 } },
    nape: { paint: P.black, finish: { ...SLEEK, size: 0.04 } },
    face: { paint: P.black, finish: { gloss: 0.4 } },
    cheek: { paint: P.black, finish: { gloss: 0.4 } },
    brow: { paint: shade(P.black, 1.5), finish: { gloss: 0.4 } },
    throat: { paint: mix(P.black, P.gold, 0.25), finish: SLEEK },
    ear: { paint: (p) => mix(P.gold, P.yellow, clamp01((p.y - A.head[1] + 0.12 * s) / (0.1 * s))), finish: { gloss: 0.3 } },
    bill: { paint: P.bill, finish: { gloss: 0.5 } },
    socket: { paint: shade(P.black, 1.3), finish: { gloss: 0.4 } },
  });
  const leg: LegStyle = {
    skin: P.foot, claw: P.claw, thick: A.legThick, thigh: P.black, fringe: 0.5, skinned: { r: 0.08 * s, at: 0.3 },
    toes: [{ yaw: -0.55, len: 0.12 * s, r: 0.022 * s }, { yaw: -0.05, len: 0.14 * s, r: 0.024 * s }, { yaw: 0.5, len: 0.12 * s, r: 0.022 * s }],
    clawLen: 0.035 * s,
  };
  const chord = 0.17 * s;
  const fthick = 0.022 * s;

  const body = (k: Sculpt): void => {
    const torso = field.only(...TRUNK).surface([0, 0.2 * s, -0.12 * s], [0, 1.2 * s, 0.03 * s], [0, 0, 1]);
    const neckAxis: [V3, V3] = [[0, 1.05 * s, 0.0], [0, A.head[1] - 0.06 * s, 0.0]];
    const collar = field.only(...TRUNK, 'neck').surface(...neckAxis, [0, 0, 1]);
    // The player-camera standard: short dense hackles down the back of the neck onto the slate mantle.
    hackles(k, collar, { t: [0.3, 0.75], rows: 3, cols: 5, len: 0.09 * s, wid: 0.075 * s, lift: 0.12, paint: (t) => mix(P.slate, P.black, 0.4 + 0.6 * t), finish: SLEEK }, d);
    // Gear: a knitted flock scarf with tails down the back, a leather harness with an ice pick and a pouch of chips.
    band(k, collar, 0.3, { width: 0.08 * s, thick: 0.016 * s, hex: team.primary, stitch: team.light, off: 0.006 * s, finish: WEAVE }, d);
    if (d.level < 3) {
      const knot = collar.at(0.3, -Math.PI * 0.62, 0.04 * s);
      for (const x of [1, -1]) k.card({ at: [knot.p.x, knot.p.y, knot.p.z], dir: norm([0.3 + x * 0.2, -1, -0.25]), face: [0, 0.2, -1], len: (x > 0 ? 0.36 : 0.28) * s, wid: 0.085 * s, cell: CARD.cloth, root: team.primary, tip: team.light, curl: 0.3, sweep: x * 0.15, segs: d.level === 0 ? 4 : 2 });
    }
    sash(k, torso, 0.6, 0.18, Math.PI * 0.7, { width: 0.05 * s, thick: 0.014 * s, hex: GEAR.leather, stitch: team.light, off: 0.008 * s, finish: LEATHER }, d);
    band(k, torso, 0.36, { width: 0.05 * s, thick: 0.014 * s, hex: GEAR.leatherDark, off: 0.008 * s, finish: LEATHER }, d);
    pouch(k, torso.at(0.36, Math.PI * 0.25, 0.02 * s), [0.1 * s, 0.1 * s, 0.06 * s], GEAR.leather, d);
    // The ice pick slung on the harness across the back: a wood shaft and a brass head.
    if (d.level < 2) {
      const p = torso.at(0.58, -Math.PI * 0.5, 0.035 * s);
      lathe(k, [[0.012 * s, 0.17 * s], [0.012 * s, -0.17 * s]], { at: [p.p.x, p.p.y, p.p.z], rot: [Math.PI / 2, 0.9, 0], seg: 6, paint: GEAR.wood, finish: WOOD });
      block(k, [0.11 * s, 0.025 * s, 0.03 * s], [p.p.x - 0.13 * s, p.p.y + 0.11 * s, p.p.z], GEAR.brass, BRASS, d, [0, 0, 0.9]);
    }
  };

  const head = (k: Sculpt): void => {
    const headAxis: [V3, V3] = [[A.head[0], A.head[1] - hr * 1.5, A.head[2] - hr * 0.1], [A.head[0], A.head[1] + hr * 0.9, A.head[2] - hr * 0.1]];
    hackles(k, inBone(field.only('crown', 'nape', 'neck').surface(...headAxis, [0, 0, 1]), A.head), {
      t: [0.25, 0.55], rows: 2, cols: 4, len: 0.065 * s, wid: 0.055 * s, lift: 0.2, paint: P.black, finish: SLEEK, seed: 53,
    }, d);
    const E = PENGUIN_HEAD.eye;
    for (const x of [1, -1]) eye(k, [x * hr * E[0], hr * E[1], hr * E[2]], [x * 0.75, 0.05, 0.66], { r: hr * 0.21, iris: P.iris, ring: shade(P.black, 1.4), lid: P.black, ringW: hr * 0.035 }, d);
    const B = PENGUIN_HEAD.bill;
    beak(k, { at: [0, hr * B[1], hr * (B[2] - 0.05)], len: hr * 1.25, w: hr * 0.2, up: hr * 0.17, dn: hr * 0.13, curve: hr * 0.16, hook: hr * 0.03, base: P.bill, tip: P.bill, lower: P.billStripe, open: 0.32 }, d);
    // Snow goggles pushed up on the brow, on a strap round the head: the crown shape from behind.
    if (d.level < 3) {
      for (const x of [1, -1]) {
        const at: V3 = [x * hr * 0.4, hr * 0.78, hr * 0.48];
        ring(k, at, hr * 0.27, hr * 0.07, d, GEAR.brass, undefined, [-0.95, x * 0.4, 0]);
        bead(k, at, hr * 0.24, P.frost, 0.25, d, [1, 1, 0.45]);
      }
      const tilt = norm([0, 1, -0.6]);
      const c: V3 = [A.head[0], A.head[1] + hr * 0.2, A.head[2] - hr * 0.05];
      const skull = field.only('crown', 'nape', 'brow', 'cheek').surface([c[0] - tilt[0] * hr, c[1] - tilt[1] * hr, c[2] - tilt[2] * hr], [c[0] + tilt[0] * hr, c[1] + tilt[1] * hr, c[2] + tilt[2] * hr]);
      band(k, inBone(skull, A.head), 0.5, { width: 0.035 * s, thick: 0.01 * s, hex: team.primary, stitch: team.light, finish: LEATHER }, d);
    }
  };

  const tail = (k: Sculpt): void => {
    tailFan(k, { count: 7, len: 0.15 * s, wid: 0.05 * s, spread: 0.8, droop: 1.15, root: P.black, tip: P.slate, cell: CARD.tail, finish: { gloss: 0.3 } }, d);
  };

  return {
    body, head, tail, skin,
    // The flippers bend at the elbow to grip the gun; they flare out from the sides on a cast.
    wing: (k, seg, _side, upper, lower) => flipper(k, seg, upper, lower, chord, fthick, d),
    leg: (k, seg, side, upper, lower, ankle) => {
      legsOf(leg, d)(k, seg, side, upper, lower, ankle);
      if (seg === 'foot') web(k, ankle, leg.toes, P.foot, side, d);
    },
    gun: penguinGun(s, d),
    pivot: { wingL: A.wing, wingR: flipX(A.wing), legL: A.hip, legR: flipX(A.hip), tail: A.tail },
    legLen: A.legLen, legThick: leg.thick, wingLen: H * 0.34,
    // Toboggan, Huddle, Ice Floe, Emperor's March.
    casts: ['leap', 'raise', 'sweep', 'stomp'],
    sway: 0.15, castTail: -0.3,
  };
}

/** Ice Chipper: a short, wide blunderbuss, a frosted brass bell, a glass hopper of glowing ice chips, a heavy stock. */
function penguinGun(s: number, d: Detail): SculptedSpec['gun'] {
  const P = PENGUIN;
  const L = 0.6 * s;
  const r = 0.024 * s;
  return {
    main: [0, -0.07 * s, -L * 0.66],
    support: [0, -0.034 * s, 0],
    slideAt: [0, -0.006 * s, -L * 0.36],
    travel: 0.035 * s,
    build(k, part) {
      if (part === 'slide') {
        if (d.level >= 3) return;
        lathe(k, [[r * 1.05, 0.05 * s], [r * 1.35, 0.04 * s], [r * 1.4, -0.04 * s], [r * 1.05, -0.05 * s]], { seg: d.n(12, 4), paint: GEAR.woodDark, finish: WOOD });
        return;
      }
      if (part !== 'gun') return;
      // The bell: a wide brass flare with a frosted rim and a pale glow deep inside.
      lathe(k, [[0.085 * s, 0], [0.07 * s, -0.025 * s], [0.045 * s, -0.07 * s], [r * 1.1, -0.13 * s]], { seg: d.n(18, 5), paint: (t) => (t < 0.18 ? P.ice : GEAR.brass), finish: BRASS });
      if (d.level >= 3) {
        lathe(k, [[r * 1.15, -0.12 * s], [r, -L * 0.6], [0.045 * s, -L * 0.75], [0.04 * s, -L]], { seg: 4, paint: GEAR.woodDark });
        return;
      }
      lathe(k, [[0.078 * s, -0.004 * s], [0.035 * s, -0.06 * s], [0.016 * s, -0.11 * s]], { seg: d.n(14, 5), paint: 0x1e2a33, finish: {} });
      bead(k, [0, 0, -0.09 * s], 0.02 * s, P.ice, 0.9, d);
      // Icicle teeth round the rim.
      if (d.level < 2) {
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + 0.3;
          lathe(k, [[0.008 * s, 0], [0, -0.03 * s]], { at: [Math.cos(a) * 0.08 * s, Math.sin(a) * 0.08 * s, -0.004 * s], rot: [Math.PI + Math.sin(a) * 0.3, Math.cos(a) * 0.3, 0], seg: 4, paint: P.ice, finish: { gloss: 0.9, glow: 0.2 } });
        }
      }
      lathe(k, [[r * 1.15, -0.12 * s], [r * 1.05, -L * 0.42], [r * 1.3, -L * 0.54]], { seg: d.n(14, 5), paint: GEAR.iron, finish: { gloss: 0.6 } });
      ring(k, [0, 0, -L * 0.26], r * 1.2, r * 0.25, d);
      // The hopper: a frosted glass jar of ice chips on a brass collar (the ammo read).
      lathe(k, [[0.02 * s, 0.075 * s], [0.04 * s, 0.065 * s], [0.045 * s, 0.0], [0.03 * s, -0.035 * s]], { at: [0, 0.07 * s, -L * 0.52], rot: [-Math.PI / 2, 0, 0], seg: d.n(12, 5), paint: P.frost, finish: { gloss: 0.9, glow: 0.35 } });
      lathe(k, [[0.025 * s, 0.012 * s], [0.026 * s, -0.012 * s]], { at: [0, 0.145 * s, -L * 0.52], rot: [-Math.PI / 2, 0, 0], seg: d.n(10, 5), caps: true, paint: GEAR.brass, finish: BRASS });
      if (d.level < 2) for (let i = 0; i < 4; i++) bead(k, [Math.sin(i * 2.1) * 0.018 * s, 0.075 * s + i * 0.012 * s, -L * 0.52 + Math.cos(i * 2.1) * 0.018 * s], 0.012 * s, P.ice, 0.6, d);
      block(k, [0.06 * s, 0.07 * s, 0.14 * s], [0, -0.004 * s, -L * 0.62], GEAR.woodDark, WOOD, d);
      carve(k, [[-L * 0.62, -0.035 * s], [-L * 0.68, -0.035 * s], [-L * 0.74, -0.13 * s], [-L * 0.66, -0.135 * s]], 0.036 * s, GEAR.wood, WOOD, d);
      // A heavy stock with a brass butt plate.
      carve(k, [[-L * 0.66, 0.025 * s], [-L * 0.97, 0.02 * s], [-L * 1.01, -0.1 * s], [-L * 0.95, -0.13 * s], [-L * 0.7, -0.05 * s]], 0.055 * s, GEAR.woodDark, WOOD, d);
      if (d.level < 2) block(k, [0.058 * s, 0.13 * s, 0.012 * s], [0, -0.055 * s, -L * 1.0], GEAR.brass, BRASS, d, [0.1, 0, 0]);
    },
  };
}

export const C_BUILDS: Readonly<Record<string, SculptedBird>> = { owl, pelican, penguin };
