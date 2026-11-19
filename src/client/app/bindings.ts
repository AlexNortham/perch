import type { BindAction, Bindings } from './contracts';

/** Default key and mouse bindings (GDD §3.1; KeyboardEvent.code; Mouse0 left, Mouse1 middle, Mouse2 right). */
export const DEFAULT_BINDINGS: Bindings = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  crouch: 'KeyC',
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
  item3: 'KeyN',
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

