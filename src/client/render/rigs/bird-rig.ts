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
import { CROUCH_SQUASH, MELEE, RIG } from '../models/constants';

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
  /** Melee state: the pose now showing, seconds since it began, and smoothed charge and parry weights. */
  private meleeKind: EntityView['meleePose'] | null = null;
  private meleeT = 0;
  private charge = 0;
  private parry = 0;
  private readonly halo: Mesh | null = null;

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
      m.name = n;
      m.castShadow = true;
      m.frustumCulled = false;
      this.mesh[n] = m;
      this.inner.add(m);
    }
    if (build.halo) {
      this.halo = new Mesh(build.halo, material);
      this.halo.name = 'halo';
      this.halo.position.copy(build.pivot.head);
      this.halo.frustumCulled = false;
      this.inner.add(this.halo);
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
    const runTarget = has(f, ViewFlag.Grounded) && !sliding && !dead ? clamp(speed / RIG.runSpeedRef, 0, RIG.runMax) : climbing ? RIG.climbRun : 0;
    this.run += (runTarget - this.run) * k;
    this.air += ((airborne ? 1 : 0) - this.air) * k;
    this.phase += dt * (climbing ? RIG.climbRate : (RIG.stepBase + speed * RIG.stepPerSpeed) * (this.run > RIG.stepMinRun ? 1 : 0));
    const swing = Math.sin(this.phase) * RIG.legSwing * this.run * (1 - this.air);
    const tuck = -RIG.airTuck * this.air - (sliding ? RIG.slideTuck : 0);
    legL.rotation.x = swing + tuck;
    legR.rotation.x = -swing + tuck;
    if (this.build.idleLeg) {
      // Flamingo: stands on one leg when still.
      const lift = this.build.idleLeg * (1 - Math.min(1, this.run)) * (1 - this.air) * (dead ? 0 : 1);
      legR.rotation.x -= lift * MELEE.idleLegAngle;
      legR.scale.y = 1 - lift * MELEE.idleLegFold;
    }

    // Melee (WeaponState.meleePose): charge hold, light and heavy swings (windup, lunge, recovery) and parry.
    const pose = e.meleePose ?? null;
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
        back = Math.max(0, 1 - v / 0.15);
        lunge = v < 0.3 ? v / 0.3 : 1 - (v - 0.3) / 0.7;
      }
    }
    const striking = Math.max(lunge, back);

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
    if (this.charge > 0.01) flare += (MELEE.charge.wing - flare) * this.charge;
    if (strike) flare += (strike.wing - flare) * striking;
    if (this.parry > 0.01) flare += (MELEE.parry.wingFlare - flare) * this.parry;
    this.wingFlare += (flare - this.wingFlare) * k;
    const flutter = Math.sin(t * RIG.flapRate) * RIG.flapAmp * flap;
    wingL.rotation.z = this.wingFlare + flutter;
    wingR.rotation.z = -(this.wingFlare + flutter);
    wingL.rotation.x = wingR.rotation.x = this.parry * MELEE.parry.wingSwing + lunge * 0.5;

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
                ? RIG.flightPitch
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
    const lean = this.charge * MELEE.charge.pitch + this.parry * MELEE.parry.pitch + (strike ? lunge * strike.pitch - back * strike.back : 0);
    rig.rotation.x = this.pitch + lean + (this.flinch / RIG.flinchTime) * RIG.flinchPitch;
    rig.position.z = strike ? (lunge - back * strike.back * 0.3) * strike.reach * H : 0;
    rig.position.x = Math.sin(t * MELEE.charge.shakeRate) * MELEE.charge.shake * this.charge;
    rig.rotation.z = Math.sin(this.phase) * this.build.sway * this.run + this.dead * RIG.deathRoll;
    rig.position.y = this.pivotY + bob - (sliding ? RIG.slideDrop * this.pivotY : 0) - this.dead * (this.pivotY - RIG.deadClearance * H) - this.sink - this.charge * MELEE.charge.drop * H;

    // Casting: head up, tail lifts, a pulse through the body.
    this.cast += ((casting ? 1 : 0) - this.cast) * k;
    const pulse = 1 + Math.sin(t * RIG.castRate) * RIG.castPulse * this.cast;
    rig.scale.set(pulse, pulse, pulse);
    tail.rotation.x = this.build.castTail * this.cast + Math.sin(this.phase) * RIG.tailRun * this.run + Math.sin(t * RIG.tailIdleRate + e.id) * RIG.tailIdle;
    tail.scale.x = 1 + RIG.castTailWiden * this.cast;

    // Head: looks where the hero aims, tilts at idle, circles when stunned, dips on reload and cast.
    this.stun += ((has(f, ViewFlag.Stunned) ? 1 : 0) - this.stun) * k;
    this.reload += ((has(f, ViewFlag.Reloading) ? 1 : 0) - this.reload) * k;
    head.rotation.x = -clamp(e.pitch, -RIG.pitchLimit, RIG.pitchLimit) * RIG.headLook + RIG.castHeadUp * this.cast + RIG.reloadHead * this.reload + this.charge * MELEE.charge.head + this.parry * MELEE.parry.head;
    head.position.z = this.build.pivot.head.z + (lunge - back * 0.5) * MELEE.headThrust * H * 0.3;
    if (this.halo) this.halo.rotation.y = t * MELEE.haloRate;
    head.rotation.y = Math.sin(t * RIG.stunRate) * RIG.stunSwing * this.stun;
    head.rotation.z = Math.sin(t * RIG.headTiltRate + e.id) * RIG.headTilt * idle + Math.cos(t * RIG.stunRate) * RIG.stunRoll * this.stun;

    // Gun: aims with the look pitch, kicks on every shot, dips and wobbles to reload.
    if (has(f, ViewFlag.Firing)) {
      this.shot += dt * RIG.recoilRate;
      this.recoil = 1 - (this.shot % 1);
    } else {
      this.shot = 0;
      this.recoil *= Math.exp(-RIG.recoilDecay * dt);
    }
    const g = this.build.pivot.gun;
    gun.position.set(g.x, g.y - this.reload * RIG.reloadDrop * H, g.z - this.recoil * RIG.recoilKick);
    gun.rotation.x = -clamp(e.pitch, -RIG.pitchLimit, RIG.pitchLimit) - this.recoil * RIG.recoilPitch + this.reload * (RIG.reloadDip + Math.sin(t * RIG.reloadWobbleRate) * RIG.reloadWobble) + (this.charge + this.parry + striking) * RIG.reloadDip;
  }
}
