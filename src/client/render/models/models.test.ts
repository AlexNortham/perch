import { Bone, Box3, Group, InstancedMesh, LOD, Mesh, PerspectiveCamera, SkinnedMesh, Vector3 } from 'three';
import type { Matrix4, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { HERO_IDS, ViewFlag } from '../../../sim/core/contracts';
import type { EntityView, HeroId, PlayerTeam, SimView } from '../../../sim/core/contracts';
import { HEROES } from '../../../sim/heroes/registry';
import type { Frame } from '../../app/contracts';
import { BirdRig } from '../rigs/bird-rig';
import { FledglingProxy } from '../rigs/fledgling-rig';
import type { BoneName } from './bird';
import { GUN_CAP } from './constants';
import { STATES } from './debug';
import { BIRD_LOD } from './sculpted';
import { SCULPTED_BUILDS } from './sculpted-birds';
import { fledglingGeometry } from './fledgling';
import { createModelKit } from './index';
import { triangles } from './parts';
import { TEAM_COLOURS } from '../palette';

const OLD: readonly HeroId[] = ['shrike', 'albatross', 'kingfisher', 'lyrebird'];
const TWELVE: readonly HeroId[] = [...OLD, 'owl', 'pelican', 'secretarybird', 'starling', 'hornbill', 'flamingo', 'penguin', 'puffin'];
/** Birds sculpted to the style guide (D-ART-004). */
const SCULPTED = Object.keys(SCULPTED_BUILDS) as HeroId[];
const FOUR: readonly HeroId[] = [...TWELVE, ...SCULPTED];
/** Style guide §11.3: at most three draw calls per bird (opaque body, cut-out feathers, gun). */
const SCULPTED_DRAW_CALLS = 3;
/** Building every sculpted bird at every level takes a few seconds under a parallel run. */
const SLOW_TEST_MS = 30_000;
const HEAD_TOLERANCE = 0.02;
const HERO_TRIANGLES = 1500;
const FLEDGLING_TRIANGLES = 150;
/** One skinned mesh per hero (D-ART-003). */
const HERO_DRAW_CALLS = 1;
const FLEDGLING_DRAW_CALLS = 10;

const entity = (id: number, over: Partial<EntityView> = {}): EntityView => ({
  id, kind: 'hero', team: 'dawn', type: 'shrike', pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0,
  radius: 0.4, hp: 100, maxHp: 100, shield: 0, flags: ViewFlag.Grounded, mode: null, seenBy: 3, ...over,
});
const view = (entities: EntityView[], seconds = 1, heroes: unknown[] = [], localHero: number | null = null): SimView => ({ entities, seconds, localHero, heroes }) as unknown as SimView;
const frameOf = (entities: EntityView[]): Frame => ({ prev: view(entities), curr: view(entities), alpha: 1, dt: 1 / 60 });
const heroEntity = (id: HeroId, team: PlayerTeam = 'dawn'): EntityView => entity(1, { type: id, team });

const slotOf = (m: Object3D): number => (m instanceof FledglingProxy ? m.slot : -2);

function find(root: Object3D, name: BoneName): Bone {
  const b = root.getObjectByName(name);
  if (!(b instanceof Bone)) throw new Error(`no bone ${name}`);
  return b;
}

const rigOf = (model: Object3D): BirdRig => {
  if (!(model instanceof BirdRig)) throw new Error('not a bird rig');
  return model;
};

/** The vertices a bone mostly carries (its rigid part, and skin it owns most of), in that bone's frame at rest. */
function partBox(rig: BirdRig, name: BoneName): Box3 {
  const geo = rig.build.geo;
  const pos = geo.getAttribute('position');
  const bone = geo.getAttribute('skinIndex');
  const weight = geo.getAttribute('skinWeight');
  const { bones, boneInverses } = rig.mesh.skeleton;
  const k = bones.findIndex((b) => b.name === name);
  const box = new Box3();
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    if (bone.getX(i) !== k || weight.getX(i) < 0.5) continue;
    box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(boneInverses[k] as Matrix4));
  }
  return box;
}

/** Every vertex but the gun's where the rig puts it at rest (bones at bind), in the model frame. */
function restBox(rig: BirdRig): Box3 {
  rig.updateWorldMatrix(true, true);
  const { geo } = rig.build;
  const pos = geo.getAttribute('position');
  const bone = geo.getAttribute('skinIndex');
  const { bones, boneInverses } = rig.mesh.skeleton;
  const box = new Box3();
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    const b = bones[bone.getX(i)];
    if (!b || b.name === 'gun' || b.name === 'slide') continue;
    box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(boneInverses[bone.getX(i)] as Matrix4).applyMatrix4(b.matrixWorld));
  }
  return box;
}

describe('hero models', () => {
  const kit = createModelKit();

  it('gives every one of the 24 heroes a skinned model within its draw-call and triangle budgets', () => {
    expect(HERO_IDS).toHaveLength(24);
    for (const id of HERO_IDS) {
      for (const team of ['dawn', 'dusk'] as const) {
        const model = kit.create(heroEntity(id, team));
        expect(model).toBeInstanceOf(BirdRig);
        const build = rigOf(model).build;
        if (build.sculpted) {
          // Every level within the style guide's budget (gun included) and at most three draw calls.
          const levels = [{ geo: build.geo, cards: build.cards ?? null }, ...(build.lods ?? [])];
          expect(levels, id).toHaveLength(BIRD_LOD.budget.length);
          levels.forEach((l, i) => {
            const tris = triangles(l.geo) + (l.cards ? triangles(l.cards) : 0);
            expect(tris, `${id} level ${i}`).toBeLessThanOrEqual(BIRD_LOD.budget[i] ?? 0);
          });
          const lod = model.getObjectByName('birdLod');
          lod?.children.forEach((level) => expect(level.children.length, id).toBeLessThanOrEqual(SCULPTED_DRAW_CALLS));
          for (const m of rigOf(model).meshes) expect(m.skeleton, id).toBe(rigOf(model).mesh.skeleton);
          continue;
        }
        const meshes: Mesh[] = [];
        model.traverse((o) => o instanceof Mesh && meshes.push(o));
        expect(meshes.length, id).toBe(HERO_DRAW_CALLS);
        expect(meshes[0], id).toBeInstanceOf(SkinnedMesh);
        expect(meshes.reduce((n, m) => n + triangles(m.geometry), 0), id).toBeLessThanOrEqual(HERO_TRIANGLES);
      }
    }
  }, SLOW_TEST_MS);

  it('centres each of the four heads on its hitbox sphere, read from the hero data', () => {
    const k = createModelKit();
    for (const id of FOUR) {
      const plan = HEROES[id].def.body;
      const model = k.create(heroEntity(id));
      model.position.set(3, 0.5, -2);
      model.rotation.y = 0.7;
      model.updateWorldMatrix(true, true);
      const world = find(model, 'head').getWorldPosition(new Vector3());
      const c = plan.head.centre;
      const sy = Math.sin(0.7);
      const cy = Math.cos(0.7);
      // core/aim.ts toWorld: forward follows yaw, right is its clockwise perpendicular.
      const want = new Vector3(3 + sy * c.forward - cy * c.right, 0.5 + c.up, -2 + cy * c.forward + sy * c.right);
      expect(world.distanceTo(want), id).toBeLessThan(HEAD_TOLERANCE);
      // The shell is at least as big as the hitbox sphere on every axis.
      const box = partBox(rigOf(model), 'head');
      expect(box.max.x, id).toBeGreaterThanOrEqual(plan.head.radius);
      expect(box.max.y, id).toBeGreaterThanOrEqual(plan.head.radius);
      expect(box.min.y, id).toBeLessThanOrEqual(-plan.head.radius);
    }
  }, SLOW_TEST_MS);

  it('matches the model height to the body plan', () => {
    const k = createModelKit();
    for (const id of FOUR) {
      const plan = HEROES[id].def.body;
      const model = k.create(heroEntity(id));
      let top = 0;
      // Casques, crests and ear tufts rise above the hitbox on the eight new birds, so only their bodies are held to it.
      for (const n of (OLD.includes(id) ? ['body', 'head'] : ['body']) as ('body' | 'head')[]) {
        top = Math.max(top, find(model, n).position.y + partBox(rigOf(model), n).max.y);
      }
      // The head shell may rise a little above the hitbox top; a crest or lyre belongs to other parts.
      expect(top, id).toBeGreaterThanOrEqual(OLD.includes(id) ? plan.height - 0.3 : plan.head.centre.up - plan.head.radius - 0.15);
      expect(top, id).toBeLessThanOrEqual((plan.height) + 0.15);
    }
  }, SLOW_TEST_MS);

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
  }, SLOW_TEST_MS);

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

describe('new birds, melee and practice targets', () => {
  const kit = createModelKit();
  const heroOf = (id: HeroId, over: Partial<EntityView> = {}): EntityView => entity(1, { type: id, ...over });

  it('puts every muzzle on the body plan, and keeps the eight new silhouettes distinct from each other', () => {
    const sizes = new Set<string>();
    for (const id of FOUR) {
      const plan = HEROES[id].def.body;
      const model = kit.create(heroEntity(id));
      model.updateWorldMatrix(true, true);
      const gunPos = find(model, 'gun').getWorldPosition(new Vector3());
      expect(gunPos.distanceTo(new Vector3(-plan.muzzle.right, plan.muzzle.up, plan.muzzle.forward)), id).toBeLessThan(HEAD_TOLERANCE);
      sizes.add(restBox(rigOf(model)).getSize(new Vector3()).toArray().map((v) => v.toFixed(2)).join(','));
    }
    expect(sizes.size, 'no two of the twelve share a bounding box').toBe(FOUR.length);
  });

  it('poses light, heavy, charge and parry differently, then recovers', () => {
    const poseOf = (pose?: EntityView['meleePose']): { lean: number; gunUp: number; across: number; z: number } => {
      const model = kit.create(heroOf('shrike'));
      const e = heroOf('shrike', pose ? { meleePose: pose } : {});
      for (let i = 0; i < 12; i++) kit.pose(model, e, frameOf([e]));
      model.updateWorldMatrix(true, true);
      const rig = model.children[0]?.children[0];
      const gun = find(model, 'gun');
      const barrel = new Vector3(0, 0, 1).transformDirection(gun.matrixWorld);
      return { lean: rig?.rotation.x ?? 0, gunUp: gun.getWorldPosition(new Vector3()).y, across: barrel.x, z: rig?.position.z ?? 0 };
    };
    const idle = poseOf();
    const charge = poseOf('charging');
    const heavy = poseOf('heavy');
    const parry = poseOf('parry');
    expect(charge.lean, 'charge leans back').toBeLessThan(idle.lean);
    expect(charge.gunUp, 'charge raises the gun').toBeGreaterThan(idle.gunUp + 0.05);
    expect(parry.across, 'parry turns the gun across the chest').toBeGreaterThan(idle.across + 0.5);
    expect(Math.abs(heavy.lean - idle.lean) + Math.abs(heavy.z), 'heavy swing moves').toBeGreaterThan(0.05);
    // Lunge, then recovery: a light swing's forward travel peaks and returns to rest once the pose clears.
    const model = kit.create(heroOf('shrike'));
    let peak = 0;
    const swing = heroOf('shrike', { meleePose: 'light' });
    for (let i = 0; i < 30; i++) {
      kit.pose(model, swing, frameOf([swing]));
      peak = Math.max(peak, model.children[0]?.children[0]?.position.z ?? 0);
    }
    const rest = heroOf('shrike');
    for (let i = 0; i < 30; i++) kit.pose(model, rest, frameOf([rest]));
    expect(peak, 'light swing lunges forward').toBeGreaterThan(0.05);
    expect(Math.abs(model.children[0]?.children[0]?.position.z ?? 1)).toBeLessThan(0.001);
  });

  it('gives the Starling a spinning halo of eight birds and the Flamingo a one-leg idle', () => {
    const star = kit.create(heroOf('starling'));
    const halo = star.getObjectByName('halo');
    expect(halo).toBeInstanceOf(Bone);
    expect(rigOf(star).build.ranges.halo[1], 'halo vertices').toBeGreaterThan(0);
    const e = heroOf('starling');
    kit.pose(star, e, { ...frameOf([e]), curr: view([e], 2) });
    expect(Math.abs(halo?.rotation.y ?? 0)).toBeGreaterThan(0);
    const fl = kit.create(heroOf('flamingo'));
    const f = heroOf('flamingo');
    for (let i = 0; i < 30; i++) kit.pose(fl, f, frameOf([f]));
    fl.updateWorldMatrix(true, true);
    const footY = (n: 'footL' | 'footR'): number => find(fl, n).getWorldPosition(new Vector3()).y;
    expect(footY('footR'), 'right foot folded up').toBeGreaterThan(HEROES.flamingo.def.body.height * 0.2);
    expect(footY('footL'), 'left foot on the ground').toBeLessThan(0.05);
  });

  it('marks Practice Hub dummies red (enemy) and teal (ally) on their hitboxes, and removes the mark for others', () => {
    const local = entity(1, { type: 'shrike', team: 'dawn' });
    const ally = entity(2, { type: 'albatross', team: 'dawn' });
    const foe = entity(3, { type: 'lyrebird', team: 'dusk' });
    const heroes = [
      { id: 1, team: 'dawn', controller: 'human' },
      { id: 2, team: 'dawn', controller: 'dummy' },
      { id: 3, team: 'dusk', controller: 'dummy' },
    ];
    const f = (hs: unknown[]): Frame => ({ prev: view([local, ally, foe], 1, hs, 1), curr: view([local, ally, foe], 1, hs, 1), alpha: 1, dt: 1 / 60 });
    const [m1, m2, m3] = [local, ally, foe].map((e) => kit.create(e));
    for (const [m, e] of [[m1, local], [m2, ally], [m3, foe]] as const) if (m) kit.pose(m, e, f(heroes));
    const mark = (m?: Object3D): Mesh | undefined => m?.getObjectByName('dummyMarker') as Mesh | undefined;
    expect(mark(m1)).toBeUndefined();
    expect(mark(m2)?.userData['kind']).toBe('ally');
    expect(mark(m3)?.userData['kind']).toBe('enemy');
    const colour = (m?: Mesh): number => (m?.geometry.getAttribute('color').getX(0) ?? -1);
    expect(colour(mark(m3))).toBeGreaterThan(colour(mark(m2)));
    // The head ring is centred on the real head hitbox.
    const plan = HEROES.lyrebird.def.body;
    const g = mark(m3)?.geometry;
    g?.computeBoundingBox();
    expect(g?.boundingBox?.max.y).toBeGreaterThan(plan.head.centre.up + plan.head.radius);
    const f2 = f([{ id: 1, team: 'dawn', controller: 'human' }, { id: 3, team: 'dusk', controller: 'easy' }]);
    if (m3) kit.pose(m3, foe, f2);
    expect(mark(m3)).toBeUndefined();
  });
});

describe('sculpted birds (D-ART-004)', () => {
  const kit = createModelKit();
  const influences = (rig: BirdRig): number[] => [...(rig.mesh.morphTargetInfluences ?? [])];
  const run = (id: HeroId, over: Partial<EntityView>, frames: number, from = 0): BirdRig => {
    const rig = rigOf(kit.create(heroEntity(id)));
    const e = entity(1, { type: id, ...over });
    for (let i = 0; i < frames; i++) rig.animate(e, 1 / 60, from + i / 60, false);
    return rig;
  };

  it('opens the signature display on a cast, the jaw on a shot, and blinks every few seconds', () => {
    for (const id of SCULPTED) {
      const idle = influences(run(id, {}, 30, 0.5));
      expect(idle[0], `${id} display at rest`).toBeLessThan(0.01);
      const cast = influences(run(id, { flags: ViewFlag.Grounded | ViewFlag.Casting }, 30));
      expect(cast[0], `${id} display while casting`).toBeGreaterThan(0.95);
      const shooting = run(id, { flags: ViewFlag.Grounded | ViewFlag.Firing }, 30);
      let jaw = 0;
      const e = entity(1, { type: id, flags: ViewFlag.Grounded | ViewFlag.Firing });
      for (let i = 0; i < 30; i++) {
        shooting.animate(e, 1 / 60, 1 + i / 60, false);
        jaw = Math.max(jaw, influences(shooting)[1] ?? 0);
      }
      expect(jaw, `${id} jaw on a shot`).toBeGreaterThan(0.3);
      // Over 7 s the eyes close at least once and are open most of the time.
      const rig = rigOf(kit.create(heroEntity(id)));
      const r = entity(1, { type: id });
      let closed = 0;
      let open = 0;
      for (let i = 0; i < 420; i++) {
        rig.animate(r, 1 / 60, i / 60, false);
        if ((influences(rig)[2] ?? 0) > 0.5) closed++;
        else open++;
      }
      expect(closed, `${id} blinks`).toBeGreaterThan(0);
      expect(open, `${id} eyes open`).toBeGreaterThan(closed * 20);
      // Every mesh of the rig carries the same three morph targets, driven together.
      for (const m of rig.meshes) expect(m.morphTargetInfluences, id).toHaveLength(3);
    }
  }, SLOW_TEST_MS);

  it('keeps every sculpted gun within the held-gun cap (G15): at most 0.45 × the height of its bird', () => {
    for (const id of SCULPTED) {
      const rig = rigOf(kit.create(heroEntity(id)));
      const box = partBox(rig, 'gun').union(partBox(rig, 'spin'));
      expect(box.max.z - box.min.z, id).toBeLessThanOrEqual(HEROES[id].def.body.height * GUN_CAP.lengthOfHeight);
    }
  });

  it('switches level of detail by distance from the camera (style guide §11.3)', () => {
    const rig = rigOf(kit.create(heroEntity(SCULPTED[0] ?? 'peacock')));
    const lod = rig.getObjectByName('birdLod');
    expect(lod).toBeInstanceOf(LOD);
    const camera = new PerspectiveCamera(60, 16 / 9, 0.1, 500);
    const shown = (d: number): number => {
      camera.position.set(0, 1.5, d);
      camera.updateMatrixWorld();
      rig.updateMatrixWorld(true);
      // Settle any hysteresis by updating twice.
      (lod as LOD).update(camera);
      (lod as LOD).update(camera);
      return (lod as LOD).getCurrentLevel();
    };
    expect([shown(4), shown(25), shown(60), shown(120), shown(5)]).toEqual([0, 1, 2, 3, 0]);
  });
});
