import { describe, expect, it } from 'vitest';
import { createSandbox } from '../../../tests/helpers/sandbox';
import { aimRay } from '../../sim/core/aim';
import { Button, ViewFlag } from '../../sim/core/contracts';
import type { BlockoutPrim, EntityId, MapData } from '../../sim/core/contracts';
import { HEROES } from '../../sim/heroes/registry';
import { loadMap } from '../../sim/world/map';
import type { Frame, Look, Settings } from '../app/contracts';
import { DEFAULT_SETTINGS } from '../app/settings';
import { freeDistance, rayWorldPoint } from './collide';
import { createCamera } from './index';

const settings: Settings = DEFAULT_SETTINGS;
const wall = (x: number, z: number, w: number, d: number): BlockoutPrim => ({
  shape: 'box',
  centre: { x, y: 3, z },
  size: { x: w, y: 6, z: d },
  yaw: 0,
  material: 'brick',
  solid: true,
});
const fixture = (prims: BlockoutPrim[]): MapData => ({ ...loadMap('arena'), prims });

async function setup(at = { x: 0, y: 0, z: -20 }) {
  const sb = await createSandbox({ heroes: [{ hero: 'shrike', at }] });
  const hero = sb.heroes[0] as EntityId;
  const frame = (): Frame => ({ prev: sb.view, curr: sb.view, alpha: 1, dt: 1 / 60 });
  return { sb, hero, frame };
}

describe('player camera = the sim aim ray', () => {
  it.each([1, -1] as const)('at rest, shoulder %i: position and look direction match aimRay', async (shoulder) => {
    const { sb, hero, frame } = await setup();
    if (shoulder === -1) sb.press(hero, Button.ShoulderSwap);
    sb.step(2);
    const cam = createCamera(settings);
    for (const look of [{ yaw: 0, pitch: 0 }, { yaw: 1.2, pitch: 0.3 }, { yaw: -2.5, pitch: -0.5 }] as Look[]) {
      const pose = cam.update(frame(), 'shrike', look, 'player');
      const me = sb.view.entities.find((e) => e.id === hero);
      const ray = aimRay(me?.pos ?? { x: 0, y: 0, z: 0 }, look.yaw, look.pitch, shoulder, HEROES.shrike.def.body, false);
      expect(pose.position.x).toBeCloseTo(ray.origin.x, 9);
      expect(pose.position.y).toBeCloseTo(ray.origin.y, 9);
      expect(pose.position.z).toBeCloseTo(ray.origin.z, 9);
      const d = { x: pose.target.x - pose.position.x, y: pose.target.y - pose.position.y, z: pose.target.z - pose.position.z };
      const n = Math.hypot(d.x, d.y, d.z);
      expect(d.x / n).toBeCloseTo(ray.dir.x, 9);
      expect(d.y / n).toBeCloseTo(ray.dir.y, 9);
      expect(d.z / n).toBeCloseTo(ray.dir.z, 9);
    }
  });

  it('eases the shoulder over 0.15 s', async () => {
    const { sb, hero, frame } = await setup();
    const cam = createCamera(settings);
    const look = { yaw: 0, pitch: 0 };
    const before = cam.update(frame(), 'shrike', look, 'player').position.x;
    sb.press(hero, Button.ShoulderSwap);
    sb.step(2);
    const mid = cam.update({ ...frame(), dt: 0.075 }, 'shrike', look, 'player').position.x;
    const after = cam.update({ ...frame(), dt: 0.075 }, 'shrike', look, 'player').position.x;
    expect(Math.abs(mid - before)).toBeGreaterThan(0.1);
    expect(Math.abs(after - before)).toBeCloseTo(1.5, 6); // 2 x shoulderRight
    expect(Math.abs(mid - before)).toBeLessThan(Math.abs(after - before));
  });
});

describe('collision pull-in', () => {
  it('a wall behind the hero pulls the camera in along the aim ray, then eases back out at 6 m/s', async () => {
    const { sb, frame } = await setup();
    const open = createCamera(settings, () => fixture([]));
    const look = { yaw: 0, pitch: 0 }; // looking +z, camera behind at -z
    const free = open.update(frame(), 'shrike', look, 'player');
    const cam = createCamera(settings, () => fixture([wall(0, -22.5, 20, 1)])); // wall face at z = -22
    const pulled = cam.update(frame(), 'shrike', look, 'player');
    const me = sb.view.entities[0]?.pos ?? { x: 0, y: 0, z: 0 };
    expect(pulled.position.z).toBeGreaterThan(free.position.z + 0.5);
    expect(pulled.position.z).toBeLessThan(-22 + 0.001 + 3.2); // never inside the wall, always behind the hero
    expect(pulled.position.z).toBeLessThan(me.z);
    // The look direction (crosshair ray) is unchanged.
    expect(pulled.target.x - pulled.position.x).toBeCloseTo(free.target.x - free.position.x, 9);
    expect(pulled.target.z - pulled.position.z).toBeCloseTo(free.target.z - free.position.z, 9);
    // Wall gone: back out at 6 m/s, not instantly.
    let walls = true;
    const toggled = createCamera(settings, () => fixture(walls ? [wall(0, -22.5, 20, 1)] : []));
    const a = toggled.update(frame(), 'shrike', look, 'player').position.z;
    walls = false;
    const b = toggled.update({ ...frame(), dt: 0.05 }, 'shrike', look, 'player').position.z;
    expect(b - a).toBeCloseTo(-0.3, 3);
  });

  it('never goes closer than the 0.6 m minimum boom', async () => {
    const { frame } = await setup();
    const cam = createCamera(settings, () => fixture([wall(0, -20.6, 20, 0.2)]));
    const pose = cam.update(frame(), 'shrike', { yaw: 0, pitch: 0 }, 'player');
    expect(Math.hypot(pose.position.x, pose.position.z + 20)).toBeGreaterThan(0.5);
  });

  it('freeDistance: clear, blocked, and ramps', () => {
    const map = fixture([wall(0, 5, 10, 1)]);
    const from = { x: 0, y: 1.5, z: 0 };
    expect(freeDistance(map, from, { x: 0, y: 1.5, z: 3 })).toBeCloseTo(3);
    // Wall face at z = 4.5; the march steps 0.1 m, so the hit is found up to 0.1 m late.
    expect(Math.abs(freeDistance(map, from, { x: 0, y: 1.5, z: 8 }) - (4.5 - 0.25 - 0.1))).toBeLessThan(0.11);
    // Standing on a ramp's slope is not inside it: the segment above the slope is clear.
    const ramp: BlockoutPrim = { shape: 'ramp', centre: { x: 0, y: 1, z: 0 }, size: { x: 4, y: 2, z: 6 }, yaw: 0, material: 'stone', solid: true };
    const m2 = fixture([ramp]);
    expect(freeDistance(m2, { x: 0, y: 2.6, z: 1 }, { x: 0, y: 3.2, z: -2 })).toBeCloseTo(Math.hypot(0.6, 3));
    expect(freeDistance(m2, { x: 0, y: 1, z: -4 }, { x: 0, y: 1, z: 4 })).toBeLessThan(8); // runs into the slope
  });

  it('rayWorldPoint finds the first solid point', () => {
    const map = fixture([wall(0, 10, 10, 2)]);
    const p = rayWorldPoint(map, { x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: 1 }, 50, 1);
    expect(p?.z).toBeCloseTo(9, 1);
    expect(rayWorldPoint(map, { x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: -1 }, 50, 1)).toBeNull();
  });
});

describe('dash kick, death camera, presets', () => {
  it('kicks the FOV while dashing and eases back', async () => {
    const { sb, hero, frame } = await setup();
    const cam = createCamera(settings, () => fixture([]));
    const look = { yaw: 0, pitch: 0 };
    sb.move(hero, 1);
    sb.press(hero, Button.Dash);
    sb.step(3);
    const kicked = cam.update({ ...frame(), dt: 0.1 }, 'shrike', look, 'player').fovDeg;
    expect(kicked).toBeGreaterThan(settings.fovDeg);
    expect(kicked).toBeLessThanOrEqual(settings.fovDeg + 6 + 1e-9);
  });

  it('orbits and rises over the body when dead, then blends back to the player camera', async () => {
    const { sb, frame } = await setup();
    const cam = createCamera(settings, () => fixture([]));
    const look = { yaw: 0, pitch: 0 };
    const alive = cam.update(frame(), 'shrike', look, 'player');
    const view = { ...sb.view, entities: sb.view.entities.map((e) => ({ ...e, flags: e.flags | ViewFlag.Dead })) };
    const dead: Frame = { prev: view, curr: view, alpha: 1, dt: 0.1 };
    let pose = alive;
    for (let i = 0; i < 20; i++) pose = cam.update(dead, 'shrike', look, 'player'); // 2 s
    const body = sb.view.entities[0]?.pos ?? { x: 0, y: 0, z: 0 };
    expect(pose.position.y).toBeGreaterThan(alive.position.y + 2);
    expect(Math.hypot(pose.target.x - body.x, pose.target.z - body.z)).toBeLessThan(0.01);
    for (let i = 0; i < 6; i++) pose = cam.update({ ...frame(), dt: 0.1 }, 'shrike', look, 'player');
    expect(pose.position.y).toBeCloseTo(alive.position.y, 6);
  });

  it('keeps overview and top working', async () => {
    const { frame } = await setup();
    const cam = createCamera(settings);
    for (const preset of ['overview', 'top'] as const) {
      const pose = cam.update(frame(), null, { yaw: 0, pitch: 0 }, preset);
      expect(pose.position.y).toBeGreaterThan(10);
      expect(pose.fovDeg).toBe(settings.fovDeg);
    }
  });
});
