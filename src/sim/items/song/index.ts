// Song-only item effects that the effect vocabulary can't carry as data (GDD §10.3): Crescendo, Echo Chamber's repeat
// and Boundless Song's ultimate cooldown. Called once from createItemSystem; stateless, so nothing to hash.
import type { EntityId, HeroEntity, ItemId, SimContext } from '../../core/contracts';
import { TICK_RATE } from '../../data/core';
import { vec3 } from '../../core/math';
import { itemCause } from '../triggers';

/** ponytail: the extra and the echo are separate Song hits, so the target's resists apply to them again. */
export const CRESCENDO = { minHit: 100, bonus: 0.2 } as const;
export const ECHO = { delayS: 1, fraction: 0.25 } as const;
export const BOUNDLESS = { ultimateSlot: 3, cooldownCut: 0.2 } as const;

export function createSongItems(ctx: SimContext): void {
  const owns = (id: EntityId | null, item: ItemId): HeroEntity | undefined => {
    const h = id === null ? undefined : ctx.store.getKind(id, 'hero');
    return h && !h.health.dead && h.inventory.items.some((o) => o.item === item) ? h : undefined;
  };

  ctx.bus.on('damage.applied', (e) => {
    if (e.proc || e.damageType !== 'song' || e.amount <= 0 || (e.via !== 'ability' && e.ability === null)) return;
    const target = ctx.store.get(e.target);
    if (!target || target.team === e.sourceTeam) return;
    const crescendo = e.amount >= CRESCENDO.minHit ? owns(e.source, 'crescendo') : undefined;
    if (crescendo) {
      ctx.effects.apply({ kind: 'damage', amount: e.amount * CRESCENDO.bonus, type: 'song' },
        { entity: e.target, point: { ...e.pos }, dir: vec3() }, { ...itemCause(crescendo, 'crescendo'), proc: true });
    }
    const echo = e.targetKind === 'hero' ? owns(e.source, 'echo-chamber') : undefined;
    if (echo) {
      ctx.effects.apply({ kind: 'delay', seconds: ECHO.delayS, effects: [{ kind: 'damage', amount: e.amount * ECHO.fraction, type: 'song' }] },
        { entity: e.target, point: { ...e.pos }, dir: vec3() }, { ...itemCause(echo, 'echo-chamber'), proc: true });
    }
  });

  // The cooldown has started by the 'land' event; take a fifth of what remains off the ultimate.
  ctx.bus.on('ability', (e) => {
    if (e.stage !== 'land' || e.slot !== BOUNDLESS.ultimateSlot) return;
    const h = owns(e.caster, 'boundless-song');
    if (!h) return;
    const left = Math.max(0, h.abilities.slots[e.slot]!.readyAt - ctx.clock.tick) / TICK_RATE;
    if (left > 0) {
      ctx.effects.apply({ kind: 'cooldownMod', scope: 'slot', slot: e.slot, mode: 'refund', seconds: left * BOUNDLESS.cooldownCut },
        { entity: h.id, point: { ...h.pos }, dir: vec3() }, itemCause(h, 'boundless-song'));
    }
  });
}
