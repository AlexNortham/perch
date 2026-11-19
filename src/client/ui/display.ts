/** Pure view-to-display mapping for the HUD (unit tested); no DOM here. */
import type { HeroView } from '../../sim/core/contracts';
import type { AbilitySlotState } from '../../sim/core/contracts/entity';
import { AP_COSTS } from '../../sim/data/abilities';
import { TICK_RATE } from '../../sim/data/core';
import { DECIMAL_COOLDOWN_BELOW_S, DIGIT_PREFIX, KEY_PREFIX, MAX_TIER } from './constants';
import type { HitKind } from './constants';

/** "3" / "0.4" / "" (ready). */
export function cooldownText(remainingS: number): string {
  if (remainingS <= 0) return '';
  return remainingS < DECIMAL_COOLDOWN_BELOW_S ? remainingS.toFixed(1) : String(Math.ceil(remainingS));
}

export interface AbilityDisplay {
  readonly locked: boolean;
  /** Castable right now (unlocked with a charge). */
  readonly ready: boolean;
  readonly cooldown: string;
  /** Share of the cooldown still to run, 0..1 (the sweep). */
  readonly sweep: number;
  /** Charge count to show, or '' for single-charge abilities. */
  readonly charges: string;
  readonly tier: number;
  /** AP is available and this ability can take another tier. */
  readonly canUpgrade: boolean;
}

export function abilityDisplay(slot: Readonly<AbilitySlotState>, maxCharges: number, tick: number, ap: number): AbilityDisplay {
  const remainingTicks = Math.max(0, slot.readyAt - tick);
  const sweep = slot.cooldownTicks > 0 ? Math.min(1, remainingTicks / slot.cooldownTicks) : 0;
  return {
    locked: !slot.unlocked,
    ready: slot.unlocked && slot.charges > 0,
    cooldown: slot.unlocked ? cooldownText(remainingTicks / TICK_RATE) : '',
    sweep: slot.unlocked ? sweep : 0,
    charges: maxCharges > 1 ? String(slot.charges) : '',
    tier: slot.tier,
    canUpgrade: slot.unlocked && slot.tier < MAX_TIER && ap >= (AP_COSTS[slot.tier] ?? Infinity),
  };
}

export const ammoText = (h: Pick<HeroView, 'ammo' | 'magazine'>): string => `${h.ammo} / ${h.magazine}`;

/** Fill 0..1 for each stamina pip (stamina is counted in pips, with a fractional recharging pip). */
export function staminaPips(stamina: number, max: number): number[] {
  return Array.from({ length: Math.max(0, Math.round(max)) }, (_, i) => Math.min(1, Math.max(0, stamina - i)));
}

export interface HealthDisplay {
  readonly text: string;
  /** Segment widths as shares of the bar. */
  readonly hp: number;
  readonly talon: number;
  readonly song: number;
  readonly barrier: number;
}

export function healthDisplay(
  hp: number,
  maxHp: number,
  h: Pick<HeroView, 'talonShield' | 'songShield' | 'barrier'>,
): HealthDisplay {
  const shield = h.talonShield + h.songShield + h.barrier;
  const total = Math.max(1, maxHp, hp + shield);
  return {
    text: `${Math.ceil(hp)} / ${Math.ceil(maxHp)}${shield > 0 ? ` (+${Math.ceil(shield)})` : ''}`,
    hp: Math.max(0, hp) / total,
    talon: h.talonShield / total,
    song: h.songShield / total,
    barrier: h.barrier / total,
  };
}

/** Whole seconds until respawn, or null when alive. */
export const respawnSeconds = (respawnAt: number | null, tick: number): number | null =>
  respawnAt === null ? null : Math.max(0, Math.ceil((respawnAt - tick) / TICK_RATE));

const KEY_NAMES: Readonly<Record<string, string>> = {
  Mouse0: 'LMB',
  Mouse1: 'MMB',
  Mouse2: 'RMB',
  Mouse3: 'M4',
  Mouse4: 'M5',
  ShiftLeft: 'Shift',
  ControlLeft: 'Ctrl',
  AltLeft: 'Alt',
};

/** A KeyboardEvent.code or mouse button as a short key cap label. */
export function keyLabel(code: string): string {
  if (code.startsWith(KEY_PREFIX)) return code.slice(KEY_PREFIX.length);
  if (code.startsWith(DIGIT_PREFIX)) return code.slice(DIGIT_PREFIX.length);
  return KEY_NAMES[code] ?? code;
}

/** Which hit marker a landed hit earns; lethal outranks beak outranks weak point. */
export const hitKind = (e: { lethal: boolean; beakShot: boolean; weakPoint: boolean }): HitKind =>
  e.lethal ? 'lethal' : e.beakShot ? 'beak' : e.weakPoint ? 'weak' : 'normal';
