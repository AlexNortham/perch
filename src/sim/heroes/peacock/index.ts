/**
 * Peacock's hooks: only what data can't say yet.
 * - Hundred Eyes: a projectile effect has one direction, so the cast fans N darts out (30° across); each dart's hit
 *   comes back as the `eyeHit` effect, which stops counting a hero after three hits from the same cast.
 * - Strut: the next ability cast while its marker is on spends it and gets +25% Song damage, held for a moment so a
 *   dart's flight or a burst still counts.
 */
import type { EffectCause, EntityId, HeroModule } from '../../core/contracts';
import { RAD_PER_DEG } from '../../data/abilities';
import {
  EYE_DART,
  EYE_HIT,
  EYE_MARK,
  EYES_FAN_DEG,
  EYES_MAX_HITS,
  STRUT_AMP,
  STRUT_AMP_ID,
  STRUT_AMP_LINGER_S,
  STRUT_ARMED_ID,
  peacockDef,
} from '../../data/heroes/peacock';
import * as dmath from '../../core/dmath';

const EYES_SLOT = 0;
const STRUT_SLOT = 2;

export const peacock: HeroModule = {
  def: peacockDef,
  implemented: true,
  hooks: (ctx) => {
    /** Hits each hero has taken from one cast's darts (every dart of a cast shares its cause). */
    const hits = new WeakMap<EffectCause, Map<EntityId, number>>();
    return {
      onCast(cast) {
        if (cast.slot === EYES_SLOT) {
          const n = Math.max(1, Math.round(cast.cause.values?.darts ?? 1));
          const { x, y, z } = cast.target.dir;
          for (let i = 0; i < n; i++) {
            const a = (n === 1 ? 0 : -EYES_FAN_DEG / 2 + (EYES_FAN_DEG * i) / (n - 1)) * RAD_PER_DEG;
            const s = dmath.sin(a);
            const c = dmath.cos(a);
            ctx.effects.apply(EYE_DART, { ...cast.target, dir: { x: x * c + z * s, y, z: z * c - x * s } }, cast.cause);
          }
          return;
        }
        if (cast.slot === STRUT_SLOT || !cast.hero.statuses.some((s) => s.def.id === STRUT_ARMED_ID)) return;
        const t = { entity: cast.hero.id, point: cast.hero.pos, dir: cast.target.dir };
        ctx.effects.apply({ kind: 'cleanse', remove: [STRUT_ARMED_ID] }, t, cast.cause);
        ctx.effects.apply(
          { kind: 'statMod', id: STRUT_AMP_ID, name: 'Strut: next cast', stats: [{ stat: 'songDamage', op: 'add', value: STRUT_AMP }], durationS: STRUT_AMP_LINGER_S },
          t,
          cast.cause,
        );
      },
      onEffect(name, target, cause) {
        if (name !== 'eyeHit' || target.entity === null) return;
        let per = hits.get(cause);
        if (!per) hits.set(cause, (per = new Map()));
        const n = (per.get(target.entity) ?? 0) + 1;
        if (n > EYES_MAX_HITS) return;
        per.set(target.entity, n);
        ctx.effects.applyAll(EYE_HIT, target, cause);
        if ((cause.values?.mark ?? 0) > 0) ctx.effects.applyAll(EYE_MARK, target, cause);
      },
    };
  },
};
