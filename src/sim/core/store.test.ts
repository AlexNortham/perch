import { describe, expect, it } from 'vitest';
import type { EntityInit, SimEvent } from './contracts';
import { createStore } from './store';

const pod = (): Extract<EntityInit, { kind: 'pickup' }> => ({
  kind: 'pickup',
  team: 'neutral',
  pos: { x: 0, y: 0, z: 0 },
  vel: { x: 0, y: 0, z: 0 },
  yaw: 0,
  radius: 0.5,
  pickup: { type: 'pod', variant: '', value: 10, expiresAt: null, carrier: null },
});

describe('entity store', () => {
  it('assigns ascending ids, lists by kind, emits spawn and despawn', () => {
    const events: SimEvent[] = [];
    const store = createStore((e) => events.push(e));
    const a = store.spawn(pod());
    const b = store.spawn(pod());
    expect([a.id, b.id]).toEqual([1, 2]);
    expect(store.list('pickup').map((e) => e.id)).toEqual([1, 2]);
    expect(store.getKind(1, 'hero')).toBeUndefined();

    const snapshot = store.all();
    store.despawn(1);
    expect(snapshot.length).toBe(2);
    expect(store.all().map((e) => e.id)).toEqual([2]);
    expect(store.get(1)?.removed).toBe(true);
    store.flush();
    expect(store.get(1)).toBeUndefined();
    expect(store.spawn(pod()).id).toBe(3);
    expect(events.map((e) => e.type)).toEqual([
      'entity.spawned',
      'entity.spawned',
      'entity.despawned',
      'entity.spawned',
    ]);
  });
});
