// Item behaviour that triggers can't say (data/items-kit.ts Rider): Forager's Talon, Skipping Stone and Kestrel's Eye
// ride on gun hits, Hooked Spur and Stoop Dive on heavy melee, Carrion Feast on kills and assists.
import type { EntityId, HeroEntity, SimContext, Vec3 } from '../core/contracts';
import { distSq, vec3 } from '../core/math';
import { COMBAT } from '../data/combat';
import { ITEM_RIDERS } from '../data/items';
import { itemCause } from './triggers';

/** Floor for the resist factor, so a near-immune target can't make an extra explode. */
const MIN_FACTOR = 0.05;

export function createRiders(ctx: SimContext): void {
  const heroOf = (id: EntityId | null): HeroEntity | undefined => (id === null ? undefined : ctx.store.getKind(id, 'hero'));
  const owned = (h: HeroEntity) => h.inventory.items.filter((o) => ITEM_RIDERS[o.item]);

  /** Raw Talon damage that lands as `amount` after the target's resist and amplification (GDD §5.2 steps 5 and 6). */
  const raw = (id: EntityId, amount: number): number => {
    const t = ctx.store.get(id);
    const s = t && 'stats' in t ? t.stats.final : undefined;
    if (!s) return amount;
    const resist = Math.min(COMBAT.resistMax, Math.max(COMBAT.resistMin, s.talonResist - s.talonShred));
    return amount / Math.max(MIN_FACTOR, (1 - resist) * (1 + Math.min(COMBAT.ampCap, s.talonAmp)));
  };
  const at = (id: EntityId, p: Vec3) => ({ entity: id, point: { ...p }, dir: vec3() });

  ctx.bus.on('damage.applied', (e) => {
    if (e.proc || e.via !== 'weapon' || e.amount <= 0) return;
    const h = heroOf(e.source);
    const target = ctx.store.get(e.target);
    if (!h || h.health.dead || !target || target.team === e.sourceTeam) return;
    const dist = Math.sqrt(distSq(h.pos, target.pos));
    for (const o of owned(h)) {
      for (const r of ITEM_RIDERS[o.item]!) {
        if (r.on !== 'gunHit' || (r.vs === 'hero' && e.targetKind !== 'hero') || (r.vs === 'nonHero' && e.targetKind === 'hero')) continue;
        if (r.minM !== undefined && dist < r.minM) continue;
        const cause = { ...itemCause(h, o.item), proc: true };
        if (r.extra) ctx.effects.apply({ kind: 'damage', amount: raw(e.target, e.amount * r.extra), type: 'talon' }, at(e.target, e.pos), cause);
        if (r.effects) ctx.effects.applyAll(r.effects, at(e.target, e.pos), cause);
        if (r.bounce) {
          let best: EntityId | null = null;
          let bestD = r.bounce.radius * r.bounce.radius;
          for (const id of ctx.spatial.query(target.pos, r.bounce.radius + COMBAT.hitboxQueryPad, [])) {
            const c = ctx.store.get(id);
            if (!c || id === e.target || (c.kind !== 'hero' && c.kind !== 'unit') || c.team === h.team || c.removed || c.health.dead) continue;
            const d = distSq(c.pos, target.pos);
            if (d <= bestD) { bestD = d; best = id; }
          }
          if (best !== null) {
            ctx.effects.apply({ kind: 'damage', amount: raw(best, e.amount * r.bounce.fraction), type: 'talon' }, at(best, ctx.store.get(best)!.pos), cause);
          }
        }
      }
    }
  });

  ctx.bus.on('melee', (e) => {
    const h = heroOf(e.attacker);
    const target = e.target === null ? undefined : ctx.store.getKind(e.target, 'hero');
    if (!e.heavy || e.parried || !h || !target || target.team === h.team) return;
    for (const o of owned(h)) {
      for (const r of ITEM_RIDERS[o.item]!) {
        if (r.on === 'heavyMelee' && r.effects) ctx.effects.applyAll(r.effects, at(target.id, target.pos), { ...itemCause(h, o.item), proc: true });
      }
    }
  });

  const rewarded = (id: EntityId | null): void => {
    const h = heroOf(id);
    if (!h || h.health.dead) return;
    for (const o of owned(h)) {
      for (const r of ITEM_RIDERS[o.item]!) {
        if (r.on !== 'killAssist') continue;
        const cause = itemCause(h, o.item);
        if (r.healMaxPct) ctx.effects.apply({ kind: 'heal', amount: h.stats.final.maxHealth * r.healMaxPct }, at(h.id, h.pos), cause);
        if (r.effects) ctx.effects.applyAll(r.effects, at(h.id, h.pos), cause);
      }
    }
  };
  ctx.bus.on('entity.died', (e) => {
    if (e.victimKind !== 'hero') return;
    rewarded(e.creditHero);
    for (const id of e.assisters) rewarded(id);
  });
}
