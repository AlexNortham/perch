/* eslint-disable @typescript-eslint/no-magic-numbers -- authored birds: the numbers are the sculpture */
/**
 * Batch B2 birds, sculpted to the style guide (§8; GDD §9.17 to §9.20): Cassowary, Toucan, Woodpecker and Nightjar.
 * Every size comes from the BodyPlan at runtime (head about the head hitbox centre, body inside the capsule, the gun's
 * tip at the muzzle); only fractions and authored offsets are written here.
 */
import { ExtrudeGeometry, Matrix4, Shape } from 'three';
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import type { TeamColours } from '../palette';
import { beak, eye, FEATHER, flare, legsOf, norm, ovoid, shingle, SKIN, tailFan, wingsOf } from './anatomy';
import type { LegStyle, WingStyle } from './anatomy';
import { CARD, TILE } from './feathers';
import { band, bead, block, BRASS, buckle, carve, GEAR, LEATHER, lathe, pouch, ring, sash, scope, stud, WOOD } from './gear';
import type { Detail, SculptedSpec } from './sculpted';
import { hinge, jitter, mix, shade } from './sculpt';
import type { Ring, Sculpt, V3 } from './sculpt';

// =================================================================================================================
// Cassowary: the tallest hero, a black haystack of hair-like plumage on thick scaly legs, the inner toe a dagger, a
// bright blue bare neck with two red wattles, and a tall horn casque like a helmet. The plumage bristles on a cast.
// Tank: a short, wide brass-belled blunderbuss with a gourd seed hopper.

const CASSO = {
  black: 0x17161a,
  sheen: 0x2a2a3a,
  blue: 0x2f6fd8,
  teal: 0x28b0c8,
  nape: 0xb02a4a,
  wattle: 0xd2203a,
  casque: 0x8c8574,
  casqueDark: 0x5e584c,
  leg: 0x6f7563,
  claw: 0x2a2826,
  iris: 0x9a3a1a,
  bill: 0x1f1d1c,
  gourd: 0xb4823e,
  tassel: 0xb4202e,
} as const;

export function cassowary(plan: BodyPlan, team: TeamColours, d: Detail): SculptedSpec {
  const H = plan.height;
  const R = plan.radius;
  const hr = plan.head.radius;
  const hc = plan.head.centre.up;
  const s = H / 2.4;
  const C = CASSO;
  const legLen = H * 0.37;
  const leg: LegStyle = {
    skin: C.leg, claw: C.claw, thick: 0.05 * s, thigh: C.black, fringe: 0.75, fringeCell: CARD.hair,
    // Three toes; the inner one (authored for the left foot, toward -x) carries the dagger claw.
    toes: [{ yaw: -0.42, len: 0.15 * s, claw: 0.13 * s, r: 0.03 * s }, { yaw: 0.02, len: 0.19 * s }, { yaw: 0.45, len: 0.15 * s }],
    clawLen: 0.045 * s,
  };
  const wing: WingStyle = {
    covert: C.black, secondary: C.black, primary: C.black, primaryTip: shade(C.black, 1.6), trim: team.primary,
    thick: 0.045 * s, chord: 0.2 * s, primaries: 5, secondaries: 4, primaryLen: 0.6, cell: CARD.quill, secondaryCell: CARD.hair, secondaryLen: 1.6,
  };

  const body = (k: Sculpt): void => {
    const torso = k.loft(
      [
        { c: [0, 1.28 * s, -0.64 * s], w: 0, up: 0 },
        { c: [0, 1.26 * s, -0.52 * s], w: 0.32 * s, up: 0.32 * s, dn: 0.32 * s },
        { c: [0, 1.3 * s, -0.27 * s], w: 0.46 * s, up: 0.48 * s, dn: 0.5 * s },
        { c: [0, 1.34 * s, 0], w: 0.46 * s, up: 0.46 * s, dn: 0.5 * s },
        { c: [0, 1.44 * s, 0.2 * s], w: 0.36 * s, up: 0.34 * s, dn: 0.42 * s },
        { c: [0, 1.56 * s, 0.31 * s], w: 0, up: 0 },
      ],
      { n: d.n(14, 5), seg: d.n(22, 5), paint: C.black, finish: { tile: TILE.wood, size: 0.3, iri: 0.25 }, uvSwap: true },
    );
    // The haystack: long hair-like plumes drooping all over, bristling out on the display.
    shingle(k, torso, {
      t: [0.04, 0.96], a: [0, Math.PI * 2], rows: 7, cols: 14, len: 0.7 * s, wid: 0.26 * s, cell: CARD.hair, toward: [0, -1, -0.3], lift: 0.34, seed: 13,
      paint: (_t, a) => mix(C.black, C.sheen, 0.5 * jitter(Math.round(a * 20), 7)), finish: { iri: 0.3 },
      morph: (_t, _a, at, dir, n) => flare(at, dir, n, 0.55),
    }, d);
    // The bare neck: blue at the front, turquoise at the sides, red on the nape.
    const neck = k.loft(
      [
        { c: [0, 1.6 * s, 0.16 * s], w: 0.13 * s, up: 0.13 * s },
        { c: [0, 1.86 * s, 0.13 * s], w: 0.09 * s, up: 0.095 * s },
        { c: [0, 2.04 * s, 0.05 * s], w: 0.075 * s, up: 0.08 * s },
        { c: [0, hc - 0.09 * s, 0.01 * s], w: 0.08 * s, up: 0.08 * s },
      ],
      { n: d.n(10, 3), seg: d.n(16, 3), ref: [0, 0, 1], paint: (_t, a) => (Math.sin(a) < -0.45 ? C.nape : mix(C.teal, C.blue, Math.max(0, Math.sin(a)))), finish: SKIN },
    );
    // Two red wattles hanging at the throat.
    if (d.level < 3) {
      for (const x of [1, -1]) {
        const w = neck.at(0.5, Math.PI / 2 + x * 0.35, 0.01 * s);
        ovoid(k, [w.p.x, w.p.y - 0.05 * s, w.p.z + 0.02 * s], [0.028 * s, 0.07 * s, 0.03 * s], { n: d.n(7, 3), seg: d.n(10, 4), paint: (t) => mix(C.wattle, shade(C.wattle, 0.75), t), finish: SKIN, rot: [Math.PI / 2 - 0.2, 0, x * 0.15] });
      }
    }
    // Gear (worn over the plumage): a heavy cross harness with brass buckles and seed shells, and a broad flock sash.
    const over = 0.07 * s;
    sash(k, torso, 0.55, 0.28, Math.PI * 0.28, { width: 0.07 * s, thick: 0.016 * s, hex: GEAR.leatherDark, off: over, finish: LEATHER }, d);
    if (d.level < 3) sash(k, torso, 0.55, 0.28, Math.PI * 0.72, { width: 0.07 * s, thick: 0.016 * s, hex: GEAR.leatherDark, off: over, finish: LEATHER }, d);
    band(k, torso, 0.44, { width: 0.13 * s, thick: 0.02 * s, hex: team.primary, stitch: team.light, off: over, finish: { gloss: 0.3 } }, d);
    buckle(k, torso.at(0.82, Math.PI * 0.5, over + 0.02 * s), 0.07 * s, d);
    if (d.level < 2) {
      for (let i = 0; i < 6; i++) {
        const u = -0.25 - i * 0.09;
        const p = torso.at(0.55 + 0.28 * Math.cos(u), Math.PI * 0.28 + u, over + 0.03 * s);
        lathe(k, [[0.014 * s, 0.03 * s], [0.016 * s, 0], [0.014 * s, -0.03 * s]], { at: [p.p.x, p.p.y, p.p.z], rot: [Math.PI / 2, 0, 0], seg: 6, paint: GEAR.brass, finish: BRASS });
      }
    }
    pouch(k, torso.at(0.4, Math.PI * 1.1, over), [0.16 * s, 0.18 * s, 0.08 * s], GEAR.leather, d);
  };

  const head = (k: Sculpt): void => {
    ovoid(k, [0, 0, 0.01 * s], [hr * 1.04, hr * 1.04, hr * 1.24], { n: d.n(14, 4), seg: d.n(20, 6), egg: 0.08, finish: SKIN, paint: (t, a) => (Math.sin(a) < -0.4 && t < 0.5 ? C.nape : mix(C.blue, C.teal, 0.3 + 0.3 * Math.cos(a) ** 2)) });
    k.loft([{ c: [0, -hr * 0.3, 0], w: hr * 0.8, up: hr * 0.8 }, { c: [0, -hr * 1.2, 0.01 * s], w: 0.08 * s, up: 0.08 * s }], { seg: d.n(14, 4), ref: [0, 0, 1], paint: C.blue, finish: SKIN });
    // The casque: a tall, laterally flattened horn helmet rising from the brow and sweeping back.
    const casque: Ring[] = [
      { c: [0, hr * 0.55, hr * 0.32], w: 0.045 * s, up: 0.1 * s, dn: 0.1 * s },
      { c: [0, hr * 1.15, hr * 0.08], w: 0.042 * s, up: 0.1 * s, dn: 0.1 * s },
      { c: [0, hr * 1.65, -hr * 0.22], w: 0.03 * s, up: 0.07 * s, dn: 0.08 * s },
      { c: [0, hr * 1.9, -hr * 0.48], w: 0, up: 0, dn: 0 },
    ];
    k.loft(casque, { n: d.n(9, 3), seg: d.n(12, 4), ref: [0, 0, 1], paint: (t, a) => mix(C.casque, C.casqueDark, 0.35 + 0.35 * Math.sin(t * 14) * (d.level < 2 ? 1 : 0) + 0.2 * Math.abs(Math.cos(a))), finish: { gloss: 0.45 } });
    for (const x of [1, -1]) eye(k, [x * hr * 0.72, hr * 0.12, hr * 0.56], [x * 0.75, 0.05, 0.66], { r: hr * 0.24, iris: C.iris, ring: shade(C.blue, 0.7), lid: C.blue, ringW: hr * 0.05 }, d);
    beak(k, { at: [0, -hr * 0.12, hr * 1.12], len: hr * 1.2, w: hr * 0.3, up: hr * 0.34, dn: hr * 0.2, curve: hr * 0.14, hook: hr * 0.05, base: C.bill, tip: shade(C.bill, 1.6), open: 0.36 }, d);
  };

  const tail = (k: Sculpt): void => {
    // No true tail: hair plumes hang over the rump.
    if (d.level >= 3) return;
    tailFan(k, { count: 7, len: 0.42 * s, wid: 0.16 * s, spread: 1.4, droop: 1.15, root: C.black, tip: C.sheen, cell: CARD.hair }, d);
  };

  return {
    body, head, tail,
    wing: wingsOf(wing, d),
    leg: legsOf(leg, d),
    gun: cassowaryGun(s, d),
    pivot: {
      wingL: [R * 0.8, 1.66 * s, 0.05 * s], wingR: [-R * 0.8, 1.66 * s, 0.05 * s],
      legL: [R * 0.36, legLen, -0.02 * s], legR: [-R * 0.36, legLen, -0.02 * s],
      tail: [0, 1.26 * s, -0.56 * s],
    },
    legLen, legThick: leg.thick, wingLen: H * 0.3,
    // Rampage, Dagger Kick, Bristle, Boom Call.
    casts: ['leap', 'stomp', 'raise', 'sweep'],
    sway: 0.07, castTail: -0.2, castWiden: 0.15,
  };
}

/** Wattle Blaster: a wide flared brass bell, a short thick barrel, a gourd seed hopper, a heavy stock with red tassels. */
function cassowaryGun(s: number, d: Detail): SculptedSpec['gun'] {
  const C = CASSO;
  const L = 0.8 * s;
  const r = 0.028 * s;
  return {
    main: [0, -0.08 * s, -L * 0.64],
    support: [0, -0.036 * s, 0],
    slideAt: [0, -0.004 * s, -L * 0.34],
    travel: 0.04 * s,
    build(k, part) {
      if (part === 'slide') {
        if (d.level >= 3) return;
        lathe(k, [[r * 1.1, 0.06 * s], [r * 1.4, 0.05 * s], [r * 1.45, -0.05 * s], [r * 1.1, -0.06 * s]], { seg: d.n(12, 4), paint: GEAR.wood, finish: WOOD });
        return;
      }
      if (part !== 'gun') return;
      // The bell: a wide brass flare, dark inside, with an amber glow deep in the throat.
      lathe(k, [[0.09 * s, 0], [0.072 * s, -0.03 * s], [0.045 * s, -0.08 * s], [r * 1.15, -0.15 * s]], { seg: d.n(18, 5), paint: GEAR.brass, finish: BRASS });
      if (d.level < 3) {
        lathe(k, [[0.083 * s, -0.004 * s], [0.04 * s, -0.06 * s], [0.02 * s, -0.12 * s]], { seg: d.n(14, 5), paint: 0x241a14, finish: {} });
        bead(k, [0, 0, -0.1 * s], 0.02 * s, 0xffb04a, 0.9, d);
        ring(k, [0, 0, -0.006 * s], 0.088 * s, 0.008 * s, d, GEAR.brassDark);
      }
      if (d.level >= 3) {
        lathe(k, [[r * 1.2, -0.12 * s], [r, -L * 0.6], [0.05 * s, -L * 0.75], [0.04 * s, -L]], { seg: 4, paint: GEAR.wood });
        return;
      }
      lathe(k, [[r * 1.2, -0.13 * s], [r * 1.05, -L * 0.4], [r * 1.25, -L * 0.52]], { seg: d.n(14, 5), paint: GEAR.woodDark, finish: WOOD });
      ring(k, [0, 0, -L * 0.24], r * 1.15, r * 0.25, d);
      ring(k, [0, 0, -L * 0.5], r * 1.3, r * 0.25, d);
      // The gourd hopper (the ammo): a dried gourd on a brass neck, corked.
      lathe(k, [[0.012 * s, 0.07 * s], [0.03 * s, 0.05 * s], [0.06 * s, 0.0], [0.05 * s, -0.05 * s], [0.0, -0.075 * s]], { at: [0, 0.075 * s, -L * 0.52], rot: [-Math.PI / 2, 0, 0], seg: d.n(12, 5), paint: (t) => mix(C.gourd, shade(C.gourd, 0.7), t), finish: { gloss: 0.3, tile: TILE.leather, size: 0.06 } });
      lathe(k, [[0.014 * s, 0.02 * s], [0.016 * s, 0], [0.012 * s, -0.02 * s]], { at: [0, 0.12 * s, -L * 0.52], rot: [-Math.PI / 2, 0, 0], seg: 6, paint: GEAR.brass, finish: BRASS });
      block(k, [0.06 * s, 0.075 * s, 0.16 * s], [0, -0.005 * s, -L * 0.62], GEAR.woodDark, WOOD, d);
      carve(k, [[-L * 0.6, -0.035 * s], [-L * 0.67, -0.035 * s], [-L * 0.73, -0.14 * s], [-L * 0.65, -0.145 * s]], 0.04 * s, GEAR.wood, WOOD, d);
      // A heavy carved stock flaring to the butt, with red leather tassels (the wattle motif).
      carve(k, [[-L * 0.68, 0.025 * s], [-L * 0.98, 0.02 * s], [-L * 1.02, -0.1 * s], [-L * 0.96, -0.14 * s], [-L * 0.72, -0.05 * s]], 0.055 * s, GEAR.woodRed, WOOD, d);
      if (d.level < 2) {
        for (const x of [1, -1]) k.card({ at: [x * 0.03 * s, -0.04 * s, -L * 0.8], dir: [x * 0.2, -1, -0.2], face: [x, 0, 0], len: 0.11 * s, wid: 0.03 * s, cell: CARD.cloth, root: C.tassel, tip: shade(C.tassel, 0.7), segs: 1 });
        stud(k, [0.03 * s, -0.04 * s, -L * 0.8], 0.007 * s);
      }
    },
  };
}

// =================================================================================================================
// Toucan: a compact black body with a white bib behind a gigantic banana bill, green to orange to red with a black tip,
// serrated along its edge, and a big blue eye ring. The tail cocks up and the bill gapes on a cast. Long-range poke: a
// slim scoped rifle with a bill-curved fore-end.

const TOUCAN = {
  black: 0x18181c,
  bib: 0xf3f0e6,
  bibEdge: 0xf2d27a,
  green: 0x56b043,
  yellow: 0xf2b028,
  orange: 0xea5a24,
  tip: 0x1a1a1a,
  ring: 0x3ab6e8,
  leg: 0x5a7ab0,
  claw: 0x2a2a30,
  iris: 0x2e3a24,
  lacquer: 0x3a2418,
  fruit: [0xf28a1a, 0xd8262e, 0xf2d23a],
} as const;

export function toucan(plan: BodyPlan, team: TeamColours, d: Detail): SculptedSpec {
  const H = plan.height;
  const R = plan.radius;
  const hr = plan.head.radius;
  const hc = plan.head.centre.up;
  const s = H / 1.7;
  const T = TOUCAN;
  const legLen = H * 0.2;
  const leg: LegStyle = {
    skin: T.leg, claw: T.claw, thick: 0.026 * s, thigh: T.black, fringe: 0.5,
    toes: [{ yaw: -0.32, len: 0.09 * s }, { yaw: 0.32, len: 0.09 * s }, { yaw: Math.PI - 0.38, len: 0.07 * s }, { yaw: Math.PI + 0.38, len: 0.07 * s }],
    clawLen: 0.03 * s,
  };
  const wing: WingStyle = {
    covert: T.black, secondary: T.black, primary: T.black, primaryTip: shade(T.black, 1.5), trim: team.primary,
    thick: 0.032 * s, chord: 0.24 * s, primaries: 8, secondaries: 7, primaryLen: 0.6,
  };

  const body = (k: Sculpt): void => {
    const torso = k.loft(
      [
        { c: [0, 0.3 * s, -0.12 * s], w: 0, up: 0 },
        { c: [0, 0.38 * s, -0.1 * s], w: 0.17 * s, up: 0.16 * s, dn: 0.17 * s },
        { c: [0, 0.62 * s, -0.04 * s], w: 0.26 * s, up: 0.25 * s, dn: 0.24 * s },
        { c: [0, 0.92 * s, 0], w: 0.25 * s, up: 0.24 * s, dn: 0.22 * s },
        { c: [0, 1.18 * s, 0.02 * s], w: 0.19 * s, up: 0.19 * s, dn: 0.17 * s },
        { c: [0, hc - 0.1 * s, 0.02 * s], w: 0.13 * s, up: 0.13 * s, dn: 0.13 * s },
      ],
      {
        n: d.n(14, 4), seg: d.n(22, 5), ref: [0, 0, 1], finish: { ...FEATHER, size: 0.1 },
        paint: (t, a) => (t > 0.62 && Math.sin(a) > 0.15 ? (t < 0.68 ? T.bibEdge : T.bib) : t < 0.14 && Math.sin(a) > 0.2 ? 0xc8202a : T.black),
      },
    );
    shingle(k, torso, { t: [0.62, 0.72], a: [Math.PI * 0.12, Math.PI * 0.88], rows: 2, cols: 7, len: 0.07 * s, wid: 0.07 * s, paint: (t) => mix(T.bibEdge, T.bib, t * 3), lift: 0.25, seed: 4 }, d);
    shingle(k, torso, { t: [0.2, 0.6], a: [-Math.PI * 0.1, -Math.PI * 0.9], rows: 3, cols: 5, len: 0.09 * s, wid: 0.08 * s, paint: T.black, lift: 0.15, seed: 8 }, d);
    // Gear: a flock-colour bandana at the throat, a bandolier of brass cartridges, and a pouch of fruit.
    band(k, torso, 0.86, { width: 0.06 * s, thick: 0.016 * s, hex: team.primary, stitch: team.light, finish: { gloss: 0.3 } }, d);
    if (d.level < 3) {
      const knot = torso.at(0.84, Math.PI / 2, 0.02 * s);
      k.card({ at: [knot.p.x, knot.p.y, knot.p.z], dir: [0, -1, 0.15], face: [0, 0.1, 1], len: 0.16 * s, wid: 0.16 * s, cell: CARD.cloth, root: team.primary, tip: team.dark, segs: 2, curl: -0.15 });
    }
    sash(k, torso, 0.55, 0.22, Math.PI * 0.72, { width: 0.05 * s, thick: 0.012 * s, hex: GEAR.leather, finish: LEATHER }, d);
    if (d.level < 2) {
      for (let i = 0; i < 6; i++) {
        const u = 0.25 + i * 0.1;
        const p = torso.at(0.55 + 0.22 * Math.cos(u), Math.PI * 0.72 + u, 0.025 * s);
        lathe(k, [[0.007 * s, 0.022 * s], [0.008 * s, 0], [0.007 * s, -0.022 * s]], { at: [p.p.x, p.p.y, p.p.z], seg: 6, rot: [0, 0, 0], paint: GEAR.brass, finish: BRASS });
      }
    }
    const hip = torso.at(0.4, Math.PI * 1.1, 0);
    pouch(k, hip, [0.11 * s, 0.11 * s, 0.07 * s], GEAR.leather, d);
    if (d.level < 2) {
      T.fruit.forEach((hex, i) => bead(k, [hip.p.x - 0.03 * s + i * 0.025 * s, hip.p.y + 0.06 * s, hip.p.z + 0.03 * s + i * 0.01 * s], 0.022 * s, hex, 0, d));
    }
  };

  const head = (k: Sculpt): void => {
    ovoid(k, [0, 0.01 * s, 0], [hr * 1.08, hr * 1.06, hr * 1.12], {
      n: d.n(14, 4), seg: d.n(22, 6), egg: 0.08, finish: { ...FEATHER, size: 0.07 },
      paint: (t, a) => (t > 0.45 && Math.sin(a) < 0.05 ? (Math.sin(a) < -0.2 || t > 0.7 ? T.bib : T.bibEdge) : T.black),
    });
    k.loft([{ c: [0, -hr * 0.3, 0], w: hr * 0.8, up: hr * 0.8 }, { c: [0, -hr * 1.1, 0.01 * s], w: 0.13 * s, up: 0.13 * s }], { seg: d.n(14, 4), ref: [0, 0, 1], paint: T.black, finish: FEATHER });
    for (const x of [1, -1]) eye(k, [x * hr * 0.72, hr * 0.22, hr * 0.5], [x * 0.78, 0.08, 0.62], { r: hr * 0.22, iris: T.iris, ring: T.ring, lid: T.ring, ringW: hr * 0.13 }, d);
    // The bill: as long as the body, deep at the base, curving down, serrated, and banded green, yellow, orange, black.
    beak(k, {
      at: [0, -hr * 0.04, hr * 0.96], len: 0.58 * s, w: hr * 0.4, up: hr * 0.78, dn: hr * 0.42, curve: 0.07 * s, hook: 0.02 * s,
      base: T.green, tip: T.tip, bands: [[0, T.green], [0.3, T.yellow], [0.58, T.orange], [0.9, T.tip]], teeth: 10, open: 0.26, displayOpen: 0.5,
    }, d);
  };

  const tail = (k: Sculpt): void => {
    // A long black tail that cocks up on the display.
    tailFan(k, {
      count: 10, len: 0.5 * s, wid: 0.085 * s, spread: 0.5, droop: 0.95, root: T.black, tip: shade(T.black, 1.4), cell: CARD.tail,
      display: (_u, at) => hinge(at, [1, 0, 0], -1.25),
    }, d);
  };

  return {
    body, head, tail,
    wing: wingsOf(wing, d),
    leg: legsOf(leg, d),
    gun: toucanGun(s, d),
    pivot: {
      wingL: [R * 0.75, 1.12 * s, -0.02 * s], wingR: [-R * 0.75, 1.12 * s, -0.02 * s],
      legL: [R * 0.36, legLen, -0.02 * s], legR: [-R * 0.36, legLen, -0.02 * s],
      tail: [0, 0.4 * s, -0.16 * s],
    },
    legLen, legThick: leg.thick, wingLen: H * 0.36,
    // Fruit Lob, Seed Spit, Branch Swing, Fruit Barrage.
    casts: ['throw', 'aim', 'leap', 'throw'],
    sway: 0, castTail: 0, castWiden: 0.2,
  };
}

/** Bill Rifle: a long slim lacquered barrel with brass bands, a brass scope, a bill-curved orange fore-end. */
function toucanGun(s: number, d: Detail): SculptedSpec['gun'] {
  const T = TOUCAN;
  const L = 0.74 * s;
  const r = 0.011 * s;
  return {
    main: [0, -0.055 * s, -L * 0.7],
    support: [0, -0.024 * s, 0],
    slideAt: [0, -0.012 * s, -L * 0.36],
    travel: 0.03 * s,
    build(k, part) {
      if (part === 'slide') {
        if (d.level >= 3) return;
        // The fore-end: a bill-shaped piece curving under the barrel, orange to red.
        const rings: Ring[] = [];
        for (let i = 0; i <= 5; i++) {
          const u = i / 5;
          rings.push({ c: [0, -0.006 * s - Math.sin(u * Math.PI) * 0.008 * s, 0.07 * s - u * 0.15 * s], w: 0.014 * s * (1 - 0.3 * u), up: 0.016 * s, dn: 0.02 * s * (1 - 0.4 * u) });
        }
        k.loft(rings, { seg: d.n(10, 4), paint: (t) => mix(T.orange, T.yellow, t), finish: { gloss: 0.6 } });
        return;
      }
      if (part !== 'gun') return;
      if (d.level >= 3) {
        lathe(k, [[r * 1.5, 0], [r, -L * 0.6], [0.025 * s, -L * 0.72], [0.02 * s, -L]], { seg: 4, paint: T.lacquer });
        return;
      }
      lathe(k, [[r * 1.6, 0], [r * 1.9, -0.012 * s], [r * 1.4, -0.026 * s]], { seg: d.n(12, 4), paint: GEAR.brass, finish: BRASS });
      bead(k, [0, 0, -0.006 * s], r * 0.95, 0xd8f05a, 0.85, d);
      lathe(k, [[r * 1.05, -0.022 * s], [r, -L * 0.3], [r * 1.15, -L * 0.6], [r * 1.5, -L * 0.62]], { seg: d.n(10, 4), paint: T.lacquer, finish: WOOD });
      for (const z of [0.12, 0.22, 0.5]) ring(k, [0, 0, -L * z], r * 1.15, r * 0.3, d);
      scope(k, [0, 0.032 * s, -L * 0.6], 0.17 * s, 0.013 * s, d);
      block(k, [0.032 * s, 0.05 * s, 0.12 * s], [0, -0.004 * s, -L * 0.68], T.lacquer, WOOD, d);
      carve(k, [[-L * 0.66, -0.024 * s], [-L * 0.72, -0.024 * s], [-L * 0.78, -0.1 * s], [-L * 0.7, -0.104 * s]], 0.026 * s, GEAR.wood, WOOD, d);
      carve(k, [[-L * 0.74, 0.018 * s], [-L * 0.86, 0.03 * s], [-L, 0.02 * s], [-L * 1.02, -0.07 * s], [-L * 0.96, -0.075 * s], [-L * 0.76, -0.03 * s]], 0.03 * s, T.lacquer, WOOD, d);
      if (d.level < 2) {
        // A row of brass cartridges along the stock (the ammo read).
        for (let i = 0; i < 5; i++) lathe(k, [[0.005 * s, 0.016 * s], [0.006 * s, 0], [0.005 * s, -0.016 * s]], { at: [0.019 * s, -0.012 * s, -L * (0.8 + i * 0.04)], seg: 5, paint: GEAR.brass, finish: BRASS });
      }
    },
  };
}

// =================================================================================================================
// Woodpecker: upright, leaning on a stiff spiky prop tail, a straight chisel bill, a bright red crown and nape crest
// that rises on a cast, a black-and-white barred back and white face stripes, ear muffs against its own drumming.
// Gun carry: a spinning drill-barrel cluster fed from a brass seed drum.

const WOODPECKER = {
  black: 0x17171a,
  white: 0xf2f0ea,
  buff: 0xe6dcc6,
  red: 0xd8202a,
  bill: 0x3a3a3e,
  billTip: 0x6a6a70,
  leg: 0x6a6e72,
  claw: 0x222226,
  iris: 0x6a1e1a,
} as const;

export function woodpecker(plan: BodyPlan, team: TeamColours, d: Detail): SculptedSpec {
  const H = plan.height;
  const R = plan.radius;
  const hr = plan.head.radius;
  const hc = plan.head.centre.up;
  const s = H / 1.75;
  const P = WOODPECKER;
  const legLen = H * 0.22;
  const leg: LegStyle = {
    skin: P.leg, claw: P.claw, thick: 0.025 * s, thigh: P.buff, fringe: 0.45,
    toes: [{ yaw: -0.3, len: 0.085 * s }, { yaw: 0.3, len: 0.085 * s }, { yaw: Math.PI - 0.35, len: 0.075 * s }, { yaw: Math.PI + 0.35, len: 0.07 * s }],
    clawLen: 0.036 * s,
  };
  const wing: WingStyle = {
    covert: P.black, secondary: P.white, primary: P.white, primaryTip: shade(P.white, 0.85), trim: team.primary,
    thick: 0.03 * s, chord: 0.24 * s, primaries: 8, secondaries: 7, primaryLen: 0.6, cell: CARD.barred, secondaryCell: CARD.barred,
  };

  const body = (k: Sculpt): void => {
    // Upright and leaning back a little onto the tail.
    const torso = k.loft(
      [
        { c: [0, 0.3 * s, -0.17 * s], w: 0, up: 0 },
        { c: [0, 0.38 * s, -0.15 * s], w: 0.15 * s, up: 0.15 * s, dn: 0.16 * s },
        { c: [0, 0.62 * s, -0.08 * s], w: 0.24 * s, up: 0.24 * s, dn: 0.23 * s },
        { c: [0, 0.94 * s, -0.03 * s], w: 0.24 * s, up: 0.23 * s, dn: 0.22 * s },
        { c: [0, 1.22 * s, 0.01 * s], w: 0.18 * s, up: 0.18 * s, dn: 0.17 * s },
        { c: [0, hc - 0.1 * s, 0.01 * s], w: 0.12 * s, up: 0.12 * s, dn: 0.12 * s },
      ],
      { n: d.n(14, 4), seg: d.n(22, 5), ref: [0, 0, 1], finish: { ...FEATHER, size: 0.1 }, paint: (_t, a) => (Math.sin(a) > -0.15 ? P.buff : P.black) },
    );
    // The barred back: ladder-barred cards over the mantle.
    shingle(k, torso, { t: [0.25, 0.85], a: [-Math.PI * 0.12, -Math.PI * 0.88], rows: 4, cols: 5, len: 0.12 * s, wid: 0.1 * s, cell: CARD.barred, paint: P.white, lift: 0.12, seed: 3 }, d);
    // Gear: a flock-colour climbing harness (two straps crossing the chest) with brass rings, and a tool belt of bits.
    sash(k, torso, 0.68, 0.16, Math.PI * 0.3, { width: 0.05 * s, thick: 0.012 * s, hex: team.primary, stitch: team.light, finish: { tile: TILE.weave, size: 0.04 } }, d);
    sash(k, torso, 0.68, 0.16, Math.PI * 0.7, { width: 0.05 * s, thick: 0.012 * s, hex: team.primary, stitch: team.light, finish: { tile: TILE.weave, size: 0.04 } }, d);
    if (d.level < 2) {
      const front = torso.at(0.66, Math.PI / 2, 0.025 * s);
      ring(k, [front.p.x, front.p.y, front.p.z], 0.024 * s, 0.005 * s, d, GEAR.brass, undefined, [0, 0, 0]);
    }
    band(k, torso, 0.3, { width: 0.06 * s, thick: 0.016 * s, hex: GEAR.leather, finish: LEATHER }, d);
    if (d.level < 2) {
      for (let i = 0; i < 4; i++) {
        const p = torso.at(0.3, Math.PI * (0.25 + i * 0.17), 0.02 * s);
        k.loft([{ c: [p.p.x, p.p.y + 0.03 * s, p.p.z], w: 0.009 * s, up: 0.009 * s }, { c: [p.p.x, p.p.y - 0.05 * s, p.p.z], w: 0, up: 0 }], { seg: 5, paint: GEAR.iron, finish: { gloss: 0.7 } });
      }
    }
    buckle(k, torso.at(0.3, Math.PI / 2, 0.025 * s), 0.045 * s, d);
  };

  const head = (k: Sculpt): void => {
    // Red crown, black mask through the eye, white stripes above and below it, black whisker stripe.
    const skull = ovoid(k, [0, 0.01 * s, 0], [hr * 1.06, hr * 1.06, hr * 1.14], {
      n: d.n(14, 4), seg: d.n(22, 6), egg: 0.06, finish: { ...FEATHER, size: 0.07 },
      paint: (t, a) => {
        const up = Math.sin(a);
        if (up > 0.55 && t > 0.2) return P.red;
        if (up > 0.2) return t > 0.55 ? P.white : P.black;
        if (up > -0.15) return P.black;
        if (up > -0.5) return P.white;
        return t > 0.6 ? P.white : P.black;
      },
    });
    k.loft([{ c: [0, -hr * 0.3, 0], w: hr * 0.8, up: hr * 0.8 }, { c: [0, -hr * 1.1, 0.01 * s], w: 0.12 * s, up: 0.12 * s }], { seg: d.n(14, 4), ref: [0, 0, 1], paint: P.black, finish: FEATHER });
    // The nape crest, raised on the display.
    if (d.level < 3) {
      for (let i = 0; i < d.keep(7, 3); i++) {
        const u = (i / Math.max(1, d.keep(7, 3) - 1)) * 2 - 1;
        const at: V3 = [u * hr * 0.35, hr * 0.85, -hr * (0.1 + 0.35 * (1 - Math.abs(u)))];
        const dir = norm([u * 0.3, 0.35, -1]);
        k.card({ at, dir, face: [0, 1, -0.2], len: 0.14 * s, wid: 0.06 * s, cell: CARD.contour, root: P.red, tip: shade(P.red, 1.15), segs: 1, curl: 0.3, morph: { display: hinge(at, [1, 0, 0], -0.9) } });
      }
    }
    for (const x of [1, -1]) eye(k, [x * hr * 0.72, hr * 0.1, hr * 0.56], [x * 0.76, 0.04, 0.65], { r: hr * 0.22, iris: P.iris, ring: P.black, lid: P.black, ringW: hr * 0.04 }, d);
    beak(k, { at: [0, -hr * 0.08, hr * 1.02], len: hr * 1.5, w: hr * 0.24, up: hr * 0.26, dn: hr * 0.19, base: P.bill, tip: P.billTip, open: 0.3 }, d);
    // Ear muffs against its own drumming: brass cups on a band over the crown.
    if (d.level < 3) {
      band(k, skull, 0.38, { width: 0.022 * s, thick: 0.01 * s, hex: GEAR.brassDark, finish: BRASS }, d);
      for (const x of [1, -1]) {
        lathe(k, [[0.0, 0.03 * s], [0.04 * s, 0.022 * s], [0.045 * s, -0.005 * s], [0.04 * s, -0.012 * s]], { at: [x * hr * 0.98, -hr * 0.05, -hr * 0.3], rot: [0, x * Math.PI / 2, 0], seg: d.n(12, 5), paint: (t) => (t > 0.6 ? GEAR.leatherDark : GEAR.brass), finish: BRASS });
      }
    }
  };

  const tail = (k: Sculpt): void => {
    // The prop tail: stiff, spiky feathers reaching down and back to the ground.
    tailFan(k, { count: 8, len: 0.44 * s, wid: 0.07 * s, spread: 0.45, droop: 1.12, root: P.black, tip: shade(P.black, 1.5), cell: CARD.sickle, display: (u, at) => hinge(at, [0, 1, 0], u * 0.35) }, d);
  };

  return {
    body, head, tail,
    wing: wingsOf(wing, d),
    leg: legsOf(leg, d),
    gun: woodpeckerGun(s, d),
    pivot: {
      wingL: [R * 0.75, 1.15 * s, -0.04 * s], wingR: [-R * 0.75, 1.15 * s, -0.04 * s],
      legL: [R * 0.36, legLen, -0.03 * s], legR: [-R * 0.36, legLen, -0.03 * s],
      tail: [0, 0.42 * s, -0.2 * s],
    },
    legLen, legThick: leg.thick, wingLen: H * 0.36,
    // Drumroll, Bore Hole, Tree Cling, Hammerhead.
    casts: ['aim', 'throw', 'leap', 'aim'],
    sway: 0, castTail: -0.15, castWiden: 0.1,
    spinRate: 30,
  };
}

/** Drum Drill: six drill-bit barrels that spin as it fires, a brass seed drum feeding it, a heavy wood stock. */
function woodpeckerGun(s: number, d: Detail): SculptedSpec['gun'] {
  const L = 0.76 * s;
  const ringR = 0.024 * s;
  return {
    main: [0, -0.075 * s, -L * 0.72],
    support: [0, -0.035 * s, 0],
    slideAt: [0, -0.02 * s, -L * 0.48],
    travel: 0.03 * s,
    spinAt: [0, 0, 0],
    build(k, part) {
      if (part === 'spin') {
        // The barrel cluster, turning about the bore axis while it fires.
        const n = d.level >= 2 ? 3 : 6;
        for (let i = 0; i < (d.level >= 3 ? 1 : n); i++) {
          const a = (i / n) * Math.PI * 2;
          const at: V3 = d.level >= 3 ? [0, 0, 0] : [Math.cos(a) * ringR, Math.sin(a) * ringR, 0];
          lathe(k, [[0.002 * s, 0.006 * s], [0.0075 * s, -0.01 * s], [0.0075 * s, -L * 0.4]], { at, seg: d.n(6, 3), paint: (t) => (Math.sin(t * 60) > 0 ? GEAR.iron : 0x6a6a70), finish: { gloss: 0.7 } });
        }
        if (d.level < 2) {
          for (const z of [-0.02, -0.2]) lathe(k, [[ringR * 1.45, z * L + 0.008 * s], [ringR * 1.5, z * L], [ringR * 1.45, z * L - 0.008 * s]], { seg: d.n(14, 6), paint: GEAR.brass, finish: BRASS });
          bead(k, [0, 0, -0.004 * s], 0.008 * s, 0xffb866, 0.9, d);
        }
        return;
      }
      if (part === 'slide') {
        if (d.level >= 3) return;
        block(k, [0.026 * s, 0.05 * s, 0.035 * s], [0, -0.012 * s, 0], GEAR.woodDark, WOOD, d, [-0.2, 0, 0]);
        return;
      }
      if (part !== 'gun') return;
      if (d.level >= 3) {
        block(k, [0.06 * s, 0.07 * s, L * 0.6], [0, -0.01 * s, -L * 0.7], GEAR.woodDark, WOOD, d);
        return;
      }
      // Housing behind the cluster, the seed drum on the left with its feed chute, grip and a heavy stock.
      lathe(k, [[0.04 * s, -L * 0.4], [0.045 * s, -L * 0.44], [0.045 * s, -L * 0.6], [0.035 * s, -L * 0.64]], { seg: d.n(14, 5), paint: GEAR.iron, finish: { gloss: 0.6 } });
      lathe(k, [[0.065 * s, 0.03 * s], [0.07 * s, 0.025 * s], [0.07 * s, -0.025 * s], [0.065 * s, -0.03 * s]], { at: [0.06 * s, -0.01 * s, -L * 0.52], rot: [0, Math.PI / 2, 0], seg: d.n(18, 6), caps: true, paint: GEAR.brass, finish: BRASS });
      if (d.level < 2) {
        ring(k, [0.092 * s, -0.01 * s, -L * 0.52], 0.04 * s, 0.006 * s, d, GEAR.brassDark, undefined, [0, Math.PI / 2, 0]);
        block(k, [0.03 * s, 0.022 * s, 0.05 * s], [0.03 * s, 0.03 * s, -L * 0.5], GEAR.brassDark, BRASS, d);
      }
      carve(k, [[-L * 0.68, -0.04 * s], [-L * 0.74, -0.04 * s], [-L * 0.8, -0.13 * s], [-L * 0.72, -0.135 * s]], 0.03 * s, GEAR.wood, WOOD, d);
      carve(k, [[-L * 0.62, 0.03 * s], [-L * 0.98, 0.02 * s], [-L * 1.02, -0.1 * s], [-L * 0.95, -0.12 * s], [-L * 0.66, -0.05 * s]], 0.045 * s, GEAR.woodDark, WOOD, d);
    },
  };
}

// =================================================================================================================
// Nightjar: a flat, horizontal wedge in bark-mottled grey and brown, a wide flat head with enormous dark eyes, a tiny
// bill that opens into a huge gape on a cast, long pointed wings and tail with white spots. Assassin: a compact moth
// pistol with moth-wing blade guards, a revolver cylinder and a needle.

const NIGHTJAR = {
  bark: 0x7c6c5a,
  dark: 0x4a3e32,
  pale: 0xb8a888,
  grey: 0x8a8478,
  bill: 0x2a2420,
  leg: 0x8a7a6a,
  claw: 0x2a2420,
  iris: 0x140c06,
  mouth: 0xd87a8a,
  moon: 0xcfe0ff,
} as const;

export function nightjar(plan: BodyPlan, team: TeamColours, d: Detail): SculptedSpec {
  const H = plan.height;
  const R = plan.radius;
  const hr = plan.head.radius;
  const s = H / 1.55;
  const N = NIGHTJAR;
  const MOTTLE = { tile: TILE.mottle, size: 0.16 } as const;
  const legLen = H * 0.36;
  const leg: LegStyle = {
    skin: N.leg, claw: N.claw, thick: 0.02 * s, thigh: N.bark, fringe: 0.6,
    toes: [{ yaw: -0.4, len: 0.06 * s }, { yaw: 0, len: 0.075 * s }, { yaw: 0.4, len: 0.06 * s }, { yaw: Math.PI, len: 0.035 * s }],
    clawLen: 0.022 * s,
  };
  const wing: WingStyle = {
    covert: N.bark, secondary: N.dark, primary: N.dark, trim: team.primary,
    thick: 0.03 * s, chord: 0.26 * s, primaries: 9, secondaries: 7, primaryLen: 0.85, cell: CARD.spotted, secondaryCell: CARD.mottled,
    finish: MOTTLE, primaryPitch: -0.6,
  };

  const body = (k: Sculpt): void => {
    // A long, low wedge, pressed flat as if on a branch.
    const torso = k.loft(
      [
        { c: [0, 0.98 * s, -0.66 * s], w: 0, up: 0 },
        { c: [0, 0.96 * s, -0.54 * s], w: 0.18 * s, up: 0.1 * s, dn: 0.12 * s },
        { c: [0, 0.94 * s, -0.3 * s], w: 0.3 * s, up: 0.17 * s, dn: 0.24 * s },
        { c: [0, 0.98 * s, -0.04 * s], w: 0.33 * s, up: 0.2 * s, dn: 0.4 * s },
        { c: [0, 1.08 * s, 0.14 * s], w: 0.27 * s, up: 0.2 * s, dn: 0.34 * s },
        { c: [0, 1.18 * s, 0.22 * s], w: 0, up: 0 },
      ],
      { n: d.n(14, 4), seg: d.n(22, 5), finish: MOTTLE, paint: (t, a) => (Math.sin(a) < -0.4 ? mix(N.pale, N.bark, 0.4 + 0.3 * t) : mix(N.bark, N.grey, 0.3 + 0.3 * Math.sin(a))) },
    );
    // Cryptic scapulars over the back, and belly feathers hanging over the thighs.
    shingle(k, torso, { t: [0.2, 0.8], a: [Math.PI * 0.1, Math.PI * 0.9], rows: 4, cols: 6, len: 0.12 * s, wid: 0.1 * s, cell: CARD.mottled, paint: (_t, a) => mix(N.bark, N.grey, Math.sin(a) * 0.6), lift: 0.12, seed: 5, finish: MOTTLE }, d);
    shingle(k, torso, { t: [0.45, 0.75], a: [-Math.PI * 0.85, -Math.PI * 0.15], rows: 2, cols: 6, len: 0.16 * s, wid: 0.12 * s, cell: CARD.mottled, paint: N.pale, toward: [0, -1, 0], lift: 0.1, seed: 7 }, d);
    // Gear: a slim flock-colour sash with a brass moth brooch, and a sheathed needle-dagger on the hip.
    sash(k, torso, 0.62, 0.22, Math.PI * 0.3, { width: 0.05 * s, thick: 0.012 * s, hex: team.primary, stitch: team.light, finish: { gloss: 0.3 } }, d);
    if (d.level < 2) {
      const b = torso.at(0.82, Math.PI * 0.3, 0.025 * s);
      bead(k, [b.p.x, b.p.y, b.p.z], 0.016 * s, GEAR.brass, 0, d, [1.6, 1, 0.5]);
      for (const x of [1, -1]) k.card({ at: [b.p.x, b.p.y, b.p.z], dir: [x, 0.3, 0.2], face: [b.n.x, b.n.y, b.n.z], len: 0.05 * s, wid: 0.04 * s, cell: CARD.spotted, root: N.pale, tip: N.bark, segs: 1 });
    }
    const hip = torso.at(0.5, Math.PI * 1.15, 0.01 * s);
    if (d.level < 3) {
      k.loft([{ c: [hip.p.x, hip.p.y + 0.05 * s, hip.p.z + 0.04 * s], w: 0.016 * s, up: 0.009 * s }, { c: [hip.p.x, hip.p.y - 0.06 * s, hip.p.z - 0.12 * s], w: 0.01 * s, up: 0.006 * s }, { c: [hip.p.x, hip.p.y - 0.08 * s, hip.p.z - 0.16 * s], w: 0, up: 0 }], { seg: 6, paint: GEAR.leatherDark, finish: LEATHER });
      ovoid(k, [hip.p.x, hip.p.y + 0.075 * s, hip.p.z + 0.07 * s], [0.012 * s, 0.012 * s, 0.03 * s], { n: 4, seg: 6, paint: GEAR.bone, finish: { gloss: 0.4 }, rot: [-0.5, 0, 0] });
    }
  };

  const head = (k: Sculpt): void => {
    // Wide and flat, the eyes set high on its corners.
    ovoid(k, [0, 0, 0.0], [hr * 1.38, hr * 1.03, hr * 1.04], { n: d.n(14, 4), seg: d.n(24, 6), egg: 0.05, finish: { ...MOTTLE, size: 0.1 }, paint: (t, a) => (Math.sin(a) < -0.5 && t > 0.55 ? N.pale : mix(N.bark, N.grey, 0.35 + 0.3 * Math.sin(a))) });
    k.loft([{ c: [0, -hr * 0.3, -hr * 0.1], w: hr * 1.1, up: hr * 0.8 }, { c: [0, -hr * 0.95, -hr * 0.2], w: 0.16 * s, up: 0.12 * s }], { seg: d.n(14, 4), ref: [0, 0, 1], paint: N.bark, finish: MOTTLE });
    for (const x of [1, -1]) eye(k, [x * hr * 0.92, hr * 0.32, hr * 0.42], [x * 0.72, 0.2, 0.66], { r: hr * 0.36, iris: N.iris, ring: N.dark, lid: N.bark, ringW: hr * 0.06, pupil: 0.55 }, d);
    // The gape: on the display the chin drops away and a wide pink mouth opens under the tiny bill.
    if (d.level < 3) {
      const mouth: V3 = [0, -hr * 0.24, hr * 0.97];
      const open = new Matrix4().makeTranslation(mouth[0], mouth[1] - hr * 0.12, mouth[2]).multiply(new Matrix4().makeScale(1, 7, 1.2)).multiply(new Matrix4().makeTranslation(-mouth[0], -mouth[1], -mouth[2]));
      ovoid(k, mouth, [hr * 0.72, hr * 0.03, hr * 0.14], { n: d.n(6, 3), seg: d.n(12, 5), paint: N.mouth, finish: SKIN, morph: { display: open } });
      ovoid(k, [0, -hr * 0.46, hr * 0.62], [hr * 0.75, hr * 0.14, hr * 0.42], { n: d.n(8, 3), seg: d.n(14, 5), paint: N.pale, finish: MOTTLE, morph: { display: hinge([0, -hr * 0.38, hr * 0.15], [1, 0, 0], 0.7) } });
    }
    // A tiny bill, fringed with bristles.
    beak(k, { at: [0, -hr * 0.18, hr * 1.0], len: hr * 0.34, w: hr * 0.3, up: hr * 0.14, dn: hr * 0.1, base: N.bill, tip: N.bill, gape: 3.2, open: 0.35, displayOpen: 0.95 }, d);
    if (d.level < 2) {
      for (const x of [1, -1]) {
        for (let i = 0; i < 3; i++) {
          k.card({ at: [x * hr * (0.45 + i * 0.12), -hr * (0.12 + i * 0.05), hr * (0.92 - i * 0.12)], dir: norm([x * 0.6, 0.15 - i * 0.15, 1]), face: [0, 1, 0], len: 0.07 * s, wid: 0.012 * s, cell: CARD.quill, root: N.bill, tip: N.dark, segs: 1 });
        }
      }
    }
  };

  const tail = (k: Sculpt): void => {
    tailFan(k, { count: 10, len: 0.56 * s, wid: 0.09 * s, spread: 0.5, droop: 0.22, centreLonger: 0.1, root: N.bark, tip: N.dark, cell: CARD.spotted, finish: MOTTLE }, d);
  };

  return {
    body, head, tail,
    wing: wingsOf(wing, d),
    leg: legsOf(leg, d),
    gun: nightjarGun(s, d),
    pivot: {
      wingL: [R * 0.85, 1.1 * s, -0.12 * s], wingR: [-R * 0.85, 1.1 * s, -0.12 * s],
      legL: [R * 0.4, legLen, -0.04 * s], legR: [-R * 0.4, legLen, -0.04 * s],
      tail: [0, 0.98 * s, -0.6 * s],
    },
    legLen, legThick: leg.thick, wingLen: H * 0.4,
    // Gape, Nightfall, Churring Call, Night Swallow.
    casts: ['leap', 'raise', 'sweep', 'leap'],
    sway: 0, castTail: -0.25,
  };
}

/** Moth Pistol: compact, a needle under the muzzle, moth-wing bone guards, a revolver cylinder and a pale grip. */
function nightjarGun(s: number, d: Detail): SculptedSpec['gun'] {
  const N = NIGHTJAR;
  const L = 0.42 * s;
  const r = 0.012 * s;
  return {
    main: [0, -0.05 * s, -L * 0.7],
    support: [0, -0.018 * s, 0],
    slideAt: [0, -0.006 * s, -L * 0.3],
    travel: 0.02 * s,
    build(k, part) {
      if (part === 'slide') {
        if (d.level >= 3) return;
        block(k, [0.026 * s, 0.024 * s, 0.06 * s], [0, 0, 0], GEAR.woodDark, WOOD, d);
        return;
      }
      if (part !== 'gun') return;
      if (d.level >= 3) {
        lathe(k, [[r * 1.4, 0], [r, -L * 0.5], [0.02 * s, -L * 0.6], [0.016 * s, -L]], { seg: 4, paint: GEAR.iron });
        return;
      }
      lathe(k, [[r * 1.5, 0], [r * 1.7, -0.01 * s], [r * 1.3, -0.022 * s]], { seg: d.n(12, 4), paint: GEAR.brass, finish: BRASS });
      bead(k, [0, 0, -0.006 * s], r * 0.85, N.moon, 0.85, d);
      lathe(k, [[r, -0.02 * s], [r, -L * 0.42], [r * 1.2, -L * 0.45]], { seg: d.n(10, 4), paint: GEAR.iron, finish: { gloss: 0.6 } });
      // The needle: a bone spike under the barrel, reaching past the muzzle.
      k.loft([{ c: [0, -0.022 * s, -L * 0.35], w: 0.004 * s, up: 0.004 * s }, { c: [0, -0.022 * s, 0.05 * s], w: 0, up: 0 }], { seg: 5, paint: GEAR.bone, finish: { gloss: 0.6 } });
      // The revolver cylinder (the ammo read): six chambers round a drum.
      lathe(k, [[0.02 * s, -L * 0.46], [0.024 * s, -L * 0.48], [0.024 * s, -L * 0.6], [0.02 * s, -L * 0.62]], {
        seg: d.n(12, 6), caps: true, paint: (_t, a) => (d.level === 0 && Math.cos(a * 6) > 0.7 ? 0x1a1a1a : GEAR.iron), finish: { gloss: 0.6 },
      });
      block(k, [0.03 * s, 0.045 * s, 0.07 * s], [0, -0.006 * s, -L * 0.68], GEAR.iron, { gloss: 0.5 }, d);
      // Moth-wing guards: two carved bone blades flaring up and out from the frame, each with an eye spot.
      if (d.level < 2) {
        for (const x of [1, -1]) {
          const wingShape: [number, number][] = [[-L * 0.5, 0.01 * s], [-L * 0.36, 0.05 * s], [-L * 0.42, 0.075 * s], [-L * 0.58, 0.07 * s], [-L * 0.66, 0.03 * s]];
          k.mesh(new ExtrudeProfile(wingShape, 0.004 * s), { at: [x * 0.016 * s, 0, 0], rot: [0, 0, x * -0.5], paint: (p) => (Math.hypot(p.z + L * 0.52, p.y - 0.048 * s) < 0.012 * s ? N.dark : N.pale), finish: { gloss: 0.4 } });
        }
      }
      carve(k, [[-L * 0.66, -0.022 * s], [-L * 0.74, -0.022 * s], [-L * 0.84, -0.1 * s], [-L * 0.74, -0.106 * s]], 0.026 * s, GEAR.bone, { gloss: 0.4 }, d);
      if (d.level < 2) stud(k, [0.015 * s, -0.06 * s, -L * 0.77], 0.005 * s);
    },
  };
}

/** A flat profile in the gun's side plane ([z, y] points) extruded `thick` across x, centred (thin blades). */
class ExtrudeProfile extends ExtrudeGeometry {
  constructor(pts: [number, number][], thick: number) {
    const shape = new Shape();
    pts.forEach(([z, y], i) => (i === 0 ? shape.moveTo(z, y) : shape.lineTo(z, y)));
    shape.closePath();
    super(shape, { depth: thick, bevelEnabled: false });
    this.translate(0, 0, -thick / 2);
    this.rotateY(-Math.PI / 2);
    this.computeVertexNormals();
  }
}

export const B2_BUILDS = { cassowary, toucan, woodpecker, nightjar } as const;
