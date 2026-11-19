/** Pure key-binding helpers for the Options screen: readable names, capture, swap on conflict, reset. */
import type { BindAction, Bindings } from '../app/contracts';
import { rebind as swapBindings } from '../app/bindings';
import { DIGIT_PREFIX, KEY_PREFIX } from './constants';

/** Player-facing action names, in the order the Controls list shows them. */
export const ACTION_LABELS: Readonly<Record<BindAction, string>> = {
  forward: 'Move forward',
  back: 'Move back',
  left: 'Move left',
  right: 'Move right',
  jump: 'Jump',
  crouch: 'Crouch / slide',
  dash: 'Dash',
  fire: 'Fire',
  aim: 'Aim',
  reload: 'Reload',
  melee: 'Melee (tap light, hold heavy)',
  parry: 'Parry',
  ability1: 'Ability 1',
  ability2: 'Ability 2',
  ability3: 'Ability 3',
  ability4: 'Ability 4 (ultimate)',
  upgradeModifier: 'Upgrade modifier',
  item1: 'Item 1',
  item2: 'Item 2',
  item3: 'Item 3',
  item4: 'Item 4',
  ping: 'Ping',
  shoulderSwap: 'Swap shoulder',
  shop: 'Shop',
  bigMap: 'Big map',
  pause: 'Pause',
};
export const ACTIONS = Object.keys(ACTION_LABELS) as BindAction[];

const MOUSE_NAMES = ['Left Mouse', 'Middle Mouse', 'Right Mouse', 'Mouse 4', 'Mouse 5'];
const NAMED: Readonly<Record<string, string>> = {
  ShiftLeft: 'Left Shift',
  ShiftRight: 'Right Shift',
  ControlLeft: 'Left Ctrl',
  ControlRight: 'Right Ctrl',
  AltLeft: 'Left Alt',
  AltRight: 'Right Alt',
  Escape: 'Esc',
  ArrowUp: 'Up Arrow',
  ArrowDown: 'Down Arrow',
  ArrowLeft: 'Left Arrow',
  ArrowRight: 'Right Arrow',
};

/** A KeyboardEvent.code or 'Mouse0'..'Mouse4' as a readable name ("Left Shift", "Mouse 4"). */
export function keyName(code: string): string {
  const mouse = /^Mouse(\d)$/.exec(code);
  if (mouse) return MOUSE_NAMES[Number(mouse[1])] ?? `Mouse ${Number(mouse[1]) + 1}`;
  const named = NAMED[code];
  if (named) return named;
  if (/^Key[A-Z]$/.test(code)) return code.slice(KEY_PREFIX.length);
  if (code.startsWith(DIGIT_PREFIX)) return code.slice(DIGIT_PREFIX.length);
  return code.replace(/([a-z\d])([A-Z])/g, '$1 $2');
}

export interface RebindResult {
  readonly bindings: Bindings;
  /** The action that held the key and took this action's old key, or null. */
  readonly swapped: BindAction | null;
}

/** Give `action` the key; if another action holds it, that action takes this action's old key (the input module's swap). */
export function rebind(bindings: Bindings, action: BindAction, code: string): RebindResult {
  const next = swapBindings(bindings, action, code);
  return { bindings: next, swapped: ACTIONS.find((a) => a !== action && next[a] !== bindings[a]) ?? null };
}

/** Keys that cannot be bound: Esc cancels, and Tab is kept for the browser (the scoreboard that used it is always on, D-EP-041). */
export const UNBINDABLE: readonly string[] = ['Escape', 'Tab'];

/** A captured key press: Esc or Tab refuse (null), anything else rebinds. */
export function capture(bindings: Bindings, action: BindAction, code: string): RebindResult | null {
  return UNBINDABLE.includes(code) ? null : rebind(bindings, action, code);
}

/** Reset one action to its default key (swapping with whoever holds it now). */
export const resetAction = (bindings: Bindings, action: BindAction, defaults: Bindings): RebindResult =>
  rebind(bindings, action, defaults[action]);

const MODIFIER_CODES: readonly string[] = ['ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight'];
/** Keys that Ctrl/Meta turn into a browser shortcut (close tab, new tab or window, quit, reload, switch tab). */
const RESERVED_WITH_MODIFIER: readonly string[] = ['KeyW', 'KeyT', 'KeyN', 'KeyQ', 'KeyR', 'Tab'];

export interface ChordWarning {
  /** The action bound to Ctrl or Meta. */
  readonly action: BindAction;
  /** The actions whose keys form a reserved browser chord with it, with their key names ("Ctrl + W"). */
  readonly chords: readonly string[];
}

/** Bindings that can make a reserved browser chord while the modifier action is held. Never blocks the binding. */
export function chordWarnings(bindings: Bindings): ChordWarning[] {
  const out: ChordWarning[] = [];
  for (const action of ACTIONS) {
    const mod = bindings[action];
    if (!MODIFIER_CODES.includes(mod)) continue;
    const chords = ACTIONS.filter((a) => a !== action && RESERVED_WITH_MODIFIER.includes(bindings[a])).map(
      (a) => `${keyName(mod)} + ${keyName(bindings[a])}`,
    );
    if (chords.length > 0) out.push({ action, chords });
  }
  return out;
}

/** True where the Keyboard Lock API exists (Chrome, Edge); the input module uses it in fullscreen. */
export const canLockKeyboard = (nav: object = navigator): boolean =>
  typeof (nav as { keyboard?: { lock?: unknown } }).keyboard?.lock === 'function';

/** The note under a binding that forms a reserved chord, matched to the current browser. */
export const chordNote = (lockable: boolean): string =>
  lockable ? 'Works in fullscreen in Chrome and Edge.' : 'In Firefox this combination closes the tab.';

/** One-line description of a rebind for the status line. */
export function describeRebind(action: BindAction, code: string, swapped: BindAction | null, bindings: Bindings): string {
  const head = `${ACTION_LABELS[action]} is now ${keyName(code)}`;
  return swapped ? `${head}. ${ACTION_LABELS[swapped]} swapped to ${keyName(bindings[swapped])}.` : `${head}.`;
}
