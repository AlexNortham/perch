/**
 * Swift's hooks: only what data can't say yet.
 * - Slipstream T3: the damage to enemies passed through (a tier can't add to a dash's onHit, so the dash always
 *   reports its hits and the hook applies the damage when the tier's `pass` value is above 0).
 * - Wing Scythe T3: the return pass stuns. Each blade hits a hero once per pass, so a hero's second hit is the return.
 * - Sky Stitch: holds the flight under the 25 m ceiling; at T3 slams the ground below when the flight ends.
 */
import type { EffectCause, EntityId, HeroModule } from '../../core/contracts';
import { STUN } from '../../data/combat';
import { SKY_STITCH_CEILING_M, SKY_STITCH_SLAM, SLIPSTREAM_PASS, swiftDef } from '../../data/heroes/swift';

export const swift: HeroModule = {
  def: swiftDef,
  implemented: true,
  hooks: (ctx) => {
    const passes = new WeakMap<EffectCause, Set<EntityId>>();
    return {
      onTick(hero) {
        if (hero.motor.mode !== 'flight') return;
        const ground = ctx.physics.groundHeight(hero.pos.x, hero.pos.z, hero.pos.y);
        if (ground === null || hero.pos.y - ground <= SKY_STITCH_CEILING_M) return;
        hero.pos.y = ground + SKY_STITCH_CEILING_M;
        hero.vel.y = Math.min(hero.vel.y, 0);
      },
      onEffect(name, target, cause) {
        if (name === 'slipstreamHit') {
          if ((cause.values?.pass ?? 0) > 0) ctx.effects.apply(SLIPSTREAM_PASS, target, cause);
        } else if (name === 'scytheHit') {
          if (target.entity === null) return;
          let seen = passes.get(cause);
          if (!seen) passes.set(cause, (seen = new Set()));
          if (seen.has(target.entity)) {
            if ((cause.values?.stun ?? 0) > 0) ctx.effects.apply({ kind: 'applyStatus', status: STUN, durationS: 'stun' }, target, cause);
          } else seen.add(target.entity);
        } else if (name === 'skyStitchSlam') {
          if ((cause.values?.slam ?? 0) <= 0) return;
          const { x, y, z } = target.point;
          const point = { x, y: ctx.physics.groundHeight(x, z, y) ?? y, z };
          ctx.effects.applyAll(SKY_STITCH_SLAM, { entity: null, point, dir: target.dir }, cause);
        }
      },
    };
  },
};
