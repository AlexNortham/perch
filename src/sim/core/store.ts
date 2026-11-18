import { SeenBy } from './contracts';
import type { Entity, EntityId, EntityKind, EntityOf, EntityStore, SimEvent } from './contracts';

/** The store plus the core-only flush, run at the end of each tick. */
export interface CoreStore extends EntityStore {
  /** Remove despawned entities and emit `entity.despawned` for each, ascending id. */
  flush(): void;
}

export function createStore(emit: (event: SimEvent) => void): CoreStore {
  const entities = new Map<EntityId, Entity>();
  const pending: EntityId[] = [];
  let nextId = 1;
  let live: Entity[] | null = null;
  const byKind = new Map<EntityKind, Entity[]>();

  const invalidate = (): void => {
    live = null;
    byKind.clear();
  };

  const all = (): readonly Entity[] => {
    if (!live) live = [...entities.values()].filter((e) => !e.removed);
    return live;
  };

  return {
    spawn(init) {
      const entity = { ...init, id: nextId++, removed: false, seenBy: SeenBy.all } as Entity;
      entities.set(entity.id, entity);
      invalidate();
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
      invalidate();
    },
    all,
    list(kind) {
      let list = byKind.get(kind);
      if (!list) {
        list = all().filter((e) => e.kind === kind);
        byKind.set(kind, list);
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
        emit({ type: 'entity.despawned', id, kind: e.kind });
      }
      pending.length = 0;
      invalidate();
    },
  };
}
