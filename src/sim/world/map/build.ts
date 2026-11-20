/**
 * MapSpec → MapData: mirrors the Dawn half for Dusk (z → −z, yaw → π − yaw), builds climbs and Updrafts, derives
 * mantle ledges from the prims and auto-links a nav graph whose link kinds come from the ground profile between
 * nodes. Pure; run once per map.
 */
import type {
  Anchor, BlockoutPrim, BotSpot, Climb, Lane, Ledge, MapData, NavGraph, NavLink, NavLinkKind, Room, ShopAnchor,
  StructureAnchor, Team, TeamAnchor, Updraft, Vec3,
} from '../../core/contracts';
import type { MapDressing } from './dressing';
import type { ClimbSpec, LinkSpec, MapSpec, SpecPart } from './data/kit';
import { joinParts, mirrorPart } from './data/kit';
import {
  CHIMNEY_GAP, CHIMNEY_OVERSHOOT, CHIMNEY_RADIUS, CLIMB_LANDING, MAX_SLOPE_RISE, NAV, REACH, ROOM_FLOOR_EPS,
  STATION_SETBACK, UPDRAFT_HEIGHT, VINE_OFFSET,
} from './data/traversal';
import { blocksMovement, corners, indexPrims, primBottom, primTop, standAt, surfacesAt, type PrimIndex } from './geometry';
import * as dmath from '../../core/dmath';

const TAU = Math.PI * 2;
/** A surface counts as the same height within this. */
const LEVEL_EPS = 0.01;
/** Ledge checks probe this far in front of and behind the edge. */
const LEDGE_PROBE = 0.6;
/** Ledge checks stay this far from the edge's ends; shorter edges are skipped. */
const LEDGE_INSET = 0.5;
const LEDGE_MIN_LENGTH = 1;
/** Explicit links (climbs, Updraft stations) attach to the nearest node within this distance. */
const ATTACH_DIST = 2.5;

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/** Angle in (−π, π]. */
export function wrapAngle(a: number): number {
  const r = ((a % TAU) + TAU) % TAU;
  return r > Math.PI ? r - TAU : r;
}

/** The Dusk image of a Dawn point. */
export const mirrorV = (p: Vec3): Vec3 => v(p.x, p.y, -p.z);
export const mirrorYaw = (yaw: number): number => wrapAngle(Math.PI - yaw);

/** Boxes look the same turned half a turn; keep their yaw in (−π/2, π/2] so axis-aligned boxes stay at 0. */
function boxYaw(yaw: number): number {
  const a = wrapAngle(yaw);
  return a > Math.PI / 2 ? a - Math.PI : a <= -Math.PI / 2 ? a + Math.PI : a;
}

export function mirrorPrim(p: BlockoutPrim): BlockoutPrim {
  const centre = mirrorV(p.centre);
  if (p.shape === 'cylinder') return { ...p, centre };
  const yaw = mirrorYaw(p.yaw);
  return { ...p, centre, yaw: p.shape === 'box' ? boxYaw(yaw) : yaw };
}

const mirrorAnchor = <T extends Anchor>(a: T): T => ({ ...a, pos: mirrorV(a.pos), yaw: mirrorYaw(a.yaw) });
const mirrorClimb = (c: ClimbSpec): ClimbSpec => ({ ...c, z: -c.z || 0, inZ: -c.inZ || 0 });
const DAWN_SUFFIX = '-dawn';
/** Dusk's name for a Dawn record: '<name>-dawn' becomes '<name>-dusk'. */
const duskName = (id: string): string => `${id.endsWith(DAWN_SUFFIX) ? id.slice(0, -DAWN_SUFFIX.length) : id}-dusk`;
const swapTeam = (t: Team): Team => (t === 'dawn' ? 'dusk' : t === 'dusk' ? 'dawn' : t);

/** The Dusk half: the Dawn half mirrored z → −z, with every record and name. */
export const mirrorHalf = (p: SpecPart): SpecPart =>
  mirrorPart(p, {
    v: mirrorV, yaw: mirrorYaw, boxYaw: (y) => boxYaw(mirrorYaw(y)), prim: mirrorPrim, climb: mirrorClimb, name: duskName, team: swapTeam,
  });

/** The nav link a climb gives bots: ladders climb like Vines (GDD §6.7). */
const climbLink = (c: ClimbSpec): NavLinkKind => (c.kind === 'ladder' ? 'vine' : c.kind);

function buildClimb(c: ClimbSpec): Climb {
  const chimney = c.kind === 'chimney';
  const off = chimney ? CHIMNEY_RADIUS + CHIMNEY_GAP : VINE_OFFSET;
  const x = c.x - c.inX * off;
  const z = c.z - c.inZ * off;
  return {
    kind: c.kind,
    bottom: v(x, c.floor, z),
    top: v(x, c.roof + (chimney ? CHIMNEY_OVERSHOOT : 0), z),
    out: chimney ? v(0, 0, 0) : v(-c.inX, 0, -c.inZ),
  };
}

/** Where a climb leaves its rider: on the roof, in from the wall. */
const climbLanding = (c: ClimbSpec): Vec3 => v(c.x + c.inX * CLIMB_LANDING, c.roof, c.z + c.inZ * CLIMB_LANDING);

// --- Polylines -------------------------------------------------------------------------------------------------

const flat = (a: Vec3, b: Vec3): number => dmath.hypot(b.x - a.x, b.z - a.z);

/** Arc length along `path` of the point nearest to p (in XZ). */
export function projectOnPath(path: readonly Vec3[], p: Vec3): number {
  let best = Infinity;
  let bestS = 0;
  let s = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (!a || !b) continue;
    const len = flat(a, b);
    const t = len > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / (len * len))) : 0;
    const d = dmath.hypot(a.x + (b.x - a.x) * t - p.x, a.z + (b.z - a.z) * t - p.z);
    if (d < best) {
      best = d;
      bestS = s + t * len;
    }
    s += len;
  }
  return bestS;
}

/** The point at arc length s along `path` (clamped to its ends). */
export function pointOnPath(path: readonly Vec3[], s: number): Vec3 {
  let left = s;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (!a || !b) continue;
    const len = flat(a, b);
    if (left <= len || i === path.length - 1) {
      const t = len > 0 ? Math.min(1, Math.max(0, left / len)) : 0;
      return v(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
    }
    left -= len;
  }
  const only = path[0];
  return only ? { ...only } : v(0, 0, 0);
}

export function pathLength(path: readonly Vec3[]): number {
  let s = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (a && b) s += flat(a, b);
  }
  return s;
}

const raise = (p: Vec3, dy: number): Vec3 => v(p.x, p.y + dy, p.z);

/** Updraft over a lane: its path raised, stations at both gates, each Heron and Hawk (set back toward their own
 * gate) and the middle. */
function buildUpdraft(lane: Lane, dawnHalf: readonly Vec3[], towers: readonly StructureAnchor[]): Updraft {
  const half = towers
    .filter((s) => s.lane === lane.id && (s.type === 'heron' || s.type === 'hawk'))
    .map((s) => projectOnPath(dawnHalf, s.pos) - STATION_SETBACK)
    .sort((a, b) => a - b)
    .map((s) => pointOnPath(dawnHalf, s));
  const first = dawnHalf[0];
  const last = dawnHalf[dawnHalf.length - 1];
  const dawnStations = [...(first ? [first] : []), ...half];
  const stations = [...dawnStations, ...(last ? [last] : []), ...dawnStations.map(mirrorV).reverse()];
  return {
    lane: lane.id,
    points: lane.path.map((p) => raise(p, UPDRAFT_HEIGHT)),
    stations: stations.map((p) => raise(p, UPDRAFT_HEIGHT)),
  };
}

// --- Ledges ----------------------------------------------------------------------------------------------------

function ledgePointOk(index: PrimIndex, q: Vec3, out: Vec3, top: number): boolean {
  const back = standAt(index, q.x + out.x * LEDGE_PROBE, q.z + out.z * LEDGE_PROBE, top + LEVEL_EPS);
  if (back === null || Math.abs(back - top) > LEVEL_EPS) return false;
  const front = standAt(index, q.x - out.x * LEDGE_PROBE, q.z - out.z * LEDGE_PROBE, top - REACH.mantleMin);
  if (front === null) return false;
  const rise = top - front;
  return rise >= REACH.mantleMin && rise <= REACH.mantleMax;
}

/** Every box edge a hero can mantle onto: the top is free to stand on, and the ground in front is 0.6–2.4 m lower. */
export function deriveLedges(prims: readonly BlockoutPrim[], index: PrimIndex): Ledge[] {
  const ledges: Ledge[] = [];
  for (const p of prims) {
    if (!blocksMovement(p) || p.shape !== 'box') continue;
    const top = primTop(p);
    const c = corners(p);
    c.forEach((a, i) => {
      const b = c[(i + 1) % c.length];
      if (!b) return;
      const len = flat(a, b);
      if (len < LEDGE_MIN_LENGTH) return;
      const mx = (a.x + b.x) / 2;
      const mz = (a.z + b.z) / 2;
      const inLen = dmath.hypot(p.centre.x - mx, p.centre.z - mz);
      const out = v((p.centre.x - mx) / inLen, 0, (p.centre.z - mz) / inLen);
      const inset = LEDGE_INSET / len;
      const ok = [inset, 1 / 2, 1 - inset].every((t) =>
        ledgePointOk(index, v(a.x + (b.x - a.x) * t, top, a.z + (b.z - a.z) * t), out, top));
      if (ok) ledges.push({ a: v(a.x, top, a.z), b: v(b.x, top, b.z), out });
    });
  }
  return ledges;
}

// --- Nav graph -------------------------------------------------------------------------------------------------

/** Link kinds by how demanding they are; a link takes the most demanding move along it. */
const RANKED: readonly NavLinkKind[] = ['walk', 'drop', 'mantle', 'jump', 'dashJump'];
const WALK = 0;
const DROP = 1;
const MANTLE = 2;
const JUMP = 3;
const DASH_JUMP = 4;

/**
 * How a bot gets from a to b in a straight line over the ground, or null if it can't: walk (steps and slopes), drop
 * (down off something), mantle (up 0.6–2.4 m), jump (a jump-mantle up to 3.6 m, or a gap up to 3.5 m) or dashJump
 * (a gap up to 7 m).
 */
export function classifyLink(index: PrimIndex, a: Vec3, b: Vec3): NavLinkKind | null {
  return classifyProfile(groundProfile(index, a, b), a.y, b.y);
}

/** Standable surfaces (highest first) at evenly spaced samples from a to b, both ends included. */
interface Profile {
  readonly step: number;
  readonly samples: readonly (readonly number[])[];
}

function groundProfile(index: PrimIndex, a: Vec3, b: Vec3): Profile {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = dmath.hypot(dx, dz);
  const n = Math.max(1, Math.ceil(dist / NAV.sampleStep));
  const samples: number[][] = [];
  for (let k = 0; k <= n; k++) samples.push(surfacesAt(index, a.x + (dx * k) / n, a.z + (dz * k) / n));
  return { step: dist / n, samples };
}

const reversed = (p: Profile): Profile => ({ step: p.step, samples: [...p.samples].reverse() });

/** Classify walking along a profile from height `from` (at sample 0) to `to` (at the last sample). */
function classifyProfile(profile: Profile, from: number, to: number): NavLinkKind | null {
  const { samples, step: ds } = profile;
  const n = samples.length - 1;
  const tol = Math.max(REACH.step, ds * MAX_SLOPE_RISE);
  const surface = (k: number, maxY: number) => samples[k]?.find((y) => y <= maxY) ?? null;
  let f = from;
  let rank = WALK;
  for (let k = 1; k <= n; k++) {
    // Stay on the current level when it continues (walking under a low roof is not a climb onto it).
    const s = samples[k]?.find((y) => Math.abs(y - f) <= tol) ?? surface(k, f + REACH.jumpMantle);
    if (s === null) return null;
    const dh = s - f;
    if (dh > tol) {
      rank = Math.max(rank, dh <= REACH.mantleMax ? MANTLE : JUMP);
    } else if (dh < -tol) {
      // Off an edge: a gap to jump if there is footing back at this height soon enough, else a drop.
      let m = k + 1;
      let landed: number | null = null;
      for (; m <= n && (m - k) * ds <= REACH.dashJumpGap; m++) {
        const s2 = surface(m, f + tol);
        if (s2 !== null && s2 >= f - tol) {
          landed = s2;
          break;
        }
      }
      if (landed !== null) {
        rank = Math.max(rank, (m - k) * ds <= REACH.jumpGap ? JUMP : DASH_JUMP);
        f = landed;
        k = m;
        continue;
      }
      rank = Math.max(rank, DROP);
    }
    f = s;
  }
  return Math.abs(f - to) <= tol ? (RANKED[rank] ?? null) : null;
}

interface NavInput {
  readonly index: PrimIndex;
  /** Prims that seed generated nodes (building shells are left out: their nodes are authored). */
  readonly prims: readonly BlockoutPrim[];
  readonly lanes: readonly Lane[];
  /** Ground points that must be in the graph if standable: anchors and authored waypoints (y is a height hint). */
  readonly points: readonly Vec3[];
  readonly climbs: readonly ClimbSpec[];
  /** Authored links (hatch drops, Bough Springs); both halves present. */
  readonly links: readonly LinkSpec[];
  readonly updrafts: readonly Updraft[];
  readonly rooms: readonly Room[];
  /** The graph keeps only what is reachable both ways from here (Dawn's first spawn). */
  readonly root: Vec3;
}

/** Index of the first room whose volume holds the point (feet within ROOM_FLOOR_EPS of its floor), or −1. */
export function roomAt(rooms: readonly Room[], p: Vec3): number {
  return rooms.findIndex((r) => {
    const { centre: c, size: s } = r.volume;
    const lx = p.x - c.x;
    const lz = p.z - c.z;
    const ca = dmath.cos(r.volume.yaw);
    const sa = dmath.sin(r.volume.yaw);
    return Math.abs(lx * ca - lz * sa) <= s.x / 2 && Math.abs(lx * sa + lz * ca) <= s.z / 2 &&
      p.y >= c.y - s.y / 2 - ROOM_FLOOR_EPS && p.y < c.y + s.y / 2;
  });
}

/** Candidate ground points: lane samples, building corners and roofs, ramp ends, wide cylinder tops. */
function candidates(input: NavInput): Vec3[] {
  const out: Vec3[] = [];
  for (const lane of input.lanes) {
    const len = pathLength(lane.path);
    const n = Math.ceil(len / NAV.laneSpacing);
    for (let k = 0; k <= n; k++) out.push(pointOnPath(lane.path, (len * k) / n));
  }
  for (const u of input.updrafts) for (const s of u.stations) out.push(raise(s, -UPDRAFT_HEIGHT));
  for (const p of input.prims) {
    if (!blocksMovement(p)) continue;
    const top = primTop(p);
    if (p.shape === 'cylinder') {
      if (p.radius >= NAV.cylinderMinRadius) out.push(v(p.centre.x, top, p.centre.z));
      continue;
    }
    if (p.shape === 'ramp') {
      const fx = dmath.sin(p.yaw) * (p.size.z / 2 + NAV.rampEndOffset);
      const fz = dmath.cos(p.yaw) * (p.size.z / 2 + NAV.rampEndOffset);
      out.push(v(p.centre.x + fx, top, p.centre.z + fz), v(p.centre.x - fx, primBottom(p), p.centre.z - fz));
      // Long ramps also get a node halfway up, or their ends would be too far apart to link.
      if (p.size.z + NAV.rampEndOffset * 2 > NAV.linkRadius / 2) out.push(v(p.centre.x, p.centre.y, p.centre.z));
      continue;
    }
    if (p.size.y < NAV.buildingMinHeight) continue;
    if (Math.min(p.size.x, p.size.z) < NAV.wallMaxThickness) {
      // A wall or hedge: one node past each end (so yard entrances get a node).
      const along = p.size.x > p.size.z ? v(dmath.cos(p.yaw), 0, -dmath.sin(p.yaw)) : v(dmath.sin(p.yaw), 0, dmath.cos(p.yaw));
      const reach = Math.max(p.size.x, p.size.z) / 2 + NAV.wallEndOffset;
      for (const k of [-1, 1]) out.push(v(p.centre.x + along.x * reach * k, primBottom(p), p.centre.z + along.z * reach * k));
      continue;
    }
    for (const c of corners(p, NAV.cornerOffset)) out.push(v(c.x, primBottom(p), c.z));
    if (p.size.x >= NAV.roofMinSide && p.size.z >= NAV.roofMinSide) out.push(v(p.centre.x, top, p.centre.z));
  }
  return out;
}

function nearest(nodes: readonly Vec3[], p: Vec3): number {
  let best = -1;
  let bestD = ATTACH_DIST;
  nodes.forEach((n, i) => {
    const d = dmath.hypot(n.x - p.x, n.y - p.y, n.z - p.z);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function reachable(count: number, links: NavGraph['links'], start: number, reverse: boolean): boolean[] {
  const adj: number[][] = Array.from({ length: count }, () => []);
  for (const l of links) adj[reverse ? l.to : l.from]?.push(reverse ? l.from : l.to);
  const seen = new Array<boolean>(count).fill(false);
  const queue = [start];
  seen[start] = true;
  for (let i = 0; i < queue.length; i++) {
    for (const next of adj[queue[i] ?? 0] ?? []) {
      if (!seen[next]) {
        seen[next] = true;
        queue.push(next);
      }
    }
  }
  return seen;
}

export function buildNav(input: NavInput): NavGraph {
  const { index } = input;
  // Snap every Dawn-half candidate to a standable surface and merge near-duplicates; then mirror, so the graph is
  // symmetric by construction (merging across z = 0 would favour one flock).
  const nodes: Vec3[] = [];
  const climbSpots = input.climbs.flatMap((c) => [buildClimb(c).bottom, climbLanding(c)]);
  const cell = NAV.mergeDist;
  const grid = new Map<string, Vec3[]>();
  const key = (cx: number, cz: number) => `${cx},${cz}`;
  const placed = [...input.points, ...climbSpots];
  for (const [i, c] of [...placed, ...candidates(input)].entries()) {
    // Trig leaves points meant for z = 0 a hair off it.
    const z = Math.abs(c.z) < LEVEL_EPS ? 0 : c.z;
    if (z > 0) continue;
    // Placed points (anchors, climbs) are trusted where they are; generated ones need room around them.
    const y = standAt(index, c.x, z, c.y + REACH.step, i < placed.length ? 0 : NAV.nodeClearance);
    if (y === null) continue;
    const p = v(c.x, y, z);
    const cx = Math.floor(p.x / cell);
    const cz = Math.floor(p.z / cell);
    let dup = false;
    for (let i = -1; i <= 1 && !dup; i++) {
      for (let k = -1; k <= 1 && !dup; k++) {
        dup = (grid.get(key(cx + i, cz + k)) ?? []).some((n) => (n.x - p.x) ** 2 + (n.y - p.y) ** 2 + (n.z - p.z) ** 2 < cell * cell);
      }
    }
    if (dup) continue;
    nodes.push(p);
    grid.set(key(cx, cz), [...(grid.get(key(cx, cz)) ?? []), p]);
  }
  const dawn = nodes.length;
  /** Index of each node's Dusk image (centre nodes are their own). */
  const mirrorOf = nodes.map((_, i) => i);
  nodes.forEach((n, i) => {
    if (n.z < 0) mirrorOf[i] = nodes.push(mirrorV(n)) - 1;
  });
  for (let i = dawn; i < nodes.length; i++) mirrorOf[i] = mirrorOf.indexOf(i);
  const ground = nodes.length;
  const links: NavLink[] = [];
  const link = (from: number, to: number, kind: NavLinkKind, spring?: number) => {
    if (from >= 0 && to >= 0 && from !== to) links.push(spring === undefined ? { from, to, kind } : { from, to, kind, spring });
  };
  /** Links among Dawn and centre nodes also give their Dusk images. */
  const linkBoth = (from: number, to: number, kind: NavLinkKind) => {
    link(from, to, kind);
    if (from >= dawn || to >= dawn) return;
    const mf = mirrorOf[from] ?? -1;
    const mt = mirrorOf[to] ?? -1;
    if (mf !== from || mt !== to) link(mf, mt, kind);
  };
  const dist = (a: Vec3, b: Vec3) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
  const near: number[][] = nodes.map(() => []);
  const r2 = NAV.linkRadius ** 2;
  for (let i = 0; i < ground; i++) {
    for (let j = i + 1; j < ground; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (a && b && (b.x - a.x) ** 2 + (b.z - a.z) ** 2 <= r2) {
        near[i]?.push(j);
        near[j]?.push(i);
      }
    }
  }
  for (let i = 0; i < ground; i++) {
    const a = nodes[i];
    if (!a) continue;
    for (const j of near[i] ?? []) {
      const b = nodes[j];
      if (j <= i || !b) continue;
      // Pairs with no Dawn node are the mirror of a Dawn pair, linked by linkBoth.
      if (a.z >= 0 && b.z >= 0 && (a.z > 0 || b.z > 0)) continue;
      // Skip a link when another node sits on the way: the two shorter links cover it.
      const d = dist(a, b);
      const limit = d * NAV.detour;
      let via = false;
      const lo = Math.min(a.y, b.y) - REACH.step;
      const hi = Math.max(a.y, b.y) + REACH.step;
      for (const k of near[i] ?? []) {
        const c = nodes[k];
        // Only a node at about the same height stands in for a link: one on the storey below doesn't.
        if (k === j || !c || c.y < lo || c.y > hi) continue;
        const ac = dist(a, c);
        if (ac < d && ac + dist(c, b) <= limit) {
          via = true;
          break;
        }
      }
      if (via) continue;
      const profile = groundProfile(index, a, b);
      const ab = classifyProfile(profile, a.y, b.y);
      if (ab) linkBoth(i, j, ab);
      const ba = classifyProfile(reversed(profile), b.y, a.y);
      if (ba) linkBoth(j, i, ba);
    }
  }
  for (const c of input.climbs) {
    const bottom = nearest(nodes, buildClimb(c).bottom);
    const top = nearest(nodes, climbLanding(c));
    const kind = climbLink(c);
    link(bottom, top, kind);
    if (kind === 'vine') link(top, bottom, 'vine');
  }
  for (const l of input.links) link(nearest(nodes, l.from), nearest(nodes, l.to), l.kind, l.spring);
  // Updraft stations are nodes on the line: mount from the ground below, ride between stations, drop off.
  for (const u of input.updrafts) {
    let prev = -1;
    for (const s of u.stations) {
      const air = nodes.push(v(s.x, s.y, s.z)) - 1;
      const below = nearest(nodes.slice(0, ground), v(s.x, s.y - UPDRAFT_HEIGHT, s.z));
      link(below, air, 'updraft');
      link(air, below, 'drop');
      if (prev >= 0) {
        link(prev, air, 'updraft');
        link(air, prev, 'updraft');
      }
      prev = air;
    }
  }
  // Keep the part every flock can reach and come back from.
  const root = nearest(nodes, input.root);
  const rooms = (ns: readonly Vec3[]) => ns.map((n) => roomAt(input.rooms, n));
  if (root < 0) return { nodes, links, nodeRoom: rooms(nodes) };
  const fwd = reachable(nodes.length, links, root, false);
  const back = reachable(nodes.length, links, root, true);
  const keep = nodes.map((_, i) => fwd[i] === true && back[i] === true);
  const remap: number[] = [];
  const kept: Vec3[] = [];
  nodes.forEach((n, i) => {
    remap[i] = keep[i] ? kept.push(n) - 1 : -1;
  });
  return {
    nodes: kept,
    links: links
      .filter((l) => keep[l.from] && keep[l.to])
      .map((l) => ({ ...l, from: remap[l.from] ?? -1, to: remap[l.to] ?? -1 })),
    nodeRoom: rooms(kept),
  };
}

// --- Assembly --------------------------------------------------------------------------------------------------

export const buildMap = (spec: MapSpec): MapData => buildWorld(spec).map;

/** The map and its dressing descriptor (D-EP-047), both halves resolved. */
export function buildWorld(spec: MapSpec): { readonly map: MapData; readonly dressing: MapDressing } {
  const { half, centre } = spec;
  const all = joinParts(centre, half, mirrorHalf(half));
  const prims = [...all.prims, ...(all.fabric ?? [])];
  const index = indexPrims(prims);
  const lanes: Lane[] = half.lanes.map((l) => ({
    id: l.id,
    halfWidth: l.halfWidth,
    path: [...l.path, ...l.path.slice(0, -1).reverse().map(mirrorV)],
  }));
  const team = <T extends Anchor>(dawn: readonly T[]) => [
    ...dawn.map((a) => ({ ...a, team: 'dawn' as const })),
    ...dawn.map((a) => ({ ...mirrorAnchor(a), team: 'dusk' as const })),
  ];
  const spawns: TeamAnchor[] = team(half.spawns);
  const shops: ShopAnchor[] = team(half.shops);
  const structures: StructureAnchor[] = team(half.structures);
  const updrafts = lanes.map((l) =>
    buildUpdraft(l, half.lanes.find((h) => h.id === l.id)?.path ?? [], structures.filter((s) => s.team === 'dawn')));
  const { climbs: climbSpecs, thickets, nests } = all;
  const botSpots: BotSpot[] = [...centre.botSpots, ...half.botSpots].flatMap((b) => {
    const dawn: BotSpot = { ...b, team: b.kind === 'safe' ? 'dawn' : 'neutral' };
    return [dawn, { ...dawn, pos: mirrorV(b.pos), team: b.kind === 'safe' ? 'dusk' : 'neutral' }];
  });
  const interactables = all.interactables ?? [];
  const springs = all.springs ?? [];
  const rooms = all.rooms ?? [];
  const anchors: Anchor[] = [
    ...spawns, ...shops, ...structures, ...thickets, ...nests, ...centre.runeSpots, ...centre.eggPerches, ...interactables,
  ];
  const root = spawns[0]?.pos ?? v(0, 0, 0);
  const navInput: NavInput = {
    index, prims: all.prims, lanes, climbs: climbSpecs, updrafts, root, rooms,
    links: [...(all.links ?? []), ...springs.map((s, i) => ({ from: s.pad, to: s.land, kind: 'walk' as const, spring: i }))],
    points: [
      ...all.nav,
      ...anchors.map((a) => a.pos),
      ...botSpots.map((b) => b.pos),
      ...springs.flatMap((s) => [s.pad, s.land]),
      ...(centre.hollow ? [centre.hollow.centre] : []),
    ],
  };
  // The nav graph is most of the build cost and only bots read it: build it on first access, once.
  let nav: NavGraph | undefined;
  const map: MapData = {
    get nav() {
      nav ??= buildNav(navInput);
      return nav;
    },
    id: spec.id,
    name: spec.name,
    bounds: spec.bounds,
    killY: spec.killY,
    prims,
    lanes,
    updrafts,
    climbs: climbSpecs.map(buildClimb),
    ledges: deriveLedges(prims, index),
    spawns,
    shops,
    structures,
    thickets,
    nests,
    runeSpots: centre.runeSpots,
    eggPerches: centre.eggPerches,
    hollow: centre.hollow,
    botSpots,
    buildings: all.buildings ?? [],
    rooms,
    openings: all.openings ?? [],
    jungle: all.jungle ?? [],
    interactables,
    springs,
    dressing: { buildings: all.dress ?? [], props: all.props ?? [] },
  };
  return { map, dressing: map.dressing ?? { buildings: [], props: [] } };
}
