/**
 * Pure helpers over ability data: an ability at an upgrade tier (`resolveAbility`), a walk over every nested effect,
 * and the kit validator Hero Engineers run on their data (`validateKit`, tested over all 24 heroes in kit.test.ts).
 */
import { EFFECT_OWNERS } from '../core/contracts';
import type { AbilityDef, AreaEffect, Effect, EffectKind, HeroModule, Magnitude } from '../core/contracts';
import { ROOT } from '../data/combat';

/**
 * A named value a tier can raise to lengthen a channel (Sulphur Shriek T2, Burrow T1): seconds added to `channelS`.
 * Stands in for a typed `AbilityUpgrade.channelS` until the next contract round (D-HEROB-010).
 */
export const CHANNEL_EXTRA_VALUE = 'channelExtraS';

/** An ability with its first `tier` upgrades folded in. */
export interface ResolvedAbility {
  readonly def: AbilityDef;
  readonly tier: number;
  /** Base values plus every bought tier's deltas: the cause's `values`. */
  readonly values: Readonly<Record<string, number>>;
  readonly cooldownS: number;
  readonly charges: number;
  readonly range: number;
  /** The channel length: `channelS` plus the `channelExtraS` value the tiers added. */
  readonly channelS: number;
  /** Base effects, then each bought tier's extra effects. */
  readonly effects: readonly Effect[];
  /** Base selfEffects, then each bought tier's (applied to the caster after `effects`). */
  readonly selfEffects: readonly Effect[];
  /** Moves the caster (a dash, teleport or movement mode): rooted and grounded block it. */
  readonly movement: boolean;
  /** Cleanses the root status itself (Scatter: "removes slows and roots on cast"), so rooted does not block it. */
  readonly unroots: boolean;
}

const cleansesRoot = (e: Effect): boolean =>
  e.kind === 'cleanse' && (e.remove === 'negative' || (e.remove !== 'positive' && e.remove.includes(ROOT.id)));

const MOVEMENT_KINDS: ReadonlySet<EffectKind> = new Set(['dash', 'teleport', 'movementMode']);

/** Sums of the base numbers and the first `tier` upgrades, before any clamping (the validator checks them). */
function fold(def: AbilityDef, tier: number) {
  const values: Record<string, number> = { ...def.values };
  let { cooldownS, charges, range } = def;
  const effects = [...def.effects];
  const selfEffects = [...(def.selfEffects ?? [])];
  for (const u of def.upgrades.slice(0, tier)) {
    for (const [k, v] of Object.entries(u.values ?? {})) values[k] = (values[k] ?? 0) + v;
    cooldownS += u.cooldownS ?? 0;
    charges += u.charges ?? 0;
    range += u.range ?? 0;
    if (u.effects) effects.push(...u.effects);
    if (u.selfEffects) selfEffects.push(...u.selfEffects);
  }
  return { values, cooldownS, charges, range, effects, selfEffects };
}

export function resolveAbility(def: AbilityDef, tier: number): ResolvedAbility {
  const f = fold(def, tier);
  return {
    def,
    tier,
    values: f.values,
    cooldownS: Math.max(0, f.cooldownS),
    charges: Math.max(1, f.charges),
    range: Math.max(0, f.range),
    channelS: Math.max(0, def.channelS + (f.values[CHANNEL_EXTRA_VALUE] ?? 0)),
    effects: f.effects,
    selfEffects: f.selfEffects,
    movement: [...f.effects, ...f.selfEffects].some((e) => MOVEMENT_KINDS.has(e.kind)),
    unroots: [...f.effects, ...f.selfEffects].some(cleansesRoot),
  };
}

/** Radius of the caster-only burst: inside the caster's own body, so no ally can stand in it. */
const ON_CASTER_RADIUS = 0.01;

/**
 * Effects for the caster from any cast, including 'unit' casts whose target is someone else (Riverstrike's
 * refund trigger and invisibility): a burst on the source that only the source itself matches.
 * Superseded by AbilityDef.selfEffects (W2.5 #15); kept until no kit uses it.
 */
export function onCaster(effects: readonly Effect[]): AreaEffect {
  return {
    kind: 'area',
    shape: { kind: 'sphere', radius: ON_CASTER_RADIUS },
    durationS: 0,
    attach: 'source',
    affects: { teams: 'allies', self: true, heroesOnly: true },
    effects,
  };
}

/** The Magnitudes an effect resolves, and the effect lists nested in it. */
function parts(e: Effect): { mags: readonly (Magnitude | undefined)[]; kids: readonly (readonly Effect[] | undefined)[] } {
  switch (e.kind) {
    case 'damage':
      return { mags: [e.amount], kids: [] };
    case 'heal':
      return { mags: [e.amount, e.overS], kids: [] };
    case 'applyStatus':
      return {
        mags: [e.durationS, e.magnitude],
        kids: [e.status.periodic?.effects, e.status.onExpire, e.status.onLethal],
      };
    case 'statMod':
      return { mags: [e.durationS], kids: [] };
    case 'cleanse':
    case 'teleport':
    case 'hook':
      return { mags: [], kids: [] };
    case 'shield':
      return { mags: [e.amount, e.durationS], kids: [] };
    case 'weaponMod':
      return { mags: [e.durationS], kids: [e.onBulletHit, e.everyNth?.effects] };
    case 'projectile':
      return { mags: [e.speed, e.range], kids: [e.onHit, e.onExpire] };
    case 'displace':
      return { mags: [e.distance], kids: [e.onWall] };
    case 'dash':
      return { mags: [e.distance, e.durationS], kids: [e.onHit, e.onArrive] };
    case 'movementMode':
      return { mags: [e.durationS], kids: [e.onCollide, e.onEnd] };
    case 'attach':
      return { mags: [e.durationS], kids: [e.onRelease] };
    case 'tether':
      return { mags: [e.durationS], kids: [e.onSourceTick, e.onTargetTick] };
    case 'area': {
      const s = e.shape;
      const size =
        s.kind === 'sphere' || s.kind === 'cylinder' ? [s.radius]
        : s.kind === 'cone' ? [s.length]
        : s.kind === 'ring' ? [s.inner, s.outer]
        : [];
      return { mags: [e.durationS, ...size], kids: [e.effects, e.onEnter, e.onExit, e.onCross] };
    }
    case 'summon':
      return { mags: [e.health, e.durationS, e.count], kids: [e.effects, e.onEnd] };
    case 'delay':
      return { mags: [e.seconds], kids: [e.effects] };
    case 'cooldownMod':
      return { mags: [e.seconds], kids: [] };
    case 'trigger':
      return { mags: [e.durationS], kids: [e.trigger.effects] };
  }
}

/** Calls `visit` for every effect in `list`, depth first, nested effects included. */
export function walkEffects(list: readonly Effect[], visit: (e: Effect) => void): void {
  for (const e of list) {
    visit(e);
    if (!(e.kind in EFFECT_OWNERS)) continue;
    for (const kid of parts(e).kids) if (kid) walkEffects(kid, visit);
  }
}

const TARGETING = new Set(['self', 'direction', 'unit', 'point']);
const SLOTS = 4;
const TIERS = 3;

/**
 * Problems in a hero's kit, as readable lines; empty when it is valid. Checks every ability: 3 upgrade tiers, sane
 * numbers at every tier, 'unit' targeting has `affects`, channel effects have a channel and an interval, every
 * nested effect is a known kind, every named value a magnitude uses exists (upgrades may only add to existing
 * names), and hooks exist when the data asks for them.
 */
export function validateKit(module: HeroModule): string[] {
  const out: string[] = [];
  const { def } = module;
  if (def.abilities.length !== SLOTS) out.push(`${def.id}: ${def.abilities.length} abilities, want ${SLOTS}`);
  const ids = new Set<string>();
  for (const a of def.abilities) {
    const at = `${def.id}/${a.id}`;
    const bad = (msg: string) => out.push(`${at}: ${msg}`);
    if (ids.has(a.id)) bad('duplicate ability id');
    ids.add(a.id);
    if (a.upgrades.length !== TIERS) bad(`${a.upgrades.length} upgrade tiers, want ${TIERS}`);
    if (!TARGETING.has(a.targeting)) bad(`unknown targeting '${a.targeting}'`);
    if (a.targeting === 'unit' && !a.affects) bad("'unit' targeting needs `affects`");
    for (const [k, v] of [['range', a.range], ['cooldownS', a.cooldownS], ['castS', a.castS], ['channelS', a.channelS]] as const) {
      if (!Number.isFinite(v) || v < 0) bad(`${k} ${v} must be a finite number ≥ 0`);
    }
    if (a.channelEffects?.length && !(a.channelS > 0 && (a.channelIntervalS ?? 0) > 0)) {
      bad('channelEffects need channelS > 0 and channelIntervalS > 0');
    }
    for (let tier = 0; tier <= a.upgrades.length; tier++) {
      const f = fold(a, tier);
      if (f.cooldownS < 0) bad(`cooldown ${f.cooldownS} s at tier ${tier}`);
      if (!Number.isInteger(f.charges) || f.charges < 1) bad(`${f.charges} charges at tier ${tier}`);
      if (f.range < 0) bad(`range ${f.range} at tier ${tier}`);
    }
    a.upgrades.forEach((u, i) => {
      for (const k of Object.keys(u.values ?? {})) if (!(k in a.values)) bad(`tier ${i + 1} adds to unknown value '${k}'`);
    });
    let usesHook = a.hook;
    const check = (e: Effect) => {
      if (!(e.kind in EFFECT_OWNERS)) {
        bad(`unknown effect kind '${(e as { kind: string }).kind}'`);
        return;
      }
      for (const m of parts(e).mags) {
        const name = typeof m === 'object' ? m.of : m;
        if (typeof name === 'string' && !(name in a.values)) bad(`${e.kind} uses unknown value '${name}'`);
      }
      if (e.kind === 'hook') usesHook = true;
      if (e.kind === 'cooldownMod' && e.scope === 'slot' && !(Number.isInteger(e.slot) && (e.slot ?? -1) >= 0 && (e.slot ?? SLOTS) < SLOTS)) {
        bad(`cooldownMod slot ${e.slot} is not 0–3`);
      }
      if (e.kind === 'tether' && !(e.breakDistance > 0)) bad('tether breakDistance must be > 0');
      if (e.kind === 'summon' && !(Number.isInteger(e.maxCount) && e.maxCount >= 1)) bad('summon maxCount must be ≥ 1');
    };
    walkEffects(a.effects, check);
    walkEffects(a.selfEffects ?? [], check);
    walkEffects(a.channelEffects ?? [], check);
    for (const u of a.upgrades) {
      walkEffects(u.effects ?? [], check);
      walkEffects(u.selfEffects ?? [], check);
    }
    if (usesHook && !module.hooks) bad('uses a hook but the hero module has no `hooks`');
  }
  return out;
}
