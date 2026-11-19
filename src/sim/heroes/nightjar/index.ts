/**
 * Nightjar's hooks: only what data can't say.
 * - Nightfall: the first hit out of it (any enemy damage from the Nightjar, until 1.5 s after the invisibility would
 *   have ended) adds the ambush strike. At T3 that hit also puts the invisibility back for what was left of it; the
 *   next attack ends it as usual, so the second hit is the one that breaks it.
 * - Night Swallow: the strike lands after the dash, if the Nightjar actually arrived (a stun or a wall mid-dash
 *   spares the target). At T3 a kill resets the cooldown and leaves the Nightjar invisible for 3 s.
 */
import type { EffectCause, EntityId, HeroEntity, HeroModule, Tick } from '../../core/contracts';
import { TICK_RATE } from '../../data/core';
import * as dmath from '../../core/dmath';
import {
  AMBUSH_STRIKE,
  AMBUSH_WINDOW_S,
  NIGHTFALL,
  NIGHTFALL_ABILITY,
  nightjarDef,
  SWALLOW,
  SWALLOW_ABILITY,
  SWALLOW_STRIKE,
  SWALLOW_STRIKE_HOOK,
  SWALLOW_VANISH_S,
} from '../../data/heroes/nightjar';

const SWALLOW_SLOT = 3;
const TIER_3 = 3;

interface Ambush {
  /** The last tick the first hit still gets the bonus. */
  readonly armedUntil: Tick;
  /** The tick the invisibility would have ended. */
  readonly invisibleUntil: Tick;
  readonly keep: boolean;
  readonly cause: EffectCause;
}

export const nightjar: HeroModule = {
  def: nightjarDef,
  implemented: true,
  hooks: (ctx) => {
    const ambushes = new Map<EntityId, Ambush>();
    const on = (e: { id: EntityId; pos: { x: number; y: number; z: number } }) => ({ entity: e.id, point: { ...e.pos }, dir: { x: 0, y: 0, z: 1 } });
    const tier = (hero: HeroEntity, slot: number): number => hero.abilities.slots[slot]?.tier ?? 0;

    ctx.bus.on('damage.applied', (e) => {
      if (e.source === null || e.proc) return;
      const hero = ctx.store.getKind(e.source, 'hero');
      if (!hero) return;
      const victim = ctx.store.get(e.target);
      const a = ambushes.get(hero.id);
      if (a && victim && victim.team !== hero.team && e.amount > 0) {
        ambushes.delete(hero.id);
        const now = ctx.clock.tick;
        if (now <= a.armedUntil) {
          ctx.effects.applyAll(AMBUSH_STRIKE, on(victim), a.cause);
          if (a.keep && now < a.invisibleUntil) {
            ctx.effects.apply({ kind: 'applyStatus', status: NIGHTFALL, durationS: (a.invisibleUntil - now) / TICK_RATE }, on(hero), a.cause);
          }
        }
      }
      if (e.lethal && e.targetKind === 'hero' && e.ability === SWALLOW_ABILITY && tier(hero, SWALLOW_SLOT) >= TIER_3) {
        const cause: EffectCause = {
          source: hero.id,
          team: hero.team,
          via: 'ability',
          ability: SWALLOW_ABILITY,
          item: null,
          values: null,
          songPower: ctx.stats.get(hero.id, 'songPower'),
          proc: false,
          origin: hero.pos,
        };
        ctx.effects.apply({ kind: 'cooldownMod', scope: 'slot', slot: SWALLOW_SLOT, mode: 'reset' }, on(hero), cause);
        ctx.effects.apply({ kind: 'applyStatus', status: NIGHTFALL, durationS: SWALLOW_VANISH_S }, on(hero), cause);
      }
    });

    return {
      onCast(cast) {
        if (cast.ability.id !== NIGHTFALL_ABILITY) return;
        const now = ctx.clock.tick;
        const seconds = cast.cause.values?.duration ?? NIGHTFALL.durationS;
        ambushes.set(cast.hero.id, {
          armedUntil: now + Math.round((seconds + AMBUSH_WINDOW_S) * TICK_RATE),
          invisibleUntil: now + Math.round(seconds * TICK_RATE),
          keep: (cast.cause.values?.keep ?? 0) >= 1,
          cause: cast.cause,
        });
      },
      onEffect(name, target, cause) {
        if (name !== SWALLOW_STRIKE_HOOK || target.entity === null || cause.source === null) return;
        const hero = ctx.store.getKind(cause.source, 'hero');
        const foe = ctx.store.getKind(target.entity, 'hero');
        if (!hero || !foe || hero.health.dead || foe.health.dead) return;
        if (dmath.hypot(foe.pos.x - hero.pos.x, foe.pos.z - hero.pos.z) > hero.radius + foe.radius + SWALLOW.reachM) return;
        ctx.effects.applyAll(SWALLOW_STRIKE, on(foe), cause);
      },
    };
  },
};
