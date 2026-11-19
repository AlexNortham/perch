/* eslint-disable @typescript-eslint/no-magic-numbers -- authored proportions and sample poses: the numbers are the data */
/**
 * Dev-only model options, read from the URL (so `npm run shots -- --param …` reaches them), never in a build:
 *   hitboxes            draw each hero's head sphere and body capsule over its model
 *   modelLineup=a,b,c   replace the real heroes with a row of display models at the human's position, spaced 2.4 m
 *                       along x; ids may repeat (a pose sheet)
 *   modelWave=<n>      two facing waves of n fledglings each (front rows fighting) beside the human
 *   modelYaw=<degrees>  how the lineup faces (0 faces +z, 90 faces +x); default 0
 *   modelState=a,b,c    poses for the lineup, cycled over its models: idle run sprint air dash slide crouch shoot
 *                       reload cast channel stun dead updraft mantle climb glide
 *   modelTeam=dawn|dusk lineup team, default dawn
 *   modelStructure=a,b  a row of structure models 14 m in front of the human: hawk heron warden shrine patron, each with
 *                       optional :states joined by + (target ward tr p2), e.g. patron:ward, patron:tr, patron:p2+target
 */
import { HERO_IDS, ViewFlag } from '../../../sim/core/contracts';
import type { HeroId, PlayerTeam } from '../../../sim/core/contracts';

export interface DebugOptions {
  hitboxes: boolean;
  lineup: readonly HeroId[];
  /** Fledglings per flock in a debug wave (two flocks face each other). */
  wave: number;
  yaw: number;
  states: readonly string[];
  team: PlayerTeam;
  /** Structure display models, 'type' or 'type:state+state'. */
  structures: readonly string[];
}

export interface StatePose {
  readonly flags: number;
  /** Horizontal speed (m/s). */
  readonly speed: number;
  readonly vy?: number;
  readonly mode?: 'glide';
}

const G = ViewFlag.Grounded;
export const STATES: Readonly<Record<string, StatePose>> = {
  idle: { flags: G, speed: 0 },
  run: { flags: G, speed: 6.5 },
  sprint: { flags: G, speed: 9.5 },
  air: { flags: 0, speed: 5, vy: 4 },
  dash: { flags: ViewFlag.Dashing, speed: 14 },
  slide: { flags: G | ViewFlag.Sliding | ViewFlag.Crouching, speed: 8 },
  crouch: { flags: G | ViewFlag.Crouching, speed: 0 },
  shoot: { flags: G | ViewFlag.Firing, speed: 0 },
  reload: { flags: G | ViewFlag.Reloading, speed: 0 },
  cast: { flags: G | ViewFlag.Casting, speed: 0 },
  channel: { flags: G | ViewFlag.Channelling, speed: 0 },
  stun: { flags: G | ViewFlag.Stunned, speed: 0 },
  dead: { flags: G | ViewFlag.Dead, speed: 0 },
  updraft: { flags: ViewFlag.OnUpdraft, speed: 0, vy: 8 },
  mantle: { flags: ViewFlag.Mantling, speed: 0 },
  climb: { flags: ViewFlag.Climbing, speed: 0, vy: 3 },
  glide: { flags: 0, speed: 9, mode: 'glide' },
};

export function readDebugOptions(search: string): DebugOptions {
  const q = new URLSearchParams(search);
  const list = (key: string): string[] => (q.get(key) ?? '').split(',').filter((s) => s !== '');
  const ids: readonly string[] = HERO_IDS;
  return {
    hitboxes: q.has('hitboxes'),
    lineup: list('modelLineup').filter((s): s is HeroId => ids.includes(s)),
    wave: Math.min(100, Math.max(0, Math.floor(Number(q.get('modelWave')) || 0))),
    yaw: ((Number(q.get('modelYaw')) || 0) * Math.PI) / 180,
    states: list('modelState').filter((s) => s in STATES),
    team: q.get('modelTeam') === 'dusk' ? 'dusk' : 'dawn',
    structures: list('modelStructure'),
  };
}
