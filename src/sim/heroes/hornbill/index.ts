/**
 * Hornbill's hooks: only what data can't say yet.
 * - Heavy Rounds: the slow lands on heroes only (a bullet-hit effect can't filter by kind).
 * - Mud Seal: the fire rate ends when the barrier does; at T3 slows are lifted while it holds.
 * - Bounding Hop T3: the slick goes where you took off.
 * - Marked Prey: if the mark dies while it lasts, half the cooldown comes back.
 */
import type { EffectCause, EffectTarget, EntityId, HeroModule, Tick } from '../../core/contracts';
import { SLOW } from '../../data/combat';
import { TICK_RATE } from '../../data/core';
import { HEAVY_SLOW, HEAVY_SLOW_HOOK, HOP_SLICK_HOOK, hornbillDef, MUD_RATE_ID, SLICK } from '../../data/heroes/hornbill';

const MUD_SEAL = 'hornbill.mudSeal';
const MARKED_PREY = 'hornbill.markedPrey';
const REFUND_FRACTION = 0.5;
const SLICK_ID = 'hornbill.slick';

interface Seal {
  readonly until: Tick;
  readonly noSlow: boolean;
}
interface Mark {
  readonly target: EntityId;
  readonly until: Tick;
}

export const hornbill: HeroModule = {
  def: hornbillDef,
  implemented: true,
  hooks: (ctx) => {
    const seals = new Map<EntityId, Seal>();
    const marks = new Map<EntityId, Mark>();
    const at = (e: { id: EntityId; pos: { x: number; y: number; z: number } }): EffectTarget => ({ entity: e.id, point: e.pos, dir: { x: 0, y: 0, z: 1 } });

    ctx.bus.on('entity.died', (e) => {
      for (const [hero, m] of marks) {
        if (m.target !== e.victim) continue;
        marks.delete(hero);
        const h = ctx.store.getKind(hero, 'hero');
        if (!h || h.health.dead || ctx.clock.tick > m.until) continue;
        const cause: EffectCause = {
          source: h.id, team: h.team, via: 'ability', ability: MARKED_PREY, item: null, values: null, songPower: 0, proc: false, origin: h.pos,
        };
        const cooldown = hornbillDef.abilities[3].cooldownS;
        ctx.effects.apply({ kind: 'cooldownMod', scope: 'slot', slot: 3, mode: 'refund', seconds: cooldown * REFUND_FRACTION }, at(h), cause);
      }
    });

    return {
      onEffect(name, target, cause) {
        if (name === HEAVY_SLOW_HOOK) {
          if (target.entity === null || !ctx.store.getKind(target.entity, 'hero')) return;
          ctx.effects.apply({ kind: 'applyStatus', status: SLOW, durationS: HEAVY_SLOW.durationS, magnitude: HEAVY_SLOW.magnitude }, target, cause);
        } else if (name === HOP_SLICK_HOOK && cause.source !== null) {
          const hero = ctx.store.getKind(cause.source, 'hero');
          if (!hero) return;
          ctx.effects.apply(
            {
              kind: 'area',
              shape: { kind: 'cylinder', radius: SLICK.radius, height: 2 },
              durationS: SLICK.durationS,
              attach: 'point',
              affects: { teams: 'enemies' },
              effects: [{ kind: 'applyStatus', status: { ...SLOW, id: SLICK_ID }, durationS: 0.6, magnitude: SLICK.slow }],
            },
            { entity: null, point: { ...hero.pos }, dir: { x: 0, y: 0, z: 1 } },
            cause,
          );
        }
      },
      onCast(cast) {
        const now = ctx.clock.tick;
        if (cast.ability.id === MUD_SEAL) {
          seals.set(cast.hero.id, { until: now + 5 * TICK_RATE, noSlow: cast.tier >= 3 });
        } else if (cast.ability.id === MARKED_PREY && cast.target.entity !== null) {
          marks.set(cast.hero.id, { target: cast.target.entity, until: now + Math.round((cast.cause.values?.duration ?? 10) * TICK_RATE) });
        }
      },
      onTick(hero) {
        const s = seals.get(hero.id);
        if (!s) return;
        if (hero.health.barrier <= 0 || ctx.clock.tick >= s.until) {
          seals.delete(hero.id);
          ctx.effects.apply({ kind: 'cleanse', remove: [MUD_RATE_ID] }, at(hero), cleanseCause(hero.id, hero.team, hero.pos));
          return;
        }
        if (!s.noSlow) return;
        const slows = hero.statuses.filter((st) => st.def.modifiers?.stats?.some((m) => m.stat === 'slow')).map((st) => st.def.id);
        if (slows.length > 0) ctx.effects.apply({ kind: 'cleanse', remove: slows }, at(hero), cleanseCause(hero.id, hero.team, hero.pos));
      },
    };

    function cleanseCause(id: EntityId, team: EffectCause['team'], origin: EffectCause['origin']): EffectCause {
      return { source: id, team, via: 'ability', ability: MUD_SEAL, item: null, values: null, songPower: 0, proc: false, origin };
    }
  },
};
