/** Three real GDD kits as data only (see fixtures.test.ts; a testkit, linted like a test), shared by its tests and the abilities perf test. */
import { Button } from '../core/contracts';
import type { AbilityDef, Effect, HeroId, HeroModule, Magnitude, StatusDef, TargetFilter } from '../core/contracts';
import { HEROES } from '../heroes/registry';
import { onCaster } from './kit';

// ── Shared fixture statuses (combat's data/combat.ts will own the real ones) ─────────────────────────────────────

export const on = (id: string, negative: boolean, conditions: StatusDef['modifiers']): StatusDef => ({
  id,
  name: id,
  negative,
  stacking: 'max',
  maxStacks: 1,
  durationS: 1,
  modifiers: conditions,
});
export const ROOT = on('root', true, { conditions: ['rooted'] });
export const REVEAL = on('reveal', true, { conditions: ['revealed'] });
export const GROUNDED = on('grounded', true, { conditions: ['grounded'] });
export const DISARM = on('disarm', true, { conditions: ['disarmed'] });
export const SILENCE = on('silence', true, { conditions: ['silenced'] });
export const INVISIBLE: StatusDef = { ...on('invisible', false, { conditions: ['invisible'] }), endsOnAttack: true };
export const graded = (id: string, stat: 'slow' | 'healReduction' | 'songAmp', op: 'max' | 'add'): StatusDef => ({
  ...on(id, true, { stats: [{ stat, op, value: 1 }] }),
  stacking: 'independent',
});
export const SLOW = graded('slow', 'slow', 'max');
export const HEAL_CUT = graded('healReduction', 'healReduction', 'max');
export const SONG_AMP = graded('songAmp', 'songAmp', 'add');
export const DAMAGE_AMP: StatusDef = {
  ...on('damageAmp', true, { stats: [{ stat: 'talonAmp', op: 'add', value: 1 }, { stat: 'songAmp', op: 'add', value: 1 }] }),
  stacking: 'independent',
};

export const ENEMIES: TargetFilter = { teams: 'enemies' };
export const ENEMY_HEROES: TargetFilter = { teams: 'enemies', heroesOnly: true };
export const ALLY_HEROES: TargetFilter = { teams: 'allies', self: true, heroesOnly: true };
/** "base + k×SP" Song damage. */
export const song = (of: number | string, k: number): Effect => ({ kind: 'damage', amount: { of, song: k }, type: 'song' });
export const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
export const burst = (radius: Magnitude, affects: TargetFilter, effects: readonly Effect[]): Effect => ({
  kind: 'area',
  shape: { kind: 'sphere', radius },
  durationS: 0,
  attach: 'point',
  affects,
  effects,
});
/** Area ticks are 0.5 s, so per-second numbers are halved per tick (GDD §5.12). */
export const zone = (radius: Magnitude, durationS: Magnitude, affects: TargetFilter, effects: readonly Effect[]): Effect => ({
  kind: 'area',
  shape: { kind: 'cylinder', radius, height: 4 },
  durationS,
  attach: 'point',
  affects,
  effects,
});
export const base = { castS: 0, channelS: 0, charges: 1, hook: false } as const;
export const module = (from: HeroId, abilities: readonly AbilityDef[], hooks?: HeroModule['hooks']): HeroModule => ({
  def: { ...HEROES[from].def, abilities: abilities as [AbilityDef, AbilityDef, AbilityDef, AbilityDef] },
  hooks,
});

// ── Shrike (GDD §9.1) ────────────────────────────────────────────────────────────────────────────────────────

export const shrike = module('shrike', [
  {
    ...base,
    id: 'shrike.thornLarder',
    name: 'Thorn Larder',
    description: 'Hidden ground trap that roots and reveals.',
    targeting: 'point',
    range: 20,
    cooldownS: 14,
    charges: 2,
    values: { damage: 80, root: 1, burst: 1.5 },
    effects: [
      {
        kind: 'delay',
        seconds: 0.75,
        effects: [
          {
            kind: 'summon',
            summon: 'trap',
            health: 0,
            durationS: 60,
            maxCount: 4,
            behaviour: 'trap',
            trigger: { radius: 1.5, affects: ENEMY_HEROES },
            effects: [burst('burst', ENEMY_HEROES, [song('damage', 0.9), apply(ROOT, 'root'), apply(REVEAL, 4)])],
          },
        ],
      },
    ],
    upgrades: [
      { description: '+1 charge', charges: 1 },
      { description: 'Root 1.5 s', values: { root: 0.5 } },
      { description: 'Trigger bursts in a 4 m radius', values: { burst: 2.5 } },
    ],
  },
  {
    ...base,
    id: 'shrike.briarPatch',
    name: 'Briar Patch',
    description: 'Damaging, slowing zone.',
    targeting: 'point',
    range: 25,
    cooldownS: 18,
    values: { radius: 5 },
    effects: [zone('radius', 6, ENEMIES, [song(12.5, 0.15), apply(SLOW, 0.6, 0.3)])],
    upgrades: [
      { description: '+1.5 m radius', values: { radius: 1.5 } },
      { description: '−4 s CD', cooldownS: -4 },
      // A tier that adds to a lasting zone appends a parallel zone with the same size.
      { description: 'Grounded and +15% Song damage taken', effects: [zone('radius', 6, ENEMIES, [apply(GROUNDED, 0.6), apply(SONG_AMP, 0.6, 0.15)])] },
    ],
  },
  {
    ...base,
    id: 'shrike.impalingBolt',
    name: 'Impaling Bolt',
    description: 'Knockback skillshot; stuns on wall pin.',
    targeting: 'direction',
    range: 35,
    cooldownS: 16,
    values: { damage: 70, pinStun: 1.25 },
    effects: [
      {
        kind: 'projectile',
        speed: 70,
        radius: 0.4,
        range: 35,
        gravity: 0,
        pierce: 'none',
        affects: ENEMY_HEROES,
        // gap: the wall pin needs DisplaceEffect.onWall; until then a hook checks it.
        onHit: [song('damage', 0.8), { kind: 'displace', mode: 'along', distance: 6 }, { kind: 'hook', name: 'boltPin' }],
      },
    ],
    upgrades: [
      { description: '+30 damage', values: { damage: 30 } },
      { description: '−4 s CD', cooldownS: -4 },
      // gap: "pierces all heroes" changes a field of the base projectile; tiers can only add.
      { description: 'Pin stun 2.0 s', values: { pinStun: 0.75 } },
    ],
  },
  {
    ...base,
    id: 'shrike.butchersRing',
    name: "Butcher's Ring",
    description: 'Thorn ring that roots and damages heroes who cross it.',
    targeting: 'point',
    range: 25,
    cooldownS: 110,
    values: { duration: 6 },
    effects: [
      {
        kind: 'delay',
        seconds: 0.8,
        effects: [
          {
            kind: 'area',
            shape: { kind: 'ring', inner: 8.75, outer: 9.25, height: 3 },
            durationS: 'duration',
            intervalS: 1.5,
            attach: 'point',
            affects: ENEMY_HEROES,
            effects: [],
            onCross: [song(150, 1.4), apply(ROOT, 1.25)],
          },
          zone(9, 'duration', ENEMIES, [apply(HEAL_CUT, 0.6, 0.4)]),
        ],
      },
    ],
    upgrades: [
      { description: '+2 s duration', values: { duration: 2 } },
      { description: '−25 s CD', cooldownS: -25 },
      { description: '30 + 0.3×SP per second inside', effects: [{ kind: 'delay', seconds: 0.8, effects: [zone(9, 'duration', ENEMIES, [song(15, 0.15)])] }] },
    ],
  },
], () => ({ onEffect: () => undefined }));

// ── Lyrebird (GDD §9.4) ──────────────────────────────────────────────────────────────────────────────────────

export const CHORUS: StatusDef = { ...on('lyrebird.chorus', false, { stats: [{ stat: 'slow', op: 'max', value: 0.4 }], conditions: ['disarmed'] }), durationS: 5 };
export const lyrebird = module('lyrebird', [
  {
    ...base,
    id: 'lyrebird.mendedSong',
    name: 'Mended Song',
    description: 'Targeted heal.',
    targeting: 'unit',
    affects: ALLY_HEROES,
    range: 30,
    cooldownS: 13,
    charges: 2,
    values: { heal: 100 },
    effects: [{ kind: 'heal', amount: { of: 'heal', song: 1 } }, { kind: 'heal', amount: { of: 50, song: 0.4 }, overS: 4 }],
    upgrades: [
      { description: '+40 instant heal', values: { heal: 40 } },
      { description: '+15% Talon resist for 4 s', effects: [{ kind: 'statMod', id: 'lyrebird.mend', name: 'Mended', stats: [{ stat: 'talonResist', op: 'stack', value: 0.15 }], durationS: 4 }] },
      { description: 'Cleanses negative statuses', effects: [{ kind: 'cleanse', remove: 'negative' }] },
    ],
  },
  {
    ...base,
    id: 'lyrebird.echoDouble',
    name: 'Echo Double',
    description: 'Running decoy that shoots.',
    targeting: 'self',
    range: 0,
    cooldownS: 22,
    values: { hp: 150, shot: 4.8 },
    effects: [
      {
        kind: 'summon',
        summon: 'decoy',
        health: { of: 'hp', song: 1 },
        durationS: 6,
        maxCount: 2,
        behaviour: 'decoy',
        trigger: { radius: 25, affects: ENEMIES },
        effects: [{ kind: 'damage', amount: 'shot', type: 'talon' }],
      },
      apply(INVISIBLE, 2),
    ],
    upgrades: [
      { description: 'Decoy HP +150', values: { hp: 150 } },
      // gap: the ±15° spread of two decoys needs a direction offset on SummonEffect.
      { description: '2 decoys' },
      // gap: death or expiry bursts need summon end effects (or a hook on entity.died).
      { description: 'Decoys burst on death or expiry' },
    ],
  },
  {
    ...base,
    id: 'lyrebird.discord',
    name: 'Discord',
    description: 'Area disarm.',
    targeting: 'point',
    range: 25,
    cooldownS: 18,
    values: { radius: 6, disarm: 1.5 },
    effects: [burst('radius', ENEMIES, [song(70, 0.7), apply(DISARM, 'disarm')])],
    upgrades: [
      { description: '+1.5 m radius', values: { radius: 1.5 } },
      { description: 'Disarm +0.75 s', values: { disarm: 0.75 } },
      { description: '+20% damage taken for 4 s', effects: [burst('radius', ENEMIES, [apply(DAMAGE_AMP, 4, 0.2)])] },
    ],
  },
  {
    ...base,
    id: 'lyrebird.grandChorus',
    name: 'Grand Chorus',
    description: 'Channelled heal-and-resist aura.',
    targeting: 'self',
    range: 14,
    cooldownS: 120,
    channelS: 5,
    channelIntervalS: 1,
    values: { radius: 14 },
    effects: [apply(CHORUS, 5)],
    channelEffects: [
      {
        kind: 'area',
        shape: { kind: 'sphere', radius: 'radius' },
        durationS: 0,
        attach: 'source',
        affects: ALLY_HEROES,
        effects: [
          { kind: 'heal', amount: { of: 45, song: 0.4 } },
          { kind: 'statMod', id: 'lyrebird.chorusResist', name: 'Chorus', stats: [{ stat: 'talonResist', op: 'stack', value: 0.2 }, { stat: 'songResist', op: 'stack', value: 0.2 }], durationS: 1.1 },
        ],
      },
      { kind: 'area', shape: { kind: 'sphere', radius: 'radius' }, durationS: 0, attach: 'source', affects: ENEMIES, effects: [apply(SLOW, 1.1, 0.2)] },
    ],
    upgrades: [
      { description: '+4 m radius', values: { radius: 4 } },
      {
        description: 'Allies also get +15% fire rate',
        effects: [{ kind: 'area', shape: { kind: 'sphere', radius: 'radius' }, durationS: 5, attach: 'source', affects: ALLY_HEROES, effects: [{ kind: 'statMod', id: 'lyrebird.chorusRate', name: 'Chorus', stats: [{ stat: 'fireRate', op: 'add', value: 0.15 }], durationS: 0.6 }] }],
      },
      // Tiers only add, so T3 lifts the base channel penalty by cleansing it right after it lands.
      { description: 'Shoot and move at full speed while channelling', effects: [{ kind: 'cleanse', remove: [CHORUS.id] }] },
    ],
  },
]);

// ── Kingfisher (GDD §9.3) ────────────────────────────────────────────────────────────────────────────────────

export const BLEED: StatusDef = {
  ...on('kingfisher.bleed', true, undefined),
  stacking: 'perSource',
  durationS: 4,
  periodic: { intervalS: 0.5, effects: [song(7.5, 0.075)] },
};
export const AMBUSH: Effect = { kind: 'statMod', id: 'kingfisher.ambush', name: 'Ambush', stats: [{ stat: 'gunDamage', op: 'add', value: 0.4 }, { stat: 'songDamage', op: 'add', value: 0.4 }], durationS: 1.5 };
export const GLINT: StatusDef = {
  ...on('kingfisher.glint', false, { conditions: ['invisible'], stats: [{ stat: 'moveSpeed', op: 'pct', value: 0.25 }] }),
  endsOnAttack: true,
  // Value-gated: the silence trigger lasts 'silenceWindow' seconds, 0 until T3.
  onExpire: [
    AMBUSH,
    { kind: 'trigger', durationS: 'silenceWindow', trigger: { on: 'weaponHit', chance: 1, cooldownS: 0, target: 'other', effects: [apply(SILENCE, 2)] } },
  ],
};
export const kingfisher = module('kingfisher', [
  {
    ...base,
    id: 'kingfisher.plunge',
    name: 'Plunge',
    description: 'Diving dash strike.',
    targeting: 'direction',
    range: 14,
    cooldownS: 12,
    charges: 2,
    // slowS and refund are 0 until T3 switches them on (value gating).
    values: { damage: 80, slowS: 0, refund: 0 },
    effects: [
      {
        kind: 'dash',
        distance: 14,
        durationS: 0.3,
        dir: 'aim',
        stopOnHit: true,
        onHit: [song('damage', 0.8), apply(SLOW, 'slowS', 0.4), { kind: 'cooldownMod', scope: 'slot', slot: 0, mode: 'refund', seconds: 'refund' }],
      },
      { kind: 'statMod', id: 'kingfisher.plunge', name: 'Plunge', stats: [{ stat: 'fireRate', op: 'add', value: 0.25 }], durationS: 3 },
    ],
    upgrades: [
      { description: '+30 damage', values: { damage: 30 } },
      { description: '−3 s CD', cooldownS: -3 },
      { description: 'Slow 40% for 2 s and refund a charge', values: { slowS: 2, refund: 12 } },
    ],
  },
  {
    ...base,
    id: 'kingfisher.glint',
    name: 'Glint',
    description: 'Invisibility with an ambush bonus.',
    targeting: 'self',
    range: 0,
    cooldownS: 28,
    values: { duration: 5, silenceWindow: 0 },
    effects: [apply(GLINT, 'duration')],
    upgrades: [
      { description: '+3 s duration', values: { duration: 3 } },
      { description: '−6 s CD', cooldownS: -6 },
      { description: "Ambush's first hit silences 2 s", values: { silenceWindow: 1.5 } },
    ],
  },
  {
    ...base,
    id: 'kingfisher.spearBill',
    name: 'Spear Bill',
    description: 'Lunging stab, execute and bleed.',
    targeting: 'direction',
    range: 5,
    cooldownS: 10,
    values: { damage: 110, bleed: 4 },
    effects: [
      {
        kind: 'dash',
        distance: 5,
        durationS: 0.15,
        dir: 'aim',
        onArrive: [burst(1, ENEMIES, [{ kind: 'damage', amount: { of: 'damage', song: 1 }, type: 'song', bonus: [{ mult: 1.5, targetHpBelow: 0.4 }] }, apply(BLEED, 'bleed')])],
      },
    ],
    upgrades: [
      { description: 'Bleed +2 s', values: { bleed: 2 } },
      // gap: DamageBonus.targetHpBelow is a number, so a tier can't raise it to 50%.
      { description: 'Execute threshold 50%' },
      {
        description: 'Killing a hero resets Spear Bill and Plunge',
        effects: [{ kind: 'trigger', durationS: 0.5, trigger: { on: 'kill', chance: 1, cooldownS: 0, target: 'self', effects: [{ kind: 'cooldownMod', scope: 'slot', slot: 2, mode: 'reset' }, { kind: 'cooldownMod', scope: 'slot', slot: 0, mode: 'reset' }] } }],
      },
    ],
  },
  {
    ...base,
    id: 'kingfisher.riverstrike',
    name: 'Riverstrike',
    description: 'Teleport behind a marked hero and strike.',
    targeting: 'unit',
    affects: ENEMY_HEROES,
    range: 30,
    cooldownS: 100,
    castS: 0.5,
    rooted: true,
    values: { damage: 220 },
    effects: [
      { kind: 'teleport', to: 'behindTarget', behind: 1.5, face: 'target' },
      { kind: 'damage', amount: { of: 'damage', song: 1.6 }, type: 'song', missingHpPct: 0.12 },
      onCaster([{ kind: 'trigger', durationS: 3, trigger: { on: 'kill', chance: 1, cooldownS: 0, target: 'self', effects: [{ kind: 'cooldownMod', scope: 'slot', slot: 3, mode: 'refund', seconds: 50 }] } }]),
    ],
    upgrades: [
      { description: '+10 m range', range: 10 },
      // gap: DamageEffect.missingHpPct is a number, so a tier can't raise it to 18%.
      { description: 'Missing-HP part 18%' },
      { description: 'Silence 1.5 s; you turn invisible 1.5 s', effects: [apply(SILENCE, 1.5), onCaster([apply(INVISIBLE, 1.5)])] },
    ],
  },
]);

export const FIXTURES = { shrike, lyrebird, kingfisher };
export const O = { x: 0, y: 0, z: 0 };
export const press = (slot: number) => ({ pressed: [Button.Ability1, Button.Ability2, Button.Ability3, Button.Ability4][slot] ?? 0 });
