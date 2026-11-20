// Held guns and planted feet (D-EP-035): for every playable bird and the generic placeholder, in every animation
// state, sampled through a whole cycle, the wings hold the gun's grips, the gun's muzzle is where the sim fires
// from while aiming, grounded feet are on the ground, and every part hangs from the rig.
import { Bone, Mesh, Vector3 } from 'three';
import type { Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { ViewFlag } from '../../src/sim/core/contracts';
import type { EntityView, HeroId } from '../../src/sim/core/contracts';
import { muzzlePoint } from '../../src/sim/core/aim';
import { HEROES } from '../../src/sim/heroes/registry';
import { applyState, STATES } from '../../src/client/render/models/debug';
import { createModelKit } from '../../src/client/render/models/index';
import { BirdRig } from '../../src/client/render/rigs/bird-rig';
import { PLANTED, PLAYABLE, SHEET_STATES } from './states';

const GRIP_TOLERANCE = 0.02;
const MUZZLE_TOLERANCE = 0.03;
const FOOT_TOLERANCE = 0.03;
const DT = 1 / 60;
const SETTLE = 1.5;
/** Sampled every 0.05 s over 1.6 s: two melee repeats' worth, several step cycles. */
const SAMPLE_EVERY = 3;
const SAMPLE_FOR = 1.6;
const GENERIC: HeroId = 'frigatebird';
const BIRDS: readonly HeroId[] = [...PLAYABLE, GENERIC];
const FREE_WING = new Set(['raise', 'throw', 'sweep', 'stomp']);
const ROOT = { pos: { x: 3, y: 0.5, z: -2 }, yaw: 0.7 };

const kit = createModelKit();
type Stand = EntityView & { vel: { x: number; y: number; z: number } };
const stand = (id: HeroId): Stand =>
  ({ id: 1, kind: 'hero', team: 'dawn', type: id, pos: { ...ROOT.pos }, vel: { x: 0, y: 0, z: 0 }, yaw: ROOT.yaw, pitch: 0, radius: 0.4, hp: 100, maxHp: 100, shield: 0, flags: ViewFlag.Grounded, mode: null, seenBy: 3 }) as Stand;

const rigOf = (id: HeroId): BirdRig => {
  const rig = kit.create(stand(id));
  if (!(rig instanceof BirdRig)) throw new Error(`${id}: not a bird rig`);
  rig.position.set(ROOT.pos.x, ROOT.pos.y, ROOT.pos.z);
  rig.rotation.y = ROOT.yaw;
  return rig;
};

const world = (o: Object3D, x: number, y: number, z: number): Vector3 => new Vector3(x, y, z).applyMatrix4(o.matrixWorld);

interface Sockets {
  handR: Vector3;
  handL: Vector3;
  main: Vector3;
  support: Vector3;
  muzzle: Vector3;
  soles: [number, number];
}

function sockets(rig: BirdRig): Sockets {
  rig.updateWorldMatrix(true, true);
  const { bones: b, build } = rig;
  const tip = -build.wing.lower;
  const sole = (foot: Bone): number => world(foot, 0, -build.leg.ankle, 0).y - ROOT.pos.y;
  return {
    handR: world(b.wingR2, 0, tip, 0),
    handL: world(b.wingL2, 0, tip, 0),
    main: build.grip.main.clone().applyMatrix4(b.gun.matrixWorld),
    support: build.grip.support.clone().applyMatrix4(b.slide.matrixWorld),
    muzzle: world(b.gun, 0, 0, 0),
    soles: [sole(b.footL), sole(b.footR)],
  };
}

/** Run a fresh rig through a state, calling `check` every SAMPLE_EVERY frames after it settles. */
function play(id: HeroId, state: string, check: (s: Sockets, t: number, grounded: boolean) => void): void {
  const pose = STATES[state];
  if (!pose) throw new Error(`no state ${state}`);
  const rig = rigOf(id);
  const e = stand(id);
  const frames = Math.round((SETTLE + SAMPLE_FOR) / DT);
  for (let i = 0; i <= frames; i++) {
    const t = i * DT;
    const { hit, castSlot } = applyState(e as never, pose, t, DT);
    rig.animate(e, DT, t, hit, castSlot);
    if (t >= SETTLE && i % SAMPLE_EVERY === 0) check(sockets(rig), t, (e.flags & ViewFlag.Grounded) !== 0);
  }
}

describe('held guns (D-EP-035)', () => {
  for (const id of BIRDS) {
    it(`${id}: both wings hold the gun's grips in every state`, () => {
      const casts = rigOf(id).build.casts;
      for (const state of SHEET_STATES) {
        const slot = STATES[state]?.castSlot;
        const supportFree = slot !== undefined && FREE_WING.has(casts[slot] ?? '');
        let worst = 0;
        let worstSupport = 0;
        play(id, state, (s) => {
          worst = Math.max(worst, s.handR.distanceTo(s.main));
          if (!supportFree) worstSupport = Math.max(worstSupport, s.handL.distanceTo(s.support));
        });
        expect(worst, `${id} ${state}: trigger wing to main grip (m)`).toBeLessThan(GRIP_TOLERANCE);
        expect(worstSupport, `${id} ${state}: support wing to fore-end (m)`).toBeLessThan(GRIP_TOLERANCE);
      }
    });

    it(`${id}: the muzzle is the sim's muzzle point in the aim pose, at every pitch, standing and crouched`, () => {
      const plan = HEROES[id].def.body;
      for (const crouching of [false, true]) {
        for (const pitch of [-0.6, -0.3, 0, 0.3, 0.6]) {
          const rig = rigOf(id);
          const e: EntityView = { ...stand(id), flags: ViewFlag.Grounded | (crouching ? ViewFlag.Crouching : 0), pitch };
          const want = muzzlePoint(ROOT.pos, ROOT.yaw, plan, crouching);
          let worst = 0;
          for (let i = 0; i <= (SETTLE + SAMPLE_FOR) / DT; i++) {
            rig.animate(e, DT, i * DT, false);
            if (i * DT >= SETTLE) worst = Math.max(worst, sockets(rig).muzzle.distanceTo(new Vector3(want.x, want.y, want.z)));
          }
          expect(worst, `${id} pitch ${pitch}${crouching ? ' crouched' : ''}: muzzle to sim muzzle (m)`).toBeLessThan(MUZZLE_TOLERANCE);
        }
      }
    });

    it(`${id}: grounded feet stay on the ground`, () => {
      const rig = rigOf(id);
      for (const state of PLANTED) {
        const pose = STATES[state];
        const stomp = pose?.castSlot !== undefined && rig.build.casts[pose.castSlot] === 'stomp';
        // A foot may lift in a stride, a stomp, or the Flamingo's one-legged stand; the other stays down.
        const lifts = state === 'run' || state === 'sprint' || stomp || (rig.build.idleLeg !== undefined && (pose?.speed ?? 0) === 0);
        let worst = 0;
        let below = 0;
        play(id, state, (s, _t, grounded) => {
          if (!grounded) return;
          const [a, b] = s.soles;
          worst = Math.max(worst, lifts ? Math.min(Math.abs(a), Math.abs(b)) : Math.max(Math.abs(a), Math.abs(b)));
          below = Math.min(below, a, b);
        });
        expect(worst, `${id} ${state}: ${lifts ? 'planted foot' : 'feet'} off the ground (m)`).toBeLessThan(FOOT_TOLERANCE);
        expect(below, `${id} ${state}: a foot through the ground (m)`).toBeGreaterThan(-FOOT_TOLERANCE);
      }
    });

    it(`${id}: every mesh and bone descends from the rig root, and every vertex follows a bone of the rig`, () => {
      const rig = rigOf(id);
      const inRig = (o: Object3D): boolean => {
        for (let p: Object3D | null = o; p; p = p.parent) if (p === rig) return true;
        return false;
      };
      const meshes: Mesh[] = [];
      rig.traverse((o) => o instanceof Mesh && meshes.push(o));
      expect(meshes.length).toBeGreaterThan(0);
      for (const m of meshes) expect(inRig(m), `${id} ${m.name}`).toBe(true);
      const bones = rig.mesh.skeleton.bones;
      for (const b of bones) expect(inRig(b), `${id} bone ${b.name}`).toBe(true);
      const index = rig.mesh.geometry.getAttribute('skinIndex');
      const weight = rig.mesh.geometry.getAttribute('skinWeight');
      for (let v = 0; v < index.count; v++) {
        expect(index.getX(v)).toBeLessThan(bones.length);
        expect(weight.getX(v)).toBe(1);
      }
    });
  }
});
