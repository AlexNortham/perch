import type { Entity, EntityId, SpatialIndex, Vec3 } from './contracts';

/** The index plus the core-only rebuild, run after the movement phase. */
export interface CoreSpatial extends SpatialIndex {
  rebuild(entities: readonly Entity[]): void;
}

/** Packs a cell's integer coordinates into one Map key. Valid for |cell| < 2^20 on each axis. */
const KEY_STRIDE = 0x20_0000;
const KEY_OFFSET = 0x10_0000;
const ascending = (a: number, b: number): number => a - b;

/**
 * Uniform grid on XZ. Each entity is inserted into every cell its sphere touches, so a query only checks the cells
 * its own sphere touches. Arrays are reused between rebuilds to avoid garbage.
 */
export function createSpatialHash(cellSize: number): CoreSpatial {
  const cells = new Map<number, number[]>();
  const used: number[][] = [];
  const ids: EntityId[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  const rs: number[] = [];
  const seen = new Set<number>();

  const cellOf = (v: number): number => Math.floor(v / cellSize);
  const key = (cx: number, cz: number): number => (cx + KEY_OFFSET) * KEY_STRIDE + (cz + KEY_OFFSET);

  return {
    rebuild(entities) {
      for (const list of used) list.length = 0;
      used.length = 0;
      ids.length = 0;
      xs.length = 0;
      ys.length = 0;
      zs.length = 0;
      rs.length = 0;
      for (const e of entities) {
        const i = ids.length;
        ids.push(e.id);
        xs.push(e.pos.x);
        ys.push(e.pos.y);
        zs.push(e.pos.z);
        rs.push(e.radius);
        const x0 = cellOf(e.pos.x - e.radius);
        const x1 = cellOf(e.pos.x + e.radius);
        const z0 = cellOf(e.pos.z - e.radius);
        const z1 = cellOf(e.pos.z + e.radius);
        for (let cx = x0; cx <= x1; cx++) {
          for (let cz = z0; cz <= z1; cz++) {
            const k = key(cx, cz);
            let list = cells.get(k);
            if (!list) {
              list = [];
              cells.set(k, list);
            }
            if (list.length === 0) used.push(list);
            list.push(i);
          }
        }
      }
    },
    query(centre: Vec3, radius: number, out: EntityId[]) {
      out.length = 0;
      seen.clear();
      const x0 = cellOf(centre.x - radius);
      const x1 = cellOf(centre.x + radius);
      const z0 = cellOf(centre.z - radius);
      const z1 = cellOf(centre.z + radius);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cz = z0; cz <= z1; cz++) {
          const list = cells.get(key(cx, cz));
          if (!list) continue;
          for (const i of list) {
            if (seen.has(i)) continue;
            seen.add(i);
            const dx = (xs[i] as number) - centre.x;
            const dy = (ys[i] as number) - centre.y;
            const dz = (zs[i] as number) - centre.z;
            const reach = radius + (rs[i] as number);
            if (dx * dx + dy * dy + dz * dz <= reach * reach) out.push(ids[i] as EntityId);
          }
        }
      }
      return out.sort(ascending);
    },
  };
}
