// Map data for every MapId. 'main' is the PERCH map (GDD §6), authored in data/main.ts and built by build.ts;
// 'arena' is the flat test map and stays simple.
import type { MapData, MapId, TeamAnchor } from '../../core/contracts';
import { TEAM_SIZE } from '../../data/core';
import { buildWorld } from './build';
import { MAIN_SPEC } from './data/main';
import type { MapDressing } from './dressing';

export { mapSvg } from './svg';
export type * from './dressing';

const EMPTY_NAV = { nodes: [], links: [] };

/** Spawn row offsets across x, in units of the row spacing, centred on x = 0 (one per team slot). */
const SPAWN_ROW = Array.from({ length: TEAM_SIZE }, (_, i) => i - (TEAM_SIZE - 1) / 2);

/** Six spawns per team in a row across x at height y: Dawn at −z facing +z, Dusk mirrored. */
function spawnRows(row: { z: number; y: number; spacing: number }): TeamAnchor[] {
  const at = (k: number, z: number) => ({ x: k * row.spacing, y: row.y, z });
  return [
    ...SPAWN_ROW.map((k) => ({ team: 'dawn' as const, pos: at(k, -row.z), yaw: 0 })),
    ...SPAWN_ROW.map((k) => ({ team: 'dusk' as const, pos: at(k, row.z), yaw: Math.PI })),
  ];
}

/** Flat 80 m square for sandboxes and unit tests. Ground top at y = 0. */
export const ARENA: MapData = {
  id: 'arena',
  name: 'Training Meadow',
  bounds: { min: { x: -40, y: -10, z: -40 }, max: { x: 40, y: 40, z: 40 } },
  killY: -10,
  prims: [
    { shape: 'box', centre: { x: 0, y: -0.5, z: 0 }, size: { x: 80, y: 1, z: 80 }, yaw: 0, material: 'grass', solid: true },
    { shape: 'box', centre: { x: 8, y: 1, z: 0 }, size: { x: 2, y: 2, z: 2 }, yaw: 0, material: 'wood', solid: true },
    { shape: 'ramp', centre: { x: -8, y: 1, z: 0 }, size: { x: 4, y: 2, z: 6 }, yaw: 0, material: 'stone', solid: true },
  ],
  lanes: [],
  nav: EMPTY_NAV,
  updrafts: [],
  climbs: [],
  ledges: [],
  spawns: spawnRows({ z: 15, y: 0, spacing: 3 }),
  shops: [],
  structures: [],
  thickets: [],
  nests: [],
  runeSpots: [],
  eggPerches: [],
  hollow: null,
  botSpots: [],
};

// ponytail: one memoised immutable build per process (~tens of ms); every sim shares it read-only.
let main: ReturnType<typeof buildWorld> | undefined;
const EMPTY_DRESSING: MapDressing = { buildings: [], props: [] };

export function loadMap(id: MapId): MapData {
  if (id === 'arena') return ARENA;
  main ??= buildWorld(MAIN_SPEC);
  return main.map;
}

/** The dressing descriptor (D-EP-047): `buildings` is parallel to loadMap(id).buildings. */
export function loadDressing(id: MapId): MapDressing {
  if (id === 'arena') return EMPTY_DRESSING;
  main ??= buildWorld(MAIN_SPEC);
  return main.dressing;
}
