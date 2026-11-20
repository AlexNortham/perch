import type { Entity, EntityId, SpatialIndex, Vec3 } from './contracts';

/** The index plus the core-only rebuild, run after the movement phase. */
export interface CoreSpatial extends SpatialIndex {
  rebuild(entities: readonly Entity[]): void;
}

/**
 * Cell coordinates are clamped to ±CELL_LIMIT so a packed key stays a small integer (a V8 Smi, which a Map hashes
 * without boxing). An entity past the limit lands in the edge cell; a query there clamps the same way and the exact
 * sphere test still filters, so far entities are found, only less cheaply.
 */
const CELL_LIMIT = 0x3fff;
const KEY_STRIDE = 0x8000;
const ascending = (a: number, b: number): number => a - b;

/**
 * Uniform grid on XZ. Each entity has a slot and sits in every cell its sphere touches, so a query only checks the
 * cells its own sphere touches. The rebuild is incremental (D-ARCH-029): it walks the store's entities beside the
 * slots of the last rebuild (both in ascending id order) and touches the cells only for an entity that spawned,
 * despawned or now covers other cells; one that stayed in its cells just has its centre and radius updated. Towers,
 * Nests, Feeders, sleeping camps and lying pickups cost a comparison a tick. Input in another order is still right,
 * only slower.
 */
export function createSpatialHash(cellSize: number): CoreSpatial {
  const cells = new Map<number, number[]>();
  // Slot columns. Slots are stable while their entity lives; freed slots are reused.
  const ids: EntityId[] = [];
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  const rs: number[] = [];
  /** The last query that met the slot (dedup across cells). */
  const met: number[] = [];
  /** The cell range the slot is linked into. */
  const x0s: number[] = [];
  const x1s: number[] = [];
  const z0s: number[] = [];
  const z1s: number[] = [];
  const free: number[] = [];
  /** Slots in the order of the last rebuild's input (ascending id for the store). */
  let order: number[] = [];
  let next: number[] = [];
  let queries = 0;

  const cellOf = (v: number): number => Math.max(-CELL_LIMIT, Math.min(CELL_LIMIT, Math.floor(v / cellSize)));
  const key = (cx: number, cz: number): number => (cx + CELL_LIMIT) * KEY_STRIDE + (cz + CELL_LIMIT);

  const link = (slot: number, x0: number, x1: number, z0: number, z1: number): void => {
    x0s[slot] = x0;
    x1s[slot] = x1;
    z0s[slot] = z0;
    z1s[slot] = z1;
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = key(cx, cz);
        let list = cells.get(k);
        if (!list) {
          list = [];
          cells.set(k, list);
        }
        list.push(slot);
      }
    }
  };

  const unlink = (slot: number): void => {
    for (let cx = x0s[slot] as number, x1 = x1s[slot] as number; cx <= x1; cx++) {
      for (let cz = z0s[slot] as number, z1 = z1s[slot] as number; cz <= z1; cz++) {
        const list = cells.get(key(cx, cz)) as number[];
        const at = list.indexOf(slot);
        list[at] = list[list.length - 1] as number;
        list.pop();
      }
    }
  };

  const add = (e: Entity): number => {
    const slot = free.pop() ?? ids.length;
    const { x, y, z } = e.pos;
    const r = e.radius;
    ids[slot] = e.id;
    xs[slot] = x;
    ys[slot] = y;
    zs[slot] = z;
    rs[slot] = r;
    met[slot] = 0;
    link(slot, cellOf(x - r), cellOf(x + r), cellOf(z - r), cellOf(z + r));
    return slot;
  };

  const update = (slot: number, e: Entity): void => {
    const { x, y, z } = e.pos;
    const r = e.radius;
    ys[slot] = y;
    if (x === xs[slot] && z === zs[slot] && r === rs[slot]) return;
    xs[slot] = x;
    zs[slot] = z;
    rs[slot] = r;
    const x0 = cellOf(x - r);
    const x1 = cellOf(x + r);
    const z0 = cellOf(z - r);
    const z1 = cellOf(z + r);
    if (x0 === x0s[slot] && x1 === x1s[slot] && z0 === z0s[slot] && z1 === z1s[slot]) return;
    unlink(slot);
    link(slot, x0, x1, z0, z1);
  };

  const remove = (slot: number): void => {
    unlink(slot);
    free.push(slot);
  };

  return {
    rebuild(entities) {
      next.length = 0;
      let i = 0;
      for (const e of entities) {
        while (i < order.length && (ids[order[i] as number] as EntityId) < e.id) remove(order[i++] as number);
        if (i < order.length && ids[order[i] as number] === e.id) {
          const slot = order[i++] as number;
          update(slot, e);
          next.push(slot);
        } else next.push(add(e));
      }
      while (i < order.length) remove(order[i++] as number);
      [order, next] = [next, order];
    },
    query(centre: Vec3, radius: number, out: EntityId[]) {
      out.length = 0;
      queries++;
      const x0 = cellOf(centre.x - radius);
      const x1 = cellOf(centre.x + radius);
      const z0 = cellOf(centre.z - radius);
      const z1 = cellOf(centre.z + radius);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cz = z0; cz <= z1; cz++) {
          const list = cells.get(key(cx, cz));
          if (!list) continue;
          for (const s of list) {
            if (met[s] === queries) continue;
            met[s] = queries;
            const dx = (xs[s] as number) - centre.x;
            const dy = (ys[s] as number) - centre.y;
            const dz = (zs[s] as number) - centre.z;
            const reach = radius + (rs[s] as number);
            if (dx * dx + dy * dy + dz * dz <= reach * reach) out.push(ids[s] as EntityId);
          }
        }
      }
      return out.sort(ascending);
    },
  };
}
