// Art review frames (style guide §8.5, §8.6, §12.3), served by Vite and captured by tests/anim/posesheets.ts --frame:
// 1920 × 1080 in the style guide's golden-hour light, with the game's 90° horizontal field of view.
//   mode=player&hero=<id>[&state=aim]   the bird from the real third-person camera (the sim's aim ray), with the
//                                        share of the screen the bird and its gun cover (§8.5: ≤ 18 % and ≤ 4 %)
//   mode=lineup&ids=a,b,c&dist=<m>       a row of birds at a distance (§8.6 readability at 10, 40 and 80 m)
//   mode=closeup&hero=<id>&view=front|back|3/4|side&dist=<m>[&state=…]   the bird close up
// Optional: team=dawn|dusk|mixed, state=<name>, t=<seconds into the state>, fov=<horizontal degrees>.
import { Bone, Color, DirectionalLight, FogExp2, HemisphereLight, Mesh, MeshBasicMaterial, MeshLambertMaterial, NeutralToneMapping, PCFShadowMap, PerspectiveCamera, PlaneGeometry, Scene, SkinnedMesh, Vector3, WebGLRenderer, WebGLRenderTarget } from 'three';
import type { Material, Object3D } from 'three';
import { HERO_IDS, ViewFlag } from '../../src/sim/core/contracts';
import type { EntityView, HeroId } from '../../src/sim/core/contracts';
import { aimRay } from '../../src/sim/core/aim';
import { HEROES } from '../../src/sim/heroes/registry';
import { applyState, STATES } from '../../src/client/render/models/debug';
import { createModelKit } from '../../src/client/render/models/index';
import { cardAtlas } from '../../src/client/render/models/feathers';
import type { BirdRig } from '../../src/client/render/rigs/bird-rig';

declare global {
  interface Window {
    __frameReady?: boolean;
    __frameStats?: Record<string, number>;
  }
}

const W = 1920;
const H = 1080;
// fov=<degrees> narrows the view to inspect distant birds at the level of detail their distance picks.
const FOV_H = Number(new URLSearchParams(location.search).get('fov')) || 90;
const DT = 1 / 60;
const q = new URLSearchParams(location.search);
const mode = q.get('mode') ?? 'player';
const stateName = q.get('state') ?? (mode === 'player' ? 'aim' : 'idle');
const teamParam = q.get('team') ?? 'dawn';
const settle = Number(q.get('t')) || 1.5;
const isHero = (s: string): s is HeroId => (HERO_IDS as readonly string[]).includes(s);

const root = document.getElementById('frame') as HTMLDivElement;
const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
root.appendChild(renderer.domElement);

// look=neutral: a white turntable light on mid grey, for judging form, colour and value apart from the game's light.
const neutral = q.get('look') === 'neutral' || mode === 'triptych';
const scene = new Scene();
const backdrop = new Color(neutral ? 0x8a8d93 : 0xa99bb0);
scene.background = backdrop;
if (!neutral) scene.fog = new FogExp2(0xa99bb0, 0.006);
scene.add(neutral ? new HemisphereLight(0xffffff, 0x6a6a6a, Math.PI * 0.55) : new HemisphereLight(0x8fa6c9, 0x4a4a3a, Math.PI * 0.75));
const sun = new DirectionalLight(neutral ? 0xffffff : 0xffd9a0, Math.PI * (neutral ? 1.3 : 1.6));
const elev = (24 * Math.PI) / 180;
if (neutral) sun.position.set(-12, 22, 18);
else sun.position.set(-Math.cos(elev) * 30, Math.sin(elev) * 30, -Math.cos(elev) * 12);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
scene.add(sun, sun.target);
const ground = new Mesh(new PlaneGeometry(600, 600), new MeshLambertMaterial({ color: neutral ? 0x6c6f75 : 0x7d7262 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const camera = new PerspectiveCamera(1, W / H, 0.05, 400);
camera.fov = (2 * Math.atan(Math.tan((FOV_H * Math.PI) / 360) / camera.aspect) * 180) / Math.PI;
camera.updateProjectionMatrix();

const kit = createModelKit();
const entity = (hero: HeroId, id: number, team: 'dawn' | 'dusk'): EntityView =>
  ({ id, kind: 'hero', team, type: hero, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, radius: HEROES[hero].def.body.radius, hp: 100, maxHp: 100, shield: 0, flags: ViewFlag.Grounded, mode: null, seenBy: 3 }) as EntityView;

/** A bird posed in the named state, at x/z, facing yaw. */
function place(hero: HeroId, i: number, team: 'dawn' | 'dusk', x: number, z: number, yaw: number): BirdRig {
  const e = entity(hero, i + 1, team) as EntityView & { vel: { x: number; y: number; z: number } };
  const rig = kit.create(e) as BirdRig;
  rig.position.set(x, 0, z);
  rig.rotation.y = yaw;
  scene.add(rig);
  const s = STATES[stateName] ?? STATES['idle'];
  if (s) for (let t = 0; t <= settle + 1e-9; t += DT) {
    const { hit, castSlot } = applyState(e as never, s, t, DT);
    rig.animate(e, DT, t, hit, castSlot);
  }
  return rig;
}

const label = (text: string, x: number, y: number, size = 22): void => {
  const d = document.createElement('div');
  d.className = 'label';
  d.textContent = text;
  Object.assign(d.style, { left: `${x}px`, top: `${y}px`, fontSize: `${size}px` });
  root.appendChild(d);
};

/** Share of the screen covered by the given rigs, optionally only their gun bones (other bones collapsed). */
function coverage(rigs: readonly BirdRig[], gunOnly: boolean): number {
  const target = new WebGLRenderTarget(W, H);
  const white = new MeshBasicMaterial({ color: 0xffffff });
  const cut = new MeshBasicMaterial({ color: 0xffffff, map: cardAtlas(), alphaTest: 0.5 });
  const saved = new Map<Object3D, Material | Material[]>();
  const scales = new Map<Bone, Vector3>();
  scene.traverse((o) => {
    if (o === ground) o.visible = false;
    if (o instanceof SkinnedMesh) {
      saved.set(o, o.material);
      o.material = o.name.startsWith('feathers') ? cut : white;
    }
  });
  if (gunOnly) for (const r of rigs) for (const [name, b] of Object.entries(r.bones)) if (!['gun', 'slide', 'spin'].includes(name) && b.parent?.type !== 'Bone') {
    scales.set(b, b.scale.clone());
    b.scale.setScalar(1e-6);
  }
  const bg = scene.background;
  const fog = scene.fog;
  scene.background = new Color(0);
  scene.fog = null;
  renderer.toneMapping = 0;
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  const px = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(target, 0, 0, W, H, px);
  renderer.setRenderTarget(null);
  renderer.toneMapping = NeutralToneMapping;
  scene.background = bg;
  scene.fog = fog;
  ground.visible = true;
  for (const [o, m] of saved) (o as Mesh).material = m;
  for (const [b, s] of scales) b.scale.copy(s);
  let n = 0;
  for (let i = 0; i < px.length; i += 4) if ((px[i] ?? 0) > 16) n++;
  return n / (W * H);
}

const stats: Record<string, number> = {};
if (mode === 'player') {
  const hero = q.get('hero') ?? 'peacock';
  if (!isHero(hero)) throw new Error(`unknown hero ${hero}`);
  const team = teamParam === 'dusk' ? 'dusk' : 'dawn';
  const rig = place(hero, 0, team, 0, 0, 0);
  const plan = HEROES[hero].def.body;
  const ray = aimRay({ x: 0, y: 0, z: 0 }, 0, Number(q.get('pitch')) || 0, 1, plan, false);
  camera.position.set(ray.origin.x, ray.origin.y, ray.origin.z);
  camera.lookAt(ray.origin.x + ray.dir.x * 10, ray.origin.y + ray.dir.y * 10, ray.origin.z + ray.dir.z * 10);
  // A few figures down range for scale.
  ['shrike', 'kingfisher', 'owl'].forEach((id, i) => isHero(id) && place(id, 10 + i, team === 'dawn' ? 'dusk' : 'dawn', -4 + i * 4, 18 + i * 6, Math.PI));
  renderer.render(scene, camera);
  stats['bird'] = coverage([rig], false);
  stats['gun'] = coverage([rig], true);
  renderer.render(scene, camera);
  label(`${HEROES[hero].def.name} from the player camera (${stateName}): bird ${(stats['bird'] * 100).toFixed(1)} % of the screen, gun ${(stats['gun'] * 100).toFixed(2)} %`, 16, 12);
} else if (mode === 'lineup') {
  const ids = (q.get('ids') ?? 'peacock').split(',').filter(isHero);
  const dist = Number(q.get('dist')) || 40;
  const gap = Number(q.get('gap')) || 2.4;
  ids.forEach((id, i) => {
    const team = teamParam === 'mixed' ? (i % 2 ? 'dusk' : 'dawn') : teamParam === 'dusk' ? 'dusk' : 'dawn';
    place(id, i, team, ((ids.length - 1) / 2 - i) * gap, dist, Math.PI + 0.35);
  });
  camera.position.set(0, 1.7, 0);
  camera.lookAt(0, 1.0, dist);
  renderer.render(scene, camera);
  label(`Line-up at ${dist} m (${stateName}): ${ids.join(', ')}`, 16, 12);
} else if (mode === 'triptych') {
  // Three panels: three-quarter close-up, front, and the back from the player camera's boom (style guide review).
  const hero = q.get('hero') ?? 'peacock';
  if (!isHero(hero)) throw new Error(`unknown hero ${hero}`);
  const plan = HEROES[hero].def.body;
  place(hero, 0, teamParam === 'dusk' ? 'dusk' : 'dawn', 0, 0, 0);
  const pw = W / 3;
  const panel = new PerspectiveCamera(32, pw / H, 0.05, 400);
  const look = new Vector3(0, plan.height * 0.55, 0);
  const ray = aimRay({ x: 0, y: 0, z: 0 }, 0, 0, 1, plan, false);
  const views: [string, Vector3][] = [
    ['three-quarter', new Vector3(-Math.sin(0.75) * 4.4, plan.height * 0.75, Math.cos(0.75) * 4.4).multiplyScalar(plan.height / 1.8)],
    ['front', new Vector3(0, plan.height * 0.7, 4.4 * (plan.height / 1.8))],
    ['back (player camera)', new Vector3(ray.origin.x, ray.origin.y, ray.origin.z)],
  ];
  renderer.setScissorTest(true);
  views.forEach(([name, at], i) => {
    renderer.setViewport(i * pw, 0, pw, H);
    renderer.setScissor(i * pw, 0, pw, H);
    panel.position.copy(at);
    panel.lookAt(look);
    renderer.render(scene, panel);
    label(name, i * pw + 12, H - 44);
  });
  label(`${HEROES[hero].def.name} (${stateName}), neutral light`, 16, 12);
} else {
  const hero = q.get('hero') ?? 'peacock';
  if (!isHero(hero)) throw new Error(`unknown hero ${hero}`);
  const team = teamParam === 'dusk' ? 'dusk' : 'dawn';
  place(hero, 0, team, 0, 0, 0);
  const plan = HEROES[hero].def.body;
  const dist = Number(q.get('dist')) || 3;
  const view = q.get('view') ?? '3/4';
  const yaw = view === 'front' ? 0 : view === 'back' ? Math.PI : view === 'side' ? -Math.PI / 2 : view === 'left' ? Math.PI / 2 : -0.7;
  const focus = (Number(q.get('focus')) || 0.6) * plan.height;
  camera.position.set(Math.sin(yaw) * dist, focus + dist * 0.12, Math.cos(yaw) * dist);
  camera.lookAt(0, focus, 0);
  renderer.render(scene, camera);
  label(`${HEROES[hero].def.name} at ${dist} m, ${view} (${stateName})`, 16, 12);
}
window.__frameStats = stats;
window.__frameReady = true;
