# tests/

QA's cross-system suites (D-EP-010). Unit tests live next to their code (`src/**/*.test.ts`); browser tests are in
`e2e/`. Everything here runs in `npm test` (and so in `npm run check`) except the pending suites.

| Path | What |
|---|---|
| `determinism.test.ts` | Two 6v6 matches (seed 1, a scripted human that moves, jumps, fires, melees and casts, plus 11 bots) stepped in lockstep for 3 sim minutes: identical `hash()` every 10 s, identical event stream, telemetry and view. Seed 2 runs a minute without crashing and ends elsewhere. |
| `contracts/damage.test.ts` | **Pending** (Combat, W2). The GDD §5.2 pipeline step by step, resists and shred, beak shots, falloff, shields, structure rules, lifesteal, kill credit, assists, respawn. |
| `rules/pods.test.ts` | **Pending** (Economy, W3). GDD §8.2: instant share, pod rise, ripe window, secure, deny, wither, no-hero split. |
| `rules/fledglings.test.ts` | **Pending** (Objectives, W3). GDD §7.1: wave timing and composition, formation, marching, targeting rules 1–4, leash, attacks. One test runs 20 sim minutes. |
| `helpers/sandbox.ts` | The ability sandbox (below). |
| `helpers/lanes.ts` | Lane polyline maths: progress from a gate, distance from the path, points along it. |

## Pending suites

Suites written test-first (D-EP-006) are gated with `describe.runIf(process.env.PERCH_PENDING === '1')`, so they are
skipped in `npm run check` until their system lands. Run one with:

```bash
PERCH_PENDING=1 npx vitest run tests/contracts/damage.test.ts
```

Every assertion names the GDD section it checks. If you think an assertion misreads the GDD, say so in your Log entry
rather than editing it; QA and the EP flip a suite to always-on at the wave gate once its system passes it.

## The ability sandbox

`createSandbox({ heroes, map, options, seed, regen })` builds a small match (default: the flat `'arena'`, every
ability unlocked, no waves or neutrals, seed 1, no health regeneration) and returns the sim plus helpers. The first
hero is Dawn's human, the rest are Dusk unless given a `team`. Every step sends a command for every hero, so bots
never act: a sandbox hero does only what the test says.

| Helper | Does |
|---|---|
| `heroes` | Hero entity ids, in the order given |
| `place(id, at, yaw?)`, `dummy({ kind, type, team, at, hp })` | Put an entity somewhere (heroes also get a physics `teleport`); spawn a unit or structure target |
| `move`, `look`, `aimAt(id, pointOrEntity, 'head' \| 'body')` | Axes and look; `aimAt` turns the hero so its crosshair ray passes exactly through the target |
| `hold`, `release`, `press`, `fire(id, on)`, `cast(id, slot, target?)`, `upgrade(id, slot)` | Buttons (held until released, or pressed for one step); `cast` aims and presses ability slot 0–3 |
| `step(n)`, `stepUntil(done, maxTicks)` | Advance; `stepUntil` returns the ticks taken or `null` |
| `events`, `eventsOf(type)`, `clearEvents()` | Every event since creation or the last clear |
| `hero(id)`, `health(id)`, `statuses(id)`, `pointOf(id, part)`, `view` | Read state |
| `cause(source, overrides)`, `apply(effects, target, cause)`, `modify(id, key, mods)` | Apply effects as another system would; add a test-only stat or condition source (`sandbox:<key>`) |

### Worked example: an ability smoke test

A Hero Engineer's smoke test sits next to the hero (`src/sim/heroes/shrike/shrike.test.ts`). Shrike's Briar Patch
(GDD §9.1, ability 2, so slot 1) is a 5 m zone that deals Song damage every second and slows:

```ts
import { expect, it } from 'vitest';
import type { EntityId } from '../../core/contracts';
import { createSandbox } from '../../../../tests/helpers/sandbox';

it('Briar Patch damages and slows an enemy standing in it', async () => {
  const sb = await createSandbox({
    heroes: [
      { hero: 'shrike', at: { x: 0, y: 0, z: -10 } }, // Dawn, the caster
      { hero: 'pelican', at: { x: 0, y: 0, z: 5 } }, // Dusk, the target
    ],
  });
  const [shrike, pelican] = sb.heroes as [EntityId, EntityId];
  sb.cast(shrike, 1, { x: 0, y: 0, z: 5 }); // aim at the ground under the Pelican and press ability 2
  sb.step(60); // one second

  const hits = sb.eventsOf('damage.applied').filter((e) => e.source === shrike && e.target === pelican);
  expect(hits.length).toBeGreaterThan(0);
  expect(hits.every((e) => e.damageType === 'song' && e.via !== 'weapon')).toBe(true);
  expect(sb.statuses(pelican)).toContain('slow'); // the shared slow's status id from src/sim/data/combat.ts
  expect(sb.hero(shrike).abilities.slots[1].readyAt).toBeGreaterThan(sb.sim.tick); // on cooldown
});
```
