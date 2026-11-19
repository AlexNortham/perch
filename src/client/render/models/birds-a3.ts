/* eslint-disable @typescript-eslint/no-magic-numbers -- authored birds: the numbers are the sculpture */
/**
 * Batch A3 birds, sculpted to the style guide (§8; GDD §9.13 to §9.16): Peacock, Vulture, Swift and Hummingbird.
 * Every size comes from the BodyPlan at runtime (head about the head hitbox centre, body inside the capsule, the gun's
 * tip at the muzzle); only fractions and authored offsets are written here.
 */
import { Matrix4, Vector3 } from 'three';
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import type { TeamColours } from '../palette';
import { add, beak, eye, foot, mul, norm, ovoid, shin, shingle, tailFan, thigh, wingArm, wingHand } from './anatomy';
import type { LegStyle, WingStyle } from './anatomy';
import { CARD } from './feathers';
import { bead, block, BRASS, buckle, carve, GEAR, lathe, plume, pouch, ring, sash, strap, WOOD } from './gear';
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
      } else foot(k, ankle, leg, d);
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

export const A3_BUILDS = { peacock } as const;
