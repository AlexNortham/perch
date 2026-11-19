/** Presentation constants for the procedural models and rigs (D-EP-009). Owner: Technical Artist. */

/** Sim crouch scale on heights (src/sim/data/core.ts CROUCH_SCALE); the rig squashes by the same factor. */
export const CROUCH_SQUASH = 0.65;

/** Generic bird colouring: hue spread across the hero ids, fixed saturation and lightness. */
export const GENERIC = { saturation: 0.45, lightness: 0.45, bill: 0xe0a030, leg: 0x5a4a3a } as const;

/** Natural colours of the four hand-built heroes (GDD §9.1 to §9.4). */
export const PLUMAGE = {
  black: 0x1b1b20,
  white: 0xf2efe6,
  grey: 0x8a8d94,
  eye: 0x0b0b0b,
  eyeGlint: 0xffffff,
  leg: 0x5a4a3a,
  gunMetal: 0x3d4148,
  gunWood: 0x7a5236,
  thorn: 0xc9b98a,
  shrikeBill: 0x2a2a2e,
  albatrossBill: 0xe8b5b0,
  albatrossBillTip: 0xc2706c,
  albatrossWing: 0x5a4a40,
  kingfisherBack: 0x1f8fff,
  kingfisherBelly: 0xf08a24,
  kingfisherBill: 0x1a1a1a,
  lyreBrown: 0x6f4f36,
  lyreSilver: 0xd5dae0,
  lyreBill: 0x4a3a30,
} as const;

/** Natural colours of the eight B1/A2 birds (GDD §9.5 to §9.12). */
export const PLUMAGE_NEW = {
  owlTawny: 0xb98a55,
  owlCream: 0xeadcb8,
  owlEye: 0xf08a1a,
  pelicanWhite: 0xf4f1ea,
  pelicanEdge: 0x8d9097,
  pelicanPouch: 0xf2a23a,
  pelicanBill: 0xe8b46a,
  secGrey: 0xc4c7cc,
  secBlack: 0x1a1a1e,
  secFace: 0xf2762a,
  starBlack: 0x25232e,
  starGreen: 0x2f8a6a,
  starPurple: 0x6a3f9a,
  starSpeck: 0xf0eee6,
  hornBlack: 0x1d1d21,
  hornWhite: 0xf0eee4,
  hornBill: 0xf2c030,
  hornCasque: 0xe2492a,
  flamingoPink: 0xf58aa8,
  flamingoCoral: 0xe0506a,
  flamingoBill: 0xf0a0b0,
  flamingoTip: 0x1a1a1a,
  penguinBlack: 0x1c1d24,
  penguinWhite: 0xf3f1ea,
  penguinGold: 0xf5b81f,
  puffinBlack: 0x20222a,
  puffinWhite: 0xf0eee8,
  puffinOrange: 0xf26a1c,
  puffinYellow: 0xf5c020,
  puffinBlue: 0x7f93a8,
  puffinFish: 0xc9d3dc,
} as const;

/** Rig tuning. Angles in radians, rates in 1/s, lengths as fractions of the hero's height unless noted. */
export const RIG = {
  /** dt is clamped so a stalled tab does not snap poses. */
  maxDt: 0.1,
  /** Exponential smoothing rate toward target poses. */
  blend: 14,
  runSpeedRef: 6,
  sprintSpeed: 8.5,
  stepBase: 5,
  stepPerSpeed: 1.2,
  legSwing: 0.95,
  bobHeight: 0.035,
  idleBob: 0.008,
  idleRate: 2.2,
  runLean: 0.1,
  sprintLean: 0.22,
  wingTuck: 0.04,
  wingRun: 0.18,
  wingAir: 1.0,
  wingDash: 1.35,
  wingGlide: 1.45,
  wingCast: 1.25,
  wingDead: 0.9,
  wingUpdraft: 1.3,
  wingClimb: 0.7,
  flapUpdraft: 0.4,
  flapFall: 0.3,
  flapRate: 20,
  flapAmp: 0.28,
  slidePitch: 1.25,
  slideDrop: 0.3,
  dashPitch: 0.95,
  mantlePitch: -0.35,
  climbPitch: -0.2,
  climbRate: 11,
  updraftPitch: -0.25,
  recoilRate: 12,
  recoilKick: 0.1,
  recoilPitch: 0.16,
  reloadDip: 0.8,
  castHeadUp: -0.35,
  castPulse: 0.05,
  stunRate: 9,
  stunSwing: 0.5,
  flinchTime: 0.18,
  flinchPitch: -0.3,
  deathTime: 0.35,
  deathRoll: 1.5,
  headLook: 0.6,
  runMax: 1.2,
  climbRun: 0.9,
  stepMinRun: 0.05,
  airTuck: 0.6,
  slideTuck: 0.8,
  flightPitch: 0.65,
  deadClearance: 0.1,
  castRate: 12,
  castTailWiden: 0.3,
  tailRun: 0.12,
  tailIdle: 0.03,
  tailIdleRate: 1.7,
  pitchLimit: 1.2,
  reloadHead: 0.25,
  reloadDrop: 0.12,
  reloadWobble: 0.1,
  reloadWobbleRate: 14,
  recoilDecay: 20,
  headTilt: 0.08,
  headTiltRate: 0.9,
  stunRoll: 0.3,
} as const;

/**
 * Melee poses (WeaponState.meleePose). Timed from the moment the pose appears: a short windup pull-back, the lunge,
 * then recovery. `dur` seconds, `pitch` body lean at the lunge peak (rad), `reach` hip travel (fraction of height),
 * `wing` flare at the peak, `windup` the fraction of `dur` spent pulling back.
 */
export const MELEE = {
  light: { dur: 0.3, pitch: 0.55, reach: 0.14, wing: 1.1, windup: 0.22, back: 0.25 },
  heavy: { dur: 0.65, pitch: 0.95, reach: 0.3, wing: 1.5, windup: 0.4, back: 0.6 },
  /** Charging hold: lean back, wings raised, head drawn back. */
  charge: { pitch: -0.45, wing: 1.45, head: -0.5, shake: 0.03, shakeRate: 38, drop: 0.06 },
  /** Parry: wings thrown forward across the chest, body braced. */
  parry: { wingFlare: 0.5, wingSwing: -1.35, pitch: -0.12, head: 0.35, hold: 0.9 },
  /** Release back to neutral, 1/s. */
  release: 10,
  headThrust: 0.45,
  /** Pouch and halo and one-leg idle. */
  haloRate: 2.4,
  idleLegAngle: 1.3,
  idleLegFold: 0.45,
} as const;

/** Fledglings (GDD §7.1). Geometry is built at the nominal radius; poses scale it to entity.radius. */
export const FLEDGLING = {
  nominalRadius: 0.45,
  slingerScale: 0.89,
  /** Instances per (type, team) mesh. Comfortably above the ~150 a match holds. */
  capacity: 256,
  bobRate: 18,
  bobHeight: 0.07,
  waddle: 0.16,
  lungePitch: 0.55,
  lungeRate: 6,
  idleRate: 3,
  deathScale: 0.5,
  minScale: 0.7,
  maxScale: 1.4,
  idleSquash: 0.03,
  deadRoll: 1.4,
  deadSink: 0.1,
  phasePerId: 1.7,
  moveSpeed: 0.5,
  body: 0xf2d98a,
  bill: 0xe8872a,
  foot: 0xd9722a,
  wing: 0xd9b866,
  sling: 0x7a5236,
} as const;

/** Debug hitbox overlay (QA). */
export const HITBOX_DEBUG = { head: 0xff3030, body: 0x30ff60, segments: 12, capCaps: 4 } as const;
