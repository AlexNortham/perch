# W4.5 · QA (#20) · test-first suites for Stage 4 · tag QA

Read W5-common.md first. You own `tests/**` and `e2e/**`. The design (GDD, merged from the Director's W4.5 pass) and
the contracts (INTERFACES §13–14, the Architect's W4.5 round) are on `integrate/w5`. Write the suites **before** the
wave 5 implementers start (D-EP-006). Every suite that would fail today is gated: rules suites with
`describe.runIf(process.env.PERCH_PENDING === '1')`, browser specs with the existing pending convention, so
`npm run check` stays green. Each assertion cites its GDD section or decision.

## Rules suites (tests/rules/)
- Golden Egg (GDD §7): spawn timing, **melee pickup**, carrier rules (can't shoot or cast; revealed), drop on death,
  automatic delivery and payout.
- The Roc and Phoenix Embers: spawn, attacks, the three Embers and Rekindle revives, claim rules, buffs, durations.
- Thickets: tiers, creatures, respawn, payouts, the indoor camps.
- Nests: the three types, contents, Seeds, buffs, respawn.
- Feather runes: spawn spots, timers, effects, durations.
- The new interactables, each with its GDD rule: Keepsakes (permanent boons), Bell Feeders, Berries, Hides, Bough
  Springs, Lookouts, ivy curtains, the Cellar Run, the Magpie Den.
- No Interact (D-EP-039): Updraft latch on a held Jump within reach anywhere along the cable; a fresh press
  dismounts; no command uses the Interact bit.
- 64 items (§10): the catalogue holds 64 items (21/21/22), 15 actives, at most 4 active slots; each new item's
  effect, with one test per item.
- Bot shopping (D-EP-036): purchases are sampled from item scores (deterministic per seed); over 20 seeded matches no
  two builds of the same hero are near-identical (define the similarity measure and threshold, and justify them);
  a mean synergy score above a random-purchase baseline.

## Browser specs (e2e/)
- Hold to upgrade (D-EP-038): holding the upgrade key pauses aiming and frees a cursor over the HUD ability bar;
  clicking an icon or pressing 1–4 upgrades when affordable; hover shows the next tier; releasing returns to aiming
  with no extra click; there is no separate upgrade dialog.
- Top scoreboard (D-EP-041): always visible; six portraits per side with Seeds and health; a dead bird shows a
  respawn countdown; Tab does nothing and isn't bindable.
- Practice Hub Swap bird (D-EP-040): opens the picker without leaving the hub; respawn as the new bird; 32 AP again.
- **Hero select layout shift (user-reported bug):** hover and focus every card in turn; assert that no card's
  bounding box moves by even 1 px.
- No Interact: the Options list has no Interact entry; a saved profile that had one loads with every other binding
  intact.

## Done means
Every suite runs under `PERCH_PENDING=1` and fails only for missing implementation (show the failure summary), with
no errors in the suites themselves. `npm run check` passes all six steps with the pending suites gated off. STATUS
entry `### W4.5 · QA test-first · <date>` listing each suite and its assertion count. Reply in at most 200 words.
