/**
 * Kingfisher's hooks: only what data can't say yet. All four listen for events, so they work with or without the
 * item system's `trigger` effect.
 * - Glint: when it ends (an attack, a cast or the clock) Ambush starts; at T3 the first hit on a hero silences it.
 * - Spear Bill T3: a hero killed by it resets Spear Bill and Plunge.
 * - Riverstrike: the target dying within 3 s refunds half the cooldown; (T3's vanish is `selfEffects` data).
 * TODO(framework): Glint's Ambush and the two kill refunds are `trigger` data once Economy & Items' system lands.
 */
import type { EffectCause, EntityId, HeroEntity, HeroModule, SimContext } from '../../core/contracts';
import { AMBUSH, AMBUSH_SILENCE, AMBUSH_SILENCE_WINDOW_S, GLINT_ID, kingfisherDef } from '../../data/heroes/kingfisher';
import { TICK_RATE } from '../../data/core';

const SLOT = { plunge: 0, glint: 1, spearBill: 2, riverstrike: 3 } as const;
const REFUND_WINDOW_S = 3;
const REFUND_FRACTION = 0.5;
const TIER_3 = 3;

export const kingfisher: HeroModule = {
  def: kingfisherDef,
  implemented: true,
  hooks: (ctx: SimContext) => {
    /** hero → tick until which its next hit on a hero silences (Glint T3). */
    const silenceUntil = new Map<EntityId, number>();
    /** hero → who Riverstrike struck, and until when their death refunds. */
    const strikes = new Map<EntityId, { victim: EntityId; until: number }>();

    const kingfisherOf = (id: EntityId | null): HeroEntity | undefined => {
      const h = id === null ? undefined : ctx.store.getKind(id, 'hero');
      return h?.hero.heroId === 'kingfisher' ? h : undefined;
    };
    const causeOf = (hero: HeroEntity, slot: number): EffectCause => ({
      source: hero.id,
      team: hero.team,
      via: 'ability',
      ability: kingfisherDef.abilities[slot]?.id ?? null,
      item: null,
      values: null,
      songPower: ctx.stats.get(hero.id, 'songPower'),
      proc: false,
      origin: hero.pos,
    });
    const onHero = (hero: HeroEntity) => ({ entity: hero.id, point: hero.pos, dir: { x: 0, y: 0, z: 1 } });
    const tier = (hero: HeroEntity, slot: number): number => hero.abilities.slots[slot]?.tier ?? 0;

    ctx.bus.on('status.ended', (e) => {
      if (e.status !== GLINT_ID || e.reason !== 'expired') return;
      const hero = kingfisherOf(e.target);
      if (!hero || hero.health.dead) return;
      ctx.effects.apply(AMBUSH, onHero(hero), causeOf(hero, SLOT.glint));
      if (tier(hero, SLOT.glint) >= TIER_3) silenceUntil.set(hero.id, ctx.clock.tick + Math.round(AMBUSH_SILENCE_WINDOW_S * TICK_RATE));
    });

    ctx.bus.on('damage.applied', (e) => {
      const hero = kingfisherOf(e.source);
      if (!hero) return;
      const until = silenceUntil.get(hero.id);
      if (until !== undefined && e.targetKind === 'hero') {
        silenceUntil.delete(hero.id);
        const victim = ctx.store.get(e.target);
        if (victim && ctx.clock.tick <= until) {
          ctx.effects.apply(AMBUSH_SILENCE, { entity: victim.id, point: victim.pos, dir: { x: 0, y: 0, z: 1 } }, causeOf(hero, SLOT.glint));
        }
      }
      if (e.lethal && e.targetKind === 'hero' && e.ability === kingfisherDef.abilities[SLOT.spearBill]?.id && tier(hero, SLOT.spearBill) >= TIER_3) {
        const cause = causeOf(hero, SLOT.spearBill);
        for (const slot of [SLOT.spearBill, SLOT.plunge]) {
          ctx.effects.apply({ kind: 'cooldownMod', scope: 'slot', slot, mode: 'reset' }, onHero(hero), cause);
        }
      }
    });

    ctx.bus.on('entity.died', (e) => {
      for (const [id, s] of strikes) {
        if (s.victim !== e.victim) continue;
        strikes.delete(id);
        const hero = kingfisherOf(id);
        if (!hero || ctx.clock.tick > s.until) continue;
        const seconds = (kingfisherDef.abilities[SLOT.riverstrike]?.cooldownS ?? 0) * REFUND_FRACTION;
        ctx.effects.apply({ kind: 'cooldownMod', scope: 'slot', slot: SLOT.riverstrike, mode: 'refund', seconds }, onHero(hero), causeOf(hero, SLOT.riverstrike));
      }
    });

    return {
      onCast(cast) {
        if (cast.slot !== SLOT.riverstrike) return;
        if (cast.target.entity !== null) strikes.set(cast.hero.id, { victim: cast.target.entity, until: ctx.clock.tick + REFUND_WINDOW_S * TICK_RATE });
      },
    };
  },
};
