// Interiors, the jungle and the dressing descriptor of the Stage 4 map (GDD §6.5–6.12, D-EP-033, D-EP-047/048,
// feel gaps G19 and G20, the style guide's §1).
import { describe, expect, it } from 'vitest';
import type { Anchor, BlockoutPrim, Lane, Room, Vec3 } from '../../core/contracts';
import { pathLength, pointOnPath, projectOnPath, roomAt } from './build';
import { blocksMovement, indexPrims, primBottom, primTop, standAt } from './geometry';
import { loadDressing, loadMap } from './index';

const map = loadMap('main');
const dressing = loadDressing('main');
const index = indexPrims(map.prims);
const buildings = map.buildings ?? [];
const rooms = map.rooms ?? [];
const openings = map.openings ?? [];
const { nodes, links } = map.nav;
const nodeRoom = map.nav.nodeRoom ?? [];
const flat = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.z - b.z);

/** Horizontal distance from p to the lane's path. */
const fromPath = (lane: Lane, p: Vec3) => flat(pointOnPath(lane.path, projectOnPath(lane.path, p)), p);

/** The largest stretch of the lane, in metres of path, with none of the given arc lengths. */
function largestGap(lane: Lane, at: readonly number[]): number {
  const s = [0, ...at, pathLength(lane.path)].sort((a, b) => a - b);
  return Math.max(...s.slice(1).map((x, i) => x - (s[i] ?? 0)));
}

const JUNGLE = ['granary', 'warehouse', 'tavern', 'hollow-tree', 'bell-tower', 'hide'];

describe('the building kit (GDD §6.8, §6.9)', () => {
  it('eight enterable jungle buildings per quarter, the Market Hall west and the Water Mill east', () => {
    for (const quarter of ['west-dawn', 'east-dawn', 'west-dusk', 'east-dusk']) {
      const mine = buildings.filter((b) => b.id.endsWith(`-${quarter}`) && rooms.some((r) => r.building === buildings.indexOf(b)));
      const kinds = mine.map((b) => b.archetype).sort();
      const hall = quarter.startsWith('west') ? 'market-hall' : 'water-mill';
      expect(kinds, quarter).toEqual([...JUNGLE, 'hide', hall].sort());
    }
  });

  it('the lanes\' enterable houses: seven Hedgerow terrace houses and the Seed Exchange, two Stilt Houses, the Dovecotes', () => {
    const enterable = (a: string) => buildings.filter((b) => b.archetype === a && rooms.some((r) => r.building === buildings.indexOf(b)));
    expect(enterable('terrace-house')).toHaveLength(14);
    expect(enterable('seed-exchange')).toHaveLength(2);
    expect(enterable('stilt-house')).toHaveLength(4);
    expect(enterable('dovecote')).toHaveLength(2);
  });

  it('ids are unique and every record points at a real building or room', () => {
    expect(new Set(buildings.map((b) => b.id)).size).toBe(buildings.length);
    for (const r of rooms) expect(r.building === -1 || buildings[r.building] !== undefined).toBe(true);
    for (const o of openings) for (const i of o.rooms) expect(i === -1 || rooms[i] !== undefined, JSON.stringify(o)).toBe(true);
    for (const a of [...map.nests, ...map.thickets, ...(map.interactables ?? [])]) {
      if (a.building !== undefined) expect(buildings[a.building], JSON.stringify(a)).toBeDefined();
    }
  });

  it('every enterable building has at least two ground exits on different faces (GDD §6.8)', () => {
    rooms.forEach((r, i) => {
      if (r.storey !== 0 || r.building < 0 || r.tag === 'hide') return;
      const exits = openings.filter((o) => o.rooms.includes(i) && o.rooms.includes(-1) && o.passable && (o.kind === 'door' || o.kind === 'arch'));
      const faces = new Set(exits.map((o) => Math.round(o.yaw * 100)));
      expect(faces.size, buildings[r.building]?.id).toBeGreaterThanOrEqual(buildings[r.building]?.archetype === 'dovecote' ? 1 : 2);
    });
  });

  it('shot windows hold a movement-only filler; ivy curtains a sight-only prim (GDD §6.8)', () => {
    const near = (p: Vec3, blocks: 'movement' | 'sight') =>
      map.prims.some((q) => q.blocks === blocks && Math.hypot(q.centre.x - p.x, q.centre.y - p.y, q.centre.z - p.z) < 0.5);
    for (const o of openings.filter((k) => k.kind === 'window' && k.height > 1)) expect(near(o.centre, 'movement'), JSON.stringify(o.centre)).toBe(true);
    for (const o of openings.filter((k) => k.curtain)) expect(near(o.centre, 'sight'), JSON.stringify(o.centre)).toBe(true);
    for (const p of map.prims.filter((q) => q.blocks === 'sight')) expect(blocksMovement(p)).toBe(false);
  });
});

describe('nav through interiors (GDD §6.7)', () => {
  it('every floor is reachable: each room, cellar and the Cellar Run has nodes in the graph', () => {
    rooms.forEach((r, i) => expect(nodeRoom.includes(i), `${buildings[r.building]?.id ?? 'cellar run'} storey ${r.storey}`).toBe(true));
    nodes.forEach((n, i) => expect(nodeRoom[i]).toBe(roomAt(rooms, n)));
  });

  it('every door connects: links cross each passable opening, both ways for doors and arches', () => {
    const across = (o: (typeof openings)[number], from: number, to: number) => links.some((l) => {
      const a = nodes[l.from];
      const b = nodes[l.to];
      return a !== undefined && b !== undefined && nodeRoom[l.from] === from && nodeRoom[l.to] === to &&
        flat(a, o.centre) <= 12 && flat(b, o.centre) <= 12;
    });
    for (const o of openings) {
      const [a, b] = o.rooms;
      if (!o.passable || a === b) continue;
      const label = `${o.kind} ${JSON.stringify(o.centre)}`;
      const room = rooms[a];
      const atFloor = room !== undefined && o.centre.y - o.height / 2 - (room.volume.centre.y - room.volume.size.y / 2) < 0.5;
      // Doors and arches at floor level work both ways; raised ones (the belfry's, over its parapet) are ways out.
      if ((o.kind === 'door' || o.kind === 'arch' || o.kind === 'balcony') && atFloor) {
        expect(across(o, a, b), label).toBe(true);
        expect(across(o, b, a), label).toBe(true);
      } else {
        expect(across(o, a, b) || across(o, b, a), label).toBe(true);
      }
    }
  });

  it('ladders are vine links, hatches and skylights drops, Bough Springs one-way walk links to their landing', () => {
    expect(map.climbs.filter((c) => c.kind === 'ladder').length).toBeGreaterThanOrEqual(30);
    expect(links.some((l) => l.kind === 'drop' && (nodeRoom[l.to] ?? -1) >= 0)).toBe(true);
    const springs = map.springs ?? [];
    springs.forEach((s, i) => {
      const l = links.find((k) => k.spring === i);
      expect(l?.kind, `spring ${i}`).toBe('walk');
      expect(flat(nodes[l?.from ?? -1] ?? s.land, s.pad)).toBeLessThan(2.5);
      expect(flat(nodes[l?.to ?? -1] ?? s.pad, s.land)).toBeLessThan(2.5);
    });
  });
});

describe('anchors (GDD §6.10)', () => {
  const indoor: (Anchor & { building?: number; storey?: number })[] = [...map.nests, ...map.thickets, ...(map.interactables ?? [])];

  it('every indoor anchor is inside its building, on its storey, standing on a floor', () => {
    const inside = indoor.filter((a) => a.building !== undefined);
    expect(inside.length).toBeGreaterThan(60);
    for (const a of inside) {
      const b = buildings[a.building ?? -1];
      const label = `${b?.id} ${JSON.stringify(a.pos)}`;
      const fp = b?.footprint;
      expect(fp && Math.abs(a.pos.x - fp.centre.x) <= fp.size.x / 2 && Math.abs(a.pos.z - fp.centre.z) <= fp.size.z / 2, label).toBe(true);
      const room: Room | undefined = rooms[roomAt(rooms.map((r) => (r.building === a.building && r.storey === a.storey ? r : { ...r, volume: { ...r.volume, size: { x: 0, y: 0, z: 0 } } })), a.pos)];
      expect(room?.storey, label).toBe(a.storey);
    }
  });

  it('every Nest, camp and interactable stands on a surface at its height', () => {
    for (const a of indoor) expect(standAt(index, a.pos.x, a.pos.z, a.pos.y + 0.5), JSON.stringify(a.pos)).toBeCloseTo(a.pos.y, 2);
    for (const s of map.springs ?? []) {
      expect(standAt(index, s.pad.x, s.pad.z, s.pad.y + 0.5)).toBeCloseTo(s.pad.y, 2);
      expect(standAt(index, s.land.x, s.land.z, s.land.y + 0.5)).toBeCloseTo(s.land.y, 2);
    }
  });

  it('counts: 100 Nests, 24 camps, 8 Feeders, 22 Berries, 14 Lookouts, 8 Hides, 8 Springs, 32 ivy curtains, 2 tunnels, 2 Dens', () => {
    const variant = (v: string) => map.nests.filter((n) => (n.variant ?? 'twig') === v);
    expect([map.nests.length, variant('twig').length, variant('woven').length, variant('keepsake').length]).toEqual([100, 72, 16, 12]);
    expect(map.nests.filter((n) => n.pos.y <= -2 && (n.storey ?? 0) >= 0)).toHaveLength(4);
    expect(map.nests.filter((n) => (n.storey ?? 0) < 0).length).toBeGreaterThanOrEqual(12);
    expect(map.thickets.filter((t) => t.tier === 2 && t.building !== undefined)).toHaveLength(8);
    const kind = (k: string) => (map.interactables ?? []).filter((i) => i.kind === k);
    expect([kind('feeder').length, kind('berry').length, kind('lookout').length]).toEqual([8, 22, 14]);
    for (const f of kind('feeder').filter((i) => i.camp !== undefined)) {
      const camp = map.thickets[f.camp ?? -1];
      expect(camp?.family).toBe('rats');
      expect(camp?.building).toBe(f.building);
    }
    expect(kind('feeder').filter((i) => i.camp !== undefined)).toHaveLength(4);
    expect(rooms.filter((r) => r.tag === 'hide')).toHaveLength(8);
    expect(rooms.filter((r) => r.tag === 'tunnel')).toHaveLength(2);
    expect(map.springs ?? []).toHaveLength(8);
    for (const s of map.springs ?? []) expect([s.radius, s.apexY > s.land.y]).toEqual([1.2, true]);
    expect(openings.filter((o) => o.curtain)).toHaveLength(32);
    const dens = map.shops.filter((s) => s.neutral);
    expect(dens.map((d) => d.radius)).toEqual([5, 5]);
    expect(flat(dens[0]?.pos ?? { x: 0, y: 0, z: 0 }, dens[1]?.pos ?? { x: 0, y: 0, z: 0 })).toBeGreaterThan(20);
  });

  it('the Cellar Run\'s stair heads stop the Egg carrier; the first one is walked into northward and descends', () => {
    const stops = openings.filter((o) => o.blocksEggCarrier);
    expect(stops).toHaveLength(8);
    const first = stops[0];
    expect(first?.centre.z).toBeLessThan(0);
    const floor = (first?.centre.y ?? 0) - (first?.height ?? 0) / 2;
    expect(standAt(index, first?.centre.x ?? 0, (first?.centre.z ?? 0) - 3, floor + 0.5)).toBe(floor);
    expect(standAt(index, first?.centre.x ?? 0, (first?.centre.z ?? 0) + 6, floor - 1)).toBeLessThan(floor - 1);
  });
});

describe('the jungle (GDD §6.5)', () => {
  it('three zones per quarter, outlines anticlockwise seen from above, with their paths', () => {
    const zones = map.jungle ?? [];
    expect(zones).toHaveLength(12);
    expect(zones.filter((z) => z.half === 'dawn')).toHaveLength(6);
    for (const z of zones) {
      let area = 0;
      z.outline.forEach((p, i) => {
        const q = z.outline[(i + 1) % z.outline.length] ?? p;
        area += p.x * q.z - q.x * p.z;
      });
      // Seen from above (+y down onto x and z), anticlockwise runs from +z toward +x: a negative x–z shoelace.
      expect(area, z.id).toBeLessThan(0);
      expect(z.paths.length, z.id).toBeGreaterThan(0);
    }
    for (const b of buildings) {
      expect(['hedgerow', 'riverbank', 'pinewood', 'base'].includes(b.zone) || zones.some((z) => z.id === b.zone), b.id).toBe(true);
    }
  });
});

describe('lane framing and verticality (G19, G20)', () => {
  /** The lane's surface height beside p: its path's height at p's projection (lanes rise and fall, D-EP-053). */
  const laneY = (lane: Lane, p: Vec3) => pointOnPath(lane.path, projectOnPath(lane.path, p)).y;
  for (const lane of map.lanes) {
    it(`${lane.id}: a prop or cover piece at least every 10 m along the lane`, () => {
      // Standing on the lane's surface, 0.8–3.5 m tall.
      const at = map.prims.filter((p) => {
        if (!blocksMovement(p) || fromPath(lane, p.centre) > lane.halfWidth + 2) return false;
        const y = laneY(lane, p.centre);
        return Math.abs(primBottom(p) - y) <= 0.5 && primTop(p) - y >= 0.8 && primTop(p) - y <= 3.5;
      }).map((p) => projectOnPath(lane.path, p.centre));
      expect(largestGap(lane, at)).toBeLessThanOrEqual(10);
    });

    it(`${lane.id}: a raised route (4–8 m over the lane) at least every 30 m, stairs up at least every 40 m`, () => {
      // Riverbank's crossing of the Hollow is the GDD §6.4 exception: the bridge's long open sightline with the pit
      // 10 m below is that stretch's verticality, so the span over the Hollow counts as served.
      const hollow = lane.id === 'riverbank' && map.hollow ? Array.from({ length: map.hollow.radius * 2 + 1 }, (_, k) => pathLength(lane.path) / 2 - (map.hollow?.radius ?? 0) + k) : [];
      const raised = nodes.filter((n) => fromPath(lane, n) <= lane.halfWidth + 8 && n.y - laneY(lane, n) >= 4 && n.y - laneY(lane, n) <= 8)
        .map((n) => projectOnPath(lane.path, n));
      expect(largestGap(lane, [...raised, ...hollow])).toBeLessThanOrEqual(30);
      const stairs = map.prims.filter((p) => p.shape === 'ramp' && p.material !== 'roof' && fromPath(lane, p.centre) <= lane.halfWidth + 8 &&
        primTop(p) - laneY(lane, p.centre) >= 3.5).map((p) => projectOnPath(lane.path, p.centre));
      expect(largestGap(lane, [...stairs, ...hollow])).toBeLessThanOrEqual(40);
    });
  }

  it('at least three walkable roofs 8–12 m up beside the lanes per quarter, for roof-to-street drops', () => {
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const roofs = buildings.filter((b) => b.roof.walkable && b.roof.y >= 8 && b.roof.y <= 12 &&
        Math.sign(b.footprint.centre.x) === sx && Math.sign(b.footprint.centre.z) === sz &&
        map.lanes.some((l) => fromPath(l, b.footprint.centre) <= l.halfWidth + 12));
      expect(roofs.length, `${sx},${sz}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('the dressing descriptor (D-EP-047, style guide §1)', () => {
  it('describes every building, in MapData.buildings order', () => {
    expect(dressing.buildings).toHaveLength(buildings.length);
    buildings.forEach((b, i) => {
      const d = dressing.buildings[i];
      expect(d?.enterable, b.id).toBe(rooms.some((r) => r.building === i));
      expect(d?.roof.top, b.id).toBeCloseTo(b.roof.y >= (d?.roof.eaves ?? 0) ? Math.max(b.roof.y, d?.roof.top ?? 0) : 0, 5);
    });
    expect(dressing.buildings.filter((d) => !d.enterable).every((d) => d.marks.length > 0)).toBe(true);
    expect(dressing.buildings.filter((d) => d.roof.nestCrown).length * 3).toBeGreaterThanOrEqual(buildings.length);
  });

  it('every landing board it describes is a collision box you can stand on', () => {
    const boxes = map.prims.filter((p): p is Extract<BlockoutPrim, { shape: 'box' }> => p.shape === 'box' && blocksMovement(p));
    const landings = dressing.buildings.flatMap((d) => d.landings);
    expect(landings.length).toBeGreaterThan(8);
    for (const l of landings) {
      const same = boxes.some((p) => Math.hypot(p.centre.x - l.centre.x, p.centre.y - l.centre.y, p.centre.z - l.centre.z) < 1e-6 &&
        Math.abs(p.size.y - l.size.y) < 1e-6);
      expect(same, JSON.stringify(l.centre)).toBe(true);
      const top = l.centre.y + l.size.y / 2;
      expect(standAt(index, l.centre.x, l.centre.z, top + 0.1), JSON.stringify(l.centre)).toBeCloseTo(top, 3);
    }
  });

  it('wires never cross a lane and keep 3 m from every Updraft cable', () => {
    const lines = dressing.props.filter((p) => p.kind === 'wire');
    expect(lines.length).toBeGreaterThan(10);
    for (const w of lines) {
      for (const t of [-0.5, 0, 0.5]) {
        const p = { x: w.pos.x + Math.cos(w.yaw) * w.size.x * t, y: w.pos.y, z: w.pos.z - Math.sin(w.yaw) * w.size.x * t };
        for (const l of map.lanes) expect(fromPath(l, p), `${w.zone} ${JSON.stringify(w.pos)}`).toBeGreaterThan(l.halfWidth);
        for (const u of map.updrafts) {
          const c = pointOnPath(u.points, projectOnPath(u.points, p));
          expect(Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z)).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it('solid props skin a collision box; bird street life is on every quarter (D-EP-048)', () => {
    for (const p of dressing.props.filter((q) => q.solid)) {
      expect(map.prims.some((q) => q.solid && Math.abs(q.centre.x - p.pos.x) < 1e-6 && Math.abs(q.centre.z - p.pos.z) < 1e-6), JSON.stringify(p.pos)).toBe(true);
    }
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const kinds = new Set(dressing.props.filter((p) => Math.sign(p.pos.x) === sx && Math.sign(p.pos.z) === sz).map((p) => p.kind));
      for (const k of ['feeder', 'bird-bath', 'worm-bed', 'insect-hive', 'nest-pile', 'feather-banner', 'branch-nest', 'bramble'] as const) {
        expect(kinds.has(k), `${k} in ${sx},${sz}`).toBe(true);
      }
    }
    // Reed beds line the river, which runs through the east quarters.
    for (const sz of [-1, 1]) expect(dressing.props.some((p) => p.kind === 'reeds' && Math.sign(p.pos.z) === sz)).toBe(true);
  });

  it('dressing-only props at street level stay off the lanes\' clear middle (3 m either side of the path)', () => {
    const street = dressing.props.filter((q) => !q.solid && q.pos.y >= -1 && q.pos.y <= 1 && q.kind !== 'roots' && q.kind !== 'canopy');
    for (const p of street) for (const l of map.lanes) expect(fromPath(l, p.pos), `${p.kind} ${JSON.stringify(p.pos)}`).toBeGreaterThan(3);
  });
});
