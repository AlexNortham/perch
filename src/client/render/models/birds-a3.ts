/* eslint-disable @typescript-eslint/no-magic-numbers -- authored birds: the numbers are the sculpture */
/**
 * Batch A3 birds, sculpted to the style guide (§8; GDD §9.13 to §9.16): Peacock, Vulture, Swift and Hummingbird.
 * Every size comes from the BodyPlan at runtime (head about the head hitbox centre, body inside the capsule, the gun's
 * tip at the muzzle); only fractions and authored offsets are written here.
 */
import { Matrix4, Vector3 } from 'three';
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import type { TeamColours } from '../palette';
import { add, beak, eye, FEATHER, flare, foot, legsOf, mul, norm, ovoid, shin, shingle, SKIN, tailFan, thigh, wingArm, wingHand, wingsOf } from './anatomy';
import type { LegStyle, WingStyle } from './anatomy';
import { CARD } from './feathers';
import { band, bead, block, BRASS, buckle, carve, GEAR, LEATHER, lathe, plume, pouch, ring, sash, strap, stud, WOOD } from './gear';
import type { Detail, SculptedSpec } from './sculpted';
import { hinge, jitter, mix, shade } from './sculpt';
import type { Sculpt, V3 } from './sculpt';

/** Peacock iridescence: blue turns toward teal and green toward gold as the surface turns away. */
const IRI = { tile: 1, size: 0.12, iri: -1 } as const;

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
// Peacock: long iridescent blue neck, a crown of five spoon crest feathers, and a train of eyed feathers that trails on
// the ground and fans into a 3 m disc whenever it casts. Spirit burst: an ornate dart caster with a glowing eye
// chamber.

const PEACOCK = {
  blue: 0x1d5cc0,
  blueDeep: 0x16367f,
  green: 0x2f8650,
  bronze: 0x6f7a3a,
  belly: 0x1a2b2a,
  buff: 0xb39a6a,
  wing: 0x5f6a3a,
  chestnut: 0xa05a26,
  white: 0xf3f1ea,
  bill: 0xd2bf98,
  billTip: 0x8c7a58,
  leg: 0x8f8373,
  claw: 0x2a2522,
  iris: 0x4a2a16,
  crest: 0x2a7f9a,
  train: 0x2e8a4e,
  tail: 0x6b5030,
  lacquer: 0x1f5a6e,
  chamber: 0x3ad6c8,
} as const;

export function peacock(plan: BodyPlan, team: TeamColours, d: Detail): SculptedSpec {
  const H = plan.height;
  const R = plan.radius;
  const hr = plan.head.radius;
  const hc = plan.head.centre.up;
  const s = H / 1.9;
  const legLen = H * 0.27;
  const bodyY = 0.79 * s;
  const tailPivot: V3 = [0, bodyY + 0.02 * s, -0.4 * s];
  const P = PEACOCK;

  const leg: LegStyle = {
    skin: P.leg, claw: P.claw, thick: 0.027 * s, thigh: 0x4a4a3c, fringe: 0.5,
    toes: [{ yaw: -0.5, len: 0.11 * s }, { yaw: 0, len: 0.13 * s }, { yaw: 0.5, len: 0.11 * s }, { yaw: Math.PI, len: 0.055 * s }],
    clawLen: 0.035 * s,
  };
  const wing: WingStyle = {
    covert: P.wing, secondary: 0x4a4f2c, primary: P.chestnut, primaryTip: shade(P.chestnut, 0.7), trim: team.primary,
    thick: 0.034 * s, chord: 0.26 * s, primaries: 9, secondaries: 9, primaryLen: 0.68,
  };

  const body = (k: Sculpt): void => {
    const torso = k.loft(
      [
        { c: [0, bodyY + 0.02 * s, -0.46 * s], w: 0, up: 0 },
        { c: [0, bodyY + 0.02 * s, -0.4 * s], w: 0.14 * s, up: 0.12 * s },
        { c: [0, bodyY, -0.24 * s], w: 0.25 * s, up: 0.22 * s, dn: 0.23 * s },
        { c: [0, bodyY, -0.03 * s], w: 0.3 * s, up: 0.25 * s, dn: 0.28 * s },
        { c: [0, bodyY + 0.04 * s, 0.13 * s], w: 0.28 * s, up: 0.23 * s, dn: 0.27 * s },
        { c: [0, bodyY + 0.13 * s, 0.25 * s], w: 0.19 * s, up: 0.17 * s, dn: 0.18 * s },
        { c: [0, bodyY + 0.22 * s, 0.3 * s], w: 0, up: 0 },
      ],
      {
        n: d.n(16, 5), seg: d.n(24, 5),
        paint: (t, a) => {
          const top = Math.sin(a);
          if (t > 0.62 && top > -0.6) return mix(P.blue, P.blueDeep, 0.3 - 0.3 * top);
          if (top < -0.35) return mix(P.belly, P.blueDeep, Math.max(0, t - 0.5));
          return mix(P.bronze, P.green, 0.5 + 0.5 * top);
        },
        finish: IRI,
      },
    );
    // The neck: an S from the chest up under the head, iridescent blue.
    const neck = k.loft(
      [
        { c: [0, bodyY + 0.06 * s, 0.1 * s], w: 0.13 * s, up: 0.12 * s },
        { c: [0, bodyY + 0.28 * s, 0.17 * s], w: 0.095 * s, up: 0.1 * s },
        { c: [0, bodyY + 0.53 * s, 0.13 * s], w: 0.075 * s, up: 0.08 * s },
        { c: [0, hc - 0.22 * s, 0.05 * s], w: 0.066 * s, up: 0.07 * s },
        { c: [0, hc - 0.08 * s, 0], w: 0.07 * s, up: 0.07 * s },
      ],
      { n: d.n(12, 3), seg: d.n(16, 5), ref: [0, 0, 1], paint: (t, a) => mix(P.blue, P.blueDeep, 0.25 + 0.35 * Math.cos(a) ** 2 * (1 - t)), finish: IRI },
    );
    if (d.level < 3) {
      // Breast and neck-base scallops break the outline; the mantle shows bronze-green scales.
      shingle(k, torso, { t: [0.62, 0.86], a: [-Math.PI * 0.95, -Math.PI * 0.05], rows: 3, cols: 7, len: 0.09 * s, wid: 0.075 * s, paint: (t) => mix(P.blueDeep, P.blue, t), lift: 0.3, finish: IRI, seed: 3 }, d);
      shingle(k, torso, { t: [0.3, 0.7], a: [Math.PI * 0.15, Math.PI * 0.85], rows: 3, cols: 6, len: 0.1 * s, wid: 0.08 * s, paint: (_t, a) => mix(P.bronze, P.green, Math.sin(a)), lift: 0.2, finish: IRI, seed: 5 }, d);
      shingle(k, neck, { t: [0.05, 0.3], a: [0, Math.PI * 2], rows: 2, cols: 8, len: 0.07 * s, wid: 0.05 * s, paint: P.blue, lift: 0.25, finish: IRI, seed: 7, flow: -1 }, d);
    }
    // Gear: a flock-colour silk sash over the left shoulder and across the back with a brass buckle, a collar at the
    // neck base, and a dart satchel on the right hip.
    sash(k, torso, 0.56, 0.3, Math.PI * 0.3, { width: 0.1 * s, thick: 0.014 * s, hex: team.primary, stitch: team.light, finish: { gloss: 0.35 } }, d);
    buckle(k, torso.at(0.84, Math.PI * 0.15, 0.02 * s), 0.06 * s, d);
    // A flock-colour silk collar with two ribbon tails down the back (reads from behind), edged with brass.
    if (d.level < 3) strap(k, neck, [0.1, 0], [0.1, Math.PI * 2], { width: 0.06 * s, thick: 0.014 * s, hex: team.primary, stitch: team.light, finish: { gloss: 0.35 } }, d);
    if (d.level < 3) {
      for (const x of [1, -1]) {
        const knot = neck.at(0.12, -Math.PI / 2 + x * 0.25, 0.02 * s);
        k.card({ at: [knot.p.x, knot.p.y, knot.p.z], dir: norm([x * 0.25, -1, -0.35]), face: [knot.n.x, knot.n.y, knot.n.z], len: 0.3 * s, wid: 0.05 * s, cell: CARD.cloth, root: team.primary, tip: team.dark, curl: -0.2, sweep: x * 0.2, segs: 3 });
      }
    }
    pouch(k, torso.at(0.45, Math.PI * 1.08, 0), [0.1 * s, 0.13 * s, 0.06 * s], GEAR.leather, d);
    if (d.level < 2) for (let i = 0; i < 4; i++) plume(k, add([0, 0, 0], [-0.27 * s - i * 0.012 * s, bodyY + 0.03 * s, -0.04 * s + i * 0.02 * s]), [0.1, 1, -0.2], 0.08 * s, 0.022 * s, P.blue, CARD.primary, [-1, 0, 0]);
  };

  const head = (k: Sculpt): void => {
    // The head, with the white face stripes painted above and below each eye.
    const stripe = (t: number, a: number): boolean => {
      const side = Math.cos(a) >= 0 ? a : Math.PI - a;
      const s2 = Math.atan2(Math.sin(side), Math.abs(Math.cos(side)));
      return (t > 0.6 && t < 0.88 && s2 > 0.3 && s2 < 0.52) || (t > 0.64 && t < 0.86 && s2 > -0.34 && s2 < -0.12);
    };
    ovoid(k, [0, 0.005 * s, 0.01 * s], [hr * 1.04, hr * 1.05, hr * 1.18], { n: d.n(14, 4), seg: d.n(22, 6), egg: 0.08, paint: (t, a) => (stripe(t, a) && d.level < 2 ? P.white : Math.sin(a) < -0.5 && t > 0.6 ? P.blueDeep : P.blue), finish: IRI });
    // Neck sleeve under the head (hides the join when the head turns).
    k.loft([{ c: [0, -hr * 0.2, -0.01 * s], w: hr * 0.8, up: hr * 0.8 }, { c: [0, -hr * 0.75, -0.005 * s], w: 0.071 * s, up: 0.072 * s }, { c: [0, -hr * 1.4, 0], w: 0.064 * s, up: 0.064 * s }], { n: d.level < 2 ? 5 : 3, seg: d.n(16, 4), ref: [0, 0, 1], paint: P.blue, finish: IRI });
        for (const x of [1, -1]) {
      eye(k, [x * hr * 0.74, hr * 0.12, hr * 0.5], [x * 0.78, 0.05, 0.62], { r: hr * 0.25, iris: P.iris, ring: P.white, lid: P.blueDeep, ringW: hr * 0.045 }, d);
    }
    beak(k, { at: [0, -hr * 0.12, hr * 1.02], len: hr * 1.0, w: hr * 0.26, up: hr * 0.25, dn: hr * 0.17, curve: hr * 0.1, hook: hr * 0.06, base: P.bill, tip: P.billTip, open: 0.32 }, d);
    // The crown: five spoon-tipped feathers fanned across the head; they spread wider on the display.
    // Each is a bare shaft (solid, so it reads from the side) ending in a spoon of two crossed cards.
    const n = d.level >= 3 ? 3 : 5;
    const crestLen = 0.19 * s;
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * 2 - 1;
      const at: V3 = [u * hr * 0.14, hr * 0.82, -hr * 0.12];
      const dir = norm([u * 0.34, 1, -0.22 + 0.05 * Math.abs(u)]);
      const morph = { display: hinge(at, [0, 0, 1], -u * 0.3) };
      const top = add(at, mul(dir, crestLen * 0.62));
      if (d.level < 2) k.loft([{ c: at, w: 0.004 * s, up: 0.004 * s }, { c: top, w: 0.0022 * s, up: 0.0022 * s }], { seg: d.level === 0 ? 5 : 3, paint: 0xc8d0d4, finish: { gloss: 0.4 }, morph });
      for (const face of [[0, 0.15, 1], [1, 0, 0]] as const) {
        k.card({ at: add(at, mul(dir, crestLen * 0.4)), dir, face, len: crestLen * 0.6, wid: 0.07 * s, cell: CARD.spoon, root: P.crest, tip: shade(P.crest, 0.7), segs: 1, finish: { iri: -1 }, morph, vSpan: 1 });
        if (d.level > 1) break;
      }
    }
  };

  // The train on the tail bone: tiers of eyed feathers trail behind to the ground; on the display each swings up
  // into its place in a concave disc behind the bird, eyes to the front. Under it, the stiff brown tail.
  const tail = (k: Sculpt): void => {
    const drop = tailPivot[1] - 0.025 * s;
    const tiers = d.level === 0 ? [[18, 1.45], [14, 1.12], [11, 0.8]] : d.level === 1 ? [[11, 1.45], [8, 1.1], [6, 0.78]] : d.level === 2 ? [[7, 1.42], [5, 1.0]] : [[4, 1.4]];
    tiers.forEach(([count = 1, length = 1], tier) => {
      const L = length * s;
      for (let i = 0; i < count; i++) {
        const u = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
        const j = tier * 31 + i;
        const at: V3 = [u * 0.1 * s, 0.012 * s * tier, -0.02 * s * tier];
        // Rest: a long tapering bundle back and down so the tips lie on the ground; the side feathers roll outward so
        // the train has a rounded back, and the curl flattens each along the floor.
        const fall = Math.asin(Math.min(0.95, (drop + at[1]) / (L * 0.82)));
        const yaw = u * (0.17 - tier * 0.02) + (jitter(j, 2) - 0.5) * 0.04;
        const dir = norm([Math.sin(yaw), -Math.tan(fall) * 1.15, -Math.cos(yaw)]);
        const face = norm([Math.sin(u * 0.9) * 0.8, Math.cos(fall), -Math.sin(fall) * 0.4]);
        // Display: a fan in the plane facing forward, each feather at its angle round the disc.
        const phi = u * (1.72 - tier * 0.12) + (jitter(j, 4) - 0.5) * 0.06;
        const dir2 = norm([Math.sin(phi), Math.cos(phi), -0.12]);
        const face2: V3 = [0, 0.15, 1];
        const at2: V3 = [Math.sin(phi) * 0.03 * s, 0.05 * s + tier * 0.01 * s, -0.05 * s + tier * 0.03 * s];
        k.card({
          at, dir, face, len: L * (0.95 + 0.1 * jitter(j, 6)), wid: 0.23 * s * (d.level === 0 ? 1 : 1.25), cell: CARD.eye,
          root: mix(P.train, 0xffffff, 0.35), tip: 0xffffff, curl: 0.55, segs: d.level === 0 ? 3 : 2, finish: { iri: -0.9 },
          morph: { display: repose(at, dir, face, at2, dir2, face2) },
        });
      }
    });
    // The stiff tail that props the display, and the coverts over the train's root.
    tailFan(k, {
      count: 10, len: 0.62 * s, wid: 0.07 * s, spread: 1.0, droop: 0.65, root: shade(P.tail, 0.8), tip: P.tail, cell: CARD.tail,
      at: [0, -0.03 * s, 0.02 * s],
      display: (u, at) => repose(at, norm([Math.sin(Math.PI + u * 0.5), -Math.sin(0.65), Math.cos(Math.PI + u * 0.5)]), [0, 1, 0], at, norm([u * 0.9, 1, -0.5]), [0, 0.2, 1]),
    }, d);
    if (d.level < 3) {
      for (let i = 0; i < d.keep(9, 3); i++) {
        const u = (i / Math.max(1, d.keep(9, 3) - 1)) * 2 - 1;
        k.card({ at: [u * 0.1 * s, 0.05 * s, 0.06 * s], dir: norm([u * 0.3, -0.25, -1]), face: [0, 1, 0], len: 0.28 * s, wid: 0.1 * s, cell: CARD.contour, root: P.bronze, tip: P.green, curl: -0.2, segs: 1, finish: IRI });
      }
    }
  };

  const gun = peacockGun(s, d);
  return {
    body, head, tail,
    wing: (k, seg, side, upper, lower) => (seg === 'arm' ? wingArm(k, upper, wing, d, side) : wingHand(k, upper, lower, wing, d, side)),
    leg: (k, seg, side, upper, _lower, ankle) => {
      if (seg === 'thigh') thigh(k, upper, leg, d, side);
      else if (seg === 'shin') {
        shin(k, upper, leg, d);
        // The spur on the back of the tarsus.
        if (d.level < 2) k.loft([{ c: [0, -upper * 0.62, -leg.thick * 0.7], w: leg.thick * 0.35, up: leg.thick * 0.35 }, { c: [0, -upper * 0.66, -leg.thick * 2.4], w: 0, up: 0 }], { seg: 6, ref: [0, 1, 0], paint: P.claw, finish: { gloss: 0.8 } });
      } else foot(k, ankle, leg, d, side);
    },
    gun,
    pivot: {
      wingL: [R * 0.75, bodyY + 0.13 * s, 0.05 * s], wingR: [-R * 0.75, bodyY + 0.13 * s, 0.05 * s],
      legL: [R * 0.4, legLen, 0], legR: [-R * 0.4, legLen, 0],
      tail: tailPivot,
    },
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
  const R = plan.radius;
  const hr = plan.head.radius;
  const hc = plan.head.centre.up;
  const s = H / 2;
  const V = VULTURE;
  const legLen = H * 0.29;
  const leg: LegStyle = {
    skin: V.leg, claw: V.claw, thick: 0.034 * s, thigh: V.brown, fringe: 0.55, fringeCell: CARD.ragged,
    toes: [{ yaw: -0.45, len: 0.12 * s }, { yaw: 0, len: 0.14 * s }, { yaw: 0.45, len: 0.12 * s }, { yaw: Math.PI, len: 0.06 * s }],
    clawLen: 0.04 * s,
  };
  const wing: WingStyle = {
    covert: V.brown, secondary: V.black, primary: V.black, primaryTip: shade(V.black, 0.8), trim: team.primary,
    thick: 0.044 * s, chord: 0.4 * s, primaries: 8, secondaries: 9, primaryLen: 0.7, cell: CARD.ragged, secondaryCell: CARD.ragged,
    secondaryLen: 1.9, secondaryFlare: 0.9, displayFlare: 0.5,
  };

  const body = (k: Sculpt): void => {
    // The hump: fullest and highest behind the head, falling away to the tail and down the chest.
    const torso = k.loft(
      [
        { c: [0, 0.95 * s, -0.76 * s], w: 0, up: 0 },
        { c: [0, 1.02 * s, -0.64 * s], w: 0.24 * s, up: 0.3 * s, dn: 0.24 * s },
        { c: [0, 1.14 * s, -0.46 * s], w: 0.38 * s, up: 0.6 * s, dn: 0.45 * s },
        { c: [0, 1.15 * s, -0.31 * s], w: 0.42 * s, up: 0.78 * s, dn: 0.55 * s },
        { c: [0, 1.02 * s, -0.12 * s], w: 0.38 * s, up: 0.3 * s, dn: 0.44 * s },
        { c: [0, 0.98 * s, 0.05 * s], w: 0.28 * s, up: 0.2 * s, dn: 0.4 * s },
        { c: [0, 0.99 * s, 0.13 * s], w: 0, up: 0 },
      ],
      { n: d.n(16, 5), seg: d.n(24, 5), paint: (t, a) => (Math.sin(a) < -0.3 ? mix(V.black, V.brown, 0.4) : mix(V.brown, V.edge, 0.25 * Math.max(0, Math.sin(a)) * t)), finish: FEATHER },
    );
    // The bare neck rising out of the ruff to the head.
    const neck = k.loft(
      [
        { c: [0, 1.28 * s, -0.12 * s], w: 0.11 * s, up: 0.11 * s },
        { c: [0, 1.44 * s, -0.05 * s], w: 0.085 * s, up: 0.08 * s },
        { c: [0, hc - 0.12 * s, 0.03 * s], w: 0.07 * s, up: 0.07 * s },
        { c: [0, hc - 0.04 * s, 0.01 * s], w: 0.072 * s, up: 0.072 * s },
      ],
      { n: d.n(8, 3), seg: d.n(14, 4), ref: [0, 0, 1], paint: (t) => mix(V.skinDark, V.skin, t), finish: SKIN },
    );
    // The ruff: a white collar of down, its tufts puffing out on the display.
    k.loft(
      [
        { c: [0, 1.26 * s, -0.14 * s], w: 0.13 * s, up: 0.13 * s },
        { c: [0, 1.35 * s, -0.11 * s], w: 0.22 * s, up: 0.21 * s },
        { c: [0, 1.44 * s, -0.07 * s], w: 0.17 * s, up: 0.16 * s },
        { c: [0, 1.5 * s, -0.04 * s], w: 0.09 * s, up: 0.085 * s },
      ],
      { n: d.n(6, 3), seg: d.n(16, 5), ref: [0, 0, 1], paint: (t) => mix(V.ruffShade, V.ruff, t), finish: { tile: 1, size: 0.06 } },
    );
    if (d.level < 3) {
      const tufts = d.keep(18, 6);
      for (let row = 0; row < (d.level === 0 ? 2 : 1); row++) {
        for (let i = 0; i < tufts; i++) {
          const a = (i / tufts) * Math.PI * 2 + row * 0.2;
          const n: V3 = [Math.cos(a), 0.25, Math.sin(a)];
          const at: V3 = [Math.cos(a) * 0.19 * s, (1.36 + row * 0.06) * s, -0.11 * s + Math.sin(a) * 0.19 * s];
          const dir = norm([Math.cos(a), -0.35 + row * 0.5, Math.sin(a)]);
          k.card({ at, dir, face: n, len: 0.17 * s, wid: 0.15 * s * Math.sqrt(18 / tufts), cell: CARD.down, root: V.ruffShade, tip: V.ruff, curl: -0.4, segs: 1, morph: flare(at, dir, [0, 1, 0], 0.5) });
        }
      }
    }
    // The mantle: broad ragged scapulars over the hump and down the back, lifting on the display. (The coat proper is
    // the wings: their long secondaries hang like a ragged coat and swing open on a cast.)
    shingle(k, torso, {
      t: [0.2, 0.62], a: [Math.PI * 0.12, Math.PI * 0.88], rows: 3, cols: 5, len: 0.4 * s, wid: 0.22 * s, cell: CARD.ragged,
      toward: [0, -0.6, -1], lift: 0.1, seed: 9,
      paint: (_t, a) => mix(V.black, V.brown, 0.35 + 0.4 * jitter(Math.round(a * 10), 3)),
      morph: (_t, _a, at, dir, n) => flare(at, dir, n, 0.45),
    }, d);
    // Gear: a bandolier of bone shells across the chest, a satchel on the hip, and a flock-colour kerchief under the
    // ruff with its tails down the back.
    sash(k, torso, 0.62, 0.22, Math.PI * 0.3, { width: 0.07 * s, thick: 0.014 * s, hex: GEAR.leatherDark, finish: LEATHER }, d);
    if (d.level < 2) {
      for (let i = 0; i < 7; i++) {
        const p = torso.at(0.62 + 0.22 * Math.cos(-0.35 - i * 0.1), Math.PI * 0.3 - 0.35 - i * 0.1, 0.03 * s);
        lathe(k, [[0.012 * s, 0.025 * s], [0.014 * s, 0], [0.012 * s, -0.025 * s]], { at: [p.p.x, p.p.y, p.p.z], rot: [Math.PI / 2, 0, 0], seg: 6, paint: V.bone, finish: { gloss: 0.4 } });
      }
    }
    pouch(k, torso.at(0.55, Math.PI * 1.15, 0), [0.13 * s, 0.15 * s, 0.07 * s], GEAR.leather, d);
    band(k, neck, 0.15, { width: 0.06 * s, thick: 0.016 * s, hex: team.primary, stitch: team.light, finish: { gloss: 0.3 } }, d);
    if (d.level < 3) {
      for (const x of [1, -1]) {
        const knot = neck.at(0.15, -Math.PI / 2 + x * 0.3, 0.02 * s);
        k.card({ at: [knot.p.x, knot.p.y, knot.p.z], dir: norm([x * 0.3, -1, -0.5]), face: [knot.n.x, knot.n.y, knot.n.z], len: 0.32 * s, wid: 0.07 * s, cell: CARD.cloth, root: team.primary, tip: team.dark, curl: -0.3, sweep: x * 0.25, segs: 3 });
      }
    }
  };

  const head = (k: Sculpt): void => {
    // Bald, wrinkled skin: redder at the face and throat, paler on the crown, with a few wisps of down.
    const skull = ovoid(k, [0, 0.005 * s, 0.01 * s], [hr * 1.04, hr * 1.04, hr * 1.34], {
      n: d.n(14, 4), seg: d.n(20, 6), egg: -0.12, finish: SKIN,
      paint: (t, a) => mix(V.skinDark, V.skin, 0.55 + 0.35 * Math.sin(a) * (1 - t) + 0.15 * Math.sin(t * 38) * (d.level === 0 ? 1 : 0)),
    });
    k.loft([{ c: [0, -hr * 0.3, -0.01 * s], w: hr * 0.75, up: hr * 0.75 }, { c: [0, -hr * 0.85, 0.01 * s], w: 0.068 * s, up: 0.068 * s }, { c: [0, -hr * 1.35, 0.02 * s], w: 0.064 * s, up: 0.064 * s }], { n: d.level < 2 ? 4 : 3, seg: d.n(14, 4), ref: [0, 0, 1], paint: V.skinDark, finish: SKIN });
    if (d.level < 2) shingle(k, skull, { t: [0.2, 0.55], a: [Math.PI * 0.3, Math.PI * 0.7], rows: 2, cols: 3, len: 0.05 * s, wid: 0.05 * s, cell: CARD.down, paint: V.ruffShade, lift: 0.5, seed: 4 }, d);
    for (const x of [1, -1]) {
      eye(k, [x * hr * 0.72, hr * 0.2, hr * 0.56], [x * 0.72, 0.08, 0.68], { r: hr * 0.24, iris: V.iris, ring: V.skinDark, lid: V.skinDark, ringW: hr * 0.06 }, d);
      // A heavy brow over each eye gives the scowl.
      if (d.level < 2) ovoid(k, [x * hr * 0.66, hr * 0.48, hr * 0.62], [hr * 0.26, hr * 0.09, hr * 0.32], { n: 5, seg: 8, rot: [0.15, x * 0.5, x * -0.25], paint: V.skinDark, finish: SKIN });
    }
    beak(k, {
      at: [0, -hr * 0.06, hr * 1.12], len: hr * 1.5, w: hr * 0.32, up: hr * 0.5, dn: hr * 0.24, curve: hr * 0.24, hook: hr * 0.28,
      base: V.cere, tip: V.hook, bands: [[0, V.cere], [0.28, V.bill], [0.84, V.hook]], open: 0.34,
    }, d);
  };

  const tail = (k: Sculpt): void => {
    tailFan(k, { count: 12, len: 0.42 * s, wid: 0.1 * s, spread: 1.1, droop: 0.55, root: V.black, tip: shade(V.black, 1.2), cell: CARD.ragged }, d);
  };

  return {
    body, head, tail,
    wing: wingsOf(wing, d),
    leg: legsOf(leg, d),
    gun: vultureGun(s, d),
    pivot: {
      wingL: [R * 0.75, 1.48 * s, -0.24 * s], wingR: [-R * 0.75, 1.48 * s, -0.24 * s],
      legL: [R * 0.38, legLen, -0.06 * s], legR: [-R * 0.38, legLen, -0.06 * s],
      tail: [0, 1.0 * s, -0.62 * s],
    },
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
// Swift: a tiny sooty body under two long sickle wings swept back past a deeply forked tail, a pale throat, big dark
// eyes under a scowling brow, flight goggles and a long flock-colour scarf streaming behind. Mobility skirmisher: a
// crescent-bladed SMG with a curved horn magazine.

const SWIFT = {
  soot: 0x3b3532,
  brown: 0x51463e,
  pale: 0xddd5c8,
  tip: 0x1c1a19,
  bill: 0x1a1816,
  leg: 0x4e4440,
  claw: 0x1a1614,
  iris: 0x2a1a10,
  horn: 0xcdb98e,
  lens: 0x6fa8c8,
} as const;

export function swift(plan: BodyPlan, team: TeamColours, d: Detail): SculptedSpec {
  const H = plan.height;
  const R = plan.radius;
  const hr = plan.head.radius;
  const hc = plan.head.centre.up;
  const s = H / 1.5;
  const W = SWIFT;
  const legLen = H * 0.21;
  const leg: LegStyle = {
    skin: W.leg, claw: W.claw, thick: 0.02 * s, thigh: W.soot, fringe: 0.45,
    toes: [{ yaw: -0.55, len: 0.07 * s }, { yaw: -0.18, len: 0.08 * s }, { yaw: 0.18, len: 0.08 * s }, { yaw: 0.55, len: 0.07 * s }],
    clawLen: 0.03 * s,
  };
  const wing: WingStyle = {
    covert: W.brown, secondary: W.soot, primary: W.soot, primaryTip: W.tip, trim: team.primary,
    thick: 0.03 * s, chord: 0.26 * s, primaries: 7, secondaries: 6, primaryLen: 1.35, cell: CARD.primary, secondaryLen: 0.9,
    sweep: 0.6, splay: 0.25, primaryPitch: -1.0, fan: 0.03, displayFlare: 0.7,
  };

  const body = (k: Sculpt): void => {
    // A small upright torpedo of a body (lofted bottom to top; the cross-section's "up" is the front).
    const torso = k.loft(
      [
        { c: [0, 0.28 * s, -0.14 * s], w: 0, up: 0 },
        { c: [0, 0.38 * s, -0.11 * s], w: 0.13 * s, up: 0.12 * s, dn: 0.13 * s },
        { c: [0, 0.6 * s, -0.04 * s], w: 0.21 * s, up: 0.2 * s, dn: 0.19 * s },
        { c: [0, 0.84 * s, 0], w: 0.2 * s, up: 0.19 * s, dn: 0.17 * s },
        { c: [0, 1.04 * s, 0.02 * s], w: 0.15 * s, up: 0.14 * s, dn: 0.13 * s },
        { c: [0, hc - 0.1 * s, 0.01 * s], w: 0.11 * s, up: 0.11 * s, dn: 0.11 * s },
      ],
      { n: d.n(14, 4), seg: d.n(20, 5), ref: [0, 0, 1], paint: (t, a) => (t > 0.78 && Math.sin(a) > 0.35 ? W.pale : mix(W.soot, W.brown, 0.3 + 0.3 * Math.sin(a))), finish: { ...FEATHER, size: 0.1 } },
    );
    shingle(k, torso, { t: [0.2, 0.75], a: [-Math.PI * 0.1, Math.PI * 1.1], rows: 3, cols: 6, len: 0.08 * s, wid: 0.07 * s, paint: (_t, a) => mix(W.soot, W.brown, Math.sin(a)), lift: 0.15, flow: -1, seed: 6 }, d);
    // Gear: a slim harness with a magazine pouch, and the flock-colour scarf streaming back from the neck.
    sash(k, torso, 0.6, 0.18, Math.PI * 0.65, { width: 0.04 * s, thick: 0.01 * s, hex: GEAR.leather, finish: LEATHER }, d);
    pouch(k, torso.at(0.55, Math.PI * 0.62, 0), [0.07 * s, 0.09 * s, 0.045 * s], GEAR.leatherDark, d);
    band(k, torso, 0.9, { width: 0.07 * s, thick: 0.018 * s, hex: team.primary, stitch: team.light, finish: { gloss: 0.3 } }, d);
    if (d.level < 3) {
      for (const x of [1, -1]) {
        const knot = torso.at(0.9, -Math.PI / 2 + x * 0.35, 0.02 * s);
        k.card({ at: [knot.p.x, knot.p.y, knot.p.z], dir: norm([x * 0.35, -0.35, -1]), face: [0, 1, 0], len: (x > 0 ? 0.62 : 0.5) * s, wid: 0.07 * s, cell: CARD.cloth, root: team.primary, tip: team.dark, curl: -0.4, sweep: x * 0.35, segs: d.level === 0 ? 4 : 2 });
      }
    }
  };

  const head = (k: Sculpt): void => {
    const skull = ovoid(k, [0, 0.01 * s, 0], [hr * 1.1, hr * 1.05, hr * 1.14], {
      n: d.n(14, 4), seg: d.n(22, 6), egg: 0.1, finish: { ...FEATHER, size: 0.07 },
      paint: (t, a) => (t > 0.62 && Math.sin(a) < -0.35 ? W.pale : mix(W.soot, W.brown, 0.4)),
    });
    k.loft([{ c: [0, -hr * 0.3, -0.01 * s], w: hr * 0.8, up: hr * 0.8 }, { c: [0, -hr * 1.1, 0.01 * s], w: 0.1 * s, up: 0.1 * s }], { seg: d.n(14, 4), ref: [0, 0, 1], paint: W.soot, finish: FEATHER });
    for (const x of [1, -1]) {
      eye(k, [x * hr * 0.62, hr * 0.06, hr * 0.68], [x * 0.55, 0.02, 0.83], { r: hr * 0.3, iris: W.iris, ring: W.soot, lid: W.brown, ringW: hr * 0.05 }, d);
      // The pale eyebrow and the scowling brow feathers.
      if (d.level < 2) ovoid(k, [x * hr * 0.58, hr * 0.42, hr * 0.7], [hr * 0.3, hr * 0.07, hr * 0.22], { n: 5, seg: 8, rot: [0.2, x * 0.55, x * -0.35], paint: W.pale, finish: FEATHER });
    }
    beak(k, { at: [0, -hr * 0.12, hr * 1.05], len: hr * 0.36, w: hr * 0.3, up: hr * 0.13, dn: hr * 0.09, curve: hr * 0.04, hook: hr * 0.02, base: W.bill, tip: W.bill, gape: 1.5, open: 0.4 }, d);
    // Flight goggles pushed up on the brow, on a leather strap.
    if (d.level < 3) {
      band(k, skull, 0.55, { width: 0.022 * s, thick: 0.008 * s, hex: GEAR.leatherDark, finish: LEATHER }, d);
      for (const x of [1, -1]) {
        const at: V3 = [x * hr * 0.42, hr * 0.78, hr * 0.42];
        ring(k, at, hr * 0.25, hr * 0.06, d, GEAR.brass, undefined, [-0.9, x * 0.45, 0]);
        bead(k, at, hr * 0.22, W.lens, 0.15, d, [1, 1, 0.45]);
      }
    }
  };

  const tail = (k: Sculpt): void => {
    tailFan(k, { count: 8, len: 0.3 * s, wid: 0.06 * s, spread: 0.75, droop: 0.45, fork: 1.1, root: W.soot, tip: W.tip, cell: CARD.sickle }, d);
  };

  return {
    body, head, tail,
    wing: wingsOf(wing, d),
    leg: legsOf(leg, d),
    gun: swiftGun(s, d),
    pivot: {
      wingL: [R * 0.72, 1.02 * s, -0.02 * s], wingR: [-R * 0.72, 1.02 * s, -0.02 * s],
      legL: [R * 0.38, legLen, -0.03 * s], legR: [-R * 0.38, legLen, -0.03 * s],
      tail: [0, 0.38 * s, -0.12 * s],
    },
    legLen, legThick: leg.thick, wingLen: H * 0.4,
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
  const R = plan.radius;
  const hr = plan.head.radius;
  const hc = plan.head.centre.up;
  const s = H / 1.3;
  const M = HUMMER;
  const IRIS = { ...FEATHER, size: 0.08, iri: 1 } as const;
  const legLen = H * 0.13;
  const leg: LegStyle = {
    skin: M.leg, claw: M.bill, thick: 0.016 * s, thigh: M.belly, fringe: 0.6, fringeCell: CARD.down,
    toes: [{ yaw: -0.4, len: 0.05 * s }, { yaw: 0, len: 0.06 * s }, { yaw: 0.4, len: 0.05 * s }, { yaw: Math.PI, len: 0.035 * s }],
    clawLen: 0.022 * s,
  };
  const wing: WingStyle = {
    covert: M.green, secondary: M.greenDeep, primary: M.greenDeep, trim: team.primary,
    thick: 0.022 * s, chord: 0.13 * s, primaries: 4, secondaries: 4, primaryLen: 0.4, finish: { iri: 1 },
  };

  const body = (k: Sculpt): void => {
    const torso = k.loft(
      [
        { c: [0, 0.1 * s, -0.12 * s], w: 0, up: 0 },
        { c: [0, 0.2 * s, -0.1 * s], w: 0.15 * s, up: 0.14 * s, dn: 0.15 * s },
        { c: [0, 0.48 * s, -0.03 * s], w: 0.23 * s, up: 0.22 * s, dn: 0.21 * s },
        { c: [0, 0.76 * s, 0], w: 0.22 * s, up: 0.21 * s, dn: 0.19 * s },
        { c: [0, 0.96 * s, 0.02 * s], w: 0.16 * s, up: 0.16 * s, dn: 0.14 * s },
        { c: [0, hc - 0.08 * s, 0.01 * s], w: 0.11 * s, up: 0.11 * s, dn: 0.11 * s },
      ],
      {
        n: d.n(14, 4), seg: d.n(20, 5), ref: [0, 0, 1], finish: IRIS,
        paint: (t, a) => (Math.sin(a) > 0.2 ? (t > 0.78 ? M.ruby : t > 0.3 ? M.belly : mix(M.belly, M.green, 0.5)) : mix(M.greenDeep, M.green, 0.5 + 0.5 * Math.cos(a) ** 2)),
      },
    );
    // The gorget: ruby scale-feathers that flare out and catch the light on the display.
    shingle(k, torso, {
      t: [0.76, 0.94], a: [Math.PI * 0.15, Math.PI * 0.85], rows: 3, cols: 6, len: 0.07 * s, wid: 0.065 * s, paint: (t) => mix(M.rubyDeep, M.ruby, t), lift: 0.2, seed: 2,
      finish: { iri: 1, glow: 0.12 }, morph: (_t, _a, at, dir, n) => flare(at, dir, n, 0.7),
    }, d);
    shingle(k, torso, { t: [0.3, 0.75], a: [-Math.PI * 0.2, -Math.PI * 0.8], rows: 3, cols: 5, len: 0.08 * s, wid: 0.07 * s, paint: (_t, a) => mix(M.green, M.gold, 0.3 * Math.abs(Math.cos(a))), lift: 0.15, seed: 5, finish: { iri: 1 } }, d);
    // The wings, beating: two shimmering blur discs at each shoulder (cut-out fans, iridescent).
    for (const x of [1, -1]) {
      const at: V3 = [x * 0.17 * s, 0.86 * s, -0.06 * s];
      const fans = d.level >= 3 ? 1 : 2;
      for (let i = 0; i < fans; i++) {
        const up = i === 0 ? 1 : -1;
        k.card({ at, dir: norm([x * 0.25, up * 0.55, -0.8]), face: [x, 0, 0.25], len: 0.46 * s, wid: 0.92 * s, cell: CARD.blur, vSpan: 0.5, root: shade(M.green, 1.3), tip: 0xd8f0e0, segs: 1, finish: { iri: 1, glow: 0.18 } });
      }
    }
    // Gear: a bandolier of glowing nectar vials and the flock-colour sash.
    sash(k, torso, 0.62, 0.2, Math.PI * 0.25, { width: 0.045 * s, thick: 0.01 * s, hex: team.primary, stitch: team.light, finish: { gloss: 0.3 } }, d);
    if (d.level < 2) {
      for (let i = 0; i < 4; i++) {
        const u = 0.35 + i * 0.1;
        const p = torso.at(0.62 + 0.2 * Math.cos(-u * 2), Math.PI * 0.25 - u * 2, 0.025 * s);
        bead(k, [p.p.x, p.p.y, p.p.z], 0.016 * s, M.nectar, 0.55, d, [0.8, 1.6, 0.8]);
        stud(k, [p.p.x, p.p.y + 0.028 * s, p.p.z], 0.01 * s);
      }
    }
    pouch(k, torso.at(0.45, Math.PI * 1.1, 0), [0.06 * s, 0.07 * s, 0.04 * s], GEAR.leather, d);
  };

  const head = (k: Sculpt): void => {
    const skull = ovoid(k, [0, 0.005 * s, 0], [hr * 1.14, hr * 1.1, hr * 1.16], {
      n: d.n(14, 4), seg: d.n(22, 6), egg: 0.1, finish: IRIS,
      paint: (t, a) => (t > 0.66 && Math.sin(a) < -0.45 ? M.ruby : t > 0.42 && t < 0.56 && Math.abs(Math.sin(a)) < 0.25 ? 0xf2f2ea : M.green),
    });
    k.loft([{ c: [0, -hr * 0.3, 0], w: hr * 0.85, up: hr * 0.85 }, { c: [0, -hr * 1.1, 0.01 * s], w: 0.1 * s, up: 0.1 * s }], { seg: d.n(14, 4), ref: [0, 0, 1], paint: M.green, finish: IRIS });
    for (const x of [1, -1]) eye(k, [x * hr * 0.66, hr * 0.14, hr * 0.62], [x * 0.62, 0.05, 0.78], { r: hr * 0.3, iris: M.iris, ring: M.greenDeep, lid: M.green, ringW: hr * 0.05 }, d);
    // The needle bill, as long as the body, slightly down-curved.
    beak(k, { at: [0, -hr * 0.1, hr * 1.02], len: H * 0.42, w: hr * 0.12, up: hr * 0.1, dn: hr * 0.07, curve: H * 0.025, base: M.bill, tip: M.bill, lowerLen: 0.96, open: 0.12 }, d);
    // A flock-colour headband knotted at the back.
    band(k, skull, 0.5, { width: 0.03 * s, thick: 0.01 * s, hex: team.primary, stitch: team.light, finish: { gloss: 0.3 } }, d);
    if (d.level < 3) {
      for (const x of [1, -1]) {
        const knot = skull.at(0.12, Math.PI / 2 + x * 0.25, 0.01 * s);
        k.card({ at: [knot.p.x, knot.p.y, knot.p.z], dir: norm([x * 0.35, -0.3, -1]), face: [0, 1, 0], len: 0.18 * s, wid: 0.04 * s, cell: CARD.cloth, root: team.primary, tip: team.dark, curl: -0.3, sweep: x * 0.3, segs: 2 });
      }
    }
  };

  const tail = (k: Sculpt): void => {
    tailFan(k, { count: 8, len: 0.26 * s, wid: 0.07 * s, spread: 1.0, droop: 0.95, root: M.tail, tip: shade(M.tail, 0.6), cell: CARD.tail, finish: { iri: 0.6 } }, d);
  };

  return {
    body, head, tail,
    wing: wingsOf(wing, d),
    leg: legsOf(leg, d),
    gun: hummingbirdGun(s, d),
    pivot: {
      wingL: [R * 0.7, 0.86 * s, -0.02 * s], wingR: [-R * 0.7, 0.86 * s, -0.02 * s],
      legL: [R * 0.32, legLen, 0], legR: [-R * 0.32, legLen, 0],
      tail: [0, 0.2 * s, -0.12 * s],
    },
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
