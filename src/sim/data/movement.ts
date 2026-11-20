/**
 * Movement tuning (GDD §3, §5.9 displacement). Owner: Character Controller (Balance & Data from W7).
 * Units: metres, seconds, m/s, m/s², radians (names ending Deg are degrees). Per-hero speeds and stamina are stats
 * (moveSpeed, sprintSpeed, stamina, staminaRecharge) in each hero's data; everything shared lives here.
 */

export const DEGREES_PER_HALF_TURN = 180;
const DEG = Math.PI / DEGREES_PER_HALF_TURN;

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
  sprintDelayS: 5,
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
  jumpCost: 1,
  wall: { graceS: 0.1, maxNormalY: 0.25, push: 6, launch: 7, minimumLaunch: 3.5, fatigueS: 1.25, repeatCost: 0.5 },
  /** Air control toward the input; never adds horizontal speed above run speed. */
  accel: 15,
  /** A 'land' movement event needs at least this much airtime (no event for kerbs). */
  landEventMinAirS: 0.1,
  /** GDD §9 Toboggan: Jump ends the toboggan mode with a hop this high, keeping its horizontal speed. */
  tobogganHopApex: 1.2,
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
  jumpWindowOpenS: 0.1,
  jumpWindowCloseS: 0.3,
  jumpCost: 1,
  down: { tapWindowS: 0.25, speed: 18, cost: 0.5 },
  jumpHorizontal: 13,
  jumpVertical: 7,
  /**
   * Ability dashes along the aim (DashEffect dir 'aim' without arcHeight) follow the aim pitch up to this far upward,
   * any angle down, unless the effect specifies its own cap.
   */
  aimMaxPitchUp: 30 * DEG,
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
  reach: 0.8,
  exitSpeedFraction: 0.5,
  /** The ledge-top probe lands this far past the wall face. */
  probeIn: 0.1,
  /** Rise during the first part of the mantle, move onto the ledge during the last part. */
  riseEnd: 0.6,
  moveStart: 0.4,
  /** A wall triggers a mantle only if the hero pushes into it: −dot(wall normal, move direction) ≥ this. */
  facing: 0.5,
} as const;

/** GDD §3.7 (D-EP-039): no key; a held Jump latches anywhere along the cable. */
export const UPDRAFT = {
  /** Latch reach: feet within this horizontal distance of the cable's line on the ground … */
  reach: 2.5,
  /** … with the cable between these heights above the feet. */
  reachAboveMin: 0.5,
  reachAboveMax: 14,
  /** Airborne within this distance of the cable (3D), the hold attaches in attachS instead of pulling up. */
  airReach: 1.5,
  /** Jump held this long within reach latches; a tap never does. */
  latchHoldS: 0.2,
  /** From the ground (or airborne beyond airReach) the hold pulls the hero up to the cable at this speed. */
  pullSpeed: 30,
  attachS: 0.15,
  /** No latch for this long after taking damage from an enemy hero, or after leaving an Updraft. */
  damageLockoutS: 3,
  leaveLockoutS: 1,
  rideSpeed: 11,
  boostSpeed: 18,
  boostS: 3,
  boostCooldownS: 12,
  /** No boost for this long after taking hero damage. */
  boostDamageLockS: 3,
  /** A fresh Jump press jumps off with +dismountUp m/s and dismountKeep of the ride velocity; Crouch drops off. */
  dismountUp: 4,
  dismountKeep: 0.7,
  /** @deprecated Stage 3 station mount; tools/wiki still prints it. Stations are only signposts now (§3.7). */
  stationRadius: 2,
  /** @deprecated Stage 3 air mount; tools/wiki still prints it. Use airReach. */
  airMountRadius: 1.5,
} as const;

/** GDD §7.15 Bough Springs: a pad launches along its authored arc (MapData.springs). */
export const SPRING = {
  /** At most one launch per hero per this long. */
  cooldownS: 1,
  /** Feet within this height of the pad count as standing on it (its radius is map data). */
  padHeight: 0.6,
  /** Air control after the apex, as a fraction of AIR.accel (none before it). */
  airControl: 0.3,
  /** Enemy hero damage this soon after the launch clips it: vertical speed 0 and a slow. */
  clipS: 0.6,
  clipSlow: 0.3,
  clipSlowS: 1.5,
} as const;

/** GDD §7.15 the Cellar Run: run speed inside a 'tunnel' room (the sprint bonus, dashes and slides unchanged). */
export const TUNNEL = { runSpeedMult: 1.3 } as const;

/**
 * Collider layers physics adds to the contract's Layer bits (D-SYS-010). A query mask that includes a bit hits those
 * colliders; LAYERS_SOLID alone (bullets, sight, areas) hits neither the movement nor the sight prims.
 * - sight: PrimBase.blocks 'sight' (ivy curtains); vision and `unit` targeting add it to their mask.
 * - movement: PrimBase.blocks 'movement' (shot-window fillers); heroes and units collide with them.
 * - eggCarrier: Opening.blocksEggCarrier gaps; only an Egg carrier's moves collide with them.
 */
export const PHYSICS_LAYERS = { sight: 0x10, movement: 0x20, eggCarrier: 0x40 } as const;
/** Opening.blocksEggCarrier: the blocker is a slab this thick (m) across the gap. */
export const EGG_BLOCKER_DEPTH = 0.2;

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
  /** GDD §3.9: wall slam effects (DisplaceEffect.onWall) need at least this displacement speed toward the wall. */
  wallSlamSpeed: 4,
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
