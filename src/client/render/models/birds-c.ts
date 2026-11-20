/* eslint-disable @typescript-eslint/no-magic-numbers -- authored birds: the numbers are the sculpture */
/**
 * Batch C birds, sculpted to the style guide (§8; GDD §9.5 to §9.12): Owl, Pelican, Penguin, Puffin, Secretarybird and
 * Starling, on implicit bodies (D-ART-008, D-ART-010) with the v2.1 player-camera dress (D-ART-011). Every size comes
 * from the BodyPlan at runtime (head about the head hitbox centre, body inside the capsule, the gun's tip at the
 * muzzle); only fractions and authored offsets are written here.
 */
import { SphereGeometry } from 'three';
import type { Vector3 } from 'three';
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import type { TeamColours } from '../palette';
import { beak, eye, flare, foldedWings, hackles, inBone, legsOf, norm, ovoid, shingle, tailFan, wingsOf } from './anatomy';
import type { LegStyle, WingStyle } from './anatomy';
import { bodyField, flipX, OWL_HEAD, owlAnchors, PELICAN_HEAD, pelicanAnchors, PENGUIN_HEAD, penguinAnchors, PUFFIN_HEAD, puffinAnchors, SECRETARYBIRD_HEAD, secretarybirdAnchors, skinFor, STARLING_HEAD, starlingAnchors, TRUNK } from './bodies';
import { SKIN as OWL_SKIN } from './data/skins/owl';
import { SKIN as PELICAN_SKIN } from './data/skins/pelican';
import { SKIN as PENGUIN_SKIN } from './data/skins/penguin';
import { SKIN as PUFFIN_SKIN } from './data/skins/puffin';
import { SKIN as SECRETARYBIRD_SKIN } from './data/skins/secretarybird';
import { SKIN as STARLING_SKIN } from './data/skins/starling';
import { CARD, TILE } from './feathers';
import { band, bead, block, BRASS, carve, GEAR, LEATHER, lathe, plume, pouch, ring, sash, scope, stud, WEAVE, WOOD } from './gear';
import type { Detail, SculptedBird, SculptedSpec } from './sculpted';
import { hinge, jitter, mix, shade } from './sculpt';
import type { Sculpt, Surface, V3 } from './sculpt';

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
 * A penguin's flipper segment along -y (the IK still bends it at the elbow to hold the gun): a stiff, flat paddle whose
 * broad blade stands out from the side of the body along the wing's outer axis (+x), so it reads held out from the
 * front and from the player camera behind. Black on the back face (-z) and the outer edge, white on the front face,
 * narrowing at the hand to a rounded tip that closes on the grip.
 */
function flipper(k: Sculpt, seg: 'arm' | 'hand', upper: number, lower: number, chord: number, thick: number, d: Detail): void {
  const P = PENGUIN;
  const len = seg === 'arm' ? upper : lower;
  const blade = (y: number, out: number, half: number, t: number): { c: V3; w: number; up: number; dn: number } => ({ c: [chord * out, y, 0], w: chord * half, up: thick * t, dn: thick * t });
  const rings = seg === 'arm'
    ? [
      { c: [chord * 0.1, thick * 1.5, 0] as V3, w: 0, up: 0, dn: 0 },
      blade(thick * 0.2, 0.24, 0.3, 1.1),
      blade(-len * 0.35, 0.44, 0.52, 1),
      blade(-len * 0.75, 0.4, 0.46, 0.95),
      blade(-len * 1.0, 0.32, 0.38, 0.9),
      // A rounded end at the elbow, under the hand's root.
      blade(-len - chord * 0.22, 0.26, 0.26, 0.75),
      { c: [chord * 0.22, -len - chord * 0.34, 0] as V3, w: 0, up: 0, dn: 0 },
    ]
    : [
      blade(thick * 0.5, 0.32, 0.38, 0.9),
      blade(-len * 0.4, 0.24, 0.3, 0.8),
      blade(-len * 0.8, 0.12, 0.2, 0.75),
      blade(-len - chord * 0.08, 0.04, 0.12, 0.6),
      { c: [0, -len - chord * 0.2, 0] as V3, w: 0, up: 0, dn: 0 },
    ];
  k.loft(rings, {
    n: d.n(seg === 'arm' ? 8 : 8, 3), seg: d.n(14, 4), ref: [0, 0, 1],
    // White front face and a white outer edge (it outlines the flipper against the black body from behind).
    paint: (_t, a) => (Math.cos(a) > 0.86 || (Math.sin(a) > 0.2 && Math.cos(a) < 0.75) ? P.white : Math.sin(a) > -0.2 && Math.cos(a) < -0.6 ? P.slate : P.black),
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
  const chord = 0.22 * s;
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

// =================================================================================================================
// Puffin: short and chunky, black above and white below, a big round head with full white cheeks, a dark streak back
// from each eye under grey horn plates, and the hero shape: a tall triangular bill striped blue-grey, yellow and
// orange, three silver sand eels draped across it. Bright orange webbed feet, a flock bandana knotted behind the head.
// Area control: a driftwood Eel Sling with a forked yoke, kelp bands, a leather cup and a row of fishbone barbs.

const PUFFIN = {
  black: 0x17171b,
  grey: 0x4c4e57,
  white: 0xf3f2ee,
  face: 0xe8e8e6,
  blue: 0x6c8296,
  yellow: 0xf2c84a,
  orange: 0xf0652a,
  groove: 0xf6a85a,
  rosette: 0xf4d23a,
  ring: 0xd8402e,
  plate: 0x5e6268,
  foot: 0xf27a2c,
  claw: 0x2a2220,
  iris: 0x2a1c14,
  fish: 0xe4e9ec,
  fishBack: 0x86a0ae,
  drift: 0xa89a84,
  kelp: 0x4e5a2a,
  float: 0x5ad49a,
} as const;

/**
 * Three sand eels held crosswise in the bill (head frame): each hangs from the cutting edge down both sides, head on
 * one side and tail on the other, silver below and blue-grey above, with a small tail fin.
 */
function sandEels(k: Sculpt, base: V3, len: number, halfW: number, hr: number, d: Detail): void {
  if (d.level >= 2) return;
  const P = PUFFIN;
  for (let i = 0; i < 3; i++) {
    const z = base[2] + len * (0.22 + 0.2 * i);
    const y0 = base[1] - hr * 0.02 - hr * 0.08 * i;
    const w = halfW * Math.pow(1 - (0.22 + 0.2 * i), 0.85) + 0.012;
    const drop = hr * (0.75 - 0.1 * i);
    const out = hr * (0.45 - 0.08 * i);
    const side = i % 2 ? -1 : 1;
    // Held crosswise: each eel droops out and down to both sides, the way a puffin carries its catch.
    const path: V3[] = [
      [side * (w + out), y0 - drop, z - hr * 0.1],
      [side * (w + out * 0.55), y0 - drop * 0.35, z - hr * 0.03],
      [0, y0 + hr * 0.02, z],
      [-side * (w + out * 0.55), y0 - drop * 0.3, z + hr * 0.02],
      [-side * (w + out * 0.9), y0 - drop * 0.9, z + hr * 0.08],
    ];
    const rings = [];
    const n = d.level === 0 ? 10 : 6;
    for (let j = 0; j <= n; j++) {
      const u = j / n;
      const f = u * (path.length - 1);
      const a = path[Math.min(path.length - 1, Math.floor(f))]!;
      const b = path[Math.min(path.length - 1, Math.floor(f) + 1)]!;
      const t = f - Math.floor(f);
      const r = hr * 0.075 * (u < 0.1 ? 0.5 + 5 * u : 1 - 0.75 * Math.pow(u, 1.6));
      rings.push({ c: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t] as V3, w: r * 0.7, up: r, dn: r });
    }
    k.loft(rings, { seg: d.n(8, 4), ref: [0, 0, 1], paint: (_t, a) => (Math.sin(a) > 0.3 ? P.fishBack : P.fish), finish: { gloss: 0.85, iri: 0.25 } });
    const tail = path[path.length - 1]!;
    k.card({ at: tail, dir: [0, -1, 0.1], face: [0, 0, 1], len: hr * 0.18, wid: hr * 0.16, cell: CARD.tail, root: P.fish, tip: P.fishBack, segs: 2 });
    const head0 = path[0]!;
    if (d.level === 0) bead(k, [head0[0] + side * hr * 0.03, head0[1] + hr * 0.04, head0[2] + hr * 0.02], hr * 0.02, 0x101418, 0, d);
  }
}

function puffin(plan: BodyPlan, team: TeamColours, d: Detail): SculptedSpec {
  const H = plan.height;
  const hr = plan.head.radius;
  const A = puffinAnchors(plan);
  const s = A.s;
  const P = PUFFIN;
  const SLEEK = { tile: TILE.scales, size: 0.07, gloss: 0.3 } as const;
  const field = bodyField('puffin', plan);
  const skin = skinFor('puffin', plan, PUFFIN_SKIN, d.level, {
    back: { paint: P.black, finish: SLEEK },
    mantle: { paint: P.black, finish: SLEEK },
    scapular: { paint: P.black, finish: SLEEK },
    shoulder: { paint: P.black, finish: SLEEK },
    coverts: { paint: P.black, finish: SLEEK },
    breast: { paint: P.black, finish: SLEEK },
    belly: { paint: P.black, finish: SLEEK },
    thigh: { paint: mix(P.black, P.grey, 0.4), finish: SLEEK },
    bib: { paint: P.white, finish: { tile: TILE.scales, size: 0.06, gloss: 0.15 } },
    neck: { paint: P.black, finish: SLEEK },
    collar: { paint: P.black, finish: SLEEK },
    // A charcoal crown and nape over the black mantle, and the white face wrapping round the cheeks: the head reads
    // apart from the back from the player camera.
    crown: { paint: P.grey, finish: { ...SLEEK, size: 0.05 } },
    mask: { paint: P.face, finish: { gloss: 0.15 } },
    nape: { paint: (p) => mix(P.grey, P.black, clamp01((A.head[1] - p.y) / (0.18 * s))), finish: { ...SLEEK, size: 0.05 } },
    face: { paint: P.face, finish: { gloss: 0.15 } },
    cheek: { paint: P.face, finish: { gloss: 0.15 } },
    brow: { paint: mix(P.face, P.grey, 0.3), finish: { gloss: 0.15 } },
    throat: { paint: (p) => mix(P.face, P.black, clamp01((A.head[1] - 0.06 * s - p.y) / (0.06 * s))), finish: { gloss: 0.15 } },
    streak: { paint: P.plate, finish: { gloss: 0.2 } },
    // The bill's base on the face is pale grey skin; the striped triangle is the loft in front of it.
    bill: { paint: mix(P.face, P.plate, 0.35), finish: { gloss: 0.3 } },
    socket: { paint: P.ring, finish: { gloss: 0.4 } },
  });
  const leg: LegStyle = {
    skin: P.foot, claw: P.claw, thick: A.legThick, thigh: P.black, fringe: 0.5, skinned: { r: 0.075 * s, at: 0.3 },
    toes: [{ yaw: -0.55, len: 0.11 * s, r: 0.02 * s }, { yaw: -0.05, len: 0.13 * s, r: 0.022 * s }, { yaw: 0.5, len: 0.11 * s, r: 0.02 * s }],
    clawLen: 0.03 * s,
  };
  const wing: WingStyle = {
    covert: P.black, secondary: shade(P.grey, 0.8), primary: P.black, primaryTip: shade(P.grey, 0.7), trim: team.primary,
    thick: 0.03 * s, chord: 0.2 * s, primaries: 6, secondaries: 4, primaryLen: 0.55, secondaryLen: 0.6,
  };

  const body = (k: Sculpt): void => {
    const torso = field.only(...TRUNK).surface([0, 0.3 * s, -0.12 * s], [0, 1.02 * s, 0.03 * s], [0, 0, 1]);
    const collar = field.only(...TRUNK, 'neck').surface([0, 0.85 * s, -0.02 * s], [0, A.head[1] - 0.05 * s, 0.0], [0, 0, 1]);
    hackles(k, collar, { t: [0.25, 0.7], rows: 3, cols: 5, len: 0.08 * s, wid: 0.07 * s, lift: 0.14, paint: (t) => mix(P.black, P.grey, 0.2 + 0.5 * t), finish: SLEEK }, d);
    foldedWings(k, torso, wing, { t: [0.45, 0.85], a: 0.25, len: 0.3 * s, wid: 0.1 * s }, d);
    // Gear: a flock satchel strap over the shoulder (it reads across the back), a rope net satchel on the hip.
    sash(k, torso, 0.62, 0.2, Math.PI * 0.32, { width: 0.055 * s, thick: 0.012 * s, hex: team.primary, stitch: team.light, off: 0.008 * s, finish: WEAVE }, d);
    pouch(k, torso.at(0.4, Math.PI * 1.15, 0.01 * s), [0.12 * s, 0.11 * s, 0.07 * s], GEAR.rope, d, shade(GEAR.rope, 0.8));
    // A belt with spare eels in loops (the sling's ammo).
    band(k, torso, 0.32, { width: 0.045 * s, thick: 0.012 * s, hex: GEAR.leatherDark, stitch: team.light, off: 0.008 * s, finish: LEATHER }, d);
    if (d.level < 2) {
      for (let i = 0; i < 4; i++) {
        const p = torso.at(0.32, Math.PI * (0.25 + 0.12 * i), 0.02 * s);
        k.loft([{ c: [p.p.x, p.p.y + 0.035 * s, p.p.z], w: 0.008 * s, up: 0.01 * s }, { c: [p.p.x, p.p.y - 0.01 * s, p.p.z + 0.004 * s], w: 0.011 * s, up: 0.013 * s }, { c: [p.p.x, p.p.y - 0.05 * s, p.p.z], w: 0, up: 0 }], { seg: 6, ref: [0, 0, 1], paint: (t) => (t < 0.4 ? P.fishBack : P.fish), finish: { gloss: 0.8 } });
      }
    }
  };

  const head = (k: Sculpt): void => {
    hackles(k, inBone(field.only('crown', 'nape', 'neck').surface([A.head[0], A.head[1] - hr * 1.5, A.head[2] - hr * 0.1], [A.head[0], A.head[1] + hr * 0.9, A.head[2] - hr * 0.1], [0, 0, 1]), A.head), {
      t: [0.22, 0.5], rows: 2, cols: 4, len: 0.07 * s, wid: 0.06 * s, lift: 0.2, paint: (t) => mix(P.black, P.grey, 0.3 + 0.5 * t), finish: SLEEK, seed: 59,
    }, d);
    const E = PUFFIN_HEAD.eye;
    for (const x of [1, -1]) {
      eye(k, [x * hr * E[0], hr * E[1], hr * E[2]], [x * 0.8, 0.05, 0.6], { r: hr * 0.17, iris: P.iris, ring: P.ring, lid: P.plate, ringW: hr * 0.04 }, d);
      // The grey horn plates over and under each eye: the puffin's sad-clown look.
      if (d.level < 2) {
        const c: V3 = [x * hr * (E[0] + 0.12), hr * E[1], hr * E[2]];
        k.loft([{ c: [c[0], c[1] + hr * 0.16, c[2]], w: hr * 0.06, up: hr * 0.03 }, { c: [c[0] - x * hr * 0.02, c[1] + hr * 0.34, c[2] - hr * 0.04], w: 0, up: 0 }], { seg: 4, ref: [0, 0, 1], paint: P.plate, finish: { gloss: 0.5 } });
        k.loft([{ c: [c[0], c[1] - hr * 0.16, c[2]], w: hr * 0.08, up: hr * 0.02 }, { c: [c[0] - x * hr * 0.03, c[1] - hr * 0.26, c[2] - hr * 0.1], w: 0, up: 0 }], { seg: 4, ref: [0, 0, 1], paint: P.plate, finish: { gloss: 0.5 } });
      }
    }
    // The bill: a tall, laterally flat triangle, blue-grey at the base behind a yellow ridge, orange outward with pale
    // grooves; a yellow rosette at each corner of the gape.
    const B = PUFFIN_HEAD.bill;
    const at: V3 = [0, hr * B[1], hr * (B[2] + 0.02)];
    const len = hr * 1.3;
    const w = hr * 0.25;
    beak(k, {
      at, len, w, up: hr * 0.62, dn: hr * 0.5, curve: hr * 0.32, hook: hr * 0.05, base: P.blue, tip: P.orange, open: 0.3, displayOpen: 0.45,
      bands: [[0, P.blue], [0.26, P.yellow], [0.33, P.orange], [0.55, P.groove], [0.6, P.orange], [0.76, P.groove], [0.8, P.orange]],
    }, d);
    if (d.level < 2) for (const x of [1, -1]) bead(k, [x * w * 1.05, at[1] - hr * 0.06, at[2] + hr * 0.02], hr * 0.06, P.rosette, 0, d, [0.7, 1, 1]);
    sandEels(k, at, len, w, hr, d);
    // A flock bandana tied round the crown, knotted behind with two short tails: the crown shape from behind.
    if (d.level < 3) {
      const tilt = norm([0, 1, -0.3]);
      const c: V3 = [A.head[0], A.head[1] + hr * 0.3, A.head[2] - hr * 0.05];
      const skull = field.only('crown', 'nape', 'brow', 'cheek').surface([c[0] - tilt[0] * hr, c[1] - tilt[1] * hr, c[2] - tilt[2] * hr], [c[0] + tilt[0] * hr, c[1] + tilt[1] * hr, c[2] + tilt[2] * hr]);
      const crown = inBone(skull, A.head);
      band(k, crown, 0.5, { width: 0.06 * s, thick: 0.014 * s, hex: team.primary, stitch: team.light, off: 0.004 * s, finish: WEAVE }, d);
      const knot = crown.at(0.5, -Math.PI / 2, 0.02 * s);
      bead(k, [knot.p.x, knot.p.y, knot.p.z], 0.022 * s, team.primary, 0, d, [1, 0.8, 0.7]);
      for (const x of [1, -1]) k.card({ at: [knot.p.x, knot.p.y, knot.p.z], dir: norm([x * 0.5, -0.8, -0.5]), face: [0, 0.3, -1], len: 0.1 * s, wid: 0.045 * s, cell: CARD.cloth, root: team.primary, tip: team.dark, curl: 0.2, sweep: x * 0.2, segs: 2 });
    }
  };

  const tail = (k: Sculpt): void => {
    tailFan(k, { count: 7, len: 0.14 * s, wid: 0.05 * s, spread: 0.9, droop: 0.8, root: P.black, tip: P.grey, cell: CARD.tail, finish: { gloss: 0.3 } }, d);
  };

  return {
    body, head, tail, skin,
    wing: wingsOf(wing, d),
    leg: (k, seg, side, upper, lower, ankle) => {
      legsOf(leg, d)(k, seg, side, upper, lower, ankle);
      if (seg === 'foot') web(k, ankle, leg.toes, P.foot, side, d);
    },
    gun: puffinGun(s, d),
    pivot: { wingL: A.wing, wingR: flipX(A.wing), legL: A.hip, legR: flipX(A.hip), tail: A.tail },
    legLen: A.legLen, legThick: leg.thick, wingLen: H * 0.36,
    // Burrow Colony, Sea Spray, Fog Bank, Rogue Wave.
    casts: ['throw', 'sweep', 'raise', 'throw'],
    sway: 0.08, castTail: -0.4,
  };
}

/** Eel Sling: a driftwood stock with a forked yoke and a glass float, kelp bands to a leather cup, fishbone barbs. */
function puffinGun(s: number, d: Detail): SculptedSpec['gun'] {
  const P = PUFFIN;
  const L = 0.58 * s;
  const fork = 0.05 * s;
  return {
    main: [0, -0.06 * s, -L * 0.62],
    support: [0, -0.02 * s, -0.02 * s],
    slideAt: [0, 0.0, -L * 0.36],
    travel: 0.05 * s,
    build(k, part) {
      if (part === 'slide') {
        if (d.level >= 3) return;
        // The leather cup with an eel ready in it, and the two kelp bands running forward to the yoke's tips.
        block(k, [0.05 * s, 0.03 * s, 0.035 * s], [0, 0, 0], GEAR.leather, LEATHER, d);
        if (d.level < 2) {
          lathe(k, [[0.004 * s, 0.03 * s], [0.012 * s, 0.0], [0.004 * s, -0.035 * s]], { at: [0, 0.018 * s, 0], seg: 6, paint: P.fish, finish: { gloss: 0.8 } });
          for (const x of [1, -1]) k.loft([{ c: [x * 0.022 * s, 0.004 * s, 0.01 * s], w: 0.005 * s, up: 0.004 * s }, { c: [x * fork, 0.04 * s, L * 0.32], w: 0.004 * s, up: 0.003 * s }], { seg: 4, paint: P.kelp, finish: { gloss: 0.5 } });
        }
        return;
      }
      if (part !== 'gun') return;
      if (d.level >= 3) {
        lathe(k, [[0.02 * s, 0], [0.018 * s, -L * 0.5], [0.03 * s, -L * 0.7], [0.022 * s, -L]], { seg: 4, paint: P.drift });
        return;
      }
      // The yoke: two driftwood prongs forking up from the stock, rope-bound, the glass float glowing between them.
      for (const x of [1, -1]) {
        k.loft([{ c: [0, -0.01 * s, -0.09 * s], w: 0.012 * s, up: 0.012 * s }, { c: [x * fork * 0.6, 0.015 * s, -0.04 * s], w: 0.01 * s, up: 0.01 * s }, { c: [x * fork, 0.04 * s, -0.02 * s], w: 0.008 * s, up: 0.008 * s }, { c: [x * fork * 1.05, 0.05 * s, -0.018 * s], w: 0, up: 0 }], { seg: d.n(8, 4), paint: P.drift, finish: WOOD });
      }
      bead(k, [0, 0.012 * s, -0.012 * s], 0.017 * s, P.float, 0.85, d);
      if (d.level < 2) ring(k, [0, 0.012 * s, -0.012 * s], 0.018 * s, 0.003 * s, d, GEAR.rope, undefined, [0, Math.PI / 2, 0]);
      // The driftwood stock, bleached and knotted, bound with rope at the fork.
      lathe(k, [[0.016 * s, -0.08 * s], [0.018 * s, -L * 0.3], [0.016 * s, -L * 0.5], [0.022 * s, -L * 0.56]], { seg: d.n(10, 4), paint: (t) => (t < 0.12 ? GEAR.rope : P.drift), finish: WOOD });
      carve(k, [[-L * 0.56, -0.02 * s], [-L * 0.63, -0.02 * s], [-L * 0.69, -0.1 * s], [-L * 0.61, -0.105 * s]], 0.026 * s, shade(P.drift, 0.85), WOOD, d);
      carve(k, [[-L * 0.6, 0.02 * s], [-L * 0.9, 0.02 * s], [-L, 0.0], [-L * 1.0, -0.07 * s], [-L * 0.92, -0.075 * s], [-L * 0.64, -0.03 * s]], 0.032 * s, P.drift, WOOD, d);
      if (d.level < 2) {
        // Fishbone barbs along the top of the stock (the area-control signature).
        for (let i = 0; i < 5; i++) k.loft([{ c: [0, 0.016 * s, -L * (0.14 + 0.07 * i)], w: 0.004 * s, up: 0.004 * s }, { c: [0, 0.045 * s, -L * (0.14 + 0.07 * i) - 0.02 * s], w: 0, up: 0 }], { seg: 4, paint: GEAR.bone, finish: { gloss: 0.5 } });
        // A net bag of spare eels under the stock (the ammo read).
        lathe(k, [[0.008 * s, 0.03 * s], [0.03 * s, 0.0], [0.024 * s, -0.04 * s], [0.0, -0.06 * s]], { at: [0, -0.04 * s, -L * 0.36], rot: [Math.PI / 2, 0, 0], seg: d.n(10, 5), paint: (t, a) => (Math.sin(a * 6 + t * 20) > 0.6 ? GEAR.rope : P.fish), finish: { gloss: 0.6 } });
      }
    },
  };
}

// =================================================================================================================
// Secretarybird: the tallest, thinnest hero. A small pale-grey body on pink stilts in black feathered breeches, a
// slender neck, an eagle's head with a heavy brow, bare orange skin and long lashes round the eye, and the hero
// shape: a crown of long black-tipped quills fanned behind the head that rises on a cast. A long grey tail with two
// streamers. Mobility skirmisher: the Quill Pair, two slim quill pistols with brass nib muzzles, one in each wing.

const SECRETARY = {
  pale: 0xd4d7da,
  grey: 0xa7adb3,
  mantle: 0x868d94,
  black: 0x1c1c20,
  orange: 0xf08a2a,
  leg: 0xd2a492,
  claw: 0x2a2422,
  bill: 0x4a4c50,
  billTip: 0x26262a,
  iris: 0x4a2a14,
  lash: 0x141416,
  quill: 0xeee4cc,
  nib: 0xd6a648,
  ink: 0x1a2440,
} as const;

/**
 * One quill pistol along -z, its brass nib at the origin: a cream quill-shaft barrel with brass bands, a fletching vane
 * along its top, a dark carved grip at `grip` and a clip of spare quill darts down its side.
 */
function quillPistol(k: Sculpt, L: number, s: number, d: Detail, flip: 1 | -1): void {
  const S = SECRETARY;
  if (d.level >= 3) {
    lathe(k, [[0.012 * s, 0], [0.014 * s, -L * 0.6], [0.02 * s, -L * 0.75], [0.016 * s, -L]], { seg: 4, paint: S.quill });
    return;
  }
  // The nib: a split brass point, with a warm glow at its tip (the lit muzzle).
  lathe(k, [[0.003 * s, 0.006 * s], [0.011 * s, -0.025 * s], [0.013 * s, -0.04 * s]], { seg: d.n(10, 4), paint: S.nib, finish: BRASS, flat: 0.6 });
  bead(k, [0, 0, 0.004 * s], 0.006 * s, 0xffb24a, 0.9, d);
  lathe(k, [[0.012 * s, -0.038 * s], [0.013 * s, -L * 0.35], [0.015 * s, -L * 0.55], [0.017 * s, -L * 0.58]], { seg: d.n(10, 4), paint: (t) => (Math.abs(t - 0.3) < 0.04 || Math.abs(t - 0.75) < 0.04 ? GEAR.brass : S.quill), finish: { gloss: 0.6 } });
  if (d.level < 2) plume(k, [0, 0.014 * s, -L * 0.2], [0, 0.12, -1], L * 0.36, 0.03 * s, S.quill, CARD.quill, [flip * 0.3, 1, 0], S.black);
  block(k, [0.03 * s, 0.042 * s, 0.09 * s], [0, -0.004 * s, -L * 0.64], GEAR.woodDark, WOOD, d);
  carve(k, [[-L * 0.6, -0.02 * s], [-L * 0.68, -0.02 * s], [-L * 0.8, -0.1 * s], [-L * 0.72, -0.108 * s]], 0.024 * s, GEAR.woodRed, WOOD, d);
  if (d.level < 2) {
    stud(k, [flip * 0.016 * s, -0.004 * s, -L * 0.64], 0.006 * s);
    for (let i = 0; i < 3; i++) lathe(k, [[0.003 * s, 0.03 * s], [0.003 * s, -0.03 * s]], { at: [flip * 0.018 * s, -0.012 * s - i * 0.008 * s, -L * 0.38], seg: 4, paint: S.ink, finish: { gloss: 0.5 } });
  }
}

function secretarybird(plan: BodyPlan, team: TeamColours, d: Detail): SculptedSpec {
  const H = plan.height;
  const hr = plan.head.radius;
  const A = secretarybirdAnchors(plan);
  const s = A.s;
  const S = SECRETARY;
  const SOFT = { tile: TILE.scales, size: 0.06, gloss: 0.15 } as const;
  const field = bodyField('secretarybird', plan);
  const skin = skinFor('secretarybird', plan, SECRETARYBIRD_SKIN, d.level, {
    // A darker grey mantle and scapulars under the pale neck: the value break from the player camera.
    back: { paint: (p) => mix(S.grey, S.mantle, clamp01((p.y - 1.5 * s) / (0.2 * s))), finish: SOFT },
    mantle: { paint: S.mantle, finish: SOFT },
    scapular: { paint: mix(S.mantle, S.black, 0.25), finish: SOFT },
    shoulder: { paint: S.mantle, finish: SOFT },
    coverts: { paint: S.grey, finish: SOFT },
    breast: { paint: (p) => mix(S.pale, S.grey, clamp01(Math.abs(p.x) / (0.15 * s))), finish: SOFT },
    belly: { paint: mix(S.grey, S.black, 0.35), finish: SOFT },
    thigh: { paint: S.black, finish: { tile: TILE.scales, size: 0.045, gloss: 0.25 } },
    neck: { paint: S.pale, finish: { ...SOFT, size: 0.045 } },
    crown: { paint: S.grey, finish: { ...SOFT, size: 0.04 } },
    crest: { paint: mix(S.grey, S.black, 0.6), finish: { ...SOFT, size: 0.04 } },
    nape: { paint: mix(S.pale, S.grey, 0.5), finish: { ...SOFT, size: 0.04 } },
    face: { paint: S.pale, finish: { gloss: 0.1 } },
    cheek: { paint: S.pale, finish: { gloss: 0.1 } },
    brow: { paint: S.grey, finish: { gloss: 0.15 } },
    throat: { paint: S.pale, finish: SOFT },
    facial: { paint: S.orange, finish: { gloss: 0.4 } },
    bill: { paint: S.bill, finish: { gloss: 0.5 } },
    socket: { paint: shade(S.orange, 0.85), finish: { gloss: 0.4 } },
  });
  const leg: LegStyle = {
    skin: S.leg, claw: S.claw, thick: A.legThick, thigh: S.black, fringe: 0.22, fringeCell: CARD.contour, skinned: { r: 0.045 * s, at: 0.82 },
    toes: [{ yaw: -0.5, len: 0.08 * s, r: 0.014 * s }, { yaw: 0, len: 0.1 * s, r: 0.015 * s }, { yaw: 0.5, len: 0.08 * s, r: 0.014 * s }, { yaw: Math.PI, len: 0.035 * s, r: 0.012 * s }],
    clawLen: 0.02 * s,
  };
  const wing: WingStyle = {
    covert: S.grey, secondary: S.black, primary: S.black, primaryTip: shade(S.black, 1.6), trim: team.primary,
    thick: 0.03 * s, chord: 0.22 * s, primaries: 6, secondaries: 5, primaryLen: 0.6, secondaryLen: 0.8,
  };

  const body = (k: Sculpt): void => {
    const torso = field.only(...TRUNK).surface([0, 1.42 * s, -0.4 * s], [0, 1.66 * s, 0.18 * s]);
    const neckAxis: [V3, V3] = [[0, 1.62 * s, 0.12 * s], [0, A.head[1] - 0.05 * s, 0]];
    const collar = field.only(...TRUNK, 'neck').surface(...neckAxis, [0, 0, 1]);
    // The player-camera standard: pale grey hackles down the back of the neck onto the darker mantle.
    hackles(k, collar, { t: [0.2, 0.6], rows: 3, cols: 4, len: 0.08 * s, wid: 0.06 * s, lift: 0.16, paint: (t) => mix(S.mantle, S.pale, t), finish: SOFT }, d);
    foldedWings(k, torso, wing, { t: [0.35, 0.75], a: 0.45, len: 0.42 * s, wid: 0.09 * s }, d);
    // Gear: a flock sash, a holster belt, and a quiver of spare quills across the back (it reads from behind).
    sash(k, torso, 0.6, 0.2, Math.PI * 0.4, { width: 0.05 * s, thick: 0.012 * s, hex: team.primary, stitch: team.light, off: 0.008 * s, finish: WEAVE }, d);
    band(k, torso, 0.5, { width: 0.035 * s, thick: 0.01 * s, hex: GEAR.leatherDark, off: 0.006 * s, finish: LEATHER }, d);
    pouch(k, torso.at(0.5, Math.PI * 0.05, 0.006 * s), [0.06 * s, 0.08 * s, 0.04 * s], GEAR.leather, d);
    if (d.level < 3) {
      const q = torso.at(0.55, Math.PI * 0.62, 0.03 * s);
      const qa: V3 = [q.p.x, q.p.y, q.p.z];
      lathe(k, [[0.026 * s, 0.11 * s], [0.03 * s, 0.09 * s], [0.03 * s, -0.11 * s], [0.024 * s, -0.12 * s]], { at: qa, rot: [-0.7, 0, -0.5], seg: d.n(10, 5), caps: true, paint: (t) => (t < 0.12 || t > 0.9 ? GEAR.brass : GEAR.leather), finish: LEATHER });
      if (d.level < 2) {
        for (let i = 0; i < 5; i++) {
          const dir = norm([-0.3 + (i - 2) * 0.08, 0.75, -0.55]);
          k.card({ at: [qa[0] - 0.04 * s + i * 0.008 * s, qa[1] + 0.08 * s, qa[2] - 0.05 * s], dir, face: [0, 0.4, -1], len: 0.16 * s, wid: 0.025 * s, cell: CARD.quill, root: S.quill, tip: i % 2 ? S.black : team.primary, segs: 2 });
        }
      }
    }
  };

  const head = (k: Sculpt): void => {
    hackles(k, inBone(field.only('crown', 'nape', 'neck', 'crest').surface([A.head[0], A.head[1] - hr * 1.8, A.head[2] - hr * 0.1], [A.head[0], A.head[1] + hr * 0.9, A.head[2] - hr * 0.1], [0, 0, 1]), A.head), {
      t: [0.2, 0.5], rows: 2, cols: 4, len: 0.06 * s, wid: 0.05 * s, lift: 0.2, paint: (t) => mix(S.grey, S.pale, t), finish: SOFT, seed: 61,
    }, d);
    const E = SECRETARYBIRD_HEAD.eye;
    for (const x of [1, -1]) {
      eye(k, [x * hr * E[0], hr * E[1], hr * E[2]], [x * 0.78, 0.05, 0.62], { r: hr * 0.24, iris: S.iris, ring: S.orange, lid: S.orange, ringW: hr * 0.045 }, d);
      // Long dark lashes over each eye.
      if (d.level < 2) {
        for (let i = 0; i < 4; i++) {
          const u = i / 3;
          const at: V3 = [x * hr * (E[0] + 0.05), hr * (E[1] + 0.22), hr * (E[2] - 0.12 + 0.24 * u)];
          k.card({ at, dir: norm([x * 0.5, 0.6, 0.3 + 0.4 * u]), face: [x, 0.2, 0], len: hr * 0.32, wid: hr * 0.06, cell: CARD.hair, root: S.lash, tip: S.lash, segs: 2 });
        }
      }
    }
    // A raptor's hooked bill, grey to a dark tip.
    const B = SECRETARYBIRD_HEAD.bill;
    beak(k, { at: [0, hr * B[1], hr * (B[2] - 0.05)], len: hr * 0.95, w: hr * 0.24, up: hr * 0.3, dn: hr * 0.16, curve: hr * 0.32, hook: hr * 0.18, base: S.bill, tip: S.billTip, open: 0.32 }, d);
    // The quill crown: long black-tipped quills fanned back from the nape in two tiers, rising on a cast. It is the
    // bird's primary shape, so four quills survive even at the far level.
    const tiers: [number, number][] = d.level === 0 ? [[7, 1], [6, 0.78]] : d.level === 1 ? [[5, 1], [4, 0.78]] : d.level === 2 ? [[5, 1]] : [[4, 1]];
    tiers.forEach(([n, len], tier) => {
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
        // A fan rising up and back from the nape; each quill faces along the fan's normal, so the crown is broadside
        // to the player camera behind and to a viewer in front.
        const rise = tier === 0 ? 0.62 : 0.2;
        const at: V3 = [u * hr * 0.42, hr * (0.4 - 0.28 * tier - 0.1 * Math.abs(u)), -hr * (0.6 + 0.08 * tier)];
        const dir = norm([u * 0.75, rise - 0.25 * Math.abs(u), -0.8]);
        k.card({
          at, dir, face: norm([0, 0.8, rise]), len: hr * 2.7 * len * (0.92 + 0.12 * jitter(i + tier * 7, 3)), wid: hr * 0.38, cell: CARD.tail, root: shade(S.black, 2.2), tip: S.black,
          curl: -0.25, segs: d.level === 0 ? 5 : d.level === 3 ? 2 : 3, finish: { gloss: 0.3 },
          morph: { display: hinge(at, [1, 0, 0], -0.8 - 0.2 * tier) },
        });
      }
    });
  };

  const tail = (k: Sculpt): void => {
    // A long graduated tail, its two central streamers far beyond the rest, black-tipped.
    tailFan(k, { count: 8, len: 0.42 * s, wid: 0.06 * s, spread: 0.5, droop: 0.75, centreLonger: 0.9, root: S.grey, tip: S.black, cell: CARD.tail, finish: { gloss: 0.2 } }, d);
  };

  return {
    body, head, tail, skin,
    wing: wingsOf(wing, d),
    leg: legsOf(leg, d),
    gun: secretarybirdGun(s, d),
    pivot: { wingL: A.wing, wingR: flipX(A.wing), legL: A.hip, legR: flipX(A.hip), tail: A.tail },
    legLen: A.legLen, legThick: leg.thick, wingLen: H * 0.24,
    // Stomp Kick, Long Stride, Snake Stamp, Viper Dance.
    casts: ['stomp', 'leap', 'leap', 'stomp'],
    sway: 0.05, castTail: -0.5,
  };
}

/** Quill Pair: two quill pistols side by side, one in each wing; the second rides the slide and kicks back in turn. */
function secretarybirdGun(s: number, d: Detail): SculptedSpec['gun'] {
  const L = 0.4 * s;
  return {
    main: [0, -0.06 * s, -L * 0.68],
    support: [0, -0.06 * s, -L * 0.68],
    slideAt: [0.075 * s, -0.004 * s, -0.03 * s],
    travel: 0.03 * s,
    build(k, part) {
      if (part === 'gun') quillPistol(k, L, s, d, -1);
      else if (part === 'slide') quillPistol(k, L, s, d, 1);
    },
  };
}

// =================================================================================================================
// Starling: small, plump and spiky. Glossy black with a purple sheen on the head and green on the body, pale-tipped
// speckled feathers over the mantle and breast, a ruff of spiky shoulder feathers that bristles on a cast, lanceolate
// throat hackles, a crest tuft, a long yellow bill, reddish legs, a short square tail, and the hero shape: a halo of
// eight tiny starlings orbiting at head height. Spirit burst: a twin-barrelled Chatter Pistol with a glass jar of
// glowing specks and a music-box key.

const STARLING = {
  black: 0x1a1b1d,
  green: 0x1c2a22,
  purple: 0x2a1e30,
  brown: 0x3e3630,
  buff: 0xc8b088,
  bill: 0xe8c43a,
  billBase: 0x7a8a9a,
  leg: 0xb06a5a,
  claw: 0x2a2220,
  iris: 0x2a1a10,
  glow: 0xc48cff,
  lacquer: 0x2a1c34,
} as const;

/** A small glowing speck (a low sphere: cheaper than a bead where many are needed). */
const speck = (k: Sculpt, at: V3, r: number, hex: number, glow: number): void => {
  k.mesh(new SphereGeometry(r, 4, 3), { at, paint: hex, finish: { glow, gloss: 0.8 } });
};

/**
 * Speckled plumage: rows of feathers over a surface, glossy dark at the root and pale at the tip, so each tip reads as
 * the starling's white speck (`shingle` takes one colour, this takes a tip colour).
 */
function speckled(k: Sculpt, surf: Surface, o: { t: readonly [number, number]; a: readonly [number, number]; rows: number; cols: number; len: number; wid: number; root: number; tip: number; lift: number; seed: number }, d: Detail): void {
  if (d.level >= 2) return;
  const rows = d.keep(o.rows, 1);
  const cols = d.keep(o.cols, 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = o.t[0] + (o.t[1] - o.t[0]) * (rows === 1 ? 0.5 : r / (rows - 1));
      const a = o.a[0] + (o.a[1] - o.a[0]) * ((c + 0.5 + (r % 2) * 0.5) / (cols + 0.5)) + (jitter(r * cols + c, o.seed) - 0.5) * 0.06;
      const sp = surf.at(t, a, 0.003);
      const down = sp.t.clone().multiplyScalar(-1);
      const dir = norm([down.x * Math.cos(o.lift) + sp.n.x * Math.sin(o.lift), down.y * Math.cos(o.lift) + sp.n.y * Math.sin(o.lift), down.z * Math.cos(o.lift) + sp.n.z * Math.sin(o.lift)]);
      k.card({ at: [sp.p.x, sp.p.y, sp.p.z], dir, face: [sp.n.x, sp.n.y, sp.n.z], len: o.len, wid: o.wid, cell: CARD.spotted, root: o.root, tip: o.tip, curl: -o.lift * 0.8, segs: d.rows, cup: 0.06, finish: { gloss: 0.5, iri: 0.6 } });
    }
  }
}

/** The orbiting flock (halo bone, about the head centre): eight tiny starlings flying round, wings up in a V. */
function starlingHalo(k: Sculpt, ringR: number, hr: number, d: Detail): void {
  const S = STARLING;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const at: V3 = [Math.sin(a) * ringR, Math.sin(a * 3) * hr * 0.25, Math.cos(a) * ringR];
    // Flying along the orbit (the halo bone turns about +y), banking a little into the turn.
    const v: V3 = [Math.cos(a), 0, -Math.sin(a)];
    const yaw = Math.atan2(v[0], v[2]);
    // Sized to read as specks at 40 m (GDD §9.24.1), not as true-scale starlings; simpler with each level.
    const len = 0.06;
    ovoid(k, at, [0.032, 0.028, len], { rot: [0, yaw, 0.25], n: [4, 3, 2, 2][d.level], seg: [5, 4, 4, 3][d.level], egg: 0.25, paint: i % 2 ? S.purple : S.green, finish: { iri: 0.7, gloss: 0.6 } });
    if (d.level >= 2) continue;
    const head: V3 = [at[0] + v[0] * len, at[1] + 0.01, at[2] + v[2] * len];
    if (d.level === 0) k.loft([{ c: head, w: 0.008, up: 0.006 }, { c: [head[0] + v[0] * 0.035, head[1] - 0.003, head[2] + v[2] * 0.035], w: 0, up: 0 }], { seg: 4, ref: [0, 1, 0], paint: S.bill, finish: { gloss: 0.5 } });
    const side: V3 = [v[2], 0, -v[0]];
    for (const x of [1, -1]) {
      k.card({ at: [at[0] + v[0] * 0.012, at[1] + 0.016, at[2] + v[2] * 0.012], dir: norm([side[0] * x, 0.45 + 0.25 * Math.sin(a * 2 + x), side[2] * x]), face: [0, 1, 0], len: 0.11, wid: 0.05, cell: CARD.primary, root: S.black, tip: S.buff, segs: 2, finish: { iri: 0.6, gloss: 0.4 } });
    }
  }
}

function starling(plan: BodyPlan, team: TeamColours, d: Detail): SculptedSpec {
  const H = plan.height;
  const hr = plan.head.radius;
  const A = starlingAnchors(plan);
  const s = A.s;
  const S = STARLING;
  const GLOSS = { tile: TILE.scales, size: 0.055, gloss: 0.55, iri: 0.6 } as const;
  const field = bodyField('starling', plan);
  const skin = skinFor('starling', plan, STARLING_SKIN, d.level, {
    // Green-glossed body, purple-glossed head and neck; a browner, speckled mantle reads apart from the head from behind.
    back: { paint: S.green, finish: GLOSS },
    mantle: { paint: mix(S.brown, S.green, 0.3), finish: { ...GLOSS, iri: 0.3 } },
    scapular: { paint: mix(S.brown, S.green, 0.5), finish: GLOSS },
    shoulder: { paint: S.green, finish: GLOSS },
    coverts: { paint: S.green, finish: GLOSS },
    breast: { paint: (p) => mix(S.purple, S.green, clamp01((1.12 * s - p.y) / (0.08 * s))), finish: GLOSS },
    belly: { paint: S.green, finish: GLOSS },
    thigh: { paint: S.black, finish: GLOSS },
    neck: { paint: S.purple, finish: GLOSS },
    crown: { paint: S.purple, finish: { ...GLOSS, size: 0.04 } },
    crest: { paint: S.purple, finish: { ...GLOSS, size: 0.04 } },
    nape: { paint: S.purple, finish: { ...GLOSS, size: 0.04 } },
    face: { paint: S.black, finish: { gloss: 0.5, iri: 0.6 } },
    cheek: { paint: S.black, finish: { gloss: 0.5, iri: 0.6 } },
    brow: { paint: S.purple, finish: { gloss: 0.5, iri: 0.6 } },
    throat: { paint: S.purple, finish: GLOSS },
    bill: { paint: S.billBase, finish: { gloss: 0.5 } },
    socket: { paint: S.black, finish: { gloss: 0.4 } },
  });
  const leg: LegStyle = {
    skin: S.leg, claw: S.claw, thick: A.legThick, thigh: S.black, fringe: 0.5, skinned: { r: 0.045 * s, at: 0.3 },
    toes: [{ yaw: -0.5, len: 0.065 * s }, { yaw: 0, len: 0.08 * s }, { yaw: 0.5, len: 0.065 * s }, { yaw: Math.PI, len: 0.045 * s }],
    clawLen: 0.022 * s,
  };
  const wing: WingStyle = {
    covert: S.green, secondary: S.black, primary: S.black, primaryTip: S.buff, trim: team.primary,
    thick: 0.026 * s, chord: 0.17 * s, primaries: 6, secondaries: 4, primaryLen: 0.5, secondaryLen: 0.8, cell: CARD.spotted, secondaryCell: CARD.spottedTail,
  };
  const SPECKLE = { gloss: 0.5, iri: 0.6 } as const;

  const body = (k: Sculpt): void => {
    const torso = field.only(...TRUNK).surface([0, 0.4 * s, -0.22 * s], [0, 1.06 * s, 0.04 * s], [0, 0, 1]);
    const collar = field.only(...TRUNK, 'neck').surface([0, 0.92 * s, 0.0], [0, A.head[1] - 0.06 * s, 0.02 * s], [0, 0, 1]);
    // The player-camera standard: purple-glossed hackles down the back of the neck onto the speckled mantle.
    hackles(k, collar, { t: [0.3, 0.75], rows: 2, cols: 4, len: 0.07 * s, wid: 0.05 * s, lift: 0.25, cell: CARD.spotted, paint: S.purple, finish: SPECKLE }, d);
    // Lanceolate throat hackles, pointed and lifted.
    shingle(k, collar, { t: [0.4, 0.85], a: [Math.PI * 0.2, Math.PI * 0.8], rows: 2, cols: 4, len: 0.07 * s, wid: 0.035 * s, cell: CARD.sickle, lift: 0.3, flow: -1, seed: 71, paint: S.purple, finish: SPECKLE }, d);
    // The speckled mantle and flanks: pale-tipped feathers in rows (the mantle reads lighter than the glossy head).
    speckled(k, torso, { t: [0.45, 0.9], a: [-Math.PI * 0.88, -Math.PI * 0.12], rows: 3, cols: 5, len: 0.085 * s, wid: 0.07 * s, root: mix(S.brown, S.green, 0.4), tip: S.buff, lift: 0.1, seed: 73 }, d);
    speckled(k, torso, { t: [0.3, 0.62], a: [Math.PI * 0.25, Math.PI * 0.75], rows: 2, cols: 4, len: 0.08 * s, wid: 0.06 * s, root: S.green, tip: mix(S.buff, 0xffffff, 0.3), lift: 0.12, seed: 79 }, d);
    // The ruff: spiky shoulder feathers sticking out over the wing roots, bristling on a cast.
    for (const side of [1, -1] as const) {
      shingle(k, torso, {
        t: [0.8, 0.94], a: side > 0 ? [-0.5, 0.45] : [Math.PI - 0.45, Math.PI + 0.5], rows: 2, cols: 3, len: 0.14 * s, wid: 0.05 * s, cell: CARD.sickle, lift: 0.7,
        toward: [side * 0.6, 0.4, -0.7], seed: side > 0 ? 83 : 89, paint: S.green, finish: SPECKLE,
        morph: (_t, _a, at, dir, n) => flare(at, dir, n, 0.6),
      }, d);
    }
    // Gear: a flock cravat with two tails, a bandolier of seed pellets, a satchel.
    band(k, collar, 0.45, { width: 0.055 * s, thick: 0.014 * s, hex: team.primary, stitch: team.light, off: 0.006 * s, finish: WEAVE }, d);
    if (d.level < 3) {
      const knot = collar.at(0.45, -Math.PI / 2, 0.02 * s);
      for (const x of [1, -1]) k.card({ at: [knot.p.x, knot.p.y, knot.p.z], dir: norm([x * 0.3, -1, -0.3]), face: [0, 0.2, -1], len: 0.22 * s, wid: 0.06 * s, cell: CARD.cloth, root: team.primary, tip: team.dark, curl: 0.3, sweep: x * 0.2, segs: d.level === 0 ? 4 : 2 });
    }
    if (d.level < 3) sash(k, torso, 0.55, 0.2, Math.PI * 0.35, { width: 0.04 * s, thick: 0.01 * s, hex: GEAR.leather, stitch: team.light, off: 0.01 * s, finish: LEATHER }, d);
    if (d.level < 1) {
      // Brass seed pellets along the bandolier.
      for (let i = 0; i < 5; i++) {
        const u = 0.18 + i * 0.07;
        const p = torso.at(0.55 + 0.2 * Math.cos(u * Math.PI * 2), Math.PI * 0.35 + u * Math.PI * 2, 0.022 * s);
        stud(k, [p.p.x, p.p.y, p.p.z], 0.011 * s);
      }
    }
    pouch(k, torso.at(0.35, Math.PI * 1.1, 0.006 * s), [0.08 * s, 0.08 * s, 0.05 * s], GEAR.leather, d);
  };

  const head = (k: Sculpt): void => {
    hackles(k, inBone(field.only('crown', 'nape', 'neck', 'crest').surface([A.head[0], A.head[1] - hr * 1.5, A.head[2] - hr * 0.1], [A.head[0], A.head[1] + hr * 0.9, A.head[2] - hr * 0.1], [0, 0, 1]), A.head), {
      t: [0.2, 0.5], rows: 2, cols: 4, len: 0.06 * s, wid: 0.045 * s, lift: 0.3, cell: CARD.contour, paint: S.purple, finish: SPECKLE, seed: 97,
    }, d);
    // The crest tuft: spiky feathers raised along the crown, standing up on a cast.
    if (d.level < 3) {
      const n = d.keep(5, 2);
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        const at: V3 = [(u - 0.5) * hr * 0.3, hr * (0.92 - 0.12 * u), hr * (0.1 - 0.6 * u)];
        k.card({ at, dir: norm([(u - 0.5) * 0.6, 0.7, -1]), face: [0, 1, 0.3], len: hr * (1.05 - 0.25 * u), wid: hr * 0.26, cell: CARD.sickle, root: S.purple, tip: S.black, curl: -0.2, segs: d.rows, finish: SPECKLE, morph: { display: hinge(at, [1, 0, 0], -0.5) } });
      }
    }
    const E = STARLING_HEAD.eye;
    for (const x of [1, -1]) eye(k, [x * hr * E[0], hr * E[1], hr * E[2]], [x * 0.78, 0.05, 0.62], { r: hr * 0.21, iris: S.iris, ring: S.black, lid: S.purple, ringW: hr * 0.035 }, d);
    // A long, sharp yellow bill, blue-grey at the base.
    const B = STARLING_HEAD.bill;
    beak(k, { at: [0, hr * B[1], hr * (B[2] - 0.04)], len: hr * 1.45, w: hr * 0.2, up: hr * 0.16, dn: hr * 0.12, curve: hr * 0.04, hook: 0, base: S.billBase, tip: S.bill, bands: [[0, S.billBase], [0.18, S.bill]], open: 0.4 }, d);
  };

  const tail = (k: Sculpt): void => {
    // Short and square.
    tailFan(k, { count: 8, len: 0.17 * s, wid: 0.05 * s, spread: 0.55, droop: 0.65, root: S.black, tip: S.buff, cell: CARD.spottedTail, finish: SPECKLE }, d);
  };

  return {
    body, head, tail, skin,
    halo: (k) => starlingHalo(k, Math.max(plan.radius * 1.7, hr * 3.2), hr, d),
    wing: wingsOf(wing, d),
    leg: legsOf(leg, d),
    gun: starlingGun(s, d),
    pivot: { wingL: A.wing, wingR: flipX(A.wing), legL: A.hip, legR: flipX(A.hip), tail: A.tail },
    legLen: A.legLen, legThick: leg.thick, wingLen: H * 0.36,
    // Murmuration, Mob, Scatter, Black Sun.
    casts: ['throw', 'throw', 'leap', 'raise'],
    sway: 0, castTail: -0.5,
  };
}

/** Chatter Pistol: twin brass barrels, a glass jar of glowing specks in a brass cage, a music-box key, a lacquered grip. */
function starlingGun(s: number, d: Detail): SculptedSpec['gun'] {
  const S = STARLING;
  const L = 0.5 * s;
  const r = 0.009 * s;
  return {
    main: [0, -0.05 * s, -L * 0.66],
    support: [0, -0.022 * s, 0],
    slideAt: [0, -0.006 * s, -L * 0.3],
    travel: 0.025 * s,
    build(k, part) {
      if (part === 'slide') {
        if (d.level >= 3) return;
        lathe(k, [[r * 2.4, 0.04 * s], [r * 3, 0.03 * s], [r * 3, -0.03 * s], [r * 2.4, -0.04 * s]], { seg: d.n(10, 4), paint: S.lacquer, finish: { ...WOOD, iri: 0.5 }, flat: 0.8 });
        return;
      }
      if (part !== 'gun') return;
      if (d.level >= 3) {
        lathe(k, [[0.02 * s, 0], [0.02 * s, -L * 0.5], [0.03 * s, -L * 0.62], [0.02 * s, -L]], { seg: 4, paint: S.lacquer });
        return;
      }
      // Twin barrels side by side, each with a violet glow at the mouth.
      for (const x of [1, -1]) {
        lathe(k, [[r * 1.4, 0], [r * 1.1, -0.015 * s], [r, -L * 0.45], [r * 1.2, -L * 0.5]], { at: [x * r * 1.3, 0, 0], seg: d.n(10, 4), paint: (t) => (t < 0.06 || Math.abs(t - 0.5) < 0.05 ? GEAR.brass : GEAR.brassDark), finish: BRASS });
        bead(k, [x * r * 1.3, 0, -0.002 * s], r * 0.85, S.glow, 0.9, d);
      }
      // The jar: dark glass in a brass cage, specks of the swarm glowing round it (the signature chamber).
      const jz = -L * 0.56;
      bead(k, [0, 0.012 * s, jz], 0.03 * s, 0x241830, 0.15, d);
      ring(k, [0, 0.012 * s, jz], 0.031 * s, 0.003 * s, d, GEAR.brass, undefined, [0, Math.PI / 2, 0]);
      ring(k, [0, 0.012 * s, jz], 0.031 * s, 0.003 * s, d, GEAR.brass, undefined, [Math.PI / 2, 0, 0]);
      if (d.level < 1) for (let i = 0; i < 6; i++) speck(k, [Math.sin(i * 2.4) * 0.032 * s, 0.012 * s + Math.cos(i * 1.7) * 0.026 * s, jz + Math.cos(i * 2.4) * 0.03 * s], 0.005 * s, S.glow, 0.95);
      // The music-box key on the left: wind it and it chatters.
      if (d.level < 2) {
        block(k, [0.03 * s, 0.006 * s, 0.006 * s], [0.03 * s, 0.012 * s, jz], GEAR.brass, BRASS, d);
        ring(k, [0.05 * s, 0.012 * s, jz], 0.012 * s, 0.0035 * s, d, GEAR.brass, undefined, [0, Math.PI / 2, 0]);
      }
      block(k, [0.03 * s, 0.04 * s, 0.09 * s], [0, -0.006 * s, -L * 0.66], S.lacquer, { ...WOOD, iri: 0.5 }, d);
      carve(k, [[-L * 0.62, -0.02 * s], [-L * 0.69, -0.02 * s], [-L * 0.77, -0.1 * s], [-L * 0.69, -0.104 * s]], 0.024 * s, S.lacquer, { ...WOOD, iri: 0.5 }, d);
      // A short scrolled stock with a feather fan at the butt.
      carve(k, [[-L * 0.72, 0.012 * s], [-L * 0.94, 0.02 * s], [-L, -0.02 * s], [-L * 0.96, -0.05 * s], [-L * 0.76, -0.03 * s]], 0.022 * s, S.lacquer, { ...WOOD, iri: 0.5 }, d);
      if (d.level < 2) for (const u of [-1, 0, 1]) plume(k, [0, 0.0, -L], [u * 0.5, 0.4, -1], 0.06 * s, 0.022 * s, S.black, CARD.spotted, [0, 1, 0], S.buff);
    },
  };
}

export const C_BUILDS: Readonly<Record<string, SculptedBird>> = { owl, pelican, penguin, puffin, secretarybird, starling };
