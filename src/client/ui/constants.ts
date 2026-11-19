/** Presentation constants for the UI (D-EP-009). Colours are GDD §12 / §14. */
import type { Archetype, PlayerTeam } from '../../sim/core/contracts';
import { ALLY_TEAL, DAWN_COLOURS, DUSK_COLOURS, ENEMY_RED } from '../render/palette';

export const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;

export const TEAM_CSS: Readonly<Record<PlayerTeam, string>> = { dawn: hex(DAWN_COLOURS.primary), dusk: hex(DUSK_COLOURS.primary) };
export const ENEMY_CSS = hex(ENEMY_RED);
export const ALLY_CSS = hex(ALLY_TEAL);

/** Panel and text colours (GDD §12). */
export const PANEL_BG = 'rgba(12,14,18,0.78)';
export const TEXT = '#f4efe6';
export const TEXT_DIM = 'rgba(244,239,230,0.6)';
export const HEALTH_CSS = '#4fcf6a';
export const TALON_CSS = '#ff8a3d';
export const SONG_CSS = '#a97bff';
export const BARRIER_CSS = '#9aa3ad';
export const BEAK_CSS = '#ffd24a';
export const STAMINA_CSS = '#7fd6ff';
export const SEEDS_CSS = '#f2d46b';

/** Hit marker lifetime (ms), scale and colour per kind: beak shots hit harder than body shots. */
export const HIT_MARKER = {
  normal: { ms: 220, scale: 1, colour: '#ffffff' },
  beak: { ms: 360, scale: 1.7, colour: BEAK_CSS },
  weak: { ms: 360, scale: 1.5, colour: '#ff9a2e' },
  lethal: { ms: 420, scale: 1.7, colour: ENEMY_CSS },
} as const;
export type HitKind = keyof typeof HIT_MARKER;

/** Pod "secured" / "denied" banner lifetime (ms). */
export const POD_BANNER_MS = 1400;
/** Cooldowns under this many seconds show a decimal. */
export const DECIMAL_COOLDOWN_BELOW_S = 10;
/** Upgrade tiers per ability (GDD §6). */
export const MAX_TIER = 3;

export const ARCHETYPE_LABEL: Readonly<Record<Archetype, string>> = {
  gunCarry: 'Gun Carry',
  songBurst: 'Song Burst',
  tank: 'Tank',
  support: 'Support',
  assassin: 'Assassin',
  areaControl: 'Area Control',
  poke: 'Poke',
  skirmisher: 'Skirmisher',
};

/** Hero select swatch: hue steps round the colour wheel by hero index (heroes carry no colour in data yet). */
export const HERO_SWATCH_STEP_DEG = 15;
export const HERO_SWATCH_SATURATION_LIGHTNESS = '60% 55%';
