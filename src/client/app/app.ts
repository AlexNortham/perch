import { aimRay, pivotHeight } from '../../sim/core/aim';
import { ViewFlag } from '../../sim/core/contracts';
import type { EntityId, HeroId, Ping, Sim, SimConfig, SimView, SightLine, Vec3, EventOf, WeaponState } from '../../sim/core/contracts';
import { CAMERA, TICK_RATE } from '../../sim/data/core';
import { HEROES } from '../../sim/heroes/registry';
import { createSim } from '../../sim/index';
import { loadMap } from '../../sim/world/map';
import { createAudio } from '../audio';
import { createCamera, rayWorldPoint } from '../camera';
import { createInput } from '../input';
import { createRenderer } from '../render';
import { createUi } from '../ui';
import { createVfx } from '../vfx';
import type { AppActions, CameraPose, CameraPreset, Frame, HudIntent, Screen, Settings, UiAction } from './contracts';
import { createFixedStep, entityById } from './loop';
import { matchConfig, practiceConfig, sceneConfig } from './router';
import type { SceneName, SceneRequest } from './router';
import { loadSettings, saveSettings } from './settings';
import { projectPoint, targetPing } from './targeting';

declare global {
  interface Window {
    /**
     * Set once the requested scene has rendered READY_FRAMES frames; the screenshot harness waits on it. `hero` is a
     * read-only test hook for e2e: the local hero's position and how many shots it has fired (null with no hero).
     */
    __perch?: { ready: boolean; scene: SceneName; hero: { pos: Vec3; tick: number; flags: number; shotsFired: number; meleePose: NonNullable<WeaponState['meleePose']> | null; lastMelee: EventOf<'melee'> | null; lastParry: EventOf<'parry'> | null } | null };
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
  let shotsFired = 0;
  let lastMelee: EventOf<'melee'> | null = null;
  let lastParry: EventOf<'parry'> | null = null;
  let mode: 'siege' | 'practice' = req.scene === 'practice' ? 'practice' : 'siege';
  let pose: CameraPose | null = null;
  let sight: SightLine | undefined;
  let pointerReleased = false;
  let openPanel: UiAction | null = null;
  let sessionRequest = 0;
  const intents: HudIntent[] = [];
  /** Set by the pause menu's Concede; sent with the next command. */
  let concedeNext = false;

  const actions: AppActions = {
    play: (next = 'siege') => { mode = next; audio.resume(); show('heroSelect'); },
    submit: (intent) => { if (screen === 'match') intents.push(intent); },
    capturePointer: (release) => {
      if (screen !== 'match') return;
      pointerReleased = release;
      if (!release) openPanel = null;
      input.setEnabled(!release && session.hero !== null);
    },
    project: (point) => pose && projectPoint(point, pose, root.clientWidth, root.clientHeight),
    crosshairPing: () => resolvePing(),
    startMatch: (setup) => {
      audio.resume();
      void switchSession(mode === 'practice' ? practiceConfig(setup.seed, setup.hero) : matchConfig(setup), 'player', 'match');
    },
    toMenu: () => {
      mode = 'siege';
      void switchSession(sceneConfig({ ...req, scene: 'menu' }), 'overview', 'menu');
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
    if (action !== 'pause') {
      if (screen !== 'match') return;
      if (action === 'shop' || action === 'upgrades' || action === 'pingWheel') {
        if (down && !openPanel) {
          openPanel = action;
          actions.capturePointer(true);
          ui.onUiAction(action, true);
        }
        return;
      }
      ui.onUiAction(action, down);
    } else if (down && pointerReleased) closePanel();
    else if (down && screen === 'match') show('pause');
    else if (down && screen === 'pause') show('match');
  };
  const input = createInput(stage, settings, onUiAction);
  // A tap of the ping button pings the world point under the crosshair (GDD §12.5: the ground tap is "go here").
  const resolvePing = (): Ping | null => {
    const s = session;
    const view = s.curr;
    const hero = view.heroes.find((h) => h.id === s.hero);
    const me = s.hero === null ? undefined : entityById(view, s.hero);
    if (!hero || !me) return null;
    const body = HEROES[hero.heroId].def.body;
    const crouch = !!(me.flags & (ViewFlag.Crouching | ViewFlag.Sliding));
    const ray = sight ? { ...sight, start: Math.max(0, (me.pos.x - sight.origin.x) * sight.dir.x +
      (me.pos.y + pivotHeight(body, crouch) - sight.origin.y) * sight.dir.y + (me.pos.z - sight.origin.z) * sight.dir.z + CAMERA.aimStartPad) }
      : aimRay(me.pos, input.look.yaw, input.look.pitch, hero.shoulder, body, crouch);
    const range = HEROES[hero.heroId].def.weapon.aimRange ?? CAMERA.aimRange;
    const pos = rayWorldPoint(loadMap(view.map), ray.origin, ray.dir, range, ray.start);
    return targetPing(view, hero.team, ray.origin, ray.dir, ray.start, range, pos);
  };
  input.setPingResolver(resolvePing);

  function closePanel(): void {
    const panel = openPanel;
    actions.capturePointer(false);
    if (panel && panel !== 'pause') ui.onUiAction(panel, false);
  }
  // Suppressing gameplay leaves the cursor available for cards. Keep the panel's own bound keys active.
  let inspecting = false, inspectionChord = false;
  function panelKey(code: string, down: boolean, event: Event): void {
    if (openPanel === 'shop' && down && code === settings.bindings.shop) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closePanel();
      return;
    }
    if (openPanel !== 'upgrades') return;
    if (code === settings.bindings.upgradeModifier) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (down) { inspecting = true; inspectionChord = false; }
      else if (inspecting) {
        inspecting = false;
        if (!inspectionChord) closePanel();
      }
    } else if (down && inspecting) {
      const keys = [settings.bindings.ability1, settings.bindings.ability2, settings.bindings.ability3, settings.bindings.ability4];
      const slot = keys.indexOf(code);
      if (slot >= 0) {
        inspectionChord = true;
        event.preventDefault();
        event.stopImmediatePropagation();
        actions.submit({ upgrade: slot });
      }
    }
  }
  document.addEventListener('keydown', (e) => { if (!e.repeat) panelKey(e.code, true, e); }, true);
  document.addEventListener('keyup', (e) => panelKey(e.code, false, e), true);
  document.addEventListener('mousedown', (e) => panelKey('Mouse' + e.button, true, e), true);
  document.addEventListener('mouseup', (e) => panelKey('Mouse' + e.button, false, e), true);
  session = await startSession(firstConfig, req.cam, req.t);

  function show(next: Screen): void {
    openPanel = null;
    inspecting = false;
    pointerReleased = false;
    screen = next;
    input.setEnabled(next === 'match' && session.hero !== null);
    if (next === 'match') audio.resume();
    const telemetry = next === 'end' ? session.sim.telemetry() : null;
    ui.show(next, { view: session.curr, settings, seed: session.seed, telemetry, catalogue: session.sim.itemCatalogue, mode });
  }

  async function switchSession(config: SimConfig, cam: CameraPreset, next: Screen): Promise<void> {
    const id = ++sessionRequest;
    const fresh = await startSession(config, cam, 0);
    if (id !== sessionRequest) return;
    session = fresh;
    activateSession();
    show(next);
  }

  function activateSession(): void {
    renderer.setMap(loadMap(session.curr.map));
    step.reset();
    intents.length = 0;
    shotsFired = 0;
    lastMelee = lastParry = null;
    pose = null;
    sight = undefined;
    concedeNext = false;
    vfx.reset?.();
    audio.reset?.();
    const me = session.hero === null ? undefined : entityById(session.curr, session.hero);
    if (me) input.setLook({ yaw: me.yaw, pitch: me.pitch });
    const zoom = session.curr.heroes.find((h) => h.id === session.hero)?.aimZoom;
    if (zoom !== undefined) input.setAimZoom?.(zoom);
  }

  async function startSession(config: SimConfig, cam: CameraPreset, fastForwardS: number): Promise<Session> {
    const sim = await createSim(config);
    for (let i = 0, n = Math.round(fastForwardS * TICK_RATE); i < n && !sim.isOver; i++) sim.step();
    sim.drainEvents();
    const hero = sim.view.localHero;
    const heroId = sim.view.heroes.find((h) => h.id === hero)?.heroId ?? null;
    return { sim, seed: config.seed, hero, heroId, cam, prev: sim.view, curr: sim.view };
  }

  const resize = (): void => renderer.resize(root.clientWidth, root.clientHeight);
  window.addEventListener('resize', resize);
  resize();
  activateSession();
  show(req.scene === 'menu' ? 'menu' : 'match');

  let frames = 0;
  window.__perch = {
    scene: req.scene,
    get ready() {
      return frames >= READY_FRAMES;
    },
    get hero() {
      const local = session.hero === null ? undefined : entityById(session.curr, session.hero);
      return local ? { pos: local.pos, tick: session.curr.tick, flags: local.flags, shotsFired, meleePose: local.meleePose ?? null, lastMelee, lastParry } : null;
    },
  };
  let last = performance.now();
  const frame = (now: number): void => {
    const dt = (now - last) / MS_PER_SECOND;
    last = now;
    const s = session;
    const running = (screen === 'match' || screen === 'menu') && !s.sim.isOver;
    const steps = running ? step.advance(dt) : 0;
    for (let i = 0; i < steps && !s.sim.isOver; i++) {
      const command = { ...input.sample(), ...(sight && { sight }), ...intents.shift(), concede: concedeNext };
      concedeNext = false;
      s.sim.step(s.hero === null ? [] : [{ hero: s.hero, command }]);
      s.prev = s.curr;
      s.curr = s.sim.view;
      const events = s.sim.drainEvents();
      for (const e of events) {
        // A teleport that turned the local hero: adopt the yaw, or the next command would turn it back.
        if (e.type === 'movement' && e.hero === s.hero && e.yaw !== undefined) input.setLook({ ...input.look, yaw: e.yaw });
        // A respawn puts the hero back at its spawn facing the way it spawned: the look follows.
        if (e.type === 'hero.respawned' && e.hero === s.hero) {
          const me = entityById(s.curr, e.hero);
          if (me) input.setLook({ yaw: me.yaw, pitch: me.pitch });
        }
        if (e.type === 'melee' && e.attacker === s.hero) lastMelee = e;
        if (e.type === 'parry' && e.hero === s.hero) lastParry = e;
        if (e.type === 'weapon.fired' && e.shooter === s.hero) shotsFired++;
      }
      vfx.onEvents(events, s.curr);
      ui.onEvents(events, s.curr);
      audio.onEvents(events, s.curr);
    }
    if (screen === 'match' && s.sim.isOver) show('end');
    const f: Frame = { prev: s.prev, curr: s.curr, alpha: running ? step.alpha : 1, dt };
    pose = camera.update(f, s.heroId, input.look, s.cam);
    if (s.cam === 'player' && screen === 'match') {
      const dx = pose.target.x - pose.position.x, dy = pose.target.y - pose.position.y, dz = pose.target.z - pose.position.z;
      const length = Math.hypot(dx, dy, dz);
      sight = length ? { origin: { ...pose.position }, dir: { x: dx / length, y: dy / length, z: dz / length } } : undefined;
    } else sight = undefined;
    renderer.render(f, pose);
    vfx.update(f);
    ui.update(f);
    audio.update(f, pose);
    frames++;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
