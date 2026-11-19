import { Button, IDLE_COMMAND } from '../../sim/core/contracts';
import type { PlayerCommand, Ping } from '../../sim/core/contracts';
import { clampPitch } from '../../sim/core/aim';
import type { BindAction, Bindings, InputController, Look, Settings, UiAction } from '../app/contracts';
import { AIM_ZOOM_SCALE, DEGREES_PER_COUNT, ESC_DEDUPE_MS, PING_TAP_MS, RADIANS_PER_DEGREE } from './constants';

/** Default key and mouse bindings (GDD §3.1; KeyboardEvent.code; Mouse0 left, Mouse1 middle, Mouse2 right). */
export const DEFAULT_BINDINGS: Bindings = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  crouch: 'ControlLeft',
  dash: 'ShiftLeft',
  fire: 'Mouse0',
  aim: 'Mouse2',
  reload: 'KeyR',
  melee: 'KeyQ',
  parry: 'KeyF',
  ability1: 'Digit1',
  ability2: 'Digit2',
  ability3: 'Digit3',
  ability4: 'Digit4',
  upgradeModifier: 'AltLeft',
  item1: 'KeyZ',
  item2: 'KeyX',
  item3: 'KeyC',
  item4: 'KeyV',
  interact: 'KeyE',
  ping: 'Mouse1',
  shoulderSwap: 'KeyG',
  shop: 'KeyB',
  scoreboard: 'Tab',
  bigMap: 'KeyM',
  pause: 'Escape',
};

/**
 * Bind `action` to `code`. If another action already uses `code`, the two swap, so bindings never collide and the
 * settings screen needs no conflict handling.
 */
export function rebind(bindings: Bindings, action: BindAction, code: string): Bindings {
  const next: Record<BindAction, string> = { ...bindings };
  for (const other of Object.keys(bindings) as BindAction[]) if (bindings[other] === code) next[other] = bindings[action];
  next[action] = code;
  return next;
}

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
  ['interact', Button.Interact],
];
const BUTTON_OF = new Map(BUTTONS);
const ABILITY_4_SLOT = 3;
const UPGRADE_SLOT =new Map<BindAction, number>([
  ['ability1', 0],
  ['ability2', 1],
  ['ability3', 2],
  ['ability4', ABILITY_4_SLOT],
]);
const UI_OF = new Map<BindAction, UiAction>([
  ['shop', 'shop'],
  ['scoreboard', 'scoreboard'],
  ['bigMap', 'bigMap'],
  ['pause', 'pause'],
]);

/**
 * The controller plus a ping hook. A tap of the ping button calls the resolver (set by src/client/app: it knows
 * the camera and the view) and the next `sample()` carries the result.
 */
export interface Input extends InputController {
  setPingResolver(resolve: (() => Ping | null) | null): void;
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
  let pingDownAt = 0;
  let resolvePing: (() => Ping | null) | null = null;
  let lockLostAt = -Infinity;

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

  function press(code: string, at: number): void {
    for (const action of codeMap.get(code) ?? []) {
      if (action === 'pause') continue;
      if (down.has(action)) continue;
      down.add(action);
      const slot = UPGRADE_SLOT.get(action);
      if (slot !== undefined && down.has('upgradeModifier')) {
        upgrade = slot;
        spent.add(action);
        continue;
      }
      pressed |= BUTTON_OF.get(action) ?? 0;
      if (action === 'crouch' && cfg.crouchToggle) crouchOn = !crouchOn;
      if (action === 'ping') pingDownAt = at;
      const ui = UI_OF.get(action);
      if (ui) onUiAction(ui, true);
    }
  }

  function release(code: string, at: number): void {
    for (const action of codeMap.get(code) ?? []) {
      if (!down.delete(action)) continue;
      spent.delete(action);
      if (action === 'ping' && at - pingDownAt < PING_TAP_MS && resolvePing) ping = resolvePing();
      const ui = UI_OF.get(action);
      if (ui) onUiAction(ui, false);
    }
  }

  function releaseAll(): void {
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
  }

  const bound = (code: string): boolean => codeMap.has(code);

  const onKeyDown = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (codeMap.get(e.code)?.includes('pause')) {
      // Chrome reports Esc-to-unlock as pointerlockchange, and may report the keydown too: count it once.
      if (!e.repeat && Math.abs(e.timeStamp - lockLostAt) >= ESC_DEDUPE_MS) onUiAction('pause', true);
      return;
    }
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
    if (!enabled || !locked()) return;
    e.preventDefault();
    press(`Mouse${e.button}`, e.timeStamp);
  };
  const onMouseUp = (ev: Event): void => {
    const e = ev as MouseEvent;
    if (enabled) release(`Mouse${e.button}`, e.timeStamp);
  };
  const onMouseMove = (ev: Event): void => {
    if (!enabled || !locked()) return;
    const e = ev as MouseEvent;
    const k = DEGREES_PER_COUNT * RADIANS_PER_DEGREE * cfg.sensitivity * (down.has('aim') ? cfg.aimSensitivity * AIM_ZOOM_SCALE : 1);
    look.yaw = wrap(look.yaw - e.movementX * k);
    look.pitch = clampPitch(look.pitch - e.movementY * k * (cfg.invertY ? -1 : 1));
  };
  const onClickToLock = (): void => {
    if (enabled && !locked()) lock();
  };
  const onLockChange = (ev: Event): void => {
    if (locked()) return;
    if (!enabled) return;
    lockLostAt = ev.timeStamp;
    onUiAction('pause', true);
  };
  const onContextMenu = (ev: Event): void => {
    if (enabled) ev.preventDefault();
  };

  function lock(): void {
    try {
      // Newer browsers return a promise that rejects without a user gesture; that just leaves the click to do it.
      void Promise.resolve(target.requestPointerLock()).catch(() => undefined);
    } catch {
      /* no gesture or no pointer lock here (tests): keys still work, mouse look waits for a lock */
    }
  }

  doc.addEventListener('keydown', onKeyDown);
  doc.addEventListener('keyup', onKeyUp);
  doc.addEventListener('mousedown', onMouseDown);
  doc.addEventListener('mouseup', onMouseUp);
  doc.addEventListener('mousemove', onMouseMove);
  doc.addEventListener('pointerlockchange', onLockChange);
  doc.addEventListener('contextmenu', onContextMenu);
  target.addEventListener('mousedown', onClickToLock);
  doc.defaultView?.addEventListener('blur', releaseAll);

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
      else if (locked()) doc.exitPointerLock();
    },
    setSettings(s) {
      cfg = s;
      index();
    },
    setPingResolver(resolve) {
      resolvePing = resolve;
    },
    dispose() {
      doc.removeEventListener('keydown', onKeyDown);
      doc.removeEventListener('keyup', onKeyUp);
      doc.removeEventListener('mousedown', onMouseDown);
      doc.removeEventListener('mouseup', onMouseUp);
      doc.removeEventListener('mousemove', onMouseMove);
      doc.removeEventListener('pointerlockchange', onLockChange);
      doc.removeEventListener('contextmenu', onContextMenu);
      target.removeEventListener('mousedown', onClickToLock);
      doc.defaultView?.removeEventListener('blur', releaseAll);
    },
  };
}

/** Wrap an angle to (-π, π]. */
function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
