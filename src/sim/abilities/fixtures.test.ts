/**
 * Three real GDD kits with very different shapes, written as data only (GDD §9.1 Shrike: traps, zones, a ring
 * wall; §9.4 Lyrebird: ally targeting, a decoy, a channelled aura; §9.3 Kingfisher: charged dashes, invisibility,
 * a wind-up unit strike), proving the framework expresses them. Each `// gap:` names a tier the contracts can't
 * say yet (listed in the W2 Ability Systems report). Also the performance check.
 */
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import { Button } from '../core/contracts';
import type { AbilityDef, Effect, HeroId, HeroModule, Magnitude, StatusDef, TargetFilter } from '../core/contracts';
import { HEROES } from '../heroes/registry';
import { onCaster, validateKit } from './kit';
import { createHarness } from './testkit';

// ── Shared fixture statuses (combat's data/combat.ts will own the real ones) ─────────────────────────────────────

const on = (id: string, negative: boolean, conditions: StatusDef['modifiers']): StatusDef => ({
  id,
  name: id,
  negative,
  stacking: 'max',
  maxStacks: 1,
  durationS: 1,
  modifiers: conditions,
});
const ROOT = on('root', true, { conditions: ['rooted'] });
const REVEAL = on('reveal', true, { conditions: ['revealed'] });
const GROUNDED = on('grounded', true, { conditions: ['grounded'] });
const DISARM = on('disarm', true, { conditions: ['disarmed'] });
const SILENCE = on('silence', true, { conditions: ['silenced'] });
const INVISIBLE: StatusDef = { ...on('invisible', false, { conditions: ['invisible'] }), endsOnAttack: true };
const graded = (id: string, stat: 'slow' | 'healReduction' | 'songAmp', op: 'max' | 'add'): StatusDef => ({
  ...on(id, true, { stats: [{ stat, op, value: 1 }] }),
  stacking: 'independent',
});
const SLOW = graded('slow', 'slow', 'max');
const HEAL_CUT = graded('healReduction', 'healReduction', 'max');
const SONG_AMP = graded('songAmp', 'songAmp', 'add');
const DAMAGE_AMP: StatusDef = {
  ...on('damageAmp', true, { stats: [{ stat: 'talonAmp', op: 'add', value: 1 }, { stat: 'songAmp', op: 'add', value: 1 }] }),
  stacking: 'independent',
};

const ENEMIES: TargetFilter = { teams: 'enemies' };
const ENEMY_HEROES: TargetFilter = { teams: 'enemies', heroesOnly: true };
const ALLY_HEROES: TargetFilter = { teams: 'allies', self: true, heroesOnly: true };
/** "base + k×SP" Song damage. */
const song = (of: number | string, k: number): Effect => ({ kind: 'damage', amount: { of, song: k }, type: 'song' });
const apply = (status: StatusDef, durationS: Magnitude, magnitude?: Magnitude): Effect => ({ kind: 'applyStatus', status, durationS, magnitude });
const burst = (radius: Magnitude, affects: TargetFilter, effects: readonly Effect[]): Effect => ({
  kind: 'area',
  shape: { kind: 'sphere', radius },
  durationS: 0,
  attach: 'point',
  affects,
  effects,
});
/** Area ticks are 0.5 s, so per-second numbers are halved per tick (GDD §5.12). */
const zone = (radius: Magnitude, durationS: Magnitude, affects: TargetFilter, effects: readonly Effect[]): Effect => ({
  kind: 'area',
  shape: { kind: 'cylinder', radius, height: 4 },
  durationS,
  attach: 'point',
  affects,
  effects,
});
const base = { castS: 0, channelS: 0, charges: 1, hook: false } as const;
const module = (from: HeroId, abilities: readonly AbilityDef[], hooks?: HeroModule['hooks']): HeroModule => ({
  def: { ...HEROES[from].def, abilities: abilities as [AbilityDef, AbilityDef, AbilityDef, AbilityDef] },
  hooks,
});

// ── Shrike (GDD §9.1) ────────────────────────────────────────────────────────────────────────────────────────

const shrike = module('shrike', [
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

const CHORUS: StatusDef = { ...on('lyrebird.chorus', false, { stats: [{ stat: 'slow', op: 'max', value: 0.4 }], conditions: ['disarmed'] }), durationS: 5 };
const lyrebird = module('lyrebird', [
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

const BLEED: StatusDef = {
  ...on('kingfisher.bleed', true, undefined),
  stacking: 'perSource',
  durationS: 4,
  periodic: { intervalS: 0.5, effects: [song(7.5, 0.075)] },
};
const AMBUSH: Effect = { kind: 'statMod', id: 'kingfisher.ambush', name: 'Ambush', stats: [{ stat: 'gunDamage', op: 'add', value: 0.4 }, { stat: 'songDamage', op: 'add', value: 0.4 }], durationS: 1.5 };
const GLINT: StatusDef = {
  ...on('kingfisher.glint', false, { conditions: ['invisible'], stats: [{ stat: 'moveSpeed', op: 'pct', value: 0.25 }] }),
  endsOnAttack: true,
  // Value-gated: the silence trigger lasts 'silenceWindow' seconds, 0 until T3.
  onExpire: [
    AMBUSH,
    { kind: 'trigger', durationS: 'silenceWindow', trigger: { on: 'weaponHit', chance: 1, cooldownS: 0, target: 'other', effects: [apply(SILENCE, 2)] } },
  ],
};
const kingfisher = module('kingfisher', [
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

const FIXTURES = { shrike, lyrebird, kingfisher };
const O = { x: 0, y: 0, z: 0 };
const press = (slot: number) => ({ pressed: [Button.Ability1, Button.Ability2, Button.Ability3, Button.Ability4][slot] ?? 0 });

function setup() {
  const t = createHarness({ heroes: FIXTURES, unlockAbilities: true });
  return t;
}

describe('fixture kits', () => {
  it.each(Object.entries(FIXTURES))('%s validates', (_id, m) => {
    expect(validateKit(m)).toEqual([]);
  });

  it('Shrike: Thorn Larder arms after 0.75 s, then roots, reveals and damages the hero who steps in', () => {
    const t = setup();
    const me = t.hero('shrike', 'dawn', O);
    const foe = t.hero('owl', 'dusk', { x: 0, y: 0, z: 30 });
    t.ctx.stats.setBase(me.id, { ...me.stats.base, songPower: 10 });
    t.step(1, [[me, press(0)]]);
    t.step(24);
    t.step(1, [[me, { ...press(0), yaw: 1 }]]);
    expect(me.abilities.slots[0]?.charges).toBe(0);
    t.step(44);
    expect(t.ctx.store.list('unit')).toHaveLength(1);
    t.step(24);
    const traps = t.ctx.store.list('unit');
    expect(traps.map((u) => u.unit.summon)).toEqual(['trap', 'trap']);
    foe.pos = { x: traps[0]?.pos.x ?? 0, y: 0, z: (traps[0]?.pos.z ?? 0) + 1 };
    t.step(1);
    const [d] = t.of('damage');
    expect(d?.target.entity).toBe(foe.id);
    expect(d && t.ctx.effects.magnitude(d.effect.amount, d.cause)).toBe(89);
    expect(t.of('applyStatus').map((a) => [a.effect.status.id, t.ctx.effects.magnitude(a.effect.durationS ?? 0, a.cause)])).toEqual([['root', 1], ['reveal', 4]]);
    expect(t.ctx.store.list('unit')).toHaveLength(1);
  });

  it("Shrike: Butcher's Ring at T3 — heal cut and damage inside, damage and root on crossing", () => {
    const t = setup();
    const me = t.hero('shrike', 'dawn', O);
    const foe = t.hero('owl', 'dusk', { x: 0, y: 0, z: 20 });
    me.abilities.ap = 8;
    for (let i = 0; i < 3; i++) t.step(1, [[me, { upgrade: 3 }]]);
    expect(me.abilities.slots[3]?.tier).toBe(3);
    t.step(1, [[me, { ...press(3), pitch: -0.3 }]]);
    const centre = t.of('delay')[0]?.target.point ?? O;
    foe.pos = { x: centre.x, y: 0, z: centre.z + 5 };
    t.step(48);
    expect(t.ctx.store.list('area').map((a) => [a.area.shape, a.area.expiresAt])).toEqual([['ring', 52 + 480], ['cylinder', 52 + 480], ['cylinder', 52 + 480]]);
    t.step(30);
    expect(t.of('applyStatus').map((a) => a.effect.status.id)).toEqual(['healReduction']);
    expect(t.of('damage')).toHaveLength(1);
    for (const z of [8.8, 9.2]) {
      foe.pos.z = centre.z + z;
      t.step(1);
    }
    const crossed = t.of('damage').at(-1);
    expect(crossed && t.ctx.effects.magnitude(crossed.effect.amount, crossed.cause)).toBe(150);
    expect(t.of('applyStatus').at(-1)?.effect.status.id).toBe('root');
  });

  it('Lyrebird: Mended Song heals the ally in the crosshair, else the caster', () => {
    const t = setup();
    const me = t.hero('lyrebird', 'dawn', O);
    const ally = t.hero('swan', 'dawn', { x: -0.75, y: 0, z: 20 });
    t.step(1, [[me, press(0)]]);
    t.step(24, [[me, { yaw: Math.PI }]]);
    t.step(1, [[me, press(0)]]);
    expect(t.of('heal').map((a) => [a.target.entity, a.effect.overS ?? 0])).toEqual([[ally.id, 0], [ally.id, 4], [me.id, 0], [me.id, 4]]);
  });

  it('Lyrebird: Grand Chorus pulses each second for 5 s; T3 lifts the channel penalty', () => {
    const t = setup();
    const me = t.hero('lyrebird', 'dawn', O);
    const ally = t.hero('swan', 'dawn', { x: 5, y: 0, z: 0 });
    const foe = t.hero('owl', 'dusk', { x: 0, y: 0, z: 10 });
    t.hero('pelican', 'dusk', { x: 0, y: 0, z: 30 });
    t.step(1, [[me, press(3)]]);
    t.step(300);
    expect(t.of('heal').map((a) => a.target.entity)).toEqual([me.id, ally.id, me.id, ally.id, me.id, ally.id, me.id, ally.id, me.id, ally.id]);
    expect(t.of('applyStatus').filter((a) => a.effect.status === SLOW).map((a) => a.target.entity)).toEqual([foe.id, foe.id, foe.id, foe.id, foe.id]);
    expect(t.events.flatMap((e) => (e.type === 'ability' ? [e.stage] : []))).toEqual(['start', 'land', 'end']);

    const t3 = setup();
    const me3 = t3.hero('lyrebird', 'dawn', O);
    me3.abilities.ap = 8;
    for (let i = 0; i < 3; i++) t3.step(1, [[me3, { upgrade: 3 }]]);
    t3.step(1, [[me3, press(3)]]);
    expect(t3.applied.map((a) => a.effect.kind).slice(0, 3)).toEqual(['applyStatus', 'area', 'cleanse']);
  });

  it('Lyrebird: Echo Double sends a decoy along the aim and hides the caster', () => {
    const t = setup();
    const me = t.hero('lyrebird', 'dawn', O);
    t.step(1, [[me, press(1)]]);
    const [decoy] = t.ctx.store.list('unit');
    expect(decoy?.unit).toMatchObject({ summon: 'decoy', owner: me.id });
    expect(t.of('applyStatus').map((a) => [a.effect.status.id, a.target.entity])).toEqual([['invisible', me.id]]);
    t.step(60);
    expect(decoy?.pos.z).toBeGreaterThan(6);
  });

  it('Kingfisher: Riverstrike winds up 0.5 s, then teleports and strikes; its refund trigger goes to the caster', () => {
    const t = setup();
    const me = t.hero('kingfisher', 'dawn', O);
    const foe = t.hero('owl', 'dusk', { x: -0.75, y: 0, z: 20 });
    t.step(1, [[me, press(3)]]);
    expect(t.ctx.stats.has(me.id, 'rooted')).toBe(true);
    t.step(29);
    expect(t.of('teleport')).toHaveLength(0);
    t.step(1);
    expect(t.of('teleport')[0]?.target.entity).toBe(foe.id);
    expect(t.of('damage')[0]).toMatchObject({ target: { entity: foe.id }, effect: { missingHpPct: 0.12 } });
    expect(t.of('trigger')[0]?.target.entity).toBe(me.id);
  });

  it('Kingfisher: Plunge T3 refunds its own charge from the dash onHit, though the target is the enemy', () => {
    const t = setup();
    const me = t.hero('kingfisher', 'dawn', O);
    const foe = t.hero('owl', 'dusk', { x: 0, y: 0, z: 10 });
    me.abilities.ap = 8;
    for (let i = 0; i < 3; i++) t.step(1, [[me, { upgrade: 0 }]]);
    t.step(1, [[me, press(0)]]);
    t.step(24);
    t.step(1, [[me, press(0)]]);
    const slot = me.abilities.slots[0];
    expect(slot?.charges).toBe(0);
    const [dash] = t.of('dash');
    if (!dash) throw new Error('no dash');
    // Physics would apply onHit on contact; do it here.
    t.ctx.effects.applyAll(dash.effect.onHit ?? [], { entity: foe.id, point: foe.pos, dir: dash.target.dir }, dash.cause);
    expect(slot?.charges).toBe(1);
    const slow = t.of('applyStatus')[0];
    expect(slow && t.ctx.effects.magnitude(slow.effect.durationS ?? 0, slow.cause)).toBe(2);
  });
});

describe('performance', () => {
  // Wall-clock timing of the phase for the report; the sim itself never reads a clock.
  // eslint-disable-next-line no-restricted-properties
  const now = () => performance.now();

  /** 12 heroes with the three kits press an ability every 10 ticks; cooldowns are wiped every `wipe` ticks. */
  function measure(wipe: number): { ms: number; live: number } {
    const ids: HeroId[] = ['shrike', 'lyrebird', 'kingfisher', 'owl', 'pelican', 'swan', 'puffin', 'vulture', 'swift', 'kiwi', 'toucan', 'flamingo'];
    const kits = [shrike, lyrebird, kingfisher];
    const heroes = Object.fromEntries(ids.map((id, i) => [id, kits[i % kits.length] as HeroModule])) as Partial<Record<HeroId, HeroModule>>;
    let spent = 0;
    const t = createHarness({
      heroes,
      unlockAbilities: true,
      wrapPhase: (phase) => {
        const t0 = now();
        phase();
        spent += now() - t0;
      },
    });
    const team = ids.map((id, i) =>
      i < 6 ? t.hero(id, 'dawn', { x: i * 3 - 7.5, y: 0, z: -8 }, 0) : t.hero(id, 'dusk', { x: (i - 6) * 3 - 7.5, y: 0, z: 8 }, Math.PI),
    );
    let live = 0;
    const run = (ticks: number) => {
      for (let k = 0; k < ticks; k++) {
        const tick = t.ctx.clock.tick + 1;
        if (tick % wipe === 0) for (const h of team) for (const s of h.abilities.slots) Object.assign(s, { charges: 2, readyAt: 0, cooldownTicks: 0 });
        const pressed = (i: number) => ((tick + i) % 10 === 0 ? press(Math.floor((tick + i) / 10) % 4).pressed : 0);
        t.step(1, team.map((h, i) => [h, { pitch: -0.35, yaw: h.yaw, pressed: pressed(i) }] as const));
        live += t.ctx.store.list('area').length + t.ctx.store.list('unit').length;
      }
    };
    run(600);
    spent = 0;
    live = 0;
    const measured = 1800;
    run(measured);
    return { ms: spent / measured, live: live / measured };
  }

  it('12 heroes casting with ~30 areas and summons live stays inside the abilities share of the budget', () => {
    const brief = measure(300);
    const stress = measure(60);
    console.log(
      `abilities phase: ${brief.ms.toFixed(4)} ms/tick with ${brief.live.toFixed(1)} areas+summons live; ` +
        `${stress.ms.toFixed(4)} ms/tick with ${stress.live.toFixed(1)}`,
    );
    expect(brief.live).toBeGreaterThan(25);
    expect(brief.ms).toBeLessThan(0.3);
  });
});

