import { describe, expect, it } from 'vitest';
import { TICK_SECONDS } from '../../sim/data/core';
import type { SimView } from '../../sim/core/contracts';
import { createFixedStep, interpolate, MAX_STEPS_PER_FRAME } from './loop';
import { matchConfig, parseScene, sceneConfig } from './router';
import { DEFAULT_SETTINGS, loadSettings, sanitizeSettings, saveSettings } from './settings';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

describe('scene router', () => {
  it('parses every parameter and falls back on bad values', () => {
    expect(parseScene('?scene=lane&seed=7&hero=owl&cam=top&quality=low&t=30')).toEqual({
      scene: 'lane',
      seed: 7,
      hero: 'owl',
      cam: 'top',
      quality: 'low',
      t: 30,
    });
    expect(parseScene('?scene=nope&seed=x&hero=dodo&cam=?&quality=ultra&t=-5')).toEqual({
      scene: 'menu',
      seed: 1,
      hero: 'shrike',
      cam: 'overview',
      quality: null,
      t: 0,
    });
    expect(parseScene('?scene=match').cam).toBe('player');
  });

  it('maps scenes to sim configs', () => {
    const at = (scene: string) => sceneConfig(parseScene(`?scene=${scene}&hero=kiwi&seed=3`));
    expect(at('menu')).toMatchObject({ map: 'main', roster: [] });
    expect(at('blockout')).toMatchObject({ map: 'main', roster: [] });
    expect(at('sandbox').roster).toEqual([{ team: 'dawn', hero: 'kiwi', controller: 'human' }]);
    expect(at('match').roster.length).toBe(12);
  });

  it('starts the practice match from Play and from ?scene=lane', () => {
    const practice = { map: 'main', roster: [{ team: 'dawn', hero: 'kiwi', controller: 'human' }] };
    expect(sceneConfig(parseScene('?scene=lane&hero=kiwi&seed=3'))).toEqual({ seed: 3, ...practice });
    expect(matchConfig({ hero: 'kiwi', team: 'dawn', difficulty: 'normal', seed: 3 })).toEqual({ seed: 3, ...practice });
    expect(matchConfig({ hero: 'kiwi', team: 'dawn', difficulty: 'normal', seed: 3, bots: 11 }).roster.length).toBe(12);
  });
});

describe('settings store', () => {
  it('round-trips through storage and survives blocked or corrupt storage', () => {
    const store = memoryStorage();
    const changed = { ...DEFAULT_SETTINGS, fovDeg: 95, quality: 'high' as const };
    saveSettings(changed, store);
    expect(loadSettings(store)).toEqual(changed);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    store.setItem('perch.settings.v1', '{not json');
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
    const throwing = { ...memoryStorage(), getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(changed, throwing)).not.toThrow();
  });

  it('keeps well-formed fields and clamps the rest', () => {
    const s = sanitizeSettings({ fovDeg: 500, sensitivity: 'fast', volume: { music: 0.2 }, bindings: { jump: 'KeyJ', fire: 3 } });
    expect(s.fovDeg).toBe(110);
    expect(s.sensitivity).toBe(DEFAULT_SETTINGS.sensitivity);
    expect(s.volume).toEqual({ ...DEFAULT_SETTINGS.volume, music: 0.2 });
    expect(s.bindings.jump).toBe('KeyJ');
    expect(s.bindings.fire).toBe(DEFAULT_SETTINGS.bindings.fire);
  });
});

describe('fixed-step loop', () => {
  it('turns wall-clock time into whole ticks and an interpolation alpha', () => {
    const step = createFixedStep();
    expect(step.advance(TICK_SECONDS * 2.5)).toBe(2);
    expect(step.alpha).toBeCloseTo(0.5);
    expect(step.advance(TICK_SECONDS * 0.5)).toBe(1);
    expect(step.alpha).toBeCloseTo(0);
  });

  it('caps steps per frame and drops a long stall', () => {
    const step = createFixedStep();
    expect(step.advance(10)).toBe(MAX_STEPS_PER_FRAME);
    expect(step.advance(0)).toBe(0);
  });

  it('interpolates an entity between views by id', () => {
    const view = (x: number, yaw: number): SimView =>
      ({
        entities: [{ id: 4, pos: { x, y: 0, z: 0 }, yaw, pitch: 0 }],
      }) as unknown as SimView;
    const prev = view(0, Math.PI - 0.1);
    const curr = view(10, -Math.PI + 0.1);
    const p = interpolate({ prev, curr, alpha: 0.5, dt: 0 }, curr.entities[0]!);
    expect(p.pos.x).toBeCloseTo(5);
    expect(Math.abs(p.yaw)).toBeCloseTo(Math.PI);
  });
});
