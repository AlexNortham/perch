/** Input presentation constants (D-EP-009). */

const DEGREES_PER_HALF_TURN = 180;
export const RADIANS_PER_DEGREE = Math.PI / DEGREES_PER_HALF_TURN;
/** GDD §4.7: sensitivity 1.0 = this many degrees per mouse count. */
export const DEGREES_PER_COUNT = 0.06;
/** A ping press shorter than this (ms) is a tap. Holding opens the wheel. */
export const PING_TAP_MS = 250;
/** Chrome delivers pointerlockchange and the Esc keydown within this many ms of each other; count them once. */
export const ESC_DEDUPE_MS = 100;
/** D-EP-030: crouch default where fullscreen keyboard lock stops W + Ctrl closing the tab. */
export const LOCKED_CROUCH = 'ControlLeft';
/** D-ARCH-019: the browser-safe crouch key, which still crouches while crouch sits on a Ctrl key and C is free. */
export const SAFE_CROUCH = 'KeyC';
