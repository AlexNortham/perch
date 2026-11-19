/**
 * Client module contracts. Owner: Technical Architect. src/client/app wires these modules; each module's owner
 * implements its interface in its own folder (see docs/INTERFACES.md, "Client"). Public shared modules are app/bindings, palette, render-host, drawn and loop; sim/core helpers, sim/heroes/registry and sim/world/map supply read-only definitions. The app delivers the sim view and event stream.
 */
import type { Object3D } from 'three';
import type {
  BotDifficulty,
  EntityView,
  HeroId,
  ItemDef,
  ItemId,
  Ping,
  MapData,
  MatchTelemetry,
  PlayerCommand,
  PlayerTeam,
  SimEvent,
  SimView,
  Vec3,
} from '../../sim/core/contracts';

/** Graphics presets. */
export type Quality = 'low' | 'medium' | 'high';

/** Named camera poses for repeatable screenshots (`?cam=`). 'player' is the normal third-person camera. */
export const CAMERA_PRESETS = ['player', 'overview', 'top'] as const;
export type CameraPreset = (typeof CAMERA_PRESETS)[number];

/** Look angles (radians), as in PlayerCommand. */
export interface Look {
  yaw: number;
  pitch: number;
}

/** One rendered frame: two sim snapshots and how far real time has got between them. */
export interface Frame {
  readonly prev: SimView;
  readonly curr: SimView;
  /** 0..1 blend from prev to curr. */
  readonly alpha: number;
  /** Wall-clock seconds since the previous frame (animation, VFX, audio only; never fed to the sim). */
  readonly dt: number;
}

export interface CameraPose {
  readonly position: Vec3;
  /** Point looked at. */
  readonly target: Vec3;
  /** Horizontal field of view (degrees). */
  readonly fovDeg: number;
}

/** Key and mouse bindings: action → KeyboardEvent.code, or 'Mouse0'..'Mouse4' for buttons. */
export type BindAction =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'jump'
  | 'crouch'
  | 'dash'
  | 'fire'
  | 'aim'
  | 'reload'
  | 'melee'
  | 'parry'
  | 'ability1'
  | 'ability2'
  | 'ability3'
  | 'ability4'
  | 'upgradeModifier'
  | 'item1'
  | 'item2'
  | 'item3'
  | 'item4'
  /** Retired (D-EP-039, D-ARCH-022): listed in RETIRED_BIND_ACTIONS (app/bindings), deleted in the W5.5 round. */
  | 'interact'
  | 'ping'
  | 'shoulderSwap'
  | 'shop'
  | 'scoreboard'
  | 'bigMap'
  | 'pause';
export type Bindings = Readonly<Record<BindAction, string>>;

/** Everything the player can change in Settings. Stored by src/client/app/settings.ts. */
export interface Settings {
  /** Mouse sensitivity (GDD §4.7): 1.0 = 0.06° per count, range 0.1–5.0. */
  readonly sensitivity: number;
  /** Multiplier while aiming (RMB). */
  readonly aimSensitivity: number;
  readonly invertY: boolean;
  /** Hold (false) or toggle (true) crouch. */
  readonly crouchToggle: boolean;
  /** Horizontal field of view (degrees), 75–110 (GDD §4.3); the renderer converts it for the aspect ratio. */
  readonly fovDeg: number;
  readonly bindings: Bindings;
  /** 0..1 each. */
  readonly volume: { readonly master: number; readonly sfx: number; readonly music: number };
  /** Silences all sound without losing the volume levels (Audio honours it). Default false. */
  readonly mute?: boolean;
  readonly quality: Quality;
  /** Show floating damage/heal amounts. Defaults on for existing saves. */
  readonly damageNumbers?: boolean;
}

/** Keys the UI handles rather than the sim. */
export type UiAction = 'pause' | 'shop' | 'scoreboard' | 'bigMap' | 'pingWheel' | 'upgrades';

/** Each UI action produces one ordinary command on the next available tick. */
export type HudIntent = { buy: ItemId } | { sell: ItemId } | { upgrade: number } | { ping: Ping };

/**
 * src/client/input: `createInput(target, settings, onUiAction)`. Pointer lock on `target`; `onUiAction` reports the
 * pause, shop, scoreboard and big-map keys (down and up).
 */
export interface InputController {
  /** Latest look angles, updated on every mouse move (the camera reads them each frame). */
  readonly look: Look;
  /** Set the look (match start, respawn). */
  setLook(look: Look): void;
  /** Effective zoom scale used for aimed mouse look. */
  setAimZoom?(scale: number): void;
  /** Build this tick's command for the local hero and clear the presses gathered since the last sample. */
  sample(): PlayerCommand;
  /** Off while paused or in menus: no pointer lock, sample() returns no input. */
  setEnabled(enabled: boolean): void;
  setSettings(settings: Settings): void;
  dispose(): void;
}

/** src/client/camera: `createCamera(settings)`. */
export interface CameraRig {
  /**
   * The pose for this frame. 'player' follows `hero` with the shared aim model (src/sim/core/aim.ts) and the live
   * look, then pulls in against walls (visual only).
   */
  update(frame: Frame, hero: HeroId | null, look: Look, preset: CameraPreset): CameraPose;
  setSettings(settings: Settings): void;
}

/** src/client/render: `createRenderer(container, map, quality)`. */
export interface Renderer {
  readonly canvas: HTMLCanvasElement;
  /** Draw a frame (interpolating entities by id between frame.prev and frame.curr). */
  render(frame: Frame, camera: CameraPose): void;
  /** Swap the map (blockout) when a new scene starts. */
  setMap(map: MapData): void;
  setQuality(quality: Quality): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

/**
 * src/client/render/models: `createModelKit()`. Procedural low-poly models with code-driven rigs; hero models
 * match their BodyPlan (src/sim/data/heroes) so the head hitbox and muzzle are where they look.
 */
export interface ModelKit {
  /** A new model for an entity: heroes by heroId, units, structures, pickups and areas, in team colours. */
  create(entity: EntityView): Object3D;
  /** Pose and animate it for this frame (from the entity's flags and interpolated transform). */
  pose(model: Object3D, entity: EntityView, frame: Frame): void;
}

/** src/client/vfx: `createVfx(renderer)`. */
export interface Vfx {
  reset?(): void;
  /** This step's events (tracers, impacts, hit flashes, ability effects). */
  onEvents(events: readonly SimEvent[], view: SimView): void;
  update(frame: Frame): void;
  dispose(): void;
}

/** src/client/audio: `createAudio(settings)`. WebAudio starts on the first user gesture (`resume`). */
export interface AudioOut {
  onEvents(events: readonly SimEvent[], view: SimView): void;
  /** Clear the old match voices, loops and music on entering a new scene. */
  reset?(): void;
  update(frame: Frame, listener: CameraPose): void;
  resume(): void;
  setSettings(settings: Settings): void;
  dispose(): void;
  /** The app shows a screen (menu music, hero-select state). Called on every screen change. */
  onScreen?(screen: Screen): void;
  /** Hero select: the player focused or picked this hero's card (its call). Routed from AppActions.previewHero. */
  previewHero?(hero: HeroId): void;
}

/** The screens the app state machine shows. 'pause' overlays the match. */
export type Screen = 'menu' | 'heroSelect' | 'match' | 'pause' | 'end';

/**
 * Match setup (GDD §12.2): chosen on the menu's Play path, then the hero on hero select. app/router.ts
 * `matchConfig` turns it into the sim config: 'main', fledgling waves on all three lanes, the human with `hero`.
 * Hero select offers only heroes whose module is `implemented` (src/sim/heroes/registry.ts HEROES).
 */
export interface MatchSetup {
  readonly hero: HeroId;
  /** The practice match uses 'dawn'. */
  readonly team: PlayerTeam;
  readonly difficulty: BotDifficulty | 'mixed';
  readonly seed: number;
  /** Bot heroes to add, 0–11. Default 0: the practice match (Stage 2). Bot AI arrives in wave 5. */
  readonly bots?: number;
}

/** What the UI may ask the app to do. */
export interface AppActions {
  /** menu → heroSelect */
  play(mode?: 'siege' | 'practice'): void;
  submit(intent: HudIntent): void;
  /** For a pointer-driven match overlay. The sim keeps stepping. */
  capturePointer(release: boolean): void;
  /** Project a world point to overlay CSS pixels, null behind the camera. */
  project(point: Vec3): { x: number; y: number } | null;
  /** World point or entity under the actual crosshair. */
  crosshairPing(): Ping | null;
  /** heroSelect → match */
  startMatch(setup: MatchSetup): void;
  /** heroSelect → menu, end → menu, pause → menu (quit the match) */
  toMenu(): void;
  /** pause → match */
  resume(): void;
  /** The human concedes (allowed from 15:00; the sim ends the match). */
  concede(): void;
  /** Persist new settings and apply them everywhere. */
  saveSettings(settings: Settings): void;
  /** Hero select: a card was focused or picked; audio plays that hero's call. */
  previewHero?(hero: HeroId): void;
}

/** What a screen may show. */
export interface ScreenContext {
  readonly view: SimView;
  readonly settings: Settings;
  /** The match seed (hero select, end screen). */
  readonly seed: number;
  /** Set on the end screen: the match summary, scoreboard, graphs and item timelines (GDD §12.11). */
  readonly telemetry: MatchTelemetry | null;
  readonly catalogue: readonly ItemDef[];
  readonly mode: 'siege' | 'practice';
}

/** src/client/ui: `createUi(root, actions)`. DOM/CSS overlay above the canvas. */
export interface Ui {
  show(screen: Screen, context: ScreenContext): void;
  onEvents(events: readonly SimEvent[], view: SimView): void;
  /** Per frame (HUD, minimap, damage numbers). */
  update(frame: Frame): void;
  /** Shop, scoreboard and big-map keys from input. */
  onUiAction(action: Exclude<UiAction, 'pause'>, down: boolean): void;
  dispose(): void;
}
