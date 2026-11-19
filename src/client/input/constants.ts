/** Input presentation constants (D-EP-009). */

export const RADIANS_PER_DEGREE = Math.PI / 180;
/** GDD §4.7: sensitivity 1.0 = this many degrees per mouse count. */
export const DEGREES_PER_COUNT = 0.06;
/** A ping press shorter than this (ms) is a tap. Holding opens the wheel. */
export const PING_TAP_MS = 250;
/** Chrome delivers pointerlockchange and the Esc keydown within this many ms of each other; count them once. */
export const ESC_DEDUPE_MS = 100;
