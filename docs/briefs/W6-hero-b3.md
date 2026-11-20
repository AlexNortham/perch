# Wave 6 · Hero Engineer B (#10) · batch B3 · tag HEROB

Read W5-common.md first. You own `src/sim/heroes/{frigatebird,cockatoo,swan,kiwi}/**` and their data files under
`src/sim/data/heroes/`.

**Read before you start:**
- GDD §9.21–9.24 for these four birds, plus §9.0.1 and §9.25;
- the 20 implemented birds, as patterns (Cassowary, Toucan, Woodpecker and Nightjar are the newest);
- tests/README.md;
- your section of W5-contract-followups.md;
- INTERFACES §15 (the W5.5 contract round: typed `surface` and `steerDeg`, `HealEffect.triggerPct`, `endOn: 'stun'`,
  `TriggerDef.beyondM`, `ShieldEffect.id`, layer bits).

**Ship Frigatebird, Cockatoo, Swan and Kiwi** to the same bar as batch B2:
- data, with hooks only where data can't express the effect;
- descriptions for every ability and tier;
- a gun test and an ability smoke test for every ability;
- the kit validator passing;
- `implemented: true`.

**Watch for these:**
- Frigatebird's Harpoon Line is a long pull plus stun.
- Swan's Grace Link is a healing tether; its break distance is a fixed value this wave (a tiered `breakDistance` was
  deferred to wave 6, so ask in Interface requests if you need it).
- Swan Song means allies can't die and then heal.
- Kiwi's Burrow and Ambush Pit move it underground: no collision with heroes, invisible, and it erupts.
- Cockatoo's Sulphur Shriek is a channelled stun.

If any of these needs a framework feature that doesn't exist, build the smallest data-driven version in the owning system
and say so, or write it under Interface requests.

**Models are not yours.** A Technical Artist builds these four birds on the v2.1 sculpt pipeline after the batch
conversions. Until then the client falls back to its default bird for them: check that it does, and that picking any of
the 24 birds from the menu starts a match.

**Bots:**
- Bots must be able to play these four: their abilities need bot cast conditions in `src/sim/data/ai.ts`. That file is
  Bot AI's, and it's working now, so add a clearly separated block for your four birds and expect a merge.
- Give each of the four a `STARTER_SCORES` archetype entry if it lacks one.

**Done means:**
- `npm run check` passes all six steps. Known failures that are not yours: load-sensitive e2e and perf timeouts that pass
  alone, and the audio live-context test.
- STATUS entry and D-HEROB decisions.
- Reply in at most 150 words.
