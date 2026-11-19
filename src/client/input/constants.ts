/** Input presentation constants (D-EP-009). */

export const RADIANS_PER_DEGREE = Math.PI / 180;
/** GDD §4.7: sensitivity 1.0 = this many degrees per mouse count. */
export const DEGREES_PER_COUNT = 0.06;
/** Mouse sensitivity scales with the aim zoom (GDD §4.3: FOV x0.8). Per-hero zoom (Owl x0.5) isn't in the view. */
export const AIM_ZOOM_SCALE = 0.8;
/** A middle-mouse press shorter than this (ms) is a tap ping; longer is the ping wheel (UI's). */
export const PING_TAP_MS = 250;
/** Chrome delivers pointerlockchange and the Esc keydown within this many ms of each other; count them once. */
export const ESC_DEDUPE_MS = 100;
