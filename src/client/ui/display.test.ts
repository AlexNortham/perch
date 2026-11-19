import { describe, expect, it } from 'vitest';
import { abilityDisplay, ammoText, cooldownText, healthDisplay, hitKind, keyLabel, respawnSeconds, staminaPips } from './display';

const slot = (over: Partial<Parameters<typeof abilityDisplay>[0]> = {}): Parameters<typeof abilityDisplay>[0] => ({
  ability: 'a',
  unlocked: true,
  tier: 0,
  readyAt: 0,
  cooldownTicks: 600,
  charges: 1,
  ...over,
});

describe('HUD display mapping', () => {
  it('formats cooldowns: ceil above 10 s, one decimal below, blank when ready', () => {
    expect(cooldownText(0)).toBe('');
    expect(cooldownText(12.2)).toBe('13');
    expect(cooldownText(9.96)).toBe('10.0');
    expect(cooldownText(0.4)).toBe('0.4');
  });

  it('ability on cooldown: text, sweep, not ready', () => {
    const d = abilityDisplay(slot({ readyAt: 360, charges: 0 }), 1, 60, 0);
    expect(d).toMatchObject({ cooldown: '5.0', ready: false, locked: false, charges: '' });
    expect(d.sweep).toBeCloseTo(0.5);
  });

  it('a locked ultimate shows locked with no cooldown and cannot be upgraded', () => {
    const d = abilityDisplay(slot({ unlocked: false, charges: 0, readyAt: 999 }), 1, 0, 3);
    expect(d).toMatchObject({ locked: true, ready: false, cooldown: '', sweep: 0, canUpgrade: false });
  });

  it('charges show only for multi-charge abilities; ready while one remains', () => {
    const d = abilityDisplay(slot({ charges: 2, readyAt: 300 }), 3, 0, 0);
    expect(d).toMatchObject({ charges: '2', ready: true });
  });

  it('upgrade availability needs AP and a tier below 3', () => {
    expect(abilityDisplay(slot({ tier: 2 }), 1, 0, 1).canUpgrade).toBe(true);
    expect(abilityDisplay(slot({ tier: 3 }), 1, 0, 1).canUpgrade).toBe(false);
    expect(abilityDisplay(slot(), 1, 0, 0).canUpgrade).toBe(false);
  });

  it('ammo, stamina pips, health, respawn, keys', () => {
    expect(ammoText({ ammo: 7, magazine: 24 })).toBe('7 / 24');
    expect(staminaPips(1.5, 3)).toEqual([1, 0.5, 0]);
    expect(staminaPips(3, 3)).toEqual([1, 1, 1]);
    const h = healthDisplay(642, 820, { talonShield: 60, songShield: 60, barrier: 0 });
    expect(h.text).toBe('642 / 820 (+120)');
    expect(h.hp + h.talon + h.song).toBeCloseTo(762 / 820);
    expect(respawnSeconds(null, 100)).toBeNull();
    expect(respawnSeconds(700, 100)).toBe(10);
    expect(keyLabel('Digit2')).toBe('2');
    expect(keyLabel('KeyZ')).toBe('Z');
    expect(keyLabel('Mouse0')).toBe('LMB');
  });

  it('hit markers: lethal over beak over weak point over plain', () => {
    const base = { lethal: false, beakShot: false, weakPoint: false };
    expect(hitKind(base)).toBe('normal');
    expect(hitKind({ ...base, beakShot: true })).toBe('beak');
    expect(hitKind({ ...base, beakShot: true, lethal: true })).toBe('lethal');
    expect(hitKind({ ...base, weakPoint: true })).toBe('weak');
  });
});
