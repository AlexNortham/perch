/**
 * A structure's model: merged static geometry, a small glow mesh (eyes, crystals; unlit, bright while the structure
 * has a target), Heron legs that step and stomp, and for the Patron a heart-feather and a phase look. The Brood Ward
 * dome is an instanced eggshell shared by every structure (one draw call in all); when the ward breaks the dome
 * swells and vanishes. Everything is read from EntityView.structure: phase, transitionUntil, broodWard, target,
 * weakPoint. Nothing here allocates per frame.
 */
import { Euler, Group, InstancedMesh, Matrix4, Mesh, Quaternion, SphereGeometry, Vector3 } from 'three';
import type { Material } from 'three';
import type { EntityView, SimView } from '../../../sim/core/contracts';
import type { StructureBuild } from '../models/structures';
import { STRUCTURE as S } from '../models/constants';

const DOME_SEGMENTS: readonly [number, number] = [S.domeSegments, S.domeSegments / 2];
const hidden = new Matrix4().makeScale(0, 0, 0);
const matrix = new Matrix4();
const quat = new Quaternion();
const size = new Vector3();
const eulerNone = new Euler();

/** The shared instanced Brood Ward domes. */
export class DomeGroup {
  readonly mesh: InstancedMesh;
  private readonly freed: number[] = [];
  private next = 0;

  constructor(material: Material, readonly capacity = S.domeCapacity) {
    this.mesh = new InstancedMesh(new SphereGeometry(1, DOME_SEGMENTS[0], DOME_SEGMENTS[1]), material, capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'broodWardDomes';
    this.mesh.renderOrder = 5;
  }

  take(): number {
    const slot = this.freed.pop() ?? (this.next < this.capacity ? this.next++ : -1);
    this.mesh.count = this.next;
    return slot;
  }

  set(slot: number, at: Vector3, radius: number): void {
    if (slot < 0) return;
    quat.setFromEuler(eulerNone);
    this.mesh.setMatrixAt(slot, matrix.compose(at, quat, size.set(radius, radius * S.domeSquash, radius)));
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  release(slot: number): void {
    if (slot < 0) return;
    this.mesh.setMatrixAt(slot, hidden);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.freed.push(slot);
  }
}

export interface StructureMaterials {
  readonly lit: Material;
  readonly glowOn: Material;
  readonly glowOff: Material;
  readonly glowRaged: Material;
  readonly heart: Material;
}

export class StructureRig extends Group {
  private readonly inner = new Group();
  private readonly glow: Mesh;
  private readonly legs: Mesh[] = [];
  private readonly heart: Mesh | null = null;
  private slot = -1;
  /** Ward bookkeeping: whether the dome is up, and seconds since it broke (null while it stands). */
  private ward = false;
  private crack = -1;
  private readonly wardAt = new Vector3();

  constructor(private readonly build: StructureBuild, private readonly mat: StructureMaterials, private readonly domes: DomeGroup) {
    super();
    this.add(this.inner);
    const main = new Mesh(build.main, mat.lit);
    main.castShadow = true;
    this.glow = new Mesh(build.glow, mat.glowOff);
    this.inner.add(main, this.glow);
    if (build.legs && build.legPivot) {
      for (const s of [1, -1]) {
        const leg = new Mesh(build.legs, mat.lit);
        leg.castShadow = true;
        leg.position.set(s * build.legPivot[0], build.legPivot[1], build.legPivot[2]);
        this.legs.push(leg);
        this.inner.add(leg);
      }
    }
    if (build.heart) {
      this.heart = new Mesh(build.heart, mat.heart);
      this.heart.visible = false;
      this.inner.add(this.heart);
    }
    this.addEventListener('added', () => {
      this.slot = domes.take();
      if (!domes.mesh.parent && this.parent) this.parent.add(domes.mesh);
      this.ward = false;
      this.crack = -1;
    });
    this.addEventListener('removed', () => {
      domes.release(this.slot);
      this.slot = -1;
    });
  }

  animate(e: EntityView, dt: number, t: number, view: SimView): void {
    const info = e.structure;
    const b = this.build;
    const hasTarget = (info?.target ?? null) !== null;
    const patron = e.type === 'patron';
    const transition = patron && info?.transitionUntil !== undefined && info.transitionUntil > view.tick;
    const phase2 = patron && info?.phase === 2;
    const dead = e.hp <= 0 && e.maxHp > 0;

    this.glow.material = phase2 || transition ? this.mat.glowRaged : hasTarget ? this.mat.glowOn : this.mat.glowOff;

    // Heron legs: stomp while it has a target, otherwise a slow step in place.
    if (this.legs.length === 2) {
      const [a, c] = this.legs as [Mesh, Mesh];
      const rate = hasTarget ? S.stompRate : S.stepRate;
      const lift = hasTarget ? S.stompLift : S.stepLift;
      a.rotation.x = -Math.max(0, Math.sin(t * rate)) * lift;
      c.rotation.x = -Math.max(0, Math.sin(t * rate + Math.PI)) * lift;
    }

    // Patron: breathes, shakes through the transition, a little larger and angrier in phase 2; heart-feather shows
    // from the transition on, at the world weak point once it exists.
    let shakeX = 0;
    let shakeZ = 0;
    if (transition) {
      shakeX = Math.sin(t * S.shakeRate) * S.shakeAmp;
      shakeZ = Math.cos(t * S.shakeRate * S.shakeRatio) * S.shakeAmp;
    }
    const scale = (phase2 ? S.phase2Scale : 1) * (1 + (patron ? Math.sin(t * S.pulseRate) * S.breathe : 0));
    this.inner.position.set(shakeX, 0, shakeZ);
    this.inner.scale.setScalar(scale);
    this.inner.visible = !dead;
    if (this.heart) {
      this.heart.visible = phase2 || transition;
      const wp = info?.weakPoint ?? null;
      if (wp) {
        const dx = wp.centre.x - e.pos.x;
        const dz = wp.centre.z - e.pos.z;
        const c = Math.cos(e.yaw);
        const s = Math.sin(e.yaw);
        this.heart.position.set((dx * c - dz * s) / scale, (wp.centre.y - e.pos.y) / scale, (dx * s + dz * c) / scale);
        this.heart.scale.setScalar(wp.radius / scale);
      } else {
        this.heart.position.set(0, S.patronHeartUp, S.patronHeartForward);
        this.heart.scale.setScalar(1);
      }
      const flash = transition ? S.flashMin + (1 - S.flashMin) * Math.sin(t * S.shakeRate * S.flashRatio) : 1;
      this.heart.scale.multiplyScalar(flash);
      this.heart.rotation.y = t * S.heartSpin;
    }

    // Brood Ward dome: up while info.broodWard; when it breaks it swells and vanishes.
    const up = (info?.broodWard ?? false) && !dead;
    if (up) {
      this.ward = true;
      this.crack = -1;
    } else if (this.ward) {
      this.ward = false;
      this.crack = 0;
    }
    let radius = 0;
    if (this.ward) radius = b.dome.radius;
    else if (this.crack >= 0) {
      this.crack += dt;
      const u = this.crack / S.crackTime;
      radius = u >= 1 ? 0 : b.dome.radius * (1 + S.crackGrow * u);
      if (u >= 1) this.crack = -1;
    }
    this.wardAt.set(this.position.x, this.position.y + b.dome.y, this.position.z);
    this.domes.set(this.slot, this.wardAt, radius);
  }
}

