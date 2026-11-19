import type { ItemDef } from '../core/contracts';
import { PLUMAGE_ITEMS } from './items-plumage';
import { SONG_ITEMS } from './items-song';
import { SONG_BASE_ITEMS } from './items-song-base';
import { TALON_ITEMS, TALON_RIDERS } from './items-talon';

export const SHOP = { baseSlots: 12, refundSeconds: 20, resaleFraction: 0.5 } as const;
export const DEW = { quietSeconds: 8, bonusRegen: 10 } as const;
export { CLUTCH, DEW_BONUS, ITEM_SHIELDS } from './items-plumage';
export const ITEM_RIDERS = TALON_RIDERS;

export const ITEMS: readonly ItemDef[] = [...TALON_ITEMS, ...PLUMAGE_ITEMS, ...SONG_BASE_ITEMS, ...SONG_ITEMS];
