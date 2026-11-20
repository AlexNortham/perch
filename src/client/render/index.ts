/**
 * The renderer (client contract `Renderer`): a golden-hour Three.js scene (style guide §10) with the map layer
 * (blockout.ts, painted from the material library), one model per entity from the ModelKit (entities.ts), kit
 * structure models at the map's anchors before a match spawns them, and post-processing at Medium and High.
 * Owner: Rendering & VFX.
 */
import {
  BatchedMesh,
  CanvasTexture,
  Color,
  DirectionalLight,
  EquirectangularReflectionMapping,
  FogExp2,
  Frustum,
  Group,
  HalfFloatType,
  HemisphereLight,
  InstancedMesh,
  LinearSRGBColorSpace,
  MathUtils,
  Matrix4,
  Mesh,
  NeutralToneMapping,
  PCFShadowMap,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import type { Object3D, Texture } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ViewFlag } from '../../sim/core/contracts';
import type { EntityView, HeroId, MapData, PlayerTeam } from '../../sim/core/contracts';
import { STRUCTURE_BODY, STRUCTURE_RADIUS } from '../../sim/data/world';
import type { CameraPose, Frame, ModelKit, Quality, Renderer } from '../app/contracts';
import { buildBlockout } from './blockout';
import { buildEnvironment } from './environment';
import type { Environment } from './environment';
import type { Blockout } from './blockout';
import { createEntityLayer } from './entities';
import { registerHost } from '../app/render-host';
import { deferWork } from '../app/stages';
import type { RenderHost } from '../app/render-host';
import {
  FAR_MAX,
  FAR_MIN,
  FOG_HEIGHT_REF,
  FOG_OPAQUE,
  IDENTITY,
  LIGHT,
  LIGHT_UNIT,
  NEAR,
  NEAR_PER_HEIGHT,
  POST,
  QUALITY_PRESETS,
  SHADOW_BIAS,
  SHADOW_DISTANCE,
  SHADOW_LAYER,
  SHADOW_UPSUN,
  SHADOW_FIT,
  SHADOW_INTENSITY,
  SHADOW_MAX_HALF,
  SHADOW_MIN_HALF,
  SHADOW_NORMAL_BIAS,
  SHADOW_RADIUS,
  SKY,
  SUN,
  TONE_EXPOSURE,
} from './constants';
import { FIXTURE_MAP } from './fixture';
import { getMaterialLibrary } from './materials';
import { createModelKit } from './models';
import { gradeOutput } from './grade';
import { RideOverlay } from './ride';
import { identityResolution, rimStrength } from './identity';
import { portraits, registerPortraitSource, uiPortraits } from './portraits';
import { placeholderPortraits, setPortraitProvider } from '../ui/portraits';

export { DAWN_COLOURS, DUSK_COLOURS, TEAM_COLOURS } from '../app/palette';

/** Per-category counts for the §11.3 budget tables (dev builds). */
export interface BudgetReport {
  readonly calls: number;
  readonly triangles: number;
  readonly categories: Readonly<Record<string, { meshes: number; triangles: number }>>;
  readonly textureMB: number;
}

declare global {
  interface Window {
    /** Dev builds only, for measurement: the last frame's draw calls and triangles (all passes), a live quality switch and a §11.3 budget breakdown. */
    __perchRender?: { info(): { calls: number; triangles: number }; setQuality(q: Quality): void; budget(): BudgetReport; portrait(hero: HeroId, team: PlayerTeam): string | null };
  }
}

const DEG = MathUtils.DEG2RAD;
const RGBA = 4;
const BYTE = 255;
/** Shadow box half-sizes snap to this step so the texel size (and edge shimmer) only changes in jumps. */
const SHADOW_HALF_STEP = 5;
const UP = new Vector3(0, 1, 0);
const TO_SUN = new Vector3(SUN.azimuth.x * Math.cos(SUN.elevationDeg * DEG), Math.sin(SUN.elevationDeg * DEG), SUN.azimuth.z * Math.cos(SUN.elevationDeg * DEG)).normalize();
const MB = 1_048_576;
/** The ?renderTeams demo: three a side, 3 m apart, each side this far either side of the target. */
const TEAM_DEMO = { size: 3, spacing: 3, depth: 2, firstId: 9001 } as const;
const TRI = 3;
/** Texture memory is reported to 0.1 MB. */
const MB_STEPS = 10;

/**
 * Equirectangular sky (§10.2): peach over Dawn's side (−z), violet over Dusk's (+z), a soft glow and halo around
 * the sun, thin cloud bands lit from the sun side, and the lavender haze below the horizon.
 */
function skyTexture(): CanvasTexture {
  const { width, height } = SKY;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const tex = new CanvasTexture(canvas);
  if (!ctx) return tex;
  const img = ctx.createImageData(width, height);
  // Raw sRGB components (no conversion to linear): the canvas is sRGB.
  const c = (hex: number): Color => new Color().setHex(hex, LinearSRGBColorSpace);
  const fog = c(LIGHT.fog);
  const glow = c(SKY.sunGlow);
  const cloud = c(SKY.cloud);
  const out = new Color();
  const dir = new Vector3();
  for (let x = 0; x < width; x++) {
    // Three's equirect lookup: u = atan2(z, x) / 2π + ½.
    const theta = ((x + 1 / 2) / width - 1 / 2) * 2 * Math.PI;
    const north = (Math.sin(theta) + 1) / 2;
    const horizon = c(SKY.southHorizon).lerp(c(SKY.northHorizon), north).lerp(fog, SKY.horizonHaze);
    const zenith = c(SKY.southZenith).lerp(c(SKY.northZenith), north);
    for (let y = 0; y < height; y++) {
      const alt = (1 / 2 - (y + 1 / 2) / height) * Math.PI;
      const up = Math.sin(alt);
      dir.set(Math.cos(theta) * Math.cos(alt), up, Math.sin(theta) * Math.cos(alt));
      if (up <= 0) {
        out.copy(fog);
      } else {
        out.copy(horizon).lerp(zenith, up ** SKY.curve);
        const sun = Math.max(0, dir.dot(TO_SUN));
        let band = 0;
        for (let b = 0; b < SKY.cloudBands; b++) {
          const centre = SKY.cloudLow + ((SKY.cloudHigh - SKY.cloudLow) * (b + 1 / 2)) / SKY.cloudBands;
          const streak = 1 / 2 + Math.sin(theta * (SKY.cloudWaves + b * 2) + b * SKY.cloudPhase) / 2;
          band += Math.exp(-(((up - centre) / SKY.cloudWidth) ** 2)) * streak * streak;
        }
        out.lerp(cloud.clone().lerp(glow, sun), Math.min(1, band) * SKY.cloudStrength * (1 + sun));
        out.lerp(glow, Math.min(1, sun ** SKY.glowPower * SKY.glowStrength + sun ** SKY.haloPower * SKY.haloStrength));
      }
      img.data.set([out.r * BYTE, out.g * BYTE, out.b * BYTE, BYTE], (y * width + x) * RGBA);
    }
  }
  ctx.putImageData(img, 0, 0);
  tex.colorSpace = SRGBColorSpace;
  tex.mapping = EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  return tex;
}

/** A structure view for a map anchor, so the menu and blockout scenes show the real models, not placeholders. */
function anchorView(map: MapData, i: number): EntityView | null {
  const a = map.structures[i];
  if (!a) return null;
  const radius = STRUCTURE_RADIUS[a.type];
  return {
    id: -1 - i, kind: 'structure', team: a.team, type: a.type, pos: a.pos, vel: { x: 0, y: 0, z: 0 }, yaw: a.yaw, pitch: 0, radius,
    hp: 1, maxHp: 1, shield: 0, flags: 0, mode: null, seenBy: 3,
    structure: { type: a.type, lane: a.lane, phase: 1, target: null, body: { radius, height: STRUCTURE_BODY[a.type].height }, weakPoint: null },
  } as EntityView;
}

/**
 * Dev only (?renderTeams): three allies and three enemies around the camera target, so team identification can be
 * judged at 40 m (G18) while bots don't yet leave spawn. The middle enemy is revealed (x-ray through walls).
 */
function withTeams(frame: Frame, pose: CameraPose): Frame {
  const local = frame.curr.heroes.find((h) => h.id === frame.curr.localHero)?.team ?? 'dawn';
  const other = local === 'dawn' ? 'dusk' : 'dawn';
  const { target: t, position: c } = pose;
  const yaw = Math.atan2(c.x - t.x, c.z - t.z);
  const [rx, rz] = [Math.cos(yaw), -Math.sin(yaw)];
  const [fx, fz] = [Math.sin(yaw), Math.cos(yaw)];
  const types = ['shrike', 'albatross', 'kingfisher', 'owl', 'pelican', 'starling'] as const;
  const extra = types.map((type, i): EntityView => {
    const enemy = i >= TEAM_DEMO.size;
    const k = (i % TEAM_DEMO.size) - 1;
    const back = enemy ? -TEAM_DEMO.depth : TEAM_DEMO.depth;
    return {
      id: TEAM_DEMO.firstId + i, kind: 'hero', team: enemy ? other : local, type, pos: { x: t.x + rx * k * TEAM_DEMO.spacing + fx * back, y: t.y, z: t.z + rz * k * TEAM_DEMO.spacing + fz * back },
      vel: { x: 0, y: 0, z: 0 }, yaw, pitch: 0, radius: 0.5, hp: 1, maxHp: 1, shield: 0, flags: enemy && k === 0 ? ViewFlag.Revealed : 0, mode: null, seenBy: 3,
    } as EntityView;
  });
  const curr = { ...frame.curr, entities: [...frame.curr.entities, ...extra] };
  return { ...frame, prev: { ...frame.prev, entities: [...frame.prev.entities, ...extra] }, curr };
}

/** Counts for the §11.3 budget: meshes in the camera frustum, by the `budget` tag on them or an ancestor. */
function budgetOf(scene: Scene, camera: PerspectiveCamera, calls: number, triangles: number, textureMB: number): BudgetReport {
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const categories: Record<string, { meshes: number; triangles: number }> = {};
  const visit = (o: Object3D, tag: string): void => {
    if (!o.visible) return;
    const t = (o.userData['budget'] as string | undefined) ?? tag;
    if (o instanceof Mesh && (!o.frustumCulled || frustum.intersectsObject(o))) {
      const g = o.geometry;
      // A BatchedMesh draws only the entries its culling kept this frame (multi-draw counts), not its capacity.
      const drawn = o instanceof BatchedMesh ? (o as unknown as { _multiDrawCount: number; _multiDrawCounts: Int32Array }) : null;
      const tris = drawn ? Array.from(drawn._multiDrawCounts.subarray(0, drawn._multiDrawCount)).reduce((a, b) => a + b, 0) / TRI : (g.index ? g.index.count : g.getAttribute('position').count) / TRI;
      const n = o instanceof InstancedMesh ? o.count : 1;
      if (n > 0) {
        const c = (categories[t] ??= { meshes: 0, triangles: 0 });
        c.meshes++;
        c.triangles += tris * n;
      }
    }
    for (const child of o.children) visit(child, t);
  };
  visit(scene, 'other');
  return { calls, triangles, categories, textureMB };
}

export function createRenderer(container: HTMLElement, map: MapData, quality: Quality): Renderer {
  let preset = QUALITY_PRESETS[quality];
  // Dev builds only, for frame-time diagnosis: ?renderOff=post,shadow,backdrop,cards switches parts off.
  const off = import.meta.env.DEV ? (new URLSearchParams(location.search).get('renderOff') ?? '').split(',') : [];
  let lib = getMaterialLibrary(quality);
  let size = { width: Math.max(1, container.clientWidth), height: Math.max(1, container.clientHeight) };

  const scene = new Scene();
  const sky = skyTexture();
  scene.background = sky;
  const fog = new FogExp2(LIGHT.fog, preset.fogDensity);
  scene.fog = fog;
  scene.add(new HemisphereLight(LIGHT.hemiSky, LIGHT.hemiGround, SUN.hemiIntensity * LIGHT_UNIT));
  const sun = new DirectionalLight(LIGHT.sun, SUN.intensity * LIGHT_UNIT);
  const shadowRight = new Vector3().crossVectors(UP, TO_SUN).normalize();
  const shadowUp = new Vector3().crossVectors(TO_SUN, shadowRight);
  sun.shadow.bias = SHADOW_BIAS;
  sun.shadow.normalBias = SHADOW_NORMAL_BIAS;
  sun.shadow.radius = SHADOW_RADIUS;
  sun.shadow.intensity = SHADOW_INTENSITY;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = SHADOW_DISTANCE * 2;
  sun.shadow.camera.layers.enable(SHADOW_LAYER);
  scene.add(sun, sun.target);

  let env: Texture | null = null;
  let composer: EffectComposer | null = null;
  let bloom: UnrealBloomPass | null = null;
  const camera = new PerspectiveCamera(1, size.width / size.height, NEAR, FAR_MIN);

  const makeGl = (): WebGLRenderer => {
    rimStrength.value = preset.post === 'none' ? IDENTITY.rimLow : IDENTITY.rim;
    identityResolution.set(size.width, size.height);
    const r = new WebGLRenderer({ antialias: preset.antialias && preset.post === 'none', powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, preset.maxPixelRatio) * preset.renderScale);
    r.setSize(size.width, size.height);
    r.toneMapping = NeutralToneMapping;
    r.toneMappingExposure = TONE_EXPOSURE;
    r.shadowMap.enabled = preset.shadowMapSize > 0 && !off.includes('shadow');
    r.shadowMap.type = preset.post === 'full' ? PCFSoftShadowMap : PCFShadowMap;
    // Counters add up over every pass of a frame (shadow, scene, bloom, output); render() resets them.
    r.info.autoReset = false;
    r.domElement.style.cssText = 'display:block;width:100%;height:100%';
    sun.castShadow = preset.shadowMapSize > 0 && !off.includes('shadow');
    sun.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
    // §7.3: a small prefiltered environment from the sky, so metal and glass catch the sky instead of going black.
    const pmrem = new PMREMGenerator(r);
    env?.dispose();
    env = pmrem.fromEquirectangular(sky).texture;
    pmrem.dispose();
    lib.setEnvironment(env);
    composer?.dispose();
    composer = null;
    bloom = null;
    if (preset.post !== 'none' && !off.includes('post')) {
      const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: preset.antialias && !off.includes('msaa') ? (preset.post === 'full' ? POST.samples : POST.samplesHalf) : 0 });
      composer = new EffectComposer(r, target);
      composer.addPass(new RenderPass(scene, camera));
      const res = new Vector2(size.width, size.height).multiplyScalar(preset.post === 'half' ? 1 / 2 : 1);
      bloom = new UnrealBloomPass(res, POST.bloomStrength, POST.bloomRadius, POST.bloomThreshold);
      if (!off.includes('bloom')) composer.addPass(bloom);
      composer.addPass(gradeOutput(new OutputPass(), POST));
      composer.setPixelRatio(r.getPixelRatio());
      composer.setSize(size.width, size.height);
    }
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

  const devTeams = dev?.has('renderTeams') ?? false;
  const kit: ModelKit = createModelKit();
  const entities = createEntityLayer(scene, kit);
  registerPortraitSource({ gl: () => gl, kit });
  setPortraitProvider(uiPortraits);
  /** The real structure models at the map's anchors, shown until a match spawns structures. */
  const anchors = new Group();
  anchors.name = 'structure-anchors';
  anchors.userData['budget'] = 'structures';
  scene.add(anchors);
  let anchorModels: { model: Object3D; view: EntityView }[] = [];

  let blockout: Blockout | null = null;
  // The environment layer (Environment Artist, environment/): the blockout draws the map without what it re-skins.
  let layer: Environment | null = null;
  let layerQuality = quality;
  let current: MapData | null = null;
  // The first map's scenery is generated after the first screen, as its own deferred job (D-ARCH-031); a later map
  // (quality change, map switch) is built at once. `dressed` counts maps so a superseded job does nothing.
  let dressLater = true;
  let dressed = 0;
  const setMap = (m: MapData): void => {
    const next = m.id === 'main' && dev?.has('renderFixture') ? FIXTURE_MAP : m;
    if (next === current) return;
    current = next;
    const mine = ++dressed;
    const dress = (): void => {
      if (mine !== dressed) return;
      if (blockout) {
        scene.remove(blockout.root);
        blockout.dispose();
      }
      if (layer) scene.remove(layer.root);
      layer?.dispose();
      layer = buildEnvironment(next, layerQuality);
      scene.add(layer.root);
      blockout = buildBlockout(layer.blockoutMap, lib);
      blockout.root.traverse((o) => {
        if (off.includes('backdrop') && o.name.startsWith('backdrop')) o.visible = false;
        if (off.includes('cards') && o instanceof Mesh && o.material === lib.cutout) o.visible = false;
      });
      scene.add(blockout.root);
    };
    if (dressLater) deferWork('environment', dress);
    else dress();
    dressLater = false;
    anchors.clear();
    anchorModels = next.structures.map((_, i) => anchorView(next, i)).filter((v): v is EntityView => v !== null).map((view) => {
      const model = kit.create(view);
      model.position.set(view.pos.x, view.pos.y, view.pos.z);
      model.rotation.y = view.yaw;
      anchors.add(model);
      return { model, view };
    });
  };
  setMap(map);

  const host: RenderHost = { scene, beforeRender: null };
  const ride = new RideOverlay();

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
      // Depth: from the up-sun reach of tall casters to the far side of the box; nothing beyond casts into view.
      cam.near = Math.max(1, SHADOW_DISTANCE - half - SHADOW_UPSUN);
      cam.far = SHADOW_DISTANCE + half;
      cam.updateProjectionMatrix();
    }
    const texel = (2 * half) / preset.shadowMapSize;
    const snap = (axis: Vector3): number => {
      const d = target.dot(axis);
      return Math.round(d / texel) * texel - d;
    };
    centre.copy(target).addScaledVector(shadowRight, snap(shadowRight)).addScaledVector(shadowUp, snap(shadowUp));
    sun.target.position.copy(centre);
    sun.position.copy(centre).addScaledVector(TO_SUN, SHADOW_DISTANCE);
  };

  const poseAnchors = (frame: Frame, show: boolean): void => {
    anchors.visible = show;
    if (!show) return;
    for (const { model, view } of anchorModels) kit.pose(model, view, frame);
  };

  const renderer: Renderer = {
    get canvas() {
      return gl.domElement;
    },
    render(frame, cameraPose) {
      const pose = devPose ? { ...cameraPose, ...devPose } : cameraPose;
      gl.info.reset();
      host.beforeRender?.(frame);
      const structures = entities.sync(devTeams ? withTeams(frame, pose) : frame, pose.position);
      poseAnchors(frame, !structures);

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
      camera.updateMatrixWorld();
      const seconds = frame.prev.seconds + (frame.curr.seconds - frame.prev.seconds) * frame.alpha;
      blockout?.update(camera, seconds);
      lib.tick(seconds);
      fitShadow(pose);
      if (composer) composer.render();
      else gl.render(scene, camera);
      ride.render(gl, frame, size.width, size.height);
    },
    setMap,
    setQuality(q) {
      const next = QUALITY_PRESETS[q];
      if (next === preset) return;
      // Antialiasing is fixed when a WebGL context is created, so a new preset gets a new context.
      preset = next;
      lib = getMaterialLibrary(q);
      layerQuality = q;
      // The map layer is built per tier (§11.6: Low has no geometric bevels or trims): rebuild it.
      const map = current;
      current = null;
      if (map) setMap(map);
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
      composer?.setSize(size.width, size.height);
      bloom?.setSize(size.width * (preset.post === 'half' ? 1 / 2 : 1), size.height * (preset.post === 'half' ? 1 / 2 : 1));
      identityResolution.set(size.width, size.height);
      camera.aspect = size.width / size.height;
      camera.updateProjectionMatrix();
    },
    dispose() {
      registerPortraitSource(null);
      setPortraitProvider(placeholderPortraits);
      blockout?.dispose();
      layer?.dispose();
      ride.dispose();
      composer?.dispose();
      env?.dispose();
      gl.dispose();
    },
  };
  registerHost(renderer, host);
  if (import.meta.env.DEV) {
    window.__perchRender = {
      info: () => ({ calls: gl.info.render.calls, triangles: gl.info.render.triangles }),
      setQuality: renderer.setQuality,
      portrait: (hero, team) => portraits.get(hero, team),
      budget: () => budgetOf(scene, camera, gl.info.render.calls, gl.info.render.triangles, Math.round((lib.textureBytes / MB) * MB_STEPS) / MB_STEPS),
    };
  }
  return renderer;
}
