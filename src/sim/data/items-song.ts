// The 17 Song items beyond the Stage 3 shop (GDD §10.3), typed as ItemDef. data/items.ts spreads SONG_ITEMS into ITEMS.
// Effects that data can't say (Crescendo, Echo Chamber's repeat, Boundless Song's ultimate cooldown) live in
// sim/items/song and are keyed by the item ids below.
import type { ItemActive, ItemDef, ItemTier, StatId, StatModifier, StatOp, StatusDef, TriggerDef } from '../core/contracts';
import { DISARM, GROUNDED, HEAL_REDUCTION, SILENCE, SLOW, SONG_SHRED } from './combat';

const COST = { 1: 800, 2: 1600, 3: 3200, 4: 6400 } as const;
const stat = (id: StatId, value: number, op: StatOp = 'add'): StatModifier => ({ stat: id, op, value });
const song = (id: string, name: string, description: string, tier: ItemTier, stats: StatModifier[],
  extra: { component?: string; active?: ItemActive; procs?: TriggerDef[]; aura?: ItemDef['aura'] } = {}): ItemDef => ({
  id, name, description, category: 'song', tier, cost: COST[tier], component: extra.component ?? null,
  passive: { stats }, procs: extra.procs ?? [], active: extra.active ?? null, ...(extra.aura ? { aura: extra.aura } : {}),
});

/** Knock-up height for 0.75 s in the air: h = g (t/2)² / 2 with gravity 25 m/s². */
const WHIRL_KNOCK_UP_M = 1.758;
/** Auras last until sale or death; the item system ends them. */
const AURA_S = 36_000;
/** The enemy hero nearest the crosshair within range (the 6° cone is the engine's unit pick). */
const PICK_ENEMY_HERO = { teams: 'enemies', heroesOnly: true } as const;

/** Ability damage to a hero lands on the other party of an 'abilityHit' trigger. */
const onAbilityHit = (effects: TriggerDef['effects']): TriggerDef =>
  ({ on: 'abilityHit', heroesOnly: true, chance: 1, cooldownS: 0, target: 'other', effects });

const healCut = (magnitude: number, durationS: number) =>
  ({ kind: 'applyStatus', status: HEAL_REDUCTION, magnitude, durationS }) as const;

const BLIGHT: StatusDef = {
  id: 'blight', name: 'Blight', negative: true, stacking: 'perSource', maxStacks: 1, durationS: 4,
  periodic: { intervalS: 1, effects: [{ kind: 'damage', amount: { of: 0, song: 0.06 }, currentHpPct: 0.03, type: 'song' }] },
};

/** After a cast: the next `uses` gun hits on a hero within `windowS` deal Song damage (Warbler's Trill, Skylark Cadence). */
const afterCast = (uses: number, windowS: number, base: number, k: number, slow = 0): TriggerDef => ({
  on: 'cast', chance: 1, cooldownS: 0, target: 'self', effects: [{
    kind: 'trigger', durationS: windowS, trigger: {
      on: 'weaponHit', heroesOnly: true, chance: 1, cooldownS: 0, target: 'other', uses,
      effects: [{ kind: 'damage', amount: { of: base, song: k }, type: 'song' },
        ...(slow > 0 ? [{ kind: 'applyStatus', status: SLOW, magnitude: slow, durationS: 1 } as const] : [])],
    },
  }],
});

export const SONG_ITEMS: readonly ItemDef[] = [
  song('nettle-sting', 'Nettle Sting', '+6 Song power. Your ability damage to heroes applies 25% heal reduction for 3 s.', 1,
    [stat('songPower', 6)], { procs: [onAbilityHit([healCut(0.25, 3)])] }),
  song('warblers-trill', 'Warbler’s Trill', '+6 Song power and +4% fire rate. After you cast an ability, your next gun shot within 5 s that hits a hero deals +25 + 0.6×SP Song damage.', 1,
    [stat('songPower', 6), stat('fireRate', 0.04)], { procs: [afterCast(1, 5, 25, 0.6)] }),
  song('second-verse', 'Second Verse', '+1 charge for every ability that has charges, +6% cooldown reduction and +4 Song power.', 2,
    [stat('abilityCharges', 1), stat('cooldownReduction', 0.06, 'stack'), stat('songPower', 4)]),
  song('crescendo', 'Crescendo', '+12 Song power. Ability hits dealing 100 or more Song damage deal +20%.', 2, [stat('songPower', 12)]),
  song('muting-whistle', 'Muting Whistle', '+8 Song power. Activate to silence the enemy hero nearest the crosshair within 25 m for 2.25 s. Cooldown 45 s.', 2,
    [stat('songPower', 8)], { active: { cooldownS: 45, targeting: 'unit', range: 25, affects: PICK_ENEMY_HERO,
      effects: [{ kind: 'applyStatus', status: SILENCE, durationS: 2.25 }] } }),
  song('long-chorus', 'Long Chorus', '+20% duration of your abilities’ statuses, areas and buffs, and +8 Song power.', 2,
    [stat('abilityDuration', 0.2), stat('songPower', 8)]),
  song('tangle-pod', 'Tangle Pod', '+8 Song power and +75 max HP. Activate to lob a pod up to 25 m that bursts in a 4 m radius: 70 + 0.8×SP Song damage, 35% slow and grounded for 2 s. Cooldown 35 s.', 2,
    [stat('songPower', 8), stat('maxHealth', 75)], { active: { cooldownS: 35, targeting: 'point', range: 25, effects: [{
      kind: 'delay', seconds: 0.6, effects: [{ kind: 'area', shape: { kind: 'sphere', radius: 4 }, durationS: 0, attach: 'point',
        affects: { teams: 'enemies' }, effects: [{ kind: 'damage', amount: { of: 70, song: 0.8 }, type: 'song' },
          { kind: 'applyStatus', status: SLOW, magnitude: 0.35, durationS: 2 }, { kind: 'applyStatus', status: GROUNDED, durationS: 2 }] }] }] } }),
  song('tempo-shift', 'Tempo Shift', '+18% cooldown reduction and +8 Song power.', 3,
    [stat('cooldownReduction', 0.18, 'stack'), stat('songPower', 8)], { component: 'quick-refrain' }),
  song('song-siphon', 'Song Siphon', '18% Song lifesteal and +10 Song power.', 3, [stat('songLifesteal', 0.18), stat('songPower', 10)]),
  song('whirlwind-knot', 'Whirlwind Knot', '+10 Song power and +100 max HP. Activate to knock up enemies within 6 m for 0.75 s and deal 90 + 0.6×SP Song damage. Cooldown 35 s.', 3,
    [stat('songPower', 10), stat('maxHealth', 100)], { active: { cooldownS: 35, targeting: 'self', range: 0, effects: [{
      kind: 'area', shape: { kind: 'sphere', radius: 6 }, durationS: 0, attach: 'point', affects: { teams: 'enemies' },
      effects: [{ kind: 'damage', amount: { of: 90, song: 0.6 }, type: 'song' }, { kind: 'displace', mode: 'up', distance: WHIRL_KNOCK_UP_M }] }] } }),
  song('blight-spores', 'Blight Spores', '+14 Song power. Your ability damage to heroes applies 40% heal reduction for 4 s and Blight: Song damage of 3% of the target’s current HP + 0.06×SP per second for 4 s.', 3,
    [stat('songPower', 14)], { component: 'nettle-sting', procs: [onAbilityHit([healCut(0.4, 4), { kind: 'applyStatus', status: BLIGHT }])] }),
  song('encore', 'Encore', '+15 Song power and +10% cooldown reduction. Activate to reset the cooldowns of abilities 1–4 (not items). Cooldown 150 s.', 4,
    [stat('songPower', 15), stat('cooldownReduction', 0.1, 'stack')], { active: { cooldownS: 150, targeting: 'self', range: 0,
      effects: [{ kind: 'cooldownMod', scope: 'abilities', mode: 'reset' }] } }),
  song('gloom-curse', 'Gloom Curse', '+18 Song power. Activate to silence, disarm and slow 30% the enemy hero nearest the crosshair within 25 m for 2.5 s. Cooldown 60 s.', 4,
    [stat('songPower', 18)], { component: 'muting-whistle', active: { cooldownS: 60, targeting: 'unit', range: 25, affects: PICK_ENEMY_HERO,
      effects: [{ kind: 'applyStatus', status: SILENCE, durationS: 2.5 }, { kind: 'applyStatus', status: DISARM, durationS: 2.5 },
        { kind: 'applyStatus', status: SLOW, magnitude: 0.3, durationS: 2.5 }] } }),
  song('boundless-song', 'Boundless Song', '+40 Song power, +20% ability range and −20% ultimate cooldown.', 4,
    [stat('songPower', 40), stat('abilityRange', 0.2)], { component: 'carrying-voice' }),
  song('echo-chamber', 'Echo Chamber', '+20 Song power. Ability damage to heroes repeats 1.0 s later at 25%, and shreds Song resist by 14% for 6 s.', 4,
    [stat('songPower', 20)], { component: 'mocking-note', procs: [onAbilityHit([{ kind: 'applyStatus', status: SONG_SHRED, magnitude: 0.14, durationS: 6 }])] }),
  song('skylark-cadence', 'Skylark Cadence', '+24 Song power, +10% fire rate and +10% cooldown reduction. After you cast an ability, your next 3 gun hits on heroes within 6 s each deal +45 + 0.8×SP Song damage and slow 20% for 1 s.', 4,
    [stat('songPower', 24), stat('fireRate', 0.1), stat('cooldownReduction', 0.1, 'stack')], { component: 'warblers-trill', procs: [afterCast(3, 6, 45, 0.8, 0.2)] }),
  song('rookery-dirge', 'Rookery Dirge', '+20 Song power, +300 max HP and +10% Song resist. Aura 12 m: enemy heroes inside take Song damage of 1.5% of their max HP + 0.05×SP per second and have −8% Song resist.', 4,
    [stat('songPower', 20), stat('maxHealth', 300), stat('songResist', 0.1, 'stack')], { aura: {
      kind: 'area', shape: { kind: 'sphere', radius: 12 }, durationS: AURA_S, intervalS: 1, attach: 'source', affects: { teams: 'enemies', heroesOnly: true },
      effects: [{ kind: 'damage', amount: { of: 0, song: 0.05 }, maxHpPct: 0.015, type: 'song' },
        // A statMod, renewed each second: an applied SONG_SHRED is 'independent', and the overlap doubled it.
        { kind: 'statMod', id: 'rookery-dirge', name: 'Rookery Dirge', durationS: 1.5, stats: [stat('songShred', 0.08)] }] } }),
];
