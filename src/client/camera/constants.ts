/** Camera presentation constants (D-EP-009). The rig's geometry itself (boom, shoulder, pivot) lives in sim CAMERA. */

/** How far past the camera the look target sits (only the direction matters). */
export const LOOK_AHEAD = 10;
/** Overview: height and pull-back as fractions of the map's depth. */
export const OVERVIEW_HEIGHT = 0.45;
export const OVERVIEW_BACK = 0.75;
/** Top-down: height as a fraction of the map's depth; tiny z offset keeps lookAt's up vector valid. */
export const TOP_HEIGHT = 1.1;
export const TOP_NUDGE = 0.01;

/** GDD §4.4 collision pull-in. */
export const PULL_RADIUS = 0.25;
export const PULL_MARGIN = 0.1;
export const PULL_MIN_BOOM = 0.6;
/** Speed (m/s) the camera eases back out once the obstruction clears. */
export const PULL_RECOVER = 6;
/** Distance between sphere-cast samples; under the sphere radius so no wall is skipped. */
export const PULL_STEP = 0.1;

/** GDD §4.2: shoulder swap blend time; §4.1: crouch pivot ease time. */
export const SHOULDER_BLEND_S = 0.15;
export const CROUCH_EASE_S = 0.12;

/** GDD §4.3 dash kick: degrees, time up, time back. */
export const DASH_KICK_DEG = 6;
export const DASH_KICK_UP_S = 0.08;
export const DASH_KICK_DOWN_S = 0.25;

/** Death camera: seconds to rise to the overhead view, final distance and pitch, orbit speed (rad/s). */
export const DEATH_RISE_S = 1.5;
export const DEATH_DISTANCE = 7;
export const DEATH_PITCH = -0.6;
export const DEATH_ORBIT = 0.25;
/** Seconds to blend between the player and death cameras. */
export const CUT_BLEND_S = 0.5;

/** A longer frame than this is treated as this long, so a stall doesn't teleport eased values. */
export const MAX_DT = 0.1;
