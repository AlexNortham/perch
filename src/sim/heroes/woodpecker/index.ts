/**
 * Woodpecker's hooks: only what data can't say.
 * - Tree Cling: at T3 the Woodpecker heals 3% of max HP a second while clinging (Jump and stuns end it in data).
 * - Hammerhead: counts the Woodpecker's gun hits on each hero while it lasts; every Nth detonates on that hero
 *   (T3: on every enemy within 4 m of it).
 */
import type { AbilityCast, EffectCause, EffectTarget, EntityId, HeroEntity, HeroModule, Tick } from '../../core/contracts';
import { TICK_RATE } from '../../data/core';
import { CLING_ABILITY, CLING_HEAL_PER_S, HAMMER_ABILITY, HAMMER_BLAST, HAMMER_EVERY, woodpeckerDef } from '../../data/heroes/woodpecker';

const CLING_SLOT = 2;
const HEAL_EVERY_TICKS = TICK_RATE / 2;
const TIER_3 = 3;
const FORWARD = { x: 0, y: 0, z: 1 };

interface Hammer {
  readonly until: Tick;
  readonly cast: AbilityCast;
  /** Gun hits so far on each hero. */
  readonly hits: Map<EntityId, number>;
}

export const woodpecker: HeroModule = {
  def: woodpeckerDef,
  implemented: true,
  hooks: (ctx) => {
    const hammers = new Map<EntityId, Hammer>();
    const at = (e: { id: EntityId; pos: { x: number; y: number; z: number } }): EffectTarget => ({ entity: e.id, point: { ...e.pos }, dir: FORWARD });

    const detonate = (h: Hammer, victim: HeroEntity): void => {
      const { cause } = h.cast;
      const splash = cause.values?.splash ?? 0;
      if (splash > 0) {
        ctx.effects.apply(
          { kind: 'area', shape: { kind: 'sphere', radius: splash }, durationS: 0, attach: 'point', affects: { teams: 'enemies' }, effects: HAMMER_BLAST },
          at(victim),
          cause,
        );
      } else {
        ctx.effects.applyAll(HAMMER_BLAST, at(victim), cause);
      }
    };

    ctx.bus.on('damage.applied', (e) => {
      if (e.via !== 'weapon' || e.source === null || e.proc || e.targetKind !== 'hero') return;
      const h = hammers.get(e.source);
      if (!h || ctx.clock.tick >= h.until) return;
      const victim = ctx.store.getKind(e.target, 'hero');
      if (!victim || victim.team === h.cast.hero.team) return;
      const n = (h.hits.get(victim.id) ?? 0) + 1;
      if (n < (h.cast.cause.values?.every ?? HAMMER_EVERY)) {
        h.hits.set(victim.id, n);
        return;
      }
      h.hits.set(victim.id, 0);
      detonate(h, victim);
    });

    const causeOf = (hero: HeroEntity): EffectCause => ({
      source: hero.id,
      team: hero.team,
      via: 'ability',
      ability: CLING_ABILITY,
      item: null,
      values: null,
      songPower: ctx.stats.get(hero.id, 'songPower'),
      proc: false,
      origin: hero.pos,
    });

    return {
      onCast(cast) {
        if (cast.ability.id !== HAMMER_ABILITY) return;
        hammers.set(cast.hero.id, {
          until: ctx.clock.tick + Math.round((cast.cause.values?.duration ?? 0) * TICK_RATE),
          cast,
          hits: new Map(),
        });
      },
      onTick(hero) {
        if (hero.motor.mode !== 'cling') return;
        const tier = hero.abilities.slots[CLING_SLOT]?.tier ?? 0;
        if (tier >= TIER_3 && ctx.clock.tick % HEAL_EVERY_TICKS === 0) {
          const amount = hero.stats.final.maxHealth * CLING_HEAL_PER_S * (HEAL_EVERY_TICKS / TICK_RATE);
          ctx.effects.apply({ kind: 'heal', amount }, at(hero), causeOf(hero));
        }
      },
    };
  },
};
