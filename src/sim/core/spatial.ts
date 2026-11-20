import type { Entity, EntityId, EntityKind, SpatialIndex, Vec3 } from './contracts';

/** The index plus the core-only rebuild, run after the movement phase. */
export interface CoreSpatial extends SpatialIndex {
  rebuild(entities: readonly Entity[]): void;
}

/**
 * Kinds that keep their place once spawned (towers, Nests, Feeders, the Patron). Their cells are written once and
 * rewritten only on a tick whose list of them, or any one's position or radius, differs from the last (D-ARCH-029).
 */
const STILL_KIND: EntityKind = 'structure';

/**
 * Cell coordinates are clamped to ±CELL_LIMIT so a packed key stays a small integer (a V8 Smi, which a Map hashes
 * without boxing). An entity past the limit lands in the edge cell; a query there clamps the same way and the exact
 * sphere test still filters, so far entities are found, only less cheaply.
 */
const CELL_LIMIT = 0x3fff;
const KEY_STRIDE = 0x8000;
const ascending = (a: number, b: number): number => a - b;

/** One cell's entries: indices into the moving arrays (cleared every rebuild) and into the still arrays. */
interface Cell {
  readonly moving: number[];
  readonly still: number[];
}

/** Entry columns: id, centre and radius per index, and the last query that met the entry (dedup across cells). */
interface Columns {
  readonly ids: EntityId[];
  readonly xs: number[];
  readonly ys: number[];
  readonly zs: number[];
  readonly rs: number[];
  readonly met: number[];
}

const columns = (): Columns => ({ ids: [], xs: [], ys: [], zs: [], rs: [], met: [] });

/**
 * Uniform grid on XZ. Each entity is inserted into every cell its sphere touches, so a query only checks the cells
 * its own sphere touches. Arrays are reused between rebuilds to avoid garbage.
 */
export function createSpatialHash(cellSize: number): CoreSpatial {
  const cells = new Map<number, Cell>();
  const movingCells: Cell[] = [];
  const stillCells: Cell[] = [];
  const moving = columns();
  const still = columns();
  /** The still entities this rebuild, and the ones the still cells hold. */
  let stills: Entity[] = [];
  let indexed: Entity[] = [];
  let queries = 0;

  const cellOf = (v: number): number => Math.max(-CELL_LIMIT, Math.min(CELL_LIMIT, Math.floor(v / cellSize)));
  const key = (cx: number, cz: number): number => (cx + CELL_LIMIT) * KEY_STRIDE + (cz + CELL_LIMIT);

  const insert = (e: Entity, into: Columns, which: keyof Cell, touched: Cell[]): void => {
    const i = into.ids.length;
    into.ids.push(e.id);
    into.xs.push(e.pos.x);
    into.ys.push(e.pos.y);
    into.zs.push(e.pos.z);
    into.rs.push(e.radius);
    into.met.push(0);
    const x0 = cellOf(e.pos.x - e.radius);
    const x1 = cellOf(e.pos.x + e.radius);
    const z0 = cellOf(e.pos.z - e.radius);
    const z1 = cellOf(e.pos.z + e.radius);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = key(cx, cz);
        let cell = cells.get(k);
        if (!cell) {
          cell = { moving: [], still: [] };
          cells.set(k, cell);
        }
        const list = cell[which];
        if (list.length === 0) touched.push(cell);
        list.push(i);
      }
    }
  };

  const clear = (from: Columns, which: keyof Cell, touched: Cell[]): void => {
    for (const cell of touched) cell[which].length = 0;
    touched.length = 0;
    from.ids.length = 0;
    from.xs.length = 0;
    from.ys.length = 0;
    from.zs.length = 0;
    from.rs.length = 0;
    from.met.length = 0;
  };

  /** True when `stills` are the indexed entities, in order, each where it was indexed. */
  const stillsUnchanged = (): boolean => {
    if (stills.length !== indexed.length) return false;
    for (let i = 0; i < stills.length; i++) {
      const e = stills[i] as Entity;
      if (e !== indexed[i] || e.pos.x !== still.xs[i] || e.pos.y !== still.ys[i] || e.pos.z !== still.zs[i] ||
        e.radius !== still.rs[i]) return false;
    }
    return true;
  };

  const scan = (list: readonly number[], from: Columns, centre: Vec3, radius: number, out: EntityId[]): void => {
    for (const i of list) {
      if (from.met[i] === queries) continue;
      from.met[i] = queries;
      const dx = (from.xs[i] as number) - centre.x;
      const dy = (from.ys[i] as number) - centre.y;
      const dz = (from.zs[i] as number) - centre.z;
      const reach = radius + (from.rs[i] as number);
      if (dx * dx + dy * dy + dz * dz <= reach * reach) out.push(from.ids[i] as EntityId);
    }
  };

  return {
    rebuild(entities) {
      clear(moving, 'moving', movingCells);
      stills.length = 0;
      for (const e of entities) {
        if (e.kind === STILL_KIND) stills.push(e);
        else insert(e, moving, 'moving', movingCells);
      }
      if (stillsUnchanged()) return;
      clear(still, 'still', stillCells);
      for (const e of stills) insert(e, still, 'still', stillCells);
      [indexed, stills] = [stills, indexed];
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
          const cell = cells.get(key(cx, cz));
          if (!cell) continue;
          scan(cell.moving, moving, centre, radius, out);
          scan(cell.still, still, centre, radius, out);
        }
      }
      return out.sort(ascending);
    },
  };
}
