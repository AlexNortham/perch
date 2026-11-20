/* eslint-disable @typescript-eslint/no-magic-numbers -- authored birds: the numbers are the sculpture */
/**
 * Batch G birds, built new on the sculpt pipeline v2.1 (style guide §8; GDD §9.21 to §9.24; D-ART-010, D-ART-011):
 * Frigatebird, Cockatoo, Swan and Kiwi, on implicit bodies with the player-camera dress. Every size comes from the
 * BodyPlan at runtime (head about the head hitbox centre, body inside the capsule, the gun's tip at the muzzle); only
 * fractions and authored offsets are written here.
 */
import { TorusGeometry } from 'three';
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import type { TeamColours } from '../palette';
import { add, beak, eye, foldedWings, hackles, inBone, legsOf, lerp3, mul, norm, sub, tailFan, wingsOf } from './anatomy';
import type { LegStyle, WingStyle } from './anatomy';
import { bodyField, COCKATOO_HEAD, cockatooAnchors, flipX, FRIGATEBIRD_HEAD, frigatebirdAnchors, skinFor, TRUNK } from './bodies';
import { SKIN as COCKATOO_SKIN } from './data/skins/cockatoo';
import { SKIN as FRIGATEBIRD_SKIN } from './data/skins/frigatebird';
import { CARD, TILE } from './feathers';
import { band, bead, block, BRASS, buckle, carve, GEAR, LEATHER, lathe, plume, pouch, sash, scope, stud, WOOD } from './gear';
import type { Detail, SculptedBird, SculptedSpec } from './sculpted';
import { hinge, jitter, mix, shade } from './sculpt';
import type { Morphs, Sculpt, V3 } from './sculpt';

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const len3 = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const side3 = (v: V3, x: 1 | -1): V3 => [v[0] * x, v[1], v[2]];

// =================================================================================================================
// Frigatebird: the pirate of the skies. A slim, angular black bird with very long, narrow wings held half open behind
// it in a sharp W (3.6 m along the wing), a deeply forked scissor tail, a long hooked grey bill and the hero shape: a
// huge scarlet throat balloon over the breast. Glossy black with a purple-green sheen on the lanceolate mantle, a
// bronze collar on the hind neck, the flock colour on the wing bars, a pirate's headband and a waist sash. A coil of
// harpoon line rides on its back. Long-range poke: the Kite Rifle, long and slim under a scope, with a barbed
// harpoon and its line reel slung under the barrel.

const FRIGATE = {
  black: 0x18161c,
  sheen: 0x2a2234,
  bronze: 0x7a5c3c,
  sooty: 0x221f22,
  red: 0xd8202c,
  redDeep: 0x8c1020,
  bill: 0x7c8088,
  billTip: 0xb8bcc2,
  foot: 0x5a3a3a,
  claw: 0x1a1414,
  iris: 0x2a1a12,
  wood: 0x5a2e22,
} as const;

/**
 * One half-open wing of the W, on the body bone (`x` +1 left, -1 right): a narrow arm panel rising from the back to a
 * high wrist, secondaries hanging from its trailing edge under a flock-colour covert bar, and the long hand of
 * primaries sweeping out and down to the tip. Lifts on a cast.
 */
function wWing(k: Sculpt, x: 1 | -1, s: number, team: TeamColours, d: Detail): void {
  const P = FRIGATE;
  // Held out like a bird drying its wings: the faces turned to the front and back, so the W reads from the player
  // camera behind and from the enemy in front. The arm rises to a high wrist, the long hand falls to the tip.
  const root = side3([0.12 * s, 1.2 * s, -0.12 * s], x);
  const wrist = side3([0.6 * s, 1.6 * s, -0.2 * s], x);
  const tip = side3([1.45 * s, 0.98 * s, -0.3 * s], x);
  const m: Morphs = { display: hinge(root, [0, 0, 1], x * 0.28) };
  const SHEEN = { tile: TILE.scales, size: 0.09, iri: 0.4, gloss: 0.45 } as const;
  const arm = sub(wrist, root);
  const span = sub(tip, wrist);
  // Down the wing from a leading edge (in the wing's plane, away from the edge), and the plane's normal (back).
  const chordOf = (edge: V3): V3 => {
    const e = norm(edge);
    const dn: V3 = [0, -1, -0.12];
    const k0 = dn[0] * e[0] + dn[1] * e[1] + dn[2] * e[2];
    return norm(sub(dn, mul(e, k0)));
  };
  const armChord = chordOf(arm);
  const handChord = chordOf(span);
  const face: V3 = [0, 0.15, -1];
  if (d.level >= 3) {
    // At 80 m one card each of arm and hand keeps the W's two strokes.
    k.card({ at: lerp3(root, wrist, 0.5), dir: armChord, face, len: 0.4 * s, wid: len3(arm) * 1.1, cell: CARD.tail, root: P.black, tip: P.sooty, segs: 2, morph: m });
    k.card({ at: wrist, dir: norm(add(span, mul(handChord, 0.35))), face, len: len3(span) * 0.95, wid: 0.3 * s, cell: CARD.primary, root: P.black, tip: P.sooty, segs: 2, morph: m });
    return;
  }
  // The leading edge of the arm: a rounded bone of coverts, the flock bar painted along its lower half.
  k.loft(
    [
      { c: lerp3(root, wrist, -0.06), w: 0, up: 0, dn: 0 },
      { c: root, w: 0.03 * s, up: 0.04 * s, dn: 0.14 * s },
      { c: lerp3(root, wrist, 0.5), w: 0.026 * s, up: 0.035 * s, dn: 0.13 * s },
      { c: wrist, w: 0.024 * s, up: 0.032 * s, dn: 0.1 * s },
      { c: lerp3(wrist, tip, 0.08), w: 0.012 * s, up: 0.02 * s, dn: 0.05 * s },
    ],
    { n: d.n(7, 4), seg: d.n(8, 4), ref: [0, 1, 0], morph: m, paint: (_t, a) => (Math.cos(a) * x > 0.5 ? P.sooty : P.black), finish: SHEEN },
  );
  // The hand's leading edge, tapering to the tip (with the arm, the W's two strokes read alone at 80 m).
  k.loft(
    [
      { c: lerp3(wrist, tip, 0.04), w: 0.018 * s, up: 0.026 * s, dn: 0.08 * s },
      { c: lerp3(wrist, tip, 0.45), w: 0.014 * s, up: 0.02 * s, dn: 0.07 * s },
      { c: lerp3(wrist, tip, 0.85), w: 0.008 * s, up: 0.012 * s, dn: 0.035 * s },
      { c: tip, w: 0, up: 0, dn: 0 },
    ],
    { n: d.n(6, 3), seg: d.n(7, 4), ref: [0, 1, 0], morph: m, paint: P.black, finish: SHEEN },
  );
  // Secondaries hang from the arm's trailing edge, broad and round-tipped, overlapping from the body out.
  const rows = Math.max(2, d.rows - 1);
  const ns = d.keep(6, 3);
  for (let i = 0; i < ns; i++) {
    const u = (i + 0.5) / ns;
    const at = add(lerp3(root, wrist, 0.02 + 0.96 * u), add(mul(armChord, 0.08 * s), [0, 0, -0.01 * s * (i % 2)]));
    k.card({
      at, dir: norm(add(armChord, [x * 0.12 * (u - 0.5), 0, -0.12])), face, len: (0.42 - 0.12 * u) * s * (0.94 + 0.12 * jitter(i, 61 + x)), wid: (len3(arm) / ns) * 2.0, cell: CARD.tail,
      root: shade(P.black, 1.08 + 0.12 * (i % 2)), tip: P.sooty, curl: -0.15, segs: rows, cup: d.level < 2 ? 0.08 : 0, finish: SHEEN, morph: m,
    });
  }
  // Primaries from the hand: the outermost runs to the tip, the inner ones fan down toward the secondaries.
  const np = d.keep(7, 3);
  for (let i = 0; i < np; i++) {
    const u = i / Math.max(1, np - 1);
    const at = add(lerp3(wrist, tip, 0.05 + 0.32 * (1 - u)), mul(handChord, 0.03 * s));
    const dir = norm(add(mul(norm(span), 1 - 0.75 * u), mul(handChord, 0.25 + 0.9 * u)));
    k.card({
      at, dir, face, len: len3(span) * (0.68 - 0.3 * u), wid: 0.1 * s * Math.min(1.7, (7 / np) ** 0.5), cell: CARD.primary,
      root: shade(P.black, 1.12), tip: shade(P.black, 0.85 + 0.12 * (i % 2)), curl: -0.08, segs: d.rows, cup: d.level < 2 ? 0.06 : 0, finish: SHEEN, morph: m,
    });
  }
  // A row of coverts over the arm in the flock colour: the wing bar (the trim reads from behind and from 40 m).
  const nc = d.keep(5, 3);
  for (let i = 0; i < nc; i++) {
    const u = (i + 0.5) / nc;
    const at = add(lerp3(root, wrist, 0.04 + 0.92 * u), add(mul(armChord, 0.07 * s), [0, 0, -0.03 * s]));
    k.card({
      at, dir: norm(add(armChord, [0, 0, -0.1])), face, len: 0.16 * s, wid: (len3(arm) / nc) * 1.35, cell: CARD.contour,
      root: shade(team.primary, 0.85), tip: team.light, curl: -0.12, segs: rows, cup: 0.05, finish: { gloss: 0.3 }, morph: m,
    });
  }
}

function frigatebird(plan: BodyPlan, team: TeamColours, d: Detail): SculptedSpec {
  const H = plan.height;
  const hr = plan.head.radius;
  const A = frigatebirdAnchors(plan);
  const s = A.s;
  const P = FRIGATE;
  const SHEEN = { tile: TILE.scales, size: 0.08, iri: 0.5, gloss: 0.45 } as const;
  const SOOT = { tile: TILE.scales, size: 0.07, iri: 0.2, gloss: 0.25 } as const;
  const field = bodyField('frigatebird', plan);
  // The hind neck's bronze collar: lighter than the black crown above and the glossy mantle below.
  const collar = (p: { y: number; z: number }): number => clamp01(1.4 - Math.abs(p.y - (A.head[1] - 0.25 * s)) / (0.08 * s)) * clamp01((0.03 * s - p.z) / (0.05 * s));
  const skin = skinFor('frigatebird', plan, FRIGATEBIRD_SKIN, d.level, {
    back: { paint: P.black, finish: SHEEN },
    mantle: { paint: P.sheen, finish: { ...SHEEN, iri: 0.7 } },
    scapular: { paint: P.sheen, finish: { ...SHEEN, iri: 0.7 } },
    shoulder: { paint: P.black, finish: SHEEN },
    coverts: { paint: P.black, finish: SHEEN },
    breast: { paint: P.black, finish: SOOT },
    belly: { paint: P.sooty, finish: SOOT },
    thigh: { paint: P.sooty, finish: { ...SOOT, size: 0.05 } },
    neck: { paint: (p) => mix(P.black, P.bronze, collar(p)), finish: SOOT },
    crown: { paint: P.black, finish: { ...SHEEN, size: 0.05, iri: 0.4 } },
    nape: { paint: (p) => mix(P.black, P.bronze, collar(p)), finish: { ...SOOT, size: 0.05 } },
    face: { paint: P.black, finish: { gloss: 0.25 } },
    cheek: { paint: P.black, finish: { gloss: 0.25 } },
    brow: { paint: P.sooty, finish: { gloss: 0.25 } },
    throat: { paint: P.redDeep, finish: { gloss: 0.4 } },
    // The balloon: taut, glossy scarlet, deepening to wine at its sides and base.
    // Fine creases radiate down from where the sac gathers under the chin.
    balloon: {
      paint: (p) => {
        const crease = clamp01((p.y - 1.3 * s) / (0.12 * s)) * Math.max(0, Math.sin(Math.atan2(p.x, p.z - 0.17 * s) * 11)) ** 4;
        return mix(mix(P.red, P.redDeep, clamp01(Math.abs(p.x) / (0.16 * s) + (1.12 * s - p.y) / (0.3 * s) - 0.35)), P.redDeep, 0.6 * crease);
      },
      finish: { gloss: 0.6 },
    },
    bill: { paint: P.bill, finish: { gloss: 0.5 } },
    socket: { paint: P.black, finish: { gloss: 0.3 } },
  });
  const leg: LegStyle = {
    skin: P.foot, claw: P.claw, thick: A.legThick, thigh: P.sooty, fringe: 0.7, skinned: { r: 0.06 * s, at: 0.6 },
    toes: [{ yaw: -0.4, len: 0.08 * s }, { yaw: 0, len: 0.09 * s }, { yaw: 0.4, len: 0.08 * s }, { yaw: Math.PI, len: 0.045 * s }],
    clawLen: 0.03 * s,
  };
  // The arms that hold the rifle: black, narrow and glossy, the flock bar on the coverts.
  const wing: WingStyle = {
    covert: P.black, secondary: P.sooty, primary: P.black, primaryTip: P.sooty, trim: team.primary,
    thick: 0.028 * s, chord: 0.2 * s, primaries: 5, secondaries: 4, primaryLen: 0.5, secondaryLen: 0.8, finish: SHEEN,
  };

  const body = (k: Sculpt): void => {
    const axis: [V3, V3] = [[0, 0.42 * s, -0.06 * s], [0, A.head[1] - 0.16 * s, 0.0]];
    const torso = field.only(...TRUNK).surface(...axis, [0, 0, 1]);
    // The W: the long wings held half open behind the shoulders.
    for (const x of [1, -1] as const) wWing(k, x, s, team, d);
    // Gear: a flock-colour waist sash knotted on the hip, its tails hanging; a leather bandolier of brass rounds.
    const off = 0.012 * s;
    band(k, torso, 0.3, { width: 0.06 * s, thick: 0.014 * s, hex: team.primary, stitch: team.light, off, finish: { gloss: 0.25 } }, d);
    if (d.level < 3) {
      const knot = torso.at(0.3, Math.PI * 0.15, off + 0.02 * s);
      for (const [i, dz] of [[0, 1], [1, -1]] as const) {
        k.card({ at: [knot.p.x, knot.p.y, knot.p.z], dir: norm([-0.25, -1, 0.15 * dz]), face: norm([knot.n.x, knot.n.y, knot.n.z]), len: (i === 0 ? 0.24 : 0.19) * s, wid: 0.055 * s, cell: CARD.cloth, root: team.primary, tip: team.dark, curl: 0.2, sweep: 0.1 * dz, segs: d.level === 0 ? 4 : 2 });
      }
    }
    sash(k, torso, 0.58, 0.2, Math.PI * 0.62, { width: 0.045 * s, thick: 0.012 * s, hex: GEAR.leatherDark, stitch: team.light, off: off + 0.004 * s, finish: LEATHER }, d);
    if (d.level < 2) {
      for (let i = 0; i < 4; i++) {
        const u = 0.1 + i * 0.075;
        const p = torso.at(0.58 + 0.2 * Math.cos(u * Math.PI * 2), Math.PI * 0.62 + u * Math.PI * 2, 0.03 * s);
        lathe(k, [[0.007 * s, 0.03 * s], [0.0095 * s, 0.018 * s], [0.0095 * s, -0.026 * s]], { at: [p.p.x, p.p.y, p.p.z], rot: [Math.PI / 2 - 0.4, 0, 0], seg: 6, paint: (t) => (t < 0.3 ? GEAR.brassDark : GEAR.brass), finish: BRASS });
      }
    }
    buckle(k, torso.at(0.3, Math.PI * 0.5, off + 0.02 * s), 0.05 * s, d);
    pouch(k, torso.at(0.3, Math.PI * 1.15, off), [0.09 * s, 0.1 * s, 0.05 * s], GEAR.leather, d);
    // The harpoon line: a coil of rope slung on the back under the sash, a grapnel hook hanging from it.
    if (d.level < 3) {
      const c = torso.at(0.46, -Math.PI / 2 - 0.12, 0.05 * s);
      const n: V3 = [c.n.x, c.n.y, c.n.z];
      const turns = d.level === 0 ? 2 : 1;
      for (let i = 0; i < turns; i++) {
        const at = add([c.p.x, c.p.y, c.p.z], mul(n, (i - 0.5) * 0.026 * s));
        k.mesh(new TorusGeometry(0.11 * s, 0.018 * s, 4, d.n(14, 6)), { at, rot: [0.25, 0, 0.12 * i], paint: shade(GEAR.rope, 0.92 + 0.08 * (i % 2)), finish: WOOD });
      }
      if (d.level < 2) {
        const hook = add([c.p.x, c.p.y, c.p.z], add(mul(n, 0.05 * s), [-0.08 * s, -0.1 * s, 0]));
        k.loft([{ c: add(hook, [0, 0.12 * s, 0]), w: 0.008 * s, up: 0.008 * s }, { c: hook, w: 0.008 * s, up: 0.008 * s }, { c: add(hook, [0.03 * s, -0.04 * s, -0.01 * s]), w: 0.007 * s, up: 0.007 * s }, { c: add(hook, [0.06 * s, -0.01 * s, -0.01 * s]), w: 0, up: 0 }], { seg: 6, paint: GEAR.iron, finish: { gloss: 0.7 } });
        k.loft([{ c: hook, w: 0.007 * s, up: 0.007 * s }, { c: add(hook, [-0.03 * s, -0.04 * s, -0.01 * s]), w: 0.007 * s, up: 0.007 * s }, { c: add(hook, [-0.06 * s, -0.01 * s, -0.01 * s]), w: 0, up: 0 }], { seg: 6, paint: GEAR.iron, finish: { gloss: 0.7 } });
      }
    }
  };

  const head = (k: Sculpt): void => {
    // Hackles: long lanceolate feathers down the hind neck over the bronze collar.
    const neckAxis: [V3, V3] = [[0, A.head[1] - 0.36 * s, -0.02 * s], [0, A.head[1] + hr, -0.03 * s]];
    hackles(k, inBone(field.only('neck', 'nape', 'crown').surface(...neckAxis, [0, 0, 1]), A.head), {
      t: [0.26, 0.66], a: [-Math.PI * 0.86, -Math.PI * 0.14], rows: 3, cols: 5, len: 0.13 * s, wid: 0.045 * s, lift: 0.16,
      paint: (t) => mix(P.bronze, P.sheen, t), finish: { ...SOOT, iri: 0.4 }, seed: 53,
    }, d);
    // The pirate's headband in the flock colour, knotted at the back of the crown with two tails flying.
    const headAxis: [V3, V3] = [[0, A.head[1] - hr * 1.2, -hr * 0.1], [0, A.head[1] + hr * 1.3, -hr * 0.3]];
    const crown = inBone(field.only('crown', 'brow', 'nape', 'face').surface(...headAxis, [0, 0, 1]), A.head);
    band(k, crown, 0.66, { width: 0.045 * s, thick: 0.01 * s, hex: team.primary, stitch: team.light, off: 0.004 * s, finish: { gloss: 0.25 } }, d);
    if (d.level < 3) {
      const knot = crown.at(0.66, -Math.PI / 2, 0.02 * s);
      k.mesh(new TorusGeometry(0.018 * s, 0.011 * s, 4, d.n(8, 5)), { at: [knot.p.x, knot.p.y, knot.p.z], rot: [0, Math.PI / 2, 0], paint: team.dark, finish: { gloss: 0.25 } });
      for (const x of [1, -1]) {
        k.card({ at: [knot.p.x, knot.p.y, knot.p.z], dir: norm([x * 0.45, -0.55, -1]), face: [0, 1, -0.3], len: (x > 0 ? 0.2 : 0.16) * s, wid: 0.045 * s, cell: CARD.cloth, root: team.primary, tip: team.dark, curl: -0.3, sweep: x * 0.2, segs: d.level === 0 ? 4 : 2 });
      }
    }
    const E = FRIGATEBIRD_HEAD.eye;
    for (const x of [1, -1]) eye(k, [x * hr * E[0], hr * E[1], hr * E[2]], [x * 0.7, 0.02, 0.72], { r: hr * 0.22, iris: P.iris, ring: P.black, lid: P.black, ringW: hr * 0.035 }, d);
    // The long grey bill with a sharp, heavy hook.
    const B = FRIGATEBIRD_HEAD.bill;
    beak(k, { at: [0, hr * B[1], hr * (B[2] - 0.05)], len: hr * 2.5, w: hr * 0.2, up: hr * 0.2, dn: hr * 0.14, curve: hr * 0.1, hook: hr * 0.3, base: P.bill, tip: P.billTip, lower: shade(P.bill, 0.85), open: 0.32 }, d);
  };

  const tail = (k: Sculpt): void => {
    // The scissor tail: a deep fork, the outer streamers twice the length of the middle, opening on a cast.
    tailFan(k, {
      count: 8, len: 0.26 * s, wid: 0.06 * s, spread: 0.8, droop: 0.55, fork: 1.3, root: P.black, tip: P.sooty, cell: CARD.tail, finish: SHEEN,
      display: (u, at) => hinge(at, [0, 1, 0], u * 0.3),
    }, d);
  };

  return {
    body, head, tail, skin,
    wing: wingsOf(wing, d),
    leg: legsOf(leg, d),
    gun: kiteRifle(s, team, d),
    pivot: { wingL: A.wing, wingR: flipX(A.wing), legL: A.hip, legR: flipX(A.hip), tail: A.tail },
    legLen: A.legLen, legThick: leg.thick, wingLen: H * 0.36,
    // Plunder Shot, High Pass, Balloon Boom, Harpoon Line (braced, the harpoon fired from under the barrel).
    casts: ['aim', 'leap', 'raise', 'aim'],
    sway: 0, castTail: -0.25, castWiden: 0.4,
  };
}

/**
 * Kite Rifle: a long, slim octagonal barrel under a brass scope, a red bead in the brass crown, a barbed harpoon head
 * slung under the barrel on its line reel (the Harpoon Line), a dark red stock and a flock-colour kite pennant.
 */
function kiteRifle(s: number, team: TeamColours, d: Detail): SculptedSpec['gun'] {
  const L = 0.74 * s;
  const r = 0.011 * s;
  return {
    main: [0, -0.055 * s, -L * 0.72],
    support: [0, -0.026 * s, 0],
    slideAt: [0, -0.012 * s, -L * 0.42],
    travel: 0.025 * s,
    build(k, part) {
      if (part === 'slide') {
        if (d.level >= 3) return;
        // The fore-end: dark wood bound with cord.
        lathe(k, [[r * 1.5, 0.06 * s], [r * 2.0, 0.045 * s], [r * 2.1, -0.05 * s], [r * 1.6, -0.065 * s]], { seg: d.n(10, 4), paint: (t) => (Math.sin(t * 26) > 0.55 ? GEAR.rope : FRIGATE.wood), finish: WOOD, flat: 1.2 });
        return;
      }
      if (part !== 'gun') return;
      if (d.level >= 2) {
        // Far away: the long barrel, the scope, the reel and the stock, as a few plain solids.
        lathe(k, [[0.016 * s, 0], [r * 1.2, -0.03 * s], [r * 1.3, -L * 0.6], [0.026 * s, -L * 0.66], [0.026 * s, -L * 0.8], [0.03 * s, -L * 0.98], [0, -L]], { seg: d.level === 2 ? 5 : 4, paint: (t) => (t < 0.6 ? GEAR.iron : FRIGATE.wood) });
        if (d.level === 2) {
          lathe(k, [[0.014 * s, -L * 0.5], [0.014 * s, -L * 0.7]], { at: [0, 0.034 * s, 0], seg: 4, paint: GEAR.brassDark });
          lathe(k, [[0.026 * s, -L * 0.28], [0.026 * s, -L * 0.32]], { at: [0, -0.04 * s, 0], seg: 5, paint: GEAR.rope, caps: true });
        }
        return;
      }
      // The brass crown and its red bead.
      lathe(k, [[r * 1.2, 0], [r * 1.9, -0.008 * s], [r * 1.9, -0.024 * s], [r * 1.3, -0.03 * s]], { seg: d.n(12, 5), paint: GEAR.brass, finish: BRASS });
      bead(k, [0, 0, -0.004 * s], r * 0.95, 0xff5a3c, 0.85, d);
      // The long barrel, eight-sided, with brass bands.
      lathe(k, [[r * 1.05, -0.028 * s], [r, -L * 0.45], [r * 1.2, -L * 0.6], [r * 1.5, -L * 0.62]], { seg: d.level === 0 ? 8 : 6, paint: (t) => (Math.abs(t - 0.3) < 0.025 ? GEAR.brass : GEAR.iron), finish: { gloss: 0.6 } });
      scope(k, [0, 0.034 * s, -L * 0.6], 0.2 * s, 0.014 * s, d);
      if (d.level < 2) for (const z of [0.53, 0.67]) block(k, [0.01 * s, 0.022 * s, 0.012 * s], [0, 0.018 * s, -L * z], GEAR.brassDark, BRASS, d);
      // The harpoon: a barbed iron head under the muzzle, its shaft running back to the line reel.
      lathe(k, [[0.004 * s, -0.08 * s], [0.004 * s, -L * 0.3]], { at: [0, -0.026 * s, 0], seg: 5, paint: GEAR.woodDark, finish: WOOD });
      k.loft([{ c: [0, -0.026 * s, -0.09 * s], w: 0.009 * s, up: 0.009 * s }, { c: [0, -0.026 * s, -0.035 * s], w: 0.008 * s, up: 0.008 * s }, { c: [0, -0.026 * s, 0], w: 0, up: 0 }], { seg: 6, paint: GEAR.iron, finish: { gloss: 0.75 } });
      if (d.level < 2) {
        for (const x of [1, -1]) k.loft([{ c: [0, -0.026 * s, -0.04 * s], w: 0.004 * s, up: 0.004 * s }, { c: [x * 0.016 * s, -0.026 * s, -0.075 * s], w: 0, up: 0 }], { seg: 4, paint: GEAR.iron, finish: { gloss: 0.75 } });
      }
      // The line reel: a drum of rope between brass cheeks under the fore-end (the ammo read).
      lathe(k, [[0.024 * s, 0.022 * s], [0.026 * s, 0.018 * s], [0.026 * s, -0.018 * s], [0.024 * s, -0.022 * s]], { at: [0, -0.04 * s, -L * 0.3], rot: [0, Math.PI / 2, 0], seg: d.n(12, 5), paint: (t) => (t < 0.12 || t > 0.88 ? GEAR.brass : shade(GEAR.rope, 0.9 + 0.12 * Math.sin(t * 60))), finish: WOOD, caps: true });
      // The action, trigger guard, and the long red-brown stock with a cheek rest.
      block(k, [0.032 * s, 0.048 * s, 0.13 * s], [0, -0.004 * s, -L * 0.68], GEAR.woodDark, WOOD, d);
      carve(k, [[-L * 0.68, -0.024 * s], [-L * 0.74, -0.024 * s], [-L * 0.8, -0.1 * s], [-L * 0.72, -0.104 * s]], 0.026 * s, FRIGATE.wood, WOOD, d);
      carve(k, [[-L * 0.74, 0.02 * s], [-L * 0.88, 0.028 * s], [-L, 0.024 * s], [-L * 1.02, -0.07 * s], [-L * 0.95, -0.078 * s], [-L * 0.8, -0.034 * s]], 0.03 * s, FRIGATE.wood, WOOD, d);
      if (d.level < 2) {
        for (let i = 0; i < 3; i++) stud(k, [0.016 * s, -0.004 * s, -L * (0.84 + i * 0.05)], 0.004 * s, GEAR.brass);
        // The kite pennant: a flock-colour cloth tail tied at the butt.
        plume(k, [0, 0.01 * s, -L * 0.98], [0, -0.5, -1], 0.12 * s, 0.04 * s, team.primary, CARD.cloth, [1, 0, 0], team.dark);
      }
    },
  };
}

// =================================================================================================================
// Cockatoo: a loud, stocky white parrot. A deep round chest on short grey legs, a big round head with puffed cheeks,
// a very deep hooked charcoal bill, bare pale skin round a dark eye, and the hero shape: a tall sulphur-yellow crest
// that lies swept back over the crown at rest, its tips curling up behind the head, and fans straight up on a cast.
// Warm white head over a cool grey-white mantle, yellow washed under the wings and tail. A flock-colour neckerchief
// knotted behind, and a bandolier of nuts for Seed Crack. Spirit burst: the Screech Horn, a brass horn with a flared
// bell, coiled tubing and a glowing sulphur chamber.

const COCKATOO = {
  white: 0xf6f2ea,
  cool: 0xc4c9d0,
  pale: 0xe2e4e6,
  sulphur: 0xf6cc1e,
  lemon: 0xfbe57a,
  bill: 0x4a4a54,
  ring: 0xc6dcef,
  iris: 0x1a1210,
  foot: 0x8c8c94,
  claw: 0x2a2a2e,
  nut: 0x8a5a30,
  bone: 0xece2cc,
} as const;

function cockatoo(plan: BodyPlan, team: TeamColours, d: Detail): SculptedSpec {
  const H = plan.height;
  const hr = plan.head.radius;
  const A = cockatooAnchors(plan);
  const s = A.s;
  const C = COCKATOO;
  const DOWN = { tile: TILE.scales, size: 0.08, gloss: 0.12 } as const;
  const field = bodyField('cockatoo', plan);
  // Warm white on the head and breast, cooling to grey-white over the mantle and back (a 15–20 % value step).
  const cool = (p: { y: number; z: number }, k = 1): number => mix(C.white, C.cool, k * clamp01((-p.z - 0.02 * s) / (0.14 * s)) * clamp01((1.3 * s - p.y) / (0.25 * s) + 0.3));
  const skin = skinFor('cockatoo', plan, COCKATOO_SKIN, d.level, {
    back: { paint: (p) => cool(p), finish: DOWN },
    mantle: { paint: (p) => cool(p, 1.1), finish: DOWN },
    scapular: { paint: (p) => mix(cool(p), C.pale, 0.3), finish: DOWN },
    shoulder: { paint: C.pale, finish: DOWN },
    coverts: { paint: mix(C.cool, C.lemon, 0.25), finish: DOWN },
    breast: { paint: C.white, finish: { ...DOWN, size: 0.07 } },
    belly: { paint: mix(C.white, C.lemon, 0.08), finish: DOWN },
    thigh: { paint: C.pale, finish: { ...DOWN, size: 0.05 } },
    neck: { paint: (p) => cool(p, 0.6), finish: DOWN },
    crown: { paint: C.white, finish: { ...DOWN, size: 0.05 } },
    nape: { paint: C.white, finish: { ...DOWN, size: 0.05 } },
    crestRoot: { paint: (p) => mix(C.lemon, C.sulphur, clamp01((A.head[2] - p.z) / (0.12 * s) + 0.3)), finish: { ...DOWN, size: 0.04 } },
    face: { paint: C.white, finish: { ...DOWN, size: 0.035 } },
    cheek: { paint: C.white, finish: { ...DOWN, size: 0.045 } },
    brow: { paint: C.white, finish: { ...DOWN, size: 0.035 } },
    throat: { paint: C.white, finish: DOWN },
    ear: { paint: mix(C.white, C.lemon, 0.55), finish: { ...DOWN, size: 0.045 } },
    ring: { paint: C.ring, finish: { gloss: 0.3 } },
    bill: { paint: C.bill, finish: { gloss: 0.5 } },
    socket: { paint: C.ring, finish: { gloss: 0.3 } },
  });
  const leg: LegStyle = {
    // Zygodactyl: two toes forward, two back, grey and scaly with dark claws.
    skin: C.foot, claw: C.claw, thick: A.legThick, thigh: C.pale, fringe: 0.6, skinned: { r: 0.06 * s, at: 0.4 },
    toes: [{ yaw: -0.3, len: 0.085 * s, r: 0.016 * s }, { yaw: 0.3, len: 0.09 * s, r: 0.016 * s }, { yaw: Math.PI - 0.35, len: 0.075 * s, r: 0.015 * s }, { yaw: Math.PI + 0.35, len: 0.07 * s, r: 0.015 * s }],
    clawLen: 0.035 * s,
  };
  const wing: WingStyle = {
    covert: C.pale, secondary: mix(C.white, C.lemon, 0.25), primary: C.white, primaryTip: C.cool, trim: team.primary,
    thick: 0.036 * s, chord: 0.25 * s, primaries: 6, secondaries: 5, primaryLen: 0.52, secondaryLen: 0.7, finish: DOWN,
  };

  const body = (k: Sculpt): void => {
    const torso = field.only(...TRUNK).surface([0, 0.36 * s, -0.06 * s], [0, 1.24 * s, 0.0], [0, 0, 1]);
    const collar = field.only(...TRUNK, 'neck').surface([0, 0.4 * s, -0.04 * s], [0, A.head[1] - 0.14 * s, 0], [0, 0, 1]);
    // The folded wings down the flanks: white, their yellow-washed inner vanes showing under the edge.
    foldedWings(k, torso, wing, { t: [0.4, 0.82], a: 0.3, len: 0.36 * s, wid: 0.13 * s }, d);
    // The neckerchief in the flock colour, knotted at the back of the neck with its two ends hanging.
    band(k, collar, 0.86, { width: 0.07 * s, thick: 0.016 * s, hex: team.primary, stitch: team.light, off: 0.006 * s, finish: { gloss: 0.2 } }, d);
    if (d.level < 3) {
      const knot = collar.at(0.86, -Math.PI / 2, 0.03 * s);
      k.mesh(new TorusGeometry(0.022 * s, 0.014 * s, 4, d.n(8, 5)), { at: [knot.p.x, knot.p.y, knot.p.z], rot: [0, Math.PI / 2, 0], paint: team.dark, finish: { gloss: 0.2 } });
      for (const x of [1, -1]) {
        k.card({ at: [knot.p.x, knot.p.y, knot.p.z], dir: norm([x * 0.3, -1, -0.25]), face: [0, 0.2, -1], len: (x > 0 ? 0.26 : 0.21) * s, wid: 0.075 * s, cell: CARD.cloth, root: team.primary, tip: team.dark, curl: 0.2, sweep: x * 0.15, segs: d.level === 0 ? 4 : 2 });
      }
    }
    // The nut bandolier: over the right shoulder and round under the left wing, big nuts in leather loops.
    sash(k, torso, 0.62, 0.2, Math.PI * 0.35, { width: 0.05 * s, thick: 0.013 * s, hex: GEAR.leather, stitch: team.light, off: 0.014 * s, finish: LEATHER }, d);
    if (d.level < 2) {
      for (let i = 0; i < 4; i++) {
        const u = 0.18 + i * 0.075;
        const p = torso.at(0.62 + 0.2 * Math.cos(u * Math.PI * 2), Math.PI * 0.35 + u * Math.PI * 2, 0.045 * s);
        const at: V3 = [p.p.x, p.p.y, p.p.z];
        k.mesh(new TorusGeometry(0.03 * s, 0.006 * s, 3, 8), { at, rot: [Math.PI / 2, 0, 0], paint: GEAR.leatherDark, finish: LEATHER });
        lathe(k, [[0.0, 0.036 * s], [0.024 * s, 0.022 * s], [0.03 * s, 0], [0.024 * s, -0.022 * s], [0.0, -0.036 * s]], { at, rot: [0.3, 0.4 * i, 0], seg: 6, paint: (t) => shade(C.nut, 0.85 + 0.25 * Math.abs(Math.sin(t * 9))), finish: WOOD });
      }
    }
    pouch(k, torso.at(0.3, Math.PI * 1.2, 0.01 * s), [0.1 * s, 0.11 * s, 0.06 * s], GEAR.leather, d);
  };

  const head = (k: Sculpt): void => {
    // Soft white hackles over the nape under the crest's tips.
    const neckAxis: [V3, V3] = [[0, A.head[1] - 0.34 * s, -0.02 * s], [0, A.head[1] + hr, -0.04 * s]];
    hackles(k, inBone(field.only('neck', 'nape', 'crown').surface(...neckAxis, [0, 0, 1]), A.head), {
      t: [0.3, 0.64], a: [-Math.PI * 0.84, -Math.PI * 0.16], rows: 2, cols: 5, len: 0.11 * s, wid: 0.075 * s, lift: 0.22,
      paint: (t) => mix(C.pale, C.white, t), finish: DOWN, seed: 71,
    }, d);
    // The crest: long, pointed sulphur feathers in two ranks along the crown, swept back flat with their tips curling
    // up behind the head; on a cast they swing up into a tall fan (the display), doubling the bird's height.
    if (d.level < 3) {
      const n = d.keep(9, 3);
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0.5 : i / (n - 1);
        const rank = i % 2;
        const sx = rank ? 1 : -1;
        const at: V3 = [sx * hr * (0.05 + 0.08 * u), hr * (0.9 + 0.1 * u), hr * (0.55 - 1.0 * u)];
        // Each lies along the skull behind the one in front, a little higher and splayed to its side, so the tips
        // curl up into a swept yellow fan behind the head.
        const dir = norm([sx * 0.2 * u, 0.2 + 0.12 * u, -1]);
        const len = hr * (1.3 + 1.1 * u) * (rank ? 0.92 : 1);
        // Up through ~1.6 rad about the root, the front feathers furthest, so the raised fan leans a little forward.
        const lift = hinge(at, [1, 0, 0], 1.2 + 0.45 * (1 - u));
        const spread = hinge(at, [0, 0, 1], (u - 0.5) * 0.4 * sx);
        k.card({
          at, dir, face: [0, 1, 0], len, wid: hr * (0.34 - 0.06 * u), cell: CARD.primary,
          // A faint inner glow keeps the sulphur bright on the shaded side, the flame the player sees from behind.
          root: mix(C.white, C.lemon, 0.6), tip: C.sulphur, curl: 0.12 + 0.22 * u, segs: d.rows + 1, cup: 0.06, finish: { gloss: 0.25, glow: 0.18 },
          morph: { display: spread.multiply(lift) },
        });
      }
    } else {
      k.card({ at: [0, hr * 0.9, 0], dir: norm([0, 0.3, -1]), face: [0, 1, 0], len: hr * 2, wid: hr * 0.5, cell: CARD.primary, root: C.lemon, tip: C.sulphur, segs: 2, morph: { display: hinge([0, hr * 0.9, 0], [1, 0, 0], 1.5) } });
    }
    const E = COCKATOO_HEAD.eye;
    for (const x of [1, -1]) eye(k, [x * hr * E[0], hr * E[1], hr * E[2]], [x * 0.75, 0.05, 0.66], { r: hr * 0.2, iris: C.iris, ring: C.ring, lid: C.white, ringW: hr * 0.045, pupil: 0.5, sclera: 0x101012 }, d);
    // The bill: very deep at the base, the upper mandible curving hard down over the stubby lower one.
    const B = COCKATOO_HEAD.bill;
    beak(k, { at: [0, hr * B[1], hr * (B[2] - 0.06)], len: hr * 0.82, w: hr * 0.34, up: hr * 0.5, dn: hr * 0.36, curve: hr * 0.6, hook: hr * 0.26, base: C.bill, tip: shade(C.bill, 0.6), lower: shade(C.bill, 0.8), open: 0.35, lowerLen: 0.55 }, d);
  };

  const tail = (k: Sculpt): void => {
    // A broad, square-ended white tail, washed sulphur underneath, hanging down behind the perch.
    tailFan(k, { count: 8, len: 0.36 * s, wid: 0.075 * s, spread: 0.7, droop: 1.05, root: mix(C.white, C.lemon, 0.3), tip: C.white, cell: CARD.tail, finish: DOWN }, d);
  };

  return {
    body, head, tail, skin,
    wing: wingsOf(wing, d),
    leg: legsOf(leg, d),
    gun: screechHorn(s, d),
    pivot: { wingL: A.wing, wingR: flipX(A.wing), legL: A.hip, legR: flipX(A.hip), tail: A.tail },
    legLen: A.legLen, legThick: leg.thick, wingLen: H * 0.36,
    // Screech (shrieked down the horn), Crest Flare, Seed Crack (a nut lobbed), Sulphur Shriek (stands tall).
    casts: ['aim', 'raise', 'throw', 'raise'],
    sway: 0.05, castTail: -0.3,
  };
}

/** Screech Horn: a flared brass bell, a glowing sulphur chamber in a brass cage, coiled tubing, valves and a bone stock. */
function screechHorn(s: number, d: Detail): SculptedSpec['gun'] {
  const L = 0.6 * s;
  const C = COCKATOO;
  return {
    main: [0, -0.06 * s, -L * 0.7],
    support: [0, -0.03 * s, 0],
    slideAt: [0, -0.01 * s, -L * 0.36],
    travel: 0.02 * s,
    build(k, part) {
      if (part === 'slide') {
        if (d.level >= 3) return;
        // The fore-grip: a bone collar round the leadpipe.
        lathe(k, [[0.02 * s, 0.04 * s], [0.026 * s, 0.03 * s], [0.026 * s, -0.03 * s], [0.02 * s, -0.04 * s]], { seg: d.n(10, 4), paint: C.bone, finish: { gloss: 0.4 } });
        return;
      }
      if (part !== 'gun') return;
      // The bell: wide and flared, rolled at the rim (the gun's silhouette at any distance).
      lathe(k, [[0.075 * s, 0], [0.068 * s, -0.012 * s], [0.04 * s, -0.04 * s], [0.022 * s, -0.09 * s], [0.014 * s, -0.16 * s], [0.012 * s, -L * 0.45]], { seg: d.n(14, 5), paint: (t) => (t < 0.08 ? GEAR.brass : shade(GEAR.brass, 0.92)), finish: BRASS });
      if (d.level >= 2) {
        lathe(k, [[0.03 * s, -L * 0.45], [0.03 * s, -L * 0.65], [0.026 * s, -L]], { seg: 4, paint: d.level === 2 ? C.bone : GEAR.brass });
        return;
      }
      // The muzzle light: a sulphur glass bead seated in the throat of the bell.
      bead(k, [0, 0, -0.07 * s], 0.016 * s, C.sulphur, 0.85, d);
      // The glowing chamber in its brass cage, the ammo read.
      bead(k, [0, 0.006 * s, -L * 0.5], 0.03 * s, 0xffd84a, 0.9, d, [1, 1, 1.4]);
      lathe(k, [[0.034 * s, -L * 0.43], [0.038 * s, -L * 0.45], [0.038 * s, -L * 0.55], [0.034 * s, -L * 0.57]], { at: [0, 0.006 * s, 0], seg: d.level === 0 ? 6 : 4, paint: GEAR.brassDark, finish: BRASS, sq: 1.2 });
      // The coil of tubing round the leadpipe, and three valves on top.
      k.mesh(new TorusGeometry(0.036 * s, 0.007 * s, 4, d.n(14, 6)), { at: [0, -0.01 * s, -L * 0.33], rot: [0, Math.PI / 2, 0], paint: GEAR.brass, finish: BRASS });
      if (d.level < 1) for (let i = 0; i < 3; i++) lathe(k, [[0.007 * s, 0.03 * s], [0.007 * s, 0.0]], { at: [0, 0.03 * s, -L * (0.6 + i * 0.04)], rot: [-Math.PI / 2, 0, 0], seg: 6, paint: GEAR.brassDark, finish: BRASS, caps: true });
      // The body tube back to the reed, the pistol grip and the carved bone stock with a sulphur tassel.
      lathe(k, [[0.016 * s, -L * 0.57], [0.018 * s, -L * 0.7], [0.012 * s, -L * 0.74]], { seg: d.n(10, 4), paint: GEAR.brass, finish: BRASS });
      carve(k, [[-L * 0.66, -0.016 * s], [-L * 0.74, -0.016 * s], [-L * 0.8, -0.1 * s], [-L * 0.72, -0.105 * s]], 0.026 * s, C.bone, { gloss: 0.4 }, d);
      carve(k, [[-L * 0.72, 0.022 * s], [-L * 0.9, 0.03 * s], [-L, 0.012 * s], [-L * 1.0, -0.06 * s], [-L * 0.94, -0.07 * s], [-L * 0.78, -0.03 * s]], 0.03 * s, C.bone, { gloss: 0.4 }, d, [0, 0, 0], (z, y) => (Math.sin(z * 180 + y * 60) > 0.75 ? shade(C.bone, 0.82) : C.bone));
      if (d.level < 1) for (let i = 0; i < 2; i++) plume(k, [0, -0.05 * s, -L * 0.97], [0.15 * (i - 0.5), -1, -0.2], 0.1 * s, 0.03 * s, C.sulphur, CARD.cloth, [1, 0, 0], C.lemon);
    },
  };
}

export const B3_BUILDS: Readonly<Record<string, SculptedBird>> = { frigatebird, cockatoo };
