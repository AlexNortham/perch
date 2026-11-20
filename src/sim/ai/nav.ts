/**
 * Bot navigation on MapData.nav (GDD §6.7): nearest-node lookup and A* over the links a difficulty may take. The
 * index is built once per map (maps are cached, so every match on 'main' shares it) and holds no match state.
 */
import type { MapData, NavLink, NavLinkKind, Vec3 } from '../core/contracts';
import * as dmath from '../core/dmath';
import { NAV } from '../data/ai';
import { STRUCTURE_BODY, STRUCTURE_RADIUS } from '../data/world';

export interface Route {
  /** Node indices from start to goal, both included. */
  readonly nodes: readonly number[];
  /** kinds[i]: the link taken to reach nodes[i] (kinds[0] is 'walk'). */
  readonly kinds: readonly NavLinkKind[];
}

export interface Nav {
  readonly size: number;
  node(i: number): Vec3;
  /** The best node to start from or aim for near p (−1 on a map without a graph). */
  nearest(p: Vec3): number;
  /** Cheapest route under `cost` (per link kind; Infinity = never), or null when there is none. */
  route(from: number, to: number, cost: Readonly<Record<NavLinkKind, number>>): Route | null;
}

const KINDS: readonly NavLinkKind[] = ['walk', 'jump', 'dashJump', 'mantle', 'chimney', 'vine', 'updraft', 'drop'];
const cache = new WeakMap<MapData, Nav>();

export function navFor(map: MapData): Nav {
  let nav = cache.get(map);
  if (!nav) {
    nav = buildNav(map);
    cache.set(map, nav);
  }
  return nav;
}

const cellKey = (cx: number, cz: number): number => cx * NAV.keyStride + cz;

/** The node exactly at (x, y, z) within half a metre, or −1. */
function nodeAt(nodes: readonly Vec3[], p: Vec3): number {
  return nodes.findIndex((q) => dmath.hypot(q.x - p.x, q.y - p.y, q.z - p.z) < NAV.arriveM / 2);
}

/** data/ai NAV.extraLinks, both ways, for both halves, where both ends are nodes of this map. */
function extraLinks(nodes: readonly Vec3[]): NavLink[] {
  const out: NavLink[] = [];
  for (const [a, b] of NAV.extraLinks) {
    for (const side of [1, -1]) {
      const from = nodeAt(nodes, { x: a.x, y: a.y, z: a.z * side });
      const to = nodeAt(nodes, { x: b.x, y: b.y, z: b.z * side });
      if (from < 0 || to < 0) continue;
      out.push({ from, to, kind: 'walk' }, { from: to, to: from, kind: 'walk' });
    }
  }
  return out;
}

function buildNav(map: MapData): Nav {
  const nodes = map.nav.nodes;
  const links = nodes.length > 0 ? [...map.nav.links, ...extraLinks(nodes)] : map.nav.links;
  const n = nodes.length;
  // Compressed adjacency: links of node i are first[i] .. first[i + 1] − 1.
  const first = new Int32Array(n + 1);
  for (const l of links) first[l.from + 1]! += 1;
  for (let i = 0; i < n; i++) first[i + 1]! += first[i]!;
  const fill = first.slice(0, n);
  const to = new Int32Array(links.length);
  const len = new Float64Array(links.length);
  const kind = new Uint8Array(links.length);
  // The graph is built from prims; towers are entities with colliders the graph doesn't know. Every link across a big
  // one (the Patron on its dais) is left out; the graph threads lanes through the small ones' anchors, so bots keep
  // those links and steer round the towers on the way (brain.ts).
  const blocks = map.structures.filter((s) => STRUCTURE_RADIUS[s.type] >= NAV.bigStructureM).map((s) => ({ x: s.pos.x, z: s.pos.z,
    r: STRUCTURE_RADIUS[s.type] + NAV.structureClearM, lo: s.pos.y - NAV.arriveDy, hi: s.pos.y + STRUCTURE_BODY[s.type].height }));
  const through = (a: Vec3, b: Vec3): boolean => blocks.some((s) => {
    if (Math.max(a.y, b.y) < s.lo || Math.min(a.y, b.y) > s.hi) return false;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l2 = dx * dx + dz * dz;
    const t = l2 > 0 ? Math.min(1, Math.max(0, ((s.x - a.x) * dx + (s.z - a.z) * dz) / l2)) : 0;
    return dmath.hypot(a.x + dx * t - s.x, a.z + dz * t - s.z) < s.r;
  });
  for (const l of links) {
    const k = fill[l.from]!++;
    const a = nodes[l.from]!;
    const b = nodes[l.to]!;
    to[k] = l.to;
    len[k] = through(a, b) ? Infinity : dmath.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    kind[k] = KINDS.indexOf(l.kind);
  }
  const cells = new Map<number, number[]>();
  const cellOf = (v: number): number => Math.floor(v / NAV.cellM);
  nodes.forEach((p, i) => {
    const key = cellKey(cellOf(p.x), cellOf(p.z));
    const list = cells.get(key);
    if (list) list.push(i);
    else cells.set(key, [i]);
  });

  // A* scratch, reused by every search (the sim is single-threaded).
  const g = new Float64Array(n);
  const came = new Int32Array(n);
  const cameKind = new Uint8Array(n);
  const seen = new Uint32Array(n);
  const done = new Uint32Array(n);
  let generation = 0;
  const heapNode: number[] = [];
  const heapF: number[] = [];
  const push = (node: number, f: number): void => {
    let i = heapNode.length;
    heapNode.push(node);
    heapF.push(f);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (heapF[parent]! <= f) break;
      heapNode[i] = heapNode[parent]!;
      heapF[i] = heapF[parent]!;
      i = parent;
    }
    heapNode[i] = node;
    heapF[i] = f;
  };
  const pop = (): number => {
    const top = heapNode[0]!;
    const lastNode = heapNode.pop()!;
    const lastF = heapF.pop()!;
    const size = heapNode.length;
    if (size > 0) {
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        if (l >= size) break;
        const r = l + 1;
        const c = r < size && heapF[r]! < heapF[l]! ? r : l;
        if (heapF[c]! >= lastF) break;
        heapNode[i] = heapNode[c]!;
        heapF[i] = heapF[c]!;
        i = c;
      }
      heapNode[i] = lastNode;
      heapF[i] = lastF;
    }
    return top;
  };

  return {
    size: n,
    node: (i) => nodes[i]!,
    nearest(p) {
      if (n === 0) return -1;
      const cx = cellOf(p.x);
      const cz = cellOf(p.z);
      let best = -1;
      let bestD = Infinity;
      for (let ring = 0; ring <= NAV.searchRings && best < 0; ring++) {
        for (let i = -ring; i <= ring; i++) {
          for (let k = -ring; k <= ring; k++) {
            if (Math.max(Math.abs(i), Math.abs(k)) !== ring) continue;
            for (const id of cells.get(cellKey(cx + i, cz + k)) ?? []) {
              const q = nodes[id]!;
              const d = dmath.hypot(q.x - p.x, q.z - p.z) + Math.abs(q.y - p.y) * NAV.heightWeight;
              if (d < bestD || (d === bestD && id < best)) {
                bestD = d;
                best = id;
              }
            }
          }
        }
      }
      if (best >= 0) return best;
      // Far from every node (fallen, flung): the nearest anywhere.
      nodes.forEach((q, id) => {
        const d = dmath.hypot(q.x - p.x, q.z - p.z) + Math.abs(q.y - p.y) * NAV.heightWeight;
        if (d < bestD) {
          bestD = d;
          best = id;
        }
      });
      return best;
    },
    route(from, goal, cost) {
      if (from < 0 || goal < 0 || from >= n || goal >= n) return null;
      const costs = KINDS.map((k) => cost[k]);
      generation++;
      heapNode.length = 0;
      heapF.length = 0;
      const target = nodes[goal]!;
      const h = (i: number): number => {
        const q = nodes[i]!;
        return dmath.hypot(target.x - q.x, target.y - q.y, target.z - q.z);
      };
      g[from] = 0;
      came[from] = -1;
      cameKind[from] = 0;
      seen[from] = generation;
      push(from, h(from));
      while (heapNode.length > 0) {
        const cur = pop();
        if (done[cur] === generation) continue;
        done[cur] = generation;
        if (cur === goal) break;
        for (let k = first[cur]!; k < first[cur + 1]!; k++) {
          const step = len[k]! * costs[kind[k]!]!;
          if (step === Infinity) continue;
          const next = to[k]!;
          if (done[next] === generation) continue;
          const tentative = g[cur]! + step;
          if (seen[next] === generation && tentative >= g[next]!) continue;
          seen[next] = generation;
          g[next] = tentative;
          came[next] = cur;
          cameKind[next] = kind[k]!;
          push(next, tentative + h(next));
        }
      }
      if (done[goal] !== generation) return null;
      const out: number[] = [];
      const kinds: NavLinkKind[] = [];
      for (let i = goal; i >= 0; i = came[i]!) {
        out.push(i);
        kinds.push(KINDS[cameKind[i]!]!);
      }
      out.reverse();
      kinds.reverse();
      kinds[0] = 'walk';
      return { nodes: out, kinds };
    },
  };
}
