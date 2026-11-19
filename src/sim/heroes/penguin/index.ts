/**
 * Penguin's hooks: only what data can't say yet.
 * - Toboggan: each enemy touched is knocked 4 m to the side of the slide (or up 0.5 s at T3), once, by the movement mode's
 *   onCollide. Space's hop out of the slide is Physics' (the toboggan movement mode), not a hook.
 * - Emperor's March: heroes you touch while it lasts go up and take damage once each; when it ends, the slam.
 */
import type { EffectCause, EffectTarget, EntityId, HeroEntity, HeroModule, Tick, Vec3 } from '../../core/contracts';
import { STUN } from '../../data/combat';
import { TICK_RATE } from '../../data/core';
import { MARCH, penguinDef, TOBOGGAN_ASIDE_M, TOBOGGAN_HIT_HOOK, TOBOGGAN_KNOCK_UP_M } from '../../data/heroes/penguin';

const MARCH_ABILITY = 'penguin.emperorsMarch';
/** Touch reach beyond the two bodies (m). */
const TOUCH_MARGIN = 0.3;
const MARCH_FALLBACK_SECONDS = 3; // used when the cast carries no tuned duration
const MARCH_FALLBACK_STUN_S = 0.75;
const UP: Vec3 = { x: 0, y: 0, z: 1 };

interface March {
  readonly until: Tick;
  readonly cause: EffectCause;
  readonly hit: Set<EntityId>;
  readonly stun: number;
}

export const penguin: HeroModule = {
  def: penguinDef,
  implemented: true,
  hooks: (ctx) => {
    const marches = new Map<EntityId, March>();
    const at = (e: { id: EntityId; pos: Vec3 }, dir: Vec3 = UP): EffectTarget => ({ entity: e.id, point: { ...e.pos }, dir });

    const slam = (hero: HeroEntity, m: March): void => {
      ctx.effects.apply(
        {
          kind: 'area',
          shape: { kind: 'sphere', radius: MARCH.slamRadius },
          durationS: 0,
          attach: 'source',
          affects: { teams: 'enemies' },
          effects: [
            { kind: 'damage', amount: { of: MARCH.slamHit, song: MARCH.slamK }, type: 'song' },
            { kind: 'applyStatus', status: STUN, durationS: m.stun },
          ],
        },
        { entity: hero.id, point: { ...hero.pos }, dir: UP },
        m.cause,
      );
    };

    return {
      onEffect(name, target, cause) {
        if (name !== TOBOGGAN_HIT_HOOK || target.entity === null || cause.source === null) return;
        const hero = ctx.store.getKind(cause.source, 'hero');
        const foe = ctx.store.get(target.entity);
        if (!hero || !foe) return;
        if ((cause.values?.knockUp ?? 0) > 0) {
          ctx.effects.apply({ kind: 'displace', mode: 'up', distance: TOBOGGAN_KNOCK_UP_M }, target, cause);
          return;
        }
        // Aside: perpendicular to the slide, on the side the enemy is on.
        const d = target.dir;
        const len = Math.hypot(d.x, d.z) || 1;
        const px = d.z / len;
        const pz = -d.x / len;
        const side = Math.sign((foe.pos.x - hero.pos.x) * px + (foe.pos.z - hero.pos.z) * pz) || 1;
        ctx.effects.apply({ kind: 'displace', mode: 'along', distance: TOBOGGAN_ASIDE_M }, { ...target, dir: { x: px * side, y: 0, z: pz * side } }, cause);
      },
      onCast(cast) {
        if (cast.ability.id !== MARCH_ABILITY) return;
        const seconds = cast.cause.values?.duration ?? MARCH_FALLBACK_SECONDS;
        marches.set(cast.hero.id, {
          until: ctx.clock.tick + Math.round(seconds * TICK_RATE),
          cause: cast.cause,
          hit: new Set(),
          stun: cast.cause.values?.stun ?? MARCH_FALLBACK_STUN_S,
        });
      },
      onTick(hero) {
        const m = marches.get(hero.id);
        if (!m) return;
        if (hero.health.dead) {
          marches.delete(hero.id);
          return;
        }
        if (ctx.clock.tick >= m.until) {
          marches.delete(hero.id);
          slam(hero, m);
          return;
        }
        for (const foe of ctx.store.list('hero')) {
          if (foe.team === hero.team || foe.health.dead || m.hit.has(foe.id)) continue;
          if (Math.hypot(foe.pos.x - hero.pos.x, foe.pos.z - hero.pos.z) > hero.radius + foe.radius + TOUCH_MARGIN) continue;
          m.hit.add(foe.id);
          const dir = { x: Math.sin(hero.yaw), y: 0, z: Math.cos(hero.yaw) };
          ctx.effects.apply({ kind: 'damage', amount: { of: MARCH.touchHit, song: MARCH.touchK }, type: 'song' }, at(foe, dir), m.cause);
          ctx.effects.apply({ kind: 'displace', mode: 'up', distance: MARCH.knockUpM }, at(foe, dir), m.cause);
        }
      },
    };
  },
};
