import { TICK_RATE } from '../../sim/data/core';
import type { EntityId, HeroId, Sim, SimConfig, SimView } from '../../sim/core/contracts';
import { createSim } from '../../sim/index';
import { loadMap } from '../../sim/world/map';
import { createAudio } from '../audio';
import { createCamera } from '../camera';
import { createInput } from '../input';
import { createRenderer } from '../render';
import { createUi } from '../ui';
import { createVfx } from '../vfx';
import type { AppActions, CameraPreset, Frame, Screen, Settings, UiAction } from './contracts';
import { createFixedStep, entityById } from './loop';
import { matchConfig, sceneConfig } from './router';
import type { SceneName, SceneRequest } from './router';
import { loadSettings, saveSettings } from './settings';

declare global {
  interface Window {
    /** Set once the requested scene has rendered READY_FRAMES frames; the screenshot harness waits on it. */
    __perch?: { ready: boolean; scene: SceneName };
  }
}

const READY_FRAMES = 3;
const MS_PER_SECOND = 1000;

/** One running sim and the two newest views the renderer interpolates between. */
interface Session {
  readonly sim: Sim;
  readonly seed: number;
  readonly hero: EntityId | null;
  readonly heroId: HeroId | null;
  readonly cam: CameraPreset;
  prev: SimView;
  curr: SimView;
}

/**
 * The app: boots the modules, runs the state machine (menu → heroSelect → match ⇄ pause → end → menu) and the
 * fixed-step loop (input → command → sim.step → drained events → vfx, ui, audio → render).
 */
export async function startApp(root: HTMLElement, req: SceneRequest): Promise<void> {
  let settings: Settings = loadSettings();
  const quality = req.quality ?? settings.quality;
  const stage = document.createElement('div');
  stage.style.cssText = 'position:absolute;inset:0';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  root.append(stage, overlay);

  const firstConfig = sceneConfig(req);
  const renderer = createRenderer(stage, loadMap(firstConfig.map ?? 'main'), quality);
  const vfx = createVfx(renderer);
  const audio = createAudio(settings);
  const camera = createCamera(settings);
  const step = createFixedStep();
  let screen: Screen = 'menu';
  let session: Session;
  /** Set by the pause menu's Concede; sent with the next command. */
  let concedeNext = false;

  const actions: AppActions = {
    play: () => show('heroSelect'),
    startMatch: (setup) => {
      void startSession(matchConfig(setup), 'player', 0).then((s) => {
        session = s;
        show('match');
      });
    },
    toMenu: () => {
      void startSession(sceneConfig({ ...req, scene: 'menu' }), 'overview', 0).then((s) => {
        session = s;
        show('menu');
      });
    },
    resume: () => show('match'),
    concede: () => {
      concedeNext = true;
      show('match');
    },
    saveSettings: (next) => {
      settings = next;
      saveSettings(next);
      input.setSettings(next);
      camera.setSettings(next);
      audio.setSettings(next);
      renderer.setQuality(next.quality);
    },
  };
  const ui = createUi(overlay, actions);
  const onUiAction = (action: UiAction, down: boolean): void => {
    if (action !== 'pause') ui.onUiAction(action, down);
    else if (down && screen === 'match') show('pause');
    else if (down && screen === 'pause') show('match');
  };
  const input = createInput(stage, settings, onUiAction);
  session = await startSession(firstConfig, req.cam, req.t);

  function show(next: Screen): void {
    screen = next;
    input.setEnabled(next === 'match' && session.hero !== null);
    if (next === 'match') audio.resume();
    const telemetry = next === 'end' ? session.sim.telemetry() : null;
    ui.show(next, { view: session.curr, settings, seed: session.seed, telemetry });
  }

  async function startSession(config: SimConfig, cam: CameraPreset, fastForwardS: number): Promise<Session> {
    const sim = await createSim(config);
    for (let i = 0, n = Math.round(fastForwardS * TICK_RATE); i < n && !sim.isOver; i++) sim.step();
    sim.drainEvents();
    renderer.setMap(loadMap(config.map ?? 'main'));
    step.reset();
    const hero = sim.view.localHero;
    const heroId = sim.view.heroes.find((h) => h.id === hero)?.heroId ?? null;
    const me = hero === null ? undefined : entityById(sim.view, hero);
    if (me) input.setLook({ yaw: me.yaw, pitch: me.pitch });
    return { sim, seed: config.seed, hero, heroId, cam, prev: sim.view, curr: sim.view };
  }

  const resize = (): void => renderer.resize(root.clientWidth, root.clientHeight);
  window.addEventListener('resize', resize);
  resize();
  show(req.scene === 'menu' ? 'menu' : 'match');

  let frames = 0;
  let last = performance.now();
  const frame = (now: number): void => {
    const dt = (now - last) / MS_PER_SECOND;
    last = now;
    const s = session;
    const running = (screen === 'match' || screen === 'menu') && !s.sim.isOver;
    const steps = running ? step.advance(dt) : 0;
    for (let i = 0; i < steps; i++) {
      const command = { ...input.sample(), concede: concedeNext };
      concedeNext = false;
      s.sim.step(s.hero === null ? [] : [{ hero: s.hero, command }]);
      s.prev = s.curr;
      s.curr = s.sim.view;
      const events = s.sim.drainEvents();
      for (const e of events) {
        // A teleport that turned the local hero: adopt the yaw, or the next command would turn it back.
        if (e.type === 'movement' && e.hero === s.hero && e.yaw !== undefined) input.setLook({ ...input.look, yaw: e.yaw });
      }
      vfx.onEvents(events, s.curr);
      ui.onEvents(events, s.curr);
      audio.onEvents(events, s.curr);
    }
    if (screen === 'match' && s.sim.isOver) show('end');
    const f: Frame = { prev: s.prev, curr: s.curr, alpha: running ? step.alpha : 1, dt };
    const pose = camera.update(f, s.heroId, input.look, s.cam);
    renderer.render(f, pose);
    vfx.update(f);
    ui.update(f);
    audio.update(f, pose);
    if (++frames === READY_FRAMES) window.__perch = { ready: true, scene: req.scene };
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
