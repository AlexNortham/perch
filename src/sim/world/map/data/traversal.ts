/**
 * Movement reach the map is built for (GDD §3), plus the nav-graph build settings. The Character Controller owns the
 * live values in src/sim/data/movement.ts; these copies only shape and check geometry.
 * TODO(after W2 merge): read the GDD §3 values from src/sim/data/movement.ts instead of repeating them here.
 */
export const REACH = {
  /** §3.2: kerbs and stairs below this need no jump. */
  step: 0.45,
  /** §3.2: steepest walkable slope (degrees). */
  maxSlopeDeg: 45,
  /** §3.6: a mantle needs the ledge top this far above the feet. */
  mantleMin: 0.6,
  mantleMax: 2.4,
  /** §3.3 apex 1.6 m + §3.6 mantle 2.4 m, less a margin: the highest ledge a jump-then-mantle reaches. */
  jumpMantle: 3.6,
  /** A running jump (7 m/s, 0.72 s airborne) clears this gap with margin. */
  jumpGap: 3.5,
  /** §3.4 dash-jump leaps ~8–9 m; keep a margin. */
  dashJumpGap: 7,
  /** Standing hero capsule used for clearance checks. */
  heroHeight: 1.8,
  heroRadius: 0.45,
} as const;

/** Rise per metre of the steepest walkable slope. */
export const MAX_SLOPE_RISE = Math.tan((REACH.maxSlopeDeg * Math.PI) / 180);

/** GDD §3.7: Updrafts run this far above the lane path. */
export const UPDRAFT_HEIGHT = 12;
/** Stations at a Hawk or Heron sit this far from it along the lane, on the owning flock's side. */
export const STATION_SETBACK = 6;
/** Chimney shaft radius (GDD §3.8) and the gap between shaft and wall. */
export const CHIMNEY_RADIUS = 1.5;
export const CHIMNEY_GAP = 0.1;
/** A chimney's top sits this far above the roof it serves, so the exit pop carries the rider over the edge. */
export const CHIMNEY_OVERSHOOT = 1;
/** A vine rider's centre sits this far out from the wall. */
export const VINE_OFFSET = 0.5;
/** Where a climb drops its rider onto the roof, measured in from the wall line. */
export const CLIMB_LANDING = 1.5;

export const NAV = {
  /** Candidate nodes closer than this merge. */
  mergeDist: 2.5,
  /** Auto links are tried between nodes at most this far apart horizontally. */
  linkRadius: 14,
  /** Sample spacing along a candidate link: every solid prim must be at least this thick (the tests check). */
  sampleStep: 0.5,
  /** Lane paths get a node every this many metres. */
  laneSpacing: 10,
  /** Building corners get a ground node this far out along each diagonal. */
  cornerOffset: 2,
  /** Thinner boxes are walls: they get a node this far past each end instead of corner nodes. */
  wallMaxThickness: 2,
  wallEndOffset: 1.5,
  /** A link is skipped when some node lies on a route at most this much longer (the two shorter links cover it). */
  detour: 1.2,
  /** Boxes at least this tall and this wide on top count as buildings (corner and roof nodes). */
  buildingMinHeight: 2.5,
  roofMinSide: 3,
  /** Cylinders at least this wide on top get a node. */
  cylinderMinRadius: 2,
  /** A node needs this much clear radius around it. */
  nodeClearance: 0.5,
  /** Ramps get a node this far beyond each end. */
  rampEndOffset: 1,
} as const;
