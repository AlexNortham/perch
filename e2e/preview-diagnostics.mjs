import { chromium, firefox } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const browserName = process.argv[2] ?? 'firefox';
const origin = process.env.PERCH_PREVIEW_URL ?? 'http://127.0.0.1:4178';
const out = 'out/preview-repro';
await mkdir(out, { recursive: true });
const browser = browserName === 'firefox'
  ? await firefox.launch({ firefoxUserPrefs: { 'webgl.force-enabled': true } })
  : await chromium.launch({ channel: 'msedge', args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const aimOnly = process.argv.includes('--aim');
const output = browserName + (aimOnly ? '-aim' : '');
const report = { version: browser.version(), browserName, events: [], samples: [], checks: {} };
const started = Date.now();
const note = (kind, text) => report.events.push({ ms: Date.now() - started, kind, text });
page.on('close', () => note('close'));
page.on('crash', () => note('crash'));
page.on('pageerror', (error) => note('pageerror', error.message));
page.on('console', (msg) => { if (['error', 'warning'].includes(msg.type())) note(msg.type(), msg.text()); });
page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) note('navigate', frame.url()); });
browser.on('disconnected', () => note('disconnect'));

const ready = () => page.waitForFunction('window.__perch?.ready === true', null, { timeout: 30_000 });
const lock = async () => {
  if (await page.evaluate(() => document.pointerLockElement === null)) await page.mouse.click(640, 360);
  await page.waitForFunction(() => document.pointerLockElement !== null, null, { timeout: 8000 });
};
const sample = () => page.evaluate(() => ({
  position: window.__perch?.hero?.pos,
  shots: window.__perch?.hero?.shotsFired,
  frameCount: window.qaFrames,
  contextLost: window.qaContextLost,
  pointerLocked: !!document.pointerLockElement,
  memory: performance.memory?.usedJSHeapSize,
  domNodes: document.querySelectorAll('*').length,
  canvases: document.querySelectorAll('canvas').length,
  url: location.href,
  inputs: window.qaInputs.splice(0),
  actionText: document.querySelector('.pu-hud')?.innerText,
}));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const key = (action) => page.locator('button.pu-key[data-action="' + action + '"]');
const pos = () => page.evaluate(() => window.__perch.hero.pos);
const cdp = browserName === 'edge' ? await context.newCDPSession(page) : null;

async function moveUntil(code, target) {
  await page.keyboard.down(code);
  try {
    await page.waitForFunction(target, null, { timeout: 12_000 });
  } finally {
    await page.keyboard.up(code);
  }
}

async function reachRiverbank() {
  await moveUntil('KeyD', 'window.__perch.hero.pos.x <= -12');
  await moveUntil('KeyW', 'window.__perch.hero.pos.z >= -123');
  await moveUntil('KeyA', 'window.__perch.hero.pos.x >= -4.5');
  await moveUntil('KeyW', 'window.__perch.hero.pos.z >= -104');
  await page.waitForTimeout(300);
}

await page.addInitScript(() => {
  window.qaFrames = 0;
  window.qaContextLost = 0;
  window.qaInputs = [];
  const frame = () => { window.qaFrames++; requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  document.addEventListener('webglcontextlost', () => { window.qaContextLost++; }, true);
  for (const type of ['mousedown', 'mouseup', 'auxclick', 'keydown', 'keyup']) {
    window.addEventListener(type, (event) => {
      setTimeout(() => window.qaInputs.push({
        type, id: event.code ?? event.button, trusted: event.isTrusted, prevented: event.defaultPrevented,
      }));
    }, true);
  }
});

async function diagnoseAim() {
  await page.goto(origin + '/?scene=lane&hero=albatross&seed=1');
  await ready();
  await lock();
  await reachRiverbank();
  report.checks.openLane = await pos();
  // Pitch comes from relative mouse input at 0.06 degrees per count, so 42 counts is 2.52 degrees.
  // Compare both shoulders at flat pitch. The sandbox test records exact ray and tracer vectors.
  for (const [label, dy, shoulderSwap] of [['right-flat', 0, false], ['left-flat', 0, true], ['left-down', 42, false]]) {
    if (shoulderSwap) await page.keyboard.press('KeyG');
    if (dy) {
      await page.mouse.move(640, 360);
      await page.mouse.move(640, 360 + dy);
    }
    await page.waitForTimeout(350);
    await page.screenshot({ path: out + '/' + browserName + '-aim-' + label + '.png' });
    await page.mouse.down();
    await page.waitForTimeout(80);
    await page.screenshot({ path: out + '/' + browserName + '-shot-' + label + '.png' });
    await page.mouse.up();
    await page.waitForTimeout(850);
    report.samples.push({ label, ...await sample() });
  }
}

async function diagnoseInput() {
  await page.goto(origin);
  await ready();
  await page.getByRole('button', { name: 'Options' }).click();
  report.checks.defaults = { crouch: await key('crouch').innerText(), item3: await key('item3').innerText() };
  await key('melee').click();
  await page.mouse.click(1125, 306, { button: 'right' });
  report.checks.rightCapture = { melee: await key('melee').innerText(), aim: await key('aim').innerText() };
  await key('parry').click();
  await page.mouse.click(1125, 306, { button: 'middle' });
  report.checks.middleCapture = { parry: await key('parry').innerText(), ping: await key('ping').innerText() };
  await page.screenshot({ path: out + '/' + browserName + '-options.png' });
  await page.reload();
  await ready();
  await page.getByRole('button', { name: 'Options' }).click();
  report.checks.reload = { melee: await key('melee').innerText(), parry: await key('parry').innerText() };
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.locator('button[data-hero=shrike]').click();
  await lock();
  await reachRiverbank();
  const beforeTap = await pos();
  await page.mouse.click(640, 360, { button: 'right', delay: 80 });
  await page.waitForTimeout(650);
  report.checks.lightDisplacement = distance(beforeTap, await pos());
  const beforeHeavy = await pos();
  await page.mouse.down({ button: 'right' });
  await page.waitForTimeout(1000);
  const heavyHeld = await pos();
  await page.mouse.up({ button: 'right' });
  await page.waitForTimeout(550);
  report.checks.heavyDisplacement = distance(beforeHeavy, heavyHeld);
  report.checks.postReleaseDisplacement = distance(heavyHeld, await pos());
  await page.mouse.click(640, 360, { button: 'middle', delay: 50 });
  await page.screenshot({ path: out + '/' + browserName + '-parry.png' });
  await page.waitForTimeout(1000);
  report.samples.push({ label: 'menu-play-action', ...await sample() });

  const lane = origin + '/?scene=lane&hero=shrike&t=100&seed=1';
  await page.goto(lane);
  await ready();
  await lock();
  await reachRiverbank();
  const run = async (label, actions, rounds) => {
    const begin = Date.now();
    const start = await pos();
    for (let i = 0; i < rounds; i++) {
      const move = i % 2 ? 'KeyS' : 'KeyW';
      await page.keyboard.down(move);
      await page.waitForTimeout(300);
      for (const action of actions) await page.keyboard.down(action);
      await page.waitForTimeout(450);
      for (const action of actions.toReversed()) await page.keyboard.up(action);
      await page.waitForTimeout(850);
      await page.keyboard.up(move);
      if (i % 4 === 0) {
        await page.mouse.click(640, 360, { delay: 200 });
        const snapshot = await sample();
        report.samples.push({ label, round: i + 1, ms: Date.now() - begin, distanceFromStart: distance(start, snapshot.position), ...snapshot });
      }
    }
    report.checks[label] = { rounds, ms: Date.now() - begin, distanceFromStart: distance(start, await pos()) };
  };
  await run('W-Shift-Space', ['ShiftLeft', 'Space'], 35);
  const crouch = report.checks.defaults.crouch === 'C' ? 'KeyC' : 'ControlLeft';
  await run('run-then-crouch', [crouch], 6);
  await page.keyboard.down(crouch);
  await run('crouch-then-run', [], 6);
  await page.keyboard.up(crouch);
  await run('run-dash-crouch', ['ShiftLeft', crouch], 4);
  await page.screenshot({ path: out + '/' + browserName + '-busy-lane.png' });

  // CDP emits genuine content input in Chromium. Playwright's public mouse API accepts only left/middle/right.
  // Dispatching MouseEvents in Firefox can check app routing but cannot test native navigation.
  const side = async (button, down) => {
    if (cdp) {
      await cdp.send('Input.dispatchMouseEvent', {
        type: down ? 'mousePressed' : 'mouseReleased', button: button === 3 ? 'back' : 'forward',
        x: 640, y: 360, clickCount: 1, buttons: down ? (button === 3 ? 8 : 16) : 0,
      });
    } else {
      await page.evaluate(({ button, down }) => {
        const target = document.pointerLockElement ?? document.querySelector('h2') ?? document.body;
        target.dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', { bubbles: true, cancelable: true, button }));
      }, { button, down });
    }
  };
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Options' }).click();
  await key('melee').click();
  await side(3, true);
  await side(3, false);
  await key('parry').click();
  await side(4, true);
  await side(4, false);
  report.checks.sideCapture = { melee: await key('melee').innerText(), parry: await key('parry').innerText() };
  await page.screenshot({ path: out + '/' + browserName + '-side-options.png' });
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Resume' }).click();
  await lock();
  const beforeSideHeavy = await pos();
  await side(3, true);
  await page.waitForTimeout(1000);
  await side(3, false);
  report.checks.sideHeavyDisplacement = distance(beforeSideHeavy, await pos());
  await page.waitForTimeout(550);
  await side(4, true);
  await page.waitForTimeout(120);
  await side(4, false);
  report.samples.push({ label: 'side-input', ...await sample() });
}

try {
  if (aimOnly) await diagnoseAim();
  else await diagnoseInput();
} catch (error) {
  note('failure', error.stack ?? String(error));
  await page.screenshot({ path: out + '/' + output + '-failure.png', timeout: 4000 }).catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(out + '/' + output + '.json', JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  console.log(JSON.stringify({ browserName, version: report.version, checks: report.checks, events: report.events }));
}
