import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../app/bindings';
import { ACTIONS, canLockKeyboard, capture, chordNote, chordWarnings, describeRebind, keyName, rebind, resetAction } from './bindings';

describe('key bindings', () => {
  it('names keys readably', () => {
    expect(keyName('ShiftLeft')).toBe('Left Shift');
    expect(keyName('Mouse3')).toBe('Mouse 4');
    expect(keyName('Mouse0')).toBe('Left Mouse');
    expect(keyName('KeyJ')).toBe('J');
    expect(keyName('Digit2')).toBe('2');
    expect(keyName('BracketLeft')).toBe('Bracket Left');
  });

  it('labels every default action', () => {
    expect([...ACTIONS].sort()).toEqual(Object.keys(DEFAULT_BINDINGS).sort());
  });

  it('capture rebinds to a free key and Esc cancels', () => {
    const r = capture(DEFAULT_BINDINGS, 'jump', 'KeyJ');
    expect(r?.bindings.jump).toBe('KeyJ');
    expect(r?.swapped).toBeNull();
    expect(capture(DEFAULT_BINDINGS, 'jump', 'Escape')).toBeNull();
    expect(capture(DEFAULT_BINDINGS, 'jump', 'Tab'), 'Tab is not bindable (D-EP-041)').toBeNull();
  });

  it('a key in use swaps the two actions', () => {
    const r = rebind(DEFAULT_BINDINGS, 'jump', 'ShiftLeft');
    expect(r.bindings.jump).toBe('ShiftLeft');
    expect(r.bindings.dash).toBe('Space');
    expect(r.swapped).toBe('dash');
    expect(describeRebind('jump', 'ShiftLeft', r.swapped, r.bindings)).toContain('Dash swapped to Space');
    expect(rebind(DEFAULT_BINDINGS, 'jump', 'Space').swapped).toBeNull();
  });

  it('warns, never blocks, when Ctrl crouch can pair with a reserved key', () => {
    expect(chordWarnings(DEFAULT_BINDINGS).filter((w) => w.action === 'crouch')).toEqual([]);
    const ctrl = rebind(DEFAULT_BINDINGS, 'crouch', 'ControlLeft').bindings;
    expect(ctrl.crouch).toBe('ControlLeft');
    const [w] = chordWarnings(ctrl);
    expect(w?.action).toBe('crouch');
    expect(w?.chords).toContain('Left Ctrl + W');
    expect(chordNote(true)).toBe('Works in fullscreen in Chrome and Edge.');
    expect(chordNote(false)).toBe('In Firefox this combination closes the tab.');
    expect(canLockKeyboard({ keyboard: { lock: () => undefined } })).toBe(true);
    expect(canLockKeyboard({})).toBe(false);
  });

  it('reset restores a key, swapping if it is taken', () => {
    const moved = rebind(DEFAULT_BINDINGS, 'jump', 'KeyJ').bindings;
    expect(resetAction(moved, 'jump', DEFAULT_BINDINGS).bindings).toEqual(DEFAULT_BINDINGS);
    const taken = rebind(moved, 'dash', 'Space').bindings;
    const r = resetAction(taken, 'jump', DEFAULT_BINDINGS);
    expect(r.bindings.jump).toBe('Space');
    expect(r.swapped).toBe('dash');
  });
});
