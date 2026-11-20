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
import { bodyField, flipX, OWL_HEAD, owlAnchors, skinFor, TRUNK } from './bodies';
import { SKIN as OWL_SKIN } from './data/skins/owl';
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

export const C_BUILDS: Readonly<Record<string, SculptedBird>> = { owl };
