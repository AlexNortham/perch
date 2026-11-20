/* eslint-disable @typescript-eslint/no-magic-numbers -- authored proportions and sample poses: the numbers are the data */
/**
 * Hero builds (GDD §9, §14.6). Every build takes the hero's BodyPlan and derives all sizes from it, so a change to
 * the data moves the model with the hitboxes: the head is centred on the head hitbox, the body fits the capsule, the
 * gun's tip is the muzzle. The batch B birds here (Shrike, Albatross, Kingfisher, Lyrebird) are sculpted to the style
 * guide on implicit bodies (D-ART-010, D-ART-011); the generic bird serves heroes without a model yet.
 */
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import type { HeroId } from '../../../sim/core/contracts';
import type { TeamColours } from '../palette';
import { beak, eye, foldedWings, hackles, inBone, legsOf, norm, wingsOf } from './anatomy';
import type { LegStyle, WingStyle } from './anatomy';
import { assemble, dims, eyes, headShell } from './bird';
import type { BirdBuild } from './bird';
import { bodyField, flipX, SHRIKE_HEAD, shrikeAnchors, skinFor, TRUNK } from './bodies';
import { GENERIC, PLUMAGE } from './constants';
import { SKIN as SHRIKE_SKIN } from './data/skins/shrike';
import { CARD } from './feathers';
import { band, bead, block, BRASS, buckle, carve, GEAR, LEATHER, lathe, pouch, ring, sash, WOOD } from './gear';
import { BIRD_BUILDS_B } from './heroes-b';
import { sculptedBuild } from './sculpted';
import type { Detail, SculptedBird, SculptedSpec } from './sculpted';
import { SCULPTED_BUILDS } from './sculpted-birds';
import { hinge, mix, shade } from './sculpt';
import type { Sculpt, V3 } from './sculpt';
import { Parts } from './parts';
import { Color } from 'three';

type Build = (plan: BodyPlan, team: TeamColours) => BirdBuild;

// =================================================================================================================
// Shrike: the butcher bird. A compact upright songbird with a big flat-crowned head, a heavy hooked bill and a black
// bandit mask; grey crown and mantle over a white breast, black wings with a white flash, and a long black-and-white
// tail held straight out behind like a blade. It wears a butcher's apron and a bandolier of thorns. Area control: a
// thornwood rifle studded with barbs along the barrel, a bone stock and a quiver of barbed bolts.

const SHRIKE = {
  grey: 0x8a8f97,
  pale: 0xc8ccd0,
  mantle: 0x4c5058,
  white: 0xeeebe4,
  black: 0x1c1c21,
  bill: 0x232327,
  leg: 0x2c2c30,
  claw: 0x161618,
  iris: 0x3a1c10,
  thorn: 0xd8c8a0,
  thornwood: 0x3a2a22,
} as const;

const shrike: SculptedBird = (plan, team, d) => {
  const H = plan.height;
  const hr = plan.head.radius;
  const A = shrikeAnchors(plan);
  const s = A.s;
  const P = SHRIKE;
  const FEATHERS = { tile: 1, size: 0.09, gloss: 0.2 } as const;
  const field = bodyField('shrike', plan);
  const skin = skinFor('shrike', plan, SHRIKE_SKIN, d.level, {
    // A slate mantle under the silvery crown, paling to grey at the rump.
    back: { paint: (p) => mix(P.grey, P.mantle, Math.min(1, Math.max(0, (p.y - 0.7 * s) / (0.3 * s)))), finish: FEATHERS },
    mantle: { paint: P.mantle, finish: FEATHERS },
    // Pale scapulars: the white stripe along the shoulder of a grey shrike.
    scapular: { paint: (p) => mix(P.pale, P.white, Math.min(1, Math.max(0, (p.y - 1.0 * s) / (0.15 * s)))), finish: { ...FEATHERS, size: 0.07 } },
    shoulder: { paint: P.black, finish: FEATHERS },
    coverts: { paint: P.mantle, finish: FEATHERS },
    // A white breast, greying a little down the sides.
    breast: { paint: (p) => mix(P.white, P.pale, Math.min(0.6, Math.abs(p.x) / (0.25 * s))), finish: { ...FEATHERS, size: 0.08 } },
    belly: { paint: mix(P.white, P.pale, 0.3), finish: FEATHERS },
    thigh: { paint: P.pale, finish: { ...FEATHERS, size: 0.06 } },
    // White at the front of the neck, slate behind: a silvery crown over a slate nape and mantle, so the head
    // separates from the back from behind.
    neck: { paint: (p) => mix(P.mantle, P.white, Math.min(1, Math.max(0, (p.z + 0.02 * s) / (0.08 * s)))), finish: FEATHERS },
    crown: { paint: mix(P.grey, P.pale, 0.55), finish: { ...FEATHERS, size: 0.06 } },
    nape: { paint: (p) => mix(P.mantle, mix(P.grey, P.pale, 0.4), Math.min(1, Math.max(0, (p.y - A.head[1] + 0.12 * s) / (0.1 * s)))), finish: { ...FEATHERS, size: 0.06 } },
    face: { paint: P.white, finish: { gloss: 0.15 } },
    cheek: { paint: P.white, finish: { gloss: 0.15 } },
    // The thin white brow over the mask.
    brow: { paint: P.white, finish: { gloss: 0.15 } },
    throat: { paint: P.white, finish: FEATHERS },
    pale: { paint: P.white, finish: { gloss: 0.15 } },
    mask: { paint: P.black, finish: { gloss: 0.25 } },
    bill: { paint: P.bill, finish: { gloss: 0.5 } },
    socket: { paint: P.black, finish: { gloss: 0.3 } },
  });
  const leg: LegStyle = {
    skin: P.leg, claw: P.claw, thick: A.legThick, thigh: P.pale, fringe: 0.55, skinned: { r: 0.05 * s, at: 0.2 },
    toes: [{ yaw: -0.38, len: 0.085 * s }, { yaw: 0, len: 0.095 * s }, { yaw: 0.38, len: 0.085 * s }, { yaw: Math.PI, len: 0.06 * s }],
    clawLen: 0.032 * s,
  };
  // Black wings with the white flash at the base of the primaries.
  const wing: WingStyle = {
    covert: P.black, secondary: P.black, primary: 0xf0eee8, primaryTip: P.black, trim: team.primary,
    thick: 0.03 * s, chord: 0.22 * s, primaries: 7, secondaries: 6, primaryLen: 0.55, secondaryLen: 0.9, finish: { gloss: 0.25 },
  };

  const body = (k: Sculpt): void => {
    // The body is the baked implicit skin (bodies.ts); gear and feathers sit on its surface.
    const axis: [V3, V3] = [[0, 0.42 * s, -0.06 * s], [0, A.head[1] - 0.16 * s, 0.02 * s]];
    const torso = field.only(...TRUNK).surface(...axis, [0, 0, 1]);
    const collar = field.only(...TRUNK, 'neck').surface(...axis, [0, 0, 1]);
    // The player-camera standard: the black wings folded down the flanks, framing the slate mantle.
    foldedWings(k, field.only(...TRUNK).surface([0, 0.52 * s, -0.2 * s], [0, 1.16 * s, 0.06 * s]), wing, { t: [0.42, 0.8], a: 0.38, len: 0.32 * s, wid: 0.12 * s }, d);
    // The butcher's belt in the flock colour, knotted behind, and a flock collar (both read from behind), with iron
    // hooks on the belt.
    const off = 0.012 * s;
    band(k, torso, 0.36, { width: 0.045 * s, thick: 0.014 * s, hex: team.primary, stitch: team.light, off, finish: { gloss: 0.3 } }, d);
    band(k, collar, 0.88, { width: 0.04 * s, thick: 0.012 * s, hex: team.primary, stitch: team.light, finish: { gloss: 0.3 } }, d);
    if (d.level < 3) {
      // The belt's tie, knotted at the back, its two tails hanging.
      for (const x of [1, -1]) {
        const knot = torso.at(0.36, -Math.PI / 2 + x * 0.12, off + 0.02 * s);
        k.card({ at: [knot.p.x, knot.p.y, knot.p.z], dir: norm([x * 0.6, -1, -0.35]), face: [0, 0.2, -1], len: (x > 0 ? 0.13 : 0.1) * s, wid: 0.045 * s, cell: CARD.cloth, root: team.primary, tip: team.dark, curl: 0.2, segs: 2 });
      }
    }
    buckle(k, torso.at(0.36, Math.PI * 0.65, off + 0.02 * s), 0.05 * s, d);
    if (d.level < 2) {
      for (let i = 0; i < 3; i++) {
        const p = torso.at(0.34, Math.PI * (1.1 + i * 0.07), off + 0.02 * s);
        k.loft([{ c: [p.p.x, p.p.y + 0.01 * s, p.p.z], w: 0.006 * s, up: 0.006 * s }, { c: [p.p.x, p.p.y - 0.06 * s, p.p.z + 0.01 * s], w: 0.005 * s, up: 0.005 * s }, { c: [p.p.x + 0.004 * s, p.p.y - 0.085 * s, p.p.z + 0.03 * s], w: 0, up: 0 }], { seg: 5, paint: GEAR.iron, finish: { gloss: 0.7 } });
      }
    }
    // The thorn bandolier: over the left shoulder and round under the right wing, set with bone-pale barbs.
    sash(k, torso, 0.62, 0.16, Math.PI * 0.7, { width: 0.045 * s, thick: 0.012 * s, hex: GEAR.leatherDark, off: off + 0.004 * s, finish: LEATHER }, d);
    if (d.level < 2) {
      for (let i = 0; i < 7; i++) {
        const u = -0.15 - i * 0.14;
        const p = torso.at(0.62 + 0.16 * Math.cos(u), Math.PI * 0.7 + u, off + 0.02 * s);
        const tip = p.p.clone().addScaledVector(p.n, 0.05 * s);
        k.loft([{ c: [p.p.x, p.p.y, p.p.z], w: 0.006 * s, up: 0.006 * s }, { c: [tip.x, tip.y + 0.03 * s, tip.z], w: 0, up: 0 }], { seg: 4, paint: P.thorn, finish: { gloss: 0.4 } });
      }
    }
    pouch(k, torso.at(0.3, Math.PI * 0.12, off), [0.09 * s, 0.1 * s, 0.05 * s], GEAR.leatherDark, d);
  };

  const head = (k: Sculpt): void => {
    // Grey hackles under the back of the crown, and a short ruffled tuft that breaks the flat crown from behind.
    const neckAxis: [V3, V3] = [[0, A.head[1] - 0.32 * s, -0.02 * s], [0, A.head[1] + hr, -0.04 * s]];
    hackles(k, inBone(field.only('neck', 'nape', 'crown').surface(...neckAxis, [0, 0, 1]), A.head), {
      t: [0.38, 0.72], a: [-Math.PI * 0.82, -Math.PI * 0.18], rows: 3, cols: 5, len: 0.08 * s, wid: 0.06 * s, lift: 0.2,
      paint: (t) => mix(P.grey, mix(P.grey, P.pale, 0.55), t), finish: FEATHERS, seed: 23,
    }, d);
    if (d.level < 3) {
      for (let i = 0; i < d.keep(5, 3); i++) {
        const u = (i / Math.max(1, d.keep(5, 3) - 1)) * 2 - 1;
        const at: V3 = [u * hr * 0.32, hr * 0.92, -hr * (0.15 + 0.15 * (1 - Math.abs(u)))];
        k.card({ at, dir: norm([u * 0.35, 0.7, -1]), face: [0, 1, 0.4], len: 0.13 * s, wid: 0.055 * s, cell: CARD.contour, root: mix(P.grey, P.pale, 0.5), tip: P.mantle, curl: -0.2, segs: d.rows, finish: FEATHERS, morph: { display: hinge(at, [1, 0, 0], -0.7) } });
      }
    }
    const E = SHRIKE_HEAD.eye;
    for (const x of [1, -1]) eye(k, [x * hr * E[0], hr * E[1], hr * E[2]], [x * 0.72, 0.04, 0.7], { r: hr * 0.24, iris: P.iris, ring: P.black, lid: P.black, ringW: hr * 0.04 }, d);
    // The butcher's bill: deep, with a sharp hook and a tooth behind it.
    const B = SHRIKE_HEAD.bill;
    beak(k, { at: [0, hr * B[1], hr * (B[2] - 0.04)], len: hr * 0.95, w: hr * 0.28, up: hr * 0.3, dn: hr * 0.2, curve: hr * 0.12, hook: hr * 0.18, base: P.bill, tip: shade(P.bill, 0.6), lower: 0x5a5a60, open: 0.35, teeth: 1 }, d);
  };

  const tail = (k: Sculpt): void => {
    // The blade: a long narrow tail held straight out behind, black with white outer feathers, fanning on a cast.
    const n = d.keep(8, 2);
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
      const outer = Math.abs(u) > 0.7;
      const at: V3 = [u * 0.04 * s, 0.006 * s * (1 - Math.abs(u)), 0];
      const dir = norm([u * 0.08, -0.04, -1]);
      k.card({
        at, dir, face: [0, 1, 0], len: (0.62 - 0.03 * Math.abs(u)) * s, wid: 0.075 * s * Math.min(1.8, (8 / n) ** 0.7), cell: CARD.tail,
        root: outer ? P.white : shade(P.black, 1.1 + 0.15 * (i % 2)), tip: outer ? mix(P.white, P.black, 0.25) : P.black, segs: d.rows, cup: d.level < 2 ? 0.06 : 0, finish: { gloss: 0.3 },
        morph: { display: hinge(at, [0, 1, 0], u * 0.45) },
      });
    }
  };

  return {
    body, head, tail, skin,
    wing: wingsOf(wing, d),
    leg: legsOf(leg, d),
    gun: shrikeGun(s, d),
    pivot: { wingL: A.wing, wingR: flipX(A.wing), legL: A.hip, legR: flipX(A.hip), tail: A.tail },
    legLen: A.legLen, legThick: leg.thick, wingLen: H * 0.36,
    // Thorn Larder, Briar Patch, Impaling Bolt, Butcher's Ring.
    casts: ['throw', 'sweep', 'aim', 'raise'],
    sway: 0, castTail: -0.3, castWiden: 0.25,
  };
};

/** Barb Rifle: a long thornwood barrel studded with barbs, a brass muzzle with a glowing bead, a bone stock and a quiver of barbed bolts. */
function shrikeGun(s: number, d: Detail): SculptedSpec['gun'] {
  const P = SHRIKE;
  const L = 0.62 * s;
  const r = 0.015 * s;
  return {
    main: [0, -0.06 * s, -L * 0.7],
    support: [0, -0.024 * s, 0],
    slideAt: [0, -0.008 * s, -L * 0.34],
    travel: 0.03 * s,
    build(k, part) {
      if (part === 'slide') {
        if (d.level >= 3) return;
        block(k, [0.034 * s, 0.03 * s, 0.09 * s], [0, -0.004 * s, 0], GEAR.woodDark, WOOD, d);
        return;
      }
      if (part !== 'gun') return;
      if (d.level >= 3) {
        lathe(k, [[r * 1.4, 0], [r * 1.2, -L * 0.6], [0.026 * s, -L * 0.7], [0.02 * s, -L]], { seg: 4, paint: P.thornwood });
        return;
      }
      lathe(k, [[r * 1.5, 0], [r * 1.8, -0.012 * s], [r * 1.4, -0.028 * s]], { seg: d.n(12, 4), paint: GEAR.brass, finish: BRASS });
      bead(k, [0, 0, -0.006 * s], r * 0.9, 0xff8a4a, 0.85, d);
      // The barrel: a gnarled thornwood stave, thickening toward the action.
      lathe(k, [[r * 1.1, -0.024 * s], [r * 1.0, -L * 0.25], [r * 1.25, -L * 0.45], [r * 1.5, -L * 0.6]], { seg: d.n(10, 4), paint: P.thornwood, finish: WOOD });
      for (const z of [0.1, 0.48]) ring(k, [0, 0, -L * z], r * 1.2, r * 0.28, d);
      // Barbs along the barrel, alternating sides, hooked back toward the shooter.
      const nb = d.level === 0 ? 8 : d.level === 1 ? 5 : 3;
      for (let i = 0; i < nb; i++) {
        const z = -L * (0.06 + (0.5 * i) / (nb - 1));
        const x = (i % 2 ? 1 : -1) * r * 0.6;
        const base: V3 = [x, r * 0.8, z];
        k.loft([{ c: base, w: r * 0.45, up: r * 0.45 }, { c: [x * 2.2, r * 2.6, z - 0.022 * s], w: 0, up: 0 }], { seg: 4, paint: P.thorn, finish: { gloss: 0.45 } });
      }
      // The action, the grip and the bone stock.
      block(k, [0.04 * s, 0.055 * s, 0.13 * s], [0, -0.006 * s, -L * 0.66], P.thornwood, WOOD, d);
      carve(k, [[-L * 0.66, -0.025 * s], [-L * 0.73, -0.025 * s], [-L * 0.79, -0.11 * s], [-L * 0.71, -0.115 * s]], 0.028 * s, GEAR.woodDark, WOOD, d);
      carve(k, [[-L * 0.74, 0.02 * s], [-L * 0.98, 0.03 * s], [-L * 1.02, -0.06 * s], [-L * 0.96, -0.08 * s], [-L * 0.78, -0.035 * s]], 0.032 * s, GEAR.bone, { gloss: 0.4 }, d);
      if (d.level < 2) {
        // The ammo: a leather quiver of barbed bolts under the barrel, their fletched ends showing.
        lathe(k, [[0.016 * s, -L * 0.3], [0.02 * s, -L * 0.34], [0.02 * s, -L * 0.52], [0.016 * s, -L * 0.55]], { at: [0, -0.034 * s, 0], seg: d.n(10, 5), caps: true, paint: GEAR.leatherDark, finish: LEATHER });
        for (let i = 0; i < 3; i++) k.loft([{ c: [(i - 1) * 0.008 * s, -0.026 * s, -L * 0.3], w: 0.003 * s, up: 0.003 * s }, { c: [(i - 1) * 0.01 * s, -0.022 * s, -L * 0.22], w: 0, up: 0 }], { seg: 4, paint: P.thorn, finish: { gloss: 0.4 } });
      }
    },
  };
}

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

/** This file's sculpted birds. */
const SCULPTED_HERE = { shrike } as const satisfies Record<string, SculptedBird>;
const sculpt = (birds: Readonly<Record<string, SculptedBird>>): Record<string, Build> =>
  Object.fromEntries(Object.entries(birds).map(([id, bird]) => [id, (plan: BodyPlan, team: TeamColours) => sculptedBuild(plan, team, bird)]));

/** Hand-built heroes by id. */
export const HERO_BUILDS: Readonly<Record<string, Build>> = { albatross, kingfisher, lyrebird, ...BIRD_BUILDS_B, ...sculpt(SCULPTED_HERE), ...SCULPTED_BUILDS };
/** Every hero sculpted to the style guide (D-ART-004, D-ART-010). */
export const SCULPTED_IDS = [...Object.keys(SCULPTED_BUILDS), ...Object.keys(SCULPTED_HERE)] as HeroId[];
