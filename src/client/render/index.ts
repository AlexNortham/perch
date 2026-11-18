// TODO(Rendering & VFX): the real scene (blockout from MapData.prims by material tag, lighting, fog, sky, shadows),
// instancing, LOD, outlines and team colours, quality presets. Until then: a lit ground plane plus a model per entity.
import {
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three';
import type { Object3D } from 'three';
import type { EntityId, MapData } from '../../sim/core/contracts';
import type { Quality, Renderer } from '../app/contracts';
import { createModelKit } from './models';

const SKY = 0x9fc4e8;
const GROUND = 0x5d7a3a;
const HEMI_INTENSITY = 1.2;
const SUN_COLOUR = 0xffffff;
const SUN_INTENSITY = 1.6;
const SUN_DIR = { x: -0.5, y: 1, z: 0.3 };
const NEAR = 0.1;
const FAR = 3000;
const MAX_PIXEL_RATIO = 2;
const DEGREES_PER_TURN = 360;
const DEG = (2 * Math.PI) / DEGREES_PER_TURN;

export function createRenderer(container: HTMLElement, map: MapData, quality: Quality): Renderer {
  const gl = new WebGLRenderer({ antialias: quality !== 'low' });
  gl.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'high' ? MAX_PIXEL_RATIO : 1));
  container.appendChild(gl.domElement);

  const scene = new Scene();
  scene.background = new Color(SKY);
  scene.add(new HemisphereLight(SKY, GROUND, HEMI_INTENSITY));
  const sun = new DirectionalLight(SUN_COLOUR, SUN_INTENSITY);
  sun.position.set(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z);
  scene.add(sun);

  const ground = new Mesh(new PlaneGeometry(1, 1), new MeshLambertMaterial({ color: GROUND }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const setMap = (m: MapData): void => {
    const { min, max } = m.bounds;
    ground.scale.set(max.x - min.x, max.z - min.z, 1);
    ground.position.set((min.x + max.x) / 2, 0, (min.z + max.z) / 2);
  };
  setMap(map);

  const camera = new PerspectiveCamera(1, 1, NEAR, FAR);
  const models = createModelKit();
  const live = new Map<EntityId, Object3D>();

  return {
    canvas: gl.domElement,
    render(frame, pose) {
      const seen = new Set<EntityId>();
      for (const e of frame.curr.entities) {
        seen.add(e.id);
        let model = live.get(e.id);
        if (!model) {
          model = models.create(e);
          live.set(e.id, model);
          scene.add(model);
        }
        models.pose(model, e, frame);
      }
      for (const [id, model] of live) {
        if (seen.has(id)) continue;
        scene.remove(model);
        live.delete(id);
      }
      // Settings and poses use horizontal FOV; Three wants vertical.
      const halfH = (pose.fovDeg * DEG) / 2;
      camera.fov = (2 * Math.atan(Math.tan(halfH) / camera.aspect)) / DEG;
      camera.updateProjectionMatrix();
      camera.position.set(pose.position.x, pose.position.y, pose.position.z);
      camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
      gl.render(scene, camera);
    },
    setMap,
    setQuality: () => undefined,
    resize(width, height) {
      gl.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    },
    dispose: () => gl.dispose(),
  };
}
