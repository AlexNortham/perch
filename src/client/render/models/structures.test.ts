import { Box3, Group, LOD, Matrix4, Mesh, Object3D, Vector3 } from 'three';
import type { BufferGeometry, InstancedMesh } from 'three';
import { describe, expect, it } from 'vitest';
import { ViewFlag } from '../../../sim/core/contracts';
import type { EntityView, SimView, StructureInfo, StructureType } from '../../../sim/core/contracts';
import { STRUCTURE_RADIUS } from '../../../sim/data/world';
import { loadMap } from '../../../sim/world/map';
import type { Frame } from '../../app/contracts';
import { TEAM_COLOURS } from '../palette';
import { Ruin, StructureRig, STRUCTURE_GLOW } from '../rigs/structure-rig';
import { STRUCTURE } from './constants';
import { createModelKit } from './index';
import { buildStructure } from './structures';
import type { Lod } from './structures';

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
const view = (tick: number, entities: readonly EntityView[] = []): SimView => ({ tick, seconds: tick / 60, entities, heroes: [], localHero: null }) as unknown as SimView;
const frame = (tick = 0, entities: readonly EntityView[] = []): Frame => ({ prev: view(tick, entities), curr: view(tick, entities), alpha: 1, dt: 1 / 60 });
const tris = (g: BufferGeometry): number => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

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
const lodOf = (model: Object3D): LOD => {
  let lod: LOD | null = null;
  model.traverse((o) => {
    if (o instanceof LOD) lod = o;
  });
  if (!lod) throw new Error('no LOD');
  return lod;
};

describe('structure models (style guide §9, D-ART-014)', () => {
  const kit = createModelKit();

  it('gives every structure type a rig for both flocks: three levels of detail of two draw calls (three with the Shrine rings)', () => {
    for (const type of TYPES) {
      for (const team of ['dawn', 'dusk'] as const) {
        const model = kit.create(structure(type, team));
        expect(model, type).toBeInstanceOf(StructureRig);
        const lod = lodOf(model);
        expect(lod.levels.map((l) => l.distance), type).toEqual([0, 40, 90]);
        for (const level of lod.levels) {
          let meshes = 0;
          level.object.traverse((o) => o instanceof Mesh && meshes++);
          expect(meshes, `${team} ${type}`).toBe(type === 'shrine' ? 3 : 2);
        }
      }
    }
  });

  it('keeps each structure within its §9.1 triangle budget, 40 % of it from 40 m and 15 % from 90 m', () => {
    const budget: Record<(typeof TYPES)[number], readonly [number, number]> = {
      hawk: [12_000, 18_000], heron: [12_000, 18_000], warden: [8_000, 12_000], shrine: [8_000, 12_000], patron: [30_000, 45_000],
    };
    for (const type of TYPES) {
      for (const team of ['dawn', 'dusk'] as const) {
        const b = buildStructure(type, team, TEAM_COLOURS[team], { radius: STRUCTURE_RADIUS[type], height: 10 });
        const level = (l: Lod): number => tris(b.arch(l, 0)) + tris(b.statue(l, 0)) + (b.rings ? tris(b.rings(l)) : 0);
        const full = level(0);
        expect(full, `${team} ${type} LOD0`).toBeGreaterThanOrEqual(budget[type][0]);
        expect(full, `${team} ${type} LOD0`).toBeLessThanOrEqual(budget[type][1]);
        // A level's share: within 2 points of the guide's 40 % and 15 %.
        expect(level(1) / full, `${team} ${type} LOD1`).toBeLessThanOrEqual(0.42);
        expect(level(2) / full, `${team} ${type} LOD2`).toBeLessThanOrEqual(0.17);
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

  it('cracks the architecture below 66 % and 33 % HP', () => {
    const model = kit.create(structure('hawk', 'dawn')) as StructureRig;
    const arch = (): BufferGeometry => (lodOf(model).levels[0]?.object.children[0] as Mesh).geometry;
    kit.pose(model, structure('hawk', 'dawn'), frame());
    const whole = arch();
    kit.pose(model, structure('hawk', 'dawn', {}, { hp: 600 }), frame(1));
    const cracked = arch();
    kit.pose(model, structure('hawk', 'dawn', {}, { hp: 300 }), frame(2));
    const broken = arch();
    expect(cracked).not.toBe(whole);
    expect(broken).not.toBe(cracked);
    expect(tris(broken)).toBeGreaterThan(tris(whole));
  });

  it('glows at 30 % while idle and eases to full while it has a target', () => {
    const model = kit.create(structure('warden', 'dusk')) as StructureRig;
    const glow = (): number => model.glowLevel;
    kit.pose(model, structure('warden', 'dusk'), frame());
    expect(glow()).toBeCloseTo(STRUCTURE_GLOW.idle, 2);
    for (let i = 0; i < 120; i++) kit.pose(model, structure('warden', 'dusk', { target: 3 }), frame(i));
    expect(glow()).toBeGreaterThan(0.95);
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

  it('takes a dome slot on add, shatters it when the ward breaks, and frees it on removal', () => {
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
    expect(scaleAt(), 'dome shattered away').toBe(0);
    parent.remove(model);
    expect(scaleAt(), 'slot freed on removal').toBe(0);
  });

  it('leaves a ruin where a structure dies, which stays for the match and clears for the next', () => {
    const k = createModelKit();
    const scene = new Group();
    const hawk = structure('hawk', 'dusk', {}, { id: 40, pos: { x: 7, y: 0, z: -3 } });
    const other = structure('shrine', 'dawn', {}, { id: 41 });
    const model = k.create(hawk);
    const keep = k.create(other);
    scene.add(model, keep);
    model.position.set(7, 0, -3);
    k.pose(model, hawk, frame(1, [hawk, other]));
    k.pose(keep, other, frame(1, [hawk, other]));
    // The Hawk dies: it leaves the view; the next pose of anything finds it gone.
    for (let t = 2; t < 200; t++) k.pose(keep, other, frame(t, [other]));
    const ruins = scene.children.filter((c): c is Ruin => c instanceof Ruin);
    expect(ruins).toHaveLength(1);
    expect(ruins[0]?.position.x).toBeCloseTo(7);
    // A new match (the tick runs back) clears it.
    k.pose(keep, other, frame(0, [other]));
    expect(scene.children.some((c) => c instanceof Ruin)).toBe(false);
  });
});
