# Wave 5a · Hero Engineer A (#9) · batch A3 · tag HEROA

Read W5-common.md first. You own `src/sim/heroes/{peacock,vulture,swift,hummingbird}/**` and their data files.

**Read:** GDD §9 for those four birds, plus §9.0.1 and §9.25; the A1 and A2 implementations as patterns; tests/README.md
(the sandbox); and your section of W5-contract-followups.md.

**Ship Peacock, Vulture, Swift and Hummingbird.** Each needs:
- its GDD body plan, stats and gun;
- all four abilities with every tier;
- player-facing descriptions for every ability and tier;
- a team-readable colour;
- `implemented: true`.

Use hooks only where data can't express an effect.

**Tests for each bird:**
- a gun test;
- an ability smoke test for every ability, at a relevant tier;
- a check that the ultimate stays locked until level 6.

The kit validator must pass. Models belong to the Technical Artist (wave 5b); the generic bird stands in until then.
`npm run check` must pass all six steps.
