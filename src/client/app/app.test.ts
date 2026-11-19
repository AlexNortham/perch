import { describe, expect, it, vi } from 'vitest';
import { createSim } from '../../sim/index';
import { IDLE_COMMAND, ViewFlag, Button } from '../../sim/core/contracts';
import { projectPoint } from './targeting';
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
    // The replay is the Play match with the siege-proof Owl, whatever `hero` says.
    expect(at('replay')).toEqual(matchConfig({ hero: 'owl', team: 'dawn', difficulty: 'normal', seed: 3 }));
  });

  it('starts the structure match from Play and from ?scene=lane', () => {
    const practice = { map: 'main', roster: [{ team: 'dawn', hero: 'kiwi', controller: 'human' }], options: { structures: true, waves: true, neutrals: false } };
    expect(sceneConfig(parseScene('?scene=lane&hero=kiwi&seed=3'))).toEqual({ seed: 3, ...practice });
    expect(matchConfig({ hero: 'kiwi', team: 'dawn', difficulty: 'normal', seed: 3 })).toEqual({ seed: 3, ...practice });
    expect(matchConfig({ hero: 'kiwi', team: 'dawn', difficulty: 'normal', seed: 3, bots: 11 }).roster.length).toBe(12);
    expect(matchConfig({ hero: 'kiwi', team: 'dawn', difficulty: 'normal', seed: 3, bots: 11 }).options?.structures).toBe(true);
  });
});

describe('Practice Hub', () => {
  it('uses real targets, ability tiers and a fresh wallet on each menu launch', async () => {
    const cfg = sceneConfig(parseScene('?scene=practice&hero=lyrebird'));
    const sim = await createSim(cfg);
    const [player, ally, enemy] = sim.view.heroes;
    expect(player?.ap).toBe(32);
    expect(ally?.controller).toBe('dummy');
    expect(enemy?.team).toBe('dusk');
    const find = (id: number | undefined) => sim.view.entities.find((e) => e.id === id)!;
    expect(find(ally?.id).hp).toBeLessThan(find(ally?.id).maxHp);
    expect(find(enemy?.id).hp).toBe(find(enemy?.id).maxHp);
    sim.step([{ hero: player!.id, command: { ...IDLE_COMMAND, upgrade: 0, held: Button.Aim } }]);
    expect(sim.view.heroes[0]?.abilities[0]).toMatchObject({ tier: 1, nextUpgradeCost: 2 });
    expect(sim.view.heroes[0]?.ap).toBe(31);
    expect(find(player?.id).flags & ViewFlag.Aiming).toBeTruthy();
    const siege = await createSim(matchConfig({ hero: 'lyrebird', team: 'dawn', difficulty: 'normal', seed: 1 }));
    expect(siege.view.heroes[0]?.ap).toBe(0);
    expect(siege.view.heroes[0]?.abilities[3]?.unlocked).toBe(false);
    expect(siege.ctx.config.options.structures).toBe(true);
  });
});

it('projects the rendered crosshair and rejects points behind the lens', () => {
  const pose = { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 1 }, fovDeg: 90 };
  expect(projectPoint({ x: 0, y: 0, z: 20 }, pose, 800, 400)).toEqual({ x: 400, y: 200 });
  expect(projectPoint({ x: -1, y: 1, z: 2 }, pose, 800, 400)?.x).toBeCloseTo(600);
  expect(projectPoint({ x: 0, y: 0, z: -1 }, pose, 800, 400)).toBeNull();
});

describe('settings store', () => {
  it('round-trips through storage and survives blocked or corrupt storage', () => {
    const store = memoryStorage();
    const changed = { ...DEFAULT_SETTINGS, fovDeg: 95, quality: 'high' as const };
    saveSettings(changed, store);
    expect(loadSettings(store)).toEqual(changed);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    store.setItem('perch.settings.v3', '{not json');
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
    const throwing = { ...memoryStorage(), getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(changed, throwing)).not.toThrow();
  });

  it('migrates old default bindings around customised codes', () => {
    const store = memoryStorage();
    store.setItem('perch.settings.v1', JSON.stringify({ bindings: { crouch: 'ControlLeft', item3: 'KeyC', melee: 'KeyN' } }));
    const settings = loadSettings(store);
    expect(settings.bindings).toMatchObject({ crouch: 'KeyC', item3: 'KeyH', melee: 'KeyN' });
    expect(loadSettings(store)).toEqual(settings);
  });

  it('v2 to v3: where keyboard lock exists an untouched C crouch becomes Left Ctrl; custom or taken ones stay', () => {
    vi.stubGlobal('navigator', { keyboard: { lock: () => Promise.resolve(), unlock: () => undefined } });
    try {
      expect(loadSettings(memoryStorage()).bindings.crouch).toBe('ControlLeft');
      const migrate = (bindings: Record<string, string>) => {
        const store = memoryStorage();
        store.setItem('perch.settings.v2', JSON.stringify({ bindings }));
        const s = loadSettings(store);
        expect(store.getItem('perch.settings.v3')).not.toBeNull();
        return s.bindings.crouch;
      };
      expect(migrate({ crouch: 'KeyC' })).toBe('ControlLeft');
      expect(migrate({ crouch: 'KeyJ' })).toBe('KeyJ');
      expect(migrate({ crouch: 'KeyC', melee: 'ControlLeft' })).toBe('KeyC');
    } finally {
      vi.unstubAllGlobals();
    }
    const store = memoryStorage();
    store.setItem('perch.settings.v2', JSON.stringify({ bindings: { crouch: 'KeyC' } }));
    expect(loadSettings(store).bindings.crouch).toBe('KeyC');
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
