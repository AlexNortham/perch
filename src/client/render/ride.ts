/**
 * The local bird's Updraft ride and boost (G16, style guide §10.7): thin speed lines streaming out from the screen
 * centre, drawn in screen space after the scene so they never become world-space slabs in front of the camera.
 * Every line stays outside the central 50 % of the screen, at most RIDE.width px wide, RIDE.length of the screen
 * height long and RIDE.alpha strong; boosting adds lines, speed and a warmer tint. The camera keeps its FOV kick.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  Vector3,
} from 'three';
import type { WebGLRenderer } from 'three';
import { ViewFlag } from '../../sim/core/contracts';
import type { Frame } from '../app/contracts';
import { RIDE } from './constants';

interface Streak {
  angle: number;
  /** Distance of the inner end from the centre, as a multiple of the central box's edge along this angle. */
  r: number;
  speed: number;
  length: number;
  phase: number;
}

const Z_AXIS = new Vector3(0, 0, 1);

export function rideOf(frame: Frame): { riding: boolean; boosting: boolean } {
  const me = frame.curr.localHero === null ? undefined : frame.curr.entities.find((e) => e.id === frame.curr.localHero);
  if (!me || (me.flags & ViewFlag.OnUpdraft) === 0) return { riding: false, boosting: false };
  return { riding: true, boosting: Math.hypot(me.vel.x, me.vel.y, me.vel.z) > RIDE.boostSpeed };
}

export class RideOverlay {
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(0, 1, 1, 0, -1, 1);
  private readonly mesh: InstancedMesh;
  private readonly streaks: Streak[] = [];
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly p = new Vector3();
  private readonly s = new Vector3();
  private readonly cool = new Color(RIDE.colour);
  private readonly warm = new Color(RIDE.boostColour);
  private readonly c = new Color();
  private readonly tint = new Color();
  private ride = 0;
  private boost = 0;
  private seed: number = RIDE.seed;

  constructor() {
    // A unit streak along +x from 0 to 1, bright in the middle and fading at both ends.
    const g = new PlaneGeometry(1, 1, RIDE.segments, 1).translate(1 / 2, 0, 0);
    const pos = g.getAttribute('position');
    const col = new Float32Array(pos.count * RIDE.rgb);
    for (let i = 0; i < pos.count; i++) col.fill(Math.sin(pos.getX(i) * Math.PI), i * RIDE.rgb, (i + 1) * RIDE.rgb);
    g.setAttribute('color', new BufferAttribute(col, RIDE.rgb));
    const mat = new MeshBasicMaterial({ vertexColors: true, blending: AdditiveBlending, transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
    this.mesh = new InstancedMesh(g, mat, RIDE.max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.scene.add(this.mesh);
    for (let i = 0; i < RIDE.max; i++) this.streaks.push(this.spawn({ angle: 0, r: 0, speed: 0, length: 0, phase: 0 }, true));
  }

  private rand(): number {
    this.seed = (Math.imul(this.seed, RIDE.lcgMul) + RIDE.lcgAdd) >>> 0;
    return this.seed / RIDE.lcgRange;
  }

  private spawn(s: Streak, anywhere: boolean): Streak {
    s.angle = this.rand() * Math.PI * 2;
    s.r = 1 + (anywhere ? this.rand() * RIDE.reach : 0);
    s.speed = RIDE.speedMin + (RIDE.speedMax - RIDE.speedMin) * this.rand();
    s.length = RIDE.lengthMin + (1 - RIDE.lengthMin) * this.rand();
    s.phase = this.rand();
    return s;
  }

  /** Ease in and out, advance the lines, and draw over the frame already on the canvas. */
  render(gl: WebGLRenderer, frame: Frame, width: number, height: number): void {
    const { riding, boosting } = rideOf(frame);
    const dt = Math.min(frame.dt, RIDE.maxDt);
    const ease = (v: number, on: boolean): number => Math.min(1, Math.max(0, v + (on ? dt / RIDE.fadeIn : -dt / RIDE.fadeOut)));
    this.ride = ease(this.ride, riding);
    this.boost = ease(this.boost, riding && boosting);
    if (this.ride <= 0) return;
    const n = Math.round(RIDE.count + (RIDE.max - RIDE.count) * this.boost);
    const [cx, cy] = [width / 2, height / 2];
    const lineW = Math.min(RIDE.width, RIDE.width * (1 + this.boost) / 2 + 1);
    const maxLen = RIDE.length * height;
    this.c.copy(this.cool).lerp(this.warm, this.boost);
    for (let i = 0; i < n; i++) {
      const s = this.streaks[i];
      if (!s) continue;
      s.r += dt * s.speed * (1 + RIDE.boostSpeedUp * this.boost);
      if (s.r > 1 + RIDE.reach) this.spawn(s, false);
      const dx = Math.cos(s.angle);
      const dy = Math.sin(s.angle);
      // The central box's edge (the central 50 %: half-size width/4 × height/4) along this direction.
      const edge = Math.min((width / RIDE.boxDiv) / Math.max(Math.abs(dx), RIDE.eps), (height / RIDE.boxDiv) / Math.max(Math.abs(dy), RIDE.eps));
      const inner = s.r * edge;
      const len = Math.min(maxLen, s.length * maxLen * (1 + (s.r - 1) * RIDE.stretch));
      // Fade with age along the run so lines appear and vanish softly; never above RIDE.alpha.
      const life = Math.sin(Math.min(1, (s.r - 1) / RIDE.reach) * Math.PI);
      const k = RIDE.alpha * this.ride * life * (RIDE.flicker + (1 - RIDE.flicker) * s.phase);
      this.q.setFromAxisAngle(Z_AXIS, s.angle);
      this.m.compose(this.p.set(cx + dx * inner, cy + dy * inner, 0), this.q, this.s.set(len, lineW, 1));
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, this.tint.copy(this.c).multiplyScalar(k));
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.camera.right = width;
    this.camera.top = height;
    this.camera.updateProjectionMatrix();
    const auto = gl.autoClear;
    gl.autoClear = false;
    gl.render(this.scene, this.camera);
    gl.autoClear = auto;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.mesh.dispose();
  }
}
