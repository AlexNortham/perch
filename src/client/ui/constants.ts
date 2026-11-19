/** Presentation constants for the UI (D-EP-009). Colours are GDD §12 / §14. */
import type { Archetype, PlayerTeam } from '../../sim/core/contracts';
import { ALLY_TEAL, DAWN_COLOURS, DUSK_COLOURS, ENEMY_RED } from '../app/palette';

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

/** Shop and inventory (GDD §8.7, §8.8). The sim's Items system is the authority; these only label the previews. */
export const BASE_ITEM_SLOTS = 12;
export const MAX_FLEX_SLOTS = 4;
export const SELL_REFUND_FRACTION = 0.5;
export const FULL_REFUND_FRACTION = 1;
/** Minimap: last-seen enemy ghosts fade over this many seconds (GDD §12.5). */
export const GHOST_FADE_S = 6;
export const MINIMAP_SIZE = { width: 220, height: 254 } as const;
/** Big map height as a share of the screen (GDD §12.5). */
export const BIG_MAP_SCREEN_SHARE = 0.7;
/** Kill feed: lines kept and seconds each is shown (GDD §12.8). */
export const FEED_LINES = 5;
export const FEED_S = 6;
export const FEED_OBJECTIVE_S = 8;
/** World pings last this long (GDD §12.5). */
export const PING_S = 6;
/** Damage numbers drift up this many metres over this many seconds; hits on one target within MERGE_S merge. */
export const DAMAGE_NUMBER_RISE_M = 0.6;
export const DAMAGE_NUMBER_S = 0.8;
export const DAMAGE_NUMBER_MERGE_S = 0.15;
/** Heavy melee hold time to charge (sim/data/combat melee.heavyHoldS) is read from the sim data, not repeated here. */
export const ITEM_CATEGORY_CSS = { talon: '#ff8a3d', plumage: '#4fcf6a', song: '#a97bff' } as const;
export const NUMBER_CSS = { talon: '#ffffff', song: '#c9a6ff', beak: '#ffd24a', weak: '#ff9a2e', shield: '#9aa3ad' } as const;
/** Wedge colours for the ping kinds. */
export const PING_CSS = { attack: '#ff4a4a', take: '#ffd24a', defend: '#3ddcb4', goHere: '#ffffff', danger: '#ff8a3d', onMyWay: '#7fd6ff', retreat: '#b0b0ff', needHelp: '#ff6ab0' } as const;
export const PING_LABEL = { attack: 'Attack', take: 'Take', defend: 'Defend', goHere: 'Go here', danger: 'Danger', onMyWay: 'On my way', retreat: 'Retreat', needHelp: 'Need help' } as const;
export const WHEEL_PINGS = ['danger', 'onMyWay', 'retreat', 'needHelp'] as const;

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

/** Options sliders as [min, max, step]; they match the ranges the settings store clamps to (GDD §4.3, §4.7). */
export const SENSITIVITY_RANGE = [0.1, 5, 0.05] as const;
export const FOV_RANGE = [75, 110, 1] as const;
export const QUALITIES = ['low', 'medium', 'high'] as const;
