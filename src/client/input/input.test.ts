import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../sim/core/contracts';
import type { Ping } from '../../sim/core/contracts';
import type { Settings, UiAction } from '../app/contracts';
import { DEFAULT_SETTINGS } from '../app/settings';
import { DEFAULT_BINDINGS, createInput, defaultBindings, rebind } from './index';

class FakeDoc extends EventTarget {
  pointerLockElement: unknown = null;
  defaultView: EventTarget | null = null;
  fullscreenElement: unknown = null;
  refuseFullscreen = false;
  readonly fullscreenRequests: unknown[] = [];
  readonly documentElement = {
    requestFullscreen: (options?: unknown): Promise<void> => {
      this.fullscreenRequests.push(options);
      if (this.refuseFullscreen) return Promise.reject(new TypeError('Permissions check failed'));
      this.fullscreenElement = this.documentElement;
      this.dispatchEvent(new Event('fullscreenchange'));
      return Promise.resolve();
    },
  };
  exitPointerLock(): void {
    this.pointerLockElement = null;
    this.dispatchEvent(new Event('pointerlockchange'));
  }
  exitFullscreen(): Promise<void> {
    this.fullscreenElement = null;
    this.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  }
}
/** Chromium's navigator.keyboard, recording calls. */
function fakeKeyboard() {
  const calls: string[] = [];
  return {
    calls,
    lock: (codes?: readonly string[]): Promise<void> => {
      calls.push(codes === undefined ? 'lock' : `lock(${codes.join()})`);
      return Promise.resolve();
    },
    unlock: (): void => void calls.push('unlock'),
  };
}
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
class FakeTarget extends EventTarget {
  constructor(readonly ownerDocument: FakeDoc) {
    super();
  }
  requestPointerLock(): void {
    this.ownerDocument.pointerLockElement = this;
    this.ownerDocument.dispatchEvent(new Event('pointerlockchange'));
  }
}

function rig(settings: Settings = DEFAULT_SETTINGS, browser: { keyboard?: ReturnType<typeof fakeKeyboard>; refuseFullscreen?: boolean } = {}) {
  const doc = new FakeDoc();
  if (browser.keyboard) doc.defaultView = Object.assign(new EventTarget(), { navigator: { keyboard: browser.keyboard } });
  doc.refuseFullscreen = browser.refuseFullscreen ?? false;
  const target = new FakeTarget(doc);
  const ui: [UiAction, boolean][] = [];
  const input = createInput(target as unknown as HTMLElement, settings, (a, d) => ui.push([a, d]));
  input.setEnabled(true); // locks
  const key = (type: 'keydown' | 'keyup', code: string, repeat = false): void => {
    doc.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { code, repeat }));
  };
  const mouse = (type: 'mousedown' | 'mouseup' | 'auxclick', button: number): boolean => {
    return doc.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { button }));
  };
  const move = (movementX: number, movementY: number): void => {
    doc.dispatchEvent(Object.assign(new Event('mousemove'), { movementX, movementY }));
  };
  return { doc, target, ui, input, key, mouse, move };
}

describe('press latch', () => {
  it('a tap between two steps registers pressed once and is not held', () => {
    const { input, key } = rig();
    key('keydown', 'Space');
    key('keyup', 'Space');
    const a = input.sample();
    expect(a.pressed & Button.Jump).toBe(Button.Jump);
    expect(a.held & Button.Jump).toBe(0);
    expect(input.sample().pressed).toBe(0);
  });

  it('a held key is held every sample but pressed once; key repeat adds nothing', () => {
    const { input, key } = rig();
    key('keydown', 'ShiftLeft');
    key('keydown', 'ShiftLeft', true);
    const a = input.sample();
    expect(a.held & Button.Dash).toBe(Button.Dash);
    expect(a.pressed & Button.Dash).toBe(Button.Dash);
    const b = input.sample();
    expect(b.held & Button.Dash).toBe(Button.Dash);
    expect(b.pressed).toBe(0);
    key('keyup', 'ShiftLeft');
    expect(input.sample().held).toBe(0);
  });

  it('keeps both fresh crouch presses when a rapid double tap lands between samples', () => {
    const { input, key } = rig();
    for (let i = 0; i < 2; i++) {
      key('keydown', 'KeyC');
      key('keyup', 'KeyC');
    }
    expect(input.sample().pressed).toBe(Button.Crouch);
    expect(input.sample().pressed).toBe(Button.Crouch);
    expect(input.sample().pressed).toBe(0);
  });

  it('press-release-press-release between steps is still one press', () => {
    const { input, key } = rig();
    for (let i = 0; i < 2; i++) {
      key('keydown', 'KeyR');
      key('keyup', 'KeyR');
    }
    expect(input.sample().pressed).toBe(Button.Reload);
  });
});

describe('axes, buttons and mouse', () => {
  it('maps WASD to axes; opposite keys cancel', () => {
    const { input, key } = rig();
    key('keydown', 'KeyW');
    key('keydown', 'KeyD');
    expect(input.sample()).toMatchObject({ forward: 1, right: 1 });
    key('keydown', 'KeyS');
    key('keydown', 'KeyA');
    expect(input.sample()).toMatchObject({ forward: 0, right: 0 });
  });

  it('accepts explicit legacy or custom crouch and item bindings', () => {
    const { input, key } = rig({ ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_BINDINGS, crouch: 'ControlLeft', item3: 'KeyC' } });
    key('keydown', 'ControlLeft');
    key('keydown', 'KeyC');
    expect(input.sample().held & (Button.Crouch | Button.Item3)).toBe(Button.Crouch | Button.Item3);
  });

  it('maps every GDD §3.1 button', () => {
    const { input, key, mouse } = rig();
    const expected: [string, number][] = [
      ['Space', Button.Jump],
      ['KeyC', Button.Crouch],
      ['ShiftLeft', Button.Dash],
      ['KeyR', Button.Reload],
      ['KeyQ', Button.Melee],
      ['KeyF', Button.Parry],
      ['Digit1', Button.Ability1],
      ['Digit2', Button.Ability2],
      ['Digit3', Button.Ability3],
      ['Digit4', Button.Ability4],
      ['KeyZ', Button.Item1],
      ['KeyX', Button.Item2],
      ['KeyN', Button.Item3],
      ['KeyV', Button.Item4],
      ['KeyG', Button.ShoulderSwap],
    ];
    for (const [code, bit] of expected) {
      key('keydown', code);
      expect(input.sample().held & bit, code).toBe(bit);
      key('keyup', code);
    }
    mouse('mousedown', 0);
    mouse('mousedown', 2);
    expect(input.sample().held).toBe(Button.Fire | Button.Aim);
  });

  it('Alt + ability key upgrades that slot once and does not cast', () => {
    const { input, key } = rig();
    key('keydown', 'AltLeft');
    key('keydown', 'Digit3');
    const a = input.sample();
    expect(a.upgrade).toBe(2);
    expect(a.held & Button.Ability3).toBe(0);
    expect(a.pressed & Button.Ability3).toBe(0);
    expect(input.sample().upgrade).toBeNull();
  });

  it('mouse look: 0.06 degrees per count, right turns right (yaw falls), up looks up, pitch clamps, invert', () => {
    const { input, move } = rig();
    move(100, 0);
    expect(input.look.yaw).toBeCloseTo((-6 * Math.PI) / 180, 9);
    move(0, -100);
    expect(input.look.pitch).toBeCloseTo((6 * Math.PI) / 180, 9);
    move(0, -1e6);
    expect(input.look.pitch).toBeCloseTo((80 * Math.PI) / 180, 9);
    const inv = rig({ ...DEFAULT_SETTINGS, invertY: true, sensitivity: 2 });
    inv.move(0, -100);
    expect(inv.input.look.pitch).toBeCloseTo((-12 * Math.PI) / 180, 9);
  });

  it('mouse look and buttons need the pointer lock; setLook carries into the next sample', () => {
    const { input, move, doc, mouse } = rig();
    doc.pointerLockElement = null;
    move(100, 100);
    mouse('mousedown', 0);
    expect(input.look).toEqual({ yaw: 0, pitch: 0 });
    expect(input.sample().held).toBe(0);
    input.setLook({ yaw: 1, pitch: 0.2 });
    expect(input.sample()).toMatchObject({ yaw: 1, pitch: 0.2 });
  });

  it('crouch toggle setting', () => {
    const { input, key } = rig({ ...DEFAULT_SETTINGS, crouchToggle: true });
    key('keydown', 'KeyC');
    key('keyup', 'KeyC');
    expect(input.sample().held & Button.Crouch).toBe(Button.Crouch);
    key('keydown', 'KeyC');
    key('keyup', 'KeyC');
    expect(input.sample().held & Button.Crouch).toBe(0);
  });

  it('reports a solo modifier on release, while a chord submits one upgrade and leaves the panel closed', () => {
    const { input, key, ui } = rig();
    key('keydown', 'AltLeft');
    expect(ui).toEqual([]);
    key('keyup', 'AltLeft');
    expect(ui).toEqual([['upgrades', true]]);
    key('keydown', 'AltLeft');
    key('keydown', 'Digit3');
    key('keyup', 'AltLeft');
    key('keyup', 'Digit3');
    expect(ui).toHaveLength(1);
    expect(input.sample()).toMatchObject({ upgrade: 2, held: 0, pressed: 0 });
    expect(input.sample().upgrade).toBeNull();
  });

  it('scales mouse look with the active hero zoom only while aiming', () => {
    const { input, move, mouse } = rig();
    input.setAimZoom?.(0.5);
    mouse('mousedown', 2);
    move(100, 0);
    expect(input.look.yaw).toBeCloseTo(-3 * Math.PI / 180);
    mouse('mouseup', 2);
    move(100, 0);
    expect(input.look.yaw).toBeCloseTo(-9 * Math.PI / 180);
  });

  it('captures gameplay side buttons on press, release and auxclick', () => {
    const bindings = rebind(rebind(DEFAULT_BINDINGS, 'melee', 'Mouse3'), 'parry', 'Mouse4');
    const { input, mouse } = rig({ ...DEFAULT_SETTINGS, bindings });
    expect(mouse('mousedown', 3)).toBe(false);
    expect(input.sample()).toMatchObject({ held: Button.Melee, pressed: Button.Melee });
    expect(mouse('mouseup', 3)).toBe(false);
    expect(mouse('auxclick', 3)).toBe(false);
    expect(input.sample().held).toBe(0);
    expect(mouse('mousedown', 4)).toBe(false);
    expect(input.sample().pressed).toBe(Button.Parry);
    input.setEnabled(false);
    expect(mouse('mouseup', 4)).toBe(false);
    expect(mouse('auxclick', 4)).toBe(false);
    expect(input.sample().held).toBe(0);
  });

  it('opens the ping wheel once when held and resolves no tap on release', () => {
    vi.useFakeTimers();
    try {
      const { input, mouse, ui } = rig();
      input.setPingResolver(() => ({ kind: 'goHere', pos: { x: 1, y: 2, z: 3 }, target: null }));
      mouse('mousedown', 1);
      vi.advanceTimersByTime(500);
      mouse('mouseup', 1);
      expect(ui).toEqual([['pingWheel', true]]);
      expect(input.sample().ping).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a middle-mouse tap resolves a ping', () => {
    const { input, mouse } = rig();
    const ping: Ping = { kind: 'goHere', pos: { x: 1, y: 2, z: 3 }, target: null };
    input.setPingResolver(() => ping);
    mouse('mousedown', 1);
    mouse('mouseup', 1);
    expect(input.sample().ping).toEqual(ping);
    expect(input.sample().ping).toBeNull();
  });
});

describe('enable, pause and UI actions', () => {
  it('Esc reports pause (even when disabled, to resume); releasing the lock while enabled also pauses', () => {
    const { input, key, doc, ui } = rig();
    key('keydown', 'Escape');
    expect(ui).toEqual([['pause', true]]);
    ui.length = 0;
    input.setEnabled(false);
    key('keydown', 'Escape');
    expect(ui).toEqual([['pause', true]]);
    ui.length = 0;
    input.setEnabled(true);
    doc.exitPointerLock();
    expect(ui).toEqual([['pause', true]]);
    key('keydown', 'Escape'); // the same Esc press, reported twice by the browser: counted once
    expect(ui).toHaveLength(1);
  });

  it('shop and big map report down and up; disabling releases everything', () => {
    const { input, key, ui } = rig();
    key('keydown', 'KeyB');
    key('keyup', 'KeyB');
    key('keydown', 'KeyW');
    input.setEnabled(false);
    expect(ui).toEqual([
      ['shop', true],
      ['shop', false],
    ]);
    expect(input.sample()).toMatchObject({ forward: 0, held: 0, pressed: 0 });
  });

  it('resume re-requests the lock, and a click re-locks if that was refused', () => {
    const { input, doc, target } = rig();
    input.setEnabled(false);
    expect(doc.pointerLockElement).toBeNull();
    input.setEnabled(true);
    expect(doc.pointerLockElement).toBe(target);
    doc.pointerLockElement = null; // browser refused or Esc released it
    target.dispatchEvent(new Event('mousedown'));
    expect(doc.pointerLockElement).toBe(target);
  });

  it('a disabled input ignores keys', () => {
    const { input, key } = rig();
    input.setEnabled(false);
    key('keydown', 'KeyW');
    input.setEnabled(true);
    expect(input.sample().forward).toBe(0);
  });
});

describe('fullscreen keyboard lock (D-EP-030)', () => {
  const ctrlCrouch = { ...DEFAULT_SETTINGS, bindings: defaultBindings({ keyboard: fakeKeyboard() } as unknown as Navigator) };

  it('play goes fullscreen and locks every key; pause gives the keys back in fullscreen; leaving exits', async () => {
    const keyboard = fakeKeyboard();
    const { input, doc, target, key, ui } = rig(ctrlCrouch, { keyboard });
    await settle();
    expect(doc.pointerLockElement).toBe(target);
    expect(doc.fullscreenRequests).toEqual([{ navigationUI: 'hide' }]);
    expect(doc.fullscreenElement).toBe(doc.documentElement);
    expect(keyboard.calls).toEqual(['lock']); // no key list: every key, Ctrl+W included

    key('keydown', 'KeyW');
    key('keydown', 'ControlLeft');
    expect(input.sample()).toMatchObject({ forward: 1, held: Button.Crouch, pressed: Button.Crouch });

    key('keydown', 'Escape'); // one Esc reaches the page under the lock and still pauses
    expect(ui).toEqual([['pause', true]]);
    input.setEnabled(false);
    expect(keyboard.calls).toEqual(['lock', 'unlock']);
    expect(doc.fullscreenElement).toBe(doc.documentElement);
    expect(doc.pointerLockElement).toBeNull();

    input.setEnabled(true); // Resume: fullscreen is still on, so only the lock is taken again
    await settle();
    expect(doc.fullscreenRequests).toHaveLength(1);
    expect(keyboard.calls).toEqual(['lock', 'unlock', 'lock']);

    input.setEnabled(false);
    input.exitFullscreen();
    expect(doc.fullscreenElement).toBeNull();
    expect(keyboard.calls).toEqual(['lock', 'unlock', 'lock', 'unlock']);
  });

  it('holding Esc out of fullscreen drops the lock, and the next play gesture asks again', async () => {
    const keyboard = fakeKeyboard();
    const { input, doc, target } = rig(ctrlCrouch, { keyboard });
    await settle();
    void doc.exitFullscreen(); // the browser's long-Esc exit
    expect(keyboard.calls).toEqual(['lock', 'unlock']);
    input.setEnabled(false);
    input.setEnabled(true);
    await settle();
    expect(doc.fullscreenRequests).toHaveLength(2);
    expect(keyboard.calls).toEqual(['lock', 'unlock', 'lock']);
    expect(doc.pointerLockElement).toBe(target);
  });

  it('a refused fullscreen leaves the keys unlocked and play windowed, with C still crouching', async () => {
    const keyboard = fakeKeyboard();
    const { input, doc, target, key } = rig(ctrlCrouch, { keyboard, refuseFullscreen: true });
    await settle();
    expect(doc.fullscreenRequests).toHaveLength(1);
    expect(keyboard.calls).toEqual([]);
    expect(doc.pointerLockElement).toBe(target);
    key('keydown', 'KeyC');
    expect(input.sample().held).toBe(Button.Crouch);
    key('keyup', 'KeyC');
    expect(input.sample().held).toBe(0);
  });

  it('without navigator.keyboard (Firefox) play never goes fullscreen and C stays the default crouch', async () => {
    const { doc, input } = rig();
    await settle();
    expect(doc.fullscreenRequests).toEqual([]);
    input.exitFullscreen();
    expect(defaultBindings(undefined)).toBe(DEFAULT_BINDINGS);
    expect(defaultBindings({} as Navigator).crouch).toBe('KeyC');
    expect(ctrlCrouch.bindings).toEqual({ ...DEFAULT_BINDINGS, crouch: 'ControlLeft' });
    const codes = Object.values(ctrlCrouch.bindings);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('a disable before fullscreen resolves leaves the keyboard unlocked', async () => {
    const keyboard = fakeKeyboard();
    const { input } = rig(ctrlCrouch, { keyboard });
    input.setEnabled(false);
    await settle();
    expect(keyboard.calls).toEqual([]);
  });
});

describe('bindings', () => {
  it('defaults use each key once', () => {
    const codes = Object.values(DEFAULT_BINDINGS);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('rebind swaps on conflict; a rebound key drives the action', () => {
    const swapped = rebind(DEFAULT_BINDINGS, 'jump', 'KeyW');
    expect(swapped.jump).toBe('KeyW');
    expect(swapped.forward).toBe('Space');
    const free = rebind(DEFAULT_BINDINGS, 'dash', 'KeyH');
    expect(free.dash).toBe('KeyH');
    const { input, key } = rig();
    input.setSettings({ ...DEFAULT_SETTINGS, bindings: free });
    key('keydown', 'ShiftLeft');
    expect(input.sample().held).toBe(0);
    key('keydown', 'KeyH');
    expect(input.sample().held).toBe(Button.Dash);
  });
});
