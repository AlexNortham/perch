// Art review frames for the world's models (style guide §9, §8.8; D-ART-014): structures, Patrons, fledglings, Thicket
// creatures, the Roc and Embers, posed through the real model kit and rigs, in golden-hour light at 1920 × 1080 with the
// game's 90° horizontal field of view. Captured by tests/anim/world-shots.ts.
//   items=<kind>:<type>:<team>[:flag…];…   a row of entities, spaced along x (structure, unit or pickup kinds)
//     flags: target ward tr p2 hp=<0–1> dead (destroyed: the ruin, t seconds after) aggro asleep enraged moving attack
//   dist=<m> yaw=<deg> h=<camera height> at=<look-at height> spacing=<m> t=<seconds> fov=<deg> look=neutral quality=low|medium|high
import { Color, DirectionalLight, FogExp2, HemisphereLight, Mesh, MeshLambertMaterial, NeutralToneMapping, PCFShadowMap, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Scene, Vector3, WebGLRenderer } from 'three';
import type { Object3D } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ViewFlag } from '../../src/sim/core/contracts';
import type { EntityView, SimView, Team } from '../../src/sim/core/contracts';
import type { Quality } from '../../src/client/app/contracts';
import { getMaterialLibrary } from '../../src/client/render/materials';
import { createModelKit } from '../../src/client/render/models/index';

declare global {
  interface Window {
    __frameReady?: boolean;
    __frameStats?: Record<string, number>;
  }
}

const W = 1920;
const H = 1080;
const q = new URLSearchParams(location.search);
const num = (k: string, d: number): number => (q.has(k) ? Number(q.get(k)) : d);
const FOV_H = num('fov', 90);
const DT = 1 / 60;
const settle = num('t', 1.5);
const quality = (q.get('quality') ?? 'medium') as Quality;
const neutral = q.get('look') === 'neutral';

const root = document.getElementById('frame') as HTMLDivElement;
const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.toneMapping = NeutralToneMapping;
renderer.shadowMap.enabled = quality !== 'low';
renderer.shadowMap.type = PCFShadowMap;
root.appendChild(renderer.domElement);

const scene = new Scene();
scene.background = new Color(neutral ? 0x8a8d93 : 0xa99bb0);
if (!neutral) scene.fog = new FogExp2(0xa99bb0, 0.006);
scene.add(neutral ? new HemisphereLight(0xffffff, 0x6a6a6a, Math.PI * 0.55) : new HemisphereLight(0x8fa6c9, 0x4a4a3a, Math.PI * 0.75));
const sun = new DirectionalLight(neutral ? 0xffffff : 0xffd9a0, Math.PI * (neutral ? 1.3 : 1.6));
const elev = (24 * Math.PI) / 180;
sun.position.set(-Math.cos(elev) * 30, Math.sin(elev) * 30, Math.cos(elev) * 14);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 });
scene.add(sun, sun.target);
const ground = new Mesh(new PlaneGeometry(800, 800), new MeshLambertMaterial({ color: neutral ? 0x6c6f75 : 0x7d7262 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const lib = getMaterialLibrary(quality);
const pmrem = new PMREMGenerator(renderer);
lib.setEnvironment(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);

const kit = createModelKit({}, { library: () => lib });

interface Item {
  readonly e: EntityView;
  readonly dead: boolean;
  model?: Object3D;
}
const spacing = num('spacing', 14);
const tokens = (q.get('items') ?? 'structure:hawk:dawn').split(';').filter(Boolean);
const items: Item[] = tokens.map((tok, i) => {
  const [kind = 'structure', type = 'hawk', team = 'dawn', ...flags] = tok.split(':');
  const has = (f: string): boolean => flags.includes(f);
  const hp = Number(flags.find((f) => f.startsWith('hp='))?.slice(3) ?? 1);
  const x = (i - (tokens.length - 1) / 2) * spacing;
  let bits = ViewFlag.Grounded;
  if (has('aggro') || has('attack')) bits |= ViewFlag.Attacking;
  if (has('asleep')) bits |= ViewFlag.Asleep;
  if (has('enraged')) bits |= ViewFlag.Enraged;
  const radius = kind === 'unit' ? 0.5 : 2;
  const e = {
    id: 100 + i, kind, team: team as Team, type, pos: { x, y: 0, z: 0 }, vel: { x: 0, y: 0, z: has('moving') ? 5 : 0 }, yaw: 0, pitch: 0, radius,
    hp: 1000 * hp, maxHp: 1000, shield: 0, flags: bits, mode: null, seenBy: 3,
    ...(kind === 'structure' && {
      structure: {
        type, lane: null, phase: has('p2') ? 2 : 1, body: { radius: type === 'patron' ? 8 : type === 'heron' ? 2.5 : type === 'warden' ? 1.5 : 2, height: 10 },
        target: has('target') ? 1 : null, broodWard: has('ward'), ...(has('tr') && { transitionUntil: Number.MAX_SAFE_INTEGER }),
        weakPoint: has('p2') ? { centre: { x, y: 6, z: 8 }, radius: 1 } : null,
      },
    }),
  } as unknown as EntityView;
  return { e, dead: has('dead') };
});
// A marker the kit poses every frame (its frame hook runs from pose), kept out of sight.
const marker = { id: 1, kind: 'pickup', team: 'neutral', type: 'marker', pos: { x: 0, y: -50, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, radius: 0.1, hp: 0, maxHp: 0, shield: 0, flags: 0, mode: null, seenBy: 3 } as EntityView;
const markerModel = kit.create(marker);
markerModel.visible = false;
scene.add(markerModel);
for (const it of items) {
  it.model = kit.create(it.e);
  scene.add(it.model);
}

// Settle the animation; a destroyed structure lives for a second, then dies and its ruin plays out for `t` seconds.
const view = (tick: number, alive: (it: Item) => boolean): SimView => ({ tick, seconds: tick * DT, entities: [marker, ...items.filter(alive).map((it) => it.e)], heroes: [], localHero: null }) as unknown as SimView;
const dieAt = Math.round(1 / DT);
const total = Math.round(settle / DT) + (items.some((it) => it.dead) ? dieAt : 0);
let prev = view(0, () => true);
for (let tick = 1; tick <= total; tick++) {
  const curr = view(tick, (it) => !it.dead || tick < dieAt);
  const frame = { prev, curr, alpha: 1, dt: DT };
  kit.pose(markerModel, marker, frame);
  for (const it of items) {
    if (!it.model) continue;
    if (it.dead && tick >= dieAt) {
      it.model.removeFromParent();
      continue;
    }
    it.model.position.set(it.e.pos.x, it.e.pos.y, it.e.pos.z);
    it.model.rotation.y = it.e.yaw;
    kit.pose(it.model, it.e, frame);
  }
  prev = curr;
}

const camera = new PerspectiveCamera(1, W / H, 0.05, 600);
camera.fov = (2 * Math.atan(Math.tan((FOV_H * Math.PI) / 360) / camera.aspect) * 180) / Math.PI;
camera.updateProjectionMatrix();
const dist = num('dist', 15);
const yaw = (num('yaw', 20) * Math.PI) / 180;
const lookY = num('at', 4);
camera.position.set(Math.sin(yaw) * dist, num('h', 2), Math.cos(yaw) * dist);
camera.lookAt(new Vector3(0, lookY, 0));
renderer.render(scene, camera);
renderer.info.reset();
renderer.render(scene, camera);
window.__frameStats = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
window.__frameReady = true;
