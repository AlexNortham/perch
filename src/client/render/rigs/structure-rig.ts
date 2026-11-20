/* eslint-disable @typescript-eslint/no-magic-numbers -- shader text and animation curves: the numbers are the look */
/**
 * A structure's model (style guide §9.2; D-ART-014). Owner: Technical Artist (ART-W).
 * - A three.js LOD of three levels (0, 40 and 90 m, 10 % hysteresis); each level is the architecture (the material
 *   library's opaque material) and the statue (its own glow material: one program shared by every structure), plus a
 *   Shrine's turning rings. Two draw calls per structure.
 * - States: idle (eyes and core at 30 % glow), targeting (100 %, eased), the Patron's transition (shaking, flickering)
 *   and phase two (the darker variant with glowing seams, eyes at full glow pulsing at 1 Hz, the heart-feather).
 *   Damage below 66 % and 33 % HP swaps in cracked and broken architecture (chips, torn banners).
 * - Destroyed: the sim despawns a structure as it dies, so the kit calls `ruin()` and keeps what it returns: rubble that
 *   stays for the match, the statue toppling to the ground, dust for 10 s and the glow dying over 2 s.
 * - The Brood Ward is one instanced eggshell shared by every structure: a crackle pattern, a fresnel rim and a fill of
 *   10 %; when a ward drops its shell breaks into shards that fly out and fade in 0.8 s (GDD §7.6).
 * Everything is read from EntityView: hp, structure.phase, transitionUntil, broodWard, target, weakPoint.
 */
import {
  BufferGeometry, Color, DoubleSide, Euler, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, LOD, Matrix4,
  Mesh, MeshBasicMaterial, Quaternion, ShaderMaterial, SphereGeometry, Vector3,
} from 'three';
import type { Material } from 'three';
import type { EntityView, SimView } from '../../../sim/core/contracts';
import { STRUCTURE as S } from '../models/constants';
import { DAMAGE_AT, STRUCTURE_LOD } from '../models/structures';
import type { Damage, Lod, StructureBuild } from '../models/structures';
import { glowMaterial } from '../models/world-mesh';
import type { GlowMaterial } from '../models/world-mesh';

/** Glow levels (style guide §9.2) and how fast they ease (per second). */
export const STRUCTURE_GLOW = { idle: 0.3, target: 1, ease: 4, dying: 2, heartRate: 1, ringSpin: 0.12, dust: 10, shatter: 0.8 } as const;

const hidden = new Matrix4().makeScale(0, 0, 0);
const matrix = new Matrix4();
const quat = new Quaternion();
const size = new Vector3();
const eulerNone = new Euler();

const DOME_VERTEX = /* glsl */ `
attribute vec3 shard;
attribute float instanceBreak;
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vViewPos;
varying float vBreak;
void main() {
  float b = clamp(instanceBreak, 0.0, 1.0);
  vec3 out_ = normalize(shard);
  vec3 p = shard + (position - shard) * (1.0 - 0.5 * b) + out_ * (0.6 * b) + vec3(0.0, -1.2 * b * b, 0.0);
  vObj = position;
  vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(p, 1.0);
  vViewPos = mv.xyz;
  vNormalV = normalize(mat3(viewMatrix) * mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vBreak = instanceBreak;
  gl_Position = projectionMatrix * mv;
}
`;

const DOME_FRAGMENT = /* glsl */ `
uniform vec3 uShell;
uniform vec3 uRim;
varying vec3 vObj;
varying vec3 vNormalV;
varying vec3 vViewPos;
varying float vBreak;
vec3 domeHash(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
// Eggshell crackle: the gap between the nearest and second-nearest cell of a jittered 3D grid.
float crackle(vec3 p) {
  vec3 b = floor(p);
  float f1 = 9.0, f2 = 9.0;
  for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec3 c = b + vec3(float(i), float(j), float(k));
    float d = length(p - c - domeHash(c));
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return f2 - f1;
}
void main() {
  if (vBreak < 0.0) discard;
  float facing = abs(dot(normalize(vNormalV), normalize(-vViewPos)));
  float rim = pow(1.0 - facing, 3.0);
  float line = 1.0 - smoothstep(0.02, 0.09, crackle(vObj * 4.5));
  float a = (0.1 + 0.55 * rim + 0.3 * line) * (1.0 - clamp(vBreak, 0.0, 1.0));
  vec3 col = mix(uShell, uRim, rim) * (1.0 + 0.25 * line);
  gl_FragColor = vec4(col, a);
}
`;

/** A sphere whose triangles are each a shard (each vertex knows its triangle's centre). */
function shardSphere(segments: number): BufferGeometry {
  const g = new SphereGeometry(1, segments, segments / 2).toNonIndexed();
  const p = g.getAttribute('position');
  const shard = new Float32Array(p.count * 3);
  for (let t = 0; t < p.count; t += 3) {
    for (let c = 0; c < 3; c++) {
      const m = (p.getComponent(t, c) + p.getComponent(t + 1, c) + p.getComponent(t + 2, c)) / 3;
      for (let k = 0; k < 3; k++) shard[(t + k) * 3 + c] = m;
    }
  }
  g.setAttribute('shard', new Float32BufferAttribute(shard, 3));
  return g;
}

/** The shared instanced Brood Ward domes. */
export class DomeGroup {
  readonly mesh: InstancedMesh;
  private readonly breaks: InstancedBufferAttribute;
  private readonly freed: number[] = [];
  private next = 0;
  /** Slots whose dome is showing: the mesh is only drawn while there is one. */
  private readonly up = new Set<number>();

  constructor(readonly capacity = S.domeCapacity) {
    const material = new ShaderMaterial({
      vertexShader: DOME_VERTEX,
      fragmentShader: DOME_FRAGMENT,
      uniforms: { uShell: { value: new Color(S.domeColour) }, uRim: { value: new Color(0xfff6e4) } },
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    const geo = shardSphere(S.domeSegments * 2);
    this.breaks = new InstancedBufferAttribute(new Float32Array(capacity).fill(-1), 1);
    geo.setAttribute('instanceBreak', this.breaks);
    this.mesh = new InstancedMesh(geo, material, capacity);
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

  /** Show a dome (break 0 whole, up to 1 shattered and gone) or hide it (radius 0). */
  set(slot: number, at: Vector3, radius: number, shatter = 0): void {
    if (slot < 0) return;
    if (radius > 0) this.up.add(slot);
    else this.up.delete(slot);
    this.mesh.visible = this.up.size > 0;
    quat.setFromEuler(eulerNone);
    this.mesh.setMatrixAt(slot, radius > 0 ? matrix.compose(at, quat, size.set(radius, radius * S.domeSquash, radius)) : hidden);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.breaks.setX(slot, radius > 0 ? shatter : -1);
    this.breaks.needsUpdate = true;
  }

  release(slot: number): void {
    if (slot < 0) return;
    this.set(slot, size, 0);
    this.freed.push(slot);
  }
}

export interface StructureMaterials {
  /** The material library's opaque material (current quality). */
  readonly arch: () => Material;
  readonly heart: Material;
}

/** What is left of a destroyed structure: rubble, the fallen statue and its dust. */
export class Ruin extends Group {
  private age = 0;
  private readonly statue: Group;
  private readonly from = new Matrix4();
  private readonly dust: Mesh;
  private readonly dustMat: MeshBasicMaterial;

  constructor(build: StructureBuild, arch: Material, private readonly glow: GlowMaterial, statue: BufferGeometry, private readonly glowFrom: number) {
    super();
    this.name = 'ruin';
    const lod = new LOD();
    STRUCTURE_LOD.from.forEach((d, i) => {
      const m = new Mesh(build.arch(i as Lod, 3), arch);
      m.castShadow = true;
      m.receiveShadow = true;
      lod.addLevel(m, d, STRUCTURE_LOD.hysteresis);
    });
    this.add(lod);
    this.statue = new Group();
    const s = new Mesh(statue, glow.material);
    s.castShadow = true;
    this.statue.add(s);
    this.add(this.statue);
    glow.glow.value = glowFrom;
    this.dustMat = new MeshBasicMaterial({ color: 0xb8ab94, transparent: true, opacity: 0.5, depthWrite: false });
    const puffs: BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const g = new IcosahedronGeometry(0.9 + 0.5 * ((i * 7) % 3) / 2, 1);
      g.translate(Math.sin(a) * 2.2, 0.6 + (i % 3) * 0.7, Math.cos(a) * 2.2);
      puffs.push(g);
    }
    const merged = new BufferGeometry();
    const pos: number[] = [];
    for (const g of puffs) {
      const ng = g.toNonIndexed();
      pos.push(...(ng.getAttribute('position').array as Float32Array));
    }
    merged.setAttribute('position', new Float32BufferAttribute(pos, 3));
    this.dust = new Mesh(merged, this.dustMat);
    this.dust.renderOrder = 4;
    this.add(this.dust);
    this.fall = build.fall;
    this.from.identity();
  }

  private readonly fall: StructureBuild['fall'];

  /** Advance the fall, the dust and the dying glow (it stays in the scene for the match). */
  update(dt: number): void {
    this.age += dt;
    const f = this.fall;
    const u = Math.min(1, this.age / f.time);
    // Gravity's ease-in, a small bounce as it lands.
    const e = u * u * (1 + 0.15 * Math.sin(Math.PI * u));
    const pivot = new Vector3(...f.pivot);
    const q = new Quaternion().setFromEuler(new Euler(f.rot[0] * e, f.rot[1] * e, f.rot[2] * e));
    const offset = new Vector3(...f.to).multiplyScalar(e);
    // Rotate about the pivot, then slide to the resting place.
    this.statue.position.copy(pivot).sub(pivot.clone().applyQuaternion(q)).add(offset);
    this.statue.quaternion.copy(q);
    this.glow.glow.value = this.glowFrom * Math.max(0, 1 - this.age / STRUCTURE_GLOW.dying);
    const d = this.age / STRUCTURE_GLOW.dust;
    this.dust.visible = d < 1;
    this.dust.scale.setScalar(0.6 + 1.6 * Math.sqrt(Math.min(1, d)));
    this.dust.position.y = 1.5 * d;
    this.dustMat.opacity = 0.5 * Math.max(0, 1 - d) * Math.min(1, this.age * 3);
  }

  /** Free what this ruin owns (its dust and glow material; the geometry is the build's). */
  free(): void {
    this.dustMat.dispose();
    this.dust.geometry.dispose();
    this.glow.material.dispose();
  }
}

export class StructureRig extends Group {
  private readonly inner = new Group();
  private readonly lod = new LOD();
  private readonly arch: Mesh[] = [];
  private readonly statues: Mesh[] = [];
  private readonly rings: Mesh[] = [];
  private readonly heart: Mesh | null = null;
  private readonly glow: GlowMaterial;
  private slot = -1;
  /** Ward bookkeeping: whether the dome is up, and seconds since it broke (-1 while it stands or is gone). */
  private ward = false;
  private crack = -1;
  private readonly wardAt = new Vector3();
  private damage: Damage = 0;
  private variant = 0;
  private glowNow: number = STRUCTURE_GLOW.idle;

  constructor(private readonly build: StructureBuild, private readonly mat: StructureMaterials, private readonly domes: DomeGroup) {
    super();
    this.glow = glowMaterial('material');
    this.glow.glow.value = STRUCTURE_GLOW.idle;
    this.add(this.inner);
    STRUCTURE_LOD.from.forEach((d, i) => {
      const level = new Group();
      const a = new Mesh(build.arch(i as Lod, 0), mat.arch());
      const s = new Mesh(build.statue(i as Lod, 0), this.glow.material);
      for (const m of [a, s]) {
        m.castShadow = true;
        m.receiveShadow = true;
        level.add(m);
      }
      this.arch.push(a);
      this.statues.push(s);
      if (build.rings) {
        const r = new Mesh(build.rings(i as Lod), mat.arch());
        r.castShadow = i < 2;
        level.add(r);
        this.rings.push(r);
      }
      this.lod.addLevel(level, d, STRUCTURE_LOD.hysteresis);
    });
    this.inner.add(this.lod);
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

  /** The eyes' and core's glow now (0.3 idle, 1 targeting). */
  get glowLevel(): number {
    return this.glowNow;
  }

  animate(e: EntityView, dt: number, t: number, view: SimView): void {
    const info = e.structure;
    const b = this.build;
    const hasTarget = (info?.target ?? null) !== null;
    const patron = e.type === 'patron';
    const transition = patron && info?.transitionUntil !== undefined && info.transitionUntil > view.tick;
    const phase2 = patron && info?.phase === 2;

    // Materials follow the current quality's library.
    const arch = this.mat.arch();
    if (this.arch[0]?.material !== arch) for (const m of [...this.arch, ...this.rings]) m.material = arch;

    // Damage stage from HP; the statue's variant from the Heron's stride or the Patron's phase.
    const frac = e.maxHp > 0 ? e.hp / e.maxHp : 1;
    const damage: Damage = frac < DAMAGE_AT[1] ? 2 : frac < DAMAGE_AT[0] ? 1 : 0;
    let variant = 0;
    if (e.type === 'heron') {
      const swing = Math.sin(t * (hasTarget ? S.stompRate : S.stepRate));
      variant = Math.abs(swing) < S.stepDeadZone ? 0 : swing > 0 ? 1 : 2;
    } else if (phase2) variant = 1;
    if (damage !== this.damage) {
      this.damage = damage;
      this.arch.forEach((m, i) => (m.geometry = b.arch(i as Lod, damage)));
    }
    if (variant !== this.variant) {
      this.variant = variant;
      this.statues.forEach((m, i) => (m.geometry = b.statue(i as Lod, variant)));
    }

    // Glow: idle 30 %, targeting 100 %; the transition flickers; phase two pulses at 1 Hz.
    const want = transition ? (Math.sin(t * S.shakeRate * S.flashRatio) > 0 ? 1.2 : 0.3) : phase2 ? 0.85 + 0.25 * Math.sin(t * Math.PI * 2 * STRUCTURE_GLOW.heartRate) : hasTarget ? STRUCTURE_GLOW.target : STRUCTURE_GLOW.idle;
    this.glowNow += (want - this.glowNow) * Math.min(1, dt * STRUCTURE_GLOW.ease * (transition ? 6 : 1));
    this.glow.glow.value = this.glowNow;
    for (const r of this.rings) r.rotation.y = t * STRUCTURE_GLOW.ringSpin * (hasTarget ? 3 : 1);

    // Patron: breathes, shakes through the transition, a little larger in phase 2; heart-feather from the transition on.
    let shakeX = 0;
    let shakeZ = 0;
    if (transition) {
      shakeX = Math.sin(t * S.shakeRate) * S.shakeAmp;
      shakeZ = Math.cos(t * S.shakeRate * S.shakeRatio) * S.shakeAmp;
    }
    const scale = (phase2 ? S.phase2Scale : 1) * (1 + (patron ? Math.sin(t * S.pulseRate) * S.breathe : 0));
    this.inner.position.set(shakeX, 0, shakeZ);
    this.inner.scale.setScalar(scale);
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
      const pulse = transition ? S.flashMin + (1 - S.flashMin) * Math.sin(t * S.shakeRate * S.flashRatio) : 0.9 + 0.1 * Math.sin(t * Math.PI * 2 * STRUCTURE_GLOW.heartRate);
      this.heart.scale.multiplyScalar(pulse);
      this.heart.rotation.y = t * S.heartSpin;
    }

    // Brood Ward dome: up while info.broodWard; when it breaks it shatters and fades.
    const up = info?.broodWard ?? false;
    if (up) {
      this.ward = true;
      this.crack = -1;
    } else if (this.ward) {
      this.ward = false;
      this.crack = 0;
    }
    let radius = 0;
    let shatter = 0;
    if (this.ward) radius = b.dome.radius;
    else if (this.crack >= 0) {
      this.crack += dt;
      shatter = this.crack / STRUCTURE_GLOW.shatter;
      radius = shatter >= 1 ? 0 : b.dome.radius;
      if (shatter >= 1) this.crack = -1;
    }
    this.wardAt.set(this.position.x, this.position.y + b.dome.y, this.position.z);
    this.domes.set(this.slot, this.wardAt, radius, shatter);
  }

  /** The ruin this structure leaves where it stands (world transform), for the kit to keep after the rig is removed. */
  ruin(): Ruin {
    const r = new Ruin(this.build, this.mat.arch(), glowMaterial('material'), this.build.statue(0, this.variant), this.glowNow);
    this.updateWorldMatrix(true, false);
    this.matrixWorld.decompose(r.position, r.quaternion, r.scale);
    return r;
  }
}
