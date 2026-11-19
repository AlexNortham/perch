import { describe, expect, it } from 'vitest';
import { mapEvents } from '../src/client/vfx/mapping';
import { lookDir } from '../src/sim/core/aim';
import { Button } from '../src/sim/core/contracts';
import type { HeroId, Vec3 } from '../src/sim/core/contracts';
import { dot, normalize, sub } from '../src/sim/core/math';
import { createSandbox } from './helpers/sandbox';

const shallowPitch = 2.5 * Math.PI / 180;

async function shot(hero: HeroId, position: Vec3, pitch: number, leftShoulder = false) {
  const sandbox = await createSandbox({ heroes: [{ hero, at: position, yaw: 0 }] });
  const [me] = sandbox.heroes;
  if (me === undefined) throw new Error('Local hero was not created');
  if (leftShoulder) {
    sandbox.press(me, Button.ShoulderSwap);
    sandbox.step(1);
  }
  sandbox.clearEvents();
  sandbox.look(me, 0, pitch);
  sandbox.fire(me);
  sandbox.step(1);
  const [fired] = sandbox.eventsOf('weapon.fired');
  if (!fired) throw new Error('No shot fired');
  const tracers: Vec3[] = [];
  mapEvents(sandbox.events, {
    entity: (id) => sandbox.view.entities.find((entity) => entity.id === id),
    hitscan: () => true,
    localTeam: 'dawn',
  }, {
    burst: () => undefined,
    tracer: (_from, to) => tracers.push(to),
    hitFlash: () => undefined,
    tether: () => undefined,
  });
  return { fired, impacts: sandbox.eventsOf('projectile.impact'), tracers };
}

describe('preview gun direction and tracer coverage', () => {
  it.each([
    ['albatross', 'right', 0],
    ['albatross', 'left', 0],
    ['albatross', 'right', shallowPitch],
    ['albatross', 'left', -shallowPitch],
    ['kingfisher', 'right', 0],
    ['kingfisher', 'left', -shallowPitch],
  ] as const)('%s on the %s shoulder still centres an open shot at pitch %s', async (hero, shoulder, pitch) => {
    const { fired } = await shot(hero, { x: 0, y: 0, z: -10 }, pitch, shoulder === 'left');
    expect(dot(fired.dir, lookDir(0, pitch)), 'the centre is aligned with the distant crosshair').toBeGreaterThan(0.999);
  });

  it('a rear/side box leaves the centre clear while a box ahead stops pellets below the crosshair', async () => {
    const rear = await shot('albatross', { x: 9.7, y: 0, z: 1.6 }, 0);
    expect(dot(rear.fired.dir, lookDir(0, 0))).toBeGreaterThan(0.999);
    expect(rear.impacts.some(({ pos }) => pos.z < 3)).toBe(false);

    const front = await shot('albatross', { x: 8, y: 0, z: -2 }, 0);
    expect(dot(front.fired.dir, lookDir(0, 0))).toBeGreaterThan(0.999);
    expect(front.impacts.some(({ pos }) => Math.abs(pos.z - (-1)) < 0.01)).toBe(true);
  });

  it('a few terrain hits do not hide the open aim of the whole shotgun blast', async () => {
    const { fired, impacts, tracers } = await shot('albatross', { x: 0, y: 0, z: -10 }, -shallowPitch);
    expect(impacts.length, 'some pellets hit the ground').toBeGreaterThan(0);
    expect(impacts.length, 'some pellets miss').toBeLessThan(8);
    const tracerDirections = tracers.map((point) => normalize(sub(point, fired.muzzle)));
    expect(tracerDirections.some((direction) => direction.y >= fired.dir.y),
      'show a ray along the centre or the open half of the fan as well as below-centre terrain hits').toBe(true);
  });
});
