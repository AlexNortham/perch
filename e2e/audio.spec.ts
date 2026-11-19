// Real signal checks: the audio module is bundled and run inside the browser, rendered offline with an
// OfflineAudioContext, and the samples measured. This proves sound is *generated and routed*, not merely that events
// were delivered. A second page uses a live AudioContext to check the first-gesture resume and real-time output.
import { build } from 'esbuild';
import { expect, test, type Page } from '@playwright/test';
import { HERO_IDS } from '../src/sim/core/contracts';

// Page-side objects are untyped by nature (they live in the browser); JSON.parse gives a loosely typed stand-in.
type Loose = ReturnType<typeof JSON.parse>;
let bundleText = '';
const SECONDS = 3;
test.describe.configure({ mode: 'serial' }); // one browser at a time: concurrent headless offline renders occasionally stall

test.beforeAll(async () => {
  const bundle = await build({
    entryPoints: ['src/client/audio/index.ts'],
    bundle: true, write: false, format: 'iife', globalName: 'PerchAudio', platform: 'browser',
  });
  bundleText = bundle.outputFiles[0]!.text;
});

/** Load the bundle into a blank page and install the offline-render helper `window.run`. */
const setup = async (page: Page): Promise<void> => {
  await page.goto('about:blank');
  await page.addScriptTag({ content: bundleText });
  await page.evaluate((secs) => {
    const w = window as unknown as Record<string, unknown>;
    const settings = (v: Partial<{ master: number; sfx: number; music: number }> = {}) => ({ volume: { master: 1, sfx: 1, music: 0, ...v } });
    const hero = (id: number, heroId: string, team: string) => ({ id, heroId, team });
    const ent = (id: number, kind: string, type: string, team: string, x: number, hp = 100) =>
      ({ id, kind, type, team, pos: { x, y: 0, z: 0 }, hp, maxHp: 100 });
    const viewOf = (over: Record<string, unknown> = {}) => ({
      tick: 0, seconds: 5, localHero: 1, over: false, winner: null,
      heroes: [hero(1, 'owl', 'dawn'), hero(2, 'kingfisher', 'dusk')],
      entities: [ent(1, 'hero', 'owl', 'dawn', 0), ent(2, 'hero', 'kingfisher', 'dusk', 0)],
      ...over,
    });
    /** Render `secs` of audio. `go(audio, ctx, view)` feeds it; `at` = optional [time, fn] run mid-render. */
    w.run = async (cfg: { settings?: object; go: (a: Loose, c: OfflineAudioContext, v: Loose) => void; at?: [number, (a: Loose) => void]; prep?: (v: Loose) => void; lookahead?: number }) => {
      const ctx = new OfflineAudioContext(2, 44100 * secs, 44100);
      const P = (window as Loose).PerchAudio;
      const audio = P.createAudio(cfg.settings ?? settings(), { ctx, lookahead: cfg.lookahead ?? 0.25 });
      const view = viewOf();
      cfg.prep?.(view);
      const pose = { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: -1 }, fovDeg: 90 };
      audio.update({ curr: view, prev: view, alpha: 1, dt: 0.016 }, pose);
      cfg.go(audio, ctx, view);
      if (cfg.at) { const [t, fn] = cfg.at; void ctx.suspend(t).then(() => { fn(audio); void ctx.resume(); }); }
      const buf = await ctx.startRendering();
      const d = buf.getChannelData(0), e = buf.getChannelData(1);
      const rms = (a: Float32Array, from: number, to: number) => { let s = 0; for (let i = from; i < to; i++) s += a[i]! * a[i]!; return Math.sqrt(s / (to - from)); };
      const n = d.length, h = n >> 1;
      let sig = 0;
      for (let i = 0; i < n; i += 7) sig = (sig * 31 + Math.round(d[i]! * 1e5)) % 1000003;
      return { rms: rms(d, 0, n), rmsR: rms(e, 0, n), first: rms(d, 0, h), second: rms(d, h, n), peak: Math.max(...d.subarray(0, n).map(Math.abs).slice(0, 1)), sig, nan: d.some(Number.isNaN) };
    };
    w.ev = { settings, viewOf, ent, hero };
  }, SECONDS);
};

type Out = { rms: number; rmsR: number; first: number; second: number; sig: number; nan: boolean };
const run = (page: Page, go: string, extra = '{}'): Promise<Out> =>
  page.evaluate(`(async () => { const E = window.ev; return window.run({ go: (a, c, v) => { ${go} }, ...(${extra}) }); })()`) as Promise<Out>;

const fire = (shooter: number, x = 0) => `a.onEvents([{ type: 'weapon.fired', shooter: ${shooter}, muzzle: { x: ${x}, y: 0, z: 0 }, dir: { x: 0, y: 0, z: -1 } }], v);`;

test.describe('generated signal', () => {
  test('every hero gun produces a distinct, finite signal', async ({ page }) => {
    await setup(page);
    const sigs = new Set<number>();
    for (const h of HERO_IDS) {
      const r = await run(page, `v.heroes[1].heroId = '${h}'; ${fire(2, 3)}`);
      expect(r.nan).toBe(false);
      expect(r.rms, h).toBeGreaterThan(1e-4);
      sigs.add(r.sig);
    }
    expect(sigs.size).toBeGreaterThanOrEqual(20); // guns share recipes, but tuning keeps almost all distinct
  });

  test('every hero call plays on respawn and differs per hero', async ({ page }) => {
    await setup(page);
    const sigs = new Set<number>();
    for (const h of HERO_IDS) {
      const r = await run(page, `v.heroes[1].heroId = '${h}'; a.onEvents([{ type: 'hero.respawned', hero: 2, pos: { x: 3, y: 0, z: 0 } }], v);`);
      expect(r.rms, h).toBeGreaterThan(1e-5);
      sigs.add(r.sig);
    }
    expect(sigs.size).toBe(HERO_IDS.length);
  });

  // One test per event: each renders its own 3 s clip, and under a parallel run they share the machine.
  const evs = [
      `{ type: 'damage.applied', source: 1, sourceTeam: 'dawn', target: 2, targetKind: 'hero', amount: 9, absorbed: 0, beakShot: true, weakPoint: false, pos: { x: 4, y: 0, z: 0 } }`,
      `{ type: 'pod.resolved', pod: 9, by: 1, outcome: 'secured', pos: { x: 4, y: 0, z: 0 } }`,
      `{ type: 'pod.resolved', pod: 9, by: 1, outcome: 'denied', pos: { x: 4, y: 0, z: 0 } }`,
      `{ type: 'hero.level', hero: 1, level: 2, ap: 1, unlockSlot: null }`,
      `{ type: 'melee', attacker: 2, heavy: true, target: 1, parried: false }`,
      `{ type: 'parry', hero: 2, outcome: 'success', attacker: null }`,
      `{ type: 'structure.attack', structure: 5, attack: 'bolt', origin: { x: 5, y: 0, z: 0 }, point: { x: 0, y: 0, z: 0 }, impactAt: 1 }`,
      `{ type: 'structure.state', structure: 5, state: 'phase2' }`,
      `{ type: 'objective', action: 'eggSpawned', hero: null, team: 'neutral', pickup: null, pickupType: 'egg', pos: { x: 0, y: 0, z: 0 } }`,
      `{ type: 'objective', action: 'rocSpawned', hero: null, team: 'neutral', pickup: null, pickupType: null, pos: { x: 0, y: 0, z: 0 } }`,
      `{ type: 'ping', by: 1, team: 'dawn', kind: 'danger', pos: { x: 0, y: 0, z: 0 }, target: null }`,
  ];
  for (const e of evs) {
    test(`the event table makes sound: ${/type: '([\w.]+)'(?:.*(?:action|outcome|kind|attack|state): '(\w+)')?/.exec(e)?.slice(1).join(' ')}`, async ({ page }) => {
      await setup(page);
      expect((await run(page, `a.onEvents([${e}], v);`)).rms, e).toBeGreaterThan(1e-5);
    });
  }

  test('a structure under hero fire sounds the map-wide alarm at most once per 4 s', async ({ page }) => {
    await setup(page);
    const hit = (s: number) => `v.seconds = ${s}; v.entities.push(E.ent(5, 'structure', 'hawk', 'dawn', 200)); a.onEvents([{ type: 'damage.applied', source: 2, sourceTeam: 'dusk', target: 5, targetKind: 'structure', amount: 1, absorbed: 0, beakShot: false, weakPoint: false, pos: { x: 200, y: 0, z: 0 } }], v);`;
    const once = await run(page, hit(5));
    const twice = await run(page, hit(5) + hit(6));
    expect(once.rms).toBeGreaterThan(1e-4); // 200 m away, yet audible: flat, not positional
    expect(twice.sig).toBe(once.sig); // the second hit 1 s later is suppressed
  });
});

test.describe('mix and settings', () => {
  test('master 0 is silent; sfx 0 mutes effects; music 0 mutes music', async ({ page }) => {
    await setup(page);
    const roar = `a.onEvents([{ type: 'objective', action: 'rocSpawned', hero: null, team: 'neutral', pickup: null, pickupType: null, pos: { x: 0, y: 0, z: 0 } }], v);`;
    const base = await run(page, roar);
    const master0 = await run(page, roar, `{ settings: E.settings({ master: 0 }) }`);
    const sfx0 = await run(page, roar, `{ settings: E.settings({ sfx: 0 }) }`);
    expect(base.rms).toBeGreaterThan(0.01);
    expect(master0.rms).toBeLessThan(1e-6);
    expect(sfx0.rms).toBeLessThan(base.rms * 0.01);
    const musicOn = await run(page, '', `{ settings: E.settings({ music: 1 }), lookahead: 2.5 }`);
    const musicOff = await run(page, '', `{ settings: E.settings({ music: 0 }), lookahead: 2.5 }`);
    expect(musicOn.rms).toBeGreaterThan(musicOff.rms * 2);
  });

  test('volume changes live, mid-sound, and reset() silences old voices', async ({ page }) => {
    await setup(page);
    const roar = `a.onEvents([{ type: 'objective', action: 'rocSpawned', hero: null, team: 'neutral', pickup: null, pickupType: null, pos: { x: 0, y: 0, z: 0 } }], v);`;
    const live = await run(page, roar, `{ at: [1.5, (a) => a.setSettings(E.settings({ master: 0 })) ] }`);
    expect(live.first).toBeGreaterThan(0.01);
    expect(live.second).toBeLessThan(live.first * 0.02);
    const reset = await run(page, roar, `{ at: [1.5, (a) => a.reset() ] }`);
    expect(reset.second).toBeLessThan(reset.first * 0.2); // only the wind bed remains
  });

  test('is positional: farther is quieter, beyond 60 m is dropped, enemies pan to their side', async ({ page }) => {
    await setup(page);
    const bed = (await run(page, '')).rms; // the wind bed is always there
    const net = (r: Out) => Math.sqrt(Math.max(0, r.rms ** 2 - bed ** 2));
    const near = await run(page, fire(2, 6));
    const far = await run(page, fire(2, 40));
    const gone = await run(page, fire(2, 70));
    expect(net(far)).toBeLessThan(net(near) * 0.5);
    expect(net(gone)).toBeLessThan(1e-5);
    const left = await run(page, fire(2, -8));
    const right = await run(page, fire(2, 8));
    expect(left.rmsR / left.rms).not.toBeCloseTo(right.rmsR / right.rms, 2);
  });

  test('music states differ and a state change takes effect on the next bar', async ({ page }) => {
    await setup(page);
    const m = `{ settings: E.settings({ music: 1 }), lookahead: 2.9 }`;
    const laning = await run(page, '', m);
    const siege = await run(page, '', `{ settings: E.settings({ music: 1 }), lookahead: 2.9, prep: (v) => { v.entities.push(E.ent(7, 'structure', 'patron', 'dawn', 10)); v.entities[1].pos.x = 12; } }`);
    expect(laning.sig).not.toBe(siege.sig);
    expect(siege.rms).toBeGreaterThan(laning.rms);
  });
});

test.describe('live context', () => {
  test('creates no context until a real click, then runs and emits real-time signal', async ({ page: p }) => {
    await p.goto('about:blank');
    await p.addScriptTag({ content: bundleText });
    await p.evaluate(() => {
      const w = window as Loose;
      const Orig = window.AudioContext;
      w.__ctx = null;
      w.AudioContext = class extends Orig {
        constructor() {
          super();
          w.__ctx = this;
          const an = this.createAnalyser();
          w.__an = an;
          const make = this.createDynamicsCompressor.bind(this);
          this.createDynamicsCompressor = () => { const c = make(); c.connect(an); return c; };
        }
      };
      w.audio = w.PerchAudio.createAudio({ volume: { master: 1, sfx: 1, music: 0 } });
      const b = document.createElement('button');
      b.id = 'play'; b.textContent = 'Play';
      b.onclick = () => w.audio.resume();
      document.body.append(b);
      w.audio.onEvents([], { heroes: [], entities: [], localHero: null }); // before the gesture: harmless
    });
    expect(await p.evaluate(() => (window as Loose).__ctx)).toBeNull();
    await p.click('#play');
    await p.waitForFunction(() => (window as Loose).__ctx?.state === 'running');
    await p.evaluate(() => {
      const w = window as Loose;
      const v = { heroes: [{ id: 1, heroId: 'owl', team: 'dawn' }], entities: [], localHero: 1, seconds: 1, over: false };
      w.audio.onEvents([{ type: 'objective', action: 'rocSpawned', hero: null, team: 'neutral', pickup: null, pickupType: null, pos: { x: 0, y: 0, z: 0 } }], v);
    });
    await p.waitForTimeout(400);
    const peak = await p.evaluate(() => {
      const an = (window as Loose).__an as AnalyserNode;
      const d = new Float32Array(an.fftSize);
      an.getFloatTimeDomainData(d);
      return Math.max(...d.map(Math.abs));
    });
    expect(peak).toBeGreaterThan(0.005);
    await p.evaluate(() => (window as Loose).audio.dispose());
    await p.waitForFunction(() => (window as Loose).__ctx.state === 'closed');
  });
});
