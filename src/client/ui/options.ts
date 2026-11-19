/** The Options screen: controls (rebinding) and the settings the store already holds. Changes apply and save at once. */
import type { AppActions, BindAction, Bindings, Quality, Settings } from '../app/contracts';
import { DEFAULT_SETTINGS } from '../app/settings';
import { ACTIONS, ACTION_LABELS, canLockKeyboard, capture, chordNote, chordWarnings, describeRebind, keyName, resetAction } from './bindings';
import { FOV_RANGE, PERCENT, QUALITIES, SENSITIVITY_RANGE, VOLUME_RANGE } from './constants';

const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, content?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  e.className = cls;
  if (content !== undefined) e.textContent = content;
  return e;
};

/** Mouse button index → the binding code input uses. */
/** Everything a mouse press or its release can do besides mousedown: navigation, context menu, focus clicks. */
const NAV_EVENTS = ['mouseup', 'auxclick', 'pointerup', 'click', 'contextmenu', 'pointerdown'] as const;
/** Safety limit for swallowing the tail of a captured press. */
const MOUSE_DRAIN_MS = 1000;
const mouseCode =(button: number): string => `Mouse${button}`;

export function optionsScreen(initial: Settings, actions: AppActions, onBack: () => void): HTMLElement {
  let cur = initial;
  let capturing: BindAction | null = null;
  let stopCapture: (() => void) | null = null;
  const save = (next: Settings): void => {
    cur = next;
    actions.saveSettings(next);
  };

  const status = make('div', 'pu-status', 'Click an action, then press a key or mouse button. Esc cancels.');
  const list = make('div', 'pu-binds');

  const renderBinds = (): void => {
    list.replaceChildren();
    const warnings = chordWarnings(cur.bindings);
    for (const action of ACTIONS) {
      const row = make('div', 'pu-bind');
      const key = make('button', capturing === action ? 'pu-key cap' : 'pu-key', capturing === action ? 'Press a key…' : keyName(cur.bindings[action]));
      key.type = 'button';
      key.dataset['action'] = action;
      key.addEventListener('click', () => startCapture(action));
      const reset = make('button', 'pu-reset', 'Reset');
      reset.type = 'button';
      reset.title = `Reset ${ACTION_LABELS[action]} to ${keyName(DEFAULT_SETTINGS.bindings[action])}`;
      reset.disabled = cur.bindings[action] === DEFAULT_SETTINGS.bindings[action];
      reset.dataset['reset'] = action;
      reset.addEventListener('click', () => applyRebind(action, resetAction(cur.bindings, action, DEFAULT_SETTINGS.bindings), true));
      row.append(make('span', 'pu-bind-name', ACTION_LABELS[action]), key, reset);
      list.append(row);
      const warn = warnings.find((w) => w.action === action);
      if (warn) {
        const note = make('div', 'pu-bind-warn', `${keyName(cur.bindings[action])} + ${warn.chords.map((c) => c.split(' + ')[1]).join(' / ')}: ${chordNote(canLockKeyboard())}`);
        note.dataset['warn'] = action;
        list.append(note);
      }
    }
  };

  const applyRebind = (action: BindAction, r: { bindings: Bindings; swapped: BindAction | null }, reset = false): void => {
    save({ ...cur, bindings: r.bindings });
    status.textContent = describeRebind(action, r.bindings[action], r.swapped, r.bindings).replace(' is now ', reset ? ' reset to ' : ' is now ');
    status.classList.toggle('swap', r.swapped !== null);
    renderBinds();
  };

  function startCapture(action: BindAction): void {
    stopCapture?.();
    capturing = action;
    status.textContent = `Press a key or mouse button for ${ACTION_LABELS[action]} (Esc cancels).`;
    status.classList.remove('swap');
    const swallow = (e: Event): void => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const end = (): void => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', swallow, true);
      window.removeEventListener('mousedown', onMouse, true);
      for (const t of NAV_EVENTS) window.removeEventListener(t, swallow, true);
      capturing = null;
      stopCapture = null;
    };
    /** The captured press still has its up, click and auxiliary events to come (side buttons navigate history): eat them. */
    const drainMouse = (): void => {
      for (const t of NAV_EVENTS) window.addEventListener(t, swallow, true);
      const stop = (): void => {
        for (const t of NAV_EVENTS) window.removeEventListener(t, swallow, true);
        window.removeEventListener('mouseup', later, true);
      };
      const later = (): void => void setTimeout(stop, 0);
      window.addEventListener('mouseup', later, true);
      setTimeout(stop, MOUSE_DRAIN_MS);
    };
    const finish = (code: string): void => {
      const r = capture(cur.bindings, action, code);
      end();
      if (code.startsWith('Mouse')) drainMouse();
      if (r) applyRebind(action, r);
      else {
        status.textContent = 'Cancelled.';
        renderBinds();
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      swallow(e);
      if (!e.repeat) finish(e.code);
    };
    const onMouse = (e: MouseEvent): void => {
      swallow(e);
      finish(mouseCode(e.button));
    };
    stopCapture = end;
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', swallow, true);
    window.addEventListener('mousedown', onMouse, true);
    for (const t of NAV_EVENTS) window.addEventListener(t, swallow, true);
    renderBinds();
  }

  const slider = (
    label: string,
    name: string,
    [min, max, step]: readonly [number, number, number],
    get: () => number,
    set: (v: number) => Settings,
    show: (v: number) => string,
  ): HTMLElement => {
    const row = make('label', 'pu-opt');
    const out = make('output', 'pu-val', show(get()));
    const input = make('input', '');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(get());
    input.dataset['opt'] = name;
    input.addEventListener('input', () => {
      out.textContent = show(Number(input.value));
    });
    input.addEventListener('change', () => save(set(Number(input.value))));
    row.append(make('span', 'pu-opt-name', label), input, out);
    return row;
  };
  const pct = (v: number): string => `${Math.round(v * PERCENT)}%`;

  const quality = make('div', 'pu-opt');
  quality.append(make('span', 'pu-opt-name', 'Graphics quality'));
  const seg = make('div', 'pu-seg');
  for (const q of QUALITIES) {
    const b = make('button', cur.quality === q ? 'pu-btn pu-quiet on' : 'pu-btn pu-quiet', q[0]?.toUpperCase() + q.slice(1));
    b.type = 'button';
    b.dataset['quality'] = q;
    b.addEventListener('click', () => {
      save({ ...cur, quality: q as Quality });
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    });
    seg.append(b);
  }
  quality.append(seg);

  const vol = (label: string, key: keyof Settings['volume']): HTMLElement =>
    slider(label, `volume-${key}`, VOLUME_RANGE, () => cur.volume[key], (v) => ({ ...cur, volume: { ...cur.volume, [key]: v } }), pct);

  const resetAll = make('button', 'pu-btn pu-quiet', 'Reset all controls');
  resetAll.type = 'button';
  resetAll.dataset['resetAll'] = '1';
  resetAll.addEventListener('click', () => {
    stopCapture?.();
    save({ ...cur, bindings: DEFAULT_SETTINGS.bindings });
    status.textContent = 'All controls reset to defaults.';
    status.classList.remove('swap');
    renderBinds();
  });
  const back = make('button', 'pu-btn pu-quiet', 'Back');
  back.type = 'button';
  back.addEventListener('click', () => {
    stopCapture?.();
    onBack();
  });

  const controls = make('div', 'pu-col');
  controls.append(make('h3', 'pu-h3', 'Controls'), status, resetAll, list);
  const general = make('div', 'pu-col');
  general.append(
    make('h3', 'pu-h3', 'Mouse and view'),
    slider('Mouse sensitivity', 'sensitivity', SENSITIVITY_RANGE, () => cur.sensitivity, (v) => ({ ...cur, sensitivity: v }), (v) => v.toFixed(2)),
    slider('Field of view', 'fov', FOV_RANGE, () => cur.fovDeg, (v) => ({ ...cur, fovDeg: v }), (v) => `${v}°`),
    make('h3', 'pu-h3', 'Graphics'),
    quality,
    make('h3', 'pu-h3', 'Volume'),
    vol('Master', 'master'),
    vol('Music', 'music'),
    vol('Effects', 'sfx'),
  );
  const panel = make('div', 'pu-opts');
  panel.append(controls, general);
  const s = make('div', 'pu-screen pu-select');
  s.append(make('h2', 'pu-h2', 'Options'), panel, back);
  renderBinds();
  return s;
}
