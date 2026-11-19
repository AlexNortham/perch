/**
 * A hero's rig: the part meshes of a BirdBuild under a few pivot groups, animated in code from the entity's view
 * flags, velocity, look pitch and hp (GDD §14.6). Poses are snappy: each target is blended in at RIG.blend per
 * second. Nothing here allocates per frame.
 *
 * Hierarchy (the renderer sets the root's position and yaw):
 *   root → squash (crouch scales heights about the feet, as the sim does; debug hitboxes hang here)
 *        → rig (pivot at hip height: lean, roll, bob, death) → inner (undoes the pivot offset) → parts
 */
import { Group, Mesh } from 'three';
import type { Material } from 'three';
import type { BodyPlan } from '../../../sim/core/contracts/heroes';
import { ViewFlag } from '../../../sim/core/contracts';
import type { EntityView } from '../../../sim/core/contracts';
import { PART_NAMES } from '../models/bird';
import type { BirdBuild, PartName } from '../models/bird';
import { CROUCH_SQUASH, RIG } from '../models/constants';

const PIVOT_HEIGHT = 0.45;

const has = (flags: number, bit: number): boolean => (flags & bit) !== 0;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export class BirdRig extends Group {
  readonly squash = new Group();
  private readonly rig = new Group();
  private readonly inner = new Group();
  private readonly mesh = {} as Record<PartName, Mesh>;
  readonly plan: BodyPlan;
  private readonly height: number;
  private readonly pivotY: number;
  private readonly build: BirdBuild;

  // Smoothed pose state.
  private phase = 0;
  private run = 0;
  private air = 0;
  private wingFlare = 0;
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

  constructor(build: BirdBuild, plan: BodyPlan, material: Material) {
    super();
    this.build = build;
    this.plan = plan;
    this.height = plan.height;
    this.pivotY = plan.height * PIVOT_HEIGHT;
    this.add(this.squash);
    this.squash.add(this.rig);
    this.rig.position.y = this.pivotY;
    this.rig.add(this.inner);
    this.inner.position.y = -this.pivotY;
    for (const n of PART_NAMES) {
      const m = new Mesh(build.geo[n], material);
      m.position.copy(build.pivot[n]);
      m.castShadow = true;
      m.frustumCulled = false;
      this.mesh[n] = m;
      this.inner.add(m);
    }
  }

  /**
   * Pose for this frame. `dt` seconds since the last frame, `t` a running clock, `hit` whether hp dropped since the
   * previous sim snapshot.
   */
  animate(e: EntityView, dt: number, t: number, hit: boolean): void {
    dt = clamp(dt, 0, RIG.maxDt);
    const k = 1 - Math.exp(-RIG.blend * dt);
    const f = e.flags;
    const { head, wingL, wingR, legL, legR, tail, gun } = this.mesh;
    const H = this.height;
    const speed = Math.hypot(e.vel.x, e.vel.z);
    const dead = has(f, ViewFlag.Dead);
    const sliding = has(f, ViewFlag.Sliding) || e.mode === 'toboggan';
    const dashing = has(f, ViewFlag.Dashing);
    const mantling = has(f, ViewFlag.Mantling);
    const updraft = has(f, ViewFlag.OnUpdraft);
    const climbing = has(f, ViewFlag.Climbing) || e.mode === 'cling';
    const casting = has(f, ViewFlag.Casting) || has(f, ViewFlag.Channelling);
    const gliding = e.mode === 'glide' || e.mode === 'hover';
    const flying = e.mode === 'flight';
    const airborne = !has(f, ViewFlag.Grounded) && !climbing && !mantling && !updraft && !sliding && !gliding && !flying;
    const sprinting = speed > RIG.sprintSpeed;

    // Gait.
    const runTarget = has(f, ViewFlag.Grounded) && !sliding && !dead ? clamp(speed / RIG.runSpeedRef, 0, 1.2) : climbing ? 0.9 : 0;
    this.run += (runTarget - this.run) * k;
    this.air += ((airborne ? 1 : 0) - this.air) * k;
    this.phase += dt * (climbing ? RIG.climbRate : (RIG.stepBase + speed * RIG.stepPerSpeed) * (this.run > 0.05 ? 1 : 0));
    const swing = Math.sin(this.phase) * RIG.legSwing * this.run * (1 - this.air);
    const tuck = -0.6 * this.air - (sliding ? 0.8 : 0);
    legL.rotation.x = swing + tuck;
    legR.rotation.x = -swing + tuck;

    // Wings: tucked at rest, loose on the run, spread in the air, flared for a dash, cast or glide.
    let flare = Math.max(this.build.wingRest, RIG.wingTuck + RIG.wingRun * this.run);
    let flap = 0;
    if (dead) flare = RIG.wingDead;
    else if (gliding || flying) flare = RIG.wingGlide;
    else if (dashing) flare = RIG.wingDash;
    else if (updraft) {
      flare = RIG.wingUpdraft;
      flap = RIG.flapUpdraft;
    } else if (climbing) {
      flare = RIG.wingClimb;
      flap = 1;
    } else if (mantling) {
      flare = RIG.wingAir;
      flap = 1;
    } else if (casting) flare = RIG.wingCast;
    else if (has(f, ViewFlag.KnockedUp)) flare = RIG.wingAir;
    else if (airborne) {
      flare = RIG.wingAir;
      flap = e.vel.y > 0 ? 1 : RIG.flapFall;
    }
    this.wingFlare += (flare - this.wingFlare) * k;
    const flutter = Math.sin(t * RIG.flapRate) * RIG.flapAmp * flap;
    wingL.rotation.z = this.wingFlare + flutter;
    wingR.rotation.z = -(this.wingFlare + flutter);

    // Whole-body pitch about the hip, bob, roll and crouch.
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
                ? RIG.dashPitch * 0.7
                : sprinting
                  ? RIG.sprintLean
                  : RIG.runLean * this.run;
    this.pitch += (pitchTarget - this.pitch) * k;
    this.flinch = hit ? RIG.flinchTime : Math.max(0, this.flinch - dt);
    const idle = 1 - Math.min(1, this.run);
    const bob = Math.abs(Math.sin(this.phase)) * RIG.bobHeight * H * this.run + Math.sin(t * RIG.idleRate + e.id) * RIG.idleBob * H * idle;
    this.dead += (dead ? dt : -dt) / RIG.deathTime;
    this.dead = clamp(this.dead, 0, 1);
    this.sink += ((e.mode === 'burrow' ? H : 0) - this.sink) * k;
    this.crouch += ((has(f, ViewFlag.Crouching) ? CROUCH_SQUASH : 1) - this.crouch) * k;
    this.squash.scale.y = this.crouch;
    const rig = this.rig;
    rig.rotation.x = this.pitch + (this.flinch / RIG.flinchTime) * RIG.flinchPitch;
    rig.rotation.z = Math.sin(this.phase) * this.build.sway * this.run + this.dead * RIG.deathRoll;
    rig.position.y = this.pivotY + bob - (sliding ? RIG.slideDrop * this.pivotY : 0) - this.dead * (this.pivotY - 0.1 * H) - this.sink;

    // Casting: head up, tail lifts, a pulse through the body.
    this.cast += ((casting ? 1 : 0) - this.cast) * k;
    const pulse = 1 + Math.sin(t * 12) * RIG.castPulse * this.cast;
    rig.scale.set(pulse, pulse, pulse);
    tail.rotation.x = this.build.castTail * this.cast + Math.sin(this.phase) * 0.12 * this.run + Math.sin(t * 1.7 + e.id) * 0.03;
    tail.scale.x = 1 + 0.3 * this.cast;

    // Head: looks where the hero aims, tilts at idle, circles when stunned, dips on reload and cast.
    this.stun += ((has(f, ViewFlag.Stunned) ? 1 : 0) - this.stun) * k;
    this.reload += ((has(f, ViewFlag.Reloading) ? 1 : 0) - this.reload) * k;
    head.rotation.x = -clamp(e.pitch, -1.2, 1.2) * RIG.headLook + RIG.castHeadUp * this.cast + 0.25 * this.reload;
    head.rotation.y = Math.sin(t * RIG.stunRate) * RIG.stunSwing * this.stun;
    head.rotation.z = Math.sin(t * 0.9 + e.id) * 0.08 * idle + Math.cos(t * RIG.stunRate) * 0.3 * this.stun;

    // Gun: aims with the look pitch, kicks on every shot, dips and wobbles to reload.
    if (has(f, ViewFlag.Firing)) {
      this.shot += dt * RIG.recoilRate;
      this.recoil = 1 - (this.shot % 1);
    } else {
      this.shot = 0;
      this.recoil *= Math.exp(-20 * dt);
    }
    const g = this.build.pivot.gun;
    gun.position.set(g.x, g.y - this.reload * 0.12 * H, g.z - this.recoil * RIG.recoilKick);
    gun.rotation.x = -clamp(e.pitch, -1.2, 1.2) - this.recoil * RIG.recoilPitch + this.reload * (RIG.reloadDip + Math.sin(t * 14) * 0.1);
  }
}
