import { HERO_IDS } from '../../sim/core/contracts';
import type { HeroId, SimConfig } from '../../sim/core/contracts';
import { humanRoster } from '../../sim/index';
import { CAMERA_PRESETS } from './contracts';
import type { CameraPreset, MatchSetup, Quality } from './contracts';

/**
 * The `?scene=` router for repeatable screenshots and quick starts:
 *   scene   menu (default) | blockout | sandbox | lane (the practice match Play starts) | match (1 + 11 bots)
 *   seed    integer match seed (default 1)
 *   hero    hero id for the human (default shrike)
 *   cam     camera preset (CAMERA_PRESETS); default 'overview' for menu and blockout, 'player' otherwise
 *   quality low | medium | high (overrides the saved setting)
 *   t       seconds of sim to fast-forward before the first frame (default 0)
 * Bad values fall back to the defaults.
 */
export const SCENES = ['menu', 'blockout', 'sandbox', 'lane', 'match'] as const;
export type SceneName = (typeof SCENES)[number];

export interface SceneRequest {
  readonly scene: SceneName;
  readonly seed: number;
  readonly hero: HeroId;
  readonly cam: CameraPreset;
  readonly quality: Quality | null;
  readonly t: number;
}

const DEFAULT_HERO: HeroId = 'shrike';
const MAX_FAST_FORWARD_S = 3600;
const QUALITIES: readonly string[] = ['low', 'medium', 'high'];

function oneOf<T extends string>(list: readonly T[], v: string | null): T | null {
  return v !== null && (list as readonly string[]).includes(v) ? (v as T) : null;
}

export function parseScene(search: string): SceneRequest {
  const q = new URLSearchParams(search);
  const scene = oneOf(SCENES, q.get('scene')) ?? 'menu';
  const seed = Number(q.get('seed') ?? '1');
  const t = Number(q.get('t') ?? '0');
  return {
    scene,
    seed: Number.isSafeInteger(seed) ? seed : 1,
    hero: oneOf(HERO_IDS, q.get('hero')) ?? DEFAULT_HERO,
    cam: oneOf(CAMERA_PRESETS, q.get('cam')) ?? (scene === 'menu' || scene === 'blockout' ? 'overview' : 'player'),
    quality: QUALITIES.includes(q.get('quality') ?? '') ? (q.get('quality') as Quality) : null,
    t: Number.isFinite(t) ? Math.min(MAX_FAST_FORWARD_S, Math.max(0, t)) : 0,
  };
}

/**
 * The match Play starts (D-ARCH-013): the human with the chosen hero on 'main' with fledgling waves on all three
 * lanes, plus `setup.bots` bot heroes (default 0, the practice match).
 */
export function matchConfig(setup: MatchSetup): SimConfig {
  const { seed, hero, team, difficulty, bots = 0 } = setup;
  return { seed, map: 'main', roster: humanRoster(seed, hero, { team, difficulty, bots }) };
}

/** The sim each scene runs. The menu shows the real map, empty, as its backdrop (D-EP-017). */
export function sceneConfig(req: SceneRequest): SimConfig {
  const { seed, hero } = req;
  switch (req.scene) {
    case 'menu':
    case 'blockout':
      return { seed, map: 'main', roster: [], options: { waves: false, neutrals: false } };
    case 'sandbox':
      return { seed, map: 'arena', roster: humanRoster(seed, hero, { bots: 0 }), options: { unlockAbilities: true } };
    case 'lane':
      return matchConfig({ seed, hero, team: 'dawn', difficulty: 'normal' });
    case 'match':
      return { seed, map: 'main', roster: humanRoster(seed, hero) };
  }
}
