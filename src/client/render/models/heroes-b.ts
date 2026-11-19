/* eslint-disable @typescript-eslint/no-magic-numbers -- authored proportions: the numbers are the data */
/**
 * The B1 and A2 birds (GDD §9.5 to §9.12): owl, pelican, secretarybird, starling, hornbill, flamingo, penguin and
 * puffin. Like heroes.ts every size comes from the hero's BodyPlan at runtime (head shell on the head hitbox, body
 * inside the capsule, gun tip at the muzzle); only fractions of height, radius and head radius are written here.
 */
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import type { TeamColours } from '../palette';
import { assemble, dims, eyes, gun, headShell, leg, wing } from './bird';
import type { BirdBuild } from './bird';
import { PLUMAGE, PLUMAGE_NEW as C } from './constants';
import { Parts } from './parts';

type Build = (plan: BodyPlan, team: TeamColours) => BirdBuild;
type V3 = [number, number, number];

/** A pivot table for the common layout: parts hang where the body's shoulders, hips and rump are. */
const pivots = (o: { hc: number; sy: number; legLen: number; R: number; legX: number; tailY: number; tailZ: number }) => ({
  body: [0, 0, 0] as V3,
  head: [0, o.hc, 0] as V3,
  wingL: [o.R * 0.95, o.sy, 0] as V3,
  wingR: [-o.R * 0.95, o.sy, 0] as V3,
  legL: [o.legX, o.legLen, 0] as V3,
  legR: [-o.legX, o.legLen, 0] as V3,
  tail: [0, o.tailY, o.tailZ] as V3,
  gun: [0, 0, 0] as V3,
});

/** Owl: round barrel body, no neck, flat facial disc, two ear tufts, huge orange eyes, a rifle as tall as itself. */
const owl: Build = (plan, team) => {
  const { H, R, hc, hr, top } = dims(plan);
  const legLen = H * 0.1;
  const y0 = legLen * 0.9;
  const cy = (y0 + top) / 2;
  const ry = (top - y0) / 2;
  const body = new Parts()
    .ell(C.owlTawny, [R * 1.05, ry, R * 1.1], [0, cy, -R * 0.05])
    .ell(C.owlCream, [R * 0.85, ry * 0.8, R * 0.9], [0, cy - ry * 0.1, R * 0.25])
    .ell(team.primary, [hr * 1.3, H * 0.03, hr * 1.3], [0, hc - hr * 0.95, 0]);
  const head = headShell(new Parts(), C.owlTawny, hr)
    .ell(C.owlCream, [hr * 1.0, hr * 0.95, hr * 0.3], [0, 0, hr * 0.92])
    .cone(PLUMAGE.shrikeBill, hr * 0.2, hr * 0.5, [0, -hr * 0.2, hr * 1.1], [0.3, 0, 0])
    .cone(C.owlTawny, hr * 0.28, hr * 0.8, [hr * 0.7, hr * 0.8, 0], [-Math.PI / 2, 0, -0.35])
    .cone(C.owlTawny, hr * 0.28, hr * 0.8, [-hr * 0.7, hr * 0.8, 0], [-Math.PI / 2, 0, 0.35]);
  for (const s of [1, -1]) {
    head.ell(C.owlEye, [hr * 0.36, hr * 0.36, hr * 0.15], [s * hr * 0.45, hr * 0.15, hr * 1.08]);
    head.ell(PLUMAGE.eye, [hr * 0.15, hr * 0.15, hr * 0.1], [s * hr * 0.45, hr * 0.15, hr * 1.17]);
  }
  const tail = new Parts().box(C.owlTawny, [R * 0.5, H * 0.02, H * 0.16], [0, 0, -H * 0.08]);
  return assemble(
    plan,
    {
      body, head,
      wingL: wing(1, C.owlTawny, H * 0.4, R * 1.2, R * 0.12, team.primary),
      wingR: wing(-1, C.owlTawny, H * 0.4, R * 1.2, R * 0.12, team.primary),
      legL: leg(C.owlCream, legLen, H * 0.03, R * 0.4),
      legR: leg(C.owlCream, legLen, H * 0.03, R * 0.4),
      tail,
      gun: gun({ length: H * 0.85, thick: 0.06, scope: true }),
    },
    pivots({ hc, sy: cy + ry * 0.5, legLen, R, legX: R * 0.4, tailY: cy - ry * 0.2, tailZ: -R * 1.0 }),
    { sway: 0, castTail: -0.3, wingRest: 0.08 },
  );
};

/** Pelican: bottom-heavy pear, long bill with a sagging pouch that swings with the head, a gatling at the hip. */
const pelican: Build = (plan, team) => {
  const { H, R, hc, hr, top } = dims(plan);
  const legLen = H * 0.1;
  const y0 = legLen * 0.9;
  const span = top - y0;
  const body = new Parts()
    .ell(C.pelicanWhite, [R * 1.0, span * 0.38, R * 1.15], [0, y0 + span * 0.38, 0])
    .ell(C.pelicanWhite, [R * 0.6, span * 0.3, R * 0.65], [0, top - span * 0.3, R * 0.05])
    .ell(team.primary, [hr * 1.4, H * 0.03, hr * 1.4], [0, top - H * 0.01, 0]);
  const head = headShell(new Parts(), C.pelicanWhite, hr)
    .cone(C.pelicanBill, hr * 0.5, hr * 4.4, [0, -hr * 0.1, hr * 0.8])
    .cone(C.pelicanBill, hr * 0.22, hr * 0.7, [0, -hr * 0.1, hr * 0.8 + hr * 4.2], [0.9, 0, 0])
    .ell(C.pelicanPouch, [hr * 0.7, hr * 1.1, hr * 1.9], [0, -hr * 1.0, hr * 2.2], [0.12, 0, 0]);
  eyes(head, hr, 0.2, 0.6);
  const tail = new Parts().box(C.pelicanEdge, [R * 0.5, H * 0.02, H * 0.14], [0, 0, -H * 0.06]);
  return assemble(
    plan,
    {
      body, head,
      wingL: wing(1, C.pelicanWhite, H * 0.4, R * 1.1, R * 0.12, C.pelicanEdge, 0.8),
      wingR: wing(-1, C.pelicanWhite, H * 0.4, R * 1.1, R * 0.12, C.pelicanEdge, 0.8),
      legL: leg(C.pelicanPouch, legLen, H * 0.025, R * 0.4),
      legR: leg(C.pelicanPouch, legLen, H * 0.025, R * 0.4),
      tail,
      gun: gun({ length: 0.6, thick: 0.05, barrels: 3, bell: 0.07 }),
    },
    pivots({ hc, sy: top - span * 0.25, legLen, R, legX: R * 0.45, tailY: y0 + span * 0.4, tailZ: -R * 1.0 }),
    { sway: 0.1, castTail: -0.3, wingRest: 0.06 },
  );
};

/** Secretarybird: stilt legs (60% of height) in black breeches, small grey body, bare orange face, a quill crown. */
const secretarybird: Build = (plan, team) => {
  const { H, R, hc, hr, top } = dims(plan);
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
  const stilt = (): Parts => leg(C.secFace, legLen, thin, R * 0.5).ell(C.secBlack, [thin * 4, legLen * 0.2, thin * 4], [0, -legLen * 0.15, 0]);
  const tail = new Parts().box(C.secBlack, [R * 0.5, H * 0.012, H * 0.3], [0, 0, -H * 0.15]).box(C.secGrey, [R * 0.5, H * 0.014, H * 0.04], [0, 0, -H * 0.28]);
  return assemble(
    plan,
    {
      body, head,
      wingL: wing(1, C.secGrey, ry * 2.2, R * 1.2, R * 0.1, C.secBlack, 0.75),
      wingR: wing(-1, C.secGrey, ry * 2.2, R * 1.2, R * 0.1, C.secBlack, 0.75),
      legL: stilt(), legR: stilt(), tail,
      gun: gun({ length: 0.4, thick: 0.045, barrels: 2 }),
    },
    pivots({ hc, sy: cy + ry * 0.6, legLen, R, legX: R * 0.4, tailY: cy, tailZ: -R * 1.2 }),
    { sway: 0.05, castTail: -0.5, wingRest: 0.05 },
  );
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
  return assemble(
    plan,
    {
      body, head,
      wingL: wing(1, C.starBlack, H * 0.4, R * 1.1, R * 0.1, team.primary),
      wingR: wing(-1, C.starBlack, H * 0.4, R * 1.1, R * 0.1, team.primary),
      legL: leg(PLUMAGE.leg, legLen, H * 0.02, R * 0.4),
      legR: leg(PLUMAGE.leg, legLen, H * 0.02, R * 0.4),
      tail,
      gun: gun({ length: 0.4, thick: 0.05 }),
    },
    pivots({ hc, sy: cy + ry * 0.55, legLen, R, legX: R * 0.4, tailY: cy, tailZ: -R * 1.2 }),
    { sway: 0, castTail: -0.5, wingRest: 0.05, halo: halo.build() },
  );
};

/** Hornbill: heavy chest, huge down-curved yellow bill under a tall red casque, long banded tail. */
const hornbill: Build = (plan, team) => {
  const { H, R, hc, hr, top } = dims(plan);
  const legLen = H * 0.18;
  const y0 = legLen * 0.9;
  const cy = (y0 + top) / 2;
  const ry = (top - y0) / 2;
  const body = new Parts()
    .ell(C.hornBlack, [R * 1.0, ry, R * 1.2], [0, cy, -R * 0.1])
    .ell(C.hornWhite, [R * 0.85, ry * 0.75, R * 0.9], [0, cy - ry * 0.15, R * 0.2])
    .ell(team.primary, [hr * 1.3, H * 0.03, hr * 1.3], [0, hc - hr * 0.95, 0]);
  const head = headShell(new Parts(), C.hornBlack, hr)
    .cone(C.hornBill, hr * 0.55, hr * 2.3, [0, -hr * 0.05, hr * 0.8], [0.12, 0, 0])
    .cone(C.hornBill, hr * 0.3, hr * 1.2, [0, -hr * 0.4, hr * 0.8 + hr * 2.2], [0.8, 0, 0])
    .ell(C.hornCasque, [hr * 0.55, hr * 1.0, hr * 1.7], [0, hr * 1.15, hr * 1.1], [-0.12, 0, 0]);
  eyes(head, hr, 0.1, 0.55);
  const tail = new Parts().box(C.hornBlack, [R * 0.7, H * 0.02, H * 0.5], [0, 0, -H * 0.25]);
  for (const z of [0.12, 0.3, 0.48]) tail.box(C.hornWhite, [R * 0.74, H * 0.024, H * 0.045], [0, 0, -H * z]);
  return assemble(
    plan,
    {
      body, head,
      wingL: wing(1, C.hornBlack, H * 0.42, R * 1.2, R * 0.12, C.hornWhite, 0.8),
      wingR: wing(-1, C.hornBlack, H * 0.42, R * 1.2, R * 0.12, C.hornWhite, 0.8),
      legL: leg(PLUMAGE.leg, legLen, H * 0.025, R * 0.4),
      legR: leg(PLUMAGE.leg, legLen, H * 0.025, R * 0.4),
      tail,
      gun: gun({ length: 0.65, thick: 0.06 }),
    },
    pivots({ hc, sy: cy + ry * 0.55, legLen, R, legX: R * 0.4, tailY: cy, tailZ: -R * 1.2 }),
    { sway: 0, castTail: -0.5, wingRest: 0.05 },
  );
};

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
  return assemble(
    plan,
    {
      body, head,
      wingL: wing(1, C.flamingoCoral, ry * 2.2, R * 1.2, R * 0.08, team.primary, 0.8),
      wingR: wing(-1, C.flamingoCoral, ry * 2.2, R * 1.2, R * 0.08, team.primary, 0.8),
      legL: leg(C.flamingoCoral, legLen, thin, R * 0.5),
      legR: leg(C.flamingoCoral, legLen, thin, R * 0.5),
      tail,
      gun: gun({ length: 0.5, thick: 0.045 }),
    },
    pivots({ hc, sy: cy + ry * 0.3, legLen, R, legX: R * 0.35, tailY: cy, tailZ: -R * 1.6 }),
    { sway: 0, castTail: -0.5, wingRest: 0.05, idleLeg: 1 },
  );
};

/** Penguin: black-and-white bowling pin with flippers held out, yellow ear patches and throat, short legs. */
const penguin: Build = (plan, team) => {
  const { H, R, hc, hr, top } = dims(plan);
  const legLen = H * 0.07;
  const y0 = legLen * 0.9;
  const span = top - y0;
  const body = new Parts()
    .ell(C.penguinBlack, [R * 1.0, span * 0.5, R * 0.95], [0, y0 + span * 0.5, 0])
    .ell(C.penguinWhite, [R * 0.85, span * 0.45, R * 0.7], [0, y0 + span * 0.46, R * 0.32])
    .ell(C.penguinGold, [R * 0.5, span * 0.08, R * 0.4], [0, top - span * 0.04, R * 0.55])
    .ell(team.primary, [hr * 1.3, H * 0.025, hr * 1.3], [0, top - H * 0.005, 0]);
  const head = headShell(new Parts(), C.penguinBlack, hr)
    .ell(C.penguinGold, [hr * 0.25, hr * 0.4, hr * 0.5], [hr * 0.95, -hr * 0.05, -hr * 0.1])
    .ell(C.penguinGold, [hr * 0.25, hr * 0.4, hr * 0.5], [-hr * 0.95, -hr * 0.05, -hr * 0.1])
    .ell(C.penguinWhite, [hr * 0.7, hr * 0.5, hr * 0.5], [0, -hr * 0.35, hr * 0.5])
    .cone(PLUMAGE.shrikeBill, hr * 0.35, hr * 1.1, [0, -hr * 0.1, hr * 0.85]);
  eyes(head, hr, 0.2, 0.6);
  const tail = new Parts().cone(C.penguinBlack, R * 0.3, H * 0.12, [0, 0, 0], [0.4, Math.PI, 0]);
  const flipper = (s: 1 | -1): Parts => wing(s, C.penguinBlack, H * 0.34, R * 0.9, R * 0.1, C.penguinWhite, 0.8);
  return assemble(
    plan,
    {
      body, head, wingL: flipper(1), wingR: flipper(-1),
      legL: leg(C.penguinGold, legLen, H * 0.04, R * 0.55),
      legR: leg(C.penguinGold, legLen, H * 0.04, R * 0.55),
      tail,
      gun: gun({ length: 0.45, thick: 0.055 }),
    },
    pivots({ hc, sy: y0 + span * 0.62, legLen, R, legX: R * 0.4, tailY: y0 + span * 0.25, tailZ: -R * 0.9 }),
    { sway: 0.15, castTail: -0.3, wingRest: 1.1 },
  );
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
  return assemble(
    plan,
    {
      body, head,
      wingL: wing(1, C.puffinBlack, H * 0.4, R * 1.1, R * 0.12, team.primary),
      wingR: wing(-1, C.puffinBlack, H * 0.4, R * 1.1, R * 0.12, team.primary),
      legL: leg(C.puffinOrange, legLen, H * 0.035, R * 0.6),
      legR: leg(C.puffinOrange, legLen, H * 0.035, R * 0.6),
      tail,
      gun: gun({ length: 0.5, thick: 0.06 }),
    },
    pivots({ hc, sy: cy + ry * 0.5, legLen, R, legX: R * 0.4, tailY: cy, tailZ: -R * 1.1 }),
    { sway: 0.08, castTail: -0.4, wingRest: 0.06 },
  );
};

export const BIRD_BUILDS_B: Readonly<Record<string, Build>> = { owl, pelican, secretarybird, starling, hornbill, flamingo, penguin, puffin };
