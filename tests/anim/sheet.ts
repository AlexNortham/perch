// Pose sheet page (served by Vite, captured by tests/anim/posesheets.ts): one hero in every animation state, each
// from a three-quarter view (front right) and a side view (its right, the gun side), posed by the real rig through
// the model kit. URL: /tests/anim/sheet.html?hero=<id>[&states=a,b][&cols=n][&size=px]
import { Color, DirectionalLight, GridHelper, HemisphereLight, Mesh, MeshBasicMaterial, MeshLambertMaterial, PCFShadowMap, PerspectiveCamera, PlaneGeometry, Scene, SphereGeometry, Vector3, WebGLRenderer } from 'three';
import { HERO_IDS, ViewFlag } from '../../src/sim/core/contracts';
import type { EntityView, HeroId } from '../../src/sim/core/contracts';
import { HEROES } from '../../src/sim/heroes/registry';
import { applyState, STATES } from '../../src/client/render/models/debug';
import { createModelKit } from '../../src/client/render/models/index';
import type { BirdRig } from '../../src/client/render/rigs/bird-rig';
import { SHEET_STATES, sampleTime } from './states';

declare global {
  interface Window {
    __sheetReady?: boolean;
  }
}

const q = new URLSearchParams(location.search);
const hero = (q.get('hero') ?? 'shrike') as HeroId;
if (!HERO_IDS.includes(hero)) throw new Error(`unknown hero ${hero}`);
const states = (q.get('states')?.split(',') ?? SHEET_STATES).filter((s) => s in STATES);
const cols = Number(q.get('cols')) || 8;
const size = Number(q.get('size')) || 240;
const LABEL = 22;
const TITLE = 34;
const rows = Math.ceil(states.length / cols);
const width = cols * size;
const height = TITLE + rows * (LABEL + 2 * size);
const DT = 1 / 60;

const sheet = document.getElementById('sheet') as HTMLDivElement;
sheet.style.width = `${width}px`;
sheet.style.height = `${height}px`;
const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(width, height);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
renderer.setScissorTest(true);
sheet.appendChild(renderer.domElement);

const plan = HEROES[hero].def.body;
const H = plan.height;
const scene = new Scene();
scene.background = new Color(0xd9dde3);
scene.add(new HemisphereLight(0xffffff, 0x8a8f99, 1.6));
const sun = new DirectionalLight(0xffffff, 2.2);
sun.position.set(-3, 8, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const half = H * 1.2;
Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 0.5, far: 20 });
scene.add(sun);
const ground = new Mesh(new PlaneGeometry(H * 4, H * 4), new MeshLambertMaterial({ color: 0xb8bcc4 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const grid = new GridHelper(H * 4, 16, 0x7a808a, 0x9aa0aa);
grid.position.y = 0.001;
scene.add(grid);
// Where the sim fires from (shown in the aim and shoot cells only).
const muzzleMark = new Mesh(new SphereGeometry(0.02, 8, 6), new MeshBasicMaterial({ color: 0xff2020, depthTest: false }));
muzzleMark.renderOrder = 5;
muzzleMark.position.set(-plan.muzzle.right, plan.muzzle.up, plan.muzzle.forward);
scene.add(muzzleMark);

const kit = createModelKit();
const entity = (): EntityView =>
  ({ id: 1, kind: 'hero', team: 'dawn', type: hero, pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, radius: plan.radius, hp: 100, maxHp: 100, shield: 0, flags: ViewFlag.Grounded, mode: null, seenBy: 3 }) as EntityView;

const camera = new PerspectiveCamera(30, 1, 0.05, 50);
const dist = (H * 0.7) / Math.tan((15 * Math.PI) / 180);
const look = new Vector3(0, H * 0.5, 0);
const views = [
  { name: '3/4', at: new Vector3(-Math.sin(0.7) * dist, H * 0.5 + dist * 0.22, Math.cos(0.7) * dist) },
  { name: 'side', at: new Vector3(-dist, H * 0.5 + dist * 0.05, 0) },
];

const label = (text: string, x: number, y: number, cls = 'label'): void => {
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = text;
  d.style.left = `${x}px`;
  d.style.top = `${y}px`;
  sheet.appendChild(d);
};
label(`${HEROES[hero].def.name} (${hero}): every state, three-quarter (top) and side (bottom). Red dot: the sim's muzzle point.`, 8, 6, 'title');

let rig: BirdRig | null = null;
states.forEach((name, i) => {
  const s = STATES[name];
  if (!s) return;
  if (rig) scene.remove(rig);
  rig = kit.create(entity()) as BirdRig;
  scene.add(rig);
  const e = entity() as EntityView & { vel: { x: number; y: number; z: number } };
  const end = sampleTime(name);
  for (let t = 0; t <= end + 1e-9; t += DT) {
    const { hit, castSlot } = applyState(e as never, s, t, DT);
    rig.animate(e, DT, t, hit, castSlot);
  }
  muzzleMark.visible = name === 'aim' || name === 'shoot';
  const col = i % cols;
  const row = Math.floor(i / cols);
  const x = col * size;
  const top = TITLE + row * (LABEL + 2 * size);
  label(name, x + 4, top + 2);
  views.forEach((v, j) => {
    const y = top + LABEL + j * size;
    // WebGL viewports count from the bottom.
    renderer.setViewport(x, height - y - size, size, size);
    renderer.setScissor(x, height - y - size, size, size);
    camera.position.copy(v.at);
    camera.lookAt(look);
    renderer.render(scene, camera);
  });
});
window.__sheetReady = true;
