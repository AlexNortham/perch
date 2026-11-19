/**
 * Movement tuning (GDD §3, §5.9 displacement). Owner: Character Controller (Balance & Data from W7).
 * Units: metres, seconds, m/s, m/s², radians (names ending Deg are degrees). Per-hero speeds and stamina are stats
 * (moveSpeed, sprintSpeed, stamina, staminaRecharge) in each hero's data; everything shared lives here.
 */

const DEG = Math.PI / 180;

/** GDD §3.2. */
export const GROUND = {
  accel: 50,
  /** Deceleration with no input. */
  decel: 40,
  /** Step-up height: stairs and kerbs need no jump. */
  stepUp: 0.45,
  maxSlope: 45 * DEG,
  crouchSpeed: 3.5,
  /** Sprint ramps in over this long once out of combat (the bonus itself is the sprintSpeed stat). */
  sprintRampS: 0.5,
  /** GDD §5.9: slows never take ground speed below this. */
  minSlowedSpeed: 1.5,
  /** The controller keeps a grounded hero on the ground down steps and slopes up to this drop per tick. */
  snapDown: 0.3,
} as const;

/** GDD §3.3. */
export const AIR = {
  gravity: 25,
  maxFallSpeed: 30,
  jumpApex: 1.6,
  coyoteS: 0.1,
  jumpBufferS: 0.1,
  /** Air control toward the input; never adds horizontal speed above run speed. */
  accel: 15,
  /** A 'land' movement event needs at least this much airtime (no event for kerbs). */
  landEventMinAirS: 0.1,
} as const;

/** GDD §3.4. */
export const DASH = {
  groundDistance: 5.5,
  airDistance: 4.5,
  durationS: 0.2,
  /** Exit speed = run speed + this. */
  exitBonus: 1,
  lockoutS: 0.4,
  cost: 1,
  /** Dash-jump: jump during a ground dash or within this long after it. */
  jumpWindowS: 0.15,
  jumpHorizontal: 13,
  jumpVertical: 7,
} as const;

/** GDD §3.5. */
export const SLIDE = {
  minSpeed: 5,
  boost: 2,
  maxStartSpeed: 10,
  /** Flat-ground friction takes the slide down to crouch-walk speed in this long. */
  decayS: 1,
  /** Downhill slopes steeper than this add gravity along the slope. */
  minSlope: 8 * DEG,
  maxSlopeSpeed: 16,
  steerPerS: 45 * DEG,
  boostCooldownS: 1,
} as const;

/** GDD §3.6. Heights are above the ground the hero last stood on (or its feet, if lower). */
export const MANTLE = {
  minHeight: 0.6,
  maxHeight: 2.4,
  durationS: 0.35,
  exitSpeedFraction: 0.5,
  /** The ledge-top probe lands this far past the wall face. */
  probeIn: 0.1,
  /** Rise during the first part of the mantle, move onto the ledge during the last part. */
  riseEnd: 0.6,
  moveStart: 0.4,
  /** A wall triggers a mantle only if the hero pushes into it: −dot(wall normal, move direction) ≥ this. */
  facing: 0.5,
} as const;

/** GDD §3.7. */
export const UPDRAFT = {
  /** E mounts within this horizontal distance of a station … */
  stationRadius: 2,
  /** … from up to this far below it (stations are 12 m above the lane) or this far above it. */
  stationBelow: 14,
  stationAbove: 2,
  /** Jumping into the line while airborne mounts within this distance of it. */
  airMountRadius: 1.5,
  mountS: 0.3,
  rideSpeed: 11,
  boostSpeed: 18,
  boostS: 3,
  boostCooldownS: 12,
  /** No boost for this long after taking hero damage. */
  boostDamageLockS: 3,
  dismountUp: 4,
  dismountKeep: 0.7,
  /** No air mount for this long after leaving a line (so a jump-off doesn't remount). */
  remountDelayS: 0.5,
} as const;

/** GDD §3.8. */
export const CHIMNEY = {
  radius: 1.5,
  liftSpeed: 9,
  exitUp: 6,
  /** The shaft base: entered between this far below the bottom point and baseHeight above it. */
  baseBelow: 0.5,
  baseHeight: 2,
} as const;

/** GDD §3.8. */
export const VINE = {
  climbSpeed: 4.5,
  shimmySpeed: 2,
  jumpOffSpeed: 5,
  /** Grab distance from the wall to the capsule's front. */
  reach: 0.4,
  /** How far either side of the vine line a hero can grab and shimmy. */
  halfWidth: 1,
  /** Grabbable from this far below the vine's bottom point. */
  grabBelow: 0.5,
  /** −dot(move direction, out) needed to grab (moving into the wall). */
  facing: 0.5,
} as const;

/** GDD §3.9, §5.9. */
export const DISPLACE = {
  /** Push, pull and along launch at this angle (radians) so the arc lands `distance` away on flat ground. */
  launch: 20 * DEG,
  /** Air control while displaced, as a fraction of AIR.accel. */
  airControl: 0.2,
  knockUpMaxS: 1.5,
  /** Default for teleport 'behindTarget' without `behind`. */
  behindDefault: 1.5,
  /** Teleports look for ground from this far above the destination. */
  groundProbe: 2,
} as const;

/** Rapier character controller and query settings. */
export const CONTROLLER = {
  /** Gap the controller keeps from obstacles. */
  skin: 0.02,
  /** A step must be at least this deep to auto-step onto. */
  stepMinWidth: 0.2,
  /** Cell size of the cached ground heights units move on (moveCharacter without a controller). */
  unitGroundCell: 0.25,
  /**
   * A hero standing still on the ground ignores controller moves smaller than this (sum of |x|, |y|, |z|): Rapier's
   * contact tolerance moves the feet ~1e-4 m a tick, while one tick of free fall from rest is 3.5e-3 m.
   */
  restBand: 1e-3,
} as const;
