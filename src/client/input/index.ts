// TODO(Camera & Input): pointer lock, keyboard and mouse to PlayerCommand (axes, held and pressed buttons, upgrade
// intents with the modifier, item actives, pings from a crosshair raycast), rebinding and sensitivity.
// Until then: the hero stands still looking where it spawned; Escape reports 'pause'.
import { IDLE_COMMAND } from '../../sim/core/contracts';
import type { Bindings, InputController, Look, Settings, UiAction } from '../app/contracts';

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

export function createInput(
  target: HTMLElement,
  settings: Settings,
  onUiAction: (action: UiAction, down: boolean) => void,
): InputController {
  const look: Look = { yaw: 0, pitch: 0 };
  let pauseKey = settings.bindings.pause;
  const onKey = (e: KeyboardEvent): void => {
    if (e.code === pauseKey && !e.repeat) onUiAction('pause', true);
  };
  target.ownerDocument.addEventListener('keydown', onKey);
  return {
    look,
    setLook(l) {
      look.yaw = l.yaw;
      look.pitch = l.pitch;
    },
    sample: () => ({ ...IDLE_COMMAND, yaw: look.yaw, pitch: look.pitch }),
    setEnabled: () => undefined,
    setSettings(s) {
      pauseKey = s.bindings.pause;
    },
    dispose: () => target.ownerDocument.removeEventListener('keydown', onKey),
  };
}
