/**
 * Toucan's hooks: only what data can't say.
 * - Fruit Barrage: each mortar is a delay in the data that fires a hook, which picks its spot at random (a seeded
 *   stream) inside the barrage's radius around the cast point and drops the 3 m burst there.
 * - Branch Swing T3: the gun buff starts when the swing ends (a duration of 0 would still apply a 1-tick status).
 */
import type { HeroModule } from '../../core/contracts';
import * as dmath from '../../core/dmath';
import { MORTAR, MORTAR_HOOK, SWING_BUFF, SWING_LAND_HOOK, toucanDef } from '../../data/heroes/toucan';

const BARRAGE_RADIUS_M = 9;
const FULL_TURN = 2 * Math.PI;

export const toucan: HeroModule = {
  def: toucanDef,
  implemented: true,
  hooks: (ctx) => {
    const rng = ctx.rng.stream('heroes/toucan');
    return {
      onEffect(name, target, cause) {
        if (name === SWING_LAND_HOOK) {
          if (target.entity !== null && (cause.values?.landBuff ?? 0) > 0) ctx.effects.apply(SWING_BUFF, target, cause);
          return;
        }
        if (name !== MORTAR_HOOK) return;
        // Uniform over the disc: the radius goes with the square root of a uniform draw.
        const r = (cause.values?.radius ?? BARRAGE_RADIUS_M) * Math.sqrt(rng.next());
        const a = rng.next() * FULL_TURN;
        const point = { x: target.point.x + r * dmath.cos(a), y: target.point.y, z: target.point.z + r * dmath.sin(a) };
        ctx.effects.apply(MORTAR, { entity: null, point, dir: target.dir }, cause);
      },
    };
  },
};
