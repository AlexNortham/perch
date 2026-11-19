/**
 * A hero's rig: one skinned mesh over the bones of a BirdBuild, animated in code from the entity's view flags,
 * velocity, look pitch and hp (GDD §14.6). Poses are snappy: each target is blended in at RIG.blend per second.
 * Nothing here allocates per frame.
 *
 * The gun leads and the bird follows (D-ART-003): the gun bone is placed first (at the sim's muzzle point while
 * aiming, lowered or swung for casts and melee), then each wing is solved onto its grip socket with two-bone IK,
 * and each leg onto the ground (or into its air, slide or climb pose).
 *
 * Hierarchy (the renderer sets the root's position and yaw):
 *   root → squash (crouch scales heights about the feet, as the sim does; debug hitboxes and the mesh hang here)
 *        → rig (pivot at hip height: lean, roll, bob, death) → inner (undoes the pivot offset) → bones
 */
import { Bone, Euler, Group, Matrix4, Quaternion, Skeleton, SkinnedMesh, Vector3 } from 'three';
import type { Material } from 'three';
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import { ViewFlag } from '../../../sim/core/contracts';
import type { EntityView } from '../../../sim/core/contracts';
import { BONE_NAMES, BONE_PARENT } from '../models/bird';
import type { BirdBuild, BoneName, CastKind } from '../models/bird';
import { CAST_POSE, CROUCH_SQUASH, GAIT, HOLD, LEG_IK, MELEE, RIG } from '../models/constants';

const PIVOT_HEIGHT = 0.45;
const EPS = 1e-5;
const TAU = Math.PI * 2;

const has = (flags: number, bit: number): boolean => (flags & bit) !== 0;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
/** Ease in and out over 0..1. */
const smooth = (s: number): number => (1 - Math.cos(Math.PI * s)) / 2;
const vec = (a: { readonly x: number; readonly y: number; readonly z: number }): Vector3 => new Vector3(a.x, a.y, a.z);
/** Leg modes, in the order of BirdRig.legW; every mode but planted is a pose relative to the hip (LEG_IK). */
const LEG = { planted: 0, tuck: 1, slide: 2, limp: 3, climb: 4 } as const;
const LEG_POSES = [LEG_IK.tuck, LEG_IK.slide, LEG_IK.limp, LEG_IK.climb] as const;

// Scratch (the rig never allocates per frame).
const M = new Matrix4();
const Minv = new Matrix4();
const basis = new Matrix4();
const qA = new Quaternion();
const qB = new Quaternion();
const qC = new Quaternion();
const qRigInv = new Quaternion();
const qW = new Quaternion();
const euler = new Euler();
const dir = new Vector3();
const bend = new Vector3();
const normal = new Vector3();
const elbow = new Vector3();
const tip = new Vector3();
const axisY = new Vector3();
const axisZ = new Vector3();
const pos = new Vector3();
const off = new Vector3();
const mainIn = new Vector3();
const supportIn = new Vector3();
const gesture = new Vector3();
const target = new Vector3();
const hipRoot = new Vector3();
const part = new Vector3();
const POLE_MAIN = vec(HOLD.poleMain).normalize();
const POLE_SUPPORT = vec(HOLD.poleSupport).normalize();
const POLE_KNEE = new Vector3(0, 0, -1);
const GESTURE: Record<'raise' | 'throw' | 'sweep' | 'stomp', Vector3> = {
  raise: vec(CAST_POSE.raise).normalize(),
  throw: vec(CAST_POSE.throw).normalize(),
  sweep: vec(CAST_POSE.sweep).normalize(),
  stomp: vec(CAST_POSE.stomp).normalize(),
};

function fromAxes(out: Quaternion, x: Vector3, y: Vector3): Quaternion {
  axisZ.crossVectors(x, y);
  basis.makeBasis(x, y, axisZ);
  return out.setFromRotationMatrix(basis);
}

/**
 * Two-bone IK in the frame `a` hangs in: `a` runs from `root` along its local -y for `la`, `b` from a's tip for
 * `lb`; the joint bends toward `pole`. Leaves the end bone's orientation (in the same frame) in `qW`.
 */
function solve(a: Bone, b: Bone, root: Vector3, goal: Vector3, la: number, lb: number, pole: Vector3): void {
  dir.subVectors(goal, root);
  let d = dir.length();
  if (d < EPS) dir.set(0, -1, 0);
  else dir.divideScalar(d);
  d = clamp(d, Math.abs(la - lb) + EPS, la + lb - EPS);
  const cosA = clamp((la * la + d * d - lb * lb) / (2 * la * d), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  bend.copy(pole).addScaledVector(dir, -pole.dot(dir));
  if (bend.lengthSq() < EPS) bend.set(0, 0, 1).addScaledVector(dir, -dir.z);
  bend.normalize();
  elbow.copy(root).addScaledVector(dir, la * cosA).addScaledVector(bend, la * sinA);
  tip.copy(root).addScaledVector(dir, d);
  normal.crossVectors(dir, bend).normalize();
  fromAxes(qA, normal, axisY.subVectors(root, elbow).divideScalar(la));
  fromAxes(qW, normal, axisY.subVectors(elbow, tip).divideScalar(lb));
  a.quaternion.copy(qA);
  b.quaternion.copy(qA).invert().multiply(qW);
}

export class BirdRig extends Group {
  readonly squash = new Group();
  private readonly rig = new Group();
  private readonly inner = new Group();
  readonly bones = {} as Record<BoneName, Bone>;
  readonly mesh: SkinnedMesh;
  readonly plan: BodyPlan;
  readonly build: BirdBuild;
  private readonly pivotY: number;
  private readonly hipY: number;
  private readonly legReach: number;
  private readonly wingReach: number;

  // Smoothed pose state.
  private phase = 0;
  private run = 0;
  private stride = 0;
  private pitch = 0;
  private crouch = 1;
  private cast = 0;
  private stun = 0;
  private reload = 0;
  private recoil = 0;
  private shot = 0;
  private flinch = 0;
  private dead = 0;
  /** Sink below ground while burrowed (m). */
  private sink = 0;
  /** Gun held at the sim muzzle (1) or carried with the body (0); support wing free of the gun; gun lowered. */
  private lock = 1;
  private free = 0;
  private lower = 0;
  private leap = 0;
  private brace = 0;
  private stomp = 0;
  private throwing = 0;
  private gestureKind: 'raise' | 'throw' | 'sweep' | 'stomp' = 'raise';
  /** Leg modes: planted, tucked, slide, limp, climb (weights). */
  private readonly legW = [1, 0, 0, 0, 0];
  private airTime = 0;
  private landing = 0;
  /** Melee state: the pose now showing, seconds since it began, and smoothed charge and parry weights. */
  private meleeKind: EntityView['meleePose'] | null = null;
  private meleeT = 0;
  private charge = 0;
  private parry = 0;

  constructor(build: BirdBuild, plan: BodyPlan, material: Material) {
    super();
    this.build = build;
    this.plan = plan;
    this.pivotY = plan.height * PIVOT_HEIGHT;
    this.hipY = build.at.legL1.y;
    this.legReach = build.leg.upper + build.leg.lower;
    this.wingReach = build.wing.upper + build.wing.lower;
    this.add(this.squash);
    this.squash.add(this.rig);
    this.rig.position.y = this.pivotY;
    this.rig.add(this.inner);
    this.inner.position.y = -this.pivotY;
    for (const n of BONE_NAMES) {
      const b = new Bone();
      b.name = n;
      b.position.copy(build.at[n]);
      this.bones[n] = b;
    }
    for (const n of BONE_NAMES) {
      const parent = BONE_PARENT[n];
      (parent ? this.bones[parent] : this.inner).add(this.bones[n]);
    }
    const bones = BONE_NAMES.map((n) => this.bones[n]);
    this.mesh = new SkinnedMesh(build.geo, material);
    this.mesh.name = 'bird';
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    // Geometry is authored in each bone's own frame: identity inverses and bind matrix make a vertex follow its bone.
    this.mesh.bind(new Skeleton(bones, bones.map(() => new Matrix4())), new Matrix4());
    this.squash.add(this.mesh);
  }

  /**
   * Pose for this frame. `dt` seconds since the last frame, `t` a running clock, `hit` whether hp dropped since the
   * previous sim snapshot, `castSlot` the ability slot being cast (0 to 3) when known.
   */
  animate(e: EntityView, dt: number, t: number, hit: boolean, castSlot: number | null = null): void {
    dt = clamp(dt, 0, RIG.maxDt);
    const k = 1 - Math.exp(-RIG.blend * dt);
    const f = e.flags;
    const B = this.bones;
    const at = this.build.at;
    const H = this.plan.height;
    const speed = Math.hypot(e.vel.x, e.vel.z);
    const grounded = has(f, ViewFlag.Grounded);
    const dead = has(f, ViewFlag.Dead);
    const sliding = has(f, ViewFlag.Sliding) || e.mode === 'toboggan';
    const dashing = has(f, ViewFlag.Dashing);
    const mantling = has(f, ViewFlag.Mantling);
    const updraft = has(f, ViewFlag.OnUpdraft);
    const climbing = has(f, ViewFlag.Climbing) || e.mode === 'cling';
    const casting = has(f, ViewFlag.Casting) || has(f, ViewFlag.Channelling);
    const gliding = e.mode === 'glide' || e.mode === 'hover';
    const flying = e.mode === 'flight';
    const burrowed = e.mode === 'burrow';
    const airborne = !grounded && !climbing && !mantling && !updraft && !sliding && !gliding && !flying;
    const sprinting = speed > RIG.sprintSpeed;
    const kind: CastKind | null = casting ? (castSlot !== null ? this.build.casts[castSlot] : undefined) ?? CAST_POSE.fallback : null;

    // Melee (WeaponState.meleePose): charge hold, light and heavy swings (windup, lunge, recovery) and parry.
    const pose = dead ? null : (e.meleePose ?? null);
    if (pose !== this.meleeKind) {
      this.meleeKind = pose;
      this.meleeT = 0;
    } else this.meleeT += dt;
    this.charge += ((pose === 'charging' ? 1 : 0) - this.charge) * k;
    this.parry += ((pose === 'parry' ? 1 : 0) - this.parry) * k;
    let lunge = 0;
    let back = 0;
    const strike = pose === 'light' || pose === 'heavy' ? MELEE[pose] : null;
    if (strike) {
      const u = Math.min(1, this.meleeT / strike.dur);
      if (u < strike.windup) back = u / strike.windup;
      else {
        const v = (u - strike.windup) / (1 - strike.windup);
        back = Math.max(0, 1 - v / MELEE.backFade);
        lunge = v < MELEE.peak ? v / MELEE.peak : 1 - (v - MELEE.peak) / (1 - MELEE.peak);
      }
    }

    // Weights for the hold: aim lock, free support wing, lowered gun, leap crouch, braced aim, stomp.
    const loose = sliding || dashing || mantling || climbing || dead || burrowed || pose !== null || (kind !== null && kind !== 'aim');
    this.lock += ((loose ? 0 : 1) - this.lock) * k;
    const gestureKind = kind === 'raise' || kind === 'throw' || kind === 'sweep' || kind === 'stomp' ? kind : null;
    if (gestureKind) this.gestureKind = gestureKind;
    this.free += ((gestureKind ? 1 : 0) - this.free) * k;
    this.lower += ((gestureKind ? 1 : 0) - this.lower) * k;
    this.leap += ((kind === 'leap' ? 1 : 0) - this.leap) * k;
    this.brace += ((kind === 'aim' ? 1 : 0) - this.brace) * k;
    this.stomp += ((kind === 'stomp' ? 1 : 0) - this.stomp) * k;
    this.throwing += ((kind === 'throw' ? 1 : 0) - this.throwing) * k;

    // Leg modes, landing and gait.
    // Falling feet reach for the ground (planted pose), so a landing is seamless; rising feet tuck.
    const mode = dead || burrowed ? LEG.limp : sliding ? LEG.slide : climbing ? LEG.climb : dashing || updraft || gliding || flying || mantling || (airborne && e.vel.y > 0) ? LEG.tuck : LEG.planted;
    let sum = 0;
    for (let i = 0; i < this.legW.length; i++) {
      const w = (this.legW[i] ?? 0) + ((i === mode ? 1 : 0) - (this.legW[i] ?? 0)) * k;
      this.legW[i] = w;
      sum += w;
    }
    if (grounded && !sliding && this.airTime > GAIT.landAfter) this.landing = 1;
    this.airTime = grounded ? 0 : this.airTime + dt;
    this.landing = Math.max(0, this.landing - dt / GAIT.landTime);
    const hipToAnkle = this.hipY - this.build.leg.ankle;
    const runTarget = grounded && !sliding && !dead ? clamp(speed / RIG.runSpeedRef, 0, RIG.runMax) : 0;
    this.run += (runTarget - this.run) * k;
    const strideMax = GAIT.stride * hipToAnkle;
    const rate = climbing ? RIG.climbRate : speed > GAIT.minSpeed ? clamp((TAU * speed * GAIT.duty) / strideMax, GAIT.rateMin, GAIT.rateMax) : GAIT.rateMin;
    if (this.run > RIG.stepMinRun || climbing) this.phase += dt * rate;
    const strideTarget = Math.min(strideMax, (TAU * speed * GAIT.duty) / rate) * Math.min(1, this.run);
    this.stride += (strideTarget - this.stride) * k;

    // Whole-body pitch about the pivot, bob, roll and crouch.
    const pitchTarget = sliding
      ? RIG.slidePitch
      : dashing
        ? RIG.dashPitch
        : mantling
          ? RIG.mantlePitch
          : climbing
            ? RIG.climbPitch
            : updraft
              ? RIG.updraftPitch
              : flying
                ? RIG.flightPitch
                : sprinting
                  ? RIG.sprintLean
                  : RIG.runLean * this.run;
    this.pitch += (pitchTarget - this.pitch) * k;
    this.flinch = hit ? RIG.flinchTime : Math.max(0, this.flinch - dt);
    const idle = 1 - Math.min(1, this.run);
    // Run bob scales with the legs (they must reach the ground at the top of it); the idle breath with the body.
    const bob = Math.abs(Math.sin(this.phase)) * GAIT.bob * hipToAnkle * Math.min(1, this.run) + Math.sin(t * RIG.idleRate + e.id) * RIG.idleBob * H * idle;
    this.dead = clamp(this.dead + (dead ? dt : -dt) / RIG.deathTime, 0, 1);
    this.sink += ((burrowed ? H : 0) - this.sink) * k;
    this.crouch += ((has(f, ViewFlag.Crouching) ? CROUCH_SQUASH : 1) - this.crouch) * k;
    this.squash.scale.y = this.crouch;
    this.cast += ((casting ? 1 : 0) - this.cast) * k;
    // Recoil: each shot kicks at once and settles before the next.
    if (has(f, ViewFlag.Firing)) {
      this.shot += dt * RIG.recoilRate;
      this.recoil = 1 - (this.shot % 1);
    } else {
      this.shot = 0;
      this.recoil *= Math.exp(-RIG.recoilDecay * dt);
    }
    const rig = this.rig;
    const lean =
      this.charge * MELEE.charge.pitch + this.parry * MELEE.parry.pitch + (strike ? lunge * strike.pitch - back * strike.back : 0) +
      this.leap * CAST_POSE.leapLean + this.brace * CAST_POSE.aimLean + this.throwing * CAST_POSE.throwLean + this.recoil * HOLD.recoilChest;
    rig.rotation.x = this.pitch + lean + (this.flinch / RIG.flinchTime) * RIG.flinchPitch;
    rig.position.z = strike ? (lunge - back * strike.back * MELEE.pullBack) * strike.reach * H : 0;
    rig.position.x = Math.sin(t * MELEE.charge.shakeRate) * MELEE.charge.shake * this.charge;
    rig.rotation.z = Math.sin(this.phase) * this.build.sway * this.run + this.dead * RIG.deathRoll;
    rig.position.y = this.pivotY + bob - (sliding ? RIG.slideDrop * this.pivotY : 0) - this.dead * (this.pivotY - RIG.deadClearance * H) - this.sink - this.charge * MELEE.charge.drop * H;
    const pulse = 1 + Math.sin(t * RIG.castRate) * RIG.castPulse * this.cast;
    rig.scale.set(pulse, pulse, pulse);

    // Planted hips: whatever the lean, the hips sit at standing height (less the run, landing and leap drops), so
    // the feet reach the ground.
    const planted = (this.legW[LEG.planted] ?? 0) / sum;
    const drop = GAIT.runDrop * Math.min(1, this.run) + GAIT.landDrop * smooth(this.landing) + CAST_POSE.leapDrop * this.leap;
    this.frame();
    hipRoot.copy(at.legL1).add(at.legR1).multiplyScalar(1 / 2).applyMatrix4(M);
    rig.position.y += ((this.hipY * (1 - drop) + bob) * this.crouch - hipRoot.y) * planted / this.crouch;
    this.frame();
    Minv.copy(M).invert();
    qRigInv.copy(rig.quaternion).invert();

    // The gun: at the sim's muzzle point, aimed with the look pitch, then moved about the main grip by the action.
    const b = this.build;
    const pitchA = clamp(e.pitch, -RIG.pitchLimit, RIG.pitchLimit);
    qB.setFromEuler(euler.set(-pitchA, b.hold.toe, b.hold.cant, 'YXZ'));
    qC.copy(qRigInv).multiply(qB);
    qB.slerp(qC, this.lock);
    const mz = this.plan.muzzle;
    pos.set(-mz.right, mz.up * this.crouch, mz.forward).applyMatrix4(Minv).lerp(at.gun, 1 - this.lock);
    this.reload += ((has(f, ViewFlag.Reloading) ? 1 : 0) - this.reload) * k;
    this.stun += ((has(f, ViewFlag.Stunned) ? 1 : 0) - this.stun) * k;
    const r = this.reload;
    euler.set(
      -HOLD.recoilClimb * this.recoil + HOLD.reloadDip * r + HOLD.lowerDip * this.lower + HOLD.stunDip * this.stun +
        HOLD.heavyRaise * (pose === 'heavy' ? back : 0) + HOLD.heavySmash * (pose === 'heavy' ? lunge : 0) + HOLD.chargeRaise * this.charge + HOLD.parryRaise * this.parry,
      HOLD.reloadYaw * r + (pose === 'light' ? HOLD.lightSwing * lunge + HOLD.lightWind * back : 0) + HOLD.parryYaw * this.parry,
      HOLD.reloadCant * r,
      'YXZ',
    );
    qC.setFromEuler(euler);
    const grip = b.grip.main;
    // Pivot about the main grip, then kick back along the barrel.
    off.copy(grip).negate().applyQuaternion(qC).add(grip);
    off.z -= HOLD.recoilKick * this.recoil;
    off.applyQuaternion(qB);
    pos.add(off);
    const R = this.plan.radius;
    pos.x += (HOLD.reloadPull.x * r + HOLD.parryPull.x * this.parry) * R;
    pos.y += (HOLD.reloadPull.y * r + HOLD.parryPull.y * this.parry - HOLD.lowerDrop * this.lower + HOLD.heavyLift * (pose === 'heavy' ? back : 0) + HOLD.chargeLift * this.charge) * H;
    pos.z += (HOLD.reloadPull.z * r + HOLD.parryPull.z * this.parry + (pose === 'light' ? HOLD.lightReach * lunge : 0)) * R;
    B.gun.position.copy(pos);
    B.gun.quaternion.copy(qB).multiply(qC);
    B.slide.position.copy(at.slide);
    B.slide.position.z -= b.slideTravel * r * (1 - Math.cos(t * HOLD.pumpRate)) / 2;

    // Wings onto the grips: the trigger wing (the bird's right) on the main grip, the left on the fore-end unless a
    // cast frees it for a gesture.
    mainIn.copy(grip).applyQuaternion(B.gun.quaternion).add(B.gun.position);
    supportIn.copy(B.slide.position).add(b.grip.support).applyQuaternion(B.gun.quaternion).add(B.gun.position);
    const wave = Math.sin(t * CAST_POSE.waveRate) * CAST_POSE.wave;
    gesture.copy(GESTURE[this.gestureKind]);
    if (this.gestureKind === 'sweep') gesture.z += wave;
    else gesture.y += wave * (this.gestureKind === 'throw' ? 1 : 1 / 2);
    gesture.normalize().multiplyScalar(this.wingReach * CAST_POSE.gesture).add(at.wingL1);
    supportIn.lerp(gesture, this.free);
    solve(B.wingR1, B.wingR2, at.wingR1, mainIn, b.wing.upper, b.wing.lower, POLE_MAIN);
    solve(B.wingL1, B.wingL2, at.wingL1, supportIn, b.wing.upper, b.wing.lower, POLE_SUPPORT);

    // Legs: planted feet step under the hips at the ground speed; otherwise tucked, forward, limp or climbing.
    const stompLift = this.stomp * CAST_POSE.stompLift * this.hipY * Math.max(0, Math.sin(t * CAST_POSE.stompRate));
    const fold = (b.idleLeg ?? 0) * idle * (dead ? 0 : 1);
    for (let i = 0; i < 2; i++) {
      const left = i === 0;
      const hip = left ? at.legL1 : at.legR1;
      const u = (this.phase / TAU + i / 2) % 1;
      let z = 0;
      let y = 0;
      if (u < GAIT.duty) z = this.stride * (1 / 2 - u / GAIT.duty);
      else {
        const s = (u - GAIT.duty) / (1 - GAIT.duty);
        z = this.stride * (smooth(s) - 1 / 2);
        y = GAIT.lift * hipToAnkle * Math.min(1, this.run) * Math.sin(Math.PI * s);
      }
      if (!left) y += stompLift;
      hipRoot.copy(hip).applyMatrix4(M);
      // Planted feet keep their stance width when the body rolls, and step along under the hips.
      target.set(hip.x, b.leg.ankle * this.crouch + y, hipRoot.z + z).applyMatrix4(Minv).multiplyScalar(planted);
      const L = this.legReach;
      for (let m = 0; m < LEG_POSES.length; m++) {
        const p = LEG_POSES[m];
        const w = (this.legW[m + LEG.tuck] ?? 0) / sum;
        if (!p || w < EPS) continue;
        const swing = m + LEG.tuck === LEG.climb ? Math.sin(this.phase + i * Math.PI) * LEG_IK.climbSwing : 0;
        target.addScaledVector(part.set(hip.x, hip.y - L * (p.down + swing), hip.z + L * p.fwd), w);
      }
      if (!left && fold > 0) target.lerp(part.set(hip.x, hip.y - L * LEG_IK.fold.down, hip.z + L * LEG_IK.fold.fwd), fold);
      const [a1, a2, foot] = left ? [B.legL1, B.legL2, B.footL] : [B.legR1, B.legR2, B.footR];
      solve(a1, a2, hip, target, b.leg.upper, b.leg.lower, POLE_KNEE);
      // The foot lies flat on the ground (toes curled down off it).
      qA.setFromEuler(euler.set(LEG_IK.curl * (1 - planted), 0, 0));
      foot.quaternion.copy(qW).invert().multiply(qC.copy(qRigInv).multiply(qA));
    }

    // Casting: head up, tail lifts. Head: looks where the hero aims, tilts at idle, circles when stunned, dips on reload.
    B.tail.rotation.x = b.castTail * this.cast + Math.sin(this.phase) * RIG.tailRun * this.run + Math.sin(t * RIG.tailIdleRate + e.id) * RIG.tailIdle;
    B.tail.scale.x = 1 + RIG.castTailWiden * this.cast;
    B.head.rotation.x =
      -pitchA * RIG.headLook + RIG.castHeadUp * this.cast + RIG.reloadHead * r + this.charge * MELEE.charge.head + this.parry * MELEE.parry.head;
    B.head.position.z = at.head.z + (lunge - back * MELEE.headPull) * MELEE.headThrust * H;
    B.halo.rotation.y = t * MELEE.haloRate;
    B.head.rotation.y = Math.sin(t * RIG.stunRate) * RIG.stunSwing * this.stun;
    B.head.rotation.z = Math.sin(t * RIG.headTiltRate + e.id) * RIG.headTilt * idle + Math.cos(t * RIG.stunRate) * RIG.stunRoll * this.stun;
  }

  /** Body-frame matrices now, and M = the body frame in the root's frame. */
  private frame(): void {
    this.squash.updateMatrix();
    this.rig.updateMatrix();
    this.inner.updateMatrix();
    M.multiplyMatrices(this.squash.matrix, this.rig.matrix).multiply(this.inner.matrix);
  }
}
