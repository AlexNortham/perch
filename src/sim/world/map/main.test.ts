import { describe, expect, it } from 'vitest';
import type { Anchor, BlockoutPrim, LaneId, MapData, NavLinkKind, Vec3 } from '../../core/contracts';
import { TEAM_SIZE } from '../../data/core';
import { pathLength, projectOnPath, pointOnPath, wrapAngle } from './build';
import { NAV, REACH, STATION_SETBACK, UPDRAFT_HEIGHT } from './data/traversal';
import { columnClear, indexPrims, inFootprint, primBottom, primTop, standAt } from './geometry';
import { ARENA, loadMap, mapSvg } from './index';

const map = loadMap('main');
const index = indexPrims(map.prims);
const flat = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);
const ground = (x: number, z: number, maxY = 0.5) => standAt(index, x, z, maxY);

describe("loadMap('main')", () => {
  it('is cheap: few prims', () => {
    expect(map.prims.length).toBeLessThanOrEqual(1500);
  });

  it('builds once and keeps the arena', () => {
    expect(loadMap('main')).toBe(map);
    expect(loadMap('arena')).toBe(ARENA);
    expect(map.id).toBe('main');
  });

  it('has no solid prim thinner than the nav sample step', () => {
    for (const p of map.prims.filter((q) => q.solid)) {
      const thin = p.shape === 'cylinder' ? p.radius * 2 : Math.min(p.size.x, p.size.z);
      expect(thin, JSON.stringify(p)).toBeGreaterThanOrEqual(NAV.sampleStep);
    }
  });

  it('keeps every anchor and lane inside the bounds', () => {
    const { min, max } = map.bounds;
    const inside = (p: Vec3) => p.x >= min.x && p.x <= max.x && p.z >= min.z && p.z <= max.z && p.y >= map.killY;
    const anchors: Anchor[] = [...map.spawns, ...map.shops, ...map.structures, ...map.thickets, ...map.nests,
      ...map.runeSpots, ...map.eggPerches];
    for (const a of anchors) expect(inside(a.pos), JSON.stringify(a)).toBe(true);
    for (const l of map.lanes) for (const p of l.path) expect(inside(p)).toBe(true);
  });

  it('renders a top-down SVG', () => {
    const svg = mapSvg(map);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('Patron');
  });
});

// --- Symmetry ------------------------------------------------------------------------------------------------

const r = (x: number) => (Math.round(x * 1000) / 1000 || 0).toFixed(3);
const vk = (p: Vec3) => `${r(p.x)},${r(p.y)},${r(p.z)}`;
const mz = (p: Vec3): Vec3 => ({ x: p.x, y: p.y, z: -p.z });
const mod = (a: number, m: number) => ((a % m) + m) % m;
/** Yaw as a key: boxes repeat every half turn, ramps every turn. Rounding near the wrap point counts as 0. */
const yawKey = (yaw: number, period: number) => {
  const k = r(mod(yaw, period));
  return k === r(period) ? r(0) : k;
};

function primKey(p: BlockoutPrim): string {
  const base = `${p.shape} ${p.material} ${p.solid} ${vk(p.centre)}`;
  if (p.shape === 'cylinder') return `${base} ${r(p.radius)} ${r(p.height)}`;
  return `${base} ${vk(p.size)} ${yawKey(p.yaw, p.shape === 'box' ? Math.PI : Math.PI * 2)}`;
}

/** The Dusk image, computed independently of build.ts: z → −z, yaw → π − yaw. */
function mirrorKey(p: BlockoutPrim): string {
  const centre = mz(p.centre);
  return primKey(p.shape === 'cylinder' ? { ...p, centre } : { ...p, centre, yaw: Math.PI - p.yaw });
}

const sorted = (xs: string[]) => [...xs].sort();
const swap = (t: string) => (t === 'dawn' ? 'dusk' : t === 'dusk' ? 'dawn' : t);
const anchorKey = (a: Anchor & { team?: string }, team = a.team ?? '') => `${team} ${vk(a.pos)} ${yawKey(a.yaw, Math.PI * 2)}`;
const anchorMirrorKey = (a: Anchor & { team?: string }) =>
  `${swap(a.team ?? '')} ${vk(mz(a.pos))} ${yawKey(Math.PI - a.yaw, Math.PI * 2)}`;

describe('mirror symmetry (z → −z)', () => {
  it('every prim has its Dusk mirror', () => {
    expect(sorted(map.prims.map(mirrorKey))).toEqual(sorted(map.prims.map(primKey)));
  });

  it('every anchor has its mirror, with the flock swapped', () => {
    const lists: (readonly (Anchor & { team?: string })[])[] = [
      map.spawns, map.shops, map.structures, map.thickets, map.nests, map.runeSpots, map.eggPerches,
    ];
    for (const list of lists) expect(sorted(list.map(anchorMirrorKey))).toEqual(sorted(list.map((a) => anchorKey(a))));
    const spots = map.botSpots.map((b) => `${b.kind} ${b.team} ${vk(b.pos)}`);
    expect(sorted(map.botSpots.map((b) => `${b.kind} ${swap(b.team)} ${vk(mz(b.pos))}`))).toEqual(sorted(spots));
  });

  it('lanes, Updrafts, climbs, ledges and the nav graph are their own mirror image', () => {
    for (const l of map.lanes) expect(l.path.map((p) => vk(mz(p))).reverse()).toEqual(l.path.map(vk));
    for (const u of map.updrafts) {
      expect(u.points.map((p) => vk(mz(p))).reverse()).toEqual(u.points.map(vk));
      expect(u.stations.map((p) => vk(mz(p))).reverse()).toEqual(u.stations.map(vk));
    }
    const climb = (c: MapData['climbs'][number], m: (p: Vec3) => Vec3) => `${c.kind} ${vk(m(c.bottom))} ${vk(m(c.top))} ${vk(m(c.out))}`;
    expect(sorted(map.climbs.map((c) => climb(c, mz)))).toEqual(sorted(map.climbs.map((c) => climb(c, (p) => p))));
    const ledge = (a: Vec3, b: Vec3, out: Vec3) => `${sorted([vk(a), vk(b)]).join(' ')} ${vk(out)}`;
    expect(sorted(map.ledges.map((l) => ledge(mz(l.a), mz(l.b), mz(l.out)))))
      .toEqual(sorted(map.ledges.map((l) => ledge(l.a, l.b, l.out))));
    const { nodes, links } = map.nav;
    expect(sorted(nodes.map((n) => vk(mz(n))))).toEqual(sorted(nodes.map(vk)));
    const link = (from: Vec3 | undefined, to: Vec3 | undefined, kind: string) => `${from && vk(from)} ${to && vk(to)} ${kind}`;
    expect(sorted(links.map((l) => link(nodes[l.from] && mz(nodes[l.from] as Vec3), nodes[l.to] && mz(nodes[l.to] as Vec3), l.kind))))
      .toEqual(sorted(links.map((l) => link(nodes[l.from], nodes[l.to], l.kind))));
  });

  it('structure, camp and side-stall positions are also mirrored in x', () => {
    const xk = (p: Vec3) => `${r(p.x)},${r(p.z)}`;
    const xm = (p: Vec3) => `${r(-p.x)},${r(p.z)}`;
    const sides = map.shops.filter((s) => s.kind === 'stall' && Math.abs(s.pos.x) > 50);
    for (const list of [map.structures, map.thickets, sides]) {
      expect(sorted(list.map((a) => xm(a.pos)))).toEqual(sorted(list.map((a) => xk(a.pos))));
    }
  });
});

// --- GDD §6.3 anchors ----------------------------------------------------------------------------------------

/** Dawn coordinates from GDD §6.3; each is checked for both flocks (Dusk: z negated). */
const GATES: Record<LaneId, [number, number]> = { hedgerow: [-40, -114], riverbank: [0, -112], pinewood: [40, -114] };
const HERONS: Record<LaneId, [number, number]> = { hedgerow: [-95, -75], riverbank: [0, -80], pinewood: [95, -75] };
const HAWKS: Record<LaneId, [number, number]> = { hedgerow: [-95, -35], riverbank: [0, -40], pinewood: [95, -35] };
const LANE_IDS: LaneId[] = ['hedgerow', 'riverbank', 'pinewood'];

const at = (list: readonly Anchor[], x: number, z: number) => list.filter((a) => Math.abs(a.pos.x - x) < 1e-6 && Math.abs(a.pos.z - z) < 1e-6);

describe('GDD §6.3 anchors', () => {
  for (const [team, sz] of [['dawn', 1], ['dusk', -1]] as const) {
    const Z = (z: number) => z * sz;
    it(`${team}: Home Roost, Patron, Shrines and spawns`, () => {
      const roost = map.shops.filter((s) => s.team === team && s.kind === 'roost');
      expect(roost).toHaveLength(1);
      expect(roost[0]).toMatchObject({ pos: { x: 0, y: 2, z: Z(-146) }, radius: 10 });
      expect(ground(0, Z(-146), 2.5)).toBe(2);
      const patron = map.structures.filter((s) => s.team === team && s.type === 'patron');
      expect(patron).toHaveLength(1);
      expect(patron[0]?.pos).toEqual({ x: 0, y: 3, z: Z(-136) });
      expect(ground(0, Z(-136), 3.5)).toBe(3);
      for (const x of [-16, 16]) expect(at(map.structures.filter((s) => s.team === team && s.type === 'shrine'), x, Z(-126))).toHaveLength(1);
      const spawns = map.spawns.filter((s) => s.team === team);
      expect(spawns.length).toBeGreaterThanOrEqual(TEAM_SIZE);
      for (const s of spawns) {
        expect(flat(s.pos, { x: 0, y: 0, z: Z(-146) })).toBeLessThanOrEqual(10);
        expect(ground(s.pos.x, s.pos.z, s.pos.y + 0.5)).toBe(s.pos.y);
      }
    });

    it(`${team}: walled base with three 12 m gates`, () => {
      for (const [x, z] of [[-53, -115], [-20, -115], [20, -115], [53, -115], [-61, -130], [61, -130]] as const) {
        expect(columnClear(index, x, Z(z), 1, 7), `wall at ${x},${z}`).toBe(false);
      }
      for (const lane of LANE_IDS) {
        const [gx] = GATES[lane];
        for (const dx of [-5.5, 0, 5.5]) expect(ground(gx + dx, Z(-115)), `${lane} gate`).toBe(0);
        for (const dx of [-6.5, 6.5]) expect(columnClear(index, gx + dx, Z(-115), 1, 7)).toBe(false);
      }
    });

    it(`${team}: Wardens, Herons and Hawks per lane`, () => {
      const mine = map.structures.filter((s) => s.team === team);
      for (const lane of LANE_IDS) {
        const [gx] = GATES[lane];
        for (const x of [gx - 6, gx + 6]) expect(at(mine.filter((s) => s.type === 'warden' && s.lane === lane), x, Z(-110))).toHaveLength(1);
        const [hx, hz] = HERONS[lane];
        expect(at(mine.filter((s) => s.type === 'heron' && s.lane === lane), hx, Z(hz))).toHaveLength(1);
        const [kx, kz] = HAWKS[lane];
        expect(at(mine.filter((s) => s.type === 'hawk' && s.lane === lane), kx, Z(kz))).toHaveLength(1);
      }
      expect(mine).toHaveLength(1 + 2 + 6 + 3 + 3);
    });

    it(`${team}: Magpie stalls`, () => {
      const stalls = map.shops.filter((s) => s.team === team && s.kind === 'stall');
      expect(stalls).toHaveLength(3);
      for (const [x, z] of [[-105, -58], [10, -60], [105, -58]] as const) {
        const s = at(stalls, x, Z(z));
        expect(s).toHaveLength(1);
        expect(s[0]).toMatchObject({ radius: 6 });
        expect(ground(x, Z(z))).toBe(0);
      }
    });

    it(`${team}: Thickets by tier`, () => {
      const tiers: [number, number, number][] = [
        [-65, -22, 1], [-30, -52, 1], [30, -52, 1], [65, -22, 1], [-60, -80, 2], [60, -80, 2], [-40, -12, 3], [40, -12, 3],
      ];
      for (const [x, z, tier] of tiers) {
        const t = map.thickets.filter((k) => Math.abs(k.pos.x - x) < 1e-6 && Math.abs(k.pos.z - Z(z)) < 1e-6);
        expect(t).toHaveLength(1);
        expect(t[0]?.tier).toBe(tier);
        expect(ground(x, Z(z))).toBe(0);
      }
    });
  }

  it('lane paths, widths and lengths', () => {
    const lane = (id: LaneId) => map.lanes.find((l) => l.id === id);
    const xy = (id: LaneId) => lane(id)?.path.map((p) => [p.x, p.z]);
    expect(xy('hedgerow')).toEqual([[-40, -114], [-95, -80], [-95, 0], [-95, 80], [-40, 114]]);
    expect(xy('riverbank')).toEqual([[0, -112], [0, 0], [0, 112]]);
    expect(xy('pinewood')).toEqual([[40, -114], [95, -80], [95, 0], [95, 80], [40, 114]]);
    expect([lane('hedgerow')?.halfWidth, lane('riverbank')?.halfWidth, lane('pinewood')?.halfWidth]).toEqual([7, 9, 8]);
    expect(pathLength(lane('hedgerow')?.path ?? [])).toBeCloseTo(289, 0);
    expect(pathLength(lane('pinewood')?.path ?? [])).toBeCloseTo(289, 0);
    expect(pathLength(lane('riverbank')?.path ?? [])).toBeCloseTo(224, 5);
  });

  it('the Hollow, the Old Mill Bridge, Egg Perches and rune bridges', () => {
    expect(map.hollow).toEqual({ centre: { x: 0, y: -10, z: 0 }, radius: 22, floorY: -10 });
    for (const [x, z] of [[15, 8], [-15, 10], [0, 18], [12, -12]] as const) expect(ground(x, z, -9.5), `${x},${z}`).toBe(-10);
    for (let z = -22; z <= 22; z += 2) for (const x of [-4, 0, 4]) expect(ground(x, z), `deck ${x},${z}`).toBe(0);
    for (const x of [-50, 50]) {
      expect(at(map.eggPerches, x, 0)[0]?.pos.y).toBe(1);
      for (const [dx, dz] of [[2.9, 0], [-2.9, 0], [0, 2.9], [0, -2.9]] as const) expect(ground(x + dx, dz, 1.5)).toBe(1);
    }
    for (const x of [-95, 95]) {
      expect(at(map.runeSpots, x, 0)[0]?.pos.y).toBe(6);
      expect(ground(x, 0, 6.5)).toBe(6);
      expect(ground(x, 0)).toBe(0); // the lane runs under the footbridge
    }
  });

  it('counts per half (GDD §6.5)', () => {
    const dawn = <T extends { pos?: Vec3; bottom?: Vec3 }>(xs: readonly T[]) => xs.filter((x) => (x.pos ?? x.bottom ?? { z: 0 }).z < 0);
    expect(dawn(map.nests)).toHaveLength(16);
    expect(dawn(map.thickets)).toHaveLength(8);
    expect(dawn(map.climbs.filter((c) => c.kind === 'chimney'))).toHaveLength(6);
    expect(dawn(map.climbs.filter((c) => c.kind === 'vine')).length).toBeGreaterThanOrEqual(10);
    expect(map.runeSpots).toHaveLength(2);
    expect(map.eggPerches).toHaveLength(2);
  });

  it('a Chimney within 25 m of every tier-2/3 Thicket and every Hawk; Vines at the Hawks and Egg Perches', () => {
    const chimneys = map.climbs.filter((c) => c.kind === 'chimney');
    const vines = map.climbs.filter((c) => c.kind === 'vine');
    const nearest = (cs: typeof chimneys, p: Vec3) => Math.min(...cs.map((c) => flat(c.bottom, p)));
    for (const t of map.thickets.filter((k) => k.tier >= 2)) expect(nearest(chimneys, t.pos)).toBeLessThanOrEqual(25);
    for (const h of map.structures.filter((s) => s.type === 'hawk')) {
      expect(nearest(chimneys, h.pos)).toBeLessThanOrEqual(25);
      expect(nearest(vines, h.pos)).toBeLessThanOrEqual(16);
    }
    for (const e of map.eggPerches) expect(nearest(vines, { ...e.pos, z: -8 })).toBeLessThanOrEqual(12);
  });
});

// --- Traversability -------------------------------------------------------------------------------------------

describe('traversal', () => {
  it('lane paths run from gate to gate on walkable ground with no step a fledgling cannot take', () => {
    for (const lane of map.lanes) {
      const [gx, gz] = GATES[lane.id];
      expect(lane.path[0]).toMatchObject({ x: gx, z: gz });
      expect(lane.path[lane.path.length - 1]).toMatchObject({ x: gx, z: -gz });
      const len = pathLength(lane.path);
      for (const side of [-1, 0, 1]) {
        let prev: number | null = null;
        for (let s = 0; s <= len; s += 0.5) {
          const p = pointOnPath(lane.path, s);
          const q = pointOnPath(lane.path, Math.min(len, s + 0.1));
          const d = Math.hypot(q.x - p.x, q.z - p.z) || 1;
          // Fledglings march two wide, 1.5 m apart: check the centre line and 1 m either side.
          const x = p.x + ((q.z - p.z) / d) * side;
          const z = p.z - ((q.x - p.x) / d) * side;
          const y = standAt(index, x, z, p.y + REACH.step, 0.3);
          expect(y, `${lane.id} at ${x.toFixed(1)},${z.toFixed(1)}`).not.toBeNull();
          expect(Math.abs((y ?? 0) - p.y)).toBeLessThanOrEqual(0.05);
          if (prev !== null) expect(Math.abs((y ?? 0) - prev)).toBeLessThanOrEqual(REACH.step);
          prev = y;
        }
      }
    }
  });

  it('Updrafts run 12 m over their lanes, clear of geometry, with stations on the line', () => {
    expect(map.updrafts.map((u) => u.lane).sort()).toEqual([...LANE_IDS].sort());
    for (const u of map.updrafts) {
      const lane = map.lanes.find((l) => l.id === u.lane);
      expect(u.points).toEqual(lane?.path.map((p) => ({ ...p, y: p.y + UPDRAFT_HEIGHT })));
      const len = pathLength(u.points);
      for (let s = 0; s <= len; s += 0.5) {
        const p = pointOnPath(u.points, s);
        // A rider hangs below the line: keep 3 m under and 1 m over it clear, 1 m around.
        expect(columnClear(index, p.x, p.z, p.y - 3, p.y + 1, 1), `${u.lane} at ${s}`).toBe(true);
      }
      expect(u.stations).toHaveLength(7);
      for (const st of u.stations) expect(flat(pointOnPath(u.points, projectOnPath(u.points, st)), st)).toBeLessThan(1e-6);
      const [gx, gz] = GATES[u.lane];
      expect(u.stations[0]).toEqual({ x: gx, y: UPDRAFT_HEIGHT, z: gz });
      expect(u.stations[3]?.z).toBe(0);
      // Heron and Hawk stations sit STATION_SETBACK metres along the lane toward their own gate.
      for (const [x, z] of [HERONS[u.lane], HAWKS[u.lane]]) {
        const s = projectOnPath(u.points, { x, y: 0, z });
        const along = u.stations.map((st) => projectOnPath(u.points, st));
        expect(along.some((a) => Math.abs(s - STATION_SETBACK - a) < 1e-6)).toBe(true);
      }
    }
  });

  it('structures stand on the ground with their footprint clear of prims', () => {
    const footprint: Record<string, number> = { patron: 8, shrine: 2, warden: 1, hawk: 1.5, heron: 3 };
    for (const s of map.structures) {
      expect(ground(s.pos.x, s.pos.z, s.pos.y + 0.5), `${s.type} ${vk(s.pos)}`).toBe(s.pos.y);
      const rad = footprint[s.type] ?? 1;
      for (const [k, angle] of [0, 1, 2, 3, 4, 5, 6, 7].flatMap((a) => [[1, a], [0.5, a]] as const)) {
        const x = s.pos.x + Math.cos((angle * Math.PI) / 4) * rad * k;
        const z = s.pos.z + Math.sin((angle * Math.PI) / 4) * rad * k;
        expect(columnClear(index, x, z, s.pos.y + 0.05, s.pos.y + 3), `${s.type} ${vk(s.pos)}`).toBe(true);
      }
    }
  });

  it('every ledge is within mantle reach, with room on top', () => {
    expect(map.ledges.length).toBeGreaterThan(50);
    for (const l of map.ledges) {
      expect(Math.hypot(l.out.x, l.out.z)).toBeCloseTo(1, 6);
      expect(l.a.y).toBe(l.b.y);
      const m = { x: (l.a.x + l.b.x) / 2, z: (l.a.z + l.b.z) / 2 };
      const top = standAt(index, m.x + l.out.x * 0.6, m.z + l.out.z * 0.6, l.a.y + 0.01);
      const front = standAt(index, m.x - l.out.x * 0.6, m.z - l.out.z * 0.6, l.a.y - REACH.mantleMin);
      expect(top).toBe(l.a.y);
      const rise = l.a.y - (front ?? -Infinity);
      expect(rise).toBeGreaterThanOrEqual(REACH.mantleMin);
      expect(rise).toBeLessThanOrEqual(REACH.mantleMax);
    }
  });

  it('every ramp but the gable roofs is walkable (≤ 45°)', () => {
    const ramps = map.prims.filter((p) => p.shape === 'ramp' && p.material !== 'roof');
    expect(ramps.length).toBeGreaterThan(10);
    for (const p of ramps) {
      if (p.shape !== 'ramp') continue;
      expect(Math.atan2(p.size.y, p.size.z) * (180 / Math.PI), JSON.stringify(p.centre)).toBeLessThanOrEqual(REACH.maxSlopeDeg);
    }
  });

  it('no open ground wider than 25 m without hard cover, outside the market squares and the Hollow (GDD §6.5)', () => {
    // Proxy: every walkable ground point on a 4 m grid (Dawn half; Dusk mirrors it) is within 12.5 m of a solid prim
    // that stands at least 1 m above that ground.
    const cover = map.prims.filter((p) => p.solid && primTop(p) - primBottom(p) >= 1);
    const bare: string[] = [];
    for (let x = -128; x <= 128; x += 4) {
      for (let z = -148; z <= 0; z += 4) {
        if (Math.abs(x) < 24 && Math.abs(z) < 24) continue;
        if (map.structures.some((s) => s.type === 'hawk' && s.lane === 'riverbank' && flat(s.pos, { x, y: 0, z }) < 16)) continue;
        const y = ground(x, z);
        if (y === null) continue;
        const covered = cover.some((p) => primBottom(p) <= y + 0.5 && primTop(p) >= y + 1 && inFootprint(p, x, z, 12.5));
        if (!covered) bare.push(`${x},${z}`);
      }
    }
    expect(bare).toEqual([]);
  });

  it('climbs rise within the GDD §3.8 heights, with a clear shaft and a roof to land on', () => {
    for (const c of map.climbs) {
      const rise = c.top.y - c.bottom.y;
      if (c.kind === 'chimney') {
        expect(rise).toBeGreaterThanOrEqual(8);
        expect(rise).toBeLessThanOrEqual(14);
        expect(c.out).toEqual({ x: 0, y: 0, z: 0 });
      } else {
        expect(rise).toBeGreaterThanOrEqual(5);
        expect(rise).toBeLessThanOrEqual(12);
        expect(Math.hypot(c.out.x, c.out.z)).toBeCloseTo(1, 6);
      }
      expect(ground(c.bottom.x, c.bottom.z, c.bottom.y + 0.5), vk(c.bottom)).toBe(c.bottom.y);
      expect(columnClear(index, c.bottom.x, c.bottom.z, c.bottom.y + 0.05, c.top.y, c.kind === 'chimney' ? 1 : 0.3)).toBe(true);
    }
  });
});

// --- Nav graph -----------------------------------------------------------------------------------------------

function reach(start: number, kinds: ReadonlySet<NavLinkKind> | null, reverse = false): Set<number> {
  const seen = new Set([start]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i];
    for (const l of map.nav.links) {
      const [from, to] = reverse ? [l.to, l.from] : [l.from, l.to];
      if (from !== at || seen.has(to) || (kinds && !kinds.has(l.kind))) continue;
      seen.add(to);
      queue.push(to);
    }
  }
  return seen;
}

function nodeNear(p: Vec3, maxFlat = 3, maxRise = 1): number {
  let best = -1;
  let bestD = Infinity;
  map.nav.nodes.forEach((n, i) => {
    const d = flat(n, p);
    if (d <= maxFlat && Math.abs(n.y - p.y) <= maxRise && d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

describe('nav graph', () => {
  const { nodes, links } = map.nav;

  it('is well formed', () => {
    expect(nodes.length).toBeGreaterThan(200);
    for (const l of links) {
      expect(nodes[l.from]).toBeDefined();
      expect(nodes[l.to]).toBeDefined();
      expect(l.from).not.toBe(l.to);
    }
    const kinds = new Set(links.map((l) => l.kind));
    for (const k of ['walk', 'drop', 'mantle', 'jump', 'chimney', 'vine', 'updraft'] as const) expect(kinds.has(k), k).toBe(true);
    const pair = new Set(links.map((l) => `${l.from}>${l.to}>${l.kind}`));
    for (const l of links.filter((k) => k.kind === 'walk')) expect(pair.has(`${l.to}>${l.from}>walk`)).toBe(true);
  });

  it('every node is reachable from both spawns and back', () => {
    for (const team of ['dawn', 'dusk'] as const) {
      const spawn = map.spawns.find((s) => s.team === team);
      const start = spawn ? nodeNear(spawn.pos) : -1;
      expect(start).toBeGreaterThanOrEqual(0);
      expect(reach(start, null).size).toBe(nodes.length);
      expect(reach(start, null, true).size).toBe(nodes.length);
    }
  });

  it('every named point has a node', () => {
    const named: Vec3[] = [
      ...map.spawns, ...map.shops, ...map.structures, ...map.thickets, ...map.nests, ...map.runeSpots, ...map.eggPerches,
      ...map.botSpots,
    ].map((a) => a.pos);
    if (map.hollow) named.push(map.hollow.centre);
    for (const p of named) expect(nodeNear(p), vk(p)).toBeGreaterThanOrEqual(0);
  });

  it('links every climb and Updraft station', () => {
    for (const c of map.climbs) {
      const bottom = nodeNear(c.bottom);
      expect(links.some((l) => l.from === bottom && l.kind === c.kind && (nodes[l.to]?.y ?? 0) > c.bottom.y + 4), vk(c.bottom)).toBe(true);
    }
    for (const u of map.updrafts) {
      for (const st of u.stations) {
        const i = nodes.findIndex((n) => flat(n, st) < 1e-6 && n.y === st.y);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(links.some((l) => l.to === i && l.kind === 'updraft' && (nodes[l.from]?.y ?? 99) < 1)).toBe(true);
      }
    }
  });

  it('the Egg carrier (no mantle, climb or ride) can walk between the Egg Perches both ways', () => {
    const walkOnly = new Set<NavLinkKind>(['walk']);
    const [a, b] = map.eggPerches.map((e) => nodeNear(e.pos));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(reach(a ?? -1, walkOnly).has(b ?? -1)).toBe(true);
    expect(reach(b ?? -1, walkOnly).has(a ?? -1)).toBe(true);
  });
});

describe('helpers', () => {
  it('wrapAngle stays in (−π, π]', () => {
    expect(wrapAngle(Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 12);
    expect(wrapAngle(-0.5)).toBeCloseTo(-0.5, 12);
  });
});
