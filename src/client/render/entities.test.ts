import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import type { EntityView, SimView } from '../../sim/core/contracts';
import type { Frame, ModelKit } from '../app/contracts';
import { GHOST_OPACITY } from './constants';
import { createEntityLayer } from './entities';

const entity = (id: number, x: number, kind: EntityView['kind'] = 'unit'): EntityView => ({
  id, kind, team: 'dawn', type: 'scrapper', pos: { x, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0,
  radius: 0.5, hp: 1, maxHp: 1, shield: 0, flags: 0, mode: null, seenBy: 3,
});
const view = (entities: EntityView[]): SimView => ({ entities, heroes: [], localHero: null } as unknown as SimView);
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

  it('draws only world-visible enemies, ghosts allied invisible heroes and fades the local hero at the camera', () => {
    const scene = new Group();
    const layer = createEntityLayer(scene, fakeKit());
    const hidden: EntityView = { ...entity(1, 0, 'hero'), team: 'dusk', seenBy: 2 };
    const seen: EntityView = { ...entity(2, 1, 'hero'), team: 'dusk', seenBy: 1 };
    const ghost: EntityView = { ...entity(3, 2, 'hero'), flags: 0x10000 };
    const me: EntityView = { ...entity(4, 3, 'hero'), seenBy: 3 };
    const f = frame([], [hidden, seen, ghost, me]);
    (f.curr as { localHero: number }).localHero = 4;
    (f.curr as { heroes: unknown }).heroes = [{ id: 4, team: 'dawn' }];
    const mat = new MeshBasicMaterial();
    const mesh = new Mesh(new BoxGeometry(), mat);
    const kit = fakeKit();
    kit.create = () => new Group().add(mesh.clone());
    const l2 = createEntityLayer(scene, kit);
    l2.sync(f, { x: 3, y: 1.6, z: 0.5 });
    expect(scene.children).toHaveLength(3); // the hidden enemy is not drawn
    const opacity = (i: number) => ((scene.children[i]?.children[0] as Mesh).material as MeshBasicMaterial).opacity;
    expect(opacity(1)).toBeCloseTo(GHOST_OPACITY);
    expect(opacity(2)).toBeCloseTo(0.5); // camera 0.5 m from the local hero's head
    expect(layer.sync(frame([], []))).toBe(false);
  });

  it('reports structures so the anchor placeholders can hide', () => {
    const layer = createEntityLayer(new Group(), fakeKit());
    expect(layer.sync(frame([], [entity(1, 0, 'structure')]))).toBe(true);
  });
});
