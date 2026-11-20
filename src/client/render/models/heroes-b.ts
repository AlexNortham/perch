/* eslint-disable @typescript-eslint/no-magic-numbers -- authored proportions: the numbers are the data */
/**
 * The B1 and A2 birds (GDD §9.5 to §9.12): owl, pelican, secretarybird, starling, hornbill, flamingo, penguin and
 * puffin. Like heroes.ts every size comes from the hero's BodyPlan at runtime (head shell on the head hitbox, body
 * inside the capsule, gun tip at the muzzle); only fractions of height, radius and head radius are written here.
 */
import { SphereGeometry } from 'three';
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import type { TeamColours } from '../palette';
import { beak, eye, foldedWings, hackles, inBone, legsOf, norm, tailFan, wingsOf } from './anatomy';
import type { LegStyle, WingStyle } from './anatomy';
import { assemble, dims, eyes, headShell } from './bird';
import type { BirdBuild } from './bird';
import { bodyField, FLAMINGO_HEAD, flamingoAnchors, flipX, HORNBILL_HEAD, hornbillAnchors, skinFor, TRUNK } from './bodies';
import { PLUMAGE, PLUMAGE_NEW as C } from './constants';
import { SKIN as FLAMINGO_SKIN } from './data/skins/flamingo';
import { SKIN as HORNBILL_SKIN } from './data/skins/hornbill';
import { CARD } from './feathers';
import { band, bead, block, BRASS, buckle, carve, GEAR, LEATHER, lathe, pouch, ring, sash, WOOD } from './gear';
import { Parts } from './parts';
import type { Detail, SculptedBird, SculptedSpec } from './sculpted';
import { hinge, mix, shade } from './sculpt';
import type { Sculpt } from './sculpt';

type Build = (plan: BodyPlan, team: TeamColours) => BirdBuild;
type V3 = [number, number, number];

/** A pivot table for the common layout: parts hang where the body's shoulders, hips and rump are. */
const pivots = (o: { sy: number; legLen: number; R: number; legX: number; tailY: number; tailZ: number }) => ({
  wingL: [o.R * 0.95, o.sy, 0] as V3,
  wingR: [-o.R * 0.95, o.sy, 0] as V3,
  legL: [o.legX, o.legLen, 0] as V3,
  legR: [-o.legX, o.legLen, 0] as V3,
  tail: [0, o.tailY, o.tailZ] as V3,
});

/** Secretarybird: stilt legs (60% of height) in black breeches, small grey body, bare orange face, a quill crown. */
const secretarybird: Build = (plan, team) => {
  const { H, R, hr, top } = dims(plan);
  const legLen = H * 0.6;
  const y0 = legLen * 0.95;
  const cy = (y0 + top) / 2;
  const ry = (top - y0) / 2;
  const body = new Parts()
    .ell(C.secGrey, [R * 0.95, ry, R * 1.2], [0, cy, -R * 0.1])
    .ell(team.primary, [hr * 1.5, H * 0.015, hr * 1.5], [0, top - H * 0.005, 0]);
  const head = headShell(new Parts(), C.secGrey, hr)
    .ell(C.secFace, [hr * 0.9, hr * 0.8, hr * 0.4], [0, -hr * 0.05, hr * 0.7])
    .cone(PLUMAGE.shrikeBill, hr * 0.4, hr * 1.1, [0, -hr * 0.2, hr * 0.95], [0.3, 0, 0]);
  eyes(head, hr, 0.2, 0.6);
  for (const s of [1, -1]) {
    for (let i = 0; i < 4; i++) {
      head.rod(C.secBlack, [s * hr * 0.2, hr * 0.5, -hr * 0.7], [s * hr * (0.3 + i * 0.35), hr * (1.5 + i * 0.35), -hr * (2.4 + i * 0.5)], hr * 0.1);
    }
  }
  const thin = H * 0.012;
  const tail = new Parts().box(C.secBlack, [R * 0.5, H * 0.012, H * 0.3], [0, 0, -H * 0.15]).box(C.secGrey, [R * 0.5, H * 0.014, H * 0.04], [0, 0, -H * 0.28]);
  return assemble(plan, {
    body, head, tail,
    wing: { hex: C.secGrey, len: ry * 2.2, chord: R * 1.2, thick: R * 0.1, trim: C.secBlack },
    // Stilts in black breeches.
    leg: { hex: C.secFace, len: legLen, thick: thin, foot: R * 0.5, thigh: C.secBlack, thighThick: thin * 4 },
    gun: { length: 0.4, thick: 0.045, barrels: 2, main: 0.72, support: 0.3 },
    pivot: pivots({ sy: cy + ry * 0.6, legLen, R, legX: R * 0.4, tailY: cy, tailZ: -R * 1.2 }),
    // Stomp Kick, Long Stride, Snake Stamp, Viper Dance.
    casts: ['stomp', 'leap', 'leap', 'stomp'],
    sway: 0.05, castTail: -0.5,
  });
};

/** Starling: small and spiky, ruffled shoulders, a square tail, and a halo of eight tiny starlings at head height. */
const starling: Build = (plan, team) => {
  const { H, R, hc, hr, top } = dims(plan);
  const legLen = H * 0.17;
  const y0 = legLen * 0.9;
  const cy = (y0 + top) / 2;
  const ry = (top - y0) / 2;
  const body = new Parts()
    .ell(C.starBlack, [R * 0.95, ry, R * 1.2], [0, cy, -R * 0.1])
    .ell(C.starGreen, [R * 0.85, ry * 0.7, R * 0.9], [0, cy + ry * 0.2, -R * 0.2])
    .ell(team.primary, [hr * 1.3, H * 0.03, hr * 1.3], [0, hc - hr * 0.95, 0]);
  for (const s of [1, -1]) {
    for (let i = 0; i < 3; i++) body.cone(i === 1 ? C.starPurple : C.starGreen, R * 0.18, R * 0.8, [s * R * (0.5 + i * 0.12), cy + ry * (0.55 - i * 0.12), -R * (0.1 + i * 0.35)], [-Math.PI / 2 + 0.5 + i * 0.2, s * (0.6 + i * 0.15), 0]);
  }
  for (let i = 0; i < 5; i++) body.ell(C.starSpeck, [0.025, 0.025, 0.025], [Math.sin(i * 2.4) * R * 0.6, cy + ry * 0.3 - i * ry * 0.15, -R * 0.5 - Math.cos(i * 2.4) * R * 0.3], [0, 0, 0], [4, 3]);
  const head = headShell(new Parts(), C.starBlack, hr)
    .ell(C.starPurple, [hr * 0.9, hr * 0.5, hr * 0.8], [0, hr * 0.4, -hr * 0.1])
    .cone(PLUMAGE.shrikeBill, hr * 0.35, hr * 1.5, [0, -hr * 0.1, hr * 0.85]);
  eyes(head, hr, 0.15, 0.62);
  const tail = new Parts().box(C.starBlack, [R * 0.8, H * 0.02, H * 0.14], [0, 0, -H * 0.07]);
  const halo = new Parts();
  const ringR = Math.max(R * 1.7, hr * 3.2);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const at: V3 = [Math.sin(a) * ringR, Math.sin(a * 3) * hr * 0.2, Math.cos(a) * ringR];
    const yaw: V3 = [0, a + Math.PI / 2, 0];
    halo.ell(C.starPurple, [0.05, 0.05, 0.1], at, yaw, [5, 4]).box(C.starGreen, [0.2, 0.012, 0.06], at, yaw).cone(C.starSpeck, 0.02, 0.05, [at[0] + Math.sin(a + Math.PI / 2) * 0.09, at[1], at[2] + Math.cos(a + Math.PI / 2) * 0.09], yaw);
  }
  return assemble(plan, {
    body, head, tail, halo,
    wing: { hex: C.starBlack, len: H * 0.4, chord: R * 1.1, thick: R * 0.1, trim: team.primary },
    leg: { hex: PLUMAGE.leg, len: legLen, thick: H * 0.02, foot: R * 0.4 },
    gun: { length: 0.4, thick: 0.05, main: 0.72, support: 0.3 },
    pivot: pivots({ sy: cy + ry * 0.55, legLen, R, legX: R * 0.4, tailY: cy, tailZ: -R * 1.2 }),
    // Murmuration, Mob, Scatter, Black Sun.
    casts: ['throw', 'throw', 'leap', 'raise'],
    sway: 0, castTail: -0.5,
  });
};

// =================================================================================================================
// Hornbill: upright and heavy-chested, a black face and crown, a cream neck ruff, a black body with a white belly and
// wing bar, and a long white tail barred black. A huge down-curved bill, orange at the base and yellow to the tip,
// carries a tall yellow helmet casque that doubles the head's height. Red eyes with lashes. Gun carry: the Casque Rifle,
// a heavy barrel under a horn casque shroud, fed by a revolving brass cylinder that turns as it fires.

const HORNBILL = {
  black: 0x1e1e24,
  sheen: 0x2e3242,
  cream: 0xf0e0a4,
  white: 0xf2f0e8,
  yellow: 0xf4c432,
  orange: 0xe8782a,
  red: 0xc83a26,
  iris: 0xc42a1a,
  leg: 0x56565c,
  claw: 0x1c1c1e,
  horn: 0xd8a040,
} as const;

const hornbill: SculptedBird = (plan, team, d) => {
  const H = plan.height;
  const hr = plan.head.radius;
  const A = hornbillAnchors(plan);
  const s = A.s;
  const P = HORNBILL;
  const PLUME = { tile: 1, size: 0.1, gloss: 0.3, iri: 0.25 } as const;
  const field = bodyField('hornbill', plan);
  const behind = (p: { z: number }, z0: number, w: number): number => Math.min(1, Math.max(0, (z0 - p.z) / w));
  const skin = skinFor('hornbill', plan, HORNBILL_SKIN, d.level, {
    back: { paint: P.black, finish: PLUME },
    mantle: { paint: mix(P.black, P.sheen, 0.4), finish: PLUME },
    scapular: { paint: mix(P.black, P.sheen, 0.3), finish: PLUME },
    shoulder: { paint: P.black, finish: PLUME },
    coverts: { paint: P.black, finish: PLUME },
    // A black breast over a white belly, the border soft.
    breast: { paint: (p) => mix(P.black, P.white, Math.min(1, Math.max(0, (1.0 * s - p.y) / (0.1 * s)))), finish: PLUME },
    belly: { paint: (p) => mix(P.white, P.black, Math.min(1, Math.max(0, (p.y - 0.92 * s) / (0.1 * s)))), finish: { tile: 1, size: 0.09, gloss: 0.15 } },
    thigh: { paint: P.white, finish: { tile: 1, size: 0.07, gloss: 0.15 } },
    // The cream neck: black at the front low down, cream all round above, as preen oil stains it.
    neck: { paint: (p) => mix(P.cream, P.black, Math.min(1, Math.max(0, (1.36 * s - p.y) / (0.08 * s)) * Math.min(1, Math.max(0, p.z / (0.06 * s) + 0.5)))), finish: { tile: 1, size: 0.08, gloss: 0.2 } },
    // A black face and fore-crown; the cream runs up the back of the head into the nape.
    crown: { paint: (p) => mix(P.black, P.cream, behind(p, A.head[2] - 0.02 * s, 0.1 * s)), finish: { tile: 1, size: 0.06, gloss: 0.25 } },
    nape: { paint: P.cream, finish: { tile: 1, size: 0.06, gloss: 0.2 } },
    face: { paint: P.black, finish: { gloss: 0.3 } },
    cheek: { paint: (p) => mix(P.black, P.cream, behind(p, A.head[2] + 0.02 * s, 0.08 * s)), finish: { gloss: 0.25 } },
    brow: { paint: P.black, finish: { gloss: 0.3 } },
    throat: { paint: P.black, finish: { gloss: 0.25 } },
    socket: { paint: P.black, finish: { gloss: 0.4 } },
    bill: { paint: P.orange, finish: { gloss: 0.55 } },
    // The casque: yellow, flushed orange at the front horn and toward the back.
    casque: { paint: (p) => mix(P.yellow, P.orange, Math.min(0.8, Math.max(0, (p.z - A.head[2] - 0.3 * s) / (0.12 * s)) + Math.max(0, (A.head[2] + 0.16 * s - p.z) / (0.1 * s)))), finish: { gloss: 0.6 } },
    rim: { paint: P.black, finish: { gloss: 0.4 } },
  });
  const leg: LegStyle = {
    skin: P.leg, claw: P.claw, thick: A.legThick, thigh: P.white, fringe: 0.35, skinned: { r: 0.06 * s, at: 0.2 },
    // Syndactyl: three forward toes joined at the base, one back.
    toes: [{ yaw: -0.32, len: 0.1 * s }, { yaw: 0, len: 0.115 * s }, { yaw: 0.32, len: 0.1 * s }, { yaw: Math.PI, len: 0.07 * s }],
    clawLen: 0.035 * s,
  };
  const wing: WingStyle = {
    covert: P.black, secondary: P.black, primary: P.black, primaryTip: P.white, trim: team.primary,
    thick: 0.036 * s, chord: 0.26 * s, primaries: 7, secondaries: 6, primaryLen: 0.55, secondaryLen: 0.95, finish: { ...PLUME, size: 0.16 },
  };

  const body = (k: Sculpt): void => {
    // The body is the baked implicit skin (bodies.ts); gear and feathers sit on its surface.
    const axis: V3 = [0, 0.5 * s, -0.08 * s];
    const top: V3 = [0, A.head[1] - 0.24 * s, 0.03 * s];
    const torso = field.only(...TRUNK).surface(axis, top, [0, 0, 1]);
    // The folded wings down the flanks, black with the white trailing edge.
    foldedWings(k, field.only(...TRUNK).surface([0, 0.6 * s, -0.22 * s], [0, 1.3 * s, 0.06 * s]), { ...wing, secondary: mix(P.black, P.white, 0.15) }, { t: [0.4, 0.8], a: 0.4, len: 0.36 * s, wid: 0.13 * s }, d);
    // Gear: a flock bandolier of brass rounds over the left shoulder (it feeds the rifle) and a leather strap crossing
    // it, both reading from behind; a heavy belt with two ammunition pouches.
    const off = 0.012 * s;
    sash(k, torso, 0.62, 0.2, Math.PI * 0.7, { width: 0.07 * s, thick: 0.016 * s, hex: team.primary, stitch: team.light, off, finish: { gloss: 0.3 } }, d);
    if (d.level === 0) {
      for (let i = 0; i < 9; i++) {
        const u = 0.25 + i * 0.13;
        const p = torso.at(0.62 + 0.2 * Math.cos(u), Math.PI * 0.7 + u, off + 0.03 * s);
        lathe(k, [[0.007 * s, 0.03 * s], [0.012 * s, 0.018 * s], [0.012 * s, -0.026 * s]], { at: [p.p.x, p.p.y, p.p.z], rot: [Math.PI / 2 - 0.4, 0, -0.4 + 0.1 * i], seg: 6, paint: (t) => (t < 0.3 ? GEAR.brassDark : GEAR.brass), finish: BRASS });
      }
    }
    sash(k, torso, 0.62, 0.2, Math.PI * 0.3, { width: 0.05 * s, thick: 0.014 * s, hex: GEAR.leatherDark, off: off + 0.004 * s, finish: LEATHER }, d);
    band(k, torso, 0.32, { width: 0.06 * s, thick: 0.016 * s, hex: GEAR.leather, off, finish: LEATHER }, d);
    buckle(k, torso.at(0.32, Math.PI / 2, off + 0.016 * s), 0.06 * s, d);
    for (const a of d.level === 0 ? [Math.PI * 0.15, Math.PI * 0.88] : [Math.PI * 0.15]) pouch(k, torso.at(0.3, a, off), [0.11 * s, 0.12 * s, 0.06 * s], GEAR.leatherDark, d);
  };

  const head = (k: Sculpt): void => {
    // A cream ruff of hackles over the back of the neck and nape.
    const neckAxis: [V3, V3] = [[0, A.head[1] - 0.36 * s, -0.02 * s], [0, A.head[1] + hr, -0.04 * s]];
    hackles(k, inBone(field.only('neck', 'nape', 'crown').surface(...neckAxis, [0, 0, 1]), A.head), {
      t: [0.3, 0.7], a: [-Math.PI * 0.85, -Math.PI * 0.15], rows: 3, cols: 5, len: 0.1 * s, wid: 0.08 * s, lift: 0.24,
      paint: (t) => mix(shade(P.cream, 0.92), P.cream, t), finish: { tile: 1, size: 0.06, gloss: 0.2 }, seed: 61,
    }, d);
    const E = HORNBILL_HEAD.eye;
    for (const x of [1, -1]) {
      eye(k, [x * hr * E[0], hr * E[1], hr * E[2]], [x * 0.78, 0.05, 0.62], { r: hr * 0.22, iris: P.iris, ring: P.black, lid: P.black, ringW: hr * 0.05, pupil: 0.42 }, d);
      // Long lashes over each eye.
      if (d.level === 0) {
        for (let i = 0; i < 3; i++) {
          const u = i / 2 - 0.5;
          const at: V3 = [x * hr * (E[0] + 0.12), hr * (E[1] + 0.22), hr * (E[2] + u * 0.32)];
          k.card({ at, dir: norm([x * 0.5, 1, 0.3 + u * 0.4]), face: [x, 0, 0], len: 0.035 * s, wid: 0.008 * s, cell: CARD.quill, root: P.black, tip: shade(P.black, 1.4), curl: -0.6, segs: 2 });
        }
      }
    }
    // The bill: deep, curving down, orange at the base to yellow at the tip, its cutting edge serrated.
    const B = HORNBILL_HEAD.bill;
    beak(k, {
      at: [0, hr * B[1], hr * (B[2] - 0.04)], len: hr * 2.35, w: hr * 0.32, up: hr * 0.4, dn: hr * 0.3, curve: hr * 0.62, hook: hr * 0.12,
      base: P.orange, tip: shade(P.yellow, 1.12), lower: P.yellow, bands: [[0, P.red], [0.12, P.orange], [0.35, P.yellow]], teeth: 4, open: 0.3, displayOpen: 0.45,
    }, d);
  };

  const tail = (k: Sculpt): void => {
    // Long, white, barred black, fanning on a cast.
    tailFan(k, {
      count: 9, len: 0.6 * s, wid: 0.09 * s, spread: 0.55, droop: 0.95, root: P.white, tip: P.white, cell: CARD.barredTail, finish: { gloss: 0.25 },
      display: (u, at) => hinge(at, [0, 0, 1], u * 0.35),
    }, d);
    if (d.level < 2) tailFan(k, { count: 6, len: 0.24 * s, wid: 0.1 * s, spread: 0.6, droop: 0.9, root: P.black, tip: P.sheen, cell: CARD.tail, at: [0, 0.02 * s, 0.02 * s], finish: PLUME }, d);
  };

  return {
    body, head, tail, skin,
    wing: wingsOf(wing, d),
    leg: legsOf(leg, d),
    gun: hornbillGun(s, d),
    pivot: { wingL: A.wing, wingR: flipX(A.wing), legL: A.hip, legR: flipX(A.hip), tail: A.tail },
    legLen: A.legLen, legThick: leg.thick, wingLen: H * 0.36,
    // Heavy Rounds, Mud Seal, Bounding Hop, Marked Prey.
    casts: ['aim', 'raise', 'leap', 'aim'],
    sway: 0.03, castTail: -0.25, castWiden: 0.2,
    spinRate: 14,
  };
};

/** Casque Rifle: a heavy iron barrel under a horn casque shroud, a slotted muzzle brake, a revolving brass cylinder that turns as it fires, a heavy stock. */
function hornbillGun(s: number, d: Detail): SculptedSpec['gun'] {
  const P = HORNBILL;
  const L = 0.8 * s;
  const r = 0.017 * s;
  return {
    main: [0, -0.07 * s, -L * 0.7],
    support: [0, -0.034 * s, 0],
    slideAt: [0, -0.012 * s, -L * 0.3],
    travel: 0.035 * s,
    spinAt: [0, 0, -L * 0.52],
    build(k, part) {
      if (part === 'spin') {
        if (d.level >= 3) return;
        // The cylinder: six chambers round the bore, turning while it fires.
        lathe(k, [[0.04 * s, 0.045 * s], [0.046 * s, 0.035 * s], [0.046 * s, -0.035 * s], [0.04 * s, -0.045 * s]], {
          seg: d.n(14, 6), caps: true, paint: (_t, a) => (d.level === 0 && Math.cos(a * 6) > 0.75 ? 0x2a2018 : GEAR.brass), finish: BRASS,
        });
        if (d.level < 2) for (const z of [0.03, -0.03]) ring(k, [0, 0, z * s], 0.047 * s, 0.004 * s, d, GEAR.brassDark);
        return;
      }
      if (part === 'slide') {
        if (d.level >= 3) return;
        block(k, [0.05 * s, 0.045 * s, 0.13 * s], [0, -0.01 * s, 0], GEAR.woodDark, WOOD, d);
        return;
      }
      if (part !== 'gun') return;
      if (d.level >= 3) {
        lathe(k, [[r * 1.6, 0], [r * 1.2, -L * 0.5], [0.05 * s, -L * 0.55], [0.045 * s, -L]], { seg: 4, paint: GEAR.iron });
        return;
      }
      // The muzzle brake, slotted, with an amber bead.
      lathe(k, [[r * 1.8, 0], [r * 2.1, -0.012 * s], [r * 2.1, -0.05 * s], [r * 1.5, -0.06 * s]], { seg: d.n(12, 5), paint: (t) => (d.level === 0 && Math.sin(t * 22) > 0.6 ? 0x1a1a1a : GEAR.iron), finish: { gloss: 0.7 } });
      bead(k, [0, 0, -0.008 * s], r * 1.1, 0xffb04a, 0.9, d);
      lathe(k, [[r * 1.15, -0.055 * s], [r * 1.1, -L * 0.3], [r * 1.25, -L * 0.46]], { seg: d.n(12, 5), paint: GEAR.iron, finish: { gloss: 0.6 } });
      // The casque shroud: a horn ridge along the top of the barrel, rising to a helmet over the action.
      carve(k, [[-0.05 * s, r * 0.6], [-L * 0.2, r * 1.2], [-L * 0.4, 0.04 * s], [-L * 0.47, 0.085 * s], [-L * 0.36, 0.09 * s], [-L * 0.18, 0.04 * s], [-0.06 * s, r * 1.6]], 0.03 * s, P.horn, { gloss: 0.6 }, d, [0, 0, 0], (z) => mix(P.yellow, P.orange, Math.min(1, Math.max(0, -z / (L * 0.45)))));
      for (const z of [0.12, 0.26]) ring(k, [0, 0, -L * z], r * 1.25, r * 0.3, d);
      // The action, the grip, and a heavy stock.
      block(k, [0.06 * s, 0.08 * s, 0.16 * s], [0, -0.01 * s, -L * 0.66], GEAR.iron, { gloss: 0.5 }, d);
      carve(k, [[-L * 0.66, -0.04 * s], [-L * 0.74, -0.04 * s], [-L * 0.8, -0.14 * s], [-L * 0.72, -0.145 * s]], 0.034 * s, GEAR.woodDark, WOOD, d);
      carve(k, [[-L * 0.72, 0.03 * s], [-L * 0.98, 0.025 * s], [-L * 1.02, -0.1 * s], [-L * 0.95, -0.12 * s], [-L * 0.76, -0.05 * s]], 0.05 * s, GEAR.wood, WOOD, d);
      if (d.level === 0) {
        // The feed: a short belt of brass rounds hanging from the cylinder's left.
        for (let i = 0; i < 5; i++) {
          const u = i / 4;
          lathe(k, [[0.006 * s, 0.02 * s], [0.009 * s, 0.01 * s], [0.009 * s, -0.018 * s]], { at: [0.05 * s + u * 0.01 * s, -0.02 * s - u * 0.07 * s, -L * 0.5 + u * u * 0.04 * s], rot: [0, Math.PI / 2, 0], seg: 6, paint: GEAR.brass, finish: BRASS });
        }
      }
    },
  };
}

// =================================================================================================================
// Flamingo: a pink stick figure. A small oval body carried level on very long coral legs (it idles on one), a slender
// S-neck with fluffed hackles, a small head with a pale eye and a deep bill bent sharply down at the middle, pale
// pink to a black tip. Coral coverts and black flight feathers fold down the flanks and flare on a cast. A flock
// ribbon bow at the nape, a flock sash and a shell pouch. Support: the Wader Repeater, a reed barrel in brass bands,
// a conch magazine and a coral bell whose bead glows.

const FLAMINGO = {
  pink: 0xf597b0,
  pale: 0xf8c4d0,
  coral: 0xe4506e,
  deep: 0xc83a5a,
  black: 0x1c1a20,
  leg: 0xe2768e,
  knee: 0xb8506a,
  bill: 0xf2c2c6,
  billPale: 0xf6e8e2,
  iris: 0xf0d040,
  reed: 0xc8b070,
  conch: 0xf4d6c4,
} as const;

/** The flamingo's bill: deep at the base, straight to the middle, then bent sharply down to a black tip; the lower
 * mandible a deep keel that opens on the jaw morph. Head frame, base at `at`. */
function flamingoBill(k: Sculpt, at: V3, hr: number, d: Detail): void {
  const P = FLAMINGO;
  const n = d.n(12, 3);
  const len = hr * 2.3;
  const path = (t: number, below: number): { c: V3; n: V3 } => {
    // March along the bill: level, then the bend.
    let y = at[1] - below;
    let z = at[2];
    let th = -0.12;
    const steps = 24;
    for (let i = 0; i < Math.round(steps * t); i++) {
      const u = i / steps;
      th = -0.12 - 1.05 * Math.min(1, Math.max(0, (u - 0.36) / 0.16));
      y += Math.sin(th) * (len / steps);
      z += Math.cos(th) * (len / steps);
    }
    return { c: [at[0], y, z], n: [0, Math.cos(th), -Math.sin(th)] };
  };
  const paint = (t: number): number => (t > 0.62 ? P.black : t > 0.52 ? mix(P.billPale, P.black, (t - 0.52) / 0.1) : mix(P.bill, P.billPale, t / 0.52));
  const upper = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const { c, n: up } = path(t, 0);
    return { c, n: up, w: hr * 0.34 * (1 - 0.7 * t), up: hr * 0.36 * (1 - 0.75 * t), dn: hr * 0.06 * (1 - t) };
  });
  upper.push({ c: path(1.03, 0).c, n: upper[upper.length - 1]!.n, w: 0, up: 0, dn: 0 });
  k.loft(upper, { seg: d.n(10, 3), paint: (t, a) => (Math.sin(a) < -0.3 ? shade(paint(t), 0.85) : paint(t)), finish: { gloss: 0.55 } });
  const pivot: V3 = [at[0], at[1] - hr * 0.04, at[2] - hr * 0.08];
  const lower = Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * 0.94;
    const { c, n: up } = path(t, hr * 0.05);
    return { c, n: up, w: hr * 0.32 * (1 - 0.7 * t), up: hr * 0.05, dn: hr * 0.34 * (1 - 0.8 * t) };
  });
  lower.push({ c: path(0.97, hr * 0.05).c, n: lower[lower.length - 1]!.n, w: 0, up: 0, dn: 0 });
  k.loft(lower, { seg: d.n(10, 3), paint: (t) => shade(paint(t * 0.94), 0.92), finish: { gloss: 0.5 }, morph: { jaw: hinge(pivot, [1, 0, 0], 0.32), display: hinge(pivot, [1, 0, 0], 0.4) } });
}

const flamingo: SculptedBird = (plan, team, d) => {
  const H = plan.height;
  const hr = plan.head.radius;
  const A = flamingoAnchors(plan);
  const s = A.s;
  const P = FLAMINGO;
  const SOFT = { tile: 1, size: 0.08, gloss: 0.2 } as const;
  const field = bodyField('flamingo', plan);
  const skin = skinFor('flamingo', plan, FLAMINGO_SKIN, d.level, {
    // Coral on the back and shoulders, deepening to the rump: the darker mantle under a pale head and neck.
    back: { paint: (p) => mix(P.pink, P.coral, Math.min(1, Math.max(0, (p.y - 1.3 * s) / (0.12 * s)))), finish: SOFT },
    mantle: { paint: P.coral, finish: SOFT },
    scapular: { paint: P.coral, finish: SOFT },
    shoulder: { paint: P.coral, finish: SOFT },
    coverts: { paint: P.deep, finish: SOFT },
    breast: { paint: P.pink, finish: SOFT },
    belly: { paint: mix(P.pink, P.pale, 0.3), finish: SOFT },
    thigh: { paint: P.pink, finish: { ...SOFT, size: 0.06 } },
    neck: { paint: (p) => mix(P.pink, P.pale, Math.min(1, Math.max(0, (p.y - 1.5 * s) / (0.5 * s)))), finish: { ...SOFT, size: 0.06 } },
    crown: { paint: P.pale, finish: { ...SOFT, size: 0.05 } },
    nape: { paint: P.pale, finish: { ...SOFT, size: 0.05 } },
    face: { paint: mix(P.pale, 0xffffff, 0.3), finish: { gloss: 0.2 } },
    cheek: { paint: P.pale, finish: { gloss: 0.2 } },
    brow: { paint: P.pale, finish: { gloss: 0.2 } },
    throat: { paint: P.pale, finish: SOFT },
    bill: { paint: P.bill, finish: { gloss: 0.5 } },
    socket: { paint: mix(P.pale, P.coral, 0.4), finish: { gloss: 0.3 } },
  });
  const leg: LegStyle = {
    // Bare legs all the way up: the thigh is a thin coral loft under the feathered top of the leg (the skin's).
    skin: P.leg, claw: P.knee, thick: A.legThick,
    toes: [{ yaw: -0.45, len: 0.1 * s }, { yaw: 0, len: 0.115 * s }, { yaw: 0.45, len: 0.1 * s }],
    clawLen: 0.015 * s,
  };
  // Coral coverts over black flight feathers, flaring on a cast (the wing salute).
  const wing: WingStyle = {
    covert: P.coral, secondary: P.black, primary: P.black, primaryTip: shade(P.black, 1.3), trim: team.primary,
    thick: 0.026 * s, chord: 0.22 * s, primaries: 7, secondaries: 6, primaryLen: 0.6, secondaryLen: 1.0, finish: SOFT, displayFlare: 0.6, secondaryFlare: 0.5,
  };

  const body = (k: Sculpt): void => {
    // The body is the baked implicit skin (bodies.ts); gear and feathers sit on its surface.
    const torso = field.only(...TRUNK).surface([0, 1.34 * s, -0.42 * s], [0, 1.4 * s, 0.22 * s]);
    // Coral coverts and black flight feathers folded down the flanks: the flamingo's black edge from the side.
    foldedWings(k, torso, wing, { t: [0.3, 0.68], a: 0.55, len: 0.32 * s, wid: 0.1 * s }, d);
    // Gear: a flock sash round the body over the left shoulder, and a woven shell pouch on the right hip.
    const off = 0.01 * s;
    sash(k, torso, 0.6, 0.12, Math.PI * 0.5, { width: 0.06 * s, thick: 0.014 * s, hex: team.primary, stitch: team.light, off, finish: { gloss: 0.35 } }, d);
    pouch(k, torso.at(0.42, -Math.PI * 0.85, off), [0.09 * s, 0.1 * s, 0.05 * s], GEAR.rope, d, shade(GEAR.rope, 0.75));
    if (d.level < 2) {
      const p = torso.at(0.42, -Math.PI * 0.85, off + 0.06 * s);
      lathe(k, [[0.0, 0.03 * s], [0.016 * s, 0.018 * s], [0.022 * s, -0.004 * s], [0.012 * s, -0.026 * s], [0, -0.03 * s]], { at: [p.p.x, p.p.y + 0.02 * s, p.p.z], rot: [0.4, 0, 0.6], seg: 8, paint: (t) => mix(P.conch, P.coral, t), finish: { gloss: 0.6 } });
    }
  };

  const head = (k: Sculpt): void => {
    // Fluffed hackles down the back of the upper neck, and a flock ribbon tied in a bow at the nape.
    const neckAxis: [V3, V3] = [[0, A.head[1] - 0.36 * s, -0.04 * s], [0, A.head[1] + hr, -0.02 * s]];
    const neckSurf = inBone(field.only('neck', 'nape', 'crown').surface(...neckAxis, [0, 0, 1]), A.head);
    hackles(k, neckSurf, {
      t: [0.04, 0.38], a: [-Math.PI * 0.85, -Math.PI * 0.15], rows: 4, cols: 4, len: 0.085 * s, wid: 0.06 * s, lift: 0.3,
      paint: (t) => mix(P.pink, P.pale, t), finish: SOFT, seed: 81,
    }, d);
    if (d.level < 3) {
      band(k, neckSurf, 0.44, { width: 0.035 * s, thick: 0.01 * s, hex: team.primary, stitch: team.light, finish: { gloss: 0.4 } }, d);
      const knot = neckSurf.at(0.44, -Math.PI / 2, 0.02 * s);
      const kat: V3 = [knot.p.x, knot.p.y, knot.p.z];
      bead(k, kat, 0.022 * s, team.primary, 0, d, [1, 0.8, 0.7]);
      // Two loops and two tails.
      for (const x of [1, -1]) {
        k.card({ at: kat, dir: norm([x, 0.35, -0.3]), face: [0, 0.4, -1], len: 0.09 * s, wid: 0.06 * s, cell: CARD.cloth, root: team.primary, tip: team.light, curl: 0.9, segs: d.level === 0 ? 3 : 2 });
        k.card({ at: kat, dir: norm([x * 0.3, -1, -0.4]), face: [0, 0.3, -1], len: (x > 0 ? 0.2 : 0.16) * s, wid: 0.04 * s, cell: CARD.cloth, root: team.primary, tip: team.dark, curl: 0.2, sweep: x * 0.25, segs: d.level === 0 ? 3 : 2 });
      }
    }
    // A flourish of coral plumes in a brass clip at the back of the crown, sweeping back: it breaks the round of the
    // head from behind, and fans on a cast.
    if (d.level < 3) {
      const clip: V3 = [0, hr * 0.92, -hr * 0.4];
      bead(k, clip, hr * 0.13, GEAR.brass, 0, d, [1, 0.8, 1.2]);
      const n = d.keep(5, 3);
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
        k.card({
          at: clip, dir: norm([u * 0.45, 0.9 - 0.2 * Math.abs(u), -1]), face: [0, 1, 0.3], len: (0.26 - 0.05 * Math.abs(u)) * s, wid: 0.06 * s, cell: CARD.primary,
          root: P.coral, tip: P.pale, curl: -0.5, segs: d.rows + 1, finish: { gloss: 0.3 }, morph: { display: hinge(clip, [0, 0, 1], -u * 0.5) },
        });
      }
    }
    const E = FLAMINGO_HEAD.eye;
    for (const x of [1, -1]) eye(k, [x * hr * E[0], hr * E[1], hr * E[2]], [x * 0.78, 0.06, 0.62], { r: hr * 0.22, iris: P.iris, ring: mix(P.pale, P.coral, 0.3), lid: P.pale, ringW: hr * 0.04, pupil: 0.4 }, d);
    const B = FLAMINGO_HEAD.bill;
    flamingoBill(k, [0, hr * B[1], hr * (B[2] - 0.06)], hr, d);
  };

  const tail = (k: Sculpt): void => {
    tailFan(k, { count: 8, len: 0.2 * s, wid: 0.07 * s, spread: 0.7, droop: 0.25, root: P.coral, tip: P.deep, cell: CARD.tail, finish: SOFT, display: (u, at) => hinge(at, [0, 1, 0], u * 0.4) }, d);
  };

  return {
    body, head, tail, skin,
    wing: wingsOf(wing, d),
    leg: (k, seg, side, upper, lower, ankle) => {
      legsOf(leg, d)(k, seg, side, upper, lower, ankle);
      // The flamingo's "knee" (the ankle joint) a darker knob halfway down the leg, and webbed feet.
      if (seg === 'shin' && d.level < 2) k.mesh(new SphereGeometry(leg.thick * 1.6, 6, 4), { at: [0, -upper * 0.02, 0], paint: P.knee, finish: { gloss: 0.3 } });
      if (seg === 'foot') web(k, ankle, leg.toes, P.leg, side, d);
    },
    gun: flamingoGun(s, d),
    pivot: { wingL: A.wing, wingR: flipX(A.wing), legL: A.hip, legR: flipX(A.hip), tail: A.tail },
    legLen: A.legLen, legThick: leg.thick, wingLen: H * 0.3,
    // Pink Pool, Poise, Flock Dance, Tide Turn.
    casts: ['sweep', 'throw', 'stomp', 'raise'],
    sway: 0, castTail: -0.4, idleLeg: 1,
  };
};

/** Webbing between the forward toes: a thin fan on the ground under them (left foot; mirrored on the right). */
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

/** Wader Repeater: a slender reed barrel in brass bands, a coral bell whose bead glows on heal, a conch magazine, a curved shell-pink stock. */
function flamingoGun(s: number, d: Detail): SculptedSpec['gun'] {
  const P = FLAMINGO;
  const L = 0.72 * s;
  const r = 0.013 * s;
  return {
    main: [0, -0.05 * s, -L * 0.7],
    support: [0, -0.022 * s, 0],
    slideAt: [0, -0.006 * s, -L * 0.32],
    travel: 0.03 * s,
    build(k, part) {
      if (part === 'slide') {
        if (d.level >= 3) return;
        lathe(k, [[r * 1.2, 0.045 * s], [r * 1.7, 0.035 * s], [r * 1.75, -0.035 * s], [r * 1.2, -0.045 * s]], { seg: d.n(12, 4), paint: P.reed, finish: WOOD });
        return;
      }
      if (part !== 'gun') return;
      if (d.level >= 3) {
        lathe(k, [[r * 2.4, 0], [r, -L * 0.5], [0.024 * s, -L * 0.62], [0.02 * s, -L]], { seg: 4, paint: P.reed });
        return;
      }
      // The coral bell and its glowing bead.
      lathe(k, [[r * 2.6, 0], [r * 2.2, -0.012 * s], [r * 1.5, -0.03 * s], [r * 1.15, -0.05 * s]], { seg: d.n(12, 5), paint: P.coral, finish: { gloss: 0.6 } });
      bead(k, [0, 0, -0.01 * s], r * 1.3, 0xff9ac0, 0.9, d);
      // The reed barrel, jointed, with brass bands.
      lathe(k, [[r * 1.1, -0.045 * s], [r, -L * 0.25], [r * 1.12, -L * 0.27], [r, -L * 0.29], [r * 1.05, -L * 0.55]], { seg: d.n(10, 4), paint: P.reed, finish: WOOD });
      for (const z of [0.12, 0.42]) ring(k, [0, 0, -L * z], r * 1.15, r * 0.3, d);
      // The conch magazine: a spiral shell on top of the action (the ammo read).
      lathe(k, [[0.0, 0.04 * s], [0.018 * s, 0.03 * s], [0.03 * s, 0.0], [0.024 * s, -0.03 * s], [0.012 * s, -0.05 * s], [0, -0.06 * s]], {
        at: [0, 0.036 * s, -L * 0.52], seg: d.n(10, 5), paint: (t, a) => mix(P.conch, P.coral, 0.3 * t + 0.15 * Math.max(0, Math.sin(a * 2 + t * 12))), finish: { gloss: 0.6 },
      });
      block(k, [0.032 * s, 0.05 * s, 0.12 * s], [0, -0.004 * s, -L * 0.62], GEAR.brassDark, BRASS, d);
      carve(k, [[-L * 0.66, -0.022 * s], [-L * 0.72, -0.022 * s], [-L * 0.8, -0.1 * s], [-L * 0.72, -0.105 * s]], 0.026 * s, P.reed, WOOD, d);
      // A curved shell-pink stock.
      carve(k, [[-L * 0.7, 0.018 * s], [-L * 0.85, 0.03 * s], [-L, 0.01 * s], [-L * 1.02, -0.06 * s], [-L * 0.96, -0.07 * s], [-L * 0.78, -0.03 * s]], 0.03 * s, P.pale, { gloss: 0.5 }, d);
    },
  };
}

/** Puffin: squat and chunky, a huge triangular bill striped blue-grey, yellow and orange, three silver fish. */
const puffin: Build = (plan, team) => {
  const { H, R, hc, hr, top } = dims(plan);
  const legLen = H * 0.12;
  const y0 = legLen * 0.9;
  const cy = (y0 + top) / 2;
  const ry = (top - y0) / 2;
  const body = new Parts()
    .ell(C.puffinBlack, [R * 1.0, ry, R * 1.1], [0, cy, -R * 0.1])
    .ell(C.puffinWhite, [R * 0.85, ry * 0.8, R * 0.85], [0, cy - ry * 0.1, R * 0.25])
    .ell(team.primary, [hr * 1.3, H * 0.03, hr * 1.3], [0, hc - hr * 0.95, 0]);
  const head = headShell(new Parts(), C.puffinWhite, hr).ell(C.puffinBlack, [hr * 0.15, hr * 0.12, hr * 0.5], [hr * 0.95, hr * 0.15, hr * 0.1]).ell(C.puffinBlack, [hr * 0.15, hr * 0.12, hr * 0.5], [-hr * 0.95, hr * 0.15, hr * 0.1]);
  const bill = hr * 2.4;
  const base = hr * 0.8;
  const stripe = (hex: number, from: number, grow: number): void => {
    const r = hr * 1.1 * (1 - from / bill) * grow;
    head.cone(hex, r, bill - from, [0, -hr * 0.1, base + from], [0, 0, 0], 4, [0.4, 1, 1]);
  };
  stripe(C.puffinBlue, 0, 1);
  stripe(C.puffinYellow, bill * 0.3, 1.1);
  stripe(C.puffinOrange, bill * 0.62, 1.2);
  eyes(head, hr, 0.2, 0.55);
  for (let i = 0; i < 3; i++) {
    const z = base + bill * (0.25 + i * 0.22);
    const y = -hr * 0.4 - hr * 0.5;
    head.rod(C.puffinFish, [0, -hr * 0.4, z], [0, y - hr * 0.5, z], 0.008).ell(C.puffinFish, [0.02, hr * 0.55, 0.03], [0, y - hr * 0.55, z]);
  }
  const tail = new Parts().box(C.puffinBlack, [R * 0.6, H * 0.02, H * 0.14], [0, 0, -H * 0.07]);
  return assemble(plan, {
    body, head, tail,
    wing: { hex: C.puffinBlack, len: H * 0.4, chord: R * 1.1, thick: R * 0.12, trim: team.primary },
    leg: { hex: C.puffinOrange, len: legLen, thick: H * 0.035, foot: R * 0.6 },
    gun: { length: 0.5, thick: 0.06 },
    pivot: pivots({ sy: cy + ry * 0.5, legLen, R, legX: R * 0.4, tailY: cy, tailZ: -R * 1.1 }),
    // Burrow Colony, Sea Spray, Fog Bank, Rogue Wave.
    casts: ['throw', 'sweep', 'raise', 'throw'],
    sway: 0.08, castTail: -0.4,
  });
};

export const BIRD_BUILDS_B: Readonly<Record<string, Build>> = { secretarybird, starling, puffin };
/** The sculpted birds of this file (D-ART-013): heroes.ts wraps them into HERO_BUILDS and lists them in SCULPTED_IDS. */
export const SCULPTED_B = { hornbill, flamingo } as const satisfies Record<string, SculptedBird>;
