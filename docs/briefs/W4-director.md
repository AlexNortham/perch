# W4 · Game Director · Movement and tower clearance

Own docs/GDD.md and your decision/log appends. Read W4-common.md, W4-movement.md, D-EP-027 and the M1
reproduction findings as available. This is a focused design amendment to the player's active M2 request.

Align GDD §3 and the relevant feel checklist with the supplied [movement reference](https://deadlock.wiki/Movement).
Make the real player sequence, timings, stamina costs, limits/resets, slope/momentum and feedback clear. Include
a practical run through an existing lane that combines movements. Reconcile crouch, forward, dash and item
bindings with a normal browser tab and existing Options, the player's charged melee/parry feedback, and any
conflicting instructions in §§4, 5 or 12. Coordinate the browser-safe default and legacy mapping with QA and
the Architect. Keep game text, hero kits and map names original.

Resolve the W3 Level Designer note about the Hawks and Herons directly below the 12 m Updraft. Keep §6.3's
binding x/z anchors, visible tower identity, combat reach and safe rider clearance. Send the precise shared
choice to the EP early; Objectives and Art will use it. Do not alter unrelated design or introduce future stages.
Make each design change a small committed piece with a D-DIR ID and an observable check. Run the standard
six-step check in your own worktree. The EP merges the approved design into main before implementation.
