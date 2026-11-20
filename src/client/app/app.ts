import { aimRay, pivotHeight } from '../../sim/core/aim';
import { ViewFlag } from '../../sim/core/contracts';
import type { EntityId, HeroId, Ping, PlayerCommand, PlayerTeam, Sim, SimConfig, SimView, SightLine, Vec3, EventOf, WeaponState } from '../../sim/core/contracts';
import { siegeAgent } from '../../sim/ai/siege-proof.testkit';
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
import type { AppActions, CameraPose, CameraPreset, Frame, HudIntent, Renderer, Screen, Settings, UiAction, Vfx } from './contracts';
import { createFixedStep, entityById } from './loop';
import { matchConfig, practiceConfig, sceneConfig } from './router';
import type { SceneName, SceneRequest } from './router';
import { loadSettings, saveSettings } from './settings';
import { deferWork, runDeferred } from './stages';
import type { LoadStage } from './stages';
import { projectPoint, targetPing } from './targeting';

declare global {
  interface Window {
    /**
     * `stage` (D-ARCH-031): 'boot', then 'menu' once the first screen has drawn READY_FRAMES frames and answers input,
     * then 'world' once the deferred work (stages.ts) is done and the full scene has drawn READY_FRAMES frames. `ready`
     * is true from 'world'; the screenshot harness waits on it. `hero` is a read-only test hook for e2e: the local
     * hero's position and how many shots it has fired (null with no hero). `state` is the read-only match state
     * (D-ARCH-020): the screen, the clock, the result and every structure's health.
     */
    __perch?: { ready: boolean; stage: LoadStage; scene: SceneName; hero: { pos: Vec3; tick: number; flags: number; shotsFired: number; meleePose: NonNullable<WeaponState['meleePose']> | null; lastMelee: EventOf<'melee'> | null; lastParry: EventOf<'parry'> | null } | null; state: PerchState };
  }
}

/** A copy of the match state for e2e assertions; `hash` is `sim.hash()`, computed when read. */
export interface PerchState {
  readonly screen: Screen;
  readonly tick: number;
  readonly seconds: number;
  readonly over: boolean;
  readonly winner: PlayerTeam | null;
  readonly hash: string;
  readonly structures: readonly { id: EntityId; team: string; type: string; lane: string | null; phase: number; hp: number; maxHp: number }[];
}

const READY_FRAMES = 3;
/** The page behind the first screen until the renderer's canvas covers it: the sky's horizon haze. */
const LOADING_SKY = 'linear-gradient(#8fb3c9, #d9c7a1)';
const MS_PER_SECOND = 1000;
/** Wall-clock time per frame the replay spends stepping the sim (about 20 frames a second while it fast-forwards). */
const REPLAY_FRAME_MS = 45;
/** The longest the sim fast-forward runs before it lets the page breathe. */
const FAST_FORWARD_SLICE_MS = 30;

/** One running sim and the two newest views the renderer interpolates between. */
interface Session {
  readonly sim: Sim;
  readonly seed: number;
  readonly hero: EntityId | null;
  readonly heroId: HeroId | null;
  readonly cam: CameraPreset;
  /** `?scene=replay`: the siege-proof agent writes the local hero's commands instead of input (D-ARCH-020). */
  readonly drive: (() => PlayerCommand) | null;
  prev: SimView;
  curr: SimView;
}

/**
 * The app: boots the modules, runs the state machine (menu → heroSelect → match ⇄ pause → end → menu) and the
 * fixed-step loop (input → command → sim.step → drained events → vfx, ui, audio → render).
 *
 * Start-up is staged (D-ARCH-031): the sim, UI, input and audio come up first and the first screen draws over the
 * page background; the renderer (scenery, models, portraits) is the first deferred job, so the menu shows before the
 * world is generated. Resolves at 'world' and rejects if a deferred job fails, so main.ts reports either.
 */
export async function startApp(root: HTMLElement, req: SceneRequest): Promise<void> {
  performance.mark('perch:boot');
  let settings: Settings = loadSettings();
  let quality = req.quality ?? settings.quality;
  const stage = document.createElement('div');
  stage.style.cssText = `position:absolute;inset:0;background:${LOADING_SKY}`;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  root.append(stage, overlay);

  const firstConfig = sceneConfig(req);
  let renderer: Renderer | null = null;
  let vfx: Vfx | null = null;
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
  /** Sessions being created or fast-forwarded. While any is, frames draw nothing so the sim gets the main thread. */
  let loading = 0;
  const intents: HudIntent[] = [];
  /** Input drives the local hero: there is one and no replay agent drives it. */
  const playable = (): boolean => session.hero !== null && !session.drive;
  /** Set by the pause menu's Concede; sent with the next command. */
  let concedeNext = false;
  /** Hero select was opened by the Practice Hub's Swap bird (D-EP-040). */
  let swapping = false;

  const actions: AppActions = {
    play: (next = 'siege') => { mode = next; audio.resume(); show('heroSelect'); },
    submit: (intent) => { if (screen === 'match') intents.push(intent); },
    capturePointer: (release) => {
      if (screen !== 'match') return;
      pointerReleased = release;
      if (!release) openPanel = null;
      input.setEnabled(!release && playable());
    },
    project: (point) => pose && projectPoint(point, pose, root.clientWidth, root.clientHeight),
    crosshairPing: () => resolvePing(),
    swapBird: () => {
      if (mode !== 'practice' || (screen !== 'match' && screen !== 'pause')) return;
      show('heroSelect', true);
    },
    startMatch: (setup) => {
      audio.resume();
      if (swapping) {
        void swapHero(setup.hero);
        return;
      }
      void switchSession(mode === 'practice' ? practiceConfig(setup.seed, setup.hero) : matchConfig(setup), 'player', 'match', req.t);
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
      quality = next.quality;
      renderer?.setQuality(next.quality);
    },
    previewHero: (hero) => audio.previewHero?.(hero),
  };
  const ui = createUi(overlay, actions);
  const onUiAction = (action: UiAction, down: boolean): void => {
    if (action !== 'pause') {
      if (screen !== 'match') return;
      if (action === 'shop' || action === 'pingWheel') {
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
  // Suppressing gameplay leaves the cursor available for cards. Keep the shop's own bound key active.
  function panelKey(code: string, down: boolean, event: Event): void {
    if (openPanel === 'shop' && down && code === settings.bindings.shop) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closePanel();
      return;
    }
  }
  document.addEventListener('keydown', (e) => { if (!e.repeat) panelKey(e.code, true, e); }, true);
  document.addEventListener('keyup', (e) => panelKey(e.code, false, e), true);
  document.addEventListener('mousedown', (e) => panelKey('Mouse' + e.button, true, e), true);
  document.addEventListener('mouseup', (e) => panelKey('Mouse' + e.button, false, e), true);
  session = await startSession(firstConfig, req.cam, req.t, req.scene === 'replay');
  performance.mark('perch:sim');
  // ponytail: the whole renderer is one deferred job until Rendering and the Environment Artist queue their own
  // generation (deferWork); then createRenderer is cheap and moves back here, so the menu gets its 3D backdrop at once.
  deferWork('renderer', () => {
    renderer = createRenderer(stage, loadMap(session.curr.map), quality);
    vfx = createVfx(renderer);
    resize();
  });

  function show(next: Screen, swap = false): void {
    swapping = swap;
    openPanel = null;
    pointerReleased = false;
    screen = next;
    input.setEnabled(next === 'match' && playable());
    audio.onScreen?.(next);
    if (next === 'match') audio.resume();
    else if (next !== 'pause') input.exitFullscreen();
    const telemetry = next === 'end' ? session.sim.telemetry() : null;
    ui.show(next, { view: session.curr, settings, seed: session.seed, telemetry, catalogue: session.sim.itemCatalogue, mode, swap });
  }

  async function switchSession(config: SimConfig, cam: CameraPreset, next: Screen, fastForwardS = 0): Promise<void> {
    const id = ++sessionRequest;
    const fresh = await startSession(config, cam, fastForwardS);
    if (id !== sessionRequest) return;
    session = fresh;
    activateSession();
    show(next);
  }

  /** D-EP-040: a fresh practice session for the new bird (32 AP, dummies reset), put where the player stood. */
  async function swapHero(hero: HeroId): Promise<void> {
    const old = session.hero === null ? undefined : entityById(session.curr, session.hero);
    const look = { ...input.look };
    const id = ++sessionRequest;
    const start = old && { pos: { ...old.pos }, yaw: look.yaw };
    const fresh = await startSession(practiceConfig(session.seed, hero, start), 'player', 0);
    if (id !== sessionRequest) return;
    session = fresh;
    activateSession();
    input.setLook(look);
    show('match');
  }

  function activateSession(): void {
    renderer?.setMap(loadMap(session.curr.map));
    step.reset();
    intents.length = 0;
    shotsFired = 0;
    lastMelee = lastParry = null;
    pose = null;
    sight = undefined;
    concedeNext = false;
    vfx?.reset?.();
    audio.reset?.();
    const me = session.hero === null ? undefined : entityById(session.curr, session.hero);
    if (me) input.setLook({ yaw: me.yaw, pitch: me.pitch });
    const zoom = session.curr.heroes.find((h) => h.id === session.hero)?.aimZoom;
    if (zoom !== undefined) input.setAimZoom?.(zoom);
  }

  async function startSession(config: SimConfig, cam: CameraPreset, fastForwardS: number, replay = false): Promise<Session> {
    loading++;
    try {
      const sim = await createSim(config);
      const hero = sim.view.localHero;
      const drive = replay && hero !== null ? siegeAgent(sim, hero) : null;
      // A long fast-forward yields to the browser every slice, so the page keeps answering clicks while it runs.
      let sliceStart = performance.now();
      for (let i = 0, n = Math.round(fastForwardS * TICK_RATE); i < n && !sim.isOver; i++) {
        sim.step(drive && hero !== null ? [{ hero, command: drive() }] : undefined);
        if (performance.now() - sliceStart > FAST_FORWARD_SLICE_MS) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          sliceStart = performance.now();
        }
      }
      sim.drainEvents();
      const heroId = sim.view.heroes.find((h) => h.id === hero)?.heroId ?? null;
      return { sim, seed: config.seed, hero, heroId, cam, drive, prev: sim.view, curr: sim.view };
    } finally {
      loading--;
    }
  }

  function resize(): void {
    renderer?.resize(root.clientWidth, root.clientHeight);
  }
  window.addEventListener('resize', resize);
  activateSession();
  show(req.scene === 'menu' ? 'menu' : 'match');

  let frames = 0;
  let loadStage: LoadStage = 'boot';
  /** The frame count when the deferred queue emptied, or null while it runs. */
  let deferredDoneAt: number | null = null;
  let failed: (err: unknown) => void = () => {};
  let worldReached: () => void = () => {};
  const world = new Promise<void>((resolve, reject) => {
    worldReached = resolve;
    failed = reject;
  });
  /** Called once per frame after drawing: moves the stage on and starts the deferred work at 'menu'. */
  const advanceStage = (): void => {
    if (loadStage === 'boot' && frames >= READY_FRAMES) {
      loadStage = 'menu';
      performance.mark('perch:menu');
      runDeferred().then(() => (deferredDoneAt = frames), failed);
    } else if (loadStage === 'menu' && deferredDoneAt !== null && frames - deferredDoneAt >= READY_FRAMES) {
      loadStage = 'world';
      performance.mark('perch:world');
      worldReached();
    }
  };
  window.__perch = {
    scene: req.scene,
    get stage() {
      return loadStage;
    },
    get ready() {
      return loadStage === 'world';
    },
    get hero() {
      const local = session.hero === null ? undefined : entityById(session.curr, session.hero);
      return local ? { pos: local.pos, tick: session.curr.tick, flags: local.flags, shotsFired, meleePose: local.meleePose ?? null, lastMelee, lastParry } : null;
    },
    get state(): PerchState {
      const { sim, curr: v } = session;
      return {
        screen, tick: v.tick, seconds: v.seconds, over: v.over, winner: v.winner,
        get hash() { return sim.hash(); },
        structures: v.entities.filter((e) => e.structure).map((e) => ({
          id: e.id, team: e.team, type: e.type, lane: e.structure?.lane ?? null, phase: e.structure?.phase ?? 1, hp: e.hp, maxHp: e.maxHp,
        })),
      };
    },
  };
  let last = performance.now();
  const frame = (now: number): void => {
    const dt = (now - last) / MS_PER_SECOND;
    last = now;
    if (loading > 0) {
      requestAnimationFrame(frame);
      return;
    }
    const s = session;
    const running = (screen === 'match' || screen === 'menu') && !s.sim.isOver;
    // A replay fast-forwards: as many ticks as fit in the frame budget, each with the agent's command.
    const steps = !running ? 0 : s.drive ? Infinity : step.advance(dt);
    const budgetEnd = performance.now() + REPLAY_FRAME_MS;
    for (let i = 0; i < steps && !s.sim.isOver && (!s.drive || performance.now() < budgetEnd); i++) {
      const command = s.drive ? { ...s.drive(), concede: concedeNext } : { ...input.sample(), ...(sight && { sight }), ...intents.shift(), concede: concedeNext };
      concedeNext = false;
      s.sim.step(s.hero === null ? [] : [{ hero: s.hero, command }]);
      if (s.drive) input.setLook({ yaw: command.yaw, pitch: command.pitch });
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
      vfx?.onEvents(events, s.curr);
      ui.onEvents(events, s.curr);
      audio.onEvents(events, s.curr);
    }
    if (screen === 'match' && s.sim.isOver) show('end');
    const f: Frame = { prev: s.prev, curr: s.curr, alpha: running && !s.drive ? step.alpha : 1, dt };
    pose = camera.update(f, s.heroId, input.look, s.cam);
    if (s.cam === 'player' && screen === 'match') {
      const dx = pose.target.x - pose.position.x, dy = pose.target.y - pose.position.y, dz = pose.target.z - pose.position.z;
      const length = Math.hypot(dx, dy, dz);
      sight = length ? { origin: { ...pose.position }, dir: { x: dx / length, y: dy / length, z: dz / length } } : undefined;
    } else sight = undefined;
    renderer?.render(f, pose);
    vfx?.update(f);
    ui.update(f);
    audio.update(f, pose);
    frames++;
    advanceStage();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  await world;
}
