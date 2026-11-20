/* eslint-disable @typescript-eslint/no-magic-numbers -- authored birds: the numbers are the sculpture */
/**
 * Batch A3 birds, sculpted to the style guide (§8; GDD §9.13 to §9.16): Peacock, Vulture, Swift and Hummingbird.
 * Every size comes from the BodyPlan at runtime (head about the head hitbox centre, body inside the capsule, the gun's
 * tip at the muzzle); only fractions and authored offsets are written here.
 */
import { Matrix4, Vector3 } from 'three';
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import type { TeamColours } from '../palette';
import { beak, eye, flare, foldedWings, hackles, inBone, legsOf, norm, shingle, tailFan, wingsOf } from './anatomy';
import type { LegStyle, WingStyle } from './anatomy';
import { bodyField, flipX, PEACOCK_HEAD, peacockAnchors, skinFor, SWIFT_HEAD, swiftAnchors, TRUNK, VULTURE_HEAD, vultureAnchors, HUMMINGBIRD_HEAD, hummingbirdAnchors } from './bodies';
import { SKIN as SWIFT_SKIN } from './data/skins/swift';
import { SKIN as PEACOCK_SKIN } from './data/skins/peacock';
import { SKIN as VULTURE_SKIN } from './data/skins/vulture';
import { SKIN as HUMMINGBIRD_SKIN } from './data/skins/hummingbird';
import { CARD, TILE } from './feathers';
import { band, bead, block, BRASS, buckle, carve, GEAR, LEATHER, lathe, plume, pouch, ring, sash, stud, WOOD } from './gear';
import type { Detail, SculptedSpec } from './sculpted';
import { hinge, jitter, mix, shade } from './sculpt';
import type { Sculpt, V3 } from './sculpt';



/** A card's display pose: root, direction and face at rest mapped to the same in the display. */
function repose(at: V3, dir: V3, face: V3, at2: V3, dir2: V3, face2: V3): Matrix4 {
  const basis = (d: V3, f: V3): Matrix4 => {
    const y = new Vector3(...d).normalize();
    const z = new Vector3(...f);
    z.addScaledVector(y, -z.dot(y)).normalize();
    const x = new Vector3().crossVectors(y, z);
    return new Matrix4().makeBasis(x, y, z);
  };
  const r = basis(dir2, face2).multiply(basis(dir, face).transpose());
  return new Matrix4().makeTranslation(at2[0], at2[1], at2[2]).multiply(r).multiply(new Matrix4().makeTranslation(-at[0], -at[1], -at[2]));
}

// =================================================================================================================
// Peacock: a long iridescent blue neck rising into a small crested head with white face stripes, a bronze-green
// scaled back, barred buff wings with chestnut flights, and a train of eyed feathers in tiers that trails on the
// ground and fans into a 3 m disc whenever it casts. Spirit burst: an ornate dart caster with a glowing eye chamber.

const PEACOCK = {
  blue: 0x1d63d0,
  blueDeep: 0x123a8c,
  teal: 0x1aa0a8,
  green: 0x2c9a52,
  bronze: 0x7f8a34,
  belly: 0x22303a,
  buff: 0xc2a670,
  bar: 0x5a4628,
  chestnut: 0xb0602a,
  white: 0xf6f4ee,
  bill: 0xd8c49c,
  billTip: 0x8c7a58,
  leg: 0x9a8e7e,
  claw: 0x2a2522,
  iris: 0x4a2a16,
  crest: 0x1e7fa8,
  train: 0x2fae5a,
  trainRoot: 0x6f8a2a,
  tail: 0x6b5030,
  lacquer: 0x1f5a6e,
  chamber: 0x3ad6c8,
} as const;

export function peacock(plan: BodyPlan, team: TeamColours, d: Detail): SculptedSpec {
  const H = plan.height;
  const hr = plan.head.radius;
  const A = peacockAnchors(plan);
  const s = A.s;
  const legLen = A.legLen;
  const bodyY = 0.79 * s;
  const tailPivot = A.tail;
  const P = PEACOCK;
  const BLUE = { tile: 1, size: 0.1, iri: -1, gloss: 0.35 } as const;
  const BRONZE = { tile: 1, size: 0.11, iri: 0.5, gloss: 0.3 } as const;
  const field = bodyField('peacock', plan);
  // Up the neck, from where it leaves the breast to under the head.
  const neckAxis: [V3, V3] = [[0, bodyY + 0.02 * s, 0.13 * s], [0, A.head[1] - 0.04 * s, -0.03 * s]];
  const skin = skinFor('peacock', plan, PEACOCK_SKIN, d.level, {
    back: { paint: (p) => shade(mix(P.bronze, P.green, Math.min(1, Math.max(0, (p.y - bodyY) / (0.2 * s) + 0.4))), 0.85), finish: BRONZE },
    mantle: { paint: shade(mix(P.bronze, P.green, 0.5), 0.78), finish: BRONZE },
    scapular: { paint: (p) => mix(P.buff, P.bar, Math.min(0.6, Math.max(0, (bodyY + 0.16 * s - p.y) / (0.12 * s)))), finish: { tile: 1, size: 0.07, gloss: 0.2 } },
    shoulder: { paint: P.buff, finish: { tile: 1, size: 0.08 } },
    coverts: { paint: mix(P.green, P.teal, 0.3), finish: { ...BRONZE, iri: -0.8 } },
    // The breast lightest down the keel, deepening to the sides and under toward the belly.
    breast: { paint: (p) => mix(P.blue, P.blueDeep, Math.min(1, Math.max(0, (bodyY - p.y) / (0.25 * s) + Math.abs(p.x) / (0.3 * s)))), finish: BLUE },
    belly: { paint: P.belly, finish: { tile: 1, size: 0.09, gloss: 0.2 } },
    thigh: { paint: shade(P.belly, 1.15), finish: { tile: 1, size: 0.07 } },
    // The neck brightest at the throat, deeper round the back and toward the base.
    neck: { paint: (p) => mix(P.blue, P.blueDeep, Math.min(0.8, Math.max(0, 0.15 - p.z / (0.25 * s) + (1.2 * s - p.y) / (0.8 * s)))), finish: BLUE },
    // The head a deeper teal than the neck, so it separates from it from behind.
    crown: { paint: mix(P.blue, P.teal, 0.3), finish: BLUE },
    // The face smooth (tiny feathers), the crown, nape and neck scaled.
    face: { paint: P.blue, finish: { ...BLUE, tile: 0 } },
    cheek: { paint: P.blue, finish: { ...BLUE, tile: 0 } },
    brow: { paint: P.blueDeep, finish: { ...BLUE, tile: 0 } },
    nape: { paint: mix(P.blueDeep, P.teal, 0.25), finish: BLUE },
    throat: { paint: P.blueDeep, finish: BLUE },
    bill: { paint: P.bill, finish: { gloss: 0.5 } },
    socket: { paint: P.white, finish: { gloss: 0.2 } },
    stripe: { paint: P.white, finish: { gloss: 0.15 } },
  });

  const leg: LegStyle = {
    skin: P.leg, claw: P.claw, thick: 0.027 * s, thigh: 0x3a4030, fringe: 0.5,
    toes: [{ yaw: -0.5, len: 0.11 * s }, { yaw: 0, len: 0.13 * s }, { yaw: 0.5, len: 0.11 * s }, { yaw: Math.PI, len: 0.055 * s }],
    clawLen: 0.035 * s,
  };
  const wing: WingStyle = {
    covert: P.buff, secondary: 0x46603a, primary: P.chestnut, primaryTip: shade(P.chestnut, 0.75), trim: team.primary,
    thick: 0.032 * s, chord: 0.28 * s, primaries: 7, secondaries: 5, primaryLen: 0.62, secondaryLen: 0.4,
  };

  const body = (k: Sculpt): void => {
    // The body is the baked implicit skin (bodies.ts); gear and feathers sit on its surface.
    const torso = field.only(...TRUNK).surface([0, bodyY + 0.02 * s, -0.46 * s], [0, bodyY + 0.22 * s, 0.3 * s]);
    // The player-camera standard (D-ART-011): a bronze-green cape of scalloped feathers where the blue neck meets the
    // mantle, and the wings folded down the flanks.
    hackles(k, field.only('neck', 'back', 'mantle').surface(...neckAxis, [0, 0, 1]), {
      t: [0.04, 0.2], a: [-Math.PI * 0.95, -Math.PI * 0.05], rows: 2, cols: 6, len: 0.13 * s, wid: 0.1 * s, lift: 0.1,
      paint: (t) => mix(P.bronze, P.green, 0.35 + 0.5 * t), finish: BRONZE,
    }, d);
    foldedWings(k, torso, wing, { t: [0.35, 0.72], a: 0.4, len: 0.34 * s, wid: 0.11 * s }, d);
    // Gear: a flock-colour silk sash over the left shoulder and across the back with a brass buckle, a silk collar
    // with ribbon tails down the back, and a dart satchel on the right hip.
    sash(k, torso, 0.56, 0.3, Math.PI * 0.3, { width: 0.1 * s, thick: 0.014 * s, hex: team.primary, stitch: team.light, finish: { gloss: 0.4 } }, d);
    buckle(k, torso.at(0.84, Math.PI * 0.15, 0.02 * s), 0.06 * s, d);
    pouch(k, torso.at(0.45, Math.PI * 1.08, 0), [0.1 * s, 0.13 * s, 0.06 * s], GEAR.leather, d);
    if (d.level < 2) for (let i = 0; i < 3; i++) plume(k, [-0.27 * s - i * 0.012 * s, bodyY + 0.03 * s, -0.04 * s + i * 0.025 * s], [0.1, 1, -0.2], 0.09 * s, 0.03 * s, P.blue, CARD.primary, [-1, 0, 0]);
  };

  const head = (k: Sculpt): void => {
    // The head is part of the skin; the eyes sit in its sockets and the bill grows from its base.
    // Hackles: iridescent feathers down the back of the upper neck from under the crest, carried by the head.
    hackles(k, inBone(field.only('neck', 'nape', 'crown').surface(...neckAxis, [0, 0, 1]), A.head), {
      t: [0.62, 0.94], a: [-Math.PI * 0.8, -Math.PI * 0.2], rows: 3, cols: 4, len: 0.1 * s, wid: 0.075 * s, lift: 0.16,
      paint: (t) => mix(P.blueDeep, P.teal, 0.2 + 0.5 * t), finish: { ...BLUE, tile: 0 }, seed: 23,
    }, d);
    const E = PEACOCK_HEAD.eye;
    for (const x of [1, -1]) eye(k, [x * hr * E[0], hr * E[1], hr * E[2]], [x * 0.8, 0.05, 0.6], { r: hr * 0.25, iris: P.iris, ring: P.white, lid: P.blueDeep, ringW: hr * 0.04 }, d);
    const B = PEACOCK_HEAD.bill;
    beak(k, { at: [0, hr * B[1], hr * (B[2] - 0.04)], len: hr * 1.0, w: hr * 0.26, up: hr * 0.25, dn: hr * 0.17, curve: hr * 0.1, hook: hr * 0.06, base: P.bill, tip: P.billTip, open: 0.32 }, d);
    // The crown: five spoon-tipped crest feathers on bare shafts, spreading on the display.
    const n = d.level >= 3 ? 0 : 5;
    const crestLen = 0.2 * s;
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * 2 - 1;
      const at: V3 = [u * hr * 0.14, hr * 0.92, -hr * 0.1];
      const dir = norm([u * 0.34, 1, -0.22 + 0.05 * Math.abs(u)]);
      const morph = { display: hinge(at, [0, 0, 1], -u * 0.3) };
      k.card({ at, dir, face: [0, 0.15, 1], len: crestLen, wid: 0.06 * s, cell: CARD.spoon, root: 0xd8e0e4, tip: P.crest, segs: d.level === 0 ? 7 : d.level === 3 ? 2 : 4, finish: { iri: -1, gloss: 0.4 }, morph });
    }
  };

  // The train: tiers of eyed feathers trail behind to the ground, so eyes show along its whole length; on the
  // display each swings up into its place in a concave disc behind the bird, eyes to the front. Under it, the stiff
  // brown tail that props the display.
  const tail = (k: Sculpt): void => {
    const drop = tailPivot[1] - 0.025 * s;
    const tiers: [number, number][] = d.level === 0 ? [[10, 1.5], [9, 1.2], [8, 0.92], [6, 0.66], [4, 0.42]] : d.level === 1 ? [[7, 1.48], [6, 1.1], [5, 0.75]] : d.level === 2 ? [[6, 1.45], [4, 0.95]] : [[4, 1.4]];
    tiers.forEach(([count, length], tier) => {
      const L = length * s;
      for (let i = 0; i < count; i++) {
        const u = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
        const j = tier * 31 + i;
        const at: V3 = [u * 0.1 * s, 0.014 * s * tier, -0.025 * s * tier];
        const fall = Math.asin(Math.min(0.95, (drop + at[1]) / Math.max(L * 0.82, drop * 1.06)));
        const yaw = u * (0.18 - tier * 0.015) + (jitter(j, 2) - 0.5) * 0.04;
        const dir = norm([Math.sin(yaw), -Math.tan(fall) * 1.12, -Math.cos(yaw)]);
        const face = norm([Math.sin(u * 0.9) * 0.7, Math.cos(fall), -Math.sin(fall) * 0.4]);
        const phi = u * (1.72 - tier * 0.1) + (jitter(j, 4) - 0.5) * 0.06;
        const dir2 = norm([Math.sin(phi), Math.cos(phi), -0.12]);
        const at2: V3 = [Math.sin(phi) * 0.03 * s, 0.05 * s + tier * 0.012 * s, -0.05 * s + tier * 0.03 * s];
        k.card({
          at, dir, face, len: L * (0.95 + 0.1 * jitter(j, 6)), wid: 0.2 * s * (d.level === 0 ? 1 : 1.2), cell: CARD.eye,
          root: P.trainRoot, tip: 0xffffff, curl: 0.5, segs: d.level === 0 ? 5 : d.rows, finish: { iri: -0.8, gloss: 0.35 },
          morph: { display: repose(at, dir, face, at2, dir2, [0, 0.15, 1]) },
        });
      }
    });
    if (d.level < 3) tailFan(k, {
      count: 8, len: 0.62 * s, wid: 0.08 * s, spread: 1.0, droop: 0.65, root: shade(P.tail, 0.85), tip: P.tail, cell: CARD.tail,
      at: [0, -0.03 * s, 0.02 * s],
      display: (u, at) => repose(at, norm([Math.sin(Math.PI + u * 0.5), -Math.sin(0.65), Math.cos(Math.PI + u * 0.5)]), [0, 1, 0], at, norm([u * 0.9, 1, -0.5]), [0, 0.2, 1]),
    }, d);
  };

  return {
    body, head, tail, skin,
    wing: wingsOf(wing, d),
    leg: (k, seg, side, upper, lower, ankle) => {
      // The feathered thigh is the skin's; the leg starts at the bare shin.
      if (seg === 'thigh') return;
      legsOf(leg, d)(k, seg, side, upper, lower, ankle);
      // The spur on the back of the tarsus.
      if (seg === 'shin' && d.level < 2) k.loft([{ c: [0, -upper * 0.62, -leg.thick * 0.7], w: leg.thick * 0.35, up: leg.thick * 0.35 }, { c: [0, -upper * 0.66, -leg.thick * 2.4], w: 0, up: 0 }], { seg: 6, ref: [0, 1, 0], paint: P.claw, finish: { gloss: 0.8 } });
    },
    gun: peacockGun(s, d),
    pivot: { wingL: A.wing, wingR: flipX(A.wing), legL: A.hip, legR: flipX(A.hip), tail: tailPivot },
    legLen, legThick: leg.thick, wingLen: H * 0.36,
    // Hundred Eyes, Dazzle, Strut, Full Display.
    casts: ['throw', 'sweep', 'stomp', 'raise'],
    sway: 0.04, castTail: 0, castWiden: 0,
  };
}

/** Plume Darts: a slender lacquered dart caster, brass filigree bands, an eye chamber that glows, a fan-carved stock. */
function peacockGun(s: number, d: Detail): SculptedSpec['gun'] {
  const P = PEACOCK;
  const L = 0.62 * s;
  const r = 0.014 * s;
  const grip: V3 = [0, -0.055 * s, -L * 0.74];
  const slideAt: V3 = [0, -0.002 * s, -L * 0.33];
  return {
    main: grip,
    support: [0, -0.024 * s, 0],
    slideAt,
    travel: 0.03 * s,
    build(k, part) {
      if (part === 'slide') {
        if (d.level >= 3) return;
        lathe(k, [[r * 1.25, 0.045 * s], [r * 1.75, 0.035 * s], [r * 1.8, -0.035 * s], [r * 1.25, -0.045 * s]], { seg: d.n(12, 5), paint: P.lacquer, finish: { ...WOOD, iri: 0.4 } });
        if (d.level < 2) ring(k, [0, 0, 0.03 * s], r * 1.7, r * 0.22, d);
        return;
      }
      if (part !== 'gun') return;
      if (d.level >= 3) {
        lathe(k, [[r * 2, 0], [r * 1.2, -L * 0.5], [0.025 * s, -L * 0.7], [0.02 * s, -L]], { seg: 4, paint: P.lacquer });
        return;
      }
      // Muzzle crown with its glowing bead, the barrel and its bands.
      lathe(k, [[r * 1.9, 0], [r * 2.2, -0.012 * s], [r * 1.5, -0.03 * s], [r * 1.25, -0.04 * s]], { seg: d.n(12, 4), paint: GEAR.brass, finish: BRASS });
      bead(k, [0, 0, -0.006 * s], r * 1.15, P.chamber, 0.9, d);
      lathe(k, [[r * 1.05, -0.035 * s], [r, -L * 0.2], [r * 1.1, -L * 0.45], [r * 1.35, -L * 0.56]], { seg: d.n(12, 5), paint: P.lacquer, finish: { ...WOOD, iri: 0.5 } });
      for (const z of [0.14, 0.26, 0.44]) ring(k, [0, 0, -L * z], r * 1.12, r * 0.28, d);
      // The eye chamber: a glass sphere, teal with a gold ring, caged in brass.
      const cz = -L * 0.6;
      bead(k, [0, 0.006 * s, cz], 0.03 * s, P.chamber, 0.75, d);
      bead(k, [0, 0.006 * s, cz + 0.026 * s], 0.012 * s, 0x14206a, 0.2, d, [1, 1, 0.35]);
      ring(k, [0, 0.006 * s, cz], 0.032 * s, 0.004 * s, d, GEAR.brass, undefined, [0, Math.PI / 2, 0]);
      ring(k, [0, 0.006 * s, cz], 0.032 * s, 0.004 * s, d, GEAR.brass, undefined, [Math.PI / 2, 0, 0]);
      // Receiver block with a brass inlay, the pistol grip and a fan-carved stock.
      block(k, [0.034 * s, 0.05 * s, 0.1 * s], [0, -0.004 * s, -L * 0.72], P.lacquer, WOOD, d);
      carve(k, [[-L * 0.69, -0.02 * s], [-L * 0.75, -0.02 * s], [-L * 0.8, -0.1 * s], [-L * 0.73, -0.105 * s]], 0.026 * s, GEAR.woodDark, WOOD, d);
      carve(k, [[-L * 0.78, 0.012 * s], [-L, 0.045 * s], [-L * 1.04, -0.01 * s], [-L, -0.06 * s], [-L * 0.8, -0.03 * s]], 0.03 * s, P.lacquer, { ...WOOD, iri: 0.4 }, d);
      if (d.level < 2) {
        // Three small eyed plumes at the butt and a quiver clip of darts along the left of the barrel (the ammo).
        for (const u of [-1, 0, 1]) plume(k, [0, 0.02 * s, -L * 1.0], [u * 0.6, 0.9, -0.5], 0.07 * s, 0.035 * s, 0xffffff, CARD.eye, [0, 0, 1]);
        for (let i = 0; i < 5; i++) {
          const z = -L * (0.2 + i * 0.065);
          lathe(k, [[0.0028 * s, z + 0.06 * s], [0.0028 * s, z - 0.03 * s]], { at: [0.024 * s, 0.006 * s, 0], seg: 4, paint: GEAR.bone, finish: { gloss: 0.4 } });
          plume(k, [0.024 * s, 0.006 * s, z - 0.03 * s], [0, 0, -1], 0.025 * s, 0.012 * s, P.blue, CARD.primary, [0, 1, 0]);
        }
        block(k, [0.01 * s, 0.018 * s, 0.2 * s], [0.022 * s, 0.006 * s, -L * 0.33], GEAR.brassDark, BRASS, d);
      }
    },
  };
}

// =================================================================================================================
// Vulture: a hunched hump of dark plumage with the head held low in front of it, bald red-pink head on a short bare
// neck, a fluffy white ruff like a collar, and the broad wings worn as a ragged coat that flares open on a cast. Area
// control: a bone-built rifle with barbs and bone plates.

const VULTURE = {
  brown: 0x553f31,
  black: 0x2c2520,
  edge: 0x6b5644,
  ruff: 0xf1ece2,
  ruffShade: 0xc9c1b2,
  skin: 0xd8857a,
  skinDark: 0xa4504a,
  skinPale: 0xe6a89a,
  caruncle: 0xc8424a,
  mask: 0x4a2a2c,
  cere: 0x5f6c78,
  bill: 0xd8ccb0,
  hook: 0x3a3634,
  leg: 0x9f9488,
  claw: 0x2b2522,
  iris: 0x6a4420,
  bone: 0xe3d7bd,
  boneDark: 0xa8977a,
  sickly: 0xc8e05a,
} as const;

export function vulture(plan: BodyPlan, team: TeamColours, d: Detail): SculptedSpec {
  const H = plan.height;
  const hr = plan.head.radius;
  const A = vultureAnchors(plan);
  const s = A.s;
  const V = VULTURE;
  const legLen = A.legLen;
  const PLUME = { tile: TILE.scales, size: 0.12, gloss: 0.12 } as const;
  // Bare skin, pebbled and wrinkled up close; the ruff is down (the hair surface).
  const BARE = { tile: TILE.leather, size: 0.045, gloss: 0.3 } as const;
  const DOWN = { tile: TILE.wood, size: 0.05 } as const;
  const clamp = (v: number): number => Math.min(1, Math.max(0, v));
  const field = bodyField('vulture', plan);
  const skin = skinFor('vulture', plan, VULTURE_SKIN, d.level, {
    // Dark brown above, near black below, each feather edged paler over the hump.
    back: { paint: (p) => mix(V.black, V.brown, clamp((p.y - 0.85 * s) / (0.6 * s))), finish: PLUME },
    mantle: { paint: mix(V.brown, V.edge, 0.3), finish: PLUME },
    scapular: { paint: (p) => mix(V.brown, V.edge, clamp((p.y - 1.55 * s) / (0.2 * s)) * 0.6), finish: PLUME },
    shoulder: { paint: V.brown, finish: PLUME },
    coverts: { paint: V.black, finish: PLUME },
    breast: { paint: (p) => mix(V.black, V.brown, 0.25 + 0.35 * clamp((p.y - 1.0 * s) / (0.35 * s))), finish: { ...PLUME, size: 0.1 } },
    belly: { paint: V.black, finish: PLUME },
    thigh: { paint: mix(V.brown, V.black, 0.35), finish: { ...PLUME, size: 0.08 } },
    // The ruff: cream down, shaded where it tucks under.
    ruff: { paint: (p) => mix(V.ruffShade, V.ruff, clamp((p.y - 1.4 * s) / (0.1 * s))), finish: DOWN },
    // The bare neck darkest low in the ruff, reddening up to the head; its folds deeper still.
    neck: { paint: (p) => mix(V.skinDark, V.skin, clamp((p.y - 1.45 * s) / (0.25 * s)) * 0.7), finish: BARE },
    folds: { paint: shade(V.skinDark, 0.9), finish: BARE },
    // The head: pale pink on the crown, red over the face and throat, the caruncles redder and glossy.
    crown: { paint: V.skinPale, finish: BARE },
    nape: { paint: (p) => mix(V.skinDark, V.skin, clamp((p.y - A.head[1] + 0.12 * s) / (0.12 * s))), finish: BARE },
    face: { paint: V.skin, finish: BARE },
    cheek: { paint: mix(V.skin, V.skinDark, 0.3), finish: BARE },
    brow: { paint: V.skinDark, finish: BARE },
    throat: { paint: V.skinDark, finish: BARE },
    caruncle: { paint: V.caruncle, finish: { ...BARE, gloss: 0.45 } },
    mask: { paint: V.mask, finish: { gloss: 0.3 } },
    bill: { paint: V.cere, finish: { gloss: 0.4 } },
    socket: { paint: V.mask, finish: { gloss: 0.3 } },
  });
  const leg: LegStyle = {
    skin: V.leg, claw: V.claw, thick: A.legThick, thigh: V.brown, fringe: 0.55, fringeCell: CARD.ragged, skinned: { r: 0.085 * s, at: 0.25 },
    toes: [{ yaw: -0.45, len: 0.12 * s }, { yaw: 0, len: 0.14 * s }, { yaw: 0.45, len: 0.12 * s }, { yaw: Math.PI, len: 0.06 * s }],
    clawLen: 0.04 * s,
  };
  const wing: WingStyle = {
    covert: V.brown, secondary: V.black, primary: V.black, primaryTip: shade(V.black, 0.8), trim: team.primary,
    thick: 0.044 * s, chord: 0.4 * s, primaries: 8, secondaries: 9, primaryLen: 0.7, cell: CARD.ragged, secondaryCell: CARD.ragged,
    secondaryLen: 1.9, secondaryFlare: 0.9, displayFlare: 0.5,
  };
  const ruffAt: V3 = [0, 1.48 * s, -0.13 * s];

  const body = (k: Sculpt): void => {
    // The body is the baked implicit skin (bodies.ts); feathers and gear sit on its surface. Upright: up the trunk
    // from under the belly to between the shoulders, a = π/2 in front and −π/2 behind.
    const torso = field.only(...TRUNK).surface([0, 0.72 * s, -0.2 * s], [0, 1.66 * s, -0.16 * s], [0, 0, 1]);
    // The ruff's outline: down tufts round the collar that puff out on the display.
    if (d.level < 3) {
      const tufts = d.keep(12, 5);
      for (let row = 0; row < 1; row++) {
        for (let i = 0; i < tufts; i++) {
          const a = (i / tufts) * Math.PI * 2 + row * 0.26;
          const n: V3 = [Math.sin(a), 0.3, Math.cos(a)];
          const at: V3 = [ruffAt[0] + Math.sin(a) * 0.23 * s, ruffAt[1] + (row * 0.06 - 0.02) * s, ruffAt[2] + Math.cos(a) * 0.23 * s];
          const dir = norm([Math.sin(a), -0.15 + row * 0.45, Math.cos(a)]);
          k.card({ at, dir, face: n, len: 0.12 * s, wid: 0.1 * s * Math.sqrt(12 / tufts), cell: CARD.down, root: V.ruffShade, tip: shade(V.ruff, 0.97), curl: -0.4, segs: d.rows, cup: 0.1, morph: flare(at, dir, [0, 1, 0], 0.5) });
        }
      }
    }
    // The coat from behind: ragged scapulars over the hump and long ragged feathers hanging down the back, lifting on
    // the display; the folded wings' secondaries down the flanks under the shoulders.
    shingle(k, torso, {
      t: [0.42, 0.8], a: [-Math.PI * 0.92, -Math.PI * 0.08], rows: 3, cols: 5, len: 0.36 * s, wid: 0.2 * s, cell: CARD.ragged,
      toward: [0, -1, -0.25], lift: 0.1, seed: 9,
      paint: (t, a) => mix(V.black, mix(V.brown, V.edge, 0.4 * t), 0.4 + 0.45 * jitter(Math.round(a * 10), 3)),
      morph: (_t, _a, at, dir, n) => flare(at, dir, n, 0.45), finish: { gloss: 0.1 },
    }, d);
    foldedWings(k, torso, wing, { t: [0.38, 0.7], a: -0.45, len: 0.42 * s, wid: 0.15 * s }, d);
    // Gear: a bandolier of bone shells and a flock-colour sash crossing over the coat, and a satchel on the hip.
    const over = 0.06 * s;
    sash(k, torso, 0.56, 0.24, Math.PI * 0.65, { width: 0.07 * s, thick: 0.014 * s, hex: GEAR.leatherDark, off: over, finish: LEATHER }, d);
    sash(k, torso, 0.6, 0.22, Math.PI * 0.35, { width: 0.08 * s, thick: 0.014 * s, hex: team.primary, stitch: team.light, off: over, finish: { gloss: 0.3 } }, d);
    if (d.level < 2) {
      for (let i = 0; i < 7; i++) {
        const u = 0.06 + i * 0.05;
        const p = torso.at(0.56 + 0.24 * Math.cos(u * Math.PI * 2), Math.PI * 0.65 + u * Math.PI * 2, over + 0.026 * s);
        lathe(k, [[0.012 * s, 0.025 * s], [0.014 * s, 0], [0.012 * s, -0.025 * s]], { at: [p.p.x, p.p.y, p.p.z], rot: [0.3, 0, 0], seg: 6, paint: V.bone, finish: { gloss: 0.4 } });
      }
    }
    pouch(k, torso.at(0.36, Math.PI * 1.15, 0), [0.13 * s, 0.15 * s, 0.07 * s], GEAR.leather, d);
  };

  const head = (k: Sculpt): void => {
    // The bald head, its caruncles, brow and folded neck are the skin's; the eyes sit in its sockets and the hooked
    // bill grows from the cere. A few wisps of down cling behind the crown.
    const E = VULTURE_HEAD.eye;
    for (const x of [1, -1]) eye(k, [x * hr * E[0], hr * E[1], hr * E[2]], [x * 0.72, 0.06, 0.69], { r: hr * 0.22, iris: V.iris, ring: V.mask, lid: V.skinDark, ringW: hr * 0.05 }, d);
    const B = VULTURE_HEAD.bill;
    beak(k, {
      at: [0, hr * B[1], hr * (B[2] - 0.04)], len: hr * 1.5, w: hr * 0.32, up: hr * 0.46, dn: hr * 0.24, curve: hr * 0.24, hook: hr * 0.28,
      base: V.cere, tip: V.hook, bands: [[0, V.cere], [0.3, V.bill], [0.84, V.hook]], open: 0.34,
    }, d);
    if (d.level < 2) {
      for (const u of [-1, 0, 1]) {
        k.card({ at: [u * hr * 0.3, hr * 0.62, -hr * 0.8], dir: norm([u * 0.4, 0.5, -1]), face: [0, 1, -0.3], len: 0.06 * s, wid: 0.05 * s, cell: CARD.down, root: V.ruffShade, tip: V.ruff, curl: -0.4, segs: 2 });
      }
    }
  };

  const tail = (k: Sculpt): void => {
    tailFan(k, { count: 12, len: 0.42 * s, wid: 0.1 * s, spread: 1.1, droop: 0.55, root: V.black, tip: shade(V.black, 1.2), cell: CARD.ragged }, d);
  };

  return {
    body, head, tail, skin,
    wing: wingsOf(wing, d),
    leg: legsOf(leg, d),
    gun: vultureGun(s, d),
    pivot: { wingL: A.wing, wingR: flipX(A.wing), legL: A.hip, legR: flipX(A.hip), tail: A.tail },
    legLen, legThick: leg.thick, wingLen: H * 0.38,
    // Carrion Circle, Pick the Bones, Thermal, Death Spiral.
    casts: ['raise', 'sweep', 'throw', 'raise'],
    sway: 0.06, castTail: -0.35,
  };
}

/** Bone Shot: a long-bone barrel bound in leather, bone barbs along the top, horn and bone plates, a rib stock. */
function vultureGun(s: number, d: Detail): SculptedSpec['gun'] {
  const V = VULTURE;
  const L = 0.72 * s;
  const r = 0.017 * s;
  return {
    main: [0, -0.07 * s, -L * 0.7],
    support: [0, -0.028 * s, 0],
    slideAt: [0, -0.002 * s, -L * 0.36],
    travel: 0.035 * s,
    build(k, part) {
      if (part === 'slide') {
        if (d.level >= 3) return;
        lathe(k, [[r * 1.5, 0.05 * s], [r * 1.9, 0.04 * s], [r * 1.95, -0.04 * s], [r * 1.5, -0.05 * s]], { seg: d.n(10, 4), paint: GEAR.leatherDark, finish: { ...LEATHER, size: 0.05 } });
        return;
      }
      if (part !== 'gun') return;
      if (d.level >= 3) {
        lathe(k, [[r * 1.8, 0], [r * 1.2, -L * 0.6], [0.03 * s, -L * 0.75], [0.025 * s, -L]], { seg: 4, paint: V.bone });
        return;
      }
      // Muzzle: a brass ring with a sickly glowing bead; the bone barrel with knuckled ends and leather bindings.
      lathe(k, [[r * 1.8, 0], [r * 2.1, -0.014 * s], [r * 1.6, -0.03 * s]], { seg: d.n(12, 4), paint: GEAR.brass, finish: BRASS });
      bead(k, [0, 0, -0.008 * s], r * 1.05, V.sickly, 0.8, d);
      lathe(k, [[r * 1.6, -0.028 * s], [r * 1.25, -0.06 * s], [r, -L * 0.2], [r * 0.95, -L * 0.4], [r * 1.3, -L * 0.52], [r * 1.75, -L * 0.57], [r * 1.4, -L * 0.6]], {
        seg: d.n(12, 4), paint: (t) => mix(V.bone, V.boneDark, Math.abs(t - 0.5) * 1.2), finish: { gloss: 0.35, tile: 4, size: 0.4 },
      });
      for (const z of [0.16, 0.26]) lathe(k, [[r * 1.18, -L * z + 0.02 * s], [r * 1.25, -L * z], [r * 1.18, -L * z - 0.02 * s]], { seg: d.n(10, 4), paint: GEAR.leatherDark, finish: LEATHER });
      if (d.level < 2) {
        // Bone barbs along the top, raked back.
        for (let i = 0; i < 4; i++) {
          const z = -L * (0.1 + i * 0.09);
          k.loft([{ c: [0, r * 0.9, z], w: r * 0.35, up: r * 0.5 }, { c: [0, r * 2.4, z - 0.03 * s], w: 0, up: 0 }], { seg: 4, ref: [0, 0, 1], paint: V.bone, finish: { gloss: 0.4 } });
        }
      }
      // Horn receiver with bone side plates, a horn grip, and a stock of three bone ribs to a carved butt.
      block(k, [0.042 * s, 0.06 * s, 0.13 * s], [0, -0.006 * s, -L * 0.66], GEAR.horn, { gloss: 0.35 }, d);
      if (d.level === 0) for (const x of [1, -1]) block(k, [0.006 * s, 0.042 * s, 0.1 * s], [x * 0.023 * s, -0.004 * s, -L * 0.66], V.bone, { gloss: 0.35 }, d);
      carve(k, [[-L * 0.66, -0.03 * s], [-L * 0.72, -0.03 * s], [-L * 0.78, -0.12 * s], [-L * 0.7, -0.125 * s]], 0.03 * s, GEAR.horn, { gloss: 0.3 }, d);
      for (const [y, w] of d.level === 0 ? ([[0.012, 1], [-0.022, 0.9], [-0.052, 0.8]] as const) : ([[-0.02, 1.6]] as const)) {
        k.loft([{ c: [0, y * s, -L * 0.72], w: 0.008 * s * w, up: 0.008 * s }, { c: [0, (y + 0.012) * s, -L * 0.88], w: 0.007 * s, up: 0.007 * s }, { c: [0, y * s, -L * 0.99], w: 0.008 * s, up: 0.008 * s }], { n: d.n(5, 3), seg: d.n(6, 3), paint: V.bone, finish: { gloss: 0.35 } });
      }
      carve(k, [[-L * 0.97, 0.03 * s], [-L * 1.02, 0.025 * s], [-L * 1.03, -0.08 * s], [-L * 0.97, -0.075 * s]], 0.036 * s, V.boneDark, { gloss: 0.3 }, d);
      if (d.level < 2) {
        // The ammo: bone shells in a leather loop on the stock.
        block(k, [0.008 * s, 0.03 * s, 0.17 * s], [0.024 * s, -0.02 * s, -L * 0.86], GEAR.leatherDark, LEATHER, d);
        for (let i = 0; i < 5; i++) lathe(k, [[0.007 * s, 0.012 * s], [0.008 * s, 0], [0.007 * s, -0.012 * s]], { at: [0.03 * s, -0.02 * s, -L * (0.78 + i * 0.04)], rot: [Math.PI / 2, 0, 0], seg: 5, paint: V.bone });
      }
    },
  };
}

// =================================================================================================================
// Swift: a living boomerang. A small, glossy, sooty body leaning forward, two long sickle wings held half-open from
// the shoulders and swept back past a deeply forked tail (the crescent reads from every side), a pale throat and
// brow, big dark eyes, flight goggles and a long flock-colour scarf streaming behind. The gun is held in short
// feathered forearms. Mobility skirmisher: a crescent-bladed SMG with a curved horn magazine.

const SWIFT = {
  soot: 0x37322f,
  brown: 0x524640,
  pale: 0xe6dfd2,
  tip: 0x1e1b1a,
  bill: 0x1a1816,
  leg: 0x4e4440,
  claw: 0x1a1614,
  iris: 0x2a1a10,
  horn: 0xcdb98e,
  lens: 0x7fb8d8,
} as const;

export function swift(plan: BodyPlan, team: TeamColours, d: Detail): SculptedSpec {
  const H = plan.height;
  const hr = plan.head.radius;
  const hc = plan.head.centre.up;
  const A = swiftAnchors(plan);
  const s = A.s;
  const W = SWIFT;
  const GLOSS = { tile: 1, size: 0.1, gloss: 0.35, iri: 0.2 } as const;
  const legLen = A.legLen;
  const field = bodyField('swift', plan);
  const skin = skinFor('swift', plan, SWIFT_SKIN, d.level, {
    back: { paint: mix(W.soot, W.brown, 0.15), finish: GLOSS },
    mantle: { paint: mix(W.soot, W.brown, 0.35), finish: GLOSS },
    scapular: { paint: mix(W.brown, W.soot, 0.2), finish: GLOSS },
    shoulder: { paint: W.brown, finish: GLOSS },
    coverts: { paint: W.soot, finish: GLOSS },
    breast: { paint: (p) => mix(W.brown, W.soot, Math.min(1, Math.abs(p.x) / (0.2 * s) + 0.25)), finish: GLOSS },
    belly: { paint: mix(W.soot, W.brown, 0.25), finish: GLOSS },
    thigh: { paint: W.soot, finish: { ...GLOSS, size: 0.06 } },
    neck: { paint: W.soot, finish: GLOSS },
    // A warm brown crown and nape over the sooty body: the head separates from the back from behind.
    crown: { paint: mix(W.brown, W.soot, 0.3), finish: { ...GLOSS, size: 0.06 } },
    face: { paint: W.soot, finish: { ...GLOSS, tile: 0 } },
    cheek: { paint: W.soot, finish: { ...GLOSS, tile: 0 } },
    // The pale brow over each eye: the swift's scowl, picked out.
    brow: { paint: mix(W.pale, W.brown, 0.45), finish: { gloss: 0.3 } },
    nape: { paint: mix(W.brown, W.soot, 0.5), finish: { ...GLOSS, size: 0.06 } },
    throat: { paint: W.soot, finish: GLOSS },
    bill: { paint: W.bill, finish: { gloss: 0.5 } },
    socket: { paint: shade(W.soot, 0.7), finish: { gloss: 0.3 } },
    pale: { paint: mix(W.pale, W.brown, 0.35), finish: { gloss: 0.15 } },
  });
  const leg: LegStyle = {
    skin: W.leg, claw: W.claw, thick: A.legThick, thigh: W.soot, fringe: 0.6, skinned: { r: 0.034 * s, at: 0.2 },
    toes: [{ yaw: -0.55, len: 0.07 * s }, { yaw: -0.18, len: 0.08 * s }, { yaw: 0.18, len: 0.08 * s }, { yaw: 0.55, len: 0.07 * s }],
    clawLen: 0.03 * s,
  };
  // The forearms that hold the gun: short, dark, feathered.
  const arm: WingStyle = {
    covert: W.brown, secondary: W.soot, primary: W.soot, primaryTip: W.tip, trim: team.primary,
    thick: 0.028 * s, chord: 0.18 * s, primaries: 4, secondaries: 4, primaryLen: 0.32, secondaryLen: 0.8, finish: { gloss: 0.3 },
  };

  const body = (k: Sculpt): void => {
    // The body is the baked implicit skin (bodies.ts); gear and feathers sit on its surface.
    const axis: [V3, V3] = [[0, 0.3 * s, -0.27 * s], [0, hc - 0.14 * s, 0.03 * s]];
    const torso = field.only(...TRUNK).surface(...axis, [0, 0, 1]);
    const collar = field.only(...TRUNK, 'neck').surface(...axis, [0, 0, 1]);
    // The crescent: on each shoulder a long sickle wing held half-open, swept back and tilted up so it reads from
    // the front and from the player's camera; it flares wider on the display.
    for (const side of [1, -1] as const) {
      const shoulder: V3 = [side * 0.15 * s, 1.0 * s, -0.07 * s];
      // The wing's face turns up and back, so the crescent is broadside to a camera behind and above.
      const face: V3 = norm([side * 0.35, 0.6, -0.72]);
      const morph = { display: hinge(shoulder, [0, 1, 0], side * 0.45) };
      const np = d.keep(9, 2);
      for (let i = 0; i < np; i++) {
        const u = np === 1 ? 1 : i / (np - 1);
        // Outer primaries longest and most swept; the inner ones shorter, nearer the body.
        const out = 0.15 + 0.85 * u;
        const dir = norm([side * (0.35 + 0.55 * out), 0.02 - 0.08 * u, -0.85 + 0.3 * out]);
        const root: V3 = [shoulder[0] + side * 0.06 * s * u, shoulder[1] - 0.01 * s * u, shoulder[2] - 0.02 * s * u];
        k.card({
          at: root, dir, face, len: (0.45 + 0.65 * u) * s, wid: (0.22 - 0.05 * u) * s * Math.min(1.6, (9 / np) ** 0.5), cell: CARD.sickle,
          root: shade(W.brown, 0.85 + 0.1 * (i % 2)), tip: W.tip, sweep: -side * (0.3 + 0.4 * u), segs: d.level === 3 ? 2 : d.rows + 1, cup: d.level < 2 ? 0.05 : 0,
          finish: { gloss: 0.25 }, morph,
        });
      }
      // Coverts over the wing's root, the inner row in the flock colour.
      if (d.level < 3) {
        for (let i = 0; i < d.keep(4, 2); i++) {
          const u = i / Math.max(1, d.keep(4, 2) - 1);
          const dir = norm([side * (0.45 + 0.3 * u), -0.1, -0.75]);
          k.card({
            at: [shoulder[0] + side * 0.02 * s, shoulder[1] + 0.02 * s, shoulder[2] + 0.02 * s], dir, face, len: (0.2 + 0.08 * u) * s, wid: 0.09 * s, cell: CARD.contour,
            root: i === 0 ? team.primary : shade(W.brown, 0.95), tip: i === 0 ? team.light : W.brown, segs: d.rows, finish: { gloss: 0.35 }, morph,
          });
        }
      }
    }
    // The mantle: broad glossy scapulars layered down the back, so the player camera sees feathers, not a bottle.
    shingle(k, torso, { t: [0.42, 0.86], a: [-Math.PI * 0.85, -Math.PI * 0.15], rows: 3, cols: 4, len: 0.15 * s, wid: 0.12 * s, paint: (t) => mix(W.brown, mix(W.brown, W.pale, 0.18), t), lift: 0.12, seed: 4, finish: GLOSS }, d);
    // Gear: a slim harness with a magazine pouch, and the flock-colour scarf with two long streamers behind.
    sash(k, torso, 0.62, 0.16, Math.PI * 0.65, { width: 0.04 * s, thick: 0.01 * s, hex: GEAR.leather, finish: LEATHER }, d);
    pouch(k, torso.at(0.58, Math.PI * 0.6, 0), [0.07 * s, 0.09 * s, 0.045 * s], GEAR.leatherDark, d);
    band(k, collar, 0.92, { width: 0.07 * s, thick: 0.018 * s, hex: team.primary, stitch: team.light, finish: { gloss: 0.35 } }, d);
    if (d.level < 3) {
      for (const x of [1, -1]) {
        const knot = collar.at(0.92, -Math.PI / 2 + x * 0.3, 0.02 * s);
        k.card({ at: [knot.p.x, knot.p.y, knot.p.z], dir: norm([x * 0.3, -0.3, -1]), face: [0, 1, 0], len: (x > 0 ? 0.66 : 0.54) * s, wid: 0.075 * s, cell: CARD.cloth, root: team.primary, tip: team.dark, curl: -0.35, sweep: x * 0.3, segs: d.level === 0 ? 5 : 2 });
      }
    }
  };

  const head = (k: Sculpt): void => {
    // The player-camera standard (D-ART-011): a ruff of pale-edged feathers round the back of the head under the strap,
    // and a short swept tuft at the back of the crown.
    const headAxis: [V3, V3] = [[A.head[0], A.head[1] - hr * 1.5, A.head[2] - hr * 0.1], [A.head[0], A.head[1] + hr * 0.9, A.head[2] - hr * 0.1]];
    hackles(k, inBone(field.only('crown', 'nape', 'neck', 'cheek').surface(...headAxis, [0, 0, 1]), A.head), {
      t: [0.22, 0.48], rows: 2, cols: 5, len: 0.075 * s, wid: 0.055 * s, lift: 0.3,
      paint: (t) => mix(mix(W.brown, W.pale, 0.2), W.brown, t), finish: { gloss: 0.3 }, seed: 29,
    }, d);
    if (d.level < 2) {
      for (const u of [-1, 0, 1]) {
        k.card({ at: [u * hr * 0.22, hr * 0.92, -hr * 0.42], dir: norm([u * 0.35, 0.45, -1]), face: [0, 1, 0.3], len: 0.08 * s, wid: 0.035 * s, cell: CARD.contour, root: W.brown, tip: W.soot, curl: -0.3, segs: d.rows, finish: { gloss: 0.3 } });
      }
    }
    // The head, its scowling brows and pale throat are the skin's; the eyes sit in its sockets.
    const E = SWIFT_HEAD.eye;
    for (const x of [1, -1]) eye(k, [x * hr * E[0], hr * E[1], hr * E[2]], [x * 0.55, 0.02, 0.83], { r: hr * 0.3, iris: W.iris, ring: W.soot, lid: W.brown, ringW: hr * 0.04 }, d);
    const B = SWIFT_HEAD.bill;
    beak(k, { at: [0, hr * B[1], hr * (B[2] - 0.02)], len: hr * 0.36, w: hr * 0.3, up: hr * 0.13, dn: hr * 0.09, curve: hr * 0.04, hook: hr * 0.02, base: W.bill, tip: W.bill, gape: 1.5, open: 0.4 }, d);
    // Flight goggles pushed up on the brow, on a leather strap round the back of the head.
    if (d.level < 3) {
      for (const x of [1, -1]) {
        const at: V3 = [x * hr * 0.42, hr * 0.8, hr * 0.42];
        ring(k, at, hr * 0.26, hr * 0.07, d, GEAR.brass, undefined, [-0.9, x * 0.45, 0]);
        bead(k, at, hr * 0.23, W.lens, 0.2, d, [1, 1, 0.45]);
      }
      // The strap: a loop round the skull, tilted from the goggles down to the nape, in the head bone's frame.
      const tilt = norm([0, 1, -0.75]);
      const c: V3 = [A.head[0], A.head[1] + hr * 0.15, A.head[2] - hr * 0.05];
      const skull = field.only('crown', 'nape', 'brow', 'cheek').surface(
        [c[0] - tilt[0] * hr, c[1] - tilt[1] * hr, c[2] - tilt[2] * hr], [c[0] + tilt[0] * hr, c[1] + tilt[1] * hr, c[2] + tilt[2] * hr],
      );
      const inHead = (p: Vector3): Vector3 => p.sub(new Vector3(...A.head));
      if (d.level < 2) band(k, { at: (t, a, off) => { const p = skull.at(t, a, off); return { ...p, p: inHead(p.p) }; } }, 0.5, { width: 0.035 * s, thick: 0.01 * s, hex: GEAR.leatherDark, finish: LEATHER }, d);
    }
  };

  const tail = (k: Sculpt): void => {
    // Deeply forked: two long outer streamers.
    tailFan(k, { count: 6, len: 0.3 * s, wid: 0.065 * s, spread: 0.6, droop: 0.5, fork: 1.3, root: W.soot, tip: W.tip, cell: CARD.sickle, finish: { gloss: 0.35 } }, d);
  };

  return {
    body, head, tail, skin,
    wing: wingsOf(arm, d),
    leg: legsOf(leg, d),
    gun: swiftGun(s, d),
    pivot: { wingL: A.wing, wingR: flipX(A.wing), legL: A.hip, legR: flipX(A.hip), tail: A.tail },
    legLen, legThick: leg.thick, wingLen: H * 0.36,
    // Slipstream, Screaming Party, Wing Scythe, Sky Stitch.
    casts: ['leap', 'raise', 'throw', 'leap'],
    sway: 0, castTail: -0.5,
  };
}

/** Sickle SMG: a short banded barrel over a crescent horn blade, a curved horn magazine, a slim carved stock. */
function swiftGun(s: number, d: Detail): SculptedSpec['gun'] {
  const W = SWIFT;
  const L = 0.48 * s;
  const r = 0.012 * s;
  return {
    main: [0, -0.05 * s, -L * 0.62],
    support: [0, -0.02 * s, 0],
    slideAt: [0, -0.004 * s, -L * 0.24],
    travel: 0.025 * s,
    build(k, part) {
      if (part === 'slide') {
        if (d.level >= 3) return;
        block(k, [0.03 * s, 0.026 * s, 0.07 * s], [0, 0, 0], GEAR.woodDark, WOOD, d);
        return;
      }
      if (part !== 'gun') return;
      if (d.level >= 3) {
        lathe(k, [[r * 1.6, 0], [r * 1.3, -L * 0.5], [0.022 * s, -L * 0.62], [0.016 * s, -L]], { seg: 4, paint: GEAR.woodDark });
        return;
      }
      lathe(k, [[r * 1.6, 0], [r * 1.8, -0.012 * s], [r * 1.4, -0.025 * s]], { seg: d.n(12, 4), paint: GEAR.brass, finish: BRASS });
      bead(k, [0, 0, -0.006 * s], r * 0.9, 0x8fe0ff, 0.8, d);
      lathe(k, [[r * 1.1, -0.02 * s], [r, -L * 0.45], [r * 1.3, -L * 0.5]], { seg: d.n(10, 4), paint: GEAR.iron, finish: { gloss: 0.6 } });
      ring(k, [0, 0, -L * 0.15], r * 1.2, r * 0.3, d);
      ring(k, [0, 0, -L * 0.36], r * 1.2, r * 0.3, d);
      // The crescent: a horn blade curving from under the muzzle down and back to the grip.
      const arc: [number, number][] = [];
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI * 0.85;
        arc.push([-0.02 * s - Math.sin(a) * L * 0.33, -0.012 * s - (1 - Math.cos(a)) * 0.05 * s]);
      }
      for (let i = 8; i >= 0; i--) {
        const a = (i / 8) * Math.PI * 0.85;
        arc.push([-0.06 * s - Math.sin(a) * L * 0.26, -0.012 * s - (1 - Math.cos(a)) * 0.03 * s]);
      }
      carve(k, arc, 0.008 * s, W.horn, { gloss: 0.5 }, d);
      // Receiver, grip and the curved horn magazine (the ammo), then a slim stock.
      block(k, [0.034 * s, 0.05 * s, 0.11 * s], [0, -0.004 * s, -L * 0.58], GEAR.woodDark, WOOD, d);
      carve(k, [[-L * 0.58, -0.024 * s], [-L * 0.64, -0.024 * s], [-L * 0.7, -0.1 * s], [-L * 0.63, -0.105 * s]], 0.024 * s, GEAR.wood, WOOD, d);
      const mag: { c: V3; w: number; up: number }[] = [];
      for (let i = 0; i <= 4; i++) {
        const u = i / 4;
        mag.push({ c: [0, -0.03 * s - u * 0.09 * s, -L * 0.5 + u * u * 0.05 * s], w: 0.011 * s, up: 0.022 * s });
      }
      k.loft(mag, { seg: d.n(8, 4), sq: 4, ref: [0, 0, 1], paint: (t) => (Math.abs(t - 0.5) < 0.1 ? GEAR.brass : W.horn), finish: { gloss: 0.5 } });
      carve(k, [[-L * 0.66, 0.012 * s], [-L, 0.02 * s], [-L * 1.02, -0.04 * s], [-L * 0.96, -0.045 * s], [-L * 0.7, -0.02 * s]], 0.022 * s, GEAR.woodDark, WOOD, d);
    },
  };
}

// =================================================================================================================
// Hummingbird: the smallest hero, an iridescent green drop with a ruby gorget, a needle bill as long as its body and
// wings beating as two shimmering discs at the shoulders. It perches on tiny feet. Mobility skirmisher: a twin-needle
// gun fed from a glowing nectar bulb.

const HUMMER = {
  green: 0x2aa45a,
  greenDeep: 0x17703b,
  gold: 0x9ab83a,
  bronze: 0x9a7a34,
  belly: 0xd8ddd0,
  ruby: 0xd0143c,
  rubyDeep: 0x7a0c28,
  tail: 0x2f4a36,
  bill: 0x1c1a1a,
  leg: 0x3a3330,
  iris: 0x1a1210,
  nectar: 0xff6f9a,
  lacquer: 0x1f6a46,
} as const;

export function hummingbird(plan: BodyPlan, team: TeamColours, d: Detail): SculptedSpec {
  const H = plan.height;
  const hr = plan.head.radius;
  const A = hummingbirdAnchors(plan);
  const s = A.s;
  const M = HUMMER;
  const IRIS = { tile: TILE.scales, size: 0.036, iri: 1, gloss: 0.35 } as const;
  const legLen = A.legLen;
  const clamp = (v: number): number => Math.min(1, Math.max(0, v));
  const field = bodyField('hummingbird', plan);
  const skin = skinFor('hummingbird', plan, HUMMINGBIRD_SKIN, d.level, {
    // Emerald above, bronzing over the mantle; pale grey-white below with green flanks.
    back: { paint: (p) => mix(M.green, M.bronze, clamp((p.y - 0.5 * s) / (0.4 * s)) * 0.5), finish: IRIS },
    mantle: { paint: M.bronze, finish: IRIS },
    scapular: { paint: mix(M.bronze, M.green, 0.4), finish: IRIS },
    shoulder: { paint: M.greenDeep, finish: IRIS },
    coverts: { paint: M.greenDeep, finish: IRIS },
    breast: { paint: (p) => mix(M.belly, M.green, clamp(Math.abs(p.x) / (0.16 * s) - 0.15)), finish: { ...IRIS, iri: 0.4 } },
    belly: { paint: (p) => mix(M.belly, M.green, clamp(Math.abs(p.x) / (0.14 * s) - 0.1) * 0.7), finish: { ...IRIS, iri: 0.3 } },
    thigh: { paint: M.belly, finish: { ...IRIS, iri: 0 } },
    neck: { paint: M.greenDeep, finish: IRIS },
    // The head: a bright gold-green crown and crest over a deep green nape and a bronze mantle.
    crown: { paint: M.gold, finish: IRIS },
    crest: { paint: mix(M.gold, M.green, 0.3), finish: IRIS },
    nape: { paint: M.greenDeep, finish: IRIS },
    face: { paint: M.green, finish: { ...IRIS, tile: TILE.flat } },
    cheek: { paint: M.greenDeep, finish: { ...IRIS, tile: TILE.flat } },
    brow: { paint: M.green, finish: { ...IRIS, tile: TILE.flat } },
    throat: { paint: M.ruby, finish: { ...IRIS, glow: 0.08 } },
    gorget: { paint: M.ruby, finish: { ...IRIS, glow: 0.08 } },
    spot: { paint: 0xf2f2ea, finish: { gloss: 0.2 } },
    bill: { paint: M.bill, finish: { gloss: 0.6 } },
    socket: { paint: M.greenDeep, finish: { gloss: 0.3 } },
  });
  const leg: LegStyle = {
    skin: M.leg, claw: M.bill, thick: A.legThick, thigh: M.belly, fringe: 0.6, fringeCell: CARD.down, skinned: { r: 0.04 * s, at: 0.25 },
    toes: [{ yaw: -0.4, len: 0.05 * s }, { yaw: 0, len: 0.06 * s }, { yaw: 0.4, len: 0.05 * s }, { yaw: Math.PI, len: 0.035 * s }],
    clawLen: 0.022 * s,
  };
  const wing: WingStyle = {
    covert: M.green, secondary: M.greenDeep, primary: M.greenDeep, trim: team.primary,
    thick: 0.022 * s, chord: 0.2 * s, primaries: 5, secondaries: 6, primaryLen: 0.45, finish: { iri: 1 },
  };
  const neckAxis: [V3, V3] = [[0, 0.86 * s, -0.02 * s], [0, A.head[1] + 0.02 * s, 0]];

  const body = (k: Sculpt): void => {
    // The body is the baked implicit skin (bodies.ts); feathers and gear sit on its surface. Upright: a = π/2 in front.
    const torso = field.only(...TRUNK).surface([0, 0.2 * s, -0.08 * s], [0, 0.94 * s, -0.02 * s], [0, 0, 1]);
    // The gorget: ruby scale-feathers over the throat that flare and catch the light on the display.
    const throat = field.only('breast', 'neck').surface(...neckAxis, [0, 0, 1]);
    shingle(k, throat, {
      t: [0.2, 0.42], a: [Math.PI * 0.2, Math.PI * 0.8], rows: 2, cols: 4, len: 0.08 * s, wid: 0.08 * s, paint: (t) => mix(M.rubyDeep, M.ruby, 0.4 + t), lift: 0.18, seed: 2,
      finish: { iri: 1, glow: 0.12, gloss: 0.4 }, morph: (_t, _a, at, dir, n) => flare(at, dir, n, 0.7),
    }, d);
    // Bronze-green scapulars over the shoulders, and the folded wing tips down the flanks.
    shingle(k, torso, {
      t: [0.62, 0.86], a: [-Math.PI * 0.85, -Math.PI * 0.15], rows: 2, cols: 4, len: 0.1 * s, wid: 0.09 * s,
      paint: (_t, a) => mix(M.bronze, M.gold, 0.3 * Math.abs(Math.cos(a))), lift: 0.14, seed: 5, finish: { iri: 1, gloss: 0.35 },
    }, d);
    // The wings, beating: two shimmering blur discs at each shoulder (cut-out fans, iridescent).
    for (const x of [1, -1]) {
      const at: V3 = [x * 0.15 * s, 0.86 * s, -0.08 * s];
      const fans = d.level >= 3 ? 1 : 2;
      for (let i = 0; i < fans; i++) {
        const up = i === 0 ? 1 : -1;
        k.card({ at, dir: norm([x * 0.25, up * 0.55, -0.8]), face: [x, 0, 0.25], len: 0.46 * s, wid: 0.46 * s, cell: CARD.blur, root: shade(M.green, 1.25), tip: 0xcfe8d8, segs: d.level === 0 ? 10 : 6, finish: { iri: 1, glow: 0.15, gloss: 0.4 } });
      }
    }
    // Gear: the flock-colour sash across the back with a bandolier of glowing nectar vials, and a pouch on the hip.
    sash(k, torso, 0.62, 0.2, Math.PI * 0.7, { width: 0.05 * s, thick: 0.01 * s, hex: team.primary, stitch: team.light, finish: { gloss: 0.3 } }, d);
    if (d.level < 2) {
      for (let i = 0; i < 4; i++) {
        const u = 0.08 + i * 0.07;
        const p = torso.at(0.62 + 0.2 * Math.cos(u * Math.PI * 2), Math.PI * 0.7 + u * Math.PI * 2, 0.025 * s);
        bead(k, [p.p.x, p.p.y, p.p.z], 0.016 * s, M.nectar, 0.55, d, [0.8, 1.6, 0.8]);
        stud(k, [p.p.x, p.p.y + 0.028 * s, p.p.z], 0.01 * s);
      }
    }
    pouch(k, torso.at(0.4, Math.PI * 1.15, 0), [0.06 * s, 0.07 * s, 0.04 * s], GEAR.leather, d);
    // A flock-colour scarf at the base of the neck, its two streamers flying behind (reads from the player camera).
    const collar = field.only(...TRUNK, 'neck').surface([0, 0.2 * s, -0.08 * s], [0, A.head[1] - 0.1 * s, 0], [0, 0, 1]);
    band(k, collar, 0.83, { width: 0.05 * s, thick: 0.016 * s, hex: team.primary, stitch: team.light, finish: { gloss: 0.35 } }, d);
    if (d.level < 3) {
      for (const x of [1, -1]) {
        const knot = collar.at(0.83, -Math.PI / 2 + x * 0.3, 0.02 * s);
        k.card({ at: [knot.p.x, knot.p.y, knot.p.z], dir: norm([x * 0.35, -0.5, -1]), face: [0, 1, 0], len: (x > 0 ? 0.36 : 0.3) * s, wid: 0.055 * s, cell: CARD.cloth, root: team.primary, tip: team.dark, curl: -0.3, sweep: x * 0.3, segs: d.level === 0 ? 4 : 2 });
      }
    }
  };

  const head = (k: Sculpt): void => {
    // The head, crest, gorget and eye spots are the skin's; the eyes sit in its sockets and the needle grows from the
    // bill base. The player-camera standard: hackles down the nape, and the crest's feathers lifting off the crown.
    hackles(k, inBone(field.only('neck', 'nape', 'crown').surface(...neckAxis, [0, 0, 1]), A.head), {
      t: [0.45, 0.8], rows: 2, cols: 4, len: 0.06 * s, wid: 0.05 * s, lift: 0.2,
      paint: (t) => mix(M.greenDeep, M.green, 0.3 + 0.5 * t), finish: { iri: 1, gloss: 0.35 }, seed: 41,
    }, d);
    if (d.level < 2) {
      for (const u of [-1, -0.5, 0, 0.5, 1]) {
        k.card({ at: [u * hr * 0.22, hr * (0.9 - 0.06 * Math.abs(u)), -hr * (0.35 + 0.1 * Math.abs(u))], dir: norm([u * 0.35, 0.75, -1]), face: [0, 1, 0.5], len: 0.14 * s, wid: 0.04 * s, cell: CARD.contour, root: M.gold, tip: shade(M.green, 0.8), curl: -0.35, segs: d.rows, finish: { iri: 1, gloss: 0.4 }, morph: { display: hinge([0, hr * 0.9, -hr * 0.4], [1, 0, 0], -0.5) } });
      }
    }
    const E = HUMMINGBIRD_HEAD.eye;
    for (const x of [1, -1]) eye(k, [x * hr * E[0], hr * E[1], hr * E[2]], [x * 0.62, 0.05, 0.78], { r: hr * 0.3, iris: M.iris, ring: M.greenDeep, lid: M.green, ringW: hr * 0.05 }, d);
    // The needle bill, as long as the body, slightly down-curved.
    const B = HUMMINGBIRD_HEAD.bill;
    beak(k, { at: [0, hr * B[1], hr * (B[2] - 0.02)], len: H * 0.42, w: hr * 0.12, up: hr * 0.1, dn: hr * 0.07, curve: H * 0.025, base: M.bill, tip: M.bill, lowerLen: 0.96, open: 0.12 }, d);
  };

  const tail = (k: Sculpt): void => {
    tailFan(k, { count: 8, len: 0.26 * s, wid: 0.07 * s, spread: 1.0, droop: 0.95, root: M.tail, tip: shade(M.tail, 0.6), cell: CARD.tail, finish: { iri: 0.6 } }, d);
  };

  return {
    body, head, tail, skin,
    wing: wingsOf(wing, d),
    leg: legsOf(leg, d),
    gun: hummingbirdGun(s, d),
    pivot: { wingL: A.wing, wingR: flipX(A.wing), legL: A.hip, legR: flipX(A.hip), tail: A.tail },
    legLen, legThick: leg.thick, wingLen: H * 0.34,
    // Dart, Nectar Sip, Blur, Thousand Beats.
    casts: ['leap', 'aim', 'raise', 'raise'],
    sway: 0, castTail: -0.6,
  };
}

/** Nectar Needler: twin brass needles from a flower-petal muzzle, fed from a glowing glass nectar bulb. */
function hummingbirdGun(s: number, d: Detail): SculptedSpec['gun'] {
  const M = HUMMER;
  const L = 0.42 * s;
  return {
    main: [0, -0.045 * s, -L * 0.72],
    support: [0, -0.018 * s, 0],
    slideAt: [0, -0.004 * s, -L * 0.3],
    travel: 0.02 * s,
    build(k, part) {
      if (part === 'slide') {
        if (d.level >= 3) return;
        lathe(k, [[0.012 * s, 0.03 * s], [0.018 * s, 0.02 * s], [0.018 * s, -0.02 * s], [0.012 * s, -0.03 * s]], { seg: d.n(10, 4), paint: M.lacquer, finish: { ...WOOD, iri: 0.5 } });
        return;
      }
      if (part !== 'gun') return;
      if (d.level >= 3) {
        lathe(k, [[0.008 * s, 0], [0.014 * s, -L * 0.6], [0.02 * s, -L * 0.7], [0.014 * s, -L]], { seg: 4, paint: M.lacquer });
        return;
      }
      // The petal muzzle (a flared trumpet flower in pink brass) and its glowing nectar bead.
      lathe(k, [[0.02 * s, 0], [0.012 * s, -0.012 * s], [0.007 * s, -0.03 * s]], { seg: d.n(10, 5), paint: (t) => mix(M.nectar, GEAR.brass, t), finish: BRASS });
      bead(k, [0, 0, -0.008 * s], 0.006 * s, M.nectar, 0.9, d);
      for (const x of [1, -1]) lathe(k, [[0.0045 * s, -0.01 * s], [0.0055 * s, -L * 0.62]], { at: [x * 0.007 * s, 0, 0], seg: d.n(6, 3), paint: GEAR.brass, finish: BRASS });
      // The bulb: a glass sphere of glowing nectar in a brass cage on the receiver (the ammo read).
      bead(k, [0, 0.032 * s, -L * 0.62], 0.024 * s, M.nectar, 0.6, d);
      ring(k, [0, 0.032 * s, -L * 0.62], 0.025 * s, 0.003 * s, d, GEAR.brass, undefined, [Math.PI / 2, 0, 0]);
      ring(k, [0, 0.032 * s, -L * 0.62], 0.025 * s, 0.003 * s, d, GEAR.brass, undefined, [0, Math.PI / 2, 0]);
      block(k, [0.028 * s, 0.04 * s, 0.09 * s], [0, 0, -L * 0.66], M.lacquer, { ...WOOD, iri: 0.5 }, d);
      carve(k, [[-L * 0.64, -0.018 * s], [-L * 0.71, -0.018 * s], [-L * 0.78, -0.09 * s], [-L * 0.7, -0.094 * s]], 0.02 * s, GEAR.wood, WOOD, d);
      carve(k, [[-L * 0.74, 0.01 * s], [-L, 0.018 * s], [-L * 1.03, -0.035 * s], [-L * 0.76, -0.02 * s]], 0.02 * s, M.lacquer, { ...WOOD, iri: 0.5 }, d);
    },
  };
}

export const A3_BUILDS = { peacock, vulture, swift, hummingbird } as const;
