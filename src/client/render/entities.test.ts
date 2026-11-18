import { Group, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { EntityView, SimView } from '../../sim/core/contracts';
import type { Frame, ModelKit } from '../app/contracts';
import { createEntityLayer } from './entities';

const entity = (id: number, x: number, kind: EntityView['kind'] = 'unit'): EntityView => ({
  id, kind, team: 'dawn', type: 'scrapper', pos: { x, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0,
  radius: 0.5, hp: 1, maxHp: 1, shield: 0, flags: 0, mode: null, seenBy: 3,
});
const view = (entities: EntityView[]): SimView => ({ entities } as unknown as SimView);
const frame = (prev: EntityView[], curr: EntityView[], alpha = 1): Frame => ({ prev: view(prev), curr: view(curr), alpha, dt: 0 });

function fakeKit(): ModelKit & { created: number; posed: number } {
  return {
    created: 0,
    posed: 0,
    create() {
      this.created++;
      return new Object3D();
    },
    pose() {
      this.posed++;
    },
  };
}

describe('entity layer', () => {
  it('interpolates, pools models across despawns and fires added/removed', () => {
    const scene = new Group();
    const kit = fakeKit();
    const layer = createEntityLayer(scene, kit);
    const a = entity(1, 0);
    const a2 = entity(1, 10);
    layer.sync(frame([a], [a2], 0.25));
    expect(scene.children).toHaveLength(1);
    const model = scene.children[0]!;
    expect(model.position.x).toBeCloseTo(2.5);
    let removed = 0;
    model.addEventListener('removed', () => removed++);

    layer.sync(frame([a2], []));
    expect(scene.children).toHaveLength(0);
    expect(removed).toBe(1);

    // A new entity of the same kind, type and team reuses the spare model.
    expect(layer.sync(frame([], [entity(2, 5)]))).toBe(false);
    expect(scene.children[0]).toBe(model);
    expect(kit.created).toBe(1);
    expect(kit.posed).toBe(2);
  });

  it('reports structures so the anchor placeholders can hide', () => {
    const layer = createEntityLayer(new Group(), fakeKit());
    expect(layer.sync(frame([], [entity(1, 0, 'structure')]))).toBe(true);
  });
});
