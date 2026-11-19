/**
 * Secretarybird's hooks: only what data can't say yet.
 * - Footwork: each ability hit on an enemy hero gives a stack (Stomp Kick's own hits don't: it spends them);
 *   Long Stride gives one per hero it passes. Stomp Kick lends its Song damage the +20%-per-stack bonus for the
 *   cast's tick: `footworkSpend` adds it and clears the stacks before the cone; the next tick removes it.
 *   Each stack's own 5 s timer is the status's: a new stack restarts the timer for all (D-HEROB-002).
 * - Viper Dance: a locked kick chain. The Secretarybird stays on the target by teleporting behind it every tick
 *   (the ordinary teleport effect, so physics stays the mover), and the kicks land on a fixed rhythm, all inside
 *   the cast's 2 s. It ends early if the target dies or turns intangible (or the Secretarybird dies).
 */
import type { AbilityCast, EffectCause, EffectTarget, Entity, EntityId, HeroEntity, HeroModule, SimContext } from '../../core/contracts';
import { TICK_RATE } from '../../data/core';
import {
  FOOTWORK,
  FOOTWORK_GAIN,
  FOOTWORK_PER_STACK,
  HOOK,
  secretarybirdDef,
  STOMP_BONUS_ID,
  STOMP_ID,
  VIPER_BEHIND_M,
  VIPER_END,
  VIPER_FINISH,
  VIPER_ID,
  VIPER_KICK,
  VIPER_KNOCKBACK,
} from '../../data/heroes/secretarybird';

const VIPER_SLOT = 3;
const TIER_3 = 3;

interface Dance {
  readonly cast: AbilityCast;
  readonly target: EntityId;
  readonly start: number;
  readonly kicks: number;
  readonly lengthTicks: number;
  done: number;
}

const onEntity = (e: Entity): EffectTarget => ({ entity: e.id, point: e.pos, dir: { x: 0, y: 0, z: 1 } });

export const secretarybird: HeroModule = {
  def: secretarybirdDef,
  implemented: true,
  hooks: (ctx: SimContext) => {
    const dances = new Map<EntityId, Dance>();
    /** hero → tick Stomp Kick lent its bonus. */
    const bonusTick = new Map<EntityId, number>();
    const birdOf = (id: EntityId | null): HeroEntity | undefined => {
      const h = id === null ? undefined : ctx.store.getKind(id, 'hero');
      return h?.hero.heroId === 'secretarybird' ? h : undefined;
    };
    const stacks = (hero: HeroEntity): number => hero.statuses.find((s) => s.def.id === FOOTWORK.id)?.stacks ?? 0;

    ctx.bus.on('damage.applied', (e) => {
      const hero = birdOf(e.source);
      if (!hero || e.targetKind !== 'hero' || e.ability === null || e.ability === STOMP_ID) return;
      if (ctx.store.getKind(e.target, 'hero')?.team === hero.team) return;
      ctx.effects.apply(FOOTWORK_GAIN, onEntity(hero), causeFor(hero, e.ability));
    });

    ctx.bus.on('entity.died', (e) => {
      dances.delete(e.victim);
    });

    const causeFor = (hero: HeroEntity, ability: string): EffectCause => ({
      source: hero.id,
      team: hero.team,
      via: 'ability',
      ability,
      item: null,
      values: null,
      songPower: ctx.stats.get(hero.id, 'songPower'),
      proc: false,
      origin: hero.pos,
    });

    const endDance = (hero: HeroEntity): void => {
      dances.delete(hero.id);
      ctx.effects.apply(VIPER_END, onEntity(hero), causeFor(hero, VIPER_ID));
    };

    const kick = (hero: HeroEntity, d: Dance, target: Entity): void => {
      const cause = d.cast.cause;
      const last = d.done === d.kicks;
      const at = onEntity(target);
      ctx.effects.applyAll(VIPER_KICK, at, cause);
      if (!last) return;
      const dx = target.pos.x - hero.pos.x;
      const dz = target.pos.z - hero.pos.z;
      const len = Math.hypot(dx, dz) || 1;
      ctx.effects.apply(VIPER_KNOCKBACK, { entity: target.id, point: target.pos, dir: { x: dx / len, y: 0, z: dz / len } }, cause);
      if (d.cast.tier >= TIER_3) ctx.effects.applyAll(VIPER_FINISH, onEntity(hero), cause);
    };

    return {
      onEffect(name, target, cause) {
        const hero = birdOf(cause.source);
        if (!hero) return;
        if (name === HOOK.spend) {
          const n = stacks(hero);
          if (n === 0) return;
          ctx.effects.apply({ kind: 'cleanse', remove: [FOOTWORK.id] }, onEntity(hero), cause);
          ctx.effects.apply(
            { kind: 'statMod', id: STOMP_BONUS_ID, name: 'Footwork', stats: [{ stat: 'songDamage', op: 'add', value: FOOTWORK_PER_STACK * n }], durationS: 1 },
            onEntity(hero),
            cause,
          );
          bonusTick.set(hero.id, ctx.clock.tick);
        } else if (name === HOOK.touch) {
          const touched = target.entity === null ? undefined : ctx.store.getKind(target.entity, 'hero');
          if (touched && touched.team !== hero.team) ctx.effects.apply(FOOTWORK_GAIN, onEntity(hero), cause);
        }
      },
      onCast(cast) {
        if (cast.slot !== VIPER_SLOT || cast.target.entity === null) return;
        const values = cast.cause.values ?? {};
        dances.set(cast.hero.id, {
          cast,
          target: cast.target.entity,
          start: ctx.clock.tick,
          kicks: Math.max(1, Math.round(values.kicks ?? 6)),
          lengthTicks: Math.round((values.duration ?? 2) * TICK_RATE),
          done: 0,
        });
      },
      onTick(hero) {
        // Damage requests resolve later in the cast's tick, so the Stomp bonus comes off on the next one.
        const spent = bonusTick.get(hero.id);
        if (spent !== undefined && ctx.clock.tick > spent) {
          bonusTick.delete(hero.id);
          ctx.effects.apply({ kind: 'cleanse', remove: [STOMP_BONUS_ID] }, onEntity(hero), causeFor(hero, STOMP_ID));
        }
        const d = dances.get(hero.id);
        if (!d) return;
        const target = ctx.store.getKind(d.target, 'hero');
        if (!target || target.health.dead || target.stats.conditions.has('intangible')) return endDance(hero);
        ctx.effects.apply(
          { kind: 'teleport', to: 'behindTarget', behind: VIPER_BEHIND_M, face: 'target' },
          onEntity(target),
          causeFor(hero, VIPER_ID),
        );
        const age = ctx.clock.tick - d.start;
        while (d.done < d.kicks && age >= Math.round(((d.done + 1) * d.lengthTicks) / d.kicks)) {
          d.done++;
          kick(hero, d, target);
          if (target.health.dead) break;
        }
        if (d.done >= d.kicks) dances.delete(hero.id);
      },
    };
  },
};
