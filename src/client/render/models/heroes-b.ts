/* eslint-disable @typescript-eslint/no-magic-numbers -- authored proportions: the numbers are the data */
/**
 * The B1 and A2 birds (GDD §9.5 to §9.12): owl, pelican, secretarybird, starling, hornbill, flamingo, penguin and
 * puffin. Like heroes.ts every size comes from the hero's BodyPlan at runtime (head shell on the head hitbox, body
 * inside the capsule, gun tip at the muzzle); only fractions of height, radius and head radius are written here.
 */
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import type { TeamColours } from '../palette';
import { beak, eye, foldedWings, hackles, inBone, legsOf, norm, tailFan, wingsOf } from './anatomy';
import type { LegStyle, WingStyle } from './anatomy';
import { assemble, dims, eyes, headShell } from './bird';
import type { BirdBuild } from './bird';
import { bodyField, flipX, HORNBILL_HEAD, hornbillAnchors, skinFor, TRUNK } from './bodies';
import { PLUMAGE, PLUMAGE_NEW as C } from './constants';
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

/** Flamingo: pink stick figure, very long legs, small oval body, an S-curved neck and a sharply bent black-tipped bill. */
const flamingo: Build = (plan, team) => {
  const { H, R, hc, hr } = dims(plan);
  const legLen = H * 0.5;
  const y0 = legLen * 0.95;
  const bodyTop = y0 + H * 0.2;
  const cy = (y0 + bodyTop) / 2;
  const ry = (bodyTop - y0) / 2;
  const body = new Parts()
    .ell(C.flamingoPink, [R * 0.95, ry, R * 1.5], [0, cy, -R * 0.2])
    .ell(team.primary, [hr * 1.8, H * 0.012, hr * 1.8], [0, bodyTop, -R * 0.3]);
  const neckBase: V3 = [0, bodyTop - ry * 0.3, R * 0.5];
  const neckEnd: V3 = [0, hc - hr * 0.6, 0];
  const at = (t: number): V3 => [0, neckBase[1] + (neckEnd[1] - neckBase[1]) * t, neckBase[2] + (neckEnd[2] - neckBase[2]) * t + Math.sin(t * Math.PI * 2) * R * 1.4];
  for (let i = 0; i < 10; i++) body.rod(C.flamingoPink, at(i / 10), at((i + 1) / 10), hr * 0.55);
  const head = headShell(new Parts(), C.flamingoPink, hr)
    .cone(C.flamingoBill, hr * 0.45, hr * 1.5, [0, -hr * 0.05, hr * 0.85], [0.15, 0, 0])
    .cone(C.flamingoTip, hr * 0.38, hr * 1.1, [0, -hr * 0.4, hr * 0.85 + hr * 1.4], [0.95, 0, 0]);
  eyes(head, hr, 0.2, 0.6);
  const thin = H * 0.009;
  const tail = new Parts().ell(C.flamingoCoral, [R * 0.4, H * 0.01, H * 0.07], [0, 0, -H * 0.04]);
  return assemble(plan, {
    body, head, tail,
    wing: { hex: C.flamingoCoral, len: ry * 2.2, chord: R * 1.2, thick: R * 0.08, trim: team.primary },
    leg: { hex: C.flamingoCoral, len: legLen, thick: thin, foot: R * 0.5, thighThick: thin * 2 },
    gun: { length: 0.5, thick: 0.045 },
    pivot: pivots({ sy: cy + ry * 0.3, legLen, R, legX: R * 0.35, tailY: cy, tailZ: -R * 1.6 }),
    // Pink Pool, Poise, Flock Dance, Tide Turn.
    casts: ['sweep', 'throw', 'stomp', 'raise'],
    sway: 0, castTail: -0.5, idleLeg: 1,
  });
};

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

export const BIRD_BUILDS_B: Readonly<Record<string, Build>> = { secretarybird, starling, flamingo, puffin };
/** The sculpted birds of this file (D-ART-013): heroes.ts wraps them into HERO_BUILDS and lists them in SCULPTED_IDS. */
export const SCULPTED_B = { hornbill } as const satisfies Record<string, SculptedBird>;
