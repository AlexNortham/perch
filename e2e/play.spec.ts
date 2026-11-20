import { expect, test, type Page } from '@playwright/test';
import { ViewFlag } from '../src/sim/core/contracts';
import { TICK_RATE } from '../src/sim/data/core';
import { loadMap } from '../src/sim/world/map';
import { afterTicks, fire, hero, lockPointer, open, pickHero, READY_TIMEOUT_MS, VIEWPORT, type HeroHook } from './game';

const SPEED_SAMPLE_TICKS = 9;
const RUN_WARMUP_TICKS = 16;
const MIN_WALK_SPEED_M_S = 5;
const MIN_DASH_TO_WALK_RATIO = 1.75;
const STATION_APPROACH_M = 0.65;

const horizontalSpeed = (a: HeroHook, b: HeroHook): number =>
  Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z) * TICK_RATE / (b.tick - a.tick);

async function moveTo(page: Page, key: string, axis: 'x' | 'z', threshold: number, direction = 1): Promise<void> {
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(({ axis, threshold, direction }) => {
      const pos = window.__perch?.hero?.pos[axis];
      return pos !== undefined && (pos - threshold) * direction >= 0;
    }, { axis, threshold, direction }, { timeout: 12_000 });
  } finally {
    await page.keyboard.up(key);
  }
}

test.use({ viewport: VIEWPORT });
test.setTimeout(READY_TIMEOUT_MS * 2);

test('Play → Shrike card → Dawn lane: pointer lock, measured walk and dash, gunfire', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await open(page, '/?zipline=0');
  await pickHero(page, 'Play', 'Shrike');
  const spawn = loadMap('main').spawns.find((s) => s.team === 'dawn')!;
  const start = await hero(page);
  expect(start.pos.x, 'Dawn roster spawn on Old Mossmarket').toBeCloseTo(spawn.pos.x);
  expect(start.pos.z).toBeCloseTo(spawn.pos.z);
  expect(start.shotsFired).toBe(0);
  await expect(page.getByText('Briar Patch', { exact: true })).toBeVisible();
  await lockPointer(page);

  await page.keyboard.down('KeyW');
  try {
    const walking = await afterTicks(page, (await hero(page)).tick, RUN_WARMUP_TICKS);
    const walked = await afterTicks(page, walking.tick, SPEED_SAMPLE_TICKS);
    await page.keyboard.press('ShiftLeft');
    const dashed = await afterTicks(page, walked.tick, SPEED_SAMPLE_TICKS);
    const walkSpeed = horizontalSpeed(walking, walked);
    const dashSpeed = horizontalSpeed(walked, dashed);
    await info.attach('measured movement', { body: JSON.stringify({ walking, walked, dashed, walkSpeed, dashSpeed }), contentType: 'application/json' });
    expect(walkSpeed, 'steady walk advances in metres per simulated second').toBeGreaterThan(MIN_WALK_SPEED_M_S);
    expect(dashSpeed, 'dash advances materially faster than walking over the same simulated interval').toBeGreaterThan(walkSpeed * MIN_DASH_TO_WALK_RATIO);
  } finally {
    await page.keyboard.up('KeyW');
  }

  await fire(page);
  expect(errors).toEqual([]);
});

test('Riverbank Updraft: mount at the real gate, ride, boost, shoot and jump off', async ({ page }, info) => {
  await open(page, '/?zipline=0');
  await pickHero(page, 'Play', 'Shrike');
  await lockPointer(page);
  const riverbank = loadMap('main').updrafts.find(({ lane }) => lane === 'riverbank')!;
  const gate = riverbank.stations[0]!;

  // Take the western Home Roost ramp around the Patron's dais before lining up on the gate.
  await moveTo(page, 'KeyD', 'x', -12, -1);
  await moveTo(page, 'KeyW', 'z', -122);
  await moveTo(page, 'KeyA', 'x', gate.x - STATION_APPROACH_M);
  await moveTo(page, 'KeyW', 'z', gate.z - STATION_APPROACH_M);
  const approached = await hero(page);
  expect(Math.hypot(approached.pos.x - gate.x, approached.pos.z - gate.z), 'walk reaches the gate station').toBeLessThan(2);
  // D-EP-039: no Interact key. A held Jump (at least 0.2 s, GDD §3.7) latches the Updraft.
  await page.keyboard.down('Space');
  await expect.poll(async () => (await hero(page)).flags & ViewFlag.OnUpdraft, {
    message: 'a held Jump latches the actual Riverbank Updraft at the gate', timeout: 3_000,
  }).toBeTruthy();
  await page.keyboard.up('Space');

  const mounted = await hero(page);
  const riding = await afterTicks(page, mounted.tick, 24);
  expect(riding.pos.y, 'rider ascends to the elevated line').toBeGreaterThan(approached.pos.y + 6);
  await page.screenshot({ path: info.outputPath('riverbank-updraft.png') });
  const cruise = await hero(page);
  const cruised = await afterTicks(page, cruise.tick, SPEED_SAMPLE_TICKS);
  await page.keyboard.press('ShiftLeft');
  const boosted = await afterTicks(page, cruised.tick, SPEED_SAMPLE_TICKS);
  const rideSpeed = horizontalSpeed(cruise, cruised);
  const boostSpeed = horizontalSpeed(cruised, boosted);
  await info.attach('measured Updraft', { body: JSON.stringify({ gate, mounted, riding, rideSpeed, boostSpeed }), contentType: 'application/json' });
  expect(rideSpeed, 'mounted hero travels along the line').toBeGreaterThan(9);
  expect(boostSpeed, 'Shift increases mounted speed').toBeGreaterThan(rideSpeed * 1.25);
  await fire(page);
  expect((await hero(page)).flags & ViewFlag.OnUpdraft, 'normal weapon fire stays mounted').toBeTruthy();
  await page.keyboard.press('Space');
  await expect.poll(async () => (await hero(page)).flags & ViewFlag.OnUpdraft, { message: 'Space dismounts' }).toBe(0);
});
