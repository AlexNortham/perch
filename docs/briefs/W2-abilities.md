# Wave 2 — Ability Systems Engineer (#8), tag ABIL

Read [W2-common.md](W2-common.md) first; its rules apply.

**Read as well:** INTERFACES.md §4 (the effect kinds you own), §5 (the `ability`, `ability.upgraded` and `hero.level`
events) and §7 (data shapes); `src/sim/core/contracts/abilities.ts`, `effects.ts`, `heroes.ts` (`HeroModule`,
`HeroHooks`, `AbilityCast`), `command.ts`; `src/sim/core/effects.ts` (the router); GDD §8 (AP, upgrade costs 1/2/5,
ultimate unlock), §9 (every hero's kit, skimmed so you know what the framework must express) and §9.25 (effect
primitives).

The effect kinds combat and physics own (damage, heal, statuses, displace, dash …) are unregistered on your branch and
the router ignores them, so test your routing with spies or fakes in your own test files.

## Your job
You own `src/sim/abilities/**` and `src/sim/data/abilities.ts`. Never edit `src/sim/heroes/**` or
`src/sim/data/heroes/**` (the Hero Engineers'). Replace the stub. Next wave Hero Engineer A builds four full kits using
**only** your framework, so it must express every kit in GDD §9 as data plus, rarely, a hook.

1. **Casting**, driven by the hero's latched `command` (pressed slot): targeting (self, direction, unit, point) using
   `core/aim.ts`; validation (cooldown, charges, cast range, silence/stun/disarm through `ctx.stats` conditions); cast
   time; `rooted`; effects through `ctx.effects`; channels with channel effects; end and interrupt; charges and
   cooldowns with cooldown reduction from stats; `ability` events (start, land, end, interrupted).
2. **Progression:** AP granted on `hero.level`; upgrade intents from commands spend AP at the 1/2/5 tier costs; tiers
   apply value deltas, cooldown, charges, range and extra effects; ability unlock rules and the ultimate unlock at level
   6 per the GDD; `ability.upgraded` events. Costs and unlock levels in `src/sim/data/abilities.ts`. Honour the
   `unlockAbilities` sim option (tests and sandboxes use it).
3. **The effect kinds you own**, registered with `ctx.effects.handle(kind, 'abilities', handler)`: `area` (instant or
   lasting; sphere, cylinder, cone, ring, box; attached, fixed or moving; tick, enter, exit and cross effects),
   `summon` (trap, decoy, wall, turret, with their entities and lifetimes), `tether`, `delay`, `cooldownMod`, and `hook`
   (calls the source hero module's `onEffect`). `EffectCause` travels with everything you spawn.
4. **The `abilities` component:** slots, AP, casting state, and what the view, UI and AI need.
5. **A kit validator:** a function plus a test that checks every `AbilityDef` in all 24 hero data files (valid effect
   kinds, named values resolve, 3 upgrade tiers each). The files hold placeholders now; write it so the Hero Engineers
   run it on real kits next wave, and say how in your report.

## Prove it
- Co-located tests for each targeting type; cooldowns and charges; cast time and channel, including an interrupt by
  stun; silence blocking a cast; AP spend per tier; the ultimate locked before level 6; each owned effect kind (area
  shapes and tick/enter/exit, every summon type, tether break distance, delay, cooldown reset and refund, hook); cause
  propagation.
- Fixture kits for **three real GDD heroes** with very different kits, expressed fully as data in your test fixtures
  (not in the hero data files), proving the framework covers them.
- Performance: ms per tick with 12 heroes casting and ~30 areas and summons live. Your share of the ≤ 1 ms budget is
  about 0.15 ms.
- `npm run check` passes on your branch.

Extra for your report: ms per tick, and which GDD abilities (if any) the framework can't express yet.
