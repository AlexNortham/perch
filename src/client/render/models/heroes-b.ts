/* eslint-disable @typescript-eslint/no-magic-numbers -- authored proportions: the numbers are the data */
/**
 * The B1 and A2 birds (GDD §9.5 to §9.12): owl, pelican, secretarybird, starling, hornbill, flamingo, penguin and
 * puffin. Like heroes.ts every size comes from the hero's BodyPlan at runtime (head shell on the head hitbox, body
 * inside the capsule, gun tip at the muzzle); only fractions of height, radius and head radius are written here.
 */
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import type { TeamColours } from '../palette';
import { assemble, dims, eyes, headShell } from './bird';
import type { BirdBuild } from './bird';
import { PLUMAGE, PLUMAGE_NEW as C } from './constants';
import { Parts } from './parts';

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
  return assemble(plan, {
    body, head, tail,
    wing: { hex: C.hornBlack, len: H * 0.42, chord: R * 1.2, thick: R * 0.12, trim: C.hornWhite },
    leg: { hex: PLUMAGE.leg, len: legLen, thick: H * 0.025, foot: R * 0.4 },
    gun: { length: 0.65, thick: 0.06 },
    pivot: pivots({ sy: cy + ry * 0.55, legLen, R, legX: R * 0.4, tailY: cy, tailZ: -R * 1.2 }),
    // Heavy Rounds, Mud Seal, Bounding Hop, Marked Prey.
    casts: ['aim', 'raise', 'leap', 'aim'],
    sway: 0, castTail: -0.5,
  });
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

export const BIRD_BUILDS_B: Readonly<Record<string, Build>> = { hornbill, flamingo };
