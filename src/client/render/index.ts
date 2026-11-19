/**
 * The renderer (client contract `Renderer`): a lit, fogged, shadowed Three.js scene with the map blockout
 * (blockout.ts) and one model per entity from the ModelKit (entities.ts). Owner: Rendering & VFX.
 */
import {
  CanvasTexture,
  Color,
  DirectionalLight,
  EquirectangularReflectionMapping,
  FogExp2,
  HemisphereLight,
  LinearSRGBColorSpace,
  MathUtils,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { MapData } from '../../sim/core/contracts';
import type { CameraPose, Quality, Renderer } from '../app/contracts';
import { buildBlockout } from './blockout';
import type { Blockout } from './blockout';
import { createEntityLayer } from './entities';
import { registerHost } from '../app/render-host';
import type { RenderHost } from '../app/render-host';
import {
  FAR_MAX,
  FAR_MIN,
  FOG_HEIGHT_REF,
  FOG_OPAQUE,
  LIGHT_UNIT,
  NEAR,
  NEAR_PER_HEIGHT,
  QUALITY_PRESETS,
  SHADOW_BIAS,
  SHADOW_DISTANCE,
  SHADOW_FIT,
  SHADOW_INTENSITY,
  SHADOW_MAX_HALF,
  SHADOW_MIN_HALF,
  SHADOW_NORMAL_BIAS,
  SHADOW_RADIUS,
  SKY_CURVE,
  SKY_HORIZON_HAZE,
  SKY_SIZE,
  SUN,
  TONE_EXPOSURE,
} from './constants';
import { FIXTURE_MAP } from './fixture';
import { createModelKit } from './models';
import { LIGHT_COLOURS, SKY_COLOURS } from '../app/palette';

export { DAWN_COLOURS, DUSK_COLOURS, TEAM_COLOURS } from '../app/palette';

declare global {
  interface Window {
    /** Dev builds only, for measurement: the last frame's draw calls and triangles, and a live quality switch. */
    __perchRender?: { info(): { calls: number; triangles: number }; setQuality(q: Quality): void };
  }
}

const DEG = MathUtils.DEG2RAD;
const RGBA = 4;
const BYTE = 255;
/** Shadow box half-sizes snap to this step so the texel size (and edge shimmer) only changes in jumps. */
const SHADOW_HALF_STEP = 5;
const UP = new Vector3(0, 1, 0);

/** Equirectangular sky (GDD §14.2): peach over Dawn's side (−z), violet over Dusk's (+z); fog colour below the horizon. */
function skyTexture(): CanvasTexture {
  const { width, height } = SKY_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const tex = new CanvasTexture(canvas);
  if (!ctx) return tex;
  const img = ctx.createImageData(width, height);
  // Raw sRGB components (no conversion to linear): the canvas is sRGB.
  const c = (hex: number): Color => new Color().setHex(hex, LinearSRGBColorSpace);
  const fog = c(LIGHT_COLOURS.fog);
  const out = new Color();
  for (let x = 0; x < width; x++) {
    // Three's equirect lookup: u = atan2(z, x) / 2π + ½.
    const theta = ((x + 1 / 2) / width - 1 / 2) * 2 * Math.PI;
    const north = (Math.sin(theta) + 1) / 2;
    const horizon = c(SKY_COLOURS.southHorizon).lerp(c(SKY_COLOURS.northHorizon), north).lerp(fog, SKY_HORIZON_HAZE);
    const zenith = c(SKY_COLOURS.southZenith).lerp(c(SKY_COLOURS.northZenith), north);
    for (let y = 0; y < height; y++) {
      const up = 1 - 2 * ((y + 1 / 2) / height); // +1 zenith … −1 nadir
      if (up <= 0) out.copy(fog);
      else out.copy(horizon).lerp(zenith, up ** SKY_CURVE);
      img.data.set([out.r * BYTE, out.g * BYTE, out.b * BYTE, BYTE], (y * width + x) * RGBA);
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.colorSpace = SRGBColorSpace;
  tex.mapping = EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  return tex;
}

export function createRenderer(container: HTMLElement, map: MapData, quality: Quality): Renderer {
  let preset = QUALITY_PRESETS[quality];
  let size = { width: Math.max(1, container.clientWidth), height: Math.max(1, container.clientHeight) };

  const scene = new Scene();
  scene.background = skyTexture();
  const fog = new FogExp2(LIGHT_COLOURS.fog, preset.fogDensity);
  scene.fog = fog;
  scene.add(new HemisphereLight(LIGHT_COLOURS.hemiSky, LIGHT_COLOURS.hemiGround, SUN.hemiIntensity * LIGHT_UNIT));
  const sun = new DirectionalLight(LIGHT_COLOURS.sun, SUN.intensity * LIGHT_UNIT);
  const elevation = SUN.elevationDeg * DEG;
  const toSun = new Vector3(SUN.azimuth.x * Math.cos(elevation), Math.sin(elevation), SUN.azimuth.z * Math.cos(elevation)).normalize();
  const shadowRight = new Vector3().crossVectors(UP, toSun).normalize();
  const shadowUp = new Vector3().crossVectors(toSun, shadowRight);
  sun.shadow.bias = SHADOW_BIAS;
  sun.shadow.normalBias = SHADOW_NORMAL_BIAS;
  sun.shadow.radius = SHADOW_RADIUS;
  sun.shadow.intensity = SHADOW_INTENSITY;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = SHADOW_DISTANCE * 2;
  scene.add(sun, sun.target);

  const makeGl = (): WebGLRenderer => {
    const r = new WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, preset.maxPixelRatio) * preset.renderScale);
    r.setSize(size.width, size.height);
    r.toneMapping = NeutralToneMapping;
    r.toneMappingExposure = TONE_EXPOSURE;
    r.shadowMap.enabled = preset.shadowMapSize > 0;
    r.shadowMap.type = PCFShadowMap;
    r.domElement.style.cssText = 'display:block;width:100%;height:100%';
    sun.castShadow = preset.shadowMapSize > 0;
    sun.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
    return r;
  };
  let gl = makeGl();
  container.appendChild(gl.domElement);

  // Dev builds only, for framing renderer screenshots: ?renderFixture swaps the main map for the renderer's own test
  // map (fixture.ts); ?renderCam=x,y,z,tx,ty,tz fixes the camera position and target.
  const dev = import.meta.env.DEV ? new URLSearchParams(location.search) : null;
  const devCam = (dev?.get('renderCam') ?? '').split(',').map(Number);
  const [cx, cy, cz, tx, ty, tz] = devCam;
  const devPose = tz !== undefined && devCam.every(Number.isFinite) && cx !== undefined && cy !== undefined && cz !== undefined && tx !== undefined && ty !== undefined
    ? { position: { x: cx, y: cy, z: cz }, target: { x: tx, y: ty, z: tz } }
    : null;

  let blockout: Blockout | null = null;
  let current: MapData | null = null;
  const setMap = (m: MapData): void => {
    const next = m.id === 'main' && dev?.has('renderFixture') ? FIXTURE_MAP : m;
    if (next === current) return;
    current = next;
    if (blockout) {
      scene.remove(blockout.root);
      blockout.dispose();
    }
    blockout = buildBlockout(next);
    scene.add(blockout.root);
  };
  setMap(map);

  const camera = new PerspectiveCamera(1, size.width / size.height, NEAR, FAR_MIN);
  const entities = createEntityLayer(scene, createModelKit());
  const host: RenderHost = { scene, beforeRender: null };

  let shadowHalf = 0;
  const target = new Vector3();
  const centre = new Vector3();
  /** Fit the sun's shadow box around what the camera looks at, snapped to whole texels so edges don't shimmer. */
  const fitShadow = (pose: CameraPose): void => {
    if (!sun.castShadow) return;
    target.set(pose.target.x, pose.target.y, pose.target.z);
    const dist = target.distanceTo(centre.set(pose.position.x, pose.position.y, pose.position.z));
    const half = Math.ceil(Math.min(SHADOW_MAX_HALF, Math.max(SHADOW_MIN_HALF, dist * SHADOW_FIT)) / SHADOW_HALF_STEP) * SHADOW_HALF_STEP;
    if (half !== shadowHalf) {
      shadowHalf = half;
      const cam = sun.shadow.camera;
      [cam.left, cam.right, cam.top, cam.bottom] = [-half, half, half, -half];
      cam.updateProjectionMatrix();
    }
    const texel = (2 * half) / preset.shadowMapSize;
    const snap = (axis: Vector3): number => {
      const d = target.dot(axis);
      return Math.round(d / texel) * texel - d;
    };
    centre.copy(target).addScaledVector(shadowRight, snap(shadowRight)).addScaledVector(shadowUp, snap(shadowUp));
    sun.target.position.copy(centre);
    sun.position.copy(centre).addScaledVector(toSun, SHADOW_DISTANCE);
  };

  const renderer: Renderer = {
    get canvas() {
      return gl.domElement;
    },
    render(frame, cameraPose) {
      const pose = devPose ? { ...cameraPose, ...devPose } : cameraPose;
      host.beforeRender?.(frame);
      const structures = entities.sync(frame);
      if (blockout) blockout.markers.visible = !structures;

      // Haze thins with height: the player camera gets the full density, the overview cameras see the whole map.
      fog.density = preset.fogDensity * Math.min(1, FOG_HEIGHT_REF / Math.max(1, pose.position.y));
      camera.near = Math.max(NEAR, pose.position.y * NEAR_PER_HEIGHT);
      camera.far = Math.min(FAR_MAX, Math.max(FAR_MIN, FOG_OPAQUE / fog.density));
      // Settings and poses use horizontal FOV; Three wants vertical.
      const halfH = (pose.fovDeg * DEG) / 2;
      camera.fov = (2 * Math.atan(Math.tan(halfH) / camera.aspect)) / DEG;
      camera.updateProjectionMatrix();
      camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
      fitShadow(pose);
      gl.render(scene, camera);
    },
    setMap,
    setQuality(q) {
      const next = QUALITY_PRESETS[q];
      if (next === preset) return;
      // Antialiasing is fixed when a WebGL context is created, so a new preset gets a new context.
      preset = next;
      shadowHalf = 0;
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      const old = gl;
      gl = makeGl();
      old.domElement.replaceWith(gl.domElement);
      old.dispose();
      old.forceContextLoss();
    },
    resize(width, height) {
      size = { width: Math.max(1, width), height: Math.max(1, height) };
      gl.setSize(size.width, size.height);
      camera.aspect = size.width / size.height;
      camera.updateProjectionMatrix();
    },
    dispose() {
      blockout?.dispose();
      gl.dispose();
    },
  };
  registerHost(renderer, host);
  if (import.meta.env.DEV) {
    window.__perchRender = { info: () => ({ calls: gl.info.render.calls, triangles: gl.info.render.triangles }), setQuality: renderer.setQuality };
  }
  return renderer;
}
