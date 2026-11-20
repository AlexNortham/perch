/* eslint-disable @typescript-eslint/no-magic-numbers -- authored anatomy: the numbers are the sculpture */
/**
 * Implicit bodies for the world's models (D-ART-008 pipeline, D-ART-014): fledglings, Thicket creatures, the Roc and the
 * bird statues of the structures and Patrons. Each is signed-distance masses in its own frame (+z forward, +y up, feet
 * or base at y = 0), baked offline by `npx tsx tests/anim/bake-world.ts` into `data/world/<name>.ts` and painted per
 * region at runtime. Nothing here is skinned: every vertex rides the root bone.
 */
import { head, neck } from './bodies';
import { cone, ell, pair } from './sdf';
import type { Body, Op } from './sdf';
import type { V3 } from './sculpt';

const ring = (n: number, f: (i: number, a: number) => Op[]): Op[] => Array.from({ length: n }, (_, i) => f(i, (i / n) * Math.PI * 2)).flat();
const scaleOps = (ops: readonly Op[], s: number, off: V3 = [0, 0, 0]): Op[] => ops.map((o) => {
  const sh = o.shape;
  const p = (v: V3): V3 => [v[0] * s + off[0], v[1] * s + off[1], v[2] * s + off[2]];
  const shape = 'c' in sh ? { c: p(sh.c), r: [sh.r[0] * s, sh.r[1] * s, sh.r[2] * s] as V3, ...(sh.rot && { rot: sh.rot }) } : { a: p(sh.a), b: p(sh.b), ra: sh.ra * s, rb: sh.rb * s };
  return { ...o, shape, ...(o.k !== undefined && { k: o.k * s }), ...(o.soft !== undefined && { soft: o.soft * s }) };
});

// ---------------------------------------------------------------------------------------------------------------
// Fledgling: a round chick (0.9 m), head down merged into the body, wing-fists, a scalloped down rim.

function chick(): Body {
  return {
    cell: 0.006,
    tris: [430, 170, 80, 40],
    ops: [
      ell([0, 0.4, -0.02], [0.37, 0.35, 0.38], 'body', 'down'),
      ell([0, 0.33, 0.1], [0.3, 0.26, 0.27], 'body', 'belly', { k: 0.08 }),
      ell([0, 0.67, 0.12], [0.255, 0.235, 0.245], 'head', 'cap', { k: 0.15 }),
      ell([0, 0.62, 0.3], [0.17, 0.12, 0.08], 'head', 'face', { mark: true, soft: 0.02 }),
      ...pair(ell([0.35, 0.43, 0.02], [0.085, 0.15, 0.12], 'body', 'wing', { k: 0.05, rot: [0.25, 0, -0.35] })),
      ell([0, 0.36, -0.37], [0.1, 0.08, 0.09], 'body', 'down', { k: 0.06, rot: [-0.5, 0, 0] }),
      // Head fluff and a scalloped rim of down round the body.
      ell([0, 0.9, 0.1], [0.045, 0.08, 0.045], 'head', 'cap', { k: 0.04, rot: [0.4, 0, 0] }),
      ...pair(ell([0.06, 0.88, 0.04], [0.04, 0.07, 0.04], 'head', 'cap', { k: 0.04, rot: [0.2, 0, -0.5] })),
      ...ring(10, (i, a) => [ell([Math.sin(a) * 0.35, 0.27 + (i % 2) * 0.03, Math.cos(a) * 0.36 - 0.02], [0.075, 0.05, 0.075], 'body', i < 3 || i > 7 ? 'belly' : 'down', { k: 0.035 })]),
      ...pair(ell([0.105, 0.68, 0.315], [0.05, 0.05, 0.03], 'head', 'cap', { sub: true, k: 0.03 })),
    ],
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Thicket creatures (GDD §7.8): heights from CREATURES (beetle 0.6, weasel 0.6, rat 0.35, toad 0.8, badger 1.1, cub 0.6).

function beetle(): Body {
  return {
    cell: 0.006,
    tris: [520, 190, 80, 40],
    ops: [
      ell([0, 0.33, -0.2], [0.29, 0.2, 0.4], 'body', 'shell'),
      // The seam down the wing cases, and a lip where they meet the pronotum.
      cone([0, 0.535, 0.16], [0, 0.5, -0.56], 0.018, 0.018, 'body', 'shell', { sub: true, k: 0.025 }),
      ell([0, 0.34, 0.22], [0.25, 0.14, 0.15], 'body', 'pronotum', { k: 0.025 }),
      ell([0, 0.32, 0.42], [0.2, 0.1, 0.11], 'body', 'head', { k: 0.03 }),
      ...pair(ell([0.14, 0.34, 0.47], [0.04, 0.035, 0.035], 'body', 'eye', { k: 0.01 })),
      ell([0, 0.22, -0.08], [0.24, 0.09, 0.42], 'body', 'under', { k: 0.05 }),
      ell([0, 0.26, 0.24], [0.2, 0.08, 0.15], 'body', 'under', { k: 0.04 }),
    ],
  };
}

function weasel(): Body {
  return {
    cell: 0.006,
    tris: [820, 280, 100, 50],
    ops: [
      ell([0, 0.33, 0.2], [0.14, 0.15, 0.2], 'body', 'fur'),
      cone([0, 0.32, 0.16], [0, 0.31, -0.3], 0.14, 0.13, 'body', 'fur', { k: 0.06 }),
      ell([0, 0.31, -0.34], [0.145, 0.145, 0.17], 'body', 'fur', { k: 0.06 }),
      cone([0, 0.38, 0.3], [0, 0.45, 0.44], 0.1, 0.085, 'body', 'fur', { k: 0.05 }),
      ell([0, 0.47, 0.5], [0.095, 0.085, 0.12], 'head', 'fur', { k: 0.05 }),
      ell([0, 0.445, 0.62], [0.052, 0.045, 0.07], 'head', 'muzzle', { k: 0.04 }),
      ell([0, 0.45, 0.69], [0.018, 0.016, 0.014], 'head', 'nose', { k: 0.008 }),
      ...pair(ell([0.068, 0.555, 0.46], [0.038, 0.036, 0.018], 'head', 'ear', { k: 0.015, rot: [0, -0.3, -0.3] })),
      ...pair(ell([0.055, 0.49, 0.56], [0.022, 0.022, 0.02], 'head', 'fur', { sub: true, k: 0.012 })),
      // Legs: forelegs under the chest, haunches and hind legs; small paws on the ground.
      ...pair(cone([0.08, 0.28, 0.24], [0.075, 0.03, 0.29], 0.05, 0.034, 'body', 'dark', { k: 0.04 })),
      ...pair(ell([0.075, 0.022, 0.31], [0.04, 0.022, 0.05], 'body', 'dark', { k: 0.02 })),
      ...pair(ell([0.09, 0.27, -0.36], [0.075, 0.11, 0.11], 'body', 'fur', { k: 0.05 })),
      ...pair(cone([0.095, 0.2, -0.38], [0.09, 0.03, -0.3], 0.055, 0.034, 'body', 'dark', { k: 0.04 })),
      ...pair(ell([0.09, 0.022, -0.27], [0.04, 0.022, 0.055], 'body', 'dark', { k: 0.02 })),
      cone([0, 0.31, -0.48], [0, 0.29, -0.78], 0.06, 0.045, 'body', 'fur', { k: 0.04 }),
      cone([0, 0.29, -0.78], [0, 0.27, -0.98], 0.045, 0.03, 'body', 'tip', { k: 0.03 }),
      ell([0, 0.25, 0.08], [0.11, 0.09, 0.42], 'body', 'belly', { mark: true, soft: 0.02 }),
      ell([0, 0.4, 0.5], [0.07, 0.06, 0.12], 'head', 'belly', { mark: true, soft: 0.015, rot: [0.6, 0, 0] }),
    ],
  };
}

function rat(): Body {
  return {
    cell: 0.005,
    tris: [660, 240, 100, 50],
    ops: [
      ell([0, 0.19, -0.06], [0.145, 0.145, 0.23], 'body', 'fur', { rot: [0.15, 0, 0] }),
      ell([0, 0.2, 0.12], [0.115, 0.115, 0.13], 'body', 'fur', { k: 0.06 }),
      ell([0, 0.21, 0.26], [0.078, 0.072, 0.095], 'head', 'fur', { k: 0.05 }),
      cone([0, 0.2, 0.3], [0, 0.18, 0.41], 0.055, 0.02, 'head', 'fur', { k: 0.03 }),
      ell([0, 0.181, 0.415], [0.016, 0.014, 0.012], 'head', 'nose', { k: 0.006 }),
      ...pair(ell([0.06, 0.29, 0.22], [0.05, 0.055, 0.016], 'head', 'ear', { k: 0.012, rot: [0.2, -0.5, -0.2] })),
      ...pair(ell([0.045, 0.235, 0.31], [0.017, 0.017, 0.015], 'head', 'fur', { sub: true, k: 0.01 })),
      ...pair(ell([0.09, 0.13, -0.15], [0.07, 0.1, 0.11], 'body', 'fur', { k: 0.04 })),
      ...pair(cone([0.07, 0.12, 0.14], [0.06, 0.02, 0.18], 0.032, 0.022, 'body', 'skin', { k: 0.025 })),
      ...pair(ell([0.06, 0.012, 0.2], [0.024, 0.012, 0.035], 'body', 'skin', { k: 0.012 })),
      ...pair(ell([0.1, 0.014, -0.12], [0.026, 0.014, 0.06], 'body', 'skin', { k: 0.015 })),
      ell([0, 0.12, 0.0], [0.1, 0.07, 0.25], 'body', 'belly', { mark: true, soft: 0.015 }),
    ],
  };
}

function toad(): Body {
  return {
    cell: 0.008,
    tris: [920, 300, 120, 60],
    ops: [
      ell([0, 0.37, -0.06], [0.48, 0.3, 0.46], 'body', 'skin'),
      ell([0, 0.45, 0.28], [0.4, 0.23, 0.3], 'head', 'skin', { k: 0.12 }),
      ell([0, 0.41, 0.53], [0.36, 0.022, 0.1], 'head', 'skin', { sub: true, k: 0.03 }),
      ...pair(ell([0.24, 0.64, 0.3], [0.115, 0.105, 0.115], 'head', 'skin', { k: 0.06 })),
      ...pair(ell([0.24, 0.585, 0.12], [0.11, 0.06, 0.16], 'head', 'gland', { k: 0.05 })),
      ell([0, 0.25, 0.38], [0.27, 0.12, 0.18], 'head', 'throat', { k: 0.06 }),
      ell([0, 0.17, 0.0], [0.38, 0.12, 0.36], 'body', 'belly', { k: 0.1 }),
      ...pair(cone([0.32, 0.3, 0.28], [0.37, 0.04, 0.42], 0.085, 0.055, 'body', 'skin', { k: 0.06 })),
      ...pair(ell([0.4, 0.025, 0.46], [0.09, 0.025, 0.08], 'body', 'skin', { k: 0.03 })),
      ...pair(ell([0.42, 0.22, -0.26], [0.16, 0.17, 0.27], 'body', 'skin', { k: 0.08 })),
      ...pair(ell([0.48, 0.04, -0.04], [0.11, 0.04, 0.21], 'body', 'skin', { k: 0.04, rot: [0, 0.4, 0] })),
      // Warts over the back and head.
      ...[[0.2, 0.62, -0.1], [-0.18, 0.63, -0.18], [0.05, 0.66, -0.3], [0.32, 0.55, -0.3], [-0.33, 0.54, -0.05], [0.1, 0.65, 0.05], [-0.08, 0.66, -0.02],
        [0.36, 0.5, 0.05], [-0.25, 0.6, -0.36], [0.22, 0.6, -0.42], [-0.05, 0.6, -0.45], [0.4, 0.4, -0.38], [-0.42, 0.42, -0.3], [0.14, 0.62, 0.22]]
        .map((c, i) => ell(c as unknown as V3, [0.035 + 0.02 * (i % 3), 0.03, 0.035 + 0.015 * (i % 2)], 'body', 'wart', { k: 0.025 })),
      ...pair(ell([0.21, 0.66, 0.38], [0.06, 0.06, 0.05], 'head', 'skin', { sub: true, k: 0.02 })),
    ],
  };
}

function badger(cub: boolean): Body {
  const ops: Op[] = [
    ell([0, 0.55, -0.12], [0.42, 0.37, 0.6], 'body', 'back'),
    ell([0, 0.6, 0.33], [0.37, 0.35, 0.32], 'body', 'back', { k: 0.12 }),
    ell([0, 0.34, 0.0], [0.33, 0.16, 0.55], 'body', 'dark', { k: 0.1 }),
    ell([0, 0.62, 0.66], [0.23, 0.2, 0.23], 'head', 'face', { k: 0.1 }),
    cone([0, 0.6, 0.72], [0, 0.5, 1.02], 0.19, 0.06, 'head', 'face', { k: 0.06 }),
    ell([0, 0.5, 1.04], [0.055, 0.045, 0.035], 'head', 'nose', { k: 0.02 }),
    ...pair(ell([0.16, 0.8, 0.6], [0.06, 0.05, 0.03], 'head', 'ear', { k: 0.02, rot: [0, -0.4, -0.3] })),
    ...pair(ell([0.095, 0.66, 0.84], [0.035, 0.035, 0.03], 'head', 'face', { sub: true, k: 0.015 })),
    ...pair(cone([0.09, 0.56, 1.0], [0.13, 0.78, 0.56], 0.035, 0.075, 'head', 'stripe', { mark: true, soft: 0.012 })),
    ...pair(cone([0.25, 0.45, 0.43], [0.27, 0.06, 0.52], 0.13, 0.095, 'body', 'dark', { k: 0.08 })),
    ...pair(ell([0.27, 0.05, 0.6], [0.1, 0.05, 0.12], 'body', 'dark', { k: 0.04 })),
    ...pair(ell([0.27, 0.48, -0.5], [0.15, 0.22, 0.2], 'body', 'back', { k: 0.08 })),
    ...pair(cone([0.28, 0.4, -0.52], [0.28, 0.06, -0.44], 0.13, 0.095, 'body', 'dark', { k: 0.08 })),
    ...pair(ell([0.28, 0.05, -0.38], [0.1, 0.05, 0.12], 'body', 'dark', { k: 0.04 })),
    ell([0, 0.62, -0.74], [0.1, 0.08, 0.14], 'body', 'back', { k: 0.06, rot: [-0.4, 0, 0] }),
  ];
  if (!cub) return { cell: 0.01, tris: [920, 300, 120, 60], ops };
  // A cub: half size, a big head, shorter legs and a rounder body.
  const kid = ops.map((o) => (o.region === 'face' || o.region === 'stripe' || o.region === 'ear' || o.region === 'nose' ? scaleOps([o], 1.3, [0, -0.2, -0.28])[0]! : o));
  return { cell: 0.006, tris: [720, 240, 100, 50], ops: scaleOps(kid, 0.56) };
}

// ---------------------------------------------------------------------------------------------------------------
// Statues and Patrons (style guide §9): bodies in their own unit frames, scaled and placed by structures.ts.

/** The Sentinel Hawk's bronze bird: perched upright, feet at 0, head top about 1.45. */
function hawk(): Body {
  return {
    cell: 0.008,
    tris: [4000, 1100, 500, 250],
    ops: [
      ell([0, 0.72, -0.06], [0.31, 0.42, 0.29], 'body', 'back', { rot: [0.35, 0, 0] }),
      ell([0, 0.74, 0.1], [0.3, 0.34, 0.24], 'body', 'breast', { k: 0.1, rot: [0.25, 0, 0] }),
      ell([0, 0.46, 0.06], [0.22, 0.2, 0.19], 'body', 'breast', { k: 0.1 }),
      ell([0, 1.0, -0.06], [0.29, 0.15, 0.2], 'body', 'back', { k: 0.08 }),
      ...pair(ell([0.25, 0.88, -0.1], [0.11, 0.22, 0.2], 'body', 'back', { k: 0.06, rot: [0.4, 0.2, -0.25] })),
      ...pair(ell([0.26, 0.66, -0.16], [0.07, 0.28, 0.2], 'body', 'wing', { k: 0.05, rot: [0.5, 0, -0.1] })),
      ...pair(cone([0.11, 0.48, 0.06], [0.12, 0.2, 0.09], 0.11, 0.075, 'body', 'thigh', { k: 0.06, flow: [0, -1, 0.1] })),
      ell([0, 0.4, -0.3], [0.13, 0.1, 0.24], 'body', 'back', { k: 0.07, rot: [0.75, 0, 0] }),
      ...neck([[0, 0.98, 0.05], [0, 1.1, 0.1], [0, 1.19, 0.15]], [0.16, 0.135, 0.125]),
      ...head([0, 1.26, 0.18], 0.125, { eye: [0.45, 0.14, 0.5], socket: 0.22, bill: [0, -0.12, 0.95], billW: 0.3, billH: 0.3, browTilt: 0.5, brow: [0.52, 0.24, 0.5] }),
    ],
  };
}

/** The Stilt Heron's stone bird without its legs: hips at 0, the neck kinked up to a head about 2.9 above. */
function heron(): Body {
  return {
    cell: 0.012,
    tris: [4900, 1300, 550, 250],
    ops: [
      ell([0, 0.3, -0.05], [0.55, 0.52, 1.05], 'body', 'back', { rot: [0.2, 0, 0] }),
      ell([0, 0.2, 0.4], [0.46, 0.46, 0.55], 'body', 'breast', { k: 0.25 }),
      ell([0, 0.62, -0.25], [0.52, 0.26, 0.78], 'body', 'wing', { k: 0.18, rot: [0.15, 0, 0] }),
      ell([0, 0.02, -1.0], [0.28, 0.16, 0.5], 'body', 'back', { k: 0.15, rot: [0.45, 0, 0] }),
      ...neck([[0, 0.4, 0.6], [0, 0.95, 0.9], [0, 1.55, 0.7], [0, 2.0, 0.42], [0, 2.4, 0.55], [0, 2.62, 0.84]], [0.3, 0.22, 0.18, 0.17, 0.17, 0.18], 'neck', 0.6),
      ...head([0, 2.74, 1.0], 0.22, { eye: [0.42, 0.18, 0.42], socket: 0.18, bill: [0, -0.05, 0.95], billW: 0.26, billH: 0.24, browTilt: 0.25, nape: [0.7, 0.62, 0.7] }),
    ],
  };
}

/** A Warden's carved owl head: a facial disc with deep dishes, brows, a ruff, about 1.1 wide, centred on 0. */
function owlHead(): Body {
  return {
    cell: 0.008,
    tris: [1500, 600, 230, 90],
    ops: [
      ell([0, 0, -0.06], [0.56, 0.52, 0.44], 'head', 'crown'),
      ...pair(ell([0.36, -0.05, 0.28], [0.17, 0.36, 0.16], 'head', 'ruff', { k: 0.06, rot: [0, 0.35, 0.1] })),
      ell([0, -0.36, 0.25], [0.3, 0.13, 0.16], 'head', 'ruff', { k: 0.08 }),
      ...pair(ell([0.19, 0.0, 0.5], [0.22, 0.25, 0.14], 'head', 'disc', { sub: true, k: 0.06 })),
      ell([0, -0.02, 0.37], [0.065, 0.28, 0.1], 'head', 'ridge', { k: 0.05 }),
      ...pair(ell([0.17, 0.25, 0.36], [0.22, 0.06, 0.08], 'head', 'brow', { k: 0.05, rot: [0, 0.2, -0.45] })),
      ...pair(ell([0.19, 0.03, 0.42], [0.1, 0.1, 0.08], 'head', 'disc', { sub: true, k: 0.03 })),
    ],
  };
}

/** The Elder Raven (Patron, Dawn): hunched, shaggy-throated, a heavy bill; feet at 0, head top about 1.22. */
function raven(): Body {
  return {
    cell: 0.0045,
    tris: [9000, 3600, 1300, 500],
    ops: [
      ell([0, 0.6, -0.05], [0.3, 0.4, 0.3], 'body', 'back', { rot: [0.55, 0, 0] }),
      ell([0, 0.55, 0.13], [0.27, 0.3, 0.24], 'body', 'breast', { k: 0.12, rot: [0.5, 0, 0] }),
      ell([0, 0.36, 0.05], [0.21, 0.18, 0.2], 'body', 'breast', { k: 0.1 }),
      ell([0, 0.86, 0.02], [0.3, 0.16, 0.22], 'body', 'back', { k: 0.1, rot: [0.4, 0, 0] }),
      ...pair(ell([0.22, 0.75, -0.04], [0.12, 0.24, 0.2], 'body', 'back', { k: 0.07, rot: [0.5, 0.2, -0.2] })),
      ...pair(cone([0.11, 0.36, 0.07], [0.12, 0.16, 0.1], 0.1, 0.075, 'body', 'thigh', { k: 0.06, flow: [0, -1, 0.1] })),
      ell([0, 0.3, -0.3], [0.12, 0.08, 0.18], 'body', 'back', { k: 0.07, rot: [0.9, 0, 0] }),
      ...neck([[0, 0.9, 0.14], [0, 0.98, 0.24], [0, 1.04, 0.3]], [0.17, 0.15, 0.14]),
      ell([0, 0.9, 0.3], [0.13, 0.13, 0.11], 'body', 'hackle', { k: 0.07 }),
      ...head([0, 1.09, 0.36], 0.13, { eye: [0.48, 0.18, 0.42], socket: 0.2, bill: [0, -0.05, 0.95], billW: 0.36, billH: 0.42, browTilt: 0.55, brow: [0.5, 0.24, 0.5] }),
    ],
  };
}

/** The Great Owl (Patron, Dusk): upright and round, a deep facial disc and a V brow; feet at 0, head top about 1.28. */
function greatOwl(): Body {
  return {
    cell: 0.0045,
    tris: [9000, 3600, 1300, 500],
    ops: [
      ell([0, 0.55, 0], [0.36, 0.48, 0.32], 'body', 'back', { rot: [0.15, 0, 0] }),
      ell([0, 0.5, 0.12], [0.32, 0.38, 0.24], 'body', 'breast', { k: 0.12 }),
      ell([0, 0.28, 0.06], [0.27, 0.2, 0.24], 'body', 'breast', { k: 0.12 }),
      ...pair(ell([0.26, 0.78, -0.02], [0.14, 0.26, 0.22], 'body', 'back', { k: 0.08, rot: [0.2, 0.1, -0.15] })),
      ...pair(cone([0.12, 0.28, 0.08], [0.13, 0.08, 0.12], 0.11, 0.08, 'body', 'thigh', { k: 0.06, flow: [0, -1, 0.1] })),
      ell([0, 0.87, 0.04], [0.27, 0.14, 0.22], 'body', 'back', { k: 0.12 }),
      ell([0, 1.03, 0.06], [0.3, 0.255, 0.27], 'head', 'crown', { k: 0.1 }),
      ...pair(ell([0.12, 1.0, 0.33], [0.15, 0.17, 0.08], 'head', 'disc', { sub: true, k: 0.04 })),
      ...pair(ell([0.245, 0.98, 0.2], [0.075, 0.22, 0.12], 'head', 'ruff', { k: 0.05 })),
      ell([0, 0.98, 0.29], [0.035, 0.16, 0.06], 'head', 'ridge', { k: 0.04 }),
      ...pair(ell([0.1, 1.125, 0.27], [0.13, 0.045, 0.06], 'head', 'brow', { k: 0.035, rot: [0, 0, -0.4] })),
      ...pair(ell([0.11, 1.04, 0.31], [0.06, 0.06, 0.05], 'head', 'disc', { sub: true, k: 0.02 })),
      ell([0, 0.18, -0.25], [0.13, 0.06, 0.16], 'body', 'back', { k: 0.07, rot: [0.9, 0, 0] }),
    ],
  };
}

/** The Roc's body without its head and neck (those are `rocHead`): an eagle, feet at 0, shoulders about 0.95. */
function roc(): Body {
  return {
    cell: 0.0055,
    tris: [6000, 2400, 900, 350],
    ops: [
      ell([0, 0.66, -0.05], [0.32, 0.42, 0.32], 'body', 'back', { rot: [0.45, 0, 0] }),
      ell([0, 0.62, 0.12], [0.29, 0.33, 0.25], 'body', 'breast', { k: 0.12, rot: [0.4, 0, 0] }),
      ell([0, 0.42, 0.04], [0.23, 0.2, 0.21], 'body', 'breast', { k: 0.1 }),
      ell([0, 0.93, 0.0], [0.3, 0.16, 0.22], 'body', 'back', { k: 0.1, rot: [0.4, 0, 0] }),
      ...pair(ell([0.24, 0.82, -0.06], [0.12, 0.24, 0.2], 'body', 'back', { k: 0.07, rot: [0.5, 0.2, -0.2] })),
      ...pair(cone([0.13, 0.44, 0.06], [0.14, 0.14, 0.1], 0.13, 0.085, 'body', 'thigh', { k: 0.07, flow: [0, -1, 0.1] })),
      ell([0, 0.36, -0.3], [0.13, 0.09, 0.2], 'body', 'back', { k: 0.07, rot: [0.8, 0, 0] }),
      cone([0, 0.92, 0.12], [0, 1.0, 0.2], 0.19, 0.17, 'body', 'neck', { k: 0.06, flow: [0, -0.4, -1] }),
    ],
  };
}

/** The Roc's neck and head: from inside the shoulders (the pivot at 0) up to a hooked bill. */
function rocHead(): Body {
  return {
    cell: 0.0045,
    tris: [2200, 900, 320, 120],
    ops: [
      ...neck([[0, -0.04, -0.02], [0, 0.08, 0.06], [0, 0.17, 0.12]], [0.19, 0.16, 0.14], 'neck', 0.4),
      ...head([0, 0.24, 0.16], 0.13, { eye: [0.47, 0.16, 0.48], socket: 0.21, bill: [0, -0.1, 0.95], billW: 0.32, billH: 0.34, browTilt: 0.6, brow: [0.52, 0.24, 0.55] }),
    ],
  };
}

/** Every world body by name (the bake writes data/world/<name>.ts). */
export const WORLD_BODIES = {
  chick, beetle, weasel, rat, toad, badger: () => badger(false), cub: () => badger(true),
  hawk, heron, owlHead, raven, greatOwl, roc, rocHead,
} as const;
export type WorldBody = keyof typeof WORLD_BODIES;
