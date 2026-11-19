/* eslint-disable @typescript-eslint/no-magic-numbers -- authored proportions: the numbers are the data */
/**
 * Structure models (GDD §7.2 to §7.7): Sentinel Hawk statue on a stone column, Stilt Heron in a timber frame, paired
 * owl-faced Warden gate posts, Roost Shrine, and the two Patrons (Elder Raven for Dawn, Great Owl for Dusk).
 * Each is ONE merged geometry per glow state and leg pose (swapped on the mesh), so a structure costs one draw call. Towers stay at or below STRUCTURE.towerMaxHeight so the 12 m
 * Updraft rider passes clear above their centrelines. Footprints follow StructureInfo.body.
 */
import type { BufferGeometry } from 'three';
import type { StructureType } from '../../../sim/core/contracts';
import type { TeamColours } from '../palette';
import { STRUCTURE as S } from './constants';
import { Parts } from './parts';

type V3 = [number, number, number];

/** Eye and crystal colour state: 0 off, 1 lit in team colour (it has a target), 2 raged (Patron transition and phase two). */
export type Glow = 0 | 1 | 2;
export const HERON_POSES = 3;

export interface StructureBuild {
  /**
   * The whole structure as ONE geometry (one draw call, frustum-culled like any mesh) for a glow state and, for the
   * Heron, a leg pose (0 standing, 1 left leg raised, 2 right leg raised). Built on first use and cached.
   */
  readonly geometry: (glow: Glow, pose: number) => BufferGeometry;
  /** Patron heart-feather (centred on its own origin, fits a sphere of radius 1). */
  readonly heart?: BufferGeometry;
  /** Topmost point of the visible geometry (m above the base). */
  readonly height: number;
  /** Brood Ward dome: radius and centre height. */
  readonly dome: { readonly radius: number; readonly y: number };
}

interface Built {
  readonly geo: BufferGeometry;
  readonly heart?: BufferGeometry;
  readonly height: number;
  readonly dome: StructureBuild['dome'];
}

export interface StructureBody {
  readonly radius: number;
  readonly height: number;
}

const dome = (b: StructureBody, height: number): StructureBuild['dome'] => ({ radius: Math.hypot(b.radius, height / 2) * 1.05, y: height / 2 });

/** An owl face (a disc, two eyes into `glow`, two tufts) at `at` facing +z; `r` is the face radius. */
function owlFace(main: Parts, glow: Parts, face: number, tuft: number, r: number, at: V3, eye: number): void {
  main.ell(face, [r, r * 0.95, r * 0.3], [at[0], at[1], at[2] + r * 0.15]);
  main.cone(0x3a2f26, r * 0.2, r * 0.55, [at[0], at[1] - r * 0.15, at[2] + r * 0.4], [0.5, 0, 0]);
  for (const s of [1, -1]) {
    glow.ell(eye, [r * 0.3, r * 0.3, r * 0.12], [at[0] + s * r * 0.42, at[1] + r * 0.12, at[2] + r * 0.4]);
    main.cone(tuft, r * 0.28, r * 0.9, [at[0] + s * r * 0.75, at[1] + r * 0.8, at[2]], [-Math.PI / 2, 0, -s * 0.3]);
  }
}

/** Hawk: a hawk statue, wings half open, on an 8 m stone column. Total height under 10 m. */
function hawk(team: TeamColours, body: StructureBody, eye: number): Built {
  const main = new Parts();
  const glow = main;
  const r = Math.min(body.radius, 2);
  main.cyl(S.stone, r * 0.55, r * 0.7, S.hawkColumn, [0, S.hawkColumn / 2, 0]);
  main.cyl(S.stoneDark, r * 0.85, r * 0.95, 0.7, [0, 0.35, 0]);
  main.cyl(team.primary, r * 0.6, r * 0.6, 0.35, [0, S.hawkColumn * 0.72, 0]);
  main.cyl(S.stoneDark, r * 0.7, r * 0.55, 0.5, [0, S.hawkColumn + 0.25, 0]);
  const y = S.hawkColumn + 0.5;
  // The statue is scaled to fit the 2 m left under the 10 m ceiling (wings, head and all).
  const q = 0.74;
  main.ell(S.hawkBrown, [0.7 * q, 0.62 * q, 0.55 * q], [0, y + 0.55 * q, -0.05], [-0.5, 0, 0]);
  main.ell(S.hawkCream, [0.55 * q, 0.45 * q, 0.35 * q], [0, y + 0.45 * q, 0.3 * q], [-0.5, 0, 0]);
  main.ell(S.hawkBrown, [0.4 * q, 0.4 * q, 0.42 * q], [0, y + 1.25 * q, 0.45 * q]);
  main.cone(0x2a2a2e, 0.14 * q, 0.5 * q, [0, y + 1.15 * q, 0.8 * q], [0.5, 0, 0]);
  for (const s of [1, -1]) {
    main.ell(S.hawkBrown, [2.4 * q, 0.1, 0.8 * q], [s * 2.0 * q, y + 0.85 * q, -0.2], [0, s * 0.25, -s * 0.3]);
    main.ell(team.primary, [0.7 * q, 0.11, 0.35 * q], [s * 3.55 * q, y + 1.0 * q, -0.3], [0, s * 0.25, -s * 0.3]);
    glow.ell(eye, [0.1 * q, 0.1 * q, 0.1 * q], [s * 0.2 * q, y + 1.38 * q, 0.78 * q], [0, 0, 0], [5, 4]);
  }
  main.box(S.hawkBrown, [0.5 * q, 0.08, 1.1 * q], [0, y + 0.55 * q, -0.9 * q], [0.3, 0, 0]);
  return { geo: main.build(), height: y + 1.5, dome: dome(body, y + 1.5) };
}

/** Heron: a wading heron on two stilt legs inside a timber frame; legs are separate so they can step and stomp. */
function heron(team: TeamColours, body: StructureBody, eye: number, pose: number): Built {
  const main = new Parts();
  const glow = main;
  const f = Math.min(body.radius * 0.88, 2.3);
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      main.cyl(S.timber, 0.16, 0.2, S.heronFrame, [sx * f, S.heronFrame / 2, sz * f]);
      main.cyl(team.primary, 0.19, 0.19, 0.3, [sx * f, S.heronFrame * 0.55, sz * f]);
    }
    main.box(S.timberDark, [0.22, 0.22, f * 2], [sx * f, S.heronFrame - 0.1, 0]);
    main.box(S.timberDark, [0.18, 0.18, f * 2.2], [sx * f, S.heronFrame * 0.3, 0], [0, 0, 0]);
  }
  for (const sz of [1, -1]) main.box(S.timberDark, [f * 2, 0.22, 0.22], [0, S.heronFrame - 0.1, sz * f]);
  main.box(S.stoneDark, [f * 2.4, 0.5, f * 2.4], [0, 0.25, 0]);
  const hip = 4.6;
  main.ell(S.heronGrey, [0.8, 0.6, 1.3], [0, hip + 0.4, -0.2]);
  main.ell(0xe8eef2, [0.6, 0.4, 0.9], [0, hip + 0.3, 0.05]);
  main.ell(team.primary, [0.5, 0.12, 0.7], [0, hip + 0.9, -0.5]);
  const neck = (t: number): V3 => [0, hip + 0.8 + t * 2.3, 0.5 + Math.sin(t * Math.PI * 2) * 0.55 - t * 0.2];
  for (let i = 0; i < 6; i++) main.rod(S.heronGrey, neck(i / 6), neck((i + 1) / 6), 0.17);
  const head = neck(1);
  main.ell(S.heronGrey, [0.28, 0.26, 0.4], head);
  main.cone(S.heronBill, 0.12, 1.5, [head[0], head[1] - 0.05, head[2] + 0.3], [0.1, 0, 0]);
  main.ell(0x111111, [0.2, 0.1, 0.5], [head[0], head[1] + 0.25, head[2] - 0.4], [0.4, 0, 0]);
  for (const s of [1, -1]) glow.ell(eye, [0.07, 0.07, 0.07], [s * 0.2, head[1] + 0.06, head[2] + 0.22], [0, 0, 0], [5, 4]);
  // Legs from the hips; pose 1 or 2 swings one leg forward and up (a step, or the stomp's raised leg).
  for (const [side, raised] of [[1, pose === 1], [-1, pose === 2]] as const) {
    const a = raised ? S.stompLift : 0;
    const hipAt: V3 = [side * 0.55, hip, 0];
    const foot: V3 = [side * 0.55, hip - hip * Math.cos(a), hip * Math.sin(a)];
    const f: V3 = [foot[0], foot[1], foot[2]];
    main.rod(S.heronBill, hipAt, [f[0], f[1], f[2]], 0.09).box(S.heronBill, [0.3, 0.08, 0.8], [f[0], f[1] + 0.04, f[2] + 0.3], [-a, 0, 0]).ell(S.heronGrey, [0.14, 0.4, 0.14], [side * 0.55, hip - 0.3, 0]);
  }
  return { geo: main.build(), height: head[1] + 0.5, dome: dome(body, head[1] + 0.5) };
}

/** Warden: paired owl-faced gate posts woven from branches, 7 m, with a team lintel between them. */
function warden(team: TeamColours, body: StructureBody, eye: number): Built {
  const main = new Parts();
  const glow = main;
  const gap = Math.max(0.6, body.radius * 0.62);
  const h = S.wardenHeight;
  for (const s of [1, -1]) {
    const x = s * gap;
    main.cyl(S.stoneDark, 0.65, 0.75, 0.5, [x, 0.25, 0]);
    // Woven branches: stacked twisted ellipsoids, alternating shades.
    for (let i = 0; i < 9; i++) {
      const y = 0.5 + i * 0.44;
      main.ell(i % 2 ? S.timber : S.timberDark, [0.46, 0.3, 0.46], [x, y, 0], [0, i * 0.7, 0.12 * (i % 3 - 1)]);
    }
    main.ell(S.timber, [0.55, 0.6, 0.5], [x, h - 1.1, 0]);
    owlFace(main, glow, S.owlCream, S.timberDark, 0.5, [x, h - 0.95, 0.35], eye);
    main.cyl(team.primary, 0.5, 0.5, 0.18, [x, h - 2.0, 0]);
  }
  main.box(S.timberDark, [gap * 2, 0.22, 0.3], [0, 4.6, 0]);
  main.box(team.primary, [gap * 1.6, 0.9, 0.08], [0, 3.9, 0.12]);
  return { geo: main.build(), height: h, dome: dome(body, h) };
}

/** Shrine: a stone base, a ring of five timber posts holding a twig nest, and a glowing crystal feather. */
function shrine(team: TeamColours, body: StructureBody, eye: number): Built {
  const main = new Parts();
  const glow = main;
  const r = Math.min(body.radius, 2);
  main.cyl(S.stoneDark, r * 0.95, r, 0.9, [0, 0.45, 0]);
  main.cyl(S.stone, r * 0.8, r * 0.9, 0.5, [0, 1.15, 0]);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p: V3 = [Math.sin(a) * r * 0.7, 3.1, Math.cos(a) * r * 0.7];
    main.cyl(S.timber, 0.16, 0.22, 3.9, p);
    main.cyl(team.primary, 0.19, 0.19, 0.25, [p[0], 2.0, p[2]]);
    main.rod(S.timberDark, [p[0], 5.0, p[2]], [Math.sin(a) * r * 1.15, 5.7, Math.cos(a) * r * 1.15], 0.1);
  }
  main.ell(S.timber, [r * 1.15, 0.45, r * 1.15], [0, 5.1, 0], [0, 0, 0], [10, 5]);
  main.ell(S.timberDark, [r * 0.8, 0.3, r * 0.8], [0, 5.45, 0], [0, 0.4, 0], [8, 4]);
  glow.cone(eye, 0.5, 1.4, [0, 5.4, 0], [-Math.PI / 2, 0, 0], 4, [1, 0.45, 1]);
  glow.ell(eye, [0.18, 0.18, 0.18], [0, 6.9, 0], [0, 0, 0], [5, 4]);
  return { geo: main.build(), height: S.shrineHeight, dome: dome(body, S.shrineHeight) };
}

/** The Patron: Elder Raven (Dawn) or Great Owl (Dusk), a statue larger than the towers with a heart-feather mark. */
function patron(team: TeamColours, body: StructureBody, owl: boolean, eye: number): Built {
  const main = new Parts();
  const glow = main;
  const k = S.patronHeight / 11.5;
  const base = owl ? S.owlGrey : S.ravenBlack;
  const sheen = owl ? S.owlCream : S.ravenSheen;
  for (const s of [1, -1]) {
    main.cyl(0x3a3028, 0.6 * k, 0.75 * k, 3.6 * k, [s * 1.3 * k, 1.8 * k, 0]);
    for (const t of [-0.6, 0, 0.6]) main.cone(0x3a3028, 0.22 * k, 1.5 * k, [s * 1.3 * k, 0.2, 0.5 * k], [0.3, t, 0]);
  }
  main.ell(base, [2.7 * k, 3.1 * k, 2.3 * k], [0, 6 * k, -0.1], [-0.1, 0, 0]);
  main.ell(sheen, [2.0 * k, 2.4 * k, 1.5 * k], [0, 5.7 * k, 0.9 * k], [-0.1, 0, 0]);
  main.ell(team.primary, [2.6 * k, 0.3 * k, 2.2 * k], [0, 8.4 * k, -0.1]);
  // Head, beak or face.
  const hy = 9.7 * k;
  main.ell(base, [1.45 * k, 1.35 * k, 1.35 * k], [0, hy, 0.5 * k]);
  if (owl) {
    owlFace(main, glow, S.owlCream, base, 1.25 * k, [0, hy, 1.0 * k], eye);
  } else {
    main.cone(0x2a2a30, 0.6 * k, 2.4 * k, [0, hy - 0.15, 1.5 * k], [0.18, 0, 0]);
    main.cone(0x2a2a30, 0.3 * k, 0.9 * k, [0, hy - 0.8, 3.6 * k], [0.9, 0, 0]);
    for (const s of [1, -1]) glow.ell(eye, [0.28 * k, 0.28 * k, 0.2 * k], [s * 0.85 * k, hy + 0.25 * k, 1.6 * k]);
    for (let i = 0; i < 3; i++) main.cone(base, 0.25 * k, 1.6 * k, [0, hy + 1.0 * k, -0.2 * k - i * 0.4], [-Math.PI / 2 - 0.4 - i * 0.25, 0, 0]);
  }
  // Wings half-open, swept back, and a fanned tail.
  for (const s of [1, -1]) {
    main.ell(base, [0.5 * k, 3.4 * k, 1.9 * k], [s * 3.3 * k, 6.4 * k, -0.7 * k], [0, s * 0.3, -s * 0.5]);
    main.ell(sheen, [0.35 * k, 2.2 * k, 1.1 * k], [s * 4.5 * k, 7.4 * k, -1.0 * k], [0, s * 0.3, -s * 0.75]);
    main.ell(team.primary, [0.4 * k, 0.5 * k, 0.9 * k], [s * 5.2 * k, 8.3 * k, -1.1 * k], [0, s * 0.3, -s * 0.9]);
  }
  for (let i = -2; i <= 2; i++) main.ell(i % 2 ? base : sheen, [0.35 * k, 0.12 * k, 2.2 * k], [i * 0.55 * k, 3.4 * k, -3.3 * k], [-0.35, i * -0.2, 0]);
  const heart = new Parts()
    .ell(S.heartColour, [0.32, 0.9, 0.12], [0, 0, 0])
    .rod(0xffffff, [0, -1, 0], [0, 0.9, 0], 0.045)
    .ell(0xfff2b0, [0.18, 0.55, 0.14], [0, 0.1, 0.04]);
  return { geo: main.build(), heart: heart.build(), height: hy + 1.9 * k, dome: dome(body, S.patronHeight) };
}

const eyeHex = (team: TeamColours, g: Glow): number => (g === 2 ? S.ragedGlow : g === 1 ? team.light : S.glowOff);

function make(type: StructureType, owl: boolean, team: TeamColours, body: StructureBody, g: Glow, pose: number): Built {
  const eye = eyeHex(team, g);
  switch (type) {
    case 'hawk': return hawk(team, body, eye);
    case 'heron': return heron(team, body, eye, pose);
    case 'warden': return warden(team, body, eye);
    case 'shrine':
    case 'nest': return shrine(team, body, eye);
    case 'patron': return patron(team, body, owl, eye);
  }
}

/** A structure model for a flock; the body is StructureInfo.body. Geometry variants are built lazily and cached. */
export function buildStructure(type: StructureType, team: 'dawn' | 'dusk', colours: TeamColours, body: StructureBody): StructureBuild {
  const cache = new Map<number, BufferGeometry>();
  const first = make(type, team === 'dusk', colours, body, 0, 0);
  cache.set(0, first.geo);
  return {
    geometry: (g, pose) => {
      const key = g * HERON_POSES + pose;
      let geo = cache.get(key);
      if (!geo) {
        geo = make(type, team === 'dusk', colours, body, g, pose).geo;
        cache.set(key, geo);
      }
      return geo;
    },
    ...(first.heart && { heart: first.heart }),
    height: first.height,
    dome: first.dome,
  };
}
