import type { EffectCause, EffectVia, EntityId, HeroEntity, ItemDef, SimContext, TriggerDef, TriggerEvent } from '../core/contracts';
import { distSq, normalize, sub, ticks } from '../core/math';

export function itemCause(h: HeroEntity, item: string): EffectCause {
  return { source: h.id, team: h.team, via: 'item', ability: null, item, values: null,
    songPower: h.stats.final.songPower, proc: false, origin: { ...h.pos } };
}

interface Trigger {
  def: TriggerDef;
  cause: EffectCause;
  expires: number | null;
  count: number;
  fired: number;
  readyAt: number;
}

export function createTriggers(ctx: SimContext) {
  const triggers = new Map<EntityId, Trigger[]>();
  const rng = ctx.rng.stream('items/procs');
  const procLethals = new Set<EntityId>();

  function add(holder: EntityId, def: TriggerDef, cause: EffectCause, expires: number | null): void {
    const list = triggers.get(holder) ?? [];
    list.push({ def, cause, expires, count: 0, fired: 0, readyAt: 0 });
    triggers.set(holder, list);
  }

  function fire(holder: EntityId | null, event: TriggerEvent, other: EntityId | null, via?: EffectVia): void {
    const list = holder === null ? undefined : triggers.get(holder);
    if (!list || holder === null) return;
    const h = ctx.store.getKind(holder, 'hero');
    if (!h) return;
    const now = ctx.clock.tick;
    // A proc may grant another trigger. Only the original subscriptions see this event.
    const count = list.length;
    for (let i = 0; i < count; i++) {
      const t = list[i]!;
      const d = t.def;
      if (d.on !== event || (t.expires !== null && now >= t.expires) || now < t.readyAt) continue;
      const target = d.target === 'self' ? h : other === null ? undefined : ctx.store.get(other);
      if (!target || (d.heroesOnly && (other === null || !ctx.store.getKind(other, 'hero')))) continue;
      if (d.via !== undefined && d.via !== via) continue;
      if (d.withinM !== undefined && (!target || distSq(target.pos, h.pos) > d.withinM * d.withinM)) continue;
      if (++t.count < (d.count ?? 1)) continue;
      t.count = 0;
      if (d.chance < 1 && !rng.chance(d.chance)) continue;
      t.readyAt = now + ticks(d.cooldownS);
      // A limited trigger ends after its last use (Warbler's Trill 1, Skylark Cadence 3).
      if (d.uses !== undefined && ++t.fired >= d.uses) t.expires = now;
      const cause = t.expires === null && t.cause.item ? itemCause(h, t.cause.item) : t.cause;
      ctx.effects.applyAll(d.effects, { entity: target.id, point: { ...target.pos }, dir: normalize(sub(target.pos, h.pos)) },
        { ...cause, proc: true, origin: { ...h.pos } });
    }
  }

  ctx.effects.handle('trigger', 'items', (effect, target, cause) => {
    if (target.entity === null) return;
    const duration = ticks(ctx.effects.magnitude(effect.durationS, cause));
    if (duration > 0) add(target.entity, effect.trigger, cause, ctx.clock.tick + duration);
  });
  ctx.bus.on('damage.applied', (e) => {
    if (e.proc) {
      if (e.lethal) procLethals.add(e.target);
      return;
    }
    if (e.amount <= 0) return;
    fire(e.target, 'damaged', e.source, e.via);
    if (e.source === null || ctx.store.get(e.target)?.team === e.sourceTeam) return;
    if (e.via === 'weapon') {
      fire(e.source, 'weaponHit', e.target);
      if (e.beakShot) fire(e.source, 'beakShot', e.target);
    } else if (e.via === 'melee') fire(e.source, 'meleeHit', e.target);
    else if (e.ability !== null || e.item !== null || e.via === 'ability' || e.via === 'item') fire(e.source, 'abilityHit', e.target);
  });
  ctx.bus.on('ability', (e) => { if (e.stage === 'land') fire(e.caster, 'cast', null); });
  ctx.bus.on('entity.died', (e) => {
    if (!procLethals.delete(e.victim) && e.victimKind === 'hero') {
      fire(e.creditHero, 'kill', e.victim);
      for (const id of e.assisters) fire(id, 'assist', e.victim);
    }
    const list = triggers.get(e.victim);
    if (list) triggers.set(e.victim, list.filter((t) => t.expires === null));
  });
  return {
    equip(h: HeroEntity, item: ItemDef) {
      for (const def of item.procs) add(h.id, def, itemCause(h, item.id), null);
    },
    remove(h: HeroEntity, item: ItemDef) {
      const list = triggers.get(h.id);
      if (list) triggers.set(h.id, list.filter((t) => t.expires !== null || t.cause.item !== item.id));
    },
    expire() {
      for (const [id, list] of triggers) {
        for (let i = list.length - 1; i >= 0; i--) {
          const end = list[i]!.expires;
          if (end !== null && end <= ctx.clock.tick) list.splice(i, 1);
        }
        if (!list.length) triggers.delete(id);
      }
    },
    state: triggers,
  };
}
