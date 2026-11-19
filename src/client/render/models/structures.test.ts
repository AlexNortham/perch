import { Box3, Matrix4, Mesh, Object3D, Vector3 } from 'three';
import type { InstancedMesh } from 'three';
import { describe, expect, it } from 'vitest';
import { ViewFlag } from '../../../sim/core/contracts';
import type { EntityView, SimView, StructureInfo, StructureType } from '../../../sim/core/contracts';
import { STRUCTURE_RADIUS } from '../../../sim/data/world';
import { loadMap } from '../../../sim/world/map';
import type { Frame } from '../../app/contracts';
import { StructureRig } from '../rigs/structure-rig';
import { STRUCTURE } from './constants';
import { createModelKit } from './index';

const TYPES = ['hawk', 'heron', 'warden', 'shrine', 'patron'] as const;
const TOWERS = ['hawk', 'heron', 'warden', 'shrine'] as const;
const UPDRAFT_Y = 12;
const matrix = new Matrix4();

const info = (type: StructureType, over: Partial<StructureInfo> = {}): StructureInfo => ({
  type, lane: null, phase: 1, target: null, weakPoint: null,
  body: { radius: STRUCTURE_RADIUS[type === 'nest' ? 'shrine' : type], height: 10 }, ...over,
});
const structure = (type: StructureType, team: 'dawn' | 'dusk', over: Partial<StructureInfo> = {}, e: Partial<EntityView> = {}): EntityView => ({
  id: 5, kind: 'structure', team, type, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0,
  radius: 2, hp: 1000, maxHp: 1000, shield: 0, flags: ViewFlag.Grounded, mode: null, seenBy: 3, structure: info(type, over), ...e,
});
const view = (tick: number): SimView => ({ tick, seconds: tick / 60, entities: [], heroes: [], localHero: null }) as unknown as SimView;
const frame = (tick = 0): Frame => ({ prev: view(tick), curr: view(tick), alpha: 1, dt: 1 / 60 });

const height = (m: Object3D): number => {
  m.updateWorldMatrix(true, true);
  const box = new Box3();
  m.traverse((o) => {
    if (!(o instanceof Mesh) || o.name === 'broodWardDomes') return;
    o.geometry.computeBoundingBox();
    if (o.geometry.boundingBox) box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
  });
  return box.max.y;
};

describe('structure models', () => {
  const kit = createModelKit();

  it('gives every structure type a rig for both flocks, with one draw call (two for a Patron with its heart-feather)', () => {
    for (const type of TYPES) {
      for (const team of ['dawn', 'dusk'] as const) {
        const model = kit.create(structure(type, team));
        expect(model, type).toBeInstanceOf(StructureRig);
        let meshes = 0;
        model.traverse((o) => o instanceof Mesh && meshes++);
        expect(meshes, type).toBe(type === 'patron' ? 2 : 1);
      }
    }
  });

  it('keeps every tower at or below 10 m, even with the Heron mid-stomp', () => {
    for (const type of TOWERS) {
      const model = kit.create(structure(type, 'dawn'));
      for (let i = 0; i < 120; i++) kit.pose(model, structure(type, 'dawn', { target: 9 }), frame(i));
      expect(height(model), type).toBeLessThanOrEqual(STRUCTURE.towerMaxHeight);
      expect(height(model), type).toBeGreaterThan(4);
    }
  });

  it('leaves the 12 m Updraft clear above every tower at the real map anchors', () => {
    const map = loadMap('main');
    for (const s of map.structures) {
      if (s.type === 'patron') continue;
      const model = kit.create(structure(s.type, s.team));
      model.position.set(s.pos.x, s.pos.y, s.pos.z);
      expect(height(model), `${s.team} ${s.type}`).toBeLessThan(UPDRAFT_Y);
    }
  });

  it('keeps both Patrons off every Updraft line footprint', () => {
    const map = loadMap('main');
    for (const s of map.structures.filter((a) => a.type === 'patron')) {
      for (const u of map.updrafts) {
        for (const p of u.points) expect(Math.hypot(p.x - s.pos.x, p.z - s.pos.z)).toBeGreaterThan(STRUCTURE_RADIUS.patron);
      }
    }
  });

  it('shows the heart-feather from the transition on, at the world weak point in phase two', () => {
    const model = kit.create(structure('patron', 'dusk'));
    const meshes = (): Mesh[] => (model.children[0]?.children ?? []).filter((c): c is Mesh => c instanceof Mesh);
    const feather = (): Mesh | undefined => meshes()[meshes().length - 1];
    kit.pose(model, structure('patron', 'dusk'), frame());
    expect(feather()?.visible, 'phase one hides the feather').toBe(false);
    kit.pose(model, structure('patron', 'dusk', { transitionUntil: 500 }), frame(100));
    expect(feather()?.visible, 'the transition shows it').toBe(true);
    const e = structure('patron', 'dusk', { phase: 2, weakPoint: { centre: { x: 3, y: 9, z: 4 }, radius: 1 } });
    kit.pose(model, e, frame(600));
    expect(feather()?.visible).toBe(true);
    expect(Math.abs((feather()?.position.y ?? 0) - 9 / STRUCTURE.phase2Scale)).toBeLessThan(0.2);
    expect(Math.abs((feather()?.position.x ?? 0) - 3 / STRUCTURE.phase2Scale)).toBeLessThan(0.1);
  });

  it('takes a dome slot on add, hides it when the ward breaks, and frees it on removal', () => {
    const model = kit.create(structure('hawk', 'dawn'));
    const parent = new Object3D();
    parent.add(model);
    kit.pose(model, structure('hawk', 'dawn', { broodWard: true }), frame());
    const dome = parent.getObjectByName('broodWardDomes') as InstancedMesh;
    expect(dome, 'the shared dome mesh joins the scene').toBeDefined();
    const scaleAt = (): number => {
      dome.getMatrixAt(0, matrix);
      return new Vector3().setFromMatrixScale(matrix).x;
    };
    expect(scaleAt(), 'dome up').toBeGreaterThan(1);
    for (let i = 0; i < 90; i++) kit.pose(model, structure('hawk', 'dawn', { broodWard: false }), frame(i));
    expect(scaleAt(), 'dome cracked away').toBe(0);
    parent.remove(model);
    expect(scaleAt(), 'slot freed on removal').toBe(0);
  });
});
