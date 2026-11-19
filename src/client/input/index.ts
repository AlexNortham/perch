import { Button, IDLE_COMMAND } from '../../sim/core/contracts';
import type { PlayerCommand, Ping } from '../../sim/core/contracts';
import { clampPitch } from '../../sim/core/aim';
import { DEFAULT_AIM_ZOOM } from '../../sim/data/core';
import { DEFAULT_BINDINGS } from '../app/bindings';
import type { BindAction, Bindings, InputController, Look, Settings, UiAction } from '../app/contracts';
import { DEGREES_PER_COUNT, ESC_DEDUPE_MS, LOCKED_CROUCH, PING_TAP_MS, RADIANS_PER_DEGREE, SAFE_CROUCH } from './constants';

export { DEFAULT_BINDINGS, rebind } from '../app/bindings';

/** Chromium's Keyboard Lock API (not in TypeScript's DOM lib; Firefox and Safari lack it). */
interface KeyboardLock {
  lock(codes?: readonly string[]): Promise<void>;
  unlock(): void;
}

function keyboardOf(nav: Navigator | undefined): KeyboardLock | null {
  const k = (nav as { keyboard?: Partial<KeyboardLock> } | undefined)?.keyboard;
  return typeof k?.lock === 'function' && typeof k.unlock === 'function' ? (k as KeyboardLock) : null;
}

/**
 * New-profile bindings for this browser (D-EP-030): crouch on Left Ctrl where fullscreen keyboard lock keeps
 * W + Ctrl from closing the tab, C where it can't (Firefox, Safari).
 */
export function defaultBindings(nav: Navigator | undefined = globalThis.navigator): Bindings {
  return keyboardOf(nav) ? { ...DEFAULT_BINDINGS, crouch: LOCKED_CROUCH } : DEFAULT_BINDINGS;
}
const HISTORY_BACK = 3;
const HISTORY_FORWARD = 4;
const HISTORY_EVENTS = ['mousedown', 'mouseup', 'pointerup', 'auxclick'] as const;
const CROUCH: readonly BindAction[] = ['crouch'];

/** Actions that are a held `Button` bit, and the ability slot each of the four ability actions upgrades. */
const BUTTONS: readonly (readonly [BindAction, number])[] = [
  ['jump', Button.Jump],
  ['crouch', Button.Crouch],
  ['dash', Button.Dash],
  ['fire', Button.Fire],
  ['reload', Button.Reload],
  ['melee', Button.Melee],
  ['parry', Button.Parry],
  ['ability1', Button.Ability1],
  ['ability2', Button.Ability2],
  ['ability3', Button.Ability3],
  ['ability4', Button.Ability4],
  ['item1', Button.Item1],
  ['item2', Button.Item2],
  ['item3', Button.Item3],
  ['item4', Button.Item4],
  ['shoulderSwap', Button.ShoulderSwap],
  ['aim', Button.Aim],
];
const BUTTON_OF = new Map(BUTTONS);
const ABILITY_4_SLOT = 3;
const UPGRADE_SLOT = new Map<BindAction, number>([
  ['ability1', 0],
  ['ability2', 1],
  ['ability3', 2],
  ['ability4', ABILITY_4_SLOT],
]);
const UI_OF = new Map<BindAction, UiAction>([
  ['shop', 'shop'],
  ['bigMap', 'bigMap'],
  ['pause', 'pause'],
]);

/**
 * The controller plus a ping hook. A tap of the ping button calls the resolver (set by src/client/app: it knows
 * the camera and the view) and the next `sample()` carries the result.
 */
export interface Input extends InputController {
  setPingResolver(resolve: (() => Ping | null) | null): void;
  /** Leaving the match: release the keyboard lock and leave the fullscreen that play entered (D-EP-030). */
  exitFullscreen(): void;
}

export function createInput(
  target: HTMLElement,
  settings: Settings,
  onUiAction: (action: UiAction, down: boolean) => void,
): Input {
  const doc = target.ownerDocument;
  const look: Look = { yaw: 0, pitch: 0 };
  let cfg = settings;
  let codeMap = new Map<string, BindAction[]>();
  let enabled = false;

  const down = new Set<BindAction>();
  /** Ability keys pressed with the upgrade modifier: they upgraded, so they must not also count as held. */
  const spent = new Set<BindAction>();
  let pressed = 0;
  let upgrade: number | null = null;
  let ping: Ping | null = null;
  let crouchOn = false;
  let crouchPresses = 0;
  let pingDownAt = 0;
  let pingTimer: ReturnType<typeof setTimeout> | undefined;
  /** The upgrade key is held (D-EP-038): the pointer is free for the HUD; look and mouse buttons wait. */
  let upgradeHold = false;
  let relockOnRelease = false;
  let aimZoom = DEFAULT_AIM_ZOOM;
  const capturedMouse = new Set<number>();
  const capturedAux = new Set<number>();
  let resolvePing: (() => Ping | null) | null = null;
  let lockLostAt = -Infinity;
  const keyboard = keyboardOf(doc.defaultView?.navigator);
  let keysLocked = false;

  const index = (): void => {
    codeMap = new Map();
    for (const [action, code] of Object.entries(cfg.bindings) as [BindAction, string][]) {
      const list = codeMap.get(code);
      if (list) list.push(action);
      else codeMap.set(code, [action]);
    }
  };
  index();

  const locked = (): boolean => doc.pointerLockElement !== null;
  /** A free C keeps crouching while crouch is on a Ctrl key, for when the keyboard lock is unavailable or refused. */
  const actionsOf = (code: string): readonly BindAction[] | undefined =>
    codeMap.get(code) ?? (code === SAFE_CROUCH && cfg.bindings.crouch.startsWith('Control') ? CROUCH : undefined);

  function press(code: string, at: number): void {
    for (const action of actionsOf(code) ?? []) {
      if (action === 'pause') continue;
      if (down.has(action)) continue;
      down.add(action);
      if (action === 'upgradeModifier') beginUpgrade();
      const slot = UPGRADE_SLOT.get(action);
      if (slot !== undefined && down.has('upgradeModifier')) {
        upgrade = slot;
        spent.add(action);
        continue;
      }
      if (action === 'crouch') {
        crouchPresses = Math.min(2, crouchPresses + 1);
        if (cfg.crouchToggle) crouchOn = !crouchOn;
      } else pressed |= BUTTON_OF.get(action) ?? 0;
      if (action === 'ping') {
        pingDownAt = at;
        pingTimer = setTimeout(() => {
          pingTimer = undefined;
          onUiAction('pingWheel', true);
        }, PING_TAP_MS);
      }
      const ui = UI_OF.get(action);
      if (ui) onUiAction(ui, true);
    }
  }

  function release(code: string, at: number): void {
    for (const action of actionsOf(code) ?? []) {
      if (!down.delete(action)) continue;
      spent.delete(action);
      if (action === 'ping' && pingTimer !== undefined) {
        clearTimeout(pingTimer);
        pingTimer = undefined;
        if (at - pingDownAt < PING_TAP_MS) ping = resolvePing?.() ?? null;
        else onUiAction('pingWheel', true);
      }
      if (action === 'upgradeModifier') endUpgrade();
      const ui = UI_OF.get(action);
      if (ui) onUiAction(ui, false);
    }
  }

  /** D-EP-038: free the real cursor while the key is held. Keys keep working; look and mouse buttons wait. */
  function beginUpgrade(): void {
    if (upgradeHold) return;
    upgradeHold = true;
    relockOnRelease = locked();
    if (relockOnRelease) doc.exitPointerLock();
    onUiAction('upgrades', true);
  }

  /** Lock again in the key's own event, so no extra click is needed (Edge and Firefox allow it, see D-UI-001). */
  function endUpgrade(relock = true): void {
    if (!upgradeHold) return;
    upgradeHold = false;
    onUiAction('upgrades', false);
    if (relock && relockOnRelease && enabled) lock();
    relockOnRelease = false;
  }

  function releaseAll(): void {
    clearTimeout(pingTimer);
    pingTimer = undefined;
    endUpgrade(false);
    for (const action of down) {
      const ui = UI_OF.get(action);
      if (ui) onUiAction(ui, false);
    }
    down.clear();
    spent.clear();
    pressed = 0;
    upgrade = null;
    ping = null;
    crouchOn = false;
    crouchPresses = 0;
  }

  const bound = (code: string): boolean => actionsOf(code) !== undefined;

  const onKeyDown = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (codeMap.get(e.code)?.includes('pause')) {
      // Chrome reports Esc-to-unlock as pointerlockchange, and may report the keydown too: count it once.
      if (!e.repeat && Math.abs(e.timeStamp - lockLostAt) >= ESC_DEDUPE_MS) onUiAction('pause', true);
      return;
    }
    if (enabled && e.code === 'Tab') e.preventDefault(); // focus never leaves the game mid-match; Tab is not a binding
    if (!enabled || !bound(e.code)) return;
    e.preventDefault();
    if (!e.repeat) press(e.code, e.timeStamp);
  };
  const onKeyUp = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (!enabled || !bound(e.code)) return;
    e.preventDefault();
    release(e.code, e.timeStamp);
  };
  const onMouseDown = (ev: Event): void => {
    const e = ev as MouseEvent;
    capturedAux.delete(e.button);
    if (!enabled || !locked()) return;
    e.preventDefault();
    capturedMouse.add(e.button);
    press(`Mouse${e.button}`, e.timeStamp);
  };
  const onMouseUp = (ev: Event): void => {
    const e = ev as MouseEvent;
    if (capturedMouse.delete(e.button)) {
      capturedAux.add(e.button);
      e.preventDefault();
    } else if (enabled && locked()) e.preventDefault();
    if (enabled) release(`Mouse${e.button}`, e.timeStamp);
  };
  const onMouseMove = (ev: Event): void => {
    if (!enabled || !locked()) return;
    const e = ev as MouseEvent;
    const k = DEGREES_PER_COUNT * RADIANS_PER_DEGREE * cfg.sensitivity * (down.has('aim') ? cfg.aimSensitivity * aimZoom : 1);
    look.yaw = wrap(look.yaw - e.movementX * k);
    look.pitch = clampPitch(look.pitch - e.movementY * k * (cfg.invertY ? -1 : 1));
  };
  const onClickToLock = (): void => {
    if (enabled && !locked()) lock();
  };
  const onLockChange = (ev: Event): void => {
    if (locked()) return;
    if (!enabled || upgradeHold) return;
    lockLostAt = ev.timeStamp;
    onUiAction('pause', true);
  };
  const onContextMenu = (ev: Event): void => {
    const e = ev as MouseEvent;
    if (enabled || capturedMouse.has(e.button) || capturedAux.has(e.button)) e.preventDefault();
  };
  const onAuxClick = (ev: Event): void => {
    const e = ev as MouseEvent;
    if (capturedAux.delete(e.button) || (enabled && locked())) e.preventDefault();
  };
  const onBlur = (): void => {
    capturedMouse.clear();
    capturedAux.clear();
    releaseAll();
  };

  /** Mouse 4 and 5 are browser Back and Forward: this page never wants them to navigate, bound or not, in play or in Options. */
  const onHistoryButton = (ev: Event): void => {
    const b = (ev as MouseEvent).button;
    if (b === HISTORY_BACK || b === HISTORY_FORWARD) ev.preventDefault();
  };

  function lock(): void {
    try {
      // Newer browsers return a promise that rejects without a user gesture; that just leaves the click to do it.
      void Promise.resolve(target.requestPointerLock()).catch(() => undefined);
    } catch {
      /* no gesture or no pointer lock here (tests): keys still work, mouse look waits for a lock */
    }
    void lockKeys();
  }

  /**
   * D-EP-030: in the same gesture, go fullscreen and lock every key, so W + Ctrl (crouch) and other browser shortcuts
   * reach the game. Esc still arrives once; holding it leaves fullscreen (a browser rule).
   */
  async function lockKeys(): Promise<void> {
    if (!keyboard || keysLocked) return;
    try {
      if (!doc.fullscreenElement) await doc.documentElement.requestFullscreen({ navigationUI: 'hide' });
      if (!enabled) return;
      await keyboard.lock();
      if (enabled) keysLocked = true;
      else keyboard.unlock();
    } catch {
      /* fullscreen or the lock refused (no gesture, an iframe, the player): play on windowed with today's keys */
    }
  }

  function unlockKeys(): void {
    if (!keysLocked) return;
    keysLocked = false;
    keyboard?.unlock();
  }

  const onFullscreenChange = (): void => {
    if (!doc.fullscreenElement) unlockKeys();
  };

  for (const t of HISTORY_EVENTS) doc.addEventListener(t, onHistoryButton, true);
  doc.addEventListener('keydown', onKeyDown);
  doc.addEventListener('keyup', onKeyUp);
  doc.addEventListener('mousedown', onMouseDown);
  doc.addEventListener('mouseup', onMouseUp);
  doc.addEventListener('mousemove', onMouseMove);
  doc.addEventListener('pointerlockchange', onLockChange);
  doc.addEventListener('contextmenu', onContextMenu);
  doc.addEventListener('auxclick', onAuxClick);
  doc.addEventListener('fullscreenchange', onFullscreenChange);
  target.addEventListener('mousedown', onClickToLock);
  doc.defaultView?.addEventListener('blur', onBlur);

  return {
    look,
    setLook(l) {
      look.yaw = l.yaw;
      look.pitch = l.pitch;
    },
    sample(): PlayerCommand {
      if (!enabled) return { ...IDLE_COMMAND, yaw: look.yaw, pitch: look.pitch };
      let held = 0;
      for (const [action, bit] of BUTTONS) {
        const on = action === 'crouch' && cfg.crouchToggle ? crouchOn : down.has(action) && !spent.has(action);
        if (on) held |= bit;
      }
      if (crouchPresses > 0) {
        pressed |= Button.Crouch;
        crouchPresses--;
      }
      const command: PlayerCommand = {
        right: (down.has('right') ? 1 : 0) - (down.has('left') ? 1 : 0),
        forward: (down.has('forward') ? 1 : 0) - (down.has('back') ? 1 : 0),
        yaw: look.yaw,
        pitch: look.pitch,
        held,
        pressed,
        upgrade,
        buy: null,
        sell: null,
        ping,
        concede: false,
      };
      pressed = 0;
      upgrade = null;
      ping = null;
      return command;
    },
    setEnabled(next) {
      if (next === enabled) return;
      enabled = next;
      releaseAll();
      if (next) lock();
      else {
        // Pause, a panel or a menu: give the keys back but stay fullscreen; leaving the match calls exitFullscreen.
        unlockKeys();
        if (locked()) doc.exitPointerLock();
      }
    },
    exitFullscreen() {
      unlockKeys();
      if (keyboard && doc.fullscreenElement) void doc.exitFullscreen().catch(() => undefined);
    },
    setSettings(s) {
      cfg = s;
      index();
    },
    setAimZoom(scale) {
      aimZoom = scale;
    },
    setPingResolver(resolve) {
      resolvePing = resolve;
    },
    dispose() {
      for (const t of HISTORY_EVENTS) doc.removeEventListener(t, onHistoryButton, true);
      doc.removeEventListener('keydown', onKeyDown);
      doc.removeEventListener('keyup', onKeyUp);
      doc.removeEventListener('mousedown', onMouseDown);
      doc.removeEventListener('mouseup', onMouseUp);
      doc.removeEventListener('mousemove', onMouseMove);
      doc.removeEventListener('pointerlockchange', onLockChange);
      doc.removeEventListener('contextmenu', onContextMenu);
      doc.removeEventListener('auxclick', onAuxClick);
      doc.removeEventListener('fullscreenchange', onFullscreenChange);
      target.removeEventListener('mousedown', onClickToLock);
      doc.defaultView?.removeEventListener('blur', onBlur);
      clearTimeout(pingTimer);
    },
  };
}

/** Wrap an angle to (-π, π]. */
function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
