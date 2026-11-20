/**
 * Visuals that follow entities, redrawn from the view every frame (nothing is stored per entity beyond a pod's first
 * sighting): ability and gun projectiles, seed pods, areas, summon placeholders, status markers, tethers, hit flashes
 * and the movement effects that last while a flag is up (slide sparks, Updraft wind).
 */
import { Quaternion } from 'three';
import type { EntityId, EntityView, PlayerTeam } from '../../sim/core/contracts';
import { ViewFlag } from '../../sim/core/contracts';
import type { Frame } from '../app/contracts';
import { entityById } from '../app/loop';
import { ALLY_TEAL, ENEMY_RED, NEUTRAL_COLOUR, TEAM_COLOURS } from '../app/palette';
import {
  AREA, MELEE, HEAD, HIT_FLASH, HIT_FLASH_CAPACITY, MARKER, MARKER_BITS, MAX_TETHERS, PROJECTILE, POD, SLIDE_SPARK_EVERY, SUMMON, TETHER,
  WIND_EVERY,
  AREA_DRAW, HALF_TURN_DEG, HIT_FLASH_DRAW, MARKER_DRAW, MELEE_DRAW, POD_DRAW, PROJECTILE_DRAW, SLIDE_SPARK, SUMMON_DRAW,
  TETHER_DRAW,
} from './constants';
import { chestHeight } from './mapping';
import { drawnByVfx } from '../app/drawn';
import { faceZ, identity, rgb } from './fx';
import type { Draw, Transients } from './fx';

const TAU = Math.PI * 2;
const DEG = Math.PI / HALF_TURN_DEG;
const UP = { x: 0, y: 1, z: 0 };
const WHITE = 0xffffff;

export interface Source {
  /** The entity in the current view or the self-test's synthetic ones. */
  entity(id: EntityId): EntityView | undefined;
  readonly entities: readonly EntityView[];
  /** Hero status bits (MARKER_BITS) by entity id. */
  readonly statusBits: ReadonlyMap<EntityId, number>;
  readonly localTeam: PlayerTeam;
  /** Self-test overrides: a frozen clock for pod ages, pod birth times, and slowed hit flashes. */
  readonly now: number | null;
  readonly podBorn: ReadonlyMap<EntityId, number> | null;
  readonly timeScale: number;
}

interface Flash {
  id: EntityId;
  age: number;
  live: boolean;
}

export class Bound {
  private readonly q = new Quaternion();
  private readonly colour = { r: 0, g: 0, b: 0 };
  private readonly podSeen = new Map<EntityId, number>();
  private readonly tethers: { source: EntityId; target: EntityId }[] = [];
  private readonly flashes: Flash[] = [];
  private flashNext = 0;
  private clock = 0;
  private slideClock = 0;
  private windClock = 0;
  // Interpolated position of the entity being drawn.
  private x = 0;
  private y = 0;
  private z = 0;

  constructor(
    private readonly draw: Draw,
    private readonly fx: Transients,
  ) {
    for (let i = 0; i < HIT_FLASH_CAPACITY; i++) this.flashes.push({ id: -1, age: 0, live: false });
  }

  /** Forget everything remembered between frames (new session). */
  reset(): void {
    this.podSeen.clear();
    this.tethers.length = 0;
    for (const f of this.flashes) f.live = false;
  }

  tether(source: EntityId, target: EntityId, on: boolean): void {
    const i = this.tethers.findIndex((t) => t.source === source && t.target === target);
    if (!on) {
      if (i >= 0) this.tethers.splice(i, 1);
    } else if (i < 0 && this.tethers.length < MAX_TETHERS) this.tethers.push({ source, target });
  }

  hitFlash(id: EntityId): void {
    const f = this.flashes.find((x) => x.live && x.id === id) ?? this.flashes[this.flashNext++ % HIT_FLASH_CAPACITY];
    if (!f) return;
    f.id = id;
    f.age = 0;
    f.live = true;
  }

  private at(frame: Frame, e: EntityView): void {
    const before = entityById(frame.prev, e.id) ?? e;
    const a = frame.alpha;
    this.x = before.pos.x + (e.pos.x - before.pos.x) * a;
    this.y = before.pos.y + (e.pos.y - before.pos.y) * a;
    this.z = before.pos.z + (e.pos.z - before.pos.z) * a;
  }

  /** Push one instance in a hex colour scaled by `k`. */
  private put(shape: keyof Draw['layers'], q: Quaternion, x: number, y: number, z: number, sx: number, sy: number, sz: number, hex: number, k: number): void {
    const c = this.colour;
    rgb(hex, c);
    this.draw.layers[shape].push(q, x, y, z, sx, sy, sz, c.r * k, c.g * k, c.b * k);
  }

  private sphere(x: number, y: number, z: number, r: number, hex: number, k: number): void {
    this.put('sphere', identity(), x, y, z, r, r, r, hex, k);
  }

  private ring(x: number, y: number, z: number, r: number, hex: number, k: number): void {
    this.put('ring', identity(), x, y, z, r, r, r, hex, k);
  }

  frame(frame: Frame, src: Source): void {
    const dt = frame.dt;
    this.clock += dt;
    this.slideClock += dt;
    this.windClock += dt;
    const slide = this.slideClock >= SLIDE_SPARK_EVERY;
    const wind = this.windClock >= WIND_EVERY;
    if (slide) this.slideClock = 0;
    if (wind) this.windClock = 0;

    for (const e of src.entities) {
      if (drawnByVfx(e)) {
        this.at(frame, e);
        switch (e.kind) {
          case 'projectile':
            this.projectile(e, src.localTeam);
            break;
          case 'pickup':
            this.pod(e, src.now ?? frame.curr.seconds, src, src.localTeam);
            break;
          case 'area':
            this.area(e, src.localTeam);
            break;
          default:
            this.summon(e);
        }
      }
      if (e.kind === 'hero' || e.kind === 'unit') {
        if ((e.flags & ViewFlag.Dead) !== 0) continue;
        this.at(frame, e);
        this.markers(e, src.statusBits.get(e.id) ?? 0);
        if (e.meleePose) this.melee(e);
        if (e.kind === 'hero') {
          if (slide && (e.flags & ViewFlag.Sliding) !== 0) this.fx.burst('slideSpark', { x: this.x - e.vel.x * SLIDE_SPARK.trail, y: this.y + SLIDE_SPARK.lift, z: this.z - e.vel.z * SLIDE_SPARK.trail }, UP, WHITE);
          if (wind && (e.flags & ViewFlag.OnUpdraft) !== 0 && e.id !== frame.curr.localHero) this.fx.burst('wind', { x: this.x, y: this.y, z: this.z }, UP, WHITE);
        }
      }
    }
    this.prunePods(src.entities);
    this.tetherLinks(frame, src);
    this.hitFlashes(frame, src, dt * src.timeScale);
  }

  private projectile(e: EntityView, local: PlayerTeam): void {
    const enemy = e.team !== local;
    const r = Math.max(PROJECTILE.minRadius, e.radius) * PROJECTILE.scale;
    this.sphere(this.x, this.y, this.z, r, enemy ? PROJECTILE.coreEnemy : PROJECTILE.coreAlly, 1);
    if (e.radius >= PROJECTILE.glowFrom) this.sphere(this.x, this.y, this.z, r * PROJECTILE.glowScale, enemy ? ENEMY_RED : teamColour(e), PROJECTILE_DRAW.glowAlpha);
    const speed = Math.hypot(e.vel.x, e.vel.y, e.vel.z);
    if (speed < 1) return;
    const len = Math.min(speed * PROJECTILE.trailPerSpeed, PROJECTILE.trailMax);
    const dx = -e.vel.x / speed;
    const dy = -e.vel.y / speed;
    const dz = -e.vel.z / speed;
    this.put('box', faceZ(this.q, dx, dy, dz), this.x + (dx * len) / 2, this.y + (dy * len) / 2, this.z + (dz * len) / 2, r * PROJECTILE_DRAW.trailThickness, r * PROJECTILE_DRAW.trailThickness, len, enemy ? ENEMY_RED : teamColour(e), PROJECTILE_DRAW.trailAlpha);
  }

  /** A seed pod rises, hangs ripe (pulsing), then withers; gold for the side that can secure it, grey-blue to deny. */
  private pod(e: EntityView, now: number, src: Source, local: PlayerTeam): void {
    let born = this.podSeen.get(e.id);
    if (born === undefined) {
      born = src.podBorn?.get(e.id) ?? now;
      this.podSeen.set(e.id, born);
    }
    const age = now - born;
    const ripeEnd = POD.riseS + POD.ripeS;
    const securable = e.team !== local;
    const hex = securable ? POD.secure : POD.deny;
    let scale = 1;
    let k = 1;
    if (age < POD.riseS) k = POD.risingDim;
    else if (age < ripeEnd) scale = 1 + POD.pulseDepth * Math.sin((age - POD.riseS) * POD.pulseHz * TAU);
    else {
      const w = Math.min(1, (age - ripeEnd) / POD.witherS);
      scale = 1 - POD_DRAW.witherShrink * w;
      k = 1 - POD_DRAW.witherShrink * w;
    }
    const r = POD.radius * scale;
    this.sphere(this.x, this.y, this.z, r, hex, k);
    this.sphere(this.x, this.y, this.z, r * POD.halo, hex, POD_DRAW.haloAlpha * k);
  }

  private prunePods(entities: readonly EntityView[]): void {
    if (this.podSeen.size === 0) return;
    for (const id of this.podSeen.keys()) {
      let alive = false;
      for (const e of entities) {
        if (e.id === id) {
          alive = true;
          break;
        }
      }
      if (!alive) this.podSeen.delete(id);
    }
  }

  /** Areas: exact dimensions when the sim publishes them (AreaInfo.dimensions), else sizes derived from the radius. */
  private area(e: EntityView, local: PlayerTeam): void {
    const enemy = e.team !== local;
    const rim = enemy ? ENEMY_RED : ALLY_TEAL;
    const rimK = enemy ? AREA.rim : AREA.rim * AREA.rimAllyDim;
    const fill = teamColour(e);
    const pulse = 1 + AREA.pulseDepth * Math.sin(this.clock * AREA.pulseHz * TAU);
    const r = e.radius;
    const { x, z } = this;
    const ground = this.y + AREA.ringLift;
    const sy = Math.sin(e.yaw);
    const cy = Math.cos(e.yaw);
    const d = e.area?.dimensions;
    switch (e.type) {
      case 'sphere': {
        const rr = d?.kind === 'sphere' ? d.radius : r;
        this.sphere(x, this.y, z, rr, fill, AREA.fill * pulse);
        this.ring(x, ground, z, rr, rim, rimK);
        break;
      }
      case 'cylinder': {
        const rr = d?.kind === 'cylinder' ? d.radius : r;
        const h = d?.kind === 'cylinder' ? d.half * 2 : AREA.cylinderHeight;
        this.put('cylinder', identity(), x, this.y + h / 2, z, rr, h, rr, fill, AREA.fill * pulse);
        this.ring(x, ground, z, rr, rim, rimK);
        break;
      }
      case 'cone': {
        const len = d?.kind === 'cone' ? d.length : r;
        const half = d?.kind === 'cone' ? Math.acos(d.cosHalf) : AREA.coneHalfAngleDeg * DEG;
        const base = len * Math.tan(half);
        this.put('cone', faceZ(this.q, sy, 0, cy), x, this.y + AREA_DRAW.coneLift, z, base, base, len, fill, AREA.fill * AREA_DRAW.coneFillBoost * pulse);
        break;
      }
      case 'ring': {
        const outer = d?.kind === 'ring' ? d.outer : r;
        const inner = d?.kind === 'ring' ? d.inner : r * AREA_DRAW.innerScale;
        this.ring(x, ground, z, outer, rim, rimK);
        this.ring(x, ground, z, inner, fill, AREA.fill * AREA_DRAW.ringFillBoost * pulse);
        break;
      }
      default: {
        // box
        const w = d?.kind === 'box' ? d.halfX * 2 : r * AREA.boxWidthPerRadius;
        const l = d?.kind === 'box' ? d.halfZ * 2 : r * AREA.boxLengthPerRadius;
        const h = d?.kind === 'box' ? d.half * 2 : AREA.boxHeight;
        this.put('box', faceZ(this.q, sy, 0, cy), x, this.y + h / 2, z, w, h, l, fill, AREA.fill * pulse);
        this.ring(x, ground, z, Math.max(w, l) / 2, rim, rimK * AREA_DRAW.rimFade);
      }
    }
  }

  /** Trap, turret and wall placeholders until the Technical Artist models them. */
  private summon(e: EntityView): void {
    const col = teamColour(e);
    switch (e.type) {
      case 'trap':
        this.put('cylinder', identity(), this.x, this.y + SUMMON.trap.height / 2, this.z, e.radius * SUMMON.trap.radiusScale, SUMMON.trap.height, e.radius * SUMMON.trap.radiusScale, col, SUMMON.trap.colourDim);
        this.sphere(this.x, this.y + SUMMON.trap.height, this.z, e.radius * SUMMON_DRAW.trapCore, WHITE, SUMMON_DRAW.trapAlpha);
        break;
      case 'turret':
        this.put('cylinder', identity(), this.x, this.y + SUMMON.turret.height / 2, this.z, e.radius * SUMMON.turret.radiusScale, SUMMON.turret.height, e.radius * SUMMON.turret.radiusScale, col, SUMMON.fill);
        this.sphere(this.x, this.y + SUMMON.turret.height, this.z, e.radius, col, SUMMON_DRAW.turretAlpha);
        break;
      default:
        this.put('box', faceZ(this.q, Math.sin(e.yaw), 0, Math.cos(e.yaw)), this.x, this.y + SUMMON.wall.height / 2, this.z, SUMMON.wall.width, SUMMON.wall.height, SUMMON.wall.depth, col, SUMMON.fill);
    }
  }

  /** Melee pose from state: charge gathers, light and heavy lunge forward, parry holds a guard ring. */
  private melee(e: EntityView): void {
    const fx = Math.sin(e.yaw);
    const fz = Math.cos(e.yaw);
    const y = this.y + MELEE.height;
    switch (e.meleePose) {
      case 'charging': {
        const p = 1 + MELEE_DRAW.chargeSwell * Math.sin(this.clock * MELEE.chargeHz * TAU);
        this.sphere(this.x + fx * MELEE.reach * MELEE_DRAW.chargeAt, y, this.z + fz * MELEE.reach * MELEE_DRAW.chargeAt, MELEE.chargeRadius * p, MELEE.charge, 1);
        break;
      }
      case 'light':
      case 'heavy': {
        const heavy = e.meleePose === 'heavy';
        const len = heavy ? MELEE.heavyLunge : MELEE.lightLunge;
        this.put('box', faceZ(this.q, fx, 0, fz), this.x + (fx * len) / 2, y, this.z + (fz * len) / 2, heavy ? MELEE_DRAW.heavyWidth : MELEE_DRAW.lightWidth, MELEE_DRAW.thickness, len, heavy ? MELEE.heavy : MELEE.light, MELEE_DRAW.alpha);
        break;
      }
      default:
        this.ring(this.x + fx * MELEE.reach * MELEE_DRAW.guardAt, y, this.z + fz * MELEE.reach * MELEE_DRAW.guardAt, MELEE.guardRadius, MELEE.parry, 1);
    }
  }

  /** Stun orbits above the head; silence is a violet pulse over it; root, slow and grounded ring the feet. */
  private markers(e: EntityView, bits: number): void {
    const b = bits | ((e.flags & ViewFlag.Stunned) !== 0 ? MARKER_BITS.stun : 0) | ((e.flags & ViewFlag.Silenced) !== 0 ? MARKER_BITS.silence : 0);
    if (b === 0) return;
    const head = this.y + HEAD[e.kind === 'hero' ? 'hero' : 'unit'];
    const orbit = this.clock * MARKER.orbitHz * TAU;
    if ((b & MARKER_BITS.stun) !== 0) {
      for (let i = 0; i < MARKER_DRAW.stunDots; i++) {
        const a = orbit + (i * TAU) / MARKER_DRAW.stunDots;
        this.sphere(this.x + Math.cos(a) * MARKER.orbitRadius, head, this.z + Math.sin(a) * MARKER.orbitRadius, MARKER.dot, MARKER.stun, 1);
      }
    }
    if ((b & MARKER_BITS.disarm) !== 0) this.sphere(this.x + Math.cos(-orbit) * MARKER.orbitRadius, head - MARKER_DRAW.disarmDrop, this.z + Math.sin(-orbit) * MARKER.orbitRadius, MARKER.dot * MARKER_DRAW.disarmScale, MARKER.disarm, 1);
    if ((b & MARKER_BITS.silence) !== 0) {
      const p = 1 + MARKER_DRAW.silenceSwell * Math.sin(orbit * 2);
      this.sphere(this.x, head + MARKER_DRAW.silenceLift, this.z, MARKER.dot * MARKER_DRAW.silenceDot * p, MARKER.silence, 1);
      this.ring(this.x, head + MARKER_DRAW.silenceLift, this.z, MARKER.orbitRadius * MARKER_DRAW.silenceRing * p, MARKER.silence, MARKER_DRAW.silenceRingAlpha);
    }
    const foot = Math.max(e.radius * MARKER.ringScale, MARKER_DRAW.footMin);
    if ((b & MARKER_BITS.root) !== 0) this.ring(this.x, this.y + MARKER.ringLift, this.z, foot, MARKER.root, 1);
    if ((b & MARKER_BITS.slow) !== 0) this.ring(this.x, this.y + MARKER.ringLift * 2, this.z, foot * MARKER_DRAW.slowScale, MARKER.slow, MARKER_DRAW.ringAlpha);
    if ((b & MARKER_BITS.grounded) !== 0) this.ring(this.x, this.y + MARKER.ringLift * MARKER_DRAW.groundedSteps, this.z, foot * MARKER_DRAW.groundedScale, MARKER.grounded, MARKER_DRAW.ringAlpha);
  }

  private tetherLinks(frame: Frame, src: Source): void {
    for (let i = this.tethers.length - 1; i >= 0; i--) {
      const t = this.tethers[i];
      const a = t ? src.entity(t.source) : undefined;
      const b = t ? src.entity(t.target) : undefined;
      if (!t || !a || !b || (a.flags & ViewFlag.Dead) !== 0 || (b.flags & ViewFlag.Dead) !== 0) {
        this.tethers.splice(i, 1);
        continue;
      }
      this.at(frame, a);
      const fx = this.x;
      const fy = this.y + chestHeight(a);
      const fz = this.z;
      this.at(frame, b);
      const tx = this.x;
      const ty = this.y + chestHeight(b);
      const tz = this.z;
      const dx = tx - fx;
      const dy = ty - fy;
      const dz = tz - fz;
      const len = Math.hypot(dx, dy, dz);
      if (len < TETHER_DRAW.minLength) continue;
      const w = TETHER.width * (1 + TETHER.pulseDepth * Math.sin(this.clock * TETHER.pulseHz * TAU));
      this.put('box', faceZ(this.q, dx / len, dy / len, dz / len), (fx + tx) / 2, (fy + ty) / 2, (fz + tz) / 2, w, w, len, a.team === b.team ? TETHER.ally : TETHER.enemy, TETHER_DRAW.alpha);
    }
  }

  private hitFlashes(frame: Frame, src: Source, dt: number): void {
    for (const f of this.flashes) {
      if (!f.live) continue;
      f.age += dt;
      const e = src.entity(f.id);
      if (f.age >= HIT_FLASH.life || !e) {
        f.live = false;
        continue;
      }
      this.at(frame, e);
      this.sphere(this.x, this.y + Math.max(HIT_FLASH.lift, e.radius * HIT_FLASH_DRAW.radiusScale), this.z, Math.max(HIT_FLASH.minRadius, e.radius * HIT_FLASH.scale), HIT_FLASH.colour, HIT_FLASH_DRAW.alpha * (1 - f.age / HIT_FLASH.life));
    }
  }
}

function teamColour(e: EntityView): number {
  return e.team === 'neutral' ? NEUTRAL_COLOUR : TEAM_COLOURS[e.team].primary;
}
