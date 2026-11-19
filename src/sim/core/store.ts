import { SeenBy } from './contracts';
import type { Entity, EntityId, EntityKind, EntityOf, EntityStore, SimEvent } from './contracts';

/** The store plus the core-only flush, run at the end of each tick. */
export interface CoreStore extends EntityStore {
  /** Remove despawned entities and emit `entity.despawned` for each, ascending id. */
  flush(): void;
}

/**
 * Entities by id plus one array per kind in spawn (= id) order. `all()` and `list(kind)` hand out snapshots built
 * lazily; a spawn or despawn drops only its own kind's snapshot (and `all`), so spawning a projectile mid-tick never
 * rebuilds the unit list.
 */
export function createStore(emit: (event: SimEvent) => void): CoreStore {
  const entities = new Map<EntityId, Entity>();
  const pending: EntityId[] = [];
  let nextId = 1;
  let live: Entity[] | null = null;
  /** Every entity of a kind still in the store (despawned ones until the flush), ascending id. */
  const members = new Map<EntityKind, Entity[]>();
  const snapshots = new Map<EntityKind, Entity[]>();
  const touched = new Set<EntityKind>();

  const changed = (kind: EntityKind): void => {
    live = null;
    snapshots.delete(kind);
  };

  const all = (): readonly Entity[] => {
    live ??= [...entities.values()].filter((e) => !e.removed);
    return live;
  };

  return {
    spawn(init) {
      const entity = { ...init, id: nextId++, removed: false, seenBy: SeenBy.all } as Entity;
      entities.set(entity.id, entity);
      let list = members.get(entity.kind);
      if (!list) {
        list = [];
        members.set(entity.kind, list);
      }
      list.push(entity);
      changed(entity.kind);
      emit({ type: 'entity.spawned', id: entity.id, kind: entity.kind, team: entity.team });
      return entity as EntityOf<typeof init.kind>;
    },
    get: (id) => entities.get(id),
    getKind(id, kind) {
      const e = entities.get(id);
      return e && e.kind === kind ? (e as EntityOf<typeof kind>) : undefined;
    },
    despawn(id) {
      const e = entities.get(id);
      if (!e || e.removed) return;
      e.removed = true;
      pending.push(id);
      changed(e.kind);
    },
    all,
    list(kind) {
      let list = snapshots.get(kind);
      if (!list) {
        list = (members.get(kind) ?? []).filter((e) => !e.removed);
        snapshots.set(kind, list);
      }
      return list as EntityOf<typeof kind>[];
    },
    flush() {
      if (pending.length === 0) return;
      pending.sort((a, b) => a - b);
      for (const id of pending) {
        const e = entities.get(id);
        if (!e) continue;
        entities.delete(id);
        touched.add(e.kind);
        emit({ type: 'entity.despawned', id, kind: e.kind });
      }
      pending.length = 0;
      // Snapshots already exclude removed entities, so only the member arrays need compacting.
      for (const kind of touched) {
        const list = members.get(kind) ?? [];
        let n = 0;
        for (const e of list) if (!e.removed) list[n++] = e;
        list.length = n;
      }
      touched.clear();
    },
  };
}
