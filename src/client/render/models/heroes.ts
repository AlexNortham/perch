/* eslint-disable @typescript-eslint/no-magic-numbers -- authored proportions and sample poses: the numbers are the data */
/**
 * Hero builds (GDD §9, §14.6). Every build takes the hero's BodyPlan and derives all sizes from it, so a change to
 * the data moves the model with the hitboxes: the head shell is centred on the head hitbox, the body fits the
 * capsule, the gun's tip is the muzzle. Four heroes are hand-built; the generic bird serves the other twenty.
 */
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import type { TeamColours } from '../palette';
import { assemble, dims, eyes, headShell } from './bird';
import type { BirdBuild } from './bird';
import { GENERIC, PLUMAGE } from './constants';
import { BIRD_BUILDS_B } from './heroes-b';
import { SCULPTED_BUILDS } from './sculpted-birds';
import { Parts } from './parts';
import { Color } from 'three';

type Build = (plan: BodyPlan, team: TeamColours) => BirdBuild;

/** Shrike: compact upright songbird, hooked beak, bandit mask, a straight tail like a blade. */
const shrike: Build = (plan, team) => {
  const { H, R, hc, hr, top } = dims(plan);
  const legLen = H * 0.2;
  const y0 = legLen * 0.9;
  const cy = (y0 + top) / 2;
  const ry = (top - y0) / 2;
  const body = new Parts()
    .ell(PLUMAGE.grey, [R * 0.95, ry, R * 1.25], [0, cy, -R * 0.1])
    .ell(PLUMAGE.white, [R * 0.82, ry * 0.8, R * 1.1], [0, cy - ry * 0.12, R * 0.12])
    .ell(team.primary, [hr * 1.3, H * 0.03, hr * 1.3], [0, hc - hr * 0.95, 0]);
  const head = headShell(new Parts(), PLUMAGE.grey, hr)
    .ell(PLUMAGE.black, [hr * 1.08, hr * 0.3, hr * 0.75], [0, hr * 0.12, hr * 0.35])
    .cone(PLUMAGE.shrikeBill, hr * 0.55, hr * 1.9, [0, -hr * 0.1, hr * 0.85])
    .cone(PLUMAGE.shrikeBill, hr * 0.3, hr * 0.7, [0, -hr * 0.1, hr * 0.85 + hr * 1.75], [1.1, 0, 0]);
  eyes(head, hr, 0.12, 0.6);
  const sy = cy + ry * 0.55;
  const tail = new Parts()
    .box(PLUMAGE.black, [R * 0.7, H * 0.025, H * 0.62], [0, 0, -H * 0.31])
    .box(PLUMAGE.white, [R * 0.74, H * 0.03, H * 0.05], [0, 0, -H * 0.55])
    .box(team.primary, [R * 0.74, H * 0.032, H * 0.07], [0, 0, -H * 0.2]);
  return assemble(plan, {
    body, head, tail,
    wing: { hex: PLUMAGE.black, len: H * 0.42, chord: R * 1.2, thick: R * 0.12, trim: team.primary },
    leg: { hex: PLUMAGE.leg, len: legLen, thick: H * 0.02, foot: R * 0.4 },
    gun: { length: 0.7, thick: 0.065, thorns: true },
    pivot: { wingL: [R * 0.9, sy, 0], wingR: [-R * 0.9, sy, 0], legL: [R * 0.4, legLen, 0], legR: [-R * 0.4, legLen, 0], tail: [0, cy + ry * 0.1, -R * 1.2] },
    // Thorn Larder, Briar Patch, Impaling Bolt, Butcher's Ring.
    casts: ['throw', 'sweep', 'aim', 'raise'],
    sway: 0, castTail: -0.7,
  });
};

/** Albatross: the widest hero. Wings folded like a cloak down to the ground, thick neck, long pale hooked bill. */
const albatross: Build = (plan, team) => {
  const { H, R, hc, hr, top } = dims(plan);
  const legLen = H * 0.17;
  const y0 = legLen * 0.9;
  const cy = (y0 + top - hr * 0.5) / 2;
  const ry = (top - hr * 0.5 - y0) / 2;
  const sy = cy + ry * 0.7;
  const body = new Parts()
    .ell(PLUMAGE.white, [R * 1.0, ry, R * 1.2], [0, cy, -R * 0.05])
    .cyl(PLUMAGE.white, hr * 0.85, hr * 1.15, hc - cy - ry * 0.3, [0, (hc + cy + ry * 0.3) / 2 - 0.05, 0.02])
    .ell(team.primary, [hr * 1.4, H * 0.03, hr * 1.4], [0, top - hr * 0.5, 0]);
  const head = headShell(new Parts(), PLUMAGE.white, hr)
    .cone(PLUMAGE.albatrossBill, hr * 0.55, hr * 3.1, [0, -hr * 0.1, hr * 0.8])
    .cone(PLUMAGE.albatrossBillTip, hr * 0.3, hr * 0.9, [0, -hr * 0.1, hr * 0.8 + hr * 2.9], [1.0, 0, 0]);
  eyes(head, hr, 0.15, 0.6);
  const tail = new Parts().ell(PLUMAGE.albatrossWing, [R * 0.5, H * 0.015, R * 0.9], [0, 0, -R * 0.7]);
  return assemble(plan, {
    body, head, tail,
    wing: { hex: PLUMAGE.albatrossWing, len: H * 0.36, chord: R * 1.5, thick: R * 0.14, trim: team.primary },
    leg: { hex: PLUMAGE.albatrossBill, len: legLen, thick: H * 0.02, foot: R * 0.5 },
    gun: { length: 0.6, thick: 0.09, bell: 0.16 },
    pivot: { wingL: [R * 1.0, sy, 0], wingR: [-R * 1.0, sy, 0], legL: [R * 0.4, legLen, 0], legR: [-R * 0.4, legLen, 0], tail: [0, cy, -R * 0.8] },
    // Gale Shield, Wing Slam, Salt Hide, Tempest Dive.
    casts: ['sweep', 'leap', 'raise', 'leap'],
    sway: 0.12, castTail: -0.3,
  });
};

/** Kingfisher: small, forward-leaning sprinter with a dagger bill, stubby tail, blue back and orange chest. */
const kingfisher: Build = (plan, team) => {
  const { H, R, hc, hr, top } = dims(plan);
  const legLen = H * 0.17;
  const y0 = legLen * 0.8;
  const ry = (top - y0) / 2 / Math.cos(0.5);
  const cy = (y0 + top) / 2;
  const lean: [number, number, number] = [0.5, 0, 0];
  const body = new Parts()
    .ell(PLUMAGE.kingfisherBack, [R * 0.95, ry, R * 1.15], [0, cy, -H * 0.1], lean)
    .ell(PLUMAGE.kingfisherBelly, [R * 0.85, ry * 0.8, R * 1.1], [0, cy - ry * 0.05, -H * 0.04], lean)
    .ell(team.primary, [hr * 1.3, H * 0.03, hr * 1.3], [0, hc - hr * 0.95, 0.04]);
  const head = headShell(new Parts(), PLUMAGE.kingfisherBack, hr)
    .ell(PLUMAGE.white, [hr * 0.75, hr * 0.5, hr * 0.7], [0, -hr * 0.55, hr * 0.4])
    .cone(PLUMAGE.kingfisherBill, hr * 0.4, hr * 2.7, [0, -hr * 0.1, hr * 0.9]);
  eyes(head, hr, 0.2, 0.62);
  const sy = cy + ry * 0.4;
  const tail = new Parts().cone(PLUMAGE.kingfisherBack, R * 0.4, H * 0.18, [0, 0, -H * 0.02], [0.5, Math.PI, 0]).ell(team.primary, [R * 0.3, H * 0.02, H * 0.03], [0, -H * 0.05, -H * 0.19]);
  return assemble(plan, {
    body, head, tail,
    wing: { hex: PLUMAGE.kingfisherBack, len: H * 0.36, chord: R * 1.1, thick: R * 0.1, trim: team.primary },
    leg: { hex: PLUMAGE.kingfisherBelly, len: legLen, thick: H * 0.025, foot: R * 0.4 },
    gun: { length: 0.38, thick: 0.055, main: 0.72, support: 0.3 },
    pivot: { wingL: [R * 0.85, sy, -H * 0.05], wingR: [-R * 0.85, sy, -H * 0.05], legL: [R * 0.4, legLen, -H * 0.03], legR: [-R * 0.4, legLen, -H * 0.03], tail: [0, cy - ry * 0.35, -H * 0.2] },
    // Plunge, Glint, Spear Bill, Riverstrike.
    casts: ['leap', 'raise', 'leap', 'aim'],
    sway: 0, castTail: -0.4,
  });
};

/** Lyrebird: slim brown body under a huge lyre of curved plumes with silver filaments arching above the head. */
const lyrebird: Build = (plan, team) => {
  const { H, R, hc, hr, top } = dims(plan);
  const legLen = H * 0.27;
  const y0 = legLen * 0.9;
  const cy = (y0 + top) / 2;
  const ry = (top - y0) / 2;
  const sy = cy + ry * 0.5;
  const body = new Parts()
    .ell(PLUMAGE.lyreBrown, [R * 0.9, ry, R * 1.35], [0, cy, -R * 0.15])
    .ell(0x9a7a5a, [R * 0.75, ry * 0.8, R * 1.1], [0, cy - ry * 0.1, R * 0.1])
    .ell(team.primary, [hr * 1.3, H * 0.03, hr * 1.3], [0, hc - hr * 0.95, 0]);
  const head = headShell(new Parts(), PLUMAGE.lyreBrown, hr)
    .cone(PLUMAGE.lyreBill, hr * 0.45, hr * 1.5, [0, -hr * 0.1, hr * 0.85])
    .ell(PLUMAGE.lyreBrown, [hr * 0.3, hr * 0.7, hr * 0.3], [0, hr * 1.0, -hr * 0.3], [0.5, 0, 0]);
  eyes(head, hr, 0.15, 0.6);
  // The lyre, in the tail's frame (pivot at the rump): two plumes sweep out, up and back in, to ~2.6 m.
  const tail = new Parts().ell(PLUMAGE.lyreBrown, [R * 0.3, H * 0.2, R * 0.45], [0, -H * 0.12, -R * 0.5], [-0.35, 0, 0]);
  const rise = 2.6 * (H / 1.8) - (cy - ry * 0.2);
  const point = (s: number, t: number): [number, number, number] => [s * (0.1 + 0.5 * Math.sin(Math.PI * t)), rise * Math.pow(t, 0.85), -R * 1.0 + 0.9 * R * t];
  for (const s of [1, -1]) {
    const steps = 9;
    for (let i = 0; i < steps; i++) tail.rod(PLUMAGE.lyreBrown, point(s, i / steps), point(s, (i + 1) / steps), 0.045);
    tail.ell(team.primary, [0.07, 0.07, 0.07], point(s, 1), [0, 0, 0], [5, 4]);
    // Silver filaments: strings from the base fanning to the plume.
    for (const t of [0.35, 0.55, 0.75, 0.9]) tail.rod(PLUMAGE.lyreSilver, [s * 0.03, 0, -R * 0.9], point(s, t), 0.016);
  }
  return assemble(plan, {
    body, head, tail,
    wing: { hex: PLUMAGE.lyreBrown, len: H * 0.4, chord: R * 1.1, thick: R * 0.1, trim: team.primary },
    leg: { hex: PLUMAGE.leg, len: legLen, thick: H * 0.018, foot: R * 0.35 },
    gun: { length: 0.55, thick: 0.06, lute: 0.13 },
    pivot: { wingL: [R * 0.8, sy, 0], wingR: [-R * 0.8, sy, 0], legL: [R * 0.35, legLen, 0], legR: [-R * 0.35, legLen, 0], tail: [0, cy - ry * 0.2, -R * 1.2] },
    // Mended Song, Echo Double, Discord, Grand Chorus.
    casts: ['raise', 'sweep', 'throw', 'raise'],
    sway: 0, castTail: -0.25,
  });
};

/** The placeholder for the other twenty: a plain bird, scaled to the plan, tinted by the hero's place in the roster. */
export function genericBuild(plan: BodyPlan, team: TeamColours, index: number, count: number): BirdBuild {
  const { H, R, hc, hr, top } = dims(plan);
  const hue = index / count;
  const main = new Color().setHSL(hue, GENERIC.saturation, GENERIC.lightness).getHex();
  const belly = new Color().setHSL(hue, GENERIC.saturation * 0.6, 0.75).getHex();
  const dark = new Color().setHSL(hue, GENERIC.saturation, 0.28).getHex();
  const legLen = H * 0.22;
  const y0 = legLen * 0.9;
  const cy = (y0 + top) / 2;
  const ry = (top - y0) / 2;
  const sy = cy + ry * 0.5;
  const body = new Parts()
    .ell(main, [R * 0.95, ry, R * 1.25], [0, cy, -R * 0.1])
    .ell(belly, [R * 0.8, ry * 0.8, R * 1.1], [0, cy - ry * 0.1, R * 0.12])
    .ell(team.primary, [hr * 1.3, H * 0.03, hr * 1.3], [0, hc - hr * 0.95, 0]);
  const head = headShell(new Parts(), main, hr).cone(GENERIC.bill, hr * 0.5, hr * 1.7, [0, -hr * 0.1, hr * 0.85]);
  eyes(head, hr);
  const tail = new Parts().box(dark, [R * 0.6, H * 0.03, H * 0.22], [0, 0, -H * 0.1]).box(team.primary, [R * 0.62, H * 0.032, H * 0.04], [0, 0, -H * 0.2]);
  return assemble(plan, {
    body, head, tail,
    wing: { hex: dark, len: H * 0.42, chord: R * 1.2, thick: R * 0.12, trim: team.primary },
    leg: { hex: GENERIC.leg, len: legLen, thick: H * 0.02, foot: R * 0.4 },
    gun: { length: 0.55, thick: 0.06 },
    pivot: { wingL: [R * 0.9, sy, 0], wingR: [-R * 0.9, sy, 0], legL: [R * 0.4, legLen, 0], legR: [-R * 0.4, legLen, 0], tail: [0, cy, -R * 1.2] },
    casts: ['throw', 'sweep', 'aim', 'raise'],
    sway: 0, castTail: -0.4,
  });
}

/** Hand-built heroes by id. */
export const HERO_BUILDS: Readonly<Record<string, Build>> = { shrike, albatross, kingfisher, lyrebird, ...BIRD_BUILDS_B, ...SCULPTED_BUILDS };
