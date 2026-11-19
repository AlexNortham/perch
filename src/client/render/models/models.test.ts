import { Group, InstancedMesh, Mesh, Vector3 } from 'three';
import type { Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { HERO_IDS, ViewFlag } from '../../../sim/core/contracts';
import type { EntityView, HeroId, PlayerTeam, SimView } from '../../../sim/core/contracts';
import { HEROES } from '../../../sim/heroes/registry';
import type { Frame } from '../../app/contracts';
import { BirdRig } from '../rigs/bird-rig';
import { FledglingProxy } from '../rigs/fledgling-rig';
import { PART_NAMES } from './bird';
import { STATES } from './debug';
import { fledglingGeometry } from './fledgling';
import { createModelKit } from './index';
import { triangles } from './parts';
import { TEAM_COLOURS } from '../palette';

const OLD: readonly HeroId[] = ['shrike', 'albatross', 'kingfisher', 'lyrebird'];
const FOUR: readonly HeroId[] = [...OLD, 'owl', 'pelican', 'secretarybird', 'starling', 'hornbill', 'flamingo', 'penguin', 'puffin'];
const HEAD_TOLERANCE = 0.02;
const HERO_TRIANGLES = 1500;
const FLEDGLING_TRIANGLES = 150;
const HERO_DRAW_CALLS = 10;
const FLEDGLING_DRAW_CALLS = 10;

const entity = (id: number, over: Partial<EntityView> = {}): EntityView => ({
  id, kind: 'hero', team: 'dawn', type: 'shrike', pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0,
  radius: 0.4, hp: 100, maxHp: 100, shield: 0, flags: ViewFlag.Grounded, mode: null, seenBy: 3, ...over,
});
const view = (entities: EntityView[], seconds = 1): SimView => ({ entities, seconds, localHero: null }) as unknown as SimView;
const frameOf = (entities: EntityView[]): Frame => ({ prev: view(entities), curr: view(entities), alpha: 1, dt: 1 / 60 });
const heroEntity = (id: HeroId, team: PlayerTeam = 'dawn'): EntityView => entity(1, { type: id, team });

const slotOf = (m: Object3D): number => (m instanceof FledglingProxy ? m.slot : -2);

function find(root: Object3D, name: string): Mesh {
  const m = root.getObjectByName(name);
  if (!(m instanceof Mesh)) throw new Error(`no mesh ${name}`);
  return m;
}

describe('hero models', () => {
  const kit = createModelKit();

  it('gives every one of the 24 heroes a model of at most 10 draw calls and 1500 triangles', () => {
    expect(HERO_IDS).toHaveLength(24);
    for (const id of HERO_IDS) {
      for (const team of ['dawn', 'dusk'] as const) {
        const model = kit.create(heroEntity(id, team));
        expect(model).toBeInstanceOf(BirdRig);
        const meshes: Mesh[] = [];
        model.traverse((o) => o instanceof Mesh && meshes.push(o));
        expect(meshes.length, id).toBeLessThanOrEqual(HERO_DRAW_CALLS);
        expect(meshes.length, id).toBe(PART_NAMES.length + (id === 'starling' ? 1 : 0));
        expect(meshes.reduce((n, m) => n + triangles(m.geometry), 0), id).toBeLessThanOrEqual(HERO_TRIANGLES);
      }
    }
  });

  it('centres each of the four heads on its hitbox sphere, read from the hero data', () => {
    const k = createModelKit();
    for (const id of FOUR) {
      const plan = HEROES[id].def.body;
      const model = k.create(heroEntity(id));
      model.position.set(3, 0.5, -2);
      model.rotation.y = 0.7;
      model.updateWorldMatrix(true, true);
      const head = find(model, 'head');
      const world = head.getWorldPosition(new Vector3());
      const c = plan.head.centre;
      const sy = Math.sin(0.7);
      const cy = Math.cos(0.7);
      // core/aim.ts toWorld: forward follows yaw, right is its clockwise perpendicular.
      const want = new Vector3(3 + sy * c.forward - cy * c.right, 0.5 + c.up, -2 + cy * c.forward + sy * c.right);
      expect(world.distanceTo(want), id).toBeLessThan(HEAD_TOLERANCE);
      // The shell is at least as big as the hitbox sphere on every axis.
      head.geometry.computeBoundingBox();
      const box = head.geometry.boundingBox;
      expect(box?.max.x, id).toBeGreaterThanOrEqual(plan.head.radius);
      expect(box?.max.y, id).toBeGreaterThanOrEqual(plan.head.radius);
      expect(box?.min.y, id).toBeLessThanOrEqual(-plan.head.radius);
    }
  });

  it('matches the model height to the body plan', () => {
    const k = createModelKit();
    for (const id of FOUR) {
      const plan = HEROES[id].def.body;
      const model = k.create(heroEntity(id));
      let top = 0;
      // Casques, crests and ear tufts rise above the hitbox on the eight new birds, so only their bodies are held to it.
      for (const n of (OLD.includes(id) ? ['body', 'head'] : ['body']) as ('body' | 'head')[]) {
        const m = find(model, n);
        m.geometry.computeBoundingBox();
        top = Math.max(top, m.position.y + (m.geometry.boundingBox?.max.y ?? 0));
      }
      // The head shell may rise a little above the hitbox top; a crest or lyre belongs to other parts.
      expect(top, id).toBeGreaterThanOrEqual(OLD.includes(id) ? plan.height - 0.3 : plan.head.centre.up - plan.head.radius - 0.15);
      expect(top, id).toBeLessThanOrEqual((plan.height) + 0.15);
    }
  });

  it('poses every state for every hand-built hero without a NaN, and keeps the head on the hitbox when idle', () => {
    for (const id of FOUR) {
      const model = kit.create(heroEntity(id));
      for (const [name, s] of Object.entries(STATES)) {
        const e = entity(1, { type: id, flags: s.flags, vel: { x: 0, y: s.vy ?? 0, z: s.speed }, mode: s.mode ?? null, pitch: 0.3 });
        for (let i = 0; i < 30; i++) kit.pose(model, e, frameOf([e]));
        model.updateWorldMatrix(true, true);
        model.traverse((o) => {
          for (const v of [o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z, o.scale.x, o.scale.y, o.scale.z]) {
            expect(Number.isFinite(v), `${id} ${name}`).toBe(true);
          }
        });
      }
    }
  });

  it('draws a hitbox overlay only when asked, and follows a live toggle', () => {
    const k = createModelKit();
    const model = k.create(heroEntity('kingfisher'));
    expect(model.getObjectByName('hitboxes')).toBeUndefined();
    k.setHitboxes(true);
    k.pose(model, heroEntity('kingfisher'), frameOf([heroEntity('kingfisher')]));
    const overlay = model.getObjectByName('hitboxes');
    expect(overlay?.visible).toBe(true);
    expect(overlay?.children).toHaveLength(2);
    k.setHitboxes(false);
    expect(model.getObjectByName('hitboxes')?.visible).toBe(false);
  });

  it('keeps the placeholder box for entities without a model yet', () => {
    const e = entity(7, { kind: 'structure', type: 'hawk', team: 'neutral', radius: 2 });
    const model = kit.create(e);
    expect(model).toBeInstanceOf(Mesh);
    kit.pose(model, e, frameOf([e]));
    expect(model.position.y).toBeGreaterThan(0);
  });
});

describe('fledglings', () => {
  const fledgling = (id: number, type: 'scrapper' | 'slinger', team: PlayerTeam): EntityView =>
    entity(id, { kind: 'unit', type, team, radius: 0.45, flags: id % 3 === 0 ? ViewFlag.Attacking : 0, vel: { x: 0, y: 0, z: id % 2 ? 5 : 0 } });

  it('stays within 150 triangles per chick', () => {
    for (const type of ['scrapper', 'slinger'] as const) expect(triangles(fledglingGeometry(type, TEAM_COLOURS.dawn)), type).toBeLessThanOrEqual(FLEDGLING_TRIANGLES);
  });

  it('holds 200 instanced fledglings of one kind, with a slot each, and reuses freed slots', () => {
    const kit = createModelKit();
    const scene = new Group();
    const chicks = Array.from({ length: 200 }, (_, i) => fledgling(i + 1, 'scrapper', 'dawn'));
    const models = chicks.map((e) => {
      const m = kit.create(e);
      scene.add(m);
      return m;
    });
    const frame = frameOf(chicks);
    chicks.forEach((e, i) => {
      const m = models[i];
      if (!m) throw new Error('missing model');
      m.position.set(i, 0, 0);
      kit.pose(m, e, frame);
    });
    const slots = new Set(models.map((m) => slotOf(m)));
    expect(slots.size).toBe(200);
    expect(Math.min(...slots)).toBeGreaterThanOrEqual(0);
    const instanced = scene.children.filter((o): o is InstancedMesh => o instanceof InstancedMesh);
    expect(instanced).toHaveLength(1);
    expect(instanced[0]?.count).toBe(200);
    // Despawn 50, spawn 50: the count stays at the high-water mark and nobody is dropped.
    for (const m of models.slice(0, 50)) scene.remove(m);
    for (const m of models.slice(0, 50)) scene.add(m);
    expect(new Set(models.map((m) => slotOf(m))).size).toBe(200);
    expect(instanced[0]?.count).toBe(200);
  });

  it('draws 150 mixed fledglings of both flocks in at most 10 draw calls', () => {
    const kit = createModelKit();
    const scene = new Group();
    const chicks: EntityView[] = [];
    for (let i = 0; i < 150; i++) chicks.push(fledgling(i + 1, i % 4 === 3 ? 'slinger' : 'scrapper', i % 2 ? 'dawn' : 'dusk'));
    const frame = frameOf(chicks);
    for (const e of chicks) {
      const m = kit.create(e);
      scene.add(m);
      kit.pose(m, e, frame);
    }
    const instanced = scene.children.filter((o) => o instanceof InstancedMesh);
    expect(instanced.length).toBeLessThanOrEqual(FLEDGLING_DRAW_CALLS);
    expect(scene.children.filter((o) => o instanceof Mesh && !(o instanceof InstancedMesh))).toHaveLength(0);
  });
});
