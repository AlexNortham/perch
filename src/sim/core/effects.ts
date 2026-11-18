import { EFFECT_OWNERS } from './contracts';
import type { Effect, EffectCause, EffectHandler, EffectKind, EffectRouter, EffectTarget, Magnitude } from './contracts';

type AnyHandler = (effect: Effect, target: EffectTarget, cause: EffectCause) => void;

/** `ctx.effects`: routes each effect kind to the one handler its owner registered. */
export function createEffectRouter(): EffectRouter {
  const handlers = new Map<EffectKind, AnyHandler>();

  const valueOf = (v: number | string, cause: EffectCause): number => {
    if (typeof v === 'number') return v;
    const n = cause.values?.[v];
    if (n === undefined) throw new Error(`effect magnitude refers to unknown value '${v}' (ability ${cause.ability})`);
    return n;
  };

  const router: EffectRouter = {
    handle<K extends EffectKind>(kind: K, owner: string, handler: EffectHandler<K>) {
      if (EFFECT_OWNERS[kind] !== owner) {
        throw new Error(`effect '${kind}' belongs to ${EFFECT_OWNERS[kind]}, not ${owner}`);
      }
      if (handlers.has(kind)) throw new Error(`effect '${kind}' already has a handler`);
      handlers.set(kind, handler as AnyHandler);
    },
    apply(effect, target, cause) {
      handlers.get(effect.kind)?.(effect, target, cause);
    },
    applyAll(effects, target, cause) {
      for (const e of effects) router.apply(e, target, cause);
    },
    magnitude(m: Magnitude, cause) {
      if (typeof m !== 'object') return valueOf(m, cause);
      return valueOf(m.of, cause) + cause.songPower * m.song;
    },
  };
  return router;
}
