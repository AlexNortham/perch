/* eslint-disable @typescript-eslint/no-magic-numbers -- authored proportions and sample poses: the numbers are the data */
/**
 * Dev-only model options, read from the URL (so `npm run shots -- --param …` reaches them), never in a build:
 *   hitboxes            draw each hero's head sphere and body capsule over its model
 *   modelLineup=a,b,c   replace the real heroes with a row of display models at the human's position, spaced 2.4 m
 *                       along x; ids may repeat (a pose sheet)
 *   modelWave=<n>      two facing waves of n fledglings each (front rows fighting) beside the human
 *   modelYaw=<degrees>  how the lineup faces (0 faces +z, 90 faces +x); default 0
 *   modelState=a,b,c    poses for the lineup, cycled over its models: idle aim run sprint air jump fall land dash slide
 *                       crouch shoot reload cast cast1..cast4 channel stun hit dead updraft mantle climb glide charge
 *                       light heavy parry
 *   modelTeam=dawn|dusk lineup team, default dawn
 *   modelStructure=a,b  a row of structure models 14 m in front of the human: hawk heron warden shrine patron, each with
 *                       optional :states joined by + (target ward tr p2), e.g. patron:ward, patron:tr, patron:p2+target
 */
import { HERO_IDS, ViewFlag } from '../../../sim/core/contracts';
import type { EntityView, HeroId, PlayerTeam } from '../../../sim/core/contracts';

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

/** Seconds per repeat of a debug light or heavy swing. */
export const MELEE_CYCLE = 1.6;

export interface StatePose {
  readonly flags: number;
  /** Horizontal speed (m/s). */
  readonly speed: number;
  readonly vy?: number;
  readonly mode?: 'glide';
  /** Look pitch (rad, + up). */
  readonly pitch?: number;
  /** Melee pose; light and heavy repeat every MELEE_CYCLE seconds so a still shot catches a swing. */
  readonly melee?: 'charging' | 'light' | 'heavy' | 'parry';
  /** Ability slot being cast (0 to 3). */
  readonly castSlot?: number;
  /** A hit lands every HIT_CYCLE seconds. */
  readonly hit?: boolean;
  /** Falls, then touches down: grounded only for the second half of every LAND_CYCLE seconds. */
  readonly land?: boolean;
}

/** Seconds between debug hits, and per fall-and-land repeat. */
export const HIT_CYCLE = 0.6;
export const LAND_CYCLE = 1.2;

const G = ViewFlag.Grounded;
const C = G | ViewFlag.Casting;
export const STATES: Readonly<Record<string, StatePose>> = {
  idle: { flags: G, speed: 0 },
  aim: { flags: G, speed: 0, pitch: 0.25 },
  run: { flags: G, speed: 6.5 },
  sprint: { flags: G, speed: 9.5 },
  air: { flags: 0, speed: 5, vy: 4 },
  jump: { flags: 0, speed: 5, vy: 6 },
  fall: { flags: 0, speed: 3, vy: -7 },
  land: { flags: G, speed: 0, land: true },
  dash: { flags: ViewFlag.Dashing, speed: 14 },
  slide: { flags: G | ViewFlag.Sliding | ViewFlag.Crouching, speed: 8 },
  crouch: { flags: G | ViewFlag.Crouching, speed: 0 },
  shoot: { flags: G | ViewFlag.Firing, speed: 0 },
  reload: { flags: G | ViewFlag.Reloading, speed: 0 },
  cast: { flags: C, speed: 0 },
  cast1: { flags: C, speed: 0, castSlot: 0 },
  cast2: { flags: C, speed: 0, castSlot: 1 },
  cast3: { flags: C, speed: 0, castSlot: 2 },
  cast4: { flags: C, speed: 0, castSlot: 3 },
  channel: { flags: G | ViewFlag.Channelling, speed: 0 },
  stun: { flags: G | ViewFlag.Stunned, speed: 0 },
  hit: { flags: G, speed: 0, hit: true },
  dead: { flags: G | ViewFlag.Dead, speed: 0 },
  updraft: { flags: ViewFlag.OnUpdraft, speed: 0, vy: 8 },
  mantle: { flags: ViewFlag.Mantling, speed: 0 },
  climb: { flags: ViewFlag.Climbing, speed: 0, vy: 3 },
  glide: { flags: 0, speed: 9, mode: 'glide' },
  charge: { flags: G | ViewFlag.Meleeing, speed: 0, melee: 'charging' },
  light: { flags: G | ViewFlag.Meleeing, speed: 0, melee: 'light' },
  heavy: { flags: G | ViewFlag.Meleeing, speed: 0, melee: 'heavy' },
  parry: { flags: G, speed: 0, melee: 'parry' },
};

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
const FALL_SPEED = -7;

/**
 * Write what a state shows at time `t` (s) into a stand-in entity; returns whether a hit lands on this `dt` frame
 * and the cast slot. Shared by the lineup, the pose sheets and the attachment tests.
 */
export function applyState(e: Mutable<EntityView> & { vel: Mutable<EntityView['vel']> }, s: StatePose, t: number, dt: number): { hit: boolean; castSlot: number | null } {
  const falling = s.land === true && t % LAND_CYCLE < LAND_CYCLE / 2;
  e.flags = falling ? 0 : s.flags;
  e.mode = s.mode ?? null;
  e.vel.z = s.speed;
  e.vel.y = falling ? FALL_SPEED : (s.vy ?? 0);
  e.pitch = s.pitch ?? 0;
  const repeats = s.melee === 'light' || s.melee === 'heavy';
  e.meleePose = s.melee && (!repeats || t % MELEE_CYCLE < MELEE_CYCLE / 2) ? s.melee : undefined;
  return { hit: s.hit === true && t % HIT_CYCLE < dt, castSlot: s.castSlot ?? null };
}

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
