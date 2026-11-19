/**
 * Puffin's hooks: only what data can't say yet.
 * - Burrow Colony T2: a turret's hits slow the enemy (the slow is a named value that starts at 0).
 * - Rogue Wave: a direction cast's point is the aim point, so the hook starts the wave at your feet and (T3) lays the
 *   wet ground along its path.
 */
import type { EffectTarget, HeroModule } from '../../core/contracts';
import { SLOW } from '../../data/combat';
import { puffinDef, ROGUE_WAVE, TURRET_SLOW_HOOK, WAVE, WAVE_HOOK, WET_ID } from '../../data/heroes/puffin';
import * as dmath from '../../core/dmath';

const TURRET_SLOW_S = 1;
const FALLBACK_HALF_WIDTH_M = 8; // used when the cast carries no tuned half-width

export const puffin: HeroModule = {
  def: puffinDef,
  implemented: true,
  hooks: (ctx) => ({
    onEffect(name, target, cause) {
      if (name === TURRET_SLOW_HOOK) {
        const magnitude = cause.values?.slow ?? 0;
        if (magnitude > 0 && target.entity !== null) ctx.effects.apply({ kind: 'applyStatus', status: SLOW, durationS: TURRET_SLOW_S, magnitude }, target, cause);
        return;
      }
      if (name !== WAVE_HOOK || cause.source === null) return;
      const hero = ctx.store.getKind(cause.source, 'hero');
      if (!hero) return;
      const len = dmath.hypot(target.dir.x, target.dir.z) || 1;
      const dir = { x: target.dir.x / len, y: 0, z: target.dir.z / len };
      const half = cause.values?.halfWidth ?? FALLBACK_HALF_WIDTH_M;
      const start = { x: hero.pos.x + dir.x * half, y: hero.pos.y, z: hero.pos.z + dir.z * half };
      const at: EffectTarget = { entity: null, point: start, dir };
      ctx.effects.apply(ROGUE_WAVE, at, cause);
      if ((cause.values?.wet ?? 0) > 0) {
        const reach = WAVE.speed * WAVE.lifeS;
        const middle = { x: start.x + dir.x * reach / 2, y: start.y, z: start.z + dir.z * reach / 2 };
        ctx.effects.apply(
          {
            kind: 'area',
            shape: { kind: 'box', size: { x: half * 2, y: WAVE.trailHeight, z: reach + half * 2 } },
            durationS: WAVE.trailS,
            attach: 'point',
            affects: { teams: 'enemies' },
            effects: [{ kind: 'applyStatus', status: { ...SLOW, id: WET_ID }, durationS: 0.6, magnitude: WAVE.trailSlow }],
          },
          { entity: null, point: middle, dir },
          cause,
        );
      }
    },
  }),
};
