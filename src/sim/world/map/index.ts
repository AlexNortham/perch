// TODO(Level Designer): the real 'main' map (3 lanes, mirror-symmetric city in a forest, rooftops, Chimneys, Vines,
// Updrafts, shops, every structure, Thickets, Nests, rune spots, Egg, Roc pit, nav graph). 'main' below is a W1
// placeholder so createSim and the blockout scene work; 'arena' is the flat test map and should stay simple.
import type { MapData, MapId, TeamAnchor } from '../../core/contracts';
import { TEAM_SIZE } from '../../data/core';

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

/** W1 placeholder for the real map: ground, three straight lanes and two base pads. */
const MAIN_PLACEHOLDER: MapData = {
  id: 'main',
  name: 'Perch (placeholder)',
  bounds: { min: { x: -130, y: -20, z: -150 }, max: { x: 130, y: 80, z: 150 } },
  killY: -20,
  prims: [
    { shape: 'box', centre: { x: 0, y: -0.5, z: 0 }, size: { x: 260, y: 1, z: 300 }, yaw: 0, material: 'grass', solid: true },
    { shape: 'box', centre: { x: -70, y: 0.05, z: 0 }, size: { x: 10, y: 0.1, z: 220 }, yaw: 0, material: 'road', solid: true },
    { shape: 'box', centre: { x: 0, y: 0.05, z: 0 }, size: { x: 10, y: 0.1, z: 220 }, yaw: 0, material: 'road', solid: true },
    { shape: 'box', centre: { x: 70, y: 0.05, z: 0 }, size: { x: 10, y: 0.1, z: 220 }, yaw: 0, material: 'road', solid: true },
    { shape: 'cylinder', centre: { x: 0, y: 0.25, z: -146 }, radius: 10, height: 0.5, material: 'dawn', solid: true },
    { shape: 'cylinder', centre: { x: 0, y: 0.25, z: 146 }, radius: 10, height: 0.5, material: 'dusk', solid: true },
  ],
  lanes: [
    { id: 'hedgerow', path: [{ x: -70, y: 0, z: -110 }, { x: -70, y: 0, z: 110 }], halfWidth: 4 },
    { id: 'riverbank', path: [{ x: 0, y: 0, z: -110 }, { x: 0, y: 0, z: 110 }], halfWidth: 4 },
    { id: 'pinewood', path: [{ x: 70, y: 0, z: -110 }, { x: 70, y: 0, z: 110 }], halfWidth: 4 },
  ],
  nav: EMPTY_NAV,
  updrafts: [],
  climbs: [],
  ledges: [],
  spawns: spawnRows({ z: 146, y: 0.5, spacing: 3 }),
  shops: [],
  structures: [],
  thickets: [],
  nests: [],
  runeSpots: [],
  eggPerches: [],
  hollow: null,
  botSpots: [],
};

export function loadMap(id: MapId): MapData {
  return id === 'arena' ? ARENA : MAIN_PLACEHOLDER;
}
