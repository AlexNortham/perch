/**
 * Combat tuning (GDD §5, §8.9) and the shared statuses (GDD §5.9). Owner: Combat (Balance & Data from W7).
 * Units: metres, seconds; fractions where 0.25 means 25%.
 */
import type { Condition, StatId, StatusDef } from '../core/contracts';

export const COMBAT = {
  /** GDD §5.4: default beak-shot multiplier (WeaponDef.beakShotMult overrides it, Owl ×2.0). */
  beakShotMult: 1.65,
  /** Damage effects flagged `beakShot` (Owl's Moonlit Mark, GDD §9.5) multiply by this on the head. */
  abilityBeakShotMult: 1.5,
  /** GDD §5.5: damage beyond falloff end. */
  falloffFloor: 0.25,
  /** GDD §5.6: projectile gun bullets' collision radius. */
  gunProjectileRadius: 0.06,
  /** GDD §5.6: spread multipliers while airborne and while aiming (RMB). */
  spreadAirborneMult: 1.3,
  spreadAimMult: 0.75,
  /** GDD §9.2: shell-loaders start loading after this delay, then load one round every reloadS. */
  perRoundStartS: 0.3,
  /** GDD §5.3: final resist clamp. */
  resistMin: -0.5,
  resistMax: 0.85,
  /** GDD §5.2 step 5: incoming amplification cap. */
  ampCap: 0.5,
  /** GDD §5.9: status resist cap. */
  statusResistCap: 0.6,
  /** GDD §7: structures take 50% melee, 50% Song, nothing from areas or damage over time; weak point ×1.5. */
  structureMeleeMult: 0.5,
  structureSongMult: 0.5,
  weakPointMult: 1.5,
  /** GDD §5.2 step 9: lifesteal from non-hero targets is 50% effective. */
  lifestealNonHeroMult: 0.5,
  /** GDD §5.12: DoTs, heals over time and areas tick this often. */
  tickIntervalS: 0.5,
  /** GDD §5.13: in combat for this long after dealing or taking hero damage, firing, or casting a damaging ability. */
  combatStateS: 4,
  /** INTERFACES §6: assist window. */
  assistWindowS: 12,
  /** GDD §8.9: respawn = min(maxS, baseS + perMinuteS × minutes), rounded to roundS, × emberMult with the Ember. */
  respawn: { baseS: 8, perMinuteS: 1.2, maxS: 55, roundS: 0.1, emberMult: 0.5 },
  /** GDD §10 (Skipping Stone): a bounce jumps to the nearest other enemy within radius for `fraction` damage. */
  bounce: { radius: 8, fraction: 0.45 },
  /**
   * Hitbox broad phase: ctx.spatial holds feet positions, so queries are padded by this much to reach heads and the
   * top of tall units. Units taller than this can be missed near the ends of a ray.
   */
  hitboxQueryPad: 6,
  /** GDD §5.7. Light damage is the meleeDamage stat (lightDamage if the hero data has none); heavy = light × mult + flat. */
  melee: {
    heavyHoldS: 0.35,
    lightHitS: 0.25,
    lightTotalS: 0.55,
    lightDamage: 50,
    heavyWindupS: 0.6,
    heavyRecoveryS: 0.4,
    heavyMult: 2,
    heavyFlat: 15,
    heavyLungeM: 3.5,
    heavyKnockbackM: 3,
    reachM: 2.8,
    radiusM: 1.2,
  },
  /** GDD §5.8. */
  parry: { delayS: 0.05, windowS: 0.6, stunS: 2, whiffLockoutS: 0.4, cooldownS: 5 },
  /** GDD §5.9: unstoppable blocks (and removes on gain) statuses that carry any of these. */
  unstoppableBlocks: {
    conditions: ['stunned', 'silenced', 'disarmed', 'rooted', 'grounded'] as readonly Condition[],
    stats: ['slow'] as readonly StatId[],
  },
} as const;

/** Shared statuses (GDD §5.9). Graded ones are written for magnitude 1: apply a 30% slow with magnitude 0.3. */
const onOff = (id: string, name: string, negative: boolean, durationS: number, conditions: readonly Condition[]): StatusDef => ({
  id,
  name,
  negative,
  stacking: 'max',
  maxStacks: 1,
  durationS,
  modifiers: { conditions },
});

const graded = (id: string, name: string, durationS: number, stats: readonly StatId[], op: 'max' | 'add'): StatusDef => ({
  id,
  name,
  negative: true,
  stacking: 'independent',
  maxStacks: 1,
  durationS,
  modifiers: { stats: stats.map((stat) => ({ stat, op, value: 1 })) },
});

/** Damage over time: apply with magnitude = damage per second; it ticks every tickIntervalS, per source. */
const dot = (id: string, name: string, type: 'talon' | 'song'): StatusDef => ({
  id,
  name,
  negative: true,
  stacking: 'perSource',
  maxStacks: 1,
  durationS: 4,
  periodic: { intervalS: COMBAT.tickIntervalS, effects: [{ kind: 'damage', amount: COMBAT.tickIntervalS, type }] },
});

export const STUN = onOff('stun', 'Stunned', true, 1, ['stunned']);
export const SILENCE = onOff('silence', 'Silenced', true, 2, ['silenced']);
export const DISARM = onOff('disarm', 'Disarmed', true, 1.5, ['disarmed']);
export const ROOT = onOff('root', 'Rooted', true, 1, ['rooted']);
export const GROUNDED = onOff('grounded', 'Grounded', true, 2, ['grounded']);
export const REVEAL = onOff('reveal', 'Revealed', true, 5, ['revealed']);
export const TRUE_SIGHT = onOff('trueSight', 'True sight', false, 6, ['trueSight']);
export const INVISIBILITY: StatusDef = { ...onOff('invisible', 'Invisible', false, 5, ['invisible']), endsOnAttack: true };
export const UNSTOPPABLE = onOff('unstoppable', 'Unstoppable', false, 2, ['unstoppable']);
export const INTANGIBLE = onOff('intangible', 'Intangible', false, 1, ['intangible']);
export const UNDYING = onOff('undying', 'Undying', false, 3, ['undying']);
/** Pelican's Gulp: carried in the pouch, stunned and intangible. */
export const CARRIED = onOff('carried', 'Carried', true, 1, ['stunned', 'intangible']);
/** The Golden Egg: world applies it on pick-up and cleanses it by id on drop (GDD §7.11). */
export const EGG_CARRIER: StatusDef = {
  id: 'eggCarrier',
  name: 'Egg carrier',
  negative: false,
  stacking: 'max',
  maxStacks: 1,
  durationS: 3600,
  modifiers: { conditions: ['eggCarrier', 'revealed'], stats: [{ stat: 'moveSpeed', op: 'pct', value: -0.15 }] },
};

export const SLOW = graded('slow', 'Slowed', 2, ['slow'], 'max');
export const FIRE_RATE_SLOW = graded('fireRateSlow', 'Fire rate slowed', 3, ['fireRateSlow'], 'max');
export const HEAL_REDUCTION = graded('healReduction', 'Heal reduction', 5, ['healReduction'], 'max');
export const DAMAGE_AMP = graded('damageAmp', 'Damage amp', 4, ['talonAmp', 'songAmp'], 'add');
export const TALON_AMP = graded('talonAmp', 'Talon damage amp', 4, ['talonAmp'], 'add');
export const SONG_AMP = graded('songAmp', 'Song damage amp', 4, ['songAmp'], 'add');
export const TALON_SHRED = graded('talonShred', 'Talon resist shred', 6, ['talonShred'], 'add');
export const SONG_SHRED = graded('songShred', 'Song resist shred', 6, ['songShred'], 'add');
export const BLEED = dot('bleed', 'Bleeding', 'talon');
export const BURN = dot('burn', 'Burning', 'song');
