/**
 * Instanced fledglings: one InstancedMesh per (type, team), so any number of chicks costs four draw calls. An entity's
 * model is a bare proxy Object3D (the entity layer sets its position and yaw); it takes an instance slot when added
 * to the scene and frees it when removed. pose() writes the proxy's transform plus a cheap whole-body animation
 * (waddle, bob, lunge, breathing) into the instance matrix.
 */
import { Euler, InstancedMesh, Matrix4, Object3D, Quaternion, Vector3 } from 'three';
import type { BufferGeometry, Material } from 'three';
import { ViewFlag } from '../../../sim/core/contracts';
import type { EntityView } from '../../../sim/core/contracts';
import { FLEDGLING } from '../models/constants';

const euler = new Euler(0, 0, 0, 'YXZ');
const quat = new Quaternion();
const pos = new Vector3();
const size = new Vector3();
const matrix = new Matrix4();
const hidden = new Matrix4().makeScale(0, 0, 0);

/** The instances for one (type, team). Free slots hold a zero-scale matrix, so the draw count never needs compacting. */
export class FledglingGroup {
  readonly mesh: InstancedMesh;
  private readonly freed: number[] = [];
  private next = 0;
  /** Nominal radius of the geometry, for scaling to the entity. */
  readonly nominal: number;

  constructor(geometry: BufferGeometry, material: Material, nominal: number, readonly capacity = FLEDGLING.capacity) {
    this.mesh = new InstancedMesh(geometry, material, capacity);
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.nominal = nominal;
  }

  /** A free slot, or -1 when full (the chick is then simply not drawn). */
  take(): number {
    const slot = this.freed.pop() ?? (this.next < this.capacity ? this.next++ : -1);
    this.mesh.count = this.next;
    return slot;
  }

  release(slot: number): void {
    if (slot < 0) return;
    this.mesh.setMatrixAt(slot, hidden);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.freed.push(slot);
  }

  /** Slots in use. */
  get used(): number {
    return this.next - this.freed.length;
  }
}

/** The model for one fledgling entity. */
export class FledglingProxy extends Object3D {
  slot = -1;

  constructor(readonly group: FledglingGroup) {
    super();
    this.addEventListener('added', () => {
      this.slot = group.take();
    });
    this.addEventListener('removed', () => {
      group.release(this.slot);
      this.slot = -1;
    });
  }

  /** `t` is a smooth clock (sim seconds blended by alpha); the proxy's own position and yaw are already set. */
  animate(e: EntityView, t: number): void {
    if (this.slot < 0) return;
    const group = this.group;
    if (!group.mesh.parent && this.parent) this.parent.add(group.mesh);
    const s = e.radius > 0 ? Math.min(1.4, Math.max(0.7, e.radius / group.nominal)) : 1;
    const phase = t * FLEDGLING.bobRate + e.id * 1.7;
    const dead = (e.flags & ViewFlag.Dead) !== 0;
    const moving = Math.hypot(e.vel.x, e.vel.z) > FLEDGLING.moveSpeed;
    const attacking = (e.flags & ViewFlag.Attacking) !== 0;
    let bob = 0;
    let roll = 0;
    let lean = 0;
    let squash = 1 + Math.sin(t * FLEDGLING.idleRate + e.id) * 0.03;
    if (moving) {
      bob = Math.abs(Math.sin(phase)) * FLEDGLING.bobHeight;
      roll = Math.sin(phase) * FLEDGLING.waddle;
    }
    if (attacking) lean = Math.max(0, Math.sin(t * FLEDGLING.lungeRate + e.id)) * FLEDGLING.lungePitch;
    if (dead) {
      roll = 1.4;
      squash = FLEDGLING.deathScale;
    }
    euler.set(lean, this.rotation.y, roll);
    quat.setFromEuler(euler);
    pos.set(this.position.x, this.position.y + (bob + (dead ? -0.1 : 0)) * s, this.position.z);
    matrix.compose(pos, quat, size.set(s, s * squash, s));
    group.mesh.setMatrixAt(this.slot, matrix);
    group.mesh.instanceMatrix.needsUpdate = true;
  }
}
