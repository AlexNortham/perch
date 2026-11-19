import { describe, expect, it } from 'vitest';
import { Button } from '../../sim/core/contracts';
import type { Ping } from '../../sim/core/contracts';
import type { Settings, UiAction } from '../app/contracts';
import { DEFAULT_SETTINGS } from '../app/settings';
import { DEFAULT_BINDINGS, createInput, rebind } from './index';

class FakeDoc extends EventTarget {
  pointerLockElement: unknown = null;
  defaultView = null;
  exitPointerLock(): void {
    this.pointerLockElement = null;
    this.dispatchEvent(new Event('pointerlockchange'));
  }
}
class FakeTarget extends EventTarget {
  constructor(readonly ownerDocument: FakeDoc) {
    super();
  }
  requestPointerLock(): void {
    this.ownerDocument.pointerLockElement = this;
    this.ownerDocument.dispatchEvent(new Event('pointerlockchange'));
  }
}

function rig(settings: Settings = DEFAULT_SETTINGS) {
  const doc = new FakeDoc();
  const target = new FakeTarget(doc);
  const ui: [UiAction, boolean][] = [];
  const input = createInput(target as unknown as HTMLElement, settings, (a, d) => ui.push([a, d]));
  input.setEnabled(true); // locks
  const key = (type: 'keydown' | 'keyup', code: string, repeat = false): void => {
    doc.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { code, repeat }));
  };
  const mouse = (type: 'mousedown' | 'mouseup', button: number): void => {
    doc.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { button }));
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
      ['KeyE', Button.Interact],
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

  it('shop, scoreboard and big map report down and up; disabling releases everything', () => {
    const { input, key, ui } = rig();
    key('keydown', 'Tab');
    key('keydown', 'KeyB');
    key('keyup', 'KeyB');
    key('keydown', 'KeyW');
    input.setEnabled(false);
    expect(ui).toEqual([
      ['scoreboard', true],
      ['shop', true],
      ['shop', false],
      ['scoreboard', false],
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
