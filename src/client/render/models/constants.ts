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
  gunMetal: 0x5f6570,
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
  idleBob: 0.008,
  idleRate: 2.2,
  runLean: 0.1,
  sprintLean: 0.22,
  slidePitch: 1.25,
  slideDrop: 0.3,
  dashPitch: 0.95,
  mantlePitch: -0.35,
  climbPitch: -0.2,
  climbRate: 11,
  updraftPitch: -0.25,
  recoilRate: 12,
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
  stepMinRun: 0.05,
  flightPitch: 0.65,
  deadClearance: 0.1,
  castRate: 12,
  castTailWiden: 0.3,
  tailRun: 0.12,
  tailIdle: 0.03,
  tailIdleRate: 1.7,
  pitchLimit: 1.2,
  reloadHead: 0.25,
  recoilDecay: 20,
  headTilt: 0.08,
  headTiltRate: 0.9,
  stunRoll: 0.3,
} as const;

/**
 * The held gun (D-ART-003). The gun bone carries the muzzle; both wings are solved onto its grip sockets every frame.
 * Rotations in radians about the main grip in the gun's own frame (x pitches the muzzle down, y swings it to the
 * bird's left, z rolls it); translations as fractions of the hero's height in the body frame unless noted.
 */
export const HOLD = {
  /** Barrel turned in toward the centre line so the stock clears the flank. */
  toe: 0.06,
  /** A wing is at least this many times the aim-pose distance from its shoulder to its grip (never fully straight). */
  reach: 1.3,
  /** Share of the wing in the arm segment (the rest is the forearm and hand). */
  upperShare: 0.5,
  /** Which way each wing's wrist bends (body frame): the trigger wing out, down and back; the support wing out, down and forward. */
  poleMain: { x: -0.25, y: -1, z: -0.45 },
  poleSupport: { x: 0.6, y: -1, z: 0.6 },
  /** Shot: the gun kicks back along the barrel (m) and the muzzle climbs; the chest gives a little. */
  recoilKick: 0.04,
  /** The kick peaks this long after each shot (s) and settles over at most `kickSettle` s. */
  kickRise: 0.03,
  kickSettle: 0.18,
  recoilClimb: 0.12,
  recoilChest: -0.03,
  /**
   * Reload: the gun comes forward off the flank, rolls out, dips and turns in while the fore-end racks (rad/s).
   * Pulls (reload, parry) are shares of the body radius sideways and forward, of the height upward.
   */
  reloadCant: 0.75,
  reloadDip: 0.35,
  reloadYaw: 0.15,
  reloadPull: { x: 0.1, y: -0.03, z: 0.45 },
  pumpRate: 9,
  /** Casts that free the support wing: the gun drops to a one-winged low carry at the side. */
  lowerDip: 0.95,
  lowerDrop: 0.05,
  /** Melee: the barrel swipes across (light), is raised and brought down (heavy), held up as a club (charge) or across the chest (parry). */
  lightSwing: 0.9,
  lightWind: -0.45,
  /** The swipe carries the gun out in front of the chest (share of the body radius). */
  lightReach: 1.1,
  heavyRaise: -1.1,
  heavySmash: 0.55,
  heavyLift: 0.08,
  chargeRaise: -0.9,
  chargeLift: 0.07,
  parryYaw: 1.25,
  parryRaise: -0.2,
  parryPull: { x: 0.35, y: 0.03, z: 1.2 },
  /** A stunned bird lets the gun sag. */
  stunDip: 0.35,
} as const;

/** Legs: two segments and a foot, solved onto the ground when grounded (D-ART-003). */
export const LEG_IK = {
  /** Ankle height above the sole, in leg thicknesses. */
  ankle: 1.2,
  /** Each segment as a share of the hip-to-ankle height, so the knee stays bent at rest. */
  bend: 0.56,
  /** Planted hips never rise above this share of the legs' full reach above the ankles. */
  reach: 0.97,
  /** Feet tucked under the body in the air, forward on a slide, trailing when dead (shares of leg reach: down, forward). */
  tuck: { down: 0.5, fwd: -0.3 },
  slide: { down: 0.5, fwd: 0.65 },
  limp: { down: 0.85, fwd: -0.25 },
  climb: { down: 0.55, fwd: 0.35 },
  climbSwing: 0.25,
  /** Flamingo one-leg idle: the lifted foot folds up under the body. */
  fold: { down: 0.32, fwd: 0.12 },
  /** Toes point down this far in the air (rad). */
  curl: 0.7,
} as const;

/**
 * Gait: feet plant on the ground and move back under the bird at the ground speed, so they do not slide, up to a
 * stride the legs can reach (`stride` × hip-to-ankle height); above the step-rate cap, a fast bird's feet slip.
 */
export const GAIT = {
  /** Share of the step cycle a foot is on the ground. */
  duty: 0.5,
  stride: 1.1,
  /** Step-cycle rate limits (rad/s): one full cycle is a step with each foot. */
  rateMin: 5,
  rateMax: 30,
  minSpeed: 0.2,
  /** Swing-foot clearance and body bob on the run, as shares of hip-to-ankle height. */
  lift: 0.35,
  bob: 0.08,
  /** Hips drop on the run (stride reach) and on landing (share of hip height); landing recovers over `landTime` s. */
  runDrop: 0.08,
  landDrop: 0.2,
  landTime: 0.3,
  /** Air time (s) before a touchdown counts as a landing. */
  landAfter: 0.15,
} as const;

/**
 * Cast poses (BirdBuild.casts, per ability slot). Free-wing gestures put the support wing at `gesture` of its reach
 * in a body-frame direction from its shoulder; 'aim' and 'leap' keep both wings on the gun.
 */
export const CAST_POSE = {
  /** The pose when the slot is unknown (EntityView carries no cast slot yet). */
  fallback: 'raise',
  gesture: 0.88,
  raise: { x: 0.35, y: 0.9, z: 0.2 },
  throw: { x: 0.05, y: 0.2, z: 1 },
  sweep: { x: 1, y: 0.1, z: 0.3 },
  stomp: { x: 0.9, y: 0.35, z: 0.05 },
  wave: 0.35,
  waveRate: 6,
  /** Leap: deep crouch (share of hip height) and forward lean; aim: braced lean. */
  leapDrop: 0.3,
  leapLean: 0.35,
  aimLean: 0.08,
  /** Stomp: the right foot lifts (share of hip height) and stamps, cycling at this rate (rad/s). */
  stompLift: 0.55,
  stompRate: 7,
  throwLean: 0.15,
} as const;

/**
 * Melee poses (WeaponState.meleePose). Timed from the moment the pose appears: a short windup pull-back, the lunge,
 * then recovery. `dur` seconds, `pitch` body lean at the lunge peak (rad), `reach` hip travel (fraction of height),
 * `windup` the fraction of `dur` spent pulling back. What the gun does is in HOLD.
 */
export const MELEE = {
  light: { dur: 0.3, pitch: 0.55, reach: 0.14, windup: 0.22, back: 0.25 },
  heavy: { dur: 0.65, pitch: 0.95, reach: 0.3, windup: 0.4, back: 0.6 },
  /** Charging hold: lean back, gun raised (HOLD), head drawn back, a trembling roll (`shake` rad at `shakeRate`). */
  charge: { pitch: -0.45, head: -0.5, shake: 0.03, shakeRate: 38, drop: 0.06 },
  /** Parry: gun across the chest (HOLD), body braced. */
  parry: { pitch: -0.12, head: 0.35 },
  headThrust: 0.135,
  /** Lunge peak as a fraction of the lunge phase, and the windup pull-back fade. */
  peak: 0.3,
  backFade: 0.15,
  pullBack: 0.3,
  headPull: 0.5,
  /** Starling's halo spin (rad/s). */
  haloRate: 2.4,
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

/** Structure models (GDD §7.2 to §7.7, §14). Heights in metres; towers stay under the 12 m Updraft rider. */
export const STRUCTURE = {
  /** Hawk, Heron, Warden and Shrine models never rise above this (the Updraft line is 12 m up). */
  towerMaxHeight: 10,
  hawkColumn: 8,
  wardenHeight: 7,
  shrineHeight: 7,
  heronFrame: 7.6,
  /** Patron statue: head top height, chest (heart-feather) height. */
  patronHeight: 11.5,
  patronHeartUp: 6,
  patronHeartForward: 2.7,
  stone: 0xb9a98a,
  stoneDark: 0x8d806a,
  timber: 0x7a5236,
  timberDark: 0x5a3a24,
  ravenBlack: 0x1c1c26,
  ravenSheen: 0x3a3a52,
  owlGrey: 0x7a6e86,
  owlCream: 0xe8dcc4,
  hawkBrown: 0x6a4a34,
  hawkCream: 0xe6d5b0,
  heronGrey: 0x8da0b3,
  heronBill: 0xd9a63a,
  glowOff: 0x2a2a30,
  ragedGlow: 0xff5a2a,
  heartColour: 0xffe27a,
  domeColour: 0xf3ead4,
  domeOpacity: 0.3,
  /** Dome grows and vanishes over this long when the ward breaks (s). */
  crackTime: 0.6,
  crackGrow: 0.3,
  domeCapacity: 96,
  phase2Scale: 1.05,
  shakeAmp: 0.18,
  shakeRate: 55,
  stompRate: 3.2,
  /** Raised-leg angle (rad), and how long each leg rests flat between lifts (|sin| below this). */
  stompLift: 0.9,
  stepDeadZone: 0.25,
  stepRate: 1.1,
  pulseRate: 3,
  breathe: 0.012,
  domeSegments: 18,
  domeSquash: 1.05,
  shakeRatio: 0.83,
  flashMin: 0.75,
  flashRatio: 0.5,
  heartSpin: 1.3,
} as const;

/** Sculpted faces and feeds (style guide §8.3, §8.5): blink timing (s), jaw opening per action, spinner blend (1/s). */
export const FACE = {
  blinkMin: 3,
  blinkMax: 6,
  blinkTime: 0.12,
  /** Spreads each bird's blink period by its entity id. */
  blinkSeed: 0.618,
  /** A stunned bird's lids droop this far. */
  stunLid: 0.45,
  shotJaw: 0.5,
  castJaw: 0.8,
  spinBlend: 4,
} as const;

/** Debug hitbox overlay (QA). */
export const HITBOX_DEBUG = { head: 0xff3030, body: 0x30ff60, segments: 12, capCaps: 4 } as const;
